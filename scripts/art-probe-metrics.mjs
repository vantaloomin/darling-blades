// Pure measurements and verdicts for docs/plan-art-streaming.md section 6.
// Null means no measurement; a missing counter must never become a passing zero.
const measured = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const invalidTasks = () => ({ count: null, totalMs: null, durationsMs: null });
const verdict = (failures, missing) => failures.length ? 'FAIL' : missing.length ? 'UNMEASURED' : 'PASS';

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

/** Gate 1: the first menu is B, never the first sample that happens to be valid. */
export function memoryGate(run) {
  const failures = [];
  const missing = [];
  const stops = Array.isArray(run?.stops) ? run.stops : [];
  const allowanceMiB = run?.tier === 'full' ? 1000 : run?.tier === 'lite' ? 260 : null;
  if (allowanceMiB === null) missing.push('Unknown art tier');
  if (run?.failure !== null) missing.push('Run did not complete successfully');
  const first = stops[0]?.stop === 'menu' ? stops[0] : null;
  if (first === null) missing.push('First stop is not the menu baseline');
  const baseline = memoryAt(first);
  if (baseline.gpuMiB === null) missing.push('Menu GPU baseline is incomplete');
  if (baseline.rendererMiB === null) missing.push('Menu renderer baseline is incomplete');
  const gpuLimitMiB = baseline.gpuMiB !== null && allowanceMiB !== null ? baseline.gpuMiB + allowanceMiB : null;
  const rendererLimitMiB = baseline.rendererMiB !== null ? baseline.rendererMiB + 100 : null;
  const samples = stops.map((stop, index) => {
    const values = memoryAt(stop);
    const name = typeof stop?.stop === 'string' ? stop.stop : `sample ${index}`;
    if (values.gpuMiB === null) missing.push(`${name}: GPU counters are incomplete`);
    else if (gpuLimitMiB !== null && values.gpuMiB >= gpuLimitMiB) failures.push(`${name}: GPU memory is not below its limit`);
    if (values.rendererMiB === null) missing.push(`${name}: renderer counter is incomplete`);
    else if (rendererLimitMiB !== null && values.rendererMiB > rendererLimitMiB) failures.push(`${name}: renderer memory exceeds its limit`);
    return { stop: name, ...values };
  });
  return { status: verdict(failures, missing), reasons: [...failures, ...missing], baseline,
    gpuLimitMiB, rendererLimitMiB, stops: samples };
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
