export type GateStatus = 'PASS' | 'FAIL' | 'UNMEASURED';
export interface GateVerdict { status: GateStatus; reasons: string[] }
export interface LongTaskSummary { count: number | null; totalMs: number | null; durationsMs: number[] | null }
export interface MemorySample { gpuMiB: number | null; rendererMiB: number | null }
export interface CollectionTiming {
  navigationToBinderMs: number;
  navigationToLoadingGoneMs: number;
  navigationToRealMs: number;
  enterToBinderMs: number;
  enterToRealMs: number;
  binderFrame: number;
  expectedPockets: number;
  actualPockets: number;
}
export interface CollectionVerdict extends GateVerdict { measured: boolean; limitMs: number | null; timing: CollectionTiming | null }
export function bytesToMiB(bytes: unknown): number | null;
export function normalizeLongTasks(durations: unknown): LongTaskSummary;
export function normalizeStop<T extends object>(stop: T): Omit<T, 'longTasks' | 'longTaskTotalMs' | 'longTaskDurationsMs' | 'residentMiB' | 'pinnedMiB'> & {
  residentMiB: number | null;
  pinnedMiB: number | null;
  longTasks: number | null;
  longTaskTotalMs: number | null;
  longTaskDurationsMs: number[] | null;
};
export interface MemoryRunSummary {
  index: number;
  label: string | null;
  measurement: unknown;
  gpuPeakMiB: number | null;
  rendererPeakMiB: number | null;
  reasons: string[];
  valid: boolean;
  stops: Array<MemorySample & { stop: string | null; baseStop: string | null; loop: number | null }>;
}
export interface MemoryBlockSummary {
  expectedRepeats: number | null;
  attemptedRepeats: number;
  validRepeats: number;
  reasons: string[];
  runs: MemoryRunSummary[];
  medianGpuPeakMiB: number | null;
  medianRendererPeakMiB: number | null;
}
export function memoryGate(on: unknown, off?: unknown): GateVerdict & {
  tier: string | null;
  gpuFractionLimit: number | null;
  gpuPercentOfOff: number | null;
  gpuReductionPercent: number | null;
  rendererDeltaMiB: number | null;
  gpuLimitMiB: number | null;
  rendererLimitMiB: number | null;
  candidate: MemoryBlockSummary;
  baseline: MemoryBlockSummary | null;
};
export function loopMemoryGate(run: unknown): GateVerdict & {
  limits: { gpuMiB: number | null; rendererMiB: number | null };
  firstLoop: { loop: number; gpuPeakMiB: number | null; rendererPeakMiB: number | null } | null;
  loops: Array<{ loop: number; gpuPeakMiB: number | null; rendererPeakMiB: number | null }>;
};
export function collectionGate(run: unknown): CollectionVerdict;
export const spreadGate: typeof collectionGate;
export function longTaskGate(candidate: unknown, baseline: unknown): GateVerdict & { candidate: LongTaskSummary; baseline: LongTaskSummary };
export function longTaskMedianGate(pairs: unknown): GateVerdict & {
  probeVersion: string | null;
  tier: string | null;
  requiredPairs: number;
  attemptedPairs: number;
  validPairs: number;
  invalidPairs: number[];
  pairs: Array<ReturnType<typeof longTaskGate> & {
    index: number; onLabel: string | null; offLabel: string | null;
    versions: { on: string | null; off: string | null }; valid: boolean;
  }>;
  candidate: { medianCount: number | null; medianTotalMs: number | null };
  baseline: { medianCount: number | null; medianTotalMs: number | null };
};
export function median(values: unknown): number | null;
export function summarizeTimings(runs: unknown, expectedRepeats: number): {
  status: GateStatus;
  expectedRepeats: number;
  attemptedRepeats: number;
  validRepeats: number;
  failedRuns: number[];
  unmeasuredRuns: number[];
  medians: Pick<CollectionTiming, 'navigationToBinderMs' | 'navigationToLoadingGoneMs' | 'navigationToRealMs' | 'enterToBinderMs' | 'enterToRealMs'> | null;
  runs: Array<CollectionVerdict & { index: number; label: string | null }>;
};
