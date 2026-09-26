import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, CardInstance, GameState, TargetRef } from '../../src/engine/types';
import { cardIdOf } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * A graveyard card chosen as a target is the card that resolves, even when
 * the graveyard changes order between the choice and the resolution
 * (1.8.1): refs carry the card's instance id, and submission binds a
 * position-only ref (a hand-built one, or one from a replay log older than
 * v15) to the card at that position before anything is stored.
 */
const RECLAIM: CardDef = {
  id: 'reclaim_charm', name: 'Reclaim Charm', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
  cost: { generic: 0, pips: {} },
  abilities: [{ when: 'spell', targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'reclaim' }] }],
};
const FREE_CHARM: CardDef = {
  id: 'free_charm', name: 'Free Charm', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
  cost: { generic: 0, pips: {} },
  abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 1 }] }],
};
const DB: CardDb = { ...TEST_DB, [RECLAIM.id]: RECLAIM, [FREE_CHARM.id]: FREE_CHARM };

/** Player 0's graveyard is bear, giant, elf, flyer (instances 101-104). */
function reclaimBoard(): Game {
  const state: GameState = makeTestState({ hands: [[RECLAIM.id, RECLAIM.id], [FREE_CHARM.id]], active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.players[0].graveyard = ['bear', 'giant', 'elf', 'flyer'].map((cardId, i) =>
    ({ instanceId: 101 + i, cardId, variantKey: null }) satisfies CardInstance);
  state.players[0].deck = ['forest', 'forest'];
  state.players[1].deck = ['forest', 'forest'];
  return Game.restore(state, DB);
}

function reclaimAt(game: Game, index: number): Extract<Action, { type: 'castSpell' }> {
  const cast = game.legalActions(0).find((action): action is Extract<Action, { type: 'castSpell' }> =>
    action.type === 'castSpell' && action.targets?.[0]?.kind === 'grave' && action.targets[0].index === index);
  if (!cast) throw new Error(`no reclaim offered at graveyard index ${index}`);
  return cast;
}

const positionOnly = (cast: Extract<Action, { type: 'castSpell' }>): Action => {
  const target = cast.targets![0] as Extract<TargetRef, { kind: 'grave' }>;
  return { ...cast, targets: [{ kind: 'grave', player: target.player, index: target.index }] };
};

describe('graveyard targets name the card, not its position', () => {
  it('offers graveyard targets that carry the card\'s instance id', () => {
    const game = reclaimBoard();
    expect(reclaimAt(game, 2).targets).toEqual([{ kind: 'grave', player: 0, index: 2, instanceId: 103 }]);
  });

  it.each([
    ['a legal action (bound)', (cast: Extract<Action, { type: 'castSpell' }>): Action => cast],
    ['a position-only ref (hand-built, or a pre-v15 replay)', positionOnly],
  ])('resolves the chosen card after an earlier card leaves the graveyard: %s', (_label, shape) => {
    const game = reclaimBoard();
    // Choose the elf at position 2; the flyer sits behind it.
    game.submit(0, shape(reclaimAt(game, 2)));
    expect(game.instanceState.stack[0].targets).toEqual([{ kind: 'grave', player: 0, index: 2, instanceId: 103 }]);

    // A response lets player 0 take the bear from position 0 before the first
    // spell resolves, so every later card moves up one place.
    expect(game.awaiting).toMatchObject({ player: 1, kind: 'respond' });
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'respond' });
    game.submit(0, reclaimAt(game, 0));

    // The whole stack has resolved: the bear first, then the elf, now at
    // position 1. Position 2 held the flyer, which must stay put (the two
    // resolved Charms follow it).
    expect(game.instanceState.stack).toEqual([]);
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['bear', 'elf']);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['giant', 'flyer', RECLAIM.id, RECLAIM.id]);
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'main' });
  });

  it('refuses a graveyard action built against another order instead of resolving another card', () => {
    const game = reclaimBoard();
    const stale = reclaimAt(game, 2); // the elf, instance 103, at position 2
    const reordered = structuredClone(game.instanceState) as GameState;
    reordered.players[0].graveyard.reverse(); // position 2 now holds the giant
    const other = Game.restore(reordered, DB);
    expect(() => other.submit(0, stale)).toThrow('graveyard target is no longer where it was chosen');
    expect(other.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['flyer', 'elf', 'giant', 'bear']);
  });
});
