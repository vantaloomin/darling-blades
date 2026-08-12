import { describe, expect, it } from 'vitest';
import {
  shouldPlayVersusBumper,
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

  it('keeps the full sequence at 1.4 seconds', () => {
    expect(versusBumperMotion('full')).toEqual({
      totalMs: 1_400,
      entranceMs: 220,
      exitMs: 220,
      exitAtMs: 1_180,
      panelSlidePx: 88,
      versusScaleFrom: 0.96,
    });
  });

  it('removes translation and scale from the reduced-motion sequence', () => {
    const motion = versusBumperMotion('reduced');
    expect(motion.totalMs).toBe(1_400);
    expect(motion.panelSlidePx).toBe(0);
    expect(motion.versusScaleFrom).toBe(1);
  });

  it('returns a stable nearby transposition for the opponent identity', () => {
    const pitch = versusLeitmotifPitch('the-moonlit-guard');
    expect(versusLeitmotifPitch('the-moonlit-guard')).toBe(pitch);
    expect(pitch).toBeGreaterThanOrEqual(2 ** (-2 / 12));
    expect(pitch).toBeLessThanOrEqual(2 ** (2 / 12));
  });
});
