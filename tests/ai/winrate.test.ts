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

  it('summit rungs 14-22 clear their reserve-native 40-seed floors and terminate', () => {
    // Rungs 23-24 gate separately below: one 24-avatar matrix blew the 900s
    // per-test budget on CI hardware (2026-08-29), and the Starborne pair
    // carries no floors yet anyway (provisional until the tuning pass).
    const report = runAvatarMatrix(40, [
      'artoria', 'carmilla', 'the-bride', 'glass-coffin-queen',
      'abyssal-songstress', 'queen-of-the-lanterned-roof',
      'kitsune-neon-tyrant', 'anubis-who-holds-the-scale',
      'bastet-mistress-of-the-ninth-return',
    ]);
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

    // FLOORS RE-CENTRED 2026-08-23 on the reserve-native avatar matrix.
    //
    // Until this date runAvatarMatrix played `avatar.deck` vs `starter.cards`
    // - the CLASSIC lists - so this gate, the tower's only public win-rate
    // gate, priced a format retired on 2026-08-10. runFloorMatrix and the tier
    // dial rows were migrated the day classic retired; this harness was missed.
    // It is reserve-native now: each avatar's designed reserveDeck+landReserve
    // vs the shipped starter reserve builds, which is what DuelScene actually
    // seats for a gauntlet duel.
    //
    // The numbers below are therefore NOT comparable to the ones they replace,
    // and some floors moved DOWN. Nothing was lowered to make a change pass -
    // the old values measured a different game. Owner-authorized, same
    // one-time re-centre pattern as the 2026-07-31 W7 pass.
    //
    // Measured `--avatars --seeds 200` over rungs 14-22 (9,000 games), after
    // the two summit tunes below:
    //   R14 63 · R15 71 · R16 69 · R17 75 · R18 86 · R19 61 · R20 87 ·
    //   R21 57 · R22 75          FLAGS none
    // Each floor is that average minus the documented 6.5pp 40-seed noise
    // band, rounded down to the half point (CI runs this matrix at 40 seeds).
    expect(r15.avg, 'Carmilla floor').toBeGreaterThanOrEqual(0.645);
    // R16 The Bride was HAND-TUNED in this pass, 54% -> 69%. The converter's
    // curve cap {6:2} had halved her legend from the 4 copies her own classic
    // list runs, and left her a reanimator with nothing worth reanimating
    // (4x Stormtower Resurrection raising a 3/2). She had fallen BELOW rung
    // 14 on the reserve field; she no longer does.
    expect(r16.avg, 'The Bride floor').toBeGreaterThanOrEqual(0.625);
    expect(r17.avg, 'Glass-Coffin Queen floor').toBeGreaterThanOrEqual(0.685);
    expect(r18.avg, 'Abyssal Songstress floor').toBeGreaterThanOrEqual(0.795);
    expect(r19.avg, 'Queen of the Lanterned Roof floor').toBeGreaterThanOrEqual(0.545);
    expect(r20.avg, 'Kitsune Neon Tyrant floor').toBeGreaterThanOrEqual(0.805);
    // R21 Anubis HAND-TUNED 33% -> 57%. Her converter build retained four
    // cards targeting artifactOrEnchantment into a format whose starter
    // columns hold none, so a tenth of her deck was blank in every game. The
    // largest single lever afterwards was cheap removal: four of her ten
    // lands enter tapped and landReserve is pinned to the converter, so she
    // cannot buy that tempo back any other way. Evidence chain, including
    // every rejected draft, lives in her opponents.ts entry.
    expect(r21.avg, 'Anubis floor').toBeGreaterThanOrEqual(0.505);
    expect(r22.avg, 'Bastet floor').toBeGreaterThanOrEqual(0.685);
    expect(r15.avg, 'rung 15 must clear rung 14').toBeGreaterThan(r14.avg);
    // Restored 2026-08-23 as a genuine ordering check: R16 measures 69% to
    // R14's 63%, so the tolerance gate below is doing real work again rather
    // than papering over the format inversion it briefly carried.
    expect(r16.avg, 'rung 16 must not fall behind rung 14').toBeGreaterThanOrEqual(r14.avg - 0.05);
    expect(r17.avg, 'rung 17 must clear rung 16').toBeGreaterThan(r16.avg);
    expect(r18.avg, 'rung 18 must be the measured summit').toBeGreaterThan(r17.avg);
    expect(r20.avg, 'rung 20 must measure at or above rung 19').toBeGreaterThanOrEqual(r19.avg);
    for (const cell of [...r17.cells, ...r18.cells, ...r19.cells, ...r20.cells, ...r21.cells, ...r22.cells]) {
      expect(cell.draws, 'new boss cell must terminate decisively').toBe(0);
    }
  }, 900_000);

  it('Starborne rungs 23-24 field complete matrices and terminate decisively', () => {
    // Final `--avatars --seeds 200` table: R23 68% (50/82/59/71/77) and
    // R24 77% (64/87/59/82/94), with no draws. Floors use the same documented
    // 6.5pp noise band, rounded down to the half point: 61.5% and 70.5%.
    const report = runAvatarMatrix(40, ['chrome-broodmother', 'the-violet-signal-queen']);
    const row = (id: string) => report.rows.find((entry) => entry.avatar.id === id);
    const r23 = row('chrome-broodmother');
    const r24 = row('the-violet-signal-queen');
    expect(r23).toBeDefined();
    expect(r24).toBeDefined();
    if (!r23 || !r24) return;
    expect(r23.cells).toHaveLength(5);
    expect(r24.cells).toHaveLength(5);
    expect(r23.avg, 'Chrome Broodmother floor').toBeGreaterThanOrEqual(0.615);
    expect(r24.avg, 'Violet Signal Queen floor').toBeGreaterThanOrEqual(0.705);
    for (const cell of [...r23.cells, ...r24.cells]) {
      expect(cell.draws, 'new boss cell must terminate decisively').toBe(0);
    }
  }, 900_000);
});
