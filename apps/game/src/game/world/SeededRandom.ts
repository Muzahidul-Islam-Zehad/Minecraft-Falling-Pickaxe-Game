/**
 * Deterministic seeded RNG (master spec §10, §112).
 * World generation must never depend on uncontrolled global random state: the same
 * (runSeed, chunkId) pair always produces the same chunk.
 */

/** 32-bit FNV-1a style integer hash used to derive per-chunk seeds. */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    let x = part >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/**
 * mulberry32 — small, fast, deterministic PRNG with a 32-bit seed.
 * Not cryptographic; perfectly sufficient for world generation (§10).
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  intBetween(min: number, max: number): number {
    if (max < min) throw new Error(`intBetween: max ${max} < min ${min}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Convenience: derive a chunk seed from a run seed and chunk index (§10 concept). */
export function deriveChunkSeed(runSeed: number, chunkId: number): number {
  return hashSeed(runSeed, chunkId);
}
