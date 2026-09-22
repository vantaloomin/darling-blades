/**
 * The "What is sent" panel: every field the anonymous play stats carry, in the
 * allowlist's own order, read straight off `SIGNAL_FIELDS` (rollout wave T2).
 *
 * The panel does not keep its own list of fields. It walks the allowlist and
 * looks each name up in the description maps, so a field added to the code
 * without a line of copy is a compile error, and a line of copy for a field
 * that is no longer sent fails the test. That is the whole point of the
 * surface: the privacy policy says "The Privacy panel in Settings shows this
 * same list", and this is what makes that true by construction.
 *
 * Every string comes from `statsPrivacyPresentation.ts`. Nothing is authored
 * here.
 */

import Phaser from 'phaser';
import { SIGNAL_FIELDS } from '../meta/playSignals';
import { scrollOffsetByDelta } from './layout';
import type { ModalGuard } from './Modal';
import { openExternalPage } from './openExternalPage';
import {
  STATS_CARDS_EXTRA_LINE,
  STATS_CARDS_FIELD_LINES,
  STATS_DUEL_FIELD_LINES,
  STATS_HEARTBEAT_FIELD_LINES,
  STATS_NEVER_SENT_BODY,
  STATS_NEVER_SENT_TITLE,
  STATS_PANEL_FOOTER,
  STATS_PANEL_HEADINGS,
  STATS_PANEL_INTRO,
  STATS_PANEL_LAYOUT,
  STATS_PANEL_TITLE,
  STATS_PRIVACY_LINK_HREF,
  STATS_PRIVACY_LINK_LABEL,
  statsPanelColumns,
  statsPanelMaxScroll,
} from './statsPrivacyPresentation';
import { colorInt, theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

interface StatsPanelColumn {
  heading: string;
  /** The allowlist itself, which is what fixes the order. */
  fields: readonly string[];
  lines: Record<string, string>;
  /** An extra line under this column's fields, where the copy has one. */
  extra?: string;
}

/** The three columns, each the allowlist for one event plus its heading. */
const COLUMNS: readonly StatsPanelColumn[] = [
  { heading: STATS_PANEL_HEADINGS.heartbeat, fields: SIGNAL_FIELDS.heartbeat, lines: STATS_HEARTBEAT_FIELD_LINES },
  { heading: STATS_PANEL_HEADINGS.duel, fields: SIGNAL_FIELDS.duel, lines: STATS_DUEL_FIELD_LINES },
  {
    heading: STATS_PANEL_HEADINGS.cards,
    fields: SIGNAL_FIELDS.cards,
    lines: STATS_CARDS_FIELD_LINES,
    extra: STATS_CARDS_EXTRA_LINE,
  },
];

/**
 * Build the panel. The caller owns the guard and the list of controls beneath
 * it; closing the shell releases both.
 */
export function createStatsPrivacyPanel(
  scene: Phaser.Scene,
  guard: ModalGuard,
  guardTargets: readonly Phaser.GameObjects.GameObject[],
): ModalShell {
  const shell = modalShell(scene, {
    width: STATS_PANEL_LAYOUT.width,
    height: STATS_PANEL_LAYOUT.height,
    dismissal: 'dismissible',
    dimAlpha: 0.62,
    onClose: () => guard.close(),
  });
  guard.open(guardTargets);

  const container = shell.container;
  // An opaque backing between the dim and the shell's chrome. The shared panel
  // fill is 0.9 and this panel dims lightly (0.62), so it opens over bright
  // text in both of its homes (the first-run notice and Settings) and 4% of
  // that text ghosted through a page the player is meant to read closely.
  container.addAt(
    scene.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRoundedRect(
        theme.design.centerX - STATS_PANEL_LAYOUT.width / 2,
        theme.design.centerY - STATS_PANEL_LAYOUT.height / 2,
        STATS_PANEL_LAYOUT.width,
        STATS_PANEL_LAYOUT.height,
        theme.radius.panel,
      ),
    1,
  );
  const content = shell.tracks.contentBounds;
  const titleTrack = shell.tracks.titleTrack;
  container.add(
    scene.add
      .text(titleTrack.x, titleTrack.y + titleTrack.height / 2, STATS_PANEL_TITLE, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5),
  );

  // Everything that scrolls lives in one container whose origin is the content
  // rect's top-left, so every number below is a local offset.
  const body = scene.add.container(content.x, content.y);
  const bullets = scene.add.graphics();
  bullets.fillStyle(colorInt(theme.colors.gold), 0.9);
  body.add(bullets);

  const addText = (
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text => {
    const object = scene.add.text(x, y, text, style).setOrigin(0, 0);
    body.add(object);
    return object;
  };

  const intro = addText(0, 0, STATS_PANEL_INTRO, {
    fontFamily: theme.fonts.ui,
    fontSize: `${theme.type.body}px`,
    color: theme.colors.body,
    wordWrap: { width: content.width },
    lineSpacing: 3,
  });

  const columns = statsPanelColumns(content.width);
  const columnTop = intro.height + STATS_PANEL_LAYOUT.blockGap;
  const lineWrap = Math.max(0, columns.width - STATS_PANEL_LAYOUT.textIndent);
  let columnsBottom = columnTop;
  /** Where the shortest column ended, so the closing block can follow it. */
  let lastColumnBottom = columnTop;

  COLUMNS.forEach((column, index) => {
    const x = columns.offsets[index];
    let y = columnTop;
    const heading = addText(x, y, column.heading, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.gold,
      wordWrap: { width: columns.width },
    });
    y += heading.height + STATS_PANEL_LAYOUT.headingGap;
    for (const field of column.fields) {
      // The allowlist drives the order; the map only supplies the wording.
      const text = addText(x + STATS_PANEL_LAYOUT.textIndent, y, column.lines[field], {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        wordWrap: { width: lineWrap },
        lineSpacing: 2,
      });
      bullets.fillCircle(
        x + STATS_PANEL_LAYOUT.bulletX,
        y + Math.min(text.height, 18) / 2,
        STATS_PANEL_LAYOUT.bulletRadius,
      );
      y += text.height + STATS_PANEL_LAYOUT.rowGap;
    }
    if (column.extra !== undefined) {
      const extra = addText(x, y + STATS_PANEL_LAYOUT.rowGap, column.extra, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        wordWrap: { width: columns.width },
        lineSpacing: 2,
      });
      y += STATS_PANEL_LAYOUT.rowGap + extra.height;
    }
    columnsBottom = Math.max(columnsBottom, y);
    lastColumnBottom = y;
  });

  // The closing block follows the last (and shortest) column rather than
  // running the full width under all three, which is what keeps the whole
  // disclosure on one screen instead of behind a scrollbar.
  const closingX = columns.offsets[columns.offsets.length - 1];
  let cursor = lastColumnBottom + STATS_PANEL_LAYOUT.blockGap;
  const neverTitle = addText(closingX, cursor, STATS_NEVER_SENT_TITLE, {
    fontFamily: theme.fonts.ui,
    fontSize: `${theme.type.label}px`,
    fontStyle: theme.weight.w700,
    color: theme.colors.gold,
  });
  cursor += neverTitle.height + STATS_PANEL_LAYOUT.headingGap;
  const neverBody = addText(closingX, cursor, STATS_NEVER_SENT_BODY, {
    fontFamily: theme.fonts.ui,
    fontSize: `${theme.type.caption}px`,
    color: theme.colors.body,
    wordWrap: { width: columns.width },
    lineSpacing: 2,
  });
  const contentHeight = Math.max(columnsBottom, cursor + neverBody.height);
  container.add(body);

  // Overflow: mask the content rect and scroll, the way the keyword glossary
  // panel does. Nothing shrinks; the type scale's caption size is the floor.
  const maxScroll = statsPanelMaxScroll(contentHeight, content.height);
  if (maxScroll > 0) {
    const mask = scene.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRect(content.x, content.y, content.width, content.height)
      .setVisible(false);
    body.setMask(mask.createGeometryMask());
    container.add(mask);

    const rail = scene.add.graphics();
    const thumb = scene.add.graphics();
    const railX = content.x + content.width + theme.space(2);
    let offset = 0;
    const redraw = (): void => {
      const thumbHeight = Math.max(
        theme.space(6),
        content.height * (content.height / Math.max(content.height, contentHeight)),
      );
      const travel = Math.max(0, content.height - thumbHeight);
      rail
        .clear()
        .fillStyle(theme.graphics.panelStroke, theme.alpha.subtle)
        .fillRoundedRect(railX, content.y, theme.space(0.5), content.height, theme.radius.control);
      thumb
        .clear()
        .fillStyle(theme.graphics.rowFillActive, theme.alpha.chrome)
        .fillRoundedRect(
          railX - theme.space(0.5),
          content.y + (offset / maxScroll) * travel,
          theme.space(1.5),
          thumbHeight,
          theme.radius.control,
        );
    };
    const setScroll = (next: number): void => {
      offset = scrollOffsetByDelta(0, next, maxScroll);
      body.setPosition(content.x, content.y - offset);
      redraw();
    };

    // A Zone, never the container: a scaled container does not scale its hit
    // area (playbook trap #1), and this one is inside a modal that may move.
    const zone = scene.add
      .zone(content.x + content.width / 2, content.y + content.height / 2, content.width, content.height)
      .setInteractive();
    let dragging = false;
    let dragPointerId: number | null = null;
    let dragStartY = 0;
    let dragStartOffset = 0;
    const moveDrag = (pointer: Phaser.Input.Pointer): void => {
      if (!dragging || dragPointerId !== pointer.id) return;
      setScroll(dragStartOffset - (pointer.worldY - dragStartY));
    };
    const endDrag = (pointer: Phaser.Input.Pointer): void => {
      if (dragPointerId === pointer.id) {
        dragging = false;
        dragPointerId = null;
      }
    };
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      dragPointerId = pointer.id;
      dragStartY = pointer.worldY;
      dragStartOffset = offset;
    });
    zone.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
      setScroll(offset + (deltaY === 0 ? 0 : Math.sign(deltaY) * Math.max(Math.abs(deltaY), STATS_PANEL_LAYOUT.scrollStep)));
    });
    scene.input.on('pointermove', moveDrag);
    scene.input.on('pointerup', endDrag);
    container.once('destroy', () => {
      scene.input.off('pointermove', moveDrag);
      scene.input.off('pointerup', endDrag);
    });
    container.add([rail, thumb, zone]);
    shell.interactiveChildren.push(zone);
    redraw();
  }

  // The footer track: the link, and the one line that must stay readable even
  // while the list above it scrolls, because it is the instruction for acting
  // on any of this.
  const footerTrack = shell.tracks.footerTrack;
  const linkWidth = STATS_PANEL_LAYOUT.footerLinkWidth;
  const link = themedButton(
    scene,
    footerTrack.x + linkWidth / 2,
    footerTrack.y + footerTrack.height / 2,
    STATS_PRIVACY_LINK_LABEL,
    { variant: 'ghost', minWidth: linkWidth, onTap: () => openExternalPage(STATS_PRIVACY_LINK_HREF) },
  );
  container.add(link.container);
  shell.interactiveChildren.push(link.inputZone);
  container.add(
    scene.add
      .text(
        footerTrack.x + linkWidth + theme.space(4),
        footerTrack.y + footerTrack.height / 2,
        STATS_PANEL_FOOTER,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
          wordWrap: { width: Math.max(0, footerTrack.width - linkWidth - theme.space(4)) },
          lineSpacing: 2,
        },
      )
      .setOrigin(0, 0.5),
  );
  return shell;
}
