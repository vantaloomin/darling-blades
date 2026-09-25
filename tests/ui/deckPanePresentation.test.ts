import { describe, expect, it } from 'vitest';
import {
  DECK_PANE_LAYOUT,
  DECK_STATUS_LINE_HEIGHT,
  constructedBasicsRowY,
  deckPaneOffsetY,
  deckPaneToggleState,
  deckRowCenterY,
  deckStatusTone,
  defaultDeckPaneMode,
  resolveDeckPaneMode,
  toggleDeckPaneMode,
  warchestSlotLabel,
  warchestSlotPosition,
} from '../../src/ui/deckPanePresentation';
import { theme } from '../../src/ui/theme';

/**
 * The pane's header rows inside the title-safe frame (y 36-684). The title row
 * sat on y 32 until 1.8.1, its text and its Decks button above the frame. Hit
 * bands are 44px tall; a control's visual is its sm height (30).
 */
describe('deck pane header rows', () => {
  const layout = DECK_PANE_LAYOUT;
  const hitHalf = theme.control.minHitHeight / 2;
  const frameTop = theme.design.safeTop;

  it('keeps the title row, text and controls alike, inside the frame', () => {
    const title = layout.title;
    expect(title.y - title.halfHeight).toBeGreaterThanOrEqual(frameTop);
    expect(layout.decks.y - hitHalf).toBeGreaterThanOrEqual(frameTop);
    expect(title.y - title.portraitHitHeight / 2).toBeGreaterThanOrEqual(frameTop);
    const portraitHalfHeight = (420 * title.portraitScale) / 2;
    expect(title.y - portraitHalfHeight).toBeGreaterThanOrEqual(frameTop);
  });

  it('stacks the Format and View rows below the title row without overlap', () => {
    const title = layout.title;
    const f = layout.formatRow;
    // The tabs share the title text's columns, so their buttons start below it.
    expect(f.y - theme.control.heightSm / 2).toBeGreaterThanOrEqual(title.y + title.halfHeight + 4);
    // The Darling portrait sits above the Format label (micro type, ~14px box).
    expect(f.y - 7).toBeGreaterThanOrEqual(title.y + (420 * title.portraitScale) / 2 + 4);
    // Title-row controls may run level with the tabs only in columns no tab reaches.
    const firstTabHitLeft = f.tabFirstX - theme.control.minHitWidth / 2;
    expect(title.portraitX + title.portraitHitWidth / 2).toBeLessThan(firstTabHitLeft);
    expect(layout.decks.x - layout.decks.minWidth / 2).toBeGreaterThanOrEqual(f.decksHitLeft);
    // The View row shares every column with the tabs, and Style shares Decks'.
    expect(layout.toggle.y - hitHalf).toBeGreaterThanOrEqual(f.y + hitHalf);
    expect(layout.toggle.y - hitHalf).toBeGreaterThanOrEqual(layout.decks.y + hitHalf);
  });

  it('starts the pane content below the View row', () => {
    // The first card row's hit band starts where the View row's ends.
    const firstRowY = deckRowCenterY(layout.content.top + layout.content.listInset, 0, layout.cards.rowPitch);
    expect(firstRowY - layout.cards.rowPitch / 2).toBeGreaterThanOrEqual(layout.toggle.y + hitHalf);
    // The Warchest panel's edge clears the View buttons, and its heading sits inside it.
    expect(layout.content.top).toBeGreaterThan(layout.toggle.y + theme.control.heightSm / 2);
    expect(layout.warchest.headingY - 10).toBeGreaterThan(layout.content.top);
  });

  it('starts the Constructed basics block below the Format tabs', () => {
    for (const touch of [false, true]) {
      expect(constructedBasicsRowY(0, touch) - hitHalf).toBeGreaterThanOrEqual(layout.formatRow.y + hitHalf);
    }
    // Desktop rows' 44px controls never share a hit band with a neighbour's.
    expect(layout.basics.desktopPitch).toBeGreaterThanOrEqual(theme.control.minHitHeight);
  });
});

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
    // stats block -> the FULL status band: the band is bottom-anchored and
    // grows upward, so every line it is allowed to hold must clear the stats
    // above it. One clipped line used to be the price of showing the curve;
    // the stack lifted instead (player report 2026-08-25).
    const statusTop = s.statusBottomY - DECK_STATUS_LINE_HEIGHT * s.statusMaxLines;
    expect(s.statusMaxLines).toBeGreaterThanOrEqual(2);
    expect(statusTop - (s.summaryLineY + 8)).toBeGreaterThanOrEqual(16);
    // status -> CTA row: within the action group, measured to the CTAs' hit boxes.
    expect(s.ctaY - theme.control.minHitHeight / 2 - s.statusBottomY).toBeGreaterThanOrEqual(8);
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
    // Without it, the toggle inherits the switch's band exactly: no dead band
    // above the View row, and its buttons still clear the title text.
    const liftedY = DECK_PANE_LAYOUT.toggle.y - deckPaneOffsetY(false);
    expect(liftedY).toBe(DECK_PANE_LAYOUT.formatRow.y);
    const title = DECK_PANE_LAYOUT.title;
    expect(liftedY - theme.control.heightSm / 2).toBeGreaterThanOrEqual(title.y + title.halfHeight);
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
 * deck pane is 360px wide and both existing rows were full. These pin that the
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

/** The status band is one Text in one colour; the colour must not lie about the message. */
describe('deck status band tone', () => {
  const failure = { text: 'Import rejected', tone: 'danger' as const };
  const success = { text: 'Deck code copied.', tone: 'success' as const };

  it('never shows a failure in the success colour, even on a legal deck', () => {
    expect(deckStatusTone(failure, false)).toBe('danger');
    expect(deckStatusTone(failure, true)).toBe('danger');
  });

  it('reads a success message as success only while nothing blocks the deck', () => {
    expect(deckStatusTone(success, false)).toBe('success');
    // The blocking issue shares the band, and it must read as an error.
    expect(deckStatusTone(success, true)).toBe('danger');
  });
});

describe('deck stats survive an invalid deck', () => {
  it('leaves the whole summary stack inside the pane, above the CTA row', () => {
    // The repair banner this replaced was drawn at y 514-630, straight over
    // the curve. Nothing may occupy that band except the stats themselves.
    const s = DECK_PANE_LAYOUT.summary;
    const statusTop = s.statusBottomY - DECK_STATUS_LINE_HEIGHT * s.statusMaxLines;
    for (const y of [s.pagerY, s.statsHeadingY, s.barBaseY, s.summaryLineY]) {
      expect(y).toBeGreaterThan(DECK_PANE_LAYOUT.toggle.y);
      expect(y).toBeLessThan(statusTop);
    }
    expect(s.statusBottomY).toBeLessThan(s.ctaY);
    // The Warchest view's panel takes the stats' place, so it too must end
    // above the status band that shares the pane with it.
    expect(statusTop - DECK_PANE_LAYOUT.content.bottom).toBeGreaterThanOrEqual(8);
  });
});
