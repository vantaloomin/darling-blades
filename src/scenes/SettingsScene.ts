import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import type { ConfirmNoBlockSetting } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { readSignalsGateInput, signalsAllowed } from '../net/signalsGate';
import { qualityTier } from '../platform/quality';
import type { AnimationLevel } from '../platform/animPolicy';
import type { RenderScaleSetting } from '../platform/renderScale';
import { createLegalPanel } from '../ui/LegalPanel';
import { LEGAL_BUTTON_LABEL } from '../ui/legalPresentation';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createStatsPrivacyPanel } from '../ui/StatsPrivacyPanel';
import {
  ANIM_CHIP_WIDTH,
  ANIM_CHIP_X,
  NO_BLOCK_CHIPS,
  RENDER_CHIP_WIDTH,
  RENDER_CHIP_X,
  RIGHT_TOGGLE_X,
  SETTINGS_COLUMNS,
  SETTINGS_HEADER_ACTION,
  SETTINGS_HEADER_LEGAL,
  SETTINGS_LEFT,
  SETTINGS_LEFT_PANEL,
  SETTINGS_LEFT_SECTIONS,
  SETTINGS_PANELS,
  SETTINGS_RESET_BLOCK,
  SETTINGS_RIGHT,
  SETTINGS_RIGHT_SECTIONS,
  settingsHeaderCenters,
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
// Every position below comes from src/ui/settingsPresentation.ts: one rhythm
// for both columns, derived from the design-system tokens. Nothing in this
// file carries a coordinate of its own any more.
const LEFT_LABEL_X = SETTINGS_COLUMNS.left.labelX;
const LEFT_CONTROL_X = SETTINGS_COLUMNS.left.controlX;
const RIGHT_LABEL_X = SETTINGS_COLUMNS.right.labelX;
const L = SETTINGS_LEFT;
const R = SETTINGS_RIGHT;

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
  private legalPanel: ModalShell | null = null;

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
    this.legalPanel = null;
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

    // Two equal panels to the title-safe bottom; every heading and row in each
    // comes from the shared rhythm (settingsPresentation.ts), which is what
    // keeps the isolation space between sections the same on both sides.
    panel(this, SETTINGS_LEFT_PANEL.x, SETTINGS_LEFT_PANEL.y, SETTINGS_LEFT_PANEL.width, SETTINGS_LEFT_PANEL.height);
    panel(this, SETTINGS_PANELS.right.x, SETTINGS_PANELS.top, SETTINGS_PANELS.right.width, SETTINGS_PANELS.bottom - SETTINGS_PANELS.top);
    for (const section of SETTINGS_LEFT_SECTIONS) {
      if (section.key !== 'privacy') this.sectionTitle(LEFT_LABEL_X, L.headings[section.key], section.title);
    }
    for (const section of SETTINGS_RIGHT_SECTIONS) {
      this.sectionTitle(RIGHT_LABEL_X, R.headings[section.key], section.title);
    }

    this.rowLabel(LEFT_LABEL_X, L.rows.sfx.row, 'Sound effects');
    this.sfxToggle = this.toggle(LEFT_CONTROL_X, L.rows.sfx.row, () => {
      const settings = Services.save.data.settings;
      settings.sfxOn = !settings.sfxOn;
      Services.save.touch();
      this.refreshToggles();
      if (settings.sfxOn) Sfx.play('click');
    });

    this.rowLabel(LEFT_LABEL_X, L.rows.volume.row, 'Master volume');
    this.track(
      themedButton(this, LEFT_CONTROL_X - 108, L.rows.volume.row, '−', {
        variant: 'ghost',
        size: 'sm',
        minWidth: 44,
        onTap: () => this.stepVolume(-STEP),
      }),
    );
    this.volumeBar = this.add
      .text(LEFT_CONTROL_X - 70, L.rows.volume.row, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    this.track(
      themedButton(this, LEFT_CONTROL_X + 108, L.rows.volume.row, '+', {
        variant: 'ghost',
        size: 'sm',
        minWidth: 44,
        onTap: () => this.stepVolume(STEP),
      }),
    );
    this.note(LEFT_LABEL_X, L.rows.volume.note, 'Volume is the master level; music follows it too.');

    this.rowLabel(LEFT_LABEL_X, L.rows.music.row, 'Music');
    this.musicToggle = this.toggle(LEFT_CONTROL_X, L.rows.music.row, () => {
      Music.setEnabled(!Music.enabled);
      this.refreshToggles();
    });

    // Both rows here decide how a turn's actions get committed, which is why
    // the section is "Your turn" rather than the older Casting-only heading.
    const instant = L.rows.instantCast;
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

    const landDrop = L.rows.landDrop;
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

    this.rowLabel(RIGHT_LABEL_X, R.rows.animations.row, 'Animations');
    ANIM_CHIPS.forEach(({ value, label }, i) => {
      const button = this.track(
        themedButton(this, ANIM_CHIP_X[i], R.rows.animations.row, label, {
          variant: 'ghost',
          size: 'sm',
          minWidth: ANIM_CHIP_WIDTH,
          onTap: () => {
            Services.save.data.settings.animations = value;
            Services.save.touch();
            this.refreshChipGroups();
          },
        }),
      );
      this.animChips.set(value, button);
    });
    this.note(RIGHT_LABEL_X, R.rows.animations.note, 'Effect changes apply when you next change screens.');

    const lite = qualityTier() === 'lite';
    this.rowLabel(RIGHT_LABEL_X, R.rows.renderSize.row, 'Render size');
    RENDER_CHIPS.forEach(({ value, label, heavy }, i) => {
      const button = this.track(
        themedButton(this, RENDER_CHIP_X[i], R.rows.renderSize.row, label, {
          variant: 'ghost',
          size: 'sm',
          minWidth: RENDER_CHIP_WIDTH,
          enabled: !(lite && heavy),
          onTap: () => this.pickRenderScale(value),
        }),
      );
      this.renderChips.set(value, button);
    });
    this.note(
      RIGHT_LABEL_X,
      R.rows.renderSize.note,
      lite
        ? 'High resolutions are disabled on this device.'
        : 'Resizes the desktop window and reloads to apply.',
    );

    this.rowLabel(RIGHT_LABEL_X, R.rows.autoSkip.row, 'Auto-skip forced turns');
    this.skipToggle = this.toggle(RIGHT_TOGGLE_X, R.rows.autoSkip.row, () => {
      const settings = Services.save.data.settings;
      settings.autoSkip = !settings.autoSkip;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, R.rows.confirmDestructive.row, 'Confirm destructive actions');
    this.confirmToggle = this.toggle(RIGHT_TOGGLE_X, R.rows.confirmDestructive.row, () => {
      const settings = Services.save.data.settings;
      settings.confirmDestructive = !settings.confirmDestructive;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, R.rows.keywordReminders.row, 'Keyword reminders');
    this.keywordToggle = this.toggle(RIGHT_TOGGLE_X, R.rows.keywordReminders.row, () => {
      const settings = Services.save.data.settings;
      settings.keywordReminders = !settings.keywordReminders;
      Services.save.touch();
      this.refreshToggles();
    });
    this.rowLabel(RIGHT_LABEL_X, R.rows.noBlock.row, 'Confirm no-block');
    for (const { value, label, minWidth, x } of NO_BLOCK_CHIPS) {
      const button = this.track(
        themedButton(this, x, R.rows.noBlock.row, label, {
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

  private openLegalPanel(): void {
    if (this.legalPanel) return;
    const shell = createLegalPanel(this, this.guard, this.guardTargets);
    this.legalPanel = shell;
    shell.container.once('destroy', () => {
      if (this.legalPanel === shell) this.legalPanel = null;
    });
  }

  /**
   * The right column's last row, under its own "Save data" heading. The row
   * label names the setting and the button names the action, the way every
   * other row here reads; the armed state still spells out the consequence.
   * Right-aligned to the column's control edge like the toggles above it,
   * measure-then-place because the armed label is wider than the resting one.
   */
  private buildReset(): void {
    this.rowLabel(SETTINGS_RESET_BLOCK.labelX, SETTINGS_RESET_BLOCK.rowY, 'Reset save');
    const reset = this.track(
      themedButton(this, SETTINGS_RESET_BLOCK.buttonRight, SETTINGS_RESET_BLOCK.rowY, 'Reset', {
        variant: 'danger',
        minWidth: SETTINGS_RESET_BLOCK.buttonMinWidth,
        onTap: () => {
          if (reset.label.text !== 'Tap again to erase everything') {
            reset.setLabel('Tap again to erase everything');
            reset.setVariant('danger');
            reset.container.setX(SETTINGS_RESET_BLOCK.buttonRight - reset.getMeasuredSize().hit.width / 2);
            this.time.delayedCall(4000, () => {
              if (reset.container.active && reset.label.text === 'Tap again to erase everything') {
                reset.setLabel('Reset');
                reset.container.setX(SETTINGS_RESET_BLOCK.buttonRight - reset.getMeasuredSize().hit.width / 2);
              }
            });
            return;
          }
          Services.save.reset();
          window.location.reload();
        },
      }),
    );
    reset.container.setX(SETTINGS_RESET_BLOCK.buttonRight - reset.getMeasuredSize().hit.width / 2);
    this.note(
      SETTINGS_RESET_BLOCK.labelX,
      SETTINGS_RESET_BLOCK.captionY,
      'Erases your collection, decks, gold, and progress. Cannot be undone.',
    );
  }
  /**
   * The version stays in the corner outside the title-safe frame (expendable
   * by the design system's rule); the update check is a control, so it sits
   * in the header at the right, mirroring the back button, with its status
   * line under it. "Legal" sits beside it, one isolation gap to its left:
   * both are about the whole game rather than any one setting, and the pair is
   * placed from its measured widths so neither label's font fallback can push
   * it past the title-safe edge or into the centred title.
   */
  private buildVersionFooter(): void {
    this.add
      .text(14, 702, VERSION_LABEL, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const status = this.add
      .text(SETTINGS_HEADER_ACTION.right, SETTINGS_HEADER_ACTION.statusY, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0.5);
    const check = this.track(themedButton(this, SETTINGS_HEADER_ACTION.right, SETTINGS_HEADER_ACTION.y, 'Check for updates', {
      variant: 'ghost',
      size: 'sm',
      minWidth: SETTINGS_HEADER_ACTION.minWidth,
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
    const legal = this.track(
      themedButton(this, SETTINGS_HEADER_ACTION.right, SETTINGS_HEADER_LEGAL.y, LEGAL_BUTTON_LABEL, {
        variant: 'ghost',
        size: 'sm',
        minWidth: SETTINGS_HEADER_LEGAL.minWidth,
        onTap: () => this.openLegalPanel(),
      }),
    );
    const centers = settingsHeaderCenters(
      legal.getMeasuredSize().hit.width,
      check.getMeasuredSize().hit.width,
    );
    legal.container.setX(centers.legalX);
    check.container.setX(centers.updateX);
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
