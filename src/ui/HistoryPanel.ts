import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';

// Design-space constants, NOT scene.scale (= game size = 1280k×720k under
// render scale; the camera shows the 1280×720 design window — see
// src/platform/renderScale.ts and DuelScene.buildZones). Identical at k=1.
const DESIGN_W = 1280;
const DESIGN_H = 720;

const PANEL_W = 300;
const TAB_W = 30;
const TAB_H = 120;
const MAX_LINES = 14;
/** Depth: above the board (arrows 50 / cards 10–55) but below modal overlays (>=100). */
const DEPTH = 70;

// Slide geometry. Closed: the panel body sits fully off-screen to the right,
// only the tab (which pokes out to the LEFT of the panel's left edge) is
// visible. Open: the panel's left edge lands at DESIGN_W - PANEL_W.
const OPEN_X = DESIGN_W - PANEL_W;
const CLOSED_X = DESIGN_W;

/**
 * Move-history slide-out for the duel screen.
 *
 * A vertical "History" tab is pinned to the right edge of the 1280×720 design
 * space. Tapping the tab slides a translucent log panel in from the right;
 * tapping again slides it away. At rest only the tab shows, so the board stays
 * unobstructed. The whole thing lives in one Container translated along X: the
 * tab is parented at a NEGATIVE local x so it always juts out to the left of the
 * panel body and stays on-screen while the body is docked off the right edge.
 *
 * Newest entry is at the top; the last ~14 lines are kept. Entries are wrapped
 * to the panel width. Style follows the duel HUD (Inter body, Cinzel title/tab,
 * the #cbc2e0 / #8b80b0 / #ffd88a palette, resolution 2).
 *
 * Known traps honored (playbook §11):
 * - the slide tween's onComplete guards `.active` (a scene re-render / shutdown
 *   can destroy the container mid-tween);
 * - the tab is a plain (unscaled) Text made interactive directly, then
 *   inflated to a ≥90px touch target — no setInteractive on a scaled Container;
 * - bindTapButton gives mouse+touch parity (mouse pointerup + touch tap).
 */
export class HistoryPanel {
  private readonly scene: Phaser.Scene;
  /** Whole widget; its X is tweened between OPEN_X and CLOSED_X. */
  private readonly container: Phaser.GameObjects.Container;
  /** The wrapped log text (parented in the container, local origin top-left). */
  private readonly logText: Phaser.GameObjects.Text;
  /** The interactive tab (exposed via `tab` so a scene's ModalGuard can deaden it). */
  private readonly tabLabel: Phaser.GameObjects.Text;
  private readonly entries: string[] = [];
  private slideTween: Phaser.Tweens.Tween | null = null;
  private open = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Panel body: a semi-transparent dark plate docked to the panel's right
    // portion (drawn in container-local space, left edge at local x=0).
    const bg = scene.add.graphics();
    bg.fillStyle(0x120e20, 0.82);
    bg.fillRoundedRect(0, 40, PANEL_W, DESIGN_H - 80, 10);
    bg.lineStyle(1, 0x3a2f5c, 1);
    bg.strokeRoundedRect(0, 40, PANEL_W, DESIGN_H - 80, 10);

    // Click blocker: the 1a layout parks the smart button / End Turn /
    // Concede cluster under the OPEN panel's footprint, and Phaser hit-tests
    // only interactive objects — a bare Graphics plate would let taps fall
    // through to the invisible controls beneath (a stray tap on the plate
    // could submit "Skip Combat"). An invisible interactive rect over the
    // body swallows them; it rides the container, so when the panel is
    // closed (x ≥ 1280) the rect sits fully off-canvas and intercepts
    // nothing. Modal overlays (depth ≥100 with their own full-screen dims)
    // still sit above it.
    const blocker = scene.add
      .rectangle(PANEL_W / 2, DESIGN_H / 2, PANEL_W, DESIGN_H - 80, 0x000000, 0)
      .setInteractive();

    const title = scene.add
      .text(20, 58, 'History', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#ffd88a',
        resolution: 2,
      })
      .setOrigin(0, 0);
    // Gold hairline under the title, HUD-style.
    const rule = scene.add.graphics();
    rule.fillStyle(0x8a6d1f, 0.55);
    rule.fillRect(20, 92, PANEL_W - 40, 1);

    this.logText = scene.add
      .text(20, 106, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#cbc2e0',
        lineSpacing: 6,
        wordWrap: { width: PANEL_W - 40 },
        resolution: 2,
      })
      .setOrigin(0, 0);

    // The tab: a vertical "History" strip pinned to the LEFT of the panel body
    // (negative local x) so it stays on-screen when the body is docked off the
    // right edge. Rotated -90° reads bottom-to-top. Made interactive directly
    // (plain Text, unscaled), then inflated for a ≥90px touch target.
    const tabBg = scene.add.graphics();
    tabBg.fillStyle(0x2c2344, 0.95);
    tabBg.fillRoundedRect(-TAB_W, (DESIGN_H - TAB_H) / 2, TAB_W, TAB_H, { tl: 8, bl: 8, tr: 0, br: 0 });
    tabBg.lineStyle(1, 0x3a2f5c, 1);
    tabBg.strokeRoundedRect(-TAB_W, (DESIGN_H - TAB_H) / 2, TAB_W, TAB_H, { tl: 8, bl: 8, tr: 0, br: 0 });

    this.tabLabel = scene.add
      .text(-TAB_W / 2, DESIGN_H / 2, 'History', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#ffd88a',
        resolution: 2,
      })
      .setOrigin(0.5)
      .setAngle(-90)
      .setInteractive({ useHandCursor: true });
    // The rotated label's own glyph box is the hit area; inflate to cover the
    // full tab strip and clear the 90px touch floor (angle doesn't affect the
    // local-space rect Phaser hit-tests against).
    inflateHitArea(this.tabLabel, TAB_H, TAB_W < 90 ? 90 : TAB_W);
    bindTapButton(scene, this.tabLabel, () => this.toggle());

    this.container = scene.add
      .container(CLOSED_X, 0, [bg, blocker, title, rule, this.logText, tabBg, this.tabLabel])
      .setDepth(DEPTH);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** The interactive tab — hand this to a scene's ModalGuard so overlays can
   *  deaden the slide-out while a modal decision has focus. */
  get tab(): Phaser.GameObjects.GameObject {
    return this.tabLabel;
  }

  /** Add a move (newest); keeps the last ~14 lines. */
  push(entry: string): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_LINES) this.entries.length = MAX_LINES;
    this.render();
  }

  /** Drop all history. */
  clear(): void {
    this.entries.length = 0;
    this.render();
  }

  private render(): void {
    if (!this.logText.active) return;
    this.logText.setText(this.entries.join('\n'));
  }

  private toggle(): void {
    if (!this.container.active) return;
    this.open = !this.open;
    this.slideTween?.stop();
    this.slideTween = this.scene.tweens.add({
      targets: this.container,
      x: this.open ? OPEN_X : CLOSED_X,
      duration: 220,
      ease: 'Cubic.easeOut',
      // A re-render / scene shutdown can destroy the container mid-slide; the
      // tween targets the container itself, so Phaser auto-stops it on destroy,
      // but we still guard .active before touching our own state.
      onComplete: () => {
        if (!this.container.active) return;
        this.slideTween = null;
      },
    });
  }

  destroy(): void {
    this.slideTween?.stop();
    this.slideTween = null;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.container.destroy(); // destroys all children (bg, title, rule, log, tab)
  }
}
