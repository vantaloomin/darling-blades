import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import { reasonUncastable } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import type { GameState } from '../../src/engine/types';
import { rulesText, MECHANIC_DEFINITIONS } from '../../src/ui/rulesText';
import { makeTestState } from '../helpers';
import { DARK_TALES_DB, manaPermanent } from '../darkTalesFixture';

function gameWith(opts: {
  hands?: [string[], string[]];
  graveyards?: [string[], string[]];
  battlefield?: ReturnType<typeof manaPermanent>[];
  decks?: [string[], string[]];
  configure?: (state: GameState) => void;
}): Game {
  const state = makeTestState({
    hands: opts.hands ?? [[], []],
    battlefield: opts.battlefield ?? [],
    active: 0,
  });
  state.players[0].graveyard = [...(opts.graveyards?.[0] ?? [])];
  state.players[1].graveyard = [...(opts.graveyards?.[1] ?? [])];
  state.players[0].deck = [...(opts.decks?.[0] ?? [])];
  state.players[1].deck = [...(opts.decks?.[1] ?? [])];
  opts.configure?.(state);
  return Game.restore(state, DARK_TALES_DB);
}

function skimAction(game: Game): Extract<Action, { type: 'skim' }> {
  const action = game.legalActions(0).find(
    (candidate): candidate is Extract<Action, { type: 'skim' }> => candidate.type === 'skim',
  );
  if (!action) throw new Error('Skim was not legal');
  return action;
}

function retellAction(game: Game): Extract<Action, { type: 'castSpell' }> {
  return retellActionFor(game, 0);
}

function retellActionFor(game: Game, player: 0 | 1): Extract<Action, { type: 'castSpell' }> {
  const action = game.legalActions(player).find(
    (candidate): candidate is Extract<Action, { type: 'castSpell' }> =>
      candidate.type === 'castSpell' && candidate.retell === true,
  );
  if (!action) throw new Error('Retell was not legal');
  return action;
}

function onlyAction<T extends GameEvent['e']>(events: GameEvent[], kind: T): Extract<GameEvent, { e: T }> {
  const event = events.find((candidate) => candidate.e === kind);
  expect(event).toBeDefined();
  return event as Extract<GameEvent, { e: T }>;
}

describe('Dark Tales Skim', () => {
  it('pays a real mana plan, discards to the graveyard, draws immediately, and never uses the stack', () => {
    const game = gameWith({
      hands: [['skimCard'], []],
      battlefield: [manaPermanent(1)],
      decks: [['forest'], []],
    });
    const skim = skimAction(game);
    expect(skim).toMatchObject({ type: 'skim', handIndex: 0 });
    expect(() => game.submit(0, { ...skim, manaPlan: [999] })).toThrow(/not an untapped mana source/);

    const events = game.submit(0, { type: 'skim', handIndex: 0, manaPlan: [1] });
    expect(game.state.players[0].hand).toEqual(['forest']);
    expect(game.state.players[0].graveyard).toEqual(['skimCard']);
    expect(game.state.stack).toEqual([]);
    expect(events.some((event) => event.e === 'spellCast')).toBe(false);
    expect(onlyAction(events, 'skimmed')).toMatchObject({ player: 0, cardId: 'skimCard' });
    expect(events.some((event) => event.e === 'manaTapped')).toBe(true);
  });

  it('is legal at main, response, and end-step windows, and reasonUncastable sees it', () => {
    const main = gameWith({ hands: [['skimCard'], []], battlefield: [manaPermanent(1)] });
    expect(main.legalActions(0).some((action) => action.type === 'skim')).toBe(true);
    expect(reasonUncastable(main.state, DARK_TALES_DB, 0, 0)).toBeNull();

    const response = gameWith({
      hands: [['skimCard'], []],
      battlefield: [manaPermanent(1)],
      configure: (state) => {
        state.awaiting = { player: 0, kind: 'respond', over: { type: 'attackers' } };
      },
    });
    expect(response.legalActions(0).some((action) => action.type === 'skim')).toBe(true);
    expect(reasonUncastable(response.state, DARK_TALES_DB, 0, 0)).toBeNull();

    const end = gameWith({
      hands: [[], ['skimCard']],
      battlefield: [manaPermanent(1), manaPermanent(2, 'island', 1)],
      configure: (state) => {
        state.step = 'main2';
      },
    });
    end.submit(0, { type: 'passStep' });
    expect(end.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    expect(end.legalActions(1).some((action) => action.type === 'skim')).toBe(true);
  });

  it('lets the engine-level Skim draw from an empty deck and end the game by deck-out', () => {
    const game = gameWith({
      hands: [['skimCard'], []],
      battlefield: [manaPermanent(1)],
      decks: [[], []],
    });
    const events = game.submit(0, { type: 'skim', handIndex: 0, manaPlan: [1] });
    expect(game.state.winner).toBe(1);
    expect(game.state.winReason).toBe('deck');
    expect(events.at(-1)).toMatchObject({ e: 'gameEnded', winner: 1, reason: 'deck' });
  });
});

describe('Dark Tales Retell', () => {
  it('opens response and end-step windows for a payable Retell Charm in the graveyard', () => {
    const response = gameWith({
      hands: [['dualMode'], []],
      graveyards: [[], ['retellTargeted']],
      battlefield: [
        manaPermanent(1, 'mountain', 0),
        manaPermanent(2, 'island', 1),
        { ...manaPermanent(3, 'mountain', 1), cardId: 'bear' },
      ],
    });
    const castEvents = response.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(castEvents).toContainEqual({ e: 'responseWindowOpened', player: 1 });
    expect(response.awaiting.kind).toBe('respond');
    const responseRetell = retellActionFor(response, 1);
    expect(responseRetell).toMatchObject({ retell: true, graveIndex: 0 });
    const responseEvents = response.submit(1, responseRetell);
    expect(responseEvents.some((event) => event.e === 'spellResolved')).toBe(true);
    expect(response.state.players[1].severed).toEqual(['retellTargeted']);

    const end = gameWith({
      hands: [[], []],
      graveyards: [[], ['retellTargeted']],
      battlefield: [
        manaPermanent(4, 'island', 1),
        { ...manaPermanent(5, 'mountain', 1), cardId: 'bear' },
      ],
      configure: (state) => {
        state.step = 'main2';
      },
    });
    end.submit(0, { type: 'passStep' });
    expect(end.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    const endRetell = retellActionFor(end, 1);
    expect(endRetell).toMatchObject({ retell: true, graveIndex: 0 });
    const endEvents = end.submit(1, endRetell);
    expect(endEvents.some((event) => event.e === 'spellResolved')).toBe(true);
    expect(end.state.players[1].severed).toEqual(['retellTargeted']);
  });

  it('does not enumerate or validate a Retell card from the opponent graveyard', () => {
    const game = gameWith({
      graveyards: [[], ['retellTargeted']],
      battlefield: [manaPermanent(1, 'island')],
    });
    expect(game.legalActions(0).some((action) => action.type === 'castSpell' && action.retell)).toBe(false);
    expect(() => game.submit(0, {
      type: 'castSpell', handIndex: 0, graveIndex: 0, retell: true,
    })).toThrow(/bad hand index/);
  });

  it('restricts Retell to Rituals and Charms, even when other fixtures carry a block', () => {
    const game = gameWith({
      graveyards: [['retellCreature', 'retellArtifact'], []],
    });
    expect(game.legalActions(0).some((action) => action.type === 'castSpell' && action.retell)).toBe(false);
    expect(() => game.submit(0, {
      type: 'castSpell', handIndex: 0, graveIndex: 0, retell: true,
    })).toThrow(/cannot be Retold/);
  });

  it('uses retell.cost as an alternative cost and validates an explicit mana plan', () => {
    const game = gameWith({
      graveyards: [['retellRitual'], []],
      battlefield: [manaPermanent(1, 'island')],
    });
    const retell = retellAction(game);
    expect(retell).toMatchObject({ type: 'castSpell', retell: true, graveIndex: 0 });
    expect(() => game.submit(0, { ...retell!, manaPlan: [999] })).toThrow(/not an untapped mana source/);
    const events = game.submit(0, { ...retell!, manaPlan: [1] });
    expect(events.some((event) => event.e === 'manaTapped')).toBe(true);
    expect(game.state.players[0].graveyard).toEqual([]);
    expect(game.state.players[0].severed).toEqual(['retellRitual']);
    expect(game.state.players[1].life).toBe(18);
  });

  it('severs on resolution, including the R4 ops override instead of the printed body', () => {
    const game = gameWith({
      graveyards: [['dualMode'], []],
      battlefield: [
        manaPermanent(1, 'island'),
        { ...manaPermanent(2), cardId: 'bear', controller: 0, owner: 0 },
        { ...manaPermanent(3), cardId: 'bear', controller: 1, owner: 1 },
      ],
    });
    const retell = retellAction(game);
    const events = game.submit(0, retell);
    expect(game.state.fogThisTurn).toBe(true);
    expect(game.state.battlefield.filter((perm) => perm.cardId === 'bear')).toHaveLength(2);
    expect(game.state.players[0].severed).toEqual(['dualMode']);
    expect(events.some((event) => event.e === 'effectApplied' && event.op === 'preventCombat')).toBe(true);
  });

  it('severs on fizzle when a response removes the Retell target', () => {
    const game = gameWith({
      hands: [[], ['targetKill']],
      graveyards: [['retellTargeted'], []],
      battlefield: [
        manaPermanent(1, 'island'),
        { ...manaPermanent(20), cardId: 'bear', controller: 1, owner: 1 },
      ],
    });
    const cast = retellAction(game);
    // Target selection is the printed body because this Retell has no R4 override.
    const retell = { ...cast, targets: [{ kind: 'permanent' as const, iid: 20 }] };
    game.submit(0, retell);
    expect(game.awaiting.kind).toBe('respond');
    const kill = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'permanent',
    )!;
    const events = game.submit(1, kill);
    expect(events.some((event) => event.e === 'targetsFizzled')).toBe(true);
    expect(game.state.players[0].graveyard).toEqual([]);
    expect(game.state.players[0].severed).toEqual(['retellTargeted']);
  });

  it('severs on cancellation instead of re-burying the source', () => {
    const game = gameWith({
      hands: [[], ['counter']],
      graveyards: [['dualMode'], []],
      battlefield: [manaPermanent(1, 'island')],
    });
    const retell = retellAction(game);
    game.submit(0, retell);
    const retellSid = game.state.stack[0].sid;
    const counter = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'stackItem',
    )!;
    const events = game.submit(1, counter);
    expect(events.some((event) => event.e === 'spellCountered')).toBe(true);
    expect(events.some((event) => event.e === 'spellResolved' && event.sid === retellSid)).toBe(false);
    expect(game.state.players[0].graveyard).toEqual([]);
    expect(game.state.players[0].severed).toEqual(['dualMode']);
  });

  it('rejects X-cost Retell and Retell plus Empower', () => {
    const x = gameWith({
      graveyards: [['xRetell'], []],
      battlefield: [manaPermanent(1, 'island')],
    });
    expect(x.legalActions(0).some((action) => action.type === 'castSpell' && action.retell)).toBe(false);
    expect(() => x.submit(0, {
      type: 'castSpell', handIndex: 0, graveIndex: 0, retell: true,
    })).toThrow(/cannot be Retold/);

    const both = gameWith({ graveyards: [['retellEmpowered'], []] });
    expect(() => both.submit(0, {
      type: 'castSpell', handIndex: 0, graveIndex: 0, retell: true, empowered: true,
    })).toThrow(/Retell and Empower/);
  });

  it('keeps Skim and Retell seeded-deterministic', () => {
    const run = (): { state: string; events: string } => {
      const game = gameWith({
        hands: [['skimRetellCard'], []],
        decks: [['forest'], []],
        battlefield: [manaPermanent(1)],
      });
      const skimEvents = game.submit(0, { type: 'skim', handIndex: 0 });
      const retell = retellAction(game);
      const retellEvents = game.submit(0, retell);
      return { state: JSON.stringify(game.state), events: JSON.stringify([...skimEvents, ...retellEvents]) };
    };
    expect(run()).toEqual(run());
  });
});

describe('Dark Tales rules text', () => {
  it('adds closed-union glossary definitions and both oracle blocks without em-dashes', () => {
    const text = rulesText(DARK_TALES_DB.dualMode);
    expect(text).toContain('Retell {U}: You may cast this from your graveyard, then sever it.');
    expect(text).not.toContain('—');
    expect(MECHANIC_DEFINITIONS.skim).toBeTruthy();
    expect(MECHANIC_DEFINITIONS.retell).toBeTruthy();
    const both = rulesText(DARK_TALES_DB.skimRetellCard);
    expect(both).toContain('Skim {0}: Discard this card, then draw a card.');
    expect(both).toContain('Retell {0}: You may cast this from your graveyard, then sever it.');
  });
});
