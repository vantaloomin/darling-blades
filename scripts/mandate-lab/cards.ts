/**
 * The rate lab's synthetic cards (2.0 plan: the Mandate's rates, lane B5,
 * and the life rates re-derived for 25 life, lane D3). Every card is a
 * colourless 3/3, so any field deck casts it, and the arms differ only in
 * the line under test. They live in a copy of the card database built here;
 * nothing under src/data changes.
 */
import { cost } from '../../src/data/cardTypes';
import { CARD_DB } from '../../src/data/catalog';
import type { ActivatedDef, CardDb, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';

const MARKS2: CardDef['abilities'] = [{ when: 'arrives', ops: [{ op: 'addCounters', n: 2, to: 'self' }] }];
const stone = (mana: number, ops: EffectOp[], targets?: TargetSpec[]): ActivatedDef => ({
  cost: { removeMarks: 1, mana: cost(mana) },
  ops,
  ...(targets ? { targets } : {}),
});

const NUWA: Partial<CardDef> = {
  supertypes: ['legendary'],
  attack: 4,
  defense: 4,
  tithe: { per: 2 },
  abilities: [{ when: 'arrives', ops: [{ op: 'claimMandate' }] }],
};

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
  /** "When this arrives, you gain 1 life." (gain 1 is the gain line extended, not measured.) */
  gain1: body('lab-gain1', 'Lab Orderly', 3, { abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }] }),
  /** Recurring life at your dawn: "At your dawn, you gain 1 life." / "...gain 2 life." / "...each opponent loses 1 life." */
  dawnGain1: body('lab-dawn-gain1', 'Lab Hearth', 3, { abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] }] }),
  dawnGain2: body('lab-dawn-gain2', 'Lab Spring', 3, { abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] }] }),
  dawnDrain1: body('lab-dawn-drain1', 'Lab Leech', 3, { abilities: [{ when: 'dawn', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }] }),
  /** The stones' carrier (Core Set II costing, Nüwa): "When this arrives, put two marks on it." */
  marks2: body('lab-marks2', 'Lab Vessel', 3, { abilities: MARKS2 }),
  /** Each stone on the carrier: "{1}, remove a mark from this: ..." ({2} for Sever, Nüwa's {B}{B}). */
  stoneDraw: body('lab-stone-draw', 'Lab Vessel (draw)', 3, { abilities: MARKS2, activated: [stone(1, [{ op: 'draw', n: 2 }])] }),
  stoneBurn: body('lab-stone-burn', 'Lab Vessel (burn)', 3, {
    abilities: MARKS2,
    activated: [stone(1, [{ op: 'damage', n: 3, to: 'target' }], [{ what: 'any' }])],
  }),
  stoneLife: body('lab-stone-life', 'Lab Vessel (life)', 3, { abilities: MARKS2, activated: [stone(1, [{ op: 'gainLife', n: 5 }])] }),
  stoneSever: body('lab-stone-sever', 'Lab Vessel (sever)', 3, {
    abilities: MARKS2,
    activated: [stone(2, [{ op: 'sever', to: 'target' }], [{ what: 'opponentCreature' }])],
  }),
  stoneMarkAll: body('lab-stone-markall', 'Lab Vessel (mark all)', 3, {
    abilities: MARKS2,
    activated: [stone(1, [{ op: 'markAll', scope: 'yourCreatures', other: true }])],
  }),
  /** Tithe marks (Nüwa): a 3/3 Tithe for five, without and with "arrives with a mark per {1} saved (at most 5)". */
  tithe5: body('lab-tithe5', 'Lab Offering', 5, { tithe: { per: 2 } }),
  titheMarks5: body('lab-tithe-marks5', 'Lab Offering (marks)', 5, { tithe: { per: 2, marks: 5 } }),
  /**
   * Nüwa on her own chassis, colourless so any deck can cast her (each stone
   * at {1}, Sever at {2}): a legendary 4/4 Tithe for ten that claims the
   * Mandate on arrival; then with "arrives with a mark per {1} Tithe saved (at
   * most 5)"; then with the marks and her five stones.
   */
  nuwaBody: body('lab-nuwa-body', 'Lab Goddess', 10, NUWA),
  nuwaMarks: body('lab-nuwa-marks', 'Lab Goddess (marks)', 10, { ...NUWA, tithe: { per: 2, marks: 5 } }),
  nuwaFull: body('lab-nuwa-full', 'Lab Goddess (stones)', 10, {
    ...NUWA,
    tithe: { per: 2, marks: 5 },
    activated: [
      stone(1, [{ op: 'damage', n: 3, to: 'target' }], [{ what: 'any' }]),
      stone(1, [{ op: 'markAll', scope: 'yourCreatures', other: true }]),
      stone(1, [{ op: 'gainLife', n: 5 }]),
      stone(1, [{ op: 'draw', n: 2 }]),
      stone(2, [{ op: 'sever', to: 'target' }], [{ what: 'opponentCreature' }]),
    ],
  }),
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
 *
 * The dawn set (Core Set II costing) checks the small life lines the set
 * prints most: gain 1 on arrival, and gain 1, gain 2 or drain 1 at each of
 * your dawns.
 *
 * The nuwa set reads Nüwa's marks and stones on her own chassis (a 4/4
 * Tithe for ten that claims), each against the chassis alone.
 *
 * The stones set (Core Set II costing) prices Nüwa's two unpriced pieces on
 * colourless carriers, each read against its own control (`vs`):
 * - marks: a 3/3 for three that puts two marks on itself as it arrives (read
 *   against base: the scorer's mark rate, checked).
 * - stoneDraw, stoneBurn, stoneLife, stoneSever, stoneMarkAll: that carrier
 *   with one stone, "{1}, remove a mark from this: ..." ({2} for Sever), read
 *   against marks, so each lift is the stone's option value with two marks.
 * - tithe / titheMarks: a 3/3 Tithe for five, then the same with "arrives with
 *   a mark per {1} Tithe saved (at most 5)"; titheMarks reads against tithe.
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
  dawn: {
    ...SHARED,
    gain1: { row: 'gain1', col: 'ctl3' },
    dawnGain1: { row: 'dawnGain1', col: 'ctl3' },
    dawnGain2: { row: 'dawnGain2', col: 'ctl3' },
    dawnDrain1: { row: 'dawnDrain1', col: 'ctl3' },
  },
  stones: {
    ...SHARED,
    marks: { row: 'marks2', col: 'ctl3' },
    stoneDraw: { row: 'stoneDraw', col: 'ctl3', vs: 'marks' },
    stoneBurn: { row: 'stoneBurn', col: 'ctl3', vs: 'marks' },
    stoneLife: { row: 'stoneLife', col: 'ctl3', vs: 'marks' },
    stoneSever: { row: 'stoneSever', col: 'ctl3', vs: 'marks' },
    stoneMarkAll: { row: 'stoneMarkAll', col: 'ctl3', vs: 'marks' },
    tithe: { row: 'tithe5', col: 'ctl3' },
    titheMarks: { row: 'titheMarks5', col: 'ctl3', vs: 'tithe' },
  },
  nuwa: {
    ...SHARED,
    nuwaBody: { row: 'nuwaBody', col: 'ctl3' },
    nuwaMarks: { row: 'nuwaMarks', col: 'ctl3', vs: 'nuwaBody' },
    nuwaFull: { row: 'nuwaFull', col: 'ctl3', vs: 'nuwaBody' },
  },
} as const satisfies Record<string, Record<string, { row: LabCard; col: LabCard; vs?: string }>>;

export type ArmSetName = keyof typeof ARM_SETS;
export type ArmName = { [S in ArmSetName]: keyof (typeof ARM_SETS)[S] }[ArmSetName];
/** An arm: the cards each side adds, and the arm it is read against (base when absent). */
export interface Arm { row: LabCard; col: LabCard; vs?: ArmName }
export const ARMS: Record<ArmName, Arm> = Object.assign({}, ...Object.values(ARM_SETS));
export const armNames = (set: ArmSetName): ArmName[] => Object.keys(ARM_SETS[set]) as ArmName[];

/** A field deck with an arm's four copies added. */
export function withLabCards(deck: readonly string[], card: LabCard): string[] {
  const id = LAB_CARDS[card].id;
  return [...deck, id, id, id, id];
}
