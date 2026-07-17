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
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { goldBadge, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { VERSION_LABEL } from '../version';

const MENU_ITEMS: { label: string; scene?: string; data?: object }[] = [
  // Game modes live one level down (PlayScene): Gauntlet, Draft, Practice ×3.
  { label: 'Play', scene: 'Play' },
  { label: 'Shop', scene: 'Shop' },
  { label: 'Collection', scene: 'Collection' },
  { label: 'Achievements', scene: 'Achievements' },
  { label: 'Deck Builder', scene: 'DeckBuilder' },
  { label: 'Card Showcase', scene: 'Showcase' },
];

export class MainMenuScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.GameObject[] = [];
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
    // real art → the scene keeps its bare clear colour (the canvas
    // backgroundColor); today's look is unchanged.
    applyBackdrop(this, 'mainmenu', {
      dim: theme.graphics.dim,
      // 0.50, raised from the 0.35 starting point (2026-07-03): the generated
      // vista's horizon glow reaches the bottom menu items; 0.35 left the
      // central column at ~35% luminance vs the ≤28% cap (scene-art.md §2).
      dimAlpha: 0.5,
      fallback: () => {
        /* scene had no background of its own — the clear colour shows */
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
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.displayXL}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    goldBadge(this, width - 30, 30, { getValue: () => Services.save.data.gold });

    // Settings entry: a gear under the gold counter (the 8-row menu list is
    // full). The gold text above is non-interactive, so the 90px inflated hit
    // rect has no interactive neighbor to collide with. It joins menuItems so
    // the starter-picker ModalGuard disables it too. (The old VolumeControl
    // widget is gone — SettingsScene owns all audio controls now.)
    const gear = themedButton(this, width - 90, 82, '⚙ Settings', {
      variant: 'ghost', size: 'sm', minWidth: 130, onTap: () => this.scene.start('Settings'),
    });
    this.menuItems.push(gear.inputZone);

    // Profile entry: top-left corner, balancing the top-right gold+gear cluster.
    // Like the gear, it lives in the corner because the 8-row menu list is full;
    // joins menuItems so the starter-picker ModalGuard disables it too.
    const profile = themedButton(this, 90, 30, '👤 Profile', {
      variant: 'ghost', size: 'sm', minWidth: 120, onTap: () => this.scene.start('Profile'),
    });
    this.menuItems.push(profile.inputZone);

    // "How to Play" — replay the optional tutorial anytime (top-left, under
    // Profile, mirroring ⚙ Settings on the right). Makes skipping reversible
    // (docs/plan-road-to-1.0.md Feature 1). Joins menuItems so the starter
    // picker's ModalGuard deadens it too.
    const howto = themedButton(this, 100, 82, '❔ How to Play', {
      variant: 'ghost', size: 'sm', minWidth: 150, onTap: () => this.startTutorial(),
    });
    this.menuItems.push(howto.inputZone);

    // Reference glossary, kept beside the tutorial so players can learn away
    // from a live duel. It joins the guard-managed menu targets like every
    // other learning-corner control.
    const glossary = themedButton(this, 100, 124, '📖 Glossary', {
      variant: 'ghost', size: 'sm', minWidth: 150, onTap: () => this.scene.start('Glossary'),
    });
    this.menuItems.push(glossary.inputZone);

    this.drawDailyPanel(today);

    // Card Showcase is a variant-QA surface — dev/local builds only (IS_DEV);
    // filtering (not hiding) keeps the row layout gap-free on the public build.
    const items = MENU_ITEMS.filter((entry) => entry.scene !== 'Showcase' || IS_DEV);
    const menuX = 360;
    const firstY = items.length > 8 ? 268 : 286;
    const pitchY = items.length > 8 ? 42 : 50;
    items.forEach((entry, i) => {
      const label =
        entry.scene === 'Achievements' && claimableAchievements > 0
          ? `${entry.label} (${claimableAchievements})`
          : entry.label;
      const item = themedButton(this, menuX, firstY + i * pitchY, label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => entry.scene && this.scene.start(entry.scene, entry.data),
      });

      
      // Hit boxes fill the full 56px row pitch (the audited 15px dead gaps
      // between rows are the fix column's target — plan §1.4).
      this.menuItems.push(item.inputZone);
    });

    // Build identity, bottom-left corner (non-interactive, low-contrast). The
    // Settings screen hosts the on-demand "Check for updates" action.
    this.add.text(14, 702, VERSION_LABEL, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      color: theme.colors.muted,
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
    panel(this, x, y, w, h, { alpha: 0.86 });

    this.add.text(x + 24, y + 22, 'Daily Blades', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    });
    this.add
      .text(x + w - 24, y + 25, `Rerolls ${rerollsLeft}/${ECONOMY.dailyRerollsPerDay}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(1, 0);

    const streakText = streak.wonToday
      ? `Streak ${streak.count} - win locked in`
      : `Streak ${streak.count} - next win +${streak.nextGold}`;
    this.add.text(x + 24, y + 55, streakText, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      color: streak.wonToday ? theme.colors.success : theme.colors.gold,
    });

    quests.forEach((quest, i) => {
      const rowY = y + 86 + i * 92;
      const rowH = 78;
      panel(this, x + 18, rowY, w - 36, rowH, { alpha: 0.78, radius: theme.radius.control });

      this.add.text(x + 34, rowY + 10, quest.title, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: quest.claimed ? theme.colors.muted : theme.colors.heading,
      });
      this.add.text(x + 34, rowY + 35, quest.description, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      });

      const barX = x + 34;
      const barY = rowY + 61;
      const barW = 278;
      const fillW = Math.round((barW * Math.min(quest.progress, quest.target)) / quest.target);
      const progress = this.add.graphics().fillStyle(colorInt(theme.colors.panelStroke), 1);
      progress.fillRoundedRect(barX, barY, barW, 8, 4);
      if (fillW > 0) {
        progress.fillStyle(colorInt(quest.complete ? theme.colors.success : theme.colors.gold), 1);
        progress.fillRoundedRect(barX, barY, fillW, 8, 4);
      }
      this.add
        .text(barX + barW + 12, barY - 5, `${Math.min(quest.progress, quest.target)}/${quest.target}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0);

      const buttonX = x + w - 84;
      const buttonY = rowY + 40;
      if (quest.claimed) {
        this.add
          .text(buttonX, buttonY, 'Claimed', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.success,
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
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0.5);
      }
    });
  }

  private dailyButton(x: number, y: number, label: string, primary: boolean, cb: () => void): ThemedButton {
    const btn = themedButton(this, x, y, label, {
      variant: primary ? 'primary' : 'ghost',
      size: 'sm',
      minWidth: 112,
      onTap: cb,
    });
    this.menuItems.push(btn.inputZone);
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
    c.add(this.add.rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim).setInteractive());
    c.add(
      this.add
        .text(width / 2, 250, 'New to card games?', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          width / 2,
          314,
          'A quick match teaches the basics: mana, creatures, and combat.\n' +
            'You get the same starting bonus either way, so skipping costs you nothing.\n' +
            'You can replay it anytime from "How to Play".',
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            align: 'center',
            lineSpacing: 6,
          },
        )
        .setOrigin(0.5),
    );
    const mk = (x: number, label: string, primary: boolean, cb: () => void): void => {
      const btn = themedButton(this, x, 420, label, {
        variant: primary ? 'primary' : 'ghost',
        minWidth: 180,
        onTap: cb,
      });
      c.add(btn.container);
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
