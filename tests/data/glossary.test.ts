import { describe, expect, it } from 'vitest';
import {
  GLOSSARY_SECTIONS,
  KEYWORD_NAMES,
  MECHANIC_DEFINITIONS,
  MECHANIC_NAMES,
  PHASE_DEFINITIONS,
  cardMechanics,
  cardTermNames,
  glossarySection,
  sectionOfTerm,
  termMatchesQuery,
  type MechanicId,
} from '../../src/data/glossary';
import { CARD_DB } from '../../src/data/catalog';
import { cardGlossaryEntries } from '../../src/ui/rulesText';
import type { CardDef, Keyword } from '../../src/engine/types';

const collectible = (Object.values(CARD_DB) as CardDef[]).filter((d) => !d.token);

describe('glossary vocabulary', () => {
  it('gives every keyword a name, a reminder, and a Combat Traits row', () => {
    const combat = glossarySection('combat');
    const keywords = Object.keys(KEYWORD_NAMES) as Keyword[];
    expect(combat.terms.map((term) => term.name)).toEqual(keywords.map((k) => KEYWORD_NAMES[k]));
    for (const term of combat.terms) expect(term.description.length).toBeGreaterThan(0);
  });

  /** The old page listed ten of twelve mechanics; Mark, Rite, Nine Lives and
   *  Preserve had no glossary row at all. */
  it('gives every named mechanic a Mechanics row', () => {
    const listed = new Set(glossarySection('mechanics').terms.map((term) => term.name));
    for (const id of Object.keys(MECHANIC_NAMES) as MechanicId[]) {
      expect(listed.has(MECHANIC_NAMES[id])).toBe(true);
      expect(MECHANIC_DEFINITIONS[id].length).toBeGreaterThan(0);
    }
  });

  it('keeps every term name unique across the whole glossary', () => {
    const names = GLOSSARY_SECTIONS.flatMap((section) => section.terms.map((term) => term.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps player-facing copy free of em-dashes', () => {
    for (const section of GLOSSARY_SECTIONS) {
      for (const term of section.terms) {
        expect(term.name).not.toContain('—');
        expect(term.description).not.toContain('—');
      }
      expect(section.note ?? '').not.toContain('—');
    }
  });

  it('resolves the Deck Builder deep-link targets to a section', () => {
    expect(sectionOfTerm('Darlings')).toBe('mechanics');
    expect(sectionOfTerm('Warchest')).toBe('mechanics');
    expect(sectionOfTerm('Skyborne')).toBe('combat');
    expect(sectionOfTerm('Not A Term')).toBeNull();
  });

  it('matches a query against both the term name and its definition', () => {
    const dreaded = glossarySection('combat').terms.find((term) => term.name === 'Dreaded')!;
    expect(termMatchesQuery(dreaded, '')).toBe(true);
    expect(termMatchesQuery(dreaded, 'dread')).toBe(true);
    expect(termMatchesQuery(dreaded, 'two or more')).toBe(true);
    expect(termMatchesQuery(dreaded, 'skyborne')).toBe(false);
  });

  it('teaches the day-cycle phase names without legacy Upkeep or End rows', () => {
    const phases = glossarySection('phases');
    expect(phases.terms.map((term) => term.name)).toEqual([
      'Dawn', 'Morning', 'Combat', 'Afternoon', 'Sunset',
    ]);
    expect(phases.terms.map((term) => term.description)).toEqual([
      PHASE_DEFINITIONS.dawn,
      PHASE_DEFINITIONS.morning,
      PHASE_DEFINITIONS.combat,
      PHASE_DEFINITIONS.afternoon,
      PHASE_DEFINITIONS.sunset,
    ]);
    expect(phases.terms.some((term) => /Upkeep|End/.test(term.name))).toBe(false);
    expect(sectionOfTerm('Dawn')).toBe('phases');
    expect(sectionOfTerm('Morning')).toBe('phases');
    expect(sectionOfTerm('Afternoon')).toBe('phases');
    expect(sectionOfTerm('Sunset')).toBe('phases');
  });
});

describe('cardMechanics', () => {
  it('reads mechanics off structured fields, not generated prose', () => {
    const morrigan = CARD_DB['cf-morrigan-black-wing']; // severGrave + foresee
    expect(cardMechanics(morrigan)).toEqual(['foresee', 'sever']);
  });

  it('teaches Mark alongside Nine Lives, since the return carries a mark', () => {
    const nineLives = collectible.find((d) => d.nineLives)!;
    expect(cardMechanics(nineLives)).toContain('nineLives');
    expect(cardMechanics(nineLives)).toContain('mark');
  });

  it('teaches Sever for Retell and Preserve, whose costs sever the card', () => {
    const retell = collectible.find((d) => d.retell)!;
    expect(cardMechanics(retell)).toContain('sever');
    const preserve = collectible.find((d) => d.preserve)!;
    expect(cardMechanics(preserve)).toContain('sever');
  });

  it('agrees with the card-inspect Keyword Guide on every collectible card', () => {
    for (const card of collectible) {
      const guide = new Set(cardGlossaryEntries(card).map((entry) => entry.name));
      for (const mechanic of cardMechanics(card)) {
        expect(guide.has(MECHANIC_NAMES[mechanic])).toBe(true);
      }
    }
  });
});

describe('cardTermNames', () => {
  it('spells terms the way the card face does', () => {
    const nineLives = collectible.find((d) => d.nineLives)!;
    expect(cardTermNames(nineLives)).toContain('Nine Lives');
    const twin = collectible.find((d) => d.keywords?.includes('twinBlades'))!;
    expect(cardTermNames(twin)).toContain('Twin Blades');
  });

  it('includes keywords a card grants, not only the ones it prints', () => {
    const granter = collectible.find(
      (d) => !d.keywords?.length && d.abilities?.some((ab) => (ab.static?.grantKeywords ?? []).length > 0),
    );
    // The catalog is expected to contain at least one pure granter; if a future
    // set removes them all this assertion is the signal, not a silent skip.
    expect(granter).toBeDefined();
    expect(cardTermNames(granter!).length).toBeGreaterThan(0);
  });

  it('never returns a duplicate term', () => {
    for (const card of collectible) {
      const names = cardTermNames(card);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
