import { describe, expect, it } from 'vitest';
import { KEYWORD_ICON_KEY } from '../../src/ui/KeywordIcons';
import { KEYWORD_NAMES } from '../../src/ui/rulesText';

describe('keyword icons', () => {
  it('covers exactly the engine keyword set', () => {
    expect(Object.keys(KEYWORD_ICON_KEY).sort()).toEqual(Object.keys(KEYWORD_NAMES).sort());
    for (const key of Object.values(KEYWORD_ICON_KEY)) expect(key).toMatch(/^keyword-/);
  });
});
