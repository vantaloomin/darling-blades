import Phaser from 'phaser';
import { ALL_CARDS } from '../data/catalog';
import type { CardDef, Rarity } from '../engine/types';
import { TIER_LABEL, type FrameStyle, type HoloFinish } from '../meta/variants';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { CardView } from '../ui/CardView';
import { applyBackdrop } from '../ui/SceneBackdrop';

const FRAMES: readonly FrameStyle[] = ['white', 'blue', 'red', 'gold', 'rainbow', 'black'];
const HOLOS: readonly HoloFinish[] = ['none', 'shiny', 'rainbow', 'pearlescent', 'fractal', 'void'];

const CHIP_ON = { color: '#ffd88a', backgroundColor: '#4a3f6e' };
const CHIP_OFF = { color: '#c9bde0', backgroundColor: '#241d3a' };

/**
 * Variant QA showcase: one live CardView (fx:'full') + a frame picker, a holo
 * picker, and a card cycler (one card per rarity tier) — every frame × holo ×
 * tier combination is reachable. This is the preview-probe surface for the
 * cosmetic axes; chips follow the touch rules (bindTapButton + inflateHitArea,
 * re-inflated after any style change — playbook §11 Text.updateText trap).
 */
export class CardShowcaseScene extends Phaser.Scene {
  private view!: CardView;
  private picks: CardDef[] = [];
  private pickIdx = 0;
  private frame: FrameStyle = 'white';
  private holo: HoloFinish = 'none';
  private frameChips: Phaser.GameObjects.Text[] = [];
  private holoChips: Phaser.GameObjects.Text[] = [];
  private cardLabel!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;

  constructor() {
    super('Showcase');
  }

  create(): void {
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    this.frameChips = [];
    this.holoChips = [];
    this.frame = 'white';
    this.holo = 'none';

    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback.
    applyBackdrop(this, 'showcase', {
      dim: 0x0b0812,
      dimAlpha: 0.4,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        bg.fillRect(0, 0, width, height);
      },
    });

    this.add
      .text(width / 2, 40, 'Card Showcase', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '30px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    // One card per tier: Lu Bu is pinned when her tier comes up (the M3 check),
    // otherwise the first booster-eligible card of the tier.
    const tiers: Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
    this.picks = tiers
      .map((tier) => {
        const pool = ALL_CARDS.filter(
          (d) => d.rarity === tier && !d.token && !d.supertypes?.includes('basic'),
        );
        return pool.find((d) => d.id === 'tk-other-lubu') ?? pool[0];
      })
      .filter((d): d is CardDef => d !== undefined);
    this.pickIdx = this.picks.length - 1; // start on the UR pick

    // The one live card (fx:'full') + pointer-reactive foil.
    this.view = new CardView(this, 340, 400).setScale(1.3);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.view.setHoloPointer(p.worldX, p.worldY);
    });
    this.readout = this.add
      .text(340, 700, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    // Card cycler — reaches one card of every tier.
    const cycY = 140;
    this.cardLabel = this.add
      .text(930, cycY, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '19px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    const mkArrow = (x: number, label: string, dir: number): void => {
      const btn = this.add
        .text(x, cycY, label, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '26px',
          color: '#ffd88a',
          backgroundColor: '#241d3a',
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, () => {
        this.pickIdx = (this.pickIdx + dir + this.picks.length) % this.picks.length;
        this.apply();
      });
      inflateHitArea(btn, 90, 90);
    };
    mkArrow(680, '◀', -1);
    mkArrow(1180, '▶', 1);

    // Pickers: 6 frame chips + 6 holo chips — every combination reachable.
    this.addRowLabel(640, 216, 'FRAME');
    FRAMES.forEach((f, i) => {
      this.frameChips.push(
        this.chip(640 + i * 118, 262, f.toUpperCase(), () => {
          this.frame = f;
          this.apply();
        }),
      );
    });
    this.addRowLabel(640, 336, 'HOLO');
    HOLOS.forEach((h, i) => {
      this.holoChips.push(
        this.chip(640 + i * 118, 382, h.toUpperCase(), () => {
          this.holo = h;
          this.apply();
        }),
      );
    });

    const back = this.add
      .text(28, 28, '← Menu', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#c9bde0',
      })
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#ffd700');
    });
    back.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#c9bde0');
    });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);

    this.apply();
  }

  private addRowLabel(x: number, y: number, text: string): void {
    this.add.text(x - 58, y, text, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      fontStyle: '700',
      color: '#8f83a8',
    });
  }

  private chip(x: number, y: number, label: string, onTap: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        ...CHIP_OFF,
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, t, onTap);
    inflateHitArea(t, 90, 90);
    return t;
  }

  /** Re-render the card with the selected variant + sync chip styling. */
  private apply(): void {
    const d = this.picks[this.pickIdx];
    if (!d) return;
    this.view.setCard(d, { fx: 'full', variant: { frame: this.frame, holo: this.holo } });
    this.cardLabel.setText(`${d.name} — ${TIER_LABEL[d.rarity]}`);
    this.readout.setText(
      `${TIER_LABEL[d.rarity]} · ${this.frame.toUpperCase()} FRAME · ${this.holo.toUpperCase()}`,
    );
    const style = (chips: Phaser.GameObjects.Text[], selected: number): void => {
      chips.forEach((c, i) => {
        const s = i === selected ? CHIP_ON : CHIP_OFF;
        c.setColor(s.color);
        c.setBackgroundColor(s.backgroundColor);
        // setColor/setBackgroundColor run updateText — re-inflate (playbook §11)
        inflateHitArea(c, 90, 90);
      });
    };
    style(this.frameChips, FRAMES.indexOf(this.frame));
    style(this.holoChips, HOLOS.indexOf(this.holo));
  }
}
