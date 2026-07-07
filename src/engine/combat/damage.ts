import { fireTriggers } from '../effects/EffectInterpreter';
import { checkStateBased } from '../sba';
import { endGame } from '../phases';
import { getEffectiveStats } from '../statics';
import type { Emit } from '../battlefield';
import type { CardDb, GameState, PlayerId, TargetRef } from '../types';
import { opponentOf } from '../types';

interface Hit {
  source: number; // attacker or blocker iid
  sourceController: PlayerId;
  target: TargetRef;
  amount: number;
  deathtouch: boolean;
  lifelink: boolean;
}

/**
 * Resolve combat damage: an automatic first-strike sub-step (only if some
 * combatant has first strike), SBAs between sub-steps, then normal damage.
 * Modern simultaneous damage — all hits are computed against the pre-damage
 * board, then applied at once.
 */
export function resolveCombatDamage(state: GameState, db: CardDb, emit: Emit): void {
  const combat = state.combat;
  if (!combat) throw new Error('resolveCombatDamage: no combat');

  if (combat.damagePrevented || state.fogThisTurn) return; // fog

  const anyFirstStrike = [...combat.attackers, ...combat.blocks.map((b) => b.blocker)].some(
    (iid) => {
      if (!state.battlefield.some((p) => p.iid === iid)) return false;
      const kw = getEffectiveStats(state.battlefield, db, iid).keywords;
      return kw.has('firstBlade') || kw.has('twinBlades');
    },
  );

  if (anyFirstStrike) {
    dealCombatDamage(state, db, emit, true);
    checkStateBased(state, db, emit);
    if (state.winner !== null) return;
    combat.phase = 'firstStrikeDone';
  }

  dealCombatDamage(state, db, emit, false);
  checkStateBased(state, db, emit);
}

export interface CombatPreview {
  /** iids of creatures that leave the battlefield as a result of this combat. */
  deaths: number[];
  /** Net life change per player (index = PlayerId); negative = life lost. */
  lifeDelta: [number, number];
  /** Would the defending player be reduced to 0 or less life? */
  defenderLethal: boolean;
}

/**
 * Pure, read-only forecast of a combat resolution: given the current attackers
 * (state.combat) and a hypothetical block assignment, predict which creatures
 * die and the life swing — WITHOUT mutating state or emitting. Runs the real
 * resolveCombatDamage on a structuredClone, so first-strike ordering,
 * deathtouch, trample, and lethal auto-assignment stay exactly consistent with
 * the live outcome (no re-implementation to drift). Combat triggers are only
 * enqueued on the clone's stack, never resolved, so the preview reads the direct
 * board/life result and needs no target choices. View-safe: no Phaser, no writes
 * to the input state.
 */
export function previewCombat(
  state: GameState,
  db: CardDb,
  blocks: { blocker: number; attacker: number }[],
): CombatPreview {
  if (!state.combat) return { deaths: [], lifeDelta: [0, 0], defenderLethal: false };

  const sim = structuredClone(state);
  sim.combat!.blocks = blocks.map((b) => ({ blocker: b.blocker, attacker: b.attacker }));
  sim.combat!.damagePrevented = false;

  const beforeLife: [number, number] = [state.players[0].life, state.players[1].life];
  const aliveBefore = new Set(state.battlefield.map((p) => p.iid));

  resolveCombatDamage(sim, db, () => {}); // no-op emit: mutate the clone, drop events

  const deaths = [...aliveBefore].filter((iid) => !sim.battlefield.some((p) => p.iid === iid));
  const defender = opponentOf(state.activePlayer);
  return {
    deaths,
    lifeDelta: [sim.players[0].life - beforeLife[0], sim.players[1].life - beforeLife[1]],
    defenderLethal: sim.players[defender].life <= 0,
  };
}

function dealCombatDamage(
  state: GameState,
  db: CardDb,
  emit: Emit,
  firstStrikeStep: boolean,
): void {
  const combat = state.combat!;
  const defender = opponentOf(state.activePlayer);
  const alive = (iid: number): boolean => state.battlefield.some((p) => p.iid === iid);

  const strikesNow = (iid: number): boolean => {
    const kw = getEffectiveStats(state.battlefield, db, iid).keywords;
    const fs = kw.has('firstBlade');
    const ds = kw.has('twinBlades');
    // FS step: first-strikers and double-strikers. Normal step: double-strikers
    // (again) and everyone without first strike. fs+ds ⇒ 2 hits, not 3.
    return firstStrikeStep ? fs || ds : ds || !fs;
  };

  const hits: Hit[] = [];

  // Attackers deal damage.
  for (const attackerIid of combat.attackers) {
    if (!alive(attackerIid) || !strikesNow(attackerIid)) continue;
    const stats = getEffectiveStats(state.battlefield, db, attackerIid);
    if (stats.attack <= 0) continue;
    const kw = stats.keywords;
    const wasBlocked = combat.blocks.some((b) => b.attacker === attackerIid);
    const livingBlockers = combat.blocks
      .filter((b) => b.attacker === attackerIid && alive(b.blocker))
      .map((b) => b.blocker);

    if (!wasBlocked) {
      hits.push({
        source: attackerIid,
        sourceController: state.activePlayer,
        target: { kind: 'player', player: defender },
        amount: stats.attack,
        deathtouch: kw.has('deathblade'),
        lifelink: kw.has('bloodoath'),
      });
      continue;
    }

    if (livingBlockers.length === 0) {
      // Blocked, but all blockers are gone (first strike casualties): only
      // trample lets the damage through.
      if (kw.has('overrun')) {
        hits.push({
          source: attackerIid,
          sourceController: state.activePlayer,
          target: { kind: 'player', player: defender },
          amount: stats.attack,
          deathtouch: kw.has('deathblade'),
          lifelink: kw.has('bloodoath'),
        });
      }
      continue;
    }

    // Auto-assignment: cheapest-to-kill blockers first (deathtouch → 1 is
    // lethal); lethal must be assigned to each blocker before trample
    // overflow; without trample, the excess is wasted on the last blocker.
    const ordered = [...livingBlockers].sort((a, b) => killCost(state, db, a, kw.has('deathblade')) - killCost(state, db, b, kw.has('deathblade')));
    let remaining = stats.attack;
    ordered.forEach((blockerIid, i) => {
      if (remaining <= 0) return;
      const need = killCost(state, db, blockerIid, kw.has('deathblade'));
      const isLast = i === ordered.length - 1;
      let assign: number;
      if (kw.has('overrun')) {
        assign = Math.min(remaining, need);
      } else {
        assign = isLast ? remaining : Math.min(remaining, need);
      }
      if (assign > 0) {
        hits.push({
          source: attackerIid,
          sourceController: state.activePlayer,
          target: { kind: 'permanent', iid: blockerIid },
          amount: assign,
          deathtouch: kw.has('deathblade'),
          lifelink: kw.has('bloodoath'),
        });
        remaining -= assign;
      }
    });
    if (kw.has('overrun') && remaining > 0) {
      hits.push({
        source: attackerIid,
        sourceController: state.activePlayer,
        target: { kind: 'player', player: defender },
        amount: remaining,
        deathtouch: kw.has('deathblade'),
        lifelink: kw.has('bloodoath'),
      });
    }
  }

  // Blockers strike back.
  for (const block of combat.blocks) {
    if (!alive(block.blocker) || !alive(block.attacker)) continue;
    if (!strikesNow(block.blocker)) continue;
    const stats = getEffectiveStats(state.battlefield, db, block.blocker);
    if (stats.attack <= 0) continue;
    hits.push({
      source: block.blocker,
      sourceController: defender,
      target: { kind: 'permanent', iid: block.attacker },
      amount: stats.attack,
      deathtouch: stats.keywords.has('deathblade'),
      lifelink: stats.keywords.has('bloodoath'),
    });
  }

  if (hits.length === 0) return;

  emit({
    e: 'combatDamage',
    hits: hits.map((h) => ({ source: h.source, target: h.target, amount: h.amount })),
    firstStrike: firstStrikeStep,
  });

  // Apply simultaneously.
  for (const hit of hits) {
    if (hit.target.kind === 'permanent') {
      const targetIid = hit.target.iid;
      const perm = state.battlefield.find((p) => p.iid === targetIid);
      if (perm) {
        perm.damage += hit.amount;
        if (hit.deathtouch) perm.deathtouched = true;
        emit({ e: 'damageMarked', iid: perm.iid, amount: hit.amount });
      }
    } else if (hit.target.kind === 'player') {
      const p = state.players[hit.target.player];
      p.life -= hit.amount;
      emit({ e: 'lifeChanged', player: hit.target.player, delta: -hit.amount, now: p.life });
      // combatDamageToPlayer triggers fire here from M5.
    }
    if (hit.lifelink && hit.amount > 0) {
      const healed = state.players[hit.sourceController];
      healed.life += hit.amount;
      emit({
        e: 'lifeChanged',
        player: hit.sourceController,
        delta: hit.amount,
        now: healed.life,
      });
    }
  }

  // combat-damage-to-player triggers, after all simultaneous damage lands
  for (const hit of hits) {
    if (state.winner !== null) return;
    if (hit.target.kind === 'player' && hit.amount > 0) {
      const src = state.battlefield.find((p) => p.iid === hit.source);
      if (src) fireTriggers(state, db, emit, 'combatDamageToPlayer', src);
    }
  }
}

/** Damage still needed to kill a blocker (deathtouch source → 1 is lethal). */
function killCost(
  state: GameState,
  db: CardDb,
  iid: number,
  sourceHasDeathtouch: boolean,
): number {
  if (sourceHasDeathtouch) return 1;
  const stats = getEffectiveStats(state.battlefield, db, iid);
  const perm = state.battlefield.find((p) => p.iid === iid)!;
  return Math.max(1, stats.defense - perm.damage);
}

// endGame is re-exported for Game.ts convenience when combat ends the game.
export { endGame };
