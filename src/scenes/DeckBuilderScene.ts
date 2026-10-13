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
import { CARD_H, CARD_W, CardView } from '../ui/CardView';
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
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import { currentAccessibility } from '../ui/accessibility';
import { COMPACT, compactShell } from '../ui/compactLayout';
import {
  COMPACT_DRAG_SLOP,
  compactButton,
  compactDialog,
  compactIconButton,
  compactSegments,
  coverFitImage,
  type CompactButton,
} from '../ui/compactWidgets';
import {
  BUILDER_COMPACT,
  builderFoot,
  builderTopBar,
  cardsColumn,
  curveLayout,
  darlingSplit,
  deckRowDetail,
  decksScreen,
  poolChips,
  poolFilterLayout,
  poolGrid,
  poolHeight,
  poolHitAt,
  splitDarlingName,
  stackedRowAt,
  tileGrid,
  warchestMain,
  type BuilderTopBar,
} from '../ui/deckBuilderCompact';
import { themedButtonColors, type ThemedButtonVariant } from '../ui/controlStyle';
import { ellipsizeText } from '../ui/textFit';
import { ensureNumeralPip, pipsFor } from '../ui/ManaSymbols';
import { cardGlossaryEntries, rulesText, typeLine } from '../ui/rulesText';
import { rarityLine } from '../ui/CardZoomPreview';
import { addPortraitArt } from '../ui/portraitArt';
import type { Rect } from '../ui/layout';
import type { MenuScrollHandle } from '../ui/menuScroll';
import {
  CARD_BACKS,
  DEFAULT_CARD_BACK_ID,
  DEFAULT_PLAYMAT_ID,
  isCosmeticOwned,
  PLAYMATS,
  playmatForId,
  type CardBackDefinition,
  type PlaymatDefinition,
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
  type CollapsedDeckRow,
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

/** One pool facet, as both the desktop popover and the phone's filter column draw it. */
interface PoolFilterFacet {
  name: 'set' | 'color' | 'type' | 'rarity' | 'sort';
  label: string;
  options: DropdownOption<string>[];
  get: () => string;
  set: (value: string) => void;
}

/** A held press on a card (the phone builder): held still for BUILDER_COMPACT.holdMs, it inspects instead of acting. */
interface CompactHold {
  pointerId: number;
  x: number;
  y: number;
  fired: boolean;
  timer: Phaser.Time.TimerEvent;
}

/** What has taken over the phone builder's column: the pool's filters (or one facet's choices), or a Warchest slot's lands. */
type CompactTakeover =
  | { kind: 'filters'; facet: PoolFilterFacet['name'] | null }
  | { kind: 'slot'; index: number };

/** A sheet over the phone builder's main pane and top bar, beside a column of its own. */
interface CompactSheet {
  kind: 'inspect' | 'code' | 'darling' | 'cosmetic' | 'landStyles';
  container: Phaser.GameObjects.Container;
  drawColumn: (layer: Phaser.GameObjects.Container, column: Rect) => void;
  /** A DOM field in the sheet (the deck code), shown while no dialog covers it. */
  dom: Phaser.GameObjects.DOMElement | null;
  onClose: (() => void) | null;
}

/** The phone builder's parts and state (mobile wave 2). */
interface CompactBuilderUi {
  content: Rect;
  main: Rect;
  column: Rect;
  largeText: boolean;
  bar: BuilderTopBar;
  header: Phaser.GameObjects.Container | null;
  mainLayer: Phaser.GameObjects.Container | null;
  columnLayer: Phaser.GameObjects.Container | null;
  /** Your Decks, while it is open over the builder. */
  decks: {
    container: Phaser.GameObjects.Container | null;
    scroll: MenuScrollHandle | null;
    previewId: string | null;
    listOffset: number;
    focus: boolean;
  } | null;
  /** The pool search in the top bar, or folded into the filter column (the largest text). */
  search: SearchInputHandle | null;
  searchFold: SearchInputHandle | null;
  /** Dialogs open over the builder; the DOM fields hide while any is. */
  dialogs: number;
  poolScroll: MenuScrollHandle | null;
  poolOffset: number;
  listScroll: MenuScrollHandle | null;
  listOffset: number;
  /** A card the deck list scrolls to once (a dev fixture's focus). */
  focusList: string | null;
  takeover: CompactTakeover | null;
  takeoverScroll: MenuScrollHandle | null;
  takeoverOffset: number;
  sheet: CompactSheet | null;
  hold: CompactHold | null;
  saveButton: CompactButton | null;
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
  /** The phone layout's parts, while the builder is drawn compact. */
  private compactUi: CompactBuilderUi | null = null;

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
    // A phone draws the Version C builder instead (mocks D-Cards to D-Unsaved).
    if (sceneStage(this).compact) {
      this.buildCompact(data);
      return;
    }
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
    if (this.compactUi) {
      // A new filter starts the phone's grid from the top.
      this.compactUi.poolScroll = null;
      this.compactUi.poolOffset = 0;
    }
    this.renderPool();
    this.syncFilterButton();
  }

  private toggleFilterPanel(): void {
    if (this.filterPanel) this.closeFilterPanel();
    else this.openFilterPanel();
  }

  private openFilterPanel(): void {
    const ui = this.compactUi;
    if (ui) {
      // The filters take over the column (D-PoolFilters) and act on the Cards view's pool.
      if (this.deckPaneMode !== 'cards') this.setCompactMode('cards');
      ui.takeover = { kind: 'filters', facet: null };
      ui.takeoverScroll = null;
      ui.takeoverOffset = 0;
      this.syncCompactDom();
      this.renderCompactHeader();
      this.renderCompactColumn();
      return;
    }
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

    this.poolFilterFacets().forEach((facet, i) => {
      const dd = new Dropdown<string>(this, f.x + f.inset, 158 + i * 52, {
        label: facet.label,
        options: facet.options,
        value: facet.get(),
        minW: 228,
        maxValueWidth: 120,
        onSelect: (v) => {
          facet.set(v);
          this.applyPoolFilterChange();
        },
        onOpen: () => this.closeFilterDropdownsExcept(dd),
      });
      dd.setDepth(81);
      this.filterDropdowns.push(dd);
      this.filterDropdownRefreshers.push(() => dd.setValue(facet.get()));
    });

    const reset = themedButton(this, f.x + f.inset + 132 / 2, 588, 'Reset Filters', {
      variant: 'emphasis',
      size: 'sm',
      minWidth: 132,
      onTap: () => this.resetPoolFilters(),
    });
    panel.add(reset.container);

    this.syncFilterButton();
  }

  /**
   * The pool's facets: Set, Color, Type, Rarity and Sort, each with its
   * options and how to read and write it. The desktop popover's dropdowns and
   * the phone's filter column both draw these.
   */
  private poolFilterFacets(): PoolFilterFacet[] {
    const state = (): CollectionFilterState => this.filterState;
    const facet = <T extends string>(name: PoolFilterFacet['name'], label: string, options: DropdownOption<T>[],
      get: () => T, set: (v: T) => void): PoolFilterFacet => ({
      name, label, options, get, set: (v) => set(v as T),
    });
    return [
      // Derived from SET_IDS (never a hand-written copy — the binder filter
      // silently omitted two releases that way) and liveness-gated so an
      // unreleased set never shows as an empty option.
      facet<CollectionFilterState['set']>('set', 'Set', [
        { value: 'all', label: 'All sets' },
        ...SET_IDS.filter(isLiveSet).map((id) => ({ value: id, label: SET_TITLES[id] })),
      ], () => state().set, (v) => { state().set = v; }),
      facet<Color | 'all'>('color', 'Color', [
        { value: 'all', label: 'All' },
        { value: 'W', label: 'White' },
        { value: 'U', label: 'Blue' },
        { value: 'B', label: 'Black' },
        { value: 'R', label: 'Red' },
        { value: 'G', label: 'Green' },
      ], () => state().color, (v) => { state().color = v; }),
      // A reserve-format pool holds no lands (they live in the Warchest), so a
      // Land facet there could only ever empty the grid.
      facet<CardType | 'all'>('type', 'Type', [
        { value: 'all', label: 'All' },
        { value: 'creature', label: 'Creature' },
        { value: 'charm', label: 'Charm' },
        { value: 'ritual', label: 'Ritual' },
        { value: 'enchantment', label: 'Enchantment' },
        { value: 'artifact', label: 'Artifact' },
        ...(this.isReserveFormat() ? [] : [{ value: 'land' as const, label: 'Land' }]),
      ], () => state().type, (v) => { state().type = v; }),
      facet<Rarity | 'all'>('rarity', 'Rarity', [
        { value: 'all', label: 'All' },
        { value: 'c', label: TIER_LABEL.c },
        { value: 'r', label: TIER_LABEL.r },
        { value: 'sr', label: TIER_LABEL.sr },
        { value: 'ssr', label: TIER_LABEL.ssr },
        { value: 'ur', label: TIER_LABEL.ur },
      ], () => state().rarity, (v) => { state().rarity = v; }),
      facet<SortMode>('sort', 'Sort', [
        { value: 'rarity', label: SORT_LABEL.rarity },
        { value: 'mana', label: SORT_LABEL.mana },
        { value: 'name', label: SORT_LABEL.name },
      ], () => state().sort, (v) => { state().sort = v; }),
    ];
  }

  private closeFilterDropdownsExcept(keep: Dropdown<string>): void {
    for (const dd of this.filterDropdowns) if (dd !== keep) dd.close();
  }

  private closeFilterPanel(): void {
    const ui = this.compactUi;
    if (ui) {
      if (ui.takeover?.kind !== 'filters') return;
      ui.takeover = null;
      this.syncCompactDom();
      this.renderCompactHeader();
      this.renderCompactColumn();
      return;
    }
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
    if (this.compactUi) {
      for (const field of [this.compactUi.search, this.compactUi.searchFold]) if (field) field.inputElement.value = value;
      return;
    }
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
    if (this.compactUi) {
      // The filter chip's count, and the facets' values when the column shows them.
      this.renderCompactHeader();
      if (this.compactUi.takeover?.kind === 'filters') this.renderCompactColumn();
      return;
    }
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
    if (this.compactUi) {
      this.renderCompactMain();
      return;
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
    if (this.compactUi) {
      this.confirmUnsavedCompact(path, proceed);
      return;
    }
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
    if (this.compactUi) {
      this.openCompactLandStyles();
      return;
    }
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
    const ui = this.compactUi;
    if (ui) {
      ui.dialogs += 1;
      this.syncCompactDom();
    }
    const release = (): void => {
      if (ui) this.releaseCompactDialog(ui);
    };
    const tutorial = showDarlingsTutorial(this, {
      onDismiss: () => {
        release();
        this.showDarlingPicker();
      },
      onReadMore: () => this.scene.start('Glossary', {
        focus: 'Darlings',
        returnTo: { scene: 'DeckBuilder', data: { deckId: this.activeSavedDeck()?.id } },
      }),
    });
    if (!tutorial) {
      release();
      this.showDarlingPicker();
    }
  }

  private showDarlingPicker(): void {
    if (this.compactUi) {
      this.openCompactDarlingPicker();
      return;
    }
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
      if (this.chooseDarling(id)) shell.close();
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

  /**
   * Make `id` the working deck's Darling. The chooser only opens with nothing
   * unsaved (openDarlingsFormat asks first), so the working deck is the saved
   * one and the pick is saved with it: she leaves the list, and the record
   * takes both. False when the deck is not a saved Darlings deck.
   */
  private chooseDarling(id: string): boolean {
    const active = this.activeSavedDeck();
    if (!active || this.activeFormat() !== 'darlings') return false;
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
    return true;
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
    const ui = this.compactUi;
    if (ui) {
      // The slot's lands take over the column (D-WarchestSlot); the slot stays lit in the centre.
      this.deckPaneMode = 'warchest';
      ui.takeover = { kind: 'slot', index };
      ui.takeoverScroll = null;
      ui.takeoverOffset = 0;
      this.syncCompactDom();
      this.renderCompactHeader();
      this.renderCompactMain();
      this.renderCompactColumn();
      return;
    }
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
    if (this.compactUi) {
      this.openCompactCosmetic(kind);
      return;
    }
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
    if (this.compactUi) {
      this.openCompactDecks(focusDeckId);
      return;
    }
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
      this.useDeck(id);
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
      setActiveDeck(this.createNewDeck(format));
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

  /**
   * Make the deck being edited `id` (or none): the working copy, its
   * baseline and the view follow it. Dirty tracking follows the deck actually
   * being edited, which is the working deck rather than the saved active id
   * (they diverge when a hidden reserve deck is still the save's active deck).
   */
  private useDeck(id: string | null): void {
    const save = this.save;
    save.activeDeckId = id;
    this.loadWorkingDeck(save.decks.find((d) => d.id === id) ?? null);
    this.deckPaneMode = defaultDeckPaneMode();
    if (this.compactUi) this.compactUi.listOffset = 0;
    this.flush();
    this.renderPool();
    this.renderDeck();
  }

  /** A new, empty deck in `format`, saved; returns its id. */
  private createNewDeck(format: BuilderFormat): string {
    const save = this.save;
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
    return id;
  }

  private showNewDeckFormatPrompt(onChoose: (format: BuilderFormat) => void): void {
    const formats = offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired);
    if (this.compactUi) {
      // D-NewDeck: the formats as choice rows, each with what it asks for.
      const caption: Record<BuilderFormat, string> = {
        warchest: `${formatDeckSize('warchest')} spells · a Warchest of ${LAND_RESERVE_SIZE} lands`,
        darlings: `${formatDeckSize('darlings')} cards in her colors · one of each`,
        constructed: `${formatDeckSize('constructed')} cards · lands in the list`,
      };
      this.compactNotice({
        title: 'Choose a format',
        message: '',
        dismissal: 'dismissible',
        options: formats.map((format) => ({
          label: formatLabel(format),
          caption: caption[format],
          onTap: (close) => {
            close();
            onChoose(format);
          },
        })),
        primary: { label: 'Cancel', variant: 'ghost', onTap: (close) => close() },
      });
      return;
    }
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
    // The phone layout counts its dialogs instead (compactNotice).
    if (this.compactUi) return;
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
    if (this.compactUi) {
      // D-Rename: the field docks the dialog to the top, above the keyboard.
      this.compactNotice({
        title: 'Rename deck',
        message: `${DECK_NAME_MAX_LENGTH} characters at most.`,
        dismissal: 'dismissible',
        field: { value: deck.name, accessibleName: 'Deck name', placeholder: 'Deck name', maxLength: DECK_NAME_MAX_LENGTH },
        secondary: { label: 'Cancel', onTap: (close) => close() },
        primary: {
          label: 'Save',
          onTap: (close, value) => {
            const name = value.trim().slice(0, DECK_NAME_MAX_LENGTH);
            if (!name) return;
            renameDeck(save, deckId, name);
            this.flush();
            close();
            onDone?.();
          },
        },
      });
      return;
    }
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

  /**
   * The deck list's rows, one per card: lands first, then by mana value and
   * name. A Constructed deck also lists every basic it holds none of, so its
   * + can add one.
   */
  private deckRowEntries(): CollapsedDeckRow[] {
    const rows = collapseDeckRows(this.deck, this.variantPins);
    if (!this.isReserveFormat()) for (const cardId of BASIC_LAND_IDS) {
      if (!rows.some((row) => row.cardId === cardId)) rows.push({ cardId, quantity: 0, firstIndex: -1, hasLegacyVariantPin: false });
    }
    return rows.sort((a, b) => {
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
  }

  private renderDeckRows(x0: number, heroId: string | null, listY0: number): void {
    // Basics are hidden here ONLY in constructed, where the +/- basics block
    // above owns them. In a reserve format that block is replaced by the
    // Warchest panel, so hiding basics here left a migrated classic deck's
    // ~20 basic lands invisible AND unremovable: the repair banner demanded
    // 40 cards, the deck held 60, and nothing in the UI could reach the
    // difference. Show them so they can be removed (player report, 2026-08-24).
    const entries = this.deckRowEntries();
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
    const lands = this.isReserveFormat()
      ? this.deck.filter((id) => CARD_DB[id] && isType(CARD_DB[id], 'land')).length
      : 0;
    if (this.compactUi) {
      this.showCompactRepair(blocking, lands);
      return;
    }
    this.closeFilterPanel();
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
    if (this.compactUi) {
      if (!this.compactModes().includes(this.deckPaneMode)) this.deckPaneMode = 'cards';
      this.renderCompactHeader();
      if (this.deckPaneMode !== 'cards') this.renderCompactMain();
      this.renderCompactColumn();
      return;
    }
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
    if (this.compactUi) {
      // The code sheet says why there is no code, rather than the status line.
      this.openCompactCode('export');
      return;
    }
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
    if (this.compactUi) {
      this.openCompactCode(mode, code);
      return;
    }
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
          void this.copyDeckCode(code, textarea).then((copied) => {
            if (!note.active) return;
            if (copied) note.setText('Copied.').setColor(theme.colors.success);
            else note.setText('Copy failed. Select the code and copy it manually.').setColor(theme.colors.danger);
          });
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
    if (this.compactUi?.sheet?.kind === 'code') this.closeCompactSheet();
    this.deckCodeOverlay?.destroy();
    this.deckCodeOverlay = null;
    if (this.zoom) this.zoom.setSuppressed(false);
  }

  /** Copy `code` to the clipboard; true when it got there. The caller's note says which. */
  private async copyDeckCode(code: string, textarea: HTMLTextAreaElement): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        textarea.focus();
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      }
    } catch {
      return false;
    }
    this.statusMessage = { text: 'Deck code copied.', tone: 'success' };
    this.renderDeck();
    return true;
  }

  // --- Phone layout (mobile wave 2) ------------------------------------------

  /**
   * The phone builder (D-Cards, D-Warchest, D-Style): the deck's name, the
   * pool search and Filters in the top bar with the Cards, Warchest and Style
   * tabs over the column; the pool (or the Warchest's slots, or the deck's
   * table) in the main pane; the deck list, its issues and the curve in the
   * column over the deck code and Save. The desktop's popovers become column
   * takeovers (filters, a Warchest slot's lands), sheets beside a live column
   * (inspect, deck codes, the Darling and style choosers), dialogs, and Your
   * Decks as its own screen.
   */
  private buildCompact(data: DeckBuilderSceneData): void {
    const stage = sceneStage(this);
    const content = stage.content;
    const type = theme.compactType;
    const largeText = currentAccessibility().textScale >= 1.3;
    const shell = compactShell(content, { back: true });
    const column = shell.column ?? { x: content.x + content.width, y: shell.main.y, width: 0, height: shell.main.height };
    this.touch = true;
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');
    // The deck's name takes what it needs of the top bar, and the search the rest.
    const probe = this.add.text(0, 0, this.activeSavedDeck()?.name ?? 'Custom Deck', {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700,
    });
    const titleW = probe.width + Math.round(type.body * 0.9) + COMPACT.gap;
    probe.destroy();
    const bar = builderTopBar(content, titleW, largeText);
    const ui: CompactBuilderUi = {
      content, main: shell.main, column, largeText, bar,
      header: null, mainLayer: null, columnLayer: null, decks: null,
      search: null, searchFold: null, dialogs: 0,
      poolScroll: null, poolOffset: 0, listScroll: null, listOffset: 0, focusList: this.fixtureFocusCardId,
      takeover: null, takeoverScroll: null, takeoverOffset: 0, sheet: null, hold: null, saveButton: null,
    };
    this.compactUi = ui;

    const searchStyle = (handle: SearchInputHandle): void => {
      // 16 px or more, or a phone's browser zooms the page when the field takes focus.
      Object.assign(handle.inputElement.style, { height: `${COMPACT.touch}px`, fontSize: `${Math.max(16, type.body)}px` });
    };
    const onSearch = (value: string): void => {
      this.filterState.search = value;
      // The search acts on the Cards view's pool, so it shows it.
      if (this.deckPaneMode !== 'cards') this.setCompactMode('cards');
      this.applyPoolFilterChange();
    };
    if (bar.search) {
      ui.search = createSearchInput(this, bar.search.x + bar.search.width / 2, bar.search.y + bar.search.height / 2, {
        width: bar.search.width, placeholder: 'Search your pool…', accessibleName: 'Search your card pool', onChange: onSearch,
      });
      searchStyle(ui.search);
    } else {
      // Folded to an icon (D-Cards130): the field opens at the top of the filter column.
      ui.searchFold = createSearchInput(this, column.x + column.width / 2, column.y + COMPACT.touch + COMPACT.gap + COMPACT.touch / 2, {
        width: column.width, placeholder: 'Search your pool…', accessibleName: 'Search your card pool', onChange: onSearch,
      });
      searchStyle(ui.searchFold);
    }
    this.searchInput = ui.search;
    this.input.on('pointermove', this.onCompactHoldMove, this);
    this.input.on('pointerup', this.onCompactHoldUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', this.onCompactHoldMove, this);
      this.input.off('pointerup', this.onCompactHoldUp, this);
      ui.search?.teardown();
      ui.searchFold?.teardown();
      this.compactUi = null;
    });
    registerSceneBackNavigation(this, () => this.compactBack());

    if (IS_DEV && data.a11yFixture) this.deckPaneMode = data.a11yFixture.mode ?? 'cards';
    this.renderCompactHeader();
    this.renderCompactMain();
    this.renderCompactColumn();
    this.syncCompactDom();
    if (this.activeFormat() === 'darlings' && !this.fixtureSave) {
      ui.dialogs += 1;
      const shown = showDarlingsTutorial(this, {
        onDismiss: () => this.releaseCompactDialog(ui),
        onReadMore: () => this.scene.start('Glossary', {
          focus: 'Darlings',
          returnTo: { scene: 'DeckBuilder', data: { deckId: this.activeSavedDeck()?.id } },
        }),
      });
      if (!shown) this.releaseCompactDialog(ui);
      else this.syncCompactDom();
    }
    if (IS_DEV && data.a11yFixture) {
      const fixture = data.a11yFixture;
      switch (fixture.modal) {
        case 'decks': this.openDeckPicker(); break;
        case 'darling': this.showDarlingPicker(); break;
        case 'reserve': this.showReserveLandPicker(Math.min(this.landReserve.length, LAND_RESERVE_SIZE - 1)); break;
        case 'landStyles': this.showLandStylesModal(); break;
        case 'repair': this.showRepairModal(this.currentIssues().filter((i) => i.kind === 'error')); break;
        case 'rename': if (this.workingDeckId) this.promptRename(this.workingDeckId); break;
        case 'format': this.showNewDeckFormatPrompt(() => {}); break;
        case 'export': this.exportDeckCode(); break;
        case 'import': this.showDeckCodeOverlay('import'); break;
        case 'unsaved': this.deck.push(BASIC_LAND_IDS[0]); this.confirmUnsavedChanges('leave', () => {}); break;
        case 'filters':
          this.openFilterPanel();
          if (fixture.filter) this.openCompactFacet(fixture.filter);
          break;
      }
      if (fixture.focusCardId && !fixture.modal && CARD_DB[fixture.focusCardId]) this.openCompactInspect(fixture.focusCardId);
    }
    this.data.set('a11yReady', true);
  }

  /** Back (the chevron, Esc, the system gesture): the open layer first, then the builder itself. */
  private compactBack(): void {
    const ui = this.compactUi;
    if (!ui || sceneHasOpenModal(this)) return;
    if (ui.sheet) this.closeCompactSheet();
    else if (ui.decks) this.closeCompactDecks();
    else if (ui.takeover?.kind === 'filters' && ui.takeover.facet) this.closeCompactFacet();
    else if (ui.takeover?.kind === 'filters') this.closeFilterPanel();
    else if (ui.takeover) {
      ui.takeover = null;
      this.renderCompactMain();
      this.renderCompactColumn();
    } else this.leaveDeckBuilder();
  }

  /** A dialog the builder counted (compactNotice, the Darlings tutorial) has closed. */
  private releaseCompactDialog(ui: CompactBuilderUi): void {
    if (this.compactUi !== ui) return;
    ui.dialogs = Math.max(0, ui.dialogs - 1);
    this.syncCompactDom();
  }

  /** The DOM fields float over the canvas, so each shows only while nothing covers its place. */
  private syncCompactDom(): void {
    const ui = this.compactUi;
    if (!ui) return;
    const clear = ui.dialogs === 0 && !ui.sheet && !ui.decks;
    ui.search?.setVisible(clear);
    ui.searchFold?.setVisible(clear && ui.takeover?.kind === 'filters' && ui.takeover.facet === null);
    ui.sheet?.dom?.setVisible(ui.dialogs === 0);
  }

  private setCompactMode(mode: DeckPaneMode): void {
    const ui = this.compactUi;
    if (!ui || this.deckPaneMode === mode) return;
    this.deckPaneMode = mode;
    // The pool's filters act on the Cards view's grid; a slot's lands on the Warchest's.
    if (ui.takeover?.kind === 'slot') ui.takeover = null;
    this.syncCompactDom();
    this.renderCompactHeader();
    this.renderCompactMain();
    this.renderCompactColumn();
  }

  /** The top bar (D-Cards): back, the deck's name over its format and count, the search, Filters and the tabs. */
  private renderCompactHeader(): void {
    const ui = this.compactUi;
    if (!ui) return;
    ui.header?.destroy();
    const type = theme.compactType;
    const bar = ui.bar;
    const layer = this.add.container(0, 0).setVisible(!ui.sheet && !ui.decks);
    ui.header = layer;
    const back = compactIconButton(this, bar.back, 'back', () => this.leaveDeckBuilder());
    layer.add(back.container);

    // The deck's name, a chevron that says it opens Your Decks, and its format and count under it.
    const active = this.activeSavedDeck();
    const format = this.activeFormat();
    const chevron = Math.round(type.body * 0.9);
    const name = this.add.text(bar.title.x, 0, '', {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    ellipsizeText(name, Math.max(0, bar.title.width - chevron - 6), active?.name ?? 'Custom Deck');
    const formatText = this.add.text(bar.title.x, 0, `${formatLabel(format)} · `, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
    });
    const full = this.deck.length === formatDeckSize(format);
    const count = this.add.text(0, 0, `${this.deck.length}/${formatDeckSize(format)}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700,
      color: full ? theme.colors.success : theme.colors.gold,
    });
    const blockH = name.height + formatText.height;
    // At the largest text the two lines outgrow the bar; the name keeps it.
    const twoLines = blockH <= bar.title.height + 6;
    const top = Math.max(bar.title.y, bar.title.y + (bar.title.height - (twoLines ? blockH : name.height)) / 2);
    name.setY(top);
    formatText.setY(top + name.height).setVisible(twoLines);
    count.setPosition(formatText.x + formatText.width, formatText.y).setVisible(twoLines);
    const caret = this.add.image(name.x + name.width + 6 + chevron / 2, name.y + name.height / 2, bakeUiIcon(this, 'chevron'))
      .setDisplaySize(chevron, chevron).setAngle(90).setTint(colorInt(theme.colors.gold));
    const titleZone = this.add.zone(bar.title.x + bar.title.width / 2, bar.title.y + bar.title.height / 2, bar.title.width, bar.title.height)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, titleZone, () => this.showDeckPicker());
    layer.add([name, formatText, count, caret, titleZone]);

    if (bar.searchIcon) {
      const searchOpen = ui.takeover?.kind === 'filters';
      const search = compactIconButton(this, bar.searchIcon, 'search', () => {
        if (searchOpen) this.closeFilterPanel();
        else this.openFilterPanel();
      });
      if (searchOpen) search.setVariant('selected');
      layer.add(search.container);
    }
    const filtersOpen = ui.takeover?.kind === 'filters';
    const active2 = this.activePoolFilterCount();
    const filter = compactIconButton(this, bar.filter, 'filter', () => {
      if (filtersOpen) this.closeFilterPanel();
      else this.openFilterPanel();
    });
    if (filtersOpen || active2 > 0) filter.setVariant('selected');
    layer.add(filter.container);
    if (active2 > 0) {
      const r = 10;
      const cx = bar.filter.x + bar.filter.width - 4;
      const cy = bar.filter.y + 4;
      layer.add(this.add.graphics().fillStyle(colorInt(theme.colors.gold), 1).fillCircle(cx, cy, r));
      layer.add(this.add.text(cx, cy, `${active2}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.onGold,
      }).setOrigin(0.5));
    }

    // Cards, Warchest, Style. A Warchest with an issue carries a warning on its tab (D-Warchest).
    const modes = this.compactModes();
    const labels: Record<DeckPaneMode, string> = { cards: 'Cards', warchest: 'Warchest', style: 'Style' };
    const warn = format !== 'constructed' && validateLandReserve(CARD_DB, this.save, this.landReserve).length > 0;
    const warnAt = warn ? modes.indexOf('warchest') : -1;
    // The warning takes the room of two spaces after the word, so the segments size around it.
    const room = '\u2003\u2002';
    const tabs = compactSegments(this, bar.tabs, modes.map((mode, i) => (i === warnAt ? labels[mode] + room : labels[mode])),
      modes.indexOf(this.deckPaneMode), (i) => this.setCompactMode(modes[i]), [], ui.largeText || warnAt >= 0);
    layer.add(tabs.container);
    if (warnAt >= 0) {
      const label = tabs.container.list.find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text.startsWith('Warchest'));
      if (label) {
        const size = Math.round(parseFloat(String(label.style.fontSize)) * 1.1);
        tabs.container.add(this.add.image(label.x + label.width / 2 - size / 2, label.y, bakeUiIcon(this, 'warning'))
          .setDisplaySize(size, size).setTint(colorInt(theme.colors.danger)));
      }
    }
  }

  /** The main pane for the open view: the pool (with her zone on a Darlings deck), the Warchest's slots, or the deck's table. */
  private renderCompactMain(): void {
    const ui = this.compactUi;
    if (!ui) return;
    if (ui.poolScroll) ui.poolOffset = ui.poolScroll.offset();
    ui.mainLayer?.destroy();
    ui.poolScroll = null;
    const layer = this.add.container(0, 0).setVisible(!ui.sheet && !ui.decks);
    ui.mainLayer = layer;
    if (this.deckPaneMode === 'warchest') this.drawCompactWarchest(layer);
    else if (this.deckPaneMode === 'style') this.drawCompactStyle(layer);
    else this.drawCompactPool(layer);
  }

  /** The pool grid (D-Cards): each card over its in-deck count and, when more than one can be added, its +N chip. */
  private drawCompactPool(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const save = this.save;
    let pane = ui.main;
    const darlingId = this.activeDarlingId();
    if (this.activeFormat() === 'darlings' && this.activeSavedDeck()) {
      const split = darlingSplit(ui.main, ui.largeText);
      this.drawCompactDarlingZone(layer, split.zone, darlingId);
      pane = split.pool;
    }
    const pool = this.pool();
    const chipStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700 };
    const probe = this.add.text(0, 0, '0/4', chipStyle);
    const grid = poolGrid(pane.width, Math.max(28, probe.height + 10), ui.largeText);
    probe.destroy();
    const chips = poolChips(grid);
    if (pool.length === 0) {
      layer.add(this.add.text(pane.x + pane.width / 2, pane.y + pane.height / 2,
        this.activePoolFilterCount() > 0 ? 'No owned cards match these filters.' : 'No cards in this set yet.', {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, align: 'center', wordWrap: { width: pane.width - 24 },
        }).setOrigin(0.5));
      return;
    }
    const capFor = (id: string): number => Math.min(this.copyLimit(), ownedCount(save, id));
    const list = this.add.container(0, pane.y);
    layer.add(list);
    const rows: (Phaser.GameObjects.Container | null)[] = Array.from({ length: Math.ceil(pool.length / grid.columns) }, () => null);
    const pill = (x: number, y: number, w: number, text: string, color: string, stroke: string | null, check: boolean): Phaser.GameObjects.GameObject[] => {
      const h = grid.chipH;
      const plate = this.add.graphics()
        .fillStyle(theme.graphics.panelFill, 0.94).fillRoundedRect(x, y, w, h, h / 2)
        .lineStyle(theme.control.borderWidth, stroke ? colorInt(stroke) : theme.graphics.panelStroke, stroke ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(x, y, w, h, h / 2);
      const label = this.add.text(0, y + h / 2, text, { ...chipStyle, color }).setOrigin(0, 0.5);
      const iconSize = check ? Math.round(type.label * 1.1) : 0;
      const total = label.width + (check ? iconSize + 3 : 0);
      label.setX(x + (w - total) / 2 + (check ? iconSize + 3 : 0));
      const out: Phaser.GameObjects.GameObject[] = [plate, label];
      if (check) {
        out.push(this.add.image(label.x - 3 - iconSize / 2, y + h / 2, bakeUiIcon(this, 'check'))
          .setDisplaySize(iconSize, iconSize).setTint(colorInt(color)));
      }
      return out;
    };
    const buildRow = (r: number): Phaser.GameObjects.Container => {
      const row = this.add.container(0, r * grid.pitchY);
      pool.slice(r * grid.columns, (r + 1) * grid.columns).forEach((d, k) => {
        const x = pane.x + k * grid.pitchX;
        const thumb = makeCardThumb(this, x + grid.cardW / 2, grid.cardH / 2, d, grid.cardW / CARD_W, undefined, this.ownedVariantFor(d.id));
        const inDeck = this.countIn(this.deck, d.id);
        const cap = capFor(d.id);
        const full = cap > 0 && inDeck >= cap;
        row.add(thumb);
        row.add(pill(x + chips.count.x, grid.chipY, chips.count.width, `${inDeck}/${cap}`,
          inDeck > 0 ? theme.colors.success : theme.colors.muted, full ? theme.colors.success : null, full));
        const addable = cap - inDeck;
        if (addable > 1) row.add(pill(x + chips.all.x, grid.chipY, chips.all.width, `+${addable}`, theme.colors.success, theme.colors.success, false));
      });
      list.add(row);
      return row;
    };
    const cardsIn = (from: number, to: number): CardDef[] => pool.slice(Math.max(0, from) * grid.columns, Math.max(0, to) * grid.columns);
    const showRows = (at: number): void => {
      ui.poolOffset = at;
      const first = Math.floor(at / grid.pitchY);
      const last = Math.floor((at + pane.height) / grid.pitchY);
      const span = Math.ceil(pane.height / grid.pitchY);
      this.poolArt?.show(this.thumbArtFor(cardsIn(first, last + 1)), this.thumbArtFor([...cardsIn(first - span, first), ...cardsIn(last + 1, last + 1 + span)]));
      rows.forEach((row, r) => {
        const near = r >= first - span && r <= last + span;
        if (near && !row) rows[r] = buildRow(r);
        else if (!near && row) {
          row.destroy();
          rows[r] = null;
        }
      });
    };
    const scroll = bindMenuScroll(this, list, pane, poolHeight(grid, pool.length), () => this.compactBlocked(), [], 0, undefined, ui.poolOffset);
    scroll.onScroll = showRows;
    showRows(scroll.offset());
    ui.poolScroll = scroll;
    // One target over the grid: the card (and which part of it) from where the tap lands.
    const zone = this.add.zone(pane.x + pane.width / 2, pane.y + pane.height / 2, pane.width, pane.height).setInteractive({ useHandCursor: true });
    const hitAt = (pointer: Phaser.Input.Pointer) => poolHitAt(grid, pool.length, pointer.worldX - pane.x, pointer.worldY - pane.y + scroll.offset(),
      (i) => capFor(pool[i].id) - this.countIn(this.deck, pool[i].id) > 1);
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hit = hitAt(pointer);
      if (hit) this.startCompactHold(pointer, () => this.openCompactInspect(pool[hit.index].id));
    });
    bindTapButton(this, zone, (pointer) => {
      if (this.compactHoldFired() || Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
      const hit = hitAt(pointer);
      if (!hit) return;
      const id = pool[hit.index].id;
      if (hit.part === 'all') this.addPlayset(id);
      else this.addCard(id);
    });
    layer.add(zone);
  }

  /** A Darlings deck's identity (D-Darlings): her face, name and cost at the main pane's left, Change under them. */
  private drawCompactDarlingZone(layer: Phaser.GameObjects.Container, zone: Rect, darlingId: string | null): void {
    const type = theme.compactType;
    const card = darlingId ? CARD_DB[darlingId] : undefined;
    const heading = this.add.text(zone.x, zone.y, 'DARLING', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.muted, letterSpacing: 1,
    });
    layer.add(heading);
    const change = compactButton(this, { x: zone.x, y: zone.y + zone.height - COMPACT.touch, width: zone.width, height: COMPACT.touch },
      card ? 'Change' : 'Choose', { variant: card ? 'ghost' : 'emphasis', onTap: () => this.openDarlingsFormat() });
    layer.add(change.container);
    const faceTop = heading.y + heading.height + 6;
    const room = change.container.y - COMPACT.gap - faceTop;
    const faceW = Math.min(zone.width, Math.floor((room * 0.62) / 1.4));
    const faceH = Math.round(faceW * 1.4);
    if (!card) {
      const g = this.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 0.8);
      this.dashedRect(g, zone.x + 1, faceTop + 1, faceW - 2, faceH - 2);
      layer.add(g);
      layer.add(this.add.text(zone.x + faceW / 2, faceTop + faceH / 2, 'Choose your Darling', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.gold, align: 'center', wordWrap: { width: faceW - 12 },
      }).setOrigin(0.5));
      return;
    }
    layer.add(makeCardThumb(this, zone.x + faceW / 2, faceTop + faceH / 2, card, faceW / CARD_W, undefined, this.ownedVariantFor(card.id)));
    layer.add(this.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(zone.x, faceTop, faceW, faceH, 6));
    this.paneArt?.show(this.thumbArtFor([card]));
    const parts = splitDarlingName(card.name);
    let y = faceTop + faceH + 6;
    const name = this.add.text(zone.x, y, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    ellipsizeText(name, zone.width, parts.name);
    layer.add(name);
    y += name.height;
    const pip = Math.round(type.body * 1.3);
    const pipsRoom = pip + 4;
    if (parts.title) {
      const title = this.add.text(zone.x, y, parts.title, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: zone.width },
      });
      this.trimToHeight(title, change.container.y - COMPACT.gap - pipsRoom - y);
      layer.add(title);
      if (title.visible) y += title.height;
    }
    if (y + pipsRoom <= change.container.y - COMPACT.gap) layer.add(this.costPips(zone.x, y + 4 + pip / 2, card, pip));
  }

  /** A card's cost as beads from (x, centre y), left to right as the face prints them. */
  private costPips(x: number, y: number, card: CardDef, size: number): Phaser.GameObjects.Container {
    const row = this.add.container(0, 0);
    const pips = card.cost ? [...pipsFor(card.cost)] : [];
    pips.forEach((pip, i) => {
      if (pip.number !== undefined) ensureNumeralPip(this, pip.number);
      if (!this.textures.exists(pip.texture)) return;
      row.add(this.add.image(x + size / 2 + i * (size + 2), y, pip.texture).setDisplaySize(size, size));
    });
    return row;
  }

  /** Stroke a dashed rectangle (an empty slot, a Darling not yet chosen). */
  private dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, dash = 8, gapLen = 6): void {
    const line = (x1: number, y1: number, x2: number, y2: number): void => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < len; d += dash + gapLen) {
        const e = Math.min(len, d + dash);
        g.lineBetween(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
      }
    };
    line(x, y, x + w, y);
    line(x + w, y, x + w, y + h);
    line(x + w, y + h, x, y + h);
    line(x, y + h, x, y);
  }

  /** Shorten `text` word by word, with an ellipsis, until it is no taller than `maxH`; hide it when not one line fits. */
  private trimToHeight(text: Phaser.GameObjects.Text, maxH: number): void {
    if (text.height <= maxH) return;
    const words = text.text.split(' ');
    let lo = 0;
    let hi = words.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      text.setText(`${words.slice(0, mid).join(' ')}…`);
      if (text.height <= maxH) lo = mid;
      else hi = mid - 1;
    }
    if (lo === 0) text.setText('').setVisible(false);
    else text.setText(`${words.slice(0, lo).join(' ').replace(/[,.;:]$/, '')}…`);
  }

  // --- hold to inspect

  /** Start a hold on a card: held still for `holdMs`, it opens the card instead of acting on it. */
  private startCompactHold(pointer: Phaser.Input.Pointer, onHold: () => void): void {
    const ui = this.compactUi;
    if (!ui || this.compactBlocked()) return;
    ui.hold?.timer.remove();
    const hold: CompactHold = {
      pointerId: pointer.id, x: pointer.worldX, y: pointer.worldY, fired: false,
      timer: this.time.delayedCall(BUILDER_COMPACT.holdMs, () => {
        if (ui.hold !== hold || this.compactBlocked()) return;
        hold.fired = true;
        onHold();
      }),
    };
    ui.hold = hold;
  }

  /** True once, for the release that ends a hold that opened a card: that release does not tap. */
  private compactHoldFired(): boolean {
    const ui = this.compactUi;
    const fired = ui?.hold?.fired ?? false;
    if (ui && fired) ui.hold = null;
    return fired;
  }

  private readonly onCompactHoldMove = (pointer: Phaser.Input.Pointer): void => {
    const hold = this.compactUi?.hold;
    if (!hold || hold.fired || hold.pointerId !== pointer.id) return;
    if (Math.hypot(pointer.worldX - hold.x, pointer.worldY - hold.y) > COMPACT_DRAG_SLOP) {
      hold.timer.remove();
      this.compactUi!.hold = null;
    }
  };

  private readonly onCompactHoldUp = (pointer: Phaser.Input.Pointer): void => {
    const ui = this.compactUi;
    const hold = ui?.hold;
    if (!ui || !hold || hold.pointerId !== pointer.id) return;
    hold.timer.remove();
    // A hold that opened a card is left for the release's own tap to consume
    // (that tap comes first); one that lands nowhere is dropped after it.
    if (!hold.fired) ui.hold = null;
    else this.time.delayedCall(0, () => { if (ui.hold === hold) ui.hold = null; });
  };

  /** Whether a dialog or another layer has the screen, so the panes under it take no taps or scrolls. */
  private compactBlocked(): boolean {
    const ui = this.compactUi;
    return !ui || ui.sheet !== null || ui.decks !== null || sceneHasOpenModal(this);
  }

  /** The views the tabs offer: a deck with no Warchest and no format to switch to has none to show. */
  private compactModes(): DeckPaneMode[] {
    const switchable = this.reserveFormatsEnabled
      && visibleBuilderFormatTabs(offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired)).length >= 2;
    return this.activeFormat() !== 'constructed' || switchable ? ['cards', 'warchest', 'style'] : ['cards', 'style'];
  }

  // --- the column

  /** The column for what is open: a sheet's own, a takeover (the filters, a slot's lands), or the view's. */
  private renderCompactColumn(): void {
    const ui = this.compactUi;
    if (!ui) return;
    if (ui.listScroll) ui.listOffset = ui.listScroll.offset();
    if (ui.takeoverScroll) ui.takeoverOffset = ui.takeoverScroll.offset();
    ui.listScroll = null;
    ui.takeoverScroll = null;
    ui.saveButton = null;
    ui.columnLayer?.destroy();
    const layer = this.add.container(0, 0).setVisible(!ui.decks);
    ui.columnLayer = layer;
    if (ui.sheet) ui.sheet.drawColumn(layer, { ...ui.column, y: ui.content.y, height: ui.content.y + ui.content.height - ui.content.y });
    else if (ui.takeover?.kind === 'filters') {
      if (ui.takeover.facet) this.drawCompactFacetPicker(layer, ui.takeover.facet);
      else this.drawCompactFilters(layer);
    } else if (ui.takeover?.kind === 'slot') this.drawCompactSlotPicker(layer, ui.takeover.index);
    else if (this.deckPaneMode === 'warchest') this.drawCompactWarchestColumn(layer);
    else if (this.deckPaneMode === 'style') this.drawCompactStyleColumn(layer);
    else this.drawCompactCardsColumn(layer);
  }

  /** The Cards view's column (D-Cards): the deck list, the status line, the counts and the curve, over the foot. */
  private drawCompactCardsColumn(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const status = this.compactStatusBlock(col.width, ui.largeText ? 1 : 2);
    const stats = this.compactStatsBlock(col.width);
    const L = cardsColumn(col, status?.height ?? 0, stats.height);
    if (status) {
      status.container.setPosition(L.status.x, L.status.y);
      layer.add(status.container);
    }
    stats.container.setPosition(L.stats.x, L.stats.y);
    layer.add(stats.container);
    this.drawCompactDeckList(layer, L.list);
    this.drawCompactFoot(layer, col);
  }

  /**
   * The status line: the one-off message (Saved, imported, copied) and the
   * deck's first issue, beside a warning or a check. Null when there is
   * neither. Long issues end with an ellipsis after `maxLines`.
   */
  private compactStatusBlock(width: number, maxLines = 3): { container: Phaser.GameObjects.Container; height: number } | null {
    const type = theme.compactType;
    const issues = this.currentIssues();
    const message = this.statusMessage;
    const lines = [...(message ? [message.text] : []), ...issues.slice(0, 1).map((issue) => issue.message)];
    if (lines.length === 0) return null;
    const success = deckStatusTone(message, issues.some((issue) => issue.kind === 'error')) === 'success';
    const color = success ? theme.colors.success : theme.colors.danger;
    const icon = Math.round(type.label * 1.25);
    const text = this.add.text(icon + 6, 0, lines.join(' '), {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color, wordWrap: { width: width - icon - 6 },
    });
    const lineH = text.height / Math.max(1, text.getWrappedText().length);
    this.trimToHeight(text, Math.ceil(lineH * maxLines));
    const mark = this.add.image(icon / 2, lineH / 2, bakeUiIcon(this, success ? 'check' : 'warning'))
      .setDisplaySize(icon, icon).setTint(colorInt(color));
    return { container: this.add.container(0, 0, [mark, text]), height: Math.max(icon, text.height) };
  }

  /** The counts line and the mana curve (D-Cards): bars with their counts over and mana values under, the colour pips at the right. */
  private compactStatsBlock(width: number): { container: Phaser.GameObjects.Container; height: number } {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const s = computeDeckStats(this.deck, CARD_DB);
    const c = this.add.container(0, 0);
    const counts = this.add.text(0, 0, deckCountsLine(s, this.isReserveFormat()
      ? { kind: 'warchest', filled: this.landReserve.length, size: LAND_RESERVE_SIZE } : { kind: 'list' }), {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body, wordWrap: { width },
    });
    c.add(counts);
    const small = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px` };
    const probe = this.add.text(0, 0, '0', small);
    const capH = probe.height;
    probe.destroy();
    // A count wider than a bar's pitch (three digits at the largest text) would touch its neighbour's,
    // so the counts then sit on two tiers, alternate bars on the upper one, and the curve grows by a tier.
    const probeXs = curveLayout({ x: 0, y: 0, width, height: 1 }, 0, 0).xs;
    const widest = Math.max(0, ...s.curve.filter((n) => n > 0).map((n) => {
      const t = this.add.text(0, 0, `${n}`, small);
      const w = t.width;
      t.destroy();
      return w;
    }));
    const tiers = widest + 2 > probeXs[1] - probeXs[0] ? 2 : 1;
    const curveH = capH * (1 + tiers) + (ui.largeText ? 28 : 22);
    const rect = { x: 0, y: counts.height + 4, width, height: curveH };
    const curve = curveLayout(rect, capH * tiers, capH);
    for (const bar of curveBars(s.curve, { firstX: curve.xs[0], pitch: curve.xs[1] - curve.xs[0], maxHeight: curve.maxBarH })) {
      c.add(this.add.rectangle(bar.x, curve.baseY, curve.barW, bar.height,
        bar.count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1));
      if (bar.count > 0) {
        const label = this.add.text(bar.x, curve.baseY - bar.height - 1, `${bar.count}`, { ...small, color: theme.colors.body }).setOrigin(0.5, 1);
        // Two tiers sit in fixed rows over the tallest bar, so neighbours never meet whatever their bars' heights.
        if (tiers === 2) label.setY(curve.baseY - curve.maxBarH - 1 - (bar.mv % 2) * capH);
        c.add(label);
      }
      c.add(this.add.text(bar.x, curve.baseY + 2, bar.label, { ...small, color: theme.colors.muted }).setOrigin(0.5, 0));
    }
    // The colour pips, as many as the lane holds, each over its count.
    const pip = Math.round(type.label * 1.3);
    const pitch = pip + 4;
    const beads = deckPipCounts(s).slice(0, Math.max(1, Math.floor(curve.pips.height / pitch)));
    beads.forEach((bead, i) => {
      const cy = curve.pips.y + i * pitch + pip / 2;
      const key = `pip-${bead.color}`;
      if (this.textures.exists(key)) c.add(this.add.image(curve.pips.x + pip / 2, cy, key).setDisplaySize(pip, pip));
      c.add(this.add.text(curve.pips.x + curve.pips.width, cy, `${bead.count}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
      }).setOrigin(1, 0.5));
    });
    return { container: c, height: rect.y + curveH };
  }

  /**
   * The deck list (D-Cards): a row per card, its name over its count, cost
   * and kind, with a minus at the right (a Classic deck's basics also get a
   * plus). A tap or a hold on the row opens the card; the minus removes one.
   */
  private drawCompactDeckList(layer: Phaser.GameObjects.Container, view: Rect): void {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const entries = this.deckRowEntries();
    if (entries.length === 0) {
      layer.add(this.add.text(view.x + view.width / 2, view.y + view.height / 2, 'Tap a card in your pool to add it.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, align: 'center', wordWrap: { width: view.width - 16 },
      }).setOrigin(0.5));
      return;
    }
    const btn = COMPACT.touch;
    const rowW = view.width - BUILDER_COMPACT.thumbLane;
    const heroId = this.deckHeroId();
    const heroEditable = this.activeFormat() !== 'darlings';
    const basic = (id: string): boolean => !this.isReserveFormat() && (BASIC_LAND_IDS as readonly string[]).includes(id);
    const pipSize = Math.round(type.label * 1.25);
    const list = this.add.container(0, view.y);
    layer.add(list);
    const tops: number[] = [];
    const heights: number[] = [];
    const controls: { x: number; kind: 'minus' | 'plus'; enabled: boolean }[][] = [];
    let y = 0;
    for (const entry of entries) {
      const d = CARD_DB[entry.cardId];
      const kinds: ('minus' | 'plus')[] = basic(entry.cardId) ? ['minus', 'plus'] : ['minus'];
      const textX = view.x + 12;
      const buttonsW = kinds.length * btn + (kinds.length - 1) * 4;
      const textW = rowW - 12 - buttonsW - 6 - 8;
      const star = Boolean(d) && heroEditable && heroId === entry.cardId;
      const starSize = Math.round(type.body * 0.95);
      const name = this.add.text(textX, 0, '', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
        color: d ? theme.colors.heading : theme.colors.danger,
      });
      ellipsizeText(name, textW - (star ? starSize + 4 : 0), d ? d.name : `Unavailable card: ${entry.cardId}`);
      const qty = this.add.text(textX, 0, `×${entry.quantity}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      });
      const line2H = Math.max(qty.height, pipSize);
      const h = Math.max(btn + 8, Math.ceil(name.height + line2H + 12));
      const textTop = y + (h - name.height - line2H) / 2;
      const line2Y = textTop + name.height + line2H / 2;
      name.setY(textTop);
      qty.setOrigin(0, 0.5).setY(line2Y);
      const plate = this.add.graphics()
        .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(view.x, y, rowW, h, theme.radius.control)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
        .strokeRoundedRect(view.x, y, rowW, h, theme.radius.control);
      list.add([plate, name, qty]);
      let x2 = textX + qty.width + 6;
      if (d) {
        for (const pip of d.cost ? pipsFor(d.cost) : []) {
          if (pip.number !== undefined) ensureNumeralPip(this, pip.number);
          if (!this.textures.exists(pip.texture)) continue;
          list.add(this.add.image(x2 + pipSize / 2, line2Y, pip.texture).setDisplaySize(pipSize, pipSize));
          x2 += pipSize + 2;
        }
        const detail = this.add.text(x2 + 4, line2Y, '', {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
        }).setOrigin(0, 0.5);
        ellipsizeText(detail, Math.max(0, textX + textW - detail.x), deckRowDetail(d));
        list.add(detail);
      }
      if (star) {
        list.add(this.add.image(name.x + name.width + 4 + starSize / 2, textTop + name.height / 2, bakeUiIcon(this, 'star'))
          .setDisplaySize(starSize, starSize).setTint(colorInt(theme.colors.gold)));
      }
      const rowControls = kinds.map((kind, i) => {
        const x = view.x + rowW - 6 - buttonsW + i * (btn + 4);
        const enabled = kind === 'plus' || entry.quantity > 0;
        const colors = themedButtonColors(kind === 'minus' ? 'danger' : 'ghost');
        const by = y + (h - btn) / 2;
        const g = this.add.graphics()
          .fillStyle(colorInt(colors.bg), 1).fillRoundedRect(x, by, btn, btn, theme.radius.control)
          .lineStyle(theme.control.borderWidth, colorInt(colors.stroke), theme.alpha.chrome)
          .strokeRoundedRect(x, by, btn, btn, theme.radius.control)
          .setAlpha(enabled ? 1 : 0.4);
        const icon = Math.round(type.body * 1.2);
        list.add([g, this.add.image(x + btn / 2, by + btn / 2, bakeUiIcon(this, kind))
          .setDisplaySize(icon, icon).setTint(colorInt(colors.fg)).setAlpha(enabled ? 1 : 0.4)]);
        return { x, kind, enabled };
      });
      tops.push(y);
      heights.push(h);
      controls.push(rowControls);
      y += h + 6;
    }
    const contentH = y - 6;
    let offset = ui.listOffset;
    if (ui.focusList) {
      const index = entries.findIndex((entry) => entry.cardId === ui.focusList);
      if (index >= 0) offset = Math.max(0, Math.min(tops[index], tops[index] + heights[index] - view.height));
      ui.focusList = null;
    }
    const scroll = bindMenuScroll(this, list, view, contentH, () => this.compactBlocked(), [], 0, undefined, offset);
    ui.listScroll = scroll;
    const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height)
      .setInteractive({ useHandCursor: true });
    layer.add(zone);
    const rowAt = (pointer: Phaser.Input.Pointer): number => stackedRowAt(tops, heights, pointer.worldY - view.y + scroll.offset());
    const controlAt = (pointer: Phaser.Input.Pointer, row: number) =>
      controls[row].find((control) => pointer.worldX >= control.x && pointer.worldX <= control.x + btn) ?? null;
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const row = rowAt(pointer);
      if (row < 0 || controlAt(pointer, row) || !CARD_DB[entries[row].cardId]) return;
      this.startCompactHold(pointer, () => this.openCompactInspect(entries[row].cardId));
    });
    bindTapButton(this, zone, (pointer) => {
      if (this.compactHoldFired() || Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
      const row = rowAt(pointer);
      if (row < 0) return;
      const entry = entries[row];
      const control = controlAt(pointer, row);
      if (control) {
        if (!control.enabled) return;
        if (control.kind === 'minus') this.removeCardAt(this.deck.indexOf(entry.cardId), pointer);
        else this.addBasicLand(entry.cardId as BasicLandId);
      } else if (CARD_DB[entry.cardId]) this.openCompactInspect(entry.cardId);
    });
  }

  /** The column's foot (every view): the deck code button, then Save deck, or Fix deck while a saved deck cannot be played. */
  private drawCompactFoot(layer: Phaser.GameObjects.Container, col: Rect): void {
    const ui = this.compactUi!;
    const foot = builderFoot(col);
    const code = compactIconButton(this, foot.code, 'share', () => this.exportDeckCode());
    const blocking = this.currentIssues().filter((issue) => issue.kind === 'error');
    const cta = deckSaveCta({ hasSavedRecord: this.activeSavedDeck() !== null, dirty: this.hasUnsavedDeckEdits(), blockingCount: blocking.length });
    const save = cta === 'save'
      ? compactButton(this, foot.save, 'Save deck', { variant: 'primary', onTap: () => this.compactSave() })
      : compactButton(this, foot.save, `Fix deck (${blocking.length})`, {
        variant: 'danger', icon: 'warning', onTap: () => this.showRepairModal(blocking),
      });
    if (cta === 'save') ui.saveButton = save;
    layer.add([code.container, save.container]);
  }

  /** Save deck (always works, D10); with nothing still in the way, the button says Saved for a moment. */
  private compactSave(): void {
    this.saveWorkingDeck();
    this.renderDeck();
    const button = this.compactUi?.saveButton;
    if (this.statusMessage || !button) return;
    button.setLabel('Saved ✓');
    this.time.delayedCall(900, () => {
      if (button.container.active) button.setLabel('Save deck');
    });
  }

  /** A Classic deck's basic land: one more, however many are in (basics are unlimited). */
  private addBasicLand(id: BasicLandId): void {
    this.statusMessage = null;
    const next = appendDeckSlot({ cards: this.deck, variantPins: this.variantPins }, id);
    this.deck = next.cards;
    this.variantPins = next.variantPins;
    this.renderPool();
    this.renderDeck();
  }

  /** The Warchest view's column (D-Warchest): the format switch, the fill counts and what still stands in the way. */
  private drawCompactWarchestColumn(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const format = this.activeFormat();
    const offered = offeredBuilderFormats(this.reserveFormatsEnabled, this.classicRetired);
    const tabs = visibleBuilderFormatTabs(offered);
    let y = col.y;
    if (tabs.length >= 2) {
      // A retired Classic deck lights no tab; the label says why.
      const retired = !offered.includes(format);
      const label = this.add.text(col.x, y, retired ? 'CLASSIC' : 'FORMAT', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, letterSpacing: 1,
        color: retired ? theme.colors.danger : theme.colors.muted,
      });
      y += label.height + 4;
      const segments = compactSegments(this, { x: col.x, y, width: col.width, height: COMPACT.touch }, tabs.map((tab) => formatLabel(tab)),
        tabs.indexOf(format), (i) => {
          this.selectFormat(tabs[i]);
          // A prompt or a refusal leaves the format as it was; the segments follow it.
          this.renderCompactColumn();
        });
      layer.add([label, segments.container]);
      y += COMPACT.touch + COMPACT.gap * 2;
    }
    const wrap = { wordWrap: { width: col.width } };
    if (format === 'constructed') {
      layer.add(this.add.text(col.x, y, 'A Classic deck keeps its lands in the list. Pick Standard or Darlings to build a Warchest.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, ...wrap,
      }));
    } else {
      const issues = validateLandReserve(CARD_DB, this.save, this.landReserve);
      const duals = this.landReserve.filter((id) => CARD_DB[id] && isDualLand(CARD_DB[id])).length;
      const heading = this.add.text(col.x, y, 'Warchest Reserves', {
        fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading, ...wrap,
      });
      y += heading.height + 4;
      const counts = this.add.text(col.x, y, `${this.landReserve.length}/${LAND_RESERVE_SIZE} lands · ${duals}/${MAX_DUAL_LANDS} duals`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: duals > MAX_DUAL_LANDS ? theme.colors.danger : theme.colors.body, ...wrap,
      });
      y += counts.height + COMPACT.gap;
      layer.add([heading, counts]);
      const ok = issues.length === 0;
      const icon = Math.round(type.label * 1.25);
      const line = this.add.text(col.x + icon + 6, y, ok ? 'Warchest ready.' : issues[0].message, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: ok ? theme.colors.success : theme.colors.danger,
        wordWrap: { width: col.width - icon - 6 },
      });
      const lineH = line.height / Math.max(1, line.getWrappedText().length);
      this.trimToHeight(line, builderFoot(col).code.y - COMPACT.gap - y);
      layer.add([this.add.image(col.x + icon / 2, y + lineH / 2, bakeUiIcon(this, ok ? 'check' : 'warning'))
        .setDisplaySize(icon, icon).setTint(colorInt(ok ? theme.colors.success : theme.colors.danger)), line]);
    }
    this.drawCompactFoot(layer, col);
  }

  /** The Style view's column (D-Style): the card back, the playmat and the land styles, each with Change. */
  private drawCompactStyleColumn(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const active = this.activeSavedDeck();
    if (!active) {
      layer.add(this.add.text(col.x, col.y, 'Save this deck first, then give it a look of its own.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: col.width },
      }));
      this.drawCompactFoot(layer, col);
      return;
    }
    const cardBack = CARD_BACKS.find((entry) => entry.id === active.cardBack) ?? CARD_BACKS[0];
    const playmat = playmatForId(active.playmat ?? null);
    const styled = BASIC_LAND_IDS.filter((id) => active.landStyle?.[id]);
    // At Largest text a pencil replaces Change, so the caption and value keep a readable width.
    const changeW = ui.largeText ? COMPACT.touch : 76;
    const previewW = 34;
    const textX = col.x + 10 + previewW + 10;
    const textW = col.x + col.width - 8 - changeW - 8 - textX;
    const rows: { caption: string; value: string; preview: (cx: number, cy: number) => Phaser.GameObjects.GameObject; onChange: () => void }[] = [
      {
        caption: 'Card back', value: cardBack.name,
        preview: (cx, cy) => this.add.image(cx, cy, safeCardBackTexture(this, cardBack)).setDisplaySize(26, 36),
        onChange: () => this.openDeckStylePicker('cardBack'),
      },
      {
        caption: 'Playmat', value: playmat.name,
        preview: (cx, cy) => {
          const g = this.add.graphics();
          this.paintCompactStage(g, { x: cx - previewW / 2, y: cy - 13, width: previewW, height: 26 }, playmat, 2);
          return g;
        },
        onChange: () => this.openDeckStylePicker('playmat'),
      },
      {
        caption: 'Land styles', value: styled.length === 0 ? 'Default art' : `${styled.length} of ${BASIC_LAND_IDS.length} styled`,
        preview: (cx, cy) => {
          const sample = styled[0] ?? BASIC_LAND_IDS[0];
          return makeCardThumb(this, cx, cy, byId(sample), 36 / CARD_FACE_H, active.landStyle?.[sample] ?? undefined, this.ownedVariantFor(sample));
        },
        onChange: () => this.showLandStylesModal(),
      },
    ];
    let y = col.y;
    for (const row of rows) {
      const caption = this.add.text(textX, 0, '', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted });
      ellipsizeText(caption, textW, row.caption);
      const value = this.add.text(textX, 0, row.value, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
        wordWrap: { width: textW },
      });
      const h = Math.max(COMPACT.touch + 12, Math.ceil(caption.height + value.height + 14));
      caption.setY(y + (h - caption.height - value.height) / 2);
      value.setY(caption.y + caption.height);
      const plate = this.add.graphics()
        .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(col.x, y, col.width, h, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
        .strokeRoundedRect(col.x, y, col.width, h, theme.radius.panel);
      const changeRect = { x: col.x + col.width - 6 - changeW, y: y + (h - COMPACT.touch) / 2, width: changeW, height: COMPACT.touch };
      const change = ui.largeText
        ? compactIconButton(this, changeRect, 'pencil', row.onChange)
        : compactButton(this, changeRect, 'Change', { fontSize: type.label, onTap: row.onChange });
      layer.add([plate, row.preview(col.x + 10 + previewW / 2, y + h / 2), caption, value, change.container]);
      y += h + COMPACT.gap;
    }
    const note = this.add.text(col.x, y, 'These apply to this deck only. Your library shows its card back when you mulligan.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: col.width },
    });
    this.trimToHeight(note, builderFoot(col).code.y - COMPACT.gap - y);
    layer.add(note);
    this.drawCompactFoot(layer, col);
  }

  // --- the main pane's other views

  /** The Warchest view's centre (D-Warchest): the ten slots, each its land's art, name and mana, then the format's rules. */
  private drawCompactWarchest(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const type = theme.compactType;
    const main = ui.main;
    const format = this.activeFormat();
    const rulesCopy = formatRulesCopy(format) ?? '';
    if (format === 'constructed') {
      layer.add(this.add.text(main.x + main.width / 2, main.y + main.height / 2, 'A Classic deck has no Warchest: its lands are in the list.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, align: 'center', wordWrap: { width: main.width - 24 },
      }).setOrigin(0.5));
      return;
    }
    const rules = this.add.text(main.x, 0, rulesCopy, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body, wordWrap: { width: main.width }, lineSpacing: 2,
    });
    const L = warchestMain(main, rules.height);
    rules.setY(L.rules.y);
    const full = rules.text;
    this.trimToHeight(rules, L.rules.height);
    rules.setData('a11yFullText', full);
    layer.add(rules);
    const lit = ui.takeover?.kind === 'slot' ? ui.takeover.index : -1;
    const styles = this.activeSavedDeck()?.landStyle ?? null;
    L.slots.forEach((tile, i) => {
      const card = this.landReserve[i] ? CARD_DB[this.landReserve[i]] : undefined;
      const number = `${i + 1}`;
      if (!card) {
        const g = this.add.graphics().lineStyle(lit === i ? 3 : 2, colorInt(theme.colors.gold), lit === i ? 1 : 0.8);
        this.dashedRect(g, tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
        const num = this.add.text(tile.x + tile.width / 2, 0, number, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
        }).setOrigin(0.5, 0);
        const plus = Math.round(type.body * 1.4);
        const choose = this.add.text(tile.x + tile.width / 2, 0, 'Choose land', {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
          align: 'center', wordWrap: { width: tile.width - 8 },
        }).setOrigin(0.5, 0);
        const blockH = num.height + plus + choose.height + 4;
        const top = tile.y + Math.max(2, (tile.height - blockH) / 2);
        num.setY(top);
        const icon = this.add.image(tile.x + tile.width / 2, top + num.height + 2 + plus / 2, bakeUiIcon(this, 'plus'))
          .setDisplaySize(plus, plus).setTint(colorInt(theme.colors.gold));
        choose.setY(top + num.height + plus + 4);
        layer.add([g, num, icon, choose]);
      } else {
        layer.add(this.add.graphics()
          .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(tile.x, tile.y, tile.width, tile.height, theme.radius.control)
          .lineStyle(lit === i ? 3 : theme.control.borderWidth, lit === i ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, lit === i ? 1 : theme.alpha.chrome)
          .strokeRoundedRect(tile.x, tile.y, tile.width, tile.height, theme.radius.control));
        const pip = Math.round(type.label * 1.3);
        const name = this.add.text(tile.x + 6, 0, card.name, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
          wordWrap: { width: tile.width - 10 },
        });
        const pipsY = tile.y + tile.height - 6 - pip / 2;
        // The art takes what the name and the mana leave, if that is enough to read.
        const artH = Math.floor(tile.height - 4 - name.height - 4 - pip - 10);
        const art = { x: tile.x + 4, y: tile.y + 4, width: tile.width - 8, height: artH };
        if (artH >= 18) {
          try {
            const image = addPortraitArt(this, art.x + art.width / 2, art.y + art.height / 2, card.id, (img) => coverFitImage(img, art, 0.1),
              'half', isBasicLand(card) ? styles?.[card.id as BasicLandId] ?? undefined : undefined);
            if (image) layer.add(image);
          } catch {
            // No art for this land: the tile reads as its name and mana.
          }
          name.setY(art.y + art.height + 2);
        } else {
          name.setY(tile.y + 4);
          this.trimToHeight(name, pipsY - pip / 2 - 2 - name.y);
        }
        if (artH < 18 || name.y + name.height > pipsY - pip / 2) this.trimToHeight(name, pipsY - pip / 2 - 2 - name.y);
        layer.add(name);
        const badge = Math.round(type.label * 1.6);
        layer.add(this.add.graphics().fillStyle(theme.graphics.dim, 0.85).fillCircle(tile.x + 4 + badge / 2, tile.y + 4 + badge / 2, badge / 2));
        layer.add(this.add.text(tile.x + 4 + badge / 2, tile.y + 4 + badge / 2, number, {
          fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        }).setOrigin(0.5));
        let px = tile.x + 6;
        for (const color of card.manaAbility ?? []) {
          const key = `pip-${color}`;
          if (!this.textures.exists(key)) continue;
          layer.add(this.add.image(px + pip / 2, pipsY, key).setDisplaySize(pip, pip));
          px += pip + 2;
        }
        if (card.entersTapped) {
          const t = this.add.text(px + 2 + pip / 2, pipsY, 'T', {
            fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.body,
          }).setOrigin(0.5);
          layer.add([this.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1)
            .strokeRoundedRect(px + 2, pipsY - pip / 2, pip, pip, 3), t]);
        }
      }
      const zone = this.add.zone(tile.x + tile.width / 2, tile.y + tile.height / 2, tile.width, tile.height).setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, (pointer) => {
        if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
        this.showReserveLandPicker(i);
      });
      layer.add(zone);
    });
  }

  /** The Style view's centre (D-Style): the deck's own table, its card backs in the opponent's hand and on the library. */
  private drawCompactStyle(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const main = ui.main;
    const active = this.activeSavedDeck();
    const cardBack = CARD_BACKS.find((entry) => entry.id === active?.cardBack) ?? CARD_BACKS[0];
    const playmat = playmatForId(active?.playmat ?? null);
    const g = this.add.graphics();
    const inset = Math.round(main.width * 0.06);
    const stage = { x: main.x + inset, y: main.y + inset * 0.6, width: main.width - inset * 2, height: main.height - inset * 1.2 };
    this.paintCompactStage(g, stage, playmat, 12);
    layer.add(g);
    const key = safeCardBackTexture(this, cardBack);
    const zoneH = (stage.height - 12) / 2;
    // The opponent's hand: five backs overlapping across the upper zone.
    const handH = Math.round(zoneH * 0.75);
    const handW = Math.round(handH / 1.4);
    const step = Math.round(handW * 0.8);
    const handX = stage.x + stage.width * 0.16;
    for (let i = 0; i < 5; i++) {
      layer.add(this.add.image(handX + i * step + handW / 2, stage.y + handH / 2, key).setDisplaySize(handW, handH));
    }
    // The library: a stack at the lower right, rising out of the player's zone.
    const libH = Math.round(zoneH * 1.3);
    const libW = Math.round(libH / 1.4);
    const libX = stage.x + stage.width * 0.7;
    const libY = main.y + main.height - 6 - libH;
    for (let i = 5; i >= 0; i--) {
      layer.add(this.add.image(libX + i * 2 + libW / 2, libY - i * 2 + libH / 2, key).setDisplaySize(libW, libH).setAlpha(i === 0 ? 1 : 0.9));
    }
  }

  /** The duel table in miniature or at size: the backdrop, then the two zones as outlined plates (no stage light, which only reads at duel scale). */
  private paintCompactStage(g: Phaser.GameObjects.Graphics, rect: Rect, playmat: PlaymatDefinition, radius: number): void {
    const colors = playmat.colors;
    const gap = Math.max(2, Math.round(rect.height * 0.04));
    const zoneH = (rect.height - gap) / 2;
    g.fillStyle(colors.backdrop.fallbackTop, 1).fillRoundedRect(rect.x, rect.y, rect.width, zoneH, radius);
    g.fillStyle(colors.opponentZone.fill, 1).fillRoundedRect(rect.x, rect.y, rect.width, zoneH, radius);
    g.fillStyle(colors.playerZone.fill, 1).fillRoundedRect(rect.x, rect.y + zoneH + gap, rect.width, zoneH, radius);
    g.lineStyle(radius > 4 ? 2 : 1, colors.zoneStroke, 1);
    g.strokeRoundedRect(rect.x, rect.y, rect.width, zoneH, radius);
    g.strokeRoundedRect(rect.x, rect.y + zoneH + gap, rect.width, zoneH, radius);
  }

  // --- takeovers: the filters and a Warchest slot

  /** A facet's chosen option, as its plate shows it. */
  private facetValueLabel(facet: PoolFilterFacet): string {
    const value = facet.get();
    return facet.options.find((option) => option.value === value)?.label ?? value;
  }

  /** The pool's filters in the column (D-PoolFilters): each facet a plate that opens its choices, Reset and Done at the foot. */
  private drawCompactFilters(layer: Phaser.GameObjects.Container): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const { touch, gap } = COMPACT;
    const close = compactIconButton(this, { x: col.x + col.width - touch, y: col.y, width: touch, height: touch }, 'close', () => this.closeFilterPanel());
    const title = this.add.text(col.x, 0, '', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    ellipsizeText(title, col.width - touch - gap, 'Pool Filters');
    title.setY(col.y + (touch - title.height) / 2);
    layer.add([title, close.container]);
    // A folded search field sits under the title (its DOM element is placed in buildCompact).
    const top = col.y + touch + gap + (ui.searchFold ? touch + gap : 0);
    const footY = col.y + col.height - touch;
    const half = (col.width - gap) / 2;
    const reset = compactButton(this, { x: col.x, y: footY, width: half, height: touch }, 'Reset filters', {
      fontSize: type.label, onTap: () => this.resetPoolFilters(),
    });
    const done = compactButton(this, { x: col.x + half + gap, y: footY, width: half, height: touch }, 'Done', {
      variant: 'primary', onTap: () => this.closeFilterPanel(),
    });
    layer.add([reset.container, done.container]);

    const labelStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted };
    const valueStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 };
    const probe = this.add.text(0, 0, 'Set', labelStyle);
    const probeValue = this.add.text(0, 0, 'All', valueStyle);
    const controlH = Math.max(touch, 12 + probe.height + probeValue.height);
    probe.destroy();
    probeValue.destroy();
    const view = { x: col.x, y: top, width: col.width, height: Math.max(0, footY - gap - top) };
    const L = poolFilterLayout({ ...col, y: 0 }, 0, controlH, ui.largeText);
    const block = this.add.container(0, view.y);
    layer.add(block);
    const base = defaultFilterState();
    const facets = this.poolFilterFacets();
    const chevron = Math.round(type.body * 0.9);
    const rects = facets.map((facet) => L[facet.name]);
    facets.forEach((facet, i) => {
      const r = rects[i];
      const changed = facet.get() !== String(base[facet.name]);
      const g = this.add.graphics()
        .fillStyle(changed ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(theme.control.borderWidth, changed ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, changed ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control);
      const caption = this.add.text(r.x + 10, 0, facet.label, labelStyle);
      const value = this.add.text(r.x + 10, 0, '', { ...valueStyle, color: changed ? theme.colors.gold : theme.colors.heading });
      ellipsizeText(value, r.width - 20 - chevron - gap, this.facetValueLabel(facet));
      const textTop = r.y + (r.height - caption.height - value.height) / 2;
      caption.setY(textTop);
      value.setY(textTop + caption.height);
      const icon = this.add.image(r.x + r.width - 10 - chevron / 2, r.y + r.height / 2, bakeUiIcon(this, 'chevron'))
        .setDisplaySize(chevron, chevron).setAngle(90).setTint(colorInt(theme.colors.muted));
      block.add([g, caption, value, icon]);
    });
    const scroll = bindMenuScroll(this, block, view, L.bottom, () => this.compactBlocked(), [], 0, undefined, ui.takeoverOffset);
    ui.takeoverScroll = scroll;
    const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
    layer.add(zone);
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
      const y = pointer.worldY - view.y + scroll.offset();
      const index = rects.findIndex((r) => pointer.worldX >= r.x && pointer.worldX <= r.x + r.width && y >= r.y && y <= r.y + r.height);
      if (index >= 0) this.openCompactFacet(facets[index].name);
    });
  }

  /** Open one facet's choices in the filter column (D-BinderSet's pattern). */
  private openCompactFacet(name: PoolFilterFacet['name']): void {
    const ui = this.compactUi;
    if (!ui) return;
    ui.takeover = { kind: 'filters', facet: name };
    ui.takeoverScroll = null;
    ui.takeoverOffset = 0;
    this.syncCompactDom();
    this.renderCompactColumn();
  }

  /** Back from a facet's choices to the facets. */
  private closeCompactFacet(): void {
    const ui = this.compactUi;
    if (!ui || ui.takeover?.kind !== 'filters') return;
    ui.takeover = { kind: 'filters', facet: null };
    ui.takeoverScroll = null;
    ui.takeoverOffset = 0;
    this.syncCompactDom();
    this.renderCompactColumn();
  }

  /** A facet's choices: the chosen one outlined in gold with a check. A choice applies at once; Done goes back to the facets. */
  private drawCompactFacetPicker(layer: Phaser.GameObjects.Container, name: PoolFilterFacet['name']): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const { touch, gap } = COMPACT;
    const facet = this.poolFilterFacets().find((f) => f.name === name)!;
    const back = compactIconButton(this, { x: col.x, y: col.y, width: touch, height: touch }, 'back', () => this.closeCompactFacet());
    const title = this.add.text(col.x + touch + 12, 0, facet.label, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    title.setY(col.y + (touch - title.height) / 2);
    const footY = col.y + col.height - touch;
    const half = (col.width - gap) / 2;
    const reset = compactButton(this, { x: col.x, y: footY, width: half, height: touch }, 'Reset filters', {
      fontSize: type.label, onTap: () => this.resetPoolFilters(),
    });
    const done = compactButton(this, { x: col.x + half + gap, y: footY, width: half, height: touch }, 'Done', {
      variant: 'primary', onTap: () => this.closeCompactFacet(),
    });
    layer.add([back.container, title, reset.container, done.container]);
    const view = { x: col.x, y: col.y + touch + gap, width: col.width, height: 0 };
    view.height = Math.max(0, footY - gap - view.y);
    const rowW = view.width - BUILDER_COMPACT.thumbLane;
    const icon = Math.round(type.body * 1.1);
    const list = this.add.container(0, view.y);
    layer.add(list);
    const tops: number[] = [];
    const heights: number[] = [];
    const current = facet.get();
    let y = 0;
    for (const option of facet.options) {
      const selected = option.value === current;
      const label = this.add.text(view.x + 12, 0, option.label, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
        color: selected ? theme.colors.gold : theme.colors.body, wordWrap: { width: rowW - 24 - icon - gap },
      });
      const h = Math.max(touch, label.height + 12);
      label.setY(y + (h - label.height) / 2);
      list.add([this.add.graphics()
        .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(view.x, y, rowW, h, theme.radius.control)
        .lineStyle(theme.control.borderWidth, selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, selected ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(view.x, y, rowW, h, theme.radius.control), label]);
      if (selected) {
        list.add(this.add.image(view.x + rowW - 12 - icon / 2, y + h / 2, bakeUiIcon(this, 'check'))
          .setDisplaySize(icon, icon).setTint(colorInt(theme.colors.gold)));
      }
      tops.push(y);
      heights.push(h);
      y += h + gap;
    }
    const scroll = bindMenuScroll(this, list, view, Math.max(0, y - gap), () => this.compactBlocked(), [], 0, undefined, ui.takeoverOffset);
    ui.takeoverScroll = scroll;
    const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
    layer.add(zone);
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
      const index = stackedRowAt(tops, heights, pointer.worldY - view.y + scroll.offset());
      const option = facet.options[index];
      if (!option || option.value === facet.get()) return;
      facet.set(option.value);
      this.applyPoolFilterChange();
    });
  }

  /** A Warchest slot's lands in the column (D-WarchestSlot): Remove land, the basics, then the owned duals. */
  private drawCompactSlotPicker(layer: Phaser.GameObjects.Container, index: number): void {
    const ui = this.compactUi!;
    const col = ui.column;
    const type = theme.compactType;
    const { touch, gap } = COMPACT;
    const close = (): void => {
      ui.takeover = null;
      this.renderCompactMain();
      this.renderCompactColumn();
    };
    const back = compactIconButton(this, { x: col.x, y: col.y, width: touch, height: touch }, 'back', close);
    const caption = this.add.text(col.x + touch + 12, 0, 'WARCHEST RESERVES', {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, letterSpacing: 1, color: theme.colors.muted,
    });
    ellipsizeText(caption, col.width - touch - 12);
    const title = this.add.text(caption.x, 0, `Slot ${index + 1}`, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const headTop = col.y + Math.max(0, (touch - caption.height - title.height) / 2);
    caption.setY(headTop);
    title.setY(headTop + caption.height);
    const headBottom = Math.max(col.y + touch, title.y + title.height);
    const note = this.add.text(col.x, headBottom + 6, 'Basics are unlimited. Dual lands must be owned, and arrive tapped (T).', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: col.width },
    });
    const footY = col.y + col.height - touch;
    const cancel = compactButton(this, { x: col.x, y: footY, width: col.width, height: touch }, 'Cancel', { onTap: close });
    layer.add([back.container, caption, title, note, cancel.container]);

    const current = this.landReserve[index] ?? null;
    const choices: (CardDef | null)[] = [...(current ? [null] : []), ...this.reserveLandChoices()];
    const view = { x: col.x, y: note.y + note.height + gap, width: col.width, height: 0 };
    view.height = Math.max(0, footY - gap - view.y);
    const rowW = view.width - BUILDER_COMPACT.thumbLane;
    const nameStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 };
    const probe = this.add.text(0, 0, 'Forest', nameStyle);
    const rowH = Math.max(touch + 4, probe.height + 16);
    probe.destroy();
    const pitch = rowH + gap;
    const pip = Math.round(type.label * 1.3);
    const list = this.add.container(0, view.y);
    layer.add(list);
    const rows: (Phaser.GameObjects.Container | null)[] = choices.map(() => null);
    const buildRow = (i: number): Phaser.GameObjects.Container => {
      const card = choices[i];
      const y = i * pitch;
      const row = this.add.container(0, 0);
      const selected = card !== null && card.id === current;
      row.add(this.add.graphics()
        .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(view.x, y, rowW, rowH, theme.radius.control)
        .lineStyle(theme.control.borderWidth, selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, selected ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(view.x, y, rowW, rowH, theme.radius.control));
      if (!card) {
        const icon = Math.round(type.body * 1.2);
        row.add(this.add.image(view.x + 14 + icon / 2, y + rowH / 2, bakeUiIcon(this, 'close')).setDisplaySize(icon, icon).setTint(colorInt(theme.colors.danger)));
        row.add(this.add.text(view.x + 14 + icon + 12, y + rowH / 2, 'Remove land', { ...nameStyle, color: theme.colors.danger }).setOrigin(0, 0.5));
      } else {
        const art = { x: view.x + 6, y: y + 6, width: rowH - 12, height: rowH - 12 };
        try {
          const image = addPortraitArt(this, art.x + art.width / 2, art.y + art.height / 2, card.id, (img) => coverFitImage(img, art, 0.1),
            'half', isBasicLand(card) ? this.activeSavedDeck()?.landStyle?.[card.id as BasicLandId] ?? undefined : undefined);
          if (image) row.add(image);
        } catch {
          // No art: the row reads as its name and mana.
        }
        const marks = [...(card.manaAbility ?? [])];
        const marksW = marks.length * (pip + 2) + (card.entersTapped ? pip + 4 : 0);
        const name = this.add.text(art.x + art.width + 10, y + rowH / 2, '', { ...nameStyle, color: selected ? theme.colors.gold : theme.colors.heading })
          .setOrigin(0, 0.5);
        ellipsizeText(name, view.x + rowW - 10 - marksW - 6 - name.x, card.name);
        row.add(name);
        let px = view.x + rowW - 10 - marksW;
        for (const color of marks) {
          const key = `pip-${color}`;
          if (this.textures.exists(key)) row.add(this.add.image(px + pip / 2, y + rowH / 2, key).setDisplaySize(pip, pip));
          px += pip + 2;
        }
        if (card.entersTapped) {
          row.add(this.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1).strokeRoundedRect(px + 2, y + rowH / 2 - pip / 2, pip, pip, 3));
          row.add(this.add.text(px + 2 + pip / 2, y + rowH / 2, 'T', {
            fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.body,
          }).setOrigin(0.5));
        }
      }
      list.add(row);
      return row;
    };
    const showRows = (at: number): void => {
      const first = Math.floor(at / pitch) - 2;
      const last = Math.ceil((at + view.height) / pitch) + 2;
      rows.forEach((row, i) => {
        const near = i >= first && i <= last;
        if (near && !row) rows[i] = buildRow(i);
        else if (!near && row) {
          row.destroy();
          rows[i] = null;
        }
      });
    };
    const scroll = bindMenuScroll(this, list, view, Math.max(0, choices.length * pitch - gap), () => this.compactBlocked(), [], 0, undefined, ui.takeoverOffset);
    scroll.onScroll = showRows;
    showRows(scroll.offset());
    ui.takeoverScroll = scroll;
    const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
    layer.add(zone);
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.compactBlocked()) return;
      const at = pointer.worldY - view.y + scroll.offset();
      const i = Math.floor(at / pitch);
      if (i < 0 || i >= choices.length || at - i * pitch > rowH) return;
      ui.takeover = null;
      ui.takeoverOffset = 0;
      // setReserveSlot redraws the slots and this column.
      this.setReserveSlot(index, choices[i]?.id ?? null);
    });
  }

  // --- sheets

  /**
   * Open a sheet over the main pane and the top bar's left (D-BuilderInspect,
   * D-ExportCode, D-DarlingPick, D-CardBackPicker): the top bar and the main
   * pane hide under it, and the column beside it is the sheet's own, run the
   * full height. `build` fills the sheet and may hand back a DOM field.
   */
  private openCompactSheet(
    kind: CompactSheet['kind'],
    build: (container: Phaser.GameObjects.Container, frame: Rect) => Phaser.GameObjects.DOMElement | void,
    drawColumn: CompactSheet['drawColumn'],
    onClose: (() => void) | null = null,
  ): void {
    const ui = this.compactUi;
    if (!ui) return;
    this.closeCompactSheet(false);
    ui.hold?.timer.remove();
    ui.hold = null;
    const content = ui.content;
    const frame = { x: content.x, y: content.y, width: Math.max(0, ui.column.x - COMPACT.gap - content.x), height: content.height };
    const container = this.add.container(0, 0).setDepth(theme.depth.overlay);
    container.setData('a11ySurface', frame).setData('a11yPanel', frame);
    container.add(this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel));
    // Nothing under the sheet takes a tap that misses its controls.
    container.add(this.add.zone(frame.x + frame.width / 2, frame.y + frame.height / 2, frame.width, frame.height).setInteractive());
    const sheet: CompactSheet = { kind, container, drawColumn, dom: null, onClose };
    ui.sheet = sheet;
    sheet.dom = build(container, frame) ?? null;
    ui.header?.setVisible(false);
    ui.mainLayer?.setVisible(false);
    this.syncCompactDom();
    this.renderCompactColumn();
  }

  /** Close the open sheet, if any; `render` redraws the column for the view beneath. */
  private closeCompactSheet(render = true): void {
    const ui = this.compactUi;
    const sheet = ui?.sheet;
    if (!ui || !sheet) return;
    ui.sheet = null;
    sheet.container.destroy();
    ui.header?.setVisible(!ui.decks);
    ui.mainLayer?.setVisible(!ui.decks);
    this.syncCompactDom();
    sheet.onClose?.();
    if (render) this.renderCompactColumn();
  }

  /** A sheet's title, and its subtitle under it when there is one; returns where the body starts. */
  private compactSheetHead(container: Phaser.GameObjects.Container, frame: Rect, title: string, subtitle?: string): number {
    const type = theme.compactType;
    const pad = BUILDER_COMPACT.sheetPad;
    // A long card name takes a second line rather than losing its words.
    const head = this.add.text(frame.x + pad, frame.y + pad, title, {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      wordWrap: { width: frame.width - pad * 2 },
    });
    const lineH = head.height / Math.max(1, head.getWrappedText().length);
    this.trimToHeight(head, Math.ceil(lineH * 2));
    container.add(head);
    let y = head.y + head.height;
    if (subtitle) {
      const sub = this.add.text(head.x, y, subtitle, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: frame.width - pad * 2 },
      });
      container.add(sub);
      y += sub.height;
    }
    return y + 12;
  }

  /** Two buttons side by side at a column's foot, the action on the right. */
  private compactFootPair(layer: Phaser.GameObjects.Container, col: Rect, left: { label: string; onTap: () => void },
    right: { label: string; onTap: () => void; enabled?: boolean; variant?: ThemedButtonVariant }): CompactButton {
    const gap = COMPACT.gap;
    const half = (col.width - gap) / 2;
    const y = col.y + col.height - COMPACT.touch;
    const a = compactButton(this, { x: col.x, y, width: half, height: COMPACT.touch }, left.label, { onTap: left.onTap });
    const b = compactButton(this, { x: col.x + half + gap, y, width: half, height: COMPACT.touch }, right.label, {
      variant: right.variant ?? 'primary', onTap: right.onTap,
    });
    for (const button of [a, b]) {
      if (button.label.width > half - 16) {
        button.label.setFontSize(theme.compactType.label);
        button.setLabel(button.label.text);
      }
    }
    if (right.enabled === false) b.setEnabled(false);
    layer.add([a.container, b.container]);
    return b;
  }

  /**
   * Hold to inspect (D-BuilderInspect): the card's face and its keyword guide
   * (at the largest text, its rules too) in the sheet; how many are in the
   * deck, with − and +, and the hero image in the column.
   */
  private openCompactInspect(cardId: string): void {
    const d = CARD_DB[cardId];
    const ui = this.compactUi;
    if (!d || !ui) return;
    const type = theme.compactType;
    const largeText = ui.largeText;
    this.openCompactSheet('inspect', (c, frame) => {
      const pad = BUILDER_COMPACT.sheetPad;
      const facts = [d.token ? null : rarityLine(d), SET_TITLES[d.set ?? 'base']].filter((fact): fact is string => Boolean(fact));
      const bodyY = this.compactSheetHead(c, frame, d.name, facts.join(' · '));
      const x = frame.x + pad;
      const bodyH = frame.y + frame.height - pad - bodyY;
      const faceW = Math.max(0, Math.min(Math.floor(bodyH / 1.4), Math.floor((frame.width - pad * 2) * (largeText ? 0.4 : 0.45))));
      const variant = this.ownedVariantFor(d.id);
      const view = new CardView(this, x + faceW / 2, bodyY + Math.round(faceW * 1.4) / 2);
      view.setScale(faceW / CARD_W).setCard(d, variant ? { fx: 'full', variant, fullArt: variant.fullArt } : { fx: 'full' });
      c.add(view);
      const readX = x + faceW + 16;
      const read = { x: readX, y: bodyY, width: Math.max(0, frame.x + frame.width - pad - readX), height: bodyH };
      const layer = this.add.container(0, read.y);
      c.add(layer);
      const inner = read.width - BUILDER_COMPACT.thumbLane - 28;
      let y = 0;
      const text = (str: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text =>
        this.add.text(read.x + 14, 0, str, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width: inner }, ...extra });
      const plateAround = (items: Phaser.GameObjects.Text[], gaps: number[]): void => {
        const top = y;
        let cursor = top + 12;
        items.forEach((item, i) => {
          item.setY(cursor);
          cursor += item.height + (i < items.length - 1 ? gaps[i] ?? 2 : 0);
        });
        const h = cursor + 12 - top;
        const w = read.width - BUILDER_COMPACT.thumbLane;
        layer.add(this.add.graphics()
          .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(read.x, top, w, h, theme.radius.panel)
          .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(read.x, top, w, h, theme.radius.panel));
        layer.add(items);
        y = top + h + 12;
      };
      const entries = cardGlossaryEntries(d);
      // The face clamps its rules; at the largest text (or with no keyword to explain) the panel sets them at size.
      if (largeText || entries.length === 0) {
        const stats = d.attack !== undefined && d.defense !== undefined ? ` · ${d.attack}/${d.defense}` : '';
        const rules = rulesText(d);
        plateAround([
          text(`${typeLine(d)}${stats}`, type.label, theme.colors.muted),
          ...(rules ? [text(rules, type.body, theme.colors.body, { lineSpacing: 2 })] : []),
        ], [6]);
      }
      if (entries.length > 0) {
        const items = [text('Keyword Guide', type.body, theme.colors.heading, { fontFamily: theme.fonts.display, fontStyle: theme.weight.w700 })];
        const gaps = [6];
        for (const entry of entries) {
          items.push(text(entry.name, type.label, theme.colors.gold, { fontStyle: theme.weight.w700 }));
          items.push(text(entry.reminder, type.label, theme.colors.body));
          gaps.push(1, 6);
        }
        plateAround(items, gaps);
      }
      bindMenuScroll(this, layer, read, Math.max(0, y - 12));
    }, (layer, col) => this.drawCompactInspectColumn(layer, col, d));
  }

  /** The inspect sheet's column: IN THIS DECK, − count +, the hero image, and Done. */
  private drawCompactInspectColumn(layer: Phaser.GameObjects.Container, col: Rect, d: CardDef): void {
    const type = theme.compactType;
    const { touch, gap } = COMPACT;
    const inDeck = this.countIn(this.deck, d.id);
    const owned = ownedCount(this.save, d.id);
    const basic = isBasicLand(d);
    const landHere = this.isReserveFormat() && d.types.includes('land');
    const cap = basic ? Number.POSITIVE_INFINITY : Math.min(this.copyLimit(), owned);
    const heading = this.add.text(col.x, col.y + 4, 'IN THIS DECK', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, letterSpacing: 1, color: theme.colors.muted,
    });
    layer.add(heading);
    let y = heading.y + heading.height + 10;
    const count = this.add.text(col.x + col.width / 2, 0, basic ? `${inDeck}` : `${inDeck}/${cap}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.h1 + 8}px`, fontStyle: theme.weight.w700,
      color: !basic && cap > 0 && inDeck >= cap ? theme.colors.success : theme.colors.heading,
    }).setOrigin(0.5, 0);
    const sub = this.add.text(col.x + col.width / 2, 0, basic ? 'Basic land' : `${owned} owned`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    }).setOrigin(0.5, 0);
    const stepH = Math.max(touch + 8, count.height + sub.height + 4);
    count.setY(y + (stepH - count.height - sub.height) / 2);
    sub.setY(count.y + count.height);
    const stepW = touch + 8;
    const minus = compactIconButton(this, { x: col.x, y, width: stepW, height: stepH }, 'minus', () => {
      this.removeCardAt(this.deck.indexOf(d.id), this.input.activePointer);
    });
    minus.setVariant('danger');
    minus.setEnabled(inDeck > 0);
    const plus = compactIconButton(this, { x: col.x + col.width - stepW, y, width: stepW, height: stepH }, 'plus', () => {
      if (basic && !this.isReserveFormat()) this.addBasicLand(d.id as BasicLandId);
      else this.addCard(d.id);
    });
    plus.setEnabled(!landHere && inDeck < cap);
    layer.add([minus.container, count, sub, plus.container]);
    y += stepH + COMPACT.gap * 1.5;

    const heroEditable = this.activeFormat() !== 'darlings';
    const heroId = this.deckHeroId();
    if (heroEditable && inDeck > 0) {
      const isHero = heroId === d.id;
      const hero = compactButton(this, { x: col.x, y, width: col.width, height: touch }, isHero ? 'Hero image' : 'Set as hero image', {
        icon: 'star', variant: isHero ? 'selected' : 'ghost', onTap: () => this.toggleDeckHero(d.id),
      });
      if (hero.labelRight() > col.width - 8) {
        hero.label.setFontSize(type.label);
        hero.setLabel(hero.label.text);
      }
      hero.setEnabled(this.activeSavedDeck() !== null);
      layer.add(hero.container);
      y += touch + gap;
    }
    const noteCopy = landHere
      ? 'In this format your lands live in the Warchest.'
      : !heroEditable
        ? 'A Darlings deck shows its Darling.'
        : heroId ? `Hero image: ${CARD_DB[heroId].name}` : 'No hero image chosen yet.';
    const note = this.add.text(col.x, y, noteCopy, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: col.width },
    });
    this.trimToHeight(note, col.y + col.height - touch - gap - y);
    layer.add(note);
    const done = compactButton(this, { x: col.x, y: col.y + col.height - touch, width: col.width, height: touch }, 'Done', {
      variant: 'primary', onTap: () => this.closeCompactSheet(),
    });
    layer.add(done.container);
  }

  /**
   * The deck code sheet (D-ExportCode, D-ImportCode): Export and Import as
   * tabs in its column. Export shows the code (or why there is none), Copy
   * code copies it; Import takes a pasted code (Paste reads the clipboard,
   * so the field never raises the keyboard by itself) and Import applies it.
   */
  private openCompactCode(mode: 'export' | 'import', code = ''): void {
    const ui = this.compactUi;
    if (!ui) return;
    const type = theme.compactType;
    const blocking = this.currentIssues().filter((issue) => issue.kind === 'error');
    const blocked = mode === 'export' && blocking.length > 0;
    if (mode === 'export' && !blocked && !code) code = encodeDeck(deckCodeDeckFor({ ...this.openDeckTarget(), cards: this.deck }));
    let textarea: HTMLTextAreaElement | null = null;
    let setNote: (text: string, tone: 'success' | 'danger') => void = () => {};
    this.openCompactSheet('code', (c, frame) => {
      const pad = BUILDER_COMPACT.sheetPad;
      const x = frame.x + pad;
      const w = frame.width - pad * 2;
      let y = this.compactSheetHead(c, frame, mode === 'export' ? 'Export Deck Code' : 'Import Deck Code');
      const intro = this.add.text(x, y, blocked
        ? 'A deck with a blocking issue has no code yet.'
        : mode === 'export' ? 'Copy this code to share the current deck.' : 'Paste a deck code, then import it into the editor.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: w },
      });
      c.add(intro);
      y += intro.height + 12;
      let dom: Phaser.GameObjects.DOMElement | undefined;
      if (!blocked) {
        const area = document.createElement('textarea');
        textarea = area;
        area.value = code;
        area.readOnly = mode === 'export';
        area.spellcheck = false;
        area.placeholder = 'Paste deck code here...';
        area.setAttribute('aria-label', mode === 'export' ? 'Deck code' : 'Deck code to import');
        const fieldH = Math.max(COMPACT.touch * 2, Math.min(120, Math.floor(frame.height * 0.32)));
        area.setAttribute('style', [
          `width:${w}px`, `height:${fieldH}px`, 'box-sizing:border-box', 'resize:none', 'padding:10px 12px',
          // 16 px or more, or a phone's browser zooms the page when the field takes focus.
          `font:${Math.max(16, type.body)}px ${theme.fonts.ui}`, 'line-height:1.35', `color:${theme.colors.body}`,
          `background:${theme.colors.panelFill}`, `border:1px solid ${theme.colors.gold}`, `border-radius:${theme.radius.control}px`,
          'outline:none', 'word-break:break-all',
        ].join(';'));
        dom = this.add.dom(x + w / 2, y + fieldH / 2, area).setOrigin(0.5);
        c.add(dom);
        y += fieldH + 12;
        if (mode === 'import') {
          const paste = compactButton(this, { x, y, width: 120, height: COMPACT.touch }, 'Paste', {
            icon: 'copy', onTap: () => {
              if (!navigator.clipboard?.readText) {
                setNote('Paste is not available here. Long-press the field and paste.', 'danger');
                return;
              }
              void navigator.clipboard.readText().then((text) => {
                if (area.isConnected) area.value = text;
              }, () => setNote('Paste is not available here. Long-press the field and paste.', 'danger'));
            },
          });
          c.add(paste.container);
          y += COMPACT.touch + 12;
        }
      }
      const icon = Math.round(type.body * 1.1);
      const mark = this.add.image(x + icon / 2, 0, bakeUiIcon(this, 'warning')).setDisplaySize(icon, icon).setVisible(false);
      const note = this.add.text(x + icon + 8, y, '', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: w - icon - 8 },
      });
      c.add([mark, note]);
      setNote = (text, tone) => {
        if (!note.active) return;
        const color = tone === 'success' ? theme.colors.success : theme.colors.danger;
        note.setText(text).setColor(color);
        const lineH = note.height / Math.max(1, note.getWrappedText().length);
        mark.setTexture(bakeUiIcon(this, tone === 'success' ? 'check' : 'warning')).setDisplaySize(icon, icon)
          .setTint(colorInt(color)).setY(note.y + lineH / 2).setVisible(true);
      };
      if (blocked) setNote(`Export blocked: ${blocking[0].message}`, 'danger');
      return dom;
    }, (layer, col) => {
      const tabs = compactSegments(this, { x: col.x, y: col.y, width: col.width, height: COMPACT.touch }, ['Export', 'Import'],
        mode === 'export' ? 0 : 1, (i) => {
          if ((i === 0) === (mode === 'export')) return;
          if (i === 0) this.exportDeckCode();
          else this.importDeckCode();
          // A prompt first: the tabs stay on what is showing until it answers.
          this.renderCompactColumn();
        });
      layer.add(tabs.container);
      const name = this.add.text(col.x, col.y + COMPACT.touch + 16, '', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      });
      ellipsizeText(name, col.width, this.activeSavedDeck()?.name ?? 'Custom Deck');
      const format = this.activeFormat();
      const facts = this.add.text(col.x, name.y + name.height, `${formatLabel(format)} · ${this.deck.length}/${formatDeckSize(format)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      });
      layer.add([name, facts]);
      const close = { label: 'Close', onTap: () => this.closeCompactSheet() };
      if (mode === 'export') {
        this.compactFootPair(layer, col, close, {
          label: 'Copy code', enabled: !blocked, onTap: () => {
            if (!textarea) return;
            void this.copyDeckCode(code, textarea).then((copied) => {
              setNote(copied ? 'Copied.' : 'Copy failed. Select the code and copy it manually.', copied ? 'success' : 'danger');
            });
          },
        });
      } else {
        this.compactFootPair(layer, col, close, {
          label: 'Import', onTap: () => {
            if (!textarea) return;
            if (this.applyDeckCodeImport(textarea.value, false)) {
              this.closeCompactSheet();
              return;
            }
            // The sheet's note owns this failure, as the desktop overlay's does.
            setNote(this.statusMessage?.text ?? '', 'danger');
            this.statusMessage = null;
          },
        });
      }
    });
  }

  /** The Darling chooser (D-DarlingPick): every owned legendary as a face in the sheet; a tap selects, Choose commits. */
  private openCompactDarlingPicker(): void {
    const ui = this.compactUi;
    if (!ui) return;
    const type = theme.compactType;
    const candidates = listOwnedLegendaryCreatures(CARD_DB, this.save);
    let picked: string | null = candidates.some((card) => card.id === this.workingDarlingId) ? this.workingDarlingId : null;
    this.openCompactSheet('darling', (c, frame) => {
      const pad = BUILDER_COMPACT.sheetPad;
      const bodyY = this.compactSheetHead(c, frame, 'Choose your Darling');
      const view = { x: frame.x + pad, y: bodyY, width: frame.width - pad * 2, height: frame.y + frame.height - pad - bodyY };
      if (candidates.length === 0) {
        c.add(this.add.text(view.x + view.width / 2, view.y + view.height / 2, 'No owned legendary creatures yet.', {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
        }).setOrigin(0.5));
        return;
      }
      const grid = poolGrid(view.width, 0, ui.largeText);
      const pitchY = grid.cardH + BUILDER_COMPACT.rowGap;
      const art = new PagedArt(this, 'darling-picker', { owner: c });
      const list = this.add.container(0, view.y);
      c.add(list);
      const rowCount = Math.ceil(candidates.length / grid.columns);
      const rows: (Phaser.GameObjects.Container | null)[] = Array.from({ length: rowCount }, () => null);
      const badge = Math.round(type.body * 1.6);
      const buildRow = (r: number): Phaser.GameObjects.Container => {
        const row = this.add.container(0, r * pitchY);
        candidates.slice(r * grid.columns, (r + 1) * grid.columns).forEach((card, k) => {
          const x = view.x + k * grid.pitchX;
          row.add(makeCardThumb(this, x + grid.cardW / 2, grid.cardH / 2, card, grid.cardW / CARD_W, undefined, this.ownedVariantFor(card.id)));
          if (card.id === picked) {
            row.add(this.add.graphics().lineStyle(3, colorInt(theme.colors.gold), 1).strokeRoundedRect(x - 1, -1, grid.cardW + 2, grid.cardH + 2, 8)
              .fillStyle(colorInt(theme.colors.gold), 1).fillCircle(x + grid.cardW - badge / 2 + 4, badge / 2 - 4, badge / 2));
            row.add(this.add.image(x + grid.cardW - badge / 2 + 4, badge / 2 - 4, bakeUiIcon(this, 'check'))
              .setDisplaySize(badge * 0.62, badge * 0.62).setTint(colorInt(theme.colors.onGold)));
          }
        });
        list.add(row);
        return row;
      };
      const cardsIn = (from: number, to: number): CardDef[] => candidates.slice(Math.max(0, from) * grid.columns, Math.max(0, to) * grid.columns);
      let at = 0;
      const showRows = (offset: number): void => {
        at = offset;
        const first = Math.floor(offset / pitchY);
        const last = Math.floor((offset + view.height) / pitchY);
        const span = Math.ceil(view.height / pitchY);
        art.show(this.thumbArtFor(cardsIn(first, last + 1)), this.thumbArtFor([...cardsIn(first - span, first), ...cardsIn(last + 1, last + 1 + span)]));
        rows.forEach((row, r) => {
          const near = r >= first - span && r <= last + span;
          if (near && !row) rows[r] = buildRow(r);
          else if (!near && row) {
            row.destroy();
            rows[r] = null;
          }
        });
      };
      const current = candidates.findIndex((card) => card.id === picked);
      const start = current >= 0 ? Math.max(0, Math.floor(current / grid.columns) * pitchY - pitchY / 2) : 0;
      const scroll = bindMenuScroll(this, list, view, rowCount * pitchY - BUILDER_COMPACT.rowGap, undefined, [], 0, undefined, start);
      scroll.onScroll = showRows;
      showRows(scroll.offset());
      const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
      c.add(zone);
      bindTapButton(this, zone, (pointer) => {
        if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || sceneHasOpenModal(this)) return;
        const hit = poolHitAt({ ...grid, pitchY }, candidates.length, pointer.worldX - view.x, pointer.worldY - view.y + scroll.offset(), () => false);
        if (!hit || candidates[hit.index].id === picked) return;
        picked = candidates[hit.index].id;
        // Redraw the rows on show with the new selection.
        rows.forEach((row, r) => {
          row?.destroy();
          rows[r] = null;
        });
        showRows(at);
        this.renderCompactColumn();
      });
    }, (layer, col) => {
      const card = picked ? CARD_DB[picked] : undefined;
      let y = col.y;
      if (card) {
        const name = this.add.text(col.x, y, card.name, {
          fontFamily: theme.fonts.ui, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
          wordWrap: { width: col.width },
        });
        layer.add(name);
        y += name.height + 6;
        const pip = Math.round(type.body * 1.4);
        let x = col.x;
        for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
          if (!(card.cost?.pips[color] ?? 0) || !this.textures.exists(`pip-${color}`)) continue;
          layer.add(this.add.image(x + pip / 2, y + pip / 2, `pip-${color}`).setDisplaySize(pip, pip));
          x += pip + 4;
        }
        layer.add(this.add.text(x + 4, y + pip / 2, 'Deck colors', {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
        }).setOrigin(0, 0.5));
        y += pip + 14;
      }
      const rules = this.add.text(col.x, y, DARLINGS_RULES_COPY, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body, wordWrap: { width: col.width }, lineSpacing: 2,
      });
      const full = rules.text;
      this.trimToHeight(rules, col.y + col.height - COMPACT.touch - COMPACT.gap - y);
      rules.setData('a11yFullText', full);
      layer.add(rules);
      this.compactFootPair(layer, col, { label: 'Cancel', onTap: () => this.closeCompactSheet() }, {
        label: 'Choose', enabled: picked !== null, onTap: () => {
          if (picked && this.chooseDarling(picked)) this.closeCompactSheet();
        },
      });
    });
  }

  /** A deck's card back or playmat (D-CardBackPicker): the choices as tiles, the picked one's blurb in the column, Equip. */
  private openCompactCosmetic(kind: 'cardBack' | 'playmat'): void {
    const active = this.activeSavedDeck();
    if (!active || !this.compactUi) return;
    const type = theme.compactType;
    const entries: readonly (CardBackDefinition | PlaymatDefinition)[] = kind === 'cardBack' ? CARD_BACKS : PLAYMATS;
    const defaultId = kind === 'cardBack' ? DEFAULT_CARD_BACK_ID : DEFAULT_PLAYMAT_ID;
    const equippedId = (): string => (kind === 'cardBack' ? active.cardBack : active.playmat) ?? defaultId;
    const owned = this.save.cosmetics.owned;
    let picked = equippedId();
    let drawTiles: () => void = () => {};
    this.openCompactSheet('cosmetic', (c, frame) => {
      const pad = BUILDER_COMPACT.sheetPad;
      const bodyY = this.compactSheetHead(c, frame, kind === 'cardBack' ? 'Card back' : 'Playmat', `Style for ${active.name}. This deck only.`);
      const body = { x: frame.x + pad, y: bodyY, width: frame.width - pad * 2, height: frame.y + frame.height - pad - bodyY };
      const tiles = tileGrid(body, entries.length, 3, 12);
      let layer: Phaser.GameObjects.Container | null = null;
      drawTiles = () => {
        layer?.destroy();
        layer = this.add.container(0, 0);
        c.add(layer);
        entries.forEach((entry, i) => {
          const r = tiles[i];
          const chosen = entry.id === picked;
          const unlocked = isCosmeticOwned(entry.id, owned);
          layer!.add(this.add.graphics()
            .fillStyle(chosen ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
            .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel)
            .lineStyle(chosen ? 2 : theme.control.borderWidth, chosen ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, chosen ? 1 : theme.alpha.chrome)
            .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel));
          const name = this.add.text(r.x + r.width / 2, 0, entry.name, {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
            align: 'center', wordWrap: { width: r.width - 12 },
          }).setOrigin(0.5, 0);
          const equipped = entry.id === equippedId();
          const tagText = equipped ? 'EQUIPPED' : unlocked ? '' : 'LOCKED';
          const tag = this.add.text(r.x + r.width / 2, 0, tagText, {
            fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, letterSpacing: 1,
            color: equipped ? theme.colors.success : theme.colors.muted,
          }).setOrigin(0.5, 0);
          const tagH = tagText ? tag.height : 0;
          const previewH = Math.max(0, r.height - 12 - name.height - tagH - 10);
          tag.setY(r.y + r.height - 6 - tagH);
          name.setY(tag.y - name.height - 2);
          const cx = r.x + r.width / 2;
          const cy = r.y + 6 + previewH / 2;
          if ('colors' in entry) {
            const g = this.add.graphics();
            const w = Math.min(r.width - 16, previewH * 1.4);
            const h = Math.min(previewH, w / 1.4);
            this.paintCompactStage(g, { x: cx - w / 2, y: cy - h / 2, width: w, height: h }, entry, 6);
            layer!.add(g);
          } else {
            const h = previewH;
            layer!.add(this.add.image(cx, cy, safeCardBackTexture(this, entry)).setDisplaySize(h / 1.4, h).setAlpha(unlocked ? 1 : 0.45));
          }
          layer!.add([name, tag]);
          const zone = this.add.zone(cx, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
          bindTapButton(this, zone, (pointer) => {
            if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || sceneHasOpenModal(this) || picked === entry.id) return;
            picked = entry.id;
            drawTiles();
            this.renderCompactColumn();
          });
          layer!.add(zone);
        });
      };
      drawTiles();
    }, (layer, col) => {
      const entry = entries.find((e) => e.id === picked) ?? entries[0];
      const name = this.add.text(col.x, col.y, entry.name, {
        fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        wordWrap: { width: col.width },
      });
      const blurb = this.add.text(col.x, name.y + name.height + 6, entry.blurb, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: col.width },
      });
      this.trimToHeight(blurb, col.y + col.height - COMPACT.touch - COMPACT.gap - blurb.y);
      layer.add([name, blurb]);
      const unlocked = isCosmeticOwned(entry.id, owned);
      const equipped = entry.id === equippedId();
      this.compactFootPair(layer, col, { label: 'Close', onTap: () => this.closeCompactSheet() }, {
        label: equipped ? 'Equipped' : unlocked ? 'Equip' : 'Locked', enabled: unlocked && !equipped, onTap: () => {
          const deck = this.activeSavedDeck();
          if (!deck) return;
          // The catalog default persists as null, as on desktop.
          const value = entry.id === defaultId ? null : entry.id;
          if (kind === 'cardBack') deck.cardBack = value;
          else deck.playmat = value;
          if (!this.fixtureSave) Services.save.touch();
          this.closeCompactSheet(false);
          this.renderDeck();
        },
      });
    });
  }

  /** The deck's land styles: the five basics, each tapped to cycle its art. Dual lands keep their own. */
  private openCompactLandStyles(): void {
    const active = this.activeSavedDeck();
    if (!active || !this.compactUi) return;
    const type = theme.compactType;
    this.openCompactSheet('landStyles', (c, frame) => {
      const pad = BUILDER_COMPACT.sheetPad;
      const bodyY = this.compactSheetHead(c, frame, 'Land styles', 'Tap a land to change its art.');
      const body = { x: frame.x + pad, y: bodyY, width: frame.width - pad * 2, height: frame.y + frame.height - pad - bodyY };
      const tiles = tileGrid(body, BASIC_LAND_IDS.length, BASIC_LAND_IDS.length, 10);
      const art = new PagedArt(this, 'land-styles', { owner: c });
      const wants = new Map<string, string | null>();
      const drawTile = (id: BasicLandId, i: number, layer: Phaser.GameObjects.Container): void => {
        const r = tiles[i];
        const style = this.activeSavedDeck()?.landStyle?.[id] ?? null;
        const label = this.add.text(r.x + r.width / 2, 0, style ? SET_TITLES[style] ?? style : 'Default art', {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600,
          color: style ? theme.colors.gold : theme.colors.muted, align: 'center', wordWrap: { width: r.width },
        }).setOrigin(0.5, 0);
        const faceH = Math.max(0, Math.min(r.height - label.height - 8, (r.width - 4) * 1.4));
        label.setY(r.y + faceH + 6);
        const card = byId(id);
        const variant = this.ownedVariantFor(id);
        layer.add([makeCardThumb(this, r.x + r.width / 2, r.y + faceH / 2, card, faceH / CARD_FACE_H, style ?? undefined, variant), label]);
        wants.set(id, thumbArtWanted(this, card, style ?? undefined, variant)?.key ?? null);
      };
      BASIC_LAND_IDS.forEach((id, i) => {
        let layer = this.add.container(0, 0);
        c.add(layer);
        drawTile(id, i, layer);
        const r = tiles[i];
        const zone = this.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
        bindTapButton(this, zone, (pointer) => {
          if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || sceneHasOpenModal(this)) return;
          this.cycleLandStyle(id, false);
          layer.destroy();
          layer = this.add.container(0, 0);
          c.addAt(layer, c.getIndex(zone));
          drawTile(id, i, layer);
          art.show([...wants.values()].filter((key): key is string => key !== null));
        });
        c.add(zone);
      });
      art.show([...wants.values()].filter((key): key is string => key !== null));
    }, (layer, col) => {
      const note = this.add.text(col.x, col.y, 'A style dresses the basic lands in this deck\'s Warchest and list. It saves as you choose it.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: col.width },
      });
      this.trimToHeight(note, col.y + col.height - COMPACT.touch - COMPACT.gap - col.y);
      const done = compactButton(this, { x: col.x, y: col.y + col.height - COMPACT.touch, width: col.width, height: COMPACT.touch }, 'Done', {
        variant: 'primary', onTap: () => this.closeCompactSheet(),
      });
      layer.add([note, done.container]);
    }, () => this.renderDeck());
  }

  // --- Your Decks

  /** Your Decks (D-Decks) over the builder: the previewed deck in the main pane, the list in the column. */
  private openCompactDecks(focusDeckId?: string): void {
    const ui = this.compactUi;
    if (!ui) return;
    this.closeCompactSheet(false);
    ui.hold?.timer.remove();
    ui.hold = null;
    ui.decks?.container?.destroy();
    ui.decks = { container: null, scroll: null, previewId: focusDeckId ?? this.workingDeckId, listOffset: 0, focus: true };
    ui.header?.setVisible(false);
    ui.mainLayer?.setVisible(false);
    ui.columnLayer?.setVisible(false);
    this.syncCompactDom();
    this.renderCompactDecks();
  }

  private closeCompactDecks(): void {
    const ui = this.compactUi;
    if (!ui?.decks) return;
    ui.decks.container?.destroy();
    ui.decks = null;
    this.syncCompactDom();
    this.renderCompactHeader();
    this.renderCompactMain();
    this.renderCompactColumn();
  }

  private renderCompactDecks(): void {
    const ui = this.compactUi;
    const state = ui?.decks;
    if (!ui || !state) return;
    if (state.scroll) state.listOffset = state.scroll.offset();
    state.container?.destroy();
    const type = theme.compactType;
    const { touch, gap } = COMPACT;
    const c = this.add.container(0, 0).setDepth(theme.depth.overlay);
    state.container = c;
    state.scroll = null;
    c.setData('a11ySurface', ui.content);
    const save = this.save;
    const decks = visibleSavedDecks(save.decks, this.reserveFormatsEnabled);
    if (!decks.some((deck) => deck.id === state.previewId)) state.previewId = this.workingDeckId ?? decks[0]?.id ?? null;
    const preview = decks.find((deck) => deck.id === state.previewId) ?? null;
    const L = decksScreen(ui.content, ui.largeText);
    const back = compactIconButton(this, ui.bar.back, 'back', () => this.closeCompactDecks());
    const title = this.add.text(ui.bar.title.x, 0, 'Your Decks', {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    title.setY(ui.content.y + (touch - title.height) / 2);
    c.add([back.container, title]);
    const art = new PagedArt(this, 'deck-list', { owner: c });
    const artKeys: string[] = [];

    const deckFormat = (deck: SavedDeck): BuilderFormat => deck.format === 'darlings' || deck.format === 'warchest' ? deck.format : 'constructed';
    if (preview) {
      const format = deckFormat(preview);
      const repair = deckHealth(CARD_DB, save, preview);
      const blockKind = deckBlockKind(preview, repair.blocked, this.classicRetired);
      const hero = this.deckPickerHero(preview);
      this.addDeckHeroPortrait(c, L.face.x + L.face.width / 2, L.face.y + L.face.height / 2, hero, L.face.width, L.face.height);
      if (hero.cardId) {
        const wanted = thumbArtWanted(this, CARD_DB[hero.cardId], undefined, this.ownedVariantFor(hero.cardId));
        if (wanted) artKeys.push(wanted.key);
      }
      const info = L.info;
      const name = this.add.text(info.x, info.y, preview.name, {
        fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        wordWrap: { width: info.width },
      });
      this.trimToHeight(name, Math.ceil(name.height / Math.max(1, name.getWrappedText().length)) * 2);
      let y = name.y + name.height + 4;
      const formatLine = this.add.text(info.x, y, formatLabel(format).toUpperCase(), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, letterSpacing: 1, color: theme.colors.muted,
      });
      c.add([name, formatLine]);
      if (blockKind) {
        c.add(this.add.text(formatLine.x + formatLine.width, y, ` · ${deckBlockLabel(blockKind)}`, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.danger,
        }));
      }
      y += formatLine.height + 10;
      const full = preview.cards.length === formatDeckSize(format);
      const count = this.add.text(info.x, y, `${preview.cards.length}/${formatDeckSize(format)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.h1 + 6}px`, fontStyle: theme.weight.w700,
        color: repair.blocked ? theme.colors.danger : full ? theme.colors.success : theme.colors.gold,
      });
      c.add(count);
      const pip = Math.round(type.body * 1.4);
      const colors = this.deckColorOrder(preview.cards);
      colors.slice(0, 5).forEach((color, i) => {
        c.add(this.add.image(count.x + count.width + 12 + pip / 2 + i * (pip + 4), y + count.height / 2, `pip-${color}`).setDisplaySize(pip, pip));
      });
      y += count.height + 8;
      const heroLine = this.add.text(info.x, y, preview.format === 'darlings' ? `Darling: ${hero.name}` : `Hero image: ${hero.name}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: info.width },
      });
      this.trimToHeight(heroLine, L.actions[0].y - gap - y);
      c.add(heroLine);
      const actions: { label: string; variant: ThemedButtonVariant; onTap: () => void }[] = [
        { label: 'Copy', variant: 'ghost', onTap: () => this.compactCopyDeck(preview) },
        { label: 'Rename', variant: 'ghost', onTap: () => this.promptRename(preview.id, () => this.renderCompactDecks()) },
        { label: 'Delete', variant: 'danger', onTap: () => this.compactDeleteDeck(preview) },
      ];
      actions.forEach((action, i) => {
        const button = compactButton(this, L.actions[i], action.label, { variant: action.variant, onTap: action.onTap });
        if (button.label.width > L.actions[i].width - 12) {
          button.label.setFontSize(type.label);
          button.setLabel(action.label);
        }
        c.add(button.container);
      });
    } else {
      c.add(this.add.text(L.face.x, L.face.y, 'No decks yet. Start one with New deck.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: L.info.x + L.info.width - L.face.x },
      }));
    }

    // The list: each deck's portrait, its name, and its format with Using or what blocks it.
    const view = L.list;
    const rowW = view.width - BUILDER_COMPACT.thumbLane;
    const nameStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700 };
    const subStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px` };
    const probe = this.add.text(0, 0, 'Deck', nameStyle);
    const probeSub = this.add.text(0, 0, 'Standard', subStyle);
    const rowH = Math.max(touch + 8, Math.ceil(probe.height + probeSub.height + 14));
    probe.destroy();
    probeSub.destroy();
    const pitch = rowH + gap;
    const list = this.add.container(0, view.y);
    c.add(list);
    decks.forEach((deck, i) => {
      const y = i * pitch;
      const previewed = deck.id === state.previewId;
      const using = deck.id === this.workingDeckId;
      list.add(this.add.graphics()
        .fillStyle(previewed ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(view.x, y, rowW, rowH, theme.radius.panel)
        .lineStyle(previewed ? 2 : theme.control.borderWidth, previewed ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, previewed ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(view.x, y, rowW, rowH, theme.radius.panel));
      const portrait = { x: view.x + 6, y: y + 6, width: rowH - 12, height: rowH - 12 };
      const hero = this.deckPickerHero(deck);
      let drawn = false;
      if (hero.cardId) {
        try {
          const image = addPortraitArt(this, portrait.x, portrait.y, hero.cardId, (img) => coverFitImage(img, portrait, 0.15), 'half');
          if (image) {
            list.add(image);
            drawn = true;
          }
        } catch {
          // No art: the plain plate stands in.
        }
      } else if (hero.textureKey && this.textures.exists(hero.textureKey)) {
        const image = this.add.image(0, 0, hero.textureKey);
        coverFitImage(image, portrait, 0.15);
        list.add(image);
        drawn = true;
      }
      if (!drawn) list.add(this.add.rectangle(portrait.x + portrait.width / 2, portrait.y + portrait.height / 2, portrait.width, portrait.height, theme.graphics.panelFill, 1));
      const textX = portrait.x + portrait.width + 10;
      const textW = view.x + rowW - 8 - textX;
      const name = this.add.text(textX, 0, '', { ...nameStyle, color: theme.colors.heading });
      ellipsizeText(name, textW, deck.name);
      const blocked = deckHealth(CARD_DB, save, deck).blocked;
      const kind = deckBlockKind(deck, blocked, this.classicRetired);
      const format = this.add.text(textX, 0, formatLabel(deckFormat(deck)), { ...subStyle, color: theme.colors.muted });
      const tail = using ? ' · Using' : kind ? ` · ${deckBlockLabel(kind)}` : '';
      const mark = this.add.text(textX + format.width, 0, '', {
        ...subStyle, fontStyle: theme.weight.w600, color: using ? theme.colors.gold : theme.colors.danger,
      });
      ellipsizeText(mark, Math.max(0, textW - format.width), tail);
      const top = y + (rowH - name.height - format.height) / 2;
      name.setY(top);
      format.setY(top + name.height);
      mark.setY(format.y);
      list.add([name, format, mark]);
    });
    let offset = state.listOffset;
    if (state.focus) {
      const index = decks.findIndex((deck) => deck.id === state.previewId);
      // Scroll the least whole rows that bring it into view, so the list's first row is never cut.
      if (index >= 0) offset = Math.max(0, Math.ceil((index * pitch + rowH - view.height) / pitch) * pitch);
      state.focus = false;
    }
    const scroll = bindMenuScroll(this, list, view, Math.max(0, decks.length * pitch - gap), undefined, [], 0, undefined, offset);
    state.scroll = scroll;
    const zone = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height).setInteractive({ useHandCursor: true });
    c.add(zone);
    bindTapButton(this, zone, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || sceneHasOpenModal(this)) return;
      const at = pointer.worldY - view.y + scroll.offset();
      const i = Math.floor(at / pitch);
      if (i < 0 || i >= decks.length || at - i * pitch > rowH || decks[i].id === state.previewId) return;
      state.previewId = decks[i].id;
      this.renderCompactDecks();
    });
    for (const deck of decks) {
      const hero = this.deckPickerHero(deck);
      if (hero.cardId) artKeys.push(...this.thumbArtFor([CARD_DB[hero.cardId]]));
    }
    art.show(artKeys);

    const newDeck = compactButton(this, L.newDeck, 'New deck', {
      icon: 'plus', onTap: () => this.showNewDeckFormatPrompt((format) => this.compactCreateDeck(format)),
    });
    const editing = preview !== null && preview.id === this.workingDeckId;
    const use = compactButton(this, L.use, editing ? 'Edit deck' : 'Use', {
      variant: 'primary', onTap: () => {
        if (!preview) return;
        if (!editing) this.useDeck(preview.id);
        this.closeCompactDecks();
      },
    });
    for (const [button, label, rect] of [[newDeck, 'New deck', L.newDeck], [use, editing ? 'Edit deck' : 'Use', L.use]] as const) {
      if (button.labelRight() > rect.width - 16) {
        button.label.setFontSize(type.label);
        button.setLabel(label);
      }
    }
    use.setEnabled(preview !== null);
    c.add([newDeck.container, use.container]);
  }

  private compactCopyDeck(deck: SavedDeck): void {
    const save = this.save;
    const id = copyDeck(save, deck.id);
    if (!id) return;
    const copy = save.decks.find((d) => d.id === id);
    if (copy) this.acknowledgeUnplayableDeck(copy);
    this.flush();
    const state = this.compactUi?.decks;
    if (state) {
      state.previewId = id;
      state.focus = true;
    }
    this.renderCompactDecks();
  }

  /** Delete the previewed deck; with Confirm destructive actions on, a dialog asks first (D-DeleteDeck). */
  private compactDeleteDeck(deck: SavedDeck): void {
    const run = (): void => {
      const save = this.save;
      const wasWorking = deck.id === this.workingDeckId;
      deleteDeck(save, deck.id);
      if (wasWorking) {
        // The next visible deck becomes the one being edited, with its own baseline.
        this.loadWorkingDeck(activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled));
        this.deckPaneMode = defaultDeckPaneMode();
        this.renderPool();
        this.renderDeck();
      }
      this.flush();
      const state = this.compactUi?.decks;
      if (state) state.previewId = this.workingDeckId;
      this.renderCompactDecks();
    };
    if (!this.save.settings.confirmDestructive) {
      run();
      return;
    }
    this.compactNotice({
      title: 'Delete deck?',
      message: `${deck.name} will be deleted. ${DECK_DELETE_NOTE}`,
      dismissal: 'dismissible',
      secondary: { label: 'Cancel', onTap: (close) => close() },
      primary: { label: 'Delete', variant: 'danger', onTap: (close) => { close(); run(); } },
    });
  }

  /** New deck from Your Decks: it opens in the builder, a Darlings deck with her chooser. */
  private compactCreateDeck(format: BuilderFormat): void {
    const id = this.createNewDeck(format);
    this.useDeck(id);
    this.closeCompactDecks();
    if (format === 'darlings') this.openDarlingsFormat();
  }

  /** A compact dialog over the builder; the DOM fields hide while it is open, as no canvas dim can cover them. */
  private compactNotice(opts: Omit<Parameters<typeof compactDialog>[1], 'onClose'> & { onClose?: () => void }): ModalShell {
    const ui = this.compactUi;
    if (ui) {
      ui.dialogs += 1;
      this.syncCompactDom();
    }
    return compactDialog(this, {
      ...opts,
      onClose: () => {
        opts.onClose?.();
        if (ui && this.compactUi === ui) {
          ui.dialogs = Math.max(0, ui.dialogs - 1);
          this.syncCompactDom();
        }
      },
    });
  }

  /** D-Unsaved: Keep editing, Leave without saving (or Discard changes), and Save deck, which always works (D10). */
  private confirmUnsavedCompact(path: UnsavedChangesPath, proceed: () => void): void {
    const copy = unsavedChangesCopy(path, this.currentIssues().some((issue) => issue.kind === 'error'));
    const staying = path !== 'leave';
    const discard = copy.discardLabel.charAt(0) + copy.discardLabel.slice(1).toLowerCase();
    const shell = this.compactNotice({
      title: 'Unsaved changes',
      message: copy.body,
      dismissal: 'dismissible',
      onClose: () => {
        if (this.unsavedPrompt === shell) this.unsavedPrompt = null;
      },
      secondary: { label: 'Keep editing', onTap: (close) => close() },
      middle: {
        label: discard,
        variant: 'danger',
        onTap: (close) => {
          close();
          restoreDeckBaseline(this.save.decks, this.savedDeckSnapshot, this.workingDeckId);
          this.flush();
          if (staying) {
            // Same deck, so its baseline stays; the working copy returns to it.
            this.loadWorkingDeck(this.activeSavedDeck());
            this.renderPool();
            this.renderDeck();
          }
          proceed();
        },
      },
      primary: {
        label: 'Save deck',
        onTap: (close) => {
          close();
          this.saveWorkingDeck();
          if (staying) {
            this.renderPool();
            this.renderDeck();
          }
          proceed();
        },
      },
    });
    this.unsavedPrompt = shell;
  }

  /** The repair list as a dialog: every blocking issue, and the bulk land removal a migrated deck needs. */
  private showCompactRepair(blocking: ReturnType<typeof validateDeck>, lands: number): void {
    const kind = deckBlockKind(
      { format: this.activeFormat(), cards: this.deck, landReserve: this.landReserve, darlingId: this.activeDarlingId() },
      true,
      this.classicRetired,
    );
    this.compactNotice({
      title: kind === 'unfinished' ? deckBlockLabel(kind) : 'Repair deck',
      message: [
        `${blocking.length} blocking ${blocking.length === 1 ? 'issue keeps' : 'issues keep'} this deck out of a duel.`,
        blocking.map((issue) => `• ${issue.message}`).join('\n'),
      ],
      dismissal: 'dismissible',
      ...(lands > 0
        ? { secondary: { label: `Remove ${lands} land${lands === 1 ? '' : 's'}`, variant: 'danger' as const, onTap: (close: () => void) => {
          close();
          this.removeAllLands();
        } } }
        : {}),
      primary: { label: 'Back to editing', onTap: (close) => close() },
    });
  }
}
