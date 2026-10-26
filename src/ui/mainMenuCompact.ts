/**
 * The main menu's compact (phone) composition, Phaser-free (mock M-MainMenu,
 * M-MainMenu130; docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * Version C's shell: a top bar (the title, the gold and the icons), the left
 * column for identity (the Profile tile with the record, How to play,
 * Glossary), the Daily Blades panel in the centre, and the command column on
 * the right with the four destinations and Play at its foot, under the right
 * thumb. Coordinates are compact design px inside the content box
 * (`ScreenMetrics.content`); the numbers are the mock's at the 852x393
 * reference phone, and every one of them holds the 44 px touch floor.
 */

import { COMPACT } from './compactLayout';
import type { Rect } from './layout';

export const MAIN_MENU_COMPACT = {
  /** The left column's share of the main pane, inside its floor and ceiling. */
  leftShare: 0.36,
  leftMin: 150,
  leftMax: 200,
  /** The command column's rows: the mock's 52 px plates, never under the touch floor. */
  navRowH: 52,
  /** Room under the Glossary button for the build stamp. */
  versionH: 22,
  /** The Daily Blades action buttons' shared width (Reroll, Claim +N, Claimed). */
  dailyActionW: 88,
  /** Inside the Daily Blades panel. */
  dailyPad: 10,
  dailyRowGap: 6,
  /** The "N more quests" row. */
  moreRowH: COMPACT.touch,
} as const;

export interface CompactMainMenuOptions {
  /** Show the full-screen icon left of Settings (M8). */
  fullScreen: boolean;
  /** How many destination rows sit above Play (Shop, Collection, Decks, Achievements). */
  navCount: number;
}

export interface CompactMainMenuLayout {
  /** The title's left edge and the top bar's centre line. */
  title: { x: number; centerY: number; maxWidth: number };
  /** Settings, the gear at the bar's right end. */
  gear: Rect;
  /** The full-screen icon, left of Settings, when offered. */
  fullScreen: Rect | null;
  /** The gold pill's right edge and centre line; its width is measured. */
  gold: { right: number; centerY: number; height: number };
  profile: Rect;
  howToPlay: Rect;
  glossary: Rect;
  /** The build stamp's bottom-left corner. */
  version: { x: number; bottom: number };
  daily: Rect;
  nav: Rect[];
  play: Rect;
}

export function compactMainMenuLayout(content: Rect, opts: CompactMainMenuOptions): CompactMainMenuLayout {
  const { touch, gap, columnW, topBarH } = COMPACT;
  const L = MAIN_MENU_COMPACT;
  const right = content.x + content.width;
  const bottom = content.y + content.height;
  const top = content.y + topBarH + gap;
  const barCenter = content.y + topBarH / 2;

  // The icons, the gold and the Discord link share one height and the bar's
  // centre line (the pointer tier's 34 px controls sit inside the 44 px bar).
  const barY = barCenter - touch / 2;
  const gear = { x: right - touch, y: barY, width: touch, height: touch };
  const fullScreen = opts.fullScreen ? { x: gear.x - gap - touch, y: barY, width: touch, height: touch } : null;
  const goldRight = (fullScreen ?? gear).x - gap;

  const column = { x: right - columnW, width: columnW };
  const mainW = column.x - gap - content.x;
  const leftW = Math.round(Math.min(L.leftMax, Math.max(L.leftMin, mainW * L.leftShare)));

  const glossary = { x: content.x, y: bottom - L.versionH - touch, width: leftW, height: touch };
  const howToPlay = { x: content.x, y: glossary.y - gap - touch, width: leftW, height: touch };
  const profile = { x: content.x, y: top, width: leftW, height: Math.max(touch, howToPlay.y - gap - top) };

  const dailyX = content.x + leftW + gap;
  const daily = { x: dailyX, y: top, width: Math.max(0, column.x - gap - dailyX), height: Math.max(0, bottom - top) };

  const play = { x: column.x, y: bottom - COMPACT.primaryH, width: columnW, height: COMPACT.primaryH };
  const n = Math.max(0, Math.floor(opts.navCount));
  // The rows take the room above Play less one gap, at the mock's 52 px when
  // it fits and never under the touch floor (a short phone, M21).
  const room = play.y - gap - top;
  const rowH = n ? Math.max(touch, Math.min(L.navRowH, Math.floor((room - gap * (n - 1)) / n))) : 0;
  const nav = Array.from({ length: n }, (_, i) => ({ x: column.x, y: top + i * (rowH + gap), width: columnW, height: rowH }));

  return {
    title: { x: content.x, centerY: barCenter, maxWidth: Math.max(0, goldRight - gap - content.x) },
    gear,
    fullScreen,
    gold: { right: goldRight, centerY: barCenter, height: touch },
    profile,
    howToPlay,
    glossary,
    version: { x: content.x, bottom },
    daily,
    nav,
    play,
  };
}

export interface CompactDailyPage {
  /** Indexes of the quests on this page, top to bottom. */
  quests: number[];
  /**
   * The fold row under them, or null when every quest fits: "N more quests"
   * opens the next page, and the last page's row goes back to the first.
   */
  fold: { label: string; next: number } | null;
}

/**
 * Which Daily Blades quests the panel shows on `page` (M-MainMenu130): as
 * many whole rows as fit; when they do not all fit, one fewer, plus a fold
 * row that pages on, so no quest row is ever cut. Every quest is reachable.
 */
export function compactDailyPage(
  available: number,
  rowHeights: readonly number[],
  page: number,
  gap: number = MAIN_MENU_COMPACT.dailyRowGap,
  foldH: number = MAIN_MENU_COMPACT.moreRowH,
): CompactDailyPage {
  const total = rowHeights.length;
  const fitsFrom = (start: number, reserve: number): number => {
    let used = reserve;
    let count = 0;
    for (let i = start; i < total; i++) {
      const next = used + (count > 0 || reserve > 0 ? gap : 0) + rowHeights[i];
      if (next > available) break;
      used = next;
      count++;
    }
    return count;
  };
  if (fitsFrom(0, 0) >= total) return { quests: rowHeights.map((_, i) => i), fold: null };
  // Pages hold at least one quest, so a very short panel still pages through all of them.
  const perPage = Math.max(1, fitsFrom(0, foldH));
  const pages = Math.ceil(total / perPage);
  const p = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const start = p * perPage;
  const quests = Array.from({ length: Math.min(perPage, total - start) }, (_, i) => start + i);
  const rest = total - (start + quests.length);
  const fold = rest > 0
    ? { label: rest === 1 ? '1 more quest' : `${rest} more quests`, next: p + 1 }
    : { label: 'First quests', next: 0 };
  return { quests, fold };
}
