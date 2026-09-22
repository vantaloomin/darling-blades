import { afterAll, describe, expect, it, vi } from 'vitest';
import { chooseAttackers } from '../../src/ai/combatPlans';
import { HardAI } from '../../src/ai/HardAI';
import { applyTithePolicy, chooseTitheSacrifices, isTitheCast, titheManaSaved } from '../../src/ai/tithePolicy';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, Permanent } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { body as behaviourBody, DB as behaviourDb, fixture, invariantErrors, lands } from './documentedBehaviourFixture';
import { body, brain, DB, difficulties, gameWith, land } from './whispersTitheFixture';

type SpellCast = Extract<Action, { type: 'castSpell' }>;
const cast: SpellCast = { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [] };
function titheGame(hand = 'tithe_body') {
  return gameWith({ hand: [hand], battlefield: [land(), body(10, 'best'),
    body(11, 'odd', { damage: 1 }), body(12, 'odd', { damage: 1 })] });
}

describe('Tithe AI policy', () => {
  it('leaves menus, order, and action objects unchanged without Tithe', () => {
    const game = gameWith({ hand: ['bear'] });
    const menu = game.legalActions(0);
    const plan = vi.fn(() => { throw new Error('unneeded combat search'); });
    expect(applyTithePolicy(game.viewFor(0), DB, menu, undefined, plan)).toBe(menu);
    expect(plan).not.toHaveBeenCalled();
  });

  it('pairs odd Defense to recover the point each single body would waste', () => {
    const game = titheGame();
    expect(chooseTitheSacrifices(game.viewFor(0), DB, cast)).toEqual([11, 12]);
    expect(titheManaSaved(game.viewFor(0), DB, { ...cast, sacrifices: [11, 12] })).toBe(3);
  });

  it('never sacrifices the single best body or an opposing body', () => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(), body(10, 'best'),
      body(20, 'one', { controller: 1 }), body(21, 'one', { controller: 1 })] });
    expect(chooseTitheSacrifices(game.viewFor(0), DB, cast)).toEqual([]);
    expect(applyTithePolicy(game.viewFor(0), DB, game.legalActions(0))).toEqual([
      { type: 'passStep' }, { type: 'concede' },
    ]);
  });

  it("never sacrifices a body in the attack planner's Morning plan", () => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(), body(10, 'best'),
      body(11, 'attacker', { damage: 3 }), body(12, 'odd', { damage: 1 }), body(13, 'odd', { damage: 1 })] });
    const view = game.viewFor(0);
    const planned = chooseAttackers(view.battlefield, DB, 0, view.opp.life, 0, view.you.life);
    expect(planned).toContain(11);
    expect(chooseTitheSacrifices(view, DB, cast)).toEqual([12, 13]);
    const afternoon = { ...view, step: 'main2' as const };
    expect(chooseTitheSacrifices(afternoon, DB, cast, [11])).not.toContain(11);
  });

  it('drops the flag and sacrifices when mana saved does not beat board value', () => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(1), land(2), land(3), land(4),
      body(10, 'best'), body(11, 'pricey')] });
    const prepared = applyTithePolicy(game.viewFor(0), DB, [{ ...cast, sacrifices: [11] }]);
    expect(prepared).toEqual([{ type: 'castSpell', handIndex: 0 }]);
    expect(validateAction(game.instanceState, DB, 0, prepared[0])).toBeNull();
  });

  it('removes declined casts when full price cannot be paid and does not duplicate existing full casts', () => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(), body(10, 'best'), body(11, 'pricey')] });
    expect(applyTithePolicy(game.viewFor(0), DB, [{ ...cast, sacrifices: [11] }])).toEqual([]);
    const rich = gameWith({ hand: ['tithe_body'], battlefield: [land(1), land(2), land(3), land(4),
      body(10, 'best'), body(11, 'pricey')] });
    expect(applyTithePolicy(rich.viewFor(0), DB, rich.legalActions(0))
      .filter((action) => action.type === 'castSpell')).toHaveLength(1);
  });

  it('stops once generic is covered and never discounts colored pips', () => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(), body(10, 'best'),
      body(11, 'odd', { damage: 1 }), body(12, 'odd', { damage: 1 }), body(13, 'one'), body(14, 'one'), body(15, 'even')] });
    const selected = chooseTitheSacrifices(game.viewFor(0), DB, cast);
    expect(titheManaSaved(game.viewFor(0), DB, { ...cast, sacrifices: selected })).toBe(3);
    expect(selected).not.toContain(15);
    expect(titheManaSaved(game.viewFor(0), DB, { ...cast, sacrifices: selected.slice(0, -1) })).toBeLessThan(3);
    const pips = titheGame('tithe_pips');
    expect(chooseTitheSacrifices(pips.viewFor(0), DB, cast)).toEqual([]);
    const noGreen = gameWith({ hand: ['tithe_body'], battlefield: [{ ...land(), cardId: 'island' },
      body(10, 'best'), body(11, 'odd', { damage: 1 }), body(12, 'odd', { damage: 1 })] });
    expect(applyTithePolicy(noGreen.viewFor(0), DB, [{ ...cast, sacrifices: [11, 12] }])).toEqual([]);
  });

  it('uses effective Defense including marks and discounts the Empower total', () => {
    const game = titheGame('tithe_empower');
    const empowered: SpellCast = { ...cast, empowered: true };
    expect(titheManaSaved(game.viewFor(0), DB, { ...empowered, sacrifices: [11, 12] })).toBe(3);
    const marked = gameWith({ hand: ['tithe_empower'], battlefield: [land(), body(10, 'best'),
      body(11, 'odd', { plusOneCounters: 1 })] });
    expect(titheManaSaved(marked.viewFor(0), DB, { ...cast, sacrifices: [11] })).toBe(1);
    expect(titheManaSaved(marked.viewFor(0), DB, { ...empowered, sacrifices: [11] })).toBe(2);
  });

  it.each(difficulties)('%s rewrites a canonical Tithe creature cast and submits it legally', (difficulty) => {
    const game = titheGame();
    const action = brain(difficulty).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', tithe: true, handIndex: 0, sacrifices: [11, 12] });
    expect(() => game.submit(0, action)).not.toThrow();
    expect(game.state.battlefield.some((perm) => perm.iid === 10)).toBe(true);
  });

  it.each(difficulties)('%s protects its planned attacker before sacrificing', (difficulty) => {
    const game = gameWith({ hand: ['tithe_body'], battlefield: [land(), body(10, 'best'),
      body(11, 'attacker', { damage: 3 }), body(12, 'odd', { damage: 1 }), body(13, 'odd', { damage: 1 })] });
    const action = brain(difficulty).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', tithe: true, sacrifices: [12, 13] });
  });

  it('Hard searches Tithe beyond the eight ordinary main candidates', () => {
    const game = gameWith({ hand: ['tithe_body', ...Array.from({ length: 12 }, (_, i) => `skim_${i}`)],
      battlefield: [land(), body(10, 'best'), body(11, 'odd', { damage: 1 }), body(12, 'odd', { damage: 1 })] });
    const hard = new HardAI(DB);
    type Search = { aggregateOutcome(view: PlayerView, actions: Action[]):
      { score: number; wonAll: boolean; lostAny: boolean } | null };
    const spy = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    const menu = game.legalActions(0);
    expect(menu.filter((action) => action.type === 'skim')).toHaveLength(12);
    hard.chooseAction(game.viewFor(0), menu);
    expect(spy.mock.calls.slice(1).some(([, actions]) => actions.some((action) =>
      isTitheCast(game.viewFor(0), DB, action)))).toBe(true);
  });

  it('keeps default Easy Tithe play mixed, not all-cast or all-pass', () => {
    const ai = brain('Easy', 41, false);
    const game = titheGame();
    const actions = Array.from({ length: 12 }, () => ai.chooseAction(game.viewFor(0), game.legalActions(0)).type);
    expect(actions).toContain('castSpell');
    expect(actions).toContain('passStep');
  });

  it.each(difficulties)('%s pins deterministic Tithe choice at seed 41', (difficulty) => {
    const first = titheGame();
    const second = titheGame();
    const action = brain(difficulty, 41).chooseAction(first.viewFor(0), first.legalActions(0));
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [11, 12] });
    expect(brain(difficulty, 41).chooseAction(second.viewFor(0), second.legalActions(0))).toEqual(action);
  });
});

// Keep the phase-B premises in the documented-behaviour fixture shape. The
// ordinary 1/1 costs one mana, so the test does not rely on a free token's value.
const FODDER_DB: CardDb = {
  ...behaviourDb,
  small_guard: { ...behaviourDb.small_guard, cost: { generic: 1, pips: {} } },
};

function freshFodderGame(battlefield: Partial<Permanent>[], db: CardDb = FODDER_DB): Game {
  const game = fixture(['tithe_horror'], battlefield, (state) => {
    state.step = 'main2';
    // makeTestState predates runtime token copies; carry that public identity
    // explicitly rather than allowing the definition fallback to hide it.
    for (const extra of battlefield) {
      if (extra.isToken !== undefined) state.battlefield.find((perm) => perm.iid === extra.iid)!.isToken = extra.isToken;
    }
  });
  return Game.restore(game.instanceState, db);
}

function submitSale(game: Game, sacrifices: number[], db: CardDb = FODDER_DB, extra: Partial<SpellCast> = {}): void {
  const intended: SpellCast = { ...cast, ...extra, sacrifices };
  expect(chooseTitheSacrifices(game.viewFor(0), db, intended)).toEqual(sacrifices);
  expect(validateAction(game.instanceState, db, 0, intended)).toBeNull();
  game.submit(0, intended);
  expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 10)).toBe(true);
  for (const iid of sacrifices) expect(game.viewFor(0).battlefield.some((perm) => perm.iid === iid)).toBe(false);
}

describe('Tithe phase-B undamaged fodder and tempo', () => {
  afterAll(() => expect(invariantErrors).toEqual([]));

  it.each([
    ['a legacy token definition', 'tok-kelp-shade', { plusOneCounters: 2 }],
    ['a runtime token copy of a collectible', 'worth_four', { isToken: true }],
  ] as const)('sells %s above Defense 2 for two mana', (_label, cardId, extra) => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'), behaviourBody(11, cardId, 0, extra)]);
    expect(game.viewFor(0).battlefield.find((perm) => perm.iid === 11)?.damage).toBe(0);
    submitSale(game, [11]);
  });

  it('pairs ordinary undamaged one-mana 1/1s for a one-mana tempo unlock', () => {
    const game = freshFodderGame([...lands(3), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'small_guard'), behaviourBody(12, 'small_guard')]);
    expect(validateAction(game.instanceState, FODDER_DB, 0, { type: 'castSpell', handIndex: 0 })).not.toBeNull();
    submitSale(game, [11, 12]);
  });

  it('applies the two-mana floor to the complete sale of four ordinary 1/1s', () => {
    const game = freshFodderGame([...lands(4), behaviourBody(10, 'cheap_value'),
      ...[11, 12, 13, 14].map((iid) => behaviourBody(iid, 'small_guard'))]);
    expect(validateAction(game.instanceState, FODDER_DB, 0, { type: 'castSpell', handIndex: 0 })).toBeNull();
    submitSale(game, [11, 12, 13, 14]);
  });

  it('sells an undamaged summoning-sick non-token whose Defense exceeds two', () => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'worth_four', 0, { enteredThisTurn: true })]);
    submitSale(game, [11]);
  });

  it.each([
    ['mature', {}],
    ['new with granted Warcry', { enteredThisTurn: true, untilEotMods: [{ p: 0, t: 0, keywords: ['warcry'] }] }],
  ] satisfies [string, Partial<Permanent>][])('keeps a healthy %s non-token 4/4 at full board value', (_label, extra) => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'), behaviourBody(11, 'worth_four', 0, extra)]);
    expect(chooseTitheSacrifices(game.viewFor(0), FODDER_DB, cast)).toEqual([]);
    expect(applyTithePolicy(game.viewFor(0), FODDER_DB, game.legalActions(0))
      .some((action) => action.type === 'castSpell')).toBe(false);
  });

  it('declines one mana of savings when the full-price cast is already affordable', () => {
    const game = freshFodderGame([...lands(4), behaviourBody(10, 'cheap_value'), behaviourBody(11, 'tok-kelp-shade')]);
    expect(chooseTitheSacrifices(game.viewFor(0), FODDER_DB, cast)).toEqual([]);
    expect(applyTithePolicy(game.viewFor(0), FODDER_DB, game.legalActions(0))
      .filter((action) => action.type === 'castSpell')).toEqual([{ type: 'castSpell', handIndex: 0 }]);
  });

  it('accepts two mana of savings even when the full-price cast is affordable', () => {
    const game = freshFodderGame([...lands(4), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'tok-kelp-shade'), behaviourBody(12, 'tok-kelp-shade')]);
    submitSale(game, [11, 12]);
  });

  it('declines a one-mana discount that still leaves the cast unaffordable', () => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'), behaviourBody(11, 'tok-kelp-shade')]);
    expect(chooseTitheSacrifices(game.viewFor(0), FODDER_DB, cast)).toEqual([]);
  });

  it('does not count missing colored pips as a tempo unlock', () => {
    const db: CardDb = { ...FODDER_DB, tithe_horror: {
      ...FODDER_DB.tithe_horror, cost: { generic: 3, pips: { G: 1 } },
    } };
    const game = freshFodderGame([...lands(3).map((land) => ({ ...land, cardId: 'island' })),
      behaviourBody(10, 'cheap_value'), behaviourBody(11, 'tok-kelp-shade')], db);
    expect(chooseTitheSacrifices(game.viewFor(0), db, cast)).toEqual([]);
  });

  it('reads effective Defense for the small-body class without subtracting damage', () => {
    const game = freshFodderGame([...lands(3), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'worth_two', 0, { plusOneCounters: 1, damage: 1 })]);
    expect(chooseTitheSacrifices(game.viewFor(0), FODDER_DB, cast)).toEqual([]);
  });

  it('keeps the best body protected even when it is itself eligible token fodder', () => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value', 0, { isToken: true }),
      behaviourBody(11, 'worth_four')]);
    expect(chooseTitheSacrifices(game.viewFor(0), FODDER_DB, cast)).toEqual([]);
  });

  it('protects both chosen Empower targets while selling a different token', () => {
    const db: CardDb = { ...FODDER_DB, tithe_horror: { ...FODDER_DB.tithe_horror,
      empower: { cost: { generic: 0, pips: {} }, targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
        ops: [{ op: 'moveMark' }] },
    } };
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'tok-kelp-shade', 0, { plusOneCounters: 2 }),
      behaviourBody(12, 'worth_four', 0, { isToken: true }),
      behaviourBody(13, 'worth_four', 0, { isToken: true })], db);
    submitSale(game, [13], db, { empowered: true,
      targets: [{ kind: 'permanent', iid: 11 }, { kind: 'permanent', iid: 12 }] });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 11)).toBe(true);
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 12)).toBe(true);
  });

  it('can tap a mana creature before sacrificing it to fund the tempo cast', () => {
    const game = freshFodderGame([...lands(2), behaviourBody(10, 'cheap_value'),
      behaviourBody(11, 'elf'), behaviourBody(12, 'small_guard')]);
    expect(validateAction(game.instanceState, FODDER_DB, 0, { type: 'castSpell', handIndex: 0 })).not.toBeNull();
    submitSale(game, [11, 12], FODDER_DB, { manaPlan: [100, 101, 11] });
  });
});
