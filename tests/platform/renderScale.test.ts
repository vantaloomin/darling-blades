import { afterEach, describe, expect, it } from 'vitest';
import {
  activeRenderScale,
  desktopWindowSize,
  resolveRenderScale,
  setActiveRenderScale,
} from '../../src/platform/renderScale';

describe('resolveRenderScale', () => {
  it('the chosen 16:9 resolution passes through on the full tier', () => {
    expect(resolveRenderScale(1, 'full')).toBe(1);
    expect(resolveRenderScale(1.5, 'full')).toBe(1.5);
    expect(resolveRenderScale(2, 'full')).toBe(2);
  });

  it('lite tier caps everything at 1 (VRAM/fill-rate budget)', () => {
    expect(resolveRenderScale(2, 'lite')).toBe(1);
    expect(resolveRenderScale(1.5, 'lite')).toBe(1);
    expect(resolveRenderScale(1, 'lite')).toBe(1);
  });
});

describe('desktopWindowSize', () => {
  // A screen with plenty of room: the target resolution passes through exactly.
  const big = { w: 3840, h: 2160 };

  it('returns the exact 16:9 target when the screen has room', () => {
    expect(desktopWindowSize(1, big.w, big.h)).toEqual({ width: 1280, height: 720 });
    expect(desktopWindowSize(1.5, big.w, big.h)).toEqual({ width: 1920, height: 1080 });
    expect(desktopWindowSize(2, big.w, big.h)).toEqual({ width: 2560, height: 1440 });
  });

  it('shrinks-to-fit (aspect preserved) when the target exceeds the work area', () => {
    // 1440p target on a 1080p work area → clamps down, still 16:9.
    const r = desktopWindowSize(2, 1920, 1040, 1); // margin 1 to isolate the fit math
    expect(r.width).toBeLessThanOrEqual(1920);
    expect(r.height).toBeLessThanOrEqual(1040);
    expect(r.width / r.height).toBeCloseTo(1280 / 720, 2); // 16:9 kept
    // height-bound here: 1040/1440 → width 1849
    expect(r).toEqual({ width: 1849, height: 1040 });
  });

  it('applies the margin so the window never fills the whole work area', () => {
    const r = desktopWindowSize(2, 2560, 1440, 0.9);
    expect(r).toEqual({ width: 2304, height: 1296 }); // 90% of 2560×1440
  });

  it('never upscales past the target even on a huge screen', () => {
    const r = desktopWindowSize(1, 7680, 4320); // 8K screen, 720p target
    expect(r).toEqual({ width: 1280, height: 720 });
  });

  it('falls back to the target when screen metrics are missing (0)', () => {
    expect(desktopWindowSize(1.5, 0, 0)).toEqual({ width: 1920, height: 1080 });
  });
});

describe('active render scale store', () => {
  afterEach(() => setActiveRenderScale(1));

  it('defaults to 1 (headless / pre-boot behavior unchanged)', () => {
    expect(activeRenderScale()).toBe(1);
  });

  it('round-trips the value main.ts sets', () => {
    setActiveRenderScale(2);
    expect(activeRenderScale()).toBe(2);
    setActiveRenderScale(1.5);
    expect(activeRenderScale()).toBe(1.5);
  });
});
