import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { SET_IDS, SET_TITLES } from '../../src/data/setTitles';
import { theme } from '../../src/ui/theme';
import { dropdownPanelWidth, TITLE_SAFE_EDGES, dropdownPopoverLayout } from '../../src/ui/layout';

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
    const trigger = { x: 55, y: 104, width: 193, height: theme.control.minHitHeight };
    // One row per set, plus the leading "All sets" row. The content-sized
    // renderer uses two equal columns after that leading row. 122px is the
    // measured 14px/w700 width of the current longest set title, and 193px is
    // the fixed Set trigger width with its caption, value, and chevron slot.
    const panelWidth = dropdownPanelWidth(trigger.width, 122, SET_IDS.length + 1);
    const layout = dropdownPopoverLayout(trigger, SET_IDS.length + 1, { panelWidth });

    expect(layout.panel.y).toBeGreaterThanOrEqual(TITLE_SAFE_EDGES.top);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(TITLE_SAFE_EDGES.bottom);
    expect(layout.rows).toHaveLength(SET_IDS.length + 1);
    expect(layout.columns).toBe(2);
    expect(panelWidth).toBe(348);
    expect(layout.panel.width).toBe(348);
    expect(layout.panel.height).toBe(329);
    expect(layout.rows[0]).toEqual({ x: 72, y: 164, width: 332, height: 44 });
    expect(layout.rows[1]).toEqual({ x: 72, y: 217, width: 162, height: 44 });
    expect(layout.rows[6]).toEqual({ x: 242, y: 217, width: 162, height: 44 });
  });
});
