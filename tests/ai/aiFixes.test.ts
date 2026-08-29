import { describe, expect, it } from 'vitest';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { determinize } from '../../src/ai/determinize';
import { removalKind } from '../../src/ai/value';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import { makeTestState } from '../helpers';
import { DARK_TALES_DB } from '../darkTalesFixture';

const DB = { ...CARD_DB, ...DARK_TALES_DB };

function gameFromState(state: ReturnType<typeof makeTestState>): Game {
  return Game.restore(state, DB);
}

describe('AI defect regressions from the 1.5 instrumented probe', () => {
  it('HardAI returns and can submit only a legal three-target Quiet Orbit cast', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'land-island', controller: 0 },
        { iid: 2, cardId: 'land-island', controller: 0 },
        { iid: 3, cardId: 'land-island', controller: 0 },
      ],
      hands: [['sb-quiet-orbit'], []],
      active: 0,
    });
    state.stack = [{ sid: 7, cardId: 'sb-halo-motherboard', controller: 1, targets: [] }];
    state.nextSid = 8;
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'spell', sid: 7 } };
    const game = gameFromState(state);
    const legal = game.legalActions(0);
    const quietOrbitActions = legal.filter(
      (action): action is Extract<typeof action, { type: 'castSpell' }> =>
        action.type === 'castSpell' && game.viewFor(0).you.hand[action.handIndex] === 'sb-quiet-orbit',
    );
    expect(quietOrbitActions).toHaveLength(6);
    expect(quietOrbitActions.every((action) => action.targets?.length === 3)).toBe(true);

    const action = new HardAI(DB).chooseAction(game.viewFor(0), legal);
    expect(legal).toContainEqual(action);
    expect(action).toMatchObject({
      type: 'castSpell',
      handIndex: 0,
      targets: [
        { kind: 'stackItem', sid: 7 },
        { kind: 'permanent' },
        { kind: 'permanent' },
      ],
    });
    expect((action as Extract<typeof action, { type: 'castSpell' }>).targets?.[1]).not.toEqual(
      (action as Extract<typeof action, { type: 'castSpell' }>).targets?.[2],
    );
    expect(() => game.submit(0, action)).not.toThrow();
  });

  it('HardAI determinization carries the live rules revision into its sim state', () => {
    const state = makeTestState({ hands: [['shock'], []], active: 0 });
    state.rulesRev = 2;
    state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
    const view = gameFromState(state).viewFor(0);
    const simulated = determinize(view, DB, 4242);

    expect(view.rulesRev).toBe(2);
    expect(simulated.instanceState.rulesRev).toBe(2);
    expect(simulated.instanceState.episode).toEqual({ resolvedSinceOffer: 0, reopensThisStep: 0 });
  });

  it('DEFECT 1: seed 1600026 turn 27, Medium sends Apple of Endless Sleep at the opposing creature', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'swamp', controller: 0 },
        { iid: 2, cardId: 'swamp', controller: 0 },
        { iid: 3, cardId: 'swamp', controller: 0 },
        { iid: 4, cardId: 'swamp', controller: 0 },
        { iid: 10, cardId: 'bear', controller: 0 },
        { iid: 11, cardId: 'giant', controller: 1 },
      ],
      hands: [['dt-apple-of-endless-sleep'], []],
      active: 0,
    });
    const game = gameFromState(state);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toMatchObject({
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 11 }],
    });
    expect(removalKind(DB, 'dt-apple-of-endless-sleep')).toBe('sever');
    expect(removalKind(DB, 'cf-glamour-of-the-hill')).toBe('recall');
  });

  it('DEFECT 2: the probe\'s four seeded Grave Chill cases, Medium never pumps its own unblocked attacker', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'swamp', controller: 0 },
        { iid: 2, cardId: 'bear', controller: 0 },
        { iid: 3, cardId: 'giant', controller: 1 },
      ],
      hands: [['in-grave-chill'], []],
      active: 0,
    });
    state.step = 'combat';
    state.combat = {
      attackers: [2],
      blocks: [],
      phase: 'blockersDeclared',
      damagePrevented: false,
    };
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'blockers' } };
    const game = gameFromState(state);
    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toEqual({ type: 'passResponse' });
  });

  it('DEFECT 3: seeds 1600001/1600003/1600010/1600036, Hard Retells Once More With Magic onto its own creature on ties', () => {
    const state = makeTestState({
      battlefield: [
        // Opposing target first reproduces the old legal-menu tie winner.
        { iid: 10, cardId: 'bear', controller: 1, damage: 3 },
        { iid: 11, cardId: 'bear', controller: 0 },
        { iid: 20, cardId: 'plains', controller: 0 },
        { iid: 21, cardId: 'plains', controller: 0 },
        { iid: 22, cardId: 'plains', controller: 0 },
      ],
      hands: [[], []],
      active: 0,
    });
    state.players[0].graveyard = ['dt-once-more-with-magic'];
    const game = gameFromState(state);
    const action = new HardAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));

    expect(action).toMatchObject({
      type: 'castSpell',
      retell: true,
      graveIndex: 0,
      targets: [{ kind: 'permanent', iid: 11 }],
    });
  });
});

  it('DEFECT 5: Medium survives a reopened combat window whose blocks reference a dead combatant', () => {
    // Rules rev 2 reopens the blockers window after a paid flush; that flush
    // can kill a combatant, leaving a stale iid in combat.blocks. Discovered
    // by the 2026-08-08 Darlings hand-size run (getEffectiveStats: no
    // permanent N through HardAI.searchResponse -> MediumAI.respond).
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0 },
        { iid: 2, cardId: 'bear', controller: 0 },
      ],
      hands: [['growth'], []],
      active: 0,
    });
    state.step = 'combat';
    state.combat = {
      attackers: [2],
      // Blocker iid 99 died mid-window; no permanent 99 exists.
      blocks: [{ blocker: 99, attacker: 2 }],
      phase: 'blockersDeclared',
      damagePrevented: false,
    };
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'blockers' } };
    const game = gameFromState(state);

    const action = new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toHaveProperty('type');
  });
