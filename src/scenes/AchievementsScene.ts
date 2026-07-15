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
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { colorInt, theme } from '../ui/theme';
import { pager, panel, roundedTrigger, sceneHeaderFooter, themedButton } from '../ui/themeWidgets';

const DESIGN_W = 1280;
const DESIGN_H = 720;
const PER_PAGE = 16;
const ROWS_PER_COLUMN = 8;

const CONTENT_X = 72;
const CONTENT_W = 1136;
const COLUMN_GAP = 32;
const ROW_W = (CONTENT_W - COLUMN_GAP) / 2;
const ROW_Y = 196;
const ROW_H = 50;
const ROW_PITCH = 56;
const COPY_MAX_W = 300;
const PROGRESS_RIGHT = 420;
const REWARD_RIGHT = 538;
const CLAIM_CENTER = 375;

const SUMMARY_Y = 106;
const SUMMARY_H = 40;
const SUMMARY_POOL_W = 250;
const SUMMARY_SPECIAL_W = 190;
const FILTER_Y = 164;
const FILTER_W = 104;
const FILTER_GAP = 16;

const BUCKET_LABEL: Record<AchievementStatus['def']['bucket'], string> = {
  collection: 'Collection',
  variants: 'Variants',
  theme: 'Theme',
  mastery: 'Mastery',
  economy: 'Economy',
};

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;

type AchievementFilter = 'all' | 'ready' | 'in-progress' | 'claimed';

const FILTERS: readonly { key: AchievementFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'claimed', label: 'Claimed' },
];

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function filterStatuses(statuses: AchievementStatus[], filter: AchievementFilter): AchievementStatus[] {
  if (filter === 'ready') return statuses.filter((status) => status.unlocked && !status.claimed);
  if (filter === 'in-progress') return statuses.filter((status) => !status.unlocked);
  if (filter === 'claimed') return statuses.filter((status) => status.claimed);
  return statuses;
}

function ellipsize(text: Phaser.GameObjects.Text, value: string, maxWidth: number): void {
  text.setText(value);
  if (text.width <= maxWidth) return;

  let low = 0;
  let high = value.length;
  while (low < high) {
    const length = Math.ceil((low + high) / 2);
    text.setText(`${value.slice(0, length).trimEnd()}…`);
    if (text.width <= maxWidth) low = length;
    else high = length - 1;
  }
  text.setText(`${value.slice(0, low).trimEnd()}…`);
}

/** Goal grid and collection completion summary for Road-to-1.0 Feature 5. */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  create(data: { page?: number; filter?: AchievementFilter } = {}): void {
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
    bakeManaSymbols(this);
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop');

    const save = Services.save.data;
    if (syncAchievements(save, CARD_DB).length > 0) Services.save.flush();
    const statuses = evaluateAchievements(save, CARD_DB);
    const filter = data.filter ?? 'all';
    const filteredStatuses = filterStatuses(statuses, filter);
    const pageCount = Math.max(1, Math.ceil(filteredStatuses.length / PER_PAGE));
    const page = Math.min(Math.max(0, data.page ?? 0), pageCount - 1);
    const visibleStatuses = filteredStatuses.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const unlocked = statuses.filter((s) => s.unlocked).length;
    const claimed = statuses.filter((s) => s.claimed).length;
    const claimable = statuses.filter((s) => s.unlocked && !s.claimed);
    const claimableGold = claimable.reduce((sum, s) => sum + s.def.reward.gold, 0);

    const chrome = sceneHeaderFooter(this, {
      title: 'Achievements',
      onBack: () => this.scene.start('MainMenu'),
      showCurrency: false,
    });
    chrome.title.setX(theme.design.centerX);

    this.add
      .text(
        DESIGN_W / 2,
        92,
        `${unlocked}/${statuses.length} complete · ${claimable.length} ready to claim · ${claimed} claimed`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5);

    if (claimable.length > 0) {
      const claimAll = themedButton(this, 0, theme.design.headerCenterY, `Claim All +${claimableGold} Gold`, {
        variant: 'primary',
        minWidth: 220,
        onTap: () => {
          const result = claimAllAchievements(save);
          if (result.gold > 0) {
            Services.save.flush();
            Sfx.play('coin');
          }
          this.scene.restart({ page, filter });
        },
      });
      const claimAllWidth = claimAll.getMeasuredSize().visual.width;
      claimAll.container
        .setX(theme.design.safeRight - claimAllWidth / 2)
        .setDepth(theme.depth.hud);
    }
    // No idle gold badge here: currency shows only on the main menu and the
    // Shop (user decision 2026-07-12); Claim All still names its payout.

    this.drawCompletionPanel();
    this.drawFilters(filter);
    visibleStatuses.forEach((status, index) => {
      const col = index < ROWS_PER_COLUMN ? 0 : 1;
      const row = index % ROWS_PER_COLUMN;
      this.drawAchievementRow(
        status,
        CONTENT_X + col * (ROW_W + COLUMN_GAP),
        ROW_Y + row * ROW_PITCH,
        page,
        filter,
      );
    });
    if (visibleStatuses.length === 0) {
      this.add
        .text(theme.design.centerX, ROW_Y + ROW_H / 2, 'No achievements in this state.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    }
    this.drawPagingControls(page, pageCount, filter);
  }

  private drawCompletionPanel(): void {
    const completion = collectionCompletion(ALL_CARDS, Services.save.data);
    panel(this, CONTENT_X, SUMMARY_Y, CONTENT_W, SUMMARY_H, { alpha: theme.alpha.panel });

    const cellW = (CONTENT_W - SUMMARY_POOL_W - SUMMARY_SPECIAL_W) / COLOR_KEYS.length;
    const separators = this.add.graphics().lineStyle(
      theme.control.borderWidth,
      theme.graphics.panelStroke,
      theme.alpha.chrome,
    );
    const separatorXs = [
      CONTENT_X + SUMMARY_POOL_W,
      CONTENT_X + SUMMARY_POOL_W + SUMMARY_SPECIAL_W,
      ...COLOR_KEYS.slice(1).map(
        (_, index) => CONTENT_X + SUMMARY_POOL_W + SUMMARY_SPECIAL_W + cellW * (index + 1),
      ),
    ];
    separatorXs.forEach((x) => separators.lineBetween(x, SUMMARY_Y + 8, x, SUMMARY_Y + SUMMARY_H - 8));

    this.drawKpi(
      CONTENT_X + 16,
      SUMMARY_Y + SUMMARY_H / 2,
      `Pool ${completion.owned}/${completion.total} · ${pct(completion.percent)}`,
      0,
    );
    this.drawKpi(
      CONTENT_X + SUMMARY_POOL_W + SUMMARY_SPECIAL_W / 2,
      SUMMARY_Y + SUMMARY_H / 2,
      `Special cards ${completion.variants.specialCards}`,
      0.5,
    );

    COLOR_KEYS.forEach((key, index) => {
      const row = completion.byColor.find((entry) => entry.key === key);
      const cellCenterX = CONTENT_X + SUMMARY_POOL_W + SUMMARY_SPECIAL_W + cellW * (index + 0.5);
      this.add.image(cellCenterX - 20, SUMMARY_Y + SUMMARY_H / 2, `pip-${key}`).setDisplaySize(18, 18);
      this.add
        .text(cellCenterX - 6, SUMMARY_Y + SUMMARY_H / 2, `${row?.owned ?? 0}/${row?.total ?? 0}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
    });
  }

  private drawKpi(x: number, y: number, label: string, originX: number): void {
    this.add
      .text(x, y, label, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
      })
      .setOrigin(originX, 0.5);
  }

  private drawFilters(selected: AchievementFilter): void {
    const totalWidth = FILTERS.length * FILTER_W + (FILTERS.length - 1) * FILTER_GAP;
    const startX = theme.design.centerX - totalWidth / 2;
    FILTERS.forEach((filter, index) => {
      roundedTrigger(this, startX + index * (FILTER_W + FILTER_GAP), FILTER_Y, filter.label, {
        size: 'sm',
        minWidth: FILTER_W,
        selected: filter.key === selected,
        onTap: () => this.scene.restart({ page: 0, filter: filter.key }),
      });
    });
  }

  private drawAchievementRow(
    status: AchievementStatus,
    x: number,
    y: number,
    page: number,
    filter: AchievementFilter,
  ): void {
    const claimable = status.unlocked && !status.claimed;
    const claimed = status.claimed;
    const centerY = y + ROW_H / 2;
    const g = this.add.graphics();
    g.fillStyle(
      claimable ? theme.graphics.rowFillActive : theme.graphics.rowFill,
      claimed ? theme.alpha.subtle : theme.alpha.panel,
    );
    g.fillRoundedRect(x, y, ROW_W, ROW_H, theme.radius.control);
    g.lineStyle(
      theme.control.borderWidth,
      colorInt(claimable ? theme.colors.gold : theme.colors.panelStroke),
      claimed ? theme.alpha.subtle : theme.alpha.chrome,
    );
    g.strokeRoundedRect(x, y, ROW_W, ROW_H, theme.radius.control);

    const title = this.add
      .text(x + 14, y + 14, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w700,
        color: claimed ? theme.colors.success : status.unlocked ? theme.colors.heading : theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    ellipsize(title, `${claimed ? '✓ ' : ''}${status.def.title}`, COPY_MAX_W);

    const bucket = this.add
      .text(x + 14, y + 35, `${BUCKET_LABEL[status.def.bucket]} ·`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const goal = this.add
      .text(bucket.x + bucket.width + 5, y + 35, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: claimed ? theme.colors.muted : theme.colors.body,
      })
      .setOrigin(0, 0.5);
    ellipsize(goal, status.def.description, Math.max(0, COPY_MAX_W - bucket.width - 5));

    this.add
      .text(x + REWARD_RIGHT, centerY, `+${status.def.reward.gold} Gold`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: claimable ? theme.colors.gold : claimed ? theme.colors.muted : theme.colors.body,
      })
      .setOrigin(1, 0.5);

    if (!claimable) {
      const progress = `${Math.min(status.current, status.target)}/${status.target} · ${pct(status.percent)}`;
      this.add
        .text(x + PROGRESS_RIGHT, centerY, progress, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: claimed ? theme.colors.muted : theme.colors.body,
        })
        .setOrigin(1, 0.5);
    } else {
      themedButton(this, x + CLAIM_CENTER, centerY, 'Claim', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: 90,
        onTap: () => {
          const result = claimAchievement(Services.save.data, status.def.id);
          if (result.ok) {
            Services.save.flush();
            Sfx.play('coin');
          }
          this.scene.restart({ page, filter });
        },
      });
    }
  }

  private drawPagingControls(page: number, pageCount: number, filter: AchievementFilter): void {
    if (pageCount <= 1) return;
    pager(this, DESIGN_W / 2 - 44, theme.design.footerCenterY, page, pageCount, (nextPage) =>
      this.scene.restart({ page: nextPage, filter }),
    );
  }
}
