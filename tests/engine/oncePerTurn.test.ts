import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import { enterBattlefield, recallPermanent } from '../../src/engine/battlefield';
import {
  fireCreatureObservers, fireMarkedAllyAttackTriggers, firePlayerObservers, fireTriggers, runOps,
} from '../../src/engine/effects/EffectInterpreter';
import { startTurn } from '../../src/engine/phases';
import { createRngState } from '../../src/engine/rng';
import type { GameEvent } from '../../src/engine/events';
import type { AbilityDef, Permanent } from '../../src/engine/types';
import { board, card, dbOf, ref } from '../drownedDeepFixture';

const context = { controller: 0 as const, sourceCardId: 'source', sourceIid: 1, targets: [] };
const drain = [{ op: 'loseLife' as const, who: 'opponent' as const, n: 1 }];
const observer = (when: AbilityDef['when'], extra: Partial<AbilityDef> = {}) =>
  card('source', { abilities: [{ when, oncePerTurn: true, ops: drain, ...extra }] });

describe('once-per-turn permanent triggers', () => {
  it.each(['dd-reef-shaman', 'sb-propagation-choir'])('ends the Saint / %s chain with one Mark and one observed life gain', observerId => {
    const state = board([[], []], [
      { iid: 1, cardId: 'dd-lamp-oil-saint' }, { iid: 2, cardId: observerId },
    ]);
    const events: GameEvent[] = [];
    expect(() => runOps(state, CARD_DB, e => events.push(e), context, [{ op: 'gainLife', n: 1 }])).not.toThrow();
    expect(state.battlefield[0].plusOneCounters).toBe(1);
    expect(state.battlefield[0].firedThisTurn).toEqual([0]);
    expect(state.battlefield[1].firedThisTurn).toBeUndefined();
    expect(state.players[0].life).toBe(22);
    expect(events.filter(e => e.e === 'triggerFired').map(e => e.iid)).toEqual([1, 2]);
    expect(events.filter(e => e.e === 'lifeChanged').map(e => e.delta)).toEqual([1, 1]);
    runOps(state, CARD_DB, () => {}, context, [{ op: 'gainLife', n: 2 }]);
    expect(state.battlefield[0].plusOneCounters).toBe(1);
    expect(state.players[0].life).toBe(24);
    if (observerId === 'sb-propagation-choir') {
      expect(state.battlefield.filter(p => p.cardId === 'tok-broodling')).toHaveLength(1);
    }
  });

  it.each(['arrives', 'dies', 'attacks', 'dawn', 'combatDamageToPlayer', 'sunset'] as const)(
    'limits direct %s triggers', when => {
      const db = dbOf(observer(when));
      const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
      const events: GameEvent[] = [];
      for (let n = 0; n < 2; n++) fireTriggers(state, db, e => events.push(e), when, state.battlefield[0]);
      expect(state.players[1].life).toBe(19);
      expect(state.battlefield[0].firedThisTurn).toEqual([0]);
      expect(events.filter(e => e.e === 'triggerFired')).toHaveLength(1);
    },
  );

  it.each(['gainsMark', 'yourCreatureMarked', 'yourPermanentMarked', 'youAddMark', 'otherCreatureMarked', 'propagated'] as const)(
    'limits %s Mark observers across repeated events', when => {
      const db = dbOf(observer(when));
      const state = board([[], []], [{ iid: 1, cardId: 'source' }, { iid: 2, cardId: 'bear', plusOneCounters: 1 }]);
      const target = when === 'gainsMark' ? 1 : 2;
      for (let n = 0; n < 2; n++) runOps(state, db, () => {}, { ...context, targets: [ref(target)] },
        when === 'propagated' ? [{ op: 'propagate' }] : [{ op: 'addCounters', n: 2, to: 'target' }]);
      expect(state.players[1].life).toBe(19);
      expect(state.battlefield[0].firedThisTurn).toEqual([0]);
    },
  );

  it.each(['allyCreatureArrives', 'markedAllyAttacks', 'allyAttacks', 'allyDies'] as const)(
    'limits %s observers across different subjects', when => {
      const db = dbOf(observer(when));
      const state = board([[], []], [
        { iid: 1, cardId: 'source' }, { iid: 2, cardId: 'bear', plusOneCounters: 1 },
        { iid: 3, cardId: 'bear', plusOneCounters: 1 },
      ]);
      for (const subject of state.battlefield.slice(1)) {
        if (when === 'allyCreatureArrives') fireTriggers(state, db, () => {}, 'arrives', subject);
        else if (when === 'markedAllyAttacks') fireMarkedAllyAttackTriggers(state, db, () => {}, subject);
        else fireCreatureObservers(state, db, () => {}, when, subject);
      }
      expect(state.players[1].life).toBe(19);
      expect(state.battlefield[0].firedThisTurn).toEqual([0]);
    },
  );

  it.each(['youGainLife', 'youCastCharm'] as const)('tracks %s per ability index and per permanent', when => {
    const db = dbOf(card('source', { abilities: [
      { when, oncePerTurn: true, ops: drain },
      { when, oncePerTurn: true, ops: drain },
      { when, ops: drain },
    ] }));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }, { iid: 2, cardId: 'source' }]);
    for (let n = 0; n < 2; n++) firePlayerObservers(state, db, () => {}, when, 0);
    expect(state.players[1].life).toBe(12);
    expect(state.battlefield.map(p => p.firedThisTurn)).toEqual([[0, 1], [0, 1]]);
  });

  it('spends a flagged life observer before its own recursive life gain', () => {
    const db = dbOf(observer('youGainLife', { ops: [{ op: 'gainLife', n: 1 }] }));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
    runOps(state, db, () => {}, context, [{ op: 'gainLife', n: 1 }]);
    expect(state.players[0].life).toBe(22);
    expect(state.battlefield[0].firedThisTurn).toEqual([0]);
  });

  it('resets both players before Dawn on every turn, leaving the field absent until spent', () => {
    const db = dbOf(observer('youGainLife'), card('dawn', {
      abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] }],
    }));
    const state = board([[], []], [
      { iid: 1, cardId: 'source' }, { iid: 2, cardId: 'source', controller: 1 },
      { iid: 3, cardId: 'dawn' }, { iid: 4, cardId: 'dawn', controller: 1 },
    ]);
    firePlayerObservers(state, db, () => {}, 'youGainLife', 0);
    firePlayerObservers(state, db, () => {}, 'youGainLife', 1);
    for (const active of [1, 0] as const) {
      state.activePlayer = active;
      state.turn++;
      startTurn(state, db, () => {});
      expect(state.battlefield[active].firedThisTurn).toEqual([0]); // Spent again during this Dawn.
      const other = active === 0 ? 1 : 0;
      expect(state.battlefield[other]).not.toHaveProperty('firedThisTurn');
      firePlayerObservers(state, db, () => {}, 'youGainLife', other);
      expect(state.battlefield[other].firedThisTurn).toEqual([0]);
    }
    expect(state.players.map(p => p.life)).toEqual([18, 18]);
  });

  it('does not spend an allowance on a false condition', () => {
    const db = dbOf(observer('youCastCharm', { condition: 'creatureDiedThisTurn' }));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
    firePlayerObservers(state, db, () => {}, 'youCastCharm', 0);
    expect(state.battlefield[0]).not.toHaveProperty('firedThisTurn');
    state.creatureDiedThisTurn = true;
    firePlayerObservers(state, db, () => {}, 'youCastCharm', 0);
    expect(state.players[1].life).toBe(19);
    expect(state.battlefield[0].firedThisTurn).toEqual([0]);
  });

  it.each(['arrives', 'attacks', 'dawn', 'allyAttacks', 'allyDies'] as const)(
    'spends targeted %s only after finding a legal target, before queuing', when => {
      const db = dbOf(observer(when, {
        targets: [{ what: 'opponentCreature' }], ops: [{ op: 'damage', n: 1, to: 'target' }],
      }));
      const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
      const source = state.battlefield[0];
      const fire = () => {
        if (when === 'allyAttacks' || when === 'allyDies') fireCreatureObservers(state, db, () => {}, when, source);
        else fireTriggers(state, db, () => {}, when, source);
      };
      fire();
      expect(source).not.toHaveProperty('firedThisTurn');
      expect(state.pendingDecisions).toEqual([]);
      enterBattlefield(state, db, 'bear', 1, () => {});
      fire();
      fire();
      expect(state.pendingDecisions).toHaveLength(1);
      expect(source.firedThisTurn).toEqual([0]);
    },
  );

  it('starts clean when the same physical card leaves and re-enters', () => {
    const db = dbOf(observer('arrives'));
    const state = board();
    const source = enterBattlefield(state, db, { instanceId: 42, cardId: 'source', variantKey: null }, 0, () => {});
    fireTriggers(state, db, () => {}, 'arrives', source);
    recallPermanent(state, db, source, () => {});
    const returning = state.players[0].hand.pop()!;
    const returned = enterBattlefield(state, db, returning, 0, () => {});
    expect(returned.instanceId).toBe(42);
    expect(returned.iid).not.toBe(source.iid);
    expect(returned).not.toHaveProperty('firedThisTurn');
    fireTriggers(state, db, () => {}, 'arrives', returned);
    expect(state.players[1].life).toBe(18);
    expect(returned.firedThisTurn).toEqual([0]);
  });

  it.each(['gainsMark', 'youGainLife'] as const)('quietly skips %s past depth 8 without spending its allowance or dropping the outer tail', when => {
    const db = dbOf(observer(when));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
    const events: GameEvent[] = [];
    const op = when === 'gainsMark'
      ? { op: 'addCounters' as const, n: 1, to: 'self' as const }
      : { op: 'gainLife' as const, n: 1 };
    runOps(state, db, e => events.push(e), { ...context, markTriggerDepth: 9 }, [op, ...drain]);
    expect(events.map(e => e.e)).toEqual(when === 'gainsMark'
      ? ['effectApplied', 'effectApplied', 'lifeChanged']
      : ['effectApplied', 'lifeChanged', 'effectApplied', 'lifeChanged']);
    expect(state.battlefield[0]).not.toHaveProperty('firedThisTurn');
    expect(state.players[1].life).toBe(19);
    runOps(state, db, () => {}, { ...context, markTriggerDepth: 8 }, [op]);
    expect(state.players[1].life).toBe(18);
    expect(state.battlefield[0].firedThisTurn).toEqual([0]);
  });

  it('preserves a spent allowance across Game.clone and restore', () => {
    const db = dbOf(observer('youGainLife'));
    const state = board([[], []], [{ iid: 1, cardId: 'source' }]);
    firePlayerObservers(state, db, () => {}, 'youGainLife', 0);
    const game = Game.restore(state, db).clone();
    expect(game.instanceState.battlefield[0].firedThisTurn).toEqual([0]);
    firePlayerObservers(game.instanceState, db, () => {}, 'youGainLife', 0);
    expect(game.instanceState.players[1].life).toBe(19);
  });

  it('plays the phase D reproduction board through Game.submit and continues the duel', () => {
    const repro = JSON.parse(readFileSync(new URL('../fixtures/mark-trigger-loop.json', import.meta.url), 'utf8')) as {
      draftSeed: number; gameSeed: number; actions: number; battlefield: Permanent[];
    };
    const state = board();
    state.rng = createRngState(repro.gameSeed);
    state.battlefield = structuredClone(repro.battlefield);
    for (const player of state.players) player.deck = Array(20).fill('land-forest');
    // The supplied snapshot is post-throw (Saint tapped, 10 Marks), with no
    // action stream or player states. Re-enable her Duty to exercise this board.
    state.battlefield.find(p => p.iid === 13)!.tapped = false;
    const game = Game.restore(state, CARD_DB);
    let events: GameEvent[] = [];
    expect(() => { events = game.submit(0, { type: 'activate', iid: 13 }); }).not.toThrow();
    expect(events.filter(e => e.e === 'triggerFired').map(e => [e.iid, e.when]))
      .toEqual([[13, 'youGainLife'], [26, 'youAddMark']]);
    expect(game.instanceState.battlefield.find(p => p.iid === 13)?.plusOneCounters).toBe(11);
    expect(game.instanceState.battlefield.find(p => p.iid === 15)?.plusOneCounters).toBe(0);
    expect(game.instanceState.players[0].life).toBe(23);
    expect(game.awaiting.kind).toBe('main');
    expect(() => game.submit(0, { type: 'passStep' })).not.toThrow();
    expect(game.awaiting.kind).toBe('declareAttackers');
  });
});
