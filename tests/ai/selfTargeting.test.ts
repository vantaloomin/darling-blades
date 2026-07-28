import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { makePersonality } from '../../src/ai/personality';
import { Game } from '../../src/engine/Game';
import { makeTestState, TEST_DB } from '../helpers';

describe('Easy targeted damage choices', () => {
  it('does not choose a friendly creature when an opposing target is legal', () => {
    const game = Game.restore(
      makeTestState({
        hands: [['shock'], []],
        battlefield: [
          { iid: 1, cardId: 'bear', controller: 0 },
          { iid: 2, cardId: 'bear', controller: 1 },
          { iid: 3, cardId: 'mountain', controller: 0 },
        ],
      }),
      TEST_DB,
    );

    const ai = new EasyAI(TEST_DB, 7, makePersonality({ easyNoise: 0 }));
    const action = ai.chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toEqual({
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 2 }],
    });
  });

  it('does not choose its own face when an opposing face is the only safe target', () => {
    const game = Game.restore(
      makeTestState({
        hands: [['shock'], []],
        battlefield: [{ iid: 1, cardId: 'mountain', controller: 0 }],
      }),
      TEST_DB,
    );

    const ai = new EasyAI(TEST_DB, 7, makePersonality({ easyNoise: 0 }));
    const action = ai.chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toEqual({
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 1 }],
    });
  });
});
