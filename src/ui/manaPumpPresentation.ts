/**
 * The mana pump's ticker (1.9 A2.a, for A1.5's repeatable mana ability:
 * "{R}: This gets +1/+0 until Sunset."), Phaser-free.
 *
 * The engine offers one `activateMana` per ability, carrying the most its
 * controller can pay (`times`), and accepts any whole count from 1 to that as
 * ONE action. The ticker picks that count with a +/- control and submits it
 * once. The Duel UI does not plan mana for it: the submitted action carries no
 * `manaPlan`, and the engine pays the whole count with one `solveMana`
 * (`repeatedManaCost`), exactly as it pays a Duty the UI submits unplanned.
 */

import type { Action } from '../engine/actions';
import type { CardDef, EffectOp, ManaCost } from '../engine/types';
import { manaActivatedText, manaCostText } from './rulesText';

export type ManaPumpAction = Extract<Action, { type: 'activateMana' }>;

/** The ticker's state: the count shown, its bounds, and which steps are live. */
export interface PumpTicker {
  readonly count: number;
  /** The most activations the player can pay for now (the legal action's `times`). */
  readonly max: number;
  readonly canDecrease: boolean;
  readonly canIncrease: boolean;
}

function whole(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

/**
 * The ticker at `count`, held to 1..max. It opens at 1 (the smallest use; the
 * player raises it), and a max below 1 (nothing payable) still reads 1 with
 * both steps off, though the engine never offers such an action.
 */
export function pumpTicker(max: number, count = 1): PumpTicker {
  const top = Math.max(1, whole(max, 1));
  const n = Math.min(top, Math.max(1, whole(count, 1)));
  return { count: n, max: top, canDecrease: n > 1, canIncrease: n < top };
}

/** One press of - (delta -1) or + (delta +1); a press past either bound changes nothing. */
export function stepPumpTicker(ticker: PumpTicker, delta: number): PumpTicker {
  return pumpTicker(ticker.max, ticker.count + Math.sign(delta));
}

/**
 * The action the ticker submits: the engine's own legal entry (its creature
 * and ability) carrying the chosen count, held to 1..`legal.times`. Null when
 * the legal entry offers nothing to pay for.
 */
export function pumpSubmission(legal: ManaPumpAction, count: number): ManaPumpAction | null {
  if (!(legal.times >= 1)) return null;
  const times = pumpTicker(legal.times, count).count;
  return { type: 'activateMana', iid: legal.iid, abilityIndex: legal.abilityIndex, times };
}

/** The legal pump actions for one creature, in ability order. */
export function pumpActionsFor(legal: readonly Action[], iid: number): ManaPumpAction[] {
  return legal
    .filter((action): action is ManaPumpAction => action.type === 'activateMana' && action.iid === iid)
    .sort((a, b) => a.abilityIndex - b.abilityIndex);
}

/** What `times` uses of one ability give the creature, summed over its `boost` ops (the validator allows only +N/+M on itself). */
export function pumpBoost(ops: readonly EffectOp[], times: number): { attack: number; defense: number } {
  let attack = 0;
  let defense = 0;
  for (const op of ops) {
    if (op.op !== 'boost' || op.scope !== 'self') continue;
    attack += op.p;
    defense += op.t;
  }
  const n = Math.max(0, whole(times, 0));
  return { attack: attack * n, defense: defense * n };
}

function signed(n: number): string {
  return n < 0 ? `${n}` : `+${n}`;
}

/** "+3/+0": the P/T change a count gives, as the card face writes a boost. */
export function pumpBoostText(boost: { attack: number; defense: number }): string {
  return `${signed(boost.attack)}/${signed(boost.defense)}`;
}

/** The cost of `times` uses, as mana tokens ("{R}{R}{R}"). */
export function pumpTotalCostText(cost: ManaCost, times: number): string {
  const n = Math.max(0, whole(times, 0));
  const pips: ManaCost['pips'] = {};
  for (const [colour, count] of Object.entries(cost.pips) as [keyof ManaCost['pips'], number][]) pips[colour] = count * n;
  return manaCostText({ generic: cost.generic * n, pips });
}

/** Player copy for approval (1.9 A2.a). */
export const PUMP_TICKER_TITLE = 'Activate';
export const PUMP_TICKER_CANCEL = 'Cancel';

/** "Up to 5": the ticker's bound, under the count. */
export function pumpTickerLimitText(max: number): string {
  return `Up to ${Math.max(1, whole(max, 1))}`;
}

/** The confirm button: "Activate once", "Activate 3 times". */
export function pumpConfirmLabel(count: number): string {
  const n = Math.max(1, whole(count, 1));
  return n === 1 ? 'Activate once' : `Activate ${n} times`;
}

/** "Pay {R}{R}: +2/+0 until Sunset": what the chosen count costs and does. */
export function pumpSummaryText(cost: ManaCost, ops: readonly EffectOp[], count: number): string {
  return `Pay ${pumpTotalCostText(cost, count)}: ${pumpBoostText(pumpBoost(ops, count))} until Sunset`;
}

/**
 * One ability's effect in the card's own words, without its cost: "This gets
 * +1/+0 until Sunset." Empty when the card has no such ability.
 */
export function manaActivatedEffectText(card: CardDef, abilityIndex: number): string {
  const line = (manaActivatedText(card) ?? '').split('\n')[abilityIndex] ?? '';
  return line.replace(/^[^:]*:\s*/, '').trim();
}
