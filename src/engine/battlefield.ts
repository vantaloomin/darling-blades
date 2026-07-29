import type { GameEvent } from './events';
import type { CardDb, CardEntry, CardInstance, GameState, Permanent, PlayerId } from './types';
import { cardIdOf, def, isCardInstance, variantKeyOf } from './types';

export type Emit = (e: GameEvent) => void;

/**
 * Zone-change primitives, deliberately trigger-free: callers (resolve, sba,
 * the effect interpreter) fire arrives/dies triggers themselves so this module
 * sits at the bottom of the import graph.
 */

export function enterBattlefield(
  state: GameState,
  db: CardDb,
  card: CardEntry,
  controller: PlayerId,
  emit: Emit,
  opts: { asToken?: boolean; attachedTo?: number } = {},
): Permanent {
  const cardId = cardIdOf(card);
  const d = def(db, card);
  const iid = state.nextIid++;
  const instanceId = isCardInstance(card)
    ? card.instanceId
    : state.nextInstanceId !== undefined
      ? state.nextInstanceId++
      : iid;
  const perm: Permanent = {
    iid,
    instanceId,
    cardId,
    variantKey: variantKeyOf(card),
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
    if (!host) throw new Error(`enterBattlefield: missing attachment host ${opts.attachedTo}`);
    host.attachments.push(perm.iid);
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

function basicReturnsToReserve(state: GameState, db: CardDb, perm: Permanent): boolean {
  const d = def(db, perm.cardId);
  return (
    state.players[perm.owner].landReserve !== undefined &&
    d.types.includes('land') &&
    (d.supertypes?.includes('basic') ?? false)
  );
}

/** Whether a destroy exit is a real death for triggers and accounting. */
export function firesDiesForDestroy(state: GameState, db: CardDb, perm: Permanent): boolean {
  return !basicReturnsToReserve(state, db, perm);
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
  if (!d.token) {
    pushMovedCard(state, perm, basicReturnsToReserve(state, db, perm) ? 'landReserve' : 'graveyard');
  }
  if (firesDiesForDestroy(state, db, perm)) {
    emit({ e: 'died', iid: perm.iid, cardId: perm.cardId, owner: perm.owner });
  }
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
  if (!d.token) pushMovedCard(state, perm, 'severed');
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
  const basicToReserve = basicReturnsToReserve(state, db, perm);
  if (!d.token) {
    const toReserve = state.players[perm.owner].landReserve !== undefined && d.types.includes('land');
    pushMovedCard(state, perm, toReserve ? 'landReserve' : 'hand');
    emit({ e: 'cardsBottomed', player: perm.owner, count: 0 }); // no dedicated event; UI resyncs
  }
  if (!basicToReserve) {
    emit({ e: 'died', iid: perm.iid, cardId: perm.cardId, owner: perm.owner });
  }
  return true;
}

/** Preserve legacy string fixtures while keeping every Game-created move physical. */
function pushMovedCard(
  state: GameState,
  perm: Permanent,
  zone: 'hand' | 'graveyard' | 'severed' | 'landReserve',
): void {
  const card: CardEntry =
    state.nextInstanceId === undefined
      ? perm.cardId
      : ({
          instanceId: perm.instanceId ?? perm.iid,
          cardId: perm.cardId,
          variantKey: perm.variantKey ?? null,
        } satisfies CardInstance);
  if (zone === 'landReserve') {
    (state.players[perm.owner].landReserve ??= []).push(card);
  } else {
    state.players[perm.owner][zone].push(card);
  }
}
