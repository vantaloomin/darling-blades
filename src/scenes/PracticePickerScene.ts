import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { AVATARS } from '../data/opponents';
import type { Difficulty } from '../meta/Economy';
import { practiceDuelLaunchData } from '../meta/duelSetup';
import { bindTapButton } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, themedButton } from '../ui/themeWidgets';

/**
 * Practice opponent picker. Practice is one decision flow: choose an avatar,
 * then choose the AI strength. Every launch carries both values, so the chosen
 * avatar always supplies the real deck and personality while difficulty only
 * changes the brain that pilots them. No gauntlet state is read or written.
 */
export class PracticePickerScene extends Phaser.Scene {
  private selectedAvatarId = AVATARS[AVATARS.length - 1]?.id ?? '';
  private tileNodes: {
    id: string;
    box: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
  }[] = [];
  private selectionLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('PracticePicker');
  }

  create(): void {
    this.selectedAvatarId = AVATARS[AVATARS.length - 1]?.id ?? '';
    this.tileNodes = [];
    this.selectionLabel = null;

    // Design-space constants, NOT this.scale (see src/platform/renderScale.ts).
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'gauntlet', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.58,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.dim),
          colorInt(theme.colors.dim),
          1,
        );
        bg.fillRect(0, 0, width, height);
      },
    });

    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    this.add
      .text(width / 2, 48, 'Practice', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 86, 'Choose a rival, then choose how hard they fight.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    this.buildRoster();
    this.buildDifficultyActions();

    backButton(this, () => this.scene.start('Play'));
  }

  /** Two calm rows of portrait tiles, summit-first to match the tower roster. */
  private buildRoster(): void {
    const roster = [...AVATARS].sort((a, b) => b.tier - a.tier);
    const columns = 7;
    const tileW = 152;
    const tileH = 202;
    const gapX = 12;
    const gapY = 14;
    const gridW = columns * tileW + (columns - 1) * gapX;
    const startX = (1280 - gridW) / 2;
    const startY = 118;

    roster.forEach((av, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (tileW + gapX) + tileW / 2;
      const y = startY + row * (tileH + gapY) + tileH / 2;

      const box = this.add
        .rectangle(x, y, tileW, tileH, theme.graphics.rowFill, theme.alpha.panel)
        .setStrokeStyle(2, colorInt(theme.colors.panelStroke))
        .setInteractive({ useHandCursor: true });
      this.addPortrait(av.portraitCardId, x, y - 20, tileW - 12, 150);
      const name = this.add
        .text(x, y + 70, av.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          align: 'center',
          lineSpacing: -2,
          wordWrap: { width: tileW - 12 },
        })
        .setOrigin(0.5, 0);

      bindTapButton(this, box, () => {
        this.selectedAvatarId = av.id;
        this.refreshSelection();
      });
      box.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch && av.id !== this.selectedAvatarId) {
          box.setStrokeStyle(2, theme.graphics.rowFillActive);
        }
      });
      box.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.refreshSelection();
      });

      this.tileNodes.push({ id: av.id, box, name });
    });

    this.refreshSelection();
  }

  private buildDifficultyActions(): void {
    this.selectionLabel = this.add
      .text(640, 568, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];
    difficulties.forEach((difficulty, index) => {
      const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      themedButton(this, 476 + index * 164, 624, label, {
        variant: 'ghost',
        minWidth: 148,
        onTap: () => this.startPractice(difficulty),
      });
    });

    this.refreshSelection();
  }

  private refreshSelection(): void {
    for (const node of this.tileNodes) {
      const selected = node.id === this.selectedAvatarId;
      node.box.setFillStyle(
        selected ? theme.graphics.rowFillActive : theme.graphics.rowFill,
        selected ? 1 : theme.alpha.panel,
      );
      node.box.setStrokeStyle(selected ? 3 : 2, colorInt(selected ? theme.colors.goldHover : theme.colors.panelStroke));
      node.name.setColor(selected ? theme.colors.gold : theme.colors.body);
    }

    const selected = AVATARS.find((av) => av.id === this.selectedAvatarId);
    this.selectionLabel?.setText(selected ? `Face ${selected.name}` : 'Choose a rival');
  }

  private startPractice(difficulty: Difficulty): void {
    const selected = AVATARS.find((av) => av.id === this.selectedAvatarId);
    if (!selected) return;
    this.scene.start('Duel', practiceDuelLaunchData(selected.id, difficulty));
  }

  /** Render an avatar portrait into a stable, masked tile crop. */
  private addPortrait(cardId: string, x: number, y: number, targetW: number, targetH: number): void {
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const img = this.add.image(x, y, ref.textureKey, ref.frameName);
      const scale = Math.max(targetW / img.width, targetH / img.height) * 1.1;
      img.setScale(scale);
      img.y = y - targetH * 0.07;
      const maskShape = this.add
        .rectangle(x, y, targetW, targetH, colorInt(theme.colors.heading))
        .setVisible(false);
      img.setMask(maskShape.createGeometryMask());
    } catch {
      // The tokenized tile and name remain usable if art is unavailable.
    }
  }
}
