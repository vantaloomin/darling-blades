import Phaser from 'phaser';
import { currentAccessibility } from '../ui/accessibility';
import { IS_DEV } from '../platform/env';
import { bindMenuScroll } from '../ui/menuScroll';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ScriptAI } from '../ai/ScriptAI';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { tutorialLaunchData } from '../data/tutorial';
import { evaluateAchievements, syncAchievements } from '../meta/Achievements';
import { todayString } from '../meta/Economy';
import {
  deckRepairNoticeFingerprint,
  deckRepairNoticeState,
  flaggedDecks,
  type FlaggedDeckSummary,
} from '../meta/deckRepair';
import {
  DAILY_QUESTS,
  claimDailyQuest,
  dailyQuestStatuses,
  dailyRerollsRemaining,
  dailyStreakStatus,
  ensureDailyState,
  rerollDailyQuest,
} from '../meta/Quests';
import { Services } from '../meta/services';
import { normalizeStatsNoticeVersion, STATS_NOTICE_VERSION } from '../meta/statsNotice';
import { signals } from '../net/signals';
import { readSignalsGateInput, signalsAllowed } from '../net/signalsGate';
import { controlFontSize } from '../ui/controlStyle';
import { measureThemedButton } from '../ui/layout';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createStatsNoticeDialog } from '../ui/StatsNoticeDialog';
import { mainMenuButtonY, mainMenuCornerY, mainMenuCornerLayout, mainMenuDailyLayout, menuNoticeLayout, MAIN_MENU_DAILY, MAIN_MENU_CORNER, MAIN_MENU_ITEMS, MAIN_MENU_X } from '../ui/mainMenuPresentation';
import {
  createStatsNoticeController,
  menuArrivalSteps,
  statsNoticeNoteText,
  statsNoticeOwed,
  statsRowNoteKind,
  statsRowNoteState,
  type MenuArrivalStep,
} from '../ui/statsPrivacyPresentation';
import { colorInt, theme } from '../ui/theme';
import { Toast } from '../ui/Toast';
import { goldBadge, modalShell, panel, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { VERSION_LABEL } from '../version';

// Game modes live one level down. "Decks" remains the saved-deck picker and builder.
const MENU_ITEMS = MAIN_MENU_ITEMS;

export class MainMenuScene extends Phaser.Scene {
  private fixture = false;
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();
  private toasts!: Toast;

  constructor() {
    super('MainMenu');
  }

  create(data: { a11yFixture?: boolean; tutorial?: boolean; repair?: FlaggedDeckSummary[] } = {}): void {
    const fixture = IS_DEV && data.a11yFixture === true;
    this.fixture = fixture;
    this.sys.settings.data = {};
    this.menuItems = [];
    this.guard = new ModalGuard();
    this.toasts = new Toast(this, { modalGuard: this.guard });
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
      dimAlpha: currentAccessibility().highContrast ? theme.alpha.overlayDim : 0.5,
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
    // Recovery sync, kept alongside the A1 mutation checkpoints: imported
    // save codes, migrations, and dev grants mutate the save outside any
    // checkpoint, and claiming validates against the persisted unlocked
    // list. No toast here — recovered unlocks are old news, not fresh events.
    if (!fixture && syncAchievements(save, CARD_DB).length > 0) Services.save.flush();
    const today = todayString();
    if (!fixture && ensureDailyState(save, today)) Services.save.flush();
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

    goldBadge(this, MAIN_MENU_CORNER.badgeX, mainMenuCornerY(0), { getValue: () => Services.save.data.gold });

    // Settings entry: a gear under the gold counter (the 8-row menu list is
    // full). The gold text above is non-interactive, so the 90px inflated hit
    // rect has no interactive neighbor to collide with. It joins menuItems so
    // the starter-picker ModalGuard disables it too. (The old VolumeControl
    // widget is gone — SettingsScene owns all audio controls now.)
    const gear = themedButton(this, MAIN_MENU_CORNER.rightX, mainMenuCornerY(1), '⚙ Settings', {
      variant: 'ghost', size: 'sm', minWidth: MAIN_MENU_CORNER.rightMinWidth, onTap: () => this.scene.start('Settings'),
    });
    this.menuItems.push(gear.inputZone);

    const cornerLabels = ['👤 Profile', '❔ How to Play', '📖 Glossary'];
    const leftWidth = Math.max(...cornerLabels.map((label) => {
      const text = this.add.text(0, 0, label, { fontFamily: theme.fonts.ui,
        fontSize: `${controlFontSize('sm')}px`, fontStyle: theme.weight.w600 });
      const width = measureThemedButton(text.width, 'sm', MAIN_MENU_CORNER.minWidth).hit.width;
      text.destroy();
      return width;
    }));

    // Profile entry: top-left corner, balancing the top-right gold+gear cluster.
    // Like the gear, it lives in the corner because the 8-row menu list is full;
    // joins menuItems so the starter-picker ModalGuard disables it too.
    // The three learning-corner buttons share a centre and a width so the
    // cluster reads as one column; Profile was 120 wide at x 90 against the
    // other two at 150 wide and x 100, so it sat narrower and 5px left.
    const profile = themedButton(this, MAIN_MENU_CORNER.leftX, mainMenuCornerY(0), cornerLabels[0], {
      variant: 'ghost', size: 'sm', minWidth: leftWidth, onTap: () => this.scene.start('Profile'),
    });
    this.menuItems.push(profile.inputZone);

    // "How to Play" — replay the optional tutorial anytime (top-left, under
    // Profile, mirroring ⚙ Settings on the right). Makes skipping reversible
    // (docs/plan-road-to-1.0.md Feature 1). Joins menuItems so the starter
    // picker's ModalGuard deadens it too.
    const howto = themedButton(this, MAIN_MENU_CORNER.leftX, mainMenuCornerY(1), cornerLabels[1], {
      variant: 'ghost', size: 'sm', minWidth: leftWidth, onTap: () => this.startTutorial(),
    });
    this.menuItems.push(howto.inputZone);

    // Reference glossary, kept beside the tutorial so players can learn away
    // from a live duel. It joins the guard-managed menu targets like every
    // other learning-corner control.
    const glossary = themedButton(this, MAIN_MENU_CORNER.leftX, mainMenuCornerY(2), cornerLabels[2], {
      variant: 'ghost', size: 'sm', minWidth: leftWidth, onTap: () => this.scene.start('Glossary'),
    });
    this.menuItems.push(glossary.inputZone);

    const corners = mainMenuCornerLayout([profile, howto, glossary].map((b) => b.getMeasuredSize().hit.width), gear.getMeasuredSize().hit.width);
    // Anchor the common measured width to the safe edge.
    for (const button of [profile, howto, glossary]) button.container.setX(corners.leftX);
    gear.container.setX(corners.rightX);
    this.drawDailyPanel(today, fixture);

    MENU_ITEMS.forEach((entry, i) => {
      const itemY = mainMenuButtonY(i);
      const item = themedButton(this, MAIN_MENU_X, itemY, entry.label, {
        variant: 'ghost',
        size: 'sm',
        minWidth: 300,
        onTap: () => this.scene.start(entry.scene, entry.data),
      });
      // Unlocked-but-unclaimed achievements get a small gold claim-count badge
      // at the row's right edge (replaces the old "(N)" label suffix). The
      // count recomputes on scene create, which re-runs after every duel/shop
      // visit. Pulse only at animations 'full'; reduced/off show it static.
      if (entry.scene === 'Achievements' && claimableAchievements > 0) {
        this.addClaimBadge(MAIN_MENU_X + 172, itemY, claimableAchievements);
      }

      // Hit boxes fill the full 56px row pitch (the audited 15px dead gaps
      // between rows are the fix column's target — plan §1.4).
      this.menuItems.push(item.inputZone);
    });

    // Build identity, bottom-left corner (non-interactive, low-contrast). The
    // Settings screen hosts the on-demand "Check for updates" action.
    this.add.text(14, theme.design.height - theme.space(1), VERSION_LABEL, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      color: theme.colors.muted,
    }).setOrigin(0, 1).setData('a11yExpendable', true);

    if (fixture) {
      if (data.tutorial) this.promptTutorial();
      else if (data.repair?.length) this.showDeckRepairNotice(data.repair);
    } else this.runArrival();
  }

  /**
   * Everything the menu shows on arrival, in the order `menuArrivalSteps`
   * gives: the first-run stats notice first whenever it is owed, then the
   * deck-repair notice, else the tutorial prompt (owner ruling 2026-09-19).
   *
   * The deck-repair decision is taken here, before anything opens, because it
   * also syncs `deckRepairNoticeAck` and that sync has always run on every
   * arrival. Only the modal itself is deferred to its turn in the chain.
   */
  private runArrival(): void {
    const flagged = this.syncDeckRepairAck();
    const steps = menuArrivalSteps({
      noticeOwed: statsNoticeOwed({
        // Normalised the same way the gate reads it: garbage means not yet told.
        savedVersion: normalizeStatsNoticeVersion(Services.save.data.settings.statsNoticeVersion),
        currentVersion: STATS_NOTICE_VERSION,
      }),
      deckRepairOwed: flagged !== null,
      tutorialDone: Services.save.data.tutorialDone === true,
    });
    this.runArrivalStep(steps, 0, flagged);
  }

  /**
   * Run one step and hand the rest on. Only the stats notice continues the
   * chain (from its own close callback); the deck-repair modal and the tutorial
   * prompt are terminal, exactly as they were before.
   */
  private runArrivalStep(
    steps: readonly MenuArrivalStep[],
    index: number,
    flagged: readonly FlaggedDeckSummary[] | null,
  ): void {
    const step = steps[index];
    if (step === undefined) return;
    if (step === 'statsNotice') {
      this.showStatsNotice(() => this.runArrivalStep(steps, index + 1, flagged));
      return;
    }
    if (step === 'deckRepair') {
      if (flagged) this.showDeckRepairNotice(flagged);
      return;
    }
    this.promptTutorial();
  }

  /**
   * The first-run anonymous-stats notice (privacy policy section 8: a player is
   * told before anything new is sent). It blocks the menu and comes before the
   * tutorial prompt, so a new player is told first and can switch sharing off
   * in the same breath.
   *
   * Nothing is stamped while it is open: the gate re-reads the save at every
   * send and refuses while the saved notice version is below the current one,
   * so a player who leaves the scene with the dialog up is still owed it and
   * has still sent nothing. The dialog's `Continue` is the only thing that
   * stamps, and it stamps whether sharing was left on or turned off, because
   * being told is not the same as opting in.
   *
   * `src/ui` may not import `src/net`, so the gate is evaluated here and the
   * state-aware line is handed in as a finished string.
   */
  private showStatsNotice(onContinue: () => void): void {
    const controller = createStatsNoticeController(
      {
        settings: Services.save.data.settings,
        setNoticeVersion: (version) => {
          Services.save.data.settings.statsNoticeVersion = version;
        },
        touch: () => Services.save.touch(),
        acknowledge: () => signals.noticeAcknowledged(),
      },
      STATS_NOTICE_VERSION,
    );
    createStatsNoticeDialog(this, {
      guard: this.guard,
      guardTargets: this.menuItems,
      controller,
      // The gate decides, not this scene: `signalsAllowed` is handed in whole.
      note: statsNoticeNoteText(
        statsRowNoteKind(statsRowNoteState(readSignalsGateInput(null), signalsAllowed)),
      ),
      onContinue,
    });
  }

  /**
   * Keep `deckRepairNoticeAck` in step with the current flag set and report the
   * decks that still need the notice, or null when none do. Unchanged from what
   * `showDeckRepairNotice` used to do inline; split out only so the arrival
   * chain can know its answer before the stats notice opens.
   */
  private syncDeckRepairAck(): readonly FlaggedDeckSummary[] | null {
    const save = Services.save.data;
    const flagged = flaggedDecks(CARD_DB, save);
    const noticeState = deckRepairNoticeState(flagged, save.deckRepairNoticeAck);
    if (save.deckRepairNoticeAck !== noticeState.acknowledgedFingerprint) {
      save.deckRepairNoticeAck = noticeState.acknowledgedFingerprint;
      Services.save.flush();
    }
    return noticeState.needsNotice ? flagged : null;
  }

  private showDeckRepairNotice(flagged: readonly FlaggedDeckSummary[]): void {
    const save = Services.save.data;
    let repairDeckId: string | null = null;
    const single = flagged.length === 1;
    const title = this.add.text(0, 0, single ? 'Your deck needs fixes' : 'Your decks need fixes', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    });
    const message = this.add.text(0, 0,
      (single
        ? 'The rules changed with this update. One of your decks no longer fits the current format. '
        : `The rules changed with this update. ${flagged.length} of your decks no longer fit the current format. `) +
        'Nothing was deleted; every card is still in your collection. Open the Deck Builder to bring them up to date.', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body,
        wordWrap: { width: 696 }, lineSpacing: theme.space(1),
      });
    const layout = menuNoticeLayout(760, title.height, message.height);
    const shell = modalShell(this, {
      width: layout.width, height: layout.height, titleTrackHeight: layout.titleTrackHeight,
      dismissal: 'mandatory',
      onClose: () => {
        this.guard.close();
        if (repairDeckId) this.scene.start('DeckBuilder', { deckId: repairDeckId });
      },
    });
    const acknowledge = (): void => {
      if (this.fixture) return;
      save.deckRepairNoticeAck = deckRepairNoticeFingerprint(flagged);
      Services.save.flush();
    };
    this.guard.open(this.menuItems);
    const content = shell.container;
    title.setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y);
    message.setPosition(shell.tracks.contentBounds.x, shell.tracks.contentBounds.y);
    content.add([title, message]);
    const footerY = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2;
    const fix = themedButton(this, 520, footerY, 'Fix Now', {
      variant: 'primary',
      minWidth: 160,
      onTap: () => {
        acknowledge();
        repairDeckId = flagged[0]?.deckId ?? null;
        shell.close();
      },
    });
    const later = themedButton(this, 760, footerY, 'Later', {
      variant: 'ghost',
      minWidth: 160,
      onTap: () => {
        acknowledge();
        shell.close();
      },
    });
    // Corner dismiss: an explicit tap, so it acknowledges exactly like Later.
    // Pinned to the shell's top-right corner (shell is centered at 640x360).
    const corner = themedButton(this, shell.tracks.closeTrack.x + shell.tracks.closeTrack.width / 2, shell.tracks.closeTrack.y + shell.tracks.closeTrack.height / 2, '×', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 30,
      onTap: () => {
        acknowledge();
        shell.close();
      },
    });
    content.add([fix.container, later.container, corner.container]);
  }

  /**
   * Small gold circle badge with the unlocked-but-unclaimed achievement count.
   * Non-interactive (the row button is the tap target). At animations 'full'
   * it breathes with a soft, slow scale/alpha pulse — subtle over flashy;
   * 'reduced'/'off' render it static, no tween at all.
   */
  private addClaimBadge(x: number, y: number, count: number): void {
    const badge = this.add.container(x, y);
    const r = 13;
    const bg = this.add
      .graphics()
      .fillStyle(colorInt(theme.colors.gold), 1)
      .fillCircle(0, 0, r)
      .lineStyle(theme.control.borderWidth, colorInt(theme.colors.goldHover), 1)
      .strokeCircle(0, 0, r);
    const label = this.add
      .text(0, 0, `${count}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.onGold,
      })
      .setOrigin(0.5);
    badge.add([bg, label]);
    if (Services.save.data.settings.animations === 'full') {
      this.tweens.add({
        targets: badge,
        scale: { from: 1, to: 1.12 },
        alpha: { from: 1, to: 0.8 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawDailyPanel(today: string, fixture = false): void {
    const save = Services.save.data;
    const quests = fixture ? DAILY_QUESTS.slice().sort((a, b) => b.description.length - a.description.length).slice(0, 3).map((q, i) => ({
      ...q, progress: i === 1 ? q.target : 0, claimed: i === 2, complete: i !== 0,
    })) : dailyQuestStatuses(save, today);
    const rerollsLeft = dailyRerollsRemaining(save, today);
    const streak = dailyStreakStatus(save, today);
    const { x, width: w } = MAIN_MENU_DAILY;
    const title = this.add.text(x + 16, 0, 'Daily Blades', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    });
    const rerolls = this.add.text(x + w - 16, 0, `Rerolls ${rerollsLeft}/${ECONOMY.dailyRerollsPerDay}`, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.muted,
    }).setOrigin(1, 0);
    const streakText = this.add.text(x + 16, 0, streak.wonToday
      ? `Streak ${streak.count} · win locked in` : `Streak ${streak.count} · next win +${streak.nextGold}`, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: streak.wonToday ? theme.colors.success : theme.colors.gold,
    });
    const content = this.add.container(0, 0);
    const rows = quests.map((quest, i) => {
      const row = this.add.container(0, 0);
      const action = quest.claimed || (!quest.complete && rerollsLeft === 0)
        ? this.add.text(0, 0, quest.claimed ? 'Claimed' : 'No rerolls', {
          fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: quest.claimed ? theme.colors.success : theme.colors.muted,
        }).setOrigin(0.5)
        : this.dailyButton(0, 0, quest.complete ? `Claim +${quest.rewardGold}` : 'Reroll', quest.complete, () => {
          if (fixture) return;
          const result = quest.complete ? claimDailyQuest(save, i, todayString()) : rerollDailyQuest(save, i, todayString());
          if (!result.ok) return;
          Services.save.flush();
          if (quest.complete) Sfx.play('coin');
          this.scene.restart();
        });
      const button = 'container' in action ? action : null;
      const actionNode = button ? button.container : action as Phaser.GameObjects.Text;
      const actionWidth = button ? button.getMeasuredSize().hit.width : (action as Phaser.GameObjects.Text).width;
      const textX = x + 24;
      const textWidth = w - 64 - actionWidth;
      const name = this.add.text(textX, 0, quest.title, {
        fontFamily: theme.fonts.display, fontSize: `${theme.type.label}px`, color: quest.claimed ? theme.colors.muted : theme.colors.heading,
        wordWrap: { width: textWidth },
      });
      const description = this.add.text(textX, 0, quest.description, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted,
        wordWrap: { width: textWidth },
      });
      const progressText = this.add.text(textX + textWidth, 0, `${Math.min(quest.progress, quest.target)}/${quest.target}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body,
      }).setOrigin(1, 0);
      row.add([name, description, progressText, actionNode]);
      content.add(row);
      return { row, quest, name, description, progressText, actionNode, actionWidth, textWidth, button };
    });
    const layout = mainMenuDailyLayout(Math.max(title.height, rerolls.height), streakText.height, rows.map((r) => ({
      title: r.name.height, description: r.description.height, progress: r.progressText.height,
      action: r.button ? r.button.getMeasuredSize().hit.height : (r.actionNode as Phaser.GameObjects.Text).height,
    })));
    const bg = panel(this, layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    this.children.moveBelow(bg, title);
    title.setY(layout.headingY); rerolls.setY(layout.headingY); streakText.setY(layout.streakY);
    rows.forEach((r, i) => {
      const at = layout.rows[i];
      r.name.setY(at.titleY); r.description.setY(at.descriptionY); r.progressText.setY(at.progressY);
      r.actionNode.setPosition(x + w - 24 - r.actionWidth / 2, at.y + at.height / 2);
      const rowBg = panel(this, layout.viewport.x, at.y, layout.viewport.width, at.height, { radius: theme.radius.control });
      r.row.addAt(rowBg, 0);
      const barW = r.textWidth - r.progressText.width - theme.space(3);
      const barY = at.progressY + r.progressText.height / 2 - 4;
      const progress = this.add.graphics().fillStyle(theme.graphics.panelStroke, 1);
      progress.fillRoundedRect(x + 24, barY, barW, 8, 4);
      const fillW = Math.round(barW * Math.min(r.quest.progress, r.quest.target) / r.quest.target);
      if (fillW > 0) progress.fillStyle(r.quest.complete ? colorInt(theme.colors.success) : colorInt(theme.colors.gold), 1).fillRoundedRect(x + 24, barY, fillW, 8, 4);
      r.row.add(progress);
    });
    bindMenuScroll(this, content, layout.viewport, layout.contentHeight, () => this.guard.isOpen,
      rows.flatMap((r) => r.button ? [r.button] : []));
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
    const title = this.add.text(0, 0, 'New to card games?', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.display}px`, color: theme.colors.heading,
    });
    const message = this.add.text(0, 0,
      'A quick match teaches the basics: mana, creatures, and combat.\n' +
      'You get the same starting bonus either way, so skipping costs you nothing.\n' +
      'You can replay it anytime from "How to Play".', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted,
        wordWrap: { width: 792 }, lineSpacing: theme.space(1),
      });
    const layout = menuNoticeLayout(840, title.height, message.height);
    const shell = modalShell(this, { width: layout.width, height: layout.height,
      titleTrackHeight: layout.titleTrackHeight, dismissal: 'mandatory', onClose: () => this.guard.close() });
    this.guard.open(this.menuItems);
    title.setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y);
    message.setPosition(shell.tracks.contentBounds.x, shell.tracks.contentBounds.y);
    shell.container.add([title, message]);
    const y = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2;
    const start = themedButton(this, 510, y, 'Start Tutorial', { variant: 'primary', minWidth: 180, onTap: () => this.startTutorial() });
    const skip = themedButton(this, 770, y, 'Skip', { variant: 'ghost', minWidth: 180, onTap: () => this.skipTutorial() });
    shell.container.add([start.container, skip.container]);
  }

  /** Launch the scripted tutorial duel. */
  private startTutorial(): void {
    if (this.fixture) return;
    this.scene.start('Duel', tutorialLaunchData(new ScriptAI(CARD_DB)));
  }

  /**
   * Skip: grant the same onboarding bonus + mark it seen, then head to the Shop's
   * Decks tab to claim the free starter deck (parity with completing the tutorial).
   */
  private skipTutorial(): void {
    if (this.fixture) return;
    const save = Services.save.data;
    if (!save.tutorialDone) {
      save.tutorialDone = true;
      save.gold += ECONOMY.startingGold;
    }
    Services.save.flush();
    this.scene.start('Shop', { tab: 'decks' });
  }
}
