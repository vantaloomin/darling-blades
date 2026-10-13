import { describe, expect, it } from 'vitest';
import { compactDeckRows, compactPlayLayout, compactTileGrid, PLAY_COMPACT } from '../../src/ui/playCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));
const reference = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Play hub (mock M-Play)', () => {
  it('lays three mode tiles in one row beside the deck column on the reference phone', () => {
    const l = compactPlayLayout(reference.content, 3, 17);
    expect(l.tiles).toHaveLength(3);
    expect(new Set(l.tiles.map((t) => t.y)).size).toBe(1);
    expect(l.tiles.every((t) => t.width >= PLAY_COMPACT.minTileW)).toBe(true);
    expect(l.editDecks).toEqual({ x: 555, y: 320, width: 230, height: 44 });
    const lastTile = l.tiles[2];
    expect(lastTile.x + lastTile.width).toBeLessThanOrEqual(l.deckList.x - 8);
  });

  it('keeps every tile, the list and Edit decks inside the content box, apart, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      for (const count of [3, 4]) {
        const l = compactPlayLayout(m.content, count, 21);
        const parts = [...l.tiles, l.deckList, l.editDecks];
        for (const r of parts) expect(inside(r, m.content), `${name} ${count}`).toBe(true);
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j]), `${name} ${count} ${i}/${j}`).toBe(false);
        }
        expect(l.editDecks.height).toBeGreaterThanOrEqual(44);
        expect(l.tiles.every((t) => t.width >= 44 && t.height >= 44)).toBe(true);
      }
    }
  });
});

describe('compactTileGrid', () => {
  const main = { x: 0, y: 0, width: 400, height: 300 };

  it('moves to two rows rather than squeeze tiles under the floor, the odd tile running full width', () => {
    const tiles = compactTileGrid(main, 3);
    expect(tiles.map((t) => t.y)).toEqual([0, 0, 156]);
    expect(tiles[2].width).toBe(400);
    expect(tiles[0].width).toBe(194);
  });

  it('keeps one row when each tile holds the floor', () => {
    const tiles = compactTileGrid({ ...main, width: 480 }, 3);
    expect(new Set(tiles.map((t) => t.y))).toEqual(new Set([0]));
    expect(tiles.every((t) => t.width >= PLAY_COMPACT.minTileW)).toBe(true);
  });
});

describe('compactDeckRows', () => {
  it('stacks measured rows on the row gap, never under the row floor', () => {
    const rows = compactDeckRows([30, 70, 50]);
    expect(rows.heights).toEqual([PLAY_COMPACT.rowMinH, 70, 50]);
    expect(rows.ys).toEqual([0, PLAY_COMPACT.rowMinH + PLAY_COMPACT.rowGap, PLAY_COMPACT.rowMinH + 70 + 2 * PLAY_COMPACT.rowGap]);
    expect(rows.total).toBe(PLAY_COMPACT.rowMinH + 70 + 50 + 2 * PLAY_COMPACT.rowGap);
  });
});
