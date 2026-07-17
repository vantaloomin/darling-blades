/**
 * Pure SFX recipe data — no browser APIs, no Phaser, testable headless.
 *
 * A recipe is a handful of "voices" (oscillator tones or filtered noise
 * bursts) that AudioManager schedules on a shared AudioContext. Everything is
 * kept as plain numbers so the recipes can be linted by tests without a DOM.
 */

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

export interface ToneVoice {
  kind: 'tone';
  wave: Wave;
  /** start frequency in Hz */
  freq: number;
  /** exponential glide target; omit to hold the pitch */
  freqEnd?: number;
  /** seconds after the trigger before this voice starts */
  at?: number;
  /** linear attack, seconds */
  attack: number;
  /** exponential decay to silence, seconds */
  decay: number;
  /** peak linear gain, pre-master */
  peak: number;
}

export interface NoiseVoice {
  kind: 'noise';
  filter?: { type: FilterKind; freq: number; freqEnd?: number; q?: number };
  at?: number;
  attack: number;
  decay: number;
  peak: number;
}

export type Voice = ToneVoice | NoiseVoice;

export type SfxName =
  | 'click'
  | 'hover'
  | 'cast'
  | 'land'
  | 'attack'
  | 'hit'
  | 'death'
  | 'lifeLoss'
  | 'win'
  | 'loss'
  | 'coin'
  | 'flip'
  | 'shimmer'
  | 'yourTurn'
  | 'rungClear';

const tone = (
  wave: Wave,
  freq: number,
  peak: number,
  attack: number,
  decay: number,
  extra: Partial<ToneVoice> = {},
): ToneVoice => ({ kind: 'tone', wave, freq, peak, attack, decay, ...extra });

const noise = (
  peak: number,
  attack: number,
  decay: number,
  extra: Partial<NoiseVoice> = {},
): NoiseVoice => ({ kind: 'noise', peak, attack, decay, ...extra });

/**
 * The full SFX set. Tuning notes: this is a card game — everything is short
 * and quiet (peaks well under 0.4) so repeated triggers never fatigue. Pitches
 * lean on C-major/A-minor tones so back-to-back cues don't clash.
 */
export const SFX: Record<SfxName, Voice[]> = {
  // UI tick: a soft woody tap — tiny pitch drop keeps it from sounding like a beep.
  click: [
    tone('triangle', 1100, 0.16, 0.001, 0.055, { freqEnd: 750 }),
    noise(0.06, 0.001, 0.025, { filter: { type: 'bandpass', freq: 2600, q: 1.2 } }),
  ],
  // Hover: the click's little sibling — shorter, higher, much quieter.
  hover: [tone('sine', 1500, 0.05, 0.001, 0.03)],

  // Spell cast: airy upward whoosh with a small arcane chime on top.
  cast: [
    noise(0.1, 0.05, 0.24, { filter: { type: 'bandpass', freq: 500, freqEnd: 2400, q: 1.5 } }),
    tone('sine', 523.25, 0.09, 0.02, 0.3, { freqEnd: 1046.5, at: 0.05 }),
    tone('sine', 1568, 0.04, 0.01, 0.22, { at: 0.14 }),
  ],
  // Land drop: an earthy thud — sine drop into the sub range plus a dirt tap.
  land: [
    tone('sine', 150, 0.32, 0.002, 0.18, { freqEnd: 52 }),
    noise(0.12, 0.002, 0.09, { filter: { type: 'lowpass', freq: 420 } }),
  ],
  // Attack declaration: restrained war-horn — detuned saws an octave apart
  // swelling up a whole tone; low peaks because raw saws carry a lot of energy.
  attack: [
    tone('sawtooth', 196, 0.07, 0.06, 0.3, { freqEnd: 220 }),
    tone('sawtooth', 98, 0.08, 0.06, 0.3, { freqEnd: 110 }),
    noise(0.04, 0.05, 0.22, { filter: { type: 'bandpass', freq: 900, q: 0.8 } }),
  ],
  // Combat damage: a blunt impact — low noise knock plus a fast pitch drop.
  hit: [
    noise(0.26, 0.001, 0.11, { filter: { type: 'lowpass', freq: 900, freqEnd: 260 } }),
    tone('sine', 210, 0.28, 0.001, 0.14, { freqEnd: 65 }),
  ],
  // Creature death: a falling minor third with a soft breath underneath.
  death: [
    tone('triangle', 392, 0.14, 0.01, 0.42, { freqEnd: 196 }),
    tone('triangle', 311.1, 0.07, 0.01, 0.38, { freqEnd: 155.6, at: 0.03 }),
    noise(0.05, 0.02, 0.28, { filter: { type: 'lowpass', freq: 700 } }),
  ],
  // Life loss: a dull pang — quick low drop with a faint metallic edge.
  lifeLoss: [
    tone('sine', 233.1, 0.2, 0.002, 0.2, { freqEnd: 110 }),
    tone('triangle', 466.2, 0.06, 0.002, 0.09),
  ],

  // Win fanfare: rising C-major arpeggio landing on a held C6 chord.
  win: [
    tone('triangle', 523.25, 0.11, 0.01, 0.28),
    tone('triangle', 659.25, 0.11, 0.01, 0.28, { at: 0.13 }),
    tone('triangle', 783.99, 0.11, 0.01, 0.3, { at: 0.26 }),
    tone('triangle', 1046.5, 0.14, 0.01, 0.9, { at: 0.4 }),
    tone('sine', 659.25, 0.06, 0.02, 0.85, { at: 0.4 }),
    tone('sine', 783.99, 0.06, 0.02, 0.85, { at: 0.4 }),
    noise(0.04, 0.05, 0.6, { filter: { type: 'highpass', freq: 5000 }, at: 0.4 }),
  ],
  // Loss sting: two falling tones into a tritone shadow — somber, not punishing.
  loss: [
    tone('triangle', 311.1, 0.12, 0.02, 0.5, { freqEnd: 293.7 }),
    tone('triangle', 220, 0.12, 0.02, 0.7, { at: 0.3 }),
    tone('sine', 110, 0.09, 0.04, 0.8, { at: 0.3 }),
  ],

  // Coin clink: two bright metallic partials, the second bouncing in late.
  coin: [
    tone('triangle', 2093, 0.12, 0.001, 0.12),
    tone('triangle', 2637, 0.1, 0.001, 0.18, { at: 0.07 }),
    tone('sine', 3951, 0.04, 0.001, 0.1, { at: 0.07 }),
  ],
  // Card flip: a cardstock flick — filtered noise snap with a tiny pitch blip.
  flip: [
    noise(0.11, 0.005, 0.07, { filter: { type: 'bandpass', freq: 1800, freqEnd: 3400, q: 1 } }),
    tone('triangle', 900, 0.04, 0.003, 0.05, { freqEnd: 1400 }),
  ],
  // Rare/holo shimmer: rising sparkle arpeggio over a high airy wash.
  shimmer: [
    tone('sine', 1318.5, 0.06, 0.01, 0.5),
    tone('sine', 1568, 0.06, 0.01, 0.5, { at: 0.09 }),
    tone('sine', 1975.5, 0.06, 0.01, 0.55, { at: 0.18 }),
    tone('sine', 2349.3, 0.07, 0.01, 0.65, { at: 0.27 }),
    noise(0.045, 0.15, 0.7, { filter: { type: 'highpass', freq: 5500 } }),
    tone('sine', 523.25, 0.035, 0.1, 0.8),
  ],
  // Your turn: a gentle two-step handoff chime with a faint high bloom.
  yourTurn: [
    tone('sine', 659.25, 0.07, 0.015, 0.28),
    tone('triangle', 783.99, 0.08, 0.015, 0.34, { at: 0.1 }),
    tone('sine', 1046.5, 0.04, 0.02, 0.4, { at: 0.22 }),
  ],
  // Gauntlet rung clear: a short two-note "level up" — G5 stepping to C6.
  rungClear: [
    tone('triangle', 783.99, 0.11, 0.01, 0.25),
    tone('triangle', 1046.5, 0.13, 0.01, 0.5, { at: 0.12 }),
    tone('sine', 523.25, 0.06, 0.02, 0.5, { at: 0.12 }),
    noise(0.035, 0.05, 0.4, { filter: { type: 'highpass', freq: 4000 }, at: 0.12 }),
  ],
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

/** When a voice falls silent, in seconds from the trigger. */
export function voiceEnd(v: Voice): number {
  return (v.at ?? 0) + v.attack + v.decay;
}

/** Total recipe length in seconds (the latest voice end). */
export function recipeDuration(voices: readonly Voice[]): number {
  return voices.reduce((max, v) => Math.max(max, voiceEnd(v)), 0);
}
