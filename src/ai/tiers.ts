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
 *   T1 easy/0.35 18.0% -> T2 easy/0.10 23.4% -> T3 medium/0.32 31.3%
 *   -> T4 medium/0 48.2% -> T5 hard/0.12 60.3% -> T6 hard/0 75.9%
 *   (re-measured 2026-07-20 after the prefab tuning pass touched the
 *   Wild Communion reference starter; pre-tune ladder was
 *   18.3/23.6/33.0/49.4/62.2/75.7 - every plateau within noise.)
 *
 * Monotonic, every adjacent gap >= 4pp (smallest: T1->T2 +5.4pp). Tuning
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

// Floors 17-18 = tier 6, confirmed by the 2026-07-24 18-floor re-baseline
// (--floors --seeds 80: F16 75.7 / F17 73.1 / F18 72.5, clean T6 plateau;
// the --tiers ladder re-measured byte-identical to the 2026-07-20 baseline).
// Floors 19-20 = tier 6 CONFIRMED by the 2026-07-31 W7 end-of-set
// re-baseline (--floors --seeds 80 on the post-balance-pass field: F16
// 68.5 / F17 70.8 / F18 72.0 / F19 68.2 / F20 70.6, FLAGS none — a clean
// T6 plateau); the fallback below keeps tier 6 for later floors.
//
// RE-CONFIRMED RESERVE-NATIVE 2026-08-10, the day classic retired
// (--floors --seeds 80, 8,000 games: T6 F16-20 72.0 / 75.8 / 74.5 / 73.8 /
// 71.0, FLAGS none). This map is UNCHANGED by the format switch: every tier
// plateau moved under 3.5pp (T1 -2.9, T2 -3.2, T3 +0.0, T4 +2.8, T5 -1.1,
// T6 +3.4) and the ladder stayed monotonic with every gap >= 4pp. The
// owner's standing pre-authorization for a downward floor re-centre was
// deliberately NOT spent: the measurement says there is nothing to re-centre.
// The full dated table lives beside FLOOR_BANDS in scripts/balance-matrix.ts.
const FLOOR_TIERS: readonly TowerTier[] = [
  1, 1, 1,
  2, 2, 2,
  3, 3, 3,
  4, 4, 4,
  5, 5, 5,
  6, 6, 6,
  6, 6,
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
