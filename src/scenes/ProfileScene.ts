import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { computeProfile, formatRate, type Difficulty } from '../meta/profileStats';
import { Services } from '../meta/services';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton } from '../ui/themeWidgets';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks but nothing rendered before — win/loss,
 * win-rate by difficulty, packs opened, and gauntlet best rung + clears — via
 * the pure computeProfile() summary. No engine/save mutation.
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  create(): void {
    applyBackdrop(this, 'mainmenu', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.62,
      fallback: () => {
        /* no art on disk — the themed canvas clear shows */
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const p = computeProfile(Services.save.data);

    this.add
      .text(640, 84, 'Profile', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    // Headline: overall record + win rate.
    this.add
      .text(640, 176, `${p.wins} W  –  ${p.losses} L`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0.5);
    this.add
      .text(
        640,
        220,
        p.games > 0 ? `${formatRate(p.winRate)} win rate over ${p.games} duels` : 'No duels played yet',
        { fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted },
      )
      .setOrigin(0.5);

    // Win-rate by difficulty (byDifficulty is already keyed easy/medium/hard).
    this.sectionLabel(300, 'Practice by difficulty');
    p.byDifficulty.forEach((d, i) => {
      const y = 340 + i * 40;
      this.rowPanel(y);
      this.add
        .text(440, y, DIFFICULTY_LABEL[d.key], {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(840, y, `${d.w} – ${d.l}      ${formatRate(d.rate)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          color: d.rate === null ? theme.colors.muted : theme.colors.heading,
        })
        .setOrigin(1, 0.5);
    });

    // Gauntlet + collection progress.
    this.sectionLabel(496, 'Gauntlet & collection');
    this.statRow(536, 'Best rung reached', p.bestRung > 0 ? `Rung ${p.bestRung}` : '—');
    this.statRow(576, 'Full gauntlet clears', `${p.completions}`);
    this.statRow(616, 'Packs opened', `${p.packsOpened}`);

    backButton(this, () => this.scene.start('MainMenu'));
  }

  private sectionLabel(y: number, text: string): void {
    this.add
      .text(440, y, text, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
  }

  private statRow(y: number, label: string, value: string): void {
    this.rowPanel(y);
    this.add
      .text(440, y, label, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.body })
      .setOrigin(0, 0.5);
    this.add
      .text(840, y, value, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
      .setOrigin(1, 0.5);
  }

  /** Shared list-row treatment: row fill with the standard panel outline. */
  private rowPanel(y: number): void {
    this.add
      .graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
      .fillRoundedRect(420, y - 17, 440, 34, theme.radius.control)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(420, y - 17, 440, 34, theme.radius.control);
  }
}
