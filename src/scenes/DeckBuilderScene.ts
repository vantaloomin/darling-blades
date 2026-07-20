import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Art } from '../art/ArtResolver';
import { SET_ICON_PATHS } from '../art/setIcons';
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
import {
  BASIC_LAND_IDS,
  LAND_STYLE_IDS,
  type BasicLandId,
  type LandStyleId,
  type SavedDeck,
} from '../meta/SaveManager';
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
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel as themedPanel, themedButton, type Pager, type ThemedButton } from '../ui/themeWidgets';

const GRID_COLS = 4;
const GRID_ROWS = 3;
const GRID_SIZE = GRID_COLS * GRID_ROWS;
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
const DESKTOP_DECK_ROWS = 6;
const DESKTOP_DECK_PITCH = 22;
/**
 * Inline basics end at y=296; their 44px hit target ends at 318. The list
 * starts at 326, preserving the 8px group gap. Six 12px rows at 22px pitch
 * end near 448, before the pager target begins at 492 - 22 = 470. A seventh
 * would end near 470, so six is the maximum without consuming that clearance.
 */
const DESKTOP_DECK_Y0 = 326;
/** Deck-list pager row + the stats block below it (F13), both cleared by the shorter list. */
const DECK_PAGER_Y = 492;
const DECK_STATS_Y = 528;
/** Right-panel inner gutter: panel spans x 880–1280, content sits at 900–1260. */
const PANEL_RIGHT_X = 1260;
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
  private poolPager!: Pager;
  private status!: Phaser.GameObjects.Text;
  private zoom!: CardZoomPreview;
  private deckCodeOverlay: Phaser.GameObjects.Container | null = null;
  private searchInput: Phaser.GameObjects.DOMElement | null = null;
  private filterButton!: ThemedButton;
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
      dim: theme.graphics.dim,
      dimAlpha: 0.55,
      fallback: () => {
        const grad = this.add.graphics();
        grad.fillGradientStyle(theme.graphics.panelFill, theme.graphics.panelFill, theme.graphics.dim, theme.graphics.dim, 1);
        grad.fillRect(0, 0, width, height);
      },
    });
    themedPanel(this, width - 400, 0, 400, height, { alpha: theme.alpha.chrome, radius: 0 });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed

    this.add
      .text(340, 40, 'Decks', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
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

    const filter = themedButton(this, 800, 40, 'Filters', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 96,
      onTap: () => this.toggleFilterPanel(),
    });
    this.filterButton = filter;

    backButton(this, () => this.scene.start('MainMenu'));

    // pool pager (‹ › audited at ~2.1mm wide — inflate to the 90px minimum;
    // their columns are clear of the pool grid at x 118+/628–)
    this.poolPager = pager(this, 350, height - 32, this.page, 1, (page) => {
      this.page = page;
      this.renderPool();
    });
    this.poolPager.container.setVisible(false);

    this.status = this.add
      .text(width - 380, height - 64, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.danger,
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
    this.poolPager.container.setVisible(pages > 1);
    this.poolPager.refresh(this.page, pages);
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

    const bg = themedPanel(this, 18, 82, 300, 554, { alpha: 0.98, strokeAlpha: theme.alpha.chrome });
    bg.setInteractive();
    panel.add(bg);
    panel.add(
      this.add
        .text(42, 112, 'Pool Filters', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5),
    );

    const close = themedButton(this, 286, 112, '×', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 44,
      onTap: () => this.closeFilterPanel(),
    });
    panel.add(close.container);

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

    const setOpts: DropdownOption<'all' | 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters'>[] = [
      { value: 'all', label: 'All Sets' },
      { value: 'base', label: 'Core Set' },
      { value: 'ragnarok', label: 'Ragnarök' },
      { value: 'celtic-fae', label: 'Celtic Fae' },
      { value: 'arthurian-court', label: 'Arthurian Court' },
      { value: 'gothic-monsters', label: 'Gothic Monsters' },
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

    const reset = themedButton(this, 108, 588, 'Reset Filters', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: 132,
      onTap: () => this.resetPoolFilters(),
    });
    panel.add(reset.container);

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
    if (!this.filterButton?.container.active) return;
    const activeCount = this.activePoolFilterCount();
    this.filterButton.setLabel(activeCount > 0 ? `Filters (${activeCount})` : 'Filters');
    this.filterButton.setVariant(this.filterPanel ? 'emphasis' : activeCount > 0 ? 'primary' : 'ghost');
  }

  private renderPool(): void {
    for (const c of this.cells) c.destroy();
    this.cells = [];
    const save = Services.save.data;
    const pool = this.pool();
    const pages = Math.max(1, Math.ceil(pool.length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
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
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: '700',
          color: inDeck > 0 ? theme.colors.success : theme.colors.muted,
          backgroundColor: theme.colors.panelFill,
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: '700',
            color: theme.colors.success,
            backgroundColor: theme.colors.panelFill,
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

  private cycleLandStyle(basicId: BasicLandId, rerenderDeck = true): LandStyleId | null {
    const deck = this.activeSavedDeck();
    if (!deck) return null;
    const current = deck.landStyle?.[basicId] ?? null;
    const cycle: readonly (LandStyleId | null)[] = [null, ...LAND_STYLE_IDS];
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    const styles = { ...(deck.landStyle ?? {}) };
    if (next) styles[basicId] = next;
    else delete styles[basicId];
    deck.landStyle = Object.keys(styles).length > 0 ? styles : null;
    Services.save.flush();
    if (rerenderDeck) this.renderDeck();
    return next;
  }

  private landStyleControl(
    x: number,
    y: number,
    basicId: BasicLandId,
    style: LandStyleId | null,
    onCycle: () => void = () => {
      this.cycleLandStyle(basicId);
    },
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const background = this.add.graphics();
    const icon = style && SET_ICON_PATHS[style]
      ? this.add.image(0, 0, `seticon-${style}-sr`).setDisplaySize(24, 24)
      : null;
    const zone = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
    let hovered = false;
    const redraw = (): void => {
      background.clear();
      background.fillStyle(theme.graphics.rowFill, 1);
      background.fillRoundedRect(-20, -15, 40, 30, theme.radius.control);
      background.lineStyle(
        theme.control.borderWidth,
        hovered ? colorInt(theme.colors.goldHover) : theme.graphics.panelStroke,
        hovered ? 1 : theme.alpha.chrome,
      );
      background.strokeRoundedRect(-20, -15, 40, 30, theme.radius.control);
    };
    bindTapButton(this, zone, onCycle);
    zone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) {
        hovered = true;
        redraw();
      }
    });
    zone.on('pointerout', () => {
      hovered = false;
      redraw();
    });
    container.add(icon ? [background, icon, zone] : [background, zone]);
    redraw();
    return container;
  }

  private showLandStylesModal(): void {
    this.closeFilterPanel();
    this.setSearchInputVisible(false);
    this.zoom.setSuppressed(true);

    const shell = modalShell(this, {
      width: 620,
      height: 520,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      tapDimToClose: false,
      escToClose: true,
      onClose: () => {
        this.setSearchInputVisible(true);
        this.zoom.setSuppressed(false);
        this.renderDeck();
      },
    });
    const overlay = shell.container;
    const titleTrack = shell.tracks.titleTrack;
    overlay.add(
      this.add
        .text(titleTrack.x, titleTrack.y + titleTrack.height / 2, 'Land styles', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5),
    );

    const bounds = shell.contentBounds;
    const rowPitch = 60;
    const rowY0 = bounds.y + 26;
    BASIC_LAND_IDS.forEach((id, i) => {
      const d = byId(id);
      const y = rowY0 + i * rowPitch;
      const rowBg = themedPanel(this, bounds.x, y - 26, bounds.width, 52, {
        alpha: theme.alpha.panel,
        radius: theme.radius.control,
      });
      const name = this.add.text(bounds.x + 92, y, d.name, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
      }).setOrigin(0, 0.5);
      overlay.add([rowBg, name]);

      let dynamic: Phaser.GameObjects.Container | null = null;
      const renderRow = (): void => {
        dynamic?.destroy();
        const style = this.activeSavedDeck()?.landStyle?.[id] ?? null;
        const preview = makeCardThumb(this, bounds.x + 48, y, d, 0.095, style ?? undefined);
        const cycler = this.landStyleControl(
          bounds.x + bounds.width - 36,
          y,
          id,
          style,
          () => {
            this.cycleLandStyle(id, false);
            renderRow();
          },
        );
        dynamic = this.add.container(0, 0, [preview, cycler]);
        overlay.add(dynamic);
      };
      renderRow();
    });

    const footer = shell.tracks.footerTrack;
    const close = themedButton(
      this,
      footer.x + footer.width / 2,
      footer.y + footer.height / 2,
      'Close',
      { variant: 'primary', minWidth: 120, onTap: shell.close },
    );
    overlay.add(close.container);
  }

  /** ‹ N/M › deck-list pager, shared by both profiles; sits below the list. */
  private renderDeckPagers(x0: number, pages: number): void {
    const deckPager = pager(this, x0 + 250, DECK_PAGER_Y, this.deckPage, pages, (page) => {
      this.deckPage = page;
      this.renderDeck();
    });
    this.rightPane.push(deckPager.container);
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
    const deckPickerShell = modalShell(this, {
      width: 1200,
      height: 640,
      dimAlpha: 0.52,
      depth: theme.depth.modal,
      showClose: false,
      tapDimToClose: false,
      escToClose: true,
    });
    const overlay = deckPickerShell.container;
    const closeOverlay = (): void => deckPickerShell.close();
    overlay.once(Phaser.GameObjects.Events.DESTROY, () => {
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
    overlay.add(
      this.add
        .text(640, 72, 'Your Decks', { fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading })
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
    const actionGap = 16;
    let pickerPage = 0;

    const renderDeckTile = (parent: Phaser.GameObjects.Container, deck: SavedDeck, x: number, y: number): void => {
      const isActive = deck.id === save.activeDeckId;
      const left = x - tileW / 2;
      const top = y - tileH / 2;
      const rightGuideX = left + tileW - 13;
      const bg = this.add
        .rectangle(x, y, tileW, tileH, isActive ? theme.graphics.rowFillActive : theme.graphics.panelFill, 0.96)
        .setStrokeStyle(1, colorInt(isActive ? theme.colors.gold : theme.colors.panelStroke), isActive ? 1 : theme.alpha.chrome)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, () => setActiveDeck(deck.id));
      parent.add(bg);

      const title = this.add
        .text(left + 18, top + 22, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          color: isActive ? theme.colors.gold : theme.colors.heading,
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            fontStyle: '700',
            color: deck.cards.length === RULES.deckSize ? theme.colors.success : theme.colors.danger,
          })
          .setOrigin(1, 0.5),
      );

      const actionX0 = rightGuideX - actionW * 2 - actionGap;
      const actionX1 = rightGuideX;
      const actionY0 = top + 116;
      const actionY1 = top + 166;
      const useBtn = themedButton(this, actionX0 + actionW / 2, actionY0, isActive ? 'Using' : 'Use', {
        variant: isActive ? 'primary' : 'ghost',
        size: 'sm',
        minWidth: actionW,
        onTap: () => setActiveDeck(deck.id),
      });
      parent.add(useBtn.container);
      const copyBtn = themedButton(this, actionX1 - actionW / 2, actionY0, 'Copy', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: actionW,
        onTap: () => {
        const id = copyDeck(save, deck.id);
        if (!id) return;
        const index = save.decks.findIndex((d) => d.id === id);
        if (index >= 0) pickerPage = Math.floor(index / pageSize);
        Services.save.flush();
        renderGrid();
        },
      });
      parent.add(copyBtn.container);
      const renameBtn = themedButton(this, actionX0 + actionW / 2, actionY1, 'Rename', {
        variant: 'ghost',
        size: 'sm',
        minWidth: actionW,
        onTap: () => {
        this.promptRename(deck.id, () => {
          if (deck.id === save.activeDeckId) this.renderDeck();
          renderGrid();
        });
        },
      });
      parent.add(renameBtn.container);
      let delArmed = false;
      const delBtn = themedButton(this, actionX1 - actionW / 2, actionY1, 'Delete', {
        variant: 'danger',
        size: 'sm',
        minWidth: actionW,
        onTap: () => {
        if (save.settings.confirmDestructive && !delArmed) {
          delArmed = true;
          delBtn.setLabel('Delete?');
          delBtn.setVariant('primary');
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
        },
      });
      parent.add(delBtn.container);
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
        .rectangle(x, y, tileW, tileH, theme.graphics.panelFill, theme.alpha.panel)
        .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, create);
      parent.add(bg);
      parent.add(
        this.add
          .rectangle(left + 18, top + 18, tileW - 36, tileH - 36, theme.graphics.dim, 0)
          .setOrigin(0, 0)
          .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.subtle),
      );
      parent.add(
        this.add
          .text(x, top + 70, '+', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.display}px`, color: theme.colors.success })
          .setOrigin(0.5),
      );
      parent.add(
        this.add
          .text(x, top + 118, 'New Deck', {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.h2}px`,
            color: theme.colors.success,
          })
          .setOrigin(0.5),
      );
      const btn = themedButton(this, x, top + 158, 'Create Empty Deck', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: 160,
        onTap: create,
      });
      parent.add(btn.container);
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
        const pickerPager = pager(this, 590, 638, pickerPage, pages, (page) => {
          pickerPage = page;
          renderGrid();
        });
        gridLayer.add(pickerPager.container);
      }
    };
    renderGrid();

    const closeBtn = themedButton(this, 640, 678, 'Close', {
      variant: 'ghost',
      minWidth: 100,
      onTap: closeOverlay,
    });
    overlay.add(closeBtn.container);
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
      .rectangle(x, y, width, height, theme.graphics.panelFill, 1)
      .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
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
      parent.add(this.add.rectangle(x, y, width, height, theme.graphics.dim, 0).setStrokeStyle(1, colorInt(theme.colors.gold), theme.alpha.ghost));
      return;
    }

    parent.add(this.add.rectangle(x, y, artW, artH, theme.graphics.rowFill, 1));
    parent.add(
      this.add
        .text(x, y, 'No Image', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
  }

  /** Rename a deck in-place via a styled modal; Enter commits, Esc/Cancel dismiss. */
  private promptRename(deckId: string, onDone?: () => void): void {
    const save = Services.save.data;
    const deck = save.decks.find((d) => d.id === deckId);
    if (!deck) return;
    const renameShell = modalShell(this, {
      width: 460,
      height: 230,
      dimAlpha: 0.52,
      depth: theme.depth.results,
      showClose: false,
      tapDimToClose: false,
      escToClose: false,
    });
    const modal = renameShell.container;
    modal.add(
      this.add
        .text(640, 298, 'Rename Deck', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    modal.add(
      this.add
        .text(640, 330, `${DECK_NAME_MAX_LENGTH} characters max`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
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
      `width:340px;box-sizing:border-box;padding:10px 12px;font:${theme.type.body}px ${theme.fonts.ui};color:${theme.colors.body};background:${theme.colors.panelFill};border:1px solid ${theme.colors.gold};border-radius:${theme.radius.control}px;outline:none;text-align:center;box-shadow:0 0 18px ${theme.colors.btnEmphasisBg};`,
    );
    const inputDom = this.add.dom(640, 372, input).setDepth(151);

    const close = (): void => {
      inputDom.destroy();
      renameShell.close();
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
    const saveBtn = themedButton(this, 585, 438, 'Save', {
      variant: 'primary',
      minWidth: 90,
      onTap: () => commit(),
    });
    const cancelBtn = themedButton(this, 704, 438, 'Cancel', {
      variant: 'ghost',
      minWidth: 90,
      onTap: () => commit(true),
    });
    modal.add([saveBtn.container, cancelBtn.container]);
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
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0.5),
    );

    const baseY = DECK_STATS_Y + 50; // bar baseline (bars grow upward)
    const maxCount = Math.max(1, ...s.curve);
    s.curve.forEach((count, mv) => {
      const bx = x0 + 16 + mv * 22;
      const h = count > 0 ? Math.max(3, Math.round((count / maxCount) * 30)) : 2;
      push(this.add.rectangle(bx, baseY, 15, h, count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1));
      if (count > 0) {
        push(
          this.add
            .text(bx, baseY - h - 8, `${count}`, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              color: theme.colors.body,
            })
            .setOrigin(0.5),
        );
      }
      push(
        this.add
          .text(bx, baseY + 9, mv === 7 ? '7+' : `${mv}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0.5),
      );
    });

    const other = s.nonlands - s.typeCounts.creature;
    push(
      this.add
        .text(x0, baseY + 34, `${s.typeCounts.creature} creatures · ${s.lands} lands · ${other} other`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
    );
    const pips = PIE_COLORS.filter((c) => s.colorPips[c] > 0)
      .map((c) => `${c}·${s.colorPips[c]}`)
      .join('   ');
    push(
      this.add
        .text(x0, baseY + 56, pips || 'colorless', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
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
    const title = this.add
      .text(x0, 32, `${active?.name ?? 'Custom Deck'} · ${this.deck.length}/${RULES.deckSize}`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: this.deck.length === RULES.deckSize ? theme.colors.success : theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    this.fitTextToWidth(title, this.touch ? 130 : 250);
    this.rightPane.push(title);
    if (this.touch) {
      const landStylesBtn = themedButton(this, x0 + 200, 32, 'Land styles', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: 110,
        onTap: () => this.showLandStylesModal(),
      });
      this.rightPane.push(landStylesBtn.container);
    }
    // F15: deck picker (switch / new / copy / rename / delete).
    const decksBtn = themedButton(this, PANEL_RIGHT_X - 45, 32, '☰ Decks', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.showDeckPicker(),
    });
    this.rightPane.push(decksBtn.container);

    // Touch restores the pre-feature five-row block. Desktop keeps the inline
    // preview and selector at a 52px pitch, leaving 8px between 44px targets.
    const basicsPitch = this.touch ? 40 : 52;
    BASIC_LAND_IDS.forEach((id, i) => {
      const d = byId(id);
      const y = (this.touch ? 78 : 88) + i * basicsPitch;
      const n = this.countIn(this.deck, id);
      const landStyle = active?.landStyle?.[id] ?? null;
      const row = this.add
        .text(x0, y, `${d.name}: ${n}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${this.touch ? theme.type.label : theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      if (!this.touch) this.fitTextToWidth(row, 76);
      const minus = themedButton(this, PANEL_RIGHT_X - (this.touch ? 145 : 149), y, '−', {
        variant: 'danger',
        size: 'sm',
        minWidth: 90,
        onTap: () => this.removeCard(id),
      });
      const plus = themedButton(this, PANEL_RIGHT_X - 45, y, '+', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: 90,
        onTap: () => {
          this.deckCodeMessage = '';
          this.deck.push(id);
          this.renderDeck();
        },
      });
      this.rightPane.push(row);
      if (!this.touch) {
        const preview = makeCardThumb(this, x0 + 94, y, d, 0.095, landStyle ?? undefined);
        const style = this.landStyleControl(x0 + 132, y, id, landStyle);
        this.rightPane.push(preview, style);
      }
      this.rightPane.push(minus.container, plus.container);
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: '700',
            color: heroId === id ? theme.colors.goldHover : theme.colors.muted,
          })
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, star, () => this.toggleDeckHero(id));
        inflateHitArea(star, 34, 36);
        const row = this.add
          .text(x0 + 24, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
          })
          .setInteractive({ useHandCursor: true });
        this.zoom.attach(row, d);
        row.on('pointerover', () => {
          row.setColor(theme.colors.danger);
          inflateHitArea(row, 90, DESKTOP_DECK_PITCH);
        });
        row.on('pointerout', () => {
          row.setColor(theme.colors.body);
          inflateHitArea(row, 90, DESKTOP_DECK_PITCH);
        });
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
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.label}px`,
              fontStyle: '700',
              color: heroId === id ? theme.colors.goldHover : theme.colors.muted,
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, star, () => this.toggleDeckHero(id));
          inflateHitArea(star, 44, TOUCH_DECK_PITCH);
          const row = this.add.text(x0 + 26, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
          });
          const minus = themedButton(this, PANEL_RIGHT_X - 45, y + 8, '−', {
            variant: 'danger',
            size: 'sm',
            minWidth: 90,
            onTap: (p) => this.removeCardOrAll(id, p),
          });
          this.rightPane.push(star, row, minus.container);
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
    this.status.setColor(issues.some((i) => i.kind === 'error') ? theme.colors.danger : this.deckCodeMessage ? theme.colors.success : theme.colors.danger);
    this.status.setText(statusLines.join('\n'));
    const canSave = issues.every((i) => i.kind !== 'error');
    // Bottom action row: Export left-aligned to the x0 gutter, Import
    // right-aligned to the panel gutter (the old x0+334 center clipped it
    // off-screen), Save centered between them on the same baseline.
    const exportBtn = themedButton(this, x0 + 52, 684, 'Export Code', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: 104,
      onTap: () => this.exportDeckCode(),
    });
    const importBtn = themedButton(this, PANEL_RIGHT_X - 52, 684, 'Import Code', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: 104,
      onTap: () => this.importDeckCode(),
    });
    const saveBtn = themedButton(this, x0 + 180, 684, 'Save Deck', {
      variant: 'primary',
      minWidth: 140,
      enabled: canSave,
      onTap: () => {
        const save = Services.save.data;
        const id = save.activeDeckId ?? 'custom-1';
        const existing = save.decks.find((d) => d.id === id);
        const name = existing?.name ?? 'Custom Deck';
        const heroCardId = existing?.heroCardId && this.deck.includes(existing.heroCardId) ? existing.heroCardId : null;
        saveDeck(save, { id, name, cards: [...this.deck], heroCardId });
        save.activeDeckId = id;
        Services.save.flush();
        this.deckCodeMessage = '';
        saveBtn.setLabel('Saved ✓');
        this.time.delayedCall(900, () => {
          if (saveBtn.container.active) saveBtn.setLabel('Save Deck');
        });
      },
    });
    this.rightPane.push(exportBtn.container, importBtn.container, saveBtn.container);
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
    const deckCodeShell = modalShell(this, {
      width: 720,
      height: 330,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      showClose: false,
      tapDimToClose: false,
      escToClose: false,
    });
    const overlay = deckCodeShell.container;
    this.deckCodeOverlay = overlay;

    overlay.add(
      this.add
        .text(640, 228, mode === 'export' ? 'Export Deck Code' : 'Import Deck Code', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.body,
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
        `font:${theme.type.label}px ${theme.fonts.ui}`,
        'line-height:1.35',
        `color:${theme.colors.body}`,
        `background:${theme.colors.panelFill}`,
        `border:1px solid ${theme.colors.gold}`,
        `border-radius:${theme.radius.control}px`,
        'outline:none',
        `box-shadow:0 0 18px ${theme.colors.btnEmphasisBg}`,
      ].join(';'),
    );
    const dom = this.add.dom(640, 342, textarea).setOrigin(0.5);
    overlay.add(dom);

    const note = this.add
      .text(640, 418, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    overlay.add(note);

    if (mode === 'export') {
      const copyBtn = themedButton(this, 578, 472, 'Copy Code', {
        variant: 'primary',
        minWidth: 120,
        onTap: () => {
          void this.copyDeckCode(code, textarea, note);
        },
      });
      const closeBtn = themedButton(this, 716, 472, 'Close', {
        variant: 'ghost',
        minWidth: 100,
        onTap: () => this.closeDeckCodeOverlay(),
      });
      overlay.add([copyBtn.container, closeBtn.container]);
    } else {
      const importBtn = themedButton(this, 570, 472, 'Import', {
        variant: 'primary',
        minWidth: 100,
        onTap: () => {
          if (this.applyDeckCodeImport(textarea.value, false)) this.closeDeckCodeOverlay();
          else note.setText(this.deckCodeMessage).setColor(theme.colors.danger);
        },
      });
      const cancelBtn = themedButton(this, 710, 472, 'Cancel', {
        variant: 'ghost',
        minWidth: 100,
        onTap: () => this.closeDeckCodeOverlay(),
      });
      overlay.add([importBtn.container, cancelBtn.container]);
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
      if (note.active) note.setText('Copied.').setColor(theme.colors.success);
      this.deckCodeMessage = 'Deck code copied.';
      this.renderDeck();
    } catch {
      if (note.active) note.setText('Copy failed. Select the code and copy it manually.').setColor(theme.colors.danger);
    }
  }
}
