import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { makeTestState } from '../helpers';

const LAND_DB: CardDb = {
  arrival_land: {
    id: 'arrival_land',
    name: 'Vital Grove',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['G'],
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  plain_land: {
    id: 'plain_land',
    name: 'Quiet Grove',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['G'],
    rarity: 'c',
  },
  filler: {
    id: 'filler',
    name: 'Filler',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: { G: 1 } },
    colors: ['G'],
    attack: 1,
    defense: 1,
    rarity: 'c',
  },
};

const SPELL_DECK = Array.from({ length: 50 }, () => 'filler');
const RESERVE = Array.from({ length: 10 }, () => 'arrival_land');

function keepBoth(game: Game): void {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) throw new Error('expected an opening-hand decision');
    game.submit(awaiting.player, { type: 'keepHand' });
  }
}

describe('land arrival triggers', () => {
  it('fires target-free arrives riders from hand after landPlayed', () => {
    const game = Game.restore(makeTestState({ hands: [['arrival_land'], []], active: 0 }), LAND_DB);

    const events = game.submit(0, { type: 'playLand', handIndex: 0 });

    expect(game.state.players[0].landDropsUsed).toBe(1);
    expect(game.state.players[0].life).toBe(22);
    expect(events.map((event) => event.e)).toEqual([
      'landPlayed',
      'triggerFired',
      'effectApplied',
      'lifeChanged',
    ]);
    expect(events[1]).toMatchObject({ e: 'triggerFired', when: 'arrives' });
    expect(events[2]).toEqual({ e: 'effectApplied', op: 'gainLife' });
  });

  it('fires the same arrives rider when played from a Warchest reserve', () => {
    const game = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 17,
      db: LAND_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    });
    keepBoth(game);
    const player = game.state.activePlayer;

    const events = game.submit(player, { type: 'playLand', handIndex: -1, reserveIndex: 0 });

    expect(game.state.players[player].landReserve).toHaveLength(9);
    expect(game.state.players[player].life).toBe(22);
    expect(events.map((event) => event.e)).toEqual([
      'landPlayed',
      'triggerFired',
      'effectApplied',
      'lifeChanged',
    ]);
  });

  it('keeps a land without abilities on the original event sequence', () => {
    const game = Game.restore(makeTestState({ hands: [['plain_land'], []], active: 0 }), LAND_DB);

    const events = game.submit(0, { type: 'playLand', handIndex: 0 });

    expect(events).toEqual([
      {
        e: 'landPlayed',
        player: 0,
        iid: game.state.battlefield[0].iid,
        cardId: 'plain_land',
      },
    ]);
  });
});
