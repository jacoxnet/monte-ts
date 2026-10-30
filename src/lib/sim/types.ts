/**
 * How annual returns are drawn:
 * - normal: Normal(meanReturn, volatility).
 * - lognormal: 1 + return is lognormal, with the same mean and standard deviation.
 * meanReturn is the arithmetic mean and volatility the standard deviation in both.
 */
export type ReturnModel = 'normal' | 'lognormal';

/** Simulation inputs. All rates are decimals (0.07 = 7%). */
export interface SimParams {
  initialWealth: number;
  meanReturn: number;
  volatility: number;
  inflation: number;
  /** First-year withdrawal as a fraction of initial wealth; grows with inflation thereafter. */
  withdrawalRate: number;
  years: number;
  runs: number;
  /** 32-bit unsigned seed for the PRNG. */
  seed: number;
}

export interface Summary {
  mean: number;
  median: number;
  p10: number;
  p25: number;
  min: number;
  max: number;
}

export interface SimResult {
  model: ReturnModel;
  params: SimParams;
  /** Arithmetic mean of annual returns under this model. */
  arithmeticMean: number;
  /** Geometric mean of annual returns; approximate (mean - variance / 2) for the normal model. */
  geometricMean: number;
  successes: number;
  successRate: number;
  /** Ending-wealth statistics in nominal dollars (failed runs count as 0). */
  nominal: Summary;
  /** Same statistics deflated to today's dollars. */
  real: Summary;
  /** Median year in which failed runs ran out of money, or null if none failed. */
  medianFailureYear: number | null;
  elapsedMs: number;
}

/** The same inputs and seed simulated under each return model. */
export type Comparison = Record<ReturnModel, SimResult>;

export type WorkerRequest = { type: 'run'; params: SimParams };

export type WorkerResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; result: Comparison }
  | { type: 'error'; message: string };
