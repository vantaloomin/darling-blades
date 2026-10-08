/**
 * The shared controls' live style (1.9 lane C, C3): the button colours, the
 * border width, the label size and the rounded trigger's selected mark, read
 * from the tokens in force each time a control draws. Phaser-free, so the
 * rules are testable; `themeWidgets.ts` draws with them.
 */

import { currentAccessibility } from './accessibility';
import type { ControlSize, Rect } from './layout';
import { theme } from './theme';

/** The label size of the shared button recipes: caption on a small control, label on a medium one. */
export function controlFontSize(size: ControlSize): number {
  return size === 'sm' ? theme.type.caption : theme.type.label;
}

/**
 * `selected` is the on state of a toggle, segment or tab (the selection
 * language ruled 2026-10-08): a filled plate with a gold border and label,
 * never the gold fill, which belongs to a screen's one primary action.
 */
export type ThemedButtonVariant = 'primary' | 'emphasis' | 'ghost' | 'danger' | 'selected';

export interface ThemedButtonColors {
  bg: string;
  fg: string;
  stroke: string;
  hoverStroke: string;
}

/**
 * The shared button's colours for a variant, from the palette in force. Read
 * per draw (never kept in a module-level constant), so a control drawn after a
 * contrast change takes the new palette.
 */
export function themedButtonColors(variant: ThemedButtonVariant): ThemedButtonColors {
  const c = theme.colors;
  switch (variant) {
    case 'primary':
      return { bg: c.btnPrimaryBg, fg: c.onGold, stroke: c.goldHover, hoverStroke: c.heading };
    case 'emphasis':
      return { bg: c.btnEmphasisBg, fg: c.gold, stroke: c.panelStroke, hoverStroke: c.goldHover };
    case 'ghost':
      return { bg: c.btnGhostBg, fg: c.body, stroke: c.panelStroke, hoverStroke: c.goldHover };
    case 'danger':
      return { bg: c.dangerBg, fg: c.danger, stroke: c.dangerArmed, hoverStroke: c.danger };
    case 'selected':
      return { bg: c.rowFillActive, fg: c.gold, stroke: c.gold, hoverStroke: c.heading };
  }
}

/**
 * A shared control's border width, idle or hovered/pressed. In standard
 * contrast primary and danger also thicken on hover (A9); the other variants
 * keep their colour/alpha step. Idle borders stay unchanged in both palettes.
 */
export function controlStrokeWidth(active: boolean, variant?: ThemedButtonVariant): number {
  const base = theme.control.borderWidth;
  return active && (currentAccessibility().highContrast || variant === 'primary' || variant === 'danger') ? base + 1 : base;
}

/**
 * The selected mark on a rounded trigger (a filter tab or chip): a short gold
 * bar under the label, so "selected" does not rest on colour alone (the
 * selected fill is 1.09:1 from the idle one, and the gold label 1.30:1 from
 * the idle label). 2px thick, 3px in high contrast.
 */
export const TRIGGER_SELECTED_MARK = {
  thickness: 2,
  highContrastThickness: 3,
  /** Half the label's width, never shorter than this. */
  minWidth: theme.space(3),
} as const;

export interface TriggerSelectedMarkInput {
  /** The trigger's visual box, centred on the label (as `measureThemedButton` returns it). */
  visual: Rect;
  labelWidth: number;
  padding: number;
}

/**
 * Where the selected bar goes: on the trigger's bottom edge, drawn over the
 * border (a tab underline), centred under the label. Sitting on the edge
 * keeps it as far from the label's descenders as the trigger allows, and it
 * never moves or resizes the trigger. It is half the label's width (a mark,
 * not a stripe), clamped to the padded inside of the trigger.
 */
export function triggerSelectedMark(input: TriggerSelectedMarkInput): Rect {
  const { visual, labelWidth, padding } = input;
  const thickness = currentAccessibility().highContrast
    ? TRIGGER_SELECTED_MARK.highContrastThickness
    : TRIGGER_SELECTED_MARK.thickness;
  const innerWidth = Math.max(0, visual.width - 2 * padding);
  const width = Math.min(innerWidth, Math.max(TRIGGER_SELECTED_MARK.minWidth, Math.round(labelWidth / 2)));
  return {
    x: visual.x + visual.width / 2 - width / 2,
    y: visual.y + visual.height - thickness,
    width,
    height: thickness,
  };
}

/**
 * The selected mark on a list row (the selection language ruled 2026-10-08:
 * border plus a left accent bar for list rows, the underline for text tabs):
 * a gold bar just inside the row's left border, inset from its top and
 * bottom, so the mark never sits under the label as a tab's does.
 */
export const LIST_ROW_ACCENT = {
  width: theme.space(1),
  inset: theme.space(1.5),
} as const;

export function listRowAccentBar(visual: Rect, borderWidth: number = theme.control.borderWidth): Rect {
  const inset = borderWidth + LIST_ROW_ACCENT.inset;
  return {
    x: visual.x + borderWidth + theme.space(1),
    y: visual.y + inset,
    width: LIST_ROW_ACCENT.width,
    height: Math.max(0, visual.height - 2 * inset),
  };
}
