import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import type { ConfirmNoBlockSetting } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { readSignalsGateInput, signalsAllowed } from '../net/signalsGate';
import { qualityTier } from '../platform/quality';
import type { AnimationLevel } from '../platform/animPolicy';
import type { RenderScaleSetting } from '../platform/renderScale';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createStatsPrivacyPanel } from '../ui/StatsPrivacyPanel';
import {
  NO_BLOCK_CHIPS,
  SETTINGS_LEFT_PANEL,
  SETTINGS_RESET_BLOCK,
  yourTurnRowY,
  YOUR_TURN_SECTION,
} from '../ui/settingsPresentation';
import {
  STATS_PANEL_BUTTON_LABEL,
  STATS_ROW_LABEL,
  STATS_SECTION_TITLE,
  STATS_SETTINGS_ROW,
  statsPanelButtonCenterX,
  statsRowNoteKind,
  statsRowNoteState,
  statsRowNoteText,
  toggleShareAnonStats,
} from '../ui/statsPrivacyPresentation';
import { theme } from '../ui/theme';
import { backButton, panel, registerSceneBackNavigation, themedButton, type ModalShell, type ThemedButton } from '../ui/themeWidgets';
import { VERSION_LABEL, checkForUpdate } from '../version';

const SEGMENTS = 10;
const STEP = 0.1;
const LEFT_LABEL_X = 110;
const LEFT_CONTROL_X = 420;
const RIGHT_LABEL_X = 710; // 40px inset from the panel edge at 670, mirroring Audio's 70→110
const RIGHT_CONTROL_X = 1010;
const ROW0_Y = 190;
// Per-row y accumulation: plain rows advance ROW_PITCH; rows that carry a
// caption note() advance ROW_PITCH + NOTE_EXTRA so the caption never crowds
// the next row and the last Gameplay row stays inside its panel
// (user-reported overflow 2026-07-12). Keep every pitch ≥56px (touch-safe).
const ROW_PITCH = 64;
const NOTE_EXTRA = 28;
const rowYs = (notes: readonly boolean[]): number[] => {
  const ys: number[] = [];
  let y = ROW0_Y;
  for (const hasNote of notes) {
    ys.push(y);
    y += ROW_PITCH + (hasNote ? NOTE_EXTRA : 0);
  }
  return ys;
};

const ANIM_CHIPS: { value: AnimationLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'off', label: 'Off' },
];
const RENDER_CHIPS: { value: RenderScaleSetting; label: string; heavy: boolean }[] = [
  { value: 1, label: '1280×720', heavy: false },
  { value: 1.5, label: '1920×1080', heavy: true },
  { value: 2, label: '2560×1440', heavy: true },
];
/** Settings are split into audio and gameplay columns to retain touch-safe row pitch. */
export class SettingsScene extends Phaser.Scene {
  private sfxToggle!: ThemedButton;
  private musicToggle!: ThemedButton;
  private skipToggle!: ThemedButton;
  private confirmToggle!: ThemedButton;
  private keywordToggle!: ThemedButton;
  private instantToggle!: ThemedButton;
  private landDropToggle!: ThemedButton;
  private statsToggle!: ThemedButton;
  private volumeBar!: Phaser.GameObjects.Text;
  private animChips = new Map<AnimationLevel, ThemedButton>();
  private renderChips = new Map<RenderScaleSetting, ThemedButton>();
  private noBlockChips = new Map<ConfirmNoBlockSetting, ThemedButton>();
  /** Every control the "What is sent" panel deadens while it is open. */
  private guardTargets: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();
  private statsPanel: ModalShell | null = null;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.animChips.clear();
    this.renderChips.clear();
    this.noBlockChips.clear();
    this.guardTargets = [];
    this.guard = new ModalGuard();
    this.statsPanel = null;
    applyBackdrop(this, 'mainmenu', {
      dim: theme.graphics.dim,
      dimAlpha: 0.62,
      fallback: () => undefined,
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    this.add
      .text(640, 72, 'Settings', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.trackObject(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    // The left column reaches the title-safe bottom so the Privacy section fits
    // under "Your turn"; the Gameplay column is unchanged, and so is every row
    // in either of them.
    panel(this, SETTINGS_LEFT_PANEL.x, SETTINGS_LEFT_PANEL.y, SETTINGS_LEFT_PANEL.width, SETTINGS_LEFT_PANEL.height);
    panel(this, 670, 124, 540, 470);
    this.sectionTitle(110, 150, 'Audio');
    this.sectionTitle(710, 150, 'Gameplay');
    // Audio: Sound effects · Master volume (note) · Music, then Your turn:
    // Instant cast (note) · Confirm land drop (note), then Privacy:
    // Share anonymous play stats (note) with the "What is sent" panel.
    // Gameplay: Animations (note) · Render size (note) · Auto-skip · Confirm · Keyword reminders.
    const leftRows = rowYs([false, true, false]);
    const rightRows = rowYs([true, true, false, false, false, false]);
    const leftY = (row: number): number => leftRows[row];
    const rightY = (row: number): number => rightRows[row];

    this.rowLabel(LEFT_LABEL_X, leftY(0), 'Sound effects');
    this.sfxToggle = this.toggle(LEFT_CONTROL_X, leftY(0), () => {
      const settings = Services.save.data.settings;
      settings.sfxOn = !settings.sfxOn;
      Services.save.touch();
      this.refreshToggles();
      if (settings.sfxOn) Sfx.play('click');
    });

    this.rowLabel(LEFT_LABEL_X, leftY(1), 'Master volume');
    this.track(
      themedButton(this, LEFT_CONTROL_X - 108, leftY(1), '−', {
        variant: 'ghost',
        size: 'sm',
        minWidth: 44,
        onTap: () => this.stepVolume(-STEP),
      }),
    );
    this.volumeBar = this.add
      .text(LEFT_CONTROL_X - 70, leftY(1), '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    this.track(
      themedButton(this, LEFT_CONTROL_X + 108, leftY(1), '+', {
        variant: 'ghost',
        size: 'sm',
        minWidth: 44,
        onTap: () => this.stepVolume(STEP),
      }),
    );
    this.note(LEFT_LABEL_X, leftY(1) + 28, 'Volume is the master level; music follows it too.');

    this.rowLabel(LEFT_LABEL_X, leftY(2), 'Music');
    this.musicToggle = this.toggle(LEFT_CONTROL_X, leftY(2), () => {
      Music.setEnabled(!Music.enabled);
      this.refreshToggles();
    });

    // The Audio column has spare rows; Gameplay's six already fill its panel.
    // Both rows here decide how a turn's actions get committed, which is why
    // the section is "Your turn" rather than the older Casting-only heading.
    this.sectionTitle(110, YOUR_TURN_SECTION.headingY, 'Your turn');
    const instant = yourTurnRowY(0);
    this.rowLabel(LEFT_LABEL_X, instant.row, 'Instant cast');
    this.instantToggle = this.toggle(LEFT_CONTROL_X, instant.row, () => {
      const settings = Services.save.data.settings;
      settings.instantCast = !settings.instantCast;
      Services.save.touch();
      this.refreshToggles();
    });
    this.note(
      LEFT_LABEL_X,
      instant.note,
      'Casts spells on a single click instead of picking the card up.',
    );

    const landDrop = yourTurnRowY(1);
    this.rowLabel(LEFT_LABEL_X, landDrop.row, 'Confirm land drop');
    this.landDropToggle = this.toggle(LEFT_CONTROL_X, landDrop.row, () => {
      const settings = Services.save.data.settings;
      settings.confirmLandDrop = !settings.confirmLandDrop;
      Services.save.touch();
      this.refreshToggles();
    });
    this.note(
      LEFT_LABEL_X,
      landDrop.note,
      'Ending your turn with a land still unplayed takes a second press.',
    );

    this.rowLabel(RIGHT_LABEL_X, rightY(0), 'Animations');
    let ax = RIGHT_CONTROL_X - 130;
    for (const { value, label } of ANIM_CHIPS) {
      const button = this.track(
        themedButton(this, ax, rightY(0), label, {
          variant: 'ghost',
          size: 'sm',
          minWidth: 82,
          onTap: () => {
            Services.save.data.settings.animations = value;
            Services.save.touch();
            this.refreshChipGroups();
          },
        }),
      );
      this.animChips.set(value, button);
      ax += 90;
    }
    this.note(RIGHT_LABEL_X, rightY(0) + 28, 'Effect changes apply when you next change screens.');

    const lite = qualityTier() === 'lite';
    this.rowLabel(RIGHT_LABEL_X, rightY(1), 'Render size');
    let rx = RIGHT_CONTROL_X - 126;
    for (const { value, label, heavy } of RENDER_CHIPS) {
      const button = this.track(
        themedButton(this, rx, rightY(1), label, {
          variant: 'ghost',
          size: 'sm',
          minWidth: 84,
          enabled: !(lite && heavy),
          onTap: () => this.pickRenderScale(value),
        }),
      );
      this.renderChips.set(value, button);
      rx += 92;
    }
    this.note(
      RIGHT_LABEL_X,
      rightY(1) + 28,
      lite
        ? 'High resolutions are disabled on this device.'
        : 'Resizes the desktop window and reloads to apply.',
    );

    this.rowLabel(RIGHT_LABEL_X, rightY(2), 'Auto-skip forced turns');
    this.skipToggle = this.toggle(RIGHT_CONTROL_X, rightY(2), () => {
      const settings = Services.save.data.settings;
      settings.autoSkip = !settings.autoSkip;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, rightY(3), 'Confirm destructive actions');
    this.confirmToggle = this.toggle(RIGHT_CONTROL_X, rightY(3), () => {
      const settings = Services.save.data.settings;
      settings.confirmDestructive = !settings.confirmDestructive;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, rightY(4), 'Keyword reminders');
    this.keywordToggle = this.toggle(RIGHT_CONTROL_X, rightY(4), () => {
      const settings = Services.save.data.settings;
      settings.keywordReminders = !settings.keywordReminders;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, rightY(5), 'Confirm no-block');
    for (const { value, label, minWidth, x } of NO_BLOCK_CHIPS) {
      const button = this.track(
        themedButton(this, x, rightY(5), label, {
          variant: 'ghost',
          size: 'sm',
          minWidth,
          onTap: () => {
            Services.save.data.settings.confirmNoBlock = value;
            Services.save.touch();
            this.refreshChipGroups();
          },
        }),
      );
      this.noBlockChips.set(value, button);
    }

    this.buildPrivacy();
    this.buildReset();
    this.buildVersionFooter();
    this.refreshToggles();
    this.refreshChipGroups();
    this.refreshVolume();
  }

  private sectionTitle(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
  }
  private rowLabel(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
  }
  private note(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
  }
  private toggle(x: number, y: number, onTap: () => void): ThemedButton {
    return this.track(themedButton(this, x, y, 'Off', { variant: 'ghost', size: 'sm', minWidth: 90, onTap }));
  }
  /** Remember a control so the "What is sent" panel can deaden it. */
  private track(button: ThemedButton): ThemedButton {
    this.guardTargets.push(button.inputZone);
    return button;
  }
  private trackObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.guardTargets.push(object);
    return object;
  }

  /**
   * The Privacy section: the saved sharing choice, what it means, and the panel
   * that lists every field. The row's caption explains why nothing is being
   * sent when something OTHER than this toggle is the reason, and the toggle
   * itself always shows and edits the saved choice either way, so a player
   * whose browser is refusing on their behalf can still see what they chose.
   */
  private buildPrivacy(): void {
    this.sectionTitle(LEFT_LABEL_X, STATS_SETTINGS_ROW.sectionTitleY, STATS_SECTION_TITLE);
    this.rowLabel(STATS_SETTINGS_ROW.labelX, STATS_SETTINGS_ROW.rowY, STATS_ROW_LABEL);
    this.statsToggle = this.toggle(STATS_SETTINGS_ROW.toggleX, STATS_SETTINGS_ROW.rowY, () => {
      toggleShareAnonStats(Services.save.data.settings);
      Services.save.touch();
      this.refreshToggles();
    });
    // Measure-then-place: the label's rendered width is font-fallback dependent
    // on Windows, so the button is built and then asked where it fits.
    const panelButton = this.track(
      themedButton(this, STATS_SETTINGS_ROW.buttonRightX, STATS_SETTINGS_ROW.rowY, STATS_PANEL_BUTTON_LABEL, {
        variant: 'ghost',
        size: 'sm',
        minWidth: STATS_SETTINGS_ROW.buttonMinWidth,
        onTap: () => this.openStatsPanel(),
      }),
    );
    panelButton.container.setX(statsPanelButtonCenterX(panelButton.getMeasuredSize().hit.width));

    // The gate decides, not this scene: `signalsAllowed` is handed in whole.
    const note = statsRowNoteText(statsRowNoteKind(statsRowNoteState(readSignalsGateInput(null), signalsAllowed)));
    this.add
      .text(STATS_SETTINGS_ROW.labelX, STATS_SETTINGS_ROW.noteTopY, note, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        wordWrap: { width: STATS_SETTINGS_ROW.noteWrapWidth },
        lineSpacing: 2,
      })
      .setOrigin(0, 0);
  }

  private openStatsPanel(): void {
    if (this.statsPanel) return;
    const shell = createStatsPrivacyPanel(this, this.guard, this.guardTargets);
    this.statsPanel = shell;
    shell.container.once('destroy', () => {
      if (this.statsPanel === shell) this.statsPanel = null;
    });
  }

  private buildReset(): void {
    this.add
      .text(SETTINGS_RESET_BLOCK.labelX, SETTINGS_RESET_BLOCK.rowY, 'Reset save', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.danger,
      })
      .setOrigin(0, 0.5);
    const reset = this.track(
      themedButton(this, SETTINGS_RESET_BLOCK.buttonX, SETTINGS_RESET_BLOCK.rowY, 'Reset save', {
        variant: 'danger',
        minWidth: SETTINGS_RESET_BLOCK.buttonMinWidth,
        onTap: () => {
          if (reset.label.text !== 'Tap again to erase everything') {
            reset.setLabel('Tap again to erase everything');
            reset.setVariant('danger');
            this.time.delayedCall(4000, () => {
              if (reset.container.active && reset.label.text === 'Tap again to erase everything')
                reset.setLabel('Reset save');
            });
            return;
          }
          Services.save.reset();
          window.location.reload();
        },
      }),
    );
    this.add.text(
      SETTINGS_RESET_BLOCK.labelX,
      SETTINGS_RESET_BLOCK.captionY,
      'Erases your collection, decks, gold, and progress. Cannot be undone.',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      },
    );
  }
  private buildVersionFooter(): void {
    this.add
      .text(14, 702, VERSION_LABEL, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const status = this.add
      .text(640, 702, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    this.track(themedButton(this, 1180, 690, 'Check for updates', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 150,
      onTap: () => {
        status.setText('Checking…').setColor(theme.colors.muted);
        void checkForUpdate().then((result) => {
          if (!status.active) return;
          status
            .setText(result.message)
            .setColor(
              result.state === 'available'
                ? theme.colors.gold
                : result.state === 'error'
                  ? theme.colors.danger
                  : theme.colors.success,
            );
        });
      },
    }));
  }
  private stepVolume(delta: number): void {
    Sfx.setVolume(Sfx.volume + delta);
    this.refreshVolume();
    Sfx.play('click');
  }
  private refreshVolume(): void {
    const filled = Math.round(Sfx.volume * SEGMENTS);
    this.volumeBar
      .setText('▰'.repeat(filled) + '▱'.repeat(SEGMENTS - filled))
      .setColor(filled <= 0 ? theme.colors.muted : theme.colors.body);
  }
  private refreshToggles(): void {
    const settings = Services.save.data.settings;
    for (const [button, on] of [
      [this.sfxToggle, settings.sfxOn],
      [this.musicToggle, settings.musicOn],
      [this.skipToggle, settings.autoSkip],
      [this.confirmToggle, settings.confirmDestructive],
      [this.keywordToggle, settings.keywordReminders],
      [this.instantToggle, settings.instantCast],
      [this.landDropToggle, settings.confirmLandDrop],
      // Always the SAVED choice, even when a browser signal or a dev build is
      // what is actually stopping the sends. The caption explains that; the
      // toggle stays the player's own answer.
      [this.statsToggle, settings.shareAnonStats],
    ] as const) {
      button.setLabel(on ? 'On' : 'Off');
      button.setVariant(on ? 'primary' : 'ghost');
    }
  }
  private refreshChipGroups(): void {
    const settings = Services.save.data.settings;
    for (const [value, button] of this.animChips)
      button.setVariant(value === settings.animations ? 'primary' : 'ghost');
    const effectiveRender = qualityTier() === 'lite' ? 1 : settings.renderScale;
    for (const [value, button] of this.renderChips)
      button.setVariant(value === effectiveRender ? 'primary' : 'ghost');
    for (const [value, button] of this.noBlockChips)
      button.setVariant(value === settings.confirmNoBlock ? 'primary' : 'ghost');
  }
  private pickRenderScale(value: RenderScaleSetting): void {
    if (Services.save.data.settings.renderScale === value) return;
    Services.save.data.settings.renderScale = value;
    Services.save.flush();
    window.location.reload();
  }
}
