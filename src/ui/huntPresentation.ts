/**
 * The Hunt in the duel (1.9 A2.a), Phaser-free so its rules can be tested
 * without a scene: the two step prompts, the exchange's two blows and where
 * each number lands, what the exchange draws when one of its creatures has no
 * tile, which `damageMarked` events the exchange already draws, and the
 * full-motion timing, matched to combat's (`combatSequence.ts`).
 *
 * The engine emits one `hunted` event before the damage lands (both amounts,
 * 0 for a creature with no Attack), then a `damageMarked` for each positive
 * blow (`applyCreatureDamage`, hunter's blow first). A Hunt in which neither
 * creature has Attack still emits `hunted` (A1.1's hand-off), so the exchange
 * must read when nothing is dealt.
 */

import type { GameEvent } from '../engine/events';
import type { AbilityDef, CardDef, EffectOp, PlayerId } from '../engine/types';
import { activatedAbilitiesOf, isArrivalHunt } from '../engine/types';
import { COMBAT_SEQUENCE_TIMING } from './combatSequence';

export type HuntedEvent = Extract<GameEvent, { e: 'hunted' }>;

// ---------------------------------------------------------------------------
// The step prompts
// ---------------------------------------------------------------------------

/** Player copy APPROVED 2026-09-28 (plan-first-dawn-engine.md, Part 6). */
export const HUNT_HUNTER_PROMPT = 'Choose the hunter.';
export const HUNT_PREY_PROMPT = 'Choose its prey.';

/**
 * Where the targets being chosen come from. A plain cast reads the card's
 * printed targets (a Hunt spell's two, an arrival hunter's prey); an
 * empowered cast reads the Empower rider's; a Duty its own. Retell and
 * Hauntlink casts choose something else (a Retell body, a host) and never
 * hunt at cast.
 */
export type HuntTargetSource = 'cast' | 'empoweredCast' | 'duty' | 'retellCast' | 'hauntlinkCast';

function opsHunt(ops: readonly EffectOp[] | undefined, hunter: 'self' | 'target'): boolean {
  return (ops ?? []).some((op) => op.op === 'hunt' && op.hunter === hunter);
}

/** A Hunt spell: a spell body whose Hunt takes its hunter from target slot 0 and its prey from slot 1. */
export function isHuntSpell(card: Pick<CardDef, 'abilities'>): boolean {
  return (card.abilities ?? []).some((ability) => ability.when === 'spell' && opsHunt(ability.ops, 'target'));
}

/** An ability whose one target is a Hunt's prey (a source-bound Hunt: arrival, attack, Dawn, Duty, Empower). */
export function abilityHuntsPrey(ability: Pick<AbilityDef, 'ops'> | undefined): boolean {
  return opsHunt(ability?.ops, 'self');
}

/**
 * The prompt for the target slot being picked, or null when that slot is not
 * a Hunt's (the caller keeps its ordinary prompt). A Hunt spell asks for the
 * hunter, then its prey; every source-bound Hunt chooses only the prey (the
 * hunter is the card itself), including an arrival hunter's prey at cast.
 * `slot` is the number already picked; once every slot is picked the last
 * step's prompt stays up beside the full count, so the confirm still reads
 * as the Hunt's.
 */
export function huntStepPrompt(
  card: CardDef,
  source: HuntTargetSource,
  slot: number,
  dutyIndex = 0,
): string | null {
  switch (source) {
    case 'cast': {
      if (isHuntSpell(card)) return slot === 0 ? HUNT_HUNTER_PROMPT : HUNT_PREY_PROMPT;
      const arrival = card.types.includes('creature') && (card.abilities ?? []).some(isArrivalHunt);
      return arrival ? HUNT_PREY_PROMPT : null;
    }
    case 'empoweredCast':
      return abilityHuntsPrey(card.empower) ? HUNT_PREY_PROMPT : null;
    case 'duty': {
      return abilityHuntsPrey(activatedAbilitiesOf(card)[dutyIndex]) ? HUNT_PREY_PROMPT : null;
    }
    case 'retellCast':
    case 'hauntlinkCast':
      return null;
  }
}

/**
 * The cast/Duty prompt line: a Hunt's step prompt after the card's name, with
 * the pick count, or the ordinary title for anything else.
 */
export function targetStepTitle(cardName: string, huntPrompt: string | null, ordinaryTitle: string, countText: string): string {
  return huntPrompt === null ? `${ordinaryTitle} · ${countText}` : `${cardName}: ${huntPrompt} (${countText})`;
}

// ---------------------------------------------------------------------------
// The exchange
// ---------------------------------------------------------------------------

/** One creature's blow: `amount` from `source`, landing on `target` (the other creature). */
export interface HuntBlow {
  readonly source: number;
  readonly target: number;
  readonly amount: number;
}

/**
 * Both blows of one Hunt, dealt at the same time: the hunter's lands on the
 * prey, the prey's on the hunter. A creature with no Attack deals 0 and its
 * blow is still listed, so the other creature can show that nothing landed.
 */
export function huntBlows(e: HuntedEvent): readonly [HuntBlow, HuntBlow] {
  return [
    { source: e.hunter, target: e.prey, amount: Math.max(0, e.hunterDamage) },
    { source: e.prey, target: e.hunter, amount: Math.max(0, e.preyDamage) },
  ];
}

/** The number that lands on a creature: the damage it took, or "0" when the other creature dealt none. */
export function huntFloatText(amount: number): string {
  return amount > 0 ? `-${amount}` : '0';
}

/**
 * Whether a creature has a spot the exchange can draw on: a tile on the board
 * now, or one it will have once the board has synced. An arrival or Empower
 * hunter cast this batch has none until the sync, and none at all when the
 * Hunt killed it.
 */
export type HuntPlaced = (iid: number) => boolean;

const everyCreaturePlaced: HuntPlaced = () => true;

/** One of a Hunt's creatures as the exchange needs it: its card (for its attack effect) and whose it is. */
export interface HuntCreature {
  readonly card: CardDef;
  readonly side: PlayerId;
}

/** One blow the exchange draws: its number lands on `blow.target`'s spot. */
export interface HuntLanding {
  readonly blow: HuntBlow;
  /** The striker has a spot to strike from. When it has none, the blow comes in from its side of the board. */
  readonly strikerPlaced: boolean;
}

/** What one Hunt's exchange draws, given which of its two creatures has a spot. */
export interface HuntExchangeDraw {
  /** Both creatures have a spot: the tether between them, and their lunges. */
  readonly tether: boolean;
  /** The blows whose target has a spot, hunter's first. A blow that deals 0 still lands its number. */
  readonly landings: readonly HuntLanding[];
}

/**
 * Decide what a Hunt's exchange draws. A creature with no spot takes no
 * number, but the blow it dealt still lands on the other one: an arrival
 * hunter that dies in its own Hunt never had a tile, and its prey still shows
 * the damage it took.
 */
export function huntExchangeDraw(hunt: HuntedEvent, placed: HuntPlaced): HuntExchangeDraw {
  return {
    tether: placed(hunt.hunter) && placed(hunt.prey),
    landings: huntBlows(hunt)
      .filter((blow) => placed(blow.target))
      .map((blow) => ({ blow, strikerPlaced: placed(blow.source) })),
  };
}

/** A creature that took part in one of the batch's Hunts, as its hunter or its prey. */
export function tookPartInHunt(batch: readonly GameEvent[], iid: number): boolean {
  return batch.some((event) => event.e === 'hunted' && (event.hunter === iid || event.prey === iid));
}

/**
 * The `damageMarked` events a Hunt's exchange already draws, so the generic
 * damage float does not repeat them: for each `hunted`, the first following
 * mark on the prey for the hunter's amount and on the hunter for the prey's,
 * before the next `hunted`. Only a blow the exchange lands (`huntExchangeDraw`)
 * is claimed: damage on a creature with no spot stays with the generic path.
 * Any other damage in the batch (a spell's own damage op, a Provoked effect)
 * is left to the generic float too.
 */
export function huntDrawnDamage(batch: readonly GameEvent[], placed: HuntPlaced = everyCreaturePlaced): Set<GameEvent> {
  const drawn = new Set<GameEvent>();
  batch.forEach((event, index) => {
    if (event.e !== 'hunted') return;
    const pending = huntExchangeDraw(event, placed).landings.map((landing) => landing.blow).filter((blow) => blow.amount > 0);
    for (let next = index + 1; next < batch.length && pending.length > 0; next++) {
      const candidate = batch[next];
      if (candidate.e === 'hunted') break;
      if (candidate.e !== 'damageMarked') continue;
      const match = pending.findIndex((blow) => blow.target === candidate.iid && blow.amount === candidate.amount);
      if (match < 0) continue;
      drawn.add(candidate);
      pending.splice(match, 1);
    }
  });
  return drawn;
}

// ---------------------------------------------------------------------------
// Full-motion timing
// ---------------------------------------------------------------------------

/** One Hunt's moment in a full-motion sequence: both blows at `atMs`, and the deaths they cause. */
export interface HuntStep {
  readonly hunt: HuntedEvent;
  readonly blows: readonly [HuntBlow, HuntBlow];
  readonly deaths: number[];
  readonly atMs: number;
}

export interface HuntPlan {
  readonly steps: HuntStep[];
  /** When the last exchange has finished, from the sequence start. */
  readonly totalMs: number;
  /** Deaths no Hunt in the batch touched, left to the caller (combat's plan, or the last step). */
  readonly unclaimed: number[];
}

/**
 * Plan the batch's Hunts at combat's full-motion timing: one step per Hunt,
 * both blows in the same instant (a Hunt is simultaneous, so it is one
 * combat step, never two), steps a combat stagger apart, starting at
 * `startMs`, and the strike tail after the last. A death lands with the last
 * Hunt that touched the creature.
 */
export function planHunts(hunts: readonly HuntedEvent[], diedIids: readonly number[] = [], startMs = 0): HuntPlan {
  const { minStagger, maxStagger, budget, strikeMs } = COMBAT_SEQUENCE_TIMING;
  if (hunts.length === 0) return { steps: [], totalMs: startMs, unclaimed: [...diedIids] };
  const stagger = Math.max(minStagger, Math.min(maxStagger, Math.round(budget / hunts.length)));
  const steps: HuntStep[] = hunts.map((hunt, index) => ({ hunt, blows: huntBlows(hunt), deaths: [], atMs: startMs + index * stagger }));
  const unclaimed: number[] = [];
  for (const iid of diedIids) {
    let last = -1;
    steps.forEach((step, index) => {
      if (step.hunt.hunter === iid || step.hunt.prey === iid) last = index;
    });
    if (last < 0) unclaimed.push(iid);
    else steps[last].deaths.push(iid);
  }
  return { steps, totalMs: startMs + (hunts.length - 1) * stagger + strikeMs, unclaimed };
}
