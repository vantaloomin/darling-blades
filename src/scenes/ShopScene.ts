import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { DECK_INFO } from '../data/deckInfo';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue, type CardDef } from '../engine/types';
import { buyThemeDeck, claimFreeStarter, previewDeckGrant, spendGold } from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CARD_H, CardView } from '../ui/CardView';
import { deckPageCount, deckPageSlice } from '../ui/deckListPaging';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { fxPolicy } from '../ui/fx/FXSupport';
import { modalGuardTarget } from '../ui/Modal';
import { createOddsModal, type BoosterSku } from '../ui/OddsModal';
import { OverlayCoordinator } from '../ui/OverlayCoordinator';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, pager, panel, themedButton, type GoldBadge, type ModalShell, type ThemedButton } from '../ui/themeWidgets';

const PACK_W = 280;
const PACK_H = 400;

export type { BoosterSku } from '../ui/OddsModal';

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

const ARTHURIAN_COURT_PACK_TINT: PackTint = {
  start: theme.colors.heading,
  middle: theme.colors.panelFill,
  end: theme.colors.muted,
  trim: theme.colors.gold,
  foil: theme.colors.heading,
  mist: theme.colors.gold,
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

export const ARTHURIAN_COURT_PACK_ART: PackArtOpts = {
  key: 'packart-arthurian-court',
  sceneArtKey: 'scene-pack-art-arthurian-court',
  tint: ARTHURIAN_COURT_PACK_TINT,
};

export function packTextureForSku(sku: BoosterSku): string {
  if (sku === 'ragnarok') return 'packart-ragnarok';
  if (sku === 'celtic-fae') return 'packart-celtic-fae';
  if (sku === 'arthurian-court') return 'packart-arthurian-court';
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

/** A buyable deck SKU: the list, its price, and whether it's a theme/precon. */
interface DeckSku {
  deck: DeckList;
  price: number;
  theme: boolean;
}

interface PreviewEntry {
  d: CardDef;
  n: number;
}

// --- Decks-tab grid ---------------------------------------------------------
// Two-column, count-aware plate grid: the row pitch is derived from the deck
// count so the roster keeps fitting as sets add precons (comfortable through
// at least 14 decks). tests/ui/layout.test.ts mirrors this math ("deck shop
// grid") — update the test in lockstep with any change here.
const DECK_GRID = {
  cols: 2,
  top: 186, // below the intro line at y=152
  bottom: 696, // last plate bottom must stay above y=700
  plateW: 560,
  gapX: 16,
  maxPitch: 118,
  maxPlateH: 100,
  plateGapY: 8,
} as const;

interface DeckGridLayout {
  rows: number;
  rowPitch: number;
  plateH: number;
  colLefts: number[];
  rowCenter(row: number): number;
}

function deckGridLayout(count: number): DeckGridLayout {
  const rows = Math.max(1, Math.ceil(count / DECK_GRID.cols));
  const band = DECK_GRID.bottom - DECK_GRID.top;
  const rowPitch = Math.min(DECK_GRID.maxPitch, band / rows);
  const plateH = Math.min(DECK_GRID.maxPlateH, rowPitch - DECK_GRID.plateGapY);
  const y0 = DECK_GRID.top + (band - rows * rowPitch) / 2 + rowPitch / 2;
  const totalW = DECK_GRID.cols * DECK_GRID.plateW + (DECK_GRID.cols - 1) * DECK_GRID.gapX;
  const x0 = (theme.design.width - totalW) / 2;
  const colLefts = Array.from(
    { length: DECK_GRID.cols },
    (_, c) => x0 + c * (DECK_GRID.plateW + DECK_GRID.gapX),
  );
  return {
    rows,
    rowPitch,
    plateH,
    colLefts,
    rowCenter: (row) => Math.round(y0 + row * rowPitch),
  };
}

const PREVIEW_ROWS_PER_COLUMN = 9;
const PREVIEW_PAGE_SIZE = PREVIEW_ROWS_PER_COLUMN * 2;
const FEATURED_THUMB_SCALE = 0.21;

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
  private previewEntries: PreviewEntry[] = [];
  private previewInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private shopInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private deckInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private oddsModal: ModalShell | null = null;
  private coordinator!: OverlayCoordinator;
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
    // Default tab follows the free-starter claim (user-directed 2026-07-17):
    // while the claim is unspent the shop opens on the precon decks so a new
    // player lands on Claim Free; once spent it opens on boosters. An explicit
    // data.tab (onboarding routes { tab: 'decks' }) always wins.
    const freeClaimAvailable = Services.save.data.starterChosen === null;
    this.tab = data.tab ?? (freeClaimAvailable ? 'decks' : 'boosters');
    this.qty = 1;
    this.skuButtons = [];
    this.qtyChips = new Map();
    this.tabButtons = new Map();
    this.overlay = null;
    this.inspect = null;
    this.inspectIdx = null;
    this.previewEntries = [];
    this.previewInteractiveTargets = [];
    this.shopInteractiveTargets = [];
    this.deckInteractiveTargets = [];
    this.oddsModal = null;
    this.coordinator = new OverlayCoordinator();
    // Deck-preview hotkeys. Keyboard bypasses the modal dims, so every handler
    // self-guards on the overlay/inspect state (the LimitedDraftScene pattern);
    // the KeyboardPlugin is scene-scoped, so shutdown clears these listeners.
    this.input.keyboard?.on('keydown-ESC', this.onEscKey);
    this.input.keyboard?.on('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.on('keydown-RIGHT', this.onInspectNext);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
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
    bakePackArt(this, ARTHURIAN_COURT_PACK_ART);
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

    this.buildTabBar();
    this.boostersGroup = this.add.container(0, 0);
    this.decksGroup = this.add.container(0, 0);
    this.buildBoostersGroup(this.boostersGroup);
    this.buildDecksGroup(this.decksGroup);
    this.setTab(this.tab); // honors the initial tab (onboarding routes to 'decks')

    this.shopInteractiveTargets.push(backButton(this, () => this.scene.start('MainMenu')));
  }

  private readonly onShutdown = (): void => {
    this.closeOverlay();
    this.coordinator.destroy();
    this.input.keyboard?.off('keydown-ESC', this.onEscKey);
    this.input.keyboard?.off('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.off('keydown-RIGHT', this.onInspectNext);
  };

  private underlyingInteractiveTargets(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.shopInteractiveTargets,
      ...this.deckInteractiveTargets,
    ];
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
      this.shopInteractiveTargets.push(button.inputZone);
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
    this.buildPackSku(group, 160, 'Core Set', 'packart', ECONOMY.packPrice, 'base', () =>
      this.buyPacks(ECONOMY.packPrice, undefined, 'base'),
    );
    this.buildPackSku(
      group,
      480,
      'Ragnarök',
      'packart-ragnarok',
      ECONOMY.ragnarokPackPrice,
      'ragnarok',
      () => this.buyPacks(ECONOMY.ragnarokPackPrice, 'ragnarok', 'ragnarok'),
    );
    this.buildPackSku(
      group,
      800,
      'Celtic Fae',
      'packart-celtic-fae',
      ECONOMY.celticFaePackPrice,
      'celtic-fae',
      () => this.buyPacks(ECONOMY.celticFaePackPrice, 'celtic-fae', 'celtic-fae'),
    );
    this.buildPackSku(
      group,
      1120,
      'Arthurian Court',
      'packart-arthurian-court',
      ECONOMY.arthurianCourtPackPrice,
      'arthurian-court',
      () => this.buyPacks(ECONOMY.arthurianCourtPackPrice, 'arthurian-court', 'arthurian-court'),
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
    sku: BoosterSku,
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
    const infoX = x + theme.space(24);
    const infoBg = this.add.graphics();
    infoBg.fillStyle(theme.graphics.rowFill, theme.alpha.panel);
    infoBg.fillCircle(infoX, title.y, theme.space(3));
    infoBg.lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), theme.alpha.chrome);
    infoBg.strokeCircle(infoX, title.y, theme.space(3));
    const info = this.add
      .text(infoX, title.y, 'i', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(info, theme.control.minHitHeight, theme.control.minHitHeight);
    bindTapButton(this, info, () => this.showOddsModal(sku));
    bindTapButton(this, pack, onBuy);
    this.skuButtons.push({ btn: buyBtn, price });
    this.shopInteractiveTargets.push(pack, buyBtn.inputZone, info);
    group.add([title, infoBg, info, pack, buyBtn.container]);
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
      this.shopInteractiveTargets.push(chip.inputZone);
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
    this.deckInteractiveTargets = [];
    const skus = this.deckSkus();
    const grid = deckGridLayout(skus.length);
    skus.forEach((sku, i) => {
      const left = grid.colLefts[i % DECK_GRID.cols];
      const cy = grid.rowCenter(Math.floor(i / DECK_GRID.cols));
      this.buildDeckPlate(group, sku, left, cy, grid.plateH);
    });
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

  private buildDeckPlate(
    group: Phaser.GameObjects.Container,
    sku: DeckSku,
    left: number,
    cy: number,
    plateH: number,
  ): void {
    const { deck, price, theme: isTheme } = sku;
    const owned = Services.save.data.decks.some((d) => d.id === deck.id);
    const freeClaim = this.isFreeClaim(deck);

    // Controls hug the plate's right edge: Buy/Claim (130-wide hit) inset 12px,
    // Preview (90-wide hit) to its left with a 10px hit gap (>= the 8px floor).
    const buyX = left + DECK_GRID.plateW - 77;
    const previewX = buyX - 120;
    const textLeft = left + 16;
    const textMaxW = previewX - 45 - 10 - textLeft; // stop short of the Preview hit rect

    const plate = panel(this, left, cy - plateH / 2, DECK_GRID.plateW, plateH, { alpha: 0.7 });
    // Long name/blurb lines shrink toward their left anchor instead of running
    // under the Preview button (plain Text scaling — no scaled-Container input).
    const fit = (t: Phaser.GameObjects.Text): Phaser.GameObjects.Text => {
      if (t.width > textMaxW) t.setScale(textMaxW / t.width);
      return t;
    };
    const name = fit(
      this.add
        .text(textLeft, cy - 12, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: isTheme ? theme.colors.gold : theme.colors.heading,
        })
        .setOrigin(0, 0.5),
    );
    // Color identity renders as mana pips, never letter codes (design-system
    // "Color identity" rule); the archetype line starts after the pip run.
    const info = DECK_INFO[deck.id];
    const pipKeys = info ? info.colors.split('/') : [];
    const PIP = 16;
    const pipStep = PIP + 4;
    for (let i = 0; i < pipKeys.length; i++) {
      group.add(
        this.add
          .image(textLeft + PIP / 2 + i * pipStep, cy + 11, `pip-${pipKeys[i]}`)
          .setDisplaySize(PIP, PIP),
      );
    }
    const blurbLeft = textLeft + (pipKeys.length > 0 ? pipKeys.length * pipStep + 2 : 0);
    // No free-starter marker here: the Claim Free button already carries that
    // state (user-directed 2026-07-17).
    const blurbText = (info?.archetype ?? '') + (owned ? '  ·  Owned' : '');
    const blurb = this.add
      .text(blurbLeft, cy + 11, blurbText, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const blurbMaxW = textMaxW - (blurbLeft - textLeft);
    if (blurb.width > blurbMaxW) blurb.setScale(blurbMaxW / blurb.width);
    group.add([plate, name, blurb]);

    const preview = themedButton(this, previewX, cy, 'Preview', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.showDeckPreview(sku),
    });
    this.deckInteractiveTargets.push(preview.inputZone);
    group.add(preview.container);

    if (!owned) {
      const buy = themedButton(this, buyX, cy, freeClaim ? 'Claim Free ✦' : `Buy · 🪙 ${price}`, {
        variant: 'primary',
        size: 'sm',
        minWidth: 130,
        onTap: () => this.onBuyDeck(sku),
      });
      this.deckInteractiveTargets.push(buy.inputZone);
      group.add(buy.container);
    } else {
      // The old premium-hero "Set as Hero" toggle is gone (user-directed
      // 2026-07-11): per-deck hero cards (SavedDeck.heroCardId, the DeckBuilder
      // star) superseded the account-level premium portrait. Saves that already
      // set heroPortraitId keep working via DuelScene's fallback chain.
      group.add(
        this.add
          .text(buyX, cy, 'Owned ✓', {
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

  /** Esc closes the TOP overlay only: inspect, odds, then deck preview. All
   * shells register with escToClose:false so one press can't close two. */
  private readonly onEscKey = (): void => {
    if (this.inspect) this.closeInspect();
    else if (this.oddsModal) this.closeOddsModal();
    else this.overlay?.close();
  };

  private showOddsModal(sku: BoosterSku): void {
    this.closeOverlay();
    const shell = createOddsModal(this, this.coordinator, sku, this.underlyingInteractiveTargets(), () => {
      if (this.oddsModal === shell) this.oddsModal = null;
    });
    this.oddsModal = shell;
  }

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
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts.entries()].map(([id, n]) => ({ d: def(CARD_DB, id), n }));
    const sortFn = (a: PreviewEntry, b: PreviewEntry): number =>
      manaValue(a.d.cost) - manaValue(b.d.cost) || a.d.name.localeCompare(b.d.name);
    const creatures = entries.filter((e) => isType(e.d, 'creature')).sort(sortFn);
    const spells = entries.filter((e) => !isType(e.d, 'creature') && !isType(e.d, 'land')).sort(sortFn);
    const lands = entries.filter((e) => isType(e.d, 'land')).sort(sortFn);
    this.previewEntries = [...creatures, ...spells, ...lands];
    const shell = modalShell(this, {
      width: 980,
      height: 600,
      dimAlpha: 0.52,
      depth: theme.depth.modal,
      showClose: false,
      tapDimToClose: true,
      escToClose: false, // Esc is handled scene-side so it closes top-most only
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.underlyingInteractiveTargets().map(modalGuardTarget),
      },
      onClose: () => this.onPreviewClosed(shell),
    });
    this.overlay = shell;
    this.previewInteractiveTargets = [...shell.interactiveChildren];
    const c = shell.container;
    const content = shell.tracks.contentBounds;
    const contentCenterX = content.x + content.width / 2;

    // Header: name, color identity as real mana beads + archetype, how-it-plays.
    const titleY = shell.tracks.titleTrack.y + shell.tracks.titleTrack.height / 2;
    const titleX = shell.tracks.titleTrack.x + shell.tracks.titleTrack.width / 2;
    c.add(
      this.add
        .text(titleX, titleY, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    const idY = content.y + 8;
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
    let px = contentCenterX - clusterW / 2;
    for (const k of pipKeys) {
      c.add(this.add.image(px + pipSize / 2, idY, `pip-${k}`).setDisplaySize(pipSize, pipSize));
      px += pipPitch;
    }
    archText.setPosition(px + 8, idY);
    c.add(archText);
    if (info?.plays) {
      c.add(
        this.add
          .text(contentCenterX, content.y + 24, info.plays, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
            wordWrap: { width: content.width - 72 },
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5, 0),
      );
    }

    // Left column: signature cards, mana curve, composition, and grant preview.
    const stats = computeDeckStats(deck.cards, CARD_DB);
    const statsX = content.x + 16;
    const sectionLabel = (x: number, y: number, label: string): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5);

    c.add(sectionLabel(statsX, content.y + 78, 'SIGNATURE CARDS · TAP TO INSPECT'));
    const featuredY = content.y + 140;
    const featuredPitch = 92;
    const featuredX0 = statsX + 38;
    for (const [slot, id] of (info?.featured ?? []).entries()) {
      const idx = this.previewEntries.findIndex((entry) => entry.d.id === id);
      if (idx < 0) continue;
      const entry = this.previewEntries[idx];
      const x = featuredX0 + slot * featuredPitch;
      const thumb = makeCardThumb(this, x, featuredY, entry.d, FEATURED_THUMB_SCALE)
        .setInteractive({ useHandCursor: true });
      inflateHitArea(thumb, 70, 88);
      bindTapButton(this, thumb, () => this.showCardInspect(idx));
      thumb.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) thumb.setTint(colorInt(theme.colors.gold));
      });
      thumb.on('pointerout', () => thumb.clearTint());
      c.add(thumb);
      this.previewInteractiveTargets.push(thumb);

      const label = this.add
        .text(x + thumb.displayWidth / 2 - 4, featuredY - thumb.displayHeight / 2 + 4, `x${entry.n}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
        })
        .setOrigin(1, 0);
      const badgeW = Math.max(34, Math.ceil(label.width + 10));
      const badge = this.add.graphics();
      badge.fillStyle(theme.graphics.panelFill, 0.94);
      badge.fillRoundedRect(label.x - badgeW, label.y - 2, badgeW, 18, theme.radius.control);
      badge.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
      badge.strokeRoundedRect(label.x - badgeW, label.y - 2, badgeW, 18, theme.radius.control);
      c.add([badge, label]);
    }

    c.add(sectionLabel(statsX, content.y + 204, 'MANA CURVE'));
    const barBase = content.y + 258;
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
        .text(statsX, content.y + 288, `${stats.typeCounts.creature} creatures · ${stats.lands} lands · ${other} other`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
    );
    let pipX = statsX;
    const pipY = content.y + 318;
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
    c.add(sectionLabel(statsX, content.y + 346, 'WHAT YOU GET'));
    const grant = previewDeckGrant(save, CARD_DB, deck.cards);
    const grantText =
      grant.grantedCopies > 0
        ? `Adds ${grant.grantedCopies} new card copies to your collection; you already own ${grant.ownedCopies} of its ${grant.nonBasicCopies} non-basic copies. Basics are always free.`
        : 'Adds no new copies: your collection already has every card this deck runs.';
    c.add(
      this.add
        .text(statsX, content.y + 364, grantText, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          wordWrap: { width: 310 },
          lineSpacing: 4,
        })
        .setOrigin(0, 0),
    );

    // Right block: the complete, bounded list. One page is a stable pair of
    // nine-row columns; the pure shared helpers guarantee no entry is dropped.
    type Category = 'Creatures' | 'Spells' | 'Lands';
    interface CategorizedEntry {
      entry: PreviewEntry;
      index: number;
      category: Category;
    }
    const categorized: CategorizedEntry[] = this.previewEntries.map((entry, index) => ({
      entry,
      index,
      category: isType(entry.d, 'creature') ? 'Creatures' : isType(entry.d, 'land') ? 'Lands' : 'Spells',
    }));
    const categoryTotals = new Map<Category, number>([
      ['Creatures', creatures.reduce((sum, entry) => sum + entry.n, 0)],
      ['Spells', spells.reduce((sum, entry) => sum + entry.n, 0)],
      ['Lands', lands.reduce((sum, entry) => sum + entry.n, 0)],
    ]);
    const colW = 260;
    const pitch = 24;
    const listX = content.x + 376;
    const secondListX = listX + 295;
    const listTop = content.y + 104;
    const pages = deckPageCount(categorized.length, PREVIEW_PAGE_SIZE);
    let pageControl: ReturnType<typeof pager> | null = null;
    let listItems: Phaser.GameObjects.GameObject[] = [];
    let listTargets: Phaser.GameObjects.GameObject[] = [];
    const addListItem = (item: Phaser.GameObjects.GameObject): void => {
      listItems.push(item);
      c.add(item);
    };
    const clearList = (): void => {
      const staleTargets = new Set(listTargets);
      this.previewInteractiveTargets = this.previewInteractiveTargets.filter((target) => !staleTargets.has(target));
      for (const item of listItems) if (item.active) item.destroy();
      listItems = [];
      listTargets = [];
    };
    const addRow = (x: number, y: number, item: CategorizedEntry): void => {
      const { entry, index } = item;
      const band = this.add
        .rectangle(x + colW / 2, y, colW, 22, theme.graphics.rowFill, 0.55)
        .setInteractive({ useHandCursor: true });
      band.on('pointerover', () => band.setFillStyle(theme.graphics.rowFillActive, 0.95));
      band.on('pointerout', () => band.setFillStyle(theme.graphics.rowFill, 0.55));
      bindTapButton(this, band, () => this.showCardInspect(index));
      listTargets.push(band);
      this.previewInteractiveTargets.push(band);
      const cnt = this.add
        .text(x + 28, y, `${entry.n}×`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
      const name = this.add
        .text(x + 36, y, entry.d.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      // Full name always — shrink-to-fit rather than truncate (never split(',')).
      const maxNameW = colW - 76;
      if (name.width > maxNameW) name.setScale(maxNameW / name.width);
      const mv = this.add
        .text(x + colW - 8, y, isType(entry.d, 'land') ? '' : `${manaValue(entry.d.cost)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
      for (const gameObject of [band, cnt, name, mv]) addListItem(gameObject);
    };
    const renderColumn = (x: number, items: CategorizedEntry[]): void => {
      let y = listTop;
      let activeCategory: Category | null = null;
      for (const item of items) {
        if (item.category !== activeCategory) {
          activeCategory = item.category;
          addListItem(sectionLabel(x, y, `${item.category.toUpperCase()} · ${categoryTotals.get(item.category) ?? 0}`));
          y += pitch;
        }
        addRow(x, y, item);
        y += pitch;
      }
    };
    const renderPage = (page: number): void => {
      clearList();
      const visible = deckPageSlice(categorized, page, PREVIEW_PAGE_SIZE);
      renderColumn(listX, visible.slice(0, PREVIEW_ROWS_PER_COLUMN));
      renderColumn(secondListX, visible.slice(PREVIEW_ROWS_PER_COLUMN));
      pageControl?.refresh(page, pages);
    };
    if (pages > 1) {
      pageControl = pager(
        this,
        (listX + colW + secondListX) / 2 - 44,
        content.y + content.height - 4,
        0,
        pages,
        renderPage,
      );
      c.add(pageControl.container);
      this.previewInteractiveTargets.push(pageControl.previous, pageControl.next);
    }
    renderPage(0);

    // Footer: the honest decision block — price vs balance before committing —
    // positioned on the shell's own footer track (the old hardcoded y overhung
    // the panel by 2px). Buy stays disabled when unaffordable; the modal only
    // closes after a purchase actually happens.
    const footer = shell.tracks.footerTrack;
    const footY = footer.y + footer.height / 2;
    const footerRight = footer.x + footer.width;
    const affordable = freeClaim || save.gold >= price;
    const footerInfo = owned
      ? { text: 'Owned ✓', color: theme.colors.success }
      : freeClaim
        ? {
            text: `✦ Your one free starter. The other starters cost 🪙 ${ECONOMY.starterDeckPrice} once you claim it.`,
            color: theme.colors.gold,
          }
        : affordable
          ? {
              text: `Price 🪙 ${price} · Balance 🪙 ${save.gold} → 🪙 ${save.gold - price} after`,
              color: theme.colors.body,
            }
          : {
              text: `Price 🪙 ${price} · Balance 🪙 ${save.gold} · 🪙 ${price - save.gold} short`,
              color: theme.colors.danger,
            };
    c.add(
      this.add
        .text(footer.x + 16, footY, footerInfo.text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: footerInfo.color,
          wordWrap: { width: 540 },
          lineSpacing: 3,
        })
        .setOrigin(0, 0.5),
    );
    if (!owned) {
      const buy = themedButton(this, footerRight - 216, footY, freeClaim ? 'Claim Free ✦' : `Buy · 🪙 ${price}`, {
        variant: 'primary',
        minWidth: 170,
        enabled: affordable,
        onTap: () => {
          if (this.onBuyDeck(sku)) this.closeOverlay();
        },
      });
      c.add(buy.container);
      this.previewInteractiveTargets.push(buy.inputZone);
    }
    const close = themedButton(this, footerRight - 61, footY, 'Close', {
      variant: 'ghost',
      minWidth: 90,
      onTap: () => this.closeOverlay(),
    });
    c.add(close.container);
    this.previewInteractiveTargets.push(close.inputZone);
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
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.previewInteractiveTargets.map(modalGuardTarget),
      },
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
    const content = shell.tracks.contentBounds;
    const contentX = content.x + content.width / 2;
    const contentY = content.y + content.height / 2;
    const inspectScale = Math.min(1.25, (content.height - 12) / CARD_H);
    const view = new CardView(this, contentX, contentY).setScale(inspectScale);
    view.setCard(entry.d, { fx: 'full' });
    c.add(view);
    const footer = shell.tracks.footerTrack;
    c.add(
      this.add
        .text(footer.x + footer.width / 2, footer.y + footer.height / 2, `${entry.n}× in this deck   ·   ←/→ browse the list · Esc closes`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
  }

  private onPreviewClosed(shell: ModalShell): void {
    if (this.overlay !== shell) return;
    this.overlay = null;
    this.previewEntries = [];
    this.previewInteractiveTargets = [];
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
    this.closeOddsModal();
  }

  private closeOddsModal(): void {
    this.oddsModal?.close();
    this.oddsModal = null;
  }
}
