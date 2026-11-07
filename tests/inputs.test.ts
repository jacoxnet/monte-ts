import { describe, expect, it } from 'vitest';
import { DEFAULTS, toParams, validate } from '../src/lib/inputs';

describe('inputs', () => {
  it('defaults are valid', () => {
    expect(validate(DEFAULTS)).toEqual({});
  });

  it('flags bad values', () => {
    const e = validate({ ...DEFAULTS, initialWealth: 0, volatilityPct: -1, years: 2.5, runs: null, seed: -3 });
    expect(Object.keys(e).sort()).toEqual(['initialWealth', 'runs', 'seed', 'volatilityPct', 'years']);
  });

  it('converts percents to decimals and keeps an explicit seed', () => {
    const p = toParams({ ...DEFAULTS, seed: 99 });
    expect(p).toMatchObject({ meanReturn: 0.07, volatility: 0.15, inflation: 0.03, withdrawalRate: 0.04, seed: 99 });
  });

  it('maps withdrawal choices to strategy and rate', () => {
    expect(toParams({ ...DEFAULTS, withdrawalChoice: 'standard', withdrawalRatePct: 7 })).toMatchObject({
      withdrawalStrategy: 'constant',
      withdrawalRate: 0.04,
    });
    expect(toParams({ ...DEFAULTS, withdrawalChoice: 'guardrails' })).toMatchObject({
      withdrawalStrategy: 'guardrails',
      withdrawalRate: 0.055,
    });
    expect(toParams({ ...DEFAULTS, withdrawalChoice: 'custom', withdrawalRatePct: 4.5 })).toMatchObject({
      withdrawalStrategy: 'constant',
      withdrawalRate: 0.045,
    });
  });

  it('only validates the custom rate when custom is chosen', () => {
    expect(validate({ ...DEFAULTS, withdrawalChoice: 'standard', withdrawalRatePct: null })).toEqual({});
    expect(Object.keys(validate({ ...DEFAULTS, withdrawalChoice: 'custom', withdrawalRatePct: null }))).toEqual([
      'withdrawalRatePct',
    ]);
  });

  it('picks a random seed when blank', () => {
    const p = toParams(DEFAULTS);
    expect(Number.isInteger(p.seed)).toBe(true);
  });
});
