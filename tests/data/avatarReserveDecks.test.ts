import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
  DARLINGS_DECK_SIZE,
} from '../../src/meta/warchest';
import { convertAvatarReserveDecks } from '../../scripts/avatarReserveDecks';
import { buildDarlingsDeck } from '../../scripts/darlingsDeckBuilder';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';
import { runAvatarReserveMatrix } from '../../scripts/balance-matrix';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

describe('avatar reserve-native deck data (1.6 migration stage 2)', () => {
  for (const avatar of AVATARS) {
    it(`${avatar.id}: reserveDeck, landReserve, and darlingsDeck are shipping-legal`, () => {
      expect(avatar.reserveDeck).toHaveLength(WARCHEST_DECK_SIZE);
      expect(validateWarchestDeck(CARD_DB, save, avatar.reserveDeck, avatar.landReserve)).toEqual([]);
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

  /*
   * Avatars whose reserve data has been hand-tuned away from the scripted
   * first cut, with the dated reason. Each entry is a deliberate divergence;
   * the legality tests above still cover them in full.
   *   morgan — 2026-08-08 pass 2, RETAINED 2026-08-09: reshaped a flat mv3
   *   pile (only 2 cards below mv3, four 6-drops) into a real curve, 32% ->
   *   48%. Re-measured against the quality-led builder and kept, 52% to 46%.
   *   hel — 2026-08-09 ARCHETYPE REPAIR. Her first hand-tune was dropped when
   *   the builder beat it 33% to 21%, but the builder cannot fix her: its
   *   curve cap deletes the expensive payoffs a reanimator exists to cheat
   *   into play, so it is archetype-blind here. This build gives the engine
   *   real targets (Siege Juggernaut, Bronze Colossus). See opponents.ts.
   *
   * Hand tuning only earns an exception while it still measures better than
   * the builder; both entries above were re-tested under that rule.
   */
  // 2026-08-22 Dark Tales companion balance touch: only rung 17 kept its
  // hand-tuned adoption. Measured at 40 seeds/cell over 12 columns, the
  // builder baseline vs the hand tune: R17 76% -> 79% (floor 70.5, KEPT);
  // R18 86% -> 61% -> 66% -> 73% over two allowed iterations (floor 77.5,
  // REVERTED); R19 60% -> 55% -> 55% -> 51% (floor 55.5, REVERTED). The
  // exemption rule is unchanged: a hand tune only holds while it still
  // measures better than the builder, and the flip re-tests R17 against the
  // gate-open builder.
  const HAND_TUNED_WARCHEST = new Set(['morgan', 'hel', 'glass-coffin-queen']);

  it('untuned committed data IS the deterministic converter output', () => {
    // Card-content identity, order-insensitive: the committed literals group
    // duplicates via expand() while the converter emits raw append order, and
    // list order only feeds the seeded shuffle.
    const sorted = (cards: readonly string[]): string[] => [...cards].sort();
    for (const avatar of AVATARS) {
      const first = convertAvatarReserveDecks(avatar);
      const second = convertAvatarReserveDecks(avatar);
      expect(first, `${avatar.id} converter is not deterministic`).toEqual(second);
      expect(sorted(first.landReserve)).toEqual(sorted(avatar.landReserve));
      if (HAND_TUNED_WARCHEST.has(avatar.id)) {
        // 2026-08-21 live-pool pin: Morgan and Hel retain their hand-tuned
        // reserve literals, including their authored Darlings lists.
        expect(sorted(first.reserveDeck), `${avatar.id} is listed as hand-tuned but matches the first cut`)
          .not.toEqual(sorted(avatar.reserveDeck));
        continue;
      }
      // darlingsDeck is now authored by the themed builder, not the stage-2
      // converter: the converter's colour-and-curve fill left 67-71 of 79
      // cards as generic filler and measured 26-31% against the shop precons.
      expect(sorted(buildDarlingsDeck(avatar).cards)).toEqual(sorted(avatar.darlingsDeck));
      expect(first.darlingId).toEqual(avatar.darlingId);
      expect(sorted(first.reserveDeck)).toEqual(sorted(avatar.reserveDeck));
    }
  });

  it('both reserve avatar matrix modes construct and play a seeded game', () => {
    const only = [AVATARS[0].id];
    const warchest = runAvatarReserveMatrix('warchest', 1, only);
    expect(warchest.rows).toHaveLength(1);
    expect(warchest.table).toContain('reserve starters');
    const darlings = runAvatarReserveMatrix('darlings', 1, only);
    expect(darlings.rows).toHaveLength(1);
  });
});
