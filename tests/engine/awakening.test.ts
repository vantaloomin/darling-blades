import { describe, expect, it } from 'vitest';
import { cardGlossaryEntries, rulesText } from '../../src/ui/rulesText';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, GameState } from '../../src/engine/types';
import { cardValue, permValue } from '../../src/ai/value';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  self_awaken: {
    ...TEST_DB.bear,
    id: 'self_awaken',
    name: 'Sleeping Champion',
    cost: { generic: 0, pips: {} },
    awakening: { p: 2, t: 1, keywords: ['skyborne'] },
    abilities: [{ when: 'arrives', ops: [{ op: 'awaken', scope: 'self' }] }],
  },
  ally_awaken: {
    ...TEST_DB.knight,
    id: 'ally_awaken',
    name: 'Knight of the Second Dawn',
    awakening: { p: 1, t: 2, keywords: ['untouchable'] },
  },
  opponent_awaken: {
    ...TEST_DB.bear,
    id: 'opponent_awaken',
    name: 'Opponent Champion',
    awakening: { p: 4, t: 4, keywords: ['deathblade'] },
  },
  no_block: {
    ...TEST_DB.bear,
    id: 'no_block',
    name: 'Unawakenable Bear',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'arrives', ops: [{ op: 'awaken', scope: 'self' }] }],
  },
  awaken_spell: {
    id: 'awaken_spell',
    name: 'Call the Champions',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'awaken', scope: 'allYours' }] }],
    rarity: 'r',
  },
  display_quest: {
    id: 'display_quest',
    name: 'Display Quest',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [
      [{ op: 'awaken', scope: 'allYours' }],
      [{ op: 'gainLife', n: 2 }],
      [{ op: 'foresee', n: 1 }],
    ],
    awakening: { p: 1, t: 2, keywords: ['skyborne', 'untouchable'] },
    rarity: 'r',
  },
  replay_quest: {
    id: 'replay_quest',
    name: 'Replay Quest',
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: { generic: 0, pips: {} },
    colors: [],
    chapters: [
      [{ op: 'awaken', scope: 'allYours' }],
      [{ op: 'gainLife', n: 1 }],
    ],
    rarity: 'r',
  },
  replay_spell: {
    id: 'replay_spell',
    name: 'Replay Verdict',
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
};

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

describe('champion awakening', () => {
  it('awakens self and allYours, applies stats and keywords, and never flips back', () => {
    const state = makeTestState({
      hands: [['self_awaken', 'awaken_spell', 'awaken_spell', 'no_block'], []],
      active: 0,
      battlefield: [
        { iid: 1, cardId: 'ally_awaken', controller: 0 },
        { iid: 2, cardId: 'opponent_awaken', controller: 1 },
      ],
    });
    state.nextIid = 3;
    const game = Game.restore(state, DB);

    const selfEvents = castCard(game, 0, 'self_awaken');
    expect(game.state.battlefield.find((perm) => perm.cardId === 'self_awaken')?.awakened).toBe(true);
    expect(selfEvents).toContainEqual({ e: 'awakened', iid: 3, cardId: 'self_awaken' });
    expect(getEffectiveStats(game.state.battlefield, DB, 3)).toMatchObject({ attack: 4, defense: 3 });
    expect(getEffectiveStats(game.state.battlefield, DB, 3).keywords.has('skyborne')).toBe(true);

    const allEvents = castCard(game, 0, 'awaken_spell');
    expect(allEvents.filter((event) => event.e === 'awakened')).toEqual([
      { e: 'awakened', iid: 1, cardId: 'ally_awaken' },
    ]);
    expect(game.state.battlefield.find((perm) => perm.iid === 2)?.awakened).toBeUndefined();
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 3, defense: 4 });
    expect(getEffectiveStats(game.state.battlefield, DB, 1).keywords.has('untouchable')).toBe(true);

    const repeatEvents = castCard(game, 0, 'awaken_spell');
    expect(repeatEvents.filter((event) => event.e === 'awakened')).toEqual([]);
    expect(repeatEvents.filter((event) => event.e === 'effectApplied' && event.op === 'awaken')).toEqual([]);

    const noBlockEvents = castCard(game, 0, 'no_block');
    expect(noBlockEvents.filter((event) => event.e === 'awakened')).toEqual([]);
    expect(noBlockEvents.filter((event) => event.e === 'effectApplied' && event.op === 'awaken')).toEqual([]);
    expect(game.state.battlefield.find((perm) => perm.cardId === 'no_block')?.awakened).toBeUndefined();
  });

  it('prints chapters, awaken ops, awakening blocks, conditional prefixes, and glossary entries', () => {
    const text = rulesText(DB.display_quest);
    expect(text).toContain('Awakening: +1/+2, Skyborne, Untouchable');
    expect(text).toContain('Chapter I: Awaken all creatures you control.');
    expect(text).toContain('Chapter II: You gain 2 life.');
    expect(text).toContain('Chapter III: Foresee 1.');
    expect(text).not.toContain('\u2014');

    const conditional = rulesText({
      ...DB.self_awaken,
      abilities: [
        {
          when: 'static',
          condition: 'questActive',
          static: { scope: 'self', grantKeywords: ['untouchable'] },
        },
      ],
    });
    expect(conditional).toContain('While a Quest is active, This gets +0/+0 and have Untouchable.');
    expect(cardGlossaryEntries(DB.display_quest)).toEqual(
      expect.arrayContaining([
        { name: 'Quest', reminder: expect.any(String) },
        { name: 'Champion Awakening', reminder: expect.any(String) },
      ]),
    );
  });

  it('prices chapter value and unfired awakening potential monotonically', () => {
    expect(cardValue(DB, 'display_quest')).toBeGreaterThan(cardValue(DB, 'replay_quest'));
    expect(cardValue(DB, 'self_awaken')).toBeGreaterThan(cardValue(DB, 'bear'));

    const cold = makeTestState({ battlefield: [{ iid: 1, cardId: 'self_awaken', controller: 0 }] });
    const hot = makeTestState({ battlefield: [{ iid: 1, cardId: 'self_awaken', controller: 0, awakened: true }] });
    expect(permValue(cold.battlefield, DB, 1)).toBeGreaterThan(cardValue(DB, 'bear'));
    expect(permValue(cold.battlefield, DB, 1)).toBeGreaterThan(permValue(makeTestState({ battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }] }).battlefield, DB, 1));
    expect(permValue(hot.battlefield, DB, 1)).toBeGreaterThan(permValue(makeTestState({ battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }] }).battlefield, DB, 1));
  });

  it('replays Quest, awakening, and conditional spell bodies byte-identically', () => {
    const replay = (): { state: string; events: string } => {
      const state: GameState = makeTestState({
        hands: [['replay_quest', 'replay_spell'], []],
        active: 0,
        battlefield: [
          { iid: 1, cardId: 'self_awaken', controller: 0 },
          { iid: 2, cardId: 'opponent_awaken', controller: 1 },
        ],
      });
      state.rng = createRngState(9917);
      state.nextIid = 10;
      state.nextSid = 1;
      state.players[0].deck = ['bear', 'elf', 'giant', 'bear', 'elf'];
      state.players[1].deck = ['bear', 'bear'];
      const game = Game.restore(state, DB);
      const events: GameEvent[] = [];
      events.push(...castCard(game, 0, 'replay_quest'));
      events.push(...castCard(game, 0, 'replay_spell'));
      passMainTurn(game, 0, events);
      passMainTurn(game, 1, events);
      return { state: JSON.stringify(game.state), events: JSON.stringify(events) };
    };

    const a = replay();
    const b = replay();
    expect(a.state).toBe(b.state);
    expect(a.events).toBe(b.events);
    expect(a.events).toContain('"chapterAdvanced"');
    expect(a.events).toContain('"awakened"');
  });
});
