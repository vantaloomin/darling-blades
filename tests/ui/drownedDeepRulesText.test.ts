import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { cardMechanics } from '../../src/data/glossary';
import type { AbilityDef, CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { activatedText, rulesText } from '../../src/ui/rulesText';

function card(fields: Partial<CardDef> = {}): CardDef {
  return { id: 'dd-vocabulary-text-fixture', name: 'Vocabulary fixture', types: ['ritual'], subtypes: [], colors: [], rarity: 'c', ...fields };
}

function spell(ops: EffectOp[], targets?: TargetSpec[]): CardDef {
  return card({ abilities: [{ when: 'spell', targets, ops }] });
}

describe('Drowned Deep vocabulary rules text', () => {
  it('keeps all 1,259 shipped card texts byte-identical', () => {
    expect(ALL_CARDS).toHaveLength(1259);
    const rows = ALL_CARDS.map((definition) => [definition.id, rulesText(definition)]);
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '4f66abb01950ed0296e456d017f080cd8c7d6ff8116660398f56f51fd3c67cfd',
    );
  });

  it.each([
    { ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }], text: 'Draw a card, then discard a card.' },
    { ops: [{ op: 'discard', n: 2, who: 'self' }], text: 'Discard 2 cards.' },
    { ops: [{ op: 'tapAll', who: 'opponent' }], text: 'Tap all creatures an opponent controls.' },
    { ops: [{ op: 'sacrifice', who: 'opponent', n: 1 }], text: 'Opponent sacrifices a creature.' },
    { ops: [{ op: 'sacrifice', who: 'each', n: 1 }], text: 'Each player sacrifices a creature.' },
    { ops: [{ op: 'preventCombatTo', to: 'target' }], text: 'Prevent combat damage to target creature this turn.' },
    { ops: [{ op: 'reclaimSelf' }], text: 'Return this to your hand.' },
    { ops: [{ op: 'damage', n: 1, to: 'eachOpponentCreature' }], text: 'Deal 1 damage to each creature an opponent controls.' },
    { ops: [{ op: 'markAll', scope: 'yourCreatures', other: true }], text: 'Mark each other creature you control.' },
    { ops: [{ op: 'boost', scope: 'self', p: 1, t: 0 }], text: 'This gets +1/+0 until Sunset.' },
  ] satisfies { ops: EffectOp[]; text: string }[])('renders $text', ({ ops, text }) => {
    expect(rulesText(spell(ops))).toBe(text);
    expect(text).not.toContain('\u2014');
  });

  it.each([
    { spec: { what: 'creature', maxCost: 2 }, op: { op: 'destroy', to: 'target' }, text: 'Destroy target creature with cost 2 or less.' },
    { spec: { what: 'creature', minAttack: 4 }, op: { op: 'destroy', to: 'target' }, text: 'Destroy target creature with attack 4 or more.' },
    { spec: { what: 'creature', maxCost: 3, minAttack: 4 }, op: { op: 'sever', to: 'target' }, text: 'Sever target creature with cost 3 or less and attack 4 or more.' },
    { spec: { what: 'creature', exactly: 2 }, op: { op: 'tap', to: 'target' }, text: 'Tap two target creatures.' },
    { spec: { what: 'opponentCreature' }, op: { op: 'tap', to: 'target' }, text: 'Tap target creature an opponent controls.' },
    { spec: { what: 'opponentCreature', maxCost: 2 }, op: { op: 'damage', n: 1, to: 'target' }, text: 'Deal 1 damage to target creature an opponent controls with cost 2 or less.' },
    { spec: { what: 'spell', maxCost: 2 }, op: { op: 'cancel', to: 'target' }, text: 'Cancel target spell with cost 2 or less.' },
    { spec: { what: 'yourGraveCreature', maxCost: 2 }, op: { op: 'reclaim' }, text: 'Return target creature card with cost 2 or less from your graveyard to your hand.' },
    { spec: { what: 'yourGraveCreature', maxCost: 2 }, op: { op: 'raise', to: 'target' }, text: 'Return target creature card with cost 2 or less from your graveyard to play.' },
  ] satisfies { spec: TargetSpec; op: EffectOp; text: string }[])('renders target restriction: $text', ({ spec, op, text }) => {
    expect(rulesText(spell([op], [spec]))).toBe(text);
  });

  it.each([
    { ability: { when: 'allyDies' }, head: 'Whenever a creature you control dies' },
    { ability: { when: 'allyDies', filter: { other: true } }, head: 'Whenever another creature you control dies' },
    { ability: { when: 'allyDies', filter: { other: true, subtype: 'Horror' } }, head: 'Whenever another Horror you control dies' },
    { ability: { when: 'allyDies', filter: { sacrifice: true } }, head: 'Whenever you sacrifice a creature' },
    { ability: { when: 'youGainLife' }, head: 'Whenever you gain life' },
    { ability: { when: 'youCastCharm' }, head: 'Whenever you cast a Charm' },
    { ability: { when: 'allyAttacks' }, head: 'Whenever a creature you control attacks' },
    { ability: { when: 'sunset' }, head: 'At Sunset' },
  ] satisfies { ability: AbilityDef; head: string }[])('renders trigger head $head', ({ ability, head }) => {
    expect(rulesText(card({ abilities: [{ ...ability, ops: [{ op: 'gainLife', n: 1 }] }] }))).toBe(`${head}, you gain 1 life.`);
  });

  it('renders a died-this-turn Sunset condition in the trigger sentence', () => {
    expect(rulesText(card({ abilities: [{ when: 'sunset', condition: 'creatureDiedThisTurn', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }] })))
      .toBe('At Sunset, if a creature died this turn, this deals 1 damage to your opponent.');
  });

  it('renders the controlsOther subtype condition at Dawn', () => {
    expect(rulesText(card({ abilities: [{ when: 'dawn', condition: { kind: 'controlsOther', subtype: 'Horror' }, ops: [{ op: 'loseLife', who: 'opponent', n: 2 }] }] })))
      .toBe('During your Dawn: If you control another Horror, your opponent loses 2 life.');
  });

  it('names independent target slots independently and reuses a slot only after naming it', () => {
    const definition = spell([
      { op: 'reclaim', targetIndex: 0 },
      { op: 'addCounters', to: 'target', n: 1, targetIndex: 1 },
      { op: 'damage', to: 'target', n: 1, targetIndex: 1 },
    ], [{ what: 'yourGraveCreature' }, { what: 'yourCreature' }]);
    expect(rulesText(definition)).toBe('Return target creature card from your graveyard to your hand, then Mark target creature you control, then deal 1 damage to that creature.');
  });

  it('keeps explicit target bindings inside conditional branches and plural agreement for pairs', () => {
    expect(rulesText(spell([
      { op: 'ifTargetMarked', then: [{ op: 'destroy', to: 'target', targetIndex: 1 }] },
    ], [{ what: 'yourCreature' }, { what: 'opponentCreature', maxCost: 2 }]))).toBe('If it is Marked, destroy target creature an opponent controls with cost 2 or less.');
    expect(rulesText(spell([
      { op: 'boost', p: 1, t: 1, scope: 'target', keywords: ['dreaded'] },
      { op: 'tap', to: 'target' },
    ], [{ what: 'creature', exactly: 2 }]))).toBe('Two target creatures get +1/+1 and gain Dreaded until Sunset, then tap those creatures.');
  });

  it('renders targeted attack and Dawn abilities with their chosen target', () => {
    expect(rulesText(card({ abilities: [
      { when: 'attacks', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] },
      { when: 'dawn', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] },
    ] }))).toBe('Whenever this attacks, deal 1 damage to target creature.\nDuring your Dawn, Mark target creature you control.');
  });

  it('renders each Duty on its own line and detects mechanics across both lists and branches', () => {
    const definition = card({ types: ['artifact'], activated: [
      { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
      { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }] },
    ] });
    expect(activatedText(definition)).toBe('{T}: Foresee 2.\n{T}, {2}: Draw a card, then discard a card.');
    expect(rulesText(definition)).toBe(activatedText(definition));
    expect(cardMechanics(definition)).toEqual(expect.arrayContaining(['duty', 'foresee']));
    definition.activated = [
      { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
      { cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'ifTargetMarked', then: [], else: [{ op: 'foresee', n: 1 }, { op: 'sever', to: 'target' }] }] },
    ];
    expect(cardMechanics(definition)).toEqual(expect.arrayContaining(['duty', 'foresee', 'sever']));
  });

  it('renders token Marks, durable raise grants, and token-only statics', () => {
    expect(rulesText(spell([{ op: 'createToken', token: 'tok-militia', count: 1, marks: 1 }]))).toBe('Create one 1/1 Volunteer Militia token and put a Mark on it.');
    expect(rulesText(spell([{ op: 'raise', to: 'target', grantKeywords: ['dreaded'] }], [{ what: 'yourGraveCreature' }]))).toBe('Return target creature card from your graveyard to the battlefield. It has Dreaded.');
    expect(rulesText(card({ abilities: [{ when: 'static', static: { scope: 'filter', filter: { token: true, subtype: 'Plant' }, p: 1, t: 1 } }] }))).toBe('Plant tokens you control get +1/+1.');
  });

  it('renders targeted Empower destruction and a creature Retell override', () => {
    expect(rulesText(card({ empower: { cost: { generic: 2, pips: {} }, targets: [{ what: 'creature', maxCost: 3 }], ops: [{ op: 'destroy', to: 'target' }] } })))
      .toBe('Empower {2}: Destroy target creature with cost 3 or less.');
    expect(rulesText(card({ types: ['creature'], retell: { cost: { generic: 2, pips: { R: 1 } }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] } })))
      .toBe('Retell {2}{R}: Deal 2 damage to target creature.');
  });
});
