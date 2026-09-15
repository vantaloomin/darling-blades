import { describe, expect, it } from 'vitest';
import type { CardInstance, PlayerId } from '../../src/engine/types';
import { viewFor } from '../../src/engine/view';
import { makeTestState } from '../helpers';

function card(instanceId: number, deadline?: PlayerId): CardInstance {
  return {
    instanceId, cardId: 'bear', variantKey: 'private-presentation-value',
    ...(deadline === undefined ? {} : { whispersUntilDawnOf: deadline }),
  };
}

describe('Whispers public view', () => {
  it('publishes owner-live indices on both sides without collapsing duplicate cards', () => {
    const state = makeTestState({});
    state.players[0].graveyard = ['bear', card(10, 1), card(11, 0), card(12), card(13, 1)];
    state.players[1].graveyard = [card(20, 0), card(21, 1), 'bear', card(22, 0)];
    const first = viewFor(state, 0);
    const second = viewFor(state, 1);
    expect(first.you.graveyard).toEqual(Array(5).fill('bear'));
    expect(first.opp.graveyard).toEqual(Array(4).fill('bear'));
    expect(first.you.whispersLive).toEqual([1, 4]);
    expect(first.opp.whispersLive).toEqual([0, 3]);
    expect(second.you.whispersLive).toEqual(first.opp.whispersLive);
    expect(second.opp.whispersLive).toEqual(first.you.whispersLive);
  });

  it.each([0, 1] as const)('keeps hidden zones and instance metadata redacted for seat %i', (player) => {
    const state = makeTestState({});
    const opponent = player === 0 ? 1 : 0;
    state.players[player].hand = ['bear'];
    state.players[player].deck = ['my-secret-deck-card'];
    state.players[opponent].hand = ['their-secret-hand-card'];
    state.players[opponent].deck = ['their-secret-deck-card'];
    state.players[player].graveyard = [card(10, opponent)];
    state.players[opponent].graveyard = [card(20, player)];
    const view = viewFor(state, player);
    expect(view.you.hand).toEqual(['bear']);
    expect(view.you.deckCount).toBe(1);
    expect(view.opp.handCount).toBe(1);
    expect(view.opp.deckCount).toBe(1);
    expect(view.opp).not.toHaveProperty('hand');
    expect(view.you).not.toHaveProperty('deck');
    expect(view.opp).not.toHaveProperty('deck');
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('private-presentation-value');
    expect(serialized).not.toContain('whispersUntilDawnOf');
    expect(view.you.whispersLive).toEqual([0]);
    expect(view.opp.whispersLive).toEqual([0]);
  });

  it('returns fresh index arrays without mutating or sharing the graveyard', () => {
    const state = makeTestState({});
    state.players[0].graveyard = [card(10, 1)];
    state.players[1].graveyard = [card(20, 0)];
    const before = structuredClone(state);
    const view = viewFor(state, 0);
    expect(state).toEqual(before);
    view.you.whispersLive.push(100);
    view.opp.whispersLive.length = 0;
    view.you.graveyard[0] = 'changed';
    expect(state).toEqual(before);
    expect(viewFor(state, 0).you.whispersLive).toEqual([0]);
    expect(viewFor(state, 0).opp.whispersLive).toEqual([0]);
  });

  it('removes expired markers and follows surviving entries after a graveyard shift', () => {
    const state = makeTestState({});
    const expiring = card(10, 1);
    state.players[0].graveyard = [expiring, card(11, 1)];
    expect(viewFor(state, 0).you.whispersLive).toEqual([0, 1]);
    delete expiring.whispersUntilDawnOf;
    expect(viewFor(state, 0).you.whispersLive).toEqual([1]);
    state.players[0].graveyard.shift();
    expect(viewFor(state, 0).you.whispersLive).toEqual([0]);
    state.players[0].graveyard.length = 0;
    expect(viewFor(state, 0).you.whispersLive).toEqual([]);
    expect(viewFor(state, 0).opp.whispersLive).toEqual([]);
  });
});
