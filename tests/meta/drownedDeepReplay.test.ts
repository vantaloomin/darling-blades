import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { CURRENT_RULES_REV } from '../../src/config/rules';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { finishReplay, startReplayDraft, replayDbStamp, recordReplayAction, replayGame, isReplayLog, canReplay } from '../../src/meta/Replay';
import { botAction, smallGreenDeck, TEST_DB } from '../helpers';
import { card, dbOf, spell } from '../drownedDeepFixture';
const db = dbOf(card('looter', { abilities: [{ when: 'arrives', ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }] }],
  activated: [{ cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] }, { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }] }] }),
  card('queen', { abilities: [{ when: 'attacks', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }, { when: 'dawn', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }] }),
  spell('edict', [{ op: 'sacrifice', n: 1, who: 'each' }]));
function record(seed: number, legacy = false) {
  const pool = legacy ? TEST_DB : db;
  const deck = legacy ? smallGreenDeck() : Array.from({ length: 36 }, (_, i) => ['looter', 'queen', 'edict'][i % 3]);
  const decks: [string[], string[]] = [[...deck], [...deck]];
  const game = new Game({ db: pool, decks, seed, rulesRev: 4 });
  const draft = startReplayDraft({ dbStamp: replayDbStamp(pool), seed, decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Vocabulary fixture', gauntletRung: null } });
  if (legacy) draft.v = 13;
  const events: GameEvent[] = [...game.initialEvents]; const choices: string[] = [];
  for (let guard = 0; guard < 2000 && game.awaiting.kind !== 'gameOver'; guard++) {
    const awaiting = game.awaiting;
    const player = awaiting.player; const legal = game.legalActions(player);
    let action: Action;
    if (legacy) action = botAction(legal);
    else {
      if (awaiting.kind === 'discardToHandSize' && awaiting.decision) choices.push('discard');
      if (awaiting.kind === 'chooseTarget') choices.push(awaiting.decision ?? 'trigger');
      const activation = legal.find(a => a.type === 'activate' && a.abilityIndex === 1);
      const cast = legal.find(a => a.type === 'castSpell' &&
        (pool[game.state.players[player].hand[a.handIndex]].id !== 'edict' || game.instanceState.battlefield.some(p => p.controller !== player)));
      const attack = legal.find(a => a.type === 'declareAttackers' && a.attackers.length > 0);
      action = activation ?? cast ?? attack ?? botAction(legal);
      if (game.instanceState.turn > 5 && ['discard', 'sacrifice', 'trigger'].every(c => choices.includes(c))) action = { type: 'concede' };
    }
    events.push(...game.submit(player, action)); recordReplayAction(draft, player, action);
  }
  expect(game.awaiting.kind).toBe('gameOver');
  const log = finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn);
  return { game, log, events, choices, pool };
}
describe('Drowned Deep replay v14 / rules revision 4', () => {
  it.each([17, 29, 43])('records every new choice at seed %i and round-trips JSON bytes', seed => {
    const recorded = record(seed); expect(CURRENT_RULES_REV).toBe(4); expect(recorded.log.v).toBe(14);
    expect(new Set(recorded.choices)).toEqual(new Set(['discard', 'sacrifice', 'trigger']));
    expect(recorded.log.actions.some(s => s.a.type === 'activate' && s.a.abilityIndex === 1)).toBe(true);
    const log = JSON.parse(JSON.stringify(recorded.log)); expect(isReplayLog(log)).toBe(true); expect(canReplay(log, recorded.pool)).toBe(true);
    const replayed = replayGame(log, recorded.pool);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
    expect(record(seed).log.actions).toEqual(recorded.log.actions);
  });
  it('replays a v13 log without the new shapes byte-identically', () => {
    const recorded = record(7611, true); expect(recorded.log.v).toBe(13);
    const replayed = replayGame(JSON.parse(JSON.stringify(recorded.log)), recorded.pool);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });
});
