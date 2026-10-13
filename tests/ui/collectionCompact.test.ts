import { describe, expect, it } from 'vitest';
import {
  binderCellAt,
  binderColumn,
  binderGrid,
  binderHeight,
  COLLECTION_COMPACT,
  compactInspectLayout,
  stackUp,
} from '../../src/ui/collectionCompact';
import { COMPACT } from '../../src/ui/compactLayout';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.width <= b.x + b.width + 1e-6 && a.y + a.height <= b.y + b.height + 1e-6;

describe('the compact Collection (mocks D-Binder, D-Detail, D-Craft)', () => {
  it('fills the pane with cards no narrower than the floor, and drops a column at the largest text', () => {
    for (const width of [413, 480, 661]) {
      const grid = binderGrid(width, 14, false);
      expect(grid.cardW).toBeGreaterThanOrEqual(COLLECTION_COMPACT.minCardW);
      expect(grid.columns * grid.cardW + (grid.columns - 1) * COLLECTION_COMPACT.gridGap).toBeLessThanOrEqual(width - COLLECTION_COMPACT.thumbLane);
      // One more column would push the cards under the floor.
      expect((width - COLLECTION_COMPACT.thumbLane - grid.columns * COLLECTION_COMPACT.gridGap) / (grid.columns + 1)).toBeLessThan(COLLECTION_COMPACT.minCardW);
      const large = binderGrid(width, 18, true);
      expect(large.columns).toBe(grid.columns - 1);
      expect(large.cardW).toBeGreaterThan(grid.cardW);
    }
  });

  it('works out the tapped card from the grid, the badge line included and the gaps not', () => {
    const grid = binderGrid(480, 14, false);
    expect(binderHeight(grid, 9)).toBe(3 * grid.pitchY - COLLECTION_COMPACT.rowGap);
    expect(binderCellAt(grid, 9, 5, 5)).toBe(0);
    expect(binderCellAt(grid, 9, grid.pitchX + 5, grid.cardH + COLLECTION_COMPACT.badgeGap + 5)).toBe(1);
    expect(binderCellAt(grid, 9, grid.cardW + 2, 5)).toBeNull();
    expect(binderCellAt(grid, 9, 5, grid.pitchY - 2)).toBeNull();
    // Row 2 has one card; the empty cells beside it take no taps.
    expect(binderCellAt(grid, 9, 5, 2 * grid.pitchY + 5)).toBe(8);
    expect(binderCellAt(grid, 9, grid.pitchX + 5, 2 * grid.pitchY + 5)).toBeNull();
  });

  it('keeps the counter at the column foot, and stacks it under Sort when the column is too short', () => {
    const roomy = binderColumn(230, 300, 44, 66);
    const controls = [roomy.set, roomy.color, roomy.type, roomy.rarity, roomy.owned, roomy.sort, roomy.counter];
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) expect(overlap(controls[i], controls[j])).toBe(false);
      expect(controls[i].x + controls[i].width).toBeLessThanOrEqual(230 + 1e-6);
    }
    expect(roomy.counter.y + roomy.counter.height).toBe(300);
    expect(roomy.height).toBe(300);
    const tight = binderColumn(230, 240, 56, 60);
    expect(tight.counter.y).toBe(tight.sort.y + tight.sort.height + COMPACT.gap);
    expect(tight.height).toBeGreaterThan(240);
  });

  it('sets the face, the middle column and the right column side by side inside every landscape phone', () => {
    for (const { name, m } of landscape) {
      for (const largeText of [false, true]) {
        const L = compactInspectLayout(m.content, largeText, 96);
        for (const r of [L.face, L.middle, L.previous, L.next, L.right, L.close, L.heading, L.list]) expect(inside(r, m.content), name).toBe(true);
        expect(overlap(L.face, L.middle), name).toBe(false);
        expect(overlap(L.middle, L.right), name).toBe(false);
        expect(overlap(L.previous, L.next), name).toBe(false);
        expect(L.middle.width, name).toBeGreaterThanOrEqual(COLLECTION_COMPACT.middleMin);
        expect(L.face.width, name).toBeLessThanOrEqual(largeText ? COLLECTION_COMPACT.faceMaxWLarge : COLLECTION_COMPACT.faceMaxW);
        // The list sits between the heading and the actions' stack.
        expect(L.list.y).toBeGreaterThanOrEqual(L.heading.y + L.heading.height);
        expect(L.list.y + L.list.height + COMPACT.gap + 96).toBeCloseTo(L.right.y + L.right.height);
      }
    }
  });

  it('stacks the actions up from the column foot in their order', () => {
    expect(stackUp(300, [44, 60], 8)).toEqual([188, 240]);
  });
});
