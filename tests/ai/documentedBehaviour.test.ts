import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { HardAI } from '../../src/ai/HardAI';
import * as combatPlans from '../../src/ai/combatPlans';
import { makePersonality } from '../../src/ai/personality';
import { cardValue, permValue } from '../../src/ai/value';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { PlayerView } from '../../src/engine/view';
import { DEFAULT_PICKER, pickNoise, scorePick } from '../../src/meta/draftPicker';
import { act, attacks, blocks, body, checked, DB, fixture, invariantErrors, lands } from './documentedBehaviourFixture';

afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => {
  expect(invariantErrors, 'fixture/legality errors cannot satisfy it.fails').toEqual([]);
});

const ref = (iid: number) => ({ kind: 'permanent' as const, iid });
const medium = () => new MediumAI(DB);
const hard = () => new HardAI(DB);
function requireLegal(game: Game, action: Action): void {
  checked(() => {
    const awaiting = game.awaiting;
    expect(awaiting.kind).not.toBe('gameOver');
    if (awaiting.kind === 'gameOver') throw new Error('No decision');
    expect(validateAction(game.instanceState, DB, awaiting.player, action)).toBeNull();
  });
}
function handDecision(hand: string[], mulligans: number, bottom = false): Game {
  return fixture(hand, [], (state) => {
    state.players[0].mulligans = mulligans;
    state.players[0].keptHand = false;
    state.awaiting = bottom ? { kind: 'bottomCards', player: 0, count: 1 } : { kind: 'mulligan', player: 0 };
  });
}
function endStep(hand: string[], enemy = 'giant'): Game {
  return fixture(hand, [...lands(5), body(20, enemy, 1)], (state) => {
    state.activePlayer = 1;
    state.step = 'end';
    state.awaiting = { kind: 'endStepWindow', player: 0 };
  });
}
function lethalRitual(id: string): Action {
  const game = fixture([id, 'giant'], lands(4), (state) => { state.players[1].life = 3; });
  requireLegal(game, { type: 'castSpell', handIndex: 0 });
  return act(game);
}
function wrathBoard(ahead: boolean): Game {
  return fixture(['wrath'], [
    ...lands(3), body(10, ahead ? 'giant' : 'small_guard'),
    body(11, 'giant', ahead ? 0 : 1), body(20, ahead ? 'small_guard' : 'giant', 1),
  ]);
}

describe('documented opening-hand and Foresee decisions', () => {
  // docs/ai.md:37-38: classic Easy land band and hard keep.
  it('Easy keeps 1-6 classic lands, rejects 0/7, and hard-keeps at two mulligans', () => {
    for (const mulligans of [0, 1, 2]) {
      for (let n = 0; n <= 7; n++) {
        const game = handDecision([...Array<string>(n).fill('forest'), ...Array<string>(7 - n).fill('bear')], mulligans);
        expect(act(game, new EasyAI(DB, 41))).toEqual({
          type: mulligans === 2 || n >= 1 && n <= 6 ? 'keepHand' : 'mulligan',
        });
      }
    }
  });

  // docs/ai.md:59-63: classic Medium bands, including both rejection boundaries.
  it('Medium keeps 2-5 fresh lands, 1-5 after one mulligan, and anything at two', () => {
    for (const mulligans of [0, 1, 2]) {
      for (let n = 0; n <= 7; n++) {
        const game = handDecision([...Array<string>(n).fill('forest'), ...Array<string>(7 - n).fill('bear')], mulligans);
        expect(act(game)).toEqual({
          type: mulligans === 2 || n >= (mulligans === 0 ? 2 : 1) && n <= 5 ? 'keepHand' : 'mulligan',
        });
      }
    }
  });

  // docs/ai.md:37-40 opening-hand claim; London ordering is undocumented (EasyAI.ts:157-178).
  it('Easy London-bottoms highest mana value, or a land when flooded', () => {
    expect(act(handDecision(['forest', 'bear', 'costly', 'cheap_value', 'bear', 'bear', 'bear'], 2, true), new EasyAI(DB, 41)))
      .toEqual({ type: 'bottomCards', handIndices: [2] });
    expect(act(handDecision(['bear', 'costly', 'forest', 'forest', 'forest', 'forest', 'forest'], 2, true), new EasyAI(DB, 41)))
      .toEqual({ type: 'bottomCards', handIndices: [2] });
  });

  // docs/ai.md:59-63 opening-hand claim; London value ordering is undocumented (MediumAI.ts:166-193).
  it('Medium London-bottoms by cardValue and bottoms lands when flooded', () => {
    checked(() => expect(cardValue(DB, 'expensive_blank')).toBeLessThan(cardValue(DB, 'cheap_value')));
    expect(act(handDecision(['cheap_value', 'expensive_blank', 'costly', 'cheap_value', 'costly', 'forest', 'forest'], 2, true)))
      .toEqual({ type: 'bottomCards', handIndices: [1] });
    expect(act(handDecision(['bear', 'costly', 'forest', 'forest', 'forest', 'forest', 'forest'], 2, true)))
      .toEqual({ type: 'bottomCards', handIndices: [2] });
  });

  // docs/ai.md:255; foresee.ts:11-36: developing mana keeps land and bottoms a distant expensive spell.
  it('Foresee keeps developing lands and bottoms an uncastable expensive card', () => {
    const game = fixture([], lands(2), (state) => {
      state.players[0].deck = ['bear', 'costly', 'forest'];
      state.awaiting = { kind: 'foresee', player: 0, cards: ['forest', 'costly', 'bear'] };
      state.pendingDecisions = [{ kind: 'foresee', player: 0, n: 3 }];
    });
    expect(act(game)).toEqual({ type: 'foresee', bottomIndices: [1] });
  });

  // docs/ai.md:255; foresee.ts:25-29: established sources plus a hand land make another land excess.
  it('Foresee bottoms excess lands once mana is developed', () => {
    const game = fixture(['forest'], lands(4), (state) => {
      state.players[0].deck = ['bear', 'forest'];
      state.awaiting = { kind: 'foresee', player: 0, cards: ['forest', 'bear'] };
      state.pendingDecisions = [{ kind: 'foresee', player: 0, n: 2 }];
    });
    expect(act(game)).toEqual({ type: 'foresee', bottomIndices: [0] });
  });
});

describe('documented Medium casting and responses', () => {
  // docs/ai.md:65-67: lethal targeted burn precedes creature development.
  it('Medium sends lethal damage-to-target Charm to the face before developing', () => {
    const game = fixture(['giant', 'burn'], [...lands(4), body(20, 'giant', 1)], (state) => { state.players[1].life = 2; });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 1, targets: [{ kind: 'player', player: 1 }] });
    checked(() => expect(game.state.winner).toBe(0));
  });

  // docs/ai.md:65-67. Phase A cast ladder: recognize targetless face-damage lethal before develop.
  it('Medium casts a lethal targetless face-damage Ritual before developing', () => {
    expect(lethalRitual('face_ritual')).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md:65-67. Phase A cast ladder: recognize loseLife lethal before develop.
  it('Medium casts a lethal loseLife Ritual before developing', () => {
    expect(lethalRitual('drain_ritual')).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md:71-72: nonlethal burn is reach only at eight life or below.
  it('Medium sends burn to the face at eight life and holds it at twelve', () => {
    for (const life of [8, 12]) {
      const game = fixture(['burn'], lands(2), (state) => { state.players[1].life = life; });
      expect(act(game)).toEqual(life === 8
        ? { type: 'castSpell', handIndex: 0, targets: [{ kind: 'player', player: 1 }] }
        : { type: 'passStep' });
    }
  });

  // docs/ai.md:67-70,88-89: damage must kill using effective defense minus marked damage.
  it('Medium uses damage removal only when it kills', () => {
    for (const damage of [0, 2]) {
      const game = fixture(['burn'], [...lands(2), body(20, 'damaged_target', 1, { damage })]);
      expect(act(game)).toEqual(damage === 2
        ? { type: 'castSpell', handIndex: 0, targets: [ref(20)] } : { type: 'passStep' });
    }
  });

  // docs/ai.md:67-70: absolute target value floor is inclusive at 2.5.
  it('Medium holds removal below 2.5 target value and casts at 2.5', () => {
    for (const [target, value] of [['worth_two', 2], ['worth_two_half', 2.5]] as const) {
      const game = fixture(['remove_three'], [...lands(3), body(20, target, 1)]);
      checked(() => expect(permValue(game.viewFor(0).battlefield, DB, 20)).toBe(value));
      expect(act(game)).toEqual(value === 2.5
        ? { type: 'castSpell', handIndex: 0, targets: [ref(20)] } : { type: 'passStep' });
    }
  });

  // docs/ai.md:67-70: target must also cover 0.8 times removal mana value.
  it('Medium holds removal below 0.8 x cost and casts at that boundary', () => {
    const low = fixture(['remove_four'], [...lands(4), body(20, 'worth_three', 1)]);
    expect(act(low)).toEqual({ type: 'passStep' });
    const equal = fixture(['remove_five'], [...lands(5), body(20, 'worth_four', 1)]);
    expect(act(equal)).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20)] });
  });

  // docs/ai.md:90-93: a cheap spell targeting its best creature triggers the counter rule.
  it('Medium counters a cheap spell aimed at its best creature', () => {
    const game = fixture(['counter'], [...lands(1), ...lands(3, 1), body(10, 'giant'), body(11, 'small_guard')], (state) => {
      state.activePlayer = 1;
      state.awaiting = { kind: 'main', player: 1 };
      state.players[1].hand = ['burn'];
    });
    checked(() => game.submit(1, { type: 'castSpell', handIndex: 0, targets: [ref(10)] }));
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0, targets: [{ kind: 'stackItem', sid: 1 }] });
  });

  // docs/ai.md:90-93: massDestroy is countered even below the four-mana counter floor.
  it('Medium counters a massDestroy spell', () => {
    const game = fixture(['counter'], [...lands(1), ...lands(3, 1), body(10, 'bear')], (state) => {
      state.activePlayer = 1;
      state.awaiting = { kind: 'main', player: 1 };
      state.players[1].hand = ['wrath'];
    });
    checked(() => game.submit(1, { type: 'castSpell', handIndex: 0 }));
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0, targets: [{ kind: 'stackItem', sid: 1 }] });
  });

  // docs/ai.md:90-93: spare removal is spent at the opponent's end step.
  it('Medium spends spare removal at the opponent end step', () => {
    expect(act(endStep(['remove_three']))).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20)] });
  });

  // docs/ai.md:90-93: free targetless draw Charm is spent at the opponent's end step.
  it('Medium spends a free draw Charm at the opponent end step', () => {
    const game = endStep(['free_draw']);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    // The engine may also advance through the next turn's normal draw.
    checked(() => expect(game.viewFor(0).you.hand).not.toContain('free_draw'));
  });

  // docs/ai.md:90-93. Phase A cast ladder: fog must save the player from lethal combat.
  it('Medium casts a fog Charm when facing lethal on board', () => {
    const game = checked(() => {
      const g = fixture(['fog'], [...lands(1), body(20, 'giant', 1)], (state) => {
        state.activePlayer = 1;
        state.awaiting = { kind: 'main', player: 1 };
        state.players[0].life = 4;
      });
      g.submit(1, { type: 'passStep' });
      g.submit(1, { type: 'declareAttackers', attackers: [20] });
      expect(g.awaiting).toMatchObject({ kind: 'respond', player: 0 });
      requireLegal(g, { type: 'castSpell', handIndex: 0 });
      return g;
    });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md:67-75: useful creature sweep when behind; phase A owns the asymmetry rule.
  it('Medium casts a creature wrath when behind on board', () => {
    const game = wrathBoard(false);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    checked(() => expect(game.viewFor(0).battlefield.filter((p) => DB[p.cardId].types.includes('creature'))).toEqual([]));
  });

  // docs/ai.md:67-75. Phase A cast ladder: hold a creature wrath on a winning board.
  it('Medium holds a creature wrath when ahead on board', () => {
    const game = wrathBoard(true);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toEqual({ type: 'passStep' });
  });

  // docs/ai.md:79-85: all three public evidence conditions are independently necessary.
  it('Medium passes +2 trickBuff only with open mana, a hand card, and a shown Charm', () => {
    const planner = vi.spyOn(combatPlans, 'chooseAttackers');
    for (const missing of ['none', 'mana', 'hand', 'charm'] as const) {
      const game = attacks('bear', lands(missing === 'mana' ? 1 : 2, 1));
      game.state.players[1].hand = missing === 'hand' ? [] : ['bear'];
      game.state.players[1].graveyard = missing === 'charm' ? [] : ['burn'];
      act(game);
      expect(planner.mock.calls.at(-1)?.[4]).toBe(missing === 'none' ? 2 : 0);
    }
  });
});

describe('Hard search and combat keyword proof', () => {
  function margin(delta: number): { action: Action; candidates: Action[] } {
    const game = attacks('bear', [body(11, 'bear')]);
    checked(() => expect(new MediumAI(DB).chooseAction(game.viewFor(0), game.legalActions(0)))
      .toEqual({ type: 'declareAttackers', attackers: [10, 11] }));
    const brain = hard();
    // Controlled score seam isolates the boundary; candidate generation and
    // the final action are real, with the same redacted view and engine menu.
    type Lookahead = { lookahead(view: PlayerView, first: Action): number };
    const scores = vi.spyOn(brain as unknown as Lookahead, 'lookahead').mockImplementation((_view, action) =>
      action.type !== 'declareAttackers' ? 0 : action.attackers.length === 2 ? 10 :
        action.attackers.length === 1 && action.attackers[0] === 10 ? 10 + delta : 0);
    const action = act(game, brain);
    return { action, candidates: scores.mock.calls.map(([, first]) => first) };
  }

  // docs/ai.md:159-165: a drop-one candidate must strictly clear the +0.75 margin.
  it('Hard takes a drop-one candidate above the +0.75 margin', () => {
    const result = margin(0.76);
    expect(result.candidates).toContainEqual({ type: 'declareAttackers', attackers: [10] });
    expect(result.action).toEqual({ type: 'declareAttackers', attackers: [10] });
  });

  // docs/ai.md:159-165: marginal improvements preserve Medium's attack.
  it('Hard retains Medium attack at or below the +0.75 margin', () => {
    for (const delta of [0.74, 0.75]) expect(margin(delta).action)
      .toEqual({ type: 'declareAttackers', attackers: [10, 11] });
  });

  // docs/ai.md:166-172: the add-neighbor hill-climb finds a useful three-block gang.
  it('Hard adds a third blocker to kill firstBlade and leaves the fourth free', () => {
    const game = blocks('first_four', ['three', 'three', 'three', 'three']);
    const baseline = medium().chooseAction(game.viewFor(0), game.legalActions(0));
    checked(() => {
      expect(baseline.type).toBe('declareBlockers');
      if (baseline.type === 'declareBlockers') expect(baseline.blocks).toHaveLength(2);
    });
    const action = act(game, hard());
    expect(action.type).toBe('declareBlockers');
    if (action.type !== 'declareBlockers') throw new Error('Expected blocks');
    expect(action.blocks).toHaveLength(3);
    expect(new Set(action.blocks.map((block) => block.attacker))).toEqual(new Set([20]));
  });

  // docs/ai.md:166-172. Phase C combat: moving blockers must respect the same three-block cap as adding them.
  it.fails('Hard never moves a fourth blocker onto an existing gang', () => {
    const game = fixture([], [
      body(20, 'cap_attacker', 1, { tapped: true }), body(21, 'tok_fox', 1, { tapped: true }),
      ...[10, 11, 12, 13].map((iid) => body(iid, 'three')),
    ], (state) => {
      state.activePlayer = 1; state.step = 'combat'; state.players[0].life = 2;
      state.awaiting = { kind: 'declareBlockers', player: 0 };
      state.combat = { attackers: [20, 21], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    });
    const action = act(game, hard());
    checked(() => expect(action.type).toBe('declareBlockers'));
    expect(action.type === 'declareBlockers' ? action.blocks.filter((b) => b.attacker === 20).length : Infinity)
      .toBeLessThanOrEqual(3);
  });

  // docs/ai.md:166-172: engine-legal hill-climb never returns singleton Dreaded blocks.
  it('Hard pairs blockers against Dreaded and declines a lone blocker', () => {
    const paired = act(blocks('dreaded_four', ['three', 'three', 'three', 'three']), hard());
    expect(paired.type).toBe('declareBlockers');
    if (paired.type !== 'declareBlockers') throw new Error('Expected blocks');
    expect(paired.blocks.length).toBeGreaterThanOrEqual(2);
    expect(act(blocks('dreaded_four', ['three']), hard())).toEqual({ type: 'declareBlockers', blocks: [] });
  });

  // docs/ai.md:157-158. Phase A cast ladder: Hard must be able to veto Medium's blind wrath.
  it('Hard passes instead of following a blind wrath into its own winning board', () => {
    const game = wrathBoard(true);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    const brain = hard();
    // Pin the proposed baseline so this still proves Hard's veto after phase A
    // also teaches Medium to hold the wrath. Rollout brains remain unmocked.
    const baseline = (brain as unknown as { medium: MediumAI }).medium;
    vi.spyOn(baseline, 'chooseAction').mockReturnValueOnce({ type: 'castSpell', handIndex: 0 });
    expect(act(game, brain)).toEqual({ type: 'passStep' });
  });

  // docs/ai.md:74-75: Medium's planner obeys Skyborne and Warding Gaze legality.
  it('Medium blocks Skyborne only with Skyborne or Warding Gaze', () => {
    for (const defender of ['bear', 'flyer', 'archer']) {
      expect(act(blocks('flyer', [defender]))).toEqual({
        type: 'declareBlockers', blocks: defender === 'bear' ? [] : [{ blocker: 10, attacker: 20 }],
      });
    }
  });

  // docs/ai.md:67-75: highest-value removal choice is constrained by Untouchable.
  it('Medium never selects an Untouchable enemy as a removal target', () => {
    const game = fixture(['remove_three'], [...lands(3), body(20, 'hexproof_bear', 1), body(21, 'bear', 1)]);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(21)] });
  });

  // docs/ai.md:54-55,74-75: trade math prefers a Deathblade blocker to trade up.
  it('Medium prefers Deathblade to trade up into a giant', () => {
    expect(act(blocks('giant', ['bear', 'assassin']))).toEqual({
      type: 'declareBlockers', blocks: [{ blocker: 11, attacker: 20 }],
    });
  });

  // docs/ai.md:74-75: Overrun excess changes the planner's damage-through score.
  it('Medium counts Overrun excess when deciding to attack', () => {
    const personality = makePersonality({ attackThreshold: 1.5 });
    for (const card of ['plain_rhino', 'rhino']) {
      expect(act(attacks(card, [body(20, 'tok_fox', 1)]), new MediumAI(DB, personality)))
        .toEqual({ type: 'declareAttackers', attackers: card === 'rhino' ? [10] : [] });
    }
  });

  // docs/ai.md:54-55,74-75: firstBlade prevents a profitable-looking but impossible trade.
  it('Medium declines a blocker killed by firstBlade before it can strike', () => {
    expect(act(blocks('plain_knight', ['bear']))).toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 20 }] });
    expect(act(blocks('knight', ['bear']))).toEqual({ type: 'declareBlockers', blocks: [] });
  });

  // docs/ai.md:74-75. Phase C combat: twinBlades must contribute two unblocked hits.
  it.fails('Medium scores a twinBlades attacker as two hits', () => {
    const personality = makePersonality({ attackThreshold: 1.35 });
    checked(() => expect(act(attacks('bear'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [] }));
    expect(act(attacks('ds_bear'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [10] });
  });

  // docs/ai.md:74-75. Phase C combat: Sentinel remains available to block after attacking.
  it.fails('Medium does not tax Sentinel as tapped in the holdback term', () => {
    const personality = makePersonality({ attackThreshold: 0.7 });
    const board = (card: string) => attacks(card, [body(20, 'giant', 1, { tapped: true })], 6);
    checked(() => expect(act(board('plain_sentinel'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [] }));
    expect(act(board('sentinel'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [10] });
  });
});

describe('intended mechanics and draft behaviour', () => {
  // docs/ai.md:257. Phase B mechanics: sell eligible token fodder to unlock this turn's Tithe cast.
  it.fails('Medium sells a Kelp Shade token to cast an otherwise unaffordable Tithe Horror', () => {
    const game = fixture(['tithe_horror'], [...lands(3), body(10, 'tok-kelp-shade'), body(11, 'small_guard')], (state) => { state.step = 'main2'; });
    const intended: Action = { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [10] };
    requireLegal(game, intended);
    checked(() => expect(validateAction(game.instanceState, DB, 0, { type: 'castSpell', handIndex: 0 })).not.toBeNull());
    expect(act(game)).toEqual(intended);
  });

  // docs/ai.md:90-93 response coverage omits this window. Phase B mechanics owns Hauntlink moves before damage.
  it.fails('Medium moves Hauntlink in the revision-4 damage window to save its blocked attacker', () => {
    const game = checked(() => {
      const g = fixture([], [
        body(10, 'bear'), body(11, 'small_guard', 0, { attachments: [30] }),
        body(30, 'saving_link', 0, { attachedTo: 11 }), body(20, 'bear', 1),
      ]);
      g.submit(0, { type: 'passStep' });
      g.submit(0, { type: 'declareAttackers', attackers: [10] });
      g.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 20, attacker: 10 }] });
      // The ordinary response windows over the blocks come first (linkHaunt is legal there too);
      // the revision-4 Hauntlink window opens at the combat damage step once both seats pass.
      while (g.awaiting.kind === 'respond') g.submit(g.awaiting.player, { type: 'passResponse' });
      expect(g.awaiting).toEqual({ kind: 'hauntlinkWindow', player: 0, over: { type: 'combatDamage' } });
      const saved = Game.restore(structuredClone(g.instanceState), DB);
      saved.submit(0, { type: 'linkHaunt', iid: 30, hostIid: 10 });
      saved.submit(0, { type: 'passResponse' });
      expect(saved.viewFor(0).battlefield.some((p) => p.iid === 10)).toBe(true);
      const lost = Game.restore(structuredClone(g.instanceState), DB);
      lost.submit(0, { type: 'passResponse' });
      expect(lost.viewFor(0).battlefield.some((p) => p.iid === 10)).toBe(false);
      return g;
    });
    expect(act(game)).toEqual({ type: 'linkHaunt', iid: 30, hostIid: 10 });
  });

  // docs/ai.md:73-75 develop priority omits Duty. Phase B mechanics owns mana-Duty ordering.
  it.fails('Medium develops before a mana Duty that consumes the same main-two mana', () => {
    const game = fixture(['bear'], [...lands(2), body(10, 'mana_duty')], (state) => { state.step = 'main2'; });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    requireLegal(game, { type: 'activate', iid: 10 });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  const score = (id: string) => checked(() => scorePick(DB, id, [], DEFAULT_PICKER, pickNoise(41, 1, 0, 0, id)));

  // docs/ai.md:359-369. Phase D draft: a useful Duty rider has positive pick value.
  it.fails('Draft scores Duty-only text above an otherwise identical vanilla', () => {
    expect(score('draft_duty')).toBeGreaterThan(score('draft_vanilla'));
  });

  // docs/ai.md:359-369. Phase D draft: a useful Empower rider has positive pick value.
  it.fails('Draft scores Empower-only text above an otherwise identical vanilla', () => {
    expect(score('draft_empower')).toBeGreaterThan(score('draft_vanilla'));
  });

  // docs/ai.md:359-369. Phase D draft: Bulwark is a restriction and earns no keyword upside.
  it.fails('Draft gives Bulwark no positive keyword bonus', () => {
    expect(score('draft_bulwark')).toBeLessThanOrEqual(score('draft_vanilla'));
  });
});
