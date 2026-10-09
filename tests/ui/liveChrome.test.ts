import { afterEach, describe, expect, it } from 'vitest';
import { setAccessibility } from '../../src/ui/accessibility';
import {
  controlFontSize,
  controlStrokeWidth,
  themedButtonColors,
  tabUnderline,
  triggerSelectedMark,
  listRowAccentBar,
  type ThemedButtonVariant,
} from '../../src/ui/controlStyle';
import {
  controlPadding,
  isRectContained,
  measureThemedButton,
  SCENE_TITLE,
  type ControlSize,
  type Rect,
} from '../../src/ui/layout';
import { textBlockHeight } from '../../src/ui/profilePresentation';
import { theme } from '../../src/ui/theme';
import { gauntletTowerLayout } from '../../src/ui/layout';
import { forEachA11yCell } from './a11yCells';

/**
 * The shared chrome reads its tokens when it draws, not at import (1.9 lane C,
 * C3), so a control built after a text-size or contrast change takes the new
 * values. These are the Phaser-free halves of `themeWidgets`: the button
 * colours, the border width, the label size and the rounded trigger's
 * selected mark.
 */

afterEach(() => {
  setAccessibility({ textScale: 1, highContrast: false });
});

const VARIANTS: readonly ThemedButtonVariant[] = ['primary', 'emphasis', 'ghost', 'danger', 'selected'];
const SIZES: readonly ControlSize[] = ['sm', 'md'];

/**
 * Golden compatibility fixture: `themeWidgets`' BUTTON_STYLE as release/1.9
 * built it at import. At standard contrast every button keeps these colours.
 */
const RELEASE_1_9_BUTTON_STYLE: Record<ThemedButtonVariant, { bg: string; fg: string; stroke: string; hoverStroke: string }> = {
  primary: { bg: '#ffd88a', fg: '#1a1426', stroke: '#ffd700', hoverStroke: '#f0e6ff' },
  emphasis: { bg: '#2c2344', fg: '#ffd88a', stroke: '#4a3f6e', hoverStroke: '#ffd700' },
  ghost: { bg: '#241d3a', fg: '#c9bde0', stroke: '#4a3f6e', hoverStroke: '#ffd700' },
  danger: { bg: '#3a1f28', fg: '#f0b0a0', stroke: '#f08a8a', hoverStroke: '#f0b0a0' },
  // Added 2026-10-08 (the selection language): the on state of a toggle,
  // segment or tab, filled but never in the primary action's gold.
  selected: { bg: '#2c2344', fg: '#ffd88a', stroke: '#ffd88a', hoverStroke: '#f0e6ff' },
};

describe('the shared button colours', () => {
  it('keep release/1.9\'s colours at standard contrast', () => {
    for (const variant of VARIANTS) expect(themedButtonColors(variant), variant).toEqual(RELEASE_1_9_BUTTON_STYLE[variant]);
  });

  it('take the high-contrast palette for a button drawn after the switch', () => {
    setAccessibility({ textScale: 1, highContrast: true });
    // The approved high-contrast panel stroke and armed danger (plan Q4).
    expect(themedButtonColors('ghost').stroke).toBe('#7768a8');
    expect(themedButtonColors('emphasis').stroke).toBe('#7768a8');
    expect(themedButtonColors('danger').stroke).toBe('#f29d9d');
    setAccessibility({ textScale: 1, highContrast: false });
    expect(themedButtonColors('ghost').stroke).toBe(RELEASE_1_9_BUTTON_STYLE.ghost.stroke);
  });
});

describe('the shared control border', () => {
  it('gives primary and danger hover a 2px border, with every idle border unchanged', () => {
    forEachA11yCell(() => {
      for (const variant of VARIANTS) expect(controlStrokeWidth(false, variant)).toBe(1);
      for (const variant of ['primary', 'danger'] as const) expect(controlStrokeWidth(true, variant)).toBe(2);
    });
  });
  it('stays the 1px border idle and hovered at standard contrast', () => {
    expect(controlStrokeWidth(false)).toBe(theme.control.borderWidth);
    expect(controlStrokeWidth(true)).toBe(theme.control.borderWidth);
  });

  /**
   * High contrast makes chrome opaque, so the idle stroke loses its alpha
   * step and hover would differ by colour alone (within 1.2:1 on the
   * primary and danger buttons).
   */
  it('thickens the hovered stroke in high contrast, so hover does not rest on colour', () => {
    setAccessibility({ textScale: 1, highContrast: true });
    expect(controlStrokeWidth(false)).toBe(theme.control.borderWidth);
    expect(controlStrokeWidth(true)).toBeGreaterThan(controlStrokeWidth(false));
  });
});

describe('the shared control label size', () => {
  it('is caption on a small control and label on a medium one, at the text size in force', () => {
    expect(controlFontSize('sm')).toBe(12);
    expect(controlFontSize('md')).toBe(14);
    setAccessibility({ textScale: 1.3, highContrast: false });
    // The approved role table at Largest: caption 16, label 18.
    expect(controlFontSize('sm')).toBe(16);
    expect(controlFontSize('md')).toBe(18);
  });
});

describe('the scene title size', () => {
  it('is the h1 role in force: 28, 30 at Large, 32 at Largest', () => {
    expect(SCENE_TITLE.fontSize).toBe(28);
    setAccessibility({ textScale: 1.15, highContrast: false });
    expect(SCENE_TITLE.fontSize).toBe(30);
    setAccessibility({ textScale: 1.3, highContrast: false });
    expect(SCENE_TITLE.fontSize).toBe(32);
  });
});

describe('the rounded trigger\'s selected mark', () => {
  const bottom = (r: Rect): number => r.y + r.height;

  /** Every trigger shape in use: both sizes, short and long labels, with and without a minimum width. */
  function cases(): { size: ControlSize; labelWidth: number; minWidth: number }[] {
    const out: { size: ControlSize; labelWidth: number; minWidth: number }[] = [];
    for (const size of SIZES) {
      for (const labelWidth of [8, 24, 60, 120, 200]) {
        for (const minWidth of [0, 96, 150]) out.push({ size, labelWidth, minWidth });
      }
    }
    return out;
  }

  it("sits on the trigger's bottom edge, at least 1px clear of the label box, at every text size and contrast", () => {
    forEachA11yCell((cell) => {
      for (const { size, labelWidth, minWidth } of cases()) {
        const at = `${size} ${labelWidth}/${minWidth}, ${cell.name}`;
        const padding = controlPadding(size);
        const { visual } = measureThemedButton(labelWidth, size, minWidth, padding);
        const mark = triggerSelectedMark({ visual, labelWidth, padding });
        // Inside the trigger's padded box (so it never moves or resizes it), on its bottom edge.
        const padded: Rect = { x: visual.x + padding, y: visual.y, width: visual.width - 2 * padding, height: visual.height };
        expect(isRectContained(mark, padded), at).toBe(true);
        expect(bottom(mark), at).toBe(bottom(visual));
        // The label's line box, as the layout modules size a line of text, centred on the trigger.
        const labelBottom = visual.y + visual.height / 2 + textBlockHeight(controlFontSize(size), 1) / 2;
        expect(mark.y - labelBottom, at).toBeGreaterThanOrEqual(1);
        expect(mark.x + mark.width / 2, at).toBeCloseTo(visual.x + visual.width / 2, 9);
        expect(mark.height, at).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it('is a short mark under the label, not a stripe across the trigger', () => {
    for (const { size, labelWidth, minWidth } of cases()) {
      const padding = controlPadding(size);
      const { visual } = measureThemedButton(labelWidth, size, minWidth, padding);
      const mark = triggerSelectedMark({ visual, labelWidth, padding });
      expect(mark.width, `${size} ${labelWidth}/${minWidth}`).toBeLessThanOrEqual(Math.max(labelWidth, theme.space(3)));
      expect(mark.width, `${size} ${labelWidth}/${minWidth}`).toBeLessThan(visual.width);
    }
  });

  it('is thicker in high contrast', () => {
    const { visual } = measureThemedButton(60, 'md');
    const input = { visual, labelWidth: 60, padding: controlPadding('md') };
    const standard = triggerSelectedMark(input).height;
    setAccessibility({ textScale: 1, highContrast: true });
    expect(triggerSelectedMark(input).height).toBeGreaterThan(standard);
  });
});

describe('the list row accent bar', () => {
  it('sits inside the row border, clear of its top, bottom and the row label', () => {
    forEachA11yCell(() => {
      for (const [visual, border, labelInset] of [
        [{ x: 0, y: 0, width: 420, height: 56 }, theme.outline.state, gauntletTowerLayout(28, { x: 0, y: 0, width: 420, height: 484 }).labelX],
        [{ x: 64, y: -30, width: 772, height: 60 }, theme.control.borderWidth, theme.space(4)],
      ] as const) {
        const bar = listRowAccentBar(visual, border);
        expect(bar.x).toBeGreaterThanOrEqual(visual.x + border);
        expect(bar.y).toBeGreaterThan(visual.y + border);
        expect(bar.y + bar.height).toBeLessThan(visual.y + visual.height - border);
        expect(bar.height).toBeGreaterThan(visual.height / 2);
        expect(visual.x + labelInset - (bar.x + bar.width)).toBeGreaterThanOrEqual(theme.space(1));
      }
    });
  });
});

describe('the text tab underline', () => {
  it('spans the whole label on the tab plate\'s bottom edge, clear of the label and the rounded corners', () => {
    forEachA11yCell((cell) => {
      for (const size of ['sm', 'md'] as const) {
        for (const [labelWidth, minWidth] of [[40, 0], [90, 120], [150, 160], [220, 0]] as const) {
          const at = `${size} ${labelWidth}/${minWidth}, ${cell.name}`;
          const { visual } = measureThemedButton(labelWidth, size, minWidth);
          const bar = tabUnderline(visual, labelWidth);
          expect(bar.y + bar.height, at).toBe(visual.y + visual.height);
          expect(bar.width, at).toBeGreaterThanOrEqual(labelWidth);
          expect(bar.x, at).toBeGreaterThanOrEqual(visual.x + theme.radius.control);
          expect(bar.x + bar.width, at).toBeLessThanOrEqual(visual.x + visual.width - theme.radius.control);
          const labelBottom = visual.y + visual.height / 2 + textBlockHeight(controlFontSize(size), 1) / 2;
          expect(bar.y - labelBottom, at).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  it('is thicker in high contrast', () => {
    const { visual } = measureThemedButton(60, 'md');
    const standard = tabUnderline(visual, 60).height;
    setAccessibility({ textScale: 1, highContrast: true });
    expect(tabUnderline(visual, 60).height).toBeGreaterThan(standard);
  });
});
