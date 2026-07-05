import Phaser from 'phaser';

/**
 * PileView — compact, display-only pile indicators for the duel layout
 * (wireframe 1a):
 *
 * - 'deck':      3 mini stacked card backs + a count badge below.
 * - 'grave':     an outlined empty-slot rect (no dashes — Phaser Graphics
 *                can't; a thin low-alpha stroke reads the same) + badge.
 * - 'handbacks': up to 4 overlapped card backs + an exact "xN" count to the
 *                right, for the opponent's hidden hand.
 *
 * Same family as LandStackView: a small pile of physical sprites whose badge
 * carries the real count. Fully non-interactive and depth-agnostic — the
 * scene positions and layers it. (x, y) is the composite's visual center
 * (card + badge for deck/grave, fan + text row for handbacks).
 *
 * `setCount` is cheap to call every board sync: it mutates text (and, for
 * 'handbacks', per-back visibility) and never rebuilds sprites.
 *
 * Uses the 600×840 'cardback' canvas baked by CardFrameFactory at boot,
 * displayed down to mini size; if that texture is missing (headless edge) it
 * draws plain rounded-rect placeholders instead of crashing.
 */

export type PileKind = 'deck' | 'grave' | 'handbacks';

export interface PileViewOpts {
  /** Mini card width in design px (default 26). */
  miniW?: number;
  /** Mini card height in design px (default 36). */
  miniH?: number;
}

const DEFAULT_MINI_W = 26;
const DEFAULT_MINI_H = 36;
const CARD_RADIUS = 3;

/** Deck draws this many physical backs; the badge carries the real count. */
const DECK_LAYERS = 3;
/** Per-layer up-right offset for the deck stack (LandStackView idiom). */
const LAYER_STEP = 2;

/** Hand fan shows at most this many backs; the xN text is always exact. */
const MAX_HAND_BACKS = 4;
/** Each hand back overlaps the previous by ~60% → step is 40% of width. */
const HAND_STEP_FRAC = 0.4;
/** Gap between the fan's right edge and the xN text. */
const HAND_TEXT_GAP = 6;
/** Nominal xN text width, used only to center the composite row. */
const HAND_TEXT_NOM_W = 24;

// Count badge (deck/grave), LandStackView's badge family.
const BADGE_W = 40;
const BADGE_H = 16;
const BADGE_GAP = 4; // between the mini card's bottom edge and the badge
const BADGE_FILL = 0x0d0a18;
const BADGE_STROKE = 0x3a2f5c;
const BADGE_TEXT_COLOR = '#cbc2e0';

// Grave slot outline + card-back placeholder colors.
const GRAVE_OUTLINE = 0x8a8378;
const PLACEHOLDER_FILL = 0x241c3e;
const PLACEHOLDER_STROKE = 0x3a2f5c;

/** A mini card back: a real Image, or a Graphics placeholder when headless. */
type BackSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

export class PileView extends Phaser.GameObjects.Container {
  readonly kind: PileKind;

  private readonly miniW: number;
  private readonly miniH: number;
  /** Badge count text (deck/grave) or the xN text (handbacks). */
  private readonly countText: Phaser.GameObjects.Text;
  /** Physical back sprites; only 'handbacks' toggles their visibility. */
  private readonly backs: BackSprite[] = [];
  /** Currently shown hand backs; -1 until the first setCount applies. */
  private visibleBacks = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: PileKind,
    opts?: PileViewOpts,
  ) {
    super(scene, x, y);
    this.kind = kind;
    this.miniW = opts?.miniW ?? DEFAULT_MINI_W;
    this.miniH = opts?.miniH ?? DEFAULT_MINI_H;

    if (kind === 'handbacks') {
      this.countText = this.buildHandRow();
    } else {
      // Center the card+gap+badge composite on the origin: the mini card
      // shifts up by half the badge extent, the badge hangs below it.
      const cardCY = -(BADGE_GAP + BADGE_H) / 2;
      const badgeCY = cardCY + this.miniH / 2 + BADGE_GAP + BADGE_H / 2;
      if (kind === 'deck') {
        for (let j = 0; j < DECK_LAYERS; j++) {
          // Bottom of the pile first; each layer steps up-right slightly.
          const k = j - (DECK_LAYERS - 1) / 2;
          this.backs.push(this.makeBack(k * LAYER_STEP, cardCY - k * LAYER_STEP));
        }
      } else {
        this.drawGraveSlot(cardCY);
      }
      this.countText = this.buildBadge(badgeCY);
    }

    this.setCount(0);
    scene.add.existing(this);
  }

  /**
   * Update the displayed count. Badge/xN text always shows the exact number;
   * 'handbacks' additionally shows min(count, 4) physical backs. Visibility
   * only mutates when that clamped number changes, so per-sync calls are
   * cheap.
   */
  setCount(n: number): this {
    const count = Math.max(0, Math.floor(n));
    if (this.kind === 'handbacks') {
      this.countText.setText(`x${count}`);
      const vis = Math.min(count, MAX_HAND_BACKS);
      if (vis !== this.visibleBacks) {
        this.visibleBacks = vis;
        this.backs.forEach((b, i) => b.setVisible(i < vis));
      }
    } else {
      this.countText.setText(`${count}`);
    }
    return this;
  }

  /** One mini card back at (bx, by); placeholder rect if 'cardback' is absent. */
  private makeBack(bx: number, by: number): BackSprite {
    if (this.scene.textures.exists('cardback')) {
      const img = this.scene.add
        .image(bx, by, 'cardback')
        .setDisplaySize(this.miniW, this.miniH);
      this.add(img);
      return img;
    }
    const g = this.scene.add.graphics({ x: bx, y: by });
    g.fillStyle(PLACEHOLDER_FILL, 1);
    g.fillRoundedRect(-this.miniW / 2, -this.miniH / 2, this.miniW, this.miniH, CARD_RADIUS);
    g.lineStyle(1, PLACEHOLDER_STROKE, 1);
    g.strokeRoundedRect(-this.miniW / 2, -this.miniH / 2, this.miniW, this.miniH, CARD_RADIUS);
    this.add(g);
    return g;
  }

  /** Empty graveyard slot: faint dark fill + thin low-alpha outline. */
  private drawGraveSlot(cy: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(BADGE_FILL, 0.3);
    g.fillRoundedRect(-this.miniW / 2, cy - this.miniH / 2, this.miniW, this.miniH, CARD_RADIUS);
    g.lineStyle(1.5, GRAVE_OUTLINE, 0.55);
    g.strokeRoundedRect(-this.miniW / 2, cy - this.miniH / 2, this.miniW, this.miniH, CARD_RADIUS);
    this.add(g);
  }

  /** Rounded count badge centered at (0, cy); returns its text object. */
  private buildBadge(cy: number): Phaser.GameObjects.Text {
    const g = this.scene.add.graphics();
    g.fillStyle(BADGE_FILL, 0.92);
    g.fillRoundedRect(-BADGE_W / 2, cy - BADGE_H / 2, BADGE_W, BADGE_H, 5);
    g.lineStyle(1, BADGE_STROKE, 1);
    g.strokeRoundedRect(-BADGE_W / 2, cy - BADGE_H / 2, BADGE_W, BADGE_H, 5);
    this.add(g);
    const text = this.scene.add
      .text(0, cy, '0', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '11px',
        fontStyle: '700',
        color: BADGE_TEXT_COLOR,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.add(text);
    return text;
  }

  /**
   * Opponent-hand row: 4 pre-built overlapped backs (left→right, so later
   * backs render on top) with the xN text after them. The composite row is
   * centered on the origin assuming a nominal text width; setCount only
   * toggles back visibility, so positions never move between syncs.
   */
  private buildHandRow(): Phaser.GameObjects.Text {
    const step = this.miniW * HAND_STEP_FRAC;
    const fanW = this.miniW + (MAX_HAND_BACKS - 1) * step;
    const left = -(fanW + HAND_TEXT_GAP + HAND_TEXT_NOM_W) / 2;
    for (let i = 0; i < MAX_HAND_BACKS; i++) {
      this.backs.push(this.makeBack(left + this.miniW / 2 + i * step, 0));
    }
    const text = this.scene.add
      .text(left + fanW + HAND_TEXT_GAP, 0, 'x0', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: BADGE_TEXT_COLOR,
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    this.add(text);
    return text;
  }
}
