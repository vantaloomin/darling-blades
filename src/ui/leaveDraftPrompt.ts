import Phaser from 'phaser';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

export interface LeaveDraftPromptOptions {
  /** The stay action, named for the work the player returns to ("Keep Drafting"). */
  stayLabel: string;
  /** Runs after the prompt has closed, when the player confirms. */
  onLeave: () => void;
  /** Runs on every close path (stay, leave, the close button, Esc, the dim). */
  onClose?: () => void;
}

const PROMPT = { width: 620, buttonMinWidth: 160, buttonOffset: 180 } as const;
/** The shell's reserved tracks around the body: inset, title, gap | gap, footer, inset. */
const TRACKS_HEIGHT = 2 * theme.space(6) + 2 * theme.control.minHitHeight + 2 * theme.space(4);

/**
 * The "Leave Draft?" confirm both Limited screens open from their back
 * control. The draft screen and the Limited deck builder carried two
 * line-for-line copies that differed only in the stay label until 1.8.1
 * (2026-09-25). The run is saved either way, so leaving is safe and the
 * prompt says so; the caller owns the one-prompt-at-a-time guard.
 *
 * Content-sized on the shell's tracks (1.9 accessibility): the title on the
 * title track, the wrapped message in the content band below the close
 * button, the two actions on the footer track. The fixed 250px panel put the
 * message beside the close button and, at larger text, under it.
 */
export function leaveDraftPrompt(scene: Phaser.Scene, opts: LeaveDraftPromptOptions): ModalShell {
  const cx = theme.design.centerX;
  const message = scene.add
    .text(cx, 0, 'Your draft run is saved and can be resumed from the Draft hub. Leave now?', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.body}px`,
      color: theme.colors.body,
      align: 'center',
      wordWrap: { width: PROMPT.width - 2 * theme.space(6), useAdvancedWrap: true },
    })
    .setOrigin(0.5, 0);
  const shell = modalShell(scene, {
    width: PROMPT.width,
    height: Math.ceil(TRACKS_HEIGHT + message.height),
    dimAlpha: 0.84,
    dismissal: 'dismissible',
    onClose: opts.onClose,
  });
  const c = shell.container;
  const { titleTrack, contentBounds, footerTrack } = shell.tracks;
  c.add(
    scene.add
      .text(cx, titleTrack.y + titleTrack.height / 2, 'Leave Draft?', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5),
  );
  message.setY(contentBounds.y + (contentBounds.height - message.height) / 2);
  c.add(message);
  const footerY = footerTrack.y + footerTrack.height / 2;
  const stay = themedButton(scene, cx - PROMPT.buttonOffset, footerY, opts.stayLabel, {
    variant: 'ghost',
    minWidth: PROMPT.buttonMinWidth,
    onTap: shell.close,
  });
  const leave = themedButton(scene, cx + PROMPT.buttonOffset, footerY, 'Leave Draft', {
    variant: 'primary',
    minWidth: PROMPT.buttonMinWidth,
    onTap: () => {
      shell.close();
      opts.onLeave();
    },
  });
  c.add([stay.container, leave.container]);
  return shell;
}
