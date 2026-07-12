import { describe, expect, it } from 'vitest';
import { chooseAttackers } from '../../src/ai/combatPlans';
import { evaluate } from '../../src/ai/evaluate';
import { dawnSelfBleed } from '../../src/ai/value';
import { RULES } from '../../src/config/rules';
import type { CardDb, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  // tk-other's shape: big body that bleeds its controller every dawn
  bleeder: {
    id: 'bleeder',
    name: 'Reckless Warlord',
    types: ['creature'],
    subtypes: ['Other', 'Warrior'],
    cost: { generic: 2, pips: { R: 2 } },
    colors: ['R'],
    attack: 5,
    defense: 3,
    keywords: ['warcry'],
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'controller' }] }],
    rarity: 'sr',
  },
};

/** The playtest board: AI (P0) holds the bleeder + a bear behind a FULL
 * enemy bench of 8 untapped walls — no attack is profitable, and the AI's
 * own dawn trigger is the only clock in the game. */
function stalledBoard(): Partial<Permanent>[] {
  return [
    { iid: 1, cardId: 'bleeder', controller: 0 },
    { iid: 2, cardId: 'bear', controller: 0 },
    ...Array.from({ length: RULES.maxCreatures }, (_, i) => ({
      iid: 10 + i,
      cardId: 'sentinel', // 2/4 — every block trades up against the bear
      controller: 1 as const,
    })),
  ];
}

describe('AI models its own dawn self-bleed clock', () => {
  it('dawnSelfBleed sums per-dawn controller damage per side', () => {
    const state = makeTestState({ battlefield: stalledBoard() });
    expect(dawnSelfBleed(state.battlefield, DB, 0)).toBe(1);
    expect(dawnSelfBleed(state.battlefield, DB, 1)).toBe(0);
  });

  it('evaluate scores a bleeding low-life board worse than the same board without the clock', () => {
    const bleeding = makeTestState({ battlefield: stalledBoard() });
    bleeding.players[0].life = 4;
    const inert = makeTestState({
      battlefield: stalledBoard().map((p) => (p.cardId === 'bleeder' ? { ...p, cardId: 'lubu' } : p)),
    });
    inert.players[0].life = 4;
    // lubu is a strictly better body (5/3 warcry, no drawback, legendary) —
    // the ONLY reason the bleeder board can score lower is the clock term.
    expect(evaluate(bleeding, DB, 0)).toBeLessThan(evaluate(inert, DB, 0));
  });

  it('attacks in desperation when its own bleed clock is short, instead of dying passively', () => {
    const state = makeTestState({ battlefield: stalledBoard() });
    // Sanity: at healthy life the wall keeps everyone home (no profitable swing).
    expect(chooseAttackers(state.battlefield, DB, 0, 20, 0, 20)).toEqual([]);
    // At 4 life with 1 bleed/turn, passivity is certain death — swing.
    const desperate = chooseAttackers(state.battlefield, DB, 0, 20, 0, 4);
    expect(desperate.length).toBeGreaterThan(0);
  });
});
