/**
 * Phaser-free presentation rules shared by the duel board. Keeping these
 * choices data-only makes the playtest geometry and target semantics easy to
 * pin without importing a scene into UI tests.
 */

import type { Action } from '../engine/actions';
import type { CardDef, TargetRef } from '../engine/types';
import { rulesText } from './rulesText';

export type DuelSide = 'you' | 'opponent';
export type TargetRingTone = 'friendly' | 'hostile';

/** Small, non-interactive center prompt used while a mandatory arrival target is chosen. */
export const TARGET_PROMPT_LAYOUT = {
  cardX: 463,
  cardY: 298,
  cardScale: 0.28,
  titleX: 530,
  titleY: 240,
  textX: 530,
  textY: 267,
  textWidth: 220,
} as const;

export function targetPromptTitle(cardName: string): string {
  return `Choose a target for ${cardName}`;
}

/**
 * Reuse the canonical rules-text renderer while narrowing the card to the
 * queued ability. This keeps abilityIndex meaningful when one source has two
 * arrival triggers, without making rulesText scene-aware.
 */
export function targetAbilityText(card: CardDef, abilityIndex: number): string {
  const ability = card.abilities?.[abilityIndex];
  if (!ability) return '';
  return rulesText({
    id: card.id,
    name: card.name,
    types: card.types,
    subtypes: card.subtypes,
    colors: card.colors,
    abilities: [ability],
    rarity: card.rarity,
  });
}

export const TARGET_ARROW_HEAD_LENGTH = 16;

/** Stop the flat shaft at the back of the filled head instead of under its tip. */
export function targetArrowShaftEnd(
  control: { x: number; y: number },
  tip: { x: number; y: number },
  headLength = TARGET_ARROW_HEAD_LENGTH,
): { x: number; y: number } {
  const dx = tip.x - control.x;
  const dy = tip.y - control.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...tip };
  return {
    x: tip.x - (dx / length) * headLength,
    y: tip.y - (dy / length) * headLength,
  };
}

export interface PresentationRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The foe's Warchest pile lives in the narrow right gutter of the opponent
 * plate. These are the scene's audited design-space measurements, kept here
 * so clearance can be proven without importing Phaser into tests.
 */
export const OPPONENT_RESERVE_PILE_LAYOUT = {
  x: 1024,
  y: 132,
  cardScale: 0.12,
  visualHalfWidth: 20,
  visualTop: -28,
  visualBottom: 28,
} as const;

export const OPPONENT_RESERVE_CLEARANCE = {
  plate: { left: 108, right: 1046, top: 16, bottom: 292 },
  manaStrip: { x0: 1006, cy: 56, step: 44, halfHeight: 22 },
  permanentBand: { left: 120, right: 500, cy: 63, halfHeight: 46.75 },
  creatureBand: {
    x: 577,
    cy: 200,
    usable: 860,
    tileWidth: 156,
    tileHeight: 170,
    maxSpacing: 174,
    gutter: 6,
  },
  portrait: { left: 1056, right: 1256, top: 8, bottom: 188 },
  darling: { left: 1126, right: 1186, top: 200, bottom: 284 },
} as const;

export function opponentReservePileBounds(): PresentationRect {
  const pile = OPPONENT_RESERVE_PILE_LAYOUT;
  return {
    left: pile.x - pile.visualHalfWidth,
    right: pile.x + pile.visualHalfWidth,
    top: pile.y + pile.visualTop,
    bottom: pile.y + pile.visualBottom,
  };
}

export function presentationRectsOverlap(a: PresentationRect, b: PresentationRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * A linked card sits beneath its host with its header exposed above the host.
 * The 64% scale and -56px rise leave the header clear of both creature rows;
 * the shallow sideways nudge reads as a physical paper overlap rather than a
 * centered state badge.
 */
export const HAUNTLINK_OVERLAP = {
  scale: 0.64,
  rise: 56,
  sideNudge: 18,
  stackStepX: 10,
  stackStepY: 6,
} as const;

export function hauntlinkOverlap(side: DuelSide, slot = 0): { x: number; y: number; scale: number } {
  return {
    x: (side === 'you' ? -HAUNTLINK_OVERLAP.sideNudge : HAUNTLINK_OVERLAP.sideNudge) + slot * HAUNTLINK_OVERLAP.stackStepX,
    y: -HAUNTLINK_OVERLAP.rise - slot * HAUNTLINK_OVERLAP.stackStepY,
    scale: HAUNTLINK_OVERLAP.scale,
  };
}

export function hauntlinkActionLabel(hasLegalAction: boolean, linked: boolean): 'Link' | 'Relink' | null {
  if (!hasLegalAction) return null;
  return linked ? 'Relink' : 'Link';
}

export const DUTY_ACTION_LABEL = 'Perform Duty';
export const DUTY_CANCEL_LABEL = 'Cancel';
export const DUTY_PLAYER_LABELS = ['You', 'Opponent'] as const;

export function dutyNarration(cardName: string): string {
  return `${cardName} performs its Duty.`;
}

const DUTY_BLOCKED_COPY: Readonly<Record<string, string>> = {
  'Activated abilities can only be used during your Morning or Afternoon': 'Duty: only in your Morning or Afternoon.',
  'Activated abilities need an empty stack': 'Duty: wait for the stack to clear.',
  'Activated source is not on the battlefield': 'Duty: this permanent is not on the battlefield.',
  'Activated source is not under your control': 'Duty: you do not control this permanent.',
  'permanent has no activated ability': 'Duty: this permanent has no Duty.',
  'Activated source is tapped': 'Duty: this permanent is tapped.',
  'Activated source cannot tap the turn it arrives unless it has Warcry': 'Duty: it arrived this turn.',
  'cannot pay cost': 'Duty: you cannot pay the cost.',
  'no legal targets for activated ability': 'Duty: no legal target.',
};

/** Translate engine diagnostics without leaking engine terminology into notices. */
export function dutyBlockedCopy(reason: string | null): string | null {
  if (reason === null) return null;
  return Object.hasOwn(DUTY_BLOCKED_COPY, reason)
    ? DUTY_BLOCKED_COPY[reason]
    : 'Duty: you cannot use it right now.';
}

export type DutyAction = Extract<Action, { type: 'activate' }>;

/** Lands and ordinary attached Auras have no board tile, so they need a picker. */
export function dutyTargetsNeedPicker(targets: readonly TargetRef[], visibleIids: ReadonlySet<number>): boolean {
  return targets.some((target) => target.kind === 'grave' ||
    (target.kind === 'permanent' && !visibleIids.has(target.iid)));
}

function sameDutyTarget(a: TargetRef, b: TargetRef): boolean {
  if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
  if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
  if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
  return a.kind === 'grave' && b.kind === 'grave' && a.player === b.player && a.index === b.index;
}

/**
 * Narrow only enumerated legal actions. Ordinary multi-target specs retain
 * their order (notably moveMark's donor and recipient); upTo targets form a
 * set, so either member of the engine's canonical pair can be picked first.
 * `complete` always retains the original engine action, including its plan.
 */
export function dutyTargetStep(
  actions: readonly DutyAction[],
  picked: readonly TargetRef[],
  unordered = false,
): { actions: DutyAction[]; targets: TargetRef[]; complete: DutyAction | null } {
  const duplicate = unordered && picked.some((target, index) =>
    picked.slice(0, index).some((previous) => sameDutyTarget(previous, target)),
  );
  const matches = duplicate ? [] : actions.filter((action) => {
    const targets = action.targets ?? [];
    return picked.every((target, index) => unordered
      ? targets.some((candidate) => sameDutyTarget(candidate, target))
      : targets[index] !== undefined && sameDutyTarget(targets[index], target));
  });
  const targets: TargetRef[] = [];
  for (const action of matches) {
    const remaining = unordered
      ? (action.targets ?? []).filter((target) => !picked.some((chosen) => sameDutyTarget(chosen, target)))
      : (action.targets ?? []).slice(picked.length, picked.length + 1);
    for (const target of remaining) {
      if (!targets.some((candidate) => sameDutyTarget(candidate, target))) targets.push(target);
    }
  }
  return {
    actions: matches,
    targets,
    complete: matches.find((action) => (action.targets?.length ?? 0) === picked.length) ?? null,
  };
}

/** Controller-side rule for legal target rings, independent of spell intent. */
export function targetRingTone(controller: DuelSide): TargetRingTone {
  return controller === 'opponent' ? 'hostile' : 'friendly';
}

/**
 * Full-motion card travel only. Reduced/off paths deliberately retain their
 * existing compact treatment. These visual tweens never await or extend an
 * action lock.
 */
export const CARD_TRAVEL_MOTION = {
  handExit: { duration: 225, ease: 'Quad.easeIn' },
  drawToHand: { duration: 280, ease: 'Quad.easeOut', destinationPreviewAlpha: 0.42 },
  playToStation: { duration: 420, ease: 'Cubic.easeOut' },
  playerStationHold: 300,
  opponentStationHold: 500,
  stationToBattlefield: { duration: 420, ease: 'Cubic.easeInOut' },
  arrivalFade: { duration: 120, ease: 'Quad.easeIn' },
  skimToGraveyard: { duration: 540, ease: 'Cubic.easeInOut' },
  severToPile: { duration: 540, ease: 'Cubic.easeInOut' },
  batch: { maxAnimatedCards: 3, staggerMs: 70 },
} as const;

/** Hold-to-confirm progress stays inside the action that owns the choice. */
export const SHARD_HOLD_BUTTON_PROGRESS = {
  inset: 3,
  cornerRadius: 4,
  fillAlpha: 0.3,
  ringWidth: 2,
} as const;

/** One physical card in a graveyard, keyed to its engine index. */
export interface GraveyardSlot {
  cardId: string;
  /** Index into the engine's graveyard array, which runs oldest to newest. */
  index: number;
  /** The most-recently-buried card: the one `raise top` returns. */
  top: boolean;
}

/**
 * A graveyard is an ORDERED pile, and the order is load-bearing: `raise top`
 * takes the most-recently-buried creature. The zone modal used to collapse
 * duplicates and sort by type and cost, so the pile's order was unreadable and
 * a card's position said nothing (player report 2026-08-25: a cycled card
 * landed in the middle of the grid). List every card in its own slot, newest
 * first, so the top of the pile is the first tile you read.
 */
export function orderedGraveyardSlots(cardIds: readonly string[]): GraveyardSlot[] {
  const slots: GraveyardSlot[] = [];
  for (let i = cardIds.length - 1; i >= 0; i--) {
    slots.push({ cardId: cardIds[i], index: i, top: i === cardIds.length - 1 });
  }
  return slots;
}

/**
 * The land-drop guard. A reserve format keeps your lands in the Warchest
 * instead of your hand, so nothing on the board says "you still have a land
 * drop" the way a land sitting in hand did, and skipping one by accident is
 * easy (player report 2026-08-25). Ending the turn on an unused drop therefore
 * takes a second press, on the same arm-then-confirm model an empty block uses.
 */
export interface LandDropGuardInput {
  /** A `playLand` action is legal for the human right now. */
  landDropAvailable: boolean;
  /** This press ends the turn: a main2 pass, or the End Turn fast-forward. */
  turnEnds: boolean;
  /** `settings.confirmLandDrop`. */
  confirmEnabled: boolean;
  /** A previous press already armed the guard. */
  armed: boolean;
  /** The tutorial and replays pace themselves and are never interrupted. */
  suppressed: boolean;
}

/** Whether the guard has anything to say about this decision at all. */
export function landDropGuardApplies(input: LandDropGuardInput): boolean {
  return input.landDropAvailable && input.turnEnds && input.confirmEnabled && !input.suppressed;
}

/** Whether THIS press should arm rather than commit. */
export function shouldArmLandDrop(input: LandDropGuardInput): boolean {
  return landDropGuardApplies(input) && !input.armed;
}

/**
 * Which action chip a graveyard tile carries. A `ZoneContentsEntry` has one
 * action slot, so a card offering both graveyard actions has to pick: Retell
 * wins, because it is the one that puts a spell on the stack, and Preserve
 * stays available on the next visit. No card in the pool carries both today
 * and a catalog test keeps it that way, since the loser would be as invisible
 * as Preserve itself was before 2026-08-25.
 */
export function graveActionChoice(
  hasRetell: boolean,
  hasPreserve: boolean,
): 'retell' | 'preserve' | null {
  if (hasRetell) return 'retell';
  return hasPreserve ? 'preserve' : null;
}

/** Armed smart-button label, in the terse family of "Confirm: no blocks". */
export const LAND_DROP_CONFIRM_LABEL = 'Confirm: skip land';
/** Toast for the End Turn path, which has no label of its own to change. */
export const LAND_DROP_NOTICE = 'You still have a land drop this turn.';
