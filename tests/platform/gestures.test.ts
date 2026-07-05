import { describe, expect, it } from 'vitest';
import {
  detectTouchDevice,
  inflateHitArea,
  type InflatableObject,
  type TouchEnv,
} from '../../src/platform/gestures';

const desktop = (over: Partial<TouchEnv> = {}): TouchEnv => ({
  queryTouch: null,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  coarsePointer: false,
  maxTouchPoints: 0,
  ...over,
});

describe('detectTouchDevice', () => {
  it('desktop mouse environments are not touch (the desktop-unchanged guarantee)', () => {
    expect(detectTouchDevice(desktop())).toBe(false);
  });

  it('matches the quality-tier touch clauses: mobile UA, touch iPad-as-Mac, coarse+points', () => {
    expect(
      detectTouchDevice(
        desktop({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' }),
      ),
    ).toBe(true);
    expect(
      detectTouchDevice(
        desktop({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          maxTouchPoints: 5,
        }),
      ),
    ).toBe(true);
    expect(
      detectTouchDevice(
        desktop({ userAgent: 'SomethingNew/1.0', coarsePointer: true, maxTouchPoints: 10 }),
      ),
    ).toBe(true);
    // coarse pointer alone (no touch points) is not touch
    expect(detectTouchDevice(desktop({ coarsePointer: true }))).toBe(false);
  });

  it('the ?touch= override wins in both directions', () => {
    expect(detectTouchDevice(desktop({ queryTouch: 'on' }))).toBe(true);
    expect(
      detectTouchDevice(
        desktop({
          queryTouch: 'off',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
          coarsePointer: true,
          maxTouchPoints: 5,
        }),
      ),
    ).toBe(false);
    // garbage values fall through to detection
    expect(detectTouchDevice(desktop({ queryTouch: 'maybe' }))).toBe(false);
  });
});

/** A fake interactive object shaped like Phaser's (never imports Phaser). */
function fakeObj(
  w: number,
  h: number,
  scale = 1,
): InflatableObject & { hit: { x: number; y: number; w: number; h: number } } {
  const hit = { x: 0, y: 0, w, h };
  return {
    width: w,
    height: h,
    hit,
    input: {
      hitArea: {
        setTo(x: number, y: number, nw: number, nh: number) {
          hit.x = x;
          hit.y = y;
          hit.w = nw;
          hit.h = nh;
          return this;
        },
      },
    },
    getWorldTransformMatrix: () => ({ scaleX: scale, scaleY: scale }),
  };
}

describe('inflateHitArea', () => {
  it('grows a small target to the minimum, centered on the visual', () => {
    const obj = fakeObj(20, 24);
    const res = inflateHitArea(obj, 90, 90);
    expect(res).toEqual({ w: 90, h: 90 });
    expect(obj.hit).toEqual({ x: -35, y: -33, w: 90, h: 90 });
    // must flag the area custom, or Phaser's Text.updateText shrinks it back
    // to the glyph bounds on the next setText/setColor (components/Size.js)
    expect(obj.input!.customHitArea).toBe(true);
  });

  it('never shrinks a dimension that already passes', () => {
    const obj = fakeObj(300, 40);
    const res = inflateHitArea(obj, 90, 90);
    expect(res).toEqual({ w: 300, h: 90 });
    expect(obj.hit.x).toBe(0); // width untouched
    expect(obj.hit.h).toBe(90);
  });

  it('minimums are world/design px: scaled objects inflate in local units', () => {
    const obj = fakeObj(300, 420, 0.18); // a land-stack thumb: 54×75.6 world px
    const res = inflateHitArea(obj, 90, 90);
    expect(res!.w).toBeCloseTo(90);
    expect(res!.h).toBeCloseTo(90);
    expect(obj.hit.w).toBeCloseTo(500); // 90 / 0.18 in local units
  });

  it('applies bias offsets in design px', () => {
    const obj = fakeObj(30, 24, 1);
    inflateHitArea(obj, 90, 66, { biasY: -11 });
    expect(obj.hit.y).toBeCloseTo((24 - 66) / 2 - 11);
    expect(obj.hit.h).toBe(66);
  });

  it('returns null (and does nothing) without a rectangular hit area', () => {
    expect(inflateHitArea({ width: 10, height: 10 }, 90, 90)).toBeNull();
    expect(inflateHitArea({ width: 10, height: 10, input: null }, 90, 90)).toBeNull();
  });
});
