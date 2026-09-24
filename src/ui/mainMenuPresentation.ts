import { HEADER_CURRENCY_ANCHOR } from './layout';
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
