import { HEADER_CURRENCY_ANCHOR, modalShellLayout, type Rect } from './layout';
import { theme } from './theme';

export interface MainMenuItem {
  label: string;
  scene: string;
  data?: object;
}

/**
 * The menu as the owner approved it on 2026-10-08 (mock in the UI review
 * thread): Play is the screen's one primary action, Decks sits right under
 * it, and the nav column and the Daily panel share one top line and one
 * bottom line. Before it, Play had the same weight as every other row, the
 * column and the panel shared no edge, and the learning buttons were a
 * second column stacked in the top-left corner.
 */
export const MAIN_MENU_ITEMS: readonly MainMenuItem[] = [
  { label: 'Play', scene: 'Play' },
  { label: 'Decks', scene: 'DeckBuilder' },
  { label: 'Collection', scene: 'Collection' },
  { label: 'Shop', scene: 'Shop' },
  { label: 'Achievements', scene: 'Achievements' },
] as const;

/** The band the nav column and the Daily panel share, under the title. */
export const MAIN_MENU_CONTENT = { top: 228, bottom: 612 } as const;

/** The nav column: one tall Play plate, then equal rows down to the band's bottom. */
export const MAIN_MENU_NAV = {
  x: theme.design.safeLeft,
  width: 400,
  playHeight: 104,
  rowHeight: 56,
  gap: theme.space(3) + 2,
} as const;

/** Each nav entry's plate, in `MAIN_MENU_ITEMS` order; the last ends on the band's bottom. */
export function mainMenuNavRows(): Rect[] {
  const { x, width, playHeight, rowHeight, gap } = MAIN_MENU_NAV;
  let y = MAIN_MENU_CONTENT.top;
  return MAIN_MENU_ITEMS.map((_, i) => {
    const height = i === 0 ? playHeight : rowHeight;
    const rect = { x, y, width, height };
    y += height + gap;
    return rect;
  });
}

/** Air between neighbouring header controls' hit boxes. */
export const MAIN_MENU_HEADER_GAP = theme.space(2);

/**
 * The one header row: the learning buttons (Profile, How to Play, Glossary)
 * run left to right from the frame's left edge, measured hit box to hit box;
 * Settings sits left of the gold badge, whose right edge is on the frame.
 */
export function mainMenuHeaderRow(leftHitWidths: readonly number[], rightHitWidth: number, badgeWidth: number) {
  let next = theme.design.safeLeft;
  const leftX = leftHitWidths.map((width) => {
    const x = next + width / 2;
    next += width + MAIN_MENU_HEADER_GAP;
    return x;
  });
  const rightX = HEADER_CURRENCY_ANCHOR.x - badgeWidth - theme.space(4) - rightHitWidth / 2;
  return { y: theme.design.headerCenterY, leftX, rightX, badgeX: HEADER_CURRENCY_ANCHOR.x };
}

/**
 * The build stamp, bottom-left inside the frame on a small dark plate so it
 * reads over the vista (it sat at x 14 in muted text, outside the frame and
 * unreadable on the art; owner, 2026-10-08).
 */
export const MAIN_MENU_VERSION = {
  x: theme.design.safeLeft,
  y: theme.design.safeBottom,
  padX: theme.space(2),
  padY: theme.space(1),
} as const;

/** Reading line boxes follow the live role, including its leading. */
export function menuLineHeight(size: number): number {
  return Math.ceil(size * 4 / 3);
}

/** Content-sized modal using the same reserved tracks as modalShell. */
export function menuNoticeLayout(width: number, titleHeight: number, bodyHeight: number) {
  const titleTrackHeight = Math.max(theme.control.minHitHeight, titleHeight);
  const height = theme.space(12) + theme.space(8) + titleTrackHeight + bodyHeight + theme.control.minHitHeight;
  return { width, height, titleTrackHeight, tracks: modalShellLayout({ width, height, titleTrackHeight }) };
}

/** The Daily panel starts on the band's top line and reaches at least its bottom line. */
export const MAIN_MENU_DAILY = { x: 656, y: MAIN_MENU_CONTENT.top, width: theme.design.safeRight - 656 } as const;

export interface DailyRowMeasure {
  title: number;
  description: number;
  progress: number;
  action: number;
}

/** Measured row content, with a scroll viewport if the three quests outgrow the frame. */
export function mainMenuDailyLayout(headingHeight: number, streakHeight: number, rows: readonly DailyRowMeasure[]) {
  const pad = theme.space(4);
  const gap = theme.space(2);
  const headingY = MAIN_MENU_DAILY.y + pad;
  const streakY = headingY + headingHeight + gap;
  const viewportTop = streakY + streakHeight + theme.space(3);
  const natural = rows.map((row) => Math.max(row.title + theme.space(1) + row.description + gap + row.progress, row.action) + 2 * gap);
  // Rows grow evenly to fill the panel down to the nav column's bottom line,
  // so the panel never ends in an empty band; their text stays centred.
  const naturalHeight = natural.reduce((sum, h) => sum + h, 0) + theme.space(3) * Math.max(0, rows.length - 1);
  const room = MAIN_MENU_CONTENT.bottom - pad - viewportTop;
  const grow = rows.length && naturalHeight < room ? Math.floor((room - naturalHeight) / rows.length) : 0;
  let next = 0;
  const placed = rows.map((row, i) => {
    const height = natural[i] + grow;
    const top = next + gap + Math.floor(grow / 2);
    const result = { y: next, height, titleY: top,
      descriptionY: top + row.title + theme.space(1),
      progressY: top + row.title + theme.space(1) + row.description + gap };
    next += height + theme.space(3);
    return result;
  });
  const contentHeight = Math.max(0, next - theme.space(3));
  const viewport: Rect = { x: MAIN_MENU_DAILY.x + pad, y: viewportTop,
    width: MAIN_MENU_DAILY.width - 2 * pad,
    height: Math.min(contentHeight, theme.design.safeBottom - pad - viewportTop) };
  return { headingY, streakY, rows: placed, viewport, contentHeight,
    maxScroll: Math.max(0, contentHeight - viewport.height),
    panel: { ...MAIN_MENU_DAILY, height: Math.max(MAIN_MENU_CONTENT.bottom - MAIN_MENU_DAILY.y,
      viewportTop - MAIN_MENU_DAILY.y + viewport.height + pad) } };
}
