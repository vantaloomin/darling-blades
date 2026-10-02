import Phaser from 'phaser';
import type { StackItem, CardDef } from '../engine/types';
import { bindTapButton } from '../platform/gestures';
import { CardView, CARD_H, CARD_W } from './CardView';
import { colorInt, theme } from './theme';
import { duelPanelAlpha, stackPanelPage } from './duelPanelPresentation';
import { fitMenuName } from './menuText';
import { pager } from './themeWidgets';

const CARD_SCALE = 0.32;
const CARD_GAP = 8;

export interface StackDisplayOptions {
  x: number;
  y: number;
  cardFor: (cardId: string) => CardDef;
  casterLabel: (controller: StackItem['controller']) => string;
  isTargetable: (sid: number) => boolean;
  onTarget: (sid: number) => void;
  /** Hover-zoom hookup, the scene's `zoom.attach` (desktop dwell preview). */
  attachZoom?: (view: CardView, card: CardDef) => void;
  /** Full-card inspect; at 0.32 scale the stack card itself is unreadable. */
  onInspect?: (card: CardDef) => void;
}

/**
 * Compact public stack presentation for response windows. Cards are ordered
 * bottom-to-top from left to right, so the rightmost card is the top item.
 * Every card is inspectable (hover zoom; tap or right-click opens the full
 * inspect overlay) — a response decision about an unreadable spell is not a
 * decision. Legal stack-item targets keep tap = target as the primary
 * gesture, so their inspect route is hover / right-click only.
 */
export class StackDisplay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly opts: StackDisplayOptions;
  private targetCards: CardView[] = [];
  private inspectCards: CardView[] = [];
  private items: readonly StackItem[] = [];
  private live = false;
  private page = 0;
  private pageControl: ReturnType<typeof pager> | null = null;
  private itemCenters = new Map<number, { x: number; y: number }>();

  constructor(scene: Phaser.Scene, opts: StackDisplayOptions) {
    this.opts = opts;
    this.root = scene.add
      .container(opts.x, opts.y)
      .setDepth(theme.depth.stackReadout)
      .setVisible(false);
  }

  setItems(items: readonly StackItem[], live: boolean): void {
    if (items.map(item => item.sid).join(',') !== this.items.map(item => item.sid).join(',')) this.page = Number.MAX_SAFE_INTEGER;
    this.items = items; this.live = live;
    this.render();
  }

  /** Pages preserve the card size and expose every spell, including very deep stacks. */
  showPage(page: number): void { this.page = page; this.render(); }

  private render(): void {
    const items = this.items, live = this.live;
    this.pageControl = null;
    this.root.removeAll(true);
    this.targetCards = [];
    this.inspectCards = [];
    this.itemCenters.clear();
    const visible = live && items.length > 0;
    this.root.setVisible(visible);
    if (!visible) return;

    const cardWidth = CARD_W * CARD_SCALE;
    const cardHeight = CARD_H * CARD_SCALE;
    const layout = stackPanelPage(items.length, this.page, this.root.x, cardWidth, CARD_GAP);
    this.page = layout.page;
    const visibleItems = items.slice(layout.start, layout.start + layout.count);
    const rowWidth = layout.width;
    const labels = visibleItems.map((item, index) => {
      const order = items.length > 1 ? `${layout.start + index + 1} of ${items.length}` : 'TOP';
      const text = this.root.scene.add.text(0, -cardHeight / 2 - 9, `${this.opts.casterLabel(item.controller)} \u00b7 ${order}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, fontStyle: theme.weight.w700,
        color: this.opts.isTargetable(item.sid) ? theme.colors.gold : theme.colors.body,
        stroke: theme.colors.dim, strokeThickness: 3, resolution: 2, align: 'center',
      }).setOrigin(0.5, 1);
      fitMenuName(text, cardWidth + CARD_GAP - 10, 6);
      text.setData('a11yTextWidth', cardWidth + CARD_GAP - 4);
      return text;
    });
    const labelHeight = Math.max(0, ...labels.map(label => label.height));
    const baselineLabel = this.root.scene.add.text(0, 0, 'Ag', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.typeBase.micro}px`, fontStyle: theme.weight.w700,
      stroke: theme.colors.dim, strokeThickness: 3,
    });
    const titleOffset = 42 + Math.max(0, labelHeight - baselineLabel.height) + Math.max(0, theme.type.caption - theme.typeBase.caption);
    baselineLabel.destroy();
    const pagerY = cardHeight / 2 + Math.max(56, theme.type.micro * 2 + 24);

    // Scrim behind the whole readout: the stack renders directly over the
    // opponent's battlefield rows, so without it the title and caster labels
    // sat raw on card art and were hard to read (user playtest 2026-07-30).
    // Sized to cover the title above and the tap-to-target hint below.
    const scrimTop = -cardHeight / 2 - titleOffset - Math.max(16, theme.type.caption);
    const scrimBottom = layout.pageCount > 1 ? pagerY + 24 : cardHeight / 2 + 28 + Math.max(0, theme.type.micro - theme.typeBase.micro) * 2;
    const scrimW = rowWidth + 56;
    const scrim = this.root.scene.add.graphics();
    scrim.fillStyle(theme.graphics.panelFill, duelPanelAlpha(0.82));
    scrim.fillRoundedRect(-scrimW / 2, scrimTop, scrimW, scrimBottom - scrimTop, 12);
    scrim.lineStyle(1.5, colorInt(theme.colors.panelStroke), 0.7);
    scrim.strokeRoundedRect(-scrimW / 2, scrimTop, scrimW, scrimBottom - scrimTop, 12);
    this.root.add(scrim);
    // 42, not 25: the per-card caster label sits at -cardHeight/2 - 9 with a
    // bottom origin, so a 25px title offset collided with it on-screen.
    const title = this.root.scene.add
      .text(0, -cardHeight / 2 - titleOffset, 'On the stack', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.heading,
        stroke: theme.colors.dim,
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.root.add(title);

    visibleItems.forEach((item, index) => {
      const x = -rowWidth / 2 + cardWidth / 2 + index * (cardWidth + CARD_GAP);
      this.itemCenters.set(item.sid, { x: this.root.x + x, y: this.root.y });
      const targetable = this.opts.isTargetable(item.sid);
      // Offset shadow under the frame lifts the card off the scrim (the "3D"
      // read the playtest asked for) without any FX pipeline cost.
      const shadow = this.root.scene.add
        .rectangle(x + 5, 7, cardWidth + 8, cardHeight + 8, theme.graphics.dim, 0.45);
      this.root.add(shadow);
      const frame = this.root.scene.add
        .rectangle(
          x,
          0,
          cardWidth + 8,
          cardHeight + 8,
          targetable ? theme.graphics.rowFillActive : theme.graphics.panelFill,
          duelPanelAlpha(targetable ? 0.82 : 0.68),
        )
        .setStrokeStyle(
          targetable ? 2 : 1,
          colorInt(targetable ? theme.colors.gold : theme.colors.panelStroke),
          targetable ? 0.98 : 0.72,
        );
      this.root.add(frame);

      const card = this.opts.cardFor(item.cardId);
      const view = new CardView(this.root.scene, x, 0).setScale(CARD_SCALE);
      view.setCard(card, { fx: 'none' });
      view.enableInput();
      if (targetable) {
        bindTapButton(this.root.scene, view, (pointer) => {
          // Right-click keeps its scene-level meaning during targeting
          // (cancel on desktop); tap stays the targeting gesture.
          if (pointer.rightButtonReleased()) return;
          this.opts.onTarget(item.sid);
        });
        this.targetCards.push(view);
      } else {
        // Non-targets were previously inert, which made an opponent's spell
        // uninspectable exactly when the player must decide whether to
        // respond to it. Tap and right-click both open the full inspect.
        bindTapButton(this.root.scene, view, () => {
          this.opts.onInspect?.(card);
        });
        this.inspectCards.push(view);
      }
      // Desktop hover dwell shows the zoom preview on every stack card.
      this.opts.attachZoom?.(view, card);
      this.root.add(view);

      const label = labels[index].setX(x);
      this.root.add(label);

      if (targetable) {
        const hint = this.root.scene.add
          .text(x, cardHeight / 2 + 8, 'Tap to target', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.gold,
            stroke: theme.colors.dim,
            strokeThickness: 3,
            resolution: 2, wordWrap: { width: cardWidth + CARD_GAP - 4, useAdvancedWrap: true }, align: 'center',
          })
          .setOrigin(0.5, 0);
        this.root.add(hint);
      }
    });
    if (layout.pageCount > 1) {
      this.pageControl = pager(this.root.scene, -44, pagerY, layout.page, layout.pageCount, page => this.showPage(page));
      this.root.add(this.pageControl.container);
    }
    this.root.setData('a11ySurface', { x: this.root.x - scrimW / 2, y: this.root.y + scrimTop,
      width: scrimW, height: scrimBottom - scrimTop });

  }

  /**
   * CardViews are the only interactive descendants and are ModalGuard-safe.
   * Includes the inspect-only cards: they carry input now, so they must be
   * deadened under modal overlays like every other interactive object.
   */
  interactiveTargets(): Phaser.GameObjects.GameObject[] {
    return [...this.targetCards, ...this.inspectCards, ...(this.pageControl ? [this.pageControl.previous, this.pageControl.next] : [])];
  }

  /** Current world-space card centre, refreshed every time the readout reflows. */
  itemCenter(sid: number): { x: number; y: number } | undefined {
    return this.itemCenters.get(sid);
  }

  destroy(): void {
    this.root.destroy(true);
    this.targetCards = [];
    this.inspectCards = [];
    this.itemCenters.clear();
  }
}
