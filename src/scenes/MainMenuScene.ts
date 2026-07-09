import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ScriptAI } from '../ai/ScriptAI';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { tutorialLaunchData } from '../data/tutorial';
import { evaluateAchievements, syncAchievements } from '../meta/Achievements';
import { todayString } from '../meta/Economy';
import {
  claimDailyQuest,
  dailyQuestStatuses,
  dailyRerollsRemaining,
  dailyStreakStatus,
  ensureDailyState,
  rerollDailyQuest,
} from '../meta/Quests';
import { Services } from '../meta/services';
import { IS_DEV } from '../platform/env';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { VERSION_LABEL } from '../version';

const MENU_ITEMS: { label: string; scene?: string; data?: object }[] = [
  { label: 'Avatar Gauntlet', scene: 'Gauntlet' },
  { label: 'Limited', scene: 'Limited' },
  { label: 'Practice — Easy', scene: 'Duel', data: { difficulty: 'easy' } },
  { label: 'Practice — Medium', scene: 'Duel', data: { difficulty: 'medium' } },
  { label: 'Practice — Hard', scene: 'Duel', data: { difficulty: 'hard' } },
  { label: 'Open Packs', scene: 'Shop' },
  { label: 'Collection', scene: 'Collection' },
  { label: 'Achievements', scene: 'Achievements' },
  { label: 'Deck Builder', scene: 'DeckBuilder' },
  { label: 'Card Showcase', scene: 'Showcase' },
];

export class MainMenuScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private guard = new ModalGuard();

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.menuItems = [];
    this.guard = new ModalGuard();
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;

    // Backdrop first so all UI renders above it (docs/scene-art.md §3). No
    // real art → the scene keeps its bare #0d0a14 clear colour (the canvas
    // backgroundColor); today's look is unchanged.
    applyBackdrop(this, 'mainmenu', {
      dim: 0x0d0a14,
      // 0.50, raised from the 0.35 starting point (2026-07-03): the generated
      // vista's horizon glow reaches the bottom menu items; 0.35 left the
      // central column at ~35% luminance vs the ≤28% cap (scene-art.md §2).
      dimAlpha: 0.5,
      fallback: () => {
        /* scene had no background of its own — the #0d0a14 clear shows */
      },
    });

    // One tick/click for every interactive object; rapid duplicates dedupe in
    // Sfx. Hover SFX is mouse-only — touch fires pointerover on finger-down
    // and must stay silent (mobile-lan-plan §1.3).
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    const save = Services.save.data;
    if (syncAchievements(save, CARD_DB).length > 0) Services.save.flush();
    const today = todayString();
    if (ensureDailyState(save, today)) Services.save.flush();
    const claimableAchievements = evaluateAchievements(save, CARD_DB).filter(
      (status) => status.unlocked && !status.claimed,
    ).length;

    this.add
      .text(width / 2, 140, 'Darling Blades', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '72px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 205, 'Three Kingdoms · Olympus · The Wilds', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    this.add
      .text(width - 30, 30, `🪙 ${Services.save.data.gold}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);

    // Settings entry: a gear under the gold counter (the 8-row menu list is
    // full). The gold text above is non-interactive, so the 90px inflated hit
    // rect has no interactive neighbor to collide with. It joins menuItems so
    // the starter-picker ModalGuard disables it too. (The old VolumeControl
    // widget is gone — SettingsScene owns all audio controls now.)
    const gear = this.add
      .text(width - 30, 82, '⚙ Settings', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    gear.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) gear.setColor('#ffd700');
    });
    gear.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) gear.setColor('#c9bde0');
    });
    bindTapButton(this, gear, () => this.scene.start('Settings'));
    inflateHitArea(gear, 90, 90);
    this.menuItems.push(gear);

    // Profile entry: top-left corner, balancing the top-right gold+gear cluster.
    // Like the gear, it lives in the corner because the 8-row menu list is full;
    // joins menuItems so the starter-picker ModalGuard disables it too.
    const profile = this.add
      .text(30, 30, '👤 Profile', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    profile.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) profile.setColor('#ffd700');
    });
    profile.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) profile.setColor('#c9bde0');
    });
    bindTapButton(this, profile, () => this.scene.start('Profile'));
    inflateHitArea(profile, 90, 90);
    this.menuItems.push(profile);

    // "How to Play" — replay the optional tutorial anytime (top-left, under
    // Profile, mirroring ⚙ Settings on the right). Makes skipping reversible
    // (docs/plan-road-to-1.0.md Feature 1). Joins menuItems so the starter
    // picker's ModalGuard deadens it too.
    const howto = this.add
      .text(30, 82, '❔ How to Play', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    howto.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) howto.setColor('#ffd700');
    });
    howto.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) howto.setColor('#c9bde0');
    });
    bindTapButton(this, howto, () => this.startTutorial());
    inflateHitArea(howto, 90, 90);
    this.menuItems.push(howto);

    this.drawDailyPanel(today);

    // Card Showcase is a variant-QA surface — dev/local builds only (IS_DEV);
    // filtering (not hiding) keeps the row layout gap-free on the public build.
    const items = MENU_ITEMS.filter((entry) => entry.scene !== 'Showcase' || IS_DEV);
    const menuX = 360;
    const firstY = items.length > 8 ? 268 : 286;
    const pitchY = items.length > 8 ? 42 : 50;
    const itemFont = items.length > 8 ? '26px' : '28px';
    items.forEach((entry, i) => {
      const label =
        entry.scene === 'Achievements' && claimableAchievements > 0
          ? `${entry.label} (${claimableAchievements})`
          : entry.label;
      const item = this.add
        .text(menuX, firstY + i * pitchY, label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: itemFont,
          color: '#c9bde0',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      item.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) item.setColor('#ffd700');
      });
      item.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) item.setColor('#c9bde0');
      });
      if (entry.scene) {
        bindTapButton(this, item, () => this.scene.start(entry.scene!, entry.data));
      }
      // Hit boxes fill the full 56px row pitch (the audited 15px dead gaps
      // between rows are the fix column's target — plan §1.4).
      inflateHitArea(item, 90, pitchY);
      this.menuItems.push(item);
    });

    // Build identity, bottom-left corner (non-interactive, low-contrast). The
    // Settings screen hosts the on-demand "Check for updates" action.
    this.add.text(14, 702, VERSION_LABEL, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: '#6a6482',
    });

    if (!Services.save.data.tutorialDone) this.promptTutorial();
  }

  private drawDailyPanel(today: string): void {
    const save = Services.save.data;
    const quests = dailyQuestStatuses(save, today);
    const rerollsLeft = dailyRerollsRemaining(save, today);
    const streak = dailyStreakStatus(save, today);
    const x = 670;
    const y = 250;
    const w = 540;
    const h = 380;
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.86);
    g.lineStyle(1, 0x4e4266, 0.85);
    g.fillRoundedRect(x, y, w, h, 8);
    g.strokeRoundedRect(x, y, w, h, 8);

    this.add.text(x + 24, y + 22, 'Daily Blades', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '26px',
      color: '#f0e6ff',
    });
    this.add
      .text(x + w - 24, y + 25, `Rerolls ${rerollsLeft}/${ECONOMY.dailyRerollsPerDay}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#a89cc6',
      })
      .setOrigin(1, 0);

    const streakText = streak.wonToday
      ? `Streak ${streak.count} - win locked in`
      : `Streak ${streak.count} - next win +${streak.nextGold}`;
    this.add.text(x + 24, y + 55, streakText, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: streak.wonToday ? '#9be6a8' : '#ffd88a',
    });

    quests.forEach((quest, i) => {
      const rowY = y + 86 + i * 92;
      const rowH = 78;
      g.fillStyle(0x211a34, 0.78);
      g.lineStyle(1, 0x3a3151, 0.85);
      g.fillRoundedRect(x + 18, rowY, w - 36, rowH, 6);
      g.strokeRoundedRect(x + 18, rowY, w - 36, rowH, 6);

      this.add.text(x + 34, rowY + 10, quest.title, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: quest.claimed ? '#8f83a8' : '#f0e6ff',
      });
      this.add.text(x + 34, rowY + 35, quest.description, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#a89cc6',
      });

      const barX = x + 34;
      const barY = rowY + 61;
      const barW = 278;
      const fillW = Math.round((barW * Math.min(quest.progress, quest.target)) / quest.target);
      g.fillStyle(0x3a3151, 1);
      g.fillRoundedRect(barX, barY, barW, 8, 4);
      if (fillW > 0) {
        g.fillStyle(quest.complete ? 0x9be6a8 : 0xffd88a, 1);
        g.fillRoundedRect(barX, barY, fillW, 8, 4);
      }
      this.add
        .text(barX + barW + 12, barY - 5, `${Math.min(quest.progress, quest.target)}/${quest.target}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#cbc2e0',
        })
        .setOrigin(0, 0);

      const buttonX = x + w - 84;
      const buttonY = rowY + 40;
      if (quest.claimed) {
        this.add
          .text(buttonX, buttonY, 'Claimed', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '14px',
            color: '#7dd3a8',
          })
          .setOrigin(0.5);
      } else if (quest.complete) {
        this.dailyButton(buttonX, buttonY, `Claim +${quest.rewardGold}`, true, () => {
          const result = claimDailyQuest(save, i, todayString());
          if (!result.ok) return;
          Services.save.flush();
          Sfx.play('coin');
          this.scene.restart();
        });
      } else if (rerollsLeft > 0) {
        this.dailyButton(buttonX, buttonY, 'Reroll', false, () => {
          const result = rerollDailyQuest(save, i, todayString());
          if (!result.ok) return;
          Services.save.flush();
          this.scene.restart();
        });
      } else {
        this.add
          .text(buttonX, buttonY, 'No rerolls', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#7b708f',
          })
          .setOrigin(0.5);
      }
    });
  }

  private dailyButton(x: number, y: number, label: string, primary: boolean, cb: () => void): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: primary ? '#241500' : '#f0e6ff',
        backgroundColor: primary ? '#ffd88a' : '#2c2344',
        padding: { x: 12, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setFixedSize(112, 34)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) btn.setColor(primary ? '#000000' : '#ffd700');
    });
    btn.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) btn.setColor(primary ? '#241500' : '#f0e6ff');
    });
    bindTapButton(this, btn, cb);
    inflateHitArea(btn, 90, 60);
    this.menuItems.push(btn);
    return btn;
  }

  /**
   * First-run opt-in tutorial prompt (shown once, gated on !tutorialDone). Both
   * choices grant the same onboarding bonus and mark the tutorial seen, so a
   * skipper is never punished; the free starter deck is then claimed in the Shop.
   * Replayable anytime via "How to Play". (The old deck-selection popup is gone —
   * players claim their free starter in the Shop's Decks tab.)
   */
  private promptTutorial(): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x0a0812, 0.92).setInteractive());
    c.add(
      this.add
        .text(width / 2, 250, 'New to card games?', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '40px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          width / 2,
          314,
          'A quick match teaches the basics — mana, creatures, and combat.\n' +
            'You get the same starting bonus either way, so skipping costs you nothing.\n' +
            'You can replay it anytime from "How to Play".',
          {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '17px',
            color: '#a89cc6',
            align: 'center',
            lineSpacing: 6,
          },
        )
        .setOrigin(0.5),
    );
    const mk = (x: number, label: string, primary: boolean, cb: () => void): void => {
      const btn = this.add
        .text(x, 420, label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '24px',
          color: primary ? '#ffd88a' : '#c9bde0',
          backgroundColor: primary ? '#2c2344' : '#241d3a',
          padding: { x: 20, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, cb);
      inflateHitArea(btn, 90, 90);
      c.add(btn);
    };
    mk(width / 2 - 130, 'Start Tutorial', true, () => this.startTutorial());
    mk(width / 2 + 130, 'Skip', false, () => this.skipTutorial());
  }

  /** Launch the scripted tutorial duel. */
  private startTutorial(): void {
    this.scene.start('Duel', tutorialLaunchData(new ScriptAI(CARD_DB)));
  }

  /**
   * Skip: grant the same onboarding bonus + mark it seen, then head to the Shop's
   * Decks tab to claim the free starter deck (parity with completing the tutorial).
   */
  private skipTutorial(): void {
    const save = Services.save.data;
    if (!save.tutorialDone) {
      save.tutorialDone = true;
      save.gold += ECONOMY.startingGold;
    }
    Services.save.flush();
    this.scene.start('Shop', { tab: 'decks' });
  }
}
