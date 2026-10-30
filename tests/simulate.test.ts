import { describe, expect, it } from 'vitest';
import { compare, lognormalParams, simulate } from '../src/lib/sim/simulate';
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

describe('lognormal model', () => {
  const params: SimParams = {
    initialWealth: 1_000_000,
    meanReturn: 0.07,
    volatility: 0.15,
    inflation: 0.03,
    withdrawalRate: 0,
    years: 1,
    runs: 200_000,
    seed: 7,
  };

  it('compounds at the mean return when sigma = 0', () => {
    const r = simulate({ ...base, meanReturn: 0.05, withdrawalRate: 0, years: 10 }, undefined, 'lognormal');
    expect(r.nominal.min).toBeCloseTo(1_000_000 * Math.pow(1.05, 10), 4);
    expect(r.geometricMean).toBeCloseTo(0.05, 12);
  });

  it('matches the arithmetic mean and volatility, and derives the geometric mean', () => {
    const { mu, sigma, geometricMean } = lognormalParams(0.07, 0.15);
    const mean = Math.exp(mu + sigma ** 2 / 2);
    const stdev = mean * Math.sqrt(Math.exp(sigma ** 2) - 1);
    expect(mean).toBeCloseTo(1.07, 12);
    expect(stdev).toBeCloseTo(0.15, 12);
    expect(geometricMean).toBeCloseTo(0.0596, 3);

    const r = simulate(params, undefined, 'lognormal');
    expect(r.nominal.median / 1_000_000).toBeCloseTo(1 + geometricMean, 2);
    expect(r.nominal.mean / 1_000_000).toBeCloseTo(1.07, 2);
  });

  it('never loses more than everything', () => {
    const r = simulate({ ...params, volatility: 1 }, undefined, 'lognormal');
    expect(r.nominal.min).toBeGreaterThan(0);
  });
});

describe('compare', () => {
  const params: SimParams = {
    initialWealth: 1_000_000,
    meanReturn: 0.07,
    volatility: 0.15,
    inflation: 0.03,
    withdrawalRate: 0.04,
    years: 30,
    runs: 5_000,
    seed: 11,
  };

  it('leaves the normal model unchanged', () => {
    const c = compare(params);
    const alone = simulate(params);
    expect(c.normal.successRate).toBe(alone.successRate);
    expect(c.normal.nominal).toEqual(alone.nominal);
  });

  it('labels each model and reports its means', () => {
    const { normal, lognormal } = compare(params);
    expect(normal.model).toBe('normal');
    expect(normal.arithmeticMean).toBe(0.07);
    expect(normal.geometricMean).toBeCloseTo(0.05875, 10);
    expect(lognormal.model).toBe('lognormal');
    expect(lognormal.arithmeticMean).toBe(0.07);
    expect(lognormal.geometricMean).toBeCloseTo(0.0596, 3);
  });

  it('gives similar success rates when only the distribution shape differs', () => {
    const { normal, lognormal } = compare({ ...params, runs: 100_000 });
    expect(Math.abs(lognormal.successRate - normal.successRate)).toBeLessThan(0.02);
  });

  it('reports monotonic progress up to 1', () => {
    const seen: number[] = [];
    compare({ ...params, runs: 1000 }, (f) => seen.push(f));
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
