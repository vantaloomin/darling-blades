import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../src/engine/types';
import { rulesText, titheText, whispersText } from '../../src/ui/rulesText';

const creature: CardDef = {
  id: 'drowned-deep-rules-fixture', name: 'Rules Fixture', types: ['creature'],
  subtypes: ['Horror'], colors: ['B'], rarity: 'c',
  cost: { generic: 4, pips: { B: 1 } }, attack: 3, defense: 4,
};

describe('Whispers rules text', () => {
  it('prints the Whispers cost with ordered generic and coloured pips', () => {
    const card: CardDef = {
      ...creature, whispers: { cost: { generic: 2, pips: { B: 2, U: 1 } } },
    };
    expect(whispersText(card)).toBe('Whispers {2}{U}{B}{B}.');
    expect(rulesText(card)).toBe('Whispers {2}{U}{B}{B}.');
  });

  it('prints a free Whispers cost and omits the line on cards without it', () => {
    expect(whispersText({ ...creature, whispers: { cost: { generic: 0, pips: {} } } }))
      .toBe('Whispers {0}.');
    expect(whispersText(creature)).toBeUndefined();
  });

  it('keeps Skim first and places Whispers after the body, Empower, and Preserve', () => {
    const card: CardDef = {
      ...creature,
      skim: { cost: { generic: 1, pips: {} } },
      whispers: { cost: { generic: 2, pips: { B: 1 } } },
      keywords: ['bulwark'],
      abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }],
      empower: { cost: { generic: 1, pips: { B: 1 } }, ops: [{ op: 'draw', n: 1 }] },
      preserve: { cost: { generic: 5, pips: { B: 1 } } },
    };
    expect(rulesText(card)).toBe([
      'Skim {1}',
      'Bulwark',
      'When this arrives, you gain 1 life.',
      'Empower {1}{B}: Draw a card.',
      'Preserve {5}{B}.',
      'Whispers {2}{B}.',
    ].join('\n'));
    expect(rulesText(card)).not.toContain('\u2014');
  });

  it('keeps Retell in its existing last-line position', () => {
    const card: CardDef = {
      ...creature,
      abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }],
      preserve: { cost: { generic: 5, pips: { B: 1 } } },
      retell: { cost: { generic: 2, pips: { B: 1 } } },
    };
    expect(rulesText(card)).toBe([
      'When this arrives, you gain 1 life.',
      'Preserve {5}{B}.',
      'Retell {2}{B}: You may cast this from your graveyard, then sever it.',
    ].join('\n'));
  });
});

describe('Tithe rules text', () => {
  it('prints the bare Tithe keyword with its period and omits it on cards without Tithe', () => {
    expect(titheText({ ...creature, tithe: { per: 2 } })).toBe('Tithe.');
    expect(rulesText({ ...creature, tithe: { per: 2 } })).toBe('Tithe.');
    expect(titheText(creature)).toBeUndefined();
  });

  it('uses the Rite line position before the body and keeps the Rite copy unchanged', () => {
    const card: CardDef = {
      ...creature,
      keywords: ['bulwark'],
      tithe: { per: 2 },
      abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }],
      empower: { cost: { generic: 1, pips: { B: 1 } }, ops: [{ op: 'draw', n: 1 }] },
      preserve: { cost: { generic: 5, pips: { B: 1 } } },
    };
    const lines = [
      'Bulwark',
      'Tithe.',
      'When this arrives, you gain 1 life.',
      'Empower {1}{B}: Draw a card.',
      'Preserve {5}{B}.',
    ];
    expect(rulesText(card)).toBe(lines.join('\n'));
    expect(rulesText({ ...card, tithe: undefined, rite: { n: 2 } }))
      .toBe(lines.map((line) => line === 'Tithe.' ? 'Rite 2.' : line).join('\n'));
    expect(rulesText(card)).not.toContain('\u2014');
  });
});
