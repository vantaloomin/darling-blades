import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import { RARITY_NAMES } from '../data/glossary';
import { ACHIEVEMENTS, type AchievementDef } from '../meta/Achievements';
import { ownedCount } from '../meta/Collection';
import { todayString } from '../meta/Economy';
import { collectionCompletion, matchesSearch } from '../meta/collectionFilter';
import { embedSaveCode, readSaveCode, saveImageFilename } from '../meta/SaveImage';
import {
  DECK_STYLE_LABEL,
  computeDraftSummary,
  computeProfile,
  formatRate,
  type Difficulty,
} from '../meta/profileStats';
import { canReplay, type ReplayLog } from '../meta/Replay';
import { decode, encode, type SaveCodePreview } from '../meta/SaveCode';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { modalGuardTarget } from '../ui/Modal';
import { isReplayVisible } from '../ui/deckBuilderHelpers';
import { OverlayCoordinator } from '../ui/OverlayCoordinator';
import { createMultilineInput, type MultilineInputHandle } from '../ui/MultilineInput';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { makeCardThumb } from '../ui/CardThumbCache';
import { canvasPngBytes, composeSaveCardCanvas, downloadPngBytes, pickPngFile } from '../ui/saveCard';
import { colorInt, theme } from '../ui/theme';
import {
  backButton,
  modalShell,
  pager,
  panel,
  themedButton,
  type ModalShell,
  type ThemedButton,
} from '../ui/themeWidgets';
import { bindTapButton } from '../platform/gestures';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Shared geometry for the left-column list rows. The text insets exist because
 * the row fill and the row text were both hardcoded to the panel's own edges
 * (104 and 540), so every label and value sat flush against the border with no
 * isolation space. Derive both from these instead of repeating the numbers.
 */
const ROW_X = 104;
const ROW_W = 436;
const ROW_INSET = theme.space(3);
const ROW_TEXT_LEFT = ROW_X + ROW_INSET;
const ROW_TEXT_RIGHT = ROW_X + ROW_W - ROW_INSET;


/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks and the persisted deterministic replay reel.
 * Nothing rendered here mutates the save.
 */
/** Left-panel stat tabs (1.6.3). */
export type ProfileStatTab = 'practice' | 'gauntlet' | 'draft' | 'collection';

export class ProfileScene extends Phaser.Scene {
  private statTab: ProfileStatTab = 'practice';
  /** Everything the active tab drew, cleared on each tab switch. */
  private statTabNodes: Phaser.GameObjects.GameObject[] = [];
  private coordinator!: OverlayCoordinator;
  private profileInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private exportShell: ModalShell | null = null;
  private exportInput: MultilineInputHandle | null = null;
  private exportStatus: Phaser.GameObjects.Text | null = null;
  private exportInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private pickerShell: ModalShell | null = null;
  private pickerSearch: SearchInputHandle | null = null;
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
    this.exportStatus = null;
    this.exportInteractiveTargets = [];
    this.pickerShell = null;
    this.pickerSearch = null;
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

    this.renderStatTabs();

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
    this.pickerShell?.close();
    this.exportShell?.close();
    this.importShell?.close();
    this.confirmationShell?.close();
    this.exportInput?.destroy();
    this.importInput?.destroy();
    this.coordinator.destroy();
    this.input.keyboard?.off('keydown-ESC', this.onEscKey);
  };

  /**
   * A modalShell 'dismissible' dim is tap-to-close across the WHOLE screen and
   * the panel itself is not interactive, so a click inside the panel — the
   * text inputs included, whose DOM events bubble through to Phaser — fell
   * through and dismissed the modal. An inert interactive zone over the panel
   * catches those taps; slotted at index 2 (above dim and chrome, below the
   * close button and every control added later) so nothing else changes.
   */
  private addPanelTapBlocker(shell: ModalShell, width: number, height: number): void {
    const blocker = this.add.zone(640, 360, width, height).setInteractive();
    shell.container.addAt(blocker, 2);
  }

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
      dismissal: 'dismissible',
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.profileInteractiveTargets.map(modalGuardTarget),
      },
      onClose: () => {
        this.pickerShell?.close();
        this.exportInput?.destroy();
        this.exportInput = null;
        this.exportStatus = null;
        this.exportInteractiveTargets = [];
        this.exportShell = null;
      },
    });
    this.exportShell = shell;
    this.addPanelTapBlocker(shell, 1120, 620);
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

    // Save card first (locked decision 2026-08-24: both formats, PNG offered
    // first). The PNG is a normal-looking image with the whole save inside,
    // so the copy says so plainly — sharing it should be a deliberate act.
    c.add(
      this.add
        .text(640, 132, 'Save it as an image: pick card art you own and download a save card. The PNG carries this entire save inside it.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          wordWrap: { width: 900 },
          align: 'center',
        })
        .setOrigin(0.5),
    );
    const cardButton = themedButton(this, 640, 178, 'Create save card ✦', {
      variant: 'primary',
      minWidth: 220,
      enabled: code !== '',
      onTap: () => this.openSaveCardPicker(() => code),
    });
    c.add(cardButton.container);

    const input = createMultilineInput(this, 640, 330, {
      width: 930,
      height: 200,
      accessibleName: 'Save export code',
      readOnly: true,
    });
    this.exportInput = input;
    input.setValue(code);

    const status = this.add
      .text(640, 455, 'Replays are excluded by default.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(status);
    this.exportStatus = status;
    if (code === '') {
      status.setColor(theme.colors.danger).setText('This profile is too large to export.');
    }
    c.add(
      this.add
        .text(640, 505, 'Keep the code and the save card private. Both contain your collection, decks, progress, settings, and match record.', {
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
          status.setColor(theme.colors.danger).setText('Replays make this export too large. Replays stay excluded.');
          return;
        }
        includeReplays = !includeReplays;
        code = next;
        input.setValue(code);
        includeButton.setLabel(`Include replays: ${includeReplays ? 'On' : 'Off'}`);
        status.setColor(theme.colors.muted).setText(includeReplays ? 'Replays are included in this export.' : 'Replays are excluded from this export.');
      },
    });
    const copyButton = themedButton(this, 860, 600, 'Copy', {
      variant: 'primary',
      minWidth: 120,
      onTap: () => void this.copyExportCode(input, code, status),
    });
    c.add([includeButton.container, copyButton.container]);
    this.exportInteractiveTargets = [
      ...shell.interactiveChildren,
      cardButton.inputZone,
      includeButton.inputZone,
      copyButton.inputZone,
    ];
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

  /**
   * The owned-card art picker for a save card (locked decision 2026-08-24:
   * owned cards only, searchable). Tapping a card composites the cover, embeds
   * the save code, and downloads the PNG.
   */
  private openSaveCardPicker(getCode: () => string): void {
    this.pickerShell?.close();
    const shell = modalShell(this, {
      width: 1120,
      height: 640,
      dimAlpha: 0.88,
      depth: theme.depth.results,
      dismissal: 'dismissible',
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: this.exportInteractiveTargets.map(modalGuardTarget),
        domHandles: this.exportInput ? [this.exportInput] : [],
      },
      onClose: () => {
        this.pickerSearch?.teardown();
        this.pickerSearch?.destroy();
        this.pickerSearch = null;
        this.pickerShell = null;
      },
    });
    this.pickerShell = shell;
    this.addPanelTapBlocker(shell, 1120, 640);
    const c = shell.container;
    c.add(
      this.add
        .text(640, 82, 'Choose your save card art', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(640, 118, 'Cards you own. Tap one to download the save card.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );

    const save = Services.save.data;
    const ownedPool = ALL_CARDS
      .filter((d) => ownedCount(save, d.id) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // The grid rebuilds wholesale on every search keystroke and page turn —
    // 24 cached thumbs is cheap next to keeping partial state honest.
    const gridC = this.add.container(0, 0);
    c.add(gridC);
    const COLS = 8;
    const ROWS = 3;
    const PAGE_SIZE = COLS * ROWS;
    const THUMB_SCALE = 0.34;
    let query = '';
    let page = 0;
    const renderGrid = (): void => {
      gridC.removeAll(true);
      const filtered = ownedPool.filter((d) => matchesSearch(d, query));
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      page = Math.min(page, pages - 1);
      if (filtered.length === 0) {
        gridC.add(
          this.add
            .text(640, 390, 'No owned cards match that search.', {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.body}px`,
              color: theme.colors.muted,
            })
            .setOrigin(0.5),
        );
        return;
      }
      const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      visible.forEach((card, i) => {
        const x = 199 + (i % COLS) * 126;
        const y = 240 + Math.floor(i / COLS) * 152;
        const thumb = makeCardThumb(this, x, y, card, THUMB_SCALE).setInteractive({ useHandCursor: true });
        bindTapButton(this, thumb, () => void this.exportSaveCard(card.id, getCode()));
        gridC.add(thumb);
      });
      if (pages > 1) {
        const control = pager(this, 596, 632, page, pages, (next) => {
          page = next;
          renderGrid();
        });
        gridC.add(control.container);
      }
    };
    const search = createSearchInput(this, 640, 158, {
      width: 360,
      placeholder: 'Search cards…',
      accessibleName: 'Search save card art',
      onChange: (value) => {
        query = value;
        page = 0;
        renderGrid();
      },
    });
    this.pickerSearch = search;
    renderGrid();
  }

  /** Composite the cover, embed the code, and hand the PNG to the browser. */
  private async exportSaveCard(cardId: string, code: string): Promise<void> {
    const completion = collectionCompletion(ALL_CARDS, Services.save.data);
    const bestRung = Services.save.data.gauntlet.bestRung;
    const identity =
      `${formatRate(completion.percent)} collection` + (bestRung > 0 ? ` · Tower rung ${bestRung}` : '');
    const canvas = composeSaveCardCanvas(this, cardId, {
      identity,
      date: `Exported ${todayString()}`,
    });
    if (!canvas) {
      this.exportStatus?.setColor(theme.colors.danger).setText("That card's art is unavailable. Pick another card.");
      return;
    }
    try {
      const png = await canvasPngBytes(canvas);
      const withSave = embedSaveCode(png, code);
      downloadPngBytes(saveImageFilename(new Date()), withSave);
      this.pickerShell?.close();
      this.exportStatus
        ?.setColor(theme.colors.success)
        .setText('Save card downloaded. The image contains your entire save.');
    } catch {
      this.exportStatus?.setColor(theme.colors.danger).setText('Could not create the save card. Try again.');
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
      dismissal: 'dismissible',
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
    this.addPanelTapBlocker(shell, 1120, 640);
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
      .text(640, 444, 'Paste a save code or choose a save card, then Preview save.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(status); // scene-level before: it outlived the shell as a stray line
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
        status.setColor(theme.colors.muted).setText('Paste a save code or choose a save card, then Preview save.');
      },
    });
    this.importInput = input;

    // Shared by the Preview button and the save-card path: a card is just a
    // carrier, so once the code is in the input the validation is identical.
    const runPreview = (): void => {
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
    };

    const validateButton = themedButton(this, 350, 590, 'Preview save', {
      variant: 'primary',
      minWidth: 170,
      onTap: runPreview,
    });
    const cardImportButton = themedButton(this, 610, 590, 'From save card…', {
      variant: 'ghost',
      minWidth: 190,
      onTap: () => {
        void pickPngFile().then((picked) => {
          if (!picked || !this.importShell) return;
          const read = readSaveCode(picked.bytes);
          if (!read.ok || !read.code) {
            status.setColor(theme.colors.danger).setText(read.message ?? 'That file is not a save card.');
            return;
          }
          input.setValue(read.code);
          runPreview();
        });
      },
    });
    previewButton = themedButton(this, 880, 590, 'Replace save', {
      variant: 'danger',
      minWidth: 180,
      enabled: false,
      onTap: () => {
        if (decodedSave) this.openImportConfirmation(decodedSave);
      },
    });
    c.add([validateButton.container, cardImportButton.container, previewButton.container]);
    this.importInteractiveTargets = [
      ...shell.interactiveChildren,
      validateButton.inputZone,
      cardImportButton.inputZone,
      previewButton.inputZone,
    ];
    input.focus();
  }

  private openImportConfirmation(save: SaveData): void {
    this.confirmationShell?.close();
    const shell = modalShell(this, {
      width: 820,
      height: 300,
      dimAlpha: 0.9,
      depth: theme.depth.results,
      dismissal: 'esc-and-close',
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

  /**
   * The left panel is tabbed (1.6.3). It used to stack Practice, Gauntlet and
   * Style in one fixed column, which had no room for the Draft record and
   * nowhere to put Collection at all. Tabs went on the LEFT rather than the
   * right so Replays keep their full 608x450 instead of being halved.
   *
   * Style is gone from this screen entirely: card back and playmat became
   * properties of the deck in save v33 and are edited in the Deck Builder.
   */
  private renderStatTabs(): void {
    for (const node of this.statTabNodes) node.destroy();
    this.statTabNodes = [];

    const tabs: { key: ProfileStatTab; label: string }[] = [
      { key: 'practice', label: 'Practice' },
      { key: 'gauntlet', label: 'Gauntlet' },
      { key: 'draft', label: 'Draft' },
      { key: 'collection', label: 'Collection' },
    ];
    const first = 132;
    const pitch = 112;
    tabs.forEach((tab, index) => {
      const button = themedButton(this, first + index * pitch, 224, tab.label, {
        variant: this.statTab === tab.key ? 'primary' : 'ghost',
        size: 'sm',
        minWidth: 100,
        onTap: () => {
          if (this.statTab === tab.key) return;
          this.statTab = tab.key;
          this.renderStatTabs();
        },
      });
      this.statTabNodes.push(button.container);
      this.profileInteractiveTargets.push(button.inputZone);
    });

    if (this.statTab === 'practice') this.renderPracticeTab();
    else if (this.statTab === 'gauntlet') this.renderGauntletTab();
    else if (this.statTab === 'draft') this.renderDraftTab();
    else this.renderCollectionTab();
  }

  /** Rows start below the tab strip; every tab shares this rhythm. */
  private statTabRow(index: number, label: string, value: string, valueColor?: string): void {
    const y = 276 + index * 36;
    this.statTabNodes.push(this.rowPanel(y));
    this.statTabNodes.push(
      this.add
        .text(ROW_TEXT_LEFT, y, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
      this.add
        .text(ROW_TEXT_RIGHT, y, value, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: valueColor ?? theme.colors.heading,
        })
        .setOrigin(1, 0.5),
    );
  }

  private statTabNote(index: number, text: string): void {
    this.statTabNodes.push(
      this.add
        .text(ROW_TEXT_LEFT, 276 + index * 36, text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
          wordWrap: { width: ROW_W - 32 },
          lineSpacing: 2,
        })
        .setOrigin(0, 0.5),
    );
  }

  private renderPracticeTab(): void {
    const p = computeProfile(Services.save.data);
    p.byDifficulty.forEach((d, i) => {
      this.statTabRow(
        i,
        DIFFICULTY_LABEL[d.key],
        `${d.w} / ${d.l}      ${formatRate(d.rate)}`,
        d.rate === null ? theme.colors.muted : theme.colors.heading,
      );
    });
    this.statTabRow(3, 'All duels', `${p.wins} / ${p.losses}      ${formatRate(p.winRate)}`);
    this.statTabNote(4, 'Wins and losses across every practice duel, by the difficulty you chose.');
  }

  private renderGauntletTab(): void {
    const p = computeProfile(Services.save.data);
    const g = Services.save.data.gauntlet;
    this.statTabRow(0, 'Best rung reached', p.bestRung > 0 ? `Rung ${p.bestRung}` : 'None');
    this.statTabRow(1, 'Full clears', `${p.completions}`);
    this.statTabRow(2, 'Mono-color clears', `${g.clearStyles.monoColor}`);
    this.statTabRow(3, 'Two-color clears', `${g.clearStyles.dualColor}`);
    this.statTabRow(4, 'Packs opened', `${p.packsOpened}`);
    this.statTabNote(5, 'A loss ends a run and resets the tower. Your collection is never reset.');
  }

  private renderDraftTab(): void {
    const d = computeDraftSummary(Services.save.data.limited);
    this.statTabRow(0, 'Best finish', d.bestWins > 0 ? `${d.bestWins} wins` : 'None');
    this.statTabRow(1, 'Runs completed', `${d.runs}`);
    this.statTabRow(
      2,
      'Match record',
      `${d.wins} / ${d.losses}      ${formatRate(d.winRate)}`,
      d.winRate === null ? theme.colors.muted : theme.colors.heading,
    );
    this.statTabRow(3, 'Perfect runs', `${d.perfectRuns}`);
    this.statTabRow(4, 'Gold from drafting', `${d.goldEarned}`);
    this.statTabRow(5, 'Premium runs', `${d.premiumRuns}`);
    const built = d.byDeckStyle[0];
    this.statTabRow(6, 'Most-built deck', built && built.runs > 0 ? DECK_STYLE_LABEL[built.key] : '—');
    this.statTabRow(7, 'Drafters met', `${d.personasMet}`);
    this.statTabNote(
      8,
      d.runInProgress
        ? 'A run is in progress. It joins this record when it finishes.'
        : 'Counts completed runs only. Retiring a draft early records nothing.',
    );
  }

  private renderCollectionTab(): void {
    const c = collectionCompletion(ALL_CARDS, Services.save.data);
    this.statTabRow(0, 'Cards owned', `${c.owned} / ${c.total}      ${formatRate(c.percent)}`);
    c.byRarity.forEach((r, i) => {
      this.statTabRow(
        1 + i,
        RARITY_NAMES[r.key],
        `${r.owned} / ${r.total}      ${formatRate(r.percent)}`,
        r.owned === 0 ? theme.colors.muted : theme.colors.heading,
      );
    });
    this.statTabRow(6, 'Special-treatment cards', `${c.variants.specialCards}`);
    this.statTabRow(7, 'Black frames · Void holos', `${c.variants.blackFrameCards} · ${c.variants.voidHoloCards}`);
    this.statTabNote(8, 'A card counts as owned once you hold any treatment of it.');
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
      .text(ROW_TEXT_LEFT, y, label, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.body })
      .setOrigin(0, 0.5);
    this.add
      .text(ROW_TEXT_RIGHT, y, value, { fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.heading })
      .setOrigin(1, 0.5);
  }

  /** Shared list-row treatment: row fill with the standard panel outline. */
  private rowPanel(y: number): Phaser.GameObjects.Graphics {
    return this.add
      .graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
      .fillRoundedRect(ROW_X, y - 15, ROW_W, 30, theme.radius.control)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(ROW_X, y - 15, ROW_W, 30, theme.radius.control);
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
