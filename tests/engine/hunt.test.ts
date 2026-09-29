import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { legalActions } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { enumerateTargets } from '../../src/engine/effects/targeting';
import { fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import { resolveStackItem } from '../../src/engine/resolve';
import { checkStateBased } from '../../src/engine/sba';
import type { AbilityDef, CardDb, CardDef, GameState, HuntPrey, Keyword, Permanent, TargetRef, TargetSpec } from '../../src/engine/types';
import { validateEmpowerDef, validateHuntDef } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

// Hunt (plan-first-dawn-engine.md, Part 2, as ruled by the owner in E2-E5 and
// the bare-keyword ruling of 2026-09-28): the hunter and its prey each deal
// damage equal to their Attack to the other, through the shared
// creature-damage path. A Hunt's prey is a creature an opponent controls
// (ruled 2026-09-28, no fallback), unless the card declares its own (`any`,
// `yours`).

/** The default prey spec, as card data carries it. */
const PREY: TargetSpec = { what: 'opponentCreature' };
/** The `any` override's prey spec. */
const ANY_PREY: TargetSpec = { what: 'creature', other: true };
const HUNT_SPELL_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, PREY];
const ANY_SPELL_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, ANY_PREY];
/** "Target creature you control Hunts. Draw a card." */
const stalk = spell('stalk', [{ op: 'hunt', hunter: 'target' }, { op: 'draw', n: 1 }], HUNT_SPELL_TARGETS);
/** "Target creature you control Hunts any other creature." (the `any` override) */
const stalkAny = spell('stalkAny', [{ op: 'hunt', hunter: 'target', prey: 'any' }], ANY_SPELL_TARGETS);
/** "Target creature you control gets +2/+2 until end of turn, then it Hunts." */
const fang = spell('fang', [{ op: 'boost', p: 2, t: 2, scope: 'target' }, { op: 'hunt', hunter: 'target' }], HUNT_SPELL_TARGETS);
const body = (id: string, attack: number, defense: number, keywords: Keyword[] = [], extra: Partial<CardDef> = {}) =>
  card(id, { attack, defense, keywords, ...extra });

const damageOf = (state: GameState, iid: number) => state.battlefield.find((p) => p.iid === iid)?.damage;
const onBoard = (state: GameState, iid: number) => state.battlefield.some((p) => p.iid === iid);

/** Run a spell-form Hunt's ops as the resolving spell does, then its state-based check. */
function huntNow(state: GameState, db: CardDb, hunter: number, prey: number, specs: TargetSpec[] = HUNT_SPELL_TARGETS): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (e) => events.push(e), {
    controller: 0, sourceCardId: 'stalk', targets: [ref(hunter), ref(prey)], targetSpecs: specs,
  }, [{ op: 'hunt', hunter: 'target' }]);
  checkStateBased(state, db, (e) => events.push(e));
  return events;
}

function castTargets(state: GameState, db: CardDb): TargetRef[][] {
  return legalActions(state, db, 0)
    .filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell')
    .map((a) => a.targets ?? []);
}

describe('Hunt: the exchange', () => {
  it('both deal their effective Attack, at once', () => {
    const db = dbOf(body('h', 2, 5), body('p', 3, 3), stalk);
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    state.battlefield[0].untilEotMods.push({ p: 1, t: 0, keywords: [] });
    huntNow(state, db, 1, 2);
    expect(onBoard(state, 2)).toBe(false); // 3 damage to a 3/3
    expect(damageOf(state, 1)).toBe(3);
  });

  it('two creatures that are lethal to each other both die', () => {
    const db = dbOf(body('h', 3, 3), body('p', 3, 3));
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    huntNow(state, db, 1, 2);
    expect(state.battlefield).toEqual([]);
  });

  it('a pump earlier in the same spell counts', () => {
    const db = dbOf(body('h', 2, 2), body('p', 3, 3), fang);
    const game = Game.restore(board([['fang'], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(2)] });
    const st = game.instanceState;
    expect(onBoard(st, 2)).toBe(false); // the hunter dealt 4
    expect(damageOf(st, 1)).toBe(3); // a 4/4 survives the prey's 3
  });

  it('a creature with 0 Attack deals nothing', () => {
    const db = dbOf(body('h', 0, 3), body('p', 2, 2));
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    const events = huntNow(state, db, 1, 2);
    expect(damageOf(state, 2)).toBe(0);
    expect(damageOf(state, 1)).toBe(2);
    expect(events.filter((e) => e.e === 'damageMarked').map((e) => e.e === 'damageMarked' && e.iid)).toEqual([1]);
  });

  it.each([['hunter', 1], ['prey', 2]] as const)('with the %s gone at resolution nothing is dealt, and the spell\'s other ops still happen', (_, gone) => {
    const db = dbOf(body('h', 3, 3), body('p', 3, 3), stalk);
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    state.battlefield = state.battlefield.filter((p) => p.iid !== gone);
    const handBefore = state.players[0].hand.length;
    const events: GameEvent[] = [];
    resolveStackItem(state, db, { sid: 1, cardId: 'stalk', controller: 0, targets: [ref(1), ref(2)] }, (e) => events.push(e));
    expect(events.some((e) => e.e === 'damageMarked')).toBe(false);
    expect(events.some((e) => e.e === 'hunted')).toBe(false);
    expect(state.players[0].hand).toHaveLength(handBefore + 1);
  });

  it('with both gone the spell fizzles as a whole', () => {
    const db = dbOf(body('h', 3, 3), body('p', 3, 3), stalk);
    const state = board([[], []], []);
    const events: GameEvent[] = [];
    resolveStackItem(state, db, { sid: 1, cardId: 'stalk', controller: 0, targets: [ref(1), ref(2)] }, (e) => events.push(e));
    expect(events).toContainEqual({ e: 'targetsFizzled', sid: 1 });
  });

  it('a prey that turned illegal (an opponent\'s creature gained Untouchable) is not hunted', () => {
    const db = dbOf(body('h', 3, 5), body('p', 3, 3), stalk);
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    state.battlefield[1].untilEotMods.push({ p: 0, t: 0, keywords: ['untouchable'] });
    const handBefore = state.players[0].hand.length;
    resolveStackItem(state, db, { sid: 1, cardId: 'stalk', controller: 0, targets: [ref(1), ref(2)] }, () => {});
    expect(damageOf(state, 1)).toBe(0);
    expect(damageOf(state, 2)).toBe(0);
    expect(state.players[0].hand).toHaveLength(handBefore + 1);
  });
});

describe('Hunt: targeting (its own rules, E2)', () => {
  const db = dbOf(body('h', 2, 2), body('wall', 0, 6, ['bulwark']), body('p', 2, 2), body('ghost', 2, 2, ['untouchable']), stalk, stalkAny);
  const board3 = (hand: string) => board([[hand], []], [
    { iid: 1, cardId: 'h' }, { iid: 2, cardId: 'wall' }, { iid: 3, cardId: 'wall', controller: 1 },
  ]);

  it('legal actions never offer a Bulwark hunter or one creature in both slots', () => {
    const lists = castTargets(board3('stalkAny'), db);
    expect(lists.length).toBeGreaterThan(0);
    for (const [hunter, prey] of lists) {
      expect(hunter).not.toEqual(ref(2));
      expect(hunter).not.toEqual(prey);
    }
    // A Bulwark creature can be prey, on either side under `any`.
    expect(lists).toContainEqual([ref(1), ref(2)]);
    expect(lists).toContainEqual([ref(1), ref(3)]);
    // The default prey is only the opponent's.
    expect(castTargets(board3('stalk'), db)).toEqual([[ref(1), ref(3)]]);
  });

  it('refuses a submitted Bulwark hunter or a creature hunting itself', () => {
    const game = Game.restore(board3('stalkAny'), db);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(2), ref(3)] })).toThrow(/Bulwark/);
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(1)] })).toThrow(/two different/);
  });

  it('a hunter that gains Bulwark before resolution deals nothing', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 3, cardId: 'p', controller: 1 }]);
    state.battlefield[0].untilEotMods.push({ p: 0, t: 0, keywords: ['bulwark'] });
    huntNow(state, db, 1, 3);
    expect(damageOf(state, 1)).toBe(0);
    expect(damageOf(state, 3)).toBe(0);
  });

  it('an opponent\'s Untouchable creature is not legal prey; your own is, under `any`', () => {
    const state = board([['stalkAny'], []], [
      { iid: 1, cardId: 'h' }, { iid: 2, cardId: 'ghost' }, { iid: 3, cardId: 'ghost', controller: 1 },
    ]);
    const preys = castTargets(state, db).map(([, prey]) => prey);
    expect(preys).toContainEqual(ref(2));
    expect(preys).not.toContainEqual(ref(3));
    state.players[0].hand = ['stalk'];
    expect(castTargets(state, db)).toEqual([]);
  });
});

describe('Hunt: keywords through the shared damage path', () => {
  it.each([['the hunter', 'h'], ['the prey', 'p']] as const)('Deathblade on %s kills the other', (_, who) => {
    const db = dbOf(body('h', 1, 5, who === 'h' ? ['deathblade'] : []), body('p', 1, 5, who === 'p' ? ['deathblade'] : []));
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    huntNow(state, db, 1, 2);
    expect(onBoard(state, who === 'h' ? 2 : 1)).toBe(false);
    expect(onBoard(state, who === 'h' ? 1 : 2)).toBe(true);
  });

  it('Blood Oath gains its controller the damage dealt', () => {
    const db = dbOf(body('h', 3, 5, ['bloodoath']), body('p', 1, 5));
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    huntNow(state, db, 1, 2);
    expect(state.players.map((p) => p.life)).toEqual([23, 20]);
  });

  it('First Blade does not split the exchange, and Twin Blades does not double it', () => {
    const db = dbOf(body('fb', 3, 3, ['firstBlade']), body('tb', 2, 9, ['twinBlades']), body('p', 3, 3));
    const first = board([[], []], [{ iid: 1, cardId: 'fb' }, { iid: 2, cardId: 'p', controller: 1 }]);
    huntNow(first, db, 1, 2);
    expect(first.battlefield).toEqual([]);
    const twin = board([[], []], [{ iid: 1, cardId: 'tb' }, { iid: 2, cardId: 'p', controller: 1 }]);
    huntNow(twin, db, 1, 2);
    expect(damageOf(twin, 2)).toBe(2);
  });

  it('a fog and "prevent combat damage to" do not stop it', () => {
    const db = dbOf(body('h', 2, 5), body('p', 2, 5));
    const state = board([[], []], [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }]);
    state.fogThisTurn = true;
    state.battlefield[1].combatDamagePrevented = true;
    huntNow(state, db, 1, 2);
    expect(damageOf(state, 2)).toBe(2);
    expect(damageOf(state, 1)).toBe(2);
  });

  it('a self-hunt (the `any` override) provokes both survivors', () => {
    const angry = (id: string) => body(id, 1, 4, [], { abilities: [{ when: 'provoked', ops: [{ op: 'gainLife', n: 2 }] }] });
    const db = dbOf(angry('a'), angry('b'));
    const state = board([[], []], [{ iid: 1, cardId: 'a' }, { iid: 2, cardId: 'b' }]);
    const events = huntNow(state, db, 1, 2, ANY_SPELL_TARGETS);
    expect(events.filter((e) => e.e === 'triggerFired' && e.when === 'provoked').map((e) => e.e === 'triggerFired' && e.iid)).toEqual([1, 2]);
    expect(state.players[0].life).toBe(24);
  });
});

describe('Hunt: its carriers', () => {
  const tracker = body('tracker', 3, 3, [], {
    activated: { cost: { tap: true }, targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] },
  });
  /** Not card data (the validator refuses it): a bare `creature` spec, so only
   * the Duty's own rule keeps the hunter out of its prey. */
  const looseTracker = { ...tracker, id: 'loose', activated: { ...tracker.activated as object, targets: [{ what: 'creature' }] } } as CardDef;
  const huntDuties = (state: GameState, db: CardDb) => legalActions(state, db, 0).filter((a) => a.type === 'activate');

  it('a Duty Hunt is refused tapped, or newly arrived without Warcry', () => {
    const db = dbOf(tracker, { ...tracker, id: 'eager', keywords: ['warcry'] }, body('p', 1, 1));
    const offered = (patch: object, cardId = 'tracker') =>
      huntDuties(board([[], []], [{ iid: 1, cardId, ...patch }, { iid: 2, cardId: 'p', controller: 1 }]), db).length > 0;
    expect(offered({})).toBe(true);
    expect(offered({ tapped: true })).toBe(false);
    expect(offered({ enteredThisTurn: true })).toBe(false);
    expect(offered({ enteredThisTurn: true }, 'eager')).toBe(true);
  });

  it('a Duty Hunt is never offered to a creature that has Bulwark, and never offers the hunter as its own prey', () => {
    const db = dbOf(looseTracker, body('p', 1, 1));
    const state = board([[], []], [{ iid: 1, cardId: 'loose' }, { iid: 2, cardId: 'p', controller: 1 }]);
    const duties = huntDuties(state, db);
    expect(duties.map((a) => a.type === 'activate' && a.targets)).toEqual([[ref(2)]]);
    state.battlefield[0].untilEotMods.push({ p: 0, t: 0, keywords: ['bulwark'] });
    expect(huntDuties(state, db)).toEqual([]);
  });

  it('a Duty Hunt taps its hunter and deals the exchange', () => {
    const db = dbOf(tracker, body('p', 1, 3));
    const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'tracker' }, { iid: 2, cardId: 'p', controller: 1 }]), db);
    game.submit(0, { type: 'activate', iid: 1, targets: [ref(2)] });
    expect(onBoard(game.instanceState, 2)).toBe(false);
    expect(game.instanceState.battlefield.find((p) => p.iid === 1)).toMatchObject({ tapped: true, damage: 1 });
  });

  it('a spell Hunt works with a tapped hunter', () => {
    const db = dbOf(body('h', 3, 5), body('p', 1, 3), stalk);
    const state = board([['stalk'], []], [{ iid: 1, cardId: 'h', tapped: true }, { iid: 2, cardId: 'p', controller: 1 }]);
    expect(castTargets(state, db)).toContainEqual([ref(1), ref(2)]);
    const game = Game.restore(state, db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(1), ref(2)] });
    expect(onBoard(game.instanceState, 2)).toBe(false);
  });

  describe('Empower (E4, E5)', () => {
    const raptor = body('raptor', 3, 3, [], {
      abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
      empower: { cost: { generic: 0, pips: {} }, targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] },
    });
    const db = dbOf(raptor, body('p', 1, 2));

    it('may Hunt, and the rider resolves after the creature\'s arrival triggers', () => {
      expect(validateEmpowerDef(raptor)).toEqual([]);
      const game = Game.restore(board([['raptor'], []], [{ iid: 2, cardId: 'p', controller: 1 }]), db);
      const cast = game.legalActions(0).find((a) => a.type === 'castSpell' && a.empowered)!;
      expect(cast).toMatchObject({ targets: [ref(2)] });
      const events = game.submit(0, cast);
      const arrival = events.findIndex((e) => e.e === 'triggerFired' && e.when === 'arrives');
      const hunted = events.findIndex((e) => e.e === 'hunted');
      expect(arrival).toBeGreaterThanOrEqual(0);
      expect(hunted).toBeGreaterThan(arrival);
      expect(onBoard(game.instanceState, 2)).toBe(false);
    });

    it('an empowered creature whose prey has left still resolves; only the rider is lost', () => {
      const state = board([[], []], []);
      const events: GameEvent[] = [];
      resolveStackItem(state, db, { sid: 1, cardId: 'raptor', controller: 0, targets: [ref(2)], empowered: true }, (e) => events.push(e));
      expect(events).not.toContainEqual({ e: 'targetsFizzled', sid: 1 });
      expect(state.battlefield.map((p) => p.cardId)).toEqual(['raptor']);
      expect(state.players[0].life).toBe(22);
      expect(events.some((e) => e.e === 'hunted')).toBe(false);
    });

    it('an empowered destroy creature (The Drowned Saint\'s shape) whose target has left still enters', () => {
      const saint = body('saint', 2, 2, [], {
        empower: { cost: { generic: 0, pips: {} }, targets: [{ what: 'creature', maxCost: 3 }], ops: [{ op: 'destroy', to: 'target' }] },
      });
      const state = board([[], []], [{ iid: 3, cardId: 'p', controller: 1 }]);
      resolveStackItem(state, dbOf(saint, body('p', 1, 2)), { sid: 1, cardId: 'saint', controller: 0, targets: [ref(2)], empowered: true }, () => {});
      expect(state.battlefield.map((p) => p.cardId)).toEqual(['p', 'saint']);
    });
  });
});

describe('Hunt: whose prey (the default, ruled 2026-09-28)', () => {
  // "When this arrives, Hunt.": fixture cards, not the overplan rows.
  const HUNT_TRIGGER: AbilityDef = { when: 'arrives', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] };
  const stalker = body('stalker', 4, 2, [], { abilities: [HUNT_TRIGGER] });
  const db = dbOf(stalker, body('mine', 1, 1), body('theirs', 1, 1), body('ghost', 1, 1, ['untouchable']));
  const offered = (battlefield: Parameters<typeof board>[1]) =>
    enumerateTargets(board([[], []], battlefield), db, 0, PREY, 1);

  it('offers only the opponent\'s creatures, never your own', () => {
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }, { iid: 4, cardId: 'theirs', controller: 1 }]))
      .toEqual([ref(3), ref(4)]);
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }])).toEqual([]);
  });

  it('never offers an opponent\'s Untouchable creature', () => {
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 3, cardId: 'ghost', controller: 1 }])).toEqual([]);
  });

  it('an arrival that is not a cast fires the Hunt as an ordinary targeted trigger, and with no legal prey does nothing', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }]);
    fireTriggers(state, db, () => {}, 'arrives', state.battlefield[0]);
    expect(state.pendingDecisions).toMatchObject([{ kind: 'chooseTarget', sourceIid: 1, spec: PREY }]);
    const alone = board([[], []], [{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'ghost', controller: 1 }]);
    fireTriggers(alone, db, () => {}, 'arrives', alone.battlefield[0]);
    expect(alone.pendingDecisions).toEqual([]);
  });

  it('a source-bound Hunt is never printed on a Bulwark creature, nor as a Provoked effect', () => {
    expect(validateHuntDef(stalker)).toEqual([]);
    expect(validateHuntDef({ ...stalker, keywords: ['bulwark'] }).length).toBeGreaterThan(0);
    expect(validateHuntDef({ ...card('angry'), abilities: [{ when: 'provoked', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] }] }).length).toBeGreaterThan(0);
    expect(validateHuntDef(stalk)).toEqual([]);
  });

  const loose: TargetSpec = { what: 'creature', other: true };
  const bound = (when: AbilityDef['when'], prey: TargetSpec): CardDef =>
    body(`bound-${when}`, 3, 3, [], { abilities: [{ when, targets: [prey], ops: [{ op: 'hunt', hunter: 'self' }] }] });
  const carriers: [string, (prey: TargetSpec) => CardDef][] = [
    ['spell', (prey) => spell('s', [{ op: 'hunt', hunter: 'target' }], [{ what: 'yourCreature' }, prey])],
    ['arrival', (prey) => bound('arrives', prey)],
    ['attack', (prey) => bound('attacks', prey)],
    ['Dawn', (prey) => bound('dawn', prey)],
    ['Duty', (prey) => body('d', 3, 3, [], { activated: { cost: { tap: true }, targets: [prey], ops: [{ op: 'hunt', hunter: 'self' }] } })],
    ['Empower', (prey) => body('e', 3, 3, [], { empower: { cost: { generic: 1, pips: {} }, targets: [prey], ops: [{ op: 'hunt', hunter: 'self' }] } })],
  ];

  it.each(carriers)('card data cannot express a free-choice %s Hunt', (_, make) => {
    expect(validateHuntDef(make(PREY))).toEqual([]);
    expect(validateHuntDef(make(loose)).length).toBeGreaterThan(0);
  });

  it('refuses a Hunt inside an If-marked branch, where it could never see both creatures', () => {
    const branched = spell('branched', [{ op: 'ifTargetMarked', then: [{ op: 'hunt', hunter: 'target' }] }], HUNT_SPELL_TARGETS);
    expect(validateHuntDef(branched).length).toBeGreaterThan(0);
    const boundBranch = { ...stalker, abilities: [{ ...HUNT_TRIGGER, ops: [{ op: 'ifTargetMarked' as const, then: [{ op: 'hunt' as const, hunter: 'self' as const }] }] }] };
    expect(validateHuntDef(boundBranch).length).toBeGreaterThan(0);
  });

  it('refuses a spell-form Hunt on a card whose Empower brings its own targets', () => {
    const empowered: CardDef = { ...stalk, empower: { cost: { generic: 1, pips: {} }, targets: [{ what: 'creature' }], ops: [{ op: 'draw', n: 1 }] } };
    expect(validateHuntDef(empowered).length).toBeGreaterThan(0);
  });
});

describe('damage each creature you control (E3)', () => {
  const drums = (other: boolean) => card('drums', { types: ['enchantment'], abilities: [
    { when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'eachYourCreature', ...(other ? { other: true as const } : {}) }] },
  ] });
  const angry = body('angry', 2, 4, [], { abilities: [{ when: 'provoked', ops: [{ op: 'gainLife', n: 2 }] }] });

  it('damages only your creatures and provokes the survivors', () => {
    const db = dbOf(drums(false), angry, body('theirs', 1, 1));
    const state = board([[], []], [{ iid: 1, cardId: 'drums' }, { iid: 2, cardId: 'angry' }, { iid: 3, cardId: 'theirs', controller: 1 }]);
    runOps(state, db, () => {}, { controller: 0, sourceCardId: 'drums', sourceIid: 1, targets: [] }, drums(false).abilities![0].ops!);
    checkStateBased(state, db, () => {});
    expect(damageOf(state, 2)).toBe(1);
    expect(damageOf(state, 3)).toBe(0);
    expect(state.players[0].life).toBe(22);
  });

  it('`other` spares the source', () => {
    const drummer = body('drummer', 1, 1, [], { abilities: [{ when: 'arrives', ops: [{ op: 'damage', n: 1, to: 'eachYourCreature', other: true }] }] });
    const db = dbOf(drummer, angry);
    const state = board([[], []], [{ iid: 1, cardId: 'drummer' }, { iid: 2, cardId: 'angry' }]);
    fireTriggers(state, db, () => {}, 'arrives', state.battlefield[0]);
    checkStateBased(state, db, () => {});
    expect(onBoard(state, 1)).toBe(true);
    expect(damageOf(state, 2)).toBe(1);
  });
});

describe('Hunt: an arrival Hunt chooses its prey when the creature is cast (A1.1b)', () => {
  // The owner's ruling (2026-09-28): a creature with an arrival Hunt can't be
  // cast unless it has prey; the prey is its cast target; it hunts as it
  // arrives; a prey gone by then leaves it arriving without hunting.
  const HUNT: AbilityDef = { when: 'arrives', targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] };
  const GAIN: AbilityDef = { when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] };
  const stalker = body('stalker', 4, 2, [], { abilities: [HUNT] });
  const db = dbOf(
    stalker, body('mine', 1, 1), body('theirs', 1, 1), body('ghost', 1, 1, ['untouchable']), body('big', 1, 5),
    body('lord', 0, 3, [], { abilities: [{ when: 'static', static: { scope: 'filter', filter: { other: true }, p: 1 } }] }),
    body('huntFirst', 4, 2, [], { abilities: [HUNT, GAIN] }),
    body('gainFirst', 4, 2, [], { abilities: [GAIN, HUNT] }),
    body('raider', 4, 2, [], { abilities: [{ ...HUNT, when: 'attacks' }] }),
    body('dawner', 4, 2, [], { abilities: [{ ...HUNT, when: 'dawn' }] }),
  );
  const casts = (state: GameState, database: CardDb = db) => legalActions(state, database, 0)
    .filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell')
    .map((a) => a.targets ?? []);

  it('cannot be cast with no other creature on either side', () => {
    const state = board([['stalker'], []], []);
    expect(casts(state)).toEqual([]);
    expect(() => Game.restore(state, db).submit(0, { type: 'castSpell', handIndex: 0 })).toThrow();
  });

  it('cannot be cast with only your own other creature (no prey under the default rule)', () => {
    const state = board([['stalker'], []], [{ iid: 2, cardId: 'mine' }]);
    expect(casts(state)).toEqual([]);
    expect(() => Game.restore(state, db).submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(2)] })).toThrow();
  });

  it('offers each of the opponent\'s creatures as prey', () => {
    const state = board([['stalker'], []], [{ iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }, { iid: 4, cardId: 'theirs', controller: 1 }]);
    expect(casts(state)).toEqual([[ref(3)], [ref(4)]]);
  });

  it('an opponent\'s lone Untouchable creature leaves it uncastable', () => {
    const state = board([['stalker'], []], [{ iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'ghost', controller: 1 }]);
    expect(casts(state)).toEqual([]);
  });

  it('hunts as it arrives, with its own effective Attack', () => {
    const game = Game.restore(board([['stalker'], []], [{ iid: 2, cardId: 'lord' }, { iid: 3, cardId: 'big', controller: 1 }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(3)] });
    // A 4/2 with the lord's +1/+0 deals 5 to a 1/5: it dies. No choice was left to make.
    expect(onBoard(game.instanceState, 3)).toBe(false);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
  });

  it.each([['has left', 'gone'], ['is no longer a legal prey', 'untouchable']] as const)(
    'arrives and does not hunt when the prey %s', (_, how) => {
      const state = board([[], []], how === 'gone' ? [] : [{ iid: 3, cardId: 'theirs', controller: 1 }]);
      if (how === 'untouchable') state.battlefield[0].untilEotMods.push({ p: 0, t: 0, keywords: ['untouchable'] });
      const events: GameEvent[] = [];
      resolveStackItem(state, db, { sid: 1, cardId: 'stalker', controller: 0, targets: [ref(3)] }, (e) => events.push(e));
      expect(events).not.toContainEqual({ e: 'targetsFizzled', sid: 1 });
      expect(state.battlefield.map((p) => p.cardId)).toContain('stalker');
      expect(events.some((e) => e.e === 'hunted' || e.e === 'damageMarked')).toBe(false);
    });

  it.each([['huntFirst', ['hunted', 'gain']], ['gainFirst', ['gain', 'hunted']]] as const)(
    'resolves in its printed place among the arrival abilities (%s)', (cardId, order) => {
      const state = board([[], []], [{ iid: 3, cardId: 'big', controller: 1 }]);
      const events: GameEvent[] = [];
      resolveStackItem(state, db, { sid: 1, cardId, controller: 0, targets: [ref(3)] }, (e) => events.push(e));
      const seen = events.flatMap((e) => e.e === 'hunted' ? ['hunted'] : e.e === 'lifeChanged' && e.delta === 2 ? ['gain'] : []);
      expect(seen).toEqual([...order]);
    });

  it('leaves attack and Dawn Hunts as ordinary triggers: castable without prey, and with none they do nothing', () => {
    expect(casts(board([['raider'], []], []))).toEqual([[]]);
    expect(casts(board([['dawner'], []], []))).toEqual([[]]);
    const state = board([[], []], [{ iid: 1, cardId: 'raider' }, { iid: 2, cardId: 'dawner' }, { iid: 3, cardId: 'theirs', controller: 1 }]);
    fireTriggers(state, db, () => {}, 'attacks', state.battlefield[0]);
    fireTriggers(state, db, () => {}, 'dawn', state.battlefield[1]);
    expect(state.pendingDecisions).toHaveLength(2);
    const bare = board([[], []], [{ iid: 1, cardId: 'raider' }, { iid: 2, cardId: 'dawner' }]);
    fireTriggers(bare, db, () => {}, 'attacks', bare.battlefield[0]);
    fireTriggers(bare, db, () => {}, 'dawn', bare.battlefield[1]);
    expect(bare.pendingDecisions).toEqual([]);
    expect(bare.battlefield[0].firedThisTurn).toBeUndefined();
  });

  it('refuses a second arrival Hunt, or one beside Empower targets', () => {
    expect(validateHuntDef(stalker)).toEqual([]);
    expect(validateHuntDef({ ...stalker, abilities: [HUNT, HUNT] }).length).toBeGreaterThan(0);
    expect(validateHuntDef({ ...stalker, empower: { cost: { generic: 1, pips: {} }, targets: [PREY], ops: [{ op: 'hunt', hunter: 'self' }] } }).length).toBeGreaterThan(0);
  });
});

describe('Hunt: a card may state its own prey (overrides, ruled 2026-09-28)', () => {
  // Card text overrides the default rule only when the op declares it; the
  // prey spec carries the rule the engine enforces.
  const SPECS: Record<'default' | HuntPrey, TargetSpec> = {
    default: PREY,
    any: ANY_PREY,
    yours: { what: 'yourCreature', other: true },
  };
  const hunter = (prey: 'default' | HuntPrey, spec: TargetSpec = SPECS[prey]): CardDef =>
    body(`hunter-${prey}`, 3, 3, [], { abilities: [{ when: 'arrives', targets: [spec], ops: [{ op: 'hunt', hunter: 'self', ...(prey === 'default' ? {} : { prey }) }] }] });
  const db = dbOf(...(['default', 'any', 'yours'] as const).map((p) => hunter(p)),
    body('mine', 1, 1), body('theirs', 1, 1), body('ghost', 1, 1, ['untouchable']));
  const preyOf = (prey: 'default' | HuntPrey, battlefield: Partial<Permanent>[]) => {
    const d = hunter(prey);
    return enumerateTargets(board([[], []], [{ iid: 1, cardId: d.id }, ...battlefield]), db, 0, d.abilities![0].targets![0], 1);
  };
  const full: Partial<Permanent>[] = [{ iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }, { iid: 4, cardId: 'ghost', controller: 1 }];

  it.each([
    ['default', [3]], ['any', [2, 3]], ['yours', [2]],
  ] as const)('%s: the declared rule is valid data, and its legal prey set matches it (never the hunter)', (prey, expected) => {
    expect(validateHuntDef(hunter(prey))).toEqual([]);
    expect(preyOf(prey, full)).toEqual(expected.map(ref));
  });

  it('the default never falls back to your own creature', () => {
    const noLegalOpponent: Partial<Permanent>[] = [{ iid: 2, cardId: 'mine' }, { iid: 4, cardId: 'ghost', controller: 1 }];
    expect(preyOf('default', noLegalOpponent)).toEqual([]);
    expect(preyOf('any', noLegalOpponent)).toEqual([ref(2)]);
  });

  it.each(['any', 'yours'] as const)('refuses a %s declaration whose spec does not match it', (prey) => {
    expect(validateHuntDef(hunter(prey, prey === 'any' ? SPECS.yours : SPECS.any)).length).toBeGreaterThan(0);
    expect(validateHuntDef(hunter(prey, PREY)).length).toBeGreaterThan(0);
    // A source-bound override without `other` would offer the hunter as its own prey.
    expect(validateHuntDef(hunter(prey, { what: SPECS[prey].what })).length).toBeGreaterThan(0);
  });

  it('refuses an override spec with no declaration', () => {
    expect(validateHuntDef(hunter('default', SPECS.any)).length).toBeGreaterThan(0);
    expect(validateHuntDef(hunter('default', SPECS.yours)).length).toBeGreaterThan(0);
  });

  it.each([
    ['default', [{ iid: 2, cardId: 'mine' }], []],
    ['yours', [{ iid: 3, cardId: 'theirs', controller: 1 }], []],
    ['yours', [{ iid: 2, cardId: 'mine' }], [[2]]],
    ['any', [{ iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }], [[2], [3]]],
  ] as [('default' | HuntPrey), Partial<Permanent>[], number[][]][])('an arrival %s hunter is castable exactly when its own rule has prey', (prey, battlefield, expected) => {
    const d = hunter(prey);
    const lists = legalActions(board([[d.id], []], battlefield), db, 0)
      .filter((a): a is Extract<Action, { type: 'castSpell' }> => a.type === 'castSpell').map((a) => a.targets ?? []);
    expect(lists).toEqual(expected.map((iids) => iids.map(ref)));
  });
});
