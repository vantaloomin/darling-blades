/** Pure player-facing copy shared by DuelScene and headless UI tests. */

export interface CombatForecastCopyInput {
  damage: number;
  enemyDeaths: number;
  yourDeaths: number;
  lethal: boolean;
}

function deathClause(count: number, owner: 'enemy' | 'yours'): string | null {
  if (count === 0) return null;
  if (owner === 'enemy') return count === 1 ? '1 enemy dies' : `${count} enemies die`;
  return count === 1 ? '1 of yours dies' : `${count} of yours die`;
}

/** Count-aware combat forecast with zero-count death clauses omitted. */
export function combatForecastCopy(input: CombatForecastCopyInput): string {
  const parts = [input.damage > 0 ? `you take ${input.damage}` : 'no damage to you'];
  const enemy = deathClause(input.enemyDeaths, 'enemy');
  const yours = deathClause(input.yourDeaths, 'yours');
  if (enemy) parts.push(enemy);
  if (yours) parts.push(yours);
  return input.lethal
    ? `⚠ LETHAL: ${parts.join(' · ')}`
    : `⚔ Forecast: ${parts.join(' · ')}`;
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
