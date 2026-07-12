import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { chooseScry } from './scry';

/**
 * The teaching opponent for the first-launch tutorial (src/data/tutorial.ts).
 * Not a difficulty — a deliberately simple, fail-safe policy that plays a
 * legible, reproducible line so the coach marks can teach against it:
 *
 *  - keep the opening hand (no mulligans → no bottoming),
 *  - on its own main phase: play a land, then cast the cheapest creature, then
 *    pass — so it always has an attacker a turn later,
 *  - in combat: attack with the largest set that is NOT lethal to the human
 *    (the teaching AI must lose or stall, never kill), so the player reaches
 *    the block lesson at full life,
 *  - never block, and pass every response window.
 *
 * Like every brain it satisfies `AIPlayer.chooseAction` and reads ONLY the
 * redacted `PlayerView` + the legal menu (iron invariant). It picks an
 * already-legal action rather than fabricating one, so it can never throw. It
 * is never run inside determinized search, so it needs no `simDb`.
 */
export class ScriptAI implements AIPlayer {
  constructor(private readonly db: CardDb) {}

  chooseAction(view: PlayerView, legal: Action[]): Action {
    if (view.awaiting.kind === 'scry') return chooseScry(view, this.db);

    // Opening hand: always keep (0 mulligans → the engine never asks to bottom).
    const keep = legal.find((l) => l.type === 'keepHand');
    if (keep) return keep;

    // Response windows: never interact.
    const passResponse = legal.find((l) => l.type === 'passResponse');
    if (passResponse && (view.awaiting.kind === 'respond' || view.awaiting.kind === 'endStepWindow')) {
      return passResponse;
    }

    // Defending: never block — let the human's attack connect (attack lesson).
    if (view.awaiting.kind === 'declareBlockers') {
      const noBlock = legal.find((l) => l.type === 'declareBlockers' && l.blocks.length === 0);
      if (noBlock) return noBlock;
    }

    // Attacking: the largest legal swing whose total power is NOT lethal, so the
    // player is always attacked at safe life and reaches the block lesson alive.
    if (view.awaiting.kind === 'declareAttackers') {
      const declares = legal.filter(
        (l): l is Extract<Action, { type: 'declareAttackers' }> => l.type === 'declareAttackers',
      );
      const empty = declares.find((d) => d.attackers.length === 0) ?? declares[0];
      let best = empty;
      let bestCount = 0;
      for (const d of declares) {
        const power = d.attackers.reduce((sum, iid) => sum + this.power(view, iid), 0);
        if (d.attackers.length > bestCount && power < view.opp.life) {
          best = d;
          bestCount = d.attackers.length;
        }
      }
      if (best) return best;
    }

    // Own main phase: build the board — land, then the cheapest creature, then pass.
    const playLand = legal.find((l) => l.type === 'playLand');
    if (playLand) return playLand;

    const creatureCasts = legal.filter(
      (l): l is Extract<Action, { type: 'castSpell' }> =>
        l.type === 'castSpell' && isType(def(this.db, view.you.hand[l.handIndex]), 'creature'),
    );
    if (creatureCasts.length > 0) {
      return creatureCasts.reduce((a, b) =>
        manaValue(def(this.db, view.you.hand[a.handIndex]).cost) <=
        manaValue(def(this.db, view.you.hand[b.handIndex]).cost)
          ? a
          : b,
      );
    }

    const passStep = legal.find((l) => l.type === 'passStep');
    if (passStep) return passStep;

    // Nothing scripted applies — pass if we can, else take whatever is legal.
    return passResponse ?? legal[0] ?? { type: 'concede' };
  }

  /** Base attack of a permanent I control, for the never-lethal guard. */
  private power(view: PlayerView, iid: number): number {
    const perm = view.battlefield.find((p) => p.iid === iid);
    if (!perm) return 0;
    return (def(this.db, perm.cardId).attack ?? 0) + perm.plusOneCounters;
  }
}
