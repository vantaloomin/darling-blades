import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';
import { HAUNTLINK_DB } from '../hauntlinkFixture';

/**
 * A targeted arrival trigger defers its target choice (`pendingDecisions`),
 * and its ops run when the choice comes back. Nothing then checked state-based
 * actions: a creature dealt lethal damage by such a trigger stayed on the
 * battlefield, and if the trigger fired in main 2 - after the attackers-step
 * check - cleanup zeroed the damage and it simply lived. Found 2026-09-04
 * while chasing an owner report that Hauntlink "as a Charm reaction to
 * something dying" misbehaved: the host that should have died never did.
 */
const DB: CardDb = {
  ...TEST_DB,
  ...HAUNTLINK_DB,
  arrival_burner: {
    id: 'arrival_burner',
    name: 'Arrival Burner',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    rarity: 'c',
    abilities: [{ when: 'arrives', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
  },
};

function castAndTarget(game: Game, caster: 0 | 1, targetIid: number): void {
  const cast = game.legalActions(caster).find((a) => a.type === 'castSpell');
  expect(cast).toBeDefined();
  game.submit(caster, cast!);
  const other = caster === 0 ? 1 : 0;
  const window = game.awaiting;
  if (window.kind === 'respond' && window.player === other) game.submit(other, { type: 'passResponse' });
  expect(game.awaiting).toMatchObject({ player: caster, kind: 'chooseTarget' });
  const pick = game.legalActions(caster).find((a) => JSON.stringify(a).includes(`"iid":${targetIid}`));
  expect(pick).toBeDefined();
  game.submit(caster, pick!);
}

describe('state-based actions after a deferred-target trigger resolves', () => {
  it('kills a creature dealt lethal damage by a targeted arrival trigger', () => {
    const state = makeTestState({
      battlefield: [{ iid: 21, cardId: 'bear', controller: 1 }],
      hands: [['arrival_burner'], []],
      active: 0,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, DB);
    castAndTarget(game, 0, 21);

    expect(game.instanceState.battlefield.some((p) => p.iid === 21)).toBe(false);
    const grave = game.instanceState.players[1].graveyard.map((c) => (typeof c === 'string' ? c : c.cardId));
    expect(grave).toContain('bear');
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'main' });
  });

  it('does so in main 2, where no combat check would ever have caught it', () => {
    const state = makeTestState({
      battlefield: [{ iid: 21, cardId: 'bear', controller: 1 }],
      hands: [['arrival_burner'], []],
      active: 0,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [] });
    expect(game.instanceState.step).toBe('main2');
    castAndTarget(game, 0, 21);

    expect(game.instanceState.battlefield.some((p) => p.iid === 21)).toBe(false);
  });

  it('takes a linked Hauntlink to the graveyard with its host', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, attachments: [2] },
        { iid: 2, cardId: 'hauntlink_enchantment', controller: 0, attachedTo: 1 },
      ],
      hands: [[], ['arrival_burner']],
      active: 1,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, DB);
    castAndTarget(game, 1, 1);

    const onBoard = (iid: number) => game.instanceState.battlefield.some((p) => p.iid === iid);
    expect(onBoard(1)).toBe(false);
    expect(onBoard(2)).toBe(false);
    const grave = game.instanceState.players[0].graveyard.map((c) => (typeof c === 'string' ? c : c.cardId));
    expect(grave).toEqual(expect.arrayContaining(['bear', 'hauntlink_enchantment']));
  });
});
