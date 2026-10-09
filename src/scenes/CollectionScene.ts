import Phaser from 'phaser';
import { formatGold } from '../ui/goldFormat';
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
import { FilterBar, TIER_TEXT_COLOR } from '../ui/binder/FilterBar';
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
  sortCollectionCards,
  type CollectionSortSelection,
} from '../ui/collectionSort';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { rarityLine } from '../ui/CardZoomPreview';
import { ModalGuard } from '../ui/Modal';
import { gateOnPagedArt, PAGE_ART_HOLD_MS, PagedArt } from '../ui/artGate';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';
import {
  SHARD_GOLD_COUNT_UP_MS,
  shardCountUpValue,
  shardDissolveDuration,
  shardHoldDuration,
  shardMoteCount,
} from '../ui/shardRitual';
import { HEADER_CURRENCY_ANCHOR } from '../ui/layout';
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
  private sortSelection: CollectionSortSelection = DEFAULT_COLLECTION_SORT;
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
  private searchInput: Phaser.GameObjects.DOMElement | null = null;
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
    this.sortSelection = DEFAULT_COLLECTION_SORT;
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
        get: () => this.sortSelection,
        set: (value) => {
          this.sortSelection = value as CollectionSortSelection;
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
    else this.turnPage(dir);
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
    if (targetPage !== this.page) {
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
      `${poolPercent}% pool · ${completion.variants.specialCards} special cards`,
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
          const pin = themedButton(this, columns.right - theme.control.minHitWidth / 2, y, '📌', {
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
        const result = craftCard(save, CARD_DB, d.id);
        if (!result.ok) return;
        const checkpoint = checkpointAchievements(save, CARD_DB);
        this.flushSave();
        if (!this.fixture && checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
        Sfx.play('coin');
        this.renderPage(); // refresh counts, thumb alpha, and the gold badge
        this.showInspect(d); // keep the inspect overlay open on the new copy
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
      const holdLabel = `Hold to shard ×${excess} extra (+${formatGold(gold)})`;
      const progressFill = this.add.graphics();
      // The progress visual belongs inside the CTA instead of around the
      // cursor. Insert it above the button surface and below its label.
      shardBtn.container.addAt(progressFill, 1);
      let holding = false;
      let complete = false;
      let progress = 0;
      let holdTimer: Phaser.Time.TimerEvent | null = null;
      let progressTimer: Phaser.Time.TimerEvent | null = null;

      const drawProgress = (next: number): void => {
        if (!progressFill.active) return;
        progressFill.clear();
        if (next <= 0) return;
        // The label changes while holding, so remeasure instead of letting a
        // long gold/count string leave the fill behind the CTA's true edge.
        const bounds = shardBtn.getMeasuredBounds();
        const inset = SHARD_HOLD_BUTTON_PROGRESS.inset;
        const x = bounds.visual.x + inset;
        const y = bounds.visual.y + inset;
        const height = bounds.visual.height - inset * 2;
        const width = Math.max(0, (bounds.visual.width - inset * 2) * next);
        const radius = Math.min(SHARD_HOLD_BUTTON_PROGRESS.cornerRadius, width / 2, height / 2);
        progressFill.fillStyle(colorInt(theme.colors.gold), SHARD_HOLD_BUTTON_PROGRESS.fillAlpha);
        progressFill.fillRoundedRect(x, y, width, height, radius);
        progressFill.lineStyle(SHARD_HOLD_BUTTON_PROGRESS.ringWidth, colorInt(theme.colors.gold), 0.96);
        progressFill.strokeRoundedRect(
          bounds.visual.x + SHARD_HOLD_BUTTON_PROGRESS.ringWidth / 2,
          bounds.visual.y + SHARD_HOLD_BUTTON_PROGRESS.ringWidth / 2,
          bounds.visual.width - SHARD_HOLD_BUTTON_PROGRESS.ringWidth,
          bounds.visual.height - SHARD_HOLD_BUTTON_PROGRESS.ringWidth,
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
        shardBtn.setLabel(holdLabel);
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
        shardBtn.setLabel(`Hold to release (+${formatGold(gold)})`);
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
          shardBtn.setEnabled(false);

          // Keep the economy seam byte-for-byte identical and invoke it only
          // when the hold completes.
          const result = shardExcess(save, CARD_DB, d.id);
          this.binderStale = true;
          const checkpoint = checkpointAchievements(save, CARD_DB);
          this.flushSave();
          if (!this.fixture && checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
          startRitual();
          shardBtn.setLabel(`Released (+${formatGold(result.gold)})`);
          Sfx.play('shatter');
          this.playShardRitual(c, view, displayedVariant(), save.gold - result.gold, result.gold, () => {
            this.renderPage(); // refresh the ×N / ✦N badges beneath the overlay
            this.showInspect(d, result.clearedDisplayPin); // rebuild with the new counts and pin result
          });
        });
      };

      // The themed button's input is an unscaled child Zone. Pointer lifetime
      // owns the action rather than the button's ordinary tap callback.
      shardBtn.inputZone.on('pointerdown', beginHold);
      shardBtn.inputZone.on('pointerup', releaseEarly);
      shardBtn.inputZone.on('pointerupoutside', releaseEarly);
      shardBtn.inputZone.on('pointerout', releaseEarly);
    }
    return buttons;
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
    // Closed (Esc, or a rebuild) before a shard ritual finished: its binder
    // refresh was cancelled with it, so land the new ×N / ✦N badges here.
    if (this.binderStale) this.renderPage();
  }
}
