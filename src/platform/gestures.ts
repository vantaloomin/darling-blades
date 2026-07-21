/**
 * Touch glue for Phaser scenes (mobile-lan-plan §1.3–1.4): the thin binder
 * that wires the pure GestureRecognizer (gestureCore.ts) onto interactive
 * objects, the device-level touch predicate, and the hit-area inflation
 * helper.
 *
 * DESKTOP INVARIANT: everything here is gated per-pointer on
 * `pointer.wasTouch` (set by Phaser's TouchManager on every touch event,
 * cleared by MouseManager on every mouse event — verified against the pinned
 * 3.90 internals). Mouse input never enters the classifier, never gets the
 * pressed visual, and never sees sticky previews — the existing mouse
 * handlers in the scenes stay authoritative for it.
 *
 * Only `import type` from Phaser: the module is runtime-Phaser-free (types
 * erase at compile time), like the rest of src/platform.
 *
 * Known traps honored (playbook §11 + zoom-review history):
 * - long-press timers guard `.active` and are cancelled by the pressed
 *   object's DESTROY event (hand re-syncs rebuild whole rows mid-press);
 * - the scene-level pointer listeners self-gate on layer state, so ModalGuard
 *   stays effective: a guard-disabled object never receives its own
 *   `pointerup`, and without that object-level event no tap is committed;
 * - one layer per scene, torn down on the scene SHUTDOWN event — DuelScene's
 *   gauntlet restarts get a fresh layer each create() with no listener pileup.
 */

import type Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import type { CardVariant } from '../meta/variants';
import { GestureRecognizer, LONGPRESS_MS } from './gestureCore';

// ---------------------------------------------------------------------------
// Device-level touch predicate (layout profiles + copy text)
// ---------------------------------------------------------------------------

/** Everything the predicate reads, injected so the decision stays pure. */
export interface TouchEnv {
  /** value of the `?touch=` URL param, if any (`on`/`off` override) */
  queryTouch: string | null;
  userAgent: string;
  coarsePointer: boolean;
  maxTouchPoints: number;
}

/**
 * Same touch clauses as detectQualityTier (src/platform/quality.ts) minus the
 * hardware floors — quality `lite` also covers low-memory mouse desktops, so
 * the tier itself must not drive touch layout. `?touch=on|off` overrides for
 * probes and desktop debugging.
 */
export function detectTouchDevice(env: TouchEnv): boolean {
  if (env.queryTouch === 'on') return true;
  if (env.queryTouch === 'off') return false;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(env.userAgent);
  const touchMac = /Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1;
  return mobileUa || touchMac || (env.coarsePointer && env.maxTouchPoints > 0);
}

let cachedTouch: boolean | null = null;

/** The active device profile — detected once per page load, then cached. */
export function isTouchDevice(): boolean {
  if (cachedTouch === null) cachedTouch = detectTouchDevice(browserTouchEnv());
  return cachedTouch;
}

/** Debug/test hook: force the profile, or null to re-detect on next read. */
export function setTouchDevice(v: boolean | null): void {
  cachedTouch = v;
}

function browserTouchEnv(): TouchEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { queryTouch: null, userAgent: '', coarsePointer: false, maxTouchPoints: 0 };
  }
  let query: string | null = null;
  try {
    query = new URLSearchParams(window.location.search).get('touch');
  } catch {
    /* ignore — no override */
  }
  return {
    queryTouch: query,
    userAgent: navigator.userAgent ?? '',
    coarsePointer:
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Hit-area inflation (mobile-lan-plan §1.4)
// ---------------------------------------------------------------------------

/** The duck-typed slice of a GameObject the inflater needs (test-friendly). */
export interface InflatableObject {
  width: number;
  height: number;
  input?: {
    hitArea?: { setTo(x: number, y: number, w: number, h: number): unknown };
    customHitArea?: boolean;
  } | null;
  getWorldTransformMatrix?: () => { scaleX: number; scaleY: number };
}

/**
 * Grow an interactive object's rectangular hit area to at least
 * `minW`×`minH` DESIGN px (90 = ≥44 CSS px at the worst supported FIT scale),
 * centered on the visual, without touching the visual itself. Works in the
 * object's local space, so scaled objects (card thumbs) and container
 * children (SettingsScene chips) inflate correctly; Phaser adds
 * displayOrigin before hit-testing, so a (0,0,w,h)-based rect covers the
 * visual for any origin.
 *
 * `biasX`/`biasY` shift the inflated rect (design px) when a centered rect
 * would cross an interactive neighbor — the caller owns that geometry.
 *
 * Call AFTER setInteractive(). Marks the hit area as CUSTOM — otherwise
 * Phaser's Text.updateText silently shrinks it back to the glyph bounds on
 * the next setText/setStyle/setColor (even a hover recolor). The flip side:
 * a Text that later GROWS past the inflated rect must re-call this after
 * setText (DuelScene's HUD sync does; so does Gauntlet's abandon confirm).
 * ModalGuard cycles are safe: InputPlugin.enable() re-enables an existing
 * InteractiveObject without recreating its hit area.
 *
 * Returns the resulting hit size in design px (probe/report fodder), or null
 * if the object has no rectangular hit area yet.
 */
export function inflateHitArea(
  obj: InflatableObject,
  minW: number,
  minH: number,
  opts: { biasX?: number; biasY?: number } = {},
): { w: number; h: number } | null {
  const input = obj.input;
  const hitArea = input?.hitArea;
  if (!input || !hitArea || typeof hitArea.setTo !== 'function') return null;
  input.customHitArea = true; // stop Text.updateText from shrinking it back
  const m = obj.getWorldTransformMatrix?.();
  const sx = Math.abs(m?.scaleX ?? 1) || 1;
  const sy = Math.abs(m?.scaleY ?? 1) || 1;
  const baseW = obj.width;
  const baseH = obj.height;
  const w = Math.max(baseW, minW / sx);
  const h = Math.max(baseH, minH / sy);
  hitArea.setTo(
    (baseW - w) / 2 + (opts.biasX ?? 0) / sx,
    (baseH - h) / 2 + (opts.biasY ?? 0) / sy,
    w,
    h,
  );
  return { w: w * sx, h: h * sy };
}

// ---------------------------------------------------------------------------
// The per-scene gesture layer
// ---------------------------------------------------------------------------

/**
 * What the layer needs from CardZoomPreview for the sticky long-press
 * preview; structural so platform never imports src/ui.
 */
export interface StickyPreviewHost {
  showSticky(card: CardDef, worldX: number, variant?: CardVariant, landStyle?: string): void;
  dismissSticky(): void;
  isSticky(): boolean;
}

export interface GestureOptions {
  /** Committed tap — activate exactly like today's click semantics. */
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  /**
   * Long-press target card: opens the scene's sticky zoom preview (needs
   * setStickyHost). Ignored if `onLongPress` is provided.
   */
  card?: CardDef;
  /** Optional owned treatment rendered by the sticky CardView preview. */
  variant?: CardVariant;
  /** Optional basic-land art style rendered by the sticky preview. */
  landStyle?: string;
  /** Custom long-press behavior (overrides the sticky-preview default). */
  onLongPress?: () => void;
  /** Pressed-state lift in px (hand cards), applied on top of the dim. */
  pressLift?: number;
}

type GameObjectish = Phaser.GameObjects.GameObject & {
  active: boolean;
  x?: number;
  y?: number;
  alpha?: number;
  setAlpha?: (a: number) => unknown;
  setTint?: (t: number) => unknown;
  clearTint?: () => unknown;
  getWorldTransformMatrix?: () => { tx: number };
};

interface ActivePress {
  obj: GameObjectish;
  opts: GestureOptions;
  savedAlpha: number;
  savedY: number;
  tinted: boolean;
  lifted: boolean;
}

const LAYERS = new WeakMap<Phaser.Scene, SceneGestureLayer>();

class SceneGestureLayer {
  private readonly scene: Phaser.Scene;
  private readonly rec: GestureRecognizer;
  private active: ActivePress | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private stickyHost: StickyPreviewHost | null = null;
  /** Pointer whose long-press opened the sticky preview: its release is consumed. */
  private stickyPointerId = -1;
  /** Release landed on the pressed object (its own pointerup fired this tick). */
  private upOnActive = false;
  private lastUpPointer: Phaser.Input.Pointer | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rec = new GestureRecognizer({
      onPressStart: () => this.applyPressVisual(),
      onPressEnd: () => this.clearPressVisual(),
      onTap: () => this.handleTap(),
      onLongPress: () => this.handleLongPress(),
    });
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  setStickyHost(host: StickyPreviewHost): void {
    this.stickyHost = host;
  }

  attach(obj: GameObjectish, opts: GestureOptions): void {
    obj.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) return;
      this.beginPress(obj, opts, p);
    });
    obj.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) return;
      // Object-level up fires before the scene-level POINTER_UP (verified in
      // InputPlugin.processUpEvents) and only for enabled objects — so this
      // both enforces "release over the pressed object" and keeps ModalGuard
      // authoritative (disabled objects can't complete a tap).
      if (this.active?.obj === obj && this.rec.activePointerId === p.id) this.upOnActive = true;
    });
    obj.once('destroy', () => this.cancelFor(obj));
  }

  private beginPress(obj: GameObjectish, opts: GestureOptions, p: Phaser.Input.Pointer): void {
    if (this.active) {
      // A stale press can survive a missed touchcancel; a live one means a
      // second finger — the plan says ignore it.
      if (this.rec.state !== 'idle') return;
      this.active = null;
    }
    this.active = {
      obj,
      opts,
      savedAlpha: (obj.alpha as number) ?? 1,
      savedY: (obj.y as number) ?? 0,
      tinted: false,
      lifted: false,
    };
    this.rec.down(p.id, p.worldX, p.worldY, this.scene.time.now);
    this.clearTimer();
    this.timer = this.scene.time.delayedCall(LONGPRESS_MS, () => {
      this.timer = null;
      const a = this.active;
      if (!a) return;
      if (!a.obj.active) {
        this.cancelActive();
        return;
      }
      this.rec.timeout(this.scene.time.now);
    });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch || !this.active || this.rec.activePointerId !== p.id) return;
    this.rec.move(p.id, p.worldX, p.worldY, this.scene.time.now);
    if (this.rec.state !== 'pressed') this.clearTimer(); // drag-cancelled
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    if (this.active && this.rec.activePointerId === p.id) {
      this.lastUpPointer = p;
      this.rec.up(p.id, p.worldX, p.worldY, this.scene.time.now); // may fire onTap/onLongPress
      this.clearTimer();
      this.active = null;
      this.upOnActive = false;
      this.lastUpPointer = null;
    }
    // Sticky preview: the release that ends the opening long-press is
    // consumed; any later touch release dismisses — unless it landed on the
    // preview itself, whose own tap handler already closed it (isSticky()
    // turns false before this scene-level event arrives).
    if (this.stickyPointerId === p.id) {
      this.stickyPointerId = -1;
    } else if (this.stickyHost?.isSticky()) {
      this.stickyHost.dismissSticky();
    }
  }

  private handleTap(): void {
    const a = this.active;
    if (!a || !this.upOnActive || !a.obj.active) return;
    a.opts.onTap?.(this.lastUpPointer!);
  }

  private handleLongPress(): void {
    const a = this.active;
    if (!a) return;
    // Consume the eventual release even if the preview declines to open
    // (suppressed during results, no card bound, …).
    this.stickyPointerId = this.rec.activePointerId ?? -1;
    if (a.opts.onLongPress) {
      a.opts.onLongPress();
      return;
    }
    if (a.opts.card && this.stickyHost && a.obj.active) {
      const wx = a.obj.getWorldTransformMatrix?.().tx ?? (a.obj.x as number) ?? 0;
      this.stickyHost.showSticky(a.opts.card, wx, a.opts.variant, a.opts.landStyle);
    }
  }

  private cancelFor(obj: GameObjectish): void {
    if (this.active?.obj === obj) this.cancelActive();
  }

  private cancelActive(): void {
    this.clearTimer();
    this.rec.cancel(); // emits pressEnd → clearPressVisual (guards .active)
    this.active = null;
    this.upOnActive = false;
  }

  private applyPressVisual(): void {
    const a = this.active;
    if (!a || !a.obj.active) return;
    const obj = a.obj;
    if (a.opts.pressLift && typeof obj.y === 'number') {
      obj.y = a.savedY - a.opts.pressLift;
      a.lifted = true;
    }
    if (typeof obj.setTint === 'function') {
      obj.setTint(0xb8b8c8);
      a.tinted = true;
    } else if (typeof obj.setAlpha === 'function') {
      obj.setAlpha(a.savedAlpha * 0.8);
    }
  }

  private clearPressVisual(): void {
    const a = this.active;
    if (!a) return;
    const obj = a.obj;
    if (!obj.active) return; // destroyed mid-press (hand re-sync) — nothing to restore
    if (a.tinted) obj.clearTint?.();
    else obj.setAlpha?.(a.savedAlpha);
    if (a.lifted && typeof obj.y === 'number') obj.y = a.savedY;
  }

  private clearTimer(): void {
    this.timer?.remove(false);
    this.timer = null;
  }

  private destroy(): void {
    this.clearTimer();
    this.active = null;
    this.stickyHost = null;
    this.scene.input?.off('pointermove', this.onMove, this);
    this.scene.input?.off('pointerup', this.onUp, this);
    this.scene.input?.off('pointerupoutside', this.onUp, this);
    LAYERS.delete(this.scene);
  }
}

function layerFor(scene: Phaser.Scene): SceneGestureLayer {
  let layer = LAYERS.get(scene);
  if (!layer) {
    layer = new SceneGestureLayer(scene);
    LAYERS.set(scene, layer);
  }
  return layer;
}

// ---------------------------------------------------------------------------
// Public binder API
// ---------------------------------------------------------------------------

/**
 * Wire touch gestures onto an interactive object (or a CardView-style
 * container that re-emits its Zone's pointer events). Touch-only: mouse
 * pointers never reach the classifier. Existing mouse handlers on the object
 * are untouched — gate them with `if (p.wasTouch) return;` where the touch
 * path replaces them.
 */
export function attachTouchGestures(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  opts: GestureOptions,
): void {
  layerFor(scene).attach(obj as GameObjectish, opts);
}

/**
 * The standard button pattern: mouse keeps firing `onActivate` from a plain
 * pointerup exactly as before; touch routes through tap classification (drag
 * releases and long-press releases no longer activate).
 */
export function bindTapButton(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  onActivate: (pointer: Phaser.Input.Pointer) => void,
  opts: Omit<GestureOptions, 'onTap'> = {},
): void {
  obj.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!p.wasTouch) onActivate(p);
  });
  attachTouchGestures(scene, obj, { ...opts, onTap: onActivate });
}

/** Register the scene's CardZoomPreview as the sticky long-press target. */
export function setStickyHost(scene: Phaser.Scene, host: StickyPreviewHost): void {
  layerFor(scene).setStickyHost(host);
}
