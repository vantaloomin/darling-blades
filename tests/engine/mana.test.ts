import { describe, expect, it } from 'vitest';
import { manaSources, maxPayableX, solveMana } from '../../src/engine/mana';
import { makeTestState, TEST_DB } from '../helpers';

describe('solveMana', () => {
  it('taps a land per pip and per generic', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
      ],
    });
    const plan = solveMana(st, TEST_DB, 0, { generic: 1, pips: { G: 1 } });
    expect(plan).not.toBeNull();
    expect(plan!.sort()).toEqual([1, 2]);
  });

  it('fails when a colored pip is unpayable', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'plains', controller: 0 },
        { iid: 2, cardId: 'plains', controller: 0 },
      ],
    });
    expect(solveMana(st, TEST_DB, 0, { generic: 0, pips: { G: 1 } })).toBeNull();
  });

  it('ignores tapped sources and the opponent’s lands', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0, tapped: true },
        { iid: 2, cardId: 'forest', controller: 1 },
      ],
    });
    expect(solveMana(st, TEST_DB, 0, { generic: 0, pips: { G: 1 } })).toBeNull();
  });

  it('prefers mono-producers for pips, keeping duals flexible', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'dual_gw', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
      ],
    });
    // G pip should come from the Forest, leaving the dual for anything else.
    const plan = solveMana(st, TEST_DB, 0, { generic: 0, pips: { G: 1 } });
    expect(plan).toEqual([2]);
  });

  it('backtracks where greedy scarcity could dead-end', () => {
    // Cost WG with one dual (G/W) and one forest (G): dual must take W.
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'dual_gw', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
      ],
    });
    const plan = solveMana(st, TEST_DB, 0, { generic: 0, pips: { G: 1, W: 1 } });
    expect(plan).not.toBeNull();
    expect(plan!.sort()).toEqual([1, 2]);
  });

  it('summoning-sick mana creatures cannot pay; established ones can', () => {
    const sick = makeTestState({
      battlefield: [{ iid: 1, cardId: 'elf', controller: 0, enteredThisTurn: true }],
    });
    expect(manaSources(sick, TEST_DB, 0)).toHaveLength(0);

    const ready = makeTestState({
      battlefield: [{ iid: 1, cardId: 'elf', controller: 0, enteredThisTurn: false }],
    });
    expect(solveMana(ready, TEST_DB, 0, { generic: 0, pips: { G: 1 } })).toEqual([1]);
  });

  it('prefers lands over mana creatures for generic costs', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'elf', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
        { iid: 3, cardId: 'forest', controller: 0 },
      ],
    });
    const plan = solveMana(st, TEST_DB, 0, { generic: 1, pips: { G: 1 } })!;
    // The elf should stay untapped (it is a would-be blocker).
    expect(plan).not.toContain(1);
  });

  it('respects reserved sources (AI mana hold-up)', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
      ],
    });
    expect(solveMana(st, TEST_DB, 0, { generic: 1, pips: { G: 1 } }, 0, [1])).toBeNull();
    expect(solveMana(st, TEST_DB, 0, { generic: 0, pips: { G: 1 } }, 0, [1])).toEqual([2]);
  });

  it('computes max payable X', () => {
    const st = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'mountain', controller: 0 },
        { iid: 2, cardId: 'mountain', controller: 0 },
        { iid: 3, cardId: 'mountain', controller: 0 },
      ],
    });
    // Blaze-style: {R} + X → with 3 mountains, X max is 2.
    expect(maxPayableX(st, TEST_DB, 0, { generic: 0, pips: { R: 1 } })).toBe(2);
  });
});
