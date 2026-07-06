import { describe, expect, it } from 'vitest';
import { KEYWORD_NAMES, KEYWORD_REMINDER, rulesText } from '../../src/ui/rulesText';
import { TEST_DB } from '../helpers';

/** F9: keyword reminder text. The Record<Keyword, string> types guarantee full
 * coverage at compile time; these pin the runtime shape and the rulesText gate. */
describe('keyword reminders', () => {
  it('KEYWORD_REMINDER covers exactly the keyword set, with non-empty text', () => {
    expect(Object.keys(KEYWORD_REMINDER).sort()).toEqual(Object.keys(KEYWORD_NAMES).sort());
    for (const text of Object.values(KEYWORD_REMINDER)) expect(text.length).toBeGreaterThan(0);
  });

  it('rulesText expands keywords to reminder lines only when reminders are on', () => {
    const card = TEST_DB.dt_rhino; // deathtouch + trample, no abilities

    const terse = rulesText(card);
    expect(terse).toContain('Deathtouch, Trample'); // one compact line
    expect(terse).not.toContain('—');

    const verbose = rulesText(card, { reminders: true });
    expect(verbose).toContain(`Deathtouch — ${KEYWORD_REMINDER.deathtouch}`);
    expect(verbose).toContain(`Trample — ${KEYWORD_REMINDER.trample}`);
  });

  it('a card with no keywords is unaffected by the reminders flag', () => {
    expect(rulesText(TEST_DB.forest, { reminders: true })).toBe(rulesText(TEST_DB.forest));
  });
});
