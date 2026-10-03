import { mulberry32, normalGenerator } from './rng';
import { percentile, scaleSummary, summarize } from './stats';
import type { SimParams, SimResult } from './types';

/**
 * Run the Monte Carlo simulation.
 *
 * Each year: take the (inflation-adjusted) withdrawal at the start of the year,
 * then apply a Normal(mean, volatility) return, clamped at -100%.
 * A run fails when wealth cannot cover a scheduled withdrawal; its wealth is then 0.
 */
export function simulate(
  params: SimParams,
  onProgress?: (fraction: number) => void,
): SimResult {
  const start = performance.now();
  const { initialWealth, meanReturn, volatility, inflation, withdrawalRate, years, runs } = params;
  const normal = normalGenerator(mulberry32(params.seed));

  const ending = new Float64Array(runs);
  const failureYears = new Float64Array(runs);
  let failures = 0;
  // Tolerance so a withdrawal that exactly exhausts wealth isn't a failure due to rounding.
  const eps = 1e-9 * initialWealth;
  const progressEvery = Math.max(1, Math.floor(runs / 100));

  for (let r = 0; r < runs; r++) {
    let w = initialWealth;
    let withdrawal = withdrawalRate * initialWealth;

    for (let y = 0; y < years; y++) {
      w -= withdrawal;
      if (w < -eps) {
        w = 0;
        failureYears[failures++] = y + 1;
        break;
      }
      if (w < 0) w = 0;
      let ret = meanReturn + volatility * normal();
      if (ret < -1) ret = -1;
      w *= 1 + ret;
      withdrawal *= 1 + inflation;
    }

    ending[r] = w;
    if (onProgress && (r + 1) % progressEvery === 0) onProgress((r + 1) / runs);
  }

  const nominal = summarize(ending);
  const deflator = 1 / Math.pow(1 + inflation, years);
  const failed = failureYears.subarray(0, failures).sort();
  const successes = runs - failures;

  return {
    params,
    successes,
    successRate: successes / runs,
    nominal,
    real: scaleSummary(nominal, deflator),
    medianFailureYear: failures ? percentile(failed, 0.5) : null,
    elapsedMs: performance.now() - start,
  };
}
