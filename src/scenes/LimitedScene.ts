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
import { applyBackdrop } from '../ui/SceneBackdrop';
import { HEADER_CURRENCY_ANCHOR } from '../ui/layout';
import {
  premiumGrantSummary,
  type LimitedBuilderEntry,
  type LimitedHubA11yFixture,
  type PremiumGrantSummary,
} from '../ui/limitedDraftPresentation';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { theme } from '../ui/theme';
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

export class LimitedScene extends Phaser.Scene {
  private retireArmed = false;
  private retireBtn: ThemedButton | null = null;
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
    new Toast(this);
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
      () => {
        if (!runActive && !this.fixture) {
          this.saveData.limited.activeRun = startDraftRun(CARD_DB, freshRunSeed(), Date.now());
          this.persist();
          this.scene.start('LimitedDraft');
        }
      },
      runActive,
    );
    this.button(
      x + CTA_COL_RIGHT,
      y + 84,
      `Premium Draft · ${formatGold(ECONOMY.premiumDraftEntry)}`,
      'ghost',
      () => {
        if (runActive || this.fixture) return;
        if (!payPremiumDraftEntry(save, todayString())) return;
        const run = startDraftRun(CARD_DB, freshRunSeed(), Date.now(), { premium: true });
        save.limited.activeRun = run;
        this.persist();
        this.scene.start('LimitedDraft');
      },
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
    this.retireBtn?.setLabel(`${touch ? 'Tap' : 'Click'} again to retire`);
    this.retireBtn?.setVariant('danger');
    this.runPoolLine?.setVisible(false);
    this.retireWarning?.setVisible(true);
    this.retireDisarm?.remove(false);
    this.retireDisarm = this.time.delayedCall(RETIRE_ARM_MS, () => this.disarmRetire());
  }
  private disarmRetire(): void {
    this.retireDisarm = null;
    this.retireArmed = false;
    if (this.retireBtn?.container.active) this.retireBtn.setLabel('Retire Run');
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

function primaryActionLabel(run: LimitedRun): string {
  return run.status === 'draft'
    ? 'Resume Draft'
    : run.status === 'build'
      ? 'Build Deck'
      : 'Continue Match';
}
