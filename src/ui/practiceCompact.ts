/**
 * The Practice picker's compact (phone) composition, Phaser-free (mock
 * M-Practice; docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * Left: the picked rival, large, with her name and title under her. Centre:
 * every rival in a grid that scrolls vertically (summit first). The command
 * column: her blurb, the difficulty segments, and "Face <rival>" at the foot.
 * On a phone the difficulty is chosen first and the primary launches, so a
 * mis-tap on a small button never starts a duel. Coordinates are compact
 * design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const PRACTICE_COMPACT = {
  /** The picked rival's column: a share of the main pane, inside a floor and ceiling. */
  heroShare: 0.34,
  heroMin: 120,
  heroMax: 170,
  /** The grid's narrowest tile; a column drops before a tile shrinks under it. */
  minTileW: 88,
  tileGap: 10,
  /** Tile height over width (the mock's 95 x 107). */
  tileAspect: 1.12,
  /** Under the "Difficulty" label. */
  labelGap: 6,
  /** Above the difficulty segments' label, under the blurb. */
  blurbGap: 12,
  /** A tile name's inset each side. */
  nameInset: 3,
  /** How far the picked rival's column narrows at a time to give the grid room. */
  heroStep: 8,
  /** Desktop: how far whole rows may stretch or squash a tile from `tileAspect`. */
  wholeRowsSlack: 0.12,
} as const;

export interface CompactPracticeLayout {
  shell: CompactShell;
  /** The picked rival's column (portrait above, name and title below). */
  hero: Rect;
  /** Where the rival grid scrolls. */
  grid: Rect;
  /** The grid's viewport: the grid, or its whole rows (`wholeRows`). */
  gridView: Rect;
  /** The scroll's step: 0 (free), or a row's pitch (`wholeRows`). */
  gridStep: number;
  columns: number;
  tileW: number;
  tileH: number;
  /** The blurb's scroll area, the column's top. */
  blurb: Rect;
  /** The desktop's panel behind the blurb and "Difficulty" (`textPanel`), else null. */
  textPanel: Rect | null;
  /** "Difficulty": its top-left. */
  difficultyLabel: { x: number; y: number };
  /** The three difficulty segments' track. */
  segments: Rect;
  /** "Face <rival>", the column's foot. */
  launch: Rect;
}

export interface PracticeLayoutOptions {
  /** The picked rival's column width, in place of its share of the pane. */
  heroW?: number;
  /** At most this many grid columns. */
  maxColumns?: number;
  /** The narrowest tile, in place of `minTileW` (the desktop's is larger). */
  minTileW?: number;
  /**
   * Desktop: tiles a little taller or shorter (within `wholeRowsSlack`) so the
   * grid shows whole rows, no name cut at the pane's foot; `gridView` is then
   * those rows' height and the scroll steps a row at a time.
   */
  wholeRows?: boolean;
  /**
   * Desktop: one faded panel, the column's exact width, behind the blurb and
   * the "Difficulty" label; their text sits `inset` in from its sides and
   * `padY` in from its top and bottom, the segments still under it.
   */
  textPanel?: { inset: number; padY: number };
}

/** `labelH` is the measured "Difficulty" line. */
export function compactPracticeLayout(content: Rect, labelH: number, opts: PracticeLayoutOptions = {}): CompactPracticeLayout {
  const P = PRACTICE_COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const heroW = opts.heroW ?? Math.round(Math.min(P.heroMax, Math.max(P.heroMin, main.width * P.heroShare)));
  const hero = { x: main.x, y: main.y, width: heroW, height: main.height };
  const gridX = main.x + heroW + COMPACT.gap;
  const grid = { x: gridX, y: main.y, width: Math.max(0, main.x + main.width - gridX), height: main.height };
  const fitColumns = Math.floor((grid.width + P.tileGap) / ((opts.minTileW ?? P.minTileW) + P.tileGap));
  const columns = Math.max(1, Math.min(opts.maxColumns ?? fitColumns, fitColumns));
  // A scroll thumb runs down the grid's right edge; the tiles leave it room.
  const tileW = Math.max(0, Math.floor((grid.width - 6 - P.tileGap * (columns - 1)) / columns));
  let tileH = Math.round(tileW * P.tileAspect);
  let gridView = grid;
  let gridStep = 0;
  if (opts.wholeRows && tileH > 0) {
    const rows = Math.max(1, Math.round((grid.height + P.tileGap) / (tileH + P.tileGap)));
    const fitH = Math.floor((grid.height - P.tileGap * (rows - 1)) / rows);
    if (Math.abs(fitH / tileW - P.tileAspect) <= P.tileAspect * P.wholeRowsSlack) {
      tileH = fitH;
      gridView = { ...grid, height: rows * tileH + (rows - 1) * P.tileGap };
      gridStep = tileH + P.tileGap;
    }
  }
  const launch = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const segments = { x: column.x, y: launch.y - COMPACT.gap * 3 - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const tp = opts.textPanel;
  const labelY = segments.y - P.labelGap - labelH - (tp?.padY ?? 0);
  const blurb = tp
    ? { x: column.x + tp.inset, y: column.y + tp.padY, width: Math.max(0, column.width - 2 * tp.inset), height: Math.max(0, labelY - P.blurbGap - column.y - tp.padY) }
    : { x: column.x, y: column.y, width: column.width, height: Math.max(0, labelY - P.blurbGap - column.y) };
  const textPanel = tp ? { x: column.x, y: column.y, width: column.width, height: labelY + labelH + tp.padY - column.y } : null;
  const difficultyLabel = { x: column.x + (tp ? tp.inset : 2), y: labelY };
  return { shell, hero, grid, gridView, gridStep, columns, tileW, tileH, blurb, textPanel, difficultyLabel, segments, launch };
}

/**
 * The layout whose tiles hold every rival's name, from `namesFit(nameWidth)`
 * (the scene measures the names). The picked rival's column narrows first,
 * down to its floor, so the mock's columns keep; only then does the grid drop
 * a column, wider tiles in its place (Largest text).
 */
export function compactPracticeLayoutFitting(
  content: Rect,
  labelH: number,
  namesFit: (nameWidth: number) => boolean,
  base: Pick<PracticeLayoutOptions, 'minTileW' | 'wholeRows' | 'textPanel'> = {},
): CompactPracticeLayout {
  const P = PRACTICE_COMPACT;
  const nameWidth = (l: CompactPracticeLayout): number => l.tileW - 2 * P.nameInset;
  let layout = compactPracticeLayout(content, labelH, base);
  const firstHero = layout.hero.width;
  for (let heroW = firstHero; heroW >= P.heroMin; heroW -= P.heroStep) {
    const next = compactPracticeLayout(content, labelH, { ...base, heroW });
    if (next.columns < layout.columns) break;
    if (namesFit(nameWidth(next))) return next;
  }
  while (layout.columns > 1 && !namesFit(nameWidth(layout))) {
    layout = compactPracticeLayout(content, labelH, { ...base, heroW: firstHero, maxColumns: layout.columns - 1 });
  }
  return layout;
}

/** A tile's top-left inside the grid's scrolled content, row-major. */
export function practiceTilePosition(index: number, columns: number, tileW: number, tileH: number): { x: number; y: number } {
  const c = index % columns;
  const r = Math.floor(index / columns);
  return { x: c * (tileW + PRACTICE_COMPACT.tileGap), y: r * (tileH + PRACTICE_COMPACT.tileGap) };
}

/** The grid's content height for `count` tiles. */
export function practiceGridHeight(count: number, columns: number, tileH: number): number {
  const rows = Math.ceil(Math.max(0, count) / Math.max(1, columns));
  return rows > 0 ? rows * tileH + (rows - 1) * PRACTICE_COMPACT.tileGap : 0;
}

/**
 * A rival's short name for a grid tile or a tower row: the part before the
 * comma ("Anubis", not "Anubis, Who Holds the Scale"), as the mocks have it.
 * Her whole name heads the screen when she is picked.
 */
export function rivalShortName(name: string): string {
  return name.split(',')[0].trim();
}
