/** Phaser-free state and geometry for the Deck Builder's right-pane views and its ☰ Decks picker. */

import { DESKTOP_DECK_PITCH } from './deckListPaging';
import { menuLineHeight } from './mainMenuPresentation';
import { playTextStack } from './playPresentation';
import { PAGER_CENTER_OFFSET } from './layout';
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

/**
 * Where the deck list's pager goes. It belongs to the list, so it sits centred
 * under the fullest page's last row when that leaves room above the Mana Curve
 * heading; otherwise (large text, touch rows) it keeps the Mana Curve
 * heading's line, where it costs the list no rows.
 */
export function deckListPagerPosition(lastRowBottom: number, summary = deckPaneSummaryLayout()): { x: number; y: number } {
  const y = lastRowBottom + theme.space(2) + theme.control.minHitHeight / 2;
  // Its hit band may use the gap above the heading, never the heading itself.
  const headingTop = summary.listBottom + theme.space(3);
  return y + theme.control.minHitHeight / 2 <= headingTop
    ? { x: PANE_LEFT + PANE_WIDTH / 2 - PAGER_CENTER_OFFSET, y }
    : { x: summary.pagerX, y: summary.pagerY };
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

/**
 * The Format and View rows share one tab column: it starts one gap past the
 * wider of their two measured labels, so the tabs never run into a label that
 * grew with the text size, and both rows start on the same line. Returns each
 * tab's centre, laid left to right at their measured widths.
 */
export function deckPaneTabRow(labelWidth: number, widths: readonly number[]): number[] {
  let x = PANE_LEFT + labelWidth + theme.space(3);
  return widths.map((width) => {
    const centre = x + width / 2;
    x += width + theme.space(2);
    return centre;
  });
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
    /** The rename pencil between the deck's name and its count, and its hit band. */
    renameIconSize: Math.round(theme.type.h2 * 0.75),
    renameHitWidth: theme.control.minHitWidth,
  },
  toggle: {
    labelX: PANE_LEFT,
    /** Three views share the row since v33; deckPaneTabRow places them. */
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
  /** Widest unarmed action hit band. Armed Delete occupies Rename's slot too. */
  actionWidth?: number;
}

/**
 * The ☰ Decks picker is one scrolling list (owner request 2026-10-10: with
 * every shop deck owned it ran to 11 pages of two tiles, and New Deck sat on
 * the last). Each deck is a row: accent bar, a small hero card, the name over
 * its format line, colour pips and count, then Use / Copy / Rename / Delete.
 * New Deck lives in the footer, so it never moves. Row-local x runs from the
 * row's left edge; the list's own y runs from its viewport's top.
 */
export function deckPickerLayout(measured: DeckPickerMeasure = {}) {
  const padding = theme.space(4.5);
  const listWidth = theme.design.safeWidth - padding * 2;
  // The rows stop short of the list's right edge, where the scroll thumb runs.
  const rowWidth = listWidth - theme.space(3);
  const actionWidth = Math.max(theme.control.minHitWidth, measured.actionWidth ?? theme.control.minHitWidth);
  const actionGap = theme.space(2);
  const nameHeight = measured.nameHeight ?? menuLineHeight(theme.type.label);
  const badgeHeight = Math.max(measured.badgeHeight ?? menuLineHeight(theme.type.micro), measured.deleteNoteHeight ?? 0);
  const rowPad = theme.space(2);
  const accentWidth = theme.space(1);
  const portrait = { width: 70, height: 98 };
  const textHeight = nameHeight + theme.space(1) + badgeHeight;
  const rowHeight = Math.max(portrait.height, textHeight, theme.control.minHitHeight) + rowPad * 2;
  const rowGap = theme.space(2);
  const pitch = rowHeight + rowGap;
  const portraitX = accentWidth + rowPad + theme.space(1) + portrait.width / 2;
  const textX = portraitX + portrait.width / 2 + theme.space(3);
  const actionsRight = rowWidth - rowPad - theme.space(1);
  // Use, Copy, Rename, Delete, left to right.
  const actionXs = [3, 2, 1, 0].map((slot) => actionsRight - actionWidth / 2 - slot * (actionWidth + actionGap));
  const countRight = actionXs[0] - actionWidth / 2 - theme.space(5);
  /** Five 18px pips at a 21px pitch, a gap, and the widest count ("40/40"). */
  const statsWidth = 5 * 21 + theme.space(2) + 64;
  const nameWidth = countRight - statsWidth - theme.space(3) - textX;
  const nameTop = (rowHeight - textHeight) / 2;
  const titleTrackHeight = Math.max(theme.control.minHitHeight, menuLineHeight(theme.type.h1));
  const overhead = padding * 2 + titleTrackHeight + theme.space(4) * 2 + theme.control.minHitHeight;
  const maxRows = Math.max(1, Math.floor((theme.design.safeHeight - overhead + rowGap) / pitch));
  const rows = Math.min(maxRows, Math.max(1, measured.count ?? maxRows));
  const viewportHeight = rows * pitch - rowGap;
  const panelHeight = overhead + viewportHeight;
  const panelTop = theme.design.centerY - panelHeight / 2;
  const listLeft = theme.design.safeLeft + padding;
  const titleY = panelTop + padding + titleTrackHeight / 2;
  const listTop = panelTop + padding + titleTrackHeight + theme.space(4);
  const footerY = listTop + viewportHeight + theme.space(4) + theme.control.minHitHeight / 2;
  return { panelHeight, titleY, padding, listLeft, listTop, footerY,
    viewport: { x: listLeft, y: listTop, width: listWidth, height: viewportHeight },
    row: { width: rowWidth, height: rowHeight, gap: rowGap, pitch, pad: rowPad, accentWidth, rowsVisible: rows },
    closeX: theme.design.centerX, closeMinWidth: 100, newDeckLeft: listLeft,
    nameX: textX, nameWidth, nameTop, badgeTop: nameTop + nameHeight + theme.space(1), countRight,
    portrait: { x: portraitX, width: portrait.width, height: portrait.height },
    actions: { width: actionWidth, gap: actionGap, xs: actionXs,
      /** Armed Delete spans Rename's slot and its own. */
      armedX: (actionXs[2] + actionXs[3]) / 2, armedWidth: actionWidth * 2 + actionGap } };
}

/** How tall the whole list is, so the scroll knows its range. */
export function deckPickerContentHeight(count: number, layout = deckPickerLayout()): number {
  return Math.max(1, count) * layout.row.pitch - layout.row.gap;
}

/** The scroll offset that brings row `index` into view, as near the top as the range allows. */
export function deckPickerScrollTo(index: number, count: number, layout = deckPickerLayout()): number {
  const max = Math.max(0, deckPickerContentHeight(count, layout) - layout.viewport.height);
  return Math.max(0, Math.min(max, index * layout.row.pitch));
}

/**
 * How far the shared pager's hit bands reach either side of its x: the left
 * chevron's 44px band centres on a glyph drawn from x, and the right chevron
 * is drawn from x + 88. A chevron glyph is under 20px wide.
 */
export const PAGER_HIT_REACH = {
  left: theme.control.minHitHeight / 2,
  right: 88 + 10 + theme.control.minHitHeight / 2,
} as const;

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
