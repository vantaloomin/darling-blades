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
import { MECHANIC_NAMES } from '../data/glossary';
import type { SetId } from '../data/setTitles';
import {
  CARD_FLOOR,
  MANA_STEP,
  PIP_PREMIUM,
  RARITY_BONUS,
  dutiesOf,
  scoreCard,
  type Score,
  type ScorableAbilityDef,
  type ScorableActivated,
  type ScorableCardDef,
  type ScorableCondition,
  type ScorableEffectOp,
  type ScorableTriggerWhen,
} from '../power/scoreCore';
import { SET_LABELS } from './vocab';

export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const satisfies readonly Color[];

/** Every set the game has, including sets newer than the engine's own union. */
export type CardSet = NonNullable<CardDef['set']> | SetId;
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

/**
 * `illegal`: the game would refuse the card. `estimate`: a rate that has not
 * been measured in play yet. `note`: context for reading the score.
 */
export type WarningKind = 'illegal' | 'estimate' | 'note';

export interface ForgeWarning {
  /** Which rule raised it: a stable key for code and tests, never shown. */
  id: string;
  kind: WarningKind;
  text: string;
}

export interface Evaluation {
  card: ScorableCardDef;
  score: Score;
  band: VerdictBand;
  warnings: ForgeWarning[];
}

/** The art every fresh card starts with, and the fallback for an unknown donor. */
export const DEFAULT_ART_DONOR = 'gm-manor-thrall';

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
    artDonorId: DEFAULT_ART_DONOR,
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
    set: state.set as ScorableCardDef['set'],
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

/**
 * What the Forge wants the designer to know about the card: rule conflicts
 * the game would refuse (`illegal`), provisional rates (`estimate`), and
 * context for reading the score (`note`). Mechanic names come from the game's
 * own glossary, so a rename there flows through here.
 */
export function warningsFor(state: BuilderState, score: Score): ForgeWarning[] {
  const warnings: ForgeWarning[] = [];
  const add = (id: string, kind: WarningKind, text: string): void => { warnings.push({ id, kind, text }); };
  const m = state.mechanics;
  const {
    duty, whispers, tithe, retell, rite, hauntlink, empower, skim, preserve,
  } = MECHANIC_NAMES;
  const refused = 'The game won\'t allow this card.';

  if (score.isX) add('x-nominal', 'note', 'X is scored as if X were 3. Judge the rate per mana rather than the total.');
  for (const unknown of score.unknowns) {
    add(`unknown:${unknown}`, 'note', `The Forge can't price "${plainVocabulary(unknown)}" yet, so it counts as 0.`);
  }
  if (m.empower.enabled) {
    const total = empowerTotalManaValue(state);
    // Above the Warchest's ten lands the Empower can never be paid; ten itself
    // is the acknowledged top of the curve (tests/data/empowerCeiling.test.ts).
    if (total > 9) {
      add(total > 10 ? 'empower-over-cap' : 'empower-at-cap', total > 10 ? 'illegal' : 'note',
        `Cost plus ${empower} comes to ${total}. Real cards stay at 9 or less, and 10 is the hard limit.`);
    }
  }
  if (!builderHasType(state, 'creature') && state.keywords.length > 0) {
    add('keywords-noncreature', 'note', 'Keywords only count on creatures. On this card they print but add nothing.');
  }
  if (builderHasType(state, 'land')) {
    add('land-no-budget', 'note', 'Lands have no mana cost, so there is no Budget to measure them against.');
  }
  if (m.skim.enabled || m.preserve.enabled) {
    add('skim-preserve-flat', 'note', `${skim} and ${preserve} costs print on the card, but they count a flat amount whatever the cost.`);
  }
  if (m.activated.enabled) {
    if (builderHasType(state, 'land')) add('duty-on-land', 'illegal', `Lands can't have a ${duty} (tapping a land is its mana ability). ${refused}`);
    if (m.manaAbility.enabled) add('duty-with-mana-ability', 'illegal', `A ${duty} can't share a card with a mana ability. ${refused}`);
    if (m.hauntlink.enabled) add('duty-with-hauntlink', 'illegal', `A ${duty} can't share a card with ${hauntlink}. ${refused}`);
    if (state.isX) add('duty-with-x', 'illegal', `A ${duty}'s effects can't use X. ${refused}`);
    if (m.activated.ops.length === 0) add('duty-no-effects', 'illegal', `This ${duty} has no effects. Add one, or the game won't allow the card.`);
    if (m.activated.target === 'none' && m.activated.ops.some((op) => opNeedsTarget(op))) {
      add('duty-needs-target', 'illegal', `One of the ${duty}'s effects needs a target. Pick one.`);
    }
    if (m.activated.target === 'spell') add('duty-spell-target', 'illegal', `A ${duty} can't target a spell.`);
    if (builderHasType(state, 'creature')) {
      const part = score.parts.find((candidate) => candidate.label.startsWith('duty'));
      if (part && part.label.includes('NEEDS MATH')) add('duty-creature-band', 'estimate', `Strong ${pluralDuty(duty)} on creatures use a provisional rate.`);
      add('duty-creature-attack', 'note', `A ${duty} on a creature is priced against the attack it gives up. Bigger attackers lose more by tapping, and the Forge doesn't count that yet.`);
    }
    if (activatedManaValue(state) > 0) add('duty-mana-discount', 'estimate', `The discount for mana spent on a ${duty} uses a provisional rate.`);
  }
  if (m.whispers.enabled) {
    if (m.retell.enabled) add('whispers-with-retell', 'illegal', `${whispers} can't share a card with ${retell}. ${refused}`);
    if (m.rite.enabled) add('whispers-with-rite', 'illegal', `${whispers} can't share a card with ${rite}. ${refused}`);
    if (m.hauntlink.enabled) add('whispers-with-hauntlink', 'illegal', `${whispers} can't share a card with ${hauntlink}. ${refused}`);
    if (state.isX) add('whispers-with-x', 'illegal', `${whispers} can't be used with an X cost. ${refused}`);
    if (m.empower.enabled) add('whispers-empower', 'note', `${empower} never applies when you cast with ${whispers}, so it's priced as printed.`);
    const wmv = whispersManaValue(state);
    if (wmv >= printedManaValue(state)) add('whispers-not-lower', 'note', `The ${whispers} cost isn't lower than the printed cost, so it adds nothing.`);
    const fair = fairManaValueFor(state, score.power - (score.parts.find((candidate) => candidate.label.startsWith('whispers'))?.v ?? 0));
    if (wmv < fair - 2) {
      add('whispers-far-below-fair', 'note', `${whispers} cost ${wmv} is more than 2 below the fair cost of the effect (about ${fair.toFixed(1)}). Real cards keep it 1 below, never more than 2.`);
    } else if (wmv < fair - 1) {
      add('whispers-below-fair', 'note', `${whispers} cost ${wmv} is more than 1 below the fair cost of the effect (about ${fair.toFixed(1)}). Most real cards sit exactly 1 below.`);
    }
    if (!builderHasType(state, 'charm')) {
      add('whispers-no-value', 'note', `${whispers} on a creature or a sorcery-speed card adds nothing at its printed cost. It's a deckbuilding upside the formula doesn't count.`);
    } else {
      add('whispers-fire-rate', 'estimate', `How often ${whispers} gets cast is still a provisional rate.`);
    }
    if (m.skim.enabled) add('whispers-with-skim', 'estimate', `${skim} and ${whispers} on the same card has no measured rate yet.`);
  }
  if (m.tithe.enabled) {
    if (!builderHasType(state, 'creature')) add('tithe-noncreature', 'illegal', `${tithe} goes on creatures only.`);
    else if (!splitSubtypes(state.subtypesText).includes('Horror') && (state.set as string) === 'drowned-deep') {
      add('tithe-drowned-deep-horror', 'note', `In the ${SET_LABELS['drowned-deep']} set, only Horrors have ${tithe}.`);
    }
    if (state.isX) add('tithe-with-x', 'illegal', `${tithe} can't be used with an X cost. ${refused}`);
    if (m.retell.enabled) add('tithe-with-retell', 'illegal', `${tithe} can't share a card with ${retell}. ${refused}`);
    if (m.hauntlink.enabled) add('tithe-with-hauntlink', 'illegal', `${tithe} can't share a card with ${hauntlink}. ${refused}`);
    if (m.whispers.enabled) add('tithe-with-whispers', 'illegal', `${tithe} can't share a card with ${whispers}. ${refused}`);
    if (m.rite.enabled) add('tithe-with-rite', 'illegal', `${tithe} can't share a card with ${rite} (one sacrifice mechanic per card). ${refused}`);
    if (state.abilities.some((ability) => ability.ops.some((op) => op.op === 'addCounters'))) {
      add('tithe-mark-gain', 'note', `${tithe} with a mark gain would need an extra rate the Forge doesn't apply yet.`);
    }
    add('tithe-flat', 'estimate', `${tithe} counts a flat +0.50. The value of the discount itself isn't measured yet.`);
  }
  return warnings;
}

/** "Duty" to "Duties"; any other name gets a plain "s". */
function pluralDuty(name: string): string {
  return name.endsWith('y') ? `${name.slice(0, -1)}ies` : `${name}s`;
}

/** Scorer vocabulary ids (`op:frob`, `when:someTrigger`) as plain words. */
function plainVocabulary(unknown: string): string {
  return unknown
    .replace(/^[a-zA-Z.]+:/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
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

/** The Budget as its four terms, in the order the scorer adds them. */
export function rarityBudgetLabel(state: BuilderState): string {
  const mv = printedManaValue(state);
  const pips = COLOR_ORDER.reduce((sum, color) => sum + state.cost.pips[color], 0);
  return `${CARD_FLOOR.toFixed(2)} base + ${MANA_STEP.toFixed(2)} × ${mv - 1} mana + ${PIP_PREMIUM.toFixed(2)} × ${pips - 1} pips + ${RARITY_BONUS[state.rarity].toFixed(2)} rarity`;
}

/**
 * The builder cannot represent a few catalog fields exactly, so a loaded card
 * can score a little differently in the Forge than in the game. When it does,
 * say so, with one line per metric that moved. `builderCard` is the loaded
 * card as the builder converts it back.
 */
export function fidelityNotes(source: ScorableCardDef, builderCard: ScorableCardDef): ForgeWarning[] {
  const game = scoreCard(source);
  const here = scoreCard(builderCard);
  const moved = ([
    ['Power', game.power, here.power, false],
    ['Budget', game.budget, here.budget, false],
    ['Difference', game.delta, here.delta, true],
  ] as const).filter(([, before, after]) => before !== after);
  if (moved.length === 0) return [];
  const shown = (value: number, signedValue: boolean): string => (
    signedValue ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}` : value.toFixed(2)
  );
  return [
    { id: 'fidelity', kind: 'note', text: `The Forge can't edit everything on ${source.name}, so it scores a little differently here.` },
    ...moved.map(([metric, before, after, signedValue]): ForgeWarning => ({
      id: `fidelity:${metric}`,
      kind: 'note',
      text: `${metric}: ${shown(before, signedValue)} in the game, ${shown(after, signedValue)} here.`,
    })),
  ];
}
