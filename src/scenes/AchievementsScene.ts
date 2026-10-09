import Phaser from 'phaser';
import { bakeUiIcon, uiIconSize } from '../ui/uiIcons';
import { formatGold } from '../ui/goldFormat';
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
import { progressPercentLabel } from '../ui/progressPercent';
import { fitMenuName } from '../ui/menuText';
import { Services } from '../meta/services';
import type { SaveData } from '../meta/SaveManager';
import { IS_DEV } from '../platform/env';
import { def } from '../engine/types';
import type { AnimationLevel } from '../platform/animPolicy';
import {
  ACHIEVEMENT_LIST,
  ACHIEVEMENT_ROW,
  achievementListLayout,
  achievementRowLayout,
  hallPlinthLayout,
  HALL_PLINTH,
  type AchievementListLayout,
  type AchievementRowMeasure,
  type AchievementRowLayout,
  achievementCascadeDelay,
  achievementCascadeDuration,
  achievementClaimMotion,
  achievementClaimPitch,
  hallWingFrames,
  HALL_BUCKETS,
  togglePin,
  wingFurnishings,
  wingSummaries,
  type HallBucket,
  type WingSummary,
} from '../ui/achievementPresentation';
import { CardView } from '../ui/CardView';
import { gateOnArt } from '../ui/artGate';
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
const CONTENT_X = ACHIEVEMENT_LIST.x;
const CONTENT_W = ACHIEVEMENT_LIST.width;
/**
 * One list row, left to right: the copy block, the gauge, and the progress
 * column (the readout, or Claim). The copy block's first line carries the
 * title, its wing and the reward; the second line is the goal alone, so a
 * description gets the block's full width. Until 1.8.1 (2026-09-25) the goal
 * shared its line with the wing name inside a 286px block and 26 of 87 goals
 * ended in an ellipsis. Measured in Inter (2026-09-25): the widest goal is
 * 350px at caption size, the widest title 192px, the widest wing name 60px,
 * the widest reward 70px, and the widest readout ("1482/1482 · 100%") 106px.
 * Larger text wraps the title and the goal instead (accessibility wave 3):
 * the rows grow to the tallest one the filter shows, and a page holds fewer.
 */
const ROW_PAD = ACHIEVEMENT_ROW.pad;
const COPY_RIGHT = ACHIEVEMENT_ROW.copyRight;
const GAUGE_CENTER = ACHIEVEMENT_ROW.gaugeCenter;
const PROGRESS_LEFT = ACHIEVEMENT_ROW.progressLeft;
const CLAIM_MIN_W = ACHIEVEMENT_ROW.claimMinWidth;
const CLAIM_CENTER = PROGRESS_LEFT + CLAIM_MIN_W / 2;
/** Between the title and its wing name, and before the reward. */
const TITLE_LINE_GAP = theme.space(2);
const CLAIM_SEAL_W = 84;
const CLAIM_SEAL_H = 30;

const SUMMARY_Y = 106;
const SUMMARY_H = 40;
const SUMMARY_POOL_W = 250;
const SUMMARY_SPECIAL_W = 190;
/** Centred between the summary strip (bottom 146) and the content top (196). */
const FILTER_Y = 171;
/** The release list's density, held at standard text (the probe checks it). */
const RELEASE_LIST_DENSITY = { id: 'achievement list', rows: 8, columns: 2, pitch: 56, top: 196 } as const;
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

/** Dev probe only (`src/dev/wave3PackGlossaryFixtures.ts`): an in-memory save, never persisted. */
export interface AchievementsA11yFixture {
  save: SaveData;
}

export type AchievementsSceneData = Partial<AchievementsRoute> & { a11yFixture?: AchievementsA11yFixture };

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

function filterStatuses(statuses: AchievementStatus[], filter: AchievementFilter): AchievementStatus[] {
  if (filter === 'ready') return statuses.filter((status) => status.unlocked && !status.claimed);
  if (filter === 'in-progress') return statuses.filter((status) => !status.unlocked);
  if (filter === 'claimed') return statuses.filter((status) => status.claimed);
  return statuses;
}


/** Goal grid and collection completion summary for Road-to-1.0 Feature 5. */
export class AchievementsScene extends Phaser.Scene {
  /** The current hall/list position; every restart re-enters through it. */
  private route: AchievementsRoute = { page: 0, filter: 'all', view: 'hall', bucket: 'all' };
  private fixture: AchievementsA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;

  constructor() {
    super('Achievements');
  }

  /**
   * The only card art here is the Trophy Hall furnishing: two owned thumbs
   * leaning behind each of the five wing plinths (`wingFurnishings`).
   */
  create(data: AchievementsSceneData = {}): void {
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save) : null;
    this.data.set('a11yReady', false);
    const owned = Object.keys(this.saveData.collection);
    gateOnArt(this, HALL_BUCKETS.flatMap((bucket) => wingFurnishings(bucket, owned)), () => {
      this.build(data);
      this.data.set('a11yReady', true);
    });
  }

  /** The player's save, or the probe fixture's in-memory copy. */
  private get saveData(): SaveData {
    return this.fixtureSave ?? Services.save.data;
  }

  /** Persist a change to the real save; a probe fixture is never written. */
  private persist(): void {
    if (!this.fixture) Services.save.flush();
  }

  /** Every restart re-enters through the route (and keeps a probe fixture). */
  private restartAt(route: AchievementsRoute): void {
    this.scene.restart({ ...route, ...(this.fixture ? { a11yFixture: this.fixture } : {}) });
  }

  private build(data: AchievementsSceneData): void {
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

    const save = this.saveData;
    // Recovery sync, deliberately kept ALONGSIDE the mutation checkpoints:
    // imported save codes, migrations, and dev grants change the save outside
    // any checkpoint, and claiming validates against the persisted unlocked
    // list — without this, such saves show satisfied plaques that refuse to
    // claim. Checkpoints make unlocks immediate; this makes them recoverable.
    if (syncAchievements(save, CARD_DB).length > 0) this.persist();
    const statuses = evaluateAchievements(save, CARD_DB);
    const filter = data.filter ?? 'all';
    const view: HallView = data.view ?? 'hall';
    const bucket = data.bucket ?? 'all';
    const bucketStatuses =
      bucket === 'all' ? statuses : statuses.filter((status) => status.def.bucket === bucket);
    const filteredStatuses = filterStatuses(bucketStatuses, filter);
    // Measure first, page second: every row of the filter takes the tallest
    // measured row, so a page's capacity never changes between its pages.
    const list = view === 'list' ? this.measureList(filteredStatuses) : achievementListLayout(ACHIEVEMENT_LIST.rowHeight);
    this.data.set('a11yDensity', view === 'list' ? {
      actual: { ...RELEASE_LIST_DENSITY, rows: list.rowsPerColumn, pitch: list.pitch },
      release: RELEASE_LIST_DENSITY,
    } : { actual: [], release: [] });
    const PER_PAGE = list.perPage;
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
      claimAllButton = themedButton(this, 0, theme.design.headerCenterY, `Claim All +${formatGold(claimableGold)}`, {
        variant: 'primary',
        minWidth: 220,
        onTap: () => {
          disableClaimControls();
          const result = claimAllAchievements(save);
          if (result.gold > 0) {
            this.persist();
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
                this.restartAt(this.route);
              },
            );
            return;
          }
          this.restartAt(this.route);
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
      const { x, y } = list.cell(index);
      if (status.unlocked && !status.claimed) {
        visibleClaimTargets.set(status.def.id, { x: x + CLAIM_CENTER, y: y + list.rowHeight / 2 });
      }
      const claimButton = this.drawAchievementRow(
        status,
        x,
        y,
        list,
        animationLevel,
        disableClaimControls,
      );
      if (claimButton) claimButtons.push(claimButton);
    });
    if (visibleStatuses.length === 0) {
      this.add
        .text(theme.design.centerX, ACHIEVEMENT_LIST.top + ACHIEVEMENT_LIST.rowHeight / 2, 'No achievements in this state.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    }
    this.drawPagingControls(page, pageCount);
  }

  private drawCompletionPanel(): void {
    const completion = collectionCompletion(ALL_CARDS, this.saveData);
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
      `Pool ${completion.owned}/${completion.total} · ${progressPercentLabel(completion.percent)}`,
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

  /** Hall ⇄ List chips on the content's left edge; a bucket chip clears the wing scope. */
  private drawViewToggle(): void {
    let left = CONTENT_X;
    (['hall', 'list'] as const).forEach((key) => {
      const chip = roundedTrigger(this, 0, FILTER_Y, key === 'hall' ? 'Hall' : 'List', {
        size: 'sm',
        minWidth: FILTER_W,
        selected: this.route.view === key,
        onTap: () => this.restartAt({ ...this.route, page: 0, view: key }),
      });
      const width = chip.getMeasuredSize().visual.width;
      chip.container.setX(left + width / 2);
      left += width + FILTER_GAP;
    });
    if (this.route.view === 'list' && this.route.bucket !== 'all') {
      // Right-aligned on the content edge (its left edge sat at 1120, which
      // put a 150px chip outside the title-safe frame).
      const chip = roundedTrigger(
        this,
        0,
        FILTER_Y,
        `${BUCKET_LABEL[this.route.bucket]} ✕`,
        {
          size: 'sm',
          minWidth: 150,
          selected: true,
          onTap: () => this.restartAt({ ...this.route, page: 0, bucket: 'all' }),
        },
      );
      chip.container.setX(CONTENT_X + CONTENT_W - chip.getMeasuredSize().visual.width / 2);
    }
  }

  /** The Trophy Hall: five wings, one per bucket, each a plinth into its list. */
  private drawHall(statuses: AchievementStatus[]): void {
    const save = this.saveData;
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
        const ready = featured.unlocked && !featured.claimed;
        const plinth = this.add.graphics();
        const title = this.add
          .text(0, 0, featured.def.title, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w700,
            color: ready ? theme.colors.heading : theme.colors.success,
          })
          .setOrigin(0, 0);
        const status = this.add
          .text(0, 0, ready ? 'Ready to claim' : 'Claimed', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            fontStyle: theme.weight.w700,
            color: ready ? theme.colors.gold : theme.colors.success,
          })
          .setOrigin(0, 0);
        // The plinth keeps its foot and grows upward when its title wraps.
        const textWidth = hallPlinthLayout(f, { titleHeight: 0, titleLineHeight: 0, statusHeight: 0, statusLineHeight: 0 }).textWidth;
        fitMenuName(title, textWidth, 3);
        const p = hallPlinthLayout(f, {
          titleHeight: title.height,
          titleLineHeight: title.height / Math.max(1, title.getWrappedText().length),
          statusHeight: status.height,
          statusLineHeight: status.height,
        });
        plinth.fillStyle(theme.graphics.rowFill, theme.alpha.panel);
        plinth.fillRoundedRect(p.x, p.y, p.width, p.height, theme.radius.control);
        plinth.lineStyle(
          theme.control.borderWidth,
          colorInt(ready ? theme.colors.gold : theme.colors.success),
          theme.alpha.chrome,
        );
        plinth.strokeRoundedRect(p.x, p.y, p.width, p.height, theme.radius.control);
        title.setPosition(p.x + HALL_PLINTH.textInset, p.y + p.titleTop);
        status.setPosition(p.x + HALL_PLINTH.textInset, p.y + p.statusTop);
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
        this.restartAt({ page: 0, filter: 'all', view: 'list', bucket: wing.bucket });
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
      .text(x, y, progressPercentLabel(wing.percent), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.body,
      })
      .setOrigin(0.5);
  }

  /** The pin on a claimed row: pin to (or unpin from) the Profile showcase. */
  private drawPinToggle(id: string, x: number, y: number): void {
    const save = this.saveData;
    const pinned = save.achievements.pinned.includes(id);
    const size = uiIconSize(theme.type.label);
    this.add
      .image(x, y, bakeUiIcon(this, 'pin'))
      .setDisplaySize(size, size)
      .setTint(colorInt(pinned ? theme.colors.gold : theme.colors.muted))
      .setAlpha(pinned ? 1 : 0.6);
    const zone = this.add.zone(x, y, 44, 44).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      save.achievements.pinned = togglePin(save.achievements.pinned, id);
      if (!this.fixture) Services.save.touch();
      this.restartAt(this.route);
    });
  }

  private drawFilters(selected: AchievementFilter): void {
    // Measure, then place: larger text widens a chip, and the row stays
    // centred with its gaps instead of the chips running into each other.
    const chips = FILTERS.map((filter) => roundedTrigger(this, 0, FILTER_Y, filter.label, {
      size: 'sm',
      minWidth: FILTER_W,
      selected: filter.key === selected,
      onTap: () => this.restartAt({ ...this.route, page: 0, filter: filter.key }),
    }));
    const widths = chips.map((chip) => chip.getMeasuredSize().visual.width);
    let left = theme.design.centerX - (widths.reduce((sum, w) => sum + w, 0) + (chips.length - 1) * FILTER_GAP) / 2;
    chips.forEach((chip, index) => {
      chip.container.setX(left + widths[index] / 2);
      left += widths[index] + FILTER_GAP;
    });
  }

  /**
   * One row's texts, positioned by `placeRowTexts`. The title wraps inside
   * the space the reward and wing name leave on its line, the goal across the
   * copy block, and the readout splits at its interpunct when it outgrows the
   * progress column. None of them is ever cut short.
   */
  private rowTexts(status: AchievementStatus, rowWidth: number): {
    reward: Phaser.GameObjects.Text;
    bucket: Phaser.GameObjects.Text;
    title: Phaser.GameObjects.Text;
    goal: Phaser.GameObjects.Text;
    readout: Phaser.GameObjects.Text | null;
    measure: AchievementRowMeasure;
  } {
    const claimable = status.unlocked && !status.claimed;
    const claimed = status.claimed;
    const reward = this.add
      .text(0, 0, `+${formatGold(status.def.reward.gold)}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: claimable ? theme.colors.gold : claimed ? theme.colors.muted : theme.colors.body,
      })
      .setOrigin(1, 0.5);
    const bucket = this.add
      .text(0, 0, BUCKET_LABEL[status.def.bucket], {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    const titleBudget = Math.max(1, COPY_RIGHT - ROW_PAD - reward.width - bucket.width - 2 * TITLE_LINE_GAP);
    const title = this.add
      .text(0, 0, `${claimed ? '✓ ' : ''}${status.def.title}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w700,
        color: claimed ? theme.colors.success : status.unlocked ? theme.colors.heading : theme.colors.muted,
      })
      .setOrigin(0, 0);
    fitMenuName(title, titleBudget, 3);
    const goal = this.add
      .text(0, 0, status.def.description, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: claimed ? theme.colors.muted : theme.colors.body,
      })
      .setOrigin(0, 0);
    fitMenuName(goal, COPY_RIGHT - ROW_PAD, 3);
    let readout: Phaser.GameObjects.Text | null = null;
    if (!claimable) {
      const count = `${Math.min(status.current, status.target)}/${status.target}`;
      readout = this.add
        .text(0, 0, `${count} · ${progressPercentLabel(status.percent)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: claimed ? theme.colors.muted : theme.colors.body,
        })
        .setOrigin(0, 0.5);
      if (readout.width > rowWidth - PROGRESS_LEFT - ROW_PAD / 2) readout.setText(`${count}\n${progressPercentLabel(status.percent)}`);
    }
    const lineHeight = (text: Phaser.GameObjects.Text): number => text.height / Math.max(1, text.getWrappedText().length);
    return {
      reward,
      bucket,
      title,
      goal,
      readout,
      measure: {
        titleHeight: title.height,
        titleLineHeight: lineHeight(title),
        goalHeight: goal.height,
        goalLineHeight: lineHeight(goal),
        progressHeight: readout?.height ?? theme.control.heightSm,
      },
    };
  }

  /** The list's paging: every row of the filter at the tallest measured row. */
  private measureList(statuses: readonly AchievementStatus[]): AchievementListLayout {
    const rowWidth = achievementListLayout(ACHIEVEMENT_LIST.rowHeight).rowWidth;
    let height: number = ACHIEVEMENT_LIST.rowHeight;
    for (const status of statuses) {
      const texts = this.rowTexts(status, rowWidth);
      height = Math.max(height, achievementRowLayout(texts.measure).height);
      [texts.reward, texts.bucket, texts.title, texts.goal, texts.readout].forEach((text) => text?.destroy());
    }
    return achievementListLayout(height);
  }

  private drawAchievementRow(
    status: AchievementStatus,
    x: number,
    y: number,
    list: AchievementListLayout,
    animationLevel: AnimationLevel,
    disableClaimControls: () => void,
  ): ThemedButton | null {
    const claimable = status.unlocked && !status.claimed;
    const claimed = status.claimed;
    const rowW = list.rowWidth;
    const rowH = list.rowHeight;
    const centerY = y + rowH / 2;
    const g = this.add.graphics();
    g.fillStyle(
      claimable ? theme.graphics.rowFillActive : theme.graphics.rowFill,
      claimed ? theme.alpha.subtle : theme.alpha.panel,
    );
    g.fillRoundedRect(x, y, rowW, rowH, theme.radius.control);
    g.lineStyle(
      theme.control.borderWidth,
      colorInt(claimable ? theme.colors.gold : theme.colors.panelStroke),
      claimed ? theme.alpha.subtle : theme.alpha.chrome,
    );
    g.strokeRoundedRect(x, y, rowW, rowH, theme.radius.control);
    // A claimed row's gauge is a full circle saying nothing; the slot becomes
    // the showcase pin toggle instead.
    if (claimed) this.drawPinToggle(status.def.id, x + GAUGE_CENTER, centerY);
    else this.drawProgressGauge(status, x + GAUGE_CENTER, centerY);

    // First line: the title, its wing, and the reward on the copy block's
    // right edge; the title wraps if the line is ever too long. Second: the goal.
    const { reward, bucket, title, goal, readout, measure } = this.rowTexts(status, rowW);
    const row: AchievementRowLayout = achievementRowLayout(measure);
    // Rows share the tallest row's height; a shorter copy block centres in it.
    const top = y + (rowH - row.height) / 2;
    const firstLineY = top + row.titleTop + measure.titleLineHeight / 2;
    title.setPosition(x + ROW_PAD, top + row.titleTop);
    reward.setPosition(x + COPY_RIGHT, firstLineY);
    bucket.setPosition(title.x + title.width + TITLE_LINE_GAP, firstLineY);
    goal.setPosition(x + ROW_PAD, top + row.goalTop);
    readout?.setPosition(x + PROGRESS_LEFT, centerY);

    if (claimable) {
      const claimButton = themedButton(this, x + CLAIM_CENTER, centerY, 'Claim', {
        variant: 'emphasis',
        size: 'sm',
        minWidth: CLAIM_MIN_W,
        onTap: () => {
          disableClaimControls();
          const result = claimAchievement(this.saveData, status.def.id);
          if (result.ok) {
            this.persist();
            this.playClaimCascade([{ x: x + CLAIM_CENTER, y: centerY }], animationLevel, () => {
              Sfx.play('coin');
              this.restartAt(this.route);
            });
            return;
          }
          this.restartAt(this.route);
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
      this.restartAt({ ...this.route, page: nextPage }),
    );
  }
}
