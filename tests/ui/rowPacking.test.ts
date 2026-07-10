import { describe, expect, it } from 'vitest';
import { packRow } from '../../src/ui/rowPacking';

const WAVE2 = { usableWidth: 860, tileWidth: 156, maxSpacing: 174 };

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
});
