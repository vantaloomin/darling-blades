import { afterEach, describe, expect, it } from 'vitest';
import { ART_LOADING_TEXTURE, ArtResolver } from '../../src/art/ArtResolver';
import { setArtStore } from '../../src/art/artLoader';
import type { ArtTextureSink } from '../../src/art/artStore';
import { holdArt, onArtTextureRemoved } from '../../src/art/artWatch';
import { CARD_DB } from '../../src/data/catalog';
import { FULL_BYTES, makeStore, type Harness } from './artStoreFakes';

/**
 * `holdArt` (1.9 lane D, S3; docs/plan-art-streaming.md sections 3 and 4):
 * what a view calls after it draws the resolver's answer. It pins what the
 * view draws, asks for what it waits on, redraws the view when better art
 * lands, and re-applies it in the same tick its texture is removed (the
 * removal belt). Driven here over hand-made stand-ins for Phaser's texture
 * manager, a scene and a game object: tests never import Phaser.
 */

type Listener = (...args: unknown[]) => void;

class Emitter {
  private readonly listeners = new Map<string, { fn: Listener; once: boolean }[]>();
  on(event: string, fn: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), { fn, once: false }]);
    return this;
  }
  once(event: string, fn: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), { fn, once: true }]);
    return this;
  }
  off(event: string, fn: Listener): this {
    const kept = (this.listeners.get(event) ?? []).filter((entry) => entry.fn !== fn);
    this.listeners.set(event, kept);
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    const entries = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      entries.filter((entry) => !entry.once),
    );
    for (const entry of entries) entry.fn(...args);
  }
}

/** The texture manager: `addtexture` / `removetexture` fire after the change, as Phaser's do. */
class FakeTextures extends Emitter {
  readonly keys = new Set<string>([ART_LOADING_TEXTURE]);
  exists(key: string): boolean {
    return this.keys.has(key);
  }
  add(key: string): void {
    this.keys.add(key);
    this.emit('addtexture', key);
  }
  remove(key: string): void {
    if (!this.keys.delete(key)) return;
    this.emit('removetexture', key);
  }
}

class FakeScene {
  readonly events = new Emitter();
  constructor(readonly textures: FakeTextures) {}
}

/**
 * A view in the shape of CardView's `applyArt`: resolve, draw, hold. `drawn`
 * is the texture it shows; `draws` counts how often it drew.
 */
class FakeView extends Emitter {
  active = true;
  drawn = '';
  draws = 0;
  private cancel: (() => void) | null = null;
  constructor(
    readonly scene: FakeScene,
    private readonly resolver: ArtResolver,
    private readonly cardId: string,
  ) {
    super();
  }
  applyArt(): void {
    const ref = this.resolver.getArt(this.cardId);
    this.drawn = ref.textureKey;
    this.draws++;
    this.cancel?.();
    this.cancel = holdArt(this as never, ref, () => this.applyArt());
  }
  release(): void {
    this.cancel?.();
  }
  destroy(): void {
    this.active = false;
    this.emit('destroy');
  }
}

/** Manifest keys that are also card ids with no `artRef`, so the resolver maps them to themselves. */
const [A, B, C] = Object.values(CARD_DB)
  .filter((card) => card.artRef === undefined && !card.token)
  .slice(0, 3)
  .map((card) => card.id);

function resolverOver(textures: FakeTextures): ArtResolver {
  return Object.assign(Object.create(ArtResolver.prototype), {
    db: CARD_DB,
    real: new Set([A, B, C]),
    atlas: { get: () => undefined },
    scene: { textures },
  }) as ArtResolver;
}

/**
 * A store over the fake texture manager, wired the way the art shell
 * (`ArtLoaderScene`) wires Phaser's: the sink's add fires the manager's
 * `addtexture` inside it, as `addImage` does, and removals fire
 * `removetexture`.
 */
function storeOver(textures: FakeTextures, budgetBytes: number): Harness {
  const sink: ArtTextureSink = {
    keepsSource: false,
    exists: (key) => textures.exists(key),
    add: (key) => {
      textures.add(key);
      return true;
    },
    remove: (key) => textures.remove(key),
  };
  const harness = makeStore({ sink, budgetBytes, keyFor: (id) => id }, [A, B, C]);
  setArtStore(harness.store);
  return harness;
}

/** Answer every open read and run frames until the store is idle. */
async function settle(h: Harness): Promise<void> {
  for (let i = 0; i < 20; i++) {
    for (const read of h.source.open) read.resolve();
    await h.tick();
    const stats = h.store.stats();
    if (stats.inFlight === 0 && stats.uploadsPending === 0 && stats.queued === 0 && h.source.open.length === 0) return;
  }
}

afterEach(() => setArtStore(null));

describe('holdArt with the 1.8 queue (no store)', () => {
  it('redraws a view that drew the stand-in once, when its texture lands', () => {
    const textures = new FakeTextures();
    const view = new FakeView(new FakeScene(textures), resolverOver(textures), A);
    view.applyArt();
    expect(view.drawn).toBe(ART_LOADING_TEXTURE);

    textures.add(`artfile-${A}`);
    expect(view.drawn).toBe(`artfile-${A}`);
    expect(view.draws).toBe(2);

    textures.remove(`artfile-${A}`);
    textures.add(`artfile-${A}`);
    expect(view.draws).toBe(4);
  });

  it('re-applies a view in the same tick its texture is removed, before any removal hook runs', () => {
    const textures = new FakeTextures();
    textures.keys.add(`artfile-${A}`);
    const view = new FakeView(new FakeScene(textures), resolverOver(textures), A);
    view.applyArt();
    const seenByHook: string[] = [];
    onArtTextureRemoved(textures as never, () => seenByHook.push(view.drawn));

    textures.remove(`artfile-${A}`);
    expect(view.drawn).toBe(ART_LOADING_TEXTURE);
    expect(seenByHook).toEqual([ART_LOADING_TEXTURE]);
  });

  it('never re-applies a view that was destroyed, released, or whose scene shut down', () => {
    const textures = new FakeTextures();
    const scene = new FakeScene(textures);
    const destroyed = new FakeView(scene, resolverOver(textures), A);
    const released = new FakeView(scene, resolverOver(textures), B);
    const shutDown = new FakeView(new FakeScene(textures), resolverOver(textures), C);
    for (const view of [destroyed, released, shutDown]) view.applyArt();

    destroyed.destroy();
    released.release();
    shutDown.scene.events.emit('shutdown');
    for (const id of [A, B, C]) textures.add(`artfile-${id}`);

    expect([destroyed.draws, released.draws, shutDown.draws]).toEqual([1, 1, 1]);
  });
});

describe('holdArt with the art store', () => {
  it('asks for the texture a view waits on, and redraws the view when it lands', async () => {
    const textures = new FakeTextures();
    const h = storeOver(textures, 100 * FULL_BYTES);
    const view = new FakeView(new FakeScene(textures), resolverOver(textures), A);
    view.applyArt();
    expect(h.source.keys).toEqual([A]);

    await settle(h);
    expect(view.drawn).toBe(`artfile-${A}`);
  });

  it('keeps what a view holds through eviction, and lets it go once the view is gone', async () => {
    const textures = new FakeTextures();
    const h = storeOver(textures, FULL_BYTES);
    const view = new FakeView(new FakeScene(textures), resolverOver(textures), A);
    view.applyArt();
    await settle(h);
    const other = h.store.prefetch([B], { priority: 'now' });
    await settle(h);
    other();

    h.clock.t += 10_000;
    h.store.frame();
    expect(textures.exists(`artfile-${A}`)).toBe(true);
    expect(textures.exists(`artfile-${B}`)).toBe(false);

    view.destroy();
    h.clock.t += 10_000;
    h.store.touch([]);
    const third = h.store.prefetch([C], { priority: 'now' });
    await settle(h);
    third();
    h.clock.t += 10_000;
    h.store.frame();
    expect(textures.exists(`artfile-${A}`)).toBe(false);
  });

  it('puts every holder back on the stand-in at a context restore and redraws it when the pinned set reloads', async () => {
    const textures = new FakeTextures();
    const h = storeOver(textures, 100 * FULL_BYTES);
    const scene = new FakeScene(textures);
    const views = [A, B].map((id) => new FakeView(scene, resolverOver(textures), id));
    for (const view of views) view.applyArt();
    await settle(h);
    expect(views.map((view) => view.drawn)).toEqual([`artfile-${A}`, `artfile-${B}`]);

    h.store.contextRestored();
    expect(views.map((view) => view.drawn)).toEqual([ART_LOADING_TEXTURE, ART_LOADING_TEXTURE]);

    await settle(h);
    expect(views.map((view) => view.drawn)).toEqual([`artfile-${A}`, `artfile-${B}`]);
  });

  it('fetches a texture once when the view it lands for re-holds it in the arrival tick', async () => {
    const textures = new FakeTextures();
    const h = storeOver(textures, 100 * FULL_BYTES);
    const view = new FakeView(new FakeScene(textures), resolverOver(textures), A);
    view.applyArt();
    await settle(h);
    expect(view.drawn).toBe(`artfile-${A}`);
    expect(h.source.keys).toEqual([A]);
  });
});
