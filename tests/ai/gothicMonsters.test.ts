import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import type { CardDb, Permanent } from '../../src/engine/types';
import { DEFAULT_PERSONALITY } from '../../src/ai/personality';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  dreaded: {
    ...TEST_DB.bear,
    id: 'dreaded',
    name: 'Dreaded Bear',
    keywords: ['dreaded'],
  },
  empowerBody: {
    id: 'empowerBody',
    name: 'Empowered Body',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 1, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'c',
  },
};

function perm(iid: number, cardId: string, controller: 0 | 1): Partial<Permanent> {
  return { iid, cardId, controller, owner: controller, tapped: false, enteredThisTurn: false };
}

function combatGame(): Game {
  const state = makeTestState({
    battlefield: [
      perm(1, 'dreaded', 0),
      perm(2, 'bear', 1),
      perm(3, 'bear', 1),
    ],
    active: 0,
  });
  const game = Game.restore(state, DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [1] });
  return game;
}

function empowerGame(): Game {
  const state = makeTestState({ hands: [['empowerBody'], []], active: 0 });
  state.players[0].deck = ['forest', 'forest'];
  state.battlefield = [perm(10, 'forest', 0), perm(11, 'forest', 0)].map((p) => ({
    ...p,
    damage: 0,
    deathtouched: false,
    attachments: [],
    plusOneCounters: 0,
    untilEotMods: [],
  } as Permanent));
  return Game.restore(state, DB);
}

describe('Gothic Monsters AI awareness', () => {
  it.each([
    ['Easy', (db: CardDb) => new EasyAI(db, 7, { ...DEFAULT_PERSONALITY, easyNoise: 0 })],
    ['Medium', (db: CardDb) => new MediumAI(db)],
    ['Hard', (db: CardDb) => new HardAI(db)],
  ])('%s never submits a single block against Dreaded', (_name, makeAI) => {
    const game = combatGame();
    const ai = makeAI(DB);
    const action = ai.chooseAction(game.viewFor(1), game.legalActions(1));
    expect(action.type).toBe('declareBlockers');
    if (action.type === 'declareBlockers') {
      expect(action.blocks.filter((b) => b.attacker === 1).length).not.toBe(1);
      expect(() => game.submit(1, action)).not.toThrow();
    }
  });

  it.each([
    ['Easy', (db: CardDb) => new EasyAI(db, 7, { ...DEFAULT_PERSONALITY, easyNoise: 0 })],
    ['Medium', (db: CardDb) => new MediumAI(db)],
    ['Hard', (db: CardDb) => new HardAI(db)],
  ])('%s makes a deterministic Empower decision when the rider is payable', (_name, makeAI) => {
    const game = empowerGame();
    const ai = makeAI(DB);
    const action = ai.chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action.type).toBe('castSpell');
    if (action.type === 'castSpell') {
      expect(action.empowered).toBe(true);
      expect(() => game.submit(0, action)).not.toThrow();
    }
  });
});
