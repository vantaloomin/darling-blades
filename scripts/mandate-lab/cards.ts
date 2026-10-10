/**
 * The rate lab's synthetic cards (2.0 plan: the Mandate's rates, lane B5,
 * and the life rates re-derived for 25 life, lane D3). Every card is a
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
  /** "When this arrives, you gain 4 life." */
  gain3: body('lab-gain3', 'Lab Medic', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 4 }] }] }),
  /** "When this arrives, you gain 2 life." / "...gain 8 life." */
  gain2: body('lab-gain2', 'Lab Nurse', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }] }),
  gain8: body('lab-gain8', 'Lab Surgeon', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 8 }] }] }),
  /** "When this arrives, each opponent loses 3 life." */
  drain3: body('lab-drain3', 'Lab Raider', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'loseLife', n: 3, who: 'opponent' }] }] }),
} satisfies Record<string, CardDef>;

export type LabCard = keyof typeof LAB_CARDS;

export const LAB_DB: CardDb = Object.freeze({
  ...CARD_DB,
  ...Object.fromEntries(Object.values(LAB_CARDS).map((d) => [d.id, d])),
});

/**
 * The arm sets. Each arm adds four copies of one lab card to the row
 * (subject) deck and four of another to the column deck, so every arm plays
 * 64-card decks on the same seeds and differs from the base only in those
 * cards. Every set opens with base and mana, the conversion unit.
 *
 * - base: both decks add the control.
 * - mana: the subject's copies cost one less.
 *
 * The Mandate set (B5):
 * - claim: the subject claims, the opponent can't (uncontested).
 * - contested: both claim.
 * - contestedBase: only the opponent claims (contested's control).
 *
 * The life set (D3), played at each starting life under study:
 * - gain: the subject gains 4 life on arrival.
 * - drain: the subject's opponent loses 3 life on arrival.
 *
 * The gain set prices a point of life gain: 2, 4 and 8 life on arrival.
 */
const SHARED = {
  base: { row: 'ctl3', col: 'ctl3' },
  mana: { row: 'ctl2', col: 'ctl3' },
} as const;

export const ARM_SETS = {
  mandate: {
    ...SHARED,
    claim: { row: 'claim3', col: 'ctl3' },
    contested: { row: 'claim3', col: 'claim3' },
    contestedBase: { row: 'ctl3', col: 'claim3' },
  },
  life: {
    ...SHARED,
    gain: { row: 'gain3', col: 'ctl3' },
    drain: { row: 'drain3', col: 'ctl3' },
  },
  gain: {
    ...SHARED,
    gain2: { row: 'gain2', col: 'ctl3' },
    gain4: { row: 'gain3', col: 'ctl3' },
    gain8: { row: 'gain8', col: 'ctl3' },
  },
} as const satisfies Record<string, Record<string, { row: LabCard; col: LabCard }>>;

export type ArmSetName = keyof typeof ARM_SETS;
export type ArmName = { [S in ArmSetName]: keyof (typeof ARM_SETS)[S] }[ArmSetName];
export const ARMS: Record<ArmName, { row: LabCard; col: LabCard }> = Object.assign({}, ...Object.values(ARM_SETS));
export const armNames = (set: ArmSetName): ArmName[] => Object.keys(ARM_SETS[set]) as ArmName[];

/** A field deck with an arm's four copies added. */
export function withLabCards(deck: readonly string[], card: LabCard): string[] {
  const id = LAB_CARDS[card].id;
  return [...deck, id, id, id, id];
}
