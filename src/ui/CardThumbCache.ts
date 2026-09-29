import Phaser from 'phaser';
import { artStoreConfig, textureBytes } from '../art/artBudget';
import { liveArtStore } from '../art/artLoader';
import { Art } from '../art/ArtResolver';
import type { ArtStore, ArtTier } from '../art/artStore';
import { artTextureTier, onArtContextRestored, whenTextureArrives } from '../art/artWatch';
import type { CardDef } from '../engine/types';
import { variantKey, type CardVariant } from '../meta/variants';
import { isTauri } from '../platform/desktopWindow';
import { IS_DEV } from '../platform/env';
import { qualityTier } from '../platform/quality';
import { activeRenderScale } from '../platform/renderScale';
import { CARD_H, CARD_W, CardView } from './CardView';
import { cardThumbKey } from './cardThumbKey';
import { forEachDrawn } from './displayWalk';
import { ThumbBook } from './thumbBudget';

/**
 * Rendered-thumbnail cache for grid scenes (Collection / DeckBuilder).
 *
 * A full CardView is ~15 game objects (frame, art, texts, pips, gem…) — far
 * too heavy to churn per grid cell on every page turn. Instead we bake each
 * card ONCE into a texture (temp CardView → DynamicTexture → destroy) and
 * hand out single lightweight Images. Textures live in the game-global
 * TextureManager, so they survive scene restarts; baking is lazy per cell,
 * so first paint only pays for one page. Thumbs are always fx:'none' static
 * snapshots — full-fidelity holo stays in the inspect overlay, which keeps
 * constructing live CardViews.
 *
 * Being plain Images (not Containers), thumbs can be setInteractive()'d
 * directly — Phaser scales Image hit areas correctly, so the CardView
 * Zone-child workaround is not needed here.
 *
 * Card art streams in behind the running scenes, so a thumb can be baked
 * before its card's file has landed, over the loading stand-in. Such a bake is
 * provisional (1.8.1): the moment the file lands the thumb is re-baked IN
 * PLACE, into the same texture, so every Image already showing it (in any
 * scene) turns into the real card on the next frame, and the stand-in bake is
 * never handed out again.
 *
 * While art streams through the art store (1.9 lane D, S4;
 * docs/plan-art-streaming.md section 3, "CardThumbCache"):
 *
 * - **Bakes read the cheapest adequate source:** the primary texture if it is
 *   resident, else the half-resolution one, else the bake is provisional and
 *   the half file is asked for. The largest art window a bake draws is the
 *   full-art frame interior, 282x402 px at k=2, within 0.5% of the half
 *   file's 320x400; the standard window (264x216 after R13) downscales.
 * - **Thumbs have their own budget** (`src/ui/thumbBudget.ts`): each Image
 *   holds its thumb until it is destroyed, and unheld thumbs are evicted
 *   least recently used first once the thumbs are over their budget. An
 *   evicted thumb's texture is removed and `ensureCardThumb` bakes it again.
 * - A provisional thumb whose half file settles as failed keeps its stand-in
 *   bake until it is evicted, as a failed file keeps its stand-in anywhere.
 *
 * With the 1.8 queue none of that exists: bakes read the primary texture and
 * the cache is unbounded, as it always was.
 *
 * **A WebGL context restore** leaves every bake blank on either path (a
 * DynamicTexture keeps no pixels, and nothing else would draw it again). Every
 * thumb still on screen re-bakes in place, since Images reference its key.
 * While art streams through the store the rest are dropped, and each re-bake
 * is provisional (the restore removed the card art too) and asks for its art
 * again. With no running scene to host a re-bake, the thumb stays blank and
 * `ensureCardThumb` re-bakes it before handing it out again.
 */

// Bake at half card size (150×210) — grids display at ~0.47–0.48 card scale,
// so the one resample down from the bake stays visually lossless at k=1.
const THUMB_SCALE = 0.5;
// The legendary crown overhangs the 300×420 card rect by 4px at the top
// (Containers don't clip, but a texture does) — bleed the bake vertically.
const BLEED_Y = 8;

/** What a bake draws. */
interface ThumbFace {
  card: CardDef;
  landStyle?: string;
  variant?: CardVariant;
}

/** A thumb baked over a stand-in, and what its re-bake needs. */
interface ProvisionalThumb extends ThumbFace {
  /** The real art texture the bake drew the stand-in for. */
  pending: string;
  /** The scene that baked it: the preferred host for the re-bake while it runs. */
  scene: Phaser.Scene;
  cancel: () => void;
}

/** Game-global, like the thumb textures themselves. Keyed by thumb key. */
const provisional = new Map<string, ProvisionalThumb>();
/** What every baked thumb shows, for a re-bake after a context restore. Keyed by thumb key. */
const faces = new Map<string, ThumbFace>();
/** Thumbs a context restore left blank with no running scene to re-bake them in. */
const blank = new Set<string>();
/** Games whose renderer's context restore this cache already listens to. */
const restoreWired = new WeakSet<Phaser.Game>();

/** The thumb budget, bound to the art store it was built beside. */
interface ThumbResidency {
  store: ArtStore;
  game: Phaser.Game;
  book: ThumbBook;
  /** The once-per-frame pass is scheduled. */
  passQueued: boolean;
  /** Stops listening for the store's context restores. */
  offRestore: () => void;
}

let residency: ThumbResidency | null = null;

/**
 * The thumb residency for `scene`'s game, or null while art is not streaming
 * through the store (the 1.8 queue: no budget, as before). Built on first use,
 * and again if the store was replaced.
 */
function residencyFor(scene: Phaser.Scene): ThumbResidency | null {
  const store = liveArtStore();
  if (store === null) return null;
  if (residency !== null && residency.store === store && residency.game === scene.game) return residency;
  const game = scene.game;
  const budgetBytes = artStoreConfig({
    quality: qualityTier(),
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    search: window.location.search,
    desktopApp: isTauri(),
  }).thumbBudgetBytes;
  const book = new ThumbBook({
    budgetBytes,
    now: () => performance.now(),
    remove: (key) => discardThumb(game, key),
    inUse: (keys) => thumbsDrawn(game, keys),
  });
  residency?.offRestore();
  const built: ThumbResidency = { store, game, book, passQueued: false, offRestore: () => {} };
  residency = built;
  built.offRestore = onArtContextRestored(game, () => {
    if (residency === built) rebakeAfterRestore(game, built);
  });
  return built;
}

/**
 * Listen for the renderer's context restore once per game, for the 1.8 queue.
 * With a store the art shell's `onArtContextRestored` notice runs the same
 * re-bake instead, once the store has swept the card art.
 */
function wireRestore(game: Phaser.Game): void {
  if (restoreWired.has(game)) return;
  restoreWired.add(game);
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
    if (liveArtStore() === null) rebakeAfterRestore(game, null);
  });
}

/** Forget a thumb and remove its texture: an eviction, or a blank bake nothing shows. */
function discardThumb(game: Phaser.Game, key: string): void {
  dropProvisional(key);
  faces.delete(key);
  blank.delete(key);
  if (game.textures.exists(key)) game.textures.remove(key);
}

/**
 * Run the book's eviction pass at the start of the next game step: after the
 * frame that asked for it has rendered, before any scene updates or builds,
 * so a thumb is never removed while an Image being built for it is unheld.
 */
function queuePass(r: ThumbResidency): void {
  if (r.passQueued || !r.book.wantsPass) return;
  r.passQueued = true;
  r.game.events.once(Phaser.Core.Events.PRE_STEP, () => {
    r.passQueued = false;
    if (residency !== r) return;
    const before = r.book.stats().missedHolds;
    r.book.evict();
    const missed = r.book.stats().missedHolds;
    if (IS_DEV && missed > before) console.warn(`CardThumbCache: ${missed} thumb(s) drawn with no hold were kept`);
    // A grace window held some back: look again next frame.
    if (r.book.wantsPass) queuePass(r);
  });
}

/**
 * The safety scan for thumbs: of `keys`, the ones some object in a live scene
 * still draws (the walk the card-art scan uses, `src/ui/displayWalk.ts`).
 */
function thumbsDrawn(game: Phaser.Game, keys: readonly string[]): ReadonlySet<string> {
  const wanted = new Set(keys);
  const hits = new Set<string>();
  if (wanted.size === 0) return hits;
  forEachDrawn(game, (obj) => {
    const key = obj.texture?.key;
    if (key !== undefined && wanted.has(key)) hits.add(key);
  });
  return hits;
}

/**
 * A GPU reset left every bake blank (see the header). With the thumb budget
 * (`r`), a thumb no Image holds and no live object draws (the eviction's own
 * safety scan) is removed and bakes again when next shown. Every other thumb
 * re-bakes in place, or is marked blank for `ensureCardThumb` when no scene is
 * running to host the bake.
 */
function rebakeAfterRestore(game: Phaser.Game, r: ThumbResidency | null): void {
  const keys = [...faces.keys()].filter((key) => game.textures.exists(key));
  const drawn = r === null ? null : thumbsDrawn(game, keys.filter((key) => !r.book.isHeld(key)));
  const host = game.scene.getScenes(true)[0];
  for (const key of keys) {
    if (r !== null && drawn !== null && !r.book.isHeld(key) && !drawn.has(key)) {
      r.book.forget(key);
      discardThumb(game, key);
      continue;
    }
    const face = faces.get(key);
    if (host === undefined || face === undefined) blank.add(key);
    else bakeThumb(host, key, face);
  }
}

function dropProvisional(key: string): void {
  provisional.get(key)?.cancel();
  provisional.delete(key);
}

/**
 * The bake resolution is multiplied by the active render scale k: live
 * CardViews render their glyphs at k× (main.ts Text hook + camera zoom), but a
 * baked DynamicTexture is a FIXED-size snapshot — at k=2 a 150×210 thumb gets
 * upscaled ~2× by the k camera and turns soft (the Collection/DeckBuilder
 * "blurry card" bug). Baking at THUMB_SCALE·k gives the texture enough pixels
 * to stay crisp; makeCardThumb divides the k back out of the DISPLAY scale, so
 * the on-screen size and every grid's layout are k-invariant. VRAM per thumb
 * scales k² — but the lite tier resolves k=1 (renderScale.ts), so mobile is
 * unchanged; on desktop the thumb budget bounds it while art streams through
 * the store.
 */
/**
 * Bake (or reuse) the thumbnail texture for a card; returns its texture key.
 * `variant` bakes the frame/full-art treatment statically (holo shimmer stays
 * an inspect-overlay effect) — the Collection binder uses it to show each
 * card's selected owned display variant. Variant thumbs only bake for owned specials,
 * so the cache stays bounded by the collection, not the variant space.
 */
export function ensureCardThumb(
  scene: Phaser.Scene,
  card: CardDef,
  landStyle?: string,
  variant?: CardVariant,
): string {
  const key = cardThumbKey(card.id, landStyle, variant ? variantKey(variant) : undefined);
  wireRestore(scene.game);
  if (scene.textures.exists(key)) {
    // Backstop for a provisional thumb whose art landed, or a bake a context
    // restore blanked, while no scene was running to host the re-bake:
    // re-bake before handing it out again.
    const stale = provisional.get(key);
    if (stale !== undefined && scene.textures.exists(stale.pending)) bakeThumb(scene, key, stale);
    else if (blank.has(key)) bakeThumb(scene, key, faces.get(key) ?? { card, landStyle, variant });
    const r = residencyFor(scene);
    if (r !== null) {
      // A thumb baked before the budget existed joins it now.
      if (!r.book.has(key)) track(r, key, scene.textures.get(key), { card, landStyle, variant });
      r.book.touch(key);
    }
    return key;
  }
  bakeThumb(scene, key, { card, landStyle, variant });
  return key;
}

/** Record a baked thumb in the budget. */
function track(r: ThumbResidency, key: string, texture: Phaser.Textures.Texture, face: ThumbFace): void {
  let bytes = 0;
  for (const source of texture.source) bytes += textureBytes(source.width, source.height);
  faces.set(key, face);
  r.book.baked(key, bytes);
  queuePass(r);
}

/**
 * Render one throwaway CardView into the thumb's texture, creating it on the
 * first bake and redrawing it in place on a re-bake. The view is created and
 * destroyed synchronously, so it never survives to a screen render pass. Works
 * on both WebGL and canvas renderers (DynamicTexture handles either path), and
 * fx:'none' matches what the grids rendered live before caching. The view is
 * built fully before a new texture is registered, so a failed first bake
 * caches nothing.
 */
function bakeThumb(scene: Phaser.Scene, key: string, face: ThumbFace): void {
  const { card, landStyle, variant } = face;
  const existing = scene.textures.exists(key) ? scene.textures.get(key) : null;
  const redraw = existing instanceof Phaser.Textures.DynamicTexture ? existing : null;
  // A re-bake keeps the texture's own size, i.e. the render scale of the first
  // bake, so every Image already showing it keeps its on-screen size.
  const bakeScale = redraw !== null ? redraw.width / CARD_W : THUMB_SCALE * activeRenderScale();
  const w = CARD_W * bakeScale;
  const h = (CARD_H + 2 * BLEED_Y) * bakeScale;
  const view = new CardView(scene, 0, 0);
  view.setCard(card, {
    fx: 'none',
    landStyle,
    artTier: 'half',
    ...(variant ? { variant, fullArt: variant.fullArt } : {}),
  });
  view.setScale(bakeScale);
  const pending = view.awaitingArt;
  const dt = redraw ?? scene.textures.addDynamicTexture(key, w, h);
  if (dt) dt.clear().draw(view, w / 2, h / 2);
  // Ask for the pending art before the view lets go of its own request, so a
  // fetch already started for it is not dropped in between.
  const store = liveArtStore();
  const wanted = dt !== null && pending !== null && store !== null ? artTextureTier(pending) : null;
  const cancelRequest = wanted !== null && store !== null ? store.prefetch([wanted.key], { priority: 'visible', tier: wanted.tier }) : () => {};
  view.destroy();

  dropProvisional(key);
  if (dt !== null) {
    faces.set(key, face);
    blank.delete(key);
    const r = residencyFor(scene);
    if (r !== null) track(r, key, dt, face);
  }
  if (dt === null || pending === null) {
    cancelRequest();
    return;
  }
  const record: ProvisionalThumb = { card, landStyle, variant, pending, scene, cancel: cancelRequest };
  const stopWaiting = whenTextureArrives(scene.textures, pending, () => rebakeOnArrival(key, record));
  record.cancel = () => {
    stopWaiting();
    cancelRequest();
  };
  provisional.set(key, record);
}

/**
 * The art a provisional thumb was waiting for has landed: re-bake it now, in
 * the scene that baked it if that scene is still running, otherwise in any
 * running scene (the bake is a throwaway view; the texture is game-global).
 * With no running scene at all the record stays, and `ensureCardThumb`
 * re-bakes before the thumb is next handed out.
 */
function rebakeOnArrival(key: string, record: ProvisionalThumb): void {
  if (provisional.get(key) !== record) return;
  const host = record.scene.sys.isActive() ? record.scene : record.scene.game.scene.getScenes(true)[0];
  if (host === undefined) return;
  if (!host.textures.exists(key)) {
    dropProvisional(key);
    return;
  }
  bakeThumb(host, key, record);
}

/**
 * Cheap grid-cell stand-in for a CardView: one Image backed by the cached
 * thumbnail. `cardScale` is in CardView units (e.g. 0.47), so call sites read
 * the same as the old `view.setScale(...)`. Center origin, like CardView.
 * Divides out the render scale the texture was baked at, so the displayed size
 * is k-invariant (the texture is k× denser, drawn at the same on-screen size).
 * While art streams through the store the Image holds its thumb until it is
 * destroyed, so the thumb budget never evicts a thumb on screen.
 */
export function makeCardThumb(
  scene: Phaser.Scene,
  x: number,
  y: number,
  card: CardDef,
  cardScale: number,
  landStyle?: string,
  variant?: CardVariant,
): Phaser.GameObjects.Image {
  const displayScale = cardScale / (THUMB_SCALE * activeRenderScale());
  const key = ensureCardThumb(scene, card, landStyle, variant);
  const image = scene.add.image(x, y, key).setScale(displayScale);
  const r = residencyFor(scene);
  if (r !== null && r.book.has(key)) {
    const release = r.book.hold(key);
    image.once(Phaser.GameObjects.Events.DESTROY, () => {
      release();
      if (residency === r) queuePass(r);
    });
  }
  return image;
}

/**
 * The art a thumb still needs before it can bake over real art, as an art key
 * and the store tier to ask for (`half`: a bake reads the cheapest adequate
 * source, section 3), or null when it needs none: the thumb is already baked
 * over real art (its source may since have been evicted; a thumb is a
 * snapshot), the art is resident, or the card has no art file. A paged grid
 * asks for exactly this before it draws a page (`PagedArt` in
 * `src/ui/artGate.ts`), so a page of thumbs baked on an earlier visit costs
 * no requests.
 */
export function thumbArtWanted(
  scene: Phaser.Scene,
  card: CardDef,
  landStyle?: string,
  variant?: CardVariant,
): { key: string; tier: ArtTier } | null {
  const key = cardThumbKey(card.id, landStyle, variant ? variantKey(variant) : undefined);
  if (scene.textures.exists(key) && !provisional.has(key) && !blank.has(key)) return null;
  // Also called for the cards of neighbouring pages, which are never drawn
  // here. `getArt` throws for a card with neither a manifest file nor an
  // atlas slot; `ArtResolver.generatePlaceholders` gives every card in the
  // database a slot at boot, so no card reaches that throw.
  const pending = Art.resolver?.getArt(card.id, landStyle, 'half').pending;
  return pending === undefined ? null : artTextureTier(pending);
}

/**
 * The art texture a thumb was baked over a stand-in for, or null when
 * `thumbKey` is not a provisional thumb (the probe hook, `window.__art`).
 */
export function provisionalThumbPending(thumbKey: string): string | null {
  return provisional.get(thumbKey)?.pending ?? null;
}

/**
 * The cache's numbers for `window.__art.stats()` (under a `thumb` prefix):
 * what is baked, what is provisional, and, while art streams through the
 * store, the budget's books. `provisionalResident` counts provisional thumbs
 * whose art is resident (a re-bake that has not happened; 0 once idle).
 */
export function thumbStats(textures: Phaser.Textures.TextureManager): Record<string, number> {
  let provisionalResident = 0;
  for (const record of provisional.values()) if (textures.exists(record.pending)) provisionalResident++;
  const base = { baked: faces.size, provisional: provisional.size, provisionalResident, blank: blank.size };
  const r = residency !== null && liveArtStore() === residency.store ? residency : null;
  if (r === null) {
    let residentBytes = 0;
    for (const key of faces.keys()) {
      if (!textures.exists(key)) continue;
      for (const source of textures.get(key).source) residentBytes += textureBytes(source.width, source.height);
    }
    return { ...base, residentBytes };
  }
  const book = r.book.stats();
  return {
    ...base,
    resident: book.resident,
    residentBytes: book.residentBytes,
    pinnedBytes: book.pinnedBytes,
    budget: book.budget,
    evictions: book.evictions,
    missedHolds: book.missedHolds,
  };
}
