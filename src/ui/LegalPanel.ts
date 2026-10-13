/**
 * The Legal panel: one row per published legal page, with the button that
 * opens it.
 *
 * The three pages ship inside the same build as the client
 * (`scripts/gen-legal-pages.ts` writes them into `public/`), so every Read here
 * resolves offline in the desktop bundle and under the project path on the
 * Pages site. The panel keeps no list of its own: it walks `LEGAL_ENTRIES`, so
 * a document added to the set appears here without this file changing.
 *
 * Every string comes from `legalPresentation.ts`. Nothing is authored here.
 */

import Phaser from 'phaser';
import {
  LEGAL_ENTRIES,
  LEGAL_PANEL_LAYOUT,
  LEGAL_PANEL_TITLE,
  LEGAL_READ_LABEL,
  legalReadCenterX,
  legalRowStack,
  legalTextWrapWidth,
  type LegalRowMeasured,
} from './legalPresentation';
import { COMPACT, compactShell } from './compactLayout';
import { compactButton } from './compactWidgets';
import { bindMenuScroll } from './menuScroll';
import type { ModalGuard } from './Modal';
import { sceneStage } from './SceneBackdrop';
import { openExternalPage } from './openExternalPage';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell, type ThemedButton } from './themeWidgets';

/**
 * Build the panel. The caller owns the guard and the list of controls beneath
 * it; closing the shell releases both.
 */
export function createLegalPanel(
  scene: Phaser.Scene,
  guard: ModalGuard,
  guardTargets: readonly Phaser.GameObjects.GameObject[],
): ModalShell {
  if (sceneStage(scene).compact) return createCompactLegalPanel(scene, guard, guardTargets);
  // Opaque chrome, the same as the "What is sent" panel beside it: this panel
  // dims lightly over the Settings rows, and the shared 0.9 panel fill let
  // their text ghost through the rows the player is here to read.
  const shell = modalShell(scene, {
    width: LEGAL_PANEL_LAYOUT.width,
    height: LEGAL_PANEL_LAYOUT.height,
    dismissal: 'dismissible',
    dimAlpha: LEGAL_PANEL_LAYOUT.dimAlpha,
    opaque: true,
    onClose: () => guard.close(),
  });
  guard.open(guardTargets);

  const container = shell.container;
  const titleTrack = shell.tracks.titleTrack;
  container.add(
    scene.add
      .text(titleTrack.x, titleTrack.y + titleTrack.height / 2, LEGAL_PANEL_TITLE, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5),
  );

  const content = shell.tracks.contentBounds;
  // Measure-then-place: build every row's text first, ask the layout where the
  // rows go, and only then move them. Wrap counts are font-fallback dependent
  // on Windows (playbook trap), so no row's height is assumed.
  const reads = LEGAL_ENTRIES.map((entry) =>
    themedButton(scene, 0, 0, LEGAL_READ_LABEL, {
      variant: 'ghost',
      minWidth: LEGAL_PANEL_LAYOUT.readMinWidth,
      onTap: () => openExternalPage(entry.href),
    }),
  );
  const readHitWidth = Math.max(...reads.map((read) => read.getMeasuredSize().hit.width));
  const wrapWidth = legalTextWrapWidth(content.width, readHitWidth);

  const texts = LEGAL_ENTRIES.map((entry) => ({
    label: scene.add
      .text(content.x, 0, entry.label, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0, 0),
    summary: scene.add
      .text(content.x, 0, entry.summary, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        wordWrap: { width: wrapWidth },
        lineSpacing: 2,
      })
      .setOrigin(0, 0),
  }));

  const measured: LegalRowMeasured[] = texts.map((row) => ({
    label: row.label.height,
    summary: row.summary.height,
  }));
  const stack = legalRowStack(measured);
  const readX = legalReadCenterX(content.x + content.width, readHitWidth);
  stack.rows.forEach((placement, index) => {
    texts[index].label.setY(content.y + placement.labelY);
    texts[index].summary.setY(content.y + placement.summaryY);
    reads[index].container.setPosition(readX, content.y + placement.readCenterY);
    container.add([texts[index].label, texts[index].summary, reads[index].container]);
    shell.interactiveChildren.push(reads[index].inputZone);
  });

  return shell;
}

/**
 * The phone's Legal sheet (mock M-SettingsLegal): over the main pane, one row
 * per page with its summary and a Read button that opens it outside the game.
 * The rows scroll when the text is too tall for the pane (Largest text).
 */
function createCompactLegalPanel(
  scene: Phaser.Scene,
  guard: ModalGuard,
  guardTargets: readonly Phaser.GameObjects.GameObject[],
): ModalShell {
  const type = theme.compactType;
  const main = compactShell(sceneStage(scene).content, { back: true }).main;
  const shell = modalShell(scene, {
    width: main.width,
    height: main.height,
    x: main.x + main.width / 2,
    y: main.y + main.height / 2,
    dismissal: 'dismissible',
    dimAlpha: LEGAL_PANEL_LAYOUT.dimAlpha,
    onClose: () => guard.close(),
  });
  guard.open(guardTargets);
  const container = shell.container;
  const titleTrack = shell.tracks.titleTrack;
  container.add(scene.add.text(titleTrack.x, titleTrack.y + titleTrack.height / 2, LEGAL_PANEL_TITLE, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  }).setOrigin(0, 0.5));

  const body = shell.tracks.contentBounds;
  const view = { x: body.x, y: body.y, width: body.width, height: main.y + main.height - theme.space(4) - body.y };
  const list = scene.add.container(0, view.y);
  container.add(list);
  const probe = scene.add.text(0, 0, LEGAL_READ_LABEL, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
  // The label, the icon beside it, and 16 px either side.
  const readW = Math.ceil(probe.width + type.body * 1.45 + 10) + 32;
  probe.destroy();
  const textW = view.width - readW - COMPACT.gap * 2;
  const pad = 10;
  const reads: ReturnType<typeof compactButton>[] = [];
  let y = 0;
  LEGAL_ENTRIES.forEach((entry, i) => {
    if (i > 0) list.add(scene.add.rectangle(view.x, y, view.width, 1, theme.graphics.panelStroke, theme.alpha.chrome).setOrigin(0, 0));
    const label = scene.add.text(view.x, 0, entry.label, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      wordWrap: { width: textW },
    });
    const summary = scene.add.text(view.x, 0, entry.summary, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: textW }, lineSpacing: 2,
    });
    const block = label.height + 4 + summary.height;
    const height = Math.max(COMPACT.touch, block) + pad * 2;
    label.setY(y + (height - block) / 2);
    summary.setY(label.y + label.height + 4);
    const read = compactButton(scene, { x: view.x + view.width - readW, y: y + (height - COMPACT.touch) / 2, width: readW, height: COMPACT.touch },
      LEGAL_READ_LABEL, { icon: 'external', onTap: () => openExternalPage(entry.href) });
    list.add([label, summary, read.container]);
    shell.interactiveChildren.push(read.inputZone);
    reads.push(read);
    y += height;
  });
  bindMenuScroll(scene, list, view, y, undefined, reads.map((read) => ({
    container: read.container,
    inputZone: read.inputZone,
    getMeasuredBounds: () => ({ hit: { x: 0, y: 0, width: readW, height: COMPACT.touch } }),
    setEnabled: (on: boolean) => {
      if (on) read.inputZone.setInteractive({ useHandCursor: true });
      else read.inputZone.disableInteractive();
    },
  }) as unknown as ThemedButton), 0, shell);
  return shell;
}
