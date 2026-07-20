import { describe, expect, it } from 'vitest';
import { ArtResolver } from '../../src/art/ArtResolver';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { isBasic } from '../../src/meta/Collection';

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

  it('uses a styled basic-land key only when the manifest contains it', () => {
    const resolver = resolverWithManifest([basicArtKey, `${basicArtKey}--base`]);

    expect(resolver.getArt(basic.id, 'base')).toEqual({
      textureKey: `artfile-${basicArtKey}--base`,
    });
  });

  it('falls back to the default basic-land key when the styled file is absent', () => {
    const resolver = resolverWithManifest([basicArtKey]);

    expect(resolver.getArt(basic.id, 'ragnarok')).toEqual({
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
