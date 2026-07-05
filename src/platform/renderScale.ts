/**
 * Render-scale ("supersampled backing store") resolution logic — pure and
 * headless, mirroring quality.ts: the decision function takes an injected
 * environment so tests drive it with literals; the browser wiring lives in
 * src/main.ts, which resolves the factor once pre-boot and stores it here.
 *
 * How render scale works (the whole pipeline, for the next reader):
 * - `SaveData.settings.renderScale` is a hard-coded 16:9 resolution factor:
 *   1 / 1.5 / 2 = 1280×720 / 1920×1080 / 2560×1440 (the "Automatic" per-device
 *   option was removed 2026-07-04, user-directed).
 * - src/main.ts resolves it to a concrete factor k BEFORE constructing the
 *   game and builds the canvas at 1280·k × 720·k. In the DESKTOP (Tauri) app
 *   it also resizes the OS window to 1280·k × 720·k (see `desktopWindowSize` +
 *   src/platform/desktopWindow.ts) so the setting is a real resolution: the
 *   window matches the backing store → native 1:1 (a window clamped smaller
 *   than the screen just supersamples down, still crisp). In a plain browser
 *   the window can't be resized, so Scale.FIT keeps the CSS size identical for
 *   every k and the factor is supersampling-only there.
 * - `applySceneSettings` (src/ui/SceneBackdrop.ts, invoked by applyBackdrop
 *   at the top of every scene's create()) sets `cameras.main.setZoom(k)` and
 *   re-centers on (640,360), so every scene keeps its 1280×720 logical
 *   coordinate space while rendering into the larger backing store.
 * - Pointer math stays correct for free: every consumer in this repo reads
 *   `pointer.worldX/worldY`, which Phaser maps through the camera (zoom and
 *   scroll included). Gesture slop thresholds (gestureCore.ts) are compared
 *   in world px, and 1 world px maps to the SAME number of CSS px for every
 *   k (k cancels: world→canvas is ×k, canvas→CSS is ÷k) — so touch feel is
 *   k-invariant with no binder changes.
 *
 * Changing the setting requires a reload (the canvas is sized at game
 * construction); the Settings UI persists + flushes + reloads.
 */

/**
 * LIVE (unlocked 2026-07-04) — the render-scale pipeline runs end-to-end:
 * setting → resolution → canvas sizing (1280k × 720k) → per-scene camera zoom
 * (SceneBackdrop.applySceneSettings) → Text resolution. The scene-layout
 * migration that this interlock guarded is complete: every layout position in
 * src/scenes + src/ui is expressed in the 1280×720 DESIGN constants, and
 * PackOpeningScene's absolute `cameras.main.zoomTo(...)` targets are
 * multiplied by activeRenderScale() so they compose with the base zoom.
 *
 * THE LAYOUT RULE this migration established (new scenes must follow it):
 * never read `this.scale.width/height` for layout — that is the GAME size
 * (1280k × 720k), not the 1280×720 design window the zoomed camera shows. At
 * k>1, `width / 2` = 960+ (off-center) and `width - 30` is fully offscreen.
 * Lay out against the design constants (1280 / 720); the camera shows exactly
 * that window at every k. Grep proof of the invariant: `\bthis\.scale\b` has
 * zero layout hits in src. (Patching ScaleManager's getters to lie was
 * rejected: Phaser 3.90 internals read them — CameraManager boot viewports,
 * RESIZE handling — so the lie corrupts camera viewports.)
 *
 * Kept as a kill-switch: flipping this back to false re-clamps k to 1 at the
 * main.ts boundary (the Settings chips gray out via their own note flow only
 * on lite tier — re-lock would need SettingsScene re-gating too).
 */
export const RENDER_SCALE_UNLOCKED = true;

/**
 * The persisted setting: a hard-coded backing-store factor (no per-device
 * "auto" — removed 2026-07-04). 1 / 1.5 / 2 = 720p / 1080p / 1440p. It is the
 * same domain as the resolved `RenderK`; the two stay distinct type aliases
 * so call sites read intent (a stored preference vs the applied factor).
 */
export type RenderScaleSetting = 1 | 1.5 | 2;
/** A concrete resolved factor. */
export type RenderK = 1 | 1.5 | 2;

/**
 * Resolve the persisted setting to a concrete backing-store factor.
 *
 * - `lite` tier always resolves 1, even for an explicit 1.5/2 in the save
 *   (a 2560×1440 backing store blows the mobile VRAM/fill-rate budget); the
 *   Settings UI shows the high-res chips disabled on lite to match.
 * - Otherwise the chosen resolution passes through unchanged.
 */
export function resolveRenderScale(setting: RenderScaleSetting, tier: 'full' | 'lite'): RenderK {
  return tier === 'lite' ? 1 : setting;
}

const DESIGN_W = 1280;
const DESIGN_H = 720;

/**
 * The desktop window's LOGICAL size for a render factor. The target is the
 * literal 16:9 resolution (1280·k × 720·k), uniformly scaled down (aspect
 * preserved) to fit the screen's work area with a small margin — so choosing a
 * resolution larger than the display fills the screen instead of overflowing
 * it, and the extra render pixels simply become supersampling (the canvas
 * backing stays 1280·k × 720·k, so a clamped window downscales crisply, and a
 * fitting window is native 1:1). Pure so it can be unit-tested; the actual
 * Tauri resize lives in src/platform/desktopWindow.ts.
 */
export function desktopWindowSize(
  k: RenderK,
  availWidth: number,
  availHeight: number,
  margin = 0.95,
): { width: number; height: number } {
  const targetW = DESIGN_W * k;
  const targetH = DESIGN_H * k;
  // Degenerate/missing screen metrics: no constraint, use the exact target.
  if (!(availWidth > 0) || !(availHeight > 0)) return { width: targetW, height: targetH };
  const fit = Math.min(1, (availWidth * margin) / targetW, (availHeight * margin) / targetH);
  return { width: Math.round(targetW * fit), height: Math.round(targetH * fit) };
}

// ---------------------------------------------------------------------------
// The active factor: resolved once pre-boot by src/main.ts, read by the
// per-scene hook (SceneBackdrop.applySceneSettings). Defaults to 1 so
// headless environments (and any read before boot) behave exactly as today.
// ---------------------------------------------------------------------------

let active: RenderK = 1;

/** Set by src/main.ts once, before the Phaser.Game is constructed. */
export function setActiveRenderScale(k: RenderK): void {
  active = k;
}

/** The factor the running game was constructed with (1 in headless/tests). */
export function activeRenderScale(): RenderK {
  return active;
}
