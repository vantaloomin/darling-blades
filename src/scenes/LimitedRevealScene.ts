import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { def } from '../engine/types';
import { rollSealedPool } from '../meta/Limited';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { CardView } from '../ui/CardView';
import { applyBackdrop } from '../ui/SceneBackdrop';

export class LimitedRevealScene extends Phaser.Scene {
  private cardInspect: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('LimitedReveal');
  }

  create(): void {
    this.cardInspect = null;
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'packopening', {
      dim: 0x0b0812,
      dimAlpha: 0.6,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(0x1c1230, 0x1c1230, 0x0b0812, 0x0b0812, 1);
        g.fillRect(0, 0, width, height);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const run = Services.save.data.limited.activeRun;
    if (!run || run.mode !== 'sealed') {
      this.scene.start('Limited');
      return;
    }
    const sealed = rollSealedPool(CARD_DB, run.seed);

    this.add
      .text(width / 2, 52, 'Sealed Pool', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '46px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 90, `Six temporary boosters - seed ${run.seed}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#a89cc6',
      })
      .setOrigin(0.5);

    sealed.packs.forEach((pack, i) => this.drawPack(130 + (i % 3) * 345, 150 + Math.floor(i / 3) * 205, i + 1, pack));

    this.button(width / 2 - 120, 640, 'Build Deck', true, () => this.scene.start('LimitedDeckBuilder'));
    this.button(width / 2 + 120, 640, 'Limited Hub', false, () => this.scene.start('Limited'));
  }

  private drawPack(x: number, y: number, packNo: number, pack: readonly string[]): void {
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.88);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, 310, 166, 8);
    g.strokeRoundedRect(x, y, 310, 166, 8);
    this.add.text(x + 18, y + 15, `Pack ${packNo}`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '22px',
      color: '#ffd88a',
    });
    const highlights = [...pack]
      .sort((a, b) => rarityRank(b) - rarityRank(a) || def(CARD_DB, a).name.localeCompare(def(CARD_DB, b).name))
      .slice(0, 5);
    highlights.forEach((id, i) => {
      const card = def(CARD_DB, id);
      const row = this.add
        .text(x + 18, y + 52 + i * 20, `${card.rarity.toUpperCase()}  ${card.name}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: i === 0 ? '#f0e6ff' : '#a89cc6',
        })
        .setInteractive({ useHandCursor: true });
      row.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) row.setColor('#ffd88a');
      });
      row.on('pointerout', () => row.setColor(i === 0 ? '#f0e6ff' : '#a89cc6'));
      bindTapButton(this, row, () => this.showCardInspect(id));
      inflateHitArea(row, 260, 30);
    });
  }

  private showCardInspect(id: string): void {
    this.closeCardInspect();
    const card = def(CARD_DB, id);
    const c = this.add.container(0, 0).setDepth(120);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.82).setInteractive();
    bindTapButton(this, dim, () => this.closeCardInspect());
    c.add(dim);

    const view = new CardView(this, 455, 360).setScale(1.35).setCard(card, { fx: 'full' });
    c.add(view);
    c.add(
      this.add.text(730, 154, card.name, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '28px',
        color: '#ffd88a',
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 218, `${card.rarity.toUpperCase()} - ${card.types.join(' ')}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#f0e6ff',
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 274, card.flavor ?? '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'italic',
        color: '#a89cc6',
        wordWrap: { width: 380 },
        lineSpacing: 5,
      }),
    );
    c.add(
      this.add
        .text(640, 682, 'Click anywhere to close', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );
    this.cardInspect = c;
  }

  private closeCardInspect(): void {
    this.cardInspect?.destroy();
    this.cardInspect = null;
  }

  private button(x: number, y: number, label: string, primary: boolean, cb: () => void): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '24px',
        color: primary ? '#ffd88a' : '#c9bde0',
        backgroundColor: primary ? '#2c2344' : '#241d3a',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, cb);
    inflateHitArea(btn, 90, 90);
    return btn;
  }
}

function rarityRank(id: string): number {
  const rarity = def(CARD_DB, id).rarity;
  return rarity === 'ur' ? 4 : rarity === 'ssr' ? 3 : rarity === 'sr' ? 2 : rarity === 'r' ? 1 : 0;
}
