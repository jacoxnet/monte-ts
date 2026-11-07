/**
 * How annual returns are drawn:
 * - normal: Normal(meanReturn, volatility).
 * - lognormal: 1 + return is lognormal, with the same mean and standard deviation.
 * meanReturn is the arithmetic mean and volatility the standard deviation in both.
 */
export type ReturnModel = 'normal' | 'lognormal';

/**
 * - constant: first-year withdrawal = rate x initial wealth, raised with inflation every year.
 * - guardrails: Guyton-Klinger decision rules applied on top of inflation raises (see simulate.ts).
 */
export type WithdrawalStrategy = 'constant' | 'guardrails';

/** Simulation inputs. All rates are decimals (0.07 = 7%). */
export interface SimParams {
  initialWealth: number;
  meanReturn: number;
  volatility: number;
  inflation: number;
  withdrawalStrategy: WithdrawalStrategy;
  /** First-year withdrawal as a fraction of initial wealth. */
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
  /** Withdrawal statistics; only produced for the guardrails strategy. */
  guardrails: GuardrailStats | null;
  elapsedMs: number;
}

/**
 * What the Guyton-Klinger rules did to withdrawals. Dollar figures are in today's dollars;
 * failed runs count as $0 for the final and lowest withdrawals (like ending wealth).
 */
export interface GuardrailStats {
  /** Withdrawal taken in the last year of the horizon. */
  finalWithdrawal: Summary;
  /** Smallest withdrawal taken in any year of each run. */
  lowestWithdrawal: Summary;
  /** Final-year withdrawal divided by that year's starting portfolio (successful runs only). */
  finalRate: Summary | null;
  /** Average number of 10% cuts / 10% raises / skipped inflation raises per run. */
  avgCuts: number;
  avgRaises: number;
  avgSkippedInflation: number;
  /** Share of runs with at least one cut / at least one raise. */
  runsWithCut: number;
  runsWithRaise: number;
}

/** The same inputs and seed simulated under each return model. */
export type Comparison = Record<ReturnModel, SimResult>;

export type WorkerRequest = { type: 'run'; params: SimParams };

export type WorkerResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; result: Comparison }
  | { type: 'error'; message: string };
