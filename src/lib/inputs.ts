import { randomSeed } from './sim/rng';
import { GK } from './sim/simulate';
import type { SimParams } from './sim/types';

/** Withdrawal choice as shown in the form. */
export type WithdrawalChoice = 'standard' | 'guardrails' | 'custom';

export const STANDARD_RATE = 0.04;

/** Form values as the user enters them: percentages are in percent units. */
export interface FormValues {
  initialWealth: number | null;
  meanReturnPct: number | null;
  volatilityPct: number | null;
  inflationPct: number | null;
  withdrawalChoice: WithdrawalChoice;
  /** Only used when withdrawalChoice is 'custom'. */
  withdrawalRatePct: number | null;
  years: number | null;
  runs: number | null;
  /** Blank means pick a random seed on each run. */
  seed: number | null;
}

export type NumericField = Exclude<keyof FormValues, 'withdrawalChoice'>;
export type FieldErrors = Partial<Record<NumericField, string>>;

export const MAX_RUNS = 1_000_000;
export const MAX_YEARS = 100;

export const DEFAULTS: FormValues = {
  initialWealth: 1_000_000,
  meanReturnPct: 7,
  volatilityPct: 15,
  inflationPct: 3,
  withdrawalChoice: 'standard',
  withdrawalRatePct: 4,
  years: 30,
  runs: 10_000,
  seed: null,
};

const isNum = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v);

export function validate(f: FormValues): FieldErrors {
  const e: FieldErrors = {};
  if (!isNum(f.initialWealth) || f.initialWealth <= 0) e.initialWealth = 'Must be greater than 0';
  if (!isNum(f.meanReturnPct) || f.meanReturnPct <= -100 || f.meanReturnPct > 100)
    e.meanReturnPct = 'Between -100 and 100';
  if (!isNum(f.volatilityPct) || f.volatilityPct < 0 || f.volatilityPct > 100)
    e.volatilityPct = 'Between 0 and 100';
  if (!isNum(f.inflationPct) || f.inflationPct <= -100 || f.inflationPct > 100)
    e.inflationPct = 'Between -100 and 100';
  if (
    f.withdrawalChoice === 'custom' &&
    (!isNum(f.withdrawalRatePct) || f.withdrawalRatePct < 0 || f.withdrawalRatePct > 100)
  )
    e.withdrawalRatePct = 'Between 0 and 100';
  if (!isNum(f.years) || !Number.isInteger(f.years) || f.years < 1 || f.years > MAX_YEARS)
    e.years = `Whole number, 1 to ${MAX_YEARS}`;
  if (!isNum(f.runs) || !Number.isInteger(f.runs) || f.runs < 1 || f.runs > MAX_RUNS)
    e.runs = `Whole number, 1 to ${MAX_RUNS.toLocaleString()}`;
  if (f.seed != null && (!Number.isInteger(f.seed) || f.seed < 0 || f.seed > 0xffffffff))
    e.seed = 'Blank, or a whole number from 0 to 4294967295';
  return e;
}

/** Convert validated form values to simulation parameters. */
export function toParams(f: FormValues): SimParams {
  const withdrawalRate =
    f.withdrawalChoice === 'guardrails'
      ? GK.initialRate
      : f.withdrawalChoice === 'custom'
        ? f.withdrawalRatePct! / 100
        : STANDARD_RATE;
  return {
    initialWealth: f.initialWealth!,
    meanReturn: f.meanReturnPct! / 100,
    volatility: f.volatilityPct! / 100,
    inflation: f.inflationPct! / 100,
    withdrawalStrategy: f.withdrawalChoice === 'guardrails' ? 'guardrails' : 'constant',
    withdrawalRate,
    years: f.years!,
    runs: f.runs!,
    seed: f.seed ?? randomSeed(),
  };
}

const STORAGE_KEY = 'monte-ts:inputs';

export function loadInputs(): FormValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...DEFAULTS, ...JSON.parse(raw) } as FormValues;
      if (!['standard', 'guardrails', 'custom'].includes(saved.withdrawalChoice))
        saved.withdrawalChoice = DEFAULTS.withdrawalChoice;
      return saved;
    }
  } catch {
    // storage unavailable or corrupt; fall back to defaults
  }
  return { ...DEFAULTS };
}

export function saveInputs(f: FormValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}
