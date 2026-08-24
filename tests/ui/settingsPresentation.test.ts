import { describe, expect, it } from 'vitest';
import {
  NO_BLOCK_CHIPS,
  NO_BLOCK_LABEL_TRACK,
  SETTINGS_GAMEPLAY_PANEL,
  settingsChipBounds,
} from '../../src/ui/settingsPresentation';

describe('settings presentation', () => {
  it('keeps every no-block chip inside the Gameplay panel and clear of the label', () => {
    for (const chip of NO_BLOCK_CHIPS) {
      const bounds = settingsChipBounds(chip);
      expect(bounds.left, chip.value).toBeGreaterThanOrEqual(SETTINGS_GAMEPLAY_PANEL.left);
      expect(bounds.right, chip.value).toBeLessThanOrEqual(SETTINGS_GAMEPLAY_PANEL.right);
      expect(bounds.left, chip.value).toBeGreaterThanOrEqual(NO_BLOCK_LABEL_TRACK.right);
    }
  });

  it('keeps all chip tracks disjoint in every selected state', () => {
    const bounds = NO_BLOCK_CHIPS.map(settingsChipBounds);
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i].left).toBeGreaterThan(bounds[i - 1].right);
    }
  });
});
