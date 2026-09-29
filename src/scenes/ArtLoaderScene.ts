import Phaser from 'phaser';
import {
  ART_EVENT_COMPLETE,
  ART_EVENT_FILE,
  ART_EVENT_PROGRESS,
  ArtQueue,
  artKeyFor,
  defaultArtOrder,
  hasHalfArt,
  manifestArtKeys,
  setArtLoader,
  setArtStore,
  type ArtBatchHooks,
  type ArtFile,
} from '../art/artLoader';
import { ART_WARM_SET_SHARE, artStoreConfig, textureBytes } from '../art/artBudget';
import { ART_LOADING_TEXTURE } from '../art/ArtResolver';
import { loadBatchWithRetry, type ArtPassHooks } from '../art/artRetry';
import { createArtSource } from '../art/artSource';
import { ArtStore, type ArtImage, type ArtLease, type ArtTextureSink } from '../art/artStore';
import { ART_EVENT_CONTEXT_RESTORED, artTextureTier, onArtTextureRemoved } from '../art/artWatch';
import { artStreamEnabled } from '../config/features';
import { TUTORIAL_AI_DECK, TUTORIAL_LAND_RESERVE, TUTORIAL_PLAYER_DECK } from '../data/tutorial';
import { Services } from '../meta/services';
import { isTauri } from '../platform/desktopWindow';
import { IS_DEV } from '../platform/env';
import { qualityTier } from '../platform/quality';
import { sceneArtLease } from '../ui/artGate';
import { provisionalThumbPending, thumbStats } from '../ui/CardThumbCache';
import { forEachDrawn, type DrawnObject } from '../ui/displayWalk';

/**
 * One object `window.__art` lists (docs/plan-art-streaming.md section 6): the
 * scene it is in, its Phaser type, the texture it draws and why it was listed.
 */
export interface ArtProbeItem {
  scene: string;
  type: string;
  texture: string;
  why: string;
}

/**
 * The read-only `window.__art` hook beside `window.__game` (section 6): what
 * the probe (`scripts/probe-art.mjs`) and a developer at the console read.
 * `mode` is `store` while art streams through the art store and `queue` for
 * the 1.8 whole-manifest stream (the flag off).
 */
export interface ArtProbeHook {
  readonly mode: 'store' | 'queue';
  /** The store's counters plus what the texture manager holds; the queue's progress when off. */
  stats(): Record<string, number | string | boolean>;
  /**
   * Objects still showing a stand-in: drawing `art-loading`, a view still
   * `awaitingArt` a texture that is resident, a half texture while the full
   * one is resident, or a thumbnail baked over a stand-in whose art is
   * resident. Gate 3 wants 0 once the store is idle.
   */
  standIns(): { count: number; items: ArtProbeItem[] };
  /**
   * Thumbnails on screen that were baked over a stand-in (their art has not
   * landed yet, or it landed and the re-bake is missing). The probe reads it
   * for "the first spread shows real art" (gate 2).
   */
  provisionalThumbs(): { count: number; items: ArtProbeItem[] };
  /** Objects on Phaser's `__MISSING` texture, or on a texture that was destroyed. */
  missingTextures(): { count: number; items: ArtProbeItem[] };
  /** Each live lease: its label, how many textures it pins and how many are resident. */
  leases(): { label: string; keys: number; resident: number }[];
  /** The store's warnings so far (pins over the budget, missed leases, orphans). */
  warnings(): string[];
}

declare global {
  interface Window {
    __art?: ArtProbeHook;
  }
}

/** Items a probe list returns at most (the count is always the full count). */
const PROBE_ITEMS = 40;
/** Warnings kept for `window.__art.warnings()`. */
const WARNINGS_KEPT = 50;

/**
 * Point `obj` at `textureKey` and keep what it shows in place: card art is
 * 4:5 at every size (the full file, the half file and the stand-in), so the
 * crop scales by the ratio of the frame widths and the scale by its inverse.
 */
function refit(obj: Phaser.GameObjects.Image, textureKey: string): void {
  const oldWidth = obj.frame.width;
  const crop = obj.isCropped ? { ...(obj as unknown as { _crop: { x: number; y: number; width: number; height: number } })._crop } : null;
  obj.setTexture(textureKey);
  const ratio = oldWidth > 0 ? obj.frame.width / oldWidth : 1;
  if (ratio === 1 || !Number.isFinite(ratio)) return;
  if (crop !== null) obj.setCrop(crop.x * ratio, crop.y * ratio, crop.width * ratio, crop.height * ratio);
  obj.setScale(obj.scaleX / ratio, obj.scaleY / ratio);
}

/**
 * The session's card-art loader. A visual-free scene, `launch`ed by
 * `PreloadScene` so it runs beside every other scene for the life of the game.
 *
 * Two modes, chosen once per page load by `FEATURES.artStream` and the
 * `?artStream=on|off` switch (`artStreamEnabled`):
 *
 * - **The queue (1.8, the shipped default):** the 1,537 card images stream in
 *   behind the menu, tutorial and starter decks first, and nothing is ever
 *   unloaded. The queue, the priority lane and the `ensure` semantics live in
 *   the Phaser-free `src/art/artLoader.ts`; this adds Phaser's loader and the
 *   `game.events` re-emit that `src/ui/artGate.ts` listens to.
 * - **The art store (1.9 lane D, docs/plan-art-streaming.md):** art loads when
 *   a lease or a prefetch asks for it and is evicted under a budget. This is
 *   the Phaser shell over `src/art/artStore.ts`: the texture sink (upload
 *   with the decoded copy dropped, removal, the safety scan), the per-frame
 *   `frame()` call, the context-restore and texture-removal forwarding, and
 *   the boot warm set.
 *
 * Either way it sets the read-only `window.__art` hook (section 6).
 */
export class ArtLoaderScene extends Phaser.Scene {
  private queue: ArtQueue | null = null;
  private store: ArtStore | null = null;
  private readonly offs: (() => void)[] = [];
  private readonly warningsSeen: string[] = [];
  /** Keys the safety scan found drawn with no lease, to pin after this frame's pass. */
  private readonly scanHits: { scene: Phaser.Scene; textureKey: string }[] = [];
  /** Scene leases taken for missed leases and orphans, one per scene and texture. */
  private readonly rescuePins = new WeakMap<Phaser.Scene, Map<string, ArtLease>>();
  /**
   * Art textures removed inside `store.frame()` or `store.contextRestored()`,
   * swept once when that call returns; null outside those calls, where a
   * removal is swept at once.
   */
  private removedInBatch: Set<string> | null = null;
  private orphans = 0;
  private lastLoaded = -1;
  private warmed = false;

  constructor() {
    super('ArtLoader');
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
    if (artStreamEnabled(window.location.search)) this.startStore();
    else this.startQueue();
    window.__art = this.probeHook();
  }

  update(): void {
    const store = this.store;
    if (store === null) return;
    if (!this.warmed && this.game.scene.getScenes(true).some((scene) => scene !== this && scene.sys.settings.key !== 'Preload')) {
      this.warmed = true;
      this.warmUp(store);
    }
    this.batchRemovals(() => store.frame());
    this.pinScanHits();
    const { loaded } = store.progress();
    if (loaded !== this.lastLoaded) {
      this.lastLoaded = loaded;
      this.game.events.emit(ART_EVENT_PROGRESS, store.progress());
    }
  }

  private onShutdown(): void {
    // Nothing stops this scene in the shipped flow; clear the singletons anyway
    // so a stopped loader can never answer for a live one.
    if (this.queue !== null) setArtLoader(null);
    this.queue = null;
    if (this.store !== null) {
      this.store.dispose();
      setArtStore(null);
    }
    this.store = null;
    for (const off of this.offs.splice(0)) off();
  }

  // ------------------------------------------------------------ the 1.8 queue

  private startQueue(): void {
    // Every card in every saved deck rides just behind the starters and the
    // avatar portraits: the player's own deck is what their first duel draws.
    const saveDeckCards = Services.save.data.decks.flatMap((deck) => [
      ...deck.cards,
      ...(deck.landReserve ?? []),
    ]);
    const queue = new ArtQueue({
      order: defaultArtOrder(saveDeckCards),
      sink: { load: (files, hooks) => this.loadBatch(files, hooks) },
      onFile: (id) => this.game.events.emit(ART_EVENT_FILE, id),
      onProgress: (progress) => this.game.events.emit(ART_EVENT_PROGRESS, progress),
      onComplete: () => this.game.events.emit(ART_EVENT_COMPLETE),
    });
    this.queue = queue;
    setArtLoader(queue);
    queue.start();
  }

  /**
   * One batch, with one retry for any file that did not arrive
   * (`src/art/artRetry.ts`): a transient failure is asked for again before
   * the batch settles, so a gate never builds over it. A file that fails twice
   * settles without its art (the resolver falls back to the neutral loading
   * texture, and `ensure` must never hang on a 404).
   */
  private loadBatch(files: readonly ArtFile[], hooks: ArtBatchHooks): void {
    loadBatchWithRetry(files, (pending, pass) => this.loadPass(pending, pass), hooks, {
      onRetry: (missing, attempt) =>
        console.warn(
          `ArtLoader: retrying ${missing.length} card art file(s), attempt ${attempt}: ${missing.map((file) => file.id).join(', ')}`,
        ),
    });
  }

  /**
   * One pass of files through this scene's own LoaderPlugin. A file reports
   * only when it actually arrived; whatever did not (an error, a timeout, an
   * image that would not decode) is left for the retry rule to see.
   *
   * The pass ends from a zero-delay timer rather than from inside the COMPLETE
   * handler: `LoaderPlugin.start()`, for the next batch or for a retry, would
   * re-enter the emit it is being called from, and yielding a frame between
   * passes keeps decode and GPU upload from starving the scene on screen.
   */
  private loadPass(files: readonly ArtFile[], pass: ArtPassHooks): void {
    const ids = new Map(files.map((file) => [file.textureKey, file.id]));
    const onFileComplete = (key: string): void => {
      const id = ids.get(key);
      if (id !== undefined) pass.onLoaded(id);
    };
    const onLoadError = (file: Phaser.Loader.File): void => {
      console.warn(`ArtLoader: card art failed to load (${file.key})`);
    };
    const onComplete = (): void => {
      this.load.off('filecomplete', onFileComplete);
      this.load.off('loaderror', onLoadError);
      this.time.delayedCall(0, () => pass.onDone());
    };
    this.load.on('filecomplete', onFileComplete);
    this.load.on('loaderror', onLoadError);
    this.load.once('complete', onComplete);
    for (const file of files) this.load.image(file.textureKey, file.url);
    this.load.start();
  }

  // --------------------------------------------------------- the 1.9 store

  private startStore(): void {
    const quality = qualityTier();
    const config = artStoreConfig({
      quality,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      search: window.location.search,
      desktopApp: isTauri(),
    });
    const store = new ArtStore({
      manifest: manifestArtKeys(),
      hasHalf: hasHalfArt,
      keyFor: artKeyFor,
      quality,
      source: createArtSource(),
      sink: this.textureSink(),
      budgetBytes: config.artBudgetBytes,
      evict: config.evict,
      maxInFlight: config.maxInFlight,
      onResident: (textureKey) => {
        const art = artTextureTier(textureKey);
        if (art?.tier === 'primary') this.game.events.emit(ART_EVENT_FILE, art.key);
      },
      onWarn: (message) => this.warn(message),
    });
    this.store = store;
    setArtStore(store);

    // Game-global listeners, registered once: the scene is created once per
    // game and never restarted.
    const textures = this.textures;
    this.offs.push(
      onArtTextureRemoved(textures, (textureKey) => {
        if (artTextureTier(textureKey) === null) return;
        store.textureRemoved(textureKey);
        if (this.removedInBatch !== null) this.removedInBatch.add(textureKey);
        else this.sweepOrphans(new Set([textureKey]));
      }),
    );
    const renderer = this.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const onRestore = (): void => {
        this.batchRemovals(() => store.contextRestored());
        this.game.events.emit(ART_EVENT_CONTEXT_RESTORED);
      };
      renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, onRestore);
      this.offs.push(() => renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, onRestore));
    }
  }

  /**
   * The store's texture sink over Phaser's TextureManager (section 1, "The
   * pipeline" and "The decoded copy").
   */
  private textureSink(): ArtTextureSink {
    const textures = this.textures;
    const keepsSource = this.game.renderer.type === Phaser.CANVAS;
    return {
      keepsSource,
      exists: (textureKey) => textures.exists(textureKey),
      add: (textureKey, image: ArtImage) => {
        // Phaser 3.90's TextureSource takes an ImageBitmap through its generic
        // path (the size comes from `source.width` and `source.height`). The
        // ADD event fires inside; a view it redraws may hold the key again at
        // once, which the store allows for (its `upload`).
        const texture = textures.addImage(textureKey, image as unknown as HTMLImageElement);
        if (texture === null) return false;
        if (!keepsSource) {
          // The store closes the bitmap right after this returns. A restore
          // would re-upload `pixels` and throw on a closed bitmap, aborting
          // every restore after it; null restores a blank texture of the
          // right size, which the context-restore sweep then replaces.
          for (const source of texture.source) {
            if (source.glTexture !== null) source.glTexture.pixels = null;
          }
        }
        return true;
      },
      remove: (textureKey) => {
        if (textures.exists(textureKey)) textures.remove(textureKey);
      },
      inUse: (textureKeys) => this.scanDrawn(textureKeys),
    };
  }

  /**
   * The safety scan (section 3): of the eviction candidates, the ones some
   * live object still draws. The store keeps them and counts each as a missed
   * lease; this pins them for the rest of that scene's life (after the pass,
   * in `pinScanHits`).
   */
  private scanDrawn(textureKeys: readonly string[]): ReadonlySet<string> {
    const wanted = new Set(textureKeys);
    const hits = new Set<string>();
    if (wanted.size === 0) return hits;
    forEachDrawn(this.game, (obj, scene) => {
      const key = obj.texture?.key;
      if (key === undefined || !wanted.has(key)) return;
      if (!hits.has(key)) this.scanHits.push({ scene, textureKey: key });
      hits.add(key);
    });
    return hits;
  }

  private pinScanHits(): void {
    for (const hit of this.scanHits.splice(0)) this.rescuePin(hit.scene, hit.textureKey);
  }

  /** A scene lease on one texture a live object draws without a lease of its own. */
  private rescuePin(scene: Phaser.Scene, textureKey: string): void {
    const art = artTextureTier(textureKey);
    if (art === null) return;
    let pins = this.rescuePins.get(scene);
    if (pins === undefined) {
      pins = new Map();
      this.rescuePins.set(scene, pins);
      const held = pins;
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        held.clear();
        this.rescuePins.delete(scene);
      });
    }
    if (pins.has(textureKey)) return;
    const lease = sceneArtLease(scene, [art.key], 'visible', art.tier);
    if (lease !== null) pins.set(textureKey, lease);
  }

  /**
   * Run `step` (a store call that can remove textures) and sweep what it
   * removed once, when it returns: a context restore removes every art
   * texture, and one walk of the display lists beats one per key. Nothing
   * renders in between, since both calls run outside the render step.
   */
  private batchRemovals(step: () => void): void {
    const removed = new Set<string>();
    this.removedInBatch = removed;
    try {
      step();
    } finally {
      this.removedInBatch = null;
      if (removed.size > 0) this.sweepOrphans(removed);
    }
  }

  /**
   * The removal belt's last layer: after every `holdArt` owner of a removed
   * art texture has re-applied, any live object still on one (an object that
   * draws card art without `holdArt`, a gated scene's lease or a thumbnail:
   * since S4 no production view should) is pointed at the half texture or the
   * stand-in before the next render, so none reads a destroyed frame, and its
   * scene leases what it now draws. It stays on that stand-in: it has no draw
   * of its own to call, and the art it drew may no longer be what it should
   * show (a pooled view given another card), so `standIns()` counts it. Each
   * one is counted (`orphans`) and warned about, since a sweep that finds
   * anything is a missed hold.
   */
  private sweepOrphans(removed: ReadonlySet<string>): void {
    const hits: { obj: Phaser.GameObjects.Image; scene: Phaser.Scene; textureKey: string }[] = [];
    forEachDrawn(this.game, (obj, scene) => {
      const key = obj.texture?.key;
      if (key === undefined || !removed.has(key) || obj.active === false) return;
      if (typeof (obj as { setTexture?: unknown }).setTexture !== 'function') return;
      hits.push({ obj: obj as unknown as Phaser.GameObjects.Image, scene, textureKey: key });
    });
    if (hits.length === 0) return;
    const textures = this.textures;
    const byKey = new Map<string, number>();
    for (const { obj, scene, textureKey } of hits) {
      const art = artTextureTier(textureKey);
      const half = art?.tier === 'primary' ? this.store?.textureKeyFor(art.key, 'half') ?? null : null;
      const standIn =
        half !== null && half !== textureKey && textures.exists(half)
          ? half
          : textures.exists(ART_LOADING_TEXTURE)
            ? ART_LOADING_TEXTURE
            : '__MISSING';
      refit(obj, standIn);
      this.orphans++;
      this.rescuePin(scene, standIn);
      byKey.set(textureKey, (byKey.get(textureKey) ?? 0) + 1);
    }
    for (const [textureKey, count] of byKey) {
      this.warn(`artStore: ${count} object(s) drew ${textureKey} with no hold when it was removed; showing a stand-in`);
    }
  }

  /**
   * The boot warm set (section 1), at `idle` once the menu is up: the
   * tutorial decks until the tutorial is done, then the active deck. Capped
   * at a quarter of the art budget. (The next Tower opponent's set is the
   * Gauntlet screen's `soon` prefetch, S5a.)
   */
  private warmUp(store: ArtStore): void {
    const save = Services.save.data;
    let ids: readonly string[];
    if (!save.tutorialDone) {
      ids = [...TUTORIAL_PLAYER_DECK, ...TUTORIAL_AI_DECK, ...TUTORIAL_LAND_RESERVE];
    } else {
      const deck = save.decks.find((d) => d.id === save.activeDeckId) ?? save.decks[0];
      ids = deck === undefined ? [] : [...deck.cards, ...(deck.landReserve ?? [])];
    }
    const perKey = qualityTier() === 'lite' ? textureBytes(320, 400) : textureBytes(640, 800);
    const cap = Math.floor((store.stats().budget * ART_WARM_SET_SHARE) / perKey);
    const keys = [...new Set(ids.map(artKeyFor))].filter((key) => store.textureKeyFor(key) !== null);
    if (cap > 0 && keys.length > 0) store.prefetch(keys.slice(0, cap), { priority: 'idle' });
  }

  private warn(message: string): void {
    this.warningsSeen.push(message);
    if (this.warningsSeen.length > WARNINGS_KEPT) this.warningsSeen.shift();
    if (IS_DEV) console.warn(message);
  }

  // ------------------------------------------------------------ window.__art

  private probeHook(): ArtProbeHook {
    const game = this.game;
    const textures = this.textures;
    const artTextures = (): { count: number; bytes: number } => {
      let count = 0;
      let bytes = 0;
      for (const key of textures.getTextureKeys()) {
        if (artTextureTier(key) === null) continue;
        count++;
        for (const source of textures.get(key).source) bytes += textureBytes(source.width, source.height);
      }
      return { count, bytes };
    };
    const list = (test: (obj: DrawnObject) => string | null): { count: number; items: ArtProbeItem[] } => {
      const items: ArtProbeItem[] = [];
      let count = 0;
      forEachDrawn(game, (obj, scene) => {
        if (obj.active === false) return;
        const why = test(obj);
        if (why === null) return;
        count++;
        if (items.length < PROBE_ITEMS) {
          items.push({ scene: scene.sys.settings.key, type: obj.type ?? '?', texture: obj.texture?.key ?? '', why });
        }
      });
      return { count, items };
    };
    return Object.freeze({
      mode: this.store !== null ? 'store' : 'queue',
      stats: () => {
        const held = artTextures();
        const managed = { managerTextures: held.count, managerBytes: held.bytes };
        // The thumbnail cache's numbers under a `thumb` prefix (thumbResident, thumbPinnedBytes, ...).
        const thumbs = Object.fromEntries(
          Object.entries(thumbStats(textures)).map(([name, value]) => [`thumb${name[0].toUpperCase()}${name.slice(1)}`, value]),
        );
        const store = this.store;
        if (store !== null) return { mode: 'store', ...store.stats(), orphans: this.orphans, ...managed, ...thumbs };
        const progress = this.queue?.progress() ?? { loaded: 0, total: 0 };
        return { mode: 'queue', loaded: progress.loaded, total: progress.total, ...managed, ...thumbs };
      },
      standIns: () =>
        list((obj) => {
          const key = obj.texture?.key;
          if (key === ART_LOADING_TEXTURE) return 'draws the stand-in';
          if (typeof obj.awaitingArt === 'string' && textures.exists(obj.awaitingArt)) {
            return `awaits ${obj.awaitingArt}, which is resident`;
          }
          const art = key === undefined ? null : artTextureTier(key);
          if (art?.tier === 'half' && textures.exists(`artfile-${art.key}`)) return 'draws the half texture while the full one is resident';
          const pending = key === undefined ? null : provisionalThumbPending(key);
          if (pending !== null && textures.exists(pending)) return `a thumbnail baked over a stand-in, and ${pending} is resident`;
          return null;
        }),
      provisionalThumbs: () =>
        list((obj) => {
          const key = obj.texture?.key;
          const pending = key === undefined ? null : provisionalThumbPending(key);
          return pending === null ? null : `baked over a stand-in for ${pending}`;
        }),
      missingTextures: () =>
        list((obj) => {
          if (obj.texture === undefined) return null;
          if (obj.texture.key === '__MISSING') return 'draws __MISSING';
          if (obj.texture.manager === null || obj.frame?.source === null) return 'draws a destroyed texture';
          return null;
        }),
      leases: () => this.store?.leaseReport() ?? [],
      warnings: () => [...this.warningsSeen],
    });
  }
}
