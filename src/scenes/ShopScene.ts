import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue, type CardDef } from '../engine/types';
import { buyThemeDeck, claimFreeStarter, previewDeckGrant, spendGold } from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { Services } from '../meta/services';
import { bindTapButton } from '../platform/gestures';
import { CardView } from '../ui/CardView';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { fxPolicy } from '../ui/fx/FXSupport';
import { OddsDrawer } from '../ui/OddsDrawer';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
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

/**
 * Per-deck presentation copy (id-keyed): color identity (authored order — the
 * deck-row blurb and the preview modal's pip icons both derive from it), an
 * archetype tag, and a short "how it plays" paragraph for the preview modal.
 */
const DECK_INFO: Record<string, { colors: string; archetype: string; plays: string }> = {
  'starter-crimson': {
    colors: 'R/W',
    archetype: 'Warband aggro',
    plays:
      'Flood the board with cheap warband bodies and end the game before slower decks set up — Nike and Ares turn a wide board lethal. Light on answers: if the rush stalls, it runs out of gas.',
  },
  'starter-wild': {
    colors: 'G/W',
    archetype: 'Beastkin tribal',
    plays:
      'Curve out with efficient Beastkin and win through big, straightforward combat — Wild Surge ambushes attackers mid-fight. Few tricks beyond the creatures themselves.',
  },
  'starter-tides': {
    colors: 'U/R',
    archetype: 'Wu tempo-burn',
    plays:
      'Land early evasive threats, then protect the lead — Fire Attack clears blockers while Undertow buys the tempo back. Punishing when ahead, fragile when behind.',
  },
  'starter-mandate': {
    colors: 'U/B',
    archetype: 'Jin control',
    plays:
      'Trade one-for-one with removal and card draw, grind value with Jin schemers, and take over the late game. The slowest starter: you exhaust the opponent rather than race them.',
  },
  'starter-harvest': {
    colors: 'B/G',
    archetype: 'Underworld attrition',
    plays:
      'Trade freely — Deathblade blockers make every exchange profitable — then Raise Dead rebuilds your board from the graveyard. Patient, grindy midrange.',
  },
  'theme-ragnarok': {
    colors: 'B/G',
    archetype: 'Ragnarök reanimator',
    plays:
      'Mill your own creatures into the graveyard, then cheat the fattest Jotun back with Call the Einherjar. Explosive once the yard fills; awkward when the pieces arrive in the wrong order.',
  },
  'theme-celtic-fae': {
    colors: 'U/B/G',
    archetype: 'Celtic Fae tempo-control',
    plays:
      'Evasive fae chip in while Foresee smooths your draws and bounce effects hold the board back. Every turn is a tempo decision — the highest-skill deck in the shop.',
  },
};

/** The deck-row identity line, derived from DECK_INFO (e.g. "R/W · Warband aggro"). */
const deckBlurb = (id: string): string => {
  const info = DECK_INFO[id];
  return info ? `${info.colors} · ${info.archetype}` : '';
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
  /** Card-inspect layered above the deck preview; null when closed. */
  private inspect: ModalShell | null = null;
  /** Index into previewEntries shown by the open inspect; null when closed. */
  private inspectIdx: number | null = null;
  /** The open preview's distinct-card entries in visual order (creatures → spells → lands). */
  private previewEntries: { d: CardDef; n: number }[] = [];
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
    this.inspect = null;
    this.inspectIdx = null;
    this.previewEntries = [];
    // Deck-preview hotkeys. Keyboard bypasses the modal dims, so every handler
    // self-guards on the overlay/inspect state (the LimitedDraftScene pattern);
    // the KeyboardPlugin is scene-scoped, so shutdown clears these listeners.
    this.input.keyboard?.on('keydown-ESC', this.onEscKey);
    this.input.keyboard?.on('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.on('keydown-RIGHT', this.onInspectNext);
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
    this.buildPackSku(group, 340, 'Core Set', 'packart', ECONOMY.packPrice, () =>
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
    const buyBtn = themedButton(this, x, 552, `Buy · 🪙 ${price}`, {
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
      btn.setLabel(this.qty > 1 ? `Buy ×${this.qty} · 🪙 ${price * this.qty}` : `Buy · 🪙 ${price}`);
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
      .text(640, 152, 'Preconstructed decks: inspect the list, then buy the ones you didn’t start with.', {
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
      deckBlurb(deck.id) +
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
      onTap: () => this.showDeckPreview(sku),
    });
    group.add(preview.container);

    if (!owned) {
      const buy = themedButton(this, 920, y, freeClaim ? 'Claim Free ✦' : `Buy · 🪙 ${price}`, {
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

  /** Claim/buy a deck. Returns true only when the purchase actually happened. */
  private onBuyDeck(sku: DeckSku): boolean {
    const save = Services.save.data;
    if (this.isFreeClaim(sku.deck)) {
      claimFreeStarter(save, CARD_DB, sku.deck); // free — sets starterChosen + activeDeckId
    } else if (!buyThemeDeck(save, CARD_DB, sku.deck, sku.price)) {
      this.insufficientFunds();
      return false;
    }
    Sfx.play('coin');
    Services.save.flush();
    this.refreshGold();
    this.buildDecksGroup(this.decksGroup); // the claimed/bought row now reads "Owned ✓"
    return true;
  }

  // --- Deck preview overlay -------------------------------------------------

  /** Esc closes the TOP overlay only — inspect first, then the preview. Both
   * shells register with escToClose:false so one press can't close both. */
  private readonly onEscKey = (): void => {
    if (this.inspect) this.closeInspect();
    else this.overlay?.close();
  };

  private readonly onInspectPrev = (): void => this.stepInspect(-1);
  private readonly onInspectNext = (): void => this.stepInspect(1);

  private stepInspect(delta: number): void {
    if (this.inspectIdx === null || this.previewEntries.length === 0) return;
    const n = this.previewEntries.length;
    this.showCardInspect((this.inspectIdx + delta + n) % n);
  }

  /**
   * Inspect a deck before buying: identity + "how it plays", mana curve and
   * composition, what the purchase actually adds to the collection, the full
   * list as tappable rows (tap = card inspect, ←/→ steps), and a footer that
   * states the price/balance consequence before the player commits.
   */
  private showDeckPreview(sku: DeckSku): void {
    this.closeOverlay();
    const { deck, price } = sku;
    const save = Services.save.data;
    const owned = save.decks.some((d) => d.id === deck.id);
    const freeClaim = this.isFreeClaim(deck);
    const info = DECK_INFO[deck.id];
    const shell = modalShell(this, {
      width: 980,
      height: 600,
      dimAlpha: 0.52,
      depth: theme.depth.modal,
      showClose: false,
      tapDimToClose: true,
      escToClose: false, // Esc is handled scene-side so it closes top-most only
    });
    shell.container.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.overlay === shell) this.overlay = null;
    });
    const c = shell.container;

    // Header: name, color identity as real mana beads + archetype, how-it-plays.
    const titleY = shell.tracks.titleTrack.y + shell.tracks.titleTrack.height / 2;
    c.add(
      this.add
        .text(640, titleY, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    const idY = titleY + 34;
    const archText = this.add
      .text(0, idY, `${info?.archetype ?? ''} · ${deck.cards.length} cards`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const pipKeys = (info?.colors ?? '').split('/').filter(Boolean);
    const pipSize = 22;
    const pipPitch = pipSize + 4;
    const clusterW = pipKeys.length * pipPitch + 8 + archText.width;
    let px = 640 - clusterW / 2;
    for (const k of pipKeys) {
      c.add(this.add.image(px + pipSize / 2, idY, `pip-${k}`).setDisplaySize(pipSize, pipSize));
      px += pipPitch;
    }
    archText.setPosition(px + 8, idY);
    c.add(archText);
    if (info?.plays) {
      c.add(
        this.add
          .text(640, idY + 22, info.plays, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
            wordWrap: { width: 840 },
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5, 0),
      );
    }

    // Left column: mana curve, composition, color totals, grant preview.
    const stats = computeDeckStats(deck.cards, CARD_DB);
    const statsX = 200;
    const sectionLabel = (x: number, y: number, label: string): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5);
    c.add(sectionLabel(statsX, 252, 'MANA CURVE'));
    const barBase = 326;
    const maxCount = Math.max(1, ...stats.curve);
    stats.curve.forEach((count, mv) => {
      const bx = statsX + 10 + mv * 24;
      const h = count > 0 ? Math.max(3, Math.round((count / maxCount) * 30)) : 2;
      c.add(
        this.add
          .rectangle(bx, barBase, 15, h, count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill)
          .setOrigin(0.5, 1),
      );
      if (count > 0) {
        c.add(
          this.add
            .text(bx, barBase - h - 8, `${count}`, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              color: theme.colors.body,
            })
            .setOrigin(0.5),
        );
      }
      c.add(
        this.add
          .text(bx, barBase + 9, mv === CURVE_MAX ? '7+' : `${mv}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0.5),
      );
    });
    const other = stats.nonlands - stats.typeCounts.creature;
    c.add(
      this.add
        .text(statsX, 360, `${stats.typeCounts.creature} creatures · ${stats.lands} lands · ${other} other`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
    );
    let pipX = statsX;
    const pipY = 390;
    for (const color of PIE_COLORS) {
      const n = stats.colorPips[color];
      if (n === 0) continue;
      c.add(this.add.image(pipX + 10, pipY, `pip-${color}`).setDisplaySize(20, 20));
      const label = this.add
        .text(pipX + 24, pipY, `${n}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5);
      c.add(label);
      pipX += 24 + label.width + 14;
    }

    // What the purchase actually adds (mirrors grantDeckCards — see Economy).
    c.add(sectionLabel(statsX, 432, 'WHAT YOU GET'));
    const grant = previewDeckGrant(save, CARD_DB, deck.cards);
    const grantText =
      grant.grantedCopies > 0
        ? `Adds ${grant.grantedCopies} new card copies to your collection — you already own ${grant.ownedCopies} of its ${grant.nonBasicCopies} non-basic copies. Basics are always free.`
        : 'Adds no new copies — your collection already has every card this deck runs.';
    c.add(
      this.add
        .text(statsX, 450, grantText, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          wordWrap: { width: 310 },
          lineSpacing: 4,
        })
        .setOrigin(0, 0),
    );

    // Right block: the full list as tappable rows (tap = inspect the card).
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts.entries()].map(([id, n]) => ({ d: def(CARD_DB, id), n }));
    const sortFn = (a: { d: CardDef }, b: { d: CardDef }): number =>
      manaValue(a.d.cost) - manaValue(b.d.cost) || a.d.name.localeCompare(b.d.name);
    const creatures = entries.filter((e) => isType(e.d, 'creature')).sort(sortFn);
    const spells = entries.filter((e) => !isType(e.d, 'creature') && !isType(e.d, 'land')).sort(sortFn);
    const lands = entries.filter((e) => isType(e.d, 'land')).sort(sortFn);
    this.previewEntries = [...creatures, ...spells, ...lands];

    const colW = 260;
    const pitch = 24;
    let flatIdx = 0;
    const addRow = (x: number, y: number, e: { d: CardDef; n: number }): void => {
      const idx = flatIdx++;
      const band = this.add
        .rectangle(x + colW / 2, y, colW, 22, theme.graphics.rowFill, 0.55)
        .setInteractive({ useHandCursor: true });
      band.on('pointerover', () => band.setFillStyle(theme.graphics.rowFillActive, 0.95));
      band.on('pointerout', () => band.setFillStyle(theme.graphics.rowFill, 0.55));
      bindTapButton(this, band, () => this.showCardInspect(idx));
      const cnt = this.add
        .text(x + 28, y, `${e.n}×`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
      const name = this.add
        .text(x + 36, y, e.d.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      // Full name always — shrink-to-fit rather than truncate (never split(',')).
      const maxNameW = colW - 76;
      if (name.width > maxNameW) name.setScale(maxNameW / name.width);
      const mv = this.add
        .text(x + colW - 8, y, isType(e.d, 'land') ? '' : `${manaValue(e.d.cost)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
      c.add([band, cnt, name, mv]);
    };
    const renderSections = (x: number, sections: { title: string; items: { d: CardDef; n: number }[] }[]): void => {
      let y = 252;
      for (const s of sections) {
        if (s.items.length === 0) continue;
        const total = s.items.reduce((sum, e) => sum + e.n, 0);
        c.add(sectionLabel(x, y, `${s.title.toUpperCase()} · ${total}`));
        y += pitch;
        for (const e of s.items) {
          addRow(x, y, e);
          y += pitch;
        }
        y += 10;
      }
    };
    renderSections(550, [{ title: 'Creatures', items: creatures }]);
    renderSections(845, [
      { title: 'Spells', items: spells },
      { title: 'Lands', items: lands },
    ]);

    // Footer: the honest decision block — price vs balance before committing —
    // positioned on the shell's own footer track (the old hardcoded y overhung
    // the panel by 2px). Buy stays disabled when unaffordable; the modal only
    // closes after a purchase actually happens.
    const footY = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2;
    const affordable = freeClaim || save.gold >= price;
    const footerInfo = owned
      ? { text: 'Owned ✓', color: theme.colors.success }
      : freeClaim
        ? {
            text: `✦ Your one free starter — the other starters cost 🪙 ${ECONOMY.starterDeckPrice} once you claim it.`,
            color: theme.colors.gold,
          }
        : affordable
          ? {
              text: `Price 🪙 ${price} · Balance 🪙 ${save.gold} → 🪙 ${save.gold - price} after`,
              color: theme.colors.body,
            }
          : {
              text: `Price 🪙 ${price} · Balance 🪙 ${save.gold} — 🪙 ${price - save.gold} short`,
              color: theme.colors.danger,
            };
    c.add(
      this.add
        .text(200, footY, footerInfo.text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: footerInfo.color,
          wordWrap: { width: 540 },
          lineSpacing: 3,
        })
        .setOrigin(0, 0.5),
    );
    if (!owned) {
      const buy = themedButton(this, 890, footY, freeClaim ? 'Claim Free ✦' : `Buy · 🪙 ${price}`, {
        variant: 'primary',
        minWidth: 170,
        enabled: affordable,
        onTap: () => {
          if (this.onBuyDeck(sku)) this.closeOverlay();
        },
      });
      c.add(buy.container);
    }
    const close = themedButton(this, 1045, footY, 'Close', {
      variant: 'ghost',
      minWidth: 90,
      onTap: () => this.closeOverlay(),
    });
    c.add(close.container);

    this.overlay = shell;
  }

  /** Full-card inspect layered above the deck preview; ←/→ steps the list. */
  private showCardInspect(idx: number): void {
    this.closeInspect();
    const entry = this.previewEntries[idx];
    if (!entry) return;
    const shell = modalShell(this, {
      width: 560,
      height: 620,
      dimAlpha: 0.8,
      depth: theme.depth.inspect,
      showClose: true,
      tapDimToClose: true,
      escToClose: false, // scene-side Esc closes the inspect before the preview
      onClose: () => {
        if (this.inspect === shell) {
          this.inspect = null;
          this.inspectIdx = null;
        }
      },
    });
    this.inspect = shell;
    this.inspectIdx = idx;
    const c = shell.container;
    const view = new CardView(this, 640, 338).setScale(1.25);
    view.setCard(entry.d, { fx: 'full' });
    c.add(view);
    c.add(
      this.add
        .text(640, 632, `${entry.n}× in this deck   ·   ←/→ browse the list · Esc closes`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
  }

  private closeInspect(): void {
    this.inspect?.close();
    this.inspect = null;
    this.inspectIdx = null;
  }

  private closeOverlay(): void {
    this.closeInspect();
    this.overlay?.close();
    this.overlay = null;
    this.previewEntries = [];
  }
}
