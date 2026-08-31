import { describe, expect, it } from 'vitest';
import { startTurn } from '../../src/engine/phases';
import { fireTriggers } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import { manaSources, solveMana } from '../../src/engine/mana';
import { getEffectiveStats } from '../../src/engine/statics';
import type { GameEvent } from '../../src/engine/events';
import {
  cardIdOf,
  type CardDb,
  type CardDef,
  type GameState,
  type Permanent,
  type TargetRef,
  isType,
  validateMarkTriggerDef,
} from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import {
  canReplay,
  finishReplay,
  replayDbStamp,
  REPLAY_LOG_VERSION,
  startReplayDraft,
  type ReplayLog,
} from '../../src/meta/Replay';
import { makeTestState, TEST_DB } from '../helpers';

const ZERO = { generic: 0, pips: {} };

function card(
  id: string,
  types: CardDef['types'],
  extra: Partial<CardDef> = {},
): CardDef {
  return {
    id,
    name: id,
    types,
    subtypes: [],
    colors: [],
    rarity: 'c',
    ...extra,
  };
}

function permanent(
  iid: number,
  cardId: string,
  controller: 0 | 1 = 0,
  plusOneCounters = 0,
): Partial<Permanent> {
  return {
    iid,
    cardId,
    owner: controller,
    controller,
    plusOneCounters,
    enteredThisTurn: false,
    tapped: false,
  };
}

const DB: CardDb = {
  ...TEST_DB,
  arrival: card('arrival', ['creature'], {
    abilities: [{
      when: 'arrives',
      targets: [{ what: 'creature', other: true }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
    cost: ZERO,
    attack: 1,
    defense: 1,
  }),
  allyObserver: card('allyObserver', ['creature'], {
    abilities: [{
      when: 'allyCreatureArrives',
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
    cost: ZERO,
    attack: 1,
    defense: 1,
  }),
  plainArrival: card('plainArrival', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
  }),
  tokenSpell: card('tokenSpell', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      ops: [{ op: 'createToken', token: 'tok_fox', count: 2 }],
    }],
  }),
  biomancer: card('biomancer', ['creature'], {
    cost: ZERO,
    attack: 2,
    defense: 2,
    abilities: [{
      when: 'arrives',
      targets: [{ what: 'yourCreature', other: true }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
  }),
  creatureMarkObserver: card('creatureMarkObserver', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'yourCreatureMarked', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  markPermanent: card('markPermanent', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'yourPermanent' }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
  }),
  markedPermanentTarget: card('markedPermanentTarget', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'yourPermanent', marked: true }],
      ops: [{ op: 'removeMarks', to: 'target' }],
    }],
  }),
  theirMarkedDebuff: card('theirMarkedDebuff', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      ops: [{ op: 'boost', p: -2, t: -2, scope: 'theirMarked' }],
    }],
  }),
  redlineSupernova: card('redlineSupernova', ['ritual'], {
    cost: { generic: 2, pips: { R: 1 } },
    colors: ['R'],
    abilities: [{
      when: 'spell',
      ops: [{ op: 'damage', n: 3, to: 'eachCreature', severOnDeath: true }],
    }],
  }),
  redlineFollowup: card('redlineFollowup', ['ritual'], {
    cost: ZERO,
    colors: ['R'],
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [{ op: 'damage', n: 4, to: 'target' }],
    }],
  }),
  redlineNormalSweep: card('redlineNormalSweep', ['ritual'], {
    cost: ZERO,
    colors: ['R'],
    abilities: [{
      when: 'spell',
      ops: [{ op: 'damage', n: 1, to: 'eachCreature' }],
    }],
  }),
  redlineThree: card('redlineThree', ['creature'], {
    cost: ZERO,
    colors: ['R'],
    attack: 2,
    defense: 3,
  }),
  redlineThreeWatcher: card('redlineThreeWatcher', ['creature'], {
    cost: ZERO,
    attack: 2,
    defense: 3,
    abilities: [
      { when: 'dies', ops: [{ op: 'gainLife', n: 1 }] },
      { when: 'entersGraveyard', ops: [{ op: 'gainLife', n: 1 }] },
    ],
  }),
  redlineThreeNineLives: card('redlineThreeNineLives', ['creature'], {
    cost: ZERO,
    attack: 2,
    defense: 3,
    nineLives: true,
  }),
  redlineFour: card('redlineFour', ['creature'], {
    cost: ZERO,
    attack: 2,
    defense: 4,
  }),
  redlineOne: card('redlineOne', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
  }),
  arrivalFizzle: card('arrivalFizzle', ['artifact'], {
    abilities: [
      {
        when: 'arrives',
        targets: [{ what: 'creature', other: true }],
        ops: [{ op: 'addCounters', n: 1, to: 'target' }],
      },
      { when: 'arrives', ops: [{ op: 'massDestroy', filter: 'allCreatures' }] },
    ],
    cost: ZERO,
  }),
  upTo: card('upTo', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{ op: 'boost', p: 2, t: 0, scope: 'target' }],
    }],
  }),
  upToConditional: card('upToConditional', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{
        op: 'ifTargetMarked',
        then: [{ op: 'boost', p: 1, t: 0, scope: 'target' }],
        else: [{ op: 'boost', p: -1, t: 0, scope: 'target' }],
      }],
    }],
  }),
  markedTarget: card('markedTarget', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', marked: true }],
      ops: [{ op: 'sever', to: 'target' }],
    }],
  }),
  tappedTarget: card('tappedTarget', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', tapped: true }],
      ops: [{ op: 'sever', to: 'target' }],
    }],
  }),
  arrivalMarkedOther: card('arrivalMarkedOther', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [
      { when: 'arrives', ops: [{ op: 'addCounters', n: 1, to: 'self' }] },
      {
        when: 'arrives',
        targets: [{ what: 'creature', marked: true, other: true }],
        ops: [{ op: 'addCounters', n: 1, to: 'target' }],
      },
    ],
  }),
  markTwice: card('markTwice', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [{ op: 'addCounters', n: 2, to: 'target' }],
    }],
  }),
  propagateSpell: card('propagateSpell', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'propagate' }] }],
  }),
  markAllSpell: card('markAllSpell', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'markAll', scope: 'yourCreatures' }] }],
  }),
  drainMarked: card('drainMarked', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'loseLifePerTheirMarked', who: 'opponent' }] }],
  }),
  fetch: card('fetch', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
  }),
  recallForesee: card('recallForesee', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [
        { op: 'recall', to: 'target' },
        { op: 'foresee', n: 1, who: 'targetOwner' },
      ],
    }],
  }),
  conditional: card('conditional', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [{
        op: 'ifTargetMarked',
        then: [{ op: 'boost', p: 3, t: 3, scope: 'target' }],
        else: [{ op: 'boost', p: -1, t: -1, scope: 'target' }],
      }],
    }],
  }),
  move: card('move', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'moveMark' }],
    }],
  }),
  moveAny: card('moveAny', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }, { what: 'creature' }],
      ops: [{ op: 'moveMark' }],
    }],
  }),
  quietOrbit: card('quietOrbit', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'spell' }, { what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'cancel', to: 'target' }, { op: 'moveMark' }],
    }],
  }),
  remove: card('remove', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [{ op: 'removeMarks', to: 'target' }],
    }],
  }),
  kill: card('kill', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature' }],
      ops: [{ op: 'destroy', to: 'target' }],
    }],
  }),
  markedCarrier: card('markedCarrier', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'gainsMark', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  markedObserver: card('markedObserver', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'yourPermanentMarked', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  addObserver: card('addObserver', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'youAddMark', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  otherObserver: card('otherObserver', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'otherCreatureMarked', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  propagatedObserver: card('propagatedObserver', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'propagated', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  controlMarked: card('controlMarked', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'arrives', condition: 'controlMarked', ops: [{ op: 'gainLife', n: 2 }] }],
  }),
  queen: card('queen', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{
      when: 'markedAllyAttacks',
      ops: [{ op: 'gainLife', n: 1 }],
    }],
  }),
  threshold: card('threshold', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'dawn', condition: { kind: 'markedThreshold', n: 5, subject: 'permanents' }, ops: [{ op: 'gainLife', n: 3 }] }],
  }),
  thresholdCreatures: card('thresholdCreatures', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'dawn', condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' }, ops: [{ op: 'gainLife', n: 4 }] }],
  }),
  markedBanner: card('markedBanner', ['artifact'], {
    cost: ZERO,
    abilities: [{
      when: 'static',
      static: {
        scope: 'filter',
        filter: { marked: true, who: 'yours' },
        p: 2,
        t: 1,
        grantKeywords: ['sentinel'],
      },
    }],
  }),
  opponentGate: card('opponentGate', ['artifact'], {
    cost: ZERO,
    abilities: [{
      when: 'static',
      static: { scope: 'filter', filter: { marked: true, who: 'opponent' }, p: -1, t: 0 },
    }],
  }),
  nine: card('nine', ['creature'], {
    cost: ZERO,
    attack: 2,
    defense: 2,
    nineLives: true,
  }),
  artifactWatcher: card('artifactWatcher', ['artifact'], {
    cost: ZERO,
    abilities: [
      { when: 'arrives', ops: [{ op: 'gainLife', n: 1 }] },
      { when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] },
    ],
  }),
  ritualQuest: card('ritualQuest', ['ritual'], {
    cost: ZERO,
    chapters: [
      [{ op: 'gainLife', n: 1 }],
      [{ op: 'gainLife', n: 2 }],
    ],
  }),
  severRaise: card('severRaise', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'dawn', ops: [{ op: 'severSelf' }, { op: 'raise', to: 'top', withMarks: 2 }] }],
  }),
  raiseMarked: card('raiseMarked', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'raise', to: 'top', withMarks: 3 }] }],
  }),
  enchantmentTarget: card('enchantmentTarget', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'enchantment' }],
      ops: [{ op: 'sever', to: 'target' }],
    }],
  }),
  enchantmentSweep: card('enchantmentSweep', ['charm'], {
    cost: ZERO,
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allEnchantments' }] }],
  }),
  tailToken: card('tailToken', ['creature'], {
    token: true,
    attack: 1,
    defense: 1,
    abilities: [{
      when: 'arrives',
      targets: [{ what: 'player' }],
      ops: [{ op: 'gainLife', n: 1 }],
    }],
  }),
  tailSpell: card('tailSpell', ['charm'], {
    cost: ZERO,
    abilities: [{
      when: 'spell',
      ops: [{ op: 'createToken', token: 'tailToken', count: 1 }, { op: 'gainLife', n: 1 }],
    }],
  }),
  recursiveMarker: card('recursiveMarker', ['creature'], {
    cost: ZERO,
    attack: 1,
    defense: 1,
    abilities: [{ when: 'gainsMark', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }],
  }),
  empowerMove: card('empowerMove', ['charm'], {
    cost: ZERO,
    empower: {
      cost: ZERO,
      targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'moveMark' }],
    },
  }),
  badEmpower: card('badEmpower', ['charm'], {
    cost: ZERO,
    empower: {
      cost: ZERO,
      targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'gainLife', n: 1 }],
    },
  }),
  cLand: card('cLand', ['land'], {
    manaAbility: ['C'],
  }),
};

function gameWithHand(
  hand: string[],
  battlefield: Partial<Permanent>[] = [],
  decks: [string[], string[]] = [[], []],
): Game {
  const state = makeTestState({ battlefield, hands: [hand, []], active: 0 });
  state.players[0].deck = decks[0];
  state.players[1].deck = decks[1];
  return Game.restore(state, DB);
}

function cast(game: Game, handIndex = 0, targets?: TargetRef[], empowered = false): void {
  game.submit(0, {
    type: 'castSpell',
    handIndex,
    ...(targets === undefined ? {} : { targets }),
    ...(empowered ? { empowered: true } : {}),
  });
}

function ref(iid: number): TargetRef {
  return { kind: 'permanent', iid };
}

function passTurn(game: Game, player: 0 | 1): void {
  game.submit(player, { type: 'passStep' });
  game.submit(player, { type: 'declareAttackers', attackers: [] });
  game.submit(player, { type: 'passStep' });
}

describe('Starborne targeted arrival and spell targets', () => {
  it('queues a mandatory targeted arrival choice, excludes its source, and resumes through Game.submit', () => {
    const game = gameWithHand(['arrival'], [permanent(1, 'bear')]);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    const source = game.state.battlefield.find((p) => p.cardId === 'arrival')!;
    expect(game.awaiting).toEqual({
      player: 0,
      kind: 'chooseTarget',
      sourceIid: source.iid,
      abilityIndex: 0,
      targets: [ref(1)],
    });
    expect(game.instanceState.pendingDecisions[0]).toMatchObject({
      kind: 'chooseTarget',
      player: 0,
      sourceIid: source.iid,
      sourceCardId: 'arrival',
      abilityIndex: 0,
      spec: { what: 'creature', other: true },
    });
    expect(events.some((event) => event.e === 'spellResolved')).toBe(true);
    game.submit(0, { type: 'chooseTarget', target: ref(1) });
    expect(game.state.battlefield.find((p) => p.iid === 1)?.plusOneCounters).toBe(1);
    expect(game.awaiting.kind).toBe('main');
  });

  it('silently fizzles an arrival trigger whose target disappears before resolution', () => {
    const game = gameWithHand(['arrivalFizzle'], [permanent(1, 'bear')]);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting.kind).toBe('main');
    expect(game.instanceState.pendingDecisions).toEqual([]);
    expect(game.state.battlefield.some((p) => p.cardId === 'bear')).toBe(false);
    expect(events.some((event) => event.e === 'effectApplied' && event.op === 'addCounters')).toBe(false);
    const arrivalTrigger = events.find((event) => event.e === 'triggerFired' && event.when === 'arrives');
    expect(arrivalTrigger?.e).toBe('triggerFired');
    if (arrivalTrigger?.e === 'triggerFired') {
      expect(events).toContainEqual({ e: 'triggerFizzled', iid: arrivalTrigger.iid });
    }
  });

  it.each([
    { label: 'zero', targets: [] as TargetRef[], expected: [0, 0] },
    { label: 'one', targets: [ref(1)], expected: [2, 0] },
    { label: 'two', targets: [ref(1), ref(2)], expected: [2, 2] },
  ])('applies an upTo spell independently to $label chosen targets', ({ targets, expected }) => {
    const game = gameWithHand(['upTo'], [permanent(1, 'bear'), permanent(2, 'bear')]);
    cast(game, 0, targets);
    expect(getEffectiveStats(game.state.battlefield, DB, 1).attack).toBe(2 + expected[0]);
    expect(getEffectiveStats(game.state.battlefield, DB, 2).attack).toBe(2 + expected[1]);
  });

  it('enumerates upTo targets as distinct unordered sets and keeps zero legal', () => {
    const game = gameWithHand(['upTo'], [permanent(1, 'bear'), permanent(2, 'bear')]);
    const actions = game.legalActions(0).filter(
      (action): action is Extract<typeof action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    expect(actions.map((action) => action.targets ?? [])).toEqual([
      [],
      [ref(1)],
      [ref(2)],
      [ref(1), ref(2)],
    ]);
    expect(() => cast(game, 0, [ref(1), ref(1)])).toThrow('upTo targets must be distinct');
  });

  it('fans ifTargetMarked branches over each independently chosen upTo target', () => {
    const game = gameWithHand(['upToConditional'], [
      permanent(1, 'bear', 0, 1),
      permanent(2, 'bear'),
    ]);
    cast(game, 0, [ref(1), ref(2)]);
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 4, defense: 3 });
    expect(getEffectiveStats(game.state.battlefield, DB, 2)).toMatchObject({ attack: 1, defense: 2 });
  });

  it('filters marked spell targets from cast legality and admits one as soon as it is marked', () => {
    const game = gameWithHand(['markedTarget'], [permanent(1, 'bear')]);
    expect(game.legalActions(0).some((action) => action.type === 'castSpell')).toBe(false);

    game.instanceState.battlefield[0].plusOneCounters = 1;
    expect(game.legalActions(0)).toContainEqual({
      type: 'castSpell',
      handIndex: 0,
      targets: [ref(1)],
    });
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    expect(game.state.battlefield.some((perm) => perm.iid === 1)).toBe(false);
  });

  it('rejects noncreatures from marked target qualifiers', () => {
    const game = gameWithHand(['markedPermanentTarget'], [
      permanent(1, 'artifactWatcher', 0, 1),
      permanent(2, 'bear', 0, 1),
    ]);
    const actions = game.legalActions(0).filter(
      (action): action is Extract<typeof action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    expect(actions).toEqual([{ type: 'castSpell', handIndex: 0, targets: [ref(2)] }]);
  });

  it('filters tapped spell targets and rejects the untapped permanent', () => {
    const game = gameWithHand(['tappedTarget'], [
      permanent(1, 'bear'),
      { ...permanent(2, 'bear'), tapped: true },
    ]);
    expect(game.legalActions(0).filter((action) => action.type === 'castSpell'))
      .toContainEqual({ type: 'castSpell', handIndex: 0, targets: [ref(2)] });
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] }))
      .toThrow('illegal target');
  });

  it('composes marked and other on an arrival choice and exposes only public target refs', () => {
    const game = gameWithHand(['arrivalMarkedOther'], [
      permanent(1, 'bear', 0, 1),
      permanent(2, 'bear'),
    ]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });

    const sourceIid = game.instanceState.battlefield.find((perm) => perm.cardId === 'arrivalMarkedOther')!.iid;
    const expectedAwaiting = {
      player: 0 as const,
      kind: 'chooseTarget' as const,
      sourceIid,
      abilityIndex: 1,
      targets: [ref(1)],
    };
    expect(game.awaiting).toEqual(expectedAwaiting);
    expect(game.viewFor(1).awaiting).toEqual(expectedAwaiting);
    expect(JSON.stringify(game.viewFor(1).awaiting)).not.toContain('spec');
    expect(JSON.stringify(game.viewFor(1).awaiting)).not.toContain('plusOneCounters');
  });

  it('renders marked and tapped target qualifiers in the existing Sever renderer', () => {
    expect(rulesText(DB.markedTarget)).toBe('Sever target Marked creature.');
    expect(rulesText(DB.tappedTarget)).toBe('Sever target tapped creature.');
  });

  it('rejects a spell tail grafted onto a different targeted-arrival source context', () => {
    const game = gameWithHand(['tailSpell']);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0 })).toThrow(
      /deferred target-trigger tail from tailSpell to tailToken/,
    );
  });
});

describe('Stage-4 vocabulary completion', () => {
  it('renders the completed vocabulary with exact totality strings', () => {
    expect(rulesText(DB.allyObserver)).toBe(
      'Whenever a creature arrives under your control, Mark it.',
    );
    expect(rulesText(DB.creatureMarkObserver)).toBe(
      'Whenever a creature you control gets a Mark, you gain 1 life.',
    );
    expect(rulesText(DB.biomancer)).toBe(
      'When this arrives, Mark another target creature you control.',
    );
    expect(rulesText(DB.theirMarkedDebuff)).toBe(
      'Marked creatures your opponent controls get -2/-2 until end of turn.',
    );
    expect(rulesText(DB.redlineSupernova)).toBe(
      'Deals 3 damage to each creature; a creature damaged this way that would die this turn is severed instead.',
    );
  });

  it('dispatches allyCreatureArrives once per arriving creature, including tokens, and not for opponents or itself', () => {
    const game = gameWithHand(['allyObserver', 'plainArrival', 'tokenSpell']);
    const observerEvents = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(observerEvents.some((event) => event.e === 'triggerFired' && event.when === 'allyCreatureArrives')).toBe(false);
    expect(game.state.battlefield.find((perm) => perm.cardId === 'allyObserver')?.plusOneCounters).toBe(0);

    const creatureEvents = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(creatureEvents.filter((event) => event.e === 'triggerFired' && event.when === 'allyCreatureArrives')).toHaveLength(1);
    const arrived = game.state.battlefield.find((perm) => perm.cardId === 'plainArrival');
    expect(arrived?.plusOneCounters).toBe(1);

    const tokenEvents = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(tokenEvents.filter((event) => event.e === 'triggerFired' && event.when === 'allyCreatureArrives')).toHaveLength(2);
    expect(game.state.battlefield.filter((perm) => perm.cardId === 'tok_fox').map((perm) => perm.plusOneCounters)).toEqual([1, 1]);

    const opponent = Game.restore(makeTestState({
      active: 1,
      hands: [[], ['plainArrival']],
      battlefield: [permanent(1, 'allyObserver')],
    }), DB);
    const opponentEvents = opponent.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(opponentEvents.some((event) => event.e === 'triggerFired' && event.when === 'allyCreatureArrives')).toBe(false);
    expect(opponent.state.battlefield.find((perm) => perm.cardId === 'plainArrival')?.plusOneCounters).toBe(0);
  });

  it('uses the arriving creature as an automatic target context and targets another friendly creature', () => {
    const game = gameWithHand(['biomancer'], [permanent(1, 'bear'), permanent(2, 'cLand')]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    const source = game.state.battlefield.find((perm) => perm.cardId === 'biomancer')!;
    expect(game.awaiting).toEqual({
      player: 0,
      kind: 'chooseTarget',
      sourceIid: source.iid,
      abilityIndex: 0,
      targets: [ref(1)],
    });
    expect(() => game.submit(0, { type: 'chooseTarget', target: ref(2) })).toThrow('illegal target');
    game.submit(0, { type: 'chooseTarget', target: ref(1) });
    expect(game.state.battlefield.find((perm) => perm.iid === 1)?.plusOneCounters).toBe(1);
    expect(source.plusOneCounters).toBe(0);
  });

  it('fires creature mark observers for creatures but not marked lands', () => {
    const land = gameWithHand(['markPermanent'], [
      permanent(1, 'creatureMarkObserver'),
      permanent(2, 'cLand'),
    ]);
    const landEvents = land.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(2)] });
    expect(land.state.players[0].life).toBe(20);
    expect(land.state.battlefield.find((perm) => perm.iid === 2)?.plusOneCounters).toBe(0);
    expect(landEvents.some((event) => event.e === 'triggerFired' && event.when === 'yourCreatureMarked')).toBe(false);

    const legacy = gameWithHand(['markPermanent'], [
      permanent(1, 'markedObserver'),
      permanent(2, 'cLand'),
    ]);
    const legacyEvents = legacy.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(2)] });
    expect(legacyEvents.some((event) => event.e === 'triggerFired' && event.when === 'yourPermanentMarked')).toBe(false);

    const creature = gameWithHand(['markPermanent'], [
      permanent(1, 'creatureMarkObserver'),
      permanent(2, 'bear'),
    ]);
    const creatureEvents = creature.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(2)] });
    expect(creature.state.players[0].life).toBe(21);
    expect(creatureEvents).toContainEqual({ e: 'triggerFired', iid: 1, when: 'yourCreatureMarked' });
  });

  it('applies theirMarked debuffs only to marked opposing creatures and expires them at cleanup', () => {
    const game = gameWithHand(['theirMarkedDebuff'], [
      permanent(1, 'bear', 1, 1),
      permanent(2, 'bear', 1),
      permanent(3, 'bear'),
    ], [[], ['bear']]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 1, defense: 1 });
    expect(getEffectiveStats(game.state.battlefield, DB, 2)).toMatchObject({ attack: 2, defense: 2 });
    expect(getEffectiveStats(game.state.battlefield, DB, 3)).toMatchObject({ attack: 2, defense: 2 });

    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [] });
    game.submit(0, { type: 'passStep' });
    expect(getEffectiveStats(game.state.battlefield, DB, 1)).toMatchObject({ attack: 3, defense: 3 });
  });

  it('severs three-toughness creatures directly, suppressing dies, graveyard, and Nine Lives', () => {
    const game = gameWithHand(['redlineSupernova'], [
      permanent(1, 'redlineThreeWatcher'),
      permanent(2, 'redlineThreeNineLives'),
      permanent(10, 'mountain'),
      permanent(11, 'mountain'),
      permanent(12, 'mountain'),
    ]);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });

    expect(game.state.battlefield.map((perm) => perm.cardId)).toEqual(['mountain', 'mountain', 'mountain']);
    expect(game.state.players[0].severed).toEqual(['redlineThreeWatcher', 'redlineThreeNineLives']);
    expect(game.state.players[0].graveyard).toEqual(['redlineSupernova']);
    expect(events.some((event) => event.e === 'died')).toBe(false);
    expect(events.some((event) => event.e === 'triggerFired' && event.when === 'dies')).toBe(false);
    expect(events.some((event) => event.e === 'graveyardTriggerFired')).toBe(false);
    expect(events.some((event) => event.e === 'nineLivesReturned')).toBe(false);
  });

  it('keeps a survivor branded so later same-turn damage severs it, and exposes the brand publicly', () => {
    const game = gameWithHand(['redlineSupernova', 'redlineFollowup'], [
      permanent(1, 'redlineFour'),
      permanent(10, 'mountain'),
      permanent(11, 'mountain'),
      permanent(12, 'mountain'),
    ], [['mountain'], ['mountain']]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });

    expect(game.state.battlefield.find((perm) => perm.iid === 1)).toMatchObject({
      damage: 3,
      severBranded: true,
    });
    getEffectiveStats(game.state.battlefield, DB, 1);
    expect(game.state.battlefield.find((perm) => perm.iid === 1)?.severBranded).toBe(true);
    expect(game.viewFor(0).battlefield.find((perm) => perm.iid === 1)?.severBranded).toBe(true);

    const events = game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    expect(game.state.players[0].severed).toEqual(['redlineFour']);
    expect(game.state.players[0].graveyard).toEqual(['redlineSupernova', 'redlineFollowup']);
    expect(events.some((event) => event.e === 'died')).toBe(false);
  });

  it('clears the brand at cleanup so the same creature dies normally on the next turn', () => {
    const game = gameWithHand(['redlineSupernova', 'redlineFollowup'], [
      permanent(1, 'redlineFour'),
      permanent(10, 'mountain'),
      permanent(11, 'mountain'),
      permanent(12, 'mountain'),
    ], [['mountain'], ['mountain']]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    passTurn(game, 0);
    passTurn(game, 1);

    expect(game.state.activePlayer).toBe(0);
    expect(game.state.battlefield.find((perm) => perm.iid === 1)).toMatchObject({
      damage: 0,
      severBranded: false,
    });
    const events = game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    expect(game.state.players[0].graveyard).toEqual(['redlineSupernova', 'redlineFollowup', 'redlineFour']);
    expect(game.state.players[0].severed).toEqual([]);
    expect(events.some((event) => event.e === 'died' && event.iid === 1)).toBe(true);
  });

  it('sends an unbranded creature to the graveyard when it dies alongside a branded one', () => {
    const game = gameWithHand(['redlineSupernova', 'redlineOne', 'redlineNormalSweep'], [
      permanent(1, 'redlineFour'),
      permanent(10, 'mountain'),
      permanent(11, 'mountain'),
      permanent(12, 'mountain'),
    ]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    game.submit(0, { type: 'castSpell', handIndex: 0 });

    expect(game.state.players[0].severed).toEqual(['redlineFour']);
    expect(game.state.players[0].graveyard).toEqual(['redlineSupernova', 'redlineNormalSweep', 'redlineOne']);
  });

  it('produces identical sever-brand state and events across identical runs', () => {
    const baseline = Game.restore(makeTestState({
      hands: [['redlineSupernova'], []],
      battlefield: [
        permanent(1, 'redlineFour'),
        permanent(10, 'mountain'),
        permanent(11, 'mountain'),
        permanent(12, 'mountain'),
      ],
    }), DB);
    const first = Game.restore(structuredClone(baseline.state), DB);
    const second = Game.restore(structuredClone(baseline.state), DB);

    const firstEvents = first.submit(0, { type: 'castSpell', handIndex: 0 });
    const secondEvents = second.submit(0, { type: 'castSpell', handIndex: 0 });

    expect(secondEvents).toEqual(firstEvents);
    expect(second.state).toEqual(first.state);
  });

  it('keeps allyCreatureArrives mark-capable while rejecting mark-event mark additions', () => {
    expect(validateMarkTriggerDef(card('legalArrivalMarker', ['artifact'], {
      abilities: [{
        when: 'allyCreatureArrives',
        ops: [{ op: 'addCounters', n: 1, to: 'target' }],
      }],
    }))).toEqual([]);
    expect(validateMarkTriggerDef(card('illegalCreatureMarker', ['creature'], {
      abilities: [{
        when: 'yourCreatureMarked',
        ops: [{ op: 'addCounters', n: 1, to: 'self' }],
      }],
    }))).toEqual(['yourCreatureMarked abilities cannot add marks']);
  });

  it('keeps the mark recursion depth guard intact through an allyCreatureArrives mark chain', () => {
    const game = gameWithHand(['allyObserver', 'recursiveMarker']);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0 }))
      .toThrow('Mark-trigger recursion exceeded depth 8.');

  });
});

describe('Starborne mark events and statics', () => {
  it('batches Propagate mark firings per permanent in battlefield order', () => {
    const game = gameWithHand(['propagateSpell'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'markedCarrier', 0, 1),
      permanent(3, 'markedCarrier', 0, 1),
      permanent(4, 'markedObserver'),
      permanent(5, 'addObserver'),
      permanent(6, 'otherObserver', 1),
      permanent(7, 'addObserver'),
      permanent(8, 'propagatedObserver'),
    ]);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    const triggerEvents = events.filter((event) => event.e === 'triggerFired');
    expect(triggerEvents.filter((event) => event.when === 'gainsMark')).toHaveLength(3);
    expect(triggerEvents.filter((event) => event.when === 'yourPermanentMarked')).toHaveLength(3);
    expect(triggerEvents.filter((event) => event.when === 'youAddMark')).toHaveLength(6);
    expect(triggerEvents.filter((event) => event.when === 'otherCreatureMarked')).toHaveLength(3);
    expect(triggerEvents.filter((event) => event.when === 'propagated')).toHaveLength(1);
    expect(triggerEvents.filter((event) => event.when === 'youAddMark').map((event) => event.iid))
      .toEqual([5, 7, 5, 7, 5, 7]);
    expect(game.state.battlefield.filter((p) => p.iid <= 3).map((p) => p.plusOneCounters)).toEqual([2, 2, 2]);
    expect(game.state.players[0].life).toBe(33);
    expect(game.state.players[1].life).toBe(23);
  });

  it('fires one mark event per addCounters mark and markAll creature', () => {
    const marked = gameWithHand(['markTwice'], [permanent(1, 'markedCarrier')]);
    const twice = marked.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    expect(twice.filter((event) => event.e === 'triggerFired' && event.when === 'gainsMark')).toHaveLength(2);
    expect(marked.state.battlefield[0].plusOneCounters).toBe(2);

    const all = gameWithHand(['markAllSpell'], [
      permanent(1, 'bear'),
      permanent(2, 'knight'),
      permanent(3, 'bear', 1),
    ]);
    all.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(all.state.battlefield.filter((p) => p.controller === 0).map((p) => p.plusOneCounters)).toEqual([1, 1]);
    expect(all.state.battlefield.find((p) => p.iid === 3)?.plusOneCounters).toBe(0);
  });

  it('rejects recursive mark-event definitions and throws at the runtime depth guard', () => {
    expect(validateMarkTriggerDef(DB.recursiveMarker)).toEqual(['gainsMark abilities cannot add marks']);
    expect(validateMarkTriggerDef(card('markEventZoneOps', ['creature'], {
      abilities: [{
        when: 'gainsMark',
        ops: [{ op: 'severSelf' }, { op: 'raise', to: 'top', withMarks: 2 }],
      }],
    }))).toEqual([]);
    const game = gameWithHand(['markTwice'], [permanent(1, 'recursiveMarker')]);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] }))
      .toThrow('Mark-trigger recursion exceeded depth 8.');
  });

  it('recomputes marked statics for both sides, including negative opponent stats and keywords', () => {
    const state = makeTestState({ battlefield: [
      permanent(1, 'markedBanner'),
      permanent(2, 'opponentGate'),
      permanent(3, 'bear', 0, 1),
      permanent(4, 'bear'),
      permanent(5, 'bear', 1, 1),
      permanent(6, 'bear', 1),
    ] });
    expect(getEffectiveStats(state.battlefield, DB, 3)).toMatchObject({ attack: 5, defense: 4 });
    expect(getEffectiveStats(state.battlefield, DB, 3).keywords.has('sentinel')).toBe(true);
    expect(getEffectiveStats(state.battlefield, DB, 4)).toMatchObject({ attack: 2, defense: 2 });
    expect(getEffectiveStats(state.battlefield, DB, 5)).toMatchObject({ attack: 2, defense: 3 });
    expect(getEffectiveStats(state.battlefield, DB, 6)).toMatchObject({ attack: 2, defense: 2 });
    state.battlefield.find((p) => p.iid === 3)!.plusOneCounters = 0;
    state.battlefield.find((p) => p.iid === 5)!.plusOneCounters = 0;
    expect(getEffectiveStats(state.battlefield, DB, 3)).toMatchObject({ attack: 2, defense: 2 });
    expect(getEffectiveStats(state.battlefield, DB, 5)).toMatchObject({ attack: 2, defense: 2 });

    const recompute = gameWithHand(['remove'], [
      permanent(1, 'markedBanner'),
      permanent(2, 'bear', 0, 1),
    ]);
    expect(getEffectiveStats(recompute.state.battlefield, DB, 2).keywords.has('sentinel')).toBe(true);
    cast(recompute, 0, [ref(2)]);
    expect(getEffectiveStats(recompute.state.battlefield, DB, 2)).toMatchObject({ attack: 2, defense: 2 });
    expect(getEffectiveStats(recompute.state.battlefield, DB, 2).keywords.has('sentinel')).toBe(false);
  });

  it('runs creature-scoped controlMarked and markedThreshold conditions', () => {
    const arrival = gameWithHand(['controlMarked'], [permanent(1, 'bear', 0, 1)]);
    arrival.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(arrival.state.players[0].life).toBe(22);

    const markedArtifact = gameWithHand(['controlMarked'], [permanent(1, 'artifactWatcher', 0, 1)]);
    markedArtifact.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(markedArtifact.state.players[0].life).toBe(20);

    expect(rulesText(DB.threshold)).toContain('If you control five or more creatures with Marks, ');
    expect(rulesText(DB.thresholdCreatures)).toContain('If you control four or more creatures with Marks, ');

    const permanentThreshold = makeTestState({ battlefield: [
      ...Array.from({ length: 4 }, (_, i) => permanent(i + 1, 'bear', 0, 1)),
      permanent(5, 'artifactWatcher', 0, 1),
      permanent(6, 'threshold'),
    ] });
    fireTriggers(permanentThreshold, DB, () => {}, 'dawn', permanentThreshold.battlefield[5]);
    expect(permanentThreshold.players[0].life).toBe(20);

    const creatureThreshold = makeTestState({ battlefield: [
      ...Array.from({ length: 4 }, (_, i) => permanent(i + 1, 'bear', 0, 1)),
      permanent(5, 'artifactWatcher', 0, 1),
      permanent(6, 'thresholdCreatures'),
    ] });
    fireTriggers(creatureThreshold, DB, () => {}, 'dawn', creatureThreshold.battlefield[5]);
    expect(creatureThreshold.players[0].life).toBe(24);

    const belowCreatureThreshold = makeTestState({ battlefield: [
      ...Array.from({ length: 3 }, (_, i) => permanent(i + 1, 'bear', 0, 1)),
      permanent(4, 'artifactWatcher', 0, 1),
      permanent(5, 'thresholdCreatures'),
    ] });
    fireTriggers(belowCreatureThreshold, DB, () => {}, 'dawn', belowCreatureThreshold.battlefield[4]);
    expect(belowCreatureThreshold.players[0].life).toBe(20);
  });

  it('dispatches markedAllyAttacks by battlefield holder order and declared attacker order', () => {
    const state = makeTestState({ battlefield: [
      permanent(1, 'queen', 0, 1),
      permanent(2, 'queen'),
      permanent(3, 'bear', 0, 1),
      permanent(4, 'bear', 0),
      permanent(5, 'bear', 1, 1),
    ] });
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'passStep' });
    const events = game.submit(0, { type: 'declareAttackers', attackers: [3, 1, 4] });
    const observerEvents = events.filter(
      (event): event is Extract<GameEvent, { e: 'triggerFired' }> =>
        event.e === 'triggerFired' && event.when === 'markedAllyAttacks',
    );
    expect(observerEvents.map((event) => event.iid)).toEqual([1, 2, 1, 2]);
    expect(game.state.players[0].life).toBe(24);

    const opponentState = makeTestState({
      active: 1,
      battlefield: [permanent(1, 'queen', 0), permanent(2, 'bear', 1, 1)],
    });
    const opponentGame = Game.restore(opponentState, DB);
    opponentGame.submit(1, { type: 'passStep' });
    const opponentEvents = opponentGame.submit(1, { type: 'declareAttackers', attackers: [2] });
    expect(opponentEvents.some((event) => event.e === 'triggerFired' && event.when === 'markedAllyAttacks')).toBe(false);
    expect(opponentGame.state.players[0].life).toBe(20);
  });
});

describe('Starborne mark operations and deferred ownership', () => {
  it('moves marks between distinct friendly targets, including first mark destination events', () => {
    const game = gameWithHand(['move'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'markedCarrier'),
    ]);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(1)] }))
      .toThrow('two distinct');
    const events = game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(2)] });
    expect(game.state.battlefield.find((p) => p.iid === 1)?.plusOneCounters).toBe(0);
    expect(game.state.battlefield.find((p) => p.iid === 2)?.plusOneCounters).toBe(1);
    expect(events.some((event) => event.e === 'triggerFired' && event.when === 'gainsMark')).toBe(true);
  });

  it('enumerates moveMark only with caster-controlled targets', () => {
    const game = gameWithHand(['moveAny'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'markedCarrier'),
      permanent(3, 'markedCarrier', 1, 1),
    ]);
    const actions = game.legalActions(0).filter(
      (action): action is Extract<typeof action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    expect(actions.length).toBe(2);
    expect(actions.every((action) => action.targets?.every((target) => target.kind === 'permanent' && target.iid !== 3)))
      .toBe(true);
  });

  it('enumerates every mixed cancel-and-move list as one spell plus two distinct permanents', () => {
    const game = gameWithHand(['quietOrbit'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'markedCarrier'),
    ]);
    game.instanceState.stack.push({ sid: 99, cardId: 'bear', controller: 1, targets: [] });
    const actions = game.legalActions(0).filter(
      (action): action is Extract<typeof action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    expect(actions).toHaveLength(2);
    expect(actions.every((action) => {
      const targets = action.targets ?? [];
      return targets.length === 3 &&
        targets[0].kind === 'stackItem' &&
        targets[1].kind === 'permanent' &&
        targets[2].kind === 'permanent' &&
        targets[1].iid !== targets[2].iid;
    })).toBe(true);
    expect(actions).toContainEqual({
      type: 'castSpell',
      handIndex: 0,
      targets: [
        { kind: 'stackItem', sid: 99 },
        ref(1),
        ref(2),
      ],
    });
  });

  it('preserves Nine Lives friction on a marked destination and re-enables return after removeMarks', () => {
    const friction = gameWithHand(['move', 'kill'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'nine'),
    ]);
    cast(friction, 0, [ref(1), ref(2)]);
    cast(friction, 0, [ref(2)]);
    expect(friction.state.battlefield.some((p) => p.iid === 2)).toBe(false);
    expect(friction.state.players[0].graveyard.map(cardIdOf)).toContain('nine');

    const restored = gameWithHand(['remove', 'kill'], [permanent(1, 'nine', 0, 1)]);
    cast(restored, 0, [ref(1)]);
    cast(restored, 0, [ref(1)]);
    const returned = restored.state.battlefield.find((p) => p.cardId === 'nine');
    expect(returned).toBeDefined();
    expect(returned?.plusOneCounters).toBe(1);
  });

  it('drains life per opposing marked creature and fetches the first top-down land without reordering other cards', () => {
    const drain = gameWithHand(['drainMarked'], [
      permanent(1, 'bear', 1, 1),
      permanent(2, 'knight', 1, 2),
      permanent(3, 'bear', 1),
    ]);
    drain.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(drain.state.players[1].life).toBe(18);

    const fetch = gameWithHand(['fetch'], [], [['bear', 'plains', 'elf'], []]);
    const events = fetch.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(fetch.state.players[0].deck.map(cardIdOf)).toEqual(['bear', 'elf']);
    const land = fetch.state.battlefield.find((p) => p.cardId === 'plains');
    expect(land?.tapped).toBe(true);
    expect(events.some((event) => event.e === 'drew')).toBe(false);

    const noLand = gameWithHand(['fetch'], [], [['bear', 'elf'], []]);
    noLand.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(noLand.state.players[0].deck.map(cardIdOf)).toEqual(['bear', 'elf']);
    expect(noLand.state.battlefield).toEqual([]);
  });

  it('uses the target owner for Foresee after the target is recalled', () => {
    const game = gameWithHand(['recallForesee'], [permanent(1, 'bear', 1)], [[], ['bear', 'forest']]);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1)] });
    expect(game.awaiting).toEqual({
      player: 1,
      kind: 'foresee',
      cards: ['forest'],
    });
    expect(game.state.players[1].hand.map(cardIdOf)).toContain('bear');
    expect(game.state.pendingDecisions[0]).toEqual({ kind: 'foresee', player: 1, n: 1 });
    game.submit(1, { type: 'foresee', bottomIndices: [] });
    expect(game.awaiting.kind).toBe('main');
  });

  it('takes both branches of ifTargetMarked', () => {
    const marked = gameWithHand(['conditional'], [permanent(1, 'bear', 0, 1)]);
    cast(marked, 0, [ref(1)]);
    expect(getEffectiveStats(marked.state.battlefield, DB, 1)).toMatchObject({ attack: 6, defense: 6 });

    const unmarked = gameWithHand(['conditional'], [permanent(1, 'bear')]);
    cast(unmarked, 0, [ref(1)]);
    expect(getEffectiveStats(unmarked.state.battlefield, DB, 1)).toMatchObject({ attack: 1, defense: 1 });
  });

  it('severs its source, then continues with the printed raise operation', () => {
    const state = makeTestState({ battlefield: [permanent(1, 'severRaise')] });
    state.players[0].graveyard = ['bear'];
    state.players[0].deck = ['bear'];
    const events: GameEvent[] = [];
    startTurn(state, DB, (event) => events.push(event));

    const severedAt = events.findIndex((event) => event.e === 'severed' && event.iid === 1);
    const raisedAt = events.findIndex((event) => event.e === 'permanentEntered' && event.perm.cardId === 'bear');
    expect(severedAt).toBeGreaterThanOrEqual(0);
    expect(raisedAt).toBeGreaterThan(severedAt);
    expect(state.battlefield.some((perm) => perm.iid === 1)).toBe(false);
    expect(state.players[0].severed.map(cardIdOf)).toContain('severRaise');
    expect(state.battlefield.find((perm) => perm.cardId === 'bear')?.plusOneCounters).toBe(2);
    expect(rulesText(DB.severRaise)).toContain(
      'During your Dawn, sever this, then return the top creature card of your graveyard to the battlefield with two Marks on it',
    );
  });

  it('raises with marks as state without firing mark observers and disables Nine Lives', () => {
    const marked = gameWithHand(['raiseMarked'], [permanent(1, 'markedObserver')]);
    marked.instanceState.players[0].graveyard.push('markedCarrier');
    const markedEvents = marked.submit(0, { type: 'castSpell', handIndex: 0 });
    const raised = marked.state.battlefield.find((perm) => perm.cardId === 'markedCarrier');
    expect(raised?.plusOneCounters).toBe(3);
    expect(markedEvents.some((event) => event.e === 'triggerFired' && event.when === 'gainsMark')).toBe(false);
    expect(markedEvents.some((event) => event.e === 'triggerFired' && event.when === 'yourPermanentMarked')).toBe(false);

    const nine = gameWithHand(['raiseMarked', 'kill']);
    nine.instanceState.players[0].graveyard.push('nine');
    nine.submit(0, { type: 'castSpell', handIndex: 0 });
    const raisedNine = nine.state.battlefield.find((perm) => perm.cardId === 'nine')!;
    expect(raisedNine.plusOneCounters).toBe(3);
    cast(nine, 0, [ref(raisedNine.iid)]);
    expect(nine.state.battlefield.some((perm) => perm.cardId === 'nine')).toBe(false);
    expect(nine.state.players[0].graveyard.map(cardIdOf)).toContain('nine');
  });
});

describe('Starborne colorless mana, chapters, artifact triggers, Empower, and replay', () => {
  it('uses C for generic before colored sources and never uses C for a colored pip', () => {
    const state = makeTestState({ battlefield: [permanent(1, 'cLand'), permanent(2, 'forest')] });
    const sources = manaSources(state, DB, 0);
    expect(sources[0].colors).toEqual(['C']);
    expect(solveMana(state, DB, 0, { generic: 1, pips: {} })).toEqual([1]);
    expect(solveMana(state, DB, 0, { generic: 0, pips: { G: 1 } })).toEqual([2]);
    expect(solveMana(state, DB, 0, { generic: 1, pips: { G: 1 } })).toEqual([2, 1]);
  });

  it('runs arrival and dawn abilities on artifacts, and persists Ritual chapters until the final graveyard exit', () => {
    const artifact = gameWithHand(['artifactWatcher'], [], [['bear', 'bear'], []]);
    artifact.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(artifact.state.players[0].life).toBe(21);
    const artifactEvents: GameEvent[] = [];
    const artifactState = artifact.instanceState as GameState;
    startTurn(artifactState, DB, (event) => artifactEvents.push(event));
    expect(artifactState.players[0].life).toBe(22);
    expect(artifactEvents.some((event) => event.e === 'triggerFired' && event.when === 'dawn')).toBe(true);

    const ritual = gameWithHand(['ritualQuest'], [], [['bear', 'bear'], []]);
    ritual.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(isType(DB.ritualQuest, 'enchantment')).toBe(true);
    const quest = ritual.state.battlefield.find((p) => p.cardId === 'ritualQuest');
    expect(quest?.chapter).toBe(1);
    expect(ritual.instanceState.players[0].life).toBe(21);
    const ritualState = ritual.instanceState as GameState;
    startTurn(ritualState, DB, () => {});
    expect(ritualState.battlefield.some((p) => p.cardId === 'ritualQuest')).toBe(false);
    expect(ritualState.players[0].graveyard.map(cardIdOf)).toContain('ritualQuest');
    expect(ritualState.players[0].life).toBe(23);

    const targetRitual = gameWithHand(['enchantmentTarget'], [permanent(1, 'ritualQuest')]);
    expect(targetRitual.legalActions(0)).toContainEqual({
      type: 'castSpell',
      handIndex: 0,
      targets: [ref(1)],
    });
    cast(targetRitual, 0, [ref(1)]);
    expect(targetRitual.state.battlefield.some((p) => p.iid === 1)).toBe(false);

    const sweep = gameWithHand(['enchantmentSweep'], [permanent(1, 'ritualQuest')]);
    cast(sweep);
    expect(sweep.state.battlefield.some((p) => p.iid === 1)).toBe(false);
  });

  it('allows Empower moveMark targets and rejects every other targeted Empower rider', () => {
    const valid = gameWithHand(['empowerMove'], [
      permanent(1, 'markedCarrier', 0, 1),
      permanent(2, 'markedCarrier'),
    ]);
    cast(valid, 0, [ref(1), ref(2)], true);
    expect(valid.state.battlefield.find((p) => p.iid === 1)?.plusOneCounters).toBe(0);
    expect(valid.state.battlefield.find((p) => p.iid === 2)?.plusOneCounters).toBe(1);

    const invalid = gameWithHand(['badEmpower'], [
      permanent(1, 'bear'),
      permanent(2, 'bear'),
    ]);
    expect(() => cast(invalid, 0, [ref(1), ref(2)], true)).toThrow('invalid Empower definition');
  });

  it('keeps v9 logs executable while reserving v10 for new recordings', () => {
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(DB),
      seed: 7,
      decks: [[], []],
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
    });
    const log = finishReplay(draft, 'win', 0, 1);
    expect(log.v).toBe(REPLAY_LOG_VERSION);
    const old = { ...log, v: REPLAY_LOG_VERSION - 1 } as ReplayLog;
    expect(canReplay(old, DB)).toBe(true);
  });
});
