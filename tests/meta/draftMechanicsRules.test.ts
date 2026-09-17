import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { draftPersonaById } from '../../src/data/draftPersonas';
import type { CardDb, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { LIMITED_DECK_SIZE } from '../../src/meta/DeckStorage';
import { buildLimitedDeck } from '../../src/meta/Limited';
import { DEFAULT_PICKER, makePicker, scoreBasePick, scorePick, type PickerProfile } from '../../src/meta/draftPicker';
import { TIER_RANK } from '../../src/meta/variants';

const cost = { generic: 2, pips: {} };
const dutyCost = { tap: true as const };
const smoothing: EffectOp[] = [{ op: 'foresee', n: 1 }];

function card(id: string, extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost, attack: 2, defense: 2, ...extra,
  };
}

function gain(extra: Partial<CardDef>, profile: PickerProfile = DEFAULT_PICKER): number {
  const vanilla = card('vanilla', { types: extra.types ?? ['creature'] });
  return scoreBasePick({ ...vanilla, ...extra }, profile) - scoreBasePick(vanilla, profile);
}

type Source = (ops: EffectOp[], targets?: TargetSpec[]) => Partial<CardDef>;
const sources: readonly { name: string; put: Source; targeted: boolean }[] = [
  { name: 'printed ability', put: (ops, targets) => ({ abilities: [{ when: 'arrives', ops, targets }] }), targeted: true },
  { name: 'Empower', put: (ops, targets) => ({ empower: { cost, ops, targets } }), targeted: true },
  { name: 'Retell override', put: (ops, targets) => ({ retell: { cost, ops, targets } }), targeted: true },
  { name: 'single Duty', put: (ops, targets) => ({ activated: { cost: dutyCost, ops, targets } }), targeted: true },
  {
    name: 'later Duty entry',
    put: (ops, targets) => ({ activated: [{ cost: dutyCost, ops: smoothing }, { cost: dutyCost, ops, targets }] }),
    targeted: true,
  },
  { name: 'later Quest chapter', put: (ops) => ({ types: ['enchantment'], chapters: [smoothing, ops] }), targeted: false },
];

describe('phase D mechanic identity and profile weights', () => {
  const mechanics: readonly { name: string; extra: Partial<CardDef>; expected: number }[] = [
    { name: 'Empower', extra: { empower: { cost, ops: smoothing } }, expected: 2 },
    { name: 'Retell', extra: { retell: { cost } }, expected: 2 },
    { name: 'Whispers', extra: { whispers: { cost } }, expected: 2 },
    { name: 'Tithe', extra: { tithe: { per: 2 } }, expected: 2 },
    { name: 'Skim', extra: { skim: { cost } }, expected: 1 },
    { name: 'Preserve', extra: { preserve: { cost } }, expected: 2 },
    { name: 'Duty', extra: { activated: { cost: dutyCost, ops: smoothing } }, expected: 2 },
    { name: 'Quest', extra: { types: ['enchantment'], chapters: [smoothing] }, expected: 2 },
    { name: 'Hauntlink', extra: { types: ['artifact'], hauntlink: { cost, linked: { p: 1 } } }, expected: 2 },
    { name: 'Nine Lives', extra: { nineLives: true }, expected: 2 },
  ];

  for (const row of mechanics) {
    it(`${row.name} earns its mechanic weight against a stat-identical vanilla`, () => {
      const profile = makePicker({ buffWeight: 0 });
      expect(gain(row.extra, profile)).toBe(row.expected);
      expect(gain(row.extra, makePicker({ mechanicWeight: 6, buffWeight: 0 }))).toBe(row.expected * 3);
      expect(gain(row.extra, makePicker({ mechanicWeight: 0, buffWeight: 0 }))).toBe(0);
    });
  }

  it('defaults mechanicWeight to 2 and buffWeight to 1', () => {
    expect(DEFAULT_PICKER.mechanicWeight).toBe(2);
    expect(DEFAULT_PICKER.buffWeight).toBe(1);
  });

  it('adds separate mechanic bonuses without multiplying Duty entries or Quest chapters', () => {
    const single = { cost: dutyCost, ops: smoothing };
    expect(gain({ activated: single })).toBe(2);
    expect(gain({ activated: [single] })).toBe(2);
    expect(gain({ activated: [single, single, single] })).toBe(2);
    expect(gain({ types: ['enchantment'], chapters: [smoothing, smoothing, smoothing] })).toBe(2);
    expect(gain({ retell: { cost }, skim: { cost }, nineLives: true })).toBe(5);
  });

  it('Rite and the Awakening property earn no mechanic bonus', () => {
    expect(gain({ rite: { n: 1 } })).toBe(0);
    expect(gain({ awakening: { p: 3, t: 3, keywords: ['skyborne'] } })).toBe(0);
  });
});

describe('phase D whole-text effect collection', () => {
  // Distinct nonzero knobs make loss or duplication of any classifier visible.
  const profile = makePicker({
    mechanicWeight: 0, buffWeight: 0, removalWeight: 7, cardAdvWeight: 11,
    tokenWeight: 13, lifeGainWeight: 17, graveyardWeight: 19,
  });
  const text: EffectOp[] = [
    { op: 'damage', n: 2, to: 'opponent' }, { op: 'draw', n: 1 },
    { op: 'createToken', token: 'fixture-token', count: 2 }, { op: 'gainLife', n: 3 },
    { op: 'raise', to: 'top' }, { op: 'grind', n: 2, who: 'self' },
  ];

  for (const source of sources) {
    it(`${source.name} feeds removal, card advantage, token, life-gain and graveyard weights`, () => {
      expect(gain(source.put(text), profile)).toBe(7 + 11 + 2 * 13 + 17 + 2 * 19);
    });
  }

  it('Empower destroy and Duty draw keep their independent classifier and mechanic bonuses', () => {
    expect(gain({ empower: { cost, targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] } })).toBe(7);
    expect(gain({ activated: { cost: dutyCost, ops: [{ op: 'draw', n: 1 }] } })).toBe(5);
  });

  it('collects every Duty entry and Quest chapter without repeating category bonuses', () => {
    const groups: EffectOp[][] = [[text[0], text[1]], [text[2], text[3]], [text[4], text[5]]];
    expect(gain({ activated: groups.map((ops) => ({ cost: dutyCost, ops })) }, profile)).toBe(99);
    expect(gain({ types: ['enchantment'], chapters: groups }, profile)).toBe(99);
  });

  it('collects both branches of nested ifTargetMarked effects', () => {
    const nested: EffectOp[] = [{
      op: 'ifTargetMarked',
      then: [text[0], { op: 'ifTargetMarked', then: [text[1], text[2]], else: [text[3]] }],
      else: [text[4], text[5]],
    }];
    for (const source of sources) expect(gain(source.put(nested), profile), source.name).toBe(99);
  });

  it('Preserve exposes its one token-copy contribution to token-loving personas', () => {
    expect(gain({ preserve: { cost } }, makePicker({ tokenWeight: 9 }))).toBe(11);
    expect(gain({ preserve: { cost } }, makePicker({ mechanicWeight: 0, tokenWeight: 9 }))).toBe(9);
  });

  it('Hauntlink exposes useful linked stats and keyword grants as one buff', () => {
    const linkedRiders = [{ p: 2 }, { t: 2 }, { grantKeywords: ['skyborne' as const] }, { p: 2, t: 2, grantKeywords: ['sentinel' as const] }];
    for (const linked of linkedRiders) {
      expect(gain({ types: ['artifact'], hauntlink: { cost, linked } })).toBe(3);
    }
    expect(gain({ types: ['artifact'], hauntlink: { cost, linked: { grantKeywords: ['bulwark'] } } })).toBe(2);
    expect(gain({ types: ['artifact'], hauntlink: { cost, linked: { p: -1, t: -1 } } })).toBe(2);
  });
});

describe('phase D marks and useful buffs', () => {
  const useful: readonly { name: string; op: EffectOp }[] = [
    { name: 'positive addCounters', op: { op: 'addCounters', n: 1, to: 'self' } },
    { name: 'propagate', op: { op: 'propagate' } },
    { name: 'moveMark', op: { op: 'moveMark' } },
    { name: 'markAll', op: { op: 'markAll', scope: 'yourCreatures' } },
    { name: 'attack boost', op: { op: 'boost', p: 1, t: 0, scope: 'self' } },
    { name: 'defense boost', op: { op: 'boost', p: 0, t: 1, scope: 'target' } },
    { name: 'keyword-only boost', op: { op: 'boost', p: 0, t: 0, keywords: ['sentinel'], scope: 'allYours' } },
    { name: 'awaken op', op: { op: 'awaken', scope: 'allYours' } },
    { name: 'marked token creation', op: { op: 'createToken', token: 'fixture-token', count: 2, marks: 1 } },
    { name: 'marked raise from top', op: { op: 'raise', to: 'top', withMarks: 2 } },
    { name: 'keyword-granting targeted raise', op: { op: 'raise', to: 'target', grantKeywords: ['dreaded'] } },
    { name: 'keyword-granting default raise', op: { op: 'raise', grantKeywords: ['dreaded'] } },
    { name: 'keyword-granting raise from top', op: { op: 'raise', to: 'top', grantKeywords: ['skyborne'] } },
    { name: 'raise with both marks and keywords', op: { op: 'raise', to: 'top', withMarks: 1, grantKeywords: ['sentinel'] } },
  ];
  const profile = makePicker({ mechanicWeight: 0, cardAdvWeight: 0 });
  for (const row of useful) {
    it(`${row.name} earns buffWeight once per useful op`, () => {
      const extra = { abilities: [{ when: 'arrives' as const, ops: [row.op] }] };
      expect(gain(extra, profile)).toBe(1);
      expect(gain(extra, { ...profile, buffWeight: 4 })).toBe(4);
      expect(gain(extra, { ...profile, buffWeight: 0 })).toBe(0);
    });
  }

  it('sums useful buff ops across mechanics and nested branches', () => {
    const extra: Partial<CardDef> = {
      empower: { cost, ops: [useful[0].op] },
      activated: { cost: dutyCost, ops: [useful[1].op] },
      chapters: [[{ op: 'ifTargetMarked', then: [useful[2].op], else: [useful[3].op] }]],
    };
    expect(gain(extra, profile)).toBe(4);
  });

  it('does not reward negative, zero, restriction-only or Mark-removal ops as buffs', () => {
    const ops: EffectOp[] = [
      { op: 'boost', p: -2, t: -2, scope: 'target' },
      { op: 'boost', p: 0, t: 0, scope: 'self' },
      { op: 'boost', p: 0, t: 0, keywords: ['bulwark', 'rage'], scope: 'target' },
      { op: 'addCounters', n: 0, to: 'self' }, { op: 'addCounters', n: -1, to: 'self' },
      { op: 'removeMarks', to: 'target' },
      { op: 'createToken', token: 'fixture-token', count: 1, marks: 0 },
      { op: 'createToken', token: 'fixture-token', count: 0, marks: 1 },
      { op: 'raise', to: 'top', withMarks: 0 },
      { op: 'raise', to: 'target', grantKeywords: ['bulwark', 'rage'] },
    ];
    expect(gain({ abilities: [{ when: 'arrives', ops }] }, profile)).toBe(0);
  });
});

describe('phase D damage provenance and restriction keywords', () => {
  for (const source of sources) {
    it(`${source.name} penalizes a positive controller-damage rider without awarding removal`, () => {
      expect(gain(source.put([{ op: 'damage', n: 2, to: 'controller' }]), makePicker({ mechanicWeight: 0 }))).toBe(-1);
      expect(gain(source.put([{ op: 'damage', n: 'X', to: 'controller' }]), makePicker({ mechanicWeight: 0 }))).toBe(-1);
      expect(gain(source.put([{ op: 'damage', n: 0, to: 'controller' }]), makePicker({ mechanicWeight: 0 }))).toBe(0);
    });

    if (!source.targeted) continue;
    it(`${source.name} retains own-target provenance through targetIndex and nested branches`, () => {
      for (const what of ['yourCreature', 'yourPermanent'] as const) {
        const ops: EffectOp[] = [{ op: 'ifTargetMarked', then: [{ op: 'damage', n: 2, to: 'target', targetIndex: 1 }] }];
        const extra = source.put(ops, [{ what: 'opponentCreature' }, { what }]);
        expect(gain(extra, makePicker({ mechanicWeight: 0 })), what).toBe(-1);
      }
      const extra = source.put([{ op: 'damage', n: 2, to: 'target' }], [{ what: 'yourCreature' }]);
      expect(gain(extra, makePicker({ mechanicWeight: 0 }))).toBe(-1);
    });
  }

  it('opponent, unrestricted-target and sweep damage retain the removal term', () => {
    const damage: EffectOp[] = [
      { op: 'damage', n: 2, to: 'opponent' }, { op: 'damage', n: 2, to: 'target' },
      { op: 'damage', n: 2, to: 'eachCreature' }, { op: 'damage', n: 2, to: 'eachOpponentCreature' },
    ];
    for (const op of damage) expect(gain({ abilities: [{ when: 'arrives', ops: [op], targets: [{ what: 'creature' }] }] })).toBe(5);
    const targeted = { abilities: [{ when: 'arrives' as const, targets: [{ what: 'yourCreature' as const }, { what: 'opponentCreature' as const }], ops: [{ op: 'damage' as const, n: 2, to: 'target' as const, targetIndex: 1 }] }] };
    expect(gain(targeted)).toBe(5);
  });

  it('a self-damage rider stays a downside when other text already supplies removal', () => {
    const removal: EffectOp = { op: 'damage', n: 2, to: 'opponent' };
    const plain = card('plain', { abilities: [{ when: 'arrives', ops: [removal] }] });
    const rider = card('rider', { abilities: [{ when: 'arrives', ops: [removal, { op: 'damage', n: 1, to: 'controller' }] }] });
    expect(scoreBasePick(rider, DEFAULT_PICKER)).toBe(scoreBasePick(plain, DEFAULT_PICKER) - 1);
  });

  it('Bulwark and Rage earn no generic keyword upside while beneficial keywords retain 1.5', () => {
    expect(gain({ keywords: ['bulwark'] })).toBe(0);
    expect(gain({ keywords: ['rage'] })).toBe(0);
    expect(gain({ keywords: ['bulwark', 'rage'] })).toBe(0);
    expect(gain({ keywords: ['bulwark', 'sentinel', 'rage'] })).toBe(1.5);
  });

  it('explicit Bulwark preferences retain their preference term unchanged', () => {
    const profile = makePicker({ keywordPrefs: ['bulwark'], keywordWeight: 8 });
    expect(gain({ keywords: ['bulwark'] }, profile)).toBe(6.5);
    expect(gain({ keywords: ['rage'] }, profile)).toBe(0);
    expect(gain({ keywords: ['bulwark', 'sentinel'] }, profile)).toBe(8);
    // An unfiltered keyword collector still counts restrictions in its style
    // term; phase D removes only the generic 1.5, never that existing knob.
    expect(gain({ keywords: ['bulwark', 'rage'] }, makePicker({ keywordWeight: 8 }))).toBe(13);
  });
});

describe('phase D persona style and shared auto-build scoring', () => {
  it('Kevin retains a positive defensive preference for an equal-cost Bulwark wall', () => {
    const kevin = draftPersonaById('dp-kevin')!;
    // The shipped Kevin has statBias -1, not keywordPrefs. Preserve his real
    // stat preference; the separate synthetic profile tests explicit Bulwark.
    expect(kevin.picker.statBias).toBe(-1);
    expect(kevin.picker.keywordPrefs).toBeUndefined();
    const wall = card('wall', { attack: 0, defense: 3, keywords: ['bulwark'] });
    const attacker = card('attacker', { attack: 3, defense: 0 });
    expect(scoreBasePick(wall, kevin.picker)).toBeGreaterThan(scoreBasePick(attacker, kevin.picker));
    expect(scoreBasePick({ ...wall, keywords: [] }, kevin.picker)).toBe(scoreBasePick(wall, kevin.picker));
  });

  it('Tiffany still takes the rarest card in her shipped fixture pack', () => {
    const tiffany = draftPersonaById('dp-tiffany')!;
    const pack = ['rg-freya', 'tk-wu-huanggai'];
    const picks = Array.from({ length: 5 }, () => 'tk-wei-yuejin');
    const winner = [...pack].sort((a, b) => scorePick(CARD_DB, b, picks, tiffany.picker, 0) - scorePick(CARD_DB, a, picks, tiffany.picker, 0))[0];
    expect(winner).toBe('rg-freya');
    expect(TIER_RANK[CARD_DB[winner].rarity]).toBe(Math.max(...pack.map((id) => TIER_RANK[CARD_DB[id].rarity])));
  });

  it('Tiffany values rarity above a common loaded with useful mechanic text', () => {
    const tiffany = draftPersonaById('dp-tiffany')!;
    const rare = card('rare', { rarity: 'r' });
    const common = card('common', {
      skim: { cost }, nineLives: true,
      empower: { cost, ops: [{ op: 'damage', n: 3, to: 'opponent' }, { op: 'draw', n: 2 }, { op: 'propagate' }] },
      activated: { cost: dutyCost, ops: [{ op: 'boost', p: 2, t: 2, scope: 'allYours' }] },
    });
    expect(scoreBasePick(common, DEFAULT_PICKER)).toBeGreaterThan(scoreBasePick(rare, DEFAULT_PICKER));
    expect(scoreBasePick(rare, tiffany.picker)).toBeGreaterThan(scoreBasePick(common, tiffany.picker));
  });

  it('scorePick retains its color commitment and chaos arithmetic around the new base score', () => {
    const green = card('green', { colors: ['G'], retell: { cost } });
    const blue = card('blue', { colors: ['U'], retell: { cost } });
    const db: CardDb = { green, blue };
    const picks = Array.from({ length: 5 }, () => 'green');
    expect(scorePick(db, 'green', [], DEFAULT_PICKER, 0.75)).toBe(scoreBasePick(green, DEFAULT_PICKER));
    expect(scorePick(db, 'green', picks, DEFAULT_PICKER, 0.75)).toBe(scoreBasePick(green, DEFAULT_PICKER) + 5);
    expect(scorePick(db, 'blue', picks, DEFAULT_PICKER, 0.75)).toBe(scoreBasePick(blue, DEFAULT_PICKER) - 7);
    const noisy = makePicker({ chaos: 0.25 });
    expect(scorePick(db, 'green', picks, noisy, 0.75)).toBe((scoreBasePick(green, noisy) + 5) * 0.75 + 75 * 0.25);
    expect(scorePick(db, 'green', picks, makePicker({ chaos: 1 }), 0.75)).toBe(75);
  });

  for (const colors of [[], ['G']] as const) {
    it(`auto-build and pick scoring agree on ${colors.length ? 'same-color' : 'colorless'} mechanic cards`, () => {
      const vanilla = card('a-vanilla', { colors: [...colors] });
      const mechanic = card('z-mechanic', { colors: [...colors], activated: { cost: dutyCost, ops: [{ op: 'draw', n: 1 }] } });
      const db: CardDb = { [vanilla.id]: vanilla, [mechanic.id]: mechanic };
      expect(scorePick(db, mechanic.id, [], DEFAULT_PICKER, 0)).toBe(scoreBasePick(mechanic, DEFAULT_PICKER));
      expect(scorePick(db, mechanic.id, [], DEFAULT_PICKER, 0) - scorePick(db, vanilla.id, [], DEFAULT_PICKER, 0)).toBe(5);
      const deck = buildLimitedDeck(db, [...Array.from({ length: LIMITED_DECK_SIZE }, () => vanilla.id), mechanic.id]);
      expect(deck).toHaveLength(LIMITED_DECK_SIZE);
      expect(deck[0]).toBe(mechanic.id);
      expect(deck.filter((id) => id === vanilla.id)).toHaveLength(LIMITED_DECK_SIZE - 1);
    });
  }

  it('auto-build color choice uses the same mechanic value as pick scoring', () => {
    const white = card('a-white', { colors: ['W'] });
    const blue = card('b-blue', { colors: ['U'] });
    const black = card('z-black', { colors: ['B'] });
    const vanillaDb: CardDb = { [white.id]: white, [blue.id]: blue, [black.id]: black };
    const mechanicDb: CardDb = { ...vanillaDb, [black.id]: { ...black, retell: { cost } } };
    const pool = [white, blue, black].flatMap((d) => Array.from({ length: 10 }, () => d.id));
    const before = buildLimitedDeck(vanillaDb, pool);
    const after = buildLimitedDeck(mechanicDb, pool);
    expect(scorePick(mechanicDb, black.id, [], DEFAULT_PICKER, 0) - scorePick(vanillaDb, black.id, [], DEFAULT_PICKER, 0)).toBe(2);
    expect(before.filter((id) => id === blue.id)).toHaveLength(10);
    expect(before.filter((id) => id === black.id)).toHaveLength(5);
    expect(after.filter((id) => id === black.id)).toHaveLength(10);
    expect(after.filter((id) => id === blue.id)).toHaveLength(5);
  });
});
