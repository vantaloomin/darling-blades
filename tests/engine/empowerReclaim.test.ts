import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { cardIdOf } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Renenutet, Who Measures the Flood (owner ruling 2026-09-04): her Empower
 * used to grant two extra land drops at nine total mana, against a ten-land
 * reserve, so the second land could never exist. It now reads
 *   Empower {2}{G}: Return target creature card from your graveyard to your
 *   hand, then you gain 3 life.
 * This is the first Empower rider that targets the graveyard, so the cast
 * path is proven end to end here rather than assumed from the data.
 */
const RENENUTET = 'sd-renenutet-who-measures-the-flood';
const DB: CardDb = { ...TEST_DB, [RENENUTET]: CARD_DB[RENENUTET] };

function nineLands(): Game {
  const state = makeTestState({
    battlefield: Array.from({ length: 9 }, (_, i) => ({ iid: 100 + i, cardId: 'forest', controller: 0 as const })),
    hands: [[RENENUTET], []],
    active: 0,
  });
  return Game.restore(state, DB);
}

describe('Renenutet Empower: reclaim from the graveyard', () => {
  it('offers the empowered cast only when a creature card sits in the graveyard', () => {
    const empty = nineLands();
    const plain = empty.legalActions(0).filter((a) => a.type === 'castSpell');
    expect(plain.some((a) => a.type === 'castSpell' && !a.empowered)).toBe(true);
    expect(plain.some((a) => a.type === 'castSpell' && a.empowered)).toBe(false);

    const g = nineLands();
    g.instanceState.players[0].graveyard = ['bear'];
    const stocked = Game.restore(g.instanceState, DB);
    expect(stocked.legalActions(0).some((a) => a.type === 'castSpell' && a.empowered)).toBe(true);
  });

  it('returns the targeted creature card to hand and gains 3 life on resolution', () => {
    const g = nineLands();
    g.instanceState.players[0].graveyard = ['bear'];
    const game = Game.restore(g.instanceState, DB);
    const cast = game.legalActions(0).find((a) => a.type === 'castSpell' && a.empowered);
    expect(cast).toBeDefined();
    game.submit(0, cast!);
    const aw = game.awaiting;
    if ('player' in aw && aw.player === 1 && aw.kind === 'respond') game.submit(1, { type: 'passResponse' });

    const me = game.instanceState.players[0];
    expect(game.instanceState.battlefield.some((p) => p.cardId === RENENUTET)).toBe(true);
    expect(me.hand.map(cardIdOf)).toEqual(['bear']);
    expect(me.graveyard.map(cardIdOf)).toEqual([]);
    expect(me.life).toBe(23);
  });
});
