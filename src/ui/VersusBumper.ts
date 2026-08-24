import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import type { AnimationLevel } from '../platform/animPolicy';
import { colorInt, theme } from './theme';
import {
  VERSUS_BUMPER_LAYOUT,
  versusBumperMaskPoints,
  versusBumperMotion,
  type VersusBumperPoint,
} from './versusBumperPresentation';

const WIDTH = VERSUS_BUMPER_LAYOUT.width;
const HEIGHT = VERSUS_BUMPER_LAYOUT.height;
const SPLIT_TOP_X = VERSUS_BUMPER_LAYOUT.splitTopX;
const SPLIT_BOTTOM_X = VERSUS_BUMPER_LAYOUT.splitBottomX;
const PORTRAIT_COVER_W = 790;

interface VersusIdentity {
  cardId: string | null;
  textureKey?: string;
  label: string;
}

export interface VersusBumperOptions {
  animations: Exclude<AnimationLevel, 'off'>;
  player: VersusIdentity;
  opponent: VersusIdentity;
  onComplete: () => void;
}

/**
 * Short duel-entry overlay built entirely from already-loaded portrait art.
 * It owns presentation time only: DuelScene starts its event/action loop from
 * onComplete, including when any pointer or key skips the sequence.
 */
export class VersusBumper {
  private readonly root: Phaser.GameObjects.Container;
  private readonly leftPanel: Phaser.GameObjects.Container;
  private readonly rightPanel: Phaser.GameObjects.Container;
  private readonly centerLockup: Phaser.GameObjects.Container;
  private readonly maskGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly masks: Phaser.Display.Masks.GeometryMask[] = [];
  private continueTimer: Phaser.Time.TimerEvent | null = null;
  private exiting = false;
  private finished = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: VersusBumperOptions,
  ) {
    const motion = versusBumperMotion(options.animations);
    // Keep the overlay in the same camera coordinate space as its GeometryMasks.
    // A fixed-scroll Container diverges from mask coordinates once the camera's
    // render-scale zoom is above 1, producing clipped slivers and short plates.
    this.root = scene.add.container(0, 0).setDepth(theme.depth.results + 10);

    const inputCurtain = scene.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, theme.graphics.dim, 1)
      .setInteractive({ useHandCursor: true });
    inputCurtain.on('pointerdown', this.finish, this);
    this.root.add(inputCurtain);

    const leftPoints = versusBumperMaskPoints('left');
    const rightPoints = versusBumperMaskPoints('right');
    const leftMask = this.makeMask(leftPoints);
    const rightMask = this.makeMask(rightPoints);

    this.leftPanel = scene.add.container(-motion.panelSlidePx, 0).setAlpha(0);
    this.rightPanel = scene.add.container(motion.panelSlidePx, 0).setAlpha(0);
    this.buildPanel(this.leftPanel, options.player, 'YOUR DECK', 302, leftPoints, leftMask, false);
    this.buildPanel(this.rightPanel, options.opponent, 'CHALLENGER', 978, rightPoints, rightMask, true);
    this.root.add([this.leftPanel, this.rightPanel]);

    const seam = scene.add.graphics();
    seam.lineStyle(8, colorInt(theme.colors.panelFill), 0.94);
    seam.lineBetween(SPLIT_TOP_X, 0, SPLIT_BOTTOM_X, HEIGHT);
    seam.lineStyle(2, colorInt(theme.colors.gold), 0.9);
    seam.lineBetween(SPLIT_TOP_X - 3, 0, SPLIT_BOTTOM_X - 3, HEIGHT);
    this.root.add(seam);

    const medallion = scene.add
      .circle(WIDTH / 2, HEIGHT / 2, 48, theme.graphics.panelFill, 0.96)
      .setStrokeStyle(2, colorInt(theme.colors.gold), 0.92);
    const versus = scene.add
      .text(WIDTH / 2, HEIGHT / 2 - 1, 'VS', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.centerLockup = scene.add
      .container(0, 0, [medallion, versus])
      .setAlpha(0)
      .setScale(motion.versusScaleFrom);
    this.root.add(this.centerLockup);

    const hint = scene.add
      .text(WIDTH / 2, theme.design.safeBottom - 8, 'Tap to continue', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setAlpha(0);
    this.root.add(hint);

    const ease = theme.motion.easeOut;
    scene.tweens.add({
      targets: this.leftPanel,
      x: 0,
      alpha: 1,
      duration: motion.entranceMs,
      ease,
    });
    scene.tweens.add({
      targets: this.rightPanel,
      x: 0,
      alpha: 1,
      duration: motion.entranceMs,
      ease,
    });
    scene.tweens.add({
      targets: this.centerLockup,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      delay: 70,
      duration: motion.entranceMs,
      ease,
    });
    scene.tweens.add({
      targets: hint,
      alpha: theme.alpha.subtle,
      delay: motion.entranceMs,
      duration: theme.motion.base,
      ease,
    });

    this.continueTimer = scene.time.delayedCall(motion.entranceMs + motion.holdMs, this.finish, [], this);
    scene.input.keyboard?.on('keydown', this.onAnyKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private makeMask(points: Phaser.Types.Math.Vector2Like[]): Phaser.Display.Masks.GeometryMask {
    const graphics = this.scene.add.graphics().setVisible(false);
    graphics.fillStyle(0xffffff, 1).fillPoints(points, true);
    this.maskGraphics.push(graphics);
    const mask = graphics.createGeometryMask();
    this.masks.push(mask);
    return mask;
  }

  private buildPanel(
    panel: Phaser.GameObjects.Container,
    identity: VersusIdentity,
    role: string,
    centerX: number,
    points: VersusBumperPoint[],
    mask: Phaser.Display.Masks.GeometryMask,
    mirror: boolean,
  ): void {
    const shape = this.scene.add.graphics();
    shape.fillStyle(mirror ? 0x241d3a : 0x161226, 1);
    shape.fillPoints(points, true);
    panel.add(shape);

    const portrait = this.addPortrait(identity, centerX, mask, mirror);
    if (portrait) panel.add(portrait);

    const shade = this.scene.add.graphics();
    shade.fillStyle(theme.graphics.dim, 0.46).fillPoints(points, true);
    panel.add(shade);

    const roleText = this.scene.add
      .text(centerX, 536, role, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
        resolution: 2,
      })
      .setOrigin(0.5);
    const nameText = this.scene.add
      .text(centerX, 580, identity.label, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.heading,
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5);
    nameText.setScale(Math.min(1, 430 / Math.max(1, nameText.width)));
    panel.add([roleText, nameText]);
  }

  private addPortrait(
    identity: VersusIdentity,
    x: number,
    mask: Phaser.Display.Masks.GeometryMask,
    mirror: boolean,
  ): Phaser.GameObjects.Image | null {
    try {
      let image: Phaser.GameObjects.Image;
      if (identity.textureKey && this.scene.textures.exists(identity.textureKey)) {
        image = this.scene.add.image(x, HEIGHT / 2 - 38, identity.textureKey);
      } else if (identity.cardId) {
        const ref = Art.resolver?.getArt(identity.cardId);
        if (!ref) return null;
        image = ref.frameName
          ? this.scene.add.image(x, HEIGHT / 2 - 38, ref.textureKey, ref.frameName)
          : this.scene.add.image(x, HEIGHT / 2 - 38, ref.textureKey);
      } else {
        return null;
      }
      const scale = Math.max(PORTRAIT_COVER_W / image.frame.width, HEIGHT / image.frame.height) * 1.06;
      image.setScale(mirror ? -scale : scale, scale).setMask(mask);
      return image;
    } catch {
      return null;
    }
  }

  private onAnyKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.finish();
  }

  private finish(): void {
    if (this.finished || this.exiting || !this.root.active) return;
    this.exiting = true;
    this.continueTimer?.remove();
    this.continueTimer = null;
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: versusBumperMotion(this.options.animations).exitMs,
      ease: theme.motion.easeOut,
      onComplete: () => this.complete(),
    });
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    const complete = this.options.onComplete;
    this.teardown();
    complete();
  }

  /** Scene shutdown cancels the bumper without starting the abandoned duel. */
  destroy(): void {
    if (this.finished) return;
    this.finished = true;
    this.teardown();
  }

  private teardown(): void {
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.input.keyboard?.off('keydown', this.onAnyKey, this);
    this.continueTimer?.remove();
    this.continueTimer = null;
    this.scene.tweens.killTweensOf([
      this.root,
      this.leftPanel,
      this.rightPanel,
      this.centerLockup,
      ...this.root.list,
    ]);
    if (this.root.active) this.root.destroy(true);
    for (const mask of this.masks) mask.destroy();
    this.masks.length = 0;
    for (const graphics of this.maskGraphics) {
      if (graphics.active) graphics.destroy();
    }
    this.maskGraphics.length = 0;
  }
}
