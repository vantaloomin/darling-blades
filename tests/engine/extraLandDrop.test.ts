import { describe, expect, it } from 'vitest';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import { startTurn } from '../../src/engine/phases';
import { makeTestState, TEST_DB } from '../helpers';

const ctx = { controller: 0 as const, sourceCardId: 'x', targets: [] };
const SPELL_DECK = Array.from({ length: 50 }, () => 'bear');
const RESERVE = Array.from({ length: 10 }, () => 'forest');

function classicGame(hands: [string[], string[]] = [['forest', 'plains', 'mountain'], []]): Game {
  return Game.restore(makeTestState({ hands, active: 0 }), TEST_DB);
}

function gameWithExtraLandDrops(
  n: number,
  hands: [string[], string[]] = [['forest', 'plains', 'mountain'], []],
): Game {
  const state = makeTestState({ hands, active: 0 });
  runOps(
    state,
    TEST_DB,
    () => {},
    ctx,
    Array.from({ length: n }, () => ({ op: 'extraLandDrop' as const })),
  );
  return Game.restore(state, TEST_DB);
}

function keepBoth(game: Game): void {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) throw new Error(`Unexpected awaiting state: ${awaiting.kind}`);
    game.submit(awaiting.player, { type: 'keepHand' });
  }
}

describe('extra land drops', () => {
  it('rejects a second land drop without an extraLandDrop effect', () => {
    const game = classicGame();

    game.submit(0, { type: 'playLand', handIndex: 0 });

    expect(game.state.players[0].landDropsUsed).toBe(1);
    expect(() => game.submit(0, { type: 'playLand', handIndex: 0 })).toThrow(/no land drops remaining/);
    expect(game.legalActions(0).some((action) => action.type === 'playLand')).toBe(false);
  });

  it('grants exactly one additional drop by default', () => {
    const game = gameWithExtraLandDrops(1);

    expect(game.state.players[0].extraLandDrops).toBe(1);
    game.submit(0, { type: 'playLand', handIndex: 0 });
    game.submit(0, { type: 'playLand', handIndex: 0 });

    expect(game.state.players[0].landDropsUsed).toBe(2);
    expect(game.state.players[0].landDropsUsed < 1 + game.state.players[0].extraLandDrops).toBe(false);
  });

  it('cumulates two extraLandDrop effects into two additional drops', () => {
    const game = gameWithExtraLandDrops(2, [['forest', 'plains', 'mountain', 'island'], []]);

    expect(game.state.players[0].extraLandDrops).toBe(2);
    for (let i = 0; i < 3; i++) game.submit(0, { type: 'playLand', handIndex: 0 });

    expect(game.state.players[0].landDropsUsed).toBe(3);
    expect(game.legalActions(0).some((action) => action.type === 'playLand')).toBe(false);
  });

  it('leaves the first land drop on existing entersTapped rules and taps extra drops', () => {
    const game = gameWithExtraLandDrops(1, [['forest', 'plains'], []]);

    game.submit(0, { type: 'playLand', handIndex: 0 });
    const first = game.instanceState.battlefield.at(-1)!;
    expect(first.tapped).toBe(false);

    game.submit(0, { type: 'playLand', handIndex: 0 });
    const second = game.instanceState.battlefield.at(-1)!;
    expect(second.tapped).toBe(true);
  });

  it('resets both counters when the active player turn begins', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['bear'];
    state.players[0].landDropsUsed = 1;
    state.players[0].extraLandDrops = 3;

    startTurn(state, TEST_DB, () => {});

    expect(state.players[0].landDropsUsed).toBe(0);
    expect(state.players[0].extraLandDrops).toBe(0);
  });

  it('can exhaust all ten reserve lands with extra drops', () => {
    const game = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 8128,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    });
    keepBoth(game);
    const player = game.instanceState.activePlayer;
    game.state.players[player].extraLandDrops = 9;

    for (let i = 0; i < RESERVE.length; i++) {
      const action = game.legalActions(player).find((candidate) => candidate.type === 'playLand');
      expect(action).toBeDefined();
      game.submit(player, action!);
    }

    expect(game.state.players[player].landReserve).toEqual([]);
    expect(game.state.players[player].landDropsUsed).toBe(10);
    expect(game.viewFor(player).you.landDropsRemaining).toBe(0);
    expect(game.legalActions(player).some((action) => action.type === 'playLand')).toBe(false);
    expect(() => game.submit(player, { type: 'playLand', handIndex: -1, reserveIndex: 0 }))
      .toThrow(/no land drops remaining/);
  });

  it('allows extraLandDrop in a Foresee target-free continuation', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['bear'];

    expect(() => runOps(state, TEST_DB, () => {}, ctx, [
      { op: 'foresee', n: 1 },
      { op: 'extraLandDrop' },
    ])).not.toThrow();
    expect(state.pendingDecisions).toEqual([{
      kind: 'foresee',
      player: 0,
      n: 1,
      thenOps: [{ op: 'extraLandDrop' }],
    }]);
  });

  it('is deterministic for the same seed and action sequence', () => {
    const make = (): Game => gameWithExtraLandDrops(2, [['forest', 'plains', 'mountain'], []]);
    const a = make();
    const b = make();
    const actions = [
      { type: 'playLand' as const, handIndex: 0 },
      { type: 'playLand' as const, handIndex: 0 },
      { type: 'playLand' as const, handIndex: 0 },
    ];

    for (const action of actions) {
      a.submit(0, action);
      b.submit(0, action);
    }

    expect(structuredClone(a.instanceState)).toEqual(structuredClone(b.instanceState));
  });
});
