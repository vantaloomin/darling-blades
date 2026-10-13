/** Pure player-facing copy shared by DuelScene and headless UI tests. */
import type { ToastNotice } from './toastQueue';

export interface CombatForecastCopyInput {
  attackers: number;
  damage: number;
  lifeBefore: number;
  lifeAfter: number;
  lethal: boolean;
}

/**
 * The armed Concede label: names what the second press does, with the verb
 * for the input that pressed it (never "Click" to a touch player). Short
 * enough for the opening overlays' 220px button pitch at their 22px type.
 */
export function concedeConfirmLabel(touch: boolean): string {
  return `${touch ? 'Tap' : 'Click'} to concede`;
}

/** Thin live combat ledger, compact enough to stay in the battlefield gap. */
export function combatForecastCopy(input: CombatForecastCopyInput): string {
  const parts = [
    `${input.attackers} ${input.attackers === 1 ? 'attacker' : 'attackers'}`,
    `Incoming ${input.damage}`,
    `Life ${input.lifeBefore} → ${input.lifeAfter}`,
  ];
  return input.lethal ? `⚠ LETHAL · ${parts.join(' · ')}` : `⚔ ${parts.join(' · ')}`;
}

type EngineEndReason = 'life' | 'deck' | 'concede' | 'turnLimit';

const DEFEAT_REASON_COPY: Readonly<Record<EngineEndReason, string>> = {
  concede: 'You conceded.',
  life: 'Your life total reached 0.',
  deck: 'Your deck ran out of cards.',
  turnLimit: 'The turn limit was reached.',
};

const VICTORY_REASON_COPY: Readonly<Record<EngineEndReason, string>> = {
  life: '',
  deck: 'Your opponent ran out of cards.',
  concede: '',
  turnLimit: 'The turn limit was reached.',
};

function isEngineEndReason(reason: string): reason is EngineEndReason {
  return reason in DEFEAT_REASON_COPY;
}

/** Defeat copy also used by the gauntlet failure recap. */
export function defeatReasonCopy(reason: string): string | null {
  return isEngineEndReason(reason) ? DEFEAT_REASON_COPY[reason] : null;
}

/**
 * Caption below a match result. Ordinary lethal victory is intentionally
 * captionless. The shipped AI never concedes, so that impossible victory also
 * has no dedicated caption.
 */
export function resultReasonCopy(won: boolean, reason: string): string {
  if (!won) return defeatReasonCopy(reason) ?? 'The match ended.';
  return isEngineEndReason(reason) ? VICTORY_REASON_COPY[reason] : 'The match ended.';
}

/**
 * The launch notice after a Tower, Limited or story duel was left unfinished
 * and counted as a loss (settleAbandonedDuel). Its action opens the mode's hub.
 */
export function abandonedDuelNotice(mode: 'gauntlet' | 'limited' | 'story'): ToastNotice {
  switch (mode) {
    case 'gauntlet':
      return {
        title: 'Tower duel forfeited',
        body: 'Your last Tower duel was left unfinished, so it counted as a loss.',
        action: { scene: 'Gauntlet' },
        fitBody: true,
        neverCollapse: true,
      };
    case 'limited':
      return {
        title: 'Draft match forfeited',
        body: 'Your last draft match was left unfinished, so it counted as a loss.',
        action: { scene: 'Limited' },
        fitBody: true,
        neverCollapse: true,
      };
    case 'story':
      return {
        title: 'Story duel forfeited',
        body: 'Your last story duel was left unfinished, so it counted as a loss and the run ended.',
        action: { scene: 'Story' },
        fitBody: true,
        neverCollapse: true,
      };
  }
}

/** The notice when a story duel cannot start (the run moved on, or its setup was refused). */
export function storyDuelUnavailableNotice(reason: string): ToastNotice {
  return {
    title: 'Story duel unavailable',
    body: reason,
    fitBody: true,
  };
}

export interface StoryResultCopyInput {
  won: boolean;
  /** recordFight refused: the result was already in the run. */
  alreadyRecorded: boolean;
  act1Cleared: boolean;
  /** Names of characters this result unlocked. */
  unlockedNames: readonly string[];
}

export interface StoryResultCopy {
  headline: string;
  /** What the result means for the run. */
  runLine: string;
  /** The unlock announcement, or null. */
  unlockLine: string | null;
}

/** Copy for the story duel results overlay. A loss ends the run (recordFight). */
export function storyResultCopy(input: StoryResultCopyInput): StoryResultCopy {
  const headline = input.won ? (input.act1Cleared ? 'ACT CLEARED' : 'VICTORY') : 'DEFEAT';
  const runLine = input.alreadyRecorded
    ? 'This duel was already recorded.'
    : !input.won
      ? 'Your run is over.'
      : input.act1Cleared
        ? 'Act 1 is cleared. Keep one card from your run deck.'
        : 'Your run goes on.';
  const names = input.unlockedNames;
  const unlockLine = names.length === 0
    ? null
    : `${names.length === 1 ? 'New character' : 'New characters'} unlocked: ${names.join(', ')}.`;
  return { headline, runLine, unlockLine };
}
