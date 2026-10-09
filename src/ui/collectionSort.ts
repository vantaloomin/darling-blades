import type { CardDef } from '../engine/types';
import { manaValue } from '../engine/types';
import { bestOwnedVariant, ownedCount } from '../meta/Collection';
import type { SaveData } from '../meta/SaveManager';
import { finishOdds } from '../meta/pullOdds';
import { PLAIN_VARIANT, TIER_RANK } from '../meta/variants';
import { SET_IDS } from '../data/setTitles';

/** What the Collection binder sorts by; the flip button beside it picks the direction. */
export type CollectionSortKey = 'card-rarity' | 'variant-rarity' | 'name' | 'set';

export interface CollectionSort {
  key: CollectionSortKey;
  /** False is the criterion's own default direction (the first label below). */
  reversed: boolean;
}

export const DEFAULT_COLLECTION_SORT: CollectionSort = { key: 'card-rarity', reversed: false };

export const COLLECTION_SORT_OPTIONS: readonly { value: CollectionSortKey; label: string }[] = [
  { value: 'card-rarity', label: 'Card rarity' },
  { value: 'variant-rarity', label: 'Variant rarity' },
  { value: 'name', label: 'Name' },
  { value: 'set', label: 'Set' },
];

/** The flip button's label per criterion: [default direction, reversed]. */
const DIRECTION_LABELS: Record<CollectionSortKey, readonly [string, string]> = {
  'card-rarity': ['High first', 'Low first'],
  'variant-rarity': ['Rare first', 'Common first'],
  name: ['A to Z', 'Z to A'],
  set: ['Newest first', 'Oldest first'],
};

export function sortDirectionLabel(sort: CollectionSort): string {
  return DIRECTION_LABELS[sort.key][sort.reversed ? 1 : 0];
}

/** Every direction label, for sizing the flip button to its longest state. */
export const SORT_DIRECTION_LABELS: readonly string[] = Object.values(DIRECTION_LABELS).flat();

function byName(a: CardDef, b: CardDef): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function cardRarity(a: CardDef, b: CardDef): number {
  return TIER_RANK[b.rarity] - TIER_RANK[a.rarity] || manaValue(a.cost) - manaValue(b.cost) || byName(a, b);
}

function setRank(d: CardDef): number {
  return SET_IDS.indexOf(d.set ?? 'base');
}

function ownedVariantFinishOdds(save: SaveData, cardId: string): number {
  const variant = ownedCount(save, cardId) > 0 ? bestOwnedVariant(save, cardId) : PLAIN_VARIANT;
  return finishOdds(variant.frame, variant.holo, variant.fullArt);
}

/**
 * Sort a filtered binder pool without mutating the filter helper's result.
 * Reversed flips only the criterion itself: card rarity and name reverse
 * whole, while variant rarity and set keep their tiebreak (highest card
 * rarity, then name) in the same order either way, so Set: oldest first
 * still opens each set on its rarest cards.
 */
export function sortCollectionCards(
  cards: readonly CardDef[],
  sort: CollectionSort,
  save: SaveData,
): CardDef[] {
  const dir = sort.reversed ? -1 : 1;
  const compare = (a: CardDef, b: CardDef): number => {
    switch (sort.key) {
      case 'card-rarity':
        return dir * cardRarity(a, b);
      case 'variant-rarity':
        // Rarest finish first: finish odds are a probability, so lower is rarer.
        return dir * (ownedVariantFinishOdds(save, a.id) - ownedVariantFinishOdds(save, b.id)) || cardRarity(a, b);
      case 'name':
        return dir * byName(a, b);
      case 'set':
        // SET_IDS is in release order, so the default (newest first) is descending.
        return dir * (setRank(b) - setRank(a)) || TIER_RANK[b.rarity] - TIER_RANK[a.rarity] || byName(a, b);
    }
  };
  return [...cards].sort(compare);
}
