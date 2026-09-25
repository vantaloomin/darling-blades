import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import type { Keyword } from '../../src/engine/types';
import { buildHints, candidateHints, type HintKind } from '../../src/forge/hints';
import {
  bandForDelta,
  cloneBuilderState,
  createInitialAbility,
  createInitialBuilderState,
  evaluateBuilder,
  fromCardDef,
  ledgerLabelForPart,
  rarityBudgetLabel,
  toCardDef,
} from '../../src/forge/logic';
import {
  MANA_STEP,
  OFF,
  PIP_PREMIUM,
  RARITY_BONUS,
  SEC,
  scoreCard,
  type ScorableCardDef,
} from '../../src/power/scoreCore';

/** The pool the balance CLI scores: collectible cards with a mana budget. */
const SCORED_POOL = ALL_CARDS.filter(
  (card) => !card.token && !(card.supertypes ?? []).includes('basic') && !card.types.includes('land'),
);

describe('builder state conversion', () => {
  // The Load Card contract: a catalog card loaded into the editors scores
  // exactly as the card itself does, so the Forge's verdict on a loaded card is
  // the scorer's verdict on the shipped card, for every card in the pool.
  it('scores every collectible card identically after a load into builder state', () => {
    const failures: string[] = [];
    for (const card of SCORED_POOL) {
      const direct = scoreCard(card);
      const roundTripped = scoreCard(toCardDef(fromCardDef(card)));
      const differences = (['power', 'budget', 'delta'] as const)
        .filter((field) => roundTripped[field] !== direct[field])
        .map((field) => `${field} ${direct[field]} -> ${roundTripped[field]}`);
      if (differences.length > 0) failures.push(`${card.id}: ${differences.join(', ')}`);
    }
    expect(failures, `${SCORED_POOL.length} collectible cards checked`).toEqual([]);
  });

  it('converts generic and pips into ManaCost, mana value, and colors', () => {
    const state = createInitialBuilderState();
    state.cost = { generic: 2, pips: { W: 1, U: 0, B: 0, R: 2, G: 0 } };
    const card = toCardDef(state);
    expect(card.cost).toEqual({ generic: 2, pips: { W: 1, R: 2 } });
    expect(card.colors).toEqual(['W', 'R']);
    expect(scoreCard(card).mv).toBe(5);
  });

  it('round-trips a color identity that differs from a colorless mana cost', () => {
    const card = {
      id: 'synthetic-colored-generic-cost',
      name: 'Synthetic Jade Dragon Egg',
      types: ['ritual'],
      subtypes: ['Relic'],
      cost: { generic: 1, pips: {} },
      colors: ['G'],
      abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 1 }] }],
      skim: { cost: { generic: 1, pips: {} } },
      rarity: 'c',
      set: 'dark-tales',
    } satisfies ScorableCardDef;

    const direct = scoreCard(card);
    const roundTrippedCard = toCardDef(fromCardDef(card));
    const roundTripped = scoreCard(roundTrippedCard);

    expect(roundTrippedCard.colors).toEqual(['G']);
    expect(direct.parts.find((part) => part.label === 'off-pie: scry'))
      .toEqual({ label: 'off-pie: scry', v: 0.34 });
    expect(roundTripped.parts.find((part) => part.label === 'off-pie: scry'))
      .toEqual({ label: 'off-pie: scry', v: 0.34 });
    expect({ power: roundTripped.power, budget: roundTripped.budget, delta: roundTripped.delta })
      .toEqual({ power: direct.power, budget: direct.budget, delta: direct.delta });
  });

  it('round-trips a marked threshold subject without changing the score', () => {
    const card = {
      id: 'synthetic-marked-threshold-subject',
      name: 'Synthetic Umbral Antenna',
      types: ['artifact'],
      subtypes: ['Relic'],
      cost: { generic: 2, pips: {} },
      colors: [],
      abilities: [{
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' },
        ops: [{ op: 'severSelf' }, { op: 'raise', to: 'top' }],
      }],
      rarity: 'c',
      set: 'starborne',
    } satisfies ScorableCardDef;

    const direct = scoreCard(card);
    const roundTrippedCard = toCardDef(fromCardDef(card));
    const roundTripped = scoreCard(roundTrippedCard);

    expect(roundTrippedCard.abilities?.[0]?.condition)
      .toEqual({ kind: 'markedThreshold', n: 4, subject: 'creatures' });
    expect({ power: roundTripped.power, budget: roundTripped.budget, delta: roundTripped.delta })
      .toEqual({ power: direct.power, budget: direct.budget, delta: direct.delta });
  });

  it('omits creature-only fields from a spell', () => {
    const state = createInitialBuilderState();
    state.cardType = 'ritual';
    state.attack = 9;
    state.defense = 11;
    const card = toCardDef(state);
    expect(card.attack).toBeUndefined();
    expect(card.defense).toBeUndefined();
  });

  it('treats a retained secondary creature type as a creature in warnings and hints', () => {
    const state = createInitialBuilderState();
    state.cardType = 'artifact';
    state.additionalTypes = ['creature'];
    state.cost = { generic: 6, pips: { W: 0, U: 0, B: 0, R: 0, G: 0 } };
    state.attack = 0;
    state.defense = 0;
    state.keywords = ['skyborne'];
    // Control: the same card without the retained type is a noncreature, so its
    // printed keyword earns a warning and its body earns no stat hints.
    const artifactOnly = cloneBuilderState(state);
    artifactOnly.additionalTypes = [];
    const keywordWarnings = (warnings: string[]) => warnings.filter((warning) => /keyword/i.test(warning));

    const evaluation = evaluateBuilder(state);
    expect(evaluation.card.types).toEqual(['artifact', 'creature']);
    expect(keywordWarnings(evaluateBuilder(artifactOnly).warnings)).not.toEqual([]);
    expect(keywordWarnings(evaluation.warnings)).toEqual([]);
    expect(candidateHints(artifactOnly).some((hint) => hint.kind === 'increase-attack')).toBe(false);
    expect(candidateHints(state).some((hint) => hint.kind === 'increase-attack')).toBe(true);
  });

  it('exposes Starborne mark vocabulary and condition gates', () => {
    const state = createInitialBuilderState();
    state.set = 'starborne';
    const ability = createInitialAbility();
    ability.when = 'yourCreatureMarked';
    ability.condition = 'markedThreshold';
    ability.conditionN = 4;
    ability.ops = [
      { op: 'markAll' },
      { op: 'boost', p: 1, t: 1, scope: 'yourMarked' },
      {
        op: 'ifTargetMarked',
        then: [{ op: 'removeMarks' }],
        else: [{ op: 'moveMark' }],
      },
    ];
    state.abilities = [ability];
    const card = toCardDef(state);
    expect(card.set).toBe('starborne');
    expect(card.abilities?.[0]).toMatchObject({
      when: 'yourCreatureMarked',
      condition: { kind: 'markedThreshold', n: 4 },
    });
    expect(scoreCard(card).unknowns).toEqual([]);
  });
});

describe('v3 budget', () => {
  it('uses the four-term decomposition and renders every term', () => {
    const state = createInitialBuilderState();
    state.cost = { generic: 2, pips: { W: 1, U: 0, B: 0, R: 2, G: 0 } };
    state.rarity = 'r';
    // {2}{W}{R}{R} rare: 1.10 floor + 0.82 x 4 + 0.40 x 2 + 0.35 = 5.53.
    expect(evaluateBuilder(state).score.budget).toBe(5.53);
    const shown = rarityBudgetLabel(state).match(/\d+(?:\.\d+)?/g) ?? [];
    expect(shown).toEqual(expect.arrayContaining(['1.10', '0.82', '4', '0.40', '2', '0.35']));
  });

  it('keeps the rarity lever additive and independent of MV', () => {
    for (const generic of [0, 6]) {
      const common = createInitialBuilderState();
      common.cost.generic = generic;
      const mythic = cloneBuilderState(common);
      mythic.rarity = 'ur';
      expect(evaluateBuilder(mythic).score.budget - evaluateBuilder(common).score.budget)
        .toBe(RARITY_BONUS.ur - RARITY_BONUS.c);
    }
  });
});

describe('color-pie premium', () => {
  function damageState(color: 'B' | 'G') {
    const state = createInitialBuilderState();
    state.cardType = 'ritual';
    state.cost = { generic: 0, pips: { W: 0, U: 0, B: 0, R: 0, G: 0 } };
    state.cost.pips[color] = 1;
    const ability = createInitialAbility();
    ability.when = 'spell';
    ability.target = 'creature';
    ability.ops = [{ op: 'damage', n: 2, to: 'target' }];
    state.abilities = [ability];
    return state;
  }

  it('surfaces off-pie class, tier, identity, and primary color', () => {
    const evaluation = evaluateBuilder(damageState('G'));
    const part = evaluation.score.parts.find((candidate) => candidate.label === 'off-pie: burn');
    expect(part?.v).toBe(OFF);
    const label = ledgerLabelForPart(evaluation.card, part!);
    expect(label).toMatch(/burn/);
    expect(label).toMatch(/off-pie/);
    expect(label).not.toMatch(/secondary/);
    expect(label).toMatch(/green/);
    expect(label).toContain('0.85');
    expect(label).toMatch(/red/);
  });

  it('distinguishes the secondary tier', () => {
    const evaluation = evaluateBuilder(damageState('B'));
    const part = evaluation.score.parts.find((candidate) => candidate.label === 'off-pie: burn');
    expect(part?.v).toBe(SEC);
    const label = ledgerLabelForPart(evaluation.card, part!);
    expect(label).toMatch(/secondary/);
    expect(label).not.toMatch(/off-pie/);
    expect(label).toMatch(/black/);
    expect(label).toContain('0.40');
    expect(label).toMatch(/red/);
  });
});

describe('verdict boundaries', () => {
  it.each([
    [-0.75, 'accurate'],
    [-0.7499, 'accurate'],
    [0.75, 'accurate'],
    [0.7501, 'over'],
    [1.5, 'over'],
    [-0.7501, 'under'],
    [-1.5, 'under'],
  ] as const)('classifies Delta %s as %s', (delta, expected) => {
    expect(bandForDelta(delta)).toBe(expected);
  });
});

function underValueState() {
  const state = createInitialBuilderState();
  state.cost.generic = 6;
  state.cost.pips.G = 0;
  state.attack = 0;
  state.defense = 0;
  return state;
}

function overValueState() {
  const state = createInitialBuilderState();
  state.cost.generic = 0;
  state.cost.pips.G = 1;
  state.attack = 8;
  state.defense = 8;
  state.keywords = ['skyborne'];
  state.abilities = [{
    when: 'arrives',
    condition: 'none',
    conditionN: 3,
    conditionSubject: null,
    target: 'none',
    ops: [{ op: 'draw', n: 2 }],
    static: { scope: 'self', p: 0, t: 0, grantKeywords: [] },
  }];
  return state;
}

describe('costing hints', () => {
  it('predicts the exact re-scored Delta for every available lever', () => {
    const states = [underValueState(), overValueState()];
    const seen = new Set<HintKind>();
    for (const state of states) {
      const currentDelta = evaluateBuilder(state).score.delta;
      for (const hint of candidateHints(state)) {
        const actualDelta = evaluateBuilder(hint.nextState).score.delta;
        expect(hint.resultingDelta, hint.id).toBe(actualDelta);
        expect(hint.movement, hint.id).toBeCloseTo(actualDelta - currentDelta, 2);
        expect(Math.abs(actualDelta), hint.id).toBeLessThan(Math.abs(currentDelta));
        seen.add(hint.kind);
      }
    }
    expect([...seen].sort()).toEqual(([
      'add-keyword',
      'add-pip',
      'change-rarity',
      'decrease-attack',
      'decrease-defense',
      'drop-op',
      'increase-attack',
      'increase-cost',
      'increase-defense',
      'reduce-cost',
      'remove-keyword',
    ] satisfies HintKind[]).sort());
  });

  it('uses the exact live keyword rate when applying keyword advice', () => {
    const state = underValueState();
    const hint = candidateHints(state).find((candidate) => candidate.kind === 'add-keyword');
    expect(hint).toBeDefined();
    const added = hint!.nextState.keywords.find((keyword: Keyword) => !state.keywords.includes(keyword));
    expect(added).toBeDefined();
    expect(hint!.resultingDelta).toBe(evaluateBuilder(hint!.nextState).score.delta);
  });

  it('produces no hints for Accurate Value', () => {
    const state = createInitialBuilderState();
    expect(evaluateBuilder(state).band).toBe('accurate');
    expect(buildHints(state)).toEqual([]);
  });

  it('explains the v3 mana, pip, and additive rarity levers with the live rates', () => {
    const state = overValueState();
    const hints = candidateHints(state);
    const mana = hints.find((hint) => hint.kind === 'increase-cost');
    const pip = hints.find((hint) => hint.kind === 'add-pip');
    const rarity = hints.find((hint) => hint.kind === 'change-rarity');
    expect(mana?.rateSource).toContain(MANA_STEP.toFixed(2));
    expect(pip?.rateSource).toContain(PIP_PREMIUM.toFixed(2));
    expect(rarity).toBeDefined();
    const bonusChange = RARITY_BONUS[rarity!.nextState.rarity] - RARITY_BONUS[state.rarity];
    expect(rarity!.rateSource).toContain(bonusChange.toFixed(2));
    expect(pip?.resultingDelta).toBe(evaluateBuilder(pip!.nextState).score.delta);
  });

  it('returns independent one-click states', () => {
    const state = overValueState();
    const hint = buildHints(state, 1)[0];
    const before = cloneBuilderState(state);
    expect(hint).toBeDefined();
    hint.nextState.name = 'Applied Candidate';
    expect(state).toEqual(before);
  });
});
