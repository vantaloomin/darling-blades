import { describe, expect, it } from 'vitest';
import { checkStateBased } from '../../src/engine/sba';
import { RULES } from '../../src/config/rules';
import type { CardDb } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  // dies → 2 tokens, the shape of oly-persephone / cf-dance-under-mound spawners
  twin_mother: {
    id: 'twin_mother',
    name: 'Twin Matron',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 2, pips: { G: 1 } },
    colors: ['G'],
    attack: 2,
    defense: 3,
    abilities: [{ when: 'dies', ops: [{ op: 'createToken', token: 'tok_fox', count: 2 }] }],
    rarity: 'r',
  },
};

describe('state-based actions batch deaths before dies triggers', () => {
  it('token spawner gets its full token count when another creature dies simultaneously at the cap', () => {
    // Full board (maxCreatures): the spawner AND a bear both sit at lethal
    // damage. MTG SBA semantics: both corpses leave before any dies trigger
    // resolves, so both tokens fit under the cap (6 alive + 2 = 8). The
    // one-at-a-time destroy fired the spawner's trigger while the bear's
    // corpse still held a slot and ate the second token (playtest report
    // 2026-07-12).
    const battlefield = [
      { iid: 1, cardId: 'twin_mother', controller: 0 as const, damage: 3 },
      { iid: 2, cardId: 'bear', controller: 0 as const, damage: 2 },
      ...Array.from({ length: RULES.maxCreatures - 2 }, (_, i) => ({
        iid: 3 + i,
        cardId: 'bear',
        controller: 0 as const,
      })),
    ];
    const state = makeTestState({ battlefield, active: 0 });
    checkStateBased(state, DB, () => {});
    expect(state.battlefield.filter((p) => p.cardId === 'tok_fox')).toHaveLength(2);
    expect(state.battlefield).toHaveLength(RULES.maxCreatures);
  });

  it('cross-category deaths (lethal damage + legend rule) batch too — tokens fit at the cap', () => {
    // Full board where the second death comes from a DIFFERENT SBA category:
    // the spawner has lethal damage, and a duplicate legendary is condemned by
    // the legend rule in the same pass. Category-at-a-time batching left the
    // dupe occupying a slot while the spawner's trigger ran.
    const battlefield = [
      { iid: 1, cardId: 'twin_mother', controller: 0 as const, damage: 3 },
      { iid: 2, cardId: 'lubu', controller: 0 as const },
      { iid: 3, cardId: 'lubu', controller: 0 as const }, // legend-rule dupe
      ...Array.from({ length: RULES.maxCreatures - 3 }, (_, i) => ({
        iid: 4 + i,
        cardId: 'bear',
        controller: 0 as const,
      })),
    ];
    const state = makeTestState({ battlefield, active: 0 });
    checkStateBased(state, DB, () => {});
    expect(state.battlefield.filter((p) => p.cardId === 'tok_fox')).toHaveLength(2);
    expect(state.battlefield.filter((p) => p.cardId === 'lubu')).toHaveLength(1);
    expect(state.battlefield).toHaveLength(RULES.maxCreatures);
  });

  it('below the cap, simultaneous deaths still produce every token', () => {
    const battlefield = [
      { iid: 1, cardId: 'twin_mother', controller: 0 as const, damage: 3 },
      { iid: 2, cardId: 'bear', controller: 0 as const, damage: 2 },
    ];
    const state = makeTestState({ battlefield, active: 0 });
    checkStateBased(state, DB, () => {});
    expect(state.battlefield.filter((p) => p.cardId === 'tok_fox')).toHaveLength(2);
    expect(state.players[0].graveyard.sort()).toEqual(['bear', 'twin_mother']);
  });
});
