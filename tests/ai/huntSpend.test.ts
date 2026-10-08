import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { MediumAI } from '../../src/ai/MediumAI';
import { applyVocabularyTargetPolicy } from '../../src/ai/targeting';
import { CARD_DB } from '../../src/data/catalog';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { board, card, dbOf, ref, zero } from '../drownedDeepFixture';

// Wave 4's Medium fixes on First Dawn's shapes, on the shipped card texts at
// no mana cost (the decisions under test are not about mana):
//   - a spell whose first effect damages its own creature is cast (M1), and
//     its Hunt is read on the board that damage leaves;
//   - a Hunt spent from hand (a spell, an Empower Hunt) kills, nets a card and
//     does not lose the hunter without the kill (M3);
//   - a Hunt Charm is instant-speed removal in the opponent's turn (M2);
//   - a pump that first damages its creature counts that damage;
//   - Trial by Ember waits for a creature of its caster's.

const free = (id: string, extra: Partial<CardDef> = {}): CardDef => ({ ...CARD_DB[id], cost: zero, ...extra });
/** A vanilla body; its mana value sets what killing or losing it is worth. */
const creature = (id: string, attack: number, defense: number, mana: number) =>
  card(id, { attack, defense, cost: { generic: mana, pips: {} } });
const ridge = CARD_DB['fd-ridge-raptor'];

const DB: CardDb = dbOf(
  free('fd-blaze-horn-charge'),
  free('fd-spear-and-fang'),
  free('fd-duel-on-the-ridge'),
  free('fd-test-of-the-hearth'),
  free('fd-ember-tongue'),
  free('fd-trial-by-ember'),
  free('fdr-ambush-at-the-river'),
  free('fd-ridge-raptor', { empower: { ...ridge.empower!, cost: zero } }),
  creature('tough', 3, 4, 3),
  creature('cub', 2, 2, 2),
  creature('ogre', 4, 4, 4),
  creature('hoarder', 1, 3, 2),
  creature('deadeye', 3, 2, 3),
  creature('post', 0, 4, 2),
  creature('wall', 1, 5, 3),
  creature('stalker', 3, 3, 3),
  creature('sprout', 0, 3, 2),
  creature('raptor', 3, 1, 3),
  creature('bruiser', 4, 3, 4),
  creature('colossus', 7, 7, 0),
  creature('plain_body', 4, 4, 0),
  card('scholar', { attack: 2, defense: 5, cost: { generic: 2, pips: {} },
    abilities: [{ when: 'provoked', ops: [{ op: 'draw', n: 2 }] }] }),
  creature('plain_scholar', 2, 5, 2),
);

function gameOf(battlefield: Partial<Permanent>[], hand: string[], setup?: (state: GameState) => void): Game {
  const state = board([hand, []], battlefield);
  setup?.(state);
  return Game.restore(state, DB);
}

/** The brain's choice, checked legal against the engine. */
function decide(game: Game, brain: AIPlayer): Action {
  const awaiting = game.awaiting;
  if (awaiting.kind === 'gameOver') throw new Error('game over');
  const action = brain.chooseAction(game.viewFor(awaiting.player), game.legalActions(awaiting.player));
  expect(validateAction(game.instanceState, DB, awaiting.player, action)).toBeNull();
  return action;
}

const medium = (): MediumAI => new MediumAI(DB);
const theirs = (iid: number, cardId: string): Partial<Permanent> => ({ iid, cardId, controller: 1 });
/** The opponent's end step, our response window. */
const theirEndStep = (state: GameState): void => {
  state.step = 'end';
  state.activePlayer = 1;
  state.awaiting = { kind: 'endStepWindow', player: 0 };
};

describe('Medium casts a spell whose first effect damages its own creature (M1)', () => {
  it('casts Blaze-Horn Charge at the pair its hunter survives once its own damage is counted', () => {
    // Our 3/4 survives the Charge's 1 and the 1/3's blow, and kills it. Into
    // their 3/2 the same 3/4 would die (1 + 3), so that pair is only a trade.
    const game = gameOf([{ iid: 1, cardId: 'tough' }, theirs(3, 'hoarder'), theirs(4, 'deadeye')], ['fd-blaze-horn-charge']);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(3)] });
  });

  it('holds Blaze-Horn Charge when its own damage turns a kill into a losing trade', () => {
    // Our 3/4 would kill their 3/3 and survive its 3, but not the Charge's 1 on top.
    const game = gameOf([{ iid: 1, cardId: 'tough' }, theirs(5, 'stalker')], ['fd-blaze-horn-charge']);
    expect(decide(game, medium())).toEqual({ type: 'passStep' });
  });

  it('a hunter its own damage dooms still fights with its full Attack, so the Charge trades it up', () => {
    // Our 3/1 dies to the Charge's 1, but the engine checks state after the
    // spell: it still deals 3. Into their 4/3 that is a trade up; into their
    // 1/5 it is the 3/1 lost for 3 damage. Every brain's cast menu keeps the
    // trade, and Medium casts it.
    const game = gameOf([{ iid: 1, cardId: 'raptor' }, theirs(5, 'wall'), theirs(6, 'bruiser')], ['fd-blaze-horn-charge']);
    const kept = applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0))
      .filter((action): action is Extract<Action, { type: 'castSpell' }> => action.type === 'castSpell');
    expect(kept.map((action) => action.targets)).toEqual([[ref(1), ref(6)]]);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(6)] });
  });

  it("casts Test of the Hearth at the opponent's end step, its damage on a creature that survives it", () => {
    // Our 2/2 and 3/4: the 1 damage goes where it does not kill, the Mark on the other.
    const game = gameOf([{ iid: 1, cardId: 'tough' }, { iid: 2, cardId: 'cub', damage: 1 }], ['fd-test-of-the-hearth'],
      theirEndStep);
    const action = decide(game, medium());
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect((action as Extract<Action, { type: 'castSpell' }>).targets![0]).toEqual(ref(1));
  });

  it('casts Test of the Hearth on a lone damaged creature that its own Mark keeps alive', () => {
    // Our 2/2 holds 1 damage. The Charm deals 1 more, then Marks it: a 3/3
    // with 2 damage when the state is checked, so it lives.
    const game = gameOf([{ iid: 2, cardId: 'cub', damage: 1 }], ['fd-test-of-the-hearth'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(2), ref(2)] });
  });

  it('ranks Test of the Hearth by the Provoked its own damage sets off', () => {
    // "Provoked: draw two" on our 2/5 lifts the Charm over a free 4/4 body;
    // on a plain 2/5 the body comes first.
    const provoked = gameOf([{ iid: 1, cardId: 'scholar' }], ['fd-test-of-the-hearth', 'plain_body']);
    expect(decide(provoked, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(1)] });
    const plain = gameOf([{ iid: 1, cardId: 'plain_scholar' }], ['fd-test-of-the-hearth', 'plain_body']);
    expect(decide(plain, medium())).toEqual({ type: 'castSpell', handIndex: 1 });
  });

  it('casts Test of the Hearth in its own main phase as a Mark spell, the damage where it does not kill', () => {
    const game = gameOf([{ iid: 1, cardId: 'tough' }, { iid: 2, cardId: 'cub', damage: 1 }], ['fd-test-of-the-hearth']);
    const action = decide(game, medium());
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect((action as Extract<Action, { type: 'castSpell' }>).targets![0]).toEqual(ref(1));
  });
});

describe('Medium spends a Hunt only when it kills and keeps the hunter or trades up (M3)', () => {
  it('holds Spear and Fang when every pair loses the hunter without the kill, and casts it at a kill', () => {
    const losing = gameOf([{ iid: 2, cardId: 'cub' }, theirs(5, 'ogre')], ['fd-spear-and-fang']);
    expect(decide(losing, medium())).toEqual({ type: 'passStep' });
    const killing = gameOf([{ iid: 1, cardId: 'ogre' }, theirs(5, 'cub')], ['fd-spear-and-fang']);
    expect(decide(killing, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(5)] });
  });

  it('holds a Hunt that only damages its prey', () => {
    // Our 3/4 deals 3 to their 0/4, which lives and deals nothing back.
    const game = gameOf([{ iid: 1, cardId: 'tough' }, theirs(5, 'post')], ['fd-spear-and-fang']);
    expect(decide(game, medium())).toEqual({ type: 'passStep' });
  });

  it("counts Ambush at the River's survival draw once when it ranks the cast", () => {
    // Our 4/4, pumped to 5/5, kills their 3/3 and lives to draw. That cast is
    // worth less than a free 7/7 body; counting the draw twice outranked it.
    const game = gameOf([{ iid: 1, cardId: 'ogre' }, theirs(5, 'stalker')], ['fdr-ambush-at-the-river', 'colossus']);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 1 });
  });

  it("pays Ridge-Raptor's Empower Hunt only when the Raptor's Hunt kills", () => {
    // A 3/1 into their 1/5 dies without the kill: the Raptor is cast plain.
    const wall = gameOf([theirs(5, 'wall')], ['fd-ridge-raptor']);
    expect(decide(wall, medium())).toEqual({ type: 'castSpell', handIndex: 0 });
    // Into their 0/3 it kills and survives: the Empower is paid.
    const sprout = gameOf([theirs(5, 'sprout')], ['fd-ridge-raptor']);
    expect(decide(sprout, medium())).toMatchObject({ type: 'castSpell', handIndex: 0, empowered: true, targets: [ref(5)] });
  });
});

describe('Medium casts a Hunt Charm as instant-speed removal (M2)', () => {
  it("holds Duel on the Ridge in its own main phase and casts it at the opponent's end step on a kill", () => {
    const creatures = [{ iid: 1, cardId: 'ogre' }, theirs(5, 'stalker')];
    expect(decide(gameOf(creatures, ['fd-duel-on-the-ridge']), medium())).toEqual({ type: 'passStep' });
    const endStep = gameOf(creatures, ['fd-duel-on-the-ridge'], theirEndStep);
    expect(decide(endStep, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(5)] });
  });

  it("passes the opponent's end step when the Hunt would lose its hunter without the kill", () => {
    const game = gameOf([{ iid: 2, cardId: 'cub' }, theirs(5, 'wall')], ['fd-duel-on-the-ridge'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'passResponse' });
  });

  it("holds Duel on the Ridge at the opponent's end step when the kill alone, without the spent pump, is under the removal bar", () => {
    // Their 2/2 is worth less than the bar a destroy Charm must clear there.
    const game = gameOf([{ iid: 1, cardId: 'ogre' }, theirs(5, 'cub')], ['fd-duel-on-the-ridge'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'passResponse' });
  });

  it('does not hunt with a blocker its own fight would then finish off', () => {
    // Our 4/4 blocks their attacking 2/2 and would live. Hunting their
    // attacking 4/3 with the pump (6/5) costs 4 damage, and the 2/2's 2 kills it.
    const game = gameOf([{ iid: 1, cardId: 'ogre' }, theirs(5, 'cub'), theirs(6, 'bruiser')], ['fd-duel-on-the-ridge'], (state) => {
      state.activePlayer = 1;
      state.step = 'combat';
      state.combat = { attackers: [5, 6], blocks: [{ attacker: 5, blocker: 1 }], phase: 'blockersDeclared', damagePrevented: false };
      state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
    });
    expect(decide(game, medium())).toEqual({ type: 'passResponse' });
  });

  it("hunts an attacker during the opponent's combat", () => {
    const game = gameOf([{ iid: 1, cardId: 'ogre' }, theirs(5, 'cub'), theirs(6, 'stalker')], ['fd-duel-on-the-ridge'], (state) => {
      state.activePlayer = 1;
      state.step = 'combat';
      state.combat = { attackers: [6], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
      state.awaiting = { kind: 'respond', player: 0, over: { type: 'attackers' } };
    });
    expect(decide(game, medium())).toMatchObject({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(6)] });
  });
});

describe('a pump that first damages its own creature counts that damage', () => {
  it('Medium pumps an unblocked attacker with Ember-Tongue only when its 1 damage does not kill it', () => {
    const unblocked = (damage: number) => gameOf([{ iid: 2, cardId: 'cub', damage }, theirs(5, 'wall')], ['fd-ember-tongue'],
      (state) => {
        state.step = 'combat';
        state.combat = { attackers: [2], blocks: [], phase: 'blockersDeclared', damagePrevented: false };
        state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
      });
    expect(decide(unblocked(0), medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(2)] });
    // A 2/2 already holding 1 damage would die to the Charm's own 1.
    expect(decide(unblocked(1), medium())).toEqual({ type: 'passResponse' });
  });
});

describe('Trial by Ember waits for a creature of its caster', () => {
  it('Medium holds it with no creature of its own', () => {
    expect(decide(gameOf([theirs(5, 'stalker')], ['fd-trial-by-ember']), medium())).toEqual({ type: 'passStep' });
  });

  it('Medium casts it once a creature of its own survives the damage to take the Mark', () => {
    const ready = gameOf([{ iid: 1, cardId: 'tough' }, theirs(5, 'stalker')], ['fd-trial-by-ember']);
    expect(decide(ready, medium())).toEqual({ type: 'castSpell', handIndex: 0 });
  });
});
