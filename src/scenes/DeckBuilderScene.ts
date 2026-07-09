import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Art } from '../art/ArtResolver';
import { RULES } from '../config/rules';
import { heroById } from '../data/heroes';
import { ALL_CARDS, CARD_DB, byId } from '../data/catalog';
import type { CardDef, CardType, Color, Rarity } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { isBasic, ownedCount } from '../meta/Collection';
import {
  applyFilters,
  collectiblePool,
  defaultFilterState,
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../meta/collectionFilter';
import { decodeDeck, deckCodeErrorMessage, encodeDeck } from '../meta/DeckCode';
import { faceCardFor } from '../meta/deckFace';
import { copyDeck, deleteDeck, generateDeckId, renameDeck, saveDeck, validateDeck } from '../meta/DeckStorage';
import type { SavedDeck } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { TIER_LABEL } from '../meta/variants';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CardZoomPreview } from '../ui/CardZoomPreview';
import { clampDeckPage, deckPageCount, deckPageSlice } from '../ui/deckListPaging';
import { computeDeckStats, PIE_COLORS } from '../ui/deckStats';
import { Dropdown, type DropdownOption } from '../ui/Dropdown';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';

const GRID_COLS = 4;
const GRID_ROWS = 3;
const GRID_SIZE = GRID_COLS * GRID_ROWS;
const BASICS = ['land-plains', 'land-island', 'land-swamp', 'land-mountain', 'land-forest'];
const DECK_CODE_CARD_IDS = ALL_CARDS.map((card) => card.id);
const POOL_CARD_SCALE = 0.43;
const POOL_X0 = 190;
const POOL_Y0 = 176;
const POOL_PITCH_X = 170;
const POOL_PITCH_Y = 202;
const POOL_BADGE_OFFSET_Y = -84;
/** Touch profile: deck-list rows per page and their pitch (plan §1.4). */
const TOUCH_DECK_ROWS = 5;
const TOUCH_DECK_PITCH = 44;
/** Desktop profile: denser tap-to-remove rows, same paging model (no hard clip). */
const DESKTOP_DECK_ROWS = 11;
const DESKTOP_DECK_PITCH = 22;
const DESKTOP_DECK_Y0 = 240;
/** Deck-list pager row + the stats block below it (F13), both cleared by the shorter list. */
const DECK_PAGER_Y = 480;
const DECK_STATS_Y = 510;
const DECK_NAME_MAX_LENGTH = 24;

interface DeckHeroDisplay {
  name: string;
  cardId: string | null;
  textureKey?: string;
}

/**
 * Edit the active deck: paged owned-card pool left, deck list + basics right.
 *
 * The deck list has two profiles (mobile-lan-plan §1.4). Desktop keeps the
 * dense 22px rows where the row itself is tap-to-remove. On touch devices the
 * audited hazard — 1.6mm-tall rows where every tap is a DESTRUCTIVE remove —
 * is replaced wholesale: bigger row pitch, removal only via an explicit
 * per-row − button (90px hit box), and page controls instead of the y>560
 * hard clip. Basics rows also widen their pitch slightly on touch so the ±
 * steppers can carry pitch-filling hit boxes.
 */
export class DeckBuilderScene extends Phaser.Scene {
  private deck: string[] = [];
  private page = 0;
  private deckPage = 0;
  private touch = false;
  private cells: Phaser.GameObjects.GameObject[] = [];
  private rightPane: Phaser.GameObjects.GameObject[] = [];
  private poolPrev!: Phaser.GameObjects.Text;
  private poolNext!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private zoom!: CardZoomPreview;
  private deckCodeOverlay: Phaser.GameObjects.Container | null = null;
  private searchInput: Phaser.GameObjects.DOMElement | null = null;
  private filterButton!: Phaser.GameObjects.Text;
  private filterPanel: Phaser.GameObjects.Container | null = null;
  private filterDropdowns: Dropdown<string>[] = [];
  private filterDropdownRefreshers: Array<() => void> = [];
  /** Collection-style facets over the owned-card pool. */
  private filterState: CollectionFilterState = { ...defaultFilterState(), ownedOnly: true };
  private deckCodeMessage = '';

  constructor() {
    super('DeckBuilder');
  }

  create(): void {
    this.page = 0;
    this.deckPage = 0;
    this.filterState = { ...defaultFilterState(), ownedOnly: true };
    this.deckCodeMessage = '';
    this.touch = isTouchDevice();
    this.cells = [];
    this.rightPane = [];
    this.deckCodeOverlay = null;
    this.searchInput = null;
    this.filterPanel = null;
    this.filterDropdowns = [];
    this.filterDropdownRefreshers = [];

    const save = Services.save.data;
    const active = save.decks.find((d) => d.id === save.activeDeckId);
    this.deck = active ? [...active.cards] : [];

    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the base gradient is the fallback.
    // The right-panel fill stays ON TOP of the backdrop (the deck panel covers
    // the right 400px), so it's drawn after applyBackdrop, not inside it.
    applyBackdrop(this, 'deckbuilder', {
      dim: 0x0b0812,
      dimAlpha: 0.55,
      fallback: () => {
        const grad = this.add.graphics();
        grad.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        grad.fillRect(0, 0, width, height);
      },
    });
    const panel = this.add.graphics();
    panel.fillStyle(0x1c1730, 0.85);
    panel.fillRect(width - 400, 0, 400, height);
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed

    this.add
      .text(340, 40, 'Deck Builder', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '30px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    // Card search (F8): part of the same Collection-style filter state as the panel facets.
    this.searchInput = createSearchInput(this, 620, 40, {
      width: 240,
      placeholder: 'Search your pool…',
      onChange: (value) => {
        this.filterState.search = value;
        this.applyPoolFilterChange();
      },
    });

    this.filterButton = this.add
      .text(758, 40, 'Filters', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: '#c9bde0',
        backgroundColor: '#241d3a',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.filterButton, () => this.toggleFilterPanel());
    inflateHitArea(this.filterButton, 96, 44);

    const back = this.add
      .text(28, 28, '← Menu', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '18px', color: '#c9bde0' })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);

    // pool pager (‹ › audited at ~2.1mm wide — inflate to the 90px minimum;
    // their columns are clear of the pool grid at x 118+/628–)
    this.poolPrev = this.add
      .text(50, 380, '‹', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '54px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.poolNext = this.add
      .text(830, 380, '›', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '54px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.poolPrev, () => this.turnPage(-1));
    bindTapButton(this, this.poolNext, () => this.turnPage(1));
    inflateHitArea(this.poolPrev, 90, 90);
    inflateHitArea(this.poolNext, 90, 90);
    this.pageText = this.add
      .text(440, height - 32, '', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', color: '#8f83a8' })
      .setOrigin(0.5);

    this.status = this.add
      .text(width - 380, height - 60, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: '#f0b0a0',
        wordWrap: { width: 360 },
      })
      .setOrigin(0, 1)
      .setMaxLines(2);

    this.zoom = new CardZoomPreview(this, {
      scale: 1.12,
      depth: 115,
      delayMs: 250,
      dockY: 360,
      leftX: 210,
      rightX: 690,
    });

    this.renderPool();
    this.renderDeck();
    this.syncFilterButton();
  }

  private pool(): CardDef[] {
    this.filterState.ownedOnly = true;
    return applyFilters(collectiblePool(ALL_CARDS), this.filterState, Services.save.data);
  }

  private turnPage(dir: number): void {
    const pages = Math.max(1, Math.ceil(this.pool().length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page + dir, 0, pages - 1);
    this.renderPool();
  }

  private countIn(deck: readonly string[], id: string): number {
    return deck.filter((c) => c === id).length;
  }

  private shiftHeld(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event;
    return typeof event === 'object' && event !== null && 'shiftKey' in event && Boolean(event.shiftKey);
  }

  private syncPoolPager(pages: number): void {
    this.setPoolPagerArrow(this.poolPrev, pages > 1 && this.page > 0, pages > 1);
    this.setPoolPagerArrow(this.poolNext, pages > 1 && this.page < pages - 1, pages > 1);
  }

  private setPoolPagerArrow(arrow: Phaser.GameObjects.Text, enabled: boolean, visible: boolean): void {
    arrow.setVisible(visible);
    arrow.setAlpha(enabled ? 1 : 0.35);
    arrow.setColor(enabled ? '#c9bde0' : '#5d536e');
    if (enabled) {
      arrow.setInteractive({ useHandCursor: true });
      inflateHitArea(arrow, 90, 90);
    } else {
      arrow.disableInteractive();
    }
  }

  private applyPoolFilterChange(): void {
    this.filterState.ownedOnly = true;
    this.page = 0;
    this.renderPool();
    this.syncFilterButton();
  }

  private toggleFilterPanel(): void {
    if (this.filterPanel) this.closeFilterPanel();
    else this.openFilterPanel();
  }

  private openFilterPanel(): void {
    this.closeFilterPanel();
    this.zoom.setSuppressed(true);
    const panel = this.add.container(0, 0).setDepth(80);
    this.filterPanel = panel;

    const bg = this.add
      .rectangle(18, 82, 300, 554, 0x151122, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6f5aa8, 0.82)
      .setInteractive();
    panel.add(bg);
    panel.add(
      this.add
        .text(42, 112, 'Pool Filters', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '22px',
          color: '#f0e6ff',
        })
        .setOrigin(0, 0.5),
    );

    const close = this.add
      .text(286, 112, 'X', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: '#c9bde0',
        backgroundColor: '#241d3a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, close, () => this.closeFilterPanel());
    inflateHitArea(close, 44, 44);
    panel.add(close);

    const mk = <T extends string>(
      y: number,
      label: string,
      options: DropdownOption<T>[],
      get: () => T,
      set: (v: T) => void,
      minW = 228,
    ): void => {
      const dd = new Dropdown<T>(this, 42, y, {
        label,
        options,
        value: get(),
        minW,
        onSelect: (v) => {
          set(v);
          this.applyPoolFilterChange();
        },
        onOpen: () => this.closeFilterDropdownsExcept(dd as unknown as Dropdown<string>),
      });
      dd.button.setDepth(81);
      this.filterDropdowns.push(dd as unknown as Dropdown<string>);
      this.filterDropdownRefreshers.push(() => dd.setValue(get()));
    };

    const setOpts: DropdownOption<'all' | 'base' | 'ragnarok'>[] = [
      { value: 'all', label: 'All Sets' },
      { value: 'base', label: 'Base' },
      { value: 'ragnarok', label: 'Ragnarok' },
    ];
    mk(158, 'Set', setOpts, () => this.filterState.set, (v) => (this.filterState.set = v));

    const colorOpts: DropdownOption<Color | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'W', label: 'White' },
      { value: 'U', label: 'Blue' },
      { value: 'B', label: 'Black' },
      { value: 'R', label: 'Red' },
      { value: 'G', label: 'Green' },
    ];
    mk(210, 'Color', colorOpts, () => this.filterState.color, (v) => (this.filterState.color = v));

    const typeOpts: DropdownOption<CardType | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'creature', label: 'Creature' },
      { value: 'charm', label: 'Charm' },
      { value: 'ritual', label: 'Ritual' },
      { value: 'enchantment', label: 'Enchantment' },
      { value: 'artifact', label: 'Artifact' },
      { value: 'land', label: 'Land' },
    ];
    mk(262, 'Type', typeOpts, () => this.filterState.type, (v) => (this.filterState.type = v));

    const rarityOpts: DropdownOption<Rarity | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'c', label: TIER_LABEL.c },
      { value: 'r', label: TIER_LABEL.r },
      { value: 'sr', label: TIER_LABEL.sr },
      { value: 'ssr', label: TIER_LABEL.ssr },
      { value: 'ur', label: TIER_LABEL.ur },
    ];
    mk(314, 'Rarity', rarityOpts, () => this.filterState.rarity, (v) => (this.filterState.rarity = v));

    const sortOpts: DropdownOption<SortMode>[] = [
      { value: 'rarity', label: SORT_LABEL.rarity },
      { value: 'mana', label: SORT_LABEL.mana },
      { value: 'name', label: SORT_LABEL.name },
    ];
    mk(366, 'Sort', sortOpts, () => this.filterState.sort, (v) => (this.filterState.sort = v));

    const reset = this.add
      .text(42, 588, 'Reset Filters', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: '#9be6a8',
        backgroundColor: '#241d3a',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, reset, () => this.resetPoolFilters());
    inflateHitArea(reset, 132, 44);
    panel.add(reset);

    this.syncFilterButton();
  }

  private closeFilterDropdownsExcept(keep: Dropdown<string>): void {
    for (const dd of this.filterDropdowns) if (dd !== keep) dd.close();
  }

  private closeFilterPanel(): void {
    for (const dd of this.filterDropdowns) dd.destroy();
    this.filterDropdowns = [];
    this.filterDropdownRefreshers = [];
    this.filterPanel?.destroy();
    this.filterPanel = null;
    if (this.zoom) this.zoom.setSuppressed(false);
    this.syncFilterButton();
  }

  private resetPoolFilters(): void {
    this.filterState = { ...defaultFilterState(), ownedOnly: true };
    this.setSearchInputValue('');
    for (const refresh of this.filterDropdownRefreshers) refresh();
    this.applyPoolFilterChange();
  }

  private setSearchInputValue(value: string): void {
    const node = this.searchInput?.node;
    if (node instanceof HTMLInputElement) node.value = value;
  }

  private activePoolFilterCount(): number {
    const base = defaultFilterState();
    return [
      this.filterState.set !== base.set,
      this.filterState.color !== base.color,
      this.filterState.type !== base.type,
      this.filterState.rarity !== base.rarity,
      this.filterState.sort !== base.sort,
      this.filterState.search.trim() !== '',
    ].filter(Boolean).length;
  }

  private syncFilterButton(): void {
    if (!this.filterButton?.active) return;
    const activeCount = this.activePoolFilterCount();
    this.filterButton.setText(activeCount > 0 ? `Filters (${activeCount})` : 'Filters');
    this.filterButton.setColor(this.filterPanel ? '#ffd88a' : activeCount > 0 ? '#9be6a8' : '#c9bde0');
    this.filterButton.setBackgroundColor(this.filterPanel ? '#3a2f5c' : '#241d3a');
    inflateHitArea(this.filterButton, 96, 44);
  }

  private renderPool(): void {
    for (const c of this.cells) c.destroy();
    this.cells = [];
    const save = Services.save.data;
    const pool = this.pool();
    const pages = Math.max(1, Math.ceil(pool.length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    this.pageText.setText(`Page ${this.page + 1}/${pages} — click a card to add it`);
    this.syncPoolPager(pages);

    pool.slice(this.page * GRID_SIZE, (this.page + 1) * GRID_SIZE).forEach((d, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = POOL_X0 + col * POOL_PITCH_X;
      const y = POOL_Y0 + row * POOL_PITCH_Y;
      // Cached-thumbnail Image instead of a live CardView — cheap to churn per page.
      const thumb = makeCardThumb(this, x, y, d, POOL_CARD_SCALE);
      thumb.setInteractive({ useHandCursor: true });
      this.zoom.attach(thumb, d);
      // Tap-classified on touch so a drag across the grid can't add cards.
      bindTapButton(this, thumb, (p) => this.addCardOrPlayset(d.id, p));
      this.cells.push(thumb);
      const inDeck = this.countIn(this.deck, d.id);
      const badge = this.add
        .text(x + 60, y + POOL_BADGE_OFFSET_Y, `${inDeck}/${Math.min(RULES.maxCopies, ownedCount(save, d.id))}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          fontStyle: '700',
          color: inDeck > 0 ? '#9be6a8' : '#8f83a8',
          backgroundColor: '#1c1730',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      this.cells.push(badge);
      // Add-a-playset chip (top-left corner) — one tap fills this card to the
      // cap. Shown only when ≥2 are addable (a single card tap already adds one).
      const addable = Math.min(RULES.maxCopies, ownedCount(save, d.id)) - inDeck;
      if (addable > 1) {
        const addAll = this.add
          .text(x - 58, y + POOL_BADGE_OFFSET_Y, `+${addable}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            fontStyle: '700',
            color: '#9be6a8',
            backgroundColor: '#1c1730',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, addAll, () => this.addPlayset(d.id));
        inflateHitArea(addAll, 52, 44);
        this.cells.push(addAll);
      }
    });
  }

  private addCard(id: string): void {
    const save = Services.save.data;
    const inDeck = this.countIn(this.deck, id);
    if (inDeck >= Math.min(RULES.maxCopies, ownedCount(save, id))) return;
    this.deckCodeMessage = '';
    this.deck.push(id);
    this.renderPool();
    this.renderDeck();
  }

  private addCardOrPlayset(id: string, pointer: Phaser.Input.Pointer): void {
    if (this.shiftHeld(pointer)) this.addPlayset(id);
    else this.addCard(id);
  }

  /** Add-a-playset: fill this card up to the per-card cap in one tap. */
  private addPlayset(id: string): void {
    const cap = Math.min(RULES.maxCopies, ownedCount(Services.save.data, id));
    this.deckCodeMessage = '';
    while (this.countIn(this.deck, id) < cap) this.deck.push(id);
    this.renderPool();
    this.renderDeck();
  }

  private removeCardOrAll(id: string, pointer: Phaser.Input.Pointer): void {
    if (this.shiftHeld(pointer)) this.removeAllCopies(id);
    else this.removeCard(id);
  }

  private removeAllCopies(id: string): void {
    const next = this.deck.filter((cardId) => cardId !== id);
    if (next.length === this.deck.length) return;
    this.deck = next;
    const active = this.activeSavedDeck();
    if (active?.heroCardId === id) active.heroCardId = null;
    this.deckCodeMessage = '';
    this.renderPool();
    this.renderDeck();
  }

  private removeCard(id: string): void {
    const idx = this.deck.indexOf(id);
    if (idx >= 0) this.deck.splice(idx, 1);
    this.deckCodeMessage = '';
    this.renderPool();
    this.renderDeck();
  }

  private activeSavedDeck(): SavedDeck | null {
    const save = Services.save.data;
    return save.decks.find((d) => d.id === save.activeDeckId) ?? null;
  }

  private deckHeroId(): string | null {
    const hero = this.activeSavedDeck()?.heroCardId ?? null;
    return hero && CARD_DB[hero] && this.deck.includes(hero) ? hero : null;
  }

  private toggleDeckHero(id: string): void {
    const deck = this.activeSavedDeck();
    if (!deck || !this.deck.includes(id)) return;
    const next = deck.heroCardId === id ? null : id;
    deck.heroCardId = next;
    this.deckCodeMessage = next ? `Hero Image: ${def(CARD_DB, id).name}` : 'Hero image cleared.';
    Services.save.flush();
    Sfx.play('shimmer');
    this.renderDeck();
  }

  /** ‹ N/M › deck-list pager, shared by both profiles; sits below the list. */
  private renderDeckPagers(x0: number, pages: number): void {
    const mkPager = (px: number, glyph: string, dir: number): void => {
      const b = this.add
        .text(px, DECK_PAGER_Y, glyph, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '26px', color: '#c9bde0' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, b, () => {
        this.deckPage = Phaser.Math.Clamp(this.deckPage + dir, 0, pages - 1);
        this.renderDeck();
      });
      inflateHitArea(b, 90, 56);
      this.rightPane.push(b);
    };
    mkPager(x0 + 250, '‹', -1);
    mkPager(x0 + 340, '›', 1);
    const pageLabel = this.add
      .text(x0 + 295, DECK_PAGER_Y, `${this.deckPage + 1}/${pages}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);
    this.rightPane.push(pageLabel);
  }

  /** F15: modal deck picker — select / new / copy / rename / delete. */
  private showDeckPicker(): void {
    const save = Services.save.data;
    this.closeFilterPanel();
    this.setSearchInputVisible(false);
    // Preserve in-progress edits: sync this.deck into the active deck before any
    // switch/new/copy so unsaved changes aren't lost on the scene restart.
    const activeNow = save.decks.find((d) => d.id === save.activeDeckId);
    if (activeNow) {
      activeNow.cards = [...this.deck];
      if (activeNow.heroCardId && !activeNow.cards.includes(activeNow.heroCardId)) activeNow.heroCardId = null;
    }
    const overlay = this.add.container(0, 0).setDepth(100);
    const closeOverlay = (): void => {
      overlay.destroy();
    };
    this.input.keyboard?.on('keydown-ESC', closeOverlay);
    overlay.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.input.keyboard?.off('keydown-ESC', closeOverlay);
      this.setSearchInputVisible(true);
    });
    let renderGrid = (): void => {};
    const setActiveDeck = (id: string | null): void => {
      save.activeDeckId = id;
      const activeDeck = save.decks.find((d) => d.id === id);
      this.deck = activeDeck ? [...activeDeck.cards] : [];
      this.deckCodeMessage = '';
      Services.save.flush();
      this.renderPool();
      this.renderDeck();
      renderGrid();
    };
    overlay.add(this.add.rectangle(640, 360, 1280, 720, 0x0a0812, 0.92).setInteractive());
    overlay.add(
      this.add
        .text(640, 72, 'Your Decks', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '34px', color: '#f0e6ff' })
        .setOrigin(0.5),
    );

    const gridLayer = this.add.container(0, 0);
    overlay.add(gridLayer);
    const tileW = 340;
    const tileH = 250;
    const gapX = 28;
    const gapY = 18;
    const cols = 3;
    const rows = 2;
    const pageSize = cols * rows;
    const gridLeft = 640 - (cols * tileW + (cols - 1) * gapX) / 2;
    const gridTop = 106;
    const actionW = 66;
    const actionH = 32;
    const actionGap = 16;
    let pickerPage = 0;

    const action = (
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      label: string,
      color: string,
      onTap: () => void,
      align: 'center' | 'left' | 'right' = 'center',
    ): Phaser.GameObjects.Text => {
      const btn = this.add
        .text(x, y, label, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          fontStyle: '600',
          color,
          backgroundColor: '#2a2242',
          align: 'center',
          fixedWidth: actionW,
          fixedHeight: actionH,
          padding: { x: 0, y: 7 },
        })
        .setOrigin(align === 'right' ? 1 : align === 'left' ? 0 : 0.5, 0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, onTap);
      inflateHitArea(btn, 86, 40);
      parent.add(btn);
      return btn;
    };

    const renderDeckTile = (parent: Phaser.GameObjects.Container, deck: SavedDeck, x: number, y: number): void => {
      const isActive = deck.id === save.activeDeckId;
      const left = x - tileW / 2;
      const top = y - tileH / 2;
      const rightGuideX = left + tileW - 13;
      const bg = this.add
        .rectangle(x, y, tileW, tileH, isActive ? 0x211a35 : 0x171225, 0.96)
        .setStrokeStyle(1, isActive ? 0xd8b24a : 0x51466f, isActive ? 1 : 0.82)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, () => setActiveDeck(deck.id));
      parent.add(bg);

      const title = this.add
        .text(left + 18, top + 22, deck.name, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '18px',
          color: isActive ? '#ffd88a' : '#f0e6ff',
        })
        .setOrigin(0, 0.5);
      this.fitTextToWidth(title, 200);
      parent.add(title);
      this.addDeckColorPips(parent, rightGuideX, top + 22, deck.cards);

      const hero = this.deckPickerHero(deck);
      this.addDeckHeroPortrait(parent, left + 91, top + 134, hero, 142, 184);
      parent.add(
        this.add
          .text(rightGuideX, top + 62, `${deck.cards.length}/${RULES.deckSize}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '17px',
            fontStyle: '700',
            color: deck.cards.length === RULES.deckSize ? '#9be6a8' : '#f0b0a0',
          })
          .setOrigin(1, 0.5),
      );

      const actionX0 = rightGuideX - actionW * 2 - actionGap;
      const actionX1 = rightGuideX;
      const actionY0 = top + 116;
      const actionY1 = top + 166;
      action(parent, actionX0, actionY0, isActive ? 'Using' : 'Use', isActive ? '#ffd88a' : '#c9bde0', () => setActiveDeck(deck.id), 'left');
      action(parent, actionX1, actionY0, 'Copy', '#9be6a8', () => {
        const id = copyDeck(save, deck.id);
        if (!id) return;
        const index = save.decks.findIndex((d) => d.id === id);
        if (index >= 0) pickerPage = Math.floor(index / pageSize);
        Services.save.flush();
        renderGrid();
      }, 'right');
      action(parent, actionX0, actionY1, 'Rename', '#c7a8f0', () => {
        this.promptRename(deck.id, () => {
          if (deck.id === save.activeDeckId) this.renderDeck();
          renderGrid();
        });
      }, 'left');
      let delArmed = false;
      const delBtn = action(parent, actionX1, actionY1, 'Delete', '#f0b0a0', () => {
        if (save.settings.confirmDestructive && !delArmed) {
          delArmed = true;
          delBtn.setText('Delete?').setColor('#ffd44a');
          inflateHitArea(delBtn, 86, 40);
          return;
        }
        deleteDeck(save, deck.id);
        if (isActive) {
          const activeDeck = save.decks.find((d) => d.id === save.activeDeckId);
          this.deck = activeDeck ? [...activeDeck.cards] : [];
          this.deckCodeMessage = '';
          this.renderPool();
          this.renderDeck();
        }
        Services.save.flush();
        renderGrid();
      }, 'right');
    };

    const renderNewTile = (parent: Phaser.GameObjects.Container, x: number, y: number): void => {
      const left = x - tileW / 2;
      const top = y - tileH / 2;
      const create = (): void => {
        const id = generateDeckId(save);
        const index = save.decks.length;
        saveDeck(save, { id, name: `Deck ${save.decks.length + 1}`, cards: [] });
        pickerPage = Math.floor(index / pageSize);
        setActiveDeck(id);
      };
      const bg = this.add
        .rectangle(x, y, tileW, tileH, 0x151122, 0.9)
        .setStrokeStyle(1, 0x6f5aa8, 0.72)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, create);
      parent.add(bg);
      parent.add(
        this.add
          .rectangle(left + 18, top + 18, tileW - 36, tileH - 36, 0x000000, 0)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x3f365a, 0.55),
      );
      parent.add(
        this.add
          .text(x, top + 70, '+', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '46px', color: '#9be6a8' })
          .setOrigin(0.5),
      );
      parent.add(
        this.add
          .text(x, top + 118, 'New Deck', {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: '21px',
            color: '#d8f2cf',
          })
          .setOrigin(0.5),
      );
      const btn = this.add
        .text(x, top + 158, 'Create Empty Deck', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: '#9be6a8',
          backgroundColor: '#241d3a',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, create);
      inflateHitArea(btn, 120, 44);
      parent.add(btn);
    };

    renderGrid = (): void => {
      gridLayer.removeAll(true);
      const tiles: Array<{ kind: 'deck'; deck: SavedDeck } | { kind: 'new' }> = [
        ...save.decks.map((deck) => ({ kind: 'deck' as const, deck })),
        { kind: 'new' as const },
      ];
      const pages = Math.max(1, Math.ceil(tiles.length / pageSize));
      pickerPage = Phaser.Math.Clamp(pickerPage, 0, pages - 1);
      tiles.slice(pickerPage * pageSize, (pickerPage + 1) * pageSize).forEach((tile, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gridLeft + tileW / 2 + col * (tileW + gapX);
        const y = gridTop + tileH / 2 + row * (tileH + gapY);
        if (tile.kind === 'deck') renderDeckTile(gridLayer, tile.deck, x, y);
        else renderNewTile(gridLayer, x, y);
      });
      if (pages > 1) {
        gridLayer.add(
          this.add
            .text(640, 638, `${pickerPage + 1}/${pages}`, {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '13px',
              color: '#8f83a8',
            })
            .setOrigin(0.5),
        );
        const pageBtn = (x: number, label: string, dir: number): void => {
          const btn = this.add
            .text(x, 638, label, {
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '26px',
              color: '#c9bde0',
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, btn, () => {
            pickerPage = Phaser.Math.Clamp(pickerPage + dir, 0, pages - 1);
            renderGrid();
          });
          inflateHitArea(btn, 70, 50);
          gridLayer.add(btn);
        };
        pageBtn(590, '<', -1);
        pageBtn(690, '>', 1);
      }
    };
    renderGrid();

    const closeBtn = this.add
      .text(640, 678, 'Close', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#c9bde0',
        backgroundColor: '#2c2344',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, closeBtn, closeOverlay);
    inflateHitArea(closeBtn, 90, 60);
    overlay.add(closeBtn);
  }

  private fitTextToWidth(text: Phaser.GameObjects.Text, maxWidth: number): void {
    text.setScale(Math.min(1, maxWidth / Math.max(1, text.width)));
  }

  private setSearchInputVisible(visible: boolean): void {
    if (this.searchInput?.active) this.searchInput.setVisible(visible);
  }

  private deckColorOrder(cards: readonly string[]): Color[] {
    const stats = computeDeckStats([...cards], CARD_DB);
    return [...PIE_COLORS]
      .filter((color) => stats.colorPips[color] > 0)
      .sort((a, b) => stats.colorPips[b] - stats.colorPips[a] || PIE_COLORS.indexOf(a) - PIE_COLORS.indexOf(b));
  }

  private addDeckColorPips(
    parent: Phaser.GameObjects.Container,
    rightEdgeX: number,
    y: number,
    cards: readonly string[],
  ): void {
    const colors = this.deckColorOrder(cards);
    const pipKeys = (colors.length > 0 ? colors : ['C']).slice(0, 5);
    const pipSize = 18;
    const pipGap = 21;
    pipKeys.forEach((color, i) => {
      const x = rightEdgeX - pipSize / 2 - (pipKeys.length - 1 - i) * pipGap;
      parent.add(this.add.image(x, y, `pip-${color}`).setDisplaySize(pipSize, pipSize));
    });
  }

  private deckPickerHero(deck: SavedDeck): DeckHeroDisplay {
    const deckHero =
      deck.heroCardId && CARD_DB[deck.heroCardId] && deck.cards.includes(deck.heroCardId) ? deck.heroCardId : null;
    if (deckHero) return { name: def(CARD_DB, deckHero).name, cardId: deckHero };

    const save = Services.save.data;
    const premium = save.heroPortraitId ? heroById(save.heroPortraitId) : undefined;
    if (premium && save.decks.some((d) => d.id === premium.unlockDeckId) && this.textures.exists(premium.textureKey)) {
      return { name: premium.name, cardId: null, textureKey: premium.textureKey };
    }

    const defaultHero = save.heroCardId && CARD_DB[save.heroCardId] ? save.heroCardId : null;
    if (defaultHero) return { name: def(CARD_DB, defaultHero).name, cardId: defaultHero };

    const face = faceCardFor(deck.cards, CARD_DB);
    if (face) return { name: def(CARD_DB, face).name, cardId: face };
    return { name: 'No hero image', cardId: null };
  }

  private addDeckHeroPortrait(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    hero: DeckHeroDisplay,
    width: number,
    height: number,
  ): void {
    const frame = this.add
      .rectangle(x, y, width, height, 0x100d1d, 1)
      .setStrokeStyle(1, 0x6f5aa8, 0.9);
    parent.add(frame);

    const artW = width - 6;
    const artH = height - 6;

    let img: Phaser.GameObjects.Image | null = null;
    try {
      if (hero.textureKey && this.textures.exists(hero.textureKey)) {
        img = this.add.image(x, y, hero.textureKey);
      } else if (hero.cardId) {
        const ref = Art.resolver?.getArt(hero.cardId);
        if (ref) img = ref.frameName ? this.add.image(x, y, ref.textureKey, ref.frameName) : this.add.image(x, y, ref.textureKey);
      }
    } catch {
      img = null;
    }

    if (img) {
      const srcW = img.frame.width;
      const srcH = img.frame.height;
      const targetRatio = artW / artH;
      const srcRatio = srcW / srcH;
      if (srcRatio > targetRatio) {
        const cropW = srcH * targetRatio;
        img.setCrop((srcW - cropW) / 2, 0, cropW, srcH);
      } else {
        const cropH = srcW / targetRatio;
        img.setCrop(0, Math.max(0, (srcH - cropH) * 0.42), srcW, cropH);
      }
      img.setDisplaySize(artW, artH);
      parent.add(img);
      parent.add(this.add.rectangle(x, y, width, height, 0x000000, 0).setStrokeStyle(1, 0xd8b24a, 0.36));
      return;
    }

    parent.add(this.add.rectangle(x, y, artW, artH, 0x1b1530, 1));
    parent.add(
      this.add
        .text(x, y, 'No Image', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );
  }

  /** Rename a deck in-place via a styled modal; Enter commits, Esc/Cancel dismiss. */
  private promptRename(deckId: string, onDone?: () => void): void {
    const save = Services.save.data;
    const deck = save.decks.find((d) => d.id === deckId);
    if (!deck) return;
    const modal = this.add.container(0, 0).setDepth(150);
    modal.add(this.add.rectangle(640, 360, 1280, 720, 0x06040d, 0.52).setInteractive());
    modal.add(this.add.rectangle(640, 360, 460, 230, 0x1c1730, 0.98).setStrokeStyle(1, 0x6f5aa8, 0.9));
    modal.add(
      this.add
        .text(640, 298, 'Rename Deck', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '24px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    modal.add(
      this.add
        .text(640, 330, `${DECK_NAME_MAX_LENGTH} characters max`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );

    const input = document.createElement('input');
    input.type = 'text';
    input.value = deck.name.slice(0, DECK_NAME_MAX_LENGTH);
    input.maxLength = DECK_NAME_MAX_LENGTH;
    input.placeholder = `Deck name (${DECK_NAME_MAX_LENGTH} max)`;
    input.setAttribute(
      'style',
      'width:340px;box-sizing:border-box;padding:10px 12px;font:16px Inter, Arial, sans-serif;color:#e8def7;background:#120f20;border:1px solid #18c7d7;border-radius:8px;outline:none;text-align:center;box-shadow:0 0 18px rgba(24,199,215,0.18);',
    );
    const inputDom = this.add.dom(640, 372, input).setDepth(151);

    const close = (): void => {
      inputDom.destroy();
      modal.destroy();
    };
    let done = false;
    const commit = (cancel = false): void => {
      if (done) return;
      done = true;
      const name = input.value.trim().slice(0, DECK_NAME_MAX_LENGTH);
      if (!cancel && name) renameDeck(save, deckId, name);
      Services.save.flush();
      close();
      if (!cancel && name) onDone?.();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape') commit(true);
    });
    const modalButton = (x: number, label: string, color: string, onTap: () => void): void => {
      const btn = this.add
        .text(x, 438, label, {
          fontFamily: label === 'Save' ? 'Cinzel, Georgia, serif' : 'Inter, Arial, sans-serif',
          fontSize: label === 'Save' ? '18px' : '14px',
          color,
          backgroundColor: '#2a2242',
          padding: { x: 18, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, onTap);
      inflateHitArea(btn, 90, 50);
      modal.add(btn);
    };
    modalButton(585, 'Save', '#ffd88a', () => commit());
    modalButton(704, 'Cancel', '#c9bde0', () => commit(true));
    input.focus();
    input.select();
  }

  /** Compact deck-stats block (mana curve + type/color counts) below the list. */
  private renderDeckStats(x0: number): void {
    const s = computeDeckStats(this.deck, CARD_DB);
    const push = (o: Phaser.GameObjects.GameObject): void => void this.rightPane.push(o);

    push(
      this.add
        .text(x0, DECK_STATS_Y, 'Mana curve', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '15px',
          color: '#c7a8f0',
        })
        .setOrigin(0, 0.5),
    );

    const baseY = DECK_STATS_Y + 50; // bar baseline (bars grow upward)
    const maxCount = Math.max(1, ...s.curve);
    s.curve.forEach((count, mv) => {
      const bx = x0 + 16 + mv * 22;
      const h = count > 0 ? Math.max(3, Math.round((count / maxCount) * 30)) : 2;
      push(this.add.rectangle(bx, baseY, 15, h, count > 0 ? 0xffd88a : 0x3a3355).setOrigin(0.5, 1));
      if (count > 0) {
        push(
          this.add
            .text(bx, baseY - h - 8, `${count}`, {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '11px',
              color: '#e0d8f0',
            })
            .setOrigin(0.5),
        );
      }
      push(
        this.add
          .text(bx, baseY + 9, mv === 7 ? '7+' : `${mv}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '11px',
            color: '#8f83a8',
          })
          .setOrigin(0.5),
      );
    });

    const other = s.nonlands - s.typeCounts.creature;
    push(
      this.add
        .text(x0, baseY + 34, `${s.typeCounts.creature} creatures · ${s.lands} lands · ${other} other`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#c9bde0',
        })
        .setOrigin(0, 0.5),
    );
    const pips = PIE_COLORS.filter((c) => s.colorPips[c] > 0)
      .map((c) => `${c}·${s.colorPips[c]}`)
      .join('   ');
    push(
      this.add
        .text(x0, baseY + 56, pips || 'colorless', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#8f83a8',
        })
        .setOrigin(0, 0.5),
    );
  }

  private renderDeck(): void {
    for (const c of this.rightPane) c.destroy();
    this.rightPane = [];
    const width = 1280; // design-space width (see create())
    const x0 = width - 380;

    const active = Services.save.data.decks.find((d) => d.id === Services.save.data.activeDeckId);
    const title = this.add.text(x0, 24, `${active?.name ?? 'Custom Deck'} — ${this.deck.length}/${RULES.deckSize}`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '20px',
      color: this.deck.length === RULES.deckSize ? '#9be6a8' : '#ffd88a',
    });
    this.rightPane.push(title);
    // F15: deck picker (switch / new / copy / rename / delete).
    const decksBtn = this.add
      .text(x0 + 372, 22, '☰ Decks', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#c9bde0',
        backgroundColor: '#2c2344',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, decksBtn, () => this.showDeckPicker());
    inflateHitArea(decksBtn, 90, 44);
    this.rightPane.push(decksBtn);

    // basics steppers. The ± pair was an audited adjacent-target mis-tap
    // (centers 40px apart) — respaced to ≥90px centers with hit boxes that
    // fill the row pitch (30px, widened to 40 on touch — plan §1.4).
    const basicsPitch = this.touch ? 40 : 30;
    BASICS.forEach((id, i) => {
      const d = byId(id);
      const y = 70 + i * basicsPitch;
      const n = this.countIn(this.deck, id);
      const row = this.add.text(x0, y, `${d.name}: ${n}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#c9bde0',
      });
      const minus = this.add
        .text(x0 + 190, y, ' − ', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '15px', color: '#f0b0a0', backgroundColor: '#241d3a' })
        .setInteractive({ useHandCursor: true });
      const plus = this.add
        .text(x0 + 290, y, ' + ', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '15px', color: '#9be6a8', backgroundColor: '#241d3a' })
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, minus, () => this.removeCard(id));
      bindTapButton(this, plus, () => {
        this.deckCodeMessage = '';
        this.deck.push(id);
        this.renderDeck();
      });
      inflateHitArea(minus, 90, basicsPitch);
      inflateHitArea(plus, 90, basicsPitch);
      this.rightPane.push(row, minus, plus);
    });

    // nonbasic list grouped with counts
    const counts = new Map<string, number>();
    for (const id of this.deck) {
      if (!isBasic(CARD_DB, id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => {
      const da = def(CARD_DB, a[0]);
      const dbb = def(CARD_DB, b[0]);
      const landDiff = Number(isType(dbb, 'land')) - Number(isType(da, 'land'));
      return landDiff || manaValue(da.cost) - manaValue(dbb.cost) || da.name.localeCompare(dbb.name);
    });
    const heroId = this.deckHeroId();
    if (!this.touch) {
      // Desktop: dense tap-to-remove list — now PAGED so a long, singleton-heavy
      // deck never silently drops rows past the old y>560 hard clip.
      const pages = deckPageCount(entries.length, DESKTOP_DECK_ROWS);
      this.deckPage = clampDeckPage(this.deckPage, entries.length, DESKTOP_DECK_ROWS);
      deckPageSlice(entries, this.deckPage, DESKTOP_DECK_ROWS).forEach(([id, n], i) => {
        const d = def(CARD_DB, id);
        const y = DESKTOP_DECK_Y0 + i * DESKTOP_DECK_PITCH;
        const star = this.add
          .text(x0, y, heroId === id ? '★' : '☆', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '14px',
            fontStyle: '700',
            color: heroId === id ? '#ffd44a' : '#8f83a8',
          })
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, star, () => this.toggleDeckHero(id));
        inflateHitArea(star, 34, 36);
        const row = this.add
          .text(x0 + 24, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#e0d8f0',
          })
          .setInteractive({ useHandCursor: true });
        this.zoom.attach(row, d);
        row.on('pointerover', () => row.setColor('#f0b0a0'));
        row.on('pointerout', () => row.setColor('#e0d8f0'));
        bindTapButton(this, row, (p) => this.removeCardOrAll(id, p));
        this.rightPane.push(star, row);
      });
      if (pages > 1) this.renderDeckPagers(x0, pages);
    } else {
      // Touch: rows are read-only; removal happens on an explicit, inflated
      // − button per row (the audited destructive-row hazard), with paging
      // instead of the hard clip.
      const pages = deckPageCount(entries.length, TOUCH_DECK_ROWS);
      this.deckPage = clampDeckPage(this.deckPage, entries.length, TOUCH_DECK_ROWS);
      const listY0 = 270;
      deckPageSlice(entries, this.deckPage, TOUCH_DECK_ROWS).forEach(([id, n], i) => {
          const d = def(CARD_DB, id);
          const y = listY0 + i * TOUCH_DECK_PITCH;
          const star = this.add
            .text(x0, y, heroId === id ? '★' : '☆', {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '15px',
              fontStyle: '700',
              color: heroId === id ? '#ffd44a' : '#8f83a8',
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, star, () => this.toggleDeckHero(id));
          inflateHitArea(star, 44, TOUCH_DECK_PITCH);
          const row = this.add.text(x0 + 26, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#e0d8f0',
          });
          const minus = this.add
            .text(x0 + 335, y + 8, ' − ', {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '16px',
              color: '#f0b0a0',
              backgroundColor: '#241d3a',
              padding: { x: 8, y: 3 },
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, minus, (p) => this.removeCardOrAll(id, p));
          inflateHitArea(minus, 90, TOUCH_DECK_PITCH);
          this.rightPane.push(star, row, minus);
        });
      if (pages > 1) this.renderDeckPagers(x0, pages);
    }

    this.renderDeckStats(x0);

    // validation + save
    const issues = validateDeck(CARD_DB, Services.save.data, this.deck);
    const issueLines = issues
      .slice(0, this.deckCodeMessage ? 1 : 2)
      .map((i) => `${i.kind === 'error' ? '✕' : '⚠'} ${i.message}`);
    const statusLines = this.deckCodeMessage ? [this.deckCodeMessage, ...issueLines] : issueLines;
    this.status.setColor(issues.some((i) => i.kind === 'error') ? '#f0b0a0' : this.deckCodeMessage ? '#9be6a8' : '#f0b0a0');
    this.status.setText(statusLines.join('\n'));
    const canSave = issues.every((i) => i.kind !== 'error');
    this.deckCodeButton(x0, 666, 'Export Code', () => this.exportDeckCode());
    this.deckCodeButton(x0 + 278, 666, 'Import Code', () => this.importDeckCode());
    const saveBtn = this.add
      .text(x0 + 180, 720 - 40, 'Save Deck', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: canSave ? '#ffd88a' : '#57506b',
        backgroundColor: '#2c2344',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(saveBtn, 90, 90);
    bindTapButton(this, saveBtn, () => {
      if (!canSave) return;
      const save = Services.save.data;
      const id = save.activeDeckId ?? 'custom-1';
      const existing = save.decks.find((d) => d.id === id);
      const name = existing?.name ?? 'Custom Deck';
      const heroCardId = existing?.heroCardId && this.deck.includes(existing.heroCardId) ? existing.heroCardId : null;
      saveDeck(save, { id, name, cards: [...this.deck], heroCardId });
      save.activeDeckId = id;
      Services.save.flush();
      this.deckCodeMessage = '';
      saveBtn.setText('Saved ✓');
      // renderDeck() may destroy this button before the revert fires; calling
      // setText on a destroyed Text kills the game loop, so guard on .active.
      this.time.delayedCall(900, () => {
        if (saveBtn.active) saveBtn.setText('Save Deck');
      });
    });
    this.rightPane.push(saveBtn);
  }

  private deckCodeButton(x: number, y: number, label: string, cb: () => void): void {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#c9bde0',
        backgroundColor: '#2c2344',
        padding: { x: 9, y: 5 },
      })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, cb);
    inflateHitArea(btn, 112, 44);
    this.rightPane.push(btn);
  }

  private exportDeckCode(): void {
    const errors = validateDeck(CARD_DB, Services.save.data, this.deck).filter((issue) => issue.kind === 'error');
    if (errors.length > 0) {
      this.deckCodeMessage = `Export blocked: ${errors[0].message}`;
      this.renderDeck();
      return;
    }

    const code = encodeDeck(this.deck);
    this.showDeckCodeOverlay('export', code);
  }

  private importDeckCode(): void {
    this.showDeckCodeOverlay('import');
  }

  private applyDeckCodeImport(input: string, renderOnFailure = true): boolean {
    const decoded = decodeDeck(input, DECK_CODE_CARD_IDS);
    if (!decoded.ok) {
      this.deckCodeMessage = `Import failed: ${deckCodeErrorMessage(decoded.error)}`;
      if (renderOnFailure) this.renderDeck();
      return false;
    }

    let issues: ReturnType<typeof validateDeck>;
    try {
      issues = validateDeck(CARD_DB, Services.save.data, decoded.cards);
    } catch {
      this.deckCodeMessage = 'Import failed: that code contains an unknown card.';
      if (renderOnFailure) this.renderDeck();
      return false;
    }
    const blocking = issues.filter((issue) => issue.kind === 'error');
    if (blocking.length > 0) {
      this.deckCodeMessage = `Import rejected: ${blocking[0].message}`;
      if (renderOnFailure) this.renderDeck();
      return false;
    }

    this.deck = [...decoded.cards];
    this.deckPage = 0;
    this.deckCodeMessage = 'Imported deck code. Click Save Deck to keep it.';
    this.renderPool();
    this.renderDeck();
    return true;
  }

  private showDeckCodeOverlay(mode: 'export' | 'import', code = ''): void {
    this.closeFilterPanel();
    this.closeDeckCodeOverlay();
    this.zoom.setSuppressed(true);
    const overlay = this.add.container(0, 0).setDepth(130);
    this.deckCodeOverlay = overlay;

    overlay.add(this.add.rectangle(640, 360, 1280, 720, 0x080612, 0.82).setInteractive());
    overlay.add(this.add.rectangle(640, 360, 720, 330, 0x1c1730, 0.98));
    overlay.add(this.add.rectangle(640, 360, 720, 330).setStrokeStyle(1, 0x6f5aa8, 0.9));
    overlay.add(
      this.add
        .text(640, 228, mode === 'export' ? 'Export Deck Code' : 'Import Deck Code', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '26px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          640,
          266,
          mode === 'export' ? 'Copy this code to share the current deck.' : 'Paste a deck code, then import it into the editor.',
          {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '14px',
            color: '#c9bde0',
          },
        )
        .setOrigin(0.5),
    );

    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.readOnly = mode === 'export';
    textarea.spellcheck = false;
    textarea.placeholder = 'Paste deck code here...';
    textarea.setAttribute(
      'style',
      [
        'width:620px',
        'height:92px',
        'box-sizing:border-box',
        'resize:none',
        'padding:12px 14px',
        'font:14px Consolas, monospace',
        'line-height:1.35',
        'color:#e8def7',
        'background:#120f20',
        'border:1px solid #18c7d7',
        'border-radius:8px',
        'outline:none',
        'box-shadow:0 0 18px rgba(24,199,215,0.18)',
      ].join(';'),
    );
    const dom = this.add.dom(640, 342, textarea).setOrigin(0.5);
    overlay.add(dom);

    const note = this.add
      .text(640, 418, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);
    overlay.add(note);

    const chip = (
      x: number,
      y: number,
      label: string,
      primary: boolean,
      onTap: () => void,
    ): Phaser.GameObjects.Text => {
      const btn = this.add
        .text(x, y, label, {
          fontFamily: primary ? 'Cinzel, Georgia, serif' : 'Inter, Arial, sans-serif',
          fontSize: primary ? '18px' : '14px',
          color: primary ? '#ffd88a' : '#c9bde0',
          backgroundColor: primary ? '#2c2344' : '#241d3a',
          padding: { x: primary ? 18 : 14, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, onTap);
      inflateHitArea(btn, 100, 56);
      overlay.add(btn);
      return btn;
    };

    if (mode === 'export') {
      chip(578, 472, 'Copy Code', true, () => {
        void this.copyDeckCode(code, textarea, note);
      });
      chip(716, 472, 'Close', false, () => this.closeDeckCodeOverlay());
    } else {
      chip(570, 472, 'Import', true, () => {
        if (this.applyDeckCodeImport(textarea.value, false)) this.closeDeckCodeOverlay();
        else note.setText(this.deckCodeMessage).setColor('#f0b0a0');
      });
      chip(710, 472, 'Cancel', false, () => this.closeDeckCodeOverlay());
    }

    this.time.delayedCall(0, () => {
      if (!textarea.isConnected) return;
      textarea.focus();
      textarea.select();
    });
  }

  private closeDeckCodeOverlay(): void {
    this.deckCodeOverlay?.destroy();
    this.deckCodeOverlay = null;
    if (this.zoom) this.zoom.setSuppressed(false);
  }

  private async copyDeckCode(
    code: string,
    textarea: HTMLTextAreaElement,
    note: Phaser.GameObjects.Text,
  ): Promise<void> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        textarea.focus();
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      }
      if (note.active) note.setText('Copied.').setColor('#9be6a8');
      this.deckCodeMessage = 'Deck code copied.';
      this.renderDeck();
    } catch {
      if (note.active) note.setText('Copy failed. Select the code and copy it manually.').setColor('#f0b0a0');
    }
  }
}
