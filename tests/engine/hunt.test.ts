import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { legalActions } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { enumerateTargets } from '../../src/engine/effects/targeting';
import { fireTriggers, runOps } from '../../src/engine/effects/EffectInterpreter';
import { resolveStackItem } from '../../src/engine/resolve';
import { checkStateBased } from '../../src/engine/sba';
import type { AbilityDef, CardDb, CardDef, EffectOp, GameState, Keyword, TargetRef, TargetSpec } from '../../src/engine/types';
import { validateEmpowerDef, validateHuntDef } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

// Hunt (plan-first-dawn-engine.md, Part 2, as ruled by the owner in E2-E6):
// the hunter and its prey each deal damage equal to their Attack to the
// other, through the shared creature-damage path.

const HUNT_SPELL_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'creature', other: true }];
/** "Target creature you control hunts another target creature, then draw a card." */
const stalk = spell('stalk', [{ op: 'hunt', hunter: 'target' }, { op: 'draw', n: 1 }], HUNT_SPELL_TARGETS);
/** "Target creature you control gets +2/+2 until end of turn. It hunts another target creature." */
const fang = spell('fang', [{ op: 'boost', p: 2, t: 2, scope: 'target' }, { op: 'hunt', hunter: 'target' }], HUNT_SPELL_TARGETS);
const body = (id: string, attack: number, defense: number, keywords: Keyword[] = [], extra: Partial<CardDef> = {}) =>
  card(id, { attack, defense, keywords, ...extra });

const damageOf = (state: GameState, iid: number) => state.battlefield.find((p) => p.iid === iid)?.damage;
const onBoard = (state: GameState, iid: number) => state.battlefield.some((p) => p.iid === iid);

/** Run a spell-form Hunt's ops as the resolving spell does, then its state-based check. */
function huntNow(state: GameState, db: CardDb, hunter: number, prey: number, ops: EffectOp[] = [{ op: 'hunt', hunter: 'target' }]): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (e) => events.push(e), {
    controller: 0, sourceCardId: 'stalk', targets: [ref(hunter), ref(prey)], targetSpecs: HUNT_SPELL_TARGETS,
  }, ops);
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
  const db = dbOf(body('h', 2, 2), body('wall', 0, 6, ['bulwark']), body('p', 2, 2), body('ghost', 2, 2, ['untouchable']), stalk);

  it('legal actions never offer a Bulwark hunter or one creature in both slots', () => {
    const state = board([['stalk'], []], [
      { iid: 1, cardId: 'h' }, { iid: 2, cardId: 'wall' }, { iid: 3, cardId: 'p', controller: 1 },
    ]);
    const lists = castTargets(state, db);
    expect(lists.length).toBeGreaterThan(0);
    for (const [hunter, prey] of lists) {
      expect(hunter).not.toEqual(ref(2));
      expect(hunter).not.toEqual(prey);
    }
    // A Bulwark creature can be prey, and so can your own creature.
    expect(lists).toContainEqual([ref(1), ref(2)]);
    expect(lists).toContainEqual([ref(1), ref(3)]);
  });

  it('refuses a submitted Bulwark hunter or a creature hunting itself', () => {
    const state = board([['stalk'], []], [
      { iid: 1, cardId: 'h' }, { iid: 2, cardId: 'wall' }, { iid: 3, cardId: 'p', controller: 1 },
    ]);
    const game = Game.restore(state, db);
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

  it('an opponent\'s Untouchable creature is not legal prey; your own is', () => {
    const state = board([['stalk'], []], [
      { iid: 1, cardId: 'h' }, { iid: 2, cardId: 'ghost' }, { iid: 3, cardId: 'ghost', controller: 1 },
    ]);
    const preys = castTargets(state, db).map(([, prey]) => prey);
    expect(preys).toContainEqual(ref(2));
    expect(preys).not.toContainEqual(ref(3));
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

  it('a self-hunt provokes both survivors', () => {
    const angry = (id: string) => body(id, 1, 4, [], { abilities: [{ when: 'provoked', ops: [{ op: 'gainLife', n: 2 }] }] });
    const db = dbOf(angry('a'), angry('b'));
    const state = board([[], []], [{ iid: 1, cardId: 'a' }, { iid: 2, cardId: 'b' }]);
    const events = huntNow(state, db, 1, 2);
    expect(events.filter((e) => e.e === 'triggerFired' && e.when === 'provoked').map((e) => e.e === 'triggerFired' && e.iid)).toEqual([1, 2]);
    expect(state.players[0].life).toBe(24);
  });
});

describe('Hunt: its carriers', () => {
  const tracker = body('tracker', 3, 3, [], {
    // No `other` on the spec: the Duty's own rule keeps the hunter out of its prey.
    activated: { cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'hunt', hunter: 'self' }] },
  });
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
    const db = dbOf(tracker, body('p', 1, 1));
    const state = board([[], []], [{ iid: 1, cardId: 'tracker' }, { iid: 2, cardId: 'p', controller: 1 }]);
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
      empower: { cost: { generic: 0, pips: {} }, targets: [{ what: 'opponentCreature' }], ops: [{ op: 'hunt', hunter: 'self' }] },
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

describe('Hunt: the mandatory source-bound target rule (E6)', () => {
  // "When this arrives, it hunts another target creature, one an opponent
  // controls if able": fixture cards, not the seven overplan rows.
  const HUNT_TRIGGER: AbilityDef = { when: 'arrives', targets: [{ what: 'creature', other: true, opponentIfAble: true }], ops: [{ op: 'hunt', hunter: 'self' }] };
  const stalker = body('stalker', 4, 2, [], { abilities: [HUNT_TRIGGER] });
  /** The same rule without `other`: the rule itself keeps the hunter out. */
  const bare = body('bare', 4, 2, [], { abilities: [{ ...HUNT_TRIGGER, targets: [{ what: 'creature', opponentIfAble: true }] }] });
  const db = dbOf(stalker, bare, body('mine', 1, 1), body('theirs', 1, 1), body('ghost', 1, 1, ['untouchable']));
  const spec = (d: CardDef) => d.abilities![0].targets![0];
  const offered = (battlefield: Parameters<typeof board>[1], d: CardDef = stalker) =>
    enumerateTargets(board([[], []], battlefield), db, 0, spec(d), 1);

  it('offers only the opponent\'s creatures when one is legal', () => {
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }, { iid: 4, cardId: 'theirs', controller: 1 }]))
      .toEqual([ref(3), ref(4)]);
  });

  it('offers your other creatures when the opponent has none', () => {
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }])).toEqual([ref(2)]);
  });

  it('counts an opponent\'s lone Untouchable creature as none', () => {
    expect(offered([{ iid: 1, cardId: 'stalker' }, { iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'ghost', controller: 1 }])).toEqual([ref(2)]);
  });

  it.each([['with', stalker], ['without', bare]] as const)('never offers the hunter itself (%s `other` on the spec)', (_, d) => {
    expect(offered([{ iid: 1, cardId: d.id }], d)).toEqual([]);
    expect(offered([{ iid: 1, cardId: d.id }, { iid: 2, cardId: 'mine' }], d)).toEqual([ref(2)]);
  });

  it('the arrival trigger asks for exactly that set, and with neither side legal it does nothing', () => {
    const game = Game.restore(board([['stalker'], []], [{ iid: 2, cardId: 'mine' }, { iid: 3, cardId: 'theirs', controller: 1 }]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, targets: [ref(3)] });
    expect(game.legalActions(0).filter((a) => a.type === 'chooseTarget')).toEqual([{ type: 'chooseTarget', target: ref(3) }]);
    game.submit(0, { type: 'chooseTarget', target: ref(3) });
    expect(onBoard(game.instanceState, 3)).toBe(false);
    expect(damageOf(game.instanceState, 2)).toBe(0);

    const alone = board([[], []], [{ iid: 1, cardId: 'stalker' }, { iid: 3, cardId: 'ghost', controller: 1 }]);
    fireTriggers(alone, db, () => {}, 'arrives', alone.battlefield[0]);
    expect(alone.pendingDecisions).toEqual([]);
  });

  it('is a creature-spec rule, and a source-bound Hunt is never printed on a Bulwark creature', () => {
    expect(validateHuntDef(stalker)).toEqual([]);
    expect(validateHuntDef({ ...stalker, abilities: [{ ...HUNT_TRIGGER, targets: [{ what: 'yourCreature', opponentIfAble: true }] }] }).length).toBeGreaterThan(0);
    expect(validateHuntDef({ ...stalker, keywords: ['bulwark'] }).length).toBeGreaterThan(0);
    expect(validateHuntDef({ ...card('angry'), abilities: [{ when: 'provoked', targets: [{ what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'self' }] }] }).length).toBeGreaterThan(0);
    expect(validateHuntDef(stalk)).toEqual([]);
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
