import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { RULES } from '../../src/config/rules';
import { validateActivatedDef, validateEmpowerDef, validateRiteDef, cardIdOf } from '../../src/engine/types';
import { board, card, dbOf, ref, spell, zero } from '../drownedDeepFixture';
const db = dbOf(card('glass', { types: ['artifact'], activated: [
  { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
  { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] },
] }), card('single', { activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] } }), card('body'),
  { ...spell('rite', [{ op: 'destroy', to: 'target' }], [{ what: 'opponentCreature', maxCost: 2 }]), rite: { n: 1 } },
  card('saint', { empower: { cost: zero, targets: [{ what: 'opponentCreature', maxCost: 2 }], ops: [{ op: 'destroy', to: 'target' }] } }),
  card('witch', { retell: { cost: zero, targets: [{ what: 'opponentCreature' }], ops: [{ op: 'damage', to: 'target', n: 2 }] },
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 10 }] }] }));
describe('Drowned Deep 6: mechanic combinations', () => {
  it('enumerates each payable Duty index, validates the index, and emits the chosen index', () => {
    const play = () => {
      const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'glass' }, { iid: 2, cardId: 'forest' }, { iid: 3, cardId: 'forest' }]), db);
      expect(game.legalActions(0).filter(a => a.type === 'activate')).toEqual([{ type: 'activate', iid: 1, abilityIndex: 0 }, { type: 'activate', iid: 1, abilityIndex: 1 }]);
      for (const abilityIndex of [-1, 0.5, 2]) expect(() => game.submit(0, { type: 'activate', iid: 1, abilityIndex })).toThrow();
      const events = game.submit(0, { type: 'activate', iid: 1, abilityIndex: 1 });
      expect(events).toContainEqual({ e: 'activated', player: 0, iid: 1, cardId: 'glass', abilityIndex: 1 });
      expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['forest']);
      expect(game.legalActions(0).some(a => a.type === 'activate')).toBe(false);
      return JSON.stringify({ state: game.instanceState, events });
    }; expect(play()).toBe(play()); expect(validateActivatedDef(db.glass)).toEqual([]);
  });
  it('omitted index chooses zero and legacy single-object actions keep their old shape', () => {
    const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'glass' }, { iid: 2, cardId: 'single' }]), db);
    expect(game.legalActions(0).filter(a => a.type === 'activate')).toEqual([{ type: 'activate', iid: 1, abilityIndex: 0 }, { type: 'activate', iid: 2 }]);
    game.submit(0, { type: 'activate', iid: 1 }); expect(game.awaiting.kind).toBe('foresee');
    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.submit(0, { type: 'activate', iid: 2 })).toContainEqual({ e: 'activated', player: 0, iid: 2, cardId: 'single' });
  });
  it('targeted Rite pays sacrifices before the independently chosen target resolves', () => {
    expect(validateRiteDef(db.rite)).toEqual([]);
    const game = Game.restore(board([['rite'], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body', controller: 1 }]), db);
    const cast = game.legalActions(0).find(a => a.type === 'castSpell'); expect(cast).toMatchObject({ targets: [ref(2)], sacrifices: [1] });
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)], sacrifices: [1] })).toThrow();
    game.submit(0, cast!); expect(game.instanceState.battlefield).toEqual([]);
  });
  it('Empower destroy accepts one qualified target and refuses an illegal target', () => {
    expect(validateEmpowerDef(db.saint)).toEqual([]);
    const game = Game.restore(board([['saint'], []], [{ iid: 1, cardId: 'giant', controller: 1 }, { iid: 2, cardId: 'bear', controller: 1 }]), db);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, empowered: true, targets: [ref(1)] })).toThrow();
    game.submit(0, { type: 'castSpell', handIndex: 0, empowered: true, targets: [ref(2)] });
    expect(game.instanceState.battlefield.map(p => p.cardId)).toEqual(['giant', 'saint']);
  });
  it('creature Retell resolves only its override then severs, even on a full battlefield', () => {
    const state = board([[], []], [...Array.from({ length: RULES.maxCreatures }, (_, i) => ({ iid: i + 1, cardId: 'body' })), { iid: 99, cardId: 'body', controller: 1 as const }]);
    state.players[0].graveyard = ['witch'];
    const game = Game.restore(state, db); const action = game.legalActions(0).find(a => a.type === 'castSpell' && a.retell);
    expect(action).toMatchObject({ graveIndex: 0, targets: [ref(99)] }); game.submit(0, action!);
    expect(game.instanceState.battlefield.some(p => p.cardId === 'witch')).toBe(false);
    expect(game.instanceState.players[0].life).toBe(20); expect(game.instanceState.players[0].severed.map(cardIdOf)).toEqual(['witch']);
    expect(game.instanceState.battlefield.find(p => p.iid === 99)?.damage).toBe(2);
    expect(() => game.submit(0, action!)).toThrow();
  });
});
