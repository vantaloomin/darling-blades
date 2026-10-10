import { describe, expect, it } from 'vitest';
import {
  BACKING_STORE_BUDGET,
  compactCanvasSize,
  compactLayoutRequested,
  compactRenderK,
  designWindowViewport,
  designWindowZoom,
  REFERENCE_PHONE,
  resolveScreenMetrics,
  type ScreenMetrics,
} from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';

const byName = (name: string): ScreenMetrics => {
  const f = SCREEN_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return resolveScreenMetrics(f);
};

describe('resolveScreenMetrics over the support matrix fixtures', () => {
  it('every phone fixture is a compact phone drawn one design px per CSS px', () => {
    for (const f of SCREEN_FIXTURES.filter((x) => x.name.startsWith('phone-'))) {
      const m = resolveScreenMetrics(f);
      expect(m, f.name).toMatchObject({ profile: 'compact', device: 'phone', presentation: 'fill', scale: 1 });
      expect(m.design, f.name).toEqual({ width: f.viewportWidth, height: f.viewportHeight });
    }
  });

  it('the reference phone gets the mocks\' 718x356 content box at (67, 8)', () => {
    expect(byName('phone-island').content).toEqual({ x: 67, y: 8, width: 718, height: 356 });
  });

  it('every content box sits inside its design space and clears the safe area', () => {
    for (const f of SCREEN_FIXTURES) {
      const m = resolveScreenMetrics(f);
      const { x, y, width, height } = m.content;
      expect(x, f.name).toBeGreaterThanOrEqual(0);
      expect(y, f.name).toBeGreaterThanOrEqual(0);
      expect(x + width, f.name).toBeLessThanOrEqual(m.design.width);
      expect(y + height, f.name).toBeLessThanOrEqual(m.design.height);
      if (m.device === 'phone') {
        expect(x, f.name).toBeGreaterThanOrEqual(f.insets?.left ?? 0);
        expect(m.design.width - (x + width), f.name).toBeGreaterThanOrEqual(f.insets?.right ?? 0);
        expect(m.design.height - (y + height), f.name).toBeGreaterThanOrEqual(f.insets?.bottom ?? 0);
      }
    }
  });

  it('the shortest phone still has room for the duel\'s 44 px rows', () => {
    // phone-short is the design minimum (the Android 360 class).
    expect(byName('phone-short').content.height).toBeGreaterThanOrEqual(7 * 44);
  });

  it('the iPad mini resolves to a tablet: the reference composition scaled to fit', () => {
    const m = byName('tablet-mini');
    expect(m).toMatchObject({ profile: 'compact', device: 'tablet', presentation: 'fill' });
    expect(m.scale).toBeCloseTo(1133 / REFERENCE_PHONE.width, 6);
    expect(m.design.width).toBeCloseTo(REFERENCE_PHONE.width, 6);
    expect(m.content.width).toBe(718);
    expect(m.content.height).toBe(356);
  });

  it('an 11-inch iPad in landscape lands at the mocks\' 138% (P5)', () => {
    const m = resolveScreenMetrics({ viewportWidth: 1180, viewportHeight: 820, coarsePointer: true, devicePixelRatio: 2 });
    expect(Math.round(m.scale * 100)).toBe(138);
    // The reference frame (852x393) is centred, with equal bands above and below.
    const frameTop = m.content.y - 8;
    const frameBottom = m.content.y + m.content.height + 8 + REFERENCE_PHONE.insets.bottom;
    expect(frameBottom - frameTop).toBeCloseTo(REFERENCE_PHONE.height, 6);
    expect(frameTop).toBeCloseTo(m.design.height - frameBottom, 6);
    expect(frameTop).toBeGreaterThan(0);
  });

  it('a squat touch screen lets the height decide so nothing is cut off', () => {
    const m = resolveScreenMetrics({ viewportWidth: 1600, viewportHeight: 620, coarsePointer: true });
    expect(m.device).toBe('tablet');
    expect(REFERENCE_PHONE.height * m.scale).toBeLessThanOrEqual(620);
    expect(REFERENCE_PHONE.width * m.scale).toBeLessThanOrEqual(1600);
  });

  it('an upright tablet is letterboxed at 96% of its width (M11)', () => {
    const m = byName('tablet-upright');
    expect(m).toMatchObject({ device: 'tablet', orientation: 'portrait', presentation: 'letterbox' });
    expect(REFERENCE_PHONE.width * m.scale).toBeCloseTo(820 * 0.96, 6);
  });

  it('a phone held upright gets the rotate screen; a tablet never does', () => {
    expect(resolveScreenMetrics({ viewportWidth: 393, viewportHeight: 852, coarsePointer: true }).presentation).toBe('rotate');
    for (const f of SCREEN_FIXTURES.filter((x) => x.name.startsWith('tablet-'))) {
      expect(resolveScreenMetrics(f).presentation, f.name).not.toBe('rotate');
    }
  });
});

describe('the short variant (M21)', () => {
  it('phone Safari with its bars up is short; every matrix phone is regular', () => {
    expect(resolveScreenMetrics({ viewportWidth: 750, viewportHeight: 297, coarsePointer: true }).variant).toBe('short');
    for (const f of SCREEN_FIXTURES) expect(resolveScreenMetrics(f).variant, f.name).toBe('regular');
  });
});

describe('the profile rule', () => {
  it('a fine pointer is the wide desktop profile at every size, even a phone-sized window', () => {
    for (const [w, h] of [[844, 390], [1280, 720], [2560, 1440]]) {
      const m = resolveScreenMetrics({ viewportWidth: w, viewportHeight: h, coarsePointer: false, devicePixelRatio: 2 });
      expect(m).toMatchObject({ profile: 'wide', device: 'desktop', design: { width: 1280, height: 720 } });
    }
  });

  it('an unreadable touch screen falls back to the reference phone rather than throwing', () => {
    for (const [w, h] of [[0, 0], [Number.NaN, 390], [-5, Number.POSITIVE_INFINITY]]) {
      const m = resolveScreenMetrics({ viewportWidth: w, viewportHeight: h, coarsePointer: true, devicePixelRatio: Number.NaN });
      expect(m).toMatchObject({ profile: 'compact', scale: 1, renderK: 1 });
      expect(m.design).toEqual({ width: REFERENCE_PHONE.width, height: REFERENCE_PHONE.height });
    }
  });
});

describe('compactRenderK', () => {
  it('snaps the pixel ratio down to 1, 1.5 or 2', () => {
    expect(compactRenderK(852, 393, 3)).toBe(2);
    expect(compactRenderK(780, 360, 2.625)).toBe(2);
    expect(compactRenderK(852, 393, 1.75)).toBe(1.5);
    expect(compactRenderK(852, 393, 1.25)).toBe(1);
    expect(compactRenderK(852, 393, undefined)).toBe(1);
  });

  it('lowers the factor until the backing store fits the desktop budget', () => {
    // A 1280x800 tablet (the Galaxy Tab A8 class) at k = 2 would be 4.1 MP.
    expect(compactRenderK(1280, 800, 2)).toBe(1.5);
    for (const f of SCREEN_FIXTURES) {
      const m = resolveScreenMetrics(f);
      expect(f.viewportWidth * f.viewportHeight * m.renderK ** 2, f.name).toBeLessThanOrEqual(BACKING_STORE_BUDGET);
    }
  });

  it('never goes below 1, even for a screen past the budget at k = 1', () => {
    expect(compactRenderK(4000, 3000, 2)).toBe(1);
  });
});

describe('the compact canvas and the design-window fit (C2)', () => {
  it('the canvas is the screen times the render factor, so FIT leaves no bars', () => {
    const m = byName('phone-island');
    expect(compactCanvasSize(m)).toEqual({ width: 852 * 2, height: 393 * 2 });
    const t = byName('tablet-mini');
    const c = compactCanvasSize(t);
    expect(c.width / c.height).toBeCloseTo(1133 / 744, 2);
  });

  it('an unmigrated 1280x720 scene fits inside every fixture canvas', () => {
    for (const f of SCREEN_FIXTURES) {
      const c = compactCanvasSize(resolveScreenMetrics(f));
      const z = designWindowZoom(c.width, c.height);
      expect(1280 * z, f.name).toBeLessThanOrEqual(c.width + 1e-9);
      expect(720 * z, f.name).toBeLessThanOrEqual(c.height + 1e-9);
      // It touches one pair of edges: it is as large as it can be.
      expect(Math.max(1280 * z / c.width, 720 * z / c.height), f.name).toBeCloseTo(1, 9);
    }
  });

  it('on the desktop canvas the fit is the render factor, as today', () => {
    expect(designWindowZoom(1280 * 1.5, 720 * 1.5)).toBe(1.5);
    expect(designWindowZoom(0, 720)).toBe(1);
  });

  it('only ?layout=compact turns the compact profile on', () => {
    expect(compactLayoutRequested('?layout=compact')).toBe(true);
    expect(compactLayoutRequested('?showcase=x&layout=compact')).toBe(true);
    expect(compactLayoutRequested('')).toBe(false);
    expect(compactLayoutRequested('?layout=wide')).toBe(false);
  });
});

describe('designWindowViewport', () => {
  it('is the fitted 1280x720 window, centred, in whole canvas px', () => {
    // The Android 360 emulator's measured canvas with the reserve dropped: 780x256 CSS at k = 2.
    const vp = designWindowViewport(1560, 512);
    expect(vp.height).toBe(512);
    expect(vp.width).toBe(Math.round(1280 * (512 / 720)));
    expect(vp.x).toBe(Math.round((1560 - vp.width) / 2));
    expect(vp.y).toBe(0);
  });

  it('an upright tablet fits the window to 96% of the width, centred (M11)', () => {
    // The tablet-upright fixture at k = 1.5: a 1230x1770 canvas.
    const vp = designWindowViewport(1230, 1770, 0.96);
    expect(vp.width).toBe(Math.round(1230 * 0.96));
    expect(vp.x).toBe(Math.round((1230 - vp.width) / 2));
    expect(vp.y).toBe(Math.round((1770 - vp.height) / 2));
  });
});
