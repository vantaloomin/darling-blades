import type { Action } from '../engine/actions';
import { cardHasProvoked } from '../engine/creatureDamage';
import { arrivalHuntIndex } from '../engine/effects/EffectInterpreter';
import type { CardDb, CardDef, EffectOp, Permanent, TargetRef } from '../engine/types';
import { activatedAbilitiesOf, def, flatOps, isType } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { targetChoiceValue, vocabularyCastTargetValue } from './targeting';
import { activateActionValue, arrivalHuntCastValue, boundCastEffects, castSpellOps, spellTargetsValue } from './value';

/**
 * Medium and Easy's own Hunt and Provoked policy (plan-first-dawn-engine.md,
 * Part 4, A2; A2.b). The shared value layer (A1.2) prices a Hunt on your own
 * creature and damage aimed at your own Provoked creature, and would take
 * either whenever it pays. Hard plays that read as is. Medium takes such a
 * choice only when it beats the plain one by `SELF_PROVOKE_MARGIN`; Easy never
 * takes one it could avoid (B5: Easy never hunts its own creature by choice,
 * and it skips friendly Provoked sources).
 */

/**
 * How much more a friendly choice must be worth than the plain one before
 * Medium takes it: one card, at the value layer's rate for drawing a card
 * (`opImpactValue`'s draw, 1.25). A self-Hunt or a friendly source spends a
 * card, a Duty or a turn's tempo on your own creature, so Medium does it only
 * when it nets at least a card over the plain play (or over not acting, when
 * not acting is an option). Untuned: no lab arm measures Medium.
 */
export const SELF_PROVOKE_MARGIN = 1.25;

/**
 * What a Hunt Medium spends from hand (a Hunt spell, or an Empower Hunt's
 * extra mana) must be worth on the public board at its pair: the same one
 * card. The exchange already charges the hunter it loses, so a kill the
 * hunter survives clears it, a trade clears it only when the prey is worth a
 * card more than the hunter, and a Hunt that kills nothing is held unless the
 * Provoked it sets off nets the card (wave 4, M3). Untuned, like the margin
 * above.
 */
export const HUNT_SPEND_MARGIN = SELF_PROVOKE_MARGIN;

/** Easy's margin: a friendly choice is never taken while a plain one exists. */
export const NEVER_BY_CHOICE = Infinity;

type CastSpell = Extract<Action, { type: 'castSpell' }>;
type CastDarling = Extract<Action, { type: 'castDarling' }>;

const HUNT_OR_PROVOKED = new WeakMap<CardDb, boolean>();

/** Does any card in `db` print a Hunt or a Provoked ability? Without one no
 * choice can be friendly, so the policy is inert (today's pool, 2026-09-29). */
function databaseHasHuntOrProvoked(db: CardDb): boolean {
  const cached = HUNT_OR_PROVOKED.get(db);
  if (cached !== undefined) return cached;
  const hunts = (ops: readonly EffectOp[] | undefined): boolean => flatOps(ops ?? []).some((op) => op.op === 'hunt');
  const found = Object.values(db).some((card) => cardHasProvoked(card) ||
    (card.abilities ?? []).some((ability) => hunts(ability.ops)) ||
    activatedAbilitiesOf(card).some((duty) => hunts(duty.ops)) ||
    hunts(card.empower?.ops) || hunts(card.retell?.ops) || (card.chapters ?? []).some((chapter) => hunts(chapter)));
  HUNT_OR_PROVOKED.set(db, found);
  return found;
}

/**
 * Is this cast's one target the prey of the card's arrival Hunt (A1.1b)? The
 * override casts (a Retell body, a Hauntlink host, Empower's own targets)
 * bring other targets. Mirrors `vocabularyCastTargetValue`.
 */
export function castNamesArrivalPrey(card: CardDef, cast: CastSpell | CastDarling): boolean {
  if (arrivalHuntIndex(card) < 0) return false;
  if (cast.type === 'castDarling') return true;
  return !(cast.retell && card.retell?.ops) && cast.hauntlinked !== true && !(cast.empowered && card.empower?.targets);
}

function castCardId(view: PlayerView, cast: CastSpell | CastDarling): string {
  if (cast.type === 'castDarling') return view.you.darlingZone ?? '';
  return (cast.retell || cast.whispers) && cast.graveIndex !== undefined
    ? view.you.graveyard[cast.graveIndex] : view.you.hand[cast.handIndex];
}

/**
 * Does this choice land a Hunt or damage on a creature its chooser controls,
 * where that is the point of the choice? Two shapes:
 *   - a self-Hunt: the prey is your own creature (an `any` or `yours` card);
 *   - a friendly Provoked source: damage aimed at your own creature that has a
 *     Provoked ability, or "damage each creature you control" with one there.
 * A Hunt spell's hunter is always yours and is not a friendly choice; nor is a
 * sweep of every creature (removal, not a source).
 */
export function isFriendlyHuntOrSource(view: PlayerView, db: CardDb, action: Action): boolean {
  const mine = (ref: TargetRef | undefined): Permanent | undefined => ref?.kind === 'permanent'
    ? view.battlefield.find((perm) => perm.iid === ref.iid && perm.controller === view.myId &&
      isType(def(db, perm.cardId), 'creature'))
    : undefined;
  const provokable = (perm: Permanent | undefined): boolean => perm !== undefined && cardHasProvoked(def(db, perm.cardId));
  const lands = (op: EffectOp, refs: readonly (TargetRef | undefined)[], sourceIid?: number): boolean => {
    if (op.op === 'hunt') return op.hunter === 'self' && mine(refs[0]) !== undefined;
    if (op.op !== 'damage' || op.n === 0) return false;
    if (op.to === 'target') return refs.some((ref) => provokable(mine(ref)));
    if (op.to === 'eachYourCreature') {
      return view.battlefield.some((perm) => perm.controller === view.myId && !(op.other && perm.iid === sourceIid) &&
        isType(def(db, perm.cardId), 'creature') && cardHasProvoked(def(db, perm.cardId)));
    }
    return false;
  };

  switch (action.type) {
    case 'castSpell':
    case 'castDarling': {
      const cardId = castCardId(view, action);
      if (!cardId) return false;
      const card = def(db, cardId);
      const targets = action.targets ?? [];
      if (castNamesArrivalPrey(card, action) &&
        flatOps(card.abilities![arrivalHuntIndex(card)].ops ?? []).some((op) => lands(op, targets.slice(0, 1)))) return true;
      if (action.type === 'castDarling') return false;
      return boundCastEffects(view, db, cardId, action).some(({ op, targets: refs }) =>
        op.op === 'hunt' && op.hunter === 'target' ? mine(targets[1]) !== undefined : lands(op, refs));
    }
    case 'activate': {
      const source = view.battlefield.find((perm) => perm.iid === action.iid);
      const duty = source && activatedAbilitiesOf(def(db, source.cardId))[action.abilityIndex ?? 0];
      if (!source || !duty) return false;
      const targets = action.targets ?? [];
      const batch = duty.targets?.length === 1 && (duty.targets[0].upTo !== undefined || duty.targets[0].exactly !== undefined);
      return flatOps(duty.ops).some((op) => lands(op,
        'targetIndex' in op && op.targetIndex !== undefined ? [targets[op.targetIndex]] : batch ? targets : targets.slice(0, 1),
        source.iid));
    }
    case 'chooseTarget': {
      const awaiting = view.awaiting;
      if (awaiting.kind !== 'chooseTarget' || awaiting.decision !== undefined) return false;
      const pending = view.pendingDecisions?.find((decision) => decision.kind === 'chooseTarget' &&
        decision.sourceIid === awaiting.sourceIid && decision.abilityIndex === awaiting.abilityIndex);
      const source = view.battlefield.find((perm) => perm.iid === awaiting.sourceIid);
      const ops = pending?.kind === 'chooseTarget' ? pending.ops
        : source ? def(db, source.cardId).abilities?.[awaiting.abilityIndex]?.ops : undefined;
      return flatOps(ops ?? []).some((op) => lands(op, [action.target], awaiting.sourceIid));
    }
    default:
      return false;
  }
}

/** The shared value of one option, as the target policies read it. */
export function huntOptionValue(view: PlayerView, db: CardDb, action: Action): number {
  switch (action.type) {
    case 'castSpell': {
      const cardId = castCardId(view, action);
      // The ops that name no target (Ember-Flick's Foresee) are left out:
      // every target of the cast gets them, so they cancel against a plain
      // target, and against not acting the Provoked alone must net the card
      // (A2.b; 1.9.1 review).
      return vocabularyCastTargetValue(view, db, action) ?? spellTargetsValue(view, db,
        castSpellOps(db, cardId, action, view), action.targets ?? [], false, action.x ?? 0, cardId);
    }
    case 'castDarling':
      return arrivalHuntCastValue(view, db, castCardId(view, action), action.targets ?? []);
    case 'activate':
      return activateActionValue(view, db, action);
    case 'chooseTarget':
      return targetChoiceValue(view, db, action.target);
    default:
      return 0;
  }
}

/**
 * How far an option's decision can be declined:
 *   - `mandatory`: a pending target choice (the engine needs one);
 *   - `body`: a creature's own cast or a Darling call, where only the arrival
 *     prey is chosen. Medium treats it as forced (the body is the point of
 *     the cast); Easy can hold the card, so for Easy it is declinable (B5:
 *     casting a creature whose only prey is its own is a choice);
 *   - `optional`: a Duty, a spell, or an empowered mode with its own targets.
 */
type Declinable = 'mandatory' | 'body' | 'optional';

function decisionOf(view: PlayerView, db: CardDb, action: Action): { key: string; declinable: Declinable } | undefined {
  const strip = (a: Action): string => JSON.stringify({ ...a, targets: undefined, manaPlan: undefined });
  switch (action.type) {
    case 'chooseTarget':
      return { key: 'target', declinable: 'mandatory' };
    case 'castDarling':
      return { key: strip(action), declinable: 'body' };
    case 'castSpell': {
      const card = def(db, castCardId(view, action));
      return { key: strip(action),
        declinable: isType(card, 'creature') && !(action.empowered && card.empower?.targets) ? 'body' : 'optional' };
    }
    case 'activate':
      return { key: strip(action), declinable: 'optional' };
    default:
      return undefined;
  }
}

/**
 * Drop the friendly choices (`isFriendlyHuntOrSource`) that do not clear
 * `margin` over the plain alternative: the best plain option of the same
 * decision, or 0 (not acting) when the decision can be declined. A forced
 * decision with no plain option keeps every option: a mandatory target always,
 * and a creature's own cast for Medium. `NEVER_BY_CHOICE` drops every
 * avoidable friendly choice (Easy), a creature cast whose every prey is its
 * own included, so Easy holds that card. Returns
 * `legal` itself when nothing is dropped, and always on a pool with no Hunt
 * and no Provoked card.
 */
export function applyHuntPolicy(view: PlayerView, db: CardDb, legal: Action[], margin: number): Action[] {
  if (!databaseHasHuntOrProvoked(db)) return legal;
  const never = margin === NEVER_BY_CHOICE;
  const decisions = new Map<string, { forced: boolean; friendly: Action[]; plain: Action[] }>();
  for (const action of legal) {
    const decision = decisionOf(view, db, action);
    if (!decision) continue;
    const forced = decision.declinable === 'mandatory' || decision.declinable === 'body' && !never;
    const entry = decisions.get(decision.key) ?? { forced, friendly: [], plain: [] };
    (isFriendlyHuntOrSource(view, db, action) ? entry.friendly : entry.plain).push(action);
    decisions.set(decision.key, entry);
  }
  const dropped = new Set<Action>();
  for (const { forced, friendly, plain } of decisions.values()) {
    if (friendly.length === 0 || forced && plain.length === 0) continue;
    if (never) {
      for (const action of friendly) dropped.add(action);
      continue;
    }
    const baseline = Math.max(forced ? -Infinity : 0, ...plain.map((action) => huntOptionValue(view, db, action)));
    for (const action of friendly) if (!(huntOptionValue(view, db, action) >= baseline + margin)) dropped.add(action);
  }
  return dropped.size === 0 ? legal : legal.filter((action) => !dropped.has(action));
}

/**
 * A Darling with an arrival Hunt is cast at its best prey. The shared
 * cast-target policy keys on `castSpell` only, so without this Medium and Easy
 * took the first prey in battlefield order (the A1.2 hand-off). Ties keep the
 * earlier option.
 */
export function applyDarlingPreyPolicy(view: PlayerView, db: CardDb, legal: Action[]): Action[] {
  const darlingId = view.you.darlingZone;
  if (!darlingId || arrivalHuntIndex(def(db, darlingId)) < 0) return legal;
  const best = new Map<string, { action: CastDarling; value: number }>();
  const keyOf = (action: CastDarling): string => JSON.stringify({ ...action, targets: undefined, manaPlan: undefined });
  for (const action of legal) {
    if (action.type !== 'castDarling' || (action.targets?.length ?? 0) === 0) continue;
    const value = arrivalHuntCastValue(view, db, darlingId, action.targets!);
    const previous = best.get(keyOf(action));
    if (!previous || value > previous.value) best.set(keyOf(action), { action, value });
  }
  if (best.size === 0) return legal;
  return legal.filter((action) => action.type !== 'castDarling' || (action.targets?.length ?? 0) === 0 ||
    best.get(keyOf(action))?.action === action);
}
