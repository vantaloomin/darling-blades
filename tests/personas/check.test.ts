import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildGreedyDeck,
  cardsForPool,
  makeArtifact,
  runCli,
  runHillClimb,
  type MeasuredRecord,
} from '../../scripts/personas/craft';
import { personaTemplate } from '../../scripts/personas/templates';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const measured = (score: number): MeasuredRecord => ({
  field: 'starters',
  seeds: 1,
  matchups: [],
  rowWins: score === 0.75 ? 3 : 1,
  losses: score === 0.75 ? 1 : 1,
  draws: 0,
  games: score === 0.75 ? 4 : 2,
  score,
});

describe('--check artifact round trip', () => {
  it('reads a retained artifact and reports current measurement drift', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-check-'));
    tempDirs.push(dir);
    const template = personaTemplate('burn');
    const pool = cardsForPool('all');
    const initial = buildGreedyDeck(template, pool, 123);
    const result = runHillClimb({
      initial,
      pool,
      template,
      iterations: 0,
      seed: 123,
      measure: () => measured(0.5),
    });
    const artifact = makeArtifact(
      template,
      'all',
      { field: 'starters', seeds: 1, seed: 123, personaId: 'burn', iterations: 0 },
      result,
    );
    const path = join(dir, 'tiny.json');
    writeFileSync(path, JSON.stringify(artifact), 'utf8');
    const output: string[] = [];

    const exitCode = runCli(['--check', path], {
      measure: () => measured(0.75),
      log: (line) => output.push(line),
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual([
      'Checked tiny.json (burn)',
      'Retained: 50.0% (1/2 decided, 0 draws)',
      'Current: 75.0% (3/4 decided, 0 draws)',
      'Drift: 25.0 percentage points',
    ]);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(artifact);
  });

  it('rejects a malformed artifact without measuring it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-check-'));
    tempDirs.push(dir);
    const path = join(dir, 'bad.json');
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, deck: [] }), 'utf8');
    const errors: string[] = [];
    let measuredCalls = 0;
    const exitCode = runCli(['--check', path], {
      measure: () => {
        measuredCalls++;
        return measured(0.5);
      },
      error: (line) => errors.push(line),
    });
    expect(exitCode).toBe(1);
    expect(measuredCalls).toBe(0);
    expect(errors[0]).toContain('Invalid persona artifact');
  });
});
