import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { ACHIEVEMENTS, type AchievementDef } from '../meta/Achievements';
import { todayString } from '../meta/Economy';
import { computeProfile, formatRate, type Difficulty } from '../meta/profileStats';
import { canReplay, type ReplayLog } from '../meta/Replay';
import { decode, encode, type SaveCodePreview } from '../meta/SaveCode';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { modalGuardTarget } from '../ui/Modal';
import { isReplayVisible } from '../ui/deckBuilderHelpers';
import { OverlayCoordinator } from '../ui/OverlayCoordinator';
import { createMultilineInput, type MultilineInputHandle } from '../ui/MultilineInput';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import {
  backButton,
  modalShell,
  panel,
  themedButton,
  type ModalShell,
  type ThemedButton,
} from '../ui/themeWidgets';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks and the persisted deterministic replay reel.
 * Nothing rendered here mutates the save.
 */
export class ProfileScene extends Phaser.Scene {
  private coordinator!: OverlayCoordinator;
  private profileInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private exportShell: ModalShell | null = null;
  private exportInput: MultilineInputHandle | null = null;
  private importShell: ModalShell | null = null;
  private importInput: MultilineInputHandle | null = null;
  private importStatus: Phaser.GameObjects.Text | null = null;
  private importInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private confirmationShell: ModalShell | null = null;
  private reserveFormatsEnabled = false;

  constructor() {
    super('Profile');
  }

  create(data: { notice?: string } = {}): void {
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.coordinator = new OverlayCoordinator();
    this.profileInteractiveTargets = [];
    this.exportShell = null;
    this.exportInput = null;
    this.importShell = null;
    this.importInput = null;
    this.importStatus = null;
    this.importInteractiveTargets = [];
    this.confirmationShell = null;
    this.input.keyboard?.on('keydown-ESC', this.onEscKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

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

    const exportButton = themedButton(this, 900, 112, 'Export save', {
      variant: 'primary',
      minWidth: 160,
      onTap: () => this.openExportModal(),
    });
    const importButton = themedButton(this, 1080, 112, 'Import save', {
      variant: 'emphasis',
      minWidth: 160,
      onTap: () => this.openImportModal(),
    });
    this.profileInteractiveTargets.push(exportButton.inputZone, importButton.inputZone);

    if (data.notice) {
      this.add
        .text(640, 174, data.notice, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.success,
        })
        .setOrigin(0.5);
    }

    this.drawShowcase();

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
    const replays = Services.save.data.replays
      .filter((log) => isReplayVisible(log, this.reserveFormatsEnabled))
      .slice(0, 10);
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

    this.profileInteractiveTargets.push(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
  }

  private readonly onEscKey = (): void => {
    if (this.coordinator.dispatchEsc().consumed) return;
    this.scene.start('MainMenu');
  };

  private readonly onShutdown = (): void => {
    this.exportShell?.close();
    this.importShell?.close();
    this.confirmationShell?.close();
    this.exportInput?.destroy();
    this.importInput?.destroy();
    this.coordinator.destroy();
    this.input.keyboard?.off('keydown-ESC', this.onEscKey);
  };

  /**
   * encode() throws RangeError past MAX_DECODED_SAVE_BYTES. REPLAY_CAP keeps
   * real profiles far below it, but a throw here would crash a tap handler,
   * so degrade to a status message instead.
   */
  private tryEncode(includeReplays: boolean): string | null {
    try {
      return encode(Services.save.data, { includeReplays });
    } catch {
      return null;
    }
  }

  private openExportModal(): void {
    this.importShell?.close();
    this.exportShell?.close();

    let includeReplays = false;
    let code = this.tryEncode(false) ?? '';
    const shell = modalShell(this, {
      width: 1120,
      height: 620,
      dimAlpha: 0.86,
      depth: theme.depth.modal,
      tapDimToClose: true,
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.profileInteractiveTargets.map(modalGuardTarget),
      },
      onClose: () => {
        this.exportInput?.destroy();
        this.exportInput = null;
        this.exportShell = null;
      },
    });
    this.exportShell = shell;
    const c = shell.container;
    c.add(
      this.add
        .text(640, 88, 'Export save', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );

    const input = createMultilineInput(this, 640, 310, {
      width: 930,
      height: 260,
      accessibleName: 'Save export code',
      readOnly: true,
    });
    this.exportInput = input;
    input.setValue(code);

    const status = this.add
      .text(640, 470, 'Replays are excluded by default.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(status);
    if (code === '') {
      status.setColor(theme.colors.danger).setText('This profile is too large to export as a code.');
    }
    c.add(
      this.add
        .text(640, 515, 'Keep this code private. It contains your collection, decks, progress, settings, and match record.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          wordWrap: { width: 900 },
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const includeButton = themedButton(this, 420, 600, 'Include replays: Off', {
      variant: 'ghost',
      minWidth: 210,
      onTap: () => {
        const next = this.tryEncode(!includeReplays);
        if (next === null) {
          status.setColor(theme.colors.danger).setText('Replays make this code too large. Replays stay excluded.');
          return;
        }
        includeReplays = !includeReplays;
        code = next;
        input.setValue(code);
        includeButton.setLabel(`Include replays: ${includeReplays ? 'On' : 'Off'}`);
        status.setColor(theme.colors.muted).setText(includeReplays ? 'Replays are included in this code.' : 'Replays are excluded from this code.');
      },
    });
    const copyButton = themedButton(this, 860, 600, 'Copy', {
      variant: 'primary',
      minWidth: 120,
      onTap: () => void this.copyExportCode(input, code, status),
    });
    c.add([includeButton.container, copyButton.container]);
  }

  private async copyExportCode(
    input: MultilineInputHandle,
    code: string,
    status: Phaser.GameObjects.Text,
  ): Promise<void> {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      status.setColor(theme.colors.success).setText('Copied to clipboard');
    } catch {
      input.focus();
      input.select();
      status
        .setColor(theme.colors.danger)
        .setText('Copy failed. The code is still selectable. Copy it manually.');
    }
  }

  private openImportModal(): void {
    this.exportShell?.close();
    this.importShell?.close();

    let decodedSave: SaveData | null = null;
    let previewText: Phaser.GameObjects.Text | null = null;
    let previewButton: ThemedButton | null = null;
    const shell = modalShell(this, {
      width: 1120,
      height: 640,
      dimAlpha: 0.86,
      depth: theme.depth.modal,
      tapDimToClose: true,
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.profileInteractiveTargets.map(modalGuardTarget),
      },
      onClose: () => {
        this.importInput?.destroy();
        this.importInput = null;
        this.importStatus = null;
        this.importInteractiveTargets = [];
        this.importShell = null;
      },
    });
    this.importShell = shell;
    const c = shell.container;
    c.add(
      this.add
        .text(640, 78, 'Import save', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    const status = this.add
      .text(640, 444, 'Paste a save code, then choose Preview save.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    this.importStatus = status;

    const input = createMultilineInput(this, 640, 270, {
      width: 930,
      height: 220,
      accessibleName: 'Save import code',
      placeholder: 'DBS1-...',
      onChange: () => {
        decodedSave = null;
        previewText?.destroy();
        previewText = null;
        previewButton?.setEnabled(false);
        status.setColor(theme.colors.muted).setText('Paste a save code, then choose Preview save.');
      },
    });
    this.importInput = input;

    const validateButton = themedButton(this, 410, 590, 'Preview save', {
      variant: 'primary',
      minWidth: 170,
      onTap: () => {
        const result = decode(input.getValue());
        if (!result.ok) {
          decodedSave = null;
          previewText?.destroy();
          previewText = null;
          previewButton?.setEnabled(false);
          status.setColor(theme.colors.danger).setText(result.error.message);
          return;
        }
        decodedSave = result.save;
        previewText?.destroy();
        previewText = this.add
          .text(105, 468, this.formatSavePreview(result.preview), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
            lineSpacing: 3,
          })
          .setOrigin(0, 0);
        c.add(previewText);
        previewButton?.setEnabled(true);
        status.setColor(theme.colors.success).setText('Save code is valid. Review the profile before replacing it.');
      },
    });
    previewButton = themedButton(this, 850, 590, 'Replace save', {
      variant: 'danger',
      minWidth: 180,
      enabled: false,
      onTap: () => {
        if (decodedSave) this.openImportConfirmation(decodedSave);
      },
    });
    c.add([validateButton.container, previewButton.container]);
    this.importInteractiveTargets = [...shell.interactiveChildren, validateButton.inputZone, previewButton.inputZone];
    input.focus();
  }

  private openImportConfirmation(save: SaveData): void {
    this.confirmationShell?.close();
    const shell = modalShell(this, {
      width: 820,
      height: 300,
      dimAlpha: 0.9,
      depth: theme.depth.results,
      tapDimToClose: false,
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.importInteractiveTargets.map(modalGuardTarget),
        domHandles: this.importInput ? [this.importInput] : [],
      },
      onClose: () => {
        this.confirmationShell = null;
      },
    });
    this.confirmationShell = shell;
    const c = shell.container;
    c.add(
      this.add
        .text(640, 120, "Replace this device's save? Your current profile will be overwritten. Export it first if you may want it back.", {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.body,
          wordWrap: { width: 650 },
          align: 'center',
          lineSpacing: 5,
        })
        .setOrigin(0.5),
    );
    const cancelButton = themedButton(this, 490, 245, 'Cancel', {
      variant: 'ghost',
      minWidth: 120,
      onTap: () => shell.close(),
    });
    const confirmButton = themedButton(this, 790, 245, 'Replace save', {
      variant: 'danger',
      minWidth: 170,
      onTap: () => {
        if (!Services.replaceSave(save)) {
          shell.close();
          this.importStatus
            ?.setColor(theme.colors.danger)
            .setText('Save import failed. Your current profile was restored because storage failed.');
          return;
        }
        shell.close();
        this.importShell?.close();
        this.scene.restart({ notice: 'Save imported' });
      },
    });
    c.add([cancelButton.container, confirmButton.container]);
  }

  private formatSavePreview(preview: SaveCodePreview): string {
    return [
      `Creation date: ${new Date(preview.creationDate).toLocaleString()}`,
      `Collection: ${preview.collectionCount.toLocaleString('en-US')} copies (${preview.collectionDistinctCount.toLocaleString('en-US')} distinct cards)`,
      `Gold: ${preview.gold.toLocaleString('en-US')}g`,
      `Decks: ${preview.deckCount}`,
      `Progress: ${preview.progressSummary.wins} W / ${preview.progressSummary.losses} L. Best gauntlet rung ${preview.progressSummary.bestGauntletRung}. Full clears ${preview.progressSummary.gauntletCompletions}.`,
      `Source schema: v${preview.sourceSchemaVersion}`,
      `Replays present: ${preview.replaysPresent ? 'Yes' : 'No'}`,
    ].join('\n');
  }

  /**
   * Trophy Hall showcase: up to three pinned, claimed achievements as tilted
   * seal plaques in the header's left void. Renders nothing when nothing is
   * pinned, so the header stays clean for new players.
   */
  private drawShowcase(): void {
    const achievements = Services.save.data.achievements;
    const pins = achievements.pinned
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((achievement): achievement is AchievementDef =>
        !!achievement && achievements.claimed.includes(achievement.id),
      )
      .slice(0, 3);
    if (pins.length === 0) return;
    this.add
      .text(100, 78, 'Showcase', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    pins.forEach((achievement, index) => {
      const seal = this.add.container(172 + index * 160, 120).setAngle(-3);
      const plate = this.add.graphics();
      plate.fillStyle(theme.graphics.panelFill, 0.96);
      plate.fillRoundedRect(-74, -24, 148, 48, theme.radius.control);
      plate.lineStyle(2, colorInt(theme.colors.success), 0.95);
      plate.strokeRoundedRect(-74, -24, 148, 48, theme.radius.control);
      plate.lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome);
      plate.strokeRoundedRect(-70, -20, 140, 40, theme.radius.control - 2);
      const title = this.add
        .text(0, -8, '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0.5);
      title.setText(achievement.title);
      while (title.width > 132 && title.text.length > 1) {
        title.setText(`${title.text.slice(0, -2).trimEnd()}…`);
      }
      const label = this.add
        .text(0, 12, 'CLAIMED', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.success,
        })
        .setOrigin(0.5);
      seal.add([plate, title, label]);
    });
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
      this.profileInteractiveTargets.push(watch.inputZone);
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
