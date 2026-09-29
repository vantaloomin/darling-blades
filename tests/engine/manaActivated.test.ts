import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { legalActions, validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { solveMana } from '../../src/engine/mana';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, CardDef, GameState, ManaActivatedDef, Permanent, PlayerId } from '../../src/engine/types';
import { validateManaActivatedDef } from '../../src/engine/types';
import {
  canReplay, finishReplay, isReplayLog, recordReplayAction, REPLAY_LOG_VERSION,
  replayDbStamp, replayGame, startReplayDraft,
} from '../../src/meta/Replay';
import { scoreCard } from '../../src/power/scoreCore';
import { rulesText } from '../../src/ui/rulesText';
import { botAction, makeTestState, TEST_DB } from '../helpers';

/**
 * A1.5, the repeatable mana ability at Charm speed (First Dawn's Shivan
 * Dragon pump, "{R}: This gets +1/+0 until Sunset."). The engine contract:
 * one `activateMana` action pays the cost `times` times and applies the ops
 * that many times, off the stack; it is offered wherever its controller could
 * cast a Charm; a payable one keeps the combat windows open for its
 * controller and no other window. Fixture cards only.
 */
type ManaActivation = Extract<Action, { type: 'activateMana' }>;

const FIREBREATH: ManaActivatedDef = { cost: { generic: 0, pips: { R: 1 } }, ops: [{ op: 'boost', p: 1, t: 0, scope: 'self' }] };
const creature = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: ['R'], rarity: 'c',
  cost: { generic: 1, pips: {} }, attack, defense, ...extra,
});
/** The working card's shape: {4}{R}{R} 5/5 Skyborne with the pump. */
const VYRA = creature('vyra', 5, 5, {
  name: 'Vyra, Ember-Sky Rider', supertypes: ['legendary'], subtypes: ['Human', 'Rider'], rarity: 'ur',
  cost: { generic: 4, pips: { R: 2 } }, keywords: ['skyborne'], manaActivated: [FIREBREATH],
});
const DB: CardDb = {
  ...TEST_DB,
  vyra: VYRA,
  /** The same pump on a ground body, so ordinary creatures can block it. */
  pumper: creature('pumper', 5, 5, { manaActivated: [FIREBREATH] }),
  wall: creature('wall', 1, 6),
  /** A blocker with the pump, for the defender's reply. */
  guard: creature('guard', 3, 6, { manaActivated: [FIREBREATH] }),
  brute: creature('brute', 6, 6),
  grunt: creature('grunt', 2, 2),
  shock: {
    id: 'shock', name: 'Shock', types: ['charm'], subtypes: [], colors: ['R'], rarity: 'c',
    cost: { generic: 0, pips: { R: 1 } }, abilities: [{ when: 'spell', targets: [{ what: 'player' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
  },
};

const PUMPER = 1;
let nextIid = 50;
const lands = (controller: PlayerId, n: number, cardId = 'mountain'): Partial<Permanent>[] =>
  Array.from({ length: n }, () => ({ iid: nextIid++, cardId, controller }));

function state(battlefield: Partial<Permanent>[], hands: [string[], string[]] = [[], []], active: PlayerId = 0): GameState {
  const st = makeTestState({ battlefield, hands, active });
  st.rulesRev = 4;
  st.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  st.nextIid = 200;
  for (const player of st.players) player.deck = Array.from({ length: 12 }, () => 'forest');
  return st;
}

const pumpsIn = (actions: Action[]): ManaActivation[] =>
  actions.filter((action): action is ManaActivation => action.type === 'activateMana');
const attackOf = (game: Game, iid: number): number => getEffectiveStats(game.instanceState.battlefield, DB, iid).attack;
const untappedMountains = (game: Game, player: PlayerId): number => game.instanceState.battlefield
  .filter((perm) => perm.controller === player && perm.cardId === 'mountain' && !perm.tapped).length;

/** P0 attacks with `attackers`, P1 blocks with `blocks`; returns the game at whatever comes next. */
function combat(battlefield: Partial<Permanent>[], attackers: number[], blocks: { blocker: number; attacker: number }[], hands?: [string[], string[]]): Game {
  const game = Game.restore(state(battlefield, hands), DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers });
  if (game.awaiting.kind === 'respond') game.submit(1, { type: 'passResponse' });
  game.submit(1, { type: 'declareBlockers', blocks });
  return game;
}

describe('activating a mana ability N times as one action', () => {
  it('pays the cost N times and gives +N/+0 until Sunset, in one event', () => {
    const game = Game.restore(state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 3), ...lands(0, 1, 'forest')]), DB);
    const [offer] = pumpsIn(game.legalActions(0));
    // One entry per ability, carrying the most that can be paid (the forest pays no {R}).
    expect(offer).toEqual({ type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 3 });
    const events = game.submit(0, { ...offer, times: 2 });
    expect(untappedMountains(game, 0)).toBe(1);
    expect(attackOf(game, PUMPER)).toBe(7);
    expect(getEffectiveStats(game.instanceState.battlefield, DB, PUMPER).defense).toBe(5);
    expect(events.filter((event) => event.e === 'manaActivated')).toEqual([
      { e: 'manaActivated', player: 0, iid: PUMPER, cardId: 'pumper', abilityIndex: 0, times: 2 },
    ]);
    // The ability is not spent: the last {R} can still be used.
    expect(pumpsIn(game.legalActions(0))).toEqual([{ ...offer, times: 1 }]);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
  });

  it('pays with an explicit mana plan for the whole count', () => {
    const game = Game.restore(state([{ iid: PUMPER, cardId: 'pumper' }, { iid: 60, cardId: 'mountain' }, { iid: 61, cardId: 'mountain' }]), DB);
    const action: ManaActivation = { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 2, manaPlan: [60] };
    expect(validateAction(game.instanceState, DB, 0, action)).not.toBeNull();
    game.submit(0, { ...action, manaPlan: [61, 60] });
    expect(attackOf(game, PUMPER)).toBe(7);
  });

  it('is not on the menu without the mana for one activation', () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 2, 'forest')]);
    expect(legalActions(st, DB, 0).some((action) => action.type === 'passStep')).toBe(true);
    expect(pumpsIn(legalActions(st, DB, 0))).toEqual([]);
  });

  it('counts a long run of payable activations without searching every ordering of the lands', () => {
    // Twelve red sources and a forest: the count's last probe asks for
    // thirteen {R}, which the factorial search took minutes to refuse.
    const st = state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 12), ...lands(0, 1, 'forest')]);
    const started = performance.now();
    expect(pumpsIn(legalActions(st, DB, 0))).toEqual([{ type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 12 }]);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('refuses a count above what can be paid, and a count below one', () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 2)]);
    const action: ManaActivation = { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 2 };
    expect(validateAction(st, DB, 0, action)).toBeNull();
    expect(validateAction(st, DB, 0, { ...action, times: 3 })).toBe('cannot pay for that many activations');
    expect(validateAction(st, DB, 0, { ...action, times: 0 })).not.toBeNull();
    expect(validateAction(st, DB, 0, { ...action, times: 1.5 })).not.toBeNull();
  });

  it('is not offered, and is refused, once the creature has left or changed hands', () => {
    const gone = state([...lands(0, 2)]);
    gone.players[0].graveyard.push('pumper');
    expect(pumpsIn(legalActions(gone, DB, 0))).toEqual([]);
    expect(validateAction(gone, DB, 0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 })).not.toBeNull();
    const stolen = state([{ iid: PUMPER, cardId: 'pumper', owner: 0, controller: 1 }, ...lands(0, 2)]);
    expect(pumpsIn(legalActions(stolen, DB, 0))).toEqual([]);
    expect(validateAction(stolen, DB, 0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 })).not.toBeNull();
  });

  it('needs no untapped or settled creature, since its cost has no tap', () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper', tapped: true, enteredThisTurn: true }, ...lands(0, 1)]);
    expect(pumpsIn(legalActions(st, DB, 0))).toEqual([{ type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 }]);
  });

  it('wears off at Sunset', () => {
    const game = Game.restore(state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 2)]), DB);
    game.submit(0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 2 });
    expect(attackOf(game, PUMPER)).toBe(7);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [] });
    game.submit(0, { type: 'passStep' });
    expect(game.instanceState.activePlayer).toBe(1);
    expect(attackOf(game, PUMPER)).toBe(5);
  });
});

describe('Charm-speed timing and the auto-pass rule', () => {
  it("opens the attacker's window over the blocks for a payable pump, and offers it there", () => {
    const game = combat([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 1), { iid: 2, cardId: 'brute', controller: 1 }],
      [PUMPER], [{ blocker: 2, attacker: PUMPER }]);
    expect(game.awaiting).toEqual({ player: 0, kind: 'respond', over: { type: 'blockers' } });
    game.submit(0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 });
    // Off the stack: the same player keeps the window, and passing it goes to damage.
    expect(game.awaiting).toEqual({ player: 0, kind: 'respond', over: { type: 'blockers' } });
    game.submit(0, { type: 'passResponse' });
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 2)).toBe(false);
  });

  it("opens the defender's window over the attackers for a pump on a creature that can block", () => {
    const st = state([{ iid: 3, cardId: 'grunt', controller: 0 }, { iid: PUMPER, cardId: 'pumper', controller: 1 }, ...lands(1, 1)]);
    const game = Game.restore(st, DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [3] });
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'attackers' } });
    expect(pumpsIn(game.legalActions(1))).toEqual([{ type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 }]);
  });

  it("gives the defender one reply to the attacker's pump, as to a Charm, and passing it ends combat's windows", () => {
    const board = (): Partial<Permanent>[] => [{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 1),
      { iid: 2, cardId: 'guard', controller: 1 }, ...lands(1, 2)];
    const blocks = [{ blocker: 2, attacker: PUMPER }];
    const game = combat(board(), [PUMPER], blocks);
    game.submit(0, { type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 1 });
    const events = game.submit(0, { type: 'passResponse' });
    expect(events).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'blockers' } });
    // The defender's own pump earns nothing more, even with a pump still
    // payable: passing goes to damage.
    game.submit(1, { type: 'activateMana', iid: 2, abilityIndex: 0, times: 1 });
    game.submit(1, { type: 'passResponse' });
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 2)).toBe(false);

    // With no pump from the attacker, the defender's payable pump earns no reply.
    const quiet = combat(board(), [PUMPER], blocks);
    quiet.submit(0, { type: 'passResponse' });
    expect(quiet.awaiting).toEqual({ player: 0, kind: 'main' });
  });

  it('skips a combat window when the pump cannot be paid, or its creature is out of the fight', () => {
    const unpaid = combat([{ iid: PUMPER, cardId: 'pumper' }, { iid: 2, cardId: 'wall', controller: 1 }],
      [PUMPER], [{ blocker: 2, attacker: PUMPER }]);
    expect(unpaid.awaiting.kind).toBe('main');
    const idle = combat([{ iid: PUMPER, cardId: 'pumper' }, { iid: 3, cardId: 'grunt' }, ...lands(0, 1), { iid: 2, cardId: 'wall', controller: 1 }],
      [3], [{ blocker: 2, attacker: 3 }]);
    expect(idle.awaiting.kind).toBe('main');
  });

  it('never opens a window outside combat: a main-phase spell and Sunset still auto-pass', () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper', controller: 1 }, ...lands(1, 2), ...lands(0, 2, 'forest')], [['bear'], []]);
    const game = Game.restore(st, DB);
    game.submit(0, legalActions(game.instanceState, DB, 0).find((action) => action.type === 'castSpell')!);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [] });
    game.submit(0, { type: 'passStep' });
    expect(game.instanceState.activePlayer).toBe(1);
  });

  it('is offered in a non-combat window its controller holds for a Charm', () => {
    const st = state([{ iid: PUMPER, cardId: 'pumper', controller: 1 }, ...lands(1, 2), ...lands(0, 2, 'forest')], [['bear'], ['shock']]);
    const game = Game.restore(st, DB);
    game.submit(0, legalActions(game.instanceState, DB, 0).find((action) => action.type === 'castSpell')!);
    // The Charm opened this window; the pump is on its menu too.
    expect(game.awaiting.kind).toBe('respond');
    expect(pumpsIn(game.legalActions(1))).toEqual([{ type: 'activateMana', iid: PUMPER, abilityIndex: 0, times: 2 }]);
  });
});

describe('the construct stays narrow (validator)', () => {
  const withAbility = (ability: unknown, extra: Partial<CardDef> = {}): CardDef =>
    ({ ...creature('shape', 2, 2), manaActivated: [ability as ManaActivatedDef], ...extra });

  it('accepts the working card', () => {
    expect(validateManaActivatedDef(VYRA)).toEqual([]);
  });

  it('refuses a targeted op, a tap cost, a non-creature, a free cost and any other effect', () => {
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, ops: [{ op: 'boost', p: 1, t: 0, scope: 'target' }] })))
      .toContain('A mana ability has no targets');
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, targets: [{ what: 'creature' }] })))
      .toContain('A mana ability has no targets');
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, cost: { tap: true, mana: FIREBREATH.cost } })))
      .toContain('A mana ability costs mana only (no tap)');
    expect(validateManaActivatedDef(withAbility(FIREBREATH, { types: ['artifact'] })))
      .toContain('A mana ability belongs on a creature');
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, cost: { generic: 0, pips: {} } })))
      .toContain('A mana ability costs at least one mana');
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, ops: [{ op: 'draw', n: 1 }] })))
      .toContain('A mana ability only boosts this creature until Sunset');
    expect(validateManaActivatedDef(withAbility({ ...FIREBREATH, ops: [{ op: 'boost', p: 1, t: 0, scope: 'self', keywords: ['firstBlade'] }] })))
      .toContain('A mana ability boost grants no keywords (+N/+M only)');
  });

  it('never offers an ability whose card fails the check', () => {
    const db: CardDb = { ...DB, pumper: { ...DB.pumper, manaActivated: [{ ...FIREBREATH, ops: [{ op: 'draw', n: 1 }] }] } };
    expect(pumpsIn(legalActions(state([{ iid: PUMPER, cardId: 'pumper' }, ...lands(0, 1)]), db, 0))).toEqual([]);
  });
});

describe('the card face and the scorer', () => {
  it('prints the pump with its mana cost and no tap symbol', () => {
    expect(rulesText(VYRA).split('\n')).toContain('{R}: This gets +1/+0 until Sunset.');
  });

  it('reports the pump as unpriced, never a made-up rate', () => {
    const score = scoreCard(VYRA);
    expect(score.unknowns.some((unknown) => unknown.startsWith('manaActivated'))).toBe(true);
    expect(score.parts.find((part) => part.label.includes('mana pump'))?.v).toBe(0);
  });
});

describe('replay', () => {
  function recordPumpGame(seed: number) {
    const deck = [...Array.from({ length: 10 }, () => 'mountain'), ...Array.from({ length: 10 }, () => 'pumper')];
    const decks: [string[], string[]] = [[...deck], [...deck]];
    const game = new Game({ db: DB, decks, seed, rulesRev: 4 });
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(DB), seed, decks,
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Pump fixture', gauntletRung: null },
    });
    const events = [...game.initialEvents];
    for (let guard = 0; guard < 3000; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') {
        return { game, events, log: finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn) };
      }
      const player = awaiting.player;
      // One body each, so the lands pile up and later pumps are paid several times.
      const fielded = game.instanceState.battlefield.some((perm) => perm.controller === player && perm.cardId === 'pumper');
      const legal = game.legalActions(player).filter((candidate) => !fielded || candidate.type !== 'castSpell');
      const pump = awaiting.kind === 'respond' ? pumpsIn(legal)[0] : undefined;
      const attacks = legal.filter((action): action is Extract<Action, { type: 'declareAttackers' }> => action.type === 'declareAttackers');
      let action: Action;
      if (pump) {
        const cost = { generic: 0, pips: { R: pump.times } };
        action = { ...pump, manaPlan: solveMana(game.instanceState, DB, player, cost)! };
      } else if (attacks.length > 0) {
        action = attacks.reduce((a, b) => (b.attackers.length > a.attackers.length ? b : a));
      } else {
        action = legal.find((candidate) => candidate.type === 'choosePlayDraw') ?? botAction(legal);
      }
      events.push(...game.submit(player, action));
      recordReplayAction(draft, player, action);
    }
    throw new Error('Pump fixture game did not terminate');
  }

  it('records pumps as single actions and replays every byte', () => {
    const recorded = recordPumpGame(4242);
    const pumps = recorded.log.actions.filter((step) => step.a.type === 'activateMana');
    expect(pumps.length).toBeGreaterThan(0);
    expect(pumps.some((step) => step.a.type === 'activateMana' && step.a.times > 1)).toBe(true);
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(revived.v).toBe(REPLAY_LOG_VERSION);
    expect(canReplay(revived, DB)).toBe(true);
    const replayed = replayGame(revived, DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });
});
