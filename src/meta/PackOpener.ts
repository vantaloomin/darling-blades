import { ECONOMY } from '../config/rules';
import { rngInt, type RngState } from '../engine/rng';
import type { CardDb, CardDef, Rarity } from '../engine/types';
import { isType } from '../engine/types';
import { addCard, ownedCount, PLAYSET, type AddResult } from './Collection';
import type { SaveData } from './SaveManager';
import { rollFrame, rollHolo, rollTier, TIER_RANK, variantRank } from './variants';

/** Cards that can appear in boosters: no basics, no tokens. */
export function packPool(db: CardDb, tier: Rarity, set?: CardDef['set']): string[] {
  return Object.values(db)
    .filter(
      (d) =>
        d.rarity === tier &&
        !d.token &&
        !d.supertypes?.includes('basic') &&
        (set === undefined || (d.set ?? 'base') === set) &&
        (d.cost !== undefined || isType(d, 'land')), // duals allowed, basics excluded above
    )
    .map((d) => d.id)
    .sort();
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
 * Roll one booster: `ECONOMY.packSize` independent slots, each rolling tier →
 * card → frame → holo (in that rng order — determinism depends on it). The
 * sr/ssr/ur slots are dupe-protected: while any card of that tier is owned
 * below a playset, only those cards are rolled. An empty tier pool falls back
 * one tier down (a tiny card set never crashes a pack). Collection updates
 * and plain-dupe→gold conversion happen here, via `addCard`. The result is
 * plain JSON-serializable data, sorted worst→best for the reveal.
 */
export function openPack(save: SaveData, db: CardDb, rng: RngState, set?: CardDef['set']): PackResult {
  const cards: AddResult[] = [];
  for (let i = 0; i < ECONOMY.packSize; i++) {
    let tier = rollTier(rng);
    let pool = packPool(db, tier, set);
    while (pool.length === 0) {
      const down = TIER_FALLBACK[tier];
      if (down === null) throw new Error('booster pool is empty at every tier');
      tier = down;
      pool = packPool(db, tier, set);
    }
    if (tier === 'sr' || tier === 'ssr' || tier === 'ur') {
      const incomplete = pool.filter((id) => ownedCount(save, id) < PLAYSET);
      if (incomplete.length > 0) pool = incomplete;
    }
    const cardId = pool[rngInt(rng, pool.length)];
    const frame = rollFrame(rng);
    const holo = rollHolo(rng);
    cards.push(addCard(save, db, cardId, { frame, holo }));
  }
  save.stats.packsOpened++;
  // Reveal order: tier ascending (c first, ur last), plainer variants before
  // more special ones within a tier; stable sort keeps roll order beyond that.
  cards.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      variantRank({ frame: a.frame, holo: a.holo }) - variantRank({ frame: b.frame, holo: b.holo }),
  );
  return { cards };
}
