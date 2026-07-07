import type { AIPlayer } from '../ai/AIPlayer';

/**
 * The optional first-launch tutorial (see docs/plan-road-to-1.0.md Feature 1).
 * A short, on-rails scripted duel — fixed decks both sides + a fixed seed +
 * the `ScriptAI` teaching opponent — over which `DuelScene` lays a coach-mark
 * guide. Everything here is pure/Phaser-free so the line is deterministic and
 * the guide logic is unit-testable.
 *
 * The decks are mono-White so mana is trivial: 1-drop `bk-mousekin-pantry-guard`
 * (1/1) is the turn-one creature (teaches casting + summoning sickness) and the
 * human's attacker; 2-drop `tk-shu-guansuo` (2/2) is the blocker. All are
 * vanilla (no keywords/abilities), so combat reads exactly as taught. No new
 * cards or art are authored — every id is an existing pool card.
 */
const PLAINS = 'land-plains';
const MOUSE = 'bk-mousekin-pantry-guard'; // 1/1 W — turn-1 creature + attacker
const GUARD = 'tk-shu-guansuo'; // 2/2 W — the blocker

/** Human's fixed teaching deck (12 cards). */
export const TUTORIAL_PLAYER_DECK: readonly string[] = [
  PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS,
  MOUSE, MOUSE, MOUSE,
  GUARD, GUARD, GUARD,
];

/** The teaching opponent's fixed deck (12 cards, same shape). */
export const TUTORIAL_AI_DECK: readonly string[] = [
  PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS,
  MOUSE, MOUSE, MOUSE,
  GUARD, GUARD, GUARD,
];

/**
 * Fixed seed for the tutorial `Game`. Chosen so the human is on the play and
 * opens with a Plains + the 1-drop attacker + a 2-drop blocker (and the AI
 * opens with a Plains + a 1-drop), making the scripted line reproducible.
 * Pinned by tests/data/tutorial.test.ts.
 */
export const TUTORIAL_SEED = 2;

/** Build the `DuelScene` launch payload for the tutorial (caller supplies the AI). */
export function tutorialLaunchData(ai: AIPlayer): {
  deckOverride: string[];
  oppDeckOverride: string[];
  seedOverride: number;
  aiOverride: AIPlayer;
  tutorial: true;
} {
  return {
    deckOverride: [...TUTORIAL_PLAYER_DECK],
    oppDeckOverride: [...TUTORIAL_AI_DECK],
    seedOverride: TUTORIAL_SEED,
    aiOverride: ai,
    tutorial: true,
  };
}

// ---------------------------------------------------------------------------
// Coach-mark guide — a pure state→cue mapping. `DuelScene` computes the input
// from engine + selection state each sync, then renders the cue's text and
// spotlights the resolved target. Kept Phaser-free and total so it is unit-
// testable and can never desync from wall-clock timers.
// ---------------------------------------------------------------------------

export type TutorialCueKind =
  | 'goal' // info card: the win condition
  | 'playLand' // spotlight a land in hand
  | 'playCreature' // spotlight a castable creature in hand
  | 'sickness' // info card: summoning sickness
  | 'advance' // spotlight the smart button (pass / to-combat / next)
  | 'selectAttacker' // spotlight an eligible attacker tile
  | 'confirmAttack' // spotlight the smart button to confirm the swing
  | 'selectBlocker' // spotlight an eligible blocker tile
  | 'selectAttackerToBlock' // spotlight the incoming attacker tile
  | 'confirmBlock' // spotlight the smart button to confirm the block
  | 'wait' // opponent is acting — hide the coach mark
  | 'done'; // block landed — end the tutorial

export interface TutorialCueInput {
  isHumanTurn: boolean;
  awaitingKind: string;
  step: string;
  landPlayedThisTurn: boolean;
  handHasLand: boolean;
  hasCastableCreature: boolean;
  myCreatureCount: number;
  eligibleAttackerCount: number;
  attackerSelected: boolean;
  pendingBlocker: boolean;
  hasLegalBlocker: boolean;
  blockAssigned: boolean;
  goalShown: boolean;
  sicknessShown: boolean;
  blocked: boolean;
}

export interface TutorialCue {
  kind: TutorialCueKind;
  /** ≤ ~8 words, one concept per cue (NN/g coach-mark guidance). */
  text: string;
}

export function tutorialCue(i: TutorialCueInput): TutorialCue {
  if (i.blocked) return { kind: 'done', text: '' };
  if (!i.isHumanTurn) return { kind: 'wait', text: '' };
  if (!i.goalShown) return { kind: 'goal', text: 'Win by taking your foe to 0 life.' };

  switch (i.awaitingKind) {
    case 'main':
      if (!i.landPlayedThisTurn && i.handHasLand)
        return { kind: 'playLand', text: 'Play a land — it makes your mana.' };
      if (i.myCreatureCount >= 1 && !i.sicknessShown)
        return { kind: 'sickness', text: "A new creature can't attack this turn." };
      if (i.myCreatureCount < 2 && i.hasCastableCreature)
        return { kind: 'playCreature', text: 'Spend mana — play a creature.' };
      return { kind: 'advance', text: i.step === 'main1' ? 'Advance to combat ▶' : 'Advance ▶' };

    case 'declareAttackers':
      if (i.eligibleAttackerCount === 0) return { kind: 'advance', text: 'Nothing can attack — advance ▶' };
      if (!i.attackerSelected) return { kind: 'selectAttacker', text: 'Tap a creature to attack.' };
      return { kind: 'confirmAttack', text: 'Confirm your attack ▶' };

    case 'declareBlockers':
      if (i.blockAssigned) return { kind: 'confirmBlock', text: 'Confirm your block ▶' };
      if (!i.hasLegalBlocker) return { kind: 'advance', text: 'Advance ▶' };
      if (i.pendingBlocker) return { kind: 'selectAttackerToBlock', text: 'Now tap the attacker.' };
      return { kind: 'selectBlocker', text: 'Tap your creature to block.' };

    case 'respond':
    case 'endStepWindow':
      return { kind: 'advance', text: 'Pass ▶' };

    default:
      return { kind: 'advance', text: 'Advance ▶' };
  }
}
