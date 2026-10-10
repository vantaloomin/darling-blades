import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { DEFAULT_PERSONALITY } from '../../src/ai/personality';
import { MediumAI } from '../../src/ai/MediumAI';
import { validateAction, type Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { resolveStackItem } from '../../src/engine/resolve';
import { cardIdOf, validateModalDef, type CardDb, type CardDef, type GameState, type Permanent } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Modal spells (2.0, docs/plan-core-set-2-engine.md Part 7): "Choose up to N
 * —", chosen as the spell is cast, each chosen mode with its own target,
 * resolving in printed order.
 */
const ritual = (id: string, extra: Partial<CardDef>): CardDef => ({
  id, name: id, types: ['ritual'], subtypes: [], cost: { generic: 0, pips: {} }, colors: [], rarity: 'r', ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  stones: ritual('stones', {
    modal: {
      upTo: 2,
      modes: [
        { ops: [{ op: 'gainLife', n: 3 }] },
        { targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }] },
        { targets: [{ what: 'creature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] },
      ],
    },
  }),
  choice: ritual('choice', {
    modal: { upTo: 1, modes: [{ ops: [{ op: 'gainLife', n: 1 }] }, { targets: [{ what: 'opponentCreature' }], ops: [{ op: 'destroy', to: 'target' }] }] },
  }),
  plain: ritual('plain', { abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }] }] }),
  ox: { id: 'ox', name: 'ox', types: ['creature'], subtypes: [], cost: { generic: 3, pips: {} }, colors: [], attack: 3, defense: 3, rarity: 'c' },
};

function boardState(battlefield: Partial<Permanent>[], hand: string[]): GameState {
  const state = makeTestState({ battlefield, hands: [hand, []], active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(20).fill('forest');
  return state;
}

const casts = (game: Game) => game.legalActions(0).filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell');
const creature = (iid: number) => ({ kind: 'permanent', iid }) as const;
const perm = (game: Game, iid: number) => game.instanceState.battlefield.find((p) => p.iid === iid);

describe('modal spells', () => {
  it('are offered once per choice of modes and target, never a mode with no legal target', () => {
    const withTarget = Game.restore(boardState([{ iid: 1, cardId: 'ox', controller: 1 }], ['stones']), DB);
    expect(casts(withTarget).map((a) => [a.modes, a.targets ?? []])).toEqual([
      [[0], []], [[0, 1], [creature(1)]], [[0, 2], [creature(1)]],
      [[1], [creature(1)]], [[1, 2], [creature(1), creature(1)]], [[2], [creature(1)]],
    ]);
    const noCreatures = Game.restore(boardState([], ['stones']), DB);
    expect(casts(noCreatures).map((a) => a.modes)).toEqual([[0]]);
  });

  it('resolve each chosen mode in printed order on its own target', () => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'ox', controller: 1 }, { iid: 2, cardId: 'ox' }], ['stones']), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0, modes: [1, 2], targets: [creature(1), creature(2)] });
    expect(perm(game, 1)).toBeUndefined();
    expect(perm(game, 2)!.plusOneCounters).toBe(1);
    expect(game.instanceState.players[0].life).toBe(20);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['stones']);
  });

  it('skip a mode whose target is gone, and fizzle only when every chosen mode lost its target', () => {
    const resolveWithTargetGone = (modes: number[]) => {
      const state = boardState([], []);
      const events: GameEvent[] = [];
      resolveStackItem(state, DB, { sid: 50, cardId: 'stones', controller: 0, targets: [creature(1)], modes }, (e) => events.push(e));
      return { state, events: events.map((e) => e.e) };
    };
    const partial = resolveWithTargetGone([0, 1]);
    expect(partial.events).toContain('spellResolved');
    expect(partial.state.players[0].life).toBe(23);
    const fizzled = resolveWithTargetGone([1]);
    expect(fizzled.events).toContain('targetsFizzled');
    expect(fizzled.events).not.toContain('spellResolved');
    expect(fizzled.state.players[0].graveyard.map(cardIdOf)).toEqual(['stones']);
  });

  it('refuse a cast with no modes, too many, out of order, or modes on a card that has none', () => {
    const state = boardState([{ iid: 1, cardId: 'ox', controller: 1 }], ['stones', 'plain']);
    const check = (action: Action) => validateAction(state, DB, 0, action);
    expect(check({ type: 'castSpell', handIndex: 0 })).toMatch(/at least one mode/);
    expect(check({ type: 'castSpell', handIndex: 0, modes: [0, 1, 2], targets: [creature(1), creature(1)] })).toMatch(/too many/);
    expect(check({ type: 'castSpell', handIndex: 0, modes: [1, 0], targets: [creature(1)] })).toMatch(/printed order/);
    expect(check({ type: 'castSpell', handIndex: 0, modes: [0, 0] })).toMatch(/printed order/);
    expect(check({ type: 'castSpell', handIndex: 0, modes: [1] })).toMatch(/number of targets/);
    expect(check({ type: 'castSpell', handIndex: 1, modes: [0] })).toMatch(/not modal/);
  });

  it('read as "Choose up to two" with one line per mode', () => {
    expect(rulesText(DB.stones)).toBe([
      'Choose up to two —',
      '• You gain 3 life.',
      '• Deal 3 damage to target creature.',
      '• Mark target creature.',
    ].join('\n'));
    expect(rulesText(DB.choice).split('\n')[0]).toBe('Choose one —');
  });

  it('are refused by the validator outside a plain Ritual or Charm, or with a target op and no target', () => {
    expect(validateModalDef(DB.stones)).toEqual([]);
    expect(validateModalDef({ ...DB.ox, modal: DB.stones.modal })).toContain('Modal carrier must be a Ritual or Charm');
    expect(validateModalDef(ritual('bad', { modal: { upTo: 1, modes: [{ ops: [{ op: 'destroy', to: 'target' }] }, { ops: [{ op: 'draw', n: 1 }] }] } })))
      .toContain('A mode op that targets needs a target spec');
    expect(validateModalDef(ritual('bad', { modal: { upTo: 3, modes: [{ ops: [{ op: 'draw', n: 1 }] }, { ops: [{ op: 'gainLife', n: 1 }] }] } })))
      .toContain('Modal upTo must be from 1 to the number of modes');
  });

  it.each([
    ['Easy', () => new EasyAI(DB, 17, { ...DEFAULT_PERSONALITY, easyNoise: 0 })],
    ['Medium', () => new MediumAI(DB)],
    ['Hard', () => new HardAI(DB)],
  ])('%s picks the mode that destroys a creature over a life point', (_name, brain) => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'ox', controller: 1 }], ['choice']), DB);
    const cast = brain().chooseAction(game.viewFor(0), game.legalActions(0));
    expect(cast).toMatchObject({ type: 'castSpell', modes: [1], targets: [creature(1)] });
  });
});
