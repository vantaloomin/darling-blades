import { describe, expect, it } from 'vitest';
import {
  NO_BLOCK_CHIPS,
  NO_BLOCK_LABEL_TRACK,
  SETTINGS_GAMEPLAY_PANEL,
  SETTINGS_PANEL_BAND,
  YOUR_TURN_SECTION,
  settingsChipBounds,
  yourTurnRowY,
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

describe('the "Your turn" section', () => {
  it('keeps every row and its caption inside the panel', () => {
    // A caption ran past the panel edge once before (user report 2026-07-12);
    // the land-drop row added in v34 is the second row of this section.
    for (let i = 0; i < YOUR_TURN_SECTION.rowCount; i++) {
      const { row, note } = yourTurnRowY(i);
      // A row's 44px touch target and its caption both stay inside.
      expect(row - 22).toBeGreaterThan(YOUR_TURN_SECTION.headingY);
      expect(note + 14).toBeLessThanOrEqual(SETTINGS_PANEL_BAND.bottom);
    }
  });

  it('keeps consecutive touch targets disjoint', () => {
    for (let i = 1; i < YOUR_TURN_SECTION.rowCount; i++) {
      expect(yourTurnRowY(i).row - 22).toBeGreaterThanOrEqual(yourTurnRowY(i - 1).row + 22);
    }
  });

  it('leaves room for one more row before the panel runs out', () => {
    // Documents the headroom: adding a third row here is a layout decision,
    // not a free one.
    const next = yourTurnRowY(YOUR_TURN_SECTION.rowCount);
    expect(next.note + 14).toBeGreaterThan(SETTINGS_PANEL_BAND.bottom);
  });
});
