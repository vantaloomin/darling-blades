import Phaser from 'phaser';
import { ALL_CARDS } from '../data/catalog';
import type { CardDef, Rarity } from '../engine/types';
import { TIER_LABEL, type FrameStyle, type HoloFinish } from '../meta/variants';
import { CardView } from '../ui/CardView';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { backButton, themedButton, type ThemedButton } from '../ui/themeWidgets';

const FRAMES: readonly FrameStyle[] = ['white', 'blue', 'red', 'gold', 'rainbow', 'black'];
const HOLOS: readonly HoloFinish[] = ['none', 'shiny', 'rainbow', 'pearlescent', 'fractal', 'void'];

/** Variant QA surface: only chrome is themed; live-card FX remain untouched. */
export class CardShowcaseScene extends Phaser.Scene {
  private view!: CardView;
  private picks: CardDef[] = [];
  private pickIdx = 0;
  private frame: FrameStyle = 'white';
  private holo: HoloFinish = 'none';
  private frameChips: ThemedButton[] = [];
  private holoChips: ThemedButton[] = [];
  private cardLabel!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;
  constructor() {
    super('Showcase');
  }
  create(): void {
    const width = 1280;
    const height = 720;
    this.frameChips = [];
    this.holoChips = [];
    this.frame = 'white';
    this.holo = 'none';
    applyBackdrop(this, 'showcase', {
      dim: theme.graphics.dim,
      dimAlpha: 0.4,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        bg.fillRect(0, 0, width, height);
      },
    });
    this.add
      .text(width / 2, 40, 'Card Showcase', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    const tiers: Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
    this.picks = tiers
      .map((tier) => {
        const pool = ALL_CARDS.filter(
          (d) => d.rarity === tier && !d.token && !d.supertypes?.includes('basic'),
        );
        return pool.find((d) => d.id === 'tk-other-lubu') ?? pool[0];
      })
      .filter((d): d is CardDef => d !== undefined);
    this.pickIdx = this.picks.length - 1;
    this.view = new CardView(this, 340, 400).setScale(1.3);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) =>
      this.view.setHoloPointer(p.worldX, p.worldY),
    );
    this.readout = this.add
      .text(340, 700, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    const cycY = 140;
    this.cardLabel = this.add
      .text(930, cycY, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    for (const [x, label, direction] of [
      [680, '◀', -1],
      [1180, '▶', 1],
    ] as const)
      themedButton(this, x, cycY, label, {
        variant: 'ghost',
        minWidth: 90,
        onTap: () => {
          this.pickIdx = (this.pickIdx + direction + this.picks.length) % this.picks.length;
          this.apply();
        },
      });
    this.addRowLabel(640, 216, 'FRAME');
    FRAMES.forEach((f, i) =>
      this.frameChips.push(
        this.chip(640 + i * 118, 262, f.toUpperCase(), () => {
          this.frame = f;
          this.apply();
        }),
      ),
    );
    this.addRowLabel(640, 336, 'HOLO');
    HOLOS.forEach((h, i) =>
      this.holoChips.push(
        this.chip(640 + i * 118, 382, h.toUpperCase(), () => {
          this.holo = h;
          this.apply();
        }),
      ),
    );
    backButton(this, () => this.scene.start('MainMenu'));
    this.apply();
  }
  private addRowLabel(x: number, y: number, text: string): void {
    this.add.text(x - 58, y, text, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
  }
  private chip(x: number, y: number, label: string, onTap: () => void): ThemedButton {
    return themedButton(this, x, y, label, { variant: 'ghost', size: 'sm', minWidth: 104, onTap });
  }
  private apply(): void {
    const card = this.picks[this.pickIdx];
    if (!card) return;
    this.view.setCard(card, { fx: 'full', variant: { frame: this.frame, holo: this.holo } });
    this.cardLabel.setText(`${card.name} — ${TIER_LABEL[card.rarity]}`);
    this.readout.setText(
      `${TIER_LABEL[card.rarity]} · ${this.frame.toUpperCase()} FRAME · ${this.holo.toUpperCase()}`,
    );
    const style = (chips: ThemedButton[], selected: number): void =>
      chips.forEach((chip, index) => chip.setVariant(index === selected ? 'primary' : 'ghost'));
    style(this.frameChips, FRAMES.indexOf(this.frame));
    style(this.holoChips, HOLOS.indexOf(this.holo));
  }
}
