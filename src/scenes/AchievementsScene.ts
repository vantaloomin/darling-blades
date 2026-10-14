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
import { ACHIEVEMENTS_COMPACT, achievementHallFrames, achievementHallNarrowWidth, achievementRowColumns, compactAchievementsLayout, flowItems } from '../ui/achievementsCompact';
import { COMPACT, isDesktopStage } from '../ui/compactLayout';
import { compactButton, compactHeader, compactRowHover, compactSegments, COMPACT_DRAG_SLOP, coverFitImage, desktopTextPanel, type CompactButton } from '../ui/compactWidgets';
import type { Rect } from '../ui/layout';
import { bindMenuScroll } from '../ui/menuScroll';
import { addPortraitArt } from '../ui/portraitArt';
import { ellipsizeText } from '../ui/textFit';
import { bindTapButton } from '../platform/gestures';
import { gateOnArt } from '../ui/artGate';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
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
  /** Phones: where the list (or the hall) was scrolled, so a claim or a pin comes back to it. */
  scroll?: number;
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
    this.route = { page, filter, view, bucket, scroll: data.scroll ?? 0 };
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

    if (sceneStage(this).compact) {
      this.data.set('a11yDensity', { actual: [], release: [] });
      this.buildCompact({
        statuses, filtered: filteredStatuses, claimable, claimableGold, unlocked, claimed, animationLevel,
        scroll: data.scroll ?? 0,
      });
      return;
    }

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
    const stage = sceneStage(this);
    const inputShield = this.add
      .zone(stage.width / 2, stage.height / 2, stage.width, stage.height)
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

  // ------------------------------------------------------------------ phones

  /**
   * The phone composition (mocks M-Achievements, M-AchievementsList): the
   * hall's five wings or the scrolling list in the main pane, the totals,
   * the Hall/List switch, the filters and Claim all in the column.
   */
  private buildCompact(ctx: {
    statuses: AchievementStatus[];
    filtered: AchievementStatus[];
    claimable: AchievementStatus[];
    claimableGold: number;
    unlocked: number;
    claimed: number;
    animationLevel: AnimationLevel;
    scroll: number;
  }): void {
    const type = theme.compactType;
    const L = compactAchievementsLayout(sceneStage(this).content);
    const toMenu = (): void => { this.scene.start('MainMenu'); };
    compactHeader(this, L.shell, {
      title: 'Achievements',
      subtitle: `${ctx.unlocked}/${ctx.statuses.length} complete · ${ctx.claimable.length} ready to claim · ${ctx.claimed} claimed`,
      onBack: toMenu,
    });
    registerSceneBackNavigation(this, toMenu);

    const claimButtons: CompactButton[] = [];
    let claimAll: CompactButton | null = null;
    const disableClaimControls = (): void => {
      claimAll?.setEnabled(false);
      claimButtons.forEach((button) => button.setEnabled(false));
    };
    const claimTargets = new Map<string, ClaimSealTarget>();

    // The column, top down: the totals (Hall), the switch, the filters (List).
    const col = L.column;
    let y = col.y;
    if (this.route.view === 'hall') y = this.drawCompactTotals(col) + 14;
    compactSegments(this, { x: col.x, y, width: col.width, height: COMPACT.touch }, ['Hall', 'List'], this.route.view === 'hall' ? 0 : 1, (index) => {
      const view: HallView = index === 0 ? 'hall' : 'list';
      if (view !== this.route.view) this.restartAt({ ...this.route, page: 0, view, scroll: 0 });
    });
    y += COMPACT.touch + 14;
    if (this.route.view === 'list') {
      const chipW = (col.width - COMPACT.gap) / 2;
      FILTERS.forEach((filter, i) => {
        const rect = { x: col.x + (i % 2) * (chipW + COMPACT.gap), y: y + Math.floor(i / 2) * (COMPACT.touch + COMPACT.gap), width: chipW, height: COMPACT.touch };
        compactButton(this, rect, filter.label, {
          variant: filter.key === this.route.filter ? 'selected' : 'ghost',
          onTap: () => {
            if (filter.key !== this.route.filter) this.restartAt({ ...this.route, page: 0, filter: filter.key, scroll: 0 });
          },
        });
      });
      y += COMPACT.touch * 2 + COMPACT.gap + 14;
      if (this.route.bucket !== 'all') {
        // The wing the hall opened the list on; tapping it widens the list to every wing.
        compactButton(this, { x: col.x, y, width: col.width, height: COMPACT.touch }, `${BUCKET_LABEL[this.route.bucket]}  ✕`, {
          variant: 'selected',
          onTap: () => this.restartAt({ ...this.route, page: 0, bucket: 'all', scroll: 0 }),
        });
      }
    }
    if (ctx.claimable.length > 0) {
      claimAll = compactButton(this, L.claimAll, `Claim all +${formatGold(ctx.claimableGold)}`, {
        variant: 'primary',
        onTap: () => {
          disableClaimControls();
          const result = claimAllAchievements(this.saveData);
          if (result.gold <= 0) {
            this.restartAt(this.route);
            return;
          }
          this.persist();
          const targets = result.ids.flatMap((id) => {
            const target = claimTargets.get(id);
            return target ? [target] : [];
          });
          const fallback = { x: L.claimAll.x + L.claimAll.width / 2, y: L.claimAll.y + L.claimAll.height / 2 };
          this.playClaimCascade(targets.length > 0 ? targets : [fallback], ctx.animationLevel, () => {
            Sfx.play('coin');
            this.restartAt(this.route);
          });
        },
      });
    }

    if (this.route.view === 'hall') {
      this.drawCompactHall(ctx.statuses, L.main);
      return;
    }
    if (ctx.filtered.length === 0) {
      this.add.text(L.main.x + L.main.width / 2, L.main.y + COMPACT.touch, 'No achievements in this state.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
      }).setOrigin(0.5, 0);
      return;
    }
    this.drawCompactList(ctx.filtered, L.main, ctx.scroll, ctx.animationLevel, claimButtons, claimTargets, disableClaimControls);
  }

  /** The column's totals (M-Achievements): the pool, the special cards and one count per colour. Returns the bottom. */
  private drawCompactTotals(col: Rect): number {
    const type = theme.compactType;
    const completion = collectionCompletion(ALL_CARDS, this.saveData);
    const line = (y: number, text: string): Phaser.GameObjects.Text => {
      const t = this.add.text(col.x, y, text, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
        wordWrap: { width: col.width },
      });
      return t;
    };
    const pool = line(col.y, `Pool ${completion.owned}/${completion.total} · ${progressPercentLabel(completion.percent)}`);
    const special = line(pool.y + pool.height + 4, `Special cards ${completion.variants.specialCards}`);
    const top = special.y + special.height + 12;
    const pip = Math.round(type.body * 1.45);
    const items = COLOR_KEYS.map((key) => {
      const row = completion.byColor.find((entry) => entry.key === key);
      const c = this.add.container(0, 0);
      const icon = this.add.image(pip / 2, 0, `pip-${key}`).setDisplaySize(pip, pip);
      const text = this.add.text(pip + 6, 0, `${row?.owned ?? 0}/${row?.total ?? 0}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
      }).setOrigin(0, 0.5);
      c.add([icon, text]);
      return { c, width: pip + 6 + text.width, height: Math.max(pip, text.height) };
    });
    const lineH = Math.max(...items.map((item) => item.height));
    const flow = flowItems(col.width, items.map((item) => item.width), lineH, ACHIEVEMENTS_COMPACT.pipGapX, ACHIEVEMENTS_COMPACT.pipGapY);
    items.forEach((item, i) => item.c.setPosition(col.x + flow.at[i].x, top + flow.at[i].y + lineH / 2));
    if (isDesktopStage(sceneStage(this))) {
      // Desktop: the faded panel behind the totals, so they keep their contrast over the backdrop's art.
      const backing = desktopTextPanel(this, { x: col.x, y: col.y, width: col.width, height: top + flow.height - col.y }, 4);
      this.children.moveBelow(backing as Phaser.GameObjects.GameObject, pool as Phaser.GameObjects.GameObject);
    }
    return top + flow.height;
  }

  /** The Trophy Hall on a phone: five wing cards, three over two, each opening its wing's list. */
  private drawCompactHall(statuses: AchievementStatus[], main: Rect): void {
    const C = ACHIEVEMENTS_COMPACT;
    const type = theme.compactType;
    const owned = Object.keys(this.saveData.collection);
    const byId = new Map(statuses.map((status) => [status.def.id, status]));
    const wings = wingSummaries(statuses);
    const desktop = isDesktopStage(sceneStage(this));
    const content = this.add.container(main.x, main.y);
    const build = (width: number): { cards: { wing: WingSummary; c: Phaser.GameObjects.Container; head: number; plinth: Phaser.GameObjects.Container; plinthH: number }[]; frames: Rect[]; height: number } => {
      const narrow = achievementHallNarrowWidth(width);
      const wide = (width - C.wingGap) / 2;
      const cards = wings.map((wing, index) => {
        const w = index < 3 ? narrow : wide;
        const c = this.add.container(0, 0);
        const name = this.add.text(C.wingPad, C.wingPad, BUCKET_LABEL[wing.bucket], {
          fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        });
        // A long wing name at large text on the smallest phone steps its size down rather than lose letters.
        for (let size = type.h2; name.width > w - C.wingPad * 2 && size > type.label; size--) name.setFontSize(size - 1);
        ellipsizeText(name, w - C.wingPad * 2);
        const ringTop = name.y + name.height + C.wingInnerGap;
        const ringD = C.ringR * 2 + C.ringStroke;
        const ringX = C.wingPad + ringD / 2;
        const countX = C.wingPad + ringD + C.wingInnerGap;
        const countW = Math.max(0, w - countX - C.wingPad);
        // The count, then what it counts: "claimed", or (a wing with trophies waiting) how many are ready, in gold.
        // A wide card has room to say both (M-Achievements' Mastery and Economy).
        const wideCard = index >= 3;
        const ready = wing.ready > 0;
        const count = this.add.text(countX, 0, ready && wideCard ? `${wing.claimed}/${wing.total} claimed` : `${wing.claimed}/${wing.total}`, {
          fontFamily: theme.fonts.ui, fontSize: `${ready && wideCard ? type.label : type.h2}px`, fontStyle: ready && wideCard ? 'normal' : theme.weight.w700,
          color: ready && wideCard ? theme.colors.muted : theme.colors.heading,
        });
        const note = this.add.text(countX, 0, ready ? `${wing.ready} ready` : 'claimed', {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: ready ? theme.weight.w700 : 'normal',
          color: ready ? theme.colors.gold : theme.colors.muted,
        });
        for (let size = parseFloat(String(count.style.fontSize)); count.width > countW && size > type.label; size--) count.setFontSize(size - 1);
        ellipsizeText(count, countW);
        ellipsizeText(note, countW);
        const block = Math.max(ringD, count.height + note.height);
        count.setY(ringTop + (block - count.height - note.height) / 2);
        note.setY(count.y + count.height);
        const ringY = ringTop + block / 2;
        // Two owned cards' art lean behind the count, faded, as on the desktop's plinths.
        const art = wingFurnishings(wing.bucket, owned, index >= 3 ? 2 : 1);
        art.forEach((cardId, t) => {
          const artW = Math.min(44, w * 0.26);
          const rect = { x: w - C.wingPad - artW - t * (artW * 0.55), y: ringTop - 4, width: artW, height: artW * 1.3 };
          try {
            const image = addPortraitArt(this, rect.x, rect.y, cardId, (img) => coverFitImage(img, rect, 0.1));
            if (image) c.addAt(image.setAlpha(0.45).setAngle(t === 0 ? 5 : -6), 0);
          } catch {
            // No art for that card: the corner stays bare.
          }
        });
        const gauge = this.add.graphics();
        gauge.lineStyle(C.ringStroke, theme.graphics.panelStroke, theme.alpha.subtle).strokeCircle(ringX, ringY, C.ringR);
        if (wing.percent > 0) {
          gauge.lineStyle(C.ringStroke, colorInt(wing.percent >= 1 ? theme.colors.success : theme.colors.gold), 1);
          if (wing.percent >= 1) gauge.strokeCircle(ringX, ringY, C.ringR);
          else gauge.beginPath().arc(ringX, ringY, C.ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wing.percent, false).strokePath();
        }
        const pct = this.add.text(ringX, ringY, progressPercentLabel(wing.percent), {
          fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.body,
        }).setOrigin(0.5);
        c.add([name, gauge, pct, count, note]);
        const head = ringTop + block + C.wingInnerGap;
        // The plinth: the wing's featured trophy, ready (gold) or claimed (green).
        const featured = wing.featuredId ? byId.get(wing.featuredId) : undefined;
        let plinth: Phaser.GameObjects.Container;
        let plinthH: number;
        const textW = w - C.wingPad * 2 - C.plinthInset * 2;
        if (featured) {
          const ready = featured.unlocked && !featured.claimed;
          plinth = this.add.container(C.wingPad, 0);
          const title = this.add.text(C.plinthInset, C.plinthPadY, featured.def.title, {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700,
            color: ready ? theme.colors.heading : theme.colors.success, wordWrap: { width: textW },
          });
          const status = this.add.text(C.plinthInset, title.y + title.height, ready ? 'Ready to claim' : 'Claimed', {
            fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700,
            color: ready ? theme.colors.gold : theme.colors.success, wordWrap: { width: textW },
          });
          plinthH = status.y + status.height + C.plinthPadY;
          const g = this.add.graphics()
            .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(0, 0, w - C.wingPad * 2, plinthH, theme.radius.control)
            .lineStyle(theme.control.borderWidth, colorInt(ready ? theme.colors.gold : theme.colors.success), theme.alpha.chrome)
            .strokeRoundedRect(0, 0, w - C.wingPad * 2, plinthH, theme.radius.control);
          plinth.add([g, title, status]);
        } else {
          plinth = this.add.container(C.wingPad, 0);
          const empty = this.add.text(0, 0, 'No trophies here yet.', {
            fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: w - C.wingPad * 2 },
          });
          plinth.add(empty);
          plinthH = empty.height;
        }
        c.add(plinth);
        return { wing, c, head, plinth, plinthH };
      });
      const need = (i: number): number => cards[i].head + cards[i].plinthH + C.wingPad;
      const hall = achievementHallFrames(width, main.height, [Math.max(need(0), need(1), need(2)), Math.max(need(3), need(4))], { desktop });
      return { cards, frames: hall.frames, height: hall.height };
    };
    let built = build(main.width);
    if (built.height > main.height) {
      built.cards.forEach((card) => card.c.destroy());
      built = build(main.width - C.thumbLane);
    }
    built.cards.forEach(({ wing, c, plinth, plinthH }, i) => {
      const f = built.frames[i];
      const bg = this.add.graphics()
        .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(0, 0, f.width, f.height, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, colorInt(wing.ready > 0 ? theme.colors.gold : theme.colors.panelStroke), wing.ready > 0 ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(0, 0, f.width, f.height, theme.radius.panel);
      c.addAt(bg, 0).setPosition(f.x, f.y);
      // The plinth keeps to the card's foot.
      plinth.setY(f.height - C.wingPad - plinthH);
      content.add(c);
    });
    const scroll = built.height > main.height
      ? bindMenuScroll(this, content, main, built.height, undefined, [], 0, undefined, this.route.scroll ?? 0)
      : null;
    if (scroll) scroll.onScroll = (offset) => { this.route.scroll = offset; };
    const openWing = (index: number): void => {
      this.restartAt({ page: 0, filter: 'all', view: 'list', bucket: built.cards[index].wing.bucket, scroll: 0 });
    };
    if (desktop && !scroll) {
      // Desktop, nothing to scroll: a target per card, so each one answers the pointer on its own.
      built.frames.forEach((f, i) => {
        const zone = this.add.zone(f.x + f.width / 2, f.y + f.height / 2, f.width, f.height).setInteractive({ useHandCursor: true });
        content.add(zone);
        bindTapButton(this, zone, () => openWing(i));
        compactRowHover(this, zone, f, content);
      });
      return;
    }
    // One tap target over the pane, fixed while the hall scrolls under it: the wing is the card under the tap,
    // so a card half out of view still opens, and nothing reaches past the pane into the top bar.
    const tap = this.add.zone(main.x + main.width / 2, main.y + main.height / 2, main.width, main.height).setInteractive({ useHandCursor: true });
    bindTapButton(this, tap, (pointer) => {
      if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
      const x = pointer.worldX - main.x;
      const y = pointer.worldY - main.y + (scroll?.offset() ?? 0);
      const hit = built.frames.findIndex((f) => x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height);
      if (hit >= 0) openWing(hit);
    });
  }

  /** The list on a phone (M-AchievementsList): every achievement of the filter, scrolling. */
  private drawCompactList(
    statuses: readonly AchievementStatus[],
    main: Rect,
    initialScroll: number,
    animationLevel: AnimationLevel,
    claimButtons: CompactButton[],
    claimTargets: Map<string, ClaimSealTarget>,
    disableClaimControls: () => void,
  ): void {
    const C = ACHIEVEMENTS_COMPACT;
    const type = theme.compactType;
    const build = (rowW: number): { list: Phaser.GameObjects.Container; height: number; adapters: ThemedButton[]; claims: { id: string; button: CompactButton; target: ClaimSealTarget }[] } => {
      const list = this.add.container(0, main.y);
      const adapters: ThemedButton[] = [];
      const claims: { id: string; button: CompactButton; target: ClaimSealTarget }[] = [];
      let y = 0;
      for (const status of statuses) {
        const claimable = status.unlocked && !status.claimed;
        const claimed = status.claimed;
        const row = this.add.container(main.x, y);
        const reward = this.add.text(0, 0, `+${formatGold(status.def.reward.gold)}`, {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
          color: claimable ? theme.colors.gold : claimed ? theme.colors.muted : theme.colors.body,
        }).setOrigin(1, 0.5);
        let readout: Phaser.GameObjects.Text | null = null;
        let claimW = 0;
        if (claimable) {
          const probe = this.add.text(0, 0, 'Claim', { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
          claimW = Math.max(84, Math.ceil(probe.width) + 32);
          probe.destroy();
        } else {
          readout = this.add.text(0, 0, `${Math.min(status.current, status.target)}/${status.target} · ${progressPercentLabel(status.percent)}`, {
            fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
            color: claimed ? theme.colors.muted : theme.colors.body,
          }).setOrigin(1, 0.5);
        }
        const cols = achievementRowColumns(rowW, reward.width, claimable ? claimW : readout!.width);
        const title = this.add.text(cols.copyX, 0, `${claimed ? '✓ ' : ''}${status.def.title}`, {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
          color: claimed ? theme.colors.success : status.unlocked ? theme.colors.heading : theme.colors.body,
          wordWrap: { width: cols.copyWidth },
        });
        const goal = this.add.text(cols.copyX, 0, `${BUCKET_LABEL[status.def.bucket]} · ${status.def.description}`, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: cols.copyWidth },
        });
        const copyH = title.height + 2 + goal.height;
        const rightH = cols.stacked ? (claimable ? COMPACT.touch : readout!.height) + 4 + reward.height : claimable ? COMPACT.touch : 0;
        const h = Math.max(COMPACT.touch + 12, copyH + C.rowPadY * 2, rightH + C.rowPadY * 2);
        const mid = h / 2;
        title.setY((h - copyH) / 2);
        goal.setY(title.y + title.height + 2);
        const plate = this.add.graphics()
          .fillStyle(claimable ? theme.graphics.rowFillActive : theme.graphics.rowFill, claimed ? theme.alpha.subtle : theme.alpha.panel)
          .fillRoundedRect(0, 0, rowW, h, theme.radius.control)
          .lineStyle(theme.control.borderWidth, colorInt(claimable ? theme.colors.gold : theme.colors.panelStroke), claimable ? 1 : theme.alpha.chrome)
          .strokeRoundedRect(0, 0, rowW, h, theme.radius.control);
        row.add([plate, title, goal, reward]);
        // The right-hand block: the readout (or Claim) and the reward, side by side or stacked.
        const progressRight = cols.progressX + cols.progressWidth;
        if (cols.stacked) {
          const upper = claimable ? COMPACT.touch : readout!.height;
          const top = (h - (upper + 4 + reward.height)) / 2;
          readout?.setPosition(progressRight, top + upper / 2);
          reward.setPosition(cols.rewardRight, top + upper + 4 + reward.height / 2);
        } else {
          readout?.setPosition(progressRight, mid);
          reward.setPosition(cols.rewardRight, mid);
        }
        if (readout) row.add(readout);
        const gx = C.gaugeLane / 2 + 2;
        if (claimed) {
          // A claimed trophy's ring is full and says nothing: its slot pins it to the Profile showcase.
          const pinned = this.saveData.achievements.pinned.includes(status.def.id);
          const size = uiIconSize(type.body);
          const pin = this.add.image(gx, mid, bakeUiIcon(this, 'pin')).setDisplaySize(size, size)
            .setTint(colorInt(pinned ? theme.colors.gold : theme.colors.muted)).setAlpha(pinned ? 1 : 0.6);
          const zone = this.add.zone(gx, mid, COMPACT.touch, COMPACT.touch).setInteractive({ useHandCursor: true });
          bindTapButton(this, zone, (pointer) => {
            if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP) return;
            const save = this.saveData;
            save.achievements.pinned = togglePin(save.achievements.pinned, status.def.id);
            if (!this.fixture) Services.save.touch();
            this.restartAt(this.route);
          });
          row.add([pin, zone]);
          adapters.push(listAdapter(zone, list, { x: main.x + gx - COMPACT.touch / 2, y: y + mid - COMPACT.touch / 2, width: COMPACT.touch, height: COMPACT.touch }));
        } else {
          row.add(this.compactGauge(status, gx, mid));
        }
        if (claimable) {
          const rect = { x: cols.progressX, y: cols.stacked ? (h - (COMPACT.touch + 4 + reward.height)) / 2 : mid - COMPACT.touch / 2, width: cols.progressWidth, height: COMPACT.touch };
          const target = { x: main.x + rect.x + rect.width / 2, y: 0 };
          const button = compactButton(this, rect, 'Claim', {
            variant: 'primary',
            onTap: () => {
              disableClaimControls();
              const result = claimAchievement(this.saveData, status.def.id);
              if (!result.ok) {
                this.restartAt(this.route);
                return;
              }
              this.persist();
              this.playClaimCascade([{ x: target.x, y: list.y + row.y + rect.y + rect.height / 2 }], animationLevel, () => {
                Sfx.play('coin');
                this.restartAt(this.route);
              });
            },
          });
          row.add(button.container);
          adapters.push(listAdapter(button.inputZone, list, { x: main.x + rect.x, y: y + rect.y, width: rect.width, height: rect.height }));
          claims.push({ id: status.def.id, button, target: { x: target.x, y: y + rect.y + rect.height / 2 } });
        }
        list.add(row);
        y += h + C.rowGap;
      }
      return { list, height: Math.max(0, y - C.rowGap), adapters, claims };
    };
    let built = build(main.width);
    if (built.height > main.height) {
      built.list.destroy();
      built = build(main.width - C.thumbLane);
    }
    const scroll = bindMenuScroll(this, built.list, main, built.height, undefined, built.adapters, 0, undefined, initialScroll);
    scroll.onScroll = (offset) => { this.route.scroll = offset; };
    this.route.scroll = scroll.offset();
    for (const claim of built.claims) {
      claimButtons.push(claim.button);
      // Claim all stamps the rows in view; a row scrolled away has nothing to stamp.
      const y = claim.target.y - scroll.offset();
      if (y >= 0 && y <= main.height) claimTargets.set(claim.id, { x: claim.target.x, y: main.y + y });
    }
  }

  /** A list row's progress ring (M-AchievementsList): the share done, gold, round its lane. */
  private compactGauge(status: AchievementStatus, x: number, y: number): Phaser.GameObjects.Graphics {
    const progress = Math.min(1, Math.max(0, status.percent));
    const r = 15;
    const gauge = this.add.graphics();
    gauge.lineStyle(4, theme.graphics.panelStroke, theme.alpha.chrome).strokeCircle(x, y, r);
    if (progress <= 0) return gauge;
    gauge.lineStyle(4, colorInt(theme.colors.gold), 1);
    if (progress >= 1) gauge.strokeCircle(x, y, r);
    else gauge.beginPath().arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false).strokePath();
    return gauge;
  }
}

/** A tap target inside a scrolling list, for `bindMenuScroll` to switch off while it is out of view. */
function listAdapter(zone: Phaser.GameObjects.Zone, list: Phaser.GameObjects.Container, hit: Rect): ThemedButton {
  return {
    container: list,
    inputZone: zone,
    // The list moves the container: the hit is in its local space, x in world.
    getMeasuredBounds: () => ({ hit }),
    setEnabled: (on: boolean) => {
      if (on) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
    },
  } as unknown as ThemedButton;
}
