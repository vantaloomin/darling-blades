import { castCost, validateAction, type Action } from '../engine/actions';
import { canPay } from '../engine/mana';
import { getEffectiveStats, isSummoningSick } from '../engine/statics';
import { def, isType, opponentOf, type CardDb } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { chooseAttackers } from './combatPlans';
import { determinize } from './determinize';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { permValue } from './value';

type SpellCast = Extract<Action, { type: 'castSpell' }>;

// D5: only fodder-class bodies may trade long-term board value for this turn's
// mana. One fifth lets two ordinary one-mana 1/1s buy one mana of real tempo.
const FODDER_VALUE_RATE = 0.2;

export function isTitheCast(view: PlayerView, db: CardDb, action: Action): action is SpellCast {
  return action.type === 'castSpell' && action.tithe === true &&
    db[view.you.hand[action.handIndex]]?.tithe !== undefined;
}

/** Use the combat planner's public Morning plan; Afternoon has already attacked. */
function plannedAttackers(view: PlayerView, db: CardDb, pers: Personality): number[] {
  if (view.activePlayer !== view.myId || view.step !== 'main1') return [];
  const open = view.battlefield.filter((perm) => perm.controller === opponentOf(view.myId) &&
    !perm.tapped && (db[perm.cardId]?.manaAbility?.length ?? 0) > 0).length;
  const trick = open >= 2 && view.opp.handCount > 0 &&
    view.opp.graveyard.some((id) => isType(def(db, id), 'charm')) ? 2 * pers.trickRespect : 0;
  return chooseAttackers(view.battlefield, db, view.myId, view.opp.life, trick, view.you.life, pers);
}

/** Generic mana saved, including Empower, at the public effective Defense. */
export function titheManaSaved(view: PlayerView, db: CardDb, cast: SpellCast): number {
  if (!cast.tithe) return 0;
  const generic = castCost(def(db, view.you.hand[cast.handIndex]), cast.empowered === true)?.generic ?? 0;
  const defense = (cast.sacrifices ?? []).reduce((sum, iid) =>
    sum + getEffectiveStats(view.battlefield, db, iid).defense, 0);
  return Math.min(generic, Math.floor(defense / 2));
}

/**
 * Protect the best body at its full board value, the planned attack and every
 * chosen target. Price eligible fodder at its tempo rate; other bodies retain
 * their full value. Pair odd Defense before wasting its otherwise saved point.
 */
export function chooseTitheSacrifices(
  view: PlayerView,
  db: CardDb,
  cast: SpellCast,
  attackers: readonly number[] = plannedAttackers(view, db, DEFAULT_PERSONALITY),
): number[] {
  const d = def(db, view.you.hand[cast.handIndex]);
  if (!d.tithe) return [];
  const fullCost = castCost(d, cast.empowered === true);
  const generic = fullCost?.generic ?? 0;
  if (!fullCost || generic <= 0) return [];
  const bodies = view.battlefield.flatMap((perm, index) => {
    if (perm.controller !== view.myId) return [];
    const bodyDef = def(db, perm.cardId);
    if (!isType(bodyDef, 'creature')) return [];
    const value = permValue(view.battlefield, db, perm.iid);
    const defense = getEffectiveStats(view.battlefield, db, perm.iid).defense;
    const token = perm.isToken === true || (perm.isToken === undefined && bodyDef.token === true);
    const fodderClass = token || defense <= 2 || isSummoningSick(view.battlefield, db, perm);
    return [{ iid: perm.iid, index, value, defense,
      saleValue: value * (fodderClass ? FODDER_VALUE_RATE : 1) }];
  });
  if (bodies.length < 2) return [];
  const best = bodies.reduce((a, b) => b.value > a.value ? b : a);
  let fodder = bodies.filter((body) => body.iid !== best.iid && body.defense > 0 &&
    !attackers.includes(body.iid) &&
    !cast.targets?.some((target) => target.kind === 'permanent' && target.iid === body.iid))
    .sort((a, b) => a.saleValue / a.defense - b.saleValue / b.defense || a.index - b.index);
  const chosen: number[] = [];
  let defense = 0;
  while (Math.floor(defense / 2) < generic) {
    const saved = Math.floor(defense / 2);
    let pick: typeof fodder | undefined;
    for (const body of fodder) {
      const bundles = [[body]];
      if ((defense + body.defense) % 2 !== 0) {
        for (const partner of fodder) {
          if (partner.iid !== body.iid && partner.defense % 2 !== 0) bundles.push([body, partner]);
        }
      }
      const profitable = bundles.map((bundle) => {
        const added = bundle.reduce((sum, entry) => sum + entry.defense, 0);
        const value = bundle.reduce((sum, entry) => sum + entry.saleValue, 0);
        const saving = Math.min(generic, Math.floor((defense + added) / 2)) - saved;
        return { bundle, value, saving, waste: defense + added - (saved + saving) * 2 };
      }).filter((bundle) => bundle.saving > 0 && bundle.saving > bundle.value)
        .sort((a, b) => a.value / a.saving - b.value / b.saving ||
          a.waste - b.waste || a.bundle.length - b.bundle.length);
      if (profitable.length > 0) { pick = profitable[0].bundle; break; }
    }
    if (!pick) break;
    for (const body of pick) { chosen.push(body.iid); defense += body.defense; }
    fodder = fodder.filter((body) => !chosen.includes(body.iid));
  }
  const saved = Math.min(generic, Math.floor(defense / 2));
  // The floor applies to the whole sale, not each increment while pairing.
  // Payment precedes sacrifice, so a sold mana creature can still fund this
  // cast. Both checks intentionally use the same pre-payment public board.
  if (saved < 2 && (canPay(view, db, view.myId, fullCost) ||
    !canPay(view, db, view.myId, { ...fullCost, generic: generic - saved }))) return [];
  return chosen;
}

/** Rewrite canonical subsets, or use the full-price cast if it remains legal. */
export function applyTithePolicy(
  view: PlayerView,
  db: CardDb,
  legal: Action[],
  pers: Personality = DEFAULT_PERSONALITY,
  attackPlan?: () => readonly number[],
): Action[] {
  if (!legal.some((action) => isTitheCast(view, db, action))) return legal;
  const attackers = attackPlan?.() ?? plannedAttackers(view, db, pers);
  const world = determinize(view, db);
  const prepared: Action[] = [];
  for (const action of legal) {
    if (!isTitheCast(view, db, action)) { prepared.push(action); continue; }
    const sacrifices = chooseTitheSacrifices(view, db, action, attackers);
    const candidate: SpellCast = { ...action, sacrifices };
    delete candidate.manaPlan; // The new cost must be solved again.
    if (sacrifices.length > 0 && validateAction(world.instanceState, db, view.myId, candidate) === null) {
      prepared.push(candidate);
      continue;
    }
    delete candidate.tithe;
    delete candidate.sacrifices;
    if (validateAction(world.instanceState, db, view.myId, candidate) !== null) continue;
    const alreadyOffered = legal.some((other) => other.type === 'castSpell' && !other.tithe &&
      other.handIndex === candidate.handIndex && other.empowered === candidate.empowered &&
      JSON.stringify(other.targets ?? []) === JSON.stringify(candidate.targets ?? []));
    if (!alreadyOffered) prepared.push(candidate);
  }
  return prepared;
}
