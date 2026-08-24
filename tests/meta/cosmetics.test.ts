import { describe, expect, it } from 'vitest';
import {
  CARD_BACKS,
  COSMETIC_CATALOG,
  DEFAULT_CARD_BACK_ID,
  DEFAULT_PLAYMAT_ID,
  PLAYMATS,
  cardBackTextureKey,
  cosmeticById,
  isCosmeticOwned,
  playmatForId,
} from '../../src/meta/cosmetics';

describe('cosmetics catalog', () => {
  it('ships the v1 card-back and playmat catalog as default-unlock cosmetics', () => {
    expect(CARD_BACKS).toHaveLength(5);
    expect(PLAYMATS).toHaveLength(5);
    expect(COSMETIC_CATALOG).toHaveLength(10);
    expect(new Set(COSMETIC_CATALOG.map((entry) => entry.id)).size).toBe(COSMETIC_CATALOG.length);
    expect(COSMETIC_CATALOG.every((entry) => entry.unlock === 'default')).toBe(true);
    expect(COSMETIC_CATALOG.every((entry) => !entry.name.includes('—') && !entry.blurb.includes('—'))).toBe(true);
    expect(COSMETIC_CATALOG.every((entry) => !/isn't just/i.test(`${entry.name} ${entry.blurb}`))).toBe(true);
  });

  it('keeps the default texture and equipment policy canonical', () => {
    expect(cardBackTextureKey(null)).toBe('cardback');
    expect(cardBackTextureKey(DEFAULT_CARD_BACK_ID)).toBe('cardback');
    expect(cardBackTextureKey(CARD_BACKS[1].id)).toBe(`cardback-${CARD_BACKS[1].id}`);
    expect(cardBackTextureKey('junk')).toBe('cardback');
    expect(isCosmeticOwned(DEFAULT_CARD_BACK_ID, [])).toBe(true);
    expect(isCosmeticOwned(PLAYMATS[1].id, [])).toBe(true);
    expect(isCosmeticOwned('junk', [])).toBe(false);
    expect(cosmeticById(DEFAULT_PLAYMAT_ID)?.name).toBe('Violet Stage');
    expect(playmatForId('junk').id).toBe(DEFAULT_PLAYMAT_ID);
    expect(playmatForId(null).colors.backdrop).toEqual({
      tint: 0x0a0812,
      alpha: 0.45,
      fallbackTop: 0x131022,
      fallbackBottom: 0x0a0812,
    });
  });
});
