import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { theme, colorInt } from './theme';
import { duelPanelAlpha } from './duelPanelPresentation';
import { bakePileIcons, PILE_ICON_KEYS, PILE_ICON_SIZE, type PileIconKind } from './pileIcons';
import { CONSOLAS_FIGURE_HEIGHT, ensureNumeralBadgeInk, ensureNumeralPlateInk } from './NumeralGlyphs';

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
const ALERT_CHIP_R = 9;
// HUD numerals retain the release badge geometry, like the duel life totals:
// the vector digits keep the cap height of the 11px Consolas they replace.
const PILE_NUMERAL_SIZE = 11;
const PILE_DIGIT_HEIGHT = PILE_NUMERAL_SIZE * CONSOLAS_FIGURE_HEIGHT;
/** The count drawn in the badge's own box (a rare wide count may overhang). */
const PILE_COUNT_PLATE = { digitHeight: PILE_DIGIT_HEIGHT, padX: 3, padY: 0, minWidth: BADGE_W, minHeight: BADGE_H } as const;

export class PileView extends Phaser.GameObjects.Container {
  readonly kind: PileKind;
  readonly inputZone?: Phaser.GameObjects.Zone;

  private readonly countDigits: Phaser.GameObjects.Image;
  private readonly alertBounds: { top: number; bottom: number; width: number };
  private alertNodes: { outline: Phaser.GameObjects.Graphics; chipDigits: Phaser.GameObjects.Image } | null = null;
  private alertTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PileKind, opts?: PileViewOpts) {
    super(scene, x, y);
    this.kind = kind;
    this.setData('a11yArea', { x: 0, y: 0, width: theme.design.width, height: theme.design.height });

    bakePileIcons(scene);

    const iconSize = opts?.iconSize ?? PILE_ICON_SIZE;
    const iconCY = -(BADGE_GAP + BADGE_H) / 2;
    const badgeCY = iconCY + iconSize / 2 + BADGE_GAP + BADGE_H / 2;
    const icon = scene.add.image(0, iconCY, PILE_ICON_KEYS[kind]).setDisplaySize(iconSize, iconSize);
    this.add(icon);
    this.countDigits = this.buildBadge(badgeCY);
    this.alertBounds = {
      top: iconCY - iconSize / 2,
      bottom: badgeCY + BADGE_H / 2,
      width: Math.max(iconSize, BADGE_W),
    };
    if (opts?.onTap) {
      this.inputZone = this.buildInputZone(iconSize, iconCY, badgeCY, opts.onTap);
    }

    this.setCount(0);
    scene.add.existing(this);
  }

  setCount(n: number): this {
    const count = Math.max(0, Math.floor(n));
    const ink = ensureNumeralPlateInk(this.scene, count, theme.colors.body, PILE_COUNT_PLATE);
    this.countDigits.setTexture(ink.texture).setDisplaySize(ink.width, ink.height).setData('a11yNumeral', String(count));
    return this;
  }

  /**
   * Castable-from-this-pile affordance: a pulsing gold outline plus a small
   * chip showing how many casts are legal right now. 0 hides it. The scene
   * owns WHEN (it knows legality); this owns only the look.
   */
  setAlert(n: number): this {
    const count = Math.max(0, Math.floor(n));
    if (count === 0) {
      this.alertTween?.remove();
      this.alertTween = null;
      if (this.alertNodes) {
        this.alertNodes.outline.destroy();
        this.alertNodes.chipDigits.destroy();
        this.alertNodes = null;
      }
      return this;
    }
    if (!this.alertNodes) {
      const pad = 5;
      const { top, bottom, width } = this.alertBounds;
      const outline = this.scene.add.graphics();
      outline.lineStyle(2, colorInt(theme.colors.goldHover), 1);
      outline.strokeRoundedRect(
        -width / 2 - pad,
        top - pad,
        width + pad * 2,
        bottom - top + pad * 2,
        6,
      );
      const chipX = width / 2 + pad;
      const chipY = top - pad;
      outline.fillStyle(colorInt(theme.colors.goldHover), 1);
      outline.fillCircle(chipX, chipY, ALERT_CHIP_R);
      const chipDigits = this.scene.add.image(chipX, chipY, '__DEFAULT');
      this.showChipCount(chipDigits, count);
      this.add(outline);
      this.add(chipDigits);
      this.alertNodes = { outline, chipDigits };
      this.alertTween = this.scene.tweens.add({
        targets: outline,
        alpha: 0.55,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.showChipCount(this.alertNodes.chipDigits, count);
    }
    return this;
  }

  /** The chip's count as vector digits centred on their ink, sized like the
   * Consolas numeral it replaces; a rare 3+ digit count shrinks to the chip. */
  private showChipCount(chip: Phaser.GameObjects.Image, count: number): void {
    const ink = ensureNumeralBadgeInk(this.scene, count, theme.colors.onGold, PILE_DIGIT_HEIGHT, ALERT_CHIP_R * 2);
    const size = Math.min(ink.diameter, ALERT_CHIP_R * 2);
    chip.setTexture(ink.texture).setDisplaySize(size, size).setData('a11yNumeral', String(count));
  }

  private buildBadge(cy: number): Phaser.GameObjects.Image {
    const g = this.scene.add.graphics();
    g.fillStyle(theme.graphics.panelFill, duelPanelAlpha(0.92));
    g.fillRoundedRect(-BADGE_W / 2, cy - BADGE_H / 2, BADGE_W, BADGE_H, 5);
    g.lineStyle(1, theme.graphics.panelStroke, 1);
    g.strokeRoundedRect(-BADGE_W / 2, cy - BADGE_H / 2, BADGE_W, BADGE_H, 5);
    this.add(g);

    // setCount bakes the count's numeral into this image.
    const digits = this.scene.add.image(0, cy, '__DEFAULT');
    this.add(digits);
    return digits;
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
