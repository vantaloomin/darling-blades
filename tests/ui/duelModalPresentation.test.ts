import { describe, expect, it } from 'vitest';
import { duelModalLayout } from '../../src/ui/duelModalPresentation';
import { isRectContained, type Rect } from '../../src/ui/layout';

const panel: Rect = { x: 300, y: 180, width: 600, height: 360 };
const row = (y: number, height: number) => ({ y, bounds: { x: 400, y: y - height / 2, width: 400, height } });

describe('duel modal measured bands', () => {
  it('preserves release anchors and density at standard text', () => {
    const bands = [row(240, 48), row(320, 24), row(380, 30), row(460, 44)];
    const result = duelModalLayout(panel, bands, 1);
    expect(result.panel).toEqual(panel);
    expect(result.rows.map((band) => band.y)).toEqual(bands.map((band) => band.y));
    expect(result.fits).toBe(true);
  });

  it('leaves spare space and later anchors alone when enlarged text still fits', () => {
    const bands = [row(240, 48), row(320, 32), row(380, 36), row(460, 44)];
    const result = duelModalLayout(panel, bands, 1.3);
    expect(result.rows.every((band) => band.offsetY === 0)).toBe(true);
    expect(result.panel).toEqual(panel);
  });

  it('moves only colliding bands and grows the panel around complete rewards and actions', () => {
    const result = duelModalLayout(panel, [row(240, 48), row(320, 100), row(380, 100), row(460, 60)], 1.3);
    expect(result.rows[0].offsetY).toBe(0);
    expect(result.rows[1].offsetY).toBe(0);
    expect(result.rows[2].offsetY).toBeGreaterThan(0);
    for (let index = 1; index < result.rows.length; index++) {
      const previous = result.rows[index - 1].bounds, current = result.rows[index].bounds;
      expect(current.y - previous.y - previous.height).toBeGreaterThanOrEqual(6);
    }
    expect(result.panel.height).toBeGreaterThan(panel.height);
    for (const band of result.rows) expect(isRectContained(band.bounds, result.panel)).toBe(true);
    expect(result.fits).toBe(true);
  });

  it('moves the complete dialog into the safe frame when growth reaches its bottom', () => {
    const safe = { x: 64, y: 36, width: 1152, height: 648 };
    const result = duelModalLayout({ ...panel, y: 330 }, [row(370, 48), row(500, 160), row(620, 120)], 1.3, { safe });
    expect(result.rows[0].offsetY).toBeLessThan(0);
    expect(isRectContained(result.panel, safe)).toBe(true);
    expect(result.fits).toBe(true);
  });

  it('reports an oversized reading region without hiding its text under a mask', () => {
    const result = duelModalLayout(panel, [row(240, 48), row(350, 700), row(460, 44)], 1.3,
      { safe: { x: 64, y: 36, width: 1152, height: 648 } });
    expect(result.fits).toBe(false);
    for (const band of result.rows) expect(isRectContained(band.bounds, result.panel)).toBe(true);
  });
});
