import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deckTargetSupply, hasNoLegalTargets } from '../../scripts/avatarReserveDecks';
import { cardEffectOps, cardRoles, rateCard } from '../../scripts/personas/score';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import type { ActivatedDef, CardDb, CardDef, TargetSpec } from '../../src/engine/types';

function card(id: string, fields: Partial<CardDef> = {}): CardDef {
  return { id, name: id, types: ['artifact'], subtypes: [], colors: [], cost: { generic: 2, pips: {} }, rarity: 'c', ...fields };
}

function dbFor(...cards: CardDef[]): CardDb {
  return { ...CARD_DB, ...Object.fromEntries(cards.map((definition) => [definition.id, definition])) };
}

function answer(target: TargetSpec): CardDef {
  return card('dd-qualified-answer', { types: ['charm'], abilities: [{ when: 'spell', targets: [target], ops: [{ op: 'tap', to: 'target' }] }] });
}

describe('Drowned Deep converter compatibility', () => {
  it('walks every Duty for token supply while preserving category iteration', () => {
    const token = card('dd-fixture-token', { token: true });
    const carrier = card('dd-fixture-maker', { types: ['creature'], activated: [
      { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
      { cost: { tap: true }, ops: [{ op: 'createToken', token: token.id, count: 1 }] },
    ] });
    expect([...deckTargetSupply([carrier.id], dbFor(token, carrier))]).toEqual(['artifact', 'artifactOrEnchantment']);
  });

  it('walks later Duty targets and nested mark-producing branches', () => {
    const carrier = card('dd-fixture-marker', { types: ['creature'], activated: [
      { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
      { cost: { tap: true }, targets: [{ what: 'yourCreature' }], ops: [{ op: 'ifTargetMarked', then: [], else: [{ op: 'addCounters', n: 1, to: 'target' }] }] },
    ] });
    const removal = card('dd-fixture-answer', { types: ['creature'], activated: [
      { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
      { cost: { tap: true }, targets: [{ what: 'creature', marked: true }], ops: [{ op: 'sever', to: 'target' }] },
    ] });
    const db = dbFor(carrier, removal);
    expect(hasNoLegalTargets(removal, deckTargetSupply([removal.id], db))).toBe(true);
    expect(hasNoLegalTargets(removal, deckTargetSupply([removal.id, carrier.id], db))).toBe(false);
  });

  it.each(['creature', 'opponentCreature', 'yourGraveCreature', 'spell'] as const)('measures maxCost on %s against the supplied card costs', (what) => {
    const removal = answer({ what, maxCost: 2 });
    const small = card('dd-small', { types: ['creature'], attack: 2, defense: 2 });
    const large = card('dd-large', { types: ['creature'], attack: 6, defense: 6, cost: { generic: 5, pips: {} } });
    const db = dbFor(removal, small, large);
    expect(hasNoLegalTargets(removal, deckTargetSupply([large.id], db))).toBe(true);
    expect(hasNoLegalTargets(removal, deckTargetSupply([large.id, small.id], db))).toBe(false);
  });

  it('requires the same supply candidate to meet cost and attack qualifiers', () => {
    const removal = answer({ what: 'opponentCreature', maxCost: 2, minAttack: 4 });
    const cheap = card('dd-cheap', { types: ['creature'], attack: 2, defense: 2 });
    const strong = card('dd-strong', { types: ['creature'], attack: 5, defense: 5, cost: { generic: 5, pips: {} } });
    const both = card('dd-both', { types: ['creature'], attack: 4, defense: 1 });
    const db = dbFor(removal, cheap, strong, both);
    expect(hasNoLegalTargets(removal, deckTargetSupply([cheap.id, strong.id], db))).toBe(true);
    expect(hasNoLegalTargets(removal, deckTargetSupply([cheap.id, both.id], db))).toBe(false);
  });

  it('requires two matching copies for exactly two and preserves deterministic supply', () => {
    const removal = answer({ what: 'creature', exactly: 2, minAttack: 4 });
    const creature = card('dd-pair', { types: ['creature'], attack: 4, defense: 2 });
    const db = dbFor(removal, creature);
    expect(hasNoLegalTargets(removal, deckTargetSupply([creature.id], db))).toBe(true);
    const first = deckTargetSupply([creature.id, creature.id], db);
    const second = deckTargetSupply([creature.id, creature.id], db);
    expect([...second]).toEqual([...first]);
    expect(hasNoLegalTargets(removal, first)).toBe(false);
    expect(hasNoLegalTargets(removal, second)).toBe(false);
  });

  it('counts each minted token and its initial Marks but never supplies a graveyard with tokens', () => {
    const token = card('dd-fixture-marked-token', { types: ['creature'], token: true, attack: 2, defense: 2, cost: undefined });
    const maker = card('dd-fixture-two-tokens', { types: ['ritual'], abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: token.id, count: 2, marks: 1 }] }] });
    const db = dbFor(token, maker);
    const supply = deckTargetSupply([maker.id], db);
    expect(supply.has('marked')).toBe(true);
    expect(hasNoLegalTargets(answer({ what: 'creature', marked: true, minAttack: 3, exactly: 2 }), supply)).toBe(false);
    expect(hasNoLegalTargets(answer({ what: 'yourGraveCreature', maxCost: 0 }), supply)).toBe(true);
  });

  it('does not add mutually exclusive token branches together to supply a mandatory pair', () => {
    const token = card('dd-branch-token', { types: ['creature'], token: true, attack: 2, defense: 2 });
    const maker = card('dd-branched-maker', { types: ['ritual'], abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{
      op: 'ifTargetMarked',
      then: [{ op: 'createToken', token: token.id, count: 1 }],
      else: [{ op: 'createToken', token: token.id, count: 1 }],
    }] }] });
    const db = dbFor(token, maker);
    expect(hasNoLegalTargets(answer({ what: 'creature', exactly: 2 }), deckTargetSupply([maker.id], db))).toBe(true);
    expect(hasNoLegalTargets(answer({ what: 'creature', exactly: 2 }), deckTargetSupply([maker.id, maker.id], db))).toBe(false);
  });
});

describe('Drowned Deep persona scorer compatibility', () => {
  it('keeps all 1,259 shipped persona rates byte-identical', () => {
    const shipped = ALL_CARDS.filter((definition) => definition.set !== 'drowned-deep');
    expect(shipped).toHaveLength(1259);
    const rows = shipped.map((definition) => [definition.id, rateCard(definition)]);
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '19595ef09acaac1bff9d0944b9edde43cfdd110aaf878e6e0da236dbb47d1066',
    );
  });

  it('pins the 252 Drowned Deep persona scores', () => {
    // Drowned Deep PR 3b (2026-09-15): transcription baseline.
    const drownedDeep = ALL_CARDS.filter((definition) => definition.set === 'drowned-deep' && !definition.token);
    expect(drownedDeep).toHaveLength(252);
    const rows = drownedDeep.map((definition) => [definition.id, rateCard(definition)]);
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '4f47c0d833141ee814628508f09290ade6c93df7df2a990f50ebe05b95c2b217',
    );
  });

  it('reads every activation and discounts each activation cost once', () => {
    const draw: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] };
    const damage: ActivatedDef = { cost: { tap: true, mana: { generic: 2, pips: {} } }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] };
    const plain = card('dd-plain');
    const definition = card('dd-multiple', { activated: [draw, damage] });
    expect(cardEffectOps(definition).map((op) => op.op)).toEqual(['draw', 'damage']);
    expect(cardRoles(definition)).toEqual(expect.arrayContaining(['draw', 'removal']));
    expect(rateCard(definition)).toBeCloseTo(rateCard(card('dd-draw', { activated: draw })) + rateCard(card('dd-damage', { activated: damage })) - rateCard(plain));
  });

  it('counts a later activation target bonus and flattens both branches', () => {
    const definition = card('dd-branched', { activated: [
      { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
      { cost: { tap: true }, targets: [{ what: 'creature', marked: true }, { what: 'yourCreature' }], ops: [{ op: 'moveMark' }] },
    ] });
    const single = card('dd-single', { activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] } });
    expect(rateCard(definition) - rateCard(single)).toBeCloseTo(3 * 0.8 / 2 + 0.1);
    definition.activated = [{ cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'ifTargetMarked', then: [{ op: 'draw', n: 1 }], else: [{ op: 'damage', n: 1, to: 'target' }] }] }];
    expect(cardEffectOps(definition).map((op) => op.op)).toEqual(['ifTargetMarked', 'draw', 'damage']);
  });
});
