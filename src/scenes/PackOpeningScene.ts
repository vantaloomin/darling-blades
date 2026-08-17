import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { createRngState } from '../engine/rng';
import { def } from '../engine/types';
import type { AddResult } from '../meta/Collection';
import { spendGold } from '../meta/Economy';
import { openPack, openPacks, type PackResult } from '../meta/PackOpener';
import { formatOdds, variantOdds } from '../meta/pullOdds';
import { Services } from '../meta/services';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { isPlainVariant, TIER_LABEL, TIER_RANK, type CardVariant } from '../meta/variants';
import { animTimeScale } from '../platform/animPolicy';
import { activeRenderScale } from '../platform/renderScale';
import { CARD_H, CARD_W, CardView, type CardFxLevel } from '../ui/CardView';
import { fxPolicy } from '../ui/fx/FXSupport';
import { dragMoved } from '../ui/mulliganRitualPresentation';
import {
  cardDwellMs,
  cardRailX,
  flipPitchJitter,
  gateProgress,
  indexAtGate,
  inertiaStep,
  minimapSegments,
  railOffsetForIndex,
  runwayOrder,
  RUNWAY_CARD_HALF_HEIGHT,
  RUNWAY_CARD_SCALE,
  RUNWAY_CARD_Y,
  RUNWAY_FLIP_SFX_MIN_GAP_MS,
  RUNWAY_GATE_X,
  RUNWAY_MINIMAP,
  RUNWAY_PITCH,
  RUNWAY_RESUME_DELAY_MS,
  RUNWAY_SKIP,
  virtualRange,
} from '../ui/packRunwayPresentation';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { bindInspectHotkeys } from '../ui/inspectHotkeys';
import { colorInt, theme } from '../ui/theme';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { Toast } from '../ui/Toast';
import { backButton, modalShell, panel, registerSceneBackNavigation, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { ARTHURIAN_COURT_PACK_ART, bakePackArt, CELTIC_FAE_PACK_ART, DARK_TALES_PACK_ART, GOTHIC_MONSTERS_PACK_ART, YOKAI_NIGHTS_PACK_ART, packPriceForSku, packSetForSku, packTextureForSku, type BoosterSku } from './ShopScene';

const GRID_Y0 = 184;
const GRID_DY = 216;
const SPECIAL_Y = 526;
const SPECIAL_SCALE = 0.54;
const BUTTON_Y = 674;

/** Face-down hint pulse + tier-tag colors for the specials row (sr/ssr/ur). */
const HINT = {
  sr: { glow: 16763955, pulse: 520, label: theme.rarity.sr },
  ssr: { glow: 11691775, pulse: 420, label: theme.rarity.ssr },
  ur: { glow: 16733542, pulse: 320, label: theme.rarity.ur },
} as const;

/**
 * Reveal-escalation intensities, keyed by the tier of the BEST card in the
 * pack: sr keeps the classic gold slow-mo spotlight, ssr goes violet and
 * bigger, ur goes crimson/prismatic and biggest. Glows/tints/timing only —
 * each card additionally renders its rolled frame/holo variant on flip.
 */
const ESCALATION: Record<
  'sr' | 'ssr' | 'ur',
  { flash: [number, number, number]; particles: number; zoom: number; dimAlpha: number; tint: number }
> = {
  sr: { flash: [255, 240, 200], particles: 60, zoom: 1.13, dimAlpha: 0.7, tint: 16777215 },
  ssr: { flash: [225, 175, 255], particles: 85, zoom: 1.16, dimAlpha: 0.75, tint: 14262527 },
  ur: { flash: [255, 145, 145], particles: 115, zoom: 1.2, dimAlpha: 0.8, tint: 16743018 },
};

let contextMenuDisabled = false;

interface SpecialEntry {
  view: CardView;
  card: AddResult;
  done: boolean;
  /** the card's dealt-in slot x — restored after the best-card spotlight so it
   * returns to its row position instead of staying centered (would overlap). */
  homeX: number;
  /** lite-tier rarity hint (ring-sprite pulse) — destroyed on reveal */
  hint?: Phaser.GameObjects.Image;
}

/**
 * The reveal: tear → the pack's c/r cards cascade-flip into a grid → the
 * sr/ssr/ur cards wait face-down with tier-hint glows → tap-to-flip, with a
 * slow-mo spotlight escalation for the best card in the pack (intensity and
 * color scale with its tier). Groups are data-driven off PackResult (already
 * sorted worst→best), so any tier mix — 0 specials through 15 — plays out.
 * Skip resolves everything fast.
 */
export class PackOpeningScene extends Phaser.Scene {
  private result!: PackResult;
  /** Revealed, inspectable pulls in reveal order - the arrow-key ring. */
  private inspectables: { card: AddResult; view: CardView }[] = [];
  private inspectShell: import('../ui/themeWidgets').ModalShell | null = null;
  private unbindInspectKeys: (() => void) | null = null;
  private sku: BoosterSku = 'base';
  private revealed = 0;
  private specials: SpecialEntry[] = [];
  private buttons: ThemedButton[] = [];
  private skipBtn: ThemedButton | null = null;
  private toasts: Toast | null = null;
  private packRevealComplete = false;
  /** Pack Runway (batch opens): one masked rail through a fixed reveal gate. */
  private runway: {
    batch: PackResult[];
    cards: AddResult[];
    root: Phaser.GameObjects.Container;
    offset: number;
    minOffset: number;
    maxOffset: number;
    velocity: number;
    revealedMax: number;
    mode: 'auto' | 'scrub' | 'inertia' | 'idle' | 'stopped' | 'done';
    views: Map<number, CardView>;
    lastFlipSfxAt: number;
    idleSince: number | null;
    resumeChip: ThemedButton | null;
    needle: Phaser.GameObjects.Rectangle;
    tint: Phaser.GameObjects.Rectangle;
    tintColor: string;
    minimap: { x: number; w: number };
    autoTween: Phaser.Tweens.Tween | null;
    drag: { startX: number; startOffset: number; lastX: number; lastAt: number; velocity: number; moved: boolean } | null;
    spotlight: { dim: Phaser.GameObjects.Rectangle; hint: Phaser.GameObjects.Text; finale: boolean } | null;
    finaleStarted: boolean;
    finishScheduled: boolean;
  } | null = null;
  /** guards the best-card spotlight settle so tap-to-skip and the wobble's own
   * onComplete can't both run the restore (one-shot per pack). */
  private bestSettled = false;

  constructor() {
    super('PackOpening');
  }

  create(
    data: (PackResult & { sku?: BoosterSku }) | { batch: PackResult[]; sku?: BoosterSku },
  ): void {
    // A repeat opener can re-enter this scene without a fresh Scene instance.
    // Close any inspect lease and clear every create-owned reference before
    // rebuilding the reveal so destroyed objects never receive new updates.
    this.closePackInspect();
    this.sku = data.sku ?? 'base';
    this.revealed = 0;
    this.specials = [];
    this.buttons = [];
    this.inspectables = [];
    this.skipBtn = null;
    this.bestSettled = false;
    this.packRevealComplete = false;
    // A restart already destroyed the display objects; only the state survives.
    this.runway = null;
    bakePackArt(this);
    if (this.sku === 'ragnarok') {
      bakePackArt(this, {
        key: 'packart-ragnarok',
        sceneArtKey: 'scene-pack-art-ragnarok',
      });
    } else if (this.sku === 'celtic-fae') {
      bakePackArt(this, CELTIC_FAE_PACK_ART);
    } else if (this.sku === 'arthurian-court') {
      bakePackArt(this, ARTHURIAN_COURT_PACK_ART);
    } else if (this.sku === 'gothic-monsters') {
      bakePackArt(this, GOTHIC_MONSTERS_PACK_ART);
    } else if (this.sku === 'dark-tales') {
      bakePackArt(this, DARK_TALES_PACK_ART);
    } else if (this.sku === 'yokai-nights') {
      bakePackArt(this, YOKAI_NIGHTS_PACK_ART);
    }
    this.input.on('gameobjectup', () => Sfx.play('click'));
    if (!contextMenuDisabled) {
      this.input.mouse?.disableContextMenu();
      contextMenuDisabled = true;
    }
    Music.setMood('shop'); // continuous with the shop — no-op when arriving from it

    this.toasts = new Toast(this, { held: true, isBlocked: () => this.inspectShell !== null });

    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback. The
    // rare-reveal spotlight (a full-frame 0.7-black rect at depth 40) still
    // dims this whole layer unchanged.
    applyBackdrop(this, 'packopening', {
      dim: theme.graphics.dim,
      dimAlpha: 0.5,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(theme.graphics.panelFill, theme.graphics.panelFill, theme.graphics.dim, theme.graphics.dim, 1);
        bg.fillRect(0, 0, width, height);
      },
    });
    const back = backButton(this, 'Shop', () => this.scene.start('Shop'));
    // Keep the persistent escape hatch above the reveal spotlight's dim layer.
    back.setDepth(theme.depth.reveal);
    registerSceneBackNavigation(this, () => this.scene.start('Shop'));

    // A multi-pack buy rides the Pack Runway: every pull on one rail through
    // the reveal gate. Animations off keeps the at-a-glance summary.
    if ('batch' in data) {
      if (Services.save.data.settings.animations === 'off') {
        this.showBatchSummary(data.batch);
        this.finishAchievementCheckpoint();
      } else {
        this.showPackRunway(data.batch);
      }
      return;
    }
    this.result = data;

    // Beat 1: the pack floats, waiting for the tear.
    const pack = this.add
      .image(width / 2, height / 2 - 20, packTextureForSku(this.sku))
      .setDisplaySize(238, 340)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: pack,
      y: pack.y - 12,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    if (fxPolicy(this).shine && pack.preFX) pack.preFX.addShine(0.6, 0.4, 4);
    const prompt = this.add
      .text(width / 2, height / 2 + 210, 'Tap to tear it open', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.body,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });

    pack.once('pointerup', () => {
      prompt.destroy();
      this.tear(pack);
    });
  }

  /** F10 batch reveal: an at-a-glance summary of a multi-pack open. */
  private showBatchSummary(batch: PackResult[]): void {
    const width = 1280;
    const all = batch.flatMap((p) => p.cards);
    const specials = all.filter((c) => c.tier !== 'c' && c.tier !== 'r');
    const newCards = all.filter((c) => c.isNew).length;
    const dupeGold = all.reduce((sum, c) => sum + c.dupeGold, 0);

    this.add
      .text(width / 2, 70, `Opened ${batch.length} packs`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        116,
        `${all.length} cards · ${newCards} new · ${specials.length} Super Rare+` +
          (dupeGold > 0 ? ` · +🪙 ${dupeGold} from duplicates` : ''),
        { fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body },
      )
      .setOrigin(0.5);

    // Best pulls: the specials, best-first, up to two rows of eight.
    const notable = [...specials].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]).slice(0, 16);
    if (notable.length === 0) {
      this.add
        .text(width / 2, 360, 'No rare pulls this time: all commons and uncommons.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    } else {
      const cols = Math.min(8, notable.length);
      const dx = 150;
      const policy = fxPolicy(this);
      let animatedHoloCount = 0;
      const maxAnimatedHoloCards = 8;
      notable.forEach((c, i) => {
        const row = Math.floor(i / cols);
        const col = i - row * cols;
        const rowLen = Math.min(cols, notable.length - row * cols);
        const x = width / 2 - ((rowLen - 1) * dx) / 2 + col * dx;
        const y = 300 + row * 210;
        const variant: CardVariant = { frame: c.frame, holo: c.holo, fullArt: c.fullArt };
        const animateHolo =
          variant.holo !== 'none' && policy.particleScale >= 1 && animatedHoloCount < maxAnimatedHoloCards;
        if (animateHolo) animatedHoloCount++;
        const view = new CardView(this, x, y).setScale(0.42).setCard(def(CARD_DB, c.cardId), {
          // A batch can contain many special pulls. Keep the first eight holo
          // treatments animated on the full tier; reduced/off policy gets a
          // static summary so the reveal never exceeds the FX budget.
          fx: animateHolo ? 'full' : variant.holo !== 'none' ? 'static' : 'none',
          variant: isPlainVariant(variant) ? undefined : variant,
          fullArt: variant.fullArt,
        });
        this.enablePackInspect(view, c);
      });
    }

    this.buildBatchButtons(batch.length);
  }

  /**
   * Batch-summary CTA rail (mirrors the single-pack rail): re-buy at the
   * same quantity when affordable, else step down to the largest affordable
   * bulk size (10 -> 5 -> 1), plus Shop / Menu.
   */
  private buildBatchButtons(openedQty: number): void {
    const width = 1280;
    const price = packPriceForSku(this.sku);
    const gold = Services.save.data.gold;
    const steps = [10, 5, 1].filter((n) => n <= openedQty);
    const qty = steps.find((n) => gold >= n * price) ?? 1;
    const label = qty === 1 ? `Open Another (🪙 ${price})` : `Open ×${qty} More (🪙 ${qty * price})`;

    panel(this, width / 2 - 360, BUTTON_Y - 32, 720, 72, { alpha: 0.76 }).setDepth(66);
    const mk = (x: number, text: string, cb: () => void): void => {
      const btn = themedButton(this, x, BUTTON_Y, text, {
        variant: 'primary',
        minWidth: 130,
        onTap: cb,
      });
      btn.container.setDepth(70);
      this.buttons.push(btn);
    };
    mk(width / 2 - 200, label, () => {
      const save = Services.save.data;
      if (!spendGold(save, qty * price)) return;
      Sfx.play('coin');
      const set = packSetForSku(this.sku);
      const rng = createRngState(Date.now() & 0x7fffffff);
      if (qty === 1) {
        const result = openPack(save, CARD_DB, rng, set);
        Services.save.flush();
        this.scene.restart({ ...result, sku: this.sku });
      } else {
        const packs = openPacks(save, CARD_DB, rng, qty, set);
        Services.save.flush();
        this.scene.restart({ batch: packs, sku: this.sku });
      }
    });
    mk(width / 2 + 60, 'Shop', () => this.scene.start('Shop'));
    mk(width / 2 + 200, 'Menu', () => this.scene.start('MainMenu'));
  }

  /**
   * Pack Runway: the batch's every pull on ONE rail in ascending rarity,
   * moving right-to-left through the fixed reveal gate. Auto-advance runs a
   * per-tier cadence (commons accelerando, ritardando into the specials, UR
   * full stop + spotlight); dragging scrubs with capped inertia and a Resume
   * Reveal chip after idle; a card flips exactly when it crosses the gate.
   */
  private showPackRunway(batch: PackResult[]): void {
    const width = 1280;
    const cards = runwayOrder(batch.flatMap((p) => p.cards));
    const root = this.add.container(0, 0);
    // Boundary lighting: a low wash retinted as the gate crosses tier runs.
    const tint = this.add.rectangle(width / 2, 360, width, 720, colorInt(theme.rarity.c), 0.08);
    root.add(tint);
    root.add(
      this.add
        .text(width / 2, 60, `Opened ${batch.length} packs`, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    root.add(
      this.add
        .text(width / 2, 102, 'Drag to scrub · tap a revealed card to inspect', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
    // Gate notches: where cards turn over.
    const gate = this.add.graphics();
    gate.lineStyle(2, colorInt(theme.colors.gold), 0.55);
    gate.lineBetween(
      RUNWAY_GATE_X,
      RUNWAY_CARD_Y - RUNWAY_CARD_HALF_HEIGHT - 26,
      RUNWAY_GATE_X,
      RUNWAY_CARD_Y - RUNWAY_CARD_HALF_HEIGHT,
    );
    gate.lineBetween(
      RUNWAY_GATE_X,
      RUNWAY_CARD_Y + RUNWAY_CARD_HALF_HEIGHT,
      RUNWAY_GATE_X,
      RUNWAY_CARD_Y + RUNWAY_CARD_HALF_HEIGHT + 26,
    );
    root.add(gate);
    // Tier-colored ribbon minimap with a progress needle — the no-scrollbar rule.
    const minimap = { x: RUNWAY_MINIMAP.x, w: RUNWAY_MINIMAP.width };
    const mmY = RUNWAY_MINIMAP.y;
    const mm = this.add.graphics();
    for (const seg of minimapSegments(cards)) {
      mm.fillStyle(colorInt(theme.rarity[seg.tier]), 0.85);
      mm.fillRect(minimap.x + seg.from * minimap.w, mmY, Math.max(1, (seg.to - seg.from) * minimap.w), 8);
    }
    root.add(mm);
    const needle = this.add.rectangle(minimap.x, mmY + 4, 3, 18, 0xffffff, 0.95);
    root.add(needle);
    // Scrub band beneath the cards: dragging anywhere on the rail moves it.
    const band = this.add.zone(width / 2, RUNWAY_CARD_Y, width, 420).setInteractive();
    root.add(band);
    // Edge vignettes above the cards instead of a scrollbar.
    const vignettes = this.add.graphics().setDepth(5);
    vignettes.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0, 0.75, 0);
    vignettes.fillRect(0, RUNWAY_CARD_Y - 210, 130, 420);
    vignettes.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.75, 0, 0.75);
    vignettes.fillRect(width - 130, RUNWAY_CARD_Y - 210, 130, 420);
    root.add(vignettes);

    const startOffset = railOffsetForIndex(0) + 2 * RUNWAY_PITCH;
    this.runway = {
      batch,
      cards,
      root,
      offset: startOffset,
      minOffset: railOffsetForIndex(Math.max(0, cards.length - 1)),
      maxOffset: startOffset,
      velocity: 0,
      revealedMax: -1,
      mode: 'auto',
      views: new Map(),
      lastFlipSfxAt: -Infinity,
      idleSince: null,
      resumeChip: null,
      needle,
      tint,
      tintColor: theme.rarity.c,
      minimap,
      autoTween: null,
      drag: null,
      spotlight: null,
      finaleStarted: false,
      finishScheduled: false,
    };
    band.on('pointerdown', (p: Phaser.Input.Pointer) => this.runwayScrubStart(p));
    const onMove = (p: Phaser.Input.Pointer): void => this.runwayScrubMove(p);
    const onUp = (): void => this.runwayScrubEnd();
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    root.once('destroy', () => {
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', onUp);
    });
    this.skipBtn = themedButton(this, RUNWAY_SKIP.x, RUNWAY_SKIP.y, 'Skip ≫', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 100,
      onTap: () => this.runwaySkip(),
    });
    this.runwayApplyOffset(startOffset);
    this.runwayAdvance();
  }

  /** One shared sink for every offset change: clamp, virtualize, place, reveal. */
  private runwayApplyOffset(offset: number): void {
    const rw = this.runway;
    if (!rw) return;
    rw.offset = Math.max(rw.minOffset, Math.min(rw.maxOffset, offset));
    const range = virtualRange(rw.offset, rw.cards.length);
    for (const [i, view] of [...rw.views]) {
      if (i < range.first || i > range.last) {
        view.destroy();
        rw.views.delete(i);
      }
    }
    for (let i = range.first; i <= range.last; i++) {
      let view = rw.views.get(i);
      if (!view) {
        view = this.buildRunwayCard(i);
        rw.views.set(i, view);
      }
      view.x = cardRailX(i, rw.offset);
    }
    const gateIdx = indexAtGate(rw.offset, rw.cards.length);
    if (gateIdx > rw.revealedMax) this.runwayRevealTo(gateIdx);
    rw.needle.x = rw.minimap.x + gateProgress(rw.revealedMax, rw.cards.length) * rw.minimap.w;
  }

  /** A rail card. Face-down until its index crosses the gate; input arms the scrub. */
  private buildRunwayCard(index: number): CardView {
    const rw = this.runway!;
    const card = rw.cards[index];
    const view = new CardView(this, cardRailX(index, rw.offset), RUNWAY_CARD_Y);
    view.setScale(RUNWAY_CARD_SCALE);
    rw.root.add(view);
    if (index <= rw.revealedMax) this.runwayShowFace(view, card, index, true);
    else {
      view.setCard(null); // face down
      view.setData('packInspectBlocked', true);
    }
    view.enableInput();
    view.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 2) return;
      this.runwayScrubStart(p);
    });
    view.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.button === 2) return;
      if (this.runway?.drag?.moved) return; // a finished scrub is not a tap
      if (view.getData('packInspectBlocked')) return;
      this.showPackInspect(card);
    });
    return view;
  }

  /** Render a rail card face-up with its rolled variant (no flip motion). */
  private runwayShowFace(view: CardView, card: AddResult, index: number, instant: boolean): void {
    const d = def(CARD_DB, card.cardId);
    const variant: CardVariant = { frame: card.frame, holo: card.holo, fullArt: card.fullArt };
    const plain = isPlainVariant(variant);
    // Holo wakes only near the gate: the virtual window bounds concurrent
    // fx:'full' cards to the visible strip, inside the ≤15 doctrine cap.
    const fx: CardFxLevel =
      card.holo !== 'none' ? (fxPolicy(this).particleScale >= 1 ? 'full' : 'static') : plain ? 'none' : 'static';
    view.setCard(d, { fx, variant: plain ? undefined : variant, fullArt: variant.fullArt });
    if (card.dupeGold > 0) view.setAlpha(0.5);
    view.setData('packInspectBlocked', false);
    this.addNewMarker(view, card);
    if (!instant) {
      view.setScale(RUNWAY_CARD_SCALE + 0.06, RUNWAY_CARD_SCALE);
      this.tweens.add({ targets: view, scaleX: RUNWAY_CARD_SCALE, duration: 160, ease: 'Back.easeOut' });
      if (card.fullArt) this.shedFullArtFrame(view, card);
    }
  }

  /**
   * A full-art pull first flashes its framed standard treatment, then the
   * frame lifts away to the full-bleed art — a framed ghost child fades and
   * grows over the real render, so the rail can keep moving beneath it.
   */
  private shedFullArtFrame(view: CardView, card: AddResult): void {
    if (Services.save.data.settings.animations !== 'full') return;
    const framedVariant: CardVariant = { frame: card.frame, holo: 'none', fullArt: false };
    const framed = new CardView(this, 0, 0);
    framed.setCard(def(CARD_DB, card.cardId), {
      fx: 'none',
      variant: isPlainVariant(framedVariant) ? undefined : framedVariant,
      fullArt: false,
    });
    view.add(framed);
    this.tweens.add({
      targets: framed,
      alpha: 0,
      scaleX: 1.06,
      scaleY: 1.06,
      delay: 150,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (framed.active) framed.destroy();
      },
    });
  }

  /** Reveal every card up to and including `target` (gate crossings). */
  private runwayRevealTo(target: number): void {
    const rw = this.runway;
    if (!rw) return;
    for (let i = rw.revealedMax + 1; i <= target && i < rw.cards.length; i++) {
      rw.revealedMax = i;
      const card = rw.cards[i];
      const view = rw.views.get(i);
      if (view) {
        const now = this.time.now;
        // Grouped flip audio: a fast scrub reveals many cards on one sound.
        if (now - rw.lastFlipSfxAt >= RUNWAY_FLIP_SFX_MIN_GAP_MS) {
          rw.lastFlipSfxAt = now;
          Sfx.play('flip', { pitch: flipPitchJitter(i) });
        }
        this.runwayShowFace(view, card, i, false);
        this.inspectables.push({ card, view });
      }
      const color = theme.rarity[card.tier];
      if (color !== rw.tintColor) {
        rw.tintColor = color;
        rw.tint.setFillStyle(colorInt(color), 0.08);
        this.tweens.add({ targets: rw.tint, fillAlpha: 0.16, duration: 220, yoyo: true });
      }
    }
    if (rw.revealedMax >= rw.cards.length - 1 && !rw.finishScheduled) {
      rw.finishScheduled = true;
      this.time.delayedCall(650, () => this.runwayFinish());
    }
  }

  /** Auto-advance one gate crossing at the tier's cadence, then chain. */
  private runwayAdvance(): void {
    const rw = this.runway;
    if (!rw || rw.mode === 'done') return;
    rw.mode = 'auto';
    rw.idleSince = null;
    rw.resumeChip?.container.destroy();
    rw.resumeChip = null;
    const next = rw.revealedMax + 1;
    if (next >= rw.cards.length) {
      this.runwayFinish();
      return;
    }
    const target = railOffsetForIndex(next);
    const distance = rw.offset - target;
    // Scrubbed back into revealed territory: fast-travel to the frontier first.
    if (distance > RUNWAY_PITCH * 1.5) {
      rw.autoTween = this.tweens.add({
        targets: rw,
        offset: railOffsetForIndex(rw.revealedMax) ,
        duration: Math.min(900, distance / 2),
        ease: 'Sine.easeInOut',
        onUpdate: () => this.runwayApplyOffset(rw.offset),
        onComplete: () => {
          rw.autoTween = null;
          if (rw.mode === 'auto') this.runwayAdvance();
        },
      });
      return;
    }
    const tier = rw.cards[next].tier;
    let runIndex = 0;
    for (let j = next - 1; j >= 0 && rw.cards[j].tier === tier; j--) runIndex++;
    const level = Services.save.data.settings.animations === 'reduced' ? 'reduced' : 'full';
    const dwell = cardDwellMs(tier, runIndex, level);
    rw.autoTween = this.tweens.add({
      targets: rw,
      offset: target,
      duration: Math.max(60, dwell * Math.max(0.4, Math.abs(distance) / RUNWAY_PITCH)),
      ease: tier === 'c' || tier === 'r' ? 'Linear' : 'Sine.easeOut',
      onUpdate: () => this.runwayApplyOffset(rw.offset),
      onComplete: () => {
        rw.autoTween = null;
        if (rw.mode !== 'auto') return;
        if (next === rw.cards.length - 1) this.runwaySpotlightStop(next, true);
        else if (tier === 'ur') this.runwaySpotlightStop(next, false);
        else this.runwayAdvance();
      },
    });
  }

  /** Tier-scaled full stop. Mid-ride URs and the final card wait for a tap. */
  private runwaySpotlightStop(index: number, finale: boolean): void {
    const rw = this.runway;
    if (!rw) return;
    if (finale && rw.finaleStarted) return;
    let view = rw.views.get(index);
    if (!view) {
      this.runwayApplyOffset(railOffsetForIndex(index));
      view = rw.views.get(index);
    }
    if (!view) {
      if (finale) {
        rw.finaleStarted = true;
        rw.mode = 'idle';
        this.runwayFinish();
      } else this.runwayAdvance();
      return;
    }
    if (finale) rw.finaleStarted = true;
    rw.mode = 'stopped';
    rw.drag = null;
    const tier = rw.cards[index].tier;
    const escalationTier = tier === 'c' || tier === 'r' ? 'sr' : tier;
    const baseEsc = ESCALATION[escalationTier];
    const esc = tier === 'c' || tier === 'r'
      ? { ...baseEsc, flash: [255, 216, 138] as [number, number, number], tint: colorInt(theme.colors.gold) }
      : baseEsc;
    const width = 1280;
    const height = 720;
    Sfx.play('shimmer');
    this.cameras.main.flash(260, ...esc.flash);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, 0)
      .setDepth(40)
      .setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: esc.dimAlpha, duration: 300 });
    // Lift the card out of the rail container so it renders above the dim.
    rw.root.remove(view);
    this.add.existing(view);
    view.setDepth(50);
    this.cameras.main.zoomTo(esc.zoom * activeRenderScale(), 380);
    this.tweens.add({ targets: view, scale: 0.85, x: width / 2, y: height / 2 + 20, duration: 320, ease: 'Cubic.easeOut' });
    const burst = this.add.particles(RUNWAY_GATE_X, RUNWAY_CARD_Y, 'fx-star', {
      speed: { min: 220, max: 640 },
      lifespan: 1100,
      scale: { start: 1.6, end: 0 },
      emitting: false,
      tint: esc.tint,
      blendMode: Phaser.BlendModes.ADD,
    });
    burst.setDepth(60);
    burst.explode(Math.max(1, Math.round(esc.particles * fxPolicy(this).particleScale)), RUNWAY_GATE_X, RUNWAY_CARD_Y);
    const hint = this.add
      .text(width / 2, height - 38, 'tap to continue', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 1, duration: 400 });
    rw.spotlight = { dim, hint, finale };
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      this.runwaySpotlightSettle(view, index, finale);
    };
    dim.once('pointerup', settle);
    view.once('pointerup', settle);
  }

  /** Restore zoom, tuck the card back into the rail, then continue or summarize. */
  private runwaySpotlightSettle(view: CardView, index: number, finale: boolean): void {
    const rw = this.runway;
    if (!rw) return;
    // A tap during the zoom-in leaves that effect running, and zoomTo is a
    // no-op while one is active — the restore would be silently dropped and
    // the camera stuck zoomed. Stop the in-flight effect first.
    this.cameras.main.zoomEffect.reset();
    this.cameras.main.zoomTo(activeRenderScale(), 300);
    const spot = rw.spotlight;
    rw.spotlight = null;
    if (spot) {
      spot.hint.destroy();
      this.tweens.add({
        targets: spot.dim,
        fillAlpha: 0,
        duration: 300,
        onComplete: () => {
          if (spot.dim.active) spot.dim.destroy();
        },
      });
    }
    if (view.active) {
      this.tweens.killTweensOf(view);
      view.setDepth(0);
      rw.root.add(view);
      this.tweens.add({
        targets: view,
        x: cardRailX(index, rw.offset),
        y: RUNWAY_CARD_Y,
        scale: RUNWAY_CARD_SCALE,
        duration: 280,
        onComplete: () => {
          if (rw.mode !== 'stopped') return;
          if (finale) {
            rw.mode = 'idle';
            this.runwayFinish();
          } else this.runwayAdvance();
        },
      });
    } else if (rw.mode === 'stopped') {
      if (finale) {
        rw.mode = 'idle';
        this.runwayFinish();
      } else this.runwayAdvance();
    }
  }

  private runwayScrubStart(p: Phaser.Input.Pointer): void {
    const rw = this.runway;
    if (!rw || rw.mode === 'stopped' || rw.mode === 'done') {
      // After the ride, dragging the rail for review is still allowed.
      if (rw && rw.mode === 'done') {
        rw.drag = { startX: p.worldX, startOffset: rw.offset, lastX: p.worldX, lastAt: this.time.now, velocity: 0, moved: false };
      }
      return;
    }
    rw.autoTween?.remove();
    rw.autoTween = null;
    rw.mode = 'scrub';
    rw.drag = { startX: p.worldX, startOffset: rw.offset, lastX: p.worldX, lastAt: this.time.now, velocity: 0, moved: false };
  }

  private runwayScrubMove(p: Phaser.Input.Pointer): void {
    const rw = this.runway;
    if (!rw?.drag) return;
    const drag = rw.drag;
    if (!drag.moved && !dragMoved(drag.startX, 0, p.worldX, 0, 8)) return;
    drag.moved = true;
    const now = this.time.now;
    const dt = Math.max(1, now - drag.lastAt);
    drag.velocity = drag.velocity * 0.75 + (((p.worldX - drag.lastX) * 1000) / dt) * 0.25;
    drag.lastX = p.worldX;
    drag.lastAt = now;
    this.runwayApplyOffset(drag.startOffset + (p.worldX - drag.startX));
  }

  private runwayScrubEnd(): void {
    const rw = this.runway;
    if (!rw?.drag) return;
    const drag = rw.drag;
    rw.drag = null;
    if (rw.mode === 'done') return;
    if (drag.moved) {
      rw.velocity = drag.velocity;
      rw.mode = 'inertia';
    } else {
      rw.mode = 'idle';
      rw.idleSince = this.time.now;
    }
  }

  /** Per-frame: inertia decay and the Resume Reveal chip after idle. */
  update(time: number, delta: number): void {
    const rw = this.runway;
    if (!rw) return;
    if (rw.mode === 'inertia') {
      rw.velocity = inertiaStep(rw.velocity, delta);
      const before = rw.offset;
      if (rw.velocity !== 0) this.runwayApplyOffset(rw.offset + (rw.velocity * delta) / 1000);
      if (rw.velocity === 0 || rw.offset === before) {
        rw.velocity = 0;
        rw.mode = 'idle';
        rw.idleSince = time;
      }
    }
    if (
      rw.mode === 'idle' &&
      rw.idleSince !== null &&
      time - rw.idleSince >= RUNWAY_RESUME_DELAY_MS &&
      !rw.resumeChip &&
      rw.revealedMax < rw.cards.length - 1
    ) {
      rw.resumeChip = themedButton(this, RUNWAY_GATE_X, 578, 'Resume Reveal ▸', {
        variant: 'primary',
        minWidth: 170,
        onTap: () => this.runwayAdvance(),
      });
      rw.resumeChip.container.setDepth(30);
    }
  }

  /** The ride is over: totals + the batch CTA rail; the rail stays scrubable. */
  private runwayFinish(): void {
    const rw = this.runway;
    if (!rw || rw.mode === 'done') return;
    if (rw.mode === 'stopped') {
      // A last-card UR: the spotlight owns the moment. Its settle advances
      // into this finish; re-arm the scheduled path instead of stomping it.
      rw.finishScheduled = false;
      return;
    }
    if (!rw.finaleStarted && rw.cards.length > 0) {
      this.runwaySpotlightStop(rw.cards.length - 1, true);
      return;
    }
    rw.mode = 'done';
    rw.autoTween?.remove();
    rw.autoTween = null;
    rw.resumeChip?.container.destroy();
    rw.resumeChip = null;
    this.skipBtn?.container.destroy();
    this.skipBtn = null;
    const width = 1280;
    const all = rw.cards;
    const newCards = all.filter((c) => c.isNew).length;
    const specials = all.filter((c) => c.tier !== 'c' && c.tier !== 'r').length;
    const dupeGold = all.reduce((sum, c) => sum + c.dupeGold, 0);
    const stats = this.add
      .text(
        width / 2,
        600,
        `${all.length} cards · ${newCards} new · ${specials} Super Rare+` +
          (dupeGold > 0 ? ` · +🪙 ${dupeGold} from duplicates` : ''),
        { fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body },
      )
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    this.tweens.add({ targets: stats, alpha: 1, duration: 300 });
    this.finishAchievementCheckpoint();
    this.buildBatchButtons(rw.batch.length);
  }

  /** Skip ≫ mid-ride: tear the runway down and fall back to the summary grid. */
  private runwaySkip(): void {
    const rw = this.runway;
    if (!rw) return;
    rw.autoTween?.remove();
    rw.spotlight?.hint.destroy();
    rw.spotlight?.dim.destroy();
    this.cameras.main.zoomEffect.reset(); // a live effect would keep re-zooming past setZoom
    this.cameras.main.setZoom(activeRenderScale());
    this.skipBtn?.container.destroy();
    this.skipBtn = null;
    rw.resumeChip?.container.destroy();
    rw.root.destroy(); // also unhooks the scene-level scrub listeners
    this.runway = null;
    this.inspectables = [];
    this.showBatchSummary(rw.batch);
    this.finishAchievementCheckpoint();
  }

  // Beat 2: the tear.
  private tear(pack: Phaser.GameObjects.Image): void {
    Sfx.play('cast'); // the whoosh doubles as the foil tearing open
    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(180, 255, 235, 180);
    const count = Math.max(1, Math.round(42 * fxPolicy(this).particleScale));
    const burst = this.add.particles(pack.x, pack.y, 'fx-star', {
      speed: { min: 180, max: 520 },
      lifespan: 900,
      scale: { start: 1.4, end: 0 },
      quantity: count,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    });
    burst.explode(count, pack.x, pack.y);
    this.tweens.killTweensOf(pack);
    this.tweens.add({
      targets: pack,
      scaleX: pack.scaleX * 1.25,
      scaleY: pack.scaleY * 1.25,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        pack.destroy();
        this.dealCards();
      },
    });
  }

  // Beat 3+4: the c/r grid cascades; sr+ specials wait with tier-hint glows.
  private dealCards(): void {
    const width = 1280; // design-space width (see create())
    // PackResult is sorted worst→best, so both groups keep that order and the
    // best card in the pack is always the LAST special.
    const gridCards = this.result.cards.filter((c) => c.tier === 'c' || c.tier === 'r');
    const specialCards = this.result.cards.filter((c) => c.tier !== 'c' && c.tier !== 'r');

    // Grid math generalized to variable counts (0..boosterPackSize): 6 columns up to
    // 12 cards (2 rows), 8 tighter columns beyond; short last row centered.
    const cols = gridCards.length <= 12 ? 6 : 8;
    const dx = cols === 6 ? 152 : 126;
    const gridScale = cols === 6 ? 0.46 : 0.4;
    gridCards.forEach((card, i) => {
      const row = Math.floor(i / cols);
      const col = i - row * cols;
      const rowLen = Math.min(cols, gridCards.length - row * cols);
      const x = width / 2 - ((rowLen - 1) * dx) / 2 + col * dx;
      const y = GRID_Y0 + row * GRID_DY;
      const view = new CardView(this, width / 2, 340);
      view.setScale(0.1).setCard(null); // face down
      this.tweens.add({
        targets: view,
        x,
        y,
        scale: gridScale,
        delay: i * 55,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // cascade flip; r-tier grid cards keep the silver-glow read
          this.time.delayedCall(180 + i * 70, () => this.flip(view, card, 'none'));
        },
      });
    });

    // All-grid packs (0 specials): nothing waits for a tap — go straight to
    // done once the last cascade flip has landed.
    if (specialCards.length === 0) {
      const settle = (gridCards.length - 1) * 125 + 1200;
      this.time.delayedCall(Math.max(settle, 600), () => this.checkAllRevealed());
    }

    // Specials row: variable 0..n, spacing compressed so any count fits.
    const s = specialCards.length;
    const spacing = s > 1 ? Math.min(190, (width - 240) / (s - 1)) : 0;
    specialCards.forEach((card, i) => {
      const isBest = i === s - 1;
      const hint = HINT[card.tier as keyof typeof HINT] ?? HINT.sr;
      const x = width / 2 - ((s - 1) * spacing) / 2 + i * spacing;
      const view = new CardView(this, width / 2, 340);
      view.setScale(0.1).setCard(null);
      const entry: SpecialEntry = { view, card, done: false, homeX: x };
      this.specials.push(entry);
      this.tweens.add({
        targets: view,
        x,
        y: SPECIAL_Y,
        scale: SPECIAL_SCALE,
        delay: 700 + i * 110,
        duration: 380,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Skip can reveal this card BEFORE its deal-in tween completes —
          // attaching the hint then would leave a permanent pulsing glow/ring
          // on an already-revealed card (revealSpecial early-returns on done,
          // so its cleanup never runs).
          if (entry.done || !view.active) return;
          // tier-hint glow: gold for sr, violet for ssr, crimson for ur
          if (fxPolicy(this).packGlow && view.postFX) {
            const glow = view.postFX.addGlow(hint.glow, 2, 0, false, 0.12, 18);
            this.tweens.add({
              targets: glow,
              outerStrength: isBest ? 7 : 4,
              duration: hint.pulse,
              yoyo: true,
              repeat: -1,
            });
          } else {
            // lite/canvas: a tinted ring-sprite pulse — same read, no postFX cost
            const ring = this.add
              .image(view.x, view.y, 'frame-ring')
              .setDisplaySize((CARD_W + 26) * SPECIAL_SCALE, (CARD_H + 26) * SPECIAL_SCALE)
              .setTint(hint.glow)
              .setAlpha(0.25);
            this.children.moveBelow(ring, view);
            entry.hint = ring;
            this.tweens.add({
              targets: ring,
              alpha: 0.85,
              duration: hint.pulse,
              yoyo: true,
              repeat: -1,
            });
          }
          view.enableInput();
          // Only the best card in the pack gets the full spotlight escalation.
          const reveal = (p: Phaser.Input.Pointer): void => {
            if (p.button === 2) return;
            view.off('pointerup', reveal);
            this.revealSpecial(entry, isBest);
          };
          view.on('pointerup', reveal);
        },
      });
    });

    // Skip button (respect the repeat opener's time)
    this.skipBtn = themedButton(this, width - 80, 30, 'Skip ≫', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 100,
      onTap: () => this.skipAll(),
    });
  }

  /**
   * Flip a card face-up rendering its ROLLED variant. FX budget: plain grid
   * cards stay fx:'none' (`minFx`), any special frame/holo renders the
   * variant, and fx:'full' is spent only where the finish needs it (a real
   * holo). Worst case — 15 holo'd cards — sits exactly at CardView's ≤15
   * fx:'full' doctrine cap.
   */
  private flip(view: CardView, card: AddResult, minFx: 'none' | 'static', fast = false): void {
    if (!view.active) return; // a re-render/restart may have destroyed it
    const d = def(CARD_DB, card.cardId);
    const variant: CardVariant = { frame: card.frame, holo: card.holo, fullArt: card.fullArt };
    const plain = isPlainVariant(variant);
    const fx: CardFxLevel = card.holo !== 'none' ? 'full' : plain ? minFx : 'static';
    this.tweens.add({
      targets: view,
      scaleX: 0,
      duration: fast ? 60 : 130,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (!view.active) return;
        Sfx.play('flip');
        view.setCard(d, { fx, variant: plain ? undefined : variant, fullArt: variant.fullArt });
        // Auto-sold plain duplicate (dupeGold > 0 ⇒ over-playset, melted for gold,
        // never recorded): ghost it so it reads "sold, not added" — the gold chip
        // in the inspect modal shows the payout.
        if (card.dupeGold > 0) view.setAlpha(0.5);
        // r-tier grid cards keep a steady silver glow (the old uncommon read)
        if (card.tier === 'r' && fxPolicy(this).packGlow && view.postFX) {
          view.postFX.addGlow(13621482, 2.5, 0, false, 0.12, 14);
        }
        this.tweens.add({
          targets: view,
          scaleX: view.scaleY,
          duration: fast ? 80 : 170,
          ease: 'Back.easeOut',
        });
        this.enablePackInspect(view, card);
        // Same shed as the runway: full art reveals framed, then unframes.
        if (card.fullArt && !fast) this.shedFullArtFrame(view, card);
      },
    });
  }

  private enablePackInspect(view: CardView, card: AddResult): void {
    view.enableInput();
    this.addNewMarker(view, card);
    if (view.getData('packInspectBound')) return;
    view.setData('packInspectBound', true);
    this.inspectables.push({ card, view });
    view.on('pointerup', () => {
      if (view.getData('packInspectBlocked')) return;
      this.showPackInspect(card);
    });
  }

  private addNewMarker(view: CardView, card: AddResult): void {
    if (!card.isNew && !card.isNewVariant) return;
    if (view.getData('packNewMarker')) return;
    view.setData('packNewMarker', true);

    const color = card.isNew ? theme.colors.success : theme.rarity.ssr;
    const stroke = colorInt(color);
    const bg = this.add
      .circle(124, -176, 13, theme.graphics.panelFill, 0.9)
      .setStrokeStyle(1.5, stroke, 0.95);
    const star = this.add
      .text(124, -177, '★', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        fontStyle: '800',
        color,
      })
      .setOrigin(0.5);
    view.add([bg, star]);
  }

  private showPackInspect(card: AddResult): void {
    // Re-entry (arrow stepping) replaces the open modal; close silently first.
    this.closePackInspect();
    const width = 1280;
    const variant: CardVariant = { frame: card.frame, holo: card.holo, fullArt: card.fullArt };
    const shell = modalShell(this, {
      width: 600,
      height: 680,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      showClose: true, // the shell's standard top-right close (was a hand-placed × at (918,112))
      tapDimToClose: true,
      escToClose: false, // ESC arrives via the shared inspect-hotkeys binding below
      onClose: () => {
        if (this.inspectShell === shell) this.closePackInspect(false);
      },
    });
    this.inspectShell = shell;
    // Shared inspect convention (src/ui/inspectHotkeys.ts): arrows step the
    // revealed pulls, skipping cards whose reveal animation still blocks
    // inspect (no peeking at face-down specials); ESC closes.
    const index = this.inspectables.findIndex((entry) => entry.card === card);
    this.unbindInspectKeys = bindInspectHotkeys(this, {
      onPrev: () => this.stepPackInspect(index, -1),
      onNext: () => this.stepPackInspect(index, 1),
      onClose: () => this.closePackInspect(),
    });
    const c = shell.container;

    const view = new CardView(this, width / 2, 326).setScale(1.22);
    view.setCard(def(CARD_DB, card.cardId), {
      fx: card.holo !== 'none' ? 'full' : 'static',
      variant: isPlainVariant(variant) ? undefined : variant,
      fullArt: variant.fullArt,
    });
    c.add(view);

    const detailLines = this.packPullDetails(card, variant);
    const detailPanelY = 638;
    const lineH = 22;
    c.add(
      panel(this, width / 2 - 260, detailPanelY - 54, 520, 108, { alpha: 0.98 }),
    );
    const firstY = detailPanelY - ((detailLines.length - 1) * lineH) / 2;
    detailLines.forEach((line, i) => {
      c.add(
        this.add
          .text(width / 2, firstY + i * lineH, line, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: i === 0 && line.includes('★') ? '800' : '600',
            color: this.packPullDetailColor(line),
          })
          .setOrigin(0.5),
      );
    });
  }

  private stepPackInspect(from: number, delta: number): void {
    const n = this.inspectables.length;
    for (let hop = 1; hop <= n; hop++) {
      const entry = this.inspectables[(from + delta * hop + n * hop) % n];
      if (entry && entry.view.active && !entry.view.getData('packInspectBlocked')) {
        this.showPackInspect(entry.card);
        return;
      }
    }
  }

  /** Unbind + optionally close the shell (false when the shell is already closing). */
  private closePackInspect(closeShell = true): void {
    this.unbindInspectKeys?.();
    this.unbindInspectKeys = null;
    const shell = this.inspectShell;
    this.inspectShell = null;
    if (closeShell) shell?.close();
  }

  private packPullDetails(card: AddResult, variant: CardVariant): string[] {
    // Pull odds lead so the marquee stat never clips when all lines are
    // present (user-directed 2026-07-11).
    const lines: string[] = [
      `Pull odds ${formatOdds(variantOdds(card.tier, variant.frame, variant.holo, variant.fullArt))}`,
    ];
    if (card.isNew) lines.push('★ New Card');
    else if (card.isNewVariant) lines.push('★ New Variant');
    lines.push(`Rarity: ${this.rarityLabel(card.tier)}`);
    if (variant.frame !== 'white') lines.push(`Frame: ${this.titleCase(variant.frame)}`);
    if (variant.holo !== 'none') lines.push(`Shiny: ${this.titleCase(variant.holo)}`);
    if (variant.fullArt) lines.push('Treatment: Full Art');
    return lines;
  }

  private packPullDetailColor(line: string): string {
    if (line.startsWith('Pull odds')) return theme.colors.gold; // the marquee stat leads
    if (line === '★ New Card') return theme.colors.success;
    if (line === '★ New Variant') return theme.rarity.ssr;
    return theme.colors.body;
  }

  private rarityLabel(tier: AddResult['tier']): string {
    switch (tier) {
      case 'c':
        return 'Common';
      case 'r':
        return 'Rare';
      case 'sr':
        return 'Super Rare';
      case 'ssr':
        return 'Secret Super Rare';
      case 'ur':
        return 'Ultra Rare';
    }
  }

  private variantLabel(variant: CardVariant): string {
    const parts: string[] = [];
    if (variant.fullArt) parts.push('Full Art');
    if (variant.frame !== 'white') parts.push(`${this.titleCase(variant.frame)} Frame`);
    if (variant.holo !== 'none') parts.push(this.titleCase(variant.holo));
    return parts.length > 0 ? parts.join(' · ') : 'Plain';
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /**
   * NEW ribbon or dupe-gold chip under a revealed card (+tier tag on
   * specials, + a variant callout — e.g. 'GOLD FRAME · VOID' — under the tier
   * tag on any special variant).
   */
  private badge(view: CardView, card: AddResult): void {
    const special = !isPlainVariant({ frame: card.frame, holo: card.holo, fullArt: card.fullArt });
    const topY = view.y - 220 * view.scaleY;
    if (TIER_RANK[card.tier] >= TIER_RANK.sr) {
      const tag = this.add
        .text(view.x, topY - (special ? 40 : 16), TIER_LABEL[card.tier], {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: '700',
          color: (HINT[card.tier as keyof typeof HINT] ?? HINT.sr).label,
          backgroundColor: theme.colors.panelFill,
          padding: { x: 9, y: 3 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: tag, alpha: 1, duration: 250 });
    }
    if (special) {
      const parts: string[] = [];
      if (card.frame !== 'white') parts.push(`${card.frame.toUpperCase()} FRAME`);
      if (card.holo !== 'none') parts.push(card.holo.toUpperCase());
      const callout = this.add
        .text(view.x, topY - 14, parts.join(' · '), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: '700',
          color: theme.colors.heading,
          backgroundColor: theme.colors.panelFill,
          padding: { x: 9, y: 3 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: callout, alpha: 1, duration: 250 });
    }
    const label = card.isNew ? 'NEW' : card.dupeGold > 0 ? `🪙 +${card.dupeGold}` : null;
    if (!label) return;
    const t = this.add
      .text(view.x, view.y + 220 * view.scaleY + 12, label, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: '700',
        color: card.isNew ? theme.colors.success : theme.colors.gold,
        backgroundColor: theme.colors.panelFill,
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 250 });
  }

  // Beat 5: reveal. The pack's best card gets the escalation; its tier sets
  // the intensity (sr gold → ssr violet → ur crimson).
  private revealSpecial(entry: SpecialEntry, escalate: boolean, fast = false): void {
    if (entry.done) return;
    entry.done = true;
    const { view, card } = entry;
    view.setData('packInspectBlocked', escalate && !fast);
    view.postFX?.clear();
    if (entry.hint) {
      this.tweens.killTweensOf(entry.hint);
      entry.hint.destroy();
      entry.hint = undefined;
    }

    if (!escalate || fast) {
      // On skip, only the best card keeps its shimmer (one sting, not a chord);
      // every special still flips rendering its rolled variant.
      const isBest = entry === this.specials[this.specials.length - 1];
      if (!fast || isBest) Sfx.play('shimmer');
      this.flip(view, card, 'static', fast);
      this.checkAllRevealed();
      return;
    }

    // Best-card escalation: scoped slow-mo, dim spotlight, zoom, starburst.
    const esc = ESCALATION[card.tier as keyof typeof ESCALATION] ?? ESCALATION.sr;
    const width = 1280; // design-space constants (see create())
    const height = 720;
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, 0)
      .setDepth(40)
      .setInteractive(); // tap anywhere to dismiss the showcase (armed below)
    view.setDepth(50);
    this.tweens.add({ targets: dim, fillAlpha: esc.dimAlpha, duration: 300 });
    this.tweens.timeScale = 0.35;
    // zoomTo targets are ABSOLUTE camera zooms: multiply by the render-scale
    // base zoom k (applySceneSettings set the camera to k, not 1) or the
    // escalation would stomp it and reveal the full 1280k×720k canvas.
    this.cameras.main.zoomTo(esc.zoom * activeRenderScale(), 380);
    this.tweens.add({
      targets: view,
      scale: 0.85,
      y: height / 2 + 30,
      x: width / 2,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!view.active) return;
        this.flip(view, card, 'static');
        this.time.delayedCall(220, () => {
          if (!view.active) return;
          Sfx.play('shimmer');
          this.cameras.main.flash(260, ...esc.flash);
          const burst = this.add.particles(view.x, view.y, 'fx-star', {
            speed: { min: 220, max: 640 },
            lifespan: 1100,
            scale: { start: 1.6, end: 0 },
            emitting: false,
            tint: esc.tint,
            blendMode: Phaser.BlendModes.ADD,
          });
          burst.setDepth(60);
          burst.explode(
            Math.max(1, Math.round(esc.particles * fxPolicy(this).particleScale)),
            view.x,
            view.y,
          );
          // Tap-to-skip: a hint + the interactive dim let the player dismiss the
          // showcase early. Both the tap and the wobble's natural end route
          // through settleBest, which is one-shot guarded so they can't double.
          const skipHint = this.add
            .text(width / 2, height - 38, 'tap to skip', {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.label}px`,
              color: theme.colors.muted,
            })
            .setOrigin(0.5)
            .setDepth(41)
            .setAlpha(0);
          this.tweens.add({ targets: skipHint, alpha: 1, duration: 400 });
          dim.once('pointerup', () => this.settleBest(entry, dim, skipHint));
          view.once('pointerup', () => this.settleBest(entry, dim, skipHint));
          // showcase wobble, then settle back to its dealt slot
          this.tweens.add({
            targets: view,
            angle: { from: -2.5, to: 2.5 },
            duration: 900,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
            onComplete: () => this.settleBest(entry, dim, skipHint),
          });
        });
      },
    });
  }

  /**
   * End the best-card spotlight: restore the animation-policy timeScale and the
   * render-scale base zoom, fade the dim, and slide the card back to its dealt
   * slot (`homeX`, upright) — NOT screen-center, which left it overlapping its
   * neighbours. Runs at most once per pack (guarded by `bestSettled`) whether
   * fired by tap-to-skip or the wobble finishing on its own.
   */
  private settleBest(
    entry: SpecialEntry,
    dim: Phaser.GameObjects.Rectangle,
    skipHint: Phaser.GameObjects.Text,
  ): void {
    if (this.bestSettled) return;
    this.bestSettled = true;
    const { view } = entry;
    this.tweens.killTweensOf(view); // stop an in-flight wobble on tap-to-skip
    // Restore the animation-policy baseline, NOT a hardcoded 1 — otherwise the
    // 'reduced'/'off' timeScale that applySceneSettings set at create() is
    // silently lost for the rest of the pack once any SR+ card escalates.
    this.tweens.timeScale = animTimeScale(Services.save.data.settings.animations);
    // restore to the render-scale base zoom, not 1 (zoomTo is absolute)
    this.cameras.main.zoomTo(activeRenderScale(), 300);
    if (skipHint.active) skipHint.destroy();
    this.tweens.add({
      targets: dim,
      fillAlpha: 0,
      duration: 300,
      onComplete: () => {
        if (dim.active) dim.destroy();
      },
    });
    if (view.active) {
      this.tweens.add({
        targets: view,
        x: entry.homeX,
        y: SPECIAL_Y,
        scale: SPECIAL_SCALE,
        angle: 0,
        duration: 300,
        onComplete: () => {
          if (view.active) view.setData('packInspectBlocked', false);
        },
      });
    }
    this.checkAllRevealed();
  }

  private skipAll(): void {
    this.tweens.timeScale = animTimeScale(Services.save.data.settings.animations);
    for (const entry of this.specials) this.revealSpecial(entry, false, true);
    this.checkAllRevealed();
  }

  private checkAllRevealed(): void {
    if (!this.specials.every((s) => s.done)) return;
    this.finishAchievementCheckpoint();
    this.skipBtn?.container.destroy();
    this.skipBtn = null;
    if (this.buttons.length > 0) return;

    const width = 1280; // design-space width (see create())
    panel(this, width / 2 - 360, BUTTON_Y - 32, 720, 72, { alpha: 0.76 }).setDepth(66);
    const mk = (x: number, label: string, cb: () => void): void => {
      const btn = themedButton(this, x, BUTTON_Y, label, {
        variant: 'primary',
        minWidth: 130,
        onTap: cb,
      });
      btn.container.setDepth(70);
      this.buttons.push(btn);
    };
    const openPrice = packPriceForSku(this.sku);
    mk(width / 2 - 200, `Open Another (🪙 ${openPrice})`, () => {
      const save = Services.save.data;
      if (!spendGold(save, openPrice)) return;
      Sfx.play('coin');
      const result = openPack(save, CARD_DB, createRngState(Date.now() & 0x7fffffff), packSetForSku(this.sku));
      Services.save.flush();
      this.tweens.timeScale = 1;
      this.scene.restart({ ...result, sku: this.sku });
    });
    mk(width / 2 + 60, 'Shop', () => this.scene.start('Shop'));
    mk(width / 2 + 200, 'Menu', () => this.scene.start('MainMenu'));
  }

  /** Pack collection changes become visible only after the reveal has settled. */
  private finishAchievementCheckpoint(): void {
    if (this.packRevealComplete) return;
    this.packRevealComplete = true;
    const checkpoint = checkpointAchievements(Services.save.data, CARD_DB);
    if (checkpoint.changed) {
      Services.save.flush();
      queueAchievementUnlockToasts(checkpoint.ids);
    }
    this.toasts?.release();
  }

  shutdown(): void {
    this.tweens.timeScale = 1; // never leak slow-mo out of this scene
  }
}
