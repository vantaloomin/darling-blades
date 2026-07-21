import type { GameEvent } from './events';
import type { CardDb, GameState, Permanent, PlayerId } from './types';
import { def } from './types';

export type Emit = (e: GameEvent) => void;

/**
 * Zone-change primitives, deliberately trigger-free: callers (resolve, sba,
 * the effect interpreter) fire arrives/dies triggers themselves so this module
 * sits at the bottom of the import graph.
 */

export function enterBattlefield(
  state: GameState,
  db: CardDb,
  cardId: string,
  controller: PlayerId,
  emit: Emit,
  opts: { asToken?: boolean; attachedTo?: number } = {},
): Permanent {
  const d = def(db, cardId);
  const perm: Permanent = {
    iid: state.nextIid++,
    cardId,
    owner: controller,
    controller,
    tapped: d.entersTapped ?? false,
    enteredThisTurn: true,
    damage: 0,
    deathtouched: false,
    attachments: [],
    attachedTo: opts.attachedTo,
    plusOneCounters: 0,
    untilEotMods: [],
  };
  state.battlefield.push(perm);
  if (opts.attachedTo !== undefined) {
    const host = state.battlefield.find((p) => p.iid === opts.attachedTo);
    host?.attachments.push(perm.iid);
  }
  emit(
    opts.asToken
      ? { e: 'tokenCreated', perm: structuredClone(perm) }
      : { e: 'permanentEntered', perm: structuredClone(perm) },
  );
  return perm;
}

function detachFromHost(state: GameState, perm: Permanent): void {
  if (perm.attachedTo === undefined) return;
  const host = state.battlefield.find((p) => p.iid === perm.attachedTo);
  if (host) host.attachments = host.attachments.filter((iid) => iid !== perm.iid);
}

/** Battlefield → owner's graveyard (tokens evaporate). Returns true if it died. */
export function destroyPermanent(
  state: GameState,
  db: CardDb,
  perm: Permanent,
  emit: Emit,
): boolean {
  const idx = state.battlefield.findIndex((p) => p.iid === perm.iid);
  if (idx < 0) return false;
  state.battlefield.splice(idx, 1);
  detachFromHost(state, perm);
  const d = def(db, perm.cardId);
  if (!d.token) state.players[perm.owner].graveyard.push(perm.cardId);
  emit({ e: 'died', iid: perm.iid, cardId: perm.cardId, owner: perm.owner });
  return true;
}

/** Battlefield → owner's severed zone (tokens evaporate). This is not a death. */
export function severPermanent(
  state: GameState,
  db: CardDb,
  perm: Permanent,
  emit: Emit,
): boolean {
  const idx = state.battlefield.findIndex((p) => p.iid === perm.iid);
  if (idx < 0) return false;
  state.battlefield.splice(idx, 1);
  detachFromHost(state, perm);
  const d = def(db, perm.cardId);
  if (!d.token) state.players[perm.owner].severed.push(perm.cardId);
  emit({
    e: 'severed',
    player: perm.owner,
    cardId: perm.cardId,
    from: 'battlefield',
    iid: perm.iid,
  });
  return true;
}

/** Battlefield → owner's hand (tokens evaporate). This is a recall, not a death trigger. */
export function recallPermanent(
  state: GameState,
  db: CardDb,
  perm: Permanent,
  emit: Emit,
): boolean {
  const idx = state.battlefield.findIndex((p) => p.iid === perm.iid);
  if (idx < 0) return false;
  state.battlefield.splice(idx, 1);
  detachFromHost(state, perm);
  const d = def(db, perm.cardId);
  if (!d.token) {
    state.players[perm.owner].hand.push(perm.cardId);
    emit({ e: 'cardsBottomed', player: perm.owner, count: 0 }); // no dedicated event; UI resyncs
  }
  emit({ e: 'died', iid: perm.iid, cardId: perm.cardId, owner: perm.owner });
  return true;
}
