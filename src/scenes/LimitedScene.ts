import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById } from '../data/draftPersonas';
import {
  clampLimitedSeed,
  completeDraftRun,
  grantPremiumDraftPool,
  limitedDuelData,
  recordDraftEncounters,
  startDraftRun,
  type LimitedRun,
} from '../meta/Limited';
import { payPremiumDraftEntry } from '../meta/Economy';
import { Services } from '../meta/services';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { backButton, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';

/**
 * One shared two-column CTA grid for every button row in the left panels
 * (Resume/Retire, Bot Draft/Premium, Reroll/Set Seed): a fixed width wide
 * enough for the longest label ("Premium Draft - 1,000g", the armed "Click
 * again to retire"), the left column's edge flush with the x+24 text inset
 * and the right column's edge flush with the right inset of the 540 panel.
 */
const CTA_W = 220;
const CTA_COL_LEFT = 24 + CTA_W / 2; // 134
const CTA_COL_RIGHT = 540 - 24 - CTA_W / 2; // 406

export class LimitedScene extends Phaser.Scene {
  private retireArmed = false;
  private retireBtn: ThemedButton | null = null;
  constructor() {
    super('Limited');
  }
  create(): void {
    this.retireArmed = false;
    this.retireBtn = null;
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
    const save = Services.save.data;
    if (
      save.limited.activeRun?.mode === 'draft' &&
      save.limited.activeRun.status === 'draft' &&
      save.limited.activeRun.draft?.completed
    ) {
      // Interrupted-save path: the draft finished but completeDraftRun never
      // ran, so the familiarity tick from confirmPick never fired either.
      grantPremiumDraftPool(save, CARD_DB, save.limited.activeRun);
      recordDraftEncounters(save.limited, save.limited.activeRun);
      save.limited.activeRun = completeDraftRun(CARD_DB, save.limited.activeRun);
      Services.save.flush();
    }
    this.add
      .text(640, 52, 'Draft', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(640, 90, 'Draft from packs against seven rivals, build exactly 40 cards, then play three matches.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    backButton(this, () => this.scene.start('Play'));
    this.drawRunPanel();
    this.drawStartPanel();
    this.drawHistory();
  }
  private drawRunPanel(): void {
    const run = Services.save.data.limited.activeRun;
    const x = 70;
    const y = 140;
    panel(this, x, y, 540, 235);
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
      run.mode === 'draft' && run.status === 'matches'
        ? draftPersonaById(run.draft?.personaIds[run.matchIndex + 1] ?? '')
        : null;
    const status =
      run.status === 'draft'
        ? `Drafting pack ${run.draft ? run.draft.packIndex + 1 : 1}, pick ${run.draft ? run.draft.pickIndex + 1 : 1}`
        : run.status === 'build'
          ? `Building ${run.deck.length}/40`
          : `Match ${run.matchIndex + 1}/3${nextPersona ? ` · vs ${nextPersona.name}` : ''}`;
    this.text(
      x + 24,
      y + 72,
      `${labelMode(run)} · ${status}`,
      theme.type.body,
      theme.colors.gold,
      theme.weight.w700,
    );
    this.text(x + 24, y + 106, `Record ${run.wins}-${run.losses}`, theme.type.label, theme.colors.body);
    this.text(
      x + 24,
      y + 134,
      `Pool ${run.pool.length} cards   Deck ${run.deck.length}/40`,
      theme.type.label,
      theme.colors.muted,
    );
    this.button(x + CTA_COL_LEFT, y + 196, primaryActionLabel(run), 'primary', () => this.continueRun(run));
    this.retireBtn = this.button(x + CTA_COL_RIGHT, y + 196, 'Retire Run', 'danger', () => this.retireRun());
  }
  private drawStartPanel(): void {
    const save = Services.save.data;
    const runActive = !!save.limited.activeRun;
    const premiumDisabled = runActive || save.gold < ECONOMY.premiumDraftEntry;
    const x = 70;
    const y = 410;
    panel(this, x, y, 540, 180);
    this.title(x + 24, y + 28, 'New Run', runActive ? theme.colors.muted : theme.colors.heading);
    // Seed controls are deliberately NOT exposed here (user decision
    // 2026-07-14): draft runs roll a fresh hidden seed at start — the
    // seed-sharing affordance stays a gauntlet feature. Sealed was removed
    // from the hub the same day (plan-v1.1-post-launch.md Feature 5).
    this.button(
      x + CTA_COL_LEFT,
      y + 84,
      'Free Draft',
      'primary',
      () => {
        if (!runActive) {
          Services.save.data.limited.activeRun = startDraftRun(CARD_DB, freshRunSeed(), Date.now());
          Services.save.flush();
          this.scene.start('LimitedDraft');
        }
      },
      runActive,
    );
    this.button(
      x + CTA_COL_RIGHT,
      y + 84,
      `Premium Draft - ${ECONOMY.premiumDraftEntry.toLocaleString('en-US')}g`,
      'primary',
      () => {
        if (runActive) return;
        const run = startDraftRun(CARD_DB, freshRunSeed(), Date.now(), { premium: true });
        if (!payPremiumDraftEntry(save)) return;
        save.limited.activeRun = run;
        Services.save.flush();
        this.scene.start('LimitedDraft');
      },
      premiumDisabled,
    );
    // Premium-only descriptor, anchored under the Premium column so it can't
    // read as applying to the free entry.
    this.add
      .text(x + CTA_COL_RIGHT, y + 118, 'Variants roll, and every card you draft is yours to keep.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: premiumDisabled ? theme.colors.muted : theme.colors.body,
        align: 'center',
        wordWrap: { width: CTA_W },
      })
      .setOrigin(0.5, 0);
  }
  private drawHistory(): void {
    const save = Services.save.data;
    const x = 670;
    const y = 140;
    panel(this, x, y, 540, 480);
    this.title(x + 24, y + 28, 'Draft Records');
    this.text(
      x + 24,
      y + 62,
      `Best Draft ${save.limited.bestDraftWins}/3`,
      theme.type.label,
      theme.colors.gold,
    );
    if (!save.limited.history.length) {
      this.text(
        x + 24,
        y + 110,
        'Completed draft runs will appear here.',
        theme.type.body,
        theme.colors.muted,
      );
      return;
    }
    save.limited.history.slice(0, 8).forEach((entry, i) => {
      const rowY = y + 104 + i * 42;
      const row = this.add.rectangle(
        x + 270,
        rowY + 12,
        492,
        36,
        theme.graphics.rowFill,
        theme.alpha.chrome,
      );
      row.setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.subtle);
      this.title(
        x + 24,
        rowY + 2,
        `${entry.premium ? '[P] Draft' : labelMode(entry)} ${entry.wins}-${entry.losses}`,
        entry.wins === 3 ? theme.colors.gold : theme.colors.heading,
        theme.type.label,
      );
      this.text(
        x + 174,
        rowY + 2,
        `${entry.deckStyle}   +${entry.rewardGold} gold`,
        theme.type.caption,
        theme.colors.muted,
      );
    });
  }
  private continueRun(run: LimitedRun): void {
    if (run.status === 'draft') this.scene.start('LimitedDraft');
    else if (run.status === 'build') this.scene.start('LimitedDeckBuilder');
    else this.scene.start('Duel', limitedDuelData(run));
  }
  private retireRun(): void {
    if (Services.save.data.settings.confirmDestructive && !this.retireArmed) {
      this.retireArmed = true;
      this.retireBtn?.setLabel('Click again to retire');
      this.retireBtn?.setVariant('danger');
      return;
    }
    Services.save.data.limited.activeRun = null;
    Services.save.flush();
    this.scene.restart();
  }
  private button(
    x: number,
    y: number,
    label: string,
    variant: 'primary' | 'ghost' | 'danger',
    onTap: () => void,
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
  ): void {
    this.text(x, y, text, size, color, undefined, theme.fonts.display);
  }
  private text(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    fontStyle?: string,
    fontFamily: string = theme.fonts.ui,
  ): void {
    this.add
      .text(x, y, text, { fontFamily, fontSize: `${size}px`, color, fontStyle })
      .setOrigin(0, 0.5);
  }
}
/** Draft runs roll a hidden seed at start — the run stays reproducible internally, but seed sharing is a gauntlet-only affordance. */
function freshRunSeed(): number {
  return clampLimitedSeed(Math.floor(Math.random() * 2 ** 31));
}

function labelMode(run: { mode: 'sealed' | 'draft'; premium?: boolean }): string {
  return run.mode === 'sealed' ? 'Sealed' : run.premium ? 'Premium Draft' : 'Draft';
}
function primaryActionLabel(run: LimitedRun): string {
  return run.status === 'draft'
    ? 'Resume Draft'
    : run.status === 'build'
      ? 'Build Deck'
      : 'Continue Match';
}
