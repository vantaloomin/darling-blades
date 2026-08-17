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
