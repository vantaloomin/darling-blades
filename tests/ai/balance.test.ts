import { describe, expect, it } from 'vitest';
import {
  RUNG_BANDS,
  runAvatarMatrix,
  runDifficultyMatrix,
  runStarterMatrix,
} from '../../scripts/balance-matrix';

/**
 * SUITE E — Balance tool (SKIPPED BY DEFAULT so CI stays fast).
 *
 * Thin vitest wrapper around the balance-matrix harness in
 * scripts/balance-matrix.ts. The CLI (`npm run balance-matrix -- --avatars`)
 * and this suite share the same runner code and per-cell seed offsets, so the
 * two tools always print the same numbers for the same code.
 *
 * HOW TO RUN:
 *   npx vitest run tests/ai/balance.test.ts -t "avatar"
 *   (or temporarily change `describe.skip` below to `describe.only`)
 *
 * Guidance bands (RUNG_BANDS in the harness, from the balance plan):
 *   - rungs 1-3 (Easy) ≤ ~45% AI-wins vs a neutral Medium proxy piloting each
 *     of the FIVE starter decks, and no single starter near-hopeless vs them;
 *   - rung 8 ≥ ~55%;
 *   - a roughly monotonic ramp in between (12pp inversion tolerance).
 * The dated baseline matrix lives in a comment block in src/data/opponents.ts
 * — re-measure and update it after any tuning pass.
 *
 * Everything is seed-deterministic: these assertions cannot flake, they only
 * move when engine/AI/deck code changes — which is exactly the regression
 * signal this tool exists to catch.
 */
describe.skip('gauntlet balance matrices (manual tool)', () => {
  it('avatar × starter matrix stays inside the guidance bands (40 seeds/cell)', () => {
    const report = runAvatarMatrix(40);
    console.log('\n' + report.table);
    if (report.flags.length > 0) {
      console.log('FLAGS:\n' + report.flags.map((f) => `  ! ${f}`).join('\n'));
    }
    expect(report.rows).toHaveLength(16);
    // The plan's hard floors/ceilings, with a small allowance beyond the
    // in-harness bands so a marginal cell reads as a flag before a failure.
    for (const row of report.rows) {
      const band = RUNG_BANDS[row.avatar.tier] ?? {};
      if (band.maxAvg !== undefined) {
        expect(row.avg, `rung ${row.avatar.tier} (${row.avatar.name}) too strong`).toBeLessThanOrEqual(band.maxAvg + 0.05);
      }
      if (band.minAvg !== undefined) {
        expect(row.avg, `rung ${row.avatar.tier} (${row.avatar.name}) too weak`).toBeGreaterThanOrEqual(band.minAvg - 0.05);
      }
    }
  }, 900_000);

  it('starter mirror matrix has no crushed matchup (40 seeds/cell)', () => {
    const report = runStarterMatrix(40);
    console.log('\n' + report.table);
    if (report.flags.length > 0) {
      console.log('FLAGS:\n' + report.flags.map((f) => `  ! ${f}`).join('\n'));
    }
    // Flags fire at 25/75 (informational — precon spice is fine); the hard
    // failure line is a truly crushed pairing.
    for (const row of report.cells) {
      for (const cell of row) {
        expect(cell.rate).toBeGreaterThanOrEqual(0.15);
        expect(cell.rate).toBeLessThanOrEqual(0.85);
      }
    }
  }, 900_000);

  it('difficulty round-robin escalates on a fixed starter pair (40 seeds/cell)', () => {
    const report = runDifficultyMatrix(40);
    console.log('\n' + report.table);
    // rows/cols are [easy, medium, hard]; higher brains beat lower ones.
    expect(report.cells[1][0].rate, 'medium vs easy').toBeGreaterThanOrEqual(0.5);
    expect(report.cells[2][0].rate, 'hard vs easy').toBeGreaterThanOrEqual(0.5);
    expect(report.cells[2][1].rate, 'hard vs medium').toBeGreaterThanOrEqual(0.5);
    expect(report.flags).toEqual([]);
  }, 900_000);
});
