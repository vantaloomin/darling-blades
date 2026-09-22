import { theme } from './theme';

export interface MainMenuItem {
  label: string;
  scene: string;
  data?: object;
}

export const MAIN_MENU_X = 360;
export const MAIN_MENU_FIRST_Y = 286;
export const MAIN_MENU_PITCH_Y = 50;

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

/**
 * The two corner clusters: Profile / How to Play / Glossary at the left, the
 * gold badge and Settings at the right, one column each. They start on the
 * header line the shared scene header uses (`theme.design.headerCenterY`,
 * 58), so the top control's 44px hit box begins at 36, the title-safe frame's
 * top edge. They started at y 30 until the 1.8 QC day (2026-09-21), which put
 * the top row's hit box at 8, outside the frame the design system reserves
 * for persistent navigation and currency.
 */
export const MAIN_MENU_CORNER = {
  leftX: 100,
  rightX: 1280 - 90,
  badgeX: 1280 - 30,
  firstY: theme.design.headerCenterY,
  /** 44px hit box plus the within-group gap. */
  pitch: theme.control.minHitHeight + theme.space(2),
  minWidth: 150,
} as const;

export function mainMenuCornerY(index: number): number {
  return MAIN_MENU_CORNER.firstY + index * MAIN_MENU_CORNER.pitch;
}
