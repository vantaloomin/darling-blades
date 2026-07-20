import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { removalValueForCast } from '../../src/ai/value';
import { Game } from '../../src/engine/Game';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import type { CardDb, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  plain_artifact: {
    id: 'plain_artifact',
    name: 'Plain Artifact',
    types: ['artifact'],
    subtypes: [],
    cost: { generic: 3, pips: {} },
    colors: [],
    rarity: 'c',
  },
  nocturne_manor: {
    id: 'nocturne_manor',
    name: 'Nocturne Manor',
    types: ['enchantment'],
    subtypes: [],
    cost: { generic: 3, pips: {} },
    colors: [],
    abilities: [
      { when: 'dawn', ops: [{ op: 'draw', n: 1 }, { op: 'loseLife', n: 1, who: 'opponent' }] },
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Beastkin' }, p: 1, t: 1 } },
    ],
    rarity: 'c',
  },
  answer: {
    id: 'answer',
    name: 'Artifact or Enchantment Answer',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'artifactOrEnchantment' }],
        ops: [{ op: 'destroy', to: 'target' }],
      },
    ],
    rarity: 'c',
  },
  sweep: {
    id: 'sweep',
    name: 'Sweep Enchantments',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allEnchantments' }] }],
    rarity: 'c',
  },
};

function permanent(iid: number, cardId: string, controller: 0 | 1): Partial<Permanent> {
  return { iid, cardId, controller, owner: controller, enteredThisTurn: false };
}

function gameWith(hand: string[], battlefield: Partial<Permanent>[]): Game {
  return Game.restore(
    makeTestState({ battlefield, hands: [hand, []], active: 0 }),
    DB,
  );
}

function brains(): [string, (db: CardDb) => AIPlayer][] {
  return [
    ['Easy', (db) => new EasyAI(db, 7, makePersonality({ easyNoise: 0, easyPassRate: 0 }))],
    ['Medium', (db) => new MediumAI(db)],
    ['Hard', (db) => new HardAI(db)],
  ];
}

describe('non-creature removal valuation and AI decisions', () => {
  it('prices a dawn engine and static impact above an inert permanent', () => {
    const board: Permanent[] = [
      permanent(1, 'plain_artifact', 1) as Permanent,
      permanent(2, 'nocturne_manor', 1) as Permanent,
    ];
    expect(removalValueForCast(board, DB, 0, 'answer', board[1])).toBeGreaterThan(
      removalValueForCast(board, DB, 0, 'answer', board[0]),
    );
  });

  it.each(brains())('%s chooses a legal answer for a public opposing engine', (_name, makeAI) => {
    const game = gameWith(['answer'], [permanent(1, 'nocturne_manor', 1)]);
    const action = makeAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action.type).toBe('castSpell');
    if (action.type === 'castSpell') {
      expect(action.targets).toEqual([{ kind: 'permanent', iid: 1 }]);
      expect(() => game.submit(0, action)).not.toThrow();
    }
  });

  it.each(brains())('%s does not waste targetless enchantment removal on an empty opposing board', (_name, makeAI) => {
    const game = gameWith(['sweep'], [permanent(1, 'bear', 1)]);
    const action = makeAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action.type).toBe('passStep');
    expect(() => game.submit(0, action)).not.toThrow();
  });

  it('Hard reaches the normal determinized simulation path with a non-creature target', () => {
    const game = gameWith(['answer'], [permanent(1, 'nocturne_manor', 1)]);
    const ai = new HardAI(DB);
    const action = ai.chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action.type).toBe('castSpell');
    expect(() => game.submit(0, action)).not.toThrow();
  });
});
