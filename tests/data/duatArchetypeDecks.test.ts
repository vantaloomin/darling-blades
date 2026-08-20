import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { DUAT_ARCHETYPE_DECKS } from '../../src/data/duatArchetypeDecks';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
} from '../../src/meta/warchest';
import { validateWarchestDeck } from '../../src/meta/darlings';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

describe('Sands of the Duat authored archetype decks', () => {
  it('exports exactly the five section-3 archetypes with distinct ids', () => {
    expect(DUAT_ARCHETYPE_DECKS).toHaveLength(5);
    expect(new Set(DUAT_ARCHETYPE_DECKS.map((deck) => deck.id)).size).toBe(5);
    expect(DUAT_ARCHETYPE_DECKS.map((deck) => deck.id)).toEqual([
      'duat-archetype-rite',
      'duat-archetype-nine-lives',
      'duat-archetype-preserve',
      'duat-archetype-empower',
      'duat-archetype-bastet',
    ]);
  });

  for (const deck of DUAT_ARCHETYPE_DECKS) {
    it(`${deck.id}: keeps a legal 40-spell Warchest list and a 10-land reserve`, () => {
      const reserveCards = deck.reserveCards!;
      const landReserve = deck.landReserve!;
      expect(deck.cards).toHaveLength(60);
      expect(deck.cards.filter((id) => CARD_DB[id]?.types.includes('land'))).toHaveLength(20);
      expect(reserveCards).toHaveLength(WARCHEST_DECK_SIZE);
      expect(reserveCards.some((id) => CARD_DB[id]?.types.includes('land'))).toBe(false);
      expect(landReserve).toHaveLength(LAND_RESERVE_SIZE);
      expect(landReserve.filter((id) => isDualLand(CARD_DB[id])).length).toBeLessThanOrEqual(MAX_DUAL_LANDS);
      for (const id of [...deck.cards, ...reserveCards, ...landReserve]) {
        expect(CARD_DB[id], `${deck.id} unknown card ${id}`).toBeDefined();
        expect(CARD_DB[id]?.token, `${deck.id} token ${id}`).toBeFalsy();
      }
      for (const id of landReserve) {
        expect(isBasicLand(CARD_DB[id]) || isDualLand(CARD_DB[id]), `${deck.id} invalid reserve land ${id}`).toBe(true);
      }
      expect(validateWarchestDeck(CARD_DB, save, reserveCards, landReserve)).toEqual([]);
    });
  }
});
