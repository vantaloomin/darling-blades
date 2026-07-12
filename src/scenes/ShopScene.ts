import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue } from '../engine/types';
import { buyThemeDeck, claimFreeStarter, spendGold } from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { Services } from '../meta/services';
import { bindTapButton } from '../platform/gestures';
import { fxPolicy } from '../ui/fx/FXSupport';
import { OddsDrawer } from '../ui/OddsDrawer';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, panel, themedButton, type GoldBadge, type ModalShell, type ThemedButton } from '../ui/themeWidgets';

const PACK_W = 280;
const PACK_H = 400;

export type BoosterSku = 'base' | 'ragnarok' | 'celtic-fae';

interface PackTint {
  start: string;
  middle: string;
  end: string;
  trim: string;
  foil: string;
  mist?: string;
}

const BASE_PACK_TINT: PackTint = {
  start: theme.colors.btnEmphasisBg,
  middle: theme.colors.panelFill,
  end: theme.colors.dangerBg,
  trim: theme.colors.gold,
  foil: theme.colors.gold,
};

const CELTIC_FAE_PACK_TINT: PackTint = {
  start: theme.colors.success,
  middle: theme.colors.muted,
  end: theme.colors.panelFill,
  trim: theme.colors.heading,
  foil: theme.colors.heading,
  mist: theme.colors.success,
};

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
function bakeProceduralPackBase(ctx: CanvasRenderingContext2D, tint: PackTint): void {
  const g = ctx.createLinearGradient(0, 0, PACK_W, PACK_H);
  g.addColorStop(0, tint.start);
  g.addColorStop(0.5, tint.middle);
  g.addColorStop(1, tint.end);
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = tint.trim;
  ctx.stroke();
  // foil band
  const band = ctx.createLinearGradient(0, 0, PACK_W, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, tint.foil);
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = band;
  ctx.fillRect(30, 60, PACK_W - 60, 26);
  ctx.restore();
  if (tint.mist) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = tint.mist;
    ctx.lineWidth = 18;
    for (const y of [150, 205, 320]) {
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.bezierCurveTo(80, y - 32, 182, y + 32, PACK_W - 26, y - 8);
      ctx.stroke();
    }
    ctx.restore();
  }
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
    ctx.globalAlpha = a;
    ctx.strokeStyle = tint.foil;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Real pack-art (docs/scene-art.md `pack-art`): cover-crop the 640×800 source
 * into the 280×400 canvas inside the rounded clip (r 14). The art is text-free
 * (NO-TEXT rule); only the crimp bands are code-stamped over it afterward.
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
  ctx.strokeStyle = theme.colors.gold;
  ctx.stroke();
}

export interface PackArtOpts {
  key?: string; // texture key (default 'packart')
  sceneArtKey?: string; // real-art source key (default 'scene-pack-art')
  tint?: PackTint; // procedural fallback treatment; real art remains untouched
}

export const CELTIC_FAE_PACK_ART: PackArtOpts = {
  key: 'packart-celtic-fae',
  sceneArtKey: 'scene-pack-art-celtic-fae',
  tint: CELTIC_FAE_PACK_TINT,
};

export function packTextureForSku(sku: BoosterSku): string {
  if (sku === 'ragnarok') return 'packart-ragnarok';
  if (sku === 'celtic-fae') return 'packart-celtic-fae';
  return 'packart';
}

/**
 * Bake a booster-pack texture once (shared with PackOpeningScene). Real front
 * art when the `sceneArtKey` PNG is on disk, else the procedural pack. The
 * crimp bands are re-stamped over BOTH so the pack reads as sealed product,
 * but the face stays text-free. Parameterized so expansion SKUs can bake their
 * own texture treatment.
 */
export function bakePackArt(scene: Phaser.Scene, opts: PackArtOpts = {}): void {
  const key = opts.key ?? 'packart';
  const sceneArtKey = opts.sceneArtKey ?? 'scene-pack-art';
  if (scene.textures.exists(key)) return;
  const W = PACK_W;
  const H = PACK_H;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();

  if (scene.textures.exists(sceneArtKey)) {
    bakeRealPackBase(scene, ctx, sceneArtKey);
  } else {
    bakeProceduralPackBase(ctx, opts.tint ?? BASE_PACK_TINT);
  }

  // Crimp bands, always code-stamped over the base so real and procedural pack
  // art share the same sealed-wrapper silhouette without adding text.
  // Translucent so the art fills the whole face and still reads as sealed foil
  // (user-directed 2026-07-11: full-bleed pack art on all SKUs).
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = theme.colors.btnGhostBg;
  ctx.fillRect(2, 2, W - 4, 26);
  ctx.fillRect(2, H - 28, W - 4, 26);
  ctx.restore();
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
  'theme-celtic-fae': 'U/B/G · Celtic Fae tempo-control',
};

/** A buyable deck SKU: the list, its price, and whether it's a theme/precon. */
interface DeckSku {
  deck: DeckList;
  price: number;
  theme: boolean;
}

export class ShopScene extends Phaser.Scene {
  private goldBadge!: GoldBadge;
  private tab: ShopTab = 'boosters';
  private boostersGroup!: Phaser.GameObjects.Container;
  private decksGroup!: Phaser.GameObjects.Container;
  private tabButtons = new Map<ShopTab, ThemedButton>();
  private overlay: ModalShell | null = null;
  /** F10 bulk-buy: quantity + the SKU buy buttons / quantity chips it drives. */
  private qty = 1;
  private skuButtons: { btn: ThemedButton; price: number }[] = [];
  private qtyChips = new Map<number, ThemedButton>();

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

  create(data: { tab?: ShopTab } = {}): void {
    // Onboarding routes here with { tab: 'decks' } so a new player lands on their
    // free-starter claim; everything else defaults to the boosters tab.
    this.tab = data.tab ?? 'boosters';
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
      dim: theme.graphics.dim,
      dimAlpha: 0.45,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(theme.graphics.panelFill, theme.graphics.panelFill, theme.graphics.dim, theme.graphics.dim, 1);
        bg.fillRect(0, 0, width, height);
      },
    });
    bakePackArt(this); // base pack ('packart')
    bakePackArt(this, {
      key: 'packart-ragnarok',
      sceneArtKey: 'scene-pack-art-ragnarok',
    });
    bakePackArt(this, CELTIC_FAE_PACK_ART);
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');

    this.add
      .text(width / 2, 44, 'Shop', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    this.goldBadge = goldBadge(this, width - 30, 30, { flashOnChange: true });
    this.refreshGold();

    // Drop-rate disclosure: a left slide-out drawer (percentages, from DROPS).
    new OddsDrawer(this);

    this.buildTabBar();
    this.boostersGroup = this.add.container(0, 0);
    this.decksGroup = this.add.container(0, 0);
    this.buildBoostersGroup(this.boostersGroup);
    this.buildDecksGroup(this.decksGroup);
    this.setTab(this.tab); // honors the initial tab (onboarding routes to 'decks')

    backButton(this, () => this.scene.start('MainMenu'));
  }

  private refreshGold(): void {
    this.goldBadge.refresh(Services.save.data.gold);
  }

  /** Shake + flash the gold readout red — a can't-afford / already-owned cue. */
  private insufficientFunds(): void {
    this.cameras.main.shake(120, 0.004);
    this.goldBadge.text.setColor(theme.colors.danger);
    this.time.delayedCall(400, () => this.goldBadge.text.setColor(theme.colors.gold));
  }

  // --- Tabs -----------------------------------------------------------------

  private buildTabBar(): void {
    const defs: { key: ShopTab; label: string }[] = [
      { key: 'boosters', label: 'Boosters' },
      { key: 'decks', label: 'Decks' },
    ];
    defs.forEach((d, i) => {
      const button = themedButton(this, 640 - 100 + i * 200, 96, d.label, {
        variant: 'ghost',
        minWidth: 120,
        onTap: () => this.setTab(d.key),
      });
      this.tabButtons.set(d.key, button);
    });
  }

  private setTab(tab: ShopTab): void {
    this.tab = tab;
    this.boostersGroup.setVisible(tab === 'boosters');
    this.decksGroup.setVisible(tab === 'decks');
    for (const [key, btn] of this.tabButtons) {
      btn.setVariant(key === tab ? 'primary' : 'ghost');
    }
  }

  // --- Boosters tab ---------------------------------------------------------

  private buildBoostersGroup(group: Phaser.GameObjects.Container): void {
    this.buildPackSku(group, 340, 'Base Set', 'packart', ECONOMY.packPrice, () =>
      this.buyPacks(ECONOMY.packPrice, undefined, 'base'),
    );
    this.buildPackSku(
      group,
      640,
      'Ragnarök',
      'packart-ragnarok',
      ECONOMY.ragnarokPackPrice,
      () => this.buyPacks(ECONOMY.ragnarokPackPrice, 'ragnarok', 'ragnarok'),
    );
    this.buildPackSku(
      group,
      940,
      'Celtic Fae',
      'packart-celtic-fae',
      ECONOMY.celticFaePackPrice,
      () => this.buyPacks(ECONOMY.celticFaePackPrice, 'celtic-fae', 'celtic-fae'),
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
      .text(x, 178, label, { fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
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
    const buyBtn = themedButton(this, x, 552, `Buy — 🪙 ${price}`, {
      variant: 'primary',
      minWidth: 180,
      onTap: onBuy,
    });
    bindTapButton(this, pack, onBuy);
    this.skuButtons.push({ btn: buyBtn, price });
    group.add([title, pack, buyBtn.container]);
  }

  /** F10 bulk-buy quantity selector (×1 / ×5 / ×10), added to `group`. */
  private buildQtySelector(group: Phaser.GameObjects.Container): void {
    const lbl = this.add
      .text(640, 616, 'Buy quantity', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted })
      .setOrigin(0.5);
    group.add(lbl);
    let x = 560;
    for (const n of [1, 5, 10]) {
      const chip = themedButton(this, x, 642, `×${n}`, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 70,
        onTap: () => {
          this.qty = n;
          this.refreshQtyLabels();
          this.refreshQtyChips();
        },
      });
      this.qtyChips.set(n, chip);
      group.add(chip.container);
      x += 80;
    }
    this.refreshQtyChips();
  }

  private refreshQtyChips(): void {
    for (const [n, chip] of this.qtyChips) {
      chip.setVariant(n === this.qty ? 'primary' : 'ghost');
    }
  }

  private refreshQtyLabels(): void {
    for (const { btn, price } of this.skuButtons) {
      btn.setLabel(this.qty > 1 ? `Buy ×${this.qty} — 🪙 ${price * this.qty}` : `Buy — 🪙 ${price}`);
    }
  }

  /** Buy + open the selected quantity of one SKU (clamped to what you can afford). */
  private buyPacks(unitPrice: number, set: Exclude<BoosterSku, 'base'> | undefined, sku: BoosterSku): void {
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
      this.scene.start('PackOpening', sku === 'base' ? result : { ...result, sku });
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
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
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

  /** A starter is a one-time FREE claim while the player hasn't taken their free deck yet. */
  private isFreeClaim(deck: DeckList): boolean {
    const save = Services.save.data;
    return (
      save.starterChosen === null &&
      STARTER_DECKS.some((s) => s.id === deck.id) &&
      !save.decks.some((d) => d.id === deck.id)
    );
  }

  private buildDeckRow(group: Phaser.GameObjects.Container, sku: DeckSku, y: number): void {
    const { deck, price, theme: isTheme } = sku;
    const owned = Services.save.data.decks.some((d) => d.id === deck.id);
    const freeClaim = this.isFreeClaim(deck);

    const plate = panel(this, 190, y - 31, 900, 62, { alpha: 0.7 });
    const name = this.add
      .text(220, y - 10, deck.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: isTheme ? theme.colors.gold : theme.colors.heading,
      })
      .setOrigin(0, 0.5);
    const blurbText =
      (DECK_BLURB[deck.id] ?? '') +
      (owned ? '  ·  Owned' : freeClaim ? '  ·  ✦ your free starter' : '');
    const blurb = this.add
      .text(220, y + 13, blurbText, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    group.add([plate, name, blurb]);

    const preview = themedButton(this, 720, y, 'Preview', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.showDeckPreview(deck, price, owned),
    });
    group.add(preview.container);

    if (!owned) {
      const buy = themedButton(this, 920, y, freeClaim ? 'Claim Free ✦' : `Buy — 🪙 ${price}`, {
        variant: 'primary',
        size: 'sm',
        minWidth: 130,
        onTap: () => this.onBuyDeck(sku),
      });
      group.add(buy.container);
    } else {
      // The old premium-hero "Set as Hero" toggle is gone (user-directed
      // 2026-07-11): per-deck hero cards (SavedDeck.heroCardId, the DeckBuilder
      // star) superseded the account-level premium portrait. Saves that already
      // set heroPortraitId keep working via DuelScene's fallback chain.
      group.add(
        this.add
          .text(920, y, 'Owned ✓', {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.success,
          })
          .setOrigin(0.5),
      );
    }
  }

  private onBuyDeck(sku: DeckSku): void {
    const save = Services.save.data;
    if (this.isFreeClaim(sku.deck)) {
      claimFreeStarter(save, CARD_DB, sku.deck); // free — sets starterChosen + activeDeckId
    } else if (!buyThemeDeck(save, CARD_DB, sku.deck, sku.price)) {
      this.insufficientFunds();
      return;
    }
    Sfx.play('coin');
    Services.save.flush();
    this.refreshGold();
    this.buildDecksGroup(this.decksGroup); // the claimed/bought row now reads "Owned ✓"
  }

  // --- Deck preview overlay -------------------------------------------------

  /** Inspect a deck's full list before buying (grouped by category, with counts). */
  private showDeckPreview(deck: DeckList, price: number, owned: boolean): void {
    this.closeOverlay();
    const width = 1280;
    const shell = modalShell(this, {
      width: 760,
      height: 560,
      dimAlpha: 0.52,
      depth: theme.depth.modal,
      showClose: false,
      tapDimToClose: true,
      escToClose: false,
    });
    shell.container.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.overlay === shell) this.overlay = null;
    });
    const c = shell.container;

    c.add(
      this.add
        .text(width / 2, 130, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 162, `${DECK_BLURB[deck.id] ?? ''}  ·  ${deck.cards.length} cards`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
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
    const freeClaim = this.isFreeClaim(deck);
    if (!owned) {
      const buy = themedButton(this, width / 2 - 90, 620, freeClaim ? 'Claim Free ✦' : `Buy — 🪙 ${price}`, {
        variant: 'primary',
        minWidth: 150,
        onTap: () => {
        this.closeOverlay();
        const skus = this.deckSkus();
        const sku = skus.find((s) => s.deck.id === deck.id);
        if (sku) this.onBuyDeck(sku);
        },
      });
      c.add(buy.container);
    }
    const close = themedButton(this, width / 2 + (owned ? 0 : 90), 620, 'Close', {
      variant: 'ghost',
      minWidth: 100,
      onTap: () => this.closeOverlay(),
    });
    c.add(close.container);

    this.overlay = shell;
  }

  private closeOverlay(): void {
    this.overlay?.close();
    this.overlay = null;
  }
}
