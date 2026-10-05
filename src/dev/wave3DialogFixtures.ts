/**
 * Accessibility wave 3, batch C: probe fixtures for the shared dialogs, the
 * toasts, the versus bumper and the card zoom. DEV ONLY: the probe imports
 * this module through `a11yProbe.ts`; nothing in the app does.
 *
 * Every surface here is a shared widget with no scene of its own, so each
 * fixture boots the Main menu in its fixture mode and hands it `a11yOpen`,
 * which builds the widget over the menu. Nothing here reads or writes the
 * player's save: the stats notice gets an in-memory controller, the Darlings
 * explainer runs in its preview mode, the cosmetic picker gets an owned list,
 * and every notice queued by a toast fixture is dropped when its scene stops.
 *
 * Identities are the source data's longest real strings, never invented
 * padding: the longest achievement titles, deck names, opponent names, card
 * names and rarity names.
 */
import type Phaser from 'phaser';
import type { ProbeScene } from './a11yProbe';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import { DARLINGS_PRECONS } from '../data/darlingsPrecons';
import { DRAFT_PERSONAS } from '../data/draftPersonas';
import { AVATARS } from '../data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../data/starterDecks';
import { ACHIEVEMENTS } from '../meta/Achievements';
import { collectiblePool } from '../meta/collectionFilter';
import { CARD_BACKS, PLAYMATS } from '../meta/cosmetics';
import { freshSave } from '../meta/SaveManager';
import { STATS_NOTICE_VERSION } from '../meta/statsNotice';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { PROVOKED_SPENT_NOTE } from '../ui/boardCuePresentation';
import { CardZoomPreview, type CardZoomOptions } from '../ui/CardZoomPreview';
import { openCosmeticPicker } from '../ui/CosmeticPicker';
import { showDarlingsTutorial } from '../ui/DarlingsTutorial';
import { createLegalPanel } from '../ui/LegalPanel';
import { ModalGuard } from '../ui/Modal';
import { createStatsNoticeDialog } from '../ui/StatsNoticeDialog';
import { createStatsPrivacyPanel } from '../ui/StatsPrivacyPanel';
import { createStatsNoticeController, statsNoticeNoteText } from '../ui/statsPrivacyPresentation';
import { discardPendingToasts, queueToast, Toast } from '../ui/Toast';
import { VersusBumper } from '../ui/VersusBumper';
import { WAVE_2D_COACH_CUE, WAVE_2D_COACH_INFO } from './duelA11yFixtures';

type Open = (scene: Phaser.Scene) => void;

const longest = <T>(items: readonly T[], name: (item: T) => string): T =>
  items.reduce((a, b) => (name(b).length > name(a).length ? b : a));

const SOURCE_DECKS = [...STARTER_DECKS, ...THEME_DECKS];
export const WAVE_3C_LONGEST_DECK = longest(SOURCE_DECKS, (deck) => deck.name);
export const WAVE_3C_LONGEST_DARLINGS = longest(DARLINGS_PRECONS, (deck) => deck.name);
export const WAVE_3C_LONGEST_AVATAR = longest(AVATARS, (avatar) => avatar.name);
export const WAVE_3C_LONGEST_PERSONA = longest(DRAFT_PERSONAS, (persona) => persona.name);
/** Longest titles first: the single toast, then the stack of three. */
export const WAVE_3C_ACHIEVEMENTS = [...ACHIEVEMENTS].sort((a, b) => b.title.length - a.title.length);
const COLLECTIBLES = collectiblePool(ALL_CARDS);
/** The longest card name, and the longest name among the longest rarity's cards. */
export const WAVE_3C_LONGEST_CARD = longest(COLLECTIBLES, (card) => card.name);
export const WAVE_3C_LONGEST_SSR = longest(COLLECTIBLES.filter((card) => card.rarity === 'ssr'), (card) => card.name);

/**
 * Play every entrance tween to its end now, in 50ms steps, so the measured
 * frame is the settled one however slowly the headless clock runs under load
 * (Phaser's tween clock counts a stalled frame as one 16ms step). Timers (a
 * toast's hold, the bumper's hold) run on the scene clock and are untouched.
 */
function settleEntrances(scene: Phaser.Scene): void {
  for (const tween of scene.tweens.getTweens()) {
    for (let i = 0; i < 40; i++) if (tween.update(50)) break;
  }
}

/** Hide the host menu, for a widget that draws over whatever scene is up. */
function bareStage(scene: Phaser.Scene): void {
  for (const child of [...scene.children.list]) {
    (child as Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Visible>).setVisible?.(false);
  }
}

/**
 * A burst arrives together the way a Duel's or a pack's does: on a held host,
 * released once everything is queued, so up to three notices stack. Toasts
 * outlive their scene by design; a fixture's must not reach the next fixture.
 */
function toastStage(scene: Phaser.Scene, queue: () => void): void {
  bareStage(scene);
  const host = new Toast(scene, { held: true });
  scene.events.once('shutdown', discardPendingToasts);
  queue();
  host.release();
  settleEntrances(scene);
}

const statsNotice = (note: string | null): Open => (scene) => {
  const settings = structuredClone(freshSave(0).settings);
  const controller = createStatsNoticeController({
    settings,
    setNoticeVersion: () => {},
    touch: () => {},
    acknowledge: () => {},
  }, STATS_NOTICE_VERSION);
  createStatsNoticeDialog(scene, { guard: new ModalGuard(), guardTargets: [], controller, note, onContinue: () => {} });
};

const privacyPanel = (end: boolean): Open => (scene) => {
  const shell = createStatsPrivacyPanel(scene, new ModalGuard(), []);
  if (!end) return;
  // The last scroll position, reached the way a player reaches it: the wheel.
  const zone = shell.container.list.find((child) => child.type === 'Zone');
  zone?.emit('wheel', scene.input.activePointer, 0, 100_000);
};

const cosmetics = (kind: 'cardBack' | 'playmat'): Open => (scene) => {
  const entries = kind === 'cardBack' ? CARD_BACKS : PLAYMATS;
  openCosmeticPicker(scene, {
    kind,
    currentId: entries[entries.length - 1].id,
    owned: entries.slice(2, -1).map((entry) => entry.id),
    subtitle: `Style for ${WAVE_3C_LONGEST_DECK.name}. This deck only.`,
    onEquip: () => {},
  });
};

const versus = (player: string, opponent: string): Open => (scene) => {
  bareStage(scene);
  new VersusBumper(scene, {
    // Reduced motion has no slide, so the settled frame is what is measured
    // however slowly the headless clock runs; the layout is the same.
    animations: 'reduced',
    player: { cardId: AVATARS[0].portraitCardId, label: player },
    opponent: { cardId: WAVE_3C_LONGEST_AVATAR.portraitCardId, label: opponent },
    onComplete: () => {},
  });
  settleEntrances(scene);
};

/** The card zoom in each host's own dock, hovered from the far side, with a state note. */
const zoom = (options: CardZoomOptions, cardId: string, note: string | null): Open => (scene) => {
  bareStage(scene);
  const preview = new CardZoomPreview(scene, { ...options, delayMs: 0 });
  const source = scene.add.zone(900, 360, 10, 10);
  preview.attach(source, CARD_DB[cardId], undefined, undefined, () => note);
  source.emit('pointerover', { wasTouch: false, worldX: 900 });
};
const DUEL_ZOOM: CardZoomOptions = { scale: 1.1, dockY: 230 };
const BUILDER_ZOOM: CardZoomOptions = { scale: 1.12, dockY: 360, leftX: 210, rightX: 690 };

const menu = (label: string, open: Open, requiredText?: readonly string[]): ProbeScene => ({
  label, key: 'MainMenu', data: { a11yFixture: true, a11yOpen: open }, ...(requiredText ? { requiredText } : {}),
});

/** Accessibility wave 3 probe scenes: The tutorial surfaces, dialogs, boot and preload, empty and error states, and card zoom. */
export const WAVE_3C_SCENES: readonly ProbeScene[] = [
  menu('Darlings tutorial', (scene) => {
    showDarlingsTutorial(scene, { preview: true, onReadMore: () => {} });
  }),
  menu('Stats notice / development note', statsNotice(statsNoticeNoteText('development'))),
  menu('Stats notice / browser note', statsNotice(statsNoticeNoteText('browserSignal'))),
  menu('Stats notice / no note', statsNotice(null)),
  menu('Stats privacy panel', privacyPanel(false)),
  menu('Stats privacy panel / end', privacyPanel(true)),
  menu('Legal panel', (scene) => {
    createLegalPanel(scene, new ModalGuard(), []);
  }),
  menu('Cosmetic picker / card backs', cosmetics('cardBack')),
  menu('Cosmetic picker / playmats', cosmetics('playmat')),
  menu('Toast / longest achievement', (scene) => toastStage(scene, () => queueAchievementUnlockToasts([WAVE_3C_ACHIEVEMENTS[0].id])),
    [WAVE_3C_ACHIEVEMENTS[0].title]),
  menu('Toast / three stacked', (scene) => toastStage(scene, () => queueAchievementUnlockToasts(WAVE_3C_ACHIEVEMENTS.slice(0, 3).map((a) => a.id))),
    WAVE_3C_ACHIEVEMENTS.slice(0, 3).map((a) => a.title)),
  menu('Toast / collapsed', (scene) => toastStage(scene, () => queueAchievementUnlockToasts(WAVE_3C_ACHIEVEMENTS.slice(0, 5).map((a) => a.id)))),
  menu('Toast / deck granted', (scene) => toastStage(scene, () => queueToast({
    title: 'Deck granted',
    body: `You already hold every card, so ${WAVE_3C_LONGEST_DECK.name} is in your deck library.`,
  }))),
  menu('Versus / longest deck and avatar', versus(WAVE_3C_LONGEST_DECK.name, WAVE_3C_LONGEST_AVATAR.name),
    [WAVE_3C_LONGEST_DECK.name, WAVE_3C_LONGEST_AVATAR.name]),
  menu('Versus / Darlings and persona', versus(WAVE_3C_LONGEST_DARLINGS.name, WAVE_3C_LONGEST_PERSONA.name),
    [WAVE_3C_LONGEST_DARLINGS.name, WAVE_3C_LONGEST_PERSONA.name]),
  menu('Card zoom / Duel dock', zoom(DUEL_ZOOM, WAVE_3C_LONGEST_SSR.id, PROVOKED_SPENT_NOTE)),
  menu('Card zoom / Deck Builder dock', zoom(BUILDER_ZOOM, WAVE_3C_LONGEST_CARD.id, null)),
  // The Duel's tutorial branch, as far as the existing Duel fixtures reach it
  // (DuelScene is not this batch's file): the coach cue and the info card.
  { label: 'Duel tutorial / coach cue', key: 'Duel', data: { a11yFixture: 'coach-cue' }, requiredText: [WAVE_2D_COACH_CUE] },
  { label: 'Duel tutorial / coach info', key: 'Duel', data: { a11yFixture: 'coach-info' }, requiredText: [WAVE_2D_COACH_INFO] },
];
