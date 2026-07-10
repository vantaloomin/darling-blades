import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';

/**
 * "Reactive waifu on stage" panel for the duel board (wireframe 1a): a
 * character-art frame with rounded TOP corners and a square bottom, meant to
 * sit flush against the screen's bottom edge so it reads as rising from it.
 * Shows the commander/deck face art cover-cropped to the face band, a name
 * plate, and two purely decorative reactions (damage flinch, cast glow).
 *
 * Deliberately generic and dumb: it receives a cardId + label and knows
 * nothing about decks or avatars. DuelScene owns position, depth and
 * lifetime; there is no input handling anywhere. Reactions are
 * fire-and-forget tweens that never gate game flow — they resolve through
 * onComplete (so tweens.timeScale = 20 fast-forward just ends them sooner)
 * and rapid re-triggers kill-and-restart cleanly.
 */

const CORNER_R = 12;
/** Art window inset inside the 1px border so the frame stroke stays visible. */
const INSET = 2;
const LABEL_H = 22;

export interface CommanderPortraitOpts {
  width: number;
  height: number;
  /** Which screen edge the pinned portrait descends from. */
  edge?: 'bottom' | 'top';
  /** Card whose art fills the frame; null renders frame + label only. */
  cardId: string | null;
  /**
   * Direct texture key for a non-card (premium) hero portrait — preferred over
   * cardId when set and loaded, so a bespoke hero PNG can front the portrait
   * without going through the card art resolver.
   */
  textureKey?: string;
  /** Deck/opponent name shown on the bottom plate. */
  label: string;
}

export class CommanderPortrait extends Phaser.GameObjects.Container {
  private art: Phaser.GameObjects.Image | null = null;
  private artBaseX = 0;
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private readonly glowRect: Phaser.GameObjects.Rectangle;
  private readonly labelText: Phaser.GameObjects.Text;
  private maskGfx: Phaser.GameObjects.Graphics | null = null;
  private geoMask: Phaser.Display.Masks.GeometryMask | null = null;
  private readonly frameW: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: CommanderPortraitOpts) {
    super(scene, x, y);
    const w = opts.width;
    const h = opts.height;
    const edge = opts.edge ?? 'bottom';
    this.frameW = w;

    // Plate + border in the duel HUD family (DuelScene's bottom-left HUD
    // plate: 0x1d1636 @ 0.92 with a 1px 0x3a2f5c stroke). The bottom-edge
    // variant rises from the screen floor; the top-edge variant descends from
    // the ceiling, so its rounded corners flip to the bottom.
    const corners = edge === 'bottom'
      ? { tl: CORNER_R, tr: CORNER_R, bl: 0, br: 0 }
      : { tl: 0, tr: 0, bl: CORNER_R, br: CORNER_R };
    const plate = scene.add.graphics();
    plate.fillStyle(0x1d1636, 0.92);
    plate.fillRoundedRect(0, 0, w, h, corners);
    plate.lineStyle(1, 0x3a2f5c, 1);
    plate.strokeRoundedRect(0, 0, w, h, corners);

    const artW = w - INSET * 2;
    const artH = h - INSET - LABEL_H;
    const artCX = w / 2;
    const artCY = INSET + artH / 2;

    // Geometry masks stencil in WORLD space: the mask Graphics renders with
    // its OWN transform, a parentContainer's offset is never applied. So the
    // shape lives outside the container, drawn at our world position (the
    // constructor x/y — this panel is pinned, DuelScene never moves it).
    // LIMITATION: if the container were ever moved/tweened, the mask would
    // stay behind and the shape would need redrawing at the new position.
    // The bottom-edge variant needs rounded top art corners. For the top-edge
    // variant, the bottom label plate owns the rounded outer corners instead.
    const maskCorners = edge === 'bottom'
      ? { tl: CORNER_R - INSET, tr: CORNER_R - INSET, bl: 0, br: 0 }
      : { tl: 0, tr: 0, bl: 0, br: 0 };
    this.maskGfx = scene.add.graphics().setVisible(false);
    this.maskGfx.fillStyle(0xffffff, 1);
    this.maskGfx.fillRoundedRect(x + INSET, y + INSET, artW, artH, maskCorners);
    this.geoMask = this.maskGfx.createGeometryMask();

    if (opts.textureKey && scene.textures.exists(opts.textureKey)) {
      this.buildArtFromTexture(opts.textureKey, artCX, artCY, artW, artH);
    } else if (opts.cardId) {
      this.buildArt(opts.cardId, artCX, artCY, artW, artH);
    }

    // Reaction overlays exist even without art so damage/cast still read on a
    // frame-only fallback. They share the art mask so the rounded top holds.
    this.flashRect = scene.add
      .rectangle(artCX, artCY, artW, artH, 0xff3b2f, 1)
      .setAlpha(0)
      .setMask(this.geoMask);
    this.glowRect = scene.add
      .rectangle(artCX, artCY, artW, artH, 0xffe9b0, 1)
      .setAlpha(0)
      .setMask(this.geoMask);

    // Bottom label plate with a gold hairline on top, HUD seam-style. Its
    // lower corners continue the top-edge frame's downward-facing rounding.
    const labelPlate = scene.add.graphics();
    labelPlate.fillStyle(0x161226, 0.94);
    if (edge === 'top') {
      labelPlate.fillRoundedRect(1, h - LABEL_H, w - 2, LABEL_H - 1, {
        tl: 0,
        tr: 0,
        bl: CORNER_R - 1,
        br: CORNER_R - 1,
      });
    } else {
      labelPlate.fillRect(1, h - LABEL_H, w - 2, LABEL_H - 1);
    }
    labelPlate.fillStyle(0x8a6d1f, 0.55);
    labelPlate.fillRect(1, h - LABEL_H, w - 2, 1);

    this.labelText = scene.add
      .text(w / 2, h - LABEL_H / 2, opts.label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffd88a',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.fitLabel();

    const children: Phaser.GameObjects.GameObject[] = [plate];
    if (this.art) children.push(this.art);
    children.push(this.flashRect, this.glowRect, labelPlate, this.labelText);
    this.add(children);
    this.setSize(w, h);
    scene.add.existing(this);
  }

  /**
   * Cover-crop the portrait-aspect art (640×800 full-res, 320×400 atlas
   * placeholders — always pass textureKey AND frameName so both work) into
   * the window with the GauntletScene addPortrait recipe: ~12% overscan and
   * an upward bias so the face band reads. Missing art must degrade to
   * frame + label, never crash the duel.
   */
  private buildArt(cardId: string, cx: number, cy: number, artW: number, artH: number): void {
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const img = ref.frameName
        ? this.scene.add.image(cx, cy, ref.textureKey, ref.frameName)
        : this.scene.add.image(cx, cy, ref.textureKey);
      const srcW = img.frame.width;
      const srcH = img.frame.height;
      const scale = Math.max(artW / srcW, artH / srcH) * 1.12;
      img.setScale(scale);
      // Clamp the bias to the vertical overscan so the art always covers the
      // window bottom (an unclamped fixed bias leaves a gap on wide windows).
      const overflow = Math.max(0, (srcH * scale - artH) / 2);
      img.y = cy - Math.min(artH * 0.08, overflow);
      if (this.geoMask) img.setMask(this.geoMask);
      this.art = img;
      this.artBaseX = cx;
    } catch {
      this.art = null; // frame + label alone is an acceptable fallback
    }
  }

  /**
   * Cover-crop a bespoke hero PNG (a plain texture, no card atlas frame) into
   * the window with the same overscan/upward-bias recipe as buildArt. Missing
   * art must degrade to frame + label, never crash the duel.
   */
  private buildArtFromTexture(
    textureKey: string,
    cx: number,
    cy: number,
    artW: number,
    artH: number,
  ): void {
    try {
      const img = this.scene.add.image(cx, cy, textureKey);
      const srcW = img.frame.width;
      const srcH = img.frame.height;
      const scale = Math.max(artW / srcW, artH / srcH) * 1.12;
      img.setScale(scale);
      const overflow = Math.max(0, (srcH * scale - artH) / 2);
      img.y = cy - Math.min(artH * 0.08, overflow);
      if (this.geoMask) img.setMask(this.geoMask);
      this.art = img;
      this.artBaseX = cx;
    } catch {
      this.art = null;
    }
  }

  /** Update the bottom plate text (fit-to-width by scale, BoardCardView-style). */
  setLabel(text: string): this {
    if (!this.labelText.active) return this;
    this.labelText.setText(text);
    this.fitLabel();
    return this;
  }

  private fitLabel(): void {
    this.labelText.setScale(Math.min(1, (this.frameW - 14) / Math.max(1, this.labelText.width)));
  }

  /**
   * Damage flinch: short horizontal shake of the ART only (the container
   * never moves — DuelScene owns x/y) plus a quick red flash. Idempotent
   * under rapid re-trigger: any in-flight reaction is killed and its resting
   * state restored before the new one starts.
   */
  reactDamage(): void {
    if (!this.active || !this.scene) return;
    this.killReactions();
    const tweens = this.scene.tweens;
    if (this.art?.active) {
      const art = this.art;
      art.setTint(0xff9a86);
      tweens.add({
        targets: art,
        x: { from: this.artBaseX - 4, to: this.artBaseX + 4 },
        duration: 34,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!art.active) return;
          art.x = this.artBaseX;
          art.clearTint();
        },
      });
    }
    tweens.add({
      targets: this.flashRect,
      alpha: { from: 0, to: 0.28 },
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.flashRect.active) this.flashRect.setAlpha(0);
      },
    });
  }

  /** Cast glow: a warm overlay pulse over the art window, ~250ms round trip. */
  reactCast(): void {
    if (!this.active || !this.scene) return;
    this.killReactions();
    this.scene.tweens.add({
      targets: this.glowRect,
      alpha: { from: 0, to: 0.18 },
      duration: 125,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.glowRect.active) this.glowRect.setAlpha(0);
      },
    });
  }

  /** kill() skips onComplete, so resting visuals are restored by hand here. */
  private killReactions(): void {
    const tweens = this.scene?.tweens;
    if (!tweens) return;
    if (this.art?.active) {
      tweens.killTweensOf(this.art);
      this.art.x = this.artBaseX;
      this.art.clearTint();
    }
    if (this.flashRect.active) {
      tweens.killTweensOf(this.flashRect);
      this.flashRect.setAlpha(0);
    }
    if (this.glowRect.active) {
      tweens.killTweensOf(this.glowRect);
      this.glowRect.setAlpha(0);
    }
  }

  destroy(fromScene?: boolean): void {
    // Kill in-flight reaction tweens against children about to die, and drop
    // the world-space mask shape — it is NOT a child of this container, so a
    // manual destroy would otherwise leak it (on scene shutdown the display
    // list destroys it too; the second destroy() is a safe no-op).
    this.killReactions();
    this.geoMask?.destroy();
    this.geoMask = null;
    this.maskGfx?.destroy();
    this.maskGfx = null;
    super.destroy(fromScene);
  }
}
