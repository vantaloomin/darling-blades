import { describe, expect, it } from 'vitest';
import {
  finishReplay,
  isReplayLog,
  recordReplayAction,
  replayDbStamp,
  replayGame,
  startReplayDraft,
  type ReplayContext,
} from '../../src/meta/Replay';
import { Game } from '../../src/engine/Game';
import { botAction, deckOf, TEST_DB } from '../helpers';

const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];
const SPELL_DECK = Array.from({ length: 50 }, () => 'bear');
const LEGACY_WARCHEST_FORMAT = 'battle' + 'Box';
const CONTEXT: ReplayContext = {
  mode: 'practice',
  difficulty: 'medium',
  opponentId: null,
  opponentName: 'Reserve Test',
  gauntletRung: null,
};

function recordToEnd(
  game: Game,
  reserve = false,
  seed = 4411,
  decks: [string[], string[]] = [SPELL_DECK, SPELL_DECK],
) {
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(TEST_DB),
    seed,
    decks,
    context: CONTEXT,
    ...(reserve ? { format: 'warchest' as const, landReserves: [RESERVE, RESERVE] as [string[], string[]] } : {}),
  });
  const eventLog = [...game.initialEvents];
  for (let i = 0; i < 2000 && game.instanceState.winner === null; i++) {
    const awaiting = game.instanceState.awaiting;
    if (!('player' in awaiting)) break;
    const player = awaiting.player;
    const action = botAction(game.legalActions(player));
    recordReplayAction(draft, player, action);
    eventLog.push(...game.submit(player, action));
  }
  expect(game.instanceState.winner).not.toBeNull();
  return { log: finishReplay(draft, 'win', 123, game.instanceState.turn), eventLog, state: game.instanceState };
}

describe('Warchest replay v8', () => {
  it('reconstructs ordered reserves and reproduces a reserve game byte-identically', () => {
    const game = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 4411,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    });
    const original = recordToEnd(game, true);
    expect(original.log.v).toBe(9); // Current logs include Preserve actions under revision 3.
    expect(original.log.format).toBe('warchest');
    expect(original.log.landReserves).toEqual([RESERVE, RESERVE]);
    expect(isReplayLog(original.log)).toBe(true);

    const missingReserve = { ...original.log, landReserves: undefined };
    expect(isReplayLog(missingReserve)).toBe(false);
    expect(() => replayGame(missingReserve, TEST_DB)).toThrow(
      'This reserve replay is missing its land-reserve payload.',
    );

    const classicWithReserve = { ...original.log, format: undefined };
    expect(isReplayLog(classicWithReserve)).toBe(false);

    const replayed = replayGame(original.log, TEST_DB);
    expect(replayed.eventLog).toEqual(original.eventLog);
    expect(replayed.game.instanceState).toEqual(original.state);
  });

  it('refuses v3 logs with the established older-version wording', () => {
    const game = new Game({ decks: [SPELL_DECK, SPELL_DECK], seed: 4411, db: TEST_DB });
    const original = recordToEnd(game);
    const oldLog = { ...original.log, v: 3 };
    expect(() => replayGame(oldLog, TEST_DB)).toThrow(
      'This replay was recorded with an older replay version and cannot be replayed.',
    );
  });

  it('canonicalizes a fixture log recorded with the legacy Warchest format spelling', () => {
    const game = new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 4411,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    });
    const original = recordToEnd(game, true);
    const legacyLog: unknown = { ...original.log, format: LEGACY_WARCHEST_FORMAT };

    expect(isReplayLog(legacyLog)).toBe(true);
    if (!isReplayLog(legacyLog)) throw new Error('Legacy replay fixture did not validate.');
    expect(legacyLog.format).toBe('warchest');

    const replayed = replayGame(legacyLog, TEST_DB);
    expect(replayed.eventLog).toEqual(original.eventLog);
    expect(replayed.game.instanceState).toEqual(original.state);
  });

  it('keeps a fixed classic replay free of reserve fields and byte-identical', () => {
    const decks = [deckOf([['forest', 8], ['bear', 12]]), deckOf([['forest', 8], ['bear', 12]])] as [string[], string[]];
    const game = new Game({ decks, seed: 9917, db: TEST_DB });
    const original = recordToEnd(game, false, 9917, decks);
    expect(original.log.format).toBeUndefined();
    expect(original.log.landReserves).toBeUndefined();
    const replayed = replayGame(original.log, TEST_DB);
    expect(replayed.eventLog).toEqual(original.eventLog);
    expect(replayed.game.instanceState).toEqual(original.state);
  });
});
