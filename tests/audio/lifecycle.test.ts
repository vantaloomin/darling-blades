/**
 * iOS audio-resume resilience (mobile-lan-plan §1.5): the AudioContext lands
 * in the non-standard 'interrupted' state after a screen lock / app switch and
 * must be resumed on the return-to-foreground lifecycle signals — with the
 * gesture unlock re-armed when the browser refuses the programmatic resume.
 *
 * Runs headless by installing fake window/document/AudioContext globals; the
 * real-device behavior still needs a phone (flagged in the plan §1.8).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioManager } from '../../src/audio/AudioManager';

type Listener = (...args: unknown[]) => void;

class FakeEventTarget {
  listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, fn: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'suspended';
  resumeCalls = 0;
  /** what resume() does — tests flip this to model refusal vs success */
  resumeBehavior: 'grant' | 'refuse' | 'reject' = 'grant';
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumeBehavior === 'reject') return Promise.reject(new Error('not allowed'));
    if (this.resumeBehavior === 'grant') this.state = 'running';
    return Promise.resolve();
  }
  createGain(): unknown {
    return {
      gain: { value: 0, cancelScheduledValues: () => {}, setTargetAtTime: () => {} },
      connect: () => {},
    };
  }
  createBuffer(): unknown {
    return { getChannelData: () => new Float32Array(this.sampleRate) };
  }
}

const flushMicrotasks = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const g = globalThis as Record<string, unknown>;
let fakeWindow: FakeEventTarget;
let fakeDocument: FakeEventTarget & { visibilityState: string };
const saved: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of ['window', 'document', 'AudioContext']) saved[key] = g[key];
  fakeWindow = new FakeEventTarget();
  fakeDocument = Object.assign(new FakeEventTarget(), { visibilityState: 'visible' });
  g.window = fakeWindow;
  g.document = fakeDocument;
  g.AudioContext = FakeAudioContext;
  FakeAudioContext.instances = [];
});

afterEach(() => {
  for (const key of ['window', 'document', 'AudioContext']) {
    if (saved[key] === undefined) delete g[key];
    else g[key] = saved[key];
  }
});

const makeManager = (): AudioManager => {
  let vol = 0.8;
  return new AudioManager({ get: () => vol, set: (v) => (vol = v) });
};

const unlockViaGesture = (mgr: AudioManager): FakeAudioContext => {
  fakeWindow.dispatch('pointerdown');
  const ctx = FakeAudioContext.instances[0];
  expect(ctx).toBeDefined();
  expect(mgr.ready).toBe(true);
  return ctx;
};

describe('AudioManager lifecycle resume', () => {
  it('resumes an interrupted context on visibilitychange→visible', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);

    ctx.state = 'interrupted'; // iOS screen lock
    expect(mgr.ready).toBe(false);
    fakeDocument.dispatch('visibilitychange');
    await flushMicrotasks();

    expect(ctx.resumeCalls).toBeGreaterThanOrEqual(2); // unlock resume + lifecycle resume
    expect(mgr.resumeAttempts).toBe(1);
    expect(mgr.ready).toBe(true);
  });

  it('resumes on pageshow and focus too', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);

    ctx.state = 'interrupted';
    fakeWindow.dispatch('pageshow');
    await flushMicrotasks();
    expect(mgr.ready).toBe(true);

    ctx.state = 'interrupted';
    fakeWindow.dispatch('focus');
    await flushMicrotasks();
    expect(mgr.ready).toBe(true);
  });

  it('does nothing while hidden or while already running', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);
    const callsAfterUnlock = ctx.resumeCalls;

    fakeDocument.dispatch('visibilitychange'); // visible + running → no-op
    fakeWindow.dispatch('focus');
    await flushMicrotasks();
    expect(ctx.resumeCalls).toBe(callsAfterUnlock);

    ctx.state = 'interrupted';
    fakeDocument.visibilityState = 'hidden';
    fakeDocument.dispatch('visibilitychange'); // hidden → no resume attempt
    await flushMicrotasks();
    expect(mgr.resumeAttempts).toBe(0);
  });

  it('re-arms the gesture unlock when the browser refuses the resume', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);
    expect(fakeWindow.count('pointerdown')).toBe(0); // unlock disarmed after success

    ctx.state = 'interrupted';
    ctx.resumeBehavior = 'refuse'; // resolves but stays interrupted
    fakeDocument.dispatch('visibilitychange');
    await flushMicrotasks();
    expect(mgr.ready).toBe(false);
    expect(fakeWindow.count('pointerdown')).toBe(1); // unlock re-armed

    ctx.resumeBehavior = 'grant';
    fakeWindow.dispatch('pointerdown'); // next tap restores audio
    expect(mgr.ready).toBe(true);
    expect(fakeWindow.count('pointerdown')).toBe(0); // and disarms again
  });

  it('re-arms the gesture unlock when the resume outright rejects', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);

    ctx.state = 'interrupted';
    ctx.resumeBehavior = 'reject';
    fakeWindow.dispatch('pageshow');
    await flushMicrotasks();
    expect(fakeWindow.count('pointerdown')).toBe(1);
  });

  it('never double-arms the unlock listeners', async () => {
    const mgr = makeManager();
    const ctx = unlockViaGesture(mgr);

    ctx.state = 'interrupted';
    ctx.resumeBehavior = 'refuse';
    fakeDocument.dispatch('visibilitychange');
    fakeWindow.dispatch('pageshow');
    fakeWindow.dispatch('focus');
    await flushMicrotasks();
    expect(fakeWindow.count('pointerdown')).toBe(1);
    expect(fakeWindow.count('keydown')).toBe(1);
    expect(mgr.resumeAttempts).toBe(3);
  });
});
