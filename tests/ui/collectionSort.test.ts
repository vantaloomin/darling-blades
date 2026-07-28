import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../src/engine/types';
import { freshSave } from '../../src/meta/SaveManager';
import { variantKey } from '../../src/meta/variants';
import {
  COLLECTION_SORT_OPTIONS,
  DEFAULT_COLLECTION_SORT,
  sortCollectionCards,
} from '../../src/ui/collectionSort';

function card(id: string, name: string, rarity: CardDef['rarity']): CardDef {
  return {
    id,
    name,
    types: ['creature'],
    subtypes: [],
    colors: ['G'],
    rarity,
    cost: { generic: 1, pips: { G: 1 } },
    attack: 1,
    defense: 1,
  };
}

describe('collection sort choices', () => {
  it('keeps card rarity high-to-low as the default', () => {
    const save = freshSave(0);
    const cards = [card('c', 'Common', 'c'), card('ur', 'Ultra', 'ur'), card('r', 'Rare', 'r')];
    expect(sortCollectionCards(cards, DEFAULT_COLLECTION_SORT, save).map((entry) => entry.id)).toEqual([
      'ur',
      'r',
      'c',
    ]);
  });

  it('sorts variant rarity by the best owned finish and treats unowned cards as plain', () => {
    const save = freshSave(0);
    save.collection = { rare: 1 };
    save.collectionVariants = {
      rare: { [variantKey({ frame: 'rainbow', holo: 'void', fullArt: true })]: 1 },
    };
    const cards = [card('plain', 'Plain', 'c'), card('rare', 'Rare finish', 'c')];
    expect(sortCollectionCards(cards, 'variant-rarity-high', save).map((entry) => entry.id)).toEqual([
      'rare',
      'plain',
    ]);
    expect(sortCollectionCards(cards, 'variant-rarity-low', save).map((entry) => entry.id)).toEqual([
      'plain',
      'rare',
    ]);
  });

  it('supports both name directions with deterministic ties', () => {
    const save = freshSave(0);
    const cards = [card('z', 'Twin', 'c'), card('a', 'Twin', 'c'), card('m', 'Alpha', 'c')];
    expect(sortCollectionCards(cards, 'name-az', save).map((entry) => entry.id)).toEqual(['m', 'a', 'z']);
    expect(sortCollectionCards(cards, 'name-za', save).map((entry) => entry.id)).toEqual(['z', 'a', 'm']);
  });

  it('exposes six explicit player-facing choices', () => {
    expect(COLLECTION_SORT_OPTIONS).toHaveLength(6);
    expect(COLLECTION_SORT_OPTIONS.every((option) => !option.label.includes('—'))).toBe(true);
  });
});
