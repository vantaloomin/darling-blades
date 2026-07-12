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
  | { type: 'scry'; bottomIndices: number[] }
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
  | { type: 'chooseBasicLand'; cardId: string } // which basic a deferred fetchLand grabs
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

    case 'scry':
      // Unlike London bottoming, scry permits any subset. Its picker reads
      // awaiting.cards directly; exposing every subset here would allocate
      // 2^n actions for a large scry. The empty pick is a canonical legal
      // fallback, while validateAction accepts every valid index set.
      out.push({ type: 'scry', bottomIndices: [] });
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
        if (!isType(d, 'charm')) return;
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

    case 'chooseBasicLand': {
      // One choice per distinct basic land type left in the deck, in a stable
      // (sorted-id) order so `legal[0]` is deterministic across shuffles.
      const seen = new Set<string>();
      for (const cardId of me.deck) {
        if (seen.has(cardId)) continue;
        if (def(db, cardId).supertypes?.includes('basic')) seen.add(cardId);
      }
      for (const cardId of [...seen].sort()) {
        out.push({ type: 'chooseBasicLand', cardId });
      }
      break;
    }
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

    case 'scry': {
      if (a.kind !== 'scry') return 'not scrying';
      return validIndexSet(action.bottomIndices, a.cards.length, 'scry');
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

    case 'chooseBasicLand': {
      if (a.kind !== 'chooseBasicLand') return 'not choosing a basic land';
      const inDeck = me.deck.includes(action.cardId);
      if (!inDeck) return 'basic not in deck';
      if (!def(db, action.cardId).supertypes?.includes('basic')) return 'not a basic land';
      return null;
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

/**
 * Player-facing copy for the internal castBlockers() reason strings. Those are
 * written for the enumerator/validator (terse, dev-ish); anything not mapped
 * here falls back to a generic line.
 */
const UNCASTABLE_COPY: Record<string, string> = {
  'cannot pay cost': 'Not enough mana to cast this.',
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

  if (isType(d, 'land')) {
    if (a.kind !== 'main') return 'Lands can only be played during your main phase.';
    if (me.landPlayedThisTurn) return 'You have already played a land this turn.';
    return null;
  }

  if (!castableNow(state, player, d)) {
    if (a.kind === 'respond' || a.kind === 'endStepWindow') return 'Only Charms can be cast in response.';
    if (a.kind === 'main' && player !== state.activePlayer) return 'You can only cast this on your own turn.';
    return "You can't cast this right now.";
  }

  const blocked = castBlockers(state, db, player, d);
  if (blocked) return UNCASTABLE_COPY[blocked] ?? "You can't cast this right now.";

  const specs = castTargetSpecs(d);
  if (specs.length > 0 && enumerateTargets(state, db, player, specs[0]).length === 0) {
    return 'There are no legal targets for this spell.';
  }

  return null; // castable
}

/** Any instant in hand that `player` could pay AND target right now? (window auto-pass check) */
export function hasCastableInstant(state: GameState, db: CardDb, player: PlayerId): boolean {
  const me = state.players[player];
  return me.hand.some((cardId) => {
    const d = def(db, cardId);
    if (!isType(d, 'charm')) return false;
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
