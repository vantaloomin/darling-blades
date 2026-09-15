import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { resolveStackItem } from '../../src/engine/resolve';
import { validateActivatedDef } from '../../src/engine/types';
import { board, card, dbOf, ref, spell, zero } from '../drownedDeepFixture';

const db = dbOf(
  card('body'), card('large', { attack: 4, defense: 5 }), card('ward', { keywords: ['untouchable'] }),
  spell('implicit', [{ op: 'damage', to: 'target', n: 1 }, { op: 'addCounters', to: 'target', n: 1, targetIndex: 1 }], [{ what: 'opponentCreature', maxCost: 2 }, { what: 'yourCreature' }]),
  spell('nested', [{ op: 'ifTargetMarked', then: [{ op: 'damage', to: 'target', n: 1, targetIndex: 1 }] }], [{ what: 'yourCreature' }, { what: 'opponentCreature' }]),
  spell('nested-inherit', [{ op: 'ifTargetMarked', targetIndex: 1, then: [{ op: 'damage', to: 'target', n: 1 }] }], [{ what: 'yourCreature' }, { what: 'opponentCreature', minAttack: 4 }]),
  spell('nested-discard', [{ op: 'ifTargetMarked', then: [{ op: 'discard', who: 'self', n: 1 }, { op: 'damage', to: 'target', n: 1, targetIndex: 1 }] }], [{ what: 'yourCreature' }, { what: 'opponentCreature' }]),
  spell('pair', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2, minAttack: 4 }]),
  spell('mixed', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2 }, { what: 'yourCreature' }]),
  spell('conflicting', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2, upTo: 2 }]),
  card('empower', {
    empower: { cost: zero, targets: [{ what: 'opponentCreature', minAttack: 4 }], ops: [{ op: 'destroy', to: 'target' }] },
    abilities: [{ when: 'arrives', ops: [{ op: 'boost', p: -3, t: 0, scope: 'all' }] }],
  }),
);

describe('Drowned Deep target-slot regression coverage', () => {
  it.each([false, true])('keeps implicit slot zero fixed when its target vanished=%s', vanished => {
    const play = () => {
      const state = board([[], []], [
        ...(!vanished ? [{ iid: 1, cardId: 'body', controller: 1 as const }] : []),
        { iid: 2, cardId: 'body' },
      ]);
      resolveStackItem(state, db, { sid: 1, controller: 0, cardId: 'implicit', targets: [ref(1), ref(2)] }, () => {});
      expect(state.battlefield.find(p => p.iid === 2)).toMatchObject({ damage: 0, plusOneCounters: 1 });
      if (!vanished) expect(state.battlefield.find(p => p.iid === 1)?.damage).toBe(1);
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });

  it.each(['body', 'ward'])('binds a nested explicit slot and rechecks legality against %s', targetCard => {
    const state = board([[], []], [{ iid: 1, cardId: 'body', plusOneCounters: 1 }, { iid: 2, cardId: targetCard, controller: 1 }]);
    resolveStackItem(state, db, { sid: 1, controller: 0, cardId: 'nested', targets: [ref(1), ref(2)] }, () => {});
    expect(state.battlefield[1].damage).toBe(targetCard === 'body' ? 1 : 0);
    expect(state.battlefield[0].damage).toBe(0);
  });

  it('lets an unindexed conditional rider inherit its parent selected slot', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'large', controller: 1, plusOneCounters: 1 }]);
    resolveStackItem(state, db, { sid: 1, controller: 0, cardId: 'nested-inherit', targets: [ref(1), ref(2)] }, () => {});
    expect(state.battlefield.map(p => p.damage)).toEqual([0, 1]);
  });

  it('preserves original target slots through a nested discard continuation', () => {
    const game = Game.restore(board([['nested-discard', 'body'], []], [{ iid: 1, cardId: 'body', plusOneCounters: 1 }, { iid: 2, cardId: 'body', controller: 1 }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(2)] });
    expect(game.awaiting).toMatchObject({ kind: 'discardToHandSize', decision: 'discard' });
    game.submit(0, { type: 'discard', handIndices: [0] });
    expect(game.instanceState.battlefield.map(p => p.damage)).toEqual([0, 1]);
  });

  it('filters a partially illegal exact pair without dropping the surviving target', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'large' }]);
    resolveStackItem(state, db, { sid: 1, controller: 0, cardId: 'pair', targets: [ref(1), ref(2)] }, () => {});
    expect(state.battlefield.map(p => p.tapped)).toEqual([false, true]);
  });

  it('rechecks Empower target qualifiers after arrival effects', () => {
    const state = board([[], []], [{ iid: 2, cardId: 'large', controller: 1 }]);
    resolveStackItem(state, db, { sid: 1, controller: 0, cardId: 'empower', empowered: true, targets: [ref(2)] }, () => {});
    expect(state.battlefield.map(p => p.cardId)).toEqual(['large', 'empower']);
  });

  it.each(['mixed', 'conflicting'])('refuses unsupported cardinality shape %s without offering casts', id => {
    const game = Game.restore(board([[id], []], [{ iid: 1, cardId: 'body' }, { iid: 2, cardId: 'body' }]), db);
    expect(game.legalActions(0).some(action => action.type === 'castSpell')).toBe(false);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(2)] })).toThrow(/exactly/);
  });

  it('rejects empty activation lists and unsupported exact-count definitions', () => {
    expect(validateActivatedDef(card('empty', { activated: [] }))).toContain('Activated list must not be empty');
    for (const targets of [
      [{ what: 'creature' as const, exactly: 2 as const }, { what: 'yourCreature' as const }],
      [{ what: 'creature' as const, exactly: 2 as const, upTo: 2 as const }],
    ]) {
      expect(validateActivatedDef(card('invalid', { activated: { cost: { tap: true }, targets, ops: [{ op: 'tap', to: 'target' }] } })))
        .toContain('Activated exactly requires one target spec with exactly 2 and no upTo');
    }
  });
});
