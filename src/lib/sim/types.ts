/**
 * - standard: the first-year withdrawal is raised with inflation every year.
 * - guardrails: Guyton-Klinger decision rules adjust the withdrawal each year (see simulate.ts).
 */
export type Strategy = 'standard' | 'guardrails';

/** Simulation inputs. All rates are decimals (0.07 = 7%). */
export interface SimParams {
  initialWealth: number;
  /** Arithmetic mean of the normally distributed annual return. */
  meanReturn: number;
  /** Standard deviation of the annual return. */
  volatility: number;
  inflation: number;
  years: number;
  runs: number;
  /** 32-bit unsigned seed for the PRNG. */
  seed: number;
  /** Success rate the standard strategy must reach. Guardrails always target GK.targetSuccess. */
  targetSuccess: number;
}

export interface Summary {
  mean: number;
  median: number;
  p10: number;
  p25: number;
  min: number;
  max: number;
}

/** Outcome of one strategy at one first-year withdrawal. */
export interface SimResult {
  strategy: Strategy;
  /** First-year withdrawal in dollars. */
  initialWithdrawal: number;
  /** First-year withdrawal as a fraction of initial wealth. */
  initialRate: number;
  successes: number;
  successRate: number;
  /**
   * Each run's withdrawals in today's dollars, averaged over the whole horizon. A run that runs
   * out takes whatever is left that year and $0 afterwards.
   */
  averageWithdrawal: Summary;
  /** Ending-wealth statistics in nominal dollars (failed runs count as 0). */
  nominal: Summary;
  /** Same statistics deflated to today's dollars. */
  real: Summary;
  /** Median year in which failed runs ran out of money, or null if none failed. */
  medianFailureYear: number | null;
  /** Only produced for the guardrails strategy. */
  guardrails: GuardrailStats | null;
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

/** A strategy simulated at the largest first-year withdrawal that meets its target. */
export interface StrategyResult extends SimResult {
  targetSuccess: number;
}

/** Both strategies searched and simulated against the same simulated markets. */
export interface Comparison {
  params: SimParams;
  standard: StrategyResult;
  guardrails: StrategyResult;
  elapsedMs: number;
}

export type WorkerRequest = { type: 'run'; params: SimParams };

export type WorkerResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; result: Comparison }
  | { type: 'error'; message: string };
