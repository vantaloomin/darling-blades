import { describe, expect, it } from 'vitest';
import {
  cloneBuilderState,
  evaluateBuilder,
  fromCardDef,
  toCardDef,
  type BuilderState,
} from '../../src/forge/logic';
import { jsonClone, OP_RULES, validateCard } from '../../src/forge/validate';
import { OP_OPTIONS, defaultOp } from '../../src/forge/vocab';
import { dutiesOf, type ScorableCardDef } from '../../src/power/scoreCore';

// The Forge catching up with 2.0's engine: abilities paid by removing marks,
// Tithe's marks, modal spells, crownless legends, and claiming the Mandate.
// Each loads into the builder and converts back exactly, passes the import
// gate in the shapes the game allows, and is refused in the shapes it does not.

const creature = (extra: Partial<ScorableCardDef>): ScorableCardDef => ({
  id: 'synthetic-20-stone',
  name: 'Synthetic Stone Warden',
  types: ['creature'],
  subtypes: ['Construct'],
  cost: { generic: 3, pips: { G: 1 } },
  colors: ['G'],
  attack: 3,
  defense: 3,
  rarity: 'r',
  set: 'base',
  ...extra,
});

const ritual = (extra: Partial<ScorableCardDef>): ScorableCardDef => ({
  id: 'synthetic-20-command',
  name: 'Synthetic Command',
  types: ['ritual'],
  subtypes: [],
  cost: { generic: 2, pips: { R: 1 } },
  colors: ['R'],
  rarity: 'r',
  set: 'base',
  ...extra,
});

const modal = {
  upTo: 2,
  modes: [
    { ops: [{ op: 'damage', n: 2, to: 'target' }], targets: [{ what: 'any' }] },
    { ops: [{ op: 'draw', n: 1 }] },
    { ops: [{ op: 'gainLife', n: 3 }] },
  ],
} satisfies ScorableCardDef['modal'];

const markDuty = { cost: { removeMarks: 2, mana: { generic: 1, pips: {} } }, ops: [{ op: 'draw', n: 1 }] } satisfies ScorableCardDef['activated'];

/** The card with its first Duty's cost replaced by `cost`, as raw input. */
const withDutyCost = (cost: unknown): unknown => ({ ...creature({}), activated: { cost, ops: [{ op: 'draw', n: 1 }] } });

const reason = (value: unknown): string => {
  const check = validateCard(value);
  return check.ok ? 'ok' : check.reason;
};

const warningRules = (state: BuilderState): string[] => evaluateBuilder(state).warnings.map((warning) => `${warning.kind}:${warning.id}`);

describe('abilities paid by removing marks', () => {
  it('pass the import gate with a mark count and optional mana, and come back exactly', () => {
    const card = creature({ activated: markDuty });
    const check = validateCard(card);
    expect(check.ok && check.card.activated).toEqual(markDuty);
    expect(reason(withDutyCost({ removeMarks: 1 }))).toBe('ok');
  });

  it('are refused with both the tap and marks, with neither, or with a mark count out of range', () => {
    expect(reason(withDutyCost({ tap: true, removeMarks: 1 }))).toBe('shape');
    expect(reason(withDutyCost({ mana: { generic: 1, pips: {} } }))).toBe('shape');
    expect(reason(withDutyCost({ removeMarks: 0 }))).toBe('number');
    expect(reason(withDutyCost({ removeMarks: 6 }))).toBe('number');
    expect(reason(withDutyCost({ removeMarks: 1.5 }))).toBe('number');
  });

  it('load into the Duty editor as a mark payment and convert back unchanged', () => {
    const card = creature({ activated: markDuty });
    const state = fromCardDef(card);
    expect(state.mechanics.activated.payWith).toBe('marks');
    expect(state.mechanics.activated.marks).toBe(2);
    expect(toCardDef(state).activated).toEqual(markDuty);
    // Switching to the tap keeps the mana and drops the marks.
    const tapped = cloneBuilderState(state);
    tapped.mechanics.activated.payWith = 'tap';
    expect(dutiesOf(toCardDef(tapped))[0]?.cost).toEqual({ tap: true, mana: { generic: 1, pips: {} } });
  });

  it('read as an unpriced ability, not as a tap Duty, and only a creature may pay with marks', () => {
    const state = fromCardDef(creature({ activated: markDuty }));
    const rules = warningRules(state);
    expect(rules).toContain('estimate:duty-mark-cost');
    // The tap Duty's notes are about tapping, so they stay off a mark-paid ability.
    expect(rules).not.toContain('note:duty-creature-attack');
    expect(rules).not.toContain('estimate:duty-mana-discount');
    expect(rules.filter((rule) => rule.startsWith('note:unknown:'))).toEqual([]);

    const relic = cloneBuilderState(state);
    relic.cardType = 'artifact';
    expect(warningRules(relic)).toContain('illegal:duty-marks-noncreature');
    expect(warningRules(state)).not.toContain('illegal:duty-marks-noncreature');
  });
});

describe('Tithe marks', () => {
  const horror = (marks?: number): ScorableCardDef => creature({
    subtypes: ['Horror'], cost: { generic: 5, pips: { B: 1 } }, colors: ['B'], tithe: marks === undefined ? { per: 2 } : { per: 2, marks },
  });

  it('round-trip through the gate and the builder, and an unset count prints no marks', () => {
    const check = validateCard(horror(3));
    expect(check.ok && check.card.tithe).toEqual({ per: 2, marks: 3 });
    expect(fromCardDef(horror(3)).mechanics.tithe).toEqual({ enabled: true, marks: 3 });
    expect(toCardDef(fromCardDef(horror())).tithe).toEqual({ per: 2 });
    expect(warningRules(fromCardDef(horror(3)))).toContain('estimate:tithe-marks');
  });

  it('are refused at zero, past the cap, or as a fraction', () => {
    expect(reason(horror(0))).toBe('number');
    expect(reason(horror(10))).toBe('number');
    expect(reason({ ...horror(), tithe: { per: 2, marks: 1.5 } })).toBe('number');
  });
});

describe('modal spells', () => {
  it('pass the import gate and come back exactly, modes kept as printed', () => {
    const card = ritual({ modal });
    const check = validateCard(card);
    expect(check).toEqual({ ok: true, card: jsonClone(card) });
    const state = fromCardDef(card);
    expect(toCardDef(state).modal).toEqual(modal);
    expect(warningRules(state)).toContain('estimate:modal-rate');
    expect(warningRules(state).filter((rule) => rule.startsWith('illegal:'))).toEqual([]);
  });

  it('are refused in the shapes the game refuses', () => {
    // On a creature, with one mode, choosing more modes than it has, or beside X.
    expect(reason(creature({ modal }))).toBe('modes');
    expect(reason(ritual({ modal: { upTo: 1, modes: [modal.modes[1]] } }))).toBe('modes');
    expect(reason(ritual({ modal: { ...modal, upTo: 4 } }))).toBe('modes');
    expect(reason(ritual({ modal, x: { min: 0 } }))).toBe('modes');
    // A targeting mode with no target, and a mode with a field the Forge doesn't know.
    expect(reason(ritual({ modal: { upTo: 1, modes: [{ ops: [{ op: 'damage', n: 2, to: 'target' }] }, modal.modes[1]] } }))).toBe('modes');
    expect(reason(ritual({ modal: { upTo: 1, modes: [{ ...modal.modes[1], chosen: true }, modal.modes[2]] } as never }))).toBe('field');
  });

  it('warn in the builder once the card around them breaks the modal rules', () => {
    const state = fromCardDef(ritual({ modal }));
    const asCreature = cloneBuilderState(state);
    asCreature.cardType = 'creature';
    expect(warningRules(asCreature)).toContain('illegal:modal-illegal');
  });
});

describe('crownless legends', () => {
  it('keep the presentation flag through the gate and the builder, and nothing but true is accepted', () => {
    const legend = creature({ supertypes: ['legendary'], crownless: true });
    const check = validateCard(legend);
    expect(check.ok && check.card.crownless).toBe(true);
    expect(reason({ ...legend, crownless: false })).toBe('shape');
  });
});

describe('the effect palette', () => {
  // The Forge builds what it imports: every effect the gate accepts can be
  // picked in the editors, so no imported card has an effect nobody could add.
  it('offers every effect the import gate accepts, the Mandate claim among them', () => {
    const offered = new Set(OP_OPTIONS.map((option) => option.kind));
    expect(Object.keys(OP_RULES).filter((kind) => !offered.has(kind as never))).toEqual([]);
  });

  it('builds a Mandate claim the gate accepts and the builder flags as unpriced', () => {
    const card = ritual({ abilities: [{ when: 'spell', ops: [defaultOp('claimMandate')] }] });
    expect(reason(card)).toBe('ok');
    expect(warningRules(fromCardDef(card))).toContain('estimate:mandate-claim');
  });
});
