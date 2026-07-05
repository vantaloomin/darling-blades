import type Phaser from 'phaser';
import { Services } from '../meta/services';
import { animTimeScale } from '../platform/animPolicy';
import { activeRenderScale } from '../platform/renderScale';

/**
 * Per-scene backdrop layer (docs/scene-art.md §3 integration contract).
 *
 * `applyBackdrop` runs at the TOP of a scene's create()/build function, before
 * any content, so display-list order keeps the backdrop under everything —
 * no setDepth games needed (DuelScene's explicit depths start at 40, all
 * above). It is the single choke point for the real-art-or-gradient decision:
 *
 * - If the manifest-loaded texture `scene-<key>` exists, it cover-fits the real
 *   PNG to the 1280×720 design resolution at (640,360) and draws the per-scene
 *   dim/tint rect over it (from the §3 table) so the existing UI keeps reading.
 * - If it does NOT exist (the reality today — no scene PNGs are generated yet),
 *   it invokes the scene's `fallback` — the scene's current procedural gradient
 *   — leaving today's look byte-identical. Zero 404s (only manifest-listed
 *   files are ever loaded; PreloadScene queues them).
 *
 * The returned objects are added to the scene's display list normally; because
 * scenes RESTART (DuelScene between gauntlet rungs) the caller must invoke this
 * exactly once per create() — Phaser clears the display list on restart, so no
 * backdrop leaks or stacks across restarts.
 */

/** Design resolution — matches src/main.ts (Phaser.Scale.FIT, 1280×720). */
const DESIGN_W = 1280;
const DESIGN_H = 720;

/**
 * Texture key for a manifest scene key (docs/scene-art.md §"Files & manifest":
 * texture-key convention `scene-<asset-key>`). The stage-backdrop asset keys
 * already start with `scene-` (`scene-mainmenu`, `scene-duel`, …), so they map
 * to themselves; the two portrait assets (`card-back`, `pack-art`) gain the
 * prefix, giving the doc's named `scene-card-back` / `scene-pack-art` keys.
 * The single source of truth for the loader (PreloadScene / BootScene) and the
 * consumers (this helper, the two bake functions).
 */
export function sceneTextureKey(manifestKey: string): string {
  return manifestKey.startsWith('scene-') ? manifestKey : `scene-${manifestKey}`;
}

/**
 * Per-scene settings hook — runs first inside applyBackdrop, i.e. at the top
 * of every scene's create(), and is idempotent (safe across DuelScene's
 * gauntlet restarts, which reset the camera):
 *
 * - Render scale: the game canvas is 1280·k × 720·k (src/main.ts /
 *   src/platform/renderScale.ts); zooming the main camera by k and
 *   re-centering on the design midpoint keeps every scene in its 1280×720
 *   logical coordinate space while rendering at the higher backing
 *   resolution. At k=1 this is exactly today's identity setup.
 * - Animations: 'off' fast-forwards the scene's tweens (high timeScale —
 *   callbacks still fire, tweens are never removed, so tween-driven flow
 *   can't deadlock); 'full'/'reduced' explicitly reset to 1 so flipping the
 *   setting back recovers on the next scene change.
 *
 * NOTE for scenes that animate the camera zoom themselves (PackOpening's
 * zoomTo escalation): absolute zoom targets must be multiplied by
 * activeRenderScale() to compose with the base zoom.
 */
export function applySceneSettings(scene: Phaser.Scene): void {
  const k = activeRenderScale();
  const cam = scene.cameras?.main;
  if (cam) {
    cam.setZoom(k);
    cam.centerOn(DESIGN_W / 2, DESIGN_H / 2);
  }
  scene.tweens.timeScale = animTimeScale(Services.save.data.settings.animations);
}

export interface BackdropOpts {
  /** Dim/tint colour drawn over the real art (0xRRGGBB). Omit for none. */
  dim?: number;
  /** Alpha of the dim rect (0..1). */
  dimAlpha?: number;
  /**
   * The scene's existing procedural background, run only when the real-art
   * texture is absent. Keeps today's exact look as the graceful fallback.
   */
  fallback: (scene: Phaser.Scene) => void;
}

/**
 * Add the `scene-<key>` backdrop if its texture is loaded, else run the
 * scene's gradient fallback. Returns the created backdrop objects (empty when
 * the fallback ran) — callers generally ignore it.
 */
export function applyBackdrop(
  scene: Phaser.Scene,
  key: string,
  opts: BackdropOpts,
): Phaser.GameObjects.GameObject[] {
  // Settings hook first: camera render-scale zoom + tween time-scale. Every
  // scene calls applyBackdrop at the top of create(), which makes this the
  // single per-scene apply point for boot-time settings.
  applySceneSettings(scene);

  const texKey = `scene-${key}`;
  if (!scene.textures.exists(texKey)) {
    // No real art — the scene's current procedural background is the unchanged
    // fallback (proves visually identical to today).
    opts.fallback(scene);
    return [];
  }

  const created: Phaser.GameObjects.GameObject[] = [];

  // Cover-fit the source to the full design frame at its centre. Authored art
  // is 1:1 at 1280×720 so scale is 1, but cover-fit is robust to any source.
  const img = scene.add.image(DESIGN_W / 2, DESIGN_H / 2, texKey);
  const scale = Math.max(DESIGN_W / img.width, DESIGN_H / img.height);
  img.setScale(scale);
  created.push(img);

  // Per-scene dim/tint rect drawn over the art so existing UI stays readable
  // (docs/scene-art.md §3 dim table). Calibrated starting points; raise the
  // dim before ever asking for darker regenerated art.
  if (opts.dim !== undefined && (opts.dimAlpha ?? 0) > 0) {
    const dimRect = scene.add.rectangle(
      DESIGN_W / 2,
      DESIGN_H / 2,
      DESIGN_W,
      DESIGN_H,
      opts.dim,
      opts.dimAlpha,
    );
    created.push(dimRect);
  }

  return created;
}
