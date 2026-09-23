/**
 * The first-run anonymous-stats notice: a blocking dialog the main menu shows
 * BEFORE the tutorial prompt, carrying the sharing toggle (owner ruling
 * 2026-09-19).
 *
 * **It is not a consent request and must never grow into one.** The legal basis
 * for sending by default is the audience-measurement exemption plus legitimate
 * interest, not consent (docs/legal/README.md, finding 2); one condition of
 * that exemption is an easy way to object, which is why the toggle is a SETTING
 * shown in its saved state and the dismiss button is `Continue`. Nothing here
 * approves anything, and `tests/ui/statsPrivacyPresentation.test.ts` fails on
 * the words "agree", "accept", "consent", "allow" and "permission".
 *
 * Every string comes from `statsPrivacyPresentation.ts` and nothing is authored
 * here; the same test reads this file and fails if a line of copy is spelled
 * out in it. All the behaviour lives in `createStatsNoticeController`, which is
 * Phaser-free and therefore actually tested; this module only draws it.
 *
 * Note the layering: `src/ui` may not import `src/net` (the gate's importer
 * list is pinned by tests/net/harnessTrap.test.ts), so the caller evaluates the
 * gate and hands the state-aware line in as a string.
 */

import Phaser from 'phaser';
import { ModalGuard } from './Modal';
import { createStatsPrivacyPanel } from './StatsPrivacyPanel';
import {
  STATS_NOTICE_COPY,
  STATS_NOTICE_LAYOUT,
  statsNoticeBodyStack,
  statsNoticeContentWidth,
  statsNoticeFooterCenters,
  statsNoticeLabelWrapWidth,
  statsNoticeShellHeight,
  statsNoticeToggleCenterX,
  statsToggleLabel,
  type StatsNoticeController,
} from './statsPrivacyPresentation';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

export interface StatsNoticeDialogOptions {
  /** The caller's guard, opened over `guardTargets` while the dialog is up. */
  guard: ModalGuard;
  /** The controls underneath that the dialog deadens. */
  guardTargets: readonly Phaser.GameObjects.GameObject[];
  /** The dialog's whole behaviour, built by the caller from its save. */
  controller: StatsNoticeController;
  /**
   * The line under the toggle, from `statsNoticeNoteText`, or null when nothing
   * other than the player's own switch is stopping the sends.
   */
  note: string | null;
  /**
   * Runs after `Continue` (or Escape, or Enter) has stamped and the dialog is
   * gone. This is where the menu continues its arrival chain.
   */
  onContinue: () => void;
}

export function createStatsNoticeDialog(
  scene: Phaser.Scene,
  opts: StatsNoticeDialogOptions,
): ModalShell {
  const { controller } = opts;

  // Measure-then-place, and then SIZE: the body is wrapped and measured before
  // the shell exists (its wrap width depends on the dialog's width alone), so
  // the shell can be exactly as tall as what it holds. Wrap counts are
  // font-fallback dependent on Windows, so no line count is assumed.
  const wrapWidth = statsNoticeContentWidth();
  const paragraph = (text: string): Phaser.GameObjects.Text =>
    scene.add
      .text(0, 0, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        wordWrap: { width: wrapWidth },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
  const lead = paragraph(STATS_NOTICE_COPY.bodyLead);
  const assurance = paragraph(STATS_NOTICE_COPY.bodyAssurance);
  // The state-aware line joins the stack only when there is one.
  const noteText =
    opts.note === null
      ? null
      : scene.add
          .text(0, 0, opts.note, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
            wordWrap: { width: wrapWidth },
            lineSpacing: 2,
          })
          .setOrigin(0, 0);
  const stack = statsNoticeBodyStack({
    paragraph1: lead.height,
    paragraph2: assurance.height,
    note: noteText === null ? null : noteText.height,
  });

  // `mandatory`: no close X, no dim dismissal, no shell-owned Esc. The only
  // ways out are the three this module binds, and all three stamp.
  const shell = modalShell(scene, {
    width: STATS_NOTICE_LAYOUT.width,
    height: statsNoticeShellHeight(stack.height),
    dimAlpha: STATS_NOTICE_LAYOUT.dimAlpha,
    depth: STATS_NOTICE_LAYOUT.depth,
    dismissal: 'mandatory',
    onClose: () => opts.guard.close(),
  });
  opts.guard.open(opts.guardTargets);

  const container = shell.container;
  const content = shell.tracks.contentBounds;
  const titleTrack = shell.tracks.titleTrack;

  container.add(
    scene.add
      .text(titleTrack.x, titleTrack.y + titleTrack.height / 2, STATS_NOTICE_COPY.title, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5),
  );

  lead.setPosition(content.x, content.y);
  assurance.setPosition(content.x, content.y + stack.paragraph2Y);
  container.add([lead, assurance]);
  const rowCenterY = content.y + stack.toggleRowCenterY;
  if (noteText && stack.noteY !== null) {
    noteText.setPosition(content.x, content.y + stack.noteY);
    container.add(noteText);
  }

  // The toggle: the same look, the same two words and the same immediate write
  // as the Settings row. It shows the SAVED choice even when a browser signal
  // or a development build is what is actually stopping the sends, which is
  // what the line underneath is for.
  const toggle = themedButton(
    scene,
    statsNoticeToggleCenterX(content.x + content.width, STATS_NOTICE_LAYOUT.toggleMinWidth),
    rowCenterY,
    statsToggleLabel(controller.sharing()),
    {
      variant: controller.sharing() ? 'primary' : 'ghost',
      size: 'sm',
      minWidth: STATS_NOTICE_LAYOUT.toggleMinWidth,
      onTap: () => {
        const on = controller.toggle();
        toggle.setLabel(statsToggleLabel(on));
        toggle.setVariant(on ? 'primary' : 'ghost');
      },
    },
  );
  // Right-align to the measured hit box, which a wider fallback font grows.
  toggle.container.setX(
    statsNoticeToggleCenterX(content.x + content.width, toggle.getMeasuredSize().hit.width),
  );
  container.add(toggle.container);
  shell.interactiveChildren.push(toggle.inputZone);

  container.add(
    scene.add
      .text(content.x, rowCenterY, STATS_NOTICE_COPY.toggleLabel, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        wordWrap: {
          width: statsNoticeLabelWrapWidth(content.width, toggle.getMeasuredSize().hit.width),
        },
      })
      .setOrigin(0, 0.5),
  );

  // ---------------------------------------------------------------------
  // The one exit, and the one thing that stamps.
  // ---------------------------------------------------------------------

  /** Set while the "What is sent" panel is over us, so Esc/Enter belong to it. */
  let panel: ModalShell | null = null;

  const finish = (): void => {
    if (panel) return;
    // The controller stamps exactly once; a second Escape costs nothing.
    controller.dismiss();
    shell.close();
    opts.onContinue();
  };

  const footer = shell.tracks.footerTrack;
  const secondary = themedButton(scene, footer.x, footer.y + footer.height / 2, STATS_NOTICE_COPY.secondaryLabel, {
    variant: 'ghost',
    minWidth: STATS_NOTICE_LAYOUT.secondaryMinWidth,
    onTap: () => openPanel(),
  });
  const primary = themedButton(scene, footer.x, footer.y + footer.height / 2, STATS_NOTICE_COPY.primaryLabel, {
    variant: 'primary',
    minWidth: STATS_NOTICE_LAYOUT.primaryMinWidth,
    onTap: () => finish(),
  });
  const centers = statsNoticeFooterCenters(
    footer,
    secondary.getMeasuredSize().hit.width,
    primary.getMeasuredSize().hit.width,
  );
  secondary.container.setX(centers.secondaryX);
  primary.container.setX(centers.primaryX);
  container.add([secondary.container, primary.container]);
  shell.interactiveChildren.push(secondary.inputZone, primary.inputZone);

  /**
   * Open the existing "What is sent" panel over the dialog.
   *
   * It gets a guard of its own rather than the caller's: `ModalGuard.close()`
   * releases every lease on that guard, so sharing one would re-enable the main
   * menu underneath a dialog that is still up when the panel closes. Nothing of
   * the dialog's state is touched, so the toggle comes back exactly as it was.
   */
  function openPanel(): void {
    if (panel) return;
    const panelGuard = new ModalGuard();
    const opened = createStatsPrivacyPanel(scene, panelGuard, [
      toggle.inputZone,
      secondary.inputZone,
      primary.inputZone,
    ]);
    panel = opened;
    opened.container.once('destroy', () => {
      if (panel === opened) panel = null;
    });
  }

  // Escape and Enter do exactly what Continue does. The shell is `mandatory`,
  // so it binds no Esc of its own and these are the only keyboard routes; both
  // stand down while the panel is open, which owns Esc for itself.
  const keyboard = scene.input.keyboard;
  const onKey = (): void => finish();
  keyboard?.on('keydown-ESC', onKey);
  keyboard?.on('keydown-ENTER', onKey);
  container.once('destroy', () => {
    keyboard?.off('keydown-ESC', onKey);
    keyboard?.off('keydown-ENTER', onKey);
  });

  return shell;
}
