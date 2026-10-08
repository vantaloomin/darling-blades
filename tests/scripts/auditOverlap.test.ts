import { describe, expect, it } from 'vitest';
import {
  bodyKey,
  charmOutclasses,
  clusters,
  dominates,
  fullKey,
  ladderKey,
  riderCosts,
  shapeKey,
  statLadders,
  typalSubtypes,
  worseTwins,
} from '../../scripts/audit-overlap';
import type { ActivatedDef, CardDef, Keyword, ManaCost } from '../../src/engine/types';

// The duplicate comparator every new set is run through (scripts/audit-overlap.ts).
// Its contract: two cards share a body only if they play identically, and a card
// that differs only in what it costs lands in REDESKIN or DOMINATED, not IDENTICAL.

const cost = (generic: number, pips: ManaCost['pips'] = {}): ManaCost => ({ generic, pips });
const NO_TRIBES: ReadonlySet<string> = new Set();

function creature(id: string, extra: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    cost: cost(1, { U: 1 }),
    colors: ['U'],
    attack: 1,
    defense: 3,
    rarity: 'c',
    ...extra,
  };
}

function ritual(id: string, extra: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['ritual'],
    subtypes: [],
    cost: cost(1, { R: 1 }),
    colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c',
    ...extra,
  };
}

const loot: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }] };
const scry: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }] };

describe('audit-overlap body key: cards share a body only if they play identically', () => {
  it('separates cards that differ only in a Duty', () => {
    expect(bodyKey(creature('a', { activated: loot }), NO_TRIBES)).not.toBe(bodyKey(creature('b', { activated: scry }), NO_TRIBES));
    expect(bodyKey(creature('a', { activated: loot }), NO_TRIBES)).not.toBe(bodyKey(creature('b'), NO_TRIBES));
    const targeted: ActivatedDef = { ...scry, targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }] };
    const untargeted: ActivatedDef = { ...scry, ops: [{ op: 'tapAll', who: 'opponent' }] };
    expect(bodyKey(creature('a', { activated: targeted }), NO_TRIBES)).not.toBe(bodyKey(creature('b', { activated: untargeted }), NO_TRIBES));
  });

  it('separates cards that differ only in a Tithe or a Whispers', () => {
    expect(bodyKey(creature('a', { tithe: { per: 2 } }), NO_TRIBES)).not.toBe(bodyKey(creature('b'), NO_TRIBES));
    expect(bodyKey(ritual('a', { whispers: { cost: cost(0, { R: 1 }) } }), NO_TRIBES)).not.toBe(bodyKey(ritual('b'), NO_TRIBES));
  });

  it('keeps a Duty, Whispers or Retell cost difference out of IDENTICAL but in the same shape', () => {
    const cheap = ritual('a', { whispers: { cost: cost(0, { R: 1 }) } });
    const dear = ritual('b', { whispers: { cost: cost(0, { R: 2 }) } });
    expect(fullKey(cheap, NO_TRIBES)).not.toBe(fullKey(dear, NO_TRIBES));
    expect(shapeKey(cheap, NO_TRIBES)).toBe(shapeKey(dear, NO_TRIBES));

    const free = creature('c', { activated: scry });
    const paid = creature('d', { activated: { ...scry, cost: { tap: true, mana: cost(1) } } });
    expect(fullKey(free, NO_TRIBES)).not.toBe(fullKey(paid, NO_TRIBES));
    expect(shapeKey(free, NO_TRIBES)).toBe(shapeKey(paid, NO_TRIBES));

    const { identical, redeskin } = clusters(
      [ritual('e', { retell: { cost: cost(2, { R: 1 }) } }), ritual('f', { retell: { cost: cost(3, { R: 1 }) } })],
      NO_TRIBES,
    );
    expect(identical).toEqual([]);
    expect(redeskin.map((g) => g.map((d) => d.id).sort())).toEqual([['e', 'f']]);
  });

  it('matches cards that differ only in presentation or authoring order', () => {
    const a = creature('a', {
      keywords: ['sentinel', 'skyborne'],
      abilities: [
        { when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] },
        { when: 'dies', ops: [{ op: 'draw', n: 1 }] },
      ],
      activated: [loot, scry],
      tithe: { per: 2 },
      whispers: { cost: cost(1, { U: 1 }) },
    });
    const b: CardDef = {
      ...a,
      id: 'b',
      name: 'Another Name',
      rarity: 'sr',
      set: 'drowned-deep',
      artRef: 'other-art',
      displayTypeLine: 'Creature — Other',
      keywords: ['skyborne', 'sentinel'],
      abilities: [...(a.abilities ?? [])].reverse(),
      activated: [scry, loot],
    };
    expect(fullKey(a, NO_TRIBES)).toBe(fullKey(b, NO_TRIBES));
    expect(clusters([a, b], NO_TRIBES).identical.map((g) => g.length)).toEqual([2]);
    // one Duty written bare or as a one-item list is the same Duty
    expect(bodyKey(creature('c', { activated: loot }), NO_TRIBES)).toBe(bodyKey(creature('d', { activated: [loot] }), NO_TRIBES));
    // a keyword list is a set wherever it sits: a static's grant, a boost, an awakening
    const granting = (id: string, kws: Keyword[]) =>
      creature(id, {
        abilities: [
          { when: 'static', static: { scope: 'self', grantKeywords: kws } },
          { when: 'arrives', targets: [{ what: 'yourCreature' }], ops: [{ op: 'boost', p: 1, t: 1, keywords: kws, scope: 'target' }] },
        ],
        awakening: { p: 1, keywords: kws },
      });
    expect(bodyKey(granting('e', ['sentinel', 'skyborne']), NO_TRIBES)).toBe(bodyKey(granting('f', ['skyborne', 'sentinel']), NO_TRIBES));
  });

  it('reads a Duty that lists {0} mana as the bare tap', () => {
    const zero = creature('zero', { activated: { ...scry, cost: { tap: true, mana: cost(0) } } });
    const bare = creature('bare', { activated: scry });
    expect(bodyKey(zero, NO_TRIBES)).toBe(bodyKey(bare, NO_TRIBES));
    expect(clusters([zero, bare], NO_TRIBES).identical.map((g) => g.length)).toEqual([2]);
    expect(riderCosts(zero)).toBe(riderCosts(bare));
  });

  it('counts a subtype only where the rules read it, and counts the legend rule', () => {
    const lord = creature('lord', { abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Wolf', other: true }, p: 1, t: 0 } }] });
    const tribes = typalSubtypes([lord]);
    expect(bodyKey(creature('a', { subtypes: ['Human', 'Wolf'] }), tribes)).not.toBe(bodyKey(creature('b', { subtypes: ['Human'] }), tribes));
    expect(bodyKey(creature('a', { subtypes: ['Human', 'Scout'] }), tribes)).toBe(bodyKey(creature('b', { subtypes: ['Oni'] }), tribes));
    expect(bodyKey(creature('a', { supertypes: ['legendary'] }), tribes)).not.toBe(bodyKey(creature('b'), tribes));
    const aura: CardDef = { ...creature('a'), types: ['enchantment'], attack: undefined, defense: undefined, subtypes: ['Aura'] };
    expect(bodyKey(aura, NO_TRIBES)).not.toBe(bodyKey({ ...aura, id: 'b', subtypes: [] }, NO_TRIBES));
  });

  it('counts a tribe a trigger filter or a controlsOther condition pays off, but not one only a token lord pays off', () => {
    const onDeath = creature('on-death', { abilities: [{ when: 'allyDies', filter: { subtype: 'Horror' }, ops: [{ op: 'draw', n: 1 }] }] });
    const ifKnight = creature('if-knight', {
      abilities: [{ when: 'arrives', condition: { kind: 'controlsOther', subtype: 'Knight' }, ops: [{ op: 'gainLife', n: 2 }] }],
    });
    // Pumps token Plants only; a Plant that is a real card gets nothing from it.
    const tokenLord = creature('token-lord', {
      abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Plant', token: true }, p: 1, t: 1 } }],
    });
    const tribes = typalSubtypes([onDeath, ifKnight, tokenLord]);
    expect(bodyKey(creature('a', { subtypes: ['Horror'] }), tribes)).not.toBe(bodyKey(creature('b'), tribes));
    expect(bodyKey(creature('a', { subtypes: ['Knight'] }), tribes)).not.toBe(bodyKey(creature('b'), tribes));
    expect(bodyKey(creature('a', { subtypes: ['Plant'] }), tribes)).toBe(bodyKey(creature('b'), tribes));
  });

  it('does not ignore a rules field it has never heard of', () => {
    const future = { ...creature('a'), provoked: { ops: [{ op: 'draw', n: 1 }] } } as CardDef;
    expect(bodyKey(future, NO_TRIBES)).not.toBe(bodyKey(creature('b'), NO_TRIBES));
    // Bigger on a stat either way, but the unknown field may be a drawback or an
    // upside, so neither card is ranked over the other.
    expect(dominates({ ...future, attack: 2 }, creature('b'))).toBeNull();
    expect(dominates(creature('b', { attack: 2 }), future)).toBeNull();
  });
});

describe('audit-overlap domination sees Duty, Tithe and Whispers', () => {
  it('ranks the same Whispers or Duty at a cheaper price above the dearer one', () => {
    const cheap = ritual('cheap', { whispers: { cost: cost(0, { R: 1 }) } });
    const dear = ritual('dear', { whispers: { cost: cost(0, { R: 2 }) } });
    expect(dominates(cheap, dear)).not.toBeNull();
    expect(dominates(dear, cheap)).toBeNull();

    const free = creature('free', { activated: scry });
    const paid = creature('paid', { activated: { ...scry, cost: { tap: true, mana: cost(1) } } });
    expect(dominates(free, paid)).not.toBeNull();
    expect(dominates(paid, free)).toBeNull();
  });

  it('never lets a card without a Duty, Tithe or Whispers dominate one that has it', () => {
    const plain = creature('plain', { attack: 2 });
    expect(dominates(plain, creature('duty', { activated: scry }))).toBeNull();
    expect(dominates(plain, creature('tithe', { tithe: { per: 2 } }))).toBeNull();
    expect(dominates(ritual('bare'), ritual('whispers', { whispers: { cost: cost(0, { R: 1 }) } }))).toBeNull();
  });

  it('treats an extra Duty, Tithe or Whispers as upside, since each is optional to use', () => {
    const plain = creature('plain');
    expect(dominates(creature('duty', { activated: loot }), plain)).not.toBeNull();
    expect(dominates(creature('tithe', { tithe: { per: 2 } }), plain)).not.toBeNull();
    expect(dominates(ritual('whispers', { whispers: { cost: cost(0, { R: 1 }) } }), ritual('bare'))).not.toBeNull();
  });

  it('matches Duties one to one, so two Duties are not answered by one', () => {
    expect(dominates(creature('one', { activated: scry, attack: 2 }), creature('two', { activated: [scry, loot] }))).toBeNull();
    expect(dominates(creature('two', { activated: [scry, loot] }), creature('one', { activated: scry }))).not.toBeNull();
  });
});

describe('audit-overlap speed pass compares whole cards', () => {
  const charm = (id: string, extra: Partial<CardDef> = {}) => ritual(id, { types: ['charm'], ...extra });

  it('lets a Charm that also carries Whispers outclass the bare Ritual', () => {
    expect(charmOutclasses(charm('c', { whispers: { cost: cost(1, { R: 1 }) } }), ritual('r'), NO_TRIBES)).not.toBeNull();
    expect(charmOutclasses(charm('c'), ritual('r'), NO_TRIBES)).toBe('identical');
  });

  it('does not let a bare Charm outclass a Ritual carrying a rider the Charm lacks', () => {
    expect(charmOutclasses(charm('c'), ritual('r', { skim: { cost: cost(1) } }), NO_TRIBES)).toBeNull();
    expect(charmOutclasses(charm('c'), ritual('r', { whispers: { cost: cost(0, { R: 1 }) } }), NO_TRIBES)).toBeNull();
  });
});

describe('audit-overlap stat ladder groups the same text at different numbers', () => {
  const flier = (id: string, generic: number, attack: number, defense: number, extra: Partial<CardDef> = {}) =>
    creature(id, { keywords: ['skyborne'], cost: cost(generic, { U: 1 }), attack, defense, ...extra });
  const ids = (cards: readonly CardDef[]) => cards.map((d) => d.id).sort();

  it('groups one text at three sizes up the curve, and ranks no rung that costs more for more', () => {
    const groups = statLadders([flier('small', 1, 2, 2), flier('mid', 2, 3, 3), flier('big', 3, 4, 4)], NO_TRIBES);
    expect(groups.map((g) => ids(g.cards))).toEqual([['big', 'mid', 'small']]);
    expect(groups[0].differs).toEqual(expect.arrayContaining(['stats', 'cost']));
    expect(groups[0].pairs.every((p) => p.winner === null)).toBe(true);
  });

  it('flags the rung a card of the same cost and set beats on stats', () => {
    const [group] = statLadders([flier('lesser', 2, 2, 2), flier('greater', 2, 3, 3)], NO_TRIBES);
    expect(group.pairs).toHaveLength(1);
    expect(group.pairs[0]).toMatchObject({ winner: 'greater', sameSet: true, sameCost: true, sameIdentity: true });
  });

  it('keeps a same-cost pair across sets apart from a same-set pair', () => {
    const [group] = statLadders([flier('here', 2, 2, 2), flier('there', 2, 3, 3, { set: 'drowned-deep' })], NO_TRIBES);
    expect(group.pairs[0]).toMatchObject({ sameSet: false, sameCost: true, winner: 'there' });
    expect(group.sameSet).toEqual([]);
  });

  it('groups a pair that differs only in a rider price and ranks the cheaper rider higher', () => {
    const cheap = ritual('cheap', { retell: { cost: cost(2, { R: 1 }) } });
    const dear = ritual('dear', { retell: { cost: cost(3, { R: 1 }) } });
    const [group] = statLadders([dear, cheap], NO_TRIBES);
    expect(group.differs).toEqual(['rider']);
    expect(group.pairs[0].winner).toBe('cheap');
  });

  it('groups a bigger body against a cheaper Skim without ranking either', () => {
    const skimCheap = creature('skim-cheap', { attack: 2, defense: 4, skim: { cost: cost(1) } });
    const bodyBig = creature('body-big', { attack: 3, defense: 4, skim: { cost: cost(2) } });
    const [group] = statLadders([skimCheap, bodyBig], NO_TRIBES);
    expect(group.differs).toEqual(expect.arrayContaining(['stats', 'rider']));
    expect(group.pairs[0].winner).toBeNull();
  });

  it('groups Foresee 1 against Foresee 3 as an effect-size ladder', () => {
    const foresee = (id: string, n: number) => ritual(id, { abilities: [{ when: 'spell', ops: [{ op: 'foresee', n }] }] });
    const [group] = statLadders([foresee('one', 1), foresee('three', 3)], NO_TRIBES);
    expect(group.differs).toEqual(['effect']);
    expect(group.pairs[0].winner).toBe('three');
  });

  it('does not group cards whose rules text differs', () => {
    const arrives = (id: string, op: 'foresee' | 'draw') => creature(id, { abilities: [{ when: 'arrives', ops: [{ op, n: 1 }] }] });
    expect(statLadders([arrives('sees', 'foresee'), { ...arrives('draws', 'draw'), attack: 2 }], NO_TRIBES)).toEqual([]);
    expect(statLadders([flier('flies', 2, 2, 2), creature('guards', { keywords: ['sentinel'], attack: 3, defense: 3 })], NO_TRIBES)).toEqual([]);
  });

  it('leaves a pair alike in every number to REDESKIN and SAME TEXT', () => {
    expect(statLadders([flier('two', 2, 2, 2), flier('three', 3, 2, 2)], NO_TRIBES)).toEqual([]);
    expect(statLadders([flier('blue', 2, 2, 2), flier('black', 2, 2, 2, { cost: cost(2, { B: 1 }), colors: ['B'] })], NO_TRIBES)).toEqual([]);
  });

  it('does not split a group on a tribe or the legend rule, but says whether one tells a pair apart', () => {
    const lord = creature('lord', { abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Wolf', other: true }, p: 1, t: 0 } }] });
    const tribes = typalSubtypes([lord]);
    const [tribal] = statLadders([flier('wolf', 2, 2, 2, { subtypes: ['Wolf'] }), flier('plain', 2, 3, 3)], tribes);
    expect(tribal.pairs[0]).toMatchObject({ sameIdentity: false, winner: 'plain' });
    const [legend] = statLadders([flier('legend', 2, 2, 2, { supertypes: ['legendary'] }), flier('plain', 2, 3, 3)], NO_TRIBES);
    expect(legend.pairs[0].sameIdentity).toBe(false);
  });

  it('marks a keyword-only text, where the stat line is all the card has', () => {
    expect(statLadders([flier('a', 2, 2, 2), flier('b', 2, 3, 1)], NO_TRIBES)[0].keywordOnly).toBe(true);
    const seer = (id: string, attack: number) => flier(id, 2, attack, 2, { abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }] });
    expect(statLadders([seer('a', 2), seer('b', 3)], NO_TRIBES)[0].keywordOnly).toBe(false);
  });
});

describe('audit-overlap strictly-worse twins', () => {
  it('finds the heavier-pip printing at the same mana value, whichever order the pool lists them in', () => {
    const heavy = creature('heavy', { cost: cost(2, { R: 2 }), colors: ['R'], attack: 4, defense: 3, keywords: ['warcry'] });
    const light = { ...heavy, id: 'light', cost: cost(3, { R: 1 }) };
    for (const pool of [[heavy, light], [light, heavy]])
      expect(worseTwins(pool, NO_TRIBES).map((r) => [r.dead.id, r.best.id])).toEqual([['heavy', 'light']]);
  });
});

describe('audit-overlap ladder key and domination read signs, caps, order and colours', () => {
  const pump = (id: string, p: number, t: number, extra: Partial<CardDef> = {}) =>
    ritual(id, {
      cost: cost(0, { G: 1 }),
      colors: ['G'],
      abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p, t, scope: 'target' }] }],
      ...extra,
    });
  const removal = (id: string, maxCost: number) =>
    ritual(id, {
      types: ['charm'],
      cost: cost(2, { B: 1 }),
      colors: ['B'],
      whispers: { cost: cost(1, { B: 1 }) },
      abilities: [{ when: 'spell', targets: [{ what: 'creature', maxCost }], ops: [{ op: 'destroy', to: 'target' }] }],
    });

  it('never groups a shrink with a pump of the same size', () => {
    expect(ladderKey(pump('shrink', -2, -2))).not.toBe(ladderKey(pump('grow', 2, 2)));
    expect(statLadders([pump('shrink', -2, -2), pump('grow', 2, 2)], NO_TRIBES)).toEqual([]);
    expect(ladderKey(pump('small', 1, 3))).toBe(ladderKey(pump('big', 3, 3)));
  });

  it('ranks a looser target cap above a tighter one, all else equal', () => {
    expect(dominates(removal('three', 3), removal('two', 2))).not.toBeNull();
    expect(dominates(removal('two', 2), removal('three', 3))).toBeNull();
    const [group] = statLadders([removal('two', 2), removal('three', 3)], NO_TRIBES);
    expect(group.pairs[0].winner).toBe('three');
  });

  it('compares a run of mill, discard and life ops as a set, but keeps Foresee-then-draw in order', () => {
    const spell = (id: string, ops: CardDef['abilities']) => ritual(id, { abilities: ops });
    const millFirst = spell('mill-first', [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'discardRandom', n: 1, who: 'opponent' }] }]);
    const discardFirst = spell('discard-first', [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }, { op: 'grind', n: 2, who: 'self' }] }]);
    expect(ladderKey(millFirst)).toBe(ladderKey(discardFirst));
    const seeThenDraw = spell('see-draw', [{ when: 'spell', ops: [{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }] }]);
    const drawThenSee = spell('draw-see', [{ when: 'spell', ops: [{ op: 'draw', n: 1 }, { op: 'foresee', n: 1 }] }]);
    expect(ladderKey(seeThenDraw)).not.toBe(ladderKey(drawThenSee));
  });

  it("names a winner only when its colours fit inside the loser's", () => {
    const blue = creature('blue', { keywords: ['skyborne'], attack: 3, defense: 3, cost: cost(2) });
    const colourless = { ...blue, id: 'colourless', colors: [], attack: 2, defense: 2 } as CardDef;
    // The bigger blue card is no upgrade for a deck that cannot play blue.
    expect(statLadders([blue, colourless], NO_TRIBES)[0].pairs[0]).toMatchObject({ sameColours: false, winner: null });
    // The bigger colourless card is an upgrade for every deck that plays the blue one.
    const bigColourless = { ...colourless, id: 'big-colourless', attack: 3, defense: 3 } as CardDef;
    const smallBlue = { ...blue, id: 'small-blue', attack: 2, defense: 2 } as CardDef;
    expect(statLadders([bigColourless, smallBlue], NO_TRIBES)[0].pairs[0]).toMatchObject({ winner: 'big-colourless' });
  });

  it('keeps a condition threshold and a Rite count out of the effect numbers it strips', () => {
    const gated = (id: string, n: number) =>
      creature(id, { abilities: [{ when: 'arrives', condition: { kind: 'markedThreshold', n, subject: 'creatures' }, ops: [{ op: 'draw', n: 1 }] }] });
    expect(ladderKey(gated('two', 2))).not.toBe(ladderKey(gated('five', 5)));
    expect(ladderKey(creature('rite-one', { rite: { n: 1 } }))).not.toBe(ladderKey(creature('rite-three', { rite: { n: 3 } })));
  });
});
