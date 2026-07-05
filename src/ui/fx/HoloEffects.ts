import Phaser from 'phaser';
import type { HoloFinish } from '../../meta/variants';
import { fxPolicy } from './FXSupport';
import { IridescencePostFX } from './IridescencePostFX';

/**
 * Per-copy holo finishes (Axis C of a card variant, src/meta/variants.ts).
 * A finish is a pull cosmetic on a specific owned copy — cards rendered
 * without a variant get NO holo (the tier ring + gem still mark rarity).
 *
 * What each finish costs (the fx:'full' budget doctrine — keep ≤ ~15 holo'd
 * CardViews alive at once, see CardView):
 * - none         free.
 * - shiny        1 preFX shine pass (WebGL) / 1 drifting TileSprite (canvas+lite).
 * - rainbow      1 IridescencePostFX pipeline (mode 2) + 1 sparse sparkle
 *                emitter / TileSprite + sparkles on canvas+lite.
 * - pearlescent  1 IridescencePostFX pipeline (mode 3) + sparkles /
 *                TileSprite + sparkles on canvas+lite.
 * - fractal      1 TileSprite (crystal facets, all renderers) + sparkles.
 * - void         1 vignette Image + 1 continuous inward particle stream
 *                (all renderers; stream thinned by particleScale on lite).
 * TileSprites and sparse emitters were measured trivial in the perf audit;
 * the bounded cost is the shader pipelines, hence the fxPolicy gate.
 */

/** Draw a callback into a canvas texture once; no-op if it already exists. */
function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

/** Tiny deterministic PRNG for the procedural bakes. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Bake the shared FX textures once at boot (canvas-renderer friendly). */
export function bakeFxTextures(scene: Phaser.Scene): void {
  // 4-point star used by every sparkle/burst emitter.
  bake(scene, 'fx-star', 32, 32, (ctx) => {
    const s = 32;
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c, 1);
    ctx.quadraticCurveTo(c + 2.5, c - 2.5, s - 1, c);
    ctx.quadraticCurveTo(c + 2.5, c + 2.5, c, s - 1);
    ctx.quadraticCurveTo(c - 2.5, c + 2.5, 1, c);
    ctx.quadraticCurveTo(c - 2.5, c - 2.5, c, 1);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  // Seamless diagonal white band — the canvas/lite 'shiny' sweep.
  bake(scene, 'fx-sheen', 256, 256, (ctx) => {
    const size = 256;
    ctx.clearRect(0, 0, size, size);
    // Bands drawn at wrap offsets so tilePosition drift is seamless.
    for (const off of [-size, 0, size]) {
      const g = ctx.createLinearGradient(off, off, off + size, off + size);
      g.addColorStop(0.38, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  });

  // Seamless diagonal rainbow bands — the canvas/lite 'rainbow' foil.
  bake(scene, 'fx-prism', 256, 256, (ctx) => {
    const size = 256;
    const hues = [0, 40, 80, 150, 210, 270, 320, 360];
    for (const off of [-size, 0, size]) {
      const g = ctx.createLinearGradient(off, off, off + size, off + size);
      hues.forEach((h, i) => {
        g.addColorStop(i / (hues.length - 1), `hsla(${h % 360}, 90%, 62%, 0.55)`);
      });
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  });

  // Pink/green oil-slick blobs — the canvas/lite 'pearlescent' overlay.
  bake(scene, 'fx-pearl', 256, 256, (ctx) => {
    const size = 256;
    ctx.clearRect(0, 0, size, size);
    const rand = lcg(9001);
    const colors = ['rgba(255,120,190,0.5)', 'rgba(120,255,180,0.5)', 'rgba(255,160,210,0.4)', 'rgba(150,240,190,0.4)'];
    for (let i = 0; i < 14; i++) {
      const bx = rand() * size;
      const by = rand() * size;
      const r = 30 + rand() * 60;
      const color = colors[i % colors.length];
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const g = ctx.createRadialGradient(bx + ox, by + oy, 2, bx + ox, by + oy, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, size, size);
        }
      }
    }
  });

  // Crystal facets — 'fractal' overlay on every renderer. A deterministic
  // triangle mesh with translucent cool fills + bright edges; drawn on a
  // wrapping grid so the tile drifts seamlessly.
  bake(scene, 'fx-fractal', 256, 256, (ctx) => {
    const size = 256;
    const cells = 4;
    const step = size / cells;
    ctx.clearRect(0, 0, size, size);
    const rand = lcg(4242);
    // Jittered lattice; edge columns/rows mirror the first so the tile wraps.
    const pts: { x: number; y: number }[][] = [];
    for (let gy = 0; gy <= cells; gy++) {
      pts.push([]);
      for (let gx = 0; gx <= cells; gx++) {
        const jx = gx === 0 || gx === cells ? 0 : (rand() - 0.5) * step * 0.7;
        const jy = gy === 0 || gy === cells ? 0 : (rand() - 0.5) * step * 0.7;
        pts[gy].push({ x: gx * step + jx, y: gy * step + jy });
      }
    }
    const fills = ['rgba(170,225,255,0.16)', 'rgba(210,180,255,0.14)', 'rgba(255,255,255,0.06)', 'rgba(140,200,255,0.10)'];
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const a = pts[gy][gx];
        const b = pts[gy][gx + 1];
        const c = pts[gy + 1][gx];
        const d = pts[gy + 1][gx + 1];
        const tris = rand() < 0.5 ? [[a, b, c], [b, d, c]] : [[a, b, d], [a, d, c]];
        for (const tri of tris) {
          ctx.beginPath();
          ctx.moveTo(tri[0].x, tri[0].y);
          ctx.lineTo(tri[1].x, tri[1].y);
          ctx.lineTo(tri[2].x, tri[2].y);
          ctx.closePath();
          ctx.fillStyle = fills[Math.floor(rand() * fills.length)];
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = 'rgba(235,245,255,0.35)';
          ctx.stroke();
        }
      }
    }
  });

  // Dark-matter vignette — 'void' overlay, stretched over the art window.
  bake(scene, 'fx-void', 256, 192, (ctx) => {
    const w = 256;
    const h = 192;
    const g = ctx.createRadialGradient(w / 2, h / 2, 18, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(30,8,48,0.25)');
    g.addColorStop(0.55, 'rgba(18,4,32,0.62)');
    g.addColorStop(1, 'rgba(5,1,10,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export interface HoloHandle {
  /** feed pointer position (-1..1 card-relative) into pointer-reactive foils */
  setPointer(x: number, y: number): void;
  destroy(): void;
}

interface ArtRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Apply a holo finish to a card's art image (and container for overlays). The
 * single entry point — internally swaps WebGL shader effects for canvas-safe
 * TileSprite equivalents so no scene code ever branches on renderer, and
 * every finish stays legible on the lite tier.
 */
export function applyHolo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  art: Phaser.GameObjects.Image,
  finish: HoloFinish,
  artRect: ArtRect,
): HoloHandle {
  const cleanups: (() => void)[] = [];
  let pointerFx: IridescencePostFX | null = null;
  // Quality-tier gate: on lite/canvas, shader foils degrade to drifting
  // TileSprite overlays (TileSprites + sparse emitters measured trivial).
  const policy = fxPolicy(scene);

  const addShaderFx = (mode: number): void => {
    art.setPostPipeline(IridescencePostFX);
    const fx = art.getPostPipeline(IridescencePostFX);
    if (fx instanceof IridescencePostFX) {
      fx.mode = mode;
      pointerFx = fx;
      cleanups.push(() => art.removePostPipeline(fx));
    }
  };

  /** Drifting overlay tile clipped to the art window. */
  const addTile = (
    key: string,
    alpha: number,
    blend: Phaser.BlendModes,
    driftX: number,
    driftY: number,
    duration: number,
  ): void => {
    const tile = scene.add
      .tileSprite(artRect.x + artRect.w / 2, artRect.y + artRect.h / 2, artRect.w, artRect.h, key)
      .setBlendMode(blend)
      .setAlpha(alpha);
    container.add(tile);
    const tween = scene.tweens.add({
      targets: tile,
      tilePositionX: driftX,
      tilePositionY: driftY,
      duration,
      repeat: -1,
    });
    cleanups.push(() => {
      tween.remove();
      tile.destroy();
    });
  };

  switch (finish) {
    case 'none':
      break;

    case 'shiny': {
      // Diagonal white sheen: preFX sweep on full WebGL, drifting band
      // TileSprite everywhere else — same read on every renderer/tier.
      if (policy.shine && art.preFX) {
        const shine = art.preFX.addShine(0.6, 0.3, 4);
        cleanups.push(() => art.preFX?.remove(shine));
      } else {
        addTile('fx-sheen', 0.32, Phaser.BlendModes.SCREEN, 512, 512, 5200);
      }
      break;
    }

    case 'rainbow': {
      // Prismatic foil: pointer-reactive rainbow-band shader, or a drifting
      // rainbow tile where shaders are unavailable.
      if (policy.iridescence) addShaderFx(2);
      else addTile('fx-prism', 0.38, Phaser.BlendModes.SCREEN, 512, 256, 14000);
      break;
    }

    case 'pearlescent': {
      // Pink/green oil-slick: interference-band shader (mode 3), or a
      // drifting pink/green blob tile fallback.
      if (policy.iridescence) addShaderFx(3);
      else addTile('fx-pearl', 0.42, Phaser.BlendModes.SCREEN, 384, 512, 16000);
      break;
    }

    case 'fractal': {
      // Geometric crystal facets — one slowly drifting baked tile, identical
      // on every renderer (plus the sparkle glints below).
      addTile('fx-fractal', 0.5, Phaser.BlendModes.SCREEN, 256, 128, 26000);
      break;
    }

    case 'void': {
      // Dark-matter: purple/black vignette over the art + faint motes pulled
      // INTO the center (moveTo particles arrive at end of life).
      const vignette = scene.add
        .image(artRect.x + artRect.w / 2, artRect.y + artRect.h / 2, 'fx-void')
        .setDisplaySize(artRect.w, artRect.h)
        .setAlpha(0.85);
      container.add(vignette);
      cleanups.push(() => vignette.destroy());
      // The vignette is the static "dark" identity (kept always); the mote
      // stream is motion, so it is gated on the particle budget — with
      // animations off, particleScale is 0 and the stream is suppressed
      // entirely (a bare `|| 1` fallback used to read 0 as full rate).
      if (policy.particleScale > 0) {
        const cx = artRect.x + artRect.w / 2;
        const cy = artRect.y + artRect.h / 2;
        const motes = scene.add.particles(0, 0, 'fx-star', {
          x: { min: artRect.x + 6, max: artRect.x + artRect.w - 6 },
          y: { min: artRect.y + 6, max: artRect.y + artRect.h - 6 },
          moveToX: cx,
          moveToY: cy,
          lifespan: 1300,
          // continuous stream — thinned (not amplified) by the tier multiplier
          frequency: 130 / Math.min(1, policy.particleScale),
          scale: { start: 0.65, end: 0.05 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xb37dff, 0x6e2fa8, 0x3c1266],
          blendMode: Phaser.BlendModes.ADD,
        });
        container.add(motes);
        cleanups.push(() => motes.destroy());
      }
      break;
    }
  }

  // Foil-class finishes also get sparse sparkle glints (void has its motes).
  // Gated on the particle budget so animations 'off' (particleScale 0) drops
  // them rather than emitting at the fixed rate regardless.
  if (
    (finish === 'rainbow' || finish === 'pearlescent' || finish === 'fractal') &&
    policy.particleScale > 0
  ) {
    const particles = scene.add.particles(0, 0, 'fx-star', {
      x: { min: artRect.x + 8, max: artRect.x + artRect.w - 8 },
      y: { min: artRect.y + 8, max: artRect.y + artRect.h - 8 },
      lifespan: 900,
      frequency: 380,
      scale: { start: 0, end: 0.9, ease: 'Sine.easeOut' },
      alpha: { start: 1, end: 0 },
      angle: { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.ADD,
    });
    container.add(particles);
    cleanups.push(() => particles.destroy());
  }

  return {
    setPointer(x: number, y: number): void {
      if (pointerFx) {
        pointerFx.pointerX = x;
        pointerFx.pointerY = y;
      }
    },
    destroy(): void {
      for (const fn of cleanups.reverse()) fn();
      cleanups.length = 0;
      pointerFx = null;
    },
  };
}
