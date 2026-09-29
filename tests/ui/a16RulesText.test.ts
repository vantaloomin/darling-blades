import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import type { AbilityDef, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';

/**
 * The A1.6 words. The owner ruled the three First Dawn reworks' text
 * (2026-09-29), so their sentences are the point here; the Ash-Rite fix is a
 * rule ("then you create" after another player's clause), asserted on
 * fixture cards.
 */
const charm = (id: string, ability: AbilityDef): CardDef => ({
  id, name: id, types: ['charm'], subtypes: [], colors: ['W'], rarity: 'c',
  cost: { generic: 1, pips: { W: 1 } }, abilities: [ability],
});
const ATTACKING: TargetSpec = { what: 'creature', attacking: true };
/** A catalog token, so the fixture renders a real token line. */
const TOKEN = ALL_CARDS.find((card) => card.token && card.types.includes('creature'))!;
const make: EffectOp = { op: 'createToken', token: TOKEN.id, count: 1 };

describe('an attacking-only target', () => {
  it("prints The Elders' Verdict and Bring Down the Beast as ruled", () => {
    expect(rulesText(charm('verdict', { when: 'spell', targets: [ATTACKING], ops: [{ op: 'sever', to: 'target' }, { op: 'gainLife', n: 2 }] })))
      .toBe('Sever target attacking creature, then you gain 2 life.');
    // The Attack restriction keeps the catalog's existing wording ("with attack N or more").
    expect(rulesText(charm('beast', { when: 'spell', targets: [{ ...ATTACKING, minAttack: 4 }], ops: [{ op: 'destroy', to: 'target' }] })))
      .toMatch(/^Destroy target attacking creature with attack 4 or more\.$/i);
  });

  it('composes with the other target words', () => {
    const text = (spec: TargetSpec): string => rulesText(charm('x', { when: 'spell', targets: [spec], ops: [{ op: 'destroy', to: 'target' }] }));
    expect(text({ what: 'opponentCreature', attacking: true })).toContain('target attacking creature an opponent controls');
    expect(text({ what: 'creature', attacking: true, marked: true })).toContain('target Marked attacking creature');
    expect(text({ what: 'creature', attacking: true, maxCost: 3 })).toContain('target attacking creature with cost 3 or less');
  });
});

describe('If it survived', () => {
  const HUNT_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'opponentCreature' }];
  const gate: EffectOp = { op: 'ifTargetSurvives', then: [{ op: 'draw', n: 1 }] };

  it('prints Ambush at the River as ruled: the gate opens its own sentence', () => {
    const ambush: CardDef = { ...charm('ambush', {
      when: 'spell', targets: HUNT_TARGETS,
      ops: [{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'hunt', hunter: 'target' }, gate],
    }), types: ['ritual'] };
    expect(rulesText(ambush)).toBe('Target creature you control gets +1/+1 until Sunset, then it Hunts. If it survived, draw a card.');
  });

  it('names its target when nothing named it first, and prints an else branch after "otherwise"', () => {
    const first = rulesText(charm('first', { when: 'spell', targets: [{ what: 'yourCreature' }], ops: [gate] }));
    expect(first.startsWith('If target creature you control survived, draw a card')).toBe(true);
    const both = rulesText(charm('both', { when: 'spell', targets: HUNT_TARGETS,
      ops: [{ op: 'hunt', hunter: 'target' }, { ...gate, else: [{ op: 'gainLife', n: 2 }] }] }));
    expect(both).toMatch(/Hunts\. If it survived, draw a card; otherwise, you gain 2 life\.$/);
  });
});

describe('who creates a token (the Ash-Rite rule)', () => {
  const ritual = (ops: EffectOp[]): string => rulesText({ ...charm('r', { when: 'spell', ops }), types: ['ritual'] });

  it('says "you create" after a clause whose subject is another player', () => {
    expect(ritual([{ op: 'sacrifice', who: 'each', n: 1 }, make])).toMatch(/^Each player sacrifices a creature, then you create one /);
    expect(ritual([{ op: 'sacrifice', who: 'opponent', n: 1 }, make])).toMatch(/sacrifices a creature, then you create one /);
    expect(ritual([{ op: 'loseLife', n: 2, who: 'opponent' }, make])).toMatch(/loses 2 life, then you create one /);    expect(ritual([{ op: 'loseLifePerTheirMarked', who: 'opponent' }, make])).toMatch(/they control, then you create one /);
  });

  it('applies inside a conditional branch too', () => {
    const branch: EffectOp = { op: 'ifTargetSurvives', then: [{ op: 'sacrifice', who: 'each', n: 1 }, make] };
    expect(rulesText(charm('b', { when: 'spell', targets: [{ what: 'yourCreature' }], ops: [branch] })))
      .toMatch(/each player sacrifices a creature, then you create one /);
  });

  it('keeps the plain imperative after your own clause, and at the start', () => {
    expect(ritual([{ op: 'gainLife', n: 1 }, make])).toMatch(/^You gain 1 life, then create one /);
    expect(ritual([make, { op: 'sacrifice', who: 'each', n: 1 }])).toMatch(/^Create one /);
  });
});
