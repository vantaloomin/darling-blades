import { activatedAbilitiesOf, isTargetBranchOp, markCostOf } from './types';
import { DARLING_PAYDOWN_COST, DARLING_PAYDOWN_REDUCTION, RULES } from '../config/rules';
import {
  blockOptions,
  canActivate,
  compelledAttackers,
  eligibleAttackers,
  minimumBlockersForAttacker,
  validateAttackers,
  validateBlocks,
} from './combat/legality';
import { enumerateTargets, isLegalTarget } from './effects/targeting';
import { graveInstanceAt, graveRefMoved, sameGraveCard } from './graveyard';
import { canPay, combineManaCosts, manaSources, maxPayableX, solveMana } from './mana';
import { arrivalHuntIndex, conditionSatisfied } from './effects/EffectInterpreter';
import { castTargetSpecs } from './resolve';
import { getEffectiveStats } from './statics';
import type { ActivatedDef, CardDb, CardDef, EffectOp, GameState, ManaActivatedDef, ManaCost, Permanent, PlayerId, TargetRef, TargetSpec } from './types';
import {
  cardIdOf,
  def,
  isType,
  isCardInstance,
  manaValue,
  opponentOf,
  validateEmpowerDef,
  validateHauntlinkDef,
  validateManaActivatedDef,
  validatePreserveDef,
  validateTitheDef,
  validateWhispersDef,
} from './types';

const moveMarkCache = new WeakMap<CardDef, { normal: boolean; empowered: boolean }>();

function cardHasMoveMark(d: CardDef, empowered: boolean): boolean {
  let cached = moveMarkCache.get(d);
  if (!cached) {
    cached = {
      normal: d.abilities?.some((ab) => ab.when === 'spell' && (ab.ops ?? []).some((op) => op.op === 'moveMark')) ?? false,
      empowered: d.empower?.ops.some((op) => op.op === 'moveMark') ?? false,
    };
    moveMarkCache.set(d, cached);
  }
  return empowered ? cached.empowered : cached.normal;
}

function opsInclude(ops: readonly EffectOp[], match: (op: EffectOp) => boolean): boolean {
  return ops.some((op) => match(op) || (isTargetBranchOp(op) &&
    (opsInclude(op.then, match) || opsInclude(op.else ?? [], match))));
}

const spellHuntCache = new WeakMap<CardDef, boolean>();

/**
 * A spell-form Hunt ("target creature you control hunts another target
 * creature"): target slot 0 is the hunter, slot 1 the prey. Its pair rule
 * (a hunter without Bulwark, two different creatures) is enforced here, on
 * the moveMark precedent, so legal actions never offer an illegal pair and
 * the AI and the Duel UI inherit it. An empowered cast whose rider brings its
 * own targets reads those instead.
 */
function cardHasSpellHunt(d: CardDef, empowered: boolean): boolean {
  if (empowered && d.empower?.targets) return false;
  let cached = spellHuntCache.get(d);
  if (cached === undefined) {
    cached = d.abilities?.some((ab) => ab.when === 'spell' &&
      opsInclude(ab.ops ?? [], (op) => op.op === 'hunt' && op.hunter === 'target')) ?? false;
    spellHuntCache.set(d, cached);
  }
  return cached;
}

/** A Duty whose source hunts ("this hunts target creature"). */
function abilityHuntsWithSource(ability: ActivatedDef): boolean {
  return opsInclude(ability.ops, (op) => op.op === 'hunt' && op.hunter === 'self');
}

function hasBulwark(state: GameState, db: CardDb, ref: TargetRef | undefined): boolean {
  return ref?.kind === 'permanent' && state.battlefield.some((perm) => perm.iid === ref.iid) &&
    getEffectiveStats(state, db, ref.iid).keywords.has('bulwark');
}

function moveMarkTargetIndexes(specs: readonly TargetSpec[]): number[] {
  return specs.flatMap((spec, index) => spec.what === 'spell' ? [] : [index]);
}

export type Action =
  | { type: 'choosePlayDraw'; play: boolean }
  | { type: 'keepHand' }
  | { type: 'mulligan' }
  | { type: 'bottomCards'; handIndices: number[] }
  | { type: 'foresee'; bottomIndices: number[] }
  | { type: 'chooseTarget'; target: TargetRef }
  /** Classic uses handIndex. Reserve formats use reserveIndex and keep -1 as
   * a compatibility sentinel for the hand-oriented UI action plumbing. */
  | { type: 'playLand'; handIndex: number; reserveIndex?: number }
  | {
      type: 'castSpell';
      handIndex: number;
      /** Retell and Whispers: where the source card sits in your graveyard. */
      graveIndex?: number;
      /**
       * Retell and Whispers: the source card's identity (1.8.1). Legal actions
       * carry it; when present it must be the card at `graveIndex`, so an
       * action built against another graveyard is refused, not redirected.
       */
      graveInstanceId?: number;
      targets?: TargetRef[];
      /** Battlefield iids sacrificed as a Rite or Tithe cost. */
      sacrifices?: number[];
      x?: number;
      /** Omitted means the ordinary cast. X cards cannot be empowered. */
      empowered?: boolean;
      /** Cast this card from its controller's graveyard for retell.cost. */
      retell?: boolean;
      /** Cast a freshly tagged graveyard card for its Whispers cost. */
      whispers?: true;
      /** Apply the optional discount from the chosen creature sacrifices. */
      tithe?: true;
      /** Cast this card for hauntlink.cost and attach it to targets[0]. */
      hauntlinked?: boolean;
      manaPlan?: number[]; // explicit source iids; omitted = auto-solve
    }
  /** Revision-3 Charm-speed action: pay Hauntlink to link or move a permanent. */
  | { type: 'linkHaunt'; iid: number; hostIid: number; manaPlan?: number[] }
  /** Main-phase graveyard action: pay Preserve, sever the card, and create a token copy. */
  | { type: 'preserveCard'; graveIndex: number; /** The card's identity; see castSpell. */ graveInstanceId?: number; manaPlan?: number[] }
  /** Main-phase tap-cost ability; targets are chosen inline, off-stack. */
  | { type: 'activate'; iid: number; abilityIndex?: number; targets?: TargetRef[]; manaPlan?: number[] }
  /**
   * Charm-speed repeatable mana ability (A1.5): pay its cost `times` times and
   * run its ops that many times, off the stack, as one action. Legal actions
   * list one entry per ability carrying the most the player can pay; any count
   * from 1 to that is accepted. A `manaPlan` pays the whole count at once.
   */
  | { type: 'activateMana'; iid: number; abilityIndex: number; times: number; manaPlan?: number[] }
  /** Normal creature-timing cast from a public Darling zone. */
  | {
      type: 'castDarling'; targets?: TargetRef[]; x?: number; manaPlan?: number[];
      /** Tithe from the Darling zone (2.0): the sacrifices discount the printed generic, never the Darling tax. */
      tithe?: true;
      sacrifices?: number[];
    }
  /** Main-phase action: pay four mana to remove one two-mana Darling tax step. */
  | { type: 'payDownDarlingTax'; manaPlan?: number[] }
  | { type: 'skim'; handIndex: number; manaPlan?: number[] }
  | { type: 'declareAttackers'; attackers: number[] }
  | { type: 'declareBlockers'; blocks: { blocker: number; attacker: number }[] }
  | { type: 'passResponse' }
  | { type: 'passStep' }
  | { type: 'discard'; handIndices: number[] }
  | { type: 'concede' };

/** All k-subsets of [0, n). Bounded small everywhere it's used. */
export function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = (start: number): void => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < n; i++) {
      cur.push(i);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
  return out;
}

function isAura(d: CardDef): boolean {
  return d.subtypes.includes('Aura');
}

function isHauntlinkCarrier(d: CardDef): boolean {
  return d.hauntlink !== undefined && validateHauntlinkDef(d).length === 0;
}

function usesActivatedHauntlink(state: GameState): boolean {
  return (state.rulesRev ?? 1) >= 3;
}

function pushHauntlinkActions(
  out: Action[],
  state: GameState,
  db: CardDb,
  player: PlayerId,
): void {
  const hosts = state.battlefield.filter(
    (perm) => perm.controller === player && isType(def(db, perm.cardId), 'creature'),
  );
  for (const link of state.battlefield) {
    if (link.controller !== player) continue;
    const d = def(db, link.cardId);
    if (!isHauntlinkCarrier(d) || !canPay(state, db, player, d.hauntlink!.cost)) continue;
    for (const host of hosts) {
      if (host.iid !== link.attachedTo) {
        out.push({ type: 'linkHaunt', iid: link.iid, hostIid: host.iid });
      }
    }
  }
}

/** Payable revision-3 link or move, used by first-window and reopen gates. */
export function hasPayableHauntlinkAction(state: GameState, db: CardDb, player: PlayerId): boolean {
  if (!usesActivatedHauntlink(state)) return false;
  const actions: Action[] = [];
  pushHauntlinkActions(actions, state, db, player);
  return actions.length > 0;
}

/** Enumerate fully-specified cast actions (× target × X) for one hand card. */
function pushCastActions(
  out: Action[],
  state: GameState,
  db: CardDb,
  player: PlayerId,
  sourceIndex: number,
  d: CardDef,
  retell = false,
  hauntlinked = false,
  mode: { whispers?: true; tithe?: true } = {},
): void {
  const xs: (number | undefined)[] = d.x
      ? retell || hauntlinked || mode.whispers || mode.tithe
      ? []
      : Array.from(
          { length: Math.max(0, maxPayableX(state, db, player, d.cost!) - d.x.min + 1) },
          (_, i) => d.x!.min + i,
        )
    : [undefined];
  if (xs.length === 0) return;

  const sacrifices = d.rite
    ? state.battlefield
        .filter(
          (perm) =>
            perm.controller === player && isType(def(db, perm.cardId), 'creature'),
        )
        .slice(0, d.rite.n)
        .map((perm) => perm.iid)
    : undefined;
  // One action per (Empower option, legal target selection, X value).
  for (const empowered of !retell && !hauntlinked && !mode.whispers && canEmpower(d) ? [false, true] : [false]) {
    const fodder = mode.tithe
      ? canonicalTitheSacrifices(state, db, player, d, empowered, mode.whispers === true) : sacrifices;
    // The ordinary cast already represents the empty set; never duplicate it.
    if (mode.tithe && fodder?.length === 0) continue;
    const options = { ...mode, sacrifices: fodder, state, db, graveIndex: sourceIndex };
    if ((mode.whispers || mode.tithe) &&
      castBlockers(state, db, player, d, empowered, 0, retell, hauntlinked, options) !== null) continue;
    const cost = castCost(d, empowered, retell, hauntlinked, options);
    if (!cost) continue;
    const specs = castTargetSpecsNow(state, db, player, d, retell, hauntlinked, empowered);
    const targetLists = targetListsForCast(state, db, player, d, specs, empowered);
    // Payability depends only on (empowered, x) — hoisted out of the target loop.
    const payableXs = xs.filter((x) =>
      canPay(state, db, player, cost, d.x && !empowered && !retell ? x ?? 0 : 0),
    );
    const graveInstanceId = retell || mode.whispers ? graveInstanceAt(state, player, sourceIndex) : undefined;
    const graveSource = graveInstanceId === undefined ? {} : { graveInstanceId };
    for (const targets of targetLists) {
      for (const x of payableXs) {
        out.push({
          type: 'castSpell',
          // The legacy handIndex mirrors the source number until the later
          // graveyard UI workstream can consume graveIndex directly. The
          // engine reads the graveyard source from graveIndex, checked
          // against graveInstanceId.
          handIndex: sourceIndex,
          ...(retell ? { graveIndex: sourceIndex, ...graveSource, retell: true } : {}),
          ...(mode.whispers ? { graveIndex: sourceIndex, ...graveSource, whispers: true } : {}),
          ...(mode.tithe ? { tithe: true } : {}),
          ...(hauntlinked ? { hauntlinked: true } : {}),
          ...(targets ? { targets } : {}),
          ...(fodder ? { sacrifices: fodder } : {}),
          ...(x === undefined ? {} : { x }),
          ...(empowered ? { empowered: true } : {}),
        });
      }
    }
  }
}

/** Empower eligibility, stated once: an optional extra cost X cards cannot carry. */
function canEmpower(d: CardDef): boolean {
  return d.empower !== undefined && !d.x;
}

export interface CastCostOptions {
  whispers?: boolean;
  tithe?: boolean;
  sacrifices?: readonly number[];
  /** Required when calculating a Tithe discount from battlefield instances. */
  state?: GameState;
  db?: CardDb;
}

export function castCost(
  d: CardDef,
  empowered: boolean,
  retell = false,
  hauntlinked = false,
  options: CastCostOptions = {},
): CardDef['cost'] {
  if (options.whispers) {
    if (empowered || retell || hauntlinked || validateWhispersDef(d).length > 0) return undefined;
    if (options.tithe && (!d.tithe || validateTitheDef(d).length > 0)) return undefined;
    const whispersCost = d.whispers?.cost;
    if (!whispersCost || !options.tithe) return whispersCost;
    // The sacrifice pays down the WHISPERS generic, not the printed one.
    return titheDiscounted(whispersCost, options);
  }
  if (options.tithe && (retell || hauntlinked || !d.tithe || validateTitheDef(d).length > 0)) return undefined;
  if (hauntlinked) return d.hauntlink?.cost;
  if (retell) return d.retell?.cost;
  if (!d.cost) return undefined;
  const cost = empowered
    ? canEmpower(d) ? combineManaCosts(d.cost, d.empower!.cost) : undefined
    : d.cost;
  if (!cost || !options.tithe) return cost;
  return titheDiscounted(cost, options);
}

/** Two points of sacrificed Defense buy one generic mana; coloured pips never move. */
function titheDiscounted(cost: ManaCost, options: CastCostOptions): ManaCost | undefined {
  const { state, db, sacrifices = [] } = options;
  if (!state || !db) return undefined;
  const defense = sacrifices.reduce((sum, iid) => sum + getEffectiveStats(state, db, iid).defense, 0);
  return { generic: Math.max(0, cost.generic - Math.floor(defense / 2)), pips: { ...cost.pips } };
}

/** One stable fodder set per cost variant, never an exponential subset menu. */
function canonicalTitheSacrifices(
  state: GameState, db: CardDb, player: PlayerId, d: CardDef, empowered: boolean, whispers = false,
): number[] {
  const generic = castCost(d, empowered, false, false, { whispers })?.generic ?? 0;
  const bodies = state.battlefield
    .filter((perm) => perm.controller === player && isType(def(db, perm.cardId), 'creature'))
    .map((perm) => ({ iid: perm.iid, defense: getEffectiveStats(state, db, perm.iid).defense }))
    .sort((a, b) => a.defense - b.defense);
  const sacrifices: number[] = [];
  let defense = 0;
  for (const body of bodies) {
    if (Math.floor(defense / 2) >= generic) break;
    sacrifices.push(body.iid);
    defense += body.defense;
  }
  return sacrifices;
}

function liveWhispers(state: GameState, player: PlayerId, graveIndex: number | undefined, d: CardDef): boolean {
  if (graveIndex === undefined) return false;
  const card = state.players[player].graveyard[graveIndex];
  return card !== undefined && isCardInstance(card) && card.cardId === d.id &&
    card.whispersUntilDawnOf === opponentOf(player);
}

/** Normal card speed, with explicit main/empty-stack guards for the new cast. */
function whispersCastableNow(state: GameState, player: PlayerId, d: CardDef): boolean {
  return castableNow(state, player, d) && (isType(d, 'charm') ||
    ((state.step === 'main1' || state.step === 'main2') && state.stack.length === 0));
}

/** Add the new riders without changing any awaiting-kind dispatcher. */
function pushAdditionalCastActions(out: Action[], state: GameState, db: CardDb, player: PlayerId): void {
  const kind = state.awaiting.kind;
  if (kind !== 'main' && kind !== 'respond' && kind !== 'endStepWindow') return;
  state.players[player].graveyard.forEach((card, index) => {
    const d = def(db, card);
    if (d.whispers && liveWhispers(state, player, index, d) && whispersCastableNow(state, player, d)) {
      pushCastActions(out, state, db, player, index, d, false, false, { whispers: true });
      // A Whispers carrier that also has Tithe offers one canonical fodder cast.
      if (d.tithe) pushCastActions(out, state, db, player, index, d, false, false, { whispers: true, tithe: true });
    }
  });
  const seen = new Set<string>();
  state.players[player].hand.forEach((card, index) => {
    const d = def(db, card);
    if (!d.tithe || seen.has(d.id) || !castableNow(state, player, d)) return;
    seen.add(d.id);
    pushCastActions(out, state, db, player, index, d, false, false, { tithe: true });
  });
}

/** Printed Darling cost plus its accumulated generic command-zone tax. */
/**
 * A Darling's cost: the printed cost plus the Darling tax. A Tithe cast (2.0,
 * ruled 2026-10-08) discounts the printed generic exactly as from hand, and
 * the tax is then added in full, so Tithe never pays the tax down.
 */
export function darlingCastCost(d: CardDef, tax: number, tithe?: CastCostOptions): ManaCost | undefined {
  if (!d.cost) return undefined;
  const base = tithe?.tithe ? titheDiscounted(d.cost, tithe) : d.cost;
  if (!base) return undefined;
  return { generic: base.generic + tax, pips: { ...base.pips } };
}

const DARLING_PAYDOWN_MANA: ManaCost = { generic: DARLING_PAYDOWN_COST, pips: {} };

/**
 * The cast's printed target specs, and whether they are the body's own
 * (`body`) rather than an override cast's (Hauntlink, a Retell body, Empower
 * targets), which bring their own.
 */
function castTargetSource(
  d: CardDef,
  retell: boolean,
  hauntlinked = false,
  empowered = false,
): { specs: ReturnType<typeof castTargetSpecs>; body: boolean } {
  if (hauntlinked) return { specs: [{ what: 'yourCreature' }], body: false };
  // A Retell override replaces the printed body's ops and target requirements.
  if (retell && d.retell?.ops) return { specs: d.retell.targets ?? [], body: false };
  if (empowered && d.empower?.targets) return { specs: d.empower.targets, body: false };
  return { specs: castTargetSpecs(d), body: true };
}

function castTargetSpecsFor(
  d: CardDef,
  retell: boolean,
  hauntlinked = false,
  empowered = false,
): ReturnType<typeof castTargetSpecs> {
  return castTargetSource(d, retell, hauntlinked, empowered).specs;
}

/**
 * The cast's target specs on the current board. A conditional arrival Hunt
 * ("When this arrives, if you control another Dinokin, Hunt.") checks its
 * condition when the creature is cast (the owner's ruling, 2026-09-29): while
 * the condition fails, the cast names no prey, so the creature is castable
 * with or without prey and takes no target. On arrival the ability then runs
 * as an ordinary targeted arrival trigger, which re-checks the condition.
 * The override casts bring their own specs and are unaffected.
 */
function castTargetSpecsNow(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  retell: boolean,
  hauntlinked = false,
  empowered = false,
): ReturnType<typeof castTargetSpecs> {
  const { specs, body } = castTargetSource(d, retell, hauntlinked, empowered);
  const hunt = body ? arrivalHuntIndex(d) : -1;
  if (hunt < 0) return specs;
  const condition = d.abilities![hunt].condition;
  // Cast from hand or the Darling zone, the creature is not on the
  // battlefield yet, so every creature there is "another".
  return condition !== undefined && !conditionSatisfied(state, db, player, condition) ? [] : specs;
}

function targetListsForCast(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  specs: readonly import('./types').TargetSpec[],
  empowered: boolean,
  sourceIid?: number,
  moveMark = cardHasMoveMark(d, empowered),
  spellHunt = cardHasSpellHunt(d, empowered),
): (TargetRef[] | undefined)[] {
  if (specs.some(spec => spec.exactly !== undefined && (specs.length !== 1 || spec.upTo !== undefined))) return [];
  if (specs.length === 0) return [undefined];
  const candidatesFor = (spec: TargetSpec): TargetRef[] => {
    const candidates = enumerateTargets(state, db, player, spec, sourceIid);
    // Keep legacy card enumeration unchanged. New cast mechanics and Duty
    // also filter player/grave refs appended before permanent qualifiers.
    const legal = sourceIid === undefined && !d.whispers && !d.tithe ? candidates : candidates.filter(
      (ref) => isLegalTarget(state, db, player, spec, ref, sourceIid),
    );
    return moveMark ? legal.filter((ref) => spec.what === 'spell' || (
          ref.kind === 'permanent' &&
          state.battlefield.find((perm) => perm.iid === ref.iid)?.controller === player
        )) : legal;
  };
  if (specs.length === 1 && specs[0].upTo === undefined && specs[0].exactly === undefined && !moveMark) {
    return candidatesFor(specs[0]).map((target) => [target]);
  }
  if (specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined)) {
    const candidates = candidatesFor(specs[0]);
    const out: TargetRef[][] = specs[0].exactly ? [] : [[]];
    if (!specs[0].exactly) for (const candidate of candidates) out.push([candidate]);
    if ((specs[0].upTo ?? specs[0].exactly ?? 0) >= 2) {
      for (let first = 0; first < candidates.length; first++) {
        for (let second = first + 1; second < candidates.length; second++) {
          out.push([candidates[first], candidates[second]]);
        }
      }
    }
    return out;
  }
  const out: TargetRef[][] = [];
  const moveIndexes = moveMarkTargetIndexes(specs);
  const visit = (index: number, chosen: TargetRef[]): void => {
    if (index === specs.length) {
      if (moveMark && moveIndexes.length === 2 && sameTarget(chosen[moveIndexes[0]], chosen[moveIndexes[1]])) return;
      if (spellHunt && sameTarget(chosen[0], chosen[1])) return;
      out.push([...chosen]);
      return;
    }
    for (const candidate of candidatesFor(specs[index])) {
      if (spellHunt && index === 0 && hasBulwark(state, db, candidate)) continue;
      visit(index + 1, [...chosen, candidate]);
    }
  };
  visit(0, []);
  return out;
}

function hasCastableVariant(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  retell = false,
): boolean {
  const variants = !retell && canEmpower(d) ? [false, true] : [false];
  for (const empowered of variants) {
    if (castBlockers(state, db, player, d, empowered, 0, retell) !== null) continue;
    const specs = castTargetSpecsNow(state, db, player, d, retell, false, empowered);
    if (targetListsForCast(state, db, player, d, specs, empowered).length > 0) return true;
  }
  return false;
}

function sameTarget(a: TargetRef | undefined, b: TargetRef | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
  if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
  if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
  if (a.kind === 'grave' && b.kind === 'grave') return sameGraveCard(a, b);
  return false;
}

/**
 * A submitted graveyard ref must still point where its chooser saw its card.
 * A bound ref whose index now holds another card was built from a different
 * graveyard; it is refused rather than resolved against the wrong card.
 */
function movedGraveTarget(state: GameState, targets: readonly TargetRef[]): string | null {
  return targets.some((ref) => ref.kind === 'grave' && graveRefMoved(state, ref))
    ? 'graveyard target is no longer where it was chosen' : null;
}

/** The same check for a Retell, Whispers or Preserve source card. */
function movedGraveSource(state: GameState, player: PlayerId, graveIndex: number, graveInstanceId?: number): string | null {
  return graveInstanceId !== undefined && graveInstanceAt(state, player, graveIndex) !== graveInstanceId
    ? 'graveyard card is no longer where it was chosen' : null;
}

function validateTargetList(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  specs: readonly import('./types').TargetSpec[],
  targets: TargetRef[],
  empowered: boolean,
  sourceIid?: number,
  moveMark = cardHasMoveMark(d, empowered),
  spellHunt = cardHasSpellHunt(d, empowered),
): string | null {
  if (specs.some(spec => spec.exactly !== undefined && (specs.length !== 1 || spec.upTo !== undefined))) {
    return 'exactly requires one target spec and cannot combine with upTo';
  }
  const moved = movedGraveTarget(state, targets);
  if (moved) return moved;
  if (specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined)) {
    if (specs[0].exactly && targets.length !== specs[0].exactly) return 'wrong number of targets';
    if (targets.length > (specs[0].upTo ?? specs[0].exactly ?? 0)) return 'too many targets';
    for (let index = 0; index < targets.length; index++) {
      if (targets.slice(0, index).some((prior) => sameTarget(prior, targets[index]))) {
        return 'upTo targets must be distinct';
      }
      const target = targets[index];
      if (!isLegalTarget(state, db, player, specs[0], target, sourceIid)) return 'illegal target';
    }
  } else {
    if (targets.length !== specs.length) return 'wrong number of targets';
    for (let i = 0; i < specs.length; i++) {
      if (!isLegalTarget(state, db, player, specs[i], targets[i], sourceIid)) return 'illegal target';
    }
  }
  if (moveMark) {
    const moveIndexes = moveMarkTargetIndexes(specs);
    if (
      moveIndexes.length !== 2 ||
      moveIndexes.some((index) => targets[index]?.kind !== 'permanent') ||
      moveIndexes.some((index) => {
        const target = targets[index];
        return target?.kind === 'permanent' &&
          state.battlefield.find((perm) => perm.iid === target.iid)?.controller !== player;
      }) ||
      sameTarget(targets[moveIndexes[0]], targets[moveIndexes[1]])
    ) return 'moveMark needs two distinct creatures you control';
  }
  if (spellHunt) {
    if (hasBulwark(state, db, targets[0])) return 'a creature with Bulwark cannot hunt';
    if (sameTarget(targets[0], targets[1])) return 'a Hunt needs two different creatures';
  }
  return null;
}

function retellable(d: CardDef): boolean {
  return d.retell !== undefined && !d.x && !d.whispers && !d.tithe && (isType(d, 'ritual') || isType(d, 'charm') || (isType(d, 'creature') && d.retell.ops !== undefined));
}

function preserveBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
): string | null {
  if (!d.preserve) return 'card has no Preserve option';
  if (validatePreserveDef(d).length > 0) return 'card has no valid Preserve option';
  if (creatureCount(state, db, player) >= RULES.maxCreatures) {
    return 'creature battlefield cap reached';
  }
  return canPay(state, db, player, d.preserve.cost) ? null : 'cannot pay cost';
}

function activatedTargetLists(state: GameState, db: CardDb, player: PlayerId, perm: Permanent, abilityIndex = 0) {
  const d = def(db, perm.cardId);
  const ability = activatedAbilitiesOf(d)[abilityIndex];
  const lists = targetListsForCast(
    state, db, player, d, ability.targets ?? [], false, perm.iid,
    ability.ops.some((op) => op.op === 'moveMark'), false,
  );
  // A hunting Duty's prey is always another creature.
  return abilityHuntsWithSource(ability)
    ? lists.filter((targets) => !targets?.some((ref) => ref.kind === 'permanent' && ref.iid === perm.iid))
    : lists;
}

/** A reason string for an unavailable activation, or null when it is offered. */
export function activatedBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  perm: Permanent | undefined,
  abilityIndex = 0,
): string | null {
  const a = state.awaiting;
  if (a.kind !== 'main' || a.player !== player || state.activePlayer !== player ||
    (state.step !== 'main1' && state.step !== 'main2')) {
    return 'Activated abilities can only be used during your Morning or Afternoon';
  }
  if (state.stack.length > 0) return 'Activated abilities need an empty stack';
  if (!perm || !state.battlefield.some((source) => source.iid === perm.iid)) {
    return 'Activated source is not on the battlefield';
  }
  const d = def(db, perm.cardId);
  const ability = activatedAbilitiesOf(d)[abilityIndex];
  if (!canActivate(state, db, perm, player, abilityIndex)) {
    if (perm.controller !== player) return 'Activated source is not under your control';
    if (!d.activated) return 'permanent has no activated ability';
    if (!Number.isInteger(abilityIndex) || !ability) return 'invalid activated ability index';
    if (markCostOf(ability) > 0) return 'not enough marks on the source';
    if (perm.tapped) return 'Activated source is tapped';
    return 'Activated source cannot tap the turn it arrives unless it has Warcry';
  }
  if (abilityHuntsWithSource(ability) && getEffectiveStats(state, db, perm.iid).keywords.has('bulwark')) {
    return 'a creature with Bulwark cannot hunt';
  }
  if (ability.cost.mana && !canPay(state, db, player, ability.cost.mana)) {
    return 'cannot pay cost';
  }
  if (activatedTargetLists(state, db, player, perm, abilityIndex).length === 0) return 'no legal targets for activated ability';
  return null;
}

function pushActivatedActions(out: Action[], state: GameState, db: CardDb, player: PlayerId): void {
  for (const perm of state.battlefield) {
    const d = def(db, perm.cardId);
    for (let abilityIndex = 0; abilityIndex < activatedAbilitiesOf(d).length; abilityIndex++) {
      if (activatedBlockers(state, db, player, perm, abilityIndex) !== null) continue;
      for (const targets of activatedTargetLists(state, db, player, perm, abilityIndex)) {
        out.push({ type: 'activate', iid: perm.iid,
          ...(Array.isArray(d.activated) ? { abilityIndex } : {}),
          ...(targets === undefined ? {} : { targets }) });
      }
    }
  }
}

const manaActivatedValidity = new WeakMap<CardDef, boolean>();

/** A card's repeatable mana abilities (A1.5), or none unless its shape is valid. */
export function manaActivationsOf(d: CardDef): readonly ManaActivatedDef[] {
  if (d.manaActivated === undefined) return [];
  let valid = manaActivatedValidity.get(d);
  if (valid === undefined) {
    valid = validateManaActivatedDef(d).length === 0;
    manaActivatedValidity.set(d, valid);
  }
  return valid ? d.manaActivated : [];
}

/** The cost of `times` activations, paid as one payment. */
export function repeatedManaCost(cost: ManaCost, times: number): ManaCost {
  const pips: ManaCost['pips'] = {};
  for (const [color, n] of Object.entries(cost.pips) as [keyof ManaCost['pips'], number][]) pips[color] = n * times;
  return { generic: cost.generic * times, pips };
}

/** The most activations `player` can pay for right now (0 when not even one). */
export function maxManaActivations(state: Pick<GameState, 'battlefield'>, db: CardDb, player: PlayerId, cost: ManaCost): number {
  // The validator keeps the cost at one mana or more, so the untapped sources
  // bound the count; each probe past what is payable is refused by solveMana's
  // counting checks, never by its search.
  const most = Math.floor(manaSources(state, db, player).length / Math.max(1, manaValue(cost)));
  let times = 0;
  while (times < most && solveMana(state, db, player, repeatedManaCost(cost, times + 1)) !== null) times++;
  return times;
}

/** Charm speed: the controller's own main phase, or any response window they hold. */
function manaActivationWindow(state: GameState, player: PlayerId): boolean {
  const a = state.awaiting;
  if (!('player' in a) || a.player !== player) return false;
  return (a.kind === 'main' && state.activePlayer === player) || a.kind === 'respond' || a.kind === 'endStepWindow';
}

/** A reason string for an unavailable mana ability, or null when it is offered. */
export function manaActivationBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  perm: Permanent | undefined,
  abilityIndex: number,
): string | null {
  if (!manaActivationWindow(state, player)) return 'This ability is used at Charm speed';
  if (!perm || !state.battlefield.some((source) => source.iid === perm.iid)) return 'the creature is not on the battlefield';
  if (perm.controller !== player) return 'the creature is not under your control';
  const ability = manaActivationsOf(def(db, perm.cardId))[abilityIndex];
  if (!Number.isInteger(abilityIndex) || !ability) return 'the creature has no such ability';
  return canPay(state, db, player, ability.cost) ? null : 'cannot pay cost';
}

function pushManaActivations(out: Action[], state: GameState, db: CardDb, player: PlayerId): void {
  for (const perm of state.battlefield) {
    if (perm.controller !== player) continue;
    const abilities = manaActivationsOf(def(db, perm.cardId));
    for (let abilityIndex = 0; abilityIndex < abilities.length; abilityIndex++) {
      if (manaActivationBlockers(state, db, player, perm, abilityIndex) !== null) continue;
      out.push({
        type: 'activateMana', iid: perm.iid, abilityIndex,
        times: maxManaActivations(state, db, player, abilities[abilityIndex].cost),
      });
    }
  }
}

/**
 * The auto-pass rule for mana abilities (A1.5). A payable one keeps a window
 * open for its controller only in combat, and only on a creature that can
 * still matter there: an attacker, a blocker, or, before blocks, a defending
 * creature that can block one of the attackers. Every other window (a spell in
 * a main phase, Sunset) auto-passes as before, so the ability never makes the
 * game prompt outside the fight it exists for.
 */
export function hasCombatManaActivation(state: GameState, db: CardDb, player: PlayerId): boolean {
  const combat = state.combat;
  if (state.step !== 'combat' || !combat) return false;
  let blockers: number[] | undefined;
  for (const perm of state.battlefield) {
    if (perm.controller !== player) continue;
    const abilities = manaActivationsOf(def(db, perm.cardId));
    if (abilities.length === 0) continue;
    const fighting = combat.attackers.includes(perm.iid) || combat.blocks.some((b) => b.blocker === perm.iid) ||
      (combat.phase === 'attackersDeclared' && player !== state.activePlayer &&
        (blockers ??= blockOptions(state, db, player, combat)
          .filter((option) => option.canBlock.length > 0).map((option) => option.blocker)).includes(perm.iid));
    if (fighting && abilities.some((ability) => canPay(state, db, player, ability.cost))) return true;
  }
  return false;
}

function skimWindow(state: GameState, player: PlayerId): boolean {
  const a = state.awaiting;
  if (!('player' in a) || a.player !== player) return false;
  return a.kind === 'main' || a.kind === 'respond' || a.kind === 'endStepWindow';
}

function skimBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
): string | null {
  if (!skimWindow(state, player)) return 'Skim is not available right now';
  if (!d.skim) return 'card has no Skim option';
  if (!canPay(state, db, player, d.skim.cost)) return 'cannot pay cost';
  return null;
}

function creatureCount(state: GameState, db: CardDb, player: PlayerId): number {
  return state.battlefield.filter(
    (p) => p.controller === player && isType(def(db, p.cardId), 'creature'),
  ).length;
}

function noncreaturePermCount(state: GameState, db: CardDb, player: PlayerId): number {
  return state.battlefield.filter((p) => {
    if (p.controller !== player || p.attachedTo !== undefined) return false;
    const d = def(db, p.cardId);
    return (
      !isType(d, 'creature') && !isType(d, 'land') && !isAura(d)
    );
  }).length;
}

/** Is `player` allowed to cast this card kind right now (speed rules)? */
function castableNow(state: GameState, player: PlayerId, d: CardDef): boolean {
  const a = state.awaiting;
  if (isType(d, 'land')) return false; // lands are played, not cast
  const instant = isType(d, 'charm');
  if ('player' in a && a.player !== player) return false;
  switch (a.kind) {
    case 'main':
      return player === state.activePlayer; // any speed in your own main
    case 'respond':
    case 'endStepWindow':
      return instant;
    default:
      return false;
  }
}

/** Darlings deliberately retain ordinary creature (sorcery) timing. */
function darlingCastableNow(state: GameState, player: PlayerId, d: CardDef): boolean {
  const a = state.awaiting;
  return isType(d, 'creature') && a.kind === 'main' && a.player === player && state.activePlayer === player;
}

/** Rite and Tithe sacrifices: distinct creatures the caster controls. */
function sacrificeListError(
  state: GameState, db: CardDb, player: PlayerId, sacrifices: readonly number[], mechanic: 'Rite' | 'Tithe',
): string | null {
  const seen = new Set<number>();
  for (const iid of sacrifices) {
    if (!Number.isInteger(iid)) return `bad ${mechanic} sacrifice iid`;
    if (seen.has(iid)) return `duplicate ${mechanic} sacrifice`;
    seen.add(iid);
    const perm = state.battlefield.find((candidate) => candidate.iid === iid);
    if (!perm || perm.controller !== player || !isType(def(db, perm.cardId), 'creature')) {
      return `${mechanic} sacrifices must be creatures you control`;
    }
  }
  return null;
}

function darlingCastBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  tax: number,
  x = d.x ? d.x.min : 0,
  sacrifices?: readonly number[],
): string | null {
  if (!isType(d, 'creature') || !d.cost) return 'Darling has no creature mana cost';
  if (sacrifices && (!d.tithe || validateTitheDef(d).length > 0)) return 'invalid Tithe cast';
  if (creatureCount(state, db, player) - (sacrifices?.length ?? 0) >= RULES.maxCreatures) return 'creature battlefield cap reached';
  const cost = darlingCastCost(d, tax, sacrifices ? { tithe: true, sacrifices, state, db } : undefined)!;
  return canPay(state, db, player, cost, d.x ? x : 0) ? null : 'cannot pay cost';
}

function pushDarlingCastActions(
  out: Action[],
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  tax: number,
): void {
  const cost = darlingCastCost(d, tax);
  if (!cost) return;
  const xs: (number | undefined)[] = d.x
    ? Array.from(
        { length: Math.max(0, maxPayableX(state, db, player, cost) - d.x.min + 1) },
        (_, i) => d.x!.min + i,
      )
    : [undefined];
  const specs = castTargetSpecsNow(state, db, player, d, false);
  const targetLists: (TargetRef[] | undefined)[] = specs.length === 0
    ? [undefined]
    : enumerateTargets(state, db, player, specs[0]).map((target) => [target]);
  // A Tithe Darling also offers one canonical fodder cast, as from hand.
  const fodder = d.tithe && validateTitheDef(d).length === 0
    ? canonicalTitheSacrifices(state, db, player, d, false) : [];
  for (const targets of targetLists) {
    for (const x of xs) {
      if (darlingCastBlockers(state, db, player, d, tax, x ?? 0) === null) {
        out.push({ type: 'castDarling', ...(targets ? { targets } : {}), ...(x === undefined ? {} : { x }) });
      }
      if (fodder.length > 0 && darlingCastBlockers(state, db, player, d, tax, x ?? 0, fodder) === null) {
        out.push({ type: 'castDarling', ...(targets ? { targets } : {}), ...(x === undefined ? {} : { x }), tithe: true, sacrifices: fodder });
      }
    }
  }
}

/** Board-cap / dedup / payment checks shared by enumerator and validator. */
function castBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  empowered = false,
  x = d.x ? d.x.min : 0,
  retell = false,
  hauntlinked = false,
  options: CastCostOptions & { graveIndex?: number } = {},
): string | null {
  if (options.whispers) {
    if (!d.whispers || validateWhispersDef(d).length > 0 || empowered || retell || hauntlinked) {
      return 'invalid Whispers cast';
    }
    if (!liveWhispers(state, player, options.graveIndex, d)) return 'Whispers marker is not live';
  }
  if (options.tithe && (!d.tithe || validateTitheDef(d).length > 0 || retell || hauntlinked)) return 'invalid Tithe cast';
  if (empowered && d.empower && validateEmpowerDef(d).length > 0) return 'invalid Empower definition';
  if (hauntlinked && !isHauntlinkCarrier(d)) return 'invalid Hauntlink carrier';
  if (!retell && !options.whispers && !d.cost) return 'card has no mana cost';
  if (retell && !retellable(d)) return 'card cannot be Retold';
  const creatures = creatureCount(state, db, player);
  if (d.rite && creatures < d.rite.n) return 'not enough creatures for Rite';
  if (
    isType(d, 'creature') && !(retell && d.retell?.ops) &&
    creatures - (options.tithe ? options.sacrifices?.length ?? 0 : d.rite?.n ?? 0) >= RULES.maxCreatures
  )
    return 'creature battlefield cap reached';
  if (
    !isType(d, 'creature') &&
    !isType(d, 'land') &&
    (isType(d, 'enchantment') || isType(d, 'artifact')) &&
    !isAura(d) &&
    !hauntlinked && noncreaturePermCount(state, db, player) >= RULES.maxNoncreaturePermanents
  )
    return 'noncreature permanent cap reached';
  const cost = castCost(d, empowered, retell, hauntlinked, options);
  if (!cost || !canPay(state, db, player, cost, d.x && !empowered && !retell ? x : 0)) {
    return 'cannot pay cost';
  }
  return null;
}

/**
 * Cast-time target enumeration lives in effects/targeting.ts. Spell upTo
 * selections and the two distinct moveMark targets are enumerated here.
 */
export function legalActions(state: GameState, db: CardDb, player: PlayerId): Action[] {
  const a = state.awaiting;
  if (a.kind === 'gameOver') return [];
  if (!('player' in a) || a.player !== player) return [];

  const me = state.players[player];
  const out: Action[] = [];

  switch (a.kind) {
    case 'choosePlayDraw':
      out.push({ type: 'choosePlayDraw', play: true });
      out.push({ type: 'choosePlayDraw', play: false });
      break;

    case 'mulligan':
      // Keep is always legal; offer another mulligan only under the cap. At the
      // cap the player must keep or concede (concede is pushed unconditionally
      // below), which is what stops the unbounded bottom-count soft-lock.
      out.push({ type: 'keepHand' });
      if (me.mulligans < RULES.maxMulligans) out.push({ type: 'mulligan' });
      break;

    case 'bottomCards':
      for (const combo of combinations(me.hand.length, a.count)) {
        out.push({ type: 'bottomCards', handIndices: combo });
      }
      break;

    case 'foresee':
      // Unlike London bottoming, foresee permits any subset. Its picker reads
      // awaiting.cards directly; exposing every subset here would allocate
      // 2^n actions for a large foresee. The empty pick is a canonical legal
      // fallback, while validateAction accepts every valid index set.
      out.push({ type: 'foresee', bottomIndices: [] });
      break;

    case 'chooseTarget':
      for (const target of a.targets) out.push({ type: 'chooseTarget', target });
      break;

    case 'main': {
      out.push({ type: 'passStep' });
      if (me.landReserve !== undefined && me.landDropsUsed < 1 + me.extraLandDrops) {
        for (let reserveIndex = 0; reserveIndex < me.landReserve.length; reserveIndex++) {
          out.push({ type: 'playLand', handIndex: -1, reserveIndex });
        }
      }
      const seen = new Set<string>();
      me.hand.forEach((card, handIndex) => {
        const cardId = cardIdOf(card);
        if (seen.has(cardId)) return; // dedupe identical copies
        seen.add(cardId);
        const d = def(db, card);
        if (d.skim && skimBlockers(state, db, player, d) === null) {
          out.push({ type: 'skim', handIndex });
        }
        if (isType(d, 'land')) {
          if (me.landReserve === undefined && me.landDropsUsed < 1 + me.extraLandDrops) {
            out.push({ type: 'playLand', handIndex });
          }
          return;
        }
        if (!castableNow(state, player, d)) return;
        if (castBlockers(state, db, player, d) === null) {
          pushCastActions(out, state, db, player, handIndex, d);
        }
        if (
          !usesActivatedHauntlink(state) &&
          d.hauntlink &&
          castBlockers(state, db, player, d, false, 0, false, true) === null
        ) {
          pushCastActions(out, state, db, player, handIndex, d, false, true);
        }
      });
      me.graveyard.forEach((card, graveIndex) => {
        const d = def(db, card);
        if (
          retellable(d) &&
          castableNow(state, player, d) &&
          castBlockers(state, db, player, d, false, 0, true) === null
        ) {
          pushCastActions(out, state, db, player, graveIndex, d, true);
        }
        if (state.activePlayer === player && preserveBlockers(state, db, player, d) === null) {
          const graveInstanceId = graveInstanceAt(state, player, graveIndex);
          out.push({ type: 'preserveCard', graveIndex, ...(graveInstanceId === undefined ? {} : { graveInstanceId }) });
        }
      });
      if (state.activePlayer === player && state.stack.length === 0) {
        pushActivatedActions(out, state, db, player);
      }
      if (me.darlingZone !== undefined) {
        const darling = me.darlingZone;
        if (darling !== null) {
          const d = def(db, darling);
          const tax = me.darlingTax ?? 0;
          if (darlingCastableNow(state, player, d)) {
            pushDarlingCastActions(out, state, db, player, d, tax);
          }
        }
        if (
          (me.darlingTax ?? 0) >= DARLING_PAYDOWN_REDUCTION &&
          canPay(state, db, player, DARLING_PAYDOWN_MANA)
        ) {
          out.push({ type: 'payDownDarlingTax' });
        }
      }
      if (usesActivatedHauntlink(state)) pushHauntlinkActions(out, state, db, player);
      pushManaActivations(out, state, db, player);
      break;
    }

    case 'declareAttackers': {
      // Fully enumerated: every subset of eligible attackers (≤ 2^8 under the
      // battlefield cap). [] skips combat.
      //
      // Rage narrows this: a compelled attacker is in every legal subset, so
      // we enumerate subsets of the FREE attackers and union the compelled set
      // into each. When something has Rage, [] is not among the results, which
      // is what makes "skip combat" illegal rather than merely discouraged.
      const eligible = eligibleAttackers(state, db, player);
      const compelled = compelledAttackers(state, db, player);
      const free = eligible.filter((iid) => !compelled.includes(iid));
      const subsets = 1 << free.length;
      for (let mask = 0; mask < subsets; mask++) {
        const chosen = free.filter((_, i) => mask & (1 << i));
        // keep battlefield order so replays and goldens stay stable
        const attackers = eligible.filter((iid) => compelled.includes(iid) || chosen.includes(iid));
        out.push({ type: 'declareAttackers', attackers });
      }
      break;
    }

    case 'declareBlockers': {
      // [] is always a complete assignment. Non-Dreaded attackers retain the
      // old one-block candidates. Dreaded attackers get only complete pairs or
      // triples here; blockOptions remains permissive for incremental UI/AI
      // construction, with validateBlocks as the final arbiter.
      out.push({ type: 'declareBlockers', blocks: [] });
      if (state.combat) {
        const opts = blockOptions(state, db, player, state.combat);
        const liveAttackers = state.combat.attackers.filter((a) =>
          state.battlefield.some((perm) => perm.iid === a),
        );
        const minBlockers = new Map(
          liveAttackers.map((a) => [a, minimumBlockersForAttacker(state, db, a)]),
        );
        for (const opt of opts) {
          for (const attacker of opt.canBlock) {
            if (minBlockers.get(attacker) === 1) {
              out.push({ type: 'declareBlockers', blocks: [{ blocker: opt.blocker, attacker }] });
            }
          }
        }
        for (const attacker of liveAttackers) {
          const minimum = minBlockers.get(attacker)!;
          if (minimum < 2) continue;
          const eligible = opts
            .filter((o) => o.canBlock.includes(attacker))
            .map((o) => o.blocker);
          for (let size = minimum; size <= RULES.maxBlockersPerAttacker; size++) {
            for (const combo of combinations(eligible.length, size)) {
              out.push({
                type: 'declareBlockers',
                blocks: combo.map((i) => ({ blocker: eligible[i], attacker })),
              });
            }
          }
        }
      }
      break;
    }

    // Revision 4: a Hauntlink-only window. Link or move, or pass - never a
    // Charm cast or a Skim. That is the whole point of the owner's ruling:
    // Hauntlink breaks the no-window-over-triggers rule, normal Charms do not.
    case 'hauntlinkWindow': {
      out.push({ type: 'passResponse' });
      pushHauntlinkActions(out, state, db, player);
      break;
    }

    case 'respond':
    case 'endStepWindow': {
      out.push({ type: 'passResponse' });
      const seen = new Set<string>();
      me.hand.forEach((card, handIndex) => {
        const cardId = cardIdOf(card);
        if (seen.has(cardId)) return;
        seen.add(cardId);
        const d = def(db, cardId);
        if (d.skim && skimBlockers(state, db, player, d) === null) {
          out.push({ type: 'skim', handIndex });
        }
        if (!isType(d, 'charm')) return;
        if (!castableNow(state, player, d)) return;
        if (castBlockers(state, db, player, d) === null) {
          pushCastActions(out, state, db, player, handIndex, d);
        }
        if (
          !usesActivatedHauntlink(state) &&
          d.hauntlink &&
          castBlockers(state, db, player, d, false, 0, false, true) === null
        ) {
          pushCastActions(out, state, db, player, handIndex, d, false, true);
        }
      });
      me.graveyard.forEach((card, graveIndex) => {
        const cardId = cardIdOf(card);
        const d = def(db, cardId);
        if (!retellable(d) || !isType(d, 'charm') || !castableNow(state, player, d)) return;
        if (castBlockers(state, db, player, d, false, 0, true) !== null) return;
        pushCastActions(out, state, db, player, graveIndex, d, true);
      });
      if (usesActivatedHauntlink(state)) pushHauntlinkActions(out, state, db, player);
      pushManaActivations(out, state, db, player);
      break;
    }

    case 'discardToHandSize':
      for (const combo of combinations(me.hand.length, a.count)) {
        out.push({ type: 'discard', handIndices: combo });
      }
      break;

  }

  pushAdditionalCastActions(out, state, db, player);
  out.push({ type: 'concede' });
  return out;
}

/** Returns an error string, or null when the action is legal. */
export function validateAction(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  action: Action,
): string | null {
  const a = state.awaiting;
  if (a.kind === 'gameOver') return 'game is over';
  if (!('player' in a) || a.player !== player) return 'not your decision';
  if (action.type === 'concede') return null;

  const me = state.players[player];

  switch (action.type) {
    case 'choosePlayDraw':
      return a.kind === 'choosePlayDraw' ? null : 'not choosing play or draw';

    case 'keepHand':
    case 'mulligan':
      return a.kind === 'mulligan' ? null : 'not in mulligan';

    case 'bottomCards': {
      if (a.kind !== 'bottomCards') return 'not bottoming';
      if (action.handIndices.length !== a.count) return `must bottom exactly ${a.count}`;
      return validIndexSet(action.handIndices, me.hand.length);
    }

    case 'foresee': {
      if (a.kind !== 'foresee') return 'not foreseeing';
      return validIndexSet(action.bottomIndices, a.cards.length, 'foresee');
    }

    case 'chooseTarget': {
      if (a.kind !== 'chooseTarget') return 'not choosing a target';
      const pending = state.pendingDecisions[0];
      if (pending?.kind === 'sacrifice' && a.decision === 'sacrifice') {
        const perm = action.target.kind === 'permanent' ? state.battlefield.find(p => action.target.kind === 'permanent' && p.iid === action.target.iid) : undefined;
        return pending.player === player && perm?.controller === player && isType(def(db, perm.cardId), 'creature') ? null : 'illegal sacrifice';
      }
      if (pending?.kind !== 'chooseTarget' || pending.player !== player) return 'no target decision is pending';
      const moved = movedGraveTarget(state, [action.target]);
      if (moved) return moved;
      if (!a.targets.some((target) => sameTarget(target, action.target))) return 'illegal target';
      return isLegalTarget(state, db, player, pending.spec, action.target, pending.sourceIid)
        ? null
        : 'illegal target';
    }

    case 'playLand': {
      if (a.kind !== 'main') return 'not in Morning or Afternoon';
      if (me.landDropsUsed >= 1 + me.extraLandDrops) return 'no land drops remaining this turn';
      if (me.landReserve !== undefined) {
        if (action.reserveIndex === undefined) return 'reserve formats play lands from the reserve';
        if (!Number.isInteger(action.reserveIndex)) return 'bad reserve index';
        const card = me.landReserve[action.reserveIndex];
        if (card === undefined) return 'bad reserve index';
        if (!isType(def(db, card), 'land')) return 'reserve card is not a land';
        return action.handIndex === -1 ? null : 'reserve land actions need handIndex -1';
      }
      if (action.reserveIndex !== undefined) return 'Classic games do not have a Warchest.';
      const cardId = me.hand[action.handIndex];
      if (cardId === undefined) return 'bad hand index';
      if (!isType(def(db, cardId), 'land')) return 'not a land';
      return null;
    }

    case 'skim': {
      const cardId = me.hand[action.handIndex];
      if (cardId === undefined) return 'bad hand index';
      const d = def(db, cardId);
      const blocked = skimBlockers(state, db, player, d);
      if (blocked) return blocked;
      if (action.manaPlan) {
        const err = validateManaPlanForCost(state, db, player, d.skim!.cost, action.manaPlan);
        if (err) return err;
      }
      return null;
    }

    case 'preserveCard': {
      if (a.kind !== 'main' || state.activePlayer !== player) {
        return 'Preserve can only be used during Morning or Afternoon';
      }
      if (!Number.isInteger(action.graveIndex)) return 'bad graveyard index';
      const card = me.graveyard[action.graveIndex];
      if (card === undefined) return 'bad graveyard index';
      const moved = movedGraveSource(state, player, action.graveIndex, action.graveInstanceId);
      if (moved) return moved;
      const d = def(db, card);
      const blocked = preserveBlockers(state, db, player, d);
      if (blocked) return blocked;
      if (action.manaPlan) {
        return validateManaPlanForCost(state, db, player, d.preserve!.cost, action.manaPlan);
      }
      return null;
    }

    case 'activate': {
      const perm = state.battlefield.find((source) => source.iid === action.iid);
      const blocked = activatedBlockers(state, db, player, perm, action.abilityIndex ?? 0);
      if (blocked) return blocked;
      const d = def(db, perm!.cardId);
      const ability = activatedAbilitiesOf(d)[action.abilityIndex ?? 0];
      const targetError = validateTargetList(
        state, db, player, d, ability.targets ?? [], action.targets ?? [], false, perm!.iid,
        ability.ops.some((op) => op.op === 'moveMark'), false,
      );
      if (targetError) return targetError;
      if (abilityHuntsWithSource(ability) &&
        (action.targets ?? []).some((ref) => ref.kind === 'permanent' && ref.iid === perm!.iid)) {
        return 'a Hunt needs two different creatures';
      }
      return action.manaPlan ? validateManaPlanForCost(
        state, db, player, ability.cost.mana ?? { generic: 0, pips: {} }, action.manaPlan,
      ) : null;
    }

    case 'activateMana': {
      const perm = state.battlefield.find((source) => source.iid === action.iid);
      const blocked = manaActivationBlockers(state, db, player, perm, action.abilityIndex);
      if (blocked) return blocked;
      if (!Number.isInteger(action.times) || action.times < 1) return 'activation count must be a whole number of at least 1';
      const cost = repeatedManaCost(manaActivationsOf(def(db, perm!.cardId))[action.abilityIndex].cost, action.times);
      if (action.manaPlan) return validateManaPlanForCost(state, db, player, cost, action.manaPlan);
      return solveMana(state, db, player, cost) === null ? 'cannot pay for that many activations' : null;
    }

    case 'castSpell': {
      const isRetell = action.retell === true;
      const isHauntlinked = action.hauntlinked === true;
      const isWhispers = action.whispers === true;
      const isTithe = action.tithe === true;
      const fromGrave = isRetell || isWhispers;
      if (isWhispers && (isRetell || isHauntlinked || action.empowered || action.x !== undefined)) {
        return 'Whispers cannot combine with Retell, Hauntlink, Empower or X';
      }
      if (isTithe && (isRetell || isHauntlinked || action.x !== undefined)) return 'Tithe cannot combine with Retell, Hauntlink or X';
      if (isRetell && isHauntlinked) return 'Retell and Hauntlink cannot be combined';
      if (isRetell && action.empowered) return 'Retell and Empower cannot be combined';
      if (isRetell && action.graveIndex === undefined) return 'Retell needs a graveyard index';
      if (isWhispers && !Number.isInteger(action.graveIndex)) return 'Whispers needs a graveyard index';
      if (!fromGrave && action.graveIndex !== undefined) return 'graveyard index requires Retell or Whispers';
      if (!fromGrave && action.graveInstanceId !== undefined) return 'graveyard card requires Retell or Whispers';
      const sourceIndex = fromGrave ? action.graveIndex! : action.handIndex;
      const cardId = fromGrave ? me.graveyard[sourceIndex] : me.hand[sourceIndex];
      if (cardId === undefined) return 'bad hand index';
      if (fromGrave) {
        const moved = movedGraveSource(state, player, sourceIndex, action.graveInstanceId);
        if (moved) return moved;
      }
      const d = def(db, cardId);
      if (usesActivatedHauntlink(state) && isHauntlinked) {
        return 'Hauntlink is activated from the battlefield in this rules revision';
      }
      if (!castableNow(state, player, d)) return 'cannot cast this now';
      if (isWhispers && !whispersCastableNow(state, player, d)) return 'cannot cast Whispers now';
      if (isRetell && !retellable(d)) return 'card cannot be Retold';
      if (isRetell && d.x) return 'X spells cannot be Retold';
      if (isHauntlinked && !d.hauntlink) return 'card has no Hauntlink option';
      if (isHauntlinked && (action.empowered || action.x !== undefined)) {
        return 'Hauntlink cannot combine with Empower or X';
      }
      if (action.empowered && !d.empower) return 'card has no Empower option';
      if (action.empowered && d.x) return 'X spells cannot be empowered';
      if (isTithe && (!d.tithe || validateTitheDef(d).length > 0)) return 'invalid Tithe cast';
      if (!d.rite && !isTithe && action.sacrifices !== undefined) return 'card has no Rite cost';
      if (d.rite) {
        if (!action.sacrifices || action.sacrifices.length !== d.rite.n) {
          return `Rite requires exactly ${d.rite.n} sacrifice${d.rite.n === 1 ? '' : 's'}`;
        }
      }
      if (d.rite || isTithe) {
        const sacrificeError = sacrificeListError(state, db, player, action.sacrifices ?? [], isTithe ? 'Tithe' : 'Rite');
        if (sacrificeError) return sacrificeError;
      }
      const options = { whispers: isWhispers, tithe: isTithe, sacrifices: action.sacrifices, graveIndex: action.graveIndex, state, db };
      const blocked = castBlockers(
        state,
        db,
        player,
        d,
        action.empowered === true,
        action.x ?? 0,
        isRetell,
        isHauntlinked,
        options,
      );
      if (blocked) return blocked;
      if (d.x && (action.x === undefined || action.x < d.x.min)) return 'bad X';
      if (!d.x && action.x !== undefined) return 'card has no X';
      const extra = action.x ?? 0;
      if (action.manaPlan) {
        const err = validateManaPlan(
          state,
          db,
          player,
          d,
          extra,
          action.manaPlan,
          action.empowered === true,
          isRetell,
          isHauntlinked,
          options,
        );
        if (err) return err;
      } else {
        const cost = castCost(d, action.empowered === true, isRetell, isHauntlinked, options);
        if (!cost || solveMana(
          state,
          db,
          player,
          cost,
          d.x && !action.empowered && !isRetell && !isHauntlinked ? extra : 0,
        ) === null) {
          return 'cannot pay cost';
        }
      }
      const specs = castTargetSpecsNow(state, db, player, d, isRetell, isHauntlinked, action.empowered === true);
      const targets = action.targets ?? [];
      const targetError = validateTargetList(state, db, player, d, specs, targets, action.empowered === true);
      if (targetError) return targetError;
      return null;
    }

    case 'linkHaunt': {
      if (!usesActivatedHauntlink(state)) return 'Hauntlink activation is unavailable in this rules revision';
      const charmSpeed =
        (a.kind === 'main' && state.activePlayer === player) ||
        a.kind === 'respond' ||
        a.kind === 'endStepWindow' ||
        a.kind === 'hauntlinkWindow';
      if (!charmSpeed) return 'Hauntlink needs a Charm-speed window';
      const link = state.battlefield.find((perm) => perm.iid === action.iid);
      if (!link || link.controller !== player) return 'Hauntlink permanent is not under your control';
      const d = def(db, link.cardId);
      if (!isHauntlinkCarrier(d)) return 'permanent has no valid Hauntlink ability';
      const host = state.battlefield.find((perm) => perm.iid === action.hostIid);
      if (
        !host ||
        host.controller !== player ||
        !isType(def(db, host.cardId), 'creature')
      ) {
        return 'Hauntlink host must be a creature you control';
      }
      if (link.attachedTo === host.iid) return 'Hauntlink is already linked to this creature';
      if (!canPay(state, db, player, d.hauntlink!.cost)) return 'cannot pay cost';
      if (action.manaPlan) {
        const err = validateManaPlanForCost(state, db, player, d.hauntlink!.cost, action.manaPlan);
        if (err) return err;
      }
      return null;
    }

    case 'castDarling': {
      if (a.kind !== 'main' || state.activePlayer !== player) return 'Darling casts need Morning or Afternoon';
      if (me.darlingZone === undefined) return 'this game has no Darling zone';
      if (me.darlingZone === null) return 'Darling zone is empty';
      const d = def(db, me.darlingZone);
      if (!darlingCastableNow(state, player, d)) return 'cannot cast Darling now';
      if (d.x && (action.x === undefined || action.x < d.x.min)) return 'bad X';
      if (!d.x && action.x !== undefined) return 'Darling has no X';
      if (!action.tithe && action.sacrifices !== undefined) return 'only a Tithe cast sacrifices';
      if (action.tithe) {
        if (action.sacrifices === undefined) return 'a Tithe cast needs its sacrifices';
        const sacrificeError = sacrificeListError(state, db, player, action.sacrifices, 'Tithe');
        if (sacrificeError) return sacrificeError;
      }
      const sacrifices = action.tithe ? action.sacrifices : undefined;
      const blocked = darlingCastBlockers(state, db, player, d, me.darlingTax ?? 0, action.x ?? 0, sacrifices);
      if (blocked) return blocked;
      const cost = darlingCastCost(d, me.darlingTax ?? 0, sacrifices ? { tithe: true, sacrifices, state, db } : undefined)!;
      if (action.manaPlan) {
        const err = validateManaPlanForCost(state, db, player, cost, action.manaPlan, action.x ?? 0);
        if (err) return err;
        if (action.manaPlan.length !== manaValue(cost) + (action.x ?? 0)) return 'mana plan has wrong source count';
      }
      const specs = castTargetSpecsNow(state, db, player, d, false);
      const targets = action.targets ?? [];
      if (targets.length !== specs.length) return 'wrong number of targets';
      const moved = movedGraveTarget(state, targets);
      if (moved) return moved;
      for (let i = 0; i < specs.length; i++) {
        if (!isLegalTarget(state, db, player, specs[i], targets[i])) return 'illegal target';
      }
      return null;
    }

    case 'payDownDarlingTax': {
      if (a.kind !== 'main' || state.activePlayer !== player) return 'Darling tax can only be paid down in Morning or Afternoon';
      if (me.darlingZone === undefined) return 'this game has no Darling zone';
      if ((me.darlingTax ?? 0) < DARLING_PAYDOWN_REDUCTION) return 'Darling tax is already zero';
      if (action.manaPlan) return validateManaPlanForCost(state, db, player, DARLING_PAYDOWN_MANA, action.manaPlan);
      return canPay(state, db, player, DARLING_PAYDOWN_MANA) ? null : 'cannot pay cost';
    }

    case 'declareAttackers':
      if (a.kind !== 'declareAttackers') return 'not declaring attackers';
      return validateAttackers(state, db, player, action.attackers);

    case 'declareBlockers': {
      if (a.kind !== 'declareBlockers') return 'not declaring blockers';
      if (!state.combat) return 'no combat in progress';
      return validateBlocks(state, db, player, state.combat, action.blocks);
    }

    case 'passResponse':
      return a.kind === 'respond' || a.kind === 'endStepWindow' || a.kind === 'hauntlinkWindow'
        ? null
        : 'no window open';

    case 'passStep':
      return a.kind === 'main' ? null : 'cannot pass now';

    case 'discard': {
      if (a.kind !== 'discardToHandSize') return 'not discarding';
      if (action.handIndices.length !== a.count) return `must discard exactly ${a.count}`;
      return validIndexSet(action.handIndices, me.hand.length);
    }

  }
}

function validIndexSet(indices: number[], size: number, zone = 'hand'): string | null {
  const seen = new Set<number>();
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i >= size) return `bad ${zone} index`;
    if (seen.has(i)) return `duplicate ${zone} index`;
    seen.add(i);
  }
  return null;
}

/** An explicit manaPlan must consist of distinct available sources that cover the cost. */
function validateManaPlan(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  extraGeneric: number,
  plan: number[],
  empowered: boolean,
  retell: boolean,
  hauntlinked: boolean,
  options: CastCostOptions = {},
): string | null {
  const available = new Map(manaSources(state, db, player).map((s) => [s.iid, s]));
  const seen = new Set<number>();
  for (const iid of plan) {
    if (!available.has(iid)) return `source ${iid} is not an untapped mana source`;
    if (seen.has(iid)) return 'duplicate source in mana plan';
    seen.add(iid);
  }
  // The chosen subset must itself solve the cost exactly (count + pips).
  const others = manaSources(state, db, player)
    .filter((s) => !plan.includes(s.iid))
    .map((s) => s.iid);
  const cost = castCost(d, empowered, retell, hauntlinked, options);
  if (!cost) return 'invalid cast cost';
  const solved = solveMana(
    state,
    db,
    player,
    cost,
    d.x && !empowered && !retell && !hauntlinked ? extraGeneric : 0,
    others,
  );
  if (!solved) return 'mana plan cannot pay the cost';
  const needed = (d.x && !empowered && !retell && !hauntlinked ? extraGeneric : 0) + manaValue(cost);
  if (plan.length !== needed) return 'mana plan has wrong source count';
  return null;
}

function validateManaPlanForCost(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  cost: CardDef['cost'],
  plan: number[],
  extraGeneric = 0,
): string | null {
  if (!cost) return 'card has no mana cost';
  const available = new Map(manaSources(state, db, player).map((s) => [s.iid, s]));
  const seen = new Set<number>();
  for (const iid of plan) {
    if (!available.has(iid)) return `source ${iid} is not an untapped mana source`;
    if (seen.has(iid)) return 'duplicate source in mana plan';
    seen.add(iid);
  }
  const others = manaSources(state, db, player)
    .filter((s) => !plan.includes(s.iid))
    .map((s) => s.iid);
  if (!solveMana(state, db, player, cost, extraGeneric, others)) return 'mana plan cannot pay the cost';
  if (plan.length !== manaValue(cost) + extraGeneric) return 'mana plan has wrong source count';
  return null;
}

/**
 * Player-facing copy for the internal castBlockers() reason strings. Those are
 * written for the enumerator/validator (terse, dev-ish); anything not mapped
 * here falls back to a generic line.
 */
const UNCASTABLE_COPY: Record<string, string> = {
  'cannot pay cost': 'Not enough mana to cast this.',
  'not enough creatures for Rite': 'You do not control enough creatures to pay Rite.',
  'creature battlefield cap reached': 'Your side of the battlefield is full of creatures.',
  'noncreature permanent cap reached': 'You have too many noncreature permanents in play.',
  'card has no mana cost': "This card can't be cast.",
};

/**
 * Why the card at `handIndex` cannot be played right now, as one player-facing
 * sentence — or null when it actually IS playable. View-safe and Phaser-free:
 * mirrors the per-card branch of legalActions() (land timing, cast speed,
 * payment / board caps, target availability) so the UI can explain a dimmed
 * hand card instead of a silent no-op. The land case is handled here because it
 * lives outside castableNow() (lands are played, not cast).
 */
export function reasonUncastable(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  handIndex: number,
): string | null {
  const a = state.awaiting;
  const me = state.players[player];
  const cardId = me.hand[handIndex];
  if (cardId === undefined) return null; // empty slot — nothing to explain
  if (!('player' in a) || a.player !== player) return "It isn't your turn to act.";
  const d = def(db, cardId);

  // Skim is a legal alternative even when the card is not castable, including
  // non-Charms in a response or end-step window.
  if (d.skim && skimBlockers(state, db, player, d) === null) return null;

  if (isType(d, 'land')) {
    if (a.kind !== 'main') return 'Lands can only be played during Morning or Afternoon.';
    if (me.landDropsUsed >= 1 + me.extraLandDrops) return 'You have no land drops left this turn.';
    return null;
  }

  if (!castableNow(state, player, d)) {
    if (a.kind === 'respond' || a.kind === 'endStepWindow') return 'Only Charms can be cast in response.';
    if (a.kind === 'main' && player !== state.activePlayer) return 'You can only cast this on your own turn.';
    return "You can't cast this right now.";
  }

  const blocked = castBlockers(state, db, player, d);
  if (blocked) {
    if (
      !usesActivatedHauntlink(state) &&
      d.hauntlink &&
      castBlockers(state, db, player, d, false, 0, false, true) === null
    ) {
      // A targeted printed body can mask a legal hauntlink-only cast at this early no-targets return.
      return enumerateTargets(state, db, player, { what: 'yourCreature' }).length > 0
        ? null
        : 'There are no creatures you control to Hauntlink this to.';
    }
    return UNCASTABLE_COPY[blocked] ?? "You can't cast this right now.";
  }

  if (hasCastableVariant(state, db, player, d)) return null;
  const specs = castTargetSpecsNow(state, db, player, d, false);
  if (specs.length > 0 && enumerateTargets(state, db, player, specs[0]).length === 0) {
    // Player copy approved by the owner, 2026-09-29.
    if (arrivalHuntIndex(d) >= 0) return "It can't be cast: it has no prey to hunt.";
    return 'There are no legal targets for this spell.';
  }

  return null; // castable
}

/** Live, payable and targetable Whispers Charm, even before a response awaiting is installed. */
function hasWhispersCharm(state: GameState, db: CardDb, player: PlayerId): boolean {
  return state.players[player].graveyard.some((card, graveIndex) => {
    const d = def(db, card);
    if (!d.whispers || !isType(d, 'charm')) return false;
    if (castBlockers(state, db, player, d, false, 0, false, false, { whispers: true, graveIndex }) !== null) return false;
    return targetListsForCast(state, db, player, d, castTargetSpecsFor(d, false), false).length > 0;
  });
}

/** Any instant in hand or graveyard that `player` could pay AND target? (window auto-pass check) */
export function hasCastableInstant(state: GameState, db: CardDb, player: PlayerId): boolean {
  if (hasWhispersCharm(state, db, player)) return true;
  if (hasPayableHauntlinkAction(state, db, player)) return true;
  if (hasCombatManaActivation(state, db, player)) return true;
  const me = state.players[player];
  for (const cardId of me.hand) {
    const d = def(db, cardId);
    // Skim is full instant speed and does not care what card type carries it.
    // This check is also used before the response await state is installed.
    if (d.skim && canPay(state, db, player, d.skim.cost)) return true;
    if (!isType(d, 'charm')) continue;
    if (hasCastableVariant(state, db, player, d)) return true;
  }

  // A Retell Charm is also an instant for both window gates. Use the Retell
  // cost and target-free R4 override here, while keeping the scan early-exit.
  for (const cardId of me.graveyard) {
    const d = def(db, cardId);
    if (!isType(d, 'charm') || !retellable(d)) continue;
    if (castBlockers(state, db, player, d, false, 0, true) !== null) continue;
    if (hasCastableVariant(state, db, player, d, true)) return true;
  }
  return false;
}

/**
 * Any castable, targetable Charm in hand or via Retell? Unlike the first-window
 * gate above, this deliberately excludes Skim so a constant hand size cannot
 * fuel an unbounded chain of reopened windows.
 */
export function hasCastableCharm(state: GameState, db: CardDb, player: PlayerId): boolean {
  if (hasWhispersCharm(state, db, player)) return true;
  if (hasPayableHauntlinkAction(state, db, player)) return true;
  // A defender who could pump is worth a reopen once one is earned (a resolved
  // item, or the attacker's own pump in a combat window: Game.apply).
  if (hasCombatManaActivation(state, db, player)) return true;
  const me = state.players[player];
  for (const cardId of me.hand) {
    const d = def(db, cardId);
    if (!isType(d, 'charm')) continue;
    if (hasCastableVariant(state, db, player, d)) return true;
  }
  for (const cardId of me.graveyard) {
    const d = def(db, cardId);
    if (!isType(d, 'charm') || !retellable(d)) continue;
    if (castBlockers(state, db, player, d, false, 0, true) !== null) continue;
    if (hasCastableVariant(state, db, player, d, true)) return true;
  }
  return false;
}

/**
 * The single action `player` is forced into when the current decision offers
 * no meaningful choice — or null when a real choice exists (or it isn't this
 * player's decision at all). Pure and read-only; never touches the RNG. The
 * UI's auto-skip driver submits the returned action on the player's behalf.
 *
 * Forced ⇔
 * - 'main' whose legalActions are ONLY passStep + concede → passStep
 * - 'declareAttackers' with no eligible attackers → attack with []
 * - 'declareBlockers' with no legal block assignment → block with []
 *
 * Never forced: choosePlayDraw / mulligan / bottomCards / discardToHandSize
 * (real picks),
 * respond / endStepWindow (the engine only opens those windows when a
 * castable instant actually exists — see openResponseWindow/enterEndStep),
 * gameOver. Concede never counts as a "choice" that blocks skipping, and is
 * never the forced action.
 */
export function forcedAction(
  state: GameState,
  db: CardDb,
  player: PlayerId,
): Action | null {
  const a = state.awaiting;
  if (a.kind === 'gameOver') return null;
  if (!('player' in a) || a.player !== player) return null;
  switch (a.kind) {
    case 'main': {
      const meaningful = legalActions(state, db, player).some(
        (act) => act.type !== 'passStep' && act.type !== 'concede',
      );
      return meaningful ? null : { type: 'passStep' };
    }
    case 'declareAttackers': {
      // Query legality directly — legalActions enumerates 2^n attack subsets.
      const eligible = eligibleAttackers(state, db, player);
      if (eligible.length === 0) return { type: 'declareAttackers', attackers: [] };
      // Every eligible attacker has Rage: one legal declaration, no decision.
      const compelled = compelledAttackers(state, db, player);
      return compelled.length === eligible.length
        ? { type: 'declareAttackers', attackers: eligible }
        : null;
    }
    case 'declareBlockers': {
      // blockOptions includes partial Dreaded pairs, so a lone individually
      // legal blocker is not proof a usable assignment exists. Answer the
      // existence question directly instead of materializing every combo.
      if (!state.combat) return null;
      const opts = blockOptions(state, db, player, state.combat);
      const hasCompleteAssignment = state.combat.attackers.some((attacker) => {
        if (!state.battlefield.some((perm) => perm.iid === attacker)) return false;
        const minimum = minimumBlockersForAttacker(state, db, attacker);
        return opts.filter((o) => o.canBlock.includes(attacker)).length >= minimum;
      });
      return hasCompleteAssignment ? null : { type: 'declareBlockers', blocks: [] };
    }
    default:
      return null;
  }
}

export function defenderOf(state: GameState): PlayerId {
  return opponentOf(state.activePlayer);
}
