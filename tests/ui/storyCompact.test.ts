import { describe, expect, it } from 'vitest';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { generateStoryMap } from '../../src/meta/story/storyMap';
import { storyActByNumber } from '../../src/meta/story/storyState';
import type { Rect } from '../../src/ui/layout';
import { storyCardRow, storyMapPlan, storySceneLayout, storyScreenLayout, storyTiles } from '../../src/ui/storyCompact';

const landscape = [
  ...SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, content: resolveScreenMetrics(f).content })),
  { name: 'desktop', content: desktopCompactMetrics().content },
];

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;
const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x - 1e-6 && r.y >= box.y - 1e-6 && r.x + r.width <= box.x + box.width + 1e-6 && r.y + r.height <= box.y + box.height + 1e-6;

describe('the compact Story screens (frames N-31 to N-37)', () => {
  it('keeps three heroines or boons and an offered card row inside the main pane, the column clear', () => {
    for (const { name, content } of landscape) {
      const l = storyScreenLayout(content);
      const main = l.shell.main;
      const tiles = storyTiles(main, 3);
      for (const t of tiles) expect(inside(t, main), name).toBe(true);
      expect(overlap(tiles[0], tiles[1]) || overlap(tiles[1], tiles[2]), name).toBe(false);
      const row = storyCardRow(main, 3, l.k, true);
      for (const [i, t] of row.tiles.entries()) {
        expect(inside(t, main) && inside(row.captions[i], main), name).toBe(true);
        expect(t.width, name).toBeGreaterThanOrEqual(72);
      }
      expect(overlap(main, l.column.body) || overlap(l.column.body, l.column.foot) || overlap(l.column.secondary, l.column.primary), name).toBe(false);
    }
  });

  it('lays the act’s floors left to right inside the map pane, no two stops’ hit squares touching', () => {
    const act = storyActByNumber(1)!;
    for (const seed of [1, 7, 42]) {
      const map = generateStoryMap(act, seed);
      for (const { name, content } of landscape) {
        const l = storyScreenLayout(content);
        const plan = storyMapPlan(l.shell.main, map.floors, l.k);
        const hits = map.floors.flat().map((n) => {
          const s = plan.stops.get(n.id)!;
          return { floor: n.floor, x: s.x, medallion: { x: s.x - s.d / 2, y: s.y - s.d / 2, width: s.d, height: s.d }, rect: { x: s.x - plan.hit / 2, y: s.y - plan.hit / 2, width: plan.hit, height: plan.hit } };
        });
        for (const h of hits) expect(inside(h.medallion, l.shell.main), name).toBe(true);
        for (const a of hits) for (const b of hits) if (a !== b) expect(overlap(a.rect, b.rect), `${name} seed ${seed}`).toBe(false);
        for (const a of hits) for (const b of hits) if (a.floor < b.floor) expect(a.x, name).toBeLessThan(b.x);
      }
    }
  });

  it('puts a line’s portrait, text, hint and Continue side by side without overlap', () => {
    for (const { name, content } of landscape) {
      const s = storySceneLayout(content, true, false, 18);
      expect(overlap(s.portrait!, s.text) || overlap(s.text, s.column.foot) || overlap(s.hint, s.column.foot), name).toBe(false);
      const c = storySceneLayout(content, true, true, 18);
      expect(overlap(c.text, c.column.body) || overlap(c.portrait!, c.text), name).toBe(false);
    }
  });
});
