/**
 * The Collection's compact (phone) composition, Phaser-free (mocks D-Binder,
 * D-Binder130, D-BinderSet, D-Detail, D-Detail130, D-Craft, D-CraftConfirm
 * and D-Shard; docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * The binder's two-page spreads become one vertical grid in the main pane,
 * with the search field in the top bar. The command column carries the
 * filters (a picker takes the column over while it is open) and, at its
 * foot, the collected counter. A card's detail fills the screen: the face on
 * the left, its odds and keyword guide in the middle over Previous and Next,
 * and its variants (or the craft price) in the right column with the actions
 * at its foot. Coordinates are compact design px inside the content box.
 */

import { COMPACT } from './compactLayout';
import type { Rect } from './layout';

export const COLLECTION_COMPACT = {
  /** A binder card's narrowest face; columns drop before faces shrink under it. */
  minCardW: 92,
  /** Between two cards, across; and between a card's badge line and the next row. */
  gridGap: 8,
  rowGap: 10,
  /** The badge line under each face (tier, specials, count). */
  badgeGap: 3,
  /** The grid's scroll thumb lane, right of the cards. */
  thumbLane: 7,
  /** The counter plate's padding, and its progress bar's height. */
  counterPad: 10,
  barH: 5,
  /** Detail: between its three columns. */
  detailGap: 12,
  /** Detail: the face's widest (largest text shrinks it so the reading panel keeps its room). */
  faceMaxW: 260,
  faceMaxWLarge: 200,
  /** Detail: the middle column's floor; the face gives way before it does. */
  middleMin: 180,
  /** Detail: between the plates in the middle and right columns. */
  plateGap: 8,
  platePad: 10,
} as const;

/** Card faces are 300x420. */
const ASPECT = 1.4;

export interface BinderGrid {
  columns: number;
  cardW: number;
  cardH: number;
  /** Across from one card's left to the next; down from one row's top to the next. */
  pitchX: number;
  pitchY: number;
}

/**
 * The binder grid across the main pane, less the scroll thumb's lane. Cards
 * take the pane's width in as many columns as keep them at `minCardW`; at the
 * largest text the grid drops a column so the faces grow (D-Binder130).
 */
export function binderGrid(paneWidth: number, badgeH: number, largeText: boolean): BinderGrid {
  const C = COLLECTION_COMPACT;
  const width = Math.max(0, paneWidth - C.thumbLane);
  const fit = Math.max(1, Math.floor((width + C.gridGap) / (C.minCardW + C.gridGap)));
  const columns = Math.max(1, fit - (largeText ? 1 : 0));
  const cardW = Math.floor((width - C.gridGap * (columns - 1)) / columns);
  const cardH = Math.round(cardW * ASPECT);
  return { columns, cardW, cardH, pitchX: cardW + C.gridGap, pitchY: cardH + C.badgeGap + badgeH + C.rowGap };
}

/** The rows a binder of `count` cards needs, and its content height. */
export function binderHeight(grid: BinderGrid, count: number): number {
  const rows = Math.ceil(count / grid.columns);
  return rows === 0 ? 0 : rows * grid.pitchY - COLLECTION_COMPACT.rowGap;
}

/**
 * The card under a point in the grid (pane-local x, content-local y), or
 * null over a gap between cards. A card's badge line counts as the card.
 */
export function binderCellAt(grid: BinderGrid, count: number, x: number, y: number): number | null {
  if (x < 0 || y < 0) return null;
  const column = Math.floor(x / grid.pitchX);
  const row = Math.floor(y / grid.pitchY);
  if (column >= grid.columns || x - column * grid.pitchX > grid.cardW) return null;
  if (y - row * grid.pitchY > grid.pitchY - COLLECTION_COMPACT.rowGap) return null;
  const index = row * grid.columns + column;
  return index < count ? index : null;
}

export interface BinderColumn {
  /** Set, then Color and Type side by side, then Rarity and Owned only, then Sort. */
  set: Rect;
  color: Rect;
  type: Rect;
  rarity: Rect;
  owned: Rect;
  sort: Rect;
  /** The collected counter: at the column's foot, or straight under Sort when they do not fit apart. */
  counter: Rect;
  /** The whole block's height; past the column's, it scrolls. */
  height: number;
}

/**
 * The filter column (D-Binder): four rows of controls from the top, each
 * `controlH` tall (taller at larger text, when a control's label and value
 * stack), and the counter `counterH` tall at the foot, under the right thumb
 * where the other screens keep their primary action. Rects are relative to
 * the column's top-left.
 */
export function binderColumn(width: number, height: number, controlH: number, counterH: number): BinderColumn {
  const gap = COMPACT.gap;
  const h = Math.max(COMPACT.touch, controlH);
  const half = (width - gap) / 2;
  const row = (i: number): number => i * (h + gap);
  const controlsBottom = row(3) + h;
  const counterY = Math.max(controlsBottom + gap, height - counterH);
  return {
    set: { x: 0, y: row(0), width, height: h },
    color: { x: 0, y: row(1), width: half, height: h },
    type: { x: half + gap, y: row(1), width: half, height: h },
    rarity: { x: 0, y: row(2), width: half, height: h },
    owned: { x: half + gap, y: row(2), width: half, height: h },
    sort: { x: 0, y: row(3), width, height: h },
    counter: { x: 0, y: counterY, width, height: counterH },
    height: counterY + counterH,
  };
}

export interface CompactInspectLayout {
  /** The card face, top-left of the content box. */
  face: Rect;
  /** The middle column: odds and keyword guide (and, at larger text, the reading panel), scrolling. */
  middle: Rect;
  /** Previous and Next, under the middle column. */
  previous: Rect;
  next: Rect;
  /** The right column: its heading beside the close button, then the variants (or the price), then the actions. */
  right: Rect;
  close: Rect;
  heading: Rect;
  /** Under the heading, above the actions. */
  list: Rect;
}

/**
 * The card detail across the whole content box (D-Detail). The right column
 * keeps the shell's width so its actions sit where the binder's counter was;
 * the face takes the content box's height up to its cap, and gives way to
 * the middle column's floor on narrow phones. `actionsH` is the actions'
 * stack, measured; the list takes the room between it and the heading.
 */
export function compactInspectLayout(content: Rect, largeText: boolean, actionsH: number): CompactInspectLayout {
  const C = COLLECTION_COMPACT;
  const rightW = Math.min(COMPACT.columnW, content.width / 3);
  const cap = largeText ? C.faceMaxWLarge : C.faceMaxW;
  const faceW = Math.max(0, Math.min(cap, content.height / ASPECT, content.width - rightW - 2 * C.detailGap - C.middleMin));
  const face = { x: content.x, y: content.y, width: faceW, height: faceW * ASPECT };
  const middleX = face.x + faceW + C.detailGap;
  const right = { x: content.x + content.width - rightW, y: content.y, width: rightW, height: content.height };
  const middleW = Math.max(0, right.x - C.detailGap - middleX);
  const navY = content.y + content.height - COMPACT.touch;
  const navW = (middleW - COMPACT.gap) / 2;
  const close = { x: right.x + right.width - COMPACT.touch, y: right.y, width: COMPACT.touch, height: COMPACT.touch };
  const heading = { x: right.x, y: right.y, width: Math.max(0, close.x - COMPACT.gap - right.x), height: COMPACT.touch };
  const listY = heading.y + heading.height + COMPACT.gap;
  const listBottom = right.y + right.height - (actionsH > 0 ? actionsH + COMPACT.gap : 0);
  return {
    face,
    middle: { x: middleX, y: content.y, width: middleW, height: Math.max(0, navY - COMPACT.gap - content.y) },
    previous: { x: middleX, y: navY, width: navW, height: COMPACT.touch },
    next: { x: middleX + navW + COMPACT.gap, y: navY, width: navW, height: COMPACT.touch },
    right,
    close,
    heading,
    list: { x: right.x, y: listY, width: right.width, height: Math.max(0, listBottom - listY) },
  };
}

/** Items of `heights` stacked up from `bottom` with `gap` between: each one's top, top to bottom. */
export function stackUp(bottom: number, heights: readonly number[], gap: number): number[] {
  const tops: number[] = [];
  let cursor = bottom;
  for (let i = heights.length - 1; i >= 0; i--) {
    cursor -= heights[i];
    tops[i] = cursor;
    cursor -= gap;
  }
  return tops;
}
