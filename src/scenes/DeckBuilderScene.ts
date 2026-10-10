import Phaser from 'phaser';
import { bakeUiIcon, uiIconSize } from '../ui/uiIcons';
import { IS_DEV } from '../platform/env';
import { fitMenuName } from '../ui/menuText';
import { bindMenuScroll } from '../ui/menuScroll';
import { menuLineHeight, menuNoticeLayout } from '../ui/mainMenuPresentation';
import type { SaveData } from '../meta/SaveManager';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { SET_ICON_PATHS } from '../art/setIcons';
import { isLiveSet } from '../data/liveness';
import { SET_IDS, SET_TITLES } from '../data/setTitles';
import { FEATURES } from '../config/features';
import { RULES } from '../config/rules';
import { CARD_FACE_H } from '../config/cardFaceGeometry';
import { heroById } from '../data/heroes';
import { ALL_CARDS, CARD_DB, byId } from '../data/catalog';
import type { CardDef, CardType, Color, Rarity } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { displayVariantFor, ownedCount } from '../meta/Collection';
import {
  applyFilters,
  collectiblePool,
  defaultFilterState,
  pageNeighbourhood,
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../meta/collectionFilter';
import { decodeDeck, deckCodeErrorMessage, encodeDeck } from '../meta/DeckCode';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import { CLASSIC_RETIRED_ISSUE, deckHealth } from '../meta/deckRepair';
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
import { tapSlopWorldPx } from '../platform/renderScale';
import { makeCardThumb, thumbArtWanted } from '../ui/CardThumbCache';
import { CARD_H } from '../ui/CardView';
import { CardZoomPreview } from '../ui/CardZoomPreview';
import { showDarlingsTutorial } from '../ui/DarlingsTutorial';
import { computeDeckStats, curveBars, deckCountsLine, deckPipCounts, PIE_COLORS } from '../ui/deckStats';
import {
  DECK_PANE_LAYOUT,
  deckListPagerPosition,
  deckPaneTabRow,
  deckPickerLayout,
  deckPaneHeaderLayout,
  deckPaneSummaryLayout,
  deckReserveLayout,
  deckPaneOffsetY,
  deckPickerContentHeight,
  deckPickerScrollTo,
  deckPaneToggleState,
  deckStatusTone,
  defaultDeckPaneMode,
  resolveDeckPaneMode,
  warchestSlotLabel,
  type DeckPaneMode,
  type DeckStatusMessage,
} from '../ui/deckPanePresentation';
import { deckListLayout, deckListProfile } from '../ui/deckListPaging';
import { DECK_POOL_LAYOUT, poolCellPosition } from '../ui/deckPoolLayout';
import { Dropdown, type DropdownOption } from '../ui/Dropdown';
import { gateOnPagedArt, PAGE_ART_HOLD_MS, PagedArt } from '../ui/artGate';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';
import {
  CARD_BACKS,
  DEFAULT_CARD_BACK_ID,
  DEFAULT_PLAYMAT_ID,
  playmatForId,
} from '../meta/cosmetics';
import {
  openCosmeticPicker,
  paintPlaymatSwatch,
  safeCardBackTexture,
} from '../ui/CosmeticPicker';
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel as themedPanel, registerSceneBackNavigation, sceneHasOpenModal, themedButton, type ModalShell, type Pager, type ThemedButton } from '../ui/themeWidgets';
import {
  DARLINGS_RULES_COPY,
  acknowledgeDeckRepairNotice,
  activeVisibleSavedDeck,
  builderFormatForDeck,
  collapseDeckRows,
  deckBaseline,
  deckBlockKind,
  deckBlockLabel,
  deckCodeDeckFor,
  deckSaveCta,
  formatDeckSize,
  formatLabel,
  formatPageCount,
  formatPageSlice,
  formatRulesCopy,
  gridPosition,
  isDeckBuilderDirty,
  newDeckFormat,
  offeredBuilderFormats,
  importedWorkingState,
  planDeckCodeImport,
  restoreDeckBaseline,
  unsavedChangesCopy,
  type BuilderFormat,
  type DeckBaseline,
  type DeckCodeImportTarget,
  type UnsavedChangesPath,
  visibleBuilderFormatTabs,
  visibleSavedDecks,
} from '../ui/deckBuilderHelpers';

const GRID_SIZE = DECK_POOL_LAYOUT.cols * DECK_POOL_LAYOUT.rows;
const DECK_CODE_CARD_IDS = ALL_CARDS.map((card) => card.id);
/**
 * How long an armed deck Delete waits for its second press, as Settings'
 * Reset and the Gauntlet's Abandon do.
 */
const DELETE_ARM_MS = 4000;
const DECK_DELETE_NOTE = 'Its cards stay in your collection.';
/**
 * The right panel's content column. Its fill runs from DECK_PANE_LAYOUT.panelX
 * to the screen edge, and the content sits between the pane's left edge and
 * PANEL_RIGHT_X, the title-safe frame's right edge (deckPanePresentation.ts).
 */
const PANEL_LEFT_X = DECK_PANE_LAYOUT.left;
const PANEL_RIGHT_X = DECK_PANE_LAYOUT.right;
/**
 * The pool header's search and Filters controls end one group gap short of the
 * deck panel's fill, so the Filters button never straddles the panel edge.
 */
const FILTER_BUTTON_WIDTH = 96;
const FILTER_BUTTON_X = DECK_PANE_LAYOUT.panelX - theme.space(4) - FILTER_BUTTON_WIDTH / 2;
const POOL_SEARCH_WIDTH = 240;
const POOL_SEARCH_X = FILTER_BUTTON_X - FILTER_BUTTON_WIDTH / 2 - theme.space(3) - POOL_SEARCH_WIDTH / 2;
/** The pool-filter popover opens on the title-safe frame's left edge. */
const FILTER_PANEL = { x: theme.design.safeLeft, y: 82, width: 300, height: 554, inset: 24 } as const;
const DECK_NAME_MAX_LENGTH = 24;
/** The Darling chooser: three cards a page at a readable size, each inspectable on hover (UI review finding 26). */
const DARLING_PICKER = { width: 1040, rulesWidth: 920, cardScale: 0.5, pitch: 300, nameWidth: 260 } as const;

export interface DeckBuilderSceneData {
  deckId?: string;
  /** Read-only dev fixture clone; never installed in Services. */
  a11yFixture?: { save: SaveData; mode?: DeckPaneMode; page?: number; touch?: boolean; focusCardId?: string; pickerRow?: number;
    modal?: 'decks' | 'darling' | 'reserve' | 'landStyles' | 'repair' | 'rename' | 'format' | 'export' | 'import' | 'unsaved' | 'filters';
    filter?: 'set' | 'color' | 'type' | 'rarity' | 'sort' };
}

interface DeckHeroDisplay {
  name: string;
  cardId: string | null;
  textureKey?: string;
}

/**
 * Edit the active deck: paged owned-card pool left, deck list + basics right.
 *
 * The deck list has two profiles (mobile-lan-plan §1.4). Desktop keeps the
 * dense 28px rows where the row itself is tap-to-remove. On touch devices the
 * audited hazard — 1.6mm-tall rows where every tap is a DESTRUCTIVE remove —
 * is replaced wholesale: bigger row pitch, removal only via an explicit
 * per-row − button (90px hit box), and page controls instead of the y>560
 * hard clip. Basics rows also widen their pitch slightly on touch so the ±
 * steppers can carry pitch-filling hit boxes.
 */
export class DeckBuilderScene extends Phaser.Scene {
  private fixtureSave: SaveData | null = null;
  private fixtureFocusCardId: string | null = null;
  private fixturePickerRow = 0;
  private get save(): SaveData { return this.fixtureSave ?? Services.save.data; }
  private flush(): void { if (!this.fixtureSave) Services.save.flush(); }
  private deck: string[] = [];
  private variantPins: Array<string | null> = [];
  private page = 0;
  private deckPage = 0;
  private touch = false;
  private cells: Phaser.GameObjects.GameObject[] = [];
  private rightPane: Phaser.GameObjects.GameObject[] = [];
  /** The pool grid's art requests: the page on show and the pages either side of it. */
  private poolArt: PagedArt | null = null;
  /** The deck pane's art requests: its thumbnails, and the open deck-list page for the hover zoom. */
  private paneArt: PagedArt | null = null;
  /** Art the deck pane's thumbnails still need, gathered while `renderDeck` draws them. */
  private paneThumbArt: string[] = [];
  /** The cards on the open deck-list page, gathered by `renderDeckRows`. */
  private paneRowCards: string[] = [];
  private poolPager!: Pager;
  private status!: Phaser.GameObjects.Text;
  private statusScroll: Phaser.GameObjects.Container | null = null;
  private headerLayout = deckPaneHeaderLayout();
  private summaryLayout = deckPaneSummaryLayout();
  private zoom!: CardZoomPreview;
  private deckCodeOverlay: Phaser.GameObjects.Container | null = null;
  private searchInput: Phaser.GameObjects.DOMElement | null = null;
  private filterButton!: ThemedButton;
  private filterPanel: Phaser.GameObjects.Container | null = null;
  private filterDropdowns: Dropdown<string>[] = [];
  private filterDropdownRefreshers: Array<() => void> = [];
  /** Collection-style facets over the owned-card pool. */
  private filterState: CollectionFilterState = { ...defaultFilterState(), ownedOnly: true };
  /** One-off status message above the deck issues; cleared by every deck edit. */
  private statusMessage: DeckStatusMessage | null = null;
  private landReserve: string[] = [];
  private deckPaneMode: DeckPaneMode = defaultDeckPaneMode();
  /** The card-back / playmat chooser, so a re-render or shutdown can close it. */
  private styleShell: ModalShell | null = null;
  /** Captured at create() so a local dev flip applies when a scene is reopened. */
  private reserveFormatsEnabled = false;
  private classicRetired = false;
  /** UI working deck. A hidden active deck remains untouched in the save. */
  private workingDeckId: string | null = null;
  private savedDeckSnapshot: DeckBaseline | null = null;
  /**
   * The working deck's format and Darling. They are saved on the deck record,
   * but the builder edits them here, beside the list and the Warchest, so an
   * unsaved change to them (a deck code import) never sits on the shared save
   * record where any flush (a tab switch, a land style) would write it.
   * Only Save Deck, a format switch and a Darling pick, each of which saves the
   * record whole, write them there.
   */
  private workingFormat: SavedDeck['format'] = undefined;
  private workingDarlingId: string | null = null;
  private unsavedPrompt: ModalShell | null = null;

  constructor() {
    super('DeckBuilder');
  }

  /** Collection-context previews use the player's shared display treatment. */
  private ownedVariantFor(cardId: string): CardVariant | undefined {
    const save = this.save;
    if (ownedCount(save, cardId) <= 0) return undefined;
    const variant = displayVariantFor(save, cardId);
    return variantKey(variant) === variantKey(PLAIN_VARIANT) ? undefined : variant;
  }

  /** A collection pin or retained legacy slot pin keeps a collapsed row legible. */
  private hasPinnedDisplay(cardId: string, hasLegacyVariantPin = false): boolean {
    return hasLegacyVariantPin || typeof this.save.pinnedVariants[cardId] === 'string';
  }

  /**
   * The pool pane browses the whole set. While art streams through the store
   * the builder builds at once and asks for art page by page; with the 1.8
   * queue it waits for the whole set, as it always did.
   */
  create(data: DeckBuilderSceneData = {}): void {
    this.sys.settings.data = {};
    this.data.set('a11yReady', false);
    this.fixturePickerRow = IS_DEV ? data.a11yFixture?.pickerRow ?? 0 : 0;
    this.fixtureFocusCardId = IS_DEV ? data.a11yFixture?.focusCardId ?? null : null;
    this.fixtureSave = IS_DEV && data.a11yFixture ? structuredClone(data.a11yFixture.save) : null;
    gateOnPagedArt(this, () => this.build(data));
  }
  private build(data: DeckBuilderSceneData): void {
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    this.classicRetired = FEATURES.classicRetired;
    this.workingDeckId = null;
    this.savedDeckSnapshot = null;
    this.page = 0;
    this.deckPage = 0;
    this.poolArt = new PagedArt(this, 'deck-pool');
    this.paneArt = new PagedArt(this, 'deck-pane');
    this.deckPaneMode = defaultDeckPaneMode();
    this.filterState = { ...defaultFilterState(), ownedOnly: true };
    this.statusMessage = null;
    this.touch = IS_DEV && data.a11yFixture?.touch !== undefined ? data.a11yFixture.touch : isTouchDevice();
    this.cells = [];
    this.rightPane = [];
    this.deckCodeOverlay = null;
    this.searchInput = null;
    this.filterPanel = null;
    this.filterDropdowns = [];
    this.filterDropdownRefreshers = [];
    this.unsavedPrompt = null;

    const save = this.save;
    const requested = typeof data.deckId === 'string'
      ? save.decks.find((deck) => deck.id === data.deckId) ?? null
      : null;
    this.loadWorkingDeck(requested ?? activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled));

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
    themedPanel(this, DECK_PANE_LAYOUT.panelX, 0, width - DECK_PANE_LAYOUT.panelX, height, { alpha: theme.alpha.chrome, radius: 0 });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed

    // The pool header shares the back button's line (deckPoolLayout.ts), so
    // the title, search and Filters all sit inside the title-safe frame.
    const poolHeaderY = DECK_POOL_LAYOUT.headerY;
    this.add
      .text(DECK_POOL_LAYOUT.titleX, poolHeaderY, 'Decks', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    // Card search (F8): part of the same Collection-style filter state as the panel facets.
    this.searchInput = createSearchInput(this, POOL_SEARCH_X, poolHeaderY, {
      width: POOL_SEARCH_WIDTH,
      placeholder: 'Search your pool…',
      onChange: (value) => {
        this.filterState.search = value;
        this.applyPoolFilterChange();
      },
    });

    const filter = themedButton(this, FILTER_BUTTON_X, poolHeaderY, 'Filters', {
      variant: 'ghost',
      size: 'sm',
      minWidth: FILTER_BUTTON_WIDTH,
      onTap: () => this.toggleFilterPanel(),
    });
    this.filterButton = filter;

    backButton(this, 'Menu', () => this.leaveDeckBuilder());
    registerSceneBackNavigation(this, () => this.leaveDeckBuilder());

    // Pool pager on the shared footer line, below the grid's last row
    // (deckPoolLayout.ts). It sat at y 688, past the title-safe frame, until
    // 1.8.1.
    this.poolPager = pager(this, DECK_POOL_LAYOUT.pagerX, DECK_POOL_LAYOUT.pagerY, this.page, 1, (page) => {
      this.page = page;
      this.renderPool(PAGE_ART_HOLD_MS);
    });
    this.poolPager.container.setVisible(false);

    // Wheel + arrow-key pagination (owner request 2026-08-18). Scene-level
    // wheel and keyboard bypass ModalGuard (playbook trap), so both self-gate
    // on open shells, the filter panel, and focused DOM inputs (search,
    // rename). The wheel pages the surface under the pointer: pool grid on
    // the left, the Cards view's deck rows on the right. Arrows page the pool.
    const pagingBlocked = (): boolean => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true;
      return sceneHasOpenModal(this) || this.filterPanel !== null;
    };
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      // Horizontal trackpad pans emit dy === 0 — never read those as paging.
      if (dy === 0 || pagingBlocked()) return;
      const dir = dy > 0 ? 1 : -1;
      if (p.x >= DECK_PANE_LAYOUT.left) {
        if (this.deckPaneMode !== 'cards' || p.worldY >= this.summaryLayout.pagerY - theme.control.minHitHeight / 2) return;
        this.deckPage += dir; // renderDeckRows clamps to the real page count
        this.renderDeck();
        return;
      }
      this.turnPage(dir);
    });
    const onPagePrevious = (): void => {
      if (!pagingBlocked()) this.turnPage(-1);
    };
    const onPageNext = (): void => {
      if (!pagingBlocked()) this.turnPage(1);
    };
    this.input.keyboard?.on('keydown-LEFT', onPagePrevious);
    this.input.keyboard?.on('keydown-RIGHT', onPageNext);
    this.input.keyboard?.on('keydown-UP', onPagePrevious);
    this.input.keyboard?.on('keydown-DOWN', onPageNext);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-LEFT', onPagePrevious);
      this.input.keyboard?.off('keydown-RIGHT', onPageNext);
      this.input.keyboard?.off('keydown-UP', onPagePrevious);
      this.input.keyboard?.off('keydown-DOWN', onPageNext);
    });

    this.status = this.add
      .text(PANEL_LEFT_X, DECK_PANE_LAYOUT.summary.statusBottomY, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.danger,
        wordWrap: { width: 360 },
      })
      .setOrigin(0, 0);

    this.zoom = new CardZoomPreview(this, {
      scale: 1.12,
      depth: 115,
      delayMs: 250,
      dockY: 360,
      leftX: 210,
      rightX: 690,
    });

    if (IS_DEV && data.a11yFixture) {
      this.deckPaneMode = data.a11yFixture.mode ?? 'cards';
      this.deckPage = data.a11yFixture.page ?? 0;
    }
    this.renderPool();
    this.renderDeck();
    this.syncFilterButton();
    if (this.activeFormat() === 'darlings' && !this.fixtureSave) {
      showDarlingsTutorial(this, {
        onReadMore: () => this.scene.start('Glossary', {
          focus: 'Darlings',
          returnTo: { scene: 'DeckBuilder', data: { deckId: this.activeSavedDeck()?.id } },
        }),
      });
    }
    if (IS_DEV && data.a11yFixture) {
      switch (data.a11yFixture.modal) {
        case 'decks': this.openDeckPicker(); break;
        case 'darling': this.showDarlingPicker(); break;
        case 'reserve': this.showReserveLandPicker(0); break;
        case 'landStyles': this.showLandStylesModal(); break;
        case 'repair': this.showRepairModal(this.currentIssues().filter((i) => i.kind === 'error')); break;
        case 'rename': if (this.workingDeckId) this.promptRename(this.workingDeckId); break;
        case 'format': this.showNewDeckFormatPrompt(() => {}); break;
        case 'export': this.exportDeckCode(); break;
        case 'import': this.showDeckCodeOverlay('import'); break;
        case 'unsaved': this.deck.push(BASIC_LAND_IDS[0]); this.confirmUnsavedChanges('leave', () => {}); break;
        case 'filters':
          this.openFilterPanel();
          if (data.a11yFixture.filter) this.filterDropdowns[['set','color','type','rarity','sort'].indexOf(data.a11yFixture.filter)]?.open();
          break;
      }
    }
    this.data.set('a11yReady', true);
  }

  private activeFormat(): BuilderFormat {
    // With no saved deck (every deck deleted) the draft is a new deck, so it
    // sits in the format New Deck would give it, never a retired one.
    return this.activeSavedDeck()
      ? builderFormatForDeck({ format: this.workingFormat }, this.reserveFormatsEnabled)
      : newDeckFormat(this.reserveFormatsEnabled, this.classicRetired);
  }

  /** The working deck's Darling, while it is a Darlings deck. */
  private activeDarlingId(): string | null {
    return this.activeFormat() === 'darlings' ? this.workingDarlingId : null;
  }

  private isReserveFormat(): boolean {
    return this.activeFormat() !== 'constructed';
  }

  private copyLimit(): number {
    return this.activeFormat() === 'darlings' ? 1 : RULES.maxCopies;
  }

  private currentIssues(cards: readonly string[] = this.deck): ReturnType<typeof validateDeck> {
    return this.issuesFor(this.openDeckTarget(), cards);
  }

  /** The open deck's format, Darling and Warchest: what a deck code carries besides its list. */
  private openDeckTarget(): DeckCodeImportTarget {
    return {
      format: this.activeFormat(),
      darlingId: this.activeDarlingId(),
      landReserve: this.landReserve,
    };
  }

  private issuesFor(target: DeckCodeImportTarget, cards: readonly string[]): ReturnType<typeof validateDeck> {
    const { format, darlingId, landReserve } = target;
    if (format === 'darlings') {
      return validateDarlingsDeck(CARD_DB, this.save, cards, darlingId, landReserve);
    }
    if (format === 'warchest') {
      return validateWarchestDeck(CARD_DB, this.save, cards, landReserve);
    }
    // A classic deck opened after retirement is blocked by its FORMAT, not by
    // its card count. Reporting the 60-card check first told the player to add
    // cards to a deck that no duel can seat either way, and never named the
    // conversion that actually unblocks it (user report 2026-08-24). deckHealth
    // is the authority on that; lead with its sentence and keep the ordinary
    // legality issues behind it so nothing is hidden.
    const issues = validateDeck(CARD_DB, this.save, cards);
    if (this.classicRetired) {
      return [{ kind: 'error', message: CLASSIC_RETIRED_ISSUE }, ...issues];
    }
    return issues;
  }

  private pool(): CardDef[] {
    this.filterState.ownedOnly = true;
    const cards = collectiblePool(ALL_CARDS).filter(
      (card) => !this.isReserveFormat() || !card.types.includes('land'),
    );
    return applyFilters(cards, this.filterState, this.save);
  }

  private turnPage(dir: number): void {
    const pages = Math.max(1, Math.ceil(this.pool().length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page + dir, 0, pages - 1);
    this.renderPool(PAGE_ART_HOLD_MS);
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

    const f = FILTER_PANEL;
    panel.setData('a11ySurface', f);
    const bg = themedPanel(this, f.x, f.y, f.width, f.height, { alpha: 0.98, strokeAlpha: theme.alpha.chrome });
    // A Graphics has no hit area, so `bg.setInteractive()` swallowed nothing:
    // a tap on the panel's empty space fell through and added the pool card
    // underneath, unseen (hover zoom is off while the panel is open). This
    // zone covers the whole footprint; the panel's controls sit above it.
    const inputBlocker = this.add.zone(f.x + f.width / 2, f.y + f.height / 2, f.width, f.height).setInteractive();
    panel.add([bg, inputBlocker]);
    panel.add(
      this.add
        .text(f.x + f.inset, 112, 'Pool Filters', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5),
    );

    const close = themedButton(this, f.x + f.width - 32, 112, '×', {
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
      const dd = new Dropdown<T>(this, f.x + f.inset, y, {
        label,
        options,
        value: get(),
        minW,
        maxValueWidth: 120,
        onSelect: (v) => {
          set(v);
          this.applyPoolFilterChange();
        },
        onOpen: () => this.closeFilterDropdownsExcept(dd as unknown as Dropdown<string>),
      });
      dd.setDepth(81);
      this.filterDropdowns.push(dd as unknown as Dropdown<string>);
      this.filterDropdownRefreshers.push(() => dd.setValue(get()));
    };

    // Derived from SET_IDS (never a hand-written copy — the binder filter
    // silently omitted two releases that way) and liveness-gated so an
    // unreleased set never shows as an empty option.
    const setOpts: DropdownOption<CollectionFilterState['set']>[] = [
      { value: 'all', label: 'All sets' },
      ...SET_IDS.filter(isLiveSet).map((id) => ({ value: id, label: SET_TITLES[id] })),
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

    // A reserve-format pool holds no lands (they live in the Warchest), so a
    // Land facet there could only ever empty the grid.
    const typeOpts: DropdownOption<CardType | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'creature', label: 'Creature' },
      { value: 'charm', label: 'Charm' },
      { value: 'ritual', label: 'Ritual' },
      { value: 'enchantment', label: 'Enchantment' },
      { value: 'artifact', label: 'Artifact' },
      ...(this.isReserveFormat() ? [] : [{ value: 'land' as const, label: 'Land' }]),
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

    const reset = themedButton(this, f.x + f.inset + 132 / 2, 588, 'Reset Filters', {
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
    this.filterButton.setVariant(this.filterPanel ? 'emphasis' : activeCount > 0 ? 'selected' : 'ghost');
  }

  /** The art keys the pool thumbs of `cards` still need before they can bake over real art. */
  private thumbArtFor(cards: readonly CardDef[]): string[] {
    const keys: string[] = [];
    for (const d of cards) {
      const wanted = thumbArtWanted(this, d, undefined, this.ownedVariantFor(d.id));
      if (wanted !== null) keys.push(wanted.key);
    }
    return keys;
  }

  /** A deck-pane thumbnail, noted for the pane's art lease (`paneArt`). */
  private paneThumb(
    x: number,
    y: number,
    card: CardDef,
    cardScale: number,
    landStyle?: string,
    variant?: CardVariant,
  ): Phaser.GameObjects.Image {
    const thumb = makeCardThumb(this, x, y, card, cardScale, landStyle, variant);
    const wanted = thumbArtWanted(this, card, landStyle, variant);
    if (wanted !== null) this.paneThumbArt.push(wanted.key);
    return thumb;
  }

  /**
   * Draw the pool grid. `holdMs` is set only by a page turn: the grid clears at
   * once and the new page waits up to that long for its art before drawing
   * over stand-ins (owner question 3, as the binder does). A deck edit redraws
   * the same page at once.
   */
  private renderPool(holdMs = 0): void {
    for (const c of this.cells) c.destroy();
    this.cells = [];
    // A Land facet chosen on a classic deck cannot survive a switch to a
    // reserve format (the pool drops lands there), so it resets rather than
    // leaving an empty grid behind a lit Filters button.
    if (this.isReserveFormat() && this.filterState.type === 'land') {
      this.filterState.type = 'all';
      for (const refresh of this.filterDropdownRefreshers) refresh();
      this.syncFilterButton();
    }
    const pool = this.pool();
    const pages = Math.max(1, Math.ceil(pool.length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    this.syncPoolPager(pages);
    // The page on show is leased at `visible` and the pages either side are
    // prefetched at `soon` (docs/plan-art-streaming.md section 2). A thumb
    // whose art is still on its way bakes over the stand-in and re-bakes in
    // place when it lands.
    const around = pageNeighbourhood(pool, this.page, GRID_SIZE);
    const page = this.page;
    const draw = (): void => this.drawPoolPage(pool, page);
    if (this.poolArt === null) draw();
    else this.poolArt.show(this.thumbArtFor(around.shown), this.thumbArtFor(around.near), draw, holdMs);
  }

  /** The pool grid's cells for `page` of `pool`. */
  private drawPoolPage(pool: CardDef[], page: number): void {
    const save = this.save;
    if (pool.length === 0) {
      const emptyCopy = this.activePoolFilterCount() > 0 ? 'No owned cards match these filters.' : 'No cards in this set yet.';
      const grid = DECK_POOL_LAYOUT;
      const empty = this.add
        .text(grid.x0 + ((grid.cols - 1) / 2) * grid.pitchX, grid.y0 + ((grid.rows - 1) / 2) * grid.pitchY, emptyCopy, {
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

    const grid = DECK_POOL_LAYOUT;
    pool.slice(page * GRID_SIZE, (page + 1) * GRID_SIZE).forEach((d, i) => {
      const { x, y } = poolCellPosition(i);
      // Cached-thumbnail Image instead of a live CardView — cheap to churn per page.
      const variant = this.ownedVariantFor(d.id);
      const thumb = makeCardThumb(this, x, y, d, grid.cardScale, undefined, variant);
      thumb.setInteractive({ useHandCursor: true });
      this.zoom.attach(thumb, d, variant);
      // Tap-classified on touch so a drag across the grid can't add cards.
      bindTapButton(this, thumb, (p) => this.addCardOrPlayset(d.id, p));
      this.cells.push(thumb);
      const inDeck = this.countIn(this.deck, d.id);
      const badge = this.add
        .text(x + grid.badgeRightX, y + grid.chipTopY, inDeck + '/' + Math.min(this.copyLimit(), ownedCount(save, d.id)), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: '700',
          color: inDeck > 0 ? theme.colors.success : theme.colors.muted,
          backgroundColor: theme.colors.panelFill,
          padding: { x: 6, y: 2 },
        })
        .setOrigin(1, 0);
      this.cells.push(badge);
      // Add-a-playset chip (top-left corner) — one tap fills this card to the
      // cap. Shown only when ≥2 are addable (a single card tap already adds one).
      const addable = Math.min(this.copyLimit(), ownedCount(save, d.id)) - inDeck;
      if (addable > 1) {
        // Drawn as a small button (plate, border, hover) so it reads as the
        // action it is, not as a second count beside the in-deck chip.
        const addAll = this.add
          .text(x + grid.chipLeftX, y + grid.chipTopY, `+${addable}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: '700',
            color: theme.colors.success,
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        const plate = this.add.graphics();
        const drawPlate = (hovered: boolean): void => {
          plate.clear();
          plate.fillStyle(hovered ? theme.graphics.rowFillActive : theme.graphics.panelFill, 1);
          plate.fillRoundedRect(addAll.x, addAll.y, addAll.width, addAll.height, 4);
          plate.lineStyle(theme.control.borderWidth, hovered ? colorInt(theme.colors.goldHover) : colorInt(theme.colors.success), 1);
          plate.strokeRoundedRect(addAll.x, addAll.y, addAll.width, addAll.height, 4);
        };
        drawPlate(false);
        this.children.moveBelow(plate, addAll);
        addAll.on('pointerover', () => drawPlate(true));
        addAll.on('pointerout', () => drawPlate(false));
        bindTapButton(this, addAll, () => this.addPlayset(d.id));
        inflateHitArea(addAll, grid.chipHitWidth, grid.chipHitHeight);
        this.cells.push(plate, addAll);
      }
    });
  }

  private addCard(id: string): void {
    const save = this.save;
    const card = CARD_DB[id];
    if (!card || (this.isReserveFormat() && card.types.includes('land'))) return;
    const inDeck = this.countIn(this.deck, id);
    const ownershipLimit = isBasicLand(card) ? Number.POSITIVE_INFINITY : ownedCount(save, id);
    if (inDeck >= Math.min(this.copyLimit(), ownershipLimit)) return;
    this.statusMessage = null;
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
    const cap = Math.min(this.copyLimit(), ownedCount(this.save, id));
    this.statusMessage = null;
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
    this.statusMessage = null;
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
    this.statusMessage = null;
    this.renderPool();
    this.renderDeck();
  }

  private activeSavedDeck(): SavedDeck | null {
    const save = this.save;
    return save.decks.find((d) => d.id === this.workingDeckId) ?? null;
  }

  /**
   * Point the builder at a deck, or at none. The unsaved-changes baseline
   * follows the deck: reloading the deck already being edited keeps its
   * baseline (the saved record can hold an unsaved hero pick, which only the
   * baseline can undo), and any other deck, including the one a delete falls
   * back to, starts from its own saved record. Every path that changes the
   * working deck comes through here, so the baseline can never belong to a
   * different deck.
   */
  private loadWorkingDeck(deck: SavedDeck | null): void {
    this.workingDeckId = deck?.id ?? null;
    const slots = deck ? cloneDeckSlots(deck.cards, deck.variantPins) : cloneDeckSlots([]);
    this.deck = slots.cards;
    this.variantPins = slots.variantPins;
    this.landReserve = deck?.landReserve ? [...deck.landReserve] : [];
    this.workingFormat = deck?.format;
    this.workingDarlingId = deck?.darlingId ?? null;
    if (this.savedDeckSnapshot?.id !== this.workingDeckId) this.savedDeckSnapshot = deckBaseline(deck);
    this.statusMessage = null;
  }

  private hasUnsavedDeckEdits(): boolean {
    const active = this.activeSavedDeck();
    return isDeckBuilderDirty(
      {
        cards: this.deck,
        variantPins: this.variantPins,
        landReserve: this.landReserve,
        heroCardId: active?.heroCardId ?? null,
        darlingId: this.workingDarlingId,
        format: this.workingFormat,
      },
      this.savedDeckSnapshot,
    );
  }

  /**
   * Write the working deck to its saved record. This always succeeds (owner
   * ruling D10, 2026-09-25): an unfinished deck saves as it stands, and every
   * place that picks or starts a deck judges it for itself (deckHealth), so a
   * saved deck that cannot be played is shown as such and never seated.
   */
  private saveWorkingDeck(): void {
    const save = this.save;
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
      darlingId: format === 'darlings' ? this.workingDarlingId : null,
      landReserve: format === 'constructed' ? null : [...this.landReserve],
      variantPins: [...this.variantPins],
    });
    save.activeDeckId = id;
    this.workingDeckId = id;
    const saved = save.decks.find((d) => d.id === id) ?? null;
    this.workingFormat = saved?.format;
    this.workingDarlingId = saved?.darlingId ?? null;
    this.savedDeckSnapshot = deckBaseline(saved);
    if (saved) this.acknowledgeUnplayableDeck(saved);
    this.flush();
    // The status band's issue line under this says what still stands between
    // the deck and a duel.
    this.statusMessage = this.currentIssues().some((issue) => issue.kind === 'error')
      ? { text: 'Saved. Not playable yet:', tone: 'danger' }
      : null;
  }

  /**
   * Save a deck-level change made straight on the saved record: a format
   * switch or a Darling pick. Both run only once nothing is unsaved (they ask
   * first), so the record is the working deck and the change is saved on the
   * spot; the baseline moves with it.
   */
  private commitSavedRecord(deck: SavedDeck): void {
    this.savedDeckSnapshot = deckBaseline(deck);
    this.acknowledgeUnplayableDeck(deck);
    this.flush();
  }

  /**
   * The Main Menu's deck-repair notice says the rules changed with an update.
   * A deck the builder writes while it cannot be played is one the player is
   * looking at, so the notice leaves it alone; any other flagged deck still
   * gets it, and the menu forgets this one once it can be played.
   */
  private acknowledgeUnplayableDeck(deck: SavedDeck): void {
    const save = this.save;
    if (!deckHealth(CARD_DB, save, deck).blocked) return;
    save.deckRepairNoticeAck = acknowledgeDeckRepairNotice(save.deckRepairNoticeAck, deck.id);
  }

  private leaveDeckBuilder(): void {
    this.confirmUnsavedChanges('leave', () => this.scene.start('MainMenu'));
  }

  /**
   * Run `proceed`, asking first whenever it would drop unsaved work (owner
   * ruling D10): leaving, the Decks menu, a format switch, the Darling pick,
   * a deck code import.
   * Save Deck saves (it always can) and carries on; the discard button puts the
   * deck back to its last save and carries on; Keep Editing does neither.
   */
  private confirmUnsavedChanges(path: UnsavedChangesPath, proceed: () => void): void {
    if (!this.hasUnsavedDeckEdits()) {
      proceed();
      return;
    }
    if (this.unsavedPrompt) return;
    this.closeFilterPanel();
    // The search box is a DOM element above the canvas, so the dim cannot cover it.
    this.setSearchInputVisible(false);
    const copy = unsavedChangesCopy(path, this.currentIssues().some((issue) => issue.kind === 'error'));
    const staying = path !== 'leave';
    const body = this.add.text(0, 0, copy.body, { fontFamily: theme.fonts.ui, fontSize: theme.type.body,
      color: theme.colors.body, align: 'center', wordWrap: { width: 640 }, lineSpacing: theme.space(1) }).setOrigin(0.5);
    const notice = menuNoticeLayout(720, menuLineHeight(theme.type.h1), body.height);
    const shell = modalShell(this, {
      ...notice,
      dimAlpha: 0.82,
      dismissal: 'dismissible',
      onClose: () => {
        if (this.unsavedPrompt === shell) this.unsavedPrompt = null;
        this.setSearchInputVisible(true);
      },
    });
    this.unsavedPrompt = shell;
    const c = shell.container;
    const { titleTrack, contentBounds, footerTrack } = shell.tracks;
    c.add(this.add.text(640, titleTrack.y + titleTrack.height / 2, 'Unsaved changes', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    }).setOrigin(0.5));
    body.setPosition(640, contentBounds.y + contentBounds.height / 2);
    c.add(body);
    // Three buttons (150 + 190 + 150) with 36px gaps span 562px, centred in
    // the 620px shell: 359..921 against panel edges at 330 and 950. The prior
    // 420/640/880 spacing pushed Keep Editing to 955 and off the panel.
    const footerY = footerTrack.y + footerTrack.height / 2;
    const save = themedButton(this, 0, footerY, 'Save Deck', {
      variant: 'primary',
      minWidth: 150,
      onTap: () => {
        shell.close();
        this.saveWorkingDeck();
        if (staying) {
          this.renderPool();
          this.renderDeck();
        }
        proceed();
      },
    });
    const discard = themedButton(this, 0, footerY, copy.discardLabel, {
      variant: 'danger',
      minWidth: 190,
      onTap: () => {
        shell.close();
        restoreDeckBaseline(this.save.decks, this.savedDeckSnapshot, this.workingDeckId);
        this.flush();
        if (staying) {
          // Same deck, so its baseline stays; the working copy returns to it.
          this.loadWorkingDeck(this.activeSavedDeck());
          this.deckPage = 0;
          this.renderPool();
          this.renderDeck();
        }
        proceed();
      },
    });
    const cancel = themedButton(this, 0, footerY, 'Keep Editing', {
      variant: 'ghost',
      minWidth: 150,
      onTap: shell.close,
    });
    const buttons = [save, discard, cancel];
    const widths = buttons.map((button) => button.getMeasuredSize().hit.width);
    let cursor = 640 - (widths.reduce((sum, width) => sum + width, 0) + theme.space(6) * 2) / 2;
    buttons.forEach((button, index) => { button.container.setX(cursor + widths[index] / 2); cursor += widths[index] + theme.space(6); });
    c.add(buttons.map((button) => button.container));
  }

  private deckHeroId(): string | null {
    const active = this.activeSavedDeck();
    if (active && this.activeFormat() === 'darlings') {
      return darlingFaceCardFor({ cards: this.deck, format: 'darlings', darlingId: this.workingDarlingId }, CARD_DB);
    }
    const hero = active?.heroCardId ?? null;
    return hero && CARD_DB[hero] && this.deck.includes(hero) ? hero : null;
  }

  private toggleDeckHero(id: string): void {
    const deck = this.activeSavedDeck();
    if (!deck || this.activeFormat() === 'darlings' || !this.deck.includes(id)) return;
    const next = deck.heroCardId === id ? null : id;
    deck.heroCardId = next;
    this.statusMessage = {
      text: next ? `Hero Image: ${def(CARD_DB, id).name}` : 'Hero image cleared.',
      tone: 'success',
    };
    this.flush();
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
    this.flush();
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
      ...menuNoticeLayout(620, menuLineHeight(theme.type.h2), BASIC_LAND_IDS.length * (theme.control.minHitHeight + theme.space(4)) - theme.space(2)),
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      dismissal: 'esc-and-close',
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
    const rowPitch = theme.control.minHitHeight + theme.space(4);
    const rowY0 = bounds.y + 26;
    // The previews on show hold their art until the modal closes.
    const previewArt = new PagedArt(this, 'land-styles', { owner: overlay });
    const previewWants = new Map<string, string | null>();
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
        previewWants.set(id, thumbArtWanted(this, d, style ?? undefined, this.ownedVariantFor(d.id))?.key ?? null);
        previewArt.show([...previewWants.values()].filter((key): key is string => key !== null));
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
    if (!this.activeSavedDeck()) {
      // No saved deck yet: formats live on the saved record, so tell the
      // player instead of silently ignoring the tap. The draft already sits in
      // the new-deck format, so its own (lit) tab needs no answer.
      if (this.activeFormat() !== format) {
        this.statusMessage = { text: 'Save your deck first, then pick its format.', tone: 'danger' };
        this.renderDeck();
      }
      return;
    }
    if (this.activeFormat() === format) {
      if (format === 'darlings') this.openDarlingsFormat();
      return;
    }
    // Discard can put the deck back on the tapped format (an unsaved import
    // had moved it off), so the tap is judged again once the prompt resolves:
    // the lit Darlings tab opens her chooser, as it does above.
    this.confirmUnsavedChanges('format', () => {
      if (this.activeFormat() !== format) this.switchFormat(format);
      else if (format === 'darlings') this.openDarlingsFormat();
    });
  }

  /**
   * The format lives on the saved record, so a switch is written and saved on
   * the spot. It only ever runs on a deck with nothing unsaved (selectFormat
   * asks first), so it can never write an unsaved draft along with it.
   */
  private switchFormat(format: BuilderFormat): void {
    const active = this.activeSavedDeck();
    if (!active || this.activeFormat() === format) return;
    this.landReserve = switchDeckFormat(active, format);
    this.workingFormat = active.format;
    this.workingDarlingId = active.darlingId ?? null;
    this.commitSavedRecord(active);
    this.statusMessage = null;
    this.deckPage = 0;
    this.deckPaneMode = defaultDeckPaneMode();
    this.renderPool();
    this.renderDeck();
    if (format === 'darlings') this.openDarlingsFormat();
  }

  /**
   * The Darlings tutorial (first time) and then her chooser. Picking a Darling
   * is saved on the spot (she lives on the saved record and leaves the list),
   * so the chooser opens only once nothing is unsaved: asking here also covers
   * the tutorial's Read More, which leaves the builder.
   */
  private openDarlingsFormat(): void {
    this.confirmUnsavedChanges('darling', () => this.openDarlingsTutorialOrPicker());
  }

  private openDarlingsTutorialOrPicker(): void {
    const tutorial = showDarlingsTutorial(this, {
      onDismiss: () => this.showDarlingPicker(),
      onReadMore: () => this.scene.start('Glossary', {
        focus: 'Darlings',
        returnTo: { scene: 'DeckBuilder', data: { deckId: this.activeSavedDeck()?.id } },
      }),
    });
    if (!tutorial) this.showDarlingPicker();
  }

  private showDarlingPicker(): void {
    this.closeFilterPanel();
    this.setSearchInputVisible(false);
    // The zoom stays live here: it draws above the inspect layer, so hovering
    // a candidate shows her full card (UI review finding 26).
    this.zoom.cancel();
    const candidates = listOwnedLegendaryCreatures(CARD_DB, this.save);
    const measure = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: theme.type.caption,
      wordWrap: { width: DARLING_PICKER.nameWidth }, align: 'center' }).setVisible(false);
    const nameHeight = Math.max(menuLineHeight(theme.type.caption), ...candidates.map((card) => { measure.setText(card.name); return measure.height; }));
    measure.destroy();
    const rules = this.add.text(0, 0, DARLINGS_RULES_COPY, { fontFamily: theme.fonts.ui, fontSize: theme.type.caption,
      color: theme.colors.body, align: 'center', wordWrap: { width: DARLING_PICKER.rulesWidth } }).setOrigin(0.5, 0);
    const thumbH = CARD_H * DARLING_PICKER.cardScale;
    const galleryHeight = rules.height + theme.space(4) + thumbH + theme.space(3) + nameHeight + theme.space(3) + theme.control.minHitHeight;
    const picker = menuNoticeLayout(DARLING_PICKER.width, menuLineHeight(theme.type.h1), galleryHeight);
    const shell = modalShell(this, {
      ...picker,
      dimAlpha: 0.56,
      depth: theme.depth.inspect,
      dismissal: 'esc-and-close',
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
      this.add.text(640, shell.tracks.titleTrack.y + shell.tracks.titleTrack.height / 2, 'Choose your Darling', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      }).setOrigin(0.5),
    );
    rules.setPosition(640, shell.contentBounds.y);
    overlay.add(rules);
    const pageSize = 3;
    const pages = formatPageCount(candidates.length, pageSize);
    // The page on show is leased at `visible` and the pages either side are
    // prefetched at `soon`, until the picker closes.
    const pickerArt = new PagedArt(this, 'darling-picker', { owner: overlay });
    let items: Phaser.GameObjects.GameObject[] = [];
    let pageControl: Pager | null = null;
    const clear = (): void => {
      for (const item of items) if (item.active) item.destroy();
      items = [];
    };
    const choose = (id: string): void => {
      // The chooser only opens with nothing unsaved (openDarlingsFormat asks
      // first), so the working deck is the saved one and the pick is saved
      // with it: she leaves the list, and the record takes both.
      const active = this.activeSavedDeck();
      if (!active || this.activeFormat() !== 'darlings') return;
      const withoutPrevious = this.workingDarlingId
        ? removeAllDeckSlots({ cards: this.deck, variantPins: this.variantPins }, this.workingDarlingId)
        : { cards: this.deck, variantPins: this.variantPins };
      const next = removeAllDeckSlots(withoutPrevious, id);
      this.deck = next.cards;
      this.variantPins = next.variantPins;
      active.darlingId = id;
      this.workingDarlingId = id;
      active.cards = [...this.deck];
      active.variantPins = [...this.variantPins];
      active.landReserve = [...this.landReserve];
      this.commitSavedRecord(active);
      this.statusMessage = null;
      this.renderPool();
      this.renderDeck();
      shell.close();
    };
    const renderPage = (nextPage: number): void => {
      clear();
      const around = pageNeighbourhood(candidates, nextPage, pageSize);
      pickerArt.show(this.thumbArtFor(around.shown), this.thumbArtFor(around.near));
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
        const position = gridPosition(index, 3, 640 - DARLING_PICKER.pitch, shell.contentBounds.y + rules.height + theme.space(4) + thumbH / 2, DARLING_PICKER.pitch, 0);
        const variant = this.ownedVariantFor(candidate.id);
        const thumb = makeCardThumb(this, position.x, position.y, candidate, DARLING_PICKER.cardScale, undefined, variant);
        thumb.setInteractive({ useHandCursor: true });
        this.zoom.attach(thumb, candidate, variant);
        const name = this.add.text(position.x, position.y + thumbH / 2 + theme.space(3), candidate.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        }).setOrigin(0.5);
        name.setOrigin(0.5, 0);
        fitMenuName(name, DARLING_PICKER.nameWidth, Number.POSITIVE_INFINITY);
        const button = themedButton(this, position.x, position.y + thumbH / 2 + theme.space(3) + nameHeight + theme.space(3) + theme.control.minHitHeight / 2, 'Choose', {
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
      pageControl = pager(this, 590, shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2, 0, pages, renderPage);
      overlay.add(pageControl.container);
    }
    renderPage(0);
  }

  private reserveLandChoices(): CardDef[] {
    const darlingId = this.activeDarlingId();
    return Object.values(CARD_DB)
      .filter((card) => isBasicLand(card) || (isDualLand(card) && ownedCount(this.save, card.id) > 0))
      .filter((card) => !darlingId || darlingsCardError(CARD_DB, darlingId, card.id) === null)
      // Basics first: they are the unlimited, always-legal pick the subtitle
      // advertises, and a flat alphabetical sort buried them on later pages
      // behind dozens of duals (player report, 2026-08-24).
      .sort(
        (a, b) =>
          Number(isBasicLand(b)) - Number(isBasicLand(a)) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      );
  }

  private setReserveSlot(index: number, cardId: string | null): void {
    const next = [...this.landReserve];
    // The reserve is a dense ordered list: filling a slot past the current
    // end appends, so holes (nulls) can never reach the saved deck.
    if (cardId) next[Math.min(index, next.length)] = cardId;
    else next.splice(index, 1);
    // An ordinary unsaved edit, like a card: Save Deck writes it. This used to
    // copy the whole working deck into the saved record and write it to disk.
    this.landReserve = next.slice(0, LAND_RESERVE_SIZE);
    this.statusMessage = null;
    this.renderDeck();
  }

  private showReserveLandPicker(index: number): void {
    const choices: Array<{ id: string | null; label: string; pips: string[]; tapped: boolean }> = [
      { id: null, label: 'Remove land', pips: [], tapped: false },
      ...this.reserveLandChoices().map((card) => ({
        id: card.id,
        label: card.name,
        pips: [...(card.manaAbility ?? [])],
        tapped: card.entersTapped === true,
      })),
    ];
    const measure = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: theme.type.caption,
      fontStyle: theme.weight.w600, wordWrap: { width: 252, useAdvancedWrap: true } }).setVisible(false);
    const rowHeight = Math.max(theme.control.minHitHeight, ...choices.map((choice) => { measure.setText(choice.label); return measure.height + theme.space(2); }));
    measure.destroy();
    const rowPitch = rowHeight + theme.space(3);
    const shell = modalShell(this, {
      ...menuNoticeLayout(980, menuLineHeight(theme.type.h2), 2 * menuLineHeight(theme.type.caption) + theme.space(4) + 4 * rowPitch),
      dimAlpha: 0.56,
      depth: theme.depth.inspect,
      dismissal: 'dismissible',
    });
    const overlay = shell.container;
    // Lay out from the shell's own tracks. The title used to sit at y=72,
    // ABOVE the panel's top edge, at h1 in a 760-wide panel, so it overhung
    // the chrome and clipped (player report, 2026-08-24).
    const content = shell.contentBounds;
    const titleTrack = shell.tracks.titleTrack;
    const centerX = content.x + content.width / 2;
    overlay.add(
      this.add.text(centerX, titleTrack.y + titleTrack.height / 2, `Warchest Reserves slot ${index + 1}`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      }).setOrigin(0.5),
    );
    overlay.add(
      this.add.text(centerX, content.y + theme.space(2), 'Basics are unlimited. Dual lands must be owned, and arrive tapped (T).', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
        wordWrap: { width: content.width - theme.space(4) },
        align: 'center',
      }).setOrigin(0.5, 0),
    );
    // A land's whole purpose is the mana it makes, and the picker used to show
    // nothing but its name: "Ash Ballroom" told a player nothing about what it
    // taps for or whether it arrives tapped (player report, 2026-08-24). Each
    // choice now carries its colour pips and a tapped marker.
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
        const position = gridPosition(choiceIndex, 2, centerX - 230, content.y + 2 * menuLineHeight(theme.type.caption) + theme.space(4) + rowHeight / 2, 440, rowPitch);
        const button = themedButton(this, position.x, position.y, choice.label, {
          variant: choice.id === this.landReserve[index] ? 'selected' : 'ghost',
          size: 'sm',
          minWidth: 276,
          maxTextWidth: 252,
          onTap: () => {
            this.setReserveSlot(index, choice.id);
            shell.close();
          },
        });
        overlay.add(button.container);
        items.push(button.container);
        // Pips sit outside the button so they never fight its label for room.
        let pipX = position.x + 156;
        for (const pip of choice.pips) {
          const key = `pip-${pip}`;
          if (!this.textures.exists(key)) continue;
          const bead = this.add.image(pipX, position.y, key).setDisplaySize(18, 18);
          overlay.add(bead);
          items.push(bead);
          pipX += 21;
        }
        if (choice.tapped) {
          const marker = this.add
            .text(pipX + 2, position.y, 'T', {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              fontStyle: theme.weight.w700,
              color: theme.colors.muted,
            })
            .setOrigin(0, 0.5);
          overlay.add(marker);
          items.push(marker);
        }
      });
      pageControl?.refresh(Math.max(0, nextPage), pages);
    };
    if (pages > 1) {
      pageControl = pager(this, centerX - 50, shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2, 0, pages, renderPage);
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
    const layout = { ...DECK_PANE_LAYOUT.formatRow, y: this.headerLayout.formatY };
    // A retired classic deck matches none of the offered tabs, so the row would
    // otherwise render with nothing lit and read as a bug rather than as a deck
    // sitting on a format that is no longer playable (user report 2026-08-24).
    // The label carries that state so the unlit tabs read as the choice they are.
    const retired = !offered.includes(format);
    this.rightPane.push(
      this.add.text(layout.labelX, layout.y, retired ? 'Classic' : 'Format', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: retired ? theme.colors.danger : theme.colors.muted,
      }).setOrigin(0, 0.5),
    );
    const buttons = tabs.map((choice) => themedButton(this, 0, layout.y, formatLabel(choice), {
      variant: choice === format ? 'selected' : 'ghost',
      size: 'sm',
      minWidth: layout.tabMinWidth,
      onTap: () => this.selectFormat(choice),
    }));
    this.placePaneTabs(buttons);
  }

  /** The Format and View rows' labels, measured: the shared tab column starts past the wider. */
  private paneLabelWidth(): number {
    const probe = this.add.text(0, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, fontStyle: theme.weight.w700,
    });
    const width = Math.max(...['Format', 'Classic', 'View'].map((label) => probe.setText(label).width));
    probe.destroy();
    return width;
  }

  private placePaneTabs(buttons: readonly ThemedButton[]): void {
    const xs = deckPaneTabRow(this.paneLabelWidth(), buttons.map((b) => b.getMeasuredBounds().visual.width));
    buttons.forEach((button, index) => {
      button.container.setX(xs[index]);
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
    const cards = themedButton(this, 0, y, 'Cards', {
      variant: state.cardsSelected ? 'selected' : 'ghost',
      size: 'sm',
      minWidth: layout.minWidth,
      onTap: () => {
        this.deckPaneMode = 'cards';
        this.renderDeck();
      },
    });
    const warchest = themedButton(this, 0, y, state.warchestLabel, {
      variant: state.warchestSelected ? 'selected' : state.warchestWarning ? 'danger' : 'ghost',
      size: 'sm',
      minWidth: layout.minWidth,
      onTap: () => {
        this.deckPaneMode = 'warchest';
        this.renderDeck();
      },
    });
    const style = themedButton(this, 0, y, 'Style', {
      variant: state.styleSelected ? 'selected' : 'ghost',
      size: 'sm',
      minWidth: layout.minWidth,
      onTap: () => {
        this.deckPaneMode = 'style';
        this.renderDeck();
      },
    });
    this.placePaneTabs([cards, warchest, style]);
  }

  /**
   * The deck's own look: card back, playmat, and the per-basic land styles that
   * already lived on the deck. Style became per-deck in save v33, so this pane
   * replaced the Profile's account-level Style section.
   */
  private renderStylePanel(lift = 0): void {
    const active = this.activeSavedDeck();
    const top = DECK_PANE_LAYOUT.content.top - lift;
    const x0 = PANEL_LEFT_X;

    if (!active) {
      this.rightPane.push(
        this.add
          .text(x0, top + 24, 'Save this deck first, then give it a look of its own.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            wordWrap: { width: 340 },
          })
          .setOrigin(0, 0.5),
      );
      return;
    }

    const cardBack = CARD_BACKS.find((entry) => entry.id === active.cardBack) ?? CARD_BACKS[0];
    const playmat = playmatForId(active.playmat ?? null);

    // Card back row.
    let y = top + 30;
    this.rightPane.push(
      this.add
        .text(x0, y, 'Card back', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
      this.add.image(x0 + 96, y, safeCardBackTexture(this, cardBack)).setDisplaySize(24, 34),
      this.add
        .text(x0 + 118, y, cardBack.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.heading,
          wordWrap: { width: 118 },
        })
        .setOrigin(0, 0.5),
    );
    const backBtn = themedButton(this, x0 + 302, y, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.openDeckStylePicker('cardBack'),
    });
    this.rightPane.push(backBtn.container);

    // Playmat row.
    y += 56;
    const swatch = this.add.graphics();
    paintPlaymatSwatch(swatch, x0 + 96, y, playmat, 34, 24);
    this.rightPane.push(
      this.add
        .text(x0, y, 'Playmat', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
      swatch,
      this.add
        .text(x0 + 118, y, playmat.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.heading,
          wordWrap: { width: 118 },
        })
        .setOrigin(0, 0.5),
    );
    const matBtn = themedButton(this, x0 + 302, y, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.openDeckStylePicker('playmat'),
    });
    this.rightPane.push(matBtn.container);

    // Land styles row. The basics block that carries them inline (desktop) or
    // behind a title-row button (touch) exists only on the retired Constructed
    // format, so a Standard or Darlings deck had no way to them. Here a style
    // dresses the basic lands of this deck's Warchest; dual lands keep their
    // own art.
    y += 56;
    const styled = BASIC_LAND_IDS.filter((id) => active.landStyle?.[id]);
    const sampleId = styled[0] ?? BASIC_LAND_IDS[0];
    this.rightPane.push(
      this.add
        .text(x0, y, 'Land styles', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5),
      this.paneThumb(x0 + 96, y, byId(sampleId), 0.095, active.landStyle?.[sampleId] ?? undefined, this.ownedVariantFor(sampleId)),
      this.add
        .text(x0 + 118, y, styled.length === 0 ? 'Default art' : `${styled.length} of ${BASIC_LAND_IDS.length} basics styled`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.heading,
          wordWrap: { width: 118 },
        })
        .setOrigin(0, 0.5),
    );
    const landBtn = themedButton(this, x0 + 302, y, 'Change', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 90,
      onTap: () => this.showLandStylesModal(),
    });
    this.rightPane.push(landBtn.container);

    y += 56;
    this.rightPane.push(
      this.add
        .text(x0, y, 'These apply to this deck only. Your library shows its card back when you mulligan.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
          wordWrap: { width: 350 },
          lineSpacing: 2,
        })
        .setOrigin(0, 0.5),
    );
  }

  private openDeckStylePicker(kind: 'cardBack' | 'playmat'): void {
    const active = this.activeSavedDeck();
    if (!active) return;
    this.styleShell?.close();
    this.styleShell = openCosmeticPicker(this, {
      kind,
      currentId: (kind === 'cardBack' ? active.cardBack : active.playmat) ?? null,
      owned: this.save.cosmetics.owned,
      subtitle: `Style for ${active.name}. This deck only.`,
      onEquip: (id) => {
        const deck = this.activeSavedDeck();
        if (!deck) return;
        // The catalog default persists as null so a retired id can never pin a
        // deck to something the catalog no longer has.
        const value = id === (kind === 'cardBack' ? DEFAULT_CARD_BACK_ID : DEFAULT_PLAYMAT_ID) ? null : id;
        if (kind === 'cardBack') deck.cardBack = value;
        else deck.playmat = value;
        if (!this.fixtureSave) Services.save.touch();
        this.renderDeck();
      },
      onClose: () => {
        this.styleShell = null;
      },
    });
  }

  /** Full-width reserve workspace below the Cards / Warchest toggle. */
  private renderReservePanel(format: BuilderFormat, lift = 0): void {
    const layout = DECK_PANE_LAYOUT;
    const top = layout.content.top - lift;
    const bottom = this.summaryLayout.statusTop - theme.space(3);
    const panel = this.add.container(0, 0);
    panel.add(themedPanel(this, layout.left, top, layout.right - layout.left, bottom - top,
      { alpha: theme.alpha.panel, radius: theme.radius.control }));
    const reserveIssues = validateLandReserve(CARD_DB, this.save, this.landReserve);
    const duals = this.landReserve.filter((id) => CARD_DB[id] && isDualLand(CARD_DB[id])).length;
    const x = layout.left + theme.space(3), width = layout.right - x - theme.space(3);
    const heading = this.add.text(x, 0, 'Warchest Reserves', { fontFamily: theme.fonts.display,
      fontSize: theme.type.label, color: theme.colors.heading });
    const count = this.add.text(x, 0, this.landReserve.length + '/' + LAND_RESERVE_SIZE + ' lands · ' + duals + '/' + MAX_DUAL_LANDS + ' duals',
      { fontFamily: theme.fonts.ui, fontSize: theme.type.caption, color: duals > MAX_DUAL_LANDS ? theme.colors.danger : theme.colors.body });
    const validation = this.add.text(x, 0, reserveIssues[0]?.message ?? 'Warchest ready.',
      { fontFamily: theme.fonts.ui, fontSize: theme.type.micro, color: reserveIssues.length ? theme.colors.danger : theme.colors.success,
        wordWrap: { width } });
    panel.add([heading, count, validation]);
    const rules = this.add.text(x, 0, formatRulesCopy(format) ?? '', { fontFamily: theme.fonts.ui,
      fontSize: theme.type.micro, color: theme.colors.body, wordWrap: { width }, lineSpacing: theme.space(0.5) });
    rules.setY(bottom - theme.space(3) - rules.height);
    panel.add(rules);
    const slotWidth = (width - theme.space(2)) / 2;
    const buttons = Array.from({ length: LAND_RESERVE_SIZE }, (_, i) => {
      const card = this.landReserve[i] ? CARD_DB[this.landReserve[i]] : undefined;
      return themedButton(this, 0, 0, warchestSlotLabel(i, card?.name ?? 'Choose land'), {
        variant: card ? 'ghost' : 'emphasis', size: 'sm', minWidth: slotWidth,
        maxTextWidth: slotWidth - theme.space(6), onTap: () => this.showReserveLandPicker(i),
      });
    });
    const reserve = deckReserveLayout({ top, bottom, headerHeights: [heading.height, count.height, validation.height],
      rulesHeight: rules.height, slotHeight: Math.max(...buttons.map((button) => button.getMeasuredSize().hit.height)), slotCount: buttons.length });
    [heading, count, validation].forEach((text, index) => text.setY(reserve.headerYs[index]));
    rules.setY(reserve.rulesY);
    const { pageSize, pageCount, pagerY } = reserve;
    let control: Pager | null = null;
    const showPage = (page: number): void => {
      buttons.forEach((button, index) => {
        const local = index - page * pageSize, visible = local >= 0 && local < pageSize;
        button.container.setVisible(visible); button.setEnabled(visible);
        if (visible) {
          const center = reserve.slotCenter(local);
          button.container.setPosition(center.x, center.y);
        }
      });
      control?.refresh(page, pageCount);
    };
    panel.add(buttons.map((button) => button.container));
    if (pageCount > 1) {
      control = pager(this, layout.left + 130, pagerY, 0, pageCount, showPage);
      panel.add(control.container);
    }
    showPage(0);
    this.rightPane.push(panel);
  }

  private renderDeckPagers(pages: number, lastRowBottom: number): void {
    const at = deckListPagerPosition(lastRowBottom, this.summaryLayout);
    const deckPager = pager(this, at.x, at.y, this.deckPage, pages, (page) => {
      this.deckPage = page;
      this.renderDeck();
    });
    this.rightPane.push(deckPager.container);
  }

  /**
   * F15: modal deck picker — select / new / copy / rename / delete. It opens
   * only once nothing is unsaved (D10): it used to copy the working deck into
   * the saved record unasked, and to throw a never-saved deck away when
   * another deck was opened.
   */
  private showDeckPicker(): void {
    this.confirmUnsavedChanges('decks', () => this.openDeckPicker());
  }

  private openDeckPicker(initialRow = this.fixturePickerRow, focusDeckId?: string, initialOffset?: number): void {
    const save = this.save;
    this.closeFilterPanel();
    this.setSearchInputVisible(false);
    const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
    const measureActions = ['Using', 'Copy', 'Rename', 'Delete'].map((label) => themedButton(this, 0, 0, label, { size: 'sm' }));
    const actionW = Math.max(...measureActions.map((button) => button.getMeasuredSize().hit.width));
    measureActions.forEach((button) => button.container.destroy());
    const nameWidth = deckPickerLayout({ actionWidth: actionW }).nameWidth;
    const measure = this.add.text(0, 0, '', { fontFamily: theme.fonts.display, fontSize: theme.type.label,
      wordWrap: { width: nameWidth, useAdvancedWrap: true } }).setVisible(false);
    const nameHeight = Math.max(menuLineHeight(theme.type.label), ...decks.map((deck) => { measure.setText(deck.name); return measure.height; }));
    measure.setStyle({ fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px` }).setText(DECK_DELETE_NOTE);
    const deleteNoteHeight = measure.height;
    measure.destroy();
    const pickerLayout = deckPickerLayout({ count: decks.length, nameHeight, actionWidth: actionW, deleteNoteHeight });
    const { viewport, row } = pickerLayout;
    const deckPickerShell = modalShell(this, {
      // The title-safe frame's full width: at 1200 the panel's border ran
      // 24px past the frame on both sides (1.8 cut, 2026-09-23).
      width: theme.design.safeWidth,
      height: pickerLayout.panelHeight,
      dimAlpha: 0.52,
      depth: theme.depth.modal,
      dismissal: 'esc-only',
    });
    const overlay = deckPickerShell.container;
    const closeOverlay = (): void => deckPickerShell.close();
    overlay.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.setSearchInputVisible(true);
    });
    let list: Phaser.GameObjects.Container | null = null;
    const scrollOffset = (): number => (list ? viewport.y - list.y : 0);
    let renderList: (offset: number) => void = () => {};
    const setActiveDeck = (id: string | null): void => {
      // Dirty tracking follows the deck actually being edited, which is the
      // working deck rather than the saved active id (they diverge when a
      // hidden reserve deck is still the save's active deck).
      save.activeDeckId = id;
      this.loadWorkingDeck(save.decks.find((d) => d.id === id) ?? null);
      this.deckPaneMode = defaultDeckPaneMode();
      this.flush();
      this.renderPool();
      this.renderDeck();
      renderList(scrollOffset());
    };
    overlay.add(
      this.add
        .text(theme.design.centerX, pickerLayout.titleY, 'Your Decks', { fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading })
        .setOrigin(0.5),
    );

    const reopenPicker = (focusId?: string): void => {
      const offset = scrollOffset();
      closeOverlay();
      this.openDeckPicker(0, focusId, focusId ? undefined : offset);
    };
    // A row is tapped only where the list shows it, and a drag that scrolled
    // the list is not a tap (the mouse's pointerup fires either way).
    const tapInList = (pointer: Phaser.Input.Pointer): boolean =>
      pointer.worldY >= viewport.y && pointer.worldY <= viewport.y + viewport.height &&
      Math.hypot(pointer.upX - pointer.downX, pointer.upY - pointer.downY) <= tapSlopWorldPx();

    // One row per deck (deckPanePresentation.ts, deckPickerLayout): content
    // x is world x, content y runs from the list's top.
    const renderDeckRow = (parent: Phaser.GameObjects.Container, deck: SavedDeck, top: number, buttons: ThemedButton[]): void => {
      const isActive = deck.id === this.workingDeckId;
      const deckFormat = deck.format === 'darlings' || deck.format === 'warchest' ? deck.format : 'constructed';
      const repair = deckHealth(CARD_DB, save, deck);
      const left = viewport.x;
      const midY = top + row.height / 2;
      // List-row selection: a border plus a left accent bar (UI review).
      const bg = this.add
        .rectangle(left + row.width / 2, midY, row.width, row.height, isActive ? theme.graphics.rowFillActive : theme.graphics.panelFill, theme.alpha.panel)
        .setStrokeStyle(1, colorInt(isActive ? theme.colors.gold : theme.colors.panelStroke), isActive ? 1 : theme.alpha.chrome)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, bg, (pointer) => { if (tapInList(pointer)) setActiveDeck(deck.id); });
      parent.add(bg);
      if (isActive) {
        parent.add(this.add.rectangle(left + row.accentWidth / 2, midY, row.accentWidth, row.height, colorInt(theme.colors.gold), 1));
      }
      const hero = this.deckPickerHero(deck);
      this.addDeckHeroPortrait(parent, left + pickerLayout.portrait.x, midY, hero, pickerLayout.portrait.width, pickerLayout.portrait.height);

      const title = this.add
        .text(left + pickerLayout.nameX, top + pickerLayout.nameTop, deck.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          color: isActive ? theme.colors.gold : theme.colors.heading,
        })
        .setOrigin(0, 0);
      fitMenuName(title, pickerLayout.nameWidth, Number.POSITIVE_INFINITY);
      parent.add(title);
      const blockKind = deckBlockKind(deck, repair.blocked, this.classicRetired);
      const badgeColor = repair.blocked ? theme.colors.danger : isActive ? theme.colors.gold : theme.colors.muted;
      const badge = this.add
        .text(left + pickerLayout.nameX, top + pickerLayout.badgeTop, blockKind ? `${formatLabel(deckFormat)} · ${deckBlockLabel(blockKind)}` : formatLabel(deckFormat), {
          fontFamily: theme.fonts.ui,
          fontSize: theme.type.micro + 'px',
          fontStyle: theme.weight.w700,
          color: badgeColor,
          wordWrap: { width: pickerLayout.nameWidth, useAdvancedWrap: true },
        })
        .setOrigin(0, 0);
      parent.add(badge);
      const countLabel = this.add
        .text(left + pickerLayout.countRight, midY, deck.cards.length + '/' + formatDeckSize(deckFormat), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          fontStyle: '700',
          color: repair.blocked ? theme.colors.danger : deck.cards.length === formatDeckSize(deckFormat) ? theme.colors.success : theme.colors.danger,
        })
        .setOrigin(1, 0.5);
      parent.add(countLabel);
      this.addDeckColorPips(parent, left + pickerLayout.countRight - countLabel.width - theme.space(2), midY, deck.cards);

      const [useX, copyX, renameX, deleteX] = pickerLayout.actions.xs.map((x) => left + x);
      const useBtn = themedButton(this, useX, midY, isActive ? 'Using' : 'Use', {
        variant: isActive ? 'selected' : 'ghost',
        size: 'sm',
        minWidth: actionW,
        onTap: () => setActiveDeck(deck.id),
      });
      const copyBtn = themedButton(this, copyX, midY, 'Copy', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: actionW,
        onTap: () => {
          const id = copyDeck(save, deck.id);
          if (!id) return;
          const copy = save.decks.find((d) => d.id === id);
          if (copy) this.acknowledgeUnplayableDeck(copy);
          this.flush();
          reopenPicker(id);
        },
      });
      const renameBtn = themedButton(this, renameX, midY, 'Rename', {
        variant: 'ghost',
        size: 'sm',
        minWidth: actionW,
        onTap: () => {
          this.promptRename(deck.id, () => {
            if (deck.id === this.workingDeckId) this.renderDeck();
            reopenPicker(deck.id);
          });
        },
      });
      // Two-press Delete, the pattern Settings' Reset, the Gauntlet's Abandon
      // and Limited's Retire share: the first press arms it, names the press
      // that confirms (Tap or Click, by the pointer that pressed it) and what
      // is kept, and it stands down after DELETE_ARM_MS unanswered. The armed
      // label takes Rename's slot too, and the note takes the format line's.
      let delArmed = false;
      const setDeleteArmed = (armed: boolean, touch = false): void => {
        delArmed = armed;
        delBtn.setLabel(armed ? `${touch ? 'Tap' : 'Click'} again to delete` : 'Delete');
        delBtn.container.setX(armed ? left + pickerLayout.actions.armedX : deleteX);
        renameBtn.container.setVisible(!armed);
        renameBtn.setEnabled(!armed);
        badge.setText(armed ? DECK_DELETE_NOTE : blockKind ? `${formatLabel(deckFormat)} · ${deckBlockLabel(blockKind)}` : formatLabel(deckFormat));
        badge.setColor(armed ? theme.colors.danger : badgeColor);
      };
      const delBtn = themedButton(this, deleteX, midY, 'Delete', {
        variant: 'danger',
        size: 'sm',
        minWidth: actionW,
        maxTextWidth: pickerLayout.actions.armedWidth - theme.space(6),
        onTap: (pointer) => {
          if (save.settings.confirmDestructive && !delArmed) {
            setDeleteArmed(true, pointer.wasTouch);
            // A re-rendered list has new buttons and has already disarmed, so
            // a timer from this one leaves them alone.
            this.time.delayedCall(DELETE_ARM_MS, () => {
              if (delBtn.container.active && delArmed) setDeleteArmed(false);
            });
            return;
          }
          deleteDeck(save, deck.id);
          if (isActive) {
            // loadWorkingDeck also moves the unsaved-changes baseline to the
            // fallback deck. Keeping the deleted deck's baseline made Leave
            // Without Saving write the deleted deck over this one.
            this.loadWorkingDeck(activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled));
            this.deckPaneMode = defaultDeckPaneMode();
            this.renderPool();
            this.renderDeck();
          }
          this.flush();
          reopenPicker();
        },
      });
      for (const button of [useBtn, copyBtn, renameBtn, delBtn]) {
        parent.add(button.container);
        buttons.push(button);
      }
    };

    renderList = (offset: number): void => {
      list?.destroy();
      const content = this.add.container(0, viewport.y);
      list = content;
      overlay.add(content);
      const shown = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
      const buttons: ThemedButton[] = [];
      shown.forEach((deck, i) => renderDeckRow(content, deck, i * row.pitch, buttons));
      if (shown.length === 0) {
        content.add(this.add.text(theme.design.centerX, row.height / 2, 'No decks yet. Start one with New Deck.', {
          fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted,
        }).setOrigin(0.5));
      }
      // The wheel, a drag, or the scrollbar's thumb runs the list; it rests
      // on whole rows, so no row is left cut in half at the top.
      bindMenuScroll(this, content, viewport, deckPickerContentHeight(shown.length, pickerLayout),
        undefined, buttons, row.pitch, deckPickerShell, offset);
    };
    const focusIndex = focusDeckId ? decks.findIndex((deck) => deck.id === focusDeckId) : -1;
    const activeIndex = decks.findIndex((deck) => deck.id === this.workingDeckId);
    renderList(initialOffset ?? deckPickerScrollTo(focusIndex >= 0 ? focusIndex : initialRow || Math.max(0, activeIndex), decks.length, pickerLayout));

    // New Deck stays in the footer, wherever the list is scrolled.
    const create = (format: BuilderFormat): void => {
      const id = generateDeckId(save);
      saveDeck(save, {
        id,
        name: `Deck ${save.decks.length + 1}`,
        cards: [],
        format,
        darlingId: null,
        landReserve: format === 'constructed' ? null : [],
      });
      // An empty deck cannot be played; the player just made it, so the
      // menu's "the rules changed" repair notice must not call it broken.
      const created = save.decks.find((d) => d.id === id);
      if (created) this.acknowledgeUnplayableDeck(created);
      setActiveDeck(id);
      closeOverlay();
      // A Darlings deck is unplayable until she is chosen, and her chooser
      // was otherwise reachable only through the already-lit Darlings tab.
      if (format === 'darlings') this.openDarlingsFormat();
    };
    const newBtn = themedButton(this, 0, pickerLayout.footerY, '+ New Deck', {
      variant: 'primary',
      minWidth: pickerLayout.closeMinWidth,
      onTap: () => this.showNewDeckFormatPrompt(create),
    });
    newBtn.container.setX(pickerLayout.newDeckLeft + newBtn.getMeasuredSize().hit.width / 2);
    overlay.add(newBtn.container);

    const closeBtn = themedButton(this, pickerLayout.closeX, pickerLayout.footerY, 'Close', {
      variant: 'ghost',
      minWidth: pickerLayout.closeMinWidth,
      onTap: closeOverlay,
    });
    overlay.add(closeBtn.container);
  }

  private showNewDeckFormatPrompt(onChoose: (format: BuilderFormat) => void): void {
    const formats = offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired);
    const shell = modalShell(this, {
      ...menuNoticeLayout(520, menuLineHeight(theme.type.h1), formats.length * (theme.control.minHitHeight + theme.space(3)) - theme.space(3)),
      dimAlpha: 0.72,
      depth: theme.depth.inspect,
      dismissal: 'esc-and-close',
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

    const save = this.save;
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
    const save = this.save;
    const deck = save.decks.find((d) => d.id === deckId);
    if (!deck) return;
    const renameShell = modalShell(this, {
      ...menuNoticeLayout(460, menuLineHeight(theme.type.h2), menuLineHeight(theme.type.caption) + theme.space(3) + menuLineHeight(theme.type.body) + theme.space(6)),
      dimAlpha: 0.52,
      depth: theme.depth.results,
      dismissal: 'mandatory',
    });
    const modal = renameShell.container;
    this.setSearchInputVisible(false);
    modal.once('destroy', () => this.setSearchInputVisible(!sceneHasOpenModal(this)));
    modal.add(
      this.add
        .text(640, renameShell.tracks.titleTrack.y + renameShell.tracks.titleTrack.height / 2, 'Rename Deck', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    modal.add(
      this.add
        .text(640, renameShell.contentBounds.y + menuLineHeight(theme.type.caption) / 2, `${DECK_NAME_MAX_LENGTH} characters max`, {
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
    const inputDom = this.add.dom(640, renameShell.contentBounds.y + menuLineHeight(theme.type.caption) + theme.space(3) + (menuLineHeight(theme.type.body) + theme.space(5)) / 2, input).setDepth(151);

    modal.add(inputDom);
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
      this.flush();
      close();
      if (!cancel && name) onDone?.();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape') commit(true);
    });
    const saveBtn = themedButton(this, 580, renameShell.tracks.footerTrack.y + renameShell.tracks.footerTrack.height / 2, 'Save', {
      variant: 'primary',
      minWidth: 90,
      onTap: () => commit(),
    });
    const cancelBtn = themedButton(this, 700, renameShell.tracks.footerTrack.y + renameShell.tracks.footerTrack.height / 2, 'Cancel', {
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
        .text(x0, this.summaryLayout.statsHeadingY, 'Mana curve', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0.5),
    );

    const baseY = this.summaryLayout.barBaseY; // bar baseline (bars grow upward)
    const curveLayout = DECK_PANE_LAYOUT.curve;
    for (const bar of curveBars(s.curve, {
      firstX: curveLayout.firstX,
      pitch: curveLayout.pitch,
      maxHeight: this.summaryLayout.barMaxHeight,
    })) {
      push(this.add.rectangle(bar.x, baseY, curveLayout.barWidth, bar.height, bar.count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1));
      if (bar.count > 0) {
        push(
          this.add
            .text(bar.x, baseY - bar.height - this.summaryLayout.countOffsetY, `${bar.count}`, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              color: theme.colors.body,
            })
            .setOrigin(0.5),
        );
      }
      push(
        this.add
          .text(bar.x, this.summaryLayout.manaValueY, bar.label, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0.5),
      );
    }

    // One merged summary line (counts left, colour pips right): the old second
    // line is what used to collide with the status band below (isolation pass
    // 2026-08-18). Colours are pip beads, as everywhere else in the builder;
    // the old "W·12 R·44" letter run broke that convention. In a reserve
    // format the counts name the Warchest fill, not a "0 lands" that never
    // changes.
    const y = this.summaryLayout.summaryTop + menuLineHeight(theme.type.caption) / 2;
    const pipSize = 16;
    let right = PANEL_RIGHT_X;
    const pips = deckPipCounts(s);
    const beads: Array<{ color: string; count: number | null }> = pips.length > 0
      ? pips
      // A deck of colorless spells shows the colorless bead, as its picker
      // tile does; an empty deck shows no colour at all.
      : s.nonlands > 0 ? [{ color: 'C', count: null }] : [];
    for (const bead of [...beads].reverse()) {
      if (bead.count !== null) {
        const count = this.add
          .text(right, y, `${bead.count}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.body,
          })
          .setOrigin(1, 0.5);
        push(count);
        right -= count.width + 3;
      }
      const key = `pip-${bead.color}`;
      if (this.textures.exists(key)) {
        push(this.add.image(right - pipSize / 2, y, key).setDisplaySize(pipSize, pipSize));
      }
      right -= pipSize + 10;
    }
    const counts = this.add
      .text(
        x0,
        y + menuLineHeight(theme.type.caption) + theme.space(1),
        deckCountsLine(
          s,
          this.isReserveFormat()
            ? { kind: 'warchest', filled: this.landReserve.length, size: LAND_RESERVE_SIZE }
            : { kind: 'list' },
        ),
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        },
      )
      .setOrigin(0, 0.5);
    fitMenuName(counts, PANEL_RIGHT_X - x0, Number.POSITIVE_INFINITY);
    counts.setOrigin(0, 0).setY(y + menuLineHeight(theme.type.caption) / 2 + theme.space(1));
    push(counts);
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
    this.statusMessage = null;
    this.renderPool();
    this.renderDeck();
  }

  private basicDeckRowLabel(id: BasicLandId): string {
    return `${byId(id).name}: ${this.countIn(this.deck, id)}${this.hasPinnedDisplay(id) ? ' · pinned art' : ''}`;
  }

  private renderConstructedBasicRow(id: BasicLandId, y: number): void {
    const x0 = PANEL_LEFT_X;
      const d = byId(id);
      const landStyle = this.activeSavedDeck()?.landStyle?.[id] ?? null;
      const row = this.add
        .text(x0, y, this.basicDeckRowLabel(id), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      fitMenuName(row, 76, Number.POSITIVE_INFINITY);
      const minus = themedButton(this, PANEL_RIGHT_X - 149, y, '−', {
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
          this.statusMessage = null;
          const next = appendDeckSlot({ cards: this.deck, variantPins: this.variantPins }, id);
          this.deck = next.cards;
          this.variantPins = next.variantPins;
          this.renderDeck();
        },
      });
      this.rightPane.push(row);
      {
        const preview = this.paneThumb(x0 + 94, y, d, 0.095, landStyle ?? undefined, this.ownedVariantFor(d.id));
        const style = this.landStyleControl(x0 + 132, y, id, landStyle);
        this.rightPane.push(preview, style);
      }
      this.rightPane.push(minus.container, plus.container);
  }

  private renderDeckRows(x0: number, heroId: string | null, listY0: number): void {
    // Basics are hidden here ONLY in constructed, where the +/- basics block
    // above owns them. In a reserve format that block is replaced by the
    // Warchest panel, so hiding basics here left a migrated classic deck's
    // ~20 basic lands invisible AND unremovable: the repair banner demanded
    // 40 cards, the deck held 60, and nothing in the UI could reach the
    // difference. Show them so they can be removed (player report, 2026-08-24).
    const rows = collapseDeckRows(this.deck, this.variantPins);
    if (!this.isReserveFormat()) for (const cardId of BASIC_LAND_IDS) {
      if (!rows.some((row) => row.cardId === cardId)) rows.push({ cardId, quantity: 0, firstIndex: -1, hasLegacyVariantPin: false });
    }
    const entries = rows
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
    const nameWidth = this.touch ? 148 : DECK_PANE_LAYOUT.cards.nameWidth;
    const measure = this.add.text(0, 0, '', { fontFamily: theme.fonts.ui, fontSize: theme.type.caption,
      wordWrap: { width: nameWidth, useAdvancedWrap: true } }).setVisible(false);
    const basicRow = (id: string): boolean => !this.isReserveFormat() && BASIC_LAND_IDS.includes(id as BasicLandId);
    const rowHeights = entries.map((entry) => {
      if (basicRow(entry.cardId)) {
        const id = entry.cardId as BasicLandId;
        measure.setWordWrapWidth(76, true).setText(this.basicDeckRowLabel(id));
        // The exempt preview's face is 39.9px high; transparent FX bleed
        // does not add row spacing. Controls retain their own 44px hit bands.
        return Math.max(measure.height, CARD_FACE_H * 0.095, theme.control.heightSm);
      }
      measure.setWordWrapWidth(nameWidth, true).setText(CARD_DB[entry.cardId]?.name ?? `Unavailable card: ${entry.cardId}`);
      // The drawn minus control is 30px. Its inflated hit band stays separate.
      return Math.max(measure.height, this.touch ? theme.control.heightSm : 0);
    });
    let heroInputHeight = 0;
    if (this.activeFormat() !== 'darlings') {
      measure.setFontSize(DECK_PANE_LAYOUT.cards.starSize).setFontStyle('700').setText('\u2606');
      // The star owns an independently inflated input band. Adding the name's
      // wrap gap to this control would widen the release's 28px desktop pitch.
      heroInputHeight = measure.height;
    }
    measure.destroy();
    const profile = deckListProfile(this.touch);
    const layout = deckListLayout(rowHeights, { top: listY0, bottom: this.summaryLayout.listBottom,
      pagerY: this.summaryLayout.pagerY, ...profile,
      inputHeights: entries.map(entry => basicRow(entry.cardId) ? theme.control.minHitHeight
        : Math.max(profile.rowPitch, heroInputHeight)),
      // Touch's minus column sits to the right of the pager; desktop names
      // and constructed style controls share its x range and must stop above it.
      inputBottoms: entries.map(entry => !this.touch || basicRow(entry.cardId)
        ? this.summaryLayout.pagerY - theme.control.minHitHeight / 2 : Infinity),
    });
    const pages = layout.pages.length;
    if (this.fixtureFocusCardId) {
      const focusIndex = entries.findIndex((entry) => entry.cardId === this.fixtureFocusCardId);
      const focusPage = layout.pages.findIndex((page) => page.some((row) => row.index === focusIndex));
      if (focusPage >= 0) this.deckPage = focusPage;
    }
    this.deckPage = Phaser.Math.Clamp(this.deckPage, 0, pages - 1);
    // A Darlings deck's face is always its Darling (toggleDeckHero refuses
    // there), so the hero star column would be a row of controls that do
    // nothing. The unavailable-card marker still shows.
    const heroEditable = this.activeFormat() !== 'darlings';
    const pageRows = layout.pages[this.deckPage];
    const pageEntries = pageRows.map((row) => entries[row.index]);
    this.paneRowCards = pageEntries.filter((entry) => CARD_DB[entry.cardId] !== undefined).map((entry) => entry.cardId);
    pageEntries.forEach((entry, i) => {
      const d = CARD_DB[entry.cardId];
      if (!this.isReserveFormat() && BASIC_LAND_IDS.includes(entry.cardId as BasicLandId)) {
        this.renderConstructedBasicRow(entry.cardId as BasicLandId, pageRows[i].y);
        return;
      }
      // All row elements center on one line (design-system alignment rule:
      // icons align to the optical center of the adjacent text).
      const cy = pageRows[i].y;
      const rowPitch = profile.rowPitch;
      const starGlyph = !d ? '!' : !heroEditable ? '' : heroId === entry.cardId ? '★' : '☆';
      const star = this.add
        .text(x0, cy, starGlyph, {
          fontFamily: theme.fonts.ui,
          fontSize: DECK_PANE_LAYOUT.cards.starSize + 'px',
          fontStyle: '700',
          color: d ? heroId === entry.cardId ? theme.colors.goldHover : theme.colors.muted : theme.colors.danger,
        })
        .setOrigin(0, 0.5);
      if (d && heroEditable) {
        star.setInteractive({ useHandCursor: true });
        bindTapButton(this, star, () => this.toggleDeckHero(entry.cardId));
        // 44 wide so a near-miss lands on the star (hero toggle), never on
        // the remove row behind it (owner finding 2026-08-18).
        inflateHitArea(star, 44, rowPitch);
      }
      const hasPinnedDisplay = d && this.hasPinnedDisplay(entry.cardId, entry.hasLegacyVariantPin);
      const pinSize = uiIconSize(DECK_PANE_LAYOUT.cards.pinSize);
      const marker = this.add
        .image(x0 + (this.touch ? 27 : 24), cy, bakeUiIcon(this, 'pin'))
        .setDisplaySize(pinSize, pinSize)
        .setTint(colorInt(theme.colors.gold))
        .setOrigin(0, 0.5)
        .setVisible(Boolean(hasPinnedDisplay));
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
      fitMenuName(row, nameWidth, Number.POSITIVE_INFINITY);
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
        inflateHitArea(row, cardsLayout.nameWidth, rowPitch, { biasX: rowHitBias });
        if (d) this.zoom.attach(row, d, variant);
        row.on('pointerover', () => {
          row.setColor(theme.colors.danger);
          inflateHitArea(row, cardsLayout.nameWidth, rowPitch, { biasX: rowHitBias });
        });
        row.on('pointerout', () => {
          row.setColor(d ? theme.colors.body : theme.colors.danger);
          inflateHitArea(row, cardsLayout.nameWidth, rowPitch, { biasX: rowHitBias });
        });
        bindTapButton(this, row, (p) => this.removeCardAt(entry.firstIndex, p));
      }
      this.rightPane.push(star, marker, row);
      if (quantity) this.rightPane.push(quantity);
      if (this.touch) {
        const minus = themedButton(this, PANEL_RIGHT_X - 45, cy, '−', {
          variant: 'danger',
          size: 'sm',
          minWidth: 90,
          onTap: (p) => this.removeCardAt(entry.firstIndex, p),
        });
        this.rightPane.push(minus.container);
      }
    });
    if (pages > 1) {
      // The fullest page's last row, so the pager holds still across pages.
      const lastRowBottom = Math.max(...layout.pages.map((page) => {
        const last = page[page.length - 1];
        return last ? last.y + Math.max(last.height, profile.rowPitch) / 2 : listY0;
      }));
      this.renderDeckPagers(pages, lastRowBottom);
    }
  }

  /**
   * The repair flow used to be a panel drawn over the stats block, which took
   * the mana curve and color balance off screen for any deck one card short of
   * legal, i.e. for most of the time you spend building one (player report
   * 2026-08-25). The blocking issues are status-band lines now, and this modal
   * (reached from the CTA row, in Save Deck's slot while there is nothing to
   * save) carries the full list plus the bulk action a migration repair needs.
   */
  private showRepairModal(blocking: ReturnType<typeof validateDeck>): void {
    if (blocking.length === 0) return;
    this.closeFilterPanel();
    const lands = this.isReserveFormat()
      ? this.deck.filter((id) => CARD_DB[id] && isType(CARD_DB[id], 'land')).length
      : 0;
    const lines = blocking.map((issue) => `• ${issue.message}`).join('\n');
    const issuesText = this.add.text(0, 0, lines, { fontFamily: theme.fonts.ui, fontSize: theme.type.label,
      color: theme.colors.danger, wordWrap: { width: 500 }, lineSpacing: theme.space(1.5) });
    const lineCount = Math.max(1, issuesText.getWrappedText().length);
    const lineHeight = (issuesText.height - (lineCount - 1) * issuesText.lineSpacing) / lineCount;
    const linePitch = lineHeight + issuesText.lineSpacing;
    const footerHeight = theme.control.minHitHeight + (lands > 0 ? theme.control.minHitHeight + theme.space(3) : 0);
    const headingHeight = menuLineHeight(theme.type.caption) + theme.space(3);
    const overhead = menuNoticeLayout(560, menuLineHeight(theme.type.h2), headingHeight).height + footerHeight - theme.control.minHitHeight;
    const available = theme.design.safeHeight - overhead;
    const visibleHeight = Math.min(issuesText.height, Math.floor((available + issuesText.lineSpacing) / linePitch) * linePitch - issuesText.lineSpacing);
    const height = overhead + visibleHeight;
    const shell = modalShell(this, {
      width: 560,
      height,
      footerTrackHeight: footerHeight,
      dimAlpha: 0.52,
      depth: theme.depth.results,
      dismissal: 'esc-only',
    });
    const modal = shell.container;
    const top = 360 - height / 2;
    // Named as the deck lists name it: a deck still being built is not
    // playable yet; only one a rules change broke asks for a repair. The list
    // below is the builder's working deck, which is the saved one while this
    // modal can open (Save Deck takes the slot whenever anything is unsaved).
    const kind = deckBlockKind(
      {
        format: this.activeFormat(),
        cards: this.deck,
        landReserve: this.landReserve,
        darlingId: this.activeDarlingId(),
      },
      true,
      this.classicRetired,
    );
    modal.add(
      this.add
        .text(640, top + 42, kind === 'unfinished' ? deckBlockLabel(kind) : 'Repair Deck', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    modal.add(
      this.add
        .text(
          640,
          shell.contentBounds.y + menuLineHeight(theme.type.caption) / 2,
          `${blocking.length} blocking ${blocking.length === 1 ? 'issue keeps' : 'issues keep'} this deck out of a duel.`,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
          },
        )
        .setOrigin(0.5),
    );
    const viewport = { x: shell.contentBounds.x, y: shell.contentBounds.y + headingHeight,
      width: shell.contentBounds.width, height: visibleHeight };
    issuesText.setPosition(viewport.x, 0).setData('a11yFullText', lines).setData('a11yWholeLines', { lineHeight, linePitch });
    const content = this.add.container(0, 0, [issuesText]);
    modal.add(content);
    bindMenuScroll(this, content, viewport, issuesText.height, undefined, undefined, linePitch, shell);
    const ctaY = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height - theme.control.minHitHeight / 2;
    // Every classic deck migrated into a reserve format arrives carrying its
    // whole mana base, which is exactly the cards the format no longer wants.
    // Removing them one row at a time is not the "couple of clicks" the repair
    // flow promises, so offer the bulk action the situation always needs.
    if (lands > 0) {
      const strip = themedButton(
        this,
        640,
        ctaY - 56,
        `Remove ${lands} land${lands === 1 ? '' : 's'} from the deck list`,
        {
          variant: 'danger',
          minWidth: 320,
          onTap: () => {
            shell.close();
            this.removeAllLands();
          },
        },
      );
      modal.add(strip.container);
    }
    const close = themedButton(this, 640, ctaY, 'Back to editing', {
      variant: 'primary',
      minWidth: 180,
      onTap: () => shell.close(),
    });
    modal.add(close.container);
  }

  /** Drop every land from the deck list: the one-tap half of a migration repair. */
  private removeAllLands(): void {
    const lands = [...new Set(this.deck.filter((id) => CARD_DB[id] && isType(CARD_DB[id], 'land')))];
    if (lands.length === 0) return;
    let next = { cards: this.deck, variantPins: this.variantPins };
    for (const id of lands) next = removeAllDeckSlots(next, id);
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    const active = this.activeSavedDeck();
    if (active?.heroCardId && !this.deck.includes(active.heroCardId)) active.heroCardId = null;
    this.statusMessage = null;
    this.renderPool();
    this.renderDeck();
  }

  private renderDeck(): void {
    this.statusScroll?.remove(this.status);
    this.statusScroll?.destroy();
    this.statusScroll = null;
    for (const c of this.rightPane) c.destroy();
    this.rightPane = [];
    this.paneThumbArt = [];
    this.paneRowCards = [];
    const x0 = PANEL_LEFT_X;

    const active = this.activeSavedDeck();
    const format = this.activeFormat();
    const hasWarchest = format !== 'constructed';
    this.deckPaneMode = resolveDeckPaneMode(this.deckPaneMode, hasWarchest);
    const reserveIssues = hasWarchest
      ? validateLandReserve(CARD_DB, this.save, this.landReserve)
      : [];
    const issues = this.currentIssues();
    const blocking = issues.filter((issue) => issue.kind === 'error');
    const saveCta = deckSaveCta({
      hasSavedRecord: active !== null,
      dirty: this.hasUnsavedDeckEdits(),
      blockingCount: blocking.length,
    });
    // The title row sits on the shared header line (deckPanePresentation.ts).
    const titleLayout = DECK_PANE_LAYOUT.title;
    const darlingId = this.activeDarlingId();
    const deckTitleX = format === 'darlings' && active && darlingId ? x0 + 46 : x0;
    // The title reads "name ✎ count": the pencil takes the old " · "
    // separator's place, so it sits right by the name (owner request
    // 2026-10-10) without costing the row any width. The name, the pencil and
    // the count all open the rename prompt; with no saved deck there is
    // nothing to rename, and the separator stays.
    const renameId = active ? active.id : null;
    const titleColor = this.deck.length === formatDeckSize(format) ? theme.colors.success : theme.colors.gold;
    const titleStyle = { fontFamily: theme.fonts.display, fontSize: theme.type.h2 + 'px', color: titleColor };
    const countText = this.add.text(0, 0, `${renameId ? '' : '· '}${this.deck.length}/${formatDeckSize(format)}`, titleStyle).setOrigin(0, 0.5);
    const pencilSize = titleLayout.renameIconSize;
    const gap = theme.space(1.5);
    const tailWidth = (renameId ? pencilSize + gap * 2 : gap) + countText.width;
    const title = this.add.text(deckTitleX, titleLayout.y, active?.name ?? 'Custom Deck', titleStyle).setOrigin(0, 0.5);
    fitMenuName(title, PANEL_RIGHT_X - 100 - deckTitleX - tailWidth, Number.POSITIVE_INFINITY);
    this.headerLayout = deckPaneHeaderLayout(title.height);
    title.setY(this.headerLayout.titleY);
    // The pencil and the count follow the name's last line.
    const lines = title.getWrappedText();
    const lineMeasure = this.add.text(0, 0, lines[lines.length - 1] ?? '', titleStyle).setVisible(false);
    const lastLineWidth = lineMeasure.width;
    lineMeasure.destroy();
    const lastLineY = title.y + title.height / 2 - title.height / Math.max(1, lines.length) / 2;
    let tailX = deckTitleX + lastLineWidth + gap;
    if (renameId) {
      const rename = (): void => this.promptRename(renameId, () => this.renderDeck());
      const pencil = this.add.image(tailX + pencilSize / 2, lastLineY, bakeUiIcon(this, 'pencil'))
        .setDisplaySize(pencilSize, pencilSize)
        .setTint(colorInt(titleColor))
        .setAlpha(theme.alpha.chrome);
      // The pencil's own hit band meets the hit-width floor; it reaches back
      // over the name, which renames too, and never forward toward ☰ Decks.
      const pencilHit = this.add
        .zone(tailX + pencilSize - titleLayout.renameHitWidth / 2, lastLineY, titleLayout.renameHitWidth, theme.control.minHitHeight)
        .setInteractive({ useHandCursor: true });
      pencilHit.on('pointerover', () => pencil.setAlpha(1));
      pencilHit.on('pointerout', () => pencil.setAlpha(theme.alpha.chrome));
      bindTapButton(this, pencilHit, rename);
      for (const target of [title, countText]) {
        target.setInteractive({ useHandCursor: true });
        bindTapButton(this, target, rename);
      }
      this.rightPane.push(pencil, pencilHit);
      tailX += pencilSize + gap;
    }
    countText.setPosition(tailX, lastLineY);
    this.rightPane.push(countText);
    const stats = computeDeckStats(this.deck, CARD_DB);
    const summaryMeasure = this.add.text(0, 0, deckCountsLine(stats, hasWarchest
      ? { kind: 'warchest', filled: this.landReserve.length, size: LAND_RESERVE_SIZE } : { kind: 'list' }), {
      fontFamily: theme.fonts.ui, fontSize: theme.type.caption, wordWrap: { width: 360, useAdvancedWrap: true } }).setVisible(false);
    this.summaryLayout = deckPaneSummaryLayout({ summaryHeight: menuLineHeight(theme.type.caption) + theme.space(1) + summaryMeasure.height });
    summaryMeasure.destroy();
    this.rightPane.push(title);
    if (format === 'darlings' && active && darlingId && CARD_DB[darlingId]) {
      // The portrait beside the title IS the Darling indicator, and tapping
      // it (or the active Darlings tab) reopens the chooser. The old
      // 'Darling' text label under the title collided with the Format row
      // (owner finding 2026-08-18) and said nothing the tab does not.
      const portrait = this.paneThumb(
        titleLayout.portraitX,
        this.headerLayout.titleY,
        CARD_DB[darlingId],
        titleLayout.portraitScale,
        undefined,
        this.ownedVariantFor(darlingId),
      );
      const portraitHit = this.add
        .zone(titleLayout.portraitX, this.headerLayout.titleY, titleLayout.portraitHitWidth, titleLayout.portraitHitHeight)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, portraitHit, () => this.openDarlingsFormat());
      this.rightPane.push(portrait, portraitHit);
    }
    const formatSwitchVisible = this.reserveFormatsEnabled &&
      visibleBuilderFormatTabs(
        offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired),
      ).length >= 2;
    if (formatSwitchVisible) this.renderFormatSwitch(x0, format);
    const paneLift = (hasWarchest ? deckPaneOffsetY(formatSwitchVisible) : 0) + DECK_PANE_LAYOUT.content.top - this.headerLayout.contentTop;
    if (hasWarchest) this.renderDeckPaneToggle(reserveIssues.length, paneLift);
    // F15: deck picker (switch / new / copy / rename / delete).
    const decksBtn = themedButton(this, DECK_PANE_LAYOUT.decks.x, this.headerLayout.titleY, '☰ Decks', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: DECK_PANE_LAYOUT.decks.minWidth,
      onTap: () => this.showDeckPicker(),
    });
    this.rightPane.push(decksBtn.container);

    // Constructed: the list starts below the basics block (deckPanePresentation.ts).
    let deckListY0 = this.headerLayout.formatY + theme.control.minHitHeight / 2 + theme.space(2);
    if (hasWarchest) {
      deckListY0 = DECK_PANE_LAYOUT.content.top + DECK_PANE_LAYOUT.content.listInset - paneLift;
      if (this.deckPaneMode === 'warchest') this.renderReservePanel(format, paneLift);
    } else {
      // Touch keeps the pre-feature five-row block. Desktop carries an inline
      // preview and selector on each row. Both start where the Format tabs'
      // hit band ends (touch rows started at y 78, under the tabs, before 1.8.1).

    }

    if (this.deckPaneMode === 'style') {
      this.renderStylePanel(paneLift);
    } else if (this.deckPaneMode === 'cards') {
      const heroId = this.deckHeroId();
      // Keep the desktop/touch preferred count. Measured wrapped rows can
      // reduce a page only when the remaining list track cannot hold them.
      this.renderDeckRows(x0, heroId, deckListY0);
      // The curve and the color balance are what you build a deck BY, so they
      // stay on screen through every invalid intermediate state. Blocking
      // issues speak through the status band and the CTA row below.
      this.renderDeckStats(x0);
    }

    // validation + save
    const message = this.statusMessage;
    const issueLines = issues
      .slice(0, message ? 1 : 2)
      .map((i) => `${i.kind === 'error' ? '✕' : '⚠'} ${i.message}`);
    const statusLines = message ? [message.text, ...issueLines] : issueLines;
    // Two lines in every view: the status band is the only error surface now,
    // and one line clipped the first issue mid-sentence.
    this.status.setMaxLines(0);
    this.status.setColor(
      deckStatusTone(message, blocking.length > 0) === 'success' ? theme.colors.success : theme.colors.danger,
    );
    this.status.setText(statusLines.join('\n')).setPosition(x0, 0);
    this.status.setData('a11yFullText', this.status.text);
    const lineHeight = this.status.height / Math.max(1, this.status.getWrappedText().length);
    this.status.setData('a11yWholeLines', { lineHeight, linePitch: lineHeight });
    const statusHeight = Math.min(this.status.height, lineHeight * 2);
    this.statusScroll = this.add.container(0, 0, [this.status]);
    bindMenuScroll(this, this.statusScroll, { x: x0, y: this.summaryLayout.statusBottomY - statusHeight,
      width: 360, height: statusHeight }, this.status.height, undefined, undefined, lineHeight);
    // Bottom action row: Export left-aligned to the x0 gutter, Import
    // right-aligned to the panel gutter (the old x0+334 center clipped it
    // off-screen), Save centered between them on the same baseline.
    const cta = DECK_PANE_LAYOUT.cta;
    const exportBtn = themedButton(this, x0 + 84, this.summaryLayout.secondaryCtaY, 'Export Code', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: cta.sideMinWidth,
      onTap: () => this.exportDeckCode(),
    });
    const importBtn = themedButton(this, PANEL_RIGHT_X - 84, this.summaryLayout.secondaryCtaY, 'Import Code', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: cta.sideMinWidth,
      onTap: () => this.importDeckCode(),
    });
    // Save Deck always works, so it is offered whenever there is something to
    // save. A saved deck with nothing unsaved that still cannot be played gets
    // the repair list in its place (deckSaveCta).
    const saveBtn = saveCta === 'save'
      ? themedButton(this, cta.saveX, DECK_PANE_LAYOUT.summary.ctaY, 'Save Deck', {
        variant: 'primary',
        minWidth: cta.saveMinWidth,
        onTap: () => {
          this.saveWorkingDeck();
          if (this.statusMessage) {
            // Saved, but not playable yet: the band says so, and the CTA
            // becomes the repair list.
            this.renderDeck();
            return;
          }
          saveBtn.setLabel('Saved ✓');
          this.time.delayedCall(900, () => {
            if (saveBtn.container.active) saveBtn.setLabel('Save Deck');
          });
        },
      })
      : themedButton(this, cta.saveX, DECK_PANE_LAYOUT.summary.ctaY, `⚠ Fix Deck (${blocking.length})`, {
        variant: 'danger',
        minWidth: cta.saveMinWidth,
        onTap: () => this.showRepairModal(blocking),
      });
    this.rightPane.push(exportBtn.container, importBtn.container, saveBtn.container);
    // The pane's thumbnails lease their art at `visible`. The deck-list rows
    // draw no art, but hovering one opens the zoom, so the open page's cards
    // are prefetched at `soon`: the zoom then opens on the half texture.
    this.paneArt?.show(this.paneThumbArt, this.paneRowCards);
  }

  private exportDeckCode(): void {
    const errors = this.currentIssues().filter((issue) => issue.kind === 'error');
    if (errors.length > 0) {
      this.statusMessage = { text: `Export blocked: ${errors[0].message}`, tone: 'danger' };
      this.renderDeck();
      return;
    }

    // A Standard or Darlings code carries the Warchest, and a Darlings code
    // her Darling, so the code rebuilds the whole deck.
    const code = encodeDeck(deckCodeDeckFor({ ...this.openDeckTarget(), cards: this.deck }));
    this.showDeckCodeOverlay('export', code);
  }

  /**
   * An import replaces the open deck, so it asks first whenever that would
   * drop unsaved work (D10), before the code box opens: the box is a DOM
   * element, which no canvas prompt can sit above.
   */
  private importDeckCode(): void {
    this.confirmUnsavedChanges('import', () => this.showDeckCodeOverlay('import'));
  }

  private applyDeckCodeImport(input: string, renderOnFailure = true): boolean {
    const decoded = decodeDeck(input, DECK_CODE_CARD_IDS);
    if (!decoded.ok) {
      this.statusMessage = { text: `Import failed: ${deckCodeErrorMessage(decoded.error)}`, tone: 'danger' };
      if (renderOnFailure) this.renderDeck();
      return false;
    }

    let plan: ReturnType<typeof planDeckCodeImport>;
    try {
      plan = planDeckCodeImport(
        decoded,
        { ...this.openDeckTarget(), hasSavedRecord: this.activeSavedDeck() !== null },
        { offered: offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired), classicRetired: this.classicRetired },
        (target, cards) => this.issuesFor(target, cards),
      );
    } catch {
      this.statusMessage = { text: 'Import failed: that code contains an unknown card.', tone: 'danger' };
      if (renderOnFailure) this.renderDeck();
      return false;
    }
    if (!plan.ok) {
      this.statusMessage = { text: `Import rejected: ${plan.reason}`, tone: 'danger' };
      if (renderOnFailure) this.renderDeck();
      return false;
    }

    // Everything the import writes is working state: the list, the Warchest,
    // and the format and Darling beside them. The saved record is never
    // touched, so no flush can write half an import (a tab switch flushes the
    // whole save), Save Deck keeps it, and Discard Changes or leaving without
    // saving drops it.
    const working = importedWorkingState(plan);
    this.workingFormat = working.format;
    this.workingDarlingId = working.darlingId;
    this.landReserve = [...working.landReserve];
    this.deck = [...working.cards];
    this.variantPins = [...working.variantPins];
    this.deckPage = 0;
    this.statusMessage = { text: 'Deck code imported. Save Deck to keep it.', tone: 'success' };
    this.renderPool();
    this.renderDeck();
    return true;
  }

  private showDeckCodeOverlay(mode: 'export' | 'import', code = ''): void {
    this.closeFilterPanel();
    this.closeDeckCodeOverlay();
    this.zoom.setSuppressed(true);
    this.setSearchInputVisible(false);
    const intro = this.add.text(0, 0,
      mode === 'export' ? 'Copy this code to share the current deck.' : 'Paste a deck code, then import it into the editor.',
      { fontFamily: theme.fonts.ui, fontSize: theme.type.label, color: theme.colors.body,
        align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5, 0);
    const inputHeight = Math.max(92, menuLineHeight(theme.type.label) * 4);
    const bodyHeight = intro.height + theme.space(3) + inputHeight + theme.space(3) + 3 * menuLineHeight(theme.type.caption);
    const deckCodeShell = modalShell(this, {
      ...menuNoticeLayout(720, menuLineHeight(theme.type.h2), bodyHeight),
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      dismissal: 'esc-only',
      onClose: () => {
        this.deckCodeOverlay = null;
        this.setSearchInputVisible(true);
        this.zoom.setSuppressed(false);
      },
    });
    const overlay = deckCodeShell.container;
    this.deckCodeOverlay = overlay;

    overlay.add(
      this.add
        .text(640, deckCodeShell.tracks.titleTrack.y + deckCodeShell.tracks.titleTrack.height / 2, mode === 'export' ? 'Export Deck Code' : 'Import Deck Code', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    intro.setPosition(640, deckCodeShell.contentBounds.y);
    overlay.add(intro);
    const inputTop = intro.y + intro.height + theme.space(3);
    const noteTop = inputTop + inputHeight + theme.space(3);
    const footerY = deckCodeShell.tracks.footerTrack.y + deckCodeShell.tracks.footerTrack.height / 2;
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.readOnly = mode === 'export';
    textarea.spellcheck = false;
    textarea.placeholder = 'Paste deck code here...';
    textarea.setAttribute(
      'style',
      [
        'width:620px',
        `height:${inputHeight}px`,
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
    const dom = this.add.dom(640, inputTop + inputHeight / 2, textarea).setOrigin(0.5);
    overlay.add(dom);

    const note = this.add
      .text(640, noteTop, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        align: 'center', wordWrap: { width: 620 },
      })
      .setOrigin(0.5, 0);
    overlay.add(note);

    if (mode === 'export') {
      const copyBtn = themedButton(this, 560, footerY, 'Copy Code', {
        variant: 'primary',
        minWidth: 120,
        onTap: () => {
          void this.copyDeckCode(code, textarea, note);
        },
      });
      const closeBtn = themedButton(this, 720, footerY, 'Close', {
        variant: 'ghost',
        minWidth: 100,
        onTap: () => this.closeDeckCodeOverlay(),
      });
      overlay.add([copyBtn.container, closeBtn.container]);
    } else {
      const importBtn = themedButton(this, 560, footerY, 'Import', {
        variant: 'primary',
        minWidth: 100,
        onTap: () => {
          if (this.applyDeckCodeImport(textarea.value, false)) {
            this.closeDeckCodeOverlay();
            return;
          }
          // The overlay's note owns this failure. Left in the status band it
          // resurfaced at the next re-render, long after Cancel.
          note.setText(this.statusMessage?.text ?? '').setColor(theme.colors.danger);
          this.statusMessage = null;
        },
      });
      const cancelBtn = themedButton(this, 720, footerY, 'Cancel', {
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
      this.statusMessage = { text: 'Deck code copied.', tone: 'success' };
      this.renderDeck();
    } catch {
      if (note.active) note.setText('Copy failed. Select the code and copy it manually.').setColor(theme.colors.danger);
    }
  }
}
