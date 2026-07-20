import type { Difficulty } from '../meta/Economy';
import type { CardDb } from '../engine/types';
import type { AIPlayer } from './AIPlayer';
import { NoisyAI } from './NoisyAI';
import { buildAI, DEFAULT_PERSONALITY, type Personality } from './personality';

export type TowerTier = 1 | 2 | 3 | 4 | 5 | 6;

/*
 * MEASURED LADDER — 2026-07-20, `npx tsx scripts/balance-matrix.ts --tiers
 * --seeds 80` (same-deck starter mirrors vs a neutral Medium proxy; the
 * 40-seed protocol was upgraded to 80 after a 4pp boundary flip-flopped
 * within 40-seed sampling noise):
 *
 *   T1 easy/0.35 18.3% -> T2 easy/0.10 23.6% -> T3 medium/0.32 33.0%
 *   -> T4 medium/0 49.4% -> T5 hard/0.12 62.2% -> T6 hard/0 75.7%
 *
 * Monotonic, every adjacent gap >= 4pp (smallest: T1->T2 +5.3pp). Tuning
 * history (honest): medium 0.20/0.05 INVERTED (43.0/40.1 at 40 seeds);
 * medium responds shallowly to noise below ~0.3 (0.02..0.28 all landed
 * 38-43%) and a heavily noised medium converges on lightly noised easy
 * (0.40 -> 26.0% vs easy/0.10 23.6%), so T3 needs the 0.30-0.35 window.
 * T4 medium/0 and T6 hard/0 are byte-identical to today's Medium/Hard.
 */
export const TIER_DEFS: Readonly<
  Record<TowerTier, { brain: Difficulty; noise: number }>
> = {
  1: { brain: 'easy', noise: 0.35 },
  2: { brain: 'easy', noise: 0.10 },
  3: { brain: 'medium', noise: 0.32 },
  4: { brain: 'medium', noise: 0 },
  5: { brain: 'hard', noise: 0.12 },
  6: { brain: 'hard', noise: 0 },
};

/** Build a tower-only tier without changing the shared difficulty factory. */
export function buildTierAI(
  tier: TowerTier,
  db: CardDb,
  seed: number,
  personality: Personality = DEFAULT_PERSONALITY,
): AIPlayer {
  const def = TIER_DEFS[tier];
  const brain = buildAI(def.brain, db, seed, personality);
  // Decorrelate the noise stream from EasyAI's own rng (both are seeded).
  return def.noise > 0 ? new NoisyAI(brain, (seed ^ 0x51d3ba11) >>> 0, def.noise) : brain;
}

// Provisional until the 16-floor re-baseline.
const FLOOR_TIERS: readonly TowerTier[] = [
  1, 1, 1,
  2, 2, 2,
  3, 3, 3,
  4, 4, 4,
  5, 5, 5,
  6,
];

export function floorTier(floor: number): TowerTier {
  if (floor >= FLOOR_TIERS.length) return 6;
  return FLOOR_TIERS[Math.max(1, Math.trunc(floor)) - 1] ?? 1;
}

/** The base brain used for stats and difficulty-labelled Tower UI. */
export function floorBrain(floor: number): Difficulty {
  return TIER_DEFS[floorTier(floor)].brain;
}

/** One pip per base-brain band; decision noise stays an invisible tier dial. */
export function floorDifficultyPips(floor: number): 1 | 2 | 3 {
  const brain = floorBrain(floor);
  return brain === 'easy' ? 1 : brain === 'medium' ? 2 : 3;
}
