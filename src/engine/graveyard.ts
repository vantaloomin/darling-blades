import type { CardDb, CardEntry, GameState, PlayerId } from './types';
import { cardIdOf, isCardInstance, opponentOf } from './types';

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
