import type { Action } from '../engine/actions';
import { blockOptions, compelledAttackers, eligibleAttackers, minimumBlockersForAttacker } from '../engine/combat/legality';
import { createRngState, rngFloat, rngInt, type RngState } from '../engine/rng';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb } from '../engine/types';
import { def, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { chooseActivate } from './activatedPolicy';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { chooseForesee } from './foresee';
import { chooseDiscard } from './discardPolicy';
import { chooseSacrifice } from './sacrificePolicy';
import { chooseDarlingPaydown } from './darlingPolicy';
import { chooseHauntlinkWindow, chooseUnlinkedHauntlink } from './hauntlinkPolicy';
import { chooseReserveLand } from './landPolicy';
import { choosePlayDraw } from './playDraw';
import { choosePreserve, type MainCast } from './preservePolicy';
import { applyRitePolicy, riteSacrificeValue } from './ritePolicy';
import { applyTithePolicy, titheManaSaved } from './tithePolicy';
import { applyWhispersPolicy } from './whispersPolicy';
import { applyVocabularyTargetPolicy, chooseTargetAction } from './targeting';
import {
  conditionalAbilityValue,
  empowerValue,
  empowerOpportunityCost,
  hauntlinkCastValue,
  nineLivesValue,
  removalKind,
  removalValueForCast,
  retellValue,
  skimValue,
  whispersValue,
} from './value';

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
    legal = applyVocabularyTargetPolicy(view, this.db, legal);
    legal = applyTithePolicy(view, this.db, legal, this.pers, () => {
      if (view.step !== 'main1' || view.activePlayer !== view.myId) return [];
      const planned = this.attack(view, [
        { type: 'declareAttackers', attackers: eligibleAttackers(view.battlefield, this.db, view.myId) },
        { type: 'declareAttackers', attackers: compelledAttackers(view.battlefield, this.db, view.myId) },
      ]);
      return planned.type === 'declareAttackers' ? planned.attackers : [];
    });
    legal = applyRitePolicy(view, this.db, legal);
    legal = applyWhispersPolicy(view, this.db, legal, (cast) => this.castScore(view, cast));
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
        return this.respond(view, legal);
      case 'hauntlinkWindow':
        // This is a mechanic policy call; the 85% random pass belongs only
        // to ordinary response windows, where Easy keeps that weakness.
        return chooseHauntlinkWindow(view, this.db, legal) ?? { type: 'passResponse' };
      case 'chooseTarget':
        if (a.decision === 'sacrifice') return chooseSacrifice(view, this.db, legal);
        return chooseTargetAction(view, this.db, legal);
      case 'discardToHandSize':
        if (a.decision === 'discard') return chooseDiscard(view, this.db);
        return legal[rngInt(this.rng, Math.max(1, legal.length - 1))]; // skip concede at end
      default:
        return legal[0];
    }
  }

  private landsInHand(view: PlayerView): number {
    return view.you.hand.filter((c) => isType(def(this.db, c), 'land')).length;
  }

  private cardIdFor(
    view: PlayerView,
    cast: Extract<Action, { type: 'castSpell' | 'castDarling' }>,
  ): string {
    if (cast.type === 'castDarling') return view.you.darlingZone ?? '';
    return (cast.retell || cast.whispers) && cast.graveIndex !== undefined
      ? view.you.graveyard[cast.graveIndex]
      : view.you.hand[cast.handIndex];
  }

  private castScore(view: PlayerView, action: MainCast): number {
    const cardId = this.cardIdFor(view, action);
    const d = def(this.db, cardId);
    if (action.type === 'castDarling') return manaValue(d.cost) + nineLivesValue(d) + conditionalAbilityValue(this.db, cardId);
    if (action.hauntlinked) {
      const host = action.targets?.[0];
      return host?.kind === 'permanent'
        ? hauntlinkCastValue(view.battlefield, this.db, cardId, host.iid)
        : -Infinity;
    }
    const castValue = action.whispers
      ? whispersValue(this.db, cardId, view)
      : action.retell
      ? retellValue(this.db, cardId) + 0.01
      : manaValue(d.cost) + nineLivesValue(d) + conditionalAbilityValue(this.db, cardId) + (action.x ?? 0) +
          (action.empowered ? empowerValue(this.db, cardId) + 0.01 -
            empowerOpportunityCost(view, this.db, action, (otherView, other) => this.castScore(otherView, other)) : 0);
    return castValue + titheManaSaved(view, this.db, action) - riteSacrificeValue(view, this.db, action);
  }

  /** Targeted damage should not default to a friendly permanent or player. */
  private isSelfDamageTarget(
    view: PlayerView,
    cast: Extract<Action, { type: 'castSpell' | 'castDarling' }>,
  ): boolean {
    const cardId = this.cardIdFor(view, cast);
    const damagesTarget = (def(this.db, cardId).abilities ?? []).some(
      (ab) =>
        ab.when === 'spell' &&
        (ab.ops ?? []).some((op) => op.op === 'damage' && op.to === 'target'),
    );
    if (!damagesTarget) return false;

    const target = cast.targets?.[0];
    if (target?.kind === 'player') return target.player === view.myId;
    if (target?.kind !== 'permanent') return false;
    return view.battlefield.find((perm) => perm.iid === target.iid)?.controller === view.myId;
  }

  private mulligan(view: PlayerView): Action {
    if (view.you.mulligans >= 2) return { type: 'keepHand' };
    // Reserve formats deal landless hands; the land band would mull every one.
    if (view.you.landReserve !== undefined) return { type: 'keepHand' };
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
    const activate = chooseActivate(view, this.db, legal);
    // Noise may skip Duty, but cannot bypass its timing or target policy.
    const nonConcede = legal.filter((l) =>
      l.type !== 'concede' && (l.type !== 'activate' || l === activate),
    );
    const paydown = chooseDarlingPaydown(view, nonConcede);
    if (paydown) return paydown;
    const reserveLand = chooseReserveLand(view, this.db, nonConcede);
    if (reserveLand) return reserveLand;
    if (rngFloat(this.rng) < this.pers.easyNoise) {
      return nonConcede[rngInt(this.rng, nonConcede.length)];
    }
    const land = nonConcede.find((l) => l.type === 'playLand');
    if (land) return land;
    const link = chooseUnlinkedHauntlink(view, this.db, nonConcede);
    if (link) return link;

    const casts = nonConcede.filter((l) => l.type === 'castSpell' || l.type === 'castDarling');
    const skimPool = nonConcede.filter((action) => action.type === 'skim');
    const preserve = choosePreserve(
      view,
      this.db,
      nonConcede,
      (cast) => this.castScore(view, cast),
    );
    if (preserve) return preserve;
    if (activate) return activate;
    if (casts.length === 0 && skimPool.length > 0) {
      return skimPool[0];
    }
    if (casts.length > 0) {
      const usefulCasts = casts.filter((cast) => {
        if (cast.type !== 'castSpell') return false;
        const cardId = this.cardIdFor(view, cast);
        const kind = removalKind(this.db, cardId);
        if (kind !== 'massDestroy' && kind !== 'destroyNewest') return true;
        return removalValueForCast(
          view.battlefield,
          this.db,
          view.myId,
          cardId,
        ) > 0;
      });
      if (usefulCasts.length === 0 && usefulCasts.length !== casts.length) {
        const nonRemoval = casts.filter(
          (cast) => cast.type === 'castSpell' && removalKind(this.db, this.cardIdFor(view, cast)) === null,
        );
        if (nonRemoval.length === 0) return nonConcede.find((l) => l.type === 'passStep') ?? nonConcede[0];
      }
      const castPool = (usefulCasts.length > 0 ? usefulCasts : casts).filter(
        (cast) => !this.isSelfDamageTarget(view, cast),
      );
      const pool = [...castPool, ...skimPool];
      if (pool.length === 0) return nonConcede.find((l) => l.type === 'passStep') ?? nonConcede[0];
      // Cast the biggest thing it can afford.
      pool.sort((x, y) => {
        const score = (action: Action): number => {
          if (action.type === 'skim') return skimValue(this.db, view.you.hand[action.handIndex]);
          if (action.type !== 'castSpell' && action.type !== 'castDarling') return -Infinity;
          return this.castScore(view, action);
        };
        return score(y) - score(x);
      });
      return pool[0];
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
    // "Stay home" is the SMALLEST legal declaration, not necessarily the empty
    // one: a creature with Rage must attack, so under Rage the empty
    // declaration is never offered and this resolves to the compelled set.
    // Before 2026-08-30 this read `find((a) => a.attackers.length === 0)!`, and
    // that non-null assertion became a crash the moment Rage existed.
    const none = attacks.reduce((best, a) =>
      a.attackers.length < best.attackers.length ? a : best,
    );

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

    type CombatStats = ReturnType<typeof getEffectiveStats>;
    const strikesIn = (stats: CombatStats, firstStep: boolean): boolean => firstStep
      ? stats.keywords.has('firstBlade') || stats.keywords.has('twinBlades')
      : !stats.keywords.has('firstBlade') || stats.keywords.has('twinBlades');
    // Keep Easy's kill-or-survive rule, but count only hits the blockers get
    // to make. Hits in each sub-step are simultaneous; casualties leave before
    // the next step, and Twin Blades still strikes in that normal step.
    const blockersKill = (atk: CombatStats, blockers: CombatStats[]): boolean => {
      const defenders = blockers.map((stats) => ({ stats, defense: stats.defense }));
      let attackerDamage = 0;
      for (const firstStep of [true, false]) {
        const alive = defenders.filter((b) => b.defense > 0);
        const striking = alive.filter((b) => strikesIn(b.stats, firstStep));
        const damage = striking.reduce((sum, b) => sum + Math.max(0, b.stats.attack), 0);
        const deathblade = striking.some((b) => b.stats.attack > 0 && b.stats.keywords.has('deathblade'));
        if (strikesIn(atk, firstStep)) {
          const lethal = (b: (typeof defenders)[number]): number => atk.keywords.has('deathblade')
            ? 1 : b.defense;
          let power = Math.max(0, atk.attack);
          for (const b of [...alive].sort((a, b) => lethal(a) - lethal(b))) {
            const assigned = Math.min(power, lethal(b));
            if (assigned > 0) {
              b.defense = atk.keywords.has('deathblade') ? 0 : b.defense - assigned;
              power -= assigned;
            }
          }
        }
        attackerDamage += damage;
        if (deathblade || attackerDamage >= atk.defense) return true;
      }
      return false;
    };

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
            const kills = blockersKill(atk, [first, second]);
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
          const kills = blockersKill(atk, [blk]);
          const damage = atk.attack * (atk.keywords.has('twinBlades') ? 2 : 1);
          const survives = blk.defense > damage && !atk.keywords.has('deathblade');
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

  private respond(view: PlayerView, legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    if (rngFloat(this.rng) < this.pers.easyPassRate) return pass;
    const casts = legal.filter((l) => l.type === 'castSpell');
    const skims = legal.filter((l) => l.type === 'skim');
    if (casts.length === 0) return skims[0] ?? pass;
    const useful = casts.filter((cast) => {
      const cardId = this.cardIdFor(view, cast);
      const kind = removalKind(this.db, cardId);
      if (kind !== 'massDestroy' && kind !== 'destroyNewest') return true;
      return removalValueForCast(view.battlefield, this.db, view.myId, cardId) > 0;
    }).filter((cast) => !this.isSelfDamageTarget(view, cast));
    if (useful.length === 0) return pass;
    return useful[rngInt(this.rng, useful.length)];
  }
}
