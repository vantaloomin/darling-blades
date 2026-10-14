/**
 * The Deck Builder's compact (phone) composition, Phaser-free (mocks D-Cards,
 * D-Cards130, D-PoolFilters, D-BuilderInspect, D-Warchest, D-WarchestSlot,
 * D-Darlings, D-DarlingPick, D-Style, D-CardBackPicker, D-Decks and
 * D-ExportCode; docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * The pool's pages become one scrolling grid in the main pane, each card over
 * its in-deck count (and an add-to-the-cap chip). The top bar carries the
 * deck's name (it opens Your Decks), the pool search and Filters, and the
 * Cards, Warchest and Style tabs over the command column. Cards puts the deck
 * list, its issues and the curve in the column; Warchest puts the ten reserve
 * slots in the centre; Style previews the deck's table there. Save deck (or
 * Fix deck) sits at the column's foot beside the deck code button. A
 * Darlings deck keeps its Darling in a zone at the main pane's left. Your
 * Decks is its own screen over the builder. Coordinates are compact design
 * px inside the content box.
 */

import { COMPACT, compactShell } from './compactLayout';
import type { Rect } from './layout';

export const BUILDER_COMPACT = {
  /** The deck name's track in the top bar: never narrower than this, and the search keeps its own floor. */
  titleMinW: 120,
  searchMinW: 150,
  /** A pool card's narrowest face; columns drop before faces shrink under it. */
  minCardW: 96,
  /** Between two pool cards across; between a card and its chips; between a chip line and the next row. */
  gridGap: 12,
  chipGap: 6,
  rowGap: 12,
  /** The in-deck count's pill, at the chip line's left; the add-to-cap chip takes the rest. */
  countPillW: 58,
  /** The grid's scroll thumb lane. */
  thumbLane: 7,
  /** The Darling's zone at the main pane's left (D-Darlings). */
  zoneW: 100,
  zoneWLarge: 120,
  zoneGap: 10,
  /** The deck code button beside Save, at the column's foot. */
  codeW: 52,
  /** The curve's pip-count lane, right of the bars. */
  pipLane: 44,
  /** Warchest slots: five across, two down; a tile's height over its width at most. */
  slotColumns: 5,
  slotGap: 10,
  slotAspect: 1.3,
  /** Your Decks: the deck's face at its widest. */
  deckFaceMaxW: 160,
  deckGap: 16,
  /** Held this long, a card opens its inspect instead of being added. */
  holdMs: 450,
  /** A sheet's inset from its frame (inspect, the deck code, the choosers). */
  sheetPad: 16,
} as const;

/** Card faces are 300x420. */
const ASPECT = 1.4;

export interface BuilderTopBar {
  back: Rect;
  /** The deck name over its format and count; a tap opens Your Decks. */
  title: Rect;
  /** The pool search field, or null when it folds to `searchIcon` (the largest text, a narrow phone). */
  search: Rect | null;
  searchIcon: Rect | null;
  filter: Rect;
  /** Cards, Warchest, Style: over the command column. */
  tabs: Rect;
}

/**
 * The builder's top bar (D-Cards). `titleW` is the deck name's measured
 * width; the title takes it, as far as the search keeps its floor. At the
 * largest text, or when the field would fall under its floor, the search
 * folds to an icon beside Filters (D-Cards130).
 */
export function builderTopBar(content: Rect, titleW: number, largeText: boolean): BuilderTopBar {
  const B = BUILDER_COMPACT;
  const { touch, gap } = COMPACT;
  const shell = compactShell(content, { back: true });
  const column = shell.column!;
  const y = content.y;
  const tabs = { x: column.x, y, width: column.width, height: touch };
  const filter = { x: column.x - gap - touch, y, width: touch, height: touch };
  const titleX = shell.title.x;
  const room = filter.x - gap - titleX;
  const fieldRoom = room - Math.max(B.titleMinW, Math.ceil(titleW)) - gap * 2;
  if (!largeText && fieldRoom >= B.searchMinW) {
    const searchW = Math.max(B.searchMinW, room - Math.ceil(titleW) - gap * 2);
    const search = { x: filter.x - gap - searchW, y, width: searchW, height: touch };
    return {
      back: { x: content.x, y, width: touch, height: touch },
      title: { x: titleX, y, width: Math.max(0, search.x - gap * 2 - titleX), height: touch },
      search,
      searchIcon: null,
      filter,
      tabs,
    };
  }
  const searchIcon = { x: filter.x - gap - touch, y, width: touch, height: touch };
  return {
    back: { x: content.x, y, width: touch, height: touch },
    title: { x: titleX, y, width: Math.max(0, searchIcon.x - gap * 2 - titleX), height: touch },
    search: null,
    searchIcon,
    filter,
    tabs,
  };
}

export interface PoolGrid {
  columns: number;
  cardW: number;
  cardH: number;
  /** Down from a row's top to its chip line's top; the chip line's height. */
  chipY: number;
  chipH: number;
  pitchX: number;
  pitchY: number;
}

/**
 * The pool across a pane, less the scroll thumb's lane: as many columns as
 * keep the faces at `minCardW` (the desktop passes its larger floor), one fewer at the largest text so the faces
 * grow (D-Cards130). Each card has a chip line under it, `chipH` tall.
 */
export function poolGrid(paneWidth: number, chipH: number, largeText: boolean, minCardW: number = BUILDER_COMPACT.minCardW): PoolGrid {
  const B = BUILDER_COMPACT;
  const width = Math.max(0, paneWidth - B.thumbLane);
  const fit = Math.max(1, Math.floor((width + B.gridGap) / (minCardW + B.gridGap)));
  const columns = Math.max(1, fit - (largeText ? 1 : 0));
  const cardW = Math.floor((width - B.gridGap * (columns - 1)) / columns);
  const cardH = Math.round(cardW * ASPECT);
  const chipY = cardH + B.chipGap;
  return { columns, cardW, cardH, chipY, chipH, pitchX: cardW + B.gridGap, pitchY: chipY + chipH + B.rowGap };
}

export function poolHeight(grid: PoolGrid, count: number): number {
  const rows = Math.ceil(count / grid.columns);
  return rows === 0 ? 0 : rows * grid.pitchY - BUILDER_COMPACT.rowGap;
}

/** The count pill and the add-to-cap chip on a card's chip line, card-local x. */
export function poolChips(grid: PoolGrid): { count: { x: number; width: number }; all: { x: number; width: number } } {
  const countW = Math.min(BUILDER_COMPACT.countPillW, Math.floor((grid.cardW - 4) / 2));
  return { count: { x: 0, width: countW }, all: { x: countW + 4, width: Math.max(0, grid.cardW - countW - 4) } };
}

export interface PoolHit {
  index: number;
  /** The card (add one), or the add-to-cap chip (fill to the cap). */
  part: 'card' | 'all';
}

/**
 * The card under a point (pane-local x, content-local y), or null over a gap.
 * A card's chip line counts as the card, but its add-to-cap half, and the
 * row gap under it, are that chip's: the chip is drawn short, and its touch
 * band runs from the face's foot to the next row.
 */
export function poolHitAt(grid: PoolGrid, count: number, x: number, y: number, hasAll: (index: number) => boolean): PoolHit | null {
  if (x < 0 || y < 0) return null;
  const column = Math.floor(x / grid.pitchX);
  const row = Math.floor(y / grid.pitchY);
  const localX = x - column * grid.pitchX;
  const localY = y - row * grid.pitchY;
  if (column >= grid.columns || localX > grid.cardW) return null;
  const index = row * grid.columns + column;
  if (index >= count) return null;
  if (localY > grid.cardH && hasAll(index) && localX >= poolChips(grid).all.x) return { index, part: 'all' };
  if (localY > grid.chipY + grid.chipH) return null;
  return { index, part: 'card' };
}

/** The scroll that keeps card `index` in a pane `paneH` tall, from `offset`. */
export function poolScrollToShow(grid: PoolGrid, index: number, paneH: number, offset: number): number {
  const top = Math.floor(index / grid.columns) * grid.pitchY;
  const bottom = top + grid.chipY + grid.chipH;
  if (top < offset) return top;
  if (bottom > offset + paneH) return bottom - paneH;
  return offset;
}

/** A Darlings deck's main pane (D-Darlings): her zone at the left, the pool beside it. */
export function darlingSplit(main: Rect, largeText: boolean): { zone: Rect; pool: Rect } {
  const B = BUILDER_COMPACT;
  const zoneW = Math.min(largeText ? B.zoneWLarge : B.zoneW, Math.floor(main.width / 3));
  return {
    zone: { x: main.x, y: main.y, width: zoneW, height: main.height },
    pool: { x: main.x + zoneW + B.zoneGap, y: main.y, width: Math.max(0, main.width - zoneW - B.zoneGap), height: main.height },
  };
}

export interface BuilderFoot {
  /** The deck code button (Export and Import), then Save deck or Fix deck. */
  code: Rect;
  save: Rect;
}

/** The column's foot, shared by the Cards, Warchest and Style views. */
export function builderFoot(column: Rect): BuilderFoot {
  const B = BUILDER_COMPACT;
  const y = column.y + column.height - COMPACT.touch;
  return {
    code: { x: column.x, y, width: B.codeW, height: COMPACT.touch },
    save: { x: column.x + B.codeW + COMPACT.gap, y, width: Math.max(0, column.width - B.codeW - COMPACT.gap), height: COMPACT.touch },
  };
}

export interface CardsColumn extends BuilderFoot {
  /** The deck list, scrolling. */
  list: Rect;
  /** The issue line (when there is one), the counts and the curve, stacked over the foot. */
  status: Rect;
  stats: Rect;
}

/**
 * The Cards view's column (D-Cards): the deck list from the top, then the
 * status line and the stats, measured, over the foot. The list gives way
 * first; it keeps at least one row.
 */
export function cardsColumn(column: Rect, statusH: number, statsH: number): CardsColumn {
  const gap = COMPACT.gap;
  const foot = builderFoot(column);
  const statsY = foot.code.y - gap - statsH;
  const statusY = statusH > 0 ? statsY - gap - statusH : statsY;
  const listBottom = Math.max(column.y + COMPACT.touch, statusY - gap);
  return {
    ...foot,
    list: { x: column.x, y: column.y, width: column.width, height: listBottom - column.y },
    status: { x: column.x, y: statusY, width: column.width, height: statusH },
    stats: { x: column.x, y: statsY, width: column.width, height: statsH },
  };
}

export interface CurveLayout {
  /** Each mana value's bar centre, 0 to 7+. */
  xs: number[];
  barW: number;
  /** The bars' baseline, and their tallest; the counts sit over the bars, the labels under the baseline. */
  baseY: number;
  maxBarH: number;
  /** The pip counts' lane, right of the bars. */
  pips: Rect;
}

/** The mana curve inside `rect`: eight bars with counts over them and labels under, the pip counts at the right. */
export function curveLayout(rect: Rect, countH: number, labelH: number): CurveLayout {
  const B = BUILDER_COMPACT;
  const barsW = Math.max(0, rect.width - B.pipLane - COMPACT.gap);
  const pitch = barsW / 8;
  const baseY = rect.y + rect.height - labelH - 2;
  return {
    xs: Array.from({ length: 8 }, (_, i) => rect.x + pitch * (i + 0.5)),
    barW: Math.max(4, Math.min(14, pitch - 8)),
    baseY,
    maxBarH: Math.max(4, baseY - rect.y - countH - 2),
    pips: { x: rect.x + rect.width - B.pipLane, y: rect.y, width: B.pipLane, height: rect.height },
  };
}

export interface WarchestMain {
  /** The ten reserve slots, five across, two down. */
  slots: Rect[];
  /** The format's rules, under the slots. */
  rules: Rect;
}

/** The Warchest view's centre (D-Warchest): the slots, as tall as the room under them leaves, then the rules. */
export function warchestMain(main: Rect, rulesH: number, slotCount = 10): WarchestMain {
  const B = BUILDER_COMPACT;
  const columns = B.slotColumns;
  const rows = Math.ceil(slotCount / columns);
  const tileW = Math.floor((main.width - B.slotGap * (columns - 1)) / columns);
  const room = main.height - rulesH - B.slotGap - B.slotGap * (rows - 1);
  const tileH = Math.max(COMPACT.touch, Math.min(Math.round(tileW * B.slotAspect), Math.floor(room / rows)));
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    x: main.x + (i % columns) * (tileW + B.slotGap),
    y: main.y + Math.floor(i / columns) * (tileH + B.slotGap),
    width: tileW,
    height: tileH,
  }));
  const rulesY = main.y + rows * tileH + (rows - 1) * B.slotGap + B.slotGap;
  return { slots, rules: { x: main.x, y: rulesY, width: main.width, height: Math.max(0, main.y + main.height - rulesY) } };
}

export interface DecksScreen {
  /** The previewed deck's face. */
  face: Rect;
  /** Its name, format, count and hero image line, right of the face. */
  info: Rect;
  /** Copy, Rename and Delete, under the info. */
  actions: Rect[];
  /** The decks, down the column. */
  list: Rect;
  /** New deck and Use at the column's foot. */
  newDeck: Rect;
  use: Rect;
}

/** Your Decks (D-Decks): the previewed deck in the main pane, the list in the column. */
export function decksScreen(content: Rect, largeText: boolean): DecksScreen {
  const B = BUILDER_COMPACT;
  const { touch, gap } = COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column!;
  const footY = content.y + content.height - touch;
  const faceW = Math.max(0, Math.min(largeText ? 130 : B.deckFaceMaxW, Math.floor((footY - gap - main.y) / ASPECT), Math.floor(main.width / 3)));
  const face = { x: main.x, y: main.y, width: faceW, height: Math.round(faceW * ASPECT) };
  const infoX = face.x + faceW + B.deckGap;
  const infoW = Math.max(0, main.x + main.width - infoX);
  const actionW = (infoW - gap * 2) / 3;
  const actions = [0, 1, 2].map((i) => ({ x: infoX + i * (actionW + gap), y: footY, width: actionW, height: touch }));
  const half = (column.width - gap) / 2;
  return {
    face,
    info: { x: infoX, y: main.y, width: infoW, height: Math.max(0, footY - gap - main.y) },
    actions,
    list: { x: column.x, y: column.y, width: column.width, height: Math.max(0, footY - gap - column.y) },
    newDeck: { x: column.x, y: footY, width: half, height: touch },
    use: { x: column.x + half + gap, y: footY, width: half, height: touch },
  };
}

/** Tiles across a sheet's body, `columns` across and as many rows as `count` needs, sharing the height. */
export function tileGrid(body: Rect, count: number, columns: number, gap: number = COMPACT.gap): Rect[] {
  const rows = Math.max(1, Math.ceil(count / columns));
  const w = (body.width - gap * (columns - 1)) / columns;
  const h = Math.max(COMPACT.touch, (body.height - gap * (rows - 1)) / rows);
  return Array.from({ length: count }, (_, i) => ({
    x: body.x + (i % columns) * (w + gap),
    y: body.y + Math.floor(i / columns) * (h + gap),
    width: w,
    height: h,
  }));
}

export interface PoolFilterLayout {
  set: Rect;
  color: Rect;
  type: Rect;
  rarity: Rect;
  sort: Rect;
  /** Under the last facet. */
  bottom: number;
}

/**
 * The pool's facets in the column (D-PoolFilters), from `top`: Set across the
 * column, then Color and Type, Rarity and Sort two by two. At the largest
 * text each facet takes its own row, so its value keeps its words.
 */
export function poolFilterLayout(column: Rect, top: number, controlH: number, largeText: boolean): PoolFilterLayout {
  const gap = COMPACT.gap;
  const full = (row: number): Rect => ({ x: column.x, y: top + row * (controlH + gap), width: column.width, height: controlH });
  if (largeText) {
    return { set: full(0), color: full(1), type: full(2), rarity: full(3), sort: full(4), bottom: top + 5 * controlH + 4 * gap };
  }
  const half = (column.width - gap) / 2;
  const pair = (row: number, right: boolean): Rect => ({ ...full(row), x: column.x + (right ? half + gap : 0), width: half });
  return { set: full(0), color: pair(1, false), type: pair(1, true), rarity: pair(2, false), sort: pair(2, true), bottom: top + 3 * controlH + 2 * gap };
}

/**
 * A deck row's second line, after its count and cost (D-Cards): a creature's
 * power and toughness and its kinds ("2/2 · Beastkin Bird"), anything else
 * its card type ("Charm").
 */
export function deckRowDetail(card: { types: readonly string[]; subtypes: readonly string[]; attack?: number; defense?: number }): string {
  const types = card.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  if (card.types.includes('creature') && card.attack !== undefined && card.defense !== undefined) {
    return [`${card.attack}/${card.defense}`, card.subtypes.join(' ')].filter(Boolean).join(' · ');
  }
  return types;
}

/** A Darling's name over her title (D-Darlings): "Bastet" and "Mistress of the Ninth Return". */
export function splitDarlingName(name: string): { name: string; title: string | null } {
  const comma = name.indexOf(', ');
  return comma < 0 ? { name, title: null } : { name: name.slice(0, comma), title: name.slice(comma + 2) };
}

/** The row under `y` in a stacked list, each row from `tops[i]` and `heights[i]` tall, or -1 in a gap or past the end. */
export function stackedRowAt(tops: readonly number[], heights: readonly number[], y: number): number {
  return tops.findIndex((top, i) => y >= top && y < top + heights[i]);
}
