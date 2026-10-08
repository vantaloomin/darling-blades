import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, ManaActivatedDef, Permanent, PlayerId } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * When each brain spends the A1.5 pump ("{R}: This gets +1/+0 until
 * Sunset."), in the combat windows the engine keeps open for it. Hard reads
 * lethal, the fight's trade, a defending block and the race, within spare
 * mana; Medium and Easy share one simple rule. Fixture cards only.
 */
const FIREBREATH: ManaActivatedDef = { cost: { generic: 0, pips: { R: 1 } }, ops: [{ op: 'boost', p: 1, t: 0, scope: 'self' }] };
const creature = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: ['R'], rarity: 'c',
  cost: { generic: 1, pips: {} }, attack, defense, ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  pumper: creature('pumper', 5, 5, { manaActivated: [FIREBREATH] }),
  guard: creature('guard', 3, 6, { manaActivated: [FIREBREATH] }),
  brute: creature('brute', 6, 6),
  ogre: creature('ogre', 4, 4),
  grunt: creature('grunt', 2, 2),
  wall: creature('wall', 0, 9),
};

const PUMPER = 1;
const FOE = 2;
let nextIid = 50;
const lands = (controller: PlayerId, n: number, cardId = 'mountain'): Partial<Permanent>[] =>
  Array.from({ length: n }, () => ({ iid: nextIid++, cardId, controller }));

function state(battlefield: Partial<Permanent>[], hands: [string[], string[]] = [[], []]): GameState {
  const st = makeTestState({ battlefield, hands, active: 0 });
  st.rulesRev = 4;
  st.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  st.nextIid = 200;
  st.nextInstanceId = 1000;
  for (const player of st.players) player.deck = Array.from({ length: 12 }, () => 'forest');
  return st;
}

/** P0's pumper attacks; P1 blocks it with `blocker` (or not). Returns P0's window over the blocks. */
function attackerWindow(opts: { blocker?: string; mountains: number; extraLands?: Partial<Permanent>[]; oppLife?: number; hand?: string[] }): Game {
  const battlefield: Partial<Permanent>[] = [{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, opts.mountains), ...(opts.extraLands ?? [])];
  if (opts.blocker) battlefield.push({ iid: FOE, cardId: opts.blocker, controller: 1 });
  const st = state(battlefield, [opts.hand ?? [], []]);
  st.players[1].life = opts.oppLife ?? 20;
  const game = Game.restore(st, DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [PUMPER] });
  game.submit(1, { type: 'declareBlockers', blocks: opts.blocker ? [{ blocker: FOE, attacker: PUMPER }] : [] });
  expect(game.awaiting).toEqual({ player: 0, kind: 'respond', over: { type: 'blockers' } });
  return game;
}

const choose = (brain: AIPlayer, game: Game, player: PlayerId = 0): Action =>
  brain.chooseAction(game.viewFor(player), game.legalActions(player));
const pumpTimes = (action: Action): number | null => action.type === 'activateMana' ? action.times : null;

describe('Hard', () => {
  it('pumps a blocked attacker just enough to kill its blocker', () => {
    const game = attackerWindow({ blocker: 'brute', mountains: 3 });
    expect(pumpTimes(choose(new HardAI(DB), game))).toBe(1);
  });

  it('pumps an unblocked attacker for lethal, even with the mana a castable card wanted', () => {
    // Five damage leaves 7 life at 2; two pumps win. The bear in hand holds the
    // forest and one mountain, which the fight and race reads respect.
    const game = attackerWindow({ mountains: 2, extraLands: lands(0, 1, 'forest'), oppLife: 7, hand: ['bear'] });
    expect(pumpTimes(choose(new HardAI(DB), game))).toBe(2);
  });

  it('pumps an unblocked attacker when the damage takes a turn off its clock', () => {
    // 11 life: 6 left after the hit is two more swings of 5; one pump leaves 5, one swing.
    const game = attackerWindow({ mountains: 3, oppLife: 11 });
    expect(pumpTimes(choose(new HardAI(DB), game))).toBe(1);
  });

  it('spends nothing where the pump changes nothing', () => {
    // 20 life: 15 or 14 left is three more swings either way.
    expect(choose(new HardAI(DB), attackerWindow({ mountains: 1 }))).toEqual({ type: 'passResponse' });
    // The grunt dies to the unpumped attacker already.
    expect(choose(new HardAI(DB), attackerWindow({ blocker: 'grunt', mountains: 3 }))).toEqual({ type: 'passResponse' });
  });

  it('pumps a defending creature before blocks when it then kills an attacker it can block', () => {
    const st = state([{ iid: FOE, cardId: 'ogre', controller: 0 }, { iid: PUMPER, cardId: 'guard', controller: 1 }, ...lands(1, 2)]);
    const game = Game.restore(st, DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [FOE] });
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'attackers' } });
    const hard = new HardAI(DB);
    const action = choose(hard, game, 1);
    expect(action).toMatchObject({ type: 'activateMana', iid: PUMPER, times: 1 });
    game.submit(1, action);
    game.submit(1, choose(hard, game, 1));
    // The block search now sees a 4/6 against the 4/4 and takes the kill.
    expect(game.awaiting.kind).toBe('declareBlockers');
    expect(choose(hard, game, 1)).toEqual({ type: 'declareBlockers', blocks: [{ blocker: PUMPER, attacker: FOE }] });
  });

  it("replies to the attacker's pump after blocks, pumping its blocker to kill the attacker", () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 1), { iid: FOE, cardId: 'guard', controller: 1 }, ...lands(1, 2)]);
    const game = Game.restore(st, DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [PUMPER] });
    game.submit(1, { type: 'passResponse' });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: FOE, attacker: PUMPER }] });
    // The attacker's 6/5 now kills the 3/6; two pumps make the guard a 5/6 that trades back.
    game.submit(0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 });
    game.submit(0, { type: 'passResponse' });
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'blockers' } });
    expect(choose(new HardAI(DB), game, 1)).toMatchObject({ type: 'activateMana', iid: FOE, times: 2 });
  });
});

describe('Medium and Easy: the simple rule', () => {
  const brains: [string, () => AIPlayer][] = [['Medium', () => new MediumAI(DB)], ['Easy', () => new EasyAI(DB, 7)]];

  it.each(brains)('%s pumps an unblocked attacker with all the mana there is', (_, brain) => {
    expect(pumpTimes(choose(brain(), attackerWindow({ mountains: 3 })))).toBe(3);
  });

  it.each(brains)('%s pumps a blocked attacker the fewest times that win the fight', (_, brain) => {
    expect(pumpTimes(choose(brain(), attackerWindow({ blocker: 'brute', mountains: 3 })))).toBe(1);
  });

  it('Medium passes when the blocked fight cannot be won or is won already', () => {
    expect(choose(new MediumAI(DB), attackerWindow({ blocker: 'wall', mountains: 3 }))).toEqual({ type: 'passResponse' });
    expect(choose(new MediumAI(DB), attackerWindow({ blocker: 'grunt', mountains: 3 }))).toEqual({ type: 'passResponse' });
  });
});
