/**
 * Achievements' compact (phone) composition, Phaser-free (mocks
 * M-Achievements and M-AchievementsList; docs/plan-mobile-overhaul.md, mobile
 * wave 2).
 *
 * The Trophy Hall's five wings fill the main pane, three across over two; the
 * List view scrolls every achievement of the filter in one column instead of
 * pages. The command column carries the collection totals (Hall), the
 * Hall/List switch, the filters (List) and Claim all at its foot.
 * Coordinates are compact design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const ACHIEVEMENTS_COMPACT = {
  /** Between two wing cards, across and down. */
  wingGap: 10,
  /** Inside a wing card, either side and top and bottom. */
  wingPad: 10,
  /** The wing's ring gauge: its radius and its stroke. */
  ringR: 19,
  ringStroke: 4,
  /** Between the ring and its count, and between the card's bands. */
  wingInnerGap: 6,
  /** The plinth's text inset and its padding above and below the two lines. */
  plinthInset: 12,
  plinthPadY: 6,
  /** A list row's gauge lane (the progress ring, or the showcase pin), left of the copy. */
  gaugeLane: 52,
  /** A list row's padding above and below its copy, and the gap between rows. */
  rowPadY: 10,
  rowGap: 8,
  /** Between the row's copy, its reward and its readout or Claim, and inside its right edge. */
  rowColGap: 10,
  rowInsetR: 12,
  /** The copy block's floor: narrower and the reward goes under the readout instead. */
  copyMin: 170,
  /** The list's scroll thumb lane, right of the rows. */
  thumbLane: 7,
  /** Between two totals in the column's colour grid, across and down. */
  pipGapX: 14,
  pipGapY: 8,
} as const;

export interface CompactAchievementsLayout {
  shell: CompactShell;
  /** The hall's wings, or the list. */
  main: Rect;
  /** The command column, foot included. */
  column: Rect;
  /** Claim all, at the column's foot. */
  claimAll: Rect;
}

export function compactAchievementsLayout(content: Rect): CompactAchievementsLayout {
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const claimAll = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  return { shell, main, column, claimAll };
}

/**
 * The hall's five wing cards: three across the top row, two (wider) across
 * the bottom, as in M-Achievements. `rowHeights` are what each row's cards
 * need; a row takes at least its share of the pane, so the hall fills it,
 * and grows past it (the hall then scrolls) when larger text needs more.
 * Rects are relative to the pane's top-left.
 */
export function achievementHallFrames(width: number, paneHeight: number, rowHeights: readonly [number, number]): { frames: Rect[]; height: number } {
  const gap = ACHIEVEMENTS_COMPACT.wingGap;
  const share = Math.max(0, (paneHeight - gap) / 2);
  const top = Math.max(share, rowHeights[0]);
  const bottom = Math.max(share, rowHeights[1]);
  const across = (count: number, y: number, h: number): Rect[] => {
    const w = (width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => ({ x: i * (w + gap), y, width: w, height: h }));
  };
  return { frames: [...across(3, 0, top), ...across(2, top + gap, bottom)], height: top + gap + bottom };
}

/** The width of one of the hall's top-row (narrowest) wing cards. */
export function achievementHallNarrowWidth(width: number): number {
  return (width - ACHIEVEMENTS_COMPACT.wingGap * 2) / 3;
}

export interface AchievementRowColumns {
  /** The copy block (title over wing and goal), from the row's left. */
  copyX: number;
  copyWidth: number;
  /** The reward's right edge, and its centre line as a share of the right-hand block (0.5 beside, 0.72 stacked). */
  rewardRight: number;
  /** The readout's (or Claim's) left edge and width. */
  progressX: number;
  progressWidth: number;
  /** The reward sits under the readout, not before it (narrow rows). */
  stacked: boolean;
}

/**
 * A list row's columns, left to right: the gauge lane, the copy, the reward
 * and the readout (or Claim). The reward and the readout keep their measured
 * widths so neither is ever cut; when the copy would fall under its floor the
 * reward moves under the readout and the copy takes the room.
 */
export function achievementRowColumns(rowWidth: number, rewardWidth: number, progressWidth: number): AchievementRowColumns {
  const C = ACHIEVEMENTS_COMPACT;
  const progressX = rowWidth - C.rowInsetR - progressWidth;
  const besideCopy = progressX - C.rowColGap - rewardWidth - C.rowColGap - C.gaugeLane;
  if (besideCopy >= C.copyMin) {
    return { copyX: C.gaugeLane, copyWidth: besideCopy, rewardRight: progressX - C.rowColGap, progressX, progressWidth, stacked: false };
  }
  const right = Math.max(progressWidth, rewardWidth);
  const x = rowWidth - C.rowInsetR - right;
  return {
    copyX: C.gaugeLane,
    copyWidth: Math.max(0, x - C.rowColGap - C.gaugeLane),
    rewardRight: rowWidth - C.rowInsetR,
    progressX: x + right - progressWidth,
    progressWidth,
    stacked: true,
  };
}

/**
 * Items of the given widths, left to right, wrapping to a new line when the
 * next would pass `width` (the column's per-colour totals). Positions are
 * relative to the block's top-left; `height` is the block's.
 */
export function flowItems(width: number, itemWidths: readonly number[], lineHeight: number, gapX: number, gapY: number): { at: { x: number; y: number }[]; height: number } {
  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  for (const w of itemWidths) {
    if (x > 0 && x + w > width) {
      x = 0;
      y += lineHeight + gapY;
    }
    at.push({ x, y });
    x += w + gapX;
  }
  return { at, height: itemWidths.length > 0 ? y + lineHeight : 0 };
}
