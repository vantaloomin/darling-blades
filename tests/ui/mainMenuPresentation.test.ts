import { describe, expect, it } from 'vitest';
import { mainMenuButtonY, mainMenuCornerY, MAIN_MENU_CORNER, MAIN_MENU_ITEMS, MAIN_MENU_PITCH_Y } from '../../src/ui/mainMenuPresentation';
import { theme } from '../../src/ui/theme';

describe('main menu presentation', () => {
  it('keeps Card Showcase out of the player-facing menu', () => {
    expect(MAIN_MENU_ITEMS.map((item) => item.label)).not.toContain('Card Showcase');
  });

  it('keeps the remaining menu rows on one gap-free pitch', () => {
    const ys = MAIN_MENU_ITEMS.map((_, index) => mainMenuButtonY(index));
    expect(ys[0]).toBe(286);
    expect(ys.slice(1).every((y, index) => y - ys[index] === MAIN_MENU_PITCH_Y)).toBe(true);
    // One rhythm for the whole screen, and at least the within-group gap
    // between consecutive 44px hit boxes.
    expect(MAIN_MENU_PITCH_Y).toBe(MAIN_MENU_CORNER.pitch);
    expect(MAIN_MENU_PITCH_Y - theme.control.minHitHeight).toBeGreaterThanOrEqual(8);
  });
});

describe('the main menu corner clusters', () => {
  it('start on the shared header line, so the top hit box begins at the title-safe edge', () => {
    expect(mainMenuCornerY(0) - theme.control.minHitHeight / 2).toBeGreaterThanOrEqual(theme.design.safeTop);
    expect(mainMenuCornerY(0)).toBe(theme.design.headerCenterY);
  });

  it('keep consecutive hit boxes disjoint and clear of the menu list', () => {
    for (let i = 1; i < 3; i++) {
      expect(mainMenuCornerY(i) - theme.control.minHitHeight / 2).toBeGreaterThanOrEqual(
        mainMenuCornerY(i - 1) + theme.control.minHitHeight / 2,
      );
    }
    expect(mainMenuCornerY(2) + theme.control.minHitHeight / 2).toBeLessThan(mainMenuButtonY(0) - theme.control.minHitHeight / 2);
  });
});
