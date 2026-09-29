import { describe, expect, it } from 'vitest';
import type { AbilityDef, EffectOp, ManaCost, TargetSpec } from '../../src/engine/types';
import { bodyValue, scoreCard, type ScorableCardDef } from '../../src/power/scoreCore';

// The First Dawn rates (1.9, A1.4): Hunt and Provoked, fitted to the A1.3 lab
// (docs/plan-first-dawn-engine.md, "As built (A1.4)"). The cards below mirror
// the lab's rows, so a measured reading is the scenario's correct answer. They
// are green, Hunt's primary colour, so no colour-pie premium enters: the lab's
// hole cards were colourless and read no colour identity.

const PREY: TargetSpec = { what: 'opponentCreature' };
const YOURS: TargetSpec = { what: 'yourCreature' };
const HUNT: EffectOp = { op: 'hunt', hunter: 'self' };
const arrivalHunt: AbilityDef = { when: 'arrives', targets: [PREY], ops: [HUNT] };

const creature = (attack: number, defense: number, extra: Partial<ScorableCardDef> = {}): ScorableCardDef => ({
  id: `lab-${attack}-${defense}`, name: `Lab ${attack}/${defense}`, types: ['creature'], subtypes: [], colors: ['G'],
  cost: { generic: Math.max(1, attack), pips: {} }, attack, defense, rarity: 'c', ...extra,
});
const spell = (type: 'ritual' | 'charm', mv: number, ops: EffectOp[], extra: Partial<ScorableCardDef> = {}): ScorableCardDef => ({
  id: `lab-spell-${mv}`, name: 'Lab spell', types: [type], subtypes: [], colors: ['G'], cost: { generic: mv, pips: {} }, rarity: 'c',
  abilities: [{ when: 'spell', targets: [YOURS, { what: 'opponentCreature', other: true }], ops }], ...extra,
});
const power = (card: ScorableCardDef) => scoreCard(card).power;
/** What a line adds: the card against the same card without it. */
const adds = (card: ScorableCardDef, without: Partial<ScorableCardDef>) => power(card) - power({ ...card, ...without });
const provoked = (ops: EffectOp[], targets?: TargetSpec[]): AbilityDef => ({ when: 'provoked', ops, ...(targets ? { targets } : {}) });
const hatch = (count: number): EffectOp => ({ op: 'createToken', token: 'token-soldier', count });

describe('Hunt: a step on whether the hunter survives', () => {
  it('prices a hunter that survives the exchange above one that dies, at equal Attack', () => {
    const huntAdds = (defense: number) => adds(creature(3, defense, { abilities: [arrivalHunt] }), { abilities: undefined });
    // The lab's D=2 to D=3 jump is +1.4 MEP; a slope would move a fraction of that.
    expect(huntAdds(3) - huntAdds(2)).toBeGreaterThan(1);
    expect(huntAdds(2)).toBeLessThan(huntAdds(3));
  });

  // Black, so an off-pie Hunt premium would show: an option worth 0 pays none.
  it('adds nothing through an Empower Hunt, colour-pie premium included', () => {
    const raptor = creature(3, 1, { colors: ['B'], keywords: ['warcry'], empower: { cost: { generic: 2, pips: {} }, targets: [PREY], ops: [HUNT] } });
    expect(adds(raptor, { empower: undefined })).toBeCloseTo(0, 6);
  });

  it('caps a one-shot Hunt by a hunter with Attack under 3 near its creature burn, as an estimate', () => {
    // No lab row has such a hunter; uncapped, a 2/3 would read 1.76, above the
    // measured 3/2 that trades (1.13). Creature burn 2 is 1.2, plus 0.5.
    const small = creature(2, 3, { abilities: [arrivalHunt] });
    expect(adds(small, { abilities: undefined })).toBeLessThanOrEqual(1.7 + 1e-9);
    expect(scoreCard(small).parts.find((part) => part.label.includes('hunt'))?.label).toMatch(/NEEDS MATH/);
  });

  it('folds a Defense pump on a Hunt spell\'s hunter into the Hunt, and an Attack pump adds nothing', () => {
    const plain = power(spell('ritual', 3, [{ op: 'hunt', hunter: 'target' }]));
    const pumped = (p: number, t: number) => power(spell('ritual', 3, [{ op: 'boost', p, t, scope: 'target' }, { op: 'hunt', hunter: 'target' }]));
    expect(pumped(0, 2)).toBeGreaterThan(pumped(0, 1));
    expect(pumped(0, 1)).toBeGreaterThan(plain);
    expect(pumped(2, 0)).toBeCloseTo(plain, 6);
  });
});

describe('Provoked: its effect times the carrier\'s survival', () => {
  it('prices the same Provoked lower on a 2/2 than on a 6/7', () => {
    const line = (attack: number, defense: number) => adds(creature(attack, defense, { abilities: [provoked([hatch(2)])] }), { abilities: undefined });
    expect(line(2, 2)).toBeLessThan(line(6, 7));
    expect(line(2, 2)).toBeCloseTo(0, 6); // measured: a small body's passive Provoked is worth 0
  });

  it('prices a creature whose own Duty can damage it (a self-provoke engine) above the passive rate', () => {
    const pingSelf = { cost: { tap: true as const, mana: { generic: 1, pips: {} } }, targets: [YOURS], ops: [{ op: 'damage', n: 1, to: 'target' } as EffectOp] };
    const pingThem = { ...pingSelf, targets: [PREY] };
    const line = (duty: typeof pingSelf) => scoreCard(creature(2, 5, { activated: duty, abilities: [provoked([hatch(1), { op: 'gainLife', n: 2 }])] }))
      .parts.filter((part) => part.label.startsWith('provoked:')).reduce((sum, part) => sum + part.v, 0);
    // Measured: Sefa's engine 1.87 against a passive rate near 0.2 on a 2/5.
    expect(line(pingSelf)).toBeGreaterThan(line(pingThem) + 1);
  });
});

describe('a self-damage source', () => {
  // Priced once per card at the conservative end of its colour's measured range:
  // white 0.5 (the wall deck read 0.5 to 1.0), red 0 (the Stampede read 0 to 0.3).
  const source = (colors: ScorableCardDef['colors']) => spell('charm', 1, [{ op: 'damage', n: 1, to: 'target' }, { op: 'addCounters', n: 1, to: 'target' }],
    { colors, abilities: [{ when: 'spell', targets: [YOURS], ops: [{ op: 'damage', n: 1, to: 'target' }, { op: 'addCounters', n: 1, to: 'target' }] }] });
  const withoutPing = (colors: ScorableCardDef['colors']) => ({ ...source(colors), abilities: [{ when: 'spell' as const, targets: [YOURS], ops: [{ op: 'addCounters' as const, n: 1, to: 'target' as const }] }] });
  // A measured gate: white inside R27's 0.5 to 1.0; red inside the Stampede's 0 to 0.3.
  it('adds a white source\'s measured rate and nothing on a red one, and is never priced as burn', () => {
    const white = power(source(['W'])) - power(withoutPing(['W']));
    expect(white).toBeGreaterThanOrEqual(0.5);
    expect(white).toBeLessThanOrEqual(1.0);
    expect(power(source(['R'])) - power(withoutPing(['R']))).toBeCloseTo(0, 6);
  });

  // The damage op reads its own target slot, not the ability's first.
  it('prices damage by the slot it aims at: an opponent\'s creature in slot 1 is removal, your own in slot 1 a source', () => {
    const twoSlots = (colors: ScorableCardDef['colors'], targets: TargetSpec[], ops: EffectOp[]): ScorableCardDef =>
      spell('ritual', 2, [], { colors, abilities: [{ when: 'spell', targets, ops }] });
    const mark: EffectOp = { op: 'addCounters', n: 1, to: 'target' };
    const burn: EffectOp = { op: 'damage', n: 3, to: 'target', targetIndex: 1 };
    const removal = power(twoSlots(['R'], [YOURS, PREY], [mark, burn])) - power(twoSlots(['R'], [YOURS, PREY], [mark]));
    expect(removal).toBeGreaterThan(1); // 3 damage to a creature is 1.7
    const ping: EffectOp = { op: 'damage', n: 1, to: 'target', targetIndex: 1 };
    const tap: EffectOp = { op: 'tap', to: 'target' };
    const withPing = twoSlots(['W'], [PREY, YOURS], [tap, ping]);
    const source = power(withPing) - power(twoSlots(['W'], [PREY, YOURS], [tap]));
    expect(source).toBeGreaterThanOrEqual(0.5);
    expect(source).toBeLessThanOrEqual(1.0);
    expect(scoreCard(withPing).parts.some((part) => /burn/.test(part.label))).toBe(false);
  });

  it('counts damage to your own creature inside an If-marked branch as a source', () => {
    const branch: EffectOp = { op: 'ifTargetMarked', then: [{ op: 'damage', n: 1, to: 'target' }] };
    const card = spell('charm', 1, [], { colors: ['W'], abilities: [{ when: 'spell', targets: [YOURS], ops: [branch] }] });
    expect(scoreCard(card).parts.some((part) => part.label.includes('Provoked source'))).toBe(true);
  });
});

// Measured gates: each fitted value inside the lab's 95% interval (pooled MEP;
// balance/study/lab/fd/first-dawn-findings.md §0, §3, §4, §5). Rows the fit
// deliberately does not follow are listed in the As built section, not here.
describe('the measured anchors (A1.3 lab, 95% intervals)', () => {
  const hunter = (a: number, d: number) => adds(creature(a, d, { abilities: [arrivalHunt] }), { abilities: undefined });
  const cases: [string, () => number, number, number][] = [
    ['arrival Hunt 2/2', () => hunter(2, 2), -0.15, 0.39],
    ['arrival Hunt 3/3', () => hunter(3, 3), 2.18, 2.92],
    ['arrival Hunt 4/4', () => hunter(4, 4), 2.84, 3.68],
    ['arrival Hunt 5/5', () => hunter(5, 5), 3.15, 3.99],
    ['arrival Hunt 3/1', () => hunter(3, 1), 0.74, 1.35],
    ['arrival Hunt 3/2', () => hunter(3, 2), 0.87, 1.44],
    ['arrival Hunt 3/4', () => hunter(3, 4), 2.82, 3.84],
    ['arrival Hunt 3/5', () => hunter(3, 5), 3.00, 4.03],
    // Spear-Thrower 4/2 is read on its fair surcharge (2 mana or more, censored): at least 2, at most its own-curve reading.
    ['Spear-Thrower 4/2', () => hunter(4, 2), 2.0, 2.48],
    ['Kesh 3/2, attack Hunt', () => adds(creature(3, 2, { keywords: ['warcry'], abilities: [{ when: 'attacks', targets: [PREY], ops: [HUNT] }] }), { abilities: undefined }), 0.69, 1.26],
    ['Korru 4/5, Duty {1}{G} Hunt', () => adds(creature(4, 5, { activated: { cost: { tap: true, mana: { generic: 2, pips: {} } }, targets: [{ what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] } }), { activated: undefined }), 1.47, 2.10],
    ['Tracker 2/4, Duty {2}{G} Hunt', () => adds(creature(2, 4, { keywords: ['wardingGaze'], activated: { cost: { tap: true, mana: { generic: 3, pips: {} } }, targets: [{ what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] } }), { activated: undefined }), 0.45, 0.91],
    ['Provoked, Vessa 5/6 (Mark each other creature you control)', () => adds(creature(5, 6, { abilities: [provoked([{ op: 'markAll', scope: 'yourCreatures', other: true }])] }), { abilities: undefined }), 0.23, 0.71],
    ['Provoked, Mother 4/7 (a 1/1 and a Mark)', () => adds(creature(4, 7, { abilities: [provoked([hatch(1), { op: 'addCounters', n: 1, to: 'target' }], [YOURS])] }), { abilities: undefined }), 0.24, 0.65],
    ['Provoked, Fern-Back Grazer 1/4 (Mark this)', () => adds(creature(1, 4, { abilities: [provoked([{ op: 'addCounters', n: 1, to: 'self' }])] }), { abilities: undefined }), -0.26, 0.17],
    // The plain ritual's arms carry no interval in §5; the spell arms' is about +-1.5 pp (+-0.3).
    ['Plain Hunt ritual at mana value 2, against a vanilla 2/2 (measured -0.04)', () => power(spell('ritual', 2, [{ op: 'hunt', hunter: 'target' }])) - bodyValue(2, 2), -0.34, 0.26],
    ['Fang and Horn (+2/+2 Charm, mana value 3), against a vanilla 3/3', () => power(spell('charm', 3, [{ op: 'boost', p: 2, t: 2, scope: 'target' }, { op: 'hunt', hunter: 'target' }])) - bodyValue(3, 3), 0.68, 1.23],
  ];
  it.each(cases)('%s', (_name, fitted, low, high) => {
    const v = fitted();
    expect(v).toBeGreaterThanOrEqual(low);
    expect(v).toBeLessThanOrEqual(high);
  });

  it('prices every Hunt and Provoked shape with no unknown vocabulary', () => {
    const cards = [creature(3, 3, { abilities: [arrivalHunt, provoked([hatch(1)])] }), spell('ritual', 2, [{ op: 'hunt', hunter: 'target' }]),
      creature(2, 3, { abilities: [{ when: 'arrives', ops: [{ op: 'damage', n: 1, to: 'eachYourCreature', other: true }] }] })];
    expect(cards.flatMap((card) => scoreCard(card).unknowns)).toEqual([]);
  });
});

// A1.4b: the A1.1c re-run (balance/study/lab/fd/first-dawn-findings-a11c.md,
// local-only). Its in-deck rows are 2-of readings in the Dinokin decks, a
// smaller frame than the starter holes the Hunt step is fitted in, so each is
// compared through the one unconditional hunter read in the same kind of deck:
// Frill-Neck Stalker (a 4/4 Dinokin, arrival Hunt) at 0.98 in R28.
describe('the conditional arrival Hunt, gated on the hunter\'s own tribe (A1.1c re-run)', () => {
  const ifAnother = (subtype: string): AbilityDef => ({ ...arrivalHunt, condition: { kind: 'controlsOther', subtype } });
  const dinokin = (attack: number, defense: number, abilities: AbilityDef[], extra: Partial<ScorableCardDef> = {}) =>
    creature(attack, defense, { subtypes: ['Dinokin', 'Raptor'], abilities, ...extra });
  const huntAdds = (card: ScorableCardDef) => adds(card, { abilities: undefined });
  const frillNeckInDeck = 0.98;
  const inDeck = (card: ScorableCardDef) => huntAdds(card) * (frillNeckInDeck / huntAdds(dinokin(4, 4, [arrivalHunt])));

  // Measured gates: the fitted in-deck value inside each row's 95% interval.
  const cases: [string, ScorableCardDef, number, number][] = [
    ['Fern-and-Fire Raptor 3/3 Warcry, in the Stampede (0.85)', dinokin(3, 3, [ifAnother('Dinokin')], { keywords: ['warcry'] }), 0.58, 1.08],
    ['Fern-Shadow Stalker 3/4, in the Stampede (0.83)', dinokin(3, 4, [ifAnother('Dinokin')]), 0.58, 1.17],
    ['Crag-Leaper 4/3 Warcry, in the Stampede (0.77)', dinokin(4, 3, [ifAnother('Dinokin')], { keywords: ['warcry'] }), 0.49, 1.11],
  ];
  it.each(cases)('%s', (_name, card, low, high) => {
    const v = inDeck(card);
    expect(v).toBeGreaterThanOrEqual(low);
    expect(v).toBeLessThanOrEqual(high);
  });

  it('keeps less than the same Hunt without its condition', () => {
    const shadow = (abilities: AbilityDef[]) => huntAdds(dinokin(3, 4, abilities));
    expect(shadow([ifAnother('Dinokin')])).toBeLessThan(shadow([arrivalHunt]));
  });

  it('marks a Hunt gated on another type an estimate, and its own tribe\'s as measured', () => {
    const huntLabel = (card: ScorableCardDef) => scoreCard(card).parts.find((part) => part.label.includes('hunt'))?.label;
    expect(huntLabel(dinokin(3, 4, [ifAnother('Dinokin')]))).not.toMatch(/NEEDS MATH/);
    // Off its tribe the lab read about 0.2 of the unconditional Hunt.
    expect(huntLabel(dinokin(3, 4, [ifAnother('Beastkin')]))).toMatch(/NEEDS MATH/);
  });

  it('leaves the standing gate on a tribal ability that does not hunt', () => {
    // The shared controlsOther gate prices shipped cards; only the Hunt was measured.
    const gain = (condition?: AbilityDef['condition']): ScorableCardDef =>
      dinokin(3, 4, [{ when: 'arrives', ops: [{ op: 'gainLife', n: 3 }], ...(condition ? { condition } : {}) }]);
    const gainPart = (card: ScorableCardDef) => scoreCard(card).parts.find((part) => part.label.startsWith('arrives:gain'))?.v ?? NaN;
    expect(gainPart(gain({ kind: 'controlsOther', subtype: 'Dinokin' }))).toBeCloseTo(0.6 * gainPart(gain()), 6);
  });
});

// A1.4b: Vyra's pump, the same re-run. Vyra as printed against Vyra without the
// pump, in the Crimson and Tides holes: 0.83 MEP [0.66, 0.98].
describe('the repeatable mana pump (A1.1c re-run)', () => {
  const firebreath = (p = 1, pips: ManaCost['pips'] = { R: 1 }) => ({ cost: { generic: 0, pips }, ops: [{ op: 'boost' as const, p, t: 0, scope: 'self' as const }] });
  const vyra = (extra: Partial<ScorableCardDef> = {}): ScorableCardDef => ({
    id: 'lab-vyra', name: 'Lab Vyra', types: ['creature'], subtypes: ['Human', 'Rider'], colors: ['R'], cost: { generic: 4, pips: { R: 2 } },
    attack: 5, defense: 5, keywords: ['skyborne'], rarity: 'ur', manaActivated: [firebreath()], ...extra,
  });
  const pumpLabel = (card: ScorableCardDef) => scoreCard(card).parts.find((part) => part.label.includes('mana pump'))?.label;

  it('prices Vyra\'s pump inside its measured interval', () => {
    const v = adds(vyra(), { manaActivated: undefined });
    expect(v).toBeGreaterThanOrEqual(0.66);
    expect(v).toBeLessThanOrEqual(0.98);
  });

  it('marks the measured shape as measured and every other shape an estimate', () => {
    expect(pumpLabel(vyra())).not.toMatch(/NEEDS MATH/);
    expect(pumpLabel(vyra({ keywords: [] }))).toMatch(/NEEDS MATH/); // no Skyborne
    expect(pumpLabel(vyra({ manaActivated: [firebreath(2)] }))).toMatch(/NEEDS MATH/); // +2/+0
    expect(pumpLabel(vyra({ manaActivated: [firebreath(1, { R: 2 })] }))).toMatch(/NEEDS MATH/); // two mana
    expect(scoreCard(vyra()).unknowns).toEqual([]);
  });
});
