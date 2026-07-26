import { resolve } from 'node:path';
import { runCli, getMeasureCacheStats, resetMeasureCache } from './craft';

const mode = process.argv[2] ?? 'parallel';
const workers = Number(process.argv[3] ?? (mode === 'sequential' ? 1 : 4));
const outDir = resolve(process.argv[4] ?? `scripts/personas/.speedup-${mode}`);
if (mode !== 'sequential' && mode !== 'parallel') throw new Error(`Unknown benchmark mode: ${mode}`);

resetMeasureCache();
const started = process.hrtime.bigint();
const args = [
  '--persona', 'burn', '--field', 'starters', '--pool', 'all',
  '--seeds', '40', '--iterations', '10', '--seed', '13003',
  '--workers', String(workers), '--out', outDir,
  ...(mode === 'sequential' ? ['--no-memo'] : []),
];
const exitCode = runCli(args, { today: () => '2026-07-26', log: () => undefined });
const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
console.log(JSON.stringify({ mode, workers, exitCode, elapsedMs, cache: getMeasureCacheStats() }));
process.exitCode = exitCode;
