import { describe, expect, it } from 'vitest';
import { SET_ICON_PATHS, type CardSetId } from '../../src/art/setIcons';
import { SET_IDS } from '../../src/data/setTitles';

// Derived from the data layer's single source of set ids, so a new set that
// ships without an icon (or an icon for a set that does not exist) fails here.
const EXPECTED = SET_IDS as readonly CardSetId[];

// Matches the absolute-only path contract documented by setIcons.ts.
const PATH_DATA = /^M[MLCAZ0-9 .,-]*Z$/;

describe('set icon paths', () => {
  it('gives every live set an icon and defines no icon without a set', () => {
    expect(Object.keys(SET_ICON_PATHS).sort()).toEqual([...EXPECTED].sort());
  });

  it('every icon is a non-empty absolute-command path string', () => {
    for (const set of EXPECTED) {
      const path = SET_ICON_PATHS[set];
      expect(path.length, set).toBeGreaterThan(0);
      expect(path, set).toMatch(PATH_DATA);
    }
  });

  it('every subpath is explicitly closed for evenodd fill', () => {
    for (const set of EXPECTED) {
      const moves = SET_ICON_PATHS[set].match(/M/g)?.length ?? 0;
      const closes = SET_ICON_PATHS[set].match(/Z/g)?.length ?? 0;
      expect(moves, set).toBeGreaterThan(0);
      expect(moves, set).toBe(closes);
    }
  });
});
