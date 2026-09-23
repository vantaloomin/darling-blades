import Phaser from 'phaser';
import { Services } from '../meta/services';
import {
  DARLINGS_TUTORIAL_BUTTONS,
  DARLINGS_TUTORIAL_LINES,
  DARLINGS_TUTORIAL_TITLE,
} from './darlingsTutorialCopy';
import { modalShellLayout } from './layout';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

export interface DarlingsTutorialOptions {
  onDismiss?: () => void;
  onReadMore: () => void;
}

const TUTORIAL_WIDTH = 760;
/** The explainer's measure: narrower than the content track, for line length. */
const TUTORIAL_WRAP = 620;
const PARAGRAPH_GAP = theme.space(4);
const BUTTON_GAP = theme.space(6);

/**
 * Show the once-per-save command-zone explainer using the shared modal shell.
 *
 * Measure-then-place: the paragraphs are built first, the shell is sized to
 * hold them, and the title, paragraphs and buttons then sit on the shell's own
 * title, content and footer tracks. Wrap counts are font-fallback dependent on
 * Windows (playbook trap), so no paragraph height is assumed.
 */
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

  const centerX = theme.design.centerX;
  const paragraphs = DARLINGS_TUTORIAL_LINES.map((line) =>
    scene.add
      .text(centerX, 0, line, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: TUTORIAL_WRAP },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0),
  );
  const contentHeight =
    paragraphs.reduce((sum, text) => sum + text.height, 0) + PARAGRAPH_GAP * (paragraphs.length - 1);
  // Everything the shell reserves around its content track (padding, title
  // and footer tracks, their gaps), read off the shared layout itself.
  const probeHeight = 1000;
  const chrome = probeHeight - modalShellLayout({ width: TUTORIAL_WIDTH, height: probeHeight }).contentBounds.height;

  const shell = modalShell(scene, {
    width: TUTORIAL_WIDTH,
    height: chrome + contentHeight,
    dimAlpha: 0.62,
    dismissal: 'dismissible',
    depth: theme.depth.inspect,
    onClose: dismiss,
  });
  const container = shell.container;
  const { titleTrack, contentBounds, footerTrack } = shell.tracks;

  const title = scene.add
    .text(0, titleTrack.y + titleTrack.height / 2, DARLINGS_TUTORIAL_TITLE, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    })
    .setOrigin(0.5);
  // Centred over the paragraphs, but never into the close button's track.
  title.setX(Math.min(centerX, titleTrack.x + titleTrack.width - title.width / 2));
  container.add(title);

  let cursor = contentBounds.y;
  for (const text of paragraphs) {
    text.setY(cursor);
    cursor += text.height + PARAGRAPH_GAP;
    container.add(text);
  }

  const footerY = footerTrack.y + footerTrack.height / 2;
  const gotIt = themedButton(scene, 0, footerY, DARLINGS_TUTORIAL_BUTTONS[0], {
    variant: 'primary',
    minWidth: 132,
    onTap: shell.close,
  });
  const more = themedButton(scene, 0, footerY, DARLINGS_TUTORIAL_BUTTONS[1], {
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
  // The pair is centred as one group on the footer track.
  const gotItWidth = gotIt.getMeasuredSize().visual.width;
  const moreWidth = more.getMeasuredSize().visual.width;
  const groupLeft = centerX - (gotItWidth + BUTTON_GAP + moreWidth) / 2;
  gotIt.container.setX(groupLeft + gotItWidth / 2);
  more.container.setX(groupLeft + gotItWidth + BUTTON_GAP + moreWidth / 2);
  container.add([gotIt.container, more.container]);
  return shell;
}
