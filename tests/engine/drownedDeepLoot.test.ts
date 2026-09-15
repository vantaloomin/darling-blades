import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { cardIdOf } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';
const ops = [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }, { op: 'gainLife', n: 2 }] as const;
const db = dbOf(card('looter', { activated: { cost: { tap: true }, ops: [...ops] } }),
  card('arrival', { abilities: [{ when: 'arrives', ops: [...ops] }] }),
  spell('loot', [...ops]), spell('nested', [{ op: 'discard', n: 1, who: 'self' }, { op: 'foresee', n: 2 }, { op: 'discard', n: 1, who: 'self' }, { op: 'gainLife', n: 3 }]),
  spell('bound', [{ op: 'discard', n: 1, who: 'self' }, { op: 'addCounters', n: 1, to: 'target' }], [{ what: 'yourCreature' }]));
describe('Drowned Deep 1: loot', () => {
  it.each(['Duty', 'arrival', 'spell'])('%s exposes the whole hand, requires exactly one, and resumes the controller tail', kind => {
    const game = Game.restore(board(kind === 'Duty' ? [['bear'], []] : [[kind === 'arrival' ? 'arrival' : 'loot', 'bear'], []], [{ iid: 1, cardId: 'looter' }]), db);
    if (kind === 'Duty') game.submit(0, { type: 'activate', iid: 1 });
    else game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'discardToHandSize', player: 0, count: 1, decision: 'discard' });
    expect(game.viewFor(0).you.hand).toEqual(['bear', 'forest']);
    expect(game.viewFor(1).opp.handCount).toBe(2);
    expect(game.instanceState.players[0].life).toBe(20);
    expect(() => game.submit(1, { type: 'discard', handIndices: [0] })).toThrow();
    expect(() => game.submit(0, { type: 'discard', handIndices: [] })).toThrow();
    expect(() => game.submit(0, { type: 'discard', handIndices: [0, 0] })).toThrow();
    game.submit(0, { type: 'discard', handIndices: [1] });
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['bear']);
    expect(game.instanceState.players[0].life).toBe(22);
    expect(game.instanceState.turn).toBe(3);
    expect(game.awaiting.kind).toBe('main');
  });
  it('empty hands skip and short hands clamp the mandatory count', () => {
    const state = board(); runOps(state, db, () => {}, { controller: 0, sourceCardId: 'loot', targets: [] }, [{ op: 'discard', n: 4, who: 'self' }]);
    expect(state.pendingDecisions).toEqual([]);
    state.players[0].hand = ['bear'];
    runOps(state, db, () => {}, { controller: 0, sourceCardId: 'loot', targets: [] }, [{ op: 'discard', n: 4, who: 'self' }]);
    const game = Game.restore(state, db); game.submit(0, { type: 'passStep' });
    expect(game.awaiting).toMatchObject({ count: 1 });
  });
  it('chains discard, Foresee, discard without losing source context or order', () => {
    const play = () => {
      const game = Game.restore(board([['nested', 'bear', 'giant'], []]), db);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      game.submit(0, { type: 'discard', handIndices: [0] });
      expect(game.awaiting.kind).toBe('foresee');
      game.submit(0, { type: 'foresee', bottomIndices: [1] });
      expect(game.awaiting.kind).toBe('discardToHandSize');
      game.submit(0, { type: 'discard', handIndices: [0] });
      expect(game.instanceState.players[0].life).toBe(23);
      return JSON.stringify(game.instanceState);
    };
    expect(play()).toBe(play());
  });
  it('retains an inline target across the discard continuation', () => {
    const game = Game.restore(board([['bound', 'bear'], []], [{ iid: 1, cardId: 'looter' }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    game.submit(0, { type: 'discard', handIndices: [0] });
    expect(game.instanceState.battlefield[0].plusOneCounters).toBe(1);
  });
  it('a chosen loot discard enables Whispers through the existing hand-to-graveyard rule', () => {
    const local = { ...db, whisper: card('whisper', { cost: { generic: 9, pips: {} }, whispers: { cost: { generic: 0, pips: {} } } }) };
    const game = Game.restore(board([['whisper'], []], [{ iid: 1, cardId: 'looter' }]), local);
    game.submit(0, { type: 'activate', iid: 1 });
    game.submit(0, { type: 'discard', handIndices: [0] });
    expect(game.viewFor(0).you.whispersLive).toEqual([0]);
    expect(game.legalActions(0)).toContainEqual({ type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true });
  });

});
