import { DARLING_PAYDOWN_COST, DARLING_PAYDOWN_REDUCTION, RULES } from '../config/rules';
import {
  blockOptions,
  eligibleAttackers,
  minimumBlockersForAttacker,
  validateAttackers,
  validateBlocks,
} from './combat/legality';
import { enumerateTargets, isLegalTarget } from './effects/targeting';
import { canPay, combineManaCosts, manaSources, maxPayableX, solveMana } from './mana';
import { castTargetSpecs } from './resolve';
import type { CardDb, CardDef, GameState, ManaCost, PlayerId, TargetRef } from './types';
import {
  cardIdOf,
  def,
  isType,
  manaValue,
  opponentOf,
  validateEmpowerDef,
  validateHauntlinkDef,
  validatePreserveDef,
} from './types';

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
      /** Retell casts use graveIndex as their authoritative source index. */
      graveIndex?: number;
      targets?: TargetRef[];
      /** Battlefield iids sacrificed as a Rite additional cost. */
      sacrifices?: number[];
      x?: number;
      /** Omitted means the ordinary cast. X cards cannot be empowered. */
      empowered?: boolean;
      /** Cast this card from its controller's graveyard for retell.cost. */
      retell?: boolean;
      /** Cast this card for hauntlink.cost and attach it to targets[0]. */
      hauntlinked?: boolean;
      manaPlan?: number[]; // explicit source iids; omitted = auto-solve
    }
  /** Revision-3 Charm-speed action: pay Hauntlink to link or move a permanent. */
  | { type: 'linkHaunt'; iid: number; hostIid: number; manaPlan?: number[] }
  /** Main-phase graveyard action: pay Preserve, sever the card, and create a token copy. */
  | { type: 'preserveCard'; graveIndex: number; manaPlan?: number[] }
  /** Normal creature-timing cast from a public Darling zone. */
  | { type: 'castDarling'; targets?: TargetRef[]; x?: number; manaPlan?: number[] }
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
function hasPayableHauntlinkAction(state: GameState, db: CardDb, player: PlayerId): boolean {
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
): void {
  const xs: (number | undefined)[] = d.x
    ? retell || hauntlinked
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
  for (const empowered of !retell && !hauntlinked && canEmpower(d) ? [false, true] : [false]) {
    const cost = castCost(d, empowered, retell, hauntlinked);
    if (!cost) continue;
    const specs = castTargetSpecsFor(d, retell, hauntlinked, empowered);
    const targetLists = targetListsForCast(state, db, player, d, specs, empowered);
    // Payability depends only on (empowered, x) — hoisted out of the target loop.
    const payableXs = xs.filter((x) =>
      canPay(state, db, player, cost, d.x && !empowered && !retell ? x ?? 0 : 0),
    );
    for (const targets of targetLists) {
      for (const x of payableXs) {
        out.push({
          type: 'castSpell',
          // The legacy handIndex mirrors the source number until the later
          // graveyard UI workstream can consume graveIndex directly. The
          // engine treats graveIndex as authoritative for Retell.
          handIndex: sourceIndex,
          ...(retell ? { graveIndex: sourceIndex, retell: true } : {}),
          ...(hauntlinked ? { hauntlinked: true } : {}),
          ...(targets ? { targets } : {}),
          ...(sacrifices ? { sacrifices } : {}),
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

function castCost(
  d: CardDef,
  empowered: boolean,
  retell = false,
  hauntlinked = false,
): CardDef['cost'] {
  if (hauntlinked) return d.hauntlink?.cost;
  if (retell) return d.retell?.cost;
  if (!d.cost) return undefined;
  if (!empowered) return d.cost;
  return canEmpower(d) ? combineManaCosts(d.cost, d.empower!.cost) : undefined;
}

/** Printed Darling cost plus its accumulated generic command-zone tax. */
export function darlingCastCost(d: CardDef, tax: number): ManaCost | undefined {
  if (!d.cost) return undefined;
  return { generic: d.cost.generic + tax, pips: { ...d.cost.pips } };
}

const DARLING_PAYDOWN_MANA: ManaCost = { generic: DARLING_PAYDOWN_COST, pips: {} };

function castTargetSpecsFor(
  d: CardDef,
  retell: boolean,
  hauntlinked = false,
  empowered = false,
): ReturnType<typeof castTargetSpecs> {
  if (hauntlinked) return [{ what: 'yourCreature' }];
  // R4 Retell ops are trigger-safe and target-free. An override therefore
  // replaces the printed body's target requirements for that cast.
  if (retell && d.retell?.ops) return [];
  if (empowered && d.empower?.targets) return d.empower.targets;
  return castTargetSpecs(d);
}

function targetListsForCast(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  specs: readonly import('./types').TargetSpec[],
  empowered: boolean,
): (TargetRef[] | undefined)[] {
  if (specs.length === 0) return [undefined];
  const moveMark = empowered
    ? d.empower?.ops.some((op) => op.op === 'moveMark') ?? false
    : d.abilities?.some((ab) => ab.when === 'spell' && (ab.ops ?? []).some((op) => op.op === 'moveMark')) ?? false;
  const candidatesFor = (spec: import('./types').TargetSpec): TargetRef[] =>
    enumerateTargets(state, db, player, spec).filter((ref) =>
      !moveMark || (
        ref.kind === 'permanent' &&
        state.battlefield.find((perm) => perm.iid === ref.iid)?.controller === player
      ),
    );
  if (specs.length === 1 && specs[0].upTo !== undefined) {
    const candidates = candidatesFor(specs[0]);
    const out: TargetRef[][] = [[]];
    for (const candidate of candidates) out.push([candidate]);
    if (specs[0].upTo >= 2) {
      for (let first = 0; first < candidates.length; first++) {
        for (let second = first + 1; second < candidates.length; second++) {
          out.push([candidates[first], candidates[second]]);
        }
      }
    }
    return out;
  }
  const out: TargetRef[][] = [];
  const visit = (index: number, chosen: TargetRef[]): void => {
    if (index === specs.length) {
      if (moveMark && chosen.length === 2 && sameTarget(chosen[0], chosen[1])) return;
      out.push([...chosen]);
      return;
    }
    for (const candidate of candidatesFor(specs[index])) {
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
    const specs = castTargetSpecsFor(d, retell, false, empowered);
    if (targetListsForCast(state, db, player, d, specs, empowered).length > 0) return true;
  }
  return false;
}

function sameTarget(a: TargetRef | undefined, b: TargetRef | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
  if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
  if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
  if (a.kind === 'grave' && b.kind === 'grave') return a.player === b.player && a.index === b.index;
  return false;
}

function validateTargetList(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  specs: readonly import('./types').TargetSpec[],
  targets: TargetRef[],
  empowered: boolean,
): string | null {
  const moveMark = empowered
    ? d.empower?.ops.some((op) => op.op === 'moveMark') ?? false
    : d.abilities?.some((ab) => ab.when === 'spell' && (ab.ops ?? []).some((op) => op.op === 'moveMark')) ?? false;
  if (specs.length === 1 && specs[0].upTo !== undefined) {
    if (targets.length > specs[0].upTo) return 'too many targets';
    for (let index = 0; index < targets.length; index++) {
      if (targets.slice(0, index).some((prior) => sameTarget(prior, targets[index]))) {
        return 'upTo targets must be distinct';
      }
      const target = targets[index];
      if (!isLegalTarget(state, db, player, specs[0], target)) return 'illegal target';
    }
  } else {
    if (targets.length !== specs.length) return 'wrong number of targets';
    for (let i = 0; i < specs.length; i++) {
      if (!isLegalTarget(state, db, player, specs[i], targets[i])) return 'illegal target';
    }
  }
  if (moveMark) {
    if (
      targets.length !== 2 ||
      targets.some((target) => target.kind !== 'permanent') ||
      targets.some((target) => target.kind === 'permanent' &&
        state.battlefield.find((perm) => perm.iid === target.iid)?.controller !== player) ||
      sameTarget(targets[0], targets[1])
    ) return 'moveMark needs two distinct permanents you control';
  }
  return null;
}

function retellable(d: CardDef): boolean {
  return d.retell !== undefined && !d.x && (isType(d, 'ritual') || isType(d, 'charm'));
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

function darlingCastBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
  tax: number,
  x = d.x ? d.x.min : 0,
): string | null {
  if (!isType(d, 'creature') || !d.cost) return 'Darling has no creature mana cost';
  if (creatureCount(state, db, player) >= RULES.maxCreatures) return 'creature battlefield cap reached';
  const cost = darlingCastCost(d, tax)!;
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
  const specs = castTargetSpecs(d);
  const targetLists: (TargetRef[] | undefined)[] = specs.length === 0
    ? [undefined]
    : enumerateTargets(state, db, player, specs[0]).map((target) => [target]);
  for (const targets of targetLists) {
    for (const x of xs) {
      if (darlingCastBlockers(state, db, player, d, tax, x ?? 0) !== null) continue;
      out.push({ type: 'castDarling', ...(targets ? { targets } : {}), ...(x === undefined ? {} : { x }) });
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
): string | null {
  if (empowered && d.empower && validateEmpowerDef(d).length > 0) return 'invalid Empower definition';
  if (hauntlinked && !isHauntlinkCarrier(d)) return 'invalid Hauntlink carrier';
  if (!retell && !d.cost) return 'card has no mana cost';
  if (retell && !retellable(d)) return 'card cannot be Retold';
  const creatures = creatureCount(state, db, player);
  if (d.rite && creatures < d.rite.n) return 'not enough creatures for Rite';
  if (
    isType(d, 'creature') &&
    creatures - (d.rite?.n ?? 0) >= RULES.maxCreatures
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
  const cost = castCost(d, empowered, retell, hauntlinked);
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
          out.push({ type: 'preserveCard', graveIndex });
        }
      });
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
      break;
    }

    case 'declareAttackers': {
      // Fully enumerated: every subset of eligible attackers (≤ 2^8 under the
      // battlefield cap). [] skips combat.
      const eligible = eligibleAttackers(state.battlefield, db, player);
      const subsets = 1 << eligible.length;
      for (let mask = 0; mask < subsets; mask++) {
        const attackers = eligible.filter((_, i) => mask & (1 << i));
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
        const opts = blockOptions(state.battlefield, db, player, state.combat);
        const liveAttackers = state.combat.attackers.filter((a) =>
          state.battlefield.some((perm) => perm.iid === a),
        );
        const minBlockers = new Map(
          liveAttackers.map((a) => [a, minimumBlockersForAttacker(state.battlefield, db, a)]),
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
      break;
    }

    case 'discardToHandSize':
      for (const combo of combinations(me.hand.length, a.count)) {
        out.push({ type: 'discard', handIndices: combo });
      }
      break;

  }

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
      if (pending?.kind !== 'chooseTarget' || pending.player !== player) return 'no target decision is pending';
      if (!a.targets.some((target) => sameTarget(target, action.target))) return 'illegal target';
      return isLegalTarget(state, db, player, pending.spec, action.target, pending.sourceIid)
        ? null
        : 'illegal target';
    }

    case 'playLand': {
      if (a.kind !== 'main') return 'not in a main phase';
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
        return 'Preserve can only be used during your main phase';
      }
      if (!Number.isInteger(action.graveIndex)) return 'bad graveyard index';
      const card = me.graveyard[action.graveIndex];
      if (card === undefined) return 'bad graveyard index';
      const d = def(db, card);
      const blocked = preserveBlockers(state, db, player, d);
      if (blocked) return blocked;
      if (action.manaPlan) {
        return validateManaPlanForCost(state, db, player, d.preserve!.cost, action.manaPlan);
      }
      return null;
    }

    case 'castSpell': {
      const isRetell = action.retell === true;
      const isHauntlinked = action.hauntlinked === true;
      if (isRetell && isHauntlinked) return 'Retell and Hauntlink cannot be combined';
      if (isRetell && action.empowered) return 'Retell and Empower cannot be combined';
      if (isRetell && action.graveIndex === undefined) return 'Retell needs a graveyard index';
      if (!isRetell && action.graveIndex !== undefined) return 'graveyard index requires Retell';
      const sourceIndex = isRetell ? action.graveIndex! : action.handIndex;
      const cardId = isRetell ? me.graveyard[sourceIndex] : me.hand[sourceIndex];
      if (cardId === undefined) return 'bad hand index';
      const d = def(db, cardId);
      if (usesActivatedHauntlink(state) && isHauntlinked) {
        return 'Hauntlink is activated from the battlefield in this rules revision';
      }
      if (!castableNow(state, player, d)) return 'cannot cast this now';
      if (isRetell && !retellable(d)) return 'card cannot be Retold';
      if (isRetell && d.x) return 'X spells cannot be Retold';
      if (isHauntlinked && !d.hauntlink) return 'card has no Hauntlink option';
      if (isHauntlinked && (action.empowered || action.x !== undefined)) {
        return 'Hauntlink cannot combine with Empower or X';
      }
      if (action.empowered && !d.empower) return 'card has no Empower option';
      if (action.empowered && d.x) return 'X spells cannot be empowered';
      if (!d.rite && action.sacrifices !== undefined) return 'card has no Rite cost';
      if (d.rite) {
        if (!action.sacrifices || action.sacrifices.length !== d.rite.n) {
          return `Rite requires exactly ${d.rite.n} sacrifice${d.rite.n === 1 ? '' : 's'}`;
        }
        const seen = new Set<number>();
        for (const iid of action.sacrifices) {
          if (!Number.isInteger(iid)) return 'bad Rite sacrifice iid';
          if (seen.has(iid)) return 'duplicate Rite sacrifice';
          seen.add(iid);
          const perm = state.battlefield.find((candidate) => candidate.iid === iid);
          if (
            !perm ||
            perm.controller !== player ||
            !isType(def(db, perm.cardId), 'creature')
          ) {
            return 'Rite sacrifices must be creatures you control';
          }
        }
      }
      const blocked = castBlockers(
        state,
        db,
        player,
        d,
        action.empowered === true,
        action.x ?? 0,
        isRetell,
        isHauntlinked,
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
        );
        if (err) return err;
      } else {
        const cost = castCost(d, action.empowered === true, isRetell, isHauntlinked);
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
      const specs = castTargetSpecsFor(d, isRetell, isHauntlinked, action.empowered === true);
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
        a.kind === 'endStepWindow';
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
      if (a.kind !== 'main' || state.activePlayer !== player) return 'Darling casts need your main phase';
      if (me.darlingZone === undefined) return 'this game has no Darling zone';
      if (me.darlingZone === null) return 'Darling zone is empty';
      const d = def(db, me.darlingZone);
      if (!darlingCastableNow(state, player, d)) return 'cannot cast Darling now';
      if (d.x && (action.x === undefined || action.x < d.x.min)) return 'bad X';
      if (!d.x && action.x !== undefined) return 'Darling has no X';
      const blocked = darlingCastBlockers(state, db, player, d, me.darlingTax ?? 0, action.x ?? 0);
      if (blocked) return blocked;
      const cost = darlingCastCost(d, me.darlingTax ?? 0)!;
      if (action.manaPlan) {
        const err = validateManaPlanForCost(state, db, player, cost, action.manaPlan, action.x ?? 0);
        if (err) return err;
        if (action.manaPlan.length !== manaValue(cost) + (action.x ?? 0)) return 'mana plan has wrong source count';
      }
      const specs = castTargetSpecs(d);
      const targets = action.targets ?? [];
      if (targets.length !== specs.length) return 'wrong number of targets';
      for (let i = 0; i < specs.length; i++) {
        if (!isLegalTarget(state, db, player, specs[i], targets[i])) return 'illegal target';
      }
      return null;
    }

    case 'payDownDarlingTax': {
      if (a.kind !== 'main' || state.activePlayer !== player) return 'Darling tax can only be paid down in your main phase';
      if (me.darlingZone === undefined) return 'this game has no Darling zone';
      if ((me.darlingTax ?? 0) < DARLING_PAYDOWN_REDUCTION) return 'Darling tax is already zero';
      if (action.manaPlan) return validateManaPlanForCost(state, db, player, DARLING_PAYDOWN_MANA, action.manaPlan);
      return canPay(state, db, player, DARLING_PAYDOWN_MANA) ? null : 'cannot pay cost';
    }

    case 'declareAttackers':
      if (a.kind !== 'declareAttackers') return 'not declaring attackers';
      return validateAttackers(state.battlefield, db, player, action.attackers);

    case 'declareBlockers': {
      if (a.kind !== 'declareBlockers') return 'not declaring blockers';
      if (!state.combat) return 'no combat in progress';
      return validateBlocks(state.battlefield, db, player, state.combat, action.blocks);
    }

    case 'passResponse':
      return a.kind === 'respond' || a.kind === 'endStepWindow' ? null : 'no window open';

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
  const cost = castCost(d, empowered, retell, hauntlinked);
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
    if (a.kind !== 'main') return 'Lands can only be played during your main phase.';
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
  const specs = castTargetSpecs(d);
  if (specs.length > 0 && enumerateTargets(state, db, player, specs[0]).length === 0) {
    return 'There are no legal targets for this spell.';
  }

  return null; // castable
}

/** Any instant in hand or Retell Charm in the graveyard that `player` could pay AND target right now? (window auto-pass check) */
export function hasCastableInstant(state: GameState, db: CardDb, player: PlayerId): boolean {
  if (hasPayableHauntlinkAction(state, db, player)) return true;
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
  if (hasPayableHauntlinkAction(state, db, player)) return true;
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
    case 'declareAttackers':
      // Query legality directly — legalActions enumerates 2^n attack subsets.
      return eligibleAttackers(state.battlefield, db, player).length === 0
        ? { type: 'declareAttackers', attackers: [] }
        : null;
    case 'declareBlockers': {
      // blockOptions includes partial Dreaded pairs, so a lone individually
      // legal blocker is not proof a usable assignment exists. Answer the
      // existence question directly instead of materializing every combo.
      if (!state.combat) return null;
      const opts = blockOptions(state.battlefield, db, player, state.combat);
      const hasCompleteAssignment = state.combat.attackers.some((attacker) => {
        if (!state.battlefield.some((perm) => perm.iid === attacker)) return false;
        const minimum = minimumBlockersForAttacker(state.battlefield, db, attacker);
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
