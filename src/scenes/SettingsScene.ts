import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { normalizeTextScale } from '../meta/accessibilitySettings';
import type { ConfirmNoBlockSetting } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { readSignalsGateInput, signalsAllowed } from '../net/signalsGate';
import { isTauri } from '../platform/desktopWindow';
import { IS_DEV } from '../platform/env';
import { fullScreenOffered, isFullScreen, onFullScreenChange, toggleFullScreen } from '../platform/fullscreen';
import { bindTapButton, isTouchDevice } from '../platform/gestures';
import { qualityTier } from '../platform/quality';
import type { AnimationLevel } from '../platform/animPolicy';
import type { RenderScaleSetting } from '../platform/renderScale';
import { createLegalPanel } from '../ui/LegalPanel';
import { LEGAL_BUTTON_LABEL } from '../ui/legalPresentation';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { COMPACT } from '../ui/compactLayout';
import {
  compactButton,
  compactHeader,
  compactSegments,
  compactSwitch,
  COMPACT_DRAG_SLOP,
  type CompactButton,
  type CompactSwitch,
} from '../ui/compactWidgets';
import { bindMenuScroll } from '../ui/menuScroll';
import {
  SETTINGS_COMPACT,
  compactSettingsLayout,
  settingsActiveSection,
  settingsCompactSectionForTab,
  settingsCompactSections,
  type SettingsCompactSection,
} from '../ui/settingsCompact';
import type { Rect } from '../ui/layout';
import { ellipsizeText } from '../ui/textFit';
import { sceneTitle } from '../ui/sceneTitle';
import { createStatsPrivacyPanel } from '../ui/StatsPrivacyPanel';
import {
  ANIM_CHIP_WIDTH,
  NO_BLOCK_CHIPS,
  RENDER_CHIP_WIDTH,
  SETTINGS_HEADER_ACTION,
  SETTINGS_HEADER_LEGAL,
  SETTINGS_PANELS,
  SETTINGS_RESET_BLOCK,
  SETTINGS_TAB_BASE_WIDTH,
  SETTINGS_TAB_ROW,
  SETTINGS_TABS,
  settingsTabLabel,
  TEXT_SIZE_CHIPS,
  TEXT_SIZE_CHIP_WIDTH,
  TOGGLE_WIDTH,
  VOLUME_BAR,
  VOLUME_BAR_WIDTH,
  accessibilityControlsShown,
  applySavedAccessibility,
  captionWrapWidth,
  layoutSettingsTab,
  normalizeSettingsTab,
  rightAlignedControlCenters,
  scaledChipWidth,
  settingsHeaderCenters,
  settingsRhythm,
  settingsRowStacks,
  settingsTabCenters,
  settingsTabColumns,
  settingsTextSizeCaption,
  volumeSegmentXs,
  volumeStepperXs,
  type AccessibilityControlsShown,
  type MeasuredControl,
  type SettingsColumnFrame,
  type SettingsMeasured,
  type SettingsRowKey,
  type SettingsRowY,
  type SettingsTab,
} from '../ui/settingsPresentation';
import {
  STATS_PANEL_BUTTON_LABEL,
  STATS_ROW_LABEL,
  STATS_SECTION_TITLE,
  STATS_SETTINGS_ROW,
  statsRowNoteKind,
  statsRowNoteState,
  statsRowNoteText,
  toggleShareAnonStats,
} from '../ui/statsPrivacyPresentation';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel, registerSceneBackNavigation, themedButton, type ModalShell, type ThemedButton } from '../ui/themeWidgets';
import { VERSION_LABEL, checkForUpdate, type UpdateStatus } from '../version';

const STEP = 0.1;
/** A compact jump label starts 12 px into its button (the mock's 13) and keeps 4 px clear at its end. */
const NAV_LABEL_INSET = 12;
const NAV_LABEL_END = 4;

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

function measuredControl(button: ThemedButton): MeasuredControl {
  const size = button.getMeasuredSize();
  return { visualWidth: size.visual.width, hitWidth: size.hit.width };
}

/** What the scene is started with: the tab to open (Game when absent). */
export interface SettingsSceneData {
  tab?: SettingsTab;
  /** Dev-only device fixture; never changes the saved settings. */
  a11yTouch?: boolean;
}

/**
 * A row built at its x positions and measured, waiting for its y. The layout
 * (settingsPresentation.ts) decides the y from what was measured here: whether
 * the controls fit beside the label, and how many lines the caption wrapped to.
 */
interface BuiltRow {
  stacked: boolean;
  captionLines?: number;
  place(y: SettingsRowY): void;
}

/** A group of chips of which one is selected. */
interface ChipGroup {
  buttons: Map<unknown, ThemedButton>;
  selected: () => unknown;
}

/**
 * Settings, on three tabs (Game, Audio, Accessibility). Every position comes
 * from src/ui/settingsPresentation.ts: one rhythm for every column, computed
 * when the scene builds from the text size in force and from what this scene
 * measured. Nothing in this file carries a coordinate of its own.
 */
export class SettingsScene extends Phaser.Scene {
  private tab: SettingsTab = 'game';
  private touchCaption = false;
  private shown: AccessibilityControlsShown = accessibilityControlsShown(IS_DEV);
  /** The Game tab carries the Full screen switch (M8). */
  private fullScreen = false;
  private toggles: { button: ThemedButton; on: () => boolean }[] = [];
  private chipGroups: ChipGroup[] = [];
  private volumeBar: Phaser.GameObjects.Graphics | null = null;
  /** Every control the "What is sent" and Legal panels deaden while open. */
  private guardTargets: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();
  private statsPanel: ModalShell | null = null;
  private legalPanel: ModalShell | null = null;
  /** The compact (phone) list's switches, refreshed with the desktop toggles. */
  private compactSwitches: { sw: CompactSwitch; on: () => boolean }[] = [];
  private compactVolume: { bar: Phaser.GameObjects.Graphics; segW: number; segGap: number } | null = null;

  constructor() {
    super('Settings');
  }

  init(data?: SettingsSceneData): void {
    // The tab lives for the scene's life: a tab switch or a live preview
    // restarts the scene with it; arriving from the menu opens Game. The data
    // is consumed here because Phaser keeps a start's data for the next
    // start that passes none (Systems.start only replaces it when given
    // some), which would reopen the last tab on the next visit.
    this.tab = normalizeSettingsTab(data?.tab);
    this.touchCaption = IS_DEV && data?.a11yTouch !== undefined ? data.a11yTouch : isTouchDevice();
    this.sys.settings.data = {};
  }

  create(): void {
    this.toggles = [];
    this.chipGroups = [];
    this.volumeBar = null;
    this.guardTargets = [];
    this.guard = new ModalGuard();
    this.statsPanel = null;
    this.legalPanel = null;
    this.compactSwitches = [];
    this.compactVolume = null;
    this.shown = accessibilityControlsShown(IS_DEV);
    this.fullScreen = fullScreenOffered();
    if (this.fullScreen) {
      const unsubscribe = onFullScreenChange(() => this.refreshToggles());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    }
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

    // On a phone every setting sits in one list with a jump column (mock M-Settings).
    const stage = sceneStage(this);
    if (stage.compact) {
      this.buildCompact(stage.content);
      return;
    }

    sceneTitle(this, 'Settings');
    this.trackObject(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    this.buildTabs();
    this.buildTabContent();
    this.buildVersionFooter();
    this.refreshToggles();
    this.refreshChipGroups();
    this.refreshVolume();
  }

  // -------------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------------

  /** The Profile scene's tab-strip recipe, centred on the frame above the panels. */
  private buildTabs(): void {
    const buttons = SETTINGS_TABS.map(({ key, label }) =>
      this.track(
        themedButton(this, 0, SETTINGS_TAB_ROW.y, settingsTabLabel({ key, label }, this.fullScreen), {
          variant: key === this.tab ? 'selected' : 'ghost',
          look: 'tab',
          size: 'sm',
          minWidth: scaledChipWidth(SETTINGS_TAB_BASE_WIDTH),
          onTap: () => {
            if (key !== this.tab) this.scene.restart({ tab: key } satisfies SettingsSceneData);
          },
        }),
      ),
    );
    const centers = settingsTabCenters(buttons.map((b) => b.getMeasuredSize().hit.width));
    buttons.forEach((b, i) => b.container.setX(centers[i]));
  }

  /** Build the open tab's rows at their x, measure them, lay the tab out, then place them. */
  private buildTabContent(): void {
    const columns = settingsTabColumns(this.tab, this.shown, this.fullScreen);
    const built = new Map<SettingsRowKey, BuiltRow>();
    // The panels are drawn once the layout knows their height, then slotted
    // in under the rows built here.
    const panelDepthIndex = this.children.length;
    for (const column of columns) {
      for (const section of column.sections) {
        for (const row of section.rows) built.set(row.key, this.buildRow(row.key, column.frame));
      }
    }
    const measured: SettingsMeasured = {};
    for (const [key, row] of built) measured[key] = { stacked: row.stacked, captionLines: row.captionLines };
    const layout = layoutSettingsTab(this.tab, this.shown, measured, this.fullScreen);
    for (const column of layout.columns) {
      const plate = panel(this, column.frame.panelX, SETTINGS_PANELS.top, column.frame.panelWidth,
        layout.panelBottom - SETTINGS_PANELS.top);
      this.children.moveTo(plate, panelDepthIndex);
    }
    for (const column of layout.columns) {
      for (const section of column.sections) {
        const title = section.key === 'privacy' ? STATS_SECTION_TITLE : section.title;
        this.sectionTitle(column.frame.labelX, column.layout.headings[section.key], title);
        for (const row of section.rows) built.get(row.key)?.place(column.layout.rows[row.key]);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Compact (phone)
  // -------------------------------------------------------------------------

  /** One list of every setting, the jump column, the version and the foot (mock M-Settings). */
  private buildCompact(content: Rect): void {
    const type = theme.compactType;
    const sections = settingsCompactSections(this.shown, this.fullScreen);
    const footNeed = (label: string): number => {
      const probe = this.add.text(0, 0, label, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
      // The label and 12 px either side, the mock's foot buttons.
      const width = Math.ceil(probe.width) + 24;
      probe.destroy();
      return width;
    };
    const nav = this.compactNavFont(sections);
    const layout = compactSettingsLayout(content, sections.length, {
      legal: footNeed(LEGAL_BUTTON_LABEL),
      update: footNeed('Check for updates'),
    }, nav.needs);
    compactHeader(this, layout.shell, { title: 'Settings', onBack: () => this.scene.start('MainMenu') });
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    const list = this.add.container(0, layout.list.y);
    const adapters: ThemedButton[] = [];
    const tops: number[] = [];
    const x = layout.list.x;
    let y = 0;
    sections.forEach((section, si) => {
      if (si > 0) y += SETTINGS_COMPACT.sectionGap;
      tops.push(y);
      const heading = this.add.text(x, y, section.title, {
        fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      });
      list.add(heading);
      y += heading.height + SETTINGS_COMPACT.headingGap;
      section.rows.forEach((key, ri) => {
        if (ri > 0) {
          list.add(this.add.rectangle(x, y, layout.rowW, 1, theme.graphics.panelStroke, theme.alpha.chrome).setOrigin(0, 0));
        }
        y += this.buildCompactRow(key, list, { x, y, width: layout.rowW, height: 0 }, adapters);
      });
    });
    const contentHeight = y;

    let jump: (index: number) => void = () => undefined;
    const navButtons = this.buildCompactNav(layout.nav, sections, nav.fontSize, (i) => jump(i));
    const opening = settingsCompactSectionForTab(this.tab, sections);
    const openAt = opening ? tops[sections.findIndex((s) => s.key === opening)] ?? 0 : 0;
    const scroll = bindMenuScroll(this, list, layout.list, contentHeight, undefined, adapters, 0, undefined, openAt);
    const highlight = (index: number): void => navButtons.forEach((b, i) => b.setVariant(i === index ? 'selected' : 'ghost'));
    const follow = (): void => highlight(settingsActiveSection(tops, scroll.offset(), layout.list.height, scroll.maxScroll));
    scroll.onScroll = follow;
    jump = (i) => {
      scroll.scrollTo(tops[i]);
      // The jumped-to section stays selected even where the list's end
      // stops it short of the top; the next scroll recomputes.
      highlight(i);
    };
    if (opening) highlight(sections.findIndex((s) => s.key === opening));
    else follow();

    this.buildCompactColumnFoot(layout);
    this.refreshToggles();
    this.refreshVolume();
  }

  /** Taps on a compact control, ignoring the press that scrolled the list. */
  private bindCompactTap(zone: Phaser.GameObjects.Zone, onTap: (pointer: Phaser.Input.Pointer) => void): void {
    zone.setInteractive({ useHandCursor: true });
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) <= COMPACT_DRAG_SLOP) onTap(pointer);
    });
  }

  /**
   * The jump labels' one size, and what each needs: the body size while every
   * row of two can hold its pair, else the label size.
   */
  private compactNavFont(sections: readonly SettingsCompactSection[]): { fontSize: number; needs: number[] } {
    const type = theme.compactType;
    const columnW = COMPACT.columnW;
    const probe = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontStyle: theme.weight.w600 });
    const measure = (size: number): number[] => {
      probe.setFontSize(size);
      return sections.map((s) => Math.ceil(probe.setText(s.nav).width) + NAV_LABEL_INSET + NAV_LABEL_END);
    };
    const rowsFit = (needs: number[]): boolean => needs.every((need, i) =>
      i % 2 === 1 || need + (needs[i + 1] ?? 0) + COMPACT.gap <= columnW);
    let fontSize = type.body;
    let needs = measure(fontSize);
    if (!rowsFit(needs)) {
      fontSize = type.label;
      needs = measure(fontSize);
    }
    probe.destroy();
    return { fontSize, needs };
  }

  /** The jump grid: one button per section, every label at one size. */
  private buildCompactNav(
    rects: readonly Rect[],
    sections: readonly SettingsCompactSection[],
    fontSize: number,
    onJump: (index: number) => void,
  ): CompactButton[] {
    return sections.map((section, i) => {
      const button = compactButton(this, rects[i], section.nav, { align: 'left', inset: NAV_LABEL_INSET, fontSize, onTap: () => onJump(i) });
      // Only where a pair cannot share its row at all.
      ellipsizeText(button.label, rects[i].width - NAV_LABEL_INSET - NAV_LABEL_END);
      this.trackObject(button.inputZone);
      return button;
    });
  }

  /** The version under the jump grid, and Legal with Check for updates at the column's foot. */
  private buildCompactColumnFoot(layout: ReturnType<typeof compactSettingsLayout>): void {
    const type = theme.compactType;
    const column = layout.shell.column;
    if (!column) return;
    const style = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: column.width } };
    const version = this.add.text(column.x, layout.versionY, VERSION_LABEL, style);
    const status = this.add.text(column.x, version.y + version.height + 4, '', { ...style, fontStyle: theme.weight.w600 });
    const footTop = Math.min(layout.legal.y, layout.update.y) - COMPACT.gap;
    const fit = (): void => {
      // The status line gives way to the foot rather than run under it.
      status.setVisible(status.y + status.height <= footTop);
    };
    this.trackObject(compactButton(this, layout.legal, LEGAL_BUTTON_LABEL, { onTap: () => this.openLegalPanel() }).inputZone);
    this.trackObject(compactButton(this, layout.update, 'Check for updates', {
      onTap: () => {
        status.setText('Checking…').setColor(theme.colors.body);
        fit();
        void checkForUpdate().then((result) => {
          if (!status.active) return;
          status.setText(result.message).setColor(SettingsScene.updateColor(result));
          fit();
        });
      },
    }).inputZone);
  }

  /** A row's label: the compact body size, wrapped to `width`. */
  private compactLabel(x: number, y: number, text: string, width: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.body}px`, fontStyle: theme.weight.w600,
      color: theme.colors.heading, wordWrap: { width },
    });
  }

  /** A row's caption: the compact label size, muted, wrapped to `width`. */
  private compactCaption(x: number, y: number, text: string, width: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.label}px`, color: theme.colors.muted,
      wordWrap: { width }, lineSpacing: 2,
    });
  }

  /** A zone in the scrolling list, switched off while it is outside the list's viewport. */
  private compactAdapter(
    adapters: ThemedButton[],
    container: Phaser.GameObjects.Container,
    zone: Phaser.GameObjects.Zone,
    hit: Rect,
    enabled: () => boolean = () => true,
  ): void {
    adapters.push({
      container,
      inputZone: zone,
      getMeasuredBounds: () => ({ hit }),
      setEnabled: (on: boolean) => {
        if (on && enabled()) zone.setInteractive({ useHandCursor: true });
        else zone.disableInteractive();
      },
    } as unknown as ThemedButton);
  }

  /** Build one setting's row at `at` (its y is the row's top) and return its height. */
  private buildCompactRow(key: SettingsRowKey, list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[]): number {
    const settings = (): typeof Services.save.data.settings => Services.save.data.settings;
    const sw = (label: string, on: () => boolean, toggle: () => void, caption?: string): number =>
      this.compactSwitchRow(list, at, adapters, label, on, toggle, caption);
    const seg = <V>(
      label: string,
      chips: readonly { value: V; label: string; enabled?: boolean }[],
      selected: () => V,
      onPick: (value: V) => void,
      caption?: string,
    ): number => this.compactSegmentsRow(list, at, adapters, label, chips, selected, onPick, caption);
    switch (key) {
      case 'sfx':
        return sw('Sound effects', () => settings().sfxOn, () => {
          settings().sfxOn = !settings().sfxOn;
          Services.save.touch();
          if (settings().sfxOn) Sfx.play('click');
        });
      case 'volume':
        return this.compactVolumeRow(list, at, adapters);
      case 'music':
        return sw('Music', () => settings().musicOn, () => Music.setEnabled(!Music.enabled));
      case 'fullScreen':
        return sw('Full screen', () => isFullScreen(), () => { void toggleFullScreen(); });
      case 'instantCast':
        return sw('Instant cast', () => settings().instantCast, () => {
          settings().instantCast = !settings().instantCast;
          Services.save.touch();
        }, `Casts spells on a single ${isTouchDevice() ? 'tap' : 'click'} instead of picking the card up.`);
      case 'landDrop':
        return sw('Confirm land drop', () => settings().confirmLandDrop, () => {
          settings().confirmLandDrop = !settings().confirmLandDrop;
          Services.save.touch();
        }, 'Ending your turn with a land still unplayed takes a second press.');
      case 'autoSkip':
        return sw('Auto-skip forced turns', () => settings().autoSkip, () => {
          settings().autoSkip = !settings().autoSkip;
          Services.save.touch();
        });
      case 'confirmDestructive':
        return sw('Confirm destructive actions', () => settings().confirmDestructive, () => {
          settings().confirmDestructive = !settings().confirmDestructive;
          Services.save.touch();
        });
      case 'keywordReminders':
        return sw('Keyword reminders', () => settings().keywordReminders, () => {
          settings().keywordReminders = !settings().keywordReminders;
          Services.save.touch();
        });
      case 'noBlock':
        return seg('Confirm no-block', NO_BLOCK_CHIPS, () => settings().confirmNoBlock, (value: ConfirmNoBlockSetting) => {
          settings().confirmNoBlock = value;
          Services.save.touch();
        });
      case 'textSize':
        return seg('Text size', TEXT_SIZE_CHIPS, () => normalizeTextScale(settings().textScale), (value) => {
          if (normalizeTextScale(settings().textScale) === value) return;
          settings().textScale = value;
          this.previewAccessibility();
        }, settingsTextSizeCaption(this.touchCaption));
      case 'highContrast':
        return sw('High contrast', () => settings().highContrast, () => {
          settings().highContrast = !settings().highContrast;
          this.previewAccessibility();
        }, 'Brighter text and solid panels. Card art is unchanged.');
      case 'animations':
        return seg('Animations', ANIM_CHIPS, () => settings().animations, (value) => {
          settings().animations = value;
          Services.save.touch();
        }, 'Effect changes apply when you next change screens.');
      case 'renderSize': {
        const lite = qualityTier() === 'lite';
        return seg(
          'Render size',
          RENDER_CHIPS.map(({ value, label, heavy }) => ({ value, label, enabled: !(lite && heavy) })),
          () => (lite ? 1 : settings().renderScale),
          (value) => this.pickRenderScale(value),
          lite
            ? 'High resolutions are disabled on this device.'
            : isTauri()
              ? 'Resizes the desktop window and reloads to apply.'
              : 'Higher sizes render sharper in the browser. Reloads to apply.',
        );
      }
      case 'stats':
        return this.compactPrivacyRow(list, at, adapters);
      case 'reset':
        return this.compactResetRow(list, at, adapters);
    }
  }

  /** A switch row: label and caption at the left, the switch at the right; the whole row toggles. */
  private compactSwitchRow(
    list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[],
    labelText: string, on: () => boolean, toggle: () => void, captionText?: string,
  ): number {
    const C = SETTINGS_COMPACT;
    const right = at.x + at.width;
    const sw = compactSwitch(this, right, 0, on());
    const textW = at.width - sw.width - C.controlGap;
    const label = this.compactLabel(at.x, 0, labelText, textW);
    const caption = captionText ? this.compactCaption(at.x, 0, captionText, textW) : null;
    const block = label.height + (caption ? C.captionGap + caption.height : 0);
    const height = Math.max(COMPACT.rowPitch, block + C.rowPad * 2);
    const top = at.y + (height - block) / 2;
    label.setY(top);
    caption?.setY(top + label.height + C.captionGap);
    sw.container.setY(at.y + height / 2);
    const zone = this.add.zone(at.x + at.width / 2, at.y + height / 2, at.width, height);
    this.bindCompactTap(zone, () => {
      toggle();
      this.refreshToggles();
    });
    list.add([label, ...(caption ? [caption] : []), sw.container, zone]);
    this.compactSwitches.push({ sw, on });
    this.compactAdapter(adapters, list, zone, { x: at.x, y: at.y, width: at.width, height });
    return height;
  }

  /** A choice row: the label, then the segmented bar the row's width, then its caption. */
  private compactSegmentsRow<V>(
    list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[],
    labelText: string, chips: readonly { value: V; label: string; enabled?: boolean }[],
    selected: () => V, onPick: (value: V) => void, captionText?: string,
  ): number {
    const C = SETTINGS_COMPACT;
    const label = this.compactLabel(at.x, at.y + C.rowPad, labelText, at.width);
    const barY = label.y + label.height + C.captionGap + 2;
    const bar = { x: at.x, y: barY, width: at.width, height: COMPACT.touch };
    const disabled = chips.map((c) => c.enabled === false);
    const segments = compactSegments(this, bar, chips.map((c) => c.label), chips.findIndex((c) => c.value === selected()),
      (i) => onPick(chips[i].value), disabled);
    let bottom = barY + COMPACT.touch;
    const caption = captionText ? this.compactCaption(at.x, bottom + C.captionGap + 2, captionText, at.width) : null;
    if (caption) bottom = caption.y + caption.height;
    list.add([label, segments.container, ...(caption ? [caption] : [])]);
    const segW = bar.width / chips.length;
    segments.zones.forEach((zone, i) => {
      this.compactAdapter(adapters, segments.container, zone, { x: segW * i, y: 0, width: segW, height: bar.height }, () => !disabled[i]);
    });
    return bottom + C.rowPad - at.y;
  }

  /** Master volume: the label, then "−", the bar and "+" beside it or, when narrow, under it. */
  private compactVolumeRow(list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[]): number {
    const C = SETTINGS_COMPACT;
    const touch = COMPACT.touch;
    const segGap = 4;
    const segW = 12;
    const barW = VOLUME_BAR.segments * segW + (VOLUME_BAR.segments - 1) * segGap;
    const controlsW = touch * 2 + barW + COMPACT.gap * 2;
    const label = this.compactLabel(at.x, 0, 'Master volume', at.width);
    const beside = label.width + C.controlGap + controlsW <= at.width;
    const controlsY = beside ? at.y + C.rowPad / 2 : at.y + C.rowPad + label.height + C.captionGap;
    label.setY(beside ? controlsY + (touch - label.height) / 2 : at.y + C.rowPad);
    const left = at.x + at.width - controlsW;
    const minus = compactButton(this, { x: left, y: controlsY, width: touch, height: touch }, '−', { onTap: () => this.stepVolume(-STEP) });
    const plus = compactButton(this, { x: at.x + at.width - touch, y: controlsY, width: touch, height: touch }, '+', { onTap: () => this.stepVolume(STEP) });
    const bar = this.add.graphics({ x: left + touch + COMPACT.gap, y: controlsY + touch / 2 });
    this.compactVolume = { bar, segW, segGap };
    const caption = this.compactCaption(at.x, controlsY + touch + C.captionGap, 'Volume is the master level; music follows it too.', at.width);
    list.add([label, minus.container, bar, plus.container, caption]);
    for (const b of [minus, plus]) this.compactAdapter(adapters, b.container, b.inputZone, { x: 0, y: 0, width: touch, height: touch });
    return caption.y + caption.height + C.rowPad - at.y;
  }

  /** Privacy: the sharing switch, then why (or whether) anything is sent beside "What is sent". */
  private compactPrivacyRow(list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[]): number {
    const C = SETTINGS_COMPACT;
    const settings = (): typeof Services.save.data.settings => Services.save.data.settings;
    // Always the SAVED choice, even when a browser signal or a dev build is
    // what is actually stopping the sends; the caption explains that.
    const switchH = this.compactSwitchRow(list, at, adapters, STATS_ROW_LABEL, () => settings().shareAnonStats,
      () => {
        toggleShareAnonStats(settings());
        Services.save.touch();
      });
    const probe = this.add.text(0, 0, STATS_PANEL_BUTTON_LABEL, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.body}px`, fontStyle: theme.weight.w600,
    });
    const buttonW = Math.ceil(probe.width) + 32;
    probe.destroy();
    const note = statsRowNoteText(statsRowNoteKind(statsRowNoteState(readSignalsGateInput(null), signalsAllowed)));
    const y = at.y + switchH;
    const caption = this.compactCaption(at.x, y, note, at.width - buttonW - C.controlGap);
    const height = Math.max(COMPACT.touch, caption.height);
    caption.setY(y + (height - caption.height) / 2);
    const button = compactButton(this, { x: at.x + at.width - buttonW, y: y + (height - COMPACT.touch) / 2, width: buttonW, height: COMPACT.touch },
      STATS_PANEL_BUTTON_LABEL, { onTap: () => this.openStatsPanel() });
    list.add([caption, button.container]);
    this.compactAdapter(adapters, button.container, button.inputZone, { x: 0, y: 0, width: buttonW, height: COMPACT.touch });
    return switchH + height + C.rowPad;
  }

  /** Reset save: a two-tap danger button (M-SettingsReset), and what it erases. */
  private compactResetRow(list: Phaser.GameObjects.Container, at: Rect, adapters: ThemedButton[]): number {
    const C = SETTINGS_COMPACT;
    const touch = COMPACT.touch;
    const label = this.compactLabel(at.x, 0, 'Reset save', at.width);
    const probe = this.add.text(0, 0, 'Click again to erase everything', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.body}px`, fontStyle: theme.weight.w600,
    });
    const armedW = Math.ceil(probe.width) + 32;
    probe.destroy();
    const beside = label.width + C.controlGap + armedW <= at.width;
    const buttonW = beside ? armedW : at.width;
    const buttonY = beside ? at.y + C.rowPad / 2 : at.y + C.rowPad + label.height + C.captionGap;
    label.setY(beside ? buttonY + (touch - label.height) / 2 : at.y + C.rowPad);
    let armed = false;
    const reset = compactButton(this, { x: at.x + at.width - buttonW, y: buttonY, width: buttonW, height: touch }, 'Reset', {
      variant: 'danger',
      onTap: (pointer) => {
        if (!armed) {
          armed = true;
          // The verb follows the press that armed it: Tap on touch, Click with a mouse.
          reset.setLabel(`${pointer.wasTouch ? 'Tap' : 'Click'} again to erase everything`);
          this.time.delayedCall(4000, () => {
            if (reset.container.active && armed) {
              armed = false;
              reset.setLabel('Reset');
            }
          });
          return;
        }
        Services.save.reset();
        window.location.reload();
      },
    });
    const caption = this.compactCaption(at.x, buttonY + touch + C.captionGap,
      'Erases your collection, decks, gold, and progress. Cannot be undone.', at.width);
    list.add([label, reset.container, caption]);
    this.compactAdapter(adapters, reset.container, reset.inputZone, { x: 0, y: 0, width: buttonW, height: touch });
    return caption.y + caption.height + C.rowPad - at.y;
  }

  // -------------------------------------------------------------------------
  // Rows
  // -------------------------------------------------------------------------

  private buildRow(key: SettingsRowKey, frame: SettingsColumnFrame): BuiltRow {
    // Read per use, never kept: a replaced save swaps the settings object's contents.
    const settings = (): typeof Services.save.data.settings => Services.save.data.settings;
    switch (key) {
      case 'sfx':
        return this.rightToggleRow(frame, 'Sound effects', () => settings().sfxOn, () => {
          settings().sfxOn = !settings().sfxOn;
          Services.save.touch();
          this.refreshToggles();
          if (settings().sfxOn) Sfx.play('click');
        });
      case 'volume':
        return this.volumeRow(frame);
      // M8: the switch follows the browser's state, so Escape or a swipe out
      // of full screen turns it off too (the listener in create()).
      case 'fullScreen':
        return this.rightToggleRow(frame, 'Full screen', () => isFullScreen(), () => { void toggleFullScreen(); });
      case 'music':
        return this.rightToggleRow(frame, 'Music', () => settings().musicOn, () => {
          Music.setEnabled(!Music.enabled);
          this.refreshToggles();
        });
      // Both "Your turn" rows decide how a turn's actions get committed.
      case 'instantCast':
        return this.rightToggleRow(
          frame,
          'Instant cast',
          () => settings().instantCast,
          () => {
            settings().instantCast = !settings().instantCast;
            Services.save.touch();
            this.refreshToggles();
          },
          `Casts spells on a single ${isTouchDevice() ? 'tap' : 'click'} instead of picking the card up.`,
        );
      case 'landDrop':
        return this.rightToggleRow(
          frame,
          'Confirm land drop',
          () => settings().confirmLandDrop,
          () => {
            settings().confirmLandDrop = !settings().confirmLandDrop;
            Services.save.touch();
            this.refreshToggles();
          },
          'Ending your turn with a land still unplayed takes a second press.',
        );
      case 'stats':
        return this.privacyRow(frame);
      case 'autoSkip':
        return this.rightToggleRow(frame, 'Auto-skip forced turns', () => settings().autoSkip, () => {
          settings().autoSkip = !settings().autoSkip;
          Services.save.touch();
          this.refreshToggles();
        });
      case 'confirmDestructive':
        return this.rightToggleRow(frame, 'Confirm destructive actions', () => settings().confirmDestructive, () => {
          settings().confirmDestructive = !settings().confirmDestructive;
          Services.save.touch();
          this.refreshToggles();
        });
      case 'keywordReminders':
        return this.rightToggleRow(frame, 'Keyword reminders', () => settings().keywordReminders, () => {
          settings().keywordReminders = !settings().keywordReminders;
          Services.save.touch();
          this.refreshToggles();
        });
      case 'noBlock':
        return this.chipRow(
          frame,
          'Confirm no-block',
          NO_BLOCK_CHIPS.map(({ value, label, baseWidth }) => ({ value, label, baseWidth })),
          () => settings().confirmNoBlock,
          (value: ConfirmNoBlockSetting) => {
            settings().confirmNoBlock = value;
            Services.save.touch();
            this.refreshChipGroups();
          },
        );
      case 'reset':
        return this.resetRow(frame);
      case 'textSize':
        return this.chipRow(
          frame,
          'Text size',
          TEXT_SIZE_CHIPS.map(({ value, label }) => ({ value, label, baseWidth: TEXT_SIZE_CHIP_WIDTH })),
          () => normalizeTextScale(settings().textScale),
          (value) => {
            if (normalizeTextScale(settings().textScale) === value) return;
            settings().textScale = value;
            this.previewAccessibility();
          },
          // Chosen the way the Instant cast caption picks tap or click.
          settingsTextSizeCaption(this.touchCaption),
        );
      case 'highContrast':
        return this.rightToggleRow(
          frame,
          'High contrast',
          () => settings().highContrast,
          () => {
            settings().highContrast = !settings().highContrast;
            this.previewAccessibility();
          },
          'Brighter text and solid panels. Card art is unchanged.',
        );
      case 'animations':
        return this.chipRow(
          frame,
          'Animations',
          ANIM_CHIPS.map(({ value, label }) => ({ value, label, baseWidth: ANIM_CHIP_WIDTH })),
          () => settings().animations,
          (value) => {
            settings().animations = value;
            Services.save.touch();
            this.refreshChipGroups();
          },
          'Effect changes apply when you next change screens.',
        );
      case 'renderSize': {
        const lite = qualityTier() === 'lite';
        // Only the desktop app can resize its window; in a browser the size is a
        // rendering resolution scaled to fit the page (src/platform/renderScale.ts).
        return this.chipRow(
          frame,
          'Render size',
          RENDER_CHIPS.map(({ value, label, heavy }) => ({
            value,
            label,
            baseWidth: RENDER_CHIP_WIDTH,
            enabled: !(lite && heavy),
          })),
          () => (lite ? 1 : settings().renderScale),
          (value) => this.pickRenderScale(value),
          lite
            ? 'High resolutions are disabled on this device.'
            : isTauri()
              ? 'Resizes the desktop window and reloads to apply.'
              : 'Higher sizes render sharper in the browser. Reloads to apply.',
        );
      }
    }
  }

  /**
   * Put a text-size or contrast change in force and show it: persist it like
   * every other setting, apply it, then rebuild this scene under the new
   * values, back on the Accessibility tab. Every other scene reads the new
   * values the next time it builds.
   */
  private previewAccessibility(): void {
    Services.save.touch();
    applySavedAccessibility(Services.save.data.settings, IS_DEV);
    this.scene.restart({ tab: 'accessibility' } satisfies SettingsSceneData);
  }

  /**
   * The shared row recipe: the label at the column's text inset, the controls
   * already at their x, and an optional caption wrapped to the column. Returns
   * what the layout needs to know and a `place` that moves everything onto
   * the y the layout picks.
   */
  private rowParts(
    frame: SettingsColumnFrame,
    labelText: string,
    controls: readonly ThemedButton[],
    captionText: string | undefined,
    extras: readonly (Phaser.GameObjects.Components.Transform)[] = [],
  ): BuiltRow {
    const label = this.add
      .text(frame.labelX, 0, labelText, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    const controlsLeft = Math.min(
      ...controls.map((c) => c.container.x - c.getMeasuredSize().visual.width / 2),
    );
    const stacked = settingsRowStacks(frame.labelX, label.width, controlsLeft);
    const caption = captionText === undefined ? null : this.caption(frame, captionText);
    return {
      stacked,
      captionLines: caption?.lines,
      place: (y) => {
        label.setY(y.label);
        for (const control of controls) control.container.setY(y.row);
        for (const extra of extras) extra.setY(y.row);
        caption?.place(y.noteTop);
      },
    };
  }

  /**
   * A caption wrapped to its column, measured: its line count, and a line
   * spacing that makes its line pitch the rhythm's caption line, so the
   * layout's caption box and the drawn text agree at every text size.
   */
  private caption(frame: SettingsColumnFrame, text: string): { lines: number; place: (noteTop: number) => void } {
    const rhythm = settingsRhythm();
    const note = this.add
      .text(frame.labelX, 0, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        wordWrap: { width: captionWrapWidth(frame) },
      })
      .setOrigin(0, 0);
    const lines = Math.max(1, note.getWrappedText().length);
    // One line's box as Phaser lays it out (the drawn height also carries the
    // descender room src/ui/textRaster.ts adds under the last line).
    const lineHeight = note.style.getTextMetrics().fontSize;
    note.setLineSpacing(rhythm.captionLine - lineHeight);
    return {
      lines,
      // Centre each drawn line in its caption-line box.
      place: (noteTop) => note.setY(noteTop + (rhythm.captionLine - lineHeight) / 2),
    };
  }

  /** A toggle row: the toggle's edge on the column's control edge. */
  private rightToggleRow(
    frame: SettingsColumnFrame,
    label: string,
    on: () => boolean,
    onTap: () => void,
    caption?: string,
  ): BuiltRow {
    const button = this.toggle(frame.controlRight - TOGGLE_WIDTH / 2, onTap, on);
    return this.rowParts(frame, label, [button], caption);
  }

  /**
   * A chip group, measure-then-place: each chip is built at its scaled floor
   * width, measured, and the group right-aligned to the column's control edge
   * from the measured widths (settingsPresentation.rightAlignedControlCenters).
   */
  private chipRow<V>(
    frame: SettingsColumnFrame,
    label: string,
    chips: readonly { value: V; label: string; baseWidth: number; enabled?: boolean }[],
    selected: () => V,
    onPick: (value: V) => void,
    caption?: string,
  ): BuiltRow {
    const buttons = new Map<unknown, ThemedButton>();
    const built = chips.map((chip) => {
      const button = this.track(
        themedButton(this, 0, 0, chip.label, {
          variant: 'ghost',
          size: 'sm',
          minWidth: scaledChipWidth(chip.baseWidth),
          enabled: chip.enabled ?? true,
          onTap: () => onPick(chip.value),
        }),
      );
      buttons.set(chip.value, button);
      return button;
    });
    const centers = rightAlignedControlCenters(built.map(measuredControl), frame.controlRight);
    built.forEach((b, i) => b.container.setX(centers[i]));
    this.chipGroups.push({ buttons, selected });
    return this.rowParts(frame, label, built, caption);
  }

  /** Master volume: "−", the drawn bar, "+", right-aligned to the control edge. */
  private volumeRow(frame: SettingsColumnFrame): BuiltRow {
    const minus = this.track(
      themedButton(this, 0, 0, '−', { variant: 'ghost', size: 'sm', minWidth: 44, onTap: () => this.stepVolume(-STEP) }),
    );
    const plus = this.track(
      themedButton(this, 0, 0, '+', { variant: 'ghost', size: 'sm', minWidth: 44, onTap: () => this.stepVolume(STEP) }),
    );
    const xs = volumeStepperXs(VOLUME_BAR_WIDTH, minus.getMeasuredSize().visual.width, frame);
    minus.container.setX(xs.minusX);
    plus.container.setX(xs.plusX);
    const bar = this.add.graphics({ x: xs.barLeft });
    this.volumeBar = bar;
    return this.rowParts(frame, 'Master volume', [minus, plus], 'Volume is the master level; music follows it too.', [bar]);
  }

  /**
   * The Privacy section: the saved sharing choice, what it means, and the panel
   * that lists every field. The row's caption explains why nothing is being
   * sent when something OTHER than this toggle is the reason, and the toggle
   * itself always shows and edits the saved choice either way, so a player
   * whose browser is refusing on their behalf can still see what they chose.
   * Its x positions are statsPrivacyPresentation's; its y, the shared rhythm's.
   */
  private privacyRow(frame: SettingsColumnFrame): BuiltRow {
    const settings = (): typeof Services.save.data.settings => Services.save.data.settings;
    const toggle = this.toggle(
      0,
      () => {
        toggleShareAnonStats(settings());
        Services.save.touch();
        this.refreshToggles();
      },
      // Always the SAVED choice, even when a browser signal or a dev build is
      // what is actually stopping the sends. The caption explains that.
      () => settings().shareAnonStats,
    );
    const panelButton = this.track(
      themedButton(this, 0, 0, STATS_PANEL_BUTTON_LABEL, {
        variant: 'ghost',
        size: 'sm',
        minWidth: STATS_SETTINGS_ROW.buttonMinWidth,
        onTap: () => this.openStatsPanel(),
      }),
    );
    // Measure-then-place, right-aligned like every row: the toggle on the
    // column's control edge with the other toggles, "What is sent" left of it.
    const pair = [panelButton, toggle];
    const centers = rightAlignedControlCenters(pair.map(measuredControl), frame.controlRight);
    pair.forEach((button, i) => button.container.setX(centers[i]));
    // The gate decides, not this scene: `signalsAllowed` is handed in whole.
    const note = statsRowNoteText(statsRowNoteKind(statsRowNoteState(readSignalsGateInput(null), signalsAllowed)));
    return this.rowParts(frame, STATS_ROW_LABEL, [panelButton, toggle], note);
  }

  /**
   * The Game tab's right column's last row, under its own "Save data" heading.
   * The row label names the setting and the button names the action, the way
   * every other row here reads; the armed state still spells out the
   * consequence. Right-aligned to the column's control edge like the toggles
   * above it, measure-then-place because the armed label is wider.
   */
  private resetRow(frame: SettingsColumnFrame): BuiltRow {
    const right = frame.controlRight;
    let armed = false;
    const reset = this.track(
      themedButton(this, right, 0, 'Reset', {
        variant: 'danger',
        size: 'sm',
        minWidth: SETTINGS_RESET_BLOCK.buttonMinWidth,
        onTap: (pointer) => {
          if (!armed) {
            armed = true;
            // The verb follows the press that armed it: Tap on touch, Click with a mouse.
            reset.setLabel(`${pointer.wasTouch ? 'Tap' : 'Click'} again to erase everything`);
            reset.setVariant('danger');
            reset.container.setX(right - reset.getMeasuredSize().hit.width / 2);
            this.time.delayedCall(4000, () => {
              if (reset.container.active && armed) {
                armed = false;
                reset.setLabel('Reset');
                reset.container.setX(right - reset.getMeasuredSize().hit.width / 2);
              }
            });
            return;
          }
          // The reload boots again, which puts the fresh save's accessibility
          // defaults in force (gameBoot.ts).
          Services.save.reset();
          window.location.reload();
        },
      }),
    );
    reset.container.setX(right - reset.getMeasuredSize().hit.width / 2);
    return this.rowParts(frame, 'Reset save', [reset], 'Erases your collection, decks, gold, and progress. Cannot be undone.');
  }

  // -------------------------------------------------------------------------
  // Pieces
  // -------------------------------------------------------------------------

  private sectionTitle(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
  }
  private toggle(x: number, onTap: () => void, on: () => boolean): ThemedButton {
    const button = this.track(
      themedButton(this, x, 0, 'Off', { variant: 'ghost', size: 'sm', minWidth: TOGGLE_WIDTH, onTap }),
    );
    this.toggles.push({ button, on });
    return button;
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
   * The update check is a control, so it sits in the header at the right,
   * mirroring the back button, and the version sits on the line under it: the
   * check is about the version. (The version used to sit at x 14 in muted
   * text, outside the frame and unreadable on the art; owner, 2026-10-08.)
   * "Legal" sits beside the check, one isolation gap to its left: both are
   * about the whole game rather than any one setting, and the pair is placed
   * from its measured widths so neither label's font fallback can push it
   * past the title-safe edge or into the centred title.
   */
  private buildVersionFooter(): void {
    const status = this.add
      .text(SETTINGS_HEADER_ACTION.right, SETTINGS_HEADER_ACTION.statusY, VERSION_LABEL, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
      })
      .setOrigin(1, 0.5);
    const check = this.track(themedButton(this, SETTINGS_HEADER_ACTION.right, SETTINGS_HEADER_ACTION.y, 'Check for updates', {
      variant: 'ghost',
      size: 'sm',
      minWidth: SETTINGS_HEADER_ACTION.minWidth,
      onTap: () => {
        status.setText(`${VERSION_LABEL} · Checking…`).setColor(theme.colors.body);
        void checkForUpdate().then((result) => {
          if (!status.active) return;
          status.setText(`${VERSION_LABEL} · ${result.message}`).setColor(SettingsScene.updateColor(result));
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
  private static updateColor(result: UpdateStatus): string {
    return result.state === 'available'
      ? theme.colors.gold
      : result.state === 'error'
        ? theme.colors.danger
        : theme.colors.success;
  }
  private stepVolume(delta: number): void {
    Sfx.setVolume(Sfx.volume + delta);
    this.refreshVolume();
    Sfx.play('click');
  }
  private refreshVolume(): void {
    if (this.compactVolume) {
      const { bar, segW, segGap } = this.compactVolume;
      const filled = Math.round(Sfx.volume * VOLUME_BAR.segments);
      const h = 22;
      bar.clear();
      for (let i = 0; i < VOLUME_BAR.segments; i++) {
        bar.fillStyle(i < filled ? colorInt(theme.colors.body) : theme.graphics.panelStroke, i < filled ? 1 : theme.alpha.chrome)
          .fillRoundedRect(i * (segW + segGap), -h / 2, segW, h, 4);
      }
      return;
    }
    const bar = this.volumeBar;
    if (!bar) return;
    const filled = Math.round(Sfx.volume * VOLUME_BAR.segments);
    const top = -VOLUME_BAR.height / 2;
    bar.clear();
    volumeSegmentXs().forEach((x, i) => {
      if (i < filled) {
        bar.fillStyle(colorInt(theme.colors.gold), 1)
          .fillRoundedRect(x, top, VOLUME_BAR.segmentWidth, VOLUME_BAR.height, 3);
      } else {
        bar.lineStyle(1, colorInt(theme.colors.muted), 0.9)
          .strokeRoundedRect(x + 0.5, top + 0.5, VOLUME_BAR.segmentWidth - 1, VOLUME_BAR.height - 1, 3);
      }
    });
  }
  private refreshToggles(): void {
    for (const { sw, on } of this.compactSwitches) sw.set(on());
    for (const { button, on } of this.toggles) {
      const value = on();
      button.setLabel(value ? 'On' : 'Off');
      button.setVariant(value ? 'selected' : 'ghost');
    }
  }
  private refreshChipGroups(): void {
    for (const { buttons, selected } of this.chipGroups) {
      const current = selected();
      for (const [value, button] of buttons) button.setVariant(value === current ? 'selected' : 'ghost');
    }
  }
  private pickRenderScale(value: RenderScaleSetting): void {
    if (Services.save.data.settings.renderScale === value) return;
    Services.save.data.settings.renderScale = value;
    Services.save.flush();
    window.location.reload();
  }
}
