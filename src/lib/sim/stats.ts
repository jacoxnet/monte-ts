import type { Summary } from './types';

/**
 * Percentile of an ascending-sorted array using linear interpolation
 * between closest ranks (Excel PERCENTILE.INC / NumPy default). p in [0, 1].
 */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const pos = p * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  const frac = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/** Summary statistics of a sample. Does not modify the input. */
export function summarize(values: Float64Array): Summary {
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) sum += sorted[i];
  return {
    mean: sorted.length ? sum / sorted.length : NaN,
    median: percentile(sorted, 0.5),
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    min: sorted.length ? sorted[0] : NaN,
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
  };
}

export function scaleSummary(s: Summary, factor: number): Summary {
  return {
    mean: s.mean * factor,
    median: s.median * factor,
    p10: s.p10 * factor,
    p25: s.p25 * factor,
    min: s.min * factor,
    max: s.max * factor,
  };
}
