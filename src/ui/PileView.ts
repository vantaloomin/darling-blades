import Phaser from 'phaser';
import { bakePileIcons, PILE_ICON_KEYS, PILE_ICON_SIZE, type PileIconKind } from './pileIcons';

/**
 * Compact, display-only pile indicators for the duel layout.
 *
 * Each pile is a baked icon plus a numeric badge. The scene owns placement,
 * depth, visibility, and any future click affordance; this view intentionally
 * stays non-interactive to preserve the old pile behavior.
 */

export type PileKind = PileIconKind;

export interface PileViewOpts {
  /** Icon display size in design px (default 32). */
  iconSize?: number;
}

const BADGE_W = 40;
const BADGE_H = 16;
const BADGE_GAP = 4;
const BADGE_FILL = 0x0d0a18;
const BADGE_STROKE = 0x3a2f5c;
const BADGE_TEXT_COLOR = '#cbc2e0';

export class PileView extends Phaser.GameObjects.Container {
  readonly kind: PileKind;

  private readonly countText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PileKind, opts?: PileViewOpts) {
    super(scene, x, y);
    this.kind = kind;

    bakePileIcons(scene);

    const iconSize = opts?.iconSize ?? PILE_ICON_SIZE;
    const iconCY = -(BADGE_GAP + BADGE_H) / 2;
    const badgeCY = iconCY + iconSize / 2 + BADGE_GAP + BADGE_H / 2;
    const icon = scene.add.image(0, iconCY, PILE_ICON_KEYS[kind]).setDisplaySize(iconSize, iconSize);
    this.add(icon);
    this.countText = this.buildBadge(badgeCY);

    this.setCount(0);
    scene.add.existing(this);
  }

  setCount(n: number): this {
    const count = Math.max(0, Math.floor(n));
    this.countText.setText(`${count}`);
    return this;
  }

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
}
