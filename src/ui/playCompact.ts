/**
 * The Play hub's compact (phone) composition, Phaser-free (mocks M-Play,
 * M-PlayDarlings; docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * Version C's shell: the back chevron, "Play" and its line, and the gold in
 * the top bar; one art tile per mode across the main pane, each one tap into
 * its mode; and the command column holding the deck quick-select (what was
 * the Choose Your Deck modal) with Edit decks at its foot. Coordinates are
 * compact design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const PLAY_COMPACT = {
  /** Between two mode tiles (the mock's 13 px at 852 wide). */
  tileGap: 12,
  /** Under "Choose your deck", before the first row. */
  labelGap: 6,
  /** Between two deck rows. */
  rowGap: 8,
  /** A deck row's floor: the touch floor plus room for its two lines. */
  rowMinH: 48,
  /** The deck thumbnail's side. */
  thumbSize: 36,
  /**
   * The narrowest a tile may be in one row (its name in the h1 size, "Avatar
   * Gauntlet" on two lines). Narrower, the tiles take two rows.
   */
  minTileW: 150,
} as const;

export interface CompactPlayLayout {
  shell: CompactShell;
  /** One tile per mode, left to right. */
  tiles: Rect[];
  /** "Choose your deck": its top-left and width. */
  deckLabel: { x: number; y: number; width: number };
  /** Where the deck rows scroll (above Edit decks). */
  deckList: Rect;
  /** Edit decks, the column's foot. */
  editDecks: Rect;
}

/** `labelH` is the measured "Choose your deck" line. */
export function compactPlayLayout(content: Rect, tileCount: number, labelH: number): CompactPlayLayout {
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const tiles = compactTileGrid(main, tileCount);
  const editDecks = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const listTop = column.y + labelH + PLAY_COMPACT.labelGap;
  const deckList = { x: column.x, y: listTop, width: column.width, height: Math.max(0, editDecks.y - COMPACT.gap - listTop) };
  return { shell, tiles, deckLabel: { x: column.x, y: column.y, width: column.width }, deckList, editDecks };
}

/**
 * The deck rows' tops inside the list, from their measured heights (each at
 * least the row floor), and the list's total height for the scroller.
 */
export function compactDeckRows(heights: readonly number[]): { ys: number[]; heights: number[]; total: number } {
  const rows = heights.map((h) => Math.max(PLAY_COMPACT.rowMinH, Math.ceil(h)));
  let y = 0;
  const ys = rows.map((h) => {
    const top = y;
    y += h + PLAY_COMPACT.rowGap;
    return top;
  });
  return { ys, heights: rows, total: rows.length ? y - PLAY_COMPACT.rowGap : 0 };
}

/**
 * The mode tiles across the main pane: one row while each tile keeps
 * `minTileW`, else two rows (the first row takes the extra tile when the count
 * is odd, so a lone tile runs the full width under them).
 */
export function compactTileGrid(main: Rect, tileCount: number, minTileW: number = PLAY_COMPACT.minTileW): Rect[] {
  const n = Math.max(1, Math.floor(tileCount));
  const gap = PLAY_COMPACT.tileGap;
  const widthFor = (perRow: number): number => Math.max(0, Math.floor((main.width - gap * (perRow - 1)) / perRow));
  const rows = n > 1 && widthFor(n) < minTileW ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
  const rowH = Math.max(0, Math.floor((main.height - gap * (rows.length - 1)) / rows.length));
  const tiles: Rect[] = [];
  rows.forEach((perRow, r) => {
    const w = widthFor(perRow);
    for (let i = 0; i < perRow; i++) {
      tiles.push({ x: main.x + i * (w + gap), y: main.y + r * (rowH + gap), width: w, height: rowH });
    }
  });
  return tiles;
}
