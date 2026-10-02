import { describe, expect, it } from 'vitest';
import {
  bytesToMiB, collectionGate, longTaskGate, median, memoryGate, normalizeLongTasks, normalizeStop, summarizeTimings,
} from '../../scripts/art-probe-metrics.mjs';

const local = { downloadMbps: null, latencyMs: 0, cpuRate: 1 };
const memory = (stop: string, overrides: Record<string, unknown> = {}) => ({
  stop, gpuPrivateMiB: 100, gpuDedicatedMiB: 200, gpuSharedMiB: 50, rendererPrivateMiB: 400, ...overrides,
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
  stream, failure: null, tier: 'full', throttle: local, budgetMiB: null, evict: 'on', target: 'web', source: 'packs',
  tourFixture: { version: 's6-v1', opponentId: 'opponent-a', packCardIds: ['card-a', 'card-b'], draftPackIds: ['card-c', 'card-d'], duelSeed: 37 },
  stops: durations.map((longTasks, index) => ({ stop: index === 0 ? 'menu' : 'collection', longTasks })),
});

describe('probe memory gate', () => {
  // Mutation: change the GPU comparison from >= to >.
  it('rejects exact desktop GPU headroom and accepts a fractional MiB below it', () => {
    const check = (gpuPrivateMiB: number) => memoryGate({ failure: null, tier: 'full', stops: [memory('menu'), memory('collection', { gpuPrivateMiB })] });
    expect(check(1099.999).status).toBe('PASS');
    expect(check(1100).status).toBe('FAIL');
  });

  // Mutation: give lite the desktop 1000 MiB allowance.
  it('applies the smaller phone headroom to the complete GPU sum', () => {
    const check = (gpuPrivateMiB: number) => memoryGate({ failure: null, tier: 'lite', stops: [memory('menu'), memory('collection', { gpuPrivateMiB })] });
    expect(check(359.99).status).toBe('PASS');
    expect(check(360).status).toBe('FAIL');
  });

  // Mutation: omit the named GPU field from memoryAt's sum.
  it.each(['gpuPrivateMiB', 'gpuDedicatedMiB', 'gpuSharedMiB'])('counts growth in %s even when the other counters stay flat', (field) => {
    const baseline = memory('menu');
    const current = memory('collection', { [field]: Number(baseline[field as keyof typeof baseline]) + 1001 });
    expect(memoryGate({ failure: null, tier: 'full', stops: [baseline, current] }).status).toBe('FAIL');
  });

  // Mutation: make the renderer comparison inclusive (>=).
  it('allows exactly 100 MiB of renderer growth but fails any excess', () => {
    const check = (rendererPrivateMiB: number) => memoryGate({ failure: null, tier: 'full', stops: [memory('menu'), memory('duel', { rendererPrivateMiB })] });
    expect(check(500).status).toBe('PASS');
    expect(check(500.01).status).toBe('FAIL');
  });

  // Mutation: replace missing/null/nonfinite counters with zero in memoryAt.
  it.each(['gpuPrivateMiB', 'gpuDedicatedMiB', 'gpuSharedMiB', 'rendererPrivateMiB'])('leaves %s gaps unmeasured at either the baseline or a later stop', (field) => {
    for (const value of [undefined, null, NaN, Infinity, -1]) {
      for (const atBaseline of [true, false]) {
        const baseline = memory('menu', atBaseline ? { [field]: value } : {});
        const later = memory('collection', atBaseline ? {} : { [field]: value });
        expect(memoryGate({ failure: null, tier: 'full', stops: [baseline, later] }).status).toBe('UNMEASURED');
      }
    }
  });

  // Mutation: choose a later valid menu sample, or drop the completion check.
  it('never substitutes a later menu or treats an interrupted tour as complete', () => {
    expect(memoryGate({ failure: null, tier: 'full', stops: [memory('collection'), memory('menu')] }).status).toBe('UNMEASURED');
    expect(memoryGate({ failure: 'browser exited', tier: 'full', stops: [memory('menu')] }).status).toBe('UNMEASURED');
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
