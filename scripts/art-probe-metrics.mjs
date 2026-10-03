// Pure measurements and verdicts for docs/plan-art-streaming.md section 6.
// Null means no measurement; a missing counter must never become a passing zero.
const measured = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const invalidTasks = () => ({ count: null, totalMs: null, durationsMs: null });
const verdict = (failures, missing) => failures.length ? 'FAIL' : missing.length ? 'UNMEASURED' : 'PASS';
const sameProbeVersion = (left, right) => typeof left === 'string' && left.trim().length > 0 && left === right;

export function bytesToMiB(bytes) {
  return measured(bytes) ? bytes / 1048576 : null;
}

/** Filter the original, unrounded durations. An unsupported observer is null. */
export function normalizeLongTasks(durations) {
  if (!Array.isArray(durations) || !durations.every(measured)) return invalidTasks();
  const durationsMs = durations.filter((duration) => duration > 50);
  const totalMs = durationsMs.reduce((sum, duration) => sum + duration, 0);
  return Number.isFinite(totalMs) ? { count: durationsMs.length, totalMs, durationsMs } : invalidTasks();
}

function stopTasks(stop) {
  if (Array.isArray(stop?.longTasks)) return normalizeLongTasks(stop.longTasks);
  const summary = normalizeLongTasks(stop?.longTaskDurationsMs);
  if (summary.count !== stop?.longTasks || summary.totalMs !== stop?.longTaskTotalMs) return invalidTasks();
  return summary;
}

/** Accept the original probe's arrays as well as the current flat JSON fields. */
export function normalizeStop(stop) {
  const tasks = stopTasks(stop);
  return {
    ...stop,
    residentMiB: bytesToMiB(stop?.art?.stats?.residentBytes),
    pinnedMiB: bytesToMiB(stop?.art?.stats?.pinnedBytes),
    longTasks: tasks.count,
    longTaskTotalMs: tasks.totalMs,
    longTaskDurationsMs: tasks.durationsMs,
  };
}

function memoryAt(stop) {
  const gpu = [stop?.gpuPrivateMiB, stop?.gpuDedicatedMiB, stop?.gpuSharedMiB];
  const sum = gpu.every(measured) ? gpu.reduce((total, value) => total + value, 0) : null;
  return {
    gpuMiB: measured(sum) ? sum : null,
    rendererMiB: measured(stop?.rendererPrivateMiB) ? stop.rendererPrivateMiB : null,
  };
}

function memorySamples(stops) {
  return stops.map((stop) => ({ stop: stop?.stop ?? null, baseStop: stop?.baseStop ?? null,
    loop: stop?.loop ?? null, ...memoryAt(stop) }));
}

function memoryPeaks(samples) {
  const peak = (field) => samples.length > 0 && samples.every((sample) => measured(sample[field]))
    ? Math.max(...samples.map((sample) => sample[field])) : null;
  return { gpuPeakMiB: peak('gpuMiB'), rendererPeakMiB: peak('rendererMiB') };
}

function tourShape(run) {
  const reasons = [];
  const stops = Array.isArray(run?.stops) ? run.stops : [];
  if (run?.failure !== null || (run?.signal !== undefined && run.signal !== null)
    || (run?.exitCode !== undefined && run.exitCode !== 0 && run.exitCode !== 1)
    || run?.cleanup?.remaining?.length > 0) reasons.push('Run is unfinished or interrupted');
  const validLoops = Number.isSafeInteger(run?.loops) && run.loops > 0 && run.loops <= stops.length;
  if (!validLoops || run?.tourCompletedLoops !== run?.loops) reasons.push('Completed tour loops are not proven');
  if (run?.timing === true || stops[0]?.stop !== 'menu' || stops[0]?.baseStop !== 'menu' || stops[0]?.loop !== 1) {
    reasons.push('A full tour must start at loop 1 menu');
  }
  const tail = stops.slice(-2);
  if (tail.length !== 2 || tail[0]?.loop !== null || tail[0]?.baseStop !== 'restored'
    || tail[1]?.loop !== null || tail[1]?.baseStop !== 'collection-after-restore') {
    reasons.push('Post-tour context restoration stops are incomplete');
  }
  if (stops.some((stop) => typeof stop?.stop !== 'string' || !stop.stop
    || typeof stop?.baseStop !== 'string' || !stop.baseStop)) reasons.push('Stop names are incomplete');
  const loopStops = stops.slice(0, -2);
  const groups = [];
  if (validLoops) {
    let previous = 1;
    for (const stop of loopStops) {
      if (!Number.isInteger(stop?.loop) || stop.loop < 1 || stop.loop > run.loops
        || stop.loop < previous || stop.loop > previous + 1) {
        reasons.push('Loop stops are missing or out of sequence');
        break;
      }
      previous = stop.loop;
    }
    for (let loop = 1; loop <= run.loops; loop++) {
      const group = loopStops.filter((stop) => stop?.loop === loop);
      groups.push({ loop, stops: group });
      if (group.length === 0 || group[0]?.baseStop !== 'menu' || group.at(-1)?.baseStop !== 'collection-again'
        || (loop > 1 && JSON.stringify(group.map((stop) => stop.baseStop)) !== JSON.stringify(groups[0].stops.map((stop) => stop.baseStop)))) {
        reasons.push(`Loop ${loop} does not contain the same complete ordered tour`);
      }
    }
  }
  return { reasons, stops, groups };
}

function measurementTimes(measurement) {
  const iso = (value) => typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
  if (!iso(measurement?.startedAt) || !iso(measurement?.finishedAt)) return null;
  const startedAt = Date.parse(measurement.startedAt);
  const finishedAt = Date.parse(measurement.finishedAt);
  return startedAt <= finishedAt ? { startedAt, finishedAt } : null;
}

function validMeasurement(measurement) {
  const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
  return hash(measurement?.buildId) && hash(measurement?.machineId)
    && measurement?.tourVersion === 's6-g1-v2' && measurementTimes(measurement) !== null;
}

function sameMemoryConfiguration(left, right) {
  const budget = (value) => value === null || (measured(value) && value > 0);
  return ['full', 'lite'].includes(left?.tier) && left.tier === right?.tier
    && sameThrottle(left?.throttle, right?.throttle)
    && budget(left?.budgetMiB) && left.budgetMiB === right?.budgetMiB
    && ['on', 'off'].includes(left?.evict) && left.evict === right?.evict
    && ['web', 'desktop'].includes(left?.target) && left.target === right?.target
    && ['packs', 'loose'].includes(left?.source) && left.source === right?.source
    && Number.isSafeInteger(left?.loops) && left.loops > 0 && left.loops === right?.loops;
}

function memoryBlock(input, expectedMode) {
  const parent = input !== null && typeof input === 'object' && Object.hasOwn(input, 'runs');
  const entries = parent ? (Array.isArray(input.runs) ? input.runs : []) : input == null ? [] : [input];
  const expectedRepeats = parent ? input.repeat : entries.length;
  const reasons = [];
  if (!Number.isSafeInteger(expectedRepeats) || expectedRepeats < 1 || entries.length !== expectedRepeats) {
    reasons.push('Requested repeat count is incomplete');
  }
  if (parent && input.failure != null) reasons.push('Repeat block did not finish');
  const runs = entries.map((run, index) => {
    const shape = tourShape(run);
    const samples = memorySamples(shape.stops);
    const peaks = memoryPeaks(samples);
    const issues = [...shape.reasons];
    if (!sameProbeVersion(input?.probeVersion, run?.probeVersion)) issues.push('Probe version is missing or does not match its repeat parent');
    if (peaks.gpuPeakMiB === null) issues.push('GPU counters are incomplete');
    if (peaks.rendererPeakMiB === null) issues.push('Renderer counters are incomplete');
    if (!validMeasurement(run?.measurement)) issues.push('Build, machine, tour version or measurement timestamps are incomplete');
    if (!sameMemoryConfiguration(run, run)) issues.push('Measurement configuration is incomplete');
    if (!sameTourFixture(run?.tourFixture, run?.tourFixture)) issues.push('Tour fixture is incomplete');
    const mode = actualMode(run);
    if (!['store', 'queue'].includes(mode) || (expectedMode !== null && mode !== expectedMode)) issues.push('Loader mode does not match this measurement block');
    return { index, label: run?.label ?? null, measurement: run?.measurement ?? null,
      ...peaks, reasons: issues, valid: issues.length === 0, stops: samples };
  });
  const validRepeats = runs.filter((run) => run.valid).length;
  for (const run of runs) for (const reason of run.reasons) reasons.push(`Run ${run.index + 1}: ${reason}`);
  const complete = reasons.length === 0;
  return { entries, summary: { expectedRepeats: Number.isSafeInteger(expectedRepeats) ? expectedRepeats : null,
    attemptedRepeats: entries.length, validRepeats, reasons, runs,
    medianGpuPeakMiB: complete ? median(runs.map((run) => run.gpuPeakMiB)) : null,
    medianRendererPeakMiB: complete ? median(runs.map((run) => run.rendererPeakMiB)) : null } };
}

/** Gate 1: matched off-then-on measurements; medians are taken after each run's peak. */
export function memoryGate(on, off) {
  const paired = off !== undefined && off !== null;
  const current = memoryBlock(on, paired ? 'store' : null);
  const before = paired ? memoryBlock(off, 'queue') : null;
  const candidate = current.summary;
  const baseline = before?.summary ?? null;
  const missing = [...candidate.reasons, ...(baseline?.reasons ?? [])];
  const failures = [];
  if (!paired) missing.push('A streaming-off measurement is required for comparison');
  if (paired && candidate.attemptedRepeats !== baseline.attemptedRepeats) missing.push('Measurement blocks have different repeat counts');
  const all = [...(before?.entries ?? []), ...current.entries];
  const reference = all[0];
  for (const run of all) {
    if (!sameProbeVersion(reference?.probeVersion, run?.probeVersion)) missing.push('Probe versions do not match across all attempts');
    if (!sameMemoryConfiguration(reference, run)) missing.push('Tier, throttle, budget, eviction, target, source or loop count does not match');
    if (!sameTourFixture(reference?.tourFixture, run?.tourFixture)) missing.push('Tour fixtures do not match across all attempts');
    const stopIdentity = (entry) => (Array.isArray(entry?.stops) ? entry.stops : []).map((stop) => [stop?.stop, stop?.baseStop, stop?.loop]);
    if (JSON.stringify(stopIdentity(reference)) !== JSON.stringify(stopIdentity(run))) missing.push('Ordered stop names or loop metadata do not match');
    if (!validMeasurement(reference?.measurement) || !validMeasurement(run?.measurement)
      || reference.measurement.buildId.toLowerCase() !== run.measurement.buildId.toLowerCase()
      || reference.measurement.machineId.toLowerCase() !== run.measurement.machineId.toLowerCase()
      || reference.measurement.tourVersion !== run.measurement.tourVersion) missing.push('Build, machine or tour version does not match across all attempts');
  }
  if (paired && before.entries.length > 0 && current.entries.length > 0
    && all.every((run) => measurementTimes(run?.measurement) !== null)) {
    const latestOffFinish = Math.max(...before.entries.map((run) => measurementTimes(run.measurement).finishedAt));
    const earliestOnStart = Math.min(...current.entries.map((run) => measurementTimes(run.measurement).startedAt));
    if (latestOffFinish > earliestOnStart) missing.push('All streaming-off attempts must finish before any streaming-on attempt starts');
  }
  const tier = current.entries[0]?.tier ?? null;
  const gpuFractionLimit = tier === 'full' ? 0.6 : tier === 'lite' ? 0.7 : null;
  if (baseline?.medianGpuPeakMiB === 0) missing.push('Streaming-off GPU median is zero, so percentage reduction is undefined');
  let gpuLimitMiB = null;
  let rendererLimitMiB = null;
  let gpuPercentOfOff = null;
  let gpuReductionPercent = null;
  let rendererDeltaMiB = null;
  if (missing.length === 0) {
    gpuLimitMiB = baseline.medianGpuPeakMiB * gpuFractionLimit;
    rendererLimitMiB = baseline.medianRendererPeakMiB + 100;
    gpuPercentOfOff = candidate.medianGpuPeakMiB / baseline.medianGpuPeakMiB * 100;
    gpuReductionPercent = 100 - gpuPercentOfOff;
    rendererDeltaMiB = candidate.medianRendererPeakMiB - baseline.medianRendererPeakMiB;
    if (candidate.medianGpuPeakMiB * 100 > baseline.medianGpuPeakMiB * (tier === 'full' ? 60 : 70)) failures.push('Median GPU peak exceeds the streaming-off percentage limit');
    if (candidate.medianRendererPeakMiB > rendererLimitMiB) failures.push('Median renderer peak exceeds streaming-off by more than 100 MiB');
  }
  return { status: missing.length ? 'UNMEASURED' : verdict(failures, []), reasons: [...missing, ...failures],
    tier, gpuFractionLimit, gpuPercentOfOff, gpuReductionPercent, rendererDeltaMiB, gpuLimitMiB, rendererLimitMiB, candidate, baseline };
}

/** Repeated same-page stress tours must plateau before the final context restore. */
export function loopMemoryGate(run) {
  const shape = tourShape(run);
  const missing = [...shape.reasons];
  const failures = [];
  if (run?.budgetMiB !== 8 || run?.evict !== 'on' || actualMode(run) !== 'store' || run?.target !== 'web'
    || !Number.isInteger(run?.loops) || run.loops < 2) missing.push('Loop comparison requires at least two web streaming stress tours with eviction enabled');
  const proof = run?.tourEvidence?.loopContinuity;
  if (proof?.samePage !== true || !measured(proof?.navigationTimeOrigin) || proof.navigationTimeOrigin <= 0
    || proof?.contextRestoresAfterLoops !== true) missing.push('Same-page execution without an intervening context restore is not proven');
  const loops = shape.groups.map(({ loop, stops }) => ({ loop, ...memoryPeaks(memorySamples(stops)) }));
  if (loops.some((loop) => loop.gpuPeakMiB === null || loop.rendererPeakMiB === null)) missing.push('Loop memory counters are incomplete');
  const firstLoop = loops[0] ?? null;
  const limits = { gpuMiB: firstLoop?.gpuPeakMiB == null ? null : firstLoop.gpuPeakMiB + 100,
    rendererMiB: firstLoop?.rendererPeakMiB == null ? null : firstLoop.rendererPeakMiB + 100 };
  if (missing.length === 0) {
    for (const loop of loops.slice(1)) {
      if (loop.gpuPeakMiB > limits.gpuMiB) failures.push(`Loop ${loop.loop} GPU peak exceeds loop 1 by more than 100 MiB`);
      if (loop.rendererPeakMiB > limits.rendererMiB) failures.push(`Loop ${loop.loop} renderer peak exceeds loop 1 by more than 100 MiB`);
    }
  }
  return { status: missing.length ? 'UNMEASURED' : verdict(failures, []), reasons: [...missing, ...failures], limits, firstLoop, loops };
}

function validThrottle(throttle) {
  return throttle !== null && typeof throttle === 'object'
    && (throttle.downloadMbps === null || (measured(throttle.downloadMbps) && throttle.downloadMbps > 0))
    && measured(throttle.latencyMs) && measured(throttle.cpuRate) && throttle.cpuRate >= 1;
}

const timingFields = ['navigationToBinderMs', 'navigationToLoadingGoneMs', 'navigationToRealMs', 'enterToBinderMs', 'enterToRealMs'];

/** Gate 2 uses the dedicated cold Collection entry, not warm tour page turns. */
export function collectionGate(run) {
  const missing = [];
  const failures = [];
  const timing = run?.collectionTiming;
  if (run?.failure !== null) missing.push('Run did not complete successfully');
  if (!validThrottle(run?.throttle)) missing.push('Throttle configuration is incomplete');
  const limitMs = validThrottle(run?.throttle)
    ? (run.throttle.downloadMbps !== null || run.throttle.latencyMs > 0 || run.throttle.cpuRate > 1 ? 2000 : 500)
    : null;
  if (!timing || !timingFields.every((field) => measured(timing[field]))
    || !Number.isInteger(timing.binderFrame) || timing.binderFrame < 1
    || !Number.isInteger(timing.expectedPockets) || !Number.isInteger(timing.actualPockets)
    || timing.expectedPockets < 0 || timing.actualPockets < 0
    || timing.enterToRealMs < timing.enterToBinderMs || timing.navigationToRealMs < timing.navigationToBinderMs) {
    missing.push('Cold Collection timing is incomplete or inconsistent');
  } else {
    if (timing.expectedPockets !== 12 || timing.actualPockets !== 12) failures.push('First spread does not contain twelve real pockets');
    if (timing.binderFrame > 1) failures.push('Binder did not draw on its first frame');
    if (limitMs !== null && timing.enterToRealMs > limitMs) failures.push('First real spread exceeds the latency limit');
  }
  return { status: verdict(failures, missing), measured: missing.length === 0, reasons: [...failures, ...missing], limitMs,
    timing: timing ?? null };
}

export const spreadGate = collectionGate;

function sameThrottle(left, right) {
  return validThrottle(left) && validThrottle(right)
    && left.downloadMbps === right.downloadMbps && left.latencyMs === right.latencyMs && left.cpuRate === right.cpuRate;
}

function actualMode(run) {
  const modes = (Array.isArray(run?.stops) ? run.stops : []).map((stop) => stop?.art?.mode).filter((mode) => mode !== undefined);
  if (run?.mode !== undefined) modes.push(run.mode);
  if (modes.length) return modes.every((mode) => mode === modes[0]) ? modes[0] : null;
  return run?.stream === 'on' ? 'store' : run?.stream === 'off' ? 'queue' : null;
}

function taskTotals(stops) {
  if (!Array.isArray(stops) || stops.length === 0) return invalidTasks();
  const samples = stops.map(stopTasks);
  if (samples.some((sample) => sample.durationsMs === null)) return invalidTasks();
  return normalizeLongTasks(samples.flatMap((sample) => sample.durationsMs));
}

function sameTourFixture(left, right) {
  const cardIds = (values) => Array.isArray(values) && values.length > 0
    && values.every((value) => typeof value === 'string' && value.trim().length > 0);
  const valid = (fixture) => fixture?.version === 's6-v1'
    && typeof fixture.opponentId === 'string' && fixture.opponentId.trim().length > 0
    && cardIds(fixture.packCardIds) && cardIds(fixture.draftPackIds)
    && Number.isSafeInteger(fixture.duelSeed) && fixture.duelSeed >= 0;
  return valid(left) && valid(right) && left.opponentId === right.opponentId && left.duelSeed === right.duelSeed
    && JSON.stringify(left.packCardIds) === JSON.stringify(right.packCardIds)
    && JSON.stringify(left.draftPackIds) === JSON.stringify(right.draftPackIds);
}

/** Gate 5 is meaningful only for the same complete ordered tour and conditions. */
export function longTaskGate(candidate, baseline) {
  const missing = [];
  const failures = [];
  if (!sameProbeVersion(candidate?.probeVersion, baseline?.probeVersion)) missing.push('Probe versions are missing or do not match');
  if (candidate?.failure !== null || baseline?.failure !== null) missing.push('Both runs must complete successfully');
  if (!sameTourFixture(candidate?.tourFixture, baseline?.tourFixture)) missing.push('Tour fixtures are incomplete or do not match');
  if (actualMode(candidate) !== 'store' || actualMode(baseline) !== 'queue') missing.push('Comparison needs streaming on and a streaming-off baseline');
  if (!['full', 'lite'].includes(candidate?.tier) || candidate?.tier !== baseline?.tier) missing.push('Art tiers do not match');
  if (!sameThrottle(candidate?.throttle, baseline?.throttle)) missing.push('Throttle configurations do not match');
  const budgetValid = (value) => value === null || (measured(value) && value > 0);
  if (!budgetValid(candidate?.budgetMiB) || candidate?.budgetMiB !== baseline?.budgetMiB) missing.push('Art budgets do not match');
  for (const [field, allowed] of [['evict', ['on', 'off']], ['target', ['web', 'desktop']], ['source', ['packs', 'loose']]]) {
    if (!allowed.includes(candidate?.[field]) || candidate?.[field] !== baseline?.[field]) missing.push(`${field} configurations do not match`);
  }
  const candidateStops = Array.isArray(candidate?.stops) ? candidate.stops : [];
  const baselineStops = Array.isArray(baseline?.stops) ? baseline.stops : [];
  if (candidateStops.length === 0 || candidateStops.length !== baselineStops.length
    || candidateStops.some((stop, index) => typeof stop?.stop !== 'string' || !stop.stop || stop.stop !== baselineStops[index]?.stop)) {
    missing.push('Ordered tour stops do not match');
  }
  const current = taskTotals(candidateStops);
  const before = taskTotals(baselineStops);
  if (current.count === null || before.count === null) missing.push('Long-task measurements are incomplete');
  // A mismatched tour can report its totals, but cannot prove a regression or a pass.
  if (missing.length === 0) {
    if (current.count > before.count) failures.push('Long-task count increased');
    if (current.totalMs > before.totalMs) failures.push('Long-task total duration increased');
  }
  return { status: verdict(failures, missing), reasons: [...failures, ...missing], candidate: current, baseline: before };
}

/** An invalid observation invalidates the median; no outlier or failure trimming. */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0 || !values.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : ordered[middle - 1] / 2 + ordered[middle] / 2;
}

/** Keep every attempted run in the verdict; publish medians only for all N repeats. */
export function summarizeTimings(runs, expectedRepeats) {
  const entries = Array.isArray(runs) ? runs : [];
  const results = entries.map((run, index) => ({ index, label: run?.label ?? null, ...collectionGate(run) }));
  const unmeasuredRuns = results.filter((result) => !result.measured);
  const failedRuns = results.filter((result) => result.status === 'FAIL');
  const complete = Number.isInteger(expectedRepeats) && expectedRepeats > 0 && entries.length === expectedRepeats && unmeasuredRuns.length === 0;
  const medians = complete ? Object.fromEntries(timingFields.map((field) => [field, median(entries.map((run) => run.collectionTiming[field]))])) : null;
  return {
    status: failedRuns.length ? 'FAIL' : complete ? 'PASS' : 'UNMEASURED',
    expectedRepeats, attemptedRepeats: entries.length, validRepeats: entries.length - unmeasuredRuns.length,
    failedRuns: failedRuns.map((run) => run.index), unmeasuredRuns: unmeasuredRuns.map((run) => run.index),
    medians, runs: results,
  };
}
