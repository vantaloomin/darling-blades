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
 * so a half-built phone scene never reaches a player. On the desktop (wide
 * profile) the scenes in `DESKTOP_SCENES` draw the same composition at
 * desktop density instead of their old 1280x720 layouts.
 *
 * Phaser-free: the camera numbers are worked out here and applied in
 * `src/ui/SceneBackdrop.ts`.
 */

import type { ScreenMetrics } from './screenMetrics';

/** Scene keys with a compact composition. Each joins in the PR that builds it. */
export const COMPACT_SCENES: ReadonlySet<string> = new Set(['Preload', 'MainMenu', 'Play', 'PracticePicker', 'Gauntlet', 'Settings', 'Profile', 'Achievements', 'Glossary', 'Collection', 'Shop', 'DeckBuilder', 'Duel', 'PackOpening', 'Limited', 'LimitedDeckBuilder', 'LimitedDraft', 'Story']);

/**
 * The desktop pass (owner ruling 2026-10-14, S1 B): on the wide profile these
 * scenes draw the same compact composition as a phone, in a design space of
 * 1280x720 divided by `DESKTOP_DENSITY`, so the compact type ramp lands at
 * about the desktop ramp's size. The Duel keeps its own desktop layout (S2 A).
 * Each scene joins in the PR that tunes it for desktop.
 */
export const DESKTOP_SCENES: ReadonlySet<string> = new Set(['Preload', 'MainMenu', 'Play', 'PracticePicker', 'Gauntlet', 'Settings', 'Profile', 'Achievements', 'Glossary', 'Collection', 'Shop', 'DeckBuilder', 'PackOpening', 'Limited', 'LimitedDeckBuilder', 'LimitedDraft', 'Story']);

/** Desktop design px per compact design px: the compact body (14) at about the desktop body (16). */
export const DESKTOP_DENSITY = 1.2;

/** The desktop content box's inset from the design space's edges (no safe areas on a desktop). */
export const DESKTOP_MARGIN = { x: 20, y: 14 } as const;

/** The compact metrics a desktop scene lays itself out in: the 1280x720 window at `DESKTOP_DENSITY`. */
export function desktopCompactMetrics(): ScreenMetrics {
  const width = Math.round(1280 / DESKTOP_DENSITY);
  const height = Math.round(720 / DESKTOP_DENSITY);
  return {
    profile: 'wide',
    device: 'desktop',
    orientation: 'landscape',
    presentation: 'fill',
    variant: 'regular',
    design: { width, height },
    content: { x: DESKTOP_MARGIN.x, y: DESKTOP_MARGIN.y, width: width - 2 * DESKTOP_MARGIN.x, height: height - 2 * DESKTOP_MARGIN.y },
    scale: 1,
    renderK: 1,
  };
}

let desktopOn = true;

/** Dev only: `?desktop=classic` draws the old desktop layouts, for before shots. src/gameBoot.ts calls it only on the dev server. */
export function disableDesktopCompactScenes(): void {
  desktopOn = false;
}

let metrics: ScreenMetrics | null = null;

/** Scenes a dev session has switched on early (`?phone=Draft`), before their switch flips in COMPACT_SCENES (and, on the desktop, DESKTOP_SCENES). */
const devScenes = new Set<string>();

/**
 * Dev only: lay a scene that is still being built out in the compact space
 * anyway, so its PRs can be checked on a phone before it joins
 * `COMPACT_SCENES`. src/gameBoot.ts calls it only on the dev server.
 */
export function enableDevCompactScene(sceneKey: string): void {
  devScenes.add(sceneKey);
}

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
export function compactSceneMetrics(
  sceneKey: string,
  scenes: ReadonlySet<string> = COMPACT_SCENES,
  desktopScenes: ReadonlySet<string> = DESKTOP_SCENES,
): ScreenMetrics | null {
  if (metrics !== null) return scenes.has(sceneKey) || devScenes.has(sceneKey) ? metrics : null;
  return desktopOn && (desktopScenes.has(sceneKey) || devScenes.has(sceneKey)) ? desktopCompactMetrics() : null;
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

/**
 * Compact scenes that hold no game in progress, so a refit may restart them
 * in the new screen's layout (src/gameBoot.ts). The rest keep the layout they
 * were built with and only re-fit the camera.
 */
export const RELAYOUT_SCENES: ReadonlySet<string> = new Set(['MainMenu', 'Play', 'PracticePicker', 'Gauntlet', 'Settings', 'Profile', 'Achievements', 'Glossary', 'Collection', 'Shop', 'Limited']);

/**
 * True when a scene built for one design space no longer fits the screen: a
 * side changed by more than 10%, as when Safari reported the upright size at
 * load or its bars came or went. A few pixels of jitter keep the layout.
 */
export function designOutgrown(built: { width: number; height: number }, now: ScreenMetrics): boolean {
  const off = (a: number, b: number): boolean => Math.abs(a - b) > 0.1 * Math.max(a, b);
  return off(built.width, now.design.width) || off(built.height, now.design.height);
}
