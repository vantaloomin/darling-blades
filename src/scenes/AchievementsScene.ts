import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import {
  claimAchievement,
  claimAllAchievements,
  evaluateAchievements,
  syncAchievements,
  type AchievementStatus,
} from '../meta/Achievements';
import { collectionCompletion } from '../meta/collectionFilter';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';

const DESIGN_W = 1280;
const DESIGN_H = 720;

const BUCKET_LABEL: Record<AchievementStatus['def']['bucket'], string> = {
  collection: 'Collection',
  variants: 'Variants',
  mastery: 'Mastery',
  economy: 'Economy',
};

const COLOR_LABEL: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Goal grid and collection completion summary for Road-to-1.0 Feature 5. */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  create(): void {
    applyBackdrop(this, 'collection', {
      dim: 0x0b0812,
      dimAlpha: 0.74,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        bg.fillRect(0, 0, DESIGN_W, DESIGN_H);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');

    const save = Services.save.data;
    if (syncAchievements(save, CARD_DB).length > 0) Services.save.flush();
    const statuses = evaluateAchievements(save, CARD_DB);
    const unlocked = statuses.filter((s) => s.unlocked).length;
    const claimed = statuses.filter((s) => s.claimed).length;
    const claimable = statuses.filter((s) => s.unlocked && !s.claimed);
    const claimableGold = claimable.reduce((sum, s) => sum + s.def.reward.gold, 0);

    this.add
      .text(DESIGN_W / 2, 44, 'Achievements', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '42px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(DESIGN_W / 2, 86, `${unlocked}/${statuses.length} unlocked   ${claimed}/${statuses.length} claimed`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#a89cc6',
      })
      .setOrigin(0.5);

    const back = this.add
      .text(30, 28, '<- Menu', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 70);

    if (claimable.length > 0) {
      const claimAll = this.add
        .text(DESIGN_W - 30, 28, `Claim All +${claimableGold} Gold`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '18px',
          fontStyle: '600',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 12, y: 7 },
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, claimAll, () => {
        const result = claimAllAchievements(save);
        if (result.gold > 0) {
          Services.save.flush();
          Sfx.play('coin');
        }
        this.scene.restart();
      });
      inflateHitArea(claimAll, 140, 52);
    } else {
      this.add
        .text(DESIGN_W - 30, 28, `Gold ${save.gold}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '18px',
          fontStyle: '600',
          color: '#ffd88a',
        })
        .setOrigin(1, 0);
    }

    this.drawCompletionPanel();
    statuses.forEach((status, index) => {
      const col = index < 10 ? 0 : 1;
      const row = index % 10;
      this.drawAchievementRow(status, col === 0 ? 86 : 666, 158 + row * 52, 528);
    });
  }

  private drawCompletionPanel(): void {
    const completion = collectionCompletion(ALL_CARDS, Services.save.data);
    const g = this.add.graphics();
    g.fillStyle(0x151022, 0.86);
    g.fillRoundedRect(86, 108, 1108, 34, 6);
    g.lineStyle(1, 0x3d3060, 0.9);
    g.strokeRoundedRect(86, 108, 1108, 34, 6);

    const colorText = completion.byColor
      .map((row) => `${COLOR_LABEL[row.key]} ${row.owned}/${row.total}`)
      .join('   ');
    this.add
      .text(
        104,
        125,
        `Pool ${completion.owned}/${completion.total} (${pct(completion.percent)})   Special cards ${completion.variants.specialCards}   ${colorText}`,
        {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#c9bde0',
        },
      )
      .setOrigin(0, 0.5);
  }

  private drawAchievementRow(status: AchievementStatus, x: number, y: number, w: number): void {
    const h = 44;
    const claimable = status.unlocked && !status.claimed;
    const g = this.add.graphics();
    g.fillStyle(status.claimed ? 0x151b24 : status.unlocked ? 0x201832 : 0x11101a, 0.9);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, claimable ? 0xffd88a : status.unlocked ? 0x6a4fa3 : 0x2f2942, 0.95);
    g.strokeRoundedRect(x, y, w, h, 6);

    this.add
      .text(x + 14, y + 11, status.def.title, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: status.unlocked ? '#f0e6ff' : '#8f83a8',
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 14, y + 30, `${BUCKET_LABEL[status.def.bucket]} - ${status.def.description}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        color: '#8f83a8',
      })
      .setOrigin(0, 0.5);

    const progress = `${Math.min(status.current, status.target)}/${status.target}`;
    this.add
      .text(x + w - 118, y + 14, progress, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: status.unlocked ? '#ffd88a' : '#c9bde0',
      })
      .setOrigin(1, 0.5);

    if (claimable) {
      const btn = this.add
        .text(x + w - 92, y + 22, `Claim +${status.def.reward.gold}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 9, y: 6 },
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, () => {
        const result = claimAchievement(Services.save.data, status.def.id);
        if (result.ok) {
          Services.save.flush();
          Sfx.play('coin');
        }
        this.scene.restart();
      });
      inflateHitArea(btn, 90, 44);
    } else {
      this.add
        .text(x + w - 14, y + 30, status.claimed ? 'Claimed' : status.unlocked ? 'Unlocked' : `${pct(status.percent)}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          fontStyle: '600',
          color: status.claimed ? '#9be6a8' : status.unlocked ? '#ffd88a' : '#6a6482',
        })
        .setOrigin(1, 0.5);
    }
  }
}
