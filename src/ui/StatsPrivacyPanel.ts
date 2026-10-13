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
import { COMPACT } from './compactLayout';
import { compactButton, COMPACT_DRAG_SLOP } from './compactWidgets';
import { themedButtonColors } from './controlStyle';
import { bindMenuScroll } from './menuScroll';
import type { ModalGuard } from './Modal';
import { sceneStage } from './SceneBackdrop';
import { settingsActiveSection } from './settingsCompact';
import { bindTapButton } from '../platform/gestures';
import { bakeUiIcon } from './uiIcons';
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
import { modalShell, panel, themedButton, type ModalShell } from './themeWidgets';

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
  if (sceneStage(scene).compact) return createCompactStatsPrivacyPanel(scene, guard, guardTargets);
  // Opaque chrome: the shared panel fill is 0.9 and this panel dims lightly
  // (0.62), so it opens over bright text in both of its homes (the first-run
  // notice and Settings) and 4% of that text ghosted through a page the player
  // is meant to read closely.
  const shell = modalShell(scene, {
    width: STATS_PANEL_LAYOUT.width,
    height: STATS_PANEL_LAYOUT.height,
    dismissal: 'dismissible',
    dimAlpha: 0.62,
    opaque: true,
    onClose: () => guard.close(),
  });
  guard.open(guardTargets);

  const container = shell.container;
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
  body.add(bullets);
  /** Every text in the scrolling body, and its bullet when it is a field line. */
  const entries: { text: Phaser.GameObjects.Text; bullet: { x: number; y: number } | null }[] = [];

  const addText = (
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text => {
    const object = scene.add.text(x, y, text, style).setOrigin(0, 0);
    body.add(object);
    entries.push({ text: object, bullet: null });
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
      // The release 18px first-line band, grown with the caption role.
      entries[entries.length - 1].bullet = {
        x: x + STATS_PANEL_LAYOUT.bulletX,
        y: y + Math.min(text.height, (18 * theme.type.caption) / theme.typeBase.caption) / 2,
      };
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

  /**
   * Show only the entries wholly inside the viewport at `offset`, so a
   * scrolled list never shows a line cut through by the mask's edge (the
   * columns share no line grid, so no single step could snap all three).
   * Each shown entry declares that it must stay whole inside the mask.
   */
  const showWholeEntries = (offset: number): void => {
    bullets.clear().fillStyle(colorInt(theme.colors.gold), 0.9);
    for (const entry of entries) {
      const top = entry.text.y - offset;
      const whole = top >= -0.5 && top + entry.text.height <= content.height + 0.5;
      entry.text.setVisible(whole).setData('a11yKeepVisible', whole);
      if (whole && entry.bullet) bullets.fillCircle(entry.bullet.x, entry.bullet.y, STATS_PANEL_LAYOUT.bulletRadius);
    }
  };
  showWholeEntries(0);

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
        // A muted thumb on the stroke-tinted rail: rowFillActive barely
        // separated from the panel, so where the list stood was hard to read.
        .fillStyle(colorInt(theme.colors.muted), theme.alpha.chrome)
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
      showWholeEntries(offset);
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

/**
 * The phone's "What is sent" (mock M-WhatIsSent): the whole disclosure in one
 * scrolling column at the left, a jump list of its parts at the right with the
 * standing instruction under it, and the privacy policy at the column's foot.
 * The same allowlist walk as the desktop panel, so the two can never differ.
 */
function createCompactStatsPrivacyPanel(
  scene: Phaser.Scene,
  guard: ModalGuard,
  guardTargets: readonly Phaser.GameObjects.GameObject[],
): ModalShell {
  const type = theme.compactType;
  const content = sceneStage(scene).content;
  const columnW = Math.min(COMPACT.columnW, content.width / 2);
  const left = { x: content.x, y: content.y, width: content.width - columnW - COMPACT.gap, height: content.height };
  const column = { x: content.x + content.width - columnW, y: content.y, width: columnW, height: content.height };
  const shell = modalShell(scene, {
    width: left.width,
    height: left.height,
    x: left.x + left.width / 2,
    y: left.y + left.height / 2,
    dismissal: 'dismissible',
    dimAlpha: 0.62,
    onClose: () => guard.close(),
  });
  guard.open(guardTargets);
  const container = shell.container;
  const titleTrack = shell.tracks.titleTrack;
  container.add(scene.add.text(titleTrack.x, titleTrack.y + titleTrack.height / 2, STATS_PANEL_TITLE, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    wordWrap: { width: titleTrack.width },
  }).setOrigin(0, 0.5));

  // The column: the jump list on its own plate, the link under it.
  const linkRect = { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const plate = { x: column.x, y: column.y, width: column.width, height: linkRect.y - COMPACT.gap - column.y };
  container.add(panel(scene, plate.x, plate.y, plate.width, plate.height, { alpha: 1 }));
  const inset = theme.space(2);
  const navW = plate.width - inset * 2;
  const headings = [STATS_PANEL_HEADINGS.heartbeat, STATS_PANEL_HEADINGS.duel, STATS_PANEL_HEADINGS.cards, STATS_NEVER_SENT_TITLE];
  const chevron = Math.round(type.body * 1.1);
  const navs = headings.map((heading) => {
    const text = scene.add.text(0, 0, heading, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
      wordWrap: { width: navW - 12 - chevron - 16 },
    });
    return { text, height: Math.max(COMPACT.touch, text.height + 16) };
  });
  const navGap = COMPACT.gap;
  const navBottom = plate.y + inset + navs.reduce((sum, n) => sum + n.height, 0) + navGap * (navs.length - 1);
  const footer = scene.add.text(plate.x + inset + 4, navBottom + theme.space(3), STATS_PANEL_FOOTER, {
    fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: navW - 8 }, lineSpacing: 3,
  });
  // Where the column cannot hold the instruction, it closes the scrolling text instead.
  const footerInColumn = footer.y + footer.height <= plate.y + plate.height - inset;
  if (footerInColumn) container.add(footer);
  else footer.destroy();

  // The scrolling text.
  const body = shell.tracks.contentBounds;
  const view = { x: body.x, y: body.y, width: body.width - theme.space(3), height: left.y + left.height - theme.space(5) - body.y };
  const list = scene.add.container(0, view.y);
  container.add(list);
  const bullets = scene.add.graphics();
  list.add(bullets);
  const textStyle = (size: number, color: string, width: number): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width }, lineSpacing: 3,
  });
  let y = 0;
  const add = (x: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle, gapAfter: number): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, text, style);
    list.add(t);
    y += t.height + gapAfter;
    return t;
  };
  const indent = 24;
  add(view.x, STATS_PANEL_INTRO, textStyle(type.body, theme.colors.body, view.width), theme.space(4));
  const tops: number[] = [];
  const headingStyle = { ...textStyle(type.body, theme.colors.gold, view.width), fontStyle: theme.weight.w700 };
  for (const part of COLUMNS) {
    tops.push(y);
    add(view.x, part.heading, headingStyle, theme.space(2));
    for (const field of part.fields) {
      const line = add(view.x + indent, part.lines[field], textStyle(type.body, theme.colors.body, view.width - indent), theme.space(2));
      const lineH = (line.height - line.lineSpacing * (line.getWrappedText().length - 1)) / line.getWrappedText().length;
      bullets.fillStyle(colorInt(theme.colors.gold), 0.9).fillCircle(view.x + 8, line.y + lineH / 2, 3);
    }
    if (part.extra !== undefined) add(view.x, part.extra, textStyle(type.label, theme.colors.muted, view.width), 0);
    y += theme.space(4);
  }
  tops.push(y);
  add(view.x, STATS_NEVER_SENT_TITLE, headingStyle, theme.space(2));
  add(view.x, STATS_NEVER_SENT_BODY, textStyle(type.body, theme.colors.body, view.width), 0);
  if (!footerInColumn) {
    y += theme.space(4);
    add(view.x, STATS_PANEL_FOOTER, textStyle(type.label, theme.colors.muted, view.width), 0);
  }
  const scroll = bindMenuScroll(scene, list, view, y, undefined, undefined, 0, shell);

  // The jump list, drawn now that the text's parts have their tops.
  const ghost = themedButtonColors('ghost');
  const chosen = themedButtonColors('selected');
  const plates: Phaser.GameObjects.Graphics[] = [];
  let navY = plate.y + inset;
  const draw = (active: number): void => {
    navs.forEach((nav, i) => {
      const colors = i === active ? chosen : ghost;
      plates[i].clear()
        .fillStyle(colorInt(colors.bg), 1).fillRoundedRect(0, 0, navW, nav.height, theme.radius.control)
        .lineStyle(theme.control.borderWidth, colorInt(colors.stroke), i === active ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(0, 0, navW, nav.height, theme.radius.control);
      nav.text.setColor(colors.fg);
    });
  };
  navs.forEach((nav, i) => {
    const row = scene.add.container(plate.x + inset, navY);
    const g = scene.add.graphics();
    plates.push(g);
    nav.text.setPosition(12, (nav.height - nav.text.height) / 2);
    const mark = scene.add.image(navW - 8 - chevron / 2, nav.height / 2, bakeUiIcon(scene, 'chevron'))
      .setDisplaySize(chevron, chevron).setTint(colorInt(theme.colors.muted));
    const zone = scene.add.zone(navW / 2, nav.height / 2, navW, nav.height).setInteractive({ useHandCursor: true });
    bindTapButton(scene, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      scroll.scrollTo(tops[i]);
      draw(i);
    });
    row.add([g, nav.text, mark, zone]);
    container.add(row);
    shell.interactiveChildren.push(zone);
    navY += nav.height + navGap;
  });
  scroll.onScroll = (offset) => draw(settingsActiveSection(tops, offset, view.height, scroll.maxScroll));
  draw(0);

  // The policy, at the column's foot; the label steps down a size before it would crowd the icon.
  const probe = scene.add.text(0, 0, STATS_PRIVACY_LINK_LABEL, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
  const fits = probe.width + type.body * 1.45 + 10 + 24 <= linkRect.width;
  probe.destroy();
  const link = compactButton(scene, linkRect, STATS_PRIVACY_LINK_LABEL, {
    icon: 'external', fontSize: fits ? type.body : type.label, onTap: () => openExternalPage(STATS_PRIVACY_LINK_HREF),
  });
  container.add(link.container);
  shell.interactiveChildren.push(link.inputZone);
  return shell;
}
