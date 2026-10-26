import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { startTurn } from '../../src/engine/phases';
import { getEffectiveStats, isSwornActive } from '../../src/engine/statics';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/** Sworn (2.0, P6): active while you control a legendary creature. */
const zero = { generic: 0, pips: {} };
const creature = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], cost: zero, colors: [], attack: 2, defense: 2, rarity: 'c', ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  legend: creature('legend', { supertypes: ['legendary'] }),
  champion: creature('champion', { supertypes: ['legendary'], crownless: true }),
  relic: { ...creature('relic'), types: ['artifact'], supertypes: ['legendary'], attack: undefined, defense: undefined },
  sister: creature('sister', { abilities: [{ when: 'static', static: { scope: 'self', p: 1, t: 1, condition: 'swornActive' } }] }),
  temple: { ...creature('temple'), types: ['enchantment'], attack: undefined, defense: undefined, abilities: [{ when: 'dawn', condition: 'swornActive', ops: [{ op: 'draw', n: 1 }] }] },
  sworn_legend: creature('sworn_legend', { supertypes: ['legendary'], abilities: [{ when: 'static', static: { scope: 'self', p: 1, t: 0, condition: 'swornActive' } }] }),
};

const state = (battlefield: Partial<Permanent>[]): GameState => {
  const s = makeTestState({ battlefield });
  for (const player of s.players) player.deck = Array(10).fill('forest');
  return s;
};
const attackOf = (s: GameState, iid: number) => getEffectiveStats(s.battlefield, DB, iid).attack;

describe('Sworn', () => {
  it('is off with no legendary creature, and an opponent\'s legend does not turn it on', () => {
    expect(isSwornActive(state([{ iid: 1, cardId: 'sister' }]).battlefield, DB, 0)).toBe(false);
    const s = state([{ iid: 1, cardId: 'sister' }, { iid: 2, cardId: 'legend', controller: 1 }]);
    expect(isSwornActive(s.battlefield, DB, 0)).toBe(false);
    expect(attackOf(s, 1)).toBe(2);
  });

  it('turns on with any legendary creature you control, a crownless one included', () => {
    for (const cardId of ['legend', 'champion']) {
      const s = state([{ iid: 1, cardId: 'sister' }, { iid: 2, cardId }]);
      expect(attackOf(s, 1)).toBe(3);
    }
  });

  it('a legendary creature turns on its own Sworn', () => {
    expect(attackOf(state([{ iid: 1, cardId: 'sworn_legend' }]), 1)).toBe(3);
  });

  it('a legendary permanent that is not a creature does not turn it on', () => {
    expect(attackOf(state([{ iid: 1, cardId: 'sister' }, { iid: 2, cardId: 'relic' }]), 1)).toBe(2);
  });

  it('turns off when the legend leaves the battlefield', () => {
    const s = state([{ iid: 1, cardId: 'sister' }, { iid: 2, cardId: 'legend' }]);
    expect(attackOf(s, 1)).toBe(3);
    s.battlefield = s.battlefield.filter((p) => p.iid !== 2);
    expect(attackOf(s, 1)).toBe(2);
  });

  it('several legends do not stack it', () => {
    expect(attackOf(state([{ iid: 1, cardId: 'sister' }, { iid: 2, cardId: 'legend' }, { iid: 3, cardId: 'champion' }]), 1)).toBe(3);
  });

  it('gates a triggered ability when it would fire', () => {
    const off = state([{ iid: 1, cardId: 'temple' }]);
    startTurn(off, DB, () => {});
    const on = state([{ iid: 1, cardId: 'temple' }, { iid: 2, cardId: 'legend' }]);
    startTurn(on, DB, () => {});
    expect(on.players[0].hand.length - off.players[0].hand.length).toBe(1);
  });

  it('a Darling waiting in the command zone does not turn it on; cast, she does', () => {
    const s = state([{ iid: 1, cardId: 'sister' }]);
    s.players[0].darlingZone = 'legend';
    s.players[0].darlingTax = 0;
    const game = Game.restore(s, DB);
    expect(getEffectiveStats(game.instanceState.battlefield, DB, 1).attack).toBe(2);
    game.submit(0, { type: 'castDarling' });
    expect(getEffectiveStats(game.instanceState.battlefield, DB, 1).attack).toBe(3);
  });

  it('reads as a condition word on the card', () => {
    expect(rulesText(DB.sister)).toBe('Sworn: this gets +1/+1.');
    expect(rulesText(DB.temple)).toMatch(/^Sworn: during your Dawn, draw a card\.$/i);
  });
});
