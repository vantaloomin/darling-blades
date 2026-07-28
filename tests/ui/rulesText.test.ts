import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { rulesText, typeLine } from '../../src/ui/rulesText';

const AURA_KEYWORD_TEXT = {
  'en-wings-of-dawn': 'Enchanted Creature gets +1/+1, and gains Skyborne.',
  'en-battle-fervor': 'Enchanted Creature gets +2/+0, and gains Warcry.',
  'rg-rune-of-fury': 'Enchanted Creature gets +2/+0, and gains Warcry.',
  'rg-rune-of-the-hunt': 'Enchanted Creature gets +2/+2, and gains Overrun.',
  'rg-rune-of-hunger': 'Enchanted Creature gets +1/+1, and gains Deathblade.',
  'rg-rune-of-insight': 'Enchanted Creature gets +1/+1, and gains Skyborne.',
  'rg-rune-of-warding': 'Enchanted Creature gets +1/+2, and gains Sentinel.',
  'ac-lance-of-dawn': 'Enchanted Creature gets +2/+0, and gains First Blade.',
  'dt-gilded-cage': 'Enchanted Creature gets -2/+0, and gains Bulwark.',
} as const;

describe('generated aura rules text', () => {
  it('goldens every aura keyword grant changed from has/have to gains', () => {
    const actual = Object.fromEntries(
      Object.keys(AURA_KEYWORD_TEXT).map((id) => [id, rulesText(CARD_DB[id])]),
    );
    expect(actual).toEqual(AURA_KEYWORD_TEXT);

    for (const card of ALL_CARDS.filter((card) => card.subtypes.includes('Aura'))) {
      expect(rulesText(card)).not.toMatch(/\b(has|have)\b/);
    }
  });
});

describe('token type lines', () => {
  it('renders tokens as "Creature (Token): Type" (batch 3 item 6)', () => {
    const tokens = ALL_CARDS.filter((card) => card.token);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(typeLine(token)).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)* \(Token\)/);
    }
    const squire = ALL_CARDS.find((card) => card.token && card.subtypes.includes('Squire'));
    if (squire) expect(typeLine(squire)).toBe('Creature (Token): Squire');
  });
});
