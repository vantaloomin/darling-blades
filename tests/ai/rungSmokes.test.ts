import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { MediumAI } from '../../src/ai/MediumAI';
import { buildAI } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { DARLINGS_PRECONS } from '../../src/data/darlingsPrecons';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { WARCHEST_HAND_SIZE } from '../../src/meta/warchest';
import {
  BalanceTelemetryCollector, runCell, type CellSpec,
} from '../../scripts/balance-matrix';

/** Same single-cell runner, opening hand and seed families as the summit gates. */
function smoke(label: string, brain: string, spec: CellSpec, cellIndex: number, decisive = false): void {
  const start = performance.now();
  const seed = cellIndex * 100_000;
  const collector = new BalanceTelemetryCollector();
  let last: unknown;
  const track = (ai: AIPlayer): AIPlayer => ({
    chooseAction(view, legal) {
      last = { player: view.myId, turn: view.turn, awaiting: view.awaiting, stage: 'choosing', action: null };
      const action = ai.chooseAction(view, legal);
      last = { player: view.myId, turn: view.turn, awaiting: view.awaiting, stage: 'submitting', action };
      return action;
    },
  });
  try {
    const result = runCell({
      ...spec,
      rowAI: (aiSeed, index) => track(spec.rowAI(aiSeed, index)),
      colAI: (aiSeed) => track(spec.colAI(aiSeed)),
    }, 1, cellIndex, undefined, { collector, matrix: label, rowDeck: label, colDeck: 'fixed Medium proxy' });
    // playOut only emits final telemetry after the real Game reaches gameOver;
    // every action passes through Game.submit's validation, with no recovery.
    const games = collector.toJSON().cells.flatMap((cell) => cell.games);
    expect(games, label).toHaveLength(1);
    const game = games[0];
    expect(game.seed).toBe(seed);
    expect(game.rowIsP0).toBe(true);
    expect([0, 1, 'draw']).toContain(game.record.winner);
    expect(result.games).toBe(1);
    expect(result.rowWins + result.colWins + result.draws).toBe(1);
    console.log(JSON.stringify({
      smoke: label, brain, seed, aiSeed: seed * 7 + 1,
      winner: game.record.winner, turns: game.record.turns,
      wallMs: Math.round(performance.now() - start),
    }));
    if (decisive) expect(result.draws, label).toBe(0);
  } catch (error) {
    throw new Error(`${label}; seed ${seed}; last ${JSON.stringify(last)}; ${String(error)}`, { cause: error });
  }
}

describe('reserve-native gauntlet and Darlings termination proof', () => {
  // One test deliberately makes 900 s the budget for the ENTIRE file, not
  // 900 s per avatar. Keep all rungs; never shrink the roster to meet the cap.
  it('every rung in both formats and every shipped Darlings precon reaches gameOver', () => {
    const start = performance.now();
    const crimsonIndex = STARTER_DECKS.findIndex((deck) => deck.id === 'starter-crimson');
    const crimson = STARTER_DECKS[crimsonIndex];
    const proxy = DARLINGS_PRECONS.find((deck) => deck.id === 'darlings-zhou-yu')!;
    expect(AVATARS.map((avatar) => avatar.tier).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(crimson.reserveCards).toHaveLength(40);
    expect(crimson.landReserve).toHaveLength(10);
    expect(proxy).toBeDefined();
    expect(DARLINGS_PRECONS.length).toBeGreaterThan(0);
    try {
      for (const avatar of [...AVATARS].sort((a, b) => a.tier - b.tier)) {
        smoke(`Warchest R${avatar.tier} ${avatar.name}`, avatar.difficulty, {
          rowAI: (seed) => buildAI(avatar.difficulty, CARD_DB, seed, avatar.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [avatar.reserveDeck, crimson.reserveCards!],
          reserves: () => [avatar.landReserve, crimson.landReserve!],
          format: 'warchest', startingHandSize: WARCHEST_HAND_SIZE,
        }, avatar.tier * 100 + crimsonIndex, avatar.tier >= 14);
      }
      for (const avatar of [...AVATARS].sort((a, b) => a.tier - b.tier)) {
        smoke(`Darlings R${avatar.tier} ${avatar.name}`, avatar.difficulty, {
          rowAI: (seed) => buildAI(avatar.difficulty, CARD_DB, seed, avatar.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [avatar.darlingsDeck, proxy.cards],
          reserves: () => [avatar.landReserve, proxy.landReserve],
          darlings: () => [avatar.darlingId, proxy.darlingId],
          format: 'darlings', startingHandSize: WARCHEST_HAND_SIZE,
        }, 210_000 + avatar.tier * 100);
      }
      for (const [index, precon] of DARLINGS_PRECONS.entries()) {
        smoke(`Precon ${precon.name}`, 'medium', {
          rowAI: () => new MediumAI(CARD_DB), colAI: () => new MediumAI(CARD_DB),
          decks: () => [precon.cards, proxy.cards],
          reserves: () => [precon.landReserve, proxy.landReserve],
          darlings: () => [precon.darlingId, proxy.darlingId],
          format: 'darlings', startingHandSize: WARCHEST_HAND_SIZE,
        }, 110_000 + index * 100);
      }
    } finally {
      console.log(`rungSmokes file wall: ${((performance.now() - start) / 1000).toFixed(3)} s`);
    }
    expect(performance.now() - start, 'complete smoke file must fit its 900 s budget').toBeLessThan(900_000);
  }, 900_000);
});
