import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { hasCastableCharm, legalActions } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { resolveStackItem } from '../../src/engine/resolve';
import type { CardDb, CardDef, GameState, Permanent, PlayerId, TargetRef, TargetSpec } from '../../src/engine/types';
import { validateA16Def } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * A1.6, "target attacking creature" (the owner's First Dawn reworks,
 * 2026-09-29: The Elders' Verdict and Bring Down the Beast become Charms that
 * only hit an attacker). The contract: a legal target is a creature declared
 * as an attacker in this combat and still on the battlefield; so the Charm is
 * castable only in combat after attackers are declared, it fizzles when its
 * attacker leaves, and a defender holding one gets a window over the
 * attackers only when it has an attacker to hit. Fixture cards only.
 */
const creature = (id: string, attack: number, defense: number): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: ['W'], rarity: 'c', cost: { generic: 1, pips: {} }, attack, defense,
});
const charm = (id: string, targets: TargetSpec[], ops: NonNullable<CardDef['abilities']>[number]['ops']): CardDef => ({
  id, name: id, types: ['charm'], subtypes: [], colors: ['W'], rarity: 'r',
  cost: { generic: 1, pips: { W: 2 } }, abilities: [{ when: 'spell', targets, ops }],
});
/** The Elders' Verdict's working shape: "Sever target attacking creature, then you gain 2 life." */
const VERDICT = charm('verdict', [{ what: 'creature', attacking: true }], [{ op: 'sever', to: 'target' }, { op: 'gainLife', n: 2 }]);
/** Bring Down the Beast's working shape: "Destroy target attacking creature with Attack 4 or more." */
const BEAST = charm('beast', [{ what: 'creature', attacking: true, minAttack: 4 }], [{ op: 'destroy', to: 'target' }]);
const DB: CardDb = {
  ...TEST_DB, verdict: VERDICT, beast: BEAST,
  grunt: creature('grunt', 2, 2), brute: creature('brute', 5, 5), guard: creature('guard', 1, 4),
  // A {W} Charm the attacker can cast in main phase, to open a window there.
  mend: { ...charm('mend', [], [{ op: 'gainLife', n: 1 }]), cost: { generic: 0, pips: { W: 1 } } },
};

const GRUNT = 1;
const BRUTE = 2;
const GUARD = 3;
let nextIid = 50;
const plains = (controller: PlayerId, n: number): Partial<Permanent>[] =>
  Array.from({ length: n }, () => ({ iid: nextIid++, cardId: 'plains', controller }));
const ref = (iid: number): TargetRef => ({ kind: 'permanent', iid });

function state(battlefield: Partial<Permanent>[], hands: [string[], string[]], active: PlayerId = 0): GameState {
  const st = makeTestState({ battlefield, hands, active });
  st.rulesRev = 4;
  st.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  st.nextIid = 200;
  for (const player of st.players) player.deck = Array.from({ length: 12 }, () => 'forest');
  return st;
}

/** P0 has a grunt and a brute, P1 a guard, three plains and `hand`; P0 attacks with `attackers`. */
function attack(attackers: number[], hand: string[] = ['verdict']): Game {
  const st = state([{ iid: GRUNT, cardId: 'grunt' }, { iid: BRUTE, cardId: 'brute' }, { iid: GUARD, cardId: 'guard', controller: 1 }, ...plains(1, 3)],
    [[], hand]);
  const game = Game.restore(st, DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers });
  return game;
}

const castTargets = (actions: Action[], cardHandIndex = 0): TargetRef[][] => actions
  .filter((action): action is Extract<Action, { type: 'castSpell' }> => action.type === 'castSpell' && action.handIndex === cardHandIndex)
  .map((action) => action.targets ?? []);

describe('an attacking-only target', () => {
  it('is legal only on a creature declared as an attacker', () => {
    const game = attack([GRUNT]);
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'attackers' } });
    // Not the brute that stayed home, and not the defender's own creature.
    expect(castTargets(game.legalActions(1))).toEqual([[ref(GRUNT)]]);
  });

  it('composes with the other target rules (Attack 4 or more)', () => {
    const game = attack([GRUNT, BRUTE], ['beast']);
    expect(castTargets(game.legalActions(1))).toEqual([[ref(BRUTE)]]);
  });

  it('is not castable outside combat, even with creatures on the battlefield', () => {
    // P1's own main phase: P0's creatures are there, none is attacking.
    const st = state([{ iid: GRUNT, cardId: 'grunt' }, { iid: GUARD, cardId: 'guard', controller: 1 }, ...plains(1, 3)], [[], ['verdict']], 1);
    expect(castTargets(legalActions(st, DB, 1))).toEqual([]);
    // Nor in a window over a main-phase spell.
    const game = Game.restore(state([{ iid: GRUNT, cardId: 'grunt' }, ...plains(0, 1), ...plains(1, 3)], [['mend'], ['verdict', 'mend']]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'spell', sid: expect.any(Number) } });
    expect(castTargets(game.legalActions(1))).toEqual([]);
  });

  it('keeps no window open when there is no legal target (auto-pass unchanged)', () => {
    // No attackers: combat ends at once, with no window for the defender.
    const none = attack([]);
    expect(none.awaiting).toEqual({ player: 0, kind: 'main' });
    // An attacker the Charm cannot hit: the defender goes straight to blocks.
    const small = attack([GRUNT], ['beast']);
    expect(small.awaiting).toEqual({ player: 1, kind: 'declareBlockers' });
    expect(hasCastableCharm(small.instanceState, DB, 1)).toBe(false);
  });

  it('fizzles when its attacker has left the battlefield before it resolves', () => {
    const game = attack([GRUNT]);
    const st = structuredClone(game.instanceState) as GameState;
    st.battlefield = st.battlefield.filter((perm) => perm.iid !== GRUNT);
    const events: GameEvent[] = [];
    const lifeBefore = st.players[1].life;
    resolveStackItem(st, DB, { sid: 9, cardId: 'verdict', controller: 1, targets: [ref(GRUNT)] }, (event) => events.push(event));
    expect(events).toContainEqual({ e: 'targetsFizzled', sid: 9 });
    expect(st.players[1].life).toBe(lifeBefore);
  });

  it('fizzles once nothing is attacking (the combat is over)', () => {
    const game = attack([GRUNT]);
    const st = structuredClone(game.instanceState) as GameState;
    st.combat = null;
    const events: GameEvent[] = [];
    resolveStackItem(st, DB, { sid: 9, cardId: 'verdict', controller: 1, targets: [ref(GRUNT)] }, (event) => events.push(event));
    expect(events).toContainEqual({ e: 'targetsFizzled', sid: 9 });
    expect(st.battlefield.some((perm) => perm.iid === GRUNT)).toBe(true);
  });

  it('resolves on its attacker: Sever, then you gain 2 life', () => {
    const game = attack([GRUNT]);
    game.submit(1, { type: 'castSpell', handIndex: 0, targets: [ref(GRUNT)] });
    if (game.awaiting.kind === 'respond' && game.awaiting.player === 0) game.submit(0, { type: 'passResponse' });
    const st = game.instanceState;
    expect(st.battlefield.some((perm) => perm.iid === GRUNT)).toBe(false);
    expect(st.players[0].severed.map((entry) => typeof entry === 'string' ? entry : entry.cardId)).toContain('grunt');
    expect(st.players[1].life).toBe(22);
  });
});

describe('the attacking qualifier stays narrow (validator)', () => {
  it('qualifies a creature spec, and never a Duty\'s', () => {
    expect(validateA16Def(VERDICT)).toEqual([]);
    expect(validateA16Def(BEAST)).toEqual([]);
    expect(validateA16Def(charm('bad-player', [{ what: 'player', attacking: true }], [{ op: 'damage', n: 2, to: 'target' }]))).not.toEqual([]);
    expect(validateA16Def(charm('bad-any', [{ what: 'any', attacking: true }], [{ op: 'damage', n: 2, to: 'target' }]))).not.toEqual([]);
    const duty: CardDef = { ...creature('duty', 1, 1), activated: { cost: { tap: true }, targets: [{ what: 'creature', attacking: true }], ops: [{ op: 'tap', to: 'target' }] } };
    expect(validateA16Def(duty)).not.toEqual([]);
  });
});
