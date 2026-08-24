import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { AVATARS } from '../data/opponents';
import type { Difficulty } from '../meta/Economy';
import { firstDuelLaunchIssue, practiceDuelLaunchData } from '../meta/duelSetup';
import { Services } from '../meta/services';
import { attachTouchGestures } from '../platform/gestures';
import { TAP_SLOP_PX } from '../platform/gestureCore';
import { applyBackdrop } from '../ui/SceneBackdrop';
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
  type StripLayoutOptions,
} from '../ui/boosterStripLayout';
import { colorInt, theme } from '../ui/theme';
import { backButton, registerSceneBackNavigation, themedButton, type ThemedButton } from '../ui/themeWidgets';

/**
 * The strip scrolls COLUMNS, and each column stacks two rivals. Twenty avatars
 * in one row meant sixteen snap positions to reach the end; paired into ten
 * columns it is six, and eight rivals are on screen at once instead of four.
 * The two rows move as one unit because they are children of one column tile.
 */
const PICKER_ROWS = 2;
const PICKER_COLUMN_TOP = 130;
const PICKER_COLUMN_HEIGHT = 396;
const PICKER_ROW_GAP = 14;
const PICKER_ROW_HEIGHT = (PICKER_COLUMN_HEIGHT - PICKER_ROW_GAP) / PICKER_ROWS;

const PICKER_STRIP_OPTIONS: StripLayoutOptions = {
  visibleCount: 4,
  tileWidth: 206,
  tileHeight: PICKER_COLUMN_HEIGHT,
  tileStride: 248,
  viewport: {
    x: theme.design.safeLeft,
    y: 126,
    width: theme.design.safeWidth,
    height: 404,
  },
  verticalBand: { y: PICKER_COLUMN_TOP, height: PICKER_COLUMN_HEIGHT },
  tapBand: { y: PICKER_COLUMN_TOP, height: PICKER_COLUMN_HEIGHT },
  peekY: PICKER_COLUMN_TOP,
};

// addPortrait cover-crops, so the window can be any aspect: at two rows the
// card sits wider than tall and shows a head-and-shoulders band rather than
// letterboxing a 0.8 portrait into a short cell.
const PICKER_NAME_BAND = 40;
const PICKER_PORTRAIT_WIDTH = 190;
const PICKER_PORTRAIT_HEIGHT = PICKER_ROW_HEIGHT - PICKER_NAME_BAND - 10;
const WHEEL_STEP_THRESHOLD = 60;
const WHEEL_STEP_COOLDOWN_MS = 250;

/**
 * Practice opponent picker. Practice is one decision flow: choose an avatar,
 * then choose the AI strength. Every launch carries both values, so the chosen
 * avatar always supplies the real deck and personality while difficulty only
 * changes the brain that pilots them. No gauntlet state is read or written.
 */
export class PracticePickerScene extends Phaser.Scene {
  private selectedAvatarId = AVATARS[AVATARS.length - 1]?.id ?? '';
  private tileNodes: {
    id: string;
    column: number;
    container: Phaser.GameObjects.Container;
    box: Phaser.GameObjects.Rectangle;
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

  constructor() {
    super('PracticePicker');
  }

  create(): void {
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.selectedAvatarId = AVATARS[AVATARS.length - 1]?.id ?? '';
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

    this.add
      .text(width / 2, 48, 'Practice', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 86, 'Choose a rival, then choose how hard they fight.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    this.buildRoster();
    this.buildDifficultyActions();

    const activeDeck = activeVisibleSavedDeck(
      Services.save.data.decks,
      Services.save.data.activeDeckId,
      this.reserveFormatsEnabled,
    );
    if (activeDeck?.format === 'darlings') {
      showDarlingsTutorial(this, {
        onReadMore: () => this.scene.start('Glossary', {
          focus: 'Darlings',
          returnTo: { scene: 'PracticePicker' },
        }),
      });
    }

    backButton(this, 'Play', () => this.scene.start('Play'));
    registerSceneBackNavigation(this, () => this.scene.start('Play'));
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
    const columns = Math.ceil(roster.length / PICKER_ROWS);
    const selectedIndex = Math.max(0, roster.findIndex((av) => av.id === this.selectedAvatarId));
    const layout = boosterStripLayout(columns, Math.floor(selectedIndex / PICKER_ROWS), PICKER_STRIP_OPTIONS);
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
    maskSource.fillStyle(0xffffff, 1);
    maskSource.fillRect(
      layout.viewport.x,
      layout.viewport.y,
      layout.viewport.width,
      layout.viewport.height,
    );
    maskSource.setVisible(false);
    content.setMask(maskSource.createGeometryMask());

    roster.forEach((av, index) => {
      const column = Math.floor(index / PICKER_ROWS);
      const row = index % PICKER_ROWS;
      const columnX = layout.tileCenters[column] ?? layout.firstCenter;
      const rowTop = PICKER_COLUMN_TOP + row * (PICKER_ROW_HEIGHT + PICKER_ROW_GAP);
      const tile = this.add.container(columnX, 0);
      const box = this.add
        .rectangle(
          0,
          rowTop + PICKER_ROW_HEIGHT / 2,
          layout.tileWidth,
          PICKER_ROW_HEIGHT,
          theme.graphics.rowFill,
          theme.alpha.panel,
        )
        .setStrokeStyle(2, colorInt(theme.colors.panelStroke));
      // The name is centered in a reserved band rather than hung below a
      // fixed baseline, so wrapped names cannot escape the cell.
      const nameBandTop = rowTop + PICKER_ROW_HEIGHT - PICKER_NAME_BAND - 5;
      const name = this.add
        .text(0, nameBandTop + PICKER_NAME_BAND / 2, av.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          align: 'center',
          lineSpacing: -2,
          wordWrap: { width: layout.tileWidth - 16 },
        })
        .setOrigin(0.5, 0.5);
      if (name.height > PICKER_NAME_BAND) name.setScale(PICKER_NAME_BAND / name.height);

      tile.add([box, name]);
      content.add(tile);
      const portrait = this.addPortrait(
        av.portraitCardId,
        columnX,
        rowTop + 5 + PICKER_PORTRAIT_HEIGHT / 2,
        PICKER_PORTRAIT_WIDTH,
        PICKER_PORTRAIT_HEIGHT,
        content,
      );
      this.tileNodes.push({ id: av.id, column, container: tile, box, name, portrait });
    });

    const arrowY = layout.fullTileRects[0].y + layout.fullTileRects[0].height / 2;
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
      (pointer.worldY - PICKER_COLUMN_TOP) / (PICKER_ROW_HEIGHT + PICKER_ROW_GAP),
    );
    if (row < 0 || row >= PICKER_ROWS) return;
    const rowTop = PICKER_COLUMN_TOP + row * (PICKER_ROW_HEIGHT + PICKER_ROW_GAP);
    if (pointer.worldY > rowTop + PICKER_ROW_HEIGHT) return;
    const tile = this.tileNodes[decision.index * PICKER_ROWS + row];
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
    // control. Arrows move a full page; drag and peek taps move one tile.
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
      .text(640, 568, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];
    difficulties.forEach((difficulty, index) => {
      const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      themedButton(this, 476 + index * 164, 624, label, {
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
      node.box.setStrokeStyle(selected ? 3 : 2, colorInt(selected ? theme.colors.goldHover : theme.colors.panelStroke));
      // Names are display-only. The scene-level strip Zone owns tile hits, so
      // recoloring a Text cannot leave a stale Text hit area behind.
      node.name.setColor(selected ? theme.colors.gold : theme.colors.body);
    }

    const selected = AVATARS.find((av) => av.id === this.selectedAvatarId);
    this.selectionLabel?.setText(selected ? `Face ${selected.name}` : 'Choose a rival');
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
    if (!this.launchNotice || !this.launchNotice.active) {
      this.launchNotice = this.add
        .text(640, 592, message, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.danger,
          align: 'center',
          wordWrap: { width: 900 },
        })
        .setOrigin(0.5);
    } else {
      this.launchNotice.setText(message);
    }
    this.launchNoticeAction?.destroy();
    this.launchNoticeAction = null;
    if (action) {
      const button = themedButton(this, 640, 680, action.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 132,
        onTap: action.onTap,
      });
      this.launchNoticeAction = button.container;
    }
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
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return null;
      const img = this.add.image(x, y, ref.textureKey, ref.frameName);
      const scale = Math.max(targetW / img.width, targetH / img.height) * 1.1;
      img.setScale(scale);
      const cropW = Math.min(img.width, targetW / scale);
      const cropH = Math.min(img.height, targetH / scale);
      const cropX = (img.width - cropW) / 2;
      // Bias the window upward so faces sit in frame, the same 7% the masked
      // version applied by nudging the image instead of the crop.
      const cropY = Math.max(
        0,
        Math.min(img.height - cropH, (img.height - cropH) / 2 - (targetH * 0.07) / scale),
      );
      img.setCrop(cropX, cropY, cropW, cropH);
      // A crop renders where it sits inside the frame, so re-centre the
      // cropped window on the tile.
      img.y = y - (cropY + cropH / 2 - img.height / 2) * scale;
      parent.add(img);
      return img;
    } catch {
      // The tokenized tile and name remain usable if art is unavailable.
      return null;
    }
  }
}
