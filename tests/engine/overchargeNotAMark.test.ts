import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import type { GameEvent } from '../../src/engine/events';
import {
  conditionSatisfied,
  fireMarkedAllyAttackTriggers,
  runOps,
} from '../../src/engine/effects/EffectInterpreter';
import { isLegalTarget } from '../../src/engine/effects/targeting';
import { getEffectiveStats } from '../../src/engine/statics';
import type { AbilityDef, CardDb, EffectOp, GameState, PlayerId, TargetRef } from '../../src/engine/types';
import { board, card, dbOf, ref } from '../drownedDeepFixture';

/**
 * Overcharge is NOT a Mark (the owner's ruling, 2026-09-29). Each Mark rule
 * the engine has, found by walking every `plusOneCounters` reader and writer:
 * it never counts an Overcharge as a Mark, and it never touches one. The
 * creature under test carries two Overcharges and no Marks unless a case says
 * otherwise, so a rule that read Overcharge as a Mark would act on it.
 */

const drain: EffectOp[] = [{ op: 'loseLife', n: 1, who: 'opponent' }];
const observer = (id: string, ability: AbilityDef) => card(id, { abilities: [ability] });

const db: CardDb = dbOf(
  card('tok-hatch', { name: 'Hatchling', token: true, attack: 1, defense: 1 }),
  card('body', { attack: 1, defense: 1 }),
  card('nine', { attack: 2, defense: 2, nineLives: true }),
  observer('lord-marked', { when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 1 } }),
  observer('lord-if-marked', { when: 'static', condition: 'controlMarked', static: { scope: 'filter', p: 1, t: 1 } }),
  observer('ally-attack-watch', { when: 'markedAllyAttacks', ops: drain }),
  ...(['gainsMark', 'yourCreatureMarked', 'yourPermanentMarked', 'youAddMark', 'otherCreatureMarked', 'allyCreatureArrives'] as const)
    .map((when) => observer(`watch-${when}`, { when, ops: drain })),
);

interface Spec { iid: number; cardId: string; overcharge?: number; marks?: number; controller?: PlayerId; isToken?: true }

function setup(specs: Spec[]): GameState {
  const state = board([[], []], specs.map((s) => ({
    iid: s.iid, cardId: s.cardId, controller: s.controller ?? 0, plusOneCounters: s.marks ?? 0,
  })));
  for (const s of specs) {
    const perm = state.battlefield.find((p) => p.iid === s.iid)!;
    if (s.overcharge !== undefined) perm.overcharge = s.overcharge;
    if (s.isToken) perm.isToken = true;
  }
  return state;
}

function run(state: GameState, ops: EffectOp[], targets: TargetRef[] = [], controller: PlayerId = 0): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (e) => events.push(e), { controller, sourceCardId: 'body', targets }, ops);
  return events.filter((e) => e.e !== 'effectApplied');
}

const at = (state: GameState, iid: number) => state.battlefield.find((p) => p.iid === iid)!;
const attackOf = (state: GameState, iid: number) => getEffectiveStats(state.battlefield, db, iid).attack;

describe('Overcharge is not a Mark', () => {
  it('removeMarks takes the Marks and leaves the Overcharges', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2, marks: 2 }]);
    run(state, [{ op: 'removeMarks', to: 'target' }], [ref(1)]);
    expect([at(state, 1).plusOneCounters, at(state, 1).overcharge]).toEqual([0, 2]);
    expect(attackOf(state, 1)).toBe(3);
  });

  it('moveMark finds no Mark to move on an overcharged creature, and moves only the Mark when there is one', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }, { iid: 2, cardId: 'body' }]);
    run(state, [{ op: 'moveMark' }], [ref(1), ref(2)]);
    expect([at(state, 1).overcharge, at(state, 2).plusOneCounters, at(state, 2).overcharge]).toEqual([2, 0, undefined]);
    at(state, 1).plusOneCounters = 1;
    run(state, [{ op: 'moveMark' }], [ref(1), ref(2)]);
    expect([at(state, 1).plusOneCounters, at(state, 1).overcharge, at(state, 2).plusOneCounters]).toEqual([0, 2, 1]);
  });

  it('Propagate never starts a Mark on a creature with only Overcharges', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }, { iid: 2, cardId: 'body', marks: 1 }]);
    run(state, [{ op: 'propagate' }]);
    expect([at(state, 1).plusOneCounters, at(state, 1).overcharge, at(state, 2).plusOneCounters]).toEqual([0, 2, 2]);
  });

  it('markAll puts a Mark beside the Overcharges and leaves them as they were', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }]);
    run(state, [{ op: 'markAll', scope: 'yourCreatures' }]);
    expect([at(state, 1).plusOneCounters, at(state, 1).overcharge]).toEqual([1, 2]);
    expect(attackOf(state, 1)).toBe(4);
  });

  it('a boost to marked creatures (yours or theirs) passes over an overcharged one', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }, { iid: 2, cardId: 'body', overcharge: 2, controller: 1 }]);
    run(state, [{ op: 'boost', p: 5, t: 0, scope: 'yourMarked' }, { op: 'boost', p: 5, t: 0, scope: 'theirMarked' }]);
    expect([at(state, 1).untilEotMods, at(state, 2).untilEotMods]).toEqual([[], []]);
  });

  it('loseLifePerTheirMarked counts no overcharged creature', () => {
    const state = setup([{ iid: 2, cardId: 'body', overcharge: 2, controller: 1 }, { iid: 3, cardId: 'body', marks: 1, controller: 1 }]);
    run(state, [{ op: 'loseLifePerTheirMarked', who: 'opponent' }]);
    expect(state.players[1].life).toBe(RULES.startingLife - 1);
  });

  it('ifTargetMarked takes its else branch for an overcharged target', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }]);
    run(state, [{ op: 'ifTargetMarked', then: [{ op: 'gainLife', n: 5 }], else: [{ op: 'gainLife', n: 1 }] }], [ref(1)]);
    expect(state.players[0].life).toBe(RULES.startingLife + 1);
  });

  it('a "marked creature" target spec refuses an overcharged creature until it has a real Mark', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }]);
    expect(isLegalTarget(state, db, 0, { what: 'creature', marked: true }, ref(1))).toBe(false);
    at(state, 1).plusOneCounters = 1;
    expect(isLegalTarget(state, db, 0, { what: 'creature', marked: true }, ref(1))).toBe(true);
  });

  it('the "you control a marked creature" conditions are false with only Overcharges', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }, { iid: 2, cardId: 'body', overcharge: 1 }]);
    expect(conditionSatisfied(state, db, 0, 'controlMarked')).toBe(false);
    expect(conditionSatisfied(state, db, 0, { kind: 'markedThreshold', n: 1, subject: 'creatures' })).toBe(false);
  });

  it('a static that needs a marked creature (its condition, or its filter) ignores Overcharges', () => {
    const state = setup([
      { iid: 1, cardId: 'body', overcharge: 2 },
      { iid: 5, cardId: 'lord-marked' },
      { iid: 6, cardId: 'lord-if-marked' },
    ]);
    // 1 printed + 2 Overcharges; neither lord applies. `lord-if-marked` would
    // give +1 to every creature of yours, itself included, if its condition held.
    expect(attackOf(state, 1)).toBe(3);
    expect(attackOf(state, 6)).toBe(2);
  });

  it('"whenever a marked creature you control attacks" does not see an overcharged attacker', () => {
    const state = setup([{ iid: 1, cardId: 'body', overcharge: 2 }, { iid: 5, cardId: 'ally-attack-watch' }]);
    fireMarkedAllyAttackTriggers(state, db, () => {}, at(state, 1));
    expect(state.players[1].life).toBe(RULES.startingLife);
  });

  it('Nine Lives still returns a creature that had only Overcharges, as a new object without them', () => {
    const state = setup([{ iid: 1, cardId: 'nine', overcharge: 2 }]);
    at(state, 1).instanceId = 900;
    const events = run(state, [{ op: 'destroy', to: 'target' }], [ref(1)]);
    const back = events.find((e): e is Extract<GameEvent, { e: 'nineLivesReturned' }> => e.e === 'nineLivesReturned');
    expect(back).toBeDefined();
    const returned = at(state, back!.iid);
    expect(returned.iid).not.toBe(1);
    expect([returned.plusOneCounters, returned.overcharge ?? 0]).toEqual([1, 0]);
  });

  it('gaining an Overcharge fires no Mark trigger and no arrival trigger', () => {
    const watchers = ['gainsMark', 'yourCreatureMarked', 'yourPermanentMarked', 'youAddMark', 'otherCreatureMarked', 'allyCreatureArrives']
      .map((when, i) => ({ iid: 10 + i, cardId: `watch-${when}` }));
    const state = setup([
      { iid: 1, cardId: 'tok-hatch', isToken: true },
      ...watchers,
      ...Array.from({ length: RULES.maxCreatures - 1 - watchers.length }, (_, i) => ({ iid: 30 + i, cardId: 'body' })),
    ]);
    const events = run(state, [{ op: 'createToken', token: 'tok-hatch', count: 1 }]);
    expect(events.map((e) => e.e)).toEqual(['overcharged']);
    expect(state.players[1].life).toBe(RULES.startingLife);
    // The same watchers do fire for a real Mark, so the silence above is the rule.
    run(state, [{ op: 'addCounters', n: 1, to: 'target' }], [ref(1)]);
    expect(state.players[1].life).toBeLessThan(RULES.startingLife);
  });
});

