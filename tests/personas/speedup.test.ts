import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getMeasureCacheStats,
  resetMeasureCache,
  runCli,
} from '../../scripts/personas/craft';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('persona measurement speedup', () => {
  it('keeps a real sequential metagame artifact byte-identical to parallel memoized output', () => {
    const sequentialDir = mkdtempSync(join(tmpdir(), 'darling-persona-sequential-'));
    const parallelDir = mkdtempSync(join(tmpdir(), 'darling-persona-parallel-'));
    tempDirs.push(sequentialDir, parallelDir);
    const common = [
      '--metagame', '--personas', 'burn,weenie', '--field', 'starters', '--pool', 'all',
      '--seeds', '1', '--iterations', '0', '--rounds', '1', '--seed', '424242',
    ];
    const cli = { today: () => '2026-07-26', log: () => undefined };

    resetMeasureCache();
    expect(runCli([...common, '--workers', '1', '--no-memo', '--out', sequentialDir], cli)).toBe(0);
    const names = [
      '2026-07-26-metagame-burn-all.json',
      '2026-07-26-metagame-weenie-all.json',
    ];
    const sequential = names.map((name) => readFileSync(join(sequentialDir, name), 'utf8'));

    resetMeasureCache();
    expect(runCli([...common, '--workers', '2', '--out', parallelDir], cli)).toBe(0);
    const parallel = names.map((name) => readFileSync(join(parallelDir, name), 'utf8'));
    expect(parallel).toEqual(sequential);

    // Repeating the same real run exercises the complete-input cache and
    // returns the same artifact bytes without simulating another game.
    expect(runCli([...common, '--workers', '2', '--out', parallelDir], cli)).toBe(0);
    expect(names.map((name) => readFileSync(join(parallelDir, name), 'utf8'))).toEqual(sequential);
    expect(getMeasureCacheStats().hits).toBeGreaterThan(0);
    expect(getMeasureCacheStats().simulatedGames).toBeGreaterThan(0);
  }, 120_000);
});
