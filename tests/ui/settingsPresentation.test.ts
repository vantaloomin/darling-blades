import { afterEach, describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { currentAccessibility, setAccessibility } from '../../src/ui/accessibility';
import {
  ALL_ACCESSIBILITY_CONTROLS,
  ANIM_CHIP_WIDTH,
  NO_ACCESSIBILITY_CONTROLS,
  NO_BLOCK_CHIPS,
  RENDER_CHIP_WIDTH,
  SETTINGS_CONTENT_LIMIT,
  SETTINGS_CONTROL_GAP,
  SETTINGS_FRAMES,
  SETTINGS_HEADER_ACTION,
  SETTINGS_HEADER_LEGAL,
  SETTINGS_LABEL_GAP,
  SETTINGS_LEFT,
  SETTINGS_PANELS,
  SETTINGS_PANEL_BAND,
  SETTINGS_RIGHT,
  SETTINGS_TAB_BASE_WIDTH,
  SETTINGS_TAB_GAP,
  SETTINGS_TAB_ROW,
  SETTINGS_TABS,
  settingsTabLabel,
  SETTINGS_TITLE_TRACK,
  TEXT_SIZE_CHIP_WIDTH,
  TOGGLE_WIDTH,
  YOUR_TURN_SECTION,
  accessibilityControlsShown,
  accessibilityInForce,
  applySavedAccessibility,
  layoutSettingsColumn,
  layoutSettingsTab,
  normalizeSettingsTab,
  rightAlignedControlCenters,
  scaledChipWidth,
  settingsHeaderCenters,
  settingsRhythm,
  settingsRowStacks,
  settingsTabCenters,
  settingsTabColumns,
  VOLUME_BAR_WIDTH,
  volumeStepperXs,
  yourTurnRowY,
  type AccessibilityControlsShown,
  type MeasuredControl,
  type SettingsMeasured,
  type SettingsTab,
  type SettingsTabLayout,
} from '../../src/ui/settingsPresentation';
import { STATS_SETTINGS_ROW } from '../../src/ui/statsPrivacyPresentation';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

const HIT_HALF = theme.control.minHitHeight / 2;
/** docs/design-system.md, "Spacing and grouping": within a group, 8-12px. */
const MIN_GAP_WITHIN = 8;
/** Between distinct groups: 16-24px, plus the heading that names the next one. */
const MIN_GAP_BETWEEN = 16;
/** Content keeps at least this much clear of its panel's bottom edge. */
const MIN_PANEL_INSET = 16;
/** Positions compare at a hundredth of a pixel, so float noise never reads as an overlap. */
const EPS = 0.01;
/**
 * Inter's rendered line height, as a multiple of the font size, measured in
 * Phaser in headless Edge (2026-09-28): 15, 18, 20px at 12, 14, 16px and 20,
 * 23, 26px at 16, 18, 21px. A line box smaller than this clips the glyphs.
 */
const INTER_LINE_HEIGHT = 1.28;

const TABS: readonly SettingsTab[] = SETTINGS_TABS.map((tab) => tab.key);
const SHOWN: readonly [string, AccessibilityControlsShown][] = [
  ['controls shown', ALL_ACCESSIBILITY_CONTROLS],
  ['controls hidden', NO_ACCESSIBILITY_CONTROLS],
  ['text size only', { textSize: true, highContrast: false }],
  ['high contrast only', { textSize: false, highContrast: true }],
];

/**
 * What the scene measured in the rendered check (Inter, headless Edge,
 * 2026-09-28), as the layout's inputs: which rows stacked their controls
 * under the label, and how many lines each caption wrapped to. The layout
 * rules must hold for these, for the spec's defaults (nothing measured), and
 * for the 130% measurement applied at every size (a wider fallback font).
 */
const MEASURED_BY_SCALE: Readonly<Record<number, SettingsMeasured>> = {
  1: { stats: { captionLines: 2 } },
  1.15: { noBlock: { stacked: true }, stats: { captionLines: 2 }, textSize: { captionLines: 2 } },
  1.3: {
    noBlock: { stacked: true },
    stats: { stacked: true, captionLines: 2 },
    animations: { stacked: true },
    renderSize: { stacked: true, captionLines: 2 },
    textSize: { captionLines: 2 },
    landDrop: { captionLines: 2 },
    reset: { captionLines: 2 },
  },
};
const scenarios = (scale: number): [string, SettingsMeasured][] => [
  ['spec', {}],
  ['as rendered', MEASURED_BY_SCALE[scale]],
  ['as rendered at 130%', MEASURED_BY_SCALE[1.3]],
];

afterEach(() => {
  setAccessibility({ textScale: 1, highContrast: false });
});

interface Extent {
  top: number;
  bottom: number;
  what: string;
  heading: boolean;
}

/** Every drawn thing in each column, top to bottom. */
function columnExtents(layout: SettingsTabLayout): Extent[][] {
  const r = settingsRhythm();
  return layout.columns.map((column) => {
    const out: Extent[] = [];
    for (const section of column.sections) {
      const h = column.layout.headings[section.key];
      out.push({ top: h - r.headingHalf, bottom: h + r.headingHalf, what: `heading ${section.key}`, heading: true });
      for (const row of section.rows) {
        const y = column.layout.rows[row.key];
        out.push({ top: y.top, bottom: y.bottom, what: `row ${row.key}`, heading: false });
      }
    }
    return out;
  });
}

/** Every cell of the fixture matrix (tests/ui/a11yCells.ts), with its settings in force. */
function forEveryCell(fn: (at: string, scale: number) => void): void {
  forEachA11yCell((cell) => fn(cell.name, cell.textScale));
}

describe('the rhythm follows the text size', () => {
  it('gives captions, labels and headings line boxes that hold their rendered text at every size', () => {
    forEveryCell((at) => {
      const r = settingsRhythm();
      expect(r.captionLine, at).toBeGreaterThanOrEqual(Math.ceil(theme.type.caption * INTER_LINE_HEIGHT));
      expect(2 * r.labelHalf, at).toBeGreaterThanOrEqual(Math.ceil(theme.type.body * INTER_LINE_HEIGHT));
      expect(2 * r.headingHalf, at).toBeGreaterThanOrEqual(theme.type.h2);
    });
  });

  it('is read at build time: the exported Game columns follow a text-size change', () => {
    const before = SETTINGS_LEFT.rows.landDrop.row - SETTINGS_LEFT.rows.instantCast.row;
    setAccessibility({ textScale: 1.3, highContrast: false });
    const after = SETTINGS_LEFT.rows.landDrop.row - SETTINGS_LEFT.rows.instantCast.row;
    expect(after).toBeGreaterThan(before);
    expect(YOUR_TURN_SECTION.rowPitch).toBe(after);
  });
});

// The Audio tab with and without its Screen section (M8: touch devices whose browser allows full screen).
const TAB_CASES: readonly [string, SettingsTab, boolean][] = TABS.flatMap((tab): [string, SettingsTab, boolean][] =>
  tab === 'audio' ? [[tab, tab, false], ['audio with Screen', tab, true]] : [[tab, tab, false]]);

describe.each(TAB_CASES)('the %s tab', (_name, tab, fullScreen) => {
  for (const [shownName, shown] of SHOWN) {
    it(`sizes the panels to their content, inside the band, with the bottom inset (${shownName}, every size and contrast)`, () => {
      forEveryCell((cell, scale) => {
        for (const [scenario, measured] of scenarios(scale)) {
          const layout = layoutSettingsTab(tab, shown, measured, fullScreen);
          expect(layout.panelBottom, `${cell}, ${scenario}`).toBeLessThanOrEqual(SETTINGS_PANEL_BAND.bottom);
          const lowest = Math.max(...layout.columns.map((column) => column.layout.contentBottom));
          // The air under the lowest content matches the air over the first heading.
          expect(layout.panelBottom - lowest, `${cell}, ${scenario}`).toBeCloseTo(
            layout.columns[0].layout.headings[layout.columns[0].sections[0].key] - settingsRhythm().headingHalf -
              SETTINGS_PANEL_BAND.top,
            6,
          );
          columnExtents(layout).forEach((items, c) => {
            for (const item of items) {
              const at = `${cell}, ${scenario}, column ${c}, ${item.what}`;
              expect(item.top, at).toBeGreaterThanOrEqual(SETTINGS_PANEL_BAND.top + MIN_GAP_BETWEEN - EPS);
              expect(item.bottom, at).toBeLessThanOrEqual(layout.panelBottom - MIN_PANEL_INSET + EPS);
            }
          });
        }
      });
    });

    it(`never overlaps, and separates groups by more than rows (${shownName}, every size and contrast)`, () => {
      forEveryCell((cell, scale) => {
        for (const [scenario, measured] of scenarios(scale)) {
          for (const items of columnExtents(layoutSettingsTab(tab, shown, measured, fullScreen))) {
            for (let i = 1; i < items.length; i++) {
              const gap = items[i].top - items[i - 1].bottom;
              expect(gap, `${cell}, ${scenario}: ${items[i - 1].what} -> ${items[i].what}`).toBeGreaterThanOrEqual(
                (items[i].heading ? MIN_GAP_BETWEEN : MIN_GAP_WITHIN) - EPS,
              );
            }
          }
        }
      });
    });

    it(`keeps each caption under its own controls and a stacked label above them (${shownName})`, () => {
      forEveryCell((cell, scale) => {
        const r = settingsRhythm();
        for (const [scenario, measured] of scenarios(scale)) {
          const layout = layoutSettingsTab(tab, shown, measured, fullScreen);
          for (const column of layout.columns) {
            for (const section of column.sections) {
              for (const spec of section.rows) {
                const y = column.layout.rows[spec.key];
                const at = `${cell}, ${scenario}, ${spec.key}`;
                if (spec.caption) {
                  expect(y.noteTop, at).toBeGreaterThanOrEqual(y.row + theme.control.heightSm / 2 - EPS);
                  expect(y.bottom, at).toBeGreaterThanOrEqual(y.noteTop + y.captionLines * r.captionLine - EPS);
                } else {
                  expect(y.bottom, at).toBe(y.row + HIT_HALF);
                }
                if (measured[spec.key]?.stacked) {
                  expect(y.label + r.labelHalf, at).toBeLessThanOrEqual(y.row - theme.control.heightSm / 2 + EPS);
                } else {
                  expect(y.label, at).toBe(y.row);
                }
              }
            }
          }
        }
      });
    });
  }
});

describe('the overflow budget', () => {
  /**
   * Room for the unmeasured: at every size, every tab still fits (inside the
   * band, above the 16px inset) when each column gets one caption wrapping one
   * line more and one more row stacking than the rendered check measured,
   * over every choice of which caption and which row.
   */
  it('fits one more caption wrap and one more stacked row per column than rendered, on every tab at every size', () => {
    forEveryCell((cell, scale) => {
      const base = MEASURED_BY_SCALE[scale];
      for (const [tabName, tab, fullScreen] of TAB_CASES) {
        for (const [shownName, shown] of SHOWN) {
          const columns = settingsTabColumns(tab, shown, fullScreen);
          const options = columns.map((column) => {
            const rows = column.sections.flatMap((section) => section.rows);
            const wraps = rows.filter((row) => row.caption);
            const stacks = rows.filter((row) => !base[row.key]?.stacked);
            const out: SettingsMeasured[] = [];
            for (const wrap of wraps.length ? wraps : [undefined]) {
              for (const stack of stacks.length ? stacks : [undefined]) {
                const extra: SettingsMeasured = {};
                if (wrap) {
                  const lines = base[wrap.key]?.captionLines ?? 1 + (wrap.captionLines ?? 0);
                  extra[wrap.key] = { ...base[wrap.key], captionLines: lines + 1 };
                }
                if (stack) extra[stack.key] = { ...base[stack.key], ...extra[stack.key], stacked: true };
                out.push(extra);
              }
            }
            return out;
          });
          const combine = (i: number, acc: SettingsMeasured): void => {
            if (i === options.length) {
              const layout = layoutSettingsTab(tab, shown, acc, fullScreen);
              layout.columns.forEach((column, c) => {
                expect(column.layout.contentBottom, `${cell}, ${tabName}, ${shownName}, column ${c}, ${JSON.stringify(acc)}`)
                  .toBeLessThanOrEqual(SETTINGS_CONTENT_LIMIT + EPS);
              });
              return;
            }
            for (const extra of options[i]) combine(i + 1, { ...acc, ...extra });
          };
          combine(0, { ...base });
        }
      }
    });
  });
});

describe('the Game tab', () => {
  it('ends level when it fits: the two last sections share a heading line unless the push would overflow', () => {
    forEveryCell((cell, scale) => {
      for (const [scenario, measured] of scenarios(scale)) {
        const [left, right] = layoutSettingsTab('game', ALL_ACCESSIBILITY_CONTROLS, measured).columns;
        const at = `${cell}, ${scenario}`;
        const level = Math.max(left.layout.headings.privacy, right.layout.headings.saveData);
        const pushedFits = [left, right].every(
          (column) => layoutSettingsColumn(column.sections, SETTINGS_PANELS.top, measured, level).contentBottom <=
            SETTINGS_CONTENT_LIMIT,
        );
        if (pushedFits) expect(left.layout.headings.privacy, at).toBe(right.layout.headings.saveData);
        else {
          // Not levelled: each column keeps its natural height.
          for (const column of [left, right]) {
            expect(column.layout.contentBottom, at).toBe(
              layoutSettingsColumn(column.sections, SETTINGS_PANELS.top, measured).contentBottom,
            );
          }
        }
      }
    });
    // The skip branch is reachable: a long right column and a Privacy caption
    // that wraps further make a push that would overflow while each column fits.
    setAccessibility({ textScale: 1.3, highContrast: false });
    let skipped = 0;
    for (let lines = 2; lines <= 8; lines++) {
      const measured: SettingsMeasured = {
        autoSkip: { stacked: true },
        confirmDestructive: { stacked: true },
        keywordReminders: { stacked: true },
        noBlock: { stacked: true },
        stats: { stacked: true, captionLines: lines },
      };
      const [left, right] = layoutSettingsTab('game', ALL_ACCESSIBILITY_CONTROLS, measured).columns;
      const natural = layoutSettingsColumn(left.sections, SETTINGS_PANELS.top, measured);
      const pushed = layoutSettingsColumn(left.sections, SETTINGS_PANELS.top, measured, right.layout.headings.saveData);
      if (natural.contentBottom <= SETTINGS_CONTENT_LIMIT && pushed.contentBottom > SETTINGS_CONTENT_LIMIT) {
        skipped++;
        expect(left.layout.contentBottom, `${lines} lines`).toBe(natural.contentBottom);
        expect(left.layout.headings.privacy, `${lines} lines`).toBeLessThan(right.layout.headings.saveData);
      }
    }
    expect(skipped).toBeGreaterThan(0);
    // With nothing stacked the last rows share a y too (the Privacy and Reset rows).
    expect(SETTINGS_LEFT.rows.stats.row).toBe(SETTINGS_RIGHT.rows.reset.row);
  });

  it('keeps the Your turn section on the shared rhythm', () => {
    expect(YOUR_TURN_SECTION.headingY).toBe(SETTINGS_LEFT.headings.yourTurn);
    expect(yourTurnRowY(0).row).toBe(SETTINGS_LEFT.rows.instantCast.row);
    expect(yourTurnRowY(1).row).toBe(SETTINGS_LEFT.rows.landDrop.row);
    expect(yourTurnRowY(1).note).toBe(SETTINGS_LEFT.rows.landDrop.note);
  });

  it('mirrors its two panels on the frame gutters, with the same text inset on both sides of each', () => {
    const { left, right } = SETTINGS_FRAMES;
    expect(left.panelWidth).toBe(right.panelWidth);
    expect(left.panelX).toBe(theme.design.safeLeft);
    expect(right.panelX + right.panelWidth).toBe(theme.design.safeRight);
    expect(right.panelX - (left.panelX + left.panelWidth)).toBeGreaterThanOrEqual(MIN_GAP_BETWEEN);
    for (const frame of [left, right]) {
      expect(frame.labelX - frame.panelX).toBe(SETTINGS_PANELS.inset);
      expect(frame.panelX + frame.panelWidth - frame.controlRight).toBe(SETTINGS_PANELS.inset);
    }
  });
});

describe('the Accessibility tab and its ship gates', () => {
  it('holds Text size, High contrast, Animations and Render size, and only Animations and Render size when both are hidden', () => {
    const keys = (shown: AccessibilityControlsShown): string[] =>
      settingsTabColumns('accessibility', shown).flatMap((c) => c.sections.flatMap((s) => s.rows.map((r) => r.key)));
    expect(keys(ALL_ACCESSIBILITY_CONTROLS)).toEqual(['textSize', 'highContrast', 'animations', 'renderSize']);
    expect(keys(NO_ACCESSIBILITY_CONTROLS)).toEqual(['animations', 'renderSize']);
    expect(keys({ textSize: false, highContrast: true })).toEqual(['highContrast', 'animations', 'renderSize']);
    // And nowhere else: the Game tab no longer carries the display rows.
    const game = settingsTabColumns('game', ALL_ACCESSIBILITY_CONTROLS).flatMap((c) =>
      c.sections.flatMap((s) => s.rows.map((r) => r.key)),
    );
    expect(game).not.toContain('animations');
    expect(game).not.toContain('renderSize');
  });

  it('leaves no gap where a hidden row would be: the first row follows the heading as the first row does when shown', () => {
    forEveryCell((cell) => {
      const r = settingsRhythm();
      const firstGap = (shown: AccessibilityControlsShown): number => {
        const { layout, sections } = layoutSettingsTab('accessibility', shown).columns[0];
        const first = sections[0].rows[0].key;
        return layout.rows[first].top - (layout.headings[sections[0].key] + r.headingHalf);
      };
      expect(firstGap(NO_ACCESSIBILITY_CONTROLS), cell).toBe(firstGap(ALL_ACCESSIBILITY_CONTROLS));
      const hidden = layoutSettingsTab('accessibility', NO_ACCESSIBILITY_CONTROLS).columns[0].layout;
      const shown = layoutSettingsTab('accessibility', ALL_ACCESSIBILITY_CONTROLS).columns[0].layout;
      expect(hidden.rows.renderSize.bottom - hidden.rows.animations.top, cell).toBe(
        shown.rows.renderSize.bottom - shown.rows.animations.top,
      );
    });
  });

  it('shows both controls in a dev build and each by its own switch in production', () => {
    const off = { textSizeLive: false, highContrastLive: false };
    expect(accessibilityControlsShown(true, off)).toEqual({ textSize: true, highContrast: true });
    expect(accessibilityControlsShown(false, off)).toEqual({ textSize: false, highContrast: false });
    expect(accessibilityControlsShown(false, { textSizeLive: false, highContrastLive: true })).toEqual({
      textSize: false,
      highContrast: true,
    });
    expect(accessibilityControlsShown(false, { textSizeLive: true, highContrastLive: false })).toEqual({
      textSize: true,
      highContrast: false,
    });
  });

  it('puts a hidden control at its default and a shown one at the saved value', () => {
    const saved = { textScale: 1.3, highContrast: true };
    expect(accessibilityInForce(saved, NO_ACCESSIBILITY_CONTROLS)).toEqual({ textScale: 1, highContrast: false });
    expect(accessibilityInForce(saved, ALL_ACCESSIBILITY_CONTROLS)).toEqual(saved);
    expect(accessibilityInForce(saved, { textSize: false, highContrast: true })).toEqual({
      textScale: 1,
      highContrast: true,
    });
  });

  it('applies, in a production build, exactly the saved values whose switch is live', () => {
    applySavedAccessibility({ textScale: 1.3, highContrast: true }, false);
    expect(currentAccessibility()).toEqual({
      textScale: FEATURES.textSizeLive ? 1.3 : 1,
      highContrast: FEATURES.highContrastLive,
    });
  });

  it('applies a saved size and contrast in a dev build (the boot and import hook)', () => {
    applySavedAccessibility({ textScale: 1.15, highContrast: true }, true);
    expect(currentAccessibility()).toEqual({ textScale: 1.15, highContrast: true });
    expect(theme.type.body).toBeGreaterThan(theme.typeBase.body);
  });

});

describe('the tab row', () => {
  it('opens Game unless a known tab is asked for', () => {
    expect(normalizeSettingsTab(undefined)).toBe('game');
    expect(normalizeSettingsTab('nonsense')).toBe('game');
    expect(normalizeSettingsTab('accessibility')).toBe('accessibility');
  });

  it('sits between the header and the panels, and the header status line clears it at every size', () => {
    forEveryCell((at) => {
      expect(SETTINGS_TAB_ROW.top, at).toBeGreaterThan(SETTINGS_HEADER_ACTION.y + HIT_HALF);
      expect(SETTINGS_HEADER_ACTION.statusY + settingsRhythm().captionLine / 2, at).toBeLessThanOrEqual(
        SETTINGS_TAB_ROW.top,
      );
      expect(SETTINGS_TAB_ROW.bottom + MIN_GAP_WITHIN, at).toBeLessThanOrEqual(SETTINGS_PANELS.top);
    });
  });

  it('names the Audio tab "Audio & screen" only when it carries the Screen section', () => {
    expect(SETTINGS_TABS.map((tab) => settingsTabLabel(tab, true))).toEqual(['Game', 'Audio & screen', 'Accessibility']);
    expect(SETTINGS_TABS.map((tab) => settingsTabLabel(tab, false))).toEqual(['Game', 'Audio', 'Accessibility']);
  });

  it('keeps the three tabs centred, disjoint by the gap, and inside the frame at every plausible width', () => {
    forEveryCell((at) => {
      const floor = scaledChipWidth(SETTINGS_TAB_BASE_WIDTH);
      for (let wide = floor; wide <= floor + 120; wide += 8) {
        const widths = [floor, floor, wide];
        const centers = settingsTabCenters(widths);
        const boxes = centers.map((c, i) => ({ left: c - widths[i] / 2, right: c + widths[i] / 2 }));
        expect((boxes[0].left + boxes[2].right) / 2, at).toBeCloseTo(theme.design.centerX, 6);
        for (let i = 1; i < boxes.length; i++) {
          expect(boxes[i].left - boxes[i - 1].right, at).toBeGreaterThanOrEqual(SETTINGS_TAB_GAP - EPS);
        }
        expect(boxes[0].left, at).toBeGreaterThanOrEqual(theme.design.safeLeft);
        expect(boxes[2].right, at).toBeLessThanOrEqual(theme.design.safeRight);
      }
    });
  });
});

/** A themed button's widths for a label: the visual box and the 90px hit floor. */
function control(visualWidth: number): MeasuredControl {
  return { visualWidth, hitWidth: Math.max(visualWidth, theme.control.minHitWidth) };
}

describe('the chip groups, placed from measured widths', () => {
  const groups: [string, number[]][] = [
    ['no-block', NO_BLOCK_CHIPS.map((chip) => chip.baseWidth)],
    ['animations', [ANIM_CHIP_WIDTH, ANIM_CHIP_WIDTH, ANIM_CHIP_WIDTH]],
    ['render size', [RENDER_CHIP_WIDTH, RENDER_CHIP_WIDTH, RENDER_CHIP_WIDTH]],
    ['text size', [TEXT_SIZE_CHIP_WIDTH, TEXT_SIZE_CHIP_WIDTH, TEXT_SIZE_CHIP_WIDTH]],
  ];

  /**
   * Measure-then-place: the rule has to hold for label widths other fonts can
   * produce, not only the ones this machine rendered. In Inter every chip
   * label fits its scaled floor at every size (rendered check, 2026-09-28),
   * so each chip's measured width sweeps from its floor to 20% past it.
   */
  it.each(groups)('keeps the %s chips on the control edge, hit boxes disjoint, inside the column, at every size', (_name, bases) => {
    forEveryCell((at) => {
      for (const frame of [SETTINGS_FRAMES.right, SETTINGS_FRAMES.center]) {
        for (let grow = 1; grow <= 1.2 + EPS; grow += 0.05) {
          const controls = bases.map((base) => control(Math.round(scaledChipWidth(base) * grow)));
          const centers = rightAlignedControlCenters(controls, frame.controlRight);
          const last = controls.length - 1;
          expect(centers[last] + controls[last].visualWidth / 2, at).toBeCloseTo(frame.controlRight, 6);
          for (let i = 1; i < controls.length; i++) {
            const gap = centers[i] - controls[i].hitWidth / 2 - (centers[i - 1] + controls[i - 1].hitWidth / 2);
            expect(gap, `${at}, x${grow.toFixed(1)}`).toBeGreaterThanOrEqual(SETTINGS_CONTROL_GAP - EPS);
          }
          // The group always fits the column's text track, stacked under its label if need be.
          expect(centers[0] - controls[0].visualWidth / 2, `${at}, x${grow.toFixed(1)}`).toBeGreaterThanOrEqual(
            frame.labelX,
          );
          expect(centers[last] + controls[last].hitWidth / 2, at).toBeLessThanOrEqual(frame.panelX + frame.panelWidth);
        }
      }
    });
  });

  it('stacks a row exactly when its label would come within the label gap of its controls', () => {
    const labelX = SETTINGS_FRAMES.right.labelX;
    const controlsLeft = 900;
    const fits = controlsLeft - SETTINGS_LABEL_GAP - labelX;
    expect(settingsRowStacks(labelX, fits, controlsLeft)).toBe(false);
    expect(settingsRowStacks(labelX, fits + 1, controlsLeft)).toBe(true);
  });
});

describe('the Privacy pair and the volume stepper', () => {
  it('right-aligns the Privacy pair: the toggle on the control edge, the button clear of it, both inside the column', () => {
    const frame = SETTINGS_FRAMES.left;
    const toggle = control(TOGGLE_WIDTH);
    for (let visual = STATS_SETTINGS_ROW.buttonMinWidth; visual <= 180; visual += 2) {
      const button = control(visual);
      const [buttonX, toggleX] = rightAlignedControlCenters([button, toggle], frame.controlRight);
      const at = `button ${visual}`;
      expect(toggleX + toggle.visualWidth / 2, at).toBeCloseTo(frame.controlRight, 6);
      expect(toggleX - toggle.hitWidth / 2 - (buttonX + button.hitWidth / 2), at).toBeGreaterThanOrEqual(
        SETTINGS_CONTROL_GAP - EPS,
      );
      expect(buttonX - button.visualWidth / 2, at).toBeGreaterThanOrEqual(frame.labelX);
    }
  });

  it('right-aligns the volume stepper to the control edge, buttons clear of the bar, the group inside the column', () => {
    for (const frame of [SETTINGS_FRAMES.center, SETTINGS_FRAMES.left]) {
      const button = control(44);
      const xs = volumeStepperXs(VOLUME_BAR_WIDTH, button.visualWidth, frame);
      expect(xs.plusX + button.visualWidth / 2).toBeCloseTo(frame.controlRight, 6);
      expect(xs.barLeft - (xs.minusX + button.visualWidth / 2)).toBeGreaterThanOrEqual(MIN_GAP_WITHIN);
      expect(xs.plusX - button.visualWidth / 2 - (xs.barLeft + VOLUME_BAR_WIDTH)).toBeGreaterThanOrEqual(MIN_GAP_WITHIN);
      expect(xs.plusX - button.hitWidth / 2 - (xs.minusX + button.hitWidth / 2)).toBeGreaterThanOrEqual(
        SETTINGS_CONTROL_GAP,
      );
      expect(xs.minusX - button.visualWidth / 2).toBeGreaterThanOrEqual(frame.labelX);
    }
  });
});

describe('the header actions', () => {
  it('sits on the title row, inside the title-safe frame, above the tab row', () => {
    forEveryCell((at) => {
      expect(SETTINGS_HEADER_ACTION.right, at).toBeLessThanOrEqual(theme.design.safeRight);
      expect(SETTINGS_HEADER_ACTION.y - HIT_HALF, at).toBeGreaterThanOrEqual(theme.design.safeTop);
      expect(SETTINGS_HEADER_LEGAL.y, at).toBe(SETTINGS_HEADER_ACTION.y);
    });
  });

  /**
   * Both labels are text-width dependent, so the pair is placed from measured
   * widths (playbook's measure-then-place trap). The rule has to hold for every
   * plausible pair of widths, not for the one this machine's fonts produce.
   */
  it('keeps the pair inside the frame, disjoint, and clear of the title', () => {
    for (let legalWidth = SETTINGS_HEADER_LEGAL.minWidth; legalWidth <= 150; legalWidth += 2) {
      for (let updateWidth = SETTINGS_HEADER_ACTION.minWidth; updateWidth <= 220; updateWidth += 2) {
        const at = `${legalWidth}/${updateWidth}`;
        const { legalX, updateX } = settingsHeaderCenters(legalWidth, updateWidth);
        const legal = { left: legalX - legalWidth / 2, right: legalX + legalWidth / 2 };
        const update = { left: updateX - updateWidth / 2, right: updateX + updateWidth / 2 };

        expect(update.right, at).toBeLessThanOrEqual(theme.design.safeRight);
        expect(update.right, at).toBe(SETTINGS_HEADER_ACTION.right);
        expect(update.left - legal.right, at).toBeGreaterThanOrEqual(MIN_GAP_WITHIN);
        expect(
          legal.left,
          `${at}: the pair must clear the centred title's track`,
        ).toBeGreaterThanOrEqual(SETTINGS_TITLE_TRACK.centerX + SETTINGS_TITLE_TRACK.halfWidth);
        for (const box of [legal, update]) {
          expect(box.left, at).toBeGreaterThanOrEqual(theme.design.safeLeft);
        }
      }
    }
  });
});
