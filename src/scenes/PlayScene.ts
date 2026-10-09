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
import { applyBackdrop } from '../ui/SceneBackdrop';
import { HEADER_CURRENCY_ANCHOR } from '../ui/layout';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, pager, panel, registerSceneBackNavigation, themedButton } from '../ui/themeWidgets';
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

    this.add
      .text(width / 2, 140, 'Play', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.displayXL}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 205, 'Climb the tower, draft against the table, or spar freely.', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    this.menuTargets.push(backButton(this, 'Menu', () => this.scene.start('MainMenu')));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    // The shared currency anchor: right edge on the title-safe frame's right
    // edge, on the header line.
    goldBadge(this, HEADER_CURRENCY_ANCHOR.x, HEADER_CURRENCY_ANCHOR.y, { getValue: () => this.save.gold });

    const menu = playMenuLayout();
    PLAY_ITEMS.forEach((entry, i) => {
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
    const notice = this.add.container(0, 0);
    this.launchNotice = notice;
    const area = playMenuLayout().notice;
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
    const { x: left, y: top, width: w, height: h } = playMenuLayout().plate;
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
