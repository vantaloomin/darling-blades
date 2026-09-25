import { describe, expect, it, vi } from 'vitest';

// Owner ruling: the Forge reflects the live game. Rename a keyword and two
// mechanics in the game's glossary, and the Forge's breakdown, warnings and
// hints must follow with no Forge edit. The mock stands in for a future
// rename; nothing in src/forge may spell the old names itself.
vi.mock('../../src/data/glossary', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/data/glossary')>();
  return {
    ...original,
    KEYWORD_NAMES: { ...original.KEYWORD_NAMES, skyborne: 'Cloudstep' },
    MECHANIC_NAMES: { ...original.MECHANIC_NAMES, foresee: 'Glimpse', tithe: 'Offering' },
  };
});

const { translateLabel } = await import('../../src/forge/ledger');
const { createInitialBuilderState, evaluateBuilder } = await import('../../src/forge/logic');
const { candidateHints } = await import('../../src/forge/hints');

describe('game names in the Forge', () => {
  it('follows a rename in the game glossary', () => {
    expect(translateLabel('skyborne').text).toBe('Cloudstep');
    expect(translateLabel('arrives:scry 2').text).toContain('Glimpse');
    expect(translateLabel('arrives:scry 2').text).not.toContain('Foresee');
    expect(translateLabel('spell:wrath(fliers)').text).toContain('Cloudstep');

    const tithe = createInitialBuilderState();
    tithe.mechanics.tithe.enabled = true;
    const titheNotes = evaluateBuilder(tithe).warnings.filter((warning) => warning.id.startsWith('tithe'));
    expect(titheNotes.length).toBeGreaterThan(0);
    for (const warning of titheNotes) expect(warning.text).toContain('Offering');

    // A one-mana 2/2 flier is over value, so dropping the keyword is a hint.
    const flier = createInitialBuilderState();
    flier.cost.generic = 0;
    flier.keywords = ['skyborne'];
    const removal = candidateHints(flier).find((hint) => hint.kind === 'remove-keyword');
    expect(removal?.detail).toContain('Cloudstep');
  });
});
