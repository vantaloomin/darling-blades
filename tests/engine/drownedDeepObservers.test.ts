import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { checkStateBased } from '../../src/engine/sba';
import { conditionSatisfied, fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import { enterEndStep, startTurn } from '../../src/engine/phases';
import type { GameEvent } from '../../src/engine/events';
import type { AbilityDef } from '../../src/engine/types';
import { board, card, dbOf, spell } from '../drownedDeepFixture';
const gain = [{ op: 'gainLife', n: 1 }] as const;
const observer = (id: string, filter?: AbilityDef['filter']) => card(id, { abilities: [{ when: 'allyDies', filter, ops: [...gain] }] });
const db = dbOf(observer('widow'), observer('other', { other: true }), observer('horror', { other: true, subtype: 'Horror' }), observer('garden', { sacrifice: true }),
  card('body'), card('beacon', { types: ['artifact'], abilities: [{ when: 'sunset', condition: 'creatureDiedThisTurn', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }] }),
  card('saint', { abilities: [{ when: 'youGainLife', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }] }),
  card('bell', { types: ['artifact'], abilities: [{ when: 'youCastCharm', ops: [{ op: 'foresee', n: 1 }] }] }),
  card('storm', { types: ['enchantment'], abilities: [{ when: 'allyAttacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }] }),
  spell('rite', [...gain]), { ...spell('charm', [...gain]), types: ['charm'] });
describe('Drowned Deep 2: observers', () => {
  it('fires batched allied deaths in battlefield order, including dying observers', () => {
    const run = () => {
      const state = board([[], []], [{ iid: 3, cardId: 'other', damage: 9 }, { iid: 1, cardId: 'widow', damage: 9 }, { iid: 2, cardId: 'body', damage: 9 }]);
      const events: GameEvent[] = []; checkStateBased(state, db, e => events.push(e));
      const order = events.filter(e => e.e === 'triggerFired').map(e => e.iid);
      expect(order).toEqual([1, 3, 1, 3, 1]); expect(state.players[0].life).toBe(25);
      expect(state.creatureDiedThisTurn).toBe(true); return JSON.stringify({ state, events });
    }; expect(run()).toBe(run());
  });
  it.each(['widow', 'other', 'horror', 'garden'])('%s refuses nonmatching deaths and observes only its printed subject', id => {
    const state = board([[], []], [{ iid: 1, cardId: id }, { iid: 2, cardId: 'bear', damage: 9, controller: 1 }]);
    checkStateBased(state, db, () => {}); expect(state.players[0].life).toBe(20);
    state.battlefield.push(...board([[], []], [{ iid: 3, cardId: 'body', damage: 9 }]).battlefield);
    checkStateBased(state, db, () => {}); expect(state.players[0].life).toBe(id === 'garden' ? 20 : 21);
  });
  it.each(['Rite', 'Tithe'])('counts %s sacrifices for the sacrifice-only observer', mechanic => {
    const source = card('payment', { ...(mechanic === 'Rite' ? { types: ['ritual'] as ('ritual')[], rite: { n: 1 } } : { tithe: { per: 2 as const }, cost: { generic: 2, pips: {} } }) });
    const local = { ...db, payment: { ...source, types: [...source.types] } };
    const game = Game.restore(board([['payment'], []], [{ iid: 1, cardId: 'garden' }, { iid: 2, cardId: 'body' }]), local);
    game.submit(0, { type: 'castSpell', handIndex: 0, sacrifices: [2], ...(mechanic === 'Tithe' ? { tithe: true } : {}) });
    expect(game.instanceState.players[0].life).toBe(21);
  });
  it('gain-life marks only the gaining controller and zero gain does not fire', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'saint' }, { iid: 2, cardId: 'saint', controller: 1 }]);
    runOps(state, db, () => {}, { controller: 0, sourceCardId: 'saint', targets: [] }, [{ op: 'gainLife', n: 0 }, { op: 'gainLife', n: 2 }]);
    expect(state.battlefield.map(p => p.plusOneCounters)).toEqual([1, 0]);
  });
  it('Charm cast observes casting and retains the observer controller through Foresee', () => {
    const game = Game.restore(board([['charm'], []], [{ iid: 1, cardId: 'bell' }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0 }); expect(game.awaiting).toMatchObject({ kind: 'foresee', player: 0 });
    game.submit(0, { type: 'foresee', bottomIndices: [] }); expect(game.instanceState.players[0].life).toBe(21);
    const state = board([['rite'], []], [{ iid: 1, cardId: 'bell' }]); const ritual = Game.restore(state, db);
    ritual.submit(0, { type: 'castSpell', handIndex: 0 }); expect(ritual.awaiting.kind).toBe('main');
  });
  it('unmarked allied attackers trigger the general observer but opposing attackers do not', () => {
    const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'storm' }, { iid: 2, cardId: 'body' }, { iid: 3, cardId: 'storm', controller: 1 }]), db);
    game.submit(0, { type: 'passStep' }); game.submit(0, { type: 'declareAttackers', attackers: [2] });
    expect(game.instanceState.players.map(p => p.life)).toEqual([20, 19]);
  });
  it('controlsOther checks a different controlled Horror', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'body' }]); const condition = { kind: 'controlsOther' as const, subtype: 'Horror' };
    expect(conditionSatisfied(state, db, 0, condition, 1)).toBe(false);
    state.battlefield.push(...board([[], []], [{ iid: 2, cardId: 'body', controller: 1 }]).battlefield);
    expect(conditionSatisfied(state, db, 0, condition, 1)).toBe(false);
    state.battlefield[1].controller = 0; expect(conditionSatisfied(state, db, 0, condition, 1)).toBe(true);
  });
  it('Sunset checks the death flag and the next Dawn clears it', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'beacon' }]);
    fireTriggers(state, db, () => {}, 'sunset', state.battlefield[0]); expect(state.players[1].life).toBe(20);
    state.creatureDiedThisTurn = true; enterEndStep(state, db, () => {}); expect(state.players[1].life).toBe(19);
    startTurn(state, db, () => {}); expect(state.creatureDiedThisTurn).toBeUndefined();
  });
});
