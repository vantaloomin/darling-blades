import { describe, expect, it } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import type { Game } from '../../src/engine/Game';
import { body, DB, fixture } from './documentedBehaviourFixture';

/** Pass every priority window until the game asks for something else. */
function settle(sim: Game): void {
  for (let guard = 0; guard < 20; guard++) {
    const a = sim.awaiting;
    if (a.kind !== 'respond' && a.kind !== 'endStepWindow') return;
    sim.submit(a.player, { type: 'passResponse' });
  }
}

// Hard scores every candidate line from the same view, each in a fresh
// determinized world. A world that wrote through to the view would score
// each later candidate on the board an earlier candidate left behind.
describe('determinized worlds are isolated from their view', () => {
  it('a simulated combat changes its own board and leaves the view untouched', () => {
    const game = fixture([], [
      body(10, 'three'),
      body(11, 'worth_two'),
      body(20, 'three', 1, { tapped: true }),
      body(21, 'worth_four', 1, { tapped: true }),
    ], (state) => {
      state.activePlayer = 1;
      state.step = 'combat';
      state.awaiting = { kind: 'declareBlockers', player: 0 };
      state.combat = { attackers: [20, 21], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    });
    const view = game.viewFor(0);
    const before = structuredClone(view);

    const sim = determinize(view, DB, 1);
    sim.submit(0, { type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 20 }, { blocker: 11, attacker: 21 }] });
    settle(sim);

    // The world itself moved on: the traded threes and the chump are gone.
    const survivors = sim.state.battlefield.map((p) => p.iid).filter((iid) => iid < 100);
    expect(survivors).toEqual([21]);
    expect(view).toEqual(before);
  });
});
