import { describe, expect, it } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import { buildAI } from '../../src/ai/personality';
import { buildTierAI } from '../../src/ai/tiers';
import { chooseReserveLand } from '../../src/ai/landPolicy';
import { Game } from '../../src/engine/Game';
import { cardIdOf } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { TEST_DB } from '../helpers';

const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];
const SPELL_DECK = Array.from({ length: 50 }, () => 'bear');

function view(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    myId: 0,
    turn: 3,
    step: 'main1',
    activePlayer: 0,
    startingPlayer: 0,
    you: {
      life: 20,
      hand: [],
      deckCount: 40,
      graveyard: [],
      severed: [],
      landReserve: RESERVE,
      landPlayedThisTurn: false,
      mulligans: 0,
    },
    opp: {
      life: 20,
      handCount: 0,
      deckCount: 40,
      graveyard: [],
      severed: [],
      landReserve: RESERVE,
      landPlayedThisTurn: false,
      mulligans: 0,
    },
    battlefield: [],
    stack: [],
    combat: null,
    fogThisTurn: false,
    awaiting: { player: 0, kind: 'main' },
    winner: null,
    ...overrides,
  };
}

const legal = RESERVE.map((_, reserveIndex) => ({ type: 'playLand' as const, handIndex: -1, reserveIndex }));

function keepBoth(game: Game): void {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) return;
    game.submit(awaiting.player, { type: 'keepHand' });
  }
}

describe('shared reserve land policy', () => {
  it('is deterministic, fixes missing colors, and preserves basics when mana is idle', () => {
    const missingWhite = view({ you: { ...view().you, hand: ['knight'] } });
    expect(chooseReserveLand(missingWhite, TEST_DB, legal)).toMatchObject({ reserveIndex: 1 });

    const idle = view();
    expect(chooseReserveLand(idle, TEST_DB, legal)).toMatchObject({ reserveIndex: 5 });
    expect(chooseReserveLand(idle, TEST_DB, legal)).toEqual(chooseReserveLand(idle, TEST_DB, legal));

    const needsMana = view({
      you: { ...view().you, hand: ['knight'] },
      battlefield: [{
        iid: 1,
        cardId: 'forest',
        owner: 0,
        controller: 0,
        tapped: false,
        enteredThisTurn: false,
        damage: 0,
        deathtouched: false,
        attachments: [],
        plusOneCounters: 0,
        untilEotMods: [],
      }],
    });
    const legalWithCast = [...legal, { type: 'castSpell' as const, handIndex: 0 }];
    expect(chooseReserveLand(needsMana, TEST_DB, legalWithCast)).toMatchObject({ reserveIndex: 1 });
  });

  it('is used by Easy, Medium, and Hard through PlayerView only', () => {
    const reserveView = view();
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ai = buildAI(difficulty, TEST_DB, 100 + difficulty.length);
      expect(ai.chooseAction(reserveView, legal)).toMatchObject({ reserveIndex: 5 });
    }
  });

  it('never injects land stand-ins into reserve-format determinized hidden zones', () => {
    const game = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 8128,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    });
    keepBoth(game);

    const simulated = determinize(game.viewFor(0), TEST_DB, 4242);
    const hiddenIds = simulated.instanceState.players.flatMap((player) => [
      ...player.hand,
      ...player.deck,
    ].map(cardIdOf));
    expect(hiddenIds).not.toContain('__unknown_land');
  });

  it('finishes seeded reserve games on every tower tier', () => {
    for (const tier of [1, 2, 3, 4, 5, 6] as const) {
      const game = new Game({
        decks: [SPELL_DECK, SPELL_DECK],
        seed: 9000 + tier,
        db: TEST_DB,
        format: 'warchest',
        landReserves: [Array(10).fill('forest'), Array(10).fill('forest')],
      });
      const brains = [
        buildTierAI(tier, TEST_DB, 3000 + tier),
        buildTierAI(tier, TEST_DB, 4000 + tier),
      ];
      for (let actionNo = 0; actionNo < 2500 && game.instanceState.winner === null; actionNo++) {
        const awaiting = game.instanceState.awaiting;
        if (!('player' in awaiting)) break;
        const player = awaiting.player;
        game.submit(player, brains[player].chooseAction(game.viewFor(player), game.legalActions(player)));
      }
      expect(game.instanceState.winner, `tier ${tier} did not finish`).not.toBeNull();
    }
  }, 120000);
});
