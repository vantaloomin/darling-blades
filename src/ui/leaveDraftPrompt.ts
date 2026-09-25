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

const PROMPT = { width: 620, height: 250, buttonMinWidth: 160 } as const;

/**
 * The "Leave Draft?" confirm both Limited screens open from their back
 * control. The draft screen and the Limited deck builder carried two
 * line-for-line copies that differed only in the stay label until 1.8.1
 * (2026-09-25). The run is saved either way, so leaving is safe and the
 * prompt says so; the caller owns the one-prompt-at-a-time guard.
 */
export function leaveDraftPrompt(scene: Phaser.Scene, opts: LeaveDraftPromptOptions): ModalShell {
  const cx = theme.design.centerX;
  const cy = theme.design.centerY;
  const shell = modalShell(scene, {
    width: PROMPT.width,
    height: PROMPT.height,
    dimAlpha: 0.84,
    dismissal: 'dismissible',
    onClose: opts.onClose,
  });
  const c = shell.container;
  c.add(
    scene.add
      .text(cx, cy - 100, 'Leave Draft?', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5),
  );
  c.add(
    scene.add
      .text(cx, cy - 48, 'Your draft run is saved and can be resumed from the Draft hub. Leave now?', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: PROMPT.width - 100 },
      })
      .setOrigin(0.5),
  );
  const stay = themedButton(scene, cx - 180, cy + 38, opts.stayLabel, {
    variant: 'ghost',
    minWidth: PROMPT.buttonMinWidth,
    onTap: shell.close,
  });
  const leave = themedButton(scene, cx + 180, cy + 38, 'Leave Draft', {
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
