/** Pure cast and Duty target selection over the engine's enumerated actions. */
import { validateAction, type Action } from '../engine/actions';
import type { CardDb, GameState, PlayerId, TargetRef } from '../engine/types';

export type TargetSelectionAction = Extract<Action, { type: 'castSpell' | 'castDarling' | 'activate' }>;

export interface TargetSelectionStep<T extends TargetSelectionAction = TargetSelectionAction> {
  actions: T[];
  targets: TargetRef[];
  selected: TargetRef[];
  complete: T | null;
  count: number;
  countText: string;
}

function sameTarget(a: TargetRef, b: TargetRef): boolean {
  if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
  if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
  if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
  return a.kind === 'grave' && b.kind === 'grave' && a.player === b.player && a.index === b.index;
}

function chosenX(action: TargetSelectionAction): number {
  return action.type === 'activate' ? 0 : action.x ?? 0;
}

/**
 * Ordered specs match a prefix, preserving independent effect slots. A sole
 * upTo/exactly spec uses a set, so the second member of a canonical pair may
 * be chosen first. Keep the original action pool across selections and undo.
 * Every returned action is the original engine object, including its costs.
 */
export function targetSelectionStep<T extends TargetSelectionAction>(
  actions: readonly T[],
  picked: readonly TargetRef[],
  unordered = false,
): TargetSelectionStep<T> {
  const duplicate = unordered && picked.some((target, index) =>
    picked.slice(0, index).some((previous) => sameTarget(previous, target)),
  );
  const matches = duplicate ? [] : actions.filter((action) => {
    const targets = action.targets ?? [];
    return picked.every((target, index) => unordered
      ? targets.some((candidate) => sameTarget(candidate, target))
      : targets[index] !== undefined && sameTarget(targets[index], target));
  });
  const targets: TargetRef[] = [];
  for (const action of matches) {
    const remaining = unordered
      ? (action.targets ?? []).filter((target) => !picked.some((chosen) => sameTarget(chosen, target)))
      : (action.targets ?? []).slice(picked.length, picked.length + 1);
    for (const target of remaining) {
      if (!targets.some((candidate) => sameTarget(candidate, target))) targets.push(target);
    }
  }
  const complete = matches.reduce<T | null>((best, action) => {
    if ((action.targets?.length ?? 0) !== picked.length) return best;
    return best === null || chosenX(action) > chosenX(best) ? action : best;
  }, null);
  const count = actions.reduce((maximum, action) => Math.max(maximum, action.targets?.length ?? 0), 0);
  return { actions: matches, targets, selected: [...picked], complete, count, countText: `${picked.length} of ${count}` };
}

/** Unordered picks toggle; ordered picks append only a legal next-slot ref. */
export function toggleTargetSelection<T extends TargetSelectionAction>(
  actions: readonly T[],
  picked: readonly TargetRef[],
  target: TargetRef,
  unordered = false,
): TargetRef[] {
  if (unordered && picked.some((selected) => sameTarget(selected, target))) {
    return picked.filter((selected) => !sameTarget(selected, target));
  }
  const next = targetSelectionStep(actions, picked, unordered).targets;
  return next.some((candidate) => sameTarget(candidate, target)) ? [...picked, target] : [...picked];
}

/** A separate undo preserves the ability to choose one ref for two slots. */
export function removeLastTargetSelection(picked: readonly TargetRef[]): TargetRef[] {
  return picked.slice(0, -1);
}

/** Pointer and keyboard confirmations share this final live engine check. */
export function confirmedTargetSelection<T extends TargetSelectionAction>(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  actions: readonly T[],
  picked: readonly TargetRef[],
  unordered = false,
): T | null {
  const action = targetSelectionStep(actions, picked, unordered).complete;
  return action !== null && validateAction(state, db, player, action) === null ? action : null;
}
