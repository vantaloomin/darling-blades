import type { ConfirmNoBlockSetting } from '../meta/SaveManager';

export interface SettingsChipLayout {
  value: ConfirmNoBlockSetting;
  label: string;
  minWidth: number;
  x: number;
}

export const SETTINGS_GAMEPLAY_PANEL = { left: 670, right: 1210 } as const;
export const NO_BLOCK_LABEL_TRACK = { left: 710, right: 850 } as const;

/** Fixed widths do not change when the selected chip swaps visual variant. */
export const NO_BLOCK_CHIPS: readonly SettingsChipLayout[] = [
  { value: 'always', label: 'Always', minWidth: 80, x: 900 },
  { value: 'lethal', label: 'Only when lethal', minWidth: 120, x: 1030 },
  { value: 'off', label: 'Off', minWidth: 70, x: 1170 },
] as const;

export function settingsChipBounds(chip: SettingsChipLayout): { left: number; right: number } {
  return { left: chip.x - chip.minWidth / 2, right: chip.x + chip.minWidth / 2 };
}
