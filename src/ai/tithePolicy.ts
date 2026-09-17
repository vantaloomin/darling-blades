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
// MEASURED 2026-09-16: frozen lists, avatar 200 seeds/cell (1,000 each),
// Lanterns reserve row 150 seeds/cell (2,700 games; see starterDecks.ts).
// Marsh-Mother / Deacon / Lanterns averages, percent:
// V0 (0.2, floor + unlock, KEPT): 74.8 / 35.9 / 14.60.
// V1 (0.5 plain sales, REJECTED): 75.4 / 36.0 / 14.60.
// V2 (0.2, unlock only, REJECTED): 75.4 / 36.0 / 14.60.
// V3 (1.0 plain sales, REJECTED): 75.4 / 36.0 / 14.60.
// V1/V3 retained the original 0.2 tempo-unlock price; only affordable
// plain sales used the trial rate. The unchanged Kelp Shade case passed
// under every trial. V1/V2/V3 gained only 0.6pp on Marsh-Mother, inside
// the 3pp band: retain V0, the smallest change. Tempo unlock stays intact.
const FODDER_VALUE_RATE = 0.2;

/**
 * A Tithe cast is normally a hand cast, but a card carrying both Whispers and
 * Tithe pays its fodder from the graveyard, where handIndex only mirrors
 * graveIndex. Every Tithe reader resolves its card through here.
 */
function titheCastCardId(view: PlayerView, action: SpellCast): string | undefined {
  return action.whispers && action.graveIndex !== undefined
    ? view.you.graveyard[action.graveIndex]
    : view.you.hand[action.handIndex];
}

/** The cost the fodder pays down: the Whispers cost on a whispered cast. */
function titheBaseCost(db: CardDb, cardId: string, cast: SpellCast): ReturnType<typeof castCost> {
  return castCost(def(db, cardId), cast.empowered === true, false, false, { whispers: cast.whispers });
}

export function isTitheCast(view: PlayerView, db: CardDb, action: Action): action is SpellCast {
  if (action.type !== 'castSpell' || action.tithe !== true) return false;
  const cardId = titheCastCardId(view, action);
  return cardId !== undefined && db[cardId]?.tithe !== undefined;
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
  const cardId = titheCastCardId(view, cast);
  if (cardId === undefined) return 0;
  const generic = titheBaseCost(db, cardId, cast)?.generic ?? 0;
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
  const cardId = titheCastCardId(view, cast);
  if (cardId === undefined) return [];
  const d = def(db, cardId);
  if (!d.tithe) return [];
  const fullCost = titheBaseCost(db, cardId, cast);
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
      // A whispered Tithe cast falls back to the plain Whispers cast, never a hand cast.
      !!other.whispers === !!candidate.whispers && other.graveIndex === candidate.graveIndex &&
      JSON.stringify(other.targets ?? []) === JSON.stringify(candidate.targets ?? []));
    if (!alreadyOffered) prepared.push(candidate);
  }
  return prepared;
}
