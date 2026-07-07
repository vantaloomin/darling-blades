import type { Action } from '../engine/actions';
import type { CardDb, EffectOp, Permanent, TargetRef } from '../engine/types';
import { def, isType, manaValue, opponentOf } from '../engine/types';
import { getEffectiveStats } from '../engine/statics';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { chooseAttackers, chooseBlocks } from './combatPlans';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { cardValue, permValue } from './value';

type Cast = Extract<Action, { type: 'castSpell' }>;

/**
 * Medium: rule-based priorities with one-step trade math. Plays a fair game
 * of attrition — lethal checks, profitable trades, removal on the biggest
 * threat, trick-risk respect — but no lookahead. Deliberately does not model
 * face-down information beyond "open mana = maybe a trick".
 */
export class MediumAI implements AIPlayer {
  constructor(
    private readonly db: CardDb,
    private readonly pers: Personality = DEFAULT_PERSONALITY,
  ) {}

  chooseAction(view: PlayerView, legal: Action[]): Action {
    switch (view.awaiting.kind) {
      case 'mulligan':
        return this.mulligan(view);
      case 'bottomCards':
      case 'discardToHandSize':
        return this.worstCards(view, legal);
      case 'main':
        return this.main(view, legal);
      case 'declareAttackers': {
        const attackers = chooseAttackers(
          view.battlefield,
          this.db,
          view.myId,
          view.opp.life,
          this.trickBuff(view),
          view.you.life,
          this.pers,
        );
        return { type: 'declareAttackers', attackers };
      }
      case 'declareBlockers': {
        if (!view.combat) return { type: 'declareBlockers', blocks: [] };
        const blocks = chooseBlocks(
          view.battlefield,
          this.db,
          view.myId,
          view.you.life,
          view.combat,
          this.trickBuff(view),
          this.pers,
        );
        return { type: 'declareBlockers', blocks };
      }
      case 'respond':
        return this.respond(view, legal);
      case 'endStepWindow':
        return this.endStep(view, legal);
      default:
        return legal[0];
    }
  }

  // -------------------------------------------------------------------
  /**
   * Is a combat trick plausible? Open mana AND cards actually in hand AND
   * demonstrated capability: the opponent must have shown at least one
   * instant this game (public graveyard — honest information only).
   *
   * The evidence gate was added after the 2026-07-02 difficulty-gap
   * investigation: paying the +2/+2 phantom-trick tax on EVERY combat calc
   * against opponents who merely have untapped lands measurably loses more
   * than the occasional trick blowout it prevents. Measured (200 games/cell,
   * balance-matrix seed family): vs Easy on the creature-only starter pair
   * (Crimson/Wild) 61.0% -> 75.5%; head-to-head vs the old Medium the gated
   * version wins 54-55% even on trick-heavy deck pairs (TEST decks, Burning
   * Tides/Grave Harvest, Shadow Mandate/Burning Tides) and 59% on the
   * creature pair. A softer +1 early prior and a slower "N trickless
   * nonlands seen" decay were both measured and lost to this rule.
   */
  private trickBuff(view: PlayerView): number {
    const opp = opponentOf(view.myId);
    const open = view.battlefield.filter(
      (p) =>
        p.controller === opp &&
        !p.tapped &&
        (def(this.db, p.cardId).manaAbility?.length ?? 0) > 0,
    ).length;
    if (open < 2 || view.opp.handCount < 1) return 0;
    const shownInstant = view.opp.graveyard.some((c) =>
      isType(def(this.db, c), 'instant'),
    );
    return shownInstant ? 2 * this.pers.trickRespect : 0;
  }

  private landsIn(cards: readonly string[]): number {
    return cards.filter((c) => isType(def(this.db, c), 'land')).length;
  }

  private mulligan(view: PlayerView): Action {
    const hand = view.you.hand;
    const lands = this.landsIn(hand);
    const mulls = view.you.mulligans;
    if (mulls >= 2) return { type: 'keepHand' };
    // `mulliganShift` moves the keep-band lower bounds (default 0).
    const shift = this.pers.mulliganShift;
    if (mulls === 0) {
      return lands >= 2 + shift && lands <= 5 ? { type: 'keepHand' } : { type: 'mulligan' };
    }
    return lands >= 1 + shift && lands <= 5 ? { type: 'keepHand' } : { type: 'mulligan' };
  }

  /** Bottom/discard the least valuable cards (excess lands first when flooded). */
  private worstCards(view: PlayerView, legal: Action[]): Action {
    const hand = view.you.hand;
    const count =
      view.awaiting.kind === 'bottomCards' || view.awaiting.kind === 'discardToHandSize'
        ? view.awaiting.count
        : 1;
    const lands = this.landsIn(hand);
    const score = (c: string): number => {
      const d = def(this.db, c);
      if (isType(d, 'land')) return lands > hand.length - lands ? -5 : 5;
      return cardValue(this.db, c);
    };
    const indices = hand
      .map((c, i) => ({ i, s: score(c) }))
      .sort((x, y) => x.s - y.s)
      .slice(0, count)
      .map((e) => e.i)
      .sort((x, y) => x - y);
    const type = view.awaiting.kind === 'bottomCards' ? 'bottomCards' : 'discard';
    const match = legal.find(
      (l) =>
        l.type === type &&
        JSON.stringify((l as { handIndices: number[] }).handIndices) === JSON.stringify(indices),
    );
    return match ?? legal.find((l) => l.type === type) ?? legal[0];
  }

  // -------------------------------------------------------------------
  /**
   * Develop-cast preference: base card value plus personality biases. At
   * DEFAULT (subtypeBias 0, lifegainBias 0) this equals cardValue() exactly.
   */
  private developScore(cardId: string): number {
    let v = cardValue(this.db, cardId);
    if (this.pers.subtypeBias !== 0) {
      const subs = def(this.db, cardId).subtypes ?? [];
      if (subs.some((s) => this.pers.preferredSubtypes.includes(s))) v += this.pers.subtypeBias;
    }
    if (this.pers.lifegainBias !== 0 && this.gainsLife(cardId)) v += this.pers.lifegainBias;
    return v;
  }

  /** Does casting this card gain life (lifelink body or a gainLife op)? */
  private gainsLife(cardId: string): boolean {
    const d = def(this.db, cardId);
    if ((d.keywords ?? []).includes('bloodoath')) return true;
    return (d.abilities ?? []).some((ab) =>
      (ab.ops ?? []).some((o) => o.op === 'gainLife'),
    );
  }

  private opBodies(cardId: string): EffectOp[] {
    return (def(this.db, cardId).abilities ?? [])
      .filter((ab) => ab.when === 'spell')
      .flatMap((ab) => ab.ops ?? []);
  }

  private isRemoval(cardId: string): 'destroy' | 'damage' | null {
    for (const op of this.opBodies(cardId)) {
      if (op.op === 'destroy') return 'destroy';
      if (op.op === 'damage' && op.to === 'target') return 'damage';
    }
    return null;
  }

  private targetPerm(view: PlayerView, ref: TargetRef | undefined): Permanent | undefined {
    if (!ref || ref.kind !== 'permanent') return undefined;
    return view.battlefield.find((p) => p.iid === ref.iid);
  }

  /** Would this removal cast actually kill its target? */
  private removalKills(view: PlayerView, cast: Cast): boolean {
    const perm = this.targetPerm(view, cast.targets?.[0]);
    if (!perm) return false;
    const kind = this.isRemoval(view.you.hand[cast.handIndex]);
    if (kind === 'destroy') return true;
    const stats = getEffectiveStats(view.battlefield, this.db, perm.iid);
    const dmg = this.opBodies(view.you.hand[cast.handIndex]).find(
      (o) => o.op === 'damage' && o.to === 'target',
    );
    const n = dmg && dmg.op === 'damage' ? (dmg.n === 'X' ? (cast.x ?? 0) : dmg.n) : 0;
    return n >= stats.toughness - perm.damage;
  }

  private main(view: PlayerView, legal: Action[]): Action {
    const land = legal.find((l) => l.type === 'playLand');
    if (land) return land;

    const casts = legal.filter((l): l is Cast => l.type === 'castSpell');
    if (casts.length > 0) {
      const opp = opponentOf(view.myId);

      // 1. Direct-damage lethal (Blaze/burn to the face for the win)
      for (const c of casts) {
        const t = c.targets?.[0];
        if (t?.kind === 'player' && t.player === opp) {
          for (const op of this.opBodies(view.you.hand[c.handIndex])) {
            if (op.op === 'damage' && op.to === 'target') {
              const n = op.n === 'X' ? (c.x ?? 0) : op.n;
              if (n >= view.opp.life) return c;
            }
          }
        }
      }

      // 2. Removal on the opponent's best creature when it's worth the card
      const removals = casts.filter((c) => {
        const perm = this.targetPerm(view, c.targets?.[0]);
        return (
          perm !== undefined &&
          perm.controller === opp &&
          this.isRemoval(view.you.hand[c.handIndex]) !== null &&
          this.removalKills(view, c)
        );
      });
      if (removals.length > 0) {
        const best = removals.reduce((a, b) =>
          permValue(view.battlefield, this.db, this.targetPerm(view, a.targets?.[0])!.iid) >=
          permValue(view.battlefield, this.db, this.targetPerm(view, b.targets?.[0])!.iid)
            ? a
            : b,
        );
        const target = this.targetPerm(view, best.targets?.[0])!;
        const worth = permValue(view.battlefield, this.db, target.iid);
        const cost = manaValue(def(this.db, view.you.hand[best.handIndex]).cost) + (best.x ?? 0);
        if (worth >= cost * 0.8 && worth >= 2.5 + this.pers.removalBias) return best;
      }

      // 2b. Burn as reach: send damage at the face once they're in range.
      if (view.opp.life <= this.pers.burnFaceLife) {
        const burns = casts.filter((c) => {
          const t = c.targets?.[0];
          return (
            t?.kind === 'player' &&
            t.player === opp &&
            this.opBodies(view.you.hand[c.handIndex]).some(
              (o) => o.op === 'damage' && o.to === 'target',
            )
          );
        });
        if (burns.length > 0) {
          return burns.reduce((a, b) => ((a.x ?? 0) >= (b.x ?? 0) ? a : b));
        }
      }

      // 3. Develop: cast the highest-value creature / permanent. Creatures
      //    without haste in main1 wait for main2 only if we plan to attack;
      //    keeping it simple: cast in whichever main we're in.
      const developable = casts.filter((c) => {
        const d = def(this.db, view.you.hand[c.handIndex]);
        if (isType(d, 'instant')) return false; // hold tricks for windows
        if (this.isRemoval(view.you.hand[c.handIndex])) return false; // handled above
        if (d.subtypes.includes('Aura')) {
          const perm = this.targetPerm(view, c.targets?.[0]);
          // buff auras on own creatures, debuff auras on enemy creatures
          const st = (d.abilities ?? []).find((ab) => ab.static)?.static;
          const debuff = (st?.p ?? 0) < 0;
          return perm !== undefined && (debuff ? perm.controller === opp : perm.controller === view.myId);
        }
        return true;
      });
      if (developable.length > 0) {
        const best = developable.reduce((a, b) =>
          this.developScore(view.you.hand[a.handIndex]) + (a.x ?? 0) >=
          this.developScore(view.you.hand[b.handIndex]) + (b.x ?? 0)
            ? a
            : b,
        );
        return best;
      }
    }
    return legal.find((l) => l.type === 'passStep') ?? legal[0];
  }

  // -------------------------------------------------------------------
  private respond(view: PlayerView, legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    const casts = legal.filter((l): l is Cast => l.type === 'castSpell');
    if (casts.length === 0) return pass;
    const opp = opponentOf(view.myId);

    // 1. Counter a big enemy spell (mv ≥ 4) or anything targeting my best creature.
    const top = view.stack.at(-1);
    if (top && top.controller === opp) {
      const counter = casts.find((c) => c.targets?.[0]?.kind === 'stackItem');
      if (counter) {
        const topDef = def(this.db, top.cardId);
        const threatens =
          manaValue(topDef.cost) + (top.x ?? 0) >= this.pers.counterFloor ||
          top.targets.some(
            (t) =>
              t.kind === 'permanent' &&
              this.targetPerm(view, t)?.controller === view.myId &&
              permValue(view.battlefield, this.db, t.iid) >= 4,
          ) ||
          this.opBodies(top.cardId).some((o) => o.op === 'massDestroy');
        if (threatens) {
          return { ...counter, targets: [{ kind: 'stackItem', sid: top.sid }] };
        }
      }
    }

    // 2. Removal on an attacker that would otherwise hurt (≥ 3 damage or big value).
    if (view.combat && view.combat.attackers.length > 0 && view.activePlayer === opp) {
      const removals = casts.filter((c) => {
        const perm = this.targetPerm(view, c.targets?.[0]);
        return (
          perm !== undefined &&
          view.combat!.attackers.includes(perm.iid) &&
          this.removalKills(view, c)
        );
      });
      if (removals.length > 0) {
        const best = removals.reduce((a, b) =>
          permValue(view.battlefield, this.db, this.targetPerm(view, a.targets?.[0])!.iid) >=
          permValue(view.battlefield, this.db, this.targetPerm(view, b.targets?.[0])!.iid)
            ? a
            : b,
        );
        const v = permValue(view.battlefield, this.db, this.targetPerm(view, best.targets?.[0])!.iid);
        if (v >= 3.5 + this.pers.removalBias) return best;
      }
    }

    // 3. Pump my creature when it helps combat.
    if (view.combat) {
      for (const c of casts) {
        const perm = this.targetPerm(view, c.targets?.[0]);
        if (!perm || perm.controller !== view.myId) continue;
        const pump = this.opBodies(view.you.hand[c.handIndex]).find((o) => o.op === 'pump');
        if (!pump || pump.op !== 'pump') continue;
        const isAttacker = view.combat.attackers.includes(perm.iid);
        const inBlocks = view.combat.blocks.some(
          (b) => b.blocker === perm.iid || b.attacker === perm.iid,
        );
        // 3a. Unblocked attacker after blocks: pump = free extra damage.
        if (
          isAttacker &&
          view.combat.phase === 'blockersDeclared' &&
          !view.combat.blocks.some((b) => b.attacker === perm.iid) &&
          view.activePlayer === view.myId
        ) {
          return c;
        }
        if (!inBlocks) continue;
        // 3b. Flip a losing fight (save it, win it, or both).
        const foes = view.combat.blocks
          .filter((b) => b.blocker === perm.iid || b.attacker === perm.iid)
          .map((b) => (b.blocker === perm.iid ? b.attacker : b.blocker));
        for (const foe of foes) {
          const mine = getEffectiveStats(view.battlefield, this.db, perm.iid);
          const theirs = getEffectiveStats(view.battlefield, this.db, foe);
          const dieNow = theirs.power >= mine.toughness - perm.damage;
          const surviveAfter = theirs.power < mine.toughness - perm.damage + pump.t;
          const killNow = mine.power >= theirs.toughness;
          const killAfter = mine.power + pump.p >= theirs.toughness;
          if ((dieNow && surviveAfter) || (!killNow && killAfter && !dieNow)) return c;
          if (dieNow && surviveAfter && killAfter) return c;
        }
      }
    }
    return pass;
  }

  /** End of the opponent's turn: spend spare removal / value instants freely. */
  private endStep(view: PlayerView, legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    const casts = legal.filter((l): l is Cast => l.type === 'castSpell');
    const opp = opponentOf(view.myId);
    const removals = casts.filter((c) => {
      const perm = this.targetPerm(view, c.targets?.[0]);
      return perm !== undefined && perm.controller === opp && this.removalKills(view, c);
    });
    if (removals.length > 0) {
      const best = removals.reduce((a, b) =>
        permValue(view.battlefield, this.db, this.targetPerm(view, a.targets?.[0])!.iid) >=
        permValue(view.battlefield, this.db, this.targetPerm(view, b.targets?.[0])!.iid)
          ? a
          : b,
      );
      if (
        permValue(view.battlefield, this.db, this.targetPerm(view, best.targets?.[0])!.iid) >=
        3.5 + this.pers.removalBias
      )
        return best;
    }
    // free value instants with no targets (card draw etc.)
    const freebie = casts.find((c) => {
      const d = def(this.db, view.you.hand[c.handIndex]);
      return (
        (!c.targets || c.targets.length === 0) &&
        this.opBodies(view.you.hand[c.handIndex]).some((o) => o.op === 'draw') &&
        isType(d, 'instant')
      );
    });
    return freebie ?? pass;
  }
}
