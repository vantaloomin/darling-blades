// Probe policy with injectable IO and clocks; no browser, Phaser or processes.
export const PROBE_VERSION = 's6-retention-heap-v4';
const counterNames = ['gpuPrivateMiB', 'gpuDedicatedMiB', 'gpuSharedMiB', 'rendererPrivateMiB'];
const measured = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Serialized into the page; injected dependencies keep the recorder testable. */
export function installLongTaskRecorder(scope, Observer) {
  scope.__longTasks = null;
  scope.__pauseProbeLongTasks = () => null;
  scope.__resumeProbeLongTasks = () => {};
  try {
    if (!Observer.supportedEntryTypes.includes('longtask')) return;
    let paused = false;
    const append = entries => {
      if (!paused) for (const entry of entries) if (entry.duration > 50) scope.__longTasks.push(entry.duration);
    };
    const observer = new Observer(list => append(list.getEntries()));
    scope.__longTasks = [];
    scope.__pauseProbeLongTasks = () => {
      append(observer.takeRecords());
      paused = true;
      observer.disconnect();
      // Transfer this interval to the runner; the page must not retain the
      // history of every stop in a long, single-navigation tour.
      return scope.__longTasks.splice(0);
    };
    scope.__resumeProbeLongTasks = () => {
      observer.takeRecords();
      paused = false;
      observer.observe({ type: 'longtask', buffered: false });
    };
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    scope.__longTasks = null;
    scope.__pauseProbeLongTasks = () => null;
    scope.__resumeProbeLongTasks = () => {};
  }
}

/**
 * Observe request events, without retaining response bodies for DevTools.
 * Chromium's NetworkResourcesData otherwise keeps bodies per request (up to
 * 200 MB on desktop), independently of the HTTP cache and art eviction.
 * Reset at idle stops to drop request metadata too; disable clears network
 * emulation, so restore it before letting gameplay continue. Node owns the
 * accumulated event counts. No browser HTTP cache is cleared here.
 */
export async function configureProbeNetwork(send, conditions, reset = false) {
  if (reset) await send('Network.disable');
  await send('Network.enable', { maxTotalBufferSize: 0, maxResourceBufferSize: 0, maxPostDataSize: 0 });
  await send('Network.emulateNetworkConditions', conditions);
}

/** Retry entire observations. Never splice counters from different attempts. */
export async function retryMemorySample(read, wait, { attempts = 3, delayMs = 150 } = {}) {
  if (!Number.isSafeInteger(attempts) || attempts < 1 || !measured(delayMs)) throw new Error('Invalid memory retry policy');
  const observations = [];
  let sample;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(delayMs);
    try { sample = await read(); }
    catch (error) { sample = { unavailable: [{ measurement: 'processMemory', reason: String(error) }] }; }
    sample = { ...sample, ...Object.fromEntries(counterNames.map(name => [name, measured(sample?.[name]) ? sample[name] : null])) };
    const complete = counterNames.every(name => measured(sample[name]));
    observations.push({ ...sample, complete });
    if (complete) break;
  }
  return { ...sample, memorySampling: { attempts: observations.length, complete: observations.at(-1).complete, observations } };
}

/** Snapshot gameplay first; diagnostic GC/waits/retries are outside attribution. */
export async function sampleAfterGc({ pauseLongTasks, prepareMemory = async () => {}, collectGarbage, wait, readMemory, readHeapUsage, resumeLongTasks }) {
  const longTasks = await pauseLongTasks();
  try {
    await prepareMemory();
    await collectGarbage();
    await wait(250);
    let jsHeapUsedMiB = null;
    let jsHeapUnavailable;
    try {
      const heap = await readHeapUsage();
      if (measured(heap?.usedSize)) jsHeapUsedMiB = heap.usedSize / 1048576;
      else jsHeapUnavailable = 'Runtime.getHeapUsage did not return a valid usedSize';
    } catch (error) { jsHeapUnavailable = String(error); }
    return { longTasks, memory: { ...await retryMemorySample(readMemory, wait), jsHeapUsedMiB,
      ...(jsHeapUnavailable ? { jsHeapUnavailable } : {}) } };
  } finally {
    await resumeLongTasks();
  }
}

/** Normal shutdown: allow graceful exit, force only stragglers, then verify. */
export async function settleOwnedProcesses(pids, { alive, forceKill, wait, now }, { graceMs = 15000, forceWaitMs = 5000, pollMs = 100 } = {}) {
  if (![graceMs, forceWaitMs, pollMs].every(measured) || pollMs === 0) throw new Error('Invalid cleanup timing');
  const tracked = [...new Set(pids.filter(pid => Number.isSafeInteger(pid) && pid > 0))];
  let remaining = tracked.filter(alive);
  const poll = async timeout => {
    const deadline = now() + timeout;
    while (remaining.length && now() < deadline) {
      await wait(Math.min(pollMs, deadline - now()));
      remaining = remaining.filter(alive);
    }
  };
  await poll(graceMs);
  const forced = [...remaining];
  const forceErrors = [];
  for (const pid of forced) {
    try { await forceKill(pid); }
    catch (error) { forceErrors.push({ pid, error: String(error) }); }
  }
  remaining = remaining.filter(alive);
  await poll(forceWaitMs);
  const killed = forced.filter(pid => !remaining.includes(pid));
  return { tracked, forced, killed, remaining, forceErrors,
    warnings: killed.length ? [{ kind: 'ownedProcessesForceKilled', pids: killed }] : [] };
}
