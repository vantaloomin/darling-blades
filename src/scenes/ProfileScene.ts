import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { computeProfile, formatRate, type Difficulty } from '../meta/profileStats';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Read-only career-record screen (Profile button on MainMenu). Surfaces the
 * stats the engine already tracks but nothing rendered before — win/loss,
 * win-rate by difficulty, packs opened, and gauntlet best rung + clears — via
 * the pure computeProfile() summary. No engine/save mutation.
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  create(): void {
    applyBackdrop(this, 'mainmenu', {
      dim: 0x0d0a14,
      dimAlpha: 0.62,
      fallback: () => {
        /* no art on disk — the #0d0a14 canvas clear shows */
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const p = computeProfile(Services.save.data);

    this.add
      .text(640, 84, 'Profile', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '44px', color: '#f0e6ff' })
      .setOrigin(0.5);

    // Headline: overall record + win rate.
    this.add
      .text(640, 176, `${p.wins} W  –  ${p.losses} L`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#ffd88a',
      })
      .setOrigin(0.5);
    this.add
      .text(
        640,
        220,
        p.games > 0 ? `${formatRate(p.winRate)} win rate over ${p.games} duels` : 'No duels played yet',
        { fontFamily: 'Inter, Arial, sans-serif', fontSize: '17px', color: '#8f83a8' },
      )
      .setOrigin(0.5);

    // Win-rate by difficulty (byDifficulty is already keyed easy/medium/hard).
    this.sectionLabel(300, 'Practice by difficulty');
    p.byDifficulty.forEach((d, i) => {
      const y = 340 + i * 40;
      this.add
        .text(440, y, DIFFICULTY_LABEL[d.key], {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '20px',
          color: '#c9bde0',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(840, y, `${d.w} – ${d.l}      ${formatRate(d.rate)}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '20px',
          color: d.rate === null ? '#57506b' : '#e0d8f0',
        })
        .setOrigin(1, 0.5);
    });

    // Gauntlet + collection progress.
    this.sectionLabel(496, 'Gauntlet & collection');
    this.statRow(536, 'Best rung reached', p.bestRung > 0 ? `Rung ${p.bestRung}` : '—');
    this.statRow(576, 'Full gauntlet clears', `${p.completions}`);
    this.statRow(616, 'Packs opened', `${p.packsOpened}`);

    const back = this.add
      .text(640, 672, '← Back', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '28px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', (pt: Phaser.Input.Pointer) => {
      if (!pt.wasTouch) back.setColor('#ffd700');
    });
    back.on('pointerout', (pt: Phaser.Input.Pointer) => {
      if (!pt.wasTouch) back.setColor('#c9bde0');
    });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);
  }

  private sectionLabel(y: number, text: string): void {
    this.add
      .text(440, y, text, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '18px', color: '#c7a8f0' })
      .setOrigin(0, 0.5);
  }

  private statRow(y: number, label: string, value: string): void {
    this.add
      .text(440, y, label, { fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', color: '#c9bde0' })
      .setOrigin(0, 0.5);
    this.add
      .text(840, y, value, { fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', color: '#e0d8f0' })
      .setOrigin(1, 0.5);
  }
}
