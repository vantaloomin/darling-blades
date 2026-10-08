import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { KEYWORD_NAMES, cardTermNames } from '../../src/data/glossary';
import { SET_IDS, type SetId } from '../../src/data/setTitles';
import type { AbilityDef, CardDef, Keyword } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';

/**
 * Keyword coverage: every set carries every evergreen keyword (owner,
 * 2026-09-29: "every new set must carry all 13 keywords, starting with First
 * Dawn"). The required list is the closed `Keyword` union itself, read through
 * KEYWORD_NAMES, so a keyword added later is required of every set at once.
 *
 * "Carrying" a keyword means at least one collectible card of the set (not a
 * token, not a basic land) teaches it, as the glossary's own term extraction
 * reads the card: a printed keyword, or one the card grants to creatures (a
 * lord's static, a boost op, a Champion Awakening, a Hauntlink rider). That is
 * `cardTermNames`, the same vocabulary the card face and Collection search
 * use. A token the card creates does not count: the token is not in the set.
 *
 * Shipped sets that failed when this check landed are grandfathered below,
 * with the exact keywords each lacks. The list is a ratchet in both
 * directions: a grandfathered set that gains a missing keyword fails until
 * that keyword is struck from its entry (and the entry is removed once it is
 * empty), and one that loses a keyword it carried fails too. A set that is not
 * listed (First Dawn and every later set) must carry all of them.
 */
const GRANDFATHERED_GAPS: Partial<Record<SetId, readonly Keyword[]>> = {
  base: ['dreaded'],
  ragnarok: ['bulwark', 'untouchable', 'dreaded'],
  'celtic-fae': ['twinBlades', 'rage'],
  'arthurian-court': ['dreaded', 'rage'],
  'gothic-monsters': ['twinBlades'],
  'dark-tales': ['twinBlades', 'rage'],
  'yokai-nights': ['rage'],
  'sands-of-the-duat': ['firstBlade', 'deathblade', 'rage'],
  starborne: ['rage'],
  'drowned-deep': ['twinBlades', 'bloodoath'],
};

const EVERGREEN = Object.keys(KEYWORD_NAMES) as Keyword[];

function inSetPool(card: CardDef): boolean {
  return !card.token && !(card.supertypes?.includes('basic') ?? false);
}

/** Set ids the catalog stamps, plus any declared set that has no cards yet. */
const CHECKED_SETS: readonly string[] = [
  ...new Set<string>([...SET_IDS, ...ALL_CARDS.map((card) => card.set ?? 'base')]),
];

function missingKeywords(setId: string): Keyword[] {
  const taught = new Set(
    ALL_CARDS.filter((card) => (card.set ?? 'base') === setId && inSetPool(card)).flatMap(cardTermNames),
  );
  return EVERGREEN.filter((keyword) => !taught.has(KEYWORD_NAMES[keyword]));
}

const names = (keywords: readonly Keyword[]): string =>
  keywords.map((keyword) => KEYWORD_NAMES[keyword]).join(', ');

describe('keyword coverage: every set carries every evergreen keyword', () => {
  it.each(CHECKED_SETS)('%s carries every keyword outside its grandfathered gaps', (setId) => {
    const missing = missingKeywords(setId);
    const allowed = GRANDFATHERED_GAPS[setId as SetId] ?? [];
    const uncovered = missing.filter((keyword) => !allowed.includes(keyword));
    const backfilled = allowed.filter((keyword) => !missing.includes(keyword));
    const problems: string[] = [];
    if (uncovered.length > 0) {
      problems.push(`${setId} has no collectible card carrying: ${names(uncovered)}`);
    }
    if (backfilled.length > 0) {
      problems.push(
        `${setId} now carries ${names(backfilled)}: strike ${backfilled.length === 1 ? 'it' : 'them'} from ` +
          `GRANDFATHERED_GAPS${backfilled.length === allowed.length ? ' (and remove the entry)' : ''}`,
      );
    }
    expect(problems, problems.join('; ')).toEqual([]);
  });

  it('counts a keyword a raise grants, as the card face prints it', () => {
    // Both raise forms print the grant ("... It has Dreaded"), so the card
    // carries the keyword for coverage and for Collection search alike.
    const ritual = (ability: AbilityDef): CardDef => ({
      id: 'keyword-coverage-raise-fixture', name: 'Raise Fixture', types: ['ritual'],
      subtypes: [], colors: ['B'], rarity: 'c', cost: { generic: 1, pips: { B: 1 } }, abilities: [ability],
    });
    const raiseTarget = ritual({
      when: 'spell', targets: [{ what: 'yourGraveCreature' }],
      ops: [{ op: 'raise', to: 'target', grantKeywords: ['dreaded'] }],
    });
    const raiseTop = ritual({ when: 'spell', ops: [{ op: 'raise', to: 'top', grantKeywords: ['rage'] }] });
    expect(rulesText(raiseTarget)).toContain(KEYWORD_NAMES.dreaded);
    expect(cardTermNames(raiseTarget)).toContain(KEYWORD_NAMES.dreaded);
    expect(rulesText(raiseTop)).toContain(KEYWORD_NAMES.rage);
    expect(cardTermNames(raiseTop)).toContain(KEYWORD_NAMES.rage);
  });
});
