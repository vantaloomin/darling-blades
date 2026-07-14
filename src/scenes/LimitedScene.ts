import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById } from '../data/draftPersonas';
import {
  clampLimitedSeed,
  completeDraftRun,
  limitedDuelData,
  recordDraftEncounters,
  startDraftRun,
  type LimitedRun,
} from '../meta/Limited';
import { Services } from '../meta/services';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { backButton, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';

export class LimitedScene extends Phaser.Scene {
  private pendingSeed: number | null = null;
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
      recordDraftEncounters(save.limited, save.limited.activeRun);
      save.limited.activeRun = completeDraftRun(CARD_DB, save.limited.activeRun);
      Services.save.flush();
    }
    this.pendingSeed =
      save.limited.activeRun?.seed ??
      clampLimitedSeed(this.pendingSeed ?? Math.floor(Math.random() * 2 ** 31));
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
        'Start a Bot Draft run to build a temporary card pool.',
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
    this.text(
      x + 24,
      y + 106,
      `Record ${run.wins}-${run.losses}   Seed ${run.seed}`,
      theme.type.label,
      theme.colors.body,
    );
    this.text(
      x + 24,
      y + 134,
      `Pool ${run.pool.length} cards   Deck ${run.deck.length}/40`,
      theme.type.label,
      theme.colors.muted,
    );
    this.button(x + 110, y + 196, primaryActionLabel(run), 'primary', () => this.continueRun(run));
    this.retireBtn = this.button(x + 360, y + 196, 'Retire Run', 'danger', () => this.retireRun());
  }
  private drawStartPanel(): void {
    const runActive = !!Services.save.data.limited.activeRun;
    const x = 70;
    const y = 410;
    const seed = this.pendingSeed ?? 1;
    panel(this, x, y, 540, 210);
    this.title(x + 24, y + 28, 'New Run', runActive ? theme.colors.muted : theme.colors.heading);
    this.text(
      x + 24,
      y + 62,
      `Next seed ${seed}`,
      theme.type.label,
      runActive ? theme.colors.muted : theme.colors.body,
    );
    // Sealed was removed from the hub (user decision 2026-07-14) — the mode's
    // meta core and scenes stay in the codebase, but only Bot Draft is
    // offered. Removal record: plan-v1.1-post-launch.md Feature 5.
    this.button(
      x + 216,
      y + 124,
      'Bot Draft Run',
      'primary',
      () => {
        if (!runActive) {
          Services.save.data.limited.activeRun = startDraftRun(CARD_DB, seed, Date.now());
          Services.save.flush();
          this.scene.start('LimitedDraft');
        }
      },
      runActive,
    );
    this.button(
      x + 112,
      y + 176,
      'Reroll Seed',
      'ghost',
      () => {
        if (!runActive) {
          this.pendingSeed = clampLimitedSeed(Math.floor(Math.random() * 2 ** 31));
          this.scene.restart();
        }
      },
      runActive,
    );
    this.button(
      x + 320,
      y + 176,
      'Set Seed',
      'ghost',
      () => {
        if (!runActive) this.promptSeed();
      },
      runActive,
    );
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
        `${labelMode(entry)} ${entry.wins}-${entry.losses}`,
        entry.wins === 3 ? theme.colors.gold : theme.colors.heading,
        theme.type.label,
      );
      this.text(
        x + 174,
        rowY + 2,
        `${entry.deckStyle}   seed ${entry.seed}   +${entry.rewardGold} gold`,
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
  private promptSeed(): void {
    try {
      const input = window.prompt('Enter a Limited run seed.', String(this.pendingSeed));
      if (input == null) return;
      const n = Number(input.trim());
      if (!Number.isFinite(n)) return;
      this.pendingSeed = clampLimitedSeed(n);
      this.scene.restart();
    } catch {
      /* prompt unavailable */
    }
  }
  private button(
    x: number,
    y: number,
    label: string,
    variant: 'primary' | 'ghost' | 'danger',
    onTap: () => void,
    disabled = false,
  ): ThemedButton {
    return themedButton(this, x, y, label, { variant, minWidth: 170, enabled: !disabled, onTap });
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
function labelMode(run: Pick<LimitedRun, 'mode'> | { mode: 'sealed' | 'draft' }): string {
  return run.mode === 'sealed' ? 'Sealed' : 'Draft';
}
function primaryActionLabel(run: LimitedRun): string {
  return run.status === 'draft'
    ? 'Resume Draft'
    : run.status === 'build'
      ? 'Build Deck'
      : 'Continue Match';
}
