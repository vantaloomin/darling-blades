import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { finishCleanup } from '../../src/engine/phases';
import { checkStateBased } from '../../src/engine/sba';
import { getEffectiveStats } from '../../src/engine/statics';
import { fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import type { CardDb, GameState } from '../../src/engine/types';
import { makeTestState } from '../helpers';

const SWEEPER_DB: CardDb = {
  one_one: {
    id: 'one_one',
    name: 'One One',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    rarity: 'c',
  },
  two_two: {
    id: 'two_two',
    name: 'Two Two',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 2,
    defense: 2,
    rarity: 'c',
  },
  red_sweeper: {
    id: 'red_sweeper',
    name: 'Red Sweeper',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] }],
    rarity: 'c',
  },
  black_sweeper: {
    id: 'black_sweeper',
    name: 'Black Sweeper',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: -1, t: -1, scope: 'all' }] }],
    rarity: 'c',
  },
  trigger_sweeper: {
    id: 'trigger_sweeper',
    name: 'Trigger Sweeper',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: ['R', 'B'],
    attack: 2,
    defense: 2,
    abilities: [
      { when: 'arrives', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] },
      { when: 'dawn', ops: [{ op: 'boost', p: -1, t: -1, scope: 'all' }] },
    ],
    rarity: 'c',
  },
};

const ctx = { controller: 0 as const, sourceCardId: 'test', targets: [] };

function eventsFor(state: GameState, ops: Parameters<typeof runOps>[4]): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, SWEEPER_DB, (event) => events.push(event), ctx, ops);
  return events;
}

describe('sweeper effect ops', () => {
  it('marks every creature symmetrically in battlefield order, then normal SBAs kill the 1/1', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'one_one', controller: 0 },
        { iid: 2, cardId: 'two_two', controller: 1 },
      ],
    });

    const events = eventsFor(state, SWEEPER_DB.red_sweeper.abilities![0].ops!);

    expect(events).toEqual([
      { e: 'effectApplied', op: 'damage' },
      { e: 'damageMarked', iid: 1, amount: 1 },
      { e: 'damageMarked', iid: 2, amount: 1 },
    ]);
    expect(state.battlefield.map((perm) => perm.damage)).toEqual([1, 1]);

    checkStateBased(state, SWEEPER_DB, () => {});
    expect(state.battlefield.map((perm) => perm.cardId)).toEqual(['two_two']);
    expect(state.players[0].graveyard).toEqual(['one_one']);
  });

  it('applies -1/-1 to every creature, lets normal SBAs kill only the 1/1, and expires at cleanup', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'one_one', controller: 0 },
        { iid: 2, cardId: 'two_two', controller: 1 },
      ],
    });

    eventsFor(state, SWEEPER_DB.black_sweeper.abilities![0].ops!);
    expect(state.battlefield.map((perm) => perm.untilEotMods)).toEqual([
      [{ p: -1, t: -1, keywords: [] }],
      [{ p: -1, t: -1, keywords: [] }],
    ]);

    checkStateBased(state, SWEEPER_DB, () => {});
    expect(state.battlefield.map((perm) => perm.cardId)).toEqual(['two_two']);
    expect(state.players[0].graveyard).toEqual(['one_one']);
    expect(getEffectiveStats(state.battlefield, SWEEPER_DB, 2)).toMatchObject({ attack: 1, defense: 1 });

    finishCleanup(state, SWEEPER_DB, () => {});
    expect(getEffectiveStats(state.battlefield, SWEEPER_DB, 2)).toMatchObject({ attack: 2, defense: 2 });
  });

  it('runs both sweepers from target-free triggers', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'trigger_sweeper', controller: 0 },
        { iid: 2, cardId: 'two_two', controller: 1 },
      ],
    });
    const events: ReturnType<typeof eventsFor> = [];

    fireTriggers(state, SWEEPER_DB, (event) => events.push(event), 'arrives', state.battlefield[0]);
    fireTriggers(state, SWEEPER_DB, (event) => events.push(event), 'dawn', state.battlefield[0]);

    expect(events.filter((event) => event.e === 'damageMarked').map((event) => event.iid)).toEqual([1, 2]);
    expect(state.battlefield.map((perm) => perm.untilEotMods)).toEqual([
      [{ p: -1, t: -1, keywords: [] }],
      [{ p: -1, t: -1, keywords: [] }],
    ]);
  });
});
