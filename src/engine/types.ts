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
// Only arrival triggers may target; their mandatory decision is deferred.
// Spell upTo specs may fan one op out across independently chosen targets.
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
    | 'yourPermanent'
    | 'yourGraveCreature'
    | 'artifact'
    | 'enchantment'
    | 'artifactOrEnchantment';
  /** Excludes the ability's source permanent. */
  other?: true;
  /** Spell-side "up to N targets"; arrival triggers remain single-target. */
  upTo?: 2;
  /** Restricts legal targets to creatures carrying at least one mark. */
  marked?: true;
  /** Restricts legal targets to tapped permanents. */
  tapped?: true;
}

export type EffectOp =
  | { op: 'damage'; n: number | 'X'; to: 'target' | 'opponent' | 'controller' }
  | { op: 'damage'; n: number | 'X'; to: 'eachCreature'; severOnDeath?: true }
  | { op: 'gainLife'; n: number }
  | { op: 'loseLife'; n: number; who: 'opponent' }
  | { op: 'draw'; n: number }
  | { op: 'discardRandom'; n: number; who: 'opponent' }
  | { op: 'destroy'; to: 'target' } // target permanent → its owner's graveyard
  | { op: 'sever'; to: 'target' } // target permanent → its owner's severed zone
  | { op: 'severGrave'; n: number; who: 'self' | 'opponent' } // top n grave cards → severed zone
  | { op: 'severTop'; n: number; who: 'self' } // top n deck cards → severed zone
  | { op: 'recall'; to: 'target' } // target permanent → its owner's hand; tokens evaporate
  | {
      op: 'destroyArtifactOrSeverEnchantment';
      to: 'target';
    } // branch is artifact-first; otherwise an enchantment is severed
  | { op: 'cancel'; to: 'target' } // target is a stack item
  | { op: 'boost'; p: number; t: number; keywords?: Keyword[]; scope: 'target' | 'allYours' | 'all' | 'yourMarked' | 'theirMarked' }
  | { op: 'addCounters'; n: number; to: 'target' | 'self' }
  | { op: 'propagate' } // +1 Mark on each ALREADY-Marked creature you control; starts none, no target
  | { op: 'moveMark' } // move one mark from targets[0] to targets[1]
  | { op: 'removeMarks'; to: 'target' }
  | { op: 'markAll'; scope: 'yourCreatures' }
  | { op: 'loseLifePerTheirMarked'; who: 'opponent' }
  | { op: 'fetchLand' }
  | { op: 'ifTargetMarked'; then: EffectOp[]; else?: EffectOp[] }
  | { op: 'severSelf' }
  | { op: 'tap'; to: 'target' }
  | { op: 'extraLandDrop'; n?: number } // grant the controller extra land drops this turn
  | { op: 'createToken'; token: string; count: number }
  | { op: 'destroyNewestOpponentArtifactOrEnchantment' } // trigger-safe, no target
  | { op: 'massDestroy'; filter: 'allCreatures' | 'allFliers' | 'allEnchantments' }
  | { op: 'preventCombat' } // prevent all combat damage this turn
  | { op: 'reclaim' } // return target creature card from your graveyard to hand
  | { op: 'grind'; n: number; who: 'self' | 'opponent' } // top n of deck → graveyard
  | { op: 'foresee'; n: number; who?: 'targetOwner' } // look at top n, then choose any subset to bottom
  | { op: 'awaken'; scope: 'self' | 'allYours' } // one-way champion upgrade; trigger-safe
  | { op: 'raise'; to?: 'target' } // your grave creature → battlefield (target)
  | { op: 'raise'; to: 'top'; withMarks?: number }; // trigger-safe top raise, optionally arriving marked

export interface StaticDef {
  /** `questActive` reads the source controller's public battlefield. */
  condition?: 'questActive';
  scope: 'self' | 'attached' | 'filter';
  /** filter scope: your creatures matching; `other` excludes the source. */
  filter?: {
    subtype?: string;
    other?: boolean;
    marked?: true;
    who?: 'yours' | 'opponent';
  };
  p?: number;
  t?: number;
  grantKeywords?: Keyword[];
}

export interface AbilityDef {
  when: TriggerWhen;
  /** The source controller must control a CardDef with `chapters` present. */
  condition?:
    | 'questActive'
    | 'controlMarked'
    // `permanents` remains a replay-compatible legacy value. Mark conditions
    // are creature-scoped regardless of this subject field.
    | { kind: 'markedThreshold'; n: number; subject: 'permanents' | 'creatures' };
  targets?: TargetSpec[];
  ops?: EffectOp[];
  static?: StaticDef;
}

/**
 * Optional Empower rider. The extra cost is paid as part of casting the card,
 * and the ops run after the card's normal resolution. Empower ops are required
 * to be trigger-safe. They may carry targets only when the op is moveMark.
 * The engine keeps this contract explicit here because there is no separate
 * data-validation pass.
 */
export interface EmpowerDef {
  cost: ManaCost;
  /** Only a moveMark rider may carry these two cast-time target specs. */
  targets?: TargetSpec[];
  ops: EffectOp[];
}

/** Hand-side activated discard-to-draw action. Skim never uses the stack. */
export interface SkimDef {
  cost: ManaCost;
}

/**
 * Optional alternative-cost graveyard cast. Retell ops, when present, are
 * trigger-safe and target-free, just like Empower ops: they replace the
 * printed spell body for that Retell cast and must not introduce a decision.
 */
export interface RetellDef {
  cost: ManaCost;
  ops?: EffectOp[];
}

/** Additional creature-sacrifice cost paid while casting the card. */
export interface RiteDef {
  n: number;
}

/** Main-phase graveyard activation that creates a token copy of this creature. */
export interface PreserveDef {
  cost: ManaCost;
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

function effectOpUsesTarget(op: EffectOp): boolean {
  switch (op.op) {
    case 'damage':
      return op.to === 'target';
    case 'destroy':
    case 'sever':
    case 'recall':
    case 'destroyArtifactOrSeverEnchantment':
    case 'cancel':
    case 'tap':
      return op.to === 'target';
    case 'boost':
      return op.scope === 'target';
    case 'addCounters':
      return op.to === 'target';
    case 'moveMark':
    case 'removeMarks':
    case 'reclaim':
      return true;
    case 'raise':
      return op.to !== 'top';
    case 'ifTargetMarked':
      return true;
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
 * Empower riders are target-free except two named shapes:
 *   - `moveMark` carries exactly two single-target specs (from, to);
 *   - `reclaim` carries exactly one `yourGraveCreature` spec (Renenutet, Who
 *     Measures the Flood, 2026-09-04 rework).
 */
export function validateEmpowerDef(d: CardDef): string[] {
  if (!d.empower) return [];
  const errors: string[] = [];
  const targets = d.empower.targets;
  const hasMoveMark = d.empower.ops.some((op) => op.op === 'moveMark');
  const hasReclaim = d.empower.ops.some((op) => op.op === 'reclaim');
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
  } else if (targets) {
    errors.push('Empower targets require a moveMark or reclaim op');
  }
  if (d.empower.ops.some((op) => effectOpUsesTarget(op) && op.op !== 'moveMark' && op.op !== 'reclaim')) {
    errors.push('Only moveMark and reclaim may target from Empower');
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
  /** Optional additional cast cost that sacrifices controlled creatures. */
  rite?: RiteDef;
  /** Returns once after dying without a +1/+1 mark. */
  nineLives?: true;
  /** Optional main-phase activation from this card's graveyard. */
  preserve?: PreserveDef;
  /** Optional alternative-cost cast that enters attached to a friendly creature. */
  hauntlink?: HauntlinkDef;
  manaAbility?: (Color | 'C')[]; // lands & mana creatures
  entersTapped?: boolean; // dual taplands
  rarity: Rarity;
  flavor?: string;
  artRef?: string;
  token?: boolean; // non-collectible
  set?: 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters' | 'dark-tales' | 'yokai-nights'; // expansion grouping; absent ⇒ 'base' (stamped in catalog.buildDb)
}

export type CardDb = Readonly<Record<string, CardDef>>;

/**
 * Physical identity for one copy of a card. `cardId` is the only rules
 * identity; `variantKey` is opaque presentation metadata and is never read by
 * the rules or AI layers.
 */
export interface CardInstance {
  instanceId: number;
  cardId: string;
  variantKey: string | null;
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

/** Catalog-facing validation for the target-free v1 Rite authoring contract. */
export function validateRiteDef(d: CardDef): string[] {
  if (!d.rite) return [];
  const errors: string[] = [];
  if (!Number.isInteger(d.rite.n) || d.rite.n < 1) {
    errors.push('Rite count must be an integer of at least 1');
  }
  if (d.x) errors.push('Rite card cannot be X');
  if (d.retell) errors.push('Rite card cannot combine with Retell');
  if (d.hauntlink) errors.push('Rite card cannot combine with Hauntlink');
  if (d.skim) errors.push('Rite card cannot combine with Skim');
  if (
    d.subtypes.includes('Aura') ||
    (d.abilities ?? []).some(
      (ability) => ability.when !== 'static' && (ability.targets?.length ?? 0) > 0,
    )
  ) {
    errors.push('Rite card cannot have cast targets');
  }
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
  /** Omitted means the ordinary cast; true means pay Hauntlink and attach. */
  hauntlinked?: boolean;
}

export type TargetRef =
  | { kind: 'permanent'; iid: number }
  | { kind: 'player'; player: PlayerId }
  | { kind: 'stackItem'; sid: number }
  | { kind: 'grave'; player: PlayerId; index: number };

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
  | { player: PlayerId; kind: 'discardToHandSize'; count: number }
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
export type PendingDecision =
  // `player` is the continuation controller. thenOps is present only when
  // Foresee interrupted a printed op list and contains target-free tail ops.
  | { kind: 'foresee'; player: PlayerId; n: number; thenOps?: EffectOp[] }
  | {
      kind: 'chooseTarget';
      player: PlayerId;
      sourceIid: number;
      sourceCardId: string;
      abilityIndex: number;
      spec: TargetSpec;
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
      markTriggerDepth?: number;
      selfGraveExclusion?: { instanceId?: number; cardId: string };
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
  fogThisTurn: boolean; // a fog effect prevents all combat damage this turn
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
