import { describe, expect, it } from 'vitest';
import { scoredActivationCandidates } from '../../src/ai/activatedPolicy';
import { chooseAttackers, chooseBlocks } from '../../src/ai/combatPlans';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { applyVocabularyTargetPolicy } from '../../src/ai/targeting';
import { activateActionValue, targetValueForAbility } from '../../src/ai/value';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { AbilityDef, CardDb, CardDef, GameState, Keyword, Permanent, TargetRef, TargetSpec } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

// Hard's reads for Hunt and Provoked (plan-first-dawn-engine.md, Part 4,
// items 1-4, A1.2), on fixture cards: the shared value layer and combat
// planner every brain reads. Rules as ruled 2026-09-28: the hunter and its
// prey each deal their Attack to the other; the generic prey is an opponent's
// creature; an arrival Hunt chooses its prey at cast; Provoked fires once
// each turn when its creature survives damage.

const PREY: TargetSpec = { what: 'opponentCreature' };
const ANY_PREY: TargetSpec = { what: 'creature', other: true };
const cost = (generic: number) => ({ generic, pips: {} });
/** "Provoked: draw two cards." */
const DRAW_TWO: AbilityDef = { when: 'provoked', ops: [{ op: 'draw', n: 2 }] };
/** "Whenever this attacks, Hunt." */
const ATTACK_HUNT: AbilityDef = { when: 'attacks', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] };
const body = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}, keywords: Keyword[] = []) =>
  card(id, { attack, defense, keywords, ...extra });

const DB: CardDb = dbOf(
  body('stalker', 3, 3, { cost: cost(2), abilities: [ATTACK_HUNT] }),
  body('fang', 1, 1, { abilities: [ATTACK_HUNT] }, ['deathblade']),
  body('pup', 1, 1, { abilities: [ATTACK_HUNT] }),
  body('cub', 2, 2),
  body('glass', 3, 1),
  body('rival', 3, 3, { cost: cost(4) }),
  body('ogre', 4, 4, { cost: cost(4) }),
  body('post', 0, 4),
  body('wall', 1, 5, { abilities: [DRAW_TWO] }),
  body('slab', 1, 5),
  body('bruiser', 2, 5, { abilities: [DRAW_TWO] }),
  body('plain', 2, 5),
  body('mouse', 1, 1),
  body('asp', 1, 1, {}, ['deathblade']),
  body('x22', 2, 2),
  body('y33', 3, 3),
  body('turtle', 0, 5),
  body('prober', 1, 3, { abilities: [DRAW_TWO] }),
  /** "When this arrives, deal 1 damage to another target creature you control." */
  body('tender', 1, 1, { abilities: [{ when: 'arrives', targets: [{ what: 'yourCreature', other: true }], ops: [{ op: 'damage', n: 1, to: 'target' }] }] }),
  /** An artifact: "{T}: This deals 1 damage to each creature you control." */
  card('firepit', { types: ['artifact'], attack: undefined, defense: undefined, activated: { cost: { tap: true }, ops: [{ op: 'damage', n: 1, to: 'eachYourCreature' }] } }),
  /** "When this arrives, Hunt." (the prey is chosen at cast) */
  body('raptor', 3, 3, { abilities: [{ when: 'arrives', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] }] }),
  /** "Target creature you control Hunts." */
  spell('stalk', [{ op: 'hunt', hunter: 'target' }], [{ what: 'yourCreature' }, PREY]),
  /** "Target creature you control gets +2/+2 until end of turn, then it Hunts." */
  spell('fangAndHorn', [{ op: 'boost', p: 2, t: 2, scope: 'target' }, { op: 'hunt', hunter: 'target' }], [{ what: 'yourCreature' }, PREY]),
  /** "{T}: Hunt." (a Duty) */
  body('tracker', 3, 3, { activated: { cost: { tap: true }, targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] } }),
  /** "When this arrives, Hunt any other creature." */
  body('korru', 3, 3, { abilities: [{ when: 'arrives', targets: [ANY_PREY], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] }] }),
);

function gameOf(battlefield: Partial<Permanent>[], hand: string[] = [], setup?: (perms: Permanent[], state: GameState) => void): Game {
  const state = board([hand, []], battlefield);
  setup?.(state.battlefield, state);
  return Game.restore(state, DB);
}
const viewOf = (battlefield: Partial<Permanent>[], setup?: (perms: Permanent[]) => void): PlayerView =>
  gameOf(battlefield, [], setup).viewFor(0);

/** The value of our battlefield hunter (iid 1) hunting the permanent `prey`. */
function huntValue(view: PlayerView, prey: number): number {
  const hunter = view.battlefield.find((perm) => perm.iid === 1)!;
  return targetValueForAbility(view, DB, hunter, DB[hunter.cardId].abilities![0], ref(prey));
}

/** The one cast of hand card 0 the shared cast-target policy keeps. */
function keptCastTargets(game: Game): TargetRef[][] {
  const kept = applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0));
  return kept.filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell' && a.handIndex === 0)
    .map((a) => a.targets ?? []);
}

describe('Hunt target value (Part 4, item 1)', () => {
  // Our 3/3 hunter (cost 2) against four prey, each alone on their side.
  const valueAgainst = (preyCard: string): number =>
    huntValue(viewOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: preyCard, controller: 1 }]), 2);

  it('ranks kill-and-survive above a kill that costs the hunter, a trade up above a Hunt that does nothing, and that above one that only provokes the prey', () => {
    const killAndSurvive = valueAgainst('cub'); // 3 kills a 2/2, which deals 2 to a 3/3
    const killAndDie = valueAgainst('glass'); // 3 kills a 3/1 worth as much, which deals 3 back
    const tradeUp = valueAgainst('rival'); // both 3/3s die; the prey cost 4, the hunter 2
    const nothing = valueAgainst('post'); // a 0/4 takes 3 and deals nothing
    const provokeOnly = valueAgainst('wall'); // a 1/5 Provoked "draw two" survives
    expect(killAndSurvive).toBeGreaterThan(killAndDie);
    expect(tradeUp).toBeGreaterThan(nothing);
    expect(nothing).toBe(0); // no creature dies and nothing is provoked: the same as casting nothing
    expect(provokeOnly).toBeLessThan(nothing);
  });

  it('reads Deathblade on the hunter: a 1/1 Deathblade hunter trades up into a 4/4, a plain 1/1 only dies', () => {
    const into = (hunter: string): number =>
      huntValue(viewOf([{ iid: 1, cardId: hunter }, { iid: 2, cardId: 'ogre', controller: 1 }]), 2);
    expect(into('fang')).toBeGreaterThan(0);
    expect(into('pup')).toBeLessThan(0);
  });

  it('reads Deathblade on the prey: a 1/1 Deathblade prey kills the hunter, a plain 1/1 does not', () => {
    const view = viewOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'asp', controller: 1 }, { iid: 3, cardId: 'mouse', controller: 1 }]);
    expect(huntValue(view, 3)).toBeGreaterThan(0);
    expect(huntValue(view, 2)).toBeLessThan(0);
  });

  it('reads damage already marked: a 4/4 with 1 damage on it dies to a 3-Attack hunter', () => {
    const fresh = huntValue(viewOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'ogre', controller: 1 }]), 2);
    const hurt = huntValue(viewOf([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'ogre', controller: 1, damage: 1 }]), 2);
    expect(fresh).toBeLessThan(0); // the 4/4 survives and kills the hunter
    expect(hurt).toBeGreaterThan(0); // now they trade, and the prey is worth more
  });
});

describe('an arrival Hunt chooses its best prey at cast (A1.1b hand-off)', () => {
  // The opponent's 4/4 comes first on the battlefield; the 2/2 second.
  const raptorGame = (): Game => gameOf([{ iid: 2, cardId: 'ogre', controller: 1 }, { iid: 3, cardId: 'cub', controller: 1 }], ['raptor']);

  it('the shared cast-target policy keeps the prey it kills and survives, not the first in battlefield order', () => {
    expect(keptCastTargets(raptorGame())).toEqual([[ref(3)]]);
  });

  it.each([
    ['Easy', () => new EasyAI(DB, 1, makePersonality({ easyNoise: 0 }))],
    ['Medium', () => new MediumAI(DB)],
    ['Hard', () => new HardAI(DB)],
  ] as const)('%s casts the hunter at that prey', (_, brain) => {
    const game = raptorGame();
    const action = brain().chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0, targets: [ref(3)] });
  });
});

describe('the Hunt spell and the hunting Duty (Part 4, items 1 and 4)', () => {
  it('a Hunt spell keeps its best hunter and prey pair, not the first', () => {
    // Our 2/2 is the first hunter offered; our 3/3 hunting their 2/2 kills and survives.
    const game = gameOf([{ iid: 1, cardId: 'cub' }, { iid: 2, cardId: 'y33' }, { iid: 3, cardId: 'x22', controller: 1 }], ['stalk']);
    expect(keptCastTargets(game)).toEqual([[ref(2), ref(3)]]);
  });

  it('a pump earlier in the same spell counts: +2/+2 lets a 2/2 kill a 3/3 and live', () => {
    // Offered first: our 2/2 hunts their 1/1. Pumped to 4/4 it can take the 3/3 instead.
    const game = gameOf([{ iid: 1, cardId: 'cub' }, { iid: 2, cardId: 'mouse', controller: 1 }, { iid: 3, cardId: 'y33', controller: 1 }], ['fangAndHorn']);
    expect(keptCastTargets(game)).toEqual([[ref(1), ref(3)]]);
  });

  it('a hunting Duty is used on prey it kills and survives, and not on prey that kills it', () => {
    const offered = (prey: string): boolean => {
      const game = gameOf([{ iid: 1, cardId: 'tracker' }, { iid: 2, cardId: prey, controller: 1 }], [],
        (_, state) => { state.step = 'main2'; });
      return scoredActivationCandidates(game.viewFor(0), DB, game.legalActions(0)).some((row) => row.action.iid === 1);
    };
    expect(offered('cub')).toBe(true);
    expect(offered('ogre')).toBe(false);
  });
});

describe("an 'any' Hunt takes your own creature only when it pays", () => {
  // Our Provoked 2/5 ("draw two") takes 3 and survives, and deals the hunter
  // only 2; the opponent's 1/1 would die to it.
  const korruGame = (spent: boolean): Game => gameOf(
    [{ iid: 2, cardId: 'bruiser' }, { iid: 3, cardId: 'mouse', controller: 1 }], ['korru'],
    (perms) => { if (spent) perms[0].firedThisTurn = [0]; },
  );

  it('hunts its own creature when that sets off an unspent Provoked worth more than the kill', () => {
    expect(keptCastTargets(korruGame(false))).toEqual([[ref(2)]]);
  });

  it('hunts the opponent\'s creature when its own creature\'s Provoked is spent this turn', () => {
    expect(keptCastTargets(korruGame(true))).toEqual([[ref(3)]]);
  });
});

describe('friendly sources earn an unspent Provoked (Part 4, item 2)', () => {
  const tender = DB.tender.abilities![0];

  it('a creature that damages your own creature scores a Provoked survivor as a gain, a plain one or a spent one as a cost', () => {
    const view = viewOf([{ iid: 1, cardId: 'tender' }, { iid: 2, cardId: 'bruiser' }, { iid: 3, cardId: 'plain' }]);
    const source = view.battlefield[0];
    expect(targetValueForAbility(view, DB, source, tender, ref(2))).toBeGreaterThan(0);
    expect(targetValueForAbility(view, DB, source, tender, ref(3))).toBeLessThan(0);
    const spent = viewOf([{ iid: 1, cardId: 'tender' }, { iid: 2, cardId: 'bruiser' }], (perms) => { perms[1].firedThisTurn = [0]; });
    expect(targetValueForAbility(spent, DB, spent.battlefield[0], tender, ref(2))).toBeLessThan(0);
  });

  it('damage to each creature you control sums the Provoked survivors, and the Duty is used only when they pay', () => {
    const dutyValue = (mine: string[]): number => activateActionValue(
      viewOf([{ iid: 1, cardId: 'firepit' }, ...mine.map((cardId, i) => ({ iid: 2 + i, cardId }))]), DB,
      { type: 'activate', iid: 1, abilityIndex: 0 });
    expect(dutyValue(['bruiser', 'bruiser'])).toBeGreaterThan(dutyValue(['bruiser']));
    expect(dutyValue(['bruiser'])).toBeGreaterThan(0);
    expect(dutyValue(['plain'])).toBeLessThan(0);
    const offered = (mine: string): boolean => {
      const game = gameOf([{ iid: 1, cardId: 'firepit' }, { iid: 2, cardId: mine }]);
      return scoredActivationCandidates(game.viewFor(0), DB, game.legalActions(0)).some((row) => row.action.iid === 1);
    };
    expect(offered('bruiser')).toBe(true);
    expect(offered('plain')).toBe(false);
  });
});

describe('Provoked in the combat planner (Part 4, item 3)', () => {
  it('does not feed an opposing Provoked wall a blow it survives', () => {
    // Our 2/2 and 3/3 against one untapped 1/5: it blocks the 3/3 and the
    // 2/2 gets through. A plain 1/5 is worth attacking into; the same 1/5
    // that draws two when it survives a blow is not.
    const attack = (wall: string): number[] => {
      const view = viewOf([{ iid: 1, cardId: 'x22' }, { iid: 2, cardId: 'y33' }, { iid: 3, cardId: wall, controller: 1 }]);
      return chooseAttackers(view.battlefield, DB, 0, 20, 0);
    };
    expect(attack('slab')).toEqual([1, 2]);
    expect(attack('wall')).toEqual([]);
  });

  it('blocks with the creature its Provoked rewards when the blocks are otherwise even', () => {
    // Their 2/2 attacks. Our 0/5 (first in battlefield order) and our 1/3
    // Provoked "draw two" both survive the block and neither kills it.
    const game = gameOf([
      { iid: 1, cardId: 'turtle' }, { iid: 2, cardId: 'prober' }, { iid: 3, cardId: 'x22', controller: 1 },
    ]);
    const view = game.viewFor(0);
    const combat = { attackers: [3], blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
    expect(chooseBlocks(view.battlefield, DB, 0, 20, combat, 0)).toEqual([{ blocker: 2, attacker: 3 }]);
  });
});
