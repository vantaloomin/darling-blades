import { getEffectiveStats } from '../engine/statics';
import type { CardDb, Keyword, Permanent } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';

const KEYWORD_BONUS: Record<Keyword, number> = {
  flying: 1,
  deathtouch: 1,
  lifelink: 0.5,
  firstStrike: 0.5,
  doubleStrike: 1.5,
  trample: 0.5,
  vigilance: 0.25,
  haste: 0.25,
  reach: 0.25,
  hexproof: 0.5,
  defender: -0.5,
};

function keywordScore(keywords: Iterable<Keyword>): number {
  let s = 0;
  for (const k of keywords) s += KEYWORD_BONUS[k];
  return s;
}

function isLordOrLegendary(db: CardDb, cardId: string): boolean {
  const d = def(db, cardId);
  if (d.supertypes?.includes('legendary')) return true;
  return (d.abilities ?? []).some((ab) => ab.when === 'static' && ab.static?.scope === 'filter');
}

function hasTriggeredAbility(db: CardDb, cardId: string): boolean {
  return (def(db, cardId).abilities ?? []).some(
    (ab) => ab.when !== 'static' && ab.when !== 'spell',
  );
}

/** Shared card-value heuristic — printed stats (hand cards, hypotheticals). */
export function cardValue(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    v += ((d.power ?? 0) + (d.toughness ?? 0)) / 2;
    v += keywordScore(d.keywords ?? []);
  }
  if (isLordOrLegendary(db, cardId)) v += 1;
  if (hasTriggeredAbility(db, cardId)) v += 0.75;
  return v;
}

/** Value of a permanent on the battlefield — EFFECTIVE stats. */
export function permValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  iid: number,
): number {
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm) return 0;
  const d = def(db, perm.cardId);
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    const stats = getEffectiveStats(battlefield, db, iid);
    v += (stats.power + Math.max(0, stats.toughness - perm.damage)) / 2;
    v += keywordScore(stats.keywords);
  }
  if (isLordOrLegendary(db, perm.cardId)) v += 1;
  return v;
}
