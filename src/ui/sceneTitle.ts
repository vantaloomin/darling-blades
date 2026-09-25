import Phaser from 'phaser';
import { SCENE_TITLE } from './layout';
import { theme } from './theme';

/**
 * A menu screen's title on the shared header line, in the shared scene
 * header's recipe (`sceneHeaderFooter`), for screens that place their own back
 * button and gold badge. Geometry lives in `SCENE_TITLE` so the title-safe rule
 * is testable without Phaser.
 */
export function sceneTitle(scene: Phaser.Scene, label: string): Phaser.GameObjects.Text {
  return scene.add
    .text(SCENE_TITLE.x, SCENE_TITLE.y, label, {
      fontFamily: theme.fonts.display,
      fontSize: `${SCENE_TITLE.fontSize}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.heading,
    })
    .setOrigin(0.5);
}

export interface SceneSubtitleStyle {
  fontSize: number;
  color?: string;
  fontStyle?: string;
}

/** The one line under a scene title, hung from just below the header track. */
export function sceneSubtitle(
  scene: Phaser.Scene,
  label: string,
  style: SceneSubtitleStyle,
): Phaser.GameObjects.Text {
  return scene.add
    .text(SCENE_TITLE.x, SCENE_TITLE.subtitleTop, label, {
      fontFamily: theme.fonts.ui,
      fontSize: `${style.fontSize}px`,
      ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
      color: style.color ?? theme.colors.muted,
    })
    .setOrigin(0.5, 0);
}
