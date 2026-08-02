import Phaser from 'phaser';
import { Services } from '../meta/services';
import {
  DARLINGS_TUTORIAL_BUTTONS,
  DARLINGS_TUTORIAL_LINES,
  DARLINGS_TUTORIAL_TITLE,
} from './darlingsTutorialCopy';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

export interface DarlingsTutorialOptions {
  onDismiss?: () => void;
  onReadMore: () => void;
}

/** Show the once-per-save command-zone explainer using the shared modal shell. */
export function showDarlingsTutorial(
  scene: Phaser.Scene,
  options: DarlingsTutorialOptions,
): ModalShell | null {
  if (Services.save.data.darlingsTutorialSeen) return null;
  let readMore = false;
  const dismiss = (): void => {
    Services.save.data.darlingsTutorialSeen = true;
    Services.save.flush();
    if (!readMore) options.onDismiss?.();
  };
  const shell = modalShell(scene, {
    width: 760,
    height: 520,
    dimAlpha: 0.62,
    tapDimToClose: true,
    escToClose: true,
    showClose: true,
    depth: theme.depth.inspect,
    onClose: dismiss,
  });
  const content = shell.container;
  content.add(
    scene.add.text(640, 94, DARLINGS_TUTORIAL_TITLE, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    }).setOrigin(0.5),
  );
  DARLINGS_TUTORIAL_LINES.forEach((line, index) => {
    content.add(
      scene.add.text(640, 148 + index * 68, line, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: 620 },
        lineSpacing: 3,
      }).setOrigin(0.5),
    );
  });
  const gotIt = themedButton(scene, 520, 438, DARLINGS_TUTORIAL_BUTTONS[0], {
    variant: 'primary',
    minWidth: 132,
    onTap: shell.close,
  });
  const more = themedButton(scene, 760, 438, DARLINGS_TUTORIAL_BUTTONS[1], {
    variant: 'ghost',
    minWidth: 142,
    onTap: () => {
      readMore = true;
      Services.save.data.darlingsTutorialSeen = true;
      Services.save.flush();
      shell.close();
      options.onReadMore();
    },
  });
  content.add([gotIt.container, more.container]);
  return shell;
}
