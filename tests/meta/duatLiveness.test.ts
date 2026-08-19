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
      // Wave A + Wave B live booster counts, including the five common duals.
      const liveDuatByTier = Object.fromEntries(
        TIERS.map((tier) => [tier, packPool(CARD_DB, tier).filter(isDuatId).length]),
      );
      expect(liveDuatByTier).toEqual({ c: 25, r: 9, sr: 6, ssr: 5, ur: 6 });
      expect(collectionCompletion(ALL_CARDS, save).total).toBe(
        gatedCompletion.total + SANDS_OF_THE_DUAT.length,
      );
    } finally {
      FEATURES.duatLive = previous;
    }
  });
});
