import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { chooseHauntlinkWindow, rankedHauntlinkWindowCandidates } from '../../src/ai/hauntlinkPolicy';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, EffectOp, GameState, TargetRef } from '../../src/engine/types';
import { act, body, DB, fixture } from './documentedBehaviourFixture';

function damageWindow(defending = false, unlinked = false) {
  return fixture([], [
    body(10, 'bear'), body(11, 'small_guard', 0, unlinked ? {} : { attachments: [30] }),
    body(30, 'saving_link', 0, unlinked ? {} : { attachedTo: 11 }), body(20, 'bear', 1),
  ], (state) => {
    state.activePlayer = defending ? 1 : 0;
    state.step = 'combat';
    state.combat = { attackers: [defending ? 20 : 10],
      blocks: [{ attacker: defending ? 20 : 10, blocker: defending ? 10 : 20 }],
      phase: 'blockersDeclared', damagePrevented: false };
    state.awaiting = { kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } };
  });
}

function triggerWindow(ops: EffectOp[], targets: TargetRef[] = [{ kind: 'permanent', iid: 11 }], setup?: (state: GameState) => void) {
  return fixture([], [
    body(10, 'giant'), body(11, 'bear', 0, { attachments: [30] }),
    body(30, 'saving_link', 0, { attachedTo: 11 }), body(20, 'bear', 1),
  ], (state) => {
    state.pendingDecisions = [{ kind: 'resolveTrigger', controller: 1, sourceIid: 20, sourceCardId: 'bear',
      targets, targetSpecs: targets.map(() => ({ what: 'creature' as const })), ops, offered: [0] }];
    state.awaiting = { kind: 'hauntlinkWindow', player: 0, over: { type: 'trigger', iid: 20 } };
    setup?.(state);
  });
}

describe('revision-4 Hauntlink windows from the documented behaviour fixture', () => {
  it.each([false, true])('all brains save a %s-defending combatant with the shared window policy', (defending) => {
    const brains = [new EasyAI(DB, 41), new MediumAI(DB), new HardAI(DB)];
    for (const brain of brains) {
      const game = damageWindow(defending);
      expect(act(game, brain)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
      expect(act(game, brain)).toEqual({ type: 'passResponse' });
      expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 10)).toBe(true);
      expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 20)).toBe(false);
    }
  });

  it('uses an unlinked rider to turn a losing block into a winning one', () => {
    const game = damageWindow(true, true);
    expect(act(game)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 10)).toBe(true);
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 20)).toBe(false);
  });

  it('Easy and Medium pass when an existing fog makes the proposed combat rescue unnecessary', () => {
    for (const brain of [new EasyAI(DB, 41), new MediumAI(DB)]) {
      const state = { ...structuredClone(damageWindow().instanceState), fogThisTurn: true };
      const game = Game.restore(state, DB);
      expect(game.viewFor(0).combat?.damagePrevented).toBe(false);
      expect(brain.chooseAction(game.viewFor(0), game.legalActions(0))).toEqual({ type: 'passResponse' });
      // Hard retains every legal link for its exact engine search.
      expect(rankedHauntlinkWindowCandidates(game.viewFor(0), DB, game.legalActions(0)))
        .toContainEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    }
  });

  it('passes a damage window when the link changes no combat outcome', () => {
    const game = fixture([], [body(10, 'giant'), body(11, 'small_guard', 0, { attachments: [30] }),
      body(30, 'saving_link', 0, { attachedTo: 11 }), body(20, 'bear', 1)], (state) => {
      state.step = 'combat';
      state.combat = { attackers: [10], blocks: [{ attacker: 10, blocker: 20 }], phase: 'blockersDeclared', damagePrevented: false };
      state.awaiting = { kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } };
    });
    expect(chooseHauntlinkWindow(game.viewFor(0), DB, game.legalActions(0))).toBeUndefined();
    // Hard must still be allowed to discover an exact-engine improvement that
    // the shared combat forecast misses, including phase C keyword shapes.
    expect(rankedHauntlinkWindowCandidates(game.viewFor(0), DB, game.legalActions(0)))
      .toEqual([{ type: 'linkHaunt', iid: 30, hostIid: 10 }]);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('does not save one combatant by killing the damaged host it leaves', () => {
    const game = fixture([], [body(10, 'bear'), body(11, 'small_guard', 0, { damage: 1, attachments: [30] }),
      body(30, 'saving_link', 0, { attachedTo: 11 }), body(20, 'bear', 1)], (state) => {
      state.step = 'combat';
      state.combat = { attackers: [10], blocks: [{ attacker: 10, blocker: 20 }], phase: 'blockersDeclared', damagePrevented: false };
      state.awaiting = { kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } };
    });
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('does not enlarge Overrun damage while rescuing a different blocker', () => {
    const game = fixture([], [body(10, 'bear'), body(11, 'small_guard', 0, { attachments: [30] }),
      body(30, 'saving_link', 0, { attachedTo: 11 }), body(20, 'bear', 1), body(21, 'rhino', 1)], (state) => {
      state.activePlayer = 1;
      state.step = 'combat';
      state.combat = { attackers: [20, 21], blocks: [{ attacker: 20, blocker: 10 }, { attacker: 21, blocker: 11 }],
        phase: 'blockersDeclared', damagePrevented: false };
      state.awaiting = { kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } };
    });
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('leaves ordinary response-window link searching outside the new ranking helper', () => {
    const game = fixture([], [body(10, 'bear'), body(30, 'saving_link')]);
    expect(game.legalActions(0)).toContainEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(rankedHauntlinkWindowCandidates(game.viewFor(0), DB, game.legalActions(0))).toEqual([]);
  });

  it('lets Hard search a Twin Blades rescue beyond the shared combat forecast', () => {
    const db: CardDb = { ...DB, saving_link: { ...DB.saving_link,
      hauntlink: { cost: { generic: 0, pips: {} }, linked: { grantKeywords: ['twinBlades'] } } } };
    const state = structuredClone(damageWindow().instanceState);
    state.battlefield.find((perm) => perm.iid === 20)!.cardId = 'giant';
    const game = Game.restore(state, db);
    expect(chooseHauntlinkWindow(game.viewFor(0), db, game.legalActions(0))).toBeUndefined();
    const move = new HardAI(db).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(move).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    game.submit(0, move);
    game.submit(0, { type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 20)).toBe(false);
  });

  it.each(['destroy', 'sever', 'recall'] as const)('moves off the chosen host before a %s trigger resolves', (op) => {
    const game = triggerWindow([{ op, to: 'target' }]);
    expect(act(game)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 11)).toBe(false);
    expect(game.viewFor(0).battlefield.find((perm) => perm.iid === 30)?.attachedTo).toBe(10);
  });

  it('moves off a nonlethally shrinking host, then passes instead of churning', () => {
    const game = triggerWindow([{ op: 'boost', scope: 'target', p: -1, t: -1 }]);
    expect(act(game)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(getEffectiveStats(game.viewFor(0).battlefield, DB, 11)).toMatchObject({ attack: 1, defense: 1 });
  });

  it('keeps the rider when moving would turn nonlethal shrink into a friendly death', () => {
    const game = triggerWindow([{ op: 'boost', scope: 'target', p: -1, t: -1 }],
      [{ kind: 'permanent', iid: 11 }], (state) => { state.battlefield.find((perm) => perm.iid === 11)!.damage = 1; });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 11)).toBe(true);
  });

  it('uses the chosen trigger target and keeps a link whose host is safe', () => {
    const threatened = triggerWindow([{ op: 'destroy', to: 'target' }]);
    const safe = triggerWindow([{ op: 'destroy', to: 'target' }], [{ kind: 'permanent', iid: 10 }]);
    expect(threatened.legalActions(0)).toEqual(safe.legalActions(0));
    expect(threatened.viewFor(0)).not.toEqual(safe.viewFor(0));
    expect(act(threatened)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(safe)).toEqual({ type: 'passResponse' });
  });

  it('revalidates the held trigger target after an unlinked Untouchable rider protects it', () => {
    const db: CardDb = { ...DB, saving_link: { ...DB.saving_link,
      hauntlink: { cost: { generic: 0, pips: {} }, linked: { grantKeywords: ['untouchable'] } } } };
    const state = structuredClone(triggerWindow([{ op: 'destroy', to: 'target' }], [{ kind: 'permanent', iid: 10 }]).instanceState);
    state.battlefield.find((perm) => perm.iid === 11)!.attachments = [];
    delete state.battlefield.find((perm) => perm.iid === 30)!.attachedTo;
    const game = Game.restore(state, db);
    const move = new MediumAI(db).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(move).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    game.submit(0, move);
    game.submit(0, { type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 10)).toBe(true);
  });

  it('rejects a move when every possible destination dies to the held sweep', () => {
    const game = triggerWindow([{ op: 'massDestroy', filter: 'allCreatures' }]);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('does not churn between hosts equally shrunk by a global trigger', () => {
    const game = triggerWindow([{ op: 'boost', scope: 'all', p: -1, t: -1 }]);
    expect(act(game)).toEqual({ type: 'passResponse' });
  });

  it('does not infer destination survival from a partial trigger ending at Foresee', () => {
    const game = triggerWindow([{ op: 'boost', scope: 'target', p: -1, t: -1 },
      { op: 'foresee', n: 1 }, { op: 'massDestroy', filter: 'allCreatures' }]);
    expect(chooseHauntlinkWindow(game.viewFor(0), DB, game.legalActions(0))).toBeUndefined();
    expect(rankedHauntlinkWindowCandidates(game.viewFor(0), DB, game.legalActions(0)))
      .toContainEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(game.awaiting.kind).toBe('foresee');
  });

  it('treats shrink then a token static debuff as unknown instead of claiming the alternate survives', () => {
    const db: CardDb = { ...DB, hauntlink_doom_token: {
      id: 'hauntlink_doom_token', name: 'hauntlink_doom_token', types: ['creature'], subtypes: [],
      colors: [], rarity: 'c', token: true, attack: 1, defense: 1,
      abilities: [{ when: 'static', static: { scope: 'filter', filter: { who: 'opponent' }, t: -10 } }],
    } };
    const state = structuredClone(triggerWindow([{ op: 'boost', scope: 'target', p: -1, t: -1 }]).instanceState);
    const trigger = state.pendingDecisions[0];
    if (trigger.kind !== 'resolveTrigger') throw new Error('Expected held trigger fixture');
    trigger.ops.push({ op: 'createToken', token: 'hauntlink_doom_token', count: 1 });
    const game = Game.restore(state, db);
    expect(chooseHauntlinkWindow(game.viewFor(0), db, game.legalActions(0))).toBeUndefined();
    expect(rankedHauntlinkWindowCandidates(game.viewFor(0), db, game.legalActions(0)))
      .toContainEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    const move = Game.restore(structuredClone(state), db);
    move.submit(0, { type: 'linkHaunt', iid: 30, hostIid: 10 });
    move.submit(0, { type: 'passResponse' });
    expect(move.viewFor(0).battlefield.some((perm) => [10, 11, 30].includes(perm.iid))).toBe(false);
    expect(move.viewFor(0).battlefield.some((perm) => perm.cardId === 'hauntlink_doom_token')).toBe(true);
    const choice = new MediumAI(db).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(choice).toEqual({ type: 'passResponse' });
    game.submit(0, choice);
    expect(game.viewFor(0).battlefield.some((perm) => [10, 11, 30].includes(perm.iid))).toBe(false);
  });

  it('follows the marked target branch and targetIndex of the held trigger', () => {
    const game = triggerWindow([{ op: 'ifTargetMarked', targetIndex: 1,
      then: [{ op: 'removeMarks', to: 'target' }, { op: 'damage', to: 'target', n: 4 }], else: [] }],
    [{ kind: 'permanent', iid: 10 }, { kind: 'permanent', iid: 11 }], (state) => {
      state.battlefield.find((perm) => perm.iid === 11)!.plusOneCounters = 1;
    });
    expect(act(game)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
    expect(act(game)).toEqual({ type: 'passResponse' });
    expect(game.viewFor(0).battlefield.some((perm) => perm.iid === 11)).toBe(false);
  });
});
