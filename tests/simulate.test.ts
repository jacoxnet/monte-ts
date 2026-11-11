import { describe, expect, it } from 'vitest';
import { compare, drawGrowth, GK, maxWithdrawal, simulate } from '../src/lib/sim/simulate';
import type { SimParams, Strategy } from '../src/lib/sim/types';

/** No returns, no inflation: $1M funds exactly 25 withdrawals of $40k. */
const flat: SimParams = {
  initialWealth: 1_000_000,
  meanReturn: 0,
  volatility: 0,
  inflation: 0,
  years: 25,
  runs: 10,
  seed: 1,
  targetSuccess: 0.9,
};

const market: SimParams = {
  initialWealth: 1_000_000,
  meanReturn: 0.07,
  volatility: 0.15,
  inflation: 0.03,
  years: 30,
  runs: 20_000,
  seed: 2024,
  targetSuccess: 0.9,
};

const run = (params: SimParams, strategy: Strategy, withdrawal: number) =>
  simulate(params, drawGrowth(params), strategy, withdrawal);

const search = (params: SimParams, strategy: Strategy, target: number) =>
  maxWithdrawal(params, drawGrowth(params), strategy, target);

/** The search's resolution: one bisection step short of the next withdrawal it would try. */
const step = (params: SimParams) => params.initialWealth / 2 ** 20;

describe('drawGrowth', () => {
  it('draws runs x years growth factors, reproducibly', () => {
    const a = drawGrowth({ ...market, runs: 100 });
    expect(a.length).toBe(100 * 30);
    expect(Array.from(a)).toEqual(Array.from(drawGrowth({ ...market, runs: 100 })));
    expect(Array.from(a)).not.toEqual(Array.from(drawGrowth({ ...market, runs: 100, seed: 2025 })));
  });

  it('matches the mean and volatility of returns', () => {
    const g = drawGrowth({ ...market, runs: 10_000 });
    const mean = g.reduce((s, x) => s + x, 0) / g.length;
    const variance = g.reduce((s, x) => s + (x - mean) ** 2, 0) / g.length;
    expect(mean - 1).toBeCloseTo(0.07, 2);
    expect(Math.sqrt(variance)).toBeCloseTo(0.15, 2);
  });

  it('clamps returns at -100%', () => {
    const g = drawGrowth({ ...market, meanReturn: -0.9, volatility: 1, runs: 100 });
    expect(Math.min(...g)).toBe(0);
  });
});

describe('simulate (standard, sigma = 0)', () => {
  it('exactly exhausting wealth on the last year is a success', () => {
    const r = run(flat, 'standard', 40_000);
    expect(r.successRate).toBe(1);
    expect(r.initialRate).toBeCloseTo(0.04, 12);
    expect(r.nominal.max).toBeCloseTo(0, 6);
    expect(r.medianFailureYear).toBeNull();
    expect(r.guardrails).toBeNull();
  });

  it('one year too many fails every run in year 26', () => {
    const r = run({ ...flat, years: 26 }, 'standard', 40_000);
    expect(r.successRate).toBe(0);
    expect(r.nominal.max).toBe(0);
    expect(r.medianFailureYear).toBe(26);
    // 25 full withdrawals and nothing left for the 26th.
    expect(r.averageWithdrawal.median).toBeCloseTo(1_000_000 / 26, 6);
  });

  it('a failed run withdraws what is left', () => {
    // 300k, 300k, 300k, then only 100k remains for year 4.
    const r = run({ ...flat, years: 4 }, 'standard', 300_000);
    expect(r.successRate).toBe(0);
    expect(r.medianFailureYear).toBe(4);
    expect(r.averageWithdrawal.median).toBeCloseTo(250_000, 6);
  });

  it('no withdrawals compounds wealth at the mean return', () => {
    const r = run({ ...flat, meanReturn: 0.05, years: 10 }, 'standard', 0);
    const expected = 1_000_000 * Math.pow(1.05, 10);
    expect(r.nominal.min).toBeCloseTo(expected, 4);
    expect(r.nominal.max).toBeCloseTo(expected, 4);
  });

  it('withdrawals grow with inflation; real stats are deflated', () => {
    // 100k growing 10%/yr: 100k, 110k, 121k -> wealth 669k after 3 years.
    const r = run({ ...flat, inflation: 0.1, years: 3 }, 'standard', 100_000);
    expect(r.nominal.median).toBeCloseTo(1_000_000 - 100_000 - 110_000 - 121_000, 6);
    expect(r.real.median).toBeCloseTo(r.nominal.median / 1.331, 6);
    expect(r.averageWithdrawal.median).toBeCloseTo(100_000, 6);
  });
});

describe('simulate (guardrails, sigma = 0)', () => {
  it('raises 10% when the rate drops below the lower guardrail', () => {
    // 10% returns, no inflation: the portfolio grows, so the rate (55k / wealth) keeps falling
    // until it drops below 4.4%, triggering +10% raises.
    const r = run({ ...flat, meanReturn: 0.1, years: 10 }, 'guardrails', 55_000);
    const g = r.guardrails!;
    expect(r.successRate).toBe(1);
    expect(g.avgCuts).toBe(0);
    expect(g.avgRaises).toBeGreaterThan(0);
    expect(g.runsWithRaise).toBe(1);
    // Each raise is exactly 10%, so the final withdrawal is 55k * 1.1^raises.
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000 * Math.pow(1.1, g.avgRaises), 6);
    expect(g.lowestWithdrawal.median).toBeCloseTo(55_000, 6);
    expect(r.averageWithdrawal.median).toBeGreaterThan(55_000);
  });

  it('cuts 10% above the upper guardrail, but not in the final 15 years', () => {
    // -10% returns: year 2 rate = 55k / 850.5k = 6.47%; year 3 = 55k / 715.95k = 7.68% -> cut.
    const r = run({ ...flat, meanReturn: -0.1, years: 40 }, 'guardrails', 55_000);
    const g = r.guardrails!;
    expect(g.avgCuts).toBeGreaterThan(0);
    expect(g.avgRaises).toBe(0);
    expect(g.runsWithCut).toBe(1);

    // With only 16 years, cuts are allowed only in year 1 (no rules) -> none.
    const short = run({ ...flat, meanReturn: -0.1, years: 16 }, 'guardrails', 55_000);
    expect(short.guardrails!.avgCuts).toBe(0);
  });

  it('scales the guardrails with the initial rate', () => {
    // 4% initial rate: cut above 4.8%. Year 2 rate = 40k / 864k = 4.63%; year 3 = 40k / 741.6k = 5.39% -> cut.
    const r = run({ ...flat, meanReturn: -0.1, years: 18 }, 'guardrails', 40_000);
    expect(r.guardrails!.avgCuts).toBe(1);
  });

  it('skips the inflation raise after a losing year when the rate is above the initial rate', () => {
    // -1% returns with 3% inflation: year-2 rate = 55k / 935.55k = 5.88% > 5.5% -> skip.
    const r = run({ ...flat, meanReturn: -0.01, inflation: 0.03, years: 2 }, 'guardrails', 55_000);
    const g = r.guardrails!;
    expect(g.avgSkippedInflation).toBe(1);
    // Withdrawal stays at 55k nominal, so in today's dollars it is 55k / 1.03.
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000 / 1.03, 6);
    expect(g.finalRate!.median).toBeCloseTo(55_000 / 935_550, 9);
  });

  it('applies inflation raises when returns are positive', () => {
    const r = run({ ...flat, meanReturn: 0.03, inflation: 0.03, years: 2 }, 'guardrails', 55_000);
    const g = r.guardrails!;
    expect(g.avgSkippedInflation).toBe(0);
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000, 6);
  });
});

describe('simulate (stochastic)', () => {
  it('gives a plausible success rate for a 4% withdrawal', () => {
    // ~4% real arithmetic / ~2.9% real geometric return: roughly two-thirds succeed.
    const r = run(market, 'standard', 40_000);
    expect(r.successRate).toBeGreaterThan(0.55);
    expect(r.successRate).toBeLessThan(0.8);
    expect(r.nominal.min).toBe(0);
    expect(r.nominal.p10).toBeLessThanOrEqual(r.nominal.p25);
    expect(r.nominal.p25).toBeLessThanOrEqual(r.nominal.median);
  });

  it('a larger standard withdrawal never succeeds more often in the same markets', () => {
    const growth = drawGrowth(market);
    const rates = [20_000, 30_000, 40_000, 50_000, 60_000].map(
      (w) => simulate(market, growth, 'standard', w).successRate,
    );
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(rates[0]).toBeGreaterThan(rates[4]);
  });

  it('guardrails beat a standard withdrawal of the same size on success rate', () => {
    const growth = drawGrowth(market);
    const standard = simulate(market, growth, 'standard', 55_000);
    const gk = simulate(market, growth, 'guardrails', 55_000);
    expect(gk.successRate).toBeGreaterThan(standard.successRate);
    expect(gk.guardrails!.runsWithCut).toBeGreaterThan(0);
    expect(gk.guardrails!.runsWithRaise).toBeGreaterThan(0);
  });
});

describe('maxWithdrawal', () => {
  it('finds the exact answer when returns are certain', () => {
    expect(search(flat, 'standard', 0.9)).toBeCloseTo(40_000, 0);
    // With 5% returns the answer is the payment of a 25-year annuity-due.
    const annuity = (1_000_000 * (0.05 / 1.05)) / (1 - Math.pow(1.05, -25));
    expect(Math.abs(search({ ...flat, meanReturn: 0.05 }, 'standard', 0.9) - annuity)).toBeLessThan(1);
  });

  it('allows withdrawing everything over a 1-year horizon', () => {
    expect(search({ ...market, years: 1 }, 'standard', 0.9)).toBe(1_000_000);
    expect(search({ ...market, years: 1 }, 'guardrails', 0.99)).toBe(1_000_000);
  });

  it.each<[Strategy, number]>([
    ['standard', 0.9],
    ['guardrails', 0.99],
  ])('%s: meets the target, and the next step up does not', (strategy, target) => {
    const growth = drawGrowth(market);
    const w = maxWithdrawal(market, growth, strategy, target);
    expect(w).toBeGreaterThan(0);
    expect(simulate(market, growth, strategy, w).successRate).toBeGreaterThanOrEqual(target);
    expect(simulate(market, growth, strategy, w + step(market)).successRate).toBeLessThan(target);
  });

  it('a stricter target lowers the withdrawal', () => {
    const growth = drawGrowth(market);
    const at = (target: number) => maxWithdrawal(market, growth, 'standard', target);
    expect(at(0.99)).toBeLessThan(at(0.9));
    expect(at(0.9)).toBeLessThan(at(0.5));
    expect(simulate(market, growth, 'standard', at(1)).successRate).toBe(1);
  });

  it('guardrails support a larger first withdrawal than standard at the same target', () => {
    const growth = drawGrowth(market);
    const standard = maxWithdrawal(market, growth, 'standard', 0.99);
    const gk = maxWithdrawal(market, growth, 'guardrails', 0.99);
    expect(gk).toBeGreaterThan(standard);
  });

  it('reports monotonic progress up to 1', () => {
    const seen: number[] = [];
    maxWithdrawal(market, drawGrowth(market), 'standard', 0.9, (f) => seen.push(f));
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe('compare', () => {
  const params: SimParams = { ...market, runs: 5_000, seed: 11, targetSuccess: 0.85 };

  it('searches standard at the requested target and guardrails at 99%', () => {
    const c = compare(params);
    const growth = drawGrowth(params);
    expect(c.params).toEqual(params);
    expect(c.standard.strategy).toBe('standard');
    expect(c.standard.targetSuccess).toBe(0.85);
    expect(c.standard.initialWithdrawal).toBe(maxWithdrawal(params, growth, 'standard', 0.85));
    expect(c.standard.successRate).toBeGreaterThanOrEqual(0.85);
    expect(c.standard.guardrails).toBeNull();

    expect(c.guardrails.strategy).toBe('guardrails');
    expect(c.guardrails.targetSuccess).toBe(GK.targetSuccess);
    expect(c.guardrails.initialWithdrawal).toBe(maxWithdrawal(params, growth, 'guardrails', 0.99));
    expect(c.guardrails.successRate).toBeGreaterThanOrEqual(0.99);
    expect(c.guardrails.guardrails).not.toBeNull();
  });

  it('is reproducible for the same seed', () => {
    const a = compare(params);
    const b = compare(params);
    expect(a.standard.initialWithdrawal).toBe(b.standard.initialWithdrawal);
    expect(a.guardrails.initialWithdrawal).toBe(b.guardrails.initialWithdrawal);
    expect(a.guardrails.nominal).toEqual(b.guardrails.nominal);
  });

  it('reports monotonic progress up to 1', () => {
    const seen: number[] = [];
    compare({ ...params, runs: 1000 }, (f) => seen.push(f));
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
