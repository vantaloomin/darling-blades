import { describe, expect, it } from 'vitest';
import { applyTithePolicy, chooseTitheSacrifices, isTitheCast, titheManaSaved } from '../../src/ai/tithePolicy';
import { applyWhispersPolicy } from '../../src/ai/whispersPolicy';
import { validateAction, type Action } from '../../src/engine/actions';
import { body, brain, DB, difficulties, gameWith, land, tagged } from './whispersTitheFixture';

/**
 * Owner ruling 2026-09-17: one card may carry Whispers and Tithe. The fodder
 * pays down the WHISPERS generic, so every Tithe reader has to resolve the
 * card through the graveyard, where handIndex only mirrors graveIndex.
 */
type SpellCast = Extract<Action, { type: 'castSpell' }>;

/** One Forest against a Whispers cost of {2}: the plain cast is one mana short. */
function shortGame(hand: string[] = []) {
  return gameWith({
    hand,
    graves: [[tagged('wh_tithe')], []],
    battlefield: [land(1), body(10, 'best'), body(20, 'odd')],
  });
}

const pair: SpellCast = {
  type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true, tithe: true, sacrifices: [20],
};

describe('Whispers plus Tithe AI policy', () => {
  it('treats a whispered cast as a Tithe cast through the graveyard, not the hand slot', () => {
    const empty = shortGame().viewFor(0);
    expect(empty.you.hand).toEqual([]);
    expect(isTitheCast(empty, DB, pair)).toBe(true);
    expect(isTitheCast(empty, DB, { ...pair, tithe: undefined })).toBe(false);
    // handIndex 0 mirrors graveIndex 0 and holds a card with no Tithe at all.
    const decoy = shortGame(['best']).viewFor(0);
    expect(DB.best.tithe).toBeUndefined();
    expect(isTitheCast(decoy, DB, pair)).toBe(true);
    expect(isTitheCast(decoy, DB, { type: 'castSpell', handIndex: 0, tithe: true })).toBe(false);
  });

  it('prices the discount off the Whispers cost, not the printed one', () => {
    const view = shortGame(['wh_tithe']).viewFor(0);
    // Nine Defense buys four generic; the Whispers generic is 2, the printed one 6.
    expect(titheManaSaved(view, DB, { ...pair, sacrifices: [20, 10] })).toBe(2);
    expect(titheManaSaved(view, DB, {
      type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [20, 10],
    })).toBe(4);
    expect(titheManaSaved(view, DB, pair)).toBe(1);
  });

  it('spends the fodder-class token and protects the best body', () => {
    const view = shortGame().viewFor(0);
    expect(chooseTitheSacrifices(view, DB, pair)).toEqual([20]);
  });

  it('offers exactly one prepared Whispers-plus-Tithe cast to the brains', () => {
    const game = shortGame();
    const view = game.viewFor(0);
    const legal = game.legalActions(0);
    // The plain Whispers cast is unaffordable, so only the discounted one is legal.
    expect(legal.filter((action) => action.type === 'castSpell')).toHaveLength(1);
    const prepared = applyWhispersPolicy(view, DB, applyTithePolicy(view, DB, legal))
      .filter((action): action is SpellCast => action.type === 'castSpell');
    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({ whispers: true, tithe: true, graveIndex: 0, sacrifices: [20] });
    expect(validateAction(game.instanceState, DB, 0, prepared[0])).toBeNull();
  });

  it.each(difficulties)('%s casts the whispered body through Tithe when the plain cost is short', (name) => {
    const game = shortGame();
    const chosen = brain(name).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(chosen).toMatchObject({ type: 'castSpell', whispers: true, tithe: true, graveIndex: 0 });
    expect((chosen as SpellCast).sacrifices).toEqual([20]);
    expect(validateAction(game.instanceState, DB, 0, chosen)).toBeNull();
  });

  it('leaves the plain Whispers cast alone when the board has no spare fodder', () => {
    const game = gameWith({
      graves: [[tagged('wh_tithe')], []],
      battlefield: [land(1), land(2), body(10, 'best')],
    });
    const view = game.viewFor(0);
    const legal = game.legalActions(0);
    const prepared = applyTithePolicy(view, DB, legal)
      .filter((action): action is SpellCast => action.type === 'castSpell');
    expect(prepared).toHaveLength(1);
    expect(prepared[0].tithe).toBeUndefined();
    expect(chooseTitheSacrifices(view, DB, pair)).toEqual([]);
  });
});
