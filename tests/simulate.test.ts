import { describe, expect, it } from 'vitest';
import { GK, simulate } from '../src/lib/sim/simulate';
import type { SimParams } from '../src/lib/sim/types';

const base: SimParams = {
  initialWealth: 1_000_000,
  meanReturn: 0,
  volatility: 0,
  inflation: 0,
  withdrawalStrategy: 'constant',
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
    withdrawalStrategy: 'constant',
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

describe('simulate (guardrails, sigma = 0)', () => {
  const gk: SimParams = { ...base, withdrawalStrategy: 'guardrails', withdrawalRate: GK.initialRate, runs: 10 };

  it('constant strategy produces no guardrail stats', () => {
    expect(simulate(base).guardrails).toBeNull();
  });

  it('raises 10% when the rate drops below the lower guardrail', () => {
    // 10% returns, no inflation: the portfolio grows, so the rate (55k / wealth) keeps falling
    // until it drops below 4.4%, triggering +10% raises.
    const r = simulate({ ...gk, meanReturn: 0.1, years: 10 });
    const g = r.guardrails!;
    expect(r.successRate).toBe(1);
    expect(g.avgCuts).toBe(0);
    expect(g.avgRaises).toBeGreaterThan(0);
    expect(g.runsWithRaise).toBe(1);
    // Each raise is exactly 10%, so the final withdrawal is 55k * 1.1^raises.
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000 * Math.pow(1.1, g.avgRaises), 6);
    expect(g.lowestWithdrawal.median).toBeCloseTo(55_000, 6);
  });

  it('cuts 10% above the upper guardrail, but not in the final 15 years', () => {
    // -10% returns: year 2 rate = 55k / 850.5k = 6.47%; year 3 = 55k / 715.95k = 7.68% -> cut.
    const r = simulate({ ...gk, meanReturn: -0.1, years: 40 });
    const g = r.guardrails!;
    expect(g.avgCuts).toBeGreaterThan(0);
    expect(g.avgRaises).toBe(0);
    expect(g.lowestWithdrawal.max).toBeLessThan(55_000);

    // With only 16 years, cuts are allowed only in year 1 (no rules) -> none.
    const short = simulate({ ...gk, meanReturn: -0.1, years: 16 });
    expect(short.guardrails!.avgCuts).toBe(0);
  });

  it('skips the inflation raise after a losing year when the rate is above the initial rate', () => {
    // -1% returns with 3% inflation: year-2 rate = 55k / 935.55k = 5.88% > 5.5% -> skip.
    const r = simulate({ ...gk, meanReturn: -0.01, inflation: 0.03, years: 2 });
    const g = r.guardrails!;
    expect(g.avgSkippedInflation).toBe(1);
    // Withdrawal stays at 55k nominal, so in today's dollars it is 55k / 1.03.
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000 / 1.03, 6);
    expect(g.finalRate!.median).toBeCloseTo(55_000 / 935_550, 9);
  });

  it('applies inflation raises when returns are positive', () => {
    const r = simulate({ ...gk, meanReturn: 0.03, inflation: 0.03, years: 2 });
    const g = r.guardrails!;
    expect(g.avgSkippedInflation).toBe(0);
    expect(g.finalWithdrawal.median).toBeCloseTo(55_000, 6);
  });
});

describe('simulate (guardrails, stochastic)', () => {
  it('beats a constant 5.5% withdrawal on success rate', () => {
    const p: SimParams = {
      initialWealth: 1_000_000,
      meanReturn: 0.07,
      volatility: 0.15,
      inflation: 0.03,
      withdrawalStrategy: 'constant',
      withdrawalRate: 0.055,
      years: 30,
      runs: 20_000,
      seed: 2024,
    };
    const constant = simulate(p);
    const gk = simulate({ ...p, withdrawalStrategy: 'guardrails' });
    expect(gk.successRate).toBeGreaterThan(constant.successRate);
    expect(gk.guardrails!.runsWithCut).toBeGreaterThan(0);
    expect(gk.guardrails!.runsWithRaise).toBeGreaterThan(0);
  });
});
