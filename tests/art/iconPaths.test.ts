import { describe, expect, it } from 'vitest';
import { ICON_PATHS, type IconKey } from '../../src/art/iconPaths';

const EXPECTED: IconKey[] = ['W', 'U', 'B', 'R', 'G', 'C', 'T'];

// Conservative SVG path-data grammar: absolute M/L/C/A/Z commands with plain
// decimal coordinates (what Path2D and the offline raster tools both parse).
const PATH_DATA = /^M[MLCAZ0-9 .,-]*Z$/;

describe('icon paths (mana/land/tap iconography)', () => {
  it('defines exactly the expected icon keys', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual([...EXPECTED].sort());
  });

  it('every icon is a non-empty absolute-command path string', () => {
    for (const key of EXPECTED) {
      const p = ICON_PATHS[key];
      expect(p.length, key).toBeGreaterThan(0);
      expect(p, key).toMatch(PATH_DATA);
    }
  });

  it('every subpath is explicitly closed (evenodd-fill safe)', () => {
    for (const key of EXPECTED) {
      const moves = ICON_PATHS[key].match(/M/g)?.length ?? 0;
      const closes = ICON_PATHS[key].match(/Z/g)?.length ?? 0;
      expect(moves, key).toBeGreaterThan(0);
      expect(moves, key).toBe(closes);
    }
  });
});
