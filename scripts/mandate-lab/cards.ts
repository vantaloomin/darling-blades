/**
 * The Mandate lab's synthetic cards (2.0 plan, lane B, B5). Every card is a
 * colourless 3/3, so any field deck casts it, and the arms differ only in
 * the line under test. They live in a copy of the card database built here;
 * nothing under src/data changes.
 */
import { cost } from '../../src/data/cardTypes';
import { CARD_DB } from '../../src/data/catalog';
import type { CardDb, CardDef } from '../../src/engine/types';

const body = (id: string, name: string, mana: number, extra: Partial<CardDef> = {}): CardDef => ({
  id,
  name,
  types: ['creature'],
  subtypes: ['Lab'],
  cost: cost(mana),
  colors: [],
  attack: 3,
  defense: 3,
  rarity: 'c',
  ...extra,
});

export const LAB_CARDS = {
  /** The control: a vanilla 3/3 for three. */
  ctl3: body('lab-ctl3', 'Lab Sentry', 3),
  /** The same body a mana cheaper: one mana's worth of win rate, to convert the others. */
  ctl2: body('lab-ctl2', 'Lab Sentry (cheap)', 2),
  /** The claim: "When this arrives, claim the Mandate." */
  claim3: body('lab-claim3', 'Lab Usurper', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'claimMandate' }] }] }),
} satisfies Record<string, CardDef>;

export type LabCard = keyof typeof LAB_CARDS;

export const LAB_DB: CardDb = Object.freeze({
  ...CARD_DB,
  ...Object.fromEntries(Object.values(LAB_CARDS).map((d) => [d.id, d])),
});

/**
 * The arms. Each adds four copies of one lab card to the row (subject) deck
 * and four of another to the column deck, so every arm plays 64-card decks
 * on the same seeds and differs from the base only in those cards.
 *
 * - base: both decks add the control.
 * - mana: the subject's copies cost one less (the conversion unit).
 * - claim: the subject claims, the opponent can't (uncontested).
 * - contested: both claim.
 * - contestedBase: only the opponent claims (contested's control).
 */
export const ARMS = {
  base: { row: 'ctl3', col: 'ctl3' },
  mana: { row: 'ctl2', col: 'ctl3' },
  claim: { row: 'claim3', col: 'ctl3' },
  contested: { row: 'claim3', col: 'claim3' },
  contestedBase: { row: 'ctl3', col: 'claim3' },
} as const satisfies Record<string, { row: LabCard; col: LabCard }>;

export type ArmName = keyof typeof ARMS;
export const ARM_NAMES = Object.keys(ARMS) as ArmName[];

/** A field deck with an arm's four copies added. */
export function withLabCards(deck: readonly string[], card: LabCard): string[] {
  const id = LAB_CARDS[card].id;
  return [...deck, id, id, id, id];
}
