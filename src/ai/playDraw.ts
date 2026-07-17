import type { Action } from '../engine/actions';

/** Shared deterministic opening policy: every shipped brain chooses to play. */
export function choosePlayDraw(legal: readonly Action[]): Action {
  return (
    legal.find((action) => action.type === 'choosePlayDraw' && action.play) ??
    legal.find((action) => action.type === 'choosePlayDraw') ??
    legal[0]
  );
}
