import { describe, expect, it } from 'vitest';
import { compelledAttackers } from '../../src/engine/combat/legality';
import { chooseAttackers } from '../../src/ai/combatPlans';
import { combatSetup, TEST_DB } from '../helpers';

/**
 * Rage: "attacks every turn if it is able to". The rule is a REQUIREMENT over
 * the whole declaration, not a permission on one creature, so the case that
 * matters most is the empty declaration that would otherwise skip combat.
 *
 * The compulsion is defined as a filter over the eligible attackers, so every
 * existing reason a creature cannot attack has to keep winning: summoning
 * sickness, being tapped, and Bulwark's flat "cannot attack".
 */
describe('Rage', () => {
  it('is not offered a declaration that leaves it home, including the empty one', () => {
    const { game, iid } = combatSetup([{ key: 'rager', cardId: 'rager' }, { key: 'bear', cardId: 'bear' }], []);
    const declarations = game
      .legalActions(0)
      .filter((a) => a.type === 'declareAttackers')
      .map((a) => (a.type === 'declareAttackers' ? a.attackers : []));

    expect(declarations.length).toBeGreaterThan(0);
    for (const attackers of declarations) {
      expect(attackers).toContain(iid.rager);
    }
    // the free attacker is still a real choice: both with and without it exist
    expect(declarations.some((d) => d.includes(iid.bear))).toBe(true);
    expect(declarations.some((d) => !d.includes(iid.bear))).toBe(true);
    // and skipping combat is gone
    expect(declarations.some((d) => d.length === 0)).toBe(false);
  });

  it('rejects a hand-built declaration that skips it', () => {
    const { game, iid } = combatSetup([{ key: 'rager', cardId: 'rager' }, { key: 'bear', cardId: 'bear' }], []);
    expect(() => game.submit(0, { type: 'declareAttackers', attackers: [] })).toThrow(/must attack/);
    expect(() => game.submit(0, { type: 'declareAttackers', attackers: [iid.bear] })).toThrow(/must attack/);
    expect(() => game.submit(0, { type: 'declareAttackers', attackers: [iid.rager] })).not.toThrow();
  });

  it('compels only creatures that are ABLE to attack', () => {
    const { game, iid } = combatSetup(
      [
        { key: 'ready', cardId: 'rager' },
        { key: 'sick', cardId: 'rager', enteredThisTurn: true },
        { key: 'tapped', cardId: 'rager', tapped: true },
        { key: 'walled', cardId: 'ragewall' },
      ],
      [],
    );
    const compelled = compelledAttackers(game.instanceState.battlefield, TEST_DB, 0);
    expect(compelled).toEqual([iid.ready]);
    // Bulwark's "cannot attack" beats Rage's "if able"
    expect(compelled).not.toContain(iid.walled);
  });

  it('still lets combat be skipped when nothing with Rage can attack', () => {
    const { game } = combatSetup([{ key: 'sick', cardId: 'rager', enteredThisTurn: true }], []);
    expect(() => game.submit(0, { type: 'declareAttackers', attackers: [] })).not.toThrow();
  });

  it('is never dropped by the AI attack planner, even when staying home scores better', () => {
    // A lone 2/2 into an untapped 5/5 is a losing attack the planner would
    // normally refuse; Rage takes the choice away.
    const { game, iid } = combatSetup(
      [{ key: 'rager', cardId: 'rager' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    const bf = game.instanceState.battlefield;
    expect(chooseAttackers(bf, TEST_DB, 0, 20, 0)).toEqual([iid.rager]);

    // and the same board without Rage does stay home, so the test above is
    // measuring the compulsion rather than an eager planner
    const plain = combatSetup([{ key: 'bear', cardId: 'bear' }], [{ key: 'giant', cardId: 'giant' }]);
    expect(chooseAttackers(plain.game.instanceState.battlefield, TEST_DB, 0, 20, 0)).toEqual([]);
  });
});
