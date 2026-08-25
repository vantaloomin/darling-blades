import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { SANDS_OF_THE_DUAT } from '../../src/data/cards/sands-of-the-duat';
import { AVATARS } from '../../src/data/opponents';
import { packPool } from '../../src/meta/PackOpener';
import { collectionCompletion, collectionDisplayPool, collectiblePool } from '../../src/meta/collectionFilter';
import { freshSave } from '../../src/meta/SaveManager';
import { convertAvatarDarlings, convertAvatarWarchest } from '../../scripts/avatarReserveDecks';
import { buildDarlingsDeck } from '../../scripts/darlingsDeckBuilder';

const TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;
const isDuatId = (id: string): boolean => id.startsWith('sd-');

describe('Sands of the Duat liveness gate', () => {
  it('keeps Wave A out of live pools and exposes it only when enabled', () => {
    const previous = FEATURES.duatLive;
    const save = freshSave(0);
    try {
      FEATURES.duatLive = false;

      const gatedPackIds = TIERS.flatMap((tier) => packPool(CARD_DB, tier));
      expect(gatedPackIds.some(isDuatId)).toBe(false);
      expect(collectiblePool(ALL_CARDS).some((card) => isDuatId(card.id))).toBe(false);
      expect(collectionDisplayPool(ALL_CARDS, save).some((card) => isDuatId(card.id))).toBe(false);

      const gatedCompletion = collectionCompletion(ALL_CARDS, save);
      const noDuatCompletion = collectionCompletion(
        ALL_CARDS.filter((card) => !isDuatId(card.id)),
        save,
      );
      expect(gatedCompletion).toEqual(noDuatCompletion);

      const builderIds = AVATARS.flatMap((avatar) => [
        ...convertAvatarWarchest(avatar),
        ...convertAvatarDarlings(avatar).darlingsDeck,
        ...buildDarlingsDeck(avatar).cards,
      ]);
      expect(builderIds.some(isDuatId)).toBe(false);

      FEATURES.duatLive = true;
      const livePackIds = TIERS.flatMap((tier) => packPool(CARD_DB, tier));
      expect(livePackIds.some(isDuatId)).toBe(true);
      // Waves A through D3 live booster counts, including the five common
      // duals. D3 appends 58 mono-column cards after the explicit multicolor
      // tier reconciliation, bringing the live Duat pool to its 245-card
      // frame.
      const liveDuatByTier = Object.fromEntries(
        TIERS.map((tier) => [tier, packPool(CARD_DB, tier).filter(isDuatId).length]),
      );
      expect(liveDuatByTier).toEqual({ c: 122, r: 74, sr: 23, ssr: 16, ur: 10 });
      expect(collectionCompletion(ALL_CARDS, save).total).toBe(
        gatedCompletion.total + SANDS_OF_THE_DUAT.length,
      );
    } finally {
      FEATURES.duatLive = previous;
    }
  });
});

/**
 * The graveyard modal gives a tile ONE action chip. A card carrying both
 * Retell and Preserve would silently lose the Preserve chip, which is exactly
 * the failure that hid Preserve entirely until 2026-08-25 (the engine offered
 * `preserveCard`, the AI took it, and no UI ever did). If this fails, the
 * modal needs a second action slot, not a re-shuffled precedence.
 */
describe('graveyard actions stay reachable', () => {
  it('has no card carrying both Retell and Preserve', () => {
    const both = ALL_CARDS.filter((card) => card.retell !== undefined && card.preserve !== undefined);
    expect(both.map((card) => card.id)).toEqual([]);
  });

  it('still has Preserve cards to reach', () => {
    expect(ALL_CARDS.filter((card) => card.preserve !== undefined).length).toBeGreaterThan(0);
  });
});
