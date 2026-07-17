import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { AVATARS, type Avatar } from '../data/opponents';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel, themedButton } from '../ui/themeWidgets';

/**
 * Practice opponent picker (1.2, plan-v1.1-post-launch Feature 1). The Play
 * submenu's three difficulty rows collapsed into one "Practice" entry that
 * lands here: a right-rail roster of the twelve tower avatars (summit on top,
 * mirroring the gauntlet ladder) with the gauntlet's avatar-card presentation
 * on the left, plus three plain training duels for a no-frills spar.
 *
 * Pure navigation over existing plumbing: picking an avatar launches
 * `scene.start('Duel', { opponentId })` — DuelScene already resolves the
 * deck, portrait, personality, and difficulty (the avatar's own difficulty
 * wins) and labels the strip "vs {name}". No gauntletRung means no tower
 * state is read or written; practice never touches a run. No SaveData change.
 */
export class PracticePickerScene extends Phaser.Scene {
  private selectedTier = 1;
  private panel: Phaser.GameObjects.Container | null = null;
  private rowNodes: { tier: number; box: Phaser.GameObjects.Rectangle }[] = [];

  constructor() {
    super('PracticePicker');
  }

  create(): void {
    this.selectedTier = 1;
    this.panel = null;
    this.rowNodes = [];

    // Design-space constants, NOT this.scale (see src/platform/renderScale.ts).
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'gauntlet', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.5,
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
      .text(width / 2, 46, 'Practice', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 84, 'Spar any rival from the tower, or take a plain training duel. Practice never touches your run.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    this.buildRoster();
    this.buildPanel();
    this.buildTrainingRow();

    backButton(this, () => this.scene.start('Play'));
  }

  private difficultyPips(av: Avatar): number {
    return av.difficulty === 'easy' ? 1 : av.difficulty === 'medium' ? 2 : 3;
  }

  // ---------------------------------------------------------------------
  /** Right-rail avatar roster, summit on top like the gauntlet ladder. */
  private buildRoster(): void {
    const width = 1280;
    const railX = width - 250;
    const topY = 150;
    const count = AVATARS.length;
    const rowH = Math.min(52, 500 / Math.max(1, count - 1));

    this.add
      .text(railX, topY - 34, 'Every avatar fights with their real deck and temperament.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    for (let tier = count; tier >= 1; tier--) {
      const rowIndex = count - tier; // 0 at top
      const y = topY + rowIndex * rowH;
      const av = AVATARS.find((a) => a.tier === tier);
      if (!av) continue;

      const box = this.add
        .rectangle(railX, y, 420, rowH - 12, theme.graphics.rowFill, theme.alpha.panel)
        .setStrokeStyle(2, colorInt(theme.colors.panelStroke))
        .setInteractive({ useHandCursor: true });
      this.add
        .text(railX - 195, y, av.name, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(railX + 195, y, '★'.repeat(this.difficultyPips(av)), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(1, 0.5);

      bindTapButton(this, box, () => {
        this.selectedTier = tier;
        this.refreshRoster();
        this.buildPanel();
      });
      inflateHitArea(box, 90, rowH);
      box.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch && tier !== this.selectedTier) box.setStrokeStyle(2, theme.graphics.rowFillActive);
      });
      box.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.refreshRoster();
      });
      this.rowNodes.push({ tier, box });
    }
    this.refreshRoster();
  }

  private refreshRoster(): void {
    for (const node of this.rowNodes) {
      const isSelected = node.tier === this.selectedTier;
      node.box.setFillStyle(isSelected ? theme.graphics.rowFillActive : theme.graphics.rowFill, 1);
      node.box.setStrokeStyle(isSelected ? 3 : 2, colorInt(isSelected ? theme.colors.goldHover : theme.colors.panelStroke));
    }
  }

  // ---------------------------------------------------------------------
  /** Left detail panel: the gauntlet's avatar-card presentation minus the
   *  tower plumbing (no reward line, no lock states, no abandon). */
  private buildPanel(): void {
    this.panel?.destroy();
    const av = AVATARS.find((a) => a.tier === this.selectedTier);
    if (!av) return;
    const c = this.add.container(0, 0);

    const px = 300;
    const portraitY = 300;

    const frame = panel(this, px - 134, portraitY - 168, 268, 336, { alpha: 1 });
    c.add(frame);
    this.addPortrait(c, av.portraitCardId, px, portraitY);

    const chip = this.add
      .text(px, portraitY + 190, av.theme, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
      })
      .setOrigin(0.5);
    c.add(chip);

    const textX = px + 200;
    const COL_W = 300;
    const nameText = this.add
      .text(textX, 150, av.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0, 0);
    nameText.setScale(Math.min(1, COL_W / Math.max(1, nameText.width)));
    c.add(nameText);
    c.add(
      this.add
        .text(textX, 196, av.title, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.body}px`,
          fontStyle: 'italic',
          color: theme.colors.gold,
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0),
    );

    c.add(
      this.add
        .text(textX, 232, `${'★'.repeat(this.difficultyPips(av))}   (${av.difficulty})   ·   Tower rung ${av.tier}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0),
    );

    c.add(
      this.add
        .text(textX, 274, av.blurb, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          lineSpacing: 4,
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0),
    );

    const duel = themedButton(this, textX + 104, 478, 'Duel', {
      variant: 'primary',
      minWidth: 208,
      onTap: () => this.scene.start('Duel', { opponentId: av.id }),
    });
    c.add(duel.container);

    this.panel = c;
  }

  // ---------------------------------------------------------------------
  /** Plain training duels: the old Practice rows, one line at the bottom. */
  private buildTrainingRow(): void {
    const y = 660;
    this.add
      .text(64, y, 'Training duel:', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    const difficulties = ['easy', 'medium', 'hard'] as const;
    difficulties.forEach((difficulty, i) => {
      const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      themedButton(this, 280 + i * 150, y, label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 130,
        onTap: () => this.scene.start('Duel', { difficulty }),
      });
    });
  }

  /**
   * Render the avatar's portrait card art large, cropped to the upper "bust"
   * band; silent fallback if art is missing. Mirrors GauntletScene.addPortrait
   * (kept duplicated: both are scene-bound one-pagers; extract to a shared
   * widget only when a third consumer appears).
   */
  private addPortrait(c: Phaser.GameObjects.Container, cardId: string, x: number, y: number): void {
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const img = this.add.image(x, y, ref.textureKey, ref.frameName);
      const targetW = 260;
      const targetH = 328;
      const scale = Math.max(targetW / img.width, targetH / img.height) * 1.12;
      img.setScale(scale);
      img.y = y - 26; // bias upward toward the face
      const maskShape = this.add
        .rectangle(x, y, targetW, targetH, colorInt(theme.colors.heading))
        .setVisible(false);
      const mask = maskShape.createGeometryMask();
      img.setMask(mask);
      c.add(img);
      c.add(maskShape);
    } catch {
      // no art — the framed panel alone is an acceptable fallback
    }
  }
}
