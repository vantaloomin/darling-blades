import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { isBasic } from '../meta/Collection';
import { LIMITED_DECK_SIZE, validateLimitedDeck } from '../meta/DeckStorage';
import {
  buildLimitedDeck,
  completeDraftRun,
  countCards,
  limitedDraftDuals,
  limitedDuelData,
  limitedLandReserve,
  type LimitedRun,
} from '../meta/Limited';
import { isDualLand, LAND_RESERVE_SIZE, MAX_DUAL_LANDS } from '../meta/warchest';
import { storedPremiumGrant } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { IS_DEV } from '../platform/env';
import type { SaveData } from '../meta/SaveManager';
import { CardView } from '../ui/CardView';
import { computeDeckStats, curveBars, deckCountsLine, deckPipBeads } from '../ui/deckStats';
import { leaveDraftPrompt } from '../ui/leaveDraftPrompt';
import {
  premiumGrantNote,
  type LimitedBuilderA11yFixture,
  type LimitedBuilderEntry,
  type PremiumGrantSummary,
} from '../ui/limitedDraftPresentation';
import {
  LIMITED_BUILDER_COLUMNS,
  LIMITED_BUILDER_HEADER,
  LIMITED_DETAILS_PANEL,
  limitedDetailsBottom,
  limitedListLayout,
  limitedListRow,
} from '../ui/limitedPanePresentation';
import { fitMenuName, type MenuDensity } from '../ui/menuText';
import { awaitArt, gateOnArt, PagedArt } from '../ui/artGate';
import { SCENE_TITLE } from '../ui/layout';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { drawPipBeadRow } from '../ui/pipBeadRow';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { CARD_H, CARD_W } from '../ui/CardView';
import { COMPACT } from '../ui/compactLayout';
import { COMPACT_DRAG_SLOP, compactButton, compactDialog, compactHeader, compactSegments } from '../ui/compactWidgets';
import { curveLayout } from '../ui/deckBuilderCompact';
import { deckPipCounts } from '../ui/deckStats';
import { limitedBuilderLayout, limitedTileGrid, type LimitedBuilderLayout } from '../ui/limitedBuilderCompact';
import { bindMenuScroll } from '../ui/menuScroll';
import { PackTile } from '../ui/PackTile';
import { bakeUiIcon } from '../ui/uiIcons';
import type { Rect } from '../ui/layout';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { ellipsizeText } from '../ui/textFit';
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel, registerSceneBackNavigation, themedButton, type ModalShell } from '../ui/themeWidgets';

/** Half the caption line's rendered height: the shape line's centre, below its top. */
const SHAPE_LINE_HALF_HEIGHT = 8;
/**
 * Spell out the whole Warchest, not just the duals.
 *
 * Basics are apportioned by the deck's pip demand, so the split is a real
 * decision the game is making for the player. Showing it beats "Basics fill
 * the Warchest automatically", which told them nothing and left the reserve
 * invisible until the duel began.
 */
function describeReserve(reserve: readonly string[], duals: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of reserve) counts.set(id, (counts.get(id) ?? 0) + 1);
  const dualSet = new Set(duals);
  const parts: string[] = [];
  // Basics lead: the pip-demand split is the information this line exists to
  // show, and the display clamp truncates from the right, so the long scenic
  // dual names are what an overflow costs, never the split.
  for (const [id, count] of counts) {
    if (dualSet.has(id)) continue;
    parts.push(`${count}x ${def(CARD_DB, id).name}`);
  }
  for (const [id, count] of counts) {
    if (!dualSet.has(id)) continue;
    parts.push(count > 1 ? `${count}x ${def(CARD_DB, id).name}` : def(CARD_DB, id).name);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No lands in the Warchest yet';
}

export class LimitedDeckBuilderScene extends Phaser.Scene {
  private deck: string[] = [];
  private selectedDuals: string[] = [];
  private poolPage = 0;
  private deckPage = 0;
  /** These list rows draw text; their page requests warm the full-size inspect. */
  private poolArt: PagedArt | null = null;
  private deckArt: PagedArt | null = null;
  private selectedId: string | null = null;
  private cardInspect: Phaser.GameObjects.Container | null = null;
  private leavePrompt: ModalShell | null = null;
  /**
   * What the Premium grant did, handed over by the screen that completed the
   * draft. A later visit arrives without it and reads the copy the grant
   * stored on the save (`storedPremiumGrant`), so the note shows on every
   * visit during the run's Build step, reloads included.
   */
  private premiumGrant: PremiumGrantSummary | null = null;
  /** Dev-only probe fixture: an in-memory save read instead of the real one, never persisted. */
  private fixture: LimitedBuilderA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private fixtureVisited = false;
  /** The compact composition's open tab, and where each tab's grid was scrolled (kept across redraws). */
  private compactTab: 'pool' | 'deck' = 'pool';
  private compactScroll = { pool: 0, deck: 0 };
  private compactScrollOffset: (() => number) | null = null;
  private get saveData(): SaveData {
    return this.fixtureSave ?? Services.save.data;
  }
  constructor() {
    super('LimitedDeckBuilder');
  }
  /** The pool pane and the deck column draw only the run's own pool. */
  create(data: LimitedBuilderEntry & { a11yFixture?: LimitedBuilderA11yFixture } = {}): void {
    this.premiumGrant = data.premiumGrant ?? null;
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save) : null;
    // Phaser keeps a start's data for the next start that passes none, so a
    // fixture must not outlive its probe visit.
    if (this.fixture) this.sys.settings.data = {};
    this.data.set('a11yReady', false);
    const run = this.saveData.limited.activeRun;
    gateOnArt(this, [...(run?.pool ?? []), ...(run?.deck ?? []), ...(run?.landReserve ?? [])], () =>
      this.build(), { releaseAfterBuild: true });
  }
  private build(): void {
    this.cardInspect = null;
    this.leavePrompt = null;
    applyBackdrop(this, 'deckbuilder', {
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
        g.fillRect(0, 0, 1280, 720);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');
    const run = this.saveData.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    registerSceneBackNavigation(this, () => this.leaveDraft());
    // The Details panel's colour run draws pip beads; baking is a no-op once
    // boot has done it.
    bakeManaSymbols(this);
    this.deck = [...run.deck];
    this.selectedDuals = run.landReserve?.filter((id) => CARD_DB[id] && isDualLand(CARD_DB[id])) ?? [];
    this.poolArt = new PagedArt(this, 'limited-pool', { tier: 'primary' });
    this.deckArt = new PagedArt(this, 'limited-deck', { tier: 'primary' });
    const f = this.fixture;
    this.compactTab = 'pool';
    this.compactScroll = { pool: 0, deck: 0 };
    if (f || this.fixtureVisited) {
      // A fixture's pages and selection must not leak into a real visit.
      this.selectedId = f?.selectedId ?? null;
      this.poolPage = f?.poolPage ?? 0;
      this.deckPage = f?.deckPage ?? 0;
      this.fixtureVisited = !!f;
    }
    this.draw(run);
    if (f?.modal === 'inspect' && f.selectedId) this.showCardInspect(f.selectedId);
    if (f?.modal === 'leave') this.leaveDraft();
    this.data.set('a11yReady', true);
  }
  /**
   * Rebuild the whole screen. The previous frame is DESTROYED first:
   * `children.removeAll(true)` only detached it (the flag skips the remove
   * callback, it does not destroy), so every earlier frame's rows and buttons
   * stayed alive and tappable under the new one, and a greyed "+" could still
   * add a card past its pool count.
   */
  private draw(run: LimitedRun): void {
    for (const child of [...this.children.list]) child.destroy();
    // Any open modal went with the frame; forget it so it can open again.
    this.cardInspect = null;
    this.leavePrompt = null;
    applyBackdrop(this, 'deckbuilder', {
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
        g.fillRect(0, 0, 1280, 720);
      },
    });
    if (sceneStage(this).compact) {
      this.drawCompact(run);
      return;
    }
    // Part of every frame: a back control built once in build() was the first
    // thing the first redraw destroyed.
    backButton(this, 'Draft', () => this.leaveDraft());
    sceneTitle(this, 'Limited Deck Builder');
    sceneSubtitle(
      this,
      `Exactly ${LIMITED_DECK_SIZE} spells, no lands · Warchest provided · pool ${run.pool.length} · record ${run.wins}-${run.losses}`,
      { fontSize: theme.type.label },
    );
    // One line even in the worst case: every pick melted at the top tier
    // measures 708px (Inter caption, 2026-09-25) against the 1152px frame.
    const premiumGrant = this.premiumGrant ?? storedPremiumGrant(this.saveData.limited);
    if (run.premium && premiumGrant) {
      this.add
        .text(SCENE_TITLE.x, LIMITED_BUILDER_HEADER.premiumNoteTop, premiumGrantNote(premiumGrant), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5, 0);
    }
    this.drawPool(run);
    this.drawDeck(run);
    this.drawInspector(run);
    this.drawActions(run);
  }
  private drawPool(run: LimitedRun): void {
    const { poolX: x, y, width, height } = LIMITED_BUILDER_COLUMNS;
    panel(this, x, y, width, height);
    this.heading(x + LIMITED_BUILDER_COLUMNS.inset, y + 16, 'Pool');
    const poolCounts = countCards(run.pool);
    const deckCounts = countCards(this.deck);
    const reserveCounts = countCards(this.selectedDuals);
    const ids = [...poolCounts.keys()].filter((id) => !isBasic(CARD_DB, id)).sort(sortCards);
    const list = limitedListLayout();
    const ROWS = list.rows;
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.poolPage = Math.min(this.poolPage, maxPage);
    const shown = ids.slice(this.poolPage * ROWS, this.poolPage * ROWS + ROWS);
    this.recordListDensity('pool', y);
    this.poolArt?.show([], shown);
    shown.forEach((id, i) => {
      const owned = poolCounts.get(id) ?? 0;
      const used = deckCounts.get(id) ?? 0;
      const dual = isDualLand(CARD_DB[id]);
      const reserveUsed = reserveCounts.get(id) ?? 0;
      this.cardRow(
        x,
        y + list.rowsTop + i * list.pitch,
        `${dual ? reserveUsed : used}/${owned} ${cardLine(id)}`,
        id,
        dual && reserveUsed > 0 ? '−' : '+',
        dual ? reserveUsed > 0 || this.selectedDuals.length < MAX_DUAL_LANDS : !isType(CARD_DB[id], 'land') && used < owned,
        () => {
          if (dual) {
            if (reserveUsed > 0) {
              this.removeOne(id, this.selectedDuals);
              this.persistAndRedraw(run);
            } else if (this.selectedDuals.length < MAX_DUAL_LANDS) {
              this.selectedDuals.push(id);
              this.persistAndRedraw(run);
            }
          } else if (this.deck.length < LIMITED_DECK_SIZE && used < owned) {
            this.deck.push(id);
            this.selectedId = id;
            this.persistAndRedraw(run);
          }
        },
      );
    });
    pager(this, x + LIMITED_BUILDER_COLUMNS.inset, y + list.pagerY, this.poolPage, maxPage + 1, (page) => {
      this.poolPage = page;
      this.draw(run);
    });
  }
  private drawDeck(run: LimitedRun): void {
    const { deckX: x, y, width, height } = LIMITED_BUILDER_COLUMNS;
    panel(this, x, y, width, height);
    this.heading(
      x + LIMITED_BUILDER_COLUMNS.inset,
      y + 16,
      `Deck ${this.deck.length}/${LIMITED_DECK_SIZE}`,
      this.deck.length === LIMITED_DECK_SIZE ? theme.colors.gold : theme.colors.danger,
    );
    const counts = countCards(this.deck);
    const ids = [...counts.keys()].sort(sortCards);
    const list = limitedListLayout();
    const ROWS = list.rows;
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.deckPage = Math.min(this.deckPage, maxPage);
    const shown = ids.slice(this.deckPage * ROWS, this.deckPage * ROWS + ROWS);
    this.recordListDensity('deck', y);
    this.deckArt?.show([], shown);
    shown.forEach((id, i) =>
      this.cardRow(
        x,
        y + list.rowsTop + i * list.pitch,
        `${counts.get(id) ?? 0}x ${cardLine(id)}`,
        id,
        '−',
        true,
        () => {
          this.removeOne(id);
          this.selectedId = id;
          this.persistAndRedraw(run);
        },
      ),
    );
    pager(this, x + LIMITED_BUILDER_COLUMNS.inset, y + list.pagerY, this.deckPage, maxPage + 1, (page) => {
      this.deckPage = page;
      this.draw(run);
    });
  }
  private drawInspector(run: LimitedRun): void {
    const L = LIMITED_DETAILS_PANEL;
    const issues = validateLimitedDeck(CARD_DB, run.pool, this.deck);
    const errors = issues.filter((issue) => issue.kind === 'error');
    const reserve = limitedLandReserve(CARD_DB, this.deck, run.pool, this.selectedDuals);
    const reserveDuals = reserve.filter((id) => isDualLand(CARD_DB[id]));
    panel(this, L.x, L.y, L.width, L.height);
    this.heading(
      L.contentX,
      L.headingY,
      'Details',
      errors.length ? theme.colors.danger : theme.colors.gold,
    );
    this.drawCurve();
    this.text(
      L.contentX,
      L.warchestY,
      `Warchest ${reserve.length}/${LAND_RESERVE_SIZE} · ${reserveDuals.length}/${MAX_DUAL_LANDS} duals`,
      theme.type.label,
      theme.colors.gold,
    );
    this.text(
      L.contentX,
      L.dualsY,
      short(describeReserve(reserve, reserveDuals), 44),
      theme.type.caption,
      theme.colors.muted,
    );
    // The selected card's whole name wraps (up to three lines at the largest
    // size); the detail line and the issue list follow its measured height.
    let issuesY = L.issuesY;
    if (this.selectedId) {
      const card = def(CARD_DB, this.selectedId);
      const name = this.add.text(L.contentX, L.selected.nameY, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
      });
      fitMenuName(name, L.wrapWidth, 3);
      const detailY = Math.max(L.selected.detailY, name.y + name.height + theme.space(1));
      const detail = this.add.text(L.contentX, detailY, detailLine(card), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      });
      issuesY = Math.max(issuesY, detail.y + detail.height + theme.space(4));
    }
    const issueText = this.add.text(
      L.contentX,
      issuesY,
      issues.length
        ? issues.map((issue) => issue.message).join('\n')
        : 'Deck is legal.',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: errors.length ? theme.colors.danger : theme.colors.success,
        wordWrap: { width: L.contentRight - L.contentX },
        lineSpacing: 4,
      },
    );
    issueText.setData('a11yFullText', issueText.text);
    issueText.setData('a11yBox', { x: L.x, y: L.y, width: L.width, height: limitedDetailsBottom() - L.y - theme.space(2) });
  }

  /** The list density at the standard size (9 rows at a 44px pitch from y+56) is the 100% contract. */
  private recordListDensity(id: 'pool' | 'deck', panelY: number): void {
    const list = limitedListLayout();
    const density = this.data.get('a11yDensity') as { actual: MenuDensity[]; release: MenuDensity[] } | undefined
      ?? { actual: [], release: [] };
    density.actual = density.actual.filter((item) => item.id !== id);
    density.release = density.release.filter((item) => item.id !== id);
    density.actual.push({ id, rows: list.rows, columns: 1, pitch: list.pitch, top: panelY + list.rowsTop });
    density.release.push({ id, rows: 9, columns: 1, pitch: 44, top: 184 });
    this.data.set('a11yDensity', density);
  }

  /**
   * The mana curve, the one chart a draft deck is actually built by: the pool
   * is fixed, so the curve and the colour split ARE the deck decisions. The
   * panel had neither until 2026-08-25.
   */
  private drawCurve(): void {
    const L = LIMITED_DETAILS_PANEL;
    const stats = computeDeckStats(this.deck, CARD_DB);
    this.text(L.contentX, L.curve.headingY, 'Mana curve', theme.type.label, theme.colors.gold);
    for (const bar of curveBars(stats.curve, {
      firstX: L.curve.firstX,
      pitch: L.curve.pitch,
      maxHeight: L.curve.maxHeight,
    })) {
      this.add
        .rectangle(
          bar.x,
          L.curve.baseY,
          L.curve.barWidth,
          bar.height,
          bar.count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill,
        )
        .setOrigin(0.5, 1);
      if (bar.count > 0) {
        this.add
          .text(bar.x, L.curve.baseY - bar.height - L.curve.countGap, `${bar.count}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.body,
          })
          .setOrigin(0.5);
      }
      this.add
        .text(bar.x, L.curve.baseY + L.curve.axisGap, bar.label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    }
    // The shape line: type counts on the left, the colour run on the right as
    // pip beads, the way the Deck Builder and every other summary show color
    // (it printed letter codes, "U·56 R·36", until 1.8.1). Reserve-native
    // Limited holds no lands in the deck list and the Warchest has its own
    // line below, so the counts name no lands.
    const lineY = L.shapeLineY + SHAPE_LINE_HALF_HEIGHT;
    const beads = drawPipBeadRow(this, L.contentRight, lineY, deckPipBeads(stats));
    const counts = this.add
      .text(L.contentX, lineY, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.body,
      })
      .setOrigin(0, 0.5);
    ellipsizeText(counts, beads.left - theme.space(3) - L.contentX, deckCountsLine(stats, { kind: 'provided' }));
  }
  /**
   * One footer row on the shared footer line (theme.design.footerCenterY),
   * placed from measured widths. The two resets sit at the left title-safe
   * edge and the build actions at the right, so a slip on the way to Start
   * Match cannot empty the deck. The row used to open with one "+ Basic"
   * button per basic land, which could only make this format's deck illegal:
   * Limited decks hold no lands and the Warchest is provided.
   */
  private drawActions(run: LimitedRun): void {
    const footerY = theme.design.footerCenterY;
    const gap = theme.space(2);
    const resets = [
      themedButton(this, 0, footerY, 'Clear Deck', {
        variant: 'ghost',
        minWidth: 120,
        onTap: () => {
          this.deck = [];
          this.persistAndRedraw(run);
        },
      }),
      themedButton(this, 0, footerY, 'Clear Warchest', {
        variant: 'ghost',
        minWidth: 120,
        onTap: () => {
          this.selectedDuals = [];
          this.persistAndRedraw(run);
        },
      }),
    ];
    let left = theme.design.safeLeft;
    for (const button of resets) {
      const hitWidth = button.getMeasuredSize().hit.width;
      button.container.setX(left + hitWidth / 2);
      left += hitWidth + gap;
    }
    const builds = [
      themedButton(this, 0, footerY, 'Auto Build', {
        variant: 'ghost',
        minWidth: 120,
        onTap: () => {
          this.deck = buildLimitedDeck(CARD_DB, run.pool);
          this.selectedDuals = limitedDraftDuals(CARD_DB, run.pool).slice(0, MAX_DUAL_LANDS);
          this.selectedId = this.deck[0] ?? null;
          this.persistAndRedraw(run);
        },
      }),
      themedButton(this, 0, footerY, 'Start Match', {
        variant: 'primary',
        minWidth: 140,
        // Reads as unavailable until the deck is legal; the Details panel says why.
        enabled: !validateLimitedDeck(CARD_DB, run.pool, this.deck).some((issue) => issue.kind === 'error'),
        onTap: () => this.startMatch(run),
      }),
    ];
    let edge = theme.design.safeRight;
    for (let i = builds.length - 1; i >= 0; i--) {
      const hitWidth = builds[i].getMeasuredSize().hit.width;
      builds[i].container.setX(edge - hitWidth / 2);
      edge -= hitWidth + gap;
    }
  }

  private leaveDraft(): void {
    const run = this.saveData.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    if (this.leavePrompt) return;
    if (sceneStage(this).compact) {
      const dialog = compactDialog(this, {
        title: 'Leave Draft?',
        message: 'Your draft run is saved and can be resumed from the Draft hub. Leave now?',
        secondary: { label: 'Keep building', onTap: (close) => close() },
        primary: { label: 'Leave', onTap: (close) => { close(); this.scene.start('Limited'); } },
        dismissal: 'dismissible',
        onClose: () => {
          if (this.leavePrompt === dialog) this.leavePrompt = null;
        },
      });
      this.leavePrompt = dialog;
      return;
    }
    const shell = leaveDraftPrompt(this, {
      stayLabel: 'Keep Building',
      onLeave: () => this.scene.start('Limited'),
      onClose: () => {
        if (this.leavePrompt === shell) this.leavePrompt = null;
      },
    });
    this.leavePrompt = shell;
  }
  /** One list row inside the panel whose left edge is `panelX` (limitedListRow owns the geometry). */
  private cardRow(
    panelX: number,
    y: number,
    label: string,
    id: string,
    actionLabel: '+' | '−',
    enabled: boolean,
    onAction: () => void,
  ): void {
    const geometry = limitedListRow(panelX);
    const list = limitedListLayout();
    const row = this.add
      .text(geometry.plateX, y, short(label, 39), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.heading,
        backgroundColor: theme.colors.rowFill,
        padding: { x: 8, y: list.textPadY },
      })
      .setFixedSize(geometry.plateWidth, list.rowHeight)
      .setInteractive({ useHandCursor: true });
    row.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) {
        row.setColor(theme.colors.gold);
        inflateHitArea(row, 250, list.pitch);
      }
    });
    row.on('pointerout', () => {
      row.setColor(theme.colors.heading);
      inflateHitArea(row, 250, list.pitch);
    });
    bindTapButton(this, row, () => {
      this.selectedId = id;
      this.showCardInspect(id);
    });
    inflateHitArea(row, 250, list.pitch);
    const action = themedButton(this, geometry.actionX, y + Math.floor(list.rowHeight / 2), actionLabel, {
      variant: actionLabel === '+' ? 'emphasis' : 'danger',
      size: 'sm',
      minWidth: geometry.actionWidth,
      enabled,
      onTap: onAction,
    });
    void action;
  }
  private showCardInspect(id: string): void {
    this.closeCardInspect();
    if (sceneStage(this).compact) {
      this.showCompactInspect(id);
      return;
    }
    const card = def(CARD_DB, id);
    const shell = modalShell(this, {
      width: 940,
      height: 560,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      dismissal: 'esc-and-dim',
      onClose: () => {
        this.cardInspect = null;
      },
    });
    const c = shell.container;
    // The modal's now lease promotes an evicted inspect above page prefetch;
    // CardView owns its arrival redraw and keeps the existing immediate draw.
    awaitArt(c, [id], { onReady: () => undefined });
    c.add(new CardView(this, 455, 360).setScale(1.35).setCard(card, { fx: 'full', artTier: 'primary' }));
    // The whole name wraps in the reading column (the list rows abbreviate
    // it; this is where it is read in full), and the detail line follows it.
    const name = this.add.text(730, 154, card.name, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.gold,
    });
    fitMenuName(name, 380, 4);
    c.add(name);
    c.add(
      this.add.text(730, Math.max(218, name.y + name.height + theme.space(2)), detailLine(card), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.heading,
        wordWrap: { width: 380 },
      }),
    );
    // The dim closes it; the panel itself does not, so "anywhere" was wrong.
    // Inside the panel, on the reading column's bottom inset: on the shared
    // footer line (y 662) it sat below the panel's bottom edge (640).
    const panelBottom = theme.design.centerY + 560 / 2;
    c.add(
      this.add
        .text(730, panelBottom - theme.space(6), `${isTouchDevice() ? 'Tap' : 'Click'} outside to close`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0, 1),
    );
    this.cardInspect = c;
  }
  // ------------------------------------------------------------------ compact (phone and desktop)

  /** The compact composition (S-Limited-Builder, S-Limited-BuilderDeck): tabs over a tile grid, Details in the column. */
  private drawCompact(run: LimitedRun): void {
    const stage = sceneStage(this);
    const layout = limitedBuilderLayout(stage.content);
    const type = theme.compactType;
    const header = compactHeader(this, layout.shell, {
      title: 'Limited Deck Builder',
      subtitle: `Exactly ${LIMITED_DECK_SIZE} spells, no lands · Warchest provided · pool ${run.pool.length} · record ${run.wins}-${run.losses}`,
      onBack: () => this.leaveDraft(),
    });
    // The right slot holds the two resets, so the title's lines stop short of them.
    const titleRight = layout.clearDeck.x - COMPACT.gap;
    ellipsizeText(header.title, titleRight - header.title.x);
    if (header.subtitle) ellipsizeText(header.subtitle, titleRight - header.subtitle.x);
    compactButton(this, layout.clearDeck, 'Clear deck', { fontSize: type.label, onTap: () => {
      this.deck = [];
      this.persistAndRedraw(run);
    } });
    compactButton(this, layout.clearWarchest, 'Clear Warchest', { fontSize: type.label, onTap: () => {
      this.selectedDuals = [];
      this.persistAndRedraw(run);
    } });
    compactSegments(this, layout.tabs, ['Pool', `Deck ${this.deck.length}/${LIMITED_DECK_SIZE}`], this.compactTab === 'pool' ? 0 : 1, (i) => {
      this.rememberCompactScroll();
      this.compactTab = i === 0 ? 'pool' : 'deck';
      this.draw(run);
    });
    this.drawCompactGrid(run, layout);
    this.drawCompactDetails(run, layout);
    compactButton(this, layout.auto, 'Auto build', { onTap: () => {
      this.deck = buildLimitedDeck(CARD_DB, run.pool);
      this.selectedDuals = limitedDraftDuals(CARD_DB, run.pool).slice(0, MAX_DUAL_LANDS);
      this.selectedId = this.deck[0] ?? null;
      this.persistAndRedraw(run);
    } });
    const start = compactButton(this, layout.start, 'Start match', { variant: 'primary', onTap: () => this.startMatch(run) });
    start.setEnabled(!validateLimitedDeck(CARD_DB, run.pool, this.deck).some((issue) => issue.kind === 'error'));
  }

  private rememberCompactScroll(): void {
    if (this.compactScrollOffset) this.compactScroll[this.compactTab] = this.compactScrollOffset();
  }

  /**
   * The open tab's tiles. Pool: each card with its count in the deck over the
   * copies drafted and a check once any are in; a tap adds one, or takes them
   * all out once every copy is in. Deck: each card once, its copies counted; a
   * tap takes one out. A hold (or a right-click) opens the card.
   */
  private drawCompactGrid(run: LimitedRun, layout: LimitedBuilderLayout): void {
    const type = theme.compactType;
    const poolCounts = countCards(run.pool);
    const deckCounts = countCards(this.deck);
    const reserveCounts = countCards(this.selectedDuals);
    const pool = this.compactTab === 'pool';
    const ids = pool
      ? [...poolCounts.keys()].filter((id) => !isBasic(CARD_DB, id)).sort(sortCards)
      : [...deckCounts.keys()].sort(sortCards);
    const area = layout.grid;
    this.compactScrollOffset = null;
    if (ids.length === 0) {
      this.add.text(area.x + area.width / 2, area.y + area.height / 3, pool ? 'Your pool is empty.' : 'No cards in the deck yet: tap cards in the Pool to add them, or Auto build.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, align: 'center',
        wordWrap: { width: area.width * 0.8, useAdvancedWrap: true },
      }).setOrigin(0.5);
      return;
    }
    const grid = limitedTileGrid(area, ids.length, layout.k);
    const list = this.add.container(0, area.y);
    (pool ? this.poolArt : this.deckArt)?.show([], ids);
    ids.forEach((id, i) => {
      const card = def(CARD_DB, id);
      const dual = isDualLand(card);
      const owned = poolCounts.get(id) ?? 0;
      const used = dual ? reserveCounts.get(id) ?? 0 : deckCounts.get(id) ?? 0;
      const tile = new PackTile(this, grid.cells[i]).showFace(card, 'white', pool
        ? { chip: `${used}/${owned}`, check: used > 0 }
        : { chip: used > 1 ? `${used}×` : undefined });
      // A land that cannot join the deck (a kept utility land) reads as unavailable.
      if (pool && isType(card, 'land') && !dual) tile.setAlpha(0.45);
      list.add(tile);
    });
    const scroll = bindMenuScroll(this, list, area, grid.contentH, () => this.cardInspect !== null || this.leavePrompt !== null,
      [], 0, undefined, this.compactScroll[this.compactTab]);
    this.compactScrollOffset = () => scroll.offset();
    const indexAt = (p: Phaser.Input.Pointer): number => {
      const y = p.worldY - area.y + scroll.offset();
      return grid.cells.findIndex((c) => p.worldX >= c.x && p.worldX <= c.x + c.width && y >= c.y && y <= c.y + c.height);
    };
    const zone = this.add.zone(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height).setInteractive({ useHandCursor: true });
    let hold: Phaser.Time.TimerEvent | null = null;
    let held = false;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      held = false;
      hold?.remove(false);
      if (p.rightButtonDown()) return;
      const index = indexAt(p);
      if (index < 0) return;
      hold = this.time.delayedCall(450, () => {
        hold = null;
        if (Math.abs(p.y - p.downY) > COMPACT_DRAG_SLOP) return;
        held = true;
        this.rememberCompactScroll();
        this.selectedId = ids[index];
        this.showCardInspect(ids[index]);
      });
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      hold?.remove(false);
      hold = null;
      if (held || Math.abs(p.upY - p.downY) > COMPACT_DRAG_SLOP) return;
      const index = indexAt(p);
      if (index < 0) return;
      this.rememberCompactScroll();
      if (p.rightButtonReleased()) {
        this.selectedId = ids[index];
        this.showCardInspect(ids[index]);
        return;
      }
      this.compactTap(run, ids[index]);
    });
    zone.on('pointerout', () => {
      hold?.remove(false);
      hold = null;
    });
  }

  /** A tile's tap: in the Pool, add one (or take every copy out once all are in); in the Deck, take one out. */
  private compactTap(run: LimitedRun, id: string): void {
    const card = def(CARD_DB, id);
    if (this.compactTab === 'deck') {
      this.removeOne(id);
      this.selectedId = id;
      this.persistAndRedraw(run);
      return;
    }
    const owned = countCards(run.pool).get(id) ?? 0;
    if (isDualLand(card)) {
      if (this.selectedDuals.includes(id)) this.selectedDuals = this.selectedDuals.filter((d) => d !== id);
      else if (this.selectedDuals.length < MAX_DUAL_LANDS) this.selectedDuals.push(id);
      else return;
      this.persistAndRedraw(run);
      return;
    }
    if (isType(card, 'land')) return;
    const used = this.deck.filter((d) => d === id).length;
    if (used < owned && this.deck.length < LIMITED_DECK_SIZE) this.deck.push(id);
    else if (used >= owned) this.deck = this.deck.filter((d) => d !== id);
    else return;
    this.selectedId = id;
    this.persistAndRedraw(run);
  }

  /** Details: the mana curve and colour pips, the deck's shape, the Warchest, then the first issue (or that the deck is legal). */
  private drawCompactDetails(run: LimitedRun, layout: LimitedBuilderLayout): void {
    const type = theme.compactType;
    const box = layout.details;
    const issues = validateLimitedDeck(CARD_DB, run.pool, this.deck);
    const errors = issues.filter((issue) => issue.kind === 'error');
    const stats = computeDeckStats(this.deck, CARD_DB);
    let y = box.y;
    const heading = this.add.text(box.x, y, 'Details', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    y += heading.height + 2;
    const curveTitle = this.add.text(box.x, y, 'Mana curve', {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    y += curveTitle.height + 2;
    const small = { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px` };
    const probe = this.add.text(0, 0, '0', small);
    const capH = probe.height;
    probe.destroy();
    const curveH = capH * 2 + Math.round(22 * layout.k);
    const curve = curveLayout({ x: box.x, y, width: box.width, height: curveH }, capH, capH);
    for (const bar of curveBars(stats.curve, { firstX: curve.xs[0], pitch: curve.xs[1] - curve.xs[0], maxHeight: curve.maxBarH })) {
      this.add.rectangle(bar.x, curve.baseY, curve.barW, bar.height, bar.count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill).setOrigin(0.5, 1);
      if (bar.count > 0) this.add.text(bar.x, curve.baseY - bar.height - 1, `${bar.count}`, { ...small, color: theme.colors.body }).setOrigin(0.5, 1);
      this.add.text(bar.x, curve.baseY + 2, bar.label, { ...small, color: theme.colors.muted }).setOrigin(0.5, 0);
    }
    const pip = Math.round(type.label * 1.3);
    const pitch = pip + 4;
    deckPipCounts(stats).slice(0, Math.max(1, Math.floor(curve.pips.height / pitch))).forEach((bead, i) => {
      const cy = curve.pips.y + i * pitch + pip / 2;
      const key = `pip-${bead.color}`;
      if (this.textures.exists(key)) this.add.image(curve.pips.x + pip / 2, cy, key).setDisplaySize(pip, pip);
      this.add.text(curve.pips.x + curve.pips.width, cy, `${bead.count}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
      }).setOrigin(1, 0.5);
    });
    y += curveH + 6;
    const reserve = limitedLandReserve(CARD_DB, this.deck, run.pool, this.selectedDuals);
    const reserveDuals = reserve.filter((id) => isDualLand(CARD_DB[id]));
    const lines: { text: string; color: string; size: number; bold?: boolean; wrap?: number }[] = [
      { text: deckCountsLine(stats, { kind: 'provided' }), color: theme.colors.body, size: type.label },
      { text: `Warchest ${reserve.length}/${LAND_RESERVE_SIZE} · ${reserveDuals.length}/${MAX_DUAL_LANDS} duals`, color: theme.colors.gold, size: type.label, bold: true },
      { text: describeReserve(reserve, reserveDuals), color: theme.colors.muted, size: type.caption, wrap: 2 },
    ];
    const premiumGrant = this.premiumGrant ?? storedPremiumGrant(this.saveData.limited);
    for (const line of lines) {
      const text = this.add.text(box.x, y, line.text, {
        fontFamily: theme.fonts.ui, fontSize: `${line.size}px`, fontStyle: line.bold ? theme.weight.w700 : undefined, color: line.color,
        ...(line.wrap ? { wordWrap: { width: box.width, useAdvancedWrap: true }, maxLines: line.wrap } : {}),
      });
      if (!line.wrap) ellipsizeText(text, box.width);
      y += text.height + 4;
    }
    // The first issue (or that the deck is legal), with its mark.
    y += 4;
    const legal = issues.length === 0;
    const icon = Math.round(type.label * 1.3);
    const color = errors.length ? theme.colors.danger : legal ? theme.colors.success : theme.colors.gold;
    const issueText = this.add.text(box.x + icon + 6, y, legal ? 'Deck is legal.' : issues[0].message, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color, wordWrap: { width: box.width - icon - 6, useAdvancedWrap: true }, maxLines: 3,
    });
    this.add.image(box.x + icon / 2, y + Math.min(issueText.height, icon) / 2 + 1, bakeUiIcon(this, legal ? 'check' : 'info'))
      .setDisplaySize(icon, icon).setTint(colorInt(color));
    issueText.setData('a11yFullText', issues.length ? issues.map((issue) => issue.message).join('\n') : 'Deck is legal.');
    y += issueText.height + 6;
    if (run.premium && premiumGrant && y < box.y + box.height) {
      const note = this.add.text(box.x, y, premiumGrantNote(premiumGrant), {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.gold,
        wordWrap: { width: box.width, useAdvancedWrap: true },
      });
      // What does not fit above the foot is cut to the lines that do.
      const room = box.y + box.height - y;
      if (note.height > room) note.setMaxLines(Math.max(1, Math.floor(room / (note.height / Math.max(1, note.getWrappedText().length)))));
    }
  }

  /** A card opened from the grid: the card over the main pane, its name and line in the column, its action and Close in the foot. */
  private showCompactInspect(id: string): void {
    const stage = sceneStage(this);
    const layout = limitedBuilderLayout(stage.content);
    const type = theme.compactType;
    const card = def(CARD_DB, id);
    const run = this.saveData.limited.activeRun;
    const shell = modalShell(this, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0.84, depth: theme.depth.inspect, dismissal: 'esc-only',
      onClose: () => {
        this.cardInspect = null;
      },
    });
    shell.panel.clear();
    const c = shell.container;
    c.setData('a11ySurface', { x: 0, y: 0, width: stage.width, height: stage.height }).setData('a11yPanel', stage.content);
    awaitArt(c, [id], { onReady: () => undefined });
    const main: Rect = { x: layout.grid.x, y: stage.content.y, width: layout.grid.width, height: stage.content.height };
    const scale = Math.min(main.height / CARD_H, main.width / CARD_W);
    c.add(new CardView(this, main.x + main.width / 2, main.y + main.height / 2).setScale(scale).setCard(card, { fx: 'full', artTier: 'primary' }));
    const col = layout.details;
    const name = this.add.text(col.x, stage.content.y, card.name, {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      wordWrap: { width: col.width, useAdvancedWrap: true },
    });
    c.add(name);
    c.add(this.add.text(col.x, name.y + name.height + 6, detailLine(card), {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.heading, wordWrap: { width: col.width, useAdvancedWrap: true },
    }));
    const foot = { x: layout.auto.x, y: layout.auto.y, width: layout.start.x + layout.start.width - layout.auto.x, height: layout.auto.height };
    const half = Math.floor((foot.width - COMPACT.gap) / 2);
    const close = (): void => shell.close();
    const inDeck = this.deck.includes(id) || this.selectedDuals.includes(id);
    if (run && !(isType(card, 'land') && !isDualLand(card))) {
      const action = compactButton(this, { ...foot, width: half }, inDeck && this.compactTab === 'deck' ? 'Remove one' : inDeck ? 'Take out' : 'Add to deck', {
        onTap: () => {
          close();
          if (inDeck && this.compactTab === 'pool' && !isDualLand(card)) this.deck = this.deck.filter((d) => d !== id);
          else if (inDeck && isDualLand(card)) this.selectedDuals = this.selectedDuals.filter((d) => d !== id);
          else this.compactTap(run, id);
          if (inDeck && this.compactTab === 'pool') this.persistAndRedraw(run);
        },
      });
      c.add(action.container);
      const shut = compactButton(this, { ...foot, x: foot.x + half + COMPACT.gap, width: foot.width - half - COMPACT.gap }, 'Close', { onTap: close });
      c.add(shut.container);
    } else {
      c.add(compactButton(this, foot, 'Close', { onTap: close }).container);
    }
    this.cardInspect = c;
  }

  private closeCardInspect(): void {
    this.cardInspect?.destroy();
    this.cardInspect = null;
  }
  private startMatch(run: LimitedRun): void {
    if (this.fixture) return;
    if (validateLimitedDeck(CARD_DB, run.pool, this.deck).some((issue) => issue.kind === 'error'))
      return;
    const updated = completeDraftRun(CARD_DB, run);
    updated.deck = [...this.deck];
    updated.landReserve = limitedLandReserve(CARD_DB, updated.deck, updated.pool, this.selectedDuals);
    updated.status = 'matches';
    this.saveData.limited.activeRun = updated;
    Services.save.flush();
    this.scene.start('Duel', limitedDuelData(updated));
  }
  private persistAndRedraw(run: LimitedRun): void {
    run.deck = [...this.deck];
    run.landReserve = limitedLandReserve(CARD_DB, this.deck, run.pool, this.selectedDuals);
    this.saveData.limited.activeRun = run;
    if (!this.fixture) Services.save.flush();
    this.draw(run);
  }
  private removeOne(id: string, from: string[] = this.deck): void {
    const index = from.indexOf(id);
    if (index >= 0) from.splice(index, 1);
  }
  private heading(x: number, y: number, label: string, color: string = theme.colors.gold): void {
    this.add.text(x, y, label, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color,
    });
  }
  private text(x: number, y: number, label: string, size: number, color: string): void {
    this.add.text(x, y, label, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color });
  }
}
function sortCards(a: string, b: string): number {
  const da = def(CARD_DB, a);
  const db = def(CARD_DB, b);
  const ta = isType(da, 'land') ? 2 : isType(da, 'creature') ? 0 : 1;
  const tb = isType(db, 'land') ? 2 : isType(db, 'creature') ? 0 : 1;
  return ta - tb || manaValue(da.cost) - manaValue(db.cost) || da.name.localeCompare(db.name);
}
function cardLine(id: string): string {
  const card = def(CARD_DB, id);
  // Duals are playable in the Warchest. Any retired utility land remains in
  // the pool and collection, but cannot be assigned to the spell deck.
  if (isType(card, 'land')) return `${isDualLand(card) ? 'W' : '-'} ${short(card.name, 22)}${isDualLand(card) ? ' (Warchest)' : ' (kept)'}`;
  return `MV${manaValue(card.cost)} ${short(card.name, 25)}`;
}
function detailLine(card: CardDef): string {
  return `${card.rarity.toUpperCase()} · ${card.types.join(' ')} · MV ${manaValue(card.cost)}${isType(card, 'creature') ? ` · ${card.attack}/${card.defense}` : ''}`;
}
function short(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`;
}
