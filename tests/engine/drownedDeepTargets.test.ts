import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { enumerateTargets, isLegalTarget } from '../../src/engine/effects/targeting';
import { fireTriggers } from '../../src/engine/effects/EffectInterpreter';
import { resolveStackItem } from '../../src/engine/resolve';
import { startTurn } from '../../src/engine/phases';
import { cardIdOf, type TargetSpec } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';
const db = dbOf(card('body'), card('ward', { keywords: ['untouchable'] }),
  spell('pairs', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2 }]),
  spell('split', [{ op: 'reclaim', targetIndex: 0 }, { op: 'addCounters', n: 1, to: 'target', targetIndex: 1 }], [{ what: 'yourGraveCreature' }, { what: 'yourCreature' }]),
  card('queen', { abilities: [{ when: 'attacks', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }] }),
  card('gate', { abilities: [{ when: 'dawn', targets: [{ what: 'yourCreature', other: true }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }] }));
describe('Drowned Deep 3: target vocabulary', () => {
  it.each(['maxCost', 'minAttack'] as const)('%s enforces battlefield, stack and graveyard bounds', qualifier => {
    const state = board(); // replaced below with explicit zones
    state.battlefield = board([[], []], [{ iid: 1, cardId: 'bear' }, { iid: 2, cardId: 'giant' }]).battlefield;
    state.players[0].graveyard = ['bear', 'giant'];
    state.stack = [{ sid: 1, controller: 0, cardId: 'bear', targets: [] }, { sid: 2, controller: 1, cardId: 'giant', targets: [] }];
    for (const what of ['creature', 'spell', 'yourGraveCreature'] as const) {
      const spec: TargetSpec = { what, [qualifier]: qualifier === 'maxCost' ? 2 : 4 };
      const targets = enumerateTargets(state, db, 0, spec);
      expect(targets).toHaveLength(1);
      expect(targets.every(r => isLegalTarget(state, db, 0, spec, r))).toBe(true);
      expect(enumerateTargets(structuredClone(state), db, 0, spec)).toEqual(targets);
    }
    state.battlefield[0].plusOneCounters = 2;
    expect(isLegalTarget(state, db, 0, { what: 'creature', minAttack: 4 }, ref(1))).toBe(true);
    expect(isLegalTarget(state, db, 0, { what: 'player', [qualifier]: 2 }, { kind: 'player', player: 0 })).toBe(false);
  });
  it('opponentCreature excludes allies and untouchable enemies', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body', controller: 1 }, { iid: 3, cardId: 'ward', controller: 1 }]);
    expect(enumerateTargets(state, db, 0, { what: 'opponentCreature' })).toEqual([ref(2)]);
    expect(isLegalTarget(state, db, 0, { what: 'opponentCreature' }, ref(1))).toBe(false);
  });
  it('enumerates only distinct full pairs and refuses singles or repeated targets', () => {
    const game = Game.restore(board([['pairs'], []], [1, 2, 3].map(iid => ({ iid, cardId: 'body' }))), db);
    expect(game.legalActions(0).filter(a => a.type === 'castSpell').map(a => a.targets)).toEqual([[ref(1), ref(2)], [ref(1), ref(3)], [ref(2), ref(3)]]);
    for (const targets of [[ref(1)], [ref(1), ref(1)]]) expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets })).toThrow();
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(3)] });
    expect(game.instanceState.battlefield.map(p => p.tapped)).toEqual([true, false, true]);
    const single = Game.restore(board([['pairs'], []], [{ iid: 1, cardId: 'body' }]), db);
    expect(single.legalActions(0).some(a => a.type === 'castSpell')).toBe(false);
  });
  it('binds two independent slots and never redirects a vanished target', () => {
    const play = (remove: boolean) => {
      const state = board([[], []], [{ iid: 1, cardId: 'body' }]); state.players[0].graveyard = ['bear'];
      if (remove) state.battlefield = [];
      resolveStackItem(state, db, { sid: 1, cardId: 'split', controller: 0, targets: [{ kind: 'grave', player: 0, index: 0 }, ref(1)] }, () => {});
      expect(state.players[0].hand.map(cardIdOf)).toEqual(['bear']);
      if (!remove) expect(state.battlefield[0].plusOneCounters).toBe(1);
    };
    play(false); play(true);
  });
  it('attack and Dawn targets are mandatory controller decisions and skip without legal targets', () => {
    const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'queen' }, { iid: 2, cardId: 'body', controller: 1 }]), db);
    game.submit(0, { type: 'passStep' }); game.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, targets: [ref(2)] });
    expect(() => game.submit(0, { type: 'chooseTarget', target: ref(1) })).toThrow();
    game.submit(0, { type: 'chooseTarget', target: ref(2) });
    expect(game.instanceState.battlefield.find(p => p.iid === 2)?.damage).toBe(1);
    const state = board([[], []], [{ iid: 3, cardId: 'gate' }, { iid: 4, cardId: 'body' }]);
    startTurn(state, db, () => {}); expect(state.pendingDecisions[0]).toMatchObject({ kind: 'chooseTarget', triggerWhen: 'dawn' });
    state.battlefield = [state.battlefield[0]]; state.pendingDecisions = [];
    fireTriggers(state, db, () => {}, 'dawn', state.battlefield[0]); expect(state.pendingDecisions).toEqual([]);
  });
  it('cost caps count a chosen X on the stack while alternative payments leave printed cost unchanged', () => {
    const local = { ...db, x: card('x', { types: ['charm'], cost: { generic: 0, pips: { R: 1 } }, x: { min: 0 } }) };
    const state = board();
    state.stack = [{ sid: 1, cardId: 'x', controller: 1, targets: [], x: 3 }, { sid: 2, cardId: 'bear', controller: 1, targets: [], whispered: true }];
    expect(enumerateTargets(state, local, 0, { what: 'spell', maxCost: 2 })).toEqual([{ kind: 'stackItem', sid: 2 }]);
    expect(isLegalTarget(state, local, 0, { what: 'spell', maxCost: 4 }, { kind: 'stackItem', sid: 1 })).toBe(true);
  });

});
