import type { TargetRef } from '../engine/types';

/**
 * Pure combat-choreography planner (no Phaser — Vitest-importable). The engine
 * resolves all combat damage atomically and emits it as one `combatDamage`
 * batch (all hits at once). To let the player watch attackers strike the
 * defenders one at a time, DuelScene feeds those hits here and plays back the
 * returned per-attacker steps on a stagger, deferring the board sync until the
 * sequence ends. This module owns only the ORDER + TIMING; DuelScene resolves
 * tile positions, card art, and the actual tweens/SFX.
 *
 * @see src/ui/CombatFx.ts (the per-strike renderer) and
 *      src/scenes/DuelScene.ts `playCombatSequence` (the consumer).
 */

export interface CombatHit {
  source: number; // attacker iid
  target: TargetRef;
  amount: number;
}

/** One attacker's moment in the sequence. */
export interface CombatStep {
  attacker: number; // source iid
  hits: CombatHit[]; // this attacker's hits, in engine order
  deaths: number[]; // permanent iids that die AT this step (last hitter wins)
  atMs: number; // offset from sequence start when this step plays
}

export interface CombatPlan {
  steps: CombatStep[];
  staggerMs: number; // gap between consecutive steps
  totalMs: number; // when the whole sequence (incl. the last strike) is done
}

export interface CombatPlanOpts {
  minStagger?: number; // floor on the per-attacker gap (busy combats)
  maxStagger?: number; // ceiling (a lone attacker still gets a beat)
  budget?: number; // target total stagger span; gap ≈ budget / stepCount
  strikeMs?: number; // tail so the last strike finishes before the sync
}

const DEFAULTS: Required<CombatPlanOpts> = {
  minStagger: 140,
  maxStagger: 300,
  budget: 1100,
  strikeMs: 460,
};

/**
 * Plan the playback of a combat-damage batch.
 *
 * @param rounds  combat-damage rounds in engine order (first-strike round(s)
 *                precede the normal round), each carrying its hits.
 * @param diedIids permanent iids that died this combat (state-based actions).
 *
 * Steps are one-per-attacker in first-seen order across the flattened hits, so
 * first-strikers act before normal combatants. A death is attributed to the
 * LAST step that hit that permanent (it falls when the killing blow lands);
 * a death not traceable to any tracked hit attaches to the final step.
 */
export function planCombat(
  rounds: readonly { hits: readonly CombatHit[] }[],
  diedIids: readonly number[] = [],
  opts: CombatPlanOpts = {},
): CombatPlan {
  const { minStagger, maxStagger, budget, strikeMs } = { ...DEFAULTS, ...opts };

  const flat: CombatHit[] = [];
  for (const r of rounds) for (const h of r.hits) flat.push(h);

  // Ordered unique attackers (first appearance wins the ordering).
  const order: number[] = [];
  const byAttacker = new Map<number, CombatHit[]>();
  for (const h of flat) {
    let list = byAttacker.get(h.source);
    if (!list) {
      list = [];
      byAttacker.set(h.source, list);
      order.push(h.source);
    }
    list.push(h);
  }

  const steps: CombatStep[] = order.map((attacker) => ({
    attacker,
    hits: byAttacker.get(attacker)!,
    deaths: [],
    atMs: 0,
  }));

  if (steps.length === 0) return { steps, staggerMs: minStagger, totalMs: 0 };

  // Attribute each death to the last step whose hits struck that permanent.
  for (const iid of diedIids) {
    let stepIndex = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].hits.some((h) => h.target.kind === 'permanent' && h.target.iid === iid)) {
        stepIndex = i;
      }
    }
    if (stepIndex < 0) stepIndex = steps.length - 1; // untraceable → resolve last
    steps[stepIndex].deaths.push(iid);
  }

  const staggerMs = Math.max(minStagger, Math.min(maxStagger, Math.round(budget / steps.length)));
  steps.forEach((s, i) => {
    s.atMs = i * staggerMs;
  });
  const totalMs = (steps.length - 1) * staggerMs + strikeMs;
  return { steps, staggerMs, totalMs };
}
