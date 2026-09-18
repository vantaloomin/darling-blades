import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { DROWNED_DEEP_SET, STARBORNE_SET, isLiveCollectible, isLiveSet } from '../../src/data/liveness';
import { SET_IDS } from '../../src/data/setTitles';
import { THEME_DECKS } from '../../src/data/starterDecks';
import { createRngState } from '../../src/engine/rng';
import type { CardDb, CardDef } from '../../src/engine/types';
import { applyFilters, collectiblePool, defaultFilterState } from '../../src/meta/collectionFilter';
import { deckHealth } from '../../src/meta/deckRepair';
import { buyThemeDeck } from '../../src/meta/Economy';
import { openPack, packPool, type PackResult } from '../../src/meta/PackOpener';
import { packPoolSummary } from '../../src/meta/packSummary';
import { freshSave } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey } from '../../src/meta/variants';

const TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;
const finishes = (result: PackResult) => result.cards.map(({ tier, frame, holo, fullArt }) => ({
  tier, frame, holo, fullArt,
}));

describe('Drowned Deep retail pack pipeline', () => {
  it('opens 100 seeded nine-card packs with only dd- collectibles and the standard slot odds', () => {
    for (const tier of TIERS) expect(packPool(CARD_DB, tier, DROWNED_DEEP_SET).length).toBeGreaterThan(0);
    for (let seed = 0; seed < 100; seed++) {
      const save = freshSave(0);
      const pack = openPack(save, CARD_DB, createRngState(seed), DROWNED_DEEP_SET);
      const starborne = openPack(freshSave(0), CARD_DB, createRngState(seed), STARBORNE_SET as unknown as CardDef['set']);
      expect(pack.cards).toHaveLength(ECONOMY.boosterPackSize);
      expect(pack.cards).toHaveLength(9);
      for (const { cardId } of pack.cards) {
        expect(cardId.startsWith('dd-'), `seed ${seed}: ${cardId}`).toBe(true);
        expect(CARD_DB[cardId].set).toBe(DROWNED_DEEP_SET);
        expect(CARD_DB[cardId].token).toBeFalsy();
        expect(isLiveCollectible(CARD_DB[cardId])).toBe(true);
      }
      // Both complete tier pools consume the same global tier/finish rolls.
      expect(finishes(pack), `seed ${seed}`).toEqual(finishes(starborne));
      expect(save.stats.packsOpened).toBe(1);
    }
  });

  it('keeps SR, SSR, and UR duplicate protection inside the set', () => {
    const protectedTiers = ['sr', 'ssr', 'ur'] as const;
    const seen = { sr: 0, ssr: 0, ur: 0 };
    for (let seed = 0; seed < 100; seed++) {
      const save = freshSave(0);
      const missing = new Map<string, string>();
      for (const tier of protectedTiers) {
        const [first, ...complete] = packPool(CARD_DB, tier, DROWNED_DEEP_SET);
        missing.set(tier, first);
        for (const id of complete) {
          save.collection[id] = 4;
          save.collectionVariants[id] = { [variantKey(PLAIN_VARIANT)]: 4 };
        }
      }
      const pack = openPack(save, CARD_DB, createRngState(seed), DROWNED_DEEP_SET);
      for (const tier of protectedTiers) {
        const pulls = pack.cards.filter((card) => card.tier === tier);
        seen[tier] += pulls.length;
        expect(pulls.every((card) => CARD_DB[card.cardId].set === DROWNED_DEEP_SET)).toBe(true);
        const protectedPulls = pulls.filter((card) => card.cardId === missing.get(tier));
        // Protection can end within a pack after its fourth missing copy.
        expect(protectedPulls.length).toBeGreaterThanOrEqual(Math.min(4, pulls.length));
      }
    }
    for (const tier of protectedTiers) expect(seen[tier], tier).toBeGreaterThan(0);
  });

  it('keeps empty-tier fallback inside Drowned Deep even when other sets have higher rarities', () => {
    const db: CardDb = Object.fromEntries(Object.entries(CARD_DB).filter(([, card]) =>
      card.set !== DROWNED_DEEP_SET || card.rarity === 'c',
    ));
    let higherTierRolls = 0;
    for (let seed = 0; seed < 30; seed++) {
      const full = openPack(freshSave(0), CARD_DB, createRngState(seed), DROWNED_DEEP_SET);
      higherTierRolls += full.cards.filter((card) => card.tier !== 'c').length;
      const pack = openPack(freshSave(0), db, createRngState(seed), DROWNED_DEEP_SET);
      expect(pack.cards).toHaveLength(9);
      for (const card of pack.cards) {
        expect(card.tier).toBe('c');
        expect(card.cardId.startsWith('dd-')).toBe(true);
        expect(db[card.cardId].token).toBeFalsy();
      }
    }
    expect(higherTierRolls).toBeGreaterThan(0);
  });

  it('counts only the 252-card set pool and its distinct owned cards', () => {
    const save = freshSave(0);
    expect(packPoolSummary(save, CARD_DB, DROWNED_DEEP_SET)).toEqual({ poolSize: 252, ownedDistinct: 0 });
    save.collection['dd-tide-clerk'] = 4;
    save.collection['dd-mother-hydra'] = 1;
    save.collection['tok-deep-spawn'] = 1;
    save.collection['land-island'] = 12;
    save.collection['sb-rootlight-broodmother'] = 1;
    expect(packPoolSummary(save, CARD_DB, DROWNED_DEEP_SET)).toEqual({ poolSize: 252, ownedDistinct: 2 });
  });

  it('exposes the set to live filters and adds 252 cards to the binder pool', () => {
    expect(SET_IDS.filter(isLiveSet)).toContain(DROWNED_DEEP_SET);
    const pool = collectiblePool(ALL_CARDS);
    // 1455 -> 1482 on 2026-09-17: the land-economy conversion returns the 27
    // retired utility taplands to the collectible pool as common Duty
    // artifacts (docs/plan-land-economy.md).
    expect(pool).toHaveLength(1482);
    const filtered = applyFilters(pool, { ...defaultFilterState(), set: DROWNED_DEEP_SET }, freshSave(0));
    expect(filtered).toHaveLength(252);
    expect(filtered.every((card) => card.id.startsWith('dd-') && !card.token)).toBe(true);
  });
});

describe('Lanterns Below retail grant', () => {
  it('charges the standard precon price and grants an unblocked reserve deck', () => {
    const deck = THEME_DECKS.find((entry) => entry.id === 'theme-drowned-deep')!;
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    expect(save.gold).toBe(0);
    const granted = save.decks.find((entry) => entry.id === deck.id)!;
    expect(granted).toMatchObject({ name: 'Lanterns Below', format: 'warchest' });
    expect(granted.cards).toEqual(deck.reserveCards);
    expect(granted.landReserve).toEqual(deck.landReserve);
    expect(deckHealth(CARD_DB, save, granted)).toEqual({ blocked: false, issues: [] });
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(false);
  });
});
