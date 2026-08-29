import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import type { CardDb, Permanent, TargetRef } from '../../src/engine/types';
import { targetAbilityText, targetPromptTitle } from '../../src/ui/duelPresentation';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  marked_arrival: {
    id: 'marked_arrival',
    name: 'Starborne Marker',
    types: ['creature'],
    subtypes: ['Starborne'],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [
      {
        when: 'arrives',
        targets: [{ what: 'creature', other: true }],
        ops: [{ op: 'addCounters', n: 1, to: 'target' }],
      },
    ],
    rarity: 'c',
  },
  harm_arrival: {
    id: 'harm_arrival',
    name: 'Starborne Ruin',
    types: ['creature'],
    subtypes: ['Starborne'],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [
      {
        when: 'arrives',
        targets: [{ what: 'creature', other: true }],
        ops: [{ op: 'damage', n: 4, to: 'target' }],
      },
    ],
    rarity: 'c',
  },
  marked_cleanup: {
    id: 'marked_cleanup',
    name: 'Markbreaker',
    types: ['creature'],
    subtypes: ['Starborne'],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [
      {
        when: 'arrives',
        targets: [{ what: 'creature', other: true, marked: true }],
        ops: [{ op: 'removeMarks', to: 'target' }],
      },
    ],
    rarity: 'c',
  },
  two_arrivals: {
    id: 'two_arrivals',
    name: 'Twin Signal',
    types: ['creature'],
    subtypes: ['Starborne'],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [
      { when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] },
      {
        when: 'arrives',
        targets: [{ what: 'creature', other: true }],
        ops: [{ op: 'addCounters', n: 1, to: 'target' }],
      },
    ],
    rarity: 'c',
  },
};

function permanent(
  iid: number,
  cardId: string,
  controller: 0 | 1,
  plusOneCounters = 0,
): Permanent {
  return {
    iid,
    cardId,
    controller,
    owner: controller,
    tapped: false,
    enteredThisTurn: false,
    damage: 0,
    deathtouched: false,
    attachments: [],
    plusOneCounters,
    untilEotMods: [],
  };
}

function targetedGame(cardId: string, targets: TargetRef[], markedOwn = 0, markedOpp = 0): Game {
  const source = permanent(10, cardId, 0);
  const state = makeTestState({
    active: 0,
    battlefield: [source, permanent(1, 'bear', 0, markedOwn), permanent(2, 'giant', 1, markedOpp)],
  });
  const ability = DB[cardId].abilities?.[0];
  if (!ability?.targets?.[0] || !ability.ops) throw new Error('target fixture is incomplete');
  state.awaiting = {
    player: 0,
    kind: 'chooseTarget',
    sourceIid: source.iid,
    abilityIndex: 0,
    targets,
  };
  state.pendingDecisions = [{
    kind: 'chooseTarget',
    player: 0,
    sourceIid: source.iid,
    sourceCardId: source.cardId,
    abilityIndex: 0,
    spec: ability.targets[0],
    ops: ability.ops,
  }];
  return Game.restore(state, DB);
}

function choose(
  makeAI: (db: CardDb) => AIPlayer,
  cardId: string,
  targets: TargetRef[],
): Action {
  const game = targetedGame(cardId, targets);
  return makeAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
}

const targetChoices: TargetRef[] = [
  { kind: 'permanent', iid: 1 },
  { kind: 'permanent', iid: 2 },
];

const brains: [string, (db: CardDb) => AIPlayer][] = [
  ['Easy', (db) => new EasyAI(db, 17)],
  ['Medium', (db) => new MediumAI(db)],
  ['Hard', (db) => new HardAI(db)],
];

describe('Starborne targeted-arrival AI', () => {
  it.each(brains)('%s chooses the same legal target on repeated seeded views', (_name, makeAI) => {
    const first = choose(makeAI, 'marked_arrival', targetChoices);
    const second = choose(makeAI, 'marked_arrival', targetChoices);
    expect(first).toEqual(second);
    expect(first).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 1 } });
  });

  it('greedily puts a beneficial mark on our creature', () => {
    const action = choose((db) => new MediumAI(db), 'marked_arrival', targetChoices);
    expect(action).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 1 } });
  });

  it('greedily aims harm at the better opposing creature', () => {
    const action = choose((db) => new MediumAI(db), 'harm_arrival', targetChoices);
    expect(action).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 2 } });
  });

  it('values removing an opposing mark over removing our mark', () => {
    const targets: TargetRef[] = [
      { kind: 'permanent', iid: 1 },
      { kind: 'permanent', iid: 2 },
    ];
    const game = targetedGame('marked_cleanup', targets, 1, 1);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 2 } });
  });

  it('uses the queued ability index for the presentation text', () => {
    const card = DB.two_arrivals;
    expect(targetPromptTitle(card.name)).toBe('Choose a target for Twin Signal');
    const first = targetAbilityText(card, 0);
    const second = targetAbilityText(card, 1);
    expect(first).not.toBe(second);
    expect(second.length).toBeGreaterThan(0);
  });

  it('finishes a seeded AI-vs-AI game containing targeted arrivals', () => {
    const deck = Array.from({ length: 18 }, () => 'marked_arrival');
    const game = new Game({
      decks: [deck, [...deck]],
      seed: 90210,
      db: DB,
      playDrawChoice: false,
      startingHandSize: 4,
    });
    const ai: [AIPlayer, AIPlayer] = [new HardAI(DB), new MediumAI(DB)];
    let targetChoicesSeen = 0;
    let steps = 0;
    while (game.state.winner === null && game.awaiting.kind !== 'gameOver' && steps < 1000) {
      const awaiting = game.awaiting;
      if (!('player' in awaiting)) throw new Error('unexpected non-player awaiting state');
      if (awaiting.kind === 'chooseTarget') targetChoicesSeen++;
      const player = awaiting.player;
      game.submit(player, ai[player].chooseAction(game.viewFor(player), game.legalActions(player)));
      steps++;
    }
    expect(targetChoicesSeen).toBeGreaterThan(0);
    expect(game.state.winner).not.toBeNull();
    expect(steps).toBeLessThan(1000);
  });
});
