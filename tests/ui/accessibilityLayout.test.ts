import { fitMenuName, menuTextFindings, menuScrollOffset, type MenuNameText } from '../../src/ui/menuText';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAccessibility, TEXT_SCALES } from '../../src/ui/accessibility';
import { mainMenuButtonY, mainMenuCornerY, mainMenuCornerLayout, mainMenuDailyLayout, menuNoticeLayout, menuLineHeight, MAIN_MENU_ITEMS, MAIN_MENU_X } from '../../src/ui/mainMenuPresentation';
import { menuSelectionMark, gauntletDetailLayout, gauntletNameLineLimit, playDeckPickerLayout, playDeckRowColumns, playMenuLayout, playTextStack, practicePickerLayout, gauntletPresentation } from '../../src/ui/playPresentation';
import { gauntletTowerLayout, gauntletScrollToRung } from '../../src/ui/layout';
import { controlFontSize } from '../../src/ui/controlStyle';
import {
  COMPACT_TOUCH_GAP_RANGE,
  GAP_FLOORS,
  anchoredControlBounds,
  inactiveGap,
  inflateHitRect,
  isInsideTitleSafe,
  isRectContained,
  measureControlCluster,
  measureThemedButton,
  modalShellLayout,
  SCENE_TITLE,
  sceneHeaderFooterLayout,
  type Rect,
} from '../../src/ui/layout';
import {
  PROFILE_CONFIRM_MODAL,
  PROFILE_EXPORT_MODAL,
  PROFILE_GAPS,
  PROFILE_HEADER,
  PROFILE_IMPORT_MODAL,
  PROFILE_PANELS,
  PROFILE_PANEL_BOTTOM_INSET,
  PROFILE_RECORD,
  PROFILE_REPLAYS,
  PROFILE_REPLAY_ROW,
  PROFILE_SAVE_ACTIONS,
  PROFILE_SAVE_CARD_PICKER,
  PROFILE_SHOWCASE,
  PROFILE_STAT_ROWS,
  PROFILE_TAB_STRIP,
  PROFILE_WIDE_MODAL,
  profileHeaderBandBottom,
  profileStatRowCapacity,
  profileConfirmFooterXs,
  profileConfirmLayout,
  profileExportFooterXs,
  profileExportLayout,
  profileImportFooterXs,
  profileImportLayout,
  profilePickerLayout,
  profileReplayCell,
  profileReplayNameWidth,
  profileSaveActionCenters,
  profileStatNoteTop,
  profileStatRowY,
  profileWatchX,
  textBlockHeight,
} from '../../src/ui/profilePresentation';
import {
  SETTINGS_FRAMES,
  SETTINGS_HEADER_ACTION,
  SETTINGS_PANELS,
  SETTINGS_TAB_ROW,
  layoutSettingsTab,
  settingsRhythm,
  settingsTextSizeCaption,
} from '../../src/ui/settingsPresentation';
import { RARITY_ORDER } from '../../src/meta/collectionFilter';
import { theme } from '../../src/ui/theme';
import { A11Y_CELLS } from './a11yCells';

/**
 * The scale-and-contrast fixture matrix, headless half (1.9 lane C, C5; plan
 * "Gates", item 1). Six cells: text size 100, 115 and 130% by standard and
 * high contrast. In every cell, every enrolled Phaser-free layout module keeps
 * every placed control inside the title-safe frame, sibling hit boxes disjoint
 * by the within-group gap, and content above each panel's bottom inset. These
 * are rule assertions, never pinned coordinates.
 *
 * This file is the matrix's one entry point: `ENROLLED` below lists each
 * enrolled module and where each of its rules runs. A rule another file
 * already sweeps over every cell is referenced there, not copied here. What
 * makes such a sweep cover every cell is structural: it iterates
 * `A11Y_CELLS` (tests/ui/a11yCells.ts), as this file does. The registry is
 * documentation; its last test only checks that each entry still points at
 * something. A module is enrolled when
 * its pass lands, never before (enrolling early makes the suite red on work
 * not yet done); each scene pass adds its own row.
 *
 * What this half cannot see: text. Glyph widths and line boxes depend on the
 * fonts the browser falls back to, so a rule here holds for token sizes and
 * measured-width sweeps, and the rendered probe (`src/dev/a11yProbe.ts`) is
 * the only clipping detector.
 */


type MatrixRule = 'frame' | 'gap' | 'inset' | 'resolver';

/** Where a rule runs: in this file (under the describe named), or in another file's every-cell sweep. */
type RuleHome = { here: string } | { file: string; tests: readonly string[] };

interface Enrolled {
  module: string;
  rules: Partial<Record<MatrixRule, RuleHome>>;
}

/** The enrolled modules (wave 1: Settings after C4, the layout.ts headers and SCENE_TITLE, Profile) and the resolver. */
const ENROLLED: readonly Enrolled[] = [
  { module: 'src/ui/limitedPanePresentation.ts and src/ui/limitedDraftPresentation.ts (Limited builder and draft)', rules: {
    frame: { file: 'tests/ui/limitedPanePresentation.test.ts', tests: ['keeps the header lines, the three panels and the footer apart in every accessibility cell'] },
    gap: { file: 'tests/ui/limitedDraftPresentation.test.ts', tests: ['keeps each label clear of the row under it in every accessibility cell', 'fits every pick inside the panel without thumbs touching in every accessibility cell'] },
    inset: { file: 'tests/ui/limitedPanePresentation.test.ts', tests: ['keeps every list row whole, above the pager and inside its panel in every accessibility cell', 'stacks the Details ledger in reading order above the panel inset in every accessibility cell'] },
  } },
  { module: 'src/ui/duelPanelPresentation.ts (Duel history, stack, zone, choices and coaches)', rules: {
    frame: { file: 'tests/ui/duelPanelPresentation.test.ts', tests: ['keeps ordinary zone capacity and anchors while measured action growth remains above the pager', 'keeps deep stack pages inside the frame without shrinking cards or losing stack order'] },
    gap: { file: 'tests/ui/duelPanelPresentation.test.ts', tests: ['keeps each whole Duty readable and puts overflow options on reachable pages', 'preserves complete history entries and their release gap across pages'] },
    inset: { file: 'tests/ui/duelPanelPresentation.test.ts', tests: ['keeps the coach footer outside the reading viewport at every text size'] },
  } },
  { module: 'src/ui/shopPresentation.ts and src/ui/deckShopLayout.ts (Shop)', rules: { frame: { file: 'tests/ui/shopPresentation.test.ts', tests: ['keeps wrapped pack identities above the art and the purchase action outside the reading band', 'sizes dialogs from measured content and keeps the footer separate', 'preserves the release list capacities, pitches and anchors for standard measured text'] } } },
  { module: 'src/ui/profilePresentation.ts (Profile measured replays)', rules: { inset: { file: 'tests/ui/shopPresentation.test.ts', tests: ['keeps every measured replay cell inside the panel while larger lines reduce capacity'] } } },
  { module: 'src/ui/deckPanePresentation.ts (Deck Builder)', rules: { frame: { file: 'tests/ui/deckPanePresentation.test.ts', tests: ['keeps wrapped titles above the controls in every accessibility cell','separates measured summary lines, curve labels, status and both action rows in every accessibility cell','fits full measured identities and action hit bands inside every paged tile in every accessibility cell'] } } },
  { module: 'src/ui/deckListPaging.ts (Deck Builder)', rules: { frame: { file: 'tests/ui/deckListPaging.test.ts', tests: ['keeps every wrapped row whole, reachable and separate from its neighbours and pager in every accessibility cell', 'fills the Darlings fixture page with measured rows at $textScale, touch $touch'] } } },
  { module: 'src/ui/deckPoolLayout.ts (Deck Builder)', rules: { frame: { file: 'tests/ui/deckPoolLayout.test.ts', tests: ['keeps exempt card faces and their input bands inside the pool in every accessibility cell'] } } },
  { module: 'src/ui/collectionPresentation.ts (Collection)', rules: { frame: { file: 'tests/ui/collectionPresentation.test.ts', tests: ['keeps the search, statistics, filters, and binder in separate bands','keeps every face and its full-size badge band within its binder page','sizes the odds plate from all wrapped lines above the panel inset','paginates all finishes without crossing wrapped actions or the pager'] } } },
  { module: 'src/ui/toastQueue.ts and src/ui/cosmeticPickerLayout.ts (Toast, Cosmetic picker; wave 3 batch C)', rules: {
    frame: { file: 'tests/ui/cosmeticPickerLayout.test.ts', tests: ['keeps wrapped names, blurbs, the tag and Equip apart and the shell inside the frame in every accessibility cell'] },
    gap: { file: 'tests/ui/toastQueue.test.ts', tests: ['keeps every line apart and inside the plaque in every accessibility cell, for one- to three-line bodies', 'hangs a stack of grown cards from the release top, inside the frame and a gap apart'] },
    inset: { file: 'tests/ui/toastQueue.test.ts', tests: ['keeps every line apart and inside the plaque in every accessibility cell, for one- to three-line bodies'] },
  } },
  { module: 'src/ui/mainMenuPresentation.ts (Main menu)', rules: {
    frame: { here: 'Main menu: measured chrome and content-sized notices' },
    gap: { here: 'Main menu: measured chrome and content-sized notices' },
    inset: { here: 'Main menu: measured chrome and content-sized notices' },
  } },
  { module: 'src/ui/playPresentation.ts (Play)', rules: {
    frame: { here: 'Play: deck plate and paged deck selection' },
    gap: { here: 'Play: deck plate and paged deck selection' },
    inset: { here: 'Play: deck plate and paged deck selection' },
  } },
  { module: 'src/ui/playPresentation.ts (PracticePicker)', rules: {
    frame: { here: 'Practice: portrait, name and action tracks' }, gap: { here: 'Practice: portrait, name and action tracks' },
    inset: { here: 'Practice: portrait, name and action tracks' },
  } },
  { module: 'src/ui/playPresentation.ts and src/ui/layout.ts (Gauntlet)', rules: {
    frame: { here: 'Gauntlet: the scrolling rail and detail column' }, gap: { here: 'Gauntlet: the scrolling rail and detail column' },
    inset: { here: 'Gauntlet: the scrolling rail and detail column' },
  } },
  {
    module: 'src/ui/settingsPresentation.ts (Settings, C4)',
    rules: {
      frame: { here: 'Settings: the header, tab row and panels inside the title-safe frame' },
      gap: {
        file: 'tests/ui/settingsPresentation.test.ts',
        tests: [
          'keeps the three tabs centred, disjoint by the gap, and inside the frame at every plausible width',
          'keeps the %s chips on the control edge, hit boxes disjoint, inside the column, at every size',
          'never overlaps, and separates groups by more than rows',
        ],
      },
      inset: {
        file: 'tests/ui/settingsPresentation.test.ts',
        tests: [
          'keeps every column inside the panel band with the bottom inset',
          'fits one more caption wrap and one more stacked row per column than rendered, on every tab at every size',
        ],
      },
    },
  },
  {
    module: 'src/ui/layout.ts (SCENE_TITLE, sceneHeaderFooterLayout)',
    rules: {
      frame: { here: 'the shared header: title, back control, gold badge and footer inside the frame' },
      gap: { here: 'the shared header: title, back control, gold badge and footer inside the frame' },
    },
  },
  {
    module: 'src/ui/profilePresentation.ts (Profile, C3)',
    rules: {
      frame: { here: 'the Profile header' },
      gap: { here: 'the Profile panels' },
      inset: { here: 'the replay grid' },
    },
  },
  {
    module: 'src/ui/controlStyle.ts (the selected-trigger bar, C3)',
    rules: {
      inset: {
        file: 'tests/ui/liveChrome.test.ts',
        tests: ["sits on the trigger's bottom edge, at least 1px clear of the label box, at every text size and contrast"],
      },
    },
  },
  {
    module: 'src/ui/accessibility.ts (the resolver: role sizes, normalization, contrast floors)',
    rules: {
      resolver: {
        file: 'tests/ui/accessibility.test.ts',
        tests: [
          'sizes each role at 100, 115 and 130% as approved',
          'snaps a number to the nearest allowed size, a tie taking the smaller',
          "reads anything that is not a finite number as Standard",
          'standard holds 4.5:1 on every used pair',
          'high contrast holds 7:1 on every used pair and never lowers a pair below standard',
        ],
      },
    },
  },
  { module: 'src/ui/duelModalPresentation.ts duelButtonPairCenters (Duel tutorial complete overlay)', rules: {
    frame: { file: 'tests/ui/duelModalPresentation.test.ts', tests: ['keeps a minimum gap, stays centred and inside the safe frame in every cell'] },
    gap: { file: 'tests/ui/duelModalPresentation.test.ts', tests: ['keeps a minimum gap, stays centred and inside the safe frame in every cell'] },
  } },
];

/**
 * Line boxes as a multiple of the font size, measured in Phaser in headless
 * Edge: Inter 1.28 (settingsPresentation.test.ts, 2026-09-28), Cinzel bold
 * 33px at 28px (layout.test.ts, 2026-09-25). They size a line, never a width.
 */
const INTER_LINE = 1.28;
const CINZEL_LINE = 33 / 28;
const lineBox = (size: number, ratio: number): number => Math.ceil(size * ratio);

// ---------------------------------------------------------------------------
// Profile (moved here from profilePresentation.test.ts, which ran it at
// standard contrast only)
// ---------------------------------------------------------------------------

const HIT = theme.control.minHitHeight;
const FRAME = theme.design.titleSafe;

/** A box of `width` x `height` centred on (cx, cy). */
function box(cx: number, cy: number, width: number, height: number): Rect {
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
const bottom = (r: Rect): number => r.y + r.height;
const right = (r: Rect): number => r.x + r.width;
/** A themed button's hit box, from its centre and visual size. */
function hitBox(cx: number, cy: number, visualWidth: number, visualHeight: number = theme.control.heightMd): Rect {
  return inflateHitRect(box(cx, cy, visualWidth, visualHeight), theme.control.minHitWidth, HIT);
}
const leftPanelBox = (): Rect => {
  const P = PROFILE_PANELS;
  return { x: P.left.x, y: P.top, width: P.left.width, height: P.bottom - P.top };
};
const rightPanelBox = (): Rect => {
  const P = PROFILE_PANELS;
  return { x: P.right.x, y: P.top, width: P.right.width, height: P.bottom - P.top };
};
/**
 * Float tolerance for the gap checks (the idea of `isRectContained`'s
 * epsilon): derived geometry such as the picker's thumb pitch can land a
 * gap of exactly the floor at 11.999999999999943. A millionth of a pixel is
 * noise, never a layout difference.
 */
const GAP_EPSILON = 1e-6;
/** Every pair in `rects` keeps at least `gap` of clear space. */
function expectPairwiseGap(rects: readonly [string, Rect][], gap: number): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const measured = inactiveGap(rects[i][1], rects[j][1]);
      expect(measured.gap, `${rects[i][0]} / ${rects[j][0]}`).toBeGreaterThanOrEqual(gap - GAP_EPSILON);
    }
  }
}
/** Items listed top to bottom never overlap and keep at least `gap` between neighbours. */
function expectStacked(items: readonly [string, Rect][], gap: number): void {
  for (let i = 1; i < items.length; i++) {
    expect(items[i][1].y - bottom(items[i - 1][1]), `${items[i - 1][0]} -> ${items[i][0]}`).toBeGreaterThanOrEqual(gap - GAP_EPSILON);
  }
}

// ---------------------------------------------------------------------------
// The main screen
// ---------------------------------------------------------------------------

// The boxes below are functions, not constants: the layout follows the text
// size in force, and each rule runs at every text size (see the loop below).
const backLink = anchoredControlBounds('top-left', 0, 0).hit;
const titleTrack = (): Rect => box(PROFILE_HEADER.titleX, PROFILE_HEADER.y, 2 * PROFILE_HEADER.titleHalfWidth, theme.type.display);
const recordLine = (): Rect => box(PROFILE_RECORD.x, PROFILE_RECORD.y, 2 * PROFILE_RECORD.halfWidth, theme.type.h1);
const rateLine = (): Rect => box(PROFILE_RECORD.x, PROFILE_RECORD.rateY, 2 * PROFILE_RECORD.halfWidth, theme.type.body);
const seals = (): [string, Rect][] =>
  PROFILE_SHOWCASE.xs.map((x, i) => [
    `seal ${i}`,
    box(x, PROFILE_SHOWCASE.sealY, PROFILE_SHOWCASE.tilted.width, PROFILE_SHOWCASE.tilted.height),
  ]);
function saveActions(exportWidth: number, importWidth: number): [string, Rect][] {
  const { exportX, importX } = profileSaveActionCenters(exportWidth, importWidth);
  return [
    ['export', box(exportX, PROFILE_SAVE_ACTIONS.y, exportWidth, HIT)],
    ['import', box(importX, PROFILE_SAVE_ACTIONS.y, importWidth, HIT)],
  ];
}


function profileLayoutRules(): void {
  const rule = it;

  describe('the Profile header', () => {
    rule('puts the title on the back link\'s line, inside the frame and clear of the link', () => {
      expect(PROFILE_HEADER.y).toBe(backLink.y + backLink.height / 2);
      expect(isInsideTitleSafe(titleTrack())).toBe(true);
      expect(inactiveGap(backLink, titleTrack()).gap).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
    });

    rule('starts the record row a within-group gap under the header track', () => {
      const headerBottom = backLink.y + backLink.height;
      const rowTops = [recordLine().y, ...saveActions(PROFILE_SAVE_ACTIONS.minWidth, PROFILE_SAVE_ACTIONS.minWidth).map(([, r]) => r.y)];
      for (const top of rowTops) expect(top).toBeGreaterThanOrEqual(headerBottom + PROFILE_GAPS.within);
      const labelTop = PROFILE_SHOWCASE.labelY - theme.type.micro / 2;
      expect(labelTop, 'the Showcase label sits under the back link, not inside its hit box').toBeGreaterThanOrEqual(
        headerBottom + PROFILE_GAPS.within,
      );
    });

    rule('keeps the showcase, the record and the save actions apart on the record row', () => {
      const band: [string, Rect][] = [
        ...seals(),
        ['record', recordLine()],
        ['rate', rateLine()],
        ...saveActions(PROFILE_SAVE_ACTIONS.minWidth, PROFILE_SAVE_ACTIONS.minWidth),
      ];
      for (const [what, r] of band) expect(isInsideTitleSafe(r), what).toBe(true);
      for (const [what, seal] of seals()) {
        expect(recordLine().x - right(seal), what).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
        expect(rateLine().x - right(seal), what).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
      }
      expectPairwiseGap(seals(), PROFILE_GAPS.datum);
    });

    rule('stacks the Showcase label over its seals, and each seal\'s two lines inside its inner stroke', () => {
      const labelBottom = PROFILE_SHOWCASE.labelY + theme.type.micro / 2;
      expect(PROFILE_SHOWCASE.sealY - PROFILE_SHOWCASE.tilted.height / 2).toBeGreaterThanOrEqual(labelBottom + PROFILE_GAPS.datum);
      expect(seals()[0][1].x).toBeGreaterThanOrEqual(FRAME.left);

      const innerHalfH = PROFILE_SHOWCASE.sealHeight / 2 - PROFILE_SHOWCASE.innerInset;
      const innerWidth = PROFILE_SHOWCASE.sealWidth - 2 * PROFILE_SHOWCASE.innerInset;
      const title = [PROFILE_SHOWCASE.titleY - theme.type.caption / 2, PROFILE_SHOWCASE.titleY + theme.type.caption / 2];
      const claimed = [PROFILE_SHOWCASE.claimedY - theme.type.micro / 2, PROFILE_SHOWCASE.claimedY + theme.type.micro / 2];
      expect(title[0]).toBeGreaterThanOrEqual(-innerHalfH);
      expect(claimed[1]).toBeLessThanOrEqual(innerHalfH);
      expect(claimed[0] - title[1]).toBeGreaterThanOrEqual(PROFILE_GAPS.datum);
      expect(PROFILE_SHOWCASE.titleMaxWidth).toBeLessThan(innerWidth);
    });

    /**
     * Both labels are font-dependent, so the pair is placed from measured
     * widths; the rule must hold for any plausible pair, not just this machine's.
     * The labels measure about 80px in Inter; 200 is more than twice that.
     */
    rule('right-aligns the save actions to the frame for any measured width, clear of the record', () => {
      for (let exportWidth = PROFILE_SAVE_ACTIONS.minWidth; exportWidth <= 200; exportWidth += 4) {
        for (let importWidth = PROFILE_SAVE_ACTIONS.minWidth; importWidth <= 200; importWidth += 4) {
          const [[, exp], [, imp]] = saveActions(exportWidth, importWidth);
          const at = `${exportWidth}/${importWidth}`;
          expect(right(imp), at).toBe(FRAME.right);
          expect(imp.x - right(exp), at).toBeGreaterThanOrEqual(GAP_FLOORS.compactTouch);
          expect(exp.x - right(recordLine()), at).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
        }
      }
    });

    rule('hangs the import notice under the save actions, right-aligned, above the panels', () => {
      const actionsBottom = PROFILE_SAVE_ACTIONS.y + HIT / 2;
      const noticeTop = PROFILE_SAVE_ACTIONS.noticeY - theme.type.label / 2;
      const noticeBottom = PROFILE_SAVE_ACTIONS.noticeY + theme.type.label / 2;
      expect(PROFILE_SAVE_ACTIONS.right).toBe(FRAME.right);
      expect(noticeTop).toBeGreaterThanOrEqual(actionsBottom + PROFILE_GAPS.datum);
      expect(noticeBottom).toBeLessThanOrEqual(profileHeaderBandBottom());
    });
  });

  describe('the Profile panels', () => {
    const P = PROFILE_PANELS;

    rule('span the frame edge to edge, one region gap apart, from under the header band to the frame bottom', () => {
      const leftPanel = leftPanelBox();
      const rightPanel = rightPanelBox();
      expect(leftPanel.x).toBe(FRAME.left);
      expect(right(rightPanel)).toBe(FRAME.right);
      expect(rightPanel.x - right(leftPanel)).toBe(P.gap);
      expect(P.gap).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
      expect(P.top).toBeGreaterThanOrEqual(profileHeaderBandBottom() + PROFILE_GAPS.between);
      expect(isInsideTitleSafe(leftPanel)).toBe(true);
      expect(isInsideTitleSafe(rightPanel)).toBe(true);
    });

    rule('share a head line and mirrored insets: the tab strip on the left, the Replays heading on the right', () => {
      const leftPanel = leftPanelBox();
      const rightPanel = rightPanelBox();
      expect(PROFILE_TAB_STRIP.y).toBe(PROFILE_REPLAYS.headingY);
      expect(PROFILE_REPLAYS.headingX - rightPanel.x).toBe(P.inset);
      expect(PROFILE_TAB_STRIP.xs[0] - PROFILE_TAB_STRIP.width / 2 - leftPanel.x).toBe(P.inset);
      const headingTop = PROFILE_REPLAYS.headingY - theme.type.h2 / 2;
      expect(headingTop - P.top).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
      const tabVisualTop = PROFILE_TAB_STRIP.y - theme.control.heightSm / 2;
      expect(tabVisualTop - P.top).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
    });

    rule('lays the tab strip over exactly the stat-row column, with touch isolation between tabs', () => {
      const tabs = PROFILE_TAB_STRIP.xs.map((x) => box(x, PROFILE_TAB_STRIP.y, PROFILE_TAB_STRIP.width, theme.control.heightSm));
      expect(tabs[0].x).toBe(PROFILE_STAT_ROWS.x);
      expect(right(tabs[tabs.length - 1])).toBe(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width);
      const cluster = measureControlCluster(
        tabs.map((visual, i) => ({ id: `tab ${i}`, visual })),
        'compactTouch',
      );
      expect(cluster.meetsFloor).toBe(true);
      for (let i = 1; i < cluster.controls.length; i++) {
        const gap = cluster.controls[i].hit.x - right(cluster.controls[i - 1].hit);
        expect(gap).toBeGreaterThanOrEqual(COMPACT_TOUCH_GAP_RANGE.min);
        expect(gap).toBeLessThanOrEqual(COMPACT_TOUCH_GAP_RANGE.max);
      }
    });

    rule('fits the longest tab\'s rows and note inside the left panel, rows closer to each other than to the tabs', () => {
      const leftPanel = leftPanelBox();
      // Draft draws eight rows; Collection draws one per rarity plus three.
      const longest = Math.max(8, RARITY_ORDER.length + 3);
      expect(profileStatRowCapacity()).toBeGreaterThanOrEqual(longest);

      const rows = Array.from({ length: longest }, (_, i) =>
        box(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width / 2, profileStatRowY(i), PROFILE_STAT_ROWS.width, PROFILE_STAT_ROWS.height),
      );
      const tabHitBottom = PROFILE_TAB_STRIP.y + HIT / 2;
      const tabGap = rows[0].y - tabHitBottom;
      expect(tabGap).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
      for (let i = 1; i < rows.length; i++) {
        const gap = rows[i].y - bottom(rows[i - 1]);
        expect(gap).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
        expect(gap).toBeLessThan(tabGap);
      }
      for (let n = 1; n <= longest; n++) {
        const noteTop = profileStatNoteTop(n);
        expect(noteTop - bottom(rows[n - 1]), `note under ${n} rows`).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
        expect(noteTop + textBlockHeight(theme.type.micro, 1), `note under ${n} rows`).toBeLessThanOrEqual(
          P.bottom - PROFILE_PANEL_BOTTOM_INSET,
        );
      }
      for (const row of rows) expect(isRectContained(row, leftPanel)).toBe(true);
      expect(PROFILE_STAT_ROWS.textLeft - PROFILE_STAT_ROWS.x).toBe(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width - PROFILE_STAT_ROWS.textRight);
    });
  });

  describe('the replay grid', () => {
    const P = PROFILE_PANELS;
    const replayContent = (): Rect => ({
      x: P.right.x + P.inset,
      y: PROFILE_REPLAYS.top,
      width: P.right.width - 2 * P.inset,
      height: P.bottom - PROFILE_PANEL_BOTTOM_INSET - PROFILE_REPLAYS.top,
    });
    const replayCells = (): Rect[] => Array.from({ length: PROFILE_REPLAYS.capacity }, (_, i) => profileReplayCell(i));

    rule("replay grid: every page fits the panel's content box", () => {
      const content = replayContent();
      for (const [i, cell] of replayCells().entries()) expect(isRectContained(cell, content), `cell ${i}`).toBe(true);
    });

    rule('keeps the replays one gutter apart both ways, level with the heading and clear of it', () => {
      const cells = replayCells();
      expectPairwiseGap(cells.map((c, i) => [`cell ${i}`, c]), PROFILE_REPLAYS.gutter);
      const down = cells[1].y - bottom(cells[0]);
      const across = cells[PROFILE_REPLAYS.rows].x - right(cells[0]);
      expect(down).toBe(across);
      expect(cells[0].y - (PROFILE_REPLAYS.headingY + theme.type.h2 / 2)).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
      expect(cells[0].x).toBe(PROFILE_REPLAYS.headingX);
    });

    rule('reads newest first down the left column, then the right', () => {
      const cells = replayCells();
      expect(cells[1].x).toBe(cells[0].x);
      expect(cells[1].y).toBeGreaterThan(cells[0].y);
      expect(cells[PROFILE_REPLAYS.rows].y).toBe(cells[0].y);
      expect(cells[PROFILE_REPLAYS.rows].x).toBeGreaterThan(cells[0].x);
    });

    rule('keeps the Watch button padded inside its cell, and the name, meta and note lines apart', () => {
      const R = PROFILE_REPLAY_ROW;
      const w = PROFILE_REPLAYS.cellWidth;
      const h = PROFILE_REPLAYS.cellHeight;
      for (let watchWidth = R.watchMinWidth; watchWidth <= 120; watchWidth += 6) {
        const visual = box(profileWatchX(watchWidth), R.titleY, watchWidth, R.watchHeight);
        const hit = inflateHitRect(visual, theme.control.minHitWidth, HIT);
        expect(right(visual), `${watchWidth}`).toBe(w - R.padX);
        expect(visual.y).toBeGreaterThanOrEqual(R.padY);
        expect(isRectContained(hit, { x: 0, y: 0, width: w, height: h }), `${watchWidth}`).toBe(true);
        expect(visual.x - (R.textX + profileReplayNameWidth(watchWidth)), `${watchWidth}`).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
      }
      expect(R.textX + profileReplayNameWidth(0)).toBe(w - R.padX);

      const lines: [string, Rect][] = [
        ['name / Watch track', box(0, R.titleY, 1, R.watchHeight)],
        ['meta', box(0, R.metaY, 1, theme.type.caption)],
        ['older-version note', box(0, R.noteY, 1, theme.type.micro)],
      ];
      expect(lines[0][1].y).toBeGreaterThanOrEqual(R.padY);
      expectStacked(lines, PROFILE_GAPS.datum);
      expect(h - bottom(lines[2][1])).toBeGreaterThanOrEqual(R.padY);
    });

    rule('keeps every Watch hit box isolated from its neighbours', () => {
      const R = PROFILE_REPLAY_ROW;
      const hits: [string, Rect][] = replayCells().map((cell, i) => [
        `watch ${i}`,
        hitBox(cell.x + profileWatchX(R.watchMinWidth), cell.y + R.titleY, R.watchMinWidth, R.watchHeight),
      ]);
      expectPairwiseGap(hits, GAP_FLOORS.ordinary);
    });
  });

  // ---------------------------------------------------------------------------
  // The dialogs
  // ---------------------------------------------------------------------------

  const wide = modalShellLayout(PROFILE_WIDE_MODAL);
  const confirm = modalShellLayout(PROFILE_CONFIRM_MODAL);
  const contentBottom = (t: typeof wide): number => bottom(t.contentBounds);
  function titleBox(t: typeof wide, y: number): Rect {
    return box(t.titleTrack.x + t.titleTrack.width / 2, y, 1, theme.type.h1);
  }
  function expectFooterCluster(t: typeof wide, controls: { width: number; destructive?: boolean }[], xs: number[]): void {
    const visuals = controls.map((c, i) => box(xs[i], t.footerTrack.y + t.footerTrack.height / 2, c.width, theme.control.heightMd));
    const cluster = measureControlCluster(
      visuals.map((visual, i) => ({ id: `footer ${i}`, visual, destructive: controls[i].destructive })),
    );
    expect(cluster.meetsFloor).toBe(true);
    for (const c of cluster.controls) expect(isRectContained(c.hit, t.footerTrack), c.id).toBe(true);
    const span = [cluster.controls[0].hit.x, right(cluster.controls[cluster.controls.length - 1].hit)];
    expect((span[0] + span[1]) / 2).toBeCloseTo(t.footerTrack.x + t.footerTrack.width / 2, 6);
  }

  describe('the Profile dialogs', () => {
    rule('fit inside the title-safe frame with their reserved tracks intact', () => {
      for (const layout of [wide, confirm]) {
        expect(layout.fits).toBe(true);
        expect(layout.tracksInsideTitleSafe).toBe(true);
        expect(isInsideTitleSafe(layout.panel)).toBe(true);
      }
    });

    rule('Export: card path, code path and privacy line stack inside the content area, footer in its track', () => {
      const L = profileExportLayout(wide);
      const M = PROFILE_EXPORT_MODAL;
      const label = theme.type.label;
      expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
      const items: [string, Rect][] = [
        ['card copy', box(L.x, L.cardCopyY, M.copyWrap, label)],
        ['card button', hitBox(L.x, L.cardButtonY, M.cardButtonMinWidth)],
        ['code field', box(L.x, L.inputY, M.input.width, M.input.height)],
        ['status', box(L.x, L.statusY, M.copyWrap, label)],
        ['privacy', box(L.x, L.privacyY, M.copyWrap, label)],
      ];
      for (const [what, r] of items) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
      expectStacked(items, PROFILE_GAPS.within);
      for (let include = M.includeMinWidth; include <= 260; include += 10) {
        for (let copy = M.copyMinWidth; copy <= 180; copy += 10) {
          expectFooterCluster(wide, [{ width: include }, { width: copy }], profileExportFooterXs(wide, include, copy));
        }
      }
    });

    rule('Import: field, status and preview stack inside the content area; Replace save keeps its destructive distance', () => {
      const L = profileImportLayout(wide);
      const M = PROFILE_IMPORT_MODAL;
      const preview: Rect = {
        x: L.previewX,
        y: L.previewTop,
        width: M.input.width,
        height: textBlockHeight(theme.type.caption, M.previewLines, M.previewLineSpacing),
      };
      const field = box(L.x, L.inputY, M.input.width, M.input.height);
      expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
      const items: [string, Rect][] = [
        ['code field', field],
        ['status', box(L.x, L.statusY, M.input.width, theme.type.label)],
        ['preview', preview],
      ];
      for (const [what, r] of items) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
      expectStacked(items, PROFILE_GAPS.within);
      expect(preview.x, 'the preview shares the field\'s left edge').toBe(field.x);
      for (const extra of [0, 20, 40]) {
        const widths = [M.previewMinWidth + extra, M.cardMinWidth + extra, M.replaceMinWidth + extra];
        expectFooterCluster(
          wide,
          [{ width: widths[0] }, { width: widths[1] }, { width: widths[2], destructive: true }],
          profileImportFooterXs(wide, widths[0], widths[1], widths[2]),
        );
      }
    });

    rule('Replace-save confirmation: the question sits inside its own panel, clear of the close button', () => {
      const L = profileConfirmLayout(confirm);
      const M = PROFILE_CONFIRM_MODAL;
      const message = box(L.messageX, L.messageY, M.messageWrap, textBlockHeight(theme.type.body, 2, M.messageLineSpacing));
      expect(isRectContained(message, confirm.contentBounds)).toBe(true);
      expect(isRectContained(message, confirm.panel)).toBe(true);
      expect(inactiveGap(message, confirm.closeTrack).gap).toBeGreaterThan(0);
      for (const extra of [0, 30, 60]) {
        const widths = [M.cancelMinWidth + extra, M.confirmMinWidth + extra];
        expectFooterCluster(
          confirm,
          [{ width: widths[0] }, { width: widths[1], destructive: true }],
          profileConfirmFooterXs(confirm, widths[0], widths[1]),
        );
      }
    });

    rule('save-card picker: the search\'s focus ring clears the cards, and the grid keeps touch isolation inside the content area', () => {
      const card = { width: 300, height: 420 }; // CardView's CARD_W x CARD_H
      const L = profilePickerLayout(wide, card);
      const p = PROFILE_SAVE_CARD_PICKER;
      expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
      const subtitle = box(L.x, L.subtitleY, 1, theme.type.label);
      const searchWithRing = box(L.x, L.searchY, p.searchWidth + 2 * p.searchRing, p.searchHeight + 2 * p.searchRing);
      const thumbs: [string, Rect][] = [];
      L.rowYs.forEach((y, r) => L.columnXs.forEach((x, c) => thumbs.push([`thumb ${r},${c}`, box(x, y, L.thumbWidth, L.thumbHeight)])));

      expect(subtitle.y).toBeGreaterThanOrEqual(L.titleY + theme.type.h1 / 2 + PROFILE_GAPS.datum);
      expect(searchWithRing.y - bottom(subtitle)).toBeGreaterThanOrEqual(0);
      expect(Math.min(...thumbs.map(([, r]) => r.y)) - bottom(searchWithRing)).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
      for (const [what, r] of thumbs) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
      expect(Math.max(...thumbs.map(([, r]) => bottom(r)))).toBeLessThanOrEqual(contentBottom(wide));
      expectPairwiseGap(thumbs, GAP_FLOORS.compactTouch);
      const gridLeft = Math.min(...thumbs.map(([, r]) => r.x));
      const gridRight = Math.max(...thumbs.map(([, r]) => right(r)));
      expect((gridLeft + gridRight) / 2).toBeCloseTo(L.x, 6);
      expect(L.thumbScale).toBeLessThanOrEqual(p.maxThumbScale);
      expect(L.emptyY).toBeGreaterThan(L.gridTop);
      expect(L.emptyY).toBeLessThan(L.gridBottom);
    });
  });

}

// ---------------------------------------------------------------------------
// layout.ts: the scene title and the shared header and footer
// ---------------------------------------------------------------------------

function sharedHeaderRules(): void {
  describe('the shared header: title, back control, gold badge and footer inside the frame', () => {
    const headerTrackBottom = theme.design.safeTop + theme.control.minHitHeight;

    it("keeps a menu title's line inside the header track, and the line under it below both", () => {
      const titleHeight = lineBox(SCENE_TITLE.fontSize, CINZEL_LINE);
      const top = SCENE_TITLE.y - titleHeight / 2;
      expect(top).toBeGreaterThanOrEqual(theme.design.safeTop);
      expect(top + titleHeight).toBeLessThanOrEqual(headerTrackBottom);
      expect(SCENE_TITLE.subtitleTop).toBeGreaterThanOrEqual(headerTrackBottom);
      expect(SCENE_TITLE.subtitleTop).toBeGreaterThanOrEqual(top + titleHeight);
    });

    /**
     * Widths are font-dependent, so every piece sweeps a plausible range: the
     * back label 40-140px, the gold badge 40-200px, and any title that fits
     * the track the layout leaves it. Heights are the cell's line boxes.
     */
    it('keeps the back control, title and gold badge in the header track, apart, and the footer buttons disjoint in theirs', () => {
      const backHeight = lineBox(theme.type.label, INTER_LINE);
      const titleHeight = lineBox(theme.type.h1, CINZEL_LINE);
      const badgeHeight = lineBox(theme.type.h2, INTER_LINE);
      const footer = [60, 120, 200].map((label) => {
        const { visual } = measureThemedButton(label, 'md');
        return { width: visual.width, height: visual.height };
      });
      for (let backWidth = 40; backWidth <= 140; backWidth += 20) {
        for (let badgeWidth = 40; badgeWidth <= 200; badgeWidth += 40) {
          const probe = sceneHeaderFooterLayout({
            backVisual: { width: backWidth, height: backHeight },
            titleVisual: { width: 0, height: titleHeight },
            currencyVisual: { width: badgeWidth, height: badgeHeight },
          });
          for (let titleWidth = 60; titleWidth <= probe.titleTrack.width; titleWidth += 40) {
            const at = `back ${backWidth}, badge ${badgeWidth}, title ${titleWidth}`;
            const layout = sceneHeaderFooterLayout({
              backVisual: { width: backWidth, height: backHeight },
              titleVisual: { width: titleWidth, height: titleHeight },
              currencyVisual: { width: badgeWidth, height: badgeHeight },
              footerActionVisuals: footer,
            });
            expect(layout.tracksInsideTitleSafe, at).toBe(true);
            for (const [what, r] of [['back', layout.back.hit], ['title', layout.title], ['badge', layout.currency]] as const) {
              expect(isRectContained(r, layout.headerTrack), `${at}: ${what}`).toBe(true);
            }
            expect(inactiveGap(layout.back.hit, layout.title).gap, at).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
            expect(inactiveGap(layout.title, layout.currency).gap, at).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
            const hits = layout.footerActions.map((action) => action.hit);
            for (const hit of hits) expect(isRectContained(hit, layout.footerTrack), at).toBe(true);
            for (let i = 1; i < hits.length; i++) {
              expect(inactiveGap(hits[i - 1], hits[i]).gap, at).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
            }
          }
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Settings: the frame rule (its gap and inset rules are swept in its own file)
// ---------------------------------------------------------------------------

function settingsFrameRules(): void {
  describe('Settings: the header, tab row and panels inside the title-safe frame', () => {
    it('shows the approved card-preview gesture in the touch caption', () => {
      expect(settingsTextSizeCaption(true)).toBe('Makes menus and help text larger. Hold a card to read it up close.');
      expect(settingsTextSizeCaption(false)).toContain('Hover over a card');
      const layout = layoutSettingsTab('accessibility', undefined, { textSize: { captionLines: 3 } });
      expect(layout.columns[0].layout.contentBottom).toBeLessThanOrEqual(SETTINGS_PANELS.bottom - 16);
    });

    it('keeps every panel, and the tab row and header controls above them, inside the frame', () => {
      const band = { y: SETTINGS_PANELS.top, height: SETTINGS_PANELS.bottom - SETTINGS_PANELS.top };
      for (const [name, frame] of Object.entries(SETTINGS_FRAMES)) {
        expect(isInsideTitleSafe({ x: frame.panelX, width: frame.panelWidth, ...band }), name).toBe(true);
      }
      expect(SETTINGS_TAB_ROW.top).toBeGreaterThanOrEqual(theme.design.safeTop);
      expect(SETTINGS_TAB_ROW.bottom).toBeLessThanOrEqual(SETTINGS_PANELS.top);
      const hitHalf = theme.control.minHitHeight / 2;
      expect(SETTINGS_HEADER_ACTION.y - hitHalf).toBeGreaterThanOrEqual(theme.design.safeTop);
      expect(SETTINGS_HEADER_ACTION.right).toBeLessThanOrEqual(theme.design.safeRight);
      // The header's action buttons are small controls: their label line fits the control height.
      expect(lineBox(controlFontSize('sm'), INTER_LINE)).toBeLessThanOrEqual(theme.control.heightSm);
    });
  });
}

function coreMenuRules(textScale: number): void {
  describe('complete menu identities and isolated selection cues', () => {
    it('preserves complete rival names and titles when a measured line is wider than its column', () => {
      for (const value of ['Bastet, Mistress of the Ninth Return', 'Anubis, Who Holds the Scale',
        'The Shepherdess of Giants', 'The Tyrant Queen', 'The Last Thing That Hunts']) {
        // Synthetic width scenarios exercise the presentation decision, not Windows font metrics.
        // The browser probe supplies real glyph bounds to the same content checker.
        for (const measuredWidth of [310, 420, 560]) {
          let wrapWidth = 0;
          const text: MenuNameText = {
            text: value,
            get width() { return wrapWidth || measuredWidth * this.text.length / value.length; },
            setText(next) { this.text = next; },
            setWordWrapWidth(width) { wrapWidth = width; },
            setData() {},
          };
          fitMenuName(text, 292);
          expect(text.text, value).toBe(value);
          expect(wrapWidth, value).toBeGreaterThan(0);
          expect(text.width).toBeLessThanOrEqual(292);
        }
      }
    });

    it('preserves the full enlarged Gauntlet name within its line allowance and keeps the remaining detail visible', () => {
      const value = 'Bastet, Mistress of the Ninth Return';
      // Conservative word-advance envelope at the 28px base heading size.
      // Calibrated to the approver's real-font break at both enlarged sizes:
      // Bastet, Mistress / of the Ninth / Return. These are bounds, not claimed font measurements.
      const advances: Record<string, number> = { 'Bastet,': 90, Mistress: 145, of: 24, the: 35, Ninth: 85, Return: 105 };
      const ratio = theme.type.h1 / 28;
      const width = gauntletPresentation().textWidth - (textScale > 1 ? 8 : 0);
      const lines: string[] = [];
      let lineWidth = 0;
      for (const word of value.split(' ')) {
        const advance = advances[word] * ratio;
        expect(advance).toBeLessThanOrEqual(width);
        const nextWidth = lineWidth + (lineWidth ? 9 * ratio : 0) + advance;
        if (!lines.length || nextWidth > width) { lines.push(word); lineWidth = advance; }
        else { lines[lines.length - 1] += ` ${word}`; lineWidth = nextWidth; }
      }
      expect(lines.length).toBe(textScale > 1 ? 3 : 2);
      const data = new Map<string, unknown>();
      const text: MenuNameText = { text: value, width,
        setText(next) { this.text = next; }, setWordWrapWidth() {},
        setData(key, next) { data.set(key, next); } };
      fitMenuName(text, width, gauntletNameLineLimit());
      const lineHeight = menuLineHeight(theme.type.label), linePitch = lineHeight + 4;
      const measured = { name: lines.length * menuLineHeight(theme.type.h1), title: 2 * menuLineHeight(theme.type.body),
        rung: menuLineHeight(theme.type.label), blurb: 12 * linePitch - 4,
        reward: menuLineHeight(theme.type.body), lineHeight, linePitch };
      const detail = gauntletDetailLayout(measured);
      expect(menuTextFindings({ expected: data.get('a11yFullText') as string, actual: text.text, lines,
        maxLines: data.get('a11yMaxLines') as number,
        bounds: { x: 0, y: 0, width, height: measured.name } })).toEqual([]);
      expect(detail.titleY - detail.nameY - measured.name).toBeGreaterThanOrEqual(12);
      expect(detail.blurb.y - detail.rungY - measured.rung).toBeGreaterThanOrEqual(12);
      expect(detail.blurb.height).toBeGreaterThanOrEqual(lineHeight);
      expect((detail.blurb.height + 4) % linePitch).toBe(0);
      expect(detail.rewardY - bottom(detail.blurb)).toBeGreaterThanOrEqual(12);
      expect(detail.rewardY + measured.reward).toBeLessThanOrEqual(gauntletPresentation().fightY - HIT / 2 - 12);
      fitMenuName(text, width); // The title's default contract must still reject a third line.
      expect(menuTextFindings({ expected: value, actual: value, lines: ['Bastet, Mistress', 'of the Ninth', 'Return'],
        maxLines: data.get('a11yMaxLines') as number, bounds: { x: 0, y: 0, width, height: measured.name } })).toContain('truncatedText');
    });

    it('reserves the complete two-line Practice caption inside the tile', () => {
      const captionHeight = 2 * menuLineHeight(theme.type.caption);
      const l = practicePickerLayout(captionHeight);
      expect(l.nameBand).toBeGreaterThanOrEqual(captionHeight + 8);
      expect(l.portraitHeight + l.nameBand + 10).toBeLessThanOrEqual(l.rowHeight);
    });

    it('keeps reward outside the blurb mask above Fight and leaves only whole resting lines', () => {
      const p = gauntletPresentation();
      const lineHeight = menuLineHeight(theme.type.label), linePitch = lineHeight + 4;
      for (const nameLines of [1, 2]) for (const titleLines of [1, 2]) for (const rungLines of [1, 2]) for (const blurbLines of [1, 6, 12]) {
        const reward = 2 * menuLineHeight(theme.type.body);
        const m = { name: nameLines * menuLineHeight(theme.type.h1), title: titleLines * menuLineHeight(theme.type.body),
          rung: rungLines * menuLineHeight(theme.type.label), blurb: blurbLines * linePitch - 4, reward, lineHeight, linePitch };
        const l = gauntletDetailLayout(m);
        expect(l.titleY - l.nameY - m.name).toBeGreaterThanOrEqual(12);
        expect(l.rungY - l.titleY - m.title).toBeGreaterThanOrEqual(12);
        expect(l.blurb.y - l.rungY - m.rung).toBeGreaterThanOrEqual(12);
        expect(l.blurb.height).toBeGreaterThanOrEqual(lineHeight);
        expect(l.rewardY - bottom(l.blurb)).toBeGreaterThanOrEqual(12);
        expect(l.rewardY + reward).toBeLessThanOrEqual(p.fightY - HIT / 2 - 12);
        expect((l.blurb.height + 4) / linePitch).toBeCloseTo(Math.round((l.blurb.height + 4) / linePitch));
      }
    });

    it('keeps the row and tile selection marks clear of borders and text', () => {
      for (const [visual, border, textInset] of [
        [{ x: 0, y: 0, width: 772, height: 68 }, theme.control.borderWidth, 8],
        [{ x: 0, y: 0, width: 206, height: 191 }, theme.outline.state, 9],
      ] as const) {
        const mark = menuSelectionMark({ visual, labelWidth: 160, padding: 16 }, border);
        expect(bottom(visual) - bottom(mark)).toBeGreaterThanOrEqual(border / 2 + 2);
        expect(mark.y - (bottom(visual) - textInset)).toBeGreaterThanOrEqual(1.5);
      }
    });

    it('preserves a fitting standard-size caption band and rests scrolling blurbs on whole lines', () => {
      const base = practicePickerLayout();
      for (const height of [4, 8, 12]) expect(practicePickerLayout(height).nameBand).toBe(base.nameBand);
      for (const pitch of [20, 24, 28]) for (let requested = 0; requested <= 12 * pitch; requested += 7) {
        const offset = menuScrollOffset(requested, 10 * pitch, pitch);
        expect(offset % pitch).toBe(0);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(10 * pitch);
      }
    });

    it('reports removed characters, capped lines and masked glyphs instead of accepting their visible fragment', () => {
      const expected = 'Bastet, Mistress of the Ninth Return';
      const bounds = { x: 0, y: 0, width: 280, height: 44 };
      const base = { expected, actual: expected, lines: ['Bastet, Mistress of', 'the Ninth Return'], bounds, box: bounds, maxLines: 2 };
      expect(menuTextFindings(base)).toEqual([]);
      expect(menuTextFindings({ ...base, actual: 'Bastet, Mistress...' })).toContain('truncatedText');
      expect(menuTextFindings({ ...base, drawnLines: 1 })).toContain('truncatedText');
      expect(menuTextFindings({ ...base, lines: ['Bastet, Mistress', 'of the Ninth', 'Return'] })).toContain('truncatedText');
      expect(menuTextFindings({ ...base, bounds: { ...bounds, width: 290 } })).toContain('clippedText');
      expect(menuTextFindings({ ...base, clip: { ...bounds, height: 32 }, lineHeight: 20, linePitch: 24 })).toContain('clippedText');
      expect(menuTextFindings({ ...base, clip: { ...bounds, height: 20 }, lineHeight: 20, linePitch: 24 })).toEqual([]);
    });
  });

  describe('Main menu: measured chrome and content-sized notices', () => {
    it('anchors measured corner controls to the frame, clear of one another and the menu', () => {
      for (const width of [150, 180, 240, 280]) {
        const l = mainMenuCornerLayout([width, width - 20, width - 40], width);
        const controls: [string, Rect][] = [0, 1, 2].map((i) => [`corner ${i}`, hitBox(l.leftX, mainMenuCornerY(i), l.leftWidth)]);
        controls.push(['settings', hitBox(l.rightX, mainMenuCornerY(1), width)]);
        MAIN_MENU_ITEMS.forEach((_, i) => controls.push([`menu ${i}`, hitBox(MAIN_MENU_X, mainMenuButtonY(i), 300)]));
        for (const [name, rect] of controls) expect(isInsideTitleSafe(rect), name).toBe(true);
        expectPairwiseGap(controls, GAP_FLOORS.ordinary);
      }
    });

    it('keeps daily rows disjoint and uses a bounded scroll viewport when copy grows', () => {
      for (const lines of [1, 2, 4]) {
        const row = { title: menuLineHeight(theme.type.label), description: lines * menuLineHeight(theme.type.caption),
          progress: menuLineHeight(theme.type.caption), action: HIT };
        const l = mainMenuDailyLayout(menuLineHeight(theme.type.h1), menuLineHeight(theme.type.label), [row, row, row]);
        expect(isInsideTitleSafe(l.panel)).toBe(true);
        expect(isRectContained(l.viewport, l.panel)).toBe(true);
        expect(bottom(l.viewport)).toBeLessThanOrEqual(bottom(l.panel) - 16);
        l.rows.forEach((at, i) => {
          expect(at.descriptionY - at.titleY - row.title).toBeGreaterThanOrEqual(4);
          expect(at.progressY - at.descriptionY - row.description).toBeGreaterThanOrEqual(8);
          expect(at.progressY + row.progress).toBeLessThanOrEqual(at.y + at.height - 8);
          expect(at.height).toBeGreaterThanOrEqual(HIT + 16);
          if (i) expect(at.y - l.rows[i - 1].y - l.rows[i - 1].height).toBeGreaterThanOrEqual(12);
        });
        expect(l.viewport.height + l.maxScroll).toBeGreaterThanOrEqual(l.contentHeight);
        expect(l.rows.at(-1)!.y + l.rows.at(-1)!.height - l.maxScroll).toBeLessThanOrEqual(l.viewport.height);
      }
    });

    it('sizes tutorial and repair notices from the body while reserving separate title, close and footer tracks', () => {
      for (const width of [760, 840]) for (const lines of [1, 3, 6, 10]) {
        const bodyHeight = lines * menuLineHeight(theme.type.body);
        const l = menuNoticeLayout(width, menuLineHeight(theme.type.display), bodyHeight);
        expect(isInsideTitleSafe(l.tracks.panel)).toBe(true);
        expect(l.tracks.contentBounds.height).toBeGreaterThanOrEqual(bodyHeight);
        expect(l.tracks.tracksInsidePanel).toBe(true);
        expectPairwiseGap([['title', l.tracks.titleTrack], ['close', l.tracks.closeTrack],
          ['body', l.tracks.contentBounds], ['footer', l.tracks.footerTrack]], GAP_FLOORS.ordinary);
      }
    });
  });

  describe('Play: deck plate and paged deck selection', () => {
    it('isolates mode actions, launch feedback and the active deck above the frame bottom', () => {
      const l = playMenuLayout();
      const actions = l.actionYs.map((y, i): [string, Rect] => [`mode ${i}`, hitBox(640, y, 300)]);
      for (const [, rect] of actions) expect(isInsideTitleSafe(rect)).toBe(true);
      expect(isInsideTitleSafe(l.plate)).toBe(true);
      expect(isInsideTitleSafe(l.notice)).toBe(true);
      expectPairwiseGap([...actions, ['notice', l.notice], ['plate', l.plate]], GAP_FLOORS.ordinary);
      const stacked = playTextStack([menuLineHeight(theme.type.micro), menuLineHeight(theme.type.h2), 3 * menuLineHeight(theme.type.caption)], 0, 8);
      expect(stacked.bottom).toBeLessThanOrEqual(l.plate.height - 16);
      expect(l.plate.height).toBeGreaterThanOrEqual(2 * HIT + 12 + 16);
    });

    it('keeps deck names and metadata clear of measured counts and the widest status label', () => {
      for (const stateWidth of [30, 100, 160]) for (const countWidth of [24, 48, 80]) {
        const row = { x: 254, width: 772 };
        const l = playDeckRowColumns(row, stateWidth, countWidth, 252);
        expect(l.nameWidth).toBeGreaterThan(0);
        expect(l.nameX).toBeGreaterThanOrEqual(row.x + 16);
        expect(l.nameX + l.nameWidth).toBeLessThanOrEqual(l.countLeft - 12);
        expect(l.countRight).toBeLessThanOrEqual(l.stateRight - stateWidth - 12);
        expect(l.stateRight).toBeLessThanOrEqual(row.x + row.width - 16);
      }
    });

    it('pages growing deck rows inside a content-sized shell with independent pager and footer tracks', () => {
      for (const count of [0, 1, 7, 28, 1000]) for (const lines of [1, 2]) {
        const name = menuLineHeight(theme.type.label), badge = lines * menuLineHeight(theme.type.micro);
        const l = playDeckPickerLayout(count, name, badge);
        expect(isInsideTitleSafe(l.tracks.panel)).toBe(true);
        expect(l.rowHeight).toBeGreaterThanOrEqual(name + badge + 4 + 16);
        const rows = l.rowYs.map((y, i): [string, Rect] => [`deck ${i}`, box(l.tracks.contentBounds.x + l.tracks.contentBounds.width / 2, y, l.tracks.contentBounds.width, l.rowHeight)]);
        for (const [, row] of rows) expect(isRectContained(row, l.tracks.contentBounds)).toBe(true);
        expectPairwiseGap(rows, GAP_FLOORS.ordinary);
        if (count > l.pageSize) {
          const pager = hitBox(640, l.pagerY, 180);
          expect(isRectContained(pager, l.tracks.contentBounds)).toBe(true);
          expectPairwiseGap([...rows, ['pager', pager]], GAP_FLOORS.ordinary);
        }
        expect(l.tracks.footerTrack.y - bottom(l.tracks.contentBounds)).toBeGreaterThanOrEqual(16);
      }
    });
  });

  describe('Practice: portrait, name and action tracks', () => {
    it('reserves a readable name band without shrinking, and isolates both portrait rows and the action footer', () => {
      const l = practicePickerLayout();
      expect(isInsideTitleSafe(l.viewport)).toBe(true);
      const tiles: [string, Rect][] = [];
      for (let i = 0; i < l.rows; i++) {
        const top = l.columnTop + i * (l.rowHeight + l.rowGap);
        const tile = { x: l.viewport.x, y: top, width: 206, height: l.rowHeight };
        tiles.push([`tile ${i}`, tile]);
        expect(isRectContained(tile, l.viewport)).toBe(true);
        expect(l.portraitHeight + l.nameBand + 10).toBeLessThanOrEqual(l.rowHeight);
        expect(l.nameBand).toBeGreaterThanOrEqual(menuLineHeight(theme.type.caption) + 8);
      }
      expectPairwiseGap(tiles, GAP_FLOORS.ordinary);
      const selection = box(640, l.selectionY, 700, menuLineHeight(theme.type.h2));
      const controls = [476, 640, 804].map((x, i): [string, Rect] => [`difficulty ${i}`, hitBox(x, l.difficultyY, 148)]);
      controls.push(['selection', selection], ['notice', hitBox(640, l.noticeY, 900)]);
      for (const [, rect] of controls) expect(isInsideTitleSafe(rect)).toBe(true);
      expect(selection.y - bottom(l.viewport)).toBeGreaterThanOrEqual(8);
      expectPairwiseGap(controls, GAP_FLOORS.ordinary);
    });
  });

  describe('Gauntlet: the scrolling rail and detail column', () => {
    it('keeps all 28 rungs readable, reserves measured stars and can expose either end of the rail', () => {
      const p = gauntletPresentation();
      expect(isInsideTitleSafe(p.tower)).toBe(true);
      for (const stars of [36, 48, 64, 96]) {
        const l = gauntletTowerLayout(28, p.tower, { starColumnWidth: stars });
        expect(l.rowHeight).toBeGreaterThanOrEqual(menuLineHeight(theme.type.body) + 16);
        expect(l.rowPitch - l.rowHeight).toBeGreaterThanOrEqual(8);
        expect(l.starRightX - stars - l.labelX - l.labelWidth).toBeGreaterThanOrEqual(8);
        expect(l.labelWidth).toBeGreaterThan(0);
        expect(isInsideTitleSafe(l.scrollbar)).toBe(true);
        for (let rung = 1; rung <= 28; rung++) {
          const scroll = gauntletScrollToRung(rung, 28, l);
          const y = (28 - rung) * l.rowPitch - scroll;
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y + l.rowHeight).toBeLessThanOrEqual(l.viewport.height);
        }
      }
    });

    it('separates the scrolling detail from Fight, Abandon and the warning at the largest content budget', () => {
      const l = gauntletPresentation();
      const fight = hitBox(l.textX + 104, l.fightY, 208);
      const abandon = hitBox(l.textX + 150, l.abandonY, 300);
      const warning = { x: l.textX, y: l.warningY, width: l.textWidth, height: 2 * menuLineHeight(theme.type.caption) };
      for (const rect of [l.detailViewport, fight, abandon, warning]) expect(isInsideTitleSafe(rect)).toBe(true);
      expect(fight.y - bottom(l.detailViewport)).toBeGreaterThanOrEqual(12);
      expect(abandon.y - bottom(fight)).toBeGreaterThanOrEqual(24);
      expect(warning.y - bottom(abandon)).toBeGreaterThanOrEqual(8);
      expect(bottom(warning)).toBeLessThanOrEqual(theme.design.footerCenterY - HIT / 2 - 8);
      const stack = playTextStack([menuLineHeight(theme.type.h1), 3 * menuLineHeight(theme.type.body), menuLineHeight(theme.type.label),
        12 * menuLineHeight(theme.type.label), 3 * menuLineHeight(theme.type.body)]);
      expectStacked(stack.ys.map((y, i) => [`text ${i}`, { x: 0, y, width: l.textWidth,
        height: [menuLineHeight(theme.type.h1), 3 * menuLineHeight(theme.type.body), menuLineHeight(theme.type.label),
          12 * menuLineHeight(theme.type.label), 3 * menuLineHeight(theme.type.body)][i] }]), 12);
    });
  });
}

// ---------------------------------------------------------------------------
// Every cell
// ---------------------------------------------------------------------------

// The six cells. Geometry reads the text size; contrast must not move anything, and runs here to prove it.
for (const cell of A11Y_CELLS) {
  describe(`the fixture matrix: ${cell.name}`, () => {
    beforeEach(() => {
      setAccessibility({ textScale: cell.textScale, highContrast: cell.highContrast });
    });
    afterEach(() => {
      setAccessibility({ textScale: 1, highContrast: false });
    });
    sharedHeaderRules();
    settingsFrameRules();
    coreMenuRules(cell.textScale);
    profileLayoutRules();
  });
}

describe('the matrix itself', () => {
  afterEach(() => {
    setAccessibility({ textScale: 1, highContrast: false });
  });

  it('high contrast moves nothing: every enrolled layout is the same in both contrasts at each text size', () => {
    const geometry = (): string =>
      JSON.stringify({
        title: [SCENE_TITLE.fontSize, SCENE_TITLE.subtitleTop],
        settings: [SETTINGS_PANELS, SETTINGS_FRAMES, SETTINGS_TAB_ROW, settingsRhythm(), layoutSettingsTab('game'), layoutSettingsTab('accessibility')],
        mainMenu: [mainMenuCornerLayout([180, 220], 180), mainMenuDailyLayout(menuLineHeight(theme.type.h1), menuLineHeight(theme.type.label), [{ title: menuLineHeight(theme.type.label), description: menuLineHeight(theme.type.caption), progress: menuLineHeight(theme.type.caption), action: HIT }])],
        play: [playMenuLayout(), playDeckPickerLayout(28), practicePickerLayout(), gauntletPresentation(), gauntletTowerLayout(28, gauntletPresentation().tower)],
        profile: [PROFILE_HEADER, PROFILE_RECORD, PROFILE_SHOWCASE, PROFILE_PANELS, PROFILE_REPLAYS, PROFILE_REPLAY_ROW, profileReplayCell(9)],
      });
    const bySize: string[] = [];
    for (const textScale of TEXT_SCALES) {
      setAccessibility({ textScale, highContrast: false });
      const standard = geometry();
      setAccessibility({ textScale, highContrast: true });
      expect(geometry(), `${textScale}`).toBe(standard);
      bySize.push(standard);
    }
    // The snapshot is live: text size does move it.
    expect(new Set(bySize).size).toBe(TEXT_SCALES.length);
  });

  it('names a home for every rule of every enrolled module, and each home still exists', () => {
    const self = readFileSync(new URL(import.meta.url), 'utf8');
    for (const entry of ENROLLED) {
      expect(Object.keys(entry.rules).length, entry.module).toBeGreaterThan(0);
      for (const [rule, home] of Object.entries(entry.rules)) {
        if ('here' in home) {
          expect(self.includes(`describe('${home.here}'`), `${entry.module} ${rule}: describe "${home.here}" in this file`).toBe(true);
          continue;
        }
        const source = readFileSync(new URL(`../../${home.file}`, import.meta.url), 'utf8');
        expect(source.includes("from './a11yCells'"), `${home.file} iterates the shared cells`).toBe(true);
        for (const title of home.tests) expect(source.includes(title), `${entry.module} ${rule}: "${title}" in ${home.file}`).toBe(true);
      }
    }
  });

});
