import { describe, expect, it } from 'vitest';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { removalKind } from '../../src/ai/value';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import { makeTestState } from '../helpers';
import { DARK_TALES_DB } from '../darkTalesFixture';

const DB = { ...CARD_DB, ...DARK_TALES_DB };

function gameFromState(state: ReturnType<typeof makeTestState>): Game {
  return Game.restore(state, DB);
}

describe('AI defect regressions from the 1.5 instrumented probe', () => {
  it('DEFECT 1: seed 1600026 turn 27, Medium sends Apple of Endless Sleep at the opposing creature', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'swamp', controller: 0 },
        { iid: 2, cardId: 'swamp', controller: 0 },
        { iid: 3, cardId: 'swamp', controller: 0 },
        { iid: 4, cardId: 'swamp', controller: 0 },
        { iid: 10, cardId: 'bear', controller: 0 },
        { iid: 11, cardId: 'giant', controller: 1 },
      ],
      hands: [['dt-apple-of-endless-sleep'], []],
      active: 0,
    });
    const game = gameFromState(state);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toMatchObject({
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 11 }],
    });
    expect(removalKind(DB, 'dt-apple-of-endless-sleep')).toBe('sever');
    expect(removalKind(DB, 'cf-glamour-of-the-hill')).toBe('recall');
  });

  it('DEFECT 2: the probe\'s four seeded Grave Chill cases, Medium never pumps its own unblocked attacker', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'swamp', controller: 0 },
        { iid: 2, cardId: 'bear', controller: 0 },
        { iid: 3, cardId: 'giant', controller: 1 },
      ],
      hands: [['in-grave-chill'], []],
      active: 0,
    });
    state.step = 'combat';
    state.combat = {
      attackers: [2],
      blocks: [],
      phase: 'blockersDeclared',
      damagePrevented: false,
    };
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'blockers' } };
    const game = gameFromState(state);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toEqual({ type: 'passResponse' });
  });

  it('DEFECT 3: seeds 1600001/1600003/1600010/1600036, Hard Retells Once More With Magic onto its own creature on ties', () => {
    const state = makeTestState({
      battlefield: [
        // Opposing target first reproduces the old legal-menu tie winner.
        { iid: 10, cardId: 'bear', controller: 1, damage: 3 },
        { iid: 11, cardId: 'bear', controller: 0 },
        { iid: 20, cardId: 'plains', controller: 0 },
        { iid: 21, cardId: 'plains', controller: 0 },
        { iid: 22, cardId: 'plains', controller: 0 },
      ],
      hands: [[], []],
      active: 0,
    });
    state.players[0].graveyard = ['dt-once-more-with-magic'];
    const game = gameFromState(state);
    const action = new HardAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toMatchObject({
      type: 'castSpell',
      retell: true,
      graveIndex: 0,
      targets: [{ kind: 'permanent', iid: 11 }],
    });
  });
});
