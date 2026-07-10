import { describe, expect, it } from 'vitest';
import { packRow } from '../../src/ui/rowPacking';

const WAVE2 = { usableWidth: 860, tileWidth: 156, maxSpacing: 174, gutter: 6 };

describe('packRow', () => {
  it('count 0 returns no offsets at full scale', () => {
    const packed = packRow(0, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
    expect(packed.offsets).toEqual([]);
    expect(packed.spacing).toBe(0);
    expect(packed.scale).toBe(1);
  });

  it('count 1 returns one centered offset at full scale', () => {
    const packed = packRow(1, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
    expect(packed.offsets).toEqual([0]);
    expect(packed.spacing).toBe(0);
    expect(packed.scale).toBe(1);
  });

  it.each([2, 3, 5, 8, 12])('count %i offsets are symmetric around the row center', (count) => {
    const { offsets } = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
    for (let i = 0; i < count; i++) {
      expect(offsets[i]).toBeCloseTo(-offsets[count - 1 - i], 9);
    }
  });

  it('caps spacing at maxSpacing when the row is roomy', () => {
    const packed = packRow(3, 2000, WAVE2.tileWidth, WAVE2.maxSpacing);
    expect(packed.spacing).toBe(WAVE2.maxSpacing);
    expect(packed.offsets).toEqual([-WAVE2.maxSpacing, 0, WAVE2.maxSpacing]);
    expect(packed.scale).toBe(1);
  });

  it('keeps five Wave 2 tiles full scale and shrinks six or more', () => {
    const five = packRow(5, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
    expect(five.spacing).toBe(WAVE2.maxSpacing);
    expect(five.scale).toBe(1);

    for (const count of [6, 7, 12]) {
      const packed = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
      expect(packed.scale).toBeLessThan(1);
    }
  });

  it('uses the gutter cap for crowded Wave 2 rows', () => {
    const expected = [
      // spacing = (860 - 156) / 5 = 140.8; scale = (140.8 - 6) / 156.
      { count: 6, spacing: 140.8, scale: 0.8641025641025641 },
      // spacing = (860 - 156) / 6 = 117.3333333333; scale = (spacing - 6) / 156.
      { count: 7, spacing: 117.33333333333333, scale: 0.7136752136752137 },
      // spacing = (860 - 156) / 11 = 64; scale = (64 - 6) / 156.
      { count: 12, spacing: 64, scale: 0.3717948717948718 },
    ];

    for (const { count, spacing, scale } of expected) {
      const packed = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
      expect(packed.spacing).toBeCloseTo(spacing, 9);
      expect(packed.scale).toBeCloseTo(scale, 9);
    }
  });

  it('Wave 2 scale is non-increasing as the row grows', () => {
    let previous = 1;
    for (let count = 5; count <= 12; count++) {
      const { scale } = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });

  it('keeps scaled tile edges inside the usable Wave 2 width through count 12', () => {
    for (let count = 0; count <= 12; count++) {
      const packed = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
      for (const offset of packed.offsets) {
        const edge = Math.abs(offset) + (WAVE2.tileWidth * packed.scale) / 2;
        expect(edge).toBeLessThanOrEqual(WAVE2.usableWidth / 2);
      }
    }
  });

  it('guarantees Wave 2 adjacent tiles keep the configured gutter', () => {
    for (let count = 2; count <= 12; count++) {
      const packed = packRow(count, WAVE2.usableWidth, WAVE2.tileWidth, WAVE2.maxSpacing);
      if (packed.scale < 1) {
        expect(packed.scale * WAVE2.tileWidth + WAVE2.gutter).toBeLessThanOrEqual(
          packed.spacing + 1e-9,
        );
      } else {
        expect(packed.spacing).toBeGreaterThanOrEqual(WAVE2.tileWidth + WAVE2.gutter);
      }
    }
  });
});
