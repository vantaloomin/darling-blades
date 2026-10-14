import Phaser from 'phaser';
import { formatCount, formatGold } from '../ui/goldFormat';
import { IS_DEV } from '../platform/env';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import {
  craftCard,
  craftCost,
  displayVariantFor,
  ownedCount,
  PLAYSET,
  shardableCount,
  shardExcess,
  shardGold,
} from '../meta/Collection';
import {
  applyFilters,
  clampPage,
  collectionCompletion,
  collectionDisplayPool,
  collectiblePool,
  defaultFilterState,
  ownedVariantEntries,
  pageCount,
  pageNeighbourhood,
  pageSlice,
  specialVariantCount,
  variantLabel,
  type CollectionFilterState,
} from '../meta/collectionFilter';
import { Services } from '../meta/services';
import type { SaveData } from '../meta/SaveManager';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { PLAIN_VARIANT, TIER_LABEL, variantKey, type CardVariant } from '../meta/variants';
import { finishOdds, formatOdds } from '../meta/pullOdds';
import { bindTapButton, isTouchDevice } from '../platform/gestures';
import {
  collectionSetOptions,
  COLLECTION_COLOR_OPTIONS,
  COLLECTION_RARITY_OPTIONS,
  COLLECTION_TYPE_OPTIONS,
  FilterBar,
  TIER_TEXT_COLOR,
} from '../ui/binder/FilterBar';
import type { DropdownOption } from '../ui/Dropdown';
import { COMPACT, compactShell, DESKTOP_GRID, isDesktopStage } from '../ui/compactLayout';
import {
  compactButton,
  compactDialog,
  compactHeader,
  compactIconButton,
  compactPurse,
  COMPACT_DRAG_SLOP,
  type CompactButton,
} from '../ui/compactWidgets';
import {
  binderCellAt,
  binderColumn,
  binderGrid,
  binderHeight,
  COLLECTION_COMPACT,
  compactInspectLayout,
  stackUp,
} from '../ui/collectionCompact';
import { bindMenuScroll, type MenuScrollHandle } from '../ui/menuScroll';
import { ellipsizeText } from '../ui/textFit';
import { bakeUiIcon } from '../ui/uiIcons';
import { cardGlossaryEntries, rulesText, typeLine } from '../ui/rulesText';
import { controlStrokeWidth, themedButtonColors } from '../ui/controlStyle';
import { SET_TITLES } from '../data/setTitles';
import { makeCardThumb, thumbArtWanted } from '../ui/CardThumbCache';
import { CARD_H, CARD_W, CardView } from '../ui/CardView';
import {
  cardAtelierProbabilityPlate,
  cardAtelierTiltPose,
  cardAtelierWipeDuration,
  cardAtelierWipeFromPointer,
  cardAtelierWipeProgress,
  type CardAtelierTiltPose,
} from '../ui/cardAtelierPresentation';
import { SHARD_HOLD_BUTTON_PROGRESS } from '../ui/duelPresentation';
import { FRAME_TREATMENTS } from '../ui/CardFrameFactory';
import { fxAvailable, fxPolicy } from '../ui/fx/FXSupport';
import {
  COLLECTION_SORT_OPTIONS,
  DEFAULT_COLLECTION_SORT,
  SORT_DIRECTION_LABELS,
  sortCollectionCards,
  sortDirectionLabel,
  type CollectionSort,
  type CollectionSortKey,
} from '../ui/collectionSort';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { rarityLine } from '../ui/CardZoomPreview';
import { ModalGuard } from '../ui/Modal';
import { gateOnPagedArt, PAGE_ART_HOLD_MS, PagedArt } from '../ui/artGate';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import {
  SHARD_GOLD_COUNT_UP_MS,
  shardCountUpValue,
  shardDissolveDuration,
  shardHoldDuration,
  shardMoteCount,
} from '../ui/shardRitual';
import { HEADER_CURRENCY_ANCHOR, type Rect } from '../ui/layout';
import { sceneTitle } from '../ui/sceneTitle';
import { currentAccessibility } from '../ui/accessibility';
import { fitMenuName } from '../ui/menuText';
import {
  collectionActionLayout,
  collectionBinderLayout,
  collectionHeaderLayout,
  collectionInspectColumns,
  collectionProbabilityLayout,
  collectionVariantLayout,
  type CollectionA11yFixture,
  type CollectionFilterName,
} from '../ui/collectionPresentation';
import { colorInt, theme } from '../ui/theme';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { Toast } from '../ui/Toast';
import {
  backButton,
  goldBadge,
  modalShell,
  pager,
  PAGER_CENTER_OFFSET,
  registerSceneBackNavigation,
  themedButton,
  type GoldBadge,
  type ModalShell,
  type Pager,
  type ThemedButton,
} from '../ui/themeWidgets';

// Design canvas (Scale.FIT). All layout is in 1280×720 DESIGN px — never
// this.scale.*: at renderScale k the canvas is 1280k×720k but the camera
// still shows the 1280×720 design window (src/ui/SceneBackdrop.ts).
const DESIGN_W = 1280;
const DESIGN_H = 720;

// The inspect dim opens on a thumb's pointerup; a habitual double-click would
// then land its second click on the (now topmost) dim and close the overlay
// instantly. Ignore dim closes for this long after opening so a double-click
// doesn't flash the card open-and-shut; a deliberate click a beat later closes.
const INSPECT_CLOSE_LOCK_MS = 300;

/** How long an armed Craft waits for its second press, as Gauntlet's Abandon does. */
const CRAFT_ARM_MS = 4000;

// Two pages of three by two pockets. The faces use specialist card geometry;
// the measured filter band and live-size badges determine their available space.
const COLS_PER_PAGE = 3;
const ROWS_PER_PAGE = 2;
const SPREAD_SIZE = COLS_PER_PAGE * ROWS_PER_PAGE * 2; // 12 pockets per spread

/** The counter's specials: "1 special card", "88 special cards". */
function specialCardsLabel(count: number): string {
  return `${formatCount(count)} special ${count === 1 ? 'card' : 'cards'}`;
}

/** A sort as one phone choice: the criterion and its direction ("Card rarity: high first"). */
function compactSortLabel(sort: CollectionSort): string {
  const name = COLLECTION_SORT_OPTIONS.find((option) => option.value === sort.key)?.label ?? sort.key;
  const direction = sortDirectionLabel(sort);
  return `${name}: ${direction.charAt(0).toLowerCase()}${direction.slice(1)}`;
}

/** Collection binder: paginated two-page spread with facet filters, sorting,
 * variant badges and a variant-showcase inspect overlay. */
export class CollectionScene extends Phaser.Scene {
  private fixture: CollectionA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private binder = collectionBinderLayout(200);
  private binderChrome: Phaser.GameObjects.Graphics | null = null;
  private get saveData(): SaveData { return this.fixtureSave ?? Services.save.data; }
  private get cards(): readonly CardDef[] { return this.fixture?.cards ?? ALL_CARDS; }
  private flushSave(): void { if (!this.fixture) Services.save.flush(); }
  // Open on the player's OWNED cards by default (the binder is about what you
  // have); the Owned toggle flips back to the full pool. defaultFilterState()
  // stays neutral so the pure filter + its tests are unaffected.
  private state: CollectionFilterState = { ...defaultFilterState(), ownedOnly: true };
  private page = 0;
  private sortSelection: CollectionSort = { ...DEFAULT_COLLECTION_SORT };
  /** Interactive thumbs of the current page (ModalGuard targets). */
  private cells: Phaser.GameObjects.GameObject[] = [];
  private guardTargets: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();
  private filterBar!: FilterBar;
  private pageContainer: Phaser.GameObjects.Container | null = null;
  /** Containers still tweening out of view — reaped on filter changes. */
  private outgoing: Phaser.GameObjects.Container[] = [];
  /** The binder's art requests: the spread on show and the spreads either side of it. */
  private spreadArt: PagedArt | null = null;
  /** The cards of the spread last asked for, so a refresh of the same spread (new badges) swaps at once. */
  private spreadCards = '';
  private turning = false;
  private pageControl!: Pager;
  private goldBadge!: GoldBadge;
  private counterText!: Phaser.GameObjects.Text;
  private completionText!: Phaser.GameObjects.Text;
  private emptyText!: Phaser.GameObjects.Text;
  private inspect: Phaser.GameObjects.Container | null = null;
  /** The card the inspect overlay is showing — the ←/→ step anchor. */
  private inspectDef: CardDef | null = null;
  /** Live holo pointer feed — MUST be unhooked on inspect close. */
  private holoMove: ((p: Phaser.Input.Pointer) => void) | null = null;
  /** Cancels a release ritual if the inspect card is closed or rebuilt mid-flight. */
  private inspectRitualCleanup: (() => void) | null = null;
  /**
   * A shard changed the counts but the binder beneath the overlay has not
   * re-rendered yet. The ritual's own finish re-renders it; if the overlay
   * closes first, closeInspect does, so a thumb never keeps a stale ×N / ✦N.
   */
  private binderStale = false;
  /** The DOM search <input> — hidden while the inspect overlay is open (DOM
   * elements always float above the canvas, so the dim can't cover it). */
  private searchInput: SearchInputHandle | null = null;
  /** The phone composition's parts (docs/plan-mobile-overhaul.md, mobile wave 2); null on desktop. */
  private compactParts: {
    main: Rect;
    column: Rect;
    back: Phaser.GameObjects.Zone;
    columnLayer: Phaser.GameObjects.Container | null;
    columnZones: Phaser.GameObjects.Zone[];
    list: Phaser.GameObjects.Container | null;
    tap: Phaser.GameObjects.Zone | null;
    scroll: MenuScrollHandle | null;
    /** The facet whose picker has the column, if one does, and where its list was scrolled. */
    picker: CollectionFilterName | null;
    pickerOffset: number;
    pickerScroll?: MenuScrollHandle;
  } | null = null;
  private readonly onPreviousKey = (): void => this.onArrowKey(-1);
  private readonly onNextKey = (): void => this.onArrowKey(1);

  constructor() {
    super('Collection');
  }

  /**
   * The binder pages through the whole set. While art streams through the
   * store it builds at once and asks for art spread by spread (`renderPage`);
   * with the 1.8 queue it waits for the whole set, as it always did.
   */
  create(data: { a11yFixture?: CollectionA11yFixture } = {}): void {
    this.data.set('a11yReady', false);
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save ?? Services.save.data) : null;
    if (this.fixtureSave && this.fixture?.gold !== undefined) this.fixtureSave.gold = this.fixture.gold;
    this.sys.settings.data = {};
    gateOnPagedArt(this, () => this.build());
  }
  private build(): void {
    this.state = { ...defaultFilterState(), ownedOnly: true, ...this.fixture?.filter };
    this.page = 0;
    this.sortSelection = { ...DEFAULT_COLLECTION_SORT };
    this.cells = [];
    this.guardTargets = [];
    this.guard = new ModalGuard();
    new Toast(this, { modalGuard: this.guard });
    this.pageContainer = null;
    this.outgoing = [];
    this.spreadArt = new PagedArt(this, 'collection');
    this.spreadCards = '';
    this.turning = false;
    this.inspect = null;
    this.inspectDef = null;
    this.holoMove = null;
    this.inspectRitualCleanup = null;
    this.binderStale = false;
    this.binderChrome = null;

    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback.
    applyBackdrop(this, 'collection', {
      dim: colorInt(theme.colors.dim),
      // 0.70 (2026-07-03 calibration): keeps the grid region under the ≤12%
      // effective-luminance cap so 0.32-alpha unowned thumbs keep separating.
      dimAlpha: 0.7,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.dim),
          colorInt(theme.colors.dim),
          1,
        );
        bg.fillRect(0, 0, DESIGN_W, DESIGN_H);
      },
    });
    this.binderChrome = this.add.graphics();
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed
    this.compactParts = null;
    if (sceneStage(this).compact) {
      this.buildCompact();
      return;
    }

    // Title and currency share the navigation track. Search and collection
    // statistics have their own measured band before the wrapping filters.
    sceneTitle(this, 'Collection');
    // Crafting spends gold here, so keep the shared currency badge beside the
    // collection stats and refresh it with the binder view.
    this.goldBadge = goldBadge(this, HEADER_CURRENCY_ANCHOR.x, HEADER_CURRENCY_ANCHOR.y, {
      flashOnChange: true, getValue: () => this.saveData.gold,
    });
    this.counterText = this.add
      .text(theme.design.safeRight, 0, '0/0 collected', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0);
    this.completionText = this.add
      .text(theme.design.safeRight, 0, '0% pool · 0 special cards', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0);
    const header = collectionHeaderLayout(this.counterText.height, this.completionText.height);
    this.counterText.setY(header.counterY);
    this.completionText.setY(header.completionY);
    const back = backButton(this, 'Menu', () => this.scene.start('MainMenu'));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    this.filterBar = new FilterBar(this, this.state, {
      y: header.filterTop + theme.control.minHitHeight / 2,
      sortControl: {
        options: COLLECTION_SORT_OPTIONS,
        get: () => this.sortSelection.key,
        // A new criterion starts in its own default direction, so Name never
        // opens on Z to A because Card rarity was flipped (UI review 2026-10-09).
        set: (value) => {
          this.sortSelection = { key: value as CollectionSortKey, reversed: false };
        },
        direction: {
          label: () => sortDirectionLabel(this.sortSelection),
          labels: SORT_DIRECTION_LABELS,
          flip: () => {
            this.sortSelection = { ...this.sortSelection, reversed: !this.sortSelection.reversed };
          },
        },
      },
      onChange: () => {
        this.page = 0;
        this.renderPage();
      },
    });

    // The DOM input takes the filter grid's first column, so its edges share
    // the Set filter's column lines, and feeds the same filtered pool.
    const searchWidth = this.filterBar.columnWidth;
    this.searchInput = createSearchInput(this, header.search.x + searchWidth / 2, header.search.y, {
      width: searchWidth,
      placeholder: 'Name, type, trait, mechanic…',
      accessibleName: 'Search cards by name, type, trait, or mechanic',
      onChange: (value) => {
        this.state.search = value;
        this.page = 0;
        this.renderPage();
      },
    });

    this.pageControl = pager(this, DESIGN_W / 2 - PAGER_CENTER_OFFSET, theme.design.footerCenterY, this.page, 1, (page) => {
      const direction = page > this.page ? 1 : -1;
      this.page = page;
      this.renderPage(direction);
    });
    // Only vertical wheel motion turns pages. Horizontal trackpad pans and
    // tilt-wheels emit dy === 0 with dx !== 0; without this guard the `dy > 0`
    // test would read every such event as a page-back.
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (dy === 0) return;
      this.turnPage(dy > 0 ? 1 : -1);
    });
    // ←/→ keyboard navigation — like the wheel, keyboard bypasses ModalGuard,
    // so onArrowKey self-gates on the inspect overlay and the search input.
    this.input.keyboard?.on('keydown-LEFT', this.onPreviousKey);
    this.input.keyboard?.on('keydown-RIGHT', this.onNextKey);
    this.input.keyboard?.on('keydown-UP', this.onPreviousKey);
    this.input.keyboard?.on('keydown-DOWN', this.onNextKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-LEFT', this.onPreviousKey);
      this.input.keyboard?.off('keydown-RIGHT', this.onNextKey);
      this.input.keyboard?.off('keydown-UP', this.onPreviousKey);
      this.input.keyboard?.off('keydown-DOWN', this.onNextKey);
      this.inspectRitualCleanup?.();
      this.inspectRitualCleanup = null;
    });

    this.emptyText = this.add
      .text(DESIGN_W / 2, 390, 'No cards match these filters.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.guardTargets = [...this.filterBar.targets, this.pageControl.previous, this.pageControl.next, back];

    this.renderPage();
    if (this.fixture?.inspectCardId) {
      const card = this.cards.find((entry) => entry.id === this.fixture?.inspectCardId);
      if (card) this.showInspect(card, this.fixture.clearedDisplayPin);
    } else if (this.fixture?.openFilter) this.filterBar.open(this.fixture.openFilter);
    this.data.set('a11yReady', true);
  }

  /** Static open-binder art: two page slabs, spine, and the fixed pockets. */
  private drawBinderChrome(empty: boolean): void {
    const g = this.binderChrome!;
    g.clear();
    this.binder = collectionBinderLayout(this.filterBar.bottom + theme.space(3));
    // page slabs; an empty result draws one slab across the spread so its
    // message is centred on a surface, not across the spine and the pockets.
    const [left, right] = this.binder.pages;
    const slabs = empty ? [{ x: left.x, y: left.y, width: right.x + right.width - left.x, height: left.height }] : this.binder.pages;
    g.fillStyle(theme.graphics.panelFill, theme.alpha.chrome);
    for (const page of slabs) {
      g.fillRoundedRect(page.x, page.y, page.width, page.height, theme.radius.panel);
      g.lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, 1);
      g.strokeRoundedRect(page.x, page.y, page.width, page.height, theme.radius.panel);
    }
    this.emptyText.setY(left.y + left.height / 2).setVisible(empty);
    if (empty) return;
    // pockets — fixed; cards drop into them, badges sit on the lip below
    g.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    g.fillStyle(theme.graphics.rowFill, theme.alpha.subtle);
    for (const cx of this.binder.columns.flat()) {
      for (let row = 0; row < ROWS_PER_PAGE; row++) {
        const cy = this.binder.rowYs[row];
        const w = this.binder.faceWidth + theme.space(2);
        const h = this.binder.faceHeight + theme.space(2);
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
      }
    }
  }

  private currentPool(): CardDef[] {
    return sortCollectionCards(
      applyFilters(collectionDisplayPool(this.cards, this.saveData), this.state, this.saveData),
      this.sortSelection,
      this.saveData,
    );
  }

  /** ←/→: turn the spread in binder view; step the inspected card while the
   * overlay is open. The DOM search <input> keeps its caret keys — Phaser's
   * keyboard plugin listens on window and fires even while it has focus. */
  private onArrowKey(dir: number): void {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (this.inspect) this.stepInspect(dir);
    else if (!this.compactParts) this.turnPage(dir);
  }

  /** Step the inspect overlay to the adjacent card in the current filtered
   * pool (binder order), crossing spreads with the same renderPage-then-
   * showInspect rebuild the shard action already uses. Clamps at both ends. */
  private stepInspect(dir: number): void {
    const current = this.inspectDef;
    if (!current) return;
    const pool = this.currentPool();
    const index = pool.findIndex((d) => d.id === current.id);
    if (index < 0) return; // card left the filtered pool — stay put
    const target = index + dir;
    if (target < 0 || target >= pool.length) return;
    const targetPage = Math.floor(target / SPREAD_SIZE);
    if (!this.compactParts && targetPage !== this.page) {
      this.page = targetPage;
      this.renderPage();
    }
    this.showInspect(pool[target]);
  }

  private turnPage(dir: number): void {
    // Scene-level wheel bypasses ModalGuard — self-gate under the inspect
    // overlay, and don't stack page turns mid-tween.
    if (this.inspect || this.turning || this.filterBar.isOpen) return;
    const pool = this.currentPool();
    const target = clampPage(this.page + dir, pool.length, SPREAD_SIZE);
    if (target === this.page) return;
    this.page = target;
    this.renderPage(dir);
  }

  /**
   * Rebuild the spread. dir 0 = instant swap (filter change / first paint);
   * ±1 slides the old spread out and the new one in, with taps gated by
   * `turning` while anything moves (interactivity lives on child Images, so
   * gating — not container hit areas — is the safety here).
   */
  private renderPage(dir = 0): void {
    if (this.compactParts) {
      this.renderCompactBinder(null);
      return;
    }
    this.binderStale = false;
    const save = this.saveData;
    const collectible = collectiblePool(this.cards);
    const pool = this.currentPool();
    this.drawBinderChrome(pool.length === 0);
    this.page = clampPage(this.page, pool.length, SPREAD_SIZE);

    const ownedKinds = collectible.filter((d) => ownedCount(save, d.id) > 0).length;
    const completion = collectionCompletion(this.cards, save);
    this.goldBadge.refresh(save.gold);
    this.counterText.setText(`${ownedKinds}/${collectible.length} collected`);
    // Floor, from the integer counts: rounding showed 1,481 of 1,482 as 100%,
    // and 100% must mean complete. Integer math also dodges 0.29 * 100 =
    // 28.999... flooring a whole percent away.
    const poolPercent = completion.total === 0 ? 0 : Math.floor((completion.owned * 100) / completion.total);
    this.completionText.setText(
      `${poolPercent}% pool · ${specialCardsLabel(completion.variants.specialCards)}`,
    );
    const spreads = pageCount(pool.length, SPREAD_SIZE);
    this.pageControl.refresh(this.page, spreads);
    // One spread needs no pager.
    this.pageControl.container.setVisible(spreads > 1);

    // The spread on show is leased at `visible` and the spreads either side
    // are prefetched at `soon` (docs/plan-art-streaming.md section 2). A turn
    // starts at once, and the new spread waits up to PAGE_ART_HOLD_MS for its
    // art, then draws; a thumb whose art is still on its way bakes over the
    // stand-in and re-bakes in place when it lands (owner question 3). Under
    // the inspect overlay the spread is hidden, and a refresh of the same
    // spread (new badges) changes no art, so both swap at once.
    const { shown, near } = pageNeighbourhood(pool, this.page, SPREAD_SIZE);
    const cards = shown.map((d) => d.id).join('|');
    // Card ids only: a display-variant change re-bakes a thumb under a new
    // key, but its art key is the same card's, so it is almost always resident.
    const sameSpread = cards === this.spreadCards;
    this.spreadCards = cards;
    const animate = dir !== 0 && (this.pageContainer !== null || this.outgoing.length > 0);
    const turn = animate ? dir : 0;
    const holdMs = this.inspect === null && !sameSpread ? PAGE_ART_HOLD_MS : 0;
    const held = this.spreadArt!.show(
      this.spreadArtFor(shown),
      this.spreadArtFor(near),
      (afterHold) => this.placeSpread(pool, turn, afterHold),
      holdMs,
    );
    if (!held) return;
    // Held: the old spread leaves now (or, for an instant swap, stays with its
    // taps gated) while the new one waits for its art.
    this.turning = true;
    const old = this.pageContainer;
    if (turn !== 0 && old !== null) {
      this.pageContainer = null;
      this.slideOut(old, turn);
    }
  }

  /** The art keys the thumbs of `cards` still need before they can bake over real art. */
  private spreadArtFor(cards: readonly CardDef[]): string[] {
    const keys: string[] = [];
    for (const d of cards) {
      const wanted = thumbArtWanted(this, d, undefined, this.binderVariant(d));
      if (wanted !== null) keys.push(wanted.key);
    }
    return keys;
  }

  /**
   * The display variant a binder thumb bakes: owned cards show their selected
   * display variant, so the binder reads as YOUR binder; plain and unowned
   * cards bake the plain face.
   */
  private binderVariant(d: CardDef): CardVariant | undefined {
    const save = this.saveData;
    const best = ownedCount(save, d.id) > 0 ? displayVariantFor(save, d.id) : null;
    return best && variantKey(best) !== variantKey(PLAIN_VARIANT) ? best : undefined;
  }

  /**
   * Put the new spread in the pockets. `dir` 0 swaps at once (a filter
   * change, the first paint) and reaps anything still animating from earlier
   * turns; ±1 slides it in (and the old one out, unless a held turn already
   * sent it), with taps gated by `turning` while anything moves
   * (interactivity lives on child Images, so gating, not container hit
   * areas, is the safety here). `afterHold` is true when the draw waited for
   * art.
   */
  private placeSpread(pool: CardDef[], dir: number, afterHold: boolean): void {
    const old = this.pageContainer;
    this.cells = [];
    const fresh = this.buildSpread(pool);
    this.pageContainer = fresh;
    // A held spread that lands under the inspect overlay is guarded like the
    // one it replaced.
    if (afterHold && this.inspect !== null) this.guard.open(this.cells);

    if (dir === 0 || (!old && !afterHold)) {
      // Instant swap — and reap anything still animating from earlier turns.
      for (const t of [old, ...this.outgoing]) {
        if (!t) continue;
        this.tweens.killTweensOf(t);
        t.destroy();
      }
      this.outgoing = [];
      this.turning = false;
      return;
    }

    this.turning = true;
    if (old) this.slideOut(old, dir);
    fresh.setX(dir * 70).setAlpha(0);
    this.tweens.add({
      targets: fresh,
      x: 0,
      alpha: 1,
      duration: 170,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.turning = false;
      },
    });
  }

  /** Slide a spread out of view and destroy it (an instant swap reaps it early). */
  private slideOut(old: Phaser.GameObjects.Container, dir: number): void {
    this.outgoing.push(old);
    this.tweens.add({
      targets: old,
      x: -dir * 70,
      alpha: 0,
      duration: 140,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        const i = this.outgoing.indexOf(old);
        if (i >= 0) this.outgoing.splice(i, 1);
        if (old.active) old.destroy();
      },
    });
  }

  /** One spread: baked thumbs in the pockets + badges on the lip below each. */
  private buildSpread(pool: CardDef[]): Phaser.GameObjects.Container {
    const save = this.saveData;
    const c = this.add.container(0, 0);
    const slice = pageSlice(pool, this.page, SPREAD_SIZE);
    const perPage = COLS_PER_PAGE * ROWS_PER_PAGE;

    slice.forEach((d, i) => {
      const cols = this.binder.columns[i < perPage ? 0 : 1];
      const within = i % perPage;
      const x = cols[within % COLS_PER_PAGE];
      const y = this.binder.rowYs[Math.floor(within / COLS_PER_PAGE)];
      const owned = ownedCount(save, d.id);

      // Cached-thumbnail Image (tier gem included) — cheap to churn per
      // spread; live CardViews stay exclusive to the inspect overlay. Owned
      // cards show their selected display variant (frame/full-art bake
      // statically; holo shimmer stays an inspect effect), so the binder reads
      // as YOUR binder rather than a plain checklist.
      const thumb = makeCardThumb(this, x, y, d, this.binder.scale, undefined, this.binderVariant(d));
      if (owned === 0) thumb.setAlpha(0.32); // calibrated against the 0.70 dim
      thumb.setInteractive({ useHandCursor: true });
      bindTapButton(this, thumb, () => {
        if (!this.turning) this.showInspect(d);
      });
      c.add(thumb);
      this.cells.push(thumb);

      // Badge strip — strictly OUTSIDE the card face (face bottom +14).
      const ly = y + this.binder.labelOffset;
      const badge = (
        bx: number,
        originX: number,
        str: string,
        color: string,
      ): Phaser.GameObjects.Text =>
        this.add
          .text(bx, ly, str, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: theme.weight.w700,
            color,
          })
          .setOrigin(originX, 0.5);
      // The strip shares the card face's edges: tier on the left, counts
      // gathered on the right. Counts too long for the face widen the strip
      // symmetrically, up to the pocket's cell, so badges never collide.
      const gap = theme.space(2);
      const tier = badge(0, 0, TIER_LABEL[d.rarity], TIER_TEXT_COLOR[d.rarity]);
      const specials = specialVariantCount(save, d.id);
      const special = specials > 0 ? badge(0, 1, `✦${specials}`, TIER_TEXT_COLOR.ssr) : null;
      const count = owned > 0
        ? badge(0, 1, `×${owned}`, owned >= PLAYSET ? theme.colors.gold : theme.colors.heading)
        : null;
      const needed = tier.width + [count, special].reduce((sum, t) => sum + (t ? gap + t.width : 0), 0);
      const half = Math.min(Math.max(this.binder.badgeWidth, needed), this.binder.cellWidth) / 2;
      tier.setX(x - half);
      let cursor = x + half;
      for (const t of [special, count]) {
        if (!t) continue;
        t.setX(cursor);
        cursor -= t.width + gap;
      }
      c.add([tier, ...[count, special].filter((t): t is Phaser.GameObjects.Text => t !== null)]);
    });
    return c;
  }

  /**
   * Inspect overlay: live fx:'full' CardView (the only one alive) rendering
   * the selected owned display variant, plus a tappable list of every owned variant.
   * Unowned cards render the plain look.
   */
  private showInspect(d: CardDef, clearedDisplayPin = false): void {
    if (this.compactParts) {
      this.showCompactInspect(d, clearedDisplayPin);
      return;
    }
    this.closeInspect();
    this.filterBar.closeAll(); // a floating dropdown must not sit over the overlay
    this.searchInput?.setVisible(false); // DOM input always floats above the canvas dim
    const save = this.saveData;
    const owned = ownedCount(save, d.id);
    const columns = collectionInspectColumns();
    const atelier = { x: columns.cardX, y: 350, scale: 1 };
    const shell = modalShell(this, {
      width: columns.width,
      height: columns.height,
      dimAlpha: currentAccessibility().highContrast ? theme.alpha.overlayDim : 0.82,
      dismissal: 'esc-only',
      depth: theme.depth.overlay,
      onClose: () => this.closeInspect(),
    });
    const c = shell.container;
    const dim = shell.dim;
    const openedAt = this.time.now;
    // A shard/craft hold rebuilds this overlay while the pointer is still
    // physically down; the eventual release would land on the fresh dim and
    // close the menu the player just acted in (owner finding 2026-08-18).
    // That release belongs to the hold, so the dim swallows exactly one
    // pointerup when it was built under an already-held pointer.
    let swallowHeldRelease = this.input.activePointer?.isDown === true;
    // The same applies DURING the release ritual: a completed shard hold turns
    // its button off, so the thumb's release falls through to this dim. It
    // used to close the view mid-dissolve and cancel the ritual's binder
    // refresh. The ritual is under a second long; Esc still closes it.
    let ritualInProgress = false;
    dim.on('pointerup', () => {
      if (swallowHeldRelease) {
        swallowHeldRelease = false;
        return;
      }
      if (ritualInProgress) return;
      if (this.time.now - openedAt < INSPECT_CLOSE_LOCK_MS) return; // swallow double-click flash
      this.closeInspect();
    });
    const shown = owned > 0 ? displayVariantFor(save, d.id) : null;
    let displayedVariant: CardVariant | undefined = shown ?? undefined;
    let comparisonVariant: CardVariant | undefined;
    let comparisonActive = false;
    let touchScrubbing = false;
    let pointerWasInside = false;
    const animationLevel = save.settings.animations;
    const touchProfile = isTouchDevice();

    // The full-art light follows the measured showcase size, remaining fixed
    // while the card tilts. Layout is finalized after the odds text is measured.
    const galleryHalo = this.add
      .ellipse(atelier.x, atelier.y, 415, 565, colorInt(theme.colors.gold), 0.1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const galleryFloor = this.add
      .ellipse(atelier.x, 588, 350, 30, colorInt(theme.colors.gold), 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const galleryTitle = this.add
      .text(atelier.x, theme.design.safeTop, 'FULL ART GALLERY LIGHT', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        letterSpacing: 1.4,
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const view = new CardView(this, atelier.x, atelier.y);
    view.setScale(atelier.scale).setCard(
      d,
      shown ? { fx: 'full', variant: shown, fullArt: shown.fullArt } : { fx: 'full' },
    );
    const compareView = new CardView(this, atelier.x, atelier.y)
      .setScale(atelier.scale)
      .setVisible(false);
    const compareMaskSource = this.add
      .graphics()
      .setPosition(atelier.x, atelier.y)
      .setScale(atelier.scale)
      .setVisible(false);
    const compareMask = compareMaskSource.createGeometryMask();
    compareView.setMask(compareMask);
    const wipeOverlay = this.add
      .container(atelier.x, atelier.y)
      .setScale(atelier.scale)
      .setVisible(false);
    const wipeDivider = this.add.rectangle(0, 0, 2, CARD_H, colorInt(theme.colors.heading), theme.alpha.chrome);
    const wipeHandle = this.add
      .circle(0, CARD_H / 2 - 14, 7, colorInt(theme.colors.panelFill), 0.96)
      .setStrokeStyle(2, colorInt(theme.colors.gold), 1);
    wipeOverlay.add([wipeDivider, wipeHandle]);

    const compareLeftLabel = this.add
      .text(atelier.x - CARD_W * atelier.scale / 2, 43, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    const compareRightLabel = this.add
      .text(atelier.x + CARD_W * atelier.scale / 2, 43, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(1, 0.5)
      .setVisible(false);
    const compareHint = this.add
      .text(
        atelier.x,
        591,
        touchProfile ? 'Drag across card to compare' : 'Move across card to compare',
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5)
      .setVisible(false);

    const cardName = this.add.text(columns.left, columns.nameTop, d.name, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`,
      fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    fitMenuName(cardName, columns.nameWidth, 3);
    // The tier as words under the name (the face shows it only as a gem
    // colour); the glossary and the card's labels hang from its measured bottom.
    const rarity = this.add.text(columns.left, cardName.y + cardName.height + theme.space(1), d.token ? '' : rarityLine(d), {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w600, color: theme.colors.body,
      wordWrap: { width: columns.nameWidth },
    });
    const detailsTop = (rarity.text ? rarity.y + rarity.height : cardName.y + cardName.height) + theme.space(3);
    const probabilityPlate = this.add.graphics();
    const probabilityTitle = this.add.text(0, 0, 'EXACT BOOSTER-SLOT ODDS', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700, color: theme.colors.muted, letterSpacing: 1,
    }).setOrigin(0.5, 0);
    const probabilityHeadline = this.add.text(0, 0, '', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.label}px`, color: theme.colors.gold,
    }).setOrigin(0.5, 0);
    const probabilityAxes = this.add.text(0, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, color: theme.colors.body,
      align: 'center', wordWrap: { width: columns.nameWidth - theme.space(4) },
    }).setOrigin(0.5, 0);

    c.add([
      cardName,
      rarity,
      galleryHalo,
      galleryFloor,
      view,
      compareView,
      compareMaskSource,
      wipeOverlay,
      galleryTitle,
      compareLeftLabel,
      compareRightLabel,
      compareHint,
      probabilityPlate,
      probabilityTitle,
      probabilityHeadline,
      probabilityAxes,
    ]);
    // The rarity line's height comes out of the glossary's cap: its bottom stays put.
    addKeywordGlossaryPanel(this, c, d, {
      ...columns.glossary, y: detailsTop, maxHeight: 370 - (detailsTop - (cardName.y + cardName.height + theme.space(3))),
    });

    let wipe = 0;
    let wipeTween: Phaser.Tweens.Tween | null = null;
    let tiltTween: Phaser.Tweens.Tween | null = null;
    const setWipe = (next: number): void => {
      wipe = Phaser.Math.Clamp(next, 0, 1);
      compareMaskSource
        .clear()
        .fillStyle(0xffffff, 1)
        .fillRect(-CARD_W / 2, -CARD_H / 2, CARD_W * wipe, CARD_H);
      const dividerX = -CARD_W / 2 + CARD_W * wipe;
      wipeDivider.setX(dividerX);
      wipeHandle.setX(dividerX);
    };
    const animateWipe = (target: number): void => {
      wipeTween?.remove();
      wipeTween = null;
      const duration = cardAtelierWipeDuration(animationLevel);
      if (duration <= 0) {
        setWipe(target);
        return;
      }
      const from = wipe;
      wipeTween = this.tweens.addCounter({
        from: 0,
        to: duration,
        duration,
        ease: 'Linear',
        onUpdate: (tween) => {
          if (!c.active) return;
          setWipe(cardAtelierWipeProgress(from, target, tween.getValue() ?? duration, duration));
        },
        onComplete: () => {
          wipeTween = null;
        },
      });
    };
    const applyAtelierPose = (pose: CardAtelierTiltPose): void => {
      tiltTween?.remove();
      tiltTween = null;
      const x = atelier.x + pose.offsetX;
      const y = atelier.y + pose.offsetY;
      const scaleX = atelier.scale * pose.scaleX;
      const scaleY = atelier.scale * pose.scaleY;
      for (const target of [view, compareView, compareMaskSource, wipeOverlay]) {
        target.setPosition(x, y).setScale(scaleX, scaleY).setAngle(pose.angleDeg);
      }
      // The gallery light deliberately ignores pose.lightOffset: the halo and
      // its floor glow stay put while the card tilts under the pointer.
    };
    const settleAtelierPose = (): void => {
      tiltTween?.remove();
      tiltTween = null;
      galleryHalo.setPosition(atelier.x, atelier.y);
      galleryFloor.setX(atelier.x);
      if (animationLevel !== 'full') {
        applyAtelierPose(cardAtelierTiltPose({ x: 0, y: 0, inside: false }, animationLevel, false));
        return;
      }
      tiltTween = this.tweens.add({
        targets: [view, compareView, compareMaskSource, wipeOverlay],
        x: atelier.x,
        y: atelier.y,
        scaleX: atelier.scale,
        scaleY: atelier.scale,
        angle: 0,
        duration: theme.motion.base,
        ease: theme.motion.easeOut,
        onComplete: () => {
          tiltTween = null;
        },
      });
    };
    const updateGallery = (): void => {
      const visible = displayedVariant?.fullArt === true || comparisonVariant?.fullArt === true;
      galleryHalo.setVisible(visible);
      galleryFloor.setVisible(visible);
      galleryTitle.setVisible(visible && !comparisonActive);
    };
    const refreshProbability = (variant: CardVariant): void => {
      const plate = cardAtelierProbabilityPlate(d.rarity, variant);
      probabilityHeadline.setText(`${plate.oddsText} · ${plate.percentText}`);
      probabilityAxes.setText(plate.axisText);
      fitMenuName(probabilityAxes, columns.nameWidth - theme.space(4), 3);
      const probability = collectionProbabilityLayout([probabilityTitle.height, probabilityHeadline.height, probabilityAxes.height]);
      const box = probability.box;
      probabilityPlate.clear().fillStyle(theme.graphics.panelFill, theme.alpha.panel)
        .fillRoundedRect(box.x, box.y, box.width, box.height, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
        .strokeRoundedRect(box.x, box.y, box.width, box.height, theme.radius.panel);
      [probabilityTitle, probabilityHeadline, probabilityAxes].forEach((text, index) => {
        text.setPosition(box.x + box.width / 2, probability.ys[index]);
      });
      const labelTop = detailsTop;
      galleryTitle.setPosition(atelier.x, labelTop).setOrigin(0.5, 0);
      fitMenuName(galleryTitle, columns.cardWidth, 2);
      fitMenuName(compareLeftLabel, columns.cardWidth, 2);
      fitMenuName(compareRightLabel, columns.cardWidth, 2);
      compareLeftLabel.setPosition(atelier.x, labelTop).setOrigin(0.5, 0);
      compareRightLabel.setPosition(atelier.x, labelTop + compareLeftLabel.height + theme.space(1)).setOrigin(0.5, 0);
      fitMenuName(compareHint, columns.cardWidth, 2);
      const labelsHeight = comparisonActive
        ? compareLeftLabel.height + compareRightLabel.height + theme.space(1)
        : galleryTitle.height;
      const top = labelTop + labelsHeight + theme.space(2);
      const bottom = box.y - compareHint.height - theme.space(4);
      atelier.scale = Math.min(columns.cardWidth / CARD_W, (bottom - top) / CARD_H);
      atelier.y = top + (bottom - top) / 2;
      compareHint.setPosition(atelier.x, bottom + theme.space(2)).setOrigin(0.5, 0);
      galleryHalo.setPosition(atelier.x, atelier.y).setSize(CARD_W * atelier.scale + 40, CARD_H * atelier.scale + 40);
      galleryFloor.setPosition(atelier.x, bottom).setSize(CARD_W * atelier.scale, 30);
      applyAtelierPose(cardAtelierTiltPose({ x: 0, y: 0, inside: false }, 'off', false));
    };
    const bindTouchCompare = (): void => {
      if (view.inputZone) return;
      view.enableInput();
      view.on(
        'pointerdown',
        (
          pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          if (!pointer.wasTouch || !comparisonActive) return;
          touchScrubbing = true;
          event.stopPropagation();
        },
      );
      view.on(
        'pointerup',
        (
          pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          if (!pointer.wasTouch || !comparisonActive) return;
          touchScrubbing = false;
          event.stopPropagation();
        },
      );
      view.on('pointerout', () => {
        touchScrubbing = false;
      });
    };
    const presentVariant = (next: CardVariant): void => {
      const previous = displayedVariant;
      if (previous && variantKey(previous) !== variantKey(next)) {
        comparisonVariant = previous;
        comparisonActive = true;
        compareView
          .setCard(d, {
            fx: 'full',
            variant: previous,
            fullArt: previous.fullArt,
            // Under the wipe's GeometryMask, preFX/PostFX passes paint black
            // (owner repro 2026-08-18); tile fallbacks render identically
            // enough for a side-by-side and survive the stencil.
            maskSafe: true,
          })
          .setVisible(true);
        compareLeftLabel.setText(`A · ${variantLabel(previous)}`).setVisible(true);
        compareRightLabel.setText(`B · ${variantLabel(next)}`).setVisible(true);
        compareHint.setVisible(true);
        wipeOverlay.setVisible(true);
        bindTouchCompare();
        setWipe(0);
        animateWipe(0.5);
      }
      displayedVariant = next;
      view.setCard(d, { fx: 'full', variant: next, fullArt: next.fullArt });
      refreshProbability(next);
      updateGallery();
    };
    const suspendAtelierForRitual = (): void => {
      ritualInProgress = true;
      comparisonActive = false;
      comparisonVariant = undefined;
      compareView.setVisible(false);
      wipeOverlay.setVisible(false);
      compareLeftLabel.setVisible(false);
      compareRightLabel.setVisible(false);
      compareHint.setVisible(false);
      wipeTween?.remove();
      wipeTween = null;
      applyAtelierPose(cardAtelierTiltPose({ x: 0, y: 0, inside: false }, 'off', false));
      updateGallery();
    };

    setWipe(0);
    refreshProbability(shown ?? PLAIN_VARIANT);
    updateGallery();

    // One pointer tracker owns foil, perspective, gallery light, and compare.
    // It is stored so closeInspect can unhook it; touch never receives tilt.
    this.holoMove = (p: Phaser.Input.Pointer) => {
      if (!view.active) return;
      const pointer = view.setHoloPointer(p.worldX, p.worldY);
      if (comparisonActive && compareView.active) {
        compareView.setHoloPointer(p.worldX, p.worldY);
      }
      if (ritualInProgress) return;
      if (pointer.inside) {
        pointerWasInside = true;
        applyAtelierPose(cardAtelierTiltPose(pointer, animationLevel, p.wasTouch));
        if (comparisonActive && (!p.wasTouch || touchScrubbing)) {
          wipeTween?.remove();
          wipeTween = null;
          setWipe(cardAtelierWipeFromPointer(pointer.x));
        }
      } else if (pointerWasInside) {
        pointerWasInside = false;
        settleAtelierPose();
      }
    };
    this.input.on('pointermove', this.holoMove);
    c.once(Phaser.GameObjects.Events.DESTROY, () => {
      wipeTween?.remove();
      tiltTween?.remove();
      compareMask.destroy();
    });

    // Actions take their measured height first; the variants page in the band above.
    const actions = this.addInspectActions(
      c, d, view, () => displayedVariant, () => ritualInProgress, suspendAtelierForRitual,
    );
    const actionLayout = collectionActionLayout(actions.map((button) =>
      Math.max(button.getMeasuredSize().hit.height, Number(button.container.getData('reservedHeight') ?? 0))));
    actions.forEach((button, index) => button.container.setY(actionLayout.ys[index]));
    const panelX = columns.detailsX;
    const heading = this.add.text(panelX, columns.nameTop, owned > 0 ? 'Owned variants' : 'Not yet collected', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h2}px`,
      color: owned > 0 ? theme.colors.heading : theme.colors.muted,
    });
    fitMenuName(heading, columns.detailsWidth, 2);
    c.add(heading);
    let variantTop = heading.y + heading.height + theme.space(3);
    if (clearedDisplayPin) {
      const note = this.add.text(panelX, variantTop, 'Pinned display cleared. Showing your rarest owned look.', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.success,
        wordWrap: { width: columns.detailsWidth }, lineSpacing: theme.space(1),
      });
      fitMenuName(note, columns.detailsWidth, 3);
      c.add(note);
      variantTop += note.height + theme.space(3);
    }
    if (owned > 0) {
      const entries = [...ownedVariantEntries(save, d.id)].sort(
        (a, b) => finishOdds(a.variant.frame, a.variant.holo, a.variant.fullArt)
          - finishOdds(b.variant.frame, b.variant.holo, b.variant.fullArt)
          || variantKey(a.variant).localeCompare(variantKey(b.variant)),
      );
      const rowTextWidth = columns.detailsWidth - theme.control.minHitWidth - theme.space(8);
      const measure = this.add.text(0, 0, '', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, fontStyle: theme.weight.w600,
        wordWrap: { width: rowTextWidth },
      }).setVisible(false);
      const nameHeight = Math.max(...entries.map((entry) => {
        measure.setText(`▸ ${variantLabel(entry.variant)}  ×${entry.count}`); return measure.height;
      }));
      measure.setFontSize(theme.type.caption);
      const oddsHeight = Math.max(...entries.map((entry) => {
        measure.setText(formatOdds(finishOdds(entry.variant.frame, entry.variant.holo, entry.variant.fullArt)));
        return measure.height;
      }));
      measure.destroy();
      const variants = collectionVariantLayout(variantTop, actionLayout.listBottom,
        nameHeight + theme.space(1) + oddsHeight, entries.length);
      let selectedKey = variantKey(shown!);
      let pinnedKey: string | null = save.pinnedVariants[d.id] ?? null;
      let rows: { container: Phaser.GameObjects.Container; background: Phaser.GameObjects.Graphics;
        text: Phaser.GameObjects.Text; odds: Phaser.GameObjects.Text; pin: ThemedButton;
        variant: CardVariant; count: number; y: number }[] = [];
      const restyle = (): void => {
        for (const row of rows) {
          const selected = variantKey(row.variant) === selectedKey;
          row.background.clear()
            .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
            .fillRoundedRect(panelX, row.y - variants.rowHeight / 2, columns.detailsWidth, variants.rowHeight, theme.radius.control)
            .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
            .strokeRoundedRect(panelX, row.y - variants.rowHeight / 2, columns.detailsWidth, variants.rowHeight, theme.radius.control);
          row.text.setText(`${selected ? '▸ ' : '   '}${variantLabel(row.variant)}  ×${row.count}`)
            .setColor(selected ? theme.colors.gold : theme.colors.body);
          fitMenuName(row.text, rowTextWidth, 3);
          row.pin.setVariant(pinnedKey === variantKey(row.variant) ? 'selected' : 'ghost');
        }
      };
      let variantPageControl: Pager | null = null;
      const renderVariantPage = (page: number): void => {
        for (const row of rows) row.container.destroy();
        rows = [];
        const start = page * variants.pageSize;
        entries.slice(start, start + variants.pageSize).forEach((entry, index) => {
          const y = variants.rowYs[index];
          const top = y - variants.rowHeight / 2 + theme.space(2);
          const row = this.add.container(0, 0);
          const background = this.add.graphics();
          const text = this.add.text(panelX + theme.space(2), top, '', {
            fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w600, color: theme.colors.body,
          });
          const odds = this.add.text(panelX + theme.space(2), top + nameHeight + theme.space(1), formatOdds(
            finishOdds(entry.variant.frame, entry.variant.holo, entry.variant.fullArt)), {
            fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted,
          });
          const select = this.add.zone(panelX + (columns.detailsWidth - theme.control.minHitWidth - theme.space(2)) / 2,
            y, columns.detailsWidth - theme.control.minHitWidth - theme.space(2), variants.rowHeight)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, select, () => {
            if (ritualInProgress) return;
            selectedKey = variantKey(entry.variant); presentVariant(entry.variant); restyle();
          });
          const pin = themedButton(this, columns.right - theme.control.minHitWidth / 2, y, '{pin}', {
            variant: pinnedKey === variantKey(entry.variant) ? 'selected' : 'ghost', size: 'sm',
            onTap: () => {
              if (ritualInProgress) return;
              const key = variantKey(entry.variant);
              let nextVariant: CardVariant;
              if (pinnedKey === key) {
                delete save.pinnedVariants[d.id]; pinnedKey = null; nextVariant = displayVariantFor(save, d.id);
              } else {
                save.pinnedVariants[d.id] = key; pinnedKey = key; nextVariant = entry.variant;
              }
              selectedKey = variantKey(nextVariant); presentVariant(nextVariant);
              this.flushSave(); Sfx.play('shimmer'); restyle();
            },
          });
          row.add([background, text, odds, select, pin.container]);
          rows.push({ container: row, background, text, odds, pin, variant: entry.variant, count: entry.count, y });
          c.add(row);
        });
        variantPageControl?.refresh(page, variants.pageCount);
        restyle();
      };
      variantPageControl = pager(this, panelX + columns.detailsWidth / 2 - PAGER_CENTER_OFFSET, variants.pagerY,
        0, variants.pageCount, renderVariantPage);
      // One page needs no pager.
      variantPageControl.container.setVisible(variants.pageCount > 1);
      c.add(variantPageControl.container);
      renderVariantPage(Math.max(0, Math.min(variants.pageCount - 1, this.fixture?.variantPage ?? 0)));
      if (this.fixture?.compareVariantIndex !== undefined) {
        const entry = entries[this.fixture.compareVariantIndex];
        if (entry) { selectedKey = variantKey(entry.variant); presentVariant(entry.variant); restyle(); }
      }
    }

    // The existing dismissal hint owns the shell's header close track.
    const closeTrack = shell.tracks.closeTrack;
    c.add(
      this.add
        .text(
          closeTrack.x + closeTrack.width,
          theme.design.headerCenterY,
          touchProfile ? 'Tap anywhere to close' : 'Click anywhere to close',
          { fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.muted },
        )
        .setOrigin(1, 0.5),
    );

    this.guard.open([...this.cells, ...this.guardTargets]);
    this.inspect = c;
    this.inspectDef = d;
  }

  /** Themed overlay button whose Zone input remains safe across relabels. */
  private overlayChip(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    variant: 'primary' | 'emphasis' | 'selected' = 'emphasis',
    onTap: (pointer: Phaser.Input.Pointer) => void,
  ): ThemedButton {
    const columns = collectionInspectColumns();
    const t = themedButton(this, x + columns.detailsWidth / 2, y, label, {
      variant, minWidth: columns.detailsWidth, maxTextWidth: columns.detailsWidth - theme.space(8), onTap,
    });
    c.add(t.container);
    return t;
  }

  /**
   * Owned-card actions in the inspect overlay (right column, below the variant
   * list): pick this card as the fallback hero portrait for decks without their
   * own starred hero. `heroCardId === id` toggles.
   */
  private addInspectActions(
    c: Phaser.GameObjects.Container,
    d: CardDef,
    view: CardView,
    displayedVariant: () => CardVariant | undefined,
    isRitualInProgress: () => boolean,
    startRitual: () => void,
  ): ThemedButton[] {
    const panelX = collectionInspectColumns().detailsX;
    const buttons: ThemedButton[] = [];
    // The caller lays these out from their measured maximum label heights.
    const save = this.saveData;
    if (ownedCount(save, d.id) > 0) {
      // Name the input the player has: never "tap" to a mouse, never "click"
      // to a finger. The last press decides once there has been one.
      let heroVerb = isTouchDevice() ? 'tap' : 'click';
      const heroLabel = (): string =>
        save.heroCardId === d.id ? `★ Default hero (${heroVerb} to clear)` : '☆ Set default hero';
      const heroBtn = this.overlayChip(
        c,
        panelX,
        0,
        heroLabel(),
        save.heroCardId === d.id ? 'selected' : 'emphasis',
        (pointer) => {
          if (isRitualInProgress()) return;
          heroVerb = pointer.wasTouch ? 'tap' : 'click';
          save.heroCardId = save.heroCardId === d.id ? null : d.id;
          this.flushSave();
          Sfx.play('shimmer');
          heroBtn.setLabel(heroLabel());
          heroBtn.setVariant(save.heroCardId === d.id ? 'selected' : 'emphasis');
        },
      );
      heroBtn.setLabel(`★ Default hero (${heroVerb} to clear)`);
      heroBtn.container.setData('reservedHeight', heroBtn.getMeasuredSize().hit.height);
      heroBtn.setLabel(heroLabel());
      buttons.push(heroBtn);
    }

    const owned = ownedCount(save, d.id);
    if (owned === 0 && !d.token && !d.supertypes?.includes('basic')) {
      const cost = craftCost(CARD_DB, d.id);
      const costLabel = `-${formatGold(cost)}`;
      let armed = false;
      let armedVerb = 'Click';
      let disarmTimer: Phaser.Time.TimerEvent | null = null;
      const label = (): string =>
        armed ? `${armedVerb} again to craft (${costLabel})` : `Craft (${costLabel})`;
      // Stand down after a few seconds unanswered. A closed or rebuilt overlay
      // destroys this button, so a late timer leaves the new one alone.
      const disarm = (): void => {
        disarmTimer = null;
        armed = false;
        if (!craftBtn.container.active) return;
        craftBtn.setLabel(label());
        craftBtn.setVariant('emphasis');
      };
      const craftBtn = this.overlayChip(c, panelX, 0, label(), 'emphasis', (pointer) => {
        if (isRitualInProgress()) return;
        // Shared destructive-confirm policy (Gauntlet's Abandon, Limited's
        // Retire): two presses unless the player opted out in Settings, the
        // armed label names the input the player used, and it disarms after
        // four seconds.
        if (save.settings.confirmDestructive && !armed) {
          armed = true;
          armedVerb = pointer.wasTouch ? 'Tap' : 'Click';
          craftBtn.setLabel(label());
          craftBtn.setVariant('primary');
          disarmTimer?.remove(false);
          disarmTimer = this.time.delayedCall(CRAFT_ARM_MS, disarm);
          return;
        }
        disarmTimer?.remove(false);
        disarmTimer = null;
        this.craft(d);
      });
      // Shop convention: keep an unaffordable action visible with its price,
      // but make its input inert until the balance can cover the cost.
      craftBtn.setLabel(`${armedVerb} again to craft (${costLabel})`);
      craftBtn.container.setData('reservedHeight', craftBtn.getMeasuredSize().hit.height);
      craftBtn.setLabel(label());
      craftBtn.setEnabled(save.gold >= cost);
      buttons.push(craftBtn);
    }

    // Shard: convert copies past the per-variant playset (4 of each frame|holo)
    // to gold. A deliberate hold replaces the old two-tap arm, while the meta
    // mutation itself stays the existing one-call path. Absent when nothing is
    // over the cap.
    const excess = shardableCount(save, d.id);
    if (excess > 0) {
      const gold = shardGold(save, CARD_DB, d.id);
      const shardBtn = this.overlayChip(
        c,
        panelX,
        0,
        `Hold to shard ×${excess} extra (+${formatGold(gold)})`,
        'emphasis',
        () => undefined,
      );

      buttons.push(shardBtn);
      const progressFill = this.add.graphics();
      // The progress visual belongs inside the CTA instead of around the
      // cursor. Insert it above the button surface and below its label.
      shardBtn.container.addAt(progressFill, 1);
      this.bindShardHold({
        c, d, view, gold, progressFill,
        holdLabel: `Hold to shard ×${excess} extra (+${formatGold(gold)})`,
        zone: shardBtn.inputZone,
        // The label changes while holding, so remeasure instead of letting a
        // long gold/count string leave the fill behind the CTA's true edge.
        bounds: () => shardBtn.getMeasuredBounds().visual,
        setLabel: (label) => shardBtn.setLabel(label),
        setEnabled: (enabled) => shardBtn.setEnabled(enabled),
        displayedVariant, isRitualInProgress, startRitual,
      });
    }
    return buttons;
  }

  /** Craft one Standard copy, then refresh the binder and reopen the card on it. */
  private craft(d: CardDef): void {
    const save = this.saveData;
    const result = craftCard(save, CARD_DB, d.id);
    if (!result.ok) return;
    const checkpoint = checkpointAchievements(save, CARD_DB);
    this.flushSave();
    if (!this.fixture && checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
    Sfx.play('coin');
    this.renderPage(); // refresh counts, thumb alpha, and the gold badge
    this.showInspect(d); // keep the inspect overlay open on the new copy
  }

  /**
   * The shard button's hold (desktop and phone): the fill tracks the hold
   * inside the button, an early release drains it and nothing happens, and a
   * completed hold shards the extra copies and plays the release ritual. A
   * deliberate hold replaces the old two-tap arm, while the meta mutation
   * itself stays the existing one-call path.
   */
  private bindShardHold(opts: {
    c: Phaser.GameObjects.Container;
    d: CardDef;
    view: CardView;
    gold: number;
    holdLabel: string;
    progressFill: Phaser.GameObjects.Graphics;
    zone: Phaser.GameObjects.Zone;
    /** The button's drawn rect, in the button's own coordinates. */
    bounds: () => Rect;
    setLabel: (label: string) => void;
    setEnabled: (enabled: boolean) => void;
    displayedVariant: () => CardVariant | undefined;
    isRitualInProgress: () => boolean;
    startRitual: () => void;
  }): void {
    const { c, d, view, gold, holdLabel, progressFill, displayedVariant, isRitualInProgress, startRitual } = opts;
    const save = this.saveData;
    let holding = false;
    let complete = false;
    let progress = 0;
    let holdTimer: Phaser.Time.TimerEvent | null = null;
    let progressTimer: Phaser.Time.TimerEvent | null = null;

    const drawProgress = (next: number): void => {
      if (!progressFill.active) return;
      progressFill.clear();
      if (next <= 0) return;
      const visual = opts.bounds();
      const inset = SHARD_HOLD_BUTTON_PROGRESS.inset;
      const x = visual.x + inset;
      const y = visual.y + inset;
      const height = visual.height - inset * 2;
      const width = Math.max(0, (visual.width - inset * 2) * next);
      const radius = Math.min(SHARD_HOLD_BUTTON_PROGRESS.cornerRadius, width / 2, height / 2);
      progressFill.fillStyle(colorInt(theme.colors.gold), SHARD_HOLD_BUTTON_PROGRESS.fillAlpha);
      progressFill.fillRoundedRect(x, y, width, height, radius);
      progressFill.lineStyle(SHARD_HOLD_BUTTON_PROGRESS.ringWidth, colorInt(theme.colors.gold), 0.96);
      progressFill.strokeRoundedRect(
        visual.x + SHARD_HOLD_BUTTON_PROGRESS.ringWidth / 2,
        visual.y + SHARD_HOLD_BUTTON_PROGRESS.ringWidth / 2,
        visual.width - SHARD_HOLD_BUTTON_PROGRESS.ringWidth,
        visual.height - SHARD_HOLD_BUTTON_PROGRESS.ringWidth,
        theme.radius.control,
      );
    };
    const stopProgress = (): void => {
      holdTimer?.remove(false);
      holdTimer = null;
      progressTimer?.remove(false);
      progressTimer = null;
    };
    const releaseEarly = (): void => {
      if (!holding || complete) return;
      holding = false;
      stopProgress();
      const from = progress;
      opts.setLabel(holdLabel);
      this.tweens.addCounter({
        from,
        to: 0,
        duration: 100,
        ease: 'Cubic.easeOut',
        onUpdate: (tween) => drawProgress(tween.getValue() ?? 0),
        onComplete: () => {
          if (progressFill.active) progressFill.clear();
        },
      });
    };
    const beginHold = (): void => {
      if (holding || complete || isRitualInProgress()) return;
      holding = true;
      progress = 0;
      drawProgress(0);
      opts.setLabel(`Hold to release (+${formatGold(gold)})`);
      const duration = shardHoldDuration(gold);
      const startedAt = this.time.now;
      progressTimer = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (!holding || !progressFill.active || !c.active) return;
          progress = Math.min(1, (this.time.now - startedAt) / duration);
          drawProgress(progress);
        },
      });
      holdTimer = this.time.delayedCall(duration, () => {
        if (!holding || complete || !c.active || !view.active) return;
        holding = false;
        complete = true;
        stopProgress();
        drawProgress(1);
        opts.setEnabled(false);

        // Keep the economy seam byte-for-byte identical and invoke it only
        // when the hold completes.
        const result = shardExcess(save, CARD_DB, d.id);
        this.binderStale = true;
        const checkpoint = checkpointAchievements(save, CARD_DB);
        this.flushSave();
        if (!this.fixture && checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
        startRitual();
        opts.setLabel(`Released (+${formatGold(result.gold)})`);
        Sfx.play('shatter');
        this.playShardRitual(c, view, displayedVariant(), save.gold - result.gold, result.gold, () => {
          this.renderPage(); // refresh the ×N / ✦N badges beneath the overlay
          this.showInspect(d, result.clearedDisplayPin); // rebuild with the new counts and pin result
        });
      });
    };

    // The button's input is an unscaled child Zone. Pointer lifetime owns
    // the action rather than the button's ordinary tap callback.
    opts.zone.on('pointerdown', beginHold);
    opts.zone.on('pointerup', releaseEarly);
    opts.zone.on('pointerupoutside', releaseEarly);
    opts.zone.on('pointerout', releaseEarly);
  }

  /**
   * Scene-only presentation around the stable Collection mutation. The mask
   * and timers are owned here because inspect rebuilds destroy their CardView.
   */
  private playShardRitual(
    c: Phaser.GameObjects.Container,
    view: CardView,
    variant: CardVariant | undefined,
    goldBefore: number,
    gained: number,
    onComplete: () => void,
  ): void {
    const policy = fxPolicy(this);
    const duration = shardDissolveDuration(variant?.fullArt === true);
    const timers: Phaser.Time.TimerEvent[] = [];
    const badge = this.goldBadge.container;
    const badgeDepth = badge.depth;
    const isCurrent = (): boolean => c.active && view.active && this.inspect === c;
    let finished = false;
    let cleaned = false;
    let mask: Phaser.GameObjects.RenderTexture | null = null;

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      for (const timer of timers) timer.remove(false);
      if (mask) {
        if (view.active) view.clearMask(true);
        if (mask.active) mask.destroy();
        mask = null;
      }
      if (badge.active) {
        badge.setDepth(badgeDepth);
        // If the modal was closed early, land the visible currency state even
        // though the ceremonial counter no longer has an overlay to inhabit.
        if (!finished) this.goldBadge.refresh(this.saveData.gold);
      }
    };
    this.inspectRitualCleanup = cleanup;

    view.desaturateArtForRelease();
    badge.setDepth(theme.depth.overlay + 2);
    this.goldBadge.refresh(goldBefore);

    const wipeWithRenderTexture = fxAvailable(this) && policy.particleScale > 0;
    if (wipeWithRenderTexture) {
      const width = Math.round(CARD_W * view.scaleX);
      const height = Math.round(CARD_H * view.scaleY);
      // BitmapMask is WebGL-only. Its unlisted RenderTexture is an alpha mask,
      // so it does not render a visible white rectangle over the inspect card.
      mask = this.make.renderTexture({ x: view.x, y: view.y, width, height }, false);
      mask.setOrigin(0.5);
      const paintMask = (progress: number): void => {
        if (!mask?.active) return;
        const edge = 30;
        const solidHeight = Math.max(0, height * (1 - progress) - edge);
        mask.clear();
        if (solidHeight > 0) mask.fill(0xffffff, 1, 0, 0, width, solidHeight);
        // A short stepped alpha band keeps this as a dissolve, not a hard crop.
        for (let step = 0; step < 6; step++) {
          const alpha = 1 - (step + 1) / 6;
          const y = solidHeight + (edge * step) / 6;
          mask.fill(0xffffff, alpha, 0, y, width, edge / 6 + 1);
        }
      };
      paintMask(0);
      view.setMask(mask.createBitmapMask());
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Cubic.easeIn',
        onUpdate: (tween) => {
          if (!isCurrent()) return;
          paintMask(tween.getValue() ?? 0);
        },
      });
    }

    // Canvas, lite and animations-off retain the same release result with a
    // simple graceful rise. WebGL adds the alpha-mask wipe above.
    this.tweens.add({
      targets: view,
      y: view.y - 16,
      alpha: 0,
      duration,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (!view.active) return;
        view.setAlpha(0);
      },
    });

    const treatment = FRAME_TREATMENTS[variant?.frame ?? 'white'];
    const moteTint = treatment.rainbow
      ? colorInt(theme.colors.gold)
      : treatment.ring ?? treatment.wash ?? colorInt(theme.colors.gold);
    const moteCount = shardMoteCount(policy.particleScale);
    for (let i = 0; i < moteCount; i++) {
      const angle = (Math.PI * 2 * i) / moteCount - Math.PI / 2;
      const mote = this.add
        .image(view.x + Math.cos(angle) * 126, view.y + Math.sin(angle) * 174, 'fx-star')
        .setTint(moteTint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.55);
      c.add(mote);
      this.tweens.add({
        targets: mote,
        x: view.x + Math.cos(angle + 1.7) * 28,
        y: view.y + Math.sin(angle + 1.7) * 38,
        scale: 0.85,
        duration: 160,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (!isCurrent() || !mote.active) return;
          this.tweens.add({
            targets: mote,
            x: badge.x + this.goldBadge.coin.x,
            y: badge.y,
            alpha: 0,
            scale: 0.18,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              if (mote.active) mote.destroy();
            },
          });
        },
      });
    }

    if (
      policy.iridescence &&
      (variant?.holo === 'rainbow' || variant?.holo === 'pearlescent')
    ) {
      // The existing pointer-reactive iridescence shader gets one final pass.
      this.tweens.addCounter({
        from: -1,
        to: 1,
        duration: 360,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          if (!isCurrent()) return;
          view.setHoloPointer(view.x + (tween.getValue() ?? 0) * CARD_W, view.y);
        },
      });
    }

    const countStartedAt = this.time.now;
    timers.push(
      this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (!isCurrent() || !badge.active) return;
          this.goldBadge.refresh(shardCountUpValue(goldBefore, gained, this.time.now - countStartedAt));
        },
      }),
    );
    timers.push(
      this.time.delayedCall(SHARD_GOLD_COUNT_UP_MS, () => {
        if (!isCurrent() || !badge.active) return;
        this.goldBadge.refresh(goldBefore + gained);
        Sfx.play('coin');
      }),
    );
    timers.push(
      this.time.delayedCall(duration, () => {
        if (!isCurrent()) return;
        finished = true;
        cleanup();
        this.inspectRitualCleanup = null;
        onComplete();
      }),
    );
  }

  // ---------------------------------------------------------------- phone

  /**
   * The phone binder (D-Binder): the cards in one scrolling grid, the search
   * field in the top bar beside the purse, and the filters in the column with
   * the collected counter at its foot.
   */
  private buildCompact(): void {
    const type = theme.compactType;
    const shell = compactShell(sceneStage(this).content, { back: true });
    const column = shell.column ?? { x: shell.main.x + shell.main.width, y: shell.main.y, width: 0, height: shell.main.height };
    const goBack = (): void => {
      this.scene.start('MainMenu');
    };
    const header = compactHeader(this, shell, { title: 'Collection', onBack: goBack });
    registerSceneBackNavigation(this, goBack);
    const purse = compactPurse(this, shell.right.x + shell.right.width, shell.right.y + shell.right.height / 2, () => this.saveData.gold);
    this.goldBadge = purse.badge;

    // The search field takes the top bar between the title and the purse.
    const searchX = header.title.x + header.title.width + COMPACT.gap * 2;
    const searchW = Math.max(0, purse.left - COMPACT.gap * 2 - searchX);
    const search = createSearchInput(this, searchX + searchW / 2, shell.title.y + shell.title.height / 2, {
      width: searchW,
      placeholder: 'Name, type, trait, mechanic…',
      accessibleName: 'Search cards by name, type, trait, or mechanic',
      onChange: (value) => {
        this.state.search = value;
        this.renderCompactBinder(0);
      },
    });
    // 16 px or more, or a phone's browser zooms the page when the field takes focus.
    Object.assign(search.inputElement.style, { height: `${COMPACT.touch}px`, fontSize: `${Math.max(16, type.body)}px` });
    this.searchInput = search;

    this.emptyText = this.add
      .text(shell.main.x + shell.main.width / 2, shell.main.y + shell.main.height / 2, 'No cards match these filters.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.compactParts = {
      main: shell.main, column, back: header.back.inputZone,
      columnLayer: null, columnZones: [], list: null, tap: null, scroll: null, picker: null, pickerOffset: 0,
    };

    // ←/→ step the open card, as on desktop; the grid scrolls with a drag or the wheel.
    this.input.keyboard?.on('keydown-LEFT', this.onPreviousKey);
    this.input.keyboard?.on('keydown-RIGHT', this.onNextKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-LEFT', this.onPreviousKey);
      this.input.keyboard?.off('keydown-RIGHT', this.onNextKey);
      this.inspectRitualCleanup?.();
      this.inspectRitualCleanup = null;
      search.teardown();
    });

    this.renderCompactBinder(this.fixture?.scroll === 'end' ? Number.MAX_SAFE_INTEGER : 0);
    if (this.fixture?.inspectCardId) {
      const card = this.cards.find((entry) => entry.id === this.fixture?.inspectCardId);
      if (card) this.showInspect(card, this.fixture.clearedDisplayPin);
    } else if (this.fixture?.openFilter) this.openCompactPicker(this.fixture.openFilter);
    this.data.set('a11yReady', true);
  }

  /**
   * Rebuild the grid for the current filters and sort. `scrollTo` is where it
   * opens (0 after a filter change), or null to keep the place (a craft, a
   * shard). Only the rows near the view are built: the full catalogue is
   * nearly 2,000 cards.
   */
  private renderCompactBinder(scrollTo: number | null): void {
    const parts = this.compactParts;
    if (!parts) return;
    this.binderStale = false;
    const C = COLLECTION_COMPACT;
    const type = theme.compactType;
    const save = this.saveData;
    const pool = this.currentPool();
    const offset = scrollTo ?? parts.scroll?.offset() ?? 0;
    parts.list?.destroy();
    parts.tap?.destroy();
    this.goldBadge.refresh(save.gold);
    this.emptyText.setVisible(pool.length === 0);

    const main = parts.main;
    const badgeStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700 };
    const probe = this.add.text(0, 0, 'UR ×4', badgeStyle);
    const grid = binderGrid(main.width, probe.height, currentAccessibility().textScale >= 1.3,
      isDesktopStage(sceneStage(this)) ? DESKTOP_GRID.cardMinW : undefined);
    probe.destroy();
    const columns = grid.columns;
    const list = this.add.container(0, main.y);
    const rows: (Phaser.GameObjects.Container | null)[] = Array.from({ length: Math.ceil(pool.length / columns) }, () => null);
    const buildRow = (r: number): Phaser.GameObjects.Container => {
      const row = this.add.container(0, r * grid.pitchY);
      pool.slice(r * columns, (r + 1) * columns).forEach((d, k) => {
        const x = main.x + k * grid.pitchX;
        const owned = ownedCount(save, d.id);
        const thumb = makeCardThumb(this, x + grid.cardW / 2, grid.cardH / 2, d, grid.cardW / CARD_W, undefined, this.binderVariant(d));
        if (owned === 0) thumb.setAlpha(0.32); // calibrated against the 0.70 dim
        // The badge line under the face: tier on the left, counts on the right.
        const y = grid.cardH + C.badgeGap;
        const badge = (text: string, color: string): Phaser.GameObjects.Text =>
          this.add.text(0, y, text, { ...badgeStyle, color });
        const tier = badge(TIER_LABEL[d.rarity], TIER_TEXT_COLOR[d.rarity]).setX(x);
        const specials = specialVariantCount(save, d.id);
        const counts = [
          ...(owned > 0 ? [badge(`×${owned}`, owned >= PLAYSET ? theme.colors.gold : theme.colors.heading)] : []),
          ...(specials > 0 ? [badge(`✦${specials}`, TIER_TEXT_COLOR.ssr)] : []),
        ];
        let cursor = x + grid.cardW;
        for (const t of [...counts].reverse()) {
          t.setOrigin(1, 0).setX(cursor);
          cursor -= t.width + COMPACT.gap;
        }
        row.add([thumb, tier, ...counts]);
      });
      list.add(row);
      return row;
    };
    // Art for the rows in view and a screen either side.
    const artFor = (from: number, to: number): string[] =>
      this.spreadArtFor(pool.slice(Math.max(0, from) * columns, Math.max(0, to) * columns));
    const showRows = (at: number): void => {
      const first = Math.floor(at / grid.pitchY);
      const last = Math.floor((at + main.height) / grid.pitchY);
      const span = Math.ceil(main.height / grid.pitchY);
      this.spreadArt?.show(artFor(first, last + 1), [...artFor(first - span, first), ...artFor(last + 1, last + 1 + span)]);
      rows.forEach((row, r) => {
        const near = r >= first - span && r <= last + span;
        if (near && !row) rows[r] = buildRow(r);
        else if (!near && row) {
          row.destroy();
          rows[r] = null;
        }
      });
    };
    const scroll = bindMenuScroll(this, list, main, binderHeight(grid, pool.length), undefined, [], 0, undefined, offset);
    scroll.onScroll = showRows;
    showRows(scroll.offset());
    // One tap target over the grid: the card is worked out from where the tap lands.
    const tap = this.add.zone(main.x + main.width / 2, main.y + main.height / 2, main.width, main.height)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, tap, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.inspect) return;
      const index = binderCellAt(grid, pool.length, pointer.worldX - main.x, pointer.worldY - main.y + scroll.offset());
      if (index !== null) this.showInspect(pool[index]);
    });
    parts.list = list;
    parts.tap = tap;
    parts.scroll = scroll;
    this.renderCompactColumn();
  }

  /** The column: the filters (or the open picker) and the collected counter. */
  private renderCompactColumn(): void {
    const parts = this.compactParts;
    if (!parts) return;
    parts.columnLayer?.destroy();
    const layer = this.add.container(0, 0);
    parts.columnLayer = layer;
    parts.columnZones = [];
    if (parts.picker) this.drawCompactPicker(layer, parts.picker);
    else this.drawCompactFacets(layer);
    this.guardTargets = [parts.back, ...parts.columnZones, ...(parts.tap ? [parts.tap] : [])];
  }

  /** A facet's value as the column shows it. */
  private compactFacetValue(name: CollectionFilterName): string {
    const label = <T extends string>(options: readonly DropdownOption<T>[], value: T): string =>
      options.find((option) => option.value === value)?.label ?? String(value);
    switch (name) {
      case 'set': return label(collectionSetOptions(), this.state.set);
      case 'color': return label(COLLECTION_COLOR_OPTIONS, this.state.color);
      case 'type': return label(COLLECTION_TYPE_OPTIONS, this.state.type);
      case 'rarity': return label(COLLECTION_RARITY_OPTIONS, this.state.rarity);
      case 'sort': return compactSortLabel(this.sortSelection);
    }
  }

  /** The filter column (D-Binder): Set, Color and Type, Rarity and Owned only, Sort, and the counter at the foot. */
  private drawCompactFacets(layer: Phaser.GameObjects.Container): void {
    const parts = this.compactParts!;
    const col = parts.column;
    const C = COLLECTION_COMPACT;
    const type = theme.compactType;
    const save = this.saveData;
    const pad = 6;
    // Laid out in column-local coordinates; the block sits at the column's left.
    const block = this.add.container(col.x, 0);
    layer.add(block);
    const labelStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted };
    const valueStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading };
    const probe = this.add.text(0, 0, 'Set', labelStyle);
    const probeValue = this.add.text(0, 0, 'All', valueStyle);
    const controlH = Math.max(COMPACT.touch, pad * 2 + probe.height + probeValue.height);
    probe.destroy();
    probeValue.destroy();

    // The counter: kinds collected, the pool share and specials, and a bar (dropped at the largest text, D-Binder130).
    const collectible = collectiblePool(this.cards);
    const ownedKinds = collectible.filter((d) => ownedCount(save, d.id) > 0).length;
    const completion = collectionCompletion(this.cards, save);
    // Floor, from the integer counts, so 100% means complete (as on desktop).
    const poolPercent = completion.total === 0 ? 0 : Math.floor((completion.owned * 100) / completion.total);
    const counted = this.add.text(C.counterPad, 0, `${formatCount(ownedKinds)}/${formatCount(collectible.length)} collected`, {
      ...valueStyle, fontStyle: theme.weight.w700, wordWrap: { width: col.width - C.counterPad * 2 },
    });
    const share = this.add.text(C.counterPad, 0, `${poolPercent}% pool · ${specialCardsLabel(completion.variants.specialCards)}`, {
      ...labelStyle, wordWrap: { width: col.width - C.counterPad * 2 },
    });
    const bar = currentAccessibility().textScale < 1.3;
    const counterH = C.counterPad * 2 + counted.height + share.height + (bar ? COMPACT.gap + C.barH : 0);
    const L = binderColumn(col.width, col.height, controlH, counterH);

    const plate = (g: Phaser.GameObjects.Graphics, r: Rect, active = false): void => {
      g.fillStyle(active ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(theme.control.borderWidth, active ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, active ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control);
    };
    const zoneOn = (r: Rect, onTap: () => void): void => {
      const zone = this.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, (pointer) => {
        if (Math.abs(pointer.upY - pointer.downY) <= COMPACT_DRAG_SLOP) onTap();
      });
      block.add(zone);
      parts.columnZones.push(zone);
    };
    const chevron = Math.round(type.body * 0.9);
    const facet = (name: CollectionFilterName, label: string, r: Rect): void => {
      const g = this.add.graphics();
      plate(g, r);
      const caption = this.add.text(r.x + 10, 0, label, labelStyle);
      const value = this.add.text(r.x + 10, 0, '', valueStyle);
      ellipsizeText(value, r.width - 20 - chevron - COMPACT.gap, this.compactFacetValue(name));
      const top = r.y + (r.height - caption.height - value.height) / 2;
      caption.setY(top);
      value.setY(top + caption.height);
      const icon = this.add.image(r.x + r.width - 10 - chevron / 2, r.y + r.height / 2, bakeUiIcon(this, 'chevron'))
        .setDisplaySize(chevron, chevron).setAngle(90).setTint(colorInt(theme.colors.muted));
      block.add([g, caption, value, icon]);
      zoneOn(r, () => this.openCompactPicker(name));
    };
    facet('set', 'Set', L.set);
    facet('color', 'Color', L.color);
    facet('type', 'Type', L.type);
    facet('rarity', 'Rarity', L.rarity);
    facet('sort', 'Sort', L.sort);

    // Owned only: a checkbox, gold when on.
    const on = this.state.ownedOnly;
    const ownedPlate = this.add.graphics();
    plate(ownedPlate, L.owned, on);
    const box = Math.round(type.body * 1.3);
    const boxX = L.owned.x + 10;
    const boxY = L.owned.y + (L.owned.height - box) / 2;
    const check = this.add.graphics()
      .fillStyle(colorInt(on ? theme.colors.gold : theme.colors.btnGhostBg), 1)
      .fillRoundedRect(boxX, boxY, box, box, 4)
      .lineStyle(theme.control.borderWidth, colorInt(on ? theme.colors.gold : theme.colors.panelStroke), 1)
      .strokeRoundedRect(boxX, boxY, box, box, 4);
    if (on) {
      check.lineStyle(Math.max(2, Math.round(box / 8)), colorInt(theme.colors.onGold), 1).beginPath()
        .moveTo(boxX + box * 0.24, boxY + box * 0.52).lineTo(boxX + box * 0.42, boxY + box * 0.7)
        .lineTo(boxX + box * 0.76, boxY + box * 0.3).strokePath();
    }
    const ownedLabel = this.add.text(boxX + box + COMPACT.gap, 0, 'Owned only', {
      ...valueStyle, color: on ? theme.colors.gold : theme.colors.body,
      wordWrap: { width: L.owned.x + L.owned.width - 8 - (boxX + box + COMPACT.gap) },
    });
    ownedLabel.setY(L.owned.y + (L.owned.height - ownedLabel.height) / 2);
    block.add([ownedPlate, check, ownedLabel]);
    zoneOn(L.owned, () => {
      this.state.ownedOnly = !this.state.ownedOnly;
      this.renderCompactBinder(0);
    });

    const counter = this.add.graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
      .fillRoundedRect(0, L.counter.y, col.width, L.counter.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(0, L.counter.y, col.width, L.counter.height, theme.radius.panel);
    counted.setY(L.counter.y + C.counterPad);
    share.setY(counted.y + counted.height);
    block.add([counter, counted, share]);
    if (bar) {
      const barY = share.y + share.height + COMPACT.gap;
      const barW = col.width - C.counterPad * 2;
      const fill = collectible.length === 0 ? 0 : ownedKinds / collectible.length;
      block.add(this.add.graphics()
        .fillStyle(theme.graphics.rowFill, 1).fillRoundedRect(C.counterPad, barY, barW, C.barH, C.barH / 2)
        .fillStyle(colorInt(theme.colors.gold), 1).fillRoundedRect(C.counterPad, barY, Math.max(C.barH, barW * fill), C.barH, C.barH / 2));
    }

    if (L.height <= col.height) {
      block.setY(col.y);
      return;
    }
    // At the largest text on a short phone the column outgrows the screen, and scrolls.
    const adapters = parts.columnZones.map((zone) => ({
      container: block, inputZone: zone,
      getMeasuredBounds: () => ({ hit: { x: zone.x - zone.width / 2, y: zone.y - zone.height / 2, width: zone.width, height: zone.height } }),
      setEnabled: (enabled: boolean) => { if (enabled) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); },
    }) as unknown as ThemedButton);
    bindMenuScroll(this, block, col, L.height, () => this.inspect !== null, adapters);
  }

  /** Open a facet's picker over the column (D-BinderSet). */
  private openCompactPicker(name: CollectionFilterName): void {
    const parts = this.compactParts;
    if (!parts) return;
    parts.picker = name;
    parts.pickerOffset = 0;
    this.renderCompactColumn();
  }

  /**
   * A facet's picker: its options down the column, the chosen one outlined in
   * gold with a check. A choice applies at once and the picker stays open;
   * Done (or the back chevron) returns to the facets.
   */
  private drawCompactPicker(layer: Phaser.GameObjects.Container, name: CollectionFilterName): void {
    const parts = this.compactParts!;
    const col = parts.column;
    const type = theme.compactType;
    const done = (): void => {
      parts.picker = null;
      this.renderCompactColumn();
    };
    const back = compactIconButton(this, { x: col.x, y: col.y, width: COMPACT.touch, height: COMPACT.touch }, 'back', done);
    const title = this.add.text(col.x + COMPACT.touch + 12, 0, {
      set: 'Set', color: 'Color', type: 'Type', rarity: 'Rarity', sort: 'Sort',
    }[name], { fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading });
    title.setY(col.y + (COMPACT.touch - title.height) / 2);
    const footY = col.y + col.height - COMPACT.touch;
    const half = (col.width - COMPACT.gap) / 2;
    const reset = compactButton(this, { x: col.x, y: footY, width: half, height: COMPACT.touch }, 'Reset filters', {
      fontSize: type.label,
      onTap: () => {
        const search = this.state.search;
        this.state = { ...defaultFilterState(), ownedOnly: true, search };
        this.sortSelection = { ...DEFAULT_COLLECTION_SORT };
        parts.pickerOffset = parts.pickerScroll?.offset() ?? 0;
        this.renderCompactBinder(0);
      },
    });
    const finish = compactButton(this, { x: col.x + half + COMPACT.gap, y: footY, width: half, height: COMPACT.touch }, 'Done', {
      variant: 'primary', onTap: done,
    });
    layer.add([back.container, title, reset.container, finish.container]);
    parts.columnZones.push(back.inputZone, reset.inputZone, finish.inputZone);

    const options = this.compactPickerOptions(name);
    const view = { x: col.x, y: col.y + COMPACT.touch + COMPACT.gap, width: col.width, height: 0 };
    view.height = Math.max(0, footY - COMPACT.gap - view.y);
    const rowW = view.width - COLLECTION_COMPACT.thumbLane;
    const icon = Math.round(type.body * 1.1);
    const list = this.add.container(0, view.y);
    layer.add(list);
    const tops: number[] = [];
    let y = 0;
    for (const option of options) {
      const label = this.add.text(view.x + 12, 0, option.label, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
        color: option.selected ? theme.colors.gold : theme.colors.body,
        wordWrap: { width: rowW - 24 - icon - COMPACT.gap },
      });
      const h = Math.max(COMPACT.touch, label.height + 12);
      label.setY(y + (h - label.height) / 2);
      const g = this.add.graphics()
        .fillStyle(option.selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(view.x, y, rowW, h, theme.radius.control)
        .lineStyle(theme.control.borderWidth, option.selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke,
          option.selected ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(view.x, y, rowW, h, theme.radius.control);
      list.add([g, label]);
      if (option.selected) {
        list.add(this.add.image(view.x + rowW - 12 - icon / 2, y + h / 2, bakeUiIcon(this, 'check'))
          .setDisplaySize(icon, icon).setTint(colorInt(theme.colors.gold)));
      }
      tops.push(y);
      y += h + COMPACT.gap;
    }
    const contentH = Math.max(0, y - COMPACT.gap);
    const scroll = bindMenuScroll(this, list, view, contentH, () => this.inspect !== null, [], 0, undefined, parts.pickerOffset);
    parts.pickerScroll = scroll;
    const tap = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height)
      .setInteractive({ useHandCursor: true });
    layer.add(tap);
    parts.columnZones.push(tap);
    bindTapButton(this, tap, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      const at = pointer.worldY - view.y + scroll.offset();
      const index = tops.findIndex((top, i) => at >= top && at <= (tops[i + 1] ?? contentH + COMPACT.gap) - COMPACT.gap);
      const option = options[index];
      if (!option || option.selected) return;
      option.apply();
      parts.pickerOffset = scroll.offset();
      this.renderCompactBinder(0);
    });
  }

  /** A facet's options for its picker, each with whether it is chosen and how to choose it. */
  private compactPickerOptions(name: CollectionFilterName): { label: string; selected: boolean; apply: () => void }[] {
    const state = this.state;
    const of = <T extends string>(options: readonly DropdownOption<T>[], get: () => T, set: (value: T) => void) =>
      options.map((option) => ({ label: option.label, selected: get() === option.value, apply: () => set(option.value) }));
    switch (name) {
      case 'set': return of(collectionSetOptions(), () => state.set, (value) => { state.set = value; });
      case 'color': return of(COLLECTION_COLOR_OPTIONS, () => state.color, (value) => { state.color = value; });
      case 'type': return of(COLLECTION_TYPE_OPTIONS, () => state.type, (value) => { state.type = value; });
      case 'rarity': return of(COLLECTION_RARITY_OPTIONS, () => state.rarity, (value) => { state.rarity = value; });
      case 'sort':
        // Each criterion in both directions, as one choice (the desktop's dropdown and flip button).
        return COLLECTION_SORT_OPTIONS.flatMap((option) => [false, true].map((reversed) => {
          const sort = { key: option.value, reversed };
          return {
            label: compactSortLabel(sort),
            selected: this.sortSelection.key === sort.key && this.sortSelection.reversed === reversed,
            apply: () => { this.sortSelection = sort; },
          };
        }));
    }
  }

  /**
   * The phone card detail (D-Detail, D-Craft): the face on the left; its
   * odds and keyword guide in the middle (and, at the largest text, the full
   * rules, D-Detail130) over Previous and Next; the variants, or the craft
   * price, in the right column with the actions at its foot.
   */
  private showCompactInspect(d: CardDef, clearedDisplayPin: boolean): void {
    this.closeInspect();
    this.searchInput?.setVisible(false); // DOM input always floats above the canvas
    // The detail has no purse (its heading and close button take that corner); the price panel shows the gold.
    this.goldBadge.container.setVisible(false);
    const stage = sceneStage(this);
    const content = stage.content;
    const C = COLLECTION_COMPACT;
    const type = theme.compactType;
    const save = this.saveData;
    const owned = ownedCount(save, d.id);
    const largeText = currentAccessibility().textScale >= 1.3;
    const shell = modalShell(this, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0.92, dismissal: 'esc-only', depth: theme.depth.overlay, onClose: () => this.closeInspect(),
    });
    // The binder shows faintly through, as in the mock; the dim covers the whole screen.
    shell.panel.clear();
    const c = shell.container;
    const whole = { x: 0, y: 0, width: stage.width, height: stage.height };
    c.setData('a11ySurface', whole).setData('a11yPanel', content);
    let ritualInProgress = false;
    const shown = owned > 0 ? displayVariantFor(save, d.id) : null;
    let displayedVariant: CardVariant | undefined = shown ?? undefined;

    // The actions, measured first: the list takes the room above them.
    const rightW = compactInspectLayout(content, largeText, 0).right.width;
    const actionStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 };
    const actionHeight = (labels: readonly string[]): number => {
      const probe = this.add.text(0, 0, '', { ...actionStyle, wordWrap: { width: rightW - 24 - 30 } });
      const h = Math.max(...labels.map((label) => probe.setText(label).height));
      probe.destroy();
      return Math.max(COMPACT.touch, h + 14);
    };
    const craftable = owned === 0 && !d.token && !d.supertypes?.includes('basic');
    const cost = craftable ? craftCost(CARD_DB, d.id) : 0;
    const excess = owned > 0 ? shardableCount(save, d.id) : 0;
    const shardGain = excess > 0 ? shardGold(save, CARD_DB, d.id) : 0;
    const heroLabels = ['Set default hero', 'Default hero (tap to clear)'];
    const shardLabels = [`Hold to shard ×${excess} extra (+${formatGold(shardGain)})`, `Hold to release (+${formatGold(shardGain)})`];
    const craftLabel = `Craft (-${formatGold(cost)})`;
    const actions: { kind: 'hero' | 'shard' | 'craft'; height: number }[] = [];
    if (owned > 0) actions.push({ kind: 'hero', height: actionHeight(heroLabels) });
    if (excess > 0) actions.push({ kind: 'shard', height: actionHeight(shardLabels) });
    if (craftable) actions.push({ kind: 'craft', height: COMPACT.touch });
    const actionsH = actions.reduce((sum, a) => sum + a.height, 0) + COMPACT.gap * Math.max(0, actions.length - 1);
    const L = compactInspectLayout(content, largeText, actionsH);
    const tops = stackUp(L.right.y + L.right.height, actions.map((a) => a.height), COMPACT.gap);
    const actionRect = (i: number): Rect => ({ x: L.right.x, y: tops[i], width: L.right.width, height: actions[i].height });
    // A button whose label wraps rather than runs past its plate (the largest text).
    const wrapLabel = (button: CompactButton, text: string): void => {
      button.label.setWordWrapWidth(L.right.width - 24 - (button.container.list.some((o) => o instanceof Phaser.GameObjects.Image) ? 30 : 0))
        .setAlign('center');
      button.setLabel(text);
    };

    // The face, with the holo following the pointer (touch gets no tilt).
    const view = new CardView(this, L.face.x + L.face.width / 2, L.face.y + L.face.height / 2);
    view.setScale(L.face.width / CARD_W).setCard(d, shown ? { fx: 'full', variant: shown, fullArt: shown.fullArt } : { fx: 'full' });
    c.add(view);
    this.holoMove = (p: Phaser.Input.Pointer) => {
      if (view.active && !ritualInProgress) view.setHoloPointer(p.worldX, p.worldY);
    };
    this.input.on('pointermove', this.holoMove);

    // The middle column, rebuilt when a variant changes the odds.
    let middle: Phaser.GameObjects.Container | null = null;
    const renderMiddle = (variant: CardVariant): void => {
      middle?.destroy();
      const layer = this.add.container(0, L.middle.y);
      middle = layer;
      c.add(layer);
      const x = L.middle.x;
      const w = L.middle.width - C.thumbLane;
      const inner = w - C.platePad * 2;
      let y = 0;
      const text = (str: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text =>
        this.add.text(x + C.platePad, 0, str, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width: inner }, ...extra });
      const plateAround = (items: Phaser.GameObjects.Text[], gaps: number[] = []): void => {
        const top = y;
        let cursor = top + C.platePad;
        items.forEach((item, i) => {
          item.setY(cursor);
          cursor += item.height + (gaps[i] ?? 2);
        });
        const h = cursor - (gaps[items.length - 1] ?? 2) + C.platePad - top;
        layer.add(this.add.graphics()
          .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(x, top, w, h, theme.radius.panel)
          .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(x, top, w, h, theme.radius.panel));
        layer.add(items);
        y = top + h + C.plateGap;
      };

      // The name and the tier in words (the face clips a long name, and shows
      // the tier only as a gem colour), then the set and how many you own.
      const specials = specialVariantCount(save, d.id);
      const name = this.add.text(x, y, d.name, {
        fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        wordWrap: { width: w },
      });
      y += name.height + 2;
      const rarity = d.token ? null : this.add.text(x, y, rarityLine(d), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: TIER_TEXT_COLOR[d.rarity],
        wordWrap: { width: w },
      });
      if (rarity) y += rarity.height;
      const facts = [SET_TITLES[d.set ?? 'base'], ...(owned > 0 ? [`×${owned}`] : []), ...(specials > 0 ? [`✦${specials}`] : [])];
      const set = this.add.text(x, y, facts.join(' · '), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
        wordWrap: { width: w },
      });
      layer.add([name, ...(rarity ? [rarity] : []), set]);
      y += set.height + C.plateGap;

      // At the largest text the face's rules are too small to read, so they are set here at size.
      if (largeText) {
        const stats = d.attack !== undefined && d.defense !== undefined ? ` · ${d.attack}/${d.defense}` : '';
        const rules = rulesText(d);
        plateAround([
          text(`${typeLine(d)}${stats}`, type.label, theme.colors.muted),
          ...(rules ? [text(rules, type.body, theme.colors.body, { lineSpacing: 2 })] : []),
        ], [6]);
      }

      const plate = cardAtelierProbabilityPlate(d.rarity, variant);
      plateAround([
        text('EXACT BOOSTER-SLOT ODDS', type.micro, theme.colors.muted, { fontStyle: theme.weight.w700, letterSpacing: 1 }),
        text(`${plate.oddsText} · ${plate.percentText}`, type.body, theme.colors.gold, { fontFamily: theme.fonts.display }),
        text(plate.axisText, type.caption, theme.colors.body),
      ]);

      const entries = cardGlossaryEntries(d);
      if (entries.length > 0) {
        const items = [text('Keyword Guide', type.body, theme.colors.heading, { fontFamily: theme.fonts.display, fontStyle: theme.weight.w700 })];
        const gaps = [6];
        for (const entry of entries) {
          items.push(text(entry.name, type.label, theme.colors.gold, { fontStyle: theme.weight.w700 }));
          items.push(text(entry.reminder, type.caption, theme.colors.body));
          gaps.push(1, 6);
        }
        plateAround(items, gaps);
      }
      bindMenuScroll(this, layer, L.middle, Math.max(0, y - C.plateGap), () => ritualInProgress, [], 0, shell);
    };
    renderMiddle(shown ?? PLAIN_VARIANT);

    // Previous and Next walk the binder's order, as ←/→ do.
    const pool = this.currentPool();
    const index = pool.findIndex((entry) => entry.id === d.id);
    const previous = compactButton(this, L.previous, 'Previous', { onTap: () => { if (!ritualInProgress) this.stepInspect(-1); } });
    const next = compactButton(this, L.next, 'Next', { onTap: () => { if (!ritualInProgress) this.stepInspect(1); } });
    previous.setEnabled(index > 0);
    next.setEnabled(index >= 0 && index < pool.length - 1);
    const close = compactIconButton(this, L.close, 'close', () => {
      if (!ritualInProgress) this.closeInspect();
    });
    const heading = this.add.text(L.heading.x, 0, owned > 0 ? 'OWNED VARIANTS' : 'NOT YET COLLECTED', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, letterSpacing: 1.2,
      color: owned > 0 ? theme.colors.heading : theme.colors.muted,
    });
    // The smallest phone at Largest text: a size down before any letters go.
    if (heading.width > L.heading.width) heading.setFontSize(type.caption).setLetterSpacing(0.6);
    ellipsizeText(heading, L.heading.width);
    heading.setY(L.heading.y + (L.heading.height - heading.height) / 2);
    c.add([previous.container, next.container, close.container, heading]);

    let listTop = L.list.y;
    if (clearedDisplayPin) {
      const note = this.add.text(L.list.x, listTop, 'Pinned display cleared. Showing your rarest owned look.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.success, wordWrap: { width: L.list.width },
      });
      c.add(note);
      listTop += note.height + COMPACT.gap;
    }
    const listView = { x: L.list.x, y: listTop, width: L.list.width, height: Math.max(0, L.list.y + L.list.height - listTop) };

    if (owned > 0) {
      this.compactVariantList(c, shell, d, listView, (variant) => {
        displayedVariant = variant;
        view.setCard(d, { fx: 'full', variant, fullArt: variant.fullArt });
        renderMiddle(variant);
      }, () => ritualInProgress);
    } else {
      this.compactCraftPrice(c, d, listView, craftable, cost);
    }

    actions.forEach((action, i) => {
      const rect = actionRect(i);
      if (action.kind === 'hero') {
        const label = (): string => (save.heroCardId === d.id ? heroLabels[1] : heroLabels[0]);
        const hero: CompactButton = compactButton(this, rect, '', {
          icon: 'star', variant: save.heroCardId === d.id ? 'selected' : 'ghost',
          onTap: () => {
            if (ritualInProgress) return;
            save.heroCardId = save.heroCardId === d.id ? null : d.id;
            this.flushSave();
            Sfx.play('shimmer');
            wrapLabel(hero, label());
            hero.setVariant(save.heroCardId === d.id ? 'selected' : 'ghost');
          },
        });
        wrapLabel(hero, label());
        c.add(hero.container);
      } else if (action.kind === 'shard') {
        const shard = compactButton(this, rect, '', { onTap: () => undefined });
        wrapLabel(shard, shardLabels[0]);
        const progressFill = this.add.graphics();
        shard.container.addAt(progressFill, 1);
        c.add(shard.container);
        this.bindShardHold({
          c, d, view, gold: shardGain, progressFill, holdLabel: shardLabels[0], zone: shard.inputZone,
          bounds: () => ({ x: 0, y: 0, width: rect.width, height: rect.height }),
          setLabel: (text) => wrapLabel(shard, text),
          setEnabled: (enabled) => shard.setEnabled(enabled),
          displayedVariant: () => displayedVariant,
          isRitualInProgress: () => ritualInProgress,
          startRitual: () => {
            ritualInProgress = true;
          },
        });
      } else {
        const craft = compactButton(this, rect, craftLabel, {
          variant: 'primary',
          onTap: () => {
            if (ritualInProgress || save.gold < cost) return;
            if (!save.settings.confirmDestructive) {
              this.craft(d);
              return;
            }
            // On touch a double tap would pass straight through the desktop's
            // armed button, so the confirm is a dialog whose primary sits
            // away from the first tap (D-CraftConfirm).
            compactDialog(this, {
              title: 'Craft: confirm',
              message: [d.name, `One Standard copy for ${formatGold(cost)}. You keep ${formatGold(save.gold - cost)}.`],
              secondary: { label: 'Cancel', onTap: (closeDialog) => closeDialog() },
              primary: {
                label: craftLabel,
                onTap: (closeDialog) => {
                  closeDialog();
                  this.craft(d);
                },
              },
              dismissal: 'dismissible',
              onClose: () => undefined,
            });
          },
        });
        // An unaffordable craft keeps its price and goes inert (as the Shop's Buy does).
        craft.setEnabled(save.gold >= cost);
        c.add(craft.container);
      }
    });

    this.guard.open([...this.cells, ...this.guardTargets]);
    this.inspect = c;
    this.inspectDef = d;
  }

  /**
   * The owned variants, rarest first: each row its finish over its count and
   * odds, the shown one outlined in gold, with the pin beside it. One tap
   * target over the list works out the row, and the pin, from where it lands.
   */
  private compactVariantList(
    c: Phaser.GameObjects.Container,
    shell: ModalShell,
    d: CardDef,
    view: Rect,
    present: (variant: CardVariant) => void,
    busy: () => boolean,
  ): void {
    const type = theme.compactType;
    const save = this.saveData;
    const entries = [...ownedVariantEntries(save, d.id)].sort(
      (a, b) => finishOdds(a.variant.frame, a.variant.holo, a.variant.fullArt)
        - finishOdds(b.variant.frame, b.variant.holo, b.variant.fullArt)
        || variantKey(a.variant).localeCompare(variantKey(b.variant)),
    );
    let selectedKey = variantKey(displayVariantFor(save, d.id));
    let pinnedKey: string | null = save.pinnedVariants[d.id] ?? null;
    const pinW = COMPACT.touch;
    const rowW = view.width - pinW - COMPACT.gap;
    const icon = Math.round(type.body * 1.1);
    const textX = view.x + 10 + icon + 6;
    const list = this.add.container(0, view.y);
    c.add(list);
    const rows = entries.map((entry) => {
      const name = this.add.text(textX, 0, variantLabel(entry.variant), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
        wordWrap: { width: view.x + rowW - 8 - textX },
      });
      const odds = this.add.text(textX, 0, `×${entry.count} · ${formatOdds(finishOdds(entry.variant.frame, entry.variant.holo, entry.variant.fullArt))}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted,
      });
      const plate = this.add.graphics();
      const mark = this.add.image(view.x + 10 + icon / 2, 0, bakeUiIcon(this, 'chevron')).setDisplaySize(icon, icon)
        .setTint(colorInt(theme.colors.gold));
      const pin = this.add.graphics();
      const pinIcon = this.add.image(view.x + view.width - pinW / 2, 0, bakeUiIcon(this, 'pin')).setDisplaySize(icon, icon);
      list.add([plate, name, odds, mark, pin, pinIcon]);
      return { entry, name, odds, plate, mark, pin, pinIcon, y: 0, h: Math.max(COMPACT.touch, name.height + odds.height + 10) };
    });
    let y = 0;
    for (const row of rows) {
      row.y = y;
      row.name.setY(y + (row.h - row.name.height - row.odds.height) / 2);
      row.odds.setY(row.name.y + row.name.height);
      row.mark.setY(y + row.h / 2);
      row.pinIcon.setY(y + row.h / 2);
      y += row.h + COMPACT.gap;
    }
    const contentH = Math.max(0, y - COMPACT.gap);
    const restyle = (): void => {
      for (const row of rows) {
        const key = variantKey(row.entry.variant);
        const selected = key === selectedKey;
        const pinned = key === pinnedKey;
        row.plate.clear()
          .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
          .fillRoundedRect(view.x, row.y, rowW, row.h, theme.radius.control)
          .lineStyle(theme.control.borderWidth, selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, selected ? 1 : theme.alpha.chrome)
          .strokeRoundedRect(view.x, row.y, rowW, row.h, theme.radius.control);
        row.name.setColor(selected ? theme.colors.gold : theme.colors.body);
        row.mark.setVisible(selected);
        const colors = themedButtonColors(pinned ? 'selected' : 'ghost');
        row.pin.clear()
          .fillStyle(colorInt(colors.bg), 1).fillRoundedRect(view.x + view.width - pinW, row.y, pinW, row.h, theme.radius.control)
          .lineStyle(controlStrokeWidth(false, pinned ? 'selected' : 'ghost'), colorInt(colors.stroke), theme.alpha.chrome)
          .strokeRoundedRect(view.x + view.width - pinW, row.y, pinW, row.h, theme.radius.control);
        row.pinIcon.setTint(colorInt(colors.fg));
      }
    };
    restyle();
    const scroll = bindMenuScroll(this, list, view, contentH, busy, [], 0, shell);
    const tap = this.add.zone(view.x + view.width / 2, view.y + view.height / 2, view.width, view.height)
      .setInteractive({ useHandCursor: true });
    c.add(tap);
    bindTapButton(this, tap, (pointer) => {
      if (busy() || Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      const at = pointer.worldY - view.y + scroll.offset();
      const row = rows.find((r) => at >= r.y && at <= r.y + r.h);
      if (!row) return;
      const key = variantKey(row.entry.variant);
      if (pointer.worldX >= view.x + view.width - pinW) {
        // The pin: the binder and the decks show this look; again to unpin.
        let nextVariant: CardVariant;
        if (pinnedKey === key) {
          delete save.pinnedVariants[d.id];
          pinnedKey = null;
          nextVariant = displayVariantFor(save, d.id);
        } else {
          save.pinnedVariants[d.id] = key;
          pinnedKey = key;
          nextVariant = row.entry.variant;
        }
        selectedKey = variantKey(nextVariant);
        present(nextVariant);
        this.flushSave();
        Sfx.play('shimmer');
        this.binderStale = true;
      } else if (pointer.worldX <= view.x + rowW) {
        if (key === selectedKey) return;
        selectedKey = key;
        present(row.entry.variant);
      }
      restyle();
    });
  }

  /** An uncollected card's price (D-Craft): the cost, the purse, and what is left after. */
  private compactCraftPrice(c: Phaser.GameObjects.Container, d: CardDef, view: Rect, craftable: boolean, cost: number): void {
    const type = theme.compactType;
    const C = COLLECTION_COMPACT;
    const gold = this.saveData.gold;
    if (!craftable) {
      c.add(this.add.text(view.x, view.y, `${d.name} cannot be crafted.`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: view.width },
      }));
      return;
    }
    const lines: { label: string; value: number; color: string }[] = [
      { label: 'Craft cost', value: cost, color: theme.colors.gold },
      { label: 'Your gold', value: gold, color: theme.colors.gold },
      gold >= cost
        ? { label: 'After crafting', value: gold - cost, color: theme.colors.gold }
        : { label: 'Short by', value: cost - gold, color: theme.colors.danger },
    ];
    const coin = Math.round(type.body * 1.15);
    let y = view.y + C.platePad;
    const items: Phaser.GameObjects.GameObject[] = [];
    let dividerY = 0;
    lines.forEach((line, i) => {
      if (i === 2) {
        dividerY = y + 2;
        y += 8;
      }
      const label = this.add.text(view.x + C.platePad, y, line.label, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body,
      });
      const value = this.add.text(view.x + view.width - C.platePad, y, formatCount(line.value), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: line.color,
      }).setOrigin(1, 0);
      const mark = this.add.image(value.x - value.width - 6 - coin / 2, y + value.height / 2, bakeUiIcon(this, 'gold'))
        .setDisplaySize(coin, coin);
      items.push(label, value, mark);
      y += Math.max(label.height, coin) + 6;
    });
    const h = y - 6 + C.platePad - view.y;
    const plate = this.add.graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(view.x, view.y, view.width, h, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(view.x, view.y, view.width, h, theme.radius.panel)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome).lineBetween(view.x + C.platePad, dividerY, view.x + view.width - C.platePad, dividerY);
    const note = this.add.text(view.x, view.y + h + COMPACT.gap, 'Crafts one Standard copy.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted, wordWrap: { width: view.width },
    });
    c.add([plate, ...items, note]);
  }

  private closeInspect(): void {
    this.inspectRitualCleanup?.();
    this.inspectRitualCleanup = null;
    if (this.holoMove) {
      this.input.off('pointermove', this.holoMove);
      this.holoMove = null;
    }
    if (this.inspect) {
      this.guard.close();
      this.inspect.destroy();
      this.inspect = null;
    }
    this.inspectDef = null;
    this.searchInput?.setVisible(true);
    this.goldBadge?.container.setVisible(true);
    // Closed (Esc, or a rebuild) before a shard ritual finished: its binder
    // refresh was cancelled with it, so land the new ×N / ✦N badges here.
    if (this.binderStale) this.renderPage();
  }
}
