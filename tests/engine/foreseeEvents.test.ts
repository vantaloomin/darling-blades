import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The `foresaw` resolution event (history-log feed). The engine emits full
 * identities for BOTH players; redaction is the presenter's job (DuelScene
 * names cards only for the local human) — see the contract in events.ts.
 * These tests pin the emission shape the presenter relies on.
 */

const DB: CardDb = {
  ...TEST_DB,
  foresee3: {
    id: 'foresee3',
    name: 'Foresee Three',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 3 }] }],
  },
};

function beginForesee(player: 0 | 1, deck: string[]): Game {
  const hands: [string[], string[]] = player === 0 ? [['foresee3'], []] : [[], ['foresee3']];
  const state = makeTestState({ hands, active: player });
  state.players[player].deck = [...deck];
  const game = Game.restore(state, DB);
  game.submit(player, { type: 'castSpell', handIndex: 0 });
  return game;
}

function foresawEvents(events: GameEvent[]): Extract<GameEvent, { e: 'foresaw' }>[] {
  return events.filter((e): e is Extract<GameEvent, { e: 'foresaw' }> => e.e === 'foresaw');
}

describe('foresaw event', () => {
  it('emits kept and bottomed identities top-first on resolution', () => {
    const game = beginForesee(0, ['a', 'b', 'c', 'd']); // d is the deck top
    expect(game.awaiting).toEqual({ player: 0, kind: 'foresee', cards: ['d', 'c', 'b'] });

    const events = game.submit(0, { type: 'foresee', bottomIndices: [1] }); // bottom 'c'

    expect(foresawEvents(events)).toEqual([
      { e: 'foresaw', player: 0, kept: ['d', 'b'], bottomed: ['c'] },
    ]);
    // The event mirrors the actual deck rewrite (bottom-first storage).
    expect(game.state.players[0].deck).toEqual(['c', 'a', 'b', 'd']);
  });

  it('emits an empty bottomed list when everything is kept', () => {
    const game = beginForesee(0, ['a', 'b', 'c', 'd']);
    const events = game.submit(0, { type: 'foresee', bottomIndices: [] });

    expect(foresawEvents(events)).toEqual([
      { e: 'foresaw', player: 0, kept: ['d', 'c', 'b'], bottomed: [] },
    ]);
  });

  it('emits for the non-local player too (presenter redacts, not the engine)', () => {
    const game = beginForesee(1, ['x', 'y', 'z', 'w']);
    const events = game.submit(1, { type: 'foresee', bottomIndices: [0, 1] });

    expect(foresawEvents(events)).toEqual([
      { e: 'foresaw', player: 1, kept: ['y'], bottomed: ['w', 'z'] },
    ]);
  });

  it('emits nothing when the foresee is skipped for an empty deck', () => {
    const game = beginForesee(0, []);
    // Zero cards seen: no decision is raised, so no foresaw event ever fires.
    expect(game.awaiting.kind).toBe('main');
    // The cast itself produced no foresaw event either.
    // (initialEvents covers setup; the buffer from the cast is gone, so replay
    // the scenario via a fresh cast capturing its events.)
    const state = makeTestState({ hands: [['foresee3'], []], active: 0 });
    state.players[0].deck = [];
    const g2 = Game.restore(state, DB);
    const events = g2.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(foresawEvents(events)).toEqual([]);
  });
});
