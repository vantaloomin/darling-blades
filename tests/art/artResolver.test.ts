import { afterEach, describe, expect, it } from 'vitest';
import { ART_LOADING_TEXTURE, ArtResolver, landStyleArtKey } from '../../src/art/ArtResolver';
import { setArtStore } from '../../src/art/artLoader';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { isBasic } from '../../src/meta/Collection';
import { BASIC_LAND_IDS, LAND_STYLE_IDS } from '../../src/meta/SaveManager';
import { makeStore } from './artStoreFakes';

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

describe('ArtResolver while card art is still streaming in', () => {
  const card = ALL_CARDS.find((c) => !isBasic(CARD_DB, c.id))!;
  const artKey = card.artRef ?? card.id;
  const fileTexture = `artfile-${artKey}`;

  /** A resolver over a texture manager that holds exactly `present`. */
  function resolverWithTextures(present: Set<string>): ArtResolver {
    return Object.assign(Object.create(ArtResolver.prototype), {
      db: CARD_DB,
      real: new Set([artKey]),
      atlas: { get: () => undefined },
      scene: { textures: { exists: (key: string) => present.has(key) } },
    }) as ArtResolver;
  }

  it('hands out the stand-in and names the texture that will replace it', () => {
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: fileTexture });
  });

  it('still names the awaited texture when there is no stand-in to draw', () => {
    const resolver = resolverWithTextures(new Set());
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: fileTexture, pending: fileTexture });
  });

  it('hands out the real texture with nothing pending once the file has landed', () => {
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, fileTexture]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: fileTexture });
  });
});

describe('ArtResolver: the best resident texture while art streams through the store', () => {
  const card = ALL_CARDS.find((c) => !isBasic(CARD_DB, c.id) && c.artRef === undefined)!;
  const full = `artfile-${card.id}`;
  const half = `arthalf-${card.id}`;

  function resolverWithTextures(present: Set<string>): ArtResolver {
    return Object.assign(Object.create(ArtResolver.prototype), {
      db: CARD_DB,
      real: new Set([card.id]),
      atlas: { get: () => undefined },
      scene: { textures: { exists: (key: string) => present.has(key) } },
    }) as ArtResolver;
  }

  function withStore(quality: 'full' | 'lite', hasHalf = true): void {
    setArtStore(makeStore({ quality, hasHalf: () => hasHalf, keyFor: (id) => id }, [card.id]).store);
  }

  afterEach(() => setArtStore(null));

  it('draws the full texture once it is resident, whatever else is', () => {
    withStore('full');
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, half, full]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: full });
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: full });
  });

  it('draws the resident half texture on desktop while the full one is on its way', () => {
    withStore('full');
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, half]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: half, pending: full });
  });

  it('gives a thumbnail bake the half texture as final, not as a stand-in', () => {
    withStore('full');
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, half]));
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: half });
  });

  it('waits for the texture each tier asks for when nothing is resident', () => {
    withStore('full');
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: half });
  });

  it('waits for the full file on both tiers for a key with no half file', () => {
    withStore('full', false);
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE]));
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
  });

  it('never names a separate half texture on lite, where the primary texture is the half file', () => {
    withStore('lite');
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, half]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
  });

  it('answers both tiers as the primary one with the 1.8 queue (no store)', () => {
    const resolver = resolverWithTextures(new Set([ART_LOADING_TEXTURE, half]));
    expect(resolver.getArt(card.id)).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
    expect(resolver.getArt(card.id, undefined, 'half')).toStrictEqual({ textureKey: ART_LOADING_TEXTURE, pending: full });
  });
});
