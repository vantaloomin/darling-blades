import { describe, expect, it } from 'vitest';
import {
  DECK_PANE_LAYOUT,
  deckPaneOffsetY,
  deckPaneToggleState,
  defaultDeckPaneMode,
  resolveDeckPaneMode,
  toggleDeckPaneMode,
  warchestSlotLabel,
  warchestSlotPosition,
} from '../../src/ui/deckPanePresentation';

describe('deck pane presentation', () => {
  it('opens on Cards and toggles between the two reserve-deck views', () => {
    expect(defaultDeckPaneMode()).toBe('cards');
    expect(toggleDeckPaneMode('cards')).toBe('warchest');
    expect(toggleDeckPaneMode('warchest')).toBe('cards');
    expect(resolveDeckPaneMode('warchest', false)).toBe('cards');
    expect(resolveDeckPaneMode('warchest', true)).toBe('warchest');
  });

  it('lifts the View row into the hidden format switch band and never above it', () => {
    // With the switch visible the toggle keeps its own band below it.
    expect(deckPaneOffsetY(true)).toBe(0);
    // Without it, the toggle inherits the switch's y 64 exactly: no dead band
    // above the View row, and no collision with the y 32 title row.
    expect(DECK_PANE_LAYOUT.toggle.y - deckPaneOffsetY(false)).toBe(64);
    expect(DECK_PANE_LAYOUT.toggle.y - deckPaneOffsetY(false)).toBeGreaterThan(32 + 16);
  });

  it('propagates reserve warnings to the Warchest toggle', () => {
    expect(deckPaneToggleState('cards', 1)).toMatchObject({
      cardsSelected: true,
      warchestSelected: false,
      warchestWarning: true,
      warchestLabel: 'Warchest ⚠',
    });
    expect(deckPaneToggleState('warchest', 0)).toMatchObject({
      cardsSelected: false,
      warchestSelected: true,
      warchestWarning: false,
      warchestLabel: 'Warchest',
    });
  });

  it('fills the full-width Warchest panel with ten readable two-column slots', () => {
    const layout = DECK_PANE_LAYOUT;
    const slots = Array.from({ length: 10 }, (_, index) => warchestSlotPosition(index));
    for (const position of slots) {
      expect(position.x - layout.warchest.slotWidth / 2).toBeGreaterThanOrEqual(layout.left);
      expect(position.x + layout.warchest.slotWidth / 2).toBeLessThanOrEqual(layout.right);
      expect(position.y).toBeGreaterThan(layout.content.top);
      expect(position.y).toBeLessThan(layout.warchest.rulesTop);
    }
    expect(new Set(slots.map(({ x }) => x)).size).toBe(2);
    expect(new Set(slots.map(({ y }) => y)).size).toBe(5);
    expect(warchestSlotLabel(0, 'Red Cliffs Anchorage')).toBe('1. Red Cliffs Anchorage');
    expect(warchestSlotLabel(0, 'Red Cliffs Anchorage')).not.toContain('…');
  });
});
