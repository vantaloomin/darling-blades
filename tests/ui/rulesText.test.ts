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
      'When this arrives, Mark target creature you control.',
    );
    expect(rulesText(CARD_DB['so-nurture'])).toBe('Mark target creature you control twice.');
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

describe('2026-08-30 rules text templates', () => {
  it('puts Skim first as a keyword-cost line, then keywords, body, Empower, and Retell', () => {
    expect(rulesText(CARD_DB['sb-redshift-corsair'])).toBe('Skim {1}\nWarcry');
    expect(rulesText(CARD_DB['sb-bloomdrive-surge'])).toBe('Mark target creature.\nEmpower {2}{G}: Propagate.');
    expect(rulesText(CARD_DB['sb-lumen-refit'])).toBe('Bulwark\nEmpower {2}{W}: Arrives with one +1/+1 Mark.');
    expect(rulesText(CARD_DB['sb-relay-bloom'])).toBe(
      'Mark target creature.\nRetell {2}{G}: You may cast this from your graveyard, then sever it.',
    );
  });

  it('uses Dawn, capitalizes sentence starts, and connects consecutive Dawn abilities', () => {
    expect(rulesText(CARD_DB['sb-burning-hull-runner'])).toBe(
      'If you control a Marked permanent, this gets +1/+0.',
    );
    expect(rulesText(CARD_DB['sb-starborne-relay'])).toBe([
      'When this arrives, draw a card.',
      'During your Dawn, Foresee 1.',
      'If you also control four or more creatures with Marks, draw an extra card.',
    ].join('\n'));
    expect(rulesText(CARD_DB['sb-violet-wake-beacon'])).toBe([
      'When this arrives, create one 1/1 Nebula Firefly token with Skyborne.',
      'During your Dawn: If you control a Marked creature, create one 1/1 Nebula Firefly token with Skyborne.',
    ].join('\n'));
    expect(rulesText(CARD_DB['sb-signal-cathedral'])).toBe([
      'During your Dawn, Foresee 2.',
      'If you also control five or more Marked permanents, draw an extra card.',
    ].join('\n'));
  });

  it('uses Propagate as a bare effect word and Mark as the mark verb', () => {
    expect(rulesText(CARD_DB['sb-green-propagation-chorus'])).toBe('Propagate, then you gain 2 life.');
    expect(rulesText(CARD_DB['sb-orbitroot-matriarch'])).toContain('When this arrives, Propagate.');
    expect(rulesText(CARD_DB['sb-propagation-engine'])).toBe('During your Dawn, Propagate.');
    expect(rulesText(CARD_DB['sb-starborne-apotheosis'])).toBe(
      'Propagate, then you gain 5 life, then your Marked creatures get +1/+1 until end of turn.',
    );
    expect(rulesText(CARD_DB['sb-the-long-crossing'])).toContain('Chapter III: Propagate.');
    expect(rulesText(CARD_DB['sb-chrome-violet-archon'])).toBe(
      'Skyborne\nMarked creatures you control gain Sentinel.',
    );
    expect(rulesText(CARD_DB['sb-the-long-crossing'])).toContain('Chapter II: Mark each creature you control.');
    for (const card of ALL_CARDS) {
      expect(rulesText(card), `${card.id} has lowercase mark vocabulary`).not.toMatch(/\bmark(?:s|ed)?\b/);
    }
  });

  it('keeps the chaptered Ritual engine type while printing Quest', () => {
    expect(CARD_DB['sb-the-long-crossing'].types).toEqual(['ritual']);
    expect(typeLine(CARD_DB['sb-the-long-crossing'])).toBe('Quest');
  });

  it('prints the six Starborne data follow-through bodies', () => {
    expect(CARD_DB['sb-blue-echo-array'].types).toEqual(['ritual']);
    expect(rulesText(CARD_DB['sb-blue-echo-array'])).toBe('Skim {1}\nForesee 2.');
    expect(CARD_DB['sb-null-orbit-array'].types).toEqual(['ritual']);
    expect(rulesText(CARD_DB['sb-null-orbit-array'])).toBe('Skim {2}\nForesee 1.');
    expect(rulesText(CARD_DB['sb-rootlight-navigator'])).toBe(
      'When this arrives, you may play an additional land this turn.',
    );
    expect(rulesText(CARD_DB['sb-star-orchard-keeper'])).toBe(
      'When this arrives, you may play an additional land this turn, then you gain 1 life.',
    );
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

  it('pins the two W3.5b Base Set sweeper bodies', () => {
    expect(rulesText(CARD_DB['so-ember-squall'])).toBe('Deal 1 damage to each creature.');
    expect(rulesText(CARD_DB['so-creeping-malaise'])).toBe('All creatures get -1/-1 until end of turn.');
  });
});

describe('Hauntlink rules text', () => {
  it('keeps the glossary reminder in the two-line mechanics copy band', () => {
    expect(MECHANIC_DEFINITIONS.hauntlink.length).toBeLessThanOrEqual(90);
    expect(MECHANIC_DEFINITIONS.hauntlink).not.toContain('\u2014');
  });

  it('renders the battlefield link cost, Charm-speed move rule, rider, and host death', () => {
    const text = rulesText(CARD_DB['yn-hauntlink-apex']);
    expect(text).toContain('Hauntlink {2}{U}:');
    expect(text).toContain('At Charm speed, link this to a creature you control or move it to another.');
    expect(text).toContain('gets +3/+3 and gains Skyborne, Untouchable');
    expect(text).toContain('This dies with its host.');
    expect(text).not.toContain('\u2014');
  });

  it('prints the corrected reminder on all 16 Hauntlink cards', () => {
    const cards = Object.values(CARD_DB).filter((card) => card.hauntlink !== undefined);
    // 13 Yokai Nights carriers plus the 1.6 card-health wave's three:
    // Fogbell Chime (Silver Veil), Mirror Shard and Haunted Storybook (Dark Tales).
    expect(cards).toHaveLength(16);
    for (const card of cards) {
      const text = rulesText(card);
      expect(text).toContain('At Charm speed');
      expect(text).toContain('This dies with its host.');
      expect(text).not.toContain('\u2014');
    }
  });
});

describe('raise rules text names the top of the graveyard', () => {
  it('prints "the top creature card" wherever the raise is not a dies trigger', () => {
    // `raise top` returns the most-recently-buried creature, so the face must
    // say so. The 2026-08-21 self-return fix replaced "top" with "another",
    // which hid WHICH card comes back (player report 2026-08-25).
    const expected = {
      'rg-zhaoyun': 'When this arrives, return the top creature card of your graveyard to play.',
      'dt-glass-coffin-queen': 'When this arrives, return the top creature card of your graveyard to play.',
      'gm-bride-storm-crowned': 'Empower {2}{B}: Return the top creature card of your graveyard to play.',
      'en-persephones-return': 'Chapter II: Return the top creature card of your graveyard to play.',
    } as const;
    for (const [id, text] of Object.entries(expected)) {
      expect(rulesText(CARD_DB[id])).toContain(text);
      expect(text).not.toContain('\u2014');
    }
  });

  it('keeps the dies-trigger exclusion visible as "the top other creature card"', () => {
    // A dies-triggered raise skips its own source (EffectContext
    // .selfGraveExclusion), and Sitra is the pool's only such card.
    const sitra = rulesText(CARD_DB['sd-sitra-ferrywoman-of-two-rivers']);
    expect(sitra).toContain('When this dies, return the top other creature card of your graveyard to play.');
    expect(sitra).not.toContain('\u2014');
  });

  it('leaves targeted raises on the target wording', () => {
    expect(rulesText(CARD_DB['gm-stormtower-resurrection'])).toContain(
      'Return target creature card from your graveyard to play.',
    );
  });

  it('never prints the ambiguous "another creature card" phrasing', () => {
    for (const card of ALL_CARDS) {
      expect(rulesText(card)).not.toContain('another creature card from your graveyard');
    }
  });
});
