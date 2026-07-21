import { describe, expect, it } from 'vitest';
import { blockOptions, validateBlocks } from '../../src/engine/combat/legality';
import { Game } from '../../src/engine/Game';
import { combineManaCosts } from '../../src/engine/mana';
import { rulesText } from '../../src/ui/rulesText';
import type { CardDb, CombatState, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  dreaded: {
    ...TEST_DB.bear,
    id: 'dreaded',
    name: 'Dreaded Bear',
    keywords: ['dreaded'],
  },
  dreadedFlyer: {
    ...TEST_DB.flyer,
    id: 'dreadedFlyer',
    name: 'Dreaded Harpy',
    keywords: ['skyborne', 'dreaded'],
  },
  staticDread: {
    id: 'staticDread',
    name: 'Dread Banner',
    types: ['enchantment'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [
      {
        when: 'static',
        static: { scope: 'filter', filter: { subtype: 'Beastkin' }, grantKeywords: ['dreaded'] },
      },
    ],
    rarity: 'c',
  },
  empoweredRitual: {
    id: 'empoweredRitual',
    name: 'Crimson Rite',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: { R: 1 } },
    colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
    empower: {
      cost: { generic: 1, pips: {} },
      ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }],
    },
    rarity: 'c',
  },
  empoweredCreature: {
    id: 'empoweredCreature',
    name: 'Stitched Horror',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 1, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] }],
    empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'c',
  },
  xEmpowered: {
    id: 'xEmpowered',
    name: 'Scalable Rite',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: { R: 1 } },
    colors: ['R'],
    x: { min: 1 },
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 'X', to: 'opponent' }] }],
    empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'gainLife', n: 2 }] },
    rarity: 'c',
  },
};

function combatGame(
  attackers: Partial<Permanent>[],
  blockers: Partial<Permanent>[],
  db: CardDb = DB,
): Game {
  const state = makeTestState({ battlefield: [...attackers, ...blockers], active: 0 });
  const game = Game.restore(state, db);
  game.submit(0, { type: 'passStep' });
  return game;
}

function castGame(cardId: string, lands: string[], db: CardDb = DB): Game {
  const state = makeTestState({ hands: [[cardId], []], active: 0 });
  state.battlefield = lands.map((cardId, i) => ({
    iid: i + 1,
    cardId,
    owner: 0,
    controller: 0,
    tapped: false,
    enteredThisTurn: false,
    damage: 0,
    deathtouched: false,
    attachments: [],
    plusOneCounters: 0,
    untilEotMods: [],
  }));
  return Game.restore(state, db);
}

describe('Gothic Monsters Dreaded', () => {
  it('rejects one blocker, accepts two, and exposes complete enumerated assignments', () => {
    const game = combatGame(
      [{ iid: 1, cardId: 'dreaded', controller: 0 }],
      [
        { iid: 2, cardId: 'bear', controller: 1 },
        { iid: 3, cardId: 'bear', controller: 1 },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [1] });

    expect(() => game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: 2, attacker: 1 }],
    })).toThrow('requires at least 2 blockers');
    expect(blockOptions(game.state.battlefield, DB, 1, game.state.combat!).flatMap((o) => o.canBlock)).toEqual([1, 1]);
    expect(game.legalActions(1).some((a) => a.type === 'declareBlockers' && a.blocks.length === 1)).toBe(false);
    expect(game.legalActions(1).some((a) => a.type === 'declareBlockers' && a.blocks.length === 2)).toBe(true);

    expect(() => game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: 2, attacker: 1 }, { blocker: 3, attacker: 1 }],
    })).not.toThrow();
  });

  it('uses effective keywords from boosts and static layers', () => {
    const boosted = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, untilEotMods: [{ p: 0, t: 0, keywords: ['dreaded'] }] },
        { iid: 2, cardId: 'bear', controller: 1 },
      ],
    });
    const combat: CombatState = { attackers: [1], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    expect(validateBlocks(boosted.battlefield, DB, 1, combat, [])).toBeNull();
    expect(validateBlocks(boosted.battlefield, DB, 1, combat, [{ blocker: 2, attacker: 1 }])).toContain('at least 2');

    const staticState = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        { iid: 2, cardId: 'staticDread', controller: 0 },
        { iid: 3, cardId: 'bear', controller: 1 },
      ],
    });
    expect(validateBlocks(staticState.battlefield, DB, 1, combat, [{ blocker: 3, attacker: 1 }])).toContain('at least 2');
  });

  it('requires two sky-capable blockers and still honors the three-blocker cap', () => {
    const game = combatGame(
      [{ iid: 1, cardId: 'dreadedFlyer', controller: 0 }],
      [
        { iid: 2, cardId: 'flyer', controller: 1 },
        { iid: 3, cardId: 'archer', controller: 1 },
        { iid: 4, cardId: 'flyer', controller: 1 },
        { iid: 5, cardId: 'flyer', controller: 1 },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    const combat = game.state.combat!;
    expect(validateBlocks(game.state.battlefield, DB, 1, combat, [{ blocker: 2, attacker: 1 }])).toContain('at least 2');
    expect(validateBlocks(game.state.battlefield, DB, 1, combat, [
      { blocker: 2, attacker: 1 },
      { blocker: 3, attacker: 1 },
    ])).toBeNull();
    expect(validateBlocks(game.state.battlefield, DB, 1, combat, [
      { blocker: 2, attacker: 1 },
      { blocker: 3, attacker: 1 },
      { blocker: 4, attacker: 1 },
    ])).toBeNull();
    expect(validateBlocks(game.state.battlefield, DB, 1, combat, [
      { blocker: 2, attacker: 1 },
      { blocker: 3, attacker: 1 },
      { blocker: 4, attacker: 1 },
      { blocker: 5, attacker: 1 },
    ])).toContain('more than 3 blockers');
  });
});

describe('Gothic Monsters Empower', () => {
  it('prices the extra cost in auto-solve and explicit mana plans', () => {
    const oneLand = castGame('empoweredRitual', ['mountain']);
    expect(() => oneLand.submit(0, { type: 'castSpell', handIndex: 0, empowered: true })).toThrow('cannot pay cost');

    const twoLands = castGame('empoweredRitual', ['mountain', 'mountain']);
    expect(() => twoLands.submit(0, { type: 'castSpell', handIndex: 0, empowered: true, manaPlan: [1, 2] })).not.toThrow();
    expect(twoLands.state.battlefield.filter((p) => p.tapped)).toHaveLength(2);
    expect(combineManaCosts({ generic: 0, pips: { R: 1 } }, { generic: 1, pips: {} })).toEqual({ generic: 1, pips: { R: 1 } });
  });

  it('runs base and empowered ritual effects, and permanent arrival riders after base triggers', () => {
    const ritual = castGame('empoweredRitual', ['mountain', 'mountain']);
    ritual.state.players[1].life = 20;
    ritual.state.players[0].life = 10;
    ritual.submit(0, { type: 'castSpell', handIndex: 0, empowered: true });
    expect(ritual.state.players[1].life).toBe(17);
    expect(ritual.state.players[0].life).toBe(12);

    const permanent = castGame('empoweredCreature', ['forest', 'forest']);
    permanent.state.players[0].life = 10;
    permanent.state.players[1].life = 20;
    permanent.submit(0, { type: 'castSpell', handIndex: 0, empowered: true });
    const horror = permanent.state.battlefield.find((p) => p.cardId === 'empoweredCreature')!;
    expect(horror.plusOneCounters).toBe(2);
    expect(permanent.state.players[0].life).toBe(11);
  });

  it('rejects X plus Empower and offers both payable cast variants', () => {
    const xGame = castGame('xEmpowered', ['mountain', 'mountain', 'mountain']);
    expect(() => xGame.submit(0, { type: 'castSpell', handIndex: 0, x: 1, empowered: true })).toThrow('X spells cannot be empowered');
    expect(xGame.legalActions(0).filter((a) => a.type === 'castSpell')).toHaveLength(2);
    expect(xGame.legalActions(0).every((a) => a.type !== 'castSpell' || !a.empowered)).toBe(true);

    const game = castGame('empoweredRitual', ['mountain', 'mountain']);
    const casts = game.legalActions(0).filter((a) => a.type === 'castSpell');
    expect(casts).toHaveLength(2);
    expect(casts.some((a) => a.type === 'castSpell' && !a.empowered)).toBe(true);
    expect(casts.some((a) => a.type === 'castSpell' && a.empowered)).toBe(true);
    expect(rulesText(DB.empoweredRitual)).toContain('Empower {1}: Your opponent loses 2 life, then you gain 2 life.');
  });
});
