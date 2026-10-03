/** Seedable 32-bit PRNG (mulberry32). Returns uniforms in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal generator using the Box–Muller transform.
 * Each transform yields two independent normals; the second is cached.
 */
export function normalGenerator(uniform: () => number): () => number {
  let spare = 0;
  let hasSpare = false;
  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    let u1 = uniform();
    while (u1 === 0) u1 = uniform(); // avoid log(0)
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = r * Math.sin(theta);
    hasSpare = true;
    return r * Math.cos(theta);
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
