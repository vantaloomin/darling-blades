import { manaValue, type CardDef, type EffectOp } from '../../src/engine/types';
import type { CurveBand, DeckRole, PersonaTemplate, SpellRole } from './templates';

export interface PersonaDeckState {
  cards: readonly string[];
  roleCounts: Readonly<Record<DeckRole, number>>;
  curveCounts: Readonly<Record<CurveBand, number>>;
  selectedColors: readonly string[];
}

export interface CardScore {
  total: number;
  rate: number;
  roleFit: number;
  synergy: number;
  curveFit: number;
  roles: readonly SpellRole[];
}

const RARITY_MULTIPLIER = { c: 1, r: 1.03, sr: 1.06, ssr: 1.09, ur: 1.12 } as const;

const OP_VALUE: Readonly<Record<EffectOp['op'], number>> = {
  damage: 1.4,
  gainLife: 0.55,
  loseLife: 1.2,
  draw: 1.35,
  discardRandom: 1.05,
  destroy: 2.1,
  sever: 2.25,
  severGrave: 0.45,
  severTop: 0.4,
  recall: 1.15,
  destroyArtifactOrSeverEnchantment: 1.55,
  cancel: 1.8,
  boost: 0.9,
  addCounters: 0.8,
  tap: 0.7,
  fetchLand: 0.7,
  createToken: 1.15,
  destroyNewestOpponentArtifactOrEnchantment: 1.15,
  massDestroy: 3,
  preventCombat: 1,
  reclaim: 1.15,
  grind: 0.5,
  foresee: 0.7,
  awaken: 1.2,
  raise: 2.2,
};

const KEYWORD_VALUE = {
  skyborne: 0.55,
  wardingGaze: 0.35,
  firstBlade: 0.45,
  twinBlades: 0.8,
  warcry: 0.55,
  overrun: 0.6,
  sentinel: 0.4,
  bulwark: 0.45,
  deathblade: 0.65,
  bloodoath: 0.5,
  untouchable: 0.85,
  dreaded: 0.55,
} as const;

export function cardEffectOps(card: CardDef): EffectOp[] {
  const ops: EffectOp[] = [];
  for (const ability of card.abilities ?? []) ops.push(...(ability.ops ?? []));
  for (const chapter of card.chapters ?? []) ops.push(...chapter);
  ops.push(...(card.empower?.ops ?? []));
  return ops;
}

/**
 * Transparent catalog-only rate formula.
 *
 * Creatures start with (1.1 * power + 0.9 * toughness) / mana. Every printed
 * keyword and effect op adds its fixed table value, also divided by mana.
 * Noncreature spells start at 0.35 before their effect values. Static abilities,
 * awakening stats, and extra effect targets receive small explicit bonuses.
 * Rarity then scales the result by 1.00, 1.03, 1.06, 1.09, or 1.12.
 */
export function rateCard(card: CardDef): number {
  if (card.types.includes('land')) {
    const sources = card.manaAbility?.length ?? 0;
    return Math.max(0.25, sources * 0.8 - (card.entersTapped ? 0.15 : 0));
  }

  const mv = Math.max(1, manaValue(card.cost));
  let raw = card.types.includes('creature')
    ? (1.1 * (card.attack ?? 0) + 0.9 * (card.defense ?? 0)) / mv
    : 0.35;
  raw += (card.keywords ?? []).reduce((sum, keyword) => sum + KEYWORD_VALUE[keyword] / mv, 0);
  raw += cardEffectOps(card).reduce((sum, op) => sum + OP_VALUE[op.op] / mv, 0);
  raw += (card.abilities ?? []).filter((ability) => ability.static).length * 0.35;
  raw += ((card.awakening?.p ?? 0) + (card.awakening?.t ?? 0)) * 0.12;
  raw += (card.abilities ?? []).reduce((sum, ability) => sum + Math.max(0, (ability.targets?.length ?? 0) - 1) * 0.1, 0);
  return Math.max(0, raw * RARITY_MULTIPLIER[card.rarity]);
}

const hasOp = (card: CardDef, names: readonly EffectOp['op'][]): boolean =>
  cardEffectOps(card).some((op) => names.includes(op.op));

export function cardRoles(card: CardDef): SpellRole[] {
  if (card.types.includes('land') || card.token) return [];
  const roles: SpellRole[] = [];
  if (card.types.includes('creature')) roles.push('threats');
  if (hasOp(card, ['damage', 'destroy', 'sever', 'massDestroy', 'recall', 'tap', 'destroyArtifactOrSeverEnchantment'])) {
    roles.push('removal');
  }
  if (
    card.types.includes('charm') ||
    hasOp(card, ['cancel', 'preventCombat', 'boost', 'recall', 'tap', 'destroyNewestOpponentArtifactOrEnchantment'])
  ) {
    roles.push('interaction');
  }
  if (hasOp(card, ['draw', 'foresee'])) roles.push('draw');
  const mv = manaValue(card.cost);
  if (
    (card.types.includes('creature') && (mv >= 5 || (card.attack ?? 0) >= 5)) ||
    hasOp(card, ['massDestroy', 'raise', 'awaken']) ||
    cardEffectOps(card).some((op) => op.op === 'damage' && (op.n === 'X' || op.n >= 4)) ||
    cardEffectOps(card).some((op) => op.op === 'boost' && op.scope === 'allYours')
  ) {
    roles.push('finishers');
  }
  return roles;
}

export function curveBand(card: CardDef): CurveBand {
  const mv = manaValue(card.cost);
  if (mv <= 2) return 'early';
  if (mv <= 4) return 'mid';
  return 'late';
}

/** Pure scoring over the card, persona template, and summarized current deck. */
export function scoreCard(card: CardDef, template: PersonaTemplate, state: PersonaDeckState): CardScore {
  const roles = cardRoles(card);
  const rate = rateCard(card);
  const unmet = roles.map((role) => Math.max(0, template.quotas[role] - state.roleCounts[role]));
  const roleFit = unmet.length === 0 ? 0 : Math.max(...unmet.map((remaining) => remaining > 0 ? 3 + remaining * 0.08 : -0.5));

  const effectNames = cardEffectOps(card).map((op) => op.op);
  const synergy =
    card.subtypes.filter((tag) => template.synergy.subtypes.includes(tag)).length * 1.25 +
    (card.keywords ?? []).filter((tag) => template.synergy.keywords.includes(tag)).length +
    effectNames.filter((tag) => template.synergy.effectOps.includes(tag)).length * 0.8;

  const band = curveBand(card);
  const remainingInBand = template.curve.targets[band] - state.curveCounts[band];
  const overCurve = manaValue(card.cost) > template.curve.maxManaValue;
  const curveFit = overCurve ? -8 : remainingInBand > 0 ? 1.25 : -0.35;
  return { total: rate * 5 + roleFit + synergy + curveFit, rate, roleFit, synergy, curveFit, roles };
}
