import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { DARK_TALES_COMPANION } from '../../src/data/cards/dark-tales-companion';
import { AVATARS } from '../../src/data/opponents';
import { isLiveCollectible } from '../../src/data/liveness';
import { packPool } from '../../src/meta/PackOpener';
import { collectionCompletion, collectionDisplayPool, collectiblePool } from '../../src/meta/collectionFilter';
import { freshSave } from '../../src/meta/SaveManager';
import { convertAvatarDarlings, convertAvatarWarchest } from '../../scripts/avatarReserveDecks';
import { buildDarlingsDeck } from '../../scripts/darlingsDeckBuilder';

const TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;
const companionIds = new Set(DARK_TALES_COMPANION.map((card) => card.id));
const isCompanionId = (id: string): boolean => companionIds.has(id);

describe('Dark Tales companion liveness gate', () => {
  it('keeps all 60 cards out of live pools and builders until enabled', () => {
    const previous = FEATURES.dtCompanionLive;
    const save = freshSave(0);
    try {
      FEATURES.dtCompanionLive = false;

      expect(DARK_TALES_COMPANION.every((card) => !isLiveCollectible(card))).toBe(true);
      const gatedPackIds = TIERS.flatMap((tier) => packPool(CARD_DB, tier, 'dark-tales'));
      expect(gatedPackIds.some(isCompanionId)).toBe(false);
      expect(collectiblePool(ALL_CARDS).some((card) => isCompanionId(card.id))).toBe(false);
      expect(collectionDisplayPool(ALL_CARDS, save).some((card) => isCompanionId(card.id))).toBe(false);

      const gatedCompletion = collectionCompletion(ALL_CARDS, save);
      const noCompanionCompletion = collectionCompletion(
        ALL_CARDS.filter((card) => !isCompanionId(card.id)),
        save,
      );
      expect(gatedCompletion).toEqual(noCompanionCompletion);

      const builderIds = AVATARS.flatMap((avatar) => [
        ...convertAvatarWarchest(avatar),
        ...convertAvatarDarlings(avatar).darlingsDeck,
        ...buildDarlingsDeck(avatar).cards,
      ]);
      expect(builderIds.some(isCompanionId)).toBe(false);

      FEATURES.dtCompanionLive = true;
      const livePackIds = TIERS.flatMap((tier) => packPool(CARD_DB, tier, 'dark-tales'));
      expect(livePackIds.some(isCompanionId)).toBe(true);
      expect(collectionCompletion(ALL_CARDS, save).total).toBe(
        gatedCompletion.total + DARK_TALES_COMPANION.length,
      );
    } finally {
      FEATURES.dtCompanionLive = previous;
    }
  });
});
