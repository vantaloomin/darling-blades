/**
 * Which scenes draw their own compact (phone) composition, and the space they
 * draw in (docs/plan-mobile-overhaul.md C2, mobile wave 2).
 *
 * Under the compact profile every scene used to fit its 1280x720 design window
 * into the phone by camera zoom: the desktop layout, shrunk. A scene listed in
 * `COMPACT_SCENES` instead lays itself out in the phone's own design space,
 * where one design px is one CSS px on a phone (a tablet's is the reference
 * phone scaled up, M22), inside `ScreenMetrics.content`. The list is each
 * scene's switch (M6): a scene joins it only when its compact layout is done,
 * so a half-built phone scene never reaches a player. The desktop (wide
 * profile) never reads any of this.
 *
 * Phaser-free: the camera numbers are worked out here and applied in
 * `src/ui/SceneBackdrop.ts`.
 */

import type { ScreenMetrics } from './screenMetrics';

/** Scene keys with a compact composition. Each joins in the PR that builds it. */
export const COMPACT_SCENES: ReadonlySet<string> = new Set(['Preload', 'MainMenu', 'Play', 'PracticePicker', 'Gauntlet', 'Settings', 'Profile', 'Achievements', 'Glossary', 'Collection']);

let metrics: ScreenMetrics | null = null;

/** Set by src/gameBoot.ts under the compact profile, and again when the screen changes size. */
export function setActiveCompactMetrics(next: ScreenMetrics | null): void {
  metrics = next !== null && next.profile === 'compact' ? next : null;
}

/** The compact screen the game is running on, or null on the wide profile. */
export function activeCompactMetrics(): ScreenMetrics | null {
  return metrics;
}

/**
 * The compact screen a scene should lay itself out in: the active metrics when
 * the compact profile is on and the scene has a compact composition, else
 * null (the scene draws its 1280x720 layout, fitted).
 */
export function compactSceneMetrics(sceneKey: string, scenes: ReadonlySet<string> = COMPACT_SCENES): ScreenMetrics | null {
  return metrics !== null && scenes.has(sceneKey) ? metrics : null;
}

export interface CompactCamera {
  /** Canvas px per design px. */
  zoom: number;
  /** The design point the camera centres on. */
  centerX: number;
  centerY: number;
}

/**
 * The camera for a compact scene: the design space it was built in, fitted
 * whole into the canvas and centred. At build time the design space is the
 * screen's, so this fills the canvas exactly; after the screen changes size
 * (a browser bar, full screen) the scene keeps the layout it was built with,
 * fitted, until its next start re-lays it out at the new size.
 */
export function compactCamera(design: { width: number; height: number }, canvas: { width: number; height: number }): CompactCamera {
  const w = design.width > 0 ? design.width : 1;
  const h = design.height > 0 ? design.height : 1;
  const zoom = Math.min(canvas.width / w, canvas.height / h);
  return { zoom: zoom > 0 && Number.isFinite(zoom) ? zoom : 1, centerX: w / 2, centerY: h / 2 };
}
