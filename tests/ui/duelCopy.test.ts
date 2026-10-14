import { describe, expect, it } from 'vitest';
import {
  combatForecastCopy,
  concedeConfirmLabel,
  defeatReasonCopy,
  resultReasonCopy,
  rewardBreakdown,
} from '../../src/ui/duelCopy';

describe('Duel player-facing copy', () => {
  it('asks a touch player to tap and a mouse player to click to confirm Concede', () => {
    expect(concedeConfirmLabel(true)).toMatch(/^Tap /);
    expect(concedeConfirmLabel(true)).not.toMatch(/click/i);
    expect(concedeConfirmLabel(false)).toMatch(/^Click /);
    for (const touch of [true, false]) expect(concedeConfirmLabel(touch)).toMatch(/concede/);
  });

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

describe('rewardBreakdown', () => {
  it('takes the first-win bonus out of the base row and adds the streak to the total', () => {
    const { rows, total } = rewardBreakdown({ label: 'Win · Medium', gold: 200, firstWinBonus: 100, streak: { count: 3, gold: 55 } });
    expect(rows).toEqual([
      { label: 'Win · Medium', value: '+100' },
      { label: 'First win of the day', value: '+100' },
      { label: 'Daily streak · 3 days', value: '+55' },
    ]);
    expect(total).toBe('+255 gold');
  });

  it('leaves out a streak that paid nothing', () => {
    const { rows, total } = rewardBreakdown({ label: 'Loss', gold: 20, firstWinBonus: null, streak: { count: 2, gold: 0 } });
    expect(rows).toEqual([{ label: 'Loss', value: '+20' }]);
    expect(total).toBe('+20 gold');
  });
});
