import Phaser from 'phaser';
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
import { bindTapButton } from '../platform/gestures';
import { fullScreenOffered, isFullScreen, onFullScreenChange, toggleFullScreen } from '../platform/fullscreen';
import { markSaveOverNoticeShown, readSaveOverNoticeOwed } from '../platform/homeScreen';
import { normalizeStatsNoticeVersion, STATS_NOTICE_VERSION } from '../meta/statsNotice';
import { signals } from '../net/signals';
import { readSignalsGateInput, signalsAllowed } from '../net/signalsGate';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { createStatsNoticeDialog } from '../ui/StatsNoticeDialog';
import { mainMenuDailyLayout, mainMenuHeaderRow, MAIN_MENU_HEADER_GAP, mainMenuNavRows, menuNoticeLayout, MAIN_MENU_DAILY, MAIN_MENU_ITEMS, MAIN_MENU_VERSION } from '../ui/mainMenuPresentation';
import { menuNavButton } from '../ui/MenuNavButton';
import { compactButton, compactDialog, compactGoldPill, compactIconButton, compactScrim, coverFitImage, type CompactButton, type CompactDialogAction } from '../ui/compactWidgets';
import { compactDailyPage, compactMainMenuLayout, MAIN_MENU_COMPACT, type CompactMainMenuLayout } from '../ui/mainMenuCompact';
import type { Rect } from '../ui/layout';
import { addPortraitArt } from '../ui/portraitArt';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import type { ThemedButtonVariant } from '../ui/controlStyle';
import type { UiIconName } from '../ui/uiIcons';
import { bakeUiIcon } from '../ui/uiIcons';
import { activeVisibleSavedDeck } from '../ui/deckBuilderHelpers';
import { FEATURES } from '../config/features';
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
/** The phone's command column, top to bottom above Play (mock M-MainMenu). */
const COMPACT_NAV: readonly { label: string; scene: string; icon: UiIconName }[] = [
  { label: 'Shop', scene: 'Shop', icon: 'shop' },
  { label: 'Collection', scene: 'Collection', icon: 'cards' },
  { label: 'Decks', scene: 'DeckBuilder', icon: 'deck' },
  { label: 'Achievements', scene: 'Achievements', icon: 'trophy' },
];
/** Every Daily row's action column: Reroll, Claim +N, Claimed, No rerolls. */
const DAILY_ACTION_WIDTH = 120;
const TUTORIAL_PROMPT_MESSAGE =
  'A quick match teaches the basics: mana, creatures, and combat.\n' +
  'You get the same starting bonus either way, so skipping costs you nothing.\n' +
  'You can replay it anytime from "How to Play".';
const SAVE_OVER_MESSAGE =
  'Your home-screen game starts fresh: it keeps its own save, apart from Safari\'s. ' +
  'To carry on where you were, open Darling Blades in Safari, go to Profile and Export save, then Import that code here.';
const deckRepairMessage = (count: number): string =>
  (count === 1
    ? 'The rules changed with this update. One of your decks no longer fits the current format. '
    : `The rules changed with this update. ${count} of your decks no longer fit the current format. `) +
  'Nothing was deleted; every card is still in your collection. Open the Deck Builder to bring them up to date.';
/** The Profile tile's art when the player has no deck to take a face from. */
const PROFILE_FALLBACK_ART = 'scene-card-back';
/** The phone's Daily Blades action buttons: the touch floor. */
const COMPACT_ACTION_H = 44;

export class MainMenuScene extends Phaser.Scene {
  private fixture = false;
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private guard = new ModalGuard();
  private toasts!: Toast;
  /** The compact composition's Daily Blades page (mock M-MainMenu130's fold). */
  private dailyPage = 0;

  constructor() {
    super('MainMenu');
  }

  create(data: {
    a11yFixture?: boolean; tutorial?: boolean; repair?: FlaggedDeckSummary[];
    /** Dev probe only (src/dev/wave3DialogFixtures.ts): open one shared dialog over the fixture menu. */
    a11yOpen?: (scene: Phaser.Scene) => void;
    /** The phone's Daily Blades page, kept across the panel's own restarts. */
    dailyPage?: number;
  } = {}): void {
    const fixture = IS_DEV && data.a11yFixture === true;
    this.dailyPage = data.dailyPage ?? 0;
    this.fixture = fixture;
    this.sys.settings.data = {};
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
    // On a phone the menu draws its own compact composition (mock M-MainMenu)
    // in the phone's design space; everywhere else the 1280×720 menu.
    const stage = sceneStage(this);
    const compact = stage.compact
      ? compactMainMenuLayout(stage.content, { fullScreen: fullScreenOffered(), navCount: COMPACT_NAV.length })
      : null;
    // Toasts stack at the top of the command column on a phone (mock M-Toasts).
    this.toasts = new Toast(this, {
      modalGuard: this.guard,
      ...(compact ? { rail: { right: compact.play.x + compact.play.width, top: compact.nav[0]?.y ?? compact.play.y, width: compact.play.width } } : {}),
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
    const achievements = evaluateAchievements(save, CARD_DB);
    const claimableAchievements = achievements.filter((status) => status.unlocked && !status.claimed).length;

    if (compact) {
      this.buildCompact(compact, today, fixture, claimableAchievements);
      this.finishCreate(data, fixture);
      return;
    }

    this.add
      .text(width / 2, 140, 'Darling Blades', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.displayXL}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);

    // One header row (the approved 2026-10-08 menu): the learning buttons run
    // from the frame's left edge, Settings sits left of the gold badge. Each
    // joins menuItems so the starter-picker ModalGuard disables it too.
    const badge = goldBadge(this, theme.design.safeRight, theme.design.headerCenterY, { getValue: () => Services.save.data.gold });
    const headerButton = (label: string, onTap: () => void): ThemedButton => {
      // At least the hit width, so plate and tap box share their edges.
      const button = themedButton(this, 0, theme.design.headerCenterY, label, {
        variant: 'ghost', size: 'sm', minWidth: theme.control.minHitWidth, onTap });
      this.menuItems.push(button.inputZone);
      return button;
    };
    const learning = [
      headerButton('{profile} Profile', () => this.scene.start('Profile')),
      // Replay the optional tutorial anytime; makes skipping reversible.
      headerButton('{help} How to Play', () => this.startTutorial()),
      headerButton('{book} Glossary', () => this.scene.start('Glossary')),
    ];
    const gear = headerButton('{gear} Settings', () => this.scene.start('Settings'));
    const header = mainMenuHeaderRow(learning.map((b) => b.getMeasuredSize().hit.width),
      gear.getMeasuredSize().hit.width, badge.width());
    learning.forEach((button, i) => button.container.setX(header.leftX[i]));
    gear.container.setX(header.rightX);
    // M8: a full-screen icon left of Settings, only where the browser allows
    // it on a touch device (never iPhone Safari, never desktop).
    if (fullScreenOffered()) {
      const screenIcon = () => (isFullScreen() ? '{shrink}' : '{expand}');
      // Icon-only: a square plate; the tap box keeps the 90px floor.
      const expand = themedButton(this, 0, theme.design.headerCenterY, screenIcon(), {
        variant: 'ghost', size: 'sm', onTap: () => { void toggleFullScreen(); } });
      this.menuItems.push(expand.inputZone);
      const expandHit = expand.getMeasuredSize().hit.width;
      expand.container.setX(header.rightX - gear.getMeasuredSize().hit.width / 2 - MAIN_MENU_HEADER_GAP - expandHit / 2);
      const unsubscribe = onFullScreenChange(() => expand.setLabel(screenIcon()));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    }
    this.drawDailyPanel(today, fixture);

    const unlocked = achievements.filter((status) => status.unlocked).length;
    const activeDeck = activeVisibleSavedDeck(save.decks, save.activeDeckId, FEATURES.reserveFormats);
    const navRows = mainMenuNavRows();
    MENU_ITEMS.forEach((entry, i) => {
      const isPlay = i === 0;
      const isAchievements = entry.scene === 'Achievements';
      const item = menuNavButton(this, navRows[i], {
        label: entry.label,
        primary: isPlay,
        ...(isPlay ? { sublabel: activeDeck ? activeDeck.name : 'Gauntlet, Draft or Practice' } : {}),
        ...(isAchievements ? { trailing: `${unlocked} / ${achievements.length}` } : {}),
        onTap: () => this.scene.start(entry.scene, entry.data),
      });
      // Unlocked-but-unclaimed achievements get a small gold claim-count badge
      // beside the row's count. Pulse only at animations 'full'.
      if (isAchievements && claimableAchievements > 0) {
        const row = navRows[i];
        this.addClaimBadge(row.x + item.trailingLeft - theme.space(3) - 13, row.y + row.height / 2, claimableAchievements);
      }
      this.menuItems.push(item.inputZone);
    });

    // Build identity, bottom-left inside the frame on a small dark plate so
    // it reads over the art (non-interactive). Settings hosts "Check for updates".
    const stamp = this.add.text(MAIN_MENU_VERSION.x + MAIN_MENU_VERSION.padX, MAIN_MENU_VERSION.y - MAIN_MENU_VERSION.padY, VERSION_LABEL, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      color: theme.colors.body,
    }).setOrigin(0, 1).setData('a11yExpendable', true);
    const stampPlate = panel(this, MAIN_MENU_VERSION.x, stamp.y - stamp.height - MAIN_MENU_VERSION.padY,
      stamp.width + 2 * MAIN_MENU_VERSION.padX, stamp.height + 2 * MAIN_MENU_VERSION.padY, { radius: theme.radius.control });
    this.children.moveBelow(stampPlate, stamp);

    this.finishCreate(data, fixture);
  }

  /** The arrival notices (or the probe fixture's own dialog), on either composition. */
  private finishCreate(
    data: { tutorial?: boolean; repair?: FlaggedDeckSummary[]; a11yOpen?: (scene: Phaser.Scene) => void },
    fixture: boolean,
  ): void {
    if (fixture) {
      if (data.tutorial) this.promptTutorial();
      else if (data.repair?.length) this.showDeckRepairNotice(data.repair);
      else data.a11yOpen?.(this);
    } else this.runArrival();
  }


  // ---------------------------------------------------------------- the phone

  /**
   * The compact composition (mock M-MainMenu, Largest text M-MainMenu130): the
   * title, gold and icons in the top bar; the Profile tile, How to play and
   * Glossary on the left; Daily Blades in the centre; the destinations and
   * Play in the command column. Same actions as the desktop menu.
   */
  private buildCompact(layout: CompactMainMenuLayout, today: string, fixture: boolean, claimable: number): void {
    const type = theme.compactType;

    // Top bar: the title, then the gold, the full-screen icon (M8) and Settings.
    const title = this.add.text(layout.title.x, layout.title.centerY, 'Darling Blades', {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    }).setOrigin(0, 0.5);
    if (title.width > layout.title.maxWidth) title.setScale(layout.title.maxWidth / title.width);
    this.compactGold(layout.gold.right, layout.gold.centerY, layout.gold.height);
    if (layout.fullScreen) {
      const expand = compactIconButton(this, layout.fullScreen, isFullScreen() ? 'shrink' : 'expand', () => { void toggleFullScreen(); });
      this.menuItems.push(expand.inputZone);
      const unsubscribe = onFullScreenChange(() => expand.setIcon(isFullScreen() ? 'shrink' : 'expand'));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    }
    this.menuItems.push(compactIconButton(this, layout.gear, 'gear', () => this.scene.start('Settings')).inputZone);

    // Left: identity.
    this.compactProfileTile(layout.profile);
    this.menuItems.push(
      compactButton(this, layout.howToPlay, 'How to play', { icon: 'info', onTap: () => this.startTutorial() }).inputZone,
      compactButton(this, layout.glossary, 'Glossary', { icon: 'book', onTap: () => this.scene.start('Glossary') }).inputZone,
    );
    this.add.text(layout.version.x, layout.version.bottom, VERSION_LABEL, {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted,
    }).setOrigin(0, 1).setData('a11yExpendable', true);

    // Centre: Daily Blades.
    this.compactDaily(layout.daily, today, fixture);

    // Right: the command column.
    COMPACT_NAV.forEach((entry, i) => {
      const rect = layout.nav[i];
      if (!rect) return;
      const row = compactButton(this, rect, entry.label, {
        icon: entry.icon, align: 'left', radius: theme.radius.panel, onTap: () => this.scene.start(entry.scene),
      });
      this.menuItems.push(row.inputZone);
      if (entry.scene === 'Achievements' && claimable > 0) {
        this.addClaimBadge(rect.x + rect.width - 16 - 13, rect.y + rect.height / 2, claimable);
      }
    });
    const play = compactButton(this, layout.play, 'Play', {
      variant: 'primary', icon: 'sword', fontSize: type.h2, onTap: () => this.scene.start('Play'),
    });
    this.menuItems.push(play.inputZone);
  }

  /** The gold, a pill in the top bar (not a control). */
  private compactGold(right: number, centerY: number, height: number): void {
    compactGoldPill(this, right, centerY, height, Services.save.data.gold);
  }

  /**
   * The Profile tile: the player's commander art (the face their duels use),
   * the record over it, and "Profile" with a chevron. One tap opens Profile.
   */
  private compactProfileTile(rect: Rect): void {
    const type = theme.compactType;
    const save = Services.save.data;
    this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    const cardId = this.profileFaceCardId();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    // Cover-fit, faces biased up (the Story picker's crop).
    const fit = (image: Phaser.GameObjects.Image): void => coverFitImage(image, rect, 0.12);
    let art: Phaser.GameObjects.Image | null = null;
    if (cardId) {
      try {
        art = addPortraitArt(this, cx, cy, cardId, fit);
      } catch {
        art = null;
      }
    }
    // No deck yet (a new save): the card back's art stands in.
    if (!art && this.textures.exists(PROFILE_FALLBACK_ART)) {
      art = this.add.image(cx, cy, PROFILE_FALLBACK_ART);
      fit(art);
    }
    // A scrim from the middle down, so the record and the label read over any art.
    compactScrim(this, rect);
    this.add.graphics()
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    const pad = 12;
    const games = save.stats.wins + save.stats.losses;
    const label = this.add.text(rect.x + pad, rect.y + rect.height - pad, 'Profile', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    }).setOrigin(0, 1);
    const chevronSize = Math.round(type.body * 1.15);
    this.add.image(rect.x + rect.width - pad - chevronSize / 2, label.y - label.height / 2, bakeUiIcon(this, 'chevron'))
      .setDisplaySize(chevronSize, chevronSize).setTint(colorInt(theme.colors.body));
    this.add.text(rect.x + pad, label.y - label.height - 4,
      games > 0 ? `${save.stats.wins} W / ${save.stats.losses} L` : 'No duels played yet', {
        fontFamily: games > 0 ? theme.fonts.display : theme.fonts.ui,
        fontSize: `${games > 0 ? type.h2 : type.label}px`,
        fontStyle: theme.weight.w700,
        color: games > 0 ? theme.colors.gold : theme.colors.muted,
        wordWrap: { width: rect.width - 2 * pad },
      }).setOrigin(0, 1);
    const zone = this.add.zone(cx, cy, rect.width, rect.height).setInteractive({ useHandCursor: true });
    bindTapButton(this, zone, () => this.scene.start('Profile'));
    this.menuItems.push(zone);
  }

  /** The card whose art the Profile tile shows: the player's duel face, as DuelScene picks it. */
  private profileFaceCardId(): string | null {
    const save = Services.save.data;
    const deck = activeVisibleSavedDeck(save.decks, save.activeDeckId, FEATURES.reserveFormats);
    const darling = deck?.format === 'darlings' ? darlingFaceCardFor(deck, CARD_DB) : null;
    const hero = deck?.heroCardId && CARD_DB[deck.heroCardId] && deck.cards.includes(deck.heroCardId) ? deck.heroCardId : null;
    const fallback = save.heroCardId && CARD_DB[save.heroCardId] ? save.heroCardId : null;
    return darling ?? hero ?? fallback ?? (deck ? faceCardFor(deck.cards, CARD_DB) : null);
  }

  /**
   * Daily Blades in the centre pane: the heading, the streak line and the
   * three quests. When they do not all fit (Largest text, a short phone) the
   * last slot becomes a fold row that pages through the rest (M-MainMenu130).
   */
  private compactDaily(rect: Rect, today: string, fixture: boolean): void {
    const type = theme.compactType;
    const save = Services.save.data;
    const L = MAIN_MENU_COMPACT;
    const quests = fixture ? DAILY_QUESTS.slice().sort((a, b) => b.description.length - a.description.length).slice(0, 3).map((q, i) => ({
      ...q, progress: i === 1 ? q.target : 0, claimed: i === 2, complete: i !== 0,
    })) : dailyQuestStatuses(save, today);
    const rerollsLeft = dailyRerollsRemaining(save, today);
    const streak = dailyStreakStatus(save, today);
    panel(this, rect.x, rect.y, rect.width, rect.height);
    const pad = L.dailyPad;
    const inner = { x: rect.x + pad, width: rect.width - 2 * pad };
    const heading = this.add.text(inner.x, rect.y + pad, 'Daily Blades', {
      fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const rerolls = this.add.text(inner.x + inner.width, heading.y + heading.height / 2, `Rerolls ${rerollsLeft}/${ECONOMY.dailyRerollsPerDay}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    }).setOrigin(1, 0.5);
    const streakText = this.add.text(inner.x, heading.y + heading.height + 2, streak.wonToday
      ? `Streak ${streak.count} · win locked in` : `Streak ${streak.count} · next win +${streak.nextGold}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600,
      color: streak.wonToday ? theme.colors.success : theme.colors.gold,
    });
    // Largest text on a narrow phone: the reroll count drops to the streak
    // line's right end, or under it, rather than shrinking the heading.
    let listTop = streakText.y + streakText.height + 8;
    if (heading.width + 8 + rerolls.width > inner.width) {
      if (streakText.width + 8 + rerolls.width <= inner.width) {
        rerolls.setY(streakText.y + streakText.height / 2);
      } else {
        rerolls.setOrigin(0, 0).setPosition(inner.x, streakText.y + streakText.height + 2);
        listTop = rerolls.y + rerolls.height + 8;
      }
    }
    const listH = rect.y + rect.height - pad + 2 - listTop;

    // One action column for every row, as wide as its widest label needs.
    const actionLabel = (q: (typeof quests)[number]): string | null =>
      q.claimed ? '✓ Claimed' : !q.complete && rerollsLeft === 0 ? 'No rerolls' : q.complete ? `Claim +${q.rewardGold}` : 'Reroll';
    const widest = Math.max(0, ...quests.map((q) => {
      const probe = this.add.text(0, 0, actionLabel(q) ?? '', { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600 });
      const w = probe.width;
      probe.destroy();
      return w;
    }));
    const actionW = Math.min(Math.round(inner.width * 0.45), Math.max(L.dailyActionW, Math.ceil(widest) + 24));
    // Build every row once (hidden), measure, then show the page that fits.
    const textW = inner.width - 2 * 10 - actionW - 6;
    const rows = quests.map((quest, i) => {
      const parts: Phaser.GameObjects.GameObject[] = [];
      const name = this.add.text(0, 0, quest.title, {
        fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
        color: quest.claimed ? theme.colors.muted : theme.colors.heading, wordWrap: { width: textW },
      });
      const description = this.add.text(0, 0, quest.description, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: textW },
      });
      const count = this.add.text(0, 0, `${Math.min(quest.progress, quest.target)}/${quest.target}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body,
      }).setOrigin(1, 0.5);
      parts.push(name, description, count);
      return { quest, index: i, name, description, count, parts, height: 0 };
    });
    // Two row shapes. Side by side (the mock): the text left, the button
    // right. Stacked, when the text would wrap deep beside the button
    // (Largest text on a narrow phone): the name and description run the full
    // width, and the progress bar shares the last line with the button.
    const sideHeight = (r: (typeof rows)[number]): number =>
      Math.max(60, r.name.height + 2 + r.description.height + 6 + Math.max(8, r.count.height) + 2 * 6);
    const fullW = inner.width - 2 * 10;
    const sideHeights = rows.map(sideHeight);
    for (const r of rows) { r.name.setWordWrapWidth(fullW); r.description.setWordWrapWidth(fullW); }
    const stackedHeights = rows.map((r) => r.name.height + 2 + r.description.height + 6 + COMPACT_ACTION_H + 2 * 6);
    // Whichever shape shows more quests before the fold wins (M-MainMenu130
    // keeps two side by side); on a tie, the shorter list.
    const shown = (heights: number[]): number => compactDailyPage(listH, heights, 0).quests.length;
    const sum = (heights: number[]): number => heights.reduce((a, b) => a + b, 0);
    const stacked = shown(stackedHeights) !== shown(sideHeights)
      ? shown(stackedHeights) > shown(sideHeights)
      : sum(stackedHeights) < sum(sideHeights);
    if (!stacked) for (const r of rows) { r.name.setWordWrapWidth(textW); r.description.setWordWrapWidth(textW); }
    rows.forEach((r, i) => { r.height = stacked ? stackedHeights[i] : sideHeights[i]; });
    const page = compactDailyPage(listH, rows.map((r) => r.height), this.dailyPage);
    let y = listTop;
    for (const qi of page.quests) {
      const r = rows[qi];
      const box = { x: inner.x, y, width: inner.width, height: r.height };
      panel(this, box.x, box.y, box.width, box.height, { radius: theme.radius.control });
      const textX = box.x + 10;
      const lastLine = stacked ? COMPACT_ACTION_H : Math.max(8, r.count.height);
      const block = r.name.height + 2 + r.description.height + 6 + lastLine;
      let ty = box.y + (box.height - block) / 2;
      r.name.setPosition(textX, ty); ty += r.name.height + 2;
      r.description.setPosition(textX, ty); ty += r.description.height + 6;
      const barCenter = ty + lastLine / 2;
      const barRight = stacked ? box.x + box.width - 10 - actionW - 10 : textX + textW;
      r.count.setPosition(barRight, barCenter);
      const barW = Math.max(24, barRight - textX - r.count.width - 8);
      const progress = this.add.graphics().fillStyle(theme.graphics.panelStroke, 1).fillRoundedRect(textX, barCenter - 4, barW, 8, 4);
      const fillW = Math.round(barW * Math.min(r.quest.progress, r.quest.target) / r.quest.target);
      if (fillW > 0) progress.fillStyle(r.quest.complete ? colorInt(theme.colors.success) : colorInt(theme.colors.gold), 1).fillRoundedRect(textX, barCenter - 4, fillW, 8, 4);
      for (const part of r.parts) this.children.bringToTop(part);
      const action = { x: box.x + box.width - 10 - actionW, y: stacked ? barCenter - COMPACT_ACTION_H / 2 : box.y + (box.height - COMPACT_ACTION_H) / 2, width: actionW, height: COMPACT_ACTION_H };
      const settled = r.quest.claimed || (!r.quest.complete && rerollsLeft === 0);
      if (settled) {
        const done = r.quest.claimed;
        this.add.text(action.x + action.width / 2, action.y + action.height / 2, done ? '✓ Claimed' : 'No rerolls', {
          fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600,
          color: done ? theme.colors.success : theme.colors.muted,
        }).setOrigin(0.5);
      } else {
        const claim = r.quest.complete;
        const button = compactButton(this, action, claim ? `Claim +${r.quest.rewardGold}` : 'Reroll', {
          variant: (claim ? 'emphasis' : 'ghost') as ThemedButtonVariant,
          onTap: () => {
            if (fixture) return;
            const result = claim ? claimDailyQuest(save, r.index, todayString()) : rerollDailyQuest(save, r.index, todayString());
            if (!result.ok) return;
            Services.save.flush();
            if (claim) Sfx.play('coin');
            this.scene.restart({ dailyPage: this.dailyPage });
          },
        });
        this.menuItems.push(button.inputZone);
      }
      y += r.height + L.dailyRowGap;
    }
    // Rows off this page were built only to measure the page.
    for (const r of rows) if (!page.quests.includes(r.index)) for (const part of r.parts) part.destroy();
    if (page.fold) {
      const fold = page.fold;
      const more: CompactButton = compactButton(this, { x: inner.x, y, width: inner.width, height: L.moreRowH }, fold.label, {
        onTap: () => {
          this.scene.restart({ dailyPage: fold.next });
        },
      });
      this.menuItems.push(more.inputZone);
    }
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
      saveOverOwed: readSaveOverNoticeOwed(Services.save.data.tutorialDone !== true
        && Services.save.data.stats.wins + Services.save.data.stats.losses === 0),
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
    if (step === 'saveOver') {
      this.showSaveOverNotice(() => this.runArrivalStep(steps, index + 1, flagged));
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


  /**
   * A menu notice on the phone (mocks M-NoticeRepair, M-TutorialPrompt): the
   * title, the message, and two buttons sharing the footer, the secondary on
   * the left and the primary on the right (M18). No corner close: both
   * buttons answer it. `onClose` runs once the shell is gone.
   */
  private compactNotice(
    titleText: string,
    messageText: string,
    secondary: CompactDialogAction,
    primary: CompactDialogAction,
    onClose: () => void,
  ): void {
    compactDialog(this, {
      title: titleText, message: messageText, secondary, primary,
      onClose: () => { this.guard.close(); onClose(); },
    });
    this.guard.open(this.menuItems);
  }

  private showDeckRepairNotice(flagged: readonly FlaggedDeckSummary[]): void {
    const save = Services.save.data;
    let repairDeckId: string | null = null;
    const single = flagged.length === 1;
    if (sceneStage(this).compact) {
      const acknowledge = (): void => {
        if (this.fixture) return;
        save.deckRepairNoticeAck = deckRepairNoticeFingerprint(flagged);
        Services.save.flush();
      };
      this.compactNotice(
        single ? 'Your deck needs fixes' : 'Your decks need fixes',
        deckRepairMessage(flagged.length),
        { label: 'Later', onTap: (close) => { acknowledge(); close(); } },
        { label: 'Fix now', onTap: (close) => { acknowledge(); repairDeckId = flagged[0]?.deckId ?? null; close(); } },
        () => { if (repairDeckId) this.scene.start('DeckBuilder', { deckId: repairDeckId }); },
      );
      return;
    }
    const title = this.add.text(0, 0, single ? 'Your deck needs fixes' : 'Your decks need fixes', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    });
    const message = this.add.text(0, 0, deckRepairMessage(flagged.length), {
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
      // One action column (the approved menu): Reroll, Claim and the settled
      // states share a width. Claim is outlined gold, not filled: Play is the
      // screen's one primary action.
      const settled = quest.claimed || (!quest.complete && rerollsLeft === 0);
      const button = settled ? null : this.dailyButton(0, 0, quest.complete ? `Claim +${quest.rewardGold}` : 'Reroll', quest.complete, () => {
        if (fixture) return;
        const result = quest.complete ? claimDailyQuest(save, i, todayString()) : rerollDailyQuest(save, i, todayString());
        if (!result.ok) return;
        Services.save.flush();
        if (quest.complete) Sfx.play('coin');
        this.scene.restart();
      });
      const actionNode = button ? button.container : this.dailyStatePill(quest.claimed ? '✓ Claimed' : 'No rerolls', quest.claimed);
      const textX = x + 24;
      const textWidth = w - 64 - DAILY_ACTION_WIDTH;
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
      return { row, quest, name, description, progressText, actionNode, textWidth, button };
    });
    const layout = mainMenuDailyLayout(Math.max(title.height, rerolls.height), streakText.height, rows.map((r) => ({
      title: r.name.height, description: r.description.height, progress: r.progressText.height,
      action: theme.control.minHitHeight,
    })));
    const bg = panel(this, layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    this.children.moveBelow(bg, title);
    title.setY(layout.headingY); rerolls.setY(layout.headingY); streakText.setY(layout.streakY);
    rows.forEach((r, i) => {
      const at = layout.rows[i];
      r.name.setY(at.titleY); r.description.setY(at.descriptionY); r.progressText.setY(at.progressY);
      r.actionNode.setPosition(x + w - 24 - DAILY_ACTION_WIDTH / 2, at.y + at.height / 2);
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

  private dailyButton(x: number, y: number, label: string, claim: boolean, cb: () => void): ThemedButton {
    const btn = themedButton(this, x, y, label, {
      variant: claim ? 'emphasis' : 'ghost',
      size: 'sm',
      minWidth: DAILY_ACTION_WIDTH,
      maxTextWidth: DAILY_ACTION_WIDTH - 2 * theme.space(2),
      onTap: cb,
    });
    this.menuItems.push(btn.inputZone);
    return btn;
  }

  /** A settled quest's state, drawn as a non-interactive pill the size of the action buttons. */
  private dailyStatePill(label: string, done: boolean): Phaser.GameObjects.Container {
    const color = done ? theme.colors.success : theme.colors.muted;
    const h = theme.control.heightSm;
    const plate = this.add.graphics()
      .lineStyle(theme.control.borderWidth, colorInt(color), 0.45)
      .strokeRoundedRect(-DAILY_ACTION_WIDTH / 2, -h / 2, DAILY_ACTION_WIDTH, h, theme.radius.control);
    const text = this.add.text(0, 0, label, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, fontStyle: theme.weight.w600, color,
    }).setOrigin(0.5);
    return this.add.container(0, 0, [plate, text]);
  }

  /**
   * First-run opt-in tutorial prompt (shown once, gated on !tutorialDone). Both
   * choices grant the same onboarding bonus and mark the tutorial seen, so a
   * skipper is never punished; the free starter deck is then claimed in the Shop.
   * Replayable anytime via "How to Play". (The old deck-selection popup is gone —
   * players claim their free starter in the Shop's Decks tab.)
   */
  private promptTutorial(): void {
    if (sceneStage(this).compact) {
      this.compactNotice('New to card games?', TUTORIAL_PROMPT_MESSAGE,
        { label: 'Skip', onTap: () => this.skipTutorial() },
        { label: 'Start tutorial', onTap: () => this.startTutorial() },
        () => {});
      return;
    }
    const title = this.add.text(0, 0, 'New to card games?', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.display}px`, color: theme.colors.heading,
    });
    const message = this.add.text(0, 0, TUTORIAL_PROMPT_MESSAGE, {
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

  /**
   * The one-time "bring your save over" message (M9): an iPhone or iPad
   * home-screen app keeps its own storage, so it opens on a fresh save.
   * Import code goes to Profile's import dialog; Not now carries on down the
   * arrival chain. Either way it is never shown in this storage again.
   */
  private showSaveOverNotice(onNotNow: () => void): void {
    if (sceneStage(this).compact) {
      let importing = false;
      const choose = (toImport: boolean, close: () => void): void => {
        if (!this.fixture) markSaveOverNoticeShown();
        importing = toImport;
        close();
      };
      this.compactNotice('Bring your save over', SAVE_OVER_MESSAGE,
        { label: 'Not now', onTap: (close) => choose(false, close) },
        { label: 'Import code', onTap: (close) => choose(true, close) },
        () => { if (importing) this.scene.start('Profile', { openImport: true }); else onNotNow(); });
      return;
    }
    const title = this.add.text(0, 0, 'Bring your save over', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    });
    const message = this.add.text(0, 0, SAVE_OVER_MESSAGE, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body,
        wordWrap: { width: 696 }, lineSpacing: theme.space(1),
      });
    const layout = menuNoticeLayout(760, title.height, message.height);
    let importing = false;
    const shell = modalShell(this, {
      width: layout.width, height: layout.height, titleTrackHeight: layout.titleTrackHeight,
      dismissal: 'mandatory',
      onClose: () => {
        this.guard.close();
        if (importing) this.scene.start('Profile', { openImport: true });
        else onNotNow();
      },
    });
    this.guard.open(this.menuItems);
    title.setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y);
    message.setPosition(shell.tracks.contentBounds.x, shell.tracks.contentBounds.y);
    shell.container.add([title, message]);
    const y = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2;
    const close = (toImport: boolean): void => {
      if (!this.fixture) markSaveOverNoticeShown();
      importing = toImport;
      shell.close();
    };
    const importButton = themedButton(this, 520, y, 'Import code', { variant: 'primary', minWidth: 180, onTap: () => close(true) });
    const notNow = themedButton(this, 760, y, 'Not now', { variant: 'ghost', minWidth: 160, onTap: () => close(false) });
    shell.container.add([importButton.container, notNow.container]);
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
