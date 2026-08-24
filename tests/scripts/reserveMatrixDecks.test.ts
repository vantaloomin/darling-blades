import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { DARLINGS_DECK_SIZE, isDualLand, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import {
  buildReserveMatrixFleets,
  buildReserveMatrixFullOwnershipSave,
  buildWarchestTuningField,
  trimWarchestDeck,
} from '../../scripts/reserveMatrixDecks';

describe('reserve matrix deck derivation', () => {
  it('derives the same legal Warchest and Darlings fleets on every call', () => {
    const first = buildReserveMatrixFleets();
    const second = buildReserveMatrixFleets();
    const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

    expect(first).toEqual(second);
    expect(first.warchest.map((deck) => deck.name)).toEqual([
      'Crimson Muster Warchest',
      'Wild Communion Warchest',
      'Burning Tides Warchest',
      'Shadow Mandate Warchest',
      'Grave Harvest Warchest',
    ]);
    // 2026-08-21: the live Duat pool re-derives the Wild Communion Darling.
    expect(first.darlings.map((deck) => deck.darlingId)).toEqual([
      'gk-athena',
      'sd-anuket-who-runs-the-cataracts',
      'rg-dianwei',
      'gk-ares',
      'gk-gaia',
      'gk-aphrodite',
    ]);

    for (const deck of first.warchest) {
      expect(deck.cards).toHaveLength(WARCHEST_DECK_SIZE);
      expect(deck.landReserve).toHaveLength(10);
      expect(deck.landReserve.filter((id) => isDualLand(CARD_DB[id])).length).toBeLessThanOrEqual(5);
      expect(validateWarchestDeck(CARD_DB, save, deck.cards, deck.landReserve)).toEqual([]);
    }

    for (const deck of first.darlings) {
      expect(deck.cards).toHaveLength(DARLINGS_DECK_SIZE);
      expect(new Set(deck.cards)).toHaveLength(DARLINGS_DECK_SIZE);
      expect(deck.cards).not.toContain(deck.darlingId);
      expect(deck.landReserve).toHaveLength(10);
      expect(deck.landReserve.filter((id) => isDualLand(CARD_DB[id])).length).toBeLessThanOrEqual(5);
      expect(validateDarlingsDeck(CARD_DB, save, deck.cards, deck.darlingId, deck.landReserve)).toEqual([]);
    }
  });

  it('trims every baseline deck deterministically to a smaller validator-legal size', () => {
    // Canonical decks author at WARCHEST_DECK_SIZE (40 since the flip); the
    // trim rule still holds for any smaller target and stays deterministic.
    const target = WARCHEST_DECK_SIZE - 4;
    for (const source of buildReserveMatrixFleets().warchest) {
      const first = trimWarchestDeck(source, target);
      const second = trimWarchestDeck(source, target);
      expect(first).toEqual(second);
      expect(first.deck.cards).toHaveLength(target);
      expect(first.trimmed.removed.reduce((sum, entry) => sum + entry.count, 0)).toBe(
        WARCHEST_DECK_SIZE - target,
      );
      expect(new Set(first.deck.cards)).toEqual(new Set(source.cards));
      // An identity trim is a no-op with nothing removed.
      const identity = trimWarchestDeck(source, WARCHEST_DECK_SIZE);
      expect(identity.deck.cards).toHaveLength(WARCHEST_DECK_SIZE);
      expect(identity.trimmed.removed).toHaveLength(0);
    }
  });

  it('builds deterministic legal color-count probes and logs cap exclusions', () => {
    const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
    // The 50-card fields retired at the 2026-08-07 parameter flip; canonical
    // lists author at WARCHEST_DECK_SIZE (40) and no larger target exists.
    const uncapped40 = buildWarchestTuningField(40);
    const capped40 = buildWarchestTuningField(40, 2);

    expect(buildWarchestTuningField(40)).toEqual(uncapped40);
    expect(uncapped40.decks.slice(-4).map((deck) => deck.colors.length)).toEqual([1, 2, 3, 5]);
    for (const deck of uncapped40.decks) {
      expect(validateWarchestDeck(CARD_DB, save, deck.cards, deck.landReserve, {
        deckSize: 40,
      })).toEqual([]);
    }

    expect(capped40.decks).toHaveLength(7);
    expect(capped40.decks.slice(-2).map((deck) => deck.colors.length)).toEqual([1, 2]);
    expect(capped40.excluded.map((deck) => deck.colors.length)).toEqual([3, 5]);
    for (const deck of capped40.decks) {
      expect(validateWarchestDeck(CARD_DB, save, deck.cards, deck.landReserve, {
        deckSize: 40,
        maxReserveColors: 2,
      })).toEqual([]);
    }
  });
});

describe('warchest tuning grid after the 2026-08-07 parameter flip', () => {
  it('offers only 40-card configs; the 50-card era is retired', async () => {
    const { WARCHEST_TUNING_CONFIGS } = await import('../../scripts/balance-matrix');
    expect(WARCHEST_TUNING_CONFIGS.map((config) => config.key)).toEqual([
      '40-5-nocap',
      '40-5-cap2',
      '40-4-nocap',
      '40-4-cap2',
    ]);
    for (const config of WARCHEST_TUNING_CONFIGS) {
      expect(config.deckSize).toBe(WARCHEST_DECK_SIZE);
    }
  });
});
