import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import type { CardDef } from '../engine/types';
import { isType } from '../engine/types';

/**
 * Compact battlefield tile for the duel board: framed art + name strip + P/T
 * plate + state overlays. Deliberately NOT a CardView — battlefield cards don't
 * need (unreadably tiny) rules text; a click/hover away, the inspect overlay
 * and zoom preview show the full card. Center origin, rotation-friendly for
 * taps, same Zone-child input pattern as CardView (never setInteractive a
 * scaled Container — playbook §11).
 *
 * Vertical stack (center origin, y in [-73, +73]), NO overlap:
 *   framed ART window at top → NAME strip below it → P/T stats row below name.
 */

export const TILE_W = 132;
export const TILE_H = 146;

// Framed art window: a visible frame margin on all four sides so the
// illustration sits INSIDE the tile border rather than spilling over it.
// The vertical budget below the 6px top margin is art(92)+gap(2)+name(22)+
// gap(2)+plate(21) = 139, which with FRAME_M leaves the plate 1px inside the
// bottom bound — art was trimmed 96→92 so nothing overflows ±73.
const FRAME_M = 6; // frame margin left/right/top around the art window
const ART_W = TILE_W - FRAME_M * 2; // 120
const ART_H = 92;
const ART_TOP = -TILE_H / 2 + FRAME_M; // -67
const ART_CY = ART_TOP + ART_H / 2; // -21 — art window center; art spans [-67, +25]

// Name strip directly below the art.
const NAME_H = 22;
const NAME_CY = ART_CY + ART_H / 2 + 2 + NAME_H / 2; // +38 — name spans [+27, +49]

// P/T stats row directly below the name, fully clear of it and fully inside
// the tile: 21px plate centered at +61.5 → spans [+51, +72], within ±73.
const PT_H = 21;
const PT_CY = NAME_CY + NAME_H / 2 + 2 + PT_H / 2; // +61.5

/** Border accent per color identity (mirrors the CardFrameFactory palette family). */
const EDGE_COLORS: Record<string, number> = {
  W: 0xbfae7a,
  U: 0x4f7db3,
  B: 0x7c6899,
  R: 0xb3624a,
  G: 0x5d9367,
  gold: 0xc9a227,
  C: 0x8a8f98,
};

export type BoardHighlight =
  | 'none'
  | 'legalTarget'
  | 'selectedAttacker'
  | 'attacking'
  | 'blocking'
  | 'pendingBlocker'
  | 'eligible';

/** Bright border color per state (art tints below keep today's softer hues). */
const BORDER_COLORS: Record<Exclude<BoardHighlight, 'none'>, number> = {
  legalTarget: 0x6ee87d,
  selectedAttacker: 0xff8a6a,
  attacking: 0xffb09a,
  blocking: 0x7fb0ff,
  pendingBlocker: 0x5a9aff,
  eligible: 0xffe28a,
};

/** Same tint values the old full-card battlefield rendering used. */
const ART_TINTS: Record<Exclude<BoardHighlight, 'none'>, number> = {
  legalTarget: 0xa8f0b0,
  selectedAttacker: 0xffb0a0,
  attacking: 0xffc0b0,
  blocking: 0xa0c8ff,
  pendingBlocker: 0x80b0ff,
  eligible: 0xfff2c0,
};

export type StatsMood = 'normal' | 'damaged' | 'buffed' | 'weakened';

const STATS_COLORS: Record<StatsMood, string> = {
  normal: '#241d10',
  damaged: '#a03000',
  buffed: '#1d6b2f',
  weakened: '#8a1f1f',
};

/** Slight dim on a summoning-sick creature's art so it reads as "dormant". */
const SICK_ART_ALPHA = 0.6;
const SICK_TEX = 'board-sick-swirl';

/**
 * Bake the summoning-sickness badge once per texture manager: a moonlight
 * spiral (the "dizzy / not-yet-awake" swirl, the same visual language other
 * card games use for summoning sickness) on a translucent dark disc so it
 * reads over any card art. Idempotent — guarded by textures.exists, so every
 * tile after the first reuses the cached texture.
 */
function ensureSickTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SICK_TEX)) return;
  const S = 48;
  const tex = scene.textures.createCanvas(SICK_TEX, S, S)!;
  const ctx = tex.getContext();
  const c = S / 2;
  // Translucent dark disc backing (so the light spiral survives on bright art).
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(18,14,30,0.72)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(190,210,255,0.6)';
  ctx.stroke();
  // Moonlight spiral: ~2.4 turns growing from the center outward.
  ctx.strokeStyle = '#dbe8ff';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const turns = 2.4;
  const maxR = c - 9;
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const ang = f * turns * Math.PI * 2;
    const r = maxR * f;
    const x = c + r * Math.cos(ang);
    const y = c + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  tex.refresh();
}

export class BoardCardView extends Phaser.GameObjects.Container {
  readonly card: CardDef;
  private art: Phaser.GameObjects.Image;
  private highlightRect: Phaser.GameObjects.Rectangle;
  private ptPlate: Phaser.GameObjects.Image;
  private ptText: Phaser.GameObjects.Text;
  private auraBadge: Phaser.GameObjects.Text;
  private sickIcon: Phaser.GameObjects.Image;
  private sick = false;
  private zone: Phaser.GameObjects.Zone | null = null;
  private tappedState = false;

  constructor(scene: Phaser.Scene, x: number, y: number, card: CardDef) {
    super(scene, x, y);
    this.card = card;

    const edge =
      card.colors.length >= 2
        ? EDGE_COLORS.gold
        : EDGE_COLORS[card.colors[0] ?? 'C'];

    // Base tile: dark plate with the color-identity edge border.
    const bg = scene.add
      .rectangle(0, 0, TILE_W, TILE_H, 0x0d0b16, 1)
      .setStrokeStyle(2, edge, 0.95);

    // Art: cover-crop the 4:5 source into the framed window, biased slightly
    // upward so faces (composition-locked near vertical center) stay in frame.
    const artRef = Art.resolver!.getArt(card.id);
    this.art = artRef.frameName
      ? scene.add.image(0, ART_CY, artRef.textureKey, artRef.frameName)
      : scene.add.image(0, ART_CY, artRef.textureKey);
    const srcW = this.art.frame.width;
    const srcH = this.art.frame.height;
    const scale = Math.max(ART_W / srcW, ART_H / srcH);
    const cropW = ART_W / scale;
    const cropH = ART_H / scale;
    this.art.setCrop((srcW - cropW) / 2, (srcH - cropH) * 0.38, cropW, cropH);
    this.art.setScale(scale);

    // Thin inner border drawn ON TOP of the art, so the frame reads even where
    // the illustration is bright and the art window never bleeds over the tile.
    const artBorder = scene.add
      .rectangle(0, ART_CY, ART_W, ART_H, 0x000000, 0)
      .setStrokeStyle(2, 0x1a1526, 0.95);

    const nameBg = scene.add.rectangle(0, NAME_CY, TILE_W - 4, NAME_H, 0x161226, 0.94);
    const nameText = scene.add
      .text(0, NAME_CY, card.name, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: '#e8e2f4',
        resolution: 2,
      })
      .setOrigin(0.5);
    nameText.setScale(Math.min(1, (TILE_W - 8) / Math.max(1, nameText.width)));

    this.ptPlate = scene.add.image(0, PT_CY, 'pt-plate').setDisplaySize(52, PT_H);
    this.ptText = scene.add
      .text(0, PT_CY - 1, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: STATS_COLORS.normal,
        resolution: 2,
      })
      .setOrigin(0.5);
    const isCreature = isType(card, 'creature');
    this.ptPlate.setVisible(isCreature);
    this.ptText.setVisible(isCreature);

    this.auraBadge = scene.add
      .text(-TILE_W / 2 + 3, -TILE_H / 2 + 3, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: '#ffd88a',
        backgroundColor: '#241c3e',
        padding: { x: 4, y: 1 },
        resolution: 2,
      })
      .setOrigin(0, 0)
      .setVisible(false);

    // Summoning-sickness badge: top-right corner of the art window, opposite
    // the aura badge (top-left) so they never collide. Hidden until set.
    ensureSickTexture(scene);
    this.sickIcon = scene.add
      .image(TILE_W / 2 - 14, ART_TOP + 14, SICK_TEX)
      .setDisplaySize(22, 22)
      .setVisible(false);

    this.highlightRect = scene.add
      .rectangle(0, 0, TILE_W + 6, TILE_H + 6, 0x000000, 0)
      .setStrokeStyle(3, 0xffffff, 1)
      .setVisible(false);

    this.add([
      bg,
      this.art,
      artBorder,
      nameBg,
      nameText,
      this.ptPlate,
      this.ptText,
      this.auraBadge,
      this.sickIcon,
      this.highlightRect,
    ]);
    this.setSize(TILE_W, TILE_H);
    scene.add.existing(this);
  }

  /** Effective P/T (toughness already minus marked damage). No-op for non-creatures. */
  setStats(power: number, toughnessLeft: number, mood: StatsMood): this {
    if (!this.ptText.visible) return this;
    this.ptText.setText(`${power}/${toughnessLeft}`).setColor(STATS_COLORS[mood]);
    return this;
  }

  /** Show a ✦N badge for auras attached to this permanent (0 hides it). */
  setAuraCount(n: number): this {
    this.auraBadge.setVisible(n > 0);
    if (n > 0) this.auraBadge.setText(`✦${n}`);
    return this;
  }

  /**
   * Mark this creature summoning-sick (entered this turn, no haste → can't
   * attack): show the swirl badge and slightly dim the art so it reads as
   * dormant. Art alpha is independent of the container alpha the enter/exit
   * tweens animate, and of the highlight tint, so the three compose cleanly.
   * Cheap early-out keeps the every-sync call a no-op when state is unchanged.
   */
  setSummoningSick(sick: boolean): this {
    if (this.sick === sick) return this;
    this.sick = sick;
    this.sickIcon.setVisible(sick);
    this.art.setAlpha(sick ? SICK_ART_ALPHA : 1);
    return this;
  }

  setHighlight(kind: BoardHighlight): this {
    if (kind === 'none') {
      this.highlightRect.setVisible(false);
      this.art.clearTint();
    } else {
      this.highlightRect.setVisible(true).setStrokeStyle(3, BORDER_COLORS[kind], 1);
      this.art.setTint(ART_TINTS[kind]);
    }
    return this;
  }

  setTapped(tapped: boolean, animate = true): void {
    if (this.tappedState === tapped) return;
    this.tappedState = tapped;
    const target = tapped ? 90 : 0;
    if (animate) {
      this.scene.tweens.add({ targets: this, angle: target, duration: 180, ease: 'Cubic.easeOut' });
    } else {
      this.setAngle(target);
    }
  }

  /**
   * Clickable via an invisible Zone child (full world transform, so the hit
   * rect tracks the container's scale). Pointer events re-emit on this view
   * with the Pointer threaded through — consumers can check mouse buttons.
   */
  enableInput(): this {
    if (!this.zone) {
      this.zone = this.scene.add.zone(0, 0, TILE_W, TILE_H);
      this.add(this.zone);
      this.zone.setInteractive({ useHandCursor: true });
      for (const ev of ['pointerup', 'pointerdown', 'pointerover', 'pointerout']) {
        this.zone.on(
          ev,
          (
            p: Phaser.Input.Pointer,
            lx: number,
            ly: number,
            e: Phaser.Types.Input.EventData,
          ) => this.emit(ev, p, lx, ly, e),
        );
      }
    } else {
      this.zone.setInteractive({ useHandCursor: true });
    }
    return this;
  }

  disableInput(): this {
    this.zone?.disableInteractive();
    return this;
  }

  /** The interactive Zone child — hand this to ModalGuard (it disables by `input`). */
  get inputZone(): Phaser.GameObjects.Zone | null {
    return this.zone;
  }

  destroy(fromScene?: boolean): void {
    this.zone = null; // Container.destroy destroys the child zone itself
    super.destroy(fromScene);
  }
}
