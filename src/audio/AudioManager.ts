import { SFX, type SfxName, type Voice } from './recipes';

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
  private muted = false;

  /** Count of SFX actually scheduled — a cheap hook for dev-tool verification. */
  playCount = 0;
  lastPlayed: SfxName | null = null;
  /** Count of lifecycle resume attempts — a cheap hook for dev-tool verification. */
  resumeAttempts = 0;

  private unlockArmed = false;

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

  play(name: SfxName): void {
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
    for (const v of SFX[name]) this.spawnVoice(v, t0);
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

  private spawnVoice(v: Voice, t0: number): void {
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
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(v.freqEnd, end);
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
        biq.frequency.setValueAtTime(v.filter.freq, start);
        if (v.filter.freqEnd !== undefined)
          biq.frequency.exponentialRampToValueAtTime(v.filter.freqEnd, end);
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
