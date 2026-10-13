import Phaser from 'phaser';
import { formatCount, formatGold, goldPrice } from '../ui/goldFormat';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { DECK_INFO } from '../data/deckInfo';
import { DUAT_SET, isLiveCollectible, isLiveSet } from '../data/liveness';
import {
  DARLINGS_PRECONS,
  FREE_DARLINGS_PRECON_ID,
  type DarlingsPrecon,
} from '../data/darlingsPrecons';
import { SET_BLURBS, SET_IDS, type SetId } from '../data/setTitles';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../data/starterDecks';
import { createRngState } from '../engine/rng';
import { def, isType, manaValue, type CardDef } from '../engine/types';
import {
  buyThemeDeck,
  claimFreeDarlingsDeck,
  claimFreeStarter,
  cloneShopDeck,
  shopDeckOwned,
  deckProductCardIds,
  grantedDeckBuild,
  previewDeckGrant,
  spendGold,
  type GrantedDeckBuild,
} from '../meta/Economy';
import { openPack, openPacks } from '../meta/PackOpener';
import { BOOSTER_SKUS, packPriceForSku, type BoosterSku } from '../meta/boosterSkus';
import { packPoolSummary, type PackPoolSummary } from '../meta/packSummary';
import { Services } from '../meta/services';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { attachTouchGestures, bindTapButton, inflateHitArea } from '../platform/gestures';
import { TAP_SLOP_PX } from '../platform/gestureCore';
import { makeCardThumb } from '../ui/CardThumbCache';
import { IS_DEV } from '../platform/env';
import type { SaveData } from '../meta/SaveManager';
import { fitMenuListName, fitMenuName } from '../ui/menuText';
import { bindMenuScroll } from '../ui/menuScroll';
import { COMPACT, compactShell } from '../ui/compactLayout';
import {
  compactButton,
  compactHeader,
  compactIconButton,
  compactPurse,
  compactSegments,
  COMPACT_DRAG_SLOP,
  type CompactButton,
} from '../ui/compactWidgets';
import {
  deckCellAt,
  deckGrid,
  deckGridHeight,
  deckScrollToShow,
  packAt,
  packStrip,
  packStripMaxScroll,
  packStripScrollFor,
  SHOP_COMPACT,
  shopSheet,
  type PackStrip,
  type ShopSheet,
} from '../ui/shopCompact';
import { currentAccessibility } from '../ui/accessibility';
import { ellipsizeText } from '../ui/textFit';
import { bakeUiIcon, uiIconSize, uiIconTinted, type UiIconName } from '../ui/uiIcons';
import { rulesText, typeLine } from '../ui/rulesText';
import { TIER_TEXT_COLOR } from '../ui/binder/FilterBar';
import type { Rect } from '../ui/layout';
import type { MenuScrollHandle } from '../ui/menuScroll';
import { shopPackLayout, shopPreviewListLayout, shopPreviewModalLayout, shopTabCenters, SHOP_STRIP_ARROW_Y, type ShopA11yFixture } from '../ui/shopPresentation';
import { DECK_SHOP_LAYOUT, DECK_SHOP_GRID, deckShopCardLayout } from '../ui/deckShopLayout';
import { CARD_H, CARD_W, CardView } from '../ui/CardView';
import { rarityLine } from '../ui/CardZoomPreview';
import { deckPageCount, deckPageSlice } from '../ui/deckListPaging';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { fxPolicy } from '../ui/fx/FXSupport';
import { modalGuardTarget } from '../ui/Modal';
import { createOddsModal, oddsCopy, oddsSections } from '../ui/OddsModal';
import { OverlayCoordinator } from '../ui/OverlayCoordinator';
import { artMissing } from '../art/artLoader';
import { awaitArt, gateOnArt } from '../ui/artGate';
import { addPortraitArt } from '../ui/portraitArt';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { HEADER_CURRENCY_ANCHOR } from '../ui/layout';
import { sceneTitle } from '../ui/sceneTitle';
import { colorInt, theme } from '../ui/theme';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { queueToast, Toast } from '../ui/Toast';
import { backButton, goldBadge, modalShell, pager, panel, registerSceneBackNavigation, themedButton, type GoldBadge, type ModalShell, type ThemedButton } from '../ui/themeWidgets';
import {
  boosterStripIndexForOffset,
  boosterStripLayout,
  boosterStripOffsetForIndex,
  boosterStripTap,
  boosterStripTileIsFullyVisible,
  boosterStripTileIsVisible,
  boosterStripVisibility,
  clampBoosterStripOffset,
  type BoosterStripLayout,
  type StripLayoutOptions,
} from '../ui/boosterStripLayout';

const PACK_W = 280;
const PACK_H = 400;
const WHEEL_STEP_THRESHOLD = 60;
const WHEEL_STEP_COOLDOWN_MS = 250;
/**
 * A deck commit rebuilds the strip in place, so the bought card re-renders as
 * Clone Deck under the pointer. The second click of a double-click then landed
 * on that new button and cloned the deck the player had only meant to buy.
 * Any deck commit inside this window after another is dropped (the OS
 * double-click interval is 500 ms by default on Windows).
 */
const DECK_COMMIT_REPEAT_GUARD_MS = 500;

export { BOOSTER_SKUS, packPriceForSku, type BoosterSku } from '../meta/boosterSkus';

interface PackTint {
  start: string;
  middle: string;
  end: string;
  trim: string;
  foil: string;
  mist?: string;
}

const BASE_PACK_TINT: PackTint = {
  get start() { return theme.colors.btnEmphasisBg; },
  get middle() { return theme.colors.panelFill; },
  get end() { return theme.colors.dangerBg; },
  get trim() { return theme.colors.gold; },
  get foil() { return theme.colors.gold; },
};

const CELTIC_FAE_PACK_TINT: PackTint = {
  get start() { return theme.colors.success; },
  get middle() { return theme.colors.muted; },
  get end() { return theme.colors.panelFill; },
  get trim() { return theme.colors.heading; },
  get foil() { return theme.colors.heading; },
  get mist() { return theme.colors.success; },
};

const ARTHURIAN_COURT_PACK_TINT: PackTint = {
  get start() { return theme.colors.heading; },
  get middle() { return theme.colors.panelFill; },
  get end() { return theme.colors.muted; },
  get trim() { return theme.colors.gold; },
  get foil() { return theme.colors.heading; },
  get mist() { return theme.colors.gold; },
};

const GOTHIC_MONSTERS_PACK_TINT: PackTint = {
  get start() { return theme.colors.dangerBg; },
  get middle() { return theme.colors.panelFill; },
  get end() { return theme.colors.muted; },
  get trim() { return theme.colors.gold; },
  get foil() { return theme.colors.danger; },
  get mist() { return theme.colors.danger; },
};

const DARK_TALES_PACK_TINT: PackTint = {
  get start() { return theme.colors.btnEmphasisBg; },
  get middle() { return theme.colors.panelFill; },
  get end() { return theme.colors.muted; },
  get trim() { return theme.colors.gold; },
  get foil() { return theme.colors.heading; },
  get mist() { return theme.colors.panelStroke; },
};

const YOKAI_NIGHTS_PACK_TINT: PackTint = {
  get start() { return theme.colors.dangerBg; },
  get middle() { return theme.colors.btnEmphasisBg; },
  get end() { return theme.colors.panelFill; },
  get trim() { return theme.colors.heading; },
  get foil() { return theme.colors.success; },
  get mist() { return theme.colors.gold; },
};

const SANDS_OF_THE_DUAT_PACK_TINT: PackTint = {
  get start() { return theme.colors.btnEmphasisBg; },
  get middle() { return theme.colors.panelFill; },
  get end() { return theme.colors.muted; },
  get trim() { return theme.colors.gold; },
  get foil() { return theme.colors.gold; },
  get mist() { return theme.colors.heading; },
};

const STARBORNE_PACK_TINT: PackTint = {
  start: '#c8d2dc',
  middle: '#2a2140',
  end: '#7b4bd8',
  trim: '#e8ecf5',
  foil: '#e8ecf5',
  mist: '#c8d2dc',
};

const DROWNED_DEEP_PACK_TINT: PackTint = {
  start: '#eef0ea',
  middle: '#16303a',
  end: '#0d1a22',
  trim: '#a8783c',
  foil: '#d6e07c',
  mist: '#7d8590',
};

const FIRST_DAWN_PACK_TINT: PackTint = {
  start: '#efe6d0',
  middle: '#3c4147',
  end: '#26292d',
  trim: '#efe6d0',
  foil: '#f08a5d',
  mist: '#ffc7a0',
};

// Core Set II (dev only until the 2.0 cut): jade, lacquer red and river-gold,
// the Mandate's colours. Procedural until the set's pack art lands.
const CORE_SET_2_PACK_TINT: PackTint = {
  start: '#8fd3b0',
  middle: '#b3202a',
  end: '#2b1a17',
  trim: '#d4a83a',
  foil: '#fff1b0',
  mist: '#3f9a78',
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
  trimColor: string = theme.colors.gold,
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
  // Trim over the cropped edge (the procedural path strokes it inline).
  packRR(ctx, 2, 2, PACK_W - 4, PACK_H - 4, 14);
  ctx.lineWidth = 4;
  ctx.strokeStyle = trimColor;
  ctx.stroke();
}

export interface PackArtOpts {
  key?: string; // texture key (default 'packart')
  sceneArtKey?: string; // real-art source key (default 'scene-pack-art')
  tint?: PackTint; // procedural fallback treatment; real art remains untouched
  realArtTrim?: string; // optional palette-specific edge; older fronts retain gold
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

export const DROWNED_DEEP_PACK_ART: PackArtOpts = {
  key: 'packart-drowned-deep',
  sceneArtKey: 'scene-pack-art-drowned-deep',
  tint: DROWNED_DEEP_PACK_TINT,
  trimY: 63,
};

export const FIRST_DAWN_PACK_ART: PackArtOpts = {
  key: 'packart-first-dawn',
  sceneArtKey: 'scene-pack-art-first-dawn',
  tint: FIRST_DAWN_PACK_TINT,
  trimY: 63,
  realArtTrim: FIRST_DAWN_PACK_TINT.trim,
};

export const CORE_SET_2_PACK_ART: PackArtOpts = {
  key: 'packart-core-set-2',
  sceneArtKey: 'scene-pack-art-core-set-2',
  tint: CORE_SET_2_PACK_TINT,
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
  if (sku === 'drowned-deep') return 'packart-drowned-deep';
  if (sku === 'first-dawn') return 'packart-first-dawn';
  if (sku === 'core-set-2') return 'packart-core-set-2';
  return 'packart';
}

export function packSetForSku(sku: BoosterSku): CardDef['set'] | undefined {
  // Undefined is still the mixed-set fallback for non-shop callers. The Base
  // SKU is explicit so its pool, dupe protection, and pity fallback stay set-scoped.
  return sku;
}

/**
 * The shop strip shows only released sets: the Sands of the Duat SKU rides
 * BOOSTER_SKUS (the booster art guard reads that catalog) but stays hidden until
 * FEATURES.duatLive flips at the shared balance pass. Every strip consumer
 * must index into THIS list, never BOOSTER_SKUS, or the peek/layout indexes
 * disagree with the tiles.
 *
 * Newest first (owner-approved 1.8 polish): the strip opens at index 0, so the
 * launch set and its New chip sit in the first slot where reading starts, and
 * the right arrow walks back through older sets. This matches the Decks tab,
 * which already merchandises newest set to oldest. BOOSTER_SKUS stays in
 * release order, so a set appended there leads the strip automatically.
 */
export function visibleBoosterSkus(): ReadonlyArray<{ label: string; textureKey: string; sku: BoosterSku }> {
  return BOOSTER_SKUS.filter((entry) => isLiveSet(entry.sku)).reverse();
}

/** Only the newest SKU gets launch emphasis. */
export const NEWEST_SKU: BoosterSku = 'first-dawn';

/**
 * Bake a booster-pack texture once (shared with PackOpeningScene). Real front
 * art when the `sceneArtKey` WebP is on disk, else the procedural pack. The
 * crimp bands are re-stamped over BOTH so the pack reads as sealed product,
 * but the face stays text-free. Parameterized so expansion SKUs can bake their
 * own texture treatment.
 */
const packPalettes = new WeakMap<Phaser.Textures.Texture, string>();

export function bakePackArt(scene: Phaser.Scene, opts: PackArtOpts = {}): void {
  const key = opts.key ?? 'packart';
  const sceneArtKey = opts.sceneArtKey ?? 'scene-pack-art';
  const palette = JSON.stringify([opts.tint ?? BASE_PACK_TINT, opts.realArtTrim ?? theme.colors.gold, theme.colors.btnGhostBg]);
  const W = PACK_W;
  const H = PACK_H;
  const tex = scene.textures.exists(key)
    ? scene.textures.get(key) as Phaser.Textures.CanvasTexture
    : scene.textures.createCanvas(key, W, H)!;
  if (packPalettes.get(tex) === palette) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, W, H);

  if (scene.textures.exists(sceneArtKey)) {
    bakeRealPackBase(scene, ctx, sceneArtKey, opts.trimY ?? 0, opts.realArtTrim);
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
  packPalettes.set(tex, palette);
}

type ShopTab = 'boosters' | 'decks';

/**
 * Shop entry data. Pack Opening hands `boosterIndex` back so returning from a
 * reveal lands on the Card Packs strip exactly where the player bought from;
 * every other entry opens the strip on the newest set (index 0).
 */
export interface ShopSceneData {
  tab?: ShopTab;
  boosterIndex?: number;
  a11yFixture?: ShopA11yFixture;
}

/** Sub-tab within the Decks tab (user-directed 2026-09-01): the stacked
 * Standard + Darling sections crowded the band once both rosters grew. */
type DeckSectionKey = 'standard' | 'darlings';

/**
 * Card-style deck strip (user-directed 2026-09-01, experimental): the Decks
 * tab borrows the booster strip's drag mechanics. Two rows of compact product
 * cards share each scrolled COLUMN (the PracticePicker pattern), four columns
 * per page with real neighbor peeks through the mask, drag / arrows / wheel
 * to page. The shared strip math owns clamping, snapping, and column tap
 * classification; the row comes from where in the column the tap landed.
 */
const DECK_GRID_ROWS = DECK_SHOP_GRID.rows;
const DECK_CARD_W = DECK_SHOP_GRID.width;
const DECK_STRIP_TOP = DECK_SHOP_GRID.top;
const DECK_ROW_GAP = DECK_SHOP_GRID.rowGap;
const DECK_COLUMN_H = DECK_SHOP_GRID.height;
const DECK_CARD_H = (DECK_COLUMN_H - DECK_ROW_GAP) / DECK_GRID_ROWS;
const DECK_CARD_ART_H = DECK_SHOP_GRID.artHeight;
const DECK_STRIP_OPTIONS: StripLayoutOptions = {
  visibleCount: DECK_SHOP_GRID.columns,
  tileWidth: DECK_CARD_W,
  tileHeight: DECK_COLUMN_H,
  tileStride: DECK_SHOP_GRID.stride,
  viewport: {
    x: theme.design.safeLeft,
    y: DECK_STRIP_TOP - 8,
    width: theme.design.safeWidth,
    height: DECK_COLUMN_H + 16,
  },
  verticalBand: { y: DECK_STRIP_TOP, height: DECK_COLUMN_H },
  tapBand: { y: DECK_STRIP_TOP, height: DECK_COLUMN_H },
  peekY: DECK_STRIP_TOP,
};

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

interface DeckPreviewModel {
  info: (typeof DECK_INFO)[string] | undefined;
  build: GrantedDeckBuild;
  /** A Darlings precon's Darling, on her own row ahead of the list. */
  darlingEntry: PreviewEntry | null;
  creatures: PreviewEntry[];
  spells: PreviewEntry[];
  lands: PreviewEntry[];
  /** Every distinct card in visual order: the Darling, creatures, spells, lands. */
  entries: PreviewEntry[];
}

/** What a deck's preview lists, desktop and phone alike. */
function deckPreviewModel(deck: DeckList | DarlingsPrecon): DeckPreviewModel {
  const info = DECK_INFO[deck.id];
  // Preview the build the purchase actually grants, not the DeckList's
  // classic list: after classic retirement those differ for every starter
  // and theme deck, and the shop must never advertise a deck it will not hand over.
  const build = grantedDeckBuild(deck);
  const counts = new Map<string, number>();
  for (const id of build.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const all = [...counts.entries()].map(([id, n]) => ({ d: def(CARD_DB, id), n }));
  const sortFn = (a: PreviewEntry, b: PreviewEntry): number =>
    manaValue(a.d.cost) - manaValue(b.d.cost) || a.d.name.localeCompare(b.d.name);
  const creatures = all.filter((e) => isType(e.d, 'creature')).sort(sortFn);
  const spells = all.filter((e) => !isType(e.d, 'creature') && !isType(e.d, 'land')).sort(sortFn);
  const lands = all.filter((e) => isType(e.d, 'land')).sort(sortFn);
  // A Darlings precon's Darling is not in its spell list (she waits in her
  // own zone), so she leads the preview list on her own row and is the
  // deck's signature card; before this the preview never showed her.
  const darlingEntry: PreviewEntry | null = build.darlingId ? { d: def(CARD_DB, build.darlingId), n: 1 } : null;
  return { info, build, darlingEntry, creatures, spells, lands, entries: [...(darlingEntry ? [darlingEntry] : []), ...creatures, ...spells, ...lands] };
}

/** What buying a deck adds to the collection (mirrors grantDeckCards — see Economy). */
function deckGrantText(save: SaveData, deck: DeckList | DarlingsPrecon): string {
  const grant = previewDeckGrant(save, CARD_DB, deckProductCardIds(deck));
  return grant.grantedCopies > 0
    ? `Adds ${grant.grantedCopies} new card copies to your collection; you already own ${grant.ownedCopies} of its ${grant.nonBasicCopies} non-basic copies. Basics are always free.`
    : 'Adds no new copies: your collection already has every card this deck runs.';
}

/** The phone layout's live parts (mobile wave 2); null on desktop. */
interface CompactShopUi {
  main: Rect;
  column: Rect;
  /** The top bar's left (back, title, tabs): a sheet covers it, so it hides. */
  header: Phaser.GameObjects.GameObject[];
  headerZones: Phaser.GameObjects.GameObject[];
  mainLayer: Phaser.GameObjects.Container | null;
  mainZones: Phaser.GameObjects.GameObject[];
  columnLayer: Phaser.GameObjects.Container | null;
  columnZones: Phaser.GameObjects.GameObject[];
  sheet: Phaser.GameObjects.Container | null;
  sheetKind: 'odds' | 'preview' | null;
  sheetZones: Phaser.GameObjects.GameObject[];
  previewSku: DeckSku | null;
  /** The chosen pack and deck tile. */
  pack: number;
  deck: number;
  /** The pack strip, its scroll, and the press that may become a drag. */
  strip: PackStrip | null;
  stripContent: Phaser.GameObjects.Container | null;
  stripOffset: number;
  stripPointer: number | null;
  stripStartX: number;
  stripStartOffset: number;
  stripDragging: boolean;
  deckScroll: MenuScrollHandle | null;
  deckTiles: { outline: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; w: number; h: number }[];
}

const FEATURED_THUMB_SCALE = 0.21;

export class ShopScene extends Phaser.Scene {
  private fixture: ShopA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private get saveData(): SaveData { return this.fixtureSave ?? Services.save.data; }
  private goldBadge!: GoldBadge;
  private tab: ShopTab = 'boosters';
  private deckTab: DeckSectionKey = 'standard';
  private boostersGroup!: Phaser.GameObjects.Container;
  private decksGroup!: Phaser.GameObjects.Container;
  private tabButtons = new Map<ShopTab, ThemedButton>();
  private overlay: ModalShell | null = null;
  /** Card-inspect layered above the deck preview; null when closed. */
  private inspect: ModalShell | null = null;
  /** Index into previewEntries shown by the open inspect; null when closed. */
  private inspectIdx: number | null = null;
  /** Supersedes a pending inspect art wait when another row is tapped. */
  private inspectWaitToken = 0;
  private inspectWaitOwner: Phaser.GameObjects.Container | null = null;
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
  private deckStripContent: Phaser.GameObjects.Container | null = null;
  private deckStripLayout: BoosterStripLayout | null = null;
  private deckStripColumns: Phaser.GameObjects.Container[] = [];
  /** Each column's commit buttons (Buy / Claim Free / Clone Deck), by column. */
  private deckStripControls: Phaser.GameObjects.Container[][] = [];
  private deckStripSkus: DeckSku[] = [];
  /** Scene time of the last deck buy/claim/clone; see DECK_COMMIT_REPEAT_GUARD_MS. */
  private lastDeckCommitAt = Number.NEGATIVE_INFINITY;
  private deckStripArrows: { left: ThemedButton; right: ThemedButton } | null = null;
  private deckStripIndex = 0;
  private deckStripPointerId: number | null = null;
  private deckStripDragStartX = 0;
  private deckStripDragStartOffset = 0;
  private deckStripDragging = false;
  private deckWheelAccum = 0;
  private deckWheelLastStepAt = Number.NEGATIVE_INFINITY;
  private boosterQtyStatus: Phaser.GameObjects.Text | null = null;
  private boosterWheelAccum = 0;
  private boosterWheelLastStepAt = Number.NEGATIVE_INFINITY;
  private compactUi: CompactShopUi | null = null;

  constructor() {
    super('Shop');
  }

  /**
   * The Decks tab separates ordinary constructed products from Darlings.
   * Merchandising order (user-directed 2026-09-01): the original free-claim
   * candidates lead (all five starters; the free Darlings precon), then the
   * expansion products from the NEWEST set back to the oldest — so a new
   * player meets their claim first and the latest expansion sells second.
   */
  private deckSections(): { key: DeckSectionKey; label: string; skus: DeckSku[] }[] {
    // A deck's set: its first featured card's home (a Darlings precon: the
    // Darling's). SET_IDS is release order, so a higher rank is newer; the
    // sort is stable, so same-set decks keep their authored order.
    const setRank = (cardId: string | undefined): number => {
      const card = cardId ? CARD_DB[cardId] : undefined;
      return SET_IDS.indexOf(String(card?.set ?? 'base') as SetId);
    };
    const themeDecks = THEME_DECKS
      .filter((deck) => deck.cards.every((id) => {
        const card = CARD_DB[id];
        return Boolean(card && (card.set !== DUAT_SET || isLiveCollectible(card)));
      }))
      .sort((a, b) => setRank(DECK_INFO[b.id]?.featured?.[0]) - setRank(DECK_INFO[a.id]?.featured?.[0]));
    const darlings = [...DARLINGS_PRECONS].sort((a, b) => {
      const aFree = a.id === FREE_DARLINGS_PRECON_ID ? 1 : 0;
      const bFree = b.id === FREE_DARLINGS_PRECON_ID ? 1 : 0;
      return bFree - aFree || setRank(b.darlingId) - setRank(a.darlingId);
    });
    return [
      {
        key: 'standard',
        label: 'Standard Decks',
        skus: [
          ...STARTER_DECKS.map((deck) => ({ deck, price: ECONOMY.starterDeckPrice, theme: false })),
          ...themeDecks.map((deck) => ({ deck, price: ECONOMY.preconPrice, theme: true })),
        ],
      },
      {
        key: 'darlings',
        label: 'Darling Decks',
        skus: darlings.map((deck) => ({ deck, price: ECONOMY.darlingsPreconPrice, theme: true })),
      },
    ];
  }

  /**
   * The art window on a deck card in the grid: a Darlings precon leads with
   * its Darling, a standard deck with its first signature card. This is the
   * only card art the Shop draws before a modal opens — the Packs tab is baked
   * pack textures and set icons, both scene art PreloadScene already has.
   */
  private deckGridPortraitId(deck: DeckList | DarlingsPrecon): string {
    return isDarlingsPrecon(deck)
      ? deck.darlingId
      : DECK_INFO[deck.id]?.featured?.[0] ?? grantedDeckBuild(deck).cards[0];
  }

  /**
   * The create gate waits on the 19 purchasable decks' grid faces and nothing
   * else (19 distinct art files, measured 2026-09-21). The Shop is the
   * onboarding path — a new player claims the free starter here, right after
   * the tutorial — so gating it on every card in every purchasable deck (427
   * distinct files, ~4.3 s from cold at the loader's ~100 files/s) would put
   * most of the set in front of that claim. `showDeckPreview` waits on its own
   * deck instead: 10-22 files for a starter or theme deck, 79 for a Darlings
   * precon (singleton lists).
   */
  create(data: ShopSceneData = {}): void {
    // Entry data is one-shot. Phaser's Systems.start only replaces
    // settings.data when a start passes some, so a plain scene.start('Shop')
    // (the main menu's button, the navigation helpers) re-delivered the LAST
    // entry: Pack Opening's tab and strip index outlived the trip back to the
    // menu. Clearing it here means a plain entry gets the defaults (newest set
    // first, the claim-aware default tab) while an explicit entry still wins.
    // Nothing in the Shop restarts itself or reads settings.data later.
    this.sys.settings.data = {};
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save) : null;
    this.data.set('a11yReady', false);
    this.data.set('a11yDensity', { actual: [], release: [] });
    const faces = [...STARTER_DECKS, ...THEME_DECKS, ...DARLINGS_PRECONS].map((deck) =>
      this.deckGridPortraitId(deck),
    );
    gateOnArt(this, faces, () => this.build(data));
  }
  private build(data: ShopSceneData): void {
    // Default tab follows the free-starter claim (user-directed 2026-07-17):
    // while a Claim Free deck is actually on offer the shop opens on the precon
    // decks so a new player lands on it; otherwise it opens on card packs. An
    // explicit data.tab (onboarding routes { tab: 'decks' }) always wins.
    // This asks isFreeClaim rather than re-deriving it: the button also
    // requires the deck to be a starter the player does not already own, so an
    // unspent marker alone opened Decks on a shop with no claim to make.
    const freeClaimAvailable = [...STARTER_DECKS, ...DARLINGS_PRECONS].some((deck) => this.isFreeClaim(deck));
    this.tab = data.tab ?? (freeClaimAvailable ? 'decks' : 'boosters');
    // The Decks sub-tab opens where a free claim is waiting, standard first —
    // same onboarding logic as the top-level default above.
    this.deckTab = !STARTER_DECKS.some((deck) => this.isFreeClaim(deck)) &&
      DARLINGS_PRECONS.some((deck) => this.isFreeClaim(deck))
      ? 'darlings'
      : 'standard';
    this.deckTab = this.fixture?.deckTab ?? this.deckTab;
    this.qty = this.fixture?.quantity ?? 1;
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
    this.deckStripContent = null;
    this.deckStripLayout = null;
    this.deckStripColumns = [];
    this.deckStripControls = [];
    this.deckStripSkus = [];
    this.deckStripArrows = null;
    this.deckStripIndex = 0;
    this.deckStripPointerId = null;
    this.deckStripDragStartX = 0;
    this.deckStripDragStartOffset = 0;
    this.deckStripDragging = false;
    this.deckWheelAccum = 0;
    this.deckWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.lastDeckCommitAt = Number.NEGATIVE_INFINITY;
    this.coordinator = new OverlayCoordinator();
    if (sceneStage(this).compact) {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
      this.prepareStage();
      this.buildCompact(data);
      return;
    }
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
    this.input.on('pointermove', this.onDeckPointerMove, this);
    this.input.on('pointerup', this.onDeckPointerUp, this);
    this.input.on('pointerupoutside', this.onDeckPointerUp, this);
    this.input.on('wheel', this.onDeckWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.prepareStage();

    sceneTitle(this, 'Shop');

    this.goldBadge = goldBadge(this, HEADER_CURRENCY_ANCHOR.x, HEADER_CURRENCY_ANCHOR.y, { flashOnChange: true });
    this.refreshGold();

    this.buildTabBar();
    this.boostersGroup = this.add.container(0, 0);
    this.decksGroup = this.add.container(0, 0);
    this.buildBoostersGroup(this.boostersGroup, data.boosterIndex ?? 0);
    this.buildDecksGroup(this.decksGroup, this.fixture?.deckIndex);
    this.setTab(this.tab); // honors the initial tab (onboarding routes to 'decks')

    this.shopInteractiveTargets.push(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
    if (this.fixture?.odds) this.showOddsModal(this.fixture.odds, packPoolSummary(this.saveData, CARD_DB, packSetForSku(this.fixture.odds)));
    const preview = this.deckSections().flatMap((section) => section.skus).find((sku) => sku.deck.id === this.fixture?.deckId);
    if (preview) this.showDeckPreview(preview);
    else this.data.set('a11yReady', true);
  }

  /** The backdrop, the baked pack art, the click and the music: both layouts start here. */
  private prepareStage(): void {
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
    bakePackArt(this, DROWNED_DEEP_PACK_ART);
    bakePackArt(this, FIRST_DAWN_PACK_ART);
    bakePackArt(this, CORE_SET_2_PACK_ART);
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');
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
    this.input.off('pointermove', this.onDeckPointerMove, this);
    this.input.off('pointerup', this.onDeckPointerUp, this);
    this.input.off('pointerupoutside', this.onDeckPointerUp, this);
    this.input.off('wheel', this.onDeckWheel, this);
    this.boosterStripPointerId = null;
    this.boosterStripDragging = false;
    this.boosterWheelAccum = 0;
    this.boosterWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.boosterStripContent = null;
    this.boosterStripZone = null;
    this.boosterStripLayout = null;
    this.boosterQtyStatus = null;
    this.deckStripPointerId = null;
    this.deckStripDragging = false;
    this.deckWheelAccum = 0;
    this.deckWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.deckStripContent = null;
    this.deckStripLayout = null;
    this.deckStripArrows = null;
  };

  private underlyingInteractiveTargets(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.shopInteractiveTargets,
      ...this.deckInteractiveTargets,
    ];
  }

  private refreshGold(): void {
    this.goldBadge.refresh(this.saveData.gold);
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
    const gold = this.saveData.gold;
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
        `You need ${formatGold(short)} more to buy ${this.qty} ${this.qty === 1 ? 'pack' : 'packs'} at a time.`,
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
    const buttons = defs.map((d) => {
      const button = themedButton(this, 0, 96, d.label, {
        variant: 'ghost',
        minWidth: 120,
        look: 'tab',
        onTap: () => this.setTab(d.key),
      });
      this.tabButtons.set(d.key, button);
      this.shopInteractiveTargets.push(button.inputZone);
      return button;
    });
    const centers = shopTabCenters(buttons.map((b) => b.getMeasuredSize().hit.width));
    buttons.forEach((b, i) => b.container.setX(centers[i]));
  }

  private setTab(tab: ShopTab): void {
    this.tab = tab;
    this.boostersGroup.setVisible(tab === 'boosters');
    this.decksGroup.setVisible(tab === 'decks');
    for (const [key, btn] of this.tabButtons) {
      btn.setVariant(key === tab ? 'selected' : 'ghost');
    }
  }

  // --- Boosters tab ---------------------------------------------------------

  private buildBoostersGroup(group: Phaser.GameObjects.Container, initialIndex = 0): void {
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
    const density = this.data.get('a11yDensity');
    density.actual.push({ id: 'boosters', rows: 1, columns: layout.visibleCount, pitch: layout.tileStride, top: layout.viewport.y });
    density.release.push({ id: 'boosters', rows: 1, columns: 4, pitch: 240, top: 142 });
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

    // A shared measured header track keeps wrapped titles from lowering one
    // pack relative to its neighbours. Standard text keeps the release anchors.
    let rowLayout: ReturnType<typeof shopPackLayout> | undefined;
    if (theme.type.h2 > theme.typeBase.h2) {
      const title = this.add.text(0, 0, '', { fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px` });
      const blurb = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px` });
      const pool = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px` });
      title.setWordWrapWidth(184, true);
      blurb.setWordWrapWidth(210, true);
      const titleHeight = Math.max(...skus.map((def) => title.setText(def.label).height));
      const blurbHeight = Math.max(...skus.map((def) => blurb.setText(SET_BLURBS[def.sku]).height));
      rowLayout = shopPackLayout(titleHeight, blurbHeight, pool.height);
      title.destroy(); blurb.destroy(); pool.destroy();
    }
    skus.forEach((def, i) => {
      const price = packPriceForSku(def.sku);
      const tile = this.add.container(layout.tileCenters[i] ?? 0, 0);
      const pack = this.buildPackSku(tile, 0, def.label, def.textureKey, price, def.sku, () =>
        this.buyPacks(price, packSetForSku(def.sku), def.sku), rowLayout,
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
    if (rowLayout) for (const peek of [leftPeek, rightPeek]) {
      peek.setDisplaySize(layout.tileWidth * rowLayout.artHeight / 300, rowLayout.artHeight)
        .setY(rowLayout.artTop + rowLayout.artHeight / 2);
    }
    leftPeek.setMask(stripMask);
    rightPeek.setMask(stripMask);
    this.boosterStripEdgePeeks = [leftPeek, rightPeek];
    group.add([leftPeek, rightPeek]);

    const leftArrow = themedButton(this, layout.arrowCenters.left, SHOP_STRIP_ARROW_Y.boosters, '‹', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setBoosterStripIndex(this.boosterStripIndex - 1),
    });
    const rightArrow = themedButton(this, layout.arrowCenters.right, SHOP_STRIP_ARROW_Y.boosters, '›', {
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
    // setBoosterStripIndex clamps, so a stale index from an older strip length
    // still lands on a legal snap.
    this.setBoosterStripIndex(initialIndex, false);
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
    rowLayout?: ReturnType<typeof shopPackLayout>,
  ): Phaser.GameObjects.Image {
    const title = this.add
      .text(x, 172, label, { fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
      .setOrigin(0.5);
    fitMenuName(title, 184, 3);
    title.setAlign('center');
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
    fitMenuName(blurb, 210, 3);
    blurb.setAlign('center');
    // Pool-first disclosure: slot odds are identical across boosters, so the
    // pool is the real decision variable between tiles.
    const pool = packPoolSummary(this.saveData, CARD_DB, packSetForSku(sku));
    const poolCaption = this.add
      .text(x, 220, `${pool.ownedDistinct}/${pool.poolSize} Owned`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    const packLayout = rowLayout ?? shopPackLayout(title.height, blurb.height, poolCaption.height);
    blurb.setY(packLayout.blurbY);
    poolCaption.setY(packLayout.poolY);
    // No idle float. Dragging the strip is this screen's motion language now,
    // and a bobbing pack both fought that and pushed the art up under the
    // pool caption (the art top and the caption baseline overlapped by 11px).
    const pack = this.add
      .image(x, packLayout.artTop + packLayout.artHeight / 2, textureKey)
      .setDisplaySize(210 * packLayout.artHeight / 300, packLayout.artHeight);
    if (fxPolicy(this).shine && pack.preFX) pack.preFX.addShine(0.5, 0.3, 4);
    // Every pack CTA is gold primary. The newest pack once used 'emphasis'
    // (dark bg, gold text) to stand out, but beside a rail of gold primaries
    // it read as LESS clickable (owner catch, 2026-07-31); the New chip
    // already carries the differentiation.
    const buyBtn = themedButton(this, x, 578, `Buy · ${goldPrice(price)}`, {
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
      group.add(this.shopBadge(x - 84, poolCaption.y, 'New'));
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
    buyBtn.label.setData('a11yKeepVisible', true);
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
    // The chips sit on the shared footer line (theme.design.footerCenterY);
    // at y 664 their hit boxes ran 2px past the title-safe frame, and the
    // status line under them sat outside it entirely (1.8 cut, 2026-09-23).
    const chipY = theme.design.footerCenterY;
    const lbl = this.add
      .text(640, 632, 'Buy quantity', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted })
      .setOrigin(0.5);
    group.add(lbl);
    let x = 536;
    let chipsRight = x;
    for (const n of [1, 5, 10]) {
      const chip = themedButton(this, x, chipY, `×${n}`, {
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
      chipsRight = x + chip.getMeasuredSize().hit.width / 2;
      x += 104;
    }
    // The one surviving affordability line: it explains a whole row of faded
    // Buy buttons, which a per-tile breakdown could only repeat seven times.
    // It reads after the chips on their line, one group gap past the last.
    const status = this.add
      .text(chipsRight + theme.space(4), chipY, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    status.setData('a11yKeepVisible', true);
    this.boosterQtyStatus = status;
    group.add(status);
    this.refreshQtyChips();
  }

  private refreshQtyChips(): void {
    const gold = this.saveData.gold;
    for (const [n, chip] of this.qtyChips) {
      chip.setVariant(n === this.qty ? 'selected' : 'ghost');
      chip.setEnabled(this.skuButtons.some(({ price }) => gold >= price * n));
    }
  }

  private refreshQtyLabels(): void {
    for (const { btn, price } of this.skuButtons) {
      btn.setLabel(this.qty > 1 ? `Buy ×${this.qty} · ${goldPrice(price * this.qty)}` : `Buy · ${goldPrice(price)}`);
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
    return checkpointAchievements(this.saveData, CARD_DB).ids;
  }

  /** Buy + open the selected quantity of one SKU (clamped to what you can afford). */
  private buyPacks(unitPrice: number, set: CardDef['set'] | undefined, sku: BoosterSku): void {
    if (this.fixture) return;
    const save = this.saveData;
    const n = Math.min(this.qty, Math.floor(save.gold / unitPrice));
    if (n < 1) {
      this.insufficientFunds();
      return;
    }
    this.closeOverlay(); // close any open deck preview before leaving the scene
    spendGold(save, unitPrice * n);
    Sfx.play('coin');
    const rng = createRngState(Date.now() & 0x7fffffff);
    // Pack Opening carries the strip position and hands it back on return.
    const shopBoosterIndex = this.boosterStripIndex;
    if (n === 1) {
      const result = openPack(save, CARD_DB, rng, set);
      const achievementIds = this.checkpointAchievementUnlocks();
      Services.save.flush();
      queueAchievementUnlockToasts(achievementIds);
      this.scene.start('PackOpening', { ...result, sku, shopBoosterIndex });
    } else {
      const packs = openPacks(save, CARD_DB, rng, n, set);
      const achievementIds = this.checkpointAchievementUnlocks();
      Services.save.flush();
      queueAchievementUnlockToasts(achievementIds);
      this.scene.start('PackOpening', { batch: packs, sku, shopBoosterIndex });
    }
  }

  // --- Decks tab ------------------------------------------------------------

  private buildDecksGroup(group: Phaser.GameObjects.Container, requestedIndex?: number): void {
    group.removeAll(true); // rebuildable after a purchase or a sub-tab switch
    this.deckInteractiveTargets = [];
    this.deckStripColumns = [];
    this.deckStripControls = [];
    this.deckStripSkus = [];
    this.deckStripArrows = null;
    this.deckStripPointerId = null;
    this.deckStripDragging = false;
    const sections = this.deckSections();
    // Sub-tab bar: one section shown at a time. The pills name the view, so
    // the old in-band gold headings are gone with the crowding they fought.
    const subTabs = sections.map((section) => {
      const button = themedButton(this, 0, DECK_SHOP_LAYOUT.subTabY, section.label, {
        variant: section.key === this.deckTab ? 'selected' : 'ghost',
        size: 'sm',
        look: 'tab',
        minWidth: 160,
        onTap: () => this.setDeckTab(section.key),
      });
      this.deckInteractiveTargets.push(button.inputZone);
      group.add(button.container);
      return button;
    });
    const subTabCenters = shopTabCenters(subTabs.map((b) => b.getMeasuredSize().hit.width));
    subTabs.forEach((b, i) => b.container.setX(subTabCenters[i]));
    const active = sections.find((section) => section.key === this.deckTab) ?? sections[0];
    this.deckStripSkus = active.skus;
    // Open on the first waiting free claim's column so a Claim Free card is
    // never parked off-screen; a rebuild after a purchase keeps its page.
    const freeIdx = active.skus.findIndex((sku) => this.isFreeClaim(sku.deck));
    const columns = Math.ceil(active.skus.length / DECK_GRID_ROWS);
    const layout = boosterStripLayout(
      columns,
      requestedIndex ?? (freeIdx >= 0 ? Math.floor(freeIdx / DECK_GRID_ROWS) : 0),
      DECK_STRIP_OPTIONS,
    );
    this.deckStripLayout = layout;
    const density = this.data.get('a11yDensity');
    density.actual = density.actual.filter((item: { id: string }) => item.id !== 'deck tiles');
    density.release = density.release.filter((item: { id: string }) => item.id !== 'deck tiles');
    density.actual.push({ id: 'deck tiles', rows: DECK_GRID_ROWS, columns: layout.visibleCount, pitch: DECK_CARD_H + DECK_ROW_GAP, top: DECK_STRIP_TOP });
    density.release.push({ id: 'deck tiles', rows: 2, columns: 4, pitch: 256, top: 174 });
    const content = this.add.container(0, 0);
    this.deckStripContent = content;
    const zone = this.add
      .zone(
        layout.tapBand.x + layout.tapBand.width / 2,
        layout.tapBand.y + layout.tapBand.height / 2,
        layout.tapBand.width,
        layout.tapBand.height,
      )
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', this.onDeckStripDown, this);
    attachTouchGestures(this, zone, { onTap: this.onDeckStripTap });
    const maskSource = this.add.graphics();
    maskSource.fillStyle(0xffffff, 1);
    maskSource.fillRect(
      layout.viewport.x,
      layout.viewport.y,
      layout.viewport.width,
      layout.viewport.height,
    );
    maskSource.setVisible(false);
    content.setMask(maskSource.createGeometryMask());
    group.add([zone, content, maskSource]);
    this.deckInteractiveTargets.push(zone);

    // Column-major, the picker pattern: a column stacks two cards and both
    // ride one container, so scrolling walks the order continuously.
    for (let column = 0; column < columns; column++) {
      const tile = this.add.container(layout.tileCenters[column] ?? 0, 0);
      const controls: Phaser.GameObjects.Container[] = [];
      for (let row = 0; row < DECK_GRID_ROWS; row++) {
        const sku = active.skus[column * DECK_GRID_ROWS + row];
        if (!sku) break;
        controls.push(this.buildDeckCard(tile, sku, DECK_STRIP_TOP + row * (DECK_CARD_H + DECK_ROW_GAP)));
      }
      content.add(tile);
      this.deckStripColumns.push(tile);
      this.deckStripControls.push(controls);
    }

    const arrowY = SHOP_STRIP_ARROW_Y.decks;
    const leftArrow = themedButton(this, layout.arrowCenters.left, arrowY, '‹', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setDeckStripIndex(this.deckStripIndex - layout.visibleCount),
    });
    const rightArrow = themedButton(this, layout.arrowCenters.right, arrowY, '›', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setDeckStripIndex(this.deckStripIndex + layout.visibleCount),
    });
    group.add([leftArrow.container, rightArrow.container]);
    this.deckInteractiveTargets.push(leftArrow.inputZone, rightArrow.inputZone);
    this.deckStripArrows = { left: leftArrow, right: rightArrow };
    this.setDeckStripIndex(layout.currentIndex, false);
  }

  private setDeckTab(key: DeckSectionKey): void {
    if (this.deckTab === key) return;
    this.deckTab = key;
    this.buildDecksGroup(this.decksGroup);
  }

  /** Starter and Zhou Yu grants are independent, one-time FREE claims. */
  /**
   * A small gold-bordered tag centred on (x, y): the newest pack's "New" and
   * a free deck's "Free". Its plate is the active row fill, so it reads over
   * art as well as over a panel.
   */
  private shopBadge(x: number, y: number, label: string): Phaser.GameObjects.GameObject[] {
    const chip = this.add
      .text(x, y, label, {
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
    return [chipBg, chip];
  }

  private isFreeClaim(deck: DeckList | DarlingsPrecon): boolean {
    const save = this.saveData;
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

  /**
   * One compact deck product card at a row offset inside its column tile:
   * cover-cropped signature art, name, pips, and the one commit action.
   * Tapping the ART opens the preview (the strip tap classifier routes it);
   * button taps guard against drag-releases. Returns the commit button's
   * container so the strip can take it out of play while its column peeks.
   */
  private buildDeckCard(tile: Phaser.GameObjects.Container, sku: DeckSku, rowTop: number): Phaser.GameObjects.Container {
    const { deck, price, theme: isTheme } = sku;
    // Owned = in the library, OR the player already holds every card in it
    // (a complete collection grants the deck; the row offers Clone, never Buy).
    // The one free starter claim still wins: it also activates a deck and
    // stamps the claim, which a completion grant does not.
    const freeClaim = this.isFreeClaim(deck);
    const owned = !freeClaim && shopDeckOwned(this.saveData, CARD_DB, deck);
    const halfW = DECK_CARD_W / 2;

    const plate = panel(this, -halfW, rowTop, DECK_CARD_W, DECK_CARD_H, { alpha: 0.7 });
    tile.add(plate);
    // Every product keeps its gold Buy (owner, 2026-10-09), so the one action
    // that costs nothing is set apart by its tile instead: a gold frame and a
    // Free tag on the art.
    if (freeClaim) {
      const frame = this.add.graphics();
      frame.lineStyle(theme.outline.state, colorInt(theme.colors.gold), 1);
      frame.strokeRoundedRect(-halfW, rowTop, DECK_CARD_W, DECK_CARD_H, theme.radius.panel);
      tile.add(frame);
    }

    // The art window: a Darlings precon leads with its Darling; a standard
    // deck leads with its first signature card (the preview's featured list).
    // Same helper the create-time art gate waits on, so the two cannot drift.
    const portraitId = this.deckGridPortraitId(deck);
    this.addDeckPortrait(portraitId, 0, rowTop + 8 + DECK_CARD_ART_H / 2, DECK_CARD_W - 20, DECK_CARD_ART_H, tile);
    if (freeClaim) tile.add(this.shopBadge(-halfW + 10 + theme.space(6), rowTop + 8 + theme.space(4), 'Free'));

    const name = this.add
      .text(0, rowTop + DECK_CARD_ART_H + 22, deck.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: isTheme ? theme.colors.gold : theme.colors.heading,
      })
      .setOrigin(0.5);
    // Release shows the full name at 100%; larger text has a base-size floor.
    name.setData('a11yReleaseFullText', deck.name);
    fitMenuListName(name, DECK_CARD_W - 16, theme.type.label, theme.typeBase.label);
    tile.add(name);

    // Color identity renders as mana pips, never letter codes (design-system
    // "Color identity" rule). The archetype line lives in the preview — a
    // 230px card has no honest room for it.
    const info = DECK_INFO[deck.id];
    const pipKeys = info ? info.colors.split('/') : (isDarlingsPrecon(deck) ? [...deck.colors] : []);
    const PIP = 14;
    const pipStep = PIP + 4;
    const pipsX0 = -((pipKeys.length - 1) * pipStep) / 2;
    for (let i = 0; i < pipKeys.length; i++) {
      tile.add(
        this.add
          .image(pipsX0 + i * pipStep, rowTop + deckShopCardLayout(name.height).pipY, `pip-${pipKeys[i]}`)
          .setDisplaySize(PIP, PIP),
      );
    }

    // Claim Free is always enabled; a paid Buy fades when the balance can't
    // cover it. The strip rebuilds after every purchase (onBuyDeck →
    // buildDecksGroup), which re-evaluates this with the new balance. An owned
    // card offers Clone Deck: a fresh factory copy into the library
    // (user-directed 2026-09-01).
    const ctaY = rowTop + deckShopCardLayout(name.height).ctaY;
    const cta = owned
      ? themedButton(this, 0, ctaY, 'Clone Deck', {
          variant: 'ghost',
          size: 'sm',
          minWidth: 160,
          onTap: () => {
            if (!this.deckStripDragging) this.onCloneDeck(sku);
          },
        })
      : themedButton(this, 0, ctaY, freeClaim ? 'Claim Free ✦' : `Buy · ${goldPrice(price)}`, {
          variant: 'primary',
          size: 'sm',
          minWidth: 160,
          enabled: freeClaim || this.saveData.gold >= price,
          onTap: () => {
            if (!this.deckStripDragging) this.onBuyDeck(sku);
          },
        });
    cta.label.setData('a11yKeepVisible', true);
    this.deckInteractiveTargets.push(cta.inputZone);
    tile.add(cta.container);
    return cta.container;
  }

  /** Cover-crop a card's art into the deck card's window (the PracticePicker
   * portrait recipe: scale to cover, crop the window, re-centre the crop). */
  private addDeckPortrait(
    cardId: string,
    x: number,
    y: number,
    targetW: number,
    targetH: number,
    parent: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Image | null {
    try {
      const img = addPortraitArt(this, x, y, cardId, (art) => {
        const scale = Math.max(targetW / art.width, targetH / art.height) * 1.05;
        art.setScale(scale);
        const cropW = Math.min(art.width, targetW / scale);
        const cropH = Math.min(art.height, targetH / scale);
        const cropX = (art.width - cropW) / 2;
        // Bias the window upward so faces sit in frame.
        const cropY = Math.max(
          0,
          Math.min(art.height - cropH, (art.height - cropH) / 2 - (targetH * 0.07) / scale),
        );
        art.setCrop(cropX, cropY, cropW, cropH);
        art.x = x - (cropX + cropW / 2 - art.width / 2) * scale;
        art.y = y - (cropY + cropH / 2 - art.height / 2) * scale;
      });
      if (!img) return null;
      parent.add(img);
      return img;
    } catch {
      // The panel and name remain usable if art is unavailable.
      return null;
    }
  }

  // --- Deck strip drag / tap / paging ---------------------------------------

  private readonly onDeckStripDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.tab !== 'decks' || this.oddsModal || this.overlay || this.inspect || !this.deckStripContent) return;
    if (this.deckStripPointerId !== null) return;
    this.tweens.killTweensOf(this.deckStripContent);
    this.deckStripPointerId = pointer.id;
    this.deckStripDragStartX = pointer.worldX;
    this.deckStripDragStartOffset = this.deckStripContent.x;
    this.deckStripDragging = false;
  };

  private readonly onDeckPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.deckStripPointerId !== pointer.id || !this.deckStripContent || !this.deckStripLayout) return;
    const delta = pointer.worldX - this.deckStripDragStartX;
    if (!this.deckStripDragging && Math.abs(delta) > TAP_SLOP_PX) this.deckStripDragging = true;
    if (!this.deckStripDragging) return;
    const offset = clampBoosterStripOffset(this.deckStripLayout, this.deckStripDragStartOffset + delta);
    this.deckStripContent.x = offset;
    this.updateDeckStripState(offset);
  };

  private readonly onDeckPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.deckStripPointerId !== pointer.id) return;
    const wasDragging = this.deckStripDragging;
    this.deckStripPointerId = null;
    if (wasDragging) {
      this.snapDeckStripToNearest();
      this.deckStripDragging = false;
      return;
    }
    this.deckStripDragging = false;
    if (this.tab !== 'decks' || this.oddsModal || this.overlay || this.inspect || pointer.wasTouch) return;
    this.handleDeckStripTap(pointer);
  };

  private readonly onDeckStripTap = (pointer: Phaser.Input.Pointer): void => {
    this.handleDeckStripTap(pointer);
  };

  private handleDeckStripTap(pointer: Phaser.Input.Pointer): void {
    if (this.deckStripDragging) return;
    if (!this.deckStripContent || !this.deckStripLayout) return;
    const decision = boosterStripTap(
      this.deckStripLayout,
      this.deckStripContent.x,
      pointer.worldX,
      pointer.worldY,
    );
    if (decision.kind === 'scroll') {
      this.setDeckStripIndex(decision.targetIndex);
      return;
    }
    if (decision.kind !== 'buy') return;
    // The shared strip classifies the COLUMN; the row comes from where in the
    // column the tap landed. Only the ART window opens the preview — the name
    // and CTA rows below it belong to the card's own button (which handles
    // its taps itself, so the strip must stay silent there).
    const row = Math.floor((pointer.worldY - DECK_STRIP_TOP) / (DECK_CARD_H + DECK_ROW_GAP));
    if (row < 0 || row >= DECK_GRID_ROWS) return;
    const artTop = DECK_STRIP_TOP + row * (DECK_CARD_H + DECK_ROW_GAP) + 8;
    if (pointer.worldY < artTop || pointer.worldY > artTop + DECK_CARD_ART_H) return;
    const sku = this.deckStripSkus[decision.index * DECK_GRID_ROWS + row];
    if (sku) this.showDeckPreview(sku);
  };

  private readonly onDeckWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: unknown,
    deltaX: number,
    deltaY: number,
  ): void => {
    if (this.tab !== 'decks' || this.oddsModal || this.overlay || this.inspect || !this.deckStripLayout) return;
    const viewport = this.deckStripLayout.viewport;
    if (
      pointer.worldX < viewport.x ||
      pointer.worldX > viewport.x + viewport.width ||
      pointer.worldY < viewport.y ||
      pointer.worldY > viewport.y + viewport.height
    ) return;
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    if (delta === 0) return;
    this.deckWheelAccum += delta;
    if (Math.abs(this.deckWheelAccum) < WHEEL_STEP_THRESHOLD) return;
    const now = this.time.now;
    if (now - this.deckWheelLastStepAt < WHEEL_STEP_COOLDOWN_MS) return;
    const direction = Math.sign(this.deckWheelAccum);
    this.deckWheelAccum -= direction * WHEEL_STEP_THRESHOLD;
    this.deckWheelLastStepAt = now;
    this.setDeckStripIndex(this.deckStripIndex + direction);
  };

  private snapDeckStripToNearest(): void {
    if (!this.deckStripContent || !this.deckStripLayout) return;
    this.setDeckStripIndex(boosterStripIndexForOffset(this.deckStripLayout, this.deckStripContent.x));
  }

  private updateDeckStripState(offset: number): void {
    if (!this.deckStripLayout) return;
    const clamped = clampBoosterStripOffset(this.deckStripLayout, offset);
    this.deckStripIndex = boosterStripIndexForOffset(this.deckStripLayout, clamped);
    // Visibility is per COLUMN: both cards in a column appear and hide together.
    // A column that only peeks past the mask keeps its plate and art, but its
    // commit buttons leave play: the mask hides pixels, not input, so a peeking
    // column's Buy answered taps in the gutter beyond the strip (review
    // 2026-09-23: a tap at x 1250 bought from the column centred at 1295).
    // A hidden container takes its button's zone out of Phaser's hit test.
    for (const [column, tile] of this.deckStripColumns.entries()) {
      tile.setVisible(boosterStripTileIsVisible(this.deckStripLayout, column, clamped));
      const inPlay = boosterStripTileIsFullyVisible(this.deckStripLayout, column, clamped);
      for (const control of this.deckStripControls[column] ?? []) control.setVisible(inPlay);
    }
    // A disabled arrow is also hidden, so the strip never presents a dead end.
    const leftEnabled = this.deckStripIndex > 0;
    const rightEnabled = this.deckStripIndex < this.deckStripLayout.maxIndex;
    this.deckStripArrows?.left.container.setVisible(leftEnabled);
    this.deckStripArrows?.right.container.setVisible(rightEnabled);
    if (leftEnabled) this.deckStripArrows?.left.inputZone.setInteractive({ useHandCursor: true });
    else this.deckStripArrows?.left.inputZone.disableInteractive();
    if (rightEnabled) this.deckStripArrows?.right.inputZone.setInteractive({ useHandCursor: true });
    else this.deckStripArrows?.right.inputZone.disableInteractive();
  }

  private setDeckStripIndex(index: number, tween = true): void {
    if (!this.deckStripContent || !this.deckStripLayout) return;
    const targetIndex = Math.min(this.deckStripLayout.maxIndex, Math.max(0, Math.trunc(index)));
    const targetOffset = boosterStripOffsetForIndex(this.deckStripLayout, targetIndex);
    this.tweens.killTweensOf(this.deckStripContent);
    if (!tween) {
      this.deckStripContent.x = targetOffset;
      this.updateDeckStripState(targetOffset);
      return;
    }
    this.tweens.add({
      targets: this.deckStripContent,
      x: targetOffset,
      duration: 220,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.updateDeckStripState(this.deckStripContent?.x ?? targetOffset),
      onComplete: () => this.updateDeckStripState(targetOffset),
    });
  }

  /** Claim/buy a deck. Returns true only when the purchase actually happened. */
  private onBuyDeck(sku: DeckSku): boolean {
    if (this.fixture) return false;
    if (this.deckCommitTooSoon()) return false;
    const save = this.saveData;
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
    this.lastDeckCommitAt = this.time.now;
    Sfx.play('coin');
    const achievementIds = this.checkpointAchievementUnlocks();
    Services.save.flush();
    queueAchievementUnlockToasts(achievementIds);
    this.refreshGold();
    // Rebuild on the SAME page: the bought card re-renders as owned in place.
    this.rebuildDecks();
    return true;
  }

  /** True inside the double-click window after a deck buy, claim, or clone. */
  private deckCommitTooSoon(): boolean {
    return this.time.now - this.lastDeckCommitAt < DECK_COMMIT_REPEAT_GUARD_MS;
  }

  /**
   * Clone an owned shop deck: a fresh factory copy into the library, free. A
   * deck owned only through a complete collection is granted on its first
   * press (it lands under its own name, as a purchase would); copies follow.
   * Feedback is a toast on the strip; the preview passes `onSaved` instead,
   * because toasts wait behind an open preview and a silent button invited
   * repeat taps that each saved another copy.
   */
  private onCloneDeck(sku: DeckSku, onSaved?: (granted: boolean) => void): void {
    if (this.fixture) return;
    if (this.deckCommitTooSoon()) return;
    const id = cloneShopDeck(this.saveData, CARD_DB, sku.deck);
    if (!id) return;
    this.lastDeckCommitAt = this.time.now;
    Sfx.play('flip');
    Services.save.flush();
    const granted = id === sku.deck.id;
    if (onSaved) onSaved(granted);
    else {
      queueToast({
        title: granted ? 'Deck granted' : 'Deck cloned',
        body: granted
          ? `You already hold every card, so ${sku.deck.name} is in your deck library.`
          : `${sku.deck.name} copy is in your deck library.`,
      });
    }
    // The row re-renders as library-owned after a grant.
    if (granted) this.rebuildDecks();
  }

  /** After a buy, claim or grant: the deck tiles re-render as owned, on the same page. */
  private rebuildDecks(): void {
    if (this.compactUi) {
      this.renderCompactMain();
      this.renderCompactColumn();
    } else this.buildDecksGroup(this.decksGroup, this.deckStripIndex);
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
   * The deck preview draws the signature-card thumbs and its card inspect can
   * open any card in the list, so it waits on this one deck's own build (10-22
   * files, 79 for a Darlings precon) rather than the Shop's create gate
   * waiting on all 427.
   *
   * It opens over a live scene, so the full-screen `gateOnArt` overlay would be
   * wrong here: the wait shows the same loading line inside a modal of the
   * preview's own footprint, which also blocks input the way the preview does,
   * and `awaitArt` drops the build entirely if the scene shuts down first.
   */
  private showDeckPreview(sku: DeckSku): void {
    this.closeOverlay();
    const build = grantedDeckBuild(sku.deck);
    const cards = [...build.cards, ...(build.darlingId ? [build.darlingId] : [])];
    if (artMissing(cards).length === 0) {
      this.buildDeckPreview(sku);
      return;
    }
    let cancelled = false;
    const waiting = modalShell(this, {
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
      onClose: () => {
        cancelled = true;
        if (this.overlay === waiting) this.overlay = null;
      },
    });
    this.overlay = waiting;
    const bounds = waiting.tracks.contentBounds;
    const line = this.add
      .text(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, '', {
        fontFamily: 'Georgia, serif',
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    waiting.container.add(line);
    awaitArt(waiting.container, cards, {
      onWait: (text) => {
        if (line.active) line.setText(text);
      },
      onReady: () => {
        if (cancelled) return;
        waiting.close();
        this.buildDeckPreview(sku);
      },
    });
  }

  /**
   * Inspect a deck before buying: identity + "how it plays", mana curve and
   * composition, what the purchase actually adds to the collection, the full
   * list as tappable rows (tap = card inspect, ←/→ steps), and a footer that
   * states the price/balance consequence before the player commits.
   */
  private buildDeckPreview(sku: DeckSku): void {
    this.closeOverlay();
    const { deck, price } = sku;
    const save = this.saveData;
    const inLibrary = save.decks.some((d) => d.id === deck.id);
    const freeClaim = this.isFreeClaim(deck);
    const owned = !freeClaim && shopDeckOwned(save, CARD_DB, deck);
    const { info, build, darlingEntry, creatures, spells, lands, entries } = deckPreviewModel(deck);
    this.previewEntries = entries;
    const title = this.add.text(0, 0, deck.name, { fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.gold, align: 'center' }).setOrigin(0.5);
    fitMenuName(title, 880, 2);
    const darlings = isDarlingsPrecon(deck);
    const plays = info?.plays ?? (darlings ? `${deck.blurb} Your Darling waits in her own zone until you call her.` : '');
    const playsText = plays ? this.add.text(0, 0, plays, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body,
      wordWrap: { width: 860 }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0) : null;
    const previewLayout = shopPreviewModalLayout(title.height, playsText?.height ?? 0);
    const shell = modalShell(this, {
      ...previewLayout,
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
    // The wait above has settled before this synchronous build. Keep its set
    // on the completed modal too, including when the fast path skipped the
    // waiting shell; closing a preview releases its sources immediately.
    awaitArt(c, this.previewEntries.map((entry) => entry.d.id), { onReady: () => undefined });
    const content = shell.tracks.contentBounds;
    const contentCenterX = content.x + content.width / 2;

    // Header: name, color identity as real mana beads + archetype, how-it-plays.
    const titleY = shell.tracks.centredTitleTrack.y + shell.tracks.centredTitleTrack.height / 2;
    const titleX = shell.tracks.centredTitleTrack.x + shell.tracks.centredTitleTrack.width / 2;
    title.setPosition(titleX, titleY);
    c.add(title);
    const idY = content.y + 8;
    // A Darlings precon has no DECK_INFO: its identity line names the Darling
    // and its blurb leads the how-it-plays line (it used to print twice).
    const archetype = darlingEntry ? `Darling: ${darlingEntry.d.name}` : (info?.archetype ?? '');
    const archText = this.add
      .text(0, idY, `${archetype} · ${buildSizeCopy(build)}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const pipKeys = (info?.colors ?? (darlings ? deck.colors.join('/') : '')).split('/').filter(Boolean);
    const pipSize = 22;
    const pipPitch = pipSize + 4;
    fitMenuName(archText, content.width - pipKeys.length * pipPitch - 24, 2);
    const clusterW = pipKeys.length * pipPitch + 8 + archText.width;
    let px = contentCenterX - clusterW / 2;
    for (const k of pipKeys) {
      c.add(this.add.image(px + pipSize / 2, idY, `pip-${k}`).setDisplaySize(pipSize, pipSize));
      px += pipPitch;
    }
    archText.setPosition(px + 8, idY);
    c.add(archText);
    // "Her own zone" is the glossary's term for where a Darling waits.
    if (playsText) { playsText.setPosition(contentCenterX, content.y + 24); c.add(playsText); }


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

    c.add(sectionLabel(statsX, content.y + previewLayout.headerGrowth + 78, darlingEntry ? 'YOUR DARLING · TAP TO INSPECT' : 'SIGNATURE CARDS · TAP TO INSPECT'));
    const featuredY = content.y + previewLayout.headerGrowth + 140;
    const featuredPitch = 92;
    const featuredX0 = statsX + 38;
    // Only cards the purchase grants can be shown (the list is the source),
    // packed left so a missing pick never leaves a hole in the row.
    const featuredIds = darlingEntry ? [darlingEntry.d.id] : (info?.featured ?? []);
    const featuredIdx = featuredIds
      .map((id) => this.previewEntries.findIndex((entry) => entry.d.id === id))
      .filter((idx) => idx >= 0);
    for (const [slot, idx] of featuredIdx.entries()) {
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

    c.add(sectionLabel(statsX, content.y + previewLayout.headerGrowth + 204, 'MANA CURVE'));
    const curveLabel = sectionLabel(0, 0, 'MANA CURVE');
    const curveGrowth = Math.max(0, curveLabel.height - 14);
    curveLabel.destroy();
    const barBase = content.y + previewLayout.headerGrowth + 258 + curveGrowth;
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
    // Warchest and Darlings builds keep their lands in the Warchest, not the
    // list, so "0 lands" misread every such deck as landless.
    const landsCopy = build.landReserve
      ? `${build.landReserve.length} Warchest lands`
      : `${stats.lands} lands`;
    c.add(
      this.add
        .text(statsX, content.y + previewLayout.headerGrowth + 288 + curveGrowth, `${stats.typeCounts.creature} creatures · ${other} other · ${landsCopy}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
    );
    let pipX = statsX;
    const pipY = content.y + previewLayout.headerGrowth + 318 + curveGrowth;
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
    c.add(sectionLabel(statsX, content.y + previewLayout.headerGrowth + 346 + curveGrowth, 'WHAT YOU GET'));
    const grantText = deckGrantText(save, deck);
    const grantBody = this.add
      .text(statsX, content.y + previewLayout.headerGrowth + 364 + curveGrowth, grantText, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        wordWrap: { width: 310 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    c.add(grantBody);

    // Right block: the complete, bounded list. One page is a stable pair of
    // nine-row columns; the pure shared helpers guarantee no entry is dropped.
    type Category = 'Darling' | 'Creatures' | 'Spells' | 'Lands';
    interface CategorizedEntry {
      entry: PreviewEntry;
      index: number;
      category: Category;
    }
    const categorized: CategorizedEntry[] = this.previewEntries.map((entry, index) => ({
      entry,
      index,
      category: entry === darlingEntry
        ? 'Darling'
        : isType(entry.d, 'creature') ? 'Creatures' : isType(entry.d, 'land') ? 'Lands' : 'Spells',
    }));
    const categoryTotals = new Map<Category, number>([
      ['Darling', darlingEntry ? 1 : 0],
      ['Creatures', creatures.reduce((sum, entry) => sum + entry.n, 0)],
      ['Spells', spells.reduce((sum, entry) => sum + entry.n, 0)],
      ['Lands', lands.reduce((sum, entry) => sum + entry.n, 0)],
    ]);
    const colW = 260;
    const sample = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px` });
    const listLayout = shopPreviewListLayout(sample.height, content.y + previewLayout.headerGrowth + 104, content.y + previewLayout.headerGrowth + content.height - 24);
    sample.destroy();
    const pitch = listLayout.pitch;
    const density = this.data.get('a11yDensity');
    density.actual = density.actual.filter((item: { id: string }) => item.id !== 'preview');
    density.release = density.release.filter((item: { id: string }) => item.id !== 'preview');
    density.actual.push({ id: 'preview', rows: listLayout.rows, columns: 2, pitch, top: content.y + previewLayout.headerGrowth + 104 });
    density.release.push({ id: 'preview', rows: 9, columns: 2, pitch: 24, top: 248 });
    const listX = content.x + 376;
    const secondListX = listX + 295;
    const listTop = content.y + previewLayout.headerGrowth + 104;
    const pages = deckPageCount(categorized.length, listLayout.pageSize);
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
      // Release shows every name in full at 100%. Larger text may abbreviate
      // only after reaching the base caption size; tap opens the full identity.
      name.setData('a11yReleaseFullText', entry.d.name);
      fitMenuListName(name, colW - 76, theme.type.caption, theme.typeBase.caption);
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
      const visible = deckPageSlice(categorized, page, listLayout.pageSize);
      renderColumn(listX, visible.slice(0, listLayout.rows));
      renderColumn(secondListX, visible.slice(listLayout.rows));
      pageControl?.refresh(page, pages);
    };
    if (pages > 1) {
      pageControl = pager(
        this,
        (listX + colW + secondListX) / 2 - 44,
        content.y + previewLayout.headerGrowth + content.height - 4,
        0,
        pages,
        renderPage,
      );
      c.add(pageControl.container);
      this.previewInteractiveTargets.push(pageControl.previous, pageControl.next);
    }
    renderPage(Math.min(pages - 1, this.fixture?.previewPage ?? 0));

    // Footer: the honest decision block — price vs balance before committing —
    // positioned on the shell's own footer track (the old hardcoded y overhung
    // the panel by 2px). Buy stays disabled when unaffordable; the modal only
    // closes after a purchase actually happens.
    const footer = shell.tracks.footerTrack;
    const footY = footer.y + footer.height / 2;
    const footerRight = footer.x + footer.width;
    const affordable = freeClaim || save.gold >= price;
    const footerInfo = owned
      ? {
          text: inLibrary
            ? 'Owned ✓ · Clone Deck saves a fresh copy of the original list.'
            : 'Owned ✓ · You already hold every card in this list. Clone Deck adds it to your library, free.',
          color: theme.colors.success,
        }
      : freeClaim
        ? {
            // The free Darlings deck is its own claim, independent of the
            // starter's; the other Darlings decks always cost their price.
            text: darlings
              ? `✦ Your one free Darling deck. The other Darling decks cost ${formatGold(ECONOMY.darlingsPreconPrice)}.`
              : `✦ Your one free starter. The other starters cost ${formatGold(ECONOMY.starterDeckPrice)} once you claim it.`,
            color: theme.colors.gold,
          }
        : affordable
          ? {
              text: `Price ${formatGold(price)} · Balance ${formatGold(save.gold)} → ${formatGold(save.gold - price)} after`,
              color: theme.colors.body,
            }
          : {
              text: `Price ${formatGold(price)} · Balance ${formatGold(save.gold)} · ${formatGold(price - save.gold)} short`,
              color: theme.colors.danger,
            };
    const footerText = this.add
      .text(footer.x + 16, footY, footerInfo.text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: footerInfo.color,
        wordWrap: { width: 540 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0.5);
    footerText.setData('a11yKeepVisible', true);
    c.add(footerText);
    // Keep a section gap above the decision line without moving its buttons.
    // Only overflowing grant copy scrolls, with complete glyph lines at rest.
    const grantRoom = footerText.y - footerText.height / 2 - theme.space(4) - grantBody.y;
    if (grantBody.height > grantRoom) {
      const lines = grantBody.getWrappedText().length;
      const lineHeight = (grantBody.height - (lines - 1) * grantBody.lineSpacing) / lines;
      const linePitch = lineHeight + grantBody.lineSpacing;
      const visibleLines = Math.max(1, Math.floor((grantRoom + grantBody.lineSpacing) / linePitch));
      const viewport = { x: statsX, y: grantBody.y, width: 326,
        height: visibleLines * linePitch - grantBody.lineSpacing };
      grantBody.setY(0).setData('a11yFullText', grantText).setData('a11yWholeLines', { lineHeight, linePitch });
      const grantColumn = this.add.container(0, 0, [grantBody]);
      c.add(grantColumn);
      bindMenuScroll(this, grantColumn, viewport, grantBody.height, undefined, undefined, linePitch, shell);
    }
    if (!owned) {
      const buy = themedButton(this, footerRight - 216, footY, freeClaim ? 'Claim Free ✦' : `Buy · ${goldPrice(price)}`, {
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
      // copy. The overlay stays open, so the footer line is the feedback (a
      // toast would wait behind the preview) and it counts the copies, so a
      // repeat tap reads as another save rather than a dead button.
      let copiesSaved = 0;
      const clone = themedButton(this, footerRight - 216, footY, 'Clone Deck', {
        variant: 'primary',
        minWidth: 170,
        onTap: () => this.onCloneDeck(sku, (granted) => {
          if (!footerText.active) return;
          if (!granted) copiesSaved++;
          footerText.setText(
            granted
              ? `Saved ✓ · ${deck.name} is in your deck library. Clone Deck again for a copy.`
              : copiesSaved === 1
                ? `Saved ✓ · ${deck.name} copy is in your deck library.`
                : `Saved ✓ · ${copiesSaved} copies of ${deck.name} are in your deck library.`,
          );
          footerText.setColor(theme.colors.success);
        }),
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
    if (this.fixture?.inspectIndex !== undefined) this.showCardInspect(this.fixture.inspectIndex);
    else this.data.set('a11yReady', true);
  }

  /**
   * One card, blown up over the open preview. The preview's own wait already
   * covered every card in its list, so this is a synchronous pass-through in
   * practice; the guard is here so a missed case shows the loading line rather
   * than the resolver's neutral stand-in. The token supersedes a stale wait
   * when the player taps another row before the first one resolves.
   */
  private showCardInspect(idx: number): void {
    this.closeInspect();
    const entry = this.previewEntries[idx];
    if (!entry) return;
    const token = ++this.inspectWaitToken;
    const owner = this.add.container(0, 0).setDepth(theme.depth.inspect);
    this.inspectWaitOwner = owner;
    let line: Phaser.GameObjects.Text | null = null;
    awaitArt(owner, [entry.d.id], {
      onWait: (text) => {
        if (token !== this.inspectWaitToken) return;
        const stage = sceneStage(this);
        line ??= this.add
          .text(stage.content.x + stage.content.width / 2, stage.content.y + stage.content.height / 2, '', {
            fontFamily: 'Georgia, serif',
            fontSize: `${theme.type.h2}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0.5)
          .setDepth(theme.depth.inspect);
        owner.add(line);
        line.setText(text);
      },
      onReady: () => {
        line?.destroy();
        if (token !== this.inspectWaitToken) return;
        if (this.compactUi) this.buildCompactCardInspect(idx);
        else this.buildCardInspect(idx);
        owner.destroy();
        if (this.inspectWaitOwner === owner) this.inspectWaitOwner = null;
      },
    });
  }

  /** Full-card inspect layered above the deck preview; ←/→ steps the list. */
  private buildCardInspect(idx: number): void {
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
    // The pending wait has settled; this shell owns the lease until close.
    awaitArt(c, [entry.d.id], { onReady: () => undefined });
    const content = shell.tracks.contentBounds;
    const contentX = content.x + content.width / 2;
    const contentY = content.y + content.height / 2;
    const inspectScale = Math.min(1.25, (content.height - 12) / CARD_H);
    const view = new CardView(this, contentX, contentY).setScale(inspectScale);
    view.setCard(entry.d, { fx: 'full' });
    c.add(view);
    // The tier as words (the face shows it only as a gem colour), on the
    // shell's otherwise empty title track beside the close button.
    if (!entry.d.token) {
      const title = shell.tracks.titleTrack;
      c.add(
        this.add
          .text(title.x, title.y + title.height / 2, rarityLine(entry.d), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w600,
            color: theme.colors.heading,
            wordWrap: { width: title.width },
          })
          .setOrigin(0, 0.5),
      );
    }
    const footer = shell.tracks.footerTrack;
    c.add(
      this.add
        .text(footer.x + footer.width / 2, footer.y + footer.height / 2, `${entry.n}× in this deck   ·   ←/→ browse the list · Esc closes`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
          wordWrap: { width: footer.width }, align: 'center',
        })
        .setOrigin(0.5),
    );
    this.data.set('a11yReady', true);
  }

  private onPreviewClosed(shell: ModalShell): void {
    if (this.overlay !== shell) return;
    this.closeInspect();
    this.overlay = null;
    this.previewEntries = [];
    this.previewInteractiveTargets = [];
  }

  private closeInspect(): void {
    // Also drops any pending inspect art wait, so a closed preview can never
    // have an inspect open itself a beat later.
    this.inspectWaitToken++;
    this.inspectWaitOwner?.destroy();
    this.inspectWaitOwner = null;
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

  // --- Phone layout (mobile wave 2) ------------------------------------------

  /**
   * The phone Shop (S-Shop-Packs, S-Shop-Decks, S-Shop-Darlings): the tabs in
   * the top bar, the packs or the deck tiles in the main pane, and the
   * chosen product with its one action in the column. The drop rates and the
   * deck preview open as sheets over the main pane and the top bar's left.
   */
  private buildCompact(data: ShopSceneData): void {
    const stage = sceneStage(this);
    const shell = compactShell(stage.content, { back: true });
    const column = shell.column ?? { x: shell.main.x + shell.main.width, y: shell.main.y, width: 0, height: shell.main.height };
    const goBack = (): void => {
      this.scene.start('MainMenu');
    };
    const header = compactHeader(this, shell, { title: 'Shop', onBack: goBack });
    registerSceneBackNavigation(this, () => {
      if (this.compactUi?.sheet) this.closeCompactSheet();
      else goBack();
    }, { coordinator: this.coordinator });
    const purse = compactPurse(this, shell.right.x + shell.right.width, shell.right.y + shell.right.height / 2, () => this.saveData.gold);
    this.goldBadge = purse.badge;
    const tabsX = header.title.x + header.title.width + COMPACT.gap * 2;
    const tabsW = Math.max(0, Math.min(SHOP_COMPACT.tabsW, purse.left - COMPACT.gap * 2 - tabsX));
    const tabs = compactSegments(this, { x: tabsX, y: shell.title.y, width: tabsW, height: COMPACT.touch }, ['Card Packs', 'Decks'],
      this.tab === 'boosters' ? 0 : 1, (i) => this.setCompactTab(i === 0 ? 'boosters' : 'decks'));
    const skus = visibleBoosterSkus();
    // The drop rates open on their own pack, chosen in the column beside them.
    const oddsIndex = skus.findIndex((sku) => sku.sku === this.fixture?.odds);
    const pack = oddsIndex >= 0 ? oddsIndex : Math.min(Math.max(0, Math.trunc(data.boosterIndex ?? 0)), Math.max(0, skus.length - 1));
    this.boosterStripIndex = pack;
    this.compactUi = {
      main: shell.main, column,
      header: [header.back.container, header.title, ...(header.subtitle ? [header.subtitle] : []), tabs.container],
      headerZones: [header.back.inputZone, ...tabs.zones],
      mainLayer: null, mainZones: [], columnLayer: null, columnZones: [],
      sheet: null, sheetKind: null, sheetZones: [], previewSku: null,
      pack, deck: this.compactDeckDefault(this.fixture?.deckIndex),
      strip: null, stripContent: null, stripOffset: 0, stripPointer: null, stripStartX: 0, stripStartOffset: 0, stripDragging: false,
      deckScroll: null, deckTiles: [],
    };
    new Toast(this, {
      isBlocked: () => this.inspect !== null,
      rail: { right: column.x + column.width, top: column.y, width: column.width },
    });
    this.input.keyboard?.on('keydown-LEFT', this.onCompactPrevious);
    this.input.keyboard?.on('keydown-RIGHT', this.onCompactNext);
    this.input.on('pointermove', this.onCompactStripMove, this);
    this.input.on('pointerup', this.onCompactStripUp, this);
    this.input.on('pointerupoutside', this.onCompactStripUp, this);
    this.input.on('wheel', this.onCompactStripWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-LEFT', this.onCompactPrevious);
      this.input.keyboard?.off('keydown-RIGHT', this.onCompactNext);
      this.input.off('pointermove', this.onCompactStripMove, this);
      this.input.off('pointerup', this.onCompactStripUp, this);
      this.input.off('pointerupoutside', this.onCompactStripUp, this);
      this.input.off('wheel', this.onCompactStripWheel, this);
      this.compactUi = null;
    });

    this.renderCompactMain(true);
    this.renderCompactColumn();
    const preview = this.deckSections().flatMap((section) => section.skus).find((sku) => sku.deck.id === this.fixture?.deckId);
    if (this.fixture?.odds) this.openCompactOdds(this.fixture.odds);
    if (preview) this.openCompactPreview(preview);
    else this.data.set('a11yReady', true);
  }

  /** The Decks tab's opening tile: the fixture's, else the first waiting free claim, else the first. */
  private compactDeckDefault(requested?: number): number {
    const skus = this.compactDeckSkus();
    if (requested !== undefined) return Math.min(Math.max(0, Math.trunc(requested)), Math.max(0, skus.length - 1));
    return Math.max(0, skus.findIndex((sku) => this.isFreeClaim(sku.deck)));
  }

  private compactDeckSkus(): DeckSku[] {
    const sections = this.deckSections();
    return (sections.find((section) => section.key === this.deckTab) ?? sections[0]).skus;
  }

  /** Every control under an open card inspect, which guards them. */
  private compactTargets(): Phaser.GameObjects.GameObject[] {
    const ui = this.compactUi;
    return ui ? [...ui.headerZones, ...ui.mainZones, ...ui.columnZones, ...ui.sheetZones] : [];
  }

  private setCompactTab(tab: ShopTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.closeCompactSheet(false);
    this.renderCompactMain(true);
    this.renderCompactColumn();
  }

  private readonly onCompactPrevious = (): void => this.stepCompact(-1);
  private readonly onCompactNext = (): void => this.stepCompact(1);

  /** ←/→: the open card in a preview, else the chosen pack or deck. */
  private stepCompact(delta: number): void {
    const ui = this.compactUi;
    if (!ui) return;
    if (this.inspect) {
      this.stepInspect(delta);
      return;
    }
    if (ui.sheet) return;
    if (this.tab === 'boosters') this.selectCompactPack(ui.pack + delta);
    else this.selectCompactDeck(ui.deck + delta);
  }

  /** The main pane: the pack strip or the deck tiles. `focus` brings the chosen one into view. */
  private renderCompactMain(focus = false): void {
    const ui = this.compactUi;
    if (!ui) return;
    const deckOffset = focus ? null : ui.deckScroll?.offset() ?? null;
    ui.mainLayer?.destroy();
    ui.mainZones = [];
    ui.strip = null;
    ui.stripContent = null;
    ui.stripPointer = null;
    ui.deckScroll = null;
    ui.deckTiles = [];
    const layer = this.add.container(0, 0).setVisible(ui.sheet === null);
    ui.mainLayer = layer;
    if (this.tab === 'boosters') this.drawCompactPacks(layer, focus);
    else this.drawCompactDecks(layer, deckOffset);
  }

  /** The packs across the main pane (S-Shop-Packs): drag to scroll, tap a pack to choose it. */
  private drawCompactPacks(layer: Phaser.GameObjects.Container, focus: boolean): void {
    const ui = this.compactUi!;
    const main = ui.main;
    const type = theme.compactType;
    const skus = visibleBoosterSkus();
    const labelStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body };
    const probe = this.add.text(0, 0, 'Ag', labelStyle);
    const strip = packStrip(main, skus.length, ui.pack, probe.height);
    probe.destroy();
    ui.strip = strip;
    ui.stripOffset = focus
      ? packStripScrollFor(strip, main.width, ui.pack)
      : Math.min(packStripMaxScroll(strip, main.width), ui.stripOffset);
    const content = this.add.container(main.x - ui.stripOffset, 0);
    const maskSource = this.add.graphics().fillStyle(0xffffff, 1).fillRect(main.x, main.y, main.width, main.height).setVisible(false);
    content.setMask(maskSource.createGeometryMask());
    layer.add([maskSource, content]);
    strip.items.forEach((item, i) => {
      const sku = skus[i];
      const art = this.add.image(item.art.x + item.art.width / 2, item.art.y + item.art.height / 2, sku.textureKey)
        .setDisplaySize(item.art.width, item.art.height);
      content.add(art);
      if (i === ui.pack) {
        if (fxPolicy(this).shine && art.preFX) art.preFX.addShine(0.5, 0.3, 4);
        content.add(this.add.graphics()
          .lineStyle(3, colorInt(theme.colors.gold), 1)
          .strokeRoundedRect(item.art.x - 2, item.art.y - 2, item.art.width + 4, item.art.height + 4, theme.radius.control));
      }
      if (item.label) {
        const name = this.add.text(item.art.x + item.art.width / 2, item.label.y, '', labelStyle).setOrigin(0.5, 0);
        ellipsizeText(name, item.label.width, sku.label);
        content.add(name);
      }
      if (sku.sku === NEWEST_SKU) content.add(this.compactChip(item.art.x + 10, item.art.y + 10, 'New'));
    });
    ui.stripContent = content;
    // One target over the pane: a drag scrolls the strip, a tap chooses the pack under it.
    const zone = this.add.zone(main.x + main.width / 2, main.y + main.height / 2, main.width, main.height)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inspect || ui.sheet || ui.stripPointer !== null) return;
      ui.stripPointer = pointer.id;
      ui.stripStartX = pointer.worldX;
      ui.stripStartOffset = ui.stripOffset;
      ui.stripDragging = false;
    });
    layer.add(zone);
    ui.mainZones.push(zone);
  }

  /** A gold-bordered tag with its top-left at (x, y): the newest pack's "New". */
  private compactChip(x: number, y: number, label: string): Phaser.GameObjects.Container {
    const text = this.add.text(10, 3, label, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    const w = text.width + 20;
    const h = text.height + 6;
    const plate = this.add.graphics()
      .fillStyle(theme.graphics.rowFillActive, 0.94).fillRoundedRect(0, 0, w, h, h / 2)
      .lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), 1).strokeRoundedRect(0, 0, w, h, h / 2);
    return this.add.container(x, y, [plate, text]);
  }

  private setCompactStripOffset(offset: number): void {
    const ui = this.compactUi;
    if (!ui?.strip || !ui.stripContent) return;
    ui.stripOffset = Math.min(packStripMaxScroll(ui.strip, ui.main.width), Math.max(0, offset));
    ui.stripContent.x = ui.main.x - ui.stripOffset;
  }

  private readonly onCompactStripMove = (pointer: Phaser.Input.Pointer): void => {
    const ui = this.compactUi;
    if (!ui || ui.stripPointer !== pointer.id) return;
    const delta = pointer.worldX - ui.stripStartX;
    if (!ui.stripDragging && Math.abs(delta) > COMPACT_DRAG_SLOP) ui.stripDragging = true;
    if (ui.stripDragging) this.setCompactStripOffset(ui.stripStartOffset - delta);
  };

  private readonly onCompactStripUp = (pointer: Phaser.Input.Pointer): void => {
    const ui = this.compactUi;
    if (!ui || ui.stripPointer !== pointer.id) return;
    ui.stripPointer = null;
    if (ui.stripDragging || !ui.strip || this.inspect || ui.sheet) {
      ui.stripDragging = false;
      return;
    }
    const index = packAt(ui.strip, pointer.worldX - ui.main.x + ui.stripOffset);
    if (index !== null) this.selectCompactPack(index);
  };

  private readonly onCompactStripWheel = (
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    deltaX: number,
    deltaY: number,
  ): void => {
    const ui = this.compactUi;
    if (!ui?.strip || this.tab !== 'boosters' || ui.sheet || this.inspect) return;
    const main = ui.main;
    if (pointer.worldX < main.x || pointer.worldX > main.x + main.width || pointer.worldY < main.y || pointer.worldY > main.y + main.height) return;
    this.setCompactStripOffset(ui.stripOffset + (Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY));
  };

  private selectCompactPack(index: number): void {
    const ui = this.compactUi;
    const count = visibleBoosterSkus().length;
    if (!ui || index < 0 || index >= count || index === ui.pack) return;
    ui.pack = index;
    this.boosterStripIndex = index; // Pack Opening hands it back
    this.renderCompactMain(true);
    this.renderCompactColumn();
  }

  /** The deck tiles (S-Shop-Decks): art, name, pips and price; tap one to choose it. */
  private drawCompactDecks(layer: Phaser.GameObjects.Container, offset: number | null): void {
    const ui = this.compactUi!;
    const main = ui.main;
    const type = theme.compactType;
    const save = this.saveData;
    const skus = this.compactDeckSkus();
    const nameStyle = { fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading };
    const lineStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading };
    const pip = Math.round(type.body * 1.3);
    const probeName = this.add.text(0, 0, 'Ag', nameStyle);
    const probeLine = this.add.text(0, 0, 'Ag', lineStyle);
    const grid = deckGrid(main.width, probeName.height, Math.max(pip, probeLine.height), currentAccessibility().textScale >= 1.3);
    probeName.destroy();
    probeLine.destroy();
    const S = SHOP_COMPACT;
    const list = this.add.container(0, main.y);
    layer.add(list);
    skus.forEach((sku, i) => {
      const { deck, price } = sku;
      const freeClaim = this.isFreeClaim(deck);
      const owned = !freeClaim && shopDeckOwned(save, CARD_DB, deck);
      const tile = this.add.container(main.x + (i % grid.columns) * grid.pitchX, Math.floor(i / grid.columns) * grid.pitchY);
      list.add(tile);
      tile.add(this.add.graphics()
        .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(0, 0, grid.tileW, grid.tileH, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(0, 0, grid.tileW, grid.tileH, theme.radius.panel));
      this.addDeckPortrait(this.deckGridPortraitId(deck), grid.tileW / 2, S.deckPad + grid.artH / 2, grid.tileW - S.deckPad * 2, grid.artH, tile);
      const name = this.add.text(S.deckPad, grid.nameY, '', nameStyle);
      ellipsizeText(name, grid.tileW - S.deckPad * 2, deck.name);
      tile.add(name);
      const info = DECK_INFO[deck.id];
      const pipKeys = info ? info.colors.split('/') : (isDarlingsPrecon(deck) ? [...deck.colors] : []);
      pipKeys.forEach((key, k) => {
        tile.add(this.add.image(S.deckPad + pip / 2 + k * (pip + 3), grid.lineY, `pip-${key}`).setDisplaySize(pip, pip));
      });
      // The price, or what stands in for it, at the line's right end.
      const [icon, text, color] = freeClaim
        ? ['star', 'Free', theme.colors.gold] as const
        : owned ? ['check', 'Owned', theme.colors.success] as const : ['gold', formatCount(price), theme.colors.heading] as const;
      const label = this.add.text(grid.tileW - S.deckPad, grid.lineY, text, { ...lineStyle, color }).setOrigin(1, 0.5);
      const iconSize = uiIconSize(type.body);
      const mark = this.add.image(label.x - label.width - 5 - iconSize / 2, grid.lineY, bakeUiIcon(this, icon)).setDisplaySize(iconSize, iconSize);
      if (uiIconTinted(icon)) mark.setTint(colorInt(color));
      tile.add([label, mark]);
      const outline = this.add.graphics();
      tile.add(outline);
      ui.deckTiles.push({ outline, name, w: grid.tileW, h: grid.tileH });
    });
    this.drawCompactDeckSelection();
    const scroll = bindMenuScroll(this, list, main, deckGridHeight(grid, skus.length), () => ui.sheet !== null, [], 0, undefined,
      offset ?? deckScrollToShow(grid, ui.deck, main.height, 0));
    ui.deckScroll = scroll;
    const zone = this.add.zone(main.x + main.width / 2, main.y + main.height / 2, main.width, main.height)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.inspect || ui.sheet) return;
      const index = deckCellAt(grid, skus.length, pointer.worldX - main.x, pointer.worldY - main.y + scroll.offset());
      if (index !== null) this.selectCompactDeck(index);
    });
    layer.add(zone);
    ui.mainZones.push(zone);
  }

  /** The chosen tile: a gold outline, a check on its corner, and its name in gold. */
  private drawCompactDeckSelection(): void {
    const ui = this.compactUi;
    if (!ui) return;
    ui.deckTiles.forEach((tile, i) => {
      const chosen = i === ui.deck;
      tile.name.setColor(chosen ? theme.colors.gold : theme.colors.heading);
      tile.outline.clear();
      if (!chosen) return;
      const r = 11;
      tile.outline
        .lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(1, 1, tile.w - 2, tile.h - 2, theme.radius.panel)
        .fillStyle(colorInt(theme.colors.gold), 1).fillCircle(tile.w - r - 4, r + 4, r)
        .lineStyle(2.5, colorInt(theme.colors.onGold), 1).beginPath()
        .moveTo(tile.w - r - 4 - 5, r + 4).lineTo(tile.w - r - 4 - 1.5, r + 4 + 3.5).lineTo(tile.w - r - 4 + 5, r + 4 - 4).strokePath();
    });
  }

  private selectCompactDeck(index: number): void {
    const ui = this.compactUi;
    if (!ui || index < 0 || index >= this.compactDeckSkus().length || index === ui.deck) return;
    ui.deck = index;
    this.drawCompactDeckSelection();
    this.renderCompactColumn();
  }

  /** The column: the chosen pack or deck and its action, or the open preview's decision. */
  private renderCompactColumn(): void {
    const ui = this.compactUi;
    if (!ui) return;
    ui.columnLayer?.destroy();
    ui.columnZones = [];
    const layer = this.add.container(0, 0);
    ui.columnLayer = layer;
    if (ui.sheetKind === 'preview' && ui.previewSku) this.drawCompactPreviewColumn(layer, ui.previewSku);
    else if (this.tab === 'boosters') this.drawCompactPackColumn(layer);
    else this.drawCompactDeckColumn(layer);
  }

  /**
   * A row that opens more (Drop rates, Preview deck): its icon, a title over
   * an optional caption, and a chevron. Returns its height.
   */
  private compactLinkRow(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    icon: UiIconName,
    title: string,
    caption: string | null,
    active: boolean,
    onTap: () => void,
  ): number {
    const type = theme.compactType;
    const iconSize = Math.round(type.body * 1.5);
    const chevron = Math.round(type.body * 0.9);
    const textX = x + 14 + iconSize + 12;
    const textW = Math.max(0, x + width - 14 - chevron - COMPACT.gap - textX);
    const head = this.add.text(textX, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    });
    ellipsizeText(head, textW, title);
    const sub = caption === null ? null : this.add.text(textX, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    });
    if (sub && caption !== null) ellipsizeText(sub, textW, caption);
    const h = Math.max(COMPACT.touch, head.height + (sub?.height ?? 0) + 14);
    const top = y + (h - head.height - (sub?.height ?? 0)) / 2;
    head.setY(top);
    sub?.setY(top + head.height);
    const plate = this.add.graphics()
      .fillStyle(active ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
      .fillRoundedRect(x, y, width, h, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, active ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, active ? 1 : theme.alpha.chrome)
      .strokeRoundedRect(x, y, width, h, theme.radius.panel);
    const mark = this.add.image(x + 14 + iconSize / 2, y + h / 2, bakeUiIcon(this, icon)).setDisplaySize(iconSize, iconSize)
      .setTint(colorInt(theme.colors.heading));
    const arrow = this.add.image(x + width - 14 - chevron / 2, y + h / 2, bakeUiIcon(this, 'chevron')).setDisplaySize(chevron, chevron)
      .setTint(colorInt(theme.colors.muted));
    const zone = this.add.zone(x + width / 2, y + h / 2, width, h).setInteractive({ useHandCursor: true });
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) <= COMPACT_DRAG_SLOP) onTap();
    });
    layer.add([plate, mark, head, ...(sub ? [sub] : []), arrow, zone]);
    this.compactUi?.columnZones.push(zone);
    return h;
  }

  /** A note with its icon on the first line: a free claim, an owned deck, a shortfall. */
  private compactNote(
    x: number,
    y: number,
    width: number,
    icon: UiIconName,
    text: string,
    color: string,
  ): { objects: Phaser.GameObjects.GameObject[]; height: number; body: Phaser.GameObjects.Text } {
    const size = theme.compactType.body;
    const iconSize = uiIconSize(size);
    const body = this.add.text(x + iconSize + COMPACT.gap, y, text, {
      fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width: Math.max(0, width - iconSize - COMPACT.gap) }, lineSpacing: 2,
    });
    const lines = Math.max(1, body.getWrappedText().length);
    const firstLine = (body.height - body.lineSpacing * (lines - 1)) / lines;
    const mark = this.add.image(x + iconSize / 2, y + firstLine / 2, bakeUiIcon(this, icon)).setDisplaySize(iconSize, iconSize);
    if (uiIconTinted(icon)) mark.setTint(colorInt(color));
    return { objects: [mark, body], height: body.height, body };
  }

  /**
   * Shorten `text` word by word, with an ellipsis, until it is no taller than
   * `maxH`; hide it when not even one line fits. The full words are one tap
   * away (the deck preview, the drop rates).
   */
  private trimToHeight(text: Phaser.GameObjects.Text, maxH: number): void {
    if (text.height <= maxH) return;
    const words = text.text.split(' ');
    let lo = 0;
    let hi = words.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      text.setText(`${words.slice(0, mid).join(' ')}…`);
      if (text.height <= maxH) lo = mid;
      else hi = mid - 1;
    }
    if (lo === 0) text.setText('').setVisible(false);
    else text.setText(`${words.slice(0, lo).join(' ').replace(/[,.;:]$/, '')}…`);
  }

  /** The packs column (S-Shop-Packs): the pack's name and blurb, Drop rates, the quantity and Buy. */
  private drawCompactPackColumn(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const gold = this.saveData.gold;
    const sku = visibleBoosterSkus()[ui.pack];
    if (!sku) return;
    const price = packPriceForSku(sku.sku);
    const quantities = [1, 5, 10];
    const qtyIndex = Math.max(0, quantities.indexOf(this.qty));
    this.qty = quantities[qtyIndex];
    const total = price * this.qty;

    // From the foot up: Buy, the quantity, its caption.
    const buyRect = { x: col.x, y: col.y + col.height - COMPACT.touch, width: col.width, height: COMPACT.touch };
    const buy = compactButton(this, buyRect, this.qty > 1 ? `Buy ×${this.qty} · ${goldPrice(total)}` : `Buy · ${goldPrice(price)}`, {
      variant: 'primary',
      onTap: () => this.buyPacks(price, packSetForSku(sku.sku), sku.sku),
    });
    buy.setEnabled(gold >= total);
    const qtyRect = { x: col.x, y: buyRect.y - COMPACT.gap - COMPACT.touch, width: col.width, height: COMPACT.touch };
    const qty = compactSegments(this, qtyRect, quantities.map((n) => `×${n}`), qtyIndex, (i) => {
      this.qty = quantities[i];
      this.renderCompactColumn();
    });
    // Not even one pack: the whole buying block reads as out of reach (S-Shop-Packs-Short).
    if (gold < price) qty.container.setAlpha(0.6);
    const caption = this.add.text(col.x, 0, 'Buy quantity', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted });
    caption.setY(qtyRect.y - 4 - caption.height);
    layer.add([buy.container, qty.container, caption]);
    ui.columnZones.push(buy.inputZone, ...qty.zones);

    // From the top down: the name, the blurb, Drop rates, and the shortfall.
    const room = caption.y - COMPACT.gap - col.y;
    const name = this.add.text(col.x, col.y, sku.label, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      wordWrap: { width: col.width },
    });
    const blurb = this.add.text(col.x, 0, SET_BLURBS[sku.sku], {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: col.width }, lineSpacing: 2,
    });
    const pool = packPoolSummary(this.saveData, CARD_DB, packSetForSku(sku.sku));
    const rowLayer = this.add.container(0, 0);
    const rowH = this.compactLinkRow(rowLayer, col.x, 0, col.width, 'info', 'Drop rates', `${pool.ownedDistinct}/${pool.poolSize} Owned`,
      ui.sheetKind === 'odds', () => {
        if (ui.sheetKind === 'odds') this.closeCompactSheet();
        else this.openCompactOdds(sku.sku);
      });
    const short = gold < total
      ? this.compactNote(col.x, 0, col.width, 'info', `You need ${formatGold(total - gold)} more to buy ${this.qty} ${this.qty === 1 ? 'pack' : 'packs'} at a time.`, theme.colors.body)
      : null;
    const fixed = name.height + 4 + COMPACT.gap + rowH + (short ? COMPACT.gap + short.height : 0);
    this.trimToHeight(blurb, room - fixed);
    blurb.setY(name.y + name.height + 4);
    const rowY = (blurb.visible ? blurb.y + blurb.height : name.y + name.height) + COMPACT.gap;
    rowLayer.setY(rowY);
    layer.add([name, blurb, rowLayer]);
    if (short) {
      const shift = rowY + rowH + COMPACT.gap;
      for (const object of short.objects) (object as Phaser.GameObjects.Image).y += shift;
      layer.add(short.objects);
    }
  }

  /** The decks column (S-Shop-Decks, S-Shop-Darlings): the tabs, the chosen deck, Preview deck and its action. */
  private drawCompactDeckColumn(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const save = this.saveData;
    const sections = this.deckSections();
    // At the largest text the full names outgrow their halves; the short ones still say which is which.
    const probe = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600 });
    const fits = sections.every((section) => probe.setText(section.label).width <= (col.width - 8) / sections.length - 12);
    probe.destroy();
    const tabs = compactSegments(this, { x: col.x, y: col.y, width: col.width, height: COMPACT.touch },
      sections.map((section) => (fits ? section.label : section.label.replace(/ Decks$/, ''))),
      Math.max(0, sections.findIndex((section) => section.key === this.deckTab)), (i) => {
        const key = sections[i]?.key;
        if (!key || key === this.deckTab) return;
        this.deckTab = key;
        ui.deck = this.compactDeckDefault();
        this.renderCompactMain(true);
        this.renderCompactColumn();
      });
    layer.add(tabs.container);
    ui.columnZones.push(...tabs.zones);
    const sku = this.compactDeckSkus()[ui.deck];
    if (!sku) return;
    const { deck, price } = sku;
    const freeClaim = this.isFreeClaim(deck);
    const owned = !freeClaim && shopDeckOwned(save, CARD_DB, deck);
    const affordable = freeClaim || save.gold >= price;

    // From the foot up: the action, then Preview deck.
    const actionRect = { x: col.x, y: col.y + col.height - COMPACT.touch, width: col.width, height: COMPACT.touch };
    const action = this.compactDeckAction(actionRect, sku, owned, freeClaim, affordable);
    layer.add(action.container);
    ui.columnZones.push(action.inputZone);
    const rowLayer = this.add.container(0, 0);
    const rowH = this.compactLinkRow(rowLayer, col.x, 0, col.width, 'eye', 'Preview deck', null, false, () => this.openCompactPreview(sku));
    const rowY = actionRect.y - COMPACT.gap - rowH;
    rowLayer.setY(rowY);
    layer.add(rowLayer);

    // From the tabs down: the name, the identity line, the archetype, how it plays, and the note.
    const top = col.y + COMPACT.touch + COMPACT.gap * 1.5;
    const name = this.add.text(col.x, top, deck.name, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      wordWrap: { width: col.width },
    });
    const { info, build, darlingEntry } = deckPreviewModel(deck);
    const identity = this.compactIdentity(col.x, 0, col.width, deck, buildSizeCopy(build), type.body, theme.colors.body);
    const archetype = this.add.text(col.x, 0, darlingEntry ? `Darling: ${darlingEntry.d.name}` : info?.archetype ?? '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: col.width },
    });
    const plays = this.add.text(col.x, 0, info?.plays ?? (isDarlingsPrecon(deck) ? deck.blurb : ''), {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: col.width }, lineSpacing: 2,
    });
    const note = owned
      ? this.compactNote(col.x, 0, col.width, 'check', save.decks.some((d) => d.id === deck.id)
        ? 'Owned. Clone Deck saves a fresh copy of the original list.'
        : 'You hold every card in it. Clone Deck adds it to your library, free.', theme.colors.success)
      : freeClaim
        ? this.compactNote(col.x, 0, col.width, 'star', isDarlingsPrecon(deck)
          ? `Your one free Darling deck. The other Darling decks cost ${formatGold(ECONOMY.darlingsPreconPrice)}.`
          : `Your one free starter. The other starters cost ${formatGold(ECONOMY.starterDeckPrice)} once you claim it.`, theme.colors.gold)
        : !affordable
          ? this.compactNote(col.x, 0, col.width, 'info', `You need ${formatGold(price - save.gold)} more to buy this deck.`, theme.colors.danger)
          : null;
    const room = rowY - COMPACT.gap - top;
    const gap = 4;
    const heights = (): number => name.height + gap + identity.height + (archetype.visible && archetype.text ? gap + archetype.height : 0)
      + (note ? COMPACT.gap + note.height : 0);
    // How it plays gives way first, then the archetype; the preview has both in full.
    this.trimToHeight(plays, room - heights() - gap);
    if (!plays.visible || !plays.text) this.trimToHeight(archetype, room - (heights() - (archetype.visible ? gap + archetype.height : 0)) - gap);
    let y = name.y + name.height + gap;
    for (const object of identity.objects) (object as Phaser.GameObjects.Image).y += y;
    y += identity.height;
    if (archetype.visible && archetype.text) {
      archetype.setY(y + gap);
      y = archetype.y + archetype.height;
    }
    if (plays.visible && plays.text) {
      plays.setY(y + gap);
      y = plays.y + plays.height;
    }
    layer.add([name, ...identity.objects, archetype, plays]);
    if (note) {
      for (const object of note.objects) (object as Phaser.GameObjects.Image).y += y + COMPACT.gap;
      layer.add(note.objects);
    }
  }

  /** A deck's colours as pips, then `text`, on one line from (x, y). */
  private compactIdentity(
    x: number,
    y: number,
    width: number,
    deck: DeckList | DarlingsPrecon,
    text: string,
    size: number,
    color: string,
  ): { objects: Phaser.GameObjects.GameObject[]; height: number } {
    const info = DECK_INFO[deck.id];
    const keys = (info?.colors ?? (isDarlingsPrecon(deck) ? deck.colors.join('/') : '')).split('/').filter(Boolean);
    const pip = Math.round(size * 1.35);
    const label = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color });
    const textX = x + keys.length * (pip + 3) + (keys.length ? 5 : 0);
    ellipsizeText(label, Math.max(0, x + width - textX), text);
    const h = Math.max(pip, label.height);
    label.setPosition(textX, y + (h - label.height) / 2);
    const pips = keys.map((key, i) => this.add.image(x + pip / 2 + i * (pip + 3), y + h / 2, `pip-${key}`).setDisplaySize(pip, pip));
    return { objects: [...pips, label], height: h };
  }

  /** A deck's one action: Clone Deck when owned, Claim free when it is the free one, else Buy. */
  private compactDeckAction(rect: Rect, sku: DeckSku, owned: boolean, freeClaim: boolean, affordable: boolean, onCloned?: (granted: boolean) => void): CompactButton {
    if (owned) {
      return compactButton(this, rect, 'Clone Deck', { variant: 'primary', icon: 'copy', onTap: () => this.onCloneDeck(sku, onCloned) });
    }
    const button = compactButton(this, rect, freeClaim ? 'Claim free' : `Buy · ${goldPrice(sku.price)}`, {
      variant: 'primary',
      ...(freeClaim ? { icon: 'star' as const } : {}),
      onTap: () => {
        if (this.onBuyDeck(sku) && this.compactUi?.sheet) this.closeCompactSheet();
      },
    });
    button.setEnabled(affordable);
    return button;
  }

  /**
   * Open a sheet over the main pane and the top bar's left (S-Shop-Odds,
   * S-Shop-DeckConfirm). The header and the main pane hide under it; the
   * column beside it stays live.
   */
  private openCompactSheet(
    kind: 'odds' | 'preview',
    header: (x: number, y: number, width: number) => { objects: Phaser.GameObjects.GameObject[]; height: number },
  ): { container: Phaser.GameObjects.Container; layout: ShopSheet } {
    const ui = this.compactUi!;
    this.closeCompactSheet(false);
    const content = sceneStage(this).content;
    const draft = shopSheet(content, 0);
    const head = header(draft.title.x, draft.title.y, draft.title.width);
    const layout = shopSheet(content, head.height);
    const container = this.add.container(0, 0).setDepth(theme.depth.overlay);
    container.setData('a11ySurface', layout.frame).setData('a11yPanel', layout.frame);
    const frame = layout.frame;
    container.add(this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel));
    container.add(head.objects);
    const close = compactIconButton(this, layout.close, 'close', () => this.closeCompactSheet());
    container.add(close.container);
    ui.sheet = container;
    ui.sheetKind = kind;
    ui.sheetZones = [close.inputZone];
    for (const object of ui.header) (object as Phaser.GameObjects.Container).setVisible(false);
    ui.mainLayer?.setVisible(false);
    return { container, layout };
  }

  /** Close the open sheet, if any; `render` redraws the column for the screen beneath. */
  private closeCompactSheet(render = true): void {
    const ui = this.compactUi;
    if (!ui?.sheet) return;
    this.closeInspect();
    ui.sheet.destroy();
    ui.sheet = null;
    ui.sheetKind = null;
    ui.sheetZones = [];
    ui.previewSku = null;
    this.previewEntries = [];
    for (const object of ui.header) (object as Phaser.GameObjects.Container).setVisible(true);
    ui.mainLayer?.setVisible(true);
    if (render) this.renderCompactColumn();
  }

  /** The drop rates (S-Shop-Odds): the pool, the four tables and the notes, scrolling when they outgrow the sheet. */
  private openCompactOdds(sku: BoosterSku): void {
    const type = theme.compactType;
    const pool = packPoolSummary(this.saveData, CARD_DB, packSetForSku(sku));
    const copy = oddsCopy(sku, pool);
    const { container, layout } = this.openCompactSheet('odds', (x, y, width) => {
      const title = this.add.text(x, y, copy.title, {
        fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
        wordWrap: { width },
      });
      return { objects: [title], height: title.height };
    });
    const body = layout.body;
    const content = this.add.container(0, body.y);
    container.add(content);
    const text = (str: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text =>
      this.add.text(body.x, 0, str, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width: body.width - SHOP_COMPACT.thumbLane }, ...extra });
    let y = 0;
    const put = (t: Phaser.GameObjects.Text, after: number): void => {
      t.setY(y);
      content.add(t);
      y += t.height + after;
    };
    put(text(copy.lead, type.body, theme.colors.body), 8);
    put(text(copy.pool, type.body, theme.colors.gold, { fontStyle: theme.weight.w700 }), 2);
    put(text(copy.source, type.caption, theme.colors.muted), 14);
    // Four tables across when they fit, else two by two.
    const sections = oddsSections();
    const gap = 12;
    const innerW = body.width - SHOP_COMPACT.thumbLane;
    const across = innerW >= 4 * 120 + 3 * gap ? 4 : 2;
    const colW = (innerW - gap * (across - 1)) / across;
    const probe = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px` });
    const rowH = Math.max(26, probe.height + 8);
    probe.destroy();
    for (let start = 0; start < sections.length; start += across) {
      let tallest = 0;
      sections.slice(start, start + across).forEach((section, k) => {
        const x = body.x + k * (colW + gap);
        const heading = this.add.text(x, y, section.heading, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold, letterSpacing: 1,
        });
        content.add(heading);
        let rowY = y + heading.height + 6;
        for (const [value, weight] of section.rows) {
          const band = this.add.graphics().fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
            .fillRoundedRect(x, rowY, colW, rowH - 3, theme.radius.control);
          const label = this.add.text(x + 8, rowY + (rowH - 3) / 2, section.labelFor(value), {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: section.colorFor(value),
          }).setOrigin(0, 0.5);
          const odds = this.add.text(x + colW - 8, label.y, `${weight}%`, {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.heading,
          }).setOrigin(1, 0.5);
          ellipsizeText(label, colW - 24 - odds.width);
          content.add([band, label, odds]);
          rowY += rowH;
        }
        tallest = Math.max(tallest, rowY - y);
      });
      y += tallest + 12;
    }
    put(text('NOTES', type.label, theme.colors.gold, { fontStyle: theme.weight.w700, letterSpacing: 1 }), 4);
    copy.notes.forEach((note, i) => put(text(note, type.caption, theme.colors.muted), i === copy.notes.length - 1 ? 0 : 4));
    bindMenuScroll(this, content, body, y, () => this.inspect !== null, [], 0);
    this.renderCompactColumn();
  }

  /**
   * The deck preview (S-Shop-DeckConfirm, S-Shop-DeckShort): the signature
   * cards, the curve and the colours on the left, the whole list on the
   * right, and in the column what the purchase adds and its price. It waits
   * on this deck's own art, as the desktop preview does.
   */
  private openCompactPreview(sku: DeckSku): void {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const model = deckPreviewModel(sku.deck);
    const { container, layout } = this.openCompactSheet('preview', (x, y, width) => {
      const title = this.add.text(x, y, '', {
        fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      });
      ellipsizeText(title, width, sku.deck.name);
      const archetype = model.darlingEntry ? `Darling: ${model.darlingEntry.d.name}` : model.info?.archetype ?? '';
      const identity = this.compactIdentity(x, y + title.height + 2, width, sku.deck,
        [archetype, buildSizeCopy(model.build)].filter(Boolean).join(' · '), type.label, theme.colors.muted);
      return { objects: [title, ...identity.objects], height: title.height + 2 + identity.height };
    });
    ui.previewSku = sku;
    this.previewEntries = model.entries;
    this.renderCompactColumn();
    const cards = [...model.build.cards, ...(model.build.darlingId ? [model.build.darlingId] : [])];
    const wait = this.add.text(layout.body.x + layout.body.width / 2, layout.body.y + layout.body.height / 2, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
    }).setOrigin(0.5);
    container.add(wait);
    awaitArt(container, cards, {
      onWait: (text) => {
        if (wait.active) wait.setText(text);
      },
      onReady: () => {
        if (ui.sheet !== container || !container.active) return;
        wait.destroy();
        this.fillCompactPreview(container, layout, model);
        if (this.fixture?.inspectIndex !== undefined) this.showCardInspect(this.fixture.inspectIndex);
        else this.data.set('a11yReady', true);
      },
    });
  }

  private fillCompactPreview(container: Phaser.GameObjects.Container, layout: ShopSheet, model: DeckPreviewModel): void {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const S = SHOP_COMPACT;
    const sectionStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.muted, letterSpacing: 1 };

    // The left: signature cards, the curve, the composition and the colours.
    const left = layout.left;
    const stats = this.add.container(0, left.y);
    container.add(stats);
    let y = 0;
    const signature = this.add.text(left.x, y, model.darlingEntry ? 'YOUR DARLING · TAP TO INSPECT' : 'SIGNATURE CARDS · TAP TO INSPECT', {
      ...sectionStyle, wordWrap: { width: left.width - S.thumbLane },
    });
    stats.add(signature);
    y += signature.height + 6;
    const featuredIds = model.darlingEntry ? [model.darlingEntry.d.id] : (model.info?.featured ?? []);
    const featured = featuredIds.map((id) => this.previewEntries.findIndex((entry) => entry.d.id === id)).filter((idx) => idx >= 0);
    const usable = left.width - S.thumbLane;
    const thumbW = model.darlingEntry ? Math.min(usable * 0.55, 120) : Math.min(80, (usable - COMPACT.gap * 2) / 3);
    const thumbH = Math.round(thumbW * 1.4);
    const thumbs: { rect: Rect; idx: number }[] = [];
    featured.forEach((idx, slot) => {
      const entry = this.previewEntries[idx];
      const x = left.x + slot * (thumbW + COMPACT.gap);
      stats.add(makeCardThumb(this, x + thumbW / 2, y + thumbH / 2, entry.d, thumbW / CARD_W));
      const count = this.add.text(0, 0, `×${entry.n}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      });
      const bw = count.width + 12;
      const bh = count.height + 4;
      count.setPosition(x + thumbW - 4 - bw + 6, y + thumbH - 4 - bh + 2);
      stats.add([this.add.graphics()
        .fillStyle(theme.graphics.panelFill, 0.94).fillRoundedRect(x + thumbW - 4 - bw, y + thumbH - 4 - bh, bw, bh, bh / 2)
        .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(x + thumbW - 4 - bw, y + thumbH - 4 - bh, bw, bh, bh / 2), count]);
      thumbs.push({ rect: { x, y, width: thumbW, height: thumbH }, idx });
    });
    if (featured.length) y += thumbH + 14;

    const curveLabel = this.add.text(left.x, y, 'MANA CURVE', sectionStyle);
    stats.add(curveLabel);
    y += curveLabel.height + 4;
    const curveStats = computeDeckStats(model.build.cards, CARD_DB);
    const pitch = Math.min(28, usable / (CURVE_MAX + 1));
    const barW = Math.round(pitch * 0.6);
    const small = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px` };
    const probe = this.add.text(0, 0, '7+', small);
    const capH = probe.height;
    probe.destroy();
    const barMax = 36;
    const barBase = y + capH + 2 + barMax;
    const maxCount = Math.max(1, ...curveStats.curve);
    curveStats.curve.forEach((count, mv) => {
      const bx = left.x + pitch / 2 + mv * pitch;
      const h = count > 0 ? Math.max(3, Math.round((count / maxCount) * barMax)) : 2;
      stats.add(this.add.rectangle(bx, barBase, barW, h, count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1));
      if (count > 0) stats.add(this.add.text(bx, barBase - h - 2, `${count}`, { ...small, color: theme.colors.body }).setOrigin(0.5, 1));
      stats.add(this.add.text(bx, barBase + 2, mv === CURVE_MAX ? '7+' : `${mv}`, { ...small, color: theme.colors.muted }).setOrigin(0.5, 0));
    });
    y = barBase + 2 + capH + 8;
    const other = curveStats.nonlands - curveStats.typeCounts.creature;
    const landsCopy = model.build.landReserve ? `${model.build.landReserve.length} Warchest lands` : `${curveStats.lands} lands`;
    const composition = this.add.text(left.x, y, `${curveStats.typeCounts.creature} creatures · ${other} other · ${landsCopy}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: usable },
    });
    stats.add(composition);
    y += composition.height + 6;
    const pip = Math.round(type.body * 1.3);
    let px = left.x;
    for (const color of PIE_COLORS) {
      const n = curveStats.colorPips[color];
      if (n === 0) continue;
      const label = this.add.text(0, 0, `${n}`, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body });
      if (px + pip + 4 + label.width > left.x + usable && px > left.x) {
        px = left.x;
        y += pip + 6;
      }
      stats.add(this.add.image(px + pip / 2, y + pip / 2, `pip-${color}`).setDisplaySize(pip, pip));
      label.setPosition(px + pip + 4, y + (pip - label.height) / 2);
      stats.add(label);
      px += pip + 4 + label.width + 12;
    }
    y += pip;
    const statsScroll = bindMenuScroll(this, stats, left, y, () => this.inspect !== null, [], 0);
    const statsTap = this.add.zone(left.x + left.width / 2, left.y + left.height / 2, left.width, left.height).setInteractive({ useHandCursor: true });
    bindTapButton(this, statsTap, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.inspect) return;
      const at = { x: pointer.worldX, y: pointer.worldY - left.y + statsScroll.offset() };
      const hit = thumbs.find(({ rect }) => at.x >= rect.x && at.x <= rect.x + rect.width && at.y >= rect.y && at.y <= rect.y + rect.height);
      if (hit) this.showCardInspect(hit.idx);
    });
    container.add(statsTap);

    // The right: the whole list by category, each row tapping to its card.
    const right = layout.right;
    const list = this.add.container(0, right.y);
    container.add(list);
    const rowW = right.width - S.thumbLane;
    const art = Math.min(36, COMPACT.touch - 8);
    const totals = new Map<string, number>([
      ['DARLING', model.darlingEntry ? 1 : 0],
      ['CREATURES', model.creatures.reduce((sum, e) => sum + e.n, 0)],
      ['SPELLS', model.spells.reduce((sum, e) => sum + e.n, 0)],
      ['LANDS', model.lands.reduce((sum, e) => sum + e.n, 0)],
    ]);
    const categoryOf = (entry: PreviewEntry): string =>
      entry === model.darlingEntry ? 'DARLING' : isType(entry.d, 'creature') ? 'CREATURES' : isType(entry.d, 'land') ? 'LANDS' : 'SPELLS';
    const rows: { top: number; bottom: number; idx: number }[] = [];
    let ly = 0;
    let category: string | null = null;
    this.previewEntries.forEach((entry, idx) => {
      const cat = categoryOf(entry);
      if (cat !== category) {
        category = cat;
        const head = this.add.text(right.x, ly + (category === 'DARLING' || idx === 0 ? 0 : 6), `${cat} · ${totals.get(cat) ?? 0}`, sectionStyle);
        list.add(head);
        ly = head.y + head.height + 4;
      }
      const count = this.add.text(right.x + art + 10, 0, `${entry.n}×`, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted });
      const mv = this.add.text(right.x + rowW - 4, 0, isType(entry.d, 'land') ? '' : `${manaValue(entry.d.cost)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
      }).setOrigin(1, 0);
      const nameX = count.x + count.width + 8;
      const name = this.add.text(nameX, 0, entry.d.name, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
        color: entry === model.darlingEntry ? theme.colors.gold : theme.colors.heading,
        // Advanced wrap breaks a hyphenated name too long for its line rather than running it into the cost.
        wordWrap: { width: Math.max(0, right.x + rowW - 4 - mv.width - 8 - nameX), useAdvancedWrap: true },
      });
      const h = Math.max(COMPACT.touch, name.height + 10);
      for (const t of [count, name, mv]) t.setY(ly + (h - t.height) / 2);
      this.addDeckPortrait(entry.d.id, right.x + art / 2, ly + h / 2, art, art, list);
      list.add([count, name, mv, this.add.graphics().lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
        .lineBetween(right.x, ly + h + 2, right.x + rowW, ly + h + 2)]);
      rows.push({ top: ly, bottom: ly + h + 4, idx });
      ly += h + 4;
    });
    const listScroll = bindMenuScroll(this, list, right, ly, () => this.inspect !== null, [], 0, undefined,
      (this.fixture?.previewPage ?? 0) * right.height);
    const listTap = this.add.zone(right.x + right.width / 2, right.y + right.height / 2, right.width, right.height).setInteractive({ useHandCursor: true });
    bindTapButton(this, listTap, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.inspect) return;
      const at = pointer.worldY - right.y + listScroll.offset();
      const row = rows.find((r) => at >= r.top && at < r.bottom);
      if (row) this.showCardInspect(row.idx);
    });
    container.add(listTap);
    ui.sheetZones.push(statsTap, listTap);
  }

  /** The preview's column (S-Shop-DeckConfirm): what the purchase adds, its price, and Close beside the action. */
  private drawCompactPreviewColumn(layer: Phaser.GameObjects.Container, sku: DeckSku): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const save = this.saveData;
    const { deck, price } = sku;
    const freeClaim = this.isFreeClaim(deck);
    const owned = !freeClaim && shopDeckOwned(save, CARD_DB, deck);
    const affordable = freeClaim || save.gold >= price;

    const footY = col.y + col.height - COMPACT.touch;
    const closeW = Math.round((col.width - COMPACT.gap) * 0.4);
    const close = compactButton(this, { x: col.x, y: footY, width: closeW, height: COMPACT.touch }, 'Close', { onTap: () => this.closeCompactSheet() });
    layer.add(close.container);
    ui.columnZones.push(close.inputZone);

    const block = this.add.container(0, 0);
    layer.add(block);
    let y = 0;
    const heading = this.add.text(col.x, y, 'WHAT YOU GET', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.muted, letterSpacing: 1,
    });
    y += heading.height + 4;
    const grant = this.add.text(col.x, y, deckGrantText(save, deck), {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: col.width - SHOP_COMPACT.thumbLane }, lineSpacing: 2,
    });
    y += grant.height + 12;
    const rule = this.add.graphics().lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome).lineBetween(col.x, y, col.x + col.width, y);
    y += 12;
    block.add([heading, grant, rule]);
    const line = (text: string, color: string): Phaser.GameObjects.Text => {
      const t = this.add.text(col.x, y, text, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color, wordWrap: { width: col.width - SHOP_COMPACT.thumbLane }, lineSpacing: 2,
      });
      block.add(t);
      y += t.height + 4;
      return t;
    };
    let decision: Phaser.GameObjects.Text;
    if (owned) {
      decision = line(save.decks.some((d) => d.id === deck.id)
        ? 'Owned. Clone Deck saves a fresh copy of the original list.'
        : 'You hold every card in it. Clone Deck adds it to your library, free.', theme.colors.success);
    } else if (freeClaim) {
      decision = line(isDarlingsPrecon(deck)
        ? `Your one free Darling deck. The other Darling decks cost ${formatGold(ECONOMY.darlingsPreconPrice)}.`
        : `Your one free starter. The other starters cost ${formatGold(ECONOMY.starterDeckPrice)} once you claim it.`, theme.colors.gold);
    } else if (affordable) {
      line(`Price ${formatGold(price)}`, theme.colors.heading);
      decision = line(`Balance ${formatGold(save.gold)} → ${formatGold(save.gold - price)} after`, theme.colors.body);
    } else {
      decision = line(`Price ${formatGold(price)} · Balance ${formatGold(save.gold)} · ${formatGold(price - save.gold)} short`, theme.colors.danger);
    }
    const contentH = y - 4;
    const view = { x: col.x, y: col.y, width: col.width, height: Math.max(0, footY - COMPACT.gap - col.y) };
    block.setY(col.y);
    if (contentH > view.height) bindMenuScroll(this, block, view, contentH, () => this.inspect !== null, [], 0);

    // Clone Deck keeps the preview open, so its line is the feedback and counts the copies.
    let copiesSaved = 0;
    const action = this.compactDeckAction({ x: col.x + closeW + COMPACT.gap, y: footY, width: col.width - closeW - COMPACT.gap, height: COMPACT.touch },
      sku, owned, freeClaim, affordable, (granted) => {
        if (!decision.active) return;
        if (!granted) copiesSaved++;
        decision.setColor(theme.colors.success).setText(granted
          ? `Saved. ${deck.name} is in your deck library.`
          : copiesSaved === 1 ? `Saved. A copy of ${deck.name} is in your deck library.` : `Saved. ${copiesSaved} copies of ${deck.name} are in your deck library.`);
      });
    layer.add(action.container);
    ui.columnZones.push(action.inputZone);
  }

  /**
   * One card from the preview, full screen (the Collection's D-Detail
   * shape): the face on the left, its name, tier and count beside it (and
   * the rules at the largest text), Previous and Next under them.
   */
  private buildCompactCardInspect(idx: number): void {
    const entry = this.previewEntries[idx];
    if (!entry) return;
    const stage = sceneStage(this);
    const content = stage.content;
    const type = theme.compactType;
    const largeText = currentAccessibility().textScale >= 1.3;
    const shell = modalShell(this, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0.92, depth: theme.depth.inspect, dismissal: 'esc-only', coordinator: this.coordinator,
      registration: { dismissible: true, guardTargets: this.compactTargets().map(modalGuardTarget) },
      onClose: () => {
        if (this.inspect === shell) {
          this.inspect = null;
          this.inspectIdx = null;
        }
      },
    });
    shell.panel.clear();
    this.inspect = shell;
    this.inspectIdx = idx;
    const c = shell.container;
    c.setData('a11ySurface', { x: 0, y: 0, width: stage.width, height: stage.height }).setData('a11yPanel', content);
    awaitArt(c, [entry.d.id], { onReady: () => undefined });
    const faceW = Math.min(largeText ? 200 : 260, content.height / 1.4, content.width * 0.42);
    const view = new CardView(this, content.x + faceW / 2, content.y + (faceW * 1.4) / 2).setScale(faceW / CARD_W);
    view.setCard(entry.d, { fx: 'full' });
    c.add(view);
    const close = compactIconButton(this, { x: content.x + content.width - COMPACT.touch, y: content.y, width: COMPACT.touch, height: COMPACT.touch },
      'close', () => shell.close());
    c.add(close.container);
    const textX = content.x + faceW + 16;
    const textW = content.x + content.width - textX;
    const navY = content.y + content.height - COMPACT.touch;
    const navW = Math.min(180, (textW - COMPACT.gap) / 2);
    const previous = compactButton(this, { x: textX, y: navY, width: navW, height: COMPACT.touch }, 'Previous', { onTap: () => this.stepInspect(-1) });
    const next = compactButton(this, { x: textX + navW + COMPACT.gap, y: navY, width: navW, height: COMPACT.touch }, 'Next', { onTap: () => this.stepInspect(1) });
    c.add([previous.container, next.container]);

    const area = { x: textX, y: content.y, width: textW, height: Math.max(0, navY - COMPACT.gap - content.y) };
    const layer = this.add.container(0, area.y);
    c.add(layer);
    let y = 0;
    const add = (str: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}, width = textW - SHOP_COMPACT.thumbLane): void => {
      const t = this.add.text(textX, y, str, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width }, ...extra });
      layer.add(t);
      y += t.height + 4;
    };
    // The name stops short of the close button.
    add(entry.d.name, type.h2, theme.colors.heading, { fontFamily: theme.fonts.display, fontStyle: theme.weight.w700 }, textW - COMPACT.touch - COMPACT.gap);
    if (!entry.d.token) add(rarityLine(entry.d), type.label, TIER_TEXT_COLOR[entry.d.rarity], { fontStyle: theme.weight.w700 });
    add(`${entry.n}× in this deck`, type.body, theme.colors.body);
    if (largeText) {
      y += 6;
      const stats = entry.d.attack !== undefined && entry.d.defense !== undefined ? ` · ${entry.d.attack}/${entry.d.defense}` : '';
      add(`${typeLine(entry.d)}${stats}`, type.label, theme.colors.muted);
      const rules = rulesText(entry.d);
      if (rules) add(rules, type.body, theme.colors.body, { lineSpacing: 2 });
    }
    bindMenuScroll(this, layer, area, Math.max(0, y - 4), undefined, [], 0, shell);
    this.data.set('a11yReady', true);
  }
}
