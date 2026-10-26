import { describe, expect, it } from 'vitest';
import {
  deckCellAt,
  deckGrid,
  deckGridHeight,
  deckScrollToShow,
  packAt,
  packStrip,
  packStripMaxScroll,
  packStripScrollFor,
  packStripScrollKeeping,
  SHOP_COMPACT,
  shopSheet,
} from '../../src/ui/shopCompact';
import { COMPACT, compactShell, DESKTOP_GRID } from '../../src/ui/compactLayout';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.width <= b.x + b.width + 1e-6 && a.y + a.height <= b.y + b.height + 1e-6;

describe('the compact Shop (mocks S-Shop-Packs, S-Shop-Decks, S-Shop-DeckConfirm, S-Shop-Odds)', () => {
  it('draws the chosen pack the pane\'s height and the others smaller with their names, all inside the pane', () => {
    for (const { name, m } of landscape) {
      const main = compactShell(m.content).main;
      for (const selected of [0, 5, 11]) {
        const strip = packStrip(main, 12, selected, 18);
        strip.items.forEach((item, i) => {
          const art = { ...item.art, x: item.art.x + main.x };
          expect(art.y, name).toBeGreaterThanOrEqual(main.y);
          expect(art.y + art.height, name).toBeLessThanOrEqual(main.y + main.height);
          expect(item.label === null, name).toBe(i === selected);
          if (item.label) expect(item.label.y + item.label.height, name).toBeLessThanOrEqual(main.y + main.height);
          expect(item.art.width / item.art.height).toBeCloseTo(SHOP_COMPACT.packAspect, 1);
          if (i > 0) expect(item.art.x).toBeGreaterThan(strip.items[i - 1].art.x + strip.items[i - 1].art.width);
        });
        expect(strip.items[selected].art.height).toBeGreaterThan(strip.items[(selected + 1) % 12].art.height);
      }
    }
  });

  it('scrolls the chosen pack to the pane\'s left edge, never past either end', () => {
    const main = { x: 0, y: 0, width: 480, height: 300 };
    const strip = packStrip(main, 12, 5, 18);
    const max = packStripMaxScroll(strip, main.width);
    expect(packStripScrollFor(strip, main.width, 0)).toBe(0);
    expect(packStripScrollFor(strip, main.width, 5)).toBe(strip.items[5].art.x - SHOP_COMPACT.packInset);
    const last = packStrip(main, 12, 11, 18);
    expect(packStripScrollFor(last, main.width, 11)).toBe(packStripMaxScroll(last, main.width));
    expect(max).toBe(strip.width - main.width);
    expect(packAt(strip, strip.items[3].art.x + 1)).toBe(3);
    expect(packAt(strip, strip.items[3].art.x - SHOP_COMPACT.packGap / 2)).toBeNull();
  });

  it('keeps a tapped pack where it was on screen, nudged only enough to show it whole', () => {
    const main = { x: 0, y: 0, width: 900, height: 400 };
    const before = packStrip(main, 6, 0, 18, { desktop: true });
    // Tap the fourth pack while the strip sits at its start.
    const tapped = before.items[3].art;
    const anchor = tapped.x + tapped.width / 2;
    const after = packStrip(main, 6, 3, 18, { desktop: true });
    const offset = packStripScrollKeeping(after, main.width, 3, anchor);
    const chosen = after.items[3].art;
    // Whole on screen, and not thrown to the left edge.
    expect(chosen.x - offset).toBeGreaterThanOrEqual(0);
    expect(chosen.x + chosen.width - offset).toBeLessThanOrEqual(main.width);
    expect(chosen.x - offset).toBeGreaterThan(SHOP_COMPACT.packInset);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(packStripMaxScroll(after, main.width));
  });

  it('fits deck tiles no narrower than the floor, drops a column at the largest text, and maps taps to tiles', () => {
    for (const width of [413, 480, 578]) {
      const grid = deckGrid(width, 18, 20, false);
      expect(grid.tileW).toBeGreaterThanOrEqual(SHOP_COMPACT.deckMinW);
      expect(grid.columns * grid.tileW + (grid.columns - 1) * SHOP_COMPACT.deckGap).toBeLessThanOrEqual(width - SHOP_COMPACT.thumbLane);
      expect(deckGrid(width, 22, 24, true).columns).toBe(grid.columns - 1);
      expect(grid.lineY + 10 + SHOP_COMPACT.deckPad).toBeLessThanOrEqual(grid.tileH);
    }
    const grid = deckGrid(480, 18, 20, false);
    expect(deckGridHeight(grid, 7)).toBe(Math.ceil(7 / grid.columns) * grid.pitchY - SHOP_COMPACT.deckGap);
    expect(deckCellAt(grid, 7, 5, 5)).toBe(0);
    expect(deckCellAt(grid, 7, grid.pitchX + 5, grid.pitchY + 5)).toBe(grid.columns + 1);
    expect(deckCellAt(grid, 7, grid.tileW + 2, 5)).toBeNull();
    expect(deckCellAt(grid, grid.columns, 5, grid.pitchY + 5)).toBeNull();
  });

  it('scrolls a tile into view only when it is out of view', () => {
    const grid = deckGrid(480, 18, 20, false);
    const row2 = 2 * grid.columns;
    expect(deckScrollToShow(grid, 0, 300, 0)).toBe(0);
    expect(deckScrollToShow(grid, row2, 300, 0)).toBe(2 * grid.pitchY + grid.tileH - 300);
    expect(deckScrollToShow(grid, 0, 300, 120)).toBe(0);
    expect(deckScrollToShow(grid, grid.columns, 300, grid.pitchY - 10)).toBe(grid.pitchY - 10);
  });

  it('sets a sheet beside the column, its two halves apart, and leaves the column under the purse', () => {
    for (const { name, m } of landscape) {
      const content = m.content;
      const sheet = shopSheet(content, 50);
      const shell = compactShell(content);
      for (const r of [sheet.frame, sheet.title, sheet.close, sheet.body, sheet.left, sheet.right, sheet.column]) expect(inside(r, content), name).toBe(true);
      for (const r of [sheet.title, sheet.close, sheet.body]) expect(inside(r, sheet.frame), name).toBe(true);
      expect(overlap(sheet.frame, sheet.column), name).toBe(false);
      expect(overlap(sheet.left, sheet.right), name).toBe(false);
      expect(overlap(sheet.title, sheet.close), name).toBe(false);
      expect(sheet.body.y, name).toBeGreaterThanOrEqual(sheet.title.y + sheet.title.height);
      expect(sheet.close.width).toBe(COMPACT.touch);
      // The column beside a sheet is the one the screen beneath it uses.
      expect(sheet.column, name).toEqual(shell.column);
    }
  });

  it('on desktop a short deck list grows its art to fill the pane, capped; phones and long lists keep the phone art', () => {
    const main = compactShell(desktopCompactMetrics().content).main;
    const S = SHOP_COMPACT;
    const phone = deckGrid(main.width, 18, 20, false, DESKTOP_GRID.shopDeckMinW);
    const filled = deckGrid(main.width, 18, 20, false, DESKTOP_GRID.shopDeckMinW, { paneH: main.height, count: 5 });
    expect(filled.columns).toBe(phone.columns);
    expect(filled.tileW).toBe(phone.tileW);
    expect(filled.artH).toBeGreaterThan(phone.artH);
    expect(filled.artH).toBeLessThanOrEqual(Math.round((filled.tileW - 2 * S.deckPad) * S.deckArtAspectMax));
    // The two rows sit inside the pane, and leave less than a gap per row unfilled unless the cap stopped them.
    const height = deckGridHeight(filled, 5);
    expect(height).toBeLessThanOrEqual(main.height);
    const capped = filled.artH === Math.round((filled.tileW - 2 * S.deckPad) * S.deckArtAspectMax);
    if (!capped) expect(main.height - height).toBeLessThanOrEqual(2 * S.deckGap);
    expect(filled.lineY + 10 + S.deckPad).toBeLessThanOrEqual(filled.tileH);
    // A list that already scrolls keeps the phone's art.
    expect(deckGrid(main.width, 18, 20, false, DESKTOP_GRID.shopDeckMinW, { paneH: main.height, count: 15 })).toEqual(phone);
  });
});
