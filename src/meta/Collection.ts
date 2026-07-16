import { ECONOMY } from '../config/rules';
import type { CardDb, Rarity } from '../engine/types';
import { def } from '../engine/types';
import type { SaveData } from './SaveManager';
import {
  isPlainVariant,
  parseVariantKey,
  PLAIN_VARIANT,
  shardValue,
  variantKey,
  variantRank,
  type CardVariant,
  type FrameStyle,
  type HoloFinish,
} from './variants';

export const PLAYSET = 4;

/** Aggregate copies owned across all variants (deck building reads this). */
export function ownedCount(save: SaveData, cardId: string): number {
  return save.collection[cardId] ?? 0;
}

export function isBasic(db: CardDb, cardId: string): boolean {
  return def(db, cardId).supertypes?.includes('basic') ?? false;
}

/**
 * variantKey -> count for one card. Copies that predate variant tracking
 * (aggregate count with no variant record) read as PLAIN.
 */
export function ownedVariants(save: SaveData, cardId: string): Record<string, number> {
  const v = save.collectionVariants[cardId];
  if (v && Object.keys(v).length > 0) return v;
  const n = ownedCount(save, cardId);
  return n > 0 ? { [variantKey(PLAIN_VARIANT)]: n } : {};
}

/** The most special owned variant (variants.ts ranking); PLAIN if only plain/legacy copies. */
export function bestOwnedVariant(save: SaveData, cardId: string): CardVariant {
  let best = PLAIN_VARIANT;
  let bestRank = variantRank(PLAIN_VARIANT);
  for (const [key, count] of Object.entries(ownedVariants(save, cardId))) {
    if (count <= 0) continue;
    const v = parseVariantKey(key);
    const rank = variantRank(v);
    if (rank > bestRank) {
      bestRank = rank;
      best = v;
    }
  }
  return best;
}

export interface AddResult {
  cardId: string;
  isNew: boolean; // first copy of this card, any variant
  isNewVariant: boolean; // first copy of this exact (frame, holo) variant
  dupeGold: number; // 0 unless this copy melted (plain past the playset)
  tier: Rarity;
  frame: FrameStyle;
  holo: HoloFinish;
}

/**
 * Add one card in a specific variant. Per-variant playset (4 of each distinct
 * frame|holo): a PLAIN copy past 4 PLAIN copies auto-melts to gold
 * (`ECONOMY.dupeGold` by tier) without being recorded — the anti-loop /
 * declutter guard. A SPECIAL variant (any non-plain frame or holo) is ALWAYS
 * recorded, even past 4 — the player sells its beyond-4 excess by hand
 * (`shardExcess`). Decks still cap at `RULES.maxCopies` regardless of how many
 * copies are recorded.
 */
export function addCard(
  save: SaveData,
  db: CardDb,
  cardId: string,
  variant: CardVariant = PLAIN_VARIANT,
): AddResult {
  const tier = def(db, cardId).rarity;
  const owned = ownedCount(save, cardId);
  const base = { cardId, tier, frame: variant.frame, holo: variant.holo };
  const key = variantKey(variant);
  const perCard = (save.collectionVariants[cardId] ??= {});
  const had = perCard[key] ?? 0;
  // Per-variant melt: only the PLAIN copies self-cap at the playset (a 5th
  // white|none melts even if you hold other-variant copies). Specials pile up.
  if (isPlainVariant(variant) && had >= PLAYSET) {
    const gold = ECONOMY.dupeGold[tier];
    save.gold += gold;
    return { ...base, isNew: false, isNewVariant: false, dupeGold: gold };
  }
  perCard[key] = had + 1;
  save.collection[cardId] = owned + 1; // aggregate stays the sum of variant counts
  return { ...base, isNew: owned === 0, isNewVariant: had === 0, dupeGold: 0 };
}

/** Gold cost for one plain copy of a card, before eligibility checks. */
export function craftCost(db: CardDb, cardId: string, costMult: number = ECONOMY.craftCostMult): number {
  return costMult * ECONOMY.dupeGold[def(db, cardId).rarity];
}

export type CraftResult = { ok: true } | { ok: false; reason: string };

/**
 * Craft one missing collectible as a PLAIN copy. Crafting is deliberately
 * identity-based: any owned variant blocks the action, and the normal addCard
 * path owns the aggregate and per-variant bookkeeping.
 */
export function craftCard(
  save: SaveData,
  db: CardDb,
  cardId: string,
  costMult: number = ECONOMY.craftCostMult,
): CraftResult {
  const card = db[cardId];
  if (!card) return { ok: false, reason: 'unknown-card' };
  if (card.token || card.supertypes?.includes('basic')) return { ok: false, reason: 'not-collectible' };
  if (ownedCount(save, cardId) > 0) return { ok: false, reason: 'already-owned' };

  const cost = craftCost(db, cardId, costMult);
  if (save.gold < cost) return { ok: false, reason: 'insufficient-gold' };
  save.gold -= cost;
  const result = addCard(save, db, cardId, PLAIN_VARIANT);
  if (!result.isNew || !result.isNewVariant || result.dupeGold !== 0) {
    throw new Error(`Crafted card did not grant a new plain copy: ${cardId}`);
  }
  return { ok: true };
}

export interface ShardResult {
  gold: number; // total gold gained
  copies: number; // total copies sharded away
}

/** Copies of `cardId` past the per-variant playset — what `shardExcess` sells. */
export function shardableCount(save: SaveData, cardId: string): number {
  let n = 0;
  for (const count of Object.values(ownedVariants(save, cardId))) {
    n += Math.max(0, count - PLAYSET);
  }
  return n;
}

/** Gold `shardExcess(cardId)` would pay (0 when nothing is over the cap). */
export function shardGold(save: SaveData, db: CardDb, cardId: string): number {
  const tier = def(db, cardId).rarity;
  let gold = 0;
  for (const [keyStr, count] of Object.entries(ownedVariants(save, cardId))) {
    const excess = Math.max(0, count - PLAYSET);
    if (excess > 0) gold += shardValue(tier, parseVariantKey(keyStr)) * excess;
  }
  return gold;
}

/**
 * Sell every copy of `cardId` past the per-variant playset (4 of each
 * frame|holo) for gold (`shardValue` per copy, specials worth more). Reduces
 * each over-cap variant to 4, pays gold, and preserves the aggregate =
 * sum-of-variants invariant. A no-op ({0,0}) when nothing is over the cap;
 * legacy plain-only aggregates (no variant record) materialize as PLAIN first.
 */
export function shardExcess(save: SaveData, db: CardDb, cardId: string): ShardResult {
  const tier = def(db, cardId).rarity;
  let gold = 0;
  let copies = 0;
  const kept: Record<string, number> = {};
  for (const [keyStr, count] of Object.entries(ownedVariants(save, cardId))) {
    const keep = Math.min(count, PLAYSET);
    const excess = count - keep;
    if (excess > 0) {
      gold += shardValue(tier, parseVariantKey(keyStr)) * excess;
      copies += excess;
    }
    if (keep > 0) kept[keyStr] = keep;
  }
  if (copies === 0) return { gold: 0, copies: 0 };
  save.gold += gold;
  save.collectionVariants[cardId] = kept;
  save.collection[cardId] = Object.values(kept).reduce((s, n) => s + n, 0);
  return { gold, copies };
}

/** Add several PLAIN copies (starter grants and the like). */
export function addCards(save: SaveData, db: CardDb, cardIds: readonly string[]): AddResult[] {
  return cardIds.map((id) => addCard(save, db, id));
}
