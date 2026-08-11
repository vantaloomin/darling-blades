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
 *
 * ---------------------------------------------------------------------------
 * STALE ON THE RESERVE FIELD - re-measured 2026-08-10, reserve-native
 * `--tiers --seeds 80` (the harness itself was still classic until that date):
 *
 *   T1 14.0 -> T2 26.5 -> T3 26.3 -> T4 49.5 -> T5 64.3 -> T6 77.8
 *
 * **MONOTONICITY FAILS: T3 (26.3) is 0.2pp BELOW T2 (26.5).** The tower ships
 * six dials but plays as five: floors 4-9 are one difficulty. This was not
 * caught by CI because tests/ai/tiers.test.ts exercises
 * `tierMonotonicityFlags` on synthetic rows only, never on a real matrix run.
 *
 * CAUSE: the medium noise SHELF above is a classic artifact. Warchest
 * guarantees a land drop every turn, so noise no longer spends itself on mana
 * decisions that were already forced, and every noised choice is now a real
 * play decision. Reserve-native, medium noise is steep and MONOTONIC
 * (`--tier-probe --seeds 80`, same run):
 *
 *   medium/0.10 47.8 · medium/0.15 37.5 · medium/0.20 32.8 · medium/0.32 26.3
 *
 * That is roughly -1.5pp per 0.01 noise, so a tier can now be placed at will -
 * the opposite of the classic shelf, where it could not be placed at all.
 *
 * PROPOSED, NOT APPLIED (needs owner sign-off: it moves floors 7-9 UP, while
 * the standing pre-authorization is for a downward re-centre):
 * **T3 medium/0.32 -> medium/0.15**, already measured at 37.5%, which fixes
 * the collapse and the T3->T4 cliff with one value:
 *
 *   T1 14.0 -> T2 26.5 -> T3 37.5 -> T4 49.5 -> T5 64.3 -> T6 77.8
 *   gaps +12.5 / +11.0 / +12.0 / +14.8 / +13.5 (spread of only 3.8pp)
 *
 * No seventh tier is needed; the cliff and the collapse were the same defect,
 * a mis-placed T3. Applying it requires re-running `--floors --seeds 80` and
 * re-deriving the floors 7-9 band, which today reads maxAvg 0.45.
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

/**
 * Build an AI from a raw (brain, noise) dial. Exported so the balance harness
 * can price CANDIDATE dials that are not shipped tiers (`--tier-probe`)
 * without anyone having to temporarily edit `TIER_DEFS` to measure one.
 */
export function buildDialAI(
  brain: Difficulty,
  noise: number,
  db: CardDb,
  seed: number,
  personality: Personality = DEFAULT_PERSONALITY,
): AIPlayer {
  const ai = buildAI(brain, db, seed, personality);
  // Decorrelate the noise stream from EasyAI's own rng (both are seeded).
  return noise > 0 ? new NoisyAI(ai, (seed ^ 0x51d3ba11) >>> 0, noise) : ai;
}

/** Build a tower-only tier without changing the shared difficulty factory. */
export function buildTierAI(
  tier: TowerTier,
  db: CardDb,
  seed: number,
  personality: Personality = DEFAULT_PERSONALITY,
): AIPlayer {
  const def = TIER_DEFS[tier];
  return buildDialAI(def.brain, def.noise, db, seed, personality);
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
