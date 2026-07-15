import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { DECK_INFO } from '../../src/data/deckInfo';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';

const SHOP_DECKS = [...STARTER_DECKS, ...THEME_DECKS];

describe('shop deck presentation data', () => {
  it('covers every starter and theme deck SKU', () => {
    for (const deck of SHOP_DECKS) {
      expect(DECK_INFO[deck.id], `${deck.id} needs DECK_INFO`).toBeDefined();
    }
  });

  it('features two or three real cards from each deck with rarity data', () => {
    for (const deck of SHOP_DECKS) {
      const featured = DECK_INFO[deck.id]?.featured ?? [];
      expect(featured.length, `${deck.id} featured count`).toBeGreaterThanOrEqual(2);
      expect(featured.length, `${deck.id} featured count`).toBeLessThanOrEqual(3);
      expect(new Set(featured).size, `${deck.id} featured ids should be unique`).toBe(featured.length);

      for (const id of featured) {
        expect(deck.cards, `${deck.id} must contain featured card ${id}`).toContain(id);
        expect(CARD_DB[id], `${id} must exist in CARD_DB`).toBeDefined();
        expect(CARD_DB[id]?.rarity, `${id} needs rarity data`).toMatch(/^(c|r|sr|ssr|ur)$/);
      }
    }
  });
});
