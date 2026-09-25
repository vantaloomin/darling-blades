import type { CardDb, CardEntry, GameState, PlayerId, TargetRef } from './types';
import { cardIdOf, isCardInstance, opponentOf } from './types';

export type GraveRef = Extract<TargetRef, { kind: 'grave' }>;

/**
 * Where a graveyard ref's card sits now, or -1 once it has left that
 * graveyard. A bound ref (one carrying `instanceId`, which every submitted
 * ref is) is found by identity, so a graveyard that changed order while a
 * spell waited still resolves the chosen card. Only an unbound ref, which
 * reaches the interpreter solely from direct fixtures, falls back to `index`.
 */
export function graveRefIndex(state: GameState, ref: GraveRef): number {
  const grave = state.players[ref.player]?.graveyard;
  if (!grave) return -1;
  if (ref.instanceId !== undefined) {
    return grave.findIndex((card) => isCardInstance(card) && card.instanceId === ref.instanceId);
  }
  return Number.isInteger(ref.index) && ref.index >= 0 && ref.index < grave.length ? ref.index : -1;
}

/** The card a graveyard ref names, if it is still in that graveyard. */
export function graveRefCard(state: GameState, ref: GraveRef): CardEntry | undefined {
  const index = graveRefIndex(state, ref);
  return index < 0 ? undefined : state.players[ref.player]!.graveyard[index];
}

/** The identity of the card at `index`, when that entry has one. */
export function graveInstanceAt(state: GameState, player: PlayerId, index: number): number | undefined {
  const card = state.players[player]?.graveyard[index];
  return card !== undefined && isCardInstance(card) ? card.instanceId : undefined;
}

/**
 * Bind a chooser's ref to the card it points at right now. Submission does
 * this before anything is stored, so the stack, held triggers and paused
 * effects only ever carry bound refs. A bound ref is returned unchanged.
 */
export function bindGraveRef(state: GameState, ref: GraveRef): GraveRef {
  if (ref.instanceId !== undefined) return ref;
  const instanceId = graveInstanceAt(state, ref.player, ref.index);
  return instanceId === undefined ? ref : { ...ref, instanceId };
}

/** A bound ref whose `index` no longer holds its card: built from another state. */
export function graveRefMoved(state: GameState, ref: GraveRef): boolean {
  return ref.instanceId !== undefined && graveInstanceAt(state, ref.player, ref.index) !== ref.instanceId;
}

/** Two refs name the same graveyard card: by identity when both carry it. */
export function sameGraveCard(a: GraveRef, b: GraveRef): boolean {
  if (a.player !== b.player) return false;
  return a.instanceId !== undefined && b.instanceId !== undefined
    ? a.instanceId === b.instanceId
    : a.index === b.index;
}

/** Call only for hand/deck entries. Battlefield and stack exits never tag. */
export function freshGraveyardCard(
  state: GameState,
  db: CardDb,
  card: CardEntry,
  owner: PlayerId,
): CardEntry {
  if (!db[cardIdOf(card)]?.whispers) return card;
  if (isCardInstance(card)) {
    card.whispersUntilDawnOf = opponentOf(owner);
    return card;
  }
  // Game normalizes inputs, but direct interpreter fixtures may still contain
  // strings. Give only this new-mechanic entry a collision-free physical ID.
  const cards = state.players.flatMap((player) => [
    ...player.deck, ...player.hand, ...player.graveyard, ...player.severed,
    ...(player.landReserve ?? []), ...(player.darlingZone ? [player.darlingZone] : []),
  ]);
  const maxId = Math.max(0, state.nextIid - 1,
    ...cards.map((entry) => isCardInstance(entry) ? entry.instanceId : 0),
    ...state.battlefield.map((perm) => perm.instanceId ?? perm.iid),
    ...state.stack.map((item) => item.instanceId ?? 0));
  state.nextInstanceId = Math.max(state.nextInstanceId ?? 1, maxId + 1);
  return { instanceId: state.nextInstanceId++, cardId: card, variantKey: null, whispersUntilDawnOf: opponentOf(owner) };
}
