/**
 * Seeded Tower (Avatar Gauntlet) runs. A run picks one 31-bit `runSeed` when it
 * begins (chosen in GauntletScene — auto-random, rerollable, or player-entered);
 * every rung's duel then derives a distinct, deterministic seed from it via
 * `rungSeed`. Same `runSeed` ⇒ an identical run (reproducible / shareable);
 * a different `runSeed` ⇒ a different playthrough. Kept pure + headless (no
 * Phaser, no `Math.random`, no browser APIs) so the derivation is deterministic
 * and unit-testable — the randomness that starts a run lives in the UI layer.
 */

import { createRngState, rngShuffle } from '../engine/rng';

/** Largest run/duel seed + 1 — the 31-bit domain used by the practice seed too. */
const SEED_MOD = 0x80000000; // 2**31

/** Coerce any number to a valid seed: a 31-bit non-negative integer, never 0. */
export function clampSeed(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const v = Math.abs(Math.trunc(n)) % SEED_MOD; // [0, 2**31)
  return v === 0 ? 1 : v;
}

/**
 * The duel seed for a given rung of a run. A splitmix32-style avalanche of
 * (runSeed, rung) so adjacent rungs share no visible structure and each rung is
 * well distributed. Returns a 31-bit non-negative integer, matching the domain
 * of the practice-mode seed (`Math.random() * 2**31`) that feeds `Game`.
 */
export function rungSeed(runSeed: number, rung: number): number {
  let h = (clampSeed(runSeed) ^ Math.imul(rung | 0, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h % SEED_MOD; // 31-bit, matches DuelScene's practice-seed range
}

/** Derive the deterministic daily roster seed from a local YYYYMMDD key. */
export function daySeed(dateKey: number): number {
  let h = clampSeed(dateKey) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return clampSeed(h);
}

/** Convert a caller-supplied timestamp to its local-calendar YYYYMMDD key. */
export function localDateKey(ts: number): number {
  const date = new Date(ts);
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Full seeded Fisher-Yates permutation of roster indices. */
export function rosterOrder(seed: number, count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  return rngShuffle(createRngState(seed), order);
}
