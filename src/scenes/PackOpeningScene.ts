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
import { Services } from '../meta/services';
import { isPlainVariant, TIER_LABEL, TIER_RANK } from '../meta/variants';
import { animTimeScale } from '../platform/animPolicy';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { activeRenderScale } from '../platform/renderScale';
import { CARD_H, CARD_W, CardView, type CardFxLevel } from '../ui/CardView';
import { fxPolicy } from '../ui/fx/FXSupport';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { bakePackArt } from './ShopScene';

const GRID_Y0 = 190;
const GRID_DY = 216;
const SPECIAL_Y = 560;

/** Face-down hint pulse + tier-tag colors for the specials row (sr/ssr/ur). */
const HINT = {
  sr: { glow: 0xffcc33, pulse: 520, label: '#ffcc33' },
  ssr: { glow: 0xb266ff, pulse: 420, label: '#d9a0ff' },
  ur: { glow: 0xff5566, pulse: 320, label: '#ff8a7a' },
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
  sr: { flash: [255, 240, 200], particles: 60, zoom: 1.13, dimAlpha: 0.7, tint: 0xffffff },
  ssr: { flash: [225, 175, 255], particles: 85, zoom: 1.16, dimAlpha: 0.75, tint: 0xd9a0ff },
  ur: { flash: [255, 145, 145], particles: 115, zoom: 1.2, dimAlpha: 0.8, tint: 0xff7a6a },
};

interface SpecialEntry {
  view: CardView;
  card: AddResult;
  done: boolean;
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
  private sku: 'base' | 'ragnarok' = 'base';
  private revealed = 0;
  private specials: SpecialEntry[] = [];
  private buttons: Phaser.GameObjects.Text[] = [];
  private skipBtn: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('PackOpening');
  }

  create(data: PackResult & { sku?: 'base' | 'ragnarok' }): void {
    this.result = data;
    this.sku = data.sku ?? 'base';
    this.revealed = 0;
    this.specials = [];
    this.buttons = [];
    bakePackArt(this);
    if (this.sku === 'ragnarok') {
      bakePackArt(this, {
        key: 'packart-ragnarok',
        wordmark: 'Ragnarök',
        subtitle: 'EXPANSION BOOSTER',
        sceneArtKey: 'scene-pack-art-ragnarok',
        footer: '15 cards — Ragnarök set only',
      });
    }
    this.input.on('gameobjectup', () => Sfx.play('click'));
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
      dim: 0x080610,
      dimAlpha: 0.5,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x120e20, 0x120e20, 0x080610, 0x080610, 1);
        bg.fillRect(0, 0, width, height);
      },
    });

    // Beat 1: the pack floats, waiting for the tear.
    const pack = this.add
      .image(width / 2, height / 2 - 20, this.sku === 'ragnarok' ? 'packart-ragnarok' : 'packart')
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
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '24px',
        color: '#c9bde0',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });

    pack.once('pointerup', () => {
      prompt.destroy();
      this.tear(pack);
    });
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

    // Grid math generalized to variable counts (0..packSize): 6 columns up to
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
      const entry: SpecialEntry = { view, card, done: false };
      this.specials.push(entry);
      this.tweens.add({
        targets: view,
        x,
        y: SPECIAL_Y,
        scale: 0.62,
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
              .setDisplaySize((CARD_W + 26) * 0.62, (CARD_H + 26) * 0.62)
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
          view.once('pointerup', () => this.revealSpecial(entry, isBest));
        },
      });
    });

    // Skip button (respect the repeat opener's time)
    this.skipBtn = this.add
      .text(width - 30, 30, 'Skip ≫', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#8f83a8',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    // skipAll is idempotent (done flags), so .on replaces the old .once safely.
    bindTapButton(this, this.skipBtn, () => this.skipAll());
    inflateHitArea(this.skipBtn, 90, 90);
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
        // r-tier grid cards keep a steady silver glow (the old uncommon read)
        if (card.tier === 'r' && fxPolicy(this).packGlow && view.postFX) {
          view.postFX.addGlow(0xcfd8ea, 2.5, 0, false, 0.12, 14);
        }
        this.tweens.add({
          targets: view,
          scaleX: view.scaleY,
          duration: fast ? 80 : 170,
          ease: 'Back.easeOut',
        });
        this.badge(view, card);
      },
    });
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
        .text(view.x, topY - (special ? 32 : 10), TIER_LABEL[card.tier], {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: (HINT[card.tier as keyof typeof HINT] ?? HINT.sr).label,
          backgroundColor: '#1c1730',
          padding: { x: 7, y: 2 },
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
        .text(view.x, topY - 10, parts.join(' · '), {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '11px',
          fontStyle: '700',
          color: '#e8ddff',
          backgroundColor: '#1c1730',
          padding: { x: 7, y: 2 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: callout, alpha: 1, duration: 250 });
    }
    const label = card.isNew ? 'NEW' : card.dupeGold > 0 ? `+${card.dupeGold}g` : null;
    if (!label) return;
    const t = this.add
      .text(view.x, view.y + 220 * view.scaleY + 4, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: card.isNew ? '#9be6a8' : '#ffd88a',
        backgroundColor: '#1c1730',
        padding: { x: 8, y: 3 },
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
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(40);
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
          // showcase wobble, then settle back
          this.tweens.add({
            targets: view,
            angle: { from: -2.5, to: 2.5 },
            duration: 900,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              // Restore the animation-policy baseline, NOT a hardcoded 1 —
              // otherwise the 'reduced'/'off' timeScale that applySceneSettings
              // set at create() is silently lost for the rest of the pack once
              // any SR+ card escalates.
              this.tweens.timeScale = animTimeScale(Services.save.data.settings.animations);
              // restore to the render-scale base zoom, not 1 (see above)
              this.cameras.main.zoomTo(activeRenderScale(), 300);
              this.tweens.add({
                targets: dim,
                fillAlpha: 0,
                duration: 300,
                onComplete: () => {
                  if (dim.active) dim.destroy();
                },
              });
              if (view.active) {
                this.tweens.add({ targets: view, scale: 0.62, y: SPECIAL_Y, duration: 300 });
              }
              this.checkAllRevealed();
            },
          });
        });
      },
    });
  }

  private skipAll(): void {
    this.tweens.timeScale = animTimeScale(Services.save.data.settings.animations);
    for (const entry of this.specials) this.revealSpecial(entry, false, true);
    this.checkAllRevealed();
  }

  private checkAllRevealed(): void {
    if (!this.specials.every((s) => s.done)) return;
    this.skipBtn?.destroy();
    this.skipBtn = null;
    if (this.buttons.length > 0) return;

    const width = 1280; // design-space width (see create())
    const mk = (x: number, label: string, cb: () => void): void => {
      const btn = this.add
        .text(x, 686, label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '20px',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(70);
      bindTapButton(this, btn, cb);
      // Depth 70 keeps the inflated rects above the revealed specials' card
      // zones, so end-of-pack taps route to the buttons, never the cards.
      inflateHitArea(btn, 90, 90);
      this.buttons.push(btn);
    };
    const openPrice = this.sku === 'ragnarok' ? ECONOMY.ragnarokPackPrice : ECONOMY.packPrice;
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
