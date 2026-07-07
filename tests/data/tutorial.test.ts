import { describe, it, expect } from 'vitest';
import { Game } from '../../src/engine/Game';
import { CARD_DB } from '../../src/data/catalog';
import type { Action } from '../../src/engine/actions';
import { eligibleAttackers, blockOptions } from '../../src/engine/combat/legality';
import { def, isType } from '../../src/engine/types';
import { ScriptAI } from '../../src/ai/ScriptAI';
import {
  TUTORIAL_PLAYER_DECK,
  TUTORIAL_AI_DECK,
  TUTORIAL_SEED,
  tutorialCue,
  type TutorialCueInput,
} from '../../src/data/tutorial';

const HUMAN = 0;
const AI = 1;

function newTutorialGame(): Game {
  return new Game({
    decks: [[...TUTORIAL_PLAYER_DECK], [...TUTORIAL_AI_DECK]],
    seed: TUTORIAL_SEED,
    db: CARD_DB,
  });
}

/**
 * A deterministic human that mirrors the coach-mark guide's intended line:
 * keep, build a board (land → up to two creatures), attack with an eligible
 * creature, and block the incoming attacker. Used to exercise the scripted duel
 * end-to-end headlessly.
 */
function humanPolicy(g: Game): Action {
  const legal = g.legalActions(HUMAN);
  const a = g.awaiting;
  const keep = legal.find((l) => l.type === 'keepHand');
  if (keep) return keep;
  const passResponse = legal.find((l) => l.type === 'passResponse');
  if (passResponse && (a.kind === 'respond' || a.kind === 'endStepWindow')) return passResponse;

  if (a.kind === 'declareBlockers' && g.state.combat) {
    const opts = blockOptions(g.state.battlefield, CARD_DB, HUMAN, g.state.combat);
    const opt = opts.find((o) => o.canBlock.length > 0);
    if (opt) return { type: 'declareBlockers', blocks: [{ blocker: opt.blocker, attacker: opt.canBlock[0] }] };
    return { type: 'declareBlockers', blocks: [] };
  }
  if (a.kind === 'declareAttackers') {
    const elig = eligibleAttackers(g.state.battlefield, CARD_DB, HUMAN);
    return { type: 'declareAttackers', attackers: elig.length > 0 ? [elig[0]] : [] };
  }
  if (a.kind === 'main') {
    const land = legal.find((l) => l.type === 'playLand');
    if (land) return land;
    const myCreatures = g.state.battlefield.filter(
      (p) => p.controller === HUMAN && isType(def(CARD_DB, p.cardId), 'creature'),
    ).length;
    const creature = legal.find(
      (l) => l.type === 'castSpell' && isType(def(CARD_DB, g.state.players[HUMAN].hand[l.handIndex]), 'creature'),
    );
    if (creature && myCreatures < 2) return creature;
    return { type: 'passStep' };
  }
  return legal.find((l) => l.type === 'passStep') ?? legal[0] ?? { type: 'concede' };
}

/** Play the scripted tutorial to the human's first real block (its end beat). */
function playTutorial(): {
  humanAttacked: boolean;
  humanBlocked: boolean;
  finalState: string;
} {
  const g = newTutorialGame();
  const ai = new ScriptAI(CARD_DB);
  let humanAttacked = false;
  let humanBlocked = false;
  let steps = 0;
  while (g.state.winner === null && steps++ < 500) {
    const a = g.awaiting;
    if (!('player' in a)) break;
    const p = a.player;
    const action = p === AI ? ai.chooseAction(g.viewFor(AI), g.legalActions(AI)) : humanPolicy(g);
    if (p === HUMAN && action.type === 'declareAttackers' && action.attackers.length > 0) humanAttacked = true;
    if (p === HUMAN && action.type === 'declareBlockers' && action.blocks.length > 0) humanBlocked = true;
    g.submit(p, action);
    if (humanBlocked) break;
  }
  return { humanAttacked, humanBlocked, finalState: JSON.stringify(g.state) };
}

describe('tutorial: fixed seed + decks', () => {
  it('puts the human on the play with a castable opening hand', () => {
    const g = newTutorialGame();
    expect(g.state.startingPlayer).toBe(HUMAN);
    const hand = g.viewFor(HUMAN).you.hand;
    expect(hand.some((id) => isType(def(CARD_DB, id), 'land'))).toBe(true);
    expect(hand.some((id) => isType(def(CARD_DB, id), 'creature'))).toBe(true);
  });

  it('teaching decks are all mono-White, vanilla, and use only real cards', () => {
    for (const id of [...TUTORIAL_PLAYER_DECK, ...TUTORIAL_AI_DECK]) {
      const d = def(CARD_DB, id); // throws on an unknown id
      expect(d.colors.every((c) => c === 'W')).toBe(true);
      if (isType(d, 'creature')) {
        expect(d.keywords ?? []).toHaveLength(0);
        expect(d.abilities ?? []).toHaveLength(0);
      }
    }
  });
});

describe('tutorial: scripted line', () => {
  it('reaches the attack and block beats against ScriptAI', () => {
    const r = playTutorial();
    expect(r.humanAttacked).toBe(true);
    expect(r.humanBlocked).toBe(true);
  });

  it('is fully deterministic (same seed + line → identical final state)', () => {
    expect(playTutorial().finalState).toBe(playTutorial().finalState);
  });
});

describe('tutorial: ScriptAI is fail-safe', () => {
  it('never declares a lethal attack', () => {
    const g = newTutorialGame();
    const ai = new ScriptAI(CARD_DB);
    let steps = 0;
    while (g.state.winner === null && steps++ < 500) {
      const a = g.awaiting;
      if (!('player' in a)) break;
      const p = a.player;
      const action = p === AI ? ai.chooseAction(g.viewFor(AI), g.legalActions(AI)) : humanPolicy(g);
      if (p === AI && action.type === 'declareAttackers' && action.attackers.length > 0) {
        const power = action.attackers.reduce(
          (s, iid) => s + (def(CARD_DB, g.state.battlefield.find((x) => x.iid === iid)!.cardId).attack ?? 0),
          0,
        );
        expect(power).toBeLessThan(g.viewFor(AI).opp.life);
      }
      g.submit(p, action);
      if (steps > 40) break;
    }
    // The human is never killed by the teaching opponent.
    expect(g.state.players[HUMAN].life).toBeGreaterThan(0);
  });
});

describe('tutorialCue (pure guide)', () => {
  const base: TutorialCueInput = {
    isHumanTurn: true,
    awaitingKind: 'main',
    step: 'main1',
    landPlayedThisTurn: false,
    handHasLand: true,
    hasCastableCreature: false,
    myCreatureCount: 0,
    eligibleAttackerCount: 0,
    attackerSelected: false,
    pendingBlocker: false,
    hasLegalBlocker: false,
    blockAssigned: false,
    goalShown: false,
    sicknessShown: false,
    blocked: false,
  };

  it('shows the goal first, then waits during the opponent turn, then done on block', () => {
    expect(tutorialCue(base).kind).toBe('goal');
    expect(tutorialCue({ ...base, isHumanTurn: false }).kind).toBe('wait');
    expect(tutorialCue({ ...base, blocked: true }).kind).toBe('done');
  });

  it('walks land → creature → sickness on the first main phase', () => {
    const afterGoal = { ...base, goalShown: true };
    expect(tutorialCue(afterGoal).kind).toBe('playLand');
    const landDown = { ...afterGoal, landPlayedThisTurn: true, hasCastableCreature: true };
    expect(tutorialCue(landDown).kind).toBe('playCreature');
    const creatureDown = { ...landDown, myCreatureCount: 1 };
    expect(tutorialCue(creatureDown).kind).toBe('sickness');
    // Turn 1: after the sickness card, no mana remains → advance out of the phase.
    expect(tutorialCue({ ...creatureDown, sicknessShown: true, hasCastableCreature: false }).kind).toBe(
      'advance',
    );
    // Later turns: with mana for a second creature, it guides playing the blocker.
    expect(tutorialCue({ ...creatureDown, sicknessShown: true, hasCastableCreature: true }).kind).toBe(
      'playCreature',
    );
  });

  it('guides attacking and blocking', () => {
    const atk = { ...base, goalShown: true, awaitingKind: 'declareAttackers', step: 'combat', eligibleAttackerCount: 1 };
    expect(tutorialCue(atk).kind).toBe('selectAttacker');
    expect(tutorialCue({ ...atk, attackerSelected: true }).kind).toBe('confirmAttack');

    const blk = { ...base, goalShown: true, awaitingKind: 'declareBlockers', step: 'combat', hasLegalBlocker: true };
    expect(tutorialCue(blk).kind).toBe('selectBlocker');
    expect(tutorialCue({ ...blk, pendingBlocker: true }).kind).toBe('selectAttackerToBlock');
    expect(tutorialCue({ ...blk, blockAssigned: true }).kind).toBe('confirmBlock');
  });
});
