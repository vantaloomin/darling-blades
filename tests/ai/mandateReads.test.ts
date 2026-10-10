import { describe, expect, it } from 'vitest';
import { chooseAttackers, chooseBlocks } from '../../src/ai/combatPlans';
import { evaluate } from '../../src/ai/evaluate';
import { MANDATE_HOLD_VALUE, opImpactValue } from '../../src/ai/value';
import { viewFor } from '../../src/engine/view';
import type { CardDb, CardDef, CombatState, GameState, Permanent, PlayerId } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The AI reads the Mandate (2.0 lane B3): Medium attacks to steal it and
 * blocks to keep it, a claim is worth nothing to its holder, and Hard's
 * evaluation prices holding it from public information.
 */

const creature = (id: string, attack: number, defense: number): CardDef => ({ ...TEST_DB.bear, id, attack, defense, keywords: [] });
const DB: CardDb = {
  ...TEST_DB,
  three: creature('three', 3, 3),
  guard: creature('guard', 1, 1),
  // 0/1, and +3/+0 while you hold the Mandate.
  herald: { ...creature('herald', 0, 1), abilities: [{ when: 'static', static: { scope: 'self', p: 3, t: 0, condition: 'youHoldMandate' } }] },
};

const board = (perms: Partial<Permanent>[]): Permanent[] => makeTestState({ battlefield: perms }).battlefield;

describe('Medium attacks to steal the Mandate', () => {
  // Two 2/2s into one untapped 3/3: one is eaten, the other connects for 2.
  const bf = board([
    { iid: 1, cardId: 'bear', controller: 0 },
    { iid: 2, cardId: 'bear', controller: 0 },
    { iid: 10, cardId: 'three', controller: 1 },
  ]);
  const attackers = (holder: PlayerId | null): number[] =>
    chooseAttackers(bf, DB, 0, 20, 0, 20, undefined, bf, holder);

  it('stays home when a bear would be eaten for 2 damage', () => {
    expect(attackers(null)).toEqual([]);
  });

  it('sends both when the defender holds the Mandate, since one is sure to connect', () => {
    expect(attackers(1).sort()).toEqual([1, 2]);
  });

  it('gains nothing from connecting when it already holds the Mandate', () => {
    expect(attackers(0)).toEqual([]);
  });

  it('counts a "while you hold the Mandate" bonus on its own attackers', () => {
    const herald = board([{ iid: 1, cardId: 'herald', controller: 0 }]);
    expect(chooseAttackers(herald, DB, 0, 20, 0, 20, undefined, herald, null)).toEqual([]);
    expect(chooseAttackers(herald, DB, 0, 20, 0, 20, undefined, herald, 0)).toEqual([1]);
  });
});

describe('Medium blocks to keep the Mandate', () => {
  const declared = (attackerIids: number[]): CombatState =>
    ({ attackers: attackerIids, blocks: [], phase: 'attackersDeclared', damagePrevented: false });

  it('chumps a lone attacker that would otherwise take it', () => {
    const bf = board([{ iid: 1, cardId: 'bear', controller: 0, tapped: true }, { iid: 10, cardId: 'guard', controller: 1 }]);
    expect(chooseBlocks(bf, DB, 1, 20, declared([1]), 0)).toEqual([]);
    expect(chooseBlocks(bf, DB, 1, 20, declared([1]), 0, undefined, 1)).toEqual([{ blocker: 10, attacker: 1 }]);
  });

  it('keeps the chump home when another attacker connects anyway', () => {
    const bf = board([
      { iid: 1, cardId: 'bear', controller: 0, tapped: true },
      { iid: 2, cardId: 'bear', controller: 0, tapped: true },
      { iid: 10, cardId: 'guard', controller: 1 },
    ]);
    expect(chooseBlocks(bf, DB, 1, 20, declared([1, 2]), 0, undefined, 1)).toEqual([]);
  });
});

describe('the Mandate in card value and evaluation', () => {
  const state = (holder?: PlayerId, deck = 20): GameState => {
    const s = makeTestState({});
    s.players.forEach((p) => { p.deck = Array<string>(deck).fill('bear'); });
    if (holder !== undefined) s.mandateHolder = holder;
    return s;
  };

  it('prices a claim only for a player who does not hold it', () => {
    const claim = { op: 'claimMandate' } as const;
    expect(opImpactValue(claim, undefined, undefined, { view: viewFor(state(), 0), db: DB })).toBe(MANDATE_HOLD_VALUE);
    expect(opImpactValue(claim, undefined, undefined, { view: viewFor(state(0), 0), db: DB })).toBe(0);
  });

  it('Hard prefers holding it, until the extra draw would empty its deck', () => {
    expect(evaluate(state(0), DB, 0)).toBeGreaterThan(evaluate(state(), DB, 0));
    expect(evaluate(state(1), DB, 0)).toBeLessThan(evaluate(state(), DB, 0));
    expect(evaluate(state(0, 0), DB, 0)).toBeLessThan(evaluate(state(undefined, 0), DB, 0));
  });
});
