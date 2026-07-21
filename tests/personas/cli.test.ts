import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type MeasuredRecord, type PersonaArtifact } from '../../scripts/personas/craft';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const tiedMeasurement = (): MeasuredRecord => ({
  field: 'prefabs',
  seeds: 150,
  matchups: [],
  rowWins: 1,
  losses: 1,
  draws: 0,
  games: 2,
  score: 0.5,
});

describe('persona CLI defaults', () => {
  it('pins the approved 80 by 150 prefab budget in its artifact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-cli-'));
    tempDirs.push(dir);
    let measureCalls = 0;
    const exitCode = runCli(['--persona', 'burn', '--out', dir, '--seed', '22'], {
      measure: (_deck, options) => {
        measureCalls++;
        expect(options.field).toBe('prefabs');
        expect(options.seeds).toBe(150);
        return tiedMeasurement();
      },
      log: () => undefined,
      today: () => '2026-07-20',
    });
    const artifact = JSON.parse(
      readFileSync(join(dir, '2026-07-20-burn-all.json'), 'utf8'),
    ) as PersonaArtifact;

    expect(exitCode).toBe(0);
    expect(measureCalls).toBe(81);
    expect(artifact.iterations).toBe(80);
    expect(artifact.seeds).toBe(150);
    expect(artifact.field).toBe('prefabs');
    expect(artifact.referenceField).toHaveLength(9);
  });

  it('requires exactly one persona selection mode', () => {
    const errors: string[] = [];
    expect(runCli([], { error: (message) => errors.push(message) })).toBe(1);
    expect(errors).toEqual(['Choose exactly one of --persona <id> or --all']);
  });
});
