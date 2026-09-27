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

// v4 (docs/plan-1.8.5.md, "The v4 formula"): keywords priced on their host.
const creature = (extra: Partial<ScorableCardDef>): ScorableCardDef => artifact({
  types: ['creature'], colors: ['R'], cost: { generic: 2, pips: { R: 1 } }, attack: 1, defense: 3, ...extra,
});
const partFor = (card: ScorableCardDef, prefix: string) => scoreCard(card).parts.find((part) => part.label.startsWith(prefix));

describe('keywords priced on their host, v4', () => {
  it('prices Twin Blades and Skyborne higher on a creature with more Attack, and Untouchable the same', () => {
    for (const keyword of ['twinBlades', 'skyborne'] as const) {
      const small = partFor(creature({ attack: 1, keywords: [keyword] }), keyword)!.v;
      const big = partFor(creature({ attack: 5, keywords: [keyword] }), keyword)!.v;
      expect(big, keyword).toBeGreaterThan(small);
    }
    const flat = (attack: number) => partFor(creature({ attack, keywords: ['untouchable'] }), 'untouchable')!.v;
    expect(flat(5)).toBe(flat(1));
  });

  // Lane 2 measured the anthem factors with each granted keyword at its flat
  // value, so an anthem's keyword must not also scale with the Attack the
  // anthem adds. An aura's grant does scale: it lands on one known host.
  it('prices an anthem\'s granted keyword flat, whatever power the anthem adds, unlike an aura\'s', () => {
    const keywordShare = (scope: 'filter' | 'attached', p: number) => {
      const withGrant = { scope, p, t: 0, grantKeywords: ['skyborne' as const] };
      const without = { scope, p, t: 0 };
      const types: ScorableCardDef['types'] = scope === 'filter' ? ['creature'] : ['enchantment'];
      const value = (st: typeof without) => scoreCard(creature({ types, abilities: [{ when: 'static', static: st }] }))
        .parts.find((part) => /^(anthem|aura) /.test(part.label))!.v;
      return value(withGrant) - value(without);
    };
    expect(keywordShare('filter', 2)).toBeCloseTo(keywordShare('filter', 0), 6);
    expect(keywordShare('attached', 2)).toBeGreaterThan(keywordShare('attached', 0));
  });
});

describe('effects the slate found mispriced, v4', () => {
  const ritual = (abilities: ScorableCardDef['abilities']): ScorableCardDef => artifact({
    types: ['ritual'], colors: ['B'], cost: { generic: 2, pips: { B: 1 } }, abilities,
  });

  it('prices a symmetric -X/-X as the sweeper dealing X damage to each creature', () => {
    for (const x of [1, 2, 3, 4]) {
      const shrink = partFor(ritual([{ when: 'spell', ops: [{ op: 'boost', p: -x, t: -x, scope: 'all' }] }]), 'spell:')!.v;
      const burn = partFor(ritual([{ when: 'spell', ops: [{ op: 'damage', n: x, to: 'eachCreature' }] }]), 'spell:')!.v;
      expect(shrink, `-${x}/-${x}`).toBe(burn);
    }
  });

  it('prices an effect on two targets once per target', () => {
    const counters = (spec: { upTo?: 2; exactly?: 2 }) => partFor(ritual([{
      when: 'spell', targets: [{ what: 'creature', ...spec }], ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }]), 'spell:')!.v;
    expect(counters({ upTo: 2 })).toBeCloseTo(2 * counters({}), 6);
    expect(counters({ exactly: 2 })).toBeCloseTo(2 * counters({}), 6);
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
