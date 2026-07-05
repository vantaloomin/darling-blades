import { describe, expect, it } from 'vitest';
import {
  recipeDuration,
  SFX,
  SFX_NAMES,
  voiceEnd,
  type Voice,
} from '../../src/audio/recipes';

const allVoices: [string, Voice][] = SFX_NAMES.flatMap((name) =>
  SFX[name].map((v): [string, Voice] => [name, v]),
);

describe('SFX recipes', () => {
  it('defines at least one voice for every sound', () => {
    for (const name of SFX_NAMES) expect(SFX[name].length, name).toBeGreaterThan(0);
  });

  it('keeps every voice quiet and well-formed', () => {
    for (const [name, v] of allVoices) {
      expect(v.peak, `${name} peak`).toBeGreaterThan(0);
      expect(v.peak, `${name} peak`).toBeLessThanOrEqual(0.4);
      expect(v.attack, `${name} attack`).toBeGreaterThan(0);
      expect(v.decay, `${name} decay`).toBeGreaterThan(0);
      expect(v.at ?? 0, `${name} at`).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps frequencies audible and exponential-ramp safe (strictly > 0)', () => {
    for (const [name, v] of allVoices) {
      const freqs =
        v.kind === 'tone'
          ? [v.freq, v.freqEnd]
          : [v.filter?.freq, v.filter?.freqEnd];
      for (const f of freqs) {
        if (f === undefined) continue;
        expect(f, `${name} freq`).toBeGreaterThan(20);
        expect(f, `${name} freq`).toBeLessThan(12000);
      }
    }
  });

  it('keeps everything short — this is a card game, not an arcade', () => {
    for (const name of SFX_NAMES) {
      expect(recipeDuration(SFX[name]), name).toBeLessThanOrEqual(1.5);
    }
    // UI ticks must stay snappy enough to spam
    expect(recipeDuration(SFX.click)).toBeLessThan(0.15);
    expect(recipeDuration(SFX.hover)).toBeLessThan(0.1);
  });

  it('gives win and loss clearly distinct recipes', () => {
    expect(SFX.win).not.toEqual(SFX.loss);
    expect(SFX.shimmer).not.toEqual(SFX.flip);
  });

  it('computes duration as the latest voice end', () => {
    const voices: Voice[] = [
      { kind: 'tone', wave: 'sine', freq: 440, peak: 0.1, attack: 0.01, decay: 0.2 },
      { kind: 'noise', peak: 0.1, attack: 0.05, decay: 0.3, at: 0.5 },
    ];
    expect(voiceEnd(voices[0])).toBeCloseTo(0.21);
    expect(recipeDuration(voices)).toBeCloseTo(0.85);
  });
});
