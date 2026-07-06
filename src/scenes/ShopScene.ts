import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { PREMIUM_HEROES } from '../data/heroes';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue } from '../engine/types';
import { buyThemeDeck, spendGold } from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { fxPolicy } from '../ui/fx/FXSupport';
import { OddsDrawer } from '../ui/OddsDrawer';
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

type ShopTab = 'boosters' | 'decks';

/** Two-colour identity blurb per buyable deck (id-keyed). */
const DECK_BLURB: Record<string, string> = {
  'starter-crimson': 'R/W · Warband aggro',
  'starter-wild': 'G/W · Beastkin tribal',
  'starter-tides': 'U/R · Wu tempo-burn',
  'starter-mandate': 'U/B · Jin control',
  'starter-harvest': 'B/G · Underworld attrition',
  'theme-ragnarok': 'B/G · Ragnarök reanimator',
};

/** A buyable deck SKU: the list, its price, and whether it's a theme/precon. */
interface DeckSku {
  deck: DeckList;
  price: number;
  theme: boolean;
}

export class ShopScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private tab: ShopTab = 'boosters';
  private boostersGroup!: Phaser.GameObjects.Container;
  private decksGroup!: Phaser.GameObjects.Container;
  private tabButtons = new Map<ShopTab, Phaser.GameObjects.Text>();
  private overlay: Phaser.GameObjects.Container | null = null;
  /** F10 bulk-buy: quantity + the SKU buy buttons / quantity chips it drives. */
  private qty = 1;
  private skuButtons: { btn: Phaser.GameObjects.Text; price: number }[] = [];
  private qtyChips = new Map<number, Phaser.GameObjects.Text>();

  constructor() {
    super('Shop');
  }

  /** All buyable decks: the theme/precon(s) first, then the starter precons. */
  private deckSkus(): DeckSku[] {
    return [
      ...THEME_DECKS.map((deck) => ({ deck, price: ECONOMY.preconPrice, theme: true })),
      ...STARTER_DECKS.map((deck) => ({ deck, price: ECONOMY.starterDeckPrice, theme: false })),
    ];
  }

  create(): void {
    this.tab = 'boosters';
    this.qty = 1;
    this.skuButtons = [];
    this.qtyChips = new Map();
    this.tabButtons = new Map();
    this.overlay = null;
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
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
      .text(width / 2, 44, 'Shop', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '36px',
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

    // Drop-rate disclosure: a left slide-out drawer (percentages, from DROPS).
    new OddsDrawer(this);

    this.buildTabBar();
    this.boostersGroup = this.add.container(0, 0);
    this.decksGroup = this.add.container(0, 0);
    this.buildBoostersGroup(this.boostersGroup);
    this.buildDecksGroup(this.decksGroup);
    this.setTab('boosters');

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

  // --- Tabs -----------------------------------------------------------------

  private buildTabBar(): void {
    const defs: { key: ShopTab; label: string }[] = [
      { key: 'boosters', label: 'Boosters' },
      { key: 'decks', label: 'Decks' },
    ];
    defs.forEach((d, i) => {
      const t = this.add
        .text(640 - 100 + i * 200, 96, d.label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '20px',
          color: '#c9bde0',
          backgroundColor: '#241d3a',
          padding: { x: 22, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, t, () => this.setTab(d.key));
      inflateHitArea(t, 120, 48);
      this.tabButtons.set(d.key, t);
    });
  }

  private setTab(tab: ShopTab): void {
    this.tab = tab;
    this.boostersGroup.setVisible(tab === 'boosters');
    this.decksGroup.setVisible(tab === 'decks');
    for (const [key, btn] of this.tabButtons) {
      const active = key === tab;
      btn.setStyle(
        active
          ? { color: '#1a1426', backgroundColor: '#ffd88a' }
          : { color: '#c9bde0', backgroundColor: '#241d3a' },
      );
      inflateHitArea(btn, 120, 48);
    }
  }

  // --- Boosters tab ---------------------------------------------------------

  private buildBoostersGroup(group: Phaser.GameObjects.Container): void {
    this.buildPackSku(group, 640 - 210, 'Base Set', 'packart', ECONOMY.packPrice, () =>
      this.buyPacks(ECONOMY.packPrice, undefined, 'base'),
    );
    this.buildPackSku(
      group,
      640 + 210,
      'Ragnarök Expansion',
      'packart-ragnarok',
      ECONOMY.ragnarokPackPrice,
      () => this.buyPacks(ECONOMY.ragnarokPackPrice, 'ragnarok', 'ragnarok'),
    );
    this.buildQtySelector(group);
    this.refreshQtyLabels();
  }

  /** One booster column: label + floating pack + buy button, added to `group`. */
  private buildPackSku(
    group: Phaser.GameObjects.Container,
    x: number,
    label: string,
    textureKey: string,
    price: number,
    onBuy: () => void,
  ): void {
    const title = this.add
      .text(x, 178, label, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '22px', color: '#e8def7' })
      .setOrigin(0.5);
    const pack = this.add
      .image(x, 368, textureKey)
      .setDisplaySize(200, 286)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: pack,
      y: 360,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    if (fxPolicy(this).shine && pack.preFX) pack.preFX.addShine(0.5, 0.3, 4);
    const buyBtn = this.add
      .text(x, 552, `Buy — 🪙 ${price}`, {
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
    group.add([title, pack, buyBtn]);
  }

  /** F10 bulk-buy quantity selector (×1 / ×5 / ×10), added to `group`. */
  private buildQtySelector(group: Phaser.GameObjects.Container): void {
    const lbl = this.add
      .text(640, 616, 'Buy quantity', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', color: '#8f83a8' })
      .setOrigin(0.5);
    group.add(lbl);
    let x = 560;
    for (const n of [1, 5, 10]) {
      const chip = this.add
        .text(x, 642, `×${n}`, {
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
      group.add(chip);
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

  /** Buy + open the selected quantity of one SKU (clamped to what you can afford). */
  private buyPacks(unitPrice: number, set: 'ragnarok' | undefined, sku: 'base' | 'ragnarok'): void {
    const save = Services.save.data;
    const n = Math.min(this.qty, Math.floor(save.gold / unitPrice));
    if (n < 1) {
      this.insufficientFunds();
      return;
    }
    this.closeOverlay(); // close any open deck preview before leaving the scene
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

  // --- Decks tab ------------------------------------------------------------

  private buildDecksGroup(group: Phaser.GameObjects.Container): void {
    group.removeAll(true); // rebuildable after a purchase
    const intro = this.add
      .text(640, 152, 'Preconstructed decks — inspect the list, then buy the ones you didn’t start with.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);
    group.add(intro);

    const skus = this.deckSkus();
    let y = 210;
    for (const sku of skus) {
      this.buildDeckRow(group, sku, y);
      y += 74;
    }
  }

  private buildDeckRow(group: Phaser.GameObjects.Container, sku: DeckSku, y: number): void {
    const { deck, price, theme } = sku;
    const owned = Services.save.data.decks.some((d) => d.id === deck.id);

    const plate = this.add
      .rectangle(640, y, 900, 62, theme ? 0x241c3e : 0x1c1830, 0.7)
      .setStrokeStyle(1, theme ? 0x6d5a2f : 0x352b52, 0.9);
    const name = this.add
      .text(220, y - 10, deck.name, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: theme ? '#ffd88a' : '#e8def7',
      })
      .setOrigin(0, 0.5);
    const hero = PREMIUM_HEROES.find((h) => h.unlockDeckId === deck.id);
    const blurbText =
      (DECK_BLURB[deck.id] ?? '') +
      (owned ? '  ·  Owned' : '') +
      (hero ? '  ·  ✦ exclusive hero' : '');
    const blurb = this.add
      .text(220, y + 13, blurbText, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0, 0.5);
    group.add([plate, name, blurb]);

    const preview = this.add
      .text(720, y, 'Preview', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: '#c9bde0',
        backgroundColor: '#2c2344',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, preview, () => this.showDeckPreview(deck, price, owned));
    inflateHitArea(preview, 90, 52);
    group.add(preview);

    if (!owned) {
      const buy = this.add
        .text(920, y, `Buy — 🪙 ${price}`, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '17px',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, buy, () => this.onBuyDeck(sku));
      inflateHitArea(buy, 90, 52);
      group.add(buy);
    } else if (hero) {
      // Owned + unlocks a premium hero → a "set as your commander" toggle (the
      // ONLY way to equip this exclusive portrait).
      group.add(this.buildHeroToggle(920, y, hero.id));
    } else {
      group.add(
        this.add
          .text(920, y, 'Owned ✓', {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: '17px',
            color: '#8ad0a0',
            backgroundColor: '#1b2a1b',
            padding: { x: 14, y: 7 },
          })
          .setOrigin(0.5),
      );
    }
  }

  /** Set/clear this premium hero as the in-duel commander portrait. */
  private buildHeroToggle(x: number, y: number, heroId: string): Phaser.GameObjects.Text {
    const isHero = (): boolean => Services.save.data.heroPortraitId === heroId;
    const label = (): string => (isHero() ? '★ Your Hero' : '☆ Set as Hero');
    const btn = this.add
      .text(x, y, label(), {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '16px',
        color: isHero() ? '#1a1426' : '#ffd88a',
        backgroundColor: isHero() ? '#ffd88a' : '#2c2344',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, () => {
      const save = Services.save.data;
      save.heroPortraitId = isHero() ? null : heroId;
      Services.save.flush();
      Sfx.play('click');
      btn.setText(label()).setStyle(
        isHero()
          ? { color: '#1a1426', backgroundColor: '#ffd88a' }
          : { color: '#ffd88a', backgroundColor: '#2c2344' },
      );
      inflateHitArea(btn, 90, 52);
    });
    inflateHitArea(btn, 90, 52);
    return btn;
  }

  private onBuyDeck(sku: DeckSku): void {
    const save = Services.save.data;
    if (!buyThemeDeck(save, CARD_DB, sku.deck, sku.price)) {
      this.insufficientFunds();
      return;
    }
    Sfx.play('coin');
    Services.save.flush();
    this.refreshGold();
    this.buildDecksGroup(this.decksGroup); // the bought row now reads "Owned ✓"
  }

  // --- Deck preview overlay -------------------------------------------------

  /** Inspect a deck's full list before buying (grouped by category, with counts). */
  private showDeckPreview(deck: DeckList, price: number, owned: boolean): void {
    this.closeOverlay();
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setInteractive();
    bindTapButton(this, dim, () => this.closeOverlay());
    const panel = this.add
      .rectangle(width / 2, height / 2, 760, 560, 0x161226, 0.98)
      .setStrokeStyle(2, 0x4a3f6e, 1);
    c.add([dim, panel]);

    c.add(
      this.add
        .text(width / 2, 130, deck.name, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '28px',
          color: '#ffd88a',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 162, `${DECK_BLURB[deck.id] ?? ''}  ·  ${deck.cards.length} cards`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );

    // Aggregate + group by category, sorted by mana value then name.
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts.entries()].map(([id, n]) => ({ d: def(CARD_DB, id), n }));
    const sortFn = (a: { d: (typeof entries)[0]['d'] }, b: { d: (typeof entries)[0]['d'] }): number =>
      manaValue(a.d.cost) - manaValue(b.d.cost) || a.d.name.localeCompare(b.d.name);
    const creatures = entries.filter((e) => isType(e.d, 'creature')).sort(sortFn);
    const spells = entries
      .filter((e) => !isType(e.d, 'creature') && !isType(e.d, 'land'))
      .sort(sortFn);
    const lands = entries.filter((e) => isType(e.d, 'land')).sort(sortFn);

    const colText = (
      x: number,
      sections: { title: string; items: typeof entries }[],
    ): void => {
      const lines: string[] = [];
      for (const s of sections) {
        if (s.items.length === 0) continue;
        const total = s.items.reduce((sum, e) => sum + e.n, 0);
        lines.push(`${s.title.toUpperCase()} · ${total}`);
        for (const e of s.items) lines.push(`  ${e.n}×  ${e.d.name.split(',')[0]}`);
        lines.push('');
      }
      c.add(
        this.add
          .text(x, 196, lines.join('\n'), {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#cbc2e0',
            lineSpacing: 4,
          })
          .setOrigin(0, 0),
      );
    };
    colText(width / 2 - 350, [{ title: 'Creatures', items: creatures }]);
    colText(width / 2 - 20, [
      { title: 'Spells', items: spells },
      { title: 'Lands', items: lands },
    ]);

    // Buy-from-preview (unless owned) + Close.
    if (!owned) {
      const buy = this.add
        .text(width / 2 - 90, 620, `Buy — 🪙 ${price}`, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '18px',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 16, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, buy, () => {
        this.closeOverlay();
        const skus = this.deckSkus();
        const sku = skus.find((s) => s.deck.id === deck.id);
        if (sku) this.onBuyDeck(sku);
      });
      inflateHitArea(buy, 90, 52);
      c.add(buy);
    }
    const close = this.add
      .text(width / 2 + (owned ? 0 : 90), 620, 'Close', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#c9bde0',
        backgroundColor: '#241d3a',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, close, () => this.closeOverlay());
    inflateHitArea(close, 90, 52);
    c.add(close);

    this.overlay = c;
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }
}
