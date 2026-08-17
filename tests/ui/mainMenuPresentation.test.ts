import { describe, expect, it } from 'vitest';
import {
  MAIN_MENU_ITEMS,
  MAIN_MENU_PITCH_Y,
  mainMenuButtonY,
} from '../../src/ui/mainMenuPresentation';

describe('main menu presentation', () => {
  it('keeps Card Showcase out of the player-facing menu', () => {
    expect(MAIN_MENU_ITEMS.map((item) => item.label)).toEqual([
      'Play',
      'Shop',
      'Collection',
      'Achievements',
      'Decks',
    ]);
  });

  it('keeps the remaining menu rows on one gap-free pitch', () => {
    const ys = MAIN_MENU_ITEMS.map((_, index) => mainMenuButtonY(index));
    expect(ys).toEqual([286, 336, 386, 436, 486]);
    expect(ys.slice(1).every((y, index) => y - ys[index] === MAIN_MENU_PITCH_Y)).toBe(true);
  });
});
