import { describe, expect, it } from 'vitest';
import { legalActions, validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, Permanent, PlayerId } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Nüwa's engine pieces (docs/plan-core-set-2-engine.md, Part 6): abilities paid
 * by removing the source's own marks, with no tap; a Tithe creature that
 * arrives with a mark per {1} the Tithe saved; and Tithe from the Darling zone,
 * which discounts the printed cost and never the Darling tax.
 */
const creature = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], cost: { generic: 0, pips: {} }, colors: [], attack, defense, rarity: 'c', ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  // A small Nüwa: two stones, one with a target, and a Tithe that grants marks.
  goddess: creature('goddess', 4, 4, {
    cost: { generic: 6, pips: { G: 1 } },
    supertypes: ['legendary'],
    tithe: { per: 2, marks: 3 },
    activated: [
      { cost: { removeMarks: 1, mana: { generic: 0, pips: { G: 1 } } }, ops: [{ op: 'gainLife', n: 5 }] },
      { cost: { removeMarks: 1 }, targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 3, to: 'target' }] },
    ],
  }),
  fodder: creature('fodder', 1, 2),
  oak: creature('oak', 0, 4),
};

function boardState(battlefield: Partial<Permanent>[], hand: string[] = []): GameState {
  const state = makeTestState({ battlefield, hands: [hand, []], active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(20).fill('forest');
  return state;
}

const forests = (n: number, from = 50): Partial<Permanent>[] =>
  Array.from({ length: n }, (_, i) => ({ iid: from + i, cardId: 'forest' }));
const marksOn = (game: Game, cardId: string) => game.instanceState.battlefield.find((p) => p.cardId === cardId)?.plusOneCounters;
const check = (game: Game, action: Action) => validateAction(game.instanceState as GameState, DB, 0, action);
const isGoddessStone = (a: Action, abilityIndex: number) => a.type === 'activate' && a.iid === 1 && a.abilityIndex === abilityIndex;

describe('abilities paid by removing marks', () => {
  it('spend the marks and leave the source untapped, even the turn it arrived', () => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'goddess', plusOneCounters: 2, enteredThisTurn: true }, ...forests(1)]), DB);
    const events = game.submit(0, { type: 'activate', iid: 1, abilityIndex: 0 });
    const goddess = game.instanceState.battlefield.find((p) => p.iid === 1)!;
    expect(goddess.plusOneCounters).toBe(1);
    expect(goddess.tapped).toBe(false);
    expect(game.instanceState.players[0].life).toBe(25);
    expect(events).toContainEqual({ e: 'activated', player: 0, iid: 1, cardId: 'goddess', abilityIndex: 0, marksSpent: 1 });
  });

  it('can be used while tapped, again and again while marks last', () => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'goddess', plusOneCounters: 2, tapped: true }]), DB);
    const face = { kind: 'player', player: 1 } as const;
    game.submit(0, { type: 'activate', iid: 1, abilityIndex: 1, targets: [face] });
    game.submit(0, { type: 'activate', iid: 1, abilityIndex: 1, targets: [face] });
    expect(game.instanceState.players[1].life).toBe(14);
    expect(marksOn(game, 'goddess')).toBe(0);
    expect(game.legalActions(0).some((a) => isGoddessStone(a, 1))).toBe(false);
    expect(check(game, { type: 'activate', iid: 1, abilityIndex: 1, targets: [face] })).toMatch(/not enough marks/);
  });

  it('a Duty on the same card still taps and still waits out summoning sickness', () => {
    const db: CardDb = { ...DB, goddess: { ...DB.goddess, activated: [...(DB.goddess.activated as never[]), { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] }] } };
    const game = Game.restore(boardState([{ iid: 1, cardId: 'goddess', plusOneCounters: 1, enteredThisTurn: true }]), db);
    const legal = game.legalActions(0);
    expect(legal.some((a) => isGoddessStone(a, 1))).toBe(true);
    expect(legal.some((a) => isGoddessStone(a, 2))).toBe(false);
  });

  it('read as a cost on the card', () => {
    expect(rulesText(DB.goddess)).toContain('{G}, remove a mark from this: You gain 5 life.');
    expect(rulesText(DB.goddess)).toContain('Remove a mark from this: Deal 3 damage to any target.');
    expect(rulesText(DB.goddess)).toContain('Tithe. This arrives with a mark for each {1} Tithe saved (at most 3).');
  });
});

describe('Tithe marks', () => {
  it('a Tithe cast arrives with a mark per {1} saved, up to the cap', () => {
    // 4 fodder × 2 Defense saves 4, capped at 3 marks; 7 forests pay {2}{G}.
    const fodder = [11, 12, 13, 14].map((iid) => ({ iid, cardId: 'fodder' }));
    const game = Game.restore(boardState([...fodder, ...forests(3)], ['goddess']), DB);
    const cast: Action = { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [11, 12, 13, 14] };
    expect(check(game, cast)).toBeNull();
    game.submit(0, cast);
    expect(marksOn(game, 'goddess')).toBe(3);
  });

  it('an ordinary cast arrives with none', () => {
    const game = Game.restore(boardState(forests(7), ['goddess']), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(marksOn(game, 'goddess')).toBe(0);
  });
});

describe('Tithe from the Darling zone', () => {
  function darlingState(battlefield: Partial<Permanent>[], tax: number): GameState {
    const state = boardState(battlefield);
    for (const p of [0, 1] as PlayerId[]) { state.players[p].darlingZone = null; state.players[p].darlingTax = 0; }
    state.players[0].darlingZone = 'goddess';
    state.players[0].darlingTax = tax;
    return state;
  }
  const titheDarling = (legal: Action[]) => legal.find((a) => a.type === 'castDarling' && a.tithe);

  it('discounts the printed cost and charges the tax in full', () => {
    // Printed {6}{G}, tax 2. Ten Defense saves 5 of the printed {6}, and the
    // tax is added after: {1}{G} + {2} = 4 forests. The marks cap at 3.
    const fodder = [11, 12, 13, 14, 15].map((iid) => ({ iid, cardId: 'fodder' }));
    const game = Game.restore(darlingState([...fodder, ...forests(4)], 2), DB);
    const cast: Action = { type: 'castDarling', tithe: true, sacrifices: [11, 12, 13, 14, 15] };
    expect(check(game, cast)).toBeNull();
    const events = game.submit(0, cast);
    expect(events.filter((e) => e.e === 'manaTapped').flatMap((e) => e.e === 'manaTapped' ? e.iids : [])).toHaveLength(4);
    expect(game.instanceState.battlefield.filter((p) => p.cardId === 'fodder')).toHaveLength(0);
    expect(marksOn(game, 'goddess')).toBe(3);
  });

  it('can never pay the tax down: with too few lands for the tax, there is no cast', () => {
    // Fourteen Defense would save 7, but only the printed {6} can go, so
    // {G} + tax {4} still needs 5 forests.
    const fodder = [11, 12, 13, 14, 15, 16, 17].map((iid) => ({ iid, cardId: 'fodder' }));
    const game = Game.restore(darlingState([...fodder, ...forests(4)], 4), DB);
    expect(check(game, { type: 'castDarling', tithe: true, sacrifices: [11, 12, 13, 14, 15, 16, 17] })).toMatch(/cannot pay/);
    expect(titheDarling(game.legalActions(0))).toBeUndefined();
  });

  it('is offered with one canonical fodder set when the full price is out of reach', () => {
    const game = Game.restore(darlingState([{ iid: 11, cardId: 'oak' }, { iid: 12, cardId: 'fodder' }, ...forests(4)], 0), DB);
    const legal = game.legalActions(0);
    expect(legal.some((a) => a.type === 'castDarling' && !a.tithe)).toBe(false);
    expect(titheDarling(legal)).toEqual({ type: 'castDarling', tithe: true, sacrifices: [12, 11] });
  });

  it('refuses sacrifices on a plain Darling cast, and fodder that is not yours', () => {
    const state = darlingState([{ iid: 11, cardId: 'oak' }, { iid: 12, cardId: 'oak', controller: 1 }, ...forests(7)], 0);
    expect(validateAction(state, DB, 0, { type: 'castDarling', sacrifices: [11] })).toMatch(/only a Tithe cast/);
    expect(validateAction(state, DB, 0, { type: 'castDarling', tithe: true, sacrifices: [12] })).toMatch(/creatures you control/);
    expect(legalActions(state, DB, 0).some((a) => a.type === 'castDarling' && !a.tithe)).toBe(true);
  });
});
