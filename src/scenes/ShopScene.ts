import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { createRngState } from '../engine/rng';
import { spendGold } from '../meta/Economy';
import { openPack } from '../meta/PackOpener';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { fxPolicy } from '../ui/fx/FXSupport';
import { applyBackdrop } from '../ui/SceneBackdrop';

const PACK_W = 280;
const PACK_H = 400;

const packRR = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Procedural pack base (the fallback when no real pack-art is on disk). */
function bakeProceduralPackBase(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, PACK_W, PACK_H);
  g.addColorStop(0, '#3a2a63');
  g.addColorStop(0.5, '#1c1433');
  g.addColorStop(1, '#4a1c4a');
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#c9a84c';
  ctx.stroke();
  // foil band
  const band = ctx.createLinearGradient(0, 0, PACK_W, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(255,235,170,0.55)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(30, 60, PACK_W - 60, 26);
  // central sigil
  ctx.save();
  ctx.translate(PACK_W / 2, 265);
  for (const [r, a] of [
    [86, 0.35],
    [60, 0.6],
    [34, 0.95],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(212,175,55,${a})`;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Real pack-art (docs/scene-art.md `pack-art`): cover-crop the 640×800 source
 * into the 280×400 canvas inside the rounded clip (r 14). The art is text-free
 * (NO-TEXT rule); the crimps + wordmark are code-stamped over it afterward.
 */
function bakeRealPackBase(scene: Phaser.Scene, ctx: CanvasRenderingContext2D): void {
  const img = scene.textures.get('scene-pack-art').getSourceImage() as CanvasImageSource;
  const sw = (img as { width: number }).width;
  const sh = (img as { height: number }).height;
  ctx.save();
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.clip();
  const scale = Math.max(PACK_W / sw, PACK_H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (PACK_W - dw) / 2, (PACK_H - dh) / 2, dw, dh);
  ctx.restore();
  // gold trim over the cropped edge (the procedural path strokes it inline)
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#c9a84c';
  ctx.stroke();
}

/**
 * Bake the booster-pack art once (shared with PackOpeningScene). Real front
 * art when the scene-art PNG is on disk, else the procedural pack. The crimp
 * bands and code-stamped wordmark are re-stamped over BOTH (the real art is
 * required to be text-free), so the pack always reads as a sealed product.
 */
export function bakePackArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('packart')) return;
  const W = PACK_W;
  const H = PACK_H;
  const tex = scene.textures.createCanvas('packart', W, H)!;
  const ctx = tex.getContext();

  if (scene.textures.exists('scene-pack-art')) {
    bakeRealPackBase(scene, ctx);
  } else {
    bakeProceduralPackBase(ctx);
  }

  // Crimp bands + wordmark, always code-stamped over the base (the plain
  // top/bottom bands the art leaves for exactly this).
  ctx.fillStyle = '#241c3d';
  ctx.fillRect(2, 2, W - 4, 26);
  ctx.fillRect(2, H - 28, W - 4, 26);
  ctx.textAlign = 'center';
  ctx.font = '700 34px Cinzel, Georgia, serif';
  ctx.fillStyle = '#ffe9a0';
  ctx.fillText('Darling Blades', W / 2, 130);
  ctx.font = '600 17px Inter, Arial, sans-serif';
  ctx.fillStyle = '#c9bde0';
  ctx.fillText('BOOSTER PACK', W / 2, 158);
  ctx.font = '600 14px Inter, Arial, sans-serif';
  ctx.fillStyle = '#8f83a8';
  ctx.fillText('15 cards — 5 tiers · 6 frames · 6 finishes', W / 2, H - 44);
  tex.refresh();
}

export class ShopScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super('Shop');
  }

  create(): void {
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback.
    applyBackdrop(this, 'shop', {
      dim: 0x0b0812,
      dimAlpha: 0.45,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        bg.fillRect(0, 0, width, height);
      },
    });
    bakePackArt(this);
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');

    this.add
      .text(width / 2, 70, 'Booster Shop', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    this.goldText = this.add
      .text(width - 30, 30, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);
    this.refreshGold();

    const pack = this.add
      .image(width / 2, 360, 'packart')
      .setDisplaySize(238, 340)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: pack,
      y: 350,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Routed through the FX choke point (was a raw renderer-type check that
    // bypassed the quality tier — mobile-lan-plan §1.6, perf audit §2).
    if (fxPolicy(this).shine && pack.preFX) {
      pack.preFX.addShine(0.5, 0.3, 4);
    }

    const price = this.add
      .text(width / 2, 570, `Buy — 🪙 ${ECONOMY.packPrice}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '26px',
        color: '#ffd88a',
        backgroundColor: '#2c2344',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const buy = (): void => this.buyPack();
    bindTapButton(this, price, buy);
    bindTapButton(this, pack, buy);
    // The buy button's inflated rect grazes the pack image above it — both
    // targets run the same buyPack, so the overlap cannot misroute.
    inflateHitArea(price, 90, 90);

    const back = this.add
      .text(28, 28, '← Menu', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#c9bde0',
      })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);
  }

  private refreshGold(): void {
    this.goldText.setText(`🪙 ${Services.save.data.gold}`);
  }

  private buyPack(): void {
    const save = Services.save.data;
    if (!spendGold(save, ECONOMY.packPrice)) {
      this.cameras.main.shake(120, 0.004);
      this.goldText.setColor('#f08a8a');
      this.time.delayedCall(400, () => this.goldText.setColor('#ffd88a'));
      return;
    }
    Sfx.play('coin');
    const rng = createRngState(Date.now() & 0x7fffffff);
    const result = openPack(save, CARD_DB, rng);
    Services.save.flush();
    this.scene.start('PackOpening', result);
  }
}
