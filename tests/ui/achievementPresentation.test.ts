import { describe, expect, it } from 'vitest';
import {
  achievementCascadeDelay,
  achievementCascadeDuration,
  achievementClaimMotion,
  achievementClaimPitch,
} from '../../src/ui/achievementPresentation';

describe('achievement claim presentation', () => {
  it('keeps the full cascade staggered and the individual stamp under 300ms', () => {
    const motion = achievementClaimMotion('full');
    expect(motion).toMatchObject({ stampMs: 180, settleMs: 100, staggerMs: 70 });
    expect(motion.stampMs + motion.settleMs).toBeLessThanOrEqual(300);
    expect(achievementCascadeDelay(3, 'full')).toBe(210);
  });

  it('removes transform motion for reduced animation while retaining a short fade cascade', () => {
    const motion = achievementClaimMotion('reduced');
    expect(motion).toEqual({
      stampMs: 100,
      settleMs: 0,
      staggerMs: 50,
      scaleFrom: 1,
      angleFrom: 0,
      angleTo: 0,
    });
  });

  it('makes the off policy immediate without dropping completion timing', () => {
    expect(achievementCascadeDuration(16, 'off')).toBe(0);
    expect(achievementClaimMotion('off').stampMs).toBe(0);
  });

  it('raises cascade pitch monotonically across a perfect fifth', () => {
    const pitches = Array.from({ length: 8 }, (_, index) => achievementClaimPitch(index, 8));
    expect(pitches[0]).toBe(1);
    expect(pitches.at(-1)).toBeCloseTo(2 ** (7 / 12));
    expect(pitches.every((pitch, index) => index === 0 || pitch > pitches[index - 1])).toBe(true);
  });
});
