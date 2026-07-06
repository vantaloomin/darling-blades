import Phaser from 'phaser';
import { DROPS } from '../config/rules';
import { bindTapButton, inflateHitArea } from '../platform/gestures';

// Design-space constants, NOT scene.scale (render scale shows the 1280×720
// design window — see src/platform/renderScale.ts). Identical at k=1.
const DESIGN_H = 720;

const PANEL_W = 320;
const TAB_W = 30;
const TAB_H = 150;
const DEPTH = 70; // above scene content, below modal overlays (>=100)

// Slide geometry. Closed: the panel body sits fully off-screen to the LEFT, only
// the tab (which pokes out to the RIGHT of the panel's right edge) shows. Open:
// the panel's left edge lands at x=0.
const OPEN_X = 0;
const CLOSED_X = -PANEL_W;

const TIER_LABELS: Record<string, string> = { c: 'C', r: 'R', sr: 'SR', ssr: 'SSR', ur: 'UR' };
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `C 50%  ·  R 30%  ·  …` from a DROPS axis, weights are already percentages. */
function fmtAxis(
  axis: ReadonlyArray<readonly [string, number]>,
  name: (v: string) => string,
): string {
  return axis.map(([v, w]) => `${name(v)} ${w}%`).join('   ');
}

/**
 * Left-edge slide-out that discloses booster drop rates as human-readable
 * percentages, rendered straight from the DROPS config so the shown odds can
 * never drift from the real roll. Mirrors HistoryPanel's mechanism (a container
 * tweened along X, a tab jutting out, a click blocker, SHUTDOWN cleanup) but
 * docked to the LEFT. Self-contained; the shop just constructs it.
 */
export class OddsDrawer {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private slideTween: Phaser.Tweens.Tween | null = null;
  private open = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const bg = scene.add.graphics();
    bg.fillStyle(0x120e20, 0.9);
    bg.fillRoundedRect(0, 40, PANEL_W, DESIGN_H - 80, { tl: 0, bl: 0, tr: 12, br: 12 });
    bg.lineStyle(1, 0x3a2f5c, 1);
    bg.strokeRoundedRect(0, 40, PANEL_W, DESIGN_H - 80, { tl: 0, bl: 0, tr: 12, br: 12 });

    // Swallow taps on the open panel so they don't fall through to shop controls.
    const blocker = scene.add
      .rectangle(PANEL_W / 2, DESIGN_H / 2, PANEL_W, DESIGN_H - 80, 0x000000, 0)
      .setInteractive();

    const title = scene.add
      .text(24, 62, 'Drop Rates', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#ffd88a',
        resolution: 2,
      })
      .setOrigin(0, 0);
    const sub = scene.add
      .text(24, 92, 'per card · 15 cards per pack', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: '#8f83a8',
        resolution: 2,
      })
      .setOrigin(0, 0);
    const rule = scene.add.graphics();
    rule.fillStyle(0x8a6d1f, 0.5);
    rule.fillRect(24, 116, PANEL_W - 48, 1);

    const section = (label: string, body: string): string => `${label}\n${body}`;
    const bodyText = [
      section('RARITY', fmtAxis(DROPS.tier, (v) => TIER_LABELS[v] ?? v)),
      '',
      section('FRAME', fmtAxis(DROPS.frame, cap)),
      '',
      section('HOLO FINISH', fmtAxis(DROPS.holo, cap)),
    ].join('\n');
    const body = scene.add
      .text(24, 132, bodyText, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#cbc2e0',
        lineSpacing: 6,
        wordWrap: { width: PANEL_W - 48 },
        resolution: 2,
      })
      .setOrigin(0, 0);
    const pity = scene.add
      .text(24, DESIGN_H - 150, 'Missing SR / SSR / UR cards are prioritized — no wasted duplicates until a playset is complete.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#8f83a8',
        lineSpacing: 4,
        wordWrap: { width: PANEL_W - 48 },
        resolution: 2,
      })
      .setOrigin(0, 0);

    // Tab: a vertical strip jutting to the RIGHT of the panel body (local x ≥
    // PANEL_W) so it stays on-screen while the body is docked off the left edge.
    const tabBg = scene.add.graphics();
    const tabY = (DESIGN_H - TAB_H) / 2;
    tabBg.fillStyle(0x2c2344, 0.95);
    tabBg.fillRoundedRect(PANEL_W, tabY, TAB_W, TAB_H, { tl: 0, bl: 0, tr: 8, br: 8 });
    tabBg.lineStyle(1, 0x3a2f5c, 1);
    tabBg.strokeRoundedRect(PANEL_W, tabY, TAB_W, TAB_H, { tl: 0, bl: 0, tr: 8, br: 8 });

    this.tabLabel = scene.add
      .text(PANEL_W + TAB_W / 2, DESIGN_H / 2, 'Drop Rates', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#ffd88a',
        resolution: 2,
      })
      .setOrigin(0.5)
      .setAngle(-90)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(this.tabLabel, TAB_H, 90);
    bindTapButton(scene, this.tabLabel, () => this.toggle());

    this.container = scene.add
      .container(CLOSED_X, 0, [bg, blocker, title, sub, rule, body, pity, tabBg, this.tabLabel])
      .setDepth(DEPTH);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
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
      onComplete: () => {
        if (this.container.active) this.slideTween = null;
      },
    });
  }

  destroy(): void {
    this.slideTween?.stop();
    this.slideTween = null;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.container.destroy();
  }
}
