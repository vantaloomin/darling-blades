import { getEffectiveStats } from '../engine/statics';
import type { CardDb, GameState, PlayerId } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import { dawnSelfBleed, permValue } from './value';

/**
 * Hard's evaluation function: life differential (nonlinear), board material
 * with tapped/sick discounts, card advantage, mana development, and a clock
 * term. Terminal states dominate everything.
 */
export function evaluate(state: GameState, db: CardDb, me: PlayerId): number {
  const opp = opponentOf(me);
  if (state.winner === me) return 1e6;
  if (state.winner === opp) return -1e6;
  if (state.winner === 'draw') return -500;

  const my = state.players[me];
  const their = state.players[opp];

  // Life is a resource: nearly worthless at 20, precious near 0. Convex per
  // side, so chip damage at high life never outbids real board material.
  const lifeWorth = (l: number): number => 14 * Math.tanh(l / 9);
  let score = lifeWorth(my.life) - lifeWorth(their.life);

  // Until-EOT buffs are gone by the time this position matters — a pumped
  // creature is NOT lasting board value. Evaluate with temp mods stripped.
  const stripped = state.battlefield.map((p) =>
    p.untilEotMods.length > 0 ? { ...p, untilEotMods: [] } : p,
  );

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
    let v = permValue(stripped, db, perm.iid);
    if (perm.tapped) v *= 0.85;
    if (perm.enteredThisTurn) v *= 0.92;
    score += mineSide ? v : -v;
    if (isType(d, 'creature')) {
      const p = getEffectiveStats(stripped, db, perm.iid).attack;
      if (mineSide) myPower += p;
      else theirPower += p;
    }
  }

  // Card advantage — stand-in cards count like real ones (they represent
  // real hidden cards in Hard's determinized simulations).
  score += 1.2 * (my.hand.length - their.hand.length);

  // Mana development.
  score += 0.4 * (myLands - theirLands);

  // Clock: who is winning the race?
  score += 0.6 * Math.max(0, myPower - their.life * 0.5);
  score -= 1.5 * Math.max(0, theirPower - my.life);

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
