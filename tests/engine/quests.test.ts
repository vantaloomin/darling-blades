import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, GameState } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  quest: {
    id: 'quest',
    name: 'The Once and Future Court',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [
      [{ op: 'gainLife', n: 1 }],
      [{ op: 'gainLife', n: 2 }],
      [{ op: 'gainLife', n: 3 }],
    ],
    rarity: 'r',
  },
  quest_one: {
    id: 'quest_one',
    name: 'One Chapter Court',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [[{ op: 'gainLife', n: 1 }]],
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 4 }] }],
    rarity: 'c',
  },
  quest_active: {
    id: 'quest_active',
    name: 'Active Court',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [[], []],
    rarity: 'c',
  },
  quest_foresee: {
    id: 'quest_foresee',
    name: 'Foreseeing Court',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [[], [{ op: 'foresee', n: 1 }], []],
    rarity: 'c',
  },
  quest_dawn: {
    id: 'quest_dawn',
    name: 'Dawn Court',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [[{ op: 'gainLife', n: 1 }], [{ op: 'gainLife', n: 3 }], [{ op: 'gainLife', n: 5 }]],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  dawn_foresee: {
    ...TEST_DB.bear,
    id: 'dawn_foresee',
    name: 'Dawn Foresee Bear',
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
  },
  dawn_marker: {
    ...TEST_DB.bear,
    id: 'dawn_marker',
    name: 'Dawn Marker',
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'controller' }] }],
  },
  dawn_grind: {
    ...TEST_DB.bear,
    id: 'dawn_grind',
    name: 'Dawn Self-Grinder',
    abilities: [{ when: 'dawn', ops: [{ op: 'grind', n: 9, who: 'self' }] }],
  },
  conditional_arrives: {
    ...TEST_DB.bear,
    id: 'conditional_arrives',
    name: 'Court-Bound Bear',
    cost: { generic: 0, pips: {} },
    abilities: [
      {
        when: 'arrives',
        condition: 'questActive',
        ops: [{ op: 'gainLife', n: 5 }],
      },
    ],
  },
  conditional_spell: {
    id: 'conditional_spell',
    name: 'Court Verdict',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [
      { when: 'spell', condition: 'questActive', ops: [{ op: 'gainLife', n: 2 }] },
      { when: 'spell', ops: [{ op: 'gainLife', n: 1 }] },
    ],
    rarity: 'c',
  },
  self_rider: {
    ...TEST_DB.knight,
    id: 'self_rider',
    name: 'Questbound Self Rider',
    abilities: [
      {
        when: 'static',
        static: {
          scope: 'self',
          condition: 'questActive',
          p: 1,
          t: 0,
          grantKeywords: ['untouchable'],
        },
      },
    ],
  },
  filter_rider: {
    ...TEST_DB.knight,
    id: 'filter_rider',
    name: 'Questbound Filter Rider',
    abilities: [
      {
        when: 'static',
        static: {
          scope: 'filter',
          condition: 'questActive',
          filter: { subtype: 'Warrior', other: true },
          p: 2,
          t: 0,
        },
      },
    ],
  },
  subtype_only: {
    ...TEST_DB.bear,
    id: 'subtype_only',
    name: 'Quest-Labeled Bear',
    subtypes: ['Quest'],
  },
};

function arrivalGame(cardId: string): Game {
  const state = makeTestState({ hands: [[cardId], []], active: 0 });
  state.players[0].deck = ['bear', 'elf', 'giant'];
  return Game.restore(state, DB);
}

function castCard(game: Game, player: 0 | 1, cardId: string): GameEvent[] {
  const handIndex = game.state.players[player].hand.indexOf(cardId);
  if (handIndex < 0) throw new Error(`fixture card ${cardId} is not in hand`);
  return game.submit(player, { type: 'castSpell', handIndex });
}

function passMainTurn(game: Game, player: 0 | 1, events?: GameEvent[]): void {
  for (const action of [
    { type: 'passStep' as const },
    { type: 'declareAttackers' as const, attackers: [] },
    { type: 'passStep' as const },
  ]) {
    const emitted = game.submit(player, action);
    events?.push(...emitted);
  }
}

function reachP0Dawn(game: Game): void {
  passMainTurn(game, 0);
  passMainTurn(game, 1);
}

function eventIndex(events: readonly GameEvent[], predicate: (event: GameEvent) => boolean): number {
  const index = events.findIndex(predicate);
  if (index < 0) throw new Error('expected event was not emitted');
  return index;
}

describe('quests', () => {
  it('runs Chapter I atomically on arrival and records the current chapter', () => {
    const game = arrivalGame('quest');
    const events = castCard(game, 0, 'quest');
    const quest = game.state.battlefield.find((perm) => perm.cardId === 'quest');

    expect(quest?.chapter).toBe(1);
    expect(game.state.players[0].life).toBe(21);
    expect(events).toContainEqual({ e: 'chapterAdvanced', iid: quest!.iid, cardId: 'quest', chapter: 1 });
    expect(
      eventIndex(events, (event) => event.e === 'chapterAdvanced'),
    ).toBeGreaterThan(eventIndex(events, (event) => event.e === 'permanentEntered'));
    expect(
      eventIndex(events, (event) => event.e === 'effectApplied' && event.op === 'gainLife'),
    ).toBeGreaterThan(eventIndex(events, (event) => event.e === 'chapterAdvanced'));
  });

  it('advances in battlefield order, with ordinary dawn abilities before that permanent chapter', () => {
    const state = makeTestState({
      active: 1,
      battlefield: [
        { iid: 1, cardId: 'dawn_marker', controller: 0 },
        { iid: 2, cardId: 'quest_dawn', controller: 0, chapter: 1 },
      ],
    });
    state.step = 'main2';
    state.awaiting = { player: 1, kind: 'main' };
    state.players[0].deck = ['bear'];
    const game = Game.restore(state, DB);
    const events = game.submit(1, { type: 'passStep' });
    const advanced = eventIndex(
      events,
      (event) => event.e === 'chapterAdvanced' && event.iid === 2 && event.chapter === 2,
    );

    expect(
      eventIndex(events, (event) => event.e === 'effectApplied' && event.op === 'damage'),
    ).toBeLessThan(advanced);
    expect(
      eventIndex(events, (event) => event.e === 'triggerFired' && event.iid === 2),
    ).toBeLessThan(advanced);
    expect(game.state.players[0].life).toBe(24);
    expect(game.state.battlefield.find((perm) => perm.iid === 2)?.chapter).toBe(2);
  });

  it('sends a final Quest to its owner graveyard once and fires normal dies handling', () => {
    const game = arrivalGame('quest_one');
    const events = castCard(game, 0, 'quest_one');

    expect(game.state.battlefield).toEqual([]);
    expect(game.state.players[0].graveyard).toEqual(['quest_one']);
    expect(game.state.players[0].life).toBe(25);
    expect(events.filter((event) => event.e === 'died')).toHaveLength(1);
    expect(events.filter((event) => event.e === 'triggerFired' && event.when === 'dies')).toHaveLength(1);
  });

  it('resumes the dawn when every queued dawn foresee whiffs on an emptied deck', () => {
    // Adversarial finding 2026-07-16: a dawn foresee queues while the deck
    // still has cards; a later dawn ability then empties the deck, so the
    // queued decision whiffs in maybeRaiseDeferredDecision's drain. The drain
    // itself must resume through finishDawn (whose turn draw then decks the
    // player out) instead of stranding the turn in 'dawn' forever.
    const state = makeTestState({
      active: 1,
      battlefield: [
        { iid: 1, cardId: 'dawn_foresee', controller: 0 },
        { iid: 2, cardId: 'dawn_grind', controller: 0 },
      ],
    });
    state.step = 'main2';
    state.awaiting = { player: 1, kind: 'main' };
    state.players[0].deck = ['bear', 'elf'];
    const game = Game.restore(state, DB);
    game.submit(1, { type: 'passStep' });

    expect(game.state.step).not.toBe('dawn');
    expect(game.awaiting.kind).toBe('gameOver');
    expect(game.state.winner).toBe(1);
  });

  it('queues a chapter Foresee behind another dawn Foresee and resumes through finishDawn', () => {
    const state = makeTestState({
      active: 1,
      battlefield: [
        { iid: 1, cardId: 'dawn_foresee', controller: 0 },
        { iid: 2, cardId: 'quest_foresee', controller: 0, chapter: 1 },
      ],
    });
    state.step = 'main2';
    state.awaiting = { player: 1, kind: 'main' };
    state.players[0].deck = ['bear', 'elf'];
    const game = Game.restore(state, DB);

    game.submit(1, { type: 'passStep' });
    expect(game.awaiting).toEqual({ player: 0, kind: 'foresee', cards: ['elf'] });
    expect(game.state.pendingDecisions).toEqual([
      { kind: 'foresee', player: 0, n: 1 },
      { kind: 'foresee', player: 0, n: 1 },
    ]);

    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.awaiting).toEqual({ player: 0, kind: 'foresee', cards: ['elf'] });
    expect(game.state.pendingDecisions).toEqual([{ kind: 'foresee', player: 0, n: 1 }]);

    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.awaiting.kind).toBe('main');
    expect(game.state.pendingDecisions).toEqual([]);
    expect(game.state.battlefield.find((perm) => perm.iid === 2)?.chapter).toBe(2);
  });

  it('flips questActive for arrivals, both spell bodies, self/filter statics, and Quest departure', () => {
    const state = makeTestState({
      hands: [['conditional_arrives', 'conditional_spell', 'quest_active', 'conditional_spell', 'conditional_arrives'], []],
      active: 0,
      battlefield: [
        { iid: 1, cardId: 'self_rider', controller: 0 },
        { iid: 2, cardId: 'filter_rider', controller: 0 },
        { iid: 3, cardId: 'knight', controller: 0 },
      ],
    });
    state.players[0].deck = ['bear', 'elf', 'giant', 'bear', 'elf'];
    state.players[1].deck = ['bear'];
    const game = Game.restore(state, DB);

    castCard(game, 0, 'conditional_arrives');
    castCard(game, 0, 'conditional_spell');
    expect(game.state.players[0].life).toBe(21);

    castCard(game, 0, 'quest_active');
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 5, defense: 2 });
    expect(getEffectiveStats(game.state.battlefield, DB, 1).keywords.has('untouchable')).toBe(true);
    expect(getEffectiveStats(game.state.battlefield, DB, 3).attack).toBe(4);

    castCard(game, 0, 'conditional_spell');
    expect(game.state.players[0].life).toBe(24);

    reachP0Dawn(game);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'quest_active')).toBe(false);
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 2, defense: 2 });
    expect(getEffectiveStats(game.state.battlefield, DB, 1).keywords.has('untouchable')).toBe(false);
    expect(getEffectiveStats(game.state.battlefield, DB, 3).attack).toBe(2);

    castCard(game, 0, 'conditional_arrives');
    expect(game.state.players[0].life).toBe(24);
  });

  it('does not treat a Quest subtype alone as questActive', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'self_rider', controller: 0 },
        { iid: 2, cardId: 'subtype_only', controller: 0 },
      ],
    });
    const stats = getEffectiveStats(state.battlefield, DB, 1);
    expect(stats.attack).toBe(2);
    expect(stats.keywords.has('untouchable')).toBe(false);
  });

  function replay(): { state: string; events: string } {
    const state: GameState = makeTestState({
      hands: [['quest', 'conditional_spell'], []],
      active: 0,
      battlefield: [{ iid: 1, cardId: 'dawn_marker', controller: 0 }],
    });
    state.rng = createRngState(4242);
    state.nextIid = 10;
    state.nextSid = 1;
    state.players[0].deck = ['bear', 'elf', 'giant', 'bear', 'elf', 'giant'];
    state.players[1].deck = ['bear', 'bear'];
    const game = Game.restore(state, DB);
    const events: GameEvent[] = [];
    const submit = (player: 0 | 1, action: Parameters<Game['submit']>[1]): void => {
      events.push(...game.submit(player, action));
    };

    submit(0, { type: 'castSpell', handIndex: 0 });
    castCard(game, 0, 'conditional_spell').forEach((event) => events.push(event));
    passMainTurn(game, 0, events);
    passMainTurn(game, 1, events);
    passMainTurn(game, 0, events);
    passMainTurn(game, 1, events);
    return { state: JSON.stringify(game.state), events: JSON.stringify(events) };
  }

  it('replays a seeded Quest and conditional-ability script byte-identically', () => {
    const a = replay();
    const b = replay();
    expect(a.state).toBe(b.state);
    expect(a.events).toBe(b.events);
  });
});
