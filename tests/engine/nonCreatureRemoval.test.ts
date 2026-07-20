import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { enterBattlefield } from '../../src/engine/battlefield';
import { fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import { enumerateTargets, isLegalTarget } from '../../src/engine/effects/targeting';
import { checkStateBased } from '../../src/engine/sba';
import type { CardDb, TargetRef } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  artifact: {
    id: 'artifact',
    name: 'Test Artifact',
    types: ['artifact'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
  },
  dawn_engine: {
    id: 'dawn_engine',
    name: 'Dawn Engine',
    types: ['enchantment'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'dawn', ops: [{ op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  aura: {
    id: 'aura',
    name: 'Test Aura',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  untouchable_artifact: {
    id: 'untouchable_artifact',
    name: 'Untouchable Artifact Creature',
    types: ['creature', 'artifact'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    keywords: ['untouchable'],
    rarity: 'c',
  },
  token_artifact: {
    id: 'token_artifact',
    name: 'Token Artifact',
    types: ['artifact'],
    subtypes: [],
    colors: [],
    token: true,
    rarity: 'c',
  },
  arrival_selector: {
    id: 'arrival_selector',
    name: 'Arrival Selector',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    attack: 1,
    defense: 1,
    abilities: [{ when: 'arrives', ops: [{ op: 'destroyNewestOpponentArtifactOrEnchantment' }] }],
    rarity: 'c',
  },
};

const target = (iid: number): TargetRef => ({ kind: 'permanent', iid });
const ctx = { controller: 0 as const, sourceCardId: 'test', targets: [] as TargetRef[] };

function eventsFor(
  state: ReturnType<typeof makeTestState>,
  ops: Parameters<typeof runOps>[4],
  targets: TargetRef[] = [],
): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, DB, (event) => events.push(event), { ...ctx, targets }, ops);
  return events;
}

describe('artifact and enchantment targeting', () => {
  const state = makeTestState({
    battlefield: [
      { iid: 1, cardId: 'artifact', controller: 0 },
      { iid: 2, cardId: 'dawn_engine', controller: 1 },
      { iid: 3, cardId: 'bear', controller: 1 },
      { iid: 4, cardId: 'untouchable_artifact', controller: 1 },
    ],
  });

  it('enumerates exact and combined artifact or enchantment targets', () => {
    expect(enumerateTargets(state, DB, 0, { what: 'artifact' })).toEqual([
      target(1),
      target(4),
    ]);
    expect(enumerateTargets(state, DB, 0, { what: 'enchantment' })).toEqual([target(2)]);
    expect(enumerateTargets(state, DB, 0, { what: 'artifactOrEnchantment' })).toEqual([
      target(1),
      target(2),
      target(4),
    ]);
  });

  it('keeps creature untouchable creature-only while non-creature targeting ignores it', () => {
    expect(isLegalTarget(state, DB, 0, { what: 'creature' }, target(4))).toBe(false);
    expect(isLegalTarget(state, DB, 0, { what: 'artifact' }, target(4))).toBe(true);
    expect(isLegalTarget(state, DB, 0, { what: 'artifactOrEnchantment' }, target(4))).toBe(true);
  });
});

describe('non-creature removal ops', () => {
  it('destroys an artifact and severs an enchantment', () => {
    const destroyState = makeTestState({ battlefield: [{ iid: 1, cardId: 'artifact', controller: 1 }] });
    const destroyEvents = eventsFor(destroyState, [{ op: 'destroy', to: 'target' }], [target(1)]);
    expect(destroyState.battlefield).toEqual([]);
    expect(destroyState.players[1].graveyard).toEqual(['artifact']);
    expect(destroyEvents.some((event) => event.e === 'died' && event.iid === 1)).toBe(true);

    const severState = makeTestState({ battlefield: [{ iid: 2, cardId: 'dawn_engine', controller: 1 }] });
    const severEvents = eventsFor(severState, [{ op: 'sever', to: 'target' }], [target(2)]);
    expect(severState.battlefield).toEqual([]);
    expect(severState.players[1].severed).toEqual(['dawn_engine']);
    expect(severEvents.some((event) => event.e === 'died')).toBe(false);
  });

  it('recalls an artifact, and token artifacts evaporate instead of entering hand', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'artifact', controller: 1 },
        { iid: 2, cardId: 'token_artifact', controller: 1 },
      ],
    });
    eventsFor(state, [{ op: 'recall', to: 'target' }], [target(1)]);
    eventsFor(state, [{ op: 'recall', to: 'target' }], [target(2)]);
    expect(state.players[1].hand).toEqual(['artifact']);
    expect(state.battlefield).toEqual([]);
    expect(state.players[1].graveyard).toEqual([]);
  });

  it('cleans an aura when its host is destroyed, severed, or recalled', () => {
    for (const op of [
      { op: 'destroy', to: 'target' } as const,
      { op: 'sever', to: 'target' } as const,
      { op: 'recall', to: 'target' } as const,
    ]) {
      const state = makeTestState({
        battlefield: [
          { iid: 1, cardId: 'dawn_engine', controller: 1, attachments: [2] },
          { iid: 2, cardId: 'aura', controller: 1, attachedTo: 1 },
        ],
      });
      const events = eventsFor(state, [op], [target(1)]);
      checkStateBased(state, DB, (event) => events.push(event));
      expect(state.battlefield).toEqual([]);
      expect(state.players[1].graveyard).toContain('aura');
      if (op.op === 'destroy') expect(state.players[1].graveyard).toContain('dawn_engine');
      if (op.op === 'sever') expect(state.players[1].severed).toEqual(['dawn_engine']);
      if (op.op === 'recall') expect(state.players[1].hand).toEqual(['dawn_engine']);
      expect(state.players[1].life).toBe(22);
    }
  });

  it('removing an attached aura directly leaves its host in play and detaches it', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 1, attachments: [2] },
        { iid: 2, cardId: 'aura', controller: 1, attachedTo: 1 },
      ],
    });
    eventsFor(state, [{ op: 'destroy', to: 'target' }], [target(2)]);
    expect(state.battlefield.map((perm) => perm.cardId)).toEqual(['bear']);
    expect(state.battlefield[0].attachments).toEqual([]);
    expect(state.players[1].graveyard).toEqual(['aura']);
  });
});

describe('trigger-safe and conditional removal ops', () => {
  it('destroys the opponent newest artifact or enchantment in entry order', () => {
    const make = () =>
      makeTestState({
        battlefield: [
          { iid: 1, cardId: 'artifact', controller: 1 },
          { iid: 2, cardId: 'dawn_engine', controller: 1 },
          { iid: 3, cardId: 'bear', controller: 0 },
          { iid: 4, cardId: 'artifact', controller: 1 },
        ],
      });
    const a = make();
    const b = make();
    const eventsA = eventsFor(a, [{ op: 'destroyNewestOpponentArtifactOrEnchantment' }]);
    const eventsB = eventsFor(b, [{ op: 'destroyNewestOpponentArtifactOrEnchantment' }]);
    expect(a.battlefield.map((perm) => perm.iid)).toEqual([1, 2, 3]);
    expect(a.players[1].graveyard).toEqual(['artifact']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
  });

  it('is a no-op when the opponent has no artifact or enchantment', () => {
    const state = makeTestState({ battlefield: [{ iid: 1, cardId: 'bear', controller: 1 }] });
    const before = JSON.stringify(state);
    const events = eventsFor(state, [{ op: 'destroyNewestOpponentArtifactOrEnchantment' }]);
    expect(JSON.stringify(state)).toBe(before);
    expect(events).toEqual([{ e: 'effectApplied', op: 'destroyNewestOpponentArtifactOrEnchantment' }]);
  });

  it('destroys artifacts and severs enchantments with an artifact-first branch', () => {
    const artifact = makeTestState({ battlefield: [{ iid: 1, cardId: 'artifact', controller: 1 }] });
    const artifactEvents = eventsFor(
      artifact,
      [{ op: 'destroyArtifactOrSeverEnchantment', to: 'target' }],
      [target(1)],
    );
    expect(artifact.players[1].graveyard).toEqual(['artifact']);
    expect(artifact.players[1].severed).toEqual([]);
    expect(artifactEvents.some((event) => event.e === 'died')).toBe(true);

    const enchantment = makeTestState({ battlefield: [{ iid: 2, cardId: 'dawn_engine', controller: 1 }] });
    const enchantmentEvents = eventsFor(
      enchantment,
      [{ op: 'destroyArtifactOrSeverEnchantment', to: 'target' }],
      [target(2)],
    );
    expect(enchantment.players[1].graveyard).toEqual([]);
    expect(enchantment.players[1].severed).toEqual(['dawn_engine']);
    expect(enchantmentEvents.some((event) => event.e === 'died')).toBe(false);
  });

  it('massDestroy allEnchantments destroys auras and leaves creatures alone', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 1 },
        { iid: 2, cardId: 'dawn_engine', controller: 1 },
        { iid: 3, cardId: 'aura', controller: 0, attachedTo: 1 },
        { iid: 4, cardId: 'artifact', controller: 0 },
      ],
    });
    eventsFor(state, [{ op: 'massDestroy', filter: 'allEnchantments' }]);
    expect(state.battlefield.map((perm) => perm.cardId)).toEqual(['bear', 'artifact']);
    expect(state.players[0].graveyard).toEqual(['aura']);
    expect(state.players[1].graveyard).toEqual(['dawn_engine']);
  });

  it('fires the newest selector from an arrival trigger without targets', () => {
    const state = makeTestState({ battlefield: [{ iid: 1, cardId: 'artifact', controller: 1 }] });
    const events: GameEvent[] = [];
    const source = enterBattlefield(state, DB, 'arrival_selector', 0, (event) => events.push(event));
    fireTriggers(state, DB, (event) => events.push(event), 'arrives', source);
    expect(state.players[1].graveyard).toEqual(['artifact']);
    expect(state.battlefield.some((perm) => perm.cardId === 'arrival_selector')).toBe(true);
    expect(events.some((event) => event.e === 'effectApplied' && event.op === 'destroyNewestOpponentArtifactOrEnchantment')).toBe(true);
  });
});
