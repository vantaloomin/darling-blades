import { manaValue, type AbilityDef, type CardDef, type EffectOp, type Keyword, type TriggerWhen } from '../../src/engine/types';
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
  // §4h rules one-shot Propagate at 0.70 MEP. Keep that direct mapping here;
  // the dawn case is context-priced below from its 1.65 MEP per trigger.
  propagate: 0.7,
  moveMark: 0.8, // NEEDS MATH: §4 comparative sweep has no settled mapping yet.
  removeMarks: 0.9, // NEEDS MATH: §4 comparative sweep has no settled mapping yet.
  markAll: 1.35, // NEEDS MATH: §4 has no clean multi-target comparative yet.
  loseLifePerTheirMarked: 1.1, // NEEDS MATH: §4 per-marked-drain comparative pending.
  fetchLand: 0.9, // NEEDS MATH: §4 does not yet rule a persona-scale ramp mapping.
  ifTargetMarked: 0.6, // NEEDS MATH: §4 leaves conditional branch value judgment-based.
  severSelf: 0.8, // NEEDS MATH: §4 does not yet rule this self-sever mapping.
  tap: 0.7,
  extraLandDrop: 0.7,
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

type BoostScope = Extract<EffectOp, { op: 'boost' }>['scope'];
const BOOST_SCOPE_MULTIPLIER: Readonly<Record<BoostScope, number>> = {
  target: 1,
  allYours: 1,
  all: 1,
  yourMarked: 1,
  // NEEDS MATH: marked opposing creatures are a narrower, board-dependent
  // hit than an unconditional mass debuff, so keep the first score conservative.
  theirMarked: 0.65,
};

// §4i expected-trigger pattern: noncreatures survive longer than creatures in
// this pool, so dawn values use the ruled 3.0x / 2.0x split.
const DAWN_MULT_NONCREATURE = 3.0;
const DAWN_MULT_CREATURE = 2.0;
// §4's Starborne rider leaves these gates provisional until seeded playtest
// data replaces the single-card judgment.
const MARKED_THRESHOLD_MULT = 0.5;
const CONDITIONAL_DAWN_MULT = 0.75;

interface EffectEntry {
  op: EffectOp;
  when?: TriggerWhen;
  condition?: AbilityDef['condition'];
}

function appendEffectEntries(
  out: EffectEntry[],
  ops: readonly EffectOp[],
  context: Omit<EffectEntry, 'op'> = {},
): void {
  for (const op of ops) {
    out.push({ op, ...context });
    if (op.op === 'ifTargetMarked') appendEffectEntries(out, [...op.then, ...(op.else ?? [])], context);
  }
}

function cardEffectEntries(card: CardDef): EffectEntry[] {
  const entries: EffectEntry[] = [];
  for (const ability of card.abilities ?? []) {
    appendEffectEntries(entries, ability.ops ?? [], { when: ability.when, condition: ability.condition });
  }
  for (const chapter of card.chapters ?? []) appendEffectEntries(entries, chapter);
  appendEffectEntries(entries, card.empower?.ops ?? []);
  return entries;
}

function dawnMultiplier(card: CardDef): number {
  return card.types.includes('creature') ? DAWN_MULT_CREATURE : DAWN_MULT_NONCREATURE;
}

function effectValue(entry: EffectEntry, card: CardDef): number {
  let value = entry.op.op === 'propagate' && entry.when === 'dawn'
    ? 1.65
    : OP_VALUE[entry.op.op];
  if (entry.op.op === 'boost') value *= BOOST_SCOPE_MULTIPLIER[entry.op.scope];
  if (entry.when === 'dawn') value *= dawnMultiplier(card);
  if (typeof entry.condition === 'object' && entry.condition.kind === 'markedThreshold') {
    value *= MARKED_THRESHOLD_MULT;
  }
  if (entry.when === 'dawn' && entry.condition === 'controlMarked') {
    value *= CONDITIONAL_DAWN_MULT;
  }
  return value;
}

// Typed over the closed Keyword union on purpose: before 2026-08-30 this was a
// bare object literal, so adding a keyword to the engine left this table
// silently short instead of failing the typecheck.
const KEYWORD_VALUE: Record<Keyword, number> = {
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
  // Drafter salience, not a power rate (note bulwark is positive here too):
  // Rage sits low because it takes a decision away without adding a threat.
  rage: 0.3,
};

export function cardEffectOps(card: CardDef): EffectOp[] {
  return cardEffectEntries(card).map((entry) => entry.op);
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
  raw += cardEffectEntries(card).reduce((sum, entry) => sum + effectValue(entry, card) / mv, 0);
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
