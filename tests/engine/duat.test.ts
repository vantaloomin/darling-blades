import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import { resolveCombatDamage } from '../../src/engine/combat/damage';
import { fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import type { GameEvent } from '../../src/engine/events';
import { checkStateBased } from '../../src/engine/sba';
import { isSummoningSick } from '../../src/engine/statics';
import type { CardDb, CardDef, CardEntry, CardInstance, GameState, PlayerId } from '../../src/engine/types';
import { validateNineLivesDef, validatePreserveDef, validateRiteDef } from '../../src/engine/types';
import { CARD_DB } from '../../src/data/catalog';
import {
  cardGlossaryEntries,
  MECHANIC_DEFINITIONS,
  nineLivesText,
  preserveText,
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
  graveyards?: [CardEntry[], CardEntry[]];
  battlefield?: ReturnType<typeof duatPermanent>[];
  db?: CardDb;
  configure?: (state: GameState) => void;
}): Game {
  const state = makeTestState({
    hands: opts.hands ?? [[], []],
    battlefield: opts.battlefield ?? [],
    active: 0,
  });
  if (opts.graveyards) {
    state.players[0].graveyard = [...opts.graveyards[0]];
    state.players[1].graveyard = [...opts.graveyards[1]];
  }
  opts.configure?.(state);
  return Game.restore(state, opts.db ?? DUAT_DB);
}

function riteAction(game: Game, player: PlayerId = 0): Extract<Action, { type: 'castSpell' }> {
  const action = game.legalActions(player).find(
    (candidate): candidate is Extract<Action, { type: 'castSpell' }> =>
      candidate.type === 'castSpell' && candidate.sacrifices !== undefined,
  );
  if (!action) throw new Error('Rite cast was not legal');
  return action;
}

function preserveAction(game: Game, player: PlayerId = 0): Extract<Action, { type: 'preserveCard' }> {
  const action = game.legalActions(player).find(
    (candidate): candidate is Extract<Action, { type: 'preserveCard' }> =>
      candidate.type === 'preserveCard',
  );
  if (!action) throw new Error('Preserve action was not legal');
  return action;
}

function eventIndex(events: GameEvent[], kind: GameEvent['e']): number {
  return events.findIndex((event) => event.e === kind);
}

function mutableState(game: Game): GameState {
  return game.instanceState as GameState;
}

function runDestroy(
  state: GameState,
  iid: number,
  events: GameEvent[] = [],
  db: CardDb = DUAT_DB,
): void {
  runOps(
    state,
    db,
    (event) => events.push(event),
    { controller: 0, sourceCardId: 'du-relic', targets: [{ kind: 'permanent', iid }] },
    [{ op: 'destroy', to: 'target' }],
  );
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

describe('Sands of the Duat entersGraveyard trigger', () => {
  const graveyardTriggers = (events: GameEvent[]): Extract<GameEvent, { e: 'graveyardTriggerFired' }>[] =>
    events.filter(
      (event): event is Extract<GameEvent, { e: 'graveyardTriggerFired' }> => event.e === 'graveyardTriggerFired',
    );

  it('fires on death, discard, mill, and Rite sacrifice exactly once per graveyard entry', () => {
    const deathGame = gameWith({
      db: CARD_DB,
      battlefield: [duatPermanent(10, 'sd-claw-handed-embalmer')],
    });
    const deathEvents: GameEvent[] = [];
    runDestroy(mutableState(deathGame), 10, deathEvents, CARD_DB);
    expect(graveyardTriggers(deathEvents)).toHaveLength(1);
    expect(graveyardTriggers(deathEvents)[0]).toMatchObject({
      cardId: 'sd-claw-handed-embalmer',
      owner: 0,
      when: 'entersGraveyard',
    });
    expect(deathGame.state.players[1].life).toBe(19);

    const discardGame = gameWith({
      db: CARD_DB,
      hands: [[], ['sd-heart-jar-sentinel']],
    });
    const discardEvents: GameEvent[] = [];
    runOps(
      mutableState(discardGame),
      CARD_DB,
      (event) => discardEvents.push(event),
      { controller: 0, sourceCardId: 'discard-test', targets: [] },
      [{ op: 'discardRandom', n: 1, who: 'opponent' }],
    );
    expect(graveyardTriggers(discardEvents)).toHaveLength(1);
    expect(discardGame.state.players[0].life).toBe(19);

    const millGame = gameWith({ db: CARD_DB });
    mutableState(millGame).players[1].deck = ['sd-hollow-jar-attendant'];
    const millEvents: GameEvent[] = [];
    runOps(
      mutableState(millGame),
      CARD_DB,
      (event) => millEvents.push(event),
      { controller: 0, sourceCardId: 'mill-test', targets: [] },
      [{ op: 'grind', n: 1, who: 'opponent' }],
    );
    expect(graveyardTriggers(millEvents)).toHaveLength(1);
    expect(millEvents.filter((event) => event.e === 'tokenCreated')).toHaveLength(1);

    const sacrificeGame = gameWith({
      db: CARD_DB,
      hands: [['sd-sun-rope-hauler'], []],
      battlefield: [
        duatPermanent(1, 'land-mountain'),
        duatPermanent(2, 'land-mountain'),
        duatPermanent(3, 'land-mountain'),
        duatPermanent(10, 'sd-priestess-of-the-emptied-jar'),
    ],
  });
  const cast = riteAction(sacrificeGame);
    // Wave D4 (2026-08-20): Sun-Rope Hauler is now {1}{R}; preserve the
    // exact payment assertion with the reduced two-source mana plan.
    const sacrificeEvents = sacrificeGame.submit(0, { ...cast, manaPlan: [1, 2] });
    expect(graveyardTriggers(sacrificeEvents)).toHaveLength(1);
    expect(sacrificeEvents.filter((event) => event.e === 'triggerFired' && event.iid === 10)).toHaveLength(0);
  });
});

describe('Sands of the Duat Nine Lives validation', () => {
  const invalid = (overrides: Partial<CardDef>): string[] =>
    validateNineLivesDef({ ...DUAT_DB['du-nine-lives'], ...overrides });

  it('allows creature and Rite carriers while rejecting noncreatures and Hauntlink', () => {
    expect(validateNineLivesDef(DUAT_DB['du-nine-lives'])).toEqual([]);
    expect(invalid({ rite: { n: 1 } })).toEqual([]);
    expect(invalid({ types: ['ritual'] })).toContain('Nine Lives carrier must be a creature');
    expect(invalid({
      hauntlink: { cost: { generic: 1, pips: {} }, linked: { p: 1 } },
    })).toContain('Nine Lives card cannot combine with Hauntlink');
  });
});

describe('Sands of the Duat Preserve validation', () => {
  const invalid = (overrides: Partial<CardDef>): string[] =>
    validatePreserveDef({ ...DUAT_DB['du-preserve-small'], ...overrides });

  it('requires a non-negative creature cost, allows Rite and Nine Lives, and rejects Hauntlink', () => {
    expect(validatePreserveDef(DUAT_DB['du-preserve-small'])).toEqual([]);
    expect(invalid({ rite: { n: 1 }, nineLives: true })).toEqual([]);
    expect(invalid({ types: ['artifact'] })).toContain('Preserve carrier must be a creature');
    expect(invalid({ preserve: { cost: undefined } as never })).toContain('Preserve needs a mana cost');
    expect(invalid({ preserve: { cost: { generic: -1, pips: {} } } })).toContain(
      'Preserve cost must be non-negative',
    );
    expect(invalid({ preserve: { cost: { generic: 0, pips: { U: -1 } } } })).toContain(
      'Preserve cost must be non-negative',
    );
    expect(invalid({
      hauntlink: { cost: { generic: 1, pips: {} }, linked: { p: 1 } },
    })).toContain('Preserve card cannot combine with Hauntlink');
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

describe('Sands of the Duat Preserve engine', () => {
  it('pays, severs the physical card, copies its variant, fires arrival, and lets the token evaporate', () => {
    const original = {
      instanceId: 777,
      cardId: 'du-preserve-small',
      variantKey: 'etched-blue',
    } satisfies CardInstance;
    const game = gameWith({
      graveyards: [[original], []],
      battlefield: [duatPermanent(1, 'forest')],
    });
    const action = preserveAction(game);
    expect(action).toEqual({ type: 'preserveCard', graveIndex: 0 });

    const events = game.submit(0, { ...action, manaPlan: [1] });
    const state = mutableState(game);
    const copy = state.battlefield.find((perm) => perm.cardId === 'du-preserve-small');
    expect(copy).toMatchObject({
      cardId: 'du-preserve-small',
      variantKey: 'etched-blue',
      isToken: true,
      controller: 0,
      owner: 0,
      enteredThisTurn: true,
    });
    expect(copy?.instanceId).not.toBe(original.instanceId);
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.players[0].severed).toContainEqual(original);
    expect(state.players[0].life).toBe(21);
    expect(eventIndex(events, 'severed')).toBeLessThan(eventIndex(events, 'tokenCreated'));
    expect(eventIndex(events, 'tokenCreated')).toBeLessThan(eventIndex(events, 'triggerFired'));
    expect(events).toContainEqual(expect.objectContaining({
      e: 'tokenCreated',
      perm: expect.objectContaining({ cardId: 'du-preserve-small', isToken: true }),
    }));

    runDestroy(state, copy!.iid, events);
    expect(state.battlefield.some((perm) => perm.cardId === 'du-preserve-small')).toBe(false);
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.players[0].severed).toContainEqual(original);
  });

  it('enumerates one action per eligible card and blocks full boards and unpaid costs', () => {
    const choices = gameWith({
      graveyards: [['du-preserve-small', 'du-preserve-big', 'bear'], []],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(2, 'forest')],
    }).legalActions(0).filter(
      (action): action is Extract<Action, { type: 'preserveCard' }> =>
        action.type === 'preserveCard',
    );
    expect(choices.map((action) => action.graveIndex)).toEqual([0, 1]);

    const fullBoard = gameWith({
      graveyards: [['du-preserve-small'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        ...Array.from(
          { length: RULES.maxCreatures },
          (_, index) => duatPermanent(10 + index, 'du-cheap-fodder'),
        ),
      ],
    });
    expect(fullBoard.legalActions(0).some((action) => action.type === 'preserveCard')).toBe(false);
    expect(() => fullBoard.submit(0, { type: 'preserveCard', graveIndex: 0 })).toThrow(
      /creature battlefield cap reached/,
    );

    const unpaid = gameWith({ graveyards: [['du-preserve-small'], []], battlefield: [] });
    expect(unpaid.legalActions(0).some((action) => action.type === 'preserveCard')).toBe(false);
    expect(() => unpaid.submit(0, { type: 'preserveCard', graveIndex: 0 })).toThrow(
      /cannot pay cost/,
    );
  });

  it('rejects the wrong phase, an inactive player, bad indices, and non-Preserve cards', () => {
    const wrongPhase = gameWith({
      graveyards: [['du-preserve-small'], []],
      battlefield: [duatPermanent(1, 'forest')],
      configure: (state) => {
        state.step = 'combat';
        state.awaiting = { player: 0, kind: 'declareAttackers' };
      },
    });
    expect(() => wrongPhase.submit(0, { type: 'preserveCard', graveIndex: 0 })).toThrow(
      /during your main phase/,
    );

    const inactive = gameWith({
      graveyards: [['du-preserve-small'], []],
      battlefield: [duatPermanent(1, 'forest')],
      configure: (state) => {
        state.activePlayer = 1;
        state.awaiting = { player: 0, kind: 'main' };
      },
    });
    expect(inactive.legalActions(0).some((action) => action.type === 'preserveCard')).toBe(false);
    expect(() => inactive.submit(0, { type: 'preserveCard', graveIndex: 0 })).toThrow(
      /during your main phase/,
    );
    expect(() => gameWith({ graveyards: [[], []] }).submit(
      0,
      { type: 'preserveCard', graveIndex: 0 },
    )).toThrow(/bad graveyard index/);

    const ordinary = gameWith({
      graveyards: [['bear'], []],
      battlefield: [duatPermanent(1, 'forest')],
    });
    expect(() => ordinary.submit(0, { type: 'preserveCard', graveIndex: 0 })).toThrow(
      /card has no Preserve option/,
    );
  });

  it('does not let a preserved Nine Lives token return after it dies', () => {
    const game = gameWith({ graveyards: [['du-preserve-nine'], []] });
    game.submit(0, preserveAction(game));
    const state = mutableState(game);
    const copy = state.battlefield.find((perm) => perm.cardId === 'du-preserve-nine')!;
    expect(copy.isToken).toBe(true);

    runDestroy(state, copy.iid);
    expect(state.battlefield).toEqual([]);
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.players[0].severed).toHaveLength(1);
  });
});

describe('Sands of the Duat Nine Lives engine', () => {
  it('returns once through destroy with one mark as a fresh summoning-sick permanent', () => {
    const game = gameWith({ battlefield: [duatPermanent(10, 'du-nine-rider')] });
    const state = mutableState(game);
    const original = state.battlefield[0];
    const originalInstanceId = original.instanceId;
    const events: GameEvent[] = [];

    runDestroy(state, original.iid, events);
    const returned = state.battlefield.find((perm) => perm.cardId === 'du-nine-rider');
    expect(returned).toMatchObject({
      instanceId: originalInstanceId,
      plusOneCounters: 1,
      enteredThisTurn: true,
      owner: 0,
      controller: 0,
    });
    expect(returned?.iid).not.toBe(original.iid);
    expect(returned && isSummoningSick(state.battlefield, DUAT_DB, returned)).toBe(true);
    expect(state.players[0].life).toBe(21);
    expect(state.players[1].life).toBe(19);
    expect(events.findIndex(
      (event) => event.e === 'triggerFired' && event.when === 'dies',
    )).toBeLessThan(eventIndex(events, 'permanentEntered'));
    expect(events).toContainEqual(expect.objectContaining({
      e: 'permanentEntered',
      perm: expect.objectContaining({ plusOneCounters: 1 }),
    }));

    runDestroy(state, returned!.iid, events);
    expect(state.battlefield.some((perm) => perm.cardId === 'du-nine-rider')).toBe(false);
    expect(state.players[0].life).toBe(21);
    expect(state.players[1].life).toBe(18);
    expect(events.filter(
      (event) => event.e === 'triggerFired' && event.when === 'dies',
    )).toHaveLength(2);
    expect(state.players[0].graveyard).toContainEqual(
      expect.objectContaining({ instanceId: originalInstanceId, cardId: 'du-nine-rider' }),
    );
  });

  it('does not return when the dying permanent already carries a mark', () => {
    const game = gameWith({
      battlefield: [{ ...duatPermanent(10, 'du-nine-lives'), plusOneCounters: 1 }],
    });
    const state = mutableState(game);
    runDestroy(state, state.battlefield[0].iid);
    expect(state.battlefield).toEqual([]);
    expect(state.players[0].graveyard).toHaveLength(1);
  });

  it('finds the dying physical card by instance identity instead of card id', () => {
    const game = gameWith({ battlefield: [duatPermanent(10, 'du-nine-lives')] });
    const state = mutableState(game);
    const dyingInstanceId = state.battlefield[0].instanceId;
    state.players[0].graveyard.push({
      instanceId: 999,
      cardId: 'du-nine-lives',
      variantKey: null,
    } satisfies CardInstance);

    runDestroy(state, state.battlefield[0].iid);
    expect(state.battlefield[0]).toMatchObject({
      instanceId: dyingInstanceId,
      plusOneCounters: 1,
    });
    expect(state.players[0].graveyard).toEqual([
      expect.objectContaining({ instanceId: 999, cardId: 'du-nine-lives' }),
    ]);
  });

  it('returns a stolen body from its owner graveyard under its owner control', () => {
    const game = gameWith({
      battlefield: [{ ...duatPermanent(10, 'du-nine-lives', 1), owner: 0 }],
    });
    const state = mutableState(game);
    const stolen = state.battlefield[0];
    runDestroy(state, stolen.iid);
    expect(state.battlefield[0]).toMatchObject({
      instanceId: stolen.instanceId,
      owner: 0,
      controller: 0,
      plusOneCounters: 1,
    });
    expect(state.players[1].graveyard).toEqual([]);
  });

  it('finishes an SBA dies-trigger batch before returning bodies in battlefield order', () => {
    const game = gameWith({
      battlefield: [
        { ...duatPermanent(20, 'du-nine-rider'), damage: 2 },
        { ...duatPermanent(10, 'du-nine-rider'), damage: 2 },
      ],
    });
    const state = mutableState(game);
    const originalOrder = state.battlefield.map((perm) => perm.instanceId);
    const events: GameEvent[] = [];
    checkStateBased(state, DUAT_DB, (event) => events.push(event));

    const diesTriggerIndexes = events.flatMap((event, index) =>
      event.e === 'triggerFired' && event.when === 'dies' ? [index] : [],
    );
    const enteredIndexes = events.flatMap((event, index) =>
      event.e === 'permanentEntered' ? [index] : [],
    );
    expect(Math.max(...diesTriggerIndexes)).toBeLessThan(Math.min(...enteredIndexes));
    expect(state.battlefield.map((perm) => perm.instanceId)).toEqual(originalOrder);
    expect(state.battlefield.every((perm) => perm.plusOneCounters === 1)).toBe(true);
  });

  it('returns every mass-destroyed body marked and in battlefield order', () => {
    const game = gameWith({
      battlefield: [
        duatPermanent(20, 'du-nine-lives'),
        duatPermanent(10, 'du-nine-lives'),
      ],
    });
    const state = mutableState(game);
    const originalOrder = state.battlefield.map((perm) => perm.instanceId);
    runOps(
      state,
      DUAT_DB,
      () => {},
      { controller: 0, sourceCardId: 'du-relic', targets: [] },
      [{ op: 'massDestroy', filter: 'allCreatures' }],
    );
    expect(state.battlefield.map((perm) => perm.instanceId)).toEqual(originalOrder);
    expect(state.battlefield.every((perm) => perm.plusOneCounters === 1)).toBe(true);
  });

  it('leaves the card in the graveyard when its dies rider refills a full board', () => {
    const companions = Array.from(
      { length: RULES.maxCreatures - 1 },
      (_, index) => duatPermanent(30 + index, 'du-cheap-fodder'),
    );
    const game = gameWith({
      battlefield: [duatPermanent(10, 'du-nine-full'), ...companions],
    });
    const state = mutableState(game);
    const instanceId = state.battlefield[0].instanceId;
    runDestroy(state, state.battlefield[0].iid);

    expect(state.battlefield).toHaveLength(RULES.maxCreatures);
    expect(state.battlefield.some((perm) => perm.cardId === 'du-nine-full')).toBe(false);
    expect(state.players[0].graveyard).toContainEqual(
      expect.objectContaining({ instanceId, cardId: 'du-nine-full' }),
    );
  });

  it('does not return a token or a Darling diverted from the graveyard', () => {
    const tokenGame = gameWith({ battlefield: [duatPermanent(10, 'du-nine-token')] });
    const tokenState = mutableState(tokenGame);
    runDestroy(tokenState, tokenState.battlefield[0].iid);
    expect(tokenState.battlefield).toEqual([]);
    expect(tokenState.players[0].graveyard).toEqual([]);

    const darlingGame = gameWith({ battlefield: [duatPermanent(20, 'du-nine-lives')] });
    const darlingState = mutableState(darlingGame);
    const darling = darlingState.battlefield[0];
    darlingState.players[0].darlingZone = null;
    darlingState.players[0].darlingInstanceId = darling.instanceId;
    darlingState.players[0].darlingTax = 0;
    runDestroy(darlingState, darling.iid);
    expect(darlingState.battlefield).toEqual([]);
    expect(darlingState.players[0].graveyard).toEqual([]);
    expect(darlingState.players[0].darlingZone).toEqual(
      expect.objectContaining({ instanceId: darling.instanceId, cardId: 'du-nine-lives' }),
    );
  });

  it('returns after lethal combat damage through the SBA route', () => {
    const game = gameWith({
      battlefield: [
        duatPermanent(1, 'giant'),
        duatPermanent(2, 'du-nine-lives', 1),
      ],
    });
    const state = mutableState(game);
    state.combat = {
      attackers: [1],
      blocks: [{ blocker: 2, attacker: 1 }],
      phase: 'blockersDeclared',
      damagePrevented: false,
    };
    resolveCombatDamage(state, DUAT_DB, () => {});
    const returned = state.battlefield.find((perm) => perm.cardId === 'du-nine-lives');
    expect(returned).toMatchObject({ controller: 1, owner: 1, plusOneCounters: 1 });
    expect(returned?.iid).not.toBe(2);
  });

  it('treats addCounters before death as the intended Nine Lives anti-synergy', () => {
    const game = gameWith({ battlefield: [duatPermanent(10, 'du-nine-lives')] });
    const state = mutableState(game);
    const target = state.battlefield[0];
    runOps(
      state,
      DUAT_DB,
      () => {},
      { controller: 0, sourceCardId: 'du-relic', sourceIid: target.iid, targets: [] },
      [{ op: 'addCounters', n: 1, to: 'self' }],
    );
    expect(target.plusOneCounters).toBe(1);
    runDestroy(state, target.iid);
    expect(state.battlefield).toEqual([]);
    expect(state.players[0].graveyard).toHaveLength(1);
  });

  it('returns a Nine Lives creature sacrificed to pay Rite', () => {
    const game = gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(2, 'du-nine-lives')],
    });
    const before = mutableState(game).battlefield.find((perm) => perm.iid === 2)!;
    const cast = riteAction(game);
    expect(cast.sacrifices).toEqual([2]);
    game.submit(0, { ...cast, manaPlan: [1] });
    const returned = mutableState(game).battlefield.find(
      (perm) => perm.cardId === 'du-nine-lives',
    );
    expect(returned).toMatchObject({ instanceId: before.instanceId, plusOneCounters: 1 });
    expect(returned?.iid).not.toBe(before.iid);
  });

  it('uses the shared aftermath for branch destruction and a final Quest chapter', () => {
    const branchGame = gameWith({ battlefield: [duatPermanent(10, 'du-nine-artifact')] });
    const branchState = mutableState(branchGame);
    runOps(
      branchState,
      DUAT_DB,
      () => {},
      {
        controller: 0,
        sourceCardId: 'du-relic',
        targets: [{ kind: 'permanent', iid: branchState.battlefield[0].iid }],
      },
      [{ op: 'destroyArtifactOrSeverEnchantment', to: 'target' }],
    );
    expect(branchState.battlefield[0]).toMatchObject({
      cardId: 'du-nine-artifact', plusOneCounters: 1,
    });

    const questGame = gameWith({
      battlefield: [{ ...duatPermanent(20, 'du-nine-quest'), chapter: 1 }],
    });
    const questState = mutableState(questGame);
    const quest = questState.battlefield[0];
    fireTriggers(questState, DUAT_DB, () => {}, 'dawn', quest);
    expect(questState.battlefield[0]).toMatchObject({
      cardId: 'du-nine-quest', plusOneCounters: 1, chapter: 1,
    });
    expect(questState.battlefield[0].iid).not.toBe(quest.iid);
  });
});

describe('Sands of the Duat Rite rules text', () => {
  it('renders exact singular and plural reminders with a glossary entry and no em dash', () => {
    expect(riteText(DUAT_DB['du-rite-one'])).toBe(
      'Rite 1.',
    );
    expect(riteText(DUAT_DB['du-rite-two'])).toBe(
      'Rite 2.',
    );
    expect(rulesText(DUAT_DB['du-rite-two'])).not.toContain('—');
    expect(cardGlossaryEntries(DUAT_DB['du-rite-one'])).toContainEqual({
      name: 'Rite',
      reminder: MECHANIC_DEFINITIONS.rite,
    });
  });
});

describe('Sands of the Duat Nine Lives rules text', () => {
  it('renders the exact reminder and glossary entry without an em dash', () => {
    const reminder = 'Nine Lives.';
    expect(nineLivesText(DUAT_DB['du-nine-lives'])).toBe(reminder);
    expect(rulesText(DUAT_DB['du-nine-lives'])).toBe(reminder);
    expect(rulesText(DUAT_DB['du-nine-lives'])).not.toContain('\u2014');
    expect(cardGlossaryEntries(DUAT_DB['du-nine-lives'])).toContainEqual({
      name: 'Nine Lives',
      reminder: MECHANIC_DEFINITIONS.nineLives,
    });
  });
});

describe('Sands of the Duat Preserve rules text', () => {
  it('renders the real cost in the exact reminder and adds a glossary entry without an em dash', () => {
    const reminder = 'Preserve {1}.';
    expect(preserveText(DUAT_DB['du-preserve-small'])).toBe(reminder);
    expect(rulesText(DUAT_DB['du-preserve-small'])).toContain(reminder);
    expect(rulesText(DUAT_DB['du-preserve-small'])).not.toContain('\u2014');
    expect(cardGlossaryEntries(DUAT_DB['du-preserve-small'])).toContainEqual({
      name: 'Preserve',
      reminder: MECHANIC_DEFINITIONS.preserve,
    });
  });
});

describe('Sands of the Duat graveyard-entry and lintel rules text', () => {
  it('renders the new graveyard trigger sentence and the exact lintel branch text', () => {
    const card: CardDef = {
      ...DUAT_DB['du-nine-vanilla'],
      id: 'du-graveyard-entry',
      name: 'Duat Graveyard Entry',
      abilities: [{ when: 'entersGraveyard', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
    };
    expect(rulesText(card)).toBe('When this enters your graveyard, your opponent loses 1 life.');
    expect(rulesText(CARD_DB['sd-strike-the-lintel'])).toContain(
      'Destroy target artifact or sever target enchantment.',
    );
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

describe('Sands of the Duat Preserve replay', () => {
  it('round-trips a logged preserveCard action to byte-identical state and events', () => {
    const seed = 9183;
    const deck = [
      ...Array.from({ length: 8 }, () => 'forest'),
      ...Array.from({ length: 8 }, () => 'du-preserve-small'),
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
        opponentName: 'Duat Preserve Bot', gauntletRung: null,
      },
    });
    const events = [...game.initialEvents];
    let recordedPreserve = false;
    for (let guard = 0; guard < 500 && !recordedPreserve; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') throw new Error('Preserve replay fixture ended early');
      const player = awaiting.player as PlayerId;
      const legal = game.legalActions(player);
      const preserve = legal.find((action) => action.type === 'preserveCard');
      const rite = legal.find(
        (action) => action.type === 'castSpell' && action.sacrifices !== undefined,
      );
      const action = preserve ?? rite ?? botAction(legal);
      events.push(...game.submit(player, action));
      recordReplayAction(draft, player, action);
      recordedPreserve = action.type === 'preserveCard';
    }
    expect(recordedPreserve).toBe(true);

    const log = finishReplay(draft, 'win', 0, game.state.turn);
    expect(log.v).toBe(9);
    expect(log.actions.some((step) => step.a.type === 'preserveCard')).toBe(true);
    const revived = JSON.parse(JSON.stringify(log));
    const replayed = replayGame(revived, DUAT_DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(events));
  });
});
