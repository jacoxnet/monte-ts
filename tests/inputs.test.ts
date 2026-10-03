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

  it('picks a random seed when blank', () => {
    const p = toParams(DEFAULTS);
    expect(Number.isInteger(p.seed)).toBe(true);
  });
});
