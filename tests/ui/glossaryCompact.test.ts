import { describe, expect, it } from 'vitest';
import { GLOSSARY_COMPACT, glossaryListColumns, glossaryRowColumns, glossaryTabTiles } from '../../src/ui/glossaryCompact';
import { compactShell } from '../../src/ui/compactLayout';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';

describe('the compact Glossary (mocks M-Glossary, M-GlossaryEntry, M-GlossarySearch)', () => {
  it('sets the name beside the description on a wide row, and the description under it when it would get too narrow', () => {
    const wide = glossaryRowColumns(470, true, 110, 0);
    expect(wide.stacked).toBe(false);
    expect(wide.nameWidth).toBe(110);
    expect(wide.descriptionX).toBeGreaterThanOrEqual(wide.nameX + wide.nameWidth);
    expect(wide.descriptionWidth).toBeGreaterThanOrEqual(GLOSSARY_COMPACT.descriptionMin);
    // A long name takes no more than its share of the row.
    expect(glossaryRowColumns(470, true, 400, 0).nameWidth).toBeLessThanOrEqual(470 * GLOSSARY_COMPACT.nameShare);
    // Search results add the section column; on a narrow row that pushes the description under the name.
    const results = glossaryRowColumns(400, true, 150, 110);
    expect(results.stacked).toBe(true);
    expect(results.descriptionX).toBe(results.nameX);
    expect(results.descriptionWidth).toBe(results.nameWidth);
  });

  it('gives the rows without icons their width back', () => {
    const plain = glossaryRowColumns(470, false, 110, 0);
    expect(plain.iconX).toBeNull();
    expect(plain.nameX).toBeLessThan(glossaryRowColumns(470, true, 110, 0).nameX);
  });

  it('pairs the tabs two across, each row as tall as its taller tile and never under the touch floor', () => {
    const grid = glossaryTabTiles(230, [40, 60, 40, 40, 70]);
    expect(grid.tiles).toHaveLength(5);
    expect(grid.tiles[0].height).toBe(60);
    expect(grid.tiles[1].height).toBe(60);
    expect(grid.tiles[2].height).toBe(44);
    expect(grid.tiles[4].height).toBe(70);
    expect(grid.tiles[1].x).toBeGreaterThan(grid.tiles[0].x + grid.tiles[0].width);
    expect(grid.tiles[1].x + grid.tiles[1].width).toBeCloseTo(230);
    expect(grid.height).toBe(grid.tiles[4].y + 70);
  });

  it('sets the terms two across on a desktop pane and keeps one full-width column on every phone', () => {
    const desk = compactShell(desktopCompactMetrics().content, { back: true }).main;
    const two = glossaryListColumns(desk.width, { desktop: true });
    expect(two.count).toBe(2);
    expect(two.pitch + two.width).toBeCloseTo(desk.width);
    expect(two.width).toBeGreaterThanOrEqual(GLOSSARY_COMPACT.desktopColumnMin);
    // A desktop column still leaves the description beside the name.
    expect(glossaryRowColumns(two.width, true, 110, 0).stacked).toBe(false);
    for (const f of SCREEN_FIXTURES.filter((x) => x.viewportWidth > x.viewportHeight)) {
      const main = compactShell(resolveScreenMetrics(f).content, { back: true }).main;
      expect(glossaryListColumns(main.width), f.name).toEqual({ count: 1, width: main.width, pitch: main.width });
    }
    // Too narrow for two columns of the floor's width, a desktop pane keeps one.
    expect(glossaryListColumns(GLOSSARY_COMPACT.desktopColumnMin * 2, { desktop: true }).count).toBe(1);
  });
});
