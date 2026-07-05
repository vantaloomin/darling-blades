import { describe, expect, it } from 'vitest';
import {
  animFxCaps,
  animTimeScale,
  TWEEN_TIMESCALE_OFF,
} from '../../src/platform/animPolicy';

describe('animFxCaps', () => {
  it("'full' caps nothing", () => {
    expect(animFxCaps('full')).toEqual({
      iridescence: true,
      shine: true,
      packGlow: true,
      particleScale: 1,
    });
  });

  it("'reduced' is exactly the locked wave-2 definition", () => {
    expect(animFxCaps('reduced')).toEqual({
      iridescence: false,
      shine: true,
      packGlow: false,
      particleScale: 0.5,
    });
  });

  it("'off' disables every family and zeroes particles", () => {
    expect(animFxCaps('off')).toEqual({
      iridescence: false,
      shine: false,
      packGlow: false,
      particleScale: 0,
    });
  });
});

describe('animTimeScale', () => {
  it("'full' and 'reduced' leave tween speed at 1", () => {
    expect(animTimeScale('full')).toBe(1);
    expect(animTimeScale('reduced')).toBe(1);
  });

  it("'off' fast-forwards tweens (callbacks still fire — never removed)", () => {
    expect(animTimeScale('off')).toBe(TWEEN_TIMESCALE_OFF);
    // fast-forward, not pause/removal: must be a large positive multiplier
    expect(TWEEN_TIMESCALE_OFF).toBeGreaterThan(1);
  });
});
