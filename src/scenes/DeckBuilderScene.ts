import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { SET_ICON_PATHS } from '../art/setIcons';
import { SET_TITLES } from '../data/setTitles';
import { FEATURES } from '../config/features';
import { RULES } from '../config/rules';
import { heroById } from '../data/heroes';
import { ALL_CARDS, CARD_DB, byId } from '../data/catalog';
import type { CardDef, CardType, Color, Rarity } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { displayVariantFor, isBasic, ownedCount } from '../meta/Collection';
import {
  applyFilters,
  collectiblePool,
  defaultFilterState,
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../meta/collectionFilter';
import { decodeDeck, deckCodeErrorMessage, encodeDeck } from '../meta/DeckCode';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import { deckHealth } from '../meta/deckRepair';
import {
  appendDeckSlot,
  appendDeckSlots,
  cloneDeckSlots,
  copyDeck,
  deleteDeck,
  generateDeckId,
  removeAllDeckSlots,
  removeDeckSlot,
  renameDeck,
  saveDeck,
  switchDeckFormat,
  validateDeck,
} from '../meta/DeckStorage';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  validateLandReserve,
} from '../meta/warchest';
import {
  darlingsCardError,
  listOwnedLegendaryCreatures,
  validateWarchestDeck,
  validateDarlingsDeck,
} from '../meta/darlings';
import {
  BASIC_LAND_IDS,
  LAND_STYLE_IDS,
  type BasicLandId,
  type LandStyleId,
  type SavedDeck,
} from '../meta/SaveManager';
import { Services } from '../meta/services';
import { PLAIN_VARIANT, TIER_LABEL, variantKey, type CardVariant } from '../meta/variants';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CardZoomPreview } from '../ui/CardZoomPreview';
import { showDarlingsTutorial } from '../ui/DarlingsTutorial';
import { computeDeckStats, PIE_COLORS } from '../ui/deckStats';
import {
  DECK_PANE_LAYOUT,
  deckPaneOffsetY,
  deckPaneToggleState,
  defaultDeckPaneMode,
  resolveDeckPaneMode,
  warchestSlotLabel,
  warchestSlotPosition,
  type DeckPaneMode,
} from '../ui/deckPanePresentation';
import { Dropdown, type DropdownOption } from '../ui/Dropdown';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel as themedPanel, registerSceneBackNavigation, themedButton, type ModalShell, type Pager, type ThemedButton } from '../ui/themeWidgets';
import {
  DARLINGS_RULES_COPY,
  activeVisibleSavedDeck,
  builderFormatForDeck,
  collapseDeckRows,
  formatDeckSize,
  formatLabel,
  formatPageCount,
  formatPageSlice,
  formatRulesCopy,
  gridPosition,
  isDeckBuilderDirty,
  offeredBuilderFormats,
  type BuilderFormat,
  visibleBuilderFormatTabs,
  visibleSavedDecks,
} from '../ui/deckBuilderHelpers';

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
const DESKTOP_DECK_PITCH = DECK_PANE_LAYOUT.cards.rowPitch;
/**
 * Inline basics end at y=296; their 44px hit target ends at 318. The list
 * starts at 326, preserving the 8px group gap. Six 12px rows at 22px pitch
 * end near 448, before the pager target begins at 492 - 22 = 470. A seventh
 * would end near 470, so six is the maximum without consuming that clearance.
 */
const DESKTOP_DECK_Y0 = 336;
/** Deck-list pager row + the stats block below it (F13), both cleared by the shorter list. */
const DECK_PAGER_Y = DECK_PANE_LAYOUT.summary.pagerY;
const DECK_STATS_Y = DECK_PANE_LAYOUT.summary.statsHeadingY;
/** Last safe bottom for a row before the repair/stats region starts at y=514. */
// Rows stop clear of the stats heading band (isolation pass 2026-08-18).
const DECK_ROW_TRACK_BOTTOM = 502;
/** Right-panel inner gutter: panel spans x 880–1280, content sits at 900–1260. */
const PANEL_RIGHT_X = 1260;
const DECK_NAME_MAX_LENGTH = 24;
const YOKAI_NIGHTS_SET = 'yokai-nights' as const;
const DARLING_PAGE_SIZE = 6;

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
  private variantPins: Array<string | null> = [];
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
  private landReserve: string[] = [];
  private deckPaneMode: DeckPaneMode = defaultDeckPaneMode();
  /** Captured at create() so a local dev flip applies when a scene is reopened. */
  private reserveFormatsEnabled = false;
  private classicRetired = false;
  /** UI working deck. A hidden active deck remains untouched in the save. */
  private workingDeckId: string | null = null;
  private savedDeckSnapshot: Pick<SavedDeck, 'cards' | 'variantPins' | 'landReserve' | 'heroCardId' | 'darlingId'> | null = null;
  private exitPrompt: ModalShell | null = null;

  constructor() {
    super('DeckBuilder');
  }

  /** Collection-context previews use the player's shared display treatment. */
  private ownedVariantFor(cardId: string): CardVariant | undefined {
    const save = Services.save.data;
    if (ownedCount(save, cardId) <= 0) return undefined;
    const variant = displayVariantFor(save, cardId);
    return variantKey(variant) === variantKey(PLAIN_VARIANT) ? undefined : variant;
  }

  /** A collection pin or retained legacy slot pin keeps a collapsed row legible. */
  private hasPinnedDisplay(cardId: string, hasLegacyVariantPin = false): boolean {
    return hasLegacyVariantPin || typeof Services.save.data.pinnedVariants[cardId] === 'string';
  }

  create(data: { deckId?: string } = {}): void {
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.classicRetired = FEATURES.classicRetired;
    this.workingDeckId = null;
    this.page = 0;
    this.deckPage = 0;
    this.deckPaneMode = defaultDeckPaneMode();
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
    this.exitPrompt = null;

    const save = Services.save.data;
    const requested = typeof data.deckId === 'string'
      ? save.decks.find((deck) => deck.id === data.deckId) ?? null
      : null;
    const active = requested ?? activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled);
    this.workingDeckId = active?.id ?? null;
    const slots = active ? cloneDeckSlots(active.cards, active.variantPins) : cloneDeckSlots([]);
    this.deck = slots.cards;
    this.variantPins = slots.variantPins;
    this.landReserve = active?.landReserve ? [...active.landReserve] : [];
    this.savedDeckSnapshot = this.snapshotSavedDeck(active);

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

    backButton(this, 'Menu', () => this.leaveDeckBuilder());
    registerSceneBackNavigation(this, () => this.leaveDeckBuilder());

    // pool pager (‹ › audited at ~2.1mm wide — inflate to the 90px minimum;
    // their columns are clear of the pool grid at x 118+/628–)
    this.poolPager = pager(this, 350, height - 32, this.page, 1, (page) => {
      this.page = page;
      this.renderPool();
    });
    this.poolPager.container.setVisible(false);

    this.status = this.add
      .text(width - 380, DECK_PANE_LAYOUT.summary.statusBottomY, '', {
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
    if (this.activeFormat() === 'darlings') {
      showDarlingsTutorial(this, {
        onReadMore: () => this.scene.start('Glossary', { focus: 'Darlings' }),
      });
    }
  }

  private activeFormat(): BuilderFormat {
    return builderFormatForDeck(this.activeSavedDeck(), this.reserveFormatsEnabled);
  }

  private isReserveFormat(): boolean {
    return this.activeFormat() !== 'constructed';
  }

  private copyLimit(): number {
    return this.activeFormat() === 'darlings' ? 1 : RULES.maxCopies;
  }

  private syncDraftToActiveDeck(): SavedDeck | null {
    const active = this.activeSavedDeck();
    if (!active) return null;
    const slots = cloneDeckSlots(this.deck, this.variantPins);
    active.cards = slots.cards;
    active.variantPins = slots.variantPins;
    active.landReserve = this.isReserveFormat() ? [...this.landReserve] : null;
    if (active.heroCardId && !active.cards.includes(active.heroCardId)) active.heroCardId = null;
    return active;
  }

  private currentIssues(cards: readonly string[] = this.deck): ReturnType<typeof validateDeck> {
    const format = this.activeFormat();
    if (format === 'darlings') {
      return validateDarlingsDeck(
        CARD_DB,
        Services.save.data,
        cards,
        this.activeSavedDeck()?.darlingId ?? null,
        this.landReserve,
      );
    }
    if (format === 'warchest') {
      return validateWarchestDeck(CARD_DB, Services.save.data, cards, this.landReserve);
    }
    return validateDeck(CARD_DB, Services.save.data, cards);
  }

  private pool(): CardDef[] {
    this.filterState.ownedOnly = true;
    const cards = collectiblePool(ALL_CARDS).filter(
      (card) => !this.isReserveFormat() || !card.types.includes('land'),
    );
    return applyFilters(cards, this.filterState, Services.save.data);
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

    const setOpts: DropdownOption<CollectionFilterState['set']>[] = [
      { value: 'all', label: 'All Sets' },
      { value: 'base', label: SET_TITLES.base },
      { value: 'ragnarok', label: SET_TITLES.ragnarok },
      { value: 'celtic-fae', label: SET_TITLES['celtic-fae'] },
      { value: 'arthurian-court', label: SET_TITLES['arthurian-court'] },
      { value: 'gothic-monsters', label: SET_TITLES['gothic-monsters'] },
      { value: 'dark-tales', label: SET_TITLES['dark-tales'] },
      { value: YOKAI_NIGHTS_SET, label: 'Yokai Nights' },
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

    if (pool.length === 0) {
      const empty = this.add
        .text(POOL_X0 + 1.5 * POOL_PITCH_X, POOL_Y0 + POOL_PITCH_Y, 'No cards in this set yet.', {
          fontFamily: theme.fonts.ui,
          fontSize: theme.type.body + 'px',
          color: theme.colors.muted,
          align: 'center',
          wordWrap: { width: 430 },
        })
        .setOrigin(0.5);
      this.cells.push(empty);
      return;
    }

    pool.slice(this.page * GRID_SIZE, (this.page + 1) * GRID_SIZE).forEach((d, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = POOL_X0 + col * POOL_PITCH_X;
      const y = POOL_Y0 + row * POOL_PITCH_Y;
      // Cached-thumbnail Image instead of a live CardView — cheap to churn per page.
      const variant = this.ownedVariantFor(d.id);
      const thumb = makeCardThumb(this, x, y, d, POOL_CARD_SCALE, undefined, variant);
      thumb.setInteractive({ useHandCursor: true });
      this.zoom.attach(thumb, d, variant);
      // Tap-classified on touch so a drag across the grid can't add cards.
      bindTapButton(this, thumb, (p) => this.addCardOrPlayset(d.id, p));
      this.cells.push(thumb);
      const inDeck = this.countIn(this.deck, d.id);
      const badge = this.add
        .text(x + 60, y + POOL_BADGE_OFFSET_Y, inDeck + '/' + Math.min(this.copyLimit(), ownedCount(save, d.id)), {
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
      const addable = Math.min(this.copyLimit(), ownedCount(save, d.id)) - inDeck;
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
    const card = CARD_DB[id];
    if (!card || (this.isReserveFormat() && card.types.includes('land'))) return;
    const inDeck = this.countIn(this.deck, id);
    const ownershipLimit = isBasicLand(card) ? Number.POSITIVE_INFINITY : ownedCount(save, id);
    if (inDeck >= Math.min(this.copyLimit(), ownershipLimit)) return;
    this.deckCodeMessage = '';
    const next = appendDeckSlot({ cards: this.deck, variantPins: this.variantPins }, id);
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    this.renderPool();
    this.renderDeck();
  }

  private addCardOrPlayset(id: string, pointer: Phaser.Input.Pointer): void {
    if (this.shiftHeld(pointer)) this.addPlayset(id);
    else this.addCard(id);
  }

  /** Add-a-playset: fill this card up to the per-card cap in one tap. */
  private addPlayset(id: string): void {
    const card = CARD_DB[id];
    if (!card || (this.isReserveFormat() && card.types.includes('land'))) return;
    const cap = Math.min(this.copyLimit(), ownedCount(Services.save.data, id));
    this.deckCodeMessage = '';
    const additions = new Array(Math.max(0, cap - this.countIn(this.deck, id))).fill(id);
    const next = appendDeckSlots({ cards: this.deck, variantPins: this.variantPins }, additions);
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    this.renderPool();
    this.renderDeck();
  }

  private removeCardOrAll(id: string, pointer: Phaser.Input.Pointer): void {
    if (this.shiftHeld(pointer)) this.removeAllCopies(id);
    else this.removeCard(id);
  }

  private removeAllCopies(id: string): void {
    const next = removeAllDeckSlots({ cards: this.deck, variantPins: this.variantPins }, id);
    if (next.cards.length === this.deck.length) return;
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    const active = this.activeSavedDeck();
    if (active?.heroCardId === id) active.heroCardId = null;
    this.deckCodeMessage = '';
    this.renderPool();
    this.renderDeck();
  }

  private removeCard(id: string): void {
    const idx = this.deck.indexOf(id);
    if (idx >= 0) {
      const next = removeDeckSlot({ cards: this.deck, variantPins: this.variantPins }, idx);
      this.deck = next.cards;
      this.variantPins = next.variantPins;
    }
    this.deckCodeMessage = '';
    this.renderPool();
    this.renderDeck();
  }

  private activeSavedDeck(): SavedDeck | null {
    const save = Services.save.data;
    return save.decks.find((d) => d.id === this.workingDeckId) ?? null;
  }

  private snapshotSavedDeck(deck: SavedDeck | null | undefined): Pick<SavedDeck, 'cards' | 'variantPins' | 'landReserve' | 'heroCardId' | 'darlingId'> | null {
    if (!deck) return null;
    return {
      cards: [...deck.cards],
      variantPins: deck.cards.map((_, index) => deck.variantPins?.[index] ?? null),
      landReserve: deck.landReserve ? [...deck.landReserve] : null,
      heroCardId: deck.heroCardId,
      darlingId: deck.darlingId ?? null,
    };
  }

  private restoreSavedDeckSnapshot(): void {
    const active = this.activeSavedDeck();
    const snapshot = this.savedDeckSnapshot;
    if (!active || !snapshot) return;
    active.cards = [...snapshot.cards];
    active.variantPins = [...(snapshot.variantPins ?? [])];
    active.landReserve = snapshot.landReserve ? [...snapshot.landReserve] : null;
    active.heroCardId = snapshot.heroCardId;
    active.darlingId = snapshot.darlingId ?? null;
  }

  private hasUnsavedDeckEdits(): boolean {
    return isDeckBuilderDirty(
      {
        cards: this.deck,
        variantPins: this.variantPins,
        landReserve: this.landReserve,
        heroCardId: this.activeSavedDeck()?.heroCardId ?? null,
        darlingId: this.activeSavedDeck()?.darlingId ?? null,
      },
      this.savedDeckSnapshot,
    );
  }

  private saveWorkingDeck(): boolean {
    const issues = this.currentIssues();
    const blocking = issues.find((issue) => issue.kind === 'error');
    if (blocking) {
      this.deckCodeMessage = `Save blocked: ${blocking.message}`;
      return false;
    }
    const save = Services.save.data;
    const active = this.activeSavedDeck();
    const format = this.activeFormat();
    // The working deck, never save.activeDeckId: when a hidden reserve deck is
    // still the save's active deck, writing to that id would overwrite the very
    // deck the release flag is meant to preserve.
    const id = this.workingDeckId ?? generateDeckId(save);
    const existing = save.decks.find((d) => d.id === id);
    const name = existing?.name ?? 'Custom Deck';
    const heroCardId = format === 'constructed' && existing?.heroCardId && this.deck.includes(existing.heroCardId)
      ? existing.heroCardId
      : null;
    saveDeck(save, {
      id,
      name,
      cards: [...this.deck],
      heroCardId,
      format,
      darlingId: format === 'darlings' ? active?.darlingId ?? null : null,
      landReserve: format === 'constructed' ? null : [...this.landReserve],
      variantPins: [...this.variantPins],
    });
    save.activeDeckId = id;
    this.workingDeckId = id;
    this.savedDeckSnapshot = this.snapshotSavedDeck(save.decks.find((d) => d.id === id) ?? null);
    Services.save.flush();
    this.deckCodeMessage = '';
    return true;
  }

  private leaveDeckBuilder(): void {
    if (!this.hasUnsavedDeckEdits()) {
      this.scene.start('MainMenu');
      return;
    }
    if (this.exitPrompt) return;
    const shell = modalShell(this, {
      width: 620,
      height: 280,
      dimAlpha: 0.82,
      tapDimToClose: true,
      onClose: () => {
        if (this.exitPrompt === shell) this.exitPrompt = null;
      },
    });
    this.exitPrompt = shell;
    const c = shell.container;
    c.add(this.add.text(640, 250, 'Unsaved changes', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    }).setOrigin(0.5));
    c.add(this.add.text(640, 300, 'Your deck has changes since the last Save Deck.', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.body}px`,
      color: theme.colors.body,
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5));
    const status = this.add.text(640, 348, '', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      color: theme.colors.danger,
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5);
    c.add(status);
    // Three buttons (150 + 190 + 150) with 36px gaps span 562px, centred in
    // the 620px shell: 359..921 against panel edges at 330 and 950. The prior
    // 420/640/880 spacing pushed Keep Editing to 955 and off the panel.
    const save = themedButton(this, 434, 410, 'Save Deck', {
      variant: 'primary',
      minWidth: 150,
      enabled: this.currentIssues().every((issue) => issue.kind !== 'error'),
      onTap: () => {
        if (!this.saveWorkingDeck()) {
          status.setText(this.deckCodeMessage);
          return;
        }
        shell.close();
        this.scene.start('MainMenu');
      },
    });
    const leave = themedButton(this, 640, 410, 'Leave Without Saving', {
      variant: 'danger',
      minWidth: 190,
      onTap: () => {
        shell.close();
        this.restoreSavedDeckSnapshot();
        Services.save.flush();
        this.scene.start('MainMenu');
      },
    });
    const cancel = themedButton(this, 846, 410, 'Keep Editing', {
      variant: 'ghost',
      minWidth: 150,
      onTap: shell.close,
    });
    c.add([save.container, leave.container, cancel.container]);
  }

  private deckHeroId(): string | null {
    const active = this.activeSavedDeck();
    if (active?.format === 'darlings') {
      return darlingFaceCardFor({ cards: this.deck, format: active.format, darlingId: active.darlingId }, CARD_DB);
    }
    const hero = active?.heroCardId ?? null;
    return hero && CARD_DB[hero] && this.deck.includes(hero) ? hero : null;
  }

  private toggleDeckHero(id: string): void {
    const deck = this.activeSavedDeck();
    if (!deck || deck.format === 'darlings' || !this.deck.includes(id)) return;
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
        fontSize: theme.type.body + 'px',
        color: theme.colors.body,
      }).setOrigin(0, 0.5);
      overlay.add([rowBg, name]);

      let dynamic: Phaser.GameObjects.Container | null = null;
      const renderRow = (): void => {
        dynamic?.destroy();
        const style = this.activeSavedDeck()?.landStyle?.[id] ?? null;
        const preview = makeCardThumb(this, bounds.x + 48, y, d, 0.095, style ?? undefined, this.ownedVariantFor(d.id));
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

  private selectFormat(format: BuilderFormat): void {
    // The single format-mutation point, so it re-checks the offered list
    // rather than trusting the buttons: after classic retirement this is also
    // what stops a deck from being switched BACK to constructed.
    if (!offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired).includes(format)) return;
    const active = this.syncDraftToActiveDeck();
    if (!active) {
      // No saved deck yet: formats live on the saved record, so tell the
      // player instead of silently ignoring the tap.
      this.deckCodeMessage = 'Save your deck first, then pick its format.';
      this.renderDeck();
      return;
    }
    if (this.activeFormat() === format) {
      if (format === 'darlings') this.openDarlingsFormat();
      return;
    }
    this.landReserve = switchDeckFormat(active, format);
    Services.save.flush();
    this.deckPage = 0;
    this.deckPaneMode = defaultDeckPaneMode();
    this.renderPool();
    this.renderDeck();
    if (format === 'darlings') this.openDarlingsFormat();
  }

  private openDarlingsFormat(): void {
    const tutorial = showDarlingsTutorial(this, {
      onDismiss: () => this.showDarlingPicker(),
      onReadMore: () => this.scene.start('Glossary', { focus: 'Darlings' }),
    });
    if (!tutorial) this.showDarlingPicker();
  }

  private showDarlingPicker(): void {
    this.closeFilterPanel();
    this.setSearchInputVisible(false);
    this.zoom.setSuppressed(true);
    const candidates = listOwnedLegendaryCreatures(CARD_DB, Services.save.data);
    const shell = modalShell(this, {
      width: 850,
      height: 570,
      dimAlpha: 0.56,
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
    // Shell panel spans y 75-645: keep the header inside it, the copy narrow
    // enough to clear the corner close button, and both above row 1 (top 162).
    overlay.add(
      this.add.text(640, 108, 'Choose your Darling', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      }).setOrigin(0.5),
    );
    overlay.add(
      this.add.text(640, 142, DARLINGS_RULES_COPY, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: 620 },
      }).setOrigin(0.5),
    );
    const pageSize = DARLING_PAGE_SIZE;
    const pages = formatPageCount(candidates.length, pageSize);
    let items: Phaser.GameObjects.GameObject[] = [];
    let pageControl: Pager | null = null;
    const clear = (): void => {
      for (const item of items) if (item.active) item.destroy();
      items = [];
    };
    const choose = (id: string): void => {
      const active = this.syncDraftToActiveDeck();
      if (!active || active.format !== 'darlings') return;
      const withoutPrevious = active.darlingId
        ? removeAllDeckSlots({ cards: this.deck, variantPins: this.variantPins }, active.darlingId)
        : { cards: this.deck, variantPins: this.variantPins };
      const next = removeAllDeckSlots(withoutPrevious, id);
      this.deck = next.cards;
      this.variantPins = next.variantPins;
      active.darlingId = id;
      active.cards = [...this.deck];
      active.variantPins = [...this.variantPins];
      active.landReserve = [...this.landReserve];
      Services.save.flush();
      this.deckCodeMessage = '';
      this.renderPool();
      this.renderDeck();
      shell.close();
    };
    const renderPage = (nextPage: number): void => {
      clear();
      const visible = formatPageSlice(candidates, Math.max(0, nextPage), pageSize);
      if (visible.length === 0) {
        const empty = this.add.text(640, 300, 'No owned legendary creatures yet.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
        }).setOrigin(0.5);
        overlay.add(empty);
        items.push(empty);
        pageControl?.refresh(Math.max(0, nextPage), pages);
        return;
      }
      visible.forEach((candidate, index) => {
        const position = gridPosition(index, 3, 355, 208, 190, 150);
        const thumb = makeCardThumb(this, position.x, position.y, candidate, 0.22, undefined, this.ownedVariantFor(candidate.id));
        const name = this.add.text(position.x, position.y + 72, candidate.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        }).setOrigin(0.5);
        this.fitTextToWidth(name, 150);
        const button = themedButton(this, position.x, position.y + 101, 'Choose', {
          variant: 'primary',
          size: 'sm',
          minWidth: 108,
          onTap: () => choose(candidate.id),
        });
        overlay.add([thumb, name, button.container]);
        items.push(thumb, name, button.container);
      });
      pageControl?.refresh(Math.max(0, nextPage), pages);
    };
    if (pages > 1) {
      pageControl = pager(this, 590, 500, 0, pages, renderPage);
      overlay.add(pageControl.container);
    }
    renderPage(0);
  }

  private reserveLandChoices(): CardDef[] {
    const darlingId = this.activeFormat() === 'darlings' ? this.activeSavedDeck()?.darlingId ?? null : null;
    return Object.values(CARD_DB)
      .filter((card) => isBasicLand(card) || (isDualLand(card) && ownedCount(Services.save.data, card.id) > 0))
      .filter((card) => !darlingId || darlingsCardError(CARD_DB, darlingId, card.id) === null)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  private setReserveSlot(index: number, cardId: string | null): void {
    const next = [...this.landReserve];
    // The reserve is a dense ordered list: filling a slot past the current
    // end appends, so holes (nulls) can never reach the saved deck.
    if (cardId) next[Math.min(index, next.length)] = cardId;
    else next.splice(index, 1);
    this.landReserve = next.slice(0, LAND_RESERVE_SIZE);
    const active = this.syncDraftToActiveDeck();
    if (active) active.landReserve = [...this.landReserve];
    Services.save.flush();
    this.renderDeck();
  }

  private showReserveLandPicker(index: number): void {
    const shell = modalShell(this, {
      width: 760,
      height: 560,
      dimAlpha: 0.56,
      depth: theme.depth.inspect,
      tapDimToClose: true,
      escToClose: true,
    });
    const overlay = shell.container;
    overlay.add(
      this.add.text(640, 72, 'Choose a land for Warchest Reserves slot ' + (index + 1), {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      }).setOrigin(0.5),
    );
    overlay.add(
      this.add.text(640, 112, 'Basics are unlimited. Dual lands must be owned.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
      }).setOrigin(0.5),
    );
    const choices: Array<{ id: string | null; label: string }> = [
      { id: null, label: 'Remove land' },
      ...this.reserveLandChoices().map((card) => ({ id: card.id, label: card.name })),
    ];
    const pageSize = 8;
    const pages = formatPageCount(choices.length, pageSize);
    let items: Phaser.GameObjects.GameObject[] = [];
    let pageControl: Pager | null = null;
    const clear = (): void => {
      for (const item of items) if (item.active) item.destroy();
      items = [];
    };
    const renderPage = (nextPage: number): void => {
      clear();
      formatPageSlice(choices, Math.max(0, nextPage), pageSize).forEach((choice, choiceIndex) => {
        const position = gridPosition(choiceIndex, 2, 440, 188, 260, 62);
        const button = themedButton(this, position.x, position.y, choice.label, {
          variant: choice.id === this.landReserve[index] ? 'primary' : 'ghost',
          size: 'sm',
          minWidth: 220,
          onTap: () => {
            this.setReserveSlot(index, choice.id);
            shell.close();
          },
        });
        overlay.add(button.container);
        items.push(button.container);
      });
      pageControl?.refresh(Math.max(0, nextPage), pages);
    };
    if (pages > 1) {
      pageControl = pager(this, 590, 500, 0, pages, renderPage);
      overlay.add(pageControl.container);
    }
    renderPage(0);
  }

  private renderFormatSwitch(x0: number, format: BuilderFormat): void {
    const offered = offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired);
    const tabs = visibleBuilderFormatTabs(offered);
    // A one-option switch is dead UI and reads as a duplicate of the pane
    // toggle's Warchest label (owner finding, 2026-08-18). Render only a
    // genuine choice.
    if (tabs.length < 2) return;
    const layout = DECK_PANE_LAYOUT.formatRow;
    this.rightPane.push(
      this.add.text(layout.labelX, layout.y, 'Format', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      }).setOrigin(0, 0.5),
    );
    tabs.forEach((choice, index) => {
      const button = themedButton(this, layout.tabFirstX + index * layout.tabPitch, layout.y, formatLabel(choice), {
        variant: choice === format ? 'primary' : 'ghost',
        size: 'sm',
        minWidth: layout.tabMinWidth,
        onTap: () => this.selectFormat(choice),
      });
      this.rightPane.push(button.container);
    });
  }

  private renderDeckPaneToggle(reserveIssueCount: number, lift = 0): void {
    const layout = DECK_PANE_LAYOUT.toggle;
    const y = layout.y - lift;
    const state = deckPaneToggleState(this.deckPaneMode, reserveIssueCount);
    this.rightPane.push(
      this.add.text(layout.labelX, y, 'View', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      }).setOrigin(0, 0.5),
    );
    const cards = themedButton(this, layout.cardsX, y, 'Cards', {
      variant: state.cardsSelected ? 'primary' : 'ghost',
      size: 'sm',
      minWidth: layout.minWidth,
      onTap: () => {
        this.deckPaneMode = 'cards';
        this.renderDeck();
      },
    });
    const warchest = themedButton(this, layout.warchestX, y, state.warchestLabel, {
      variant: state.warchestSelected ? 'primary' : state.warchestWarning ? 'danger' : 'ghost',
      size: 'sm',
      minWidth: layout.minWidth,
      onTap: () => {
        this.deckPaneMode = 'warchest';
        this.renderDeck();
      },
    });
    this.rightPane.push(cards.container, warchest.container);
  }

  /** Full-width reserve workspace below the Cards / Warchest toggle. */
  private renderReservePanel(format: BuilderFormat, lift = 0): void {
    const layout = DECK_PANE_LAYOUT;
    const reserve = layout.warchest;
    // The whole workspace rides up by `lift` when the format switch above it
    // is hidden; the backing panel grows so its bottom edge stays pinned.
    const panel = this.add.container(0, -lift);
    const reserveIssues = validateLandReserve(CARD_DB, Services.save.data, this.landReserve);
    panel.add(themedPanel(
      this,
      layout.left,
      layout.content.top,
      layout.right - layout.left,
      layout.content.bottom - layout.content.top + lift,
      { alpha: theme.alpha.panel, radius: theme.radius.control },
    ));
    panel.add(this.add.text(layout.left + 16, reserve.headingY, 'Warchest Reserves', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.label}px`,
      color: theme.colors.heading,
    }).setOrigin(0, 0.5));
    const duals = this.landReserve.filter((id) => CARD_DB[id] && isDualLand(CARD_DB[id])).length;
    panel.add(this.add.text(
      layout.left + 16,
      reserve.countY,
      this.landReserve.length + '/' + LAND_RESERVE_SIZE + ' lands · ' + duals + '/' + MAX_DUAL_LANDS + ' duals',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: duals > MAX_DUAL_LANDS ? theme.colors.danger : theme.colors.body,
      },
    ).setOrigin(0, 0.5));
    panel.add(this.add.text(layout.left + 16, reserve.validationY, reserveIssues[0]?.message ?? 'Warchest ready.', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      color: reserveIssues.length > 0 ? theme.colors.danger : theme.colors.success,
      wordWrap: { width: reserve.rulesWidth },
    }).setOrigin(0, 0));
    for (let i = 0; i < LAND_RESERVE_SIZE; i++) {
      const position = warchestSlotPosition(i);
      const card = this.landReserve[i] ? CARD_DB[this.landReserve[i]] : undefined;
      const name = card ? card.name : 'Choose land';
      const button = themedButton(this, position.x, position.y, warchestSlotLabel(i, name), {
        variant: card ? 'ghost' : 'emphasis',
        size: 'sm',
        minWidth: reserve.slotWidth,
        onTap: () => this.showReserveLandPicker(i),
      });
      this.fitTextToWidth(button.label, reserve.slotLabelWidth);
      panel.add(button.container);
    }
    panel.add(this.add.text(layout.left + 12, reserve.rulesTop, formatRulesCopy(format) ?? '', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      color: theme.colors.body,
      wordWrap: { width: reserve.rulesWidth },
      lineSpacing: 2,
    }).setOrigin(0, 0));
    this.rightPane.push(panel);
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
    this.syncDraftToActiveDeck();
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
      // Dirty tracking follows the deck actually being edited, which is the
      // working deck rather than the saved active id (they diverge when a
      // hidden reserve deck is still the save's active deck).
      const previousId = this.workingDeckId;
      this.workingDeckId = id;
      save.activeDeckId = id;
      const activeDeck = save.decks.find((d) => d.id === id);
      const slots = activeDeck ? cloneDeckSlots(activeDeck.cards, activeDeck.variantPins) : cloneDeckSlots([]);
      this.deck = slots.cards;
      this.variantPins = slots.variantPins;
      this.landReserve = activeDeck?.landReserve ? [...activeDeck.landReserve] : [];
      this.deckPaneMode = defaultDeckPaneMode();
      if (id !== previousId) this.savedDeckSnapshot = this.snapshotSavedDeck(activeDeck);
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
      const isActive = deck.id === this.workingDeckId;
      const deckFormat = deck.format === 'darlings' || deck.format === 'warchest' ? deck.format : 'constructed';
      const repair = deckHealth(CARD_DB, save, deck);
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
      parent.add(
        this.add
          .text(left + 18, top + 47, repair.blocked ? `${formatLabel(deckFormat)} · Needs repair` : formatLabel(deckFormat), {
            fontFamily: theme.fonts.ui,
            fontSize: theme.type.micro + 'px',
            fontStyle: theme.weight.w700,
            color: repair.blocked ? theme.colors.danger : isActive ? theme.colors.gold : theme.colors.muted,
          })
          .setOrigin(0, 0.5),
      );
      this.addDeckColorPips(parent, rightGuideX, top + 22, deck.cards);

      const hero = this.deckPickerHero(deck);
      this.addDeckHeroPortrait(parent, left + 91, top + 134, hero, 142, 184);
      parent.add(
        this.add
          .text(rightGuideX, top + 62, deck.cards.length + '/' + formatDeckSize(deckFormat), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            fontStyle: '700',
            color: repair.blocked ? theme.colors.danger : deck.cards.length === formatDeckSize(deckFormat) ? theme.colors.success : theme.colors.danger,
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
         const index = visibleSavedDecks(save.decks, this.reserveFormatsEnabled).findIndex((d) => d.id === id);
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
          if (deck.id === this.workingDeckId) this.renderDeck();
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
          const activeDeck = activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled);
          this.workingDeckId = activeDeck?.id ?? null;
          const slots = activeDeck ? cloneDeckSlots(activeDeck.cards, activeDeck.variantPins) : cloneDeckSlots([]);
          this.deck = slots.cards;
          this.variantPins = slots.variantPins;
          this.landReserve = activeDeck?.landReserve ? [...activeDeck.landReserve] : [];
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
      const create = (format: BuilderFormat): void => {
        const id = generateDeckId(save);
        const index = visibleSavedDecks(save.decks, this.reserveFormatsEnabled).length;
        saveDeck(save, {
          id,
          name: `Deck ${save.decks.length + 1}`,
          cards: [],
          format,
          darlingId: null,
          landReserve: format === 'constructed' ? null : [],
        });
        pickerPage = Math.floor(index / pageSize);
        setActiveDeck(id);
        closeOverlay();
      };
      const chooseFormat = (): void => this.showNewDeckFormatPrompt(create);
      const bg = this.add
        .rectangle(x, y, tileW, tileH, theme.graphics.panelFill, theme.alpha.panel)
        .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, chooseFormat);
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
        onTap: chooseFormat,
      });
      parent.add(btn.container);
    };

    renderGrid = (): void => {
      gridLayer.removeAll(true);
      const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
      const tiles: Array<{ kind: 'deck'; deck: SavedDeck } | { kind: 'new' }> = [
        ...decks.map((deck) => ({ kind: 'deck' as const, deck })),
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

  private showNewDeckFormatPrompt(onChoose: (format: BuilderFormat) => void): void {
    const formats = offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired);
    const shell = modalShell(this, {
      width: 520,
      height: 340,
      dimAlpha: 0.72,
      depth: theme.depth.inspect,
      tapDimToClose: false,
      escToClose: true,
    });
    const overlay = shell.container;
    const titleTrack = shell.tracks.titleTrack;
    overlay.add(
      this.add.text(
        titleTrack.x + titleTrack.width / 2,
        titleTrack.y + titleTrack.height / 2,
        'Choose a format',
        {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        },
      ).setOrigin(0.5),
    );

    const content = shell.contentBounds;
    const pitch = 56;
    const firstY = content.y + content.height / 2 - ((formats.length - 1) * pitch) / 2;
    formats.forEach((format, index) => {
      const button = themedButton(
        this,
        content.x + content.width / 2,
        firstY + index * pitch,
        formatLabel(format),
        {
          variant: 'emphasis',
          minWidth: 360,
          onTap: () => {
            shell.close();
            onChoose(format);
          },
        },
      );
      overlay.add(button.container);
    });

    const footer = shell.tracks.footerTrack;
    const cancel = themedButton(
      this,
      footer.x + footer.width / 2,
      footer.y + footer.height / 2,
      'Cancel',
      { variant: 'ghost', minWidth: 120, onTap: shell.close },
    );
    overlay.add(cancel.container);
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
    if (deck.format === 'darlings') {
      const darling = darlingFaceCardFor(deck, CARD_DB);
      if (darling) return { name: def(CARD_DB, darling).name, cardId: darling };
    }
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

    if (hero.cardId && CARD_DB[hero.cardId]) {
      const thumb = makeCardThumb(
        this,
        x,
        y,
        CARD_DB[hero.cardId],
        Math.min(artW / 300, artH / 420),
        undefined,
        this.ownedVariantFor(hero.cardId),
      );
      parent.add(thumb);
      parent.add(this.add.rectangle(x, y, width, height, theme.graphics.dim, 0).setStrokeStyle(1, colorInt(theme.colors.gold), theme.alpha.ghost));
      return;
    }

    let img: Phaser.GameObjects.Image | null = null;
    try {
      if (hero.textureKey && this.textures.exists(hero.textureKey)) {
        img = this.add.image(x, y, hero.textureKey);
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

    const baseY = DECK_PANE_LAYOUT.summary.barBaseY; // bar baseline (bars grow upward)
    const curveLayout = DECK_PANE_LAYOUT.curve;
    const maxCount = Math.max(1, ...s.curve);
    s.curve.forEach((count, mv) => {
      const bx = curveLayout.firstX + mv * curveLayout.pitch;
      const h = count > 0
        ? Math.max(3, Math.round((count / maxCount) * DECK_PANE_LAYOUT.summary.barMaxHeight))
        : 2;
      push(this.add.rectangle(bx, baseY, curveLayout.barWidth, h, count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1));
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

    // One merged summary line (counts + pips): the old second line is what
    // used to collide with the status band below (isolation pass 2026-08-18).
    const other = s.nonlands - s.typeCounts.creature;
    const pips = PIE_COLORS.filter((c) => s.colorPips[c] > 0)
      .map((c) => `${c}·${s.colorPips[c]}`)
      .join(' ');
    push(
      this.add
        .text(
          x0,
          DECK_PANE_LAYOUT.summary.summaryLineY,
          `${s.typeCounts.creature} creatures · ${s.lands} lands · ${other} other   ${pips || 'colorless'}`,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
          },
        )
        .setOrigin(0, 0.5),
    );
  }

  private removeCardAt(index: number, pointer: Phaser.Input.Pointer): void {
    const id = this.deck[index];
    if (!id) return;
    if (this.shiftHeld(pointer)) {
      this.removeAllCopies(id);
      return;
    }
    const next = removeDeckSlot({ cards: this.deck, variantPins: this.variantPins }, index);
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    const active = this.activeSavedDeck();
    if (active?.heroCardId === id && !this.deck.includes(id)) active.heroCardId = null;
    this.deckCodeMessage = '';
    this.renderPool();
    this.renderDeck();
  }

  private renderDeckRows(x0: number, heroId: string | null, listY0: number, maxRows?: number): void {
    const entries = collapseDeckRows(this.deck, this.variantPins)
      .filter(({ cardId }) => !CARD_DB[cardId] || !isBasic(CARD_DB, cardId))
      .sort((a, b) => {
        const da = CARD_DB[a.cardId];
        const dbb = CARD_DB[b.cardId];
        if (!da || !dbb) return a.firstIndex - b.firstIndex;
        return (
          Number(isType(dbb, 'land')) - Number(isType(da, 'land')) ||
          manaValue(da.cost) - manaValue(dbb.cost) ||
          da.name.localeCompare(dbb.name) ||
          a.firstIndex - b.firstIndex
        );
      });
    const preferredRows = maxRows ?? (this.touch ? TOUCH_DECK_ROWS : DESKTOP_DECK_ROWS);
    const rowPitch = this.touch ? TOUCH_DECK_PITCH : DESKTOP_DECK_PITCH;
    const rowHeight = theme.type.caption + 4;
    const rowsThatFit = (bottom: number): number => Math.max(
      1,
      Math.floor((bottom - rowHeight - listY0) / rowPitch) + 1,
    );
    // Short pages can use the whole card-row track. Longer lists reserve the
    // pager's 44px hit band, shrinking only this already-paged region.
    const rowsWithoutPager = Math.min(preferredRows, rowsThatFit(DECK_ROW_TRACK_BOTTOM));
    const rows = entries.length > rowsWithoutPager
      ? Math.min(preferredRows, rowsThatFit(DECK_PAGER_Y - theme.control.minHitHeight / 2 - 8))
      : rowsWithoutPager;
    const pages = formatPageCount(entries.length, rows);
    this.deckPage = Phaser.Math.Clamp(this.deckPage, 0, pages - 1);
    formatPageSlice(entries, this.deckPage, rows).forEach((entry, i) => {
      const d = CARD_DB[entry.cardId];
      // All row elements center on one line (design-system alignment rule:
      // icons align to the optical center of the adjacent text).
      const cy = listY0 + i * rowPitch + Math.round(rowPitch / 2) - 7;
      const star = this.add
        .text(x0, cy, d ? heroId === entry.cardId ? '★' : '☆' : '!', {
          fontFamily: theme.fonts.ui,
          fontSize: DECK_PANE_LAYOUT.cards.starSize + 'px',
          fontStyle: '700',
          color: d ? heroId === entry.cardId ? theme.colors.goldHover : theme.colors.muted : theme.colors.danger,
        })
        .setOrigin(0, 0.5);
      if (d) {
        star.setInteractive({ useHandCursor: true });
        bindTapButton(this, star, () => this.toggleDeckHero(entry.cardId));
        // 44 wide so a near-miss lands on the star (hero toggle), never on
        // the remove row behind it (owner finding 2026-08-18).
        inflateHitArea(star, 44, this.touch ? TOUCH_DECK_PITCH : DESKTOP_DECK_PITCH);
      }
      const hasPinnedDisplay = d && this.hasPinnedDisplay(entry.cardId, entry.hasLegacyVariantPin);
      const marker = this.add
        .text(x0 + (this.touch ? 27 : 24), cy, hasPinnedDisplay ? '📌' : '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${DECK_PANE_LAYOUT.cards.pinSize}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0.5);
      const variant = d ? this.ownedVariantFor(entry.cardId) : undefined;
      const cardsLayout = DECK_PANE_LAYOUT.cards;
      // Names carry no mana-value suffix (owner, 2026-08-18): the curve chart
      // owns costs, and the column stays clear of the right-aligned count.
      const row = this.add.text(
        this.touch ? x0 + 44 : cardsLayout.nameX,
        cy,
        d ? d.name : `Unavailable card: ${entry.cardId}`,
        {
        fontFamily: theme.fonts.ui,
        fontSize: theme.type.caption + 'px',
        color: d ? theme.colors.body : theme.colors.danger,
        },
      ).setOrigin(0, 0.5);
      if (!this.touch) this.fitTextToWidth(row, cardsLayout.nameWidth);
      // The remove hit area grows RIGHTWARD from the name's left edge: a
      // centered inflation on a short name would spread back over the star
      // and pin columns, which is exactly how cards were removed by accident
      // (owner finding 2026-08-18).
      const rowHitBias = Math.max(0, cardsLayout.nameWidth - row.displayWidth) / 2;
      const quantity = entry.quantity > 1
        ? this.add
          .text(this.touch ? x0 + 210 : cardsLayout.countRightX, cy, `×${entry.quantity}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            fontStyle: theme.weight.w700,
            color: theme.colors.gold,
            backgroundColor: theme.colors.panelFill,
            padding: { x: 5, y: 1 },
          })
          .setOrigin(this.touch ? 0 : 1, 0.5)
        : null;
      if (!this.touch) {
        row.setInteractive({ useHandCursor: true });
        inflateHitArea(row, cardsLayout.nameWidth, DESKTOP_DECK_PITCH, { biasX: rowHitBias });
        if (d) this.zoom.attach(row, d, variant);
        row.on('pointerover', () => {
          row.setColor(theme.colors.danger);
          inflateHitArea(row, cardsLayout.nameWidth, DESKTOP_DECK_PITCH, { biasX: rowHitBias });
        });
        row.on('pointerout', () => {
          row.setColor(d ? theme.colors.body : theme.colors.danger);
          inflateHitArea(row, cardsLayout.nameWidth, DESKTOP_DECK_PITCH, { biasX: rowHitBias });
        });
        bindTapButton(this, row, (p) => this.removeCardAt(entry.firstIndex, p));
      }
      this.rightPane.push(star, marker, row);
      if (quantity) this.rightPane.push(quantity);
      if (this.touch) {
        const minus = themedButton(this, PANEL_RIGHT_X - 45, cy + 1, '−', {
          variant: 'danger',
          size: 'sm',
          minWidth: 90,
          onTap: (p) => this.removeCardAt(entry.firstIndex, p),
        });
        this.rightPane.push(minus.container);
      }
    });
    if (pages > 1) this.renderDeckPagers(x0, pages);
  }

  private renderRepairBanner(x0: number, blocking: ReturnType<typeof validateDeck>): void {
    const first = blocking[0];
    if (!first) return;
    const background = themedPanel(this, x0 - 8, 514, 368, 116, {
      alpha: 0.92,
      radius: theme.radius.control,
    });
    const message = this.add.text(x0 + 8, 530, `This deck needs repair: ${first.message}`, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      fontStyle: theme.weight.w600,
      color: theme.colors.danger,
      wordWrap: { width: 336 },
    });
    const count = this.add.text(
      x0 + 8,
      606,
      `${blocking.length} blocking ${blocking.length === 1 ? 'issue' : 'issues'}`,
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.muted,
      },
    );
    this.rightPane.push(background, message, count);
  }

  private renderDeck(): void {
    for (const c of this.rightPane) c.destroy();
    this.rightPane = [];
    const width = 1280; // design-space width (see create())
    const x0 = width - 380;

    const active = this.activeSavedDeck();
    const format = this.activeFormat();
    const hasWarchest = format !== 'constructed';
    this.deckPaneMode = resolveDeckPaneMode(this.deckPaneMode, hasWarchest);
    const reserveIssues = hasWarchest
      ? validateLandReserve(CARD_DB, Services.save.data, this.landReserve)
      : [];
    const issues = this.currentIssues();
    const blocking = issues.filter((issue) => issue.kind === 'error');
    const repairingSavedDeck = active !== null && blocking.length > 0;
    const deckTitleX = format === 'darlings' && active?.darlingId ? x0 + 46 : x0;
    const title = this.add
      .text(deckTitleX, 32, (active?.name ?? 'Custom Deck') + ' · ' + this.deck.length + '/' + formatDeckSize(format), {
        fontFamily: theme.fonts.display,
        fontSize: theme.type.h2 + 'px',
        color: this.deck.length === formatDeckSize(format) ? theme.colors.success : theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    this.fitTextToWidth(title, this.touch ? 130 : format === 'constructed' ? 250 : 190);
    this.rightPane.push(title);
    if (format === 'darlings' && active?.darlingId && CARD_DB[active.darlingId]) {
      const portrait = makeCardThumb(
        this,
        x0 + 20,
        32,
        CARD_DB[active.darlingId],
        0.09,
        undefined,
        this.ownedVariantFor(active.darlingId),
      );
      this.rightPane.push(portrait);
      const darlingSlot = this.add
        .text(x0 + 46, 62, 'Darling', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, darlingSlot, () => this.openDarlingsFormat());
      inflateHitArea(darlingSlot, 74, 34);
      this.rightPane.push(darlingSlot);
    }
    const formatSwitchVisible = this.reserveFormatsEnabled &&
      visibleBuilderFormatTabs(
        offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired),
      ).length >= 2;
    if (formatSwitchVisible) this.renderFormatSwitch(x0, format);
    const paneLift = hasWarchest ? deckPaneOffsetY(formatSwitchVisible) : 0;
    if (hasWarchest) this.renderDeckPaneToggle(reserveIssues.length, paneLift);
    if (format === 'constructed' && this.touch) {
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

    let deckListY0 = this.touch ? 270 : DESKTOP_DECK_Y0;
    if (hasWarchest) {
      deckListY0 = DECK_PANE_LAYOUT.content.top + 8 - paneLift;
      if (this.deckPaneMode === 'warchest') this.renderReservePanel(format, paneLift);
    } else {
      // Touch restores the pre-feature five-row block. Desktop keeps the inline
      // preview and selector at a 52px pitch, leaving 8px between 44px targets.
      const basicsPitch = this.touch ? 40 : 52;
      BASIC_LAND_IDS.forEach((id, i) => {
      const d = byId(id);
      // Desktop rows start clear of the format tabs (sm buttons centered at
      // y=64): the row preview thumb tops at y-20, so 102 keeps daylight.
      const y = (this.touch ? 78 : 102) + i * basicsPitch;
      const n = this.countIn(this.deck, id);
      const landStyle = active?.landStyle?.[id] ?? null;
      const row = this.add
        .text(x0, y, `${d.name}: ${n}${this.hasPinnedDisplay(id) ? '  📌' : ''}`, {
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
          const next = appendDeckSlot({ cards: this.deck, variantPins: this.variantPins }, id);
          this.deck = next.cards;
          this.variantPins = next.variantPins;
          this.renderDeck();
        },
      });
      this.rightPane.push(row);
      if (!this.touch) {
        const preview = makeCardThumb(this, x0 + 94, y, d, 0.095, landStyle ?? undefined, this.ownedVariantFor(d.id));
        const style = this.landStyleControl(x0 + 132, y, id, landStyle);
        this.rightPane.push(preview, style);
      }
      this.rightPane.push(minus.container, plus.container);
      });
    }

    if (this.deckPaneMode === 'cards') {
      const heroId = this.deckHeroId();
      // The reserve-format pane starts its rows near the top (no basics
      // block), so geometry, not the constructed six-row cap, decides how
      // many rows a page holds (owner finding 2026-08-18: fill the pane
      // before paginating).
      this.renderDeckRows(x0, heroId, deckListY0, hasWarchest ? Number.POSITIVE_INFINITY : undefined);
      if (repairingSavedDeck) this.renderRepairBanner(x0, blocking);
      else this.renderDeckStats(x0);
    }

    // validation + save
    const issueLines = repairingSavedDeck ? [] : issues
      .slice(0, this.deckCodeMessage ? 1 : 2)
      .map((i) => `${i.kind === 'error' ? '✕' : '⚠'} ${i.message}`);
    const statusLines = this.deckCodeMessage ? [this.deckCodeMessage, ...issueLines] : issueLines;
    // The stats block above the status band leaves room for exactly one
    // status line; states without stats (repair, Warchest view) keep two.
    const statsShown = this.deckPaneMode === 'cards' && !repairingSavedDeck;
    this.status.setMaxLines(statsShown ? DECK_PANE_LAYOUT.summary.statusMaxLinesWithStats : 2);
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
        if (!this.saveWorkingDeck()) {
          this.renderDeck();
          return;
        }
        saveBtn.setLabel('Saved ✓');
        this.time.delayedCall(900, () => {
          if (saveBtn.container.active) saveBtn.setLabel('Save Deck');
        });
      },
    });
    this.rightPane.push(exportBtn.container, importBtn.container, saveBtn.container);
  }

  private exportDeckCode(): void {
    const errors = this.currentIssues().filter((issue) => issue.kind === 'error');
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
      issues = this.currentIssues(decoded.cards);
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

    const slots = cloneDeckSlots(decoded.cards);
    this.deck = slots.cards;
    this.variantPins = slots.variantPins;
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
      escToClose: true,
      onClose: () => {
        this.deckCodeOverlay = null;
        this.zoom.setSuppressed(false);
      },
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
