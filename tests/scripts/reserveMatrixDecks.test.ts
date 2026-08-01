import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { DARLINGS_DECK_SIZE, isDualLand, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import {
  buildReserveMatrixFleets,
  buildReserveMatrixFullOwnershipSave,
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
      expect(deck.landReserve).toHaveLength(10);
      expect(deck.landReserve.filter((id) => isDualLand(CARD_DB[id])).length).toBeLessThanOrEqual(5);
      expect(validateDarlingsDeck(CARD_DB, save, deck.cards, deck.darlingId, deck.landReserve)).toEqual([]);
    }
  });
});
