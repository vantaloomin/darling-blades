import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import type { CardDef, Keyword, Rarity } from '../engine/types';
import { isType } from '../engine/types';
import type { CardVariant } from '../meta/variants';
import { applyHolo, type HoloHandle } from './fx/HoloEffects';
import { KEYWORD_ICON_KEY } from './KeywordIcons';
import { theme } from './theme';

/**
 * Compact battlefield tile for the duel board: a large portrait art window that
 * fills the tile, with the name + P/T + state badges OVERLAID on it (minion
 * style). Deliberately NOT a CardView — battlefield cards don't need
 * (unreadably tiny) rules text; a click/hover away, the inspect overlay and
 * zoom preview show the full card. Center origin, rotation-friendly for taps,
 * same Zone-child input pattern as CardView (never setInteractive a scaled
 * Container — playbook §11).
 *
 * The art window is portrait-tall (fills the tile inside a thin frame margin)
 * so a 4:5 source shows ~89% of the character rather than a cropped landscape
 * band, the tile border is the card's RARITY colour, and the player's own
 * special-variant cards carry their holo finish over the art (setVariant,
 * fxPolicy-gated). P/T lives in a bottom-right badge, the name in a legibility
 * scrim along the top.
 */

export const TILE_W = 132;
export const TILE_H = 146;

const FRAME_M = 4; // frame margin around the art window
const ART_W = TILE_W - FRAME_M * 2; // 124
const ART_H = TILE_H - FRAME_M * 2; // 138 — near-square window; a 4:5 source shows ~89% of its height
const ART_CY = 0; // the window is the whole tile, so it is centred

/** Art bounds in container-local space — fed to applyHolo for the finish overlay. */
const ART_RECT = { x: -ART_W / 2, y: -ART_H / 2, w: ART_W, h: ART_H };

// Name legibility scrim + text along the top of the art.
const NAME_CY = -50;
const NAME_H = 22;
// P/T badge, bottom-right corner, overlaid on the art.
const PT_W = 40;
const PT_H = 20;
const PT_CX = TILE_W / 2 - FRAME_M - PT_W / 2; // +42
const PT_CY = TILE_H / 2 - FRAME_M - PT_H / 2; // +59
const TRAIT_SIZE = 16;
const TRAIT_GAP = 2;
const TRAIT_INSET = 4;

/**
 * Tile border per RARITY tier (echoes the CardView RARITY_RING / gem palette):
 * grey c, silver r, gold sr, violet ssr, crimson ur. Colour identity still
 * reads from the art's own frame; targeting/combat states override this via the
 * highlight rect below.
 */
const RARITY_BORDER: Record<Rarity, number> = {
  c: 0x8a8f98,
  r: 0xcdd7e8,
  sr: 0xf1c96a,
  ssr: 0xc98bff,
  ur: 0xff7a6b,
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
  private keywordIcons: Phaser.GameObjects.Image[] = [];
  private keywordOverflow: Phaser.GameObjects.Text | null = null;
  private sickIcon: Phaser.GameObjects.Image;
  private holo: HoloHandle | null = null;
  private holoFinish: CardVariant['holo'] | null = null;
  private sick = false;
  private zone: Phaser.GameObjects.Zone | null = null;
  private tappedState = false;

  constructor(scene: Phaser.Scene, x: number, y: number, card: CardDef) {
    super(scene, x, y);
    this.card = card;

    // Base tile: dark plate with the RARITY-tier border.
    const bg = scene.add
      .rectangle(0, 0, TILE_W, TILE_H, 0x0d0b16, 1)
      .setStrokeStyle(2, RARITY_BORDER[card.rarity], 0.95);

    // Art: cover-crop the 4:5 source into the tall window, biased slightly
    // upward so faces (composition-locked near vertical center) stay in frame.
    // The window is near-square, so the crop keeps ~89% of the source height.
    const artRef = Art.resolver!.getArt(card.id);
    this.art = artRef.frameName
      ? scene.add.image(0, ART_CY, artRef.textureKey, artRef.frameName)
      : scene.add.image(0, ART_CY, artRef.textureKey);
    const srcW = this.art.frame.width;
    const srcH = this.art.frame.height;
    const scale = Math.max(ART_W / srcW, ART_H / srcH);
    const cropW = ART_W / scale;
    const cropH = ART_H / scale;
    this.art.setCrop((srcW - cropW) / 2, (srcH - cropH) * 0.3, cropW, cropH);
    this.art.setScale(scale);

    // Thin inner border drawn ON TOP of the art, so the frame reads even where
    // the illustration is bright and the art window never bleeds over the tile.
    const artBorder = scene.add
      .rectangle(0, ART_CY, ART_W, ART_H, 0x000000, 0)
      .setStrokeStyle(2, 0x1a1526, 0.95);

    // Name legibility scrim along the top, then the name centered within it —
    // capped in width so it clears the trait column at top-left and the
    // summoning-sick swirl at top-right, which draw over the scrim.
    const nameScrim = scene.add.rectangle(0, NAME_CY, ART_W, NAME_H, 0x0d0b16, 0.62);
    const nameText = scene.add
      .text(0, NAME_CY, card.name, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: '#e8e2f4',
        resolution: 2,
      })
      .setOrigin(0.5);
    nameText.setScale(Math.min(1, (ART_W - 46) / Math.max(1, nameText.width)));

    this.ptPlate = scene.add.image(PT_CX, PT_CY, 'pt-plate').setDisplaySize(PT_W, PT_H);
    this.ptText = scene.add
      .text(PT_CX, PT_CY - 1, '', {
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
      .text(-TILE_W / 2 + 3, TILE_H / 2 - 3, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: theme.colors.gold,
        backgroundColor: theme.colors.rowFill,
        padding: { x: 4, y: 1 },
        resolution: 2,
      })
      .setOrigin(0, 1)
      .setVisible(false);

    // Summoning-sickness badge: top-right corner of the art window, opposite
    // the trait column. Hidden until set.
    ensureSickTexture(scene);
    this.sickIcon = scene.add
      .image(TILE_W / 2 - 14, -TILE_H / 2 + 14, SICK_TEX)
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
      nameScrim,
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

  /** Effective P/T (defense already minus marked damage). No-op for non-creatures. */
  setStats(attack: number, defenseLeft: number, mood: StatsMood): this {
    if (!this.ptText.visible) return this;
    this.ptText.setText(`${attack}/${defenseLeft}`).setColor(STATS_COLORS[mood]);
    return this;
  }

  /** Show a ✦N badge for auras attached to this permanent (0 hides it). */
  setAuraCount(n: number): this {
    this.auraBadge.setVisible(n > 0);
    if (n > 0) this.auraBadge.setText(`✦${n}`);
    return this;
  }

  /** Render effective keywords as a top-left column; granted aura traits included. */
  setKeywords(keywords: ReadonlySet<Keyword>): this {
    for (const icon of this.keywordIcons) icon.destroy();
    this.keywordIcons = [];
    this.keywordOverflow?.destroy();
    this.keywordOverflow = null;
    const traits = [...keywords];
    const visible = traits.length > 4 ? traits.slice(0, 3) : traits;
    const x = -TILE_W / 2 + TRAIT_INSET + TRAIT_SIZE / 2;
    const y0 = -TILE_H / 2 + TRAIT_INSET + TRAIT_SIZE / 2;
    visible.forEach((keyword, index) => {
      const icon = this.scene.add
        .image(x, y0 + index * (TRAIT_SIZE + TRAIT_GAP), KEYWORD_ICON_KEY[keyword])
        .setDisplaySize(TRAIT_SIZE, TRAIT_SIZE);
      this.keywordIcons.push(icon);
      this.add(icon);
    });
    if (traits.length > 4) {
      this.keywordOverflow = this.scene.add
        .text(-TILE_W / 2 + TRAIT_INSET, y0 + 3 * (TRAIT_SIZE + TRAIT_GAP), `+${traits.length - 3}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          backgroundColor: theme.colors.rowFill,
          padding: { x: 2, y: 1 },
          resolution: 2,
        })
        .setOrigin(0, 0.5);
      this.add(this.keywordOverflow);
    }
    return this;
  }

  /**
   * Render the played card's holo finish over the art (the player's OWN
   * special-variant permanents — the board doesn't know cosmetics, so DuelScene
   * passes the best owned variant for HUMAN tiles and null otherwise). A no-op
   * for plain finishes; idempotent per finish so the every-sync call is cheap;
   * fxPolicy-gated inside applyHolo (lite tiers degrade). Reuses the CardView
   * holo machinery over this tile's art rect.
   */
  setVariant(variant: CardVariant | null): this {
    const finish = variant && variant.holo !== 'none' ? variant.holo : null;
    if (finish === this.holoFinish) return this;
    this.holoFinish = finish;
    this.holo?.destroy();
    this.holo = null;
    if (finish) this.holo = applyHolo(this.scene, this, this.art, finish, ART_RECT);
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
    this.holo?.destroy();
    this.holo = null;
    this.zone = null; // Container.destroy destroys the child zone itself
    super.destroy(fromScene);
  }
}
