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
import { theme } from '../ui/theme';
import { modalShell, panel, themedButton } from '../ui/themeWidgets';

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
      dim: theme.graphics.dim,
      dimAlpha: 0.6,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
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
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 90, `Six temporary boosters - seed ${run.seed}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    sealed.packs.forEach((pack, i) =>
      this.drawPack(130 + (i % 3) * 345, 150 + Math.floor(i / 3) * 205, i + 1, pack),
    );

    themedButton(this, width / 2 - 120, 640, 'Build Deck', {
      variant: 'primary',
      minWidth: 180,
      onTap: () => this.scene.start('LimitedDeckBuilder'),
    });
    themedButton(this, width / 2 + 120, 640, 'Limited Hub', {
      variant: 'ghost',
      minWidth: 180,
      onTap: () => this.scene.start('Limited'),
    });
  }

  private drawPack(x: number, y: number, packNo: number, pack: readonly string[]): void {
    panel(this, x, y, 310, 166);
    this.add.text(x + 18, y + 15, `Pack ${packNo}`, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.gold,
    });
    const highlights = [...pack]
      .sort(
        (a, b) =>
          rarityRank(b) - rarityRank(a) || def(CARD_DB, a).name.localeCompare(def(CARD_DB, b).name),
      )
      .slice(0, 5);
    highlights.forEach((id, i) => {
      const card = def(CARD_DB, id);
      const row = this.add
        .text(x + 18, y + 52 + i * 20, `${card.rarity.toUpperCase()}  ${card.name}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: i === 0 ? theme.colors.heading : theme.colors.muted,
        })
        .setInteractive({ useHandCursor: true });
      row.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) row.setColor(theme.colors.gold);
      });
      row.on('pointerout', () => row.setColor(i === 0 ? theme.colors.heading : theme.colors.muted));
      bindTapButton(this, row, () => this.showCardInspect(id));
      inflateHitArea(row, 260, 30);
    });
  }

  private showCardInspect(id: string): void {
    this.closeCardInspect();
    const card = def(CARD_DB, id);
    const shell = modalShell(this, {
      width: 940,
      height: 560,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      showClose: false,
      tapDimToClose: true,
      onClose: () => {
        this.cardInspect = null;
      },
    });
    const c = shell.container;

    const view = new CardView(this, 455, 360).setScale(1.35).setCard(card, { fx: 'full' });
    c.add(view);
    c.add(
      this.add.text(730, 154, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 218, `${card.rarity.toUpperCase()} - ${card.types.join(' ')}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.heading,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 274, card.flavor ?? '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        wordWrap: { width: 380 },
        lineSpacing: 5,
      }),
    );
    c.add(
      this.add
        .text(640, 682, 'Click anywhere to close', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
    this.cardInspect = c;
  }

  private closeCardInspect(): void {
    this.cardInspect?.destroy();
    this.cardInspect = null;
  }
}

function rarityRank(id: string): number {
  const rarity = def(CARD_DB, id).rarity;
  return rarity === 'ur' ? 4 : rarity === 'ssr' ? 3 : rarity === 'sr' ? 2 : rarity === 'r' ? 1 : 0;
}
