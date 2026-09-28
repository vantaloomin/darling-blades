import type Phaser from 'phaser';
import { ArtArrivals } from './artArrivals';
import { liveArtStore } from './artLoader';
import type { ArtLease, ArtTier } from './artStore';

/**
 * The Phaser side of `src/art/artArrivals.ts` (1.8.1): redraw what was drawn
 * with the loading stand-in once its real card art lands, and (1.9 lane D)
 * re-apply what was drawn from a texture that is removed.
 *
 * One arrivals book per TextureManager (so one per game), fed by the manager's
 * own `addtexture` event. That event is the ground truth for "this texture can
 * be drawn now", whichever path added it: the session queue, its retry pass,
 * the art store, or the card-proof harness. It fires after the texture is
 * registered, so a callback can use it straight away.
 *
 * A second book, the **removal belt** (docs/plan-art-streaming.md section 3),
 * is fed by the manager's `removetexture` event. Every `holdArt` owner drawing
 * a removed texture re-runs its own draw in the same tick, before the next
 * render could read the destroyed frame, and so falls back to the half
 * texture or the stand-in and waits again. It covers the store's evictions,
 * the context-restore sweep, and any other code that removes a texture.
 *
 * The books' listeners live as long as the game. What waits in them is bounded
 * by lifetimes: a view's wait ends when the view is destroyed or its scene
 * shuts down, whichever comes first, so a restarted scene never inherits a
 * dead scene's waits.
 *
 * Phaser is imported for its types only, and its event names are spelled out
 * below, so the hold rules run headless in `tests/art/`.
 */

/** Phaser's event names (`Textures.Events.ADD` / `REMOVE`, `GameObjects.Events.DESTROY`, `Scenes.Events.SHUTDOWN`). */
const TEXTURE_ADD = 'addtexture';
const TEXTURE_REMOVE = 'removetexture';
const OBJECT_DESTROY = 'destroy';
const SCENE_SHUTDOWN = 'shutdown';

/** Emitted on `game.events` after the art store has handled a WebGL context restore. */
export const ART_EVENT_CONTEXT_RESTORED = 'art-context-restored';

const arrivals = new WeakMap<Phaser.Textures.TextureManager, ArtArrivals>();

function arrivalsFor(textures: Phaser.Textures.TextureManager): ArtArrivals {
  const existing = arrivals.get(textures);
  if (existing !== undefined) return existing;
  const book = new ArtArrivals();
  textures.on(TEXTURE_ADD, (key: string) => book.arrived(key));
  arrivals.set(textures, book);
  return book;
}

interface RemovalBelt {
  /** `holdArt` owners, by the texture key they draw. */
  holders: ArtArrivals;
  /** What runs after the holders: the shell's orphan sweep and the store's books. */
  after: Set<(textureKey: string) => void>;
}

const belts = new WeakMap<Phaser.Textures.TextureManager, RemovalBelt>();

function beltFor(textures: Phaser.Textures.TextureManager): RemovalBelt {
  const existing = belts.get(textures);
  if (existing !== undefined) return existing;
  const belt: RemovalBelt = { holders: new ArtArrivals(), after: new Set() };
  // One listener per manager, so the holders always re-apply before any
  // `after` hook looks at what is still drawing the removed key.
  textures.on(TEXTURE_REMOVE, (key: string) => {
    belt.holders.arrived(key);
    for (const hook of [...belt.after]) {
      try {
        hook(key);
      } catch (error) {
        console.error(`artWatch: a removal hook for ${key} failed`, error);
      }
    }
  });
  belts.set(textures, belt);
  return belt;
}

/**
 * Run `onArrive` once, when `textureKey` is added to `textures`. Not tied to
 * any scene: for game-global consumers such as the thumbnail cache, whose
 * textures outlive the scene that baked them. Returns a cancel.
 */
export function whenTextureArrives(
  textures: Phaser.Textures.TextureManager,
  textureKey: string,
  onArrive: () => void,
): () => void {
  return arrivalsFor(textures).watch(textureKey, onArrive);
}

/**
 * Run `hook` after every texture removal, once the `holdArt` owners of that
 * key have re-applied: the art shell's hook for its orphan sweep and for the
 * store's books. Returns an unsubscribe.
 */
export function onArtTextureRemoved(
  textures: Phaser.Textures.TextureManager,
  hook: (textureKey: string) => void,
): () => void {
  const belt = beltFor(textures);
  belt.after.add(hook);
  return () => belt.after.delete(hook);
}

/**
 * Run `listener` after each WebGL context restore the art store handled (only
 * while art streams through the store; the 1.8 queue keeps each texture's
 * pixels, so Phaser restores those by itself). For the thumbnail cache, whose
 * bakes come back blank. Returns an unsubscribe.
 */
export function onArtContextRestored(game: Phaser.Game, listener: () => void): () => void {
  game.events.on(ART_EVENT_CONTEXT_RESTORED, listener);
  return () => game.events.off(ART_EVENT_CONTEXT_RESTORED, listener);
}

/**
 * Call `redraw` when `textureKey` arrives, provided `owner` is still alive.
 * The wait ends by itself when `owner` is destroyed or its scene shuts down.
 * Returns a cancel for an owner that changes what it shows before the art
 * lands (a CardView given another card); safe to call more than once.
 */
export function redrawWhenArtLands(
  owner: Phaser.GameObjects.GameObject,
  textureKey: string,
  redraw: () => void,
): () => void {
  const scene = owner.scene;
  let done = false;
  let stopWaiting: () => void = () => {};
  const cancel = (): void => {
    if (done) return;
    done = true;
    stopWaiting();
    owner.off(OBJECT_DESTROY, cancel);
    scene.events.off(SCENE_SHUTDOWN, cancel);
  };
  stopWaiting = whenTextureArrives(scene.textures, textureKey, () => {
    cancel();
    if (owner.active) redraw();
  });
  owner.once(OBJECT_DESTROY, cancel);
  scene.events.once(SCENE_SHUTDOWN, cancel);
  return cancel;
}

/**
 * The art key and store tier a card-art texture key stands for, or null for
 * any other texture (the stand-in, a placeholder atlas page, a thumb bake).
 * `artfile-` is the primary tier (the half file itself on `lite`); `arthalf-`
 * is the desktop tier's half-resolution copy.
 */
export function artTextureTier(textureKey: string): { key: string; tier: ArtTier } | null {
  if (textureKey.startsWith('artfile-')) return { key: textureKey.slice('artfile-'.length), tier: 'primary' };
  if (textureKey.startsWith('arthalf-')) return { key: textureKey.slice('arthalf-'.length), tier: 'half' };
  return null;
}

/** What an owner drew: `ArtResolver.getArt`'s answer (an `ArtRef`). */
export interface ArtHoldRef {
  /** The texture drawn now. */
  textureKey: string;
  /** The better texture still on its way, if any. */
  pending?: string;
}

/**
 * Hold what `owner` draws (docs/plan-art-streaming.md sections 3 and 4): the
 * one call a view makes after it draws `ArtResolver.getArt`'s answer.
 *
 * - **A lease** on the texture drawn and on the one pending, so neither is
 *   evicted while the owner lives; a pending texture is asked for at
 *   `visible`, the level of "drawn with a stand-in right now". Only while art
 *   streams through the store; with the 1.8 queue there is nothing to pin.
 * - **Redraw on arrival:** when the pending texture lands, `reapply` runs.
 * - **The removal belt:** when the drawn texture is removed (an eviction the
 *   safety scan could not stop, a context restore), `reapply` runs in the
 *   same tick, so the owner never renders a destroyed frame.
 *
 * `reapply` is the owner's own draw (`applyArt`, a portrait's resolve and
 * fit), which resolves again and calls `holdArt` again. The hold ends when it
 * fires, when the owner is destroyed, when its scene shuts down, or when the
 * returned cancel is called (the owner draws something else); the cancel is
 * safe to call any number of times.
 */
export function holdArt(
  owner: Phaser.GameObjects.GameObject,
  ref: ArtHoldRef,
  reapply: () => void,
): () => void {
  const scene = owner.scene;
  const textures = scene.textures;
  let done = false;
  const stops: (() => void)[] = [];
  const leases: ArtLease[] = [];

  const end = (): void => {
    if (done) return;
    done = true;
    for (const stop of stops) stop();
    for (const lease of leases) lease.release();
    owner.off(OBJECT_DESTROY, end);
    scene.events.off(SCENE_SHUTDOWN, end);
  };
  const fire = (): void => {
    end();
    if (owner.active) reapply();
  };

  const store = liveArtStore();
  const wanted = ref.pending !== undefined && ref.pending !== ref.textureKey ? [ref.textureKey, ref.pending] : [ref.textureKey];
  if (store !== null) {
    for (const textureKey of wanted) {
      const art = artTextureTier(textureKey);
      if (art === null) continue;
      leases.push(store.lease('holdArt', [art.key], { priority: 'visible', tier: art.tier }));
    }
  }
  if (ref.pending !== undefined) stops.push(whenTextureArrives(textures, ref.pending, fire));
  if (artTextureTier(ref.textureKey) !== null) stops.push(beltFor(textures).holders.watch(ref.textureKey, fire));

  owner.once(OBJECT_DESTROY, end);
  scene.events.once(SCENE_SHUTDOWN, end);
  return end;
}
