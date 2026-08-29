import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import type { GameEvent } from '../../src/engine/events';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { destroyPermanent } from '../../src/engine/battlefield';
import { Game } from '../../src/engine/Game';
import type {
  CardEntry,
  CardDb,
  CardInstance,
  GameState,
  Permanent,
  PlayerId,
} from '../../src/engine/types';
import { makeTestState, smallGreenDeck, TEST_DB } from '../helpers';
import { DARK_TALES_DB, manaPermanent } from '../darkTalesFixture';

const IDENTITY_DB: CardDb = {
  ...TEST_DB,
  randomDiscard: {
    id: 'randomDiscard',
    name: 'Random Discard',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] }],
    rarity: 'c',
  },
  foresee3: {
    id: 'foresee3',
    name: 'Foresee Three',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 3 }] }],
    rarity: 'c',
  },
};

const ctx = { controller: 0 as const, sourceCardId: 'test', targets: [] };

function card(instanceId: number, cardId: string, variantKey: string | null = null): CardInstance {
  return { instanceId, cardId, variantKey };
}

function permanent(
  instanceId: number,
  cardId: string,
  iid = instanceId,
  controller: PlayerId = 0,
): Permanent {
  return {
    iid,
    instanceId,
    cardId,
    variantKey: 'blue|shiny|standard',
    owner: controller,
    controller,
    tapped: false,
    enteredThisTurn: false,
    damage: 0,
    deathtouched: false,
    severBranded: false,
    attachments: [],
    plusOneCounters: 0,
    untilEotMods: [],
  };
}

function instanceState(opts: { hand?: CardInstance[]; deck?: CardInstance[] } = {}): GameState {
  const state = makeTestState({ active: 0 });
  state.nextInstanceId = 100;
  state.players[0].hand = opts.hand ?? [];
  state.players[0].deck = opts.deck ?? [];
  return state;
}

function rulesJson(value: unknown): string {
  return JSON.stringify(value, (key, nested) =>
    key === 'instanceId' || key === 'variantKey' ? undefined : nested,
  );
}

function physicalCards(game: Game): CardInstance[] {
  const st = game.instanceState;
  return [
    ...st.players.flatMap((p) => [...p.deck, ...p.hand, ...p.graveyard, ...p.severed]),
    ...st.battlefield,
    ...st.stack,
  ].filter((value): value is CardInstance => typeof value !== 'string');
}

function instanceIds(entries: CardEntry[]): number[] {
  return entries.map((entry) => {
    if (typeof entry === 'string') throw new Error(`expected instance, got ${entry}`);
    return entry.instanceId;
  });
}

function variantDeck(deck: string[], prefix: string): CardInstance[] {
  return deck.map((cardId, i) => card(i + 1, cardId, `${prefix}-${i}`));
}

function runAi(
  difficulty: 'easy' | 'medium' | 'hard',
  seed: number,
  pinned: boolean,
): {
  legal: string[];
  actions: string[];
  events: string;
  state: string;
  rng: string;
  rngProgression: string[];
} {
  const base = smallGreenDeck();
  const decks: [string[] | CardInstance[], string[] | CardInstance[]] = pinned
    ? [variantDeck(base, 'p0'), variantDeck(base, 'p1')]
    : [base.slice(), base.slice()];
  const game = new Game({ decks, seed, db: TEST_DB });
  const makeBrain = (player: PlayerId): AIPlayer => {
    if (difficulty === 'easy') return new EasyAI(TEST_DB, seed * 17 + player + 1);
    if (difficulty === 'medium') return new MediumAI(TEST_DB);
    return new HardAI(TEST_DB);
  };
  const brains: [AIPlayer, AIPlayer] = [makeBrain(0), makeBrain(1)];
  const legal: string[] = [];
  const actions: string[] = [];
  const rngProgression: string[] = [];
  const events: GameEvent[] = [...game.initialEvents];

  for (let guard = 0; guard < 20_000 && game.awaiting.kind !== 'gameOver'; guard++) {
    const player = game.awaiting.player;
    const available = game.legalActions(player);
    legal.push(JSON.stringify(available));
    const action = brains[player].chooseAction(game.viewFor(player), available);
    actions.push(JSON.stringify({ player, action }));
    events.push(...game.submit(player, action));
    rngProgression.push(JSON.stringify(game.instanceState.rng));
  }
  expect(game.awaiting.kind).toBe('gameOver');
  return {
    legal,
    actions,
    events: rulesJson(events),
    state: rulesJson(game.instanceState),
    rng: JSON.stringify(game.instanceState.rng),
    rngProgression,
  };
}

describe('Wave 1 physical card instances', () => {
  it('normalizes string decks, assigns stable unique IDs, and preserves authored variants', () => {
    const plain = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 7, db: TEST_DB });
    const pinned = new Game({
      decks: [variantDeck(smallGreenDeck(), 'a'), variantDeck(smallGreenDeck(), 'b')],
      seed: 7,
      db: TEST_DB,
    });
    const plainCards = physicalCards(plain);
    const pinnedCards = physicalCards(pinned);
    expect(plainCards.every((entry) => typeof entry.instanceId === 'number')).toBe(true);
    expect(new Set(plainCards.map((entry) => entry.instanceId)).size).toBe(plainCards.length);
    expect(pinnedCards.filter((entry) => entry.variantKey !== null)).toHaveLength(40);
    expect(pinnedCards.map((entry) => entry.instanceId)).toEqual(
      plainCards.map((entry) => entry.instanceId),
    );
  });

  it('draw, mulligan, London bottoming, and chosen discard move the same objects', () => {
    const game = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 19, db: TEST_DB });
    const player = game.instanceState.startingPlayer;
    const beforeEntries = [
      ...game.instanceState.players[player].deck,
      ...game.instanceState.players[player].hand,
    ];
    const before = instanceIds(beforeEntries);
    game.submit(player, { type: 'mulligan' });
    game.submit(player, { type: 'mulligan' });
    game.submit(player, { type: 'keepHand' });
    expect(game.awaiting.kind).toBe('bottomCards');
    game.submit(player, { type: 'bottomCards', handIndices: [0] });
    const afterEntries = [
      ...game.instanceState.players[player].deck,
      ...game.instanceState.players[player].hand,
    ];
    const after = instanceIds(afterEntries);
    expect([...after].sort((a, b) => a - b)).toEqual([...before].sort((a, b) => a - b));

    const discardState = instanceState({ hand: [card(501, 'bear', 'discard-look')] });
    discardState.awaiting = { player: 0, kind: 'discardToHandSize', count: 1 };
    const discardGame = Game.restore(discardState, TEST_DB);
    discardGame.submit(0, { type: 'discard', handIndices: [0] });
    expect(discardGame.instanceState.players[0].graveyard[0]).toEqual(
      card(501, 'bear', 'discard-look'),
    );
  });

  it('random discard preserves the discarded instance and consumes only engine RNG', () => {
    const state = instanceState({});
    state.players[1].hand = [card(601, 'bear', 'random-look')];
    const beforeRng = JSON.stringify(state.rng);
    const events: GameEvent[] = [];
    runOps(state, IDENTITY_DB, (event) => events.push(event), ctx, [
      { op: 'discardRandom', n: 1, who: 'opponent' },
    ]);
    expect(state.players[1].hand).toEqual([]);
    expect(state.players[1].graveyard).toEqual([card(601, 'bear', 'random-look')]);
    expect(JSON.stringify(state.rng)).not.toBe(beforeRng);
    expect(events).toContainEqual({ e: 'discarded', player: 1, cardId: 'bear' });
  });

  it('cast then cancel returns the exact stack instance to its graveyard', () => {
    const state = instanceState({ hand: [card(701, 'shock', 'spell-look')] });
    state.players[1].hand = [card(702, 'cancel', 'counter-look')];
    state.battlefield = [
      permanent(710, 'mountain', 1, 0),
      permanent(711, 'island', 2, 1),
      permanent(712, 'island', 3, 1),
    ];
    const game = Game.restore(state, TEST_DB);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'player', player: 1 }] });
    const counter = game.legalActions(1).find(
      (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'stackItem',
    );
    expect(counter).toBeDefined();
    game.submit(1, counter!);
    expect(game.instanceState.players[0].graveyard).toEqual([
      card(701, 'shock', 'spell-look'),
    ]);
    expect(game.instanceState.players[1].graveyard).toEqual([
      card(702, 'cancel', 'counter-look'),
    ]);
  });

  it('destroy, recall, and Sever retain identity through graveyard, hand, and exile', () => {
    const make = (): GameState => {
      const state = instanceState();
      state.battlefield = [permanent(801, 'bear')];
      return state;
    };
    const destroyed = make();
    runOps(destroyed, TEST_DB, () => {}, { ...ctx, targets: [{ kind: 'permanent', iid: 801 }] }, [
      { op: 'destroy', to: 'target' },
    ]);
    expect(destroyed.players[0].graveyard).toEqual([card(801, 'bear', 'blue|shiny|standard')]);

    const recalled = make();
    runOps(recalled, TEST_DB, () => {}, { ...ctx, targets: [{ kind: 'permanent', iid: 801 }] }, [
      { op: 'recall', to: 'target' },
    ]);
    expect(recalled.players[0].hand).toEqual([card(801, 'bear', 'blue|shiny|standard')]);

    const severed = make();
    runOps(severed, TEST_DB, () => {}, { ...ctx, targets: [{ kind: 'permanent', iid: 801 }] }, [
      { op: 'sever', to: 'target' },
    ]);
    expect(severed.players[0].severed).toEqual([card(801, 'bear', 'blue|shiny|standard')]);
  });

  it('all three Sever operations preserve order and identity', () => {
    const state = instanceState();
    state.battlefield = [permanent(811, 'bear')];
    state.players[0].graveyard = [card(812, 'elf', 'grave-a'), card(813, 'giant', 'grave-b')];
    state.players[0].deck = [card(814, 'knight', 'deck-a')];
    runOps(state, TEST_DB, () => {}, { ...ctx, targets: [{ kind: 'permanent', iid: 811 }] }, [
      { op: 'sever', to: 'target' },
      { op: 'severGrave', n: 2, who: 'self' },
      { op: 'severTop', n: 1, who: 'self' },
    ]);
    expect(state.players[0].severed.map((entry) => (entry as CardInstance).instanceId)).toEqual([
      811, 813, 812, 814,
    ]);
  });

  it('Foresee carries identities through the pending decision and clone snapshot', () => {
    const state = instanceState({ hand: [card(821, 'foresee3', 'spell-look')] });
    state.players[0].deck = [
      card(822, 'forest', 'bottom'),
      card(823, 'bear', 'middle'),
      card(824, 'elf', 'top-2'),
      card(825, 'giant', 'top-1'),
    ];
    const game = Game.restore(state, IDENTITY_DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.instanceState.awaiting.kind).toBe('foresee');
    if (game.instanceState.awaiting.kind !== 'foresee') throw new Error('expected Foresee');
    expect(instanceIds(game.instanceState.awaiting.cards)).toEqual([825, 824, 823]);
    const snapshot = game.clone();
    game.submit(0, { type: 'foresee', bottomIndices: [0] });
    expect(instanceIds(game.instanceState.players[0].deck)).toEqual([825, 822, 823, 824]);
    expect(snapshot.instanceState.awaiting.kind).toBe('foresee');
    expect(instanceIds(snapshot.instanceState.players[0].deck)).toEqual([822, 823, 824, 825]);
    const restored = Game.restore(snapshot.instanceState, IDENTITY_DB);
    expect(restored.instanceState.awaiting).toEqual(snapshot.instanceState.awaiting);
    expect(instanceIds(restored.instanceState.awaiting.kind === 'foresee' ? restored.instanceState.awaiting.cards : [])).toEqual(
      [825, 824, 823],
    );
    expect(instanceIds(restored.instanceState.players[0].deck)).toEqual([822, 823, 824, 825]);
  });

  it('Skim and Retell carry the same instance into their destination zones', () => {
    const skimState = instanceState({ hand: [card(831, 'skimCard', 'skim-look')] });
    skimState.players[0].deck = [card(832, 'forest', 'draw-look')];
    skimState.battlefield = [manaPermanent(1) as Permanent];
    const skim = Game.restore(skimState, DARK_TALES_DB);
    skim.submit(0, { type: 'skim', handIndex: 0, manaPlan: [1] });
    expect(skim.instanceState.players[0].graveyard).toEqual([card(831, 'skimCard', 'skim-look')]);
    expect(skim.instanceState.players[0].hand).toEqual([card(832, 'forest', 'draw-look')]);

    const retellState = instanceState();
    retellState.players[0].graveyard = [card(833, 'retellRitual', 'retell-look')];
    retellState.battlefield = [manaPermanent(1, 'island') as Permanent];
    const retell = Game.restore(retellState, DARK_TALES_DB);
    const action = retell.legalActions(0).find(
      (candidate) => candidate.type === 'castSpell' && candidate.retell,
    );
    expect(action).toBeDefined();
    retell.submit(0, action!);
    expect(retell.instanceState.players[0].severed).toEqual([
      card(833, 'retellRitual', 'retell-look'),
    ]);

    const cancelledState = instanceState();
    cancelledState.players[0].graveyard = [card(834, 'retellTargeted', 'cancelled-look')];
    cancelledState.players[1].hand = [card(835, 'counter', 'counter-look')];
    cancelledState.battlefield = [
      manaPermanent(1, 'island') as Permanent,
      permanent(802, 'bear', 2, 1),
    ];
    const cancelled = Game.restore(cancelledState, DARK_TALES_DB);
    const cancelledCast = cancelled.legalActions(0).find(
      (candidate) => candidate.type === 'castSpell' && candidate.retell,
    );
    expect(cancelledCast).toBeDefined();
    cancelled.submit(0, cancelledCast!);
    const counter = cancelled.legalActions(1).find(
      (candidate) => candidate.type === 'castSpell' && candidate.targets?.[0]?.kind === 'stackItem',
    );
    expect(counter).toBeDefined();
    cancelled.submit(1, counter!);
    expect(cancelled.instanceState.players[0].severed).toEqual([
      card(834, 'retellTargeted', 'cancelled-look'),
    ]);
  });

  it('token creation allocates a fresh null-treatment identity and evaporates cleanly', () => {
    const state = instanceState();
    runOps(state, TEST_DB, () => {}, ctx, [{ op: 'createToken', token: 'tok_fox', count: 2 }]);
    expect(state.battlefield).toHaveLength(2);
    expect(state.battlefield.map((perm) => perm.variantKey)).toEqual([null, null]);
    expect(new Set(state.battlefield.map((perm) => perm.instanceId)).size).toBe(2);
    const token = state.battlefield[0];
    expect(destroyPermanent(state, TEST_DB, token, () => {})).toBe(true);
    expect(state.players[0].graveyard).toEqual([]);
  });

  it('legacy player views and events never expose hidden variant keys or patterns', () => {
    const plain = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 41, db: TEST_DB });
    const pinned = new Game({
      decks: [smallGreenDeck(), variantDeck(smallGreenDeck(), 'hidden')],
      seed: 41,
      db: TEST_DB,
    });
    expect(JSON.stringify(plain.viewFor(0))).toBe(JSON.stringify(pinned.viewFor(0)));
    expect(JSON.stringify(plain.initialEvents)).toBe(JSON.stringify(pinned.initialEvents));
    expect(JSON.stringify(pinned.viewFor(0))).not.toContain('hidden-');
    expect(JSON.stringify(pinned.initialEvents)).not.toContain('hidden-');
    expect(pinned.instanceState.players[0].hand[0]).toBeDefined();
  });

  it('plain and fully pinned games are equivalent for Easy, Medium, and Hard AI across seeds', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const seed of [3, 11]) {
        expect(runAi(difficulty, seed, true)).toEqual(runAi(difficulty, seed, false));
      }
    }
  }, 30_000);
});
