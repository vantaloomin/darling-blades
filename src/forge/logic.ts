import type { CardVariant, FrameStyle, HoloFinish } from '../meta/variants';
import type {
  CardDef,
  CardType,
  Color,
  Keyword,
  ManaCost,
  Rarity,
  StaticDef,
  TargetSpec,
} from '../engine/types';
import { manaValue } from '../engine/types';
import {
  CARD_FLOOR,
  MANA_STEP,
  OFF,
  PIE,
  PIP_PREMIUM,
  RARITY_BONUS,
  SEC,
  dutiesOf,
  scoreCard,
  type Part,
  type Score,
  type ScorableAbilityDef,
  type ScorableActivated,
  type ScorableCardDef,
  type ScorableCondition,
  type ScorableEffectOp,
  type ScorableTriggerWhen,
} from '../power/scoreCore';

export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const satisfies readonly Color[];

export type CardSet = NonNullable<CardDef['set']> | 'starborne';
export type FrameChoice = FrameStyle | 'default';
export type HoloChoice = HoloFinish | 'default';
export type TargetChoice = TargetSpec['what'] | 'none';
/** Mana a source can produce. Derived from `CardDef` so this compiles against
 * both the older `Color[]` engine union and the newer one that adds 'C'. */
export type ManaAbilityColor = NonNullable<CardDef['manaAbility']>[number];
export type ObserverFilter = NonNullable<ScorableAbilityDef['filter']>;
export type BuilderConditionKind = 'none' | 'questActive' | 'controlMarked' | 'markedThreshold' | 'creatureDiedThisTurn' | 'controlsOther';
export type MarkedThresholdSubject = NonNullable<
  Extract<ScorableCondition, { kind: 'markedThreshold' }>['subject']
>;

export interface CostState {
  generic: number;
  pips: Record<Color, number>;
}

export interface BuilderAbility {
  when: ScorableTriggerWhen;
  condition: BuilderConditionKind;
  conditionN: number;
  conditionSubject: MarkedThresholdSubject | null;
  /** `controlsOther` only: the subtype another creature you control must have. */
  conditionSubtype?: string;
  /** allyDies / allyAttacks observer filter (power-formula §4t). */
  filter?: ObserverFilter;
  /** Fires at most once on each player's turn. */
  oncePerTurn?: boolean;
  target: TargetChoice;
  ops: ScorableEffectOp[];
  static: StaticDef;
}

export interface BuilderMechanics {
  empower: { enabled: boolean; cost: CostState; ops: ScorableEffectOp[] };
  rite: { enabled: boolean; n: number };
  nineLives: { enabled: boolean };
  preserve: { enabled: boolean; cost: CostState };
  skim: { enabled: boolean; cost: CostState };
  retell: { enabled: boolean; cost: CostState; overrideOps: boolean; ops: ScorableEffectOp[] };
  hauntlink: {
    enabled: boolean;
    cost: CostState;
    p: number;
    t: number;
    keywords: Keyword[];
  };
  awakening: { enabled: boolean; p: number; t: number; keywords: Keyword[] };
  chapters: { enabled: boolean; chapters: ScorableEffectOp[][] };
  manaAbility: { enabled: boolean; colors: ManaAbilityColor[] };
  entersTapped: { enabled: boolean };
  /** Duty (1.8): tap-cost activated ability. `cost` is the mana part; the tap is implied. */
  activated: {
    enabled: boolean;
    cost: CostState;
    target: TargetChoice;
    ops: ScorableEffectOp[];
    /** Further Duties of a loaded card, kept as printed (each shares the one tap). */
    extra?: ScorableActivated[];
  };
  /** Whispers (1.8): fresh-graveyard alternative cost. */
  whispers: { enabled: boolean; cost: CostState };
  /** Tithe (1.8): any-number sacrifice, one generic per two Defense. */
  tithe: { enabled: boolean };
}

export interface BuilderState {
  artDonorId: string;
  name: string;
  cardType: CardType;
  /** Secondary printed types retained for faithful catalog round-trips. */
  additionalTypes: CardType[];
  subtypesText: string;
  rarity: Rarity;
  legendary: boolean;
  set: CardSet;
  flavor: string;
  cost: CostState;
  /** Null follows the printed mana pips; an array is an explicit identity. */
  colorOverride: Color[] | null;
  isX: boolean;
  attack: number;
  defense: number;
  keywords: Keyword[];
  abilities: BuilderAbility[];
  mechanics: BuilderMechanics;
  appearance: {
    frame: FrameChoice;
    holo: HoloChoice;
    fullArt: boolean;
  };
}

export type VerdictBand = 'under' | 'accurate' | 'over';

export interface Evaluation {
  card: ScorableCardDef;
  score: Score;
  band: VerdictBand;
  warnings: string[];
}

export function emptyCost(generic = 0): CostState {
  return { generic, pips: { W: 0, U: 0, B: 0, R: 0, G: 0 } };
}

export function createInitialAbility(): BuilderAbility {
  return {
    when: 'arrives',
    condition: 'none',
    conditionN: 3,
    conditionSubject: null,
    target: 'none',
    ops: [{ op: 'foresee', n: 1 }],
    static: { scope: 'self', p: 0, t: 0, grantKeywords: [] },
  };
}

export function createInitialBuilderState(): BuilderState {
  return {
    artDonorId: 'gm-manor-thrall',
    name: 'Untitled Blade',
    cardType: 'creature',
    additionalTypes: [],
    subtypesText: 'Warrior',
    rarity: 'c',
    legendary: false,
    set: 'base',
    flavor: '',
    cost: { generic: 1, pips: { W: 0, U: 0, B: 0, R: 0, G: 1 } },
    colorOverride: null,
    isX: false,
    attack: 2,
    defense: 2,
    keywords: [],
    abilities: [],
    mechanics: {
      empower: { enabled: false, cost: emptyCost(1), ops: [{ op: 'draw', n: 1 }] },
      rite: { enabled: false, n: 1 },
      nineLives: { enabled: false },
      preserve: { enabled: false, cost: emptyCost(3) },
      skim: { enabled: false, cost: emptyCost(1) },
      retell: { enabled: false, cost: emptyCost(3), overrideOps: false, ops: [{ op: 'draw', n: 1 }] },
      hauntlink: { enabled: false, cost: emptyCost(1), p: 1, t: 0, keywords: [] },
      awakening: { enabled: false, p: 2, t: 2, keywords: [] },
      chapters: {
        enabled: false,
        chapters: [
          [{ op: 'foresee', n: 1 }],
          [{ op: 'gainLife', n: 2 }],
          [{ op: 'awaken', scope: 'allYours' }],
        ],
      },
      manaAbility: { enabled: false, colors: ['G'] },
      entersTapped: { enabled: false },
      activated: { enabled: false, cost: emptyCost(0), target: 'none', ops: [{ op: 'foresee', n: 1 }] },
      whispers: { enabled: false, cost: emptyCost(1) },
      tithe: { enabled: false },
    },
    appearance: { frame: 'default', holo: 'default', fullArt: false },
  };
}

export function cloneBuilderState(state: BuilderState): BuilderState {
  return structuredClone(state);
}

export function builderHasType(state: BuilderState, type: CardType): boolean {
  return state.cardType === type || state.additionalTypes.includes(type);
}

export function toManaCost(cost: CostState): ManaCost {
  return {
    generic: Math.max(0, Math.round(cost.generic)),
    pips: Object.fromEntries(
      COLOR_ORDER
        .map((color) => [color, Math.max(0, Math.round(cost.pips[color]))] as const)
        .filter(([, count]) => count > 0),
    ),
  };
}

export function colorsForCost(cost: CostState): Color[] {
  return COLOR_ORDER.filter((color) => cost.pips[color] > 0);
}

function fromManaCost(cost: ManaCost | undefined): CostState {
  return {
    generic: cost?.generic ?? 0,
    pips: Object.fromEntries(
      COLOR_ORDER.map((color) => [color, cost?.pips[color] ?? 0] as const),
    ) as Record<Color, number>,
  };
}

function splitSubtypes(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function conditionToDef(ability: BuilderAbility): ScorableCondition | undefined {
  if (ability.condition === 'none') return undefined;
  if (ability.condition === 'markedThreshold') {
    return {
      kind: 'markedThreshold',
      n: Math.max(1, Math.round(ability.conditionN)),
      ...(ability.conditionSubject ? { subject: ability.conditionSubject } : {}),
    };
  }
  if (ability.condition === 'controlsOther') return { kind: 'controlsOther', subtype: (ability.conditionSubtype ?? '').trim() };
  return ability.condition;
}

function abilityToDef(ability: BuilderAbility): ScorableAbilityDef {
  const condition = conditionToDef(ability);
  if (ability.when === 'static') {
    return {
      when: 'static',
      condition,
      static: {
        ...ability.static,
        condition: condition === 'questActive' ? 'questActive' : undefined,
        filter: ability.static.scope === 'filter' ? ability.static.filter : undefined,
        grantKeywords: ability.static.grantKeywords?.length ? ability.static.grantKeywords : undefined,
      },
    };
  }
  const filter = cleanFilter(ability.filter);
  return {
    when: ability.when,
    condition,
    targets: ability.target === 'none' ? undefined : [{ what: ability.target }],
    ops: ability.ops,
    ...(filter ? { filter } : {}),
    ...(ability.oncePerTurn ? { oncePerTurn: true as const } : {}),
  };
}

/** Drops unset keys so an untouched filter exports as no filter at all. */
function cleanFilter(filter: ObserverFilter | undefined): ObserverFilter | undefined {
  if (!filter) return undefined;
  const subtype = filter.subtype?.trim();
  const out: ObserverFilter = {
    ...(filter.other ? { other: true as const } : {}),
    ...(subtype ? { subtype } : {}),
    ...(filter.sacrifice ? { sacrifice: true as const } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function conditionFromDef(
  condition: ScorableCondition | StaticDef['condition'] | undefined,
): Pick<BuilderAbility, 'condition' | 'conditionN' | 'conditionSubject' | 'conditionSubtype'> {
  if (typeof condition === 'object' && condition.kind === 'controlsOther') {
    return { condition: 'controlsOther', conditionN: 3, conditionSubject: null, conditionSubtype: condition.subtype };
  }
  if (typeof condition === 'object') {
    return {
      condition: 'markedThreshold',
      conditionN: condition.n,
      conditionSubject: condition.subject ?? null,
    };
  }
  return { condition: condition ?? 'none', conditionN: 3, conditionSubject: null };
}

function abilityFromDef(ability: ScorableAbilityDef): BuilderAbility {
  const condition = conditionFromDef(ability.condition ?? ability.static?.condition);
  return {
    when: ability.when,
    ...condition,
    target: ability.targets?.[0]?.what ?? 'none',
    ops: structuredClone(ability.ops ?? []),
    ...(ability.filter ? { filter: structuredClone(ability.filter) } : {}),
    ...(ability.oncePerTurn ? { oncePerTurn: true } : {}),
    static: structuredClone(ability.static ?? {
      scope: 'self',
      p: 0,
      t: 0,
      grantKeywords: [],
    }),
  };
}

/** Reconstructs every scorer-relevant builder field from a catalog card. */
export function fromCardDef(card: ScorableCardDef): BuilderState {
  const state = createInitialBuilderState();
  const cardType = card.types[0] ?? 'creature';

  state.artDonorId = card.id;
  state.name = card.name;
  state.cardType = cardType;
  state.additionalTypes = card.types.slice(1);
  state.subtypesText = card.subtypes.join(', ');
  state.rarity = card.rarity;
  state.legendary = card.supertypes?.includes('legendary') ?? false;
  state.set = card.set ?? 'base';
  state.flavor = card.flavor ?? '';
  state.cost = fromManaCost(card.cost);
  const costColors = colorsForCost(state.cost);
  state.colorOverride = card.colors.length === costColors.length
    && card.colors.every((color) => costColors.includes(color))
    ? null
    : [...card.colors];
  state.isX = card.x !== undefined;
  state.attack = card.attack ?? 0;
  state.defense = card.defense ?? 0;
  state.keywords = [...(card.keywords ?? [])];
  state.abilities = (card.abilities ?? []).map(abilityFromDef);

  state.mechanics.empower = card.empower
    ? { enabled: true, cost: fromManaCost(card.empower.cost), ops: structuredClone(card.empower.ops) }
    : state.mechanics.empower;
  state.mechanics.rite = card.rite
    ? { enabled: true, n: card.rite.n }
    : state.mechanics.rite;
  state.mechanics.nineLives.enabled = card.nineLives === true;
  state.mechanics.preserve = card.preserve
    ? { enabled: true, cost: fromManaCost(card.preserve.cost) }
    : state.mechanics.preserve;
  state.mechanics.skim = card.skim
    ? { enabled: true, cost: fromManaCost(card.skim.cost) }
    : state.mechanics.skim;
  state.mechanics.retell = card.retell
    ? {
        enabled: true,
        cost: fromManaCost(card.retell.cost),
        overrideOps: card.retell.ops !== undefined,
        ops: structuredClone(card.retell.ops ?? []),
      }
    : state.mechanics.retell;
  state.mechanics.hauntlink = card.hauntlink
    ? {
        enabled: true,
        cost: fromManaCost(card.hauntlink.cost),
        p: card.hauntlink.linked.p ?? 0,
        t: card.hauntlink.linked.t ?? 0,
        keywords: [...(card.hauntlink.linked.grantKeywords ?? [])],
      }
    : state.mechanics.hauntlink;
  state.mechanics.awakening = card.awakening
    ? {
        enabled: true,
        p: card.awakening.p ?? 0,
        t: card.awakening.t ?? 0,
        keywords: [...(card.awakening.keywords ?? [])],
      }
    : state.mechanics.awakening;
  state.mechanics.chapters = card.chapters
    ? { enabled: true, chapters: structuredClone(card.chapters) }
    : state.mechanics.chapters;
  state.mechanics.manaAbility = card.manaAbility
    ? { enabled: true, colors: [...card.manaAbility] }
    : state.mechanics.manaAbility;
  state.mechanics.entersTapped.enabled = card.entersTapped === true;
  // The builder edits ONE Duty. A card printing several loads its first for
  // editing and keeps the rest as printed, so the round trip is exact.
  const duty = dutiesOf(card)[0];
  state.mechanics.activated = duty
    ? {
        enabled: true,
        cost: fromManaCost(duty.cost.mana),
        target: duty.targets?.[0]?.what ?? 'none',
        ops: structuredClone(duty.ops),
        ...(dutiesOf(card).length > 1 ? { extra: structuredClone(dutiesOf(card).slice(1)) } : {}),
      }
    : state.mechanics.activated;
  state.mechanics.whispers = card.whispers
    ? { enabled: true, cost: fromManaCost(card.whispers.cost) }
    : state.mechanics.whispers;
  state.mechanics.tithe.enabled = card.tithe !== undefined;

  return state;
}

export function toCardDef(state: BuilderState): ScorableCardDef {
  const types = [state.cardType, ...state.additionalTypes];
  const isLand = builderHasType(state, 'land');
  const isCreature = builderHasType(state, 'creature');
  const mechanics = state.mechanics;
  const manaColors = mechanics.manaAbility.enabled ? mechanics.manaAbility.colors : [];
  // A land's colour identity is the coloured mana it makes; colourless 'C'
  // is not a Color. Route through string[] so the comparison type-checks on
  // trees whose manaAbility union does not include 'C'.
  const landColors = (manaColors as readonly string[]).filter(
    (candidate): candidate is Color => candidate !== 'C',
  );
  const colors = isLand ? landColors : (state.colorOverride ?? colorsForCost(state.cost));
  const card: ScorableCardDef = {
    id: state.artDonorId,
    name: state.name.trim() || 'Untitled Blade',
    types,
    subtypes: splitSubtypes(state.subtypesText),
    supertypes: state.legendary ? ['legendary'] : undefined,
    cost: isLand ? undefined : toManaCost(state.cost),
    colors,
    attack: isCreature ? state.attack : undefined,
    defense: isCreature ? state.defense : undefined,
    keywords: state.keywords.length ? [...state.keywords] : undefined,
    x: state.isX && !isLand ? { min: 0 } : undefined,
    abilities: state.abilities.length ? state.abilities.map(abilityToDef) : undefined,
    empower: mechanics.empower.enabled
      ? { cost: toManaCost(mechanics.empower.cost), ops: mechanics.empower.ops }
      : undefined,
    rite: mechanics.rite.enabled ? { n: mechanics.rite.n } : undefined,
    nineLives: mechanics.nineLives.enabled ? true : undefined,
    preserve: mechanics.preserve.enabled ? { cost: toManaCost(mechanics.preserve.cost) } : undefined,
    skim: mechanics.skim.enabled ? { cost: toManaCost(mechanics.skim.cost) } : undefined,
    retell: mechanics.retell.enabled
      ? {
          cost: toManaCost(mechanics.retell.cost),
          ops: mechanics.retell.overrideOps ? mechanics.retell.ops : undefined,
        }
      : undefined,
    hauntlink: mechanics.hauntlink.enabled
      ? {
          cost: toManaCost(mechanics.hauntlink.cost),
          linked: {
            p: mechanics.hauntlink.p,
            t: mechanics.hauntlink.t,
            grantKeywords: mechanics.hauntlink.keywords.length
              ? mechanics.hauntlink.keywords
              : undefined,
          },
        }
      : undefined,
    awakening: mechanics.awakening.enabled
      ? {
          p: mechanics.awakening.p,
          t: mechanics.awakening.t,
          keywords: mechanics.awakening.keywords.length
            ? mechanics.awakening.keywords
            : undefined,
        }
      : undefined,
    chapters: mechanics.chapters.enabled ? mechanics.chapters.chapters : undefined,
    manaAbility: mechanics.manaAbility.enabled ? manaColors : undefined,
    entersTapped: mechanics.entersTapped.enabled || undefined,
    activated: mechanics.activated.enabled ? withExtraDuties({
      cost: activatedManaValue(state) > 0
        ? { tap: true, mana: toManaCost(mechanics.activated.cost) }
        : { tap: true },
      ops: mechanics.activated.ops,
      targets: mechanics.activated.target === 'none' ? undefined : [{ what: mechanics.activated.target }],
    }, mechanics.activated.extra) : undefined,
    whispers: mechanics.whispers.enabled ? { cost: toManaCost(mechanics.whispers.cost) } : undefined,
    tithe: mechanics.tithe.enabled ? { per: 2 } : undefined,
    rarity: state.rarity,
    flavor: state.flavor.trim() || undefined,
    set: state.set,
  };
  return card;
}

export function bandForDelta(delta: number): VerdictBand {
  if (delta < -0.75) return 'under';
  if (delta <= 0.75) return 'accurate';
  return 'over';
}

export function printedManaValue(state: BuilderState): number {
  return builderHasType(state, 'land') ? 0 : manaValue(toManaCost(state.cost));
}

function withExtraDuties(first: ScorableActivated, extra: ScorableActivated[] | undefined): ScorableActivated | ScorableActivated[] {
  return extra?.length ? [first, ...extra] : first;
}

export function activatedManaValue(state: BuilderState): number {
  return manaValue(toManaCost(state.mechanics.activated.cost));
}

export function whispersManaValue(state: BuilderState): number {
  return manaValue(toManaCost(state.mechanics.whispers.cost));
}

/** The printed mana value at which the v3 budget would equal this power:
 * the "fair" cost of the effect, used by the Whispers cost guard. */
export function fairManaValueFor(state: BuilderState, power: number): number {
  const pips = COLOR_ORDER.reduce((sum, color) => sum + state.cost.pips[color], 0);
  return 1 + (power - CARD_FLOOR - PIP_PREMIUM * (pips - 1) - RARITY_BONUS[state.rarity]) / MANA_STEP;
}

export function empowerTotalManaValue(state: BuilderState): number {
  if (!state.mechanics.empower.enabled) return printedManaValue(state);
  return printedManaValue(state) + manaValue(toManaCost(state.mechanics.empower.cost));
}

export function warningsFor(state: BuilderState, score: Score): string[] {
  const warnings: string[] = [];
  if (score.isX) warnings.push('X is scored at the nominal X = 3 rate. Judge efficiency, not the point total.');
  warnings.push(...score.unknowns.map((unknown) => `Unknown scorer vocabulary: ${unknown}`));
  if (state.mechanics.empower.enabled && empowerTotalManaValue(state) > 9) {
    warnings.push(`Printed MV plus Empower MV is ${empowerTotalManaValue(state)}. The ceiling is 9 and 10 is the hard cap.`);
  }
  if (!builderHasType(state, 'creature') && state.keywords.length > 0) {
    warnings.push('Printed keywords on a noncreature have no MEP effect in the scorer.');
  }
  if (builderHasType(state, 'land')) {
    warnings.push('Lands have no mana budget and are excluded from the scorer CLI ranking.');
  }
  if (state.mechanics.skim.enabled || state.mechanics.preserve.enabled) {
    warnings.push('Skim and Preserve costs render on the card but do not change their flat MEP option values.');
  }
  const m = state.mechanics;
  if (m.activated.enabled) {
    if (builderHasType(state, 'land')) warnings.push('Duty: lands never carry a Duty (their tap is the mana ability). The validator refuses it.');
    if (m.manaAbility.enabled) warnings.push('Duty: cannot combine with a mana ability (D2e). The validator refuses it.');
    if (m.hauntlink.enabled) warnings.push('Duty: cannot combine with Hauntlink (D2e). The validator refuses it.');
    if (state.isX) warnings.push('Duty: ops cannot use X. The validator refuses it.');
    if (m.activated.ops.length === 0) warnings.push('Duty: the op list is empty. The validator refuses it.');
    if (m.activated.target === 'none' && m.activated.ops.some((op) => opNeedsTarget(op))) warnings.push('Duty: a targeting op needs a target choice.');
    if (m.activated.target === 'spell') warnings.push('Duty: a spell target is not a legal Duty target kind.');
    if (builderHasType(state, 'creature')) {
      const part = score.parts.find((candidate) => candidate.label.startsWith('duty'));
      if (part && part.label.includes('NEEDS MATH band')) warnings.push('Duty: the creature top band (per-trigger value 2.0 or more) is priced at perTrigger + 1.0 and flagged NEEDS MATH (section 4q).');
      warnings.push('Duty on a body is priced against the attack it forgoes; the Attack 2+ discount (-0.5) is documented in section 4q and not applied.');
    }
    if (activatedManaValue(state) > 0) warnings.push('Duty: the activation-mana discount D = 0.4 per mana (cap 1.5) is a midpoint flagged NEEDS MATH (section 4q).');
  }
  if (m.whispers.enabled) {
    if (m.retell.enabled) warnings.push('Whispers: cannot combine with Retell. The validator refuses it.');
    if (m.rite.enabled) warnings.push('Whispers: cannot combine with Rite. The validator refuses it.');
    if (m.hauntlink.enabled) warnings.push('Whispers: cannot combine with Hauntlink. The validator refuses it.');
    if (state.isX) warnings.push('Whispers: cannot combine with an X cost. The validator refuses it.');
    if (m.empower.enabled) warnings.push('Whispers: Empower never applies to a Whispers cast (priced as printed only).');
    const wmv = whispersManaValue(state);
    if (wmv >= printedManaValue(state)) warnings.push('Whispers: the Whispers cost is not below the printed cost, so the option is worth nothing.');
    const fair = fairManaValueFor(state, score.power - (score.parts.find((candidate) => candidate.label.startsWith('whispers'))?.v ?? 0));
    if (wmv < fair - 2) warnings.push(`Whispers: cost ${wmv} is more than 2 below the fair cost of the effect (about ${fair.toFixed(1)}). The era guard is fair - 1, never below fair - 2 (section 4r).`);
    else if (wmv < fair - 1) warnings.push(`Whispers: cost ${wmv} is below fair - 1 (fair about ${fair.toFixed(1)}); the era median is fair - 1 (section 4r).`);
    if (!builderHasType(state, 'charm')) warnings.push('Whispers on a body or sorcery-speed effect earns 0 at printed (six exact vanilla twins in the era); the option is a deck-building upside, not MEP.');
    else warnings.push('Whispers: E_FIRE = 0.5 is a placeholder flagged NEEDS MATH until the fire rate is measured on a seeded matrix (section 4r).');
    if (m.skim.enabled) warnings.push('Skim + Whispers on one card: the combined-cast guard is NEEDS MATH (Ichor Slick, n=1).');
  }
  if (m.tithe.enabled) {
    if (!builderHasType(state, 'creature')) warnings.push('Tithe: creatures only (the engine allows any creature; Drowned Deep prints it only on Horrors).');
    else if (!splitSubtypes(state.subtypesText).includes('Horror') && (state.set as string) === 'drowned-deep') warnings.push('Tithe: Drowned Deep prints Tithe only on Horrors (per-set catalog policy).');
    if (state.isX) warnings.push('Tithe: cannot combine with an X cost. The validator refuses it.');
    if (m.retell.enabled) warnings.push('Tithe: cannot combine with Retell. The validator refuses it.');
    if (m.hauntlink.enabled) warnings.push('Tithe: cannot combine with Hauntlink. The validator refuses it.');
    if (m.whispers.enabled) warnings.push('Tithe: cannot combine with Whispers. The validator refuses it.');
    if (m.rite.enabled) warnings.push('Tithe: cannot combine with Rite (one sacrifice mechanic per card). The validator refuses it.');
    if (state.abilities.some((ability) => ability.ops.some((op) => op.op === 'addCounters'))) warnings.push('Tithe with a counter gain needs the Devour rate on top (section 4s); not applied.');
    warnings.push('Tithe is a flat +0.50 option; the discount tempo is NEEDS MATH (section 4s).');
  }
  return warnings;
}

function opNeedsTarget(op: ScorableEffectOp): boolean {
  switch (op.op) {
    case 'damage': return op.to === 'target';
    case 'destroy': case 'sever': case 'recall': case 'tap': case 'removeMarks': case 'moveMark': case 'ifTargetMarked': return true;
    case 'boost': return op.scope === 'target';
    case 'addCounters': return op.to === 'target';
    case 'raise': return (op.to ?? 'target') === 'target';
    default: return false;
  }
}

export function evaluateBuilder(state: BuilderState): Evaluation {
  const card = toCardDef(state);
  const score = scoreCard(card);
  return { card, score, band: bandForDelta(score.delta), warnings: warningsFor(state, score) };
}

export function appearanceVariant(state: BuilderState): CardVariant | undefined {
  const frame = state.appearance.frame === 'default' ? 'white' : state.appearance.frame;
  const holo = state.appearance.holo === 'default' ? 'none' : state.appearance.holo;
  if (frame === 'white' && holo === 'none' && !state.appearance.fullArt) return undefined;
  return { frame, holo, fullArt: state.appearance.fullArt };
}

export function manaCostLabel(cost: CostState): string {
  const pieces: string[] = [];
  if (cost.generic > 0) pieces.push(`{${cost.generic}}`);
  for (const color of COLOR_ORDER) {
    for (let index = 0; index < cost.pips[color]; index += 1) pieces.push(`{${color}}`);
  }
  return pieces.join('') || '{0}';
}

export function rarityBudgetLabel(state: BuilderState): string {
  const mv = printedManaValue(state);
  const pips = COLOR_ORDER.reduce((sum, color) => sum + state.cost.pips[color], 0);
  return `${CARD_FLOOR.toFixed(2)} floor + ${MANA_STEP.toFixed(2)}×${mv - 1} mana + ${PIP_PREMIUM.toFixed(2)}×${pips - 1} pips + ${RARITY_BONUS[state.rarity].toFixed(2)} ${state.rarity.toUpperCase()}`;
}

const COLOR_NAMES: Record<Color, string> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green',
};

/** Adds designer-facing context without changing the persisted scorer Part. */
export function ledgerLabelForPart(card: ScorableCardDef, part: Part): string {
  const prefix = 'off-pie: ';
  if (!part.label.startsWith(prefix)) return part.label;
  const effectClass = part.label.slice(prefix.length);
  const def = PIE[effectClass];
  if (!def) return part.label;
  const colors = card.colors as Color[];
  const tier = colors.length > 0
    ? Math.min(...colors.map((color) => def.pie[color] ?? OFF))
    : def.colorless;
  const tierName = Math.abs(tier - SEC) < 0.0001 ? 'secondary' : 'off-pie';
  const identity = colors.length > 0
    ? colors.map((color) => COLOR_NAMES[color]).join('/')
    : 'colorless';
  const primary = (Object.entries(def.pie) as [Color, number][])
    .filter(([, value]) => value === 0)
    .map(([color]) => COLOR_NAMES[color])
    .join('/');
  // The scorer bills `tier × min(1, classWeight)`, so an incidental rider pays
  // less than the full tier (power-formula §3b). Showing only the tier next to
  // a smaller charge reads as a mismatch, so name both when they differ.
  const scaled = Math.abs(part.v - tier) > 0.005;
  const rate = scaled
    ? `${tierName} for ${identity} +${tier.toFixed(2)} scaled to +${part.v.toFixed(2)}`
    : `${tierName} for ${identity} +${tier.toFixed(2)}`;
  return `${effectClass} · ${rate} · primary in ${primary || 'none'}`;
}
