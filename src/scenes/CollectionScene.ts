import Phaser from 'phaser';
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
  pageSlice,
  specialVariantCount,
  variantLabel,
  type CollectionFilterState,
} from '../meta/collectionFilter';
import { Services } from '../meta/services';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { PLAIN_VARIANT, TIER_LABEL, variantKey, type CardVariant } from '../meta/variants';
import { finishOdds, formatOdds } from '../meta/pullOdds';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { FilterBar, TIER_TEXT_COLOR } from '../ui/binder/FilterBar';
import { makeCardThumb } from '../ui/CardThumbCache';
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
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';
import {
  SHARD_GOLD_COUNT_UP_MS,
  shardCountUpValue,
  shardDissolveDuration,
  shardHoldDuration,
  shardMoteCount,
} from '../ui/shardRitual';
import { colorInt, theme } from '../ui/theme';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { Toast } from '../ui/Toast';
import {
  backButton,
  goldBadge,
  modalShell,
  pager,
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

const ATELIER_CARD = {
  x: 450,
  y: 320,
  scale: 1.25,
  probabilityPlateY: 604,
} as const;

// ---------------------------------------------------------------------------
// Binder spread geometry (design px)
//
// Thumb scale 0.47 → card face 141.0 × 197.4. The baked thumb texture carries
// CardThumbCache's 8 card-px vertical bake bleed per side, so the Image is
// 141.0 × 204.92 (±102.46 about the pocket centre vs ±98.7 of the face).
//
// Open-binder spread: two pages of 3×2 pockets (12 cards/spread) around a
// spine at x=640. Pocket pitch 158×232. Column centres 227/385/543 and
// 737/895/1053; row centres 268/500.
//   row 0: image 165.5..370.5, face 169.3..366.7, badge strip centre 380.7
//   row 1: image 397.5..602.5, face 401.3..598.7, badge strip centre 612.7
// Everything (bleed included) tops out at ~621.7 — 98px above the 720 bound
// (the pre-rewrite grid cropped its bottom row 19px past 720).
// Above: chip row A centre y=84 (hit 59..109), row B centre y=136 (hit
// 111..161) — 4.5px clear of the top pockets' hit rects at 165.5, so chips
// and cards can never steal each other's taps.
// Below: page label at y=655, covered by nothing.
// Pager columns (hit 30..120 and 1160..1250) clear the outermost card faces
// (156.5 / 1123.5) on both sides.
// ---------------------------------------------------------------------------
const THUMB_CARD_SCALE = 0.47;
const FACE_W = 300 * THUMB_CARD_SCALE; // 141
const FACE_H = 420 * THUMB_CARD_SCALE; // 197.4

const COLS_PER_PAGE = 3;
const ROWS_PER_PAGE = 2;
const SPREAD_SIZE = COLS_PER_PAGE * ROWS_PER_PAGE * 2; // 12 pockets per spread
const LEFT_COLS = [227, 385, 543];
const RIGHT_COLS = [737, 895, 1053];
const ROW0_Y = 268;
const PITCH_Y = 232;
/** Badge strip centre, below the face and outside it (face half-height + 14). */
const LABEL_DY = FACE_H / 2 + 14;

/** Collection binder: paginated two-page spread with facet filters, sorting,
 * variant badges and a variant-showcase inspect overlay. */
export class CollectionScene extends Phaser.Scene {
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
  /** The DOM search <input> — hidden while the inspect overlay is open (DOM
   * elements always float above the canvas, so the dim can't cover it). */
  private searchInput: Phaser.GameObjects.DOMElement | null = null;
  private readonly onPreviousKey = (): void => this.onArrowKey(-1);
  private readonly onNextKey = (): void => this.onArrowKey(1);

  constructor() {
    super('Collection');
  }

  create(): void {
    this.state = { ...defaultFilterState(), ownedOnly: true };
    this.page = 0;
    this.sortSelection = DEFAULT_COLLECTION_SORT;
    this.cells = [];
    this.guardTargets = [];
    this.guard = new ModalGuard();
    new Toast(this, { modalGuard: this.guard });
    this.pageContainer = null;
    this.outgoing = [];
    this.turning = false;
    this.inspect = null;
    this.inspectDef = null;
    this.holoMove = null;
    this.inspectRitualCleanup = null;

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
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed

    // Header band (y 0..56, above chip row A's hit top at 59).
    this.add
      .text(DESIGN_W / 2, 30, 'Collection', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    // Crafting spends gold here, so keep the shared currency badge beside the
    // collection stats and refresh it with the binder view.
    this.goldBadge = goldBadge(this, DESIGN_W - 30, 30, { flashOnChange: true });
    this.counterText = this.add
      .text(DESIGN_W - 200, 30, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0.5);
    this.completionText = this.add
      .text(DESIGN_W - 200, 52, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0.5);
    const back = backButton(this, 'Menu', () => this.scene.start('MainMenu'));
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));

    this.drawBinderChrome();

    this.filterBar = new FilterBar(this, this.state, {
      y: 104,
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

    // Card search (F8): the DOM <input> feeds state.search through the same
    // reset-page + re-render path the filter chips use.
    this.searchInput = createSearchInput(this, 355, 30, {
      width: 250,
      placeholder: 'Search name / type / trait / mechanic…',
      onChange: (value) => {
        this.state.search = value;
        this.page = 0;
        this.renderPage();
      },
    });

    this.pageControl = pager(this, DESIGN_W / 2 - 56, 655, this.page, 1, (page) => {
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
  }

  /** Static open-binder art: two page slabs, spine, and the fixed pockets. */
  private drawBinderChrome(): void {
    const g = this.add.graphics();
    // page slabs
    g.fillStyle(theme.graphics.panelFill, theme.alpha.chrome);
    g.fillRoundedRect(140, 150, 490, 484, 12);
    g.fillRoundedRect(650, 150, 490, 484, 12);
    g.lineStyle(2, theme.graphics.panelStroke, 1);
    g.strokeRoundedRect(140, 150, 490, 484, 12);
    g.strokeRoundedRect(650, 150, 490, 484, 12);
    // spine / gutter
    g.fillStyle(theme.graphics.dim, theme.alpha.panel);
    g.fillRect(630, 154, 20, 476);
    // pockets — fixed; cards drop into them, badges sit on the lip below
    g.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    g.fillStyle(theme.graphics.rowFill, theme.alpha.subtle);
    for (const cx of [...LEFT_COLS, ...RIGHT_COLS]) {
      for (let row = 0; row < ROWS_PER_PAGE; row++) {
        const cy = ROW0_Y + row * PITCH_Y;
        const w = FACE_W + 8;
        const h = FACE_H + 8;
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
      }
    }
  }

  private currentPool(): CardDef[] {
    return sortCollectionCards(
      applyFilters(collectionDisplayPool(ALL_CARDS, Services.save.data), this.state, Services.save.data),
      this.sortSelection,
      Services.save.data,
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
    if (this.inspect || this.turning) return;
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
    const save = Services.save.data;
    const collectible = collectiblePool(ALL_CARDS);
    const pool = this.currentPool();
    this.page = clampPage(this.page, pool.length, SPREAD_SIZE);

    const ownedKinds = collectible.filter((d) => ownedCount(save, d.id) > 0).length;
    const completion = collectionCompletion(ALL_CARDS, save);
    this.goldBadge.refresh(save.gold);
    this.counterText.setText(`${ownedKinds}/${collectible.length} collected`);
    this.completionText.setText(
      `${Math.round(completion.percent * 100)}% pool  |  ${completion.variants.specialCards} special cards`,
    );
    this.pageControl.refresh(this.page, pageCount(pool.length, SPREAD_SIZE));
    this.emptyText.setVisible(pool.length === 0);

    const old = this.pageContainer;
    this.cells = [];
    const fresh = this.buildSpread(pool);
    this.pageContainer = fresh;

    if (dir === 0 || !old) {
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

  /** One spread: baked thumbs in the pockets + badges on the lip below each. */
  private buildSpread(pool: CardDef[]): Phaser.GameObjects.Container {
    const save = Services.save.data;
    const c = this.add.container(0, 0);
    const slice = pageSlice(pool, this.page, SPREAD_SIZE);
    const perPage = COLS_PER_PAGE * ROWS_PER_PAGE;

    slice.forEach((d, i) => {
      const cols = i < perPage ? LEFT_COLS : RIGHT_COLS;
      const within = i % perPage;
      const x = cols[within % COLS_PER_PAGE];
      const y = ROW0_Y + Math.floor(within / COLS_PER_PAGE) * PITCH_Y;
      const owned = ownedCount(save, d.id);

      // Cached-thumbnail Image (tier gem included) — cheap to churn per
      // spread; live CardViews stay exclusive to the inspect overlay. Owned
      // cards show their selected display variant (frame/full-art bake
      // statically; holo shimmer stays an inspect effect), so the binder reads
      // as YOUR binder rather than a plain checklist.
      const best = owned > 0 ? displayVariantFor(save, d.id) : null;
      const thumb = makeCardThumb(
        this,
        x,
        y,
        d,
        THUMB_CARD_SCALE,
        undefined,
        best && variantKey(best) !== variantKey(PLAIN_VARIANT) ? best : undefined,
      );
      if (owned === 0) thumb.setAlpha(0.32); // calibrated against the 0.70 dim
      thumb.setInteractive({ useHandCursor: true });
      bindTapButton(this, thumb, () => {
        if (!this.turning) this.showInspect(d);
      });
      c.add(thumb);
      this.cells.push(thumb);

      // Badge strip — strictly OUTSIDE the card face (face bottom +14).
      const ly = y + LABEL_DY;
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
      c.add(badge(x - FACE_W / 2 + 2, 0, TIER_LABEL[d.rarity], TIER_TEXT_COLOR[d.rarity]));
      if (owned > 0) {
        c.add(badge(x, 0.5, `×${owned}`, owned >= PLAYSET ? theme.colors.gold : theme.colors.heading));
      }
      const specials = specialVariantCount(save, d.id);
      if (specials > 0) {
        c.add(badge(x + FACE_W / 2 - 2, 1, `✦${specials}`, theme.rarity.ssr));
      }
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
    const save = Services.save.data;
    const owned = ownedCount(save, d.id);
    const shell = modalShell(this, {
      width: 1080,
      height: 660,
      dimAlpha: 0.82,
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
    dim.on('pointerup', () => {
      if (swallowHeldRelease) {
        swallowHeldRelease = false;
        return;
      }
      if (this.time.now - openedAt < INSPECT_CLOSE_LOCK_MS) return; // swallow double-click flash
      this.closeInspect();
    });
    const shown = owned > 0 ? displayVariantFor(save, d.id) : null;
    let displayedVariant: CardVariant | undefined = shown ?? undefined;
    let ritualInProgress = false;
    let comparisonVariant: CardVariant | undefined;
    let comparisonActive = false;
    let touchScrubbing = false;
    let pointerWasInside = false;
    const animationLevel = save.settings.animations;
    const touchProfile = isTouchDevice();

    // Full Art gallery light. It stays centered for reduced/off motion and
    // follows the same pointer pose as the card only under full motion.
    const galleryHalo = this.add
      .ellipse(ATELIER_CARD.x, ATELIER_CARD.y, 470, 560, colorInt(theme.colors.gold), 0.1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const galleryFloor = this.add
      .ellipse(ATELIER_CARD.x, 588, 350, 30, colorInt(theme.colors.gold), 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const galleryTitle = this.add
      .text(ATELIER_CARD.x, 38, 'FULL ART GALLERY LIGHT', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
      .setVisible(false);
    const view = new CardView(this, ATELIER_CARD.x, ATELIER_CARD.y);
    view.setScale(ATELIER_CARD.scale).setCard(
      d,
      shown ? { fx: 'full', variant: shown, fullArt: shown.fullArt } : { fx: 'full' },
    );
    const compareView = new CardView(this, ATELIER_CARD.x, ATELIER_CARD.y)
      .setScale(ATELIER_CARD.scale)
      .setVisible(false);
    const compareMaskSource = this.add
      .graphics()
      .setPosition(ATELIER_CARD.x, ATELIER_CARD.y)
      .setScale(ATELIER_CARD.scale)
      .setVisible(false);
    const compareMask = compareMaskSource.createGeometryMask();
    compareView.setMask(compareMask);
    const wipeOverlay = this.add
      .container(ATELIER_CARD.x, ATELIER_CARD.y)
      .setScale(ATELIER_CARD.scale)
      .setVisible(false);
    const wipeDivider = this.add.rectangle(0, 0, 2, CARD_H, 0xffffff, 0.92);
    const wipeHandle = this.add
      .circle(0, CARD_H / 2 - 14, 7, colorInt(theme.colors.panelFill), 0.96)
      .setStrokeStyle(2, colorInt(theme.colors.gold), 1);
    wipeOverlay.add([wipeDivider, wipeHandle]);

    const compareLeftLabel = this.add
      .text(ATELIER_CARD.x - CARD_W * ATELIER_CARD.scale / 2, 43, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    const compareRightLabel = this.add
      .text(ATELIER_CARD.x + CARD_W * ATELIER_CARD.scale / 2, 43, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(1, 0.5)
      .setVisible(false);
    const compareHint = this.add
      .text(
        ATELIER_CARD.x,
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

    const probabilityPlate = this.add.graphics();
    probabilityPlate
      .fillStyle(theme.graphics.panelFill, 0.94)
      .fillRoundedRect(
        ATELIER_CARD.x - 225,
        ATELIER_CARD.probabilityPlateY,
        450,
        70,
        theme.radius.panel,
      )
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(
        ATELIER_CARD.x - 225,
        ATELIER_CARD.probabilityPlateY,
        450,
        70,
        theme.radius.panel,
      );
    const probabilityTitle = this.add
      .text(ATELIER_CARD.x, ATELIER_CARD.probabilityPlateY + 9, 'EXACT BOOSTER-SLOT ODDS', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);
    const probabilityHeadline = this.add
      .text(ATELIER_CARD.x, ATELIER_CARD.probabilityPlateY + 25, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0.5, 0);
    const probabilityAxes = this.add
      .text(ATELIER_CARD.x, ATELIER_CARD.probabilityPlateY + 44, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: 434 },
      })
      .setOrigin(0.5, 0);

    c.add([
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
    addKeywordGlossaryPanel(this, c, d, { x: 58, y: 156, width: 170 });

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
      const x = ATELIER_CARD.x + pose.offsetX;
      const y = ATELIER_CARD.y + pose.offsetY;
      const scaleX = ATELIER_CARD.scale * pose.scaleX;
      const scaleY = ATELIER_CARD.scale * pose.scaleY;
      for (const target of [view, compareView, compareMaskSource, wipeOverlay]) {
        target.setPosition(x, y).setScale(scaleX, scaleY).setAngle(pose.angleDeg);
      }
      galleryHalo.setPosition(
        ATELIER_CARD.x + pose.lightOffsetX,
        ATELIER_CARD.y + pose.lightOffsetY,
      );
      galleryFloor.setX(ATELIER_CARD.x + pose.lightOffsetX * 0.35);
    };
    const settleAtelierPose = (): void => {
      tiltTween?.remove();
      tiltTween = null;
      galleryHalo.setPosition(ATELIER_CARD.x, ATELIER_CARD.y);
      galleryFloor.setX(ATELIER_CARD.x);
      if (animationLevel !== 'full') {
        applyAtelierPose(cardAtelierTiltPose({ x: 0, y: 0, inside: false }, animationLevel, false));
        return;
      }
      tiltTween = this.tweens.add({
        targets: [view, compareView, compareMaskSource, wipeOverlay],
        x: ATELIER_CARD.x,
        y: ATELIER_CARD.y,
        scaleX: ATELIER_CARD.scale,
        scaleY: ATELIER_CARD.scale,
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
      probabilityHeadline.setText(`${plate.oddsText} · ${plate.percentText} per booster slot`);
      probabilityAxes.setText(plate.axisText);
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

    // Variant panel, right of the card (card spans x 262.5..637.5 at rest).
    const panelX = 740;
    if (clearedDisplayPin) {
      c.add(
        this.add
          .text(panelX, 84, 'Pinned display cleared. Showing your rarest owned look.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.success,
            wordWrap: { width: 470 },
            lineSpacing: 3,
          })
          .setOrigin(0, 0.5),
      );
    }
    c.add(
      this.add
        .text(panelX, 130, owned > 0 ? 'Owned variants' : 'Not yet collected', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: owned > 0 ? theme.colors.heading : theme.colors.muted,
        })
        .setOrigin(0, 0.5),
    );
    if (owned > 0) {
      // Pull odds are the player-facing rarity of a finish. Keep the rarest
      // owned treatment first, independent of the internal display ranking.
      const entries = [...ownedVariantEntries(save, d.id)].sort(
        (a, b) =>
          finishOdds(a.variant.frame, a.variant.holo, a.variant.fullArt) -
            finishOdds(b.variant.frame, b.variant.holo, b.variant.fullArt) ||
          variantKey(a.variant).localeCompare(variantKey(b.variant)),
      );
      const VARIANT_ROWS = 7;
      const VARIANT_ROW_Y = 176;
      const VARIANT_ROW_PITCH = 48;
      const variantPageCount = Math.max(1, Math.ceil(entries.length / VARIANT_ROWS));
      let selectedKey = variantKey(shown!);
      let pinnedKey: string | null = save.pinnedVariants[d.id] ?? null;
      let rows: {
        background: Phaser.GameObjects.Graphics;
        text: Phaser.GameObjects.Text;
        odds: Phaser.GameObjects.Text;
        pin: ThemedButton;
        variant: CardVariant;
        count: number;
      }[] = [];
      const restyle = (): void => {
        for (const r of rows) {
          const sel = variantKey(r.variant) === selectedKey;
          r.background
            .clear()
            .fillStyle(sel ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
            .fillRoundedRect(panelX - 14, r.text.y - 20, 370, 40, theme.radius.control)
            .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
            .strokeRoundedRect(panelX - 14, r.text.y - 20, 370, 40, theme.radius.control);
          r.text.setText(`${sel ? '▸ ' : '   '}${variantLabel(r.variant)}  ×${r.count}`);
          r.text.setColor(sel ? theme.colors.gold : theme.colors.body);
          r.pin.setVariant(pinnedKey === variantKey(r.variant) ? 'primary' : 'ghost');
          // setText/setColor reset the hit bounds — re-inflate, biased right
          // so the rect never reaches back over the card.
          inflateHitArea(r.text, 300, 44, {
            biasX: Math.max(0, (300 - r.text.width) / 2),
          });
        }
      };
      let variantPageControl: Pager | null = null;
      const renderVariantPage = (page: number): void => {
        for (const row of rows) {
          if (row.background.active) row.background.destroy();
          if (row.text.active) row.text.destroy();
          if (row.odds.active) row.odds.destroy();
        }
        rows = [];
        const start = page * VARIANT_ROWS;
        entries.slice(start, start + VARIANT_ROWS).forEach((e, i) => {
          const background = this.add.graphics();
          const t = this.add
            .text(panelX, VARIANT_ROW_Y + i * VARIANT_ROW_PITCH, '', {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.label}px`,
              fontStyle: theme.weight.w600,
              color: theme.colors.body,
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
          const odds = this.add
            .text(panelX + 360, VARIANT_ROW_Y + i * VARIANT_ROW_PITCH, formatOdds(
              finishOdds(e.variant.frame, e.variant.holo, e.variant.fullArt),
            ), {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.caption}px`,
              color: theme.colors.muted,
            })
            .setOrigin(0, 0.5)
            .setVisible(false);
          bindTapButton(this, t, () => {
            if (ritualInProgress) return;
            selectedKey = variantKey(e.variant);
            presentVariant(e.variant);
            restyle();
          });
          t.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch) odds.setVisible(true);
          });
          t.on('pointerout', () => odds.setVisible(false));
          const pin = themedButton(this, panelX + 320, VARIANT_ROW_Y + i * VARIANT_ROW_PITCH, '📌', {
            variant: pinnedKey === variantKey(e.variant) ? 'primary' : 'ghost',
            size: 'sm',
            minWidth: 36,
            onTap: () => {
              if (ritualInProgress) return;
              const key = variantKey(e.variant);
              let nextVariant: CardVariant;
              if (pinnedKey === key) {
                delete save.pinnedVariants[d.id];
                pinnedKey = null;
                nextVariant = displayVariantFor(save, d.id);
              } else {
                save.pinnedVariants[d.id] = key;
                pinnedKey = key;
                nextVariant = e.variant;
              }
              selectedKey = variantKey(nextVariant);
              presentVariant(nextVariant);
              Services.save.flush();
              Sfx.play('shimmer');
              restyle();
            },
          });
          rows.push({ background, text: t, odds, pin, variant: e.variant, count: e.count });
          c.add([background, t, odds, pin.container]);
        });
        variantPageControl?.refresh(page, variantPageCount);
        restyle();
      };
      variantPageControl = pager(this, panelX + 118, 522, 0, variantPageCount, renderVariantPage);
      c.add(variantPageControl.container);
      renderVariantPage(0);
    }

    // Card actions: owned cards can choose a fallback hero portrait or shard;
    // missing collectibles can be crafted.
    this.addInspectActions(
      c,
      d,
      view,
      () => displayedVariant,
      () => ritualInProgress,
      suspendAtelierForRitual,
    );

    c.add(
      this.add
        .text(
          DESIGN_W / 2,
          DESIGN_H - 32,
          isTouchDevice() ? 'Tap anywhere to close' : 'Click anywhere to close',
          { fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.muted },
        )
        .setOrigin(0.5),
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
    variant: 'primary' | 'emphasis' = 'emphasis',
    onTap: () => void,
  ): ThemedButton {
    const t = themedButton(this, x + 150, y, label, { variant, minWidth: 300, onTap });
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
  ): void {
    const panelX = 740;
    // Action chips inflate to a 52px-tall tap area, so their row centres must
    // be ≥ 52px apart or the later-added chip steals the seam. Hero or Craft
    // uses 620; Shard uses 684 (64px pitch), clear of variant rows above.
    const save = Services.save.data;
    if (ownedCount(save, d.id) > 0) {
      const heroLabel = (): string =>
        save.heroCardId === d.id ? '★ Default hero (tap to clear)' : '☆ Set default hero';
      const heroBtn = this.overlayChip(
        c,
        panelX,
        584,
        heroLabel(),
        save.heroCardId === d.id ? 'primary' : 'emphasis',
        () => {
          if (isRitualInProgress()) return;
          save.heroCardId = save.heroCardId === d.id ? null : d.id;
          Services.save.flush();
          Sfx.play('shimmer');
          heroBtn.setLabel(heroLabel());
          heroBtn.setVariant(save.heroCardId === d.id ? 'primary' : 'emphasis');
        },
      );
    }

    const owned = ownedCount(save, d.id);
    if (owned === 0 && !d.token && !d.supertypes?.includes('basic')) {
      const cost = craftCost(CARD_DB, d.id);
      const costLabel = `-${cost.toLocaleString('en-US')}g`;
      let armed = false;
      const label = (): string => (armed ? `Craft: confirm (${costLabel})` : `Craft (${costLabel})`);
      const craftBtn = this.overlayChip(c, panelX, 584, label(), 'emphasis', () => {
        if (isRitualInProgress()) return;
        // Shared destructive-confirm policy (matches the Shard chip): two-tap
        // unless the player opted out in Settings.
        if (save.settings.confirmDestructive && !armed) {
          armed = true;
          craftBtn.setLabel(label());
          craftBtn.setVariant('primary');
          return;
        }
        const result = craftCard(save, CARD_DB, d.id);
        if (!result.ok) return;
        const checkpoint = checkpointAchievements(save, CARD_DB);
        Services.save.flush();
        if (checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
        Sfx.play('coin');
        this.renderPage(); // refresh counts, thumb alpha, and the gold badge
        this.showInspect(d); // keep the inspect overlay open on the new copy
      });
      // Shop convention: keep an unaffordable action visible with its price,
      // but make its input inert until the balance can cover the cost.
      craftBtn.setEnabled(save.gold >= cost);
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
        648,
        `⛏ Hold to shard ×${excess} extra (+${gold}🪙)`,
        'emphasis',
        () => undefined,
      );

      const holdLabel = `⛏ Hold to shard ×${excess} extra (+${gold}🪙)`;
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
        shardBtn.setLabel(`Hold to release (+${gold}🪙)`);
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
          const checkpoint = checkpointAchievements(save, CARD_DB);
          Services.save.flush();
          if (checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
          startRitual();
          shardBtn.setLabel(`Released (+${result.gold}🪙)`);
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
    const badge = this.goldBadge.text;
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
        if (!finished) this.goldBadge.refresh(Services.save.data.gold);
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
            x: badge.x,
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
  }
}
