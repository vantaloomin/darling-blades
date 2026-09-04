import { describe, expect, it } from 'vitest';
import { CURRENT_RULES_REV } from '../../src/config/rules';
import { determinize } from '../../src/ai/determinize';
import { buildAI } from '../../src/ai/personality';
import { buildTierAI } from '../../src/ai/tiers';
import { chooseReserveLand } from '../../src/ai/landPolicy';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { cardIdOf } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { TEST_DB } from '../helpers';

const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];
const SPELL_DECK = Array.from({ length: 50 }, () => 'bear');
const DARLINGS_DECK = Array.from({ length: 79 }, () => 'bear');
const COLORLESS_DB: CardDb = {
  ...TEST_DB,
  cLand: { ...TEST_DB.forest, id: 'cLand', name: 'Colorless Land', supertypes: [], manaAbility: ['C'] },
};

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
      landDropsRemaining: 1,
      mulligans: 0,
    },
    opp: {
      life: 20,
      handCount: 0,
      deckCount: 40,
      graveyard: [],
      severed: [],
      landReserve: RESERVE,
      landDropsRemaining: 1,
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
  it('ignores a C-only source when counting colored reserve support', () => {
    const reserve = ['cLand', 'plains'];
    const legalReserve = reserve.map((_, reserveIndex) => ({ type: 'playLand' as const, handIndex: -1, reserveIndex }));
    const reserveView = view({
      you: { ...view().you, hand: ['knight'], landReserve: reserve },
      battlefield: [{
        iid: 1,
        cardId: 'cLand',
        owner: 0,
        controller: 0,
        tapped: false,
        enteredThisTurn: false,
        damage: 0,
        deathtouched: false,
        severBranded: false,
        attachments: [],
        plusOneCounters: 0,
        untilEotMods: [],
      }],
    });
    expect(chooseReserveLand(reserveView, COLORLESS_DB, legalReserve)).toMatchObject({ reserveIndex: 1 });
  });

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
        severBranded: false,
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

  it('chooses reserve lands in Darlings games at every difficulty', () => {
    const game = new Game({
      decks: [DARLINGS_DECK, DARLINGS_DECK],
      darlings: ['bear', 'bear'],
      format: 'darlings',
      landReserves: [RESERVE, RESERVE],
      seed: 8130,
      db: TEST_DB,
    });
    keepBoth(game);
    const source = structuredClone(game.instanceState);
    source.players[0].hand = [];
    const darlings = Game.restore(source, TEST_DB);
    const reserveView = darlings.viewFor(0);
    const reserveLegal = darlings.legalActions(0);
    expect(reserveView.you.landReserve).toEqual(RESERVE);
    expect(reserveView.you.darlingZone).toBe('bear');
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ai = buildAI(difficulty, TEST_DB, 200 + difficulty.length);
      expect(ai.chooseAction(reserveView, reserveLegal)).toEqual({ type: 'playLand', handIndex: -1, reserveIndex: 5 });
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

  it('carries the live rules revision into HardAI determinized simulations', () => {
    const current = new Game({ decks: [SPELL_DECK, SPELL_DECK], seed: 8129, db: TEST_DB });
    keepBoth(current);
    const currentSim = determinize(current.viewFor(0), TEST_DB, 4244);
    expect(currentSim.instanceState.rulesRev).toBe(CURRENT_RULES_REV);
    expect(currentSim.instanceState.episode).toEqual({ resolvedSinceOffer: 0, reopensThisStep: 0 });

    const classic = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 8130,
      db: TEST_DB,
      rulesRev: 1,
    });
    keepBoth(classic);
    const classicSim = determinize(classic.viewFor(0), TEST_DB, 4245);
    expect('rulesRev' in classicSim.instanceState).toBe(false);
    expect('episode' in classicSim.instanceState).toBe(false);
  });

  it('preserves both Darlings public zones through determinization', () => {
    const game = new Game({
      decks: [DARLINGS_DECK, DARLINGS_DECK],
      darlings: ['bear', 'bear'],
      seed: 8131,
      db: TEST_DB,
      format: 'darlings',
      landReserves: [RESERVE, RESERVE],
    });
    keepBoth(game);
    const state = structuredClone(game.instanceState);
    state.players[0].darlingTax = 2;
    const simulated = determinize(Game.restore(state, TEST_DB).viewFor(0), TEST_DB, 4243);
    const restored = simulated.viewFor(0);
    expect(restored.you.landReserve).toEqual(RESERVE);
    expect(restored.opp.landReserve).toEqual(RESERVE);
    expect(restored.you).toMatchObject({ darlingZone: 'bear', darlingTax: 2 });
    expect(restored.opp).toMatchObject({ darlingZone: 'bear', darlingTax: 0 });
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
