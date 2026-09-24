/** Pure cast-picker state. The engine remains the authority for cost and legality. */
import { castCost, validateAction, type Action } from '../engine/actions';
import { getEffectiveStats } from '../engine/statics';
import { cardIdOf, def, isType, type CardDb, type GameState, type PlayerId } from '../engine/types';

export type HandCastAction = Extract<Action, { type: 'castSpell' }>;

/** Legal actions dedupe hand copies; graveyard indices never identify a hand card. */
export function handCastChoices(actions: readonly Action[], hand: readonly string[], handIndex: number): HandCastAction[] {
  const cardId = hand[handIndex];
  if (cardId === undefined) return [];
  return actions.filter((action): action is HandCastAction => action.type === 'castSpell' &&
    action.retell !== true && action.whispers !== true && hand[action.handIndex] === cardId)
    .map((action) => ({ ...action, handIndex }));
}

export function sacrificeCandidates(state: GameState, db: CardDb, player: PlayerId): number[] {
  return state.battlefield.filter((perm) => perm.controller === player && isType(def(db, perm.cardId), 'creature'))
    .map((perm) => perm.iid);
}

/** A full Rite selection can be reduced, but cannot grow beyond its exact cost. */
export function toggleSacrifice(selected: readonly number[], iid: number, candidates: readonly number[], maximum?: number): number[] {
  if (!candidates.includes(iid)) return [...selected];
  if (selected.includes(iid)) return selected.filter((chosen) => chosen !== iid);
  return maximum !== undefined && selected.length >= maximum ? [...selected] : [...selected, iid];
}

export function castActionCost(state: GameState, db: CardDb, player: PlayerId, action: HandCastAction) {
  const side = state.players[player];
  const source = action.retell || action.whispers
    ? side.graveyard[action.graveIndex ?? action.handIndex] : side.hand[action.handIndex];
  if (source === undefined) return undefined;
  return castCost(def(db, cardIdOf(source)), action.empowered === true, action.retell === true, action.hauntlinked === true, {
    whispers: action.whispers, tithe: action.tithe, sacrifices: action.sacrifices, state, db,
  });
}

/** Changing fodder invalidates any old explicit payment plan. No state is mutated. */
export function sacrificeSelection(state: GameState, db: CardDb, player: PlayerId,
  casts: readonly HandCastAction[], selected: readonly number[]) {
  const actions = casts.map((cast) => {
    const action = { ...cast, sacrifices: [...selected] };
    delete action.manaPlan;
    return action;
  });
  const candidates = sacrificeCandidates(state, db, player);
  const validSelection = new Set(selected).size === selected.length && selected.every((iid) => candidates.includes(iid));
  return {
    defense: validSelection ? selected.reduce((sum, iid) => sum + getEffectiveStats(state.battlefield, db, iid).defense, 0) : 0,
    cost: validSelection && actions[0] ? castActionCost(state, db, player, actions[0]) : undefined,
    actions: validSelection ? actions.filter((action) => validateAction(state, db, player, action) === null) : [],
  };
}

export function whispersDeadline(activePlayer: PlayerId, owner: PlayerId, viewer: PlayerId): string {
  if (activePlayer === owner) return 'Whispers: next Dawn';
  return owner === viewer ? 'Whispers: after your turn' : "Whispers: after foe's turn";
}
