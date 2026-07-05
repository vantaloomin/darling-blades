import { RULES } from '../config/rules';
import {
  blockOptions,
  eligibleAttackers,
  validateAttackers,
  validateBlocks,
} from './combat/legality';
import { enumerateTargets, isLegalTarget } from './effects/targeting';
import { canPay, manaSources, maxPayableX, solveMana } from './mana';
import { castTargetSpecs } from './resolve';
import type { CardDb, CardDef, GameState, PlayerId, TargetRef } from './types';
import { def, isType, opponentOf } from './types';

export type Action =
  | { type: 'keepHand' }
  | { type: 'mulligan' }
  | { type: 'bottomCards'; handIndices: number[] }
  | { type: 'playLand'; handIndex: number }
  | {
      type: 'castSpell';
      handIndex: number;
      targets?: TargetRef[];
      x?: number;
      manaPlan?: number[]; // explicit source iids; omitted = auto-solve
    }
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

/** Enumerate fully-specified cast actions (× target × X) for one hand card. */
function pushCastActions(
  out: Action[],
  state: GameState,
  db: CardDb,
  player: PlayerId,
  handIndex: number,
  d: CardDef,
): void {
  const xs: (number | undefined)[] = d.x
    ? Array.from(
        { length: Math.max(0, maxPayableX(state, db, player, d.cost!) - d.x.min + 1) },
        (_, i) => d.x!.min + i,
      )
    : [undefined];
  if (xs.length === 0) return;

  const specs = castTargetSpecs(d);
  if (specs.length === 0) {
    for (const x of xs) {
      out.push(x === undefined ? { type: 'castSpell', handIndex } : { type: 'castSpell', handIndex, x });
    }
    return;
  }
  // Single-target v1: one action per (legal target × X).
  for (const target of enumerateTargets(state, db, player, specs[0])) {
    for (const x of xs) {
      out.push(
        x === undefined
          ? { type: 'castSpell', handIndex, targets: [target] }
          : { type: 'castSpell', handIndex, targets: [target], x },
      );
    }
  }
}

function creatureCount(state: GameState, db: CardDb, player: PlayerId): number {
  return state.battlefield.filter(
    (p) => p.controller === player && isType(def(db, p.cardId), 'creature'),
  ).length;
}

function noncreaturePermCount(state: GameState, db: CardDb, player: PlayerId): number {
  return state.battlefield.filter((p) => {
    if (p.controller !== player) return false;
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
  const instant = isType(d, 'instant');
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

/** Board-cap / dedup / payment checks shared by enumerator and validator. */
function castBlockers(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  d: CardDef,
): string | null {
  if (!d.cost) return 'card has no mana cost';
  if (isType(d, 'creature') && creatureCount(state, db, player) >= RULES.maxCreatures)
    return 'creature battlefield cap reached';
  if (
    !isType(d, 'creature') &&
    !isType(d, 'land') &&
    (isType(d, 'enchantment') || isType(d, 'artifact')) &&
    !isAura(d) &&
    noncreaturePermCount(state, db, player) >= RULES.maxNoncreaturePermanents
  )
    return 'noncreature permanent cap reached';
  if (!canPay(state, db, player, d.cost, d.x ? d.x.min : 0)) return 'cannot pay cost';
  return null;
}

/**
 * Cast-time target enumeration lives in effects/targeting.ts from M5 onward.
 * Until then, cards requiring targets are simply not enumerated.
 */
export function legalActions(state: GameState, db: CardDb, player: PlayerId): Action[] {
  const a = state.awaiting;
  if (a.kind === 'gameOver') return [];
  if (!('player' in a) || a.player !== player) return [];

  const me = state.players[player];
  const out: Action[] = [];

  switch (a.kind) {
    case 'mulligan':
      out.push({ type: 'keepHand' }, { type: 'mulligan' });
      break;

    case 'bottomCards':
      for (const combo of combinations(me.hand.length, a.count)) {
        out.push({ type: 'bottomCards', handIndices: combo });
      }
      break;

    case 'main': {
      out.push({ type: 'passStep' });
      const seen = new Set<string>();
      me.hand.forEach((cardId, handIndex) => {
        if (seen.has(cardId)) return; // dedupe identical copies
        seen.add(cardId);
        const d = def(db, cardId);
        if (isType(d, 'land')) {
          if (!me.landPlayedThisTurn) out.push({ type: 'playLand', handIndex });
          return;
        }
        if (!castableNow(state, player, d)) return;
        if (castBlockers(state, db, player, d) !== null) return;
        pushCastActions(out, state, db, player, handIndex, d);
      });
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
      // Relaxed enumeration: [] plus every single-block assignment. Composite
      // assignments are constructed via blockOptions() and validated through
      // the same combat/legality module.
      out.push({ type: 'declareBlockers', blocks: [] });
      if (state.combat) {
        for (const opt of blockOptions(state.battlefield, db, player, state.combat)) {
          for (const attacker of opt.canBlock) {
            out.push({
              type: 'declareBlockers',
              blocks: [{ blocker: opt.blocker, attacker }],
            });
          }
        }
      }
      break;
    }

    case 'respond':
    case 'endStepWindow': {
      out.push({ type: 'passResponse' });
      const seen = new Set<string>();
      me.hand.forEach((cardId, handIndex) => {
        if (seen.has(cardId)) return;
        seen.add(cardId);
        const d = def(db, cardId);
        if (!isType(d, 'instant')) return;
        if (!castableNow(state, player, d)) return;
        if (castBlockers(state, db, player, d) !== null) return;
        pushCastActions(out, state, db, player, handIndex, d);
      });
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
    case 'keepHand':
    case 'mulligan':
      return a.kind === 'mulligan' ? null : 'not in mulligan';

    case 'bottomCards': {
      if (a.kind !== 'bottomCards') return 'not bottoming';
      if (action.handIndices.length !== a.count) return `must bottom exactly ${a.count}`;
      return validIndexSet(action.handIndices, me.hand.length);
    }

    case 'playLand': {
      if (a.kind !== 'main') return 'not in a main phase';
      if (me.landPlayedThisTurn) return 'already played a land this turn';
      const cardId = me.hand[action.handIndex];
      if (cardId === undefined) return 'bad hand index';
      if (!isType(def(db, cardId), 'land')) return 'not a land';
      return null;
    }

    case 'castSpell': {
      const cardId = me.hand[action.handIndex];
      if (cardId === undefined) return 'bad hand index';
      const d = def(db, cardId);
      if (!castableNow(state, player, d)) return 'cannot cast this now';
      const blocked = castBlockers(state, db, player, d);
      if (blocked) return blocked;
      if (d.x && (action.x === undefined || action.x < d.x.min)) return 'bad X';
      if (!d.x && action.x !== undefined) return 'card has no X';
      const extra = action.x ?? 0;
      if (action.manaPlan) {
        const err = validateManaPlan(state, db, player, d, extra, action.manaPlan);
        if (err) return err;
      } else if (solveMana(state, db, player, d.cost!, extra) === null) {
        return 'cannot pay cost';
      }
      const specs = castTargetSpecs(d);
      const targets = action.targets ?? [];
      if (targets.length !== specs.length) return 'wrong number of targets';
      for (let i = 0; i < specs.length; i++) {
        if (!isLegalTarget(state, db, player, specs[i], targets[i])) return 'illegal target';
      }
      return null;
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

function validIndexSet(indices: number[], handSize: number): string | null {
  const seen = new Set<number>();
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i >= handSize) return 'bad hand index';
    if (seen.has(i)) return 'duplicate hand index';
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
  const solved = solveMana(state, db, player, d.cost!, extraGeneric, others);
  if (!solved) return 'mana plan cannot pay the cost';
  let needed = extraGeneric + d.cost!.generic;
  for (const v of Object.values(d.cost!.pips)) needed += v;
  if (plan.length !== needed) return 'mana plan has wrong source count';
  return null;
}

/** Any instant in hand that `player` could pay AND target right now? (window auto-pass check) */
export function hasCastableInstant(state: GameState, db: CardDb, player: PlayerId): boolean {
  const me = state.players[player];
  return me.hand.some((cardId) => {
    const d = def(db, cardId);
    if (!isType(d, 'instant')) return false;
    if (castBlockers(state, db, player, d) !== null) return false;
    const specs = castTargetSpecs(d);
    return specs.length === 0 || enumerateTargets(state, db, player, specs[0]).length > 0;
  });
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
 * Never forced: mulligan / bottomCards / discardToHandSize (real picks),
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
    case 'declareBlockers':
      // combat is always set while awaiting blockers; bail safely if not
      // (validateBlocks would reject any submission in that state).
      if (!state.combat) return null;
      return blockOptions(state.battlefield, db, player, state.combat).length === 0
        ? { type: 'declareBlockers', blocks: [] }
        : null;
    default:
      return null;
  }
}

export function defenderOf(state: GameState): PlayerId {
  return opponentOf(state.activePlayer);
}
