import Phaser from 'phaser';
import { playDeckPickerLayout, playDeckRowColumns, playMenuLayout, playTextStack } from '../ui/playPresentation';
import { listRowAccentBar } from '../ui/controlStyle';
import { ellipsizeText } from '../ui/textFit';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { FEATURES } from '../config/features';
import { def } from '../engine/types';
import { displayVariantFor } from '../meta/Collection';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import { deckHealth } from '../meta/deckRepair';
import { firstDuelLaunchIssue } from '../meta/duelSetup';
import { Services } from '../meta/services';
import { IS_DEV } from '../platform/env';
import type { SaveData, SavedDeck } from '../meta/SaveManager';
import { bindTapButton } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { ModalGuard } from '../ui/Modal';
import { gateOnArt } from '../ui/artGate';
import { applyBackdrop, sceneStage, sceneTextureKey } from '../ui/SceneBackdrop';
import { AVATARS } from '../data/opponents';
import { compactSceneMetrics } from '../platform/compactScenes';
import { COMPACT } from '../ui/compactLayout';
import { compactButton, compactDialog, compactHeader, compactScrim, coverFitImage } from '../ui/compactWidgets';
import { bindMenuScroll } from '../ui/menuScroll';
import { compactDeckRows, compactPlayLayout, PLAY_COMPACT } from '../ui/playCompact';
import { addPortraitArt } from '../ui/portraitArt';
import { bakeUiIcon } from '../ui/uiIcons';
import type { Rect } from '../ui/layout';
import { HEADER_CURRENCY_ANCHOR } from '../ui/layout';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, pager, panel, registerSceneBackNavigation, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { loadStoryArt, storyTextureKey } from './StoryDialogue';
import {
  activeVisibleSavedDeck,
  builderFormatForDeck,
  deckBlockKind,
  deckBlockLabel,
  formatDeckSize,
  formatGauntletUnavailableCopy,
  formatLabel,
  visibleSavedDecks,
} from '../ui/deckBuilderHelpers';

/**
 * The "Play" submenu (user-directed 2026-07-14): MainMenu's game-mode rows
 * (Avatar Gauntlet + the three Practice difficulties) moved here, joined by
 * Draft (the Limited hub — the persona Bot Draft's public entry). Return goes
 * back to MainMenu. Since 2026-07-17 it also carries the active-deck plate +
 * quick deck select, so switching decks never requires a Decks-screen detour.
 */
const PLAY_ITEMS: { label: string; scene: string; data?: object }[] = [
  { label: 'Avatar Gauntlet', scene: 'Gauntlet' },
  { label: 'Draft', scene: 'Limited' },
  // The three difficulty rows collapsed into the opponent picker (1.2): pick
  // any tower avatar (their difficulty applies) or a plain training duel.
  { label: 'Practice', scene: 'PracticePicker' },
];

/** Story Mode (2.0) leads the list while its flag is on; it plays its own run deck, so no deck check applies. */
const STORY_ITEM = { label: 'Story', scene: 'Story' };

function playItems(): { label: string; scene: string; data?: object }[] {
  return FEATURES.storyLive ? [STORY_ITEM, ...PLAY_ITEMS] : PLAY_ITEMS;
}

/** The phone tiles' names and lines (mock M-Play). */
const COMPACT_TILE_COPY: Record<string, { title: string; line: string }> = {
  Story: { title: 'Story', line: 'Begin a story' },
  Gauntlet: { title: 'Avatar Gauntlet', line: 'Climb the tower' },
  Limited: { title: 'Draft', line: 'Draft against the table' },
  PracticePicker: { title: 'Practice', line: 'Spar freely' },
};

/** The phone tiles' paintings (manifest scene keys); Practice shows a rival instead. */
/** The Story tile's still: Act 1's backdrop (src/scenes/StoryScene.ts). */
const STORY_TILE_ART = 'bg-mandate-sky';

const COMPACT_TILE_ART: Record<string, string> = {
  Gauntlet: 'scene-gauntlet',
  Limited: 'pack-art',
  PracticePicker: 'scene-duel',
};

/** The Practice tile's rival: the tower's summit, which the picker lists first. */
function practiceTileCardId(): string {
  return AVATARS.reduce((top, a) => (a.tier > top.tier ? a : top), AVATARS[0]).portraitCardId;
}

export interface PlaySceneData {
  launchNotice?: string;
  /** Dev-only presentation fixtures. Never installed in Services or persisted. */
  a11yDecks?: SavedDeck[];
  a11yPicker?: boolean;
}

export class PlayScene extends Phaser.Scene {
  private fixtureSave: SaveData | null = null;
  private get save(): SaveData { return this.fixtureSave ?? Services.save.data; }
  private guard = new ModalGuard();
  /** Underlying interactive targets deadened while the deck select is open. */
  private menuTargets: Phaser.GameObjects.GameObject[] = [];
  private deckPlate: Phaser.GameObjects.Container | null = null;
  private launchNotice: Phaser.GameObjects.Container | null = null;
  private reserveFormatsEnabled = false;
  private classicRetired = false;
  /** This visit's measured layout (the row count and the marquee's measured heights). */
  private layout: ReturnType<typeof playMenuLayout> = playMenuLayout();

  constructor() {
    super('Play');
  }

  /**
   * The active-deck plate and the quick-select modal draw one face card per
   * saved deck (deckFace.ts) — nothing else here is card art.
   */
  create(data: PlaySceneData = {}): void {
    this.sys.settings.data = {};
    this.fixtureSave = IS_DEV && data.a11yDecks ? { ...Services.save.data, decks: data.a11yDecks, activeDeckId: data.a11yDecks[0]?.id ?? null } : null;
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    const faces = this.save.decks
      .map((deck) => this.deckFaceId(deck))
      .filter((id): id is string => id !== null);
    // The phone hub's Practice tile shows the summit rival.
    if (compactSceneMetrics('Play')) faces.push(practiceTileCardId());
    gateOnArt(this, faces, () => this.build(data));
  }
  private build(data: PlaySceneData): void {
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.classicRetired = FEATURES.classicRetired;
    this.guard = new ModalGuard();
    this.menuTargets = [];
    this.deckPlate = null;
    this.launchNotice = null;
    const width = 1280;
    applyBackdrop(this, 'mainmenu', {
      dim: theme.graphics.dim,
      dimAlpha: 0.5,
      fallback: () => {
        /* the clear colour shows, matching MainMenu's bare fallback */
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const items = playItems();
    // On a phone the hub draws its own compact composition (mock M-Play).
    const stage = sceneStage(this);
    if (stage.compact) {
      this.buildCompact(stage.content, items);
      if (data.launchNotice) this.showLaunchNotice(data.launchNotice);
      return;
    }
    const title = this.add
      .text(width / 2, 140, 'Play', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.displayXL}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(width / 2, 205, FEATURES.storyLive
        ? 'Begin a story, climb the tower, draft, or spar freely.'
        : 'Climb the tower, draft against the table, or spar freely.', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    // Measure, then place: a fourth row moves the marquee up only as far as it must.
    this.layout = playMenuLayout(items.length, title.height, subtitle.height);
    title.setY(this.layout.titleY);
    subtitle.setY(this.layout.subtitleY);

    this.menuTargets.push(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    // The shared currency anchor: right edge on the title-safe frame's right
    // edge, on the header line.
    goldBadge(this, HEADER_CURRENCY_ANCHOR.x, HEADER_CURRENCY_ANCHOR.y, { getValue: () => this.save.gold });

    const menu = this.layout;
    items.forEach((entry, i) => {
      const btn = themedButton(this, width / 2, menu.actionYs[i], entry.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => this.startPlayEntry(entry.scene, entry.data),
      });
      this.menuTargets.push(btn.inputZone);
    });

    this.buildDeckPlate();
    if (data.launchNotice) this.showLaunchNotice(data.launchNotice);
    if (IS_DEV && data.a11yPicker) this.showDeckSelect();
  }

  // ------------------------------------------------------------------ compact (phone)

  /** The hub's compact composition: header, one art tile per mode, the deck column. */
  private buildCompact(content: Rect, items: ReturnType<typeof playItems>): void {
    const type = theme.compactType;
    const label = this.add.text(0, 0, 'Choose your deck', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
    });
    const layout = compactPlayLayout(content, items.length, label.height);
    label.setPosition(layout.deckLabel.x + 2, layout.deckLabel.y);
    ellipsizeText(label, layout.deckLabel.width);
    const header = compactHeader(this, layout.shell, {
      title: 'Play',
      subtitle: FEATURES.storyLive
        ? 'Begin a story, climb the tower, draft, or spar freely.'
        : 'Climb the tower, draft against the table, or spar freely.',
      gold: this.save.gold,
      onBack: () => this.scene.start('MainMenu'),
    });
    this.menuTargets.push(header.back.inputZone);
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));
    items.forEach((entry, i) => this.compactModeTile(layout.tiles[i], entry));
    this.compactDeckList(layout.deckList);
    const edit = compactButton(this, layout.editDecks, 'Edit decks', {
      icon: 'pencil', fontSize: type.h2, onTap: () => this.scene.start('DeckBuilder'),
    });
    this.menuTargets.push(edit.inputZone);
  }

  /** One mode tile: its art, the name and line over a scrim, and what stands in its way. */
  private compactModeTile(rect: Rect, entry: { label: string; scene: string; data?: object }): void {
    const type = theme.compactType;
    const pad = 12;
    const copy = COMPACT_TILE_COPY[entry.scene] ?? { title: entry.label, line: '' };
    // The Gauntlet says why before it is tapped when the active deck cannot climb (M-PlayDarlings).
    const deck = this.activeDeck();
    const blocked = entry.scene === 'Gauntlet' && deck
      ? formatGauntletUnavailableCopy(builderFormatForDeck(deck, this.reserveFormatsEnabled), this.classicRetired)
      : null;
    const run = entry.scene === 'Gauntlet' ? this.save.gauntlet.run : null;
    const plate = this.add.graphics().fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    if (entry.scene === 'Story') {
      // Story's own still (the Mandate sky, Act 1's backdrop), loaded on demand like the Story scene loads it.
      loadStoryArt(this, [STORY_TILE_ART], () => {
        if (!plate.active || !this.textures.exists(storyTextureKey(STORY_TILE_ART))) return;
        const image = this.add.image(0, 0, storyTextureKey(STORY_TILE_ART));
        coverFitImage(image, rect, 0);
        // Straight above the plate, under the scrim and the words (moveAbove keeps an object already above).
        this.children.moveTo(image, this.children.getIndex(plate) + 1);
      });
    } else {
      const art = this.compactTileArt(entry.scene, rect);
      if (art && blocked) art.setAlpha(0.3);
    }
    compactScrim(this, rect, 0.45);
    this.add.graphics()
      .lineStyle(theme.control.borderWidth, blocked ? theme.graphics.panelStroke : colorInt(theme.colors.gold), blocked ? theme.alpha.chrome : 0.55)
      .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    const textW = rect.width - 2 * pad;
    let bottom = rect.y + rect.height - pad - 4;
    if (blocked) {
      const reason = this.add.text(rect.x + pad + 16, bottom, blocked, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.danger, wordWrap: { width: textW - 16 },
      }).setOrigin(0, 1);
      const lockSize = Math.round(type.label * 1.1);
      this.add.image(rect.x + pad + lockSize / 2, reason.y - reason.height + lockSize / 2 + 3, bakeUiIcon(this, 'lock'))
        .setDisplaySize(lockSize, lockSize).setTint(colorInt(theme.colors.danger));
      bottom = reason.y - reason.height - 6;
    } else if (run) {
      // A run in progress: the rung it stands on, as a pill.
      const pillH = 30;
      const text = this.add.text(0, bottom - pillH / 2, `Rung ${run.rung}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
      }).setOrigin(0, 0.5);
      const iconSize = Math.round(type.body * 1.2);
      const pillW = Math.min(textW, 12 + iconSize + 6 + text.width + 12);
      ellipsizeText(text, pillW - (12 + iconSize + 6 + 12));
      this.add.graphics()
        .lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), 0.9)
        .strokeRoundedRect(rect.x + pad, bottom - pillH, Math.min(pillW, textW), pillH, pillH / 2);
      this.add.image(rect.x + pad + 12 + iconSize / 2, bottom - pillH / 2, bakeUiIcon(this, 'sword'))
        .setDisplaySize(iconSize, iconSize).setTint(colorInt(theme.colors.gold));
      text.setX(rect.x + pad + 12 + iconSize + 6);
      this.children.bringToTop(text);
      bottom -= pillH + 10;
    }
    const line = this.add.text(rect.x + pad, bottom, copy.line, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: textW },
    }).setOrigin(0, 1);
    const title = this.add.text(rect.x + pad, line.y - line.height - 4, copy.title, {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      wordWrap: { width: textW },
    }).setOrigin(0, 1);
    // A word wider than a narrow tile (four tiles, Largest text) steps down to
    // the h2 size rather than running past the tile's edge.
    if (title.width > textW) title.setFontSize(type.h2);
    if (title.width > textW) ellipsizeText(title, textW);
    const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, zone, () => this.startPlayEntry(entry.scene, entry.data));
    this.menuTargets.push(zone);
  }

  /** A mode tile's art: a scene painting, or the summit rival for Practice. */
  private compactTileArt(sceneKey: string, rect: Rect): Phaser.GameObjects.Image | null {
    if (sceneKey === 'PracticePicker') {
      try {
        const art = addPortraitArt(this, rect.x, rect.y, practiceTileCardId(), (image) => coverFitImage(image, rect, 0.18));
        if (art) return art;
      } catch {
        // falls through to the painting
      }
    }
    const key = [COMPACT_TILE_ART[sceneKey], 'scene-mainmenu'].map((k) => k && sceneTextureKey(k)).find((k) => k && this.textures.exists(k));
    if (!key) return null;
    const image = this.add.image(0, 0, key);
    coverFitImage(image, rect, 0);
    return image;
  }

  /** The deck quick-select: every visible deck as a row; a tap makes it active. */
  private compactDeckList(list: Rect): void {
    const type = theme.compactType;
    const save = this.save;
    const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
    if (decks.length === 0) {
      // A fresh save: the free starter is claimed in the Shop.
      const noneYet = save.decks.length === 0;
      const note = this.add.text(list.x + 2, list.y, noneYet ? 'No deck yet. Claim your free starter first.' : 'No active deck selected.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: list.width - 4 },
      });
      const cta = compactButton(this, { x: list.x, y: note.y + note.height + 10, width: list.width, height: COMPACT.touch },
        noneYet ? 'To Shop' : 'Choose a deck', {
          variant: 'primary',
          onTap: () => (noneYet ? this.scene.start('Shop', { tab: 'decks' }) : this.scene.start('DeckBuilder')),
        });
      this.menuTargets.push(cta.inputZone);
      return;
    }
    const activeId = this.activeDeck()?.id ?? null;
    const thumb = PLAY_COMPACT.thumbSize;
    const textX = 10 + thumb + 10;
    const checkSize = 30;
    const content = this.add.container(0, list.y);
    const built = decks.map((deck) => {
      const format = builderFormatForDeck(deck, this.reserveFormatsEnabled);
      const unavailable = formatGauntletUnavailableCopy(format, this.classicRetired);
      const repair = deckHealth(CARD_DB, save, deck);
      const blockKind = deckBlockKind(deck, repair.blocked, this.classicRetired);
      const active = deck.id === activeId;
      const textW = list.width - textX - 10 - (active ? checkSize + 8 : 0);
      const name = this.add.text(0, 0, deck.name, {
        fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
        color: active ? theme.colors.gold : theme.colors.heading,
      });
      ellipsizeText(name, textW);
      const full = deck.cards.length === formatDeckSize(format);
      const meta = this.add.text(0, 0, `${formatLabel(format)} · `, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      });
      const count = this.add.text(0, 0, `${deck.cards.length}/${formatDeckSize(format)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600,
        color: full && !repair.blocked ? theme.colors.success : theme.colors.danger,
      });
      const warnText = blockKind ? deckBlockLabel(blockKind) : unavailable ? 'Practice only' : null;
      const warn = warnText ? this.add.text(0, 0, warnText, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.danger, wordWrap: { width: textW - 16 },
      }) : null;
      // The count drops under the format when the line would run under the tick (Largest text).
      const countBelow = meta.width + count.width > textW;
      const height = 8 + name.height + meta.height + (countBelow ? count.height : 0) + (warn ? warn.height : 0) + 8;
      return { deck, active, name, meta, count, countBelow, warn, warnLock: !!unavailable && !blockKind, height };
    });
    const rows = compactDeckRows(built.map((b) => b.height));
    const adapters: ThemedButton[] = [];
    built.forEach((b, i) => {
      const h = rows.heights[i];
      const row = this.add.container(list.x, rows.ys[i]);
      const plate = this.add.graphics()
        .fillStyle(b.active ? theme.graphics.rowFillActive : theme.graphics.panelFill, theme.alpha.panel)
        .fillRoundedRect(0, 0, list.width, h, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, b.active ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, b.active ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(0, 0, list.width, h, theme.radius.panel);
      row.add(plate);
      const faceId = this.deckFaceId(b.deck);
      const thumbRect = { x: 10, y: (h - thumb) / 2, width: thumb, height: thumb };
      if (faceId) {
        try {
          const art = addPortraitArt(this, 0, 0, faceId, (image) => coverFitImage(image, thumbRect, 0.15));
          if (art) row.add(art);
        } catch {
          // the plate shows through
        }
      }
      row.add(this.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1)
        .strokeRoundedRect(thumbRect.x, thumbRect.y, thumb, thumb, 4));
      const block = b.name.height + b.meta.height + (b.countBelow ? b.count.height : 0) + (b.warn ? b.warn.height : 0);
      let ty = (h - block) / 2;
      b.name.setPosition(textX, ty); ty += b.name.height;
      if (b.countBelow) {
        b.meta.setText(b.meta.text.replace(/ · $/, ''));
        b.meta.setPosition(textX, ty); ty += b.meta.height;
        b.count.setPosition(textX, ty); ty += b.count.height;
      } else {
        b.meta.setPosition(textX, ty);
        b.count.setPosition(textX + b.meta.width, ty); ty += b.meta.height;
      }
      row.add([b.name, b.meta, b.count]);
      if (b.warn) {
        const lockSize = b.warnLock ? Math.round(type.label * 1.1) : 0;
        b.warn.setPosition(textX + (lockSize ? lockSize + 4 : 0), ty);
        row.add(b.warn);
        if (lockSize) {
          row.add(this.add.image(textX + lockSize / 2, ty + b.warn.height / 2, bakeUiIcon(this, 'lock'))
            .setDisplaySize(lockSize, lockSize).setTint(colorInt(theme.colors.danger)));
        }
      }
      if (b.active) {
        const cx = list.width - 10 - checkSize / 2;
        row.add(this.add.graphics().fillStyle(colorInt(theme.colors.gold), 1).fillCircle(cx, h / 2, checkSize / 2));
        row.add(this.add.image(cx, h / 2, bakeUiIcon(this, 'check')).setDisplaySize(18, 18).setTint(theme.graphics.panelFill));
      }
      const zone = this.add.zone(list.width / 2, h / 2, list.width, h).setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, (pointer) => {
        // A drag that scrolled the list is not a pick.
        if (Math.abs(pointer.upY - pointer.downY) > 12) return;
        this.selectDeck(b.deck.id);
      });
      row.add(zone);
      content.add(row);
      this.menuTargets.push(zone);
      adapters.push({
        container: row,
        inputZone: zone,
        getMeasuredBounds: () => ({ hit: { x: 0, y: 0, width: list.width, height: h } }),
        setEnabled: (on: boolean) => { if (on) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); },
      } as unknown as ThemedButton);
    });
    // Start scrolled so the active deck is in view.
    const activeIndex = built.findIndex((b) => b.active);
    const initial = activeIndex < 0 ? 0 : Math.max(0, rows.ys[activeIndex] + rows.heights[activeIndex] - list.height);
    bindMenuScroll(this, content, list, rows.total, () => this.guard.isOpen, adapters, 0, undefined, initial);
  }

  /** Make a deck active and redraw the hub (its tiles read the active deck). */
  private selectDeck(id: string): void {
    if (this.save.activeDeckId === id) return;
    this.save.activeDeckId = id;
    if (!this.fixtureSave) Services.save.flush();
    this.scene.restart(this.fixtureSave ? { a11yDecks: this.fixtureSave.decks.map((d) => d) } : {});
  }

  /** A launch notice on a phone: a compact dialog with its action, or just Close. */
  private compactLaunchNotice(message: string, action?: { label: string; onTap: () => void }): void {
    const [titleText, ...rest] = message.split(': ');
    const body = rest.length ? rest.join(': ') : message;
    compactDialog(this, {
      title: rest.length ? titleText : 'Cannot start',
      message: body,
      secondary: action ? { label: 'Close', onTap: (close) => close() } : undefined,
      primary: action
        ? { label: action.label, onTap: (close) => { close(); action.onTap(); } }
        : { label: 'Close', variant: 'ghost', onTap: (close) => close() },
      dismissal: 'dismissible',
      onClose: () => this.guard.close(),
    });
    this.guard.open(this.menuTargets);
  }

  private activeDeck(): SavedDeck | null {
    const save = this.save;
    return activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled);
  }

  private startPlayEntry(scene: string, data?: object): void {
    const deck = this.activeDeck();
    // "Open Decks" opens whichever deck is active when it is pressed, never
    // the one that was active when the notice went up.
    const openDecks = {
      label: 'Open Decks',
      onTap: () => this.scene.start('DeckBuilder', { deckId: this.activeDeck()?.id }),
    };
    if (scene === 'PracticePicker') {
      const issue = firstDuelLaunchIssue(CARD_DB, this.save, deck);
      if (issue) {
        this.showLaunchNotice(`Cannot start Practice: ${issue}`, openDecks);
        return;
      }
    }
    if (scene === 'Gauntlet') {
      const issue = firstDuelLaunchIssue(CARD_DB, this.save, deck);
      if (issue) {
        this.showLaunchNotice(`Cannot start Gauntlet: ${issue}`, openDecks);
        return;
      }
      // A format the tower does not take (Darlings) used to do nothing at
      // all on this press; say why, and offer the deck switch right here.
      const format = builderFormatForDeck(deck, this.reserveFormatsEnabled);
      const unavailable = formatGauntletUnavailableCopy(format, this.classicRetired);
      if (unavailable) {
        this.showLaunchNotice(`Cannot start Gauntlet: ${unavailable}`, {
          label: 'Change Deck',
          onTap: () => this.showDeckSelect(),
        });
        return;
      }
    }
    this.scene.start(scene, data);
  }

  /** A launch notice describes the deck it was raised for; a switch retires it. */
  private clearLaunchNotice(): void {
    this.launchNotice?.destroy();
    this.launchNotice = null;
    this.menuTargets = this.menuTargets.filter((target) => target.active);
  }

  private showLaunchNotice(
    message: string,
    action?: { label: string; onTap: () => void },
  ): void {
    this.clearLaunchNotice();
    if (sceneStage(this).compact) {
      this.compactLaunchNotice(message, action);
      return;
    }
    const notice = this.add.container(0, 0);
    this.launchNotice = notice;
    const area = this.layout.notice;
    const button = action ? themedButton(this, 0, 0, action.label, {
      variant: 'ghost', size: 'sm', minWidth: 132, onTap: action.onTap,
    }) : null;
    const buttonWidth = button?.getMeasuredSize().hit.width ?? 0;
    const messageText = this.add.text(0, 0, message, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.danger,
      wordWrap: { width: Math.min(760, area.width - buttonWidth - theme.space(3)) },
    }).setOrigin(0, 0.5);
    const total = messageText.width + (button ? theme.space(3) + buttonWidth : 0);
    const left = theme.design.centerX - total / 2;
    messageText.setPosition(left, area.y + area.height / 2);
    notice.add(messageText);
    if (button) {
      button.container.setPosition(left + messageText.width + theme.space(3) + buttonWidth / 2, area.y + area.height / 2);
      notice.add(button.container);
      this.menuTargets.push(button.inputZone);
    }
  }

  /**
   * The deck a duel's hero portrait fronts: the starred per-deck hero when it
   * is still in the list, else the deck's face creature (the DuelScene
   * fallback order, minus the account-level legacy fields — a plate-sized
   * approximation is fine here).
   */
  private deckFaceId(deck: SavedDeck): string | null {
    if (builderFormatForDeck(deck, this.reserveFormatsEnabled) === 'darlings') return darlingFaceCardFor(deck, CARD_DB);
    if (deck.heroCardId && CARD_DB[deck.heroCardId] && deck.cards.includes(deck.heroCardId)) {
      return deck.heroCardId;
    }
    return faceCardFor(deck.cards, CARD_DB);
  }

  /**
   * Active-deck plate under the mode rows: face thumb + name + card count and
   * a Change button opening the quick-select modal. Rebuilt (destroy + redraw)
   * after every switch, mirroring the Shop's rebuildable deck grid.
   */
  private buildDeckPlate(): void {
    const stale = this.deckPlate;
    if (stale) {
      // menuTargets holds button inputZones (grandchildren of the plate), so
      // membership in stale.list never matches them: destroy first, then drop
      // whatever the destroy cascade deactivated.
      stale.destroy();
      this.menuTargets = this.menuTargets.filter((t) => t.active);
    }
    const c = this.add.container(0, 0);
    this.deckPlate = c;

    const save = this.save;
    const deck = this.activeDeck();
    const { x: left, y: top, width: w, height: h } = this.layout.plate;
    const cy = top + h / 2;
    c.add(panel(this, left, top, w, h));

    if (deck === null) {
      // Fresh saves (or a save with no decks) route to where a deck comes
      // from: the Shop's Decks tab while the free claim is unspent, else the
      // Decks screen. save.decks empty implies the claim is unspent in
      // practice, but check the claim flag rather than assume.
      const noneYet = save.decks.length === 0;
      c.add(
        this.add
          .text(left + 24, cy, noneYet ? 'No deck yet. Claim your free starter first.' : 'No active deck selected.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.muted,
            wordWrap: { width: w - 190 },
          })
          .setOrigin(0, 0.5),
      );
      const cta = themedButton(this, left + w - 78, cy, noneYet ? 'To Shop' : 'Choose', {
        variant: 'primary',
        size: 'sm',
        minWidth: 110,
        onTap: () =>
          noneYet ? this.scene.start('Shop', { tab: 'decks' }) : this.showDeckSelect(),
      });
      c.add(cta.container);
      this.menuTargets.push(cta.inputZone);
      return;
    }

    const faceId = this.deckFaceId(deck);
    const deckFormat = builderFormatForDeck(deck, this.reserveFormatsEnabled);
    const unavailable = formatGauntletUnavailableCopy(deckFormat, this.classicRetired);
    const repair = deckHealth(CARD_DB, save, deck);
    // An unfinished deck reads "Not playable yet"; only a finished deck a rules
    // change broke reads "Needs repair" (deckBlockKind).
    const blockKind = deckBlockKind(deck, repair.blocked, this.classicRetired);
    let textLeft = left + 24;
    if (faceId) {
      // 300x420 card at 0.18 = 54x76, comfortably inside the 96px plate.
      c.add(makeCardThumb(this, left + 46, cy, def(CARD_DB, faceId), 0.18, undefined, displayVariantFor(save, faceId)));
      textLeft = left + 86;
    }
    const tag = this.add.text(textLeft, 0, unavailable ? formatLabel(deckFormat).toUpperCase() + ' DECK' : 'ACTIVE DECK', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
    });
    const name = this.add.text(textLeft, 0, deck.name, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`, color: theme.colors.gold,
    });
    const maxNameW = left + w - 164 - textLeft;
    ellipsizeText(name, maxNameW);
    const status = this.add.text(textLeft, 0, blockKind ? deckBlockLabel(blockKind) : unavailable ?? (deck.cards.length + '/' + formatDeckSize(deckFormat) + ' cards'), {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`,
      color: repair.blocked || unavailable ? theme.colors.danger : deck.cards.length === formatDeckSize(deckFormat) ? theme.colors.success : theme.colors.danger,
      wordWrap: { width: maxNameW },
    });
    const text = [tag, name, status];
    const stack = playTextStack(text.map((t) => t.height), 0, theme.space(2));
    text.forEach((t, i) => t.setY(cy - stack.bottom / 2 + stack.ys[i]));
    c.add(text);
    const change = themedButton(this, left + w - 78, repair.blocked ? cy + 28 : cy, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 110,
      onTap: () => this.showDeckSelect(),
    });
    c.add(change.container);
    this.menuTargets.push(change.inputZone);
    if (repair.blocked) {
      const fix = themedButton(this, left + w - 78, cy - 28, 'Fix', {
        variant: 'primary',
        size: 'sm',
        minWidth: 110,
        onTap: () => this.scene.start('DeckBuilder', { deckId: deck.id }),
      });
      c.add(fix.container);
      this.menuTargets.push(fix.inputZone);
    }
  }

  /**
   * Quick deck select: a compact modal listing every saved deck. Tapping a row
   * sets it active (activeDeckId + flush) and closes; like the Decks screen's
   * picker, ANY saved deck is selectable (no legality gate there either) but
   * the count colors red when it is not a legal 60. Edit Decks routes into the
   * full Decks screen for building/renaming.
   */
  private showDeckSelect(): void {
    // On a phone the deck column is the select; nothing opens over it.
    if (sceneStage(this).compact) return;
    const save = this.save;
    const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
    const built = decks.map((deck) => {
      const format = builderFormatForDeck(deck, this.reserveFormatsEnabled);
      const unavailable = formatGauntletUnavailableCopy(format, this.classicRetired);
      const repair = deckHealth(CARD_DB, save, deck);
      const blockKind = deckBlockKind(deck, repair.blocked, this.classicRetired);
      const active = deck.id === this.activeDeck()?.id;
      const name = this.add.text(0, 0, deck.name, {
        fontFamily: theme.fonts.display, fontSize: `${theme.type.label}px`, color: active ? theme.colors.gold : theme.colors.heading,
      });
      const badge = this.add.text(0, 0, blockKind ? `${formatLabel(format)} · ${deckBlockLabel(blockKind)}` : formatLabel(format), {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, color: repair.blocked || unavailable ? theme.colors.danger : theme.colors.muted,
      });
      const count = this.add.text(0, 0, deck.cards.length + '/' + formatDeckSize(format), {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`,
        color: repair.blocked || unavailable ? theme.colors.danger : deck.cards.length === formatDeckSize(format) ? theme.colors.success : theme.colors.danger,
      }).setOrigin(1, 0.5);
      const state = this.add.text(0, 0, unavailable ? 'Practice only' : active ? 'Using' : 'Use', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, fontStyle: theme.weight.w600,
        color: unavailable ? theme.colors.danger : active ? theme.colors.gold : theme.colors.body,
      }).setOrigin(1, 0.5);
      return { deck, active, name, badge, count, state };
    });
    const rowWidth = 820 - theme.space(12);
    const rightWidth = Math.max(0, ...built.map((r) => r.count.width + r.state.width + theme.space(3)));
    const nameWidth = playDeckRowColumns({ x: 0, width: rowWidth }, 0, 0, rightWidth).nameWidth;
    for (const row of built) {
      ellipsizeText(row.name, nameWidth);
      row.badge.setWordWrapWidth(nameWidth);
    }
    const layout = playDeckPickerLayout(decks.length,
      Math.max(0, ...built.map((r) => r.name.height)), Math.max(0, ...built.map((r) => r.badge.height)));
    const shell = modalShell(this, { width: layout.width, height: layout.height, titleTrackHeight: layout.titleTrackHeight,
      dismissal: 'dismissible', onClose: () => this.guard.close() });
    this.guard.open(this.menuTargets);
    const c = shell.container;
    const content = shell.tracks.contentBounds;
    c.add(this.add.text(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y, 'Choose Your Deck', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    }));
    const select = (id: string): void => {
      save.activeDeckId = id;
      if (!this.fixtureSave) Services.save.flush();
      shell.close();
      this.clearLaunchNotice();
      this.buildDeckPlate();
    };
    const rows = built.map((r) => {
      const row = this.add.container(0, 0).setVisible(false);
      const band = this.add.rectangle(content.x + rowWidth / 2, 0, rowWidth, layout.rowHeight,
        r.active ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .setStrokeStyle(theme.control.borderWidth, r.active ? colorInt(theme.colors.gold) : theme.graphics.panelStroke)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, band, () => select(r.deck.id));
      band.on('pointerover', (pointer: Phaser.Input.Pointer) => { if (!pointer.wasTouch) band.setFillStyle(theme.graphics.rowFillActive, theme.alpha.panel); });
      band.on('pointerout', () => band.setFillStyle(r.active ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel));
      const columns = playDeckRowColumns({ x: content.x, width: rowWidth }, r.state.width, r.count.width, rightWidth);
      r.state.setPosition(columns.stateRight, 0);
      r.count.setPosition(columns.countRight, 0);
      const stack = playTextStack([r.name.height, r.badge.height], 0, theme.space(1));
      r.name.setPosition(columns.nameX, -stack.bottom / 2);
      r.badge.setPosition(r.name.x, -stack.bottom / 2 + stack.ys[1]);
      row.add([band, r.name, r.badge, r.count, r.state]);
      if (r.active) {
        const mark = listRowAccentBar({ x: content.x, y: -layout.rowHeight / 2, width: rowWidth, height: layout.rowHeight });
        row.add(this.add.graphics().fillStyle(colorInt(theme.colors.gold), 1).fillRect(mark.x, mark.y, mark.width, mark.height));
      }
      c.add(row);
      return { row, band };
    });
    const pages = Math.max(1, Math.ceil(decks.length / layout.pageSize));
    let pageControl: ReturnType<typeof pager> | null = null;
    const renderPage = (page: number): void => {
      rows.forEach(({ row, band }, i) => {
        const index = i - page * layout.pageSize;
        const visible = index >= 0 && index < layout.pageSize;
        row.setVisible(visible);
        if (visible) { row.setY(layout.rowYs[index]); band.setInteractive({ useHandCursor: true }); }
        else band.disableInteractive();
      });
      pageControl?.refresh(page, pages);
    };
    if (pages > 1) {
      pageControl = pager(this, content.x + content.width / 2 - 44, layout.pagerY, 0, pages, renderPage);
      c.add(pageControl.container);
    }
    renderPage(0);
    const footer = shell.tracks.footerTrack;
    c.add(themedButton(this, footer.x + footer.width / 2, footer.y + footer.height / 2, 'Edit Decks', {
      variant: 'ghost', size: 'sm', minWidth: 140, onTap: () => this.scene.start('DeckBuilder'),
    }).container);
  }
}
