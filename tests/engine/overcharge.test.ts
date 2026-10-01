import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import type { GameEvent } from '../../src/engine/events';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { getEffectiveStats } from '../../src/engine/statics';
import type { EffectOp, GameState, Permanent, PlayerId } from '../../src/engine/types';
import { viewFor } from '../../src/engine/view';
import { board, card, dbOf } from '../drownedDeepFixture';

/**
 * Overcharge (1.9 A1.7, the owner's rulings of 2026-09-29): a token refused at
 * the creature cap gives one same-name token its controller controls +1/+1,
 * at most RULES.overchargeLimit on one creature; never any other creature.
 * The Mark separation lives in overchargeNotAMark.test.ts.
 */

const db = dbOf(
  card('tok-hatch', { name: 'Hatchling', token: true, attack: 1, defense: 1, subtypes: ['Dinosaur'] }),
  // A second token definition with the same printed name: namesake is by name.
  card('tok-hatch-alt', { name: 'Hatchling', token: true, attack: 1, defense: 1, subtypes: ['Dinosaur'] }),
  card('tok-wolf', { name: 'Wolf', token: true, attack: 2, defense: 2, subtypes: ['Wolf'] }),
  // A collectible card that shares the token's name: not a token, never eligible.
  card('hatch-card', { name: 'Hatchling', attack: 1, defense: 1, subtypes: ['Dinosaur'] }),
  card('body', { attack: 1, defense: 1 }),
);

interface Spec {
  iid: number;
  cardId: string;
  isToken?: true;
  overcharge?: number;
  controller?: PlayerId;
}

/** A hand-built board; token identity and Overcharges set on the live permanents. */
function setup(specs: Spec[]): GameState {
  const state = board([[], []], specs.map(({ iid, cardId, controller }) => ({ iid, cardId, controller: controller ?? 0 })));
  for (const spec of specs) {
    const perm = state.battlefield.find((p) => p.iid === spec.iid)!;
    if (spec.isToken) perm.isToken = true;
    if (spec.overcharge !== undefined) perm.overcharge = spec.overcharge;
  }
  return state;
}

/** `n` plain creatures for player 0 from iid `from`, filling the board up. */
const bodies = (from: number, n: number): Spec[] =>
  Array.from({ length: n }, (_, i) => ({ iid: from + i, cardId: 'body' }));

const hatch = (iid: number, overcharge?: number): Spec => ({
  iid, cardId: 'tok-hatch', isToken: true, ...(overcharge === undefined ? {} : { overcharge }),
});

function make(state: GameState, count: number, token = 'tok-hatch', extra: Partial<Extract<EffectOp, { op: 'createToken' }>> = {}): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (e) => events.push(e), { controller: 0, sourceCardId: 'body', targets: [] }, [
    { op: 'createToken', token, count, ...extra },
  ]);
  // Every op reports itself; the rule's own events are what these tests read.
  return events.filter((e) => e.e !== 'effectApplied');
}

const perm = (state: GameState, iid: number): Permanent => state.battlefield.find((p) => p.iid === iid)!;
const stats = (state: GameState, iid: number) => {
  const s = getEffectiveStats(state.battlefield, db, iid);
  return [s.attack, s.defense];
};
const creaturesOf = (state: GameState, player: PlayerId) =>
  state.battlefield.filter((p) => p.controller === player && db[p.cardId].types.includes('creature')).length;

describe('Overcharge: a token refused at the creature cap', () => {
  it('is not created, and its same-name token gains +1/+1 instead', () => {
    const state = setup([hatch(1), ...bodies(2, RULES.maxCreatures - 1)]);
    const events = make(state, 1);
    expect(creaturesOf(state, 0)).toBe(RULES.maxCreatures);
    expect(events.some((e) => e.e === 'tokenCreated')).toBe(false);
    expect(perm(state, 1).overcharge).toBe(1);
    expect(stats(state, 1)).toEqual([2, 2]);
    expect(perm(state, 1).plusOneCounters).toBe(0);
  });

  it('emits one overcharged event naming the recipient, the refused token and the new total', () => {
    const state = setup([{ iid: 1, cardId: 'tok-hatch-alt', isToken: true, overcharge: 1 }, ...bodies(2, RULES.maxCreatures - 1)]);
    expect(make(state, 1)).toEqual([
      { e: 'overcharged', player: 0, iid: 1, cardId: 'tok-hatch-alt', tokenCardId: 'tok-hatch', total: 2 },
    ]);
  });

  it('reports each refused token without a same-name token, and changes no state (no fallback)', () => {
    // A Wolf token, a non-token card named Hatchling, the opponent's Hatchling
    // token and plain bodies: none of them is this player's Hatchling token.
    const state = setup([
      { iid: 1, cardId: 'tok-wolf', isToken: true },
      { iid: 2, cardId: 'hatch-card' },
      ...bodies(3, RULES.maxCreatures - 2),
      { iid: 50, cardId: 'tok-hatch', isToken: true, controller: 1 },
    ]);
    const before = structuredClone(state.battlefield);
    expect(make(state, 2)).toEqual([
      { e: 'tokenRefused', player: 0, tokenCardId: 'tok-hatch' },
      { e: 'tokenRefused', player: 0, tokenCardId: 'tok-hatch' },
    ]);
    expect(state.battlefield).toEqual(before);
  });

  it('skips a namesake at the limit, and is simply refused when every namesake is at it', () => {
    const limit = RULES.overchargeLimit;
    const state = setup([hatch(1, limit), hatch(2, limit - 1), ...bodies(3, RULES.maxCreatures - 2)]);
    make(state, 1);
    expect([perm(state, 1).overcharge, perm(state, 2).overcharge]).toEqual([limit, limit]);
    const before = structuredClone(state.battlefield);
    expect(make(state, 3)).toEqual(Array.from({ length: 3 }, () => (
      { e: 'tokenRefused', player: 0, tokenCardId: 'tok-hatch' }
    )));
    expect(state.battlefield).toEqual(before);
    expect(stats(state, 1)).toEqual([1 + limit, 1 + limit]);
  });

  it('never takes one creature past the limit, however many tokens are refused', () => {
    const state = setup([hatch(1), ...bodies(2, RULES.maxCreatures - 1)]);
    const events = make(state, RULES.overchargeLimit + 2);
    expect(perm(state, 1).overcharge).toBe(RULES.overchargeLimit);
    expect(events.filter((e) => e.e === 'overcharged')).toHaveLength(RULES.overchargeLimit);
  });

  it('picks the namesake with the fewest Overcharges, ties to the oldest', () => {
    const state = setup([hatch(3, 2), hatch(5, 1), hatch(7, 1), ...bodies(10, RULES.maxCreatures - 3)]);
    const events = make(state, 3);
    // 5 and 7 tie on one (5 is older); then 7 has the fewest; then all tie on two and 3 is oldest.
    expect(events.map((e) => (e.e === 'overcharged' ? e.iid : null))).toEqual([5, 7, 3]);
    expect([3, 5, 7].map((iid) => perm(state, iid).overcharge)).toEqual([3, 2, 2]);
  });

  it('handles each token of a multi-token op in turn: made while there is room, then overcharged', () => {
    const state = setup([hatch(1), ...bodies(2, RULES.maxCreatures - 2)]);
    const events = make(state, 3);
    const made = events.filter((e): e is Extract<GameEvent, { e: 'tokenCreated' }> => e.e === 'tokenCreated');
    expect(made).toHaveLength(1);
    const fresh = made[0].perm.iid;
    // Both namesakes stand at zero, so the older takes the first; then the new one has the fewest.
    expect(events.filter((e) => e.e === 'overcharged').map((e) => (e.e === 'overcharged' ? e.iid : null))).toEqual([1, fresh]);
    expect(creaturesOf(state, 0)).toBe(RULES.maxCreatures);
    expect(stats(state, 1)).toEqual([2, 2]);
    expect(stats(state, fresh)).toEqual([2, 2]);
  });

  it('makes tokens below the cap exactly as before, and overcharges nothing', () => {
    const state = setup([hatch(1), ...bodies(2, 3)]);
    const events = make(state, 2);
    expect(events.filter((e) => e.e === 'tokenCreated')).toHaveLength(2);
    expect(events.some((e) => e.e === 'overcharged')).toBe(false);
    expect(events.some((e) => e.e === 'tokenRefused')).toBe(false);
    expect(state.battlefield.every((p) => p.overcharge === undefined)).toBe(true);
  });

  it('gives a refused token\'s Marks to no one: the namesake gains the Overcharge alone', () => {
    const state = setup([hatch(1), ...bodies(2, RULES.maxCreatures - 1)]);
    make(state, 1, 'tok-hatch', { marks: 2 });
    expect(perm(state, 1).plusOneCounters).toBe(0);
    expect(perm(state, 1).overcharge).toBe(1);
  });

  it('works for either player, and only ever on that player\'s own namesake', () => {
    const state = setup([
      hatch(1),
      ...Array.from({ length: RULES.maxCreatures - 1 }, (_, i) => ({ iid: 20 + i, cardId: 'body', controller: 1 as const })),
      { iid: 40, cardId: 'tok-hatch', isToken: true, controller: 1 },
    ]);
    const events: GameEvent[] = [];
    runOps(state, db, (e) => events.push(e), { controller: 1, sourceCardId: 'body', targets: [] }, [
      { op: 'createToken', token: 'tok-hatch', count: 1 },
    ]);
    expect(events.filter((e) => e.e !== 'effectApplied')).toEqual([{ e: 'overcharged', player: 1, iid: 40, cardId: 'tok-hatch', tokenCardId: 'tok-hatch', total: 1 }]);
    expect(perm(state, 1).overcharge).toBeUndefined();
  });
});

describe('Overcharge is public state', () => {
  it('is part of the public battlefield every seat\'s PlayerView carries, bonus included', () => {
    const state = setup([hatch(1, 2), ...bodies(2, 2)]);
    for (const seat of [0, 1] as const) {
      const view = viewFor(state, seat);
      expect(view.battlefield.find((p) => p.iid === 1)?.overcharge).toBe(2);
      const s = getEffectiveStats(view.battlefield, db, 1);
      expect([s.attack, s.defense]).toEqual([3, 3]);
    }
  });
});
