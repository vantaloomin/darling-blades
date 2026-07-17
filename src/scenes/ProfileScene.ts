import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { todayString } from '../meta/Economy';
import { computeProfile, formatRate, type Difficulty } from '../meta/profileStats';
import { canReplay, type ReplayLog } from '../meta/Replay';
import { Services } from '../meta/services';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel, themedButton } from '../ui/themeWidgets';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks and the persisted deterministic replay reel.
 * Nothing rendered here mutates the save.
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
        /* no art on disk, the themed canvas clear shows */
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const p = computeProfile(Services.save.data);

    this.add
      .text(640, 64, 'Profile', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    this.add
      .text(640, 112, `${p.wins} W  /  ${p.losses} L`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0.5);
    this.add
      .text(
        640,
        146,
        p.games > 0 ? `${formatRate(p.winRate)} win rate over ${p.games} duels` : 'No duels played yet',
        { fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted },
      )
      .setOrigin(0.5);

    panel(this, 72, 190, 500, 450);
    panel(this, 600, 190, 608, 450);

    // Win-rate by difficulty (byDifficulty is already keyed easy/medium/hard).
    this.sectionLabel(224, 'Practice by difficulty');
    p.byDifficulty.forEach((d, i) => {
      const y = 268 + i * 36;
      this.rowPanel(y);
      this.add
        .text(104, y, DIFFICULTY_LABEL[d.key], {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(540, y, `${d.w} / ${d.l}      ${formatRate(d.rate)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          color: d.rate === null ? theme.colors.muted : theme.colors.heading,
        })
        .setOrigin(1, 0.5);
    });

    // Gauntlet + collection progress.
    this.sectionLabel(392, 'Gauntlet & collection');
    this.statRow(432, 'Best rung reached', p.bestRung > 0 ? `Rung ${p.bestRung}` : 'None');
    this.statRow(468, 'Full gauntlet clears', `${p.completions}`);
    this.statRow(504, 'Packs opened', `${p.packsOpened}`);

    this.add
      .text(632, 224, 'Replays', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    const replays = Services.save.data.replays.slice(0, 10);
    if (replays.length === 0) {
      this.add
        .text(632, 290, 'No replays yet. Finish a duel and it will appear here.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
          wordWrap: { width: 520 },
        })
        .setOrigin(0, 0.5);
    } else {
      replays.forEach((log, index) => {
        const column = index < 5 ? 0 : 1;
        const row = index % 5;
        this.replayRow(log, 620 + column * 298, 252 + row * 76, 280);
      });
    }

    backButton(this, () => this.scene.start('MainMenu'));
  }

  private sectionLabel(y: number, text: string): void {
    this.add
      .text(104, y, text, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
  }

  private statRow(y: number, label: string, value: string): void {
    this.rowPanel(y);
    this.add
      .text(104, y, label, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.body })
      .setOrigin(0, 0.5);
    this.add
      .text(540, y, value, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
      .setOrigin(1, 0.5);
  }

  /** Shared list-row treatment: row fill with the standard panel outline. */
  private rowPanel(y: number): void {
    this.add
      .graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
      .fillRoundedRect(104, y - 15, 436, 30, theme.radius.control)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(104, y - 15, 436, 30, theme.radius.control);
  }

  private replayRow(log: ReplayLog, x: number, y: number, width: number): void {
    const replayable = canReplay(log, CARD_DB);
    const row = this.add.container(0, 0).setAlpha(replayable ? 1 : theme.alpha.subtle);
    row.add(panel(this, x, y, width, 68, { alpha: theme.alpha.subtle, radius: theme.radius.control }));
    const mode = log.context.mode[0].toUpperCase() + log.context.mode.slice(1);
    const result = log.result === 'win' ? 'Victory' : 'Defeat';
    const date = todayString(new Date(log.endedAt));
    row.add(
      this.add
        .text(x + 10, y + 15, log.context.opponentName, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          wordWrap: { width: width - 108 },
        })
        .setOrigin(0, 0.5),
    );
    row.add(
      this.add
        .text(x + 10, y + 38, `${mode} · ${result} · ${log.turns === 1 ? '1 turn' : `${log.turns} turns`} · ${date}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: replayable ? theme.colors.muted : theme.colors.danger,
          wordWrap: { width: width - 20 },
        })
        .setOrigin(0, 0.5),
    );
    if (replayable) {
      const watch = themedButton(this, x + width - 48, y + 15, 'Watch', {
        variant: 'primary',
        size: 'sm',
        minWidth: 78,
        onTap: (p) => {
          if (!p.rightButtonReleased()) this.scene.start('Duel', { replay: log });
        },
      });
      row.add(watch.container);
    } else {
      row.add(
        this.add
          .text(x + 10, y + 57, 'This replay was recorded on an older version.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption - 1}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0, 0.5),
      );
    }
  }
}
