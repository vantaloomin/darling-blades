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
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, goldBadge, pager, panel, themedButton } from '../ui/themeWidgets';

const DESIGN_W = 1280;
const DESIGN_H = 720;

const BUCKET_LABEL: Record<AchievementStatus['def']['bucket'], string> = {
  collection: 'Collection',
  variants: 'Variants',
  theme: 'Theme',
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

const PER_PAGE = 20;

/** Goal grid and collection completion summary for Road-to-1.0 Feature 5. */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  create(data: { page?: number } = {}): void {
    applyBackdrop(this, 'collection', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.74,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.dim),
          colorInt(theme.colors.dim),
          1,
        );
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
    const pageCount = Math.max(1, Math.ceil(statuses.length / PER_PAGE));
    const page = Math.min(Math.max(0, data.page ?? 0), pageCount - 1);
    const visibleStatuses = statuses.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const unlocked = statuses.filter((s) => s.unlocked).length;
    const claimed = statuses.filter((s) => s.claimed).length;
    const claimable = statuses.filter((s) => s.unlocked && !s.claimed);
    const claimableGold = claimable.reduce((sum, s) => sum + s.def.reward.gold, 0);

    this.add
      .text(DESIGN_W / 2, 44, 'Achievements', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(
        DESIGN_W / 2,
        86,
        `${unlocked}/${statuses.length} unlocked   ${claimed}/${statuses.length} claimed   Page ${page + 1}/${pageCount}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5);

    backButton(this, () => this.scene.start('MainMenu'));

    if (claimable.length > 0) {
      themedButton(this, DESIGN_W - 140, 30, `Claim All +${claimableGold} Gold`, {
        variant: 'primary',
        minWidth: 220,
        onTap: () => {
        const result = claimAllAchievements(save);
        if (result.gold > 0) {
          Services.save.flush();
          Sfx.play('coin');
        }
        this.scene.restart({ page });
        },
      });
    } else {
      goldBadge(this, DESIGN_W - 30, 30, { getValue: () => save.gold });
    }

    this.drawCompletionPanel();
    visibleStatuses.forEach((status, index) => {
      const col = index < 10 ? 0 : 1;
      const row = index % 10;
      this.drawAchievementRow(status, col === 0 ? 86 : 666, 158 + row * 52, 528, page);
    });
    this.drawPagingControls(page, pageCount);
  }

  private drawCompletionPanel(): void {
    const completion = collectionCompletion(ALL_CARDS, Services.save.data);
    panel(this, 86, 108, 1108, 34, { alpha: theme.alpha.panel });

    const colorText = completion.byColor
      .map((row) => `${COLOR_LABEL[row.key]} ${row.owned}/${row.total}`)
      .join('   ');
    this.add
      .text(
        104,
        125,
        `Pool ${completion.owned}/${completion.total} (${pct(completion.percent)})   Special cards ${completion.variants.specialCards}   ${colorText}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        },
      )
      .setOrigin(0, 0.5);
  }

  private drawAchievementRow(status: AchievementStatus, x: number, y: number, w: number, page: number): void {
    const h = 44;
    const claimable = status.unlocked && !status.claimed;
    const g = this.add.graphics();
    g.fillStyle(status.unlocked ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, colorInt(claimable ? theme.colors.gold : theme.colors.panelStroke), theme.alpha.chrome);
    g.strokeRoundedRect(x, y, w, h, 6);

    this.add
      .text(x + 14, y + 11, status.def.title, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w700,
        color: status.unlocked ? theme.colors.heading : theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 14, y + 30, `${BUCKET_LABEL[status.def.bucket]} - ${status.def.description}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);

    const progress = `${Math.min(status.current, status.target)}/${status.target}`;
    this.add
      .text(x + w - 118, y + 14, progress, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: status.unlocked ? theme.colors.gold : theme.colors.body,
      })
      .setOrigin(1, 0.5);

    if (claimable) {
      const btn = themedButton(this, x + w - 72, y + 22, `Claim +${status.def.reward.gold}`, {
        variant: 'primary',
        size: 'sm',
        minWidth: 112,
        onTap: () => {
        const result = claimAchievement(Services.save.data, status.def.id);
        if (result.ok) {
          Services.save.flush();
          Sfx.play('coin');
          btn.setVariant('ghost');
          btn.setLabel('Claimed');
        }
        this.scene.restart({ page });
        },
      });
    } else {
      this.add
        .text(x + w - 14, y + 30, status.claimed ? 'Claimed' : status.unlocked ? 'Unlocked' : `${pct(status.percent)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: status.claimed ? theme.colors.success : status.unlocked ? theme.colors.gold : theme.colors.muted,
        })
        .setOrigin(1, 0.5);
    }
  }

  private drawPagingControls(page: number, pageCount: number): void {
    if (pageCount <= 1) return;
    pager(this, DESIGN_W / 2 - 56, 690, page, pageCount, (nextPage) => this.scene.restart({ page: nextPage }));
  }
}
