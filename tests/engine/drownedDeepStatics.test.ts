import { describe, expect, it } from 'vitest';
import { createRngState } from '../../src/engine/rng';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, CardDef, GameState, StaticDef } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const plant: CardDef = {
  id: 'plant', name: 'Plant', types: ['creature'], subtypes: ['Plant'], colors: ['G'],
  rarity: 'c', attack: 2, defense: 2,
};

function fixture(filter: StaticDef['filter'] = { token: true }): { state: GameState; db: CardDb } {
  const db: CardDb = {
    ...TEST_DB,
    plant,
    tokenPlant: { ...plant, id: 'tokenPlant', token: true },
    lord: {
      ...plant, id: 'lord', name: 'Kelp Lord',
      abilities: [{ when: 'static', static: { scope: 'filter', filter, p: 1, t: 1, grantKeywords: ['sentinel'] } }],
    },
  };
  const state = makeTestState({ battlefield: [
    { iid: 1, cardId: 'lord', controller: 0 },
    { iid: 2, cardId: 'tokenPlant', controller: 0 },
    { iid: 3, cardId: 'plant', controller: 0 },
    { iid: 4, cardId: 'tokenPlant', controller: 1 },
    { iid: 5, cardId: 'bear', controller: 0 },
  ] });
  return { state, db };
}

function stats(state: GameState, db: CardDb, iid: number): [number, number, string[]] {
  const value = getEffectiveStats(state.battlefield, db, iid);
  return [value.attack, value.defense, [...value.keywords]];
}

describe('Drowned Deep statics: token filters', () => {
  it('buffs a controlled printed token and refuses nontokens and opposing tokens', () => {
    const { state, db } = fixture();
    expect(stats(state, db, 2)).toEqual([3, 3, ['sentinel']]);
    expect(stats(state, db, 1)).toEqual([2, 2, []]);
    expect(stats(state, db, 3)).toEqual([2, 2, []]);
    expect(stats(state, db, 4)).toEqual([2, 2, []]);
  });

  it('uses runtime token identity for copies of ordinary creature cards', () => {
    const { state, db } = fixture();
    state.battlefield.find((perm) => perm.iid === 5)!.isToken = true;
    expect(stats(state, db, 5)).toEqual([3, 3, ['sentinel']]);
  });

  it('recomputes token bonuses after the anthem source leaves', () => {
    const { state, db } = fixture();
    expect(stats(state, db, 2)).toEqual([3, 3, ['sentinel']]);
    state.battlefield = state.battlefield.filter((perm) => perm.iid !== 1);
    expect(stats(state, db, 2)).toEqual([2, 2, []]);
  });

  it('combines token, subtype, other and marked restrictions', () => {
    const { state, db } = fixture({ token: true, subtype: 'Plant', other: true, marked: true });
    state.battlefield[0].isToken = true;
    state.battlefield[0].plusOneCounters = 1;
    state.battlefield[1].plusOneCounters = 1;
    state.battlefield[2].plusOneCounters = 1;
    state.battlefield[4].isToken = true;
    state.battlefield[4].plusOneCounters = 1;
    expect(stats(state, db, 1)).toEqual([3, 3, []]);
    expect(stats(state, db, 2)).toEqual([4, 4, ['sentinel']]);
    expect(stats(state, db, 3)).toEqual([3, 3, []]);
    expect(stats(state, db, 5)).toEqual([3, 3, []]);
    state.battlefield[1].plusOneCounters = 0;
    expect(stats(state, db, 2)).toEqual([2, 2, []]);
  });

  it('combines opponent scope with the token restriction', () => {
    const { state, db } = fixture({ token: true, who: 'opponent' });
    state.battlefield[2].controller = 1;
    expect(stats(state, db, 2)).toEqual([2, 2, []]);
    expect(stats(state, db, 3)).toEqual([2, 2, []]);
    expect(stats(state, db, 4)).toEqual([3, 3, ['sentinel']]);
  });

  it('refuses noncreature tokens even when they carry a matching subtype', () => {
    const { state, db } = fixture({ token: true, subtype: 'Plant' });
    const artifactDb: CardDb = { ...db, plantArtifact: {
      ...plant, id: 'plantArtifact', types: ['artifact'], token: true, attack: undefined, defense: undefined,
    } };
    state.battlefield[2].cardId = 'plantArtifact';
    expect(stats(state, artifactDb, 3)).toEqual([0, 0, []]);
  });

  it.each([1, 17, 99])('pins deterministic static results without consuming seed %i', (seed) => {
    const { state, db } = fixture();
    state.rng = createRngState(seed);
    const before = structuredClone(state);
    const expected = [[2, 2, []], [3, 3, ['sentinel']], [2, 2, []], [2, 2, []], [2, 2, []]];
    expect(state.battlefield.map((perm) => stats(state, db, perm.iid))).toEqual(expected);
    expect(state.battlefield.map((perm) => stats(state, db, perm.iid))).toEqual(expected);
    expect(state).toEqual(before);
  });
});
