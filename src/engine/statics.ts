import type { CardDb, Keyword, Permanent } from './types';
import { def, isType } from './types';

export interface EffectiveStats {
  power: number;
  toughness: number;
  keywords: ReadonlySet<Keyword>;
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

  let power = d.power ?? 0;
  let toughness = d.toughness ?? 0;
  const keywords = new Set<Keyword>(d.keywords ?? []);

  power += perm.plusOneCounters;
  toughness += perm.plusOneCounters;

  for (const mod of perm.untilEotMods) {
    power += mod.p;
    toughness += mod.t;
    for (const k of mod.keywords) keywords.add(k);
  }

  // Static layers from other permanents (auras on me, lords on the field).
  for (const src of battlefield) {
    const srcDef = def(db, src.cardId);
    for (const ab of srcDef.abilities ?? []) {
      if (ab.when !== 'static' || !ab.static) continue;
      const st = ab.static;

      let applies: boolean;
      if (st.scope === 'attached') {
        applies = src.attachedTo === iid;
      } else {
        // filter scope: source controller's creatures matching the filter
        applies =
          src.controller === perm.controller &&
          isType(d, 'creature') &&
          (!st.filter?.other || src.iid !== iid) &&
          (!st.filter?.subtype || d.subtypes.includes(st.filter.subtype));
      }

      if (applies) {
        power += st.p ?? 0;
        toughness += st.t ?? 0;
        for (const k of st.grantKeywords ?? []) keywords.add(k);
      }
    }
  }

  return { power, toughness, keywords };
}

export function hasKeyword(
  battlefield: readonly Permanent[],
  db: CardDb,
  iid: number,
  k: Keyword,
): boolean {
  return getEffectiveStats(battlefield, db, iid).keywords.has(k);
}

/** A creature is summoning-sick if it entered this turn and lacks haste (checked on read). */
export function isSummoningSick(
  battlefield: readonly Permanent[],
  db: CardDb,
  perm: Permanent,
): boolean {
  return perm.enteredThisTurn && !hasKeyword(battlefield, db, perm.iid, 'haste');
}
