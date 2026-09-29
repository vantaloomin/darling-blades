import type { RngState } from './rng';

export type PlayerId = 0 | 1;
export type Color = 'W' | 'U' | 'B' | 'R' | 'G';
export type ManaColor = Color | 'C';

export type Keyword =
  | 'skyborne'
  | 'wardingGaze'
  | 'firstBlade'
  | 'twinBlades'
  | 'warcry'
  | 'overrun'
  | 'sentinel'
  | 'bulwark'
  | 'deathblade'
  | 'bloodoath'
  | 'untouchable'
  | 'dreaded'
  | 'rage';

export type CardType = 'creature' | 'charm' | 'ritual' | 'enchantment' | 'artifact' | 'land';
export type Rarity = 'c' | 'r' | 'sr' | 'ssr' | 'ur';

export interface ManaCost {
  generic: number;
  pips: Partial<Record<Color, number>>;
}

// ---------------------------------------------------------------------------
// Effects — data-driven descriptors interpreted by the EffectInterpreter.
// Targeted triggers defer their mandatory choice under their controller.
// A spell's sole upTo or exactly spec fans ops across independently chosen targets.
// ---------------------------------------------------------------------------

export type TriggerWhen =
  | 'spell' // charm/ritual body, runs on resolution
  | 'arrives'
  | 'dies'
  | 'entersGraveyard'
  | 'dawn'
  | 'combatDamageToPlayer'
  | 'attacks'
  | 'allyCreatureArrives'
  | 'gainsMark'
  | 'yourCreatureMarked'
  | 'yourPermanentMarked'
  | 'youAddMark'
  | 'otherCreatureMarked'
  | 'propagated'
  | 'markedAllyAttacks'
  | 'allyDies'
  | 'youGainLife'
  | 'youCastCharm'
  | 'allyAttacks'
  | 'sunset'
  /**
   * Provoked: this creature was dealt more than 0 damage and survived the
   * state-based check that followed. Fired from that check, after its deaths
   * and their dies triggers; at most once each turn per creature, without a
   * printed `oncePerTurn` (plan-first-dawn-engine.md, Part 1).
   */
  | 'provoked'
  | 'static';

export interface TargetSpec {
  /**
   * `artifact` and `enchantment` match that permanent type, including a
   * multi-typed permanent. `artifactOrEnchantment` is the tight union used by
   * cross-type removal. Untouchable remains a creature-targeting restriction:
   * these specs do not consult it, even for an artifact creature.
   */
  what:
    | 'creature'
    | 'player'
    | 'any'
    | 'spell'
    | 'yourCreature'
    | 'opponentCreature'
    | 'yourPermanent'
    | 'yourGraveCreature'
    | 'artifact'
    | 'enchantment'
    | 'artifactOrEnchantment';
  /** Excludes the ability's source permanent. */
  other?: true;
  /** Spell-side "up to N targets"; deferred triggers choose one target. */
  upTo?: 2;
  exactly?: 2;
  maxCost?: number;
  minAttack?: number;
  /** Restricts legal targets to creatures carrying at least one mark. */
  marked?: true;
  /** Restricts legal targets to tapped permanents. */
  tapped?: true;
  /**
   * `creature` specs only: "a creature an opponent controls if able, else
   * another creature you control". While any creature an opponent controls is
   * a legal target (Untouchable and every other qualifier applied), only those
   * are legal; only when none is are the caster's own creatures, never the
   * source itself. The target rule of a mandatory source-bound Hunt trigger
   * (the owner's E6 ruling, 2026-09-29).
   */
  opponentIfAble?: true;
}

/**
 * Hunt (`hunt`): the hunter and its prey each deal damage equal to their
 * Attack to the other, through the shared creature-damage path. `self`: the
 * source permanent hunts the bound target (an arrival or attack trigger, a
 * Duty, an Empower rider). `target`: target slot 0 hunts target slot 1 (a
 * spell). The op's own rules: the two are different creatures and the hunter
 * has no Bulwark; otherwise nothing is dealt.
 */
export type EffectOp =
  | { op: 'damage'; n: number | 'X'; to: 'target' | 'opponent' | 'controller'; targetIndex?: number }
  | { op: 'damage'; n: number | 'X'; to: 'eachCreature' | 'eachOpponentCreature'; severOnDeath?: true }
  | { op: 'damage'; n: number | 'X'; to: 'eachYourCreature'; other?: true } // damage each [other] creature you control; `other` spares the source
  | { op: 'gainLife'; n: number }
  | { op: 'loseLife'; n: number; who: 'opponent' }
  | { op: 'draw'; n: number }
  | { op: 'discard'; n: number; who: 'self' }
  | { op: 'sacrifice'; who: 'opponent' | 'each'; n: 1 }
  | { op: 'tapAll'; who: 'opponent' }
  | { op: 'preventCombatTo'; to: 'target'; targetIndex?: number }
  | { op: 'reclaimSelf' }
  | { op: 'discardRandom'; n: number; who: 'opponent' }
  | { op: 'destroy'; to: 'target'; targetIndex?: number } // target permanent → its owner's graveyard
  | { op: 'sever'; to: 'target'; targetIndex?: number } // target permanent → its owner's severed zone
  | { op: 'severGrave'; n: number; who: 'self' | 'opponent' } // top n grave cards → severed zone
  | { op: 'severTop'; n: number; who: 'self' } // top n deck cards → severed zone
  | { op: 'recall'; to: 'target'; targetIndex?: number } // target permanent → its owner's hand; tokens evaporate
  | {
      op: 'destroyArtifactOrSeverEnchantment';
      to: 'target';
      targetIndex?: number;
    } // branch is artifact-first; otherwise an enchantment is severed
  | { op: 'cancel'; to: 'target'; targetIndex?: number } // target is a stack item
  | { op: 'boost'; p: number; t: number; keywords?: Keyword[]; scope: 'target' | 'self' | 'allYours' | 'all' | 'yourMarked' | 'theirMarked'; targetIndex?: number }
  | { op: 'addCounters'; n: number; to: 'target' | 'self'; targetIndex?: number }
  | { op: 'propagate' } // +1 Mark on each ALREADY-Marked creature you control; starts none, no target
  | { op: 'moveMark' } // move one mark from targets[0] to targets[1]
  | { op: 'removeMarks'; to: 'target'; targetIndex?: number }
  | { op: 'markAll'; scope: 'yourCreatures'; other?: true }
  | { op: 'loseLifePerTheirMarked'; who: 'opponent' }
  | { op: 'fetchLand' }
  | { op: 'ifTargetMarked'; then: EffectOp[]; else?: EffectOp[]; targetIndex?: number }
  | { op: 'severSelf' }
  | { op: 'tap'; to: 'target'; targetIndex?: number }
  | { op: 'extraLandDrop'; n?: number } // grant the controller extra land drops this turn
  | { op: 'createToken'; token: string; count: number; marks?: number }
  | { op: 'destroyNewestOpponentArtifactOrEnchantment' } // trigger-safe, no target
  | { op: 'massDestroy'; filter: 'allCreatures' | 'allFliers' | 'allEnchantments' }
  | { op: 'preventCombat' } // prevent all combat damage this turn
  | { op: 'reclaim'; targetIndex?: number } // return target creature card from your graveyard to hand
  | { op: 'grind'; n: number; who: 'self' | 'opponent' } // top n of deck → graveyard
  | { op: 'foresee'; n: number; who?: 'targetOwner'; targetIndex?: number } // look at top n, then choose any subset to bottom
  | { op: 'awaken'; scope: 'self' | 'allYours' } // one-way champion upgrade; trigger-safe
  | { op: 'raise'; to?: 'target'; grantKeywords?: Keyword[]; targetIndex?: number }
  | { op: 'raise'; to: 'top'; withMarks?: number; grantKeywords?: Keyword[] }
  | { op: 'hunt'; hunter: 'self' | 'target' }; // see the Hunt note above the union

export interface StaticDef {
  /** `questActive` reads the source controller's public battlefield. */
  condition?: 'questActive';
  scope: 'self' | 'attached' | 'filter';
  /** filter scope: your creatures matching; `other` excludes the source. */
  filter?: {
    subtype?: string;
    other?: boolean;
    marked?: true;
    token?: true;
    who?: 'yours' | 'opponent';
  };
  p?: number;
  t?: number;
  grantKeywords?: Keyword[];
}

export interface AbilityDef {
  when: TriggerWhen;
  /** A triggered ability fires at most once on each player's turn per source permanent. */
  oncePerTurn?: true;
  /** The source controller must control a CardDef with `chapters` present. */
  condition?:
    | 'questActive'
    | 'controlMarked'
    | 'creatureDiedThisTurn'
    | { kind: 'controlsOther'; subtype: string }
    // `permanents` remains a replay-compatible legacy value. Mark conditions
    // are creature-scoped regardless of this subject field.
    | { kind: 'markedThreshold'; n: number; subject: 'permanents' | 'creatures' };
  targets?: TargetSpec[];
  filter?: { other?: true; subtype?: string; sacrifice?: true };
  ops?: EffectOp[];
  static?: StaticDef;
}

/**
 * Optional Empower rider. The extra cost is paid as part of casting the card,
 * and the ops run after the card's normal resolution. Empower ops are required
 * to be trigger-safe. Targeted riders may move Marks, reclaim, or destroy.
 * The engine keeps this contract explicit here because there is no separate
 * data-validation pass.
 */
export interface EmpowerDef {
  cost: ManaCost;
  /** Two cast-time specs for moveMark, one for reclaim or destroy. */
  targets?: TargetSpec[];
  ops: EffectOp[];
}

/** Hand-side activated discard-to-draw action. Skim never uses the stack. */
export interface SkimDef {
  cost: ManaCost;
}

/**
 * Optional alternative-cost graveyard cast. Retell ops, when present, replace
 * the printed body and use their own optional targets. Creature overrides
 * resolve as spells and sever instead of entering the battlefield.
 */
export interface RetellDef {
  cost: ManaCost;
  ops?: EffectOp[];
  targets?: TargetSpec[];
}

/** Fresh-graveyard alternative cost, available until the opponent's next Dawn. */
export interface WhispersDef {
  cost: ManaCost;
}

/** Optional creature sacrifices discount one generic per two combined Defense. */
export interface TitheDef {
  per: 2;
}

/** Additional creature-sacrifice cost paid while casting the card. */
export interface RiteDef {
  n: number;
}

/** Main-phase graveyard activation that creates a token copy of this creature. */
export interface PreserveDef {
  cost: ManaCost;
}

/** A tap-cost activated ability; cards may expose an ordered list of Duties. */
export interface ActivatedDef {
  cost: { tap: true; mana?: ManaCost };
  /** Run immediately in order, with this permanent as the source. */
  ops: EffectOp[];
  /** Chosen inline when activating, using the spell target rules. */
  targets?: TargetSpec[];
}

/** Alternate linked cast for a noncreature Artifact or Enchantment. */
export interface HauntlinkDef {
  cost: ManaCost;
  /** The printed Linked rider, applied as an attached static to the host. */
  linked: {
    p?: number;
    t?: number;
    grantKeywords?: Keyword[];
  };
}

export function effectOpUsesTarget(op: EffectOp): boolean {
  switch (op.op) {
    case 'damage':
      return op.to === 'target';
    case 'destroy':
    case 'sever':
    case 'recall':
    case 'destroyArtifactOrSeverEnchantment':
    case 'cancel':
    case 'tap':
    case 'preventCombatTo':
      return op.to === 'target';
    case 'boost':
      return op.scope === 'target';
    case 'addCounters':
      return op.to === 'target';
    case 'moveMark':
    case 'removeMarks':
    case 'reclaim':
    case 'hunt':
      return true;
    case 'raise':
      return op.to !== 'top';
    case 'ifTargetMarked':
      return true;
    case 'foresee':
      return op.who === 'targetOwner';
    default:
      return false;
  }
}

const MARK_EVENT_WHENS = new Set<TriggerWhen>([
  'gainsMark',
  'yourCreatureMarked',
  'yourPermanentMarked',
  'youAddMark',
  'otherCreatureMarked',
  'propagated',
  'markedAllyAttacks',
]);

function effectOpAddsMark(op: EffectOp): boolean {
  if (op.op === 'addCounters' || op.op === 'markAll' || op.op === 'propagate' || op.op === 'moveMark') {
    return true;
  }
  if (op.op !== 'ifTargetMarked') return false;
  return op.then.some(effectOpAddsMark) || (op.else ?? []).some(effectOpAddsMark);
}

/**
 * Catalog-facing validation for the narrowly relaxed Empower target contract.
 * Empower riders are target-free except four named shapes:
 *   - `moveMark` carries exactly two single-target specs (from, to);
 *   - `reclaim` carries exactly one `yourGraveCreature` spec (Renenutet, Who
 *     Measures the Flood, 2026-09-04 rework);
 *   - `destroy` carries one target spec, including cost/attack qualifiers;
 *   - `hunt` (the creature hunts, `hunter: 'self'`) carries one single-target
 *     spec, exactly as `destroy` does (the owner's E4 ruling). Hunt damage only
 *     marks damage; the deaths follow in the state-based check after the
 *     stack item, so the rider stays trigger-safe.
 */
export function validateEmpowerDef(d: CardDef): string[] {
  if (!d.empower) return [];
  const errors: string[] = [];
  const targets = d.empower.targets;
  const hasMoveMark = d.empower.ops.some((op) => op.op === 'moveMark');
  const hasReclaim = d.empower.ops.some((op) => op.op === 'reclaim');
  const hasDestroy = d.empower.ops.some((op) => op.op === 'destroy');
  const hunts = d.empower.ops.filter((op) => op.op === 'hunt');
  if (hasMoveMark && hasReclaim) {
    errors.push('Empower may not combine moveMark and reclaim');
  }
  if (hasMoveMark) {
    if (!targets) {
      errors.push('Empower moveMark needs target specs');
    } else if (targets.length !== 2 || targets.some((target) => target.upTo !== undefined)) {
      errors.push('Empower moveMark needs exactly two single-target specs');
    }
  } else if (hasReclaim) {
    if (!targets || targets.length !== 1 || targets[0].what !== 'yourGraveCreature' || targets[0].upTo !== undefined) {
      errors.push('Empower reclaim needs exactly one yourGraveCreature target spec');
    }
  } else if (hasDestroy) {
    if (!targets || targets.length !== 1 || targets[0].upTo || targets[0].exactly) errors.push('Empower destroy needs one single-target spec');
  } else if (hunts.length > 0) {
    if (!targets || targets.length !== 1 || targets[0].upTo || targets[0].exactly) errors.push('Empower hunt needs one single-target spec');
  } else if (targets) {
    errors.push('Empower targets require a moveMark, reclaim, destroy or hunt op');
  }
  if (hunts.length > 0 && (hasMoveMark || hasReclaim || hasDestroy)) {
    errors.push('Empower hunt cannot combine with another targeted op');
  }
  if (hunts.some((op) => op.op === 'hunt' && op.hunter !== 'self') || (hunts.length > 0 && !isType(d, 'creature'))) {
    errors.push('Empower hunt is the creature itself hunting (hunter self, on a creature)');
  }
  if (d.empower.ops.some((op) => effectOpUsesTarget(op) && op.op !== 'moveMark' && op.op !== 'reclaim' && op.op !== 'destroy' && op.op !== 'hunt')) {
    errors.push('Only moveMark, reclaim, destroy and hunt may target from Empower');
  }
  return errors;
}

/** Catalog-facing validation for mark-event triggers, which must not recurse. */
export function validateMarkTriggerDef(d: CardDef): string[] {
  const errors: string[] = [];
  for (const ability of d.abilities ?? []) {
    if (ability.when === 'allyCreatureArrives') {
      // This observer is intentionally exempt: Orbital Graft auto-binds the
      // arriving creature, and marking it cannot recurse through arrival because
      // this observer fires only once for the original arrival. Any resulting
      // mark-event cascade still carries the runtime depth guard.
      continue;
    }
    if (!MARK_EVENT_WHENS.has(ability.when) || !ability.ops?.some(effectOpAddsMark)) continue;
    errors.push(`${ability.when} abilities cannot add marks`);
  }
  return errors;
}

/** Catalog-facing validation for Provoked: printed on creatures only, at most one per card. */
export function validateProvokedDef(d: CardDef): string[] {
  const provoked = (d.abilities ?? []).filter((ability) => ability.when === 'provoked');
  if (provoked.length === 0) return [];
  const errors: string[] = [];
  if (!isType(d, 'creature')) errors.push('Provoked is printed on creatures only');
  if (provoked.length > 1) errors.push('A card has at most one Provoked ability');
  if (provoked.some((ability) => ability.oncePerTurn)) {
    errors.push('Provoked is once each turn by rule; it never sets oncePerTurn');
  }
  return errors;
}

function flatOps(list: readonly EffectOp[]): EffectOp[] {
  return list.flatMap((op) => op.op === 'ifTargetMarked' ? [op, ...flatOps(op.then), ...flatOps(op.else ?? [])] : [op]);
}

/**
 * Catalog-facing validation for the Hunt op's carriers. The spell form
 * (`hunter: 'target'`) is a Charm or Ritual body with exactly two single
 * creature specs, hunter first. The source-bound form (`hunter: 'self'`) is a
 * creature's triggered ability, Duty or Empower rider with one single-target
 * spec, never on a creature that prints Bulwark, and never a Provoked effect.
 * The E6 target rule (`opponentIfAble`) belongs on a `creature` spec only.
 */
export function validateHuntDef(d: CardDef): string[] {
  const errors: string[] = [];
  const check = (ops: readonly EffectOp[] | undefined, targets: readonly TargetSpec[] | undefined, where: 'spell' | 'bound'): void => {
    for (const op of flatOps(ops ?? [])) {
      if (op.op !== 'hunt') continue;
      if (op.hunter === 'target') {
        if (where !== 'spell') errors.push('A spell-form Hunt (hunter target) belongs on a Charm or Ritual body');
        if (!targets || targets.length !== 2 || targets.some((spec) => spec.upTo !== undefined || spec.exactly !== undefined ||
          spec.what === 'spell' || spec.what === 'player' || spec.what === 'yourGraveCreature')) {
          errors.push('A spell-form Hunt needs exactly two single creature target specs (hunter, prey)');
        }
      } else {
        if (!isType(d, 'creature')) errors.push('A source-bound Hunt belongs on a creature');
        if (where === 'spell') errors.push('A spell cannot hunt with itself');
        if ((d.keywords ?? []).includes('bulwark')) errors.push('A creature with Bulwark cannot print a source-bound Hunt');
        if (!targets || targets.length !== 1 || targets[0].upTo !== undefined || targets[0].exactly !== undefined) {
          errors.push('A source-bound Hunt needs one single-target spec');
        }
      }
    }
  };
  // A branch re-runs its ops against its one bound target, so a Hunt inside
  // one would never see its prey (or, spell-form, its second slot).
  const huntInBranch = (ops: readonly EffectOp[] | undefined): boolean => flatOps(ops ?? []).some((op) =>
    op.op === 'ifTargetMarked' && [...flatOps(op.then), ...flatOps(op.else ?? [])].some((inner) => inner.op === 'hunt'));
  if ((d.abilities ?? []).some((ability) => huntInBranch(ability.ops)) ||
    activatedAbilitiesOf(d).some((activation) => huntInBranch(activation.ops)) || huntInBranch(d.empower?.ops)) {
    errors.push('A Hunt cannot sit inside an If-marked branch');
  }
  // An empowered cast brings the Empower targets instead of the body's, so a
  // body Hunt would run on them.
  if (d.empower?.targets && (d.abilities ?? []).some((ability) => ability.when === 'spell' &&
    flatOps(ability.ops ?? []).some((op) => op.op === 'hunt' && op.hunter === 'target'))) {
    errors.push('A spell-form Hunt cannot share a card with Empower targets');
  }
  for (const ability of d.abilities ?? []) {
    if (ability.when === 'static') continue;
    if (ability.when === 'provoked' && flatOps(ability.ops ?? []).some((op) => op.op === 'hunt')) {
      errors.push('A Provoked effect never hunts');
    }
    check(ability.ops, ability.targets, ability.when === 'spell' ? 'spell' : 'bound');
  }
  for (const activation of activatedAbilitiesOf(d)) check(activation.ops, activation.targets, 'bound');
  if (d.empower) check(d.empower.ops, d.empower.targets, 'bound');
  const specs = [
    ...(d.abilities ?? []).flatMap((ability) => ability.targets ?? []),
    ...activatedAbilitiesOf(d).flatMap((activation) => activation.targets ?? []),
    ...(d.empower?.targets ?? []),
  ];
  if (specs.some((spec) => spec.opponentIfAble && spec.what !== 'creature')) {
    errors.push('opponentIfAble belongs on a creature target spec only');
  }
  return errors;
}

/** Catalog-facing validation for the target-free chapter authoring contract. */
export function validateChaptersDef(d: CardDef): string[] {
  return d.chapters !== undefined && d.retell !== undefined
    ? ['Cards with chapters cannot carry Retell']
    : [];
}

// ---------------------------------------------------------------------------
// Card definitions (static data). The engine receives a CardDb via the Game
// constructor — it never imports the catalog, so tests can inject tiny pools.
// ---------------------------------------------------------------------------

export interface CardDef {
  id: string;
  name: string;
  types: CardType[];
  /** Optional presentation-only replacement for the printed type line. */
  displayTypeLine?: string;
  subtypes: string[];
  supertypes?: ('legendary' | 'basic')[];
  cost?: ManaCost; // absent on lands
  colors: Color[];
  attack?: number;
  defense?: number;
  keywords?: Keyword[];
  x?: { min: number }; // X spells
  abilities?: AbilityDef[];
  /** Quest chapters are the source of truth for Quest identity and activation. */
  chapters?: EffectOp[][];
  /** One-way stat and keyword upgrade granted by an `awaken` op. */
  awakening?: { p?: number; t?: number; keywords?: Keyword[] };
  /** Optional additional cast cost and trigger-safe resolution rider. */
  empower?: EmpowerDef;
  /** Optional instant-speed hand action that discards this and draws one. */
  skim?: SkimDef;
  /** Optional alternative-cost cast from this card's graveyard. */
  retell?: RetellDef;
  /** Optional alternative cost after entering the graveyard from hand or deck. */
  whispers?: WhispersDef;
  /** Optional any-number creature sacrifice discount paid while casting. */
  tithe?: TitheDef;
  /** Optional additional cast cost that sacrifices controlled creatures. */
  rite?: RiteDef;
  /** Returns once after dying without a +1/+1 mark. */
  nineLives?: true;
  /** Optional main-phase activation from this card's graveyard. */
  preserve?: PreserveDef;
  /** Optional main-phase battlefield action with a mandatory tap cost. */
  activated?: ActivatedDef | ActivatedDef[];
  /** Optional alternative-cost cast that enters attached to a friendly creature. */
  hauntlink?: HauntlinkDef;
  manaAbility?: (Color | 'C')[]; // lands & mana creatures
  entersTapped?: boolean; // dual taplands
  rarity: Rarity;
  artRef?: string;
  token?: boolean; // non-collectible
  set?: 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters' | 'dark-tales' | 'yokai-nights' | 'drowned-deep'; // expansion grouping; absent ⇒ 'base' (stamped in catalog.buildDb)
}

export type CardDb = Readonly<Record<string, CardDef>>;

export function activatedAbilitiesOf(d: CardDef): readonly ActivatedDef[] {
  return d.activated ? (Array.isArray(d.activated) ? d.activated : [d.activated]) : [];
}

/**
 * Physical identity for one copy of a card. `cardId` is the only rules
 * identity; `variantKey` is opaque presentation metadata and is never read by
 * the rules or AI layers.
 */
export interface CardInstance {
  instanceId: number;
  cardId: string;
  variantKey: string | null;
  /** Graveyard-only Whispers deadline: the owner's opponent at entry time. */
  whispersUntilDawnOf?: PlayerId;
}

/** Compatibility inputs accepted by the engine boundary. */
export type CardEntry = string | CardInstance;

export function cardIdOf(card: CardEntry): string {
  return typeof card === 'string' ? card : card.cardId;
}

export function isCardInstance(card: CardEntry): card is CardInstance {
  return typeof card !== 'string';
}

export function variantKeyOf(card: CardEntry): string | null {
  return typeof card === 'string' ? null : card.variantKey;
}

export function def(db: CardDb, card: CardEntry): CardDef {
  const cardId = cardIdOf(card);
  const d = db[cardId];
  if (!d) throw new Error(`Unknown card id: ${cardId}`);
  return d;
}

export function isType(d: CardDef, t: CardType): boolean {
  return d.types.includes(t) || (t === 'enchantment' && d.chapters !== undefined);
}

/** Catalog-facing S4 validation. Invalid carriers are never silently treated as Hauntlink cards. */
export function validateHauntlinkDef(d: CardDef): string[] {
  if (!d.hauntlink) return [];
  const errors: string[] = [];
  if (!d.cost) errors.push('Hauntlink carrier needs a normal mana cost');
  if (isType(d, 'creature')) errors.push('Hauntlink carrier cannot be a creature');
  if (!isType(d, 'artifact') && !isType(d, 'enchantment')) {
    errors.push('Hauntlink carrier must be an Artifact or Enchantment');
  }
  if (d.subtypes.includes('Aura')) errors.push('Hauntlink carrier cannot be an Aura');
  if (d.x) errors.push('Hauntlink carrier cannot be X');
  if (d.empower) errors.push('Hauntlink carrier cannot combine with Empower');
  if (d.skim) errors.push('Hauntlink carrier cannot combine with Skim');
  if (d.retell) errors.push('Hauntlink carrier cannot combine with Retell');
  if (d.whispers) errors.push('Hauntlink carrier cannot combine with Whispers');
  if (d.tithe) errors.push('Hauntlink carrier cannot combine with Tithe');
  if ((d.abilities ?? []).some((ability) => ability.static?.scope === 'attached')) {
    errors.push('Hauntlink carrier cannot also carry an attached static');
  }
  if (
    d.hauntlink.linked.p === undefined &&
    d.hauntlink.linked.t === undefined &&
    (d.hauntlink.linked.grantKeywords?.length ?? 0) === 0
  ) {
    errors.push('Hauntlink carrier needs a Linked rider');
  }
  return errors;
}

/** Catalog-facing Rite validation; targeted effects choose before the sacrifice cost. */
export function validateRiteDef(d: CardDef): string[] {
  if (!d.rite) return [];
  const errors: string[] = [];
  if (!Number.isInteger(d.rite.n) || d.rite.n < 1) {
    errors.push('Rite count must be an integer of at least 1');
  }
  if (d.x) errors.push('Rite card cannot be X');
  if (d.retell) errors.push('Rite card cannot combine with Retell');
  if (d.hauntlink) errors.push('Rite card cannot combine with Hauntlink');
  if (d.whispers) errors.push('Rite card cannot combine with Whispers');
  if (d.tithe) errors.push('Rite card cannot combine with Tithe');
  if (d.skim) errors.push('Rite card cannot combine with Skim');
  if (
    d.subtypes.includes('Aura') ||
    (d.abilities ?? []).some(
      (ability) => ability.when !== 'static' && (ability.targets?.length ?? 0) > 0 && !ability.ops?.some(effectOpUsesTarget),
    )
  ) {
    errors.push('Rite card cannot have cast targets');
  }
  return errors;
}

/** Catalog-facing validation for the fresh-graveyard alternative cost. */
export function validateWhispersDef(d: CardDef): string[] {
  if (!d.whispers) return [];
  const errors: string[] = [];
  if (d.retell) errors.push('Whispers card cannot combine with Retell');
  if (d.rite) errors.push('Whispers card cannot combine with Rite');
  if (d.hauntlink) errors.push('Whispers card cannot combine with Hauntlink');
  // Whispers and Tithe coexist (owner ruling 2026-09-17): the sacrifice pays
  // down the generic part of the Whispers cost, exactly as it pays the printed one.
  if (d.x) errors.push('Whispers card cannot be X');
  const cost = d.whispers.cost;
  if (!cost) errors.push('Whispers needs a mana cost');
  else if (!Number.isInteger(cost.generic) || cost.generic < 0 ||
    Object.entries(cost.pips).some(([color, pip]) =>
      !['W', 'U', 'B', 'R', 'G'].includes(color) || !Number.isInteger(pip) || pip < 0,
    )) errors.push('Whispers cost must be non-negative');
  return errors;
}

/** Tithe carriers are creatures; subtype restrictions belong to the set catalog. */
export function validateTitheDef(d: CardDef): string[] {
  if (!d.tithe) return [];
  const errors: string[] = [];
  if (!isType(d, 'creature')) errors.push('Tithe carrier must be a creature');
  if (d.tithe.per !== 2) errors.push('Tithe requires two Defense per generic mana');
  if (d.retell) errors.push('Tithe card cannot combine with Retell');
  if (d.rite) errors.push('Tithe card cannot combine with Rite');
  if (d.hauntlink) errors.push('Tithe card cannot combine with Hauntlink');
  if (d.x) errors.push('Tithe card cannot be X');
  return errors;
}

/** Catalog-facing validation for the v1 Nine Lives authoring contract. */
export function validateNineLivesDef(d: CardDef): string[] {
  if (!d.nineLives) return [];
  const errors: string[] = [];
  if (!isType(d, 'creature')) errors.push('Nine Lives carrier must be a creature');
  if (d.hauntlink) errors.push('Nine Lives card cannot combine with Hauntlink');
  return errors;
}

/** Catalog-facing validation for the creature-only v1 Preserve contract. */
export function validatePreserveDef(d: CardDef): string[] {
  if (!d.preserve) return [];
  const errors: string[] = [];
  if (!isType(d, 'creature')) errors.push('Preserve carrier must be a creature');
  const cost = d.preserve.cost;
  if (!cost) {
    errors.push('Preserve needs a mana cost');
  } else if (
    !Number.isInteger(cost.generic) ||
    cost.generic < 0 ||
    Object.values(cost.pips).some((pip) => !Number.isInteger(pip) || pip < 0)
  ) {
    errors.push('Preserve cost must be non-negative');
  }
  if (d.hauntlink) errors.push('Preserve card cannot combine with Hauntlink');
  return errors;
}

/** Catalog-facing validation for tap and tap-plus-mana abilities. */
// an activation may not defer a tail that needs an inline target; source-only and target-free tails resume under the activation's own context (the spell rule, spec section 3)
export function validateActivatedDef(d: CardDef): string[] {
  if (!d.activated) return [];
  const errors: string[] = [];
  if (isType(d, 'land') || (!isType(d, 'creature') && !isType(d, 'artifact') && !isType(d, 'enchantment'))) {
    errors.push('Activated carrier must be a creature, artifact or enchantment, never a land');
  }
  if (d.hauntlink) errors.push('Activated carrier cannot combine with Hauntlink');
  if (d.manaAbility) errors.push('Activated carrier cannot combine with manaAbility');
  if (activatedAbilitiesOf(d).length === 0) errors.push('Activated list must not be empty');
  for (const activation of activatedAbilitiesOf(d)) {
    const { cost, ops, targets = [] } = activation;
    if (!cost || cost.tap !== true || Object.keys(cost).some((key) => key !== 'tap' && key !== 'mana')) {
      errors.push('Activated cost must be tap or tap plus mana');
    }
    if (cost?.mana && (
      !Number.isInteger(cost.mana.generic) || cost.mana.generic < 0 ||
      Object.entries(cost.mana.pips).some(([color, pip]) =>
        !['W', 'U', 'B', 'R', 'G'].includes(color) || !Number.isInteger(pip) || pip < 0,
      )
    )) errors.push('Activated mana cost must be non-negative');
    if (ops.length === 0) errors.push('Activated ops must not be empty');
    const inspect = (list: EffectOp[], afterForesee = false): boolean => {
      let deferred = afterForesee;
      for (const op of list) {
        if ('n' in op && op.n === 'X') errors.push('Activated ops cannot use X');
        if (effectOpUsesTarget(op)) {
          if (targets.length === 0) errors.push('Activated target ops need target specs');
          if (deferred) errors.push('Activated ops after Foresee cannot need an inline target');
        }
        if (op.op === 'ifTargetMarked') {
          const thenDefers = inspect(op.then, deferred);
          const elseDefers = inspect(op.else ?? [], deferred);
          deferred = thenDefers || elseDefers;
        } else if (op.op === 'foresee') {
          deferred = true;
        }
      }
      return deferred;
    };
    inspect(ops);
    for (const target of targets) {
      if (![
        'creature', 'player', 'any', 'yourCreature', 'opponentCreature', 'yourPermanent',
        'yourGraveCreature', 'artifact', 'enchantment', 'artifactOrEnchantment',
      ].includes(target.what)) errors.push('Activated target spec has an invalid target kind');
      if (target.what === 'player' && (target.marked || target.tapped)) {
        errors.push('Activated player targets cannot be marked or tapped');
      }
      if (target.upTo !== undefined && (target.upTo !== 2 || targets.length !== 1)) {
        errors.push('Activated upTo requires one target spec with upTo 2');
      }
      if (target.exactly !== undefined && (target.exactly !== 2 || targets.length !== 1 || target.upTo !== undefined)) {
        errors.push('Activated exactly requires one target spec with exactly 2 and no upTo');
      }
    }
    if (ops.some((op) => op.op === 'moveMark') && (
      targets.length !== 2 || targets.some((target) => target.upTo !== undefined || target.exactly !== undefined || target.what === 'spell')
    )) errors.push('Activated moveMark needs exactly two single-target permanent specs');
  }
  return errors;
}

export function manaValue(cost: ManaCost | undefined): number {
  if (!cost) return 0;
  let v = cost.generic;
  for (const c of Object.values(cost.pips)) v += c;
  return v;
}

// ---------------------------------------------------------------------------
// Runtime state — plain JSON throughout; structuredClone is the whole cloning
// story. Effective P/T and keywords are ALWAYS computed on read (statics.ts).
// ---------------------------------------------------------------------------

export interface UntilEotMod {
  p: number;
  t: number;
  keywords: Keyword[];
}

export interface Permanent {
  iid: number;
  /** Physical card identity; present on all Game-created permanents. */
  instanceId?: number;
  cardId: string;
  /** Opaque presentation metadata; never used by rules. */
  variantKey?: string | null;
  /** Runtime token identity. Present as true on tokens, including copies of collectible cards. */
  isToken?: true;
  owner: PlayerId;
  controller: PlayerId;
  tapped: boolean;
  enteredThisTurn: boolean; // summoning sickness, checked vs haste on read
  /** Ability indices already fired this turn; absent when none are spent. */
  firedThisTurn?: number[];
  damage: number; // marked damage, cleared at cleanup
  deathtouched: boolean; // took damage from a deathtouch source this turn
  severBranded: boolean; // Redline Supernova replacement brand, cleared at cleanup
  attachments: number[]; // aura/Hauntlink iids attached to me
  attachedTo?: number; // set if I am an attached aura or Hauntlink permanent
  plusOneCounters: number;
  untilEotMods: UntilEotMod[];
  /** Current chapter number. Arrival enters I; each later controller dawn increments it. */
  chapter?: number;
  /** Set true by `awaken`; never reset while this permanent remains in play. */
  awakened?: boolean;
  grantedKeywords?: Keyword[];
  combatDamagePrevented?: true;
  /**
   * Dealt more than 0 damage since the last state-based check. Set only on a
   * creature whose card has a Provoked ability, and cleared by the check that
   * judges whether it survived (sba.ts), so no other permanent ever carries it.
   */
  struck?: true;
}

export interface StackItem {
  sid: number;
  /** Physical card identity; present on all Game-created stack items. */
  instanceId?: number;
  cardId: string;
  /** Opaque presentation metadata; never used by rules. */
  variantKey?: string | null;
  controller: PlayerId;
  targets: TargetRef[];
  x?: number;
  /** Omitted means the ordinary, unempowered cast. */
  empowered?: boolean;
  /** Omitted means the card was cast from hand. */
  retell?: boolean;
  /** Cast from a freshly tagged graveyard entry; exits normally without a tag. */
  whispered?: true;
  /** Omitted means the ordinary cast; true means pay Hauntlink and attach. */
  hauntlinked?: boolean;
}

export type TargetRef =
  | { kind: 'permanent'; iid: number }
  | { kind: 'player'; player: PlayerId }
  | { kind: 'stackItem'; sid: number }
  /**
   * A card in `player`'s graveyard. `instanceId` is its identity: legal
   * actions carry it, submission binds it when a hand-built ref omits it, and
   * everything after submission (the stack, held triggers, the effect itself)
   * finds the card by it, so a graveyard that changes order cannot redirect
   * the effect to another card (1.8.1). `index` is where the card sat when
   * the ref was made: the chooser's locator, checked against `instanceId` at
   * submission and never read by the engine afterwards.
   */
  | { kind: 'grave'; player: PlayerId; index: number; instanceId?: number };

export interface CombatState {
  attackers: number[]; // iids
  blocks: { blocker: number; attacker: number }[];
  phase: 'attackersDeclared' | 'blockersDeclared' | 'firstStrikeDone';
  /** fog effect active this turn — combat damage prevented */
  damagePrevented: boolean;
  /** Revision 4: players who have passed their Hauntlink window before damage. */
  hauntlinkPassed?: PlayerId[];
}

export type Step =
  | 'untap'
  | 'dawn'
  | 'draw'
  | 'main1'
  | 'combat'
  | 'main2'
  | 'end'
  | 'cleanup';

export type Awaiting =
  | { player: PlayerId; kind: 'choosePlayDraw' }
  | { player: PlayerId; kind: 'mulligan' }
  | { player: PlayerId; kind: 'bottomCards'; count: number }
  // `cards` are top-first. They are redacted to [] in an opponent PlayerView.
  | { player: PlayerId; kind: 'foresee'; cards: CardEntry[] }
  // Target refs are public battlefield/stack/graveyard identities. The
  // matching pending entry retains the source and target spec for resume.
  | {
      player: PlayerId;
      kind: 'chooseTarget';
      sourceIid: number;
      abilityIndex: number;
      targets: TargetRef[];
      decision?: 'sacrifice';
    }
  | { player: PlayerId; kind: 'main' } // main1 or main2 (see state.step)
  | { player: PlayerId; kind: 'declareAttackers' }
  | { player: PlayerId; kind: 'declareBlockers' }
  | {
      player: PlayerId;
      kind: 'respond';
      over: { type: 'spell'; sid: number } | { type: 'attackers' } | { type: 'blockers' };
    }
  | { player: PlayerId; kind: 'endStepWindow' }
  // Revision 4: a Hauntlink-only window (linkHaunt or pass, no Charm casts)
  // over a trigger about to resolve, or the combat damage step. Owner ruling
  // 2026-09-04: Hauntlink explicitly breaks the no-window-over-triggers rule.
  | {
      player: PlayerId;
      kind: 'hauntlinkWindow';
      over: { type: 'trigger'; iid: number } | { type: 'combatDamage' };
    }
  | { player: PlayerId; kind: 'discardToHandSize'; count: number; decision?: 'discard' }
  | { kind: 'gameOver' };

export interface PlayerState {
  life: number;
  deck: CardEntry[]; // CardInstances internally; string[] remains a compatibility input for direct fixtures.
  hand: CardEntry[];
  graveyard: CardEntry[];
  severed: CardEntry[]; // public, one-way in v1
  /** Public ordered reserve. Omitted entirely for classic games. */
  landReserve?: CardEntry[];
  darlingZone?: CardEntry | null;
  darlingInstanceId?: number;
  darlingTax?: number;
  landDropsUsed: number;
  extraLandDrops: number;
  mulligans: number;
  keptHand: boolean;
}

/** Resolution-time choices deferred until the current synchronous batch ends. */
export interface EffectContinuation {
  ops: EffectOp[];
  /**
   * The rest of an effect that a held dies trigger paused (rules.md,
   * Hauntlink). It carries on as the effect would have carried on had the
   * trigger resolved inline: behind whatever the trigger raised, or at once.
   */
  heldTail?: true;
  /**
   * With `heldTail`: how many choices the paused op had already queued ahead
   * of the held trigger carrying this tail (kept current as held triggers
   * among them resolve in place). With no link the tail waits behind the
   * newest of them when the held trigger raises nothing itself.
   */
  regionAhead?: number;
  context: {
    controller: PlayerId; sourceCardId: string; sourceIid?: number; newDecisionContext?: true;
    targets: TargetRef[]; targetBatch?: boolean; targetSpecs?: readonly TargetSpec[];
    originalTargets?: TargetRef[]; originalTargetSpecs?: readonly TargetSpec[];
    originalTargetOwners?: (PlayerId | undefined)[];
    targetOwners?: (PlayerId | undefined)[]; x?: number; markTriggerDepth?: number;
    selfGraveExclusion?: { instanceId?: number; cardId: string; owner?: PlayerId };
  };
}

export type PendingDecision =
  | { kind: 'discard'; player: PlayerId; n: number; continuations?: EffectContinuation[] }
  | { kind: 'sacrifice'; player: PlayerId; n: 1; sourceCardId: string; sourceIid?: number; continuations?: EffectContinuation[] }
  // `player` chooses the cards; thenContext owns the target-free continuation.
  | {
      kind: 'foresee';
      player: PlayerId;
      n: number;
      continuations?: EffectContinuation[];
      thenOps?: EffectOp[];
      thenContext?: {
        controller: PlayerId;
        sourceCardId: string;
        sourceIid?: number;
      };
    }
  | {
      kind: 'chooseTarget';
      player: PlayerId;
      sourceIid: number;
      sourceCardId: string;
      abilityIndex: number;
      spec: TargetSpec;
      triggerWhen?: TriggerWhen;
      continuations?: EffectContinuation[];
      ops: EffectOp[];
    }
  // Revision 4: a trigger whose ops are held back so Hauntlink windows can be
  // offered first. `offered` records who has already had theirs. The two
  // optional fields carry a dies trigger's original resolution context.
  | {
      kind: 'resolveTrigger';
      controller: PlayerId;
      sourceIid: number;
      sourceCardId: string;
      targets: TargetRef[];
      ops: EffectOp[];
      offered: PlayerId[];
      targetSpecs?: readonly TargetSpec[];
      newDecisionContext?: true;
      continuations?: EffectContinuation[];
      markTriggerDepth?: number;
      selfGraveExclusion?: { instanceId?: number; cardId: string; owner?: PlayerId };
      /**
       * Queued choices this held dies trigger was moved ahead of. With no
       * payable link it would have resolved before any of them was offered;
       * what it raises still queues behind them.
       */
      movedAhead?: number;
      /**
       * A targeted Provoked effect held for its Hauntlink window after its
       * target was chosen: it resolves only if its creature is still on the
       * battlefield and still not lethally damaged.
       */
      provoked?: true;
      /**
       * Held in the middle of a stack flush. Once it and every trigger it
       * causes have resolved, the flush carries on before any plain choice
       * they raised is offered, as it would have with no payable link. (A
       * response window over a spell or an attack always waits for every
       * queued choice, so it needs no such mark.)
       */
      heldMidStep?: true;
    };

export interface GameState {
  /** Absent means revision 1 (classic single-window behavior). */
  rulesRev?: number;
  /** Revision-2 stack-episode bookkeeping; absent from revision-1 JSON. */
  episode?: { resolvedSinceOffer: number; reopensThisStep: number };
  rng: RngState;
  turn: number;
  startingPlayer: PlayerId; // skips their turn-1 draw
  activePlayer: PlayerId;
  step: Step;
  players: [PlayerState, PlayerState];
  battlefield: Permanent[];
  stack: StackItem[];
  stackClosed: boolean; // true once someone passed a window → flush mode
  combat: CombatState | null;
  fogThisTurn: boolean;
  creatureDiedThisTurn?: true;
  sunsetPendingWindow?: true;
  decisionResume?: Awaiting & { offerAfterDecision?: true };
  awaiting: Awaiting;
  // FIFO resolution-time choices. The synchronous interpreter queues these;
  // Game raises each matching Awaiting after the current batch finishes.
  // Plain JSON so clone/restore remains exact.
  pendingDecisions: PendingDecision[];
  nextIid: number;
  /** Next physical-card identity. Optional only for legacy hand-built states. */
  nextInstanceId?: number;
  nextSid: number;
  winner: PlayerId | 'draw' | null;
  winReason: 'life' | 'deck' | 'concede' | 'turnLimit' | null;
}

/** The pre-1.5 state projection retained for existing scenes and AI callers. */
export interface LegacyPlayerState extends Omit<PlayerState, 'deck' | 'hand' | 'graveyard' | 'severed' | 'landReserve' | 'darlingZone'> {
  deck: string[];
  hand: string[];
  graveyard: string[];
  severed: string[];
  landReserve?: string[];
  darlingZone?: string | null;
}

export type LegacyAwaiting = Exclude<Awaiting, { kind: 'foresee' }> |
  { player: PlayerId; kind: 'foresee'; cards: string[] };

export interface LegacyGameState extends Omit<GameState, 'players' | 'awaiting' | 'battlefield' | 'stack'> {
  players: [LegacyPlayerState, LegacyPlayerState];
  battlefield: Permanent[];
  stack: StackItem[];
  awaiting: LegacyAwaiting;
}

export function opponentOf(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

export function findPermanent(state: GameState, iid: number): Permanent | undefined {
  return state.battlefield.find((p) => p.iid === iid);
}
