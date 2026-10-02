import { describe, expect, it } from 'vitest';
import { cardValue, empowerValue, opImpactValue, retellValue } from '../../src/ai/value';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef } from '../../src/engine/types';
import { viewFor, type PlayerView } from '../../src/engine/view';
import { makeTestState, TEST_DB } from '../helpers';

const bare: CardDef = { ...CARD_DB['rg-verdant-seidr'], id: 'bare', abilities: [] };
const DB: CardDb = {
  ...TEST_DB, ...CARD_DB, bare,
  ramp: { ...bare, id: 'ramp', abilities: [{ when: 'arrives', ops: [{ op: 'extraLandDrop' }] }] },
  ritual: { ...bare, id: 'ritual', types: ['ritual'], abilities: [{ when: 'spell', ops: [{ op: 'extraLandDrop' }] }] },
  blankRitual: { ...bare, id: 'blankRitual', types: ['ritual'] },
  dawn: { ...bare, id: 'dawn', abilities: [{ when: 'dawn', ops: [{ op: 'extraLandDrop' }] }] },
  mixedDawn: { ...bare, id: 'mixedDawn', abilities: [{ when: 'dawn', ops: [{ op: 'extraLandDrop' }, { op: 'foresee', n: 1 }] }] },
  foreseeDawn: { ...bare, id: 'foreseeDawn', abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }] },
  empower: { ...bare, id: 'empower', empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'extraLandDrop' }] } },
  drawRetell: { ...bare, id: 'drawRetell', types: ['ritual'],
    retell: { cost: { generic: 5, pips: {} } }, abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }] }] },
};

function position(lands: number, reserve: number, ownTurn = lands, pending = 0): PlayerView {
  const state = makeTestState({ battlefield: Array.from({ length: lands }, (_, i) =>
    ({ iid: i + 1, cardId: 'forest', controller: 0 })) });
  state.turn = ownTurn * 2 - 1;
  state.players[0].landReserve = Array<string>(reserve).fill('forest');
  state.players[0].landDropsUsed = pending ? 0 : 1;
  state.players[0].extraLandDrops = Math.max(0, pending - 1);
  return viewFor(state, 0);
}

const ramp = (view: PlayerView, n = 1) => opImpactValue({ op: 'extraLandDrop', n }, undefined, undefined, { view, db: DB });
const dawn = (view: PlayerView) => cardValue(DB, 'dawn', view) - cardValue(DB, 'bare', view);

describe('ramp buys untapped mana before the live reserve is spent', () => {
  it('keeps the turn-two anchor and loses value as the same reserve waits', () => {
    expect(ramp(position(2, 8))).toBeCloseTo(1.9);
    expect(ramp(position(2, 8, 6))).toBeGreaterThan(0);
    expect(ramp(position(2, 8, 6))).toBeLessThan(ramp(position(2, 8, 2)));
    expect(ramp(position(6, 4, 6))).toBeLessThan(ramp(position(2, 8, 6)));
  });

  it('prices spell, arrival and Empower drops on the same live schedule', () => {
    const early = position(2, 8);
    expect(cardValue(DB, 'ritual', early) - cardValue(DB, 'blankRitual', early)).toBeCloseTo(1.9);
    expect(cardValue(DB, 'ramp', early) - cardValue(DB, 'bare', early)).toBeCloseTo(1.9);
    expect(empowerValue(DB, 'empower', early)).toBeCloseTo(1.9);
    expect(empowerValue(DB, 'empower', position(8, 2))).toBeLessThan(1.9);
  });

  it('values Retell ramp by the current reserve and preserves its independent effects when spent', () => {
    const early = retellValue(DB, 'dt-chart-the-reef-road', position(2, 8));
    const exhausted = retellValue(DB, 'dt-chart-the-reef-road', position(10, 0));
    expect(early - exhausted).toBeCloseTo(1.9);
    expect(exhausted).toBeGreaterThan(0);
  });

  it.each([5, 0])('Medium includes the live ramp in its Retell choice with %i reserve lands', (reserve) => {
    const state = makeTestState({ battlefield: Array.from({ length: 5 }, (_, i) =>
      ({ iid: i + 1, cardId: 'forest', controller: 0 })) });
    state.turn = 9;
    state.players[0].landDropsUsed = 1;
    state.players[0].landReserve = Array<string>(reserve).fill('forest');
    state.players[0].graveyard = ['dt-chart-the-reef-road', 'drawRetell'];
    state.players[0].deck = Array<string>(20).fill('bear');
    const game = Game.restore(state, DB);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', retell: true, graveIndex: reserve ? 0 : 1 });
  });

  it.each([0, 1])('values the body alone with %i land left, even on an early turn', (reserve) => {
    const view = position(10 - reserve, reserve, 3);
    expect(cardValue(DB, 'ramp', view)).toBe(cardValue(DB, 'bare', view));
    expect(cardValue(DB, 'dawn', view)).toBe(cardValue(DB, 'bare', view));
    expect(ramp(view)).toBe(0);
    expect(empowerValue(DB, 'empower', view)).toBe(0);
  });

  it('spends existing land permissions before crediting another drop', () => {
    expect(ramp(position(8, 2, 8, 1))).toBe(0);
    expect(ramp(position(7, 3, 7, 1))).toBeGreaterThan(0);
    expect(ramp(position(7, 3, 7, 1))).toBeLessThan(ramp(position(7, 3, 7)));
  });

  it('caps multiple drops at the reserve and discounts stacked extra mana', () => {
    const view = position(3, 7);
    expect(ramp(view, 2)).toBeGreaterThan(ramp(view));
    expect(ramp(view, 2)).toBeLessThan(2 * ramp(view));
    expect(ramp(view, 50)).toBe(ramp(view, 7));
  });

  it('starts a new Dawn engine next turn and values only its remaining productive firings', () => {
    expect(dawn(position(2, 8))).toBeGreaterThan(dawn(position(5, 5)));
    expect(dawn(position(7, 3))).toBeGreaterThan(0);
    expect(dawn(position(8, 2))).toBe(0);
    expect(ramp(position(8, 2))).toBeGreaterThan(0);
    expect(dawn(position(2, 8))).toBeLessThan(ramp(position(2, 8), 8));
    // With three lands left at turn 7, the engine buys exactly one mana on
    // turn 9. The turn-2 anchor buys one on each turn 3..9. Price that lone
    // late mana with the documented 0.89 decay and 0.62 Dawn realization.
    const anchorMana = [2, 3, 4, 5, 6, 7, 8].reduce((sum, exponent) => sum + 0.89 ** exponent, 0);
    expect(dawn(position(7, 3))).toBeCloseTo(1.9 * 0.62 * 0.89 ** 8 / anchorMana);
  });

  it('counts own turns equally from either seat and does not mistake land count for turn', () => {
    const first = position(2, 8, 4);
    const second = { ...first, turn: 8, startingPlayer: 1 as const };
    expect(ramp(second)).toBe(ramp(first));
    // Land loss shortens neither player's remaining reserve schedule.
    expect(ramp(position(1, 8, 4))).toBe(ramp(first));
  });

  it('preserves a useful mixed trigger when only its ramp is exhausted', () => {
    const view = position(10, 0);
    expect(cardValue(DB, 'mixedDawn', view)).toBe(cardValue(DB, 'foreseeDawn', view));
    expect(cardValue(DB, 'mixedDawn', view)).toBeGreaterThan(cardValue(DB, 'bare', view));
  });

  it('starts the Dawn schedule on the next own turn when evaluating during the opponent turn', () => {
    const before = { ...position(2, 8, 2), activePlayer: 1 as const, turn: 4 };
    expect(dawn(before)).toBe(dawn(position(2, 8, 2)));
    const after = { ...before, turn: 6 };
    expect(dawn(after)).toBeLessThan(dawn(before));
  });

  it('does not promise a guaranteed reserve in classic or view-less estimates', () => {
    const view = position(2, 8);
    delete view.you.landReserve;
    expect(ramp(view)).toBe(0);
    expect(empowerValue(DB, 'empower')).toBe(0);
    expect(opImpactValue({ op: 'extraLandDrop' })).toBe(0);
  });

  it('does not credit one-shot permissions that expire before a land-play window', () => {
    const view = position(2, 8);
    expect(ramp({ ...view, activePlayer: 1 })).toBe(0);
    expect(ramp({ ...view, step: 'end' })).toBe(0);
  });
});
