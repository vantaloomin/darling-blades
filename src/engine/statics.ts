import type { AbilityDef, CardDb, Keyword, Permanent, PlayerId } from './types';
import { def, isType, opponentOf } from './types';

export interface EffectiveStats {
  attack: number;
  defense: number;
  keywords: ReadonlySet<Keyword>;
}

/**
 * Quest identity is data-driven by `CardDef.chapters` being present. The
 * `Quest` subtype is the authoring convention, but it is not what activates
 * `questActive`; this keeps the condition tied to executable chapter data.
 */
export function isQuestActive(
  battlefield: readonly Permanent[],
  db: CardDb,
  controller: PlayerId,
): boolean {
  return battlefield.some(
    (perm) => perm.controller === controller && def(db, perm.cardId).chapters !== undefined,
  );
}

function staticConditionSatisfied(
  battlefield: readonly Permanent[],
  db: CardDb,
  controller: PlayerId,
  condition: AbilityDef['condition'] | undefined,
): boolean {
  if (condition === undefined) return true;
  if (condition === 'questActive') return isQuestActive(battlefield, db, controller);
  if (condition === 'controlMarked') {
    return battlefield.some((perm) => perm.controller === controller && perm.plusOneCounters > 0);
  }
  return battlefield.filter(
    (perm) => perm.controller === controller &&
      perm.plusOneCounters > 0 &&
      (condition.subject === 'permanents' || isType(def(db, perm.cardId), 'creature')),
  ).length >= condition.n;
}

/**
 * Effective P/T and keywords are ALWAYS computed on read — base printed stats
 * + +1/+1 counters + until-EOT mods + static layers (auras attached to the
 * creature, and battlefield-wide lord filters). Nothing is ever cached, so
 * statics can never desync. Operates on the battlefield array (public
 * information), so AI code can call it on a redacted view too.
 */
export function getEffectiveStats(
  battlefield: readonly Permanent[],
  db: CardDb,
  iid: number,
): EffectiveStats {
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm) throw new Error(`getEffectiveStats: no permanent ${iid}`);
  const d = def(db, perm.cardId);
  const targetIsCreature = isType(d, 'creature');

  let attack = d.attack ?? 0;
  let defense = d.defense ?? 0;
  const keywords = new Set<Keyword>(d.keywords ?? []);

  attack += perm.plusOneCounters;
  defense += perm.plusOneCounters;

  if (perm.awakened && d.awakening) {
    attack += d.awakening.p ?? 0;
    defense += d.awakening.t ?? 0;
    for (const k of d.awakening.keywords ?? []) keywords.add(k);
  }

  for (const mod of perm.untilEotMods) {
    attack += mod.p;
    defense += mod.t;
    for (const k of mod.keywords) keywords.add(k);
  }

  // Static layers from other permanents (auras on me, lords on the field).
  for (const src of battlefield) {
    const srcDef = def(db, src.cardId);
    for (const ab of srcDef.abilities ?? []) {
      if (ab.when !== 'static' || !ab.static) continue;
      const st = ab.static;
      const condition = ab.condition ?? st.condition;
      if (condition !== undefined && !staticConditionSatisfied(battlefield, db, src.controller, condition)) continue;

      let applies: boolean;
      if (st.scope === 'self') {
        applies = src.iid === iid;
      } else if (st.scope === 'attached') {
        applies = src.attachedTo === iid;
      } else {
        // filter scope: source controller's creatures matching the filter
        const filter = st.filter;
        if (!filter?.marked && !filter?.who) {
          applies =
            src.controller === perm.controller &&
            targetIsCreature &&
            (!filter?.other || src.iid !== iid) &&
            (!filter?.subtype || d.subtypes.includes(filter.subtype));
        } else {
          const who = filter.who ?? 'yours';
          applies =
            (who === 'yours'
              ? src.controller === perm.controller
              : opponentOf(src.controller) === perm.controller) &&
            targetIsCreature &&
            (!filter.other || src.iid !== iid) &&
            (!filter.subtype || d.subtypes.includes(filter.subtype)) &&
            (!filter.marked || perm.plusOneCounters > 0);
        }
      }

      if (applies) {
        attack += st.p ?? 0;
        defense += st.t ?? 0;
        for (const k of st.grantKeywords ?? []) keywords.add(k);
      }
    }

    // Hauntlink's Linked rider is the same attached-static layer as an Aura,
    // but its authoring surface is explicit on CardDef and the source is
    // always a noncreature Artifact or Enchantment.
    if (srcDef.hauntlink && src.attachedTo === iid) {
      attack += srcDef.hauntlink.linked.p ?? 0;
      defense += srcDef.hauntlink.linked.t ?? 0;
      for (const k of srcDef.hauntlink.linked.grantKeywords ?? []) keywords.add(k);
    }
  }

  return { attack, defense, keywords };
}

export function hasKeyword(
  battlefield: readonly Permanent[],
  db: CardDb,
  iid: number,
  k: Keyword,
): boolean {
  return getEffectiveStats(battlefield, db, iid).keywords.has(k);
}

/** A creature is summoning-sick if it entered this turn and lacks Warcry (checked on read). */
export function isSummoningSick(
  battlefield: readonly Permanent[],
  db: CardDb,
  perm: Permanent,
): boolean {
  return perm.enteredThisTurn && !hasKeyword(battlefield, db, perm.iid, 'warcry');
}
