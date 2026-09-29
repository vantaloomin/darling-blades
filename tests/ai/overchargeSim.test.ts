import { describe, expect, it } from 'vitest';
import { determinize, simDb } from '../../src/ai/determinize';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import { board, card, dbOf, spell } from '../drownedDeepFixture';

/**
 * Overcharge (1.9 A1.7) needs no new AI read: Hard sees it because its
 * determinized worlds are built from the public view and run the real engine.
 * This holds both halves: the view's Overcharges reach the world, and a token
 * refused in a simulated line overcharges its namesake there.
 */
const db = dbOf(
  card('tok-hatch', { name: 'Hatchling', token: true, attack: 1, defense: 1 }),
  card('body', { attack: 1, defense: 1 }),
  spell('hatch-call', [{ op: 'createToken', token: 'tok-hatch', count: 1 }]),
);

describe("Hard's simulated worlds and Overcharge", () => {
  it('carry a creature\'s Overcharges from the view, and run the rule on a refused token', () => {
    const state = board([['hatch-call'], []], [
      { iid: 1, cardId: 'tok-hatch' },
      ...Array.from({ length: RULES.maxCreatures - 1 }, (_, i) => ({ iid: 2 + i, cardId: 'body' })),
    ]);
    state.battlefield[0].isToken = true;
    state.battlefield[0].overcharge = 1;
    const game = Game.restore(state, db);
    const view = game.viewFor(0);

    const sim = determinize(view, simDb(db), 1);
    const simHatch = () => sim.instanceState.battlefield.find((p) => p.iid === 1)!;
    expect(simHatch().overcharge).toBe(1);

    sim.submit(0, { type: 'castSpell', handIndex: 0 });
    for (let guard = 0; guard < 20 && sim.awaiting.kind === 'respond'; guard++) {
      sim.submit(sim.awaiting.player, { type: 'passResponse' });
    }
    expect(simHatch().overcharge).toBe(2);
    expect(getEffectiveStats(sim.instanceState.battlefield, db, 1).attack).toBe(3);
    expect(view.battlefield.find((p) => p.iid === 1)!.overcharge).toBe(1);
  });
});
