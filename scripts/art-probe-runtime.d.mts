export const PROBE_VERSION: string;
export interface ArtDispatchHold {
  readonly heldRequests: number;
  release(): void;
  dispose(): void;
}
export interface ArtDispatchScope {
  fetch: typeof fetch;
  URL: typeof URL;
  location: { href: string; origin: string };
  __probeArtFetch?: ArtDispatchHold;
}
export function installArtDispatchHold(scope: ArtDispatchScope): ArtDispatchHold;
export function configureProbeNetwork(send: (method: string, params?: Record<string, unknown>) => unknown | Promise<unknown>, conditions: Record<string, unknown>, reset?: boolean): Promise<void>;
export interface LongTaskScope {
  __longTasks?: number[] | null;
  __pauseProbeLongTasks?: () => number[] | null;
  __resumeProbeLongTasks?: () => void;
}
export function installLongTaskRecorder(scope: LongTaskScope, Observer: {
  supportedEntryTypes: string[];
  new (callback: (list: { getEntries(): Array<{ duration: number }> }) => void): {
    takeRecords(): Array<{ duration: number }>;
    disconnect(): void;
    observe(options: { type: string; buffered: boolean }): void;
  };
}): void;
export interface MemoryReading {
  gpuPrivateMiB: number | null;
  gpuDedicatedMiB: number | null;
  gpuSharedMiB: number | null;
  rendererPrivateMiB: number | null;
  jsHeapUsedMiB?: number | null;
  [key: string]: unknown;
}
export function retryMemorySample(read: () => unknown | Promise<unknown>, wait: (ms: number) => void | Promise<void>, options?: { attempts?: number; delayMs?: number }): Promise<MemoryReading & {
  memorySampling: { attempts: number; complete: boolean; observations: Array<MemoryReading & { complete: boolean }> };
}>;
export function sampleAfterGc<T> (io: {
  pauseLongTasks: () => T | Promise<T>;
  prepareMemory?: () => unknown | Promise<unknown>;
  collectGarbage: () => unknown | Promise<unknown>;
  wait: (ms: number) => void | Promise<void>;
  readMemory: () => unknown | Promise<unknown>;
  readHeapUsage: () => { usedSize?: number } | Promise<{ usedSize?: number }>;
  resumeLongTasks: () => unknown | Promise<unknown>;
}): Promise<{ longTasks: T; memory: Awaited<ReturnType<typeof retryMemorySample>> }>;
export function settleOwnedProcesses(pids: number[], io: {
  alive: (pid: number) => boolean;
  forceKill: (pid: number) => unknown | Promise<unknown>;
  wait: (ms: number) => void | Promise<void>;
  now: () => number;
}, options?: { graceMs?: number; forceWaitMs?: number; pollMs?: number }): Promise<{
  tracked: number[]; forced: number[]; killed: number[]; remaining: number[];
  forceErrors: Array<{ pid: number; error: string }>;
  warnings: Array<{ kind: string; pids: number[] }>;
}>;
