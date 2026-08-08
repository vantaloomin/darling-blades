import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import {
  hasLandFetchBehavior,
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
  DARLINGS_DECK_SIZE,
} from '../../src/meta/warchest';
import { convertAvatarReserveDecks } from '../../scripts/avatarReserveDecks';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';
import { runAvatarReserveMatrix } from '../../scripts/balance-matrix';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

describe('avatar reserve-native deck data (1.6 migration stage 2)', () => {
  for (const avatar of AVATARS) {
    it(`${avatar.id}: reserveDeck, landReserve, and darlingsDeck are shipping-legal`, () => {
      expect(avatar.reserveDeck).toHaveLength(WARCHEST_DECK_SIZE);
      expect(validateWarchestDeck(CARD_DB, save, avatar.reserveDeck, avatar.landReserve)).toEqual([]);
      for (const id of avatar.reserveDeck) {
        expect(hasLandFetchBehavior(CARD_DB[id]), `${id} fetches lands`).toBe(false);
      }

      expect(avatar.landReserve).toHaveLength(LAND_RESERVE_SIZE);
      const duals = avatar.landReserve.filter((id) => isDualLand(CARD_DB[id]));
      expect(duals.length).toBeLessThanOrEqual(MAX_DUAL_LANDS);
      for (const id of avatar.landReserve) {
        const card = CARD_DB[id];
        expect(isBasicLand(card) || isDualLand(card), `${id} is not a basic or dual`).toBe(true);
      }

      expect(avatar.darlingsDeck).toHaveLength(DARLINGS_DECK_SIZE);
      expect(
        validateDarlingsDeck(CARD_DB, save, avatar.darlingsDeck, avatar.darlingId, avatar.landReserve),
      ).toEqual([]);

      // Portraits cost zero new art: the classic idiom carries over. The
      // portrait card leads the Warchest list (or IS the Darling).
      expect(
        avatar.reserveDeck.includes(avatar.portraitCardId) || avatar.darlingId === avatar.portraitCardId,
        `${avatar.id} portrait ${avatar.portraitCardId} missing from reserveDeck`,
      ).toBe(true);
    });
  }

  it('the committed data IS the deterministic converter output', () => {
    // Card-content identity, order-insensitive: the committed literals group
    // duplicates via expand() while the converter emits raw append order, and
    // list order only feeds the seeded shuffle. Hand-tuning edits will break
    // this identity deliberately; when that happens, replace this test with a
    // dated divergence note per the opponents.ts balance-record convention.
    const sorted = (cards: readonly string[]): string[] => [...cards].sort();
    for (const avatar of AVATARS) {
      const first = convertAvatarReserveDecks(avatar);
      const second = convertAvatarReserveDecks(avatar);
      expect(first).toEqual(second);
      expect(sorted(first.reserveDeck)).toEqual(sorted(avatar.reserveDeck));
      expect(sorted(first.landReserve)).toEqual(sorted(avatar.landReserve));
      expect(sorted(first.darlingsDeck)).toEqual(sorted(avatar.darlingsDeck));
      expect(first.darlingId).toEqual(avatar.darlingId);
    }
  });

  it('both reserve avatar matrix modes construct and play a seeded game', () => {
    const only = [AVATARS[0].id];
    const warchest = runAvatarReserveMatrix('warchest', 1, only);
    expect(warchest.rows).toHaveLength(1);
    expect(warchest.table).toContain('PROXY');
    const darlings = runAvatarReserveMatrix('darlings', 1, only);
    expect(darlings.rows).toHaveLength(1);
  });
});
