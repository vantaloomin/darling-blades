import { getEffectiveStats } from '../engine/statics';
import type { CardDb, EffectOp, Keyword, Permanent, PlayerId } from '../engine/types';
import { def, isType, manaValue, opponentOf } from '../engine/types';

const KEYWORD_BONUS: Record<Keyword, number> = {
  skyborne: 1,
  deathblade: 1,
  bloodoath: 0.5,
  firstBlade: 0.5,
  twinBlades: 1.5,
  overrun: 0.5,
  sentinel: 0.25,
  warcry: 0.25,
  wardingGaze: 0.25,
  untouchable: 0.5,
  bulwark: -0.5,
  dreaded: 1,
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

function awakeningValue(d: ReturnType<typeof def>): number {
  return (
    ((d.awakening?.p ?? 0) + (d.awakening?.t ?? 0)) / 2 +
    keywordScore(d.awakening?.keywords ?? [])
  );
}

function opImpactValue(op: EffectOp): number {
  switch (op.op) {
    case 'gainLife':
      return op.n * 0.35;
    case 'loseLife':
      return op.n * 1.1;
    case 'damage':
      return op.to === 'opponent' ? (op.n === 'X' ? 0 : op.n * 0.9) : 0;
    case 'draw':
      return op.n * 1.25;
    case 'discardRandom':
      return op.n * 1;
    case 'createToken':
      return op.count * 1.5;
    case 'addCounters':
      return op.to === 'self' ? op.n * 1.5 : 0;
    case 'boost':
      return op.scope === 'allYours'
        ? Math.max(0, op.p + op.t) / 2 + (op.keywords?.length ?? 0) * 0.5
        : 0;
    case 'severGrave':
      return op.who === 'opponent' ? op.n * 0.6 : 0;
    case 'foresee':
      return op.n * 0.5;
    case 'awaken':
      return op.scope === 'allYours' ? 1.5 : 0;
    case 'massDestroy':
      return op.filter === 'allEnchantments' ? 2.5 : 2;
    case 'destroyNewestOpponentArtifactOrEnchantment':
      return 3;
    default:
      return 0;
  }
}

/** Extra battlefield value for non-creature static and recurring engines. */
function nonCreatureAbilityImpact(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  if (isType(d, 'creature')) return 0;
  let value = 0;
  for (const ab of d.abilities ?? []) {
    if (ab.when === 'static' && ab.static) {
      const st = ab.static;
      const stats = (Math.abs(st.p ?? 0) + Math.abs(st.t ?? 0)) / 2;
      const keywords = (st.grantKeywords?.length ?? 0) * 0.5;
      const base = st.scope === 'filter' ? 1.5 : st.scope === 'attached' ? 0.75 : 1;
      value += base + stats * 0.7 + keywords;
      continue;
    }
    if (ab.when === 'dawn') {
      value += 0.75 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op), 0);
    } else if (ab.when !== 'spell') {
      value += 0.35 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op) * 0.5, 0);
    }
  }
  if (d.chapters) value += d.chapters.length * 0.5;
  return value;
}

function removalTargetValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  perm: Permanent,
): number {
  const d = def(db, perm.cardId);
  const impact = isType(d, 'artifact') || isType(d, 'enchantment')
    ? nonCreatureAbilityImpact(db, perm.cardId)
    : 0;
  return permValue(battlefield, db, perm.iid) + impact;
}

export type RemovalKind =
  | 'destroy'
  | 'sever'
  | 'recall'
  | 'branch'
  | 'massDestroy'
  | 'destroyNewest'
  | 'damage';

function spellOps(db: CardDb, cardId: string): EffectOp[] {
  return (def(db, cardId).abilities ?? [])
    .filter((ab) => ab.when === 'spell')
    .flatMap((ab) => ab.ops ?? []);
}

/** Classify only cast-time spell bodies. Arrival/dawn removal riders stay ETB value. */
export function removalKind(db: CardDb, cardId: string): RemovalKind | null {
  for (const ab of def(db, cardId).abilities ?? []) {
    if (ab.when !== 'spell') continue;
    const nonCreatureTarget = ab.targets?.some(
      (target) =>
        target.what === 'artifact' ||
        target.what === 'enchantment' ||
        target.what === 'artifactOrEnchantment',
    );
    for (const op of ab.ops ?? []) {
      if (op.op === 'destroy') return 'destroy';
      if (op.op === 'sever' && nonCreatureTarget) return 'sever';
      if (op.op === 'recall' && nonCreatureTarget) return 'recall';
      if (op.op === 'destroyArtifactOrSeverEnchantment') return 'branch';
      if (op.op === 'massDestroy' && op.filter === 'allEnchantments') return 'massDestroy';
      if (op.op === 'destroyNewestOpponentArtifactOrEnchantment') return 'destroyNewest';
      if (op.op === 'damage' && op.to === 'target') return 'damage';
    }
  }
  return null;
}

/** Public-board-only impact of a removal cast. Zero means the cast currently whiffs. */
export function removalValueForCast(
  battlefield: readonly Permanent[],
  db: CardDb,
  caster: PlayerId,
  cardId: string,
  target?: Permanent,
): number {
  const opponent = opponentOf(caster);
  let value = 0;
  for (const op of spellOps(db, cardId)) {
    if (
      (op.op === 'destroy' ||
        op.op === 'sever' ||
        op.op === 'recall' ||
        op.op === 'destroyArtifactOrSeverEnchantment') &&
      target?.controller === opponent
    ) {
      value += removalTargetValue(battlefield, db, target);
    } else if (op.op === 'massDestroy') {
      const doomed = battlefield.filter((perm) => {
        if (perm.controller !== opponent) return false;
        const d = def(db, perm.cardId);
        if (op.filter === 'allEnchantments') return isType(d, 'enchantment');
        if (!isType(d, 'creature')) return false;
        return op.filter === 'allCreatures' || getEffectiveStats(battlefield, db, perm.iid).keywords.has('skyborne');
      });
      value += doomed.reduce((sum, perm) => sum + removalTargetValue(battlefield, db, perm), 0);
    } else if (op.op === 'destroyNewestOpponentArtifactOrEnchantment') {
      for (let i = battlefield.length - 1; i >= 0; i--) {
        const perm = battlefield[i];
        const d = def(db, perm.cardId);
        if (
          perm.controller === opponent &&
          (isType(d, 'artifact') || isType(d, 'enchantment'))
        ) {
          value += removalTargetValue(battlefield, db, perm);
          break;
        }
      }
    }
  }
  return value;
}

/** Shared card-value heuristic — printed stats (hand cards, hypotheticals). */
export function cardValue(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    v += ((d.attack ?? 0) + (d.defense ?? 0)) / 2;
    v += keywordScore(d.keywords ?? []);
  }
  if (isLordOrLegendary(db, cardId)) v += 1;
  if (hasTriggeredAbility(db, cardId)) v += 0.75;
  if (d.chapters) v += d.chapters.length * 0.75;
  if (isType(d, 'creature') && d.awakening) v += 0.5 + awakeningValue(d);
  return v;
}

/** Cheap deterministic estimate used when an AI chooses whether to pay Empower. */
export function empowerValue(db: CardDb, cardId: string): number {
  const ops = def(db, cardId).empower?.ops ?? [];
  const opValue = (op: EffectOp): number => {
    switch (op.op) {
      case 'damage':
        return op.n === 'X' ? 0 : op.n * (op.to === 'controller' ? -0.6 : 0.9);
      case 'loseLife':
        return op.n * 0.9;
      case 'gainLife':
        return op.n * 0.25;
      case 'draw':
        return op.n * 1.2;
      case 'addCounters':
        return op.n * 1.5;
      case 'createToken':
        return op.count * 2;
      case 'raise':
        return op.to === 'target' ? 0 : 3;
      case 'foresee':
        return op.n * 0.6;
      case 'boost':
        return (op.p + op.t) / 2 + (op.keywords?.length ?? 0) * 0.5;
      default:
        return 0;
    }
  };
  return ops.reduce((sum, op) => sum + opValue(op), 0);
}

/**
 * NET life lost per turn to `who`'s own dawn triggers: self-damage (e.g.
 * tk-other's "At the start of your turn, this deals 1 damage to you") minus
 * dawn lifegain (gk/cf attendants), floored at 0. This is a forced clock the
 * 1-turn lookahead cannot see: evaluate() prices it convexly against
 * remaining life, and chooseAttackers uses it to force desperation attacks
 * (playtest report 2026-07-12: Hard sat behind a full player bench and bled
 * out to its own trigger). Only 'dawn' triggers count — 'attacks'
 * self-damage is an optional cost the AI controls.
 */
export function dawnSelfBleed(
  battlefield: readonly Permanent[],
  db: CardDb,
  who: PlayerId,
): number {
  let n = 0;
  for (const perm of battlefield) {
    if (perm.controller !== who) continue;
    for (const ab of def(db, perm.cardId).abilities ?? []) {
      if (ab.when !== 'dawn') continue;
      for (const op of ab.ops ?? []) {
        if (op.op === 'damage' && op.to === 'controller' && op.n !== 'X') n += op.n;
        else if (op.op === 'gainLife') n -= op.n;
      }
    }
  }
  return Math.max(0, n);
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
    v += (stats.attack + Math.max(0, stats.defense - perm.damage)) / 2;
    v += keywordScore(stats.keywords);
  }
  if (isLordOrLegendary(db, perm.cardId)) v += 1;
  if (d.chapters) {
    const completed = perm.chapter ?? 0;
    v += Math.max(0, d.chapters.length - completed) * 0.75;
  }
  if (isType(d, 'creature') && d.awakening && !perm.awakened) {
    v += 0.5 + awakeningValue(d);
  }
  return v;
}
