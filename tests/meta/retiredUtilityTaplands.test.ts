import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { createRngState } from '../../src/engine/rng';
import {
  craftCard,
  craftCost,
  shardableCount,
  shardExcess,
} from '../../src/meta/Collection';
import {
  collectionCompletion,
  collectionDisplayPool,
  collectiblePool,
} from '../../src/meta/collectionFilter';
import { rollLimitedPack } from '../../src/meta/Limited';
import { openPack, packPool } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';
import { isUtilityTapland } from '../../src/meta/warchest';

const RETIRED = Object.values(CARD_DB).filter(isUtilityTapland);
const RETIRED_IDS = new Set(RETIRED.map((card) => card.id));
const TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;

describe('retired utility taplands', () => {
  it('never enters booster or Limited draft pack pools', () => {
    for (const tier of TIERS) {
      expect(packPool(CARD_DB, tier).some((id) => RETIRED_IDS.has(id))).toBe(false);
    }
    for (let seed = 1; seed <= 100; seed++) {
      const booster = openPack(freshSave(0), CARD_DB, createRngState(seed));
      expect(booster.cards.every((card) => !RETIRED_IDS.has(card.cardId))).toBe(true);
      expect(rollLimitedPack(CARD_DB, seed).every((id) => !RETIRED_IDS.has(id))).toBe(true);
    }
  });

  it('hides unowned cards, retains owned cards in Collection, and removes them from completion', () => {
    const save = freshSave(0);
    const retiredId = RETIRED[0].id;

    expect(collectiblePool(ALL_CARDS).some((card) => card.id === retiredId)).toBe(false);
    expect(collectionDisplayPool(ALL_CARDS, save).some((card) => card.id === retiredId)).toBe(false);

    save.collection[retiredId] = 1;
    expect(collectionDisplayPool(ALL_CARDS, save).some((card) => card.id === retiredId)).toBe(true);
    const completion = collectionCompletion(ALL_CARDS, save);
    expect(completion.total).toBe(collectiblePool(ALL_CARDS).length);
    expect(completion.owned).toBe(0);
  });

  it('rejects crafting but keeps owned copies shardable', () => {
    const cardId = RETIRED[0].id;
    const save = freshSave(0);
    const cost = craftCost(CARD_DB, cardId);
    save.gold = cost;

    expect(craftCard(save, CARD_DB, cardId)).toEqual({ ok: false, reason: 'not-collectible' });
    expect(save.collection[cardId]).toBeUndefined();
    expect(save.gold).toBe(cost);

    save.collection[cardId] = 5;
    expect(shardableCount(save, cardId)).toBe(1);
    const result = shardExcess(save, CARD_DB, cardId);
    expect(result.copies).toBe(1);
    expect(save.collection[cardId]).toBe(4);
  });
});
