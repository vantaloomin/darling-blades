import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { board, card, dbOf, ref, zero } from '../drownedDeepFixture';

// The AI gaps logged in 1.9 and fixed in 1.9.1 (docs/ai.md, "As built
// (1.9.1)"), on the shipped card texts at no mana cost where the decision
// under test is not about mana:
//   1. Medium aims Ember-Flick at its own Provoked creature when that pays;
//   2. the Foresee on a removal Charm is worth something to Medium;
//   3. a creature Duty on our turn is charged the safe block its tapped body
//      loses at the opponent's next attack.

const free = (id: string, extra: Partial<CardDef> = {}): CardDef => ({ ...CARD_DB[id], cost: zero, ...extra });
const flick = CARD_DB['fd-ember-flick'];
/** Ember-Flick without its Foresee: the control for the rider. */
const plainFlick: CardDef = { ...flick, id: 'plain_flick', cost: zero,
  abilities: [{ ...flick.abilities![0], ops: flick.abilities![0].ops!.filter((op) => op.op !== 'foresee') }] };

const DB: CardDb = dbOf(
  free('fd-ember-flick'),
  plainFlick,
  free('fd-rage-kin-brawler'),
  free('fd-cinder-crest'),
  free('fd-hot-blooded'),
  CARD_DB['tok-pack-raptor'],
  CARD_DB['dd-harbour-looter'],
  CARD_DB['tk-other-lulingqi'],
  card('ogre', { attack: 4, defense: 4, cost: { generic: 4, pips: {} } }),
  /** A plain 4/4 in the Brawler's place: no Provoked. */
  card('plain_brawler', { attack: 4, defense: 4, cost: { generic: 3, pips: {} } }),
  /** A 3/1 for one: worth 3.0 (mana plus half its stats), under the 3.5 bar. */
  card('glass', { attack: 3, defense: 1, cost: { generic: 1, pips: {} } }),
  card('kite', { attack: 2, defense: 2, keywords: ['skyborne'], cost: { generic: 2, pips: {} } }),
  card('giant', { attack: 5, defense: 5, cost: { generic: 5, pips: {} } }),
);

function gameOf(battlefield: Partial<Permanent>[], hand: string[], setup?: (state: GameState) => void): Game {
  const state = board([hand, []], battlefield);
  setup?.(state);
  return Game.restore(state, DB);
}

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
/** Our main phase two, after combat. */
const ourMainTwo = (state: GameState): void => {
  state.step = 'main2';
};

describe('gap 1: Medium aims Ember-Flick at its own Provoked creature when it pays', () => {
  it("flicks its own Rage-Kin Brawler at the opponent's end step for the Pack Raptor, with their 4/4 also a legal target", () => {
    // The ping on their 4/4 wears off at cleanup and kills nothing; on our
    // 4/4 Brawler it makes a 2/1 token and the damage wears off too.
    const game = gameOf([{ iid: 1, cardId: 'fd-rage-kin-brawler' }, theirs(5, 'ogre')], ['fd-ember-flick'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1)] });
  });

  it('holds it when our 4/4 has no Provoked, or when the Provoked does not pay for the card', () => {
    const plain = gameOf([{ iid: 1, cardId: 'plain_brawler' }, theirs(5, 'ogre')], ['fd-ember-flick'], theirEndStep);
    expect(decide(plain, medium())).toEqual({ type: 'passResponse' });
    // Hot-Blooded's Provoked deals 1 to the opponent: less than a card. With
    // no other target, the Foresee rider (0.9 + 0.5 = 1.4 over the 1.25
    // margin) must not pay for it: the Provoked alone has to net the card.
    for (const board of [[{ iid: 1, cardId: 'fd-hot-blooded' }, theirs(5, 'ogre')], [{ iid: 1, cardId: 'fd-hot-blooded' }]]) {
      const small = gameOf(board, ['fd-ember-flick'], theirEndStep);
      expect(decide(small, medium())).toEqual({ type: 'passResponse' });
    }
  });

  it('flicks its own Brawler with no other target on the board', () => {
    const game = gameOf([{ iid: 1, cardId: 'fd-rage-kin-brawler' }], ['fd-ember-flick'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1)] });
  });

  it("holds it on Cinder-Crest at the opponent's end step: its +2/+0 ends at cleanup unused", () => {
    const game = gameOf([{ iid: 1, cardId: 'fd-cinder-crest' }], ['fd-ember-flick'], theirEndStep);
    expect(decide(game, medium())).toEqual({ type: 'passResponse' });
  });

  it('Easy still never takes the friendly target (B5)', () => {
    const game = gameOf([{ iid: 1, cardId: 'fd-rage-kin-brawler' }, theirs(5, 'ogre')], ['fd-ember-flick'], theirEndStep);
    const easy = new EasyAI(DB, 7, makePersonality({ easyNoise: 0, easyPassRate: 0 }));
    const action = decide(game, easy);
    expect(action.type === 'castSpell' && action.targets?.[0]).not.toEqual(ref(1));
  });
});

describe("gap 2: a removal Charm's Foresee counts toward Medium's removal bar", () => {
  it("kills a 3/1 worth 3.0 with Ember-Flick at the opponent's end step, where the Foresee-less copy holds", () => {
    // Medium's instant-speed removal bar is 3.5 plus `removalBias`; at -0.25
    // it is 3.25, a quarter clear of both sides: the kill alone (3.0) stays
    // under it and the kill with the Foresee 1 rider (0.5 at the value layer's
    // rate, opImpactValue's 0.5 a card) clears it.
    const brain = (): MediumAI => new MediumAI(DB, makePersonality({ removalBias: -0.25 }));
    const withForesee = gameOf([theirs(5, 'glass')], ['fd-ember-flick'], theirEndStep);
    expect(decide(withForesee, brain())).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(5)] });
    const without = gameOf([theirs(5, 'glass')], ['plain_flick'], theirEndStep);
    expect(decide(without, brain())).toEqual({ type: 'passResponse' });
  });
});

describe('gap 3: a creature Duty on our turn is charged the blocker it loses', () => {
  const LOOTER = 1;
  it("keeps Salvage Diver untapped in main two when it would block the opponent's 2/2 safely", () => {
    // The 1/3 blocks Lu Lingqi (2/2 First Blade) and lives: two damage saved
    // outweighs a loot.
    const game = gameOf([{ iid: LOOTER, cardId: 'dd-harbour-looter' }, theirs(5, 'tk-other-lulingqi')], [], ourMainTwo);
    expect(decide(game, medium())).toEqual({ type: 'passStep' });
  });

  it('loots when the tapped body could not have blocked safely, or there is nothing to block', () => {
    // A flier it cannot block, a 5/5 that would kill it, an empty board.
    for (const enemy of ['kite', 'giant', undefined]) {
      const game = gameOf([{ iid: LOOTER, cardId: 'dd-harbour-looter' }, ...(enemy ? [theirs(5, enemy)] : [])], [], ourMainTwo);
      expect(decide(game, medium())).toMatchObject({ type: 'activate', iid: LOOTER });
    }
  });
});
