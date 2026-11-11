import { describe, expect, it } from 'vitest';
import { DEFAULTS, MAX_RUNS, toParams, validate } from '../src/lib/inputs';

describe('inputs', () => {
  it('defaults are valid', () => {
    expect(validate(DEFAULTS)).toEqual({});
  });

  it('flags bad values', () => {
    const e = validate({ ...DEFAULTS, initialWealth: 0, volatilityPct: -1, years: 2.5, runs: null, seed: -3 });
    expect(Object.keys(e).sort()).toEqual(['initialWealth', 'runs', 'seed', 'volatilityPct', 'years']);
  });

  it('requires a target success rate above 0 and up to 100', () => {
    for (const bad of [null, 0, -5, 100.1]) {
      expect(Object.keys(validate({ ...DEFAULTS, targetSuccessPct: bad }))).toEqual(['targetSuccessPct']);
    }
    for (const ok of [0.5, 99.5, 100]) {
      expect(validate({ ...DEFAULTS, targetSuccessPct: ok })).toEqual({});
    }
  });

  it('caps the number of runs', () => {
    expect(validate({ ...DEFAULTS, runs: MAX_RUNS })).toEqual({});
    expect(Object.keys(validate({ ...DEFAULTS, runs: MAX_RUNS + 1 }))).toEqual(['runs']);
  });

  it('converts percents to decimals and keeps an explicit seed', () => {
    const p = toParams({ ...DEFAULTS, seed: 99 });
    expect(p).toEqual({
      initialWealth: 1_000_000,
      meanReturn: 0.07,
      volatility: 0.15,
      inflation: 0.03,
      targetSuccess: 0.9,
      years: 30,
      runs: 10_000,
      seed: 99,
    });
  });

  it('picks a random seed when blank', () => {
    const p = toParams(DEFAULTS);
    expect(Number.isInteger(p.seed)).toBe(true);
  });
});
