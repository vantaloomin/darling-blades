import { describe, expect, it } from 'vitest';
import { KEYWORD_NAMES, KEYWORD_REMINDER, MECHANIC_DEFINITIONS, cardGlossaryEntries, rulesText } from '../../src/ui/rulesText';
import { CARD_DB } from '../../src/data/catalog';
import { TEST_DB } from '../helpers';

/** F9: keyword reminder text. The Record<Keyword, string> types guarantee full
 * coverage at compile time; these pin the runtime shape and the rulesText gate. */
describe('keyword reminders', () => {
  it('KEYWORD_REMINDER covers exactly the keyword set, with non-empty text', () => {
    expect(Object.keys(KEYWORD_REMINDER).sort()).toEqual(Object.keys(KEYWORD_NAMES).sort());
    for (const text of Object.values(KEYWORD_REMINDER)) expect(text.length).toBeGreaterThan(0);
  });

  it('rulesText expands keywords to reminder lines only when reminders are on', () => {
    const card = TEST_DB.dt_rhino; // deathblade + overrun, no abilities

    const terse = rulesText(card);
    expect(terse).toContain('Deathblade, Overrun'); // one compact line
    expect(terse).not.toContain('—');

    const verbose = rulesText(card, { reminders: true });
    expect(verbose).toContain(`Deathblade: ${KEYWORD_REMINDER.deathblade}`);
    expect(verbose).toContain(`Overrun: ${KEYWORD_REMINDER.overrun}`);
  });

  it('a card with no keywords is unaffected by the reminders flag', () => {
    expect(rulesText(TEST_DB.forest, { reminders: true })).toBe(rulesText(TEST_DB.forest));
  });
});

/** Inspect Keyword Guide entries: declared keywords + text-referenced keywords
 * and mechanics. Regression: Morrigan showed only Skyborne, hiding Foresee
 * and Sever (playtest report 2026-07-12). */
describe('cardGlossaryEntries', () => {
  it('surfaces declared keywords plus Sever/Foresee mechanics (Morrigan regression)', () => {
    const morrigan = CARD_DB['cf-morrigan-black-wing'];
    const names = cardGlossaryEntries(morrigan).map((e) => e.name);
    expect(names).toEqual(['Skyborne', 'Foresee', 'Sever']);
    const foresee = cardGlossaryEntries(morrigan).find((e) => e.name === 'Foresee');
    expect(foresee?.reminder).toBe(MECHANIC_DEFINITIONS.foresee);
  });

  it('keeps keyword-only and empty cards unchanged', () => {
    expect(cardGlossaryEntries(TEST_DB.dt_rhino).map((e) => e.name)).toEqual(['Deathblade', 'Overrun']);
    expect(cardGlossaryEntries(TEST_DB.forest)).toEqual([]);
  });

  it('deduplicates keywords that appear both declared and in rules text', () => {
    for (const card of Object.values(CARD_DB)) {
      const names = cardGlossaryEntries(card).map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
