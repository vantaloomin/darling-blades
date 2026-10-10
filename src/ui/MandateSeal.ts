import Phaser from 'phaser';
import { attachTouchGestures } from '../platform/gestures';
import {
  MANDATE_CLAIM_MS,
  MANDATE_REMINDER,
  MANDATE_SEAL_HIT,
  MANDATE_SEAL_SIZE,
  mandateSealCaption,
  type MandateSpot,
} from './mandatePresentation';
import { colorInt, theme } from './theme';

/** The star knocked into the seal, on a unit radius (the glossary glyph's proportions). */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.66 : 0.27;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return { x: r * Math.cos(a), y: 0.05 + r * Math.sin(a) };
});
const RULES_W = 300;

/**
 * The Mandate on the duel board (2.0 lane B4): one gold seal with a star,
 * beside its holder's life, or a dark seal with a dashed gold rim while no one
 * holds it. Hover (or tap on touch) shows who holds it and the rules reminder.
 *
 * The seal is a plain Container that is never interactive; its 44px hit area
 * is a separate Zone that follows it (never `setInteractive` a scaled
 * Container). DuelScene owns where it is: `place` snaps it, `fly` animates a
 * claim and reports when it has landed.
 */
export class MandateSeal {
  private readonly seal: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  private readonly tip: Phaser.GameObjects.Container;
  private readonly tipPlate: Phaser.GameObjects.Graphics;
  private readonly tipCaption: Phaser.GameObjects.Text;
  private readonly tipRules: Phaser.GameObjects.Text;
  private spot: MandateSpot | null = null;
  private flight: Phaser.Tweens.Tween | null = null;
  private inputAllowed = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.face = scene.add.graphics();
    this.seal = scene.add.container(0, 0, [this.face]).setDepth(theme.depth.hudLabel).setVisible(false);
    this.hit = scene.add.zone(0, 0, MANDATE_SEAL_HIT, MANDATE_SEAL_HIT).setDepth(theme.depth.hudLabel);
    this.hit.setInteractive({ useHandCursor: true }).setName('duel-mandate-seal');
    this.hit.disableInteractive();

    this.tipPlate = scene.add.graphics();
    this.tipCaption = scene.add.text(12, 10, '', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.label}px`, fontStyle: theme.weight.w700,
      color: theme.colors.gold, resolution: 2,
    });
    this.tipRules = scene.add.text(12, 0, MANDATE_REMINDER, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body,
      resolution: 2, wordWrap: { width: RULES_W - 24 },
    });
    this.tip = scene.add.container(0, 0, [this.tipPlate, this.tipCaption, this.tipRules])
      .setDepth(theme.depth.popover).setVisible(false);

    this.hit.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.showTip(true);
    });
    this.hit.on('pointerout', () => this.showTip(false));
    attachTouchGestures(scene, this.hit, { onTap: () => this.showTip(!this.tip.visible) });
  }

  /** Where the seal is drawn now, or null while hidden. */
  get shownSpot(): MandateSpot | null {
    return this.seal.visible ? this.spot : null;
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  /** Snap to a spot (or hide with null). Ignored while a claim is in flight. */
  place(spot: MandateSpot | null, at: { x: number; y: number } | null): void {
    if (this.flight) return;
    if (spot === null || at === null) {
      this.spot = null;
      this.seal.setVisible(false);
      this.syncInput();
      this.showTip(false);
      return;
    }
    if (spot !== this.spot) this.draw(spot);
    this.spot = spot;
    this.seal.setPosition(at.x, at.y).setScale(1).setAlpha(1).setVisible(true);
    this.hit.setPosition(at.x, at.y);
    this.syncInput();
  }

  /**
   * Off while a player's face is a legal target: the seal sits on the
   * portrait, and the portrait's whole frame must take that pick.
   */
  setInputAllowed(allowed: boolean): void {
    this.inputAllowed = allowed;
    if (!allowed) this.showTip(false);
    this.syncInput();
  }

  private syncInput(): void {
    if (this.inputAllowed && this.seal.visible && !this.flight) this.hit.setInteractive();
    else this.hit.disableInteractive();
  }

  /**
   * The claim: the seal flies from `from` to `to` (about 600 ms), swelling at
   * mid-flight, and leaves a fading ring where it was. Instant when motion is
   * reduced. `done` runs once it has landed.
   */
  fly(
    from: { x: number; y: number },
    to: { x: number; y: number },
    spot: MandateSpot,
    animate: boolean,
    done: () => void,
  ): void {
    this.flight?.stop();
    this.flight = null;
    this.showTip(false);
    if (!animate) {
      this.place(spot, to);
      done();
      return;
    }
    this.draw(spot);
    this.spot = spot;
    this.hit.disableInteractive();
    this.seal.setPosition(from.x, from.y).setScale(1).setAlpha(1).setVisible(true);
    const ring = this.scene.add.graphics().setDepth(theme.depth.hudLabel).setPosition(from.x, from.y);
    ring.lineStyle(2, colorInt(theme.colors.gold), 1).strokeCircle(0, 0, MANDATE_SEAL_SIZE / 2);
    this.scene.tweens.add({
      targets: ring, scale: 1.8, alpha: 0, duration: 420, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.flight = this.scene.tweens.add({
      targets: this.seal, x: to.x, y: to.y, duration: MANDATE_CLAIM_MS, ease: 'Cubic.easeInOut',
      onUpdate: (tween) => this.seal.setScale(1 + 0.35 * Math.sin(Math.PI * tween.progress)),
      onComplete: () => {
        this.flight = null;
        this.place(spot, to);
        done();
      },
    });
  }

  destroy(): void {
    this.flight?.stop();
    this.flight = null;
    this.seal.destroy();
    this.hit.destroy();
    this.tip.destroy();
  }

  private draw(spot: MandateSpot): void {
    const r = MANDATE_SEAL_SIZE / 2;
    const gold = colorInt(theme.colors.gold);
    const g = this.face.clear();
    const star = STAR.map((p) => new Phaser.Math.Vector2(p.x * r, p.y * r));
    if (spot === 'unclaimed') {
      // Dark disc, dashed gold rim, the star in outline: waiting for a claim.
      g.fillStyle(theme.graphics.panelFill, 0.95).fillCircle(0, 0, r);
      g.lineStyle(2, gold, 0.95);
      const dashes = 12;
      for (let i = 0; i < dashes; i++) {
        const a0 = (i * 2 * Math.PI) / dashes;
        g.beginPath().arc(0, 0, r - 1, a0, a0 + Math.PI / dashes).strokePath();
      }
      g.lineStyle(1.5, gold, 0.8).strokePoints(star, true, true);
      return;
    }
    // Held: a solid gold seal with the star knocked out in the panel colour.
    g.fillStyle(gold, 1).fillCircle(0, 0, r);
    g.lineStyle(1, theme.graphics.panelFill, 0.8).strokeCircle(0, 0, r - 2.5);
    g.fillStyle(theme.graphics.panelFill, 1).fillPoints(star, true, true);
  }

  private showTip(show: boolean): void {
    if (!show || this.spot === null || !this.seal.visible) {
      this.tip.setVisible(false);
      return;
    }
    this.tipCaption.setText(mandateSealCaption(this.spot));
    this.tipRules.setY(this.tipCaption.y + this.tipCaption.height + 4);
    const h = this.tipRules.y + this.tipRules.height + 10;
    this.tipPlate.clear()
      .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(0, 0, RULES_W, h, theme.radius.control)
      .lineStyle(1.5, colorInt(theme.colors.gold), theme.alpha.chrome)
      .strokeRoundedRect(0, 0, RULES_W, h, theme.radius.control);
    const safe = theme.design.titleSafe;
    const x = Phaser.Math.Clamp(this.seal.x - RULES_W / 2, safe.left, safe.right - RULES_W);
    // Your seal is low on the board, so its card opens upward; the others open downward.
    const y = this.spot === 'you'
      ? this.seal.y - MANDATE_SEAL_HIT / 2 - 6 - h
      : this.seal.y + MANDATE_SEAL_HIT / 2 + 6;
    this.tip.setPosition(x, y).setVisible(true);
  }
}
