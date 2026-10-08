import { describe, expect, it } from 'vitest';
import { mainMenuDailyLayout, mainMenuHeaderRow, mainMenuNavRows, menuLineHeight, MAIN_MENU_CONTENT, MAIN_MENU_HEADER_GAP, MAIN_MENU_ITEMS } from '../../src/ui/mainMenuPresentation';
import { theme } from '../../src/ui/theme';

describe('main menu presentation', () => {
  it('keeps Card Showcase out of the player-facing menu', () => {
    expect(MAIN_MENU_ITEMS.map((item) => item.label)).not.toContain('Card Showcase');
  });

  it('gives Play the one tall plate and spaces every row evenly down to the shared bottom line', () => {
    const rows = mainMenuNavRows();
    expect(MAIN_MENU_ITEMS[0].label).toBe('Play');
    expect(rows[0].y).toBe(MAIN_MENU_CONTENT.top);
    expect(rows.slice(1).every((row) => row.height < rows[0].height && row.height >= theme.control.minHitHeight)).toBe(true);
    const gaps = rows.slice(1).map((row, i) => row.y - (rows[i].y + rows[i].height));
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeGreaterThanOrEqual(8);
    const last = rows.at(-1)!;
    expect(last.y + last.height).toBe(MAIN_MENU_CONTENT.bottom);
  });

  it('starts the Daily panel on the nav column\'s top line and ends it no higher than its bottom line', () => {
    const line = menuLineHeight(theme.type.caption);
    const l = mainMenuDailyLayout(menuLineHeight(theme.type.h1), menuLineHeight(theme.type.label),
      [0, 1, 2].map(() => ({ title: line, description: line, progress: line, action: theme.control.minHitHeight })));
    expect(l.panel.y).toBe(MAIN_MENU_CONTENT.top);
    expect(l.panel.y + l.panel.height).toBeGreaterThanOrEqual(MAIN_MENU_CONTENT.bottom);
    const nav = mainMenuNavRows()[0];
    expect(l.panel.x).toBeGreaterThan(nav.x + nav.width);
  });
});

describe('the main menu header row', () => {
  it('runs the learning buttons hit box to hit box from the left edge, and keeps Settings clear of the badge', () => {
    const widths = [100, 132, 110];
    const row = mainMenuHeaderRow(widths, 120, 150);
    expect(row.y).toBe(theme.design.headerCenterY);
    expect(row.leftX[0] - widths[0] / 2).toBe(theme.design.safeLeft);
    for (let i = 1; i < widths.length; i++) {
      expect(row.leftX[i] - widths[i] / 2 - (row.leftX[i - 1] + widths[i - 1] / 2)).toBe(MAIN_MENU_HEADER_GAP);
    }
    expect(row.badgeX - 150 - (row.rightX + 60)).toBeGreaterThanOrEqual(MAIN_MENU_HEADER_GAP);
  });
});
