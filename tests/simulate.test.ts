import { describe, expect, it } from 'vitest';
import { simulate } from '../src/lib/sim/simulate';
import type { SimParams } from '../src/lib/sim/types';

const base: SimParams = {
  initialWealth: 1_000_000,
  meanReturn: 0,
  volatility: 0,
  inflation: 0,
  withdrawalRate: 0.04,
  years: 25,
  runs: 100,
  seed: 1,
};

describe('simulate (deterministic, sigma = 0)', () => {
  it('exactly exhausting wealth on the last year is a success', () => {
    const r = simulate(base);
    expect(r.successRate).toBe(1);
    expect(r.nominal.max).toBeCloseTo(0, 6);
    expect(r.medianFailureYear).toBeNull();
  });

  it('one year too many fails every run in year 26', () => {
    const r = simulate({ ...base, years: 26 });
    expect(r.successRate).toBe(0);
    expect(r.nominal.max).toBe(0);
    expect(r.medianFailureYear).toBe(26);
  });

  it('no withdrawals compounds wealth at the mean return', () => {
    const r = simulate({ ...base, meanReturn: 0.05, withdrawalRate: 0, years: 10 });
    const expected = 1_000_000 * Math.pow(1.05, 10);
    expect(r.nominal.min).toBeCloseTo(expected, 4);
    expect(r.nominal.max).toBeCloseTo(expected, 4);
  });

  it('withdrawals grow with inflation; real stats are deflated', () => {
    // 10% withdrawals growing 10%/yr: 100k, 110k, 121k -> wealth 669k after 3 years.
    const r = simulate({ ...base, withdrawalRate: 0.1, inflation: 0.1, years: 3 });
    expect(r.nominal.median).toBeCloseTo(1_000_000 - 100_000 - 110_000 - 121_000, 6);
    expect(r.real.median).toBeCloseTo(r.nominal.median / 1.331, 6);
  });
});

describe('simulate (stochastic)', () => {
  const params: SimParams = {
    initialWealth: 1_000_000,
    meanReturn: 0.07,
    volatility: 0.15,
    inflation: 0.03,
    withdrawalRate: 0.04,
    years: 30,
    runs: 20_000,
    seed: 2024,
  };

  it('is reproducible for the same seed', () => {
    const a = simulate(params);
    const b = simulate(params);
    expect(a.successRate).toBe(b.successRate);
    expect(a.nominal).toEqual(b.nominal);
  });

  it('gives a plausible success rate for a 4% withdrawal', () => {
    // ~4% real arithmetic / ~2.9% real geometric return: roughly two-thirds succeed.
    const r = simulate(params);
    expect(r.successRate).toBeGreaterThan(0.55);
    expect(r.successRate).toBeLessThan(0.8);
    expect(r.nominal.min).toBe(0);
    expect(r.nominal.p10).toBeLessThanOrEqual(r.nominal.p25);
    expect(r.nominal.p25).toBeLessThanOrEqual(r.nominal.median);
  });

  it('higher mean return raises the success rate', () => {
    const low = simulate(params);
    const high = simulate({ ...params, meanReturn: 0.1 });
    expect(high.successRate).toBeGreaterThan(low.successRate);
  });

  it('reports progress up to 1', () => {
    let last = 0;
    simulate({ ...params, runs: 1000 }, (f) => (last = f));
    expect(last).toBe(1);
  });
});
