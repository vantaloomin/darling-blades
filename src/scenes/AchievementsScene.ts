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
import { def } from '../engine/types';
import type { AnimationLevel } from '../platform/animPolicy';
import {
  achievementCascadeDelay,
  achievementCascadeDuration,
  achievementClaimMotion,
  achievementClaimPitch,
  hallWingFrames,
  togglePin,
  wingFurnishings,
  wingSummaries,
  type HallBucket,
  type WingSummary,
} from '../ui/achievementPresentation';
import { CardView } from '../ui/CardView';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { colorInt, theme } from '../ui/theme';
import {
  pager,
  panel,
  registerSceneBackNavigation,
  roundedTrigger,
  sceneHeaderFooter,
  themedButton,
  type ThemedButton,
} from '../ui/themeWidgets';

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
const COPY_MAX_W = 286;
const GAUGE_CENTER = 326;
const PROGRESS_LEFT = 350;
const REWARD_RIGHT = 538;
const CLAIM_CENTER = 396;
const CLAIM_SEAL_W = 84;
const CLAIM_SEAL_H = 30;

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
type HallView = 'hall' | 'list';
interface AchievementsRoute {
  page: number;
  filter: AchievementFilter;
  view: HallView;
  bucket: HallBucket | 'all';
}

interface ClaimSealTarget {
  x: number;
  y: number;
}

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
  /** The current hall/list position; every restart re-enters through it. */
  private route: AchievementsRoute = { page: 0, filter: 'all', view: 'hall', bucket: 'all' };

  constructor() {
    super('Achievements');
  }

  create(
    data: { page?: number; filter?: AchievementFilter; view?: HallView; bucket?: HallBucket | 'all' } = {},
  ): void {
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
    // Recovery sync, deliberately kept ALONGSIDE the mutation checkpoints:
    // imported save codes, migrations, and dev grants change the save outside
    // any checkpoint, and claiming validates against the persisted unlocked
    // list — without this, such saves show satisfied plaques that refuse to
    // claim. Checkpoints make unlocks immediate; this makes them recoverable.
    if (syncAchievements(save, CARD_DB).length > 0) Services.save.flush();
    const statuses = evaluateAchievements(save, CARD_DB);
    const filter = data.filter ?? 'all';
    const view: HallView = data.view ?? 'hall';
    const bucket = data.bucket ?? 'all';
    const bucketStatuses =
      bucket === 'all' ? statuses : statuses.filter((status) => status.def.bucket === bucket);
    const filteredStatuses = filterStatuses(bucketStatuses, filter);
    const pageCount = Math.max(1, Math.ceil(filteredStatuses.length / PER_PAGE));
    const page = Math.min(Math.max(0, data.page ?? 0), pageCount - 1);
    this.route = { page, filter, view, bucket };
    const visibleStatuses = filteredStatuses.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const unlocked = statuses.filter((s) => s.unlocked).length;
    const claimed = statuses.filter((s) => s.claimed).length;
    const claimable = statuses.filter((s) => s.unlocked && !s.claimed);
    const claimableGold = claimable.reduce((sum, s) => sum + s.def.reward.gold, 0);
    const animationLevel = save.settings.animations;
    const visibleClaimTargets = new Map<string, ClaimSealTarget>();
    const claimButtons: ThemedButton[] = [];
    let claimAllButton: ThemedButton | null = null;
    const disableClaimControls = (): void => {
      claimAllButton?.setEnabled(false);
      claimButtons.forEach((button) => button.setEnabled(false));
    };

    const chrome = sceneHeaderFooter(this, {
      title: 'Achievements',
      backLabel: 'Menu',
      onBack: () => this.scene.start('MainMenu'),
      showCurrency: false,
    });
    registerSceneBackNavigation(this, () => this.scene.start('MainMenu'));
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
      claimAllButton = themedButton(this, 0, theme.design.headerCenterY, `Claim All +${claimableGold} Gold`, {
        variant: 'primary',
        minWidth: 220,
        onTap: () => {
          disableClaimControls();
          const result = claimAllAchievements(save);
          if (result.gold > 0) {
            Services.save.flush();
            const claimedIds = new Set(result.ids);
            const targets = visibleStatuses
              .filter((status) => claimedIds.has(status.def.id))
              .flatMap((status) => {
                const target = visibleClaimTargets.get(status.def.id);
                return target ? [target] : [];
              });
            const fallbackTarget = {
              x: claimAllButton?.container.x ?? theme.design.safeRight,
              y: theme.design.headerCenterY,
            };
            this.playClaimCascade(
              targets.length > 0 ? targets : [fallbackTarget],
              animationLevel,
              () => {
                Sfx.play('coin');
                this.scene.restart(this.route);
              },
            );
            return;
          }
          this.scene.restart(this.route);
        },
      });
      const claimAllWidth = claimAllButton.getMeasuredSize().visual.width;
      claimAllButton.container
        .setX(theme.design.safeRight - claimAllWidth / 2)
        .setDepth(theme.depth.hud);
    }
    // No idle gold badge here: currency shows only on the main menu and the
    // Shop (user decision 2026-07-12); Claim All still names its payout.

    this.drawCompletionPanel();
    this.drawViewToggle();
    if (view === 'hall') {
      this.drawHall(statuses);
      return;
    }
    this.drawFilters(filter);
    visibleStatuses.forEach((status, index) => {
      const col = index < ROWS_PER_COLUMN ? 0 : 1;
      const row = index % ROWS_PER_COLUMN;
      const x = CONTENT_X + col * (ROW_W + COLUMN_GAP);
      const y = ROW_Y + row * ROW_PITCH;
      if (status.unlocked && !status.claimed) {
        visibleClaimTargets.set(status.def.id, { x: x + CLAIM_CENTER, y: y + ROW_H / 2 });
      }
      const claimButton = this.drawAchievementRow(
        status,
        x,
        y,
        page,
        filter,
        animationLevel,
        disableClaimControls,
      );
      if (claimButton) claimButtons.push(claimButton);
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
    this.drawPagingControls(page, pageCount);
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

  /** Hall ⇄ List chips at the content's left edge; a bucket chip clears the wing scope. */
  private drawViewToggle(): void {
    (['hall', 'list'] as const).forEach((key, index) => {
      roundedTrigger(this, CONTENT_X + 52 + index * 120, FILTER_Y, key === 'hall' ? 'Hall' : 'List', {
        size: 'sm',
        minWidth: 104,
        selected: this.route.view === key,
        onTap: () => this.scene.restart({ ...this.route, page: 0, view: key }),
      });
    });
    if (this.route.view === 'list' && this.route.bucket !== 'all') {
      roundedTrigger(
        this,
        CONTENT_X + CONTENT_W - 88,
        FILTER_Y,
        `${BUCKET_LABEL[this.route.bucket]} ✕`,
        {
          size: 'sm',
          minWidth: 150,
          selected: true,
          onTap: () => this.scene.restart({ ...this.route, page: 0, bucket: 'all' }),
        },
      );
    }
  }

  /** The Trophy Hall: five wings, one per bucket, each a plinth into its list. */
  private drawHall(statuses: AchievementStatus[]): void {
    const save = Services.save.data;
    const owned = Object.keys(save.collection);
    const byId = new Map(statuses.map((status) => [status.def.id, status]));
    const frames = hallWingFrames();
    wingSummaries(statuses).forEach((wing, index) => {
      const f = frames[index];
      panel(this, f.x, f.y, f.w, f.h, { alpha: theme.alpha.panel });
      // Card art furnishes the room: two owned thumbs lean behind the plinth.
      wingFurnishings(wing.bucket, owned).forEach((cardId, t) => {
        const thumb = new CardView(this, f.x + f.w - 54 - t * 42, f.y + f.h - 96);
        thumb.setScale(0.15).setAngle(t === 0 ? 5 : -6).setAlpha(0.45);
        thumb.setCard(def(CARD_DB, cardId), { fx: 'none' });
      });
      this.add
        .text(f.x + 18, f.y + 28, BUCKET_LABEL[wing.bucket], {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h2}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(
          f.x + 18,
          f.y + 56,
          `${wing.claimed}/${wing.total} claimed${wing.ready > 0 ? ` · ${wing.ready} ready` : ''}`,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: wing.ready > 0 ? theme.colors.gold : theme.colors.muted,
          },
        )
        .setOrigin(0, 0.5);
      this.drawWingGauge(f.x + f.w - 46, f.y + 44, wing);
      const featured = wing.featuredId ? byId.get(wing.featuredId) : undefined;
      if (featured) {
        const py = f.y + f.h - 70;
        const pw = f.w - 130;
        const plinth = this.add.graphics();
        const ready = featured.unlocked && !featured.claimed;
        plinth.fillStyle(theme.graphics.rowFill, theme.alpha.panel);
        plinth.fillRoundedRect(f.x + 14, py, pw, 54, theme.radius.control);
        plinth.lineStyle(
          theme.control.borderWidth,
          colorInt(ready ? theme.colors.gold : theme.colors.success),
          theme.alpha.chrome,
        );
        plinth.strokeRoundedRect(f.x + 14, py, pw, 54, theme.radius.control);
        const title = this.add
          .text(f.x + 26, py + 18, '', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w700,
            color: ready ? theme.colors.heading : theme.colors.success,
          })
          .setOrigin(0, 0.5);
        ellipsize(title, featured.def.title, pw - 24);
        this.add
          .text(f.x + 26, py + 39, ready ? 'Ready to claim' : 'Claimed', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            fontStyle: theme.weight.w700,
            color: ready ? theme.colors.gold : theme.colors.success,
          })
          .setOrigin(0, 0.5);
      } else {
        this.add
          .text(f.x + 18, f.y + f.h - 44, 'No trophies here yet.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0, 0.5);
      }
      const zone = this.add
        .zone(f.x + f.w / 2, f.y + f.h / 2, f.w, f.h)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.rightButtonReleased()) return;
        this.scene.restart({ page: 0, filter: 'all', view: 'list', bucket: wing.bucket });
      });
    });
  }

  /** Wing-sized claim ring: the bucket's claimed fraction with a center count. */
  private drawWingGauge(x: number, y: number, wing: WingSummary): void {
    const gauge = this.add.graphics();
    gauge.lineStyle(4, theme.graphics.panelStroke, theme.alpha.subtle);
    gauge.strokeCircle(x, y, 22);
    if (wing.percent > 0) {
      const accent = colorInt(wing.percent >= 1 ? theme.colors.success : theme.colors.gold);
      gauge.lineStyle(4, accent, 1);
      if (wing.percent >= 1) gauge.strokeCircle(x, y, 22);
      else {
        gauge.beginPath();
        gauge.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wing.percent, false);
        gauge.strokePath();
      }
    }
    this.add
      .text(x, y, `${Math.round(wing.percent * 100)}%`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.body,
      })
      .setOrigin(0.5);
  }

  /** 📌 on a claimed row: pin to (or unpin from) the Profile showcase. */
  private drawPinToggle(id: string, x: number, y: number): void {
    const save = Services.save.data;
    const pinned = save.achievements.pinned.includes(id);
    this.add
      .text(x, y, '📌', { fontSize: '18px' })
      .setOrigin(0.5)
      .setAlpha(pinned ? 1 : 0.3);
    const zone = this.add.zone(x, y, 44, 44).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      save.achievements.pinned = togglePin(save.achievements.pinned, id);
      Services.save.touch();
      this.scene.restart(this.route);
    });
  }

  private drawFilters(selected: AchievementFilter): void {
    const totalWidth = FILTERS.length * FILTER_W + (FILTERS.length - 1) * FILTER_GAP;
    const startX = theme.design.centerX - totalWidth / 2;
    FILTERS.forEach((filter, index) => {
      roundedTrigger(this, startX + index * (FILTER_W + FILTER_GAP), FILTER_Y, filter.label, {
        size: 'sm',
        minWidth: FILTER_W,
        selected: filter.key === selected,
        onTap: () => this.scene.restart({ ...this.route, page: 0, filter: filter.key }),
      });
    });
  }

  private drawAchievementRow(
    status: AchievementStatus,
    x: number,
    y: number,
    page: number,
    filter: AchievementFilter,
    animationLevel: AnimationLevel,
    disableClaimControls: () => void,
  ): ThemedButton | null {
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
    // A claimed row's gauge is a full circle saying nothing; the slot becomes
    // the showcase pin toggle instead.
    if (claimed) this.drawPinToggle(status.def.id, x + GAUGE_CENTER, centerY);
    else this.drawProgressGauge(status, x + GAUGE_CENTER, centerY);

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
        .text(x + PROGRESS_LEFT, centerY, progress, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: claimed ? theme.colors.muted : theme.colors.body,
        })
        .setOrigin(0, 0.5);
    } else {
      const claimButton = themedButton(this, x + CLAIM_CENTER, centerY, 'Claim', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: 90,
        onTap: () => {
          disableClaimControls();
          const result = claimAchievement(Services.save.data, status.def.id);
          if (result.ok) {
            Services.save.flush();
            this.playClaimCascade([{ x: x + CLAIM_CENTER, y: centerY }], animationLevel, () => {
              Sfx.play('coin');
              this.scene.restart(this.route);
            });
            return;
          }
          this.scene.restart(this.route);
        },
      });
      return claimButton;
    }
    return null;
  }

  private drawProgressGauge(status: AchievementStatus, x: number, y: number): void {
    const progress = Math.min(1, Math.max(0, status.percent));
    const accent = colorInt(status.claimed ? theme.colors.success : theme.colors.gold);
    const gauge = this.add.graphics();
    gauge.lineStyle(3, theme.graphics.panelStroke, theme.alpha.subtle);
    gauge.strokeCircle(x, y, 14);
    if (progress <= 0) return;

    gauge.lineStyle(3, accent, status.claimed ? theme.alpha.chrome : 1);
    if (progress >= 1) {
      gauge.strokeCircle(x, y, 14);
    } else {
      gauge.beginPath();
      gauge.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
      gauge.strokePath();
    }
    gauge.fillStyle(accent, 0.12);
    gauge.fillCircle(x, y, 9);
  }

  private createClaimSeal(target: ClaimSealTarget): Phaser.GameObjects.Container {
    const seal = this.add.container(target.x, target.y).setDepth(theme.depth.reveal);
    const plate = this.add.graphics();
    plate.fillStyle(theme.graphics.panelFill, 0.96);
    plate.fillRoundedRect(-CLAIM_SEAL_W / 2, -CLAIM_SEAL_H / 2, CLAIM_SEAL_W, CLAIM_SEAL_H, theme.radius.control);
    plate.lineStyle(2, colorInt(theme.colors.success), 0.98);
    plate.strokeRoundedRect(-CLAIM_SEAL_W / 2, -CLAIM_SEAL_H / 2, CLAIM_SEAL_W, CLAIM_SEAL_H, theme.radius.control);
    plate.lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome);
    plate.strokeRoundedRect(
      -CLAIM_SEAL_W / 2 + 4,
      -CLAIM_SEAL_H / 2 + 4,
      CLAIM_SEAL_W - 8,
      CLAIM_SEAL_H - 8,
      theme.radius.control - 2,
    );
    const label = this.add
      .text(0, 0, 'CLAIMED', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.success,
      })
      .setOrigin(0.5);
    seal.add([plate, label]);
    return seal;
  }

  private playClaimCascade(
    targets: readonly ClaimSealTarget[],
    animationLevel: AnimationLevel,
    onComplete: () => void,
  ): void {
    if (targets.length === 0) {
      onComplete();
      return;
    }
    if (animationLevel === 'off') {
      Sfx.play('seal');
      onComplete();
      return;
    }

    // The mutation is already durable. Hold navigation briefly so the scene
    // cannot be torn down halfway through its confirmation choreography.
    const inputShield = this.add
      .zone(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H)
      .setInteractive()
      .setDepth(theme.depth.reveal - 1);
    targets.forEach((target, index) => {
      this.time.delayedCall(achievementCascadeDelay(index, animationLevel), () => {
        if (!this.sys.isActive()) return;
        this.playClaimStamp(target, animationLevel, achievementClaimPitch(index, targets.length));
      });
    });
    this.time.delayedCall(achievementCascadeDuration(targets.length, animationLevel), () => {
      if (!this.sys.isActive()) return;
      inputShield.destroy();
      onComplete();
    });
  }

  private playClaimStamp(target: ClaimSealTarget, animationLevel: AnimationLevel, pitch: number): void {
    const motion = achievementClaimMotion(animationLevel);
    const seal = this.createClaimSeal(target)
      .setAlpha(0)
      .setScale(motion.scaleFrom)
      .setAngle(motion.angleFrom);
    Sfx.play('seal', { pitch });
    this.tweens.add({
      targets: seal,
      alpha: 1,
      scale: 1,
      angle: motion.angleTo,
      duration: motion.stampMs,
      ease: theme.motion.easeOut,
    });
  }

  private drawPagingControls(page: number, pageCount: number): void {
    if (pageCount <= 1) return;
    pager(this, DESIGN_W / 2 - 44, theme.design.footerCenterY, page, pageCount, (nextPage) =>
      this.scene.restart({ ...this.route, page: nextPage }),
    );
  }
}
