import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { cardValue, empowerValue, whispersValue } from './value';

type Cast = Extract<Action, { type: 'castSpell' | 'castDarling' }>;

/** Keep the existing hand-cast comparison, including Easy's simpler score. */
export function applyWhispersPolicy(
  view: PlayerView,
  db: CardDb,
  legal: Action[],
  score: (cast: Cast) => number = (cast) => {
    if (cast.type === 'castSpell' && cast.whispers) {
      return whispersValue(db, view.you.graveyard[cast.graveIndex!], view);
    }
    const id = cast.type === 'castDarling' ? view.you.darlingZone! : view.you.hand[cast.handIndex];
    return cardValue(db, id) + (cast.x ?? 0) +
      (cast.type === 'castSpell' && cast.empowered ? empowerValue(db, id) : 0);
  },
): Action[] {
  if (!legal.some((action) => action.type === 'castSpell' && action.whispers)) return legal;
  const handValue = legal.reduce((best, action) => {
    if (action.type !== 'castDarling' &&
      (action.type !== 'castSpell' || action.retell || action.whispers)) return best;
    return Math.max(best, score(action));
  }, 0);
  return legal.filter((action) => action.type !== 'castSpell' || !action.whispers || (
    action.graveIndex !== undefined && view.you.whispersLive.includes(action.graveIndex) &&
    score(action) > handValue
  ));
}
