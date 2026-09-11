import { describe, expect, it, vi } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { activationCandidates, chooseActivate } from '../../src/ai/activatedPolicy';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { activateActionValue, activatedAbilityValue, createPermanentValuer, opImpactValue, permValue } from '../../src/ai/value';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { ActivatedDef, CardDb, CardDef, Permanent } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { activatedCatalogErrors } from '../activatedFixture';
import { botAction, makeTestState, TEST_DB } from '../helpers';

const SOURCE = 10;
const free: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'damage', n: 2, to: 'opponent' }] };
function carrier(id: string, types: CardDef['types'] = ['artifact'], extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types, subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 1, pips: {} },
    ...(types.includes('creature') ? { attack: 2, defense: 4 } : {}),
    activated: free, ...extra,
  };
}
const DB: CardDb = {
  ...TEST_DB,
  duty_artifact: carrier('duty_artifact'),
  duty_enchantment: carrier('duty_enchantment', ['enchantment']),
  duty_creature: carrier('duty_creature', ['creature']),
  duty_sentinel: carrier('duty_sentinel', ['creature'], { keywords: ['sentinel'] }),
  duty_rage: carrier('duty_rage', ['creature'], { keywords: ['rage'] }),
  duty_bulwark: carrier('duty_bulwark', ['creature'], { keywords: ['bulwark'] }),
  duty_zero: carrier('duty_zero', ['creature'], { attack: 0 }),
  duty_ragewall: carrier('duty_ragewall', ['creature'], { keywords: ['rage', 'bulwark'] }),
  duty_paid: carrier('duty_paid', ['artifact'], {
    activated: { ...free, cost: { tap: true, mana: { generic: 1, pips: { G: 1 } } } },
  }),
  duty_harm: carrier('duty_harm', ['artifact'], {
    activated: { cost: { tap: true }, ops: [{ op: 'damage', n: 3, to: 'controller' }] },
  }),
  duty_sever: carrier('duty_sever', ['artifact'], {
    activated: { cost: { tap: true }, ops: [{ op: 'severSelf' }] },
  }),
  duty_target: carrier('duty_target', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'any', other: true }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
  }),
  duty_perf: carrier('duty_perf', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
  }),
  duty_optional: carrier('duty_optional', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'creature', upTo: 2 }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
  }),
  duty_friendly_harm: carrier('duty_friendly_harm', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'yourCreature' }], ops: [{ op: 'destroy', to: 'target' }] },
  }),
  duty_skimmer: carrier('duty_skimmer', ['creature'], {
    activated: undefined, cost: { generic: 20, pips: {} }, skim: { cost: { generic: 0, pips: {} } },
  }),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [
    `duty_skimmer_${i}`, carrier(`duty_skimmer_${i}`, ['creature'], {
      activated: undefined, cost: { generic: 20, pips: {} }, skim: { cost: { generic: 0, pips: {} } },
    }),
  ])),
  duty_draw: carrier('duty_draw', ['artifact'], {
    activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] },
  }),
  duty_fatal_boost: carrier('duty_fatal_boost', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'yourCreature' }], ops: [{ op: 'boost', p: 4, t: -2, scope: 'target' }] },
  }),
  duty_mark_branch: carrier('duty_mark_branch', ['artifact'], {
    activated: { cost: { tap: true }, targets: [{ what: 'yourCreature', marked: true }], ops: [
      { op: 'removeMarks', to: 'target' },
      { op: 'ifTargetMarked', then: [{ op: 'draw', n: 5 }], else: [{ op: 'damage', n: 10, to: 'controller' }] },
    ] },
  }),
};

type Difficulty = 'easy' | 'medium' | 'hard';
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
function brain(difficulty: Difficulty, seed = 7, noisy = false): AIPlayer {
  if (difficulty === 'easy') return new EasyAI(DB, seed, makePersonality({ easyNoise: noisy ? 1 : 0 }));
  if (difficulty === 'medium') return new MediumAI(DB);
  return new HardAI(DB);
}
function board(
  cardId = 'duty_artifact',
  step: 'main1' | 'main2' = 'main1',
  extra: Partial<Permanent>[] = [],
  hand: string[] = [],
  sourcePatch: Partial<Permanent> = {},
): Game {
  const state = makeTestState({
    battlefield: [{ iid: SOURCE, cardId, controller: 0, ...sourcePatch }, ...extra],
    hands: [hand, []], active: 0,
  });
  state.rulesRev = 4;
  state.step = step;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.players[0].deck = Array<string>(20).fill('forest');
  state.players[1].deck = Array<string>(20).fill('forest');
  return Game.restore(state, DB);
}
const choose = (ai: AIPlayer, game: Game): Action => ai.chooseAction(game.viewFor(0), game.legalActions(0));
function advanceToAfternoon(game: Game, ai: AIPlayer): Action[] {
  const ownActions: Action[] = [];
  for (let guard = 0; guard < 80; guard++) {
    if (game.state.step === 'main2' && game.awaiting.kind === 'main') return ownActions;
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') throw new Error('Fixture ended before Afternoon');
    const action = awaiting.player === 0 ? choose(ai, game) : botAction(game.legalActions(1));
    if (awaiting.player === 0) ownActions.push(action);
    game.submit(awaiting.player, action);
  }
  throw new Error('Fixture never reached Afternoon');
}

describe('Duty AI policy on fixture cards', () => {
  it('validates the fixture pool without shipping catalog cards', () => {
    for (const card of Object.values(DB)) expect(activatedCatalogErrors(card, DB), card.id).toEqual([]);
  });

  it.each(difficulties)('%s uses a free non-creature Duty in the Morning', (difficulty) => {
    for (const cardId of ['duty_artifact', 'duty_enchantment']) {
      const game = board(cardId);
      const action = choose(brain(difficulty), game);
      expect(action).toEqual({ type: 'activate', iid: SOURCE });
      expect(game.submit(0, action)).toContainEqual({ e: 'activated', player: 0, iid: SOURCE, cardId });
    }
  });

  it('Medium permits only tap-alone Duty in the Morning, with or without a spell, and paid Duty in the Afternoon', () => {
    const lands = [{ iid: 11, cardId: 'forest' }, { iid: 12, cardId: 'forest' }];
    const morning = board('duty_paid', 'main1', lands, ['bear']);
    expect(morning.legalActions(0)).toContainEqual({ type: 'activate', iid: SOURCE });
    expect(choose(brain('medium'), morning)).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(chooseActivate(morning.viewFor(0), DB, morning.legalActions(0))).toBeNull();
    const emptyHand = board('duty_paid', 'main1', lands);
    expect(emptyHand.legalActions(0)).toContainEqual({ type: 'activate', iid: SOURCE });
    expect(choose(brain('medium'), emptyHand).type).toBe('passStep');
    expect(chooseActivate(emptyHand.viewFor(0), DB, emptyHand.legalActions(0))).toBeNull();
    const afternoon = board('duty_paid', 'main2', lands);
    const action = choose(brain('medium'), afternoon);
    expect(action).toEqual({ type: 'activate', iid: SOURCE });
    afternoon.submit(0, action);
    expect(afternoon.state.battlefield.every((perm) => perm.tapped)).toBe(true);
  });

  it.each(difficulties)('%s lets a creature attack first and activates an unused body in the Afternoon', (difficulty) => {
    const morning = board('duty_creature');
    expect(choose(brain(difficulty), morning).type).toBe('passStep');
    const unused = board('duty_creature', 'main1', [
      { iid: 20, cardId: 'giant', controller: 1 },
      { iid: 21, cardId: 'giant', controller: 1 },
      { iid: 22, cardId: 'giant', controller: 1 },
    ]);
    const ai = brain(difficulty);
    expect(advanceToAfternoon(unused, ai)).toContainEqual({ type: 'declareAttackers', attackers: [] });
    expect(choose(ai, unused)).toEqual({ type: 'activate', iid: SOURCE });
    const attacking = board('duty_creature');
    const attacker = brain(difficulty);
    expect(advanceToAfternoon(attacking, attacker)).toContainEqual({ type: 'declareAttackers', attackers: [SOURCE] });
    expect(attacking.state.battlefield.find((perm) => perm.iid === SOURCE)?.tapped).toBe(true);
    expect(choose(attacker, attacking).type).not.toBe('activate');
  });

  it.each(difficulties)('%s attacks with Sentinel, then performs its Duty', (difficulty) => {
    const game = board('duty_sentinel');
    const ai = brain(difficulty);
    const actions = advanceToAfternoon(game, ai);
    expect(actions).toContainEqual({ type: 'declareAttackers', attackers: [SOURCE] });
    expect(game.state.battlefield.find((perm) => perm.iid === SOURCE)?.tapped).toBe(false);
    expect(choose(ai, game)).toEqual({ type: 'activate', iid: SOURCE });
  });

  it.each(difficulties)('%s never taps Rage in the Morning, including the Bulwark exception', (difficulty) => {
    for (const card of ['duty_rage', 'duty_ragewall']) {
      expect(choose(brain(difficulty), board(card)).type).not.toBe('activate');
    }
  });

  it.each(difficulties)('%s treats Bulwark and zero-power bodies as non-attacking sources', (difficulty) => {
    for (const card of ['duty_bulwark', 'duty_zero']) {
      expect(choose(brain(difficulty), board(card))).toEqual({ type: 'activate', iid: SOURCE });
    }
  });

  it.each(difficulties)('%s refuses abilities whose ops only harm its controller', (difficulty) => {
    for (const card of ['duty_harm', 'duty_sever', 'duty_friendly_harm']) {
      const game = board(card, 'main2', [{ iid: 20, cardId: 'bear', controller: 0 }]);
      expect(choose(brain(difficulty), game).type).not.toBe('activate');
      expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toBeNull();
    }
  });

  it('Easy noise cannot bypass creature timing, Rage or self-harm policy', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const card of ['duty_creature', 'duty_rage', 'duty_harm']) {
        expect(choose(brain('easy', seed, true), board(card)).type).not.toBe('activate');
      }
    }
  });

  it.each(difficulties)('%s refuses a fatal draw, a lethal friendly boost and a harmful post-removal branch', (difficulty) => {
    const draw = board('duty_draw');
    draw.state.players[0].deck = [];
    expect(choose(brain(difficulty), draw).type).not.toBe('activate');
    const boost = board('duty_fatal_boost', 'main2', [{ iid: 20, cardId: 'bear', controller: 0 }]);
    expect(choose(brain(difficulty), boost).type).not.toBe('activate');
    const branch = board('duty_mark_branch', 'main2', [{ iid: 20, cardId: 'bear', controller: 0, plusOneCounters: 1 }]);
    expect(choose(brain(difficulty), branch).type).not.toBe('activate');
  });

  it.each(difficulties)('%s chooses the best legal target by public impact without modifying the view or database', (difficulty) => {
    const game = board('duty_target', 'main1', [
      { iid: 20, cardId: 'bear', controller: 0 },
      { iid: 21, cardId: 'bear', controller: 1 },
      { iid: 22, cardId: 'giant', controller: 1 },
    ]);
    const view = game.viewFor(0);
    const before = structuredClone({ view, db: DB });
    expect(brain(difficulty).chooseAction(view, game.legalActions(0))).toEqual({
      type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 21 }],
    });
    expect({ view, db: DB }).toEqual(before);
  });

  it('Hard searchMain enumerates Duty even when a land is its baseline', () => {
    const game = board('duty_artifact', 'main1', [], ['forest']);
    const hard = new HardAI(DB);
    type Search = { aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null };
    const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    choose(hard, game);
    const candidates = outcomes.mock.calls.map(([, actions]) => actions[0]);
    expect(candidates[0]).toEqual({ type: 'playLand', handIndex: 0 });
    expect(candidates.slice(1)).toContainEqual({ type: 'activate', iid: SOURCE });
    outcomes.mockRestore();
  });

  it('Hard keeps the best Duty candidate beyond its eight ordinary candidates', () => {
    const game = board('duty_artifact', 'main1', [], ['forest', ...Array.from({ length: 10 }, (_, i) => `duty_skimmer_${i}`)]);
    const hard = new HardAI(DB);
    type Search = { aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null };
    const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    choose(hard, game);
    const candidates = outcomes.mock.calls.slice(1).map(([, actions]) => actions[0]);
    expect(candidates.filter((action) => action.type === 'skim')).toHaveLength(8);
    expect(candidates).toContainEqual({ type: 'activate', iid: SOURCE });
    outcomes.mockRestore();
  });

  it.each(difficulties)('%s is deterministic for the same seed and board', (difficulty) => {
    for (let seed = 0; seed < 12; seed++) {
      const a = board('duty_target');
      const b = board('duty_target');
      expect(choose(brain(difficulty, seed), a)).toEqual(choose(brain(difficulty, seed), b));
    }
  });

  it('only proposes engine-enumerated main-phase actions', () => {
    const game = board();
    const view = game.viewFor(0);
    expect(activationCandidates(view, DB, [])).toEqual([]);
    const response: PlayerView = { ...view, awaiting: { kind: 'endStepWindow', player: 0 } };
    expect(chooseActivate(response, DB, game.legalActions(0))).toBeNull();
  });
});

describe('Duty battlefield value', () => {
  it.each([
    ['duty_perf', 4], ['duty_optional', 8],
  ] as const)('preserves committed action and potential values on the 27-permanent fixture: %s', (cardId, expected) => {
    const game = board(cardId, 'main1', [
      ...Array.from({ length: 7 }, (_, i) => ({ iid: 11 + i, cardId, controller: 0 as const })),
      ...Array.from({ length: 4 }, (_, i) => ({ iid: 30 + i, cardId: 'bear', controller: 0 as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ iid: 40 + i, cardId: i < 3 ? 'bear' : 'giant', controller: 1 as const })),
      ...Array.from({ length: 10 }, (_, i) => ({ iid: 60 + i, cardId: 'forest', controller: (i < 5 ? 0 : 1) as 0 | 1 })),
    ]);
    const view = game.viewFor(0);
    const before = structuredClone(view);
    const action: Action = { type: 'activate', iid: SOURCE, targets: cardId === 'duty_optional'
      ? [{ kind: 'permanent', iid: 40 }, { kind: 'permanent', iid: 41 }]
      : [{ kind: 'permanent', iid: 40 }] };
    // Measured with d42400c before removing the database adapters.
    expect(activateActionValue(view, DB, action)).toBe(expected);
    expect(activatedAbilityValue(view.battlefield, DB, SOURCE)).toBe(expected);
    const valueOf = createPermanentValuer(view.battlefield, DB);
    for (let iid = 10; iid < 18; iid++) expect(valueOf(iid)).toBe(1 + expected * 3);
    expect(view).toEqual(before);
  });

  it('preserves coupled optional-target values and original pair order beyond the top four singles', () => {
    const coupled: CardDef = carrier('duty_coupled', ['artifact'], {
      activated: { cost: { tap: true }, targets: [{ what: 'yourCreature', upTo: 2 }], ops: [
        { op: 'ifTargetMarked', then: [
          { op: 'markAll', scope: 'yourCreatures' }, { op: 'addCounters', to: 'target', n: 1 },
        ], else: [] },
      ] },
    });
    const db: CardDb = { ...DB, duty_coupled: coupled,
      duty_small_flyer: { ...DB.flyer, id: 'duty_small_flyer', attack: 1, defense: 1 } };
    expect(activatedCatalogErrors(coupled, db)).toEqual([]);
    const game = Game.restore(makeTestState({ active: 0, battlefield: [
      { iid: SOURCE, cardId: coupled.id, controller: 0 },
      ...Array.from({ length: 4 }, (_, i) => ({ iid: 20 + i, cardId: 'bear', controller: 0 as const, plusOneCounters: 1 })),
      { iid: 24, cardId: 'duty_small_flyer', controller: 0 },
    ] }), db);
    const view = game.viewFor(0);
    const before = structuredClone(view);
    const score = (...iids: number[]): number => activateActionValue(view, db, {
      type: 'activate', iid: SOURCE, targets: iids.map((iid) => ({ kind: 'permanent', iid })),
    });
    // Measured against the committed scorer: the zero-value singleton wins
    // as the second target after the first branch marks it. Order matters.
    expect([20, 21, 22, 23].map((iid) => score(iid))).toEqual([7.85, 7.85, 7.85, 7.85]);
    expect(score(24)).toBe(0);
    expect(score(20, 21)).toBe(15.7);
    expect(score(20, 24)).toBe(16);
    expect(score(24, 20)).toBe(7.85);
    expect(activatedAbilityValue(view.battlefield, db, SOURCE)).toBe(16);
    expect(view).toEqual(before);
  });

  it('does not share source-dependent potential between differently damaged carriers', () => {
    const card = carrier('duty_self', ['creature'], {
      activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 20 }, { op: 'severSelf' }] },
    });
    const db: CardDb = { ...DB, duty_self: card };
    const battlefield = makeTestState({ battlefield: [
      { iid: 10, cardId: card.id, controller: 0 },
      { iid: 11, cardId: card.id, controller: 0, damage: 3 },
    ] }).battlefield;
    const valueOf = createPermanentValuer(battlefield, db);
    expect(valueOf(10)).toBe(10);
    expect(valueOf(11)).toBe(11.5);
  });

  it('keeps potential reuse local to a board evaluation and separate by controller', () => {
    const game = board('duty_perf', 'main1', [
      { iid: 11, cardId: 'duty_perf', controller: 1 },
      { iid: 20, cardId: 'bear', controller: 0 },
      { iid: 21, cardId: 'giant', controller: 1 },
    ]);
    const battlefield = game.viewFor(0).battlefield;
    const valueOf = createPermanentValuer(battlefield, DB);
    expect(valueOf(10)).toBeCloseTo(3.7); // Two nonlethal damage to their giant.
    expect(valueOf(11)).toBe(13); // Lethal damage to our bear.
    battlefield.find((perm) => perm.iid === 21)!.damage = 2;
    expect(createPermanentValuer(battlefield, DB)(10)).toBe(22); // Fresh evaluation sees lethal.
  });

  it('retains a draw ability premium even though battlefield-only valuation has no deck information', () => {
    const game = board('duty_draw');
    game.state.players[0].deck = [];
    const view = game.viewFor(0);
    const bareDb = { ...DB, duty_draw: { ...DB.duty_draw, activated: undefined } };
    expect(permValue(view.battlefield, DB, SOURCE) - permValue(view.battlefield, bareDb, SOURCE)).toBeCloseTo(3.75);
  });
  it.each(['duty_creature', 'duty_artifact'])('%s keeps its expected-activation premium while tapped or newly arrived', (cardId) => {
    const bareDb = { ...DB, [cardId]: { ...DB[cardId], activated: undefined } };
    const multiplier = cardId === 'duty_creature' ? 2 : 3;
    for (const patch of [{}, { tapped: true }, { enteredThisTurn: true }, { tapped: true, enteredThisTurn: true }]) {
      const battlefield = board(cardId, 'main1', [], [], patch).viewFor(0).battlefield;
      expect(permValue(battlefield, DB, SOURCE) - permValue(battlefield, bareDb, SOURCE))
        .toBeCloseTo(opImpactValue(free.ops[0]) * multiplier);
    }
  });

  it('prices targeted Duty at its best public target and terminates with multiple Duty sources', () => {
    const game = board('duty_target', 'main1', [
      { iid: 20, cardId: 'bear', controller: 1 },
      { iid: 21, cardId: 'duty_target', controller: 1 },
    ]);
    const view = game.viewFor(0);
    const action = chooseActivate(view, DB, game.legalActions(0))!;
    const bareDb = { ...DB, duty_target: { ...DB.duty_target, activated: undefined } };
    expect(permValue(view.battlefield, DB, SOURCE)).toBeCloseTo(
      permValue(view.battlefield, bareDb, SOURCE) + activateActionValue(view, DB, action) * 3,
    );
    expect(Number.isFinite(permValue(view.battlefield, DB, 21))).toBe(true);
  });
});

describe('seeded Duty fixture matches', () => {
  it.each(difficulties)('%s records activations per game against Medium over four seeds', (difficulty) => {
    const deck = [
      ...Array<string>(16).fill('forest'), ...Array<string>(8).fill('duty_artifact'),
      ...Array<string>(8).fill('duty_creature'), ...Array<string>(8).fill('bear'),
    ];
    const counts: number[] = [];
    for (let seed = 40; seed < 44; seed++) {
      const seat = (seed % 2) as 0 | 1;
      const game = new Game({ decks: [[...deck], [...deck]], db: DB, seed });
      const ais = [new MediumAI(DB), new MediumAI(DB)] as AIPlayer[];
      // Exercise shipped Easy noise in matches, without overriding its seed.
      ais[seat] = difficulty === 'easy' ? new EasyAI(DB, seed * 7 + 1) : brain(difficulty, seed);
      let activations = 0;
      for (let guard = 0; guard < 3000; guard++) {
        const awaiting = game.awaiting;
        if (awaiting.kind === 'gameOver') break;
        const player = awaiting.player;
        const action = ais[player].chooseAction(game.viewFor(player), game.legalActions(player));
        const events = game.submit(player, action);
        activations += events.filter((event) => event.e === 'activated' && event.player === seat).length;
      }
      expect(game.awaiting.kind).toBe('gameOver');
      counts.push(activations);
    }
    const total = counts.reduce((sum, count) => sum + count, 0);
    console.log(`Duty ${difficulty}: ${counts.join(', ')} activations; ${total}/${counts.length} = ${total / counts.length} per game (seeds 40-43, alternating seats)`);
    expect(total).toBeGreaterThan(0);
  }, 60_000);
});
