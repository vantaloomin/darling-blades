import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { HardAI } from '../../src/ai/HardAI';
import * as combatPlans from '../../src/ai/combatPlans';
import { makePersonality } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { getEffectiveStats } from '../../src/engine/statics';
import { activateActionValue, cardValue, permValue } from '../../src/ai/value';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { PlayerView } from '../../src/engine/view';
import { DEFAULT_PICKER, pickNoise, scorePick } from '../../src/meta/draftPicker';
import { act, attacks, blocks, body, checked, DB, fixture, invariantErrors, lands } from './documentedBehaviourFixture';
import { usageAuditGame } from './usageAuditFixture';

afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => {
  expect(invariantErrors, 'fixture/legality errors cannot satisfy it.fails').toEqual([]);
});

describe('documented public-board usage decisions', () => {
  // P5: Warchest cell 201405, game 3, turn 3 at feb4218c. The recorded
  // prefix reaches Medium's second turn after her normal land drop.
  it('Medium develops Seiðr-Weaver early while its extra land can accelerate later turns', () => {
    const game = checked(() => usageAuditGame('earlyRamp'));
    const view = game.viewFor(0);
    expect(view.battlefield.filter((p) => p.controller === 0 && CARD_DB[p.cardId].types.includes('land'))).toHaveLength(2);
    expect(view.you.landReserve).toHaveLength(8);
    const handIndex = view.you.hand.indexOf('rg-verdant-seidr');
    expect(game.legalActions(0)).toContainEqual({ type: 'castSpell', handIndex });
    expect(act(game, new MediumAI(CARD_DB), CARD_DB)).toEqual({ type: 'castSpell', handIndex });
    expect(game.viewFor(0).you.landDropsRemaining).toBe(1);
    expect(act(game, new MediumAI(CARD_DB), CARD_DB)).toMatchObject({ type: 'playLand' });
    expect(game.viewFor(0).you.landReserve).toHaveLength(7);
  });

  it.each([0, 1])('Medium values Seiðr-Weaver as its body alone with %i reserve land left', (remaining) => {
    const game = checked(() => usageAuditGame('earlyRamp'));
    const view = game.viewFor(0);
    view.you.landReserve = view.you.landReserve!.slice(0, remaining);
    const bodyOnly = { ...CARD_DB, 'rg-verdant-seidr': { ...CARD_DB['rg-verdant-seidr'], abilities: [] } };
    expect(cardValue(CARD_DB, 'rg-verdant-seidr', view)).toBe(cardValue(bodyOnly, 'rg-verdant-seidr', view));
    const action = new MediumAI(CARD_DB).chooseAction(view, game.legalActions(0));
    expect(action).toEqual({ type: 'castSpell', handIndex: view.you.hand.indexOf('rg-corpse-taker') });
  });

  // P4: Darlings cell 210102, game 87, turn 16, re-recorded at 4228aab9 after
  // the wave-4 tunes moved the audit's game 3. The deliberate
  // branch must call Gaia when it is the only cast; noise is disabled here.
  it('Easy calls her affordable Darling when she has no spell to cast', () => {
    const game = checked(() => usageAuditGame('darlingAlone'));
    const player = game.awaiting.kind === 'main' ? game.awaiting.player : 0;
    const legal = game.legalActions(player);
    expect(legal.some((action) => action.type === 'castDarling')).toBe(true);
    expect(legal.some((action) => action.type === 'castSpell')).toBe(false);
    expect(act(game, new EasyAI(CARD_DB, 41, makePersonality({ easyNoise: 0 })), CARD_DB))
      .toMatchObject({ type: 'castDarling' });
    expect(game.viewFor(player).you.darlingZone).toBeNull();
  });

  // P3: Darlings cell 211401, game 19, turn 18. Hel untaps next turn.
  it('Hard keeps the Abbess ready after combat instead of tapping an enemy that will untap', () => {
    const game = checked(() => usageAuditGame('afternoonTap'));
    const player = game.awaiting.kind === 'main' ? game.awaiting.player : 0;
    expect(game.legalActions(player)).toContainEqual({ type: 'activate', iid: 24, targets: [ref(13)] });
    const artoria = AVATARS.find((avatar) => avatar.id === 'artoria')!;
    const action = act(game, new HardAI(CARD_DB, artoria.personality), CARD_DB);
    expect(action).not.toMatchObject({ type: 'activate', iid: 24 });
    expect(game.state.battlefield.find((perm) => perm.iid === 24)?.tapped).toBe(false);
  });

  // P2: Warchest 202312/g2/t3 and avatars 2300/g7/t6, respectively.
  it.each(['mediumMark', 'hardMark'] as const)('%s holds Brood Communion until it has a creature to Mark', (position) => {
    const game = checked(() => usageAuditGame(position));
    const player = game.awaiting.kind === 'main' ? game.awaiting.player : 0;
    const view = game.viewFor(player);
    expect(view.battlefield.filter((perm) => perm.controller === player && CARD_DB[perm.cardId].types.includes('creature'))).toEqual([]);
    const handIndex = view.you.hand.indexOf('sb-brood-communion');
    expect(game.legalActions(player)).toContainEqual({ type: 'castSpell', handIndex });
    const brain = position === 'mediumMark' ? new MediumAI(CARD_DB) :
      new HardAI(CARD_DB, AVATARS.find((avatar) => avatar.id === 'chrome-broodmother')!.personality);
    expect(act(game, brain, CARD_DB)).toEqual({ type: 'passStep' });
    expect(cardValue(CARD_DB, 'sb-brood-communion', view)).toBeLessThanOrEqual(0);
    expect(game.viewFor(player).you.hand).toContain('sb-brood-communion');
  });

  // Wave 4, M1: Hooves and Fire's Warchest cell 200114, game 0, turn 14, at
  // e365cc0c. The Hornback survives the Charge's 1 and the Hoarder's blow.
  it('Medium casts Blaze-Horn Charge, whose first effect damages its own creature, at a pair it survives', () => {
    const game = checked(() => usageAuditGame('blazeHorn'));
    const handIndex = game.viewFor(1).you.hand.indexOf('fd-blaze-horn-charge');
    const action = act(game, new MediumAI(CARD_DB), CARD_DB) as Extract<Action, { type: 'castSpell' }>;
    expect(action).toMatchObject({ type: 'castSpell', handIndex });
    const [hunter, prey] = action.targets!.map((target) => target.kind === 'permanent' ? target.iid : -1);
    while (game.awaiting.kind === 'respond') game.submit(game.awaiting.player, { type: 'passResponse' });
    expect(game.state.stack).toEqual([]);
    expect(game.state.battlefield.some((perm) => perm.iid === hunter)).toBe(true);
    expect(game.state.battlefield.some((perm) => perm.iid === prey)).toBe(false);
  });

  // Wave 4, M3: Warchest cell 200514, game 3, turn 22, at e365cc0c. Every
  // Hunt pair loses the 2/3 to Zhurong's 4/3 without the kill.
  it('Medium holds Spear and Fang when its Hunt would lose the hunter without the kill', () => {
    const game = checked(() => usageAuditGame('lostHunt'));
    const handIndex = game.viewFor(0).you.hand.indexOf('fd-spear-and-fang');
    expect(game.legalActions(0).some((action) => action.type === 'castSpell' && action.handIndex === handIndex)).toBe(true);
    expect(act(game, new MediumAI(CARD_DB), CARD_DB)).not.toMatchObject({ type: 'castSpell', handIndex });
  });

  // Wave 4, Trial by Ember: Hera's (Medium) Darlings cell 210402, game 4,
  // turn 4, and the Shepherdess's (Hard) cell 212700, game 12, turn 2,
  // re-recorded at 4228aab9 after the themed builder replaced her list.
  it.each(['emptyTrial', 'hardTrial'] as const)('%s: the boss holds Trial by Ember with no creature of its own', (position) => {
    const game = checked(() => usageAuditGame(position));
    const player = game.awaiting.kind === 'main' ? game.awaiting.player : 0;
    const view = game.viewFor(player);
    expect(view.battlefield.filter((perm) => perm.controller === player && CARD_DB[perm.cardId].types.includes('creature'))).toEqual([]);
    const handIndex = view.you.hand.indexOf('fd-trial-by-ember');
    expect(game.legalActions(player)).toContainEqual({ type: 'castSpell', handIndex });
    const brain = position === 'emptyTrial'
      ? new MediumAI(CARD_DB, AVATARS.find((avatar) => avatar.id === 'hera')!.personality)
      : new HardAI(CARD_DB, AVATARS.find((avatar) => avatar.id === 'the-shepherdess-of-giants')!.personality);
    expect(act(game, brain, CARD_DB)).not.toMatchObject({ type: 'castSpell', handIndex });
  });

  // Section 4 permits a constructed position: no audit list has Apotheosis.
  it.each(['medium', 'hard'] as const)('%s saves Apotheosis for its Marked creatures and still develops a payoff body', (difficulty) => {
    const brain = () => difficulty === 'medium' ? medium() : hard();
    for (const marked of [false, true]) {
      const game = fixture(['sb-starborne-apotheosis'], [body(100, 'plains'), body(101, 'plains'),
        body(10, 'giant', 0, { plusOneCounters: marked ? 1 : 0 })], (state) => { state.players[1].life = 8; });
      requireLegal(game, { type: 'castSpell', handIndex: 0 });
      expect(act(game, brain())).toEqual(marked ? { type: 'castSpell', handIndex: 0 } : { type: 'passStep' });
    }
    const bodyGame = fixture(['sb-rootlight-broodmother'], lands(6));
    expect(act(bodyGame, brain())).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });

  it('Medium spends Reef Bloom for its independent Foresee even without creatures', () => {
    const reef = fixture(['dd-reef-bloom'], lands(2));
    expect(act(reef)).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(reef.awaiting.kind).toBe('foresee');
  });

  // U2's four sites have code evidence, rather than an audit matrix cell.
  it('Medium grants Skyborne to the creature that can deal more damage', () => {
    const game = fixture([], [body(10, 'small_guard'), body(11, 'giant'), body(30, 'grant_flight')]);
    expect(act(game)).toEqual({ type: 'activate', iid: 30, targets: [ref(11)] });
    expect(getEffectiveStats(game.state.battlefield, DB, 11).keywords.has('skyborne')).toBe(true);
    expect(getEffectiveStats(game.state.battlefield, DB, 10).keywords.has('skyborne')).toBe(false);
    const alreadyFlying = fixture([], [body(10, 'small_guard'), body(11, 'giant', 0,
      { untilEotMods: [{ p: 0, t: 0, keywords: ['skyborne'] }] }), body(30, 'grant_flight')]);
    expect(act(alreadyFlying)).toEqual({ type: 'activate', iid: 30, targets: [ref(10)] });
  });

  it.each(['sunset', 'empower'] as const)('Medium prefers %s Deathblade on a small body and Skyborne on a large body', (rider) => {
    for (const [size, first, wanted] of [['one', 'flight', 'death'], ['five', 'death', 'flight']] as const) {
      const game = fixture([`${rider}_${first}_${size}`, `${rider}_${wanted}_${size}`], lands(3));
      expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 1,
        ...(rider === 'empower' ? { empowered: true } : {}) });
    }
  });

  it('Medium removes the Skyborne grant on the larger enemy body first', () => {
    const game = fixture(['remove_engine'], [body(20, 'small_guard', 1), body(21, 'giant', 1),
      body(30, 'grant_aura', 1, { attachedTo: 20 }), body(31, 'grant_aura', 1, { attachedTo: 21 })]);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(31)] });
  });

  it('Medium removes the hostile Bulwark grant from its larger body first', () => {
    const game = fixture(['remove_engine'], [body(20, 'small_guard'), body(21, 'giant'),
      body(30, 'prison_aura', 1, { attachedTo: 20 }), body(31, 'prison_aura', 1, { attachedTo: 21 })]);
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(31)] });
  });

  it('Medium values Overrun on the tokens a spell creates before granting it', () => {
    const game = fixture(['plain_stampede', 'fd-stampede-long-grass'], [...lands(2), body(102, 'plains')]);
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 1 });
  });
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
  it('Hard never moves a fourth blocker onto an existing gang', () => {
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
  it('Medium scores a twinBlades attacker as two hits', () => {
    const personality = makePersonality({ attackThreshold: 1.35 });
    checked(() => expect(act(attacks('bear'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [] }));
    expect(act(attacks('ds_bear'), new MediumAI(DB, personality)))
      .toEqual({ type: 'declareAttackers', attackers: [10] });
  });

  // docs/ai.md:74-75. Phase C combat: Sentinel remains available to block after attacking.
  it('Medium does not tax Sentinel as tapped in the holdback term', () => {
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
  it('Medium sells a Kelp Shade token to cast an otherwise unaffordable Tithe Horror', () => {
    const game = fixture(['tithe_horror'], [...lands(3), body(10, 'tok-kelp-shade'), body(11, 'small_guard')], (state) => { state.step = 'main2'; });
    const intended: Action = { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [10] };
    requireLegal(game, intended);
    checked(() => expect(validateAction(game.instanceState, DB, 0, { type: 'castSpell', handIndex: 0 })).not.toBeNull());
    expect(act(game)).toEqual(intended);
  });

  // docs/ai.md:90-93 response coverage omits this window. Phase B mechanics owns Hauntlink moves before damage.
  it('Medium moves Hauntlink in the revision-4 damage window to save its blocked attacker', () => {
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
  it('Medium develops before a mana Duty that consumes the same main-two mana', () => {
    const game = fixture(['bear'], [...lands(2), body(10, 'mana_duty')], (state) => { state.step = 'main2'; });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    requireLegal(game, { type: 'activate', iid: 10 });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // A paid tapper Duty beside our giant, facing their untapped giant: the
  // planner keeps the attack home (an even trade) unless the blocker is tapped.
  function blockedGiant(hand: string[] = [], mana = 2, oppLife = 20, enemy = 'giant'): Game {
    return fixture(hand, [...lands(mana), body(10, 'giant'), body(20, enemy, 1), body(30, 'tap_duty')],
      (state) => { state.players[1].life = oppLife; });
  }
  const tapBlocker: Action = { type: 'activate', iid: 30, targets: [ref(20)] };

  // docs/ai.md, Duty timing: a paid Duty moves into main one when it changes the attack.
  it('Medium taps a blocker with a paid Duty in main one, then attacks through it', () => {
    const game = blockedGiant();
    checked(() => expect(combatPlans.chooseAttackers(game.viewFor(0).battlefield, DB, 0, 20, 0)).toEqual([]));
    requireLegal(game, tapBlocker);
    expect(act(game)).toEqual(tapBlocker);
    expect(act(game)).toEqual({ type: 'passStep' });
    expect(act(game)).toEqual({ type: 'declareAttackers', attackers: [10] });
  });

  // docs/ai.md, Duty timing: an attack that already works leaves the paid Duty for main two.
  it('Medium keeps a paid Duty for main two when the attack goes through without it', () => {
    const game = blockedGiant([], 2, 20, 'bear');
    requireLegal(game, tapBlocker);
    checked(() => expect(combatPlans.chooseAttackers(game.viewFor(0).battlefield, DB, 0, 20, 0)).toEqual([10]));
    expect(act(game)).toEqual({ type: 'passStep' });
  });

  // docs/ai.md, Duty timing: a better spell this turn keeps the mana the Duty would spend.
  it('Medium casts the better spell rather than spend its mana on a pre-combat Duty', () => {
    const game = blockedGiant(['giant'], 4);
    requireLegal(game, tapBlocker);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md, Duty timing: a Duty that makes the attack lethal outranks any spell.
  it('Medium spends the mana on a pre-combat Duty that makes the attack lethal', () => {
    const game = blockedGiant(['giant'], 4, 4);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toEqual(tapBlocker);
  });

  // docs/ai.md, Duty timing: the lethal Duty sits right after the lethal-spell check, ahead of removal.
  it('Medium and Hard take a lethal pre-combat Duty ahead of removal on a bigger target', () => {
    // At 4 life, tapping the only untapped blocker lets our giant connect for
    // the game; the removal would rather kill their bigger, tapped creature,
    // and both together cost more than the four lands.
    const board = () => fixture(['remove_three'], [...lands(4), body(10, 'giant'), body(20, 'giant', 1),
      body(21, 'cap_attacker', 1, { tapped: true }), body(30, 'tap_duty')], (state) => { state.players[1].life = 4; });
    requireLegal(board(), { type: 'castSpell', handIndex: 0, targets: [ref(21)] });
    requireLegal(board(), tapBlocker);
    for (const brain of [medium(), hard()]) expect(act(board(), brain)).toEqual(tapBlocker);
  });

  // docs/ai.md, Duty timing: every target that can reach the fight is screened for lethal, not only the best by impact.
  it('Medium and Hard take a lethal pre-combat Duty on its lower-value target', () => {
    // At 1 life their bear is the removal target by impact, but killing it
    // leaves the 0/4 wall to absorb our 4/4 Overrun rhino; killing the wall
    // lets the bear's block spill two through.
    const board = () => fixture([], [...lands(2), body(10, 'rhino'), body(20, 'bear', 1), body(21, 'wall', 1),
      body(30, 'kill_duty')], (state) => { state.players[1].life = 1; });
    const killBear: Action = { type: 'activate', iid: 30, targets: [ref(20)] };
    const killWall: Action = { type: 'activate', iid: 30, targets: [ref(21)] };
    requireLegal(board(), killWall);
    checked(() => {
      const view = board().viewFor(0);
      expect(activateActionValue(view, DB, killBear)).toBeGreaterThan(activateActionValue(view, DB, killWall));
    });
    for (const brain of [medium(), hard()]) expect(act(board(), brain)).toEqual(killWall);
  });

  // docs/ai.md, Duty timing: a lethal Duty comes before Preserve and a Hauntlink link, which spend its mana too.
  it('Medium and Hard take a lethal pre-combat Duty with an empty hand, ahead of Preserve and a Hauntlink link', () => {
    // Opponent at 4, one untapped blocker. The empty hand used to leave the
    // ladder no cast step, so Preserve (and, on the second board, the link
    // step that runs first) spent the Duty's mana.
    const preserve = () => fixture([], [...lands(2), body(10, 'giant'), body(20, 'giant', 1), body(30, 'tap_duty')],
      (state) => { state.players[1].life = 4; state.players[0].graveyard = ['preserve_bear']; });
    const link = () => fixture([], [...lands(3), body(10, 'giant'), body(20, 'giant', 1), body(30, 'tap_duty'),
      body(31, 'cost_link')], (state) => { state.players[1].life = 4; });
    requireLegal(preserve(), { type: 'preserveCard', graveIndex: 0 });
    requireLegal(link(), { type: 'linkHaunt', iid: 31, hostIid: 10 });
    for (const board of [preserve, link]) {
      for (const brain of [medium(), hard()]) expect(act(board(), brain)).toEqual(tapBlocker);
    }
  });

  // docs/ai.md, Duty timing: damage main two deals just as well is no reason to spend a spell's mana now.
  it('Medium develops rather than ping the face before combat, on either side of the twelve-life knee', () => {
    // The ping does the same point in main two; two giants swing into an
    // empty board either way. The knee in the attack weights must not read
    // the thirteenth point as combat value.
    for (const life of [20, 13]) {
      const game = fixture(['bear'], [...lands(2), body(10, 'giant'), body(11, 'giant'), body(30, 'ping_duty')],
        (state) => { state.players[1].life = life; });
      requireLegal(game, { type: 'activate', iid: 30 });
      expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
    }
  });

  // docs/ai.md, Duty timing: a kill that changes nothing in the fight is no reason either.
  it('Medium develops rather than kill a creature before combat that would not block', () => {
    // Their 1/1 will not block two giants at 20 life, so killing it first
    // changes only the creature count the attack weights read.
    const game = fixture(['small_guard'], [...lands(2), body(10, 'giant'), body(11, 'giant'),
      body(20, 'small_guard', 1), body(30, 'zap_duty')]);
    requireLegal(game, { type: 'activate', iid: 30, targets: [ref(20)] });
    checked(() => expect(combatPlans.chooseAttackers(game.viewFor(0).battlefield, DB, 0, 20, 0)).toEqual([10, 11]));
    expect(act(game)).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md, Duty timing: Hard plays the pre-combat Duty through the counterattack and keeps it.
  it('Hard keeps a pre-combat tap whose attack wins the race', () => {
    expect(act(blockedGiant([], 2, 8), hard())).toEqual(tapBlocker);
  });

  // At 8 life, with their second giant tapped from last turn, tapping the
  // blocker and swinging leaves our giant tapped for their 8-power reply.
  const race = (hand: string[] = [], mana = 2) => fixture(hand, [...lands(mana), body(10, 'giant'), body(20, 'giant', 1),
    body(21, 'giant', 1, { tapped: true }), body(30, 'tap_duty')], (state) => { state.players[0].life = 8; });

  // docs/ai.md, Duty timing: the same check vetoes a tap whose attack loses the counterattack.
  it('Hard declines a pre-combat tap when the attack it enables loses the race', () => {
    checked(() => expect(act(race())).toEqual(tapBlocker));
    expect(act(race(), hard())).toEqual({ type: 'passStep' });
  });

  // docs/ai.md, Duty timing: a declined Duty leaves its mana to Medium's next choice, not to a pass.
  it('Hard casts what a declined pre-combat Duty was crowding out', () => {
    checked(() => expect(act(race(['bear'], 4))).toEqual(tapBlocker));
    expect(act(race(['bear'], 4), hard())).toEqual({ type: 'castSpell', handIndex: 0 });
  });

  // docs/ai.md, Easy: its paid Duties keep the simple Afternoon timing.
  it('Easy leaves a paid Duty for main two even when it would clear a blocker', () => {
    const game = blockedGiant();
    requireLegal(game, tapBlocker);
    expect(act(game, new EasyAI(DB, 41, makePersonality({ easyNoise: 0 })))).toEqual({ type: 'passStep' });
  });

  const score = (id: string) => checked(() => scorePick(DB, id, [], DEFAULT_PICKER, pickNoise(41, 1, 0, 0, id)));

  // docs/ai.md:359-369. Phase D draft: a useful Duty rider has positive pick value.
  it('Draft scores Duty-only text above an otherwise identical vanilla', () => {
    expect(score('draft_duty')).toBeGreaterThan(score('draft_vanilla'));
  });

  // docs/ai.md:359-369. Phase D draft: a useful Empower rider has positive pick value.
  it('Draft scores Empower-only text above an otherwise identical vanilla', () => {
    expect(score('draft_empower')).toBeGreaterThan(score('draft_vanilla'));
  });

  // docs/ai.md:359-369. Phase D draft: Bulwark is a restriction and earns no keyword upside.
  it('Draft gives Bulwark no positive keyword bonus', () => {
    expect(score('draft_bulwark')).toBeLessThanOrEqual(score('draft_vanilla'));
  });
});
