import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Services } from '../meta/services';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { goldBadge, themedButton } from '../ui/themeWidgets';

/**
 * The "Play" submenu (user-directed 2026-07-14): MainMenu's game-mode rows
 * (Avatar Gauntlet + the three Practice difficulties) moved here, joined by
 * Draft (the Limited hub — the persona Bot Draft's public entry). Pure
 * navigation: every row is a scene.start, Return goes back to MainMenu.
 */
const PLAY_ITEMS: { label: string; scene: string; data?: object }[] = [
  { label: 'Avatar Gauntlet', scene: 'Gauntlet' },
  { label: 'Draft', scene: 'Limited' },
  // The three difficulty rows collapsed into the opponent picker (1.2): pick
  // any tower avatar (their difficulty applies) or a plain training duel.
  { label: 'Practice', scene: 'PracticePicker' },
  { label: 'Return', scene: 'MainMenu' },
];

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('Play');
  }

  create(): void {
    const width = 1280;
    applyBackdrop(this, 'mainmenu', {
      dim: theme.graphics.dim,
      dimAlpha: 0.5,
      fallback: () => {
        /* the clear colour shows, matching MainMenu's bare fallback */
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    this.add
      .text(width / 2, 140, 'Play', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.displayXL}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 205, 'Climb the tower, draft against the table, or spar freely.', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    goldBadge(this, width - 30, 30, { getValue: () => Services.save.data.gold });

    const firstY = 286;
    const pitchY = 56;
    PLAY_ITEMS.forEach((entry, i) => {
      themedButton(this, width / 2, firstY + i * pitchY, entry.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => this.scene.start(entry.scene, entry.data),
      });
    });
  }
}
