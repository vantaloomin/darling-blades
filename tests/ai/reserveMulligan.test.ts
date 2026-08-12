import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { PlayerView } from '../../src/engine/view';
import { TEST_DB } from '../helpers';

const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'forest', 'plains', 'forest', 'swamp', 'forest'];

function mulliganView(hand: string[], overrides: { mulligans?: number; reserve?: boolean } = {}): PlayerView {
  const reserve = overrides.reserve ?? true;
  return {
    myId: 0,
    turn: 1,
    step: 'main1',
    activePlayer: 0,
    startingPlayer: 0,
    you: {
      life: 20,
      hand,
      deckCount: 40,
      graveyard: [],
      severed: [],
      ...(reserve ? { landReserve: RESERVE } : {}),
      landDropsRemaining: 1,
      mulligans: overrides.mulligans ?? 0,
    },
    opp: {
      life: 20,
      handCount: 7,
      deckCount: 40,
      graveyard: [],
      severed: [],
      ...(reserve ? { landReserve: RESERVE } : {}),
      landDropsRemaining: 1,
      mulligans: 0,
    },
    battlefield: [],
    stack: [],
    combat: null,
    fogThisTurn: false,
    awaiting: { player: 0, kind: 'mulligan' },
    winner: null,
  };
}

const LEGAL = [{ type: 'keepHand' as const }, { type: 'mulligan' as const }];

// Reserve decks contain zero lands, so the classic land-count keep bands would
// mulligan every hand to the >= 2 stop (the flat 2.00 telemetry artifact).
describe('reserve-format mulligans', () => {
  it('Easy keeps any reserve-format hand', () => {
    const ai = new EasyAI(TEST_DB, 1);
    const allExpensive = Array(7).fill('dt_rhino');
    expect(ai.chooseAction(mulliganView(allExpensive), LEGAL)).toEqual({ type: 'keepHand' });
  });

  it('Easy still mulligans a landless hand in classic games', () => {
    const ai = new EasyAI(TEST_DB, 1);
    const spells = Array(7).fill('bear');
    expect(ai.chooseAction(mulliganView(spells, { reserve: false }), LEGAL)).toEqual({ type: 'mulligan' });
  });

  it('Medium keeps a reserve hand with two spells castable by turn 3', () => {
    const ai = new MediumAI(TEST_DB);
    const curve = ['bear', 'bear', 'giant', 'giant', 'giant', 'dt_rhino', 'dt_rhino'];
    expect(ai.chooseAction(mulliganView(curve), LEGAL)).toEqual({ type: 'keepHand' });
  });

  it('Medium mulligans a reserve hand with no early plays, then loosens to one', () => {
    const ai = new MediumAI(TEST_DB);
    const topHeavy = Array(7).fill('giant');
    expect(ai.chooseAction(mulliganView(topHeavy), LEGAL)).toEqual({ type: 'mulligan' });

    const oneEarly = ['bear', 'giant', 'giant', 'giant', 'giant', 'giant'];
    expect(ai.chooseAction(mulliganView(oneEarly, { mulligans: 1 }), LEGAL)).toEqual({ type: 'keepHand' });
    expect(ai.chooseAction(mulliganView(topHeavy, { mulligans: 1 }), LEGAL)).toEqual({ type: 'mulligan' });
  });

  it('Medium stops at two mulligans regardless of hand quality', () => {
    const ai = new MediumAI(TEST_DB);
    const topHeavy = Array(5).fill('giant');
    expect(ai.chooseAction(mulliganView(topHeavy, { mulligans: 2 }), LEGAL)).toEqual({ type: 'keepHand' });
  });
});
