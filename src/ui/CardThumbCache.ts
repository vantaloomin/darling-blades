import type Phaser from 'phaser';
import type { CardDef } from '../engine/types';
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
 */

// Bake at half card size (150×210) — grids display at ~0.47–0.48 card scale,
// so the one resample down from the bake stays visually lossless at k=1.
const THUMB_SCALE = 0.5;
// The legendary crown overhangs the 300×420 card rect by 4px at the top
// (Containers don't clip, but a texture does) — bleed the bake vertically.
const BLEED_Y = 8;

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
/** Bake (or reuse) the thumbnail texture for a card; returns its texture key. */
export function ensureCardThumb(scene: Phaser.Scene, card: CardDef, landStyle?: string): string {
  const key = cardThumbKey(card.id, landStyle);
  if (scene.textures.exists(key)) return key;

  // Render one throwaway CardView into the texture. Created and destroyed
  // synchronously, it never survives to a screen render pass. Works on both
  // WebGL and canvas renderers (DynamicTexture handles either path), and
  // fx:'none' matches what the grids rendered live before caching. Built
  // fully before the texture is registered, so a failed bake caches nothing.
  const bakeScale = THUMB_SCALE * activeRenderScale();
  const w = CARD_W * bakeScale;
  const h = (CARD_H + 2 * BLEED_Y) * bakeScale;
  const view = new CardView(scene, 0, 0);
  view.setCard(card, { fx: 'none', landStyle });
  view.setScale(bakeScale);
  const dt = scene.textures.addDynamicTexture(key, w, h);
  if (dt) dt.draw(view, w / 2, h / 2);
  view.destroy();
  return key;
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
): Phaser.GameObjects.Image {
  const displayScale = cardScale / (THUMB_SCALE * activeRenderScale());
  return scene.add.image(x, y, ensureCardThumb(scene, card, landStyle)).setScale(displayScale);
}
