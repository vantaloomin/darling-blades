import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { HAUNTLINK_DB } from '../hauntlinkFixture';
import { makeTestState } from '../helpers';

const DB: CardDb = { ...HAUNTLINK_DB, targeted_arrival: {
  id: 'targeted_arrival', name: 'targeted_arrival', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
  attack: 2, defense: 2, cost: { generic: 0, pips: {} },
  abilities: [{ when: 'arrives', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'destroy', to: 'target' }] }],
} };

function heldTrigger(target: number): Game {
  const state = makeTestState({ active: 1, hands: [['bear', 'giant'], ['targeted_arrival', 'elf']], battlefield: [
    { iid: 10, cardId: 'bear', controller: 0, attachments: [30] },
    { iid: 11, cardId: 'giant', controller: 0 },
    { iid: 30, cardId: 'hauntlink_enchantment', controller: 0, attachedTo: 10 },
  ] });
  state.rulesRev = 4;
  state.players[0].deck = ['elf', 'bear', 'giant'];
  state.players[1].deck = ['knight', 'flyer'];
  const game = Game.restore(state, DB);
  game.submit(1, { type: 'castSpell', handIndex: 0 });
  while (game.awaiting.kind === 'respond') game.submit(game.awaiting.player, { type: 'passResponse' });
  expect(game.awaiting.kind).toBe('chooseTarget');
  game.submit(1, { type: 'chooseTarget', target: { kind: 'permanent', iid: target } });
  expect(game.awaiting.kind).toBe('hauntlinkWindow');
  return game;
}

describe('public held triggers during Hauntlink windows', () => {
  it('shows both seats the held trigger and its chosen target while keeping hidden zones as counts', () => {
    const game = heldTrigger(10);
    for (const seat of [0, 1] as const) {
      const view = game.viewFor(seat);
      expect(view.pendingDecisions?.[0]).toMatchObject({ kind: 'resolveTrigger', sourceCardId: 'targeted_arrival',
        controller: 1, targets: [{ kind: 'permanent', iid: 10 }], ops: [{ op: 'destroy', to: 'target' }] });
      expect(view.opp.handCount).toBe(game.instanceState.players[seat === 0 ? 1 : 0].hand.length);
      expect(view.opp).not.toHaveProperty('hand');
      expect(view.you.deckCount).toBe(game.instanceState.players[seat].deck.length);
      expect(view.opp.deckCount).toBe(game.instanceState.players[seat === 0 ? 1 : 0].deck.length);
      expect(view.you).not.toHaveProperty('deck');
      expect(view.opp).not.toHaveProperty('deck');
      expect(view.stackClosed).toBe(game.instanceState.stackClosed);
    }
  });

  it('shows a held trigger and the paused flush to both seats whatever choice is open', () => {
    // A held dies trigger queued behind a plain arrival choice while a spell
    // still waits on the stack: public information, window or not.
    const state = makeTestState({ active: 1, hands: [[], []], battlefield: [
      { iid: 10, cardId: 'bear', controller: 0 },
      { iid: 12, cardId: 'targeted_arrival', controller: 1 },
    ] });
    state.rulesRev = 4;
    state.stack = [{ sid: 1, cardId: 'bear', controller: 1, targets: [] }];
    state.stackClosed = true;
    state.pendingDecisions = [
      { kind: 'chooseTarget', player: 1, sourceIid: 12, sourceCardId: 'targeted_arrival', abilityIndex: 0,
        spec: { what: 'opponentCreature' }, ops: [{ op: 'destroy', to: 'target' }] },
      { kind: 'resolveTrigger', controller: 1, sourceIid: 13, sourceCardId: 'giant', targets: [],
        ops: [{ op: 'loseLife', n: 2, who: 'opponent' }], offered: [], heldMidStep: true },
    ];
    state.awaiting = { player: 1, kind: 'chooseTarget', sourceIid: 12, abilityIndex: 0, targets: [{ kind: 'permanent', iid: 10 }] };
    const game = Game.restore(state, DB);
    for (const seat of [0, 1] as const) {
      const view = game.viewFor(seat);
      expect(view.pendingDecisions?.map((decision) => decision.kind)).toEqual(['chooseTarget', 'resolveTrigger']);
      expect(view.stackClosed).toBe(true);
    }
  });

  it('makes different chosen targets distinguishable in both views with the same Hauntlink menu', () => {
    const first = heldTrigger(10);
    const second = heldTrigger(11);
    expect(first.legalActions(0)).toEqual(second.legalActions(0));
    for (const seat of [0, 1] as const) {
      const { pendingDecisions: firstQueue, ...firstPublic } = first.viewFor(seat);
      const { pendingDecisions: secondQueue, ...secondPublic } = second.viewFor(seat);
      expect(firstPublic).toEqual(secondPublic);
      expect(firstQueue).not.toEqual(secondQueue);
      expect(firstQueue?.[0]).toHaveProperty('targets', [{ kind: 'permanent', iid: 10 }]);
      expect(secondQueue?.[0]).toHaveProperty('targets', [{ kind: 'permanent', iid: 11 }]);
    }
  });
});
