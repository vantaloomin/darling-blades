// Probe policy with injectable IO and clocks; no browser, Phaser or processes.
export const PROBE_VERSION = 's6-g1-gc-retry-v3';
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
      return scope.__longTasks.slice();
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
export async function sampleAfterGc({ pauseLongTasks, collectGarbage, wait, readMemory, resumeLongTasks }) {
  const longTasks = await pauseLongTasks();
  try {
    await collectGarbage();
    await wait(250);
    return { longTasks, memory: await retryMemorySample(readMemory, wait) };
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
