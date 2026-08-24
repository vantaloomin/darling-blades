import { describe, expect, it } from 'vitest';
import {
  VERSUS_BUMPER_LAYOUT,
  shouldPlayVersusBumper,
  versusBumperCanvasMaskPoints,
  versusBumperMotion,
  versusLeitmotifPitch,
} from '../../src/ui/versusBumperPresentation';

describe('versus bumper presentation', () => {
  it('plays only on a normal duel entry with motion enabled', () => {
    expect(shouldPlayVersusBumper({
      animations: 'full',
      tutorial: false,
      replay: false,
      internalRestart: false,
    })).toBe(true);
    expect(shouldPlayVersusBumper({
      animations: 'reduced',
      tutorial: false,
      replay: false,
      internalRestart: false,
    })).toBe(true);
  });

  it.each([
    ['tutorial', { animations: 'full', tutorial: true, replay: false, internalRestart: false }],
    ['replay', { animations: 'full', tutorial: false, replay: true, internalRestart: false }],
    ['internal restart', { animations: 'full', tutorial: false, replay: false, internalRestart: true }],
    ['animations off', { animations: 'off', tutorial: false, replay: false, internalRestart: false }],
  ] as const)('suppresses the bumper for %s', (_name, gate) => {
    expect(shouldPlayVersusBumper(gate)).toBe(false);
  });

  it('holds for ten seconds after the entrance before running the exit', () => {
    expect(versusBumperMotion('full')).toEqual({
      entranceMs: 220,
      holdMs: 10_000,
      exitMs: 220,
      panelSlidePx: 88,
      versusScaleFrom: 0.96,
    });
  });

  it('removes translation and scale from the reduced-motion sequence', () => {
    const motion = versusBumperMotion('reduced');
    expect(motion.holdMs).toBe(10_000);
    expect(motion.panelSlidePx).toBe(0);
    expect(motion.versusScaleFrom).toBe(1);
  });

  it.each([1, 1.5, 2] as const)('keeps both split masks aligned to the %sx backing store', (renderScale) => {
    const left = versusBumperCanvasMaskPoints('left', renderScale);
    const right = versusBumperCanvasMaskPoints('right', renderScale);
    expect(left[0]).toEqual({ x: 0, y: 0 });
    expect(left[1].x).toBe(VERSUS_BUMPER_LAYOUT.splitTopX * renderScale);
    expect(left[2].x).toBe(VERSUS_BUMPER_LAYOUT.splitBottomX * renderScale);
    expect(right[1].x).toBe(VERSUS_BUMPER_LAYOUT.width * renderScale);
    expect(right[2]).toEqual({
      x: VERSUS_BUMPER_LAYOUT.width * renderScale,
      y: VERSUS_BUMPER_LAYOUT.height * renderScale,
    });
    expect(right[3]).toEqual(left[2]);
  });

  it('returns a stable nearby transposition for the opponent identity', () => {
    const pitch = versusLeitmotifPitch('the-moonlit-guard');
    expect(versusLeitmotifPitch('the-moonlit-guard')).toBe(pitch);
    expect(pitch).toBeGreaterThanOrEqual(2 ** (-2 / 12));
    expect(pitch).toBeLessThanOrEqual(2 ** (2 / 12));
  });
});
