import { Services } from '../meta/services';
import type { AudioManager } from './AudioManager';
import {
  initProgression,
  midiToFreq,
  MOODS,
  plucksForChord,
  stepProgression,
  type Chord,
  type MoodName,
  type MoodPreset,
  type ProgressionState,
} from './musicPatterns';
import { Sfx } from './sfx';

/** Where the music on/off preference is read from / persisted to (SaveManager in prod). */
export interface MusicPrefStore {
  get(): boolean;
  set(on: boolean): void;
}

/** Music sub-gain under the SFX master — subtle by design (≈0.3 of master). */
const MUSIC_LEVEL = 0.3;
/**
 * Scheduler tick + lookahead. Chords are queued ~3 s ahead so a background
 * tab's 1 Hz timer throttling never starves the audio thread's queue.
 */
const TICK_MS = 300;
const LOOKAHEAD_S = 2.8;
/** Time constant when a mood swap releases the old chords early. */
const SWAP_FADE_S = 0.7;

/**
 * Generative ambient music director. One engine, mood-parameterized: a slow
 * detuned-oscillator pad walking a seeded diatonic progression (musicPatterns)
 * plus sparse chord-tone plucks, all scheduled on the SAME AudioContext and
 * master gain as the SFX — so master volume, mute, the gesture unlock, and
 * headless no-op behavior come for free.
 *
 * Scene-independent: scenes only call setMood() from create(). setMood is a
 * no-op when the mood is unchanged, so DuelScene restarts between gauntlet
 * rungs never stack oscillators.
 */
export class MusicDirector {
  private mood: MoodName | null = null;
  private state: ProgressionState | null = null;
  private stateMood: MoodName | null = null;
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** AudioContext time of the next chord boundary. */
  private nextChordAt = 0;
  /** Chords currently scheduled/sounding — `fade` is automation-free so swaps ramp it cleanly. */
  private activeChords: { fade: GainNode; until: number }[] = [];

  /** Debug counters (mirrors Sfx.playCount): live source nodes / chords scheduled. */
  activeSources = 0;
  chordCount = 0;

  constructor(
    private readonly pref: MusicPrefStore,
    private readonly audio: AudioManager,
  ) {}

  get enabled(): boolean {
    return this.pref.get();
  }

  get currentMood(): MoodName | null {
    return this.mood;
  }

  /** Current music bus gain (runtime verification hook); null before unlock. */
  get busGain(): number | null {
    return this.bus ? this.bus.gain.value : null;
  }

  /**
   * Crossfade to a mood. The sounding chords get an early release while the
   * new mood's first chord (long attack) swells in — a musical crossfade with
   * no hard cut. Same-mood calls no-op (gauntlet rung-to-rung restarts).
   */
  setMood(mood: MoodName): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.releaseActive();
    const bus = this.audio.bus;
    if (bus) this.nextChordAt = Math.min(this.nextChordAt, bus.ctx.currentTime + 0.5);
    this.ensureTimer();
    this.tick();
  }

  /** Halt scheduling and let the sounding chords fade out. */
  stop(): void {
    this.mood = null;
    this.releaseActive();
  }

  /** Persisted music toggle; ramps the sub-gain so flips never click. */
  setEnabled(on: boolean): void {
    this.pref.set(on);
    const bus = this.audio.bus;
    if (this.bus && bus) {
      const t = bus.ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, t, 0.08);
    }
    if (on) this.tick(); // resume promptly rather than on the next timer tick
  }

  /** Briefly dip the music under a sting (win/loss fanfares), then recover. */
  duck(holdSec = 1.6): void {
    const bus = this.audio.bus;
    if (!bus || !this.bus || !this.enabled) return;
    const t = bus.ctx.currentTime;
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(MUSIC_LEVEL * 0.2, t, 0.04);
    g.setTargetAtTime(MUSIC_LEVEL, t + holdSec, 0.5);
  }

  // -----------------------------------------------------------------------

  private ensureTimer(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Early-release everything sounding (mood swap / stop). Pruning disconnects later. */
  private releaseActive(): void {
    const bus = this.audio.bus;
    if (!bus) {
      this.activeChords = [];
      return;
    }
    const t = bus.ctx.currentTime;
    for (const c of this.activeChords) c.fade.gain.setTargetAtTime(0.0001, t, SWAP_FADE_S);
  }

  private tick(): void {
    const bus = this.audio.bus;
    if (!bus) return; // context not unlocked yet (or headless) — try next tick
    const { ctx, master } = bus;
    const now = ctx.currentTime;
    // Prune finished chords and free their little node chains.
    this.activeChords = this.activeChords.filter((c) => {
      if (c.until > now) return true;
      c.fade.disconnect();
      return false;
    });
    if (!this.mood || !this.enabled) return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = this.enabled ? MUSIC_LEVEL : 0;
      this.bus.connect(master);
    }
    const preset = MOODS[this.mood];
    if (!this.state || this.stateMood !== this.mood) {
      this.state = initProgression((Math.random() * 2 ** 31) | 0);
      this.stateMood = this.mood;
    }
    // If scheduling fell behind (fresh start, re-enable, long throttle), jump forward.
    if (this.nextChordAt < now + 0.05) this.nextChordAt = now + 0.05;
    while (this.nextChordAt < now + LOOKAHEAD_S) {
      const chord = stepProgression(this.state, preset);
      this.scheduleChord(ctx, chord, preset, this.nextChordAt);
      this.nextChordAt += preset.chordDur;
    }
  }

  private scheduleChord(ctx: AudioContext, chord: Chord, preset: MoodPreset, t: number): void {
    const end = t + preset.chordDur + preset.release;

    // Per-chord chain: oscillators → lowpass → envelope → fade → music bus.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.cutoff;
    filter.Q.value = 0.4;
    // Long linear attack, hold, then exponential release into the next chord.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + preset.attack);
    env.gain.setValueAtTime(1, t + preset.chordDur);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    const fade = ctx.createGain();
    fade.gain.value = preset.level;
    filter.connect(env);
    env.connect(fade);
    fade.connect(this.bus!);

    // Pad: two gently detuned oscillators per voice plus a single sine bass.
    for (const midi of chord.voicing) {
      const f = midiToFreq(midi);
      this.spawnOsc(ctx, preset.padWave, f, +preset.detuneCents, preset.padPeak / 2, filter, t, end);
      this.spawnOsc(ctx, preset.padWave, f, -preset.detuneCents, preset.padPeak / 2, filter, t, end);
    }
    this.spawnOsc(ctx, 'sine', midiToFreq(chord.bass), 0, preset.bassPeak, filter, t, end);

    // Sparse plucks ride the same fade node, so mood swaps silence them too
    // (bypassing the lowpass keeps their transient bright).
    for (const p of plucksForChord(chord, preset, this.state!.rng)) {
      this.spawnPluck(ctx, midiToFreq(p.midi), preset.pluckPeak, fade, t + p.at);
    }

    this.activeChords.push({ fade, until: end + 0.2 });
    this.chordCount++;
  }

  private spawnOsc(
    ctx: AudioContext,
    wave: OscillatorType,
    freq: number,
    detuneCents: number,
    peak: number,
    into: AudioNode,
    t: number,
    stopAt: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    osc.detune.value = detuneCents;
    const g = ctx.createGain();
    g.gain.value = peak;
    osc.connect(g);
    g.connect(into);
    osc.start(t);
    osc.stop(stopAt + 0.05);
    this.activeSources++;
    osc.onended = () => {
      this.activeSources--;
      g.disconnect();
    };
  }

  private spawnPluck(ctx: AudioContext, freq: number, peak: number, into: AudioNode, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(env);
    env.connect(into);
    osc.start(t);
    osc.stop(t + 0.95);
    this.activeSources++;
    osc.onended = () => {
      this.activeSources--;
      env.disconnect();
    };
  }
}

/**
 * UI-layer music singleton, mirroring Sfx: scenes import { Music } directly.
 * The on/off preference reads/writes through the SaveManager so it persists.
 */
export const Music = new MusicDirector(
  {
    get: () => Services.save.data.settings.musicOn,
    set: (on) => {
      Services.save.data.settings.musicOn = on;
      Services.save.touch();
    },
  },
  Sfx,
);

// Dev-tool access (mood, source counts, bus gain) — mirrors window.__sfx.
declare global {
  interface Window {
    __music: MusicDirector;
  }
}
if (typeof window !== 'undefined') window.__music = Music;
