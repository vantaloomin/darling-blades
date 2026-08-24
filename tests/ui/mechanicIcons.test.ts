import { describe, expect, it } from 'vitest';
import { CARD_TYPE_ICON_KEY, KEYWORD_ICON_KEY, MECHANIC_ICON_KEY } from '../../src/ui/KeywordIcons';
import { GLOSSARY_SECTIONS, MECHANIC_NAMES } from '../../src/data/glossary';
import { CARD_TYPE_DEFINITIONS } from '../../src/ui/rulesText';

/**
 * Before 2026-08-24 only Champion Awakening had a mechanic glyph, so the
 * Glossary's Mechanics tab drew thirteen empty icon gutters beside it and the
 * All Terms tab drew nineteen (user report). The records are total over their
 * unions, which the typecheck already enforces; these pin the runtime shape and
 * the rule that no glossary row falls back to a blank gutter.
 */
describe('mechanic and card-type icons', () => {
  it('covers every named mechanic plus the two zone terms', () => {
    for (const id of Object.keys(MECHANIC_NAMES)) {
      expect(MECHANIC_ICON_KEY[id as keyof typeof MECHANIC_ICON_KEY]).toBe(`mechanic-${id}`);
    }
    expect(MECHANIC_ICON_KEY.warchest).toBe('mechanic-warchest');
    expect(MECHANIC_ICON_KEY.darlings).toBe('mechanic-darlings');
    expect(Object.keys(MECHANIC_ICON_KEY)).toHaveLength(Object.keys(MECHANIC_NAMES).length + 2);
  });

  it('covers every card type', () => {
    expect(Object.keys(CARD_TYPE_ICON_KEY).sort()).toEqual(Object.keys(CARD_TYPE_DEFINITIONS).sort());
    for (const key of Object.values(CARD_TYPE_ICON_KEY)) expect(key).toMatch(/^cardtype-/);
  });

  it('gives every texture key a unique name across all three icon families', () => {
    const keys = [
      ...Object.values(KEYWORD_ICON_KEY),
      ...Object.values(MECHANIC_ICON_KEY),
      ...Object.values(CARD_TYPE_ICON_KEY),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('leaves no glossary row without a glyph', () => {
    for (const section of GLOSSARY_SECTIONS) {
      for (const term of section.terms) {
        expect(term.icon.kind, `${section.title} / ${term.name}`).not.toBe('none');
      }
    }
  });
});
