import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, Keyword } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const creature = (id: string, attack: number, defense: number, keywords: Keyword[] = []): CardDef => ({
  ...TEST_DB.bear, id, name: id, attack, defense, keywords,
});
const cards = [
  creature('two_four', 2, 4),
  creature('two_five', 2, 5),
  creature('first_assassin', 1, 1, ['firstBlade', 'deathblade']),
  creature('twin_assassin', 1, 1, ['twinBlades', 'deathblade']),
  creature('first_death', 1, 4, ['firstBlade', 'deathblade']),
  creature('twin_death', 1, 4, ['twinBlades', 'deathblade']),
  creature('zero_death', 0, 1, ['deathblade']),
  creature('dreaded_plain', 3, 4, ['dreaded']),
  creature('dreaded_first', 3, 4, ['dreaded', 'firstBlade']),
  creature('dreaded_twin', 3, 4, ['dreaded', 'twinBlades']),
  creature('dreaded_death', 1, 4, ['dreaded', 'firstBlade', 'deathblade']),
  creature('dreaded_five', 2, 5, ['dreaded']),
];
const DB: CardDb = { ...TEST_DB, ...Object.fromEntries(cards.map((card) => [card.id, card])) };

function blockGame(attacker: string, defenders: string[], life = 20): Game {
  const state = makeTestState({
    active: 1,
    battlefield: [
      { iid: 20, cardId: attacker, controller: 1, tapped: true },
      ...defenders.map((cardId, i) => ({ iid: 10 + i, cardId, controller: 0 as const })),
    ],
  });
  state.step = 'combat';
  state.awaiting = { kind: 'declareBlockers', player: 0 };
  state.combat = { attackers: [20], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
  state.players[0].life = life;
  return Game.restore(state, DB);
}

function choose(game: Game): Action {
  const action = new EasyAI(DB, 41).chooseAction(game.viewFor(0), game.legalActions(0));
  expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
  return action;
}

const none: Action = { type: 'declareBlockers', blocks: [] };
const single: Action = { type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 20 }] };
const pair: Action = {
  type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 20 }, { blocker: 11, attacker: 20 }],
};

describe('Easy combat keyword timing', () => {
  it.each(['knight', 'ds_bear'])('declines a bear killed by %s before it can strike', (attacker) => {
    expect(choose(blockGame('bear', ['bear']))).toEqual(single);
    expect(choose(blockGame(attacker, ['bear']))).toEqual(none);
  });

  it.each(['first_death', 'twin_death'])('counts deathblade in the first hit from %s', (attacker) => {
    expect(choose(blockGame(attacker, ['giant']))).toEqual(none);
  });

  it('does not call a blocker surviving when Twin Blades kills it with the second hit', () => {
    expect(choose(blockGame('bear', ['archer']))).toEqual(single);
    expect(choose(blockGame('ds_bear', ['archer']))).toEqual(none);
  });

  it.each(['knight', 'ds_bear', 'ds_fs'])('lets %s strike simultaneously with opposing first strike', (blocker) => {
    expect(choose(blockGame('knight', [blocker]))).toEqual(single);
  });

  it.each(['first_assassin', 'twin_assassin'])('lets %s land simultaneous first-step deathblade', (blocker) => {
    expect(choose(blockGame('knight', ['assassin']))).toEqual(none);
    expect(choose(blockGame('knight', [blocker]))).toEqual(single);
  });

  it('counts a Twin Blades blocker second hit even when it dies in the same normal step', () => {
    expect(choose(blockGame('two_four', ['bear']))).toEqual(none);
    expect(choose(blockGame('two_four', ['ds_bear']))).toEqual(single);
  });

  it('counts firstBlade plus Twin Blades as two blocker hits rather than three', () => {
    expect(choose(blockGame('two_five', ['ds_fs']))).toEqual(none);
  });

  it('does not give a zero-power deathblade blocker a kill', () => {
    expect(choose(blockGame('giant', ['zero_death']))).toEqual(none);
  });

  it.each(['dreaded_first', 'dreaded_twin', 'dreaded_death'])('excludes first-hit casualties from the pair kill against %s', (attacker) => {
    expect(choose(blockGame('dreaded_plain', ['bear', 'bear']))).toEqual(pair);
    expect(choose(blockGame(attacker, ['bear', 'bear']))).toEqual(none);
  });

  it.each(['knight', 'ds_bear'])('keeps both %s blockers first hits when a Dreaded attacker kills one simultaneously', (blocker) => {
    expect(choose(blockGame('dreaded_first', [blocker, blocker]))).toEqual(pair);
  });

  it('counts a Twin Blades blocker twice in a Dreaded pair kill', () => {
    expect(choose(blockGame('dreaded_five', ['ds_bear', 'archer']))).toEqual(pair);
  });

  it('retains the five-life chump threshold for single and Dreaded blocks', () => {
    for (const [attacker, defenders, expected] of [
      ['knight', ['bear'], single],
      ['dreaded_twin', ['bear', 'bear'], pair],
    ] as const) {
      expect(choose(blockGame(attacker, [...defenders], 6))).toEqual(none);
      expect(choose(blockGame(attacker, [...defenders], 5))).toEqual(expected);
    }
  });
});
