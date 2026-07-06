import { describe, expect, it } from 'vitest';
import { previewCombat } from '../../src/engine/combat/damage';
import type { GameState } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * F12 combat forecast: previewCombat runs the real resolveCombatDamage on a
 * clone, so these golden outcomes double as a check that first-strike ordering,
 * deathtouch, trample, and lethal auto-assignment predict the true result.
 * Player 0 is the (active) attacker; player 1 defends.
 */
function combat(
  p0: { iid: number; cardId: string }[],
  p1: { iid: number; cardId: string }[],
  attackers: number[],
): GameState {
  const s = makeTestState({
    battlefield: [
      ...p0.map((c) => ({ iid: c.iid, cardId: c.cardId, controller: 0 as const })),
      ...p1.map((c) => ({ iid: c.iid, cardId: c.cardId, controller: 1 as const })),
    ],
    active: 0,
  });
  s.combat = { attackers, blocks: [], phase: 'blockersDeclared', damagePrevented: false };
  return s;
}

const sorted = (a: number[]): number[] => [...a].sort((x, y) => x - y);

describe('previewCombat', () => {
  it('a 4/4 blocked by a 2/2 kills the blocker, no player damage', () => {
    const s = combat([{ iid: 1, cardId: 'giant' }], [{ iid: 2, cardId: 'bear' }], [1]);
    const p = previewCombat(s, TEST_DB, [{ blocker: 2, attacker: 1 }]);
    expect(sorted(p.deaths)).toEqual([2]);
    expect(p.lifeDelta).toEqual([0, 0]);
  });

  it('first strike: a 2/2 first-striker kills its 2/2 blocker before taking damage', () => {
    // Without first strike this is a mutual trade; with it, only the blocker dies.
    const s = combat([{ iid: 1, cardId: 'knight' }], [{ iid: 2, cardId: 'bear' }], [1]);
    const p = previewCombat(s, TEST_DB, [{ blocker: 2, attacker: 1 }]);
    expect(sorted(p.deaths)).toEqual([2]); // attacker (knight) survives
  });

  it('deathtouch: a 1/1 deathtoucher trades with a 4/4', () => {
    const s = combat([{ iid: 1, cardId: 'assassin' }], [{ iid: 2, cardId: 'giant' }], [1]);
    const p = previewCombat(s, TEST_DB, [{ blocker: 2, attacker: 1 }]);
    expect(sorted(p.deaths)).toEqual([1, 2]); // both die
  });

  it('trample: a 4/4 trampler over a 2/2 kills it and pushes 2 to the defender', () => {
    const s = combat([{ iid: 1, cardId: 'rhino' }], [{ iid: 2, cardId: 'bear' }], [1]);
    const p = previewCombat(s, TEST_DB, [{ blocker: 2, attacker: 1 }]);
    expect(sorted(p.deaths)).toEqual([2]);
    expect(p.lifeDelta).toEqual([0, -2]); // defender (P1) takes the trample overflow
  });

  it('unblocked damage hits the defender and flags lethal', () => {
    const s = combat([{ iid: 1, cardId: 'giant' }], [], [1]);
    s.players[1].life = 3; // 4 damage is lethal from 3
    const p = previewCombat(s, TEST_DB, []);
    expect(p.deaths).toEqual([]);
    expect(p.lifeDelta).toEqual([0, -4]);
    expect(p.defenderLethal).toBe(true);
  });

  it('no combat → an empty forecast', () => {
    const s = makeTestState({ hands: [[], []], active: 0 });
    expect(previewCombat(s, TEST_DB, [])).toEqual({ deaths: [], lifeDelta: [0, 0], defenderLethal: false });
  });
});
