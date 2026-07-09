import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import {
  clampLimitedSeed,
  completeDraftRun,
  limitedDuelData,
  startDraftRun,
  startSealedRun,
  type LimitedRun,
} from '../meta/Limited';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';

export class LimitedScene extends Phaser.Scene {
  private pendingSeed: number | null = null;
  private retireArmed = false;
  private retireBtn: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Limited');
  }

  create(): void {
    this.retireArmed = false;
    this.retireBtn = null;
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'gauntlet', {
      dim: 0x0b0812,
      dimAlpha: 0.52,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        g.fillRect(0, 0, width, height);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const save = Services.save.data;
    if (save.limited.activeRun?.mode === 'draft' && save.limited.activeRun.status === 'draft' && save.limited.activeRun.draft?.completed) {
      save.limited.activeRun = completeDraftRun(CARD_DB, save.limited.activeRun);
      Services.save.flush();
    }
    this.pendingSeed = save.limited.activeRun?.seed ?? clampLimitedSeed(this.pendingSeed ?? Math.floor(Math.random() * 2 ** 31));

    this.add
      .text(width / 2, 52, 'Limited', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '46px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 90, 'Open a temporary pool, build exactly 40 cards, then play three matches.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#a89cc6',
      })
      .setOrigin(0.5);
    this.add
      .text(width - 30, 30, `${save.gold} gold`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);

    const back = this.add
      .text(28, 28, 'Menu', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#c9bde0',
      })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);

    this.drawRunPanel();
    this.drawStartPanel();
    this.drawHistory();
  }

  private drawRunPanel(): void {
    const save = Services.save.data;
    const run = save.limited.activeRun;
    const x = 70;
    const y = 140;
    const w = 540;
    const h = 235;
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.88);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);
    g.strokeRoundedRect(x, y, w, h, 8);

    this.add.text(x + 24, y + 22, 'Active Run', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '26px',
      color: '#f0e6ff',
    });

    if (!run) {
      this.add.text(x + 24, y + 76, 'No Limited run is active.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '17px',
        color: '#a89cc6',
      });
      this.add.text(x + 24, y + 112, 'Start Sealed or Bot Draft to create a temporary card pool.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#8f83a8',
      });
      return;
    }

    const status =
      run.status === 'draft'
        ? `Drafting pack ${run.draft ? run.draft.packIndex + 1 : 1}, pick ${run.draft ? run.draft.pickIndex + 1 : 1}`
        : run.status === 'build'
          ? `Building ${run.deck.length}/40`
          : `Match ${run.matchIndex + 1}/3`;
    this.add.text(x + 24, y + 72, `${labelMode(run)} - ${status}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '18px',
      fontStyle: '700',
      color: '#ffd88a',
    });
    this.add.text(x + 24, y + 106, `Record ${run.wins}-${run.losses}   Seed ${run.seed}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: '#c9bde0',
    });
    this.add.text(x + 24, y + 134, `Pool ${run.pool.length} cards   Deck ${run.deck.length}/40`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: '#a89cc6',
    });

    this.button(x + 24, y + 176, primaryActionLabel(run), true, () => this.continueRun(run));
    this.retireBtn = this.button(x + 214, y + 176, 'Retire Run', false, () => this.retireRun());
  }

  private drawStartPanel(): void {
    const runActive = !!Services.save.data.limited.activeRun;
    const x = 70;
    const y = 410;
    const w = 540;
    const h = 210;
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.88);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);
    g.strokeRoundedRect(x, y, w, h, 8);

    this.add.text(x + 24, y + 22, 'New Run', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '26px',
      color: runActive ? '#8f83a8' : '#f0e6ff',
    });
    const seed = this.pendingSeed ?? 1;
    this.add.text(x + 24, y + 62, `Next seed ${seed}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: runActive ? '#6d6288' : '#c9bde0',
    });

    this.button(x + 24, y + 104, 'Sealed Run', true, () => {
      if (runActive) return;
      Services.save.data.limited.activeRun = startSealedRun(CARD_DB, seed, Date.now());
      Services.save.flush();
      this.scene.start('LimitedReveal');
    }, runActive);
    this.button(x + 200, y + 104, 'Bot Draft Run', true, () => {
      if (runActive) return;
      Services.save.data.limited.activeRun = startDraftRun(CARD_DB, seed, Date.now());
      Services.save.flush();
      this.scene.start('LimitedDraft');
    }, runActive);
    this.button(x + 24, y + 158, 'Reroll Seed', false, () => {
      if (runActive) return;
      this.pendingSeed = clampLimitedSeed(Math.floor(Math.random() * 2 ** 31));
      this.scene.restart();
    }, runActive);
    this.button(x + 200, y + 158, 'Set Seed', false, () => {
      if (runActive) return;
      this.promptSeed();
    }, runActive);
  }

  private drawHistory(): void {
    const save = Services.save.data;
    const x = 670;
    const y = 140;
    const w = 540;
    const h = 480;
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.88);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);
    g.strokeRoundedRect(x, y, w, h, 8);

    this.add.text(x + 24, y + 22, 'Limited Records', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '26px',
      color: '#f0e6ff',
    });
    this.add.text(x + 24, y + 62, `Best Sealed ${save.limited.bestSealedWins}/3   Best Draft ${save.limited.bestDraftWins}/3`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: '#ffd88a',
    });

    if (save.limited.history.length === 0) {
      this.add.text(x + 24, y + 110, 'Completed Limited runs will appear here.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#8f83a8',
      });
      return;
    }

    save.limited.history.slice(0, 8).forEach((entry, i) => {
      const rowY = y + 104 + i * 42;
      this.add.text(x + 24, rowY, `${labelMode(entry)} ${entry.wins}-${entry.losses}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '17px',
        color: entry.wins === 3 ? '#ffe08a' : '#f0e6ff',
      });
      this.add.text(x + 174, rowY + 2, `${entry.deckStyle}   seed ${entry.seed}   +${entry.rewardGold} gold`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#a89cc6',
      });
    });
  }

  private continueRun(run: LimitedRun): void {
    if (run.status === 'draft') {
      this.scene.start('LimitedDraft');
      return;
    }
    if (run.status === 'build') {
      this.scene.start('LimitedDeckBuilder');
      return;
    }
    this.scene.start('Duel', limitedDuelData(run));
  }

  private retireRun(): void {
    if (Services.save.data.settings.confirmDestructive && !this.retireArmed) {
      this.retireArmed = true;
      this.retireBtn?.setText('Click again to retire').setColor('#f08a8a');
      if (this.retireBtn) inflateHitArea(this.retireBtn, 90, 58);
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
    primary: boolean,
    cb: () => void,
    disabled = false,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: primary ? 'Cinzel, Georgia, serif' : 'Inter, Arial, sans-serif',
        fontSize: primary ? '22px' : '16px',
        color: disabled ? '#6d6288' : primary ? '#ffd88a' : '#f0b0b0',
        backgroundColor: disabled ? '#1b1726' : primary ? '#2c2344' : '#3a1f28',
        padding: { x: primary ? 18 : 14, y: primary ? 10 : 8 },
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: !disabled });
    if (!disabled) bindTapButton(this, btn, cb);
    inflateHitArea(btn, 90, 58);
    return btn;
  }
}

function labelMode(run: Pick<LimitedRun, 'mode'> | { mode: 'sealed' | 'draft' }): string {
  return run.mode === 'sealed' ? 'Sealed' : 'Draft';
}

function primaryActionLabel(run: LimitedRun): string {
  if (run.status === 'draft') return 'Resume Draft';
  if (run.status === 'build') return 'Build Deck';
  return 'Continue Match';
}
