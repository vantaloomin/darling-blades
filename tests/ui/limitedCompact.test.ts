import { describe, expect, it } from 'vitest';
import { COMPACT } from '../../src/ui/compactLayout';
import { limitedHubLayout } from '../../src/ui/limitedCompact';
import { limitedBuilderLayout, limitedTileGrid } from '../../src/ui/limitedBuilderCompact';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = [
  ...SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, content: resolveScreenMetrics(f).content })),
  { name: 'desktop', content: desktopCompactMetrics().content },
];

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;
const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x - 1e-6 && r.y >= box.y - 1e-6 && r.x + r.width <= box.x + box.width + 1e-6 && r.y + r.height <= box.y + box.height + 1e-6;

describe('the compact Limited screens (mocks S-Limited-Hub, S-Limited-Builder)', () => {
  it('keeps the hub’s records in view under a run panel with a portrait, on every landscape screen', () => {
    for (const { name, content } of landscape) {
      const l = limitedHubLayout(content, 32, 96, true);
      for (const [a, b] of [[l.intro, l.run], [l.run, l.records], [l.run, l.column], [l.records, l.column], [l.retire, l.next]] as const) {
        expect(overlap(a, b), name).toBe(false);
      }
      expect(inside(l.portrait!, l.run) && inside(l.runText, l.run), name).toBe(true);
      expect(overlap(l.portrait!, l.runText), name).toBe(false);
      // The run panel takes at most half of what the rules leave, so the records keep the other half.
      expect(l.records.height, name).toBeGreaterThanOrEqual(l.run.height - COMPACT.gap);
      expect(inside(l.retire, l.column) && inside(l.next, l.column), name).toBe(true);
    }
  });

  it('lays the builder’s tiles at least six across a phone, inside the grid, with the column clear', () => {
    for (const { name, content } of landscape) {
      const l = limitedBuilderLayout(content);
      const grid = limitedTileGrid(l.grid, 45, l.k);
      expect(grid.columns, name).toBeGreaterThanOrEqual(name === 'desktop' ? 6 : 5);
      for (const c of grid.cells) expect(c.x >= l.grid.x && c.x + c.width <= l.grid.x + l.grid.width - 6, name).toBe(true);
      for (const [a, b] of [[l.grid, l.details], [l.tabs, l.details], [l.clearDeck, l.clearWarchest], [l.auto, l.start], [l.details, l.auto]] as const) {
        expect(overlap(a, b), name).toBe(false);
      }
    }
    const phone = landscape.find((l) => l.name === 'phone-island')!.content;
    const l = limitedBuilderLayout(phone);
    expect(limitedTileGrid(l.grid, 45, l.k).columns).toBe(6);
  });
});
