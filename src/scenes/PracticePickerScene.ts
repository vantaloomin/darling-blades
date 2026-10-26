import Phaser from 'phaser';
import { fitMenuName } from '../ui/menuText';
import { practicePickerLayout, menuSelectionMark } from '../ui/playPresentation';
import { ellipsizeText } from '../ui/textFit';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { IS_DEV } from '../platform/env';
import { CARD_DB } from '../data/catalog';
import { AVATARS } from '../data/opponents';
import type { Difficulty } from '../meta/Economy';
import { firstDuelLaunchIssue, practiceDuelLaunchData } from '../meta/duelSetup';
import { Services } from '../meta/services';
import { attachTouchGestures } from '../platform/gestures';
import { TAP_SLOP_PX } from '../platform/gestureCore';
import { gateOnArt } from '../ui/artGate';
import { prefetchDuelArt } from '../ui/duelArt';
import { addPortraitArt } from '../ui/portraitArt';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { COMPACT, DESKTOP_GRID, isDesktopStage } from '../ui/compactLayout';
import { compactButton, compactDialog, compactHeader, compactSegments, coverFitImage, desktopTextPanel, type CompactButton } from '../ui/compactWidgets';
import { bindMenuScroll } from '../ui/menuScroll';
import { ModalGuard } from '../ui/Modal';
import { compactPracticeLayoutFitting, PRACTICE_COMPACT, practiceGridHeight, rivalShortName, practiceTilePosition, type CompactPracticeLayout } from '../ui/practiceCompact';
import { bindTapButton } from '../platform/gestures';
import { bakeUiIcon } from '../ui/uiIcons';
import type { Rect } from '../ui/layout';
import { showDarlingsTutorial } from '../ui/DarlingsTutorial';
import { activeVisibleSavedDeck } from '../ui/deckBuilderHelpers';
import {
  boosterStripIndexForOffset,
  boosterStripLayout,
  boosterStripOffsetForIndex,
  boosterStripTap,
  boosterStripTileIsVisible,
  boosterStripVisibility,
  clampBoosterStripOffset,
  type BoosterStripLayout,
} from '../ui/boosterStripLayout';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { colorInt, theme } from '../ui/theme';
import {
  backButton,
  registerSceneBackNavigation,
  sceneHasOpenModal,
  themedButton,
  type ThemedButton,
} from '../ui/themeWidgets';

/**
 * The strip scrolls COLUMNS, and each column stacks two rivals. Twenty avatars
 * in one row meant sixteen snap positions to reach the end; paired into ten
 * columns it is six, and eight rivals are on screen at once instead of four.
 * The two rows move as one unit because they are children of one column tile.
 */
const WHEEL_STEP_THRESHOLD = 60;
const WHEEL_STEP_COOLDOWN_MS = 250;
/** Desktop pass: the picked rival's name and title inset on their panel (at most COMPACT.gap beside the grid). */
const HERO_TEXT_INSET = COMPACT.gap;
/** Desktop pass: the column's blurb and "Difficulty" inset on their panel (sides, then top and bottom). */
const COLUMN_TEXT_INSET = 12;
const COLUMN_TEXT_PAD_Y = 8;

/**
 * Practice opponent picker. Practice is one decision flow: choose an avatar,
 * then choose the AI strength. Every launch carries both values, so the chosen
 * avatar always supplies the real deck and personality while difficulty only
 * changes the brain that pilots them. No gauntlet state is read or written.
 */
export class PracticePickerScene extends Phaser.Scene {
  private picker = practicePickerLayout();
  private selectedAvatarId = AVATARS[AVATARS.length - 1]?.id ?? '';
  private tileNodes: {
    id: string;
    column: number;
    container: Phaser.GameObjects.Container;
    box: Phaser.GameObjects.Rectangle;
    selectedMark: Phaser.GameObjects.Graphics;
    name: Phaser.GameObjects.Text;
    portrait: Phaser.GameObjects.Image | null;
  }[] = [];
  private pickerStripContent: Phaser.GameObjects.Container | null = null;
  private pickerStripZone: Phaser.GameObjects.Zone | null = null;
  private pickerStripLayout: BoosterStripLayout | null = null;
  private pickerArrows: { left: ThemedButton; right: ThemedButton } | null = null;
  private pickerStripIndex = 0;
  private pickerStripOffset = 0;
  private pickerStripPointerId: number | null = null;
  private pickerStripDragStartX = 0;
  private pickerStripDragStartOffset = 0;
  private pickerStripDragging = false;
  private pickerWheelAccum = 0;
  private pickerWheelLastStepAt = Number.NEGATIVE_INFINITY;
  private selectionLabel: Phaser.GameObjects.Text | null = null;
  private launchNotice: Phaser.GameObjects.Text | null = null;
  private launchNoticeAction: Phaser.GameObjects.Container | null = null;
  private reserveFormatsEnabled = false;
  private a11yFixture = false;
  private fixtureAvatarId: string | null = null;
  /** The compact (phone) composition's live parts; null on the wide profile. */
  private compact: {
    layout: CompactPracticeLayout;
    tiles: { id: string; plate: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Container; rect: Rect }[];
    hero: Phaser.GameObjects.GameObject[];
    blurb: Phaser.GameObjects.Container | null;
    launch: CompactButton;
    difficulty: Difficulty;
  } | null = null;
  private compactTargets: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();

  constructor() {
    super('PracticePicker');
  }

  /** The picker strip draws all 26 avatar portrait cards. */
  create(data: { a11yFixture?: boolean; a11yAvatarId?: string } = {}): void {
    this.a11yFixture = IS_DEV && data.a11yFixture === true;
    this.fixtureAvatarId = this.a11yFixture && AVATARS.some((av) => av.id === data.a11yAvatarId) ? data.a11yAvatarId! : null;
    this.sys.settings.data = {};
    gateOnArt(this, AVATARS.map((avatar) => avatar.portraitCardId), () => this.build());
  }
  private build(): void {
    this.picker = practicePickerLayout();
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.selectedAvatarId = this.fixtureAvatarId ?? AVATARS[AVATARS.length - 1]?.id ?? '';
    this.tileNodes = [];
    this.pickerStripContent = null;
    this.pickerStripZone = null;
    this.pickerStripLayout = null;
    this.pickerArrows = null;
    this.pickerStripIndex = 0;
    this.pickerStripOffset = 0;
    this.pickerStripPointerId = null;
    this.pickerStripDragStartX = 0;
    this.pickerStripDragStartOffset = 0;
    this.pickerStripDragging = false;
    this.pickerWheelAccum = 0;
    this.pickerWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.selectionLabel = null;
    this.launchNotice = null;
    this.launchNoticeAction = null;
    this.compact = null;
    this.compactTargets = [];
    this.guard = new ModalGuard();

    // Design-space constants, NOT this.scale (see src/platform/renderScale.ts).
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'gauntlet', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.58,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.dim),
          colorInt(theme.colors.dim),
          1,
        );
        bg.fillRect(0, 0, width, height);
      },
    });

    this.input.on('gameobjectover', this.onGameObjectOver, this);
    this.input.on('gameobjectup', this.onGameObjectUp, this);
    this.input.on('pointermove', this.onPickerPointerMove, this);
    this.input.on('pointerup', this.onPickerPointerUp, this);
    this.input.on('pointerupoutside', this.onPickerPointerUp, this);
    this.input.on('wheel', this.onPickerWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    Music.setMood('menu');

    // On a phone the picker draws its own compact composition (mock M-Practice).
    const stage = sceneStage(this);
    if (stage.compact) {
      this.buildCompact(stage.content);
      this.offerDarlingsTutorial();
      return;
    }

    sceneTitle(this, 'Practice');
    sceneSubtitle(this, 'Choose a rival, then choose how hard they fight.', { fontSize: theme.type.label });

    this.buildRoster();
    this.buildDifficultyActions();

    backButton(this, 'Play', () => this.scene.start('Play'));
    registerSceneBackNavigation(this, () => this.scene.start('Play'));
    this.offerDarlingsTutorial();
  }

  /** The once-per-save Darlings explainer, when the active deck is a Darlings deck. */
  private offerDarlingsTutorial(): void {
    const activeDeck = activeVisibleSavedDeck(
      Services.save.data.decks,
      Services.save.data.activeDeckId,
      this.reserveFormatsEnabled,
    );
    if (!this.a11yFixture && activeDeck?.format === 'darlings') {
      showDarlingsTutorial(this, {
        onReadMore: () => this.scene.start('Glossary', {
          focus: 'Darlings',
          returnTo: { scene: 'PracticePicker' },
        }),
      });
    }
  }

  // ------------------------------------------------------------------ compact (phone)

  /** The picker's compact composition: the picked rival, the rival grid, difficulty and the launch. */
  private buildCompact(content: Rect): void {
    const type = theme.compactType;
    const label = this.add.text(0, 0, 'Difficulty', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
    });
    const roster = [...AVATARS].sort((a, b) => b.tier - a.tier);
    const names = roster.map((av) => this.add.text(0, 0, rivalShortName(av.name), {
      fontFamily: theme.fonts.display, fontSize: `${type.label}px`, fontStyle: theme.weight.w700,
      color: theme.colors.heading, align: 'center',
    }).setOrigin(0.5));
    // Every name in one size (mixed sizes in one list read as a fault): the
    // largest that holds each name in two lines without breaking a word.
    const sizes = [type.label, type.label - 1, type.label - 2];
    const fitAt = (size: number, width: number): boolean => names.map((n, i) => {
      n.setFontSize(size);
      wrapTileName(n, rivalShortName(roster[i].name), width);
      return n.width <= width;
    }).every(Boolean);
    const layout = compactPracticeLayoutFitting(content, label.height, (w) => sizes.some((size) => fitAt(size, w)),
      isDesktopStage(sceneStage(this))
        ? { minTileW: DESKTOP_GRID.practiceTileMinW, wholeRows: true, textPanel: { inset: COLUMN_TEXT_INSET, padY: COLUMN_TEXT_PAD_Y } }
        : {});
    const nameW = layout.tileW - 2 * PRACTICE_COMPACT.nameInset;
    fitAt(sizes.find((size) => fitAt(size, nameW)) ?? sizes[sizes.length - 1], nameW);
    label.setPosition(layout.difficultyLabel.x, layout.difficultyLabel.y);
    // Desktop pass: the blurb and "Difficulty" read over one faded panel, the column's width.
    if (layout.textPanel) this.children.moveBelow(desktopTextPanel(this, layout.textPanel, 0), label);
    const header = compactHeader(this, layout.shell, {
      title: 'Practice',
      subtitle: 'Choose a rival, then choose how hard they fight.',
      onBack: () => this.scene.start('Play'),
    });
    this.compactTargets.push(header.back.inputZone);
    registerSceneBackNavigation(this, () => this.scene.start('Play'));

    const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];
    const segments = compactSegments(this, layout.segments, ['Easy', 'Medium', 'Hard'], 1, (i) => {
      if (this.compact) this.compact.difficulty = difficulties[i];
    });
    this.compactTargets.push(...segments.zones);
    const launch = compactButton(this, layout.launch, 'Face', {
      variant: 'primary', fontSize: type.h2, onTap: () => this.startPractice(this.compact?.difficulty ?? 'medium'),
    });
    this.compactTargets.push(launch.inputZone);
    this.compact = { layout, tiles: [], hero: [], blurb: null, launch, difficulty: 'medium' };
    this.buildCompactGrid(layout, roster, names);
    this.selectCompactRival(this.selectedAvatarId);
  }

  /** Every rival, summit first, in a grid that scrolls vertically. */
  private buildCompactGrid(layout: CompactPracticeLayout, roster: readonly (typeof AVATARS)[number][], names: Phaser.GameObjects.Text[]): void {
    const { grid, gridView, gridStep, columns, tileW, tileH } = layout;
    // Even one column too narrow for a name: it keeps its first line whole.
    const nameW = tileW - 2 * PRACTICE_COMPACT.nameInset;
    names.forEach((n) => {
      if (n.width <= nameW) return;
      const lines = n.text.split('\n');
      ellipsizeText(n, nameW, lines[0]);
    });
    const nameBand = Math.max(...names.map((n) => n.height)) + 10;
    const content = this.add.container(0, grid.y);
    const adapters: ThemedButton[] = [];
    const badgeSize = 24;
    roster.forEach((av, i) => {
      const pos = practiceTilePosition(i, columns, tileW, tileH);
      const rect = { x: grid.x + pos.x, y: pos.y, width: tileW, height: tileH };
      const tile = this.add.container(0, 0);
      const plate = this.add.graphics();
      tile.add(plate);
      const artRect = { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - nameBand - 2 };
      try {
        const art = addPortraitArt(this, artRect.x, artRect.y, av.portraitCardId, (image) => coverFitImage(image, artRect, 0.12));
        if (art) tile.add(art);
      } catch {
        // the plate and name stand in for missing art
      }
      const name = names[i].setPosition(rect.x + rect.width / 2, rect.y + rect.height - nameBand / 2);
      name.setData('a11yTextHeight', nameBand - 4);
      name.setData('a11yMaxLines', 2);
      tile.add(name);
      const badge = this.add.container(rect.x + rect.width - 6 - badgeSize / 2, rect.y + 6 + badgeSize / 2);
      badge.add(this.add.graphics().fillStyle(colorInt(theme.colors.gold), 1).fillCircle(0, 0, badgeSize / 2));
      badge.add(this.add.image(0, 0, bakeUiIcon(this, 'check')).setDisplaySize(15, 15).setTint(theme.graphics.panelFill));
      tile.add(badge);
      const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, (pointer) => {
        // A drag that scrolled the grid is not a pick.
        if (Math.abs(pointer.upY - pointer.downY) > 12) return;
        this.selectCompactRival(av.id);
      });
      tile.add(zone);
      content.add(tile);
      this.compactTargets.push(zone);
      this.compact?.tiles.push({ id: av.id, plate, name, badge, rect });
      adapters.push({
        container: tile,
        inputZone: zone,
        getMeasuredBounds: () => ({ hit: rect }),
        setEnabled: (on: boolean) => { if (on) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); },
      } as unknown as ThemedButton);
    });
    const total = practiceGridHeight(roster.length, columns, tileH);
    // Start scrolled so the picked rival is in view.
    const index = Math.max(0, roster.findIndex((av) => av.id === this.selectedAvatarId));
    const bottom = practiceTilePosition(index, columns, tileW, tileH).y + tileH;
    bindMenuScroll(this, content, gridView, total, () => this.guard.isOpen, adapters, gridStep, undefined, Math.max(0, bottom - gridView.height));
  }

  /** Pick a rival: her tile, her column on the left, her blurb, and the launch label follow. */
  private selectCompactRival(id: string): void {
    const compact = this.compact;
    const av = AVATARS.find((a) => a.id === id) ?? AVATARS[AVATARS.length - 1];
    if (!compact || !av) return;
    this.selectedAvatarId = av.id;
    for (const tile of compact.tiles) {
      const selected = tile.id === av.id;
      const r = tile.rect;
      tile.plate.clear()
        .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, 1)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel)
        .lineStyle(selected ? theme.outline.state : theme.control.borderWidth,
          selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, selected ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
      tile.name.setColor(selected ? theme.colors.gold : theme.colors.heading);
      tile.badge.setVisible(selected);
    }
    this.buildCompactHero(compact.layout.hero, av);
    this.buildCompactBlurb(compact.layout.blurb, av.blurb);
    const launch = compact.launch;
    // The rival's name whole where it can be: the label steps down a size
    // before it is shortened.
    launch.label.setFontSize(theme.compactType.h2);
    launch.setLabel(`Face ${av.name}`);
    const room = compact.layout.launch.width - 24;
    if (launch.label.width > room) {
      launch.label.setFontSize(theme.compactType.body);
      launch.setLabel(launch.label.text);
    }
    if (launch.label.width > room) {
      ellipsizeText(launch.label, room);
      launch.setLabel(launch.label.text);
    }
    prefetchDuelArt(this, { opponentId: av.id });
  }

  /** The picked rival, large, with her name and title under her. */
  private buildCompactHero(hero: Rect, av: (typeof AVATARS)[number]): void {
    const compact = this.compact;
    if (!compact) return;
    for (const obj of compact.hero) obj.destroy();
    const type = theme.compactType;
    // Desktop pass: her name and title sit inset on a faded panel as wide as the portrait.
    const desktop = isDesktopStage(sceneStage(this));
    const inset = desktop ? HERO_TEXT_INSET : 0;
    const textX = hero.x + inset;
    const textW = hero.width - 2 * inset;
    const name = this.add.text(textX, 0, av.name, {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700,
      color: theme.colors.heading, wordWrap: { width: textW },
    });
    const title = this.add.text(textX, 0, av.title, {
      fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: 'italic',
      color: theme.colors.gold, wordWrap: { width: textW },
    }).setPadding({ right: 2 });
    // The portrait keeps the mock's proportion while the words fit under it;
    // long names step down before the portrait shrinks under its floor.
    const portraitH = (): number => Math.min(Math.round(hero.width * 1.17), hero.height - 8 - name.height - 2 - title.height - inset);
    if (portraitH() < hero.width * 0.8) name.setFontSize(type.h2);
    if (portraitH() < hero.width * 0.8) title.setFontSize(type.label);
    const artRect = { x: hero.x, y: hero.y, width: hero.width, height: Math.max(COMPACT.touch, portraitH()) };
    const frame = this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRoundedRect(artRect.x, artRect.y, artRect.width, artRect.height, theme.radius.panel);
    const objects: Phaser.GameObjects.GameObject[] = [frame];
    try {
      const inset = { x: artRect.x + 2, y: artRect.y + 2, width: artRect.width - 4, height: artRect.height - 4 };
      const art = addPortraitArt(this, inset.x, inset.y, av.portraitCardId, (image) => coverFitImage(image, inset, 0.1));
      if (art) objects.push(art);
    } catch {
      // the frame stands in for missing art
    }
    objects.push(this.add.graphics()
      .lineStyle(theme.outline.state, colorInt(theme.colors.gold), 1)
      .strokeRoundedRect(artRect.x, artRect.y, artRect.width, artRect.height, theme.radius.panel));
    name.setY(artRect.y + artRect.height + 8);
    title.setY(name.y + name.height + 2);
    // Anything still past the column's foot gives way on one line each.
    if (title.y + title.height + inset > hero.y + hero.height) {
      name.setWordWrapWidth(0); ellipsizeText(name, textW);
      title.setWordWrapWidth(0); ellipsizeText(title, textW);
      title.setY(name.y + name.height + 2);
    }
    if (desktop) {
      const words = { x: textX, y: name.y, width: textW, height: title.y + title.height - name.y };
      const panel = desktopTextPanel(this, words, inset);
      this.children.moveBelow(panel, name);
      objects.push(panel);
    }
    objects.push(name, title);
    compact.hero = objects;
  }

  /** The rival's blurb at the column's top, scrolling in whole lines when it runs long. */
  private buildCompactBlurb(rect: Rect, text: string): void {
    const compact = this.compact;
    if (!compact) return;
    compact.blurb?.destroy();
    // On the desktop's panel the rect is already the inset text's own.
    const panelled = compact.layout.textPanel !== null;
    const blurb = this.add.text(rect.x + (panelled ? 0 : 2), 0, text, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.body}px`, color: theme.colors.body,
      lineSpacing: theme.space(1), wordWrap: { width: rect.width - (panelled ? 0 : 10) },
    });
    const lines = Math.max(1, blurb.getWrappedText().length);
    const lineHeight = (blurb.height - blurb.lineSpacing * (lines - 1)) / lines;
    const linePitch = lineHeight + blurb.lineSpacing;
    blurb.setData('a11yWholeLines', { lineHeight, linePitch });
    const container = this.add.container(0, rect.y);
    container.add(blurb);
    // A viewport of whole lines, so no line is ever cut in half at its foot.
    const viewport = { ...rect, height: Math.max(lineHeight, Math.floor((rect.height + blurb.lineSpacing) / linePitch) * linePitch - blurb.lineSpacing) };
    bindMenuScroll(this, container, viewport, blurb.height, () => this.guard.isOpen, undefined, linePitch);
    compact.blurb = container;
  }

  /** A launch notice on a phone: a compact dialog with its action. */
  private compactLaunchNotice(message: string, action?: { label: string; onTap: () => void }): void {
    const [titleText, ...rest] = message.split(': ');
    compactDialog(this, {
      title: rest.length ? titleText : 'Cannot start',
      message: rest.length ? rest.join(': ') : message,
      secondary: action ? { label: 'Close', onTap: (close) => close() } : undefined,
      primary: action
        ? { label: action.label, onTap: (close) => { close(); action.onTap(); } }
        : { label: 'Close', variant: 'ghost', onTap: (close) => close() },
      dismissal: 'dismissible',
      onClose: () => this.guard.close(),
    });
    this.guard.open(this.compactTargets);
  }

  /**
   * One summit-first horizontal strip. The shared strip math owns clamping,
   * masked visibility, peeks, and tap classification; this scene only supplies
   * avatar rendering and maps a full-tile action to rival selection.
   */
  private buildRoster(): void {
    const roster = [...AVATARS].sort((a, b) => b.tier - a.tier);
    // Column-major: a column holds ranks 2n and 2n+1, so scrolling walks the
    // tier order continuously instead of jumping a whole row at a time.
    // Measure full wrapped names before sharing a band height across the strip.
    const names = roster.map((av) => {
      const text = this.add.text(0, 0, av.name, {
        fontFamily: theme.fonts.display, fontSize: `${theme.type.caption}px`, color: theme.colors.body, align: 'center',
      }).setOrigin(0.5);
      fitMenuName(text, 206 - theme.space(4));
      return text;
    });
    this.picker = practicePickerLayout(Math.max(...names.map((text) => text.height)));
    const columns = Math.ceil(roster.length / this.picker.rows);
    const selectedIndex = Math.max(0, roster.findIndex((av) => av.id === this.selectedAvatarId));
    const layout = boosterStripLayout(columns, Math.floor(selectedIndex / this.picker.rows), {
      visibleCount: 4, tileWidth: 206, tileHeight: this.picker.columnHeight, tileStride: 248,
      viewport: this.picker.viewport,
      verticalBand: { y: this.picker.columnTop, height: this.picker.columnHeight },
      tapBand: { y: this.picker.columnTop, height: this.picker.columnHeight }, peekY: this.picker.columnTop,
    });
    this.pickerStripLayout = layout;

    const content = this.add.container(0, 0);
    this.pickerStripContent = content;
    const zone = this.add
      .zone(
        layout.tapBand.x + layout.tapBand.width / 2,
        layout.tapBand.y + layout.tapBand.height / 2,
        layout.tapBand.width,
        layout.tapBand.height,
      )
      .setInteractive({ useHandCursor: true });
    this.pickerStripZone = zone;
    zone.on('pointerdown', this.onPickerStripDown, this);
    attachTouchGestures(this, zone, { onTap: this.onPickerStripTap });

    const maskSource = this.add.graphics();
    maskSource.fillStyle(theme.graphics.panelFill, 1);
    maskSource.fillRect(
      layout.viewport.x,
      layout.viewport.y,
      layout.viewport.width,
      layout.viewport.height,
    );
    maskSource.setVisible(false);
    content.setMask(maskSource.createGeometryMask());

    roster.forEach((av, index) => {
      const column = Math.floor(index / this.picker.rows);
      const row = index % this.picker.rows;
      const columnX = layout.tileCenters[column] ?? layout.firstCenter;
      const rowTop = this.picker.columnTop + row * (this.picker.rowHeight + this.picker.rowGap);
      const tile = this.add.container(columnX, 0);
      const box = this.add
        .rectangle(
          0,
          rowTop + this.picker.rowHeight / 2,
          layout.tileWidth,
          this.picker.rowHeight,
          theme.graphics.rowFill,
          theme.alpha.panel,
        )
        .setStrokeStyle(2, colorInt(theme.colors.panelStroke));
      // The name is centered in a reserved band rather than hung below a
      // fixed baseline, so wrapped names cannot escape the cell.
      const nameBandTop = rowTop + this.picker.rowHeight - this.picker.nameBand - 5;
      const name = names[index].setPosition(0, nameBandTop + this.picker.nameBand / 2);
      name.setData('a11yTextHeight', this.picker.nameBand - theme.space(2));
      const selectedMark = this.add.graphics();

      tile.add([box, name, selectedMark]);
      content.add(tile);
      const portrait = this.addPortrait(
        av.portraitCardId,
        columnX,
        rowTop + 5 + this.picker.portraitHeight / 2,
        this.picker.portraitWidth,
        this.picker.portraitHeight,
        content,
      );
      this.tileNodes.push({ id: av.id, column, container: tile, box, selectedMark, name, portrait });
    });

    const arrowY = this.picker.arrowY;
    const leftArrow = themedButton(this, layout.arrowCenters.left, arrowY, '‹', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setPickerStripIndex(this.pickerStripIndex - layout.visibleCount),
    });
    const rightArrow = themedButton(this, layout.arrowCenters.right, arrowY, '›', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 52,
      onTap: () => this.setPickerStripIndex(this.pickerStripIndex + layout.visibleCount),
    });
    this.pickerArrows = { left: leftArrow, right: rightArrow };

    this.setPickerStripIndex(layout.currentIndex, false);
    this.refreshSelection();
  }

  private readonly onGameObjectOver = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.wasTouch) Sfx.play('hover');
  };

  private readonly onGameObjectUp = (): void => {
    Sfx.play('click');
  };

  private readonly onPickerStripDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pickerStripContent || !this.pickerStripLayout || this.pickerStripPointerId !== null) return;
    this.tweens.killTweensOf(this.pickerStripContent);
    this.pickerStripPointerId = pointer.id;
    this.pickerStripDragStartX = pointer.worldX;
    this.pickerStripDragStartOffset = this.pickerStripContent.x;
    this.pickerStripDragging = false;
  };

  private readonly onPickerPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pickerStripContent || !this.pickerStripLayout) return;
    if (this.pickerStripPointerId !== pointer.id) return;
    const delta = pointer.worldX - this.pickerStripDragStartX;
    if (!this.pickerStripDragging && Math.abs(delta) > TAP_SLOP_PX) this.pickerStripDragging = true;
    if (!this.pickerStripDragging) return;
    const offset = clampBoosterStripOffset(this.pickerStripLayout, this.pickerStripDragStartOffset + delta);
    this.pickerStripContent.x = offset;
    this.updatePickerStripState(offset);
  };

  private readonly onPickerStripTap = (pointer: Phaser.Input.Pointer): void => {
    if (this.pickerStripDragging) return;
    this.handlePickerStripTap(pointer);
  };

  private handlePickerStripTap(pointer: Phaser.Input.Pointer): void {
    if (!this.pickerStripContent || !this.pickerStripLayout || this.pickerStripDragging) return;
    const decision = boosterStripTap(
      this.pickerStripLayout,
      this.pickerStripContent.x,
      pointer.worldX,
      pointer.worldY,
    );
    if (decision.kind === 'scroll') {
      this.setPickerStripIndex(decision.targetIndex);
      return;
    }
    if (decision.kind !== 'buy') return;
    // The shared strip classifies the COLUMN; the row comes from where in the
    // column the tap landed, and the gap between rows selects nothing.
    const row = Math.floor(
      (pointer.worldY - this.picker.columnTop) / (this.picker.rowHeight + this.picker.rowGap),
    );
    if (row < 0 || row >= this.picker.rows) return;
    const rowTop = this.picker.columnTop + row * (this.picker.rowHeight + this.picker.rowGap);
    if (pointer.worldY > rowTop + this.picker.rowHeight) return;
    const tile = this.tileNodes[decision.index * this.picker.rows + row];
    if (!tile) return;
    this.selectedAvatarId = tile.id;
    this.refreshSelection();
  }

  private readonly onPickerPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.pickerStripPointerId !== pointer.id) return;
    const wasDragging = this.pickerStripDragging;
    this.pickerStripPointerId = null;
    this.pickerStripDragging = false;
    if (wasDragging) {
      this.snapPickerStripToNearest();
      return;
    }
    if (pointer.wasTouch) return;
    this.handlePickerStripTap(pointer);
  };

  private readonly onPickerWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: unknown,
    deltaX: number,
    deltaY: number,
  ): void => {
    if (!this.pickerStripLayout) return;
    // Scene-level wheel input bypasses the modal's dim (playbook trap), so the
    // strip behind the Darlings tutorial would scroll under it.
    if (sceneHasOpenModal(this)) return;
    const viewport = this.pickerStripLayout.viewport;
    if (
      pointer.worldX < viewport.x ||
      pointer.worldX > viewport.x + viewport.width ||
      pointer.worldY < viewport.y ||
      pointer.worldY > viewport.y + viewport.height
    ) return;
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    if (delta === 0) return;
    this.pickerWheelAccum += delta;
    if (Math.abs(this.pickerWheelAccum) < WHEEL_STEP_THRESHOLD) return;
    const now = this.time.now;
    if (now - this.pickerWheelLastStepAt < WHEEL_STEP_COOLDOWN_MS) return;
    const direction = Math.sign(this.pickerWheelAccum);
    this.pickerWheelAccum -= direction * WHEEL_STEP_THRESHOLD;
    this.pickerWheelLastStepAt = now;
    this.setPickerStripIndex(this.pickerStripIndex + direction);
  };

  private snapPickerStripToNearest(): void {
    if (!this.pickerStripContent || !this.pickerStripLayout) return;
    this.setPickerStripIndex(boosterStripIndexForOffset(this.pickerStripLayout, this.pickerStripContent.x));
  }

  private updatePickerStripState(offset: number): void {
    if (!this.pickerStripLayout) return;
    this.pickerStripOffset = clampBoosterStripOffset(this.pickerStripLayout, offset);
    this.pickerStripIndex = boosterStripIndexForOffset(this.pickerStripLayout, this.pickerStripOffset);
    const visibility = boosterStripVisibility(this.pickerStripLayout, this.pickerStripOffset);
    // Visibility is per COLUMN: both rivals in a column appear and hide together.
    for (const tile of this.tileNodes) {
      const showTile = boosterStripTileIsVisible(this.pickerStripLayout, tile.column, this.pickerStripOffset);
      const fullTile = tile.column >= visibility.firstFullIndex && tile.column <= visibility.lastFullIndex;
      tile.container.setVisible(showTile);
      tile.portrait?.setVisible(showTile);
      tile.name.setVisible(fullTile);
    }
    // A disabled arrow is also hidden, so the strip never presents a dead end
    // control. Arrows move a full page; drag and the wheel move one column.
    // The 59px edge peeks are a hint only: under the 90px tap floor, they take
    // no taps (boosterStripLayout's peekTappable).
    const leftEnabled = this.pickerStripIndex > 0;
    const rightEnabled = this.pickerStripIndex < this.pickerStripLayout.maxIndex;
    this.pickerArrows?.left.container.setVisible(leftEnabled);
    this.pickerArrows?.right.container.setVisible(rightEnabled);
    if (leftEnabled) this.pickerArrows?.left.inputZone.setInteractive({ useHandCursor: true });
    else this.pickerArrows?.left.inputZone.disableInteractive();
    if (rightEnabled) this.pickerArrows?.right.inputZone.setInteractive({ useHandCursor: true });
    else this.pickerArrows?.right.inputZone.disableInteractive();
  }

  private setPickerStripIndex(index: number, tween = true): void {
    if (!this.pickerStripContent || !this.pickerStripLayout) return;
    const targetIndex = Math.min(this.pickerStripLayout.maxIndex, Math.max(0, Math.trunc(index)));
    const targetOffset = boosterStripOffsetForIndex(this.pickerStripLayout, targetIndex);
    this.tweens.killTweensOf(this.pickerStripContent);
    if (!tween) {
      this.pickerStripContent.x = targetOffset;
      this.updatePickerStripState(targetOffset);
      return;
    }
    this.tweens.add({
      targets: this.pickerStripContent,
      x: targetOffset,
      duration: 220,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.updatePickerStripState(this.pickerStripContent?.x ?? targetOffset),
      onComplete: () => this.updatePickerStripState(targetOffset),
    });
  }

  private readonly onShutdown = (): void => {
    this.input.off('gameobjectover', this.onGameObjectOver, this);
    this.input.off('gameobjectup', this.onGameObjectUp, this);
    this.input.off('pointermove', this.onPickerPointerMove, this);
    this.input.off('pointerup', this.onPickerPointerUp, this);
    this.input.off('pointerupoutside', this.onPickerPointerUp, this);
    this.input.off('wheel', this.onPickerWheel, this);
    this.pickerStripPointerId = null;
    this.pickerStripDragging = false;
    this.pickerWheelAccum = 0;
    this.pickerWheelLastStepAt = Number.NEGATIVE_INFINITY;
    this.pickerStripContent = null;
    this.pickerStripZone = null;
    this.pickerStripLayout = null;
    this.pickerArrows = null;
  };

  private buildDifficultyActions(): void {
    this.selectionLabel = this.add
      .text(640, this.picker.selectionY, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];
    difficulties.forEach((difficulty, index) => {
      const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      themedButton(this, 476 + index * 164, this.picker.difficultyY, label, {
        variant: 'ghost',
        minWidth: 148,
        onTap: () => this.startPractice(difficulty),
      });
    });

    this.refreshSelection();
  }

  private refreshSelection(): void {
    for (const node of this.tileNodes) {
      const selected = node.id === this.selectedAvatarId;
      node.box.setFillStyle(
        selected ? theme.graphics.rowFillActive : theme.graphics.rowFill,
        selected ? 1 : theme.alpha.panel,
      );
      node.box.setStrokeStyle(selected ? theme.outline.state : 2, colorInt(selected ? theme.colors.goldHover : theme.colors.panelStroke));
      // Names are display-only. The scene-level strip Zone owns tile hits, so
      // recoloring a Text cannot leave a stale Text hit area behind.
      node.name.setColor(selected ? theme.colors.gold : theme.colors.body);
      node.selectedMark.clear();
      if (selected) {
        const mark = menuSelectionMark({ visual: { x: -node.box.width / 2, y: node.box.y - node.box.height / 2,
          width: node.box.width, height: node.box.height }, labelWidth: node.name.width, padding: theme.space(4) }, theme.outline.state);
        node.selectedMark.fillStyle(colorInt(theme.colors.gold), 1).fillRect(mark.x, mark.y, mark.width, mark.height);
      }
    }

    const selected = AVATARS.find((av) => av.id === this.selectedAvatarId);
    this.selectionLabel?.setText(selected ? `Face ${selected.name}` : 'Choose a rival');
    if (this.selectionLabel) ellipsizeText(this.selectionLabel, theme.design.safeWidth - theme.space(8));
    if (selected) prefetchDuelArt(this, { opponentId: selected.id });
  }

  private startPractice(difficulty: Difficulty): void {
    const selected = AVATARS.find((av) => av.id === this.selectedAvatarId);
    if (!selected) return;
    const activeDeck = activeVisibleSavedDeck(
      Services.save.data.decks,
      Services.save.data.activeDeckId,
      this.reserveFormatsEnabled,
    );
    const issue = firstDuelLaunchIssue(CARD_DB, Services.save.data, activeDeck);
    if (issue) {
      this.showLaunchNotice(`Cannot start Practice: ${issue}`, {
        label: 'Open Decks',
        onTap: () => this.scene.start('DeckBuilder', { deckId: activeDeck?.id }),
      });
      return;
    }
    this.scene.start('Duel', practiceDuelLaunchData(selected.id, difficulty));
  }

  private showLaunchNotice(
    message: string,
    action?: { label: string; onTap: () => void },
  ): void {
    if (this.compact) {
      this.compactLaunchNotice(message, action);
      return;
    }
    if (!this.launchNotice || !this.launchNotice.active) {
      this.launchNotice = this.add
        .text(0, this.picker.noticeY, message, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.danger,
          align: 'center',
          wordWrap: { width: 900 },
        })
        .setOrigin(0, 0.5);
    } else {
      this.launchNotice.setText(message);
    }
    this.launchNoticeAction?.destroy();
    this.launchNoticeAction = null;
    // The message and its action read as one line on the footer line, the
    // pair centred on the frame and placed from measured widths.
    const gap = theme.space(3);
    let actionWidth = 0;
    let button: ThemedButton | null = null;
    if (action) {
      button = themedButton(this, 0, this.picker.noticeY, action.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 132,
        onTap: action.onTap,
      });
      actionWidth = button.getMeasuredSize().hit.width;
      this.launchNoticeAction = button.container;
    }
    const noticeWidth = this.launchNotice.width;
    const left = theme.design.safeCenterX - (noticeWidth + (button ? gap + actionWidth : 0)) / 2;
    this.launchNotice.setX(left);
    button?.container.setX(left + noticeWidth + gap + actionWidth / 2);
  }

  /**
   * Render an avatar portrait cropped to the tile window.
   *
   * The crop is done in texture space rather than with a geometry mask. A mask
   * here would be a second stencil nested inside the strip's own masked
   * content container, and Phaser's WebGL renderer does not nest geometry
   * masks: once the strip scrolled, every portrait rendered offset from its
   * tile even though image and mask agreed on their world transforms.
   */
  private addPortrait(
    cardId: string,
    x: number,
    y: number,
    targetW: number,
    targetH: number,
    parent: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Image | null {
    try {
      const img = addPortraitArt(this, x, y, cardId, (art) => {
        const scale = Math.max(targetW / art.width, targetH / art.height) * 1.1;
        art.setScale(scale);
        const cropW = Math.min(art.width, targetW / scale);
        const cropH = Math.min(art.height, targetH / scale);
        const cropX = (art.width - cropW) / 2;
        // Bias the window upward so faces sit in frame, the same 7% the masked
        // version applied by nudging the image instead of the crop.
        const cropY = Math.max(
          0,
          Math.min(art.height - cropH, (art.height - cropH) / 2 - (targetH * 0.07) / scale),
        );
        art.setCrop(cropX, cropY, cropW, cropH);
        // A crop renders where it sits inside the frame, so re-centre the
        // cropped window on the tile.
        art.y = y - (cropY + cropH / 2 - art.height / 2) * scale;
      });
      if (!img) return null;
      parent.add(img);
      return img;
    } catch {
      // The tokenized tile and name remain usable if art is unavailable.
      return null;
    }
  }
}

/**
 * Set a grid name on at most two lines, broken where the longer line is
 * shortest: at a space, or just after a hyphen ("The Marsh-|Mother"), never
 * mid-word. One line when it fits. The caller checks the width that results.
 */
function wrapTileName(text: Phaser.GameObjects.Text, name: string, width: number): void {
  text.setWordWrapWidth(0);
  text.setText(name);
  if (text.width <= width) return;
  let best = name;
  let bestW = Number.POSITIVE_INFINITY;
  for (let i = 1; i < name.length; i++) {
    const breakAfter = name[i - 1] === '-' || name[i] === ' ';
    if (!breakAfter) continue;
    const candidate = `${name.slice(0, i).trimEnd()}\n${name.slice(i).trimStart()}`;
    text.setText(candidate);
    if (text.width < bestW) {
      bestW = text.width;
      best = candidate;
    }
  }
  text.setText(best);
}
