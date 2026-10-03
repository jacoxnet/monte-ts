import { describe, expect, it } from 'vitest';
import { percentile, summarize } from '../src/lib/sim/stats';

describe('percentile', () => {
  it('interpolates linearly between ranks', () => {
    const s = [1, 2, 3, 4, 5];
    expect(percentile(s, 0)).toBe(1);
    expect(percentile(s, 0.5)).toBe(3);
    expect(percentile(s, 1)).toBe(5);
    expect(percentile(s, 0.1)).toBeCloseTo(1.4);
    expect(percentile(s, 0.25)).toBe(2);
    expect(percentile([10, 20], 0.5)).toBe(15);
  });

  it('handles single-element and empty arrays', () => {
    expect(percentile([7], 0.3)).toBe(7);
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe('summarize', () => {
  it('computes stats without mutating input', () => {
    const v = Float64Array.from([5, 1, 4, 2, 3]);
    const s = summarize(v);
    expect(s).toEqual({ mean: 3, median: 3, p10: 1.4, p25: 2, min: 1, max: 5 });
    expect(Array.from(v)).toEqual([5, 1, 4, 2, 3]);
  });
});
