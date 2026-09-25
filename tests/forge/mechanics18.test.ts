import { describe, expect, it } from 'vitest';
import {
  cloneBuilderState,
  createInitialBuilderState,
  evaluateBuilder,
  fromCardDef,
  toCardDef,
  type BuilderState,
} from '../../src/forge/logic';
import { dutiesOf, scoreCard, type ScorableCardDef } from '../../src/power/scoreCore';

// The builder side of the 1.8 mechanics: Duty, Whispers and Tithe load into the
// editors and convert back exactly, and the validator's exclusions surface as
// warnings. The rates themselves are tested in tests/power/scoreCore.test.ts.

const artifact = (extra: Partial<ScorableCardDef>): ScorableCardDef => ({
  id: 'synthetic-18-artifact',
  name: 'Synthetic Lantern',
  types: ['artifact'],
  subtypes: [],
  cost: { generic: 2, pips: {} },
  colors: [],
  rarity: 'r',
  set: 'dark-tales',
  ...extra,
});

/** Warnings `after` raises that `before` does not: the ones the change caused. */
function addedWarnings(before: BuilderState, after: BuilderState): string[] {
  const existing = new Set(evaluateBuilder(before).warnings);
  return evaluateBuilder(after).warnings.filter((warning) => !existing.has(warning));
}

/** True when some warning names both the mechanic and what it conflicts with. */
const names = (warnings: string[], mechanic: RegExp, other: RegExp): boolean => (
  warnings.some((warning) => mechanic.test(warning) && other.test(warning))
);

describe('Duty in the builder', () => {
  it('round-trips through the builder state with the same score', () => {
    const card = artifact({
      activated: { cost: { tap: true, mana: { generic: 1, pips: {} } }, ops: [{ op: 'damage', n: 1, to: 'target' }], targets: [{ what: 'any' }] },
    });
    const state = fromCardDef(card);
    expect(state.mechanics.activated).toEqual({
      enabled: true,
      cost: { generic: 1, pips: { W: 0, U: 0, B: 0, R: 0, G: 0 } },
      target: 'any',
      ops: [{ op: 'damage', n: 1, to: 'target' }],
    });
    const back = toCardDef(state);
    expect(back.activated).toEqual(card.activated);
    expect(scoreCard(back).power).toBe(scoreCard(card).power);
    const free = toCardDef(fromCardDef(artifact({ activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] } })));
    expect(dutiesOf(free)[0]?.cost).toEqual({ tap: true });
  });

  it('warns on the validator exclusions', () => {
    const duty = createInitialBuilderState();
    duty.mechanics.activated.enabled = true;
    const withManaAbility = cloneBuilderState(duty);
    withManaAbility.mechanics.manaAbility.enabled = true;
    const withHauntlink = cloneBuilderState(duty);
    withHauntlink.mechanics.hauntlink.enabled = true;
    expect(names(addedWarnings(duty, withManaAbility), /Duty/, /mana ability/i)).toBe(true);
    expect(names(addedWarnings(duty, withHauntlink), /Duty/, /Hauntlink/)).toBe(true);
  });
});

describe('Whispers in the builder', () => {
  const charm = (whispersMv: number): ScorableCardDef => artifact({
    types: ['charm'], colors: ['R'], cost: { generic: 2, pips: { R: 1 } },
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
    whispers: { cost: { generic: Math.max(0, whispersMv - 1), pips: { R: 1 } } },
  });

  it('round-trips and flags the cost guard and the Retell exclusion', () => {
    const card = charm(1);
    const state = fromCardDef(card);
    expect(state.mechanics.whispers).toEqual({ enabled: true, cost: { generic: 0, pips: { W: 0, U: 0, B: 0, R: 1, G: 0 } } });
    expect(toCardDef(state).whispers).toEqual(card.whispers);
    // A 1-mana Whispers on a 3-damage Charm sits well below the effect's fair cost.
    expect(names(evaluateBuilder(state).warnings, /Whispers/, /fair/i)).toBe(true);
    const withRetell = cloneBuilderState(state);
    withRetell.mechanics.retell.enabled = true;
    expect(names(addedWarnings(state, withRetell), /Whispers/, /Retell/)).toBe(true);
  });
});

describe('Tithe in the builder', () => {
  it('round-trips and warns on the exclusions and the non-creature carrier', () => {
    const horror = artifact({
      types: ['creature'], subtypes: ['Horror'], attack: 5, defense: 5, colors: ['B'], cost: { generic: 5, pips: { B: 1 } },
      tithe: { per: 2 },
    });
    const state = fromCardDef(horror);
    expect(state.mechanics.tithe.enabled).toBe(true);
    expect(toCardDef(state).tithe).toEqual({ per: 2 });
    const withRite = cloneBuilderState(state);
    withRite.mechanics.rite.enabled = true;
    expect(names(addedWarnings(state, withRite), /Tithe/, /Rite/)).toBe(true);
    // The creature carrier is the control: only the relic is told Tithe is for creatures.
    const relic = fromCardDef(artifact({ tithe: { per: 2 } }));
    expect(names(evaluateBuilder(state).warnings, /Tithe/, /creature/i)).toBe(false);
    expect(names(evaluateBuilder(relic).warnings, /Tithe/, /creature/i)).toBe(true);
  });
});
