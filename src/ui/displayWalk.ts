import Phaser from 'phaser';

/**
 * The one display-list walk the art safety scans share (1.9 lane D;
 * docs/plan-art-streaming.md section 3, "The safety scan"): the card-art
 * store's (`src/scenes/ArtLoaderScene.ts`) and the thumbnail budget's
 * (`src/ui/CardThumbCache.ts`). Both ask the same question, "does any live
 * object still draw this texture?", so they read the same scenes and walk the
 * same way; two copies could drift, and a scan that misses an object is a
 * destroyed-texture crash.
 */

/** A display-list object as the scans read it: every field optional. */
export interface DrawnObject {
  type?: string;
  active?: boolean;
  texture?: { key: string; manager: unknown };
  frame?: { width: number; source: unknown };
  list?: unknown;
  mask?: { bitmapMask?: unknown } | null;
  awaitingArt?: unknown;
}

/** Scenes that hold live objects: created and not shut down (sleeping ones included). */
export function liveScenes(game: Phaser.Game): Phaser.Scene[] {
  return game.scene.scenes.filter((scene) => {
    const status = scene.sys.settings.status;
    return status >= Phaser.Scenes.CREATING && status < Phaser.Scenes.SHUTDOWN && scene.sys.displayList !== undefined;
  });
}

/**
 * Visit every object in the live scenes' display lists, walking into
 * Containers and Layers and into the source object of a bitmap mask. Each
 * object is visited once.
 */
export function forEachDrawn(game: Phaser.Game, visit: (obj: DrawnObject, scene: Phaser.Scene) => void): void {
  const seen = new Set<unknown>();
  const walk = (value: unknown, scene: Phaser.Scene): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const obj = value as DrawnObject;
    visit(obj, scene);
    if (Array.isArray(obj.list)) for (const child of obj.list) walk(child, scene);
    if (obj.mask?.bitmapMask) walk(obj.mask.bitmapMask, scene);
  };
  for (const scene of liveScenes(game)) {
    for (const obj of scene.sys.displayList.list) walk(obj, scene);
  }
}
