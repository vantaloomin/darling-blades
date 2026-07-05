/**
 * Pure touch-gesture classifier (mobile-lan-plan §1.3) — the state machine
 * that turns one pointer sequence into tap / long-press / drag-noop.
 * Phaser-free and clock-agnostic: callers feed (pointerId, x, y, tMs)
 * samples plus a `timeout(t)` poke at the long-press deadline; nothing here
 * reads a real clock, so tests drive it with literal timestamps.
 *
 * Contract (the plan's canonical gesture table):
 * - tap        = down→up within TAP_MAX_MS, movement from the press origin
 *                ≤ TAP_SLOP_PX. (The binder additionally requires the release
 *                to land on the pressed object — see gestures.ts.)
 * - long-press = held ≥ LONGPRESS_MS within slop. Fires once — normally via
 *                `timeout()` while the finger is still down, or at release if
 *                the timer raced the up event. The release is CONSUMED: a
 *                long-press must never also produce a tap/activation.
 * - drag       = movement > slop before release. Both gestures cancel and the
 *                release is dead (fixes the drag-across-the-hand accidental
 *                cast — touch audit §1–2).
 * - dead zone  = release within slop but TAP_MAX_MS < held < LONGPRESS_MS:
 *                no action, per the plan's table (tap is a crisp gesture).
 * - multi-touch: a second concurrent pointer is silently ignored (the plan
 *                keeps Phaser's 1-touch default; first finger wins).
 *
 * State table (unlisted input×state combinations are no-ops):
 *
 *   state     | input                          | next      | emits
 *   ----------+--------------------------------+-----------+---------------------
 *   idle      | down                           | pressed   | pressStart
 *   pressed   | move ≤ slop (same pointer)     | pressed   | —
 *   pressed   | move > slop                    | cancelled | pressEnd
 *   pressed   | timeout at t ≥ down+LONGPRESS  | longpress | pressEnd, longPress
 *   pressed   | up ≤ TAP_MAX, ≤ slop           | idle      | pressEnd, tap
 *   pressed   | up in dead zone, ≤ slop        | idle      | pressEnd
 *   pressed   | up ≥ LONGPRESS (timer raced)   | idle      | pressEnd, longPress
 *   pressed   | up > slop                      | idle      | pressEnd
 *   longpress | up (same pointer)              | idle      | —  (consumed)
 *   cancelled | up (same pointer)              | idle      | —
 *   any       | cancel()                       | idle      | pressEnd if pressed
 *
 * pressStart/pressEnd bracket the visual pressed state (tint/lift) — pressEnd
 * always fires exactly once per pressStart, whatever ends the press.
 */

/** Max down→up time for a tap (~250 ms per the plan; tune on device). */
export const TAP_MAX_MS = 250;
/** Max movement from the press origin, in design px (~10 per the plan). */
export const TAP_SLOP_PX = 10;
/** Hold time for a long-press (~450 ms per the plan; tune on device). */
export const LONGPRESS_MS = 450;

export type GestureState = 'idle' | 'pressed' | 'longpress' | 'cancelled';

export interface GestureCallbacks {
  /** Pressed visual on (finger down on the object). */
  onPressStart?: () => void;
  /** Pressed visual off — fires exactly once per pressStart. */
  onPressEnd?: () => void;
  /** A committed tap: activate exactly like today's click. */
  onTap?: () => void;
  /** Long-press recognized; the eventual release is consumed. */
  onLongPress?: () => void;
}

export interface GestureThresholds {
  tapMaxMs?: number;
  slopPx?: number;
  longPressMs?: number;
}

export class GestureRecognizer {
  private readonly cb: GestureCallbacks;
  private readonly tapMaxMs: number;
  private readonly slopSq: number;
  private readonly longPressMs: number;

  private _state: GestureState = 'idle';
  private _pointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private downT = 0;

  constructor(cb: GestureCallbacks, thresholds: GestureThresholds = {}) {
    this.cb = cb;
    this.tapMaxMs = thresholds.tapMaxMs ?? TAP_MAX_MS;
    const slop = thresholds.slopPx ?? TAP_SLOP_PX;
    this.slopSq = slop * slop;
    this.longPressMs = thresholds.longPressMs ?? LONGPRESS_MS;
  }

  get state(): GestureState {
    return this._state;
  }

  /** Pointer id owning the active sequence (null when idle). */
  get activePointerId(): number | null {
    return this._pointerId;
  }

  /** When the long-press should fire (null unless pressed). */
  get deadline(): number | null {
    return this._state === 'pressed' ? this.downT + this.longPressMs : null;
  }

  down(pointerId: number, x: number, y: number, t: number): void {
    if (this._state !== 'idle') {
      // Same pointer somehow pressed twice (missed up) → restart cleanly.
      // A DIFFERENT pointer is a second finger: silently ignored.
      if (pointerId !== this._pointerId) return;
      this.cancel();
    }
    this._state = 'pressed';
    this._pointerId = pointerId;
    this.downX = x;
    this.downY = y;
    this.downT = t;
    this.cb.onPressStart?.();
  }

  // Time is unused for moves (slop is purely spatial) but kept in the
  // signature so all samples feed through uniformly.
  move(pointerId: number, x: number, y: number, _t?: number): void {
    void _t;
    if (this._state !== 'pressed' || pointerId !== this._pointerId) return;
    if (this.distSq(x, y) > this.slopSq) {
      this._state = 'cancelled'; // drag: stay latched until the up arrives
      this.cb.onPressEnd?.();
    }
  }

  /**
   * Deliver the long-press deadline (the binder schedules a timer for it).
   * Early or stale pokes are no-ops, so a raced timer can never misfire.
   */
  timeout(t: number): void {
    if (this._state !== 'pressed' || t - this.downT < this.longPressMs) return;
    this._state = 'longpress'; // release will be consumed
    this.cb.onPressEnd?.();
    this.cb.onLongPress?.();
  }

  up(pointerId: number, x: number, y: number, t: number): void {
    if (this._state === 'idle' || pointerId !== this._pointerId) return;
    const wasPressed = this._state === 'pressed';
    this._state = 'idle';
    this._pointerId = null;
    if (!wasPressed) return; // longpress/cancelled releases are consumed
    this.cb.onPressEnd?.();
    if (this.distSq(x, y) > this.slopSq) return; // flick with no move event
    const held = t - this.downT;
    if (held >= this.longPressMs) {
      this.cb.onLongPress?.(); // timer raced the release; still no tap
    } else if (held <= this.tapMaxMs) {
      this.cb.onTap?.();
    }
    // else: dead zone — deliberate no-op
  }

  /** External abort (object destroyed, modal opened, scene teardown). */
  cancel(): void {
    const wasPressed = this._state === 'pressed';
    this._state = 'idle';
    this._pointerId = null;
    if (wasPressed) this.cb.onPressEnd?.();
  }

  private distSq(x: number, y: number): number {
    const dx = x - this.downX;
    const dy = y - this.downY;
    return dx * dx + dy * dy;
  }
}
