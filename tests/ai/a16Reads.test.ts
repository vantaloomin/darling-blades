import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { DEFAULT_PERSONALITY } from '../../src/ai/personality';
import { cardValue, spellTargetsValue } from '../../src/ai/value';
import type { Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, EffectOp, GameState, Permanent, PlayerId, TargetRef, TargetSpec } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The AI's A1.6 reads, on fixture cards. An attacking-only Charm reaches the
 * defender in its window over the attackers, and each brain uses it by its
 * existing Charm rules (Hard on the attacker the removal value ranks first).
 * "If it survived" is worth its branch only when the AI expects the creature
 * to live through what the same spell does first.
 */
const creature = (id: string, attack: number, defense: number): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: ['W'], rarity: 'c', cost: { generic: attack, pips: {} }, attack, defense,
});
const spell = (id: string, types: CardDef['types'], targets: TargetSpec[], ops: EffectOp[]): CardDef => ({
  id, name: id, types, subtypes: [], colors: ['W'], rarity: 'r', cost: { generic: 1, pips: { W: 2 } },
  abilities: [{ when: 'spell', targets, ops }],
});
const HUNT_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'opponentCreature' }];
const PUMP_AND_HUNT: EffectOp[] = [{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'hunt', hunter: 'target' }];
const GATE: EffectOp = { op: 'ifTargetSurvives', then: [{ op: 'draw', n: 1 }] };
const DB: CardDb = {
  ...TEST_DB,
  verdict: spell('verdict', ['charm'], [{ what: 'creature', attacking: true }], [{ op: 'sever', to: 'target' }, { op: 'gainLife', n: 2 }]),
  ambush: spell('ambush', ['ritual'], HUNT_TARGETS, [...PUMP_AND_HUNT, GATE]),
  /** Ambush without its gated draw, the baseline the gate's value is read against. */
  bareAmbush: spell('bareAmbush', ['ritual'], HUNT_TARGETS, PUMP_AND_HUNT),
  grunt: creature('grunt', 2, 2), brute: creature('brute', 5, 5), guard: creature('guard', 1, 4),
  hunter: creature('hunter', 3, 3), smallHunter: creature('smallHunter', 2, 2),
  softPrey: creature('softPrey', 3, 2), hardPrey: creature('hardPrey', 3, 5),
};

const GRUNT = 1;
const BRUTE = 2;
let nextIid = 50;
const ref = (iid: number): TargetRef => ({ kind: 'permanent', iid });

function state(battlefield: Partial<Permanent>[], hands: [string[], string[]], active: PlayerId = 0): GameState {
  const st = makeTestState({ battlefield, hands, active });
  st.rulesRev = 4;
  st.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  st.nextIid = 200;
  st.nextInstanceId = 1000;
  for (const player of st.players) player.deck = Array.from({ length: 12 }, () => 'forest');
  return st;
}

/** P0 attacks with a 2/2 and a 5/5; P1 holds the Verdict with three plains. Returns P1's window over the attackers. */
function defenderWindow(): Game {
  const plains = Array.from({ length: 3 }, () => ({ iid: nextIid++, cardId: 'plains', controller: 1 as PlayerId }));
  const game = Game.restore(state([{ iid: GRUNT, cardId: 'grunt' }, { iid: BRUTE, cardId: 'brute' },
    { iid: 3, cardId: 'guard', controller: 1 }, ...plains], [[], ['verdict']]), DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [GRUNT, BRUTE] });
  expect(game.awaiting).toEqual({ player: 1, kind: 'respond', over: { type: 'attackers' } });
  return game;
}
const choose = (brain: AIPlayer, game: Game): Action => brain.chooseAction(game.viewFor(1), game.legalActions(1));
const verdictTarget = (action: Action): TargetRef | undefined =>
  action.type === 'castSpell' ? action.targets?.[0] : undefined;

describe('an attacking-only Charm in the defender\'s window', () => {
  it('is offered on each attacker, and only on attackers', () => {
    const casts = defenderWindow().legalActions(1).filter((action) => action.type === 'castSpell');
    expect(casts.map(verdictTarget)).toEqual([ref(GRUNT), ref(BRUTE)]);
  });

  it('Hard casts it on the attacker the removal value ranks first', () => {
    expect(verdictTarget(choose(new HardAI(DB), defenderWindow()))).toEqual(ref(BRUTE));
  });

  it('Medium casts it by its removal-on-an-attacker rule', () => {
    expect(verdictTarget(choose(new MediumAI(DB), defenderWindow()))).toEqual(ref(BRUTE));
  });

  it('Easy casts it by its own rule when it does not pass', () => {
    const easy = new EasyAI(DB, 7, { ...DEFAULT_PERSONALITY, easyPassRate: 0 });
    const target = verdictTarget(choose(easy, defenderWindow()));
    expect([ref(GRUNT), ref(BRUTE)]).toContainEqual(target);
  });
});

describe('the survival read for If it survived', () => {
  const HUNTER = 11;
  const PREY = 12;
  /** P0's `hunter` against P1's `prey`: the gate's value is Ambush's value less the bare Ambush's. */
  function gateValues(hunter: string, prey: string): { card: number; targets: number } {
    const game = Game.restore(state([{ iid: HUNTER, cardId: hunter }, { iid: PREY, cardId: prey, controller: 1 }], [['ambush', 'bareAmbush'], []]), DB);
    const view = game.viewFor(0);
    const targets = [ref(HUNTER), ref(PREY)];
    const opsOf = (id: string): EffectOp[] => DB[id].abilities![0].ops!;
    return {
      card: cardValue(DB, 'ambush', view, { targets }) - cardValue(DB, 'bareAmbush', view, { targets }),
      targets: spellTargetsValue(view, DB, opsOf('ambush'), targets) - spellTargetsValue(view, DB, opsOf('bareAmbush'), targets),
    };
  }

  it('counts the draw when the pumped hunter survives the Hunt', () => {
    const lives = gateValues('hunter', 'softPrey'); // a 4/4 takes 3
    expect(lives.card).toBeGreaterThan(0);
    expect(lives.targets).toBeGreaterThan(0);
  });

  it('counts nothing when the Hunt kills the hunter', () => {
    const dies = gateValues('smallHunter', 'hardPrey'); // a 3/3 takes 3
    expect(dies.card).toBeCloseTo(0, 9);
    expect(dies.targets).toBeCloseTo(0, 9);
  });
});
