import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { createRngState } from '../engine/rng';
import { def } from '../engine/types';
import type { AddResult } from '../meta/Collection';
import { spendGold } from '../meta/Economy';
import { openPack, type PackResult } from '../meta/PackOpener';
import { formatOdds, variantOdds } from '../meta/pullOdds';
import { Services } from '../meta/services';
import { isPlainVariant, TIER_LABEL, TIER_RANK, type CardVariant } from '../meta/variants';
import { animTimeScale } from '../platform/animPolicy';
import { activeRenderScale } from '../platform/renderScale';
import { CARD_H, CARD_W, CardView, type CardFxLevel } from '../ui/CardView';
import { fxPolicy } from '../ui/fx/FXSupport';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, modalShell, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { bakePackArt, CELTIC_FAE_PACK_ART, packTextureForSku, type BoosterSku } from './ShopScene';

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
  private sku: BoosterSku = 'base';
  private revealed = 0;
  private specials: SpecialEntry[] = [];
  private buttons: ThemedButton[] = [];
  private skipBtn: ThemedButton | null = null;
  /** guards the best-card spotlight settle so tap-to-skip and the wobble's own
   * onComplete can't both run the restore (one-shot per pack). */
  private bestSettled = false;

  constructor() {
    super('PackOpening');
  }

  create(
    data: (PackResult & { sku?: BoosterSku }) | { batch: PackResult[]; sku?: BoosterSku },
  ): void {
    this.sku = data.sku ?? 'base';
    this.revealed = 0;
    this.specials = [];
    this.buttons = [];
    this.bestSettled = false;
    bakePackArt(this);
    if (this.sku === 'ragnarok') {
      bakePackArt(this, {
        key: 'packart-ragnarok',
        sceneArtKey: 'scene-pack-art-ragnarok',
      });
    } else if (this.sku === 'celtic-fae') {
      bakePackArt(this, CELTIC_FAE_PACK_ART);
    }
    this.input.on('gameobjectup', () => Sfx.play('click'));
    if (!contextMenuDisabled) {
      this.input.mouse?.disableContextMenu();
      contextMenuDisabled = true;
    }
    Music.setMood('shop'); // continuous with the shop — no-op when arriving from it

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

    // F10: a multi-pack buy skips the choreographed single-pack reveal and shows
    // a summary of the whole batch instead.
    if ('batch' in data) {
      this.showBatchSummary(data.batch);
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
        .text(width / 2, 360, 'No rare pulls this time — all commons and uncommons.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    } else {
      const cols = Math.min(8, notable.length);
      const dx = 150;
      notable.forEach((c, i) => {
        const row = Math.floor(i / cols);
        const col = i - row * cols;
        const rowLen = Math.min(cols, notable.length - row * cols);
        const x = width / 2 - ((rowLen - 1) * dx) / 2 + col * dx;
        const y = 300 + row * 210;
        const view = new CardView(this, x, y).setScale(0.42).setCard(def(CARD_DB, c.cardId), { fx: 'none' });
        this.enablePackInspect(view, c);
      });
    }

    goldBadge(this, width - 30, 30, { getValue: () => Services.save.data.gold });
    backButton(this, () => this.scene.start('Shop'));
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
    const variant = { frame: card.frame, holo: card.holo };
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
        view.setCard(d, { fx, variant: plain ? undefined : variant });
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
      },
    });
  }

  private enablePackInspect(view: CardView, card: AddResult): void {
    view.enableInput();
    this.addNewMarker(view, card);
    if (view.getData('packInspectBound')) return;
    view.setData('packInspectBound', true);
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
    const width = 1280;
    const variant = { frame: card.frame, holo: card.holo };
    const shell = modalShell(this, {
      width: 600,
      height: 680,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      showClose: false,
      tapDimToClose: true,
      escToClose: false,
    });
    const c = shell.container;

    const view = new CardView(this, width / 2, 326).setScale(1.22);
    view.setCard(def(CARD_DB, card.cardId), {
      fx: card.holo !== 'none' ? 'full' : 'static',
      variant: isPlainVariant(variant) ? undefined : variant,
    });
    c.add(view);

    const detailLines = this.packPullDetails(card, variant);
    c.add(
      panel(this, width / 2 - 260, 579, 520, 86, { alpha: 0.94 }),
    );
    c.add(
      this.add
        .text(width / 2, 600, detailLines[0], {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 632, detailLines.slice(1).join('  ·  '), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
        })
        .setOrigin(0.5),
    );

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

    const close = themedButton(this, 918, 112, '×', {
      variant: 'ghost', size: 'sm', minWidth: 48, onTap: () => shell.close(),
    });
    c.add(close.container);
  }

  private packPullDetails(card: AddResult, variant: CardVariant): string[] {
    const lines: string[] = [];
    if (card.isNew) lines.push('★ New Card');
    else if (card.isNewVariant) lines.push('★ New Variant');
    lines.push(`Rarity: ${this.rarityLabel(card.tier)}`);
    lines.push(`Pull odds ${formatOdds(variantOdds(card.tier, variant.frame, variant.holo))}`);
    if (variant.frame !== 'white') lines.push(`Frame: ${this.titleCase(variant.frame)}`);
    if (variant.holo !== 'none') lines.push(`Shiny: ${this.titleCase(variant.holo)}`);
    return lines;

  }

  private packPullDetailColor(line: string): string {
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
    const special = !isPlainVariant({ frame: card.frame, holo: card.holo });
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
    const openPrice =
      this.sku === 'ragnarok'
        ? ECONOMY.ragnarokPackPrice
        : this.sku === 'celtic-fae'
          ? ECONOMY.celticFaePackPrice
          : ECONOMY.packPrice;
    mk(width / 2 - 200, `Open Another (🪙 ${openPrice})`, () => {
      const save = Services.save.data;
      if (!spendGold(save, openPrice)) return;
      Sfx.play('coin');
      const result = openPack(save, CARD_DB, createRngState(Date.now() & 0x7fffffff), this.sku);
      Services.save.flush();
      this.tweens.timeScale = 1;
      this.scene.restart({ ...result, sku: this.sku });
    });
    mk(width / 2 + 60, 'Shop', () => this.scene.start('Shop'));
    mk(width / 2 + 200, 'Menu', () => this.scene.start('MainMenu'));
  }

  shutdown(): void {
    this.tweens.timeScale = 1; // never leak slow-mo out of this scene
  }
}
