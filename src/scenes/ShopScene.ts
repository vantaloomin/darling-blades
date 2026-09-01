import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { DECK_INFO } from '../data/deckInfo';
import { DUAT_SET, isLiveCollectible } from '../data/liveness';
import {
  DARLINGS_PRECONS,
  FREE_DARLINGS_PRECON_ID,
  type DarlingsPrecon,
} from '../data/darlingsPrecons';
import { SET_BLURBS, SET_TITLES } from '../data/setTitles';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue, type CardDef } from '../engine/types';
import {
  buyThemeDeck,
  claimFreeDarlingsDeck,
  claimFreeStarter,
  cloneShopDeck,
  deckProductCardIds,
  grantedDeckBuild,
  previewDeckGrant,
  spendGold,
  type GrantedDeckBuild,
} from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { packPoolSummary, type PackPoolSummary } from '../meta/packSummary';
import { Services } from '../meta/services';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { attachTouchGestures, bindTapButton, inflateHitArea } from '../platform/gestures';
import { TAP_SLOP_PX } from '../platform/gestureCore';
import { makeCardThumb } from '../ui/CardThumbCache';
import { DECK_SHOP_LAYOUT, deckShopLayout } from '../ui/deckShopLayout';
import { CARD_H, CardView } from '../ui/CardView';
import { deckPageCount, deckPageSlice } from '../ui/deckListPaging';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { fxPolicy } from '../ui/fx/FXSupport';
import { modalGuardTarget } from '../ui/Modal';
import { createOddsModal, type BoosterSku } from '../ui/OddsModal';
import { OverlayCoordinator } from '../ui/OverlayCoordinator';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { queueToast, Toast } from '../ui/Toast';
import { backButton, goldBadge, modalShell, pager, panel, themedButton, type GoldBadge, type ModalShell, type ThemedButton } from '../ui/themeWidgets';
import {
  boosterStripIndexForOffset,
  boosterStripLayout,
  boosterStripOffsetForIndex,
  boosterStripTap,
  boosterStripTileIsVisible,
  boosterStripVisibility,
  clampBoosterStripOffset,
  type BoosterStripLayout,
} from '../ui/boosterStripLayout';

const PACK_W = 280;
const PACK_H = 400;
const WHEEL_STEP_THRESHOLD = 60;
const WHEEL_STEP_COOLDOWN_MS = 250;

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

const GOTHIC_MONSTERS_PACK_TINT: PackTint = {
  start: theme.colors.dangerBg,
  middle: theme.colors.panelFill,
  end: theme.colors.muted,
  trim: theme.colors.gold,
  foil: theme.colors.danger,
  mist: theme.colors.danger,
};

const DARK_TALES_PACK_TINT: PackTint = {
  start: theme.colors.btnEmphasisBg,
  middle: theme.colors.panelFill,
  end: theme.colors.muted,
  trim: theme.colors.gold,
  foil: theme.colors.heading,
  mist: theme.colors.panelStroke,
};

const YOKAI_NIGHTS_PACK_TINT: PackTint = {
  start: theme.colors.dangerBg,
  middle: theme.colors.btnEmphasisBg,
  end: theme.colors.panelFill,
  trim: theme.colors.heading,
  foil: theme.colors.success,
  mist: theme.colors.gold,
};

const SANDS_OF_THE_DUAT_PACK_TINT: PackTint = {
  start: theme.colors.btnEmphasisBg,
  middle: theme.colors.panelFill,
  end: theme.colors.muted,
  trim: theme.colors.gold,
  foil: theme.colors.gold,
  mist: theme.colors.heading,
};

const STARBORNE_PACK_TINT: PackTint = {
  start: '#c8d2dc',
  middle: '#2a2140',
  end: '#7b4bd8',
  trim: '#e8ecf5',
  foil: '#e8ecf5',
  mist: '#c8d2dc',
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
  trimY = 0,
): void {
  const img = scene.textures.get(sceneArtKey).getSourceImage() as CanvasImageSource;
  const sw = (img as { width: number }).width;
  const sh = (img as { height: number }).height;
  ctx.save();
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.clip();
  const scale = Math.max(PACK_W / sw, PACK_H / sh);
  const dw = sw * scale;
  if (trimY > 0) {
    // Sources authored after the 2026-07-18 crimp-band review bake their own
    // plain bars into the art, so the code-stamped crimps landed on top of a
    // second set and up to 18% of the pack face read as letterboxing. Drop the
    // baked bars and fill the height with what is left. The vertical stretch
    // is deliberate: a proportional zoom would crop the ornamental gold frame
    // that gives each pack its identity.
    ctx.drawImage(img, 0, trimY, sw, sh - trimY * 2, (PACK_W - dw) / 2, 0, dw, PACK_H);
  } else {
    ctx.drawImage(img, (PACK_W - dw) / 2, (PACK_H - sh * scale) / 2, dw, sh * scale);
  }
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
  /**
   * Plain bars baked into the source art, in source pixels per edge, measured
   * from the shipped webp. Only the three sets authored under the hardened
   * crimp-band prompt carry them; older sources are 0.
   */
  trimY?: number;
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

export const GOTHIC_MONSTERS_PACK_ART: PackArtOpts = {
  key: 'packart-gothic-monsters',
  sceneArtKey: 'scene-pack-art-gothic-monsters',
  tint: GOTHIC_MONSTERS_PACK_TINT,
  trimY: 73,
};

export const DARK_TALES_PACK_ART: PackArtOpts = {
  key: 'packart-dark-tales',
  sceneArtKey: 'scene-pack-art-dark-tales',
  tint: DARK_TALES_PACK_TINT,
  trimY: 52,
};

export const YOKAI_NIGHTS_PACK_ART: PackArtOpts = {
  key: 'packart-yokai-nights',
  sceneArtKey: 'scene-pack-art-yokai-nights',
  tint: YOKAI_NIGHTS_PACK_TINT,
  trimY: 69,
};

export const SANDS_OF_THE_DUAT_PACK_ART: PackArtOpts = {
  key: 'packart-sands-of-the-duat',
  sceneArtKey: 'scene-pack-art-sands-of-the-duat',
  tint: SANDS_OF_THE_DUAT_PACK_TINT,
  trimY: 63,
};

export const STARBORNE_PACK_ART: PackArtOpts = {
  key: 'packart-starborne',
  sceneArtKey: 'scene-pack-art-starborne',
  tint: STARBORNE_PACK_TINT,
  trimY: 63,
};

export function packTextureForSku(sku: BoosterSku): string {
  if (sku === 'ragnarok') return 'packart-ragnarok';
  if (sku === 'celtic-fae') return 'packart-celtic-fae';
  if (sku === 'arthurian-court') return 'packart-arthurian-court';
  if (sku === 'gothic-monsters') return 'packart-gothic-monsters';
  if (sku === 'dark-tales') return 'packart-dark-tales';
  if (sku === 'yokai-nights') return 'packart-yokai-nights';
  if (sku === 'sands-of-the-duat') return 'packart-sands-of-the-duat';
  if (sku === 'starborne') return 'packart-starborne';
  return 'packart';
}

/** Unit gold price for one booster of the given SKU (shared with PackOpeningScene's re-buy CTAs). */
export function packPriceForSku(sku: BoosterSku): number {
  if (sku === 'ragnarok') return ECONOMY.ragnarokPackPrice;
  if (sku === 'celtic-fae') return ECONOMY.celticFaePackPrice;
  if (sku === 'arthurian-court') return ECONOMY.arthurianCourtPackPrice;
  if (sku === 'gothic-monsters') return ECONOMY.gothicMonstersPackPrice;
  if (sku === 'dark-tales') return ECONOMY.darkTalesPackPrice;
  if (sku === 'yokai-nights') return ECONOMY.yokaiNightsPackPrice;
  if (sku === 'sands-of-the-duat') return ECONOMY.sandsOfTheDuatPackPrice;
  if (sku === 'starborne') return ECONOMY.starbornePackPrice;
  return ECONOMY.packPrice;
}

/** Runtime set bridge until the parallel engine type seam adds the new literal. */
export function packSetForSku(sku: BoosterSku): CardDef['set'] | undefined {
  // Undefined is still the mixed-set fallback for non-shop callers. The Base
  // SKU is explicit so its pool, dupe protection, and pity fallback stay set-scoped.
  return sku === 'base' ? 'base' : (sku as unknown as CardDef['set']);
}

/** The shop order is the source for strip count, release order, and art guard. */
export const BOOSTER_SKUS: ReadonlyArray<{ label: string; textureKey: string; sku: BoosterSku }> = [
  { label: SET_TITLES.base, textureKey: 'packart', sku: 'base' },
  { label: SET_TITLES.ragnarok, textureKey: 'packart-ragnarok', sku: 'ragnarok' },
  { label: SET_TITLES['celtic-fae'], textureKey: 'packart-celtic-fae', sku: 'celtic-fae' },
  { label: SET_TITLES['arthurian-court'], textureKey: 'packart-arthurian-court', sku: 'arthurian-court' },
  { label: SET_TITLES['gothic-monsters'], textureKey: 'packart-gothic-monsters', sku: 'gothic-monsters' },
  { label: SET_TITLES['dark-tales'], textureKey: 'packart-dark-tales', sku: 'dark-tales' },
  { label: SET_TITLES['yokai-nights'], textureKey: 'packart-yokai-nights', sku: 'yokai-nights' },
  { label: SET_TITLES['sands-of-the-duat'], textureKey: 'packart-sands-of-the-duat', sku: 'sands-of-the-duat' },
  { label: SET_TITLES.starborne, textureKey: 'packart-starborne', sku: 'starborne' },
];

/**
 * The shop strip shows only released sets: the Sands of the Duat SKU rides
 * BOOSTER_SKUS (the booster art guard reads that block) but stays hidden until
 * FEATURES.duatLive flips at the shared balance pass. Every strip consumer
 * must index into THIS list, never BOOSTER_SKUS, or the peek/layout indexes
 * disagree with the tiles.
 */
export function visibleBoosterSkus(): ReadonlyArray<{ label: string; textureKey: string; sku: BoosterSku }> {
  return BOOSTER_SKUS.filter((entry) => entry.sku !== 'sands-of-the-duat' || FEATURES.duatLive);
}

/** Only the newest SKU gets launch emphasis. Keep this beside BOOSTER_SKUS. */
export const NEWEST_SKU: BoosterSku = 'starborne';

/**
 * Bake a booster-pack texture once (shared with PackOpeningScene). Real front
 * art when the `sceneArtKey` WebP is on disk, else the procedural pack. The
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
    bakeRealPackBase(scene, ctx, sceneArtKey, opts.trimY ?? 0);
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
  deck: DeckList | DarlingsPrecon;
  price: number;
  theme: boolean;
}

/**
 * "40 spells / 10 Warchest" for a reserve build, "60 cards" for classic. Reads
 * the granted build rather than a hardcoded size so the line stays true when a
 * deck's format changes under it.
 */
function buildSizeCopy(build: GrantedDeckBuild): string {
  return build.format === 'constructed'
    ? `${build.cards.length} cards`
    : `${build.cards.length} spells / ${build.landReserve?.length ?? 0} Warchest`;
}

function isDarlingsPrecon(deck: DeckList | DarlingsPrecon): deck is DarlingsPrecon {
  return 'darlingId' in deck;
}

interface PreviewEntry {
  d: CardDef;
  n: number;
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
  private boosterArrows: { left: ThemedButton; right: ThemedButton } | null = null;
  private qtyChips = new Map<number, ThemedButton>();
  private boosterStripContent: Phaser.GameObjects.Container | null = null;
  private boosterStripZone: Phaser.GameObjects.Zone | null = null;
  private boosterStripLayout: BoosterStripLayout | null = null;
  private boosterStripTiles: { sku: BoosterSku; price: number; tile: Phaser.GameObjects.Container; pack: Phaser.GameObjects.Image }[] = [];
  private boosterStripEdgePeeks: Phaser.GameObjects.Image[] = [];
  private boosterStripIndex = 0;
  private boosterStripOffset = 0;
  private boosterStripPointerId: number | null = null;
  private boosterStripDragStartX = 0;
  private boosterStripDragStartOffset = 0;
  private boosterStripDragging = false;
  private boosterQtyStatus: Phaser.GameObjects.Text | null = null;
  private boosterWheelAccum = 0;
  private boosterWheelLastStepAt = Number.NEGATIVE_INFINITY;

  constructor() {
    super('Shop');
  }

  /** The Decks tab separates ordinary constructed products from Darlings. */
  private deckSections(): { label: string; skus: DeckSku[] }[] {
    return [
      {
        label: 'Standard Decks',
        skus: [
          ...THEME_DECKS
            .filter((deck) => deck.cards.every((id) => {
              const card = CARD_DB[id];
              return Boolean(card && (String(card.set) !== DUAT_SET || isLiveCollectible(card)));
            }))
            .map((deck) => ({ deck, price: ECONOMY.preconPrice, theme: true })),
          ...STARTER_DECKS.map((deck) => ({ deck, price: ECONOMY.starterDeckPrice, theme: false })),
        ],
      },
      {
        label: 'Darling Decks',
        skus: DARLINGS_PRECONS.map((deck) => ({ deck, price: ECONOMY.darlingsPreconPrice, theme: true })),
      },
    ];
  }

  create(data: { tab?: ShopTab } = {}): void {
    // Default tab follows the free-starter claim (user-directed 2026-07-17):
    // while a Claim Free deck is actually on offer the shop opens on the precon
    // decks so a new player lands on it; otherwise it opens on card packs. An
    // explicit data.tab (onboarding routes { tab: 'decks' }) always wins.
    // This asks isFreeClaim rather than re-deriving it: the button also
    // requires the deck to be a starter the player does not already own, so an
    // unspent marker alone opened Decks on a shop with no claim to make.
    const freeClaimAvailable = [...STARTER_DECKS, ...DARLINGS_PRECONS].some((deck) => this.isFreeClaim(deck));
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
    this.boosterStripTiles = [];
    this.boosterStripEdgePeeks = [];
    this.boosterArrows = null;
    this.boosterStripContent = null;
    this.boosterStripZone = null;
    this.boosterStripLayout = null;
    this.boosterStripIndex = 0;
    this.boosterStripOffset = 0;
    this.boosterStripPointerId = null;
    this.boosterStripDragStartX = 0;
    this.boosterStripDragStartOffset = 0;
    this.boosterStripDragging = false;
    this.boosterQtyStatus = null;
    this.boosterWheelAccum = 0;
    this.boosterWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.coordinator = new OverlayCoordinator();
    new Toast(this, { isBlocked: () => this.overlay !== null || this.inspect !== null || this.oddsModal !== null });
    // Deck-preview hotkeys. Keyboard bypasses the modal dims, so every handler
    // self-guards on the overlay/inspect state (the LimitedDraftScene pattern);
    // the KeyboardPlugin is scene-scoped, so shutdown clears these listeners.
    this.input.keyboard?.on('keydown-ESC', this.onEscKey);
    this.input.keyboard?.on('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.on('keydown-RIGHT', this.onInspectNext);
    this.input.on('pointermove', this.onBoosterPointerMove, this);
    this.input.on('pointerup', this.onBoosterPointerUp, this);
    this.input.on('pointerupoutside', this.onBoosterPointerUp, this);
    this.input.on('wheel', this.onBoosterWheel, this);
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
    bakePackArt(this, GOTHIC_MONSTERS_PACK_ART);
    bakePackArt(this, DARK_TALES_PACK_ART);
    bakePackArt(this, YOKAI_NIGHTS_PACK_ART);
    bakePackArt(this, SANDS_OF_THE_DUAT_PACK_ART);
    bakePackArt(this, STARBORNE_PACK_ART);
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

    this.shopInteractiveTargets.push(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
  }

  private readonly onShutdown = (): void => {
    this.closeOverlay();
    this.coordinator.destroy();
    this.input.keyboard?.off('keydown-ESC', this.onEscKey);
    this.input.keyboard?.off('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.off('keydown-RIGHT', this.onInspectNext);
    this.input.off('pointermove', this.onBoosterPointerMove, this);
    this.input.off('pointerup', this.onBoosterPointerUp, this);
    this.input.off('pointerupoutside', this.onBoosterPointerUp, this);
    this.input.off('wheel', this.onBoosterWheel, this);
    this.boosterStripPointerId = null;
    this.boosterStripDragging = false;
    this.boosterWheelAccum = 0;
    this.boosterWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.boosterStripContent = null;
    this.boosterStripZone = null;
    this.boosterStripLayout = null;
    this.boosterQtyStatus = null;
  };

  private underlyingInteractiveTargets(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.shopInteractiveTargets,
      ...this.deckInteractiveTargets,
    ];
  }

  private refreshGold(): void {
    this.goldBadge.refresh(Services.save.data.gold);
    this.refreshSkuAffordability();
  }

  /**
   * Fade (disable) every booster Buy button whose displayed total — unit price
   * times the selected quantity — exceeds the current balance (the Limited
   * Premium-entry pattern: themedButton enabled:false). Re-run on every gold
   * change (refreshGold) and every quantity switch. The pack art itself stays
   * tappable; buyPacks clamps that path to what is affordable and fires the
   * insufficient-funds shake when not even one pack is.
   */
  private refreshSkuAffordability(): void {
    const gold = Services.save.data.gold;
    // A disabled Buy button already reads as "you cannot afford this", so the
    // per-tile price breakdown was seven copies of the same fact. The one
    // global line under the quantity chips covers the rest.
    for (const { btn, price } of this.skuButtons) {
      btn.setEnabled(gold >= price * this.qty);
    }
    this.refreshQtyChips();
    if (this.boosterQtyStatus) {
      const cheapest = Math.min(...this.skuButtons.map(({ price }) => price));
      const total = cheapest * this.qty;
      const short = Math.max(0, total - gold);
      const anyAffordable = this.skuButtons.some(({ price }) => gold >= price * this.qty);
      this.boosterQtyStatus.setText(
        `You need 🪙 ${short} more to buy ${this.qty} ${this.qty === 1 ? 'pack' : 'packs'} at a time.`,
      );
      this.boosterQtyStatus.setVisible(this.skuButtons.length > 0 && !anyAffordable);
    }
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
      { key: 'boosters', label: 'Card Packs' },
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
    group.removeAll(true);
    this.skuButtons = [];
    this.boosterStripTiles = [];
    this.boosterStripEdgePeeks = [];
    this.boosterArrows = null;
    // The SKU list owns order and count. The pure helper receives its length,
    // so adding an eighth or tenth set adds a tile without new layout math.
    const skus = visibleBoosterSkus();
    const layout = boosterStripLayout(skus.length);
    this.boosterStripLayout = layout;
    const content = this.add.container(0, 0);
    this.boosterStripContent = content;
    const zone = this.add
      .zone(
        layout.tapBand.x + layout.tapBand.width / 2,
        layout.tapBand.y + layout.tapBand.height / 2,
        layout.tapBand.width,
        layout.tapBand.height,
      )
      .setInteractive({ useHandCursor: true });
    this.boosterStripZone = zone;
    zone.on('pointerdown', this.onBoosterStripDown, this);
    attachTouchGestures(this, zone, { onTap: this.onBoosterStripTap });
    const maskSource = this.add.graphics();
    maskSource.fillStyle(0xffffff, 1);
    maskSource.fillRect(
      layout.viewport.x,
      layout.viewport.y,
      layout.viewport.width,
      layout.viewport.height,
    );
    maskSource.setVisible(false);
    const stripMask = maskSource.createGeometryMask();
    content.setMask(stripMask);
    group.add([zone, content, maskSource]);
    this.shopInteractiveTargets.push(zone);

    skus.forEach((def, i) => {
      const price = packPriceForSku(def.sku);
      const tile = this.add.container(layout.tileCenters[i] ?? 0, 0);
      const pack = this.buildPackSku(tile, 0, def.label, def.textureKey, price, def.sku, () =>
        this.buyPacks(price, packSetForSku(def.sku), def.sku),
      );
      content.add(tile);
      this.boosterStripTiles.push({ sku: def.sku, price, tile, pack });
    });

    // Keep the one real adjacent SKU at a safe edge when it exists. There is
    // no wraparound art at the first or last snap. The drag zone owns the
    // tap/drag decision.
    const leftPeek = this.add
      .image(layout.tileCenters[0] - layout.tileStride, 380, packTextureForSku(skus[0]?.sku ?? 'base'))
      .setDisplaySize(layout.tileWidth, 300)
      .setAlpha(1)
      .setY(390);
    const rightPeek = this.add
      .image(
        (layout.tileCenters[layout.visibleCount - 1] ?? 0) + layout.tileStride,
        380,
        packTextureForSku(skus[layout.visibleCount]?.sku ?? 'base'),
      )
      .setDisplaySize(layout.tileWidth, 300)
      .setAlpha(1)
      .setY(390);
    leftPeek.setMask(stripMask);
    rightPeek.setMask(stripMask);
    this.boosterStripEdgePeeks = [leftPeek, rightPeek];
    group.add([leftPeek, rightPeek]);

    const leftArrow = themedButton(this, layout.arrowCenters.left, 390, '‹', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setBoosterStripIndex(this.boosterStripIndex - 1),
    });
    const rightArrow = themedButton(this, layout.arrowCenters.right, 390, '›', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setBoosterStripIndex(this.boosterStripIndex + 1),
    });
    group.add([leftArrow.container, rightArrow.container]);
    this.shopInteractiveTargets.push(leftArrow.inputZone, rightArrow.inputZone);
    this.boosterArrows = { left: leftArrow, right: rightArrow };

    this.buildQtySelector(group);
    this.refreshQtyLabels();
    this.refreshSkuAffordability();
    this.setBoosterStripIndex(0, false);
  }

  /** One booster tile: identity, floating product art, and buy action. */
  private buildPackSku(
    group: Phaser.GameObjects.Container,
    x: number,
    label: string,
    textureKey: string,
    price: number,
    sku: BoosterSku,
    onBuy: () => void,
  ): Phaser.GameObjects.Image {
    const title = this.add
      .text(x, 172, label, { fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
      .setOrigin(0.5);
    // Glyph widths are font-fallback-dependent on Windows, so measure the
    // rendered width and shrink-to-fit the 210px product tile rather than
    // sizing by eye.
    const maxTitleWidth = 184;
    if (title.width > maxTitleWidth) title.setScale(maxTitleWidth / title.width);
    const setIcon = this.add
      .image(x - title.displayWidth / 2 - 18, title.y, `seticon-${sku}-sr`)
      .setDisplaySize(22, 22);
    const blurb = this.add
      .text(x, 198, SET_BLURBS[sku], {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    if (blurb.width > 198) blurb.setScale(198 / blurb.width);
    // Pool-first disclosure: slot odds are identical across boosters, so the
    // pool is the real decision variable between tiles.
    const pool = packPoolSummary(Services.save.data, CARD_DB, packSetForSku(sku));
    const poolCaption = this.add
      .text(x, 220, `${pool.ownedDistinct}/${pool.poolSize} Owned`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    // No idle float. Dragging the strip is this screen's motion language now,
    // and a bobbing pack both fought that and pushed the art up under the
    // pool caption (the art top and the caption baseline overlapped by 11px).
    const pack = this.add
      .image(x, 390, textureKey)
      .setDisplaySize(210, 300);
    if (fxPolicy(this).shine && pack.preFX) pack.preFX.addShine(0.5, 0.3, 4);
    // Every pack CTA is gold primary. The newest pack once used 'emphasis'
    // (dark bg, gold text) to stand out, but beside a rail of gold primaries
    // it read as LESS clickable (owner catch, 2026-07-31); the New chip
    // already carries the differentiation.
    const buyBtn = themedButton(this, x, 578, `Buy · 🪙 ${price}`, {
      variant: 'primary',
      minWidth: 178,
      onTap: () => {
        // A mouse pointer can release over a button after dragging from the
        // art. Do not let that release bypass the strip's drag threshold.
        if (!this.boosterStripDragging) onBuy();
      },
    });
    if (sku === NEWEST_SKU) {
      // Left of the caption: the info bubble rides its right edge, and the
      // two collided when both sat on the same side.
      const chip = this.add
        .text(x - 84, 220, 'New', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
        })
        .setOrigin(0.5);
      const chipBg = this.add.graphics();
      chipBg.fillStyle(theme.graphics.rowFillActive, theme.alpha.panel);
      chipBg.fillRoundedRect(chip.x - chip.width / 2 - 6, chip.y - chip.height / 2 - 2, chip.width + 12, chip.height + 4, theme.radius.control);
      chipBg.lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome);
      chipBg.strokeRoundedRect(chip.x - chip.width / 2 - 6, chip.y - chip.height / 2 - 2, chip.width + 12, chip.height + 4, theme.radius.control);
      group.add([chipBg, chip]);
    }
    // The bubble rides the short pool caption, not the title: wide theme
    // titles (Nocturne Manor) pushed a title-anchored bubble to the screen
    // edge. The caption is data-bounded, so the edge stays clear.
    const infoX = x + poolCaption.width / 2 + theme.space(5);
    const infoY = poolCaption.y;
    const infoBg = this.add.graphics();
    infoBg.fillStyle(theme.graphics.rowFill, theme.alpha.panel);
    infoBg.fillCircle(infoX, infoY, theme.space(3));
    infoBg.lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), theme.alpha.chrome);
    infoBg.strokeCircle(infoX, infoY, theme.space(3));
    const info = this.add
      .text(infoX, infoY, 'i', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(info, theme.control.minHitHeight, theme.control.minHitHeight);
    bindTapButton(this, info, () => {
      if (!this.boosterStripDragging) this.showOddsModal(sku, pool);
    });
    this.skuButtons.push({ btn: buyBtn, price });
    this.shopInteractiveTargets.push(buyBtn.inputZone, info);
    group.add([title, setIcon, blurb, poolCaption, infoBg, info, pack, buyBtn.container]);
    return pack;
  }

  /** F10 bulk-buy quantity selector, right-aligned on the tab-bar line. */
  private buildQtySelector(group: Phaser.GameObjects.Container): void {
    // Footer rail, centered under the strip. The header rail put this beside
    // the Decks tab, where it competed with navigation for the eye and had to
    // be shoved sideways to clear the tab. Down here it sits directly under
    // the Buy buttons it multiplies and owns its own row.
    const lbl = this.add
      .text(640, 632, 'Buy quantity', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted })
      .setOrigin(0.5);
    group.add(lbl);
    let x = 536;
    for (const n of [1, 5, 10]) {
      const chip = themedButton(this, x, 664, `×${n}`, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 70,
        onTap: () => {
          this.qty = n;
          this.refreshQtyLabels();
          this.refreshQtyChips();
          this.refreshSkuAffordability();
        },
      });
      this.qtyChips.set(n, chip);
      this.shopInteractiveTargets.push(chip.inputZone);
      group.add(chip.container);
      x += 104;
    }
    // The one surviving affordability line: it explains a whole row of faded
    // Buy buttons, which a per-tile breakdown could only repeat seven times.
    const status = this.add
      .text(640, 694, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.boosterQtyStatus = status;
    group.add(status);
    this.refreshQtyChips();
  }

  private refreshQtyChips(): void {
    const gold = Services.save.data.gold;
    for (const [n, chip] of this.qtyChips) {
      chip.setVariant(n === this.qty ? 'primary' : 'ghost');
      chip.setEnabled(this.skuButtons.some(({ price }) => gold >= price * n));
    }
  }

  private refreshQtyLabels(): void {
    for (const { btn, price } of this.skuButtons) {
      btn.setLabel(this.qty > 1 ? `Buy ×${this.qty} · 🪙 ${price * this.qty}` : `Buy · 🪙 ${price}`);
    }
  }

  private readonly onBoosterStripDown = (pointer: Phaser.Input.Pointer): void => {
    // The drag zone is an input target, but this explicit lease check keeps
    // scene-level pointer handlers honest if an overlay opens mid-gesture.
    if (this.tab !== 'boosters' || this.oddsModal || this.overlay || this.inspect || !this.boosterStripContent) return;
    if (this.boosterStripPointerId !== null) return;
    this.tweens.killTweensOf(this.boosterStripContent);
    this.boosterStripPointerId = pointer.id;
    this.boosterStripDragStartX = pointer.worldX;
    this.boosterStripDragStartOffset = this.boosterStripContent.x;
    this.boosterStripDragging = false;
  };

  private snapBoosterStripToNearest(): void {
    if (!this.boosterStripContent || !this.boosterStripLayout) return;
    this.setBoosterStripIndex(boosterStripIndexForOffset(this.boosterStripLayout, this.boosterStripContent.x));
  }

  private readonly onBoosterPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.tab !== 'boosters' || this.oddsModal || this.overlay || this.inspect) {
      if (this.boosterStripPointerId !== null && this.boosterStripDragging) this.snapBoosterStripToNearest();
      this.boosterStripPointerId = null;
      this.boosterStripDragging = false;
      return;
    }
    if (this.boosterStripPointerId !== pointer.id || !this.boosterStripContent || !this.boosterStripLayout) return;
    const delta = pointer.worldX - this.boosterStripDragStartX;
    if (!this.boosterStripDragging && Math.abs(delta) > TAP_SLOP_PX) this.boosterStripDragging = true;
    if (!this.boosterStripDragging) return;
    const offset = clampBoosterStripOffset(this.boosterStripLayout, this.boosterStripDragStartOffset + delta);
    this.boosterStripContent.x = offset;
    this.updateBoosterStripState(offset);
  };

  private readonly onBoosterStripTap = (pointer: Phaser.Input.Pointer): void => {
    this.handleBoosterStripTap(pointer);
  };

  private handleBoosterStripTap(pointer: Phaser.Input.Pointer): void {
    if (!this.boosterStripContent || !this.boosterStripLayout) return;
    const decision = boosterStripTap(
      this.boosterStripLayout,
      this.boosterStripContent.x,
      pointer.worldX,
      pointer.worldY,
    );
    if (decision.kind === 'scroll') {
      this.setBoosterStripIndex(decision.targetIndex);
      return;
    }
    if (decision.kind !== 'buy') return;
    const tile = this.boosterStripTiles[decision.index];
    if (tile) this.buyPacks(tile.price, packSetForSku(tile.sku), tile.sku);
  }

  private readonly onBoosterPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.boosterStripPointerId !== pointer.id) return;
    const wasDragging = this.boosterStripDragging;
    this.boosterStripPointerId = null;
    if (wasDragging) {
      this.snapBoosterStripToNearest();
      this.boosterStripDragging = false;
      return;
    }
    this.boosterStripDragging = false;
    if (this.tab !== 'boosters' || this.oddsModal || this.overlay || this.inspect || pointer.wasTouch) return;
    this.handleBoosterStripTap(pointer);
  };

  private readonly onBoosterWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: unknown,
    deltaX: number,
    deltaY: number,
  ): void => {
    // Scene-plugin wheel events bypass ModalGuard. The odds modal must freeze
    // the strip, even if Phaser reports the pointer over an underlying tile.
    if (this.tab !== 'boosters' || this.oddsModal || this.overlay || this.inspect || !this.boosterStripLayout) return;
    const viewport = this.boosterStripLayout.viewport;
    if (pointer.worldX < viewport.x || pointer.worldX > viewport.x + viewport.width || pointer.worldY < viewport.y || pointer.worldY > viewport.y + viewport.height) return;
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    if (delta === 0) return;
    this.boosterWheelAccum += delta;
    if (Math.abs(this.boosterWheelAccum) < WHEEL_STEP_THRESHOLD) return;
    const now = this.time.now;
    if (now - this.boosterWheelLastStepAt < WHEEL_STEP_COOLDOWN_MS) return;
    const direction = Math.sign(this.boosterWheelAccum);
    this.boosterWheelAccum -= direction * WHEEL_STEP_THRESHOLD;
    this.boosterWheelLastStepAt = now;
    this.setBoosterStripIndex(this.boosterStripIndex + direction);
  };

  private updateBoosterStripState(offset: number): void {
    if (!this.boosterStripLayout) return;
    this.boosterStripOffset = clampBoosterStripOffset(this.boosterStripLayout, offset);
    this.boosterStripIndex = boosterStripIndexForOffset(this.boosterStripLayout, this.boosterStripOffset);
    const visibility = boosterStripVisibility(this.boosterStripLayout, this.boosterStripOffset);
    for (const [index, tile] of this.boosterStripTiles.entries()) {
      const packVisible = boosterStripTileIsVisible(this.boosterStripLayout, index, this.boosterStripOffset);
      const fullTile = index >= visibility.firstFullIndex && index <= visibility.lastFullIndex;
      for (const child of tile.tile.list) {
        (child as Phaser.GameObjects.GameObject & { setVisible(visible: boolean): unknown }).setVisible(
          child === tile.pack ? packVisible : fullTile,
        );
      }
    }
    for (const [side, edgeIndex] of [visibility.leftPeekIndex, visibility.rightPeekIndex].entries()) {
      const edge = this.boosterStripEdgePeeks[side];
      const sku = edgeIndex === null ? undefined : visibleBoosterSkus()[edgeIndex];
      edge?.setVisible(sku !== undefined);
      if (sku) edge?.setTexture(packTextureForSku(sku.sku));
    }
    // An arrow pointing at nothing is a promise the strip cannot keep, so
    // hide it entirely at each end rather than showing a dead control.
    this.boosterArrows?.left.container.setVisible(this.boosterStripIndex > 0);
    this.boosterArrows?.left.inputZone.setInteractive({ useHandCursor: true });
    if (this.boosterStripIndex <= 0) this.boosterArrows?.left.inputZone.disableInteractive();
    this.boosterArrows?.right.container.setVisible(this.boosterStripIndex < this.boosterStripLayout.maxIndex);
    this.boosterArrows?.right.inputZone.setInteractive({ useHandCursor: true });
    if (this.boosterStripIndex >= this.boosterStripLayout.maxIndex) {
      this.boosterArrows?.right.inputZone.disableInteractive();
    }
  }

  private setBoosterStripIndex(index: number, tween = true): void {
    if (!this.boosterStripContent || !this.boosterStripLayout) return;
    const targetIndex = Math.min(this.boosterStripLayout.maxIndex, Math.max(0, Math.trunc(index)));
    const targetOffset = boosterStripOffsetForIndex(this.boosterStripLayout, targetIndex);
    this.tweens.killTweensOf(this.boosterStripContent);
    if (!tween) {
      this.boosterStripContent.x = targetOffset;
      this.updateBoosterStripState(targetOffset);
      return;
    }
    this.tweens.add({
      targets: this.boosterStripContent,
      x: targetOffset,
      duration: 220,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.updateBoosterStripState(this.boosterStripContent?.x ?? targetOffset),
      onComplete: () => this.updateBoosterStripState(targetOffset),
    });
  }

  private checkpointAchievementUnlocks(): string[] {
    return checkpointAchievements(Services.save.data, CARD_DB).ids;
  }

  /** Buy + open the selected quantity of one SKU (clamped to what you can afford). */
  private buyPacks(unitPrice: number, set: CardDef['set'] | undefined, sku: BoosterSku): void {
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
      const achievementIds = this.checkpointAchievementUnlocks();
      Services.save.flush();
      queueAchievementUnlockToasts(achievementIds);
      this.scene.start('PackOpening', sku === 'base' ? result : { ...result, sku });
    } else {
      const packs = openPacks(save, CARD_DB, rng, n, set);
      const achievementIds = this.checkpointAchievementUnlocks();
      Services.save.flush();
      queueAchievementUnlockToasts(achievementIds);
      this.scene.start('PackOpening', { batch: packs, sku });
    }
  }

  // --- Decks tab ------------------------------------------------------------

  private buildDecksGroup(group: Phaser.GameObjects.Container): void {
    group.removeAll(true); // rebuildable after a purchase
    this.deckInteractiveTargets = [];
    const sections = this.deckSections();
    const layout = deckShopLayout(sections.map((section) => section.skus.length));
    sections.forEach((section, sectionIndex) => {
      if (section.skus.length === 0) return;
      const sectionLayout = layout.sections[sectionIndex];
      group.add(
        this.add
          .text(layout.colLefts[0], sectionLayout.headingY, section.label, {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.gold,
          })
          .setOrigin(0, 0.5),
      );
      section.skus.forEach((sku, i) => {
        const left = layout.colLefts[i % DECK_SHOP_LAYOUT.cols];
        const cy = sectionLayout.rowCenter(Math.floor(i / DECK_SHOP_LAYOUT.cols));
        this.buildDeckPlate(group, sku, left, cy, layout.plateH);
      });
    });
  }

  /** Starter and Zhou Yu grants are independent, one-time FREE claims. */
  private isFreeClaim(deck: DeckList | DarlingsPrecon): boolean {
    const save = Services.save.data;
    if (isDarlingsPrecon(deck)) {
      return (
        deck.id === FREE_DARLINGS_PRECON_ID &&
        !save.darlingsFreeDeckClaimed &&
        !save.decks.some((d) => d.id === deck.id)
      );
    }
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
    const buyX = left + DECK_SHOP_LAYOUT.plateW - 77;
    const previewX = buyX - 120;
    const textLeft = left + 16;
    const textMaxW = previewX - 45 - 10 - textLeft; // stop short of the Preview hit rect

    const plate = panel(this, left, cy - plateH / 2, DECK_SHOP_LAYOUT.plateW, plateH, { alpha: 0.7 });
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
    const pipKeys = info ? info.colors.split('/') : (isDarlingsPrecon(deck) ? [...deck.colors] : []);
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
    const blurbText = (isDarlingsPrecon(deck) ? deck.blurb : (info?.archetype ?? '')) + (owned ? '  ·  Owned' : '');
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
      // Claim Free is always enabled; a paid Buy fades when the balance can't
      // cover it. The grid rebuilds after every purchase (onBuyDeck →
      // buildDecksGroup), which re-evaluates this with the new balance.
      const buy = themedButton(this, buyX, cy, freeClaim ? 'Claim Free ✦' : `Buy · 🪙 ${price}`, {
        variant: 'primary',
        size: 'sm',
        minWidth: 130,
        enabled: freeClaim || Services.save.data.gold >= price,
        onTap: () => this.onBuyDeck(sku),
      });
      this.deckInteractiveTargets.push(buy.inputZone);
      group.add(buy.container);
    } else {
      // An owned row offers Clone Deck instead of a dead "Owned ✓" label
      // (user-directed 2026-09-01): a fresh factory copy into the library, for
      // players who edited the original. The blurb's "· Owned" tag keeps the
      // ownership signal. (The old premium-hero "Set as Hero" toggle that once
      // lived here is gone since 2026-07-11 — per-deck hero cards superseded it.)
      const clone = themedButton(this, buyX, cy, 'Clone Deck', {
        variant: 'ghost',
        size: 'sm',
        minWidth: 130,
        onTap: () => this.onCloneDeck(sku),
      });
      this.deckInteractiveTargets.push(clone.inputZone);
      group.add(clone.container);
    }
  }

  /** Claim/buy a deck. Returns true only when the purchase actually happened. */
  private onBuyDeck(sku: DeckSku): boolean {
    const save = Services.save.data;
    const freeClaim = this.isFreeClaim(sku.deck);
    const purchased = freeClaim
      ? (isDarlingsPrecon(sku.deck)
        ? claimFreeDarlingsDeck(save, CARD_DB, sku.deck)
        : claimFreeStarter(save, CARD_DB, sku.deck))
      : buyThemeDeck(save, CARD_DB, sku.deck, sku.price);
    if (!purchased) {
      this.insufficientFunds();
      return false;
    }
    Sfx.play('coin');
    const achievementIds = this.checkpointAchievementUnlocks();
    Services.save.flush();
    queueAchievementUnlockToasts(achievementIds);
    this.refreshGold();
    this.buildDecksGroup(this.decksGroup); // the claimed/bought row now offers Clone Deck
    return true;
  }

  /** Clone an owned shop deck: a fresh factory copy into the library, free. */
  private onCloneDeck(sku: DeckSku): void {
    const id = cloneShopDeck(Services.save.data, sku.deck);
    if (!id) return;
    Sfx.play('flip');
    Services.save.flush();
    queueToast({
      title: 'Deck cloned',
      body: `${sku.deck.name} copy is in your deck library.`,
    });
  }

  // --- Deck preview overlay -------------------------------------------------

  /** Esc closes the TOP overlay only: inspect, odds, then deck preview. All
   * shells use the coordinator stack so one press cannot close two. */
  private readonly onEscKey = (): void => {
    if (this.coordinator.dispatchEsc().consumed) return;
    if (this.inspect) this.closeInspect();
    else if (this.oddsModal) this.closeOddsModal();
    else if (this.overlay) this.overlay.close();
    else this.scene.start('MainMenu');
  };

  private showOddsModal(sku: BoosterSku, pool: PackPoolSummary): void {
    this.closeOverlay();
    const shell = createOddsModal(this, this.coordinator, sku, pool, this.underlyingInteractiveTargets(), () => {
      if (this.oddsModal === shell) this.oddsModal = null;
    });
    this.oddsModal = shell;
  }

  private readonly onInspectPrev = (): void => {
    if (this.tab === 'boosters' && !this.oddsModal && !this.overlay && !this.inspect) {
      this.setBoosterStripIndex(this.boosterStripIndex - 1);
      return;
    }
    this.stepInspect(-1);
  };

  private readonly onInspectNext = (): void => {
    if (this.tab === 'boosters' && !this.oddsModal && !this.overlay && !this.inspect) {
      this.setBoosterStripIndex(this.boosterStripIndex + 1);
      return;
    }
    this.stepInspect(1);
  };

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
    // Preview the build the purchase actually grants, not the DeckList's
    // classic list: after classic retirement those differ for every starter
    // and theme deck, and the shop must never advertise a deck it will not hand over.
    const build = grantedDeckBuild(deck);
    const counts = new Map<string, number>();
    for (const id of build.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
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
      dismissal: 'tap-only',
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
    const darlings = isDarlingsPrecon(deck);
    const archText = this.add
      .text(0, idY, `${darlings ? deck.blurb : (info?.archetype ?? '')} · ${buildSizeCopy(build)}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const pipKeys = (info?.colors ?? (darlings ? deck.colors.join('/') : '')).split('/').filter(Boolean);
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
    const plays = info?.plays ?? (darlings ? `Your Darling begins in the command zone. ${deck.blurb}` : '');
    if (plays) {
      c.add(
        this.add
          .text(contentCenterX, content.y + 24, plays, {
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
    const stats = computeDeckStats(build.cards, CARD_DB);
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
    const grant = previewDeckGrant(save, CARD_DB, deckProductCardIds(deck));
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
      ? { text: 'Owned ✓ · Clone Deck saves a fresh copy of the original list.', color: theme.colors.success }
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
    } else {
      // Owned in the preview mirrors the row: Clone Deck saves a fresh factory
      // copy. The overlay stays open — the toast is the feedback.
      const clone = themedButton(this, footerRight - 216, footY, 'Clone Deck', {
        variant: 'primary',
        minWidth: 170,
        onTap: () => this.onCloneDeck(sku),
      });
      c.add(clone.container);
      this.previewInteractiveTargets.push(clone.inputZone);
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
      dismissal: 'tap-and-close',
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
