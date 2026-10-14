import Phaser from 'phaser';
import { formatGold } from '../ui/goldFormat';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById } from '../data/draftPersonas';
import { LIMITED_DECK_SIZE } from '../meta/DeckStorage';
import {
  clampLimitedSeed,
  completeDraftRun,
  grantPremiumDraftPool,
  limitedDuelData,
  recordDraftEncounters,
  startDraftRun,
  type LimitedRun,
} from '../meta/Limited';
import { payPremiumDraftEntry, premiumEntryStatus, todayString } from '../meta/Economy';
import { Services } from '../meta/services';
import { isTouchDevice } from '../platform/gestures';
import { IS_DEV } from '../platform/env';
import type { SaveData } from '../meta/SaveManager';
import { DECK_STYLE_LABEL } from '../meta/profileStats';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { COMPACT } from '../ui/compactLayout';
import { compactButton, compactHeader, coverFitImage } from '../ui/compactWidgets';
import type { ThemedButtonVariant } from '../ui/controlStyle';
import { LIMITED_COMPACT, limitedHubLayout } from '../ui/limitedCompact';
import { bindMenuScroll } from '../ui/menuScroll';
import { addPortraitArt } from '../ui/portraitArt';
import { ellipsizeText } from '../ui/textFit';
import { HEADER_CURRENCY_ANCHOR, type Rect } from '../ui/layout';
import {
  premiumGrantSummary,
  type LimitedBuilderEntry,
  type LimitedHubA11yFixture,
  type PremiumGrantSummary,
} from '../ui/limitedDraftPresentation';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { colorInt, theme } from '../ui/theme';
import { Toast } from '../ui/Toast';
import { backButton, goldBadge, panel, registerSceneBackNavigation, themedButton, type ThemedButton } from '../ui/themeWidgets';

/**
 * Two equal columns on the title-safe frame's edges (64 and 1216) with the
 * major-region gap between them: the run and start panels on the left, the
 * records on the right. Until 2026-10-08 they sat at 70 and 670, 540 wide.
 */
const PANEL_GAP = theme.space(6);
const PANEL_W = (theme.design.safeRight - theme.design.safeLeft - PANEL_GAP) / 2; // 564
const LEFT_X = theme.design.safeLeft;
const RIGHT_X = theme.design.safeRight - PANEL_W;
/** The panels' top at the standard size; a subtitle wrapped by larger text pushes it down. */
const PANELS_TOP = 140;
const RUN_PANEL_H = 235;
const START_PANEL_MIN_H = 180;
/**
 * One shared two-column CTA grid for every button row in the left panels
 * (Resume/Retire, Free/Premium): a fixed width wide enough for the longest
 * label ("Premium Draft · 1,000g", the armed "Click again to retire"), the
 * left column's edge flush with the x+24 text inset and the right column's
 * edge flush with the panel's right inset.
 */
const CTA_W = 220;
const CTA_COL_LEFT = 24 + CTA_W / 2; // 134
const CTA_COL_RIGHT = PANEL_W - 24 - CTA_W / 2; // 430
/** How long an armed Retire waits for its second press, as Settings' Reset does. */
const RETIRE_ARM_MS = 4000;
/** The records list: eight rows of one heading-and-caption line each, which fit at every text size. */
const HISTORY_ROWS = 8;
const HISTORY_PITCH = 42;
const HISTORY_TOP = 104;
const HISTORY_ROW_H = 36;
/** Eight rows plus the bottom inset: the records panel's floor, which the left column's bottom matches. */
const HISTORY_PANEL_MIN_H = HISTORY_TOP + (HISTORY_ROWS - 1) * HISTORY_PITCH + HISTORY_ROW_H + 18;

/** Retire run as both layouts draw it: the desktop's themed button or the compact foot's. */
interface RetireControl {
  container: Phaser.GameObjects.Container;
  setLabel(label: string): void;
  setVariant(variant: ThemedButtonVariant): void;
}

export class LimitedScene extends Phaser.Scene {
  private retireArmed = false;
  private retireBtn: RetireControl | null = null;
  /** The compact composition draws its labels in sentence case and arms Retire on two lines. */
  private compact = false;
  /** The run's pool line, and the consequence line that replaces it while armed. */
  private runPoolLine: Phaser.GameObjects.Text | null = null;
  private retireWarning: Phaser.GameObjects.Text | null = null;
  private retireDisarm: Phaser.Time.TimerEvent | null = null;
  /**
   * A Premium grant this visit completed (the interrupted-save path below),
   * handed to the deck builder on Resume so its note names real numbers.
   */
  private premiumGrant: PremiumGrantSummary | null = null;
  /** Dev-only probe fixture: an in-memory save read instead of the real one, never persisted. */
  private fixture: LimitedHubA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private get saveData(): SaveData {
    return this.fixtureSave ?? Services.save.data;
  }
  constructor() {
    super('Limited');
  }
  create(data: { a11yFixture?: LimitedHubA11yFixture } = {}): void {
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save) : null;
    // Phaser keeps a start's data for the next start that passes none, so a
    // fixture must not outlive its probe visit.
    if (this.fixture) this.sys.settings.data = {};
    this.retireArmed = false;
    this.retireBtn = null;
    this.runPoolLine = null;
    this.retireWarning = null;
    this.retireDisarm = null;
    this.premiumGrant = null;
    this.compact = false;
    applyBackdrop(this, 'gauntlet', {
      dim: theme.graphics.dim,
      dimAlpha: 0.52,
      fallback: () => undefined,
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');
    const stage = sceneStage(this);
    this.compact = stage.compact;
    if (!this.compact) new Toast(this);
    const save = this.saveData;
    if (
      save.limited.activeRun?.status === 'draft' &&
      save.limited.activeRun.draft?.completed
    ) {
      // Interrupted-save path: the draft finished but completeDraftRun never
      // ran, so the familiarity tick from confirmPick never fired either.
      const grant = premiumGrantSummary(grantPremiumDraftPool(save, CARD_DB, save.limited.activeRun));
      if (grant.drafted > 0) this.premiumGrant = grant;
      recordDraftEncounters(save.limited, save.limited.activeRun);
      save.limited.activeRun = completeDraftRun(CARD_DB, save.limited.activeRun);
      this.persist();
    }
    if (this.compact) {
      this.buildCompact(stage.content);
      if (this.fixture?.armRetire && this.retireBtn) this.armRetire(false);
      return;
    }
    sceneTitle(this, 'Draft');
    // One line at the standard size; larger text wraps it inside the frame
    // (it ended past both frame edges at 130%), and the panels start below it.
    const subtitle = sceneSubtitle(
      this,
      `Draft from packs against seven rivals, build exactly ${LIMITED_DECK_SIZE} spells, then play three matches. Your Warchest of 10 lands is provided.`,
      { fontSize: theme.type.body },
    ).setAlign('center').setWordWrapWidth(theme.design.safeWidth, true);
    backButton(this, 'Play', () => this.scene.start('Play'));
    registerSceneBackNavigation(this, () => this.scene.start('Play'));
    // Gold is spendable here (the Premium Draft entry), so show the balance in
    // its usual top-right corner spot.
    goldBadge(this, HEADER_CURRENCY_ANCHOR.x, HEADER_CURRENCY_ANCHOR.y, { getValue: () => this.saveData.gold });
    const top = Math.max(PANELS_TOP, Math.ceil(subtitle.getBounds().bottom) + theme.space(3));
    this.drawRunPanel(top);
    // Both columns end on one line: the taller of the start panel's content
    // and the records list sets it, and the other grows to meet it.
    const startY = top + RUN_PANEL_H + PANEL_GAP;
    const bottom = this.drawStartPanel(startY, top + HISTORY_PANEL_MIN_H);
    this.drawHistory(top, bottom);
    if (this.fixture?.armRetire && this.retireBtn) this.armRetire(false);
  }
  private drawRunPanel(y: number): void {
    const run = this.saveData.limited.activeRun;
    const x = LEFT_X;
    panel(this, x, y, PANEL_W, RUN_PANEL_H);
    this.title(x + 24, y + 28, 'Active Run');
    if (!run) {
      this.text(x + 24, y + 76, 'No Limited run is active.', theme.type.body, theme.colors.muted);
      this.text(
        x + 24,
        y + 112,
        'Start a Free or Premium Draft to build a card pool.',
        theme.type.label,
        theme.colors.muted,
      );
      return;
    }
    // Draft matches are played against a seated persona — name the next one.
    const nextPersona =
      run.status === 'matches' ? draftPersonaById(run.draft?.personaIds[run.matchIndex + 1] ?? '') : null;
    const status =
      run.status === 'draft'
        ? `Drafting pack ${run.draft ? run.draft.packIndex + 1 : 1}, pick ${run.draft ? run.draft.pickIndex + 1 : 1}`
        : run.status === 'build'
          ? `Building ${run.deck.length}/${LIMITED_DECK_SIZE}`
          : `Match ${run.matchIndex + 1}/3${nextPersona ? ` · vs ${nextPersona.name}` : ''}`;
    this.text(
      x + 24,
      y + 72,
      `${draftModeLabel(run)} · ${status}`,
      theme.type.body,
      theme.colors.gold,
      theme.weight.w700,
    );
    this.text(x + 24, y + 106, `Record ${run.wins}-${run.losses}`, theme.type.label, theme.colors.body);
    this.runPoolLine = this.text(
      x + 24,
      y + 134,
      `Pool ${run.pool.length} cards   Deck ${run.deck.length}/${LIMITED_DECK_SIZE}`,
      theme.type.label,
      theme.colors.muted,
    );
    // Shown in the pool line's place while Retire is armed: the second press
    // is the one that loses something, so it has to say what.
    this.retireWarning = this.text(
      x + 24,
      y + 134,
      retireConsequence(run),
      theme.type.caption,
      theme.colors.danger,
    ).setVisible(false);
    this.button(x + CTA_COL_LEFT, y + 196, primaryActionLabel(run), 'primary', () => this.continueRun(run));
    this.retireBtn = this.button(x + CTA_COL_RIGHT, y + 196, 'Retire Run', 'danger', (pointer) =>
      this.retireRun(pointer),
    );
  }
  /** Returns the panel's bottom edge: its content's, or `minBottom` if lower. */
  private drawStartPanel(y: number, minBottom: number): number {
    const save = this.saveData;
    const runActive = !!save.limited.activeRun;
    const premiumStatus = premiumEntryStatus(save, todayString());
    const premiumUnaffordable = save.gold < ECONOMY.premiumDraftEntry;
    const premiumDisabled = runActive || !premiumStatus.allowed || premiumUnaffordable;
    const x = LEFT_X;
    const startPanel = panel(this, x, y, PANEL_W, START_PANEL_MIN_H);
    this.title(x + 24, y + 28, 'New Run', runActive ? theme.colors.muted : theme.colors.heading);
    // Seed controls are deliberately NOT exposed here (user decision
    // 2026-07-14): draft runs roll a fresh hidden seed at start — the
    // seed-sharing affordance stays a gauntlet feature.
    this.button(
      x + CTA_COL_LEFT,
      y + 84,
      'Free Draft',
      // One gold action per screen: Continue owns it while a run is active.
      runActive ? 'ghost' : 'primary',
      () => this.startFree(),
      runActive,
    );
    this.button(
      x + CTA_COL_RIGHT,
      y + 84,
      `Premium Draft · ${formatGold(ECONOMY.premiumDraftEntry)}`,
      'ghost',
      () => this.startPremium(),
      premiumDisabled,
    );
    // Each entry's terms sit under its own column so neither can read as
    // applying to the other: what the run pays, then whether the picks stay.
    // Caption geometry at the standard size: the first line starts at y+112
    // (the Free column's two-line wrap ends ~y+142), the keep-lines at y+152,
    // and the Premium column's pay line at y+132 between its single-line
    // allowance line and its keep-line. Those are floors: each caption starts
    // no higher than the one above it ends, so a wrapped line at a larger
    // size pushes the rest down, and the panel grows to hold the taller column.
    const column = (cx: number, muted: boolean, lines: readonly (readonly [number, string])[]): number => {
      let bottom = y;
      for (const [offset, copy] of lines) bottom = this.ctaCaption(cx, Math.max(y + offset, bottom), copy, muted);
      return bottom;
    };
    const captionsBottom = Math.max(
      column(x + CTA_COL_LEFT, runActive, [[112, freeDraftPayoutCopy()], [152, 'Picks are not kept.']]),
      column(x + CTA_COL_RIGHT, premiumDisabled, [
        [112, premiumAllowanceCopy(premiumStatus, runActive, premiumUnaffordable)],
        [132, 'Pays no gold.'],
        [152, 'Every pick is yours to keep.'],
      ]),
    );
    const height = Math.max(START_PANEL_MIN_H, captionsBottom + theme.space(3) - y, minBottom - y);
    if (height > START_PANEL_MIN_H) {
      // Redrawn at the measured height in the release panel's place in the
      // display order (behind its title, buttons and captions).
      const grown = panel(this, x, y, PANEL_W, height);
      this.children.moveBelow(grown, startPanel);
      startPanel.destroy();
    }
    return y + height;
  }
  /** One caption under a CTA column; returns its bottom edge. */
  private ctaCaption(x: number, y: number, text: string, muted: boolean): number {
    const caption = this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: muted ? theme.colors.muted : theme.colors.body,
        align: 'center',
        wordWrap: { width: CTA_W },
      })
      .setOrigin(0.5, 0);
    return caption.y + caption.height;
  }
  private drawHistory(y: number, bottom: number): void {
    const save = this.saveData;
    const x = RIGHT_X;
    panel(this, x, y, PANEL_W, bottom - y);
    this.title(x + 24, y + 28, 'Draft Records');
    this.text(
      x + 24,
      y + 62,
      `Best Draft ${save.limited.bestDraftWins}/3`,
      theme.type.label,
      theme.colors.gold,
    );
    const draftHistory = save.limited.history.filter((entry) => entry.mode === 'draft');
    if (!draftHistory.length) {
      this.text(
        x + 24,
        y + 110,
        'Completed draft runs will appear here.',
        theme.type.body,
        theme.colors.muted,
      );
      return;
    }
    // Release density, the 100% contract: eight records at a 42px pitch.
    this.data.set('a11yDensity', {
      actual: [{ id: 'records', rows: HISTORY_ROWS, columns: 1, pitch: HISTORY_PITCH, top: y + HISTORY_TOP }],
      release: [{ id: 'records', rows: 8, columns: 1, pitch: 42, top: 244 }],
    });
    // Each record is one plate with its text centred on it, inset from the
    // plate's edge; the detail column starts past the widest title so no
    // title runs into it at any text size.
    const plateX = x + 24;
    const plateW = PANEL_W - 48;
    const textX = plateX + theme.space(3);
    const rows = draftHistory.slice(0, HISTORY_ROWS).map((entry, i) => {
      const centerY = y + HISTORY_TOP + i * HISTORY_PITCH + HISTORY_ROW_H / 2;
      this.add
        .rectangle(plateX + plateW / 2, centerY, plateW, HISTORY_ROW_H, theme.graphics.rowFill, theme.alpha.chrome)
        .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.subtle);
      const title = this.title(
        textX,
        centerY,
        `${draftModeLabel(entry)} ${entry.wins}-${entry.losses}`,
        entry.wins === 3 ? theme.colors.gold : theme.colors.heading,
        theme.type.label,
      );
      return { entry, centerY, title };
    });
    const detailX = textX + Math.max(...rows.map((row) => row.title.width)) + theme.space(6);
    for (const { entry, centerY } of rows) {
      const style = DECK_STYLE_LABEL[entry.deckStyle];
      this.text(
        detailX,
        centerY,
        entry.premium ? style : `${style} · +${formatGold(entry.rewardGold)}`,
        theme.type.caption,
        theme.colors.muted,
      );
    }
  }
  private startFree(): void {
    if (this.saveData.limited.activeRun || this.fixture) return;
    this.saveData.limited.activeRun = startDraftRun(CARD_DB, freshRunSeed(), Date.now());
    this.persist();
    this.scene.start('LimitedDraft');
  }
  private startPremium(): void {
    const save = this.saveData;
    if (save.limited.activeRun || this.fixture) return;
    if (!payPremiumDraftEntry(save, todayString())) return;
    save.limited.activeRun = startDraftRun(CARD_DB, freshRunSeed(), Date.now(), { premium: true });
    this.persist();
    this.scene.start('LimitedDraft');
  }

  // ------------------------------------------------------------------ compact (phone and desktop)

  /** The hub's compact composition (S-Limited-Hub, S-Limited-Run, S-Limited-Retire). */
  private buildCompact(content: Rect): void {
    const type = theme.compactType;
    const save = this.saveData;
    const run = save.limited.activeRun;
    const leave = (): void => { this.scene.start('Play'); };
    registerSceneBackNavigation(this, leave);
    // The rules paragraph and the run's text are measured before the panels are placed.
    const probe = limitedHubLayout(content, 0, 0, false);
    const intro = this.add.text(probe.intro.x, probe.intro.y,
      `Draft from packs against seven rivals, build exactly ${LIMITED_DECK_SIZE} spells, then play three matches. Your Warchest of 10 lands is provided.`,
      { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: probe.intro.width, useAdvancedWrap: true } });
    const nextPersona = run?.status === 'matches' ? draftPersonaById(run.draft?.personaIds[run.matchIndex + 1] ?? '') : null;
    const lines = this.compactRunLines(run);
    const runTextH = lines.reduce((h, l) => h + this.lineHeight(l.size) + 4, 0);
    const layout = limitedHubLayout(content, Math.ceil(intro.height), runTextH, !!nextPersona);
    compactHeader(this, layout.shell, { title: 'Draft', gold: save.gold, onBack: leave });
    new Toast(this, { rail: { right: layout.column.x + layout.column.width, top: layout.column.y, width: layout.column.width } });

    // The active run.
    this.compactPanel(layout.run);
    if (layout.portrait && nextPersona) {
      const pic = layout.portrait;
      this.add.graphics().fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
      try {
        const inset = { x: pic.x + 2, y: pic.y + 2, width: pic.width - 4, height: pic.height - 4 };
        addPortraitArt(this, inset.x + inset.width / 2, inset.y + inset.height / 2, nextPersona.portraitCardId, (img) => coverFitImage(img, inset, 0.1), 'half');
      } catch {
        // the frame stands in for missing art
      }
      this.add.graphics().lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, 1)
        .strokeRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    }
    let y = layout.runText.y;
    for (const line of lines) {
      const text = this.add.text(layout.runText.x, y, line.text, {
        fontFamily: line.display ? theme.fonts.display : theme.fonts.ui, fontSize: `${line.size}px`,
        fontStyle: line.bold ? theme.weight.w700 : undefined, color: line.color,
      });
      ellipsizeText(text, layout.runText.width);
      if (line.role === 'pool') this.runPoolLine = text;
      if (line.role === 'warning') {
        // The armed Retire's consequence, in the pool line's place.
        text.setY(this.runPoolLine?.y ?? y).setWordWrapWidth(layout.runText.width, true).setVisible(false);
        this.retireWarning = text;
        continue;
      }
      y += this.lineHeight(line.size) + 4;
    }

    this.buildCompactRecords(layout.records);
    this.buildCompactColumn(layout, run);
  }

  /** The run panel's lines: its title, the run's status, record and pool (and the armed Retire's warning). */
  private compactRunLines(run: LimitedRun | null): { text: string; size: number; color: string; bold?: boolean; display?: boolean; role?: 'pool' | 'warning' }[] {
    const type = theme.compactType;
    const title = { text: 'Active Run', size: type.h2, color: theme.colors.heading, bold: true, display: true };
    if (!run) {
      return [title,
        { text: 'No Limited run is active.', size: type.body, color: theme.colors.muted },
        { text: 'Start a Free or Premium Draft to build a card pool.', size: type.label, color: theme.colors.muted }];
    }
    const nextPersona = run.status === 'matches' ? draftPersonaById(run.draft?.personaIds[run.matchIndex + 1] ?? '') : null;
    const status = run.status === 'draft'
      ? `Pack ${run.draft ? run.draft.packIndex + 1 : 1} · Pick ${run.draft ? run.draft.pickIndex + 1 : 1}`
      : run.status === 'build'
        ? `Building ${run.deck.length}/${LIMITED_DECK_SIZE}`
        : `Match ${run.matchIndex + 1}/3${nextPersona ? ` · vs ${nextPersona.name}` : ''}`;
    return [title,
      { text: `${draftModeLabel(run)} · ${status}`, size: type.body, color: theme.colors.gold, bold: true },
      { text: `Record ${run.wins}-${run.losses}`, size: type.label, color: theme.colors.body },
      { text: `Pool ${run.pool.length} cards · Deck ${run.deck.length}/${LIMITED_DECK_SIZE}`, size: type.label, color: theme.colors.muted, role: 'pool' },
      { text: retireConsequence(run), size: type.label, color: theme.colors.danger, role: 'warning' }];
  }

  /** Draft Records: the best run over the finished runs, newest first, scrolling. */
  private buildCompactRecords(box: Rect): void {
    const type = theme.compactType;
    const L = LIMITED_COMPACT;
    const save = this.saveData;
    this.compactPanel(box);
    const title = this.add.text(box.x + L.pad, box.y + L.pad, 'Draft Records', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const best = this.add.text(box.x + box.width - L.pad, title.y + title.height / 2, `Best Draft ${save.limited.bestDraftWins}/3`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setOrigin(1, 0.5);
    ellipsizeText(title, Math.max(0, best.x - best.width - COMPACT.gap - title.x));
    const list = { x: box.x + L.pad, y: title.y + title.height + COMPACT.gap, width: box.width - 2 * L.pad, height: 0 };
    list.height = Math.max(0, box.y + box.height - L.pad - list.y);
    const history = save.limited.history.filter((entry) => entry.mode === 'draft');
    if (!history.length) {
      this.add.text(list.x, list.y + 4, 'Completed draft runs will appear here.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: list.width, useAdvancedWrap: true },
      });
      return;
    }
    const rows = this.add.container(0, list.y);
    // Rows sit inside the scroll thumb's lane.
    const rowW = list.width - 6;
    history.forEach((entry, i) => {
      const top = i * (L.rowH + L.rowGap);
      const cy = top + L.rowH / 2;
      const plate = this.add.graphics().fillStyle(theme.graphics.rowFill, theme.alpha.chrome).fillRoundedRect(list.x, top, rowW, L.rowH, theme.radius.panel)
        .lineStyle(1, theme.graphics.panelStroke, theme.alpha.subtle).strokeRoundedRect(list.x, top, rowW, L.rowH, theme.radius.panel);
      const name = this.add.text(list.x + 12, cy, `${draftModeLabel({})} ${entry.wins}-${entry.losses}`, {
        fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
        color: entry.wins === 3 ? theme.colors.gold : theme.colors.heading,
      }).setOrigin(0, 0.5);
      const reward = entry.premium ? null : this.add.text(list.x + rowW - 12, cy, `+${formatGold(entry.rewardGold)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setOrigin(1, 0.5);
      let x = name.x + name.width + 10;
      const parts: Phaser.GameObjects.GameObject[] = [plate, name];
      if (entry.premium) {
        const pill = this.compactPill(x, cy, 'Premium');
        parts.push(pill);
        x += pill.width + 8;
      }
      const style = this.add.text(x, cy, DECK_STYLE_LABEL[entry.deckStyle].toLowerCase(), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      }).setOrigin(0, 0.5);
      ellipsizeText(style, Math.max(0, (reward ? reward.x - reward.width - 8 : list.x + rowW - 12) - x));
      parts.push(style);
      if (reward) parts.push(reward);
      rows.add(parts);
    });
    const total = history.length * (L.rowH + L.rowGap) - L.rowGap;
    bindMenuScroll(this, rows, list, total);
  }

  /** "Premium": an outlined gold pill, its left edge at `x`. */
  private compactPill(x: number, cy: number, text: string): Phaser.GameObjects.Container {
    const label = this.add.text(0, 0, text, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.caption}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
    }).setOrigin(0.5);
    const w = label.width + 16;
    const h = label.height + 6;
    const plate = this.add.graphics().lineStyle(1.5, colorInt(theme.colors.gold), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    return this.add.container(x + w / 2, cy, [plate, label]).setSize(w, h);
  }

  /** New Run: the Premium card and Free Draft, or both off with Retire and Continue in the foot. */
  private buildCompactColumn(layout: ReturnType<typeof limitedHubLayout>, run: LimitedRun | null): void {
    const type = theme.compactType;
    const L = LIMITED_COMPACT;
    const save = this.saveData;
    const col = layout.column;
    const heading = this.add.text(col.x, col.y, 'New Run', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700,
      color: run ? theme.colors.muted : theme.colors.heading,
    });
    let y = heading.y + heading.height + COMPACT.gap;
    const premium = premiumEntryStatus(save, todayString());
    const unaffordable = save.gold < ECONOMY.premiumDraftEntry;
    const premiumLabel = `Premium Draft · ${formatGold(ECONOMY.premiumDraftEntry)}`;
    if (run) {
      const free = compactButton(this, { x: col.x, y, width: col.width, height: COMPACT.touch }, 'Free Draft', { onTap: () => undefined });
      free.setEnabled(false);
      y += COMPACT.touch + COMPACT.gap;
      const prem = compactButton(this, { x: col.x, y, width: col.width, height: COMPACT.touch }, premiumLabel, { onTap: () => undefined });
      prem.setEnabled(false);
      y += COMPACT.touch + COMPACT.gap;
      this.add.text(col.x + col.width / 2, y, 'Finish active run first', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, align: 'center', wordWrap: { width: col.width },
      }).setOrigin(0.5, 0);
      const retire = compactButton(this, layout.retire, 'Retire run', { variant: 'danger', onTap: (pointer) => this.retireRun(pointer) });
      retire.label.setAlign('center');
      this.retireBtn = retire;
      compactButton(this, layout.next, sentenceCase(primaryActionLabel(run)), { variant: 'primary', onTap: () => this.continueRun(run) });
      return;
    }
    // The Premium entry as a card: its price, this week's allowance and what it keeps.
    const off = !premium.allowed || unaffordable;
    const card = { x: col.x, y, width: col.width, height: 0 };
    const lines = [
      this.add.text(0, 0, premiumLabel, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: off ? theme.colors.muted : theme.colors.heading }),
      this.add.text(0, 0, premiumAllowanceCopy(premium, false, unaffordable), { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted }),
      this.add.text(0, 0, 'Every pick is yours to keep.', { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: off ? theme.colors.muted : theme.colors.body }),
    ];
    for (const line of lines) line.setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(col.width - 2 * L.pad, true);
    const linesH = lines.reduce((h, l) => h + l.height, 0) + 4 * (lines.length - 1);
    // The Free Draft's payout line sits over the foot; the card keeps clear of it.
    const payout = this.add.text(col.x + col.width / 2, 0, freeDraftPayoutCopy(), {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body, align: 'center', wordWrap: { width: col.width, useAdvancedWrap: true },
    }).setOrigin(0.5, 1);
    payout.setY(layout.foot.y - COMPACT.gap);
    card.height = Math.max(L.premiumMinH, linesH + 2 * L.pad);
    card.height = Math.min(card.height, Math.max(COMPACT.touch, payout.y - payout.height - COMPACT.gap - card.y));
    const plate = this.add.graphics();
    const draw = (hover: boolean): void => {
      plate.clear().fillStyle(theme.graphics.panelFill, off ? theme.alpha.panel : 1).fillRoundedRect(card.x, card.y, card.width, card.height, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, hover && !off ? colorInt(theme.colors.goldHover) : theme.graphics.panelStroke, 1)
        .strokeRoundedRect(card.x, card.y, card.width, card.height, theme.radius.panel);
    };
    draw(false);
    let ly = card.y + Math.max(L.pad, (card.height - linesH) / 2);
    for (const line of lines) {
      line.setPosition(card.x + card.width / 2, ly).setDepth(1);
      ly += line.height + 4;
    }
    if (!off) {
      const zone = this.add.zone(card.x + card.width / 2, card.y + card.height / 2, card.width, card.height).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true)).on('pointerout', () => draw(false));
      zone.on('pointerup', () => this.startPremium());
    }
    compactButton(this, layout.foot, 'Free Draft', { variant: 'primary', onTap: () => this.startFree() });
  }

  private compactPanel(r: Rect): void {
    this.add.graphics().fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
  }

  /** One line's height at a compact size (measured once per size). */
  private lineHeight(size: number): number {
    const probe = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${size}px` });
    const h = probe.height;
    probe.destroy();
    return h;
  }

  /** Fixtures never reach storage. */
  private persist(): void {
    if (!this.fixture) Services.save.flush();
  }
  private continueRun(run: LimitedRun): void {
    if (this.fixture) return;
    if (run.status === 'draft') this.scene.start('LimitedDraft');
    else if (run.status === 'build') {
      const entry: LimitedBuilderEntry = this.premiumGrant ? { premiumGrant: this.premiumGrant } : {};
      this.scene.start('LimitedDeckBuilder', entry);
    }
    else this.scene.start('Duel', limitedDuelData(run));
  }
  private retireRun(pointer?: Phaser.Input.Pointer): void {
    if (this.saveData.settings.confirmDestructive && !this.retireArmed) {
      this.armRetire(pointer?.wasTouch ?? isTouchDevice());
      return;
    }
    if (this.fixture) return;
    this.retireDisarm?.remove(false);
    this.retireDisarm = null;
    this.saveData.limited.activeRun = null;
    this.persist();
    this.scene.restart();
  }
  /** First press: name the loss, then stand down after a few seconds unanswered. */
  private armRetire(touch: boolean): void {
    this.retireArmed = true;
    // The compact foot's Retire is narrow, so its armed label takes two lines (S-Limited-Retire).
    this.retireBtn?.setLabel(`${touch ? 'Tap' : 'Click'} again${this.compact ? '\n' : ' '}to retire`);
    this.retireBtn?.setVariant('danger');
    this.runPoolLine?.setVisible(false);
    this.retireWarning?.setVisible(true);
    this.retireDisarm?.remove(false);
    this.retireDisarm = this.time.delayedCall(RETIRE_ARM_MS, () => this.disarmRetire());
  }
  private disarmRetire(): void {
    this.retireDisarm = null;
    this.retireArmed = false;
    if (this.retireBtn?.container.active) this.retireBtn.setLabel(this.compact ? 'Retire run' : 'Retire Run');
    if (this.runPoolLine?.active) this.runPoolLine.setVisible(true);
    if (this.retireWarning?.active) this.retireWarning.setVisible(false);
  }
  private button(
    x: number,
    y: number,
    label: string,
    variant: 'primary' | 'ghost' | 'danger',
    onTap: (pointer: Phaser.Input.Pointer) => void,
    disabled = false,
  ): ThemedButton {
    return themedButton(this, x, y, label, { variant, minWidth: CTA_W, enabled: !disabled, onTap });
  }
  private title(
    x: number,
    y: number,
    text: string,
    color: string = theme.colors.heading,
    size: number = theme.type.h2,
  ): Phaser.GameObjects.Text {
    return this.text(x, y, text, size, color, undefined, theme.fonts.display);
  }
  private text(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    fontStyle?: string,
    fontFamily: string = theme.fonts.ui,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily, fontSize: `${size}px`, color, fontStyle })
      .setOrigin(0, 0.5);
  }
}

/**
 * What the second Retire press loses. A Premium run's entry fee is not
 * refunded, and before the draft completes its picks have not reached the
 * collection yet (grantPremiumDraftPool runs at completion), so they go too.
 */
function retireConsequence(run: LimitedRun): string {
  if (!run.premium) return 'Retiring discards this run (pool, deck, record) and its gold payout.';
  const fee = formatGold(ECONOMY.premiumDraftEntry);
  return run.status === 'draft'
    ? `Retiring forfeits the ${fee} entry fee and your picks so far.`
    : `Retiring forfeits the ${fee} entry fee; your drafted cards are kept.`;
}
/** Draft runs roll a hidden seed at start — the run stays reproducible internally, but seed sharing is a gauntlet-only affordance. */
function freshRunSeed(): number {
  return clampLimitedSeed(Math.floor(Math.random() * 2 ** 31));
}

/**
 * What a Free Draft pays, from the table itself: `limitedRunGold[wins]`, paid
 * once, after the third match (`applyLimitedMatchResult`). A Premium Draft
 * pays none of it; its entry fee buys the picks instead.
 */
function freeDraftPayoutCopy(): string {
  const table = ECONOMY.limitedRunGold;
  return `Pays ${formatGold(table[0])} to ${formatGold(table[table.length - 1])} after three matches, by wins.`;
}

function draftModeLabel(run: { premium?: boolean }): string {
  return run.premium ? 'Premium Draft' : 'Draft';
}

function premiumAllowanceCopy(
  status: { allowed: boolean; remaining: number; resetsInDays: number },
  runActive: boolean,
  unaffordable: boolean,
): string {
  if (!status.allowed) return `Weekly limit · Resets in ${status.resetsInDays} ${status.resetsInDays === 1 ? 'day' : 'days'}`;
  if (runActive) return 'Finish active run first';
  if (unaffordable) return `Not enough gold · ${status.remaining} left this week`;
  return `${status.remaining} left this week`;
}

/** "Continue Match" as the compact layout writes it: "Continue match". */
function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function primaryActionLabel(run: LimitedRun): string {
  return run.status === 'draft'
    ? 'Resume Draft'
    : run.status === 'build'
      ? 'Build Deck'
      : 'Continue Match';
}
