import Phaser from 'phaser';
import { whenTextureArrives } from '../art/artWatch';
import type { CardDef } from '../engine/types';
import { variantKey, type CardVariant } from '../meta/variants';
import { activeRenderScale } from '../platform/renderScale';
import { CARD_H, CARD_W, CardView } from './CardView';
import { cardThumbKey } from './cardThumbKey';

/**
 * Rendered-thumbnail cache for grid scenes (Collection / DeckBuilder).
 *
 * A full CardView is ~15 game objects (frame, art, texts, pips, gem…) — far
 * too heavy to churn per grid cell on every page turn. Instead we bake each
 * card ONCE into a texture (temp CardView → DynamicTexture → destroy) and
 * hand out single lightweight Images. Textures live in the game-global
 * TextureManager, so they survive scene restarts; baking is lazy per cell,
 * so first paint only pays for one page, and the ~210-card pool bounds the
 * cache. Thumbs are always fx:'none' static snapshots — full-fidelity holo
 * stays in the inspect overlay, which keeps constructing live CardViews.
 *
 * Being plain Images (not Containers), thumbs can be setInteractive()'d
 * directly — Phaser scales Image hit areas correctly, so the CardView
 * Zone-child workaround is not needed here.
 *
 * Card art streams in behind the running scenes (1.8), so a thumb can be baked
 * before its card's file has landed, over the loading stand-in. Such a bake is
 * provisional (1.8.1): the moment the file lands the thumb is re-baked IN
 * PLACE, into the same texture, so every Image already showing it (in any
 * scene) turns into the real card on the next frame, and the stand-in bake is
 * never handed out again.
 */

// Bake at half card size (150×210) — grids display at ~0.47–0.48 card scale,
// so the one resample down from the bake stays visually lossless at k=1.
const THUMB_SCALE = 0.5;
// The legendary crown overhangs the 300×420 card rect by 4px at the top
// (Containers don't clip, but a texture does) — bleed the bake vertically.
const BLEED_Y = 8;

/** A thumb baked over the loading stand-in, and what its re-bake needs. */
interface ProvisionalThumb {
  card: CardDef;
  landStyle?: string;
  variant?: CardVariant;
  /** The real art texture the bake drew the stand-in for. */
  pending: string;
  /** The scene that baked it: the preferred host for the re-bake while it runs. */
  scene: Phaser.Scene;
  cancel: () => void;
}

/** Game-global, like the thumb textures themselves. Keyed by thumb key. */
const provisional = new Map<string, ProvisionalThumb>();

/**
 * The bake resolution is multiplied by the active render scale k: live
 * CardViews render their glyphs at k× (main.ts Text hook + camera zoom), but a
 * baked DynamicTexture is a FIXED-size snapshot — at k=2 a 150×210 thumb gets
 * upscaled ~2× by the k camera and turns soft (the Collection/DeckBuilder
 * "blurry card" bug). Baking at THUMB_SCALE·k gives the texture enough pixels
 * to stay crisp; makeCardThumb divides the k back out of the DISPLAY scale, so
 * the on-screen size and every grid's layout are k-invariant. VRAM per thumb
 * scales k² — but the lite tier resolves k=1 (renderScale.ts), so mobile is
 * unchanged, and the ~210-card desktop pool stays well within budget.
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
  if (scene.textures.exists(key)) {
    // Backstop for a provisional thumb whose art landed while no scene was
    // running to host the re-bake: re-bake before handing it out again.
    const stale = provisional.get(key);
    if (stale !== undefined && scene.textures.exists(stale.pending)) bakeThumb(scene, key, stale);
    return key;
  }
  bakeThumb(scene, key, { card, landStyle, variant });
  return key;
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
function bakeThumb(
  scene: Phaser.Scene,
  key: string,
  face: { card: CardDef; landStyle?: string; variant?: CardVariant },
): void {
  const { card, landStyle, variant } = face;
  const existing = scene.textures.exists(key) ? scene.textures.get(key) : null;
  const redraw = existing instanceof Phaser.Textures.DynamicTexture ? existing : null;
  // A re-bake keeps the texture's own size, i.e. the render scale of the first
  // bake, so every Image already showing it keeps its on-screen size.
  const bakeScale = redraw !== null ? redraw.width / CARD_W : THUMB_SCALE * activeRenderScale();
  const w = CARD_W * bakeScale;
  const h = (CARD_H + 2 * BLEED_Y) * bakeScale;
  const view = new CardView(scene, 0, 0);
  view.setCard(card, { fx: 'none', landStyle, ...(variant ? { variant, fullArt: variant.fullArt } : {}) });
  view.setScale(bakeScale);
  const pending = view.awaitingArt;
  const dt = redraw ?? scene.textures.addDynamicTexture(key, w, h);
  if (dt) dt.clear().draw(view, w / 2, h / 2);
  view.destroy();

  provisional.get(key)?.cancel();
  provisional.delete(key);
  if (dt === null || pending === null) return;
  const record: ProvisionalThumb = { card, landStyle, variant, pending, scene, cancel: () => {} };
  record.cancel = whenTextureArrives(scene.textures, pending, () => rebakeOnArrival(key, record));
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
    provisional.delete(key);
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
  return scene.add.image(x, y, ensureCardThumb(scene, card, landStyle, variant)).setScale(displayScale);
}
