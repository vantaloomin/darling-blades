/** Phaser-free state and geometry for the Deck Builder's right-pane views and its ☰ Decks picker. */

import { DESKTOP_DECK_PITCH } from './deckListPaging';
import { menuLineHeight } from './mainMenuPresentation';
import { playTextStack } from './playPresentation';
import { theme } from './theme';

/**
 * `style` joined in v33, when card back and playmat became per-deck. It is a
 * third VIEW rather than a new chrome row because the pane is 360px wide and
 * both existing rows are full: the CTA row has no gap at all, and the View row
 * leaves ~54px, under the 90px hit-width floor.
 */
export type DeckPaneMode = 'cards' | 'warchest' | 'style';

export interface DeckPaneToggleState {
  mode: DeckPaneMode;
  cardsSelected: boolean;
  warchestSelected: boolean;
  styleSelected: boolean;
  warchestWarning: boolean;
  warchestLabel: 'Warchest' | 'Warchest ⚠';
}

/**
 * The pane's content column is 360px wide and its right edge sits on the
 * title-safe frame's right edge; every x below is measured from one of its two
 * edges. It spanned 900-1260 until the 1.8 cut (2026-09-23), which put the
 * View toggle, the Warchest slots, the count chips, the Decks button, and the
 * Import button past the frame.
 */
const PANE_WIDTH = 360;
const PANE_RIGHT = theme.design.safeRight;
const PANE_LEFT = PANE_RIGHT - PANE_WIDTH;

/** Rendered text heights for the summary's independent reading tracks. */
export interface DeckPaneSummaryMeasure {
  headingHeight: number;
  countHeight: number;
  manaValueHeight: number;
  summaryHeight: number;
  statusHeight: number;
}

/** Bottom-anchored reading tracks leave both action rows their full hit bands. */
export function deckPaneSummaryLayout(measured: Partial<DeckPaneSummaryMeasure> = {}) {
  const headingHeight = measured.headingHeight ?? menuLineHeight(theme.type.label);
  const countHeight = measured.countHeight ?? menuLineHeight(theme.type.micro);
  const manaValueHeight = measured.manaValueHeight ?? menuLineHeight(theme.type.micro);
  const summaryHeight = measured.summaryHeight ?? menuLineHeight(theme.type.caption);
  const statusHeight = measured.statusHeight ?? 2 * menuLineHeight(theme.type.caption);
  const ctaY = theme.design.footerCenterY;
  const secondaryCtaY = ctaY - theme.control.minHitHeight - theme.space(2);
  const statusBottomY = secondaryCtaY - theme.control.minHitHeight / 2 - theme.space(2);
  const statusTop = statusBottomY - statusHeight;
  const summaryTop = statusTop - theme.space(4) - summaryHeight;
  const barBaseY = summaryTop - theme.space(2) - manaValueHeight;
  const barMaxHeight = 24;
  const countOffsetY = countHeight / 2 + theme.space(1);
  const headingBottom = barBaseY - barMaxHeight - countHeight - theme.space(2);
  const statsHeadingY = headingBottom - headingHeight / 2;
  const listBottom = headingBottom - headingHeight - theme.space(3);
  const pagerY = statsHeadingY;
  return { pagerY, pagerX: PANE_LEFT + 144, statsHeadingY, barBaseY, barMaxHeight, summaryLineY: summaryTop + summaryHeight / 2,
    summaryTop, statusTop, statusBottomY, statusMaxLines: 2, ctaY, secondaryCtaY,
    manaValueY: barBaseY + manaValueHeight / 2, countOffsetY, listBottom };
}

/** Wrapped title, Format and View tracks start at the safe edge and grow down. */
export function deckPaneHeaderLayout(titleHeight = 2 * menuLineHeight(theme.type.h2)) {
  const titleHalfHeight = Math.max(titleHeight, theme.control.minHitHeight) / 2;
  const titleY = theme.design.safeTop + titleHalfHeight;
  const formatY = titleY + titleHalfHeight + theme.space(2) + theme.control.minHitHeight / 2;
  const toggleY = formatY + theme.control.minHitHeight;
  return { titleY, titleHalfHeight, titleWidth: PANE_WIDTH - 46 - 100, formatY, toggleY,
    contentTop: toggleY + theme.control.minHitHeight / 2 };
}

export const DECK_PANE_LAYOUT = {
  /** The side panel's fill: one 20px gutter left of the content, to the screen edge. */
  panelX: PANE_LEFT - 20,
  left: PANE_LEFT,
  right: PANE_RIGHT,
  /** The deck's name and count, the Darling portrait, and the Decks button. */
  title: {
    get y() { return deckPaneHeaderLayout().titleY; },
    get halfHeight() { return deckPaneHeaderLayout().titleHalfHeight; },
    /** The Darling portrait beside the title, and its tap target (reopens the chooser). */
    portraitX: PANE_LEFT + 20,
    portraitScale: 0.09,
    portraitHitWidth: 34,
    portraitHitHeight: theme.control.minHitHeight,
  },
  toggle: {
    labelX: PANE_LEFT,
    /** Three views share the row since v33; 84px slots keep them inside the pane. */
    cardsX: PANE_LEFT + 100,
    warchestX: PANE_LEFT + 192,
    styleX: PANE_LEFT + 284,
    get y() { return deckPaneHeaderLayout().toggleY; },
    minWidth: 84,
  },
  content: {
    /**
     * Below the View row: a first card row's hit band starts where the View
     * row's ends, and the Warchest panel's edge clears the View buttons.
     */
    get top() { return deckPaneHeaderLayout().contentTop; },
    /** The Cards view's list starts this far below `top`. */
    listInset: 8,
    /** The Warchest panel ends one gap above the status band's top line. */
    get bottom() { return deckPaneSummaryLayout().statusTop - theme.space(3); },
  },
  /**
   * The retired Constructed format's inline basics block (the only format
   * without a View row). Its first row's hit band starts where the Format
   * row's ends, and the deck list starts one small gap below the last row's
   * hit band. Desktop rows carry a 40px land preview and 44px controls, so the
   * 46px pitch still leaves daylight between neighbours' hit bands.
   */
  basics: {
    get firstY() { return deckPaneHeaderLayout().formatY + theme.control.minHitHeight; },
    desktopPitch: 46,
    touchPitch: 40,
    count: 5,
  },
  /**
   * Desktop card rows. The name column ends clear of the right-aligned count
   * chip (countRightX is the chip's RIGHT edge; countReserve is the widest
   * chip plus its gap), so a long legend name wraps within its own column.
   */
  cards: {
    rowPitch: DESKTOP_DECK_PITCH,
    starX: PANE_LEFT,
    pinX: PANE_LEFT + 24,
    nameX: PANE_LEFT + 44,
    nameWidth: 250,
    countRightX: PANE_RIGHT - 16,
    countReserve: 46,
    /** Row iconography follows the live heading and label roles. */
    get starSize() { return theme.type.h2; },
    get pinSize() { return theme.type.label; },
  },
  /**
   * The Format conversion row (Warchest / Darlings). Tabs sit left of the
   * Decks CTA's column: Decks is right-aligned to the pane on the title row,
   * and its inflated hit band reaches down level with the tabs' own, so
   * nothing interactive may share both its column and that band - the tab
   * row keeps every tab's right edge clear of Decks' hit column (pinned by
   * test).
   */
  formatRow: {
    labelX: PANE_LEFT,
    get y() { return deckPaneHeaderLayout().formatY; },
    tabFirstX: PANE_LEFT + 90,
    tabPitch: 90,
    tabMinWidth: 78,
    decksHitLeft: PANE_RIGHT - 100,
  },
  /** The deck picker's '☰ Decks' button, right-aligned to the pane on the title row. */
  decks: { x: PANE_RIGHT - 45, get y() { return deckPaneHeaderLayout().titleY; }, minWidth: 90 },
  /**
   * Export and Import share the secondary action row; Save centres on the
   * footer row. The scene uses measured button widths to place each pair.
   */
  cta: {
    exportX: PANE_LEFT + 52,
    saveX: PANE_LEFT + 180,
    importX: PANE_RIGHT - 52,
    sideMinWidth: 104,
    saveMinWidth: 140,
  },
  /** The mana curve stretches the full pane width (owner, 2026-08-18). */
  curve: {
    firstX: PANE_LEFT + 21,
    pitch: 43,
    barWidth: 30,
  },
  get summary() { return deckPaneSummaryLayout(); },
} as const;

/**
 * The View row inherits the format switch's band when that switch is hidden
 * (single-format decks render no dead tab), and everything below rides the
 * same shift so the pane has no empty band above the toggle.
 */
export function deckPaneOffsetY(formatSwitchVisible: boolean): number {
  return formatSwitchVisible ? 0 : DECK_PANE_LAYOUT.toggle.y - DECK_PANE_LAYOUT.formatRow.y;
}

export function defaultDeckPaneMode(): DeckPaneMode {
  return 'cards';
}

export function toggleDeckPaneMode(mode: DeckPaneMode): DeckPaneMode {
  return mode === 'cards' ? 'warchest' : 'cards';
}

/**
 * Constructed has no Warchest view, so stale state is coerced safely. Style is
 * available in every format: a deck has a look whether or not it has a reserve.
 */
export function resolveDeckPaneMode(mode: DeckPaneMode, hasWarchest: boolean): DeckPaneMode {
  if (mode === 'style') return 'style';
  return hasWarchest ? mode : 'cards';
}

export function deckPaneToggleState(
  mode: DeckPaneMode,
  reserveIssueCount: number,
): DeckPaneToggleState {
  const warchestWarning = reserveIssueCount > 0;
  return {
    mode,
    cardsSelected: mode === 'cards',
    warchestSelected: mode === 'warchest',
    styleSelected: mode === 'style',
    warchestWarning,
    warchestLabel: warchestWarning ? 'Warchest ⚠' : 'Warchest',
  };
}

export interface DeckReserveMeasure {
  top: number;
  bottom: number;
  headerHeights: readonly number[];
  rulesHeight: number;
  /** Tallest measured slot hit band, including any wrapped label. */
  slotHeight: number;
  slotCount: number;
}

/** Measured reserve text and whole slot rows share a bounded, paged workspace. */
export function deckReserveLayout(measured: DeckReserveMeasure) {
  const inset = theme.space(3);
  const gap = theme.space(2);
  const columns = 2;
  const contentX = PANE_LEFT + inset;
  const contentWidth = PANE_WIDTH - inset * 2;
  const slotWidth = (contentWidth - gap) / columns;
  const header = playTextStack(measured.headerHeights, measured.top + inset, theme.space(1));
  const rulesY = measured.bottom - inset - measured.rulesHeight;
  const pagerY = rulesY - gap - theme.control.minHitHeight / 2;
  const rowHeight = Math.max(theme.control.minHitHeight, measured.slotHeight);
  const rowPitch = rowHeight + gap;
  const availableRows = Math.floor((pagerY - theme.control.minHitHeight / 2 - gap - header.bottom) / rowPitch);
  if (measured.slotCount > 0 && availableRows < 1) {
    throw new RangeError('The reserve workspace must fit one complete measured slot row.');
  }
  const pageSize = Math.max(1, availableRows) * columns;
  const pageCount = Math.max(1, Math.ceil(measured.slotCount / pageSize));
  return { headerYs: header.ys, headerBottom: header.bottom, rulesY, pagerY, rowHeight, rowPitch,
    pageSize, pageCount, contentX, contentWidth, slotWidth,
    /** Page-local index: rows restart below the header on every page. */
    slotCenter(index: number) {
      return { x: contentX + slotWidth / 2 + index % columns * (slotWidth + gap),
        y: header.bottom + gap + rowHeight / 2 + Math.floor(index / columns) * rowPitch };
    } };
}

export function warchestSlotLabel(index: number, name: string): string {
  return `${index + 1}. ${name}`;
}

/**
 * The centre line of card row `index` in a list whose top is `listY0`. Every
 * element of a row (hero star, pin, name, count) centres on it.
 */
export function deckRowCenterY(listY0: number, index: number, rowPitch: number): number {
  return listY0 + index * rowPitch + Math.round(rowPitch / 2) - 7;
}

/** The centre line of the Constructed basics block's row `index`. */
export function constructedBasicsRowY(index: number, touch: boolean): number {
  const basics = DECK_PANE_LAYOUT.basics;
  return basics.firstY + index * (touch ? basics.touchPitch : basics.desktopPitch);
}

/** Where the Constructed deck list starts: one small gap below the basics block's last hit band. */
export function constructedListTop(touch: boolean): number {
  return constructedBasicsRowY(DECK_PANE_LAYOUT.basics.count - 1, touch) + theme.control.minHitHeight / 2 + theme.space(2);
}

export interface DeckPickerMeasure {
  count?: number;
  nameHeight?: number;
  badgeHeight?: number;
  deleteNoteHeight?: number;
  /** Widest unarmed action hit band. Armed Delete occupies the whole pair. */
  actionWidth?: number;
}

/** Full identities and measured controls determine tile size and page capacity. */
export function deckPickerLayout(measured: DeckPickerMeasure = {}) {
  const padding = theme.space(4.5);
  const gapX = theme.space(6);
  const gapY = theme.space(4.5);
  const cols = 2;
  const width = (theme.design.safeWidth - padding * 2 - gapX) / cols;
  const actionWidth = Math.max(theme.control.minHitWidth, measured.actionWidth ?? theme.control.minHitWidth);
  const actionGap = theme.space(3);
  const nameHeight = measured.nameHeight ?? 2 * menuLineHeight(theme.type.label);
  const badgeHeight = measured.badgeHeight ?? menuLineHeight(theme.type.micro);
  const noteHeight = measured.deleteNoteHeight ?? 2 * menuLineHeight(theme.type.micro);
  const nameTop = padding;
  const badgeTop = nameTop + nameHeight + theme.space(1);
  const bodyTop = badgeTop + badgeHeight + theme.space(3);
  const portraitWidth = 142;
  const portraitHeight = 184;
  const firstX = width - padding - actionWidth * 1.5 - actionGap;
  const secondX = width - padding - actionWidth / 2;
  const firstY = bodyTop + theme.control.minHitHeight / 2;
  const secondY = firstY + theme.control.minHitHeight + theme.space(2);
  const noteY = secondY + theme.control.minHitHeight / 2 + theme.space(2);
  const height = Math.max(bodyTop + portraitHeight, noteY + noteHeight) + padding;
  const titleTrackHeight = Math.max(theme.control.minHitHeight, menuLineHeight(theme.type.h1));
  const overhead = padding * 2 + titleTrackHeight + theme.space(4) * 2 + theme.control.minHitHeight;
  const maxRows = Math.max(1, Math.floor((theme.design.safeHeight - overhead + gapY) / (height + gapY)));
  const rows = Math.min(maxRows, Math.max(1, Math.ceil((measured.count ?? cols) / cols)));
  const panelHeight = overhead + rows * height + (rows - 1) * gapY;
  const panelTop = theme.design.centerY - panelHeight / 2;
  const gridLeft = theme.design.safeLeft + padding;
  const titleY = panelTop + padding + titleTrackHeight / 2;
  const gridTop = panelTop + padding + titleTrackHeight + theme.space(4);
  const footerY = gridTop + rows * height + (rows - 1) * gapY + theme.space(4) + theme.control.minHitHeight / 2;
  return { panelHeight, titleY, tile: { width, height, gapX, gapY, cols, rows }, gridLeft, gridTop,
    footerY, closeX: theme.design.centerX, closeMinWidth: 100,
    pagerX: gridLeft + theme.control.minHitHeight / 2, pageSize: cols * rows,
    padding, nameWidth: width - padding * 2, nameTop, badgeTop, pipsY: bodyTop + theme.control.minHitHeight / 2,
    portrait: { x: padding + portraitWidth / 2, y: bodyTop + portraitHeight / 2, width: portraitWidth, height: portraitHeight },
    actions: { firstX, secondX, firstY, secondY, columnX: (firstX + secondX) / 2, noteY,
      width: actionWidth * 2 + actionGap } };
}

/** Default picker geometry stays live; rendered callers pass their measured text. */
export const DECK_PICKER_LAYOUT = {
  get panelHeight() { return deckPickerLayout().panelHeight; },
  get titleY() { return deckPickerLayout().titleY; },
  get tile() { return deckPickerLayout().tile; },
  get gridLeft() { return deckPickerLayout().gridLeft; },
  get gridTop() { return deckPickerLayout().gridTop; },
  get footerY() { return deckPickerLayout().footerY; },
  get closeX() { return deckPickerLayout().closeX; },
  get closeMinWidth() { return deckPickerLayout().closeMinWidth; },
  /** The pager's left chevron sits at pagerX; its hit band starts on the grid's left edge. */
  get pagerX() { return deckPickerLayout().pagerX; },
} as const;

/**
 * How far the shared pager's hit bands reach either side of its x: the left
 * chevron's 44px band centres on a glyph drawn from x, and the right chevron
 * is drawn from x + 88. A chevron glyph is under 20px wide.
 */
export const PAGER_HIT_REACH = {
  left: theme.control.minHitHeight / 2,
  right: 88 + 10 + theme.control.minHitHeight / 2,
} as const;

/** Centre of picker tile `index` on a page (row-major). */
export function deckPickerTilePosition(index: number, layout = deckPickerLayout()): { x: number; y: number } {
  const { tile, gridLeft, gridTop } = layout;
  const col = index % tile.cols;
  const row = Math.floor(index / tile.cols);
  return {
    x: gridLeft + tile.width / 2 + col * (tile.width + tile.gapX),
    y: gridTop + tile.height / 2 + row * (tile.height + tile.gapY),
  };
}

export type DeckStatusTone = 'success' | 'danger';

/** A one-off builder message (a refused import, a copied code) and how it reads. */
export interface DeckStatusMessage {
  text: string;
  tone: DeckStatusTone;
}

/**
 * The status band is one Text in one colour. A failure message never takes the
 * success colour (a rejected import on a legal deck used to read green), and a
 * blocking deck issue keeps the band red whatever message sits above it. With
 * neither, a message reads as success; warnings alone keep the band's red.
 */
export function deckStatusTone(message: DeckStatusMessage | null, hasBlockingIssue: boolean): DeckStatusTone {
  if (hasBlockingIssue || message?.tone === 'danger') return 'danger';
  return message ? 'success' : 'danger';
}
