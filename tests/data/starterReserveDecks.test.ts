import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { validateWarchestDeck } from '../../src/meta/darlings';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
} from '../../src/meta/warchest';
import { convertAvatarWarchest, deriveLandReserve } from '../../scripts/avatarReserveDecks';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

describe('reserve-native starter builds (1.6 migration)', () => {
  for (const starter of STARTER_DECKS) {
    it(`${starter.id}: the reserve build is shipping-legal`, () => {
      const { reserveCards, landReserve } = starter;
      expect(reserveCards, `${starter.id} has no reserve build`).toBeDefined();
      expect(landReserve, `${starter.id} has no land reserve`).toBeDefined();
      expect(reserveCards).toHaveLength(WARCHEST_DECK_SIZE);
      expect(validateWarchestDeck(CARD_DB, save, reserveCards!, landReserve!)).toEqual([]);
      expect(landReserve).toHaveLength(LAND_RESERVE_SIZE);
      expect(landReserve!.filter((id) => isDualLand(CARD_DB[id])).length).toBeLessThanOrEqual(MAX_DUAL_LANDS);
      for (const id of landReserve!) {
        expect(isBasicLand(CARD_DB[id]) || isDualLand(CARD_DB[id]), `${id} is not a basic or dual`).toBe(true);
      }
    });
  }

  it('reserve builds keep each starter inside its own printed colors', () => {
    for (const starter of STARTER_DECKS) {
      const classicColors = new Set(
        starter.cards.flatMap((id) => (CARD_DB[id]?.types.includes('land') ? [] : CARD_DB[id]?.colors ?? [])),
      );
      for (const id of starter.reserveCards!) {
        for (const color of CARD_DB[id]?.colors ?? []) {
          expect(classicColors.has(color), `${starter.id} reserve card ${id} adds off-color ${color}`).toBe(true);
        }
      }
    }
  });

  it('is the deterministic converter output', () => {
    const sorted = (cards: readonly string[]): string[] => [...cards].sort();
    for (const starter of STARTER_DECKS) {
      const source = { id: starter.id, name: starter.name, deck: starter.cards };
      expect(sorted(convertAvatarWarchest(source))).toEqual(sorted(starter.reserveCards!));
      expect(sorted(deriveLandReserve(source))).toEqual(sorted(starter.landReserve!));
    }
  });

  it('gives theme decks reserve builds too (2026-08-08: they are the extra ladder columns)', () => {
    for (const theme of THEME_DECKS) {
      expect(theme.reserveCards, `${theme.id} has no reserve build`).toHaveLength(WARCHEST_DECK_SIZE);
      expect(validateWarchestDeck(CARD_DB, save, theme.reserveCards!, theme.landReserve!)).toEqual([]);
    }
  });
});
