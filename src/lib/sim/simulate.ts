import { mulberry32, normalGenerator } from './rng';
import { percentile, scaleSummary, summarize } from './stats';
import type { Comparison, ReturnModel, SimParams, SimResult } from './types';

/**
 * Lognormal parameters for 1 + return that match the arithmetic mean and standard
 * deviation of the return. With A = 1 + arithmeticMean and x = exp(sigma^2), the
 * lognormal moments give x = 1 + (volatility / A)^2 and exp(mu) = A / sqrt(x),
 * which is 1 + the geometric mean.
 */
export function lognormalParams(arithmeticMean: number, volatility: number) {
  const a = 1 + arithmeticMean;
  const ratio = volatility / a;
  const x = 1 + ratio * ratio;
  const median = a / Math.sqrt(x);
  return { mu: Math.log(median), sigma: Math.sqrt(Math.log(x)), geometricMean: median - 1 };
}

/**
 * Run the Monte Carlo simulation.
 *
 * Each year: take the (inflation-adjusted) withdrawal at the start of the year,
 * then apply a return drawn from the chosen model. Normal returns are clamped at -100%.
 * A run fails when wealth cannot cover a scheduled withdrawal; its wealth is then 0.
 */
export function simulate(
  params: SimParams,
  onProgress?: (fraction: number) => void,
  model: ReturnModel = 'normal',
): SimResult {
  const start = performance.now();
  const { initialWealth, meanReturn, volatility, inflation, withdrawalRate, years, runs } = params;
  const normal = normalGenerator(mulberry32(params.seed));
  const { mu, sigma, geometricMean } = lognormalParams(meanReturn, volatility);
  const lognormal = model === 'lognormal';

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
      let ret = lognormal
        ? Math.exp(mu + sigma * normal()) - 1
        : meanReturn + volatility * normal();
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
    model,
    params,
    arithmeticMean: meanReturn,
    geometricMean: lognormal ? geometricMean : meanReturn - (volatility * volatility) / 2,
    successes,
    successRate: successes / runs,
    nominal,
    real: scaleSummary(nominal, deflator),
    medianFailureYear: failures ? percentile(failed, 0.5) : null,
    elapsedMs: performance.now() - start,
  };
}

/** Simulate both return models with the same inputs and seed. */
export function compare(
  params: SimParams,
  onProgress?: (fraction: number) => void,
): Comparison {
  return {
    normal: simulate(params, onProgress && ((f) => onProgress(f / 2)), 'normal'),
    lognormal: simulate(params, onProgress && ((f) => onProgress(0.5 + f / 2)), 'lognormal'),
  };
}
