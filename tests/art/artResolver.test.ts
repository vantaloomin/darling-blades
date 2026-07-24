import { describe, expect, it } from 'vitest';
import { ArtResolver, landStyleArtKey } from '../../src/art/ArtResolver';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { isBasic } from '../../src/meta/Collection';
import { BASIC_LAND_IDS, LAND_STYLE_IDS } from '../../src/meta/SaveManager';

function resolverWithManifest(keys: readonly string[]): ArtResolver {
  return Object.assign(Object.create(ArtResolver.prototype), {
    db: CARD_DB,
    real: new Set(keys),
    atlas: { get: () => undefined },
  }) as ArtResolver;
}

describe('ArtResolver land styles', () => {
  const basic = ALL_CARDS.find((card) => isBasic(CARD_DB, card.id))!;
  const basicArtKey = basic.artRef ?? basic.id;
  const nonbasic = ALL_CARDS.find((card) => !isBasic(CARD_DB, card.id))!;
  const nonbasicArtKey = nonbasic.artRef ?? nonbasic.id;

  it('keeps the four-style registry complete and uses the styled land-key convention', () => {
    expect(LAND_STYLE_IDS).toEqual(['base', 'ragnarok', 'celtic-fae', 'dark-tales']);
    const keys = BASIC_LAND_IDS.flatMap((basicId) => LAND_STYLE_IDS.map((style) => landStyleArtKey(basicId, style)));
    expect(new Set(keys).size).toBe(BASIC_LAND_IDS.length * LAND_STYLE_IDS.length);
    expect(keys).toContain('land-plains--dark-tales');
    expect(keys).toContain('land-forest--dark-tales');
  });

  it('uses a styled basic-land key only when the manifest contains it', () => {
    const resolver = resolverWithManifest([basicArtKey, `${basicArtKey}--base`]);

    expect(resolver.getArt(basic.id, 'base')).toEqual({
      textureKey: `artfile-${basicArtKey}--base`,
    });
  });

  it('falls back to the default basic-land key when the styled file is absent', () => {
    const resolver = resolverWithManifest([basicArtKey]);

    expect(resolver.getArt(basic.id, 'dark-tales')).toEqual({
      textureKey: `artfile-${basicArtKey}`,
    });
  });

  it('ignores a styled manifest key for a non-basic card', () => {
    const resolver = resolverWithManifest([nonbasicArtKey, `${nonbasicArtKey}--celtic-fae`]);

    expect(resolver.getArt(nonbasic.id, 'celtic-fae')).toEqual({
      textureKey: `artfile-${nonbasicArtKey}`,
    });
  });
});
