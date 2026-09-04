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
