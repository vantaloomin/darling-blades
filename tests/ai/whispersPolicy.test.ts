import { describe, expect, it, vi } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import { MediumAI } from '../../src/ai/MediumAI';
import { HardAI } from '../../src/ai/HardAI';
import { ScriptAI } from '../../src/ai/ScriptAI';
import { whispersValue } from '../../src/ai/value';
import { applyWhispersPolicy } from '../../src/ai/whispersPolicy';
import { forcedAction, hasCastableCharm, type Action } from '../../src/engine/actions';
import { isCardInstance } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { body, brain, DB, difficulties, gameWith, land, tagged } from './whispersTitheFixture';

type Search = { aggregateOutcome(view: PlayerView, actions: Action[]):
  { score: number; wonAll: boolean; lostAny: boolean } | null };
function response(hand: string[] = [], lands = 1, kind: 'respond' | 'endStepWindow' = 'endStepWindow') {
  const game = gameWith({ hand, graves: [[tagged('wh_draw')], []], active: 1,
    battlefield: Array.from({ length: lands }, (_, i) => land(i + 1)), step: 'end',
    awaiting: kind === 'respond' ? { kind, player: 0, over: { type: 'attackers' } } : { kind, player: 0 } });
  return game;
}

describe('Whispers AI policy', () => {
  it('prices the alternate cost and prioritizes the marker that expires next Dawn', () => {
    expect(whispersValue(DB, 'wh_draw', { myId: 0, activePlayer: 0 })).toBeCloseTo(5.05);
    expect(whispersValue(DB, 'wh_draw', { myId: 0, activePlayer: 1 })).toBeCloseTo(4.05);
    expect(whispersValue(DB, 'wh_draw', { myId: 1, activePlayer: 1 })).toBeCloseTo(5.05);
    expect(whispersValue(DB, 'wh_dear', { myId: 0, activePlayer: 0 })).toBeLessThan(
      whispersValue(DB, 'wh_draw', { myId: 0, activePlayer: 0 }));
    expect(whispersValue(DB, 'bear', { myId: 0, activePlayer: 0 })).toBe(0);
  });

  it('leaves menus, order, and action objects unchanged without Whispers', () => {
    const game = gameWith({ hand: ['bear'] });
    const menu = game.legalActions(0);
    const score = vi.fn(() => { throw new Error('unneeded score'); });
    expect(applyWhispersPolicy(game.viewFor(0), DB, menu, score)).toBe(menu);
    expect(score).not.toHaveBeenCalled();
  });

  it('uses only public live indices and preserves both sides in determinization', () => {
    const game = gameWith({ opponentHand: ['shock'], graves: [[tagged('wh_draw'),
      { ...tagged('wh_body', 0, 1001), whispersUntilDawnOf: 0 }], [tagged('wh_draw', 1, 1002)]] });
    for (const me of [0, 1] as const) {
      const view = game.viewFor(me);
      const sim = determinize(view, DB, 83);
      expect(sim.viewFor(me).you.whispersLive).toEqual(view.you.whispersLive);
      expect(sim.viewFor(me).opp.whispersLive).toEqual(view.opp.whispersLive);
      for (const owner of [0, 1] as const) {
        const grave = sim.instanceState.players[owner].graveyard;
        expect(grave.filter((card) => isCardInstance(card) && card.whispersUntilDawnOf !== undefined)).toHaveLength(1);
      }
      expect(sim.state.players[1 - me].hand).toHaveLength(view.opp.handCount);
      if (me === 0) expect(sim.state.players[1].hand).not.toContain('shock');
    }
    const menu = game.legalActions(0);
    const redacted = game.viewFor(0);
    redacted.you.whispersLive = [];
    expect(applyWhispersPolicy(redacted, DB, menu).some((a) => a.type === 'castSpell' && a.whispers)).toBe(false);
  });

  it.each(difficulties)('%s casts a live affordable Whispers Charm in every response window', (difficulty) => {
    for (const kind of ['respond', 'endStepWindow'] as const) {
      const game = response([], 1, kind);
      const menu = game.legalActions(0);
      expect(hasCastableCharm(game.instanceState, DB, 0)).toBe(true);
      expect(forcedAction(game.instanceState, DB, 0)).toBeNull();
      const choice = brain(difficulty).chooseAction(game.viewFor(0), menu);
      expect(choice).toMatchObject({ type: 'castSpell', whispers: true, graveIndex: 0 });
      expect(() => game.submit(0, choice)).not.toThrow();
    }
  });

  it.each(difficulties)('%s holds Whispers when an affordable hand cast is better', (difficulty) => {
    const game = response(['hand_better'], 8);
    const action = brain(difficulty).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(action).not.toHaveProperty('whispers');
  });

  it.each(difficulties)('%s reads graveIndex even when handIndex is different', (difficulty) => {
    const game = response();
    const menu = game.legalActions(0).map((action) => action.type === 'castSpell' && action.whispers
      ? { ...action, handIndex: 99 } : action);
    const action = brain(difficulty).chooseAction(game.viewFor(0), menu);
    expect(action).toMatchObject({ type: 'castSpell', whispers: true, graveIndex: 0, handIndex: 99 });
    expect(() => game.submit(0, action)).not.toThrow();
  });

  it('Medium prices a whispered removal decision at the Whispers cost', () => {
    const game = gameWith({ graves: [[tagged('wh_remove')], []],
      battlefield: [land(), body(10, 'bear', { controller: 1 })] });
    expect(brain('Medium').chooseAction(game.viewFor(0), game.legalActions(0))).toMatchObject({
      type: 'castSpell', whispers: true, targets: [{ kind: 'permanent', iid: 10 }],
    });
  });

  it('Hard searches a whispered main-phase candidate even when a land is its baseline', () => {
    const game = gameWith({ hand: ['forest'], graves: [[tagged('wh_body')], []] });
    game.state.players[0].landDropsUsed = 0;
    const hard = new HardAI(DB);
    const spy = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    hard.chooseAction(game.viewFor(0), game.legalActions(0));
    expect(spy.mock.calls[0][1][0]).toMatchObject({ type: 'playLand' });
    expect(spy.mock.calls.slice(1).some(([, actions]) => actions.some((a) => a.type === 'castSpell' && a.whispers))).toBe(true);
    expect(spy.mock.results.some((result) => result.value !== null)).toBe(true);
  });

  it('Hard searches whispered responses beyond ten hand variants', () => {
    const game = gameWith({ hand: ['shock'], graves: [[tagged('wh_draw')], []], active: 1,
      battlefield: [{ ...land(), cardId: 'mountain' }, ...Array.from({ length: 10 }, (_, i) =>
        body(10 + i, 'bear', { controller: i < 5 ? 0 : 1 }))],
      step: 'end', awaiting: { kind: 'endStepWindow', player: 0 } });
    const hard = new HardAI(DB);
    const medium = (hard as unknown as { medium: MediumAI }).medium;
    vi.spyOn(medium, 'chooseAction').mockReturnValueOnce({ type: 'passResponse' });
    const spy = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    const menu = game.legalActions(0);
    expect(menu.filter((a) => a.type === 'castSpell' && !a.whispers).length).toBeGreaterThan(10);
    hard.chooseAction(game.viewFor(0), menu);
    expect(spy.mock.calls[0][1]).toEqual([{ type: 'passResponse' }]);
    expect(spy.mock.calls.slice(1).some(([, actions]) => actions.some((a) =>
      a.type === 'castSpell' && a.whispers))).toBe(true);
  });

  it('preserves the Hauntlink-only window gate', () => {
    const game = gameWith({ graves: [[tagged('wh_draw')], []],
      awaiting: { kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } } });
    expect(game.legalActions(0).some((a) => a.type === 'castSpell' && a.whispers)).toBe(false);
  });

  it('the scripted tutorial resolves a whispered creature source safely', () => {
    const game = gameWith({ graves: [[tagged('wh_body')], []] });
    expect(new ScriptAI(DB).chooseAction(game.viewFor(0), game.legalActions(0))).toMatchObject({
      type: 'castSpell', whispers: true, graveIndex: 0,
    });
  });

  it('keeps the default Easy response mixed, not all-cast or all-pass', () => {
    const ai = brain('Easy', 41, false);
    const game = response();
    const actions = Array.from({ length: 12 }, () => ai.chooseAction(game.viewFor(0), game.legalActions(0)).type);
    expect(actions).toContain('castSpell');
    expect(actions).toContain('passResponse');
  });

  it.each(difficulties)('%s pins deterministic Whispers choice at seed 41', (difficulty) => {
    const first = response();
    const second = response();
    const action = brain(difficulty, 41).chooseAction(first.viewFor(0), first.legalActions(0));
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true });
    expect(brain(difficulty, 41).chooseAction(second.viewFor(0), second.legalActions(0))).toEqual(action);
  });
});
