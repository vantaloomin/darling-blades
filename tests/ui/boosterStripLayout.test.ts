import { describe, expect, it } from 'vitest';
import {
  boosterStripLayout,
  boosterStripOffsetForIndex,
  boosterStripTileIsFullyVisible,
  boosterStripTileRect,
  boosterStripVisibility,
  type StripLayoutOptions,
} from '../../src/ui/boosterStripLayout';
import { theme } from '../../src/ui/theme';

/**
 * A geometry mask hides pixels but never clips input, so a strip must take a
 * tile's controls out of play unless the whole tile is inside the mask. The
 * Shop's deck strip left a peeking column's Buy live in the gutter past the
 * safe frame; these rules hold for any strip geometry.
 */
const scenarios: { name: string; count: number; options?: StripLayoutOptions }[] = [
  { name: 'booster strip defaults', count: 10 },
  {
    name: 'two-row deck columns with real neighbour peeks',
    count: 8,
    options: {
      visibleCount: 4,
      tileWidth: 230,
      tileHeight: 500,
      tileStride: 262,
      viewport: { x: theme.design.safeLeft, y: 166, width: theme.design.safeWidth, height: 516 },
    },
  },
];

describe('boosterStripTileIsFullyVisible', () => {
  for (const { name, count, options } of scenarios) {
    it(`matches the full-tile band at every snap and never passes a peek (${name})`, () => {
      const layout = boosterStripLayout(count, 0, options);
      for (let index = 0; index <= layout.maxIndex; index++) {
        const offset = boosterStripOffsetForIndex(layout, index);
        const band = boosterStripVisibility(layout, offset);
        for (let tile = 0; tile < count; tile++) {
          const inBand = tile >= band.firstFullIndex && tile <= band.lastFullIndex;
          expect(boosterStripTileIsFullyVisible(layout, tile, offset), `snap ${index}, tile ${tile}`).toBe(inBand);
        }
        for (const peek of [band.leftPeekIndex, band.rightPeekIndex]) {
          if (peek !== null) expect(boosterStripTileIsFullyVisible(layout, peek, offset)).toBe(false);
        }
      }
    });

    it(`only passes tiles that lie entirely inside the viewport, mid-drag included (${name})`, () => {
      const layout = boosterStripLayout(count, 0, options);
      const { x, width } = layout.viewport;
      const first = boosterStripOffsetForIndex(layout, 0);
      const last = boosterStripOffsetForIndex(layout, layout.maxIndex);
      for (let step = 0; step <= 40; step++) {
        const offset = first + ((last - first) * step) / 40;
        for (let tile = 0; tile < count; tile++) {
          if (!boosterStripTileIsFullyVisible(layout, tile, offset)) continue;
          const rect = boosterStripTileRect(layout, tile, offset);
          expect(rect.x).toBeGreaterThanOrEqual(x);
          expect(rect.x + rect.width).toBeLessThanOrEqual(x + width);
        }
      }
    });
  }

  it('reports no tile for an index outside the strip', () => {
    const layout = boosterStripLayout(5);
    expect(boosterStripTileIsFullyVisible(layout, 9, 0)).toBe(false);
  });
});
