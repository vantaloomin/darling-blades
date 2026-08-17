import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import { def, isType } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { cardValue, empowerValue, permValue } from './value';

type SpellCast = Extract<Action, { type: 'castSpell' }>;

function cardIdFor(view: PlayerView, cast: SpellCast): string {
  return cast.retell && cast.graveIndex !== undefined
    ? view.you.graveyard[cast.graveIndex]
    : view.you.hand[cast.handIndex];
}

export function isRiteCast(view: PlayerView, db: CardDb, action: Action): action is SpellCast {
  return action.type === 'castSpell' && def(db, cardIdFor(view, action)).rite !== undefined;
}

/**
 * Pick Rite fodder from public board information only. One highest-valued body
 * is protected unconditionally; the remaining creatures are ranked by
 * permValue with battlefield order as the deterministic tie-break. The cast
 * is declined when any selected body is worth more than the cast buys.
 */
export function chooseRiteSacrifices(
  view: PlayerView,
  db: CardDb,
  cast: SpellCast,
): number[] | undefined {
  const cardId = cardIdFor(view, cast);
  const rite = def(db, cardId).rite;
  if (!rite) return cast.sacrifices ?? [];

  const creatures = view.battlefield
    .map((perm, index) => ({
      perm,
      index,
      value: permValue(view.battlefield, db, perm.iid),
    }))
    .filter(
      ({ perm }) =>
        perm.controller === view.myId && isType(def(db, perm.cardId), 'creature'),
    );
  if (creatures.length <= rite.n) return undefined;

  const protectedBody = creatures.reduce((best, candidate) =>
    candidate.value > best.value ? candidate : best,
  );
  const fodder = creatures
    .filter(({ perm }) => perm.iid !== protectedBody.perm.iid)
    .sort((a, b) => a.value - b.value || a.index - b.index)
    .slice(0, rite.n);
  if (fodder.length !== rite.n) return undefined;

  const buyValue =
    cardValue(db, cardId) +
    (cast.x ?? 0) +
    (cast.empowered ? empowerValue(db, cardId) : 0);
  if (fodder.some(({ value }) => value > buyValue)) return undefined;
  return fodder.map(({ perm }) => perm.iid);
}

/** Replace engine-canonical Rite sets with policy sets, dropping declined casts. */
export function applyRitePolicy(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): Action[] {
  const prepared: Action[] = [];
  for (const action of legal) {
    if (!isRiteCast(view, db, action)) {
      prepared.push(action);
      continue;
    }
    const sacrifices = chooseRiteSacrifices(view, db, action);
    if (sacrifices) prepared.push({ ...action, sacrifices });
  }
  return prepared;
}

/** Total public board value paid by a prepared Rite cast. */
export function riteSacrificeValue(
  view: PlayerView,
  db: CardDb,
  cast: SpellCast,
): number {
  return (cast.sacrifices ?? []).reduce(
    (sum, iid) => sum + permValue(view.battlefield, db, iid),
    0,
  );
}
