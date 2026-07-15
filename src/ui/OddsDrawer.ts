import Phaser from 'phaser';
import { DROPS, ECONOMY } from '../config/rules';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { measuredRowsLayout, scrollOffsetByDelta } from './layout';
import { panel } from './themeWidgets';
import { theme } from './theme';

// Design-space constants, NOT scene.scale (render scale shows the 1280×720
// design window — see src/platform/renderScale.ts). Identical at k=1.
const DESIGN_H = 720;

const PANEL_W = 320;
const TAB_W = 30;
const TAB_H = 150;
const CONTENT_TOP = theme.space(34);
const CONTENT_BOTTOM = DESIGN_H - theme.space(14);
const CONTENT_MAX_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;
const CONTENT_PAD_X = theme.space(6);
const DEPTH = theme.depth.history; // above scene content, below modal overlays (>=100)

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
 * never drift from the real roll. Mirrors HistoryPanel's mechanism (a
 * container tweened along X, a tab jutting out, a click blocker, SHUTDOWN
 * cleanup) but is docked to the LEFT. Self-contained; the shop just constructs
 * it.
 */
export class OddsDrawer {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private readonly targets: Phaser.GameObjects.GameObject[];
  private slideTween: Phaser.Tweens.Tween | null = null;
  private open = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const bg = panel(scene, 0, theme.space(10), PANEL_W, DESIGN_H - theme.space(20));

    // Swallow taps on the open panel so they don't fall through to shop controls.
    const blocker = scene.add
      .rectangle(PANEL_W / 2, DESIGN_H / 2, PANEL_W, DESIGN_H - theme.space(20), theme.graphics.dim, 0)
      .setInteractive();

    const title = scene.add
      .text(24, theme.space(14.5), 'Drop Rates', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(0, 0);
    const sub = scene.add
      .text(24, theme.space(24), `per card · ${ECONOMY.boosterPackSize} cards per pack`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        resolution: 2,
      })
      .setOrigin(0, 0);
    const rule = scene.add.graphics();
    rule.fillStyle(theme.graphics.panelStroke, theme.alpha.subtle);
    rule.fillRect(24, theme.space(30), PANEL_W - theme.space(12), theme.control.borderWidth);

    const sections = [
      { label: 'RARITY', body: fmtAxis(DROPS.tier, (v) => TIER_LABELS[v] ?? v) },
      { label: 'FRAME', body: fmtAxis(DROPS.frame, cap) },
      { label: 'HOLO FINISH', body: fmtAxis(DROPS.holo, cap) },
    ];
    const sectionTexts = sections.map((section) => {
      const label = scene.add
        .text(0, 0, section.label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          resolution: 2,
        })
        .setOrigin(0, 0);
      const body = scene.add
        .text(0, 0, section.body, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          lineSpacing: theme.space(1),
          wordWrap: { width: PANEL_W - CONTENT_PAD_X * 2 },
          resolution: 2,
        })
        .setOrigin(0, 0);
      return { label, body };
    });
    const pity = scene.add
      .text(0, 0, 'Missing SR / SSR / UR cards are prioritized. No wasted duplicates until a playset is complete.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        lineSpacing: theme.space(1),
        wordWrap: { width: PANEL_W - CONTENT_PAD_X * 2 },
        resolution: 2,
      })
      .setOrigin(0, 0);
    const measurements = [
      ...sectionTexts.map(({ label, body }) => ({
        primaryHeight: label.height,
        secondaryHeight: body.height,
      })),
      { primaryHeight: 0, secondaryHeight: pity.height },
    ];
    const contentLayout = measuredRowsLayout(measurements, PANEL_W, CONTENT_MAX_HEIGHT, {
      horizontalPadding: CONTENT_PAD_X,
      rowGap: theme.space(3),
      rowPadding: 0,
      textGap: theme.space(1),
      contentTopPadding: 0,
      contentBottomPadding: 0,
    });
    const content = scene.add.container(0, 0);
    sectionTexts.forEach(({ label, body }, index) => {
      const row = contentLayout.rows[index];
      label.setPosition(row.x, CONTENT_TOP + row.primaryY);
      body.setPosition(row.x, CONTENT_TOP + row.secondaryY);
      content.add([label, body]);
    });
    const pityRow = contentLayout.rows[sectionTexts.length];
    pity.setPosition(pityRow.x, CONTENT_TOP + pityRow.secondaryY);
    content.add(pity);

    const viewport = contentLayout.contentViewport;
    const maskShape = scene.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRect(0, CONTENT_TOP + viewport.y, PANEL_W, viewport.height)
      .setVisible(false);
    content.setMask(maskShape.createGeometryMask());

    let scrollOffset = 0;
    let dragging = false;
    let dragPointerId: number | null = null;
    let dragStartY = 0;
    let dragStartOffset = 0;
    const scrollRange = contentLayout.maxScroll;
    const railX = PANEL_W - theme.space(2);
    const scrollbar = scrollRange > 0 ? scene.add.graphics() : null;
    const scrollThumb = scrollRange > 0 ? scene.add.graphics() : null;
    const scrollZone = scrollRange > 0
      ? scene.add
        .zone(PANEL_W / 2, CONTENT_TOP + viewport.y + viewport.height / 2, PANEL_W, viewport.height)
        .setInteractive()
      : null;
    const redrawScrollbar = (): void => {
      if (!scrollRange || viewport.height <= 0 || !scrollbar || !scrollThumb) return;
      const thumbHeight = Math.max(
        theme.space(4),
        viewport.height * (viewport.height / Math.max(viewport.height, contentLayout.contentHeight)),
      );
      const thumbTravel = Math.max(0, viewport.height - thumbHeight);
      const thumbY = CONTENT_TOP + viewport.y + (scrollOffset / scrollRange) * thumbTravel;
      scrollbar
        .clear()
        .fillStyle(theme.graphics.panelStroke, theme.alpha.subtle)
        .fillRoundedRect(railX, CONTENT_TOP + viewport.y, theme.space(0.5), viewport.height, theme.radius.control);
      scrollThumb
        .clear()
        .fillStyle(theme.graphics.rowFillActive, theme.alpha.chrome)
        .fillRoundedRect(railX - theme.space(0.5), thumbY, theme.space(1.5), thumbHeight, theme.radius.control);
    };
    const setScroll = (next: number): void => {
      scrollOffset = scrollOffsetByDelta(0, next, scrollRange);
      content.setPosition(0, -scrollOffset);
      redrawScrollbar();
    };
    const endDrag = (pointer: Phaser.Input.Pointer): void => {
      if (dragPointerId === pointer.id) {
        dragging = false;
        dragPointerId = null;
      }
    };
    const moveDrag = (pointer: Phaser.Input.Pointer): void => {
      if (!dragging || dragPointerId !== pointer.id) return;
      setScroll(dragStartOffset - (pointer.worldY - dragStartY));
    };
    if (scrollZone) {
      scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        dragging = true;
        dragPointerId = pointer.id;
        dragStartY = pointer.worldY;
        dragStartOffset = scrollOffset;
      });
      scrollZone.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
        setScroll(scrollOffset + deltaY);
      });
      scene.input.on('pointermove', moveDrag);
      scene.input.on('pointerup', endDrag);
    }

    // Tab: a vertical strip jutting to the RIGHT of the panel body (local x ≥
    // PANEL_W) so it stays on-screen while the body is docked off the left edge.
    const tabBg = scene.add.graphics();
    const tabY = (DESIGN_H - TAB_H) / 2;
    tabBg.fillStyle(theme.graphics.rowFillActive, theme.alpha.panel);
    tabBg.fillRoundedRect(PANEL_W, tabY, TAB_W, TAB_H, { tl: 0, bl: 0, tr: theme.radius.panel, br: theme.radius.panel });
    tabBg.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    tabBg.strokeRoundedRect(PANEL_W, tabY, TAB_W, TAB_H, { tl: 0, bl: 0, tr: theme.radius.panel, br: theme.radius.panel });

    this.tabLabel = scene.add
      .text(PANEL_W + TAB_W / 2, DESIGN_H / 2, 'Drop Rates', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setAngle(-90)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(this.tabLabel, TAB_H, theme.control.minHitHeight);
    bindTapButton(scene, this.tabLabel, () => this.toggle());

    const children: Phaser.GameObjects.GameObject[] = [bg, blocker, title, sub, rule, content, maskShape, tabBg, this.tabLabel];
    if (scrollRange > 0 && scrollbar && scrollThumb && scrollZone) children.push(scrollbar, scrollThumb, scrollZone);
    this.targets = [blocker, this.tabLabel];
    if (scrollZone) this.targets.push(scrollZone);
    this.container = scene.add.container(CLOSED_X, 0, children).setDepth(DEPTH);
    if (scrollZone) {
      redrawScrollbar();
      this.container.once('destroy', () => {
        scene.input.off('pointermove', moveDrag);
        scene.input.off('pointerup', endDrag);
      });
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Interactive surfaces a parent scene should include in its modal guard. */
  get interactiveTargets(): readonly Phaser.GameObjects.GameObject[] {
    return this.targets;
  }

  /** Close synchronously so a higher overlay never opens over a moving drawer. */
  close(): void {
    if (!this.container.active) return;
    this.open = false;
    this.slideTween?.stop();
    this.slideTween = null;
    this.container.setX(CLOSED_X);
  }

  private toggle(): void {
    if (!this.container.active) return;
    this.open = !this.open;
    this.slideTween?.stop();
    this.slideTween = this.scene.tweens.add({
      targets: this.container,
      x: this.open ? OPEN_X : CLOSED_X,
      duration: theme.motion.slow,
      ease: theme.motion.easeOut,
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
