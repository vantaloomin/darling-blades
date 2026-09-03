import type { CardDef } from '../engine/types';
import { manaValue } from '../engine/types';
import { bestOwnedVariant, ownedCount } from '../meta/Collection';
import type { SaveData } from '../meta/SaveManager';
import { finishOdds } from '../meta/pullOdds';
import { PLAIN_VARIANT, TIER_RANK } from '../meta/variants';

/** The explicit sort choices exposed by the Collection binder. */
export type CollectionSortSelection =
  | 'card-rarity-high'
  | 'card-rarity-low'
  | 'variant-rarity-high'
  | 'variant-rarity-low'
  | 'name-az'
  | 'name-za';

export const DEFAULT_COLLECTION_SORT: CollectionSortSelection = 'card-rarity-high';

export const COLLECTION_SORT_OPTIONS: readonly { value: CollectionSortSelection; label: string }[] = [
  { value: 'card-rarity-high', label: 'Card rarity: high to low' },
  { value: 'card-rarity-low', label: 'Card rarity: low to high' },
  { value: 'variant-rarity-high', label: 'Variant rarity: rare' },
  { value: 'variant-rarity-low', label: 'Variant rarity: common' },
  { value: 'name-az', label: 'Name: A to Z' },
  { value: 'name-za', label: 'Name: Z to A' },
];

function byName(a: CardDef, b: CardDef): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function cardRarity(a: CardDef, b: CardDef): number {
  return TIER_RANK[b.rarity] - TIER_RANK[a.rarity] || manaValue(a.cost) - manaValue(b.cost) || byName(a, b);
}

function ownedVariantFinishOdds(save: SaveData, cardId: string): number {
  const variant = ownedCount(save, cardId) > 0 ? bestOwnedVariant(save, cardId) : PLAIN_VARIANT;
  return finishOdds(variant.frame, variant.holo, variant.fullArt);
}

/** Sort a filtered binder pool without mutating the filter helper's result. */
export function sortCollectionCards(
  cards: readonly CardDef[],
  selection: CollectionSortSelection,
  save: SaveData,
): CardDef[] {
  return [...cards].sort((a, b) => {
    switch (selection) {
      case 'card-rarity-high':
        return cardRarity(a, b);
      case 'card-rarity-low':
        return cardRarity(b, a);
      case 'variant-rarity-high':
        return ownedVariantFinishOdds(save, a.id) - ownedVariantFinishOdds(save, b.id) || cardRarity(a, b);
      case 'variant-rarity-low':
        return ownedVariantFinishOdds(save, b.id) - ownedVariantFinishOdds(save, a.id) || cardRarity(a, b);
      case 'name-az':
        return byName(a, b);
      case 'name-za':
        return byName(b, a);
    }
  });
}
