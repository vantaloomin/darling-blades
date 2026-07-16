import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import {
  bestOwnedVariant,
  craftCard,
  craftCost,
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
import { TIER_LABEL, variantKey, type CardVariant } from '../meta/variants';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { FilterBar, TIER_TEXT_COLOR } from '../ui/binder/FilterBar';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CardView } from '../ui/CardView';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput } from '../ui/SearchInput';
import { colorInt, theme } from '../ui/theme';
import {
  backButton,
  goldBadge,
  modalShell,
  pager,
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
  /** The DOM search <input> — hidden while the inspect overlay is open (DOM
   * elements always float above the canvas, so the dim can't cover it). */
  private searchInput: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super('Collection');
  }

  create(): void {
    this.state = { ...defaultFilterState(), ownedOnly: true };
    this.page = 0;
    this.cells = [];
    this.guardTargets = [];
    this.guard = new ModalGuard();
    this.pageContainer = null;
    this.outgoing = [];
    this.turning = false;
    this.inspect = null;
    this.inspectDef = null;
    this.holoMove = null;

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
    const back = backButton(this, () => this.scene.start('MainMenu'));

    this.drawBinderChrome();

    this.filterBar = new FilterBar(this, this.state, {
      y: 104,
      onChange: () => {
        this.page = 0;
        this.renderPage();
      },
    });

    // Card search (F8): the DOM <input> feeds state.search through the same
    // reset-page + re-render path the filter chips use.
    this.searchInput = createSearchInput(this, 355, 30, {
      width: 250,
      placeholder: 'Search name / type / keyword…',
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
    this.input.keyboard?.on('keydown-LEFT', () => this.onArrowKey(-1), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.onArrowKey(1), this);

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
    return applyFilters(collectiblePool(ALL_CARDS), this.state, Services.save.data);
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
    const pool = applyFilters(collectible, this.state, save);
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

      // Cached-thumbnail Image (plain bake, tier gem included) — cheap to
      // churn per spread; live CardViews stay exclusive to the inspect overlay.
      const thumb = makeCardThumb(this, x, y, d, THUMB_CARD_SCALE);
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
   * the best owned variant, plus a tappable list of every owned variant.
   * Unowned cards render the plain look.
   */
  private showInspect(d: CardDef): void {
    this.closeInspect();
    this.filterBar.closeAll(); // a floating dropdown must not sit over the overlay
    this.searchInput?.setVisible(false); // DOM input always floats above the canvas dim
    const save = Services.save.data;
    const owned = ownedCount(save, d.id);
    const shell = modalShell(this, {
      width: 1080,
      height: 660,
      dimAlpha: 0.82,
      escToClose: false,
      depth: theme.depth.overlay,
      showClose: false,
      tapDimToClose: false,
    });
    const c = shell.container;
    const dim = shell.dim;
    const openedAt = this.time.now;
    dim.on('pointerup', () => {
      if (this.time.now - openedAt < INSPECT_CLOSE_LOCK_MS) return; // swallow double-click flash
      this.closeInspect();
    });
    const shown = owned > 0 ? bestOwnedVariant(save, d.id) : null;
    const view = new CardView(this, 450, 360);
    view.setScale(1.35).setCard(d, shown ? { fx: 'full', variant: shown } : { fx: 'full' });
    c.add(view);
    addKeywordGlossaryPanel(this, c, d, { x: 58, y: 156, width: 170 });

    // Holo pointer feed — stored so closeInspect can unhook it (the
    // pre-rewrite scene leaked one of these per inspect).
    this.holoMove = (p: Phaser.Input.Pointer) => {
      if (view.active) view.setHoloPointer(p.worldX, p.worldY);
    };
    this.input.on('pointermove', this.holoMove);

    // Variant panel, right of the card (card spans x 247.5..652.5).
    const panelX = 740;
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
      const entries = ownedVariantEntries(save, d.id);
      const MAX_ROWS = 9;
      let selectedKey = variantKey(shown!);
      const rows: { background: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; variant: CardVariant; count: number }[] = [];
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
          // setText/setColor reset the hit bounds — re-inflate, biased right
          // so the rect never reaches back over the card.
          inflateHitArea(r.text, 380, 44, {
            biasX: Math.max(0, (380 - r.text.width) / 2),
          });
        }
      };
      entries.slice(0, MAX_ROWS).forEach((e, i) => {
        const background = this.add.graphics();
        const t = this.add
          .text(panelX, 176 + i * 48, '', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w600,
            color: theme.colors.body,
          })
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, t, () => {
          selectedKey = variantKey(e.variant);
          view.setCard(d, { fx: 'full', variant: e.variant });
          restyle();
        });
        rows.push({ background, text: t, variant: e.variant, count: e.count });
        c.add([background, t]);
      });
      if (entries.length > MAX_ROWS) {
        c.add(
          this.add
            .text(panelX, 176 + MAX_ROWS * 48, `+${entries.length - MAX_ROWS} more…`, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.caption}px`,
              color: theme.colors.muted,
            })
            .setOrigin(0, 0.5),
        );
      }
      restyle();
    }

    // Card actions: owned cards can choose a fallback hero portrait or shard;
    // missing collectibles can be crafted.
    this.addInspectActions(c, d);

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
  private addInspectActions(c: Phaser.GameObjects.Container, d: CardDef): void {
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
        620,
        heroLabel(),
        save.heroCardId === d.id ? 'primary' : 'emphasis',
        () => {
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
      const craftBtn = this.overlayChip(c, panelX, 620, label(), 'emphasis', () => {
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
        Services.save.flush();
        Sfx.play('coin');
        this.renderPage(); // refresh counts, thumb alpha, and the gold badge
        this.showInspect(d); // keep the inspect overlay open on the new copy
      });
      // Shop convention: keep an unaffordable action visible with its price,
      // but make its input inert until the balance can cover the cost.
      craftBtn.setEnabled(save.gold >= cost);
    }

    // Shard/sell: convert copies past the per-variant playset (4 of each
    // frame|holo) to gold. Two-tap confirm (destructive); rebuilds the overlay
    // + page badges afterward. Absent when nothing is over the cap.
    const excess = shardableCount(save, d.id);
    if (excess > 0) {
      const gold = shardGold(save, CARD_DB, d.id);
      let armed = false;
      const label = (): string =>
        armed ? `Shard ×${excess}: confirm (+${gold}🪙)` : `⛏ Shard ×${excess} extra (+${gold}🪙)`;
      const shardBtn = this.overlayChip(c, panelX, 684, label(), 'emphasis', () => {
        // Shared destructive-confirm policy: two-tap unless the player opted out.
        if (save.settings.confirmDestructive && !armed) {
          armed = true;
          shardBtn.setLabel(label());
          shardBtn.setVariant('primary');
          return;
        }
        shardExcess(save, CARD_DB, d.id);
        Services.save.flush();
        Sfx.play('coin');
        this.renderPage(); // refresh the ×N / ✦N badges beneath the overlay
        this.showInspect(d); // rebuild the overlay with the new counts
      });
    }
  }

  private closeInspect(): void {
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
