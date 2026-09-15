import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { conditionSatisfied, fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import { destroyPermanent } from '../../src/engine/battlefield';
import { cardIdOf } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

const db = dbOf(
  card('bell', { abilities: [{ when: 'youCastCharm', ops: [{ op: 'foresee', n: 1 }] }] }),
  card('drawCharm', { types: ['charm'], abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }] }] }),
  card('lootCharm', { types: ['charm'], abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }, { op: 'discard', who: 'self', n: 1 }] }] }),
  card('looter', { activated: { cost: { tap: true }, ops: [
    { op: 'discard', n: 1, who: 'self' }, { op: 'damage', n: 3, to: 'opponent' },
  ] } }),
  card('buried', { abilities: [{ when: 'entersGraveyard', ops: [
    { op: 'foresee', n: 1 }, { op: 'gainLife', n: 2 },
  ] }] }),
  card('buriedLoot', { abilities: [{ when: 'entersGraveyard', ops: [
    { op: 'foresee', n: 1 }, { op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }, { op: 'gainLife', n: 2 },
  ] }] }),
  card('borrowed', { abilities: [{ when: 'entersGraveyard', ops: [{ op: 'createToken', token: 'spawn', count: 1 }] }] }),
  card('spawn', { token: true }),
  spell('each', [{ op: 'sacrifice', who: 'each', n: 1 }, { op: 'gainLife', n: 1 }]),
  card('saint', { abilities: [{ when: 'youGainLife', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }] }),
  card('shaman', { abilities: [{ when: 'youAddMark', ops: [{ op: 'gainLife', n: 1 }] }] }),
  card('warder', { abilities: [{ when: 'dawn', targets: [{ what: 'creature', minAttack: 4 }], ops: [{ op: 'damage', n: 3, to: 'target' }] }] }),
  card('link', { types: ['artifact'], hauntlink: { cost: { generic: 0, pips: {} }, linked: { p: 2 } } }),
  card('bride', { abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }, { op: 'reclaimSelf' }] }] }),
);

describe('Drowned Deep: decision continuation and response order', () => {
  it('finishes Bell Below Foresee before auto-resolving the Charm that triggered it', () => {
    const state = board([['drawCharm'], []], [{ iid: 1, cardId: 'bell' }]);
    state.players[0].deck = ['forest', 'giant', 'bear'];
    const game = Game.restore(state, db);
    const castEvents = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'foresee', player: 0, cards: ['bear'] });
    expect(game.instanceState.stack).toHaveLength(1);
    expect(game.instanceState.players[0].hand).toEqual([]);
    expect(castEvents.some(event => event.e === 'spellResolved' || event.e === 'responseWindowOpened')).toBe(false);
    game.submit(0, { type: 'foresee', bottomIndices: [0] });
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['giant']);
    expect(game.instanceState.stack).toEqual([]);
    expect(game.awaiting.kind).toBe('main');
  });

  it('offers the opponent response once, after the cast-observer choice settles', () => {
    const game = Game.restore(board([['drawCharm'], ['drawCharm']], [{ iid: 1, cardId: 'bell' }]), db);
    const castEvents = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(castEvents.some(event => event.e === 'responseWindowOpened')).toBe(false);
    expect(() => game.submit(1, { type: 'passResponse' })).toThrow();
    const choiceEvents = game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(choiceEvents.filter(event => event.e === 'responseWindowOpened')).toEqual([{ e: 'responseWindowOpened', player: 1 }]);
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 1, over: { type: 'spell' } });
    expect(game.instanceState.stack).toHaveLength(1);
    expect(game.instanceState.players[0].hand).toEqual([]);
    game.submit(1, { type: 'passResponse' });
    expect(game.instanceState.stack).toEqual([]);
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['forest']);
  });

  it('drains every cast observer before offering a response and pins their order', () => {
    const play = () => {
      const state = board([['drawCharm'], ['drawCharm']], [{ iid: 1, cardId: 'bell' }, { iid: 2, cardId: 'bell' }]);
      state.players[0].deck = ['forest', 'giant', 'bear'];
      const game = Game.restore(state, db);
      const events = [...game.submit(0, { type: 'castSpell', handIndex: 0 })];
      expect(game.viewFor(1).pendingDecisions).toHaveLength(2);
      expect(game.viewFor(1).awaiting).toMatchObject({ kind: 'foresee', cards: [] });
      events.push(...game.submit(0, { type: 'foresee', bottomIndices: [0] }));
      expect(game.awaiting).toMatchObject({ kind: 'foresee', cards: ['giant'] });
      expect(events.some(event => event.e === 'responseWindowOpened')).toBe(false);
      events.push(...game.submit(0, { type: 'foresee', bottomIndices: [] }));
      expect(game.awaiting).toMatchObject({ kind: 'respond', player: 1 });
      expect(events.filter(event => event.e === 'triggerFired').map(event => event.iid)).toEqual([1, 2]);
      return JSON.stringify({ events, state: game.instanceState });
    };
    expect(play()).toBe(play());
  });

  it.each(['buried', 'buriedLoot'])('resolves %s graveyard decisions before the loot outer tail', cardId => {
    const game = Game.restore(board([[cardId, 'bear'], []], [{ iid: 1, cardId: 'looter' }]), db);
    game.submit(0, { type: 'activate', iid: 1 });
    game.submit(0, { type: 'discard', handIndices: [0] });
    expect(game.awaiting.kind).toBe('foresee');
    expect(game.instanceState.players.map(player => player.life)).toEqual([20, 20]);
    let finishEvents = game.submit(0, { type: 'foresee', bottomIndices: [] });
    if (cardId === 'buriedLoot') {
      expect(game.awaiting).toMatchObject({ kind: 'discardToHandSize', decision: 'discard' });
      expect(game.instanceState.players.map(player => player.life)).toEqual([20, 20]);
      finishEvents = game.submit(0, { type: 'discard', handIndices: [1] });
    }
    expect(finishEvents.filter(event => event.e === 'lifeChanged').map(event => event.delta)).toEqual([2, -3]);
    expect(game.instanceState.players.map(player => player.life)).toEqual([22, 17]);
    expect(game.awaiting.kind).toBe('main');
  });

  it('keeps the legacy prohibition against targeted ops after a Duty Foresee', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'looter' }]);
    expect(() => runOps(state, db, () => {}, { controller: 0, sourceCardId: 'looter', sourceIid: 1, activated: true,
      targets: [{ kind: 'permanent', iid: 1 }] }, [{ op: 'foresee', n: 1 }, { op: 'addCounters', n: 1, to: 'target' }])).toThrow('target-dependent');
  });

  it('rechecks the second edict seat after the first sacrifice creates its creature', () => {
    const game = Game.restore(board([['each'], []], [{ iid: 1, cardId: 'borrowed', controller: 0, owner: 1 }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, decision: 'sacrifice' });
    game.submit(0, { type: 'chooseTarget', target: ref(1) });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 1, decision: 'sacrifice' });
    expect(game.instanceState.players[0].life).toBe(20);
    const spawn = game.instanceState.battlefield.find(perm => perm.cardId === 'spawn')!;
    expect(spawn.controller).toBe(1);
    game.submit(1, { type: 'chooseTarget', target: ref(spawn.iid) });
    expect(game.instanceState.battlefield).toEqual([]);
    expect(game.instanceState.players[0].life).toBe(21);
    expect(game.awaiting.kind).toBe('main');
  });

  it('preserves the existing depth-eight guard across life-gain and mark observers', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'saint' }, { iid: 2, cardId: 'shaman' }]);
    expect(() => runOps(state, db, () => {}, { controller: 0, sourceCardId: 'saint', targets: [] },
      [{ op: 'gainLife', n: 1 }])).toThrow('Mark-trigger recursion exceeded depth 8.');
    expect(state.battlefield[0].plusOneCounters).toBe(10);
  });

  it('does not share mark-observer availability between databases with the same stand-in', () => {
    const standIn = card('__unknown_c2');
    const bareDb = { ...dbOf(card('body')), __unknown_c2: standIn };
    const bare = board([[], []], [{ iid: 1, cardId: 'body' }]);
    runOps(bare, bareDb, () => {}, { controller: 0, sourceCardId: 'body', sourceIid: 1, targets: [] },
      [{ op: 'addCounters', n: 1, to: 'self' }]);
    const observedDb = { ...db, __unknown_c2: standIn };
    const observed = board([[], []], [{ iid: 1, cardId: 'shaman' }]);
    runOps(observed, observedDb, () => {}, { controller: 0, sourceCardId: 'shaman', sourceIid: 1, targets: [] },
      [{ op: 'addCounters', n: 1, to: 'self' }]);
    expect(observed.players[0].life).toBe(21);
  });

  it('requires another Horror creature, excluding Horror noncreatures', () => {
    const condition = { kind: 'controlsOther', subtype: 'Horror' } as const;
    const artifactDb = dbOf(card('source'), card('relic', { types: ['artifact'] }));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }, { iid: 2, cardId: 'relic' }]);
    expect(conditionSatisfied(state, artifactDb, 0, condition, 1)).toBe(false);
    state.battlefield[1].cardId = 'source';
    expect(conditionSatisfied(state, artifactDb, 0, condition, 1)).toBe(true);
  });

  it('raises loot created when a Bell Below choice resumes its suspended Charm', () => {
    const game = Game.restore(board([['lootCharm'], []], [{ iid: 1, cardId: 'bell' }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting.kind).toBe('foresee');
    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.awaiting).toMatchObject({ kind: 'discardToHandSize', decision: 'discard', count: 1 });
    game.submit(0, { type: 'discard', handIndices: [0] });
    expect(game.awaiting.kind).toBe('main');
    expect(game.instanceState.pendingDecisions).toEqual([]);
    expect(game.instanceState.stack).toEqual([]);
  });

  it('revalidates a deferred Dawn attack qualifier after the Hauntlink window', () => {
    const state = board([[], []], [
      { iid: 1, cardId: 'warder', controller: 0 },
      { iid: 2, cardId: 'bear', controller: 1, attachments: [4] },
      { iid: 3, cardId: 'bear', controller: 1 },
      { iid: 4, cardId: 'link', controller: 1, attachedTo: 2 },
    ]);
    fireTriggers(state, db, () => {}, 'dawn', state.battlefield[0]);
    state.awaiting = { kind: 'chooseTarget', player: 0, sourceIid: 1, abilityIndex: 0, targets: [ref(2)] };
    const game = Game.restore(state, db);
    game.submit(0, { type: 'chooseTarget', target: ref(2) });
    expect(game.awaiting).toMatchObject({ kind: 'hauntlinkWindow', player: 1 });
    expect(game.viewFor(0).pendingDecisions?.[0]).toMatchObject({ kind: 'resolveTrigger', targetSpecs: [{ what: 'creature', minAttack: 4 }] });
    game.submit(1, { type: 'linkHaunt', iid: 4, hostIid: 3 });
    game.submit(1, { type: 'passResponse' });
    expect(game.instanceState.battlefield.find(perm => perm.iid === 2)?.damage).toBe(0);
    expect(game.awaiting.kind).toBe('main');
  });

  it('retains the dead source instance and owner through Foresee before reclaimSelf', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'bride', owner: 1, controller: 0 }]);
    state.battlefield[0].instanceId = 101;
    state.players[1].graveyard = [{ instanceId: 100, cardId: 'bride', variantKey: null }];
    const dead = state.battlefield[0];
    destroyPermanent(state, db, dead, () => {});
    fireTriggers(state, db, () => {}, 'dies', dead);
    state.awaiting = { kind: 'foresee', player: 0, cards: state.players[0].deck.slice(-1) };
    const game = Game.restore(state, db);
    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.instanceState.players[1].hand).toMatchObject([{ instanceId: 101, cardId: 'bride' }]);
    expect(game.instanceState.players[1].graveyard).toMatchObject([{ instanceId: 100, cardId: 'bride' }]);
    expect(game.instanceState.players[0].hand).toEqual([]);
  });
});
