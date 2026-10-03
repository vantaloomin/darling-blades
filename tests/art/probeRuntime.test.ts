import { describe, expect, it } from 'vitest';
import {
  installLongTaskRecorder, retryMemorySample, sampleAfterGc, settleOwnedProcesses, type LongTaskScope,
} from '../../scripts/art-probe-runtime.mjs';

const counters = (gpu: number | null, renderer: number | null) => ({
  gpuPrivateMiB: gpu, gpuDedicatedMiB: 20, gpuSharedMiB: 30, rendererPrivateMiB: renderer,
});

describe('probe memory sampling', () => {
  // Mutation: stop-after-first-read; break after an incomplete observation.
  it('retries a missing renderer with a fresh complete observation of every counter', async () => {
    const readings = [counters(100, null), { ...counters(130, 240), gpuDedicatedMiB: 50, gpuSharedMiB: 60 }];
    let reads = 0;
    const result = await retryMemorySample(() => readings[reads++], async () => {});
    expect(reads).toBe(2);
    expect(result.gpuPrivateMiB).toBe(130);
    expect(result.gpuDedicatedMiB).toBe(50);
    expect(result.gpuSharedMiB).toBe(60);
    expect(result.rendererPrivateMiB).toBe(240);
    expect(result.memorySampling.complete).toBe(true);
    expect(result.memorySampling.observations[0].rendererPrivateMiB).toBeNull();
  });

  // Mutation: stitch-attempts; fill missing counters with earlier non-null values.
  it('keeps the final missing counter null after bounded retries without stitching attempts', async () => {
    const readings = [counters(100, null), counters(null, 250), counters(null, 270)];
    let reads = 0;
    const waits: number[] = [];
    const result = await retryMemorySample(() => readings[reads++], async ms => { waits.push(ms); });
    expect(reads).toBe(3);
    expect(waits).toHaveLength(2);
    expect(waits.every(ms => ms > 0)).toBe(true);
    expect(result.gpuPrivateMiB).toBeNull();
    expect(result.rendererPrivateMiB).toBe(270);
    expect(result.memorySampling.complete).toBe(false);
  });

  // Mutation: propagate-provider-error; remove the exception-to-null observation.
  it('exhausts provider failures as unavailable counters instead of fabricated zeros', async () => {
    let reads = 0;
    const result = await retryMemorySample(() => { reads++; throw new Error('renderer exited'); }, async () => {});
    expect(reads).toBe(3);
    expect(result.gpuPrivateMiB).toBeNull();
    expect(result.gpuDedicatedMiB).toBeNull();
    expect(result.gpuSharedMiB).toBeNull();
    expect(result.rendererPrivateMiB).toBeNull();
    expect(result.memorySampling.complete).toBe(false);
  });

  // Mutation: gc-after-sample; move the collectGarbage call after the read.
  it('samples after GC has settled while preserving the gameplay snapshot taken before it', async () => {
    const tasks = [60];
    let gcDone = false;
    let settled = false;
    let observing = true;
    const result = await sampleAfterGc({
      pauseLongTasks: () => { observing = false; return tasks.slice(); },
      collectGarbage: () => { gcDone = true; tasks.push(900); },
      wait: async ms => { expect(gcDone).toBe(true); expect(ms).toBeGreaterThan(0); settled = true; },
      readMemory: () => { expect(gcDone && settled).toBe(true); expect(observing).toBe(false); return counters(110, 200); },
      resumeLongTasks: () => { observing = true; },
    });
    expect(result.longTasks).toEqual([60]);
    expect(result.memory.rendererPrivateMiB).toBe(200);
    expect(observing).toBe(true);
  });

  // Mutation: omit-resume-finally; resume only after successful sampling.
  it('resumes attribution even if the garbage collector command fails', async () => {
    let observing = true;
    await expect(sampleAfterGc({
      pauseLongTasks: () => { observing = false; return []; },
      collectGarbage: () => { throw new Error('GC unavailable'); },
      wait: async () => {}, readMemory: () => counters(1, 1),
      resumeLongTasks: () => { observing = true; },
    })).rejects.toThrow('GC unavailable');
    expect(observing).toBe(true);
  });
});

describe('probe long-task attribution', () => {
  // Mutation: buffer-on-resume; replay the GC window on the next observation.
  it('drains gameplay before pausing and never attributes buffered diagnostic work to the next stop', () => {
    const scope: LongTaskScope = {};
    const observers: FakeObserver[] = [];
    class FakeObserver {
      static supportedEntryTypes = ['longtask'];
      pending: Array<{ duration: number }> = [];
      history: Array<{ duration: number }> = [];
      observing = false;
      constructor(readonly callback: (list: { getEntries(): Array<{ duration: number }> }) => void) { observers.push(this); }
      observe({ buffered }: { type: string; buffered: boolean }): void {
        this.observing = true;
        if (buffered) this.callback({ getEntries: () => this.history });
      }
      disconnect(): void { this.observing = false; this.pending = []; }
      takeRecords(): Array<{ duration: number }> { return this.pending.splice(0); }
      task(duration: number): void {
        const entry = { duration };
        this.history.push(entry);
        if (this.observing) this.pending.push(entry);
      }
    }
    installLongTaskRecorder(scope, FakeObserver);
    const observer = observers[0];
    observer.task(80);
    expect(scope.__pauseProbeLongTasks!()).toEqual([80]);
    observer.task(900);
    scope.__resumeProbeLongTasks!();
    observer.task(70);
    expect(scope.__pauseProbeLongTasks!()).toEqual([80, 70]);
  });
});

function processHarness() {
  let clock = 0;
  const exitAt = new Map([[11, Infinity], [22, Infinity]]);
  const forced: Array<{ pid: number; at: number }> = [];
  return {
    exitAt, forced,
    io: {
      alive: (pid: number) => clock < (exitAt.get(pid) ?? 0),
      now: () => clock,
      wait: async (ms: number) => { clock += ms; },
      forceKill: (pid: number) => { forced.push({ pid, at: clock }); exitAt.set(pid, clock + 200); },
    },
  };
}

describe('owned process shutdown', () => {
  // Mutation: force-before-grace; set the graceful polling duration to zero.
  it('lets an owned process finish naturally during the grace period without killing or warning', async () => {
    const harness = processHarness();
    harness.exitAt.set(11, 1000);
    const result = await settleOwnedProcesses([11], harness.io);
    expect(harness.forced).toEqual([]);
    expect(result.remaining).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  // Mutation: forced-is-failure; return forced PIDs as remaining after verification.
  it('records a successfully killed straggler as a warning with no unfinished processes', async () => {
    const harness = processHarness();
    harness.exitAt.set(11, 1000);
    const result = await settleOwnedProcesses([11, 22], harness.io);
    expect(harness.forced).toEqual([{ pid: 22, at: 15000 }]);
    expect(result.remaining).toEqual([]);
    expect(result.killed).toEqual([22]);
    expect(result.warnings.map(warning => warning.pids)).toEqual([[22]]);
  });

  // Mutation: assume-kill-worked; clear remaining without polling after force-kill.
  it('keeps a process unfinished when it survives the force-kill verification window', async () => {
    const harness = processHarness();
    harness.io.forceKill = (pid: number) => { harness.forced.push({ pid, at: harness.io.now() }); };
    const result = await settleOwnedProcesses([22], harness.io);
    expect(result.remaining).toEqual([22]);
    expect(result.killed).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
