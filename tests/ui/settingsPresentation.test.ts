import { describe, expect, it } from 'vitest';
import {
  ANIM_CHIP_WIDTH,
  ANIM_CHIP_X,
  NO_BLOCK_CHIPS,
  NO_BLOCK_LABEL_TRACK,
  RENDER_CHIP_WIDTH,
  RENDER_CHIP_X,
  RIGHT_TOGGLE_X,
  SETTINGS_COLUMNS,
  SETTINGS_GAMEPLAY_PANEL,
  SETTINGS_HEADER_ACTION,
  SETTINGS_LEFT,
  SETTINGS_LEFT_SECTIONS,
  SETTINGS_PANELS,
  SETTINGS_PANEL_BAND,
  SETTINGS_RESET_BLOCK,
  SETTINGS_RIGHT,
  SETTINGS_RIGHT_SECTIONS,
  YOUR_TURN_SECTION,
  layoutSettingsColumn,
  rightAlignedChipCenters,
  settingsChipBounds,
  yourTurnRowY,
  type SettingsColumnLayout,
  type SettingsSectionSpec,
} from '../../src/ui/settingsPresentation';
import { theme } from '../../src/ui/theme';

const HIT_HALF = theme.control.minHitHeight / 2;
const HEADING_HALF = theme.type.h2 / 2;
/** docs/design-system.md, "Spacing and grouping": within a group, 8-12px. */
const MIN_GAP_WITHIN = 8;
/** Between distinct groups: 16-24px, plus the heading that names the next one. */
const MIN_GAP_BETWEEN = 16;
/** Content keeps at least this much clear of its panel's bottom edge. */
const MIN_PANEL_INSET = 16;

/** Every drawn thing in a column, top to bottom, as [top, bottom, what]. */
function extents(sections: readonly SettingsSectionSpec[], col: SettingsColumnLayout): [number, number, string][] {
  const out: [number, number, string][] = [];
  for (const section of sections) {
    const h = col.headings[section.key];
    out.push([h - HEADING_HALF, h + HEADING_HALF, `heading ${section.key}`]);
    for (const row of section.rows) {
      const r = col.rows[row.key];
      out.push([r.row - HIT_HALF, r.bottom, `row ${row.key}`]);
    }
  }
  return out;
}

describe.each([
  ['left', SETTINGS_LEFT_SECTIONS, SETTINGS_LEFT],
  ['right', SETTINGS_RIGHT_SECTIONS, SETTINGS_RIGHT],
])('the %s settings column', (_name, sections, col) => {
  const items = extents(sections, col);

  it('keeps everything inside the panel band with an inset at the bottom', () => {
    for (const [top, bottom, what] of items) {
      expect(top, what).toBeGreaterThanOrEqual(SETTINGS_PANEL_BAND.top + MIN_GAP_BETWEEN);
      expect(bottom, what).toBeLessThanOrEqual(SETTINGS_PANEL_BAND.bottom - MIN_PANEL_INSET);
    }
    expect(col.contentBottom).toBeLessThanOrEqual(SETTINGS_PANEL_BAND.bottom - MIN_PANEL_INSET);
    expect(SETTINGS_PANEL_BAND.bottom).toBeLessThanOrEqual(theme.design.safeBottom);
  });

  it('never overlaps, and separates groups by more than it separates rows', () => {
    for (let i = 1; i < items.length; i++) {
      const gap = items[i][0] - items[i - 1][1];
      const startsGroup = items[i][2].startsWith('heading');
      expect(gap, `${items[i - 1][2]} -> ${items[i][2]}`).toBeGreaterThanOrEqual(
        startsGroup ? MIN_GAP_BETWEEN : MIN_GAP_WITHIN,
      );
    }
  });

  it('gives every row the same caption offset and keeps a caption under its own row', () => {
    const firstRow = col.rows[sections[0].rows[0].key];
    for (const section of sections) {
      for (const row of section.rows) {
        const r = col.rows[row.key];
        expect(r.note - r.row).toBe(firstRow.note - firstRow.row);
        expect(r.noteTop).toBeGreaterThanOrEqual(r.row + theme.control.heightSm / 2);
        if (!row.caption) expect(r.bottom).toBe(r.row + HIT_HALF);
      }
    }
  });
});

describe('the two columns', () => {
  it('share one panel band, the same heading position, and mirrored insets', () => {
    expect(SETTINGS_LEFT.headings.audio).toBe(SETTINGS_RIGHT.headings.gameplay);
    expect(SETTINGS_PANELS.left.width).toBe(SETTINGS_PANELS.right.width);
    expect(SETTINGS_PANELS.left.x + SETTINGS_PANELS.left.width).toBeLessThan(SETTINGS_PANELS.right.x);
    expect(SETTINGS_COLUMNS.left.labelX - SETTINGS_PANELS.left.x).toBe(SETTINGS_PANELS.inset);
    expect(SETTINGS_COLUMNS.right.labelX - SETTINGS_PANELS.right.x).toBe(SETTINGS_PANELS.inset);
    expect(SETTINGS_PANELS.right.x + SETTINGS_PANELS.right.width - SETTINGS_COLUMNS.right.controlRight).toBe(
      SETTINGS_PANELS.inset,
    );
  });

  it('end level: both last rows share a y', () => {
    expect(SETTINGS_LEFT.rows.stats.row).toBe(SETTINGS_RIGHT.rows.reset.row);
  });

  it('is a pure function of the rhythm, and both columns are full', () => {
    // Documents the headroom, as the old test did: one more plain row in either
    // column breaks the bottom inset, so a new setting is a layout decision
    // (a third column, a shorter caption, or a row that moves), never a free one.
    for (const sections of [SETTINGS_LEFT_SECTIONS, SETTINGS_RIGHT_SECTIONS]) {
      const last = sections[sections.length - 1];
      const grown = layoutSettingsColumn([
        ...sections.slice(0, -1),
        { ...last, rows: [...last.rows, { key: 'extra' }] },
      ]);
      expect(grown.contentBottom).toBeGreaterThan(SETTINGS_PANEL_BAND.bottom - MIN_PANEL_INSET);
    }
  });
});

describe('the "Your turn" section', () => {
  it('reads the shared rhythm', () => {
    expect(YOUR_TURN_SECTION.headingY).toBe(SETTINGS_LEFT.headings.yourTurn);
    expect(yourTurnRowY(0).row).toBe(SETTINGS_LEFT.rows.instantCast.row);
    expect(yourTurnRowY(1).row).toBe(SETTINGS_LEFT.rows.landDrop.row);
    expect(yourTurnRowY(1).note).toBe(SETTINGS_LEFT.rows.landDrop.note);
  });
});

describe('the right column controls', () => {
  it('share one right edge: toggles, all three chip groups, and the reset button', () => {
    const right = SETTINGS_COLUMNS.right.controlRight;
    expect(RIGHT_TOGGLE_X + theme.control.minHitWidth / 2).toBe(right);
    expect(ANIM_CHIP_X[2] + ANIM_CHIP_WIDTH / 2).toBe(right);
    expect(RENDER_CHIP_X[2] + RENDER_CHIP_WIDTH / 2).toBe(right);
    expect(settingsChipBounds(NO_BLOCK_CHIPS[2]).right).toBe(right);
    expect(SETTINGS_RESET_BLOCK.buttonRight).toBe(right);
  });

  it('keeps every chip inside the panel inset and clear of its label', () => {
    for (const chip of NO_BLOCK_CHIPS) {
      const b = settingsChipBounds(chip);
      expect(b.left, chip.value).toBeGreaterThanOrEqual(NO_BLOCK_LABEL_TRACK.right);
      expect(b.right, chip.value).toBeLessThanOrEqual(SETTINGS_GAMEPLAY_PANEL.right - SETTINGS_PANELS.inset);
    }
    for (const x of [...ANIM_CHIP_X, ...RENDER_CHIP_X]) {
      expect(x - RENDER_CHIP_WIDTH / 2).toBeGreaterThan(SETTINGS_COLUMNS.right.labelX + 130);
    }
  });

  it('keeps sibling chips disjoint with the within-group gap', () => {
    const b = NO_BLOCK_CHIPS.map(settingsChipBounds);
    for (let i = 1; i < b.length; i++) expect(b[i].left - b[i - 1].right).toBeGreaterThanOrEqual(MIN_GAP_WITHIN);
    expect(rightAlignedChipCenters([10, 20, 30], 100)).toEqual([100 - 30 - 8 - 20 - 8 - 5, 100 - 30 - 8 - 10, 85]);
  });
});

describe('the header action', () => {
  it('sits on the title row, inside the title-safe frame, above the panels', () => {
    expect(SETTINGS_HEADER_ACTION.right).toBeLessThanOrEqual(theme.design.safeRight);
    expect(SETTINGS_HEADER_ACTION.y - HIT_HALF).toBeGreaterThanOrEqual(theme.design.safeTop);
    expect(SETTINGS_HEADER_ACTION.statusY + theme.type.caption / 2).toBeLessThan(SETTINGS_PANELS.top);
  });
});
