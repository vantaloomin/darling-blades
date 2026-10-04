import { describe, expect, it, vi } from 'vitest';
import {
  configureProbeNetwork, installArtDispatchHold, installLongTaskRecorder, retryMemorySample, sampleAfterGc, settleOwnedProcesses, type ArtDispatchScope, type LongTaskScope,
} from '../../scripts/art-probe-runtime.mjs';
import { createLooseSource } from '../../src/art/artSource';
import { FakeImage, makeStore } from './artStoreFakes';

function dispatchScope(fetch: typeof globalThis.fetch): ArtDispatchScope {
  return { fetch, URL, location: { origin: 'http://tauri.localhost', href: 'http://tauri.localhost/' } };
}

describe('attached app art dispatch interruption', () => {
  // Mutation: dispatch-while-held; bypass the art dispatch queue.
  it('keeps a real store lease pending during interruption then recovers through native loose-file fetch without failures', async () => {
    const native = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([
      82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80, // RIFF / WEBP
    ])));
    const scope = dispatchScope(native);
    // The injected function must survive serialization into a new document.
    const install = new Function(`return (${installArtDispatchHold.toString()})`)() as typeof installArtDispatchHold;
    const hold = install(scope);
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const h = makeStore({ maxInFlight: 8,
      source: createLooseSource({ fetch: (...args) => scope.fetch(...args), hasHalf: () => true }),
      decode: async () => new FakeImage(640, 800, 'art'),
    }, keys);
    const lease = h.store.lease('duel', keys);
    let ready = false;
    void lease.ready.then(() => { ready = true; });
    try {
      await h.tick();
      expect(h.store.stats().inFlight).toBe(8);
      expect(hold.heldRequests).toBe(8);
      expect(ready).toBe(false);
      expect(native).not.toHaveBeenCalled();
      hold.dispose();
      for (let frame = 0; frame < 20 && !ready; frame++) await h.tick();
      expect(ready).toBe(true);
      expect(h.store.stats().resident).toBe(8);
      expect(h.store.stats().failures).toBe(0);
      expect(native).toHaveBeenCalledTimes(8);
      expect(hold.heldRequests).toBe(0);
      expect(scope.fetch).toBe(native);
      expect(scope.__probeArtFetch).toBeUndefined();
    } finally { hold.dispose(); lease.release(); h.store.dispose(); }
  });

  // Mutation: hold-all-requests; remove the art URL/origin restriction.
  it('leaves privacy and other non-art or foreign-origin requests on their original dispatch path', async () => {
    const native = vi.fn<typeof fetch>(async () => new Response('ok'));
    const scope = dispatchScope(native);
    const hold = installArtDispatchHold(scope);
    const urls = ['./privacy.html', './assets/audio/menu.ogg', 'https://elsewhere.test/assets/art/cards/a.webp'];
    const promises = urls.map(url => scope.fetch(url));
    try {
      expect(native.mock.calls.map(call => call[0])).toEqual(urls);
      expect(hold.heldRequests).toBe(0);
    } finally { hold.dispose(); await Promise.all(promises); }
  });

  // Mutations: lose-fetch-arguments; suppress-native-failure; retain-held-abort-listener.
  it('releases the original Request and options exactly once and preserves native fetch rejection', async () => {
    const failure = new Error('native handler failed');
    const native = vi.fn<typeof fetch>(async () => { throw failure; });
    const scope = dispatchScope(native);
    const hold = installArtDispatchHold(scope);
    const request = new Request('http://tauri.localhost/assets/art/cards-half/a.webp');
    const signal = new AbortController().signal;
    const removed = vi.spyOn(signal, 'removeEventListener');
    const init = { signal, cache: 'no-store' as const };
    const result = scope.fetch(request, init);
    const check = expect(result).rejects.toBe(failure);
    hold.release();
    hold.dispose();
    hold.dispose();
    await check;
    expect(native).toHaveBeenCalledTimes(1);
    expect(native.mock.calls[0][0]).toBe(request);
    expect(native.mock.calls[0][1]).toBe(init);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(hold.heldRequests).toBe(0);
  });

  // Mutations: dispatch-cancelled-request; inherit-explicit-null-signal.
  it('settles cancelled held reads and forgets them before releasing or replacing the hook', async () => {
    const native = vi.fn<typeof fetch>(async () => new Response('ok'));
    const scope = dispatchScope(native);
    const hold = installArtDispatchHold(scope);
    const controller = new AbortController();
    const result = scope.fetch('./assets/art/cards/a.webp', { signal: controller.signal });
    const aborted = expect(result).rejects.toHaveProperty('name', 'AbortError');
    controller.abort();
    await aborted;
    expect(hold.heldRequests).toBe(0);
    const again = scope.fetch('./assets/art/cards/a.webp', { signal: controller.signal });
    await expect(again).rejects.toHaveProperty('name', 'AbortError');
    // Explicit null overrides an aborted Request signal, just as native fetch does.
    const request = new Request('http://tauri.localhost/assets/art/cards/a.webp', { signal: controller.signal });
    const allowed = scope.fetch(request, { signal: null });
    expect(hold.heldRequests).toBe(1);
    const replacement = installArtDispatchHold(scope);
    await allowed;
    replacement.dispose();
    expect(native).toHaveBeenCalledTimes(1);
    expect(native.mock.calls[0]).toEqual([request, { signal: null }]);
    expect(scope.fetch).toBe(native);
    expect(scope.__probeArtFetch).toBeUndefined();
  });
});

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

  // Mutations: gc-after-sample; heap-total-instead-of-used; reset-after-gc.
  it('samples after GC has settled while preserving the gameplay snapshot taken before it', async () => {
    const tasks = [60];
    let gcDone = false;
    let settled = false;
    let observing = true;
    let prepared = false;
    const result = await sampleAfterGc({
      pauseLongTasks: () => { observing = false; return tasks.slice(); },
      prepareMemory: () => { expect(observing).toBe(false); prepared = true; },
      collectGarbage: () => { expect(prepared).toBe(true); gcDone = true; tasks.push(900); },
      wait: async ms => { expect(gcDone).toBe(true); expect(ms).toBeGreaterThan(0); settled = true; },
      readMemory: () => { expect(gcDone && settled).toBe(true); expect(observing).toBe(false); return counters(110, 200); },
      readHeapUsage: () => {
        expect(gcDone && settled).toBe(true);
        expect(observing).toBe(false);
        return { usedSize: 1572864, totalSize: 8388608 };
      },
      resumeLongTasks: () => { observing = true; },
    });
    expect(result.longTasks).toEqual([60]);
    expect(result.memory.rendererPrivateMiB).toBe(200);
    expect(result.memory.jsHeapUsedMiB).toBe(1.5);
    expect(observing).toBe(true);
  });

  // Mutation: omit-resume-finally; resume only after successful sampling.
  it('resumes attribution even if the garbage collector command fails', async () => {
    let observing = true;
    await expect(sampleAfterGc({
      pauseLongTasks: () => { observing = false; return []; },
      collectGarbage: () => { throw new Error('GC unavailable'); },
      wait: async () => {}, readMemory: () => counters(1, 1),
      readHeapUsage: () => ({ usedSize: 0 }),
      resumeLongTasks: () => { observing = true; },
    })).rejects.toThrow('GC unavailable');
    expect(observing).toBe(true);
  });

  // Mutation: missing-heap-is-zero; substitute 0 when the CDP heap read fails.
  it('reports an unavailable JS heap as null while preserving valid process counters', async () => {
    const result = await sampleAfterGc({
      pauseLongTasks: () => [], collectGarbage: () => {}, wait: () => {},
      readMemory: () => counters(100, 200),
      readHeapUsage: () => { throw new Error('target unavailable'); }, resumeLongTasks: () => {},
    });
    expect(result.memory.jsHeapUsedMiB).toBeNull();
    expect(result.memory.rendererPrivateMiB).toBe(200);
    expect(result.memory.jsHeapUnavailable).toContain('target unavailable');
  });
});

describe('probe long-task attribution', () => {
  // Mutations: buffer-on-resume; retain-task-history (splice -> slice).
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
    expect(scope.__pauseProbeLongTasks!()).toEqual([70]);
    expect(scope.__longTasks).toEqual([]);
    // Repeated load/evict activity must not leave a history array in the page.
    for (let cycle = 0; cycle < 40; cycle++) {
      scope.__resumeProbeLongTasks!();
      observer.task(60);
      expect(scope.__pauseProbeLongTasks!()).toEqual([60]);
      expect(scope.__longTasks).toEqual([]);
    }
  });
});

describe('probe network observation lifetime', () => {
  // Mutations: retain-response-bodies (omit buffer limits); retain-request-history
  // (omit disable); lose-throttle-on-reset (omit reapplying the conditions).
  it('repeated art load and eviction cycles retain no inspector bodies or past-stop requests and keep throttling', async () => {
    const requests = new Map<number, { body: Blob | null }>();
    let bodyLimit = Infinity;
    let conditions: Record<string, unknown> = {};
    let seen = 0;
    const send = (method: string, params: Record<string, unknown> = {}): void => {
      if (method === 'Network.disable') { requests.clear(); conditions = {}; }
      if (method === 'Network.enable') bodyLimit = Number(params.maxResourceBufferSize ?? Infinity);
      if (method === 'Network.emulateNetworkConditions') conditions = params;
    };
    const throttle = { offline: false, latency: 40, downloadThroughput: 2500000, uploadThroughput: 2500000 };
    await configureProbeNetwork(send, throttle);
    const h = makeStore({ budgetBytes: 1 });
    h.source.auto = true;
    const read = h.source.read.bind(h.source);
    h.source.read = async (...args) => {
      const body = await read(...args);
      requests.set(++seen, { body: body.size <= bodyLimit ? body : null });
      return body;
    };
    for (let cycle = 0; cycle < 24; cycle++) {
      const lease = h.store.lease('probe', ['a']);
      await h.tick();
      await lease.ready;
      lease.release();
      h.clock.t += 5000;
      await h.tick();
      expect(h.store.stats().resident).toBe(0);
      expect([...requests.values()].filter(request => request.body !== null)).toHaveLength(0);
      await configureProbeNetwork(send, throttle, true);
      expect(requests.size).toBe(0);
      expect(conditions).toEqual({ offline: false, latency: 40, downloadThroughput: 2500000, uploadThroughput: 2500000 });
    }
    expect(seen).toBe(24); // Events still reached the runner for every re-read.
    h.store.dispose();
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
