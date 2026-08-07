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
    expect(first.darlings.map((deck) => deck.darlingId)).toEqual([
      'gk-athena',
      'yn-ghost-net-archon',
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

  it('trims every baseline deck deterministically to a validator-legal 40 cards', () => {
    const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
    for (const source of buildReserveMatrixFleets().warchest) {
      const first = trimWarchestDeck(source, 40);
      const second = trimWarchestDeck(source, 40);
      expect(first).toEqual(second);
      expect(first.deck.cards).toHaveLength(40);
      expect(first.trimmed.removed.reduce((sum, entry) => sum + entry.count, 0)).toBe(10);
      expect(new Set(first.deck.cards)).toEqual(new Set(source.cards));
      expect(validateWarchestDeck(CARD_DB, save, first.deck.cards, first.deck.landReserve, {
        deckSize: 40,
        maxReserveColors: 2,
      })).toEqual([]);
    }
  });

  it('builds deterministic legal color-count probes and logs cap exclusions', () => {
    const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
    const uncapped50 = buildWarchestTuningField(50);
    const uncapped40 = buildWarchestTuningField(40);
    const capped40 = buildWarchestTuningField(40, 2);

    expect(buildWarchestTuningField(40)).toEqual(uncapped40);
    expect(uncapped50.decks.slice(-4).map((deck) => deck.colors.length)).toEqual([1, 2, 3, 5]);
    expect(uncapped40.decks.slice(-4).map((deck) => deck.colors.length)).toEqual([1, 2, 3, 5]);
    for (const field of [uncapped50, uncapped40]) {
      for (const deck of field.decks) {
        expect(validateWarchestDeck(CARD_DB, save, deck.cards, deck.landReserve, {
          deckSize: deck.cards.length as 40 | 50,
        })).toEqual([]);
      }
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
