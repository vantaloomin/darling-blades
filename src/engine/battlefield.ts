import type { GameEvent } from './events';
import { DARLING_TAX_STEP } from '../config/rules';
import type { CardDb, CardEntry, CardInstance, GameState, Permanent, PlayerId } from './types';
import { cardIdOf, def, isCardInstance, isType, variantKeyOf } from './types';

export type Emit = (e: GameEvent) => void;
export type GraveyardEntry = (card: CardEntry, owner: PlayerId) => void;

/**
 * Zone-change primitives, deliberately trigger-free: callers (resolve, sba,
 * the effect interpreter) fire arrives/dies triggers themselves so this module
 * sits at the bottom of the import graph.
 *
 * Darlings replace only battlefield exits. A matching physical Darling returns
 * to its public zone after a destroy or sever and gains one tax step; destroy
 * still reports `died`, so its dies triggers fire normally. Battlefield recall
 * also returns it to the zone but adds no tax and is not a death. Moves from
 * non-battlefield zones (countered spells, discard, mill, graveyard sever, and
 * reclaim) use their ordinary destination and never pull a matching card back.
 */

export function enterBattlefield(
  state: GameState,
  db: CardDb,
  card: CardEntry,
  controller: PlayerId,
  emit: Emit,
  opts: {
    asToken?: boolean;
    attachedTo?: number;
    tapped?: boolean;
    plusOneCounters?: number;
    variantKey?: string | null;
  } = {},
): Permanent {
  const cardId = cardIdOf(card);
  const d = def(db, card);
  const iid = state.nextIid++;
  const instanceId = isCardInstance(card)
    ? card.instanceId
    : state.nextInstanceId !== undefined
      ? state.nextInstanceId++
      : iid;
  const isToken = opts.asToken === true || d.token === true;
  const perm: Permanent = {
    iid,
    instanceId,
    cardId,
    variantKey: opts.variantKey === undefined ? variantKeyOf(card) : opts.variantKey,
    ...(isToken ? { isToken: true } : {}),
    owner: controller,
    controller,
    tapped: opts.tapped ?? d.entersTapped ?? false,
    enteredThisTurn: true,
    damage: 0,
    deathtouched: false,
    severBranded: false,
    attachments: [],
    attachedTo: opts.attachedTo,
    plusOneCounters: isType(d, 'creature') ? opts.plusOneCounters ?? 0 : 0,
    untilEotMods: [],
  };
  state.battlefield.push(perm);
  if (opts.attachedTo !== undefined) {
    const host = state.battlefield.find((p) => p.iid === opts.attachedTo);
    if (!host) throw new Error(`enterBattlefield: missing attachment host ${opts.attachedTo}`);
    host.attachments.push(perm.iid);
  }
  emit(
    isToken
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

/** Remove a permanent's attachment pointer while keeping it on the battlefield. */
export function unlinkPermanent(state: GameState, perm: Permanent): number | undefined {
  const previousHost = perm.attachedTo;
  if (previousHost === undefined) return undefined;
  detachFromHost(state, perm);
  delete perm.attachedTo;
  return previousHost;
}

/** Move a live attachment to a live host. Validation remains the caller's job. */
export function attachPermanent(state: GameState, perm: Permanent, host: Permanent): number | undefined {
  const previousHost = unlinkPermanent(state, perm);
  perm.attachedTo = host.iid;
  if (!host.attachments.includes(perm.iid)) host.attachments.push(perm.iid);
  return previousHost;
}

function basicReturnsToReserve(state: GameState, db: CardDb, perm: Permanent): boolean {
  const d = def(db, perm.cardId);
  return (
    state.players[perm.owner].landReserve !== undefined &&
    d.types.includes('land') &&
    (d.supertypes?.includes('basic') ?? false)
  );
}

function isDarlingPermanent(state: GameState, perm: Permanent): boolean {
  const owner = state.players[perm.owner];
  return owner.darlingZone !== undefined && owner.darlingInstanceId === perm.instanceId;
}

/** Runtime token identity, with a definition fallback for legacy hand-built snapshots. */
function isTokenPermanent(db: CardDb, perm: Permanent): boolean {
  return perm.isToken === true || (perm.isToken === undefined && def(db, perm.cardId).token === true);
}

function returnDarlingToZone(
  state: GameState,
  perm: Permanent,
  emit: Emit,
  reason: 'died' | 'severed' | 'recalled',
): void {
  pushMovedCard(state, perm, 'darlingZone');
  const owner = state.players[perm.owner];
  if (reason !== 'recalled') owner.darlingTax = (owner.darlingTax ?? 0) + DARLING_TAX_STEP;
  emit({ e: 'darlingReturned', player: perm.owner, cardId: perm.cardId, tax: owner.darlingTax ?? 0, reason });
}

/** Whether a destroy exit is a real death for triggers and accounting. */
export function firesDiesForDestroy(state: GameState, db: CardDb, perm: Permanent): boolean {
  return !perm.severBranded && !basicReturnsToReserve(state, db, perm);
}

/** Battlefield → owner's graveyard (tokens evaporate). Returns true if it died. */
export function destroyPermanent(
  state: GameState,
  db: CardDb,
  perm: Permanent,
  emit: Emit,
  onGraveyardEntry?: GraveyardEntry,
): boolean {
  const idx = state.battlefield.findIndex((p) => p.iid === perm.iid);
  if (idx < 0) return false;
  if (perm.severBranded) return severPermanent(state, db, perm, emit);
  state.battlefield.splice(idx, 1);
  detachFromHost(state, perm);
  const isToken = isTokenPermanent(db, perm);
  if (!isToken && isDarlingPermanent(state, perm)) returnDarlingToZone(state, perm, emit, 'died');
  else if (!isToken) {
    const zone = basicReturnsToReserve(state, db, perm) ? 'landReserve' : 'graveyard';
    const card = pushMovedCard(state, perm, zone);
    if (zone === 'graveyard') onGraveyardEntry?.(card, perm.owner);
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
  const isToken = isTokenPermanent(db, perm);
  if (!isToken && isDarlingPermanent(state, perm)) returnDarlingToZone(state, perm, emit, 'severed');
  else if (!isToken) pushMovedCard(state, perm, 'severed');
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
  const isToken = isTokenPermanent(db, perm);
  const basicToReserve = basicReturnsToReserve(state, db, perm);
  const darlingToZone = isDarlingPermanent(state, perm);
  if (!isToken && darlingToZone) {
    returnDarlingToZone(state, perm, emit, 'recalled');
    emit({ e: 'cardsBottomed', player: perm.owner, count: 0 }); // no dedicated event; UI resyncs
  } else if (!isToken) {
    const toReserve = state.players[perm.owner].landReserve !== undefined && d.types.includes('land');
    pushMovedCard(state, perm, toReserve ? 'landReserve' : 'hand');
    emit({ e: 'cardsBottomed', player: perm.owner, count: 0 }); // no dedicated event; UI resyncs
  }
  if (!basicToReserve && !darlingToZone) {
    emit({ e: 'died', iid: perm.iid, cardId: perm.cardId, owner: perm.owner });
  }
  return true;
}

/** Preserve legacy string fixtures while keeping every Game-created move physical. */
function pushMovedCard(
  state: GameState,
  perm: Permanent,
  zone: 'hand' | 'graveyard' | 'severed' | 'landReserve' | 'darlingZone',
): CardEntry {
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
  } else if (zone === 'darlingZone') {
    state.players[perm.owner].darlingZone = card;
  } else {
    state.players[perm.owner][zone].push(card);
  }
  return card;
}
