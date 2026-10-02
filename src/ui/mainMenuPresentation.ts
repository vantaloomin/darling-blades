import { HEADER_CURRENCY_ANCHOR, modalShellLayout, type Rect } from './layout';
import { theme } from './theme';

export interface MainMenuItem {
  label: string;
  scene: string;
  data?: object;
}

export const MAIN_MENU_X = 360;
export const MAIN_MENU_FIRST_Y = 286;
/**
 * One pitch for every column of controls on this screen: the 44px hit box
 * plus the within-group gap (docs/design-system.md, 8-12px). The list ran on
 * 50 until the 1.8 QC day (2026-09-21), 6px between hit boxes, while the
 * corner stacks ran on 52; the owner read the difference as uneven spacing.
 */
export const MAIN_MENU_PITCH_Y = theme.control.minHitHeight + theme.space(2);

export const MAIN_MENU_ITEMS: readonly MainMenuItem[] = [
  { label: 'Play', scene: 'Play' },
  { label: 'Shop', scene: 'Shop' },
  { label: 'Collection', scene: 'Collection' },
  { label: 'Achievements', scene: 'Achievements' },
  { label: 'Decks', scene: 'DeckBuilder' },
] as const;

export function mainMenuButtonY(index: number): number {
  return MAIN_MENU_FIRST_Y + index * MAIN_MENU_PITCH_Y;
}

/** Width of the left column's buttons (Profile, How to Play, Glossary). */
const CORNER_LEFT_WIDTH = 150;
/** Width of the right column's Settings button. */
const CORNER_RIGHT_WIDTH = 130;

/**
 * The two corner clusters: Profile / How to Play / Glossary at the left, the
 * gold badge and Settings at the right, one column each. They start on the
 * header line the shared scene header uses (`theme.design.headerCenterY`,
 * 58), so the top control's 44px hit box begins at 36, the title-safe frame's
 * top edge. They started at y 30 until the 1.8 QC day (2026-09-21), which put
 * the top row's hit box at 8, outside the frame the design system reserves
 * for persistent navigation and currency.
 *
 * Each column sits on its side edge of the frame: the left column's left
 * edge on the frame's left edge, and the badge's and Settings' right edges
 * on its right edge. Until the 1.8 cut (2026-09-23) the columns ran x 25-175
 * and 1125-1255, and the badge ended at 1250.
 */
export const MAIN_MENU_CORNER = {
  leftX: theme.design.safeLeft + CORNER_LEFT_WIDTH / 2,
  rightX: theme.design.safeRight - CORNER_RIGHT_WIDTH / 2,
  badgeX: HEADER_CURRENCY_ANCHOR.x,
  firstY: theme.design.headerCenterY,
  /** The same pitch as the menu list, so the screen has one rhythm. */
  pitch: MAIN_MENU_PITCH_Y,
  minWidth: CORNER_LEFT_WIDTH,
  rightMinWidth: CORNER_RIGHT_WIDTH,
} as const;

export function mainMenuCornerY(index: number): number {
  return MAIN_MENU_CORNER.firstY + index * MAIN_MENU_CORNER.pitch;
}


/** Reading line boxes follow the live role, including its leading. */
export function menuLineHeight(size: number): number {
  return Math.ceil(size * 4 / 3);
}

/** Same-width corner controls, measured before placement, anchored to the safe edges. */
export function mainMenuCornerLayout(leftWidths: readonly number[], rightWidth: number) {
  const leftWidth = Math.max(MAIN_MENU_CORNER.minWidth, ...leftWidths);
  const width = Math.max(MAIN_MENU_CORNER.rightMinWidth, rightWidth);
  return { leftWidth, leftX: theme.design.safeLeft + leftWidth / 2, rightX: theme.design.safeRight - width / 2 };
}

/** Content-sized modal using the same reserved tracks as modalShell. */
export function menuNoticeLayout(width: number, titleHeight: number, bodyHeight: number) {
  const titleTrackHeight = Math.max(theme.control.minHitHeight, titleHeight);
  const height = theme.space(12) + theme.space(8) + titleTrackHeight + bodyHeight + theme.control.minHitHeight;
  return { width, height, titleTrackHeight, tracks: modalShellLayout({ width, height, titleTrackHeight }) };
}

export const MAIN_MENU_DAILY = { x: 650, y: 216, width: theme.design.safeRight - 650 } as const;

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
  let next = 0;
  const placed = rows.map((row) => {
    const textHeight = row.title + theme.space(1) + row.description + gap + row.progress;
    const height = Math.max(textHeight, row.action) + 2 * gap;
    const result = { y: next, height, titleY: next + gap,
      descriptionY: next + gap + row.title + theme.space(1),
      progressY: next + gap + row.title + theme.space(1) + row.description + gap };
    next += height + theme.space(3);
    return result;
  });
  const contentHeight = Math.max(0, next - theme.space(3));
  const viewport: Rect = { x: MAIN_MENU_DAILY.x + pad, y: viewportTop,
    width: MAIN_MENU_DAILY.width - 2 * pad,
    height: Math.min(contentHeight, theme.design.safeBottom - pad - viewportTop) };
  return { headingY, streakY, rows: placed, viewport, contentHeight,
    maxScroll: Math.max(0, contentHeight - viewport.height),
    panel: { ...MAIN_MENU_DAILY, height: viewportTop - MAIN_MENU_DAILY.y + viewport.height + pad } };
}
