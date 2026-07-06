import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { DROPS, ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { THEME_DECKS } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { buyThemeDeck, spendGold } from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
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
function bakeRealPackBase(
  scene: Phaser.Scene,
  ctx: CanvasRenderingContext2D,
  sceneArtKey: string,
): void {
  const img = scene.textures.get(sceneArtKey).getSourceImage() as CanvasImageSource;
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

export interface PackArtOpts {
  key?: string; // texture key (default 'packart')
  wordmark?: string; // hero line (default 'Darling Blades')
  subtitle?: string; // sub line (default 'BOOSTER PACK')
  sceneArtKey?: string; // real-art source key (default 'scene-pack-art')
  footer?: string; // bottom crimp line
}

/**
 * Bake a booster-pack texture once (shared with PackOpeningScene). Real front
 * art when the `sceneArtKey` PNG is on disk, else the procedural pack. The
 * crimp bands + code-stamped wordmark are re-stamped over BOTH (the real art is
 * text-free), so the pack always reads as a sealed product. Parameterized so a
 * second SKU (the Ragnarök expansion booster) bakes its own texture.
 */
export function bakePackArt(scene: Phaser.Scene, opts: PackArtOpts = {}): void {
  const key = opts.key ?? 'packart';
  const wordmark = opts.wordmark ?? 'Darling Blades';
  const subtitle = opts.subtitle ?? 'BOOSTER PACK';
  const sceneArtKey = opts.sceneArtKey ?? 'scene-pack-art';
  const footer = opts.footer ?? '15 cards — 5 tiers · 6 frames · 6 finishes';
  if (scene.textures.exists(key)) return;
  const W = PACK_W;
  const H = PACK_H;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();

  if (scene.textures.exists(sceneArtKey)) {
    bakeRealPackBase(scene, ctx, sceneArtKey);
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
  ctx.fillText(wordmark, W / 2, 130);
  ctx.font = '600 17px Inter, Arial, sans-serif';
  ctx.fillStyle = '#c9bde0';
  ctx.fillText(subtitle, W / 2, 158);
  ctx.font = '600 14px Inter, Arial, sans-serif';
  ctx.fillStyle = '#8f83a8';
  ctx.fillText(footer, W / 2, H - 44);
  tex.refresh();
}

export class ShopScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  /** F10 bulk-buy: quantity + the SKU buy buttons / quantity chips it drives. */
  private qty = 1;
  private skuButtons: { btn: Phaser.GameObjects.Text; price: number }[] = [];
  private qtyChips = new Map<number, Phaser.GameObjects.Text>();

  constructor() {
    super('Shop');
  }

  create(): void {
    this.qty = 1;
    this.skuButtons = [];
    this.qtyChips = new Map();
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
    bakePackArt(this); // base pack ('packart')
    bakePackArt(this, {
      key: 'packart-ragnarok',
      wordmark: 'Ragnarök',
      subtitle: 'EXPANSION BOOSTER',
      sceneArtKey: 'scene-pack-art-ragnarok',
      footer: '15 cards — Ragnarök set only',
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');

    this.add
      .text(width / 2, 56, 'Booster Shop', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '38px',
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

    // Two booster SKUs side by side: the base set and the Ragnarök expansion.
    this.buildPackSku(width / 2 - 210, 'Base Set', 'packart', ECONOMY.packPrice, () =>
      this.buyPacks(ECONOMY.packPrice, undefined, 'base'),
    );
    this.buildPackSku(
      width / 2 + 210,
      'Ragnarök Expansion',
      'packart-ragnarok',
      ECONOMY.ragnarokPackPrice,
      () => this.buyPacks(ECONOMY.ragnarokPackPrice, 'ragnarok', 'ragnarok'),
    );
    this.buildQtySelector();
    this.refreshQtyLabels();

    this.buildThemeRow();
    this.buildOddsPanel();

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

  /** Shake + flash the gold readout red — a can't-afford / already-owned cue. */
  private insufficientFunds(): void {
    this.cameras.main.shake(120, 0.004);
    this.goldText.setColor('#f08a8a');
    this.time.delayedCall(400, () => this.goldText.setColor('#ffd88a'));
  }

  /** One booster column: label + floating pack + buy button, all wired to onBuy. */
  private buildPackSku(
    x: number,
    label: string,
    textureKey: string,
    price: number,
    onBuy: () => void,
  ): void {
    this.add
      .text(x, 150, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#e8def7',
      })
      .setOrigin(0.5);
    const pack = this.add
      .image(x, 350, textureKey)
      .setDisplaySize(200, 286)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: pack,
      y: 342,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Routed through the FX choke point (quality-tier aware).
    if (fxPolicy(this).shine && pack.preFX) pack.preFX.addShine(0.5, 0.3, 4);
    const buyBtn = this.add
      .text(x, 540, `Buy — 🪙 ${price}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#ffd88a',
        backgroundColor: '#2c2344',
        padding: { x: 16, y: 9 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, buyBtn, onBuy);
    bindTapButton(this, pack, onBuy);
    inflateHitArea(buyBtn, 90, 60);
    this.skuButtons.push({ btn: buyBtn, price });
  }

  /**
   * Read-only booster drop-rate disclosure (a baseline expectation, and a legal
   * norm in several markets). Rendered straight from the DROPS config const so
   * the shown odds can never drift from the real roll; both SKUs share the same
   * tier/frame/holo tables (the packs differ only in card pool). Sits in the free
   * left column. The pity line surfaces the sr/ssr/ur dupe-protection that already
   * runs in openPack — otherwise invisible to the player.
   */
  private buildOddsPanel(): void {
    const fmt = (axis: ReadonlyArray<readonly [string, number]>, name: (v: string) => string): string =>
      axis.map(([v, w]) => `${name(v)} ${w}`).join('  ·  ');
    const TIER: Record<string, string> = { c: 'C', r: 'R', sr: 'SR', ssr: 'SSR', ur: 'UR' };
    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    const body = [
      'DROP RATES · per card (15 / pack)',
      '',
      `Rarity:  ${fmt(DROPS.tier, (v) => TIER[v] ?? v)}`,
      `Frame:  ${fmt(DROPS.frame, cap)}`,
      `Holo:  ${fmt(DROPS.holo, cap)}`,
      '',
      "Missing SR/SSR/UR cards are prioritized — no wasted dupes until a playset is complete.",
    ].join('\n');
    this.add
      .text(30, 132, body, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: '#8f83a8',
        lineSpacing: 5,
        wordWrap: { width: 290 },
      })
      .setOrigin(0, 0);
  }

  /** The buyable theme/precon deck row. Rebuilds the scene on purchase. */
  private buildThemeRow(): void {
    const deck = THEME_DECKS[0];
    const owned = Services.save.data.decks.some((d) => d.id === deck.id);
    const y = 648;
    this.add
      .text(360, y, `Theme Deck — ${deck.name}  ·  B/G Reanimator`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5);
    const btn = this.add
      .text(820, y, owned ? 'Owned ✓' : `Buy Deck — 🪙 ${ECONOMY.preconPrice}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: owned ? '#8ad0a0' : '#ffd88a',
        backgroundColor: owned ? '#1b2a1b' : '#2c2344',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0, 0.5);
    if (!owned) {
      btn.setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, () => this.onBuyThemeDeck());
      inflateHitArea(btn, 90, 60);
    }
  }

  /** Buy + open the selected quantity of one SKU (clamped to what you can afford). */
  private buyPacks(unitPrice: number, set: 'ragnarok' | undefined, sku: 'base' | 'ragnarok'): void {
    const save = Services.save.data;
    const n = Math.min(this.qty, Math.floor(save.gold / unitPrice));
    if (n < 1) {
      this.insufficientFunds();
      return;
    }
    spendGold(save, unitPrice * n);
    Sfx.play('coin');
    const rng = createRngState(Date.now() & 0x7fffffff);
    if (n === 1) {
      const result = openPack(save, CARD_DB, rng, set);
      Services.save.flush();
      this.scene.start('PackOpening', sku === 'ragnarok' ? { ...result, sku } : result);
    } else {
      const packs = openPacks(save, CARD_DB, rng, n, set);
      Services.save.flush();
      this.scene.start('PackOpening', { batch: packs, sku });
    }
  }

  /** F10 bulk-buy quantity selector (×1 / ×5 / ×10) driving both SKU buttons. */
  private buildQtySelector(): void {
    this.add
      .text(640, 100, 'Buy quantity', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', color: '#8f83a8' })
      .setOrigin(0.5);
    let x = 560;
    for (const n of [1, 5, 10]) {
      const chip = this.add
        .text(x, 126, `×${n}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '16px',
          fontStyle: '600',
          color: '#c9bde0',
          backgroundColor: '#241d3a',
          padding: { x: 12, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, chip, () => {
        this.qty = n;
        this.refreshQtyLabels();
        this.refreshQtyChips();
      });
      inflateHitArea(chip, 70, 44);
      this.qtyChips.set(n, chip);
      x += 80;
    }
    this.refreshQtyChips();
  }

  private refreshQtyChips(): void {
    for (const [n, chip] of this.qtyChips) {
      chip.setStyle(
        n === this.qty
          ? { color: '#1a1426', backgroundColor: '#ffd88a' }
          : { color: '#c9bde0', backgroundColor: '#241d3a' },
      );
      inflateHitArea(chip, 70, 44);
    }
  }

  private refreshQtyLabels(): void {
    for (const { btn, price } of this.skuButtons) {
      btn.setText(this.qty > 1 ? `Buy ×${this.qty} — 🪙 ${price * this.qty}` : `Buy — 🪙 ${price}`);
      inflateHitArea(btn, 90, 60);
    }
  }

  private onBuyThemeDeck(): void {
    const save = Services.save.data;
    if (!buyThemeDeck(save, CARD_DB, THEME_DECKS[0])) {
      this.insufficientFunds();
      return;
    }
    Sfx.play('coin');
    Services.save.flush();
    this.scene.restart(); // rebuild → the theme row now reads "Owned ✓"
  }
}
