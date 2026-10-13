import Phaser from 'phaser';
import { formatCount } from '../ui/goldFormat';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import { RARITY_NAMES } from '../data/glossary';
import { ACHIEVEMENTS, type AchievementDef } from '../meta/Achievements';
import { ownedCount } from '../meta/Collection';
import { todayString } from '../meta/Economy';
import { collectionCompletion, matchesSearch, pageNeighbourhood } from '../meta/collectionFilter';
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
import { OverlayCoordinator, type OverlayDomHandle } from '../ui/OverlayCoordinator';
import { createMultilineInput, type MultilineInputHandle } from '../ui/MultilineInput';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import { Art } from '../art/ArtResolver';
import { artTextureTier } from '../art/artWatch';
import { artMissing, liveArtStore } from '../art/artLoader';
import { ART_WAIT_TEXT_STYLE, awaitArt, PagedArt } from '../ui/artGate';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { COMPACT } from '../ui/compactLayout';
import { compactButton, compactDialog, compactHeader, compactSegments, compactSwitch, COMPACT_DRAG_SLOP, coverFitImage } from '../ui/compactWidgets';
import { replayOpponentAvatar } from '../ui/duelArt';
import { bindMenuScroll } from '../ui/menuScroll';
import { addPortraitArt } from '../ui/portraitArt';
import {
  compactProfileLayout, compactSaveDialogLayout, profileArtGrid, profileStatColumns, PROFILE_COMPACT, type CompactSaveDialogLayout,
} from '../ui/profileCompact';
import { bakeUiIcon } from '../ui/uiIcons';
import { makeCardThumb, thumbArtWanted } from '../ui/CardThumbCache';
import { CARD_H, CARD_W } from '../ui/CardView';
import type { Rect } from '../ui/layout';
import {
  PROFILE_CONFIRM_MODAL,
  PROFILE_EXPORT_MODAL,
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
  profileMeasuredReplays,
  profileReplayNameWidth,
  profileSaveActionCenters,
  profileStatNoteTop,
  profileStatRowY,
  profileWatchX,
  type ProfileStatTab,
} from '../ui/profilePresentation';
import {
  canvasPngBytes,
  composeSaveCardCanvasAsync,
  downloadPngBytes,
  pickPngFile,
  saveCardArtStillLoading,
} from '../ui/saveCard';
import { fitMenuName } from '../ui/menuText';
import type { ProfileA11yFixture } from '../ui/profilePresentation';
import { ellipsizeText } from '../ui/textFit';
import { sceneTitle } from '../ui/sceneTitle';
import { applySavedAccessibility } from '../ui/settingsPresentation';
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
import { IS_DEV } from '../platform/env';
import { bindTapButton } from '../platform/gestures';

export type { ProfileStatTab } from '../ui/profilePresentation';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Hit width of a built button: what measure-then-place packs by. */
const hitWidth = (button: ThemedButton): number => button.getMeasuredSize().hit.width;

/** One stat row: its label, its value, and the win rate when the row has one. */
interface ProfileStatRow {
  label: string;
  value: string;
  rate?: string;
  /** Drawn muted: nothing recorded yet. */
  muted?: boolean;
}

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
  private fixture: ProfileA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private get saveData(): SaveData { return this.fixtureSave ?? Services.save.data; }
  private identityShell: ModalShell | null = null;
  private statTab: ProfileStatTab = 'practice';
  /** Everything the active tab drew, cleared on each tab switch. */
  private statTabNodes: Phaser.GameObjects.GameObject[] = [];
  private coordinator!: OverlayCoordinator;
  private profileInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private exportShell: ModalShell | null = null;
  private exportInput: MultilineInputHandle | null = null;
  private exportStatus: Phaser.GameObjects.Text | null = null;
  /** A save-card export is under way (the art read can be async): further taps wait for it. */
  private exportingSaveCard = false;
  private exportInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private pickerShell: ModalShell | null = null;
  private pickerSearch: SearchInputHandle | null = null;
  private importShell: ModalShell | null = null;
  private importInput: MultilineInputHandle | null = null;
  private importStatus: Phaser.GameObjects.Text | null = null;
  /** The phone's tick beside a valid code's status line. */
  private importStatusIcon: Phaser.GameObjects.Image | null = null;
  /** The phone picker's preview plate line, where a save card's trouble also shows. */
  private pickerNote: Phaser.GameObjects.Text | null = null;
  private importInteractiveTargets: Phaser.GameObjects.GameObject[] = [];
  private confirmationShell: ModalShell | null = null;
  private reserveFormatsEnabled = false;

  constructor() {
    super('Profile');
  }

  create(data: {
    notice?: string; replays?: readonly ReplayLog[]; a11yFixture?: ProfileA11yFixture;
    /** Open the import dialog on arrival (the main menu's home-screen save message, M9). */
    openImport?: boolean;
  } = {}): void {
    // The notice is one-shot: Phaser keeps a start's data for the next start
    // that passes none (Systems.start only replaces it when given some), so a
    // later plain visit would show "Save imported" again.
    this.sys.settings.data = {};
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture?.save ? structuredClone(this.fixture.save) : null;
    this.statTab = this.fixture?.tab ?? 'practice';
    this.identityShell = null;
    this.data.set('a11yReady', false);
    this.data.set('a11yDensity', { actual: [], release: [] });
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
    this.importStatusIcon = null;
    this.pickerNote = null;
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

    const p = computeProfile(this.saveData);

    const replays = (data.replays ?? this.saveData.replays) // data.replays: dev probe fixtures (src/dev/a11yProbe.ts)
      .filter((log) => isReplayVisible(log, this.reserveFormatsEnabled))
      .slice(0, 10);
    // On a phone: the record, the stats and the replays side by side (mock M-Profile).
    const stage = sceneStage(this);
    if (stage.compact) this.buildCompact(stage.content, p, replays, data.notice);
    else this.buildDesktop(p, replays, data.notice);

    if (this.fixture?.modal === 'export' || this.fixture?.modal === 'picker') this.openExportModal();
    if (this.fixture?.modal === 'picker') this.openSaveCardPicker(() => this.tryEncode(false) ?? '');
    if (this.fixture?.modal === 'import' || this.fixture?.modal === 'confirm' || (!this.fixture && data.openImport === true)) this.openImportModal();
    if (this.fixture?.modal === 'confirm') this.openImportConfirmation(this.saveData);
    if (this.fixture?.identity) this.showIdentity(this.fixture.identity);
    if (this.fixture?.modal !== 'picker') this.data.set('a11yReady', true);
  }

  /**
   * The phone composition (mock M-Profile): the record and the showcase on
   * the left, the stat tabs in the centre, and the column's replay list with
   * Import save and Export save at its foot. Every rect comes from
   * `src/ui/profileCompact.ts`.
   */
  private buildCompact(content: Rect, p: ReturnType<typeof computeProfile>, replays: readonly ReplayLog[], notice: string | undefined): void {
    const type = theme.compactType;
    const footNeed = (label: string): number => {
      const probe = this.add.text(0, 0, label, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
      // The label and 10 px either side, the mock's foot buttons.
      const width = Math.ceil(probe.width) + 20;
      probe.destroy();
      return width;
    };
    // The four tabs share one bar while their labels fit it at the label size; else two bars of two.
    const tabsNeed = PROFILE_STAT_TABS.reduce((sum, tab) => {
      const probe = this.add.text(0, 0, tab.label, { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600 });
      const width = probe.width + 8;
      probe.destroy();
      return sum + width;
    }, 8);
    const statsW = compactProfileLayout(content, { importSave: 0, exportSave: 0 }).tabs.width;
    const layout = compactProfileLayout(content, { importSave: footNeed('Import save'), exportSave: footNeed('Export save') }, tabsNeed > statsW ? 2 : 1);
    const header = compactHeader(this, layout.shell, { title: 'Profile', onBack: () => this.scene.start('MainMenu') });
    this.profileInteractiveTargets.push(header.back.inputZone);
    if (notice) {
      // The import's result, in the top bar's right slot.
      const right = layout.shell.right;
      const line = this.add.text(right.x + right.width, right.y + right.height / 2, notice, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.success,
      }).setOrigin(1, 0.5);
      ellipsizeText(line, right.width);
    }

    this.buildCompactRecord(layout.record, p);
    this.buildCompactStats(layout);
    this.buildCompactReplays(layout, replays);

    const importButton = compactButton(this, layout.importSave, 'Import save', { onTap: () => this.openImportModal() });
    const exportButton = compactButton(this, layout.exportSave, 'Export save', { variant: 'primary', onTap: () => this.openExportModal() });
    this.profileInteractiveTargets.push(importButton.inputZone, exportButton.inputZone);
  }

  /** The win record, the rate line, and the showcase's seals under them. */
  private buildCompactRecord(record: Rect, p: ReturnType<typeof computeProfile>): void {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    const tally = this.add.text(record.x, record.y, `${p.wins} W / ${p.losses} L`, {
      fontFamily: theme.fonts.display, fontSize: `${type.display}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    // A long record steps down a size before it would shorten.
    if (tally.width > record.width) tally.setFontSize(type.h1);
    ellipsizeText(tally, record.width);
    const rate = this.add.text(record.x, tally.y + tally.height + 2,
      p.games > 0 ? `${formatRate(p.winRate)} win rate over ${p.games} duels` : 'No duels played yet', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: record.width },
      });

    const achievements = this.saveData.achievements;
    const pins = achievements.pinned
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((achievement): achievement is AchievementDef => !!achievement && achievements.claimed.includes(achievement.id))
      .slice(0, PROFILE_SHOWCASE.maxPins);
    if (pins.length === 0) return;
    const label = this.add.text(record.x, rate.y + rate.height + 18, 'SHOWCASE', {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
    });
    label.setLetterSpacing(1);
    // The tilt needs a few px either side.
    const w = record.width - 8;
    let y = label.y + label.height + 8;
    const bottom = record.y + record.height;
    for (const achievement of pins) {
      const title = this.add.text(0, 0, '', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      }).setOrigin(0.5, 0);
      ellipsizeText(title, w - 20, achievement.title);
      const claimed = this.add.text(0, 0, 'CLAIMED', {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.success,
      }).setOrigin(0.5, 0);
      claimed.setLetterSpacing(1);
      // The two lines a few px apart, so the tilt never brings their boxes together.
      const lineGap = 4;
      const h = Math.max(COMPACT.touch, title.height + lineGap + claimed.height + P.sealPadY * 2);
      // A seal that would run off the pane is left out rather than cut.
      if (y + h > bottom) {
        title.destroy();
        claimed.destroy();
        break;
      }
      const seal = this.add.container(record.x + 4 + w / 2, y + h / 2).setAngle(P.sealAngle);
      const plate = this.add.graphics()
        .fillStyle(theme.graphics.panelFill, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control)
        .lineStyle(2, colorInt(theme.colors.success), 0.95).strokeRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control)
        .lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome)
        .strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, theme.radius.control - 2);
      const block = title.height + lineGap + claimed.height;
      title.setY(-block / 2);
      claimed.setY(-block / 2 + title.height + lineGap);
      const hit = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      bindTapButton(this, hit, () => this.showIdentity(achievement.title, achievement.description));
      seal.add([plate, title, claimed, hit]);
      this.profileInteractiveTargets.push(hit);
      y += h + P.sealGap;
    }
  }

  /** The stat tabs over the active tab's rows and footnote, which scroll when they run long (Draft). */
  private buildCompactStats(layout: ReturnType<typeof compactProfileLayout>): void {
    let rows: Phaser.GameObjects.Container | null = null;
    const render = (): void => {
      rows?.destroy();
      rows = this.buildCompactStatRows(layout.rows, false);
      if (rows.getData('height') > layout.rows.height) {
        rows.destroy();
        rows = this.buildCompactStatRows(layout.rows, true);
      }
      bindMenuScroll(this, rows, layout.rows, rows.getData('height'));
    };
    const keys = PROFILE_STAT_TABS.map((tab) => tab.key);
    const labels = PROFILE_STAT_TABS.map((tab) => tab.label);
    // One bar of four, or two bars of two, one selection across them.
    const perBar = layout.tabs.height > COMPACT.touch ? 2 : keys.length;
    const bars: ReturnType<typeof compactSegments>[] = [];
    for (let start = 0; start < keys.length; start += perBar) {
      const row = start / perBar;
      const rect = { ...layout.tabs, y: layout.tabs.y + row * (COMPACT.touch + COMPACT.gap), height: COMPACT.touch };
      const current = keys.indexOf(this.statTab) - start;
      bars.push(compactSegments(this, rect, labels.slice(start, start + perBar), current >= 0 && current < perBar ? current : -1, (i) => {
        const key = keys[start + i];
        bars.forEach((bar, b) => { if (b !== row) bar.select(-1); });
        if (this.statTab === key) return;
        this.statTab = key;
        render();
      }, [], true));
    }
    this.profileInteractiveTargets.push(...bars.flatMap((bar) => bar.zones));
    render();
  }

  /**
   * One tab's rows: the label left, the value and the win rate in right-aligned
   * columns (the rates line up down the tab), then the footnote. `lane` leaves
   * the scroll thumb its lane when the tab runs past the pane.
   */
  private buildCompactStatRows(pane: Rect, lane: boolean): Phaser.GameObjects.Container {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    const { rows, note } = this.statTabContent();
    const width = pane.width - (lane ? P.thumbLane : 0);
    const container = this.add.container(0, pane.y);
    const style = (color: string, bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color, ...(bold ? { fontStyle: theme.weight.w600 } : {}),
    });
    const rateTexts = rows.map((row) => (row.rate === undefined ? null : this.add.text(0, 0, row.rate, style(row.muted ? theme.colors.muted : theme.colors.heading, true)).setOrigin(1, 0.5)));
    const rateW = Math.max(0, ...rateTexts.map((t) => t?.width ?? 0));
    let y = 0;
    rows.forEach((row, i) => {
      const value = this.add.text(0, 0, row.value, style(row.muted ? theme.colors.muted : theme.colors.heading, true)).setOrigin(1, 0.5);
      const label = this.add.text(0, 0, row.label, style(theme.colors.body)).setOrigin(0, 0.5);
      const h = Math.max(P.statRowH, Math.ceil(Math.max(label.height, value.height)) + 12);
      const rect = { x: pane.x, y, width, height: h };
      const cols = profileStatColumns(rect, rateTexts[i] ? rateW : 0, value.width);
      const plate = this.add.graphics()
        .fillStyle(theme.graphics.rowFill, theme.alpha.subtle).fillRoundedRect(rect.x, y, width, h, theme.radius.control)
        .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(rect.x, y, width, h, theme.radius.control);
      label.setPosition(rect.x + P.statInset, y + h / 2);
      ellipsizeText(label, cols.labelWidth);
      value.setPosition(cols.valueRight, y + h / 2);
      rateTexts[i]?.setPosition(cols.rateRight, y + h / 2);
      container.add([plate, label, value, ...(rateTexts[i] ? [rateTexts[i]!] : [])]);
      y += h + P.statRowGap;
    });
    const footnote = this.add.text(pane.x + 2, y + 6, note, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: width - 4 }, lineSpacing: 3,
    });
    container.add(footnote);
    container.setData('height', footnote.y + footnote.height);
    return container;
  }

  /** The column's replay list (M-Profile): a card per replay, scrolling, under its heading. */
  private buildCompactReplays(layout: ReturnType<typeof compactProfileLayout>, replays: readonly ReplayLog[]): void {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    const area = layout.replays;
    const heading = this.add.text(area.x, area.y, 'Replays', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    const top = heading.y + heading.height + P.headingGap;
    const view = { x: area.x, y: top, width: area.width, height: Math.max(0, area.y + area.height - top) };
    if (replays.length === 0) {
      this.add.text(view.x, view.y, 'No replays yet. Finish a duel and it will appear here.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: view.width },
      });
      return;
    }
    const build = (cardW: number): { list: Phaser.GameObjects.Container; height: number; adapters: ThemedButton[] } => {
      const list = this.add.container(0, view.y);
      const adapters: ThemedButton[] = [];
      let y = 0;
      for (const log of replays) y += this.compactReplayCard(list, log, { x: view.x, y, width: cardW, height: 0 }, adapters) + P.replayGap;
      return { list, height: Math.max(0, y - P.replayGap), adapters };
    };
    // The portraits' art: ten at most, so all of it is asked for now.
    new PagedArt(this, 'profile-replay-portraits').show(replays.flatMap((log) => {
      const avatar = replayOpponentAvatar(log);
      const pending = avatar ? Art.resolver?.getArt(avatar.portraitCardId, undefined, 'half').pending : undefined;
      // The store is asked by art key, not by texture key.
      const art = pending === undefined ? null : artTextureTier(pending);
      return art === null ? [] : [art.key];
    }));
    let built = build(view.width);
    if (built.height > view.height) {
      built.list.destroy();
      built = build(view.width - P.thumbLane);
    }
    bindMenuScroll(this, built.list, view, built.height, undefined, built.adapters);
  }

  /**
   * One replay card: the opponent's portrait, her name, the result and turns,
   * the mode and date, and the gold play button. A replay this version cannot
   * play says so in place of the button. Returns the card's height.
   */
  private compactReplayCard(list: Phaser.GameObjects.Container, log: ReplayLog, at: Rect, adapters: ThemedButton[]): number {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    const { touch } = COMPACT;
    const replayable = canReplay(log, CARD_DB);
    const textX = at.x + P.replayPad + P.portrait + 8;
    const textRight = at.x + at.width - P.replayPad - (replayable ? touch + 6 : 0);
    const textW = Math.max(0, textRight - textX);
    const victory = log.result === 'win';
    const name = this.add.text(textX, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    });
    ellipsizeText(name, textW, log.context.opponentName);
    const turns = log.turns === 1 ? '1 turn' : `${log.turns} turns`;
    const result = this.add.text(textX, 0, `${victory ? 'Victory' : 'Defeat'} · ${turns}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: victory ? theme.colors.success : theme.colors.muted,
    });
    ellipsizeText(result, textW);
    const mode = log.context.mode[0].toUpperCase() + log.context.mode.slice(1);
    const ended = new Date(log.endedAt);
    const meta = this.add.text(textX, 0, `${mode} · ${todayString(ended)}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    });
    // Where the full date does not fit, the month and day (the name's notice has the full line);
    // at the larger text sizes the line wraps rather than lose the date.
    if (meta.width > textW) meta.setText(`${mode} · ${ended.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    meta.setWordWrapWidth(textW);
    const old = replayable ? null : this.add.text(textX, 0, 'Recorded on an older version.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted, wordWrap: { width: textW },
    });
    const lines = [name, result, meta, ...(old ? [old] : [])];
    const block = lines.reduce((sum, t) => sum + t.height, 0);
    const h = Math.max(touch + P.replayPad * 2, Math.ceil(block) + P.replayPad * 2);
    const y = at.y;
    list.add(panel(this, at.x, y, at.width, h, { alpha: 1, radius: theme.radius.control }));
    let lineY = y + (h - block) / 2;
    for (const t of lines) {
      t.setY(lineY);
      lineY += t.height;
    }
    list.add(lines);
    this.compactPortrait(list, log, at.x + P.replayPad + P.portrait / 2, y + h / 2);

    // The card's words open the whole name and line, for where they were shortened.
    const nameHit = this.add.zone(textX + textW / 2, y + h / 2, textW, h);
    nameHit.setInteractive({ useHandCursor: true });
    bindTapButton(this, nameHit, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) <= COMPACT_DRAG_SLOP) this.showIdentity(log.context.opponentName, this.replayMeta(log));
    });
    list.add(nameHit);
    this.profileInteractiveTargets.push(nameHit);
    adapters.push(this.compactAdapter(nameHit, list, { x: textX, y, width: textW, height: h }));
    if (replayable) {
      const rect = { x: at.x + at.width - P.replayPad - touch, y: y + (h - touch) / 2, width: touch, height: touch };
      const play = compactButton(this, rect, '', {
        icon: 'play', variant: 'primary', fontSize: 14,
        onTap: (pointer) => {
          if (!pointer.rightButtonReleased()) this.scene.start('Duel', { replay: log });
        },
      });
      list.add(play.container);
      this.profileInteractiveTargets.push(play.inputZone);
      adapters.push(this.compactAdapter(play.inputZone, list, rect));
    }
    return h;
  }

  /**
   * The opponent's round portrait on a replay card: the avatar's portrait art
   * cover-fitted in a square, its corners filled with the card's plate colour
   * and a ring over the edge (a mask cannot nest inside the list's own). A
   * replay without a known avatar gets her initial.
   */
  private compactPortrait(list: Phaser.GameObjects.Container, log: ReplayLog, cx: number, cy: number): void {
    const r = PROFILE_COMPACT.portrait / 2;
    const avatar = replayOpponentAvatar(log);
    const face = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
    let drawn = false;
    if (avatar) {
      try {
        const image = addPortraitArt(this, face.x, face.y, avatar.portraitCardId, (img) => coverFitImage(img, face, 0.12), 'half');
        if (image) {
          list.add(image);
          drawn = true;
        }
      } catch {
        drawn = false;
      }
    }
    const g = this.add.graphics();
    if (!drawn) {
      g.fillStyle(theme.graphics.rowFill, 1).fillCircle(cx, cy, r);
      const initial = this.add.text(cx, cy, (log.context.opponentName.trim()[0] ?? '?').toUpperCase(), {
        fontFamily: theme.fonts.display, fontSize: `${theme.compactType.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setOrigin(0.5);
      list.add([g, initial]);
    } else {
      // The four corners outside the circle, in the plate's own fill.
      g.fillStyle(theme.graphics.panelFill, 1);
      const corners: [number, number, number, number][] = [
        [-1, -1, Math.PI, Math.PI * 1.5], [1, -1, Math.PI * 1.5, Math.PI * 2], [1, 1, 0, Math.PI / 2], [-1, 1, Math.PI / 2, Math.PI],
      ];
      for (const [sx, sy, from, to] of corners) {
        g.beginPath();
        g.moveTo(cx + sx * r, cy + sy * r);
        g.arc(cx, cy, r, from, to, false);
        g.closePath();
        g.fillPath();
      }
      list.add(g);
    }
    const ring = this.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 0.7).strokeCircle(cx, cy, r);
    list.add(ring);
  }

  /** A scroll list's stand-in for a zone, so the list deafens what it scrolls out of view. */
  private compactAdapter(zone: Phaser.GameObjects.Zone, container: Phaser.GameObjects.Container, hit: Rect): ThemedButton {
    return {
      container,
      inputZone: zone,
      // The list moves the container: the hit is in its local space, x in world.
      getMeasuredBounds: () => ({ hit }),
      setEnabled: (on: boolean) => {
        if (on) zone.setInteractive({ useHandCursor: true });
        else zone.disableInteractive();
      },
    } as unknown as ThemedButton;
  }

  /**
   * The save dialogs' frame on a phone (M-ExportSave, M-ImportSave,
   * M-SaveCard): a sheet over the main pane and the top bar with its title
   * and close, and the command column beside it. Returns the sheet's body
   * under the title; the caller draws the column.
   */
  private compactSaveFrame(opts: {
    title: string;
    subtitle?: string;
    depth: number;
    guardTargets: readonly Phaser.GameObjects.GameObject[];
    domHandles?: readonly OverlayDomHandle[];
    onClose: () => void;
  }): { shell: ModalShell; body: Rect; column: Phaser.GameObjects.Container } & CompactSaveDialogLayout {
    const type = theme.compactType;
    const layout = compactSaveDialogLayout(sceneStage(this).content);
    const title = this.add.text(0, 0, opts.title, {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const subtitle = opts.subtitle
      ? this.add.text(0, 0, opts.subtitle, { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted })
      : null;
    const block = title.height + (subtitle?.height ?? 0);
    const { sheet } = layout;
    const shell = modalShell(this, {
      width: sheet.width,
      height: sheet.height,
      x: sheet.x + sheet.width / 2,
      y: sheet.y + sheet.height / 2,
      titleTrackHeight: block,
      dimAlpha: 0.94,
      depth: opts.depth,
      dismissal: 'esc-and-close',
      coordinator: this.coordinator,
      registration: {
        dismissible: true,
        guardTargets: opts.guardTargets.map(modalGuardTarget),
        domHandles: opts.domHandles ?? [],
      },
      onClose: opts.onClose,
    });
    const track = shell.tracks.titleTrack;
    ellipsizeText(title, track.width);
    title.setPosition(track.x, track.y + (track.height - block) / 2);
    if (subtitle) {
      ellipsizeText(subtitle, track.width);
      subtitle.setPosition(track.x, title.y + title.height);
    }
    shell.container.add([title, ...(subtitle ? [subtitle] : [])]);
    const close = shell.tracks.closeTrack;
    const pad = track.x - sheet.x;
    const bodyY = Math.max(track.y + track.height, close.y + close.height) + 10;
    const body = { x: track.x, y: bodyY, width: close.x + close.width - track.x, height: Math.max(0, sheet.y + sheet.height - pad - bodyY) };
    // The column beside the sheet: its own plate, which the layout probe checks its text against.
    const column = this.add.container(0, 0);
    const columnRect = { x: layout.side.x, y: layout.side.y, width: layout.side.width, height: layout.primary.y + layout.primary.height - layout.side.y };
    // The column is a second plate of the dialog: its texts sit inside it, and it covers the scene beneath.
    column.setData('a11yPanel', columnRect).setData('a11ySurface', columnRect);
    // An opaque bed under the primary, so a disabled (faded) primary never shows the scene's foot buttons through it.
    const bed = this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRoundedRect(layout.primary.x, layout.primary.y, layout.primary.width, layout.primary.height, theme.radius.control);
    column.add(bed);
    shell.container.add(column);
    return { shell, body, column, ...layout };
  }

  /** Export on a phone (M-ExportSave): the code and the privacy line in the sheet; the save card, the replay switch and Copy in the column. */
  private openCompactExport(): void {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    let includeReplays = false;
    let code = this.tryEncode(false) ?? '';
    const frame = this.compactSaveFrame({
      title: 'Export save',
      depth: theme.depth.modal,
      guardTargets: this.profileInteractiveTargets,
      onClose: () => {
        this.pickerShell?.close();
        this.exportInput?.destroy();
        this.exportInput = null;
        this.exportStatus = null;
        this.exportInteractiveTargets = [];
        this.exportShell = null;
      },
    });
    this.exportShell = frame.shell;
    const c = frame.shell.container;
    const { body, side, primary, column: col } = frame;

    const privacy = this.add.text(body.x, 0, 'Keep the code and the save card private. Both contain your collection, decks, progress, settings, and match record.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: body.width }, lineSpacing: 3,
    });
    const boxH = Math.max(COMPACT.touch * 2, body.y + body.height - privacy.height - 12 - body.y);
    privacy.setY(body.y + boxH + 12);
    c.add(privacy);
    const input = createMultilineInput(this, body.x + body.width / 2, body.y + boxH / 2, {
      width: body.width, height: boxH, accessibleName: 'Save export code', readOnly: true,
    });
    Object.assign((input.node as HTMLTextAreaElement).style, { font: `${type.label}px monospace`, padding: '10px', wordBreak: 'break-all' });
    this.exportInput = input;
    input.setValue(code);

    // The column: what a save card is, Create save card, the replay switch and its status line.
    col.add(panel(this, side.x, side.y, side.width, side.height, { alpha: 1 }));
    const inner = { x: side.x + P.sidePad, y: side.y + P.sidePad, width: side.width - P.sidePad * 2, height: side.height - P.sidePad * 2 };
    const stack = this.add.container(0, inner.y);
    col.add(stack);
    const adapters: ThemedButton[] = [];
    let y = 0;
    const copy = this.add.text(inner.x, y, 'Save it as an image: pick card art you own and download a save card. The PNG carries this entire save inside it.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: inner.width }, lineSpacing: 3,
    });
    stack.add(copy);
    y += copy.height + 12;
    const cardRect = { x: inner.x, y, width: inner.width, height: COMPACT.touch };
    const cardButton = compactButton(this, cardRect, 'Create save card', { icon: 'star', onTap: () => this.openSaveCardPicker(() => code) });
    cardButton.setEnabled(code !== '');
    stack.add(cardButton.container);
    adapters.push(this.compactAdapter(cardButton.inputZone, stack, cardRect));
    y += COMPACT.touch + 12;
    stack.add(this.add.rectangle(inner.x, y, inner.width, 1, theme.graphics.panelStroke, theme.alpha.chrome).setOrigin(0, 0));
    y += 1 + 4;
    const rowRect = { x: inner.x, y, width: inner.width, height: COMPACT.touch };
    const toggle = compactSwitch(this, inner.x + inner.width, y + COMPACT.touch / 2, false);
    const rowLabel = this.add.text(inner.x, y + COMPACT.touch / 2, 'Include replays', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    }).setOrigin(0, 0.5);
    ellipsizeText(rowLabel, inner.width - toggle.width - 8);
    const rowZone = this.add.zone(inner.x + inner.width / 2, y + COMPACT.touch / 2, inner.width, COMPACT.touch).setInteractive({ useHandCursor: true });
    stack.add([rowLabel, toggle.container, rowZone]);
    adapters.push(this.compactAdapter(rowZone, stack, rowRect));
    y += COMPACT.touch + 6;
    const status = this.add.text(inner.x, y, 'Replays are excluded by default.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: inner.width }, lineSpacing: 2,
    });
    stack.add(status);
    this.exportStatus = status;
    if (code === '') status.setColor(theme.colors.danger).setText('This profile is too large to export.');
    // Room for the longest status line, so a message never runs past the list's end.
    const statusRoom = Math.max(status.height, this.add.text(0, 0, 'Save card downloaded. The image contains your entire save.', status.style).setVisible(false).height);
    bindMenuScroll(this, stack, inner, y + statusRoom, undefined, adapters, 0, frame.shell);
    bindTapButton(this, rowZone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      const next = this.tryEncode(!includeReplays);
      if (next === null) {
        status.setColor(theme.colors.danger).setText('Replays make this export too large. Replays stay excluded.');
        return;
      }
      includeReplays = !includeReplays;
      code = next;
      input.setValue(code);
      toggle.set(includeReplays);
      status.setColor(theme.colors.muted).setText(includeReplays ? 'Replays are included in this export.' : 'Replays are excluded from this export.');
    });

    const copyButton = compactButton(this, primary, 'Copy', { variant: 'primary', icon: 'copy', onTap: () => void this.copyExportCode(input, code, status) });
    copyButton.setEnabled(code !== '');
    col.add(copyButton.container);
    this.exportInteractiveTargets = [...frame.shell.interactiveChildren, cardButton.inputZone, rowZone, copyButton.inputZone];
  }

  /** Import on a phone (M-ImportSave): the code and its preview in the sheet; the status, the two ways in and Replace save in the column. */
  private openCompactImport(): void {
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    let decodedSave: SaveData | null = null;
    const frame = this.compactSaveFrame({
      title: 'Import save',
      depth: theme.depth.modal,
      guardTargets: this.profileInteractiveTargets,
      onClose: () => {
        this.importInput?.destroy();
        this.importInput = null;
        this.importStatus = null;
        this.importStatusIcon = null;
        this.importInteractiveTargets = [];
        this.importShell = null;
      },
    });
    this.importShell = frame.shell;
    const c = frame.shell.container;
    const { body, side, primary, column: col } = frame;

    // About four lines of code, the rest for the preview under it.
    const boxH = Math.round(Math.min(body.height * 0.45, 112));
    const previewView = { x: body.x, y: body.y + boxH + 12, width: body.width, height: Math.max(0, body.y + body.height - (body.y + boxH + 12)) };
    let preview: Phaser.GameObjects.Container | null = null;
    const clearPreview = (): void => {
      preview?.destroy();
      preview = null;
    };

    col.add(panel(this, side.x, side.y, side.width, side.height, { alpha: 1 }));
    const inner = { x: side.x + P.sidePad, y: side.y + P.sidePad, width: side.width - P.sidePad * 2, height: side.height - P.sidePad * 2 };
    const iconSize = Math.round(type.label * 1.15);
    const icon = this.add.image(inner.x + iconSize / 2, 0, bakeUiIcon(this, 'check'))
      .setDisplaySize(iconSize, iconSize).setTint(colorInt(theme.colors.success)).setVisible(false);
    const status = this.add.text(inner.x, inner.y, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: inner.width }, lineSpacing: 3,
    });
    col.add([icon, status]);
    this.importStatus = status;
    this.importStatusIcon = icon;
    const setStatus = (color: string, text: string, ok = false): void => {
      const indent = ok ? iconSize + 6 : 0;
      status.setX(inner.x + indent).setWordWrapWidth(inner.width - indent).setColor(color).setText(text);
      const lines = Math.max(1, status.getWrappedText().length);
      icon.setVisible(ok).setY(status.y + (status.height - status.lineSpacing * (lines - 1)) / lines / 2);
    };
    const idle = 'Paste a save code or choose a save card, then Preview save.';
    setStatus(theme.colors.muted, idle);

    const input = createMultilineInput(this, body.x + body.width / 2, body.y + boxH / 2, {
      width: body.width,
      height: boxH,
      accessibleName: 'Save import code',
      placeholder: 'DBS1-...',
      onChange: () => {
        decodedSave = null;
        clearPreview();
        replaceButton.setEnabled(false);
        setStatus(theme.colors.muted, idle);
      },
    });
    // 16 px or more, or a phone's browser zooms the page when the field takes focus.
    Object.assign((input.node as HTMLTextAreaElement).style, { font: `${Math.max(16, type.body)}px monospace`, padding: '10px', wordBreak: 'break-all' });
    this.importInput = input;

    const runPreview = (): void => {
      clearPreview();
      const result = decode(input.getValue());
      if (!result.ok) {
        decodedSave = null;
        replaceButton.setEnabled(false);
        setStatus(theme.colors.danger, result.error.message);
        return;
      }
      decodedSave = result.save;
      const list = this.add.container(0, previewView.y);
      const text = this.add.text(previewView.x, 0, this.formatSavePreview(result.preview), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, lineSpacing: 5, wordWrap: { width: previewView.width - P.thumbLane },
      });
      list.add(text);
      c.add(list);
      bindMenuScroll(this, list, previewView, text.height, undefined, undefined, 0, frame.shell);
      preview = list;
      replaceButton.setEnabled(true);
      setStatus(theme.colors.success, 'Save code is valid. Review the profile before replacing it.', true);
    };

    const previewRect = { x: inner.x, y: inner.y + inner.height - COMPACT.touch, width: inner.width, height: COMPACT.touch };
    const cardRect = { x: inner.x, y: previewRect.y - COMPACT.gap - COMPACT.touch, width: inner.width, height: COMPACT.touch };
    const previewButton = compactButton(this, previewRect, 'Preview save', { onTap: runPreview });
    const cardButton = compactButton(this, cardRect, 'From save card…', {
      onTap: () => {
        void pickPngFile().then((picked) => {
          if (!picked || !this.importShell) return;
          const read = readSaveCode(picked.bytes);
          if (!read.ok || !read.code) {
            setStatus(theme.colors.danger, read.message ?? 'That file is not a save card.');
            return;
          }
          input.setValue(read.code);
          runPreview();
        });
      },
    });
    const replaceButton = compactButton(this, primary, 'Replace save', {
      variant: 'danger',
      onTap: () => {
        if (decodedSave) this.openImportConfirmation(decodedSave);
      },
    });
    replaceButton.setEnabled(false);
    col.add([cardButton.container, previewButton.container, replaceButton.container]);
    this.importInteractiveTargets = [...frame.shell.interactiveChildren, cardButton.inputZone, previewButton.inputZone, replaceButton.inputZone];
    if (this.fixture?.preview) { input.setValue(this.tryEncode(false) ?? ''); runPreview(); }
    input.focus();
  }

  /**
   * The save card art on a phone (M-SaveCard): the cards you own in a grid
   * that scrolls in the sheet; a tap previews the save card in the column, and
   * Download save card writes it. Only the rows near the view hold their art.
   */
  private buildCompactSaveCardPicker(getCode: () => string): void {
    this.pickerShell?.close();
    const type = theme.compactType;
    const P = PROFILE_COMPACT;
    let previewKey: string | null = null;
    const frame = this.compactSaveFrame({
      title: 'Choose your save card art',
      subtitle: 'Cards you own. Tap one to preview it.',
      depth: theme.depth.results,
      guardTargets: this.exportInteractiveTargets,
      domHandles: this.exportInput ? [this.exportInput] : [],
      onClose: () => {
        this.pickerSearch?.teardown();
        this.pickerSearch?.destroy();
        this.pickerSearch = null;
        this.pickerShell = null;
        this.pickerNote = null;
        if (previewKey && this.textures.exists(previewKey)) this.textures.remove(previewKey);
      },
    });
    this.pickerShell = frame.shell;
    const c = frame.shell.container;
    const { body, side, primary, column: col } = frame;
    const save = this.saveData;
    const ownedPool = ALL_CARDS.filter((d) => ownedCount(save, d.id) > 0).sort((a, b) => a.name.localeCompare(b.name));
    let selected: string | null = null;
    let query = '';

    // The column: search, the preview plate, Download save card.
    const searchH = COMPACT.touch;
    const plate = { x: side.x, y: side.y + searchH + COMPACT.gap, width: side.width, height: Math.max(0, side.height - searchH - COMPACT.gap) };
    col.add(panel(this, plate.x, plate.y, plate.width, plate.height, { alpha: 1 }));
    const note = this.add.text(plate.x + plate.width / 2, plate.y + plate.height / 2, 'Tap a card to see its save card.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, align: 'center', wordWrap: { width: plate.width - P.sidePad * 2 },
    }).setOrigin(0.5);
    col.add(note);
    this.pickerNote = note;
    let previewImage: Phaser.GameObjects.Image | null = null;
    const download = compactButton(this, primary, 'Download save card', {
      variant: 'primary', icon: 'download', onTap: () => { if (selected) void this.exportSaveCard(selected, getCode()); },
    });
    download.setEnabled(false);
    col.add(download.container);

    let composing = 0;
    const showPreview = async (cardId: string): Promise<void> => {
      const ticket = ++composing;
      download.setEnabled(false);
      const canvas = await composeSaveCardCanvasAsync(this, cardId, this.saveCardLines());
      if (ticket !== composing || !this.pickerShell || this.pickerShell !== frame.shell) return;
      if (!canvas) {
        previewImage?.setVisible(false);
        note.setVisible(true).setColor(saveCardArtStillLoading(cardId) ? theme.colors.muted : theme.colors.danger)
          .setText(saveCardArtStillLoading(cardId) ? "That card's art is still loading. Try again in a moment." : "That card's art is unavailable. Pick another card.");
        return;
      }
      const key = `profile-save-card-preview-${ticket}`;
      this.textures.addCanvas(key, canvas);
      const pad = P.sidePad;
      const scale = Math.min((plate.width - pad * 2) / canvas.width, (plate.height - pad * 2) / canvas.height);
      if (previewImage) previewImage.setTexture(key);
      else {
        previewImage = this.add.image(plate.x + plate.width / 2, plate.y + plate.height / 2, key);
        col.add(previewImage);
      }
      previewImage.setScale(scale).setVisible(true);
      if (previewKey && this.textures.exists(previewKey)) this.textures.remove(previewKey);
      previewKey = key;
      note.setVisible(false);
      download.setEnabled(true);
    };

    // The grid: five across, each card's art over its name.
    const view = body;
    const gridW = view.width - P.thumbLane;
    const { thumbW, pitchX } = profileArtGrid(gridW);
    const artH = Math.round(thumbW * 1.25);
    const nameProbe = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px` });
    const nameH = nameProbe.height;
    nameProbe.destroy();
    const pitchY = artH + 4 + nameH + P.gridGap;
    let grid: Phaser.GameObjects.Container | null = null;
    // The store's requests for the grid's art: the rows in view now, the next screen's soon.
    const pickerArt = new PagedArt(this, 'profile-save-card-picker', { owner: c });
    const renderGrid = (): void => {
      grid?.destroy();
      const filtered = ownedPool.filter((d) => matchesSearch(d, query));
      const list = this.add.container(0, view.y);
      grid = list;
      c.add(list);
      if (filtered.length === 0) {
        list.add(this.add.text(view.x, 0, 'No owned cards match that search.', {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
        }));
        return;
      }
      // Only the rows near the view exist: a whole collection of tiles (two thousand cards) would stall
      // every frame, and the art with it. A row is built as it nears the view and dropped once it is a
      // screen away.
      const rowCount = Math.ceil(filtered.length / P.gridColumns);
      const rows: (Phaser.GameObjects.Container | null)[] = new Array<Phaser.GameObjects.Container | null>(rowCount).fill(null);
      const frames = new Map<string, { g: Phaser.GameObjects.Graphics; rect: Rect }>();
      const drawFrame = (id: string): void => {
        const f = frames.get(id);
        if (!f) return;
        const on = id === selected;
        f.g.clear().lineStyle(on ? 3 : 1, on ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, on ? 1 : theme.alpha.chrome)
          .strokeRoundedRect(f.rect.x, f.rect.y, f.rect.width, f.rect.height, theme.radius.control);
      };
      const buildRow = (r: number): Phaser.GameObjects.Container => {
        const row = this.add.container(0, r * pitchY);
        const cards = filtered.slice(r * P.gridColumns, (r + 1) * P.gridColumns);
        const plates = this.add.graphics();
        row.add(plates);
        cards.forEach((card, k) => {
          const rect = { x: view.x + k * pitchX, y: 0, width: thumbW, height: artH };
          plates.fillStyle(theme.graphics.rowFill, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.control);
          try {
            const image = addPortraitArt(this, rect.x, rect.y, card.id, (img) => coverFitImage(img, rect, 0.1), 'half');
            if (image) row.add(image);
          } catch {
            // A card with no art keeps its plain plate.
          }
          const name = this.add.text(rect.x + thumbW / 2, rect.y + artH + 4, '', {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body,
          }).setOrigin(0.5, 0);
          ellipsizeText(name, thumbW, card.name);
          const g = this.add.graphics();
          row.add([name, g]);
          frames.set(card.id, { g, rect });
          drawFrame(card.id);
          g.once(Phaser.GameObjects.Events.DESTROY, () => frames.delete(card.id));
        });
        list.add(row);
        return row;
      };
      // Art for the rows in view and a screen either side.
      const artKey = (cardId: string): string[] => {
        const pending = Art.resolver?.getArt(cardId, undefined, 'half').pending;
        const art = pending === undefined ? null : artTextureTier(pending);
        return art === null ? [] : [art.key];
      };
      const keysFor = (from: number, to: number): string[] =>
        filtered.slice(Math.max(0, from) * P.gridColumns, Math.max(0, to) * P.gridColumns).flatMap((card) => artKey(card.id));
      const showRows = (offset: number): void => {
        const first = Math.floor(offset / pitchY);
        const last = Math.floor((offset + view.height) / pitchY);
        const span = Math.ceil(view.height / pitchY);
        pickerArt.show(keysFor(first, last + 1), [...keysFor(first - span, first), ...keysFor(last + 1, last + 1 + span)]);
        rows.forEach((row, r) => {
          const near = r >= first - span && r <= last + span;
          if (near && !row) rows[r] = buildRow(r);
          else if (!near && row) {
            row.destroy();
            rows[r] = null;
          }
        });
      };
      const contentH = rowCount * pitchY - P.gridGap;
      const scroll = bindMenuScroll(this, list, view, contentH, undefined, [], 0, frame.shell);
      scroll.onScroll = showRows;
      showRows(0);
      // One tap target over the grid: the tile is worked out from where the tap lands.
      const tap = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
      c.add(tap);
      list.once(Phaser.GameObjects.Events.DESTROY, () => tap.destroy());
      bindTapButton(this, tap, (pointer) => {
        if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
        const x = pointer.worldX - view.x;
        const y = pointer.worldY - view.y + scroll.offset();
        const col = Math.floor(x / pitchX);
        const r = Math.floor(y / pitchY);
        // The gaps between tiles are not a tap on either.
        if (col < 0 || col >= P.gridColumns || x - col * pitchX > thumbW || y - r * pitchY > artH + 4 + nameH) return;
        const card = filtered[r * P.gridColumns + col];
        if (!card) return;
        const previous = selected;
        selected = card.id;
        if (previous) drawFrame(previous);
        drawFrame(card.id);
        void showPreview(card.id);
      });
    };

    const search = createSearchInput(this, side.x + side.width / 2, side.y + searchH / 2, {
      width: side.width,
      placeholder: 'Search cards…',
      accessibleName: 'Search save card art',
      onChange: (value) => {
        query = value;
        renderGrid();
      },
    });
    Object.assign(search.inputElement.style, { height: `${searchH}px`, fontSize: `${Math.max(16, type.body)}px` });
    this.pickerSearch = search;
    renderGrid();
    this.data.set('a11yReady', true);
  }

  /** The desktop composition: the record row, the tabbed stats and the replay grid. */
  private buildDesktop(p: ReturnType<typeof computeProfile>, replays: readonly ReplayLog[], notice: string | undefined): void {
    // Header line: the back link (added last, below) and the shared title.
    sceneTitle(this, 'Profile');

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

    if (notice) {
      // The import's result, as the save actions' status line.
      this.add
        .text(PROFILE_SAVE_ACTIONS.right, PROFILE_SAVE_ACTIONS.noticeY, notice, {
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
      const measure = (value: string, fontSize: number): number => {
        const text = this.add.text(0, 0, value, { fontFamily: theme.fonts.ui, fontSize: `${fontSize}px`, wordWrap: { width: PROFILE_REPLAY_ROW.textWidth } });
        const height = text.height; text.destroy(); return height;
      };
      const metaHeight = Math.max(...replays.map((log) => measure(this.replayMeta(log), theme.type.caption)));
      const noteHeight = measure('This replay was recorded on an older version.', theme.type.micro);
      const layout = profileMeasuredReplays(metaHeight, noteHeight);
      const density = this.data.get('a11yDensity');
      density.actual.push({ id: 'replays', rows: layout.rows, columns: 2, pitch: layout.height + PROFILE_REPLAYS.gutter, top: PROFILE_REPLAYS.top });
      density.release.push({ id: 'replays', rows: 5, columns: 2, pitch: 85, top: 243 });
      const pages = Math.ceil(replays.length / layout.capacity);
      let rows: Phaser.GameObjects.Container[] = [];
      let control: ReturnType<typeof pager> | null = null;
      const render = (page: number): void => {
        rows.forEach((row) => row.destroy());
        this.profileInteractiveTargets = this.profileInteractiveTargets.filter((target) => target.active);
        rows = replays.slice(page * layout.capacity, (page + 1) * layout.capacity).map((log, index) => this.replayRow(log, layout.cell(index), layout));
        control?.refresh(page, pages);
      };
      if (pages > 1) {
        control = pager(this, PROFILE_REPLAYS.left + PROFILE_REPLAYS.width - 180, PROFILE_REPLAYS.headingY, 0, pages, render);
        this.profileInteractiveTargets.push(control.previous, control.next);
      }
      render(Math.min(pages - 1, this.fixture?.replayPage ?? 0));
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
    this.identityShell?.close();
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
  private addPanelTapBlocker(shell: ModalShell, size: { width: number; height: number }, center?: { x: number; y: number }): void {
    // modalShell centres its panel on the design centre by default.
    const blocker = this.add
      .zone(center?.x ?? theme.design.centerX, center?.y ?? theme.design.centerY, size.width, size.height)
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
      return encode(this.saveData, { includeReplays });
    } catch {
      return null;
    }
  }

  private openExportModal(): void {
    this.importShell?.close();
    this.exportShell?.close();
    if (sceneStage(this).compact) {
      this.openCompactExport();
      return;
    }

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
    const owned = Object.keys(this.saveData.collection);
    this.pickerShell?.close();
    if (liveArtStore() !== null || artMissing(owned).length === 0) {
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
    // On a phone the wait takes the picker's own sheet.
    const sheet = sceneStage(this).compact ? compactSaveDialogLayout(sceneStage(this).content).sheet : null;
    const waiting = modalShell(this, {
      width: sheet?.width ?? PROFILE_WIDE_MODAL.width,
      height: sheet?.height ?? PROFILE_WIDE_MODAL.height,
      ...(sheet ? { x: sheet.x + sheet.width / 2, y: sheet.y + sheet.height / 2 } : {}),
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
    this.addPanelTapBlocker(waiting, sheet ?? PROFILE_WIDE_MODAL, sheet ? { x: sheet.x + sheet.width / 2, y: sheet.y + sheet.height / 2 } : undefined);
    const bounds = waiting.tracks.contentBounds;
    const line = this.add
      .text(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, '', ART_WAIT_TEXT_STYLE)
      .setOrigin(0.5);
    waiting.container.add(line);
    awaitArt(waiting.container, owned, {
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
    if (sceneStage(this).compact) {
      this.buildCompactSaveCardPicker(getCode);
      return;
    }
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

    const save = this.saveData;
    const ownedPool = ALL_CARDS
      .filter((d) => ownedCount(save, d.id) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // The grid rebuilds wholesale on every search keystroke and page turn —
    // 24 cached thumbs is cheap next to keeping partial state honest.
    const gridC = this.add.container(0, 0);
    c.add(gridC);
    const pickerArt = new PagedArt(this, 'profile-save-card-picker', { owner: c });
    const COLS = PROFILE_SAVE_CARD_PICKER.columns;
    const PAGE_SIZE = COLS * PROFILE_SAVE_CARD_PICKER.rows;
    const density = this.data.get('a11yDensity');
    density.actual.push({ id: 'save card picker', rows: PROFILE_SAVE_CARD_PICKER.rows, columns: COLS, pitch: L.rowYs[1] - L.rowYs[0], top: L.gridTop });
    density.release.push({ id: 'save card picker', rows: 3, columns: 8, pitch: 142.8, top: 172 });
    let query = '';
    let page = this.fixture?.pickerPage ?? 0;
    const renderGrid = (): void => {
      gridC.removeAll(true);
      const filtered = ownedPool.filter((d) => matchesSearch(d, query));
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      page = Math.min(page, pages - 1);
      // The picker draws at once. Its thumbs re-bake on arrival; only this
      // page's missing sources are leased, with the adjacent pages at soon.
      const around = pageNeighbourhood(filtered, page, PAGE_SIZE);
      const artFor = (cards: typeof filtered): string[] => cards.flatMap((card) => {
        const wanted = thumbArtWanted(this, card);
        return wanted === null ? [] : [wanted.key];
      });
      pickerArt.show(artFor(around.shown), artFor(around.near));
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
      const visible = around.shown;
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
    this.data.set('a11yReady', true);
  }

  /** One save-card export at a time: a second tap during one would download twice. */
  private async exportSaveCard(cardId: string, code: string): Promise<void> {
    if (this.fixture) return;
    if (this.exportingSaveCard) return;
    this.exportingSaveCard = true;
    try {
      await this.composeAndDownloadSaveCard(cardId, code);
    } finally {
      this.exportingSaveCard = false;
    }
  }

  /** The save card's lines under the name: the export date and the collection and tower line. */
  private saveCardLines(): { identity: string; date: string } {
    const completion = collectionCompletion(ALL_CARDS, this.saveData);
    const bestRung = this.saveData.gauntlet.bestRung;
    return {
      identity: `${formatRate(completion.percent)} collection` + (bestRung > 0 ? ` · Tower rung ${bestRung}` : ''),
      date: `Exported ${todayString()}`,
    };
  }

  /** Composite the cover, embed the code, and hand the PNG to the browser. */
  private async composeAndDownloadSaveCard(cardId: string, code: string): Promise<void> {
    const canvas = await composeSaveCardCanvasAsync(this, cardId, this.saveCardLines());
    if (!canvas) {
      // A file still streaming in can be waited out; one the loader gave up on
      // cannot, so that one asks for another card.
      if (saveCardArtStillLoading(cardId)) {
        this.saveCardNote(theme.colors.muted, "That card's art is still loading. Try again in a moment.");
      } else {
        this.saveCardNote(theme.colors.danger, "That card's art is unavailable. Pick another card.");
      }
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
      this.saveCardNote(theme.colors.danger, 'Could not create the save card. Try again.');
    }
  }

  /** A save card's trouble, on the export's status line and, on a phone, in the picker's preview plate. */
  private saveCardNote(color: string, text: string): void {
    this.exportStatus?.setColor(color).setText(text);
    this.pickerNote?.setVisible(true).setColor(color).setText(text);
  }

  private openImportModal(): void {
    this.exportShell?.close();
    this.importShell?.close();
    if (sceneStage(this).compact) {
      this.openCompactImport();
      return;
    }

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
    if (this.fixture?.preview) { input.setValue(this.tryEncode(false) ?? ''); runPreview(); }
    input.focus();
  }

  /** Replace this device's save with the previewed one, and come back to Profile with it. */
  private replaceSave(save: SaveData, closeConfirmation: () => void): void {
    if (this.fixture) return;
    if (!Services.replaceSave(save)) {
      closeConfirmation();
      this.importStatusIcon?.setVisible(false);
      this.importStatus
        ?.setColor(theme.colors.danger)
        .setText('Save import failed. Your current profile was restored because storage failed.');
      return;
    }
    // The imported save's text size and contrast travel with it (plan Q7):
    // in force before the restart rebuilds this scene.
    applySavedAccessibility(this.saveData.settings, IS_DEV);
    closeConfirmation();
    this.importShell?.close();
    this.scene.restart({ notice: 'Save imported' });
  }

  private openImportConfirmation(save: SaveData): void {
    this.confirmationShell?.close();
    if (sceneStage(this).compact) {
      // M-ConfirmReplace: the compact notice, Cancel left and Replace save right.
      this.confirmationShell = compactDialog(this, {
        title: "Replace this device's save?",
        message: 'Your current profile will be overwritten. Export it first if you may want it back.',
        secondary: { label: 'Cancel', onTap: (close) => close() },
        primary: { label: 'Replace save', variant: 'danger', onTap: (close) => this.replaceSave(save, close) },
        dismissal: 'esc-only',
        overlay: {
          coordinator: this.coordinator,
          depth: theme.depth.results,
          registration: {
            dismissible: true,
            guardTargets: this.importInteractiveTargets.map(modalGuardTarget),
            domHandles: this.importInput ? [this.importInput] : [],
          },
        },
        onClose: () => { this.confirmationShell = null; },
      });
      return;
    }
    const M = PROFILE_CONFIRM_MODAL;
    const message = this.add.text(0, 0, "Replace this device's save? Your current profile will be overwritten. Export it first if you may want it back.", {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body,
      wordWrap: { width: M.messageWrap }, align: 'center', lineSpacing: M.messageLineSpacing,
    }).setOrigin(0.5);
    const shell = modalShell(this, {
      width: PROFILE_CONFIRM_MODAL.width,
      height: Math.max(PROFILE_CONFIRM_MODAL.height, message.height + 168),
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
    message.setPosition(L.messageX, L.messageY);
    c.add(message);
    const cancelButton = themedButton(this, 0, L.footerY, 'Cancel', {
      variant: 'ghost',
      minWidth: M.cancelMinWidth,
      onTap: () => shell.close(),
    });
    const confirmButton = themedButton(this, 0, L.footerY, 'Replace save', {
      variant: 'danger',
      minWidth: M.confirmMinWidth,
      onTap: () => this.replaceSave(save, () => shell.close()),
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
      `Gold: ${formatCount(preview.gold)}`,
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
    const achievements = this.saveData.achievements;
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
      const growth = Math.max(0, title.height - 15);
      title.setY(S.titleY - growth / 2);
      label.setY(S.claimedY + growth / 2);
      seal.add([plate, title, label]);
      const hit = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      seal.add(hit);
      bindTapButton(this, hit, () => this.showIdentity(achievement.title));
      this.profileInteractiveTargets.push(hit);
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
        variant: this.statTab === tab.key ? 'selected' : 'ghost',
        look: 'tab',
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

    this.renderStatTabContent();
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

  /**
   * The active tab's rows and footnote, as data: the desktop joins a row's
   * value and rate into one right-aligned string, the phone gives the rates a
   * column of their own (M-Profile).
   */
  private statTabContent(): { rows: ProfileStatRow[]; note: string } {
    if (this.statTab === 'practice') {
      const p = computeProfile(this.saveData);
      return {
        rows: [
          ...p.byDifficulty.map((d) => ({ label: DIFFICULTY_LABEL[d.key], value: `${d.w} / ${d.l}`, rate: formatRate(d.rate), muted: d.rate === null })),
          { label: 'All duels', value: `${p.wins} / ${p.losses}`, rate: formatRate(p.winRate) },
        ],
        note: 'Wins and losses across every practice duel, by the difficulty you chose.',
      };
    }
    if (this.statTab === 'gauntlet') {
      const p = computeProfile(this.saveData);
      const g = this.saveData.gauntlet;
      return {
        rows: [
          { label: 'Best rung reached', value: p.bestRung > 0 ? `Rung ${p.bestRung}` : 'None' },
          { label: 'Full clears', value: `${p.completions}` },
          { label: 'Mono-color clears', value: `${g.clearStyles.monoColor}` },
          { label: 'Two-color clears', value: `${g.clearStyles.dualColor}` },
          { label: 'Packs opened', value: `${p.packsOpened}` },
        ],
        note: 'A loss ends a run and resets the tower. Your collection is never reset.',
      };
    }
    if (this.statTab === 'draft') {
      const d = computeDraftSummary(this.saveData.limited);
      const built = d.byDeckStyle[0];
      return {
        rows: [
          { label: 'Best finish', value: d.bestWins > 0 ? `${d.bestWins} wins` : 'None' },
          { label: 'Runs completed', value: `${d.runs}` },
          { label: 'Match record', value: `${d.wins} / ${d.losses}`, rate: formatRate(d.winRate), muted: d.winRate === null },
          { label: 'Perfect runs', value: `${d.perfectRuns}` },
          { label: 'Gold from drafting', value: `${d.goldEarned}` },
          { label: 'Premium runs', value: `${d.premiumRuns}` },
          { label: 'Most-built deck', value: built && built.runs > 0 ? DECK_STYLE_LABEL[built.key] : '—' },
          { label: 'Drafters met', value: `${d.personasMet}` },
        ],
        note: d.runInProgress
          ? 'A run is in progress. It joins this record when it finishes.'
          : 'Counts completed runs only. Retiring a draft early records nothing.',
      };
    }
    const c = collectionCompletion(ALL_CARDS, this.saveData);
    return {
      rows: [
        { label: 'Cards owned', value: `${c.owned} / ${c.total}`, rate: formatRate(c.percent) },
        ...c.byRarity.map((r) => ({ label: RARITY_NAMES[r.key], value: `${r.owned} / ${r.total}`, rate: formatRate(r.percent), muted: r.owned === 0 })),
        { label: 'Special-treatment cards', value: `${c.variants.specialCards}` },
        { label: 'Black frames · Void holos', value: `${c.variants.blackFrameCards} · ${c.variants.voidHoloCards}` },
      ],
      note: 'A card counts as owned once you hold any treatment of it.',
    };
  }

  private renderStatTabContent(): void {
    const { rows, note } = this.statTabContent();
    rows.forEach((row, i) => {
      this.statTabRow(
        i,
        row.label,
        row.rate === undefined ? row.value : `${row.value}      ${row.rate}`,
        row.muted ? theme.colors.muted : theme.colors.heading,
      );
    });
    this.statTabNote(rows.length, note);
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
  private replayMeta(log: ReplayLog): string {
    const mode = log.context.mode[0].toUpperCase() + log.context.mode.slice(1);
    const result = log.result === 'win' ? 'Victory' : 'Defeat';
    const date = todayString(new Date(log.endedAt));
    return `${mode} · ${result} · ${log.turns === 1 ? '1 turn' : `${log.turns} turns`} · ${date}`;
  }

  /**
   * A shortened name in full: a showcase seal's title or a replay's opponent.
   * On a phone it is a compact notice, with `detail` (the achievement, the
   * replay's line) under the name.
   */
  private showIdentity(value: string, detail?: string): void {
    this.identityShell?.close();
    if (sceneStage(this).compact) {
      this.identityShell = compactDialog(this, {
        title: value,
        message: detail ?? '',
        primary: { label: 'Close', variant: 'ghost', onTap: (close) => close() },
        dismissal: 'esc-only',
        overlay: { coordinator: this.coordinator, registration: { dismissible: true, guardTargets: this.profileInteractiveTargets.map(modalGuardTarget) } },
        onClose: () => { this.identityShell = null; },
      });
      return;
    }
    const title = this.add.text(0, 0, value, { fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading, align: 'center' }).setOrigin(0.5);
    fitMenuName(title, 600, 4);
    const shell = modalShell(this, { width: 700, height: title.height + 176, dismissal: 'esc-and-close', coordinator: this.coordinator, registration: { dismissible: true, guardTargets: this.profileInteractiveTargets.map(modalGuardTarget) }, onClose: () => { this.identityShell = null; } });
    this.identityShell = shell;
    const area = shell.tracks.contentBounds;
    title.setPosition(area.x + area.width / 2, area.y + area.height / 2);
    shell.container.add(title);
  }

  private replayRow(log: ReplayLog, cell: Rect, layout: ReturnType<typeof profileMeasuredReplays>): Phaser.GameObjects.Container {
    const R = PROFILE_REPLAY_ROW;
    const replayable = canReplay(log, CARD_DB);
    const row = this.add.container(0, 0);
    row.add(panel(this, cell.x, cell.y, cell.width, cell.height, { alpha: theme.alpha.subtle, radius: theme.radius.control }));

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
        .text(cell.x + R.textX, cell.y + layout.metaY, this.replayMeta(log), {
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
          .text(cell.x + R.textX, cell.y + layout.noteY, 'This replay was recorded on an older version.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.muted,
            wordWrap: { width: R.textWidth },
          })
          .setOrigin(0, 0.5),
      );
    }
    ellipsizeText(name, profileReplayNameWidth(watchWidth), log.context.opponentName);
    const nameWidth = profileReplayNameWidth(watchWidth);
    const nameHit = this.add.zone(cell.x + R.textX + nameWidth / 2, cell.y + R.titleY, nameWidth, theme.control.minHitHeight).setInteractive({ useHandCursor: true });
    row.add(nameHit);
    bindTapButton(this, nameHit, () => this.showIdentity(log.context.opponentName));
    this.profileInteractiveTargets.push(nameHit);
    return row;
  }
}
