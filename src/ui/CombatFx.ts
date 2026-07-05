import Phaser from 'phaser';
import { attackFxFor, type AttackArchetype } from '../data/attackFx';
import type { CardDef } from '../engine/types';
import { fxPolicy } from './fx/FXSupport';

// ---------------------------------------------------------------------------
// Duel-board attack-animation renderer. "Tasteful & quick": each effect runs
// ~300-450ms, reads clearly, never blocks input, and self-cleans. Every effect
// draws its CORE motion with a short-lived Graphics + tweens, so it still plays
// and disposes itself even when particles are disabled by the FX policy.
// Particle emitters (embers, splash, feathers) are OPTIONAL enrichment gated on
// fxPolicy(scene).particleScale — 0 means "graphics flash only, no particles".
//
// These effects are pure decoration: they NEVER drive game logic. The duel
// advances on its own; strike()/lunge() are fire-and-forget.
// ---------------------------------------------------------------------------

/** A point in scene space. */
interface Pt {
  x: number;
  y: number;
}

/** Themed color set for one archetype/card, all as 0xRRGGBB ints. */
interface Hue {
  /** Bright core / streak color. */
  core: number;
  /** Softer glow / secondary color. */
  glow: number;
}

/** Card-color -> hue table. Neutral weapons (slash/pierce/…) tint by this. */
function hueFor(card: CardDef): Hue {
  const colors = card.colors ?? [];
  if (colors.length > 1) return { core: 0xffe08a, glow: 0xd9a441 }; // multicolor -> gold
  const c = colors[0];
  switch (c) {
    case 'W':
      return { core: 0xfff2c4, glow: 0xf0c060 }; // warm gold
    case 'U':
      return { core: 0x9fd0ff, glow: 0x3f7fe0 }; // blue
    case 'B':
      return { core: 0xc79bff, glow: 0x7a3fc0 }; // violet
    case 'R':
      return { core: 0xffb066, glow: 0xe0521f }; // red-orange
    case 'G':
      return { core: 0x9fe6a0, glow: 0x3fa040 }; // green
    default:
      return { core: 0xd6dde6, glow: 0x8b98a8 }; // colorless -> steel
  }
}

export class CombatFx {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  /** Live temporaries so destroy() can flush everything mid-flight. */
  private readonly live = new Set<Phaser.GameObjects.GameObject>();
  private destroyed = false;

  constructor(scene: Phaser.Scene, depth = 60) {
    this.scene = scene;
    this.depth = depth;
  }

  // -- public API ---------------------------------------------------------

  /**
   * Quick forward lunge of an attacker tile toward the enemy side. A short
   * yoyo along `dir` (-1 human attacks upward, +1 AI attacks downward). Guards
   * .active — the board also tweens tile positions, so the view may vanish.
   */
  lunge(view: Phaser.GameObjects.Container, dir: -1 | 1): void {
    if (this.destroyed || !view.active) return;
    const restY = view.y;
    this.scene.tweens.add({
      targets: view,
      y: restY + dir * 14,
      duration: 140,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: 0,
      // 120ms back leg via yoyo; total ~260ms.
      onYoyo: (_tw, t) => {
        void t;
      },
      onComplete: () => {
        if (view.active) view.y = restY;
      },
      onStop: () => {
        if (view.active) view.y = restY;
      },
    });
  }

  /**
   * Themed impact VFX for one combat hit. The attacking card decides the
   * archetype via attackFxFor(); the effect is drawn from `source` toward
   * `target` and flourishes at the target point.
   */
  strike(source: Pt, target: Pt, card: CardDef): void {
    if (this.destroyed) return;
    const spec = attackFxFor(card);
    const hue = hueFor(card);
    const heavy = spec.heavy;
    const archetype: AttackArchetype = spec.archetype;
    switch (archetype) {
      case 'slash':
        this.slash(source, target, hue, heavy);
        break;
      case 'cleave':
        this.cleave(target, hue, heavy);
        break;
      case 'pierce':
        this.pierce(source, target, hue, heavy);
        break;
      case 'arcane':
        this.arcane(source, target, hue, heavy);
        break;
      case 'fire':
        this.fire(target, hue, heavy);
        break;
      case 'frost':
        this.frost(target, hue, heavy);
        break;
      case 'shadow':
        this.shadow(target, hue, heavy);
        break;
      case 'venom':
        this.venom(target, hue, heavy);
        break;
      case 'claw':
        this.claw(target, hue, heavy);
        break;
      case 'radiance':
        this.radiance(target, hue, heavy);
        break;
      case 'aerial':
        this.aerial(source, target, hue, heavy);
        break;
      case 'impact':
        this.impact(target, hue, heavy);
        break;
      default:
        // Exhaustiveness guard — every AttackArchetype must be handled.
        this.assertNever(archetype);
        break;
    }
  }

  /** Flush every in-flight temporary. Safe to call multiple times. */
  destroy(): void {
    this.destroyed = true;
    for (const obj of this.live) obj.destroy();
    this.live.clear();
  }

  // -- shared helpers -----------------------------------------------------

  private assertNever(x: never): void {
    void x;
  }

  /** Heavy hits render ~1.4x scale and slightly longer. */
  private scaleFor(heavy: boolean): number {
    return heavy ? 1.4 : 1;
  }

  /** A fresh Graphics registered as live so destroy() can flush it. */
  private gfx(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(this.depth);
    this.live.add(g);
    return g;
  }

  /**
   * Tween a Graphics (opacity/scale) and destroy it on complete. Every tween
   * callback re-checks .active — a scene teardown or destroy() may have already
   * disposed the object. `from`/`to` are the alpha endpoints; `grow` optionally
   * scales the object up over its life.
   */
  private playAndDispose(
    g: Phaser.GameObjects.Graphics,
    duration: number,
    opts: { from?: number; to?: number; grow?: number } = {},
  ): void {
    const from = opts.from ?? 1;
    const to = opts.to ?? 0;
    g.setAlpha(from);
    const target: Record<string, number> = { alpha: to };
    if (opts.grow !== undefined) {
      g.setScale(1);
      target.scaleX = opts.grow;
      target.scaleY = opts.grow;
    }
    this.scene.tweens.add({
      targets: g,
      ...target,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (g.active) g.destroy();
        this.live.delete(g);
      },
      onStop: () => {
        if (g.active) g.destroy();
        this.live.delete(g);
      },
    });
  }

  /**
   * Fire a one-shot particle burst if the budget allows, else no-op (the caller
   * always draws a graphics flash regardless). `count` is scaled by
   * particleScale and rounded up to at least 1 when any budget exists. The
   * emitter self-destructs after its particles die.
   */
  private burst(
    at: Pt,
    baseCount: number,
    cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
    tints: number[],
  ): void {
    const scale = fxPolicy(this.scene).particleScale;
    if (scale <= 0) return; // particles suppressed — graphics flash still shown
    const count = Math.max(1, Math.round(baseCount * scale));
    const lifespan =
      typeof cfg.lifespan === 'number' ? cfg.lifespan : 500;
    const emitter = this.scene.add
      .particles(at.x, at.y, 'fx-star', {
        lifespan,
        tint: tints,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
        ...cfg,
      })
      .setDepth(this.depth);
    this.live.add(emitter);
    emitter.explode(count);
    // Give the last particle time to fade, then dispose. Guard .active — a
    // destroy() or scene change may have already killed it.
    this.scene.time.delayedCall(lifespan + 80, () => {
      if (emitter.active) emitter.destroy();
      this.live.delete(emitter);
    });
  }

  // -- per-archetype effects ---------------------------------------------

  /** slash: a single fast bright diagonal blade-streak across the target. */
  private slash(source: Pt, target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const len = 46 * s;
    const g = this.gfx();
    // Diagonal streak centered on target, angled roughly along the approach.
    const ang = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);
    const perp = ang + Math.PI / 4;
    const dx = Math.cos(perp) * len;
    const dy = Math.sin(perp) * len;
    g.lineStyle(3 * s, hue.glow, 0.9);
    g.beginPath();
    g.moveTo(target.x - dx, target.y - dy);
    g.lineTo(target.x + dx, target.y + dy);
    g.strokePath();
    g.lineStyle(1.5 * s, hue.core, 1);
    g.beginPath();
    g.moveTo(target.x - dx, target.y - dy);
    g.lineTo(target.x + dx, target.y + dy);
    g.strokePath();
    this.playAndDispose(g, 300 + (heavy ? 60 : 0), { from: 1, to: 0 });
  }

  /** cleave: a heavy wide arc sweep + a brief impact ring. */
  private cleave(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const r = 40 * s;
    const g = this.gfx();
    // Wide arc sweep.
    g.lineStyle(4 * s, hue.core, 0.95);
    g.beginPath();
    g.arc(target.x, target.y, r, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(140), false);
    g.strokePath();
    // Brief impact ring (bigger for heavy specs via the scale-up tween).
    g.lineStyle(2.5 * s, hue.glow, 0.8);
    g.strokeCircle(target.x, target.y, r * 0.55);
    this.playAndDispose(g, 340 + (heavy ? 70 : 0), { from: 1, to: 0, grow: 1.25 });
  }

  /** pierce: a straight thrust streak from source to target + tip flash. */
  private pierce(source: Pt, target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    g.lineStyle(3 * s, hue.glow, 0.9);
    g.lineBetween(source.x, source.y, target.x, target.y);
    g.lineStyle(1.5 * s, hue.core, 1);
    g.lineBetween(source.x, source.y, target.x, target.y);
    // Sharp tip flash at target.
    g.fillStyle(hue.core, 1);
    g.fillCircle(target.x, target.y, 5 * s);
    this.playAndDispose(g, 300 + (heavy ? 60 : 0), { from: 1, to: 0 });
    this.burst(
      target,
      4,
      { speed: { min: 40, max: 110 * s }, scale: { start: 0.35 * s, end: 0 }, lifespan: 260 },
      [hue.core, hue.glow],
    );
  }

  /** arcane: a glowing bolt travels source->target, then a rune ring bursts. */
  private arcane(source: Pt, target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    // Traveling bolt: a small dot tweened along the path.
    const bolt = this.gfx();
    bolt.fillStyle(hue.core, 1);
    bolt.fillCircle(0, 0, 5 * s);
    bolt.lineStyle(2 * s, hue.glow, 0.7);
    bolt.strokeCircle(0, 0, 8 * s);
    bolt.setPosition(source.x, source.y).setAlpha(1);
    this.scene.tweens.add({
      targets: bolt,
      x: target.x,
      y: target.y,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (bolt.active) bolt.destroy();
        this.live.delete(bolt);
        if (this.destroyed) return;
        // Rune/sigil ring bursts at the target on arrival.
        const ring = this.gfx();
        ring.lineStyle(3 * s, hue.core, 1);
        ring.strokeCircle(target.x, target.y, 14 * s);
        // A second inner sigil hex for the "rune" read.
        ring.lineStyle(2 * s, hue.glow, 0.85);
        const hex = 12 * s;
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2;
          const a1 = ((i + 1) / 6) * Math.PI * 2;
          ring.lineBetween(
            target.x + Math.cos(a0) * hex,
            target.y + Math.sin(a0) * hex,
            target.x + Math.cos(a1) * hex,
            target.y + Math.sin(a1) * hex,
          );
        }
        this.playAndDispose(ring, 300 + (heavy ? 60 : 0), { from: 1, to: 0, grow: 1.6 });
        this.burst(
          target,
          6,
          { speed: { min: 30, max: 90 * s }, scale: { start: 0.4 * s, end: 0 }, lifespan: 320, angle: { min: 0, max: 360 } },
          [hue.core, hue.glow],
        );
      },
      onStop: () => {
        if (bolt.active) bolt.destroy();
        this.live.delete(bolt);
      },
    });
  }

  /** fire: an expanding flame burst + rising embers at the target. */
  private fire(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    // Layered flame lobes as filled circles, warm core over red glow.
    g.fillStyle(0xe0521f, 0.85);
    g.fillCircle(target.x, target.y, 20 * s);
    g.fillStyle(0xffa040, 0.9);
    g.fillCircle(target.x, target.y - 4 * s, 13 * s);
    g.fillStyle(0xffe08a, 1);
    g.fillCircle(target.x, target.y - 6 * s, 6 * s);
    this.playAndDispose(g, 340 + (heavy ? 70 : 0), { from: 1, to: 0, grow: 1.5 });
    // Rising embers: gravity-up-ish (negative Y speed bias).
    this.burst(
      target,
      8,
      {
        speedX: { min: -40 * s, max: 40 * s },
        speedY: { min: -130 * s, max: -50 * s },
        scale: { start: 0.35 * s, end: 0 },
        lifespan: 420,
      },
      [0xffe08a, 0xffa040, 0xe0521f],
    );
    void hue;
  }

  /** frost: radiating ice shards / crystal spikes at the target. */
  private frost(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    const spikes = 6;
    const inner = 6 * s;
    const outer = 26 * s;
    g.lineStyle(2.5 * s, 0xd8f2ff, 1);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      // Draw a slim crystal: base -> tip -> base triangle outline.
      const tx = target.x + Math.cos(a) * outer;
      const ty = target.y + Math.sin(a) * outer;
      const bx = target.x + Math.cos(a + 0.28) * inner;
      const by = target.y + Math.sin(a + 0.28) * inner;
      const cx = target.x + Math.cos(a - 0.28) * inner;
      const cy = target.y + Math.sin(a - 0.28) * inner;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(tx, ty);
      g.lineTo(cx, cy);
      g.strokePath();
    }
    g.fillStyle(0x9fd0ff, 0.9);
    g.fillCircle(target.x, target.y, inner);
    this.playAndDispose(g, 320 + (heavy ? 70 : 0), { from: 1, to: 0, grow: 1.3 });
    this.burst(
      target,
      6,
      { speed: { min: 50, max: 120 * s }, scale: { start: 0.3 * s, end: 0 }, lifespan: 300, angle: { min: 0, max: 360 } },
      [0xd8f2ff, 0x9fd0ff],
    );
    void hue;
  }

  /** shadow: dark tendrils / smoke lash coiling at the target. */
  private shadow(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    const tendrils = 4;
    const reach = 30 * s;
    g.lineStyle(3 * s, 0x2a123f, 0.9);
    for (let i = 0; i < tendrils; i++) {
      const a = (i / tendrils) * Math.PI * 2 + 0.3;
      // A coiling lash approximated by a short quadratic-ish 3-segment curve.
      const mx = target.x + Math.cos(a) * reach * 0.5;
      const my = target.y + Math.sin(a) * reach * 0.5;
      const ex = target.x + Math.cos(a + 0.8) * reach;
      const ey = target.y + Math.sin(a + 0.8) * reach;
      g.beginPath();
      g.moveTo(target.x, target.y);
      g.lineTo(mx, my);
      g.lineTo(ex, ey);
      g.strokePath();
    }
    g.lineStyle(2 * s, hue.core, 0.8);
    g.strokeCircle(target.x, target.y, 10 * s);
    this.playAndDispose(g, 340 + (heavy ? 70 : 0), { from: 1, to: 0, grow: 1.35 });
    this.burst(
      target,
      6,
      { speed: { min: 20, max: 70 * s }, scale: { start: 0.4 * s, end: 0 }, lifespan: 380, angle: { min: 0, max: 360 } },
      [0x2a123f, 0x5a2f8f, hue.core],
    );
  }

  /** venom: a green toxic droplet splash at the target. */
  private venom(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    // Central splat + a few droplet blobs flung outward.
    g.fillStyle(0x4fbf3f, 0.9);
    g.fillCircle(target.x, target.y, 12 * s);
    g.fillStyle(0x9fe6a0, 1);
    g.fillCircle(target.x, target.y, 6 * s);
    const drops = 5;
    for (let i = 0; i < drops; i++) {
      const a = (i / drops) * Math.PI * 2 + 0.2;
      const d = 22 * s;
      g.fillStyle(0x4fbf3f, 0.85);
      g.fillCircle(target.x + Math.cos(a) * d, target.y + Math.sin(a) * d, 3.5 * s);
    }
    this.playAndDispose(g, 320 + (heavy ? 60 : 0), { from: 1, to: 0, grow: 1.4 });
    this.burst(
      target,
      6,
      { speed: { min: 40, max: 130 * s }, scale: { start: 0.3 * s, end: 0 }, lifespan: 340, angle: { min: 0, max: 360 } },
      [0x9fe6a0, 0x4fbf3f, 0x2f8f2f],
    );
    void hue;
  }

  /** claw: three parallel diagonal claw-rake gashes across the target. */
  private claw(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    const len = 40 * s;
    const gap = 11 * s;
    // Rake runs top-left -> bottom-right; three parallel offset streaks.
    const dirX = Math.cos(Math.PI / 4);
    const dirY = Math.sin(Math.PI / 4);
    const perpX = -dirY;
    const perpY = dirX;
    for (let i = -1; i <= 1; i++) {
      const ox = perpX * gap * i;
      const oy = perpY * gap * i;
      const cx = target.x + ox;
      const cy = target.y + oy;
      g.lineStyle(3 * s, hue.glow, 0.85);
      g.lineBetween(cx - dirX * len, cy - dirY * len, cx + dirX * len, cy + dirY * len);
      g.lineStyle(1.4 * s, hue.core, 1);
      g.lineBetween(cx - dirX * len, cy - dirY * len, cx + dirX * len, cy + dirY * len);
    }
    this.playAndDispose(g, 300 + (heavy ? 60 : 0), { from: 1, to: 0 });
  }

  /** radiance: a holy sunburst / light flash at the target. */
  private radiance(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    const rays = 12;
    const inner = 8 * s;
    const outer = 32 * s;
    g.lineStyle(2.5 * s, 0xfff2c4, 1);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      g.lineBetween(
        target.x + Math.cos(a) * inner,
        target.y + Math.sin(a) * inner,
        target.x + Math.cos(a) * outer,
        target.y + Math.sin(a) * outer,
      );
    }
    g.fillStyle(0xfff2c4, 0.95);
    g.fillCircle(target.x, target.y, inner);
    g.lineStyle(2 * s, hue.glow, 0.9);
    g.strokeCircle(target.x, target.y, inner * 1.6);
    this.playAndDispose(g, 340 + (heavy ? 70 : 0), { from: 1, to: 0, grow: 1.5 });
    this.burst(
      target,
      6,
      { speed: { min: 40, max: 110 * s }, scale: { start: 0.35 * s, end: 0 }, lifespan: 320, angle: { min: 0, max: 360 } },
      [0xfff2c4, hue.glow],
    );
  }

  /** aerial: a wind swoop arc + a few feather/streak lines along the path. */
  private aerial(source: Pt, target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    const ang = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);
    const perpX = -Math.sin(ang);
    const perpY = Math.cos(ang);
    // Swoop arc: a bowed curve from source toward target via a bulged midpoint.
    const mx = (source.x + target.x) / 2 + perpX * 26 * s;
    const my = (source.y + target.y) / 2 + perpY * 26 * s;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(source.x, source.y),
      new Phaser.Math.Vector2(mx, my),
      new Phaser.Math.Vector2(target.x, target.y),
    );
    g.lineStyle(2.5 * s, hue.core, 0.9);
    curve.draw(g, 24);
    // A few streak/feather lines along the path.
    for (let i = 1; i <= 3; i++) {
      const p = curve.getPoint(i / 4);
      g.lineStyle(1.5 * s, hue.glow, 0.8);
      g.lineBetween(p.x - perpX * 6 * s, p.y - perpY * 6 * s, p.x + perpX * 6 * s, p.y + perpY * 6 * s);
    }
    this.playAndDispose(g, 320 + (heavy ? 60 : 0), { from: 1, to: 0 });
    this.burst(
      target,
      5,
      { speedX: { min: -60 * s, max: 60 * s }, speedY: { min: -30 * s, max: 40 * s }, scale: { start: 0.3 * s, end: 0 }, lifespan: 340 },
      [hue.core, 0xffffff],
    );
  }

  /** impact: a blunt concussive shockwave ring at the target. */
  private impact(target: Pt, hue: Hue, heavy: boolean): void {
    const s = this.scaleFor(heavy);
    const g = this.gfx();
    g.lineStyle(4 * s, hue.core, 1);
    g.strokeCircle(target.x, target.y, 12 * s);
    g.lineStyle(2 * s, hue.glow, 0.7);
    g.strokeCircle(target.x, target.y, 6 * s);
    // Grow-and-fade sells the concussive shockwave expansion.
    this.playAndDispose(g, 320 + (heavy ? 80 : 0), { from: 1, to: 0, grow: 2.1 });
    this.burst(
      target,
      6,
      { speed: { min: 60, max: 150 * s }, scale: { start: 0.35 * s, end: 0 }, lifespan: 280, angle: { min: 0, max: 360 } },
      [hue.core, hue.glow],
    );
  }
}
