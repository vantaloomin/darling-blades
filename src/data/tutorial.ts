import type { AIPlayer } from '../ai/AIPlayer';

/**
 * The optional first-launch tutorial (see docs/plan-road-to-1.0.md Feature 1).
 * A short, on-rails scripted duel — fixed decks both sides + a fixed seed +
 * the `ScriptAI` teaching opponent — over which `DuelScene` lays a coach-mark
 * guide. Everything here is pure/Phaser-free so the line is deterministic and
 * the guide logic is unit-testable.
 *
 * The decks are mono-White so mana is trivial. `bk-mousekin-pantry-guard` (1/1)
 * is the turn-one creature (teaches casting + summoning sickness) and the human's
 * attacker; `so-muster-militia` (a Ritual = sorcery-speed) makes two Militia
 * token blockers AND teaches Ritual timing; `in-blessed-respite` (a Charm =
 * instant-speed) is cast IN RESPONSE to the opponent's attack to teach Charm
 * timing. All are existing pool cards — no new cards or art are authored.
 */
const PLAINS = 'land-plains';
const MOUSE = 'bk-mousekin-pantry-guard'; // 1/1 W — turn-1 creature + attacker
const RITUAL = 'so-muster-militia'; // ritual (sorcery): create 2 Militia tokens (blockers)
const CHARM = 'in-blessed-respite'; // charm (instant): gain 4 life — the in-response lesson

/** Human's fixed teaching deck (16 cards). */
export const TUTORIAL_PLAYER_DECK: readonly string[] = [
  PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS,
  MOUSE, MOUSE, MOUSE,
  RITUAL, RITUAL, RITUAL,
  CHARM, CHARM, CHARM,
];

/** The teaching opponent's fixed deck (12 cards) — just lands + small attackers. */
export const TUTORIAL_AI_DECK: readonly string[] = [
  PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS,
  MOUSE, MOUSE, MOUSE, MOUSE, MOUSE,
];

/**
 * Fixed seed for the tutorial `Game`. Chosen (pinned by tests/data/tutorial.test.ts)
 * so the human is on the play and the scripted line is reproducible: opens with a
 * Plains + the 1-drop, and draws the Ritual and Charm in time for their lessons.
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
  | 'castRitual' // spotlight a Ritual (sorcery) in hand
  | 'ritualInfo' // info card: Ritual timing (your turn only)
  | 'castCharm' // spotlight a Charm (instant) in a response window
  | 'charmInfo' // info card: Charm timing (any time)
  | 'advance' // spotlight the smart button (pass / to-combat / next / hold)
  | 'selectAttacker' // spotlight an eligible attacker tile
  | 'confirmAttack' // spotlight the smart button to confirm the swing
  | 'selectBlocker' // spotlight an eligible blocker tile
  | 'selectAttackerToBlock' // spotlight the incoming attacker tile
  | 'confirmBlock' // spotlight the smart button to confirm the block
  | 'wait' // opponent is acting — hide the coach mark
  | 'done'; // all beats taught — end the tutorial

export interface TutorialCueInput {
  isHumanTurn: boolean;
  awaitingKind: string;
  step: string;
  landPlayedThisTurn: boolean;
  handHasLand: boolean;
  hasCastableCreature: boolean;
  hasCastableRitual: boolean;
  hasCastableCharm: boolean;
  handHasCharm: boolean;
  myCreatureCount: number;
  eligibleAttackerCount: number;
  attackerSelected: boolean;
  pendingBlocker: boolean;
  hasLegalBlocker: boolean;
  blockAssigned: boolean;
  /** The opponent is the active/turn player — so a response window here is on THEIR turn. */
  activePlayerIsOpponent: boolean;
  goalShown: boolean;
  sicknessShown: boolean;
  blocked: boolean;
  ritualCast: boolean;
  ritualInfoShown: boolean;
  charmCast: boolean;
  charmInfoShown: boolean;
  /** Anti-stall backstop: end the tutorial gracefully if the line runs long. */
  safetyDone: boolean;
}

export interface TutorialCue {
  kind: TutorialCueKind;
  /** ≤ ~8 words, one concept per cue (NN/g coach-mark guidance). */
  text: string;
}

export function tutorialCue(i: TutorialCueInput): TutorialCue {
  if ((i.charmCast && i.charmInfoShown) || i.safetyDone) return { kind: 'done', text: '' };
  if (!i.isHumanTurn) return { kind: 'wait', text: '' };
  if (!i.goalShown) return { kind: 'goal', text: 'Win by taking your foe to 0 life.' };
  // Info cards fire the moment their spell resolves, whatever the phase.
  if (i.ritualCast && !i.ritualInfoShown)
    return { kind: 'ritualInfo', text: 'Rituals cast only on your own turn.' };
  if (i.charmCast && !i.charmInfoShown)
    return { kind: 'charmInfo', text: 'Charms cast any time — even your foe’s turn.' };

  switch (i.awaitingKind) {
    case 'main':
      if (!i.landPlayedThisTurn && i.handHasLand)
        return { kind: 'playLand', text: 'Play a land — it makes your mana.' };
      if (i.myCreatureCount === 0 && i.hasCastableCreature)
        return { kind: 'playCreature', text: 'Spend mana — play a creature.' };
      if (i.myCreatureCount >= 1 && !i.sicknessShown)
        return { kind: 'sickness', text: "A new creature can't attack this turn." };
      if (!i.ritualCast && i.hasCastableRitual)
        return { kind: 'castRitual', text: 'Cast this Ritual — a sorcery-speed spell.' };
      // After the block lesson, keep mana open for the Charm-in-response lesson.
      if (i.blocked && !i.charmCast && i.handHasCharm)
        return { kind: 'advance', text: 'Hold your mana — save the Charm ▶' };
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
      // The Charm lesson: cast it in response, but ONLY during the opponent's
      // turn (their attack) so the "even on their turn" point actually lands. A
      // response window on your own turn (e.g. after they declare blocks) is
      // just passed.
      if (!i.charmCast && i.hasCastableCharm && i.activePlayerIsOpponent)
        return { kind: 'castCharm', text: 'Cast a Charm now — on their turn!' };
      return { kind: 'advance', text: 'Pass ▶' };

    case 'endStepWindow':
      return { kind: 'advance', text: 'Pass ▶' };

    default:
      return { kind: 'advance', text: 'Advance ▶' };
  }
}
