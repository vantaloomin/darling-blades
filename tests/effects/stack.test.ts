import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import type { Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/** Game at P0's main1 with the given hands/battlefield. */
function duel(opts: {
  p0Hand?: string[];
  p1Hand?: string[];
  battlefield?: Partial<Permanent>[];
}): Game {
  const state = makeTestState({
    battlefield: opts.battlefield ?? [],
    hands: [opts.p0Hand ?? [], opts.p1Hand ?? []],
    active: 0,
  });
  return Game.restore(state, TEST_DB);
}

const lands = (owner: 0 | 1, from: number, ids: string[]): Partial<Permanent>[] =>
  ids.map((cardId, i) => ({ iid: from + i, cardId, controller: owner }));

describe('targeted spells and windows', () => {
  it('Shock hits a creature; opponent with no instants never gets a window', () => {
    const g = duel({
      p0Hand: ['shock'],
      battlefield: [...lands(0, 1, ['mountain']), { iid: 2, cardId: 'giant', controller: 1 }],
    });
    const events = g.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 2 }],
    });
    expect(events.some((e) => e.e === 'responseWindowOpened')).toBe(false);
    expect(g.state.battlefield.find((p) => p.iid === 2)!.damage).toBe(2);
    expect(g.state.players[0].graveyard).toContain('shock');
  });

  it('Shock to the face can win the game', () => {
    const g = duel({ p0Hand: ['shock'], battlefield: lands(0, 1, ['mountain']) });
    g.state.players[1].life = 2;
    const events = g.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 1 }],
    });
    expect(events.at(-1)).toMatchObject({ e: 'gameEnded', winner: 0, reason: 'life' });
  });

  it('hexproof blocks enemy targeting entirely', () => {
    const g = duel({
      p0Hand: ['shock'],
      battlefield: [...lands(0, 1, ['mountain']), { iid: 3, cardId: 'hexproof_bear', controller: 1 }],
    });
    expect(() =>
      g.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 3 }] }),
    ).toThrow(/illegal target/);
    const offered = g
      .legalActions(0)
      .filter((a) => a.type === 'castSpell')
      .flatMap((a) => (a.type === 'castSpell' ? (a.targets ?? []) : []));
    expect(offered.some((t) => t.kind === 'permanent' && t.iid === 3)).toBe(false);
  });

  it('a targeted spell with no legal targets is not castable', () => {
    const g = duel({ p0Hand: ['murder'], battlefield: lands(0, 1, ['swamp', 'swamp']) });
    // no creatures anywhere → Doom Bolt unplayable
    expect(g.legalActions(0).some((a) => a.type === 'castSpell')).toBe(false);
  });
});

describe('the LIFO stack', () => {
  it('pump in response to Shock saves the creature', () => {
    const g = duel({
      p0Hand: ['shock'],
      p1Hand: ['growth'],
      battlefield: [
        ...lands(0, 1, ['mountain']),
        ...lands(1, 10, ['forest']),
        { iid: 20, cardId: 'bear', controller: 1 },
      ],
    });
    g.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'respond' });

    // P1 responds; P0 has nothing left → auto-pass → flush LIFO (Growth, then Shock)
    g.submit(1, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
    const bear = g.state.battlefield.find((p) => p.iid === 20)!;
    expect(bear.damage).toBe(2); // vs defense 5 → survives
    expect(g.awaiting).toMatchObject({ player: 0, kind: 'main' });
  });

  it('counterspell counters a creature spell', () => {
    const g = duel({
      p0Hand: ['giant'],
      p1Hand: ['cancel'],
      battlefield: [
        ...lands(0, 1, ['forest', 'forest', 'forest', 'forest']),
        ...lands(1, 10, ['island', 'island']),
      ],
    });
    const events = g.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(events.some((e) => e.e === 'responseWindowOpened')).toBe(true);
    const sid = (events.find((e) => e.e === 'spellCast') as { sid: number }).sid;

    const counterEvents = g.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'stackItem', sid }],
    });
    expect(counterEvents.some((e) => e.e === 'spellCountered')).toBe(true);
    expect(g.state.battlefield.some((p) => p.cardId === 'giant')).toBe(false);
    expect(g.state.players[0].graveyard).toContain('giant');
    expect(g.state.players[1].graveyard).toContain('cancel');
  });

  it('removal in response to a pump makes the pump fizzle', () => {
    const g = duel({
      p0Hand: ['growth'],
      p1Hand: ['murder'],
      battlefield: [
        ...lands(0, 1, ['forest']),
        { iid: 5, cardId: 'bear', controller: 0 },
        ...lands(1, 10, ['swamp', 'swamp']),
      ],
    });
    g.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 5 }] });
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'respond' });

    // Doom Bolt the bear in response: LIFO → bolt resolves first, bear dies,
    // Growth's only target is gone → targetsFizzled.
    const events = g.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 5 }],
    });
    expect(events.some((e) => e.e === 'died' && e.iid === 5)).toBe(true);
    expect(events.some((e) => e.e === 'targetsFizzled')).toBe(true);
    expect(g.state.players[0].graveyard).toEqual(expect.arrayContaining(['bear', 'growth']));
  });
});

describe('spell bodies, X, auras, triggers, fog', () => {
  it('Blaze deals X, paying R + X', () => {
    const g = duel({
      p0Hand: ['blaze'],
      battlefield: lands(0, 1, ['mountain', 'mountain', 'mountain']),
    });
    g.submit(0, { type: 'castSpell', handIndex: 0, x: 2, targets: [{ kind: 'player', player: 1 }] });
    expect(g.state.players[1].life).toBe(18);
    expect(g.state.battlefield.filter((p) => p.tapped)).toHaveLength(3);
  });

  it('an aura debuffs its host and dies with it (orphan SBA)', () => {
    const g = duel({
      p0Hand: ['pacifism_aura', 'shock'],
      battlefield: [
        ...lands(0, 1, ['plains', 'plains', 'mountain']),
        { iid: 9, cardId: 'giant', controller: 1, damage: 2 },
      ],
    });
    g.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 9 }] });
    const aura = g.state.battlefield.find((p) => p.cardId === 'pacifism_aura')!;
    expect(aura.attachedTo).toBe(9);
    expect(getEffectiveStats(g.state.battlefield, TEST_DB, 9).attack).toBe(1);

    // Shock finishes the damaged 4/4 (2 marked + 2 = lethal) → aura orphaned → dies
    const events = g.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 9 }],
    });
    expect(events.filter((e) => e.e === 'died')).toHaveLength(2);
    expect(g.state.battlefield).toHaveLength(3); // just the lands
    expect(g.state.players[0].graveyard).toContain('pacifism_aura');
  });

  it('ETB drain fires on resolution', () => {
    const g = duel({ p0Hand: ['drainer'], battlefield: lands(0, 1, ['swamp', 'swamp']) });
    g.state.players[0].life = 10;
    g.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(g.state.players[0].life).toBe(12);
    expect(g.state.players[1].life).toBe(18);
  });

  it('dies trigger creates a token', () => {
    const g = duel({
      p0Hand: ['shock'],
      battlefield: [
        ...lands(0, 1, ['mountain']),
        { iid: 7, cardId: 'fox_mother', controller: 1, damage: 2 },
      ],
    });
    const events = g.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 7 }],
    });
    expect(events.some((e) => e.e === 'died' && e.iid === 7)).toBe(true);
    expect(events.some((e) => e.e === 'tokenCreated')).toBe(true);
    expect(g.state.battlefield.some((p) => p.cardId === 'tok_fox')).toBe(true);
    // tokens never hit the graveyard as cards
    expect(g.state.players[1].graveyard).toContain('fox_mother');
  });

  it('fog cast in the attack window prevents all combat damage', () => {
    const g = duel({
      p1Hand: ['fog_spell'],
      battlefield: [{ iid: 1, cardId: 'giant', controller: 0 }, ...lands(1, 10, ['forest'])],
    });
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(g.awaiting).toMatchObject({ player: 1, kind: 'respond' });
    g.submit(1, { type: 'castSpell', handIndex: 0 });
    g.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(g.state.players[1].life).toBe(20);
    expect(g.state.step).toBe('main2');
  });

  it('upkeep trigger burns its controller (Lu Bu tax)', () => {
    // simulate with a custom upkeep card via drainer? use fox_mother? Use the
    // real pattern: a permanent with an upkeep damage-to-controller ability.
    const db = {
      ...TEST_DB,
      taxed: {
        id: 'taxed',
        name: 'Taxed Champion',
        types: ['creature' as const],
        subtypes: [],
        cost: { generic: 1, pips: {} },
        colors: ['R' as const],
        attack: 5,
        defense: 3,
        abilities: [
          { when: 'dawn' as const, ops: [{ op: 'damage' as const, n: 1, to: 'controller' as const }] },
        ],
        rarity: 'sr' as const,
      },
    };
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'taxed', controller: 0 }],
      active: 0,
    });
    state.players[0].deck = ['bear', 'bear', 'bear'];
    state.players[1].deck = ['bear', 'bear', 'bear'];
    const g = Game.restore(state, db);
    // pass through to P1's turn then back to P0's upkeep
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [] });
    g.submit(0, { type: 'passStep' });
    // P1's turn
    g.submit(1, { type: 'passStep' });
    g.submit(1, { type: 'declareAttackers', attackers: [] });
    g.submit(1, { type: 'passStep' });
    // back to P0 — upkeep fired
    expect(g.state.players[0].life).toBe(19);
  });
});
