import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, GameState } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';
import { HAUNTLINK_DB } from '../hauntlinkFixture';

/**
 * Owner ruling 2026-09-04: Hauntlink explicitly breaks the "no window over
 * triggers" rule - normal Charms do not. Under rules revision 4 a
 * Hauntlink-only window (linkHaunt or pass, nothing else) opens:
 *   - after a targeted trigger has chosen its target, before its ops run;
 *   - before a dies trigger resolves;
 *   - at the combat damage step, for both players, before damage is dealt.
 * It opens only for a player who can actually pay a link, so a game with no
 * linkable Hauntlink is byte-identical to revision 3.
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
  dies_burner: {
    id: 'dies_burner',
    name: 'Dies Burner',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    rarity: 'c',
    abilities: [{ when: 'dies', ops: [{ op: 'damage', n: 3, to: 'eachCreature' }] }],
  },
  free_charm: {
    id: 'free_charm',
    name: 'Free Charm',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 1 }] }],
    rarity: 'c',
  },
  dies_drainer: {
    id: 'dies_drainer',
    name: 'Dies Drainer',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 4,
    rarity: 'c',
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
  },
  tithe_horror: {
    id: 'tithe_horror',
    name: 'Tithe Horror',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 2, pips: {} },
    colors: [],
    attack: 3,
    defense: 3,
    rarity: 'c',
    tithe: { per: 2 },
  },
  // A death that is not the spell's last effect: the draw must still happen.
  kill_then_draw: {
    id: 'kill_then_draw',
    name: 'Kill Then Draw',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  life_ritual: {
    id: 'life_ritual',
    name: 'Life Ritual',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 3 }] }],
    rarity: 'c',
  },
};

const HOST = 1;
const LINK = 2;
const SPARE = 3;

/** Player 0 owns a linked host, a spare creature, and (optionally) a Charm. */
function linkedBoard(extra: Partial<GameState['battlefield'][number]>[], hands: [string[], string[]], active: 0 | 1, rulesRev: 3 | 4 = 4): Game {
  const state = makeTestState({
    battlefield: [
      { iid: HOST, cardId: 'bear', controller: 0, attachments: [LINK] },
      { iid: LINK, cardId: 'hauntlink_enchantment', controller: 0, attachedTo: HOST },
      { iid: SPARE, cardId: 'giant', controller: 0 },
      ...extra,
    ],
    hands,
    active,
  });
  state.rulesRev = rulesRev;
  return Game.restore(state, DB);
}

const onBoard = (g: Game, iid: number) => g.instanceState.battlefield.some((p) => p.iid === iid);
const link = (g: Game) => g.instanceState.battlefield.find((p) => p.iid === LINK);
const moveLink = (g: Game): Action => {
  const a = g.legalActions(0).find((x) => x.type === 'linkHaunt' && x.iid === LINK && x.hostIid === SPARE);
  expect(a).toBeDefined();
  return a!;
};
const castFirst = (g: Game, p: 0 | 1) => {
  const a = g.legalActions(p).find((x) => x.type === 'castSpell');
  expect(a).toBeDefined();
  g.submit(p, a!);
};
const passIf = (g: Game, p: 0 | 1, kind: string) => {
  const aw = g.awaiting;
  if ('player' in aw && aw.player === p && aw.kind === kind) g.submit(p, { type: 'passResponse' });
};
const chooseTarget = (g: Game, p: 0 | 1, iid: number) => {
  expect(g.awaiting).toMatchObject({ player: p, kind: 'chooseTarget' });
  const pick = g.legalActions(p).find((x) => JSON.stringify(x).includes(`"iid":${iid}`));
  expect(pick).toBeDefined();
  g.submit(p, pick!);
};

describe('Hauntlink window over a targeted trigger (rev 4)', () => {
  it('opens for the threatened host owner after the target is chosen, offering only linkHaunt and pass', () => {
    const g = linkedBoard([], [['free_charm'], ['arrival_burner']], 1);
    castFirst(g, 1);
    passIf(g, 0, 'respond'); // the ordinary window over the creature spell
    chooseTarget(g, 1, HOST);

    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger' } });
    const types = new Set(g.legalActions(0).map((a) => a.type));
    expect(types.has('linkHaunt')).toBe(true);
    expect(types.has('passResponse')).toBe(true);
    expect(types.has('castSpell')).toBe(false); // normal Charms stay out
    expect(types.has('skim')).toBe(false);
    expect(onBoard(g, HOST)).toBe(true); // ops have not run yet
  });

  it('moving the link in that window saves it; the host still dies', () => {
    const g = linkedBoard([], [[], ['arrival_burner']], 1);
    castFirst(g, 1);
    passIf(g, 0, 'respond');
    chooseTarget(g, 1, HOST);
    g.submit(0, moveLink(g));
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow' }); // still open for more moves
    g.submit(0, { type: 'passResponse' });

    expect(onBoard(g, HOST)).toBe(false);
    expect(link(g)).toMatchObject({ attachedTo: SPARE });
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'main' });
  });

  it('passing lets the trigger resolve and the link dies with its host', () => {
    const g = linkedBoard([], [[], ['arrival_burner']], 1);
    castFirst(g, 1);
    passIf(g, 0, 'respond');
    chooseTarget(g, 1, HOST);
    g.submit(0, { type: 'passResponse' });

    expect(onBoard(g, HOST)).toBe(false);
    expect(onBoard(g, LINK)).toBe(false);
  });

  it('is not offered when the link owner cannot pay', () => {
    const g = linkedBoard([], [[], ['arrival_burner']], 1);
    // priced link needs {2}; player 0 has no mana sources on this board
    const st = g.instanceState;
    const l = st.battlefield.find((p) => p.iid === LINK)!;
    l.cardId = 'priced_hauntlink_artifact';
    const g2 = Game.restore(st, DB);
    castFirst(g2, 1);
    passIf(g2, 0, 'respond');
    chooseTarget(g2, 1, HOST);

    expect(g2.awaiting).toMatchObject({ player: 1, kind: 'main' });
    expect(onBoard(g2, HOST)).toBe(false);
  });

  it('revision 3 opens no such window', () => {
    const g = linkedBoard([], [[], ['arrival_burner']], 1, 3);
    castFirst(g, 1);
    passIf(g, 0, 'respond');
    chooseTarget(g, 1, HOST);

    expect(g.awaiting).toMatchObject({ player: 1, kind: 'main' });
    expect(onBoard(g, HOST)).toBe(false);
  });
});

describe('Hauntlink window over a dies trigger (rev 4)', () => {
  it('opens before the dies trigger resolves, and a move saves the link', () => {
    const g = linkedBoard([{ iid: 9, cardId: 'dies_burner', controller: 1 }], [[], ['destroy_creature']], 1);
    const kill = g.legalActions(1).find((a) => a.type === 'castSpell' && a.targets?.[0]?.kind === 'permanent' && a.targets[0].iid === 9);
    expect(kill).toBeDefined();
    g.submit(1, kill!);
    passIf(g, 0, 'respond'); // window over the removal spell

    expect(onBoard(g, 9)).toBe(false); // the burner has died
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });
    expect(onBoard(g, HOST)).toBe(true); // its 3-to-everything has not resolved

    g.submit(0, moveLink(g));
    g.submit(0, { type: 'passResponse' });

    expect(onBoard(g, HOST)).toBe(false); // bear 2/3 takes 3
    expect(onBoard(g, SPARE)).toBe(true); // giant 4/4 survives
    expect(link(g)).toMatchObject({ attachedTo: SPARE });
  });

  it('when the death is a sacrifice paid to cast, the spell still gets its window and resolves', () => {
    // Player 1 holds an unlinked, payable link, so the fodder's dies trigger
    // is held for a Hauntlink window while the Tithe creature is on the stack.
    const state = makeTestState({
      battlefield: [
        { iid: 10, cardId: 'dies_drainer', controller: 0 },
        { iid: 20, cardId: 'free_host', controller: 1 },
        { iid: 21, cardId: 'hauntlink_enchantment', controller: 1 },
      ],
      hands: [['tithe_horror'], []],
      active: 0,
    });
    state.rulesRev = 4;
    const g = Game.restore(state, DB);
    g.submit(0, { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [10] });

    expect(g.awaiting).toMatchObject({ player: 1, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 10 } });
    expect(g.instanceState.stack.map((item) => item.cardId)).toEqual(['tithe_horror']);
    expect(g.instanceState.players[1].life).toBe(20); // the drain is held

    g.submit(1, { type: 'passResponse' });
    // The held trigger resolves first, then the ordinary window over the spell.
    expect(g.instanceState.players[1].life).toBe(18);
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'respond', over: { type: 'spell' } });

    g.submit(1, { type: 'passResponse' });
    expect(g.instanceState.stack).toEqual([]);
    expect(g.instanceState.battlefield.some((p) => p.cardId === 'tithe_horror')).toBe(true);
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'main' });
  });

  // A held trigger resolves where the death happened, as it would on a board
  // with no payable link; only the window comes first. The spell that caused
  // the death pauses there and finishes afterwards (rules.md, revision 4).
  function killThenDraw(withLink: boolean): Game {
    const g = linkedBoard([{ iid: 9, cardId: 'dies_drainer', controller: 1 }], [[], ['kill_then_draw']], 1);
    const st = structuredClone(g.instanceState) as GameState;
    st.players[1].deck = ['forest', 'forest'];
    if (!withLink) {
      st.battlefield = st.battlefield.filter((p) => p.iid !== LINK);
      st.battlefield.find((p) => p.iid === HOST)!.attachments = [];
    }
    const game = Game.restore(st, DB);
    game.submit(1, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 9 }] });
    passIf(game, 0, 'respond'); // a movable link earns the ordinary window over the spell
    return game;
  }

  it('pauses a spell whose death is not its last effect, then finishes it after the held trigger', () => {
    const g = killThenDraw(true);

    // The creature has died; its trigger waits behind the window, and so does
    // the rest of the spell.
    expect(onBoard(g, 9)).toBe(false);
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });
    expect(g.instanceState.players[0].life).toBe(20);
    expect(g.instanceState.players[1].hand).toEqual([]);

    g.submit(0, { type: 'passResponse' });
    expect(g.instanceState.players[0].life).toBe(18); // the held trigger resolved
    expect(g.instanceState.players[1].hand).toHaveLength(1); // and then the spell drew
    expect(g.instanceState.players[1].deck).toHaveLength(1);
    expect(g.instanceState.stack).toEqual([]);
    expect(g.instanceState.pendingDecisions).toEqual([]);
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'main' });
  });

  it('ends a paused spell in the same state as on a board with no payable link', () => {
    const held = killThenDraw(true);
    held.submit(0, { type: 'passResponse' });
    const unheld = killThenDraw(false);
    expect(unheld.awaiting).toMatchObject({ player: 1, kind: 'main' });

    const outcome = (g: Game) => ({
      life: g.instanceState.players.map((p) => p.life),
      hands: g.instanceState.players.map((p) => p.hand.length),
      graves: g.instanceState.players.map((p) => p.graveyard.length),
      awaiting: g.awaiting,
    });
    expect(outcome(held)).toEqual(outcome(unheld));
  });

  it('resolves a held trigger before the next item on the stack', () => {
    const g = linkedBoard([{ iid: 9, cardId: 'dies_drainer', controller: 1 }], [['destroy_creature'], ['life_ritual']], 1);
    g.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'respond' });
    g.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 9 }] });

    // The removal on top resolved and its death is held; the ritual below waits.
    expect(onBoard(g, 9)).toBe(false);
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });
    expect(g.instanceState.stack.map((item) => item.cardId)).toEqual(['life_ritual']);
    expect(g.instanceState.players[1].life).toBe(20);

    g.submit(0, { type: 'passResponse' });
    expect(g.instanceState.players[0].life).toBe(18);
    expect(g.instanceState.players[1].life).toBe(23);
    expect(g.instanceState.stack).toEqual([]);
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'main' });
  });
});

describe('Hauntlink window at the combat damage step (rev 4)', () => {
  function blockedAttack(): Game {
    const g = linkedBoard([{ iid: 9, cardId: 'giant', controller: 1 }], [[], []], 0);
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [HOST] });
    passIf(g, 1, 'respond');
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'declareBlockers' });
    g.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 9, attacker: HOST }] });
    passIf(g, 0, 'respond'); // the attacker's ordinary window over the blocks
    return g;
  }

  it('opens for the attacker before damage, and a move saves the link', () => {
    const g = blockedAttack();
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'combatDamage' } });
    expect(onBoard(g, HOST)).toBe(true);

    g.submit(0, moveLink(g));
    g.submit(0, { type: 'passResponse' });

    expect(onBoard(g, HOST)).toBe(false);
    expect(link(g)).toMatchObject({ attachedTo: SPARE });
    expect(g.instanceState.step).toBe('main2');
  });

  it('offers the defender a window too when the defender holds a payable link', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 11, cardId: 'giant', controller: 0 },
        { iid: 21, cardId: 'bear', controller: 1, attachments: [22] },
        { iid: 22, cardId: 'hauntlink_enchantment', controller: 1, attachedTo: 21 },
        { iid: 23, cardId: 'giant', controller: 1 },
      ],
      hands: [[], []],
      active: 0,
    });
    state.rulesRev = 4;
    const g = Game.restore(state, DB);
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [11] });
    passIf(g, 1, 'respond');
    g.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 21, attacker: 11 }] });
    passIf(g, 0, 'respond');

    expect(g.awaiting).toMatchObject({ player: 1, kind: 'hauntlinkWindow', over: { type: 'combatDamage' } });
    const move = g.legalActions(1).find((a) => a.type === 'linkHaunt' && a.iid === 22 && a.hostIid === 23);
    expect(move).toBeDefined();
    g.submit(1, move!);
    g.submit(1, { type: 'passResponse' });

    expect(onBoard(g, 21)).toBe(false);
    expect(g.instanceState.battlefield.find((p) => p.iid === 22)).toMatchObject({ attachedTo: 23 });
  });

  it('revision 3 goes straight to damage', () => {
    const g = linkedBoard([{ iid: 9, cardId: 'giant', controller: 1 }], [[], []], 0, 3);
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [HOST] });
    passIf(g, 1, 'respond');
    g.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 9, attacker: HOST }] });
    passIf(g, 0, 'respond');

    expect(g.instanceState.step).toBe('main2');
    expect(onBoard(g, HOST)).toBe(false);
    expect(onBoard(g, LINK)).toBe(false);
  });
});
