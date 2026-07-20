import { describe, expect, it } from 'vitest';
import {
  COIN_FLIP_CALL_Y,
  COIN_FLIP_FACE_ASSETS,
  COIN_FLIP_FACE_TEXTURES,
  COIN_FLIP_RESULT_Y,
  COIN_FLIP_SIDES,
  coinFlipActionRects,
} from '../../src/ui/coinFlipLayout';
import { COMPACT_TOUCH_GAP_RANGE, measureControlCluster } from '../../src/ui/layout';

describe('coin flip action layout', () => {
  it('maps each side to a distinct full-resolution UI texture', () => {
    expect(new Set(COIN_FLIP_SIDES.map((side) => COIN_FLIP_FACE_TEXTURES[side])).size).toBe(2);
    expect(new Set(COIN_FLIP_SIDES.map((side) => COIN_FLIP_FACE_ASSETS[side])).size).toBe(2);
    for (const side of COIN_FLIP_SIDES) {
      expect(COIN_FLIP_FACE_ASSETS[side]).toBe(`assets/art/ui/coin-${side}.png`);
      expect(COIN_FLIP_FACE_ASSETS[side]).not.toContain('half');
    }
  });

  it.each([COIN_FLIP_CALL_Y, COIN_FLIP_RESULT_Y])(
    'keeps the two CTA hit regions isolated at y=%i',
    (centerY) => {
      const controls = coinFlipActionRects(centerY).map((visual, index) => ({
        id: index === 0 ? 'left' : 'right',
        visual,
      }));
      const cluster = measureControlCluster(controls, 'compactTouch');

      expect(cluster.minimumGap).toBe(COMPACT_TOUCH_GAP_RANGE.max);
      expect(cluster.meetsFloor).toBe(true);
      expect(cluster.withinCompactTouchRange).toBe(true);
    },
  );
});
