import Phaser from 'phaser';
import { ART_EVENT_PROGRESS, artMissing, ensureArt, liveArtStore, manifestArtKeys } from '../art/artLoader';
import type { ArtLease, ArtPriority, ArtTier } from '../art/artStore';
import { backLabelFor } from './navigation';
import { applySceneSettings } from './SceneBackdrop';
import { theme } from './theme';
import { backButton } from './themeWidgets';

/**
 * Card-art gate for scenes that draw cards (1.8, with `src/art/artLoader.ts`).
 *
 * Since `PreloadScene` stopped queueing all 1,537 card images before the menu,
 * a scene reached in the first seconds of a session can outrun the loader. Wrap
 * such a scene's `create()` body in `gateOnArt` with the ids it actually draws:
 * the loader moves them to the front of its queue and the scene builds the
 * moment they are in.
 *
 * Once the session has finished loading — the normal case after ~16 s — the
 * build runs SYNCHRONOUSLY, so no scene's behaviour changes.
 *
 * `awaitArt` is the same wait WITHOUT the full-screen overlay, for art needed
 * by something that opens over an already-built scene (a modal), where
 * blanking the live scene behind it would be wrong.
 */

const DESIGN_W = theme.design.width;
const DESIGN_H = theme.design.height;
/** The loading overlay sits above whatever the gated scene has drawn so far. */
const GATE_DEPTH = 10_000;
/** The boot loader's own line; the one loading string the game has. */
const LOADING_LABEL = 'Unsheathing Blades…';

/**
 * How the loading line looks: the boot loader's own face and size, so every
 * wait in the game reads as the same wait. Exported for the modal waits that
 * draw the line in their own chrome (`awaitArt` callers). The colour is read
 * live, so a wait drawn after a contrast change takes the palette in force.
 */
export const ART_WAIT_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Georgia, serif',
  fontSize: '22px',
  get color(): string {
    return theme.colors.muted;
  },
};

/** The loading line as a percentage of THIS wait's set, not of the manifest. */
function loadingLine(total: number, remaining: number): string {
  const pct = Math.round(((total - remaining) / total) * 100);
  return `${LOADING_LABEL} ${pct}%`;
}

export interface ArtWaitHandlers {
  /**
   * Called with the loading line the moment a wait begins, and again on every
   * `art-progress` until it ends. Never called when the art is already in, so
   * a call site can build its label lazily and pay nothing in the fast path.
   */
  onWait?: (line: string) => void;
  onReady: () => void;
}

/**
 * Wait for `ids` (`null` = every card in the set), then call `onReady`.
 * Synchronous when nothing is missing. If the scene shuts down first neither
 * callback fires again — nothing is ever built into a dead scene, which
 * matters for the scenes that restart (`DuelScene` between gauntlet rungs) and
 * for back-navigation during a wait.
 */
export function awaitArt(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  handlers: ArtWaitHandlers,
): void {
  waitForArt(scene, ids, handlers, () => ensureArt(ids));
}

/**
 * A lease on `ids` (`null` = the whole manifest) for as long as `scene` runs:
 * taken now, released when the scene shuts down (docs/plan-art-streaming.md
 * section 1). `DuelScene`'s restart between rungs keeps its shared set,
 * because the old scene's shutdown and the new one's create run in the same
 * scene-manager step, before the loader scene's next eviction pass.
 *
 * Null, and nothing held, while art streams through the 1.8 queue (the art
 * store is off), where nothing is ever unloaded.
 */
export function sceneArtLease(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  priority: ArtPriority = 'now',
  tier: ArtTier = 'primary',
): ArtLease | null {
  const store = liveArtStore();
  if (store === null) return null;
  const lease = store.lease(`scene:${scene.sys.settings.key}`, ids ?? manifestArtKeys(), { priority, tier });
  const release = (): void => {
    lease.release();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
    scene.events.off(Phaser.Scenes.Events.DESTROY, release);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
  scene.events.once(Phaser.Scenes.Events.DESTROY, release);
  return lease;
}

/** `awaitArt`'s wait, with what "ready" means supplied by the caller. */
function waitForArt(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  handlers: ArtWaitHandlers,
  whenReady: () => Promise<void>,
): void {
  const total = artMissing(ids).length;
  if (total === 0) {
    handlers.onReady();
    return;
  }

  const onProgress = (): void => {
    handlers.onWait?.(loadingLine(total, artMissing(ids).length));
  };
  handlers.onWait?.(loadingLine(total, total));
  scene.game.events.on(ART_EVENT_PROGRESS, onProgress);

  let settled = false;
  const stopListening = (): void => {
    scene.game.events.off(ART_EVENT_PROGRESS, onProgress);
  };
  const onShutdown = (): void => {
    settled = true;
    stopListening();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

  void whenReady().then(() => {
    if (settled || !scene.sys.isActive()) return;
    settled = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    stopListening();
    handlers.onReady();
  });
}

/**
 * Run `build` once every id in `ids` has its art (`null` = every card in the
 * set). While waiting, cover the scene with the boot loader's own label over a
 * dim field. This is for a whole scene's `create()` body; something that opens
 * over a built scene uses `awaitArt` and draws the line in its own chrome.
 *
 * The wait is never a trap. The scene's own back control and Esc handler are
 * built by `build`, which has not run yet, so the wait screen carries its own:
 * the shared back affordance (at the touch-target floor) and Esc, both to the
 * main menu. Leaving shuts the scene down, and `awaitArt` then drops the build.
 * Collection and Decks gate on the whole card set, so early in a session this
 * wait can be the longest one in the game.
 *
 * While art streams through the art store (1.9 lane D), the gate also holds
 * `ids` for the scene's life (`sceneArtLease`, at `now`), whether or not it had
 * to wait, so nothing the build draws is evicted under it. With `null` that
 * lease pins the whole manifest, which is why the store stays off until
 * Collection, the Deck Builder and the Showcase gate on what they show (S5a).
 */
export function gateOnArt(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  build: () => void,
): void {
  const list = ids === null ? null : [...ids];
  const lease = sceneArtLease(scene, list, 'now');
  let shade: Phaser.GameObjects.Graphics | null = null;
  let label: Phaser.GameObjects.Text | null = null;
  let back: Phaser.GameObjects.Text | null = null;

  const keyboard = scene.input.keyboard;
  let leaving = false;
  const leave = (): void => {
    if (leaving || !scene.sys.isActive()) return;
    leaving = true;
    scene.scene.start('MainMenu');
  };
  const onEsc = (): void => leave();
  const stopEsc = (): void => {
    keyboard?.off('keydown-ESC', onEsc);
  };

  const handlers: ArtWaitHandlers = {
    onWait: (line) => {
      if (label === null) {
        // create() has not run yet, so no backdrop has applied the
        // render-scale camera hook; the label would sit in the top-left
        // quadrant at k>1 without this (the same reason PreloadScene calls it
        // by hand). A later applyBackdrop re-applies it idempotently.
        applySceneSettings(scene);
        shade = scene.add
          .graphics()
          .fillStyle(theme.graphics.dim, 1)
          .fillRect(0, 0, DESIGN_W, DESIGN_H)
          .setDepth(GATE_DEPTH);
        label = scene.add
          .text(DESIGN_W / 2, DESIGN_H / 2, line, ART_WAIT_TEXT_STYLE)
          .setOrigin(0.5)
          .setDepth(GATE_DEPTH + 1);
        back = backButton(scene, backLabelFor('MainMenu'), () => leave()).setDepth(GATE_DEPTH + 1);
        keyboard?.on('keydown-ESC', onEsc);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopEsc);
        return;
      }
      label.setText(line);
    },
    onReady: () => {
      // Hand Esc back before `build` registers the scene's own handler.
      stopEsc();
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stopEsc);
      shade?.destroy();
      label?.destroy();
      back?.destroy();
      build();
    },
  };
  // Through the store the scene's own lease is the wait; through the queue,
  // exactly the wait `awaitArt` has always made.
  if (lease !== null) waitForArt(scene, list, handlers, () => lease.ready);
  else awaitArt(scene, list, handlers);
}
