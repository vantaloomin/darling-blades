import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { bakePileIcons, PILE_ICON_KEYS, PILE_ICON_SIZE, type PileIconKind } from './pileIcons';

/**
 * Compact, display-only pile indicators for the duel layout.
 *
 * Each pile is a baked icon plus a numeric badge. The scene owns placement,
 * depth, visibility, and any optional click affordance; input lives on a child
 * Zone rather than the Container.
 */

export type PileKind = PileIconKind;

export interface PileViewOpts {
  /** Icon display size in design px (default 32). */
  iconSize?: number;
  /** Optional tap affordance for public/inspectable zones. */
  onTap?: (pointer: Phaser.Input.Pointer) => void;
}

const BADGE_W = 40;
const BADGE_H = 16;
const BADGE_GAP = 4;
const BADGE_FILL = 0x0d0a18;
const BADGE_STROKE = 0x3a2f5c;
const BADGE_TEXT_COLOR = '#cbc2e0';

export class PileView extends Phaser.GameObjects.Container {
  readonly kind: PileKind;
  readonly inputZone?: Phaser.GameObjects.Zone;

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
    if (opts?.onTap) {
      this.inputZone = this.buildInputZone(iconSize, iconCY, badgeCY, opts.onTap);
    }

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

  private buildInputZone(
    iconSize: number,
    iconCY: number,
    badgeCY: number,
    onTap: (pointer: Phaser.Input.Pointer) => void,
  ): Phaser.GameObjects.Zone {
    const top = iconCY - iconSize / 2;
    const bottom = badgeCY + BADGE_H / 2;
    const height = Math.max(44, bottom - top);
    const width = Math.max(44, iconSize, BADGE_W);
    const zone = this.scene.add.zone(0, top + height / 2, width, height).setInteractive({ useHandCursor: true });
    this.add(zone);
    bindTapButton(this.scene, zone, onTap);
    inflateHitArea(zone, 44, 44);
    return zone;
  }
}
