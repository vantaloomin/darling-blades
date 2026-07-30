import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { SET_IDS, SET_TITLES } from '../../src/data/setTitles';
import { theme } from '../../src/ui/theme';
import { TITLE_SAFE_EDGES, dropdownPopoverLayout } from '../../src/ui/layout';

/**
 * The Collection binder's set filter (src/ui/binder/FilterBar.ts) kept its own
 * hand-written copy of the set list and silently fell two sets behind, so
 * roughly 240 Dark Tales and Yokai Nights cards could not be isolated by set.
 * The filter now derives its options from SET_IDS; these tests guard the two
 * ways that fix can still rot.
 */
describe('Collection binder set filter', () => {
  it('SET_IDS covers every set present in the catalog', () => {
    const inCatalog = new Set(ALL_CARDS.map((card) => card.set ?? 'base'));
    const listed = new Set<string>(SET_IDS);
    const missing = [...inCatalog].filter((set) => !listed.has(set));
    expect(missing, `sets shipped but absent from SET_IDS: ${missing.join(', ')}`).toEqual([]);
  });

  it('every listed set has a player-facing title', () => {
    for (const id of SET_IDS) {
      expect(SET_TITLES[id], `title for ${id}`).toBeTruthy();
    }
  });

  it('the set dropdown still fits the title-safe frame with every set listed', () => {
    // Mirrors the binder's own control: FilterBar places the Set dropdown at
    // x 55 on the filter row, and CollectionScene puts that row at y 104.
    const trigger = { x: 55, y: 104, width: 92, height: theme.control.minHitHeight };
    // One row per set, plus the leading "All Sets" row.
    const layout = dropdownPopoverLayout(trigger, SET_IDS.length + 1, { panelWidth: trigger.width });

    expect(layout.panel.y).toBeGreaterThanOrEqual(TITLE_SAFE_EDGES.top);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(TITLE_SAFE_EDGES.bottom);
    expect(layout.rows).toHaveLength(SET_IDS.length + 1);
  });
});
