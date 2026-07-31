/** Pure player-facing copy shared by DuelScene and headless UI tests. */

export interface CombatForecastCopyInput {
  attackers: number;
  damage: number;
  lifeBefore: number;
  lifeAfter: number;
  lethal: boolean;
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
