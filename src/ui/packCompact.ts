/**
 * Phaser-free geometry for the compact Pack Opening (Version C S-Pack-Tear,
 * S-Pack-Reveal, S-Pack-Spotlight, S-Pack-Inspect, S-Pack-Results). One
 * layout serves the phone and the desktop pass: every size is the mock's
 * phone size times `k`, the content box's size over the reference phone's
 * (718x356), so a desktop window shows the same composition, larger.
 *
 * The screen: the back chevron at the top left, the Common and Rare tiles in
 * rows across the main area beside it, and the command column on the right
 * with the face-down specials (SR and up) above its foot (Skip, then Menu and
 * Open another).
 */

import type { Rect } from './layout';

export const PACK_COMPACT = {
  /** The reference phone's content box (phone-island): k = 1 here. */
  ref: { width: 718, height: 356 },
  /** k stops here, so a wide desktop keeps the tiles at a sane size. */
  maxK: 1.6,
  columnW: 230,
  gap: 12,
  back: 44,
  /** A grid tile at k = 1, and its height over its width. */
  tileW: 94,
  aspect: 132 / 94,
  tileGap: 12,
  /** The band above each tile row that holds its "+5", "★ New" pills. */
  badgeH: 26,
  /** A face-down special at k = 1. */
  specialW: 108,
  specialGap: 14,
  /** The tier tab above each special, and the caption under it once face up (pill, then frame and holo). */
  tabH: 30,
  captionH: 56,
  /** The pack waiting for its tear, and its prompt's band under it. */
  pack: { width: 196, height: 280 },
  promptH: 36,
} as const;

export interface PackCompactFrame {
  /** Every size below is the mock's times this. */
  k: number;
  back: Rect;
  /** The tile rows' area: right of the back chevron, left of the column. */
  main: Rect;
  column: Rect;
  /** The column's foot: Skip, then Menu and Open another. */
  foot: Rect;
}

/** The frame for a content box, with the column widened to `columnW` when the specials need it. */
export function packCompactFrame(content: Rect, footH: number, columnW?: number): PackCompactFrame {
  const P = PACK_COMPACT;
  const k = packScale(content);
  const back = { x: content.x, y: content.y, width: P.back, height: P.back };
  const colW = Math.round(columnW ?? P.columnW * k);
  const column = { x: content.x + content.width - colW, y: content.y, width: colW, height: content.height };
  const mainX = back.x + back.width + P.gap;
  const main = { x: mainX, y: content.y, width: Math.max(0, column.x - P.gap - mainX), height: content.height };
  const foot = { x: column.x, y: column.y + column.height - footH, width: colW, height: footH };
  return { k, back, main, column, foot };
}

/** The content box's size over the reference phone's, between 1 and `maxK`. */
export function packScale(content: Rect): number {
  const k = Math.min(content.width / PACK_COMPACT.ref.width, content.height / PACK_COMPACT.ref.height);
  return Math.max(1, Math.min(PACK_COMPACT.maxK, k));
}

export interface PackTileRows {
  /** One rect per tile, in the order given; a tile's badge band sits right above it. */
  cells: Rect[];
  badgeH: number;
}

/**
 * The Common and Rare tiles: one to three rows, whichever keeps them largest
 * (ties go to fewer rows), each row centred, the block centred in `area`.
 * Never wider than the mock's 94 px times k.
 */
export function packTileRows(area: Rect, count: number, k: number): PackTileRows {
  const P = PACK_COMPACT;
  const badgeH = Math.round(P.badgeH * k);
  const gap = Math.round(P.tileGap * k);
  if (count <= 0) return { cells: [], badgeH };
  let best: { rows: number; w: number } | null = null;
  for (let rows = 1; rows <= Math.min(3, count); rows++) {
    const perRow = Math.ceil(count / rows);
    const byWidth = (area.width - (perRow - 1) * gap) / perRow;
    const byHeight = (area.height - rows * badgeH - (rows - 1) * gap) / rows / P.aspect;
    const w = Math.min(P.tileW * k, byWidth, byHeight);
    if (!best || w > best.w + 1e-6) best = { rows, w };
  }
  const { rows } = best!;
  const w = Math.floor(best!.w);
  const h = Math.floor(w * P.aspect);
  const perRow = Math.ceil(count / rows);
  const blockH = rows * (badgeH + h) + (rows - 1) * gap;
  const top = area.y + Math.max(0, (area.height - blockH) / 2);
  const cells: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const rowW = inRow * w + (inRow - 1) * gap;
    const x = area.x + (area.width - rowW) / 2 + (i - row * perRow) * (w + gap);
    cells.push({ x: Math.round(x), y: Math.floor(top + row * (badgeH + h + gap) + badgeH), width: w, height: h });
  }
  return { cells, badgeH };
}

export interface PackSpecialSlots {
  /** One rect per special, worst to best; its tab sits above it and its caption under it. */
  cells: Rect[];
  tabH: number;
  captionH: number;
}

/**
 * The specials in the column, above its foot: one or two rows, each card
 * with its tier tab above and the room for its caption (New pill, frame and
 * holo) below, so nothing moves when they turn face up.
 */
export function packSpecialSlots(area: Rect, count: number, k: number): PackSpecialSlots {
  const P = PACK_COMPACT;
  const tabH = Math.round(P.tabH * k);
  const captionH = Math.round(P.captionH * k);
  const gap = Math.round(P.specialGap * k);
  if (count <= 0) return { cells: [], tabH, captionH };
  let best: { rows: number; w: number } | null = null;
  for (let rows = 1; rows <= Math.min(2, count); rows++) {
    const perRow = Math.ceil(count / rows);
    const byWidth = (area.width - (perRow - 1) * gap) / perRow;
    const byHeight = (area.height - rows * (tabH + captionH)) / rows / P.aspect;
    const w = Math.min(P.specialW * k, byWidth, byHeight);
    if (!best || w > best.w + 1e-6) best = { rows, w };
  }
  const { rows } = best!;
  const w = Math.floor(best!.w);
  const h = Math.floor(w * P.aspect);
  const perRow = Math.ceil(count / rows);
  const rowH = tabH + h + captionH;
  const top = area.y + Math.max(0, (area.height - rows * rowH) / 2);
  const cells: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const rowW = inRow * w + (inRow - 1) * gap;
    const x = area.x + (area.width - rowW) / 2 + (i - row * perRow) * (w + gap);
    cells.push({ x: Math.round(x), y: Math.floor(top + row * rowH + tabH), width: w, height: h });
  }
  return { cells, tabH, captionH };
}

/**
 * The column width that keeps both groups largest: the column grows into the
 * main area while that makes the smaller group (by its share of the mock's
 * size) bigger, and never drops below the mock's 230 px times k.
 */
export function packColumnWidth(content: Rect, gridCount: number, specialCount: number, footH: number): number {
  const k = packScale(content);
  const min = Math.round(PACK_COMPACT.columnW * k);
  const max = Math.round(content.width * 0.75);
  let best = { colW: min, score: -1 };
  for (let colW = min; colW <= max; colW += 2) {
    const frame = packCompactFrame(content, footH, colW);
    const tiles = packTileRows(frame.main, gridCount, k);
    const specials = packSpecialSlots(specialArea(frame), specialCount, k);
    const tileShare = gridCount > 0 ? tiles.cells[0].width / (PACK_COMPACT.tileW * k) : 1;
    const specialShare = specialCount > 0 ? specials.cells[0].width / (PACK_COMPACT.specialW * k) : 1;
    const score = Math.min(tileShare, specialShare);
    if (score > best.score + 1e-6) best = { colW, score };
  }
  return best.colW;
}

/** The column's room for the specials: above the foot, one gap clear of it. */
export function specialArea(frame: PackCompactFrame): Rect {
  const { column, foot } = frame;
  return { x: column.x, y: column.y, width: column.width, height: Math.max(0, foot.y - PACK_COMPACT.gap - column.y) };
}

/** The pack waiting for its tear, centred in the content box over its prompt. */
export function packTearLayout(content: Rect): { pack: Rect; promptY: number } {
  const k = packScale(content);
  const promptH = PACK_COMPACT.promptH * k;
  const h = Math.min(PACK_COMPACT.pack.height * k, content.height - promptH - 16 * k);
  const w = h * (PACK_COMPACT.pack.width / PACK_COMPACT.pack.height);
  const top = content.y + (content.height - h - promptH) / 2;
  return {
    pack: { x: content.x + (content.width - w) / 2, y: top, width: w, height: h },
    promptY: top + h + promptH / 2,
  };
}

/**
 * The best card's spotlight (S-Pack-Spotlight): the full card about the
 * content box's height, centred on the screen, with its tier and finish
 * beside it on the right and "tap to skip" under it.
 */
export function packSpotlightLayout(content: Rect, cardAspect: number): { card: Rect; side: { x: number; y: number }; hintY: number } {
  const k = packScale(content);
  const hint = 22 * k;
  const h = content.height - hint;
  const w = h / cardAspect;
  const card = { x: content.x + (content.width - w) / 2, y: content.y, width: w, height: h };
  return { card, side: { x: card.x + w + 24 * k, y: card.y + h * 0.42 }, hintY: card.y + h + hint / 2 };
}

/**
 * A pull's inspect (S-Pack-Inspect): the full card centred over the main
 * area, its details panel at the top of the column, Previous, Next and Close
 * in the foot.
 */
export function packInspectCompact(frame: PackCompactFrame, cardAspect: number): { card: Rect; details: Rect } {
  const { column, foot } = frame;
  const contentTop = column.y;
  const h = column.height;
  const w = h / cardAspect;
  const left = frame.back.x;
  const centre = left + (column.x - PACK_COMPACT.gap - left) / 2;
  const card = { x: centre - w / 2, y: contentTop, width: w, height: h };
  const details = { x: column.x, y: column.y, width: column.width, height: Math.max(0, foot.y - PACK_COMPACT.gap - column.y) };
  return { card, details };
}

export interface PackBatchLayout {
  k: number;
  back: Rect;
  /** The heading beside the back chevron ("Opened 10 packs"). */
  title: Rect;
  /** The scrolling grid of the batch's best pulls, under the heading. */
  grid: Rect;
  column: Rect;
  /** The column's stats, above its foot. */
  stats: Rect;
  foot: Rect;
}

/**
 * A multi-pack open's summary (S-Pack-Batch): the heading beside the back
 * chevron, the best pulls in a scrolling grid under it, and the column with
 * the batch's stats over Menu and the re-buy.
 */
export function packBatchLayout(content: Rect, footH: number): PackBatchLayout {
  const P = PACK_COMPACT;
  const k = packScale(content);
  const colW = Math.round(P.columnW * k);
  const back = { x: content.x, y: content.y, width: P.back, height: P.back };
  const column = { x: content.x + content.width - colW, y: content.y, width: colW, height: content.height };
  const mainW = column.x - P.gap - content.x;
  const title = { x: back.x + back.width + P.gap, y: content.y, width: mainW - back.width - P.gap, height: P.back };
  const gridTop = back.y + back.height + P.gap;
  const grid = { x: content.x, y: gridTop, width: mainW, height: content.y + content.height - gridTop };
  const foot = { x: column.x, y: column.y + column.height - footH, width: colW, height: footH };
  const stats = { x: column.x, y: column.y + P.back + P.gap, width: colW, height: Math.max(0, foot.y - P.gap - column.y - P.back - P.gap) };
  return { k, back, title, grid, column, stats, foot };
}

/** The summary's tiles: as many columns as fit at the mock's 88 px (times k), the tiles stretched to fill the row. */
export function packBatchGrid(area: Rect, count: number, k: number): { cells: Rect[]; contentH: number } {
  const maxW = 88 * k;
  const gap = Math.round(10 * k);
  const cols = Math.max(1, Math.floor((area.width + gap) / (maxW * 0.9 + gap)));
  const w = Math.floor(Math.min(maxW * 1.15, (area.width - (cols - 1) * gap) / cols));
  const h = Math.floor(w * PACK_COMPACT.aspect);
  const rowW = cols * w + (cols - 1) * gap;
  const left = area.x + Math.floor((area.width - rowW) / 2);
  const cells = Array.from({ length: count }, (_, i) => ({
    x: left + (i % cols) * (w + gap), y: Math.floor(i / cols) * (h + gap), width: w, height: h,
  }));
  const rows = Math.ceil(count / cols);
  return { cells, contentH: rows > 0 ? rows * h + (rows - 1) * gap : 0 };
}
