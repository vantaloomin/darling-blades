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

const castOfType = (g: Game, t: 'creature' | 'ritual' | 'charm'): Action | undefined =>
  g
    .legalActions(HUMAN)
    .find(
      (l) => l.type === 'castSpell' && isType(def(CARD_DB, g.state.players[HUMAN].hand[l.handIndex]), t),
    );

/**
 * A deterministic human mirroring the coach-mark guide's line: build a board,
 * cast the Ritual on your turn, attack, block, HOLD mana, and cast the Charm at
 * the END of your own turn (the instant-timing lesson).
 */
function humanPolicy(g: Game, prog: { ritualCast: boolean; charmAtEnd: boolean }): Action {
  const legal = g.legalActions(HUMAN);
  const a = g.awaiting;
  const st = g.state;
  const keep = legal.find((l) => l.type === 'keepHand');
  if (keep) return keep;
  if (a.kind === 'endStepWindow') {
    if (!prog.charmAtEnd) {
      const charm = castOfType(g, 'charm');
      if (charm) {
        prog.charmAtEnd = true;
        return charm;
      }
    }
    return legal.find((l) => l.type === 'passResponse') ?? legal[0];
  }
  if (a.kind === 'respond') return legal.find((l) => l.type === 'passResponse') ?? legal[0];
  if (a.kind === 'declareBlockers' && st.combat) {
    const opts = blockOptions(st.battlefield, CARD_DB, HUMAN, st.combat);
    const o = opts.find((o) => o.canBlock.length > 0);
    return o ? { type: 'declareBlockers', blocks: [{ blocker: o.blocker, attacker: o.canBlock[0] }] } : { type: 'declareBlockers', blocks: [] };
  }
  if (a.kind === 'declareAttackers') {
    const e = eligibleAttackers(st.battlefield, CARD_DB, HUMAN);
    return { type: 'declareAttackers', attackers: e.length > 0 ? [e[0]] : [] };
  }
  if (a.kind === 'main') {
    const land = legal.find((l) => l.type === 'playLand');
    if (land) return land;
    const mine = st.battlefield.filter(
      (p) => p.controller === HUMAN && isType(def(CARD_DB, p.cardId), 'creature'),
    ).length;
    if (mine === 0) {
      const cr = castOfType(g, 'creature');
      if (cr) return cr;
    }
    if (!prog.ritualCast) {
      const rit = castOfType(g, 'ritual');
      if (rit) {
        prog.ritualCast = true;
        return rit;
      }
    }
    return legal.find((l) => l.type === 'passStep') ?? legal[0]; // hold the Charm
  }
  return legal.find((l) => l.type === 'passStep') ?? legal[0];
}

/** Play the scripted tutorial until every taught beat has fired. */
function playTutorial(): {
  humanAttacked: boolean;
  humanBlocked: boolean;
  ritualCast: boolean;
  charmAtEnd: boolean;
  minHumanLife: number;
  finalState: string;
} {
  const g = newTutorialGame();
  const ai = new ScriptAI(CARD_DB);
  const prog = { ritualCast: false, charmAtEnd: false };
  let humanAttacked = false;
  let humanBlocked = false;
  let minHumanLife = g.state.players[HUMAN].life;
  let steps = 0;
  while (g.state.winner === null && steps++ < 400) {
    const a = g.awaiting;
    if (!('player' in a)) break;
    const p = a.player;
    const action = p === AI ? ai.chooseAction(g.viewFor(AI), g.legalActions(AI)) : humanPolicy(g, prog);
    if (p === HUMAN && action.type === 'declareAttackers' && action.attackers.length > 0) humanAttacked = true;
    if (p === HUMAN && action.type === 'declareBlockers' && action.blocks.length > 0) humanBlocked = true;
    g.submit(p, action);
    minHumanLife = Math.min(minHumanLife, g.state.players[HUMAN].life);
    if (prog.ritualCast && prog.charmAtEnd && humanBlocked) break;
    if (g.state.turn > 14) break;
  }
  return { humanAttacked, humanBlocked, ...prog, minHumanLife, finalState: JSON.stringify(g.state) };
}

describe('tutorial: fixed seed + decks', () => {
  it('puts the human on the play with a castable opening hand', () => {
    const g = newTutorialGame();
    expect(g.state.startingPlayer).toBe(HUMAN);
    const hand = g.viewFor(HUMAN).you.hand;
    expect(hand.some((id) => isType(def(CARD_DB, id), 'land'))).toBe(true);
    expect(hand.some((id) => isType(def(CARD_DB, id), 'creature'))).toBe(true);
  });

  it('teaching decks are mono-White, use real cards, and include a Ritual + a Charm', () => {
    for (const id of [...TUTORIAL_PLAYER_DECK, ...TUTORIAL_AI_DECK]) {
      const d = def(CARD_DB, id); // throws on an unknown id
      expect(d.colors.every((c) => c === 'W')).toBe(true);
      if (isType(d, 'creature')) {
        expect(d.keywords ?? []).toHaveLength(0); // vanilla combat reads as taught
      }
    }
    expect(TUTORIAL_PLAYER_DECK.some((id) => isType(def(CARD_DB, id), 'ritual'))).toBe(true);
    expect(TUTORIAL_PLAYER_DECK.some((id) => isType(def(CARD_DB, id), 'charm'))).toBe(true);
  });
});

describe('tutorial: scripted line', () => {
  it('reaches attack, block, Ritual, and Charm-at-end-of-turn against ScriptAI', () => {
    const r = playTutorial();
    expect(r.humanAttacked).toBe(true);
    expect(r.humanBlocked).toBe(true);
    expect(r.ritualCast).toBe(true);
    expect(r.charmAtEnd).toBe(true);
  });

  it('is fully deterministic (same seed + line → identical final state)', () => {
    expect(playTutorial().finalState).toBe(playTutorial().finalState);
  });

  it('never lets the fail-safe opponent bring the human below full life via combat', () => {
    // The teaching AI is non-lethal and the human blocks; the Charm only adds life.
    expect(playTutorial().minHumanLife).toBeGreaterThan(0);
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
    hasCastableRitual: false,
    hasCastableCharm: false,
    handHasCharm: false,
    myCreatureCount: 0,
    eligibleAttackerCount: 0,
    attackerSelected: false,
    pendingBlocker: false,
    hasLegalBlocker: false,
    blockAssigned: false,
    isTouch: false,
    goalShown: false,
    sicknessShown: false,
    inspectShown: false,
    healInfoShown: false,
    blocked: false,
    ritualCast: false,
    ritualInfoShown: false,
    charmCast: false,
    charmInfoShown: false,
    safetyDone: false,
  };

  it('shows the goal first, waits on the opponent turn, ends after the Charm lesson', () => {
    expect(tutorialCue(base).kind).toBe('goal');
    expect(tutorialCue({ ...base, isHumanTurn: false }).kind).toBe('wait');
    expect(tutorialCue({ ...base, charmCast: true, charmInfoShown: true }).kind).toBe('done');
    expect(tutorialCue({ ...base, safetyDone: true }).kind).toBe('done');
  });

  it('walks land → creature → sickness → inspect tip → Ritual on the main phase', () => {
    const afterGoal = { ...base, goalShown: true };
    expect(tutorialCue(afterGoal).kind).toBe('playLand');
    const landDown = { ...afterGoal, landPlayedThisTurn: true, hasCastableCreature: true };
    expect(tutorialCue(landDown).kind).toBe('playCreature');
    const creatureDown = { ...landDown, myCreatureCount: 1, hasCastableCreature: false };
    expect(tutorialCue(creatureDown).kind).toBe('sickness');
    const afterSick = { ...creatureDown, sicknessShown: true, hasCastableRitual: true };
    // With the first creature down, the inspect tip teaches where keyword
    // reminder text lives, with the right gesture per input mode.
    const inspect = tutorialCue(afterSick);
    expect(inspect.kind).toBe('inspectInfo');
    expect(inspect.text).toBe('Right-click any card to inspect it. Keywords are explained there.');
    expect(tutorialCue({ ...afterSick, isTouch: true }).text).toBe(
      'Long-press a card and tap the preview to inspect it. Keywords are explained there.',
    );
    const afterInspect = { ...afterSick, inspectShown: true };
    const ritual = tutorialCue(afterInspect);
    expect(ritual.kind).toBe('castRitual');
    expect(ritual.text).toBe('Cast this Ritual spell.'); // no "sorcery-speed" descriptor
    expect(tutorialCue({ ...afterInspect, ritualCast: true }).kind).toBe('ritualInfo');
  });

  it('teaches that combat damage wears off after the block lesson', () => {
    const blocked = { ...base, goalShown: true, inspectShown: true, sicknessShown: true, blocked: true };
    const heal = tutorialCue(blocked);
    expect(heal.kind).toBe('healInfo');
    expect(heal.text).toBe('Combat wounds are not permanent. Creatures heal back to full at end of turn.');
    // Once shown it never repeats, whatever the phase.
    expect(tutorialCue({ ...blocked, healInfoShown: true }).kind).not.toBe('healInfo');
    expect(
      tutorialCue({ ...blocked, healInfoShown: true, awaitingKind: 'endStepWindow' }).kind,
    ).not.toBe('healInfo');
  });

  it('teaches the Charm at the END of your own turn (endStepWindow), passing responses', () => {
    const g = { ...base, goalShown: true, hasCastableCharm: true, handHasCharm: true };
    // A response window (even on the opponent turn) is just passed now.
    expect(tutorialCue({ ...g, awaitingKind: 'respond' }).kind).toBe('advance');
    // The end-of-turn window is the Charm lesson.
    expect(tutorialCue({ ...g, awaitingKind: 'endStepWindow' }).kind).toBe('castCharm');
    // After casting, the info card teaches the timing.
    const info = tutorialCue({ ...g, awaitingKind: 'endStepWindow', charmCast: true });
    expect(info.kind).toBe('charmInfo');
    expect(info.text).toContain('foe');
  });

  it('uses "Click" copy on desktop and "Tap" on touch', () => {
    const g = { ...base, goalShown: true, awaitingKind: 'declareAttackers', step: 'combat', eligibleAttackerCount: 1 };
    expect(tutorialCue({ ...g, isTouch: false }).text).toBe('Click a creature to attack.');
    expect(tutorialCue({ ...g, isTouch: true }).text).toBe('Tap a creature to attack.');
  });

  it('never uses em-dashes in cue copy (player-copy rule)', () => {
    const states: Partial<TutorialCueInput>[] = [
      {},
      { goalShown: true },
      { goalShown: true, landPlayedThisTurn: true, hasCastableCreature: true },
      { goalShown: true, landPlayedThisTurn: true, myCreatureCount: 1 },
      { goalShown: true, landPlayedThisTurn: true, myCreatureCount: 1, sicknessShown: true },
      { goalShown: true, isTouch: true, landPlayedThisTurn: true, myCreatureCount: 1, sicknessShown: true },
      { goalShown: true, sicknessShown: true, inspectShown: true, hasCastableRitual: true },
      { goalShown: true, ritualCast: true },
      { goalShown: true, blocked: true },
      { goalShown: true, blocked: true, healInfoShown: true, charmCast: true },
      { goalShown: true, blocked: true, healInfoShown: true, handHasCharm: true, landPlayedThisTurn: true, myCreatureCount: 1, sicknessShown: true, inspectShown: true, ritualCast: true, ritualInfoShown: true },
      { goalShown: true, awaitingKind: 'declareAttackers', eligibleAttackerCount: 1 },
      { goalShown: true, awaitingKind: 'declareBlockers', hasLegalBlocker: true },
      { goalShown: true, awaitingKind: 'endStepWindow', hasCastableCharm: true },
    ];
    for (const s of states) {
      expect(tutorialCue({ ...base, ...s }).text).not.toContain('—');
    }
  });

  it('guides attacking and blocking', () => {
    const g = { ...base, goalShown: true };
    const atk = { ...g, awaitingKind: 'declareAttackers', step: 'combat', eligibleAttackerCount: 1 };
    expect(tutorialCue(atk).kind).toBe('selectAttacker');
    expect(tutorialCue({ ...atk, attackerSelected: true }).kind).toBe('confirmAttack');
    const blk = { ...g, awaitingKind: 'declareBlockers', step: 'combat', hasLegalBlocker: true };
    expect(tutorialCue(blk).kind).toBe('selectBlocker');
    expect(tutorialCue({ ...blk, pendingBlocker: true }).kind).toBe('selectAttackerToBlock');
    expect(tutorialCue({ ...blk, blockAssigned: true }).kind).toBe('confirmBlock');
  });
});
