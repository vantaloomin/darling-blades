import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { makePicker, scorePick, type PickerProfile } from '../../src/meta/draftPicker';

// The draft picker's Hunt and Provoked weights (plan-first-dawn-engine.md,
// Part 4, A2; A2.b), on fixture cards: a Provoked payoff by the sources in the
// pool drafted so far, a source by the payoffs, and a Hunt as removal by the
// drafter's creatures. Colourless fixtures, so colour commitment never moves a
// score; each rule compares a card with a twin that lacks the role.

const cost = { generic: 2, pips: {} };
const PREY: TargetSpec = { what: 'opponentCreature' };
const ANY_PREY: TargetSpec = { what: 'creature', other: true };
const creature = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c', cost, attack: 2, defense: 2, ...extra,
});
const ritual = (id: string, ops: EffectOp[], targets?: TargetSpec[]): CardDef => ({
  id, name: id, types: ['ritual'], subtypes: [], colors: [], rarity: 'c', cost,
  abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }],
});

const DB: CardDb = Object.fromEntries([
  creature('bear'),
  ritual('blank', [{ op: 'gainLife', n: 1 }]),
  /** "Provoked: draw a card." */
  creature('payoff', { abilities: [{ when: 'provoked', ops: [{ op: 'draw', n: 1 }] }] }),
  /** Its twin with the same text on another trigger. */
  creature('payoffTwin', { abilities: [{ when: 'attacks', ops: [{ op: 'draw', n: 1 }] }] }),
  /** "Deal 1 damage to target creature you control. Draw a card." (a source) */
  ritual('source', [{ op: 'damage', n: 1, to: 'target' }, { op: 'draw', n: 1 }], [{ what: 'yourCreature' }]),
  /** "Deal 1 damage to each creature you control. Draw a card." (a source) */
  ritual('sweepSource', [{ op: 'damage', n: 1, to: 'eachYourCreature' }, { op: 'draw', n: 1 }]),
  /** "Target creature you control Hunts." */
  ritual('huntSpell', [{ op: 'hunt', hunter: 'target' }], [{ what: 'yourCreature' }, PREY]),
  /** "Destroy target creature." */
  ritual('destroySpell', [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  /** "When this arrives, Hunt." */
  creature('arrivalHunter', { abilities: [{ when: 'arrives', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] }] }),
  /** "When this arrives, it deals 2 damage to target creature an opponent controls." */
  creature('arrivalPinger', { abilities: [{ when: 'arrives', targets: [PREY], ops: [{ op: 'damage', n: 2, to: 'target' }] }] }),
  /** "When this arrives, Hunt another creature you control." */
  creature('yoursHunter', { abilities: [{ when: 'arrives', targets: [{ what: 'yourCreature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'yours' }] }] }),
  /** "When this arrives, Hunt any other creature." */
  creature('anyHunter', { abilities: [{ when: 'arrives', targets: [ANY_PREY], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] }] }),
].map((d) => [d.id, d]));

const PROFILE: PickerProfile = makePicker();
const score = (id: string, picks: string[], profile = PROFILE): number => scorePick(DB, id, picks, profile, 0);
/** What a role adds over its twin, with this pool drafted. */
const edge = (id: string, twin: string, picks: string[]): number => score(id, picks) - score(twin, picks);
const n = (id: string, count: number): string[] => Array<string>(count).fill(id);

describe('a Provoked payoff is weighted by the sources already drafted', () => {
  it('gains with each source, from nothing with none, up to a cap', () => {
    expect(edge('payoff', 'payoffTwin', [])).toBe(0);
    expect(edge('payoff', 'payoffTwin', n('bear', 5))).toBe(0);
    const one = edge('payoff', 'payoffTwin', ['source']);
    const three = edge('payoff', 'payoffTwin', ['source', 'sweepSource', 'source']);
    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one);
    expect(edge('payoff', 'payoffTwin', n('source', 12))).toBe(edge('payoff', 'payoffTwin', n('source', 20)));
  });

  it('scales with the profile\'s mechanic weight, and a profile without it ignores the pairing', () => {
    const at = (mechanicWeight: number): number => {
      const profile = makePicker({ mechanicWeight });
      return score('payoff', ['source'], profile) - score('payoffTwin', ['source'], profile);
    };
    expect(at(2)).toBeCloseTo(at(1) * 2);
    expect(at(0)).toBe(0);
  });
});

describe('a Provoked source is weighted by the payoffs already drafted', () => {
  it('gains with each payoff and not with other creatures', () => {
    const plain = score('source', n('bear', 3));
    expect(score('source', ['payoff', 'bear', 'bear'])).toBeGreaterThan(plain);
    expect(score('source', ['payoff', 'payoff', 'bear'])).toBeGreaterThan(score('source', ['payoff', 'bear', 'bear']));
  });

  it('counts a Hunt that declares your own creatures as prey as a source, not as removal', () => {
    expect(score('yoursHunter', ['payoff'])).toBeGreaterThan(score('yoursHunter', ['bear']));
    expect(edge('yoursHunter', 'bear', [])).toBeLessThan(edge('arrivalHunter', 'bear', []));
  });
});

describe('a Hunt as removal is weighted by the drafter\'s creatures', () => {
  it('a Hunt spell is not removal with no creature to hunt with, and is full removal with plenty', () => {
    // Against a blank Ritual; a destroy spell is the removal it grows into.
    expect(edge('huntSpell', 'blank', [])).toBe(0);
    expect(edge('huntSpell', 'blank', n('blank', 10))).toBe(0);
    const some = edge('huntSpell', 'blank', n('bear', 2));
    const full = edge('destroySpell', 'blank', n('bear', 20));
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(full);
    expect(edge('huntSpell', 'blank', n('bear', 20))).toBe(full);
  });

  it('a creature that hunts is removal on its own, as an arrival damage effect is', () => {
    const pinger = edge('arrivalPinger', 'bear', []);
    expect(pinger).toBeGreaterThan(0);
    expect(edge('arrivalHunter', 'bear', [])).toBe(pinger);
    expect(edge('arrivalHunter', 'bear', n('bear', 20))).toBe(pinger);
  });

  it('an any-prey hunter is both removal and a source', () => {
    expect(edge('anyHunter', 'arrivalHunter', ['bear'])).toBe(0);
    expect(edge('anyHunter', 'arrivalHunter', ['payoff'])).toBeGreaterThan(0);
  });
});
