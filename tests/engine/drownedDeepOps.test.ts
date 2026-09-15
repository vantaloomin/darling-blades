import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { runOps, fireTriggers } from '../../src/engine/effects/EffectInterpreter';
import { destroyPermanent } from '../../src/engine/battlefield';
import { getEffectiveStats } from '../../src/engine/statics';
import { resolveCombatDamage } from '../../src/engine/combat/damage';
import { finishCleanup } from '../../src/engine/phases';
import { cardIdOf, type EffectOp } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';
const db = dbOf(card('body'), card('token', { token: true }), card('bride', { abilities: [{ when: 'dies', ops: [{ op: 'reclaimSelf' }] }] }),
  spell('edict', [{ op: 'sacrifice', who: 'each', n: 1 }, { op: 'gainLife', n: 3 }]),
  spell('opponentEdict', [{ op: 'sacrifice', who: 'opponent', n: 1 }]));
const context = { controller: 0 as const, sourceCardId: 'body', sourceIid: 1, targets: [ref(2)] };
describe('Drowned Deep 4: effect operations', () => {
  it.each([
    [{ op: 'tapAll', who: 'opponent' }, [false, true, false]],
    [{ op: 'damage', n: 1, to: 'eachOpponentCreature' }, [0, 1, 0]],
    [{ op: 'markAll', scope: 'yourCreatures', other: true }, [0, 0, 1]],
    [{ op: 'boost', p: 1, t: 0, scope: 'self' }, [1, 0, 0]],
    [{ op: 'preventCombatTo', to: 'target' }, [false, true, false]],
  ] as [EffectOp, (number | boolean)[]][])('%j touches only its intended scope, deterministically', (op, expected) => {
    const play = () => {
      const state = board([[], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body', controller: 1 }, { iid: 3, cardId: 'body' }, { iid: 4, cardId: 'forest', controller: 1 }]);
      runOps(state, db, () => {}, context, [op]);
      const value = (p: typeof state.battlefield[number]) => op.op === 'tapAll' ? p.tapped : op.op === 'damage' ? p.damage : op.op === 'markAll' ? p.plusOneCounters : op.op === 'boost' ? p.untilEotMods.length : !!p.combatDamagePrevented;
      expect(state.battlefield.slice(0, 3).map(value)).toEqual(expected);
      expect(value(state.battlefield[3])).toBe(op.op === 'tapAll' || op.op === 'preventCombatTo' ? false : 0);
      return JSON.stringify(state);
    }; expect(play()).toBe(play());
  });
  it('preventCombatTo prevents only incoming combat damage and associated Blood Oath', () => {
    const local = { ...db, body: card('body', { keywords: ['bloodoath'] }) };
    const state = board([[], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body', controller: 1 }]);
    state.combat = { attackers: [1], blocks: [{ attacker: 1, blocker: 2 }], phase: 'blockersDeclared', damagePrevented: false };
    runOps(state, local, () => {}, context, [{ op: 'preventCombatTo', to: 'target' }]);
    resolveCombatDamage(state, local, () => {});
    expect(state.battlefield.map(p => p.damage)).toEqual([2, 0]); expect(state.players.map(p => p.life)).toEqual([20, 22]);
    runOps(state, local, () => {}, context, [{ op: 'damage', n: 1, to: 'target' }]); expect(state.battlefield[1].damage).toBe(1);
    finishCleanup(state, local, () => {}); expect(state.battlefield[1].combatDamagePrevented).toBeUndefined();
  });
  it('reclaimSelf binds the dead physical copy and its owner, never a token or absent source', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'bride', owner: 1, controller: 0 }]);
    state.battlefield[0].instanceId = 21; state.players[1].graveyard = [{ cardId: 'bride', instanceId: 20, variantKey: null }];
    const source = state.battlefield[0]; destroyPermanent(state, db, source, () => {}); fireTriggers(state, db, () => {}, 'dies', source);
    expect(state.players[1].hand).toEqual([{ cardId: 'bride', instanceId: 21, variantKey: null }]);
    expect(state.players[1].graveyard).toHaveLength(1); expect(state.players[0].hand).toEqual([]);
    runOps(state, db, () => {}, context, [{ op: 'reclaimSelf' }]); expect(state.players[1].graveyard).toHaveLength(1);
    const tokenState = board([[], []], [{ iid: 1, cardId: 'bride' }]);
    tokenState.battlefield[0].isToken = true;
    const token = tokenState.battlefield[0]; destroyPermanent(tokenState, db, token, () => {}); fireTriggers(tokenState, db, () => {}, 'dies', token);
    expect(tokenState.players[0].hand).toEqual([]);
  });
  it('tokens arrive marked and raised keywords survive cleanup but not a later re-entry', () => {
    const state = board(); runOps(state, db, () => {}, context, [{ op: 'createToken', token: 'token', count: 1, marks: 2 }]);
    expect(state.battlefield[0].plusOneCounters).toBe(2);
    state.players[0].graveyard = ['body'];
    runOps(state, db, () => {}, { ...context, targets: [{ kind: 'grave', player: 0, index: 0 }] }, [{ op: 'raise', grantKeywords: ['dreaded'] }]);
    const raised = state.battlefield[1]; expect(getEffectiveStats(state.battlefield, db, raised.iid).keywords.has('dreaded')).toBe(true);
    finishCleanup(state, db, () => {}); expect(getEffectiveStats(state.battlefield, db, raised.iid).keywords.has('dreaded')).toBe(true);
    runOps(state, db, () => {}, { ...context, targets: [] }, [{ op: 'raise', grantKeywords: ['skyborne'] }]); expect(state.battlefield).toHaveLength(2);
    destroyPermanent(state, db, raised, () => {});
    runOps(state, db, () => {}, context, [{ op: 'raise', to: 'top' }]);
    const returned = state.battlefield.at(-1)!;
    expect(getEffectiveStats(state.battlefield, db, returned.iid).keywords.has('dreaded')).toBe(false);
  });
  it('each edict lets the caster choose first, then the opponent, then resumes caster effects', () => {
    const play = () => {
      const game = Game.restore(board([['edict'], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body', controller: 1 }, { iid: 3, cardId: 'body', controller: 1 }]), db);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', decision: 'sacrifice', player: 0 });
      expect(() => game.submit(0, { type: 'chooseTarget', target: ref(2) })).toThrow();
      game.submit(0, { type: 'chooseTarget', target: ref(1) });
      expect(game.awaiting).toMatchObject({ player: 1, decision: 'sacrifice' }); expect(game.instanceState.players[0].life).toBe(20);
      game.submit(1, { type: 'chooseTarget', target: ref(3) });
      expect(game.instanceState.players[0].life).toBe(23); expect(game.instanceState.battlefield.map(p => p.iid)).toEqual([2]);
      return JSON.stringify(game.instanceState);
    }; expect(play()).toBe(play());
  });
  it('opponent edicts bypass Untouchable and empty boards skip the choice', () => {
    const local = { ...db, body: card('body', { keywords: ['untouchable'] }) };
    const game = Game.restore(board([['opponentEdict'], []], [{ iid: 2, cardId: 'body', controller: 1 }]), local);
    game.submit(0, { type: 'castSpell', handIndex: 0 }); game.submit(1, { type: 'chooseTarget', target: ref(2) });
    expect(game.instanceState.players[1].graveyard.map(cardIdOf)).toEqual(['body']);
    const empty = Game.restore(board([['opponentEdict'], []]), db); empty.submit(0, { type: 'castSpell', handIndex: 0 }); expect(empty.awaiting.kind).toBe('main');
  });
});
