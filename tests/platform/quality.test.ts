import { describe, expect, it } from 'vitest';
import { detectQualityTier, type QualityEnv } from '../../src/platform/quality';

/** A desktop-shaped env; tests override the field under test. */
const desktop = (over: Partial<QualityEnv> = {}): QualityEnv => ({
  queryQuality: null,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  coarsePointer: false,
  maxTouchPoints: 0,
  deviceMemoryGb: 16,
  webglMaxTextureSize: 16384,
  ...over,
});

describe('detectQualityTier', () => {
  it('desktop detects full (the no-behavior-change guarantee)', () => {
    expect(detectQualityTier(desktop())).toBe('full');
  });

  it('headless env (no signals at all) detects full', () => {
    expect(
      detectQualityTier({ queryQuality: null, userAgent: '', coarsePointer: false, maxTouchPoints: 0 }),
    ).toBe('full');
  });

  it('the ?quality= override wins in both directions', () => {
    expect(detectQualityTier(desktop({ queryQuality: 'lite' }))).toBe('lite');
    expect(
      detectQualityTier(
        desktop({
          queryQuality: 'full',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
          coarsePointer: true,
          maxTouchPoints: 5,
        }),
      ),
    ).toBe('full');
    // garbage values fall through to detection
    expect(detectQualityTier(desktop({ queryQuality: 'ultra' }))).toBe('full');
  });

  it('mobile user agents detect lite', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    ]) {
      expect(detectQualityTier(desktop({ userAgent: ua }))).toBe('lite');
    }
  });

  it('iPadOS masquerading as Macintosh detects lite via multi-touch', () => {
    const ipadUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    expect(detectQualityTier(desktop({ userAgent: ipadUa, maxTouchPoints: 5 }))).toBe('lite');
    // a real Mac (no touch) stays full
    expect(detectQualityTier(desktop({ userAgent: ipadUa, maxTouchPoints: 0 }))).toBe('full');
  });

  it('coarse-pointer touch devices detect lite even with an unrecognized UA', () => {
    expect(
      detectQualityTier(desktop({ userAgent: 'SomethingNew/1.0', coarsePointer: true, maxTouchPoints: 10 })),
    ).toBe('lite');
    // coarse pointer alone (no touch points) is not enough — e.g. a TV remote-ish setup
    expect(detectQualityTier(desktop({ userAgent: 'SomethingNew/1.0', coarsePointer: true }))).toBe('full');
  });

  it('low-capability hardware detects lite on the memory and WebGL floors', () => {
    expect(detectQualityTier(desktop({ deviceMemoryGb: 2 }))).toBe('lite');
    expect(detectQualityTier(desktop({ deviceMemoryGb: 4 }))).toBe('full');
    expect(detectQualityTier(desktop({ webglMaxTextureSize: 2048 }))).toBe('lite');
    expect(detectQualityTier(desktop({ webglMaxTextureSize: undefined }))).toBe('full');
  });
});
