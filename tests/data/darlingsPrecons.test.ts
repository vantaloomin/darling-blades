import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import {
  DARLINGS_PRECONS,
  DARLINGS_PRECON_MATRIX_FLEET,
} from '../../src/data/darlingsPrecons';
import { validateDarlingsDeck } from '../../src/meta/darlings';
import { DARLINGS_DECK_SIZE, isDualLand } from '../../src/meta/warchest';
import { deckTargetSupply, hasNoLegalTargets } from '../../scripts/avatarReserveDecks';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';

describe('Darlings precon slate', () => {
  it('keeps all five reviewed singleton lists legal against a full-ownership save', () => {
    const fullOwnership = buildReserveMatrixFullOwnershipSave(CARD_DB);

    expect(DARLINGS_PRECONS.map((deck) => deck.darlingId)).toEqual([
      'tk-wu-zhouyu',
      'rg-hel',
      'cf-aine-sunlit-bargain',
      'gm-elizabeth-blood-mirror',
      'dt-warrior-ballad-captain',
    ]);

    for (const deck of DARLINGS_PRECONS) {
      expect(deck.cards, deck.name).toHaveLength(DARLINGS_DECK_SIZE);
      expect(new Set(deck.cards), deck.name).toHaveLength(DARLINGS_DECK_SIZE);
      expect(deck.cards, deck.name).not.toContain(deck.darlingId);
      expect(deck.landReserve, deck.name).toHaveLength(10);
      expect(
        deck.landReserve.filter((id) => isDualLand(CARD_DB[id])).length,
        deck.name,
      ).toBeLessThanOrEqual(5);
      expect(
        validateDarlingsDeck(CARD_DB, fullOwnership, deck.cards, deck.darlingId, deck.landReserve),
        deck.name,
      ).toEqual([]);
    }
  });

  /**
   * A narrow-target card (artifact/enchantment removal) must be answerable by
   * the deck's OWN board - types plus token creation - because that is the
   * only supply present in every matchup, mirrors included. Sable Warballad
   * shipped Ram the Gates (destroy target ARTIFACT) over zero artifacts: dead
   * 100% in the precon mirror, near-dead vs Zhou Yu's single artifact. Swapped
   * 2026-08-28 for Paper-Ward Signal (same mv and rarity, artifactOrEnchantment,
   * self-live via the deck's four enchantments) with this gate to hold the line.
   */
  it('no precon ships a narrow-target card its own deck cannot answer', () => {
    for (const deck of DARLINGS_PRECONS) {
      const list = [...deck.cards, deck.darlingId];
      const supply = deckTargetSupply(list);
      const dead = list.filter((id) => hasNoLegalTargets(CARD_DB[id], supply));
      expect(dead, `${deck.name} carries dead-target cards`).toEqual([]);
    }
  });

  it('exports the curated lists in the reserve-matrix deck shape', () => {
    expect(DARLINGS_PRECON_MATRIX_FLEET).toBe(DARLINGS_PRECONS);
    for (const deck of DARLINGS_PRECON_MATRIX_FLEET) {
      expect(deck).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        darlingId: expect.any(String),
        cards: expect.any(Array),
        landReserve: expect.any(Array),
      });
    }
  });
});
