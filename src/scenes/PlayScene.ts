import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { RULES } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { def } from '../engine/types';
import { faceCardFor } from '../meta/deckFace';
import { Services } from '../meta/services';
import type { SavedDeck } from '../meta/SaveManager';
import { bindTapButton } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { goldBadge, modalShell, pager, panel, themedButton } from '../ui/themeWidgets';

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
  { label: 'Return', scene: 'MainMenu' },
];

/** Deck rows per quick-select page (7 x 48px pitch fits the 520-tall shell). */
const DECK_PAGE_SIZE = 7;

export class PlayScene extends Phaser.Scene {
  private guard = new ModalGuard();
  /** Underlying interactive targets deadened while the deck select is open. */
  private menuTargets: Phaser.GameObjects.GameObject[] = [];
  private deckPlate: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Play');
  }

  create(): void {
    this.guard = new ModalGuard();
    this.menuTargets = [];
    this.deckPlate = null;
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

    goldBadge(this, width - 30, 30, { getValue: () => Services.save.data.gold });

    const firstY = 286;
    const pitchY = 56;
    PLAY_ITEMS.forEach((entry, i) => {
      const btn = themedButton(this, width / 2, firstY + i * pitchY, entry.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => this.scene.start(entry.scene, entry.data),
      });
      this.menuTargets.push(btn.inputZone);
    });

    this.buildDeckPlate();
  }

  private activeDeck(): SavedDeck | null {
    const save = Services.save.data;
    return save.decks.find((d) => d.id === save.activeDeckId) ?? null;
  }

  /**
   * The deck a duel's hero portrait fronts: the starred per-deck hero when it
   * is still in the list, else the deck's face creature (the DuelScene
   * fallback order, minus the account-level legacy fields — a plate-sized
   * approximation is fine here).
   */
  private deckFaceId(deck: SavedDeck): string | null {
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
      const staleSet = new Set(stale.list);
      this.menuTargets = this.menuTargets.filter((t) => !staleSet.has(t));
      stale.destroy();
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
    let textLeft = left + 24;
    if (faceId) {
      // 300x420 card at 0.18 = 54x76, comfortably inside the 96px plate.
      c.add(makeCardThumb(this, left + 46, cy, def(CARD_DB, faceId), 0.18));
      textLeft = left + 86;
    }
    c.add(
      this.add
        .text(textLeft, cy - 26, 'ACTIVE DECK', {
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
        .text(textLeft, cy + 25, `${deck.cards.length}/${RULES.deckSize} cards`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: deck.cards.length === RULES.deckSize ? theme.colors.success : theme.colors.danger,
        })
        .setOrigin(0, 0.5),
    );
    const change = themedButton(this, left + w - 78, cy, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 110,
      onTap: () => this.showDeckSelect(),
    });
    c.add(change.container);
    this.menuTargets.push(change.inputZone);
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
    const decks = save.decks;
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
        const isActive = deck.id === save.activeDeckId;
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
        const name = this.add
          .text(rowX + 16, y, deck.name, {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.label}px`,
            color: isActive ? theme.colors.gold : theme.colors.heading,
          })
          .setOrigin(0, 0.5);
        if (name.width > rowW - 200) name.setScale((rowW - 200) / name.width);
        const count = this.add
          .text(rowX + rowW - 84, y, `${deck.cards.length}/${RULES.deckSize}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: deck.cards.length === RULES.deckSize ? theme.colors.success : theme.colors.danger,
          })
          .setOrigin(1, 0.5);
        const state = this.add
          .text(rowX + rowW - 16, y, isActive ? 'Using' : 'Use', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: theme.weight.w600,
            color: isActive ? theme.colors.gold : theme.colors.body,
          })
          .setOrigin(1, 0.5);
        for (const item of [band, name, count, state]) {
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
