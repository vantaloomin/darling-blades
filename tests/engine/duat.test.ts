import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import type { CardDef, GameState, PlayerId } from '../../src/engine/types';
import { validateRiteDef } from '../../src/engine/types';
import {
  cardGlossaryEntries,
  MECHANIC_DEFINITIONS,
  riteText,
  rulesText,
} from '../../src/ui/rulesText';
import {
  finishReplay,
  recordReplayAction,
  replayDbStamp,
  replayGame,
  startReplayDraft,
} from '../../src/meta/Replay';
import { DUAT_DB, duatPermanent } from '../duatFixture';
import { botAction, makeTestState } from '../helpers';

function gameWith(opts: {
  hands?: [string[], string[]];
  battlefield?: ReturnType<typeof duatPermanent>[];
  configure?: (state: GameState) => void;
}): Game {
  const state = makeTestState({
    hands: opts.hands ?? [[], []],
    battlefield: opts.battlefield ?? [],
    active: 0,
  });
  opts.configure?.(state);
  return Game.restore(state, DUAT_DB);
}

function riteAction(game: Game, player: PlayerId = 0): Extract<Action, { type: 'castSpell' }> {
  const action = game.legalActions(player).find(
    (candidate): candidate is Extract<Action, { type: 'castSpell' }> =>
      candidate.type === 'castSpell' && candidate.sacrifices !== undefined,
  );
  if (!action) throw new Error('Rite cast was not legal');
  return action;
}

function eventIndex(events: GameEvent[], kind: GameEvent['e']): number {
  return events.findIndex((event) => event.e === kind);
}

describe('Sands of the Duat Rite validation', () => {
  const invalid = (overrides: Partial<CardDef>): string[] =>
    validateRiteDef({ ...DUAT_DB['du-rite-one'], ...overrides });

  it('enforces the v1 authoring fence while allowing Rite plus Empower', () => {
    expect(validateRiteDef(DUAT_DB['du-rite-empowered'])).toEqual([]);
    expect(invalid({ rite: { n: 0 } })).toContain('Rite count must be an integer of at least 1');
    expect(invalid({ rite: { n: 1.5 } })).toContain('Rite count must be an integer of at least 1');
    expect(invalid({ x: { min: 1 } })).toContain('Rite card cannot be X');
    expect(invalid({ retell: { cost: { generic: 1, pips: {} } } })).toContain(
      'Rite card cannot combine with Retell',
    );
    expect(invalid({ hauntlink: { cost: { generic: 1, pips: {} }, linked: { p: 1 } } })).toContain(
      'Rite card cannot combine with Hauntlink',
    );
    expect(invalid({ skim: { cost: { generic: 1, pips: {} } } })).toContain(
      'Rite card cannot combine with Skim',
    );
    expect(invalid({ subtypes: ['Aura'] })).toContain('Rite card cannot have cast targets');
    expect(invalid({
      abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [] }],
    })).toContain('Rite card cannot have cast targets');
  });
});

describe('Sands of the Duat Rite engine', () => {
  it('taps mana, pays fodder, and fires its dies token before the Rite spell resolves', () => {
    const game = gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(2, 'du-fodder-spawn')],
    });
    const cast = riteAction(game);
    expect(cast.sacrifices).toEqual([2]);

    const events = game.submit(0, { ...cast, manaPlan: [1] });
    expect(game.state.battlefield.find((perm) => perm.iid === 1)?.tapped).toBe(true);
    expect(game.state.battlefield.some((perm) => perm.iid === 2)).toBe(false);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-scarab-token')).toBe(true);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-rite-one')).toBe(true);
    expect(eventIndex(events, 'manaTapped')).toBeLessThan(eventIndex(events, 'died'));
    expect(eventIndex(events, 'tokenCreated')).toBeLessThan(eventIndex(events, 'spellCast'));
    expect(eventIndex(events, 'tokenCreated')).toBeLessThan(eventIndex(events, 'spellResolved'));
  });

  it('allows a mana creature to tap and then be sacrificed as the same cast cost', () => {
    const game = gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [duatPermanent(2, 'elf')],
    });
    const events = game.submit(0, {
      type: 'castSpell', handIndex: 0, manaPlan: [2], sacrifices: [2],
    });
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [2] });
    expect(events.some((event) => event.e === 'died' && event.iid === 2)).toBe(true);
  });

  it('blocks Rite with too little fodder and rejects every invalid sacrifice shape', () => {
    const short = gameWith({
      hands: [['du-rite-two'], []],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(2, 'du-cheap-fodder')],
    });
    expect(short.legalActions(0).some((action) => action.type === 'castSpell')).toBe(false);

    const game = gameWith({
      hands: [['du-rite-two'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(2, 'du-cheap-fodder'),
        duatPermanent(3, 'du-mid-body'),
        duatPermanent(4, 'du-cheap-fodder', 1),
        duatPermanent(5, 'du-relic'),
        { ...duatPermanent(6, 'du-cheap-fodder'), owner: 1 },
      ],
    });
    const submit = (sacrifices: number[]): void => {
      game.submit(0, { type: 'castSpell', handIndex: 0, sacrifices });
    };
    expect(() => submit([2])).toThrow(/exactly 2 sacrifices/);
    expect(() => submit([2, 2])).toThrow(/duplicate Rite sacrifice/);
    expect(() => submit([2, 999])).toThrow(/creatures you control/);
    expect(() => submit([2, 4])).toThrow(/creatures you control/);
    expect(() => submit([2, 5])).toThrow(/creatures you control/);
    expect(() => submit([2, 6])).not.toThrow();

    const ordinary = gameWith({ hands: [['bear'], []] });
    expect(() => ordinary.submit(0, {
      type: 'castSpell', handIndex: 0, sacrifices: [],
    })).toThrow(/card has no Rite cost/);
  });

  it('batches every departure before firing dies triggers in battlefield order', () => {
    const game = gameWith({
      hands: [['du-rite-two'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(20, 'du-raise-fodder'),
        duatPermanent(10, 'du-order-fodder'),
      ],
    });
    const events = game.submit(0, {
      type: 'castSpell', handIndex: 0, sacrifices: [10, 20], manaPlan: [1],
    });
    const died = events
      .filter((event): event is Extract<GameEvent, { e: 'died' }> => event.e === 'died')
      .map((event) => event.iid);
    const triggers = events
      .filter((event): event is Extract<GameEvent, { e: 'triggerFired' }> => event.e === 'triggerFired')
      .map((event) => event.iid);
    expect(died.slice(0, 2)).toEqual([20, 10]);
    expect(triggers.slice(0, 2)).toEqual([20, 10]);
    expect(events.map((event) => event.e).lastIndexOf('died')).toBeLessThan(
      eventIndex(events, 'triggerFired'),
    );
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-order-fodder')).toBe(true);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-raise-fodder')).toBe(false);
  });

  it('emits one canonical sacrifice set for each existing cast variant', () => {
    const game = gameWith({
      hands: [['du-rite-empowered'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(7, 'du-mid-body'),
        duatPermanent(8, 'du-cheap-fodder'),
      ],
    });
    const casts = game.legalActions(0).filter(
      (action): action is Extract<Action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    expect(casts).toHaveLength(2);
    expect(casts.map((cast) => cast.empowered === true)).toEqual([false, true]);
    expect(casts.map((cast) => cast.sacrifices)).toEqual([[7], [7]]);
  });

  it('casts a Rite creature from a full board because payment frees its slot', () => {
    const creatures = Array.from(
      { length: RULES.maxCreatures },
      (_, index) => duatPermanent(20 + index, 'du-cheap-fodder'),
    );
    const game = gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [duatPermanent(1, 'forest'), ...creatures],
    });
    const cast = riteAction(game);
    expect(cast.sacrifices).toEqual([20]);
    game.submit(0, { ...cast, manaPlan: [1] });
    expect(game.state.battlefield.filter(
      (perm) => DUAT_DB[perm.cardId].types.includes('creature'),
    )).toHaveLength(RULES.maxCreatures);
  });

  it('does not refund a paid sacrifice when the Rite spell is cancelled', () => {
    const game = gameWith({
      hands: [['du-rite-one'], ['du-counter']],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(2, 'du-fodder-spawn')],
    });
    game.submit(0, riteAction(game));
    expect(game.state.battlefield.some((perm) => perm.iid === 2)).toBe(false);
    const counter = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'stackItem',
    );
    if (!counter) throw new Error('Counter was not legal');
    const events = game.submit(1, counter);
    expect(events.some((event) => event.e === 'spellCountered')).toBe(true);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-rite-one')).toBe(false);
    expect(game.state.players[0].graveyard).toContain('du-fodder-spawn');
    expect(game.state.battlefield.some((perm) => perm.cardId === 'du-scarab-token')).toBe(true);
  });
});

describe('Sands of the Duat Rite rules text', () => {
  it('renders exact singular and plural reminders with a glossary entry and no em dash', () => {
    expect(riteText(DUAT_DB['du-rite-one'])).toBe(
      'Rite 1: As an additional cost to cast this, sacrifice 1 creature.',
    );
    expect(riteText(DUAT_DB['du-rite-two'])).toBe(
      'Rite 2: As an additional cost to cast this, sacrifice 2 creatures.',
    );
    expect(rulesText(DUAT_DB['du-rite-two'])).not.toContain('—');
    expect(cardGlossaryEntries(DUAT_DB['du-rite-one'])).toContainEqual({
      name: 'Rite',
      reminder: MECHANIC_DEFINITIONS.rite,
    });
  });
});

describe('Sands of the Duat Rite replay', () => {
  it('round-trips a logged sacrifices field to byte-identical state and events', () => {
    const seed = 7717;
    const deck = [
      ...Array.from({ length: 8 }, () => 'forest'),
      ...Array.from({ length: 8 }, () => 'du-fodder-spawn'),
      ...Array.from({ length: 8 }, () => 'du-rite-one'),
    ];
    const decks: [string[], string[]] = [[...deck], [...deck]];
    const game = new Game({ decks, seed, db: DUAT_DB });
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(DUAT_DB),
      seed,
      decks,
      context: {
        mode: 'practice', difficulty: 'medium', opponentId: null,
        opponentName: 'Duat Bot', gauntletRung: null,
      },
    });
    const events = [...game.initialEvents];
    let recordedRite = false;
    for (let guard = 0; guard < 500 && !recordedRite; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') throw new Error('Rite replay fixture ended early');
      const player = awaiting.player as PlayerId;
      const legal = game.legalActions(player);
      const rite = legal.find((action) =>
        action.type === 'castSpell' && action.sacrifices !== undefined,
      );
      const action = rite ?? botAction(legal);
      events.push(...game.submit(player, action));
      recordReplayAction(draft, player, action);
      recordedRite = action.type === 'castSpell' && action.sacrifices !== undefined;
    }
    expect(recordedRite).toBe(true);

    const log = finishReplay(draft, 'win', 0, game.state.turn);
    const riteStep = log.actions.find(
      (step) => step.a.type === 'castSpell' && step.a.sacrifices !== undefined,
    );
    expect(riteStep?.a).toMatchObject({ type: 'castSpell', sacrifices: expect.any(Array) });
    const revived = JSON.parse(JSON.stringify(log));
    const replayed = replayGame(revived, DUAT_DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(events));
  });
});
