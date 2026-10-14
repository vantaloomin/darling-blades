/**
 * The Shop's compact (phone) composition, Phaser-free (mocks S-Shop-Packs,
 * S-Shop-Packs-130, S-Shop-Packs-Short, S-Shop-Decks, S-Shop-Darlings,
 * S-Shop-DeckConfirm, S-Shop-DeckShort and S-Shop-Odds;
 * docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * The tabs move into the top bar. Card Packs is a strip of packs across the
 * main pane, the chosen one large with a gold outline; the column names it
 * and carries the drop rates, the quantity and Buy. Decks is a grid of deck
 * tiles; the column carries the Standard and Darling tabs, the chosen deck's
 * identity, Preview deck and the one commit action. The drop rates and the
 * deck preview are sheets over the main pane and the top bar, with the column
 * beside them still live. Coordinates are compact design px.
 */

import { COMPACT, compactShell } from './compactLayout';
import type { Rect } from './layout';

export const SHOP_COMPACT = {
  /** The Card Packs | Decks tabs in the top bar. */
  tabsW: 250,
  /** Packs: between two packs, the chosen pack's outline inset, and a small pack's share of the chosen one's height. */
  packGap: 20,
  packInset: 4,
  smallPack: 0.72,
  /** Packs are 280x400. */
  packAspect: 0.7,
  /** Between a small pack and its name. */
  packLabelGap: 8,
  /** Desktop: the chosen pack's share of the pane's height, and a small pack's share of the chosen one's, so more packs show at once. */
  desktopBigPack: 0.8,
  desktopSmallPack: 0.62,
  /** Decks: the narrowest tile, the gap between tiles, the tile's inner padding, and the art's height over its width. */
  deckMinW: 120,
  deckGap: 8,
  deckPad: 6,
  deckArtAspect: 0.54,
  /** Desktop: the tallest the art may grow (height over width) while the tiles fill the pane; still a crop of the 2:3 portrait. */
  deckArtAspectMax: 1.2,
  /** The grid's scroll thumb lane. */
  thumbLane: 7,
  /** The sheets' inner padding, and the gap between their two columns. */
  sheetPad: 14,
  sheetGap: 16,
} as const;

export interface PackStripItem {
  /** The pack art, strip-local x, pane y. */
  art: Rect;
  /** A small pack's name under it; the chosen one is named in the column. */
  label: Rect | null;
}

export interface PackStrip {
  items: PackStripItem[];
  /** The strip's full width, the trailing gap left out. */
  width: number;
}

/**
 * The packs across the main pane (S-Shop-Packs): the chosen one as tall as
 * the pane, the rest smaller and named under, all centred on one line.
 * On desktop the chosen pack takes most of the pane's height and the rest
 * shrink further, so three or more packs show at once.
 */
export function packStrip(main: Rect, count: number, selected: number, labelH: number, opts: { desktop?: boolean } = {}): PackStrip {
  const S = SHOP_COMPACT;
  const bigH = Math.max(0, (main.height - S.packInset * 2) * (opts.desktop ? S.desktopBigPack : 1));
  const bigW = Math.round(bigH * S.packAspect);
  const centerY = main.y + main.height / 2;
  const smallH = Math.round(Math.min(bigH * (opts.desktop ? S.desktopSmallPack : S.smallPack), bigH - labelH - S.packLabelGap));
  const smallW = Math.round(smallH * S.packAspect);
  const smallTop = centerY - (smallH + S.packLabelGap + labelH) / 2;
  const items: PackStripItem[] = [];
  let x = S.packInset;
  for (let i = 0; i < count; i++) {
    if (i === selected) {
      items.push({ art: { x, y: centerY - bigH / 2, width: bigW, height: bigH }, label: null });
      x += bigW;
    } else {
      items.push({
        art: { x, y: smallTop, width: smallW, height: smallH },
        label: { x, y: smallTop + smallH + S.packLabelGap, width: smallW, height: labelH },
      });
      x += smallW;
    }
    x += S.packGap;
  }
  return { items, width: count === 0 ? 0 : x - S.packGap + S.packInset };
}

/** The strip's scroll range across a pane `paneW` wide. */
export function packStripMaxScroll(strip: PackStrip, paneW: number): number {
  return Math.max(0, strip.width - paneW);
}

/** The scroll that brings the chosen pack to the pane's left edge, as far as the strip allows. */
export function packStripScrollFor(strip: PackStrip, paneW: number, selected: number): number {
  const item = strip.items[selected];
  if (!item) return 0;
  return Math.min(packStripMaxScroll(strip, paneW), Math.max(0, item.art.x - SHOP_COMPACT.packInset));
}

/** The pack under a strip-local x (its art or its name's span), or null over a gap. */
export function packAt(strip: PackStrip, x: number): number | null {
  const index = strip.items.findIndex((item) => x >= item.art.x && x <= item.art.x + item.art.width);
  return index >= 0 ? index : null;
}

export interface DeckGrid {
  columns: number;
  tileW: number;
  tileH: number;
  artH: number;
  /** Down from the tile's top: the name's top, and the pips-and-price line's centre. */
  nameY: number;
  lineY: number;
  pitchX: number;
  pitchY: number;
}

/** Desktop: grow the tiles' art so `count` tiles fill a pane `paneH` tall. */
export interface DeckGridFill {
  paneH: number;
  count: number;
}

/**
 * The deck tiles across the main pane (S-Shop-Decks): art over the name over
 * the pips and the price. Tiles keep `deckMinW` (the desktop passes its larger floor); at the largest text the
 * grid drops a column so the names keep their room. With `fill` (the desktop)
 * a short list's art grows, up to `deckArtAspectMax`, so its rows fill the
 * pane's height instead of leaving its lower half empty; a list that already
 * scrolls keeps the phone's art.
 */
export function deckGrid(
  paneWidth: number,
  nameH: number,
  lineH: number,
  largeText: boolean,
  minTileW: number = SHOP_COMPACT.deckMinW,
  fill?: DeckGridFill,
): DeckGrid {
  const S = SHOP_COMPACT;
  const width = Math.max(0, paneWidth - S.thumbLane);
  const fit = Math.max(1, Math.floor((width + S.deckGap) / (minTileW + S.deckGap)));
  const columns = Math.max(1, fit - (largeText ? 1 : 0));
  const tileW = Math.floor((width - S.deckGap * (columns - 1)) / columns);
  const artW = tileW - S.deckPad * 2;
  let artH = Math.round(artW * S.deckArtAspect);
  const rows = fill ? Math.ceil(fill.count / columns) : 0;
  if (fill && rows > 0) {
    // Everything in a tile but its art, then the art that fills the pane's rows.
    const chrome = Math.ceil(S.deckPad + 6 + nameH + 4 + lineH + S.deckPad);
    const fillArt = Math.floor((fill.paneH + S.deckGap) / rows - S.deckGap - chrome);
    artH = Math.max(artH, Math.min(Math.round(artW * S.deckArtAspectMax), fillArt));
  }
  const nameY = S.deckPad + artH + 6;
  const lineY = nameY + nameH + 4 + lineH / 2;
  const tileH = Math.ceil(lineY + lineH / 2 + S.deckPad);
  return { columns, tileW, tileH, artH, nameY, lineY, pitchX: tileW + S.deckGap, pitchY: tileH + S.deckGap };
}

export function deckGridHeight(grid: DeckGrid, count: number): number {
  const rows = Math.ceil(count / grid.columns);
  return rows === 0 ? 0 : rows * grid.pitchY - SHOP_COMPACT.deckGap;
}

/** The tile under a point in the grid (pane-local x, content-local y), or null over a gap. */
export function deckCellAt(grid: DeckGrid, count: number, x: number, y: number): number | null {
  if (x < 0 || y < 0) return null;
  const column = Math.floor(x / grid.pitchX);
  const row = Math.floor(y / grid.pitchY);
  if (column >= grid.columns || x - column * grid.pitchX > grid.tileW || y - row * grid.pitchY > grid.tileH) return null;
  const index = row * grid.columns + column;
  return index < count ? index : null;
}

/** The scroll that keeps tile `index` in a pane `paneH` tall, from `offset`. */
export function deckScrollToShow(grid: DeckGrid, index: number, paneH: number, offset: number): number {
  const top = Math.floor(index / grid.columns) * grid.pitchY;
  if (top < offset) return top;
  if (top + grid.tileH > offset + paneH) return top + grid.tileH - paneH;
  return offset;
}

export interface ShopSheet {
  frame: Rect;
  /** The title, beside the close button. */
  title: Rect;
  close: Rect;
  /** Under the title's track. */
  body: Rect;
  /** The body's two columns (the preview's stats and its list). */
  left: Rect;
  right: Rect;
  /** The column beside the sheet, under the purse. */
  column: Rect;
}

/**
 * A sheet over the main pane and the top bar's left (S-Shop-Odds,
 * S-Shop-DeckConfirm): the frame runs the content's height up to the column,
 * whose own top drops under the purse. `headerH` is the title block, measured
 * (a deck's name over its identity line); the body starts under it.
 */
export function shopSheet(content: Rect, headerH: number): ShopSheet {
  const S = SHOP_COMPACT;
  // The column is the screen's own, so it does not move when a sheet opens.
  const column = compactShell(content).column ?? { x: content.x + content.width, y: content.y, width: 0, height: content.height };
  const frame = { x: content.x, y: content.y, width: Math.max(0, column.x - COMPACT.gap - content.x), height: content.height };
  const close = { x: frame.x + frame.width - S.sheetPad / 2 - COMPACT.touch, y: frame.y + S.sheetPad / 2, width: COMPACT.touch, height: COMPACT.touch };
  const title = { x: frame.x + S.sheetPad, y: frame.y + S.sheetPad, width: Math.max(0, close.x - COMPACT.gap - frame.x - S.sheetPad), height: Math.max(COMPACT.touch - S.sheetPad / 2, headerH) };
  const bodyY = Math.max(title.y + title.height, close.y + close.height) + COMPACT.gap;
  const body = { x: frame.x + S.sheetPad, y: bodyY, width: Math.max(0, frame.width - S.sheetPad * 2), height: Math.max(0, frame.y + frame.height - S.sheetPad - bodyY) };
  const half = Math.max(0, (body.width - S.sheetGap) / 2);
  return {
    frame,
    title,
    close,
    body,
    left: { x: body.x, y: body.y, width: half, height: body.height },
    right: { x: body.x + half + S.sheetGap, y: body.y, width: half, height: body.height },
    column,
  };
}
