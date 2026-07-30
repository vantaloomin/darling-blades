import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import type { CardDef } from '../../src/engine/types';
import { MECHANIC_DEFINITIONS, rulesText, typeLine } from '../../src/ui/rulesText';

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

describe('target-aware damage and land rules text', () => {
  it('renders creature-only damage and reuses the named creature', () => {
    const expected = {
      'so-flame-lash': 'Deal 3 damage to target creature.',
      'cf-ember-of-brigid': 'Deal 2 damage to target creature.',
      'cf-silver-apple-shot': 'Deal 3 damage to target creature.',
      'ac-moonlit-joust': 'Target creature gets +2/+0 and gains First Blade until end of turn, then deal 1 damage to that creature.',
      'ac-hunt-the-boar': 'Deal 3 damage to target creature.',
      'dt-spindle-prick': 'Deal 1 damage to target creature, then tap that creature.',
    } as const;

    for (const [id, text] of Object.entries(expected)) {
      expect(rulesText(CARD_DB[id])).toBe(text);
      expect(text).not.toContain('\u2014');
    }
  });

  it('keeps any-target damage wording unchanged', () => {
    expect(rulesText(CARD_DB['in-fire-attack'])).toBe('Deal 2 damage to any target.');
    expect(rulesText(CARD_DB['cf-balor-evil-eye'])).toBe(
      "Deal 5 damage to any target, then Sever the top card of your opponent's graveyard.",
    );
  });

  it('says "you control" when the target spec is yourCreature (mana-rock sign-off riders)', () => {
    expect(rulesText(CARD_DB['ar-imperial-jade-seal'])).toBe(
      'When this arrives, put 1 +1/+1 mark on target creature you control.',
    );
    expect(rulesText(CARD_DB['so-nurture'])).toBe('Put 2 +1/+1 marks on target creature you control.');
  });

  it('prints each mono tapland arrival-rider kind beside enters-tapped text', () => {
    expect(rulesText(CARD_DB['cf-mist-road'])).toBe('Arrives tapped.\nWhen this arrives, Foresee 1.');
    expect(rulesText(CARD_DB['ac-bramble-chapel'])).toBe('Arrives tapped.\nWhen this arrives, you gain 1 life.');
    expect(rulesText(CARD_DB['ac-court-of-whispers'])).toBe('Arrives tapped.\nWhen this arrives, put the top card of your deck into your graveyard.');
    expect(rulesText(CARD_DB['gm-chapel-yard'])).toBe("Arrives tapped.\nWhen this arrives, Sever the top card of your opponent's graveyard.");
    expect(rulesText(CARD_DB['ac-holy-well'])).toContain('Arrives tapped.');
  });

  it('does not emit em-dashes in generated rules text', () => {
    for (const card of ALL_CARDS) expect(rulesText(card)).not.toContain('\u2014');
  });
});

describe('sweeper rules text', () => {
  it('renders symmetric, target-free red damage and black stat reduction honestly', () => {
    const red = {
      id: 'red_sweeper',
      name: 'Red Sweeper',
      types: ['ritual'],
      subtypes: [],
      cost: { generic: 0, pips: {} },
      colors: ['R'],
      abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] }],
      rarity: 'c',
    } as const satisfies CardDef;
    const black = {
      id: 'black_sweeper',
      name: 'Black Sweeper',
      types: ['ritual'],
      subtypes: [],
      cost: { generic: 0, pips: {} },
      colors: ['B'],
      abilities: [{ when: 'spell', ops: [{ op: 'boost', p: -1, t: -1, scope: 'all' }] }],
      rarity: 'c',
    } as const satisfies CardDef;

    expect(rulesText(red)).toBe('Deal 1 damage to each creature.');
    expect(rulesText(black)).toBe('All creatures get -1/-1 until end of turn.');
    expect(rulesText(red)).not.toContain('\u2014');
    expect(rulesText(black)).not.toContain('\u2014');
  });
});

describe('Hauntlink rules text', () => {
  it('keeps the glossary reminder in the two-line mechanics copy band', () => {
    expect(MECHANIC_DEFINITIONS.hauntlink.length).toBeLessThanOrEqual(90);
    expect(MECHANIC_DEFINITIONS.hauntlink).not.toContain('\u2014');
  });

  it('renders the alternate cost, host rider, and host-death cleanup', () => {
    const text = rulesText(CARD_DB['yn-hauntlink-apex']);
    expect(text).toContain('Hauntlink {3}{U}:');
    expect(text).toContain('linked to a creature you control');
    expect(text).toContain('gets +2/+0 and gains Skyborne, Untouchable');
    expect(text).toContain("When the host leaves play, put this into its owner's graveyard.");
    expect(text).not.toContain('\u2014');
  });
});
