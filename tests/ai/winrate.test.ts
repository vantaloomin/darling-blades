import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
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
});
