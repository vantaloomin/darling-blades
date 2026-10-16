import { DEFAULT_SOUND_STYLE, type SoundStyle } from '../meta/soundStyle';
import { SFX, SFX_NAMES, type SfxName, type Voice } from './recipes';
import { pickSoundFormat, SAMPLE_SFX_LEVEL, sfxStem, TEXTURE_CUES, type SoundFormat, type TextureCue } from './soundSet';

/** Where the master volume is read from / persisted to (the SaveManager in prod). */
export interface VolumeStore {
  get(): number;
  set(v: number): void;
}

/**
 * Identical SFX triggered inside this window collapse to one play — event
 * batches (three creatures dying at once) should thump once, not clip.
 */
const RETRIGGER_MS = 45;

export interface SfxPlayOptions {
  /** Playback pitch multiplier. Kept bounded so procedural voices stay usable. */
  pitch?: number;
}

export function normalizeSfxPitch(pitch: number | undefined): number {
  if (pitch === undefined || !Number.isFinite(pitch)) return 1;
  return Math.min(2, Math.max(0.5, pitch));
}

/**
 * Procedural WebAudio SFX player. No assets: every sound is a recipe of
 * oscillator/noise voices from recipes.ts, scheduled on one AudioContext.
 *
 * Autoplay policy: the context is only created inside the first user gesture
 * (pointerdown/keydown), so the browser never logs an autoplay warning and
 * `play()` silently no-ops until then. In headless/test environments with no
 * AudioContext at all, everything no-ops.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private readonly supported: boolean;
  private lastPlayedAt = new Map<SfxName, number>();
  private textureLastAt = new Map<string, number>();
  private muted = false;

  /** Count of SFX actually scheduled — a cheap hook for dev-tool verification. */
  playCount = 0;
  lastPlayed: SfxName | null = null;
  /** Count of lifecycle resume attempts — a cheap hook for dev-tool verification. */
  resumeAttempts = 0;

  private unlockArmed = false;

  /** Decoded "New" style samples by stem (`sfx/click`, `music/duel`); see soundSet.ts. */
  private readonly samples = new Map<string, AudioBuffer>();
  /** Stems being fetched, and stems that failed once (never retried this session). */
  private readonly loading = new Set<string>();
  private readonly failed = new Set<string>();
  private format: SoundFormat | null = null;
  /** Count of sample voices actually started — a dev-tool hook like playCount. */
  samplePlayCount = 0;

  /**
   * `sfxEnabled` is the persisted SFX on/off preference
   * (SaveData.settings.sfxOn), injected as a pure getter so this module stays
   * headless-testable. It gates `play()` only — the master gain is untouched,
   * so music (which routes through the same bus) keeps sounding, and the
   * session-only `toggleMute()` semantics are unchanged and independent.
   */
  constructor(
    private readonly store: VolumeStore,
    private readonly sfxEnabled: () => boolean = () => true,
    /** The persisted sound style (SaveData.settings.soundStyle): Classic recipes or New samples. */
    readonly soundStyle: () => SoundStyle = () => DEFAULT_SOUND_STYLE,
  ) {
    this.supported =
      typeof window !== 'undefined' && typeof globalThis.AudioContext !== 'undefined';
    if (!this.supported) return;
    this.armUnlock();
    // iOS Safari parks the context in the non-standard 'interrupted' state on
    // screen lock / app switch / calls and never resumes it by itself — retry
    // on every return-to-foreground signal (mobile-lan-plan §1.5). Harmless
    // no-ops everywhere else (tryResume exits while the context is running).
    window.addEventListener('pageshow', () => this.tryResume());
    window.addEventListener('focus', () => this.tryResume());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.tryResume();
      });
    }
  }

  /**
   * Arm the one-shot gesture unlock (capture phase: the context exists before
   * Phaser's own pointer handlers run, so the very first click's SFX already
   * plays). Re-armed by tryResume() when a resume is refused — iOS sometimes
   * requires a fresh user gesture after an interruption.
   */
  private armUnlock(): void {
    if (this.unlockArmed) return;
    this.unlockArmed = true;
    const unlock = (): void => {
      this.ensureContext();
      if (this.ctx?.state === 'running') {
        this.unlockArmed = false;
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  /**
   * Attempt to bring a non-running ('suspended' or iOS 'interrupted') context
   * back; if the browser refuses, fall back to waiting for a user gesture.
   */
  private tryResume(): void {
    if (!this.ctx || (this.ctx.state as string) === 'running') return;
    this.resumeAttempts++;
    void this.ctx.resume().then(
      () => {
        if ((this.ctx?.state as string) !== 'running') this.armUnlock();
      },
      () => this.armUnlock(),
    );
  }

  get volume(): number {
    return this.store.get();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** True once the context is unlocked — SFX will actually sound. */
  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  /**
   * Shared context + master bus for the music layer (music routes through the
   * same master gain so volume/mute apply to everything). Null until the
   * gesture unlock, and always null in headless environments.
   */
  get bus(): { ctx: AudioContext; master: GainNode } | null {
    return this.ctx && this.master && this.ctx.state === 'running'
      ? { ctx: this.ctx, master: this.master }
      : null;
  }

  /** Clamp to [0, 1], persist via the store, and ramp the master gain. */
  setVolume(v: number): void {
    const vol = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
    this.store.set(vol);
    if (vol > 0) this.muted = false;
    this.applyGain();
  }

  /** Session-only mute: zeroes the master gain without touching the saved volume. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyGain();
    return this.muted;
  }

  play(name: SfxName, options: SfxPlayOptions = {}): void {
    if (!this.ctx || !this.master) return;
    if (this.ctx.state !== 'running') {
      // Self-heal: an iOS interruption that ends while the page stays visible
      // and focused (call answered from the banner, Siri) fires NO lifecycle
      // event — without this, audio stays silent until an app switch. The
      // resume is async, so this play is dropped; the next one sounds. Run
      // this BEFORE the SFX-toggle gate: the context is shared with the music
      // layer, so with SFX off but music on, this is the only non-lifecycle
      // path that revives the interrupted context (game events still call
      // play(), the gate below just suppresses the voice).
      this.tryResume();
      return;
    }
    if (!this.sfxEnabled()) return; // persisted SFX toggle (settings.sfxOn) — context is healthy
    const now = Date.now();
    if (now - (this.lastPlayedAt.get(name) ?? -Infinity) < RETRIGGER_MS) return;
    this.lastPlayedAt.set(name, now);
    this.playCount++;
    this.lastPlayed = name;
    const t0 = this.ctx.currentTime + 0.005;
    const pitch = normalizeSfxPitch(options.pitch);
    // New style: the recorded sample once it has loaded; until then (or if it
    // failed to load) the Classic recipe still sounds, so nothing goes quiet.
    const buf = this.soundStyle() === 'new' ? this.sample(sfxStem(name)) : null;
    if (buf) {
      this.spawnSample(buf, t0, pitch);
      return;
    }
    for (const v of SFX[name]) this.spawnVoice(v, t0, pitch);
  }

  /**
   * A card-handling moment only the New style voices (shuffle, draw, pack
   * tear). Silent under Classic, which has no recipe for these, and silent
   * until the sample has loaded. Same gates and retrigger window as play().
   */
  playTexture(cue: TextureCue): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return;
    if (!this.sfxEnabled() || this.soundStyle() !== 'new') return;
    const buf = this.sample(sfxStem(cue));
    if (!buf) return;
    const key = `texture:${cue}`;
    const now = Date.now();
    if (now - (this.textureLastAt.get(key) ?? -Infinity) < RETRIGGER_MS) return;
    this.textureLastAt.set(key, now);
    this.spawnSample(buf, this.ctx.currentTime + 0.005, 1);
  }

  /**
   * The decoded sample for a stem, or null while it loads (the call starts the
   * load) or after it failed. Shared with the music layer for its loops.
   */
  sample(stem: string): AudioBuffer | null {
    const buf = this.samples.get(stem);
    if (buf) return buf;
    this.loadSample(stem);
    return null;
  }

  /**
   * Start fetching every New-style sound effect, so the first press of each
   * button already has its sample. Called on unlock and when the setting
   * flips to New; music loops load on demand, one mood at a time.
   */
  preloadSamples(): void {
    if (this.soundStyle() !== 'new') return;
    for (const name of SFX_NAMES) this.loadSample(sfxStem(name));
    for (const cue of TEXTURE_CUES) this.loadSample(sfxStem(cue));
  }

  // -----------------------------------------------------------------------

  private ensureContext(): void {
    if (!this.supported) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.store.get();
      this.master.connect(this.ctx.destination);
      // One second of white noise, generated once and looped by every noise voice.
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.preloadSamples();
    }
    // Resume from any non-running state — iOS reports the non-standard
    // 'interrupted' (not in the TS union), which the old 'suspended'-only
    // check missed, leaving the session permanently silent.
    if ((this.ctx.state as string) !== 'running') void this.ctx.resume().catch(() => {});
  }

  private applyGain(): void {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.store.get();
    // Short ramp instead of a jump: avoids a click if anything is mid-decay.
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
  }

  private loadSample(stem: string): void {
    const ctx = this.ctx;
    if (!ctx || this.samples.has(stem) || this.loading.has(stem) || this.failed.has(stem)) return;
    if (typeof globalThis.fetch !== 'function') return;
    this.format ??= pickSoundFormat((mime) =>
      typeof document !== 'undefined' && typeof document.createElement === 'function'
        ? document.createElement('audio').canPlayType(mime)
        : '');
    this.loading.add(stem);
    void globalThis
      .fetch(`assets/audio/${stem}.${this.format}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then(
        (buf) => this.samples.set(stem, buf),
        () => this.failed.add(stem),
      )
      .finally(() => this.loading.delete(stem));
  }

  private spawnSample(buf: AudioBuffer, t0: number, pitch: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const gain = ctx.createGain();
    gain.gain.value = SAMPLE_SFX_LEVEL;
    src.connect(gain);
    gain.connect(this.master!);
    src.onended = () => gain.disconnect();
    src.start(t0);
    this.samplePlayCount++;
  }

  private spawnVoice(v: Voice, t0: number, pitch: number): void {
    const ctx = this.ctx!;
    const start = t0 + (v.at ?? 0);
    const end = start + v.attack + v.decay;

    // Linear attack, exponential decay — reads as natural for plucked/percussive
    // sounds (a linear decay sounds like an organ cut off mid-note).
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(v.peak, start + v.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(this.master!);

    let src: AudioScheduledSourceNode;
    if (v.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.freq * pitch, start);
      if (v.freqEnd !== undefined)
        osc.frequency.exponentialRampToValueAtTime(v.freqEnd * pitch, end);
      osc.connect(env);
      src = osc;
    } else {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuf;
      noise.loop = true;
      let out: AudioNode = noise;
      if (v.filter) {
        const biq = ctx.createBiquadFilter();
        biq.type = v.filter.type;
        biq.frequency.setValueAtTime(v.filter.freq * pitch, start);
        if (v.filter.freqEnd !== undefined)
          biq.frequency.exponentialRampToValueAtTime(v.filter.freqEnd * pitch, end);
        if (v.filter.q !== undefined) biq.Q.value = v.filter.q;
        out.connect(biq);
        out = biq;
      }
      out.connect(env);
      src = noise;
    }
    src.start(start);
    src.stop(end + 0.02);
    src.onended = () => env.disconnect();
  }
}
