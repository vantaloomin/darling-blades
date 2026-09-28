import { afterEach, describe, expect, it } from 'vitest';
import { setAccessibility } from '../../src/ui/accessibility';
import { SCENE_TITLE } from '../../src/ui/layout';
import {
  PROFILE_GAPS,
  PROFILE_HEADER,
  PROFILE_PANELS,
  PROFILE_RECORD,
  PROFILE_REPLAYS,
  PROFILE_REPLAY_ROW,
  PROFILE_SAVE_ACTIONS,
  PROFILE_SAVE_CARD_PICKER,
  PROFILE_SHOWCASE,
  PROFILE_STAT_ROWS,
  PROFILE_TAB_STRIP,
  packCentered,
  packLeft,
  packRight,
  profileHeaderBandBottom,
  profileStatRowCapacity,
  profileReplayCell,
  profileStatRowY,
} from '../../src/ui/profilePresentation';
import { theme } from '../../src/ui/theme';

const HIT = theme.control.minHitHeight;

/*
 * The Profile layout RULES (inside the frame, gaps, the panel inset, the
 * dialogs) run in the scale-and-contrast fixture matrix,
 * tests/ui/accessibilityLayout.test.ts, in all six cells, together with the
 * replay grid's known larger-text failure. This file keeps what is specific to
 * the module: the packing helpers and the live geometry's golden values.
 */

describe('packing a row of measured controls', () => {
  const widths = [10, 20, 30];
  const edges = (xs: number[]): [number, number][] => xs.map((x, i) => [x - widths[i] / 2, x + widths[i] / 2]);

  it('keeps the requested gap after each box and lands the group where asked', () => {
    for (const xs of [packLeft(widths, 100, [4, 8]), packRight(widths, 100, [4, 8]), packCentered(widths, 100, [4, 8])]) {
      const e = edges(xs);
      expect(e[1][0] - e[0][1]).toBe(4);
      expect(e[2][0] - e[1][1]).toBe(8);
    }
    expect(edges(packLeft(widths, 100, 5))[0][0]).toBe(100);
    expect(edges(packRight(widths, 100, 5))[2][1]).toBe(100);
    const centred = edges(packCentered(widths, 100, 5));
    expect((centred[0][0] + centred[2][1]) / 2).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// The geometry is live: it follows the text size in force
// ---------------------------------------------------------------------------

/**
 * Golden compatibility fixture: the type-derived Profile values exactly as
 * release/1.9 computed them (once, at import) before C3 made them live,
 * measured by running that code. At standard text the live layout must hand
 * the scene every one of them unchanged.
 */
const RELEASE_1_9_PROFILE = {
  sceneTitleFontSize: 28,
  titleHalfWidth: 84,
  recordRateY: 148,
  recordHalfWidth: 112,
  noticeY: 151,
  showcaseLabelY: 97.5,
  sealY: 135,
  sealWidth: 140,
  sealTitleY: -9.5,
  sealClaimedY: 10,
  headerBandBottom: 162.63062577111583,
  panelsTop: 187,
  headY: 221,
  statRowsTop: 255,
  statRowCapacity: 10,
  replaysTop: 243,
  replayMetaY: 48,
  replayNoteY: 63.5,
  replayCellHeight: 77,
  pickerSearchHeight: 32,
};

function liveProfileValues(): typeof RELEASE_1_9_PROFILE {
  return {
    sceneTitleFontSize: SCENE_TITLE.fontSize,
    titleHalfWidth: PROFILE_HEADER.titleHalfWidth,
    recordRateY: PROFILE_RECORD.rateY,
    recordHalfWidth: PROFILE_RECORD.halfWidth,
    noticeY: PROFILE_SAVE_ACTIONS.noticeY,
    showcaseLabelY: PROFILE_SHOWCASE.labelY,
    sealY: PROFILE_SHOWCASE.sealY,
    sealWidth: PROFILE_SHOWCASE.sealWidth,
    sealTitleY: PROFILE_SHOWCASE.titleY,
    sealClaimedY: PROFILE_SHOWCASE.claimedY,
    headerBandBottom: profileHeaderBandBottom(),
    panelsTop: PROFILE_PANELS.top,
    headY: PROFILE_PANELS.headY,
    statRowsTop: PROFILE_STAT_ROWS.top,
    statRowCapacity: profileStatRowCapacity(),
    replaysTop: PROFILE_REPLAYS.top,
    replayMetaY: PROFILE_REPLAY_ROW.metaY,
    replayNoteY: PROFILE_REPLAY_ROW.noteY,
    replayCellHeight: PROFILE_REPLAYS.cellHeight,
    pickerSearchHeight: PROFILE_SAVE_CARD_PICKER.searchHeight,
  };
}

describe('the Profile layout follows the text size in force', () => {
  afterEach(() => {
    setAccessibility({ textScale: 1, highContrast: false });
  });

  it('hands the scene release/1.9\'s values at standard text, before and after a change', () => {
    expect(liveProfileValues()).toEqual(RELEASE_1_9_PROFILE);
    setAccessibility({ textScale: 1.3, highContrast: true });
    setAccessibility({ textScale: 1, highContrast: false });
    expect(liveProfileValues()).toEqual(RELEASE_1_9_PROFILE);
  });

  /**
   * At Largest (130%) the approved role table gives h1 32, h2 23, body 21,
   * label 18, caption 16 and micro 14; each value below is its documented
   * rule worked at those sizes.
   */
  it('lays out for the Largest text size once it is in force', () => {
    setAccessibility({ textScale: 1.3, highContrast: false });
    expect(SCENE_TITLE.fontSize).toBe(32);
    // Six title-size glyphs of allowance: follows the live title size, not the import-time one.
    expect(PROFILE_HEADER.titleHalfWidth).toBe(96);
    // Eight h1 glyphs either side of the record.
    expect(PROFILE_RECORD.halfWidth).toBe(128);
    // The W / L line (114), half an h1, a within gap, half a body line.
    expect(PROFILE_RECORD.rateY).toBe(114 + 16 + 12 + 10.5);
    // The actions' hit bottom (136), a spacing step, half a label line.
    expect(PROFILE_SAVE_ACTIONS.noticeY).toBe(136 + 8 + 9);
    // The Showcase label (micro) hangs from the record's top (92).
    expect(PROFILE_SHOWCASE.labelY).toBe(92 + 7);
    // The seal's caption + 8 + micro block, centred on the plate.
    expect(PROFILE_SHOWCASE.titleY).toBe(-19 + 8);
    expect(PROFILE_SHOWCASE.claimedY).toBe(19 - 7);
    // A wider record allowance leaves the seals less room, so they narrow.
    expect(PROFILE_SHOWCASE.sealWidth).toBeLessThan(RELEASE_1_9_PROFILE.sealWidth);
    // The replay cell: pad, Watch track, datum, caption line, datum, micro line, pad.
    expect(PROFILE_REPLAY_ROW.metaY).toBe(8 + 30 + 4 + 8);
    expect(PROFILE_REPLAY_ROW.noteY).toBe(50 + 8 + 4 + 7);
    expect(PROFILE_REPLAYS.cellHeight).toBe(69 + 7 + 8);
    // The search field: an 18px line box (ceil 22.5), padding and border.
    expect(PROFILE_SAVE_CARD_PICKER.searchHeight).toBe(23 + 12 + 2);
    // The taller header band pushes the panels, and everything hung from their head line, down.
    expect(PROFILE_PANELS.top).toBeGreaterThan(RELEASE_1_9_PROFILE.panelsTop);
    expect(PROFILE_PANELS.headY - PROFILE_PANELS.top).toBe(PROFILE_GAPS.between + 23 / 2);
    expect(PROFILE_TAB_STRIP.y).toBe(PROFILE_PANELS.headY);
    expect(PROFILE_STAT_ROWS.top).toBe(PROFILE_PANELS.headY + HIT / 2 + PROFILE_GAPS.within);
    expect(profileStatRowY(0)).toBe(PROFILE_STAT_ROWS.top + PROFILE_STAT_ROWS.height / 2);
    expect(PROFILE_REPLAYS.top).toBe(PROFILE_PANELS.headY + 23 / 2 + PROFILE_GAPS.within);
    expect(profileReplayCell(0).y).toBe(PROFILE_REPLAYS.top);
  });
});
