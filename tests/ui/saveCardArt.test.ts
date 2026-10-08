import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ART_LOADING_TEXTURE, Art, ArtResolver } from '../../src/art/ArtResolver';
import { ArtQueue, setArtLoader, setArtStore, type ArtBatchSink } from '../../src/art/artLoader';
import { CARD_DB } from '../../src/data/catalog';
import { composeSaveCardCanvas, composeSaveCardCanvasAsync, saveCardArtStillLoading } from '../../src/ui/saveCard';
import { makeStore, type Harness } from '../art/artStoreFakes';

/**
 * A save card bakes the chosen card's art into the exported PNG. The art
 * resolver answers with a flat loading stand-in while a file has not landed
 * (and for good when a file failed to load), and that stand-in must never ship
 * inside a save card: the export reports the art as unavailable instead, and
 * tells a file still in the loader's queue (wait a moment) from one the loader
 * gave up on (pick another card).
 */

const CARD_ID = 'dd-watch-sergeant';
const REAL_TEXTURE = `artfile-${CARD_DB[CARD_ID].artRef ?? CARD_ID}`;
const LINES = { identity: '12% collection', date: 'Exported 2026-09-28' };
/** The scene the export reads textures from (typed without importing Phaser). */
type Scene = Parameters<typeof composeSaveCardCanvas>[0];

/** The pixels each texture draws from, so a test can see what was baked. */
const SOURCES: Record<string, { name: string }> = {
  [REAL_TEXTURE]: { name: 'real art' },
  [ART_LOADING_TEXTURE]: { name: 'loading stand-in' },
};

function sceneWith(loaded: readonly string[]): Scene {
  const textures = {
    exists: (key: string) => loaded.includes(key),
    get: (key: string) => ({
      key: loaded.includes(key) ? key : '__MISSING',
      get: () => ({ cutX: 0, cutY: 0, cutWidth: 640, cutHeight: 800, source: { image: SOURCES[key] } }),
    }),
  };
  return { textures } as unknown as Scene;
}

/** A resolver that knows the card has a real art file, over the given scene. */
function resolverFor(scene: Scene): ArtResolver {
  return Object.assign(Object.create(ArtResolver.prototype), {
    scene,
    db: CARD_DB,
    real: new Set([CARD_DB[CARD_ID].artRef ?? CARD_ID]),
    atlas: { get: () => undefined },
  }) as ArtResolver;
}

let baked: unknown[] = [];

beforeEach(() => {
  baked = [];
  const context = new Proxy(
    { drawImage: (source: unknown) => baked.push(source) } as Record<string, unknown>,
    { get: (target, prop) => (prop in target ? target[prop as string] : () => ({ addColorStop: () => {} })) },
  );
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Art.resolver = null;
  setArtLoader(null);
  setArtStore(null);
});

/** The live loader, with this card's file in its queue and a sink that decides its fate. */
function loaderWhoseSink(load: ArtBatchSink['load']): void {
  const queue = new ArtQueue({ order: [CARD_DB[CARD_ID].artRef ?? CARD_ID], sink: { load } });
  setArtLoader(queue);
  queue.start();
}

describe('the art baked into a save card', () => {
  it('is the real art once it has loaded', () => {
    const scene = sceneWith([REAL_TEXTURE, ART_LOADING_TEXTURE]);
    Art.resolver = resolverFor(scene);

    expect(composeSaveCardCanvas(scene, CARD_ID, LINES)).not.toBeNull();
    expect(baked).toEqual([SOURCES[REAL_TEXTURE]]);
  });

  it('is never the loading stand-in: the export reports the art as unavailable', () => {
    const scene = sceneWith([ART_LOADING_TEXTURE]);
    Art.resolver = resolverFor(scene);

    expect(composeSaveCardCanvas(scene, CARD_ID, LINES)).toBeNull();
    expect(baked).toEqual([]);
  });
});

describe('why a save card could not be made', () => {
  it('is "still loading" while the file is in the loader queue', () => {
    Art.resolver = resolverFor(sceneWith([ART_LOADING_TEXTURE]));
    loaderWhoseSink(() => {}); // requested, never answered yet

    expect(saveCardArtStillLoading(CARD_ID)).toBe(true);
  });

  it('is not "still loading" once the loader gave up on the file', () => {
    Art.resolver = resolverFor(sceneWith([ART_LOADING_TEXTURE]));
    loaderWhoseSink((_files, hooks) => hooks.onDone()); // the batch settled without the file

    expect(saveCardArtStillLoading(CARD_ID)).toBe(false);
  });

  it('is not "still loading" when the art is in', () => {
    Art.resolver = resolverFor(sceneWith([REAL_TEXTURE, ART_LOADING_TEXTURE]));
    loaderWhoseSink((files, hooks) => {
      for (const file of files) hooks.onFile(file.id);
      hooks.onDone();
    });

    expect(saveCardArtStillLoading(CARD_ID)).toBe(false);
  });
});

/**
 * While art streams through the art store, a texture's decoded copy is closed
 * right after upload (docs/plan-art-streaming.md section 1), so the export
 * must not read pixels back from a texture: it reads the file's bytes from the
 * store and decodes a copy of its own, which it closes. It reads the file
 * once, and leaves nothing pinned behind it.
 */
describe('a save card while art streams through the store', () => {
  const ART_KEY = CARD_DB[CARD_ID].artRef ?? CARD_ID;

  /** A store that knows the card's art file, and a decoder that records what it made. */
  function streaming(): { h: Harness; decoded: { width: number; height: number; closed: boolean }[] } {
    const h = makeStore({ keyFor: (id) => CARD_DB[id]?.artRef ?? id }, [ART_KEY]);
    h.source.auto = true;
    setArtStore(h.store);
    const decoded: { width: number; height: number; closed: boolean }[] = [];
    vi.stubGlobal('createImageBitmap', async () => {
      const bitmap = { width: 640, height: 800, closed: false, close: () => (bitmap.closed = true) };
      decoded.push(bitmap);
      return bitmap;
    });
    return { h, decoded };
  }

  it('bakes its own decode of the file, never the texture, and closes it', async () => {
    const { h, decoded } = streaming();
    const scene = sceneWith([REAL_TEXTURE, ART_LOADING_TEXTURE]);
    Art.resolver = resolverFor(scene);

    expect(await composeSaveCardCanvasAsync(scene, CARD_ID, LINES)).not.toBeNull();
    expect(baked).toEqual([decoded[0]]);
    expect(decoded[0].closed).toBe(true);
    expect(h.source.keys).toEqual([ART_KEY]);
    expect(h.store.leaseReport()).toEqual([]);
  });

  it('reports the art as unavailable when the file cannot be read, and leaves nothing pinned', async () => {
    const { h } = streaming();
    h.source.auto = false;
    const scene = sceneWith([ART_LOADING_TEXTURE]);
    Art.resolver = resolverFor(scene);

    const pending = composeSaveCardCanvasAsync(scene, CARD_ID, LINES);
    await vi.waitFor(() => expect(h.source.open.length).toBeGreaterThan(0));
    for (const read of h.source.open) read.reject('failed');
    expect(await pending).toBeNull();
    expect(baked).toEqual([]);
    expect(h.store.leaseReport()).toEqual([]);
  });
});
