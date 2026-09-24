import { describe, expect, it } from 'vitest';
import { cardEffectOps, cardRoles, rateCard, scoreCard } from '../../scripts/personas/score';
import { personaTemplate } from '../../scripts/personas/templates';
import { validateActivatedDef, type AbilityDef, type ActivatedDef, type CardDef, type EffectOp } from '../../src/engine/types';

function card(id: string, when: AbilityDef['when'], condition: AbilityDef['condition'], op: EffectOp): CardDef {
  return {
    id,
    name: id,
    types: ['artifact'],
    subtypes: [],
    cost: { generic: 1, pips: {} },
    colors: [],
    abilities: [{ when, condition, ops: [op] }],
    rarity: 'c',
  };
}

describe('persona score Starborne costing riders', () => {
  it('keeps one-shot Propagate at 0.70 and applies §4i dawn expectations to repeatable Propagate', () => {
    const oneShot = card('one-shot', 'arrives', undefined, { op: 'propagate' });
    const repeatable = card('repeatable', 'dawn', undefined, { op: 'propagate' });

    expect(rateCard(oneShot)).toBeCloseTo(0.35 + 0.7);
    expect(rateCard(repeatable)).toBeCloseTo(0.35 + 1.65 * 3);
  });

  it('applies the provisional threshold and conditional-dawn discounts', () => {
    const threshold = card(
      'threshold',
      'arrives',
      { kind: 'markedThreshold', n: 5, subject: 'permanents' },
      { op: 'draw', n: 1 },
    );
    const conditionalDawn = card('conditional-dawn', 'dawn', 'controlMarked', { op: 'draw', n: 1 });

    expect(rateCard(threshold)).toBeCloseTo(0.35 + 1.35 * 0.5);
    expect(rateCard(conditionalDawn)).toBeCloseTo(0.35 + 1.35 * 3 * 0.75);
  });

  it('prices the marked-opponent boost through its conservative provisional scope entry', () => {
    const markedDebuff = card('marked-debuff', 'spell', undefined, {
      op: 'boost',
      p: -2,
      t: -2,
      scope: 'theirMarked',
    });

    expect(rateCard(markedDebuff)).toBeCloseTo(0.35 + 0.9 * 0.65);
  });
});

describe('persona score Duty costing', () => {
  const fixture = (id: string, fields: Partial<CardDef> = {}): CardDef => {
    const result: CardDef = {
      id,
      name: id,
      types: ['artifact'],
      subtypes: [],
      cost: { generic: 2, pips: {} },
      colors: [],
      rarity: 'c',
      ...fields,
    };
    expect(validateActivatedDef(result), id).toEqual([]);
    return result;
  };
  const body: Partial<CardDef> = { types: ['creature'], attack: 1, defense: 1 };
  const drawDuty: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] };

  it('adds 2.025 for artifact Duty draw: 3 * 1.35 / 2', () => {
    const plain = fixture('plain-artifact');
    const duty = fixture('draw-artifact', { activated: drawDuty });

    expect(rateCard(duty)).toBeGreaterThan(rateCard(plain));
    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(2.025);
  });

  it('adds 1.35 for creature Duty draw: 2 * 1.35 / 2', () => {
    const plain = fixture('plain-creature', body);
    const duty = fixture('draw-creature', { ...body, activated: drawDuty });
    const artifact = fixture('draw-artifact', { activated: drawDuty });
    const plainArtifact = fixture('plain-artifact');
    const added = rateCard(duty) - rateCard(plain);

    expect(rateCard(duty)).toBeGreaterThan(rateCard(plain));
    expect(added).toBeCloseTo(1.35);
    expect(added).toBeLessThan(rateCard(artifact) - rateCard(plainArtifact));
  });

  it.each([
    { mana: 2, added: 1.625 },
    { mana: 4, added: 1.275 },
  ])('discounts artifact Duty draw with $mana activation mana to $added', ({ mana, added }) => {
    const plain = fixture('plain-artifact');
    const free = fixture('free-draw-artifact', { activated: drawDuty });
    const paid = fixture('paid-draw-artifact', {
      activated: { ...drawDuty, cost: { tap: true, mana: { generic: mana, pips: {} } } },
    });

    // (3 * OP_VALUE.draw - min(1.5, 0.4 * mana)) / 2:
    // mana 2 => (4.05 - 0.8) / 2 = 1.625; mana 4 => (4.05 - 1.5) / 2 = 1.275.
    expect(rateCard(paid) - rateCard(plain)).toBeCloseTo(added);
    expect(rateCard(paid)).toBeLessThan(rateCard(free));
  });

  it('floors a tiny Duty add at zero: max(0, 3 * 0.4 - 1.5) / 2', () => {
    const plain = fixture('plain-artifact');
    const duty = fixture('tiny-duty-artifact', {
      activated: {
        cost: { tap: true, mana: { generic: 4, pips: {} } },
        ops: [{ op: 'severTop', n: 1, who: 'self' }],
      },
    });

    expect(rateCard(duty) - rateCard(plain)).toBe(0);
    expect(rateCard(duty)).toBe(rateCard(plain));
  });

  it('uses the creature band at exactly 2.0 per trigger: (0.6 + 1.4 + 1) / 2 = 1.5', () => {
    const plain = fixture('plain-creature', body);
    const duty = fixture('conditional-pinger', {
      ...body,
      activated: {
        cost: { tap: true },
        targets: [{ what: 'creature' }],
        ops: [{ op: 'ifTargetMarked', then: [{ op: 'damage', n: 1, to: 'target' }] }],
      },
    });

    // OP_VALUE.ifTargetMarked + OP_VALUE.damage = 0.6 + 1.4 = 2.0.
    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(1.5);
    expect(rateCard(duty) - rateCard(plain)).not.toBeCloseTo(2 * 2 / 2);
  });

  it('uses the creature band above 2.0 per trigger: (1.35 + 1.4 + 1) / 2 = 1.875', () => {
    const plain = fixture('plain-creature', body);
    const duty = fixture('drawing-pinger', {
      ...body,
      activated: {
        cost: { tap: true },
        targets: [{ what: 'creature' }],
        ops: [{ op: 'draw', n: 1 }, { op: 'damage', n: 1, to: 'target' }],
      },
    });

    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(1.875);
    expect(rateCard(duty) - rateCard(plain)).not.toBeCloseTo(2 * 2.75 / 2);
  });

  it('classifies a creature with damage Duty as removal', () => {
    const duty = fixture('duty-pinger', {
      ...body,
      activated: {
        cost: { tap: true },
        targets: [{ what: 'creature' }],
        ops: [{ op: 'damage', n: 1, to: 'target' }],
      },
    });

    expect(cardRoles(duty)).toContain('removal');
  });

  it('adds the 0.1 extra-target bonus for moveMark Duty: 2 * 0.8 / 2 + 0.1 = 0.9', () => {
    const plain = fixture('plain-creature', body);
    const duty = fixture('duty-mark-mover', {
      ...body,
      activated: {
        cost: { tap: true },
        targets: [{ what: 'creature', marked: true }, { what: 'yourCreature' }],
        ops: [{ op: 'moveMark' }],
      },
    });

    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(0.9);
    expect(rateCard(duty) - rateCard(plain) - 2 * 0.8 / 2).toBeCloseTo(0.1);
  });

  it('discounts flattened Duty branches once and keeps existing dawn entries separate', () => {
    const abilities: AbilityDef[] = [{
      when: 'dawn',
      condition: 'controlMarked',
      ops: [{ op: 'draw', n: 1 }],
    }];
    const plain = fixture('conditional-dawn-artifact', { abilities });
    const duty = fixture('conditional-duty-artifact', {
      abilities,
      activated: {
        cost: { tap: true, mana: { generic: 4, pips: {} } },
        targets: [{ what: 'creature' }],
        ops: [{
          op: 'ifTargetMarked',
          then: [{ op: 'draw', n: 1 }],
          else: [{ op: 'damage', n: 1, to: 'target' }],
        }],
      },
    });

    // (3 * (0.6 + 1.35 + 1.4) - 1.5) / 2 = 4.275, one discount for all entries.
    expect(rateCard(plain)).toBeCloseTo(0.35 + 1.35 * 3 * 0.75 / 2);
    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(4.275);
    expect(cardEffectOps(duty).map((op) => op.op)).toEqual(['draw', 'ifTargetMarked', 'draw', 'damage']);
  });

  it('retains boost scope weighting for Duty: 3 * 0.9 * 0.65 / 2 = 0.8775', () => {
    const plain = fixture('plain-artifact');
    const duty = fixture('duty-debuff', {
      activated: {
        cost: { tap: true },
        ops: [{ op: 'boost', p: -2, t: -2, scope: 'theirMarked' }],
      },
    });

    expect(rateCard(duty) - rateCard(plain)).toBeCloseTo(0.8775);
  });

  it('includes Duty ops in persona synergy', () => {
    const plain = fixture('plain-artifact');
    const duty = fixture('draw-artifact', { activated: drawDuty });
    const template = { ...personaTemplate('draw-go'), synergy: { subtypes: [], keywords: [], effectOps: ['draw' as const] } };
    const state = {
      cards: [],
      roleCounts: { threats: 0, removal: 0, interaction: 0, draw: 0, finishers: 0, lands: 24 },
      curveCounts: { early: 0, mid: 0, late: 0 },
      selectedColors: [],
    };

    expect(scoreCard(duty, template, state).synergy - scoreCard(plain, template, state).synergy).toBeCloseTo(0.8);
  });
});
