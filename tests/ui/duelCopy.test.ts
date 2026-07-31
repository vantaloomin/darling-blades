import { describe, expect, it } from 'vitest';
import {
  combatForecastCopy,
  defeatReasonCopy,
  resultReasonCopy,
} from '../../src/ui/duelCopy';

describe('Duel player-facing copy', () => {
  it.each([
    [{ attackers: 1, damage: 0, lifeBefore: 8, lifeAfter: 8, lethal: false }, '⚔ 1 attacker · Incoming 0 · Life 8 → 8'],
    [{ attackers: 2, damage: 3, lifeBefore: 8, lifeAfter: 5, lethal: false }, '⚔ 2 attackers · Incoming 3 · Life 8 → 5'],
    [{ attackers: 3, damage: 5, lifeBefore: 5, lifeAfter: 0, lethal: true }, '⚠ LETHAL · 3 attackers · Incoming 5 · Life 5 → 0'],
  ])('formats the live combat ledger %#', (input, expected) => {
    expect(combatForecastCopy(input)).toBe(expected);
  });

  it('maps defeat reasons to the gauntlet failure-screen wording', () => {
    expect(defeatReasonCopy('life')).toBe('Your life total reached 0.');
    expect(defeatReasonCopy('deck')).toBe('Your deck ran out of cards.');
    expect(defeatReasonCopy('concede')).toBe('You conceded.');
    expect(defeatReasonCopy('turnLimit')).toBe('The turn limit was reached.');
  });

  it('keeps normal lethal victories captionless and explains deck-out victories', () => {
    expect(resultReasonCopy(true, 'life')).toBe('');
    expect(resultReasonCopy(true, 'deck')).toBe('Your opponent ran out of cards.');
    expect(resultReasonCopy(true, 'concede')).toBe('');
  });

  it('never uses em-dashes in mapped player copy', () => {
    const copy = [
      combatForecastCopy({ attackers: 2, damage: 2, lifeBefore: 4, lifeAfter: 2, lethal: false }),
      ...['life', 'deck', 'concede', 'turnLimit'].flatMap((reason) => [
        resultReasonCopy(true, reason),
        resultReasonCopy(false, reason),
      ]),
    ];
    expect(copy.join('\n')).not.toContain('—');
  });
});
