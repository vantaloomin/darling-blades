import type { Action } from '../engine/actions';
import { minimumBlockersForAttacker } from '../engine/combat/legality';
import type { Game } from '../engine/Game';
import type { CardDb, PlayerId } from '../engine/types';
import { opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { chooseAttackers, chooseBlocks } from './combatPlans';
import { determinize, simDb } from './determinize';
import { evaluate } from './evaluate';
import { MediumAI } from './MediumAI';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { choosePlayDraw } from './playDraw';

/**
 * Hard: Medium's heuristics as candidate generators, then honest simulation
 * on determinized clones — the real engine plays each candidate line through
 * sampled hidden-card worlds (see determinize.ts; SIM_SEEDS ships with one
 * world, the aggregation machinery scales to more) and the averaged
 * evaluation picks the winner. No hidden information is ever read.
 */
export class HardAI implements AIPlayer {
  private medium: MediumAI;
  /** The opponent's side in lookahead is modeled NEUTRALLY — we don't know
   *  their personality, and evaluation must stay a fair referee. */
  private neutralMedium: MediumAI;
  private sdb: CardDb;

  constructor(
    private readonly db: CardDb,
    private readonly pers: Personality = DEFAULT_PERSONALITY,
  ) {
    // Both brains get the stand-in-augmented db: inside lookahead worlds they
    // are handed sim views full of __unknown_* ids, and a raw-db brain throws
    // on those, silently collapsing the whole world to -Infinity. simDb is a
    // strict superset of db, so real-view decisions are unaffected.
    this.sdb = simDb(db);
    this.medium = new MediumAI(this.sdb, pers);
    this.neutralMedium = new MediumAI(this.sdb, DEFAULT_PERSONALITY);
  }

  chooseAction(view: PlayerView, legal: Action[]): Action {
    switch (view.awaiting.kind) {
      case 'choosePlayDraw':
        return choosePlayDraw(legal);
      case 'main':
        return this.searchMain(view, legal);
      case 'declareAttackers':
        return this.searchAttack(view, legal);
      case 'declareBlockers':
        return this.searchBlocks(view);
      case 'respond':
      case 'endStepWindow':
        return this.searchResponse(view, legal);
      default:
        // mulligans/bottoming/discard: Medium's bands are already solid
        return this.medium.chooseAction(view, legal);
    }
  }

  // -------------------------------------------------------------------
  /** Determinization seeds — one plausible hidden-card world each; scores
   * are averaged across worlds. At the shipped conservative model every
   * world is identical (see determinize.ts on why richer models measured
   * worse), so a single seed carries the full signal; add seeds here if the
   * hidden-card priors ever become probabilistic again. */
  private static readonly SIM_SEEDS = [1] as const;

  /** A line's consequences averaged over the determinization worlds. */
  private aggregateOutcome(
    view: PlayerView,
    actions: Action[],
  ): { score: number; wonAll: boolean; lostAny: boolean } | null {
    let total = 0;
    let wonAll = true;
    let lostAny = false;
    for (const seed of HardAI.SIM_SEEDS) {
      const out = this.simulateOutcome(view, actions, seed);
      if (!out) return null; // my own line is illegal — same in every world
      total += out.score;
      wonAll &&= out.won;
      lostAny ||= out.lost;
    }
    return { score: total / HardAI.SIM_SEEDS.length, wonAll, lostAny };
  }

  /** Play `actions` in one determinized world; evaluate at a stable point. */
  private simulateOutcome(
    view: PlayerView,
    actions: Action[],
    seed: number,
  ): { score: number; won: boolean; lost: boolean } | null {
    const me = view.myId;
    const opp = opponentOf(me);
    let game: Game;
    try {
      game = determinize(view, this.db, seed);
    } catch {
      return null;
    }

    for (const action of actions) {
      const a = game.awaiting;
      if (a.kind === 'gameOver') break;
      if (!('player' in a) || a.player !== me) break;
      try {
        game.submit(me, action);
      } catch {
        return null;
      }
      this.autoplayOpponent(game, me);
    }
    // Settle any window chain the opponent's responses opened for us, so the
    // evaluation happens at a stable point (stack flushed, damage resolved)
    // instead of mid-stack.
    for (let guard = 0; guard < 20; guard++) {
      const a = game.awaiting;
      if (a.kind !== 'respond' && a.kind !== 'endStepWindow') break;
      if (a.player !== me) break;
      try {
        game.submit(me, this.medium.chooseAction(game.viewFor(me), game.legalActions(me)));
      } catch {
        return null;
      }
      this.autoplayOpponent(game, me);
    }
    return {
      score: evaluate(game.state, this.sdb, me),
      won: game.state.winner === me,
      lost: game.state.winner === opp,
    };
  }

  /** In simulation the opponent blocks with our shared heuristic and plays
   * response windows with the neutral Medium policy. (Under the shipped
   * inert hidden-card model it never holds a castable instant, so windows
   * still auto-skip — but the hook is live for any future model that deals
   * the opponent stand-in interaction.) */
  private autoplayOpponent(game: Game, me: PlayerId): void {
    const opp = opponentOf(me);
    for (let guard = 0; guard < 30; guard++) {
      const a = game.awaiting;
      if (a.kind === 'gameOver' || !('player' in a) || a.player !== opp) return;
      if (a.kind === 'declareBlockers') {
        const st = game.state;
        const blocks = st.combat
          ? chooseBlocks(st.battlefield, this.sdb, opp, st.players[opp].life, st.combat, 0)
          : [];
        try {
          game.submit(opp, { type: 'declareBlockers', blocks });
        } catch {
          game.submit(opp, { type: 'declareBlockers', blocks: [] });
        }
      } else if (a.kind === 'respond' || a.kind === 'endStepWindow') {
        try {
          game.submit(opp, this.neutralMedium.chooseAction(game.viewFor(opp), game.legalActions(opp)));
        } catch {
          game.submit(opp, { type: 'passResponse' });
        }
      } else if (a.kind === 'discardToHandSize') {
        game.submit(opp, {
          type: 'discard',
          handIndices: Array.from({ length: a.count }, (_, i) => i),
        });
      } else if (a.kind === 'foresee') {
        game.submit(opp, this.neutralMedium.chooseAction(game.viewFor(opp), game.legalActions(opp)));
      } else {
        return; // their main/attack decisions end our simulation horizon
      }
    }
  }

  // -------------------------------------------------------------------
  /**
   * Main phase: trust Medium's proven casting policy outright — the sim's
   * value-add lives in combat and response decisions, where the engine's
   * exact first-strike/trample/deathtouch math beats any heuristic.
   */
  private searchMain(view: PlayerView, legal: Action[]): Action {
    const baseline = this.medium.chooseAction(view, legal);
    const empowered = legal.filter(
      (a): a is Extract<Action, { type: 'castSpell' }> =>
        a.type === 'castSpell' && a.empowered === true,
    );
    if (empowered.length === 0) return baseline;

    const base = this.aggregateOutcome(view, [baseline]);
    if (!base) return baseline; // own line illegal in the sim; trust Medium
    let best = baseline;
    let bestScore = base.score;
    // Cap the sim fanout: empowered variants scale with target count.
    for (const candidate of empowered.slice(0, 8)) {
      const outcome = this.aggregateOutcome(view, [candidate]);
      if (outcome && outcome.score > bestScore) {
        best = candidate;
        bestScore = outcome.score;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------
  /**
   * Attacks: Medium's plan is the baseline. Deviate only when a candidate
   * set clears the baseline by a real margin in the averaged full-turn
   * lookahead (or the baseline already wins outright) — small deltas are
   * opponent-model noise.
   */
  private searchAttack(view: PlayerView, legal: Action[]): Action {
    const bf = view.battlefield;
    const mediumSet = chooseAttackers(
      bf,
      this.db,
      view.myId,
      view.opp.life,
      this.openManaBuff(view),
      view.you.life,
      this.pers,
    );
    const allIn = legal
      .filter((l): l is Extract<Action, { type: 'declareAttackers' }> => l.type === 'declareAttackers')
      .reduce((a, b) => (a.attackers.length >= b.attackers.length ? a : b)).attackers;

    // Full-turn lookahead: each candidate plays through the opponent's whole
    // counterattack turn before evaluation, so the race is visible.
    const baseScore = this.lookahead(view, { type: 'declareAttackers', attackers: mediumSet });
    if (baseScore >= 1e5) return { type: 'declareAttackers', attackers: mediumSet };

    const candidates: number[][] = [allIn, []];
    for (const drop of mediumSet.slice(0, 6)) {
      candidates.push(mediumSet.filter((iid) => iid !== drop));
    }
    // drop-two variants — over-extension often hides behind any single drop
    for (let i = 0; i < Math.min(mediumSet.length, 5); i++) {
      for (let j = i + 1; j < Math.min(mediumSet.length, 5); j++) {
        candidates.push(mediumSet.filter((iid) => iid !== mediumSet[i] && iid !== mediumSet[j]));
      }
    }
    // add-one variants: Medium may be too shy — let the lookahead judge
    const mediumKey = new Set(mediumSet);
    for (const extra of allIn.filter((iid) => !mediumKey.has(iid)).slice(0, 4)) {
      candidates.push([...mediumSet, extra]);
    }

    let best = mediumSet;
    let bestScore = baseScore + 0.75; // small margin over the baseline
    const seen = new Set<string>([[...mediumSet].sort((a, b) => a - b).join(',')]);
    for (const set of candidates) {
      const key = [...set].sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const score = this.lookahead(view, { type: 'declareAttackers', attackers: set });
      if (score > bestScore) {
        bestScore = score;
        best = set;
        if (score >= 1e5) break;
      }
    }
    return { type: 'declareAttackers', attackers: best };
  }

  /** Take this action, then play BOTH sides with the shared policy until our
   * next main phase; evaluate there. Captures counterattack races. Averaged
   * over the determinization worlds. */
  private lookahead(view: PlayerView, first: Action): number {
    let total = 0;
    for (const seed of HardAI.SIM_SEEDS) {
      total += this.lookaheadWorld(view, first, seed);
    }
    return total / HardAI.SIM_SEEDS.length;
  }

  private lookaheadWorld(view: PlayerView, first: Action, seed: number): number {
    const me = view.myId;
    let game: Game;
    try {
      game = determinize(view, this.db, seed);
      game.submit(me, first);
    } catch {
      return -Infinity;
    }
    const startTurn = game.state.turn;
    for (let guard = 0; guard < 120; guard++) {
      const a = game.awaiting;
      if (a.kind === 'gameOver') break;
      if (!('player' in a)) break;
      // one full turn cycle — deeper horizons amplify opponent-model error
      if (a.player === me && a.kind === 'main' && game.state.turn > startTurn) break;
      try {
        const p = a.player;
        // My side plays with my personality; the opponent stays neutral.
        const brain = p === me ? this.medium : this.neutralMedium;
        game.submit(p, brain.chooseAction(game.viewFor(p), game.legalActions(p)));
      } catch {
        return -Infinity;
      }
    }
    return evaluate(game.state, this.sdb, me);
  }

  /**
   * Blocks: Medium's plan is the baseline, then the engine plays each
   * candidate assignment through combat damage — blocks resolve THIS turn on
   * public information, so the sim's exact first-strike/trample/deathtouch
   * math is at its most trustworthy here. Deviate on a real margin (or to
   * dodge a simulated loss).
   */
  private searchBlocks(view: PlayerView): Action {
    if (!view.combat) return { type: 'declareBlockers', blocks: [] };
    const me = view.myId;
    const mediumBlocks = chooseBlocks(
      view.battlefield,
      this.db,
      me,
      view.you.life,
      view.combat,
      this.openManaBuff(view),
      this.pers,
    );
    const outcomeOf = (blocks: { blocker: number; attacker: number }[]) =>
      this.aggregateOutcome(view, [{ type: 'declareBlockers', blocks }]);
    const base = outcomeOf(mediumBlocks);
    if (!base) return { type: 'declareBlockers', blocks: mediumBlocks };

    // Greedy hill-climb from Medium's plan: at each round try every single
    // modification — unblock one, add a free blocker to any attacker (gang
    // blocks included), or move an assigned blocker to a different attacker.
    const myCreatures = view.battlefield.filter(
      (p) => p.controller === me && !p.tapped && this.db[p.cardId]?.types.includes('creature'),
    );
    const attackers = view.combat.attackers;
    const neighborhood = (
      plan: { blocker: number; attacker: number }[],
    ): { blocker: number; attacker: number }[][] => {
      const out: { blocker: number; attacker: number }[][] = [];
      const used = new Set(plan.map((b) => b.blocker));
      for (const b of plan) out.push(plan.filter((x) => x !== b)); // unblock one
      for (const attacker of attackers) {
        // An attacker can die to a response before blocks — no stats to read.
        if (!view.battlefield.some((p) => p.iid === attacker)) continue;
        const gang = plan.filter((b) => b.attacker === attacker).length;
        if (gang >= 3) continue;
        const free = myCreatures.filter((c) => !used.has(c.iid));
        if (gang === 0 && minimumBlockersForAttacker(view.battlefield, this.db, attacker) === 2) {
          // A single add to an unblocked Dreaded attacker is illegal, so the
          // climb could never reach a gang block: mutate by whole pairs.
          for (let i = 0; i < free.length; i++) {
            for (let j = i + 1; j < free.length; j++) {
              out.push([
                ...plan,
                { blocker: free[i].iid, attacker },
                { blocker: free[j].iid, attacker },
              ]);
            }
          }
          continue;
        }
        for (const c of free) {
          out.push([...plan, { blocker: c.iid, attacker }]); // add / gang up
        }
      }
      for (const b of plan) {
        for (const attacker of attackers) {
          if (attacker === b.attacker) continue;
          out.push(plan.map((x) => (x === b ? { blocker: b.blocker, attacker } : x))); // move
        }
      }
      return out.slice(0, 24);
    };

    let best = mediumBlocks;
    // A real margin over the baseline — small eval deltas are model noise.
    let bestScore = base.lostAny ? base.score : base.score + 1.5;
    let current = mediumBlocks;
    let currentScore = base.score;
    for (let round = 0; round < 4; round++) {
      let improved = false;
      for (const blocks of neighborhood(current)) {
        const out = outcomeOf(blocks);
        if (!out) continue; // illegal assignment (e.g. flying) — skip
        if (out.score > currentScore + 1e-9) {
          currentScore = out.score;
          current = blocks;
          improved = true;
        }
        if (out.score > bestScore) {
          bestScore = out.score;
          best = blocks;
        }
      }
      if (!improved) break;
    }
    return { type: 'declareBlockers', blocks: best };
  }

  /** Responses: Medium's rule list, upgraded when a cast simulates to a
   * clearly better position (terminal discoveries included for free — a win
   * or a dodged loss clears any margin). */
  private searchResponse(view: PlayerView, legal: Action[]): Action {
    const mediumChoice = this.medium.chooseAction(view, legal);
    const casts = legal.filter((l) => l.type === 'castSpell').slice(0, 10);
    if (casts.length === 0) return mediumChoice;
    const base = this.aggregateOutcome(view, [mediumChoice]);
    if (!base || base.wonAll) return mediumChoice;
    let best = mediumChoice;
    let bestScore = base.lostAny ? base.score : base.score + 1.5;
    for (const cast of casts) {
      if (JSON.stringify(cast) === JSON.stringify(mediumChoice)) continue;
      const out = this.aggregateOutcome(view, [cast]);
      if (out && out.score > bestScore) {
        bestScore = out.score;
        best = cast;
      }
    }
    return best;
  }

  private openManaBuff(view: PlayerView): number {
    const opp = opponentOf(view.myId);
    const open = view.battlefield.filter(
      (p) => p.controller === opp && !p.tapped && (this.db[p.cardId]?.manaAbility?.length ?? 0) > 0,
    ).length;
    if (open < 2 || view.opp.handCount < 1) return 0;
    // Same evidence gate as MediumAI.trickBuff (see the measurement history
    // there): open mana is only a trick threat once the opponent has shown an
    // instant this game. Kept personality-neutral — combat baselines stay a
    // fair referee.
    const shownInstant = view.opp.graveyard.some((c) =>
      this.db[c]?.types.includes('charm'),
    );
    return shownInstant ? 2 : 0;
  }
}
