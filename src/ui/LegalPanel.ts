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
import type { ModalGuard } from './Modal';
import { openExternalPage } from './openExternalPage';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

/**
 * Build the panel. The caller owns the guard and the list of controls beneath
 * it; closing the shell releases both.
 */
export function createLegalPanel(
  scene: Phaser.Scene,
  guard: ModalGuard,
  guardTargets: readonly Phaser.GameObjects.GameObject[],
): ModalShell {
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
