import { describe, expect, it } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import { Game } from '../../src/engine/Game';
import { enterEndStep, startTurn } from '../../src/engine/phases';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The small constructs Core Set II's overplan needs (docs/plan-core-set-2-engine.md,
 * Part 5): a subtype-filtered arrival trigger (Yutu, Jiuwei, Lanlan), "if you
 * gained life this turn" (Hebe), and a token made for the target's controller
 * (Circe's Pig).
 */
const zero = { generic: 0, pips: {} };
const creature = (id: string, subtypes: string[], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes, cost: zero, colors: [], attack: 2, defense: 2, rarity: 'c', ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  otter: creature('otter', ['Beastkin', 'Otter'], { abilities: [{ when: 'allyCreatureArrives', filter: { subtype: 'Beastkin' }, ops: [{ op: 'gainLife', n: 1 }] }] }),
  fox: creature('fox', ['Beastkin', 'Fox']),
  soldier: creature('soldier', ['Human', 'Soldier']),
  hebe: creature('hebe', ['Olympian', 'God'], { abilities: [{ when: 'sunset', condition: 'youGainedLifeThisTurn', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }] }),
  oathkeeper: creature('oathkeeper', ['Human'], { keywords: ['bloodoath'] }),
  cup: { ...creature('cup', []), types: ['ritual'], attack: undefined, defense: undefined, abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 2 }] }] },
  swine: {
    ...creature('swine', []), types: ['ritual'], attack: undefined, defense: undefined,
    abilities: [{ when: 'spell', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'sever', to: 'target' }, { op: 'createToken', token: 'pig', count: 1, for: 'targetController' }] }],
  },
  pig: creature('pig', ['Pig'], { name: 'Pig', attack: 1, defense: 1, token: true }),
};

function boardState(battlefield: Partial<Permanent>[], hands: [string[], string[]] = [[], []]): GameState {
  const state = makeTestState({ battlefield, hands, active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(20).fill('forest');
  return state;
}

describe('Core Set II constructs', () => {
  describe('an arrival trigger filtered by subtype', () => {
    it('fires for another creature of that subtype arriving under your control, and for nothing else', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'otter' }], [['fox', 'soldier'], ['fox']]), DB);
      game.submit(0, { type: 'castSpell', handIndex: 1 });
      expect(game.instanceState.players[0].life).toBe(20);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(game.instanceState.players[0].life).toBe(21);
    });

    it('names the subtype on the card', () => {
      expect(rulesText(DB.otter)).toBe('Whenever another Beastkin arrives under your control, you gain 1 life.');
    });
  });

  describe('"if you gained life this turn"', () => {
    const sunset = (state: GameState) => { enterEndStep(state, DB, () => {}); return state.battlefield.find((p) => p.iid === 1)!.plusOneCounters; };

    it('is off until you gain life, then on for the rest of the turn', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'hebe' }], [['cup'], []]), DB);
      expect(sunset(structuredClone(game.instanceState))).toBe(0);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(sunset(structuredClone(game.instanceState))).toBe(1);
    });

    it('counts Blood Oath\'s life gain', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'hebe' }, { iid: 2, cardId: 'oathkeeper' }]), DB);
      game.submit(0, { type: 'passStep' });
      game.submit(0, { type: 'declareAttackers', attackers: [2] });
      game.submit(1, { type: 'declareBlockers', blocks: [] });
      expect(game.instanceState.gainedLifeThisTurn).toEqual([0]);
    });

    it('reads only your own life gain', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'hebe', controller: 1 }], [['cup'], []]), DB);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(sunset(structuredClone(game.instanceState))).toBe(0);
    });

    it('resets at the next turn, and survives the AI\'s determinized copy', () => {
      const game = Game.restore(boardState([], [['cup'], []]), DB);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(determinize(game.viewFor(1), DB).instanceState.gainedLifeThisTurn).toEqual([0]);
      const state = structuredClone(game.instanceState) as GameState;
      state.activePlayer = 1;
      startTurn(state, DB, () => {});
      expect(state.gainedLifeThisTurn).toBeUndefined();
    });

    it('reads as a condition on the card', () => {
      expect(rulesText(DB.hebe)).toMatch(/^At Sunset, if you gained life this turn, /);
    });
  });

  describe('a token for the target\'s controller', () => {
    it('goes to the controller of the creature the spell removed', () => {
      const game = Game.restore(boardState([{ iid: 2, cardId: 'soldier', controller: 1 }], [['swine'], []]), DB);
      game.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 2 }] });
      const field = game.instanceState.battlefield;
      expect(field.some((p) => p.iid === 2)).toBe(false);
      expect(field.filter((p) => p.cardId === 'pig').map((p) => p.controller)).toEqual([1]);
    });

    it('reads as card text', () => {
      expect(rulesText(DB.swine)).toBe('Sever target creature an opponent controls, then its controller creates one token.');
    });
  });
});
