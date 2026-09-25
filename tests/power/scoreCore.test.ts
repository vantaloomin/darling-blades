import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { scoreCard, type ScorableCardDef } from '../../src/power/scoreCore';

/** The pool the balance CLI scores: collectible cards with a mana budget
 *  (tokens, basics and lands have none). */
const SCORED_POOL = ALL_CARDS.filter(
  (card) => !card.token && !(card.supertypes ?? []).includes('basic') && !card.types.includes('land'),
);

describe('the scorer prices every mechanic the catalog prints', () => {
  // Owner rule (2026-08-28): every mechanic is costed. The local CLI refuses to
  // write scores while any vocabulary is unknown; this is the same rule in CI.
  // It is what catches a new op, keyword, trigger or scope reaching the catalog
  // before the scorer (and so the Forge's verdict) has a rate for it.
  it('scores every collectible card with zero unknown vocabulary', () => {
    const unknown = SCORED_POOL.flatMap((card) => scoreCard(card).unknowns.map((item) => `${card.id}: ${item}`));
    expect(unknown).toEqual([]);
  });
});

// The 1.8 mechanics: Duty (power-formula section 4q), Whispers (4r), Tithe (4s).
// Each literal is the rate the section specifies for the scenario; the draw op
// is 1.65 MEP.

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

const dutyPart = (card: ScorableCardDef) => scoreCard(card).parts.find((part) => part.label.startsWith('duty'));

describe('Duty (activated) scoring, section 4q', () => {
  it('prices a free tap draw on a non-creature at 3.0 x 1.65', () => {
    const card = artifact({ activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] } });
    expect(dutyPart(card)).toEqual({ label: 'duty (non-creature carrier)', v: 4.95 });
  });

  it('discounts activation mana at 0.4 per mana, capped at 1.5', () => {
    const two = artifact({ activated: { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] } });
    const four = artifact({ activated: { cost: { tap: true, mana: { generic: 4, pips: {} } }, ops: [{ op: 'draw', n: 1 }] } });
    expect(dutyPart(two)?.v).toBeCloseTo(4.95 - 0.8);
    expect(dutyPart(four)?.v).toBeCloseTo(4.95 - 1.5);
    expect(dutyPart(four)?.label).toBe('duty (non-creature carrier, {4} to activate)');
  });

  it('uses the 2.0 creature multiplier and the perTrigger + 1.0 band at 2.0 or more', () => {
    const creature = artifact({
      types: ['creature'], attack: 1, defense: 1, colors: ['U'], cost: { generic: 1, pips: { U: 1 } },
      activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
    });
    expect(dutyPart(creature)).toEqual({ label: 'duty (creature carrier)', v: 3.3 });
    const assassin = artifact({
      types: ['creature'], attack: 1, defense: 1, colors: ['B'], cost: { generic: 1, pips: { B: 1 } },
      activated: { cost: { tap: true }, ops: [{ op: 'destroy', to: 'target' }], targets: [{ what: 'creature', tapped: true }] },
    });
    const part = dutyPart(assassin);
    expect(part?.label).toContain('NEEDS MATH band');
    expect(part?.v).toBeCloseTo(2.7 + 1.0);
  });

  it('reads the repeatable tap op at 1.0, not the one-shot 0.4', () => {
    const tapper = artifact({ activated: { cost: { tap: true }, ops: [{ op: 'tap', to: 'target' }], targets: [{ what: 'creature' }] } });
    expect(dutyPart(tapper)?.v).toBeCloseTo(3.0);
  });
});

describe('Whispers scoring, section 4r', () => {
  const charm = (whispersMv: number): ScorableCardDef => artifact({
    types: ['charm'], colors: ['R'], cost: { generic: 2, pips: { R: 1 } },
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
    whispers: { cost: { generic: Math.max(0, whispersMv - 1), pips: { R: 1 } } },
  });

  it('prices a Charm at 0.5 per mana of discount', () => {
    const part = scoreCard(charm(1)).parts.find((p) => p.label.startsWith('whispers'));
    expect(part).toEqual({ label: 'whispers option (charm, 2 off)', v: 1 });
    expect(scoreCard(charm(3)).parts.find((p) => p.label.startsWith('whispers'))?.v).toBe(0);
  });

  it('prices a body at 0 at printed', () => {
    const body = artifact({
      types: ['creature'], attack: 4, defense: 4, colors: ['G'], cost: { generic: 4, pips: { G: 1 } },
      whispers: { cost: { generic: 2, pips: { G: 1 } } },
    });
    const part = scoreCard(body).parts.find((p) => p.label.startsWith('whispers'));
    expect(part?.v).toBe(0);
    expect(scoreCard(body).mechanics).toContain('whispers');
  });
});

describe('Tithe scoring, section 4s', () => {
  it('is a flat +0.5 option', () => {
    const horror = artifact({
      types: ['creature'], subtypes: ['Horror'], attack: 5, defense: 5, colors: ['B'], cost: { generic: 5, pips: { B: 1 } },
      tithe: { per: 2 },
    });
    expect(scoreCard(horror).parts.find((p) => p.label.startsWith('tithe'))).toEqual({ label: 'tithe option (any-number sacrifice, 1 per 2 Defense)', v: 0.5 });
    const plain = { ...horror, tithe: undefined };
    expect(scoreCard(horror).power - scoreCard(plain).power).toBeCloseTo(0.5);
  });
});
