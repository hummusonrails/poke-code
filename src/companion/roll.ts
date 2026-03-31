import type { CompanionBones } from "./types.js";
import { EYES, SPECIES } from "./types.js";

const SALT = "poke-companion-2026";

/** Mulberry32 seeded PRNG — returns a function that yields [0, 1) floats. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash — returns a uint32 from an arbitrary string. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick a random element from an array using the seeded RNG. */
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Cache keyed by userId so we never re-roll during a process lifetime. */
const cache = new Map<string, { bones: CompanionBones; inspirationSeed: number }>();

/**
 * Deterministically roll companion bones from a userId.
 * The result is cached per-process — same userId always yields same bones.
 */
export function roll(userId: string): { bones: CompanionBones; inspirationSeed: number } {
  const cached = cache.get(userId);
  if (cached) return cached;

  const result = rollWithSeed(hashString(`${SALT}:${userId}`));
  cache.set(userId, result);
  return result;
}

/**
 * Uncached variant — roll bones from a raw numeric seed.
 * Useful for previews or testing without polluting the cache.
 */
export function rollWithSeed(seed: number): { bones: CompanionBones; inspirationSeed: number } {
  const rng = mulberry32(seed);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const inspirationSeed = (rng() * 0xffffffff) >>> 0;
  return { bones: { species, eye }, inspirationSeed };
}
