import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import type { CardDef } from '../engine/types';
import { isType } from '../engine/types';
import type { CardVariant, FrameStyle } from '../meta/variants';
import { FRAME_TREATMENTS, frameKeyFor } from './CardFrameFactory';
import { applyHolo, type HoloHandle } from './fx/HoloEffects';
import { fxPolicy } from './fx/FXSupport';
import { IridescencePostFX } from './fx/IridescencePostFX';
import { pipsFor } from './ManaSymbols';
import { rulesText, typeLine } from './rulesText';

export const CARD_W = 300;
export const CARD_H = 420;

// Art window in card-local (center-origin) coordinates.
const ART_RECT = { x: -132, y: -164, w: 264, h: 192 };
// Full-art window follows the baked frame face: the 18px (2x texture) inset
// leaves the card's rounded metal border visible on every edge.
const FULL_ART_RECT = { x: -141, y: -201, w: 282, h: 402 };
const TEXT_LEFT = -126;
const TEXT_WIDTH = 252;
const BOTTOM_BADGE_Y = 182;
const BOTTOM_PIP_SIZE = 21;
const SET_ICON_SIZE = 24; // set symbols are leaner silhouettes than the old diamond gem

/**
 * Shrink-to-fit with RE-WRAP: when a text block must scale down by s to fit
 * boxH, widen its word-wrap width to TEXT_WIDTH/s so the rendered block still
 * spans the card's full text width — a plain setScale left a narrow column on
 * text-heavy cards (user-reported 2026-07-12). Rewrapping changes the line
 * count, so iterate to a fixed point (converges in 2-3 rounds), then hard-cap
 * without rewrap as the fit guarantee. Resets scale/wrap first, so it is safe
 * on recycled Text objects.
 */
function fitWrappedText(obj: Phaser.GameObjects.Text, boxH: number): void {
  // Rendered height at scale s (wrap width widened so rendered width stays
  // TEXT_WIDTH). Rewrap discretizes by line count, so height-at-s is a step
  // function — binary-search the LARGEST fitting s instead of fixed-point
  // iterating (which parks a step too small when a rewrap drops a line).
  const fitsAt = (s: number): boolean => {
    obj.setWordWrapWidth(TEXT_WIDTH / s);
    return obj.height * s <= boxH + 0.5;
  };
  obj.setScale(1);
  if (fitsAt(1)) {
    obj.setScale(1);
    return;
  }
  let lo = 0.3; // readability floor; below it, hard-clamp instead
  let hi = 1;
  if (fitsAt(lo)) {
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      if (fitsAt(mid)) lo = mid;
      else hi = mid;
    }
    obj.setWordWrapWidth(TEXT_WIDTH / lo);
    obj.setScale(lo);
    return;
  }
  // Even the floor overflows: keep the widest wrap and hard-clamp the scale.
  obj.setScale(Math.min(lo, boxH / obj.height));
}

export type CardFxLevel = 'full' | 'static' | 'none';

/**
 * Solid metallic rarity-ring tints for the mid/high tiers, echoing each tier's
 * gem (sr champagne-gold, ssr violet, ur crimson). `c` gets no ring; `r` keeps
 * its silver ring inline. Deliberately NOT the animated iridescent (mode-0)
 * ring — that shader belongs exclusively to the `rainbow` VARIANT frame
 * (CardFrameFactory FRAME_TREATMENTS), so a plain high-rarity copy is never
 * mistaken for a rainbow pull.
 */
const RARITY_RING: Record<'sr' | 'ssr' | 'ur', number> = {
  sr: 0xf1c96a,
  ssr: 0xc98bff,
  ur: 0xff7a6b,
};

/**
 * The reusable card component: frame + art + texts + rarity/variant
 * treatments. Canonical size 300×420 with a CENTER origin (rotation-friendly
 * for taps). Consumers scale the container: inspect 1.5, pack reveal 1.1,
 * hand 0.55, battlefield 0.45. Keep ≤ ~15 fx:'full' instances alive at once.
 *
 * Variants (per-copy pull cosmetics, src/meta/variants.ts): pass
 * `setCard(card, { fx, variant })` to render both cosmetic axes —
 * Axis B frame (ring + wash over the frame, never the art) and Axis C holo
 * (finish over the art; fx:'full' only). Without a variant the card renders
 * the plain look: the tier ring/gem treatment and NO holo. A non-white frame
 * claims the ring for the frame color; the rarity gem stays the tier
 * indicator either way. Per-finish/frame FX costs: see fx/HoloEffects.ts.
 */
export class CardView extends Phaser.GameObjects.Container {
  private frame: Phaser.GameObjects.Image;
  private frameTint: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private art: Phaser.GameObjects.Image;
  private namePlate: Phaser.GameObjects.Rectangle;
  private typePlate: Phaser.GameObjects.Rectangle;
  private textPlate: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private typeText: Phaser.GameObjects.Text;
  private rulesTextObj: Phaser.GameObjects.Text;
  private flavorTextObj: Phaser.GameObjects.Text;
  private flavorRule: Phaser.GameObjects.Rectangle;
  private ptPlate: Phaser.GameObjects.Image;
  private ptText: Phaser.GameObjects.Text;
  private costPlate: Phaser.GameObjects.Image;
  private gem: Phaser.GameObjects.Image;
  private crown: Phaser.GameObjects.Image;
  private back: Phaser.GameObjects.Image;
  private pips: Phaser.GameObjects.GameObject[] = [];
  private holo: HoloHandle | null = null;
  private shineFx: Phaser.FX.Shine | null = null;
  private ringTween: Phaser.Tweens.Tween | null = null;
  private zone: Phaser.GameObjects.Zone | null = null;

  card: CardDef | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.frame = scene.add.image(0, 0, 'frame-C').setDisplaySize(CARD_W, CARD_H);
    this.frameTint = scene.add
      .image(0, 0, 'frame-tint')
      .setDisplaySize(CARD_W, CARD_H)
      .setVisible(false);
    this.art = scene.add.image(0, ART_RECT.y + ART_RECT.h / 2, '__WHITE');
    this.ring = scene.add.image(0, 0, 'frame-ring').setDisplaySize(CARD_W, CARD_H).setVisible(false);
    // Plate alphas are the WCAG floor-holding values — see the full-art fade
    // note in setCard before lowering them further.
    this.namePlate = scene.add
      .rectangle(0, -182, 268, 26, 0xf7f1dc, 0.7)
      .setStrokeStyle(1.5, 0x6b5a3e, 0.4)
      .setVisible(false);
    this.typePlate = scene.add
      .rectangle(0, 45, 268, 22, 0xf7f1dc, 0.7)
      .setStrokeStyle(1.5, 0x6b5a3e, 0.4)
      .setVisible(false);
    this.textPlate = scene.add
      .rectangle(0, 116, 268, 108, 0xf2ead2, 0.68)
      .setStrokeStyle(1.5, 0x6b5a3e, 0.38)
      .setVisible(false);

    this.nameText = scene.add
      .text(TEXT_LEFT, -182, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#241d10',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.typeText = scene.add
      .text(TEXT_LEFT, 45, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: '#2a2418',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.rulesTextObj = scene.add
      .text(TEXT_LEFT, 66, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#20180e',
        resolution: 2,
        wordWrap: { width: TEXT_WIDTH },
        lineSpacing: 2,
      })
      .setOrigin(0, 0);

    // Flavor renders as its own italic block at the bottom of the text area,
    // in a warm muted sepia to separate it from the rules text above. A faint
    // hairline divider sits above it. Both positioned/sized in setCard.
    this.flavorRule = scene.add
      .rectangle(TEXT_LEFT, 66, TEXT_WIDTH, 1, 0x6b5a3e, 0.35)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.flavorTextObj = scene.add
      .text(TEXT_LEFT, 66, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#6b5a3e',
        resolution: 2,
        wordWrap: { width: TEXT_WIDTH },
        lineSpacing: 2,
      })
      .setOrigin(0, 0)
      .setVisible(false);

    this.ptPlate = scene.add.image(96, BOTTOM_BADGE_Y, 'pt-plate').setDisplaySize(75, 31);
    this.ptText = scene.add
      .text(96, BOTTOM_BADGE_Y - 1, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#241d10',
        resolution: 2,
      })
      .setOrigin(0.5);
    // Mana cost sits BOTTOM-LEFT, mirroring the P/T plate at bottom-right — a
    // deliberate departure from MTG's top-right cost. Reuses the neutral
    // pt-plate texture; width is fitted to the pip row in setCard, hidden for
    // costless cards (lands).
    this.costPlate = scene.add.image(-96, BOTTOM_BADGE_Y, 'pt-plate').setDisplaySize(50, 31).setVisible(false);

    this.gem = scene.add.image(0, BOTTOM_BADGE_Y, 'seticon-base-c').setDisplaySize(SET_ICON_SIZE, SET_ICON_SIZE);
    this.crown = scene.add.image(0, -204, 'crown').setDisplaySize(56, 20).setVisible(false);
    this.back = scene.add.image(0, 0, 'cardback').setDisplaySize(CARD_W, CARD_H).setVisible(false);

    this.add([
      this.frame,
      this.frameTint,
      this.art,
      this.namePlate,
      this.typePlate,
      this.textPlate,
      this.ring,
      this.nameText,
      this.typeText,
      this.rulesTextObj,
      this.flavorRule,
      this.flavorTextObj,
      this.ptPlate,
      this.ptText,
      this.costPlate,
      this.gem,
      this.crown,
      this.back,
    ]);
    this.setSize(CARD_W, CARD_H);
    scene.add.existing(this);
  }

  setCard(
    card: CardDef | null,
    opts: { fx?: CardFxLevel; variant?: CardVariant; fullArt?: boolean } = {},
  ): this {
    this.clearFx();
    this.card = card;

    const faceDown = card === null;
    this.back.setVisible(faceDown);
    for (const obj of [
      this.frame,
      this.art,
      this.nameText,
      this.typeText,
      this.rulesTextObj,
      this.gem,
    ]) {
      (obj as Phaser.GameObjects.Image).setVisible(!faceDown);
    }
    this.ring.setVisible(false);
    this.ptPlate.setVisible(false);
    this.ptText.setVisible(false);
    this.costPlate.setVisible(false);
    this.crown.setVisible(false);
    // Flavor is opt-in per card; hidden by default and shown below only when
    // the card actually has flavor text (and is face-up).
    this.flavorTextObj.setVisible(false);
    this.flavorRule.setVisible(false);
    if (!card) return this;

    const fx: CardFxLevel = opts.fx ?? 'static';
    const fullArt = opts.fullArt === true;
    const artRect = fullArt ? FULL_ART_RECT : ART_RECT;

    // Frame + art
    this.frame.setTexture(frameKeyFor(card.colors, card.types)).setDisplaySize(CARD_W, CARD_H);
    const artRef = Art.resolver!.getArt(card.id);
    if (artRef.frameName) this.art.setTexture(artRef.textureKey, artRef.frameName);
    else this.art.setTexture(artRef.textureKey);
    // Cover the selected window: the standard window crops vertically; full art
    // uses the taller frame interior and therefore crops a centered horizontal
    // band from the same 4:5 source. Explicitly reposition after setCrop — crop
    // does not recenter an Image whose source crop is offset.
    const srcW = this.art.frame.width;
    const srcH = this.art.frame.height;
    const scale = Math.max(artRect.w / srcW, artRect.h / srcH);
    const cropW = artRect.w / scale;
    const cropH = artRect.h / scale;
    const cropX = (srcW - cropW) / 2;
    const cropY = (srcH - cropH) / 2;
    this.art
      .setCrop(cropX, cropY, cropW, cropH)
      .setScale(scale)
      .setPosition(
        artRect.x + artRect.w / 2 + scale * (srcW / 2 - cropX - cropW / 2),
        artRect.y + artRect.h / 2 + scale * (srcH / 2 - cropY - cropH / 2),
      );

    // Texts. With the cost moved to the bottom-left, the name owns the FULL top
    // band — auto-fit to 244px (was 215, when it had to dodge the top-right
    // pips), floor 0.7×. Measure width AFTER setText (Windows font-fallback
    // trap — glyph metrics aren't known before the glyph run).
    this.nameText.setScale(1).setText(card.name);
    const nameW = Math.max(1, this.nameText.width);
    // Prefer a 244px fit with a 0.7 readability floor, but never render wider
    // than the card contains (the name starts at x=-126; keep its right edge
    // ≤ +144). For an extreme name the containment clamp wins over the floor so
    // it can never spill past the card border.
    const nameFit = Math.max(0.7, Math.min(1, 244 / nameW));
    this.nameText.setScale(Math.min(nameFit, 270 / nameW));
    this.typeText.setScale(1).setText(typeLine(card));
    const typeW = Math.max(1, this.typeText.width);
    this.typeText.setScale(Math.min(1, TEXT_WIDTH / typeW));
    const rules = rulesText(card);
    this.rulesTextObj.setText(rules);
    // Land faces get a composed mana-iconography row ([T] → [pip]) centered
    // in the otherwise-empty textbox; flavor (if any) drops below the row.
    const manaRow = isType(card, 'land') ? (card.manaAbility ?? []) : [];
    // Taplands print their rules line ("Enters play tapped.") above the mana
    // row, MTG-style; the layout budgets one line there, so land rules text
    // must stay a single short line.
    const hasLandRules = manaRow.length > 0 && rules.length > 0;
    const textTop = manaRow.length > 0 && !hasLandRules ? 132 : 66;
    // Non-land mana abilities compose an icon line ([T]: Add [pip]) at the
    // top of the rules box (replacing the old "Tap: add G." text line); the
    // text block starts below it.
    const abilityMana = !isType(card, 'land') ? (card.manaAbility ?? []) : [];
    const MANA_LINE_H = abilityMana.length > 0 ? 24 : 0;
    this.rulesTextObj.setPosition(TEXT_LEFT, textTop + MANA_LINE_H);
    // The textbox spans from textTop down to the safe bottom edge. Flavor text
    // is anchored to that bottom edge, directly above cost/stat badges; rules
    // text keeps the top of the box and shrinks if the two blocks would collide.
    const pipSpecs = pipsFor(card.cost ?? { generic: 0, pips: {} });
    const BOX_BOTTOM = 166;
    const BOX_H = BOX_BOTTOM - textTop - MANA_LINE_H;
    const DIVIDER_GAP = 8; // space between rules block and the hairline
    const AFTER_DIVIDER = 6; // hairline to flavor text
    // Full art drops the lore line entirely (user spec 2026-07-13) — the
    // rules field stays operational-only and the art owns the mood.
    const hasFlavor = !!card.flavor && !fullArt;

    // Measure the flavor block first (height is needed to size the rules box).
    // Windows font-fallback trap: measure height only AFTER setText.
    // Cap flavor to the lower slice of the box, then place it bottom-up.
    const maxFlavorH = Math.max(1, Math.min(BOX_H * 0.6, BOX_H - DIVIDER_GAP - 1 - AFTER_DIVIDER));
    if (hasFlavor) {
      this.flavorTextObj.setText(card.flavor!);
      fitWrappedText(this.flavorTextObj, maxFlavorH);
    }
    const scaledFlavorH = hasFlavor ? this.flavorTextObj.height * this.flavorTextObj.scaleY : 0;
    const flavorBlock = hasFlavor ? DIVIDER_GAP + 1 + AFTER_DIVIDER + scaledFlavorH : 0;
    const RULES_BOX_H = Math.max(1, BOX_H - flavorBlock);
    fitWrappedText(this.rulesTextObj, RULES_BOX_H);

    // Position the flavor block from the bottom upward, independent of how
    // sparse the rules text is. Bare cards therefore read like printed cards:
    // empty rules area above, flavor resting near the lower edge.
    if (hasFlavor) {
      const flavorTop = BOX_BOTTOM - scaledFlavorH;
      const dividerY = flavorTop - AFTER_DIVIDER;
      this.flavorRule.setPosition(TEXT_LEFT, dividerY).setVisible(true);
      this.flavorTextObj.setPosition(TEXT_LEFT, flavorTop).setVisible(true);
    }
    // Full-art fade: plates and text drop opacity but hold WCAG AA. Worst
    // case is pure-black art behind the plate: effective background
    // luminance = plateAlpha × plateLum (≈0.83), effective text luminance =
    // textAlpha × textLum + (1−textAlpha) × bgLum; at plate 0.68 / text 0.90
    // the near-black ink keeps ≥4.7:1 against any art, above the 4.5:1
    // normal-text floor (light art only raises it).
    const textAlpha = fullArt ? 0.9 : 1;
    this.nameText.setAlpha(textAlpha);
    this.typeText.setAlpha(textAlpha);
    this.rulesTextObj.setAlpha(textAlpha);
    // In full art the rules field is bottom-anchored and content-sized (user
    // spec 2026-07-13): full width, no dead parchment below short text. The
    // mana-icon row and rules text shift down with it via fieldTop.
    let fieldTop = textTop;
    if (fullArt) {
      this.namePlate.setVisible(true);
      this.typePlate.setVisible(true);
      const hasFieldContent = rules.length > 0 || MANA_LINE_H > 0;
      if (manaRow.length > 0) {
        // Lands keep the fixed plate — their [T]→pip row is centered in the
        // field, so a content-hugging plate has nothing to hug.
        this.textPlate.setSize(268, 108).setPosition(0, 116).setVisible(true);
      } else if (hasFieldContent) {
        const PLATE_PAD = 8;
        // Bottom edge tucks behind the badge row exactly like the old fixed
        // plate did (it spanned y62..170; badges start at y166.5).
        const PLATE_BOTTOM = 170;
        const rulesH = this.rulesTextObj.height * this.rulesTextObj.scaleY;
        const plateH = PLATE_PAD * 2 + MANA_LINE_H + rulesH;
        this.textPlate.setSize(268, plateH).setPosition(0, PLATE_BOTTOM - plateH / 2).setVisible(true);
        fieldTop = PLATE_BOTTOM - PLATE_PAD - rulesH - MANA_LINE_H;
        this.rulesTextObj.setPosition(TEXT_LEFT, fieldTop + MANA_LINE_H);
      } else {
        // Vanilla card: no rules, no mana line — the art owns the whole field.
        this.textPlate.setVisible(false);
      }
    }
    if (abilityMana.length > 0) {
      // [T]: Add [G] — icon form of the old "Tap: add G." line, sized to sit
      // flush with the 13px rules text below it.
      const PIP = 18;
      const rowYc = fieldTop + PIP / 2;
      const style = {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#20180e',
        resolution: 2,
      };
      let ix = TEXT_LEFT;
      const tap = this.scene.add.image(ix + PIP / 2, rowYc, 'pip-T').setDisplaySize(PIP, PIP);
      this.add(tap);
      this.pips.push(tap);
      ix += PIP + 2;
      const label = this.scene.add.text(ix, rowYc, ': Add', style).setOrigin(0, 0.5);
      this.add(label);
      this.pips.push(label);
      ix += label.width + 5;
      abilityMana.forEach((col, i) => {
        if (i > 0) {
          const or = this.scene.add.text(ix, rowYc, 'or', style).setOrigin(0, 0.5);
          this.add(or);
          this.pips.push(or);
          ix += or.width + 5;
        }
        const pip = this.scene.add.image(ix + PIP / 2, rowYc, `pip-${col}`).setDisplaySize(PIP, PIP);
        this.add(pip);
        this.pips.push(pip);
        ix += PIP + 5;
      });
    }
    if (manaRow.length > 0) {
      // [T] → [G]; duals read [T] → [W] or [G] — bare side-by-side pips read
      // as "provides both" (user-reported 2026-07-12). Sized generously — this
      // row is the land's whole rules box, so it should read from the hand.
      const PIP = 48;
      const GAP = 10;
      const ARROW_W = 24;
      const OR_W = 26; // the "or" separator between adjacent color pips
      const SEP = GAP + OR_W + GAP; // one constant shared by width, label x, and advance
      // Centered in the free box when bare; nudged down past the rules line
      // (one line ending ~81) when the land prints one, e.g. taplands.
      const rowY = hasLandRules ? 108 : hasFlavor ? 100 : 128;
      const rowW = PIP + GAP + ARROW_W + GAP + manaRow.length * PIP + (manaRow.length - 1) * SEP;
      let ix = -rowW / 2 + PIP / 2;
      const tap = this.scene.add.image(ix, rowY, 'pip-T').setDisplaySize(PIP, PIP);
      this.add(tap);
      this.pips.push(tap);
      ix += PIP / 2 + GAP + ARROW_W / 2;
      const arrow = this.scene.add
        .text(ix, rowY, '→', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '24px',
          fontStyle: '700',
          color: '#4a3b28',
          resolution: 2,
        })
        .setOrigin(0.5);
      this.add(arrow);
      this.pips.push(arrow);
      ix += ARROW_W / 2 + GAP + PIP / 2;
      manaRow.forEach((col, i) => {
        if (i > 0) {
          const or = this.scene.add
            .text(ix - PIP / 2 - SEP / 2, rowY, 'or', {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '20px',
              fontStyle: '600',
              color: '#4a3b28',
              resolution: 2,
            })
            .setOrigin(0.5);
          this.add(or);
          this.pips.push(or);
        }
        const img = this.scene.add.image(ix, rowY, `pip-${col}`).setDisplaySize(PIP, PIP);
        this.add(img);
        this.pips.push(img);
        ix += PIP + SEP;
      });
    }

    // P/T
    if (isType(card, 'creature')) {
      this.ptPlate.setVisible(true);
      this.ptText.setVisible(true).setText(`${card.attack}/${card.defense}`);
    }

    // Cost pips — BOTTOM-LEFT, mirroring the P/T plate at bottom-right. Read
    // left-to-right (generic first, then colored pips). The plate's LEFT edge
    // is fixed where the minimal 46px plate has always sat (center -96) and
    // wide trays grow RIGHTWARD only — centered growth pushed 3-4 pip costs
    // through the card frame's left edge (user report 2026-07-12).
    if (pipSpecs.length > 0) {
      const PIP = BOTTOM_PIP_SIZE;
      const STEP = 23;
      const left = -96 - 46 / 2; // classic 1-pip plate left edge, inside the frame
      const maxRight = -16; // 4px clear of the 24px set symbol centered at x=0
      const rowW = PIP + (pipSpecs.length - 1) * STEP;
      const plateW = Math.min(Math.max(46, rowW + 18), maxRight - left);
      // Widest catalog costs (5 pips: gk-zeus) exceed the clamped plate —
      // compress the pip step so the row fits rather than covering the symbol.
      const fitRowW = Math.min(rowW, plateW - 18);
      const step = pipSpecs.length > 1 ? STEP - (rowW - fitRowW) / (pipSpecs.length - 1) : 0;
      this.costPlate.setVisible(true).setDisplaySize(plateW, 31).setX(left + plateW / 2);
      let px = left + (plateW - fitRowW) / 2 + PIP / 2;
      for (const spec of pipSpecs) {
        const img = this.scene.add.image(px, BOTTOM_BADGE_Y, spec.texture).setDisplaySize(PIP, PIP);
        this.add(img);
        this.pips.push(img);
        if (spec.number !== undefined) {
          const t = this.scene.add
            .text(px, BOTTOM_BADGE_Y - 1, String(spec.number), {
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#2b2f36',
              resolution: 2,
            })
            .setOrigin(0.5);
          this.add(t);
          this.pips.push(t);
        }
        px += step;
      }
    }

    // Rarity + variant treatments. The set symbol carries BOTH signals
    // (MTG-style: shape = set, tint = tier); the ring shows the tier
    // treatment (plain look) unless a non-white variant frame claims it
    // for Axis B.
    this.gem.setTexture(`seticon-${card.set ?? 'base'}-${card.rarity}`);
    this.crown.setVisible(!!card.supertypes?.includes('legendary'));

    const variant = opts.variant;
    if (variant && variant.frame !== 'white') {
      this.applyFrameStyle(variant.frame, fx);
    } else if (card.rarity === 'r') {
      this.ring.setVisible(true).setTint(0xcdd7e8).setAlpha(0.9);
      if (fx === 'full' && fxPolicy(this.scene).shine && this.ring.preFX) {
        this.shineFx = this.ring.preFX.addShine(0.35, 0.2, 5);
      }
      this.ring.resetPostPipeline();
    } else if (card.rarity === 'sr' || card.rarity === 'ssr' || card.rarity === 'ur') {
      // Solid metallic ring per tier (echoing the gem) with a shine sweep for
      // the metallic gleam — NOT the animated iridescent ring, which is
      // reserved for the `rainbow` VARIANT frame so a plain high-rarity copy
      // never reads as a rainbow pull.
      this.ring.setVisible(true).setTint(RARITY_RING[card.rarity]).setAlpha(1);
      this.ring.resetPostPipeline();
      if (fx === 'full' && fxPolicy(this.scene).shine && this.ring.preFX) {
        this.shineFx = this.ring.preFX.addShine(0.5, 0.25, 4);
      }
    }

    // Holo — a finish is per-copy (variant Axis C): no variant, no holo.
    if (fx === 'full' && variant && variant.holo !== 'none') {
      this.holo = applyHolo(this.scene, this, this.art, variant.holo, artRect);
    }
    // Full art: the holo overlay covers the whole frame (not just the art
    // window), and applyHolo appends its objects last — so re-raise every
    // text plate, text, and badge above the finish. Text must stay legible
    // over any holo (user spec 2026-07-13).
    if (fullArt) this.raiseFullArtChrome();
    return this;
  }

  /** Bring the readable chrome above full-frame holo overlays, in draw order. */
  private raiseFullArtChrome(): void {
    const chrome: Phaser.GameObjects.GameObject[] = [
      this.namePlate,
      this.typePlate,
      this.textPlate,
      this.nameText,
      this.typeText,
      this.rulesTextObj,
      this.flavorRule,
      this.flavorTextObj,
      this.costPlate,
      ...this.pips,
      this.ptPlate,
      this.ptText,
      this.gem,
      this.crown,
    ];
    for (const obj of chrome) this.bringToTop(obj);
  }

  /**
   * Axis B (non-white frames): ring + wash from the FRAME_TREATMENTS table.
   * Reads at pack-reveal scale (~0.5) via the 13px ring and the face wash;
   * the wash texture has the art window cut out and sits below all texts.
   */
  private applyFrameStyle(frame: Exclude<FrameStyle, 'white'>, fx: CardFxLevel): void {
    const t = FRAME_TREATMENTS[frame];
    if (t.wash !== null) {
      this.frameTint.setVisible(true).setTint(t.wash).setAlpha(t.washAlpha);
    }
    this.ring.setVisible(true).setAlpha(1);
    if (t.rainbow) {
      if (fx !== 'none' && fxPolicy(this.scene).iridescence) {
        // animated RGB cycle — the existing mode-0 border ring shader
        this.ring.setTint(0xffffff);
        this.ring.setPostPipeline(IridescencePostFX);
        const p = this.ring.getPostPipeline(IridescencePostFX);
        if (p instanceof IridescencePostFX) p.mode = 0;
      } else if (fx !== 'none') {
        // canvas/lite: cheap hue-cycle re-tint — still an animated RGB border
        this.ring.setTint(0xff5f5f);
        this.ringTween = this.scene.tweens.addCounter({
          from: 0,
          to: 360,
          duration: 3000,
          repeat: -1,
          onUpdate: (tw) => {
            if (!this.ring.active) return;
            this.ring.setTint(Phaser.Display.Color.HSLToColor((tw.getValue() ?? 0) / 360, 0.85, 0.62).color);
          },
        });
      } else {
        // fx:'none' (thumb bakes): a static 4-corner rainbow gradient tint
        this.ring.setTint(0xff5f5f, 0xffd24a, 0x4a90ff, 0x59ff8e);
      }
    } else if (t.ring !== null) {
      this.ring.setTint(t.ring);
      // gold's metallic luster: a shine sweep along the ring
      if (t.luster && fx === 'full' && fxPolicy(this.scene).shine && this.ring.preFX) {
        this.shineFx = this.ring.preFX.addShine(0.5, 0.25, 4);
      }
    }
  }

  /**
   * Make the card clickable via an invisible Zone child. Unlike a hit area set
   * on the container itself, a child gets the full world transform (including
   * the container's scale), so the hit rect matches the card's visual size.
   * Pointer events are re-emitted on the CardView, so consumers listen on it.
   */
  enableInput(): this {
    if (!this.zone) {
      this.zone = this.scene.add.zone(0, 0, CARD_W, CARD_H);
      this.add(this.zone); // Container.add pulls it off the scene display list
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

  /** Feed a pointer position for foil reactivity; card-relative -1..1. */
  setHoloPointer(worldX: number, worldY: number): void {
    if (!this.holo) return;
    const local = this.getLocalPoint(worldX, worldY);
    this.holo.setPointer(
      Phaser.Math.Clamp(local.x / (CARD_W / 2), -1.5, 1.5),
      Phaser.Math.Clamp(local.y / (CARD_H / 2), -1.5, 1.5),
    );
  }

  setTapped(tapped: boolean, animate = true): void {
    const target = tapped ? 90 : 0;
    if (animate) {
      this.scene.tweens.add({ targets: this, angle: target, duration: 180, ease: 'Cubic.easeOut' });
    } else {
      this.setAngle(target);
    }
  }

  private clearFx(): void {
    this.holo?.destroy();
    this.holo = null;
    if (this.shineFx) {
      this.ring.preFX?.remove(this.shineFx);
      this.shineFx = null;
    }
    this.ringTween?.remove();
    this.ringTween = null;
    this.ring.resetPostPipeline();
    this.ring.clearTint();
    this.frameTint.setVisible(false).clearTint();
    this.namePlate.setVisible(false);
    this.typePlate.setVisible(false);
    this.textPlate.setVisible(false);
    this.flavorTextObj.setScale(1).setVisible(false);
    this.flavorRule.setVisible(false);
    for (const p of this.pips) p.destroy();
    this.pips = [];
  }

  destroy(fromScene?: boolean): void {
    this.clearFx();
    this.zone = null; // Container.destroy destroys the child zone itself
    super.destroy(fromScene);
  }
}
