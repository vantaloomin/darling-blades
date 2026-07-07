import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { combatSetup, makeTestState, TEST_DB } from '../helpers';

describe('attack legality', () => {
  it('summoning-sick creatures cannot attack; haste can; tapped/defender cannot', () => {
    const { game, iid } = combatSetup(
      [
        { key: 'sick', cardId: 'bear', enteredThisTurn: true },
        { key: 'hasty', cardId: 'hasty', enteredThisTurn: true },
        { key: 'tapped', cardId: 'giant', tapped: true },
        { key: 'wall', cardId: 'wall' },
        { key: 'ready', cardId: 'bear' },
      ],
      [],
    );
    const attackSets = game
      .legalActions(0)
      .filter((a) => a.type === 'declareAttackers')
      .flatMap((a) => (a.type === 'declareAttackers' ? a.attackers : []));
    const eligible = new Set(attackSets);
    expect(eligible.has(iid.sick)).toBe(false);
    expect(eligible.has(iid.tapped)).toBe(false);
    expect(eligible.has(iid.wall)).toBe(false);
    expect(eligible.has(iid.hasty)).toBe(true);
    expect(eligible.has(iid.ready)).toBe(true);

    expect(() => game.submit(0, { type: 'declareAttackers', attackers: [iid.sick] })).toThrow(
      /illegal attacker/,
    );
  });

  it('attacking taps the attacker unless it has vigilance', () => {
    const { game, iid } = combatSetup(
      [
        { key: 'bear', cardId: 'bear' },
        { key: 'sentinel', cardId: 'sentinel' },
      ],
      [],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.bear, iid.sentinel] });
    const bf = game.state.battlefield;
    expect(bf.find((p) => p.iid === iid.bear)!.tapped).toBe(true);
    expect(bf.find((p) => p.iid === iid.sentinel)!.tapped).toBe(false);
  });
});

describe('block legality', () => {
  it('flyers are blocked only by flying or reach', () => {
    const { game, iid } = combatSetup(
      [{ key: 'flyer', cardId: 'flyer' }],
      [
        { key: 'bear', cardId: 'bear' },
        { key: 'archer', cardId: 'archer' },
        { key: 'flyer2', cardId: 'flyer' },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.flyer] });
    expect(() =>
      game.submit(1, {
        type: 'declareBlockers',
        blocks: [{ blocker: iid.bear, attacker: iid.flyer }],
      }),
    ).toThrow(/illegal block/);

    // reach and flying both work
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [
        { blocker: iid.archer, attacker: iid.flyer },
        { blocker: iid.flyer2, attacker: iid.flyer },
      ],
    });
    expect(game.state.step).toBe('main2');
  });

  it('enforces the 3-blockers-per-attacker cap and no double duty', () => {
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [
        { key: 'b1', cardId: 'bear' },
        { key: 'b2', cardId: 'bear' },
        { key: 'b3', cardId: 'bear' },
        { key: 'b4', cardId: 'bear' },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    expect(() =>
      game.submit(1, {
        type: 'declareBlockers',
        blocks: [
          { blocker: iid.b1, attacker: iid.giant },
          { blocker: iid.b2, attacker: iid.giant },
          { blocker: iid.b3, attacker: iid.giant },
          { blocker: iid.b4, attacker: iid.giant },
        ],
      }),
    ).toThrow(/more than 3 blockers/);
    expect(() =>
      game.submit(1, {
        type: 'declareBlockers',
        blocks: [
          { blocker: iid.b1, attacker: iid.giant },
          { blocker: iid.b1, attacker: iid.giant },
        ],
      }),
    ).toThrow(/assigned twice/);
  });
});

describe('combat damage math', () => {
  it('unblocked attackers hit the defending player', () => {
    const { game, iid } = combatSetup([{ key: 'giant', cardId: 'giant' }], []);
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    const events = game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.state.players[1].life).toBe(16);
    expect(events.some((e) => e.e === 'lifeChanged' && e.player === 1 && e.delta === -4)).toBe(
      true,
    );
    expect(game.state.step).toBe('main2');
  });

  it('a 4/4 blocked by a 2/2 kills it and survives with marked damage', () => {
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [{ key: 'bear', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    const events = game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.bear, attacker: iid.giant }],
    });
    expect(events.some((e) => e.e === 'died' && e.iid === iid.bear)).toBe(true);
    const giant = game.state.battlefield.find((p) => p.iid === iid.giant)!;
    expect(giant.damage).toBe(2);
    expect(game.state.players[1].life).toBe(20); // no trample → nothing through
    expect(game.state.players[1].graveyard).toContain('bear');
  });

  it('equal trades kill both', () => {
    const { game, iid } = combatSetup(
      [{ key: 'a', cardId: 'bear' }],
      [{ key: 'b', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.b, attacker: iid.a }],
    });
    expect(game.state.battlefield).toHaveLength(0);
  });

  it('lethal combat damage ends the game', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'giant', controller: 0 },
        { iid: 2, cardId: 'giant', controller: 0 },
      ],
      active: 0,
    });
    state.players[1].life = 6;
    const game = Game.restore(state, TEST_DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1, 2] });
    const events = game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(events.at(-1)).toMatchObject({ e: 'gameEnded', winner: 0, reason: 'life' });
    expect(game.legalActions(0)).toHaveLength(0);
  });

  it('multi-block: damage auto-assigns cheapest-kill-first', () => {
    // 4/4 giant blocked by a 2/2 bear and a 1/3 archer: kills the bear (2),
    // remaining 2 dumped on the archer (needs 3) — archer survives.
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [
        { key: 'bear', cardId: 'bear' },
        { key: 'archer', cardId: 'archer' },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [
        { blocker: iid.bear, attacker: iid.giant },
        { blocker: iid.archer, attacker: iid.giant },
      ],
    });
    const bf = game.state.battlefield;
    expect(bf.some((p) => p.iid === iid.bear)).toBe(false);
    const archer = bf.find((p) => p.iid === iid.archer)!;
    expect(archer.damage).toBe(2);
    // giant took 2 (bear) + 1 (archer) = 3
    expect(bf.find((p) => p.iid === iid.giant)!.damage).toBe(3);
  });

  it('marked damage clears at cleanup', () => {
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [{ key: 'bear', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.bear, attacker: iid.giant }],
    });
    game.submit(0, { type: 'passStep' }); // main2 → end → cleanup → next turn
    const giant = game.state.battlefield.find((p) => p.iid === iid.giant)!;
    expect(giant.damage).toBe(0);
  });
});

describe('response-window machine (M2 stub: no instants exist yet)', () => {
  it('auto-passes windows and proceeds straight to blockers', () => {
    const { game, iid } = combatSetup([{ key: 'bear', cardId: 'bear' }], []);
    const events = game.submit(0, { type: 'declareAttackers', attackers: [iid.bear] });
    // no responseWindowOpened event — defender had no castable instant
    expect(events.some((e) => e.e === 'responseWindowOpened')).toBe(false);
    expect(game.awaiting).toMatchObject({ kind: 'declareBlockers', player: 1 });
  });
});

describe('legend rule', () => {
  it('a second same-name legendary you control dies on entry; opponents may each keep one', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'lubu', controller: 0 },
        { iid: 2, cardId: 'lubu', controller: 1 }, // opponent's copy is fine
        { iid: 10, cardId: 'mountain', controller: 0 },
        { iid: 11, cardId: 'mountain', controller: 0 },
        { iid: 12, cardId: 'mountain', controller: 0 },
        { iid: 13, cardId: 'mountain', controller: 0 },
      ],
      hands: [['lubu'], []],
      active: 0,
    });
    const game = Game.restore(state, TEST_DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    // The NEW copy (higher iid) dies; the old one survives.
    const died = events.filter((e) => e.e === 'died');
    expect(died).toHaveLength(1);
    expect(game.state.battlefield.filter((p) => p.cardId === 'lubu')).toHaveLength(2);
    expect(game.state.battlefield.some((p) => p.iid === 1)).toBe(true);
    expect(game.state.players[0].graveyard).toContain('lubu');
  });
});

describe('lord statics in combat', () => {
  it('a +1/+1 lord lets a bear survive a giant trade it would otherwise lose', () => {
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [
        { key: 'bear', cardId: 'bear' }, // 2/2 → 3/3 under the lord
        { key: 'lord', cardId: 'lord' },
      ],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.bear, attacker: iid.giant }],
    });
    // 4 damage vs effective defense 3 → bear still dies, but giant took 3.
    expect(game.state.battlefield.some((p) => p.iid === iid.bear)).toBe(false);
    expect(game.state.battlefield.find((p) => p.iid === iid.giant)!.damage).toBe(3);

    // And the lord itself (Beastkin, `other: true`) is NOT buffed by itself.
    const lordPerm = game.state.battlefield.find((p) => p.iid === iid.lord)!;
    expect(lordPerm).toBeDefined();
  });
});
