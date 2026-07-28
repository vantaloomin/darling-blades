import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { Game } from '../../src/engine/Game';
import { makeTestState } from '../helpers';
import { DARK_TALES_DB, manaPermanent } from '../darkTalesFixture';

function gameWith(
  hand: string[],
  graveyard: string[] = [],
  deck: string[] = ['forest'],
  land: 'mountain' | 'island' = 'mountain',
): Game {
  const state = makeTestState({
    hands: [hand, []],
    battlefield: [manaPermanent(1, land)],
    active: 0,
  });
  state.players[0].graveyard = [...graveyard];
  state.players[0].deck = [...deck];
  return Game.restore(state, DARK_TALES_DB);
}

function brains(seed: number): AIPlayer[] {
  return [
    new EasyAI(DARK_TALES_DB, seed),
    new MediumAI(DARK_TALES_DB),
    new HardAI(DARK_TALES_DB),
  ];
}

describe('Dark Tales AI smoke', () => {
  it('all three difficulties choose legal Skim and Retell actions from PlayerView menus', () => {
    for (const [index, brain] of brains(41).entries()) {
      const skimGame = gameWith(['skimCard']);
      const skim = brain.chooseAction(skimGame.viewFor(0), skimGame.legalActions(0));
      expect(skim, `brain ${index} skim`).toMatchObject({ type: 'skim', handIndex: 0 });

      const retellGame = gameWith([], ['retellRitual'], [], 'island');
      const retell = brain.chooseAction(retellGame.viewFor(0), retellGame.legalActions(0));
      expect(retell, `brain ${index} retell`).toMatchObject({
        type: 'castSpell', retell: true, graveIndex: 0,
      });
    }
  });

  it('same seed and same redacted view produce the same AI action', () => {
    for (const makeBrain of [
      (seed: number) => new EasyAI(DARK_TALES_DB, seed),
      () => new MediumAI(DARK_TALES_DB),
      () => new HardAI(DARK_TALES_DB),
    ]) {
      const first = gameWith(['skimCard']);
      const second = gameWith(['skimCard']);
      const firstAction = makeBrain(99).chooseAction(first.viewFor(0), first.legalActions(0));
      const secondAction = makeBrain(99).chooseAction(second.viewFor(0), second.legalActions(0));
      expect(secondAction).toEqual(firstAction);
    }
  });

  it('Medium casts a legal creature instead of smoothing with Skim', () => {
    const game = gameWith(['skimCard', 'castCreature']);
    const action = new MediumAI(DARK_TALES_DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 1 });
  });

  it('Medium and Hard never Skim when their deck is empty', () => {
    for (const [label, brain] of [
      ['Medium', new MediumAI(DARK_TALES_DB)],
      ['Hard', new HardAI(DARK_TALES_DB)],
    ] as const) {
      const game = gameWith(['skimCard'], [], []);
      const action = brain.chooseAction(game.viewFor(0), game.legalActions(0));
      expect(action, label).toMatchObject({ type: 'passStep' });
    }
  });
});
