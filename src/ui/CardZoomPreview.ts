import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import { attachTouchGestures } from '../platform/gestures';
import { CardView } from './CardView';

// Design-space constants, NOT scene.scale (= game size = 1280k×720k under
// render scale; the camera shows the 1280×720 design window — see
// src/platform/renderScale.ts). Identical at k=1.
const DESIGN_W = 1280;
const DESIGN_H = 720;

/**
 * Hover-to-zoom card preview, reusable across scenes.
 *
 * Hovering an attached object for `delayMs` (or instantly while Z is held)
 * shows an enlarged CardView DOCKED to the screen side away from the hovered
 * object — a fixed dock reads calmly and never covers the zone being hovered.
 * The preview is strictly non-interactive and hides when the pointer leaves
 * the hovered object or that object is destroyed. Teardown of UNRELATED
 * objects (declarative re-renders rebuild whole rows every sync) must NOT
 * kill a live preview, so out/destroy only cancel when the object is the
 * current hover source; mid-dwell destruction is also guarded (the
 * delayed-call-on-destroyed-object trap, playbook §11).
 *
 * The Z-key listener lives on the scene's KeyboardPlugin (torn down on scene
 * shutdown, so no pileup across DuelScene gauntlet restarts); it bypasses
 * ModalGuard by nature, so the `suppressed` flag is checked in every path —
 * hosts must setSuppressed(true) while their own modals are open.
 *
 * TOUCH (mobile-lan-plan §1.3): the hover path is mouse-only (`wasTouch`
 * pointers never schedule a dwell); the gesture binder instead calls
 * `showSticky()` on long-press. A STICKY preview has no hover source, so
 * re-render teardown and pointerout never dismiss it — it stays until the
 * host suppresses, `dismissSticky()` runs (the binder calls it on any later
 * touch release), or a tap lands on the preview itself, which fires
 * `onStickyTap` (the host opens its full inspect overlay). Only the sticky
 * preview is interactive — the mouse hover preview stays inert.
 */

export interface CardZoomOptions {
  /** CardView scale of the preview (default 1.3 → 390×546). */
  scale?: number;
  /**
   * Depth of the preview (default 105): above the pick overlays at depth 100
   * so hover-reading works during mulligan/discard decisions, below the
   * inspect modal at 110 — though hosts suppress the preview while inspect
   * or results are open, so it never actually coexists with those.
   */
  depth?: number;
  /** Hover dwell before the preview appears (default 400ms). */
  delayMs?: number;
  /** Dock geometry (defaults fit 1280×720). */
  dockY?: number;
  leftX?: number;
  rightX?: number;
  /** Touch: tap on the STICKY preview (host opens its full inspect). */
  onStickyTap?: (card: CardDef) => void;
}

export class CardZoomPreview {
  private scene: Phaser.Scene;
  private view: CardView | null = null;
  /** The object whose hover produced the currently VISIBLE preview. */
  private sourceObj: Phaser.GameObjects.GameObject | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private pending: { card: CardDef; worldX: number; obj: Phaser.GameObjects.GameObject } | null =
    null;
  private suppressed = false;
  private zHeld = false;
  private sticky = false;
  private readonly onStickyTap: ((card: CardDef) => void) | null;
  private readonly scale: number;
  private readonly depth: number;
  private readonly delayMs: number;
  private readonly dockY: number;
  private readonly leftX: number;
  private readonly rightX: number;

  constructor(scene: Phaser.Scene, opts: CardZoomOptions = {}) {
    this.scene = scene;
    this.scale = opts.scale ?? 1.3;
    this.depth = opts.depth ?? 105;
    this.delayMs = opts.delayMs ?? 400;
    this.dockY = opts.dockY ?? DESIGN_H / 2;
    this.leftX = opts.leftX ?? 210;
    this.rightX = opts.rightX ?? DESIGN_W - 210;
    this.onStickyTap = opts.onStickyTap ?? null;

    scene.input.keyboard?.on('keydown-Z', this.onZDown, this);
    scene.input.keyboard?.on('keyup-Z', this.onZUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /**
   * Wire hover preview onto an interactive object (or a CardView/container
   * that re-emits pointer events with the Pointer threaded through).
   */
  attach(obj: Phaser.GameObjects.GameObject, card: CardDef): void {
    obj.on('pointerover', (p: Phaser.Input.Pointer) => {
      // Touch fires pointerover on finger-down; the long-press gesture owns
      // previews there — never schedule a hover dwell for a touch pointer.
      if (p.wasTouch) return;
      this.schedule(card, p.worldX, obj);
    });
    obj.on('pointerout', () => this.cancelFor(obj));
    obj.once(Phaser.GameObjects.Events.DESTROY, () => this.cancelFor(obj));
  }

  /**
   * Touch long-press: show the preview STICKY — no hover source, so
   * re-renders and pointerout can't dismiss it. No-op while suppressed.
   */
  showSticky(card: CardDef, worldX: number): void {
    if (this.suppressed) return;
    this.cancel();
    this.show(card, worldX, null);
    this.sticky = true;
    if (this.view && this.onStickyTap) {
      // The sticky preview is a huge tap target: tap = full inspect. Uses the
      // gesture binder so drags/long-presses on it don't misfire, and so a
      // tap over it never falls through to the board beneath.
      this.view.enableInput();
      attachTouchGestures(this.scene, this.view, {
        onTap: () => {
          if (this.sticky) this.onStickyTap!(card);
        },
      });
    }
  }

  /** Is a sticky preview currently showing? (Binder dismissal gate.) */
  isSticky(): boolean {
    return this.sticky && this.view !== null;
  }

  /** Close the preview only if it is the sticky (touch) one. */
  dismissSticky(): void {
    if (this.sticky) this.cancel();
  }

  /** Cancel any pending timer and hide the preview. */
  cancel(): void {
    this.timer?.remove(false);
    this.timer = null;
    this.pending = null;
    this.sourceObj = null;
    this.sticky = false;
    this.view?.destroy();
    this.view = null;
  }

  /** Cancel only if `obj` is the pending or shown hover source. */
  private cancelFor(obj: Phaser.GameObjects.GameObject): void {
    if (this.pending?.obj === obj || this.sourceObj === obj) this.cancel();
  }

  /** While suppressed (modal open, game over…) no previews appear. */
  setSuppressed(s: boolean): void {
    this.suppressed = s;
    if (s) this.cancel();
  }

  destroy(): void {
    this.cancel();
    this.scene.input.keyboard?.off('keydown-Z', this.onZDown, this);
    this.scene.input.keyboard?.off('keyup-Z', this.onZUp, this);
  }

  private schedule(card: CardDef, worldX: number, obj: Phaser.GameObjects.GameObject): void {
    this.cancel();
    if (this.suppressed) return;
    this.pending = { card, worldX, obj };
    if (this.zHeld) {
      this.show(card, worldX, obj);
      return;
    }
    this.timer = this.scene.time.delayedCall(this.delayMs, () => {
      this.timer = null;
      const p = this.pending;
      // The hovered object may have been destroyed by a re-render mid-dwell.
      if (!p || p.card !== card || !p.obj.active || this.suppressed) return;
      this.show(card, worldX, p.obj);
    });
  }

  private show(
    card: CardDef,
    hoveredWorldX: number,
    obj: Phaser.GameObjects.GameObject | null,
  ): void {
    this.view?.destroy();
    this.sourceObj = obj; // null for sticky: nothing may auto-dismiss it
    // worldX is design-space (the camera maps pointer → world through the
    // render-scale zoom), so it compares against the DESIGN midpoint — using
    // scale.width/2 (= 640k) would always dock left at k>1.
    const x = hoveredWorldX >= DESIGN_W / 2 ? this.leftX : this.rightX;
    this.view = new CardView(this.scene, x, this.dockY);
    this.view.setScale(this.scale);
    this.view.setCard(card, { fx: 'none' });
    this.view.setDepth(this.depth);
    // Hover mode never enableInput(): the preview must not intercept or
    // misroute mouse input. (showSticky opts in for the touch tap target.)
  }

  private onZDown(): void {
    this.zHeld = true;
    if (this.suppressed) return;
    // Z pressed mid-dwell: skip the remaining delay.
    if (this.pending && this.timer) {
      this.timer.remove(false);
      this.timer = null;
      if (this.pending.obj.active) this.show(this.pending.card, this.pending.worldX, this.pending.obj);
    }
  }

  private onZUp(): void {
    this.zHeld = false;
  }
}
