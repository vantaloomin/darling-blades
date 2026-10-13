/**
 * The Glossary's compact (phone) composition, Phaser-free (mocks M-Glossary,
 * M-GlossaryEntry, M-GlossarySearch; docs/plan-mobile-overhaul.md, mobile
 * wave 2).
 *
 * The main pane holds the open tab's heading and note over its terms, which
 * scroll. The command column holds the search field over the tabs, two
 * across, each with its count. Coordinates are compact design px inside the
 * content box.
 */

import { COMPACT } from './compactLayout';
import type { Rect } from './layout';

export const GLOSSARY_COMPACT = {
  /** Between the note and the divider, and the divider and the list. */
  headGap: 8,
  /** A row's icon disc and the lane it sits in. */
  disc: 36,
  iconLane: 56,
  /** A row's padding above and below its text, either side, and the gap between rows. */
  rowPadY: 10,
  rowInsetR: 14,
  rowGap: 8,
  /** Between the name, the description and the search results' section column. */
  colGap: 14,
  /** The name column: a share of the row, inside a floor. */
  nameShare: 0.3,
  nameMin: 90,
  /** The description's floor beside the name; narrower and the description goes under it. */
  descriptionMin: 170,
  /** The list's scroll thumb lane, right of the rows. */
  thumbLane: 7,
  /** A tab tile's padding inside, across and down, and the gap under the search field. */
  tilePadX: 8,
  tilePadY: 6,
  tabsGap: 12,
} as const;

export interface GlossaryRowColumns {
  /** The icon disc's centre x, or null in a section without icons. */
  iconX: number | null;
  nameX: number;
  nameWidth: number;
  /** Where the description starts and how wide it may wrap. */
  descriptionX: number;
  descriptionWidth: number;
  /** The search results' section name: its right edge (beside) or its left (under the description). */
  badgeX: number;
  /** The description and the section name go under the name rather than beside it (narrow rows). */
  stacked: boolean;
}

/**
 * A term row's columns: the icon lane, the name, the description, and in the
 * search results the section the term is from. `nameNeed` is the widest name
 * the list shows and `badgeNeed` the widest section name (0 outside the
 * results). Beside, the name column takes its need up to a share of the row;
 * when that leaves the description under its floor, the row stacks: the name
 * on its own line with the description, then the section name, under it.
 */
export function glossaryRowColumns(rowWidth: number, hasIcons: boolean, nameNeed: number, badgeNeed: number): GlossaryRowColumns {
  const G = GLOSSARY_COMPACT;
  const left = hasIcons ? G.iconLane : G.rowInsetR;
  const iconX = hasIcons ? G.iconLane / 2 + 2 : null;
  const right = rowWidth - G.rowInsetR;
  const nameWidth = Math.min(Math.max(G.nameMin, nameNeed), Math.max(G.nameMin, rowWidth * G.nameShare));
  const badgeRoom = badgeNeed > 0 ? badgeNeed + G.colGap : 0;
  const descriptionX = left + nameWidth + G.colGap;
  const descriptionWidth = right - badgeRoom - descriptionX;
  if (descriptionWidth >= G.descriptionMin) {
    return { iconX, nameX: left, nameWidth, descriptionX, descriptionWidth, badgeX: right, stacked: false };
  }
  return { iconX, nameX: left, nameWidth: right - left, descriptionX: left, descriptionWidth: right - left, badgeX: left, stacked: true };
}

/**
 * The tabs' tiles, two across under the search field. `tileHeights` are the
 * tiles' measured heights (name over count); a row takes its taller tile, at
 * least the touch floor. Rects are relative to the grid's top-left; `height`
 * is the grid's.
 */
export function glossaryTabTiles(width: number, tileHeights: readonly number[]): { tiles: Rect[]; height: number } {
  const gap = COMPACT.gap;
  const w = (width - gap) / 2;
  const tiles: Rect[] = [];
  let y = 0;
  for (let i = 0; i < tileHeights.length; i += 2) {
    const h = Math.max(COMPACT.touch, tileHeights[i], tileHeights[i + 1] ?? 0);
    tiles.push({ x: 0, y, width: w, height: h });
    if (i + 1 < tileHeights.length) tiles.push({ x: w + gap, y, width: w, height: h });
    y += h + gap;
  }
  return { tiles, height: Math.max(0, y - gap) };
}
