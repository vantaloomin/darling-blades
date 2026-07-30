import Phaser from 'phaser';
import type { StackItem, CardDef } from '../engine/types';
import { bindTapButton } from '../platform/gestures';
import { CardView, CARD_H, CARD_W } from './CardView';
import { colorInt, theme } from './theme';

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

  constructor(scene: Phaser.Scene, opts: StackDisplayOptions) {
    this.opts = opts;
    this.root = scene.add
      .container(opts.x, opts.y)
      .setDepth(theme.depth.stackReadout)
      .setVisible(false);
  }

  setItems(items: readonly StackItem[], live: boolean): void {
    this.root.removeAll(true);
    this.targetCards = [];
    this.inspectCards = [];
    const visible = live && items.length > 0;
    this.root.setVisible(visible);
    if (!visible) return;

    const cardWidth = CARD_W * CARD_SCALE;
    const cardHeight = CARD_H * CARD_SCALE;
    const rowWidth = items.length * cardWidth + Math.max(0, items.length - 1) * CARD_GAP;
    // 42, not 25: the per-card caster label sits at -cardHeight/2 - 9 with a
    // bottom origin, so a 25px title offset collided with it on-screen.
    const title = this.root.scene.add
      .text(0, -cardHeight / 2 - 42, 'On the stack', {
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

    items.forEach((item, index) => {
      const x = -rowWidth / 2 + cardWidth / 2 + index * (cardWidth + CARD_GAP);
      const targetable = this.opts.isTargetable(item.sid);
      const frame = this.root.scene.add
        .rectangle(
          x,
          0,
          cardWidth + 8,
          cardHeight + 8,
          targetable ? theme.graphics.rowFillActive : theme.graphics.panelFill,
          targetable ? 0.82 : 0.68,
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

      const order = items.length > 1 ? `${index + 1} of ${items.length}` : 'TOP';
      const label = this.root.scene.add
        .text(x, -cardHeight / 2 - 9, `${this.opts.casterLabel(item.controller)} · ${order}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: targetable ? theme.colors.gold : theme.colors.body,
          stroke: theme.colors.dim,
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5, 1);
      this.root.add(label);

      if (targetable) {
        const hint = this.root.scene.add
          .text(x, cardHeight / 2 + 8, 'Tap to target', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.gold,
            stroke: theme.colors.dim,
            strokeThickness: 3,
            resolution: 2,
          })
          .setOrigin(0.5, 0);
        this.root.add(hint);
      }
    });
  }

  /**
   * CardViews are the only interactive descendants and are ModalGuard-safe.
   * Includes the inspect-only cards: they carry input now, so they must be
   * deadened under modal overlays like every other interactive object.
   */
  interactiveTargets(): CardView[] {
    return [...this.targetCards, ...this.inspectCards];
  }

  destroy(): void {
    this.root.destroy(true);
    this.targetCards = [];
    this.inspectCards = [];
  }
}
