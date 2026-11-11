import { mulberry32, normalGenerator } from './rng';
import { percentile, scaleSummary, summarize } from './stats';
import type {
  Comparison,
  GuardrailStats,
  SimParams,
  SimResult,
  Strategy,
  StrategyResult,
} from './types';

/** Guyton-Klinger (2006) guardrail settings. */
export const GK = {
  /** The paper's confidence standard: the success rate the guardrails search must reach. */
  targetSuccess: 0.99,
  /** Cut when the current rate exceeds the initial rate by this factor (+20%). */
  upperGuardrail: 1.2,
  /** Raise when the current rate falls below the initial rate by this factor (-20%). */
  lowerGuardrail: 0.8,
  /** Size of a cut or raise. */
  adjustment: 0.1,
  /** The capital-preservation cut is not applied in the final this-many years. */
  noCutFinalYears: 15,
} as const;

/** Bisection steps per search: pins the withdrawal to initialWealth / 2^20, about $1 per $1M. */
const SEARCH_STEPS = 20;

/**
 * Draw every run's annual growth factors (1 + return) up front, so that every trial withdrawal
 * and both strategies face identical markets. Returns are Normal(meanReturn, volatility), clamped
 * at -100%. Run r's year y (both 0-based) is at index r * years + y.
 */
export function drawGrowth(params: SimParams): Float64Array {
  const { meanReturn, volatility, years, runs } = params;
  const normal = normalGenerator(mulberry32(params.seed));
  const growth = new Float64Array(runs * years);
  for (let i = 0; i < growth.length; i++) {
    growth[i] = Math.max(0, 1 + meanReturn + volatility * normal());
  }
  return growth;
}

/** One run's outcome. Withdrawal amounts are in today's dollars. */
interface RunOutcome {
  /** 1-based year whose withdrawal could not be covered, or 0 if the run succeeded. */
  failureYear: number;
  /** Nominal; 0 for a failed run. */
  endingWealth: number;
  totalWithdrawn: number;
  /** The last and the smallest withdrawal; 0 for a failed run. */
  finalWithdrawal: number;
  lowestWithdrawal: number;
  /** Last withdrawal divided by that year's starting portfolio. */
  finalRate: number;
  cuts: number;
  raises: number;
  skippedInflation: number;
}

const newOutcome = (): RunOutcome => ({
  failureYear: 0,
  endingWealth: 0,
  totalWithdrawn: 0,
  finalWithdrawal: 0,
  lowestWithdrawal: 0,
  finalRate: 0,
  cuts: 0,
  raises: 0,
  skippedInflation: 0,
});

/**
 * Simulate one run, writing its outcome to `out`.
 *
 * Each year: take the withdrawal at the start of the year, then apply that year's growth. A run
 * fails when wealth cannot cover a scheduled withdrawal; it takes what is left and ends at 0.
 *
 * Standard strategy: the withdrawal is raised by inflation every year.
 *
 * Guardrails strategy (Guyton-Klinger), applied at the start of each year after the first:
 *  1. Withdrawal rule: raise the withdrawal by inflation, except skip the raise when last year's
 *     return was negative and the current withdrawal rate is above the initial rate.
 *  2. Capital preservation: if the current rate (withdrawal / portfolio) is more than 20% above
 *     the initial rate, cut the withdrawal by 10%. Not applied in the final 15 years.
 *  3. Prosperity: if the current rate is more than 20% below the initial rate, raise it by 10%.
 */
function simulateRun(
  params: SimParams,
  growth: Float64Array,
  strategy: Strategy,
  firstWithdrawal: number,
  run: number,
  out: RunOutcome,
): void {
  const { initialWealth, inflation, years } = params;
  const guardrails = strategy === 'guardrails';
  const initialRate = firstWithdrawal / initialWealth;
  const upper = initialRate * GK.upperGuardrail;
  const lower = initialRate * GK.lowerGuardrail;
  // Tolerance so a withdrawal that exactly exhausts wealth isn't a failure due to rounding.
  const eps = 1e-9 * initialWealth;
  const offset = run * years;

  let w = initialWealth;
  let withdrawal = firstWithdrawal;
  let deflator = 1; // converts this year's dollars to today's dollars
  let rate = initialRate;
  let total = 0;
  let lowest = Infinity;
  let failureYear = 0;
  out.cuts = out.raises = out.skippedInflation = 0;

  for (let y = 0; y < years; y++) {
    if (y > 0) {
      deflator /= 1 + inflation;
      if (!guardrails) {
        withdrawal *= 1 + inflation;
      } else {
        rate = w > 0 ? withdrawal / w : Infinity;
        if (growth[offset + y - 1] < 1 && rate > initialRate) out.skippedInflation++;
        else withdrawal *= 1 + inflation;

        rate = w > 0 ? withdrawal / w : Infinity;
        if (rate > upper && years - y > GK.noCutFinalYears) {
          withdrawal *= 1 - GK.adjustment;
          out.cuts++;
        } else if (rate < lower) {
          withdrawal *= 1 + GK.adjustment;
          out.raises++;
        }
        rate = w > 0 ? withdrawal / w : Infinity;
      }
    }

    if (withdrawal > w + eps) {
      total += w * deflator;
      w = 0;
      failureYear = y + 1;
      break;
    }
    w = Math.max(0, w - withdrawal);
    total += withdrawal * deflator;
    lowest = Math.min(lowest, withdrawal * deflator);
    w *= growth[offset + y];
  }

  out.failureYear = failureYear;
  out.endingWealth = w;
  out.totalWithdrawn = total;
  out.finalWithdrawal = failureYear ? 0 : withdrawal * deflator;
  out.lowestWithdrawal = failureYear ? 0 : lowest;
  out.finalRate = rate;
}

/** Simulate every run of one strategy at a given first-year withdrawal (in dollars). */
export function simulate(
  params: SimParams,
  growth: Float64Array,
  strategy: Strategy,
  firstWithdrawal: number,
): SimResult {
  const { inflation, years, runs } = params;
  const guardrails = strategy === 'guardrails';
  const out = newOutcome();

  const ending = new Float64Array(runs);
  const average = new Float64Array(runs);
  const failureYears = new Float64Array(runs);
  let failures = 0;

  const finalWithdrawal = new Float64Array(guardrails ? runs : 0);
  const lowestWithdrawal = new Float64Array(guardrails ? runs : 0);
  const finalRate = new Float64Array(guardrails ? runs : 0);
  let totalCuts = 0;
  let totalRaises = 0;
  let totalSkipped = 0;
  let runsWithCut = 0;
  let runsWithRaise = 0;

  for (let r = 0; r < runs; r++) {
    simulateRun(params, growth, strategy, firstWithdrawal, r, out);
    ending[r] = out.endingWealth;
    average[r] = out.totalWithdrawn / years;
    if (out.failureYear) failureYears[failures++] = out.failureYear;
    if (guardrails) {
      finalWithdrawal[r] = out.finalWithdrawal;
      lowestWithdrawal[r] = out.lowestWithdrawal;
      if (!out.failureYear) finalRate[r - failures] = out.finalRate; // packed: successes so far
      totalCuts += out.cuts;
      totalRaises += out.raises;
      totalSkipped += out.skippedInflation;
      if (out.cuts) runsWithCut++;
      if (out.raises) runsWithRaise++;
    }
  }

  const successes = runs - failures;
  const nominal = summarize(ending);

  let gkStats: GuardrailStats | null = null;
  if (guardrails) {
    gkStats = {
      finalWithdrawal: summarize(finalWithdrawal),
      lowestWithdrawal: summarize(lowestWithdrawal),
      finalRate: successes ? summarize(finalRate.subarray(0, successes)) : null,
      avgCuts: totalCuts / runs,
      avgRaises: totalRaises / runs,
      avgSkippedInflation: totalSkipped / runs,
      runsWithCut: runsWithCut / runs,
      runsWithRaise: runsWithRaise / runs,
    };
  }

  return {
    strategy,
    initialWithdrawal: firstWithdrawal,
    initialRate: firstWithdrawal / params.initialWealth,
    successes,
    successRate: successes / runs,
    averageWithdrawal: summarize(average),
    nominal,
    real: scaleSummary(nominal, 1 / Math.pow(1 + inflation, years)),
    medianFailureYear: failures ? percentile(failureYears.subarray(0, failures).sort(), 0.5) : null,
    guardrails: gkStats,
  };
}

/** Whether no more than maxFailures runs fail; stops as soon as the answer is known. */
function meetsTarget(
  params: SimParams,
  growth: Float64Array,
  strategy: Strategy,
  firstWithdrawal: number,
  maxFailures: number,
  out: RunOutcome,
): boolean {
  let failures = 0;
  for (let r = 0; r < params.runs; r++) {
    simulateRun(params, growth, strategy, firstWithdrawal, r, out);
    if (out.failureYear && ++failures > maxFailures) return false;
  }
  return true;
}

/**
 * Search for the largest first-year withdrawal (in dollars) whose success rate is at least
 * targetSuccess, by bisection between $0 and the whole portfolio. Every trial withdrawal is
 * simulated against the same pre-drawn markets, so the success rate moves smoothly with the
 * withdrawal instead of jumping around with sampling noise.
 */
export function maxWithdrawal(
  params: SimParams,
  growth: Float64Array,
  strategy: Strategy,
  targetSuccess: number,
  onProgress?: (fraction: number) => void,
): number {
  const { runs, initialWealth } = params;
  // The small offset keeps e.g. 0.99 * 10,000 from rounding up to 9,901 required successes.
  const maxFailures = runs - Math.ceil(targetSuccess * runs - 1e-9);
  const out = newOutcome();
  const meets = (w: number) => meetsTarget(params, growth, strategy, w, maxFailures, out);

  // A $0 withdrawal always succeeds. Taking everything in year one only works for a 1-year horizon.
  let lo = 0;
  let hi = initialWealth;
  if (meets(hi)) lo = hi;
  for (let step = 1; lo < hi && step <= SEARCH_STEPS; step++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) lo = mid;
    else hi = mid;
    onProgress?.(step / SEARCH_STEPS);
  }
  onProgress?.(1);
  return lo;
}

/**
 * Find and simulate the maximum first-year withdrawal under each strategy: standard at the
 * requested success rate, guardrails at the Guyton-Klinger 99% standard.
 */
export function compare(params: SimParams, onProgress?: (fraction: number) => void): Comparison {
  const start = performance.now();
  const growth = drawGrowth(params);

  const solve = (strategy: Strategy, targetSuccess: number, index: number): StrategyResult => {
    const report = onProgress && ((f: number) => onProgress((index + f) / 2));
    const withdrawal = maxWithdrawal(params, growth, strategy, targetSuccess, report);
    return { ...simulate(params, growth, strategy, withdrawal), targetSuccess };
  };

  const standard = solve('standard', params.targetSuccess, 0);
  const guardrails = solve('guardrails', GK.targetSuccess, 1);
  return { params, standard, guardrails, elapsedMs: performance.now() - start };
}
