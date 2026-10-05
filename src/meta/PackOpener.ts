import { ECONOMY } from '../config/rules';
import { rngInt, type RngState } from '../engine/rng';
import type { CardDb, CardDef, Rarity } from '../engine/types';
import { isType } from '../engine/types';
import { addCard, ownedCount, PLAYSET, type AddResult } from './Collection';
import type { SaveData } from './SaveManager';
import { rollFrame, rollFullArt, rollHolo, rollTier, TIER_RANK, variantRank } from './variants';
import { isUtilityTapland } from './warchest';
import { isLiveCollectible } from '../data/liveness';

/** Cards that can appear in boosters: no basics, no tokens. */
export function packPool(db: CardDb, tier: Rarity, set?: CardDef['set']): string[] {
  return Object.values(db)
    .filter(
      (d) =>
        d.rarity === tier &&
        isLiveCollectible(d) &&
        !d.token &&
        !d.supertypes?.includes('basic') &&
        !isUtilityTapland(d) &&
        // Undefined remains the mixed-set pool for Limited/economy callers.
        // Shop SKUs pass an explicit set, including 'base', so the Base Set
        // booster does not silently widen back to the whole catalog.
        (set === undefined || (d.set ?? 'base') === set) &&
        (d.cost !== undefined || isType(d, 'land')), // duals allowed, basics excluded above
    )
    .map((d) => d.id)
    .sort();
}

/**
 * Booster dupe protection. sr/ssr/ur slots roll only cards owned below a
 * playset while any exist; c/r slots roll only unowned cards while any exist
 * (missing cards first, owner ruling 2026-10-05, measured +20% day-60 uniques
 * at the 1,648-card pool). Filtering never consumes rng, so it moves no other
 * roll. The economy model replays the same rule.
 */
export function dupeProtectedPool(tier: Rarity, pool: string[], owned: (cardId: string) => number): string[] {
  const limit = tier === 'c' || tier === 'r' ? 1 : PLAYSET;
  const wanted = pool.filter((id) => owned(id) < limit);
  return wanted.length > 0 ? wanted : pool;
}

/** If a tier's booster pool is empty, the slot falls back one tier down. */
const TIER_FALLBACK: Record<Rarity, Rarity | null> = {
  ur: 'ssr',
  ssr: 'sr',
  sr: 'r',
  r: 'c',
  c: null,
};

export interface PackResult {
  /** Reveal order: worst → best (tier rank ascending, then variant rank). */
  cards: AddResult[];
}

/**
 * Roll one booster: `ECONOMY.boosterPackSize` independent slots, each rolling tier →
 * card → frame → holo (in that rng order — determinism depends on it). Every
 * slot is dupe-protected (see `dupeProtectedPool`). An empty tier pool falls back
 * one tier down (a tiny card set never crashes a pack). Collection updates
 * and plain-dupe→gold conversion happen here, via `addCard`. The result is
 * plain JSON-serializable data, sorted worst→best for the reveal.
 */
export function openPack(save: SaveData, db: CardDb, rng: RngState, set?: CardDef['set']): PackResult {
  const cards: AddResult[] = [];
  for (let i = 0; i < ECONOMY.boosterPackSize; i++) {
    let tier = rollTier(rng);
    let pool = packPool(db, tier, set);
    while (pool.length === 0) {
      const down = TIER_FALLBACK[tier];
      if (down === null) throw new Error('booster pool is empty at every tier');
      tier = down;
      pool = packPool(db, tier, set);
    }
    pool = dupeProtectedPool(tier, pool, (id) => ownedCount(save, id));
    const cardId = pool[rngInt(rng, pool.length)];
    const frame = rollFrame(rng);
    const holo = rollHolo(rng);
    const fullArt = rollFullArt(rng);
    cards.push(addCard(save, db, cardId, { frame, holo, fullArt }));
  }
  save.stats.packsOpened++;
  // Reveal order: tier ascending (c first, ur last), plainer variants before
  // more special ones within a tier; stable sort keeps roll order beyond that.
  cards.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      variantRank({ frame: a.frame, holo: a.holo, fullArt: a.fullArt }) -
        variantRank({ frame: b.frame, holo: b.holo, fullArt: b.fullArt }),
  );
  return { cards };
}

/**
 * Open `count` boosters in sequence off one RNG stream (F10). Deterministic —
 * the same seed + count reproduces the whole batch. Each pack mutates the save
 * (collection + dupe→gold + stats.packsOpened) via openPack; the caller sums the
 * price. Returns each pack's result for a batch-summary reveal.
 */
export function openPacks(
  save: SaveData,
  db: CardDb,
  rng: RngState,
  count: number,
  set?: CardDef['set'],
): PackResult[] {
  const packs: PackResult[] = [];
  for (let i = 0; i < count; i++) packs.push(openPack(save, db, rng, set));
  return packs;
}
