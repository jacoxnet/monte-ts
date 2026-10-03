import { describe, expect, it } from 'vitest';
import { mulberry32, normalGenerator } from '../src/lib/sim/rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('differs across seeds and stays in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b()) same++;
    }
    expect(same).toBe(0);
  });
});

describe('normalGenerator', () => {
  it('produces mean ~0 and sd ~1', () => {
    const normal = normalGenerator(mulberry32(123));
    const n = 1_000_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const z = normal();
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.005);
    expect(Math.abs(sd - 1)).toBeLessThan(0.005);
  });
});
