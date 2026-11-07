import { mulberry32, normalGenerator } from './rng';
import { percentile, scaleSummary, summarize } from './stats';
import type { GuardrailStats, SimParams, SimResult } from './types';

/** Guyton-Klinger guardrail settings. */
export const GK = {
  /** Default initial withdrawal rate for the strategy. */
  initialRate: 0.055,
  /** Cut when the current rate exceeds the initial rate by this factor (+20%). */
  upperGuardrail: 1.2,
  /** Raise when the current rate falls below the initial rate by this factor (-20%). */
  lowerGuardrail: 0.8,
  /** Size of a cut or raise. */
  adjustment: 0.1,
  /** The capital-preservation cut is not applied in the final this-many years. */
  noCutFinalYears: 15,
} as const;

/**
 * Run the Monte Carlo simulation.
 *
 * Each year: take the withdrawal at the start of the year, then apply a Normal(mean, volatility)
 * return, clamped at -100%. A run fails when wealth cannot cover a scheduled withdrawal; its
 * wealth is then 0.
 *
 * Constant strategy: the withdrawal is raised by inflation every year.
 *
 * Guardrails strategy (Guyton-Klinger), applied at the start of each year after the first:
 *  1. Inflation rule: raise the withdrawal by inflation, except skip the raise when last year's
 *     return was negative and the current withdrawal rate is above the initial rate.
 *  2. Capital preservation: if the current rate (withdrawal / portfolio) is more than 20% above
 *     the initial rate, cut the withdrawal by 10%. Not applied in the final 15 years.
 *  3. Prosperity: if the current rate is more than 20% below the initial rate, raise it by 10%.
 */
export function simulate(
  params: SimParams,
  onProgress?: (fraction: number) => void,
): SimResult {
  const start = performance.now();
  const { initialWealth, meanReturn, volatility, inflation, withdrawalRate, years, runs } = params;
  const guardrails = params.withdrawalStrategy === 'guardrails';
  const normal = normalGenerator(mulberry32(params.seed));

  const ending = new Float64Array(runs);
  const failureYears = new Float64Array(runs);
  let failures = 0;
  // Tolerance so a withdrawal that exactly exhausts wealth isn't a failure due to rounding.
  const eps = 1e-9 * initialWealth;
  const progressEvery = Math.max(1, Math.floor(runs / 100));

  // Guardrail tracking (real = today's dollars).
  const upper = withdrawalRate * GK.upperGuardrail;
  const lower = withdrawalRate * GK.lowerGuardrail;
  const finalReal = guardrails ? new Float64Array(runs) : null;
  const lowestReal = guardrails ? new Float64Array(runs) : null;
  const finalRate = guardrails ? new Float64Array(runs) : null;
  let finalRateCount = 0;
  let totalCuts = 0;
  let totalRaises = 0;
  let totalSkipped = 0;
  let runsWithCut = 0;
  let runsWithRaise = 0;

  for (let r = 0; r < runs; r++) {
    let w = initialWealth;
    let withdrawal = withdrawalRate * initialWealth;
    let lastReturn = 0;
    let deflator = 1; // converts this year's dollars to today's dollars
    let lowest = Infinity;
    let rate = withdrawalRate;
    let cuts = 0;
    let raises = 0;
    let failed = false;

    for (let y = 0; y < years; y++) {
      if (y > 0) {
        deflator /= 1 + inflation;
        if (!guardrails) {
          withdrawal *= 1 + inflation;
        } else {
          rate = w > 0 ? withdrawal / w : Infinity;
          if (lastReturn < 0 && rate > withdrawalRate) totalSkipped++;
          else withdrawal *= 1 + inflation;

          rate = w > 0 ? withdrawal / w : Infinity;
          if (rate > upper && years - y > GK.noCutFinalYears) {
            withdrawal *= 1 - GK.adjustment;
            cuts++;
          } else if (rate < lower) {
            withdrawal *= 1 + GK.adjustment;
            raises++;
          }
          rate = w > 0 ? withdrawal / w : Infinity;
        }
      }

      w -= withdrawal;
      if (w < -eps) {
        w = 0;
        failureYears[failures++] = y + 1;
        failed = true;
        break;
      }
      if (w < 0) w = 0;
      if (guardrails) lowest = Math.min(lowest, withdrawal * deflator);
      let ret = meanReturn + volatility * normal();
      if (ret < -1) ret = -1;
      w *= 1 + ret;
      lastReturn = ret;
    }

    ending[r] = w;
    if (guardrails) {
      finalReal![r] = failed ? 0 : withdrawal * deflator;
      lowestReal![r] = failed ? 0 : lowest;
      if (!failed) finalRate![finalRateCount++] = rate;
      totalCuts += cuts;
      totalRaises += raises;
      if (cuts) runsWithCut++;
      if (raises) runsWithRaise++;
    }
    if (onProgress && (r + 1) % progressEvery === 0) onProgress((r + 1) / runs);
  }

  const nominal = summarize(ending);
  const deflator = 1 / Math.pow(1 + inflation, years);
  const failed = failureYears.subarray(0, failures).sort();
  const successes = runs - failures;

  let gkStats: GuardrailStats | null = null;
  if (guardrails) {
    gkStats = {
      finalWithdrawal: summarize(finalReal!),
      lowestWithdrawal: summarize(lowestReal!),
      finalRate: finalRateCount ? summarize(finalRate!.subarray(0, finalRateCount)) : null,
      avgCuts: totalCuts / runs,
      avgRaises: totalRaises / runs,
      avgSkippedInflation: totalSkipped / runs,
      runsWithCut: runsWithCut / runs,
      runsWithRaise: runsWithRaise / runs,
    };
  }

  return {
    params,
    successes,
    successRate: successes / runs,
    nominal,
    real: scaleSummary(nominal, deflator),
    medianFailureYear: failures ? percentile(failed, 0.5) : null,
    guardrails: gkStats,
    elapsedMs: performance.now() - start,
  };
}
