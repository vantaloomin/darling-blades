import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import { runAvatarMatrix } from '../../scripts/balance-matrix';
import { deckOf, TEST_DB } from '../helpers';

/** Coherent two-color 40-card decks — skill decides games, not color screw. */
export function deckGR(): string[] {
  return deckOf([
    ['forest', 10],
    ['mountain', 6],
    ['bear', 4],
    ['elf', 3],
    ['giant', 4],
    ['rhino', 3],
    ['lord', 2],
    ['fox_mother', 2],
    ['hasty', 2],
    ['shock', 2],
    ['growth', 2],
  ]);
}

export function deckWB(): string[] {
  return deckOf([
    ['plains', 10],
    ['swamp', 6],
    ['knight', 4],
    ['sentinel', 3],
    ['cleric', 4],
    ['wall', 2],
    ['assassin', 4],
    ['drainer', 4],
    ['murder', 3],
  ]);
}

function playGame(
  seed: number,
  p0: AIPlayer,
  p1: AIPlayer,
): 0 | 1 | 'draw' {
  // alternate deck assignment too, so neither AI owns the better deck
  const decks: [string[], string[]] =
    seed % 4 < 2 ? [deckGR(), deckWB()] : [deckWB(), deckGR()];
  const game = new Game({ decks, seed, db: TEST_DB });
  const ais = [p0, p1];
  for (let i = 0; i < 30000; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') return game.state.winner!;
    const p = awaiting.player;
    game.submit(p, ais[p].chooseAction(game.viewFor(p), game.legalActions(p)));
  }
  throw new Error(`game ${seed} did not terminate`);
}

describe('AI win-rate gates', () => {
  it('Medium beats Easy ≥ 80% over 200 seeded games (sides alternate)', () => {
    let mediumWins = 0;
    let decided = 0;
    for (let seed = 0; seed < 200; seed++) {
      const mediumIsP0 = seed % 2 === 0;
      const medium = new MediumAI(TEST_DB);
      const easy = new EasyAI(TEST_DB, seed * 7 + 1);
      const winner = playGame(
        seed,
        mediumIsP0 ? medium : easy,
        mediumIsP0 ? easy : medium,
      );
      if (winner === 'draw') continue;
      decided++;
      if ((winner === 0) === mediumIsP0) mediumWins++;
    }
    const rate = mediumWins / decided;
    console.log(`Medium vs Easy: ${mediumWins}/${decided} = ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  it('Medium vs Medium terminates and stays legal (mini-fuzz)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const winner = playGame(seed + 1000, new MediumAI(TEST_DB), new MediumAI(TEST_DB));
      expect([0, 1, 'draw']).toContain(winner);
    }
  }, 60_000);

  it('Hard beats Medium ≥ 60% over 200 seeded games (sides alternate)', () => {
    let hardWins = 0;
    let decided = 0;
    for (let seed = 0; seed < 200; seed++) {
      const hardIsP0 = seed % 2 === 0;
      const hard = new HardAI(TEST_DB);
      const medium = new MediumAI(TEST_DB);
      const winner = playGame(seed + 5000, hardIsP0 ? hard : medium, hardIsP0 ? medium : hard);
      if (winner === 'draw') continue;
      decided++;
      if ((winner === 0) === hardIsP0) hardWins++;
    }
    const rate = hardWins / decided;
    console.log(`Hard vs Medium: ${hardWins}/${decided} = ${(rate * 100).toFixed(1)}%`);
    // TARGET: 0.60 (plan gate) — MET. Measured 78.0% on this suite
    // (2026-07-02): Hard hill-climbs block assignments (unblock/add/gang-up/
    // move), scores response casts with the engine sim, and runs the full-turn
    // attack lookahead. History: 62.5% from the block/response search alone;
    // +15pp from fixing HardAI's internal Medium brains to use simDb (raw-db
    // brains threw on __unknown_* stand-ins, silently collapsing every
    // lookahead world to -Infinity from ~turn 3 on); +0.5-1.5pp from
    // evidence-gating the trick model in both MediumAI.trickBuff and
    // HardAI.openManaBuff (no phantom +2/+2 tax until the opponent has shown
    // an instant — public graveyard only). Richer hidden-card opponent models
    // (lands, cost curves, held interaction) were measured and all LOST win
    // rate — see determinize.ts for the numbers. Floor set to 0.70 to leave
    // CI-variance margin (±3.5pp at 200 games) under the ~0.78 measured rate.
    expect(rate).toBeGreaterThanOrEqual(0.7);
  }, 600_000);

  it('Dark Tales summit rungs clear fresh 40-seed floors and terminate', () => {
    const report = runAvatarMatrix(40);
    const row = (id: string) => report.rows.find((entry) => entry.avatar.id === id);
    const r14 = row('artoria');
    const r15 = row('carmilla');
    const r16 = row('the-bride');
    const r17 = row('glass-coffin-queen');
    const r18 = row('abyssal-songstress');
    const r19 = row('queen-of-the-lanterned-roof');
    const r20 = row('kitsune-neon-tyrant');
    const r21 = row('anubis-who-holds-the-scale');
    const r22 = row('bastet-mistress-of-the-ninth-return');
    expect(r14).toBeDefined();
    expect(r15).toBeDefined();
    expect(r16).toBeDefined();
    expect(r17).toBeDefined();
    expect(r18).toBeDefined();
    expect(r19).toBeDefined();
    expect(r20).toBeDefined();
    expect(r21).toBeDefined();
    expect(r22).toBeDefined();
    if (!r14 || !r15 || !r16 || !r17 || !r18 || !r19 || !r20 || !r21 || !r22) return;

    // Floors re-centred 2026-07-31 from the W7 combined re-baseline at
    // 200 seeds/cell (w7 chain, post-balance-pass field: cap-4 blockers,
    // sweepers, tapland riders, tribal lords, Neon rebuild). Each floor is
    // the 200-seed average minus a full 40-seed noise band (6.5pp), per the
    // user-authorized one-time downward re-centre — CI stays 40 seeds with
    // margins that now sit OUTSIDE the noise instead of inside it.
    // 200-seed averages: R14 63% / R15 74% / R16 67% / R17 77% / R18 84% /
    // R19 62% / R20 71%. R18 is the measured summit; the R19 dip below R18
    // is a documented ladder inversion, accepted pending future set answers.
    expect(r15.avg, 'Carmilla floor').toBeGreaterThanOrEqual(0.675);
    expect(r16.avg, 'The Bride floor').toBeGreaterThanOrEqual(0.605);
    expect(r17.avg, 'Glass-Coffin Queen floor').toBeGreaterThanOrEqual(0.705);
    expect(r18.avg, 'Abyssal Songstress floor').toBeGreaterThanOrEqual(0.775);
    expect(r19.avg, 'Queen of the Lanterned Roof floor').toBeGreaterThanOrEqual(0.555);
    expect(r20.avg, 'Kitsune Neon Tyrant floor').toBeGreaterThanOrEqual(0.645);
    // Fresh 2026-08-21 Sands of the Duat full-ladder measurement, 40
    // seeds/cell: R21 Anubis 51.0% and R22 Bastet 77.0% (rung order swapped 2026-08-21; Anubis measured 57.5% at rung 22 before the swap - the per-cell seed stream follows the rung, so her post-swap sample is the canonical one). These floors leave roughly 5pp
    // below the measured averages after rounding down to the half point.
    expect(r21.avg, 'Anubis provisional floor').toBeGreaterThanOrEqual(0.46);
    expect(r22.avg, 'Bastet provisional floor').toBeGreaterThanOrEqual(0.72);
    expect(r15.avg, 'rung 15 must clear rung 14').toBeGreaterThan(r14.avg);
    // R16 vs R14 measured 67% vs 63% at 200 seeds — real but only 4pp, inside
    // 40-seed noise, so strict ordering would flake in CI. Tolerance gate.
    expect(r16.avg, 'rung 16 must not fall behind rung 14').toBeGreaterThanOrEqual(r14.avg - 0.05);
    expect(r17.avg, 'rung 17 must clear rung 16').toBeGreaterThan(r16.avg);
    expect(r18.avg, 'rung 18 must be the measured summit').toBeGreaterThan(r17.avg);
    expect(r20.avg, 'rung 20 must measure at or above rung 19').toBeGreaterThanOrEqual(r19.avg);
    for (const cell of [...r17.cells, ...r18.cells, ...r19.cells, ...r20.cells, ...r21.cells, ...r22.cells]) {
      expect(cell.draws, 'new boss cell must terminate decisively').toBe(0);
    }
  }, 900_000);
});
