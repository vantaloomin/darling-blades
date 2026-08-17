import { describe, expect, it } from 'vitest';
import { hasCastableCharm, hasCastableInstant } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { destroyPermanent } from '../../src/engine/battlefield';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { getEffectiveStats } from '../../src/engine/statics';
import { checkStateBased } from '../../src/engine/sba';
import type { CardDef, CardInstance, GameState } from '../../src/engine/types';
import { validateHauntlinkDef } from '../../src/engine/types';
import { makeTestState } from '../helpers';
import { HAUNTLINK_DB } from '../hauntlinkFixture';

const target = (iid: number) => ({ kind: 'permanent' as const, iid });

function attachedState(linkCard = 'hauntlink_artifact'): GameState {
  const state = makeTestState({
    battlefield: [
      { iid: 1, cardId: 'bear', controller: 0, attachments: [2] },
      { iid: 2, cardId: linkCard, controller: 0, attachedTo: 1 },
    ],
    active: 0,
  });
  state.battlefield[0].instanceId = 100;
  state.battlefield[1].instanceId = 101;
  return state;
}

function castAction(game: Game, hauntlinked: boolean): Extract<ReturnType<Game['legalActions']>[number], { type: 'castSpell' }> {
  const action = game.legalActions(0).find(
    (candidate) => candidate.type === 'castSpell' && (hauntlinked ? candidate.hauntlinked === true : candidate.hauntlinked !== true),
  );
  expect(action).toBeDefined();
  return action as Extract<ReturnType<Game['legalActions']>[number], { type: 'castSpell' }>;
}

describe('Hauntlink revision 3 battlefield activation', () => {
  it('casts only for the printed cost, enters unlinked, then offers a stack-free link action', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
      hands: [['hauntlink_artifact'], []],
      active: 0,
    });
    state.rulesRev = 3;
    state.players[0].deck = ['bear'];
    const game = Game.restore(state, HAUNTLINK_DB);
    const casts = game.legalActions(0).filter((action) => action.type === 'castSpell');
    expect(casts).toHaveLength(1);
    expect(casts[0]).not.toHaveProperty('hauntlinked');
    expect(casts[0]).not.toHaveProperty('targets');

    game.submit(0, casts[0]);
    const link = game.instanceState.battlefield.find((perm) => perm.cardId === 'hauntlink_artifact')!;
    expect(link.attachedTo).toBeUndefined();
    const action = game.legalActions(0).find(
      (candidate) => candidate.type === 'linkHaunt' && candidate.iid === link.iid,
    );
    expect(action).toEqual({ type: 'linkHaunt', iid: link.iid, hostIid: 1 });
    const events = game.submit(0, action!);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
    expect(game.instanceState.stack).toEqual([]);
    expect(events).toContainEqual({
      e: 'hauntlinkFormed',
      linkIid: link.iid,
      hostIid: 1,
      cardId: 'hauntlink_artifact',
      controller: 0,
    });
    expect(getEffectiveStats(game.instanceState.battlefield, HAUNTLINK_DB, 1)).toMatchObject({
      attack: 3,
      defense: 3,
    });
  });

  it('pays the Hauntlink cost and can pay again to move the link', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        { iid: 2, cardId: 'giant', controller: 0 },
        { iid: 3, cardId: 'priced_hauntlink_artifact', controller: 0 },
        { iid: 10, cardId: 'forest', controller: 0 },
        { iid: 11, cardId: 'forest', controller: 0 },
        { iid: 12, cardId: 'forest', controller: 0 },
        { iid: 13, cardId: 'forest', controller: 0 },
      ],
      active: 0,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, HAUNTLINK_DB);
    const first = game.legalActions(0).find(
      (action): action is Extract<ReturnType<Game['legalActions']>[number], { type: 'linkHaunt' }> =>
        action.type === 'linkHaunt' && action.iid === 3 && action.hostIid === 1,
    );
    expect(first).toBeDefined();
    expect(game.submit(0, { ...first!, manaPlan: [10, 11] })).toContainEqual({
      e: 'manaTapped', player: 0, iids: [10, 11],
    });
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 1)?.attachments).toEqual([3]);

    const second = game.legalActions(0).find(
      (action): action is Extract<ReturnType<Game['legalActions']>[number], { type: 'linkHaunt' }> =>
        action.type === 'linkHaunt' && action.iid === 3 && action.hostIid === 2,
    );
    expect(second).toBeDefined();
    const events = game.submit(0, { ...second!, manaPlan: [12, 13] });
    expect(events).toContainEqual(expect.objectContaining({
      e: 'hauntlinkBroken', linkIid: 3, hostIid: 1, unlinked: true,
    }));
    expect(events).toContainEqual(expect.objectContaining({
      e: 'hauntlinkFormed', linkIid: 3, hostIid: 2,
    }));
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 1)?.attachments).toEqual([]);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 2)?.attachments).toEqual([3]);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 3)?.attachedTo).toBe(2);
  });

  for (const { name, op, zone } of [
    { name: 'destroyed', op: { op: 'destroy', to: 'target' } as const, zone: 'graveyard' as const },
    { name: 'recalled', op: { op: 'recall', to: 'target' } as const, zone: 'hand' as const },
    { name: 'severed', op: { op: 'sever', to: 'target' } as const, zone: 'severed' as const },
  ]) {
    it(`dies when its linked host is ${name}`, () => {
      const state = attachedState();
      state.rulesRev = 3;
      const events: Array<{ e: string; [key: string]: unknown }> = [];
      runOps(state, HAUNTLINK_DB, (event) => events.push(event), {
        controller: 0,
        sourceCardId: 'test',
        targets: [target(1)],
      }, [op]);
      checkStateBased(state, HAUNTLINK_DB, (event) => events.push(event));
      expect(state.players[0][zone]).toContain('bear');
      expect(state.players[0].graveyard).toContain('hauntlink_artifact');
      expect(state.battlefield).toHaveLength(0);
      expect(events).toContainEqual(expect.objectContaining({
        e: 'hauntlinkBroken', linkIid: 2, hostIid: 1,
      }));
    });
  }

  it('keeps an unlinked Hauntlink permanent when another creature leaves play', () => {
    const state = attachedState();
    state.rulesRev = 3;
    state.battlefield[0].attachments = [];
    delete state.battlefield[1].attachedTo;
    runOps(state, HAUNTLINK_DB, () => {}, {
      controller: 0,
      sourceCardId: 'test',
      targets: [target(1)],
    }, [{ op: 'destroy', to: 'target' }]);
    checkStateBased(state, HAUNTLINK_DB, () => {});
    expect(state.battlefield).toEqual([
      expect.objectContaining({ iid: 2, cardId: 'hauntlink_artifact' }),
    ]);
    expect(state.battlefield[0].attachedTo).toBeUndefined();
    expect(state.players[0].graveyard).toEqual(['bear']);
  });

  it('moves a link immediately in response so removal kills only the old host', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, attachments: [2] },
        { iid: 2, cardId: 'hauntlink_artifact', controller: 0, attachedTo: 1 },
        { iid: 3, cardId: 'giant', controller: 0 },
      ],
      hands: [[], ['destroy_creature']],
      active: 1,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, HAUNTLINK_DB);
    const removal = game.legalActions(1).find(
      (action) =>
        action.type === 'castSpell' &&
        action.targets?.[0]?.kind === 'permanent' &&
        action.targets[0].iid === 1,
    );
    expect(removal).toBeDefined();
    game.submit(1, removal!);
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'respond' });

    const move = game.legalActions(0).find(
      (action) => action.type === 'linkHaunt' && action.iid === 2 && action.hostIid === 3,
    );
    expect(move).toEqual({ type: 'linkHaunt', iid: 2, hostIid: 3 });
    expect(game.legalActions(1)).toEqual([]);
    expect(() => game.submit(1, move!)).toThrow(/not your decision/);
    game.submit(0, move!);
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'respond' });
    game.submit(0, { type: 'passResponse' });

    expect(game.instanceState.battlefield.some((perm) => perm.iid === 1)).toBe(false);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 2)).toMatchObject({
      attachedTo: 3,
    });
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 3)?.attachments).toEqual([2]);
    const graveyardIds = game.instanceState.players[0].graveyard.map((card) =>
      typeof card === 'string' ? card : card.cardId,
    );
    expect(graveyardIds).toContain('bear');
    expect(graveyardIds).not.toContain('hauntlink_artifact');
  });

  it('offers link actions in end-step and revision-2-style reopened window gates', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        { iid: 2, cardId: 'hauntlink_artifact', controller: 0 },
      ],
      active: 1,
    });
    state.rulesRev = 3;
    state.step = 'end';
    state.episode = { resolvedSinceOffer: 1, reopensThisStep: 0 };
    state.awaiting = { player: 0, kind: 'endStepWindow' };
    expect(hasCastableInstant(state, HAUNTLINK_DB, 0)).toBe(true);
    expect(hasCastableCharm(state, HAUNTLINK_DB, 0)).toBe(true);
    const game = Game.restore(state, HAUNTLINK_DB);
    expect(game.legalActions(0)).toContainEqual({ type: 'linkHaunt', iid: 2, hostIid: 1 });

    const responseState = structuredClone(state);
    responseState.awaiting = { player: 0, kind: 'respond', over: { type: 'attackers' } };
    const responseGame = Game.restore(responseState, HAUNTLINK_DB);
    expect(responseGame.legalActions(0)).toContainEqual({ type: 'linkHaunt', iid: 2, hostIid: 1 });
  });

  it('rejects the preserved alternate-cast shape under revision 3', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
      hands: [['hauntlink_artifact'], []],
      active: 0,
    });
    state.rulesRev = 3;
    const game = Game.restore(state, HAUNTLINK_DB);
    expect(() => game.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      hauntlinked: true,
      targets: [target(1)],
    })).toThrow(/activated from the battlefield/);
  });
});

describe('preserved revision-1 Hauntlink cast mode', () => {
  it('keeps the alternate cast action available under revision 2 for v7 replays', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
      hands: [['hauntlink_artifact'], []],
      active: 0,
    });
    state.rulesRev = 2;
    const game = Game.restore(state, HAUNTLINK_DB);
    expect(game.legalActions(0)).toContainEqual(expect.objectContaining({
      type: 'castSpell', hauntlinked: true, targets: [target(1)],
    }));
  });

  it('validates the narrow S4 carrier catalog instead of silently accepting bad combinations', () => {
    expect(validateHauntlinkDef(HAUNTLINK_DB.hauntlink_artifact)).toEqual([]);
    const base = HAUNTLINK_DB.hauntlink_artifact;
    const invalid: CardDef[] = [
      { ...base, types: ['creature'] },
      { ...base, types: ['land'] },
      { ...base, subtypes: ['Aura'] },
      { ...base, x: { min: 1 } },
      { ...base, empower: { cost: { generic: 0, pips: {} }, ops: [] } },
      { ...base, skim: { cost: { generic: 0, pips: {} } } },
      { ...base, retell: { cost: { generic: 0, pips: {} } } },
      {
        ...base,
        abilities: [
          ...(base.abilities ?? []),
          { when: 'static', static: { scope: 'attached', p: 1 } },
        ],
      },
    ];
    for (const card of invalid) expect(validateHauntlinkDef(card).length).toBeGreaterThan(0);
  });

  it('does not enumerate linked actions for an invalid carrier definition', () => {
    const invalidDb = {
      ...HAUNTLINK_DB,
      invalid_hauntlink: {
        ...HAUNTLINK_DB.hauntlink_artifact,
        id: 'invalid_hauntlink',
        abilities: [{ when: 'static' as const, static: { scope: 'attached' as const, p: 1 } }],
      },
    };
    const game = Game.restore(
      makeTestState({
        battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
        hands: [['invalid_hauntlink'], []],
        active: 0,
      }),
      invalidDb,
    );
    expect(game.legalActions(0).some((action) => action.type === 'castSpell' && action.hauntlinked)).toBe(false);
  });

  it('enumerates normal and one-host Hauntlink actions with the alternate cost', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
      hands: [['hauntlink_artifact'], []],
      active: 0,
    });
    const game = Game.restore(state, HAUNTLINK_DB);
    const actions = game.legalActions(0).filter((a) => a.type === 'castSpell');
    expect(actions.filter((a) => a.hauntlinked !== true)).toHaveLength(1);
    expect(actions.filter((a) => a.hauntlinked === true)).toEqual([
      expect.objectContaining({ targets: [target(1)], hauntlinked: true }),
    ]);
    expect(game.instanceState.players[0].hand).toHaveLength(1);
  });

  it('applies ordinary text in both modes, with the Linked rider only in linked mode', () => {
    for (const hauntlinked of [false, true]) {
      const state = makeTestState({
        battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
        hands: [['hauntlink_artifact'], []],
        active: 0,
      });
      state.players[0].deck = ['bear'];
      const game = Game.restore(state, HAUNTLINK_DB);
      const events = game.submit(0, castAction(game, hauntlinked));
      const host = game.instanceState.battlefield.find((perm) => perm.iid === 1)!;
      const stats = getEffectiveStats(game.instanceState.battlefield, HAUNTLINK_DB, 1);
      expect(game.instanceState.players[0].hand.map((card) => typeof card === 'string' ? card : card.cardId)).toContain('bear');
      expect(stats.attack).toBe(hauntlinked ? 3 : 2);
      expect(stats.keywords.has('skyborne')).toBe(hauntlinked);
      expect(events.some((event) => event.e === 'hauntlinkFormed')).toBe(hauntlinked);
      expect(host.attachments).toEqual(hauntlinked ? [expect.any(Number)] : []);
    }
  });

  it('exempts linked mode from the four-slot noncreature cap while normal mode consumes a slot', () => {
    const battlefield = [
      { iid: 1, cardId: 'bear', controller: 0 as const },
      ...Array.from({ length: 4 }, (_, i) => ({ iid: i + 2, cardId: 'ordinary_artifact', controller: 0 as const })),
    ];
    const game = Game.restore(
      makeTestState({ battlefield, hands: [['hauntlink_artifact'], []], active: 0 }),
      HAUNTLINK_DB,
    );
    game.instanceState.players[0].deck = ['bear'];
    const actions = game.legalActions(0).filter((a) => a.type === 'castSpell');
    expect(actions.some((a) => a.hauntlinked !== true)).toBe(false);
    expect(actions.some((a) => a.hauntlinked === true)).toBe(true);
    game.submit(0, actions.find((a) => a.hauntlinked === true)!);
    expect(game.instanceState.battlefield.filter((perm) => perm.cardId === 'hauntlink_artifact')).toHaveLength(1);
  });

  it('does not count attached links toward the cap that blocks normal casts', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [
          { iid: 1, cardId: 'bear', controller: 0, attachments: [5] },
          { iid: 2, cardId: 'ordinary_artifact', controller: 0 },
          { iid: 3, cardId: 'ordinary_artifact', controller: 0 },
          { iid: 4, cardId: 'ordinary_artifact', controller: 0 },
          { iid: 5, cardId: 'hauntlink_artifact', controller: 0, attachedTo: 1 },
        ],
        hands: [['hauntlink_artifact'], []],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    const actions = game.legalActions(0).filter((action) => action.type === 'castSpell');
    expect(actions.some((action) => action.hauntlinked !== true)).toBe(true);
    expect(actions.some((action) => action.hauntlinked === true)).toBe(true);
  });

  it('offers the linked cast when only its alternate cost is payable', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [
          { iid: 1, cardId: 'bear', controller: 0 },
          { iid: 10, cardId: 'forest', controller: 0 },
          { iid: 11, cardId: 'forest', controller: 0 },
        ],
        hands: [['priced_hauntlink_artifact'], []],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    const casts = game.legalActions(0).filter((action) => action.type === 'castSpell');
    expect(casts.some((action) => action.hauntlinked !== true)).toBe(false);
    expect(casts).toEqual([
      expect.objectContaining({ hauntlinked: true, targets: [target(1)] }),
    ]);
  });

  it('pays exactly the linked cost and keeps the mana spent when the link fizzles', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [
          { iid: 1, cardId: 'bear', controller: 0 },
          { iid: 10, cardId: 'forest', controller: 0 },
          { iid: 11, cardId: 'forest', controller: 0 },
        ],
        hands: [['priced_hauntlink_artifact'], ['destroy_creature']],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    const link = castAction(game, true);
    const castEvents = game.submit(0, link);
    expect(castEvents).toContainEqual({ e: 'manaTapped', player: 0, iids: [10, 11] });
    expect(game.instanceState.battlefield.filter((perm) => perm.tapped).map((perm) => perm.iid)).toEqual([10, 11]);

    const kill = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'permanent' && action.targets[0].iid === 1,
    );
    expect(kill).toBeDefined();
    const responseEvents = game.submit(1, kill!);
    expect(responseEvents.some((event) => event.e === 'targetsFizzled')).toBe(true);
    expect(game.instanceState.battlefield.filter((perm) => perm.tapped).map((perm) => perm.iid)).toEqual([10, 11]);
  });

  it('allows multiple links to share one host and exposes the relationship through PlayerView', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [{ iid: 1, cardId: 'bear', controller: 0, attachments: [] }],
        hands: [['hauntlink_artifact', 'hauntlink_artifact'], []],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    game.instanceState.players[0].deck = ['bear', 'bear'];
    game.submit(0, castAction(game, true));
    game.submit(0, castAction(game, true));
    const host = game.instanceState.battlefield.find((perm) => perm.iid === 1)!;
    expect(host.attachments).toHaveLength(2);
    expect(host.attachments).toEqual(
      game.instanceState.battlefield.filter((perm) => perm.attachedTo === 1).map((perm) => perm.iid),
    );
    const view = game.viewFor(1);
    expect(view.battlefield.find((perm) => perm.iid === 1)?.attachments).toHaveLength(2);
    expect(view.battlefield.filter((perm) => perm.attachedTo === 1)).toHaveLength(2);
  });
});

describe('preserved revision-1 Hauntlink lifecycle and SBA cleanup', () => {
  const hostRemovalCases = [
    { name: 'destroy', op: { op: 'destroy', to: 'target' } as const, zone: 'graveyard' as const },
    { name: 'recall', op: { op: 'recall', to: 'target' } as const, zone: 'hand' as const },
    { name: 'sever', op: { op: 'sever', to: 'target' } as const, zone: 'severed' as const },
  ];

  for (const { name, op, zone } of hostRemovalCases) {
    it(`moves a Hauntlink to its owner's graveyard when the host is ${name}d`, () => {
      const state = attachedState();
      const events: ReturnType<typeof runOps> extends never ? never[] : unknown[] = [];
      runOps(state, HAUNTLINK_DB, (event) => events.push(event), { controller: 0, sourceCardId: 'test', targets: [target(1)] }, [op]);
      checkStateBased(state, HAUNTLINK_DB, (event) => events.push(event));
      expect(state.battlefield.some((perm) => perm.iid === 1)).toBe(false);
      expect(state.battlefield.some((perm) => perm.iid === 2)).toBe(false);
      expect(state.players[0].graveyard).toContain('hauntlink_artifact');
      if (name === 'destroy') expect(state.players[0].graveyard).toContain('bear');
      expect(state.players[0][zone]).toContain('bear');
      const broken = events.findIndex((event) => (event as { e?: string }).e === 'hauntlinkBroken');
      const moved = events.findIndex(
        (event) => (event as { e?: string; iid?: number }).e === 'died' && (event as { iid?: number }).iid === 2,
      );
      expect(broken).toBeGreaterThanOrEqual(0);
      expect(broken).toBeLessThan(moved);
    });
  }

  it('cleans links from a token host and does not create a token graveyard card', () => {
    const state = attachedState();
    state.battlefield[0].cardId = 'tok_fox';
    runOps(state, HAUNTLINK_DB, () => {}, { controller: 0, sourceCardId: 'test', targets: [target(1)] }, [
      { op: 'destroy', to: 'target' },
    ]);
    checkStateBased(state, HAUNTLINK_DB, () => {});
    expect(state.players[0].graveyard).toEqual(['hauntlink_artifact']);
  });

  it('cleans a host link after a creature sweep, while an enchantment sweep removes only the link', () => {
    const creatureSweep = attachedState();
    runOps(creatureSweep, HAUNTLINK_DB, () => {}, { controller: 0, sourceCardId: 'test', targets: [] }, [
      { op: 'massDestroy', filter: 'allCreatures' },
    ]);
    checkStateBased(creatureSweep, HAUNTLINK_DB, () => {});
    expect(creatureSweep.battlefield).toEqual([]);
    expect(creatureSweep.players[0].graveyard).toEqual(['bear', 'hauntlink_artifact']);

    const enchantmentSweep = attachedState('hauntlink_enchantment');
    runOps(enchantmentSweep, HAUNTLINK_DB, () => {}, { controller: 0, sourceCardId: 'test', targets: [] }, [
      { op: 'massDestroy', filter: 'allEnchantments' },
    ]);
    checkStateBased(enchantmentSweep, HAUNTLINK_DB, () => {});
    expect(enchantmentSweep.battlefield.map((perm) => perm.cardId)).toEqual(['bear']);
    expect(enchantmentSweep.players[0].graveyard).toEqual(['hauntlink_enchantment']);
    expect(enchantmentSweep.battlefield[0].attachments).toEqual([]);
  });

  it('removing a link directly leaves the host and its marks alone, and recomputes stats', () => {
    const state = attachedState();
    state.battlefield[0].damage = 1;
    state.battlefield[0].plusOneCounters = 1;
    runOps(state, HAUNTLINK_DB, () => {}, { controller: 0, sourceCardId: 'test', targets: [target(2)] }, [
      { op: 'destroy', to: 'target' },
    ]);
    expect(state.battlefield.map((perm) => perm.iid)).toEqual([1]);
    expect(state.battlefield[0].damage).toBe(1);
    expect(state.battlefield[0].plusOneCounters).toBe(1);
    expect(getEffectiveStats(state.battlefield, HAUNTLINK_DB, 1)).toMatchObject({ attack: 3, defense: 3 });
    expect(state.players[0].graveyard).toEqual(['hauntlink_artifact']);
  });

  it('fizzles to the graveyard when the chosen host dies in the response window', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }],
        hands: [['hauntlink_artifact'], ['destroy_creature']],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    const castEvents = game.submit(0, castAction(game, true));
    const kill = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'permanent' && action.targets[0].iid === 1,
    );
    expect(kill).toBeDefined();
    const responseEvents = game.submit(1, kill!);
    const events = [...castEvents, ...responseEvents];
    expect(events.some((event) => event.e === 'targetsFizzled')).toBe(true);
    expect(events.some((event) => event.e === 'hauntlinkFormed')).toBe(false);
    expect(game.instanceState.battlefield).toEqual([]);
    expect(game.instanceState.players[0].graveyard.map((card) => typeof card === 'string' ? card : card.cardId)).toContain('hauntlink_artifact');
  });

  it('clone snapshots retain live link state independently', () => {
    const game = Game.restore(
      makeTestState({ battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }], hands: [['hauntlink_artifact'], []], active: 0 }),
      HAUNTLINK_DB,
    );
    game.instanceState.players[0].deck = ['bear'];
    game.submit(0, castAction(game, true));
    const snapshot = game.clone();
    const before = JSON.stringify(snapshot.instanceState);
    const state = game.instanceState as GameState;
    destroyPermanent(state, HAUNTLINK_DB, state.battlefield.find((perm) => perm.iid === 1)!, () => {});
    checkStateBased(state, HAUNTLINK_DB, () => {});
    expect(JSON.stringify(snapshot.instanceState)).toBe(before);
    expect(snapshot.instanceState.battlefield.some((perm) => perm.attachedTo === 1)).toBe(true);
    expect(game.instanceState.battlefield).toEqual([]);
  });

  it('preserves the physical card instance through a linked battlefield departure', () => {
    const state = makeTestState({ battlefield: [{ iid: 1, cardId: 'bear', controller: 0 }], active: 0 });
    state.players[0].hand = [
      { instanceId: 77, cardId: 'hauntlink_artifact', variantKey: 'blue|shiny|standard' } satisfies CardInstance,
    ];
    const game = Game.restore(state, HAUNTLINK_DB);
    game.instanceState.players[0].deck = ['bear'];
    game.submit(0, castAction(game, true));
    const link = game.instanceState.battlefield.find((perm) => perm.cardId === 'hauntlink_artifact')!;
    expect(link).toMatchObject({ instanceId: 77, variantKey: 'blue|shiny|standard', attachedTo: 1 });
    const live = game.instanceState as GameState;
    destroyPermanent(live, HAUNTLINK_DB, live.battlefield.find((perm) => perm.iid === 1)!, () => {});
    checkStateBased(live, HAUNTLINK_DB, () => {});
    expect(live.players[0].graveyard).toContainEqual(
      expect.objectContaining({ instanceId: 77, cardId: 'hauntlink_artifact', variantKey: 'blue|shiny|standard' }),
    );
  });
});
