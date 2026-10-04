import { describe, expect, it } from 'vitest';
import {
  bytesToMiB, collectionGate, longTaskGate, longTaskMedianGate, loopMemoryGate, median, memoryGate, normalizeLongTasks, normalizeStop, summarizeTimings,
} from '../../scripts/art-probe-metrics.mjs';

const local = { downloadMbps: null, latencyMs: 0, cpuRate: 1 };
const memory = (stop: string, overrides: Record<string, unknown> = {}) => ({
  stop, baseStop: stop, loop: 1, gpuPrivateMiB: 0, gpuDedicatedMiB: 0, gpuSharedMiB: 0, rendererPrivateMiB: 0, ...overrides,
});
const memoryTour = (stream: 'on' | 'off', gpu = 600, renderer = 400, overrides: Record<string, unknown> = {}) => ({
  probeVersion: 'fixture-probe-a', stream, failure: null, tier: 'full', throttle: local, budgetMiB: null, evict: 'on', target: 'web', source: 'packs',
  loops: 1, tourCompletedLoops: 1,
  measurement: {
    buildId: 'a'.repeat(64), machineId: 'b'.repeat(64), tourVersion: 's6-g1-v2',
    startedAt: stream === 'on' ? '2026-10-03T01:00:00.000Z' : '2026-10-03T00:00:00.000Z',
    finishedAt: stream === 'on' ? '2026-10-03T01:10:00.000Z' : '2026-10-03T00:10:00.000Z',
  },
  tourFixture: { version: 's6-v1', opponentId: 'opponent-a', packCardIds: ['card-a', 'card-b'], draftPackIds: ['card-c', 'card-d'], duelSeed: 37 },
  stops: [memory('menu'), memory('collection-again', { gpuPrivateMiB: gpu, rendererPrivateMiB: renderer }),
    memory('restored', { loop: null }), memory('collection-after-restore', { loop: null })],
  ...overrides,
});
const loopTour = (peaks: Array<[number, number]>) => memoryTour('on', 0, 0, {
  budgetMiB: 8, loops: peaks.length, tourCompletedLoops: peaks.length,
  tourEvidence: { loopContinuity: { samePage: true, navigationTimeOrigin: 1791000000000, contextRestoresAfterLoops: true } },
  stops: [...peaks.flatMap(([gpuPrivateMiB, rendererPrivateMiB], index) => [
    memory(index === 0 ? 'menu' : `loop${index + 1}-menu`, { baseStop: 'menu', loop: index + 1 }),
    memory(index === 0 ? 'collection-again' : `loop${index + 1}-collection-again`, { baseStop: 'collection-again', loop: index + 1, gpuPrivateMiB, rendererPrivateMiB }),
  ]), memory('restored', { loop: null }), memory('collection-after-restore', { loop: null })],
});
const timingRun = (overrides: Record<string, unknown> = {}) => ({
  failure: null, tier: 'full', throttle: local,
  collectionTiming: {
    navigationToBinderMs: 4200, navigationToLoadingGoneMs: 4250, navigationToRealMs: 4400,
    enterToBinderMs: 16, enterToRealMs: 216, binderFrame: 1, expectedPockets: 12, actualPockets: 12,
    ...overrides,
  },
});
const tour = (stream: 'on' | 'off', durations: number[][] = [[], [80]]) => ({
  probeVersion: 'fixture-probe-a', stream, failure: null, tier: 'full', throttle: local, budgetMiB: null, evict: 'on', target: 'web', source: 'packs',
  tourFixture: { version: 's6-v1', opponentId: 'opponent-a', packCardIds: ['card-a', 'card-b'], draftPackIds: ['card-c', 'card-d'], duelSeed: 37 },
  stops: durations.map((longTasks, index) => ({ stop: index === 0 ? 'menu' : 'collection', longTasks })),
});

describe('probe memory gate', () => {
  // Mutation: unpaired-pass; report PASS for an unpaired run.
  it('reports raw full-tour peaks but never passes an unpaired run', () => {
    const result = memoryGate(memoryTour('on', 0, 0, { stops: [
      memory('menu', { gpuPrivateMiB: 100, gpuDedicatedMiB: 200, gpuSharedMiB: 50, rendererPrivateMiB: 400 }),
      memory('collection-again', { gpuPrivateMiB: 250, gpuDedicatedMiB: 25, gpuSharedMiB: 25, rendererPrivateMiB: 450 }),
      memory('restored', { loop: null, gpuPrivateMiB: 10, gpuDedicatedMiB: 600, gpuSharedMiB: 10 }),
      memory('collection-after-restore', { loop: null }),
    ] }));
    expect(result.status).toBe('UNMEASURED');
    expect(result.candidate.runs[0].gpuPeakMiB).toBe(620);
    expect(result.candidate.runs[0].rendererPeakMiB).toBe(450);
    expect(result.baseline).toBeNull();
  });

  // Mutations: gpu-boundary-strict; tier-percent-swap; reduction-is-ratio.
  it.each([
    ['full', 600, 600.01, 60, 40], ['lite', 700, 700.01, 70, 30],
  ])('accepts the exact %s percentage limit and rejects any excess', (tier, allowed, excess, percent, reduction) => {
    const before = memoryTour('off', 1000, 400, { tier });
    const result = memoryGate(memoryTour('on', allowed as number, 400, { tier }), before);
    expect(result.status).toBe('PASS');
    expect(result.gpuPercentOfOff).toBe(percent);
    expect(result.gpuReductionPercent).toBe(reduction);
    expect(memoryGate(memoryTour('on', excess as number, 400, { tier }), before).status).toBe('FAIL');
  });

  // Mutation: omit-gpu-component; omit any one GPU counter from memoryAt.
  it('uses the sum of all three GPU counters at each stop', () => {
    const on = memoryTour('on');
    on.stops[1] = memory('collection-again', { gpuPrivateMiB: 100, gpuDedicatedMiB: 250, gpuSharedMiB: 251, rendererPrivateMiB: 400 });
    const result = memoryGate(on, memoryTour('off', 1000));
    expect(result.candidate.medianGpuPeakMiB).toBe(601);
    expect(result.status).toBe('FAIL');
  });

  // Mutation: renderer-boundary-strict; use >= instead of >.
  it('allows exactly 100 MiB of renderer growth while independently rejecting any excess', () => {
    expect(memoryGate(memoryTour('on', 500, 500), memoryTour('off', 1000, 400)).status).toBe('PASS');
    expect(memoryGate(memoryTour('on', 500, 500.01), memoryTour('off', 1000, 400)).status).toBe('FAIL');
  });

  // Mutations: median-to-maximum; peak-after-median; average-peaks.
  it('compares medians of per-run peaks even when different stops peak and one repeat exceeds the limit', () => {
    const first = memoryTour('on', 0, 0);
    first.stops[0] = memory('menu', { gpuPrivateMiB: 500, rendererPrivateMiB: 550 });
    const last = memoryTour('on', 0, 0);
    last.stops[2] = memory('restored', { loop: null, gpuPrivateMiB: 900, rendererPrivateMiB: 500 });
    const result = memoryGate({ probeVersion: 'fixture-probe-a', repeat: 3, runs: [first, memoryTour('on', 600, 450), last] },
      { probeVersion: 'fixture-probe-a', repeat: 3, runs: [memoryTour('off', 1000, 400), memoryTour('off', 2000, 300), memoryTour('off', 1000, 400)] });
    expect(result.status).toBe('PASS');
    expect(result.candidate.medianGpuPeakMiB).toBe(600);
    expect(result.baseline?.medianGpuPeakMiB).toBe(1000);
    expect(result.candidate.medianRendererPeakMiB).toBe(500);
    expect(result.baseline?.medianRendererPeakMiB).toBe(400);
    expect(result.rendererDeltaMiB).toBe(100);
  });

  // Mutation: zero-baseline-pass; remove the undefined percentage guard.
  it('leaves a zero GPU baseline unmeasured even when both measured peaks are zero', () => {
    const result = memoryGate(memoryTour('on', 0), memoryTour('off', 0));
    expect(result.status).toBe('UNMEASURED');
    expect(result.baseline?.medianGpuPeakMiB).toBe(0);
    expect(result.gpuReductionPercent).toBeNull();
  });

  // Mutation: missing-is-zero; default an absent/nonfinite counter to zero.
  it.each(['gpuPrivateMiB', 'gpuDedicatedMiB', 'gpuSharedMiB', 'rendererPrivateMiB'])('requires %s at every stop in both measurement blocks', (field) => {
    for (const value of [undefined, null, NaN, Infinity, -1]) {
      for (const missingFromOn of [true, false]) {
        const on = memoryTour('on', 500);
        const off = memoryTour('off', 1000);
        (missingFromOn ? on : off).stops[0] = memory('menu', { [field]: value });
        expect(memoryGate(on, off).status).toBe('UNMEASURED');
      }
    }
  });

  // Mutations: discard-failed-attempt; ignore-repeat-count.
  it('preserves failed attempts and withholds medians when requested repeats are unfinished or absent', () => {
    const runs = [memoryTour('on', 500), memoryTour('on', 590, 400, { failure: 'browser exited' }), memoryTour('on', 600)];
    const off = { probeVersion: 'fixture-probe-a', repeat: 3, runs: [memoryTour('off', 1000), memoryTour('off', 1000), memoryTour('off', 1000)] };
    const result = memoryGate({ probeVersion: 'fixture-probe-a', repeat: 3, runs }, off);
    expect(result.status).toBe('UNMEASURED');
    expect(result.candidate.attemptedRepeats).toBe(3);
    expect(result.candidate.validRepeats).toBe(2);
    expect(result.candidate.runs[1].gpuPeakMiB).toBe(590);
    expect(result.candidate.medianGpuPeakMiB).toBeNull();
    expect(memoryGate({ probeVersion: 'fixture-probe-a', repeat: 3, runs: [runs[0], runs[2]] }, off).status).toBe('UNMEASURED');
    expect(memoryGate({ probeVersion: 'fixture-probe-a', repeat: 3, runs: [runs[0], runs[2]] }, { probeVersion: 'fixture-probe-a', repeat: 3, runs: [off.runs[0], off.runs[1]] }).status).toBe('UNMEASURED');
    expect(memoryGate(runs[0], off).status).toBe('UNMEASURED');
  });

  // Mutation: ignore-memory-configuration; remove an individual matching condition.
  it.each([
    ['tier', 'lite'], ['throttle', { downloadMbps: 50, latencyMs: 40, cpuRate: 1 }],
    ['budgetMiB', 8], ['evict', 'off'], ['target', 'desktop'], ['source', 'loose'],
  ])('requires matching, measured %s for a memory comparison', (field, value) => {
    expect(memoryGate(memoryTour('on'), memoryTour('off', 1000, 400, { [field as string]: value })).status).toBe('UNMEASURED');
    expect(memoryGate(memoryTour('on'), memoryTour('off', 1000, 400, { [field as string]: undefined })).status).toBe('UNMEASURED');
  });

  // Mutations: first-repeat-identity-only; ignore-build-machine-fixture.
  it('requires build, machine, version and fixture identity across every attempt', () => {
    const before = memoryTour('off', 1000);
    for (const measurement of [{ buildId: 'c'.repeat(64) }, { machineId: 'c'.repeat(64) }, { tourVersion: 'old-tour' }, { buildId: null }]) {
      const changed = memoryTour('on', 600, 400, { measurement: { ...memoryTour('on').measurement, ...measurement } });
      expect(memoryGate({ probeVersion: 'fixture-probe-a', repeat: 2, runs: [memoryTour('on'), changed] }, { probeVersion: 'fixture-probe-a', repeat: 2, runs: [before, before] }).status).toBe('UNMEASURED');
    }
    expect(memoryGate(memoryTour('on', 600, 400, { tourFixture: { ...before.tourFixture, duelSeed: 38 } }), before).status).toBe('UNMEASURED');
    expect(memoryGate(memoryTour('on', 600, 400, { tourFixture: null }), before).status).toBe('UNMEASURED');
  });

  // Mutations: ignore-memory-probe-version; accept-unversioned-probes.
  it('compares memory only between explicitly versioned runs using the same probe method', () => {
    const before = memoryTour('off', 1000);
    expect(memoryGate(memoryTour('on'), before).status).toBe('PASS');
    expect(memoryGate(memoryTour('on', 600, 400, { probeVersion: 'fixture-probe-b' }), before).status).toBe('UNMEASURED');
    for (const probeVersion of [undefined, null, '', '   ']) {
      expect(memoryGate(memoryTour('on', 600, 400, { probeVersion }), before).status).toBe('UNMEASURED');
      expect(memoryGate(memoryTour('on'), { ...before, probeVersion }).status).toBe('UNMEASURED');
      expect(memoryGate(memoryTour('on', 600, 400, { probeVersion }), { ...before, probeVersion }).status).toBe('UNMEASURED');
    }
  });

  // Mutation: ignore-parent-probe-version; trust only the first child or ignore the parent's version.
  it('requires every repeat to carry its parent probe version before memory can be compared', () => {
    const on = { probeVersion: 'fixture-probe-a', repeat: 2, runs: [memoryTour('on'), memoryTour('on')] };
    const off = { probeVersion: 'fixture-probe-a', repeat: 2, runs: [memoryTour('off', 1000), memoryTour('off', 1000)] };
    expect(memoryGate(on, off).status).toBe('PASS');
    for (const probeVersion of ['fixture-probe-b', undefined, null, '', '   ']) {
      expect(memoryGate({ ...on, probeVersion }, off).status).toBe('UNMEASURED');
      expect(memoryGate(on, { ...off, probeVersion }).status).toBe('UNMEASURED');
      expect(memoryGate({ ...on, runs: [on.runs[0], { ...on.runs[1], probeVersion }] }, off).status).toBe('UNMEASURED');
      expect(memoryGate(on, { ...off, runs: [off.runs[0], { ...off.runs[1], probeVersion }] }).status).toBe('UNMEASURED');
    }
  });

  // Mutation: pairwise-time-order-only; allow overlapping off/on measurement blocks.
  it('requires all off repeats to finish before the first on repeat and permits a shared boundary', () => {
    const at = (stream: 'on' | 'off', startedAt: string, finishedAt: string) => memoryTour(stream, stream === 'on' ? 600 : 1000, 400,
      { measurement: { ...memoryTour(stream).measurement, startedAt, finishedAt } });
    expect(memoryGate(at('on', '2026-10-03T00:10:00.000Z', '2026-10-03T00:20:00.000Z'), memoryTour('off', 1000)).status).toBe('PASS');
    expect(memoryGate({ probeVersion: 'fixture-probe-a', repeat: 2, runs: [at('on', '2026-10-03T00:20:00.000Z', '2026-10-03T00:30:00.000Z'), at('on', '2026-10-03T01:20:00.000Z', '2026-10-03T01:30:00.000Z')] },
      { probeVersion: 'fixture-probe-a', repeat: 2, runs: [memoryTour('off', 1000), at('off', '2026-10-03T01:00:00.000Z', '2026-10-03T01:10:00.000Z')] }).status).toBe('UNMEASURED');
    expect(memoryGate(at('on', 'not-a-time', '2026-10-03T01:10:00.000Z'), memoryTour('off', 1000)).status).toBe('UNMEASURED');
  });

  // Mutations: ignore-mode; ignore-tour-completion; ignore-stop-identity.
  it('requires opposite measured loader modes and complete matching tours', () => {
    const on = memoryTour('on');
    const before = memoryTour('off', 1000);
    expect(memoryGate({ ...on, stream: 'default', mode: 'store', exitCode: 1 }, before).status).toBe('PASS');
    expect(memoryGate(on, { ...before, mode: 'store' }).status).toBe('UNMEASURED');
    for (const incomplete of [
      { timing: true }, { tourCompletedLoops: 0 }, { failure: 'browser exited' }, { signal: 'SIGTERM' },
      { stops: on.stops.slice(0, -1) }, { stops: [on.stops[1], on.stops[0], ...on.stops.slice(2)] },
      { stops: [on.stops[0], { ...on.stops[1], stop: 'different-workload' }, ...on.stops.slice(2)] },
    ]) expect(memoryGate({ ...on, ...incomplete }, before).status).toBe('UNMEASURED');
    expect(memoryGate(loopTour([[500, 300], [500, 300]]), before).status).toBe('UNMEASURED');
  });

  // Mutations: loop-boundary-strict; ignore-loop-renderer; ignore-loop-gpu.
  it('allows loop two exactly 100 MiB above loop one and rejects excess in either counter', () => {
    expect(loopMemoryGate(loopTour([[500, 300], [600, 400]])).status).toBe('PASS');
    expect(loopMemoryGate(loopTour([[500, 300], [600.01, 400]])).status).toBe('FAIL');
    expect(loopMemoryGate(loopTour([[500, 300], [600, 400.01]])).status).toBe('FAIL');
  });

  // Mutations: ignore-later-loops; rolling-loop-baseline compares only to the preceding loop.
  it('compares every later loop to loop one so gradual growth cannot hide a leak', () => {
    expect(loopMemoryGate(loopTour([[500, 300], [590, 390], [650, 450]])).status).toBe('FAIL');
  });

  // Mutation: include-restore-in-loop-peaks; attribute the final restored context to loop two.
  it('excludes the final context restoration from leak peaks while retaining it in full-tour evidence', () => {
    const run = loopTour([[500, 300], [600, 400]]);
    run.stops[4] = memory('restored', { loop: null, gpuPrivateMiB: 9000, rendererPrivateMiB: 8000 });
    expect(loopMemoryGate(run).status).toBe('PASS');
    expect(memoryGate(run).candidate.runs[0].gpuPeakMiB).toBe(9000);
  });

  // Mutations: ignore-loop-context; ignore-stress-config; discard-incomplete-loop.
  it('requires complete identical stress loops on one page without an intervening context restore', () => {
    const run = loopTour([[500, 300], [600, 400]]);
    for (const change of [
      { budgetMiB: null }, { evict: 'off' }, { stream: 'off' }, { target: 'desktop' },
      { tourCompletedLoops: 1 }, { failure: 'browser exited' }, { tourEvidence: undefined },
      { tourEvidence: { loopContinuity: { samePage: false, navigationTimeOrigin: 1791000000000, contextRestoresAfterLoops: true } } },
      { tourEvidence: { loopContinuity: { samePage: true, navigationTimeOrigin: null, contextRestoresAfterLoops: true } } },
      { tourEvidence: { loopContinuity: { samePage: true, navigationTimeOrigin: 1791000000000, contextRestoresAfterLoops: false } } },
      { stops: [run.stops[0], run.stops[1], ...run.stops.slice(3)] },
      { stops: run.stops.map((stop, index) => index === 3 ? { ...stop, gpuSharedMiB: null } : stop) },
    ]) expect(loopMemoryGate({ ...run, ...change }).status).toBe('UNMEASURED');
    expect(loopMemoryGate(loopTour([[500, 300]])).status).toBe('UNMEASURED');
  });
});

describe('probe sample normalization', () => {
  // Mutation: divide by 1000000, round MiB, or default absent bytes to zero.
  it('converts store bytes to exact MiB and keeps missing measurements null', () => {
    const sample = normalizeStop({ longTasks: [], art: { stats: { residentBytes: 1572864, pinnedBytes: 1048577 } } });
    expect(sample.residentMiB).toBe(1.5);
    expect(sample.pinnedMiB).toBe(1.0000009536743164);
    expect(normalizeStop({ longTasks: [] }).residentMiB).toBeNull();
    expect(normalizeStop({ longTasks: [], art: { stats: { residentBytes: 0 } } }).pinnedMiB).toBeNull();
    expect(bytesToMiB(0)).toBe(0);
    for (const value of [undefined, null, NaN, Infinity, -10]) expect(bytesToMiB(value)).toBeNull();
  });

  // Mutation: round before filtering, or include duration === 50.
  it('counts only original durations strictly above 50 ms without rounding', () => {
    expect(normalizeLongTasks([0, 49.9, 50, 50.125, 60.25])).toEqual({ count: 2, totalMs: 110.375, durationsMs: [50.125, 60.25] });
    const sample = normalizeStop({ longTasks: [50, 60, 80] });
    expect(sample.longTasks).toBe(2);
    expect(sample.longTaskTotalMs).toBe(140);
    expect(sample.longTaskDurationsMs).toEqual([60, 80]);
  });

  // Mutation: use an empty array when the observer evidence is absent or malformed.
  it('distinguishes a supported observer with no long tasks from absent or corrupt evidence', () => {
    expect(normalizeLongTasks([])).toEqual({ count: 0, totalMs: 0, durationsMs: [] });
    for (const durations of [undefined, null, [60, NaN], [60, null], [Infinity]]) {
      expect(normalizeLongTasks(durations)).toEqual({ count: null, totalMs: null, durationsMs: null });
    }
    expect(normalizeStop({ longTasks: 1, longTaskTotalMs: 80, longTaskDurationsMs: [80] }).longTasks).toBe(1);
    expect(normalizeStop({ longTasks: 0, longTaskTotalMs: 80, longTaskDurationsMs: [80] }).longTasks).toBeNull();
  });
});

describe('cold Collection gate', () => {
  // Mutation: gate navigationToRealMs or real-minus-binder instead of entry latency.
  it('uses entry-to-real latency even when navigation was slow and binder construction used time', () => {
    expect(collectionGate(timingRun({ enterToRealMs: 500 })).status).toBe('PASS');
    expect(collectionGate(timingRun({ enterToBinderMs: 100, enterToRealMs: 500.01 })).status).toBe('FAIL');
  });

  // Mutation: use the local limit for throttled runs, or change > to >=.
  it('permits exactly two seconds under network or CPU throttle and rejects longer latency', () => {
    for (const throttle of [{ downloadMbps: 50, latencyMs: 40, cpuRate: 1 }, { downloadMbps: null, latencyMs: 0, cpuRate: 4 }]) {
      expect(collectionGate({ ...timingRun({ enterToRealMs: 2000 }), throttle }).status).toBe('PASS');
      expect(collectionGate({ ...timingRun({ enterToRealMs: 2000.1 }), throttle }).status).toBe('FAIL');
    }
  });

  // Mutation: remove the binder-frame or twelve-pocket checks.
  it('requires the binder on its first frame and twelve real pockets', () => {
    expect(collectionGate(timingRun({ binderFrame: 2 })).status).toBe('FAIL');
    expect(collectionGate(timingRun({ actualPockets: 11 })).status).toBe('FAIL');
    expect(collectionGate(timingRun({ expectedPockets: 0, actualPockets: 0 })).status).toBe('FAIL');
  });

  // Mutation: use warm spreadTimings, or default absent clock/config values.
  it('requires a complete cold sample and preserves missing or inconsistent timing as unmeasured', () => {
    expect(collectionGate({ failure: null, throttle: local, spreadTimings: [{ built: 16, real: 100, builtFrame: 1 }] }).status).toBe('UNMEASURED');
    expect(collectionGate({ ...timingRun(), failure: 'navigation failed' }).status).toBe('UNMEASURED');
    expect(collectionGate({ ...timingRun(), throttle: undefined }).status).toBe('UNMEASURED');
    for (const field of ['navigationToBinderMs', 'navigationToLoadingGoneMs', 'navigationToRealMs', 'enterToBinderMs', 'enterToRealMs']) {
      expect(collectionGate(timingRun({ [field]: null })).status).toBe('UNMEASURED');
    }
    expect(collectionGate(timingRun({ enterToBinderMs: 300, enterToRealMs: 200 })).status).toBe('UNMEASURED');
  });
});

describe('matched-tour long-task comparison', () => {
  // Mutation: ignore-long-task-probe-version; compare costs from incompatible collection methods.
  it('compares long-task cost only when both runs name the same probe method', () => {
    const before = tour('off');
    expect(longTaskGate(tour('on'), before).status).toBe('PASS');
    for (const probeVersion of ['fixture-probe-b', undefined, null, '', '   ']) {
      expect(longTaskGate({ ...tour('on'), probeVersion }, before).status).toBe('UNMEASURED');
      expect(longTaskGate(tour('on'), { ...before, probeVersion }).status).toBe('UNMEASURED');
    }
    expect(longTaskGate({ ...tour('on'), probeVersion: undefined }, { ...before, probeVersion: undefined }).status).toBe('UNMEASURED');
  });

  // Mutation: reject equality or require both count and duration to improve strictly.
  it('accepts equal cost and a measured zero-task tour against a zero-task baseline', () => {
    expect(longTaskGate(tour('on'), tour('off')).status).toBe('PASS');
    expect(longTaskGate(tour('on', [[], []]), tour('off', [[], []])).status).toBe('PASS');
    expect(longTaskGate(tour('on', [[], [60]]), tour('off', [[], [60, 70]])).status).toBe('PASS');
  });

  // Mutation: remove count comparison or check count AND duration increased.
  it('fails a larger long-task count even when total duration falls', () => {
    expect(longTaskGate(tour('on', [[], [60, 60]]), tour('off', [[], [200]])).status).toBe('FAIL');
  });

  // Mutation: remove total-duration comparison or check count AND duration increased.
  it('fails longer total duration even when the task count falls', () => {
    expect(longTaskGate(tour('on', [[], [200]]), tour('off', [[], [60, 60]])).status).toBe('FAIL');
  });

  // Mutation: sort stop names, compare their sets, or truncate to the shorter tour.
  it('requires every stop in identical traversal order', () => {
    const before = tour('off');
    expect(longTaskGate({ ...tour('on'), stops: [...tour('on').stops].reverse() }, before).status).toBe('UNMEASURED');
    expect(longTaskGate({ ...tour('on'), stops: tour('on').stops.slice(0, 1) }, before).status).toBe('UNMEASURED');
  });

  // Mutation: remove the sameTourFixture guard from longTaskGate.
  it('requires the same opponent, ordered pack and draft cards, and duel seed with complete fixture evidence', () => {
    const before = tour('off');
    for (const change of [
      { opponentId: 'opponent-b' }, { packCardIds: ['card-b', 'card-a'] },
      { draftPackIds: ['card-d', 'card-c'] }, { duelSeed: 38 }, { version: 'old-probe' },
      { opponentId: '' }, { packCardIds: [] }, { draftPackIds: [''] }, { duelSeed: NaN },
    ]) {
      expect(longTaskGate(tour('on'), { ...before, tourFixture: { ...before.tourFixture, ...change } }).status).toBe('UNMEASURED');
    }
    expect(longTaskGate(tour('on'), { ...before, tourFixture: undefined }).status).toBe('UNMEASURED');
    expect(longTaskGate({ ...tour('on'), tourFixture: null }, { ...before, tourFixture: null }).status).toBe('UNMEASURED');
  });

  // Mutation: omit the named condition from baseline compatibility checks.
  it.each([
    ['tier', 'lite'], ['throttle', { downloadMbps: 50, latencyMs: 40, cpuRate: 1 }],
    ['budgetMiB', 8], ['evict', 'off'], ['target', 'desktop'], ['source', 'loose'],
  ])('refuses a baseline with mismatched or missing %s', (field, value) => {
    expect(longTaskGate(tour('on'), { ...tour('off'), [field as string]: value }).status).toBe('UNMEASURED');
    expect(longTaskGate(tour('on'), { ...tour('off'), [field as string]: undefined }).status).toBe('UNMEASURED');
  });

  // Mutation: trust requested stream=default or ignore measured art mode.
  it('uses the actual loader mode and rejects an on baseline or contradictory mode samples', () => {
    expect(longTaskGate(tour('on'), tour('on')).status).toBe('UNMEASURED');
    const current = { ...tour('on'), stream: 'default', mode: 'store' };
    expect(longTaskGate(current, tour('off')).status).toBe('PASS');
    expect(longTaskGate({ ...current, stops: current.stops.map((stop) => ({ ...stop, art: { mode: 'queue' } })) }, tour('off')).status).toBe('UNMEASURED');
  });

  // Mutation: treat missing durations as [], or ignore failure on a truncated run.
  it('does not pass failed runs or absent observer evidence', () => {
    expect(longTaskGate({ ...tour('on'), failure: 'browser exited' }, tour('off')).status).toBe('UNMEASURED');
    expect(longTaskGate(tour('on'), { ...tour('off'), stops: [{ stop: 'menu' }, { stop: 'collection' }] }).status).toBe('UNMEASURED');
  });
});

describe('paired long-task medians', () => {
  const pair = (off: number[] = [80], on: number[] = [80]) => ({ off: tour('off', [[], off]), on: tour('on', [[], on]) });

  // Mutations: average-counts; trim-failing-pairs; count-boundary-strict.
  it('compares separate count medians including measured failing pairs and permits equality despite pair jitter', () => {
    const pairs = [[1, 2], [9, 8], [10, 100]].map(([off, on]) => pair(Array(off).fill(1000), Array(on).fill(100)));
    const result = longTaskMedianGate(pairs);
    expect(result.status).toBe('PASS');
    expect(result.baseline.medianCount).toBe(9);
    expect(result.candidate.medianCount).toBe(8);
    expect(result.pairs.map(p => p.status)).toEqual(['FAIL', 'PASS', 'FAIL']);
    expect(result.validPairs).toBe(3);
    const jitter = longTaskMedianGate([[8, 9], [9, 7], [7, 8]].map(([off, on]) => pair(Array(off).fill(1000), Array(on).fill(100))));
    expect(jitter.status).toBe('PASS');
    expect(jitter.baseline.medianCount).toBe(8);
    expect(jitter.candidate.medianCount).toBe(8);
  });

  // Mutation: omit-median-count-limit; compare only total duration or require both to increase.
  it('fails a higher median task count independently of a lower median duration', () => {
    const result = longTaskMedianGate([[2, 1], [2, 3], [20, 4]].map(([off, on]) => pair(Array(off).fill(1000), Array(on).fill(100))));
    expect(result.status).toBe('FAIL');
    expect(result.baseline.medianCount).toBe(2);
    expect(result.candidate.medianCount).toBe(3);
    expect(result.baseline.medianTotalMs).toBe(2000);
    expect(result.candidate.medianTotalMs).toBe(300);
  });

  // Mutations: average-durations; duration-boundary-strict; omit-median-duration-limit.
  it('compares median durations independently of counts without letting one expensive repeat decide the result', () => {
    const result = longTaskMedianGate([pair([600], [100]), pair([500], [400]), pair([200], [10000])]);
    expect(result.status).toBe('PASS');
    expect(result.baseline.medianTotalMs).toBe(500);
    expect(result.candidate.medianTotalMs).toBe(400);
    expect(longTaskMedianGate([pair([100], [100]), pair([300], [300]), pair([200], [200])]).status).toBe('PASS');
    const longer = longTaskMedianGate([pair([100, 100], [400]), pair([300, 300], [800]), pair([10000, 10000], [1000])]);
    expect(longer.status).toBe('FAIL');
    expect(longer.baseline.medianTotalMs).toBe(600);
    expect(longer.candidate.medianTotalMs).toBe(800);
    expect(longer.baseline.medianCount).toBe(2);
    expect(longer.candidate.medianCount).toBe(1);
  });

  // Mutation: accept-two-pairs; lower the minimum valid count to two.
  it('withholds the gate and medians until at least three pairs are measured', () => {
    for (const pairs of [[], [pair()], [pair(), pair()]]) {
      const result = longTaskMedianGate(pairs);
      expect(result.status).toBe('UNMEASURED');
      expect(result.candidate.medianCount).toBeNull();
      expect(result.baseline.medianTotalMs).toBeNull();
    }
  });

  // Mutations: ignore-cross-pair-version; require-current-probe-version.
  it('accepts consistently versioned older evidence and refuses mixed methods even when each pair is internally matched', () => {
    const pairs = [pair(), pair(), pair()];
    for (const p of pairs) p.on.probeVersion = p.off.probeVersion = 's6-retention-heap-v4';
    expect(longTaskMedianGate(pairs).status).toBe('PASS');
    pairs[2].on.probeVersion = pairs[2].off.probeVersion = 's6-desktop-dispatch-v5';
    const mixed = longTaskMedianGate(pairs);
    expect(mixed.validPairs).toBe(3);
    expect(mixed.status).toBe('UNMEASURED');
    expect(mixed.candidate.medianCount).toBeNull();
    // An invalid pair cannot conceal a different measurement version either.
    pairs[2].on.tourFixture.duelSeed++;
    const additional = [pair(), pair()];
    for (const p of additional) p.on.probeVersion = p.off.probeVersion = 's6-retention-heap-v4';
    pairs.push(...additional);
    expect(longTaskMedianGate(pairs).status).toBe('UNMEASURED');
  });

  // Mutations: count-invalid-pairs; skip-pair-fixture-check; require-cross-pair-fixtures.
  it('invalidates a mismatched fixture within its pair and uses only complete matched pairs for the median', () => {
    const pairs = [pair(), pair(), pair([80], [10000])];
    pairs[2].on.tourFixture.duelSeed++;
    const incomplete = longTaskMedianGate(pairs);
    expect(incomplete.status).toBe('UNMEASURED');
    expect(incomplete.validPairs).toBe(2);
    expect(incomplete.invalidPairs).toEqual([2]);
    expect(incomplete.pairs[2].valid).toBe(false);
    expect(incomplete.pairs[2].candidate.totalMs).toBe(10000);
    const replacement = pair();
    replacement.on.tourFixture.duelSeed = replacement.off.tourFixture.duelSeed = 100;
    const complete = longTaskMedianGate([...pairs, replacement]);
    expect(complete.status).toBe('PASS');
    expect(complete.validPairs).toBe(3);
    expect(complete.pairs[2].valid).toBe(false);
    expect(complete.candidate.medianTotalMs).toBe(80);
  });

  // Mutation: combine-tiers; omit the cross-pair art-tier check.
  it('keeps full and lite median verdicts separate even when every pair matches internally', () => {
    const pairs = [pair(), pair(), pair()];
    pairs[2].on.tier = pairs[2].off.tier = 'lite';
    const result = longTaskMedianGate(pairs);
    expect(result.validPairs).toBe(3);
    expect(result.status).toBe('UNMEASURED');
  });
});

describe('repeat timing summaries', () => {
  // Mutation: lexicographic sort, return the upper middle, or discard invalid values.
  it('calculates numeric odd/even medians without dropping invalid observations', () => {
    expect(median([90, 5, 100])).toBe(90);
    expect(median([30, 5, 10, 100])).toBe(20);
    expect(median([])).toBeNull();
    expect(median([20, null, 40])).toBeNull();
    expect(median([20, NaN, 40])).toBeNull();
  });

  // Mutation: return the first repeat or average instead of the median.
  it('reports medians from all requested measured repeats', () => {
    const result = summarizeTimings([timingRun({ enterToRealMs: 450 }), timingRun({ enterToRealMs: 100 }), timingRun({ enterToRealMs: 300 })], 3);
    expect(result.status).toBe('PASS');
    expect(result.validRepeats).toBe(3);
    expect(result.medians?.enterToRealMs).toBe(300);
    expect(result.medians?.navigationToRealMs).toBe(4400);
  });

  // Mutation: filter failed runs before counting N and computing medians.
  it('keeps failed attempts visible and withholds a median when any requested measurement is missing', () => {
    const result = summarizeTimings([timingRun(), { ...timingRun(), failure: 'browser exited' }, timingRun()], 3);
    expect(result.status).toBe('UNMEASURED');
    expect(result.attemptedRepeats).toBe(3);
    expect(result.validRepeats).toBe(2);
    expect(result.unmeasuredRuns).toEqual([1]);
    expect(result.medians).toBeNull();
    expect(summarizeTimings([timingRun(), timingRun()], 3).status).toBe('UNMEASURED');
  });

  // Mutation: decide the entire gate from a passing median while dropping slow repeats.
  it('retains a measured slow repeat as a failure even when its median meets the limit', () => {
    const result = summarizeTimings([timingRun({ enterToRealMs: 100 }), timingRun({ enterToRealMs: 600 }), timingRun({ enterToRealMs: 200 })], 3);
    expect(result.status).toBe('FAIL');
    expect(result.failedRuns).toEqual([1]);
    expect(result.validRepeats).toBe(3);
    expect(result.medians?.enterToRealMs).toBe(200);
  });
});
