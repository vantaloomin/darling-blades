import { describe, expect, it } from 'vitest';
import {
  DECK_PANE_LAYOUT,
  deckListPagerPosition,
  deckPaneTabRow,
  DECK_PICKER_LAYOUT,
  PAGER_HIT_REACH,
  constructedBasicsRowY,
  deckPaneHeaderLayout,
  deckPaneSummaryLayout,
  deckPaneOffsetY,
  deckPickerTilePosition,
  deckPickerLayout,
  deckPaneToggleState,
  deckReserveLayout,
  deckRowCenterY,
  deckStatusTone,
  defaultDeckPaneMode,
  resolveDeckPaneMode,
  toggleDeckPaneMode,
  warchestSlotLabel,
} from '../../src/ui/deckPanePresentation';
import { PAGER_CENTER_OFFSET } from '../../src/ui/layout';
import { theme } from '../../src/ui/theme';
import { menuLineHeight } from '../../src/ui/mainMenuPresentation';
import { forEachA11yCell } from './a11yCells';

/**
 * The pane's header rows inside the title-safe frame (y 36-684). The title row
 * sat on y 32 until 1.8.1, its text and its Decks button above the frame. Hit
 * bands are 44px tall; a control's visual is its sm height (30).
 */
/**
 * Rendered widths (Chromium, 2026-10-08) at 100% and 130% text: the wider of
 * the Format/Classic/View labels, the two Format tabs, and the three View
 * buttons with the Warchest warning label, the widest it gets.
 */
const MEASURED = [
  { label: 40, format: [78, 78], view: [84, 87, 84] },
  { label: 50, format: [87, 81], view: [84, 111, 84] },
] as const;

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
    const firstTabHitLeft = deckPaneTabRow(MEASURED[0].label, [f.tabMinWidth])[0] - theme.control.minHitWidth / 2;
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
    // The Warchest panel's edge clears the View buttons.
    expect(layout.content.top).toBeGreaterThan(layout.toggle.y + theme.control.heightSm / 2);
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

  it('keeps the Format tabs clear of the Decks CTA hit column and past the measured label', () => {
    const f = DECK_PANE_LAYOUT.formatRow;
    for (const m of MEASURED) {
      const xs = deckPaneTabRow(m.label, m.format);
      // Two tabs; the right edge of the last one stays left of Decks' inflated
      // hit column with breathing room (interactive isolation rule).
      expect(xs[1] + m.format[1] / 2).toBeLessThanOrEqual(f.decksHitLeft - 8);
      // The Format label, at its measured width, clears the first tab.
      expect(xs[0] - m.format[0] / 2).toBeGreaterThanOrEqual(f.labelX + m.label + theme.space(2));
      // The View row starts on the same line as the Format row.
      expect(deckPaneTabRow(m.label, m.view)[0] - m.view[0] / 2).toBe(xs[0] - m.format[0] / 2);
    }
  });

  it('puts the list pager under the list when it fits, else on the heading line', () => {
    const s = DECK_PANE_LAYOUT.summary;
    const roomy = deckListPagerPosition(s.listBottom - 100);
    expect(roomy.y + theme.control.minHitHeight / 2).toBeLessThanOrEqual(s.statsHeadingY - menuLineHeight(theme.type.label) / 2);
    expect(roomy.x + PAGER_CENTER_OFFSET).toBe((DECK_PANE_LAYOUT.left + DECK_PANE_LAYOUT.right) / 2);
    expect(deckListPagerPosition(s.listBottom - 10)).toEqual({ x: s.pagerX, y: s.pagerY });
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
    // Pager and heading share a row; their horizontal bands stay disjoint.
    // 110px encloses the rendered heading at every supported scale.
    expect(s.pagerY).toBe(s.statsHeadingY);
    expect(s.pagerX - 22 - (DECK_PANE_LAYOUT.left + 110)).toBeGreaterThanOrEqual(12);
    // heading clears the tallest bar's count label (center barBaseY-h-8).
    expect(s.barBaseY - s.barMaxHeight - 8 - 7).toBeGreaterThanOrEqual(s.statsHeadingY + 8);
    // merged summary line sits below the mv labels (barBaseY+9) with margin.
    expect(s.summaryLineY - 8).toBeGreaterThanOrEqual(s.barBaseY + 9 + 7);
    // stats block -> the FULL status band: the band is bottom-anchored and
    // grows upward, so every line it is allowed to hold must clear the stats
    // above it. One clipped line used to be the price of showing the curve;
    // the stack lifted instead (player report 2026-08-25).
    const statusTop = s.statusTop;
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

  it('preserves each reserve slot number and its complete land name', () => {
    expect(warchestSlotLabel(0, 'Red Cliffs Anchorage')).toBe('1. Red Cliffs Anchorage');
    expect(warchestSlotLabel(9, 'The Long Road Beyond the River')).toBe('10. The Long Road Beyond the River');
  });
});

describe('deck reserve measured accessibility layout', () => {
  it('keeps wrapped headers, slot hit bands, pager and rules separate in every accessibility cell', () => {
    forEachA11yCell(() => {
      for (const validationLines of [1, 2]) {
        for (const rulesLines of [1, 2, 3]) {
          for (const slotLines of [1, 2, 3]) {
            const top = DECK_PANE_LAYOUT.content.top;
            const bottom = DECK_PANE_LAYOUT.content.bottom;
            const headerHeights = [menuLineHeight(theme.type.label), menuLineHeight(theme.type.caption),
              validationLines * menuLineHeight(theme.type.micro)];
            const rulesHeight = rulesLines * menuLineHeight(theme.type.micro) + (rulesLines - 1) * theme.space(0.5);
            const slotHeight = slotLines * menuLineHeight(theme.type.caption) + theme.space(2);
            const layout = deckReserveLayout({ top, bottom, headerHeights, rulesHeight, slotHeight, slotCount: 10 });
            for (let index = 0; index < headerHeights.length; index++) {
              expect(layout.headerYs[index]).toBeGreaterThanOrEqual(top + theme.space(3));
              expect(layout.headerYs[index] + headerHeights[index]).toBeLessThanOrEqual(layout.headerBottom);
              if (index > 0) expect(layout.headerYs[index]).toBeGreaterThanOrEqual(
                layout.headerYs[index - 1] + headerHeights[index - 1] + theme.space(1));
            }
            expect(layout.rowHeight).toBeGreaterThanOrEqual(slotHeight);
            expect(layout.rowHeight).toBeGreaterThanOrEqual(theme.control.minHitHeight);
            expect(layout.slotWidth).toBeGreaterThanOrEqual(theme.control.minHitWidth);
            for (let index = 0; index < layout.pageSize; index++) {
              const slot = layout.slotCenter(index);
              expect(slot.x - layout.slotWidth / 2).toBeGreaterThanOrEqual(DECK_PANE_LAYOUT.left + theme.space(3));
              expect(slot.x + layout.slotWidth / 2).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right - theme.space(3));
              expect(slot.y - layout.rowHeight / 2).toBeGreaterThanOrEqual(layout.headerBottom + theme.space(2));
              expect(slot.y + layout.rowHeight / 2).toBeLessThanOrEqual(
                layout.pagerY - theme.control.minHitHeight / 2 - theme.space(2));
              if (index % 2 === 1) expect(slot.x - layout.slotWidth / 2).toBeGreaterThanOrEqual(
                layout.slotCenter(index - 1).x + layout.slotWidth / 2 + theme.space(2));
              if (index >= 2) expect(slot.y - layout.rowHeight / 2).toBeGreaterThanOrEqual(
                layout.slotCenter(index - 2).y + layout.rowHeight / 2 + theme.space(2));
            }
            expect(layout.pagerY + theme.control.minHitHeight / 2).toBeLessThanOrEqual(layout.rulesY - theme.space(2));
            expect(layout.rulesY + rulesHeight).toBeLessThanOrEqual(bottom - theme.space(3));
          }
        }
      }
    });
  });

  it('makes every reserve slot reachable exactly once across whole-row pages in every accessibility cell', () => {
    forEachA11yCell(() => {
      for (const slotCount of [0, 1, 10, 11, 23]) {
        const layout = deckReserveLayout({ top: DECK_PANE_LAYOUT.content.top, bottom: DECK_PANE_LAYOUT.content.bottom,
          headerHeights: [menuLineHeight(theme.type.label), menuLineHeight(theme.type.caption), 2 * menuLineHeight(theme.type.micro)],
          rulesHeight: 3 * menuLineHeight(theme.type.micro), slotHeight: 3 * menuLineHeight(theme.type.caption) + theme.space(2), slotCount });
        const visited: number[] = [];
        for (let page = 0; page < layout.pageCount; page++) {
          for (let local = 0; local < layout.pageSize; local++) {
            const index = page * layout.pageSize + local;
            if (index < slotCount) visited.push(index);
          }
        }
        expect(visited).toEqual(Array.from({ length: slotCount }, (_, index) => index));
        expect(layout.pageCount).toBeGreaterThanOrEqual(1);
        expect(layout.pageSize % 2).toBe(0);
        if (slotCount > 0) expect((layout.pageCount - 1) * layout.pageSize).toBeLessThan(slotCount);
      }
    });
  });

  it('rejects a workspace too short for one whole measured slot row', () => {
    expect(() => deckReserveLayout({ top: 200, bottom: 320, headerHeights: [24, 20],
      rulesHeight: 40, slotHeight: 60, slotCount: 10 })).toThrow(RangeError);
  });
});

/**
 * The ☰ Decks picker inside the title-safe frame: Close sat on y 678 (drawn
 * 658-698) across the panel's bottom edge, and the pager's hit band ran 8px
 * into the second tile row, until 1.8.1. Close is a md button (40 drawn, 44
 * hit); the pager's reach comes from the shared pager's own geometry.
 */
describe('deck picker footer', () => {
  const picker = DECK_PICKER_LAYOUT;
  const hitHalf = theme.control.minHitHeight / 2;
  const panelTop = theme.design.centerY - picker.panelHeight / 2;
  const panelBottom = theme.design.centerY + picker.panelHeight / 2;
  const lastTile = deckPickerTilePosition(picker.tile.cols * picker.tile.rows - 1);
  const gridBottom = lastTile.y + picker.tile.height / 2;

  it('keeps the panel, the tiles and the footer inside the frame', () => {
    expect(panelTop).toBeGreaterThanOrEqual(theme.design.safeTop);
    expect(panelBottom).toBeLessThanOrEqual(theme.design.safeBottom);
    expect(picker.footerY + hitHalf).toBeLessThanOrEqual(theme.design.safeBottom);
    // Close is drawn inside the panel with a margin, not across its edge.
    expect(picker.footerY + theme.control.heightMd / 2).toBeLessThanOrEqual(panelBottom - 8);
    expect(picker.gridLeft).toBeGreaterThanOrEqual(theme.design.safeLeft);
    expect(lastTile.x + picker.tile.width / 2).toBeLessThanOrEqual(theme.design.safeRight);
    expect(picker.gridTop).toBeGreaterThan(picker.titleY);
  });

  it('puts the footer below the second tile row and the pager clear of Close', () => {
    // The footer's hit bands (pager and Close share its line) start below the tiles.
    expect(picker.footerY - hitHalf).toBeGreaterThan(gridBottom);
    const pagerLeft = picker.pagerX - PAGER_HIT_REACH.left;
    const pagerRight = picker.pagerX + PAGER_HIT_REACH.right;
    const closeLeft = picker.closeX - Math.max(picker.closeMinWidth, theme.control.minHitWidth) / 2;
    expect(pagerLeft).toBeGreaterThanOrEqual(picker.gridLeft);
    expect(pagerRight).toBeLessThan(closeLeft);
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

  it('fits three View buttons inside the pane without overlapping', () => {
    for (const m of MEASURED) {
      const xs = deckPaneTabRow(m.label, m.view);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - m.view[i] / 2).toBeGreaterThanOrEqual(xs[i - 1] + m.view[i - 1] / 2 + theme.space(2));
      }
      expect(xs[2] + m.view[2] / 2).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right);
    }
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
    const statusTop = s.statusTop;
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

describe('deck pane measured accessibility layout', () => {
  it('keeps wrapped titles above the controls in every accessibility cell', () => {
    forEachA11yCell(() => {
      for (const lines of [1, 2, 3]) {
        const titleHeight = lines * menuLineHeight(theme.type.h2);
        const header = deckPaneHeaderLayout(titleHeight);
        expect(header.titleY - titleHeight / 2).toBeGreaterThanOrEqual(theme.design.safeTop);
        expect(header.formatY - theme.control.minHitHeight / 2)
          .toBeGreaterThanOrEqual(header.titleY + titleHeight / 2 + theme.space(2));
        expect(header.toggleY - theme.control.minHitHeight / 2)
          .toBeGreaterThanOrEqual(header.formatY + theme.control.minHitHeight / 2);
        expect(header.contentTop).toBeGreaterThanOrEqual(header.toggleY + theme.control.minHitHeight / 2);
      }
    });
  });

  it('separates measured summary lines, curve labels, status and both action rows in every accessibility cell', () => {
    forEachA11yCell(() => {
      for (const lines of [1, 2, 3]) {
        const measured = {
          headingHeight: menuLineHeight(theme.type.label), countHeight: menuLineHeight(theme.type.micro),
          manaValueHeight: menuLineHeight(theme.type.micro), summaryHeight: lines * menuLineHeight(theme.type.caption),
          statusHeight: 2 * menuLineHeight(theme.type.caption),
        };
        const summary = deckPaneSummaryLayout(measured);
        const hitHalf = theme.control.minHitHeight / 2;
        expect(summary.ctaY + hitHalf).toBeLessThanOrEqual(theme.design.safeBottom);
        expect(summary.secondaryCtaY + hitHalf).toBeLessThanOrEqual(summary.ctaY - hitHalf - theme.space(2));
        expect(summary.statusBottomY).toBeLessThanOrEqual(summary.secondaryCtaY - hitHalf - theme.space(2));
        expect(summary.summaryLineY + measured.summaryHeight / 2)
          .toBeLessThanOrEqual(summary.statusTop - theme.space(4));
        expect(summary.manaValueY + measured.manaValueHeight / 2).toBeLessThanOrEqual(summary.summaryTop - theme.space(2));
        const highestCountTop = summary.barBaseY - summary.barMaxHeight - summary.countOffsetY - measured.countHeight / 2;
        expect(summary.statsHeadingY + measured.headingHeight / 2).toBeLessThanOrEqual(highestCountTop - theme.space(1));
        expect(summary.listBottom).toBeLessThanOrEqual(summary.statsHeadingY - measured.headingHeight / 2 - theme.space(3));
        for (const headingWidth of [80, 96, 110]) {
          expect(summary.pagerX - hitHalf - (DECK_PANE_LAYOUT.left + headingWidth)).toBeGreaterThanOrEqual(theme.space(3));
          expect(summary.pagerX + PAGER_HIT_REACH.right).toBeLessThanOrEqual(DECK_PANE_LAYOUT.right);
        }
        expect(summary.pagerY - hitHalf).toBeGreaterThan(theme.design.safeTop);
      }
    });
  });

  it('reads title and row roles live after the layout object has been retained', () => {
    const layout = DECK_PANE_LAYOUT;
    forEachA11yCell(() => {
      expect(layout.title.halfHeight * 2).toBeGreaterThanOrEqual(2 * menuLineHeight(theme.type.h2));
      expect(layout.cards.rowPitch).toBe(28); // the release pitch; wrapped text is measured per row
      expect(layout.cards.starSize).toBeGreaterThanOrEqual(theme.type.h2);
      expect(layout.cards.pinSize).toBeGreaterThanOrEqual(theme.type.label);
      expect(layout.summary.statusBottomY - layout.summary.statusTop).toBeGreaterThanOrEqual(2 * menuLineHeight(theme.type.caption));
    });
  });
});

describe('deck picker measured accessibility layout', () => {
  it('fits full measured identities and action hit bands inside every paged tile in every accessibility cell', () => {
    forEachA11yCell(() => {
      for (const lines of [1, 2, 3]) {
        const nameHeight = lines * menuLineHeight(theme.type.label);
        const badgeHeight = 2 * menuLineHeight(theme.type.micro);
        const noteHeight = 2 * menuLineHeight(theme.type.micro);
        for (const actionWidth of [90, 110, 138]) {
          const layout = deckPickerLayout({ count: 17, nameHeight, badgeHeight, deleteNoteHeight: noteHeight, actionWidth });
          const hitHalf = theme.control.minHitHeight / 2;
          expect(theme.design.centerY - layout.panelHeight / 2).toBeGreaterThanOrEqual(theme.design.safeTop);
          expect(theme.design.centerY + layout.panelHeight / 2).toBeLessThanOrEqual(theme.design.safeBottom);
          expect(layout.nameTop + nameHeight).toBeLessThanOrEqual(layout.badgeTop - theme.space(1));
          expect(layout.badgeTop + badgeHeight).toBeLessThanOrEqual(layout.portrait.y - layout.portrait.height / 2 - theme.space(3));
          expect(layout.portrait.x + layout.portrait.width / 2).toBeLessThanOrEqual(layout.actions.firstX - actionWidth / 2 - theme.space(3));
          expect(layout.actions.firstX + actionWidth / 2).toBeLessThanOrEqual(layout.actions.secondX - actionWidth / 2 - theme.space(3));
          expect(layout.actions.secondX + actionWidth / 2).toBeLessThanOrEqual(layout.tile.width - layout.padding);
          expect(layout.actions.firstY + hitHalf).toBeLessThanOrEqual(layout.actions.secondY - hitHalf - theme.space(2));
          expect(layout.actions.secondY + hitHalf).toBeLessThanOrEqual(layout.actions.noteY - theme.space(2));
          expect(layout.actions.noteY + noteHeight).toBeLessThanOrEqual(layout.tile.height - layout.padding);
          expect(layout.portrait.y + layout.portrait.height / 2).toBeLessThanOrEqual(layout.tile.height - layout.padding);
          for (let i = 0; i < layout.pageSize; i++) {
            const position = deckPickerTilePosition(i, layout);
            expect(position.x - layout.tile.width / 2).toBeGreaterThanOrEqual(theme.design.safeLeft);
            expect(position.x + layout.tile.width / 2).toBeLessThanOrEqual(theme.design.safeRight);
            expect(position.y - layout.tile.height / 2).toBeGreaterThanOrEqual(layout.gridTop);
            expect(position.y + layout.tile.height / 2).toBeLessThanOrEqual(layout.footerY - hitHalf - theme.space(4));
          }
        }
      }
    });
  });
});
