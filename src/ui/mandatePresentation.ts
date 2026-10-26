/**
 * The Mandate on the duel board (2.0 lane B4), Phaser-free so its placement
 * and copy can be checked headlessly. `MandateSeal` draws it; DuelScene
 * decides when it moves.
 *
 * Placement follows the owner's mobile calls (ruled 2026-10-10): M1, the held
 * seal sits beside its holder's life badge, on the commander portrait and
 * never over the life number; M2, nothing is shown while no one holds it.
 */
import type { GameEvent } from '../engine/events';
import type { CardDef, PlayerId } from '../engine/types';
import { DUEL_LAYOUT, LIFE_BADGE_REACH } from './duelLayout';

/** The seal's drawn diameter on the 1280×720 board. */
export const MANDATE_SEAL_SIZE = 30;
/** The seal's drawn diameter on the phone, beside the life pill (N-02, the owner's M1). */
export const MANDATE_SEAL_PHONE_SIZE = 26;
/** The seal's hit area: the 44px touch floor. */
export const MANDATE_SEAL_HIT = 44;
/** The claim flight, one tween (the mobile frames' N5). */
export const MANDATE_CLAIM_MS = 600;
/** Air between the life badge's reach and the seal's rim. */
const SEAL_GAP = 4;

/** The rules reminder, word for word from the set plan. */
export const MANDATE_REMINDER =
  'The Mandate begins unclaimed. At your Dawn, if you hold it, draw a card. ' +
  'When your creatures deal combat damage to the player who holds it, you claim it.';

export type MandateSpot = 'you' | 'opponent';

/** Where the seal sits for this holder, from the human's side; null while unclaimed (nothing drawn). */
export function mandateSpot(holder: PlayerId | null | undefined, human: PlayerId): MandateSpot | null {
  if (holder === null || holder === undefined) return null;
  return holder === human ? 'you' : 'opponent';
}

/** The seal's centre beside the holder's life badge. */
export function mandateSealCenter(spot: MandateSpot): { x: number; y: number } {
  const offset = LIFE_BADGE_REACH + SEAL_GAP + MANDATE_SEAL_SIZE / 2;
  // Each life badge sits at its portrait's outer corner; the seal sits inboard of it.
  return spot === 'you'
    ? { x: DUEL_LAYOUT.myLife.x + offset, y: DUEL_LAYOUT.myLife.y }
    : { x: DUEL_LAYOUT.oppLife.x - offset, y: DUEL_LAYOUT.oppLife.y };
}

/** The seal's hover line, which also names it for assistive reading. */
export function mandateSealCaption(spot: MandateSpot): string {
  return spot === 'you' ? 'You hold the Mandate' : 'Your opponent holds the Mandate';
}

/** A card on the board whose text reads the Mandate, as the phone's Mandate sheet lists it (N-04). */
export interface MandateCareRow {
  cardId: string;
  mine: boolean;
  /** The card's sentence about the Mandate. */
  line: string;
  /** Whether its Mandate condition holds now; null for a card with none (a claim trigger). */
  active: boolean | null;
}

/**
 * The permanents whose text reads the Mandate, yours first, each with its
 * Mandate sentence and, for a "while you hold" or "if you don't hold"
 * card, whether that holds now for its controller.
 */
export function mandateCareRows(
  permanents: readonly { card: CardDef; controller: PlayerId; text: string }[],
  holder: PlayerId | null | undefined,
  human: PlayerId,
): MandateCareRow[] {
  const rows: MandateCareRow[] = [];
  for (const { card, controller, text } of permanents) {
    const sentences = text.split(/(?<=\.)\s+|\n/).filter((s) => s.includes('Mandate'));
    if (sentences.length === 0) continue;
    const conditions = [
      ...(card.abilities ?? []).map((a) => a.condition),
      ...(card.abilities ?? []).map((a) => a.static?.condition),
    ];
    const holds = holder === controller;
    const active = conditions.includes('youHoldMandate') ? holds : conditions.includes('youDontHoldMandate') ? !holds : null;
    const conditional = sentences.find((s) => /hold the Mandate/.test(s));
    // With its condition shown as Active or Not active, the line keeps only what the card does.
    const mine = controller === human;
    const line = active !== null && conditional ? conditionEffect(conditional, mine) : sentences[0];
    rows.push({ cardId: card.id, mine, line, active });
  }
  return rows.sort((a, b) => Number(b.mine) - Number(a.mine));
}

/**
 * "While you hold the Mandate, X." as "X"; a Dawn line keeps "at Dawn". The
 * foe's card is told from your side ("your opponent loses 1 life" reads
 * "you lose 1 life"), since the row already names whose it is.
 */
function conditionEffect(sentence: string, mine: boolean): string {
  const match = /^(During your Dawn:?\s*)?(?:While|If|As long as) you (?:don't )?hold the Mandate,\s*(.+?)\.?$/i.exec(sentence);
  if (!match) return sentence;
  const effect = mine ? match[2] : match[2]
    .replace(/\byour opponent loses\b/g, '@YOU@ lose')
    .replace(/\byour opponent\b/g, '@YOU@')
    .replace(/\byou control\b/g, 'they control')
    .replace(/\byou gain\b/g, 'they gain')
    .replace(/\byour\b/g, 'their')
    .replace(/\byou\b/g, 'they')
    .replace(/@YOU@/g, 'you');
  return `${effect}${match[1] ? (mine ? ' at Dawn' : ' at their Dawn') : ''}`;
}

/** One claim in this duel, as the phone's Mandate sheet lists it (N-04). */
export interface MandateClaim {
  turn: number;
  to: PlayerId;
  reason: 'effect' | 'combat';
  /** The cards that made it: the creatures that hit, or the spell or ability that claimed it. */
  cards: string[];
}

/**
 * The cards behind the claim at `index` in its batch. Combat names the
 * creatures whose blows hit the old holder; an effect names the nearest
 * spell, trigger or ability before it. Empty when none is in the batch.
 */
export function mandateClaimCards(
  batch: readonly GameEvent[],
  index: number,
  spellCard: (sid: number) => string | undefined,
  permanentCard: (iid: number) => string | undefined,
): string[] {
  const claim = batch[index];
  if (claim?.e !== 'mandateChanged') return [];
  for (let i = index - 1; i >= 0; i--) {
    const e = batch[i];
    if (claim.reason === 'combat') {
      if (e.e !== 'combatDamage') continue;
      const ids = e.hits
        .filter((hit) => hit.target.kind === 'player' && hit.target.player === claim.from && hit.amount > 0)
        .map((hit) => permanentCard(hit.source))
        .filter((id): id is string => id !== undefined);
      return [...new Set(ids)];
    }
    const id = e.e === 'spellResolved' ? spellCard(e.sid)
      : e.e === 'triggerFired' ? permanentCard(e.iid)
        : e.e === 'activated' ? e.cardId : undefined;
    if (id !== undefined) return [id];
  }
  return [];
}

/** A claim's how, under its turn: "Combat damage (Lu Bu)", or the card that claimed it. */
export function mandateClaimDetail(claim: MandateClaim, name: (cardId: string) => string): string {
  const names = claim.cards.map(name);
  if (claim.reason === 'combat') return names.length ? `Combat damage (${names.join(', ')})` : 'Combat damage';
  return names[0] ?? 'A card\'s effect';
}
