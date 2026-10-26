/**
 * Settings' compact (phone) composition, Phaser-free (mocks M-Settings,
 * M-SettingsAccess, M-SettingsGameplay, M-SettingsReset, M-SettingsLegal;
 * docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * The desktop's three tabs become one list that scrolls, section by section,
 * in the main pane. The command column jumps to a section (the button of the
 * section in view is drawn selected), shows the version, and keeps Legal and
 * Check for updates at its foot. Coordinates are compact design px inside the
 * content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';
import type { AccessibilityControlsShown, SettingsRowKey, SettingsTab } from './settingsPresentation';

export const SETTINGS_COMPACT = {
  /** The lane the list's scroll thumb runs in, right of the rows. */
  thumbLane: 14,
  /** Above and below a row's text. */
  rowPad: 10,
  /** Between a section's last row and the next heading. */
  sectionGap: 14,
  /** Between a heading and its first row. */
  headingGap: 2,
  /** Between a row's label (or bar) and its caption. */
  captionGap: 4,
  /** Between a row's text and its controls. */
  controlGap: 12,
  /** The two-across jump grid in the column. */
  navColumns: 2,
  /** Desktop: the list sits on a panel, its rows this far inside the panel's edge. */
  desktopPanelPad: 14,
  /** Desktop: rows stop at this width (about 640 px at a 1280 window) so a label stays near its control. */
  desktopRowMaxW: 530,
} as const;

export type SettingsCompactSectionKey = 'audio' | 'yourTurn' | 'gameplay' | 'accessibility' | 'privacy' | 'saveData';

export interface SettingsCompactSection {
  key: SettingsCompactSectionKey;
  /** The heading over the section's rows. */
  title: string;
  /** The jump button's label in the column. */
  nav: string;
  rows: readonly SettingsRowKey[];
}

/**
 * Every setting in one list, in the mocks' order. Animations and render size
 * join Gameplay (M-SettingsGameplay), leaving Accessibility to the text size
 * and contrast; a section with no rows to show is left out, jump and all.
 */
export function settingsCompactSections(shown: AccessibilityControlsShown, fullScreen: boolean): SettingsCompactSection[] {
  const accessibility: SettingsRowKey[] = [];
  if (shown.textSize) accessibility.push('textSize');
  if (shown.highContrast) accessibility.push('highContrast');
  const sections: SettingsCompactSection[] = [
    {
      key: 'audio',
      title: fullScreen ? 'Audio & screen' : 'Audio',
      nav: 'Audio',
      rows: fullScreen ? ['sfx', 'volume', 'music', 'soundStyle', 'fullScreen'] : ['sfx', 'volume', 'music', 'soundStyle'],
    },
    { key: 'yourTurn', title: 'Your turn', nav: 'Your turn', rows: ['instantCast', 'landDrop'] },
    {
      key: 'gameplay',
      title: 'Gameplay',
      nav: 'Gameplay',
      rows: ['animations', 'renderSize', 'autoSkip', 'confirmDestructive', 'keywordReminders', 'noBlock'],
    },
    { key: 'accessibility', title: 'Accessibility', nav: 'Accessibility', rows: accessibility },
    { key: 'privacy', title: 'Privacy', nav: 'Privacy', rows: ['stats'] },
    { key: 'saveData', title: 'Save data', nav: 'Save data', rows: ['reset'] },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

/**
 * The section a desktop tab opens on, so the scene's tab data still lands
 * somewhere sensible: Game opens at the top, Accessibility (where a text size
 * change brings the player back) at its controls.
 */
export function settingsCompactSectionForTab(
  tab: SettingsTab,
  sections: readonly SettingsCompactSection[],
): SettingsCompactSectionKey | null {
  if (tab === 'audio') return 'audio';
  if (tab === 'accessibility') return sections.some((s) => s.key === 'accessibility') ? 'accessibility' : 'gameplay';
  return null;
}

export interface CompactSettingsLayout {
  shell: CompactShell;
  /** The list's viewport. */
  list: Rect;
  /** Desktop: the panel behind the list, so its text reads over the backdrop's art. */
  listPanel: Rect | null;
  /** A row's width inside the list (the thumb's lane left free). */
  rowW: number;
  /** One jump button per section, two across (one on desktop), top down. */
  nav: Rect[];
  /** Where the version line starts. */
  versionY: number;
  /** The column's foot: Legal and Check for updates, side by side or stacked. */
  legal: Rect;
  update: Rect;
}

/**
 * The shell, the list, the jump grid and the foot. `footWidths` are the two
 * foot buttons' measured needs; when they cannot share a row, Legal goes on
 * its own row above Check for updates. `desktop` stacks the jumps one per row
 * and puts the list on a panel.
 */
export function compactSettingsLayout(
  content: Rect,
  sectionCount: number,
  footWidths: { legal: number; update: number },
  navNeeds: readonly number[] = [],
  opts: { desktop?: boolean } = {},
): CompactSettingsLayout {
  const C = SETTINGS_COMPACT;
  const shell = compactShell(content, { back: true });
  const { touch, gap } = COMPACT;
  let main = shell.main;
  let column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  if (opts.desktop && shell.column) {
    // Desktop (owner ruling R3 A): the section list leads on the left and the
    // settings read to its right, the list-detail layout of desktop settings.
    column = { ...column, x: content.x };
    main = { ...main, x: content.x + column.width + gap };
  }
  const columns = opts.desktop ? 1 : C.navColumns;
  const nav: Rect[] = [];
  for (let i = 0; i < Math.max(0, sectionCount); i += columns) {
    const y = column.y + (i / columns) * (touch + gap);
    if (columns === 1) {
      nav.push({ x: column.x, y, width: column.width, height: touch });
      continue;
    }
    const [leftW, rightW] = settingsNavRowWidths(column.width, navNeeds[i] ?? 0, navNeeds[i + 1] ?? 0);
    nav.push({ x: column.x, y, width: leftW, height: touch });
    if (i + 1 < sectionCount) nav.push({ x: column.x + leftW + gap, y, width: rightW, height: touch });
  }
  const navRows = Math.ceil(Math.max(0, sectionCount) / columns);
  const versionY = column.y + navRows * (touch + gap) + 4;
  const footY = column.y + column.height - touch;
  let legal: Rect;
  let update: Rect;
  if (footWidths.legal + gap + footWidths.update <= column.width) {
    // The spare width split between the two, so neither reads as cramped.
    const legalW = Math.round(footWidths.legal + (column.width - gap - footWidths.legal - footWidths.update) / 2);
    legal = { x: column.x, y: footY, width: legalW, height: touch };
    update = { x: column.x + legalW + gap, y: footY, width: column.width - legalW - gap, height: touch };
  } else {
    update = { x: column.x, y: footY, width: column.width, height: touch };
    legal = { x: column.x, y: footY - gap - touch, width: column.width, height: touch };
  }
  if (!opts.desktop) return { shell, list: main, listPanel: null, rowW: Math.max(0, main.width - C.thumbLane), nav, versionY, legal, update };
  const pad = C.desktopPanelPad;
  const panelW = Math.min(main.width, C.desktopRowMaxW + C.thumbLane + 2 * pad);
  const listPanel = { x: main.x, y: main.y, width: panelW, height: main.height };
  const list = { x: listPanel.x + pad, y: main.y + pad, width: Math.max(0, panelW - 2 * pad), height: Math.max(0, main.height - 2 * pad) };
  return { shell: { ...shell, main, column, primary: null }, list, listPanel, rowW: Math.max(0, list.width - C.thumbLane), nav, versionY, legal, update };
}

/**
 * One row of the jump grid: two equal halves while both labels fit, else
 * each label's need with the spare split between them ("Gameplay" beside
 * "Accessibility" at Largest text), so a label shortens only when the pair
 * cannot share the row at all.
 */
export function settingsNavRowWidths(width: number, left: number, right: number): [number, number] {
  const gap = COMPACT.gap;
  const half = (width - gap) / 2;
  if ((left <= half && right <= half) || left + right + gap > width) return [half, half];
  const leftW = Math.round(left + (width - gap - left - right) / 2);
  return [leftW, width - gap - leftW];
}

/**
 * The section to draw selected as the player scrolls: the last one whose
 * heading has reached the list's top. At the end of the list, where the last
 * short sections can never reach the top, a heading past the middle counts.
 */
export function settingsActiveSection(tops: readonly number[], offset: number, viewportH: number, maxScroll: number): number {
  if (!tops.length) return -1;
  const line = maxScroll > 0 && offset >= maxScroll - 1 ? offset + viewportH / 2 : offset + 24;
  let active = 0;
  tops.forEach((top, i) => {
    if (top <= line) active = i;
  });
  return active;
}
