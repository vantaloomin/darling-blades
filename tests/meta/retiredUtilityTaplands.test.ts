import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import type { CardDb, CardDef } from '../../src/engine/types';
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

/**
 * The live catalog holds NO utility taplands since the 2026-09-17 land-economy
 * conversion (docs/plan-land-economy.md): all 27 became common Duty artifacts.
 * The retirement behaviour still has to hold for any tapland a future set might
 * print, so the suite injects one fixture tapland into a cloned db and a cloned
 * ALL_CARDS and proves every rule against it, plus the live-catalog assertion
 * that none exists any more.
 */
const FIXTURE_ID = 'fixture-utility-tapland';
const FIXTURE: CardDef = {
  id: FIXTURE_ID,
  name: 'Fixture Utility Tapland',
  types: ['land'],
  subtypes: [],
  colors: [],
  manaAbility: ['G'],
  entersTapped: true,
  rarity: 'c',
  set: 'celtic-fae',
};

const DB: CardDb = Object.freeze({ ...CARD_DB, [FIXTURE_ID]: FIXTURE });
const CARDS: readonly CardDef[] = [...ALL_CARDS, FIXTURE];
const RETIRED_IDS = new Set([FIXTURE_ID]);
const TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;

describe('retired utility taplands', () => {
  it('no longer exist in the live catalog', () => {
    expect(ALL_CARDS.filter(isUtilityTapland)).toEqual([]);
    expect(isUtilityTapland(FIXTURE)).toBe(true);
  });

  it('never enters booster or Limited draft pack pools', () => {
    for (const tier of TIERS) {
      expect(packPool(DB, tier).some((id) => RETIRED_IDS.has(id))).toBe(false);
    }
    for (let seed = 1; seed <= 100; seed++) {
      const booster = openPack(freshSave(0), DB, createRngState(seed));
      expect(booster.cards.every((card) => !RETIRED_IDS.has(card.cardId))).toBe(true);
      expect(rollLimitedPack(DB, seed).every((id) => !RETIRED_IDS.has(id))).toBe(true);
    }
  });

  it('hides unowned cards, retains owned cards in Collection, and removes them from completion', () => {
    const save = freshSave(0);

    expect(collectiblePool(CARDS).some((card) => card.id === FIXTURE_ID)).toBe(false);
    expect(collectionDisplayPool(CARDS, save).some((card) => card.id === FIXTURE_ID)).toBe(false);

    save.collection[FIXTURE_ID] = 1;
    expect(collectionDisplayPool(CARDS, save).some((card) => card.id === FIXTURE_ID)).toBe(true);
    const completion = collectionCompletion(CARDS, save);
    expect(completion.total).toBe(collectiblePool(CARDS).length);
    expect(completion.owned).toBe(0);
  });

  it('rejects crafting but keeps owned copies shardable', () => {
    const save = freshSave(0);
    const cost = craftCost(DB, FIXTURE_ID);
    save.gold = cost;

    expect(craftCard(save, DB, FIXTURE_ID)).toEqual({ ok: false, reason: 'not-collectible' });
    expect(save.collection[FIXTURE_ID]).toBeUndefined();
    expect(save.gold).toBe(cost);

    save.collection[FIXTURE_ID] = 5;
    expect(shardableCount(save, FIXTURE_ID)).toBe(1);
    const result = shardExcess(save, DB, FIXTURE_ID);
    expect(result.copies).toBe(1);
    expect(save.collection[FIXTURE_ID]).toBe(4);
  });
});
