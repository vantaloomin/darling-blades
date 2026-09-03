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

const countCards = (cards: string[]) =>
  Object.fromEntries([...new Set(cards)].map((id) => [id, cards.filter((cardId) => cardId === id).length]));

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

  it('pins the final measured Copy Kept in Linen list', () => {
    const deck = DUAT_ARCHETYPE_DECKS.find((entry) => entry.id === 'duat-archetype-preserve')!;
    // Surgery 13 kept Resin-Wrapped Beetle over Empty Heart Jar at 43.4%;
    // this positive list assertion protects the measured Preserve/copy shell.
    expect(countCards(deck.cards)).toEqual({
      'land-swamp': 12,
      'land-island': 8,
      'sd-resin-wrapped-beetle': 4,
      'sd-reed-bound-canopic': 4,
      'sd-tomb-seal': 2,
      'sd-the-debt-is-called': 4,
      'sd-archivist-of-the-fourth-hall': 4,
      'sd-tollgate-of-the-fourth-hall': 4,
      'sd-canopic-grave-warden': 4,
      'sd-the-copy-kept-in-linen': 4,
      'sd-two-jars-one-heart': 2,
      'sd-fourth-weighing': 4,
      'sd-navigator-of-the-last-channel': 4,
    });
    expect(countCards(deck.reserveCards!)).toEqual({
      'sd-resin-wrapped-beetle': 4,
      'sd-reed-bound-canopic': 4,
      'sd-tomb-seal': 2,
      'sd-the-debt-is-called': 4,
      'sd-archivist-of-the-fourth-hall': 4,
      'sd-tollgate-of-the-fourth-hall': 4,
      'sd-canopic-grave-warden': 4,
      'sd-the-copy-kept-in-linen': 4,
      'sd-two-jars-one-heart': 2,
      'sd-fourth-weighing': 4,
      'sd-navigator-of-the-last-channel': 4,
    });
  });

  it('pins the final measured Flood Measures the Sky list', () => {
    const deck = DUAT_ARCHETYPE_DECKS.find((entry) => entry.id === 'duat-archetype-empower')!;
    // Surgery 13 kept Pride-Root Warden over Levee-Foot Scout at 46.4%;
    // keep the ramp, flood-control, and Behemoth identity explicit.
    expect(countCards(deck.cards)).toEqual({
      'land-forest': 20,
      'sd-siltfield-forager': 4,
      'sd-flood-line-survivor': 4,
      'sd-pride-root-warden': 4,
      'sd-furrow-water-tender': 4,
      'sd-silt-field-champion': 4,
      'sd-harvest-tide-keeper': 2,
      'sd-floodgate-warden': 4,
      'sd-deep-flood-behemoth': 4,
      'sd-measure-the-silt': 4,
      'sd-harvest-after-rain': 4,
      'sd-ward-the-floodgate': 2,
    });
    expect(countCards(deck.reserveCards!)).toEqual({
      'sd-siltfield-forager': 4,
      'sd-flood-line-survivor': 4,
      'sd-pride-root-warden': 4,
      'sd-furrow-water-tender': 4,
      'sd-silt-field-champion': 4,
      'sd-harvest-tide-keeper': 2,
      'sd-floodgate-warden': 4,
      'sd-deep-flood-behemoth': 4,
      'sd-measure-the-silt': 4,
      'sd-harvest-after-rain': 4,
      'sd-ward-the-floodgate': 2,
    });
  });
});
