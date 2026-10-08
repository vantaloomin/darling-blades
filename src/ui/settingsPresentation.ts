import { FEATURES } from '../config/features';
import { DEFAULT_TEXT_SCALE, TEXT_SCALES, type TextScale } from '../meta/accessibilitySettings';
import type { ConfirmNoBlockSetting } from '../meta/SaveManager';
import { setAccessibility, type AccessibilityInput, type AccessibilitySettings } from './accessibility';
import { theme } from './theme';

/**
 * The Settings scene's layout, derived from the design-system tokens
 * (docs/design-system.md, "Alignment and isolation space") instead of being
 * pinned row by row. Every row inside a column comes from the same rhythm, so
 * the isolation space between a caption and the next control, or between one
 * section and the next, is the same number everywhere.
 *
 * The scene had grown three coordinate systems by 1.8 (a row generator, two
 * hand-pinned constant blocks, and literal numbers), and the crowding the
 * owner flagged on the 1.8 QC day (2026-09-21) was the sum of them: the
 * Privacy heading ran into the caption above it, the Reset block sat on the
 * Gameplay panel's border, and the update control hung outside every panel.
 *
 * 1.9 (lane C, C4): three tabs (Game, Audio, Accessibility; plan Q1), and the
 * rhythm is computed when the scene builds, never at import, with every
 * vertical term that depends on a type size read through the accessibility
 * resolver, so the layout follows the player's text size. A row whose
 * controls no longer fit beside its label stacks the controls under the
 * label, and captions are laid out from their measured line counts: the scene
 * measures, this module places.
 */

// ---------------------------------------------------------------------------
// The rhythm
// ---------------------------------------------------------------------------

/** Half the 44px hit floor: a control row's half-height. Not a type term. */
const HIT_HALF = theme.control.minHitHeight / 2; // 22
/** Within one group: between a control's hit box and its neighbour. */
const GAP_WITHIN = theme.space(3); // 12
/** Between distinct groups, on top of the heading that names the next one. */
const GAP_BETWEEN = theme.space(6); // 24
/** Clear space between a `sm` control's visual box and the caption under it (or a stacked label over it). */
const CAPTION_CLEAR = 3;

/** A line box for text of `size`: the size plus a third of it as leading (12 -> 16). */
export function settingsLineBox(size: number): number {
  return size + Math.round(size / 3);
}

/**
 * The rhythm's type-dependent terms at the text size in force. A function,
 * not a constant: it is read when a scene builds, so a text-size change
 * reaches it on the next build.
 */
export interface SettingsRhythm {
  /** Half a section heading's size. */
  headingHalf: number;
  /** One caption line's box (the caption size plus its leading; 16 at 100%). */
  captionLine: number;
  /** A caption's first-line centre sits this far under its row's centre (26 at 100%). */
  captionOffset: number;
  /** Half a row label's line box, for a row whose controls stack under it. */
  labelHalf: number;
}

export function settingsRhythm(): SettingsRhythm {
  const captionLine = settingsLineBox(theme.type.caption);
  return {
    headingHalf: theme.type.h2 / 2,
    captionLine,
    captionOffset: theme.control.heightSm / 2 + CAPTION_CLEAR + captionLine / 2,
    labelHalf: settingsLineBox(theme.type.body) / 2,
  };
}

// ---------------------------------------------------------------------------
// Frame: the tab row and the panels
// ---------------------------------------------------------------------------

/** The tab row sits on the band under the 72px title row, above the panels. */
const TAB_ROW_TOP = 124;
const PANEL_INSET = theme.space(10); // 40
/** Between the Game tab's two panels: the between-groups gap. */
const PANEL_GAP = GAP_BETWEEN;
/** Each Game tab panel: half the title-safe width less the gap, so the pair spans the frame. */
const HALF_PANEL_WIDTH = (theme.design.safeRight - theme.design.safeLeft - PANEL_GAP) / 2; // 564
/**
 * A one-column tab's panel: wide enough that its chip rows sit beside their
 * labels at 130% (at 540 Animations and Render size stacked while Text size
 * did not, so one panel read two ways).
 */
const CENTER_PANEL_WIDTH = 760;

export const SETTINGS_TAB_ROW = {
  top: TAB_ROW_TOP,
  /** Centre of the tab controls' 44px hit boxes. */
  y: TAB_ROW_TOP + HIT_HALF, // 146
  bottom: TAB_ROW_TOP + theme.control.minHitHeight, // 168
} as const;

/**
 * The panels: under the tab row by the within-group gap. They are sized to
 * their content (`SettingsTabLayout.panelBottom`), never past the title-safe
 * bottom; the Game tab's pair sits on the frame's 64 and 1216 gutters.
 */
export const SETTINGS_PANELS = {
  top: SETTINGS_TAB_ROW.bottom + GAP_WITHIN, // 180
  /** The furthest a panel may reach: the title-safe bottom. */
  bottom: theme.design.safeBottom, // 684
  inset: PANEL_INSET,
  /** The Game tab's two mirrored panels. */
  left: { x: theme.design.safeLeft, width: HALF_PANEL_WIDTH },
  right: { x: theme.design.safeRight - HALF_PANEL_WIDTH, width: HALF_PANEL_WIDTH },
  /** The single panel of a one-column tab (Audio, Accessibility), centred. */
  center: { x: theme.design.centerX - CENTER_PANEL_WIDTH / 2, width: CENTER_PANEL_WIDTH },
} as const;

/** Every panel shares one vertical band. */
export const SETTINGS_PANEL_BAND = { top: SETTINGS_PANELS.top, bottom: SETTINGS_PANELS.bottom } as const;
export const SETTINGS_LEFT_PANEL_BAND = SETTINGS_PANEL_BAND;
export const SETTINGS_LEFT_PANEL = {
  x: SETTINGS_PANELS.left.x,
  y: SETTINGS_PANELS.top,
  width: SETTINGS_PANELS.left.width,
  height: SETTINGS_PANELS.bottom - SETTINGS_PANELS.top,
} as const;
export const SETTINGS_GAMEPLAY_PANEL = {
  left: SETTINGS_PANELS.right.x,
  right: SETTINGS_PANELS.right.x + SETTINGS_PANELS.right.width,
} as const;

/**
 * A panel's text column: labels at the left inset, every control
 * right-aligned to the right inset. One rule on every tab (the left column
 * used to centre its toggles on an axis mid-panel while the right column
 * right-aligned them).
 */
export interface SettingsColumnFrame {
  panelX: number;
  panelWidth: number;
  labelX: number;
  /** The right text inset: every row's controls end here. */
  controlRight: number;
}

function columnFrame(panel: { x: number; width: number }): SettingsColumnFrame {
  return {
    panelX: panel.x,
    panelWidth: panel.width,
    labelX: panel.x + PANEL_INSET,
    controlRight: panel.x + panel.width - PANEL_INSET,
  };
}

export const SETTINGS_FRAMES = {
  left: columnFrame(SETTINGS_PANELS.left), // labels 104, controls end 588
  right: columnFrame(SETTINGS_PANELS.right), // labels 692, controls end 1176
  center: columnFrame(SETTINGS_PANELS.center), // labels 300, controls end 980
} as const;

/** The Game tab's text columns, by their long-standing names. */
export const SETTINGS_COLUMNS = {
  left: {
    labelX: SETTINGS_FRAMES.left.labelX,
    controlRight: SETTINGS_FRAMES.left.controlRight,
  },
  right: {
    labelX: SETTINGS_FRAMES.right.labelX,
    controlRight: SETTINGS_FRAMES.right.controlRight,
  },
} as const;

/** A caption wraps inside its column's text track. */
export function captionWrapWidth(frame: SettingsColumnFrame): number {
  return frame.controlRight - frame.labelX;
}

// ---------------------------------------------------------------------------
// The ship gates for the two new controls
// ---------------------------------------------------------------------------

/**
 * Which of the two new Accessibility controls this build shows. The saved
 * fields exist either way; a hidden control leaves its field at the default
 * and the rows below it close up (plan, "The ship gate").
 */
export interface AccessibilityControlsShown {
  readonly textSize: boolean;
  readonly highContrast: boolean;
}

export const ALL_ACCESSIBILITY_CONTROLS: AccessibilityControlsShown = { textSize: true, highContrast: true };
export const NO_ACCESSIBILITY_CONTROLS: AccessibilityControlsShown = { textSize: false, highContrast: false };

/**
 * The two ship gates, independently: a dev build shows both controls; a
 * production build shows each only once its own switch is live
 * (`FEATURES.textSizeLive`, `FEATURES.highContrastLive`).
 */
export function accessibilityControlsShown(
  devBuild: boolean,
  features: { readonly textSizeLive: boolean; readonly highContrastLive: boolean } = FEATURES,
): AccessibilityControlsShown {
  return { textSize: devBuild || features.textSizeLive, highContrast: devBuild || features.highContrastLive };
}

/**
 * The settings to put in force: the saved value for each shown control, the
 * default for a hidden one. A save carrying 130% into a build that hides the
 * control (an imported dev save, say) must not leave the player in a size
 * they have no control to undo.
 */
export function accessibilityInForce(
  saved: AccessibilityInput,
  shown: AccessibilityControlsShown,
): AccessibilityInput {
  return {
    textScale: shown.textSize ? saved.textScale : DEFAULT_TEXT_SCALE,
    highContrast: shown.highContrast ? saved.highContrast : false,
  };
}

/**
 * The one hook that boot, a replaced save and the Settings controls share:
 * put the saved accessibility settings in force (through the ship gates) so
 * every scene built after it reads them. Returns the settings now in force.
 */
export function applySavedAccessibility(saved: AccessibilityInput, devBuild: boolean): AccessibilitySettings {
  return setAccessibility(accessibilityInForce(saved, accessibilityControlsShown(devBuild)));
}

// ---------------------------------------------------------------------------
// Tabs and their sections
// ---------------------------------------------------------------------------

export type SettingsTab = 'game' | 'audio' | 'accessibility';

export const SETTINGS_TABS: readonly { key: SettingsTab; label: string }[] = [
  { key: 'game', label: 'Game' },
  { key: 'audio', label: 'Audio' },
  { key: 'accessibility', label: 'Accessibility' },
];

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'game';

/** A12: the instruction follows the device's card-preview gesture. */
export function settingsTextSizeCaption(touch: boolean): string {
  return touch
    ? 'Makes menus and help text larger. Hold a card to read it up close.'
    : 'Makes menus and help text larger. Hover over a card to read it up close.';
}

/** Anything that is not a tab's key opens the default tab. */
export function normalizeSettingsTab(value: unknown): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.key === value) ? (value as SettingsTab) : DEFAULT_SETTINGS_TAB;
}

export type SettingsRowKey =
  | 'sfx'
  | 'volume'
  | 'music'
  | 'instantCast'
  | 'landDrop'
  | 'stats'
  | 'autoSkip'
  | 'confirmDestructive'
  | 'keywordReminders'
  | 'noBlock'
  | 'reset'
  | 'textSize'
  | 'highContrast'
  | 'animations'
  | 'renderSize';

export interface SettingsRowSpec {
  key: SettingsRowKey;
  /** The row carries a caption under it. */
  caption?: boolean;
  /** Extra caption lines beyond the first, before measurement (the Privacy caption wraps to two). */
  captionLines?: number;
}
export interface SettingsSectionSpec {
  key: string;
  title: string;
  rows: readonly SettingsRowSpec[];
}
export interface SettingsColumnSpec {
  frame: SettingsColumnFrame;
  sections: readonly SettingsSectionSpec[];
}

/** The Game tab's left column. */
export const SETTINGS_LEFT_SECTIONS: readonly SettingsSectionSpec[] = [
  {
    key: 'yourTurn',
    title: 'Your turn',
    rows: [
      { key: 'instantCast', caption: true },
      { key: 'landDrop', caption: true },
    ],
  },
  { key: 'privacy', title: 'Privacy', rows: [{ key: 'stats', caption: true, captionLines: 1 }] },
];

/** The Game tab's right column. */
export const SETTINGS_RIGHT_SECTIONS: readonly SettingsSectionSpec[] = [
  {
    key: 'gameplay',
    title: 'Gameplay',
    rows: [{ key: 'autoSkip' }, { key: 'confirmDestructive' }, { key: 'keywordReminders' }, { key: 'noBlock' }],
  },
  { key: 'saveData', title: 'Save data', rows: [{ key: 'reset', caption: true }] },
];

export const SETTINGS_AUDIO_SECTIONS: readonly SettingsSectionSpec[] = [
  { key: 'audio', title: 'Audio', rows: [{ key: 'sfx' }, { key: 'volume', caption: true }, { key: 'music' }] },
];

/** The Accessibility tab's one section; a hidden control's row is simply absent. */
export function settingsAccessibilitySections(shown: AccessibilityControlsShown): readonly SettingsSectionSpec[] {
  const rows: SettingsRowSpec[] = [];
  if (shown.textSize) rows.push({ key: 'textSize', caption: true });
  if (shown.highContrast) rows.push({ key: 'highContrast', caption: true });
  rows.push({ key: 'animations', caption: true }, { key: 'renderSize', caption: true });
  return [{ key: 'display', title: 'Display', rows }];
}

/** Every tab's columns, left to right. */
export function settingsTabColumns(
  tab: SettingsTab,
  shown: AccessibilityControlsShown,
): readonly SettingsColumnSpec[] {
  switch (tab) {
    case 'game':
      return [
        { frame: SETTINGS_FRAMES.left, sections: SETTINGS_LEFT_SECTIONS },
        { frame: SETTINGS_FRAMES.right, sections: SETTINGS_RIGHT_SECTIONS },
      ];
    case 'audio':
      return [{ frame: SETTINGS_FRAMES.center, sections: SETTINGS_AUDIO_SECTIONS }];
    case 'accessibility':
      return [{ frame: SETTINGS_FRAMES.center, sections: settingsAccessibilitySections(shown) }];
  }
}

// ---------------------------------------------------------------------------
// Column layout
// ---------------------------------------------------------------------------

/** What the scene measured for one row. Absent: the spec's caption lines, not stacked. */
export interface SettingsRowMeasure {
  /** The caption's rendered line count at the column's wrap width. */
  captionLines?: number;
  /** The controls do not fit beside the label, so they sit on a line under it. */
  stacked?: boolean;
}
export type SettingsMeasured = Partial<Record<SettingsRowKey, SettingsRowMeasure>>;

export interface SettingsRowY {
  /** The row's control centre (and label centre, unless the row is stacked). */
  row: number;
  /** The row label's centre: `row`, or a line above it when the controls stack. */
  label: number;
  /** Centre of the caption's first line. */
  note: number;
  /** Top of the caption box, for a caption drawn with origin (0, 0). */
  noteTop: number;
  /** Highest design-space y anything in this row reaches. */
  top: number;
  /** Lowest design-space y anything in this row reaches. */
  bottom: number;
  /** Caption lines laid out (0 when the row has no caption). */
  captionLines: number;
  stacked: boolean;
}
export interface SettingsColumnLayout {
  headings: Readonly<Record<string, number>>;
  rows: Readonly<Record<string, SettingsRowY>>;
  /** Lowest y any content reaches; the panel bottom minus this is the inset. */
  contentBottom: number;
}

/**
 * Lay a column out top to bottom. Every gap is one of the two named gaps, and
 * the next thing's top is always measured from the lowest extent of the thing
 * above it, so a captioned row and a plain row give their neighbours the same
 * isolation space. `lastHeadingAt` pushes the last section's heading down to
 * a shared line (a two-column tab ends level).
 */
export function layoutSettingsColumn(
  sections: readonly SettingsSectionSpec[],
  panelTop: number = SETTINGS_PANELS.top,
  measured: SettingsMeasured = {},
  lastHeadingAt?: number,
): SettingsColumnLayout {
  const r = settingsRhythm();
  const headings: Record<string, number> = {};
  const rows: Record<string, SettingsRowY> = {};
  let extent = panelTop;
  sections.forEach((section, index) => {
    let headingY = extent + GAP_BETWEEN + r.headingHalf;
    if (index === sections.length - 1 && lastHeadingAt !== undefined) headingY = Math.max(headingY, lastHeadingAt);
    headings[section.key] = headingY;
    extent = headingY + r.headingHalf;
    for (const spec of section.rows) {
      const m = measured[spec.key] ?? {};
      const stacked = m.stacked === true;
      const label = stacked ? extent + GAP_WITHIN + r.labelHalf : extent + GAP_WITHIN + HIT_HALF;
      // A stacked row's controls sit under the label line the way its caption
      // sits under them: the visual box one clear step away. The 44px hit box
      // reaches up over the label, which is not a target.
      const row = stacked ? label + r.labelHalf + CAPTION_CLEAR + theme.control.heightSm / 2 : label;
      const top = stacked ? label - r.labelHalf : row - HIT_HALF;
      const note = row + r.captionOffset;
      const noteTop = note - r.captionLine / 2;
      const lines = spec.caption ? Math.max(1, m.captionLines ?? 1 + (spec.captionLines ?? 0)) : 0;
      const bottom = Math.max(row + HIT_HALF, lines > 0 ? noteTop + lines * r.captionLine : 0);
      rows[spec.key] = { row, label, note, noteTop, top, bottom, captionLines: lines, stacked };
      extent = bottom;
    }
  });
  return { headings, rows, contentBottom: extent };
}

export interface SettingsTabLayout {
  tab: SettingsTab;
  columns: readonly (SettingsColumnSpec & { layout: SettingsColumnLayout })[];
  /**
   * Where every panel on the tab ends: the between-groups gap under the
   * lowest content (the same air the first heading has above it), shared by
   * both Game panels so they end level, never past the title-safe bottom.
   * The panels used to run to 684 whatever they held, leaving the Audio
   * panel two-thirds empty.
   */
  panelBottom: number;
}

/** The lowest y content may reach: the panel bottom less the 16px inset. */
export const SETTINGS_CONTENT_LIMIT = SETTINGS_PANELS.bottom - theme.space(4); // 668

/**
 * One tab's layout at the text size in force. A two-column tab ends level
 * when it fits: the columns' last sections (Privacy and Save data on the
 * Game tab) share a heading line, whichever column runs longer, unless
 * pushing the shorter column down would take it past the content limit, in
 * which case every column keeps its own natural height.
 */
export function layoutSettingsTab(
  tab: SettingsTab,
  shown: AccessibilityControlsShown = ALL_ACCESSIBILITY_CONTROLS,
  measured: SettingsMeasured = {},
): SettingsTabLayout {
  const specs = settingsTabColumns(tab, shown);
  let layouts = specs.map((spec) => layoutSettingsColumn(spec.sections, SETTINGS_PANELS.top, measured));
  if (specs.length > 1) {
    const level = Math.max(
      ...specs.map((spec, i) => layouts[i].headings[spec.sections[spec.sections.length - 1].key]),
    );
    const levelled = specs.map((spec) => layoutSettingsColumn(spec.sections, SETTINGS_PANELS.top, measured, level));
    if (levelled.every((layout) => layout.contentBottom <= SETTINGS_CONTENT_LIMIT)) layouts = levelled;
  }
  const lowest = Math.max(...layouts.map((layout) => layout.contentBottom));
  return {
    tab,
    columns: specs.map((spec, i) => ({ ...spec, layout: layouts[i] })),
    panelBottom: Math.min(SETTINGS_PANELS.bottom, lowest + GAP_BETWEEN),
  };
}

/**
 * The Game tab's columns at the text size in force, by their long-standing
 * names. Getters, so a read follows the current text size (the Privacy row in
 * statsPrivacyPresentation.ts and its tests read these).
 */
function gameColumn(index: 0 | 1): SettingsColumnLayout {
  return layoutSettingsTab('game').columns[index].layout;
}
export const SETTINGS_LEFT: SettingsColumnLayout = {
  get headings() {
    return gameColumn(0).headings;
  },
  get rows() {
    return gameColumn(0).rows;
  },
  get contentBottom() {
    return gameColumn(0).contentBottom;
  },
};
export const SETTINGS_RIGHT: SettingsColumnLayout = {
  get headings() {
    return gameColumn(1).headings;
  },
  get rows() {
    return gameColumn(1).rows;
  },
  get contentBottom() {
    return gameColumn(1).contentBottom;
  },
};

/** The "Your turn" section by index, for the modules and tests that read it that way. */
export const YOUR_TURN_SECTION = {
  get headingY(): number {
    return SETTINGS_LEFT.headings.yourTurn;
  },
  get firstRowY(): number {
    return SETTINGS_LEFT.rows.instantCast.row;
  },
  get rowPitch(): number {
    return SETTINGS_LEFT.rows.landDrop.row - SETTINGS_LEFT.rows.instantCast.row;
  },
  get noteOffset(): number {
    return settingsRhythm().captionOffset;
  },
  rowCount: 2,
};

/** Y of row `index` in the "Your turn" section, and of its caption. */
export function yourTurnRowY(index: number): { row: number; note: number } {
  const row = YOUR_TURN_SECTION.firstRowY + index * YOUR_TURN_SECTION.rowPitch;
  return { row, note: row + YOUR_TURN_SECTION.noteOffset };
}

/**
 * The Reset save row: the Game tab's right column's last section, with the
 * warning as its caption. The button is a `md` danger control (it arms to a
 * longer label), right-aligned like every other control in the column.
 */
export const SETTINGS_RESET_BLOCK = {
  labelX: SETTINGS_COLUMNS.right.labelX,
  buttonRight: SETTINGS_COLUMNS.right.controlRight,
  get rowY(): number {
    return SETTINGS_RIGHT.rows.reset.row;
  },
  get captionY(): number {
    return SETTINGS_RIGHT.rows.reset.note;
  },
  buttonMinWidth: 170,
};

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

/**
 * The header's right-hand controls, mirroring the back button at the left.
 * "Check for updates" belongs with the version, not with any settings group;
 * it used to hang under the right panel at y 690, outside every panel and
 * past the title-safe frame's 684. "Legal" joins it there for the same reason:
 * the three published pages are about the whole game, not about any one row.
 */
export const SETTINGS_HEADER_ACTION = {
  right: SETTINGS_GAMEPLAY_PANEL.right,
  /** On the shared header line with the back button and the scene title. */
  y: theme.design.headerCenterY,
  /** The status line under it, right-aligned to the same edge (a caption; follows the text size). */
  get statusY(): number {
    return theme.design.headerCenterY + HIT_HALF + theme.space(2) + theme.type.caption / 2;
  },
  minWidth: 150,
};

/** The second header control, left of the update check and on its row. */
export const SETTINGS_HEADER_LEGAL = {
  y: SETTINGS_HEADER_ACTION.y,
  minWidth: 96,
} as const;

/**
 * The centred scene title's track. Its rendered width is font-fallback
 * dependent, so the header controls clear a generous allowance rather than a
 * measurement: eight display-size glyphs either side of centre.
 */
export const SETTINGS_TITLE_TRACK = {
  centerX: theme.design.centerX,
  get halfWidth(): number {
    return theme.type.display * 4;
  },
};

// ---------------------------------------------------------------------------
// Control groups: measure, then place
// ---------------------------------------------------------------------------

/** The gap every control group leaves between sibling hit boxes. */
const CHIP_GAP = theme.space(2); // 8
export const SETTINGS_CONTROL_GAP = CHIP_GAP;
/** Between a row's label and the nearest hit edge of its controls. */
export const SETTINGS_LABEL_GAP = GAP_WITHIN;

/** Centres for controls of the given widths, right-aligned as a group to `right`. */
export function rightAlignedChipCenters(
  widths: readonly number[],
  right: number = SETTINGS_COLUMNS.right.controlRight,
  gap: number = CHIP_GAP,
): number[] {
  const centers: number[] = [];
  let edge = right;
  for (let i = widths.length - 1; i >= 0; i--) {
    centers[i] = edge - widths[i] / 2;
    edge -= widths[i] + gap;
  }
  return centers;
}

/** A built control's measured widths (a themed button's visual box and its inflated hit box). */
export interface MeasuredControl {
  visualWidth: number;
  hitWidth: number;
}

/**
 * Centres for a right-aligned control group from measured widths: the last
 * control's visual edge on `right` (the column's shared control edge), each
 * earlier one packed so sibling hit boxes keep the within-group gap. Chips
 * narrower than the 90px hit floor therefore sit a little further apart
 * than their visual widths suggest; their hit boxes never overlap.
 */
export function rightAlignedControlCenters(controls: readonly MeasuredControl[], right: number): number[] {
  const centers: number[] = [];
  const last = controls.length - 1;
  if (last < 0) return centers;
  centers[last] = right - controls[last].visualWidth / 2;
  for (let i = last - 1; i >= 0; i--) {
    centers[i] = centers[i + 1] - controls[i + 1].hitWidth / 2 - CHIP_GAP - controls[i].hitWidth / 2;
  }
  return centers;
}

/** Centres for controls of the given widths, centred as a group on `centerX`. */
export function centeredGroupCenters(widths: readonly number[], centerX: number, gap: number = CHIP_GAP): number[] {
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
  return rightAlignedChipCenters(widths, centerX + total / 2, gap);
}

/** A chip's minimum visual width at the text size in force: its 100% width, scaled with the chip font. */
export function scaledChipWidth(baseWidth: number): number {
  return Math.round((baseWidth * theme.type.caption) / theme.typeBase.caption);
}

export interface SettingsChipSpec<V> {
  value: V;
  label: string;
  /** Minimum visual width at 100%; scaled with the chip font by `scaledChipWidth`. */
  baseWidth: number;
}

export const NO_BLOCK_CHIPS: readonly SettingsChipSpec<ConfirmNoBlockSetting>[] = [
  { value: 'always', label: 'Always', baseWidth: 80 },
  { value: 'lethal', label: 'Only when lethal', baseWidth: 120 },
  { value: 'off', label: 'Off', baseWidth: 70 },
];
/** Animations, render size and text size: three equal chips at 100%. */
export const ANIM_CHIP_WIDTH = 82;
export const RENDER_CHIP_WIDTH = 84;
export const TEXT_SIZE_CHIP_WIDTH = 82;
/** A toggle sits at the 90px hit floor. */
export const TOGGLE_WIDTH = theme.control.minHitWidth;

const TEXT_SIZE_LABELS: Readonly<Record<TextScale, string>> = { 1: 'Standard', 1.15: 'Large', 1.3: 'Largest' };

/** The text-size chips (plan Q2), one per allowed size. */
export const TEXT_SIZE_CHIPS: readonly { value: TextScale; label: string }[] = TEXT_SCALES.map((value) => ({
  value,
  label: TEXT_SIZE_LABELS[value],
}));

/**
 * Whether a row's controls stack under its label: they do when the label's
 * right edge plus the label gap reaches the controls' leftmost visual edge.
 * (Visual, not hit: a control's hit box is inflated to the 44 x 90 floor
 * over empty space, and the label is not a target.)
 */
export function settingsRowStacks(labelX: number, labelWidth: number, controlsVisualLeft: number): boolean {
  return labelX + labelWidth + SETTINGS_LABEL_GAP > controlsVisualLeft;
}

/**
 * The volume bar: drawn segments, not a glyph string (the ▰▱ glyphs fell back
 * to a different font per platform and read as text). A fixed size, since it
 * carries no text.
 */
export const VOLUME_BAR = { segments: 10, segmentWidth: 14, segmentGap: 4, height: 12 } as const;
export const VOLUME_BAR_WIDTH =
  VOLUME_BAR.segments * VOLUME_BAR.segmentWidth + (VOLUME_BAR.segments - 1) * VOLUME_BAR.segmentGap; // 176

/** Each segment's left x within the bar. */
export function volumeSegmentXs(): number[] {
  return Array.from({ length: VOLUME_BAR.segments }, (_, i) => i * (VOLUME_BAR.segmentWidth + VOLUME_BAR.segmentGap));
}

export interface VolumeStepperXs {
  minusX: number;
  barLeft: number;
  plusX: number;
}

/**
 * The volume stepper, right-aligned like every other row's controls: the "+"
 * button's visual edge on the column's control edge, the bar one within-group
 * gap left of it, and "−" one gap left of the bar.
 */
export function volumeStepperXs(
  barWidth: number,
  buttonVisualWidth: number,
  frame: Pick<SettingsColumnFrame, 'controlRight'>,
): VolumeStepperXs {
  const plusX = frame.controlRight - buttonVisualWidth / 2;
  const barLeft = plusX - buttonVisualWidth / 2 - GAP_WITHIN - barWidth;
  return { minusX: barLeft - GAP_WITHIN - buttonVisualWidth / 2, barLeft, plusX };
}

export interface SettingsHeaderCenters {
  legalX: number;
  updateX: number;
}

/**
 * Where the header pair goes once both hit widths are measured: the update
 * check right-aligned to the header edge, "Legal" one isolation gap to its
 * left. Measure-then-place, and the same right-aligned-group rule the chip
 * rows use, so the gap between the two hit boxes is the design system's
 * within-group space wherever the labels land.
 */
export function settingsHeaderCenters(
  legalHitWidth: number,
  updateHitWidth: number,
): SettingsHeaderCenters {
  const [legalX, updateX] = rightAlignedChipCenters(
    [legalHitWidth, updateHitWidth],
    SETTINGS_HEADER_ACTION.right,
  );
  return { legalX, updateX };
}

/**
 * The tab row: the Profile scene's tab-strip recipe (`sm` buttons, the
 * selected one primary, a 100px floor, the within-group gap between them),
 * placed from measured hit widths and centred as a group on the frame's
 * centre line.
 */
export const SETTINGS_TAB_BASE_WIDTH = 100;
export const SETTINGS_TAB_GAP = GAP_WITHIN;
export function settingsTabCenters(hitWidths: readonly number[]): number[] {
  return centeredGroupCenters(hitWidths, theme.design.centerX, SETTINGS_TAB_GAP);
}
