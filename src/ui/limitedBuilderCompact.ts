/**
 * The Limited deck builder's compact composition, Phaser-free (mocks
 * S-Limited-Builder, S-Limited-BuilderDeck; docs/plan-mobile-overhaul.md,
 * wave 4).
 *
 * The top bar: back, the title over the format's rules, and Clear deck and
 * Clear Warchest in the right slot. The main pane: Pool and Deck as two tabs
 * over a scrolling grid of art tiles. The command column: Details (the mana
 * curve, the deck's shape, the Warchest and the first issue) over Auto build
 * and Start match. One composition serves the phone and the desktop: sizes
 * are compact design px inside the content box, times `k` (the content box
 * over the reference phone's 718 x 356, up to 1.6) where the mock sized them.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const LIMITED_BUILDER_COMPACT = {
  ref: { width: 718, height: 356 },
  maxK: 1.6,
  /** The tabs' width (the mock's 278 of a 480 pane). */
  tabsW: 278,
  /** A tile's floor and the gap between tiles (the mock's 76 x 100, six across). */
  tileMinW: 72,
  tileGap: 6,
  tileAspect: 100 / 76,
  /** Auto build's share of the foot beside Start match. */
  autoShare: 0.45,
} as const;

export interface LimitedBuilderLayout {
  shell: CompactShell;
  k: number;
  /** Clear deck and Clear Warchest, in the top bar's right slot. */
  clearDeck: Rect;
  clearWarchest: Rect;
  /** Pool | Deck. */
  tabs: Rect;
  /** Where the tiles scroll. */
  grid: Rect;
  /** Details, above the foot. */
  details: Rect;
  auto: Rect;
  start: Rect;
}

export function limitedBuilderScale(content: Rect): number {
  const B = LIMITED_BUILDER_COMPACT;
  return Math.max(1, Math.min(B.maxK, content.width / B.ref.width, content.height / B.ref.height));
}

export function limitedBuilderLayout(content: Rect): LimitedBuilderLayout {
  const B = LIMITED_BUILDER_COMPACT;
  const k = limitedBuilderScale(content);
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const barH = COMPACT.touch;
  const barY = shell.right.y + (shell.right.height - barH) / 2;
  const clearW = Math.floor((shell.right.width - COMPACT.gap) / 2);
  const clearDeck = { x: shell.right.x, y: barY, width: clearW, height: barH };
  const clearWarchest = { x: shell.right.x + clearW + COMPACT.gap, y: barY, width: shell.right.width - clearW - COMPACT.gap, height: barH };
  const tabs = { x: main.x, y: main.y, width: Math.min(main.width, Math.round(B.tabsW * k)), height: COMPACT.touch };
  const gridTop = tabs.y + tabs.height + COMPACT.gap;
  const grid = { x: main.x, y: gridTop, width: main.width, height: Math.max(0, main.y + main.height - gridTop) };
  const foot = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.primaryH, width: column.width, height: COMPACT.primaryH };
  const autoW = Math.round(foot.width * B.autoShare);
  const auto = { ...foot, width: autoW };
  const start = { ...foot, x: foot.x + autoW + COMPACT.gap, width: foot.width - autoW - COMPACT.gap };
  const details = { x: column.x, y: column.y, width: column.width, height: Math.max(0, foot.y - COMPACT.gap - column.y) };
  return { shell, k, clearDeck, clearWarchest, tabs, grid, details, auto, start };
}

export interface LimitedTileGrid {
  /** Each tile's rect, its y from the grid's top (the scrolling content's own space). */
  cells: Rect[];
  columns: number;
  /** The content's height, for the scroll. */
  contentH: number;
}

/**
 * As many columns as fit tiles of at least the floor (times `k`), the spare
 * shared into the tiles; the scroll thumb's lane is kept clear at the right.
 * `tile` is the floor and shape (the builder's by default; the draft's pack is taller).
 */
export function limitedTileGrid(area: Rect, count: number, k: number, tile: { minW: number; aspect: number } = { minW: LIMITED_BUILDER_COMPACT.tileMinW, aspect: LIMITED_BUILDER_COMPACT.tileAspect }): LimitedTileGrid {
  const B = LIMITED_BUILDER_COMPACT;
  const gap = Math.round(B.tileGap * k);
  const usable = Math.max(0, area.width - 6);
  const columns = Math.max(1, Math.floor((usable + gap) / (tile.minW * k + gap)));
  const w = Math.floor((usable - gap * (columns - 1)) / columns);
  const h = Math.round(w * tile.aspect);
  const cells = Array.from({ length: count }, (_, i) => ({
    x: area.x + (i % columns) * (w + gap),
    y: Math.floor(i / columns) * (h + gap),
    width: w,
    height: h,
  }));
  const rows = Math.ceil(count / columns);
  return { cells, columns, contentH: rows > 0 ? rows * h + (rows - 1) * gap : 0 };
}
