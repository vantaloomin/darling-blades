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

/** Keep the measured matrix values visible beside the existing assertions. */
function reportAvatarRates(report: ReturnType<typeof runAvatarMatrix>): void {
  for (const row of report.rows) {
    const wins = row.cells.reduce((sum, cell) => sum + cell.rowWins, 0);
    const games = row.cells.reduce((sum, cell) => sum + cell.games, 0);
    const draws = row.cells.reduce((sum, cell) => sum + cell.draws, 0);
    console.log(`R${row.avatar.tier} ${row.avatar.name}: ${wins}/${games - draws}, ` +
      `mean ${(row.avg * 100).toFixed(1)}%, ${draws} draws (${row.cells.length} cells, 40 seeds/cell)`);
  }
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
    // Rungs 23-24 and 25-26 gate separately below: one 24-avatar matrix blew
    // the 900s per-test budget on CI hardware (2026-08-29), so the summit is
    // split across three gates. All six carry real floors since 2026-09-17.
    const report = runAvatarMatrix(40, [
      'artoria', 'carmilla', 'the-bride', 'glass-coffin-queen',
      'abyssal-songstress', 'queen-of-the-lanterned-roof',
      'kitsune-neon-tyrant', 'anubis-who-holds-the-scale',
      'bastet-mistress-of-the-ninth-return',
    ]);
    reportAvatarRates(report);
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
    //
    // RUNGS 14-20 RE-BASELINED 2026-09-19 on the final 1.8 pool, after the AI
    // modernization, the land-economy conversion and every tuning pass. Same
    // harness and per-(rung, starter) seeding as this gate, 200 seeds/cell,
    // one process per avatar, FLAGS none; cells in
    // Muster/Communion/Tides/Mandate/Harvest order:
    //   R14 27/91/66/75/71 avg 65.6 · R15 61/78/52/85/86 avg 72.3
    //   R16 57/73/51/79/83 avg 68.6 · R17 70/76/62/94/85 avg 77.3
    //   R18 88/93/73/95/95 avg 88.5 · R19 40/75/49/59/71 avg 58.6 (1 draw)
    //   R20 74/70/82/91/92 avg 81.6
    // Same minus-6.5pp convention, and the ratchet: a candidate under the
    // standing floor is recorded, never applied.
    //   R15 Carmilla 72.3 -> 65.5, RATCHETS UP from 0.645.
    //   R16 The Bride 68.6 -> 62.0, below the standing 0.625, KEPT.
    //   R17 Glass-Coffin Queen 77.3 -> 70.5, RATCHETS UP from 0.685.
    //   R18 Abyssal Songstress 88.5 -> 82.0, RATCHETS UP from 0.795. Her
    //       margin was 1.5pp at the 2026-08-30 reading; it is 6.5 again.
    //   R19 Queen of the Lanterned Roof 58.6 -> 52.0, below 0.545, KEPT. Her
    //       margin over her own floor is 4.1pp, inside the 6.5pp band.
    //   R20 Kitsune Neon Tyrant 81.6 -> 75.0, below 0.805, KEPT. FINDING for
    //       the owner: she read 87 on 2026-08-23 and 84 after AI phase C, and
    //       81.6 now leaves 1.1pp between her 200-seed mean and her floor, the
    //       narrowest margin on the ladder. Muster (74) and Communion (70) are
    //       her soft columns. She is the next deck owed a measured tuning
    //       pass, the same position Chrome Broodmother was in on 2026-09-17.
    //   R14 Artoria has no absolute floor; 65.6, Muster 27 her one bad column.
    //
    // R20 KITSUNE TUNED 2026-09-19, the same day, closing that finding. The
    // converter had dropped her four authored Redline Queenpins and doubled her
    // Hauntlink package; restoring the authored 4/2/2 (her entry in
    // src/data/opponents.ts has the full pass, the usage measurement and the
    // 14-deck confirmation) reads 79/84/87/97/95 avg 88.3 on the committed
    // list at 200 seeds/cell, one draw in 1,000 games. 88.3 - 6.5 = 81.8, so
    // her floor RATCHETS UP 0.805 -> 0.815; CI's 40 seeds read 90.5, 0 draws.
    expect(r15.avg, 'Carmilla floor').toBeGreaterThanOrEqual(0.655);
    // R16 The Bride was HAND-TUNED in this pass, 54% -> 69%. The converter's
    // curve cap {6:2} had halved her legend from the 4 copies her own classic
    // list runs, and left her a reanimator with nothing worth reanimating
    // (4x Stormtower Resurrection raising a 3/2). She had fallen BELOW rung
    // 14 on the reserve field; she no longer does.
    expect(r16.avg, 'The Bride floor').toBeGreaterThanOrEqual(0.625);
    expect(r17.avg, 'Glass-Coffin Queen floor').toBeGreaterThanOrEqual(0.705);
    expect(r18.avg, 'Abyssal Songstress floor').toBeGreaterThanOrEqual(0.82);
    expect(r19.avg, 'Queen of the Lanterned Roof floor').toBeGreaterThanOrEqual(0.545);
    expect(r20.avg, 'Kitsune Neon Tyrant floor').toBeGreaterThanOrEqual(0.815);
    // R21 Anubis HAND-TUNED 33% -> 57%. Her converter build retained four
    // cards targeting artifactOrEnchantment into a format whose starter
    // columns hold none, so a tenth of her deck was blank in every game. The
    // largest single lever afterwards was cheap removal: four of her ten
    // lands enter tapped and landReserve is pinned to the converter, so she
    // cannot buy that tempo back any other way. Evidence chain, including
    // every rejected draft, lives in her opponents.ts entry.
    //
    // RUNGS 21-22 RE-BASELINED 2026-09-17, after the AI modernization (phases
    // E, A, B, C, D) and the tuning passes that followed all landed on
    // release/1.8. Rungs 14-20 were NOT re-measured in that pass and keep the
    // 2026-08-23 floors above. Measured with one command,
    // `--avatars --seeds 200 --only <the six summit ids>` (6,000 games,
    // 1,433 s, FLAGS none); cells in Muster/Communion/Tides/Mandate/Harvest
    // order, every cell 200 decided games and zero draws in the whole run:
    //   R21 71/79/67/61/46 avg 65 · R22 54/85/61/84/85 avg 74
    //
    // R21 Anubis: 65 - 6.5 = 58.5, so the floor RATCHETS UP 0.505 -> 0.585.
    // She read 57 at the 2026-08-23 re-centre and 61 on the 2026-08-29 full
    // table; the summit brains gained more from the AI pass than the
    // Medium-piloted starter columns did. Harvest (46) stays her weak column.
    expect(r21.avg, 'Anubis floor').toBeGreaterThanOrEqual(0.585);
    // R22 Bastet: 74 - 6.5 = 67.5, which is BELOW the standing 0.685 floor,
    // so the floor is KEPT at 0.685 - floors only ratchet up, and a candidate
    // under the current value is recorded, not applied. Her 2026-09-16 tuning
    // pass measured 73.60 on this harness; 74 here is the same number inside
    // the table's whole-percent rounding.
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

  it('Starborne rungs 23-24 clear their floors and field complete matrices', () => {
    // RE-BASELINED 2026-09-17 on the post-AI-modernization ladder, same
    // command and run as rungs 21-22 above (`--avatars --seeds 200 --only
    // <the six summit ids>`, 6,000 games, 1,433 s, FLAGS none); cells in
    // Muster/Communion/Tides/Mandate/Harvest order, 200 decided, 0 draws:
    //   R23 42/85/55/59/63 avg 60 · R24 51/88/64/62/91 avg 71
    // Superseded 2026-08-30 reading, kept for the delta: R23 65
    // (46/83/59/60/77) and R24 68 (45/87/59/57/94).
    // R23 RE-TUNED 2026-09-19 (four Ashwood Rangers, her entry in
    // src/data/opponents.ts has the full pass): 63/82/64/70/84 avg 72.1 at
    // 200 seeds/cell, 0 draws, measured on the committed list with
    // runAvatarMatrix under the same per-(rung, starter) seeding this gate
    // uses; the 60 above reproduced exactly in the same session.
    const report = runAvatarMatrix(40, ['chrome-broodmother', 'the-violet-signal-queen']);
    reportAvatarRates(report);
    const row = (id: string) => report.rows.find((entry) => entry.avatar.id === id);
    const r23 = row('chrome-broodmother');
    const r24 = row('the-violet-signal-queen');
    expect(r23).toBeDefined();
    expect(r24).toBeDefined();
    if (!r23 || !r24) return;
    expect(r23.cells).toHaveLength(5);
    expect(r24.cells).toHaveLength(5);
    // R23 Chrome Broodmother: 72.1 - 6.5 = 65.6, rounded down to the half
    // point, so the floor RATCHETS UP 0.585 -> 0.655. History: on 2026-09-17
    // she read 60, 1.5pp above 0.585 against a 6.5pp 40-seed band, the
    // narrowest margin on the ladder; the 2026-09-19 tuning pass found the
    // cause (no way to block a flier) and closed it.
    expect(r23.avg, 'Chrome Broodmother floor').toBeGreaterThanOrEqual(0.655);
    // R24 Violet Signal Queen: 71 - 6.5 = 64.5, so the floor RATCHETS UP
    // 0.615 -> 0.645. Same minus-6.5pp convention, rounded down to the half
    // point.
    expect(r24.avg, 'Violet Signal Queen floor').toBeGreaterThanOrEqual(0.645);
    for (const cell of [...r23.cells, ...r24.cells]) {
      expect(cell.draws, 'new boss cell must terminate decisively').toBe(0);
    }
  }, 900_000);

  it('Drowned Deep rungs 25-26 clear their floors and field complete matrices', () => {
    // FLOORS SET 2026-09-17. Both shipped gated on termination only, tier-6
    // PROVISIONAL "until the owner's tuning pass" - which has now happened
    // (the Deacon 35.9 -> 66.4 in #378; the Marsh-Mother's list measured and
    // kept at 74.8 in #379), so they get real floors like every other rung.
    // Same command and run as the two gates above (`--avatars --seeds 200
    // --only <the six summit ids>`, 6,000 games, 1,433 s, FLAGS none); cells
    // in Muster/Communion/Tides/Mandate/Harvest order, 200 decided, 0 draws:
    //   R25 38/72/65/83/75 avg 66 · R26 64/77/66/81/87 avg 75
    // Same minus-6.5pp 40-seed noise band, rounded down to the half point:
    // 59.5% and 68.5%. The complete-matrix and zero-draw assertions this gate
    // already carried are unchanged below.
    const report = runAvatarMatrix(40, ['the-drowned-deacon', 'the-marsh-mother']);
    reportAvatarRates(report);
    const row = (id: string) => report.rows.find((entry) => entry.avatar.id === id);
    const r25 = row('the-drowned-deacon');
    const r26 = row('the-marsh-mother');
    expect(r25).toBeDefined();
    expect(r26).toBeDefined();
    if (!r25 || !r26) return;
    expect(r25.cells).toHaveLength(5);
    expect(r26.cells).toHaveLength(5);
    // R25 The Drowned Deacon: 66 - 6.5 = 59.5. Muster (38) is the column the
    // tuning pass could not fully buy back.
    expect(r25.avg, 'Drowned Deacon floor').toBeGreaterThanOrEqual(0.595);
    // R26 The Marsh-Mother: 75 - 6.5 = 68.5, on the converter-owned list that
    // #379 measured four surgeries against and kept unchanged.
    expect(r26.avg, 'Marsh-Mother floor').toBeGreaterThanOrEqual(0.685);
    for (const cell of [...r25.cells, ...r26.cells]) {
      expect(cell.games, 'new boss cell must field all 40 seeded games').toBe(40);
      expect(cell.rowWins + cell.colWins, 'new boss cell must decide all 40 seeded games').toBe(40);
      expect(cell.draws, 'new boss cell must terminate decisively').toBe(0);
    }
  }, 900_000);

});
