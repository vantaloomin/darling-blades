import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { holdArt } from '../art/artWatch';
import type { CardDef, Keyword, Rarity } from '../engine/types';
import { isType } from '../engine/types';
import type { CardVariant } from '../meta/variants';
import { applyHolo, type HoloHandle } from './fx/HoloEffects';
import {
  CUE_MIN_SCREEN_PX, awakeningRingVisible, cueCounterScale, cueColour, cueIn, pickBadgeLabel, sickSwirlBounds, statsCue, tileChipBounds,
  type BoardCueState, type CueContext, type StatsCueInput, type StatsTone,
} from './boardCuePresentation';
import { currentAccessibility } from './accessibility';
import { KEYWORD_ICON_KEY, MECHANIC_ICON_KEY } from './KeywordIcons';
import { ensureNumeralBadgeInk, INTER_FIGURE_HEIGHT, isNumeralLabel } from './NumeralGlyphs';
import { colorInt, theme } from './theme';

/** Chapter numerals for the Quest badge (chapters ship 2-3 deep; 5 is headroom). */
const ROMAN_CHAPTERS = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

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
 * so a 4:5 source shows ~88% of the character rather than a cropped landscape
 * band, the tile border is the card's RARITY colour, and the player's own
 * special-variant cards carry their holo finish over the art (setVariant,
 * fxPolicy-gated). P/T lives in a bottom-right badge, the name in a legibility
 * scrim along the top.
 */

export const TILE_W = 156;
export const TILE_H = 170;

const FRAME_M = 4; // frame margin around the art window
const ART_W = TILE_W - FRAME_M * 2; // 148
const ART_H = TILE_H - FRAME_M * 2; // 162 — a 4:5 source shows ~88% of its height
const ART_CY = 0; // the window is the whole tile, so it is centred

/** Art bounds in container-local space — fed to applyHolo for the finish overlay. */
const ART_RECT = { x: -ART_W / 2, y: -ART_H / 2, w: ART_W, h: ART_H };

// Name legibility scrim + text along the top of the art.
const NAME_H = 22;
const NAME_CY = -TILE_H / 2 + FRAME_M + 8 + NAME_H / 2;
// P/T badge, bottom-right corner, overlaid on the art.
const PT_W = 40;
const PT_H = 20;
const PT_CX = TILE_W / 2 - FRAME_M - PT_W / 2;
const PT_CY = TILE_H / 2 - FRAME_M - PT_H / 2;
const TRAIT_SIZE = 16;
const TRAIT_GAP = 2;
const TRAIT_INSET = 4;
// Overcharge badge (1.9 A1.7): the right edge at mid-height (TILE_FEATURES'
// `rightEdge`), clear of the swirl above and the P/T plate below. Its parts
// are in badge-local design pixels; the badge counter-scales as a whole.
const OVERCHARGE_ICON = 14;
const OVERCHARGE_PAD_X = 3;
const OVERCHARGE_PAD_Y = 2;
const OVERCHARGE_GAP = 2;
// Spent Provoked badge (1.9 A2.a): the left edge just below mid-height
// (TILE_FEATURES' `leftEdge`), mirroring the Overcharge badge. Low enough that
// its counter-scaled plate on a packed row stays clear of the keyword column's
// fourth row, high enough to clear the aura badge in the corner. It draws the
// Provoked glyph, receded, with a slash through it: spent, not absent. Its
// parts are in badge-local design pixels; the badge counter-scales as a whole.
const PROVOKED_ICON = CUE_MIN_SCREEN_PX.provokedSpentBadge;
const PROVOKED_PAD = 3;
const PROVOKED_CY = 18;

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
  | 'legalTargetOpponent'
  | 'selectedAttacker'
  | 'selectedSacrifice'
  | 'attacking'
  | 'blocking'
  | 'pendingBlocker'
  | 'eligible';

/** Same tint values the old full-card battlefield rendering used. */
const ART_TINTS: Record<Exclude<BoardHighlight, 'none'>, number> = {
  legalTarget: 0xa8f0b0,
  get legalTargetOpponent() { return colorInt(theme.colors.danger); },
  selectedAttacker: 0xffb0a0,
  selectedSacrifice: 0xe4c6ff,
  attacking: 0xffc0b0,
  blocking: 0xa0c8ff,
  pendingBlocker: 0x80b0ff,
  eligible: 0xfff2c0,
};

/** Legacy preview callers may still supply a mood; live tiles supply all facts. */
export type StatsMood = StatsTone;

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
  private actionBadge: Phaser.GameObjects.Text;
  private pickBadge: Phaser.GameObjects.Container;
  private pickText: Phaser.GameObjects.Text;
  /** A one-pick badge's vector digits (repeated picks "1, 2" use pickText). */
  private pickDigits: Phaser.GameObjects.Image;
  private pickPlate: Phaser.GameObjects.Arc;
  private focusBrackets: Phaser.GameObjects.Graphics;
  private statsGlyphs: Phaser.GameObjects.Graphics;
  private markBadge: Phaser.GameObjects.Text;
  private keywordIcons: Phaser.GameObjects.Image[] = [];
  private keywordOverflow: Phaser.GameObjects.Text | null = null;
  private sickIcon: Phaser.GameObjects.Image;
  private chapterBadge: Phaser.GameObjects.Text;
  private overchargeBadge: Phaser.GameObjects.Container;
  private overchargePlate: Phaser.GameObjects.Graphics;
  private overchargeIcon: Phaser.GameObjects.Image;
  private overchargeText: Phaser.GameObjects.Text;
  private overchargeCount = 0;
  private provokedBadge: Phaser.GameObjects.Container;
  private awakenedRect: Phaser.GameObjects.Rectangle;
  private hauntlinkBrokenMark: Phaser.GameObjects.Graphics;
  private chapterLabel: string | null = null;
  private awakenedState = false;
  private cueContext: CueContext = 'idle';
  private holo: HoloHandle | null = null;
  private holoFinish: CardVariant['holo'] | null = null;
  private sick = false;
  private zone: Phaser.GameObjects.Zone | null = null;
  private tappedState = false;
  /** Ends the tile's hold on its art (`holdArt`): the lease, the arrival wait and the removal belt. */
  private cancelArtWait: (() => void) | null = null;
  /** The better art texture this tile drew a stand-in (or the half texture) for, if any. */
  private artPendingKey: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, card: CardDef) {
    super(scene, x, y);
    this.card = card;

    // Base tile: dark plate with the RARITY-tier border.
    const bg = scene.add
      .rectangle(0, 0, TILE_W, TILE_H, 0x0d0b16, 1)
      .setStrokeStyle(2, RARITY_BORDER[card.rarity], 0.95);

    // Art: cover-cropped into the tall window by applyArt, which also redraws
    // it if the file was still streaming in when this tile was built.
    this.art = scene.add.image(0, ART_CY, '__WHITE');
    this.applyArt();

    // Thin inner border drawn ON TOP of the art, so the frame reads even where
    // the illustration is bright and the art window never bleeds over the tile.
    const artBorder = scene.add
      .rectangle(0, ART_CY, ART_W, ART_H, 0x000000, 0)
      .setStrokeStyle(2, 0x1a1526, 0.95);

    // Name legibility scrim along the top, then the name centered within it —
    // capped in width so it clears the trait column at top-left and the
    // summoning-sick swirl at top-right, which draw over the scrim.
    const nameScrim = scene.add.rectangle(0, NAME_CY, ART_W, NAME_H, 0x0d0b16, theme.alpha.scrim);
    const nameText = scene.add
      .text(0, NAME_CY, card.name, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: '#e8e2f4',
        resolution: 2,
      })
      .setOrigin(0.5);
    // Names render at one fixed size everywhere; overlong ones truncate with an
    // ellipsis instead of shrinking (user-directed 2026-07-10 — mixed sizes
    // read worse than clipped names).
    const nameMaxW = ART_W - 46;
    if (nameText.width > nameMaxW) {
      let keep = Math.max(1, Math.floor((card.name.length * nameMaxW) / nameText.width) - 1);
      nameText.setText(`${card.name.slice(0, keep).trimEnd()}…`);
      while (keep > 1 && nameText.width > nameMaxW) {
        keep -= 1;
        nameText.setText(`${card.name.slice(0, keep).trimEnd()}…`);
      }
    }

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

    this.actionBadge = scene.add
      .text(0, -TILE_H / 2, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '10px',
        fontStyle: '700',
        color: '#241d10',
        backgroundColor: theme.colors.gold,
        padding: { x: 4, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setName('board-action-tab')
      .setVisible(false);

    this.pickPlate = scene.add.circle(0, 0, CUE_MIN_SCREEN_PX.pickBadge / 2, colorInt(theme.colors.gold))
      .setStrokeStyle(2, colorInt(theme.colors.onGold));
    this.pickText = scene.add.text(0, 0, '', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.typeBase.caption}px`, fontStyle: theme.weight.w700,
      color: theme.colors.onGold, resolution: 2,
    }).setOrigin(0.5);
    this.pickDigits = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.pickBadge = scene.add.container(0, 0, [this.pickPlate, this.pickText, this.pickDigits])
      .setName('board-pick-badge').setVisible(false);
    this.focusBrackets = scene.add.graphics().setName('board-focus-brackets').setVisible(false);
    this.statsGlyphs = scene.add.graphics().setPosition(PT_CX + PT_W / 2, PT_CY - PT_H / 2 - 4)
      .setName('board-stats-glyphs').setVisible(false);
    this.markBadge = scene.add.text(0, TILE_H / 2 - FRAME_M, '', {
      fontFamily: theme.fonts.ui, fontSize: `${CUE_MIN_SCREEN_PX.markBadge}px`, fontStyle: theme.weight.w700,
      color: theme.colors.gold, backgroundColor: theme.colors.rowFill, padding: { x: 2, y: 1 }, resolution: 2,
    }).setOrigin(0.5, 1).setName('board-mark-badge').setVisible(false);

    // Summoning-sickness badge: top-right corner of the art window, opposite
    // the trait column. Hidden until set.
    ensureSickTexture(scene);
    const sickBounds = sickSwirlBounds(TILE_W, TILE_H);
    this.sickIcon = scene.add
      .image(sickBounds.x + sickBounds.width / 2, sickBounds.y + sickBounds.height / 2, SICK_TEX)
      .setDisplaySize(sickBounds.width, sickBounds.height)
      .setName('board-sick-swirl')
      .setVisible(false);

    // Quest chapter badge: bottom-right corner, mirroring the aura badge's
    // corner-plate look on the opposite side. Hidden until a Quest sets it.
    this.chapterBadge = scene.add
      .text(TILE_W / 2 - 3, TILE_H / 2 - 3, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: theme.colors.gold,
        backgroundColor: theme.colors.rowFill,
        padding: { x: 4, y: 1 },
        resolution: 2,
      })
      .setOrigin(1, 1)
      .setVisible(false);

    // Overcharge badge: the cell glyph and a count on one plate, gold-rimmed
    // so it never reads as a keyword chip. Not the Mark badge: Overcharge is
    // not a Mark. Hidden until setOvercharge gives it a count.
    this.overchargePlate = scene.add.graphics();
    this.overchargeIcon = scene.add
      .image(0, 0, MECHANIC_ICON_KEY.overcharge)
      .setDisplaySize(OVERCHARGE_ICON, OVERCHARGE_ICON);
    this.overchargeText = scene.add
      .text(-OVERCHARGE_PAD_X, 0, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${CUE_MIN_SCREEN_PX.overchargeBadge}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(1, 0.5);
    this.overchargeBadge = scene.add
      .container(TILE_W / 2 - FRAME_M, 0, [this.overchargePlate, this.overchargeIcon, this.overchargeText])
      .setVisible(false);

    // Spent Provoked badge: the Provoked glyph at the subtle alpha with a
    // slash across it, on the same rowFill plate as the Overcharge badge (a
    // muted rim, not gold: it records a spent trigger, not a gain). Hidden
    // until setProvokedSpent shows it.
    const provokedSide = PROVOKED_ICON + PROVOKED_PAD * 2;
    const provokedPlate = scene.add.graphics();
    provokedPlate.fillStyle(colorInt(theme.colors.rowFill), 0.92);
    provokedPlate.fillRoundedRect(0, -provokedSide / 2, provokedSide, provokedSide, 4);
    provokedPlate.lineStyle(1, colorInt(theme.colors.muted), 0.9);
    provokedPlate.strokeRoundedRect(0, -provokedSide / 2, provokedSide, provokedSide, 4);
    const provokedIcon = scene.add
      .image(provokedSide / 2, 0, MECHANIC_ICON_KEY.provoked)
      .setDisplaySize(PROVOKED_ICON, PROVOKED_ICON)
      .setAlpha(theme.alpha.subtle);
    const provokedSlash = scene.add.graphics();
    provokedSlash.lineStyle(2, colorInt(theme.colors.heading), 0.95);
    provokedSlash.lineBetween(provokedSide - PROVOKED_PAD, -provokedSide / 2 + PROVOKED_PAD, PROVOKED_PAD, provokedSide / 2 - PROVOKED_PAD);
    this.provokedBadge = scene.add
      .container(-TILE_W / 2 + FRAME_M, PROVOKED_CY, [provokedPlate, provokedIcon, provokedSlash])
      .setVisible(false);

    // Champion Awakening: its persistent state survives target choices, but
    // the ring yields there so only legal targets have a perimeter ring.
    this.awakenedRect = scene.add
      .rectangle(0, 0, TILE_W + 4, TILE_H + 4, 0x000000, 0)
      .setStrokeStyle(2, colorInt(theme.colors.gold), 0.95)
      .setName('board-awakening-ring')
      .setVisible(false);

    // A brief, distinct severed-link mark. DuelScene holds this state between
    // the hauntlinkBroken and died events, then fades the departing card.
    this.hauntlinkBrokenMark = scene.add.graphics().setVisible(false);
    this.hauntlinkBrokenMark.lineStyle(3, colorInt(theme.colors.dangerArmed), 0.95);
    this.hauntlinkBrokenMark.lineBetween(-TILE_W / 2 + 8, -TILE_H / 2 + 8, TILE_W / 2 - 8, TILE_H / 2 - 8);
    this.hauntlinkBrokenMark.lineBetween(TILE_W / 2 - 8, -TILE_H / 2 + 8, -TILE_W / 2 + 8, TILE_H / 2 - 8);

    this.highlightRect = scene.add
      .rectangle(0, 0, TILE_W + 6, TILE_H + 6, 0x000000, 0)
      .setStrokeStyle(3, 0xffffff, 1)
      .setName('board-state-ring')
      .setVisible(false);

    this.add([
      bg,
      this.art,
      artBorder,
      nameScrim,
      nameText,
      this.ptPlate,
      this.ptText,
      this.statsGlyphs,
      this.markBadge,
      this.auraBadge,
      this.chapterBadge,
      this.overchargeBadge,
      this.provokedBadge,
      this.sickIcon,
      this.awakenedRect,
      this.hauntlinkBrokenMark,
      this.highlightRect,
      // A top-edge tab crosses the rim. Draw its opaque plate and glyphs
      // after the rings so the upper letters cannot be painted over.
      this.actionBadge,
      this.pickBadge,
      this.focusBrackets,
    ]);
    // Operational badges participate in glyph/mask checks even though the
    // underlying card name and P/T retain their fixed card-face geometry.
    for (const text of [this.actionBadge, this.pickText, this.markBadge,
      this.auraBadge, this.chapterBadge, this.overchargeText]) {
      text.setData('a11yCueText', true).setData('a11yKeepVisible', true);
    }
    this.setSize(TILE_W, TILE_H);
    scene.add.existing(this);
  }

  /** Effective P/T (defense already minus marked damage). No-op for non-creatures. */
  setStats(attack: number, defenseLeft: number, input: StatsCueInput | StatsMood, tileScale = 1): this {
    if (!this.ptText.visible) return this;
    const cue = typeof input === 'string' ? null : statsCue(input);
    const tone = cue?.tone ?? (typeof input === 'string' ? input : 'normal');
    this.ptText.setText(`${attack}/${defenseLeft}`).setColor(STATS_COLORS[tone]);
    this.setData('a11yStatsCue', cue);
    this.statsGlyphs.clear().setVisible(cue !== null && cue.glyphs.length > 0).setScale(cueCounterScale(tileScale));
    this.markBadge.setVisible(cue !== null && cue.markBadge !== null);
    if (!cue) return this;
    if (cue.markBadge !== null) {
      this.markBadge.setText(`+${cue.markBadge}`).setScale(cueCounterScale(tileScale));
      this.markBadge.setColor(theme.colors.gold).setBackgroundColor(theme.colors.rowFill);
    }
    const size = CUE_MIN_SCREEN_PX.statGlyph, gap = 4, pad = 3;
    const width = cue.glyphs.length * size + Math.max(0, cue.glyphs.length - 1) * gap + pad * 2;
    this.statsGlyphs.fillStyle(colorInt(theme.colors.rowFill), 1);
    this.statsGlyphs.fillRoundedRect(-width, -size - pad * 2, width, size + pad * 2, 3);
    cue.glyphs.forEach((glyph, index) => {
      const x = -width + pad + index * (size + gap), y = -size - pad;
      this.statsGlyphs.lineStyle(2, colorInt(glyph === 'damage' || glyph === 'lowered' ? theme.colors.dangerArmed : theme.colors.success), 1);
      if (glyph === 'damage') this.statsGlyphs.lineBetween(x + 2, y + size, x + size - 2, y);
      else {
        const end = glyph === 'raised' ? y + size * 0.75 : y + size * 0.25;
        const tip = glyph === 'raised' ? y + size * 0.25 : y + size * 0.75;
        this.statsGlyphs.beginPath().moveTo(x, end).lineTo(x + size / 2, tip).lineTo(x + size, end).strokePath();
      }
    });
    return this;
  }

  /** Show a ✦N badge for auras attached to this permanent (0 hides it). */
  setAuraCount(n: number): this {
    this.auraBadge.setVisible(n > 0);
    if (n > 0) this.auraBadge.setText(`✦${n}`);
    return this;
  }

  /**
   * Small top-edge action chip ("Link", "Relink", "Duty"): what a tap on this
   * permanent does right now. `tileScale` is the scale the tile is displayed
   * at; the chip counter-scales so it keeps its 10px type on shrunken tiles
   * (the 0.55 permanent band, where Duty artifacts live, and tucked links),
   * where it would otherwise print at 5-6px.
   */
  setActionLabel(label: string | null, tileScale = 1): this {
    this.actionBadge.setVisible(label !== null);
    if (label !== null) {
      this.actionBadge.setText(label);
      this.actionBadge.setScale(cueCounterScale(tileScale));
      const bounds = tileChipBounds(TILE_W, TILE_H, this.actionBadge.width, this.actionBadge.height, tileScale);
      this.actionBadge.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      this.actionBadge.setData('a11yChipBounds', bounds);
    }
    this.setData('a11yChip', label);
    return this;
  }

  /** Every picked target carries its 1-based order, including a lone pick. */
  setPickBadge(pickIndex: number | readonly number[] | null, tileScale = 1): this {
    const label = pickBadgeLabel(pickIndex);
    this.pickBadge.setVisible(label !== null).setScale(cueCounterScale(tileScale));
    if (label !== null) {
      let radius: number;
      if (isNumeralLabel(label)) {
        const ink = ensureNumeralBadgeInk(this.scene, Number(label), theme.colors.onGold,
          theme.typeBase.caption * INTER_FIGURE_HEIGHT, CUE_MIN_SCREEN_PX.pickBadge);
        this.pickText.setText('').setVisible(false);
        this.pickDigits.setTexture(ink.texture).setDisplaySize(ink.diameter, ink.diameter)
          .setData('a11yNumeral', label).setVisible(true);
        radius = ink.diameter / 2;
      } else {
        this.pickDigits.setVisible(false).setData('a11yNumeral', null);
        this.pickText.setText(label).setColor(theme.colors.onGold).setVisible(true);
        radius = Math.max(CUE_MIN_SCREEN_PX.pickBadge / 2, this.pickText.width / 2 + 4);
      }
      this.pickPlate.setRadius(radius);
      this.pickPlate.setFillStyle(colorInt(theme.colors.gold)).setStrokeStyle(2, colorInt(theme.colors.onGold));
    }
    this.setData('a11yPickBadge', label);
    return this;
  }

  /** Focus is brackets over the state's ring, never another state's hue. */
  setKeyboardFocus(focused: boolean): this {
    const show = focused && cueIn('keyboardFocus', 'targeting')?.focusBrackets === true;
    this.focusBrackets.clear().setVisible(show);
    if (show) {
      const halfW = TILE_W / 2 + 8, halfH = TILE_H / 2 + 8, length = 13;
      this.focusBrackets.lineStyle(theme.outline.focus, colorInt(theme.colors.heading), 1);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        this.focusBrackets.beginPath().moveTo(sx * (halfW - length), sy * halfH)
          .lineTo(sx * halfW, sy * halfH).lineTo(sx * halfW, sy * (halfH - length)).strokePath();
      }
    }
    this.setData('a11yKeyboardFocus', show);
    return this;
  }

  /**
   * Show the Overcharge badge with its count (0 hides it). Creatures only.
   * Like the action chip it counter-scales on a shrunken tile (the board's
   * `scale`), so the count keeps its 11px type on screen.
   */
  setOvercharge(count: number, tileScale: number): this {
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const show = n > 0 && this.ptText.visible;
    this.overchargeBadge.setVisible(show);
    if (!show) return this;
    this.overchargeBadge.setScale(cueCounterScale(tileScale));
    if (n === this.overchargeCount) return this;
    this.overchargeCount = n;
    this.overchargeText.setText(String(n));
    const h = Math.max(OVERCHARGE_ICON, this.overchargeText.height) + OVERCHARGE_PAD_Y * 2;
    const w = OVERCHARGE_PAD_X * 2 + OVERCHARGE_ICON + OVERCHARGE_GAP + this.overchargeText.width;
    this.overchargeIcon.setPosition(-w + OVERCHARGE_PAD_X + OVERCHARGE_ICON / 2, 0);
    this.overchargePlate.clear();
    this.overchargePlate.fillStyle(colorInt(theme.colors.rowFill), 0.92);
    this.overchargePlate.fillRoundedRect(-w, -h / 2, w, h, 4);
    this.overchargePlate.lineStyle(1, colorInt(theme.colors.gold), 0.9);
    this.overchargePlate.strokeRoundedRect(-w, -h / 2, w, h, 4);
    return this;
  }

  /**
   * Show that this creature's Provoked has fired this turn (`provokedSpent` in
   * boardCuePresentation). Creatures only. Counter-scales on a shrunken tile
   * like the Overcharge badge, so the glyph keeps its size on screen.
   */
  setProvokedSpent(spent: boolean, tileScale: number): this {
    const show = spent && this.ptText.visible;
    this.provokedBadge.setVisible(show);
    if (show) this.provokedBadge.setScale(cueCounterScale(tileScale));
    return this;
  }

  /**
   * Quest progress: "II/III" in the bottom-right corner. Pass null to hide
   * (non-Quests). Chapter 0 means cast-but-not-yet-arrived states never
   * render; the engine stamps chapter 1 on arrival.
   */
  setChapter(chapter: number | null, total: number | null): this {
    const label = chapter && total ? `${ROMAN_CHAPTERS[chapter] ?? chapter}/${ROMAN_CHAPTERS[total] ?? total}` : null;
    if (label === this.chapterLabel) return this;
    this.chapterLabel = label;
    this.chapterBadge.setVisible(label !== null);
    if (label !== null) this.chapterBadge.setText(label);
    return this;
  }

  /** Champion Awakening's persistent gold ring; one-way in play, but the
   *  setter stays symmetric so view reuse across permanents cannot leak it. */
  setAwakened(awakened: boolean): this {
    if (this.awakenedState === awakened) return this;
    this.awakenedState = awakened;
    this.awakenedRect.setVisible(awakeningRingVisible(awakened, this.cueContext));
    return this;
  }

  /** Hauntlink-only break cue; normal board cards keep this hidden. */
  setHauntlinkBroken(broken: boolean): this {
    this.hauntlinkBrokenMark.setVisible(broken);
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
          fontSize: `${theme.typeBase.micro}px`,
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

  /** Ring policy is shared with the headless cue gate; the scene owns lift. */
  setCue(state: BoardCueState | null, context: CueContext): this {
    this.cueContext = context;
    this.awakenedRect.setVisible(awakeningRingVisible(this.awakenedState, context));
    const cue = state === null ? null : cueIn(state, context);
    this.setData('a11yCue', cue);
    if (!cue?.rim) {
      this.highlightRect.setVisible(false);
      this.art.clearTint();
    } else {
      this.highlightRect.setVisible(true).setStrokeStyle(theme.outline.state, colorInt(cueColour(cue.rim, currentAccessibility().highContrast)), 1);
      const tint: Partial<Record<BoardCueState, Exclude<BoardHighlight, 'none'>>> = {
        legalTarget: 'legalTarget', legalTargetOpponent: 'legalTargetOpponent', pickedTarget: 'selectedAttacker',
        selectedSacrifice: 'selectedSacrifice', eligibleAttacker: 'eligible', selectedAttacker: 'selectedAttacker',
        attacking: 'attacking', pendingBlocker: 'pendingBlocker', assignedBlocker: 'blocking', actionReady: 'eligible',
      };
      const kind = tint[cue.state];
      if (kind) this.art.setTint(ART_TINTS[kind]);
      else this.art.clearTint();
    }
    return this;
  }

  /** Brief event flashes and older previews still use the historical names. */
  setHighlight(kind: BoardHighlight): this {
    const cues: Record<Exclude<BoardHighlight, 'none'>, [BoardCueState, CueContext]> = {
      legalTarget: ['legalTarget', 'targeting'], legalTargetOpponent: ['legalTargetOpponent', 'targeting'],
      selectedAttacker: ['selectedAttacker', 'declareAttackers'], selectedSacrifice: ['selectedSacrifice', 'targeting'],
      attacking: ['attacking', 'idle'], blocking: ['assignedBlocker', 'declareBlockers'],
      pendingBlocker: ['pendingBlocker', 'declareBlockers'], eligible: ['actionReady', 'idle'],
    };
    return kind === 'none' ? this.setCue(null, 'idle') : this.setCue(...cues[kind]);
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
   * Cover-crop the card's 4:5 art into the tall window, biased slightly upward
   * so faces (composition-locked near vertical center) stay in frame. The
   * window is portrait-tall, so the crop keeps ~88% of the source height. If
   * the file has not streamed in yet the resolver answers with the best
   * resident texture (the half file on desktop while art streams through the
   * store) or the loading stand-in, and the tile redraws its art when the file
   * lands; tint, alpha and holo carry over untouched. The tile holds what it
   * draws (`holdArt`): a lease while art streams through the store, and a
   * redraw in the same tick if the drawn texture is removed.
   */
  private applyArt(): void {
    const artRef = Art.resolver!.getArt(this.card.id);
    if (artRef.frameName) this.art.setTexture(artRef.textureKey, artRef.frameName);
    else this.art.setTexture(artRef.textureKey);
    // Read back from the texture: the stand-in, the full file and the
    // half-resolution file are all 4:5 but not all the same size.
    const srcW = this.art.frame.width;
    const srcH = this.art.frame.height;
    const scale = Math.max(ART_W / srcW, ART_H / srcH);
    const cropW = ART_W / scale;
    const cropH = ART_H / scale;
    const cropY = (srcH - cropH) * 0.3;
    this.art.setCrop((srcW - cropW) / 2, cropY, cropW, cropH);
    this.art.setScale(scale);
    // setCrop shows the crop where it falls within the full-texture footprint —
    // it does NOT re-center. Shift the image so the cropped band lands centered
    // in the art window (without this the art rides high: it bleeds over the
    // top frame and leaves a dark band inside the bottom one).
    this.art.setY(ART_CY + scale * (srcH / 2 - cropY - cropH / 2));

    this.cancelArtWait?.();
    this.artPendingKey = artRef.pending ?? null;
    this.cancelArtWait = holdArt(this, artRef, () => {
      this.cancelArtWait = null;
      this.artPendingKey = null;
      if (this.art.active) this.applyArt();
    });
  }

  /**
   * The better art texture this tile is still waiting for, or null: what the
   * art probe's stand-in count reads (`window.__art.standIns()`), as it does
   * CardView's.
   */
  get awaitingArt(): string | null {
    return this.artPendingKey;
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
    this.cancelArtWait?.();
    this.cancelArtWait = null;
    this.holo?.destroy();
    this.holo = null;
    this.zone = null; // Container.destroy destroys the child zone itself
    super.destroy(fromScene);
  }
}
