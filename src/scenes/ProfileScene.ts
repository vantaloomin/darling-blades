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
import { artMissing } from '../art/artLoader';
import { ART_WAIT_TEXT_STYLE, awaitArt } from '../ui/artGate';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CARD_H, CARD_W } from '../ui/CardView';
import type { Rect } from '../ui/layout';
import {
  PROFILE_CONFIRM_MODAL,
  PROFILE_EXPORT_MODAL,
  PROFILE_HEADER,
  PROFILE_IMPORT_MODAL,
  PROFILE_PANELS,
  PROFILE_RECORD,
  PROFILE_REPLAYS,
  PROFILE_REPLAY_ROW,
  PROFILE_SAVE_ACTIONS,
  PROFILE_SAVE_CARD_PICKER,
  PROFILE_SHOWCASE,
  PROFILE_STAT_ROWS,
  PROFILE_STAT_TABS,
  PROFILE_TAB_STRIP,
  PROFILE_WIDE_MODAL,
  profileConfirmFooterXs,
  profileConfirmLayout,
  profileExportFooterXs,
  profileExportLayout,
  profileImportFooterXs,
  profileImportLayout,
  profilePickerLayout,
  profileReplayCell,
  profileReplayNameWidth,
  profileSaveActionCenters,
  profileStatNoteTop,
  profileStatRowY,
  profileWatchX,
  type ProfileStatTab,
} from '../ui/profilePresentation';
import { canvasPngBytes, composeSaveCardCanvas, downloadPngBytes, pickPngFile } from '../ui/saveCard';
import { ellipsizeText } from '../ui/textFit';
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

export type { ProfileStatTab } from '../ui/profilePresentation';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Hit width of a built button: what measure-then-place packs by. */
const hitWidth = (button: ThemedButton): number => button.getMeasuredSize().hit.width;

/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks and the persisted deterministic replay reel.
 * Nothing rendered here mutates the save.
 *
 * Every position comes from `src/ui/profilePresentation.ts` (derived from the
 * design-system tokens and the title-safe frame); this file carries no
 * coordinates of its own. Buttons whose label width is font-dependent are
 * built first and then placed from their measured hit width.
 */
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

    // Header line: the back link (added last, below) and the title.
    this.add
      .text(PROFILE_HEADER.titleX, PROFILE_HEADER.y, 'Profile', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    // Record row: the win record centred, the save actions at the frame's
    // right edge on the same line, the showcase at its left edge.
    this.add
      .text(PROFILE_RECORD.x, PROFILE_RECORD.y, `${p.wins} W  /  ${p.losses} L`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0.5);
    this.add
      .text(
        PROFILE_RECORD.x,
        PROFILE_RECORD.rateY,
        p.games > 0 ? `${formatRate(p.winRate)} win rate over ${p.games} duels` : 'No duels played yet',
        { fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted },
      )
      .setOrigin(0.5);

    const exportButton = themedButton(this, 0, PROFILE_SAVE_ACTIONS.y, 'Export save', {
      variant: 'primary',
      minWidth: PROFILE_SAVE_ACTIONS.minWidth,
      onTap: () => this.openExportModal(),
    });
    const importButton = themedButton(this, 0, PROFILE_SAVE_ACTIONS.y, 'Import save', {
      variant: 'emphasis',
      minWidth: PROFILE_SAVE_ACTIONS.minWidth,
      onTap: () => this.openImportModal(),
    });
    const { exportX, importX } = profileSaveActionCenters(hitWidth(exportButton), hitWidth(importButton));
    exportButton.container.setX(exportX);
    importButton.container.setX(importX);
    this.profileInteractiveTargets.push(exportButton.inputZone, importButton.inputZone);

    if (data.notice) {
      // The import's result, as the save actions' status line.
      this.add
        .text(PROFILE_SAVE_ACTIONS.right, PROFILE_SAVE_ACTIONS.noticeY, data.notice, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.success,
        })
        .setOrigin(1, 0.5);
    }

    this.drawShowcase();

    const P = PROFILE_PANELS;
    panel(this, P.left.x, P.top, P.left.width, P.bottom - P.top);
    panel(this, P.right.x, P.top, P.right.width, P.bottom - P.top);

    this.renderStatTabs();

    this.add
      .text(PROFILE_REPLAYS.headingX, PROFILE_REPLAYS.headingY, 'Replays', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    const replays = Services.save.data.replays
      .filter((log) => isReplayVisible(log, this.reserveFormatsEnabled))
      .slice(0, PROFILE_REPLAYS.capacity);
    if (replays.length === 0) {
      this.add
        .text(PROFILE_REPLAYS.left, PROFILE_REPLAYS.emptyY, 'No replays yet. Finish a duel and it will appear here.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
          wordWrap: { width: PROFILE_REPLAYS.emptyWrap },
        })
        .setOrigin(0, 0.5);
    } else {
      replays.forEach((log, index) => this.replayRow(log, profileReplayCell(index)));
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
  private addPanelTapBlocker(shell: ModalShell, size: { width: number; height: number }): void {
    // modalShell centres its panel on the design centre by default.
    const blocker = this.add
      .zone(theme.design.centerX, theme.design.centerY, size.width, size.height)
      .setInteractive();
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
      width: PROFILE_WIDE_MODAL.width,
      height: PROFILE_WIDE_MODAL.height,
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
    this.addPanelTapBlocker(shell, PROFILE_WIDE_MODAL);
    const c = shell.container;
    const L = profileExportLayout(shell.tracks);
    const M = PROFILE_EXPORT_MODAL;
    c.add(
      this.add
        .text(L.x, L.titleY, 'Export save', {
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
        .text(L.x, L.cardCopyY, 'Save it as an image: pick card art you own and download a save card. The PNG carries this entire save inside it.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          wordWrap: { width: M.copyWrap },
          align: 'center',
        })
        .setOrigin(0.5),
    );
    const cardButton = themedButton(this, L.x, L.cardButtonY, 'Create save card ✦', {
      variant: 'primary',
      minWidth: M.cardButtonMinWidth,
      enabled: code !== '',
      onTap: () => this.openSaveCardPicker(() => code),
    });
    c.add(cardButton.container);

    const input = createMultilineInput(this, L.x, L.inputY, {
      width: M.input.width,
      height: M.input.height,
      accessibleName: 'Save export code',
      readOnly: true,
    });
    this.exportInput = input;
    input.setValue(code);

    const status = this.add
      .text(L.x, L.statusY, 'Replays are excluded by default.', {
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
        .text(L.x, L.privacyY, 'Keep the code and the save card private. Both contain your collection, decks, progress, settings, and match record.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          wordWrap: { width: M.copyWrap },
          align: 'center',
        })
        .setOrigin(0.5),
    );

    // Footer cluster, placed from measured widths (and again if the toggle's
    // label ever outgrows its minimum width).
    const placeFooter = (): void => {
      const [includeX, copyX] = profileExportFooterXs(shell.tracks, hitWidth(includeButton), hitWidth(copyButton));
      includeButton.container.setX(includeX);
      copyButton.container.setX(copyX);
    };
    const includeButton = themedButton(this, 0, L.footerY, 'Include replays: Off', {
      variant: 'ghost',
      minWidth: M.includeMinWidth,
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
        placeFooter();
        status.setColor(theme.colors.muted).setText(includeReplays ? 'Replays are included in this export.' : 'Replays are excluded from this export.');
      },
    });
    const copyButton = themedButton(this, 0, L.footerY, 'Copy', {
      variant: 'primary',
      minWidth: M.copyMinWidth,
      onTap: () => void this.copyExportCode(input, code, status),
    });
    placeFooter();
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
    // The only card art the Profile draws: the owned-pool grid behind the save
    // card export (src/ui/saveCard.ts composes the chosen card's art into the
    // PNG, so a stand-in texture would ship inside the file).
    const owned = Object.keys(Services.save.data.collection);
    this.pickerShell?.close();
    if (artMissing(owned).length === 0) {
      this.buildSaveCardPicker(getCode);
      return;
    }
    // The picker opens over the live export modal, so the wait is a modal of
    // the picker's own footprint rather than `gateOnArt`'s full-screen shade
    // (the artGate.ts rule, and ShopScene's deck preview). As a registered
    // overlay it deadens the export controls and hides the export textarea
    // while it is up, a second tap cannot stack a second wait, and Esc, the
    // close button or a tap on the dim cancels it: a cancelled wait never
    // opens the picker later.
    let cancelled = false;
    const waiting = modalShell(this, {
      width: PROFILE_WIDE_MODAL.width,
      height: PROFILE_WIDE_MODAL.height,
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
        cancelled = true;
        if (this.pickerShell === waiting) this.pickerShell = null;
      },
    });
    this.pickerShell = waiting;
    this.addPanelTapBlocker(waiting, PROFILE_WIDE_MODAL);
    const bounds = waiting.tracks.contentBounds;
    const line = this.add
      .text(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, '', ART_WAIT_TEXT_STYLE)
      .setOrigin(0.5);
    waiting.container.add(line);
    awaitArt(this, owned, {
      onWait: (text) => {
        if (line.active) line.setText(text);
      },
      onReady: () => {
        if (cancelled) return;
        waiting.close();
        this.buildSaveCardPicker(getCode);
      },
    });
  }

  private buildSaveCardPicker(getCode: () => string): void {
    this.pickerShell?.close();
    const shell = modalShell(this, {
      width: PROFILE_WIDE_MODAL.width,
      height: PROFILE_WIDE_MODAL.height,
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
    this.addPanelTapBlocker(shell, PROFILE_WIDE_MODAL);
    const c = shell.container;
    const L = profilePickerLayout(shell.tracks, { width: CARD_W, height: CARD_H });
    c.add(
      this.add
        .text(L.x, L.titleY, 'Choose your save card art', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(L.x, L.subtitleY, 'Cards you own. Tap one to download the save card.', {
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
    const COLS = PROFILE_SAVE_CARD_PICKER.columns;
    const PAGE_SIZE = COLS * PROFILE_SAVE_CARD_PICKER.rows;
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
            .text(L.x, L.emptyY, 'No owned cards match that search.', {
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
        const x = L.columnXs[i % COLS];
        const y = L.rowYs[Math.floor(i / COLS)];
        const thumb = makeCardThumb(this, x, y, card, L.thumbScale).setInteractive({ useHandCursor: true });
        bindTapButton(this, thumb, () => void this.exportSaveCard(card.id, getCode()));
        gridC.add(thumb);
      });
      if (pages > 1) {
        const control = pager(this, 0, L.footerY, page, pages, (next) => {
          page = next;
          renderGrid();
        });
        // The pager's label sits between its chevrons: centre the label.
        control.container.setX(L.x - control.label.x);
        gridC.add(control.container);
      }
    };
    const search = createSearchInput(this, L.x, L.searchY, {
      width: PROFILE_SAVE_CARD_PICKER.searchWidth,
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
      width: PROFILE_WIDE_MODAL.width,
      height: PROFILE_WIDE_MODAL.height,
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
    this.addPanelTapBlocker(shell, PROFILE_WIDE_MODAL);
    const c = shell.container;
    const L = profileImportLayout(shell.tracks);
    const M = PROFILE_IMPORT_MODAL;
    c.add(
      this.add
        .text(L.x, L.titleY, 'Import save', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    const status = this.add
      .text(L.x, L.statusY, 'Paste a save code or choose a save card, then Preview save.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(status); // scene-level before: it outlived the shell as a stray line
    this.importStatus = status;

    const input = createMultilineInput(this, L.x, L.inputY, {
      width: M.input.width,
      height: M.input.height,
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
        .text(L.previewX, L.previewTop, this.formatSavePreview(result.preview), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          lineSpacing: M.previewLineSpacing,
        })
        .setOrigin(0, 0);
      c.add(previewText);
      previewButton?.setEnabled(true);
      status.setColor(theme.colors.success).setText('Save code is valid. Review the profile before replacing it.');
    };

    const validateButton = themedButton(this, 0, L.footerY, 'Preview save', {
      variant: 'primary',
      minWidth: M.previewMinWidth,
      onTap: runPreview,
    });
    const cardImportButton = themedButton(this, 0, L.footerY, 'From save card…', {
      variant: 'ghost',
      minWidth: M.cardMinWidth,
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
    previewButton = themedButton(this, 0, L.footerY, 'Replace save', {
      variant: 'danger',
      minWidth: M.replaceMinWidth,
      enabled: false,
      onTap: () => {
        if (decodedSave) this.openImportConfirmation(decodedSave);
      },
    });
    const footerXs = profileImportFooterXs(
      shell.tracks,
      hitWidth(validateButton),
      hitWidth(cardImportButton),
      hitWidth(previewButton),
    );
    validateButton.container.setX(footerXs[0]);
    cardImportButton.container.setX(footerXs[1]);
    previewButton.container.setX(footerXs[2]);
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
      width: PROFILE_CONFIRM_MODAL.width,
      height: PROFILE_CONFIRM_MODAL.height,
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
    const L = profileConfirmLayout(shell.tracks);
    const M = PROFILE_CONFIRM_MODAL;
    c.add(
      this.add
        .text(L.messageX, L.messageY, "Replace this device's save? Your current profile will be overwritten. Export it first if you may want it back.", {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.body,
          wordWrap: { width: M.messageWrap },
          align: 'center',
          lineSpacing: M.messageLineSpacing,
        })
        .setOrigin(0.5),
    );
    const cancelButton = themedButton(this, 0, L.footerY, 'Cancel', {
      variant: 'ghost',
      minWidth: M.cancelMinWidth,
      onTap: () => shell.close(),
    });
    const confirmButton = themedButton(this, 0, L.footerY, 'Replace save', {
      variant: 'danger',
      minWidth: M.confirmMinWidth,
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
    const [cancelX, confirmX] = profileConfirmFooterXs(shell.tracks, hitWidth(cancelButton), hitWidth(confirmButton));
    cancelButton.container.setX(cancelX);
    confirmButton.container.setX(confirmX);
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
   * seal plaques in the header's left void, from the frame's left edge.
   * Renders nothing when nothing is pinned, so the header stays clean for new
   * players; the space is reserved either way, so nothing below it moves.
   */
  private drawShowcase(): void {
    const S = PROFILE_SHOWCASE;
    const achievements = Services.save.data.achievements;
    const pins = achievements.pinned
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((achievement): achievement is AchievementDef =>
        !!achievement && achievements.claimed.includes(achievement.id),
      )
      .slice(0, S.maxPins);
    if (pins.length === 0) return;
    this.add
      .text(S.left, S.labelY, 'Showcase', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const w = S.sealWidth;
    const h = S.sealHeight;
    const inset = S.innerInset;
    pins.forEach((achievement, index) => {
      const seal = this.add.container(S.xs[index], S.sealY).setAngle(S.angle);
      const plate = this.add.graphics();
      plate.fillStyle(theme.graphics.panelFill, 0.96);
      plate.fillRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control);
      plate.lineStyle(2, colorInt(theme.colors.success), 0.95);
      plate.strokeRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control);
      plate.lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome);
      plate.strokeRoundedRect(-w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset, theme.radius.control - 2);
      const title = this.add
        .text(0, S.titleY, '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0.5);
      ellipsizeText(title, S.titleMaxWidth, achievement.title);
      const label = this.add
        .text(0, S.claimedY, 'CLAIMED', {
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
   * right so Replays keep the whole right panel instead of being halved.
   *
   * Style is gone from this screen entirely: card back and playmat became
   * properties of the deck in save v33 and are edited in the Deck Builder.
   */
  private renderStatTabs(): void {
    for (const node of this.statTabNodes) node.destroy();
    this.statTabNodes = [];

    // The strip spans exactly the stat-row column under it (it used to sit
    // 22px left of the rows it switches).
    PROFILE_STAT_TABS.forEach((tab, index) => {
      const button = themedButton(this, PROFILE_TAB_STRIP.xs[index], PROFILE_TAB_STRIP.y, tab.label, {
        variant: this.statTab === tab.key ? 'primary' : 'ghost',
        size: 'sm',
        minWidth: PROFILE_TAB_STRIP.width,
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

  /** Rows start below the tab strip; every tab shares this rhythm (profilePresentation.ts). */
  private statTabRow(index: number, label: string, value: string, valueColor?: string): void {
    const y = profileStatRowY(index);
    this.statTabNodes.push(this.rowPanel(y));
    this.statTabNodes.push(
      this.add
        .text(PROFILE_STAT_ROWS.textLeft, y, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
      this.add
        .text(PROFILE_STAT_ROWS.textRight, y, value, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: valueColor ?? theme.colors.heading,
        })
        .setOrigin(1, 0.5),
    );
  }

  /** The tab's footnote under its `rowsAbove` rows; top-anchored so a wrap grows downward. */
  private statTabNote(rowsAbove: number, text: string): void {
    this.statTabNodes.push(
      this.add
        .text(PROFILE_STAT_ROWS.textLeft, profileStatNoteTop(rowsAbove), text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
          wordWrap: { width: PROFILE_STAT_ROWS.noteWrap },
          lineSpacing: PROFILE_STAT_ROWS.noteLineSpacing,
        })
        .setOrigin(0, 0),
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

  /** Shared list-row treatment: row fill with the standard panel outline, centred on `y`. */
  private rowPanel(y: number): Phaser.GameObjects.Graphics {
    const R = PROFILE_STAT_ROWS;
    const top = y - R.height / 2;
    return this.add
      .graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
      .fillRoundedRect(R.x, top, R.width, R.height, theme.radius.control)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(R.x, top, R.width, R.height, theme.radius.control);
  }

  /**
   * One replay cell. Line 1 is the Watch button's track (the opponent's name
   * shares its centre and is ellipsized short of the button, where it used to
   * wrap onto the line below); the mode/result line sits under it, and a
   * replay recorded on an older version gets its note in place of the button.
   */
  private replayRow(log: ReplayLog, cell: Rect): void {
    const R = PROFILE_REPLAY_ROW;
    const replayable = canReplay(log, CARD_DB);
    const row = this.add.container(0, 0).setAlpha(replayable ? 1 : theme.alpha.subtle);
    row.add(panel(this, cell.x, cell.y, cell.width, cell.height, { alpha: theme.alpha.subtle, radius: theme.radius.control }));
    const mode = log.context.mode[0].toUpperCase() + log.context.mode.slice(1);
    const result = log.result === 'win' ? 'Victory' : 'Defeat';
    const date = todayString(new Date(log.endedAt));
    const name = this.add
      .text(cell.x + R.textX, cell.y + R.titleY, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    row.add(name);
    row.add(
      this.add
        .text(cell.x + R.textX, cell.y + R.metaY, `${mode} · ${result} · ${log.turns === 1 ? '1 turn' : `${log.turns} turns`} · ${date}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: replayable ? theme.colors.muted : theme.colors.danger,
          wordWrap: { width: R.textWidth },
        })
        .setOrigin(0, 0.5),
    );
    let watchWidth = 0;
    if (replayable) {
      const watch = themedButton(this, 0, cell.y + R.titleY, 'Watch', {
        variant: 'primary',
        size: 'sm',
        minWidth: R.watchMinWidth,
        onTap: (p) => {
          if (!p.rightButtonReleased()) this.scene.start('Duel', { replay: log });
        },
      });
      watchWidth = watch.getMeasuredSize().visual.width;
      watch.container.setX(cell.x + profileWatchX(watchWidth));
      row.add(watch.container);
      this.profileInteractiveTargets.push(watch.inputZone);
    } else {
      row.add(
        this.add
          .text(cell.x + R.textX, cell.y + R.noteY, 'This replay was recorded on an older version.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0, 0.5),
      );
    }
    ellipsizeText(name, profileReplayNameWidth(watchWidth), log.context.opponentName);
  }
}
