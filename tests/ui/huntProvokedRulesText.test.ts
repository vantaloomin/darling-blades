import { describe, expect, it } from 'vitest';
import type { AbilityDef, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';

/**
 * The First Dawn words (1.9, A2.c): Hunt is a bare verb keyword whose default
 * prey lives in the glossary, a card that declares its own prey names it, the
 * spell form names its hunter once, and a source that damages its own side
 * says which of your creatures it spares. These assert those rules on fixture
 * cards, not the full rendered strings.
 */

const creature = (id: string, extra: Partial<CardDef>): CardDef => ({
  id, name: id, types: ['creature'], subtypes: ['Dinokin'], colors: ['G'], rarity: 'c',
  cost: { generic: 2, pips: { G: 1 } }, attack: 3, defense: 3, ...extra,
});
const ritual = (id: string, ability: AbilityDef): CardDef => ({
  id, name: id, types: ['ritual'], subtypes: [], colors: ['G'], rarity: 'c',
  cost: { generic: 1, pips: { G: 1 } }, abilities: [ability],
});

const HUNT: EffectOp = { op: 'hunt', hunter: 'self' };
const OPPONENT_PREY: TargetSpec[] = [{ what: 'opponentCreature' }];
const HUNTER_AND_PREY: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'opponentCreature' }];

/** One line per source-bound carrier of the generic Hunt. */
const genericCarriers: CardDef[] = [
  creature('arrival', { abilities: [{ when: 'arrives', ops: [HUNT], targets: OPPONENT_PREY }] }),
  creature('dawn', { abilities: [{ when: 'dawn', ops: [HUNT], targets: OPPONENT_PREY }] }),
  creature('attack', { abilities: [{ when: 'attacks', ops: [HUNT], targets: OPPONENT_PREY }] }),
  creature('duty', { activated: { cost: { tap: true, mana: { generic: 1, pips: { G: 1 } } }, ops: [HUNT], targets: OPPONENT_PREY } }),
  creature('empower', { empower: { cost: { generic: 2, pips: {} }, ops: [HUNT], targets: OPPONENT_PREY } }),
];

describe('Hunt rules text', () => {
  it('ends an arrival hunter\'s line on the bare keyword: the default prey is not printed', () => {
    const line = rulesText(genericCarriers[0]);
    expect(line.endsWith('Hunt.')).toBe(true);
    expect(line).not.toMatch(/opponent|target/);
  });

  it('prints the bare keyword after every carrier\'s opener', () => {
    for (const card of genericCarriers) {
      const line = rulesText(card);
      expect(line, card.id).toMatch(/\bHunt\.$/);
      expect(line, card.id).not.toMatch(/opponent/);
    }
  });

  it('opens a Dawn Hunt with the Dawn template', () => {
    expect(rulesText(genericCarriers[1]).startsWith('During your Dawn, ')).toBe(true);
  });

  it('names the prey when the card declares its own', () => {
    const any = creature('any', {
      abilities: [{ when: 'arrives', ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }], targets: [{ what: 'creature', other: true }] }],
    });
    const yours = creature('yours', {
      activated: { cost: { tap: true }, ops: [{ op: 'hunt', hunter: 'self', prey: 'yours' }], targets: [{ what: 'yourCreature', other: true }] },
    });
    const spellAny = ritual('spell-any', {
      when: 'spell', ops: [{ op: 'hunt', hunter: 'target', prey: 'any' }],
      targets: [{ what: 'yourCreature' }, { what: 'creature', other: true }],
    });
    expect(rulesText(any)).toMatch(/\bHunt any other creature\.$/);
    expect(rulesText(yours)).toMatch(/\bHunt another creature you control\.$/);
    expect(rulesText(spellAny)).toMatch(/\bHunts any other creature\.$/);
  });

  it('names the spell form\'s hunter once, whether the Hunt comes first or after a pump', () => {
    const occurrences = (text: string): number => text.split('target creature you control').length - 1;
    const plain = ritual('plain', { when: 'spell', ops: [{ op: 'hunt', hunter: 'target' }], targets: HUNTER_AND_PREY });
    const pumped = ritual('pumped', {
      when: 'spell', ops: [{ op: 'boost', scope: 'target', p: 2, t: 2 }, { op: 'hunt', hunter: 'target' }], targets: HUNTER_AND_PREY,
    });
    const huntThenPump = ritual('hunt-then-pump', {
      when: 'spell', ops: [{ op: 'hunt', hunter: 'target' }, { op: 'boost', scope: 'target', p: 1, t: 1 }], targets: HUNTER_AND_PREY,
    });
    expect(rulesText(plain).endsWith(' Hunts.')).toBe(true);
    expect(rulesText(plain)).not.toMatch(/opponent/);
    expect(rulesText(pumped)).toMatch(/, then it Hunts\.$/);
    for (const card of [plain, pumped, huntThenPump]) {
      expect(occurrences(rulesText(card).toLowerCase()), card.id).toBe(1);
    }
  });
});

describe('damage to each creature you control', () => {
  const each = (other: boolean): CardDef => ritual(`each-${other}`, {
    when: 'spell', ops: [other ? { op: 'damage', n: 1, to: 'eachYourCreature', other: true } : { op: 'damage', n: 1, to: 'eachYourCreature' }],
  });

  it('says "other" exactly when the source spares itself', () => {
    expect(rulesText(each(true))).toMatch(/\beach other creature you control\b/);
    expect(rulesText(each(false))).toMatch(/\beach creature you control\b/);
    expect(rulesText(each(false))).not.toMatch(/\bother\b/);
  });
});

describe('Provoked rules text', () => {
  it('opens with the keyword and leaves the once-each-turn rule to the glossary', () => {
    const card = creature('provoked', { abilities: [{ when: 'provoked', ops: [{ op: 'addCounters', to: 'self', n: 1 }] }] });
    const text = rulesText(card);
    expect(text.startsWith('Provoked: ')).toBe(true);
    expect(text).not.toMatch(/once each turn/);
  });
});
