import Phaser from 'phaser';
import { ART_EVENT_PROGRESS, artMissing, ensureArt, liveArtStore, manifestArtKeys } from '../art/artLoader';
import type { ArtLease, ArtPriority, ArtTier } from '../art/artStore';
import { PagedRequests } from '../art/pagedRequests';
import { bindArtLease } from '../art/artLifetime';
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
  owner: Phaser.Scene | Phaser.GameObjects.Container,
  ids: Iterable<string> | null,
  handlers: ArtWaitHandlers,
): void {
  const scene = owner instanceof Phaser.Scene ? owner : owner.scene;
  if (!scene || (owner instanceof Phaser.GameObjects.Container && !owner.active)) return;
  const list = ids === null ? null : [...ids];
  const store = liveArtStore();
  const lease = store === null ? null : bindArtLease(
    store.lease(`wait:${scene.sys.settings.key}`, list ?? manifestArtKeys(), { priority: 'now' }),
    (release) => onArtOwnerGone(scene, owner, release),
  );
  waitForArt(scene, list, handlers, () => lease?.ready ?? ensureArt(list), 'primary', owner);
}

/** Both shutdown and destruction end a wait; re-entry gets fresh listeners. */
function onArtOwnerGone(
  scene: Phaser.Scene,
  owner: Phaser.Scene | Phaser.GameObjects.Container,
  gone: () => void,
): () => void {
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, gone);
  scene.events.once(Phaser.Scenes.Events.DESTROY, gone);
  if (owner instanceof Phaser.GameObjects.Container) owner.once(Phaser.GameObjects.Events.DESTROY, gone);
  return () => {
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, gone);
    scene.events.off(Phaser.Scenes.Events.DESTROY, gone);
    if (owner instanceof Phaser.GameObjects.Container) owner.off(Phaser.GameObjects.Events.DESTROY, gone);
  };
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
  return bindArtLease(
    store.lease(`scene:${scene.sys.settings.key}`, ids ?? manifestArtKeys(), { priority, tier }),
    (release) => onArtOwnerGone(scene, scene, release),
  );
}

/** `awaitArt`'s wait, with what "ready" means supplied by the caller. */
function waitForArt(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  handlers: ArtWaitHandlers,
  whenReady: () => Promise<void>,
  tier: ArtTier = 'primary',
  owner: Phaser.Scene | Phaser.GameObjects.Container = scene,
): void {
  const missing = (): number => liveArtStore()?.missing(ids ?? manifestArtKeys(), tier).length ?? artMissing(ids).length;
  const total = missing();
  if (total === 0) {
    handlers.onReady();
    return;
  }

  const onProgress = (): void => {
    handlers.onWait?.(loadingLine(total, missing()));
  };
  let settled = false;
  const stopListening = (): void => {
    scene.game.events.off(ART_EVENT_PROGRESS, onProgress);
  };
  const onShutdown = (): void => {
    settled = true;
    stopListening();
    stopGone();
  };
  const stopGone = onArtOwnerGone(scene, owner, onShutdown);
  scene.game.events.on(ART_EVENT_PROGRESS, onProgress);
  handlers.onWait?.(loadingLine(total, total));

  void whenReady().then(() => {
    if (settled) return;
    settled = true;
    stopGone();
    stopListening();
    if (!scene.sys.isActive() || (owner instanceof Phaser.GameObjects.Container && !owner.active)) return;
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
 * With the 1.8 queue, Collection and Decks gate on the whole card set
 * (`gateOnPagedArt`), so early in a session this wait can be the longest one
 * in the game.
 *
 * While art streams through the art store (1.9 lane D), the gate also holds
 * `ids` for the scene's life (`sceneArtLease`, at `now`), whether or not it had
 * to wait, so nothing the build draws is evicted under it. With `null` that
 * lease pins the whole manifest, which is why the scenes that page through the
 * whole set build at once under the store and ask for art page by page
 * (`gateOnPagedArt`, `PagedArt`).
 */
export function gateOnArt(
  scene: Phaser.Scene,
  ids: Iterable<string> | null,
  build: () => void,
  options: { tier?: ArtTier; releaseAfterBuild?: boolean } = {},
): void {
  const list = ids === null ? null : [...ids];
  const tier = options.tier ?? 'primary';
  const lease = sceneArtLease(scene, list, 'now', tier);
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
      try {
        build();
      } finally {
        if (options.releaseAfterBuild) lease?.release();
      }
    },
  };
  // Through the store the scene's own lease is the wait; through the queue,
  // exactly the wait `awaitArt` has always made.
  if (lease !== null) waitForArt(scene, list, handlers, () => lease.ready, tier);
  else awaitArt(scene, list, handlers);
}

/**
 * How long a binder page turn holds its new spread for the spread's art
 * before drawing stand-ins, which fill in as the art lands
 * (docs/plan-art-streaming.md, owner question 3, ruled 2026-09-28: the turn
 * starts at once; the art waits up to about 150 ms).
 */
export const PAGE_ART_HOLD_MS = 150;

/**
 * Build a scene that pages through the whole card set and asks for its art
 * page by page (`PagedArt`): Collection, the Deck Builder and the Showcase
 * (1.9 lane D, S5a). While art streams through the store it builds at once,
 * on its first frame, since the whole-set gate there would be a `now` lease
 * on every file. With the 1.8 queue (the store off) it is exactly the
 * whole-set `gateOnArt` these scenes always had.
 */
export function gateOnPagedArt(scene: Phaser.Scene, build: () => void): void {
  if (liveArtStore() === null) gateOnArt(scene, null, build);
  else build();
}

export interface PagedArtOptions {
  /** The store tier to ask for: `half` (the default) for thumbnail bakes, `primary` for live cards. */
  tier?: ArtTier;
  /** A modal's container: its destruction ends the requests, as the scene's shutdown does. */
  owner?: Phaser.GameObjects.GameObject;
}

/**
 * The art requests of one paged surface, bound to a scene: the rule is
 * `PagedRequests` (`src/art/pagedRequests.ts`, Phaser-free and tested); this
 * adds the lifetime (the scene's shutdown or destruction, or a modal owner's
 * destruction, ends everything) and the timer. The hold is wall-clock, not
 * the scene clock: the scene clock smooths over the long first frames of a
 * build, which stretched a 150 ms hold past 250 ms in the probe.
 */
export class PagedArt {
  private readonly requests: PagedRequests;

  constructor(
    private readonly scene: Phaser.Scene,
    label: string,
    options: PagedArtOptions = {},
  ) {
    this.requests = new PagedRequests(label, options.tier ?? 'half', {
      store: () => liveArtStore(),
      schedule: (fn, ms) => {
        const timer = setTimeout(fn, ms);
        return () => clearTimeout(timer);
      },
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.release, this);
    options.owner?.once(Phaser.GameObjects.Events.DESTROY, () => this.release());
  }

  /** See `PagedRequests.show`. */
  show(shown: Iterable<string>, soon: Iterable<string> = [], draw?: (afterHold: boolean) => void, holdMs = 0): boolean {
    return this.requests.show(shown, soon, draw, holdMs);
  }

  /** End every request, and any held draw. Safe to call twice. */
  release(): void {
    this.requests.release();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.release, this);
  }
}
