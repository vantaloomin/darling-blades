/**
 * Pure generative-music pattern data — no browser APIs, no Phaser, testable
 * headless (the same discipline as recipes.ts).
 *
 * One system, mood-parameterized: a slow chord pad walks a seeded diatonic
 * progression while a sparse pluck voice picks chord tones above it. Every
 * pitch stays inside the C-major/A-minor family so the ambient bed never
 * clashes with the SFX set (recipes.ts leans on the same tones).
 *
 * Anti-loop guarantee: the chord walk is a weighted random choice that always
 * excludes the previous TWO degrees, so period-1 and period-2 cycles are
 * impossible and the progression doesn't audibly repeat for minutes.
 */

import type { Wave } from './recipes';

export type MoodName = 'menu' | 'duel' | 'gauntlet' | 'shop';

/** C-major scale as semitone offsets from C (pitch classes 0..11). */
export const SCALE = [0, 2, 4, 5, 7, 9, 11] as const;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function isDiatonic(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return (SCALE as readonly number[]).includes(pc);
}

/** Diatonic triad on a scale degree (stacked thirds), as pitch classes. */
export function triadPcs(degree: number): [number, number, number] {
  return [SCALE[degree % 7], SCALE[(degree + 2) % 7], SCALE[(degree + 4) % 7]];
}

export interface MoodPreset {
  name: MoodName;
  /** Scale degree the walk opens on (0 = C major, 5 = A minor, 1 = D dorian). */
  center: number;
  /** Weighted chord pool — ≥ 5 distinct degrees so the two-back exclusion always has options. */
  pool: { degree: number; weight: number }[];
  /** Seconds per chord — the harmonic rhythm. */
  chordDur: number;
  /** Pad envelope: long linear attack, exponential release (both seconds). */
  attack: number;
  release: number;
  /** Gentle lowpass over the whole pad, Hz. */
  cutoff: number;
  /** ± detune between the paired pad oscillators, cents. */
  detuneCents: number;
  padWave: Wave;
  /** Per-voice peak gains, pre-music-bus. Quiet by design. */
  padPeak: number;
  bassPeak: number;
  pluckPeak: number;
  /** MIDI registers. */
  voiceLow: number;
  voiceHigh: number;
  bassLow: number;
  bassHigh: number;
  pluckLow: number;
  pluckHigh: number;
  /** Pluck slot spacing (seconds) and per-slot trigger probability. */
  pluckPulse: number;
  pluckDensity: number;
  /** Mood gain scaler applied per chord, 0..1. */
  level: number;
}

/**
 * The four mood presets. Degrees are C-major scale degrees:
 * 0=C 1=Dm 2=Em 3=F 4=G 5=Am (6=B° is avoided — its tritone reads harsh
 * against the SFX set). Minor moods just re-center the same pitch family.
 */
export const MOODS: Record<MoodName, MoodPreset> = {
  // Calm, major-leaning: home base on C with plagal IV/vi drift.
  menu: {
    name: 'menu',
    center: 0,
    pool: [
      { degree: 0, weight: 3 },
      { degree: 3, weight: 3 },
      { degree: 5, weight: 2 },
      { degree: 4, weight: 2 },
      { degree: 1, weight: 1 },
      { degree: 2, weight: 1 },
    ],
    chordDur: 8,
    attack: 2.8,
    release: 3.5,
    cutoff: 900,
    detuneCents: 5,
    padWave: 'triangle',
    padPeak: 0.075,
    bassPeak: 0.07,
    pluckPeak: 0.05,
    voiceLow: 55,
    voiceHigh: 79,
    bassLow: 36,
    bassHigh: 50,
    pluckLow: 74,
    pluckHigh: 90,
    pluckPulse: 1.1,
    pluckDensity: 0.3,
    level: 1,
  },
  // Tense, minor-leaning, faster harmonic rhythm: centered on A minor,
  // darker register, saw pad under a lowpass for a slow-burn edge.
  duel: {
    name: 'duel',
    center: 5,
    pool: [
      { degree: 5, weight: 4 },
      { degree: 2, weight: 3 },
      { degree: 1, weight: 2 },
      { degree: 3, weight: 2 },
      { degree: 4, weight: 2 },
      { degree: 0, weight: 1 },
    ],
    chordDur: 5,
    attack: 1.8,
    release: 2.5,
    cutoff: 1100,
    detuneCents: 9,
    padWave: 'sawtooth',
    padPeak: 0.045,
    bassPeak: 0.055,
    pluckPeak: 0.045,
    voiceLow: 53,
    voiceHigh: 76,
    bassLow: 33,
    bassHigh: 47,
    pluckLow: 69,
    pluckHigh: 86,
    pluckPulse: 0.62,
    pluckDensity: 0.42,
    level: 0.95,
  },
  // Mysterious: D-dorian center (still the C family), long dark chords,
  // very sparse plucks in a lower register.
  gauntlet: {
    name: 'gauntlet',
    center: 1,
    pool: [
      { degree: 1, weight: 4 },
      { degree: 5, weight: 3 },
      { degree: 2, weight: 3 },
      { degree: 3, weight: 1 },
      { degree: 4, weight: 1 },
      { degree: 0, weight: 1 },
    ],
    chordDur: 9,
    attack: 3.2,
    release: 4,
    cutoff: 620,
    detuneCents: 6,
    padWave: 'triangle',
    padPeak: 0.08,
    bassPeak: 0.075,
    pluckPeak: 0.045,
    voiceLow: 50,
    voiceHigh: 74,
    bassLow: 33,
    bassHigh: 47,
    pluckLow: 67,
    pluckHigh: 84,
    pluckPulse: 1.4,
    pluckDensity: 0.2,
    level: 0.9,
  },
  // Light (shop / collection / deck builder / pack opening): bright I–V–IV
  // drift, higher plucks, a touch denser — pleasant browsing music.
  shop: {
    name: 'shop',
    center: 0,
    pool: [
      { degree: 0, weight: 3 },
      { degree: 4, weight: 3 },
      { degree: 3, weight: 2 },
      { degree: 1, weight: 2 },
      { degree: 5, weight: 1 },
      { degree: 2, weight: 1 },
    ],
    chordDur: 6.5,
    attack: 2.2,
    release: 3,
    cutoff: 1300,
    detuneCents: 4,
    padWave: 'triangle',
    padPeak: 0.06,
    bassPeak: 0.055,
    pluckPeak: 0.05,
    voiceLow: 57,
    voiceHigh: 81,
    bassLow: 38,
    bassHigh: 52,
    pluckLow: 76,
    pluckHigh: 91,
    pluckPulse: 0.8,
    pluckDensity: 0.45,
    level: 0.85,
  },
};

export const MOOD_NAMES = Object.keys(MOODS) as MoodName[];

/** Tiny deterministic PRNG (mulberry32) — the progression is seed-driven. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nearest MIDI note of pitch class `pc` to `from` (≤ 6 semitones away; ties go up). */
function nearestPc(from: number, pc: number): number {
  const up = from + ((((pc - from) % 12) + 12) % 12);
  const down = up - 12;
  return up - from <= from - down ? up : down;
}

/** Shift by octaves until the note sits inside [low, high]. */
function clampToRange(midi: number, low: number, high: number): number {
  let m = midi;
  while (m > high) m -= 12;
  while (m < low) m += 12;
  return m;
}

export interface Chord {
  degree: number;
  /** Three upper pad voices, MIDI. */
  voicing: number[];
  /** Bass root, MIDI. */
  bass: number;
}

export interface ProgressionState {
  /** Last two degrees emitted, newest first — the anti-cycling memory. */
  history: number[];
  voicing: number[] | null;
  bass: number | null;
  rng: () => number;
}

export function initProgression(seed: number): ProgressionState {
  return { history: [], voicing: null, bass: null, rng: makeRng(seed) };
}

function pickDegree(state: ProgressionState, preset: MoodPreset): number {
  const options = preset.pool.filter((c) => !state.history.includes(c.degree));
  const total = options.reduce((s, c) => s + c.weight, 0);
  let roll = state.rng() * total;
  for (const c of options) {
    roll -= c.weight;
    if (roll <= 0) return c.degree;
  }
  return options[options.length - 1].degree;
}

/**
 * Voice a triad against the previous voicing with classic nearest-neighbor
 * voice leading: every assignment of the three chord tones to the three
 * voices is costed by total semitone movement and the cheapest wins. Each
 * voice therefore moves ≤ 6 semitones (≤ 11 when a range clamp forces an
 * octave flip) — no leaping pads.
 */
export function voiceChord(degree: number, prev: number[] | null, preset: MoodPreset): number[] {
  const pcs = triadPcs(degree);
  if (!prev) {
    // Opening chord: root position around the middle of the register.
    const mid = Math.round((preset.voiceLow + preset.voiceHigh) / 2);
    const root = clampToRange(nearestPc(mid - 4, pcs[0]), preset.voiceLow, preset.voiceHigh);
    const third = clampToRange(root + ((pcs[1] - pcs[0] + 12) % 12), preset.voiceLow, preset.voiceHigh);
    const fifth = clampToRange(root + ((pcs[2] - pcs[0] + 12) % 12), preset.voiceLow, preset.voiceHigh);
    return [root, third, fifth];
  }
  const perms: [number, number, number][] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  let best: number[] = prev;
  let bestCost = Infinity;
  for (const perm of perms) {
    const cand = prev.map((v, i) =>
      clampToRange(nearestPc(v, pcs[perm[i]]), preset.voiceLow, preset.voiceHigh),
    );
    const cost = cand.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = cand;
    }
  }
  return best;
}

/** Advance the walk one chord: pick a degree the last two chords didn't use, voice it smoothly. */
export function stepProgression(state: ProgressionState, preset: MoodPreset): Chord {
  const degree = state.history.length === 0 ? preset.center : pickDegree(state, preset);
  const voicing = voiceChord(degree, state.voicing, preset);
  const anchor = state.bass ?? Math.round((preset.bassLow + preset.bassHigh) / 2);
  const bass = clampToRange(nearestPc(anchor, triadPcs(degree)[0]), preset.bassLow, preset.bassHigh);
  state.history = [degree, ...state.history].slice(0, 2);
  state.voicing = voicing;
  state.bass = bass;
  return { degree, voicing, bass };
}

export interface PluckNote {
  /** Seconds after the chord starts. */
  at: number;
  midi: number;
}

/** Sparse chord-tone plucks over one chord: slot grid × trigger probability. */
export function plucksForChord(
  chord: Chord,
  preset: MoodPreset,
  rng: () => number,
): PluckNote[] {
  const pcs = triadPcs(chord.degree);
  const tones: number[] = [];
  for (let m = preset.pluckLow; m <= preset.pluckHigh; m++) {
    if (pcs.includes(((m % 12) + 12) % 12)) tones.push(m);
  }
  const out: PluckNote[] = [];
  for (let at = preset.pluckPulse; at < preset.chordDur - 0.25; at += preset.pluckPulse) {
    if (rng() < preset.pluckDensity) {
      out.push({ at, midi: tones[Math.floor(rng() * tones.length)] });
    }
  }
  return out;
}
