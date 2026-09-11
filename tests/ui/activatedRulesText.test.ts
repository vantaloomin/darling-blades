import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../src/engine/types';
import { activatedText, rulesText } from '../../src/ui/rulesText';

const fixture: CardDef = {
  id: 'duty-rules-fixture', name: 'Duty Fixture', types: ['artifact'],
  subtypes: [], colors: [], rarity: 'c',
  activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
};

describe('Duty rules text', () => {
  it('prints the tap-alone cost as a token, retaining it for plain-text consumers', () => {
    expect(rulesText(fixture)).toMatchInlineSnapshot('"{T}: Draw a card."');
    expect(rulesText(fixture)).not.toContain('Duty');
    expect(rulesText(fixture)).not.toContain('\u2014');
  });

  it('prints the tap and mana cost with the existing mana tokens', () => {
    const card: CardDef = {
      ...fixture,
      activated: {
        cost: { tap: true, mana: { generic: 1, pips: { G: 1 } } },
        ops: [{ op: 'gainLife', n: 2 }, { op: 'draw', n: 1 }],
      },
    };
    expect(rulesText(card)).toMatchInlineSnapshot('"{T}, {1}{G}: You gain 2 life, then draw a card."');
  });

  it('treats an explicitly zero mana cost as the tap alone', () => {
    expect(activatedText({
      ...fixture,
      activated: { ...fixture.activated!, cost: { tap: true, mana: { generic: 0, pips: {} } } },
    })).toBe('{T}: Draw a card.');
  });

  it('places Duty immediately after Skim and before keywords and triggered abilities', () => {
    expect(rulesText({
      ...fixture, types: ['creature'], attack: 1, defense: 1,
      skim: { cost: { generic: 2, pips: {} } },
      keywords: ['sentinel'],
      abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }],
    })).toBe('Skim {2}\n{T}: Draw a card.\nSentinel\nWhen this arrives, you gain 1 life.');
  });

  it('renders target qualifiers and later references through the existing op renderer', () => {
    expect(activatedText({
      ...fixture,
      activated: {
        cost: { tap: true }, targets: [{ what: 'creature', other: true, marked: true }],
        ops: [{ op: 'damage', n: 1, to: 'target' }, { op: 'tap', to: 'target' }],
      },
    })).toBe('{T}: Deal 1 damage to another target Marked creature, then tap that creature.');
  });

  it('adds no line to a card without an activated rider', () => {
    const card = { ...fixture, activated: undefined };
    expect(activatedText(card)).toBeUndefined();
    expect(rulesText(card)).toBe('');
  });
});
