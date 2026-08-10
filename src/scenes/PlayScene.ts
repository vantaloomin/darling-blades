import Phaser from 'phaser';
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
import type { SavedDeck } from '../meta/SaveManager';
import { bindTapButton } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, pager, panel, registerSceneBackNavigation, themedButton } from '../ui/themeWidgets';
import {
  activeVisibleSavedDeck,
  builderFormatForDeck,
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

/** Deck rows per quick-select page (7 x 48px pitch fits the 520-tall shell). */
const DECK_PAGE_SIZE = 7;

export class PlayScene extends Phaser.Scene {
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

  create(data: { launchNotice?: string } = {}): void {
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

    backButton(this, 'Menu', () => this.scene.start('MainMenu'));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    goldBadge(this, width - 30, 30, { getValue: () => Services.save.data.gold });

    const firstY = 286;
    const pitchY = 56;
    PLAY_ITEMS.forEach((entry, i) => {
      const btn = themedButton(this, width / 2, firstY + i * pitchY, entry.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => this.startPlayEntry(entry.scene, entry.data),
      });
      this.menuTargets.push(btn.inputZone);
    });

    this.buildDeckPlate();
    if (data.launchNotice) this.showLaunchNotice(data.launchNotice);
  }

  private activeDeck(): SavedDeck | null {
    const save = Services.save.data;
    return activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled);
  }

  private startPlayEntry(scene: string, data?: object): void {
    const deck = this.activeDeck();
    if (scene === 'PracticePicker') {
      const issue = firstDuelLaunchIssue(CARD_DB, Services.save.data, deck);
      if (issue) {
        this.showLaunchNotice(`Cannot start Practice: ${issue}`, {
          label: 'Open Decks',
          onTap: () => this.scene.start('DeckBuilder', { deckId: deck?.id }),
        });
        return;
      }
    }
    if (scene === 'Gauntlet') {
      const issue = firstDuelLaunchIssue(CARD_DB, Services.save.data, deck);
      if (issue) {
        this.showLaunchNotice(`Cannot start Gauntlet: ${issue}`, {
          label: 'Open Decks',
          onTap: () => this.scene.start('DeckBuilder', { deckId: deck?.id }),
        });
        return;
      }
      const format = builderFormatForDeck(deck, this.reserveFormatsEnabled);
      if (formatGauntletUnavailableCopy(format, this.classicRetired)) {
        this.buildDeckPlate();
        return;
      }
    }
    this.scene.start(scene, data);
  }

  private showLaunchNotice(
    message: string,
    action?: { label: string; onTap: () => void },
  ): void {
    this.launchNotice?.destroy();
    this.menuTargets = this.menuTargets.filter((target) => target.active);
    const notice = this.add.container(0, 0);
    this.launchNotice = notice;
    notice.add(
      this.add
        .text(640, action ? 466 : 500, message, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.danger,
          align: 'center',
          wordWrap: { width: 620 },
        })
        .setOrigin(0.5),
    );
    if (action) {
      const button = themedButton(this, 640, 502, action.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 132,
        onTap: action.onTap,
      });
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

    const save = Services.save.data;
    const deck = this.activeDeck();
    const w = 480;
    const h = 96;
    const left = 640 - w / 2;
    const cy = 570;
    const top = cy - h / 2;
    c.add(panel(this, left, top, w, h, { alpha: 0.7 }));

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
    let textLeft = left + 24;
    if (faceId) {
      // 300x420 card at 0.18 = 54x76, comfortably inside the 96px plate.
      c.add(makeCardThumb(this, left + 46, cy, def(CARD_DB, faceId), 0.18, undefined, displayVariantFor(save, faceId)));
      textLeft = left + 86;
    }
    c.add(
      this.add
        .text(textLeft, cy - 26, unavailable ? formatLabel(deckFormat).toUpperCase() + ' DECK' : 'ACTIVE DECK', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5),
    );
    const name = this.add
      .text(textLeft, cy, deck.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    const maxNameW = left + w - 150 - textLeft;
    if (name.width > maxNameW) name.setScale(maxNameW / name.width);
    c.add(name);
    c.add(
      this.add
        .text(textLeft, cy + 25, repair.blocked ? 'Needs repair' : unavailable ?? (deck.cards.length + '/' + formatDeckSize(deckFormat) + ' cards'), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: repair.blocked || unavailable ? theme.colors.danger : deck.cards.length === formatDeckSize(deckFormat) ? theme.colors.success : theme.colors.danger,
          wordWrap: { width: w - 190 },
        })
        .setOrigin(0, 0.5),
    );
    const change = themedButton(this, left + w - 78, repair.blocked ? cy + 22 : cy, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 110,
      onTap: () => this.showDeckSelect(),
    });
    c.add(change.container);
    this.menuTargets.push(change.inputZone);
    if (repair.blocked) {
      const fix = themedButton(this, left + w - 78, cy - 22, 'Fix', {
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
    const save = Services.save.data;
    const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
    const shell = modalShell(this, {
      width: 620,
      height: 520,
      tapDimToClose: true,
      onClose: () => this.guard.close(),
    });
    this.guard.open(this.menuTargets);
    const c = shell.container;
    const content = shell.tracks.contentBounds;
    c.add(
      this.add
        .text(shell.tracks.titleTrack.x + shell.tracks.titleTrack.width / 2, shell.tracks.titleTrack.y + shell.tracks.titleTrack.height / 2, 'Choose Your Deck', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );

    const select = (id: string): void => {
      save.activeDeckId = id;
      Services.save.flush();
      shell.close();
      this.buildDeckPlate();
    };

    const rowW = content.width - 32;
    const rowX = content.x + 16;
    const pitch = 48;
    const listTop = content.y + 30;
    const pages = Math.max(1, Math.ceil(decks.length / DECK_PAGE_SIZE));
    let pageControl: ReturnType<typeof pager> | null = null;
    let rowItems: Phaser.GameObjects.GameObject[] = [];
    const renderPage = (page: number): void => {
      for (const item of rowItems) if (item.active) item.destroy();
      rowItems = [];
      const visible = decks.slice(page * DECK_PAGE_SIZE, (page + 1) * DECK_PAGE_SIZE);
      visible.forEach((deck, i) => {
        const y = listTop + i * pitch;
        const isActive = deck.id === this.activeDeck()?.id;
        const band = this.add
          .rectangle(rowX + rowW / 2, y, rowW, 40, isActive ? theme.graphics.rowFillActive : theme.graphics.rowFill, 0.9)
          .setStrokeStyle(
            theme.control.borderWidth,
            colorInt(isActive ? theme.colors.gold : theme.colors.panelStroke),
            isActive ? 1 : theme.alpha.chrome,
          )
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, band, () => select(deck.id));
        band.on('pointerover', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasTouch && !isActive) band.setFillStyle(theme.graphics.rowFillActive, 0.9);
        });
        band.on('pointerout', () => {
          if (!isActive) band.setFillStyle(theme.graphics.rowFill, 0.9);
        });
        const deckFormat = builderFormatForDeck(deck, this.reserveFormatsEnabled);
        const unavailable = formatGauntletUnavailableCopy(deckFormat, this.classicRetired);
        const repair = deckHealth(CARD_DB, save, deck);
        const name = this.add
          .text(rowX + 16, y - 7, deck.name, {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.label}px`,
            color: isActive ? theme.colors.gold : theme.colors.heading,
          })
          .setOrigin(0, 0.5);
        if (name.width > rowW - 200) name.setScale((rowW - 200) / name.width);
        const badge = this.add
          .text(rowX + 16, y + 12, repair.blocked ? `${formatLabel(deckFormat)} · Needs repair` : formatLabel(deckFormat), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: repair.blocked || unavailable ? theme.colors.danger : theme.colors.muted,
          })
          .setOrigin(0, 0.5);
        const count = this.add
          .text(rowX + rowW - 84, y, deck.cards.length + '/' + formatDeckSize(deckFormat), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: repair.blocked || unavailable ? theme.colors.danger : deck.cards.length === formatDeckSize(deckFormat) ? theme.colors.success : theme.colors.danger,
          })
          .setOrigin(1, 0.5);
        const state = this.add
          .text(rowX + rowW - 16, y, unavailable ? 'Practice only' : isActive ? 'Using' : 'Use', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: theme.weight.w600,
            color: unavailable ? theme.colors.danger : isActive ? theme.colors.gold : theme.colors.body,
          })
          .setOrigin(1, 0.5);
        for (const item of [band, name, badge, count, state]) {
          rowItems.push(item);
          c.add(item);
        }
      });
      pageControl?.refresh(page, pages);
    };
    if (pages > 1) {
      pageControl = pager(this, content.x + content.width / 2 - 44, listTop + DECK_PAGE_SIZE * pitch - 14, 0, pages, renderPage);
      c.add(pageControl.container);
    }
    renderPage(0);

    const footer = shell.tracks.footerTrack;
    const edit = themedButton(this, footer.x + footer.width / 2, footer.y + footer.height / 2, 'Edit Decks', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 140,
      onTap: () => this.scene.start('DeckBuilder'),
    });
    c.add(edit.container);
  }
}
