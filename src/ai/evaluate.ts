import { getEffectiveStats } from '../engine/statics';
import type { CardDb, GameState, PlayerId } from '../engine/types';
import { cardIdOf, def, isType, opponentOf } from '../engine/types';
import { createPermanentValuer, dawnSelfBleed, MANDATE_HOLD_VALUE, markedBoardValue, questBoardValue } from './value';

/** Life below this scale is increasingly expensive on the evaluation curve. */
export const LIFE_CURVE_KNEE = 9;

/**
 * The evaluation's weights. DEFAULT_EVAL_WEIGHTS is Hard as it ships; Duel any
 * Deck's higher levels may carry their own, tuned offline by self-play.
 */
export interface EvalWeights {
  /** Height of the convex life curve per side. */
  life: number;
  /** Life below this is increasingly expensive. */
  lifeKnee: number;
  /** Board value kept by a tapped permanent. */
  tapped: number;
  /** Board value kept by a permanent that arrived this turn. */
  fresh: number;
  /** Per card of hand-size lead. */
  card: number;
  /** Per land of mana lead. */
  land: number;
  /** My clock: power beyond half their life. */
  myClock: number;
  /** Their clock: power beyond my life. */
  theirClock: number;
}

export const DEFAULT_EVAL_WEIGHTS: Readonly<EvalWeights> = Object.freeze({
  life: 14, lifeKnee: LIFE_CURVE_KNEE, tapped: 0.85, fresh: 0.92, card: 1.2, land: 0.4, myClock: 0.6, theirClock: 1.5,
});

/**
 * Hard's evaluation function: life differential (nonlinear), board material
 * with tapped/sick discounts, card advantage, mana development, and a clock
 * term. Terminal states dominate everything.
 */
export function evaluate(state: GameState, db: CardDb, me: PlayerId, w: Readonly<EvalWeights> = DEFAULT_EVAL_WEIGHTS): number {
  const opp = opponentOf(me);
  if (state.winner === me) return 1e6;
  if (state.winner === opp) return -1e6;
  if (state.winner === 'draw') return -500;

  const my = state.players[me];
  const their = state.players[opp];

  // Life is a resource: nearly worthless at 20, precious near 0. Convex per
  // side, so chip damage at high life never outbids real board material.
  const lifeWorth = (l: number): number => w.life * Math.tanh(l / w.lifeKnee);
  let score = lifeWorth(my.life) - lifeWorth(their.life);

  // Until-EOT buffs are gone by the time this position matters — a pumped
  // creature is NOT lasting board value. Evaluate with temp mods stripped.
  const stripped = state.battlefield.map((p) =>
    p.untilEotMods.length > 0 ? { ...p, untilEotMods: [] } : p,
  );

  const valueOfPermanent = createPermanentValuer(stripped, db);
  let myPower = 0;
  let theirPower = 0;
  let myLands = 0;
  let theirLands = 0;
  for (const perm of stripped) {
    const d = def(db, perm.cardId);
    const mineSide = perm.controller === me;
    if (isType(d, 'land')) {
      if (mineSide) myLands++;
      else theirLands++;
      continue;
    }
    let v = valueOfPermanent(perm.iid);
    if (perm.tapped) v *= w.tapped;
    if (perm.enteredThisTurn) v *= w.fresh;
    score += mineSide ? v : -v;
    if (isType(d, 'creature')) {
      const p = getEffectiveStats(stripped, db, perm.iid).attack;
      if (mineSide) myPower += p;
      else theirPower += p;
    }
  }

  // Marks beyond the bodies: threshold progress and what Propagate in hand
  // will compound. My hand is mine to read; theirs is hidden, so their term
  // sees only the board.
  score += markedBoardValue(stripped, db, me, my.hand.map(cardIdOf));
  score -= markedBoardValue(stripped, db, opp);
  score += questBoardValue(stripped, db, me) - questBoardValue(stripped, db, opp);
  // Card advantage — stand-in cards count like real ones (they represent
  // real hidden cards in Hard's determinized simulations).
  score += w.card * (my.hand.length - their.hand.length);

  // Mana development.
  score += w.land * (myLands - theirLands);

  // The Mandate (2.0 B3): its holder draws an extra card each dawn until it
  // is taken. Read from the public holder and deck size only, never the
  // order; the edge fades as the deck runs low, and turns against the holder
  // at an empty deck, where the extra draw hastens the loss.
  if (state.mandateHolder !== undefined) {
    const deck = state.players[state.mandateHolder].deck.length;
    const hold = MANDATE_HOLD_VALUE * Math.min(1, (deck - 1) / 2);
    score += state.mandateHolder === me ? hold : -hold;
  }

  // Clock: who is winning the race?
  score += w.myClock * Math.max(0, myPower - their.life * 0.5);
  score -= w.theirClock * Math.max(0, theirPower - my.life);

  // Recurring self-damage ("At the start of your turn, this deals N damage
  // to you") is a forced clock the shallow lookahead can't see. Price ~3
  // turns of bleed through the same convex lifeWorth curve — negligible at
  // 20 life, dominating near death — so a bleeding side prefers lines that
  // race or trade over sitting on the material (playtest 2026-07-12: Hard
  // stalled behind a full bench and bled out to its own dawn trigger).
  const myBleed = dawnSelfBleed(state.battlefield, db, me);
  if (myBleed > 0) score -= lifeWorth(my.life) - lifeWorth(my.life - 3 * myBleed);
  const theirBleed = dawnSelfBleed(state.battlefield, db, opp);
  if (theirBleed > 0) score += lifeWorth(their.life) - lifeWorth(their.life - 3 * theirBleed);

  return score;
}
