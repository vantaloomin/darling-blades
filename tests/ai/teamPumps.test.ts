import { describe, expect, it } from 'vitest';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import type { Game } from '../../src/engine/Game';
import type { Permanent } from '../../src/engine/types';
import { act, body, fixture } from './documentedBehaviourFixture';
import { usageAuditGame } from './usageAuditFixture';

/** Reach the ordinary post-block response through real engine actions. */
function combat(card: string, defender = false, board: Partial<Permanent>[] = [body(10, 'bear'), body(20, 'bear', 1)], life = 20, fog = false, reply = ''): Game {
  const player = defender ? 1 : 0;
  const game = fixture(defender ? ['free_draw'] : reply ? [card, card] : [card], [...board,
    body(100, 'plains', player), body(101, 'mountain', player), body(102, 'forest', player),
    body(103, 'plains', player)], (state) => {
    if (defender) state.players[1].hand = [card];
    else if (reply) state.players[1].hand = [reply];
    state.players[1].life = life;
    state.fogThisTurn = fog;
  });
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: board.filter(p => p.controller === 0).map(p => p.iid!) });
  passResponses(game);
  game.submit(1, { type: 'declareBlockers', blocks: board.some(p => p.iid === 20) ? [{ blocker: 20, attacker: 10 }] : [] });
  // The defender replies after blocks when the attacker spends a Charm.
  if (defender) game.submit(0, { type: 'castSpell', handIndex: 0 });
  expect(game.awaiting).toMatchObject({ kind: 'respond', player });
  expect(game.legalActions(player)).toContainEqual({ type: 'castSpell', handIndex: 0 });
  return game;
}

function passResponses(game: Game): void {
  while (game.awaiting.kind === 'respond') game.submit(game.awaiting.player, { type: 'passResponse' });
}

function finishCombat(game: Game): void {
  while (game.awaiting.kind === 'respond' || game.awaiting.kind === 'hauntlinkWindow') {
    game.submit(game.awaiting.player, { type: 'passResponse' });
  }
}

describe('Medium team pumps after blocks', () => {
  it.each(['teamAttack', 'teamRepeat'] as const)('spends Stand as One to improve Hera\'s recorded %s combat', (position) => {
    const game = usageAuditGame(position);
    const p = game.awaiting.kind === 'respond' ? game.awaiting.player : 0;
    const view = game.viewFor(p);
    const handIndex = view.you.hand.indexOf('in-stand-as-one');
    expect(act(game, new MediumAI(CARD_DB), CARD_DB)).toEqual({ type: 'castSpell', handIndex });
  });

  it('holds Stand as One in a real blocked combat where it saves nothing and adds no damage', () => {
    const game = usageAuditGame('teamHold');
    expect(act(game, new MediumAI(CARD_DB), CARD_DB)).toEqual({ type: 'passResponse' });
  });

  it.each([false, true])('saves its fighting creature with Shieldwall Call (defending: %s)', (defender) => {
    const game = combat('ac-shieldwall-call', defender);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    finishCombat(game);
    expect(game.state.battlefield.some(p => p.iid === (defender ? 20 : 10))).toBe(true);
    expect(game.state.battlefield.some(p => p.iid === (defender ? 10 : 20))).toBe(false);
  });

  it('spends Stand as One to trade a dying blocker for an attacker', () => {
    const game = combat('in-stand-as-one', true, [body(10, 'bear'), body(20, 'small_guard', 1)]);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    finishCombat(game);
    expect(game.state.battlefield.filter(p => p.iid === 10 || p.iid === 20)).toEqual([]);
  });

  it('uses Red-Moon Rampage\'s Overrun for lethal even when the added damage is less than its cost', () => {
    const game = combat('gm-red-moon-rampage', false, [body(10, 'giant'),
      body(20, 'wall', 1, { combatDamagePrevented: true, untilEotMods: [{ p: 0, t: 1, keywords: [] }] })], 1);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    finishCombat(game);
    expect(game.state.winner).toBe(0);
  });

  it('spends a team pump for unblocked damage worth its mana cost', () => {
    const game = combat('gm-red-moon-rampage', false, [body(10, 'bear')]);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    finishCombat(game);
    expect(game.state.players[1].life).toBe(16);
  });

  it('keeps a defensive team pump when every creature already survives', () => {
    const game = combat('ac-shieldwall-call', false, [body(10, 'giant'), body(20, 'bear', 1)]);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('counts a pending Shieldwall Call before spending another on the same fight', () => {
    const game = combat('ac-shieldwall-call', false, [body(10, 'bear'), body(20, 'bear', 1)], 20, false, 'free_draw');
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.legalActions(0)).toContainEqual({ type: 'castSpell', handIndex: 0 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    finishCombat(game);
    expect(game.state.battlefield.some(p => p.iid === 10)).toBe(true);
    expect(game.state.players[0].hand).toContain('ac-shieldwall-call');
  });

  it('answers a pending enemy team pump when its first Shieldwall is no longer enough', () => {
    const game = combat('ac-shieldwall-call', false, [body(10, 'bear'), body(20, 'bear', 1),
      body(120, 'mountain', 1), body(121, 'forest', 1)], 20, false, 'gm-red-moon-rampage');
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    finishCombat(game);
    expect(game.state.battlefield.some(p => p.iid === 10)).toBe(true);
    expect(game.state.battlefield.some(p => p.iid === 20)).toBe(false);
  });

  it('does not pump through prevented combat damage', () => {
    const game = combat('in-stand-as-one', false, [body(10, 'bear'), body(20, 'bear', 1)], 20, true);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('keeps Shieldwall Call with no creature to protect', () => {
    const game = combat('ac-shieldwall-call', true, [body(10, 'bear')]);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });
});
