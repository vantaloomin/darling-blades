import { describe, expect, it } from 'vitest';
import { convertAvatarWarchest, deckTargetSupply, hasNoLegalTargets } from '../../scripts/avatarReserveDecks';
import { CARD_DB } from '../../src/data/catalog';
import { validateA16Def, validateHuntDef, type AbilityDef, type CardDb, type CardDef, type TargetSpec } from '../../src/engine/types';

// Fixture cards only: First Dawn's rows are not transcribed yet, and no shipped
// card hunts or names an attacking target.
function card(id: string, fields: Partial<CardDef> = {}): CardDef {
  return { id, name: id, types: ['creature'], subtypes: [], colors: ['R'], cost: { generic: 1, pips: { R: 1 } }, rarity: 'c', ...fields };
}
const body = (id: string, attack: number, defense: number, fields: Partial<CardDef> = {}): CardDef =>
  card(id, { attack, defense, ...fields });
const spell = (id: string, targets: TargetSpec[], ops: AbilityDef['ops']): CardDef =>
  card(id, { types: ['charm'], abilities: [{ when: 'spell', targets, ops }] });

const bear = body('fd-fixture-bear', 2, 2);
const foe = body('fd-fixture-foe', 2, 2);
const wall = body('fd-fixture-wall', 0, 4, { keywords: ['bulwark'] });
const brute = body('fd-fixture-brute', 5, 5);
const bigWall = body('fd-fixture-big-wall', 5, 5, { keywords: ['bulwark'] });
const ritual = card('fd-fixture-ritual', { types: ['ritual'], abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }] }] });

const OPP: TargetSpec = { what: 'opponentCreature' };
const stalk = spell('fd-fixture-stalk', [{ what: 'yourCreature' }, OPP], [{ op: 'hunt', hunter: 'target' }]);
const stalkAny = spell('fd-fixture-stalk-any', [{ what: 'yourCreature' }, { what: 'creature', other: true }], [{ op: 'hunt', hunter: 'target', prey: 'any' }]);
const stalkYours = spell('fd-fixture-stalk-yours', [{ what: 'yourCreature' }, { what: 'yourCreature', other: true }], [{ op: 'hunt', hunter: 'target', prey: 'yours' }]);
const raptor = body('fd-fixture-raptor', 3, 3, { abilities: [{ when: 'arrives', targets: [OPP], ops: [{ op: 'hunt', hunter: 'self' }] }] });
const fernRaptor = body('fd-fixture-fern-raptor', 3, 3, { subtypes: ['Dinokin'], abilities: [{
  when: 'arrives', condition: { kind: 'controlsOther', subtype: 'Dinokin' }, targets: [OPP], ops: [{ op: 'hunt', hunter: 'self' }],
}] });
const kesh = body('fd-fixture-kesh', 3, 3, { abilities: [{ when: 'attacks', targets: [OPP], ops: [{ op: 'hunt', hunter: 'self' }] }] });
const tracker = body('fd-fixture-tracker', 2, 4, { activated: { cost: { tap: true }, targets: [OPP], ops: [{ op: 'hunt', hunter: 'self' }] } });
const packHunter = body('fd-fixture-pack-hunter', 3, 3, { abilities: [{
  when: 'arrives', targets: [{ what: 'yourCreature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'yours' }],
}] });
const korru = body('fd-fixture-korru', 3, 3, { abilities: [{
  when: 'arrives', targets: [{ what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }],
}] });
const verdict = spell('fd-fixture-verdict', [{ what: 'creature', attacking: true }], [{ op: 'sever', to: 'target' }]);
const bringDown = spell('fd-fixture-bring-down', [{ what: 'creature', attacking: true, minAttack: 4 }], [{ op: 'destroy', to: 'target' }]);

const FIXTURES = [bear, foe, wall, brute, bigWall, ritual, stalk, stalkAny, stalkYours, raptor, fernRaptor, kesh, tracker, packHunter, korru, verdict, bringDown];
const DB: CardDb = { ...CARD_DB, ...Object.fromEntries(FIXTURES.map((fixture) => [fixture.id, fixture])) };

/** Dead in a format where `own` is the list and `opponents` what it plays against. */
const dead = (subject: CardDef, own: CardDef[], opponents: CardDef[]): boolean =>
  hasNoLegalTargets(subject, deckTargetSupply(own.map((c) => c.id), DB, opponents.map((c) => c.id)));

describe('First Dawn converter compatibility: the Hunt target walk', () => {
  it('builds every fixture as the engine validators accept it', () => {
    for (const fixture of FIXTURES) {
      expect(validateHuntDef(fixture), fixture.id).toEqual([]);
      expect(validateA16Def(fixture), fixture.id).toEqual([]);
    }
  });

  it('holds a Hunt spell dead until its own list has a creature without Bulwark to hunt with', () => {
    expect(dead(stalk, [stalk, wall], [foe])).toBe(true);
    // An opponent's creature is prey, never the hunter.
    expect(dead(stalk, [stalk], [bear, foe])).toBe(true);
    expect(dead(stalk, [stalk, wall, bear], [foe])).toBe(false);
  });

  it.each([
    ['a Hunt spell', stalk],
    ['an arrival hunter (it cannot be cast without prey)', raptor],
    ['a conditional arrival hunter (cast without prey it never hunts)', fernRaptor],
    ['an attack Hunt', kesh],
    ['a Duty Hunt', tracker],
  ])('holds %s dead without a creature an opponent controls, and takes a Bulwark one as prey', (_label, hunter) => {
    // Her own creatures are never the generic Hunt's prey.
    expect(dead(hunter, [hunter, bear, brute], [ritual])).toBe(true);
    expect(dead(hunter, [hunter, bear], [foe])).toBe(false);
    expect(dead(hunter, [hunter, bear], [wall])).toBe(false);
  });

  it('reads a card that declares yours: another creature of your own, a second copy included', () => {
    expect(dead(packHunter, [packHunter], [foe])).toBe(true);
    expect(dead(packHunter, [packHunter, packHunter], [ritual])).toBe(false);
    expect(dead(packHunter, [packHunter, wall], [ritual])).toBe(false);
    // The spell form needs two different creatures of yours, one able to hunt.
    expect(dead(stalkYours, [stalkYours, bear], [foe])).toBe(true);
    expect(dead(stalkYours, [stalkYours, wall, wall], [foe])).toBe(true);
    expect(dead(stalkYours, [stalkYours, bear, wall], [ritual])).toBe(false);
  });

  it('reads a card that declares any: prey on either side', () => {
    expect(dead(korru, [korru], [ritual])).toBe(true);
    expect(dead(korru, [korru], [foe])).toBe(false);
    expect(dead(korru, [korru, bear], [ritual])).toBe(false);
    expect(dead(stalkAny, [stalkAny, bear], [ritual])).toBe(true);
    expect(dead(stalkAny, [stalkAny, bear], [foe])).toBe(false);
    expect(dead(stalkAny, [stalkAny, bear, wall], [ritual])).toBe(false);
  });

  it('holds an attacking-only answer dead only where nothing it can reach could attack', () => {
    expect(dead(verdict, [verdict], [wall])).toBe(true);
    expect(dead(verdict, [verdict], [foe])).toBe(false);
    // The same creature must attack and meet the Attack floor.
    expect(dead(bringDown, [bringDown], [foe, bigWall])).toBe(true);
    expect(dead(bringDown, [bringDown], [brute])).toBe(false);
  });

  it('supplies a token minted in either branch of If it survived', () => {
    const token = card('fd-fixture-artifact-token', { types: ['artifact'], token: true, colors: [], cost: undefined });
    const answer = spell('fd-fixture-artifact-answer', [{ what: 'artifact' }], [{ op: 'sever', to: 'target' }]);
    for (const branch of ['then', 'else'] as const) {
      const mint = [{ op: 'createToken' as const, token: token.id, count: 1 }];
      const ambush = spell(`fd-fixture-ambush-${branch}`, [{ what: 'yourCreature' }], [
        { op: 'damage', n: 1, to: 'target' },
        { op: 'ifTargetSurvives', then: branch === 'then' ? mint : [], else: branch === 'else' ? mint : [] },
      ]);
      const db = { ...DB, [token.id]: token, [answer.id]: answer, [ambush.id]: ambush };
      expect(hasNoLegalTargets(answer, deckTargetSupply([answer.id], db)), branch).toBe(true);
      expect(hasNoLegalTargets(answer, deckTargetSupply([answer.id, ambush.id], db)), branch).toBe(false);
    }
  });

  it('keeps a Hunt spell out of a Warchest build whose own creatures all have Bulwark, whatever the starters hold', () => {
    const avatar = (creature: CardDef) => ({
      id: 'fd-fixture-avatar',
      name: 'Fixture Avatar',
      deck: [
        ...Array.from({ length: 4 }, () => creature.id),
        ...Array.from({ length: 4 }, () => stalk.id),
        ...Array.from({ length: 52 }, () => 'land-mountain'),
      ],
    });
    // The five starter columns hold plenty of creatures without Bulwark, but
    // none of them is hers to hunt with.
    expect(convertAvatarWarchest(avatar(wall), DB)).not.toContain(stalk.id);
    expect(convertAvatarWarchest(avatar(bear), DB)).toContain(stalk.id);
  });
});
