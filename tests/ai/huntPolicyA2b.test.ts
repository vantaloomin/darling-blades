import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { applyDarlingPreyPolicy } from '../../src/ai/huntPolicy';
import { makePersonality } from '../../src/ai/personality';
import { chooseActivate } from '../../src/ai/activatedPolicy';
import { applyVocabularyTargetPolicy, chooseTargetAction, vocabularyCastTargetValue } from '../../src/ai/targeting';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import type { AbilityDef, CardDb, CardDef, GameState, Keyword, Permanent, TargetRef, TargetSpec } from '../../src/engine/types';
import { makeTestState } from '../helpers';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';
import { body as place, DB as behaviourDb, lands } from './documentedBehaviourFixture';

// Medium's and Easy's own Hunt and Provoked policy (plan-first-dawn-engine.md,
// Part 4, A2; A2.b), on fixture cards. The shared value layer (A1.2) would take
// a self-Hunt or a friendly Provoked source whenever it pays; Medium takes one
// only when it beats the plain choice (or not acting) by one card, and Easy
// never takes one it could avoid (B5).

const PREY: TargetSpec = { what: 'opponentCreature' };
const ANY_PREY: TargetSpec = { what: 'creature', other: true };
/** "Provoked: draw N cards." */
const drawOnProvoke = (n: number): AbilityDef => ({ when: 'provoked', ops: [{ op: 'draw', n }] });
const creature = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}, keywords: Keyword[] = []) =>
  card(id, { attack, defense, keywords, ...extra });

const DB: CardDb = dbOf(
  creature('stalker', 3, 3),
  creature('mouse', 1, 1),
  creature('post', 0, 4),
  creature('cub', 2, 2),
  creature('ogre', 4, 4),
  creature('vanilla44', 4, 4),
  // 2/5 Provoked bodies: each survives a 3-Attack hunter and deals it 2.
  creature('draws1', 2, 5, { abilities: [drawOnProvoke(1)] }),
  creature('draws2', 2, 5, { abilities: [drawOnProvoke(2)] }),
  creature('draws3', 2, 5, { abilities: [drawOnProvoke(3)] }),
  creature('draws4', 2, 5, { abilities: [drawOnProvoke(4)] }),
  /** "Provoked: you gain 2 life." */
  creature('gains2', 2, 5, { abilities: [{ when: 'provoked', ops: [{ op: 'gainLife', n: 2 }] }] }),
  /** "When this arrives, Hunt any other creature." */
  creature('korru', 3, 3, { abilities: [{ when: 'arrives', targets: [ANY_PREY], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] }] }),
  /** "When this arrives, Hunt." */
  creature('raptor', 3, 3, { abilities: [{ when: 'arrives', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] }] }),
  /** "Whenever this attacks, Hunt any other creature." */
  creature('raider', 3, 3, { abilities: [{ when: 'attacks', targets: [ANY_PREY], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] }] }),
  /** "{T}: Hunt any other creature." (a Duty) */
  creature('tracker', 3, 3, { activated: { cost: { tap: true }, targets: [ANY_PREY], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] } }),
  /** "Target creature you control Hunts any other creature." */
  spell('spear', [{ op: 'hunt', hunter: 'target', prey: 'any' }], [{ what: 'yourCreature' }, ANY_PREY]),
  /** An artifact: "{T}: This deals 1 damage to target creature." */
  card('zapper', { types: ['artifact'], attack: undefined, defense: undefined,
    activated: { cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] } }),
  /** An artifact: "{T}: This deals 1 damage to each creature you control." */
  card('firepit', { types: ['artifact'], attack: undefined, defense: undefined,
    activated: { cost: { tap: true }, ops: [{ op: 'damage', n: 1, to: 'eachYourCreature' }] } }),
);

const easy = (): EasyAI => new EasyAI(DB, 1, makePersonality({ easyNoise: 0, easyPassRate: 0 }));
const medium = (): MediumAI => new MediumAI(DB);

function gameOf(battlefield: Partial<Permanent>[], hand: string[] = [], setup?: (state: GameState) => void): Game {
  const state = board([hand, []], battlefield);
  setup?.(state);
  return Game.restore(state, DB);
}

/** The brain's choice, checked legal against the engine. */
function decide(game: Game, brain: AIPlayer): Action {
  const action = brain.chooseAction(game.viewFor(0), game.legalActions(0));
  expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
  return action;
}

/** What the shared value layer alone keeps for hand card 0 (A1.2's reading). */
function sharedCastTargets(game: Game): TargetRef[][] {
  return applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0))
    .filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell' && a.handIndex === 0)
    .map((a) => a.targets ?? []);
}

describe('Easy never hunts its own creature by choice (B5)', () => {
  it('an any-prey Hunt spell takes the opponent\'s creature, though the shared value prefers our own Provoked one', () => {
    // Our 3/3 and our 2/5 "Provoked: draw four"; their 0/4.
    const game = gameOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'draws4' }, { iid: 3, cardId: 'post', controller: 1 }], ['spear']);
    expect(sharedCastTargets(game)[0][1]).toEqual(ref(2));
    const action = decide(game, easy());
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect((action as Extract<Action, { type: 'castSpell' }>).targets![1]).toEqual(ref(3));
  });

  it('holds an any-prey Hunt spell whose only prey is its own creature', () => {
    const game = gameOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'draws4' }], ['spear']);
    expect(sharedCastTargets(game)).toHaveLength(1);
    expect(decide(game, easy())).toEqual({ type: 'passStep' });
  });

  it('casts an any-prey arrival hunter at the opponent\'s creature, and at its own only when that is the only prey', () => {
    const withTheirs = gameOf([{ iid: 2, cardId: 'draws4' }, { iid: 3, cardId: 'mouse', controller: 1 }], ['korru']);
    expect(sharedCastTargets(withTheirs)).toEqual([[ref(2)]]);
    expect(decide(withTheirs, easy())).toMatchObject({ type: 'castSpell', handIndex: 0, targets: [ref(3)] });
    // The creature is the point of the cast; its prey is forced, not chosen.
    const onlyOurs = gameOf([{ iid: 2, cardId: 'draws4' }], ['korru']);
    expect(decide(onlyOurs, easy())).toMatchObject({ type: 'castSpell', handIndex: 0, targets: [ref(2)] });
  });

  it('never uses an any-prey Hunt Duty on its own creature', () => {
    const game = gameOf([{ iid: 1, cardId: 'tracker' }, { iid: 2, cardId: 'draws4' }], [], (state) => { state.step = 'main2'; });
    const view = game.viewFor(0);
    expect(chooseActivate(view, DB, game.legalActions(0))).toMatchObject({ type: 'activate', iid: 1, targets: [ref(2)] });
    expect(decide(game, easy())).toEqual({ type: 'passStep' });
  });

  it('an attack Hunt\'s prey is the opponent\'s creature when there is one, and its own when that is the only legal one', () => {
    const attackWith = (battlefield: Partial<Permanent>[]): Game => {
      const game = gameOf([{ iid: 1, cardId: 'raider' }, ...battlefield]);
      game.submit(0, { type: 'passStep' });
      game.submit(0, { type: 'declareAttackers', attackers: [1] });
      expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, sourceIid: 1 });
      return game;
    };
    const mixed = attackWith([{ iid: 2, cardId: 'draws4' }, { iid: 3, cardId: 'post', controller: 1, tapped: true }]);
    expect(chooseTargetAction(mixed.viewFor(0), DB, mixed.legalActions(0))).toEqual({ type: 'chooseTarget', target: ref(2) });
    expect(decide(mixed, easy())).toEqual({ type: 'chooseTarget', target: ref(3) });
    // A trigger's target is mandatory: with no other prey it still answers (never concedes).
    const forced = attackWith([{ iid: 2, cardId: 'draws4' }]);
    expect(decide(forced, easy())).toEqual({ type: 'chooseTarget', target: ref(2) });
  });
});

describe('Easy skips friendly Provoked sources', () => {
  it("aims a damage Duty at the opponent's creature, not at its own Provoked one", () => {
    const game = gameOf([{ iid: 1, cardId: 'zapper' }, { iid: 2, cardId: 'draws4' }, { iid: 3, cardId: 'post', controller: 1 }], [],
      (state) => { state.step = 'main2'; });
    expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toMatchObject({ type: 'activate', iid: 1, targets: [ref(2)] });
    expect(decide(game, easy())).toMatchObject({ type: 'activate', iid: 1, targets: [ref(3)] });
  });

  it('does not use a Duty that damages its own creatures, even when their Provoked would pay for it', () => {
    const game = gameOf([{ iid: 1, cardId: 'firepit' }, { iid: 2, cardId: 'draws4' }], [], (state) => { state.step = 'main2'; });
    expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toMatchObject({ type: 'activate', iid: 1 });
    expect(decide(game, easy())).toEqual({ type: 'passStep' });
  });
});

describe('Medium self-hunts and aims friendly sources only past a one-card margin', () => {
  it('an arrival hunter takes its own Provoked creature only when that beats the plain prey by the margin', () => {
    // Against their 1/1, our 2/5 "draw three" is a little better for the
    // shared value, and our 2/5 "draw four" is better by more than a card.
    const cast = (ours: string): TargetRef[] => {
      const game = gameOf([{ iid: 2, cardId: ours }, { iid: 3, cardId: 'mouse', controller: 1 }], ['korru']);
      expect(sharedCastTargets(game)).toEqual([[ref(2)]]);
      const action = decide(game, medium());
      expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
      return (action as Extract<Action, { type: 'castSpell' }>).targets!;
    };
    expect(cast('draws3')).toEqual([ref(3)]);
    expect(cast('draws4')).toEqual([ref(2)]);
  });

  it('casts a self-Hunt spell only when the self-Hunt is worth a card on its own', () => {
    // No opposing creature: the only casts hunt our own 2/5. Each is worth
    // something to the shared value; only "draw four" clears the margin.
    const act = (ours: string): Action => {
      const game = gameOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: ours }], ['spear']);
      const view = game.viewFor(0);
      const kept = applyVocabularyTargetPolicy(view, DB, game.legalActions(0)).find((a) => a.type === 'castSpell')!;
      expect(vocabularyCastTargetValue(view, DB, kept)).toBeGreaterThan(0);
      return decide(game, medium());
    };
    expect(act('draws2')).toEqual({ type: 'passStep' });
    expect(act('draws4')).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });

  it('uses a Duty that damages its own creatures only when their Provoked pays a card over not using it', () => {
    const act = (ours: string): Action => {
      const game = gameOf([{ iid: 1, cardId: 'firepit' }, { iid: 2, cardId: ours }], [], (state) => { state.step = 'main2'; });
      expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toMatchObject({ type: 'activate', iid: 1 });
      return decide(game, medium());
    };
    expect(act('gains2')).toEqual({ type: 'passStep' });
    expect(act('draws2')).toMatchObject({ type: 'activate', iid: 1 });
  });

  it("aims a damage Duty at its own Provoked creature only when that beats the opponent's creature by the margin", () => {
    const aim = (ours: string): TargetRef[] | undefined => {
      const game = gameOf([{ iid: 1, cardId: 'zapper' }, { iid: 2, cardId: ours }, { iid: 3, cardId: 'post', controller: 1 }], [],
        (state) => { state.step = 'main2'; });
      expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toMatchObject({ targets: [ref(2)] });
      const action = decide(game, medium());
      expect(action).toMatchObject({ type: 'activate', iid: 1 });
      return (action as Extract<Action, { type: 'activate' }>).targets;
    };
    expect(aim('draws1')).toEqual([ref(3)]);
    expect(aim('draws4')).toEqual([ref(2)]);
  });

  it('an attack Hunt with a small edge for its own creature takes the opponent\'s instead', () => {
    const game = gameOf([{ iid: 1, cardId: 'raider' }, { iid: 2, cardId: 'draws3' }, { iid: 3, cardId: 'post', controller: 1, tapped: true }]);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(chooseTargetAction(game.viewFor(0), DB, game.legalActions(0))).toEqual({ type: 'chooseTarget', target: ref(2) });
    expect(decide(game, medium())).toEqual({ type: 'chooseTarget', target: ref(3) });
  });
});

describe('Medium ranks an arrival hunter by its Hunt (the A1.2 hand-off)', () => {
  // A 3/3 "When this arrives, Hunt." against a vanilla 4/4 at the same cost:
  // the vanilla has the better printed value.
  it('casts the hunter over a slightly better vanilla when it has prey to kill and survive, and not when every prey kills it', () => {
    const cast = (theirs: string): Action =>
      decide(gameOf([{ iid: 3, cardId: theirs, controller: 1 }], ['vanilla44', 'raptor']), medium());
    expect(cast('cub')).toMatchObject({ type: 'castSpell', handIndex: 1, targets: [ref(3)] });
    expect(cast('ogre')).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });
});

describe('a Darling with an arrival Hunt is cast at its best prey', () => {
  // Their 4/4 comes first on the battlefield, their 2/2 second.
  const darlingGame = (): Game => gameOf([{ iid: 3, cardId: 'ogre', controller: 1 }, { iid: 4, cardId: 'cub', controller: 1 }], [], (state) => {
    state.players[0].darlingZone = 'raptor';
    state.players[0].darlingTax = 0;
  });

  it('the menu Easy and Medium read keeps only the cast at the prey it kills and survives', () => {
    const game = darlingGame();
    expect(game.legalActions(0).filter((a) => a.type === 'castDarling')[0]).toMatchObject({ targets: [ref(3)] });
    const kept = applyDarlingPreyPolicy(game.viewFor(0), DB, game.legalActions(0)).filter((a) => a.type === 'castDarling');
    expect(kept).toEqual([{ type: 'castDarling', targets: [ref(4)] }]);
  });

  it('Medium casts it there', () => {
    expect(decide(darlingGame(), medium())).toEqual({ type: 'castDarling', targets: [ref(4)] });
  });
});

describe("Medium's counter forecast reads the Hunt pair rule (Part 4, A2)", () => {
  // A Charm that counters a spell and has a creature of ours hunt: castable
  // only with a hunter without Bulwark and a different creature for its prey.
  const COUNTER_DB: CardDb = {
    ...behaviourDb,
    hunt_counter: {
      id: 'hunt_counter', name: 'hunt_counter', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
      cost: { generic: 1, pips: {} }, abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }, PREY, { what: 'spell' }], ops: [
        { op: 'hunt', hunter: 'target' }, { op: 'cancel', to: 'target', targetIndex: 2 },
      ] }],
    },
  };
  // The documented-behaviour fixture: two lands, a {2} Duty, and an opponent
  // with four mana and a card in hand, so a live counter holds one mana back.
  function holding(ours: string): Action {
    const state = makeTestState({ hands: [['hunt_counter'], ['bear']], active: 0,
      battlefield: [...lands(2), ...lands(4, 1), place(10, 'mana_duty'), place(11, ours), place(20, 'worth_two', 1)] });
    state.rng = createRngState(41);
    state.rulesRev = 4;
    state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
    state.step = 'main2';
    state.nextIid = 1000;
    for (const player of state.players) {
      player.deck = Array<string>(20).fill('bear');
      player.landDropsUsed = 1;
    }
    const game = Game.restore(state, COUNTER_DB);
    const action = new MediumAI(COUNTER_DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(validateAction(game.instanceState, COUNTER_DB, 0, action)).toBeNull();
    return action;
  }

  it('holds the counter\'s mana with a hunter of ours, and spends it when our only creature has Bulwark', () => {
    expect(holding('worth_two')).toEqual({ type: 'passStep' });
    expect(holding('draft_bulwark')).toMatchObject({ type: 'activate', iid: 10 });
  });
});
