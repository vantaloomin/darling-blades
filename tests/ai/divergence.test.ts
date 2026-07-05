import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { MediumAI } from '../../src/ai/MediumAI';
import { chooseAttackers } from '../../src/ai/combatPlans';
import { makePersonality } from '../../src/ai/personality';
import { avatarById } from '../../src/data/opponents';
import { buildAI } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import { combatSetup, makeTestState, TEST_DB } from '../helpers';

/**
 * SUITE B — Personalities differ MEASURABLY.
 *
 * Default-equivalence (Suite A) proves the knobs are safe; this suite proves
 * they actually change play. The headline metric is an aggressive avatar's
 * attack-declaration rate vs a defensive one's over many seeded games.
 */

/** Wrap an AI, counting non-empty attack declarations vs total attack decisions. */
function instrument(inner: AIPlayer): { ai: AIPlayer; rate: () => number } {
  let attacks = 0;
  let swings = 0;
  const ai: AIPlayer = {
    chooseAction(view, legal) {
      const action = inner.chooseAction(view, legal);
      if (view.awaiting.kind === 'declareAttackers') {
        attacks++;
        if (action.type === 'declareAttackers' && action.attackers.length > 0) swings++;
      }
      return action;
    },
  };
  return { ai, rate: () => (attacks === 0 ? 0 : swings / attacks) };
}

/** Play one game of an instrumented avatar vs a fixed neutral Medium foil. */
function attackRate(avatarId: string, seed: number): number {
  const av = avatarById(avatarId);
  const foil = avatarById('menghuo'); // shared neutral-ish opponent deck
  const decks: [string[], string[]] = [av.deck, foil.deck];
  const game = new Game({ decks, seed, db: CARD_DB });
  const inst = instrument(buildAI(av.difficulty, CARD_DB, seed * 5 + 1, av.personality));
  const ais: AIPlayer[] = [inst.ai, new MediumAI(CARD_DB)];
  for (let i = 0; i < 40000; i++) {
    const a = game.awaiting;
    if (a.kind === 'gameOver') break;
    const p = a.player;
    game.submit(p, ais[p].chooseAction(game.viewFor(p), game.legalActions(p)));
  }
  return inst.rate();
}

describe('aggressive vs defensive attack rate', () => {
  it('Lupa swings measurably more often than Sima Yi (≥ 0.15 absolute)', () => {
    let lupaTotal = 0;
    let simaTotal = 0;
    const N = 50;
    for (let seed = 0; seed < N; seed++) {
      lupaTotal += attackRate('lupa', seed);
      simaTotal += attackRate('simayi', seed + 500);
    }
    const lupa = lupaTotal / N;
    const sima = simaTotal / N;
    console.log(`Lupa attack rate ${lupa.toFixed(3)} vs Sima Yi ${sima.toFixed(3)}`);
    expect(lupa - sima).toBeGreaterThanOrEqual(0.15);
  }, 120_000);
});

/**
 * Knob unit tests — each isolates one knob on a fixed board, holding the brain
 * (Medium) constant, so the ONLY variable is the personality.
 */
describe('personality knob unit tests', () => {
  it('attackThreshold: an aggressive personality attacks an even trade DEFAULT holds', () => {
    // 2/2 bear into a 2/2 bear blocker: a break-even trade with no damage
    // through — DEFAULT scores ~0 and declines (best > 0 is false), but the
    // aggressive personality's attackThreshold −1.5 lets the swing through.
    const build = () =>
      combatSetup(
        [{ key: 'a1', cardId: 'bear' }],
        [{ key: 'b', cardId: 'bear' }],
      );
    const neutral = build();
    const neutralSet = chooseAttackers(
      neutral.game.state.battlefield,
      TEST_DB,
      0,
      neutral.game.state.players[1].life,
      0,
      neutral.game.state.players[0].life,
      makePersonality(),
    );
    const aggro = build();
    const aggroSet = chooseAttackers(
      aggro.game.state.battlefield,
      TEST_DB,
      0,
      aggro.game.state.players[1].life,
      0,
      aggro.game.state.players[0].life,
      makePersonality({ aggression: 1.6, attackThreshold: -1.5 }),
    );
    expect(neutralSet.length).toBe(0);
    expect(aggroSet.length).toBe(1);
  });

  it('burnFaceLife: a 14-life personality sends burn upstairs where DEFAULT develops', () => {
    // Opponent at 12 life, we hold a Fire Attack (2 dmg, "any") and a creature.
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'mountain', controller: 0 },
        { iid: 2, cardId: 'mountain', controller: 0 },
      ],
      hands: [['shock'], []],
      active: 0,
    });
    state.players[1].life = 12;
    const game = Game.restore(state, TEST_DB);
    const view = game.viewFor(0);
    const legal = game.legalActions(0);

    const burnPers = new MediumAI(TEST_DB, makePersonality({ burnFaceLife: 14 }));
    const burnChoice = burnPers.chooseAction(view, legal);
    // shock at "any" target → the burn-happy personality points it at the face
    expect(burnChoice.type).toBe('castSpell');
    if (burnChoice.type === 'castSpell') {
      expect(burnChoice.targets?.[0]?.kind).toBe('player');
    }
    // DEFAULT (burnFaceLife 8) holds the burn at 12 life.
    const dflt = new MediumAI(TEST_DB).chooseAction(view, legal);
    const dfltIsFaceBurn =
      dflt.type === 'castSpell' && dflt.targets?.[0]?.kind === 'player';
    expect(dfltIsFaceBurn).toBe(false);
  });

  it('counterFloor: a 3-floor personality counters a 3-drop DEFAULT would let resolve', () => {
    // A mv-3 enemy spell ('sentinel' = {2}{W}) on the stack we can counter.
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'island', controller: 0 },
        { iid: 2, cardId: 'island', controller: 0 },
      ],
      hands: [['cancel'], []],
      active: 1,
    });
    state.stack = [{ sid: 1, cardId: 'sentinel', controller: 1, targets: [] }];
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'spell', sid: 1 } };
    const game = Game.restore(state, TEST_DB);
    const view = game.viewFor(0);
    const legal = game.legalActions(0);
    // sanity: the counter is actually available
    expect(legal.some((l) => l.type === 'castSpell')).toBe(true);

    const dflt = new MediumAI(TEST_DB); // counterFloor 4 → lets a mv-3 resolve
    const low = new MediumAI(TEST_DB, makePersonality({ counterFloor: 3 }));
    const dfltChoice = dflt.chooseAction(view, legal);
    const lowChoice = low.chooseAction(view, legal);
    expect(dfltChoice.type).toBe('passResponse');
    expect(lowChoice.type).toBe('castSpell');
  });

  it('lifegainBias: the lifelinker is preferred among equal-value develops', () => {
    // Hand: a lifelinker (cleric) and a vanilla body of similar value (giant is
    // bigger, so pick two comparable ones). Use bear (2/2) vs cleric (2/2 LL).
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0 },
        { iid: 2, cardId: 'plains', controller: 0 },
        { iid: 3, cardId: 'plains', controller: 0 },
      ],
      hands: [['bear', 'cleric'], []],
      active: 0,
    });
    const game = Game.restore(state, TEST_DB);
    const view = game.viewFor(0);
    const legal = game.legalActions(0);
    const bias = new MediumAI(TEST_DB, makePersonality({ lifegainBias: 2 }));
    const choice = bias.chooseAction(view, legal);
    expect(choice.type).toBe('castSpell');
    if (choice.type === 'castSpell') {
      expect(view.you.hand[choice.handIndex]).toBe('cleric');
    }
  });
});

/** A tiny sanity check that instrument() sees declareAttackers decisions. */
describe('instrument sanity', () => {
  it('counts at least one attack decision in a real game', () => {
    let saw = false;
    const inner = new MediumAI(CARD_DB);
    const ai: AIPlayer = {
      chooseAction(view, legal): Action {
        if (view.awaiting.kind === 'declareAttackers') saw = true;
        return inner.chooseAction(view, legal);
      },
    };
    const foil = avatarById('menghuo');
    const game = new Game({ decks: [foil.deck, foil.deck], seed: 3, db: CARD_DB });
    const ais = [ai, new MediumAI(CARD_DB)];
    for (let i = 0; i < 40000; i++) {
      const a = game.awaiting;
      if (a.kind === 'gameOver') break;
      game.submit(a.player, ais[a.player].chooseAction(game.viewFor(a.player), game.legalActions(a.player)));
    }
    expect(saw).toBe(true);
  });
});
