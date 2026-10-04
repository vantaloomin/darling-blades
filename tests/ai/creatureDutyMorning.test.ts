import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, GameState, Permanent } from '../../src/engine/types';
import { board, card, dbOf, ref } from '../drownedDeepFixture';

// A creature whose Duty taps another creature (Ice-Speaker: {2}, tap: tap
// target creature) could also attack, so the shared policy used to leave its
// Duty for main two. Since U3 a main-two tap of an enemy is worth nothing, so
// the Duty had no live turn. Before combat it is now judged by the same
// forecast as a paid Duty: the attack is planned with the tapper tapped.

const DB: CardDb = dbOf(
  CARD_DB['fd-ice-speaker'],
  card('ogre', { attack: 4, defense: 4, cost: { generic: 4, pips: {} } }),
);

const SPEAKER = 10;
function morning(battlefield: Partial<Permanent>[], setup?: (state: GameState) => void): Game {
  const state = board([[], []], [
    { iid: SPEAKER, cardId: 'fd-ice-speaker' },
    { iid: 30, cardId: 'forest' }, { iid: 31, cardId: 'forest' },
    ...battlefield,
  ]);
  setup?.(state);
  return Game.restore(state, DB);
}

function decide(game: Game, brain: AIPlayer): Action {
  const action = brain.chooseAction(game.viewFor(0), game.legalActions(0));
  expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
  return action;
}

describe("a creature's tap-a-creature Duty is used before combat when the attack pays for it", () => {
  it.each([['Medium', () => new MediumAI(DB)], ['Hard', () => new HardAI(DB)]] as const)(
    '%s taps the only blocker in main one so its 4/4 attacks through',
    (_, brain) => {
      const game = morning([{ iid: 1, cardId: 'ogre' }, { iid: 5, cardId: 'ogre', controller: 1 }]);
      expect(decide(game, brain())).toMatchObject({ type: 'activate', iid: SPEAKER, targets: [ref(5)] });
    },
  );

  it('Medium keeps the Duty when no attack gains from it, and a main-two tap stays worth nothing', () => {
    // Only the speaker could attack, and their 4/4 is no blocker it fears.
    const alone = morning([{ iid: 5, cardId: 'ogre', controller: 1 }]);
    expect(decide(alone, new MediumAI(DB)).type).not.toBe('activate');
    const afternoon = morning([{ iid: 1, cardId: 'ogre' }, { iid: 5, cardId: 'ogre', controller: 1 }],
      (state) => { state.step = 'main2'; });
    expect(decide(afternoon, new MediumAI(DB)).type).not.toBe('activate');
  });
});
