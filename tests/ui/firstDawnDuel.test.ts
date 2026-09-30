import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import { legalActions, validateAction } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { startTurn } from '../../src/engine/phases';
import { checkStateBased } from '../../src/engine/sba';
import { getEffectiveStats } from '../../src/engine/statics';
import type { AbilityDef, CardDb, CardDef, EffectOp, GameState, ManaActivatedDef, TargetSpec } from '../../src/engine/types';
import { cardIdOf } from '../../src/engine/types';
import { BOOST_CHIP_LABEL, provokedSpent, tileChipLabel } from '../../src/ui/boardCuePresentation';
import { planCombat, sequencedBatchRoutes, sequencedEventRoute } from '../../src/ui/combatSequence';
import { deferredTargetPrompt } from '../../src/ui/drownedDeepChoices';
import { departedInBatch, eventHistoryLine, type EventLineLookup } from '../../src/ui/duelPresentation';
import {
  HUNT_HUNTER_PROMPT, HUNT_PREY_PROMPT, huntBlows, huntDrawnDamage, huntExchangeDraw, huntFloatText, huntStepPrompt,
  planHunts, tookPartInHunt,
  type HuntedEvent,
} from '../../src/ui/huntPresentation';
import {
  pumpActionsFor, pumpBoost, pumpSubmission, pumpTicker, stepPumpTicker, type ManaPumpAction,
} from '../../src/ui/manaPumpPresentation';
import { targetSelectionStep, toggleTargetSelection, type TargetSelectionAction } from '../../src/ui/targetSelection';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

/**
 * The Duel's First Dawn presentation (1.9 A2.a), on fixture cards and the
 * real engine: the spent Provoked state, the Hunt's two-step prompts over the
 * engine's own legal pairs, the exchange's numbers landing on the right
 * creature at combat's timing, where each new event goes in a full-motion
 * sequence and in the history, and the mana pump's ticker.
 */

const PREY: TargetSpec = { what: 'opponentCreature' };
const provoked = (ops: EffectOp[]): AbilityDef => ({ when: 'provoked', ops });
/** 2/4, "Provoked: you gain 1 life." */
const grazer = card('grazer', { abilities: [provoked([{ op: 'gainLife', n: 1 }])] });
/** 2/4 with a once-each-turn arrival trigger, then a Provoked. */
const watcher = card('watcher', { abilities: [{ when: 'arrives', oncePerTurn: true, ops: [{ op: 'gainLife', n: 1 }] }, provoked([{ op: 'gainLife', n: 1 }])] });
/** 2/4 with a once-each-turn arrival trigger and no Provoked. */
const herald = card('herald', { abilities: [{ when: 'arrives', oncePerTurn: true, ops: [{ op: 'gainLife', n: 1 }] }] });
/** "Target creature you control Hunts." */
const stalk = spell('stalk', [{ op: 'hunt', hunter: 'target' }], [{ what: 'yourCreature' }, PREY]);
/** "Target creature you control Hunts any other creature." */
const stalkAny = spell('stalkAny', [{ op: 'hunt', hunter: 'target', prey: 'any' }], [{ what: 'yourCreature' }, { what: 'creature', other: true }]);
/** "When this arrives, Hunt." */
const raptor = card('raptor', { attack: 3, defense: 3, abilities: [{ when: 'arrives', ops: [{ op: 'hunt', hunter: 'self' }], targets: [PREY] }] });
/** "Whenever this attacks, Hunt." */
const stalker = card('stalker', { attack: 3, defense: 3, abilities: [{ when: 'attacks', ops: [{ op: 'hunt', hunter: 'self' }], targets: [PREY] }] });
const wall = card('wall', { attack: 0, defense: 5, keywords: ['bulwark'] });
const body = (id: string, attack: number, defense: number) => card(id, { attack, defense });
/** "{R}: This gets +1/+0 until Sunset." on a 5/5 (the working Vyra's pump). */
const FIREBREATH: ManaActivatedDef = { cost: { generic: 0, pips: { R: 1 } }, ops: [{ op: 'boost', p: 1, t: 0, scope: 'self' }] };
const VYRA: CardDef = card('vyra', { attack: 5, defense: 5, colors: ['R'], manaActivated: [FIREBREATH] });
const shock = spell('shock', [{ op: 'damage', n: 1, to: 'target' }], [{ what: 'creature' }]);

const castActions = (state: GameState, db: CardDb, cardId: string): TargetSelectionAction[] =>
  legalActions(state, db, 0).filter((a): a is Extract<Action, { type: 'castSpell' }> =>
    a.type === 'castSpell' && cardIdOf(state.players[0].hand[a.handIndex]) === cardId);

/** Deal damage with the real op, then run the state-based check that follows it. */
function strike(state: GameState, db: CardDb, iid: number, n: number): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (e) => events.push(e), { controller: 1, sourceCardId: 'test', targets: [ref(iid)] }, [{ op: 'damage', n, to: 'target' }]);
  checkStateBased(state, db, (e) => events.push(e));
  return events;
}

/** Cast a Hunt spell through the engine and return the events of its resolution. */
function castHunt(db: CardDb, battlefield: Parameters<typeof board>[1], hunter: number, prey: number, spellId = 'stalk'): { events: GameEvent[]; game: Game } {
  const game = Game.restore(board([[spellId], []], battlefield), db);
  const cast = castActions(game.instanceState, db, spellId).find((a) =>
    a.targets?.[0]?.kind === 'permanent' && a.targets[0].iid === hunter && a.targets[1]?.kind === 'permanent' && a.targets[1].iid === prey);
  if (!cast) throw new Error('no such cast');
  const events: GameEvent[] = [...game.submit(0, cast)];
  while (game.awaiting.kind === 'respond') events.push(...game.submit(game.awaiting.player, { type: 'passResponse' }));
  return { events, game };
}

const huntedIn = (events: readonly GameEvent[]): HuntedEvent[] => events.filter((e): e is HuntedEvent => e.e === 'hunted');

/** Attack with `attacker` into a block by `blocker`, and return the batch that lands the combat damage. */
function fightBatch(db: CardDb, attackerId: string, blockerId: string): GameEvent[] {
  const game = Game.restore(board([[], []], [{ iid: 1, cardId: attackerId }, { iid: 2, cardId: blockerId, controller: 1 }]), db);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [1] });
  while (game.awaiting.kind === 'respond') game.submit(game.awaiting.player, { type: 'passResponse' });
  return game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
}

describe('the spent Provoked state', () => {
  const db = dbOf(grazer, herald);

  it('reads spent once its creature has been provoked, for the rest of that turn, and fresh the next turn', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    const perm = () => state.battlefield.find((p) => p.iid === 1)!;
    expect(provokedSpent(grazer.abilities, perm().firedThisTurn)).toBe(false);
    strike(state, db, 1, 1);
    expect(provokedSpent(grazer.abilities, perm().firedThisTurn)).toBe(true);
    // A second survived blow the same turn does not fire again, and it stays spent.
    strike(state, db, 1, 1);
    expect(provokedSpent(grazer.abilities, perm().firedThisTurn)).toBe(true);
    startTurn(state, db, () => {});
    expect(provokedSpent(grazer.abilities, perm().firedThisTurn)).toBe(false);
  });

  it('is never spent on a creature without Provoked, whatever else it fired this turn', () => {
    // The engine's list of abilities fired this turn, holding the once-each-turn arrival (index 0).
    expect(provokedSpent(herald.abilities, [0])).toBe(false);
    expect(provokedSpent(watcher.abilities, [0])).toBe(false);
    expect(provokedSpent(watcher.abilities, [1])).toBe(true);
  });
});

describe('the Hunt prompts over the legal pairs', () => {
  it('asks for the hunter from your creatures that can hunt, then for its prey from the opponent\'s', () => {
    const db = dbOf(stalk, body('a', 2, 2), body('b', 3, 3), wall, body('foe', 2, 2), body('foe2', 1, 1));
    const state = board([['stalk'], []], [
      { iid: 1, cardId: 'a' }, { iid: 2, cardId: 'b' }, { iid: 3, cardId: 'wall' },
      { iid: 4, cardId: 'foe', controller: 1 }, { iid: 5, cardId: 'foe2', controller: 1 },
    ]);
    const actions = castActions(state, db, 'stalk');
    const first = targetSelectionStep(actions, []);
    expect(huntStepPrompt(stalk, 'cast', first.selected.length)).toBe(HUNT_HUNTER_PROMPT);
    // No Bulwark hunter and no opposing creature is ever offered as the hunter.
    expect(first.targets).toEqual([ref(1), ref(2)]);

    const picked = toggleTargetSelection(actions, [], ref(2));
    const second = targetSelectionStep(actions, picked);
    expect(huntStepPrompt(stalk, 'cast', second.selected.length)).toBe(HUNT_PREY_PROMPT);
    expect(second.targets).toEqual([ref(4), ref(5)]);
    expect(second.complete).toBeNull();

    const done = targetSelectionStep(actions, toggleTargetSelection(actions, picked, ref(5)));
    expect(done.complete?.targets).toEqual([ref(2), ref(5)]);
    // Both picked: the prey step stays up beside "2 of 2" until the cast is confirmed.
    expect(huntStepPrompt(stalk, 'cast', done.selected.length)).toBe(HUNT_PREY_PROMPT);
    expect(validateAction(state, db, 0, done.complete!)).toBeNull();
  });

  it('never offers the chosen hunter as its own prey on a card that may hunt any creature', () => {
    const db = dbOf(stalkAny, body('a', 2, 2), body('b', 3, 3), body('foe', 2, 2));
    const state = board([['stalkAny'], []], [{ iid: 1, cardId: 'a' }, { iid: 2, cardId: 'b' }, { iid: 3, cardId: 'foe', controller: 1 }]);
    const actions = castActions(state, db, 'stalkAny');
    const prey = targetSelectionStep(actions, toggleTargetSelection(actions, [], ref(1))).targets;
    expect(prey).toContainEqual(ref(2));
    expect(prey).toContainEqual(ref(3));
    expect(prey).not.toContainEqual(ref(1));
  });

  it('asks an arrival hunter for its prey at cast, and nothing else for a spell that does not hunt', () => {
    const db = dbOf(raptor, shock, body('foe', 2, 2));
    const state = board([['raptor'], []], [{ iid: 4, cardId: 'foe', controller: 1 }]);
    const step = targetSelectionStep(castActions(state, db, 'raptor'), []);
    expect(huntStepPrompt(raptor, 'cast', step.selected.length)).toBe(HUNT_PREY_PROMPT);
    expect(step.targets).toEqual([ref(4)]);
    expect(huntStepPrompt(shock, 'cast', 0)).toBeNull();
    // A Hauntlink or Retell cast chooses something else, never prey.
    expect(huntStepPrompt(raptor, 'hauntlinkCast', 0)).toBeNull();
  });

  it('asks an attacking hunter\'s queued choice for its prey', () => {
    const db = dbOf(stalker, body('foe', 2, 2), body('foe2', 1, 1));
    const game = Game.restore(board([[], []], [
      { iid: 1, cardId: 'stalker' }, { iid: 4, cardId: 'foe', controller: 1 }, { iid: 5, cardId: 'foe2', controller: 1 },
    ]), db);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(game.awaiting.kind).toBe('chooseTarget');
    expect(deferredTargetPrompt(game.instanceState, db, 0)?.title.endsWith(HUNT_PREY_PROMPT)).toBe(true);
  });
});

describe('the Hunt exchange', () => {
  it('lands each creature\'s number on the other one, as the engine dealt it', () => {
    const db = dbOf(stalk, body('h', 3, 5), body('p', 1, 4));
    const { events, game } = castHunt(db, [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }], 1, 2);
    const [hunt] = huntedIn(events);
    const blows = huntBlows(hunt);
    const onCreature = (iid: number) => blows.find((blow) => blow.target === iid)!.amount;
    const damage = (iid: number) => game.instanceState.battlefield.find((p) => p.iid === iid)!.damage;
    expect(onCreature(2)).toBe(damage(2));
    expect(onCreature(1)).toBe(damage(1));
    expect(onCreature(2)).not.toBe(onCreature(1));

    // Every blow that dealt damage is drawn by the exchange, and only those.
    const drawn = [...huntDrawnDamage(events)];
    expect(drawn).toHaveLength(blows.filter((blow) => blow.amount > 0).length);
    for (const mark of drawn) {
      if (mark.e !== 'damageMarked') throw new Error('not a damage mark');
      expect(blows.some((blow) => blow.target === mark.iid && blow.amount === mark.amount)).toBe(true);
    }
  });

  it('still reads when neither creature has Attack: both show 0 and no damage mark is drawn', () => {
    const db = dbOf(stalk, body('h', 0, 3), body('p', 0, 3));
    const { events } = castHunt(db, [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'p', controller: 1 }], 1, 2);
    const [hunt] = huntedIn(events);
    expect(hunt).toBeDefined();
    expect(huntBlows(hunt).map((blow) => huntFloatText(blow.amount))).toEqual(['0', '0']);
    expect(huntDrawnDamage(events).size).toBe(0);
  });

  it('leaves damage the Hunt did not deal to the ordinary float', () => {
    const hunt: HuntedEvent = { e: 'hunted', hunter: 1, prey: 2, hunterDamage: 2, preyDamage: 0 };
    const before: GameEvent = { e: 'damageMarked', iid: 2, amount: 2 };
    const other: GameEvent = { e: 'damageMarked', iid: 2, amount: 1 };
    const huntDamage: GameEvent = { e: 'damageMarked', iid: 2, amount: 2 };
    const drawn = huntDrawnDamage([before, hunt, other, huntDamage]);
    expect([...drawn]).toEqual([huntDamage]);
  });

  it('lands the prey\'s number, and says the hunter\'s death, when an arrival hunter dies in its own Hunt without ever having a tile', () => {
    const db = dbOf(raptor, body('foe', 3, 3));
    const game = Game.restore(board([['raptor'], []], [{ iid: 4, cardId: 'foe', controller: 1 }]), db);
    const events: GameEvent[] = [...game.submit(0, castActions(game.instanceState, db, 'raptor')[0])];
    while (game.awaiting.kind === 'respond') events.push(...game.submit(game.awaiting.player, { type: 'passResponse' }));
    const [hunt] = huntedIn(events);
    // The 3/3 hunter and its 3/3 prey kill each other: the hunter was cast in this batch and is gone after it.
    expect(game.instanceState.battlefield.some((p) => p.iid === hunt.hunter)).toBe(false);
    const onlyThePrey = (iid: number) => iid === hunt.prey;

    const draw = huntExchangeDraw(hunt, onlyThePrey);
    expect(draw.tether).toBe(false);
    expect(draw.landings.map(({ blow, strikerPlaced }) => ({ on: blow.target, amount: blow.amount, strikerPlaced })))
      .toEqual([{ on: hunt.prey, amount: 3, strikerPlaced: false }]);

    // The exchange claims the mark it lands, and leaves the hunter's to the ordinary path.
    const drawn = [...huntDrawnDamage(events, onlyThePrey)];
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatchObject({ e: 'damageMarked', iid: hunt.prey });

    expect(events.some((e) => e.e === 'died' && e.iid === hunt.hunter)).toBe(true);
    expect(tookPartInHunt(events, hunt.hunter)).toBe(true);
    expect(tookPartInHunt(events, hunt.prey)).toBe(true);
    expect(tookPartInHunt(events, 99)).toBe(false);
  });

  it('draws the whole exchange when both creatures have a tile', () => {
    const hunt: HuntedEvent = { e: 'hunted', hunter: 1, prey: 2, hunterDamage: 3, preyDamage: 0 };
    const draw = huntExchangeDraw(hunt, () => true);
    expect(draw.tether).toBe(true);
    expect(draw.landings.map(({ blow, strikerPlaced }) => ({ on: blow.target, amount: blow.amount, strikerPlaced })))
      .toEqual([{ on: 2, amount: 3, strikerPlaced: true }, { on: 1, amount: 0, strikerPlaced: true }]);
  });

  it('plays at combat\'s timing: both blows in one instant, a combat stagger between Hunts, deaths with the Hunt that caused them', () => {
    const one: HuntedEvent = { e: 'hunted', hunter: 1, prey: 2, hunterDamage: 3, preyDamage: 1 };
    const two: HuntedEvent = { e: 'hunted', hunter: 3, prey: 4, hunterDamage: 2, preyDamage: 2 };
    // A lone Hunt takes exactly as long as a lone combat strike.
    expect(planHunts([one]).totalMs).toBe(planCombat([{ hits: [{ source: 1, target: ref(2), amount: 3 }] }]).totalMs);
    const plan = planHunts([one, two], [4, 9]);
    const combat = planCombat([{ hits: [{ source: 1, target: ref(2), amount: 3 }, { source: 3, target: ref(4), amount: 2 }] }]);
    expect(plan.steps.map((step) => step.atMs)).toEqual(combat.steps.map((step) => step.atMs));
    expect(plan.steps[1].deaths).toEqual([4]);
    expect(plan.steps[0].deaths).toEqual([]);
    expect(plan.unclaimed).toEqual([9]);
  });
});

describe('where the new events go', () => {
  const combatBatch = { combat: true, huntDrawn: new Set<GameEvent>() };

  it('routes a Hunt batch in a full-motion sequence: the exchange, its drawn damage, a Provoked held for the landing', () => {
    const db = dbOf(stalk, body('h', 3, 5), grazer);
    const { events } = castHunt(db, [{ iid: 1, cardId: 'h' }, { iid: 2, cardId: 'grazer', controller: 1 }], 1, 2);
    const batch = { combat: false, huntDrawn: huntDrawnDamage(events) };
    const routeOf = (e: GameEvent) => sequencedEventRoute(e, batch);
    expect(events.filter((e) => e.e === 'hunted').map(routeOf)).toEqual(['hunt']);
    expect(events.filter((e) => e.e === 'damageMarked').map(routeOf)).toEqual(['drawn', 'drawn']);
    const fired = events.filter((e) => e.e === 'triggerFired' && e.when === 'provoked');
    expect(fired).toHaveLength(1);
    expect(fired.map(routeOf)).toEqual(['afterStrikes']);
  });

  it('narrates what a Hunt did not draw, and keeps combat\'s own rules for a combat batch', () => {
    const loose: GameEvent = { e: 'damageMarked', iid: 7, amount: 1 };
    const loss: GameEvent = { e: 'lifeChanged', player: 1, delta: -2, now: 18 };
    const huntOnly = { combat: false, huntDrawn: new Set<GameEvent>() };
    expect(sequencedEventRoute(loose, huntOnly)).toBe('narrate');
    expect(sequencedEventRoute(loss, huntOnly)).toBe('narrate');
    expect(sequencedEventRoute(loose, combatBatch)).toBe('drawn');
    expect(sequencedEventRoute(loss, combatBatch)).toBe('drawn');
    expect(sequencedEventRoute({ e: 'triggerFired', iid: 1, when: 'dies' }, combatBatch)).toBe('narrate');
    expect(sequencedEventRoute({ e: 'manaActivated', player: 0, iid: 1, cardId: 'x', abilityIndex: 0, times: 2 }, combatBatch)).toBe('narrate');
  });

  it('holds what a Provoked trigger did with its line, in order, and lets the engine move on at once', () => {
    /** 2/4, "Provoked: you gain 1 life and this deals 1 damage to the opponent." */
    const biter = card('biter', { abilities: [provoked([{ op: 'gainLife', n: 1 }, { op: 'damage', n: 1, to: 'opponent' }])] });
    const events = fightBatch(dbOf(biter, body('a', 2, 2)), 'a', 'biter');
    const routes = sequencedBatchRoutes(events, { combat: true, huntDrawn: new Set<GameEvent>() });
    const held = events.filter((_, index) => routes[index] === 'afterStrikes');
    expect(held[0]).toMatchObject({ e: 'triggerFired', when: 'provoked' });
    // The effect's gain and its damage to the player wait behind the line; no strike draws either.
    const life = held.filter((e) => e.e === 'lifeChanged').map((e) => e.e === 'lifeChanged' && e.delta);
    expect(life).toEqual([1, -1]);
    // The strikes' own damage is still the strikes', and the step change is not held.
    expect(routes.filter((_, index) => events[index].e === 'damageMarked')).toEqual(['drawn', 'drawn']);
    const moved = events.findIndex((e) => e.e === 'stepChanged');
    expect(moved).toBeGreaterThan(events.indexOf(held[held.length - 1]));
    expect(routes[moved]).toBe('narrate');
  });

  it('routes a batch with no Provoked trigger exactly as its events route one by one', () => {
    /** 2/2, "When this dies, you gain 1 life." */
    const martyr = card('martyr', { attack: 2, defense: 2, abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 1 }] }] });
    const events = fightBatch(dbOf(martyr, body('guard', 2, 4)), 'martyr', 'guard');
    const routes = sequencedBatchRoutes(events, combatBatch);
    expect(events.some((e) => e.e === 'triggerFired' && e.when === 'dies')).toBe(true);
    expect(routes).toEqual(events.map((e) => sequencedEventRoute(e, combatBatch)));
    // The dies trigger's gain pops as a heal when combat settles, as it did before the hold existed.
    expect(routes[events.findIndex((e) => e.e === 'lifeChanged' && e.delta > 0)]).toBe('heal');
    expect(routes).not.toContain('afterStrikes');
  });

  const names: Record<number, string> = { 1: '[Hunter]', 2: '[Prey]' };
  const lookup: EventLineLookup = {
    permanent: (iid) => (names[iid] ? { ref: names[iid], side: iid === 1 ? 'you' : 'opponent' } : null),
    cardRef: (cardId) => `[${cardId}]`,
    card: (cardId) => ({ ...VYRA, id: cardId }),
    sideOf: (player) => (player === 0 ? 'you' : 'opponent'),
    overchargeLimit: 3,
  };

  it('gives the history a line for a Hunt, a Provoked trigger, a pump and an Overcharge, and none for other triggers', () => {
    const hunt = eventHistoryLine({ e: 'hunted', hunter: 1, prey: 2, hunterDamage: 3, preyDamage: 0 }, lookup)!;
    expect(hunt.indexOf('[Hunter]')).toBeLessThan(hunt.indexOf('[Prey]'));
    expect(hunt).toMatch(/\b3\b/);
    expect(hunt).toMatch(/\b0\b/);
    expect(eventHistoryLine({ e: 'triggerFired', iid: 2, when: 'provoked' }, lookup)).toContain('[Prey]');
    expect(eventHistoryLine({ e: 'triggerFired', iid: 2, when: 'dies' }, lookup)).toBeNull();
    // The pump's line carries how many times it was used (counts the quoted +1/+0 cannot supply), and what it did.
    const pump = (times: number) => eventHistoryLine({ e: 'manaActivated', player: 0, iid: 1, cardId: 'vyra', abilityIndex: 0, times }, lookup)!;
    for (const times of [2, 3, 4]) expect(pump(times)).toMatch(new RegExp(`\\b${times}\\b`));
    expect(new Set([1, 2, 3, 4].map(pump)).size).toBe(4);
    expect(pump(3)).toContain('+1/+0');
    // The Overcharge line carries the namesake's count and the limit.
    const overcharge = (total: number, overchargeLimit: number) => eventHistoryLine(
      { e: 'overcharged', player: 1, iid: 2, cardId: 'hatchling', tokenCardId: 'hatchling', total }, { ...lookup, overchargeLimit })!;
    expect(overcharge(2, 5)).toMatch(/\b2\b/);
    expect(overcharge(2, 5)).toMatch(/\b5\b/);
    expect(overcharge(2, 5)).not.toBe(overcharge(3, 5));
    expect(overcharge(2, 5)).not.toBe(overcharge(2, 7));
  });

  it('names a creature that left in the batch, however it left', () => {
    const exits: GameEvent[] = [
      { e: 'died', iid: 2, cardId: 'prey', owner: 1 },
      { e: 'recalled', iid: 2, cardId: 'prey', owner: 1 },
      { e: 'severed', iid: 2, cardId: 'prey', player: 1, from: 'battlefield' },
    ];
    for (const exit of exits) {
      const batch: GameEvent[] = [{ e: 'hunted', hunter: 1, prey: 2, hunterDamage: 3, preyDamage: 1 }, exit];
      const gone: EventLineLookup = {
        ...lookup,
        permanent: (iid) => {
          if (iid === 1) return { ref: '[Hunter]', side: 'you' };
          const left = departedInBatch(batch, iid);
          return left ? { ref: `[${left.cardId}]`, side: left.player === 0 ? 'you' : 'opponent' } : null;
        },
      };
      expect(eventHistoryLine(batch[0], gone), exit.e).toContain('[prey]');
    }
    // A sever from a graveyard or a deck names no permanent.
    expect(departedInBatch([{ e: 'severed', cardId: 'prey', player: 1, from: 'graveyard' }], 2)).toBeNull();
  });
});


describe('the mana pump ticker', () => {
  const db = dbOf(VYRA);
  const withMountains = (n: number) => board([[], []], [
    { iid: 1, cardId: 'vyra' },
    ...Array.from({ length: n }, (_, i) => ({ iid: 10 + i, cardId: 'mountain' })),
  ]);
  const legalPump = (state: GameState): ManaPumpAction => pumpActionsFor(legalActions(state, db, 0), 1)[0];

  it('counts from 1 to the most the player can pay, and never past either end', () => {
    const state = withMountains(4);
    const max = legalPump(state).times;
    expect(max).toBe(4);
    let ticker = pumpTicker(max);
    expect(ticker.count).toBe(1);
    expect(ticker.canDecrease).toBe(false);
    expect(stepPumpTicker(ticker, -1).count).toBe(1);
    for (let i = 0; i < 10; i++) ticker = stepPumpTicker(ticker, +1);
    expect(ticker.count).toBe(max);
    expect(ticker.canIncrease).toBe(false);
    expect(stepPumpTicker(ticker, -1).count).toBe(max - 1);
  });

  it('submits the chosen count as one action the engine accepts and applies that many times', () => {
    const game = Game.restore(withMountains(4), db);
    const legal = legalPump(game.instanceState);
    const ticker = stepPumpTicker(stepPumpTicker(pumpTicker(legal.times), +1), +1);
    const action = pumpSubmission(legal, ticker.count)!;
    expect(action.times).toBe(3);
    expect(validateAction(game.instanceState, db, 0, action)).toBeNull();
    const before = getEffectiveStats(game.instanceState.battlefield, db, 1).attack;
    const events = game.submit(0, action);
    expect(events.filter((e) => e.e === 'manaActivated').map((e) => e.e === 'manaActivated' && e.times)).toEqual([3]);
    expect(getEffectiveStats(game.instanceState.battlefield, db, 1).attack - before).toBe(pumpBoost(FIREBREATH.ops, 3).attack);
    expect(game.instanceState.battlefield.filter((p) => p.cardId === 'mountain' && p.tapped)).toHaveLength(3);
  });

  it('holds a count past the legal maximum to the maximum', () => {
    const state = withMountains(2);
    const legal = legalPump(state);
    const action = pumpSubmission(legal, 99)!;
    expect(action.times).toBe(legal.times);
    expect(validateAction(state, db, 0, action)).toBeNull();
  });
});


describe('the pump in a combat window', () => {
  const db = dbOf(VYRA, body('grunt', 2, 2));

  it('keeps the attacker\'s window over the blocks open and puts Boost on the pumping attacker, and on nothing without mana', () => {
    const chipFor = (game: Game, iid: number) => tileChipLabel({
      link: null, dutyUsable: false, canAttack: false, assignedBlocker: false,
      boostUsable: pumpActionsFor(legalActions(game.instanceState, db, 0), iid).length > 0,
    });
    const fight = (mountains: number): Game => {
      const game = Game.restore(board([[], []], [
        { iid: 1, cardId: 'vyra' },
        { iid: 2, cardId: 'grunt', controller: 1 },
        ...Array.from({ length: mountains }, (_, i) => ({ iid: 10 + i, cardId: 'mountain' })),
      ]), db);
      game.submit(0, { type: 'passStep' });
      game.submit(0, { type: 'declareAttackers', attackers: [1] });
      while (game.awaiting.kind === 'respond' && game.awaiting.player === 1) game.submit(1, { type: 'passResponse' });
      game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
      return game;
    };
    const withMana = fight(2);
    expect(withMana.awaiting.kind === 'respond' && withMana.awaiting.player === 0).toBe(true);
    expect(chipFor(withMana, 1)).toBe(BOOST_CHIP_LABEL);
    const without = fight(0);
    expect(without.awaiting.kind === 'respond' && without.awaiting.player === 0).toBe(false);
    expect(chipFor(without, 1)).toBeNull();
  });
});
