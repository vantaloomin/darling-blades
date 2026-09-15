import { describe, expect, it, vi } from 'vitest';
import { chooseAttackers } from '../../src/ai/combatPlans';
import { HardAI } from '../../src/ai/HardAI';
import { applyTithePolicy, chooseTitheSacrifices, isTitheCast, titheManaSaved } from '../../src/ai/tithePolicy';
import { validateAction, type Action } from '../../src/engine/actions';
import type { PlayerView } from '../../src/engine/view';
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

  it('pins default Easy Tithe randomness at seed 41', () => {
    const ai = brain('Easy', 41, false);
    const game = titheGame();
    const actions = Array.from({ length: 12 }, () => ai.chooseAction(game.viewFor(0), game.legalActions(0)).type);
    expect(actions).toEqual(['castSpell', 'castSpell', 'castSpell', 'passStep', 'castSpell',
      'passStep', 'castSpell', 'castSpell', 'castSpell', 'castSpell', 'castSpell', 'castSpell']);
  });

  it.each(difficulties)('%s pins deterministic Tithe choice at seed 41', (difficulty) => {
    const first = titheGame();
    const second = titheGame();
    const action = brain(difficulty, 41).chooseAction(first.viewFor(0), first.legalActions(0));
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [11, 12] });
    expect(brain(difficulty, 41).chooseAction(second.viewFor(0), second.legalActions(0))).toEqual(action);
  });
});
