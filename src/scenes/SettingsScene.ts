import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Services } from '../meta/services';
import { qualityTier } from '../platform/quality';
import type { AnimationLevel } from '../platform/animPolicy';
import type { RenderScaleSetting } from '../platform/renderScale';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { backButton, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';
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
  private volumeBar!: Phaser.GameObjects.Text;
  private animChips = new Map<AnimationLevel, ThemedButton>();
  private renderChips = new Map<RenderScaleSetting, ThemedButton>();

  constructor() {
    super('Settings');
  }

  create(): void {
    this.animChips.clear();
    this.renderChips.clear();
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
    backButton(this, () => this.scene.start('MainMenu'));

    panel(this, 70, 124, 540, 420);
    panel(this, 670, 124, 540, 420);
    this.sectionTitle(110, 150, 'Audio');
    this.sectionTitle(710, 150, 'Gameplay');
    // Audio: Sound effects · Master volume (note) · Music.
    // Gameplay: Animations (note) · Render size (note) · Auto-skip · Confirm · Keyword reminders.
    const leftRows = rowYs([false, true, false]);
    const rightRows = rowYs([true, true, false, false, false]);
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
    themedButton(this, LEFT_CONTROL_X - 108, leftY(1), '−', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 44,
      onTap: () => this.stepVolume(-STEP),
    });
    this.volumeBar = this.add
      .text(LEFT_CONTROL_X - 70, leftY(1), '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    themedButton(this, LEFT_CONTROL_X + 108, leftY(1), '+', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 44,
      onTap: () => this.stepVolume(STEP),
    });
    this.note(LEFT_LABEL_X, leftY(1) + 28, 'Volume is the master level; music follows it too.');

    this.rowLabel(LEFT_LABEL_X, leftY(2), 'Music');
    this.musicToggle = this.toggle(LEFT_CONTROL_X, leftY(2), () => {
      Music.setEnabled(!Music.enabled);
      this.refreshToggles();
    });

    this.rowLabel(RIGHT_LABEL_X, rightY(0), 'Animations');
    let ax = RIGHT_CONTROL_X - 130;
    for (const { value, label } of ANIM_CHIPS) {
      const button = themedButton(this, ax, rightY(0), label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 82,
        onTap: () => {
          Services.save.data.settings.animations = value;
          Services.save.touch();
          this.refreshChipGroups();
        },
      });
      this.animChips.set(value, button);
      ax += 90;
    }
    this.note(RIGHT_LABEL_X, rightY(0) + 28, 'Effect changes apply when you next change screens.');

    const lite = qualityTier() === 'lite';
    this.rowLabel(RIGHT_LABEL_X, rightY(1), 'Render size');
    let rx = RIGHT_CONTROL_X - 126;
    for (const { value, label, heavy } of RENDER_CHIPS) {
      const button = themedButton(this, rx, rightY(1), label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 84,
        enabled: !(lite && heavy),
        onTap: () => this.pickRenderScale(value),
      });
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
    return themedButton(this, x, y, 'Off', { variant: 'ghost', size: 'sm', minWidth: 90, onTap });
  }
  private buildReset(): void {
    this.add
      .text(110, 570, 'Reset save', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.danger,
      })
      .setOrigin(0, 0.5);
    const reset = themedButton(this, 360, 570, 'Reset save', {
      variant: 'danger',
      minWidth: 170,
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
    });
    this.add.text(
      110,
      600,
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
    themedButton(this, 1180, 690, 'Check for updates', {
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
    });
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
  }
  private pickRenderScale(value: RenderScaleSetting): void {
    if (Services.save.data.settings.renderScale === value) return;
    Services.save.data.settings.renderScale = value;
    Services.save.flush();
    window.location.reload();
  }
}
