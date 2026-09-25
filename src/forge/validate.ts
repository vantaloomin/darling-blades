/**
 * The one gate every card from outside the page passes through: an imported
 * set file, a share link, and the autosave read back from browser storage.
 *
 * All three are hostile until proven otherwise. The validator never passes an
 * input object through: it reads each field it knows, checks its type, its
 * vocabulary and its range, and builds a fresh object from the checked values
 * only. Anything it does not know (an unknown field, an effect or trigger the
 * Forge has no editor for, a number outside what the editors allow) refuses
 * the card with a reason the page can show. The accepted card is then passed
 * through the builder (`fromCardDef` then `toCardDef`), so a set only ever
 * holds cards the Forge itself can build and edit.
 *
 * The limits below are also the editors' limits (main.ts reads them for its
 * inputs and clamps to them), so every card the Forge can build validates:
 * the round-trip test in tests/forge/setFormat.test.ts holds that.
 *
 * Headless: no Phaser, no DOM, no Node built-ins.
 */
import { ALL_CARDS } from '../data/catalog';
import type { Color, Keyword, ManaCost, StaticDef, TargetSpec } from '../engine/types';
import type {
  ScorableAbilityDef,
  ScorableActivated,
  ScorableCardDef,
  ScorableCondition,
  ScorableEffectOp,
} from '../power/scoreCore';
import {
  COLOR_ORDER,
  DEFAULT_ART_DONOR,
  fromCardDef,
  toCardDef,
  type FrameChoice,
  type HoloChoice,
} from './logic';
import { readCustomArt, type CustomArt, type CustomImageForm } from './customArt';
import {
  CARD_TYPES,
  FRAME_CHOICES,
  HOLO_CHOICES,
  KEYWORDS,
  RARITIES,
  SETS,
  TOKEN_OPTIONS,
  TRIGGERS,
  type OpKind,
} from './vocab';

/** Every limit the editors enforce, in one place. */
export const FORGE_LIMITS = {
  nameLength: 80,
  subtypeLength: 120,
  subtypes: 64,
  /** The short subtype fields (ability conditions and filters). */
  filterSubtypeLength: 40,
  types: 3,
  generic: 9,
  pip: 9,
  stat: 12,
  /** Stat changes (boosts, statics, Hauntlink, Awakening) run both ways. */
  statChange: 12,
  abilities: 12,
  opsPerList: 12,
  chapters: 9,
  duties: 4,
  /** How deep "If the target is marked" branches may nest. */
  branchDepth: 4,
  riteSacrifices: 9,
  thresholdCount: 12,
  setNameLength: 60,
} as const;

/** Why a card was refused. The page shows `SKIP_REASON_TEXT`. */
export type SkipReason =
  | 'shape'
  | 'field'
  | 'name'
  | 'text'
  | 'type'
  | 'rarity'
  | 'set'
  | 'color'
  | 'keyword'
  | 'effect'
  | 'trigger'
  | 'target'
  | 'token'
  | 'number'
  | 'size';

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  shape: 'it isn\'t a card the Forge can read',
  field: 'it has a field the Forge doesn\'t know',
  name: 'its name is missing or longer than 80 characters',
  text: 'some of its text is too long',
  type: 'its card type isn\'t one the Forge knows',
  rarity: 'its rarity isn\'t one the Forge knows',
  set: 'its set isn\'t one the Forge knows',
  color: 'it uses a color the Forge doesn\'t know',
  keyword: 'it uses a keyword the Forge doesn\'t know',
  effect: 'it has an effect the Forge doesn\'t know',
  trigger: 'it has a trigger the Forge doesn\'t know',
  target: 'it has a target the Forge doesn\'t know',
  token: 'it makes a token the Forge doesn\'t know',
  number: 'a number on it is outside what the Forge allows',
  size: 'it has more abilities or effects than the Forge allows',
};

class Invalid extends Error {
  constructor(readonly reason: SkipReason) {
    super(reason);
  }
}

const fail = (reason: SkipReason): never => { throw new Invalid(reason); };

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** A plain object whose own keys are all in `allowed`. */
function object(value: unknown, allowed: readonly string[]): Json {
  if (!isPlainObject(value)) return fail('shape');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('field');
  return value;
}

function int(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return fail('number');
  return value;
}

function text(value: unknown, min: number, max: number, reason: SkipReason = 'text'): string {
  if (typeof value !== 'string') return fail('shape');
  if (value.length < min || value.length > max) return fail(reason);
  return value;
}

function oneOf<T extends string | number | boolean>(value: unknown, options: readonly T[], reason: SkipReason = 'shape'): T {
  if (!(options as readonly unknown[]).includes(value)) return fail(reason);
  return value as T;
}

function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) return fail('shape');
  if (value.length > max) return fail('size');
  return value;
}

/** A list of distinct values drawn from `options`. */
function distinct<T extends string>(value: unknown, options: readonly T[], reason: SkipReason, max = options.length): T[] {
  const list = array(value, max).map((item) => oneOf(item, options, reason));
  if (new Set(list).size !== list.length) fail(reason);
  return list;
}

const TOKEN_IDS = TOKEN_OPTIONS.map((token) => token.id);
const DONOR_IDS = new Set(ALL_CARDS.map((card) => card.id));
const TARGET_WHATS = [
  'creature', 'player', 'any', 'spell', 'yourCreature', 'opponentCreature', 'yourPermanent',
  'yourGraveCreature', 'artifact', 'enchantment', 'artifactOrEnchantment',
] as const satisfies readonly TargetSpec['what'][];

// ── Effects ──────────────────────────────────────────────────────────────────

/** How one effect field is checked. `int` ranges are the editors' ranges. */
export type OpFieldRule =
  | { kind: 'int'; min: number; max: number; optional?: true }
  | { kind: 'intOrX'; min: number; max: number }
  | { kind: 'enum'; values: readonly string[]; optional?: true }
  | { kind: 'flag'; optional: true }
  | { kind: 'keywords'; optional: true }
  | { kind: 'ops'; optional?: true }
  | { kind: 'token' };

const COUNT = (min: number, max: number, optional?: true): OpFieldRule => ({ kind: 'int', min, max, ...(optional ? { optional } : {}) });
const ENUM = (values: readonly string[], optional?: true): OpFieldRule => ({ kind: 'enum', values, ...(optional ? { optional } : {}) });
const TARGET_INDEX: OpFieldRule = { kind: 'int', min: 0, max: 3, optional: true };
const TO_TARGET = { to: ENUM(['target'], true), targetIndex: TARGET_INDEX };
const STAT = COUNT(-FORGE_LIMITS.statChange, FORGE_LIMITS.statChange);
const MARKS = COUNT(0, 12, true);

/**
 * Every effect the Forge knows and the fields each may carry. Keyed by the
 * full effect union, so a new effect kind fails the typecheck here until it
 * has a rule. Fields with no editor (a token's starting marks, a branch's
 * target index) keep the catalog's own values.
 */
export const OP_RULES: Record<OpKind, Record<string, OpFieldRule>> = {
  damage: {
    n: { kind: 'intOrX', min: 0, max: 10 },
    to: ENUM(['target', 'opponent', 'controller', 'eachCreature', 'eachOpponentCreature']),
    targetIndex: TARGET_INDEX,
    severOnDeath: { kind: 'flag', optional: true },
  },
  gainLife: { n: COUNT(0, 20) },
  loseLife: { n: COUNT(0, 20), who: ENUM(['opponent'], true) },
  draw: { n: COUNT(0, 20) },
  discardRandom: { n: COUNT(0, 20), who: ENUM(['opponent'], true) },
  discard: { n: COUNT(0, 20), who: ENUM(['self'], true) },
  sacrifice: { who: ENUM(['opponent', 'each']), n: COUNT(1, 1) },
  tapAll: { who: ENUM(['opponent'], true) },
  preventCombatTo: TO_TARGET,
  reclaimSelf: {},
  destroy: TO_TARGET,
  sever: TO_TARGET,
  severGrave: { n: COUNT(0, 30), who: ENUM(['self', 'opponent']) },
  severTop: { n: COUNT(0, 30), who: ENUM(['self'], true) },
  recall: TO_TARGET,
  destroyArtifactOrSeverEnchantment: TO_TARGET,
  cancel: TO_TARGET,
  boost: {
    p: STAT,
    t: STAT,
    scope: ENUM(['target', 'self', 'allYours', 'all', 'yourMarked', 'theirMarked']),
    keywords: { kind: 'keywords', optional: true },
    targetIndex: TARGET_INDEX,
  },
  addCounters: { n: COUNT(1, 12), to: ENUM(['target', 'self']), targetIndex: TARGET_INDEX },
  fetchLand: {},
  markAll: { scope: ENUM(['yourCreatures'], true), other: { kind: 'flag', optional: true } },
  moveMark: {},
  removeMarks: TO_TARGET,
  severSelf: {},
  loseLifePerTheirMarked: { who: ENUM(['opponent'], true) },
  ifTargetMarked: { then: { kind: 'ops' }, else: { kind: 'ops', optional: true }, targetIndex: TARGET_INDEX },
  tap: TO_TARGET,
  propagate: {},
  extraLandDrop: { n: COUNT(1, 9, true) },
  createToken: { token: { kind: 'token' }, count: COUNT(1, 12), marks: MARKS },
  destroyNewestOpponentArtifactOrEnchantment: {},
  massDestroy: { filter: ENUM(['allCreatures', 'allFliers', 'allEnchantments']) },
  preventCombat: {},
  reclaim: { targetIndex: TARGET_INDEX },
  grind: { n: COUNT(0, 30), who: ENUM(['self', 'opponent']) },
  foresee: { n: COUNT(0, 20), who: ENUM(['targetOwner'], true), targetIndex: TARGET_INDEX },
  awaken: { scope: ENUM(['self', 'allYours']) },
  raise: { to: ENUM(['target', 'top'], true), grantKeywords: { kind: 'keywords', optional: true }, targetIndex: TARGET_INDEX, withMarks: MARKS },
};

/** The editors' range for one numeric effect field, if it has one. */
export function opFieldRange(kind: OpKind, field: string): { min: number; max: number } | undefined {
  const rule = OP_RULES[kind]?.[field];
  return rule && (rule.kind === 'int' || rule.kind === 'intOrX') ? { min: rule.min, max: rule.max } : undefined;
}

function readKeywords(value: unknown): Keyword[] {
  return distinct(value, KEYWORDS, 'keyword');
}

function readOp(raw: unknown, depth: number): ScorableEffectOp {
  if (!isPlainObject(raw)) return fail('shape');
  const kind = raw.op;
  if (typeof kind !== 'string' || !Object.hasOwn(OP_RULES, kind)) return fail('effect');
  const rules = OP_RULES[kind as OpKind];
  for (const key of Object.keys(raw)) if (key !== 'op' && !Object.hasOwn(rules, key)) fail('field');
  const out: Json = { op: kind };
  for (const [field, rule] of Object.entries(rules)) {
    const value = raw[field];
    if (value === undefined) {
      if (!('optional' in rule && rule.optional)) fail('shape');
      continue;
    }
    switch (rule.kind) {
      case 'int': out[field] = int(value, rule.min, rule.max); break;
      case 'intOrX': out[field] = value === 'X' ? 'X' : int(value, rule.min, rule.max); break;
      case 'enum': out[field] = oneOf(value, rule.values); break;
      case 'flag': out[field] = oneOf(value, [true, false]); break;
      case 'keywords': out[field] = readKeywords(value); break;
      case 'ops': out[field] = readOps(value, depth + 1); break;
      case 'token': out[field] = oneOf(value, TOKEN_IDS, 'token'); break;
    }
  }
  return out as ScorableEffectOp;
}

function readOps(value: unknown, depth = 1): ScorableEffectOp[] {
  if (depth > FORGE_LIMITS.branchDepth) fail('size');
  return array(value, FORGE_LIMITS.opsPerList).map((op) => readOp(op, depth));
}

// ── Costs, abilities and card-level parts ───────────────────────────────────

function readCost(value: unknown): ManaCost {
  const raw = object(value, ['generic', 'pips']);
  const pipsRaw = object(raw.pips ?? {}, COLOR_ORDER);
  const pips: ManaCost['pips'] = {};
  for (const color of COLOR_ORDER) {
    if (pipsRaw[color] !== undefined) pips[color] = int(pipsRaw[color], 0, FORGE_LIMITS.pip);
  }
  return { generic: int(raw.generic, 0, FORGE_LIMITS.generic), pips };
}

function readTargets(value: unknown): TargetSpec[] {
  return array(value, 2).map((item) => {
    const raw = object(item, ['what', 'other', 'upTo']);
    return {
      what: oneOf(raw.what, TARGET_WHATS, 'target'),
      ...(raw.other !== undefined ? { other: oneOf(raw.other, [true] as const) } : {}),
      ...(raw.upTo !== undefined ? { upTo: oneOf(raw.upTo, [2] as const) } : {}),
    };
  });
}

function readCondition(value: unknown): ScorableCondition {
  if (typeof value === 'string') return oneOf(value, ['questActive', 'controlMarked', 'creatureDiedThisTurn'] as const, 'trigger');
  const raw = object(value, ['kind', 'n', 'subject', 'subtype']);
  if (raw.kind === 'markedThreshold') {
    if (raw.subtype !== undefined) fail('field');
    return {
      kind: 'markedThreshold',
      n: int(raw.n, 1, FORGE_LIMITS.thresholdCount),
      ...(raw.subject !== undefined ? { subject: oneOf(raw.subject, ['creatures', 'permanents'] as const) } : {}),
    };
  }
  if (raw.kind === 'controlsOther') {
    if (raw.n !== undefined || raw.subject !== undefined) fail('field');
    return { kind: 'controlsOther', subtype: text(raw.subtype, 0, FORGE_LIMITS.filterSubtypeLength) };
  }
  return fail('trigger');
}

function readStatic(value: unknown): StaticDef {
  const raw = object(value, ['scope', 'condition', 'filter', 'p', 't', 'grantKeywords']);
  const out: StaticDef = { scope: oneOf(raw.scope, ['self', 'attached', 'filter'] as const) };
  if (raw.condition !== undefined) out.condition = oneOf(raw.condition, ['questActive'] as const, 'trigger');
  if (raw.filter !== undefined) {
    const filter = object(raw.filter, ['subtype', 'other', 'marked', 'token', 'who']);
    out.filter = {
      ...(filter.subtype !== undefined ? { subtype: text(filter.subtype, 0, FORGE_LIMITS.filterSubtypeLength) } : {}),
      ...(filter.other !== undefined ? { other: oneOf(filter.other, [true, false]) } : {}),
      ...(filter.marked !== undefined ? { marked: oneOf(filter.marked, [true] as const) } : {}),
      ...(filter.token !== undefined ? { token: oneOf(filter.token, [true] as const) } : {}),
      ...(filter.who !== undefined ? { who: oneOf(filter.who, ['yours', 'opponent'] as const) } : {}),
    };
  }
  if (raw.p !== undefined) out.p = int(raw.p, -FORGE_LIMITS.statChange, FORGE_LIMITS.statChange);
  if (raw.t !== undefined) out.t = int(raw.t, -FORGE_LIMITS.statChange, FORGE_LIMITS.statChange);
  if (raw.grantKeywords !== undefined) out.grantKeywords = readKeywords(raw.grantKeywords);
  return out;
}

function readAbility(value: unknown): ScorableAbilityDef {
  const raw = object(value, ['when', 'condition', 'targets', 'ops', 'filter', 'oncePerTurn', 'static']);
  const out: ScorableAbilityDef = { when: oneOf(raw.when, TRIGGERS, 'trigger') };
  if (raw.condition !== undefined) out.condition = readCondition(raw.condition);
  if (raw.targets !== undefined) out.targets = readTargets(raw.targets);
  if (raw.ops !== undefined) out.ops = readOps(raw.ops);
  if (raw.filter !== undefined) {
    const filter = object(raw.filter, ['other', 'subtype', 'sacrifice']);
    out.filter = {
      ...(filter.other !== undefined ? { other: oneOf(filter.other, [true] as const) } : {}),
      ...(filter.subtype !== undefined ? { subtype: text(filter.subtype, 1, FORGE_LIMITS.filterSubtypeLength) } : {}),
      ...(filter.sacrifice !== undefined ? { sacrifice: oneOf(filter.sacrifice, [true] as const) } : {}),
    };
  }
  if (raw.oncePerTurn !== undefined) out.oncePerTurn = oneOf(raw.oncePerTurn, [true] as const);
  if (raw.static !== undefined) out.static = readStatic(raw.static);
  return out;
}

function readDuty(value: unknown): ScorableActivated {
  const raw = object(value, ['cost', 'ops', 'targets']);
  const cost = object(raw.cost, ['tap', 'mana']);
  oneOf(cost.tap, [true] as const);
  return {
    cost: cost.mana !== undefined ? { tap: true, mana: readCost(cost.mana) } : { tap: true },
    ops: readOps(raw.ops),
    ...(raw.targets !== undefined ? { targets: readTargets(raw.targets) } : {}),
  };
}

function readStatBlock(value: unknown, keywordField: 'grantKeywords' | 'keywords'): { p?: number; t?: number } & Partial<Record<typeof keywordField, Keyword[]>> {
  const raw = object(value, ['p', 't', keywordField]);
  return {
    ...(raw.p !== undefined ? { p: int(raw.p, -FORGE_LIMITS.statChange, FORGE_LIMITS.statChange) } : {}),
    ...(raw.t !== undefined ? { t: int(raw.t, -FORGE_LIMITS.statChange, FORGE_LIMITS.statChange) } : {}),
    ...(raw[keywordField] !== undefined ? { [keywordField]: readKeywords(raw[keywordField]) } : {}),
  };
}

const CARD_FIELDS = [
  'id', 'name', 'types', 'subtypes', 'supertypes', 'cost', 'colors', 'attack', 'defense', 'keywords', 'x',
  'abilities', 'empower', 'rite', 'nineLives', 'preserve', 'skim', 'retell', 'hauntlink', 'awakening',
  'chapters', 'manaAbility', 'entersTapped', 'activated', 'whispers', 'tithe', 'rarity', 'set',
] as const satisfies readonly (keyof ScorableCardDef)[];

/**
 * Fields a card may bring that the Forge reads past and never keeps. Flavor
 * text is removed from the whole game (owner ruling R13, 2026-09-25,
 * docs/plan-1.9.md), so no Forge card, export or link carries it; a card
 * copied from game data that still has some imports without it rather than
 * being refused.
 */
const DISCARDED_CARD_FIELDS = ['flavor'] as const;

/** A per-set card id: lowercase letters, digits and hyphens. */
export const CARD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

function readCard(value: unknown): ScorableCardDef {
  const raw = object(value, [...CARD_FIELDS, ...DISCARDED_CARD_FIELDS]);
  const types = distinct(raw.types, CARD_TYPES, 'type', FORGE_LIMITS.types);
  if (types.length === 0) fail('type');
  const card: ScorableCardDef = {
    id: typeof raw.id === 'string' && CARD_ID_PATTERN.test(raw.id) ? raw.id : 'forge-card',
    name: text(raw.name, 1, FORGE_LIMITS.nameLength, 'name'),
    types,
    subtypes: array(raw.subtypes ?? [], FORGE_LIMITS.subtypes).map((subtype) => text(subtype, 1, FORGE_LIMITS.subtypeLength)),
    colors: distinct(raw.colors ?? [], COLOR_ORDER, 'color') as Color[],
    rarity: oneOf(raw.rarity, RARITIES, 'rarity'),
    set: (raw.set === undefined ? 'base' : oneOf(raw.set, SETS, 'set')) as ScorableCardDef['set'],
  };
  if (raw.supertypes !== undefined) card.supertypes = distinct(raw.supertypes, ['legendary'] as const, 'type');
  if (raw.cost !== undefined) card.cost = readCost(raw.cost);
  if (raw.attack !== undefined) card.attack = int(raw.attack, 0, FORGE_LIMITS.stat);
  if (raw.defense !== undefined) card.defense = int(raw.defense, 0, FORGE_LIMITS.stat);
  if (raw.keywords !== undefined) card.keywords = readKeywords(raw.keywords);
  if (raw.x !== undefined) {
    const x = object(raw.x, ['min', 'max']);
    card.x = {
      ...(x.min !== undefined ? { min: int(x.min, 0, 20) } : {}),
      ...(x.max !== undefined ? { max: int(x.max, 0, 20) } : {}),
    } as NonNullable<ScorableCardDef['x']>;
  }
  if (raw.abilities !== undefined) card.abilities = array(raw.abilities, FORGE_LIMITS.abilities).map(readAbility);
  if (raw.empower !== undefined) {
    const empower = object(raw.empower, ['cost', 'ops']);
    card.empower = { cost: readCost(empower.cost), ops: readOps(empower.ops) };
  }
  if (raw.rite !== undefined) card.rite = { n: int(object(raw.rite, ['n']).n, 1, FORGE_LIMITS.riteSacrifices) };
  if (raw.nineLives !== undefined) card.nineLives = oneOf(raw.nineLives, [true] as const);
  if (raw.preserve !== undefined) card.preserve = { cost: readCost(object(raw.preserve, ['cost']).cost) };
  if (raw.skim !== undefined) card.skim = { cost: readCost(object(raw.skim, ['cost']).cost) };
  if (raw.retell !== undefined) {
    const retell = object(raw.retell, ['cost', 'ops']);
    card.retell = { cost: readCost(retell.cost), ...(retell.ops !== undefined ? { ops: readOps(retell.ops) } : {}) };
  }
  if (raw.hauntlink !== undefined) {
    const hauntlink = object(raw.hauntlink, ['cost', 'linked']);
    card.hauntlink = { cost: readCost(hauntlink.cost), linked: readStatBlock(hauntlink.linked, 'grantKeywords') };
  }
  if (raw.awakening !== undefined) card.awakening = readStatBlock(raw.awakening, 'keywords');
  if (raw.chapters !== undefined) card.chapters = array(raw.chapters, FORGE_LIMITS.chapters).map((chapter) => readOps(chapter));
  if (raw.manaAbility !== undefined) card.manaAbility = distinct(raw.manaAbility, [...COLOR_ORDER, 'C'] as const, 'color');
  if (raw.entersTapped !== undefined) card.entersTapped = oneOf(raw.entersTapped, [true] as const);
  if (raw.activated !== undefined) {
    card.activated = Array.isArray(raw.activated)
      ? array(raw.activated, FORGE_LIMITS.duties).map(readDuty)
      : readDuty(raw.activated);
    if (Array.isArray(card.activated) && card.activated.length === 0) fail('shape');
  }
  if (raw.whispers !== undefined) card.whispers = { cost: readCost(object(raw.whispers, ['cost']).cost) };
  if (raw.tithe !== undefined) card.tithe = { per: oneOf(object(raw.tithe, ['per']).per, [2] as const) };
  return card;
}

/** A JSON round trip: drops `undefined` fields the way an export does. */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The card as the builder would produce it: loaded into the editors and
 * converted back. For a card the Forge built, this changes nothing.
 */
export function canonicalCard(card: ScorableCardDef): ScorableCardDef {
  return jsonClone(toCardDef(fromCardDef(card)));
}

export type CardCheck =
  | { ok: true; card: ScorableCardDef }
  | { ok: false; reason: SkipReason };

/** Validate one card from outside the page, and return it in canonical form. */
export function validateCard(value: unknown): CardCheck {
  try {
    return { ok: true, card: canonicalCard(readCard(value)) };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, reason: error.reason };
    return { ok: false, reason: 'shape' };
  }
}

// ── Entries (a card plus its art and look) ──────────────────────────────────

export interface ForgeAppearance {
  frame: FrameChoice;
  holo: HoloChoice;
  fullArt: boolean;
}

export interface ForgeEntry {
  card: ScorableCardDef;
  /**
   * The card's art: the catalog card whose art it borrows (`donor`), and the
   * player's own image when it has one (`custom`, see customArt.ts). The donor
   * stays set under a custom image: it is what a share link opens with. Any
   * other field in `art` is ignored on import.
   */
  art: { donor: string; custom?: CustomArt };
  appearance: ForgeAppearance;
}

export const DEFAULT_APPEARANCE: ForgeAppearance = { frame: 'default', holo: 'default', fullArt: false };

/** A catalog card id whose art the Forge can show, or the default donor. */
export function artDonorOrDefault(value: unknown): string {
  return typeof value === 'string' && DONOR_IDS.has(value) ? value : DEFAULT_ART_DONOR;
}

/** The look is cosmetic: anything unreadable falls back to the default look. */
function readAppearance(value: unknown): ForgeAppearance {
  if (!isPlainObject(value)) return { ...DEFAULT_APPEARANCE };
  return {
    frame: (FRAME_CHOICES as readonly unknown[]).includes(value.frame) ? value.frame as FrameChoice : DEFAULT_APPEARANCE.frame,
    holo: (HOLO_CHOICES as readonly unknown[]).includes(value.holo) ? value.holo as HoloChoice : DEFAULT_APPEARANCE.holo,
    fullArt: value.fullArt === true,
  };
}

export type EntryCheck =
  /** `imageProblem`: the card's own image was unreadable, so it keeps its game art. */
  | { ok: true; entry: ForgeEntry; imageProblem?: true }
  | { ok: false; reason: SkipReason; name: string | null };

/**
 * What a card's own image may be where the entry comes from: an image id (the
 * autosave), an image data URL (a set file), or nothing at all (a share link,
 * which never carries one: any `art.custom` in it is dropped).
 */
export type CustomImageSource = CustomImageForm | 'none';

/** A readable name for a refused card, if it has one. */
function claimedName(value: unknown): string | null {
  if (!isPlainObject(value) || !isPlainObject(value.card)) return null;
  const name = value.card.name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, FORGE_LIMITS.nameLength) : null;
}

/**
 * Validate one set entry (`{ card, art, appearance }`, plus an optional
 * `score` that is ignored: scores are always recomputed). The card must pass;
 * an unknown art donor falls back to the default donor, an unreadable look
 * to the default look, and an unreadable own image (`art.custom`) is left off,
 * so the card keeps its game art and says so (`imageProblem`).
 */
export function validateEntry(value: unknown, customImage: CustomImageSource = 'none'): EntryCheck {
  if (!isPlainObject(value)) return { ok: false, reason: 'shape', name: null };
  for (const key of Object.keys(value)) {
    if (!['card', 'art', 'appearance', 'score'].includes(key)) return { ok: false, reason: 'field', name: claimedName(value) };
  }
  const checked = validateCard(value.card);
  if (!checked.ok) return { ok: false, reason: checked.reason, name: claimedName(value) };
  const rawArt = isPlainObject(value.art) ? value.art : {};
  const art: ForgeEntry['art'] = { donor: artDonorOrDefault(rawArt.donor) };
  let imageProblem = false;
  if (customImage !== 'none' && rawArt.custom !== undefined) {
    const custom = readCustomArt(rawArt.custom, customImage);
    if (custom) art.custom = custom;
    else imageProblem = true;
  }
  const entry: ForgeEntry = { card: checked.card, art, appearance: readAppearance(value.appearance) };
  return imageProblem ? { ok: true, entry, imageProblem: true } : { ok: true, entry };
}
