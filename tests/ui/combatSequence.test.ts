import { describe, expect, it } from 'vitest';
import { planCombat, type CombatHit } from '../../src/ui/combatSequence';

const hitP = (source: number, iid: number, amount = 1): CombatHit => ({
  source,
  target: { kind: 'permanent', iid },
  amount,
});
const hitFace = (source: number, player: 0 | 1, amount = 1): CombatHit => ({
  source,
  target: { kind: 'player', player },
  amount,
});

describe('planCombat', () => {
  it('makes one step per attacker in first-seen order', () => {
    const plan = planCombat([{ hits: [hitP(10, 99), hitFace(11, 1), hitP(12, 98)] }]);
    expect(plan.steps.map((s) => s.attacker)).toEqual([10, 11, 12]);
    expect(plan.steps.every((s, i) => s.atMs === i * plan.staggerMs)).toBe(true);
  });

  it('groups every hit of a ganging attacker into its single step', () => {
    const plan = planCombat([{ hits: [hitP(10, 90), hitP(11, 91), hitP(10, 92)] }]);
    expect(plan.steps).toHaveLength(2); // attacker 10 appears once
    expect(plan.steps[0].attacker).toBe(10);
    expect(plan.steps[0].hits).toHaveLength(2); // both of 10's hits
    expect(plan.steps[1].attacker).toBe(11);
  });

  it('orders first-strike rounds before the normal round', () => {
    const plan = planCombat([
      { hits: [hitP(50, 60)] }, // first-strike round
      { hits: [hitP(51, 61)] }, // normal round
    ]);
    expect(plan.steps.map((s) => s.attacker)).toEqual([50, 51]);
  });

  it('attributes a death to the LAST attacker that struck it', () => {
    // 10 and 11 both hit permanent 90; 90 dies → death shows on 11's step.
    const plan = planCombat([{ hits: [hitP(10, 90), hitP(11, 90), hitP(12, 77)] }], [90]);
    expect(plan.steps[0].deaths).toEqual([]);
    const step11 = plan.steps.find((s) => s.attacker === 11)!;
    expect(step11.deaths).toEqual([90]);
  });

  it('attaches an untraceable death to the final step', () => {
    const plan = planCombat([{ hits: [hitP(10, 90)] }], [12345]);
    expect(plan.steps[plan.steps.length - 1].deaths).toEqual([12345]);
  });

  it('clamps the stagger and computes a bounded total', () => {
    // Many attackers → gap hits the floor; total ≈ span + tail.
    const many = Array.from({ length: 10 }, (_, i) => hitFace(i, 1));
    const plan = planCombat([{ hits: many }], [], { minStagger: 140, budget: 1100, strikeMs: 460 });
    expect(plan.staggerMs).toBe(140); // 1100/10 = 110 → floored to 140
    expect(plan.totalMs).toBe(9 * 140 + 460);

    // A lone attacker still gets a real beat, capped at maxStagger.
    const solo = planCombat([{ hits: [hitFace(1, 1)] }], [], { maxStagger: 300, budget: 1100 });
    expect(solo.staggerMs).toBe(300); // 1100/1 = 1100 → capped to 300
    expect(solo.steps[0].atMs).toBe(0);
  });

  it('returns an empty plan for no hits', () => {
    const plan = planCombat([{ hits: [] }], []);
    expect(plan.steps).toEqual([]);
    expect(plan.totalMs).toBe(0);
  });
});
