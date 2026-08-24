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

  it('keeps the Format tabs clear of the Decks CTA hit column', () => {
    const f = DECK_PANE_LAYOUT.formatRow;
    // Two tabs; the right edge of the last one stays left of Decks' inflated
    // hit column with breathing room (interactive isolation rule).
    const lastTabRight = f.tabFirstX + f.tabPitch + f.tabMinWidth / 2;
    expect(lastTabRight).toBeLessThanOrEqual(f.decksHitLeft - 8);
    // The Format label clears the first tab's left edge.
    expect(f.tabFirstX - f.tabMinWidth / 2).toBeGreaterThanOrEqual(f.labelX + 44);
  });

  it('stretches the mana curve across the pane width', () => {
    const c = DECK_PANE_LAYOUT.curve;
    expect(c.firstX - c.barWidth / 2).toBeGreaterThanOrEqual(DECK_PANE_LAYOUT.left);
    expect(c.firstX + 7 * c.pitch + c.barWidth / 2).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right - 16);
    // Genuinely full-width: the eight slots cover at least 90% of the span.
    expect(7 * c.pitch + c.barWidth).toBeGreaterThanOrEqual((DECK_PANE_LAYOUT.right - 16 - DECK_PANE_LAYOUT.left) * 0.9);
  });

  it('respects the isolation tiers through the bottom summary stack', () => {
    const s = DECK_PANE_LAYOUT.summary;
    const pagerBandBottom = s.pagerY + 22; // 44px hit band
    const headingTop = s.statsHeadingY - 8;
    // pager -> stats block: at least the within-super-group 12.
    expect(headingTop - pagerBandBottom).toBeGreaterThanOrEqual(12);
    // heading clears the tallest bar's count label (center barBaseY-h-8).
    expect(s.barBaseY - s.barMaxHeight - 8 - 7).toBeGreaterThanOrEqual(s.statsHeadingY + 8);
    // merged summary line sits below the mv labels (barBaseY+9) with margin.
    expect(s.summaryLineY - 8).toBeGreaterThanOrEqual(s.barBaseY + 9 + 7);
    // stats block -> one-line status band: a real between-groups gap.
    const statusTop = s.statusBottomY - 16;
    expect(statusTop - (s.summaryLineY + 8)).toBeGreaterThanOrEqual(16);
    // status -> CTA row: within the action group.
    expect(s.ctaY - 14 - s.statusBottomY).toBeGreaterThanOrEqual(8);
    // icons sized for the row pitch without overflowing it.
    expect(DECK_PANE_LAYOUT.cards.starSize).toBeLessThanOrEqual(DECK_PANE_LAYOUT.cards.rowPitch - 6);
    expect(DECK_PANE_LAYOUT.cards.pinSize).toBeLessThanOrEqual(DECK_PANE_LAYOUT.cards.starSize);
  });

  it('keeps the name column clear of the right-aligned count chip', () => {
    const cards = DECK_PANE_LAYOUT.cards;
    // The widest chip and its gap live in countReserve; a full-width name
    // must end before the chip's left edge so long legend names ellipsize
    // instead of running under the count (owner finding 2026-08-18).
    expect(cards.nameX + cards.nameWidth).toBeLessThanOrEqual(cards.countRightX - cards.countReserve);
    // The chip's right edge respects the panel gutter.
    expect(cards.countRightX).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right - 16);
    // Breathing room: the pitch clears the caption line height with margin.
    expect(cards.rowPitch).toBeGreaterThanOrEqual(26);
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

/**
 * v33 added Style as a third VIEW rather than a new chrome row, because the
 * deck pane spans 900-1260 and both existing rows were full. These pin that the
 * three buttons still fit inside the pane with the hit-width floor intact, and
 * that Style survives the constructed coercion (a deck has a look whether or
 * not it has a Warchest).
 */
describe('deck pane style view', () => {
  it('marks exactly one view selected', () => {
    expect(deckPaneToggleState('style', 0)).toMatchObject({
      cardsSelected: false,
      warchestSelected: false,
      styleSelected: true,
    });
    expect(deckPaneToggleState('cards', 0).styleSelected).toBe(false);
    expect(deckPaneToggleState('warchest', 0).styleSelected).toBe(false);
  });

  it('keeps Style available in constructed, where Warchest is coerced away', () => {
    expect(resolveDeckPaneMode('style', false)).toBe('style');
    expect(resolveDeckPaneMode('style', true)).toBe('style');
    expect(resolveDeckPaneMode('warchest', false)).toBe('cards');
  });

  it('fits three buttons inside the pane without overlapping', () => {
    const t = DECK_PANE_LAYOUT.toggle;
    const half = t.minWidth / 2;
    expect(t.cardsX - half).toBeGreaterThan(t.labelX);
    expect(t.warchestX - half).toBeGreaterThanOrEqual(t.cardsX + half);
    expect(t.styleX - half).toBeGreaterThanOrEqual(t.warchestX + half);
    expect(t.styleX + half).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right);
  });
});
