/**
 * The Limited draft's compact composition, Phaser-free (mocks S-Draft-Pick,
 * S-Draft-Pick-130, S-Draft-Drafter, S-Draft-Inspect;
 * docs/plan-mobile-overhaul.md, wave 4).
 *
 * The top bar: back, the format over the pack and pick, and the pass
 * direction in the right slot. The main pane: the table's eight seats in a
 * row of round portraits with arrows between them, then the current pack as a
 * scrolling grid of art tiles. The command column: Your Picks (colours, the
 * mana curve, the drafted cards most recent first) over Pick selected. A
 * drafter's profile and a card's pick impact open as a sheet over the main
 * pane, the column still in view. One composition serves the phone and the
 * desktop: sizes are compact design px, times `k` (the content box over the
 * reference phone's 718 x 356, up to 1.6) where the mock sized them.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';
import { limitedBuilderScale } from './limitedBuilderCompact';

export const LIMITED_DRAFT_COMPACT = {
  /** A seat's portrait (the mock's 36 px circle). */
  seatD: 36,
  /** A pack tile's floor and shape (the mock's 72 x 102, six across). */
  tileMinW: 72,
  tileAspect: 102 / 72,
  /** The drafted cards: six square thumbs a row, this far apart. */
  pickColumns: 6,
  pickGap: 6,
} as const;

export interface LimitedDraftLayout {
  shell: CompactShell;
  k: number;
  /** The seat row: portraits over names. */
  seats: Rect;
  /** Each seat's centre x, left to right, and the portraits' centre y. */
  seatXs: number[];
  seatY: number;
  seatD: number;
  /** Where the "Current Pack" heading sits. */
  packHeading: Rect;
  /** Where the pack's tiles scroll. */
  grid: Rect;
  /** Your Picks, above the foot. */
  picks: Rect;
  /** Pick selected. */
  foot: Rect;
  /** A drafter's profile or a card's pick impact: over the main pane, full height. */
  sheet: Rect;
}

/** `nameH` and `headingH` are the measured seat-name and heading heights. */
export function limitedDraftLayout(content: Rect, nameH: number, headingH: number): LimitedDraftLayout {
  const D = LIMITED_DRAFT_COMPACT;
  const k = limitedBuilderScale(content);
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const seatD = Math.round(D.seatD * k);
  const seats = { x: main.x, y: main.y, width: main.width, height: seatD + 2 + nameH };
  const pitch = main.width / 8;
  const seatXs = Array.from({ length: 8 }, (_, i) => Math.round(main.x + pitch * (i + 0.5)));
  const packHeading = { x: main.x, y: seats.y + seats.height + 4, width: main.width, height: headingH };
  const gridTop = packHeading.y + headingH + 6;
  const grid = { x: main.x, y: gridTop, width: main.width, height: Math.max(0, main.y + main.height - gridTop) };
  const foot = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.primaryH, width: column.width, height: COMPACT.primaryH };
  const picks = { x: column.x, y: column.y, width: column.width, height: Math.max(0, foot.y - COMPACT.gap - column.y) };
  const sheet = { x: content.x, y: content.y, width: Math.max(0, main.x + main.width - content.x), height: content.height };
  return { shell, k, seats, seatXs, seatY: seats.y + seatD / 2, seatD, packHeading, grid, picks, foot, sheet };
}

export interface DraftPicksGrid {
  /** Each thumb's rect, the last one the "+N" cell when `more` is above 0. */
  cells: Rect[];
  /** How many drafted cards draw as thumbs. */
  shown: number;
  /** The cards that do not fit, counted in the last cell. */
  more: number;
}

/**
 * The drafted cards in `area`: six square thumbs a row, as many rows as fit.
 * When they do not all fit, the last cell counts the rest ("+13").
 */
export function draftPicksGrid(area: Rect, count: number): DraftPicksGrid {
  const D = LIMITED_DRAFT_COMPACT;
  const size = Math.floor((area.width - D.pickGap * (D.pickColumns - 1)) / D.pickColumns);
  const rows = size > 0 ? Math.max(0, Math.floor((area.height + D.pickGap) / (size + D.pickGap))) : 0;
  const capacity = rows * D.pickColumns;
  const overflow = count > capacity;
  const cellsUsed = overflow ? capacity : count;
  const shown = overflow ? Math.max(0, capacity - 1) : count;
  const cells = Array.from({ length: cellsUsed }, (_, i) => ({
    x: area.x + (i % D.pickColumns) * (size + D.pickGap),
    y: area.y + Math.floor(i / D.pickColumns) * (size + D.pickGap),
    width: size,
    height: size,
  }));
  return { cells, shown, more: overflow ? count - shown : 0 };
}
