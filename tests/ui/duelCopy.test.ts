import { describe, expect, it } from 'vitest';
import {
  combatForecastCopy,
  defeatReasonCopy,
  resultReasonCopy,
} from '../../src/ui/duelCopy';

describe('Duel player-facing copy', () => {
  it.each([
    [{ damage: 0, enemyDeaths: 0, yourDeaths: 0, lethal: false }, '⚔ Forecast: no damage to you'],
    [{ damage: 0, enemyDeaths: 1, yourDeaths: 0, lethal: false }, '⚔ Forecast: no damage to you · 1 enemy dies'],
    [{ damage: 0, enemyDeaths: 2, yourDeaths: 0, lethal: false }, '⚔ Forecast: no damage to you · 2 enemies die'],
    [{ damage: 0, enemyDeaths: 0, yourDeaths: 1, lethal: false }, '⚔ Forecast: no damage to you · 1 of yours dies'],
    [{ damage: 0, enemyDeaths: 0, yourDeaths: 2, lethal: false }, '⚔ Forecast: no damage to you · 2 of yours die'],
    [{ damage: 3, enemyDeaths: 1, yourDeaths: 2, lethal: false }, '⚔ Forecast: you take 3 · 1 enemy dies · 2 of yours die'],
    [{ damage: 5, enemyDeaths: 1, yourDeaths: 1, lethal: true }, '⚠ LETHAL: you take 5 · 1 enemy dies · 1 of yours dies'],
  ])('formats forecast counts %#', (input, expected) => {
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
      combatForecastCopy({ damage: 2, enemyDeaths: 2, yourDeaths: 1, lethal: true }),
      ...['life', 'deck', 'concede', 'turnLimit'].flatMap((reason) => [
        resultReasonCopy(true, reason),
        resultReasonCopy(false, reason),
      ]),
    ];
    expect(copy.join('\n')).not.toContain('—');
  });
});
