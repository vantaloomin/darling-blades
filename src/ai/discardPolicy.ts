import type { Action } from '../engine/actions';
import { canPay } from '../engine/mana';
import { def, isType, manaValue, type CardDb } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { cardValue } from './value';

/** Loot is a mandatory choice, independent of the brain's random stream. */
export function chooseDiscard(view: PlayerView, db: CardDb): Action {
  const awaiting = view.awaiting;
  if (awaiting.kind !== 'discardToHandSize' || awaiting.decision !== 'discard' ||
    awaiting.player !== view.myId) return { type: 'discard', handIndices: [] };
  const sources = view.battlefield.filter((perm) => perm.controller === view.myId &&
    (def(db, perm.cardId).manaAbility?.length ?? 0) > 0).length;
  const remaining = view.you.hand.map((cardId, index) => {
    const card = def(db, cardId);
    const land = isType(card, 'land');
    return { index, cardId, land, cost: manaValue(card.cost),
      castable: !land && canPay(view, db, view.myId, card.cost ?? { generic: 0, pips: {} }, card.x?.min ?? 0) };
  });
  const indices: number[] = [];
  const count = Math.min(awaiting.count, remaining.length);
  while (indices.length < count) {
    const castable = remaining.filter((card) => card.castable);
    // Preserve the last affordable spell whenever there is another card to pay.
    const choices = remaining.filter((card) => !card.castable || castable.length > 1 || remaining.length === 1);
    const projectedLands = sources + remaining.filter((card) => card.land).length;
    const rank = (card: typeof remaining[number]): number =>
      !card.land && !card.castable ? 0 : card.land && projectedLands > 4 ? 1 : 2;
    choices.sort((a, b) => rank(a) - rank(b) ||
      (rank(a) === 0 ? b.cost - a.cost : cardValue(db, a.cardId) - cardValue(db, b.cardId)) ||
      a.index - b.index);
    const chosen = choices[0];
    indices.push(chosen.index);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return { type: 'discard', handIndices: indices.sort((a, b) => a - b) };
}
