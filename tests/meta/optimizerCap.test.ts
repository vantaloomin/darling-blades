import { describe, expect, it } from 'vitest';
import { OPTIMIZER_PERSONA } from '../../scripts/optimizerPolicy';
import {
  PLAYER_PERSONAS,
  runProgressionSimulation,
  type ProgressAggregate,
} from '../../scripts/progression-sim';

const OPTIMIZER_CAP = 1.5;
const CI_SEEDS = 1;
const CI_DAYS = [5];
const HONEST_PERSONA_IDS = new Set(['completionist', 'hardcore-optimizer', 'high-skill-veteran']);
const CI_PERSONAS = [
  ...PLAYER_PERSONAS.filter((persona) => HONEST_PERSONA_IDS.has(persona.id)),
  OPTIMIZER_PERSONA,
];

function rewardGoldPerMinute(row: ProgressAggregate): number {
  const earned = row.goldEarned - row.rewards.starting;
  return row.sessionMinutes > 0 ? earned / row.sessionMinutes : 0;
}

describe('optimizer gold-per-minute cap', () => {
  // 90s runtime allowance: the sim measures ~22s alone but times out at the
  // 30s default under full-suite CPU contention (measured 2026-07-17). The
  // 1.5x cap assertion below is untouched; only the allowance moved.
  it('keeps the optimizer at or below 1.5x the best honest persona', () => {
    // Day 3 inflated honest g/min with one-time achievement bursts over a
    // short session horizon. A day-7 trial took 18.015s, above the roughly
    // 15s target, so use day 5 with the same canonical three leaders plus the
    // optimizer (20 persona-days, versus the old 33). The assertion uses
    // aggregate rows from runProgressionSimulation, not the analytic EV table.
    const started = process.hrtime.bigint();
    const report = runProgressionSimulation({
      seeds: CI_SEEDS,
      days: CI_DAYS,
      personas: CI_PERSONAS,
      baseSeed: 0x0a71_1a7e,
    });
    const wallClockMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const finalRows = report.aggregates.filter((row) => row.day === CI_DAYS[0]);
    const optimizer = finalRows.find((row) => row.personaId === OPTIMIZER_PERSONA.id);
    const honest = finalRows.filter((row) => row.personaId !== OPTIMIZER_PERSONA.id);
    const bestHonest = honest.reduce<ProgressAggregate | null>(
      (best, row) => (!best || rewardGoldPerMinute(row) > rewardGoldPerMinute(best) ? row : best),
      null,
    );

    expect(optimizer, 'optimizer checkpoint row').toBeDefined();
    expect(bestHonest, 'best honest checkpoint row').toBeDefined();
    const optimizerGoldPerMinute = rewardGoldPerMinute(optimizer!);
    const honestGoldPerMinute = rewardGoldPerMinute(bestHonest!);
    const ratio = honestGoldPerMinute > 0 ? optimizerGoldPerMinute / honestGoldPerMinute : Infinity;
    // Measured on 2026-07-15 after the 57-minute budget change: day-5
    // optimizer=9.880g/min with 250 session minutes, best honest
    // hardcore-optimizer=16.878825g/min, ratio=0.585349x, wall=15,591ms in
    // the standalone measurement probe.

    expect(
      ratio,
      `optimizer=${optimizerGoldPerMinute.toFixed(3)}g/min; best=${bestHonest!.personaId} ${honestGoldPerMinute.toFixed(3)}g/min; ratio=${ratio.toFixed(3)}x; wall=${wallClockMs.toFixed(0)}ms`,
    ).toBeLessThanOrEqual(OPTIMIZER_CAP);
  // CI runners are 2-core and can contend with other simulation tests; the
  // sim measures ~22s alone, so the 30s allowance flaked under load.
  }, 90_000);
});
