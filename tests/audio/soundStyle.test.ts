/**
 * The Classic / New sound style: New plays the recorded sample once it has
 * loaded and the Classic recipe until then, a failed file never stops the
 * Classic sound, and every file the New set names was actually built.
 *
 * Headless: fake window/document/AudioContext/fetch globals, as in
 * lifecycle.test.ts. How the samples sound still needs ears.
 */
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioManager } from '../../src/audio/AudioManager';
import { allSoundStems, pickSoundFormat, SOUND_FORMATS } from '../../src/audio/soundSet';
import type { SoundStyle } from '../../src/meta/soundStyle';

const node = (): Record<string, unknown> => ({
  connect: () => {},
  disconnect: () => {},
  start: () => {},
  stop: () => {},
  gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} },
  frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
  detune: { value: 0 },
  playbackRate: { value: 1 },
});

class FakeAudioContext {
  state = 'running';
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  oscillators = 0;
  bufferSources: { buffer: unknown }[] = [];
  resume(): Promise<void> {
    return Promise.resolve();
  }
  createGain(): unknown {
    return node();
  }
  createBuffer(): unknown {
    return { getChannelData: () => new Float32Array(this.sampleRate) };
  }
  createOscillator(): unknown {
    this.oscillators++;
    return node();
  }
  createBiquadFilter(): unknown {
    return { ...node(), Q: { value: 0 } };
  }
  createBufferSource(): unknown {
    const src = { ...node(), buffer: null as unknown };
    this.bufferSources.push(src);
    return src;
  }
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown> {
    return Promise.resolve({ decodedFrom: bytes });
  }
}

const g = globalThis as Record<string, unknown>;
const saved: Record<string, unknown> = {};
let fetched: string[];
let fetchOk: boolean;
let ctx: FakeAudioContext;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

/** An AudioManager whose context is already unlocked, at the given style. */
function manager(style: { current: SoundStyle }): AudioManager {
  const audio = new AudioManager({ get: () => 1, set: () => {} }, () => true, () => style.current);
  (fakeWindow.listeners.get('pointerdown') ?? []).forEach((fn) => fn());
  ctx = (audio as unknown as { ctx: FakeAudioContext }).ctx;
  return audio;
}

let fakeWindow: { listeners: Map<string, ((...a: unknown[]) => void)[]>; addEventListener: (t: string, f: () => void) => void; removeEventListener: () => void };

beforeEach(() => {
  for (const key of ['window', 'document', 'AudioContext', 'fetch']) saved[key] = g[key];
  fakeWindow = {
    listeners: new Map(),
    addEventListener(t, f) {
      this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
    },
    removeEventListener: () => {},
  };
  g.window = fakeWindow;
  g.document = { addEventListener: () => {}, visibilityState: 'visible', createElement: () => ({ canPlayType: () => 'probably' }) };
  g.AudioContext = FakeAudioContext;
  fetched = [];
  fetchOk = true;
  g.fetch = (url: string) => {
    fetched.push(url);
    return Promise.resolve({ ok: fetchOk, status: fetchOk ? 200 : 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
  };
});

afterEach(() => {
  for (const key of ['window', 'document', 'AudioContext', 'fetch']) {
    if (saved[key] === undefined) delete g[key];
    else g[key] = saved[key];
  }
});

describe('sound style', () => {
  it('Classic never fetches a file and always plays the recipe', async () => {
    const audio = manager({ current: 'classic' });
    audio.play('click');
    await flush();
    expect(fetched).toEqual([]);
    expect(ctx.oscillators).toBeGreaterThan(0);
    expect(audio.samplePlayCount).toBe(0);
  });

  it('New plays the Classic recipe while the sample loads, then the sample', async () => {
    const audio = manager({ current: 'new' });
    expect(fetched).toContain('assets/audio/sfx/click.ogg'); // preloaded on unlock
    audio.play('click');
    expect(ctx.oscillators).toBeGreaterThan(0);
    expect(audio.samplePlayCount).toBe(0);

    await flush();
    const before = ctx.oscillators;
    (audio as unknown as { lastPlayedAt: Map<string, number> }).lastPlayedAt.clear();
    audio.play('click');
    expect(audio.samplePlayCount).toBe(1);
    expect(ctx.oscillators).toBe(before);
  });

  it('keeps the Classic sound when a file fails, and asks for it only once', async () => {
    fetchOk = false;
    const audio = manager({ current: 'new' });
    await flush();
    const clickFetches = (): number => fetched.filter((u) => u.endsWith('/sfx/click.ogg')).length;
    expect(clickFetches()).toBe(1);
    audio.play('click');
    await flush();
    expect(audio.samplePlayCount).toBe(0);
    expect(ctx.oscillators).toBeGreaterThan(0);
    expect(clickFetches()).toBe(1);
  });

  it('voices card-handling texture only under New', async () => {
    const style = { current: 'classic' as SoundStyle };
    const audio = manager(style);
    audio.playTexture('shuffle');
    expect(audio.samplePlayCount).toBe(0);

    style.current = 'new';
    audio.preloadSamples();
    await flush();
    audio.playTexture('shuffle');
    expect(audio.samplePlayCount).toBe(1);
  });

  it('picks .m4a where the browser cannot decode Ogg Vorbis', () => {
    expect(pickSoundFormat(() => 'maybe')).toBe('ogg');
    expect(pickSoundFormat(() => '')).toBe('m4a');
  });
});

describe('the New sound set on disk', () => {
  it('has every file it names, in both formats', () => {
    const missing = allSoundStems().flatMap(({ stem }) =>
      SOUND_FORMATS.map((f) => `public/assets/audio/${stem}.${f}`).filter((p) => !existsSync(p)),
    );
    expect(missing).toEqual([]);
  });
});

/** Stop a director and its scheduler interval so the test run can exit. */
function halt(music: { stop: () => void }): void {
  music.stop();
  clearInterval((music as unknown as { timer: ReturnType<typeof setInterval> }).timer);
}

describe('music under the sound style', () => {
  async function director(style: { current: SoundStyle }, loaded: boolean) {
    const { MusicDirector } = await import('../../src/audio/music');
    const fakeCtx = new FakeAudioContext();
    const master = node();
    const audio = {
      bus: { ctx: fakeCtx, master },
      soundStyle: () => style.current,
      sample: (stem: string) => (loaded ? { stem } : null),
    };
    const music = new MusicDirector({ get: () => true, set: () => {} }, audio as unknown as AudioManager);
    return { music, fakeCtx };
  }

  it('New swaps the generative bed for the mood loop, and Classic swaps it back', async () => {
    const style = { current: 'new' as SoundStyle };
    const { music, fakeCtx } = await director(style, true);
    music.setMood('duel');
    expect(music.trackMood).toBe('duel');
    expect(fakeCtx.oscillators).toBe(0);
    expect(fakeCtx.bufferSources.at(-1)?.buffer).toEqual({ stem: 'music/duel' });

    style.current = 'classic';
    music.refreshStyle();
    expect(music.trackMood).toBeNull();
    expect(fakeCtx.oscillators).toBeGreaterThan(0);
    halt(music);
  });

  it('keeps the generative bed going while the loop is still loading', async () => {
    const { music, fakeCtx } = await director({ current: 'new' }, false);
    music.setMood('menu');
    expect(music.trackMood).toBeNull();
    expect(fakeCtx.oscillators).toBeGreaterThan(0);
    halt(music);
  });
});
