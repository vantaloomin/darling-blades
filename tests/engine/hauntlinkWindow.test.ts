import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, GameState, Permanent } from '../../src/engine/types';
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
  // A Charm whose Foresee follows a death, and a Ritual that changes the top
  // of its caster's opponent's deck: the order between them is visible.
  kill_then_foresee: {
    id: 'kill_then_foresee',
    name: 'Kill Then Foresee',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  mill_opponent: {
    id: 'mill_opponent',
    name: 'Mill Opponent',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 1, who: 'opponent' }] }],
    rarity: 'c',
  },
  // A sweep of fliers with a draw after it, over two fliers whose dies
  // triggers are held: the first Foresees, the second drains.
  fly_foreseer: {
    id: 'fly_foreseer', name: 'Fly Foreseer', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }] }],
  },
  fly_drainer: {
    id: 'fly_drainer', name: 'Fly Drainer', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
  },
  dies_foreseer: {
    id: 'dies_foreseer', name: 'Dies Foreseer', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 4, // pays a Tithe Horror's {2} in full
    abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }] }],
  },
  flier_sweep_then_draw: {
    id: 'flier_sweep_then_draw', name: 'Flier Sweep Then Draw', types: ['ritual'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allFliers' }, { op: 'draw', n: 1 }] }],
  },
  // Nested holds: the first flier's death returns a flier that Foresees as
  // it arrives; the second's death sweeps fliers again, killing it.
  raise_flier: {
    id: 'raise_flier', name: 'Raise Flier', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'dies', ops: [{ op: 'raise', to: 'top' }] }],
  },
  arrival_foreseer: {
    id: 'arrival_foreseer', name: 'Arrival Foreseer', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }, { when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
  },
  resweep_flier: {
    id: 'resweep_flier', name: 'Resweep Flier', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'dies', ops: [{ op: 'massDestroy', filter: 'allFliers' }, { op: 'loseLife', n: 1, who: 'opponent' }] }],
  },
};
/** Shipped cards alongside the fixtures above; no id overlaps. */
const SHIPPED_DB: CardDb = { ...CARD_DB, ...DB };

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

/**
 * rules.md, Hauntlink: a held trigger resolves where it would have resolved
 * inline with no payable link, so passing every window must leave the same
 * game as a board without the link. Each case builds that pair: player 0 has
 * a linked host and a spare (the link is movable, so dies triggers are held)
 * or the same host and spare with no link.
 */
describe('a held trigger keeps the no-link order (rev 4)', () => {
  function boardPair(o: {
    bf: Partial<Permanent>[]; hands: [string[], string[]]; active: 0 | 1;
    decks: [string[], string[]]; graves?: [string[], string[]];
  }): { linked: Game; reference: Game } {
    const build = (withLink: boolean): Game => {
      const state = makeTestState({
        battlefield: [
          { iid: HOST, cardId: 'bear', controller: 0, attachments: withLink ? [LINK] : [] },
          ...(withLink ? [{ iid: LINK, cardId: 'hauntlink_enchantment', controller: 0 as const, attachedTo: HOST }] : []),
          { iid: SPARE, cardId: 'giant', controller: 0 },
          ...o.bf,
        ],
        hands: o.hands,
        active: o.active,
      });
      state.rulesRev = 4;
      state.players[0].deck = [...o.decks[0]];
      state.players[1].deck = [...o.decks[1]];
      if (o.graves) {
        state.players[0].graveyard = [...o.graves[0]];
        state.players[1].graveyard = [...o.graves[1]];
      }
      return Game.restore(state, SHIPPED_DB);
    };
    return { linked: build(true), reference: build(false) };
  }
  /** Pass every window until another decision (or the next main phase) is reached. */
  const passWindows = (g: Game): Game['awaiting'] => {
    for (let i = 0; i < 20; i++) {
      const aw = g.awaiting;
      if (aw.kind !== 'respond' && aw.kind !== 'hauntlinkWindow' && aw.kind !== 'endStepWindow') return aw;
      g.submit(aw.player, { type: 'passResponse' });
    }
    throw new Error('windows did not end');
  };
  const cast = (g: Game, p: 0 | 1, cardId: string, targetIid?: number): void => {
    const action = g.legalActions(p).find((a) => a.type === 'castSpell' && g.state.players[p].hand[a.handIndex] === cardId &&
      (targetIid === undefined || (a.targets?.[0]?.kind === 'permanent' && a.targets[0].iid === targetIid)));
    expect(action).toBeDefined();
    g.submit(p, action!);
  };
  const outcome = (g: Game) => ({
    life: g.instanceState.players.map((p) => p.life),
    hands: g.state.players.map((p) => p.hand),
    graves: g.state.players.map((p) => p.graveyard),
    battlefield: g.instanceState.battlefield.filter((p) => p.iid !== LINK).map((p) => [p.iid, p.cardId, p.controller, p.tapped]),
    stack: g.instanceState.stack.map((item) => item.cardId),
  });

  it('offers a paused spell\'s Foresee after the rest of the stack has resolved', () => {
    const { linked, reference } = boardPair({
      bf: [{ iid: 9, cardId: 'dies_drainer', controller: 1 }],
      hands: [['kill_then_foresee'], ['mill_opponent']], active: 1,
      decks: [['forest', 'giant', 'elf'], ['bear']],
    });
    for (const g of [linked, reference]) {
      cast(g, 1, 'mill_opponent');
      cast(g, 0, 'kill_then_foresee', 9);
    }
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });

    // The drain resolved, then the mill below took 'elf', then the Foresee.
    for (const g of [linked, reference]) {
      expect(passWindows(g)).toEqual({ player: 0, kind: 'foresee', cards: ['giant'] });
      expect(g.instanceState.players[0].life).toBe(18);
      expect(g.instanceState.stack).toEqual([]);
    }
    expect(outcome(linked)).toEqual(outcome(reference));
  });

  it('resolves a held trigger before a choice already queued ahead of it (Hotwire Retort)', () => {
    // The Retort's damage kills Tomb-Toll Taker at the state-based check after
    // the spell, when the spell's own Foresee is already queued.
    const { linked, reference } = boardPair({
      bf: [
        { iid: 9, cardId: 'sd-tomb-toll-taker', controller: 1 },
        { iid: 20, cardId: 'land-mountain', controller: 0 }, { iid: 21, cardId: 'land-mountain', controller: 0 },
      ],
      hands: [['yn-hotwire-retort'], []], active: 0,
      decks: [['forest', 'giant', 'elf'], ['bear']],
    });
    for (const g of [linked, reference]) cast(g, 0, 'yn-hotwire-retort', 9);
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });

    for (const g of [linked, reference]) {
      expect(passWindows(g)).toEqual({ player: 0, kind: 'foresee', cards: ['elf', 'giant'] });
      expect(g.instanceState.players[0].life).toBe(19); // the Taker's toll came first
    }
    expect(outcome(linked)).toEqual(outcome(reference));
  });

  it('lets the rest of the stack resolve before a targeted arrival the held trigger raised (Barrow-Jarl)', () => {
    // Player 1 removes player 0's knight; player 0 answers with Doom Bolt on
    // Barrow-Jarl, whose dies trigger raises Thing in the Cistern. The knight
    // is gone before Thing chooses what to recall.
    const { linked, reference } = boardPair({
      bf: [
        { iid: 5, cardId: 'knight', controller: 0 },
        { iid: 9, cardId: 'rg-draugr-jarl', controller: 1 },
        ...[20, 21, 22].map((iid) => ({ iid, cardId: 'land-swamp', controller: 0 as const })),
      ],
      hands: [['in-doom-bolt'], ['destroy_creature']], active: 1,
      decks: [['forest'], ['forest']], graves: [[], ['dd-thing-in-the-cistern']],
    });
    for (const g of [linked, reference]) {
      cast(g, 1, 'destroy_creature', 5);
      cast(g, 0, 'in-doom-bolt', 9);
    }
    for (const g of [linked, reference]) {
      const awaiting = passWindows(g);
      const thing = g.instanceState.battlefield.find((p) => p.cardId === 'dd-thing-in-the-cistern');
      expect(awaiting).toEqual({ player: 1, kind: 'chooseTarget', sourceIid: thing?.iid, abilityIndex: 0,
        targets: [{ kind: 'permanent', iid: HOST }, { kind: 'permanent', iid: SPARE }] });
      expect(g.instanceState.stack).toEqual([]);
    }
    expect(outcome(linked)).toEqual(outcome(reference));
  });

  // Owner ruling 2026-09-25: a choice the Tithe payment raised is settled
  // first, then the opponent's window, then the spell resolves, whatever the
  // opponent holds. The caster, making that choice, sees the same game either
  // way, so the order gives nothing away about the opponent's hand.
  it('settles a choice the Tithe fodder raised before the window over the spell, whatever the opponent holds', () => {
    const casterViews: ReturnType<Game['viewFor']>[] = [];
    for (const opponentHand of [['free_charm'], ['bear']]) {
      const { linked, reference } = boardPair({
        bf: [{ iid: 9, cardId: 'dies_foreseer', controller: 0 }],
        hands: [['tithe_horror'], opponentHand], active: 0,
        decks: [['forest', 'giant', 'elf'], ['bear']],
      });
      for (const g of [linked, reference]) g.submit(0, { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [9] });
      expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });

      for (const g of [linked, reference]) {
        expect(passWindows(g)).toEqual({ player: 0, kind: 'foresee', cards: ['elf'] });
        expect(g.instanceState.stack.map((item) => item.cardId)).toEqual(['tithe_horror']);
        if (g === reference) casterViews.push(g.viewFor(0));
        g.submit(0, { type: 'foresee', bottomIndices: [] });
        // Only now does the opponent's hand matter: a Charm earns a window.
        if (opponentHand[0] === 'free_charm') {
          expect(g.awaiting).toMatchObject({ player: 1, kind: 'respond', over: { type: 'spell' } });
          g.submit(1, { type: 'passResponse' });
        }
        expect(g.instanceState.stack).toEqual([]);
        expect(g.instanceState.battlefield.some((p) => p.cardId === 'tithe_horror')).toBe(true);
        expect(g.awaiting).toEqual({ player: 0, kind: 'main' });
      }
      expect(outcome(linked)).toEqual(outcome(reference));
    }
    expect(casterViews[0]).toEqual(casterViews[1]);
  });

  it('runs a sweep\'s remaining ops behind a choice an earlier held trigger raised', () => {
    const { linked, reference } = boardPair({
      bf: [{ iid: 9, cardId: 'fly_foreseer', controller: 0 }, { iid: 10, cardId: 'fly_drainer', controller: 0 }],
      hands: [['flier_sweep_then_draw'], []], active: 0,
      decks: [['forest', 'giant', 'elf'], ['bear']],
    });
    cast(linked, 0, 'flier_sweep_then_draw');
    cast(reference, 0, 'flier_sweep_then_draw');
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 9 } });
    for (const g of [linked, reference]) {
      // The Foresee sees the top card before the sweep draws; bottoming it
      // leaves the next card for the draw.
      expect(passWindows(g)).toEqual({ player: 0, kind: 'foresee', cards: ['elf'] });
      g.submit(0, { type: 'foresee', bottomIndices: [0] });
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.state.players[0].hand).toEqual(['giant']);
      expect(g.instanceState.players[1].life).toBe(18);
    }
    expect(outcome(linked)).toEqual(outcome(reference));
  });

  it('runs a sweep\'s remaining ops behind its own choice when held triggers nest', () => {
    // The sweep kills both fliers. The first returns the Arrival Foreseer
    // (its Foresee queues); the second sweeps it away, and its death is held
    // inside the second's own effect. The sweep's draw still waits behind the
    // Foresee.
    const { linked, reference } = boardPair({
      bf: [{ iid: 10, cardId: 'raise_flier', controller: 0 }, { iid: 11, cardId: 'resweep_flier', controller: 1 }],
      hands: [['flier_sweep_then_draw'], []], active: 0,
      decks: [['forest', 'elf', 'giant', 'bear'], ['forest', 'forest']],
      graves: [['arrival_foreseer'], []],
    });
    cast(linked, 0, 'flier_sweep_then_draw');
    cast(reference, 0, 'flier_sweep_then_draw');
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 10 } });
    for (const g of [linked, reference]) {
      expect(passWindows(g)).toEqual({ player: 0, kind: 'foresee', cards: ['bear'] });
      expect(g.state.players[0].hand).toEqual([]);
      g.submit(0, { type: 'foresee', bottomIndices: [0] });
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.state.players[0].hand).toEqual(['giant']);
      expect(g.state.players[0].deck).toEqual(['bear', 'forest', 'elf']);
      expect(g.instanceState.players.map((p) => p.life)).toEqual([19, 18]);
    }
    // The paused spell reached its graveyard at the pause (rules.md), so only
    // graveyard order may differ from the game with no link.
    const sorted = (g: Game) => g.state.players.map((p) => [...p.graveyard].sort());
    expect(sorted(linked)).toEqual(sorted(reference));
  });

  it('lets a sweep\'s own life gain save its caster from the held triggers it raised (White-Veil Collapse)', () => {
    // At 1 life, the caster destroys every creature, then gains 4. The Fourth
    // Weighing's Scarabs give the unattached link a host, so both Tomb-Toll
    // Takers' tolls are held; the life check waits for the whole batch.
    const build = (withLink: boolean): Game => {
      const state = makeTestState({
        battlefield: [
          { iid: 5, cardId: 'sd-fourth-weighing', controller: 0 },
          ...(withLink ? [{ iid: 6, cardId: 'hauntlink_enchantment', controller: 0 as const }] : []),
          { iid: 7, cardId: 'sd-tomb-toll-taker', controller: 1 },
          { iid: 8, cardId: 'sd-tomb-toll-taker', controller: 1 },
          ...[40, 41, 42, 43].map((iid) => ({ iid, cardId: 'land-plains', controller: 0 as const })),
        ],
        hands: [['yn-white-veil-collapse'], []], active: 0,
      });
      state.rulesRev = 4;
      state.players[0].life = 1;
      state.players[0].deck = ['forest'];
      state.players[1].deck = ['forest'];
      return Game.restore(state, SHIPPED_DB);
    };
    const linked = build(true);
    const reference = build(false);
    cast(linked, 0, 'yn-white-veil-collapse');
    cast(reference, 0, 'yn-white-veil-collapse');
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 7 } });
    for (const g of [linked, reference]) {
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.instanceState.players[0].life).toBe(3);
      expect(g.instanceState.winner).toBeNull();
    }
  });

  it('runs a sweep\'s remaining ops behind a choice raised before the hold (Night-Market Price)', () => {
    // Night-Market Price destroys every creature, then deals 2 to its caster.
    // Barrow-Jarl dies first with no host on the board, so its trigger
    // resolves at once and returns Drowned Nurse, whose arrival chooses a
    // card to reclaim. The Nurse is a host for the unattached link, so the
    // Glass-Eyed Drowned's dies trigger, next in the sweep, is held.
    const build = (withLink: boolean): Game => {
      const state = makeTestState({
        battlefield: [
          ...(withLink ? [{ iid: 2, cardId: 'hauntlink_enchantment', controller: 0 as const }] : []),
          { iid: 9, cardId: 'rg-draugr-jarl', controller: 0 },
          { iid: 10, cardId: 'dd-glass-eyed-drowned', controller: 1 },
          ...[20, 21, 22].map((iid) => ({ iid, cardId: 'land-swamp', controller: 0 as const })),
        ],
        hands: [['yn-night-market-price'], []], active: 0,
      });
      state.rulesRev = 4;
      state.players[0].deck = ['forest'];
      state.players[1].deck = ['forest', 'forest'];
      state.players[0].graveyard = ['bear', 'dd-drowned-nurse'];
      return Game.restore(state, SHIPPED_DB);
    };
    const linked = build(true);
    const reference = build(false);
    cast(linked, 0, 'yn-night-market-price');
    cast(reference, 0, 'yn-night-market-price');
    expect(linked.awaiting).toMatchObject({ player: 0, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: 10 } });
    for (const g of [linked, reference]) {
      expect(passWindows(g)).toMatchObject({ player: 0, kind: 'chooseTarget' });
      expect(g.instanceState.players[0].life).toBe(20); // the 2 damage waits behind the choice
      expect(g.state.players[1].hand).toEqual(['forest']); // the Glass-Eyed draw has resolved
      g.submit(0, { type: 'chooseTarget', target: { kind: 'grave', player: 0, index: 0 } });
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.state.players[0].hand).toEqual(['bear']);
      expect(g.instanceState.players[0].life).toBe(18);
    }
  });

  // Reaper's Due is "destroy target creature, then its controller loses 2
  // life". Before 1.8.1 its second half threw whenever Barrow-Jarl's raise
  // brought back a creature whose arrival makes a choice, link or no link.
  const reapersDue = (raised: string) => boardPair({
    bf: [
      { iid: 5, cardId: 'knight', controller: 0 },
      { iid: 9, cardId: 'rg-draugr-jarl', controller: 1 },
      ...[20, 21, 22].map((iid) => ({ iid, cardId: 'land-swamp', controller: 0 as const })),
    ],
    hands: [['in-reapers-due'], []], active: 0,
    decks: [['forest'], ['forest', 'giant', 'elf']], graves: [[], [raised]],
  });

  it('finishes Reaper\'s Due after the targeted arrival that Barrow-Jarl raised (Thing in the Cistern)', () => {
    const { linked, reference } = reapersDue('dd-thing-in-the-cistern');
    for (const g of [linked, reference]) {
      cast(g, 0, 'in-reapers-due', 9);
      expect(passWindows(g)).toMatchObject({ player: 1, kind: 'chooseTarget' });
      expect(g.instanceState.players[1].life).toBe(20); // the spell waits behind the choice
      g.submit(1, { type: 'chooseTarget', target: { kind: 'permanent', iid: 5 } });
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.state.players[0].hand).toEqual(['knight']); // recalled
      expect(g.instanceState.players[1].life).toBe(18); // then the rest of the spell
      expect(g.instanceState.pendingDecisions).toEqual([]);
    }
    expect(outcome(linked)).toEqual(outcome(reference));
  });

  it('finishes Reaper\'s Due after the Foresee and draw of the creature Barrow-Jarl raised (Signal Kitsune)', () => {
    const { linked, reference } = reapersDue('yn-signal-kitsune');
    for (const g of [linked, reference]) {
      cast(g, 0, 'in-reapers-due', 9);
      expect(passWindows(g)).toEqual({ player: 1, kind: 'foresee', cards: ['elf'] });
      expect(g.instanceState.players[1].life).toBe(20);
      g.submit(1, { type: 'foresee', bottomIndices: [] });
      expect(passWindows(g)).toEqual({ player: 0, kind: 'main' });
      expect(g.state.players[1].hand).toEqual(['elf']); // the Kitsune's draw
      expect(g.instanceState.players[1].life).toBe(18); // then the rest of the spell
    }
    expect(outcome(linked)).toEqual(outcome(reference));
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
