import { describe, expect, it } from 'vitest';
import {
  initProgression,
  isDiatonic,
  midiToFreq,
  MOOD_NAMES,
  MOODS,
  plucksForChord,
  SCALE,
  stepProgression,
  triadPcs,
  voiceChord,
  type Chord,
  type MoodPreset,
} from '../../src/audio/musicPatterns';

/** Deterministically walk `n` chords of a mood. */
function walk(preset: MoodPreset, seed: number, n: number): Chord[] {
  const state = initProgression(seed);
  return Array.from({ length: n }, () => stepProgression(state, preset));
}

describe('pitch math', () => {
  it('midiToFreq hits the reference points', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1); // middle C
    expect(midiToFreq(81)).toBeCloseTo(880);
  });

  it('every triad on every degree stays in the C-major family', () => {
    for (let degree = 0; degree < 7; degree++) {
      for (const pc of triadPcs(degree)) {
        expect(SCALE as readonly number[], `degree ${degree}`).toContain(pc);
      }
    }
  });
});

describe('mood presets', () => {
  it('defines exactly the four moods', () => {
    expect(MOOD_NAMES.sort()).toEqual(['duel', 'gauntlet', 'menu', 'shop']);
  });

  it('keeps every preset well-formed and quiet', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      // Pool: ≥ 5 distinct degrees so the two-back exclusion always has options.
      const degrees = new Set(p.pool.map((c) => c.degree));
      expect(degrees.size, `${name} pool`).toBeGreaterThanOrEqual(5);
      expect(degrees.size).toBe(p.pool.length);
      expect(degrees.has(p.center), `${name} center in pool`).toBe(true);
      for (const c of p.pool) {
        expect(c.weight, `${name} weight`).toBeGreaterThan(0);
        expect(c.degree, `${name} degree`).toBeGreaterThanOrEqual(0);
        expect(c.degree, `${name} degree`).toBeLessThan(7);
        expect(c.degree, `${name} avoids the diminished vii°`).not.toBe(6);
      }
      // Ambient discipline: long attacks, longer releases, quiet peaks.
      expect(p.attack, `${name} attack`).toBeGreaterThanOrEqual(1);
      expect(p.release, `${name} release`).toBeGreaterThanOrEqual(2);
      expect(p.attack, `${name} attack < chord`).toBeLessThan(p.chordDur);
      expect(p.chordDur, `${name} chordDur`).toBeGreaterThan(0);
      for (const peak of [p.padPeak, p.bassPeak, p.pluckPeak]) {
        expect(peak, `${name} peak`).toBeGreaterThan(0);
        expect(peak, `${name} peak`).toBeLessThanOrEqual(0.12);
      }
      expect(p.level, `${name} level`).toBeGreaterThan(0);
      expect(p.level, `${name} level`).toBeLessThanOrEqual(1);
      expect(p.pluckDensity, `${name} density`).toBeGreaterThan(0);
      expect(p.pluckDensity, `${name} density`).toBeLessThanOrEqual(1);
      expect(p.pluckPulse, `${name} pulse`).toBeGreaterThan(0);
      // Registers: ordered, and audible / exponential-ramp safe at both ends.
      for (const [lo, hi] of [
        [p.voiceLow, p.voiceHigh],
        [p.bassLow, p.bassHigh],
        [p.pluckLow, p.pluckHigh],
      ]) {
        expect(hi - lo, `${name} range spans an octave+`).toBeGreaterThanOrEqual(12);
        expect(midiToFreq(lo), `${name} low freq`).toBeGreaterThan(20);
        expect(midiToFreq(hi), `${name} high freq`).toBeLessThan(12000);
      }
    }
  });

  it('gives duel a minor center and a faster harmonic rhythm than menu', () => {
    expect(MOODS.menu.center).toBe(0); // C major
    expect(MOODS.duel.center).toBe(5); // A minor
    expect(MOODS.duel.chordDur).toBeLessThan(MOODS.menu.chordDur);
    // Gauntlet is the slowest, darkest bed.
    expect(MOODS.gauntlet.cutoff).toBeLessThan(MOODS.menu.cutoff);
    expect(MOODS.gauntlet.chordDur).toBeGreaterThanOrEqual(MOODS.menu.chordDur);
  });
});

describe('progression walk', () => {
  it('is deterministic per seed and varies across seeds', () => {
    for (const name of MOOD_NAMES) {
      const a = walk(MOODS[name], 1234, 32).map((c) => c.degree);
      const b = walk(MOODS[name], 1234, 32).map((c) => c.degree);
      expect(a, name).toEqual(b);
      const c = walk(MOODS[name], 99, 32).map((c) => c.degree);
      expect(a, `${name} seeds diverge`).not.toEqual(c);
    }
  });

  it('opens on the mood center and only uses pool degrees', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      const degrees = walk(p, 7, 48).map((c) => c.degree);
      expect(degrees[0], name).toBe(p.center);
      const pool = new Set(p.pool.map((c) => c.degree));
      for (const d of degrees) expect(pool.has(d), `${name} degree ${d}`).toBe(true);
    }
  });

  it('never cycles with period 1 or 2 (the two-back exclusion)', () => {
    for (const name of MOOD_NAMES) {
      for (const seed of [1, 2, 3, 42]) {
        const d = walk(MOODS[name], seed, 64).map((c) => c.degree);
        for (let i = 1; i < d.length; i++) {
          expect(d[i], `${name}/${seed} @${i}`).not.toBe(d[i - 1]);
          if (i >= 2) expect(d[i], `${name}/${seed} @${i}`).not.toBe(d[i - 2]);
        }
      }
    }
  });

  it('does not settle into any short global loop (period ≤ 8 over 40 chords)', () => {
    // 40 chords ≈ 5+ minutes at menu pace — no audible repeat inside that.
    for (const name of MOOD_NAMES) {
      const d = walk(MOODS[name], 2026, 40).map((c) => c.degree);
      for (let period = 3; period <= 8; period++) {
        const repeats = d.slice(period).every((v, i) => v === d[i]);
        expect(repeats, `${name} period ${period}`).toBe(false);
      }
    }
  });
});

describe('voicing', () => {
  it('keeps every voice diatonic, in range, and exponential-ramp safe', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      for (const chord of walk(p, 11, 48)) {
        for (const midi of chord.voicing) {
          expect(isDiatonic(midi), `${name} midi ${midi}`).toBe(true);
          expect(midi).toBeGreaterThanOrEqual(p.voiceLow);
          expect(midi).toBeLessThanOrEqual(p.voiceHigh);
          expect(midiToFreq(midi)).toBeGreaterThan(20);
          expect(midiToFreq(midi)).toBeLessThan(12000);
        }
        expect(isDiatonic(chord.bass), `${name} bass ${chord.bass}`).toBe(true);
        expect(chord.bass).toBeGreaterThanOrEqual(p.bassLow);
        expect(chord.bass).toBeLessThanOrEqual(p.bassHigh);
        // The voicing realizes exactly the triad's pitch classes.
        const want = new Set(triadPcs(chord.degree));
        for (const midi of chord.voicing) expect(want.has(((midi % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it('caps voice-leading movement (≤ 6 semitones; ≤ 11 when the range clamps)', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      let prev: Chord | null = null;
      for (const chord of walk(p, 5, 64)) {
        if (prev) {
          for (let i = 0; i < 3; i++) {
            const move = Math.abs(chord.voicing[i] - prev.voicing[i]);
            expect(move, `${name} voice ${i}`).toBeLessThanOrEqual(11);
          }
          // Bass walks in small steps too (roots a fourth/fifth apart fold over).
          expect(Math.abs(chord.bass - prev.bass), `${name} bass`).toBeLessThanOrEqual(11);
        }
        prev = chord;
      }
    }
  });

  it('voiceChord picks the minimal-movement assignment for a known case', () => {
    // C major (C4 E4 G4) → A minor should keep C and E and only move G→A.
    const cMajor = voiceChord(0, null, MOODS.menu);
    const aMinor = voiceChord(5, cMajor, MOODS.menu);
    const moved = aMinor.filter((n, i) => n !== cMajor[i]);
    expect(moved).toHaveLength(1);
    const total = aMinor.reduce((s, n, i) => s + Math.abs(n - cMajor[i]), 0);
    expect(total).toBe(2); // G→A is a whole tone
  });
});

describe('plucks', () => {
  it('places sparse chord tones inside the chord window and register', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      const state = initProgression(31);
      for (let step = 0; step < 24; step++) {
        const chord = stepProgression(state, p);
        const want = new Set(triadPcs(chord.degree));
        for (const note of plucksForChord(chord, p, state.rng)) {
          expect(note.at, `${name} at`).toBeGreaterThan(0);
          expect(note.at, `${name} at`).toBeLessThan(p.chordDur);
          expect(note.midi).toBeGreaterThanOrEqual(p.pluckLow);
          expect(note.midi).toBeLessThanOrEqual(p.pluckHigh);
          expect(isDiatonic(note.midi), `${name} pluck ${note.midi}`).toBe(true);
          expect(want.has(((note.midi % 12) + 12) % 12), `${name} chord tone`).toBe(true);
        }
      }
    }
  });

  it('respects density: no mood machine-guns notes', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      const state = initProgression(8);
      let total = 0;
      let slots = 0;
      for (let step = 0; step < 40; step++) {
        const chord = stepProgression(state, p);
        total += plucksForChord(chord, p, state.rng).length;
        slots += Math.ceil((p.chordDur - 0.25 - p.pluckPulse) / p.pluckPulse);
      }
      expect(total / slots, `${name} observed density`).toBeLessThan(p.pluckDensity + 0.15);
    }
  });
});
