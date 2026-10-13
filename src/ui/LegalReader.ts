/**
 * The in-game legal reader on a phone (M26, mock M-LegalReader): the published
 * page's own text in the main pane, its sections as a jump list in the
 * command column, and Open in browser for the real page at the column's foot.
 * The back control (and Esc) closes it, which leaves the Legal sheet it was
 * opened from.
 *
 * It reads the page the build already ships (`public/*.html`, generated from
 * `docs/legal/`), so the game never carries a second copy of the text. Where
 * the page cannot be read (offline in a browser that never cached it), Read
 * falls back to opening the page as before.
 */

import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import { COMPACT, compactShell } from './compactLayout';
import { compactButton, compactIconButton, COMPACT_DRAG_SLOP } from './compactWidgets';
import { themedButtonColors } from './controlStyle';
import type { LegalEntry } from './legalPresentation';
import { parseLegalPage, type LegalPageText } from './legalReaderText';
import { bindMenuScroll } from './menuScroll';
import { openExternalPage } from './openExternalPage';
import { sceneStage } from './SceneBackdrop';
import { settingsActiveSection } from './settingsCompact';
import { ellipsizeText } from './textFit';
import { colorInt, theme } from './theme';
import { modalShell, type ModalShell, type ThemedButton } from './themeWidgets';

/** Fetch the page and open the reader over the scene; the page itself opens when it cannot be read. */
export function openLegalReader(scene: Phaser.Scene, entry: LegalEntry): void {
  void fetch(entry.href)
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
    .then((html) => {
      if (scene.sys.isActive()) showLegalReader(scene, entry, parseLegalPage(html));
    })
    .catch(() => openExternalPage(entry.href));
}

/** Draw the reader for a parsed page. */
export function showLegalReader(scene: Phaser.Scene, entry: LegalEntry, page: LegalPageText): ModalShell {
  const type = theme.compactType;
  const shell0 = compactShell(sceneStage(scene).content, { back: true });
  const plate = shell0.main;
  const column = shell0.column ?? { x: plate.x + plate.width, y: plate.y, width: 0, height: plate.height };
  const shell = modalShell(scene, {
    width: plate.width,
    height: plate.height,
    x: plate.x + plate.width / 2,
    y: plate.y + plate.height / 2,
    dismissal: 'esc-only',
    // Nearly opaque: the reader is a page of its own, not a note over Settings.
    dimAlpha: 0.94,
  });
  const container = shell.container;

  // The top bar: back, the page's name and its effective date.
  const back = compactIconButton(scene, shell0.back?.visual ?? { x: plate.x, y: shell0.title.y, width: 44, height: 44 }, 'back', () => shell.close());
  const titleRight = shell0.right.x + shell0.right.width;
  const title = scene.add.text(shell0.title.x, 0, entry.label, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  });
  ellipsizeText(title, titleRight - shell0.title.x);
  const subtitle = page.effective
    ? scene.add.text(shell0.title.x, 0, page.effective, { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted })
    : null;
  if (subtitle) ellipsizeText(subtitle, titleRight - shell0.title.x);
  const twoLines = subtitle && title.height + subtitle.height <= shell0.title.height;
  if (subtitle && !twoLines) subtitle.destroy();
  const block = title.height + (twoLines && subtitle ? subtitle.height : 0);
  title.setY(shell0.title.y + (shell0.title.height - block) / 2);
  if (twoLines && subtitle) subtitle.setY(title.y + title.height);
  container.add([back.container, title, ...(twoLines && subtitle ? [subtitle] : [])]);
  shell.interactiveChildren.push(back.inputZone);

  // The page.
  const pad = theme.space(4);
  const view = { x: plate.x + pad, y: plate.y + theme.space(3), width: plate.width - pad * 2 - theme.space(2), height: plate.height - theme.space(6) };
  const list = scene.add.container(0, view.y);
  container.add(list);
  const bullets = scene.add.graphics();
  list.add(bullets);
  const style = (size: number, color: string, width: number, bold = false, font: string = theme.fonts.ui): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: font, fontSize: `${size}px`, color, wordWrap: { width }, lineSpacing: 4, ...(bold ? { fontStyle: theme.weight.w700 } : {}),
  });
  const tops: number[] = [];
  const headings: string[] = [];
  let y = 0;
  page.blocks.forEach((b, i) => {
    if (b.kind === 'h2') {
      if (i > 0) {
        y += theme.space(3);
        list.add(scene.add.rectangle(view.x, y, view.width, 1, theme.graphics.panelStroke, theme.alpha.chrome).setOrigin(0, 0));
        y += theme.space(4);
      }
      tops.push(Math.max(0, y - theme.space(4)));
      headings.push(b.text);
      const t = scene.add.text(view.x, y, b.text, style(type.h2, theme.colors.heading, view.width, true, theme.fonts.display));
      list.add(t);
      y += t.height + theme.space(3);
      return;
    }
    if (b.kind === 'h3') {
      y += theme.space(1);
      const t = scene.add.text(view.x, y, b.text, style(type.body, theme.colors.gold, view.width, true));
      list.add(t);
      y += t.height + theme.space(2);
      return;
    }
    const indent = b.kind === 'li' ? 22 : 0;
    const t = scene.add.text(view.x + indent, y, b.text, style(type.body, b.emphasis ? theme.colors.gold : theme.colors.body, view.width - indent));
    list.add(t);
    if (b.kind === 'li') {
      const lines = Math.max(1, t.getWrappedText().length);
      const lineH = (t.height - t.lineSpacing * (lines - 1)) / lines;
      bullets.fillStyle(colorInt(theme.colors.gold), 0.9).fillCircle(view.x + 7, y + lineH / 2, 3);
    }
    y += t.height + (b.kind === 'li' ? theme.space(1.5) : theme.space(3));
  });
  const scroll = bindMenuScroll(scene, list, view, y, undefined, undefined, 0, shell);

  // The column: the sections, then Open in browser.
  const link = shell0.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const navView = { x: column.x, y: column.y, width: column.width, height: link.y - COMPACT.gap - column.y };
  const navList = scene.add.container(0, navView.y);
  container.add(navList);
  const ghost = themedButtonColors('ghost');
  const chosen = themedButtonColors('selected');
  const navW = navView.width - theme.space(2);
  const rows: { g: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; h: number; zone: Phaser.GameObjects.Zone; top: number }[] = [];
  let navY = 0;
  const draw = (active: number): void => rows.forEach((row, i) => {
    const colors = i === active ? chosen : ghost;
    row.g.clear()
      .fillStyle(colorInt(colors.bg), 1).fillRoundedRect(0, 0, navW, row.h, theme.radius.control)
      .lineStyle(theme.control.borderWidth, colorInt(colors.stroke), i === active ? 1 : theme.alpha.chrome)
      .strokeRoundedRect(0, 0, navW, row.h, theme.radius.control);
    row.text.setColor(colors.fg);
  });
  const adapters: ThemedButton[] = [];
  headings.forEach((heading, i) => {
    const text = scene.add.text(12, 0, heading, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, wordWrap: { width: navW - 24 },
    });
    const h = Math.max(COMPACT.touch, text.height + 16);
    text.setY((h - text.height) / 2);
    const row = scene.add.container(navView.x, navY);
    const g = scene.add.graphics();
    const zone = scene.add.zone(navW / 2, h / 2, navW, h).setInteractive({ useHandCursor: true });
    bindTapButton(scene, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      scroll.scrollTo(tops[i]);
      draw(i);
    });
    row.add([g, text, zone]);
    navList.add(row);
    shell.interactiveChildren.push(zone);
    rows.push({ g, text, h, zone, top: navY });
    adapters.push({
      container: row, inputZone: zone,
      getMeasuredBounds: () => ({ hit: { x: 0, y: 0, width: navW, height: h } }),
      setEnabled: (on: boolean) => { if (on) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); },
    } as unknown as ThemedButton);
    navY += h + COMPACT.gap;
  });
  const navScroll = bindMenuScroll(scene, navList, navView, Math.max(0, navY - COMPACT.gap), undefined, adapters, 0, shell);
  scroll.onScroll = (offset) => {
    const active = settingsActiveSection(tops, offset, view.height, scroll.maxScroll);
    draw(active);
    // Keep the lit section in the column's view.
    const row = rows[active];
    if (row && (row.top < navScroll.offset() || row.top + row.h > navScroll.offset() + navView.height)) {
      navScroll.scrollTo(row.top - (navView.height - row.h) / 2);
    }
  };
  draw(0);

  const open = compactButton(scene, link, 'Open in browser', { icon: 'external', onTap: () => openExternalPage(entry.href) });
  container.add(open.container);
  shell.interactiveChildren.push(open.inputZone);
  return shell;
}
