import type { Action } from '../engine/actions';
import { blockOptions, minimumBlockersForAttacker } from '../engine/combat/legality';
import { createRngState, rngFloat, rngInt, type RngState } from '../engine/rng';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb } from '../engine/types';
import { def, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { chooseForesee } from './foresee';
import { choosePlayDraw } from './playDraw';
import { empowerValue } from './value';

/**
 * Easy: plays lands, curves out roughly, and swings — but loses by tactics.
 * Deliberate weaknesses (from the plan): all-in-or-nothing attacks, single
 * blocks only, no chump blocking until life ≤ 5, never holds up instant mana,
 * passes 85% of response windows, keeps almost any opening hand, and picks a
 * random legal action 20% of the time in main phases.
 */
export class EasyAI implements AIPlayer {
  private rng: RngState;

  constructor(
    private readonly db: CardDb,
    seed: number,
    private readonly pers: Personality = DEFAULT_PERSONALITY,
  ) {
    this.rng = createRngState(seed);
  }

  chooseAction(view: PlayerView, legal: Action[]): Action {
    const a = view.awaiting;
    switch (a.kind) {
      case 'choosePlayDraw':
        return choosePlayDraw(legal);
      case 'mulligan':
        return this.mulligan(view);
      case 'bottomCards':
        return this.bottom(view, legal);
      case 'foresee':
        return chooseForesee(view, this.db);
      case 'main':
        return this.main(view, legal);
      case 'declareAttackers':
        return this.attack(view, legal);
      case 'declareBlockers':
        return this.block(view);
      case 'respond':
      case 'endStepWindow':
        return this.respond(legal);
      case 'discardToHandSize':
        return legal[rngInt(this.rng, Math.max(1, legal.length - 1))]; // skip concede at end
      default:
        return legal[0];
    }
  }

  private landsInHand(view: PlayerView): number {
    return view.you.hand.filter((c) => isType(def(this.db, c), 'land')).length;
  }

  private mulligan(view: PlayerView): Action {
    if (view.you.mulligans >= 2) return { type: 'keepHand' };
    const lands = this.landsInHand(view);
    // Wide keep band [1,6] — Easy keeps bad hands.
    return lands >= 1 && lands <= 6 ? { type: 'keepHand' } : { type: 'mulligan' };
  }

  private bottom(view: PlayerView, legal: Action[]): Action {
    // Bottom the highest-mana-value cards (a land instead when flooded).
    const hand = view.you.hand;
    const count = view.awaiting.kind === 'bottomCards' ? view.awaiting.count : 1;
    const lands = this.landsInHand(view);
    const indices = hand
      .map((c, i) => ({ i, d: def(this.db, c) }))
      .sort((x, y) => {
        const landScore = (e: { d: ReturnType<typeof def> }): number =>
          isType(e.d, 'land') ? (lands > hand.length - lands ? 100 : -100) : 0;
        return (
          landScore(y) + manaValue(y.d.cost) - (landScore(x) + manaValue(x.d.cost))
        );
      })
      .slice(0, count)
      .map((e) => e.i)
      .sort((x, y) => x - y);
    const match = legal.find(
      (l) => l.type === 'bottomCards' && JSON.stringify(l.handIndices) === JSON.stringify(indices),
    );
    return match ?? legal[0];
  }

  private main(view: PlayerView, legal: Action[]): Action {
    const nonConcede = legal.filter((l) => l.type !== 'concede');
    if (rngFloat(this.rng) < this.pers.easyNoise) {
      return nonConcede[rngInt(this.rng, nonConcede.length)];
    }
    const land = nonConcede.find((l) => l.type === 'playLand');
    if (land) return land;

    const casts = nonConcede.filter((l) => l.type === 'castSpell');
    if (casts.length > 0) {
      // Cast the biggest thing it can afford.
      casts.sort((x, y) => {
        const mv = (c: Extract<Action, { type: 'castSpell' }>): number =>
          manaValue(def(this.db, view.you.hand[c.handIndex]).cost) +
          (c.x ?? 0) +
          (c.empowered ? empowerValue(this.db, view.you.hand[c.handIndex]) + 0.01 : 0);
        return mv(y as Extract<Action, { type: 'castSpell' }>) - mv(x as Extract<Action, { type: 'castSpell' }>);
      });
      return casts[0];
    }
    return nonConcede.find((l) => l.type === 'passStep') ?? nonConcede[0];
  }

  private attack(view: PlayerView, legal: Action[]): Action {
    const attacks = legal.filter(
      (l): l is Extract<Action, { type: 'declareAttackers' }> =>
        l.type === 'declareAttackers',
    );
    const allIn = attacks.reduce((best, a) =>
      a.attackers.length > best.attackers.length ? a : best,
    );
    const none = attacks.find((a) => a.attackers.length === 0)!;

    const opp = opponentOf(view.myId);
    const myCreatures = allIn.attackers.length;
    const oppUntapped = view.battlefield.filter(
      (p) =>
        p.controller === opp &&
        !p.tapped &&
        isType(def(this.db, p.cardId), 'creature'),
    ).length;
    // All-in or nothing — the signature Easy weakness. `easyAllIn` slack lets
    // an aggressive Easy swing into slightly more blockers (default 0).
    const blockerDemand = allIn.attackers.reduce((n, iid) => {
      return n + minimumBlockersForAttacker(view.battlefield, this.db, iid);
    }, 0);
    // Attack when the swing demands at least as many blockers as they have
    // untapped (dreaded attackers demand two): the pre-dreaded gate
    // generalized from attacker count to blocker demand.
    return blockerDemand + this.pers.easyAllIn >= oppUntapped && myCreatures > 0 ? allIn : none;
  }

  private block(view: PlayerView): Action {
    if (!view.combat) return { type: 'declareBlockers', blocks: [] };
    const options = blockOptions(view.battlefield, this.db, view.myId, view.combat);
    const blocks: { blocker: number; attacker: number }[] = [];
    const usedBlockers = new Set<number>();
    const blockedAttackers = new Set<number>();

    const attackerPower = (iid: number): number =>
      getEffectiveStats(view.battlefield, this.db, iid).attack;
    const attackers = [...view.combat.attackers]
      .filter((iid) => view.battlefield.some((p) => p.iid === iid))
      .sort((a, b) => attackerPower(b) - attackerPower(a));

    const desperate = view.you.life <= 5;
    for (const attacker of attackers) {
      if (blockedAttackers.has(attacker)) continue;
      const atk = getEffectiveStats(view.battlefield, this.db, attacker);
      const candidates = options.filter(
        (o) => !usedBlockers.has(o.blocker) && o.canBlock.includes(attacker),
      );
      let choices: number[] = [];
      if (minimumBlockersForAttacker(view.battlefield, this.db, attacker) === 2) {
        for (let i = 0; i < candidates.length && choices.length === 0; i++) {
          const first = getEffectiveStats(view.battlefield, this.db, candidates[i].blocker);
          for (let j = i + 1; j < candidates.length; j++) {
            const second = getEffectiveStats(view.battlefield, this.db, candidates[j].blocker);
            const kills = first.attack + second.attack >= atk.defense ||
              first.keywords.has('deathblade') || second.keywords.has('deathblade');
            // Commit the pair only when it kills; otherwise chump only when
            // desperate (the single-block philosophy, pair-sized).
            if (kills || desperate) {
              choices = [candidates[i].blocker, candidates[j].blocker];
              break;
            }
          }
        }
      } else {
        for (const c of candidates) {
          const blk = getEffectiveStats(view.battlefield, this.db, c.blocker);
          const kills = blk.attack >= atk.defense || blk.keywords.has('deathblade');
          const survives = blk.defense > atk.attack && !atk.keywords.has('deathblade');
          if (kills || survives || (desperate && candidates.length > 0)) {
            choices = [c.blocker];
            break;
          }
        }
      }
      if (choices.length > 0) {
        for (const blocker of choices) {
          blocks.push({ blocker, attacker });
          usedBlockers.add(blocker);
        }
        blockedAttackers.add(attacker);
      }
    }
    return { type: 'declareBlockers', blocks };
  }

  private respond(legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    if (rngFloat(this.rng) < this.pers.easyPassRate) return pass;
    const casts = legal.filter((l) => l.type === 'castSpell');
    if (casts.length === 0) return pass;
    return casts[rngInt(this.rng, casts.length)];
  }
}
