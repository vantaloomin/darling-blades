import Phaser from 'phaser';
import type { AIPlayer } from '../ai/AIPlayer';
import { buildTierAI, floorTier } from '../ai/tiers';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { buildAI } from '../ai/personality';
import { ECONOMY, RULES } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { tutorialCue, type TutorialCueInput, type TutorialCueKind } from '../data/tutorial';
import { avatarById, avatarForRung, AVATARS, type Avatar } from '../data/opponents';
import { draftPersonaById, type DraftPersona } from '../data/draftPersonas';
import { heroById } from '../data/heroes';
import type { SaveData } from '../meta/SaveManager';
import { STARTER_DECKS } from '../data/starterDecks';
import {
  applyGauntletResult,
  applyLimitedMatchResult,
  applyMatchResult,
  todayString,
  type Difficulty,
} from '../meta/Economy';
import { ownedVariantEntries } from '../meta/collectionFilter';
import { resolveDuelDifficulty } from '../meta/duelSetup';
import type { CardVariant } from '../meta/variants';
import { localDateKey, resolveGauntletRoster, rungSeed } from '../meta/gauntletSeed';
import { LIMITED_MATCHES, limitedDuelData, personaRevealTier, type LimitedDuelData } from '../meta/Limited';
import { applyDailyQuestProgress, recordDailyWin } from '../meta/Quests';
import {
  finishReplay,
  pushReplay,
  recordReplayAction,
  replayDbStamp,
  startReplayDraft,
  undoReplayAction,
  type ReplayDraft,
  type ReplayLog,
} from '../meta/Replay';
import { Services } from '../meta/services';
import { deckColorStyle, type DeckColorStyle } from '../meta/deckColorIdentity';
import { forcedAction, reasonUncastable, type Action } from '../engine/actions';
import { previewCombat } from '../engine/combat/damage';
import { eligibleAttackers, blockOptions, minimumBlockersForAttacker } from '../engine/combat/legality';
import type { GameEvent } from '../engine/events';
import { Game } from '../engine/Game';
import { combineManaCosts, manaSources, solveMana } from '../engine/mana';
import { ensureSplitPip } from '../ui/ManaSymbols';
import { getEffectiveStats, isSummoningSick } from '../engine/statics';
import type { CardDef, Color, PlayerId, Permanent, TargetRef } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import {
  attachTouchGestures,
  bindTapButton,
  inflateHitArea,
  isTouchDevice,
  setStickyHost,
} from '../platform/gestures';
import { faceCardFor } from '../meta/deckFace';
import { Art } from '../art/ArtResolver';
import { BoardCardView, TILE_W, TILE_H, type BoardHighlight } from '../ui/BoardCardView';
import { CardZoomPreview } from '../ui/CardZoomPreview';
import { CardView, CARD_W, CARD_H } from '../ui/CardView';
import { CoachMark } from '../ui/CoachMark';
import { CombatFx } from '../ui/CombatFx';
import { planCombat, type CombatHit, type CombatStep } from '../ui/combatSequence';
import {
  COIN_FLIP_ACTION_CENTERS,
  COIN_FLIP_ACTION_WIDTH,
  COIN_FLIP_CALL_Y,
  COIN_FLIP_FACE_TEXTURES,
  COIN_FLIP_RESULT_Y,
  type CoinFlipSide,
} from '../ui/coinFlipLayout';
import { CommanderPortrait } from '../ui/CommanderPortrait';
import { fanLayout } from '../ui/handFan';
import { handDisplayOrder } from '../ui/handSort';
import { HistoryPanel } from '../ui/HistoryPanel';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { combatForecastCopy, defeatReasonCopy, resultReasonCopy } from '../ui/duelCopy';
import { ModalGuard } from '../ui/Modal';
import { PHASE_TRACK_ROWS, phaseTrackRowForStep, type PhaseTrackRow } from '../ui/phaseTrack';
import { empowerText, manaCostText, romanNumeral } from '../ui/rulesText';
import { PileView } from '../ui/PileView';
import { bakeKeywordIcons } from '../ui/KeywordIcons';
import { packRow, type RowPacking } from '../ui/rowPacking';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { StackDisplay } from '../ui/StackDisplay';
import { colorInt, theme } from '../ui/theme';
import { modalShell, themedButton, type ThemedButton } from '../ui/themeWidgets';
import { showZoneContents, type ZoneContentsEntry, type ZoneContentsModal } from '../ui/ZoneContentsModal';

const HUMAN: PlayerId = 0;
const AI: PlayerId = 1;

/**
 * MouseManager.disableContextMenu() adds a DOM listener with no dedupe and
 * lives for the whole game, while DuelScene restarts per gauntlet rung —
 * calling it per create() leaks one listener per rung. Module flag = once
 * per game lifetime (an HMR reload resets both the flag and the game).
 */
let contextMenuDisabled = false;

/**
 * After an auto-skip hop advances the game state it retargets the single
 * smart button to the NEXT decision. A smart-button click already in flight
 * for the PREVIOUS decision would then be applied to the new one — and an
 * empty `declareAttackers` means "skip combat entirely", so a reflexive click
 * during a chain of skips could silently throw away a real attack. Swallow
 * smart-button presses for a brief window straddling any auto-skip transition
 * (comfortably under the 300 ms hop cadence). A deliberate click a beat later
 * still works.
 */
const AUTOSKIP_INPUT_LOCK_MS = 280;

/**
 * "Immersive fan" layout (wireframe 1a, 2026-07-04), 1280×720 design res:
 * a mirrored opponent play mat on top (portrait, life, icon piles,
 * mana and a full zone plate), two inset battlefield zone plates (each
 * holding its land row at the outer edge and its creature row at the inner
 * edge, Arena-style), a sparse left control rail, and a bottom stage: commander
 * portrait (bottom-left), arced hand fan (center), smart-button cluster +
 * piles (right). The backdrop art shows through around the plates.
 */
const LAYOUT = {
  /** Opponent's mirrored zone, narrowed for the top-right commander frame. */
  oppZone: { x0: 108, x1: 1046, y0: 16, y1: 292 },
  /** Foe mana strip takes the old land-stack anchor and steps leftward. */
  oppManaStrip: { cy: 56, x0: 1006, step: 44, pipSize: 18 },
  /** Non-creature permanent band shares the old top land lane, opposite mana. */
  oppPermanentBand: { cy: 63, x0: 120, usable: 380 },
  /** The opponent row stays at its audited y but centers in its narrower plate. */
  oppCreatures: { cy: 200, x: 577, usable: 860 },
  /** Between the zone plates: skip toast + stack readout float here. */
  gap: { cy: 298, stackX: 400, stackY: 283 },
  /** Player zone now matches the opponent plate's right edge for the sidebar. */
  myZone: { x0: 108, x1: 1046, y0: 312, y1: 532 },
  myCreatures: { cy: 404, x: 577, usable: 860 },
  /** Your mana strip takes the old land-stack anchor and steps rightward. */
  myManaStrip: { cy: 500, x0: 210, step: 54, pipSize: 22 },
  /** Non-creature permanent band shares the lower lane, opposite mana. */
  myPermanentBand: { cy: 500, x1: 1006, usable: 380 },
  // restY is computed in syncHand to anchor the fan's bottom near y=714 for
  // the active scale; the hover lift is computed per card so the raised
  // zone's bottom edge matches the resting zone's (no orphaned-pointer
  // flicker band — adversarial review 2026-07-04).
  /** Commander portrait frame (top-left anchored, rises from screen bottom). */
  portrait: { x: 14, y: 540, w: 200, h: 180 },
  /** Your targetable life badge: inside the portrait's upper-left corner. */
  myLife: { x: 40, y: 566 },
  /** Mirrored commander frame and its targetable life badge. */
  oppPortrait: { x: 1056, y: 8, w: 200, h: 180 },
  /** Foe targetable life badge: inside the portrait's bottom-right corner. */
  oppLife: { x: 1230, y: 162 },
  /** Turn chip atop the phase track — all turn info lives in one column. */
  turnPill: { x: 1113, y: 292 },
  /** Display-only phase track in the right sidebar above End Turn. */
  phaseTrack: { x: 1113, firstRowY: 326, rowStep: 34 },
  /** Right-side control cluster: smart button · ⏭ End Turn chip (top→bottom). */
  cluster: { x: 1108, passY: 536, endTurnY: 639, passR: 46 },
  /** Opponent hand/grave/deck icon stack in the left pile column. */
  oppPiles: { x: 38, handY: 40, graveY: 110, deckY: 180, severedY: 250 },
  /** Your deck/grave icon stack, with a hidden severed slot reserved above deck. */
  piles: { x: 1242, severedY: 482, deckY: 552, graveY: 622 },
} as const;

const SEVER_ENABLED = true;
const BOARD_CENTER_X = 640;
/** Cast-targeting arrow: source anchor (hand-rest, bottom-center), snap radius, color. */
const TARGET_ARROW_SRC = { x: BOARD_CENTER_X, y: 700 };
const TARGET_SNAP_R = 60;
const TARGET_ARROW_COLOR = 0xffd166;
const LIFE_BADGE_SIZE = 40;
const COLOR_SORT: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const ROW_GUTTER = 6;
const PERMANENT_BAND_SCALE = 0.55;
const PERMANENT_BAND_TILE_W = TILE_W * PERMANENT_BAND_SCALE;
const PERMANENT_BAND_MAX_SPACING = 98;
type ViewableZone = 'deck' | 'graveyard' | 'severed';
type PermanentRowLayoutBase = {
  cy: number;
  usable: number;
  tileWidth: number;
  maxSpacing: number;
  baseScale: number;
  depth: number;
  liftSelected: boolean;
};
type PermanentRowLayout = PermanentRowLayoutBase & (
  | { align: 'center'; x: number }
  | { align: 'left'; x0: number }
  | { align: 'right'; x1: number }
);
/**
 * Max total width of the hand fan. Narrower than the old flat row: fanned
 * cards overlap more, and the span must clear the commander portrait (left,
 * ends x214) and the smart-button cluster (right, starts x1062).
 *
 * On TOUCH devices the fan widens to keep the audited tap-pitch guarantee
 * (mobile-lan-plan §1.4: adjacent target centers ≥90px for hands ≤9 —
 * (900−300·0.6)/8 = 90 exactly at 9 cards). The wider fan's edges overlap
 * the portrait (non-interactive) and cede the rightmost card's outer ~30px
 * to the End Turn chip's higher-depth rect — both harmless, and screen
 * space beats the tighter desktop aesthetic on a phone.
 */
const HAND_SPAN_MOUSE = 760;
const HAND_SPAN_TOUCH = 900;

interface PlayReveal {
  cardId: string;
  controller: PlayerId;
  permanentIid?: number;
  source?: { x: number; y: number; scale: number; angle: number };
}

/**
 * The duel scene: full match vs the AI, mouse only. Declarative re-render
 * after every action batch, with floating damage/life numbers driven by
 * events. Battlefield permanents render as compact BoardCardView tiles;
 * full card text is one hover (CardZoomPreview) or right-click (inspect
 * overlay) away.
 */
export class DuelScene extends Phaser.Scene {
  private duel!: Game;
  /** One-deep pre-action snapshot for local Undo; null when undo is unavailable. */
  private undoSnapshot: Game | null = null;
  /** Replay recording for this duel (src/meta/Replay.ts); null = not recorded (tutorial). */
  private replayDraft: ReplayDraft | null = null;
  /** Read-only playback state. A replay never shares the recorder draft. */
  private replayLog: ReplayLog | null = null;
  private replayMode = false;
  private replayCursor = 0;
  private replayPlaying = false;
  private replaySpeed: 1 | 2 | 4 = 1;
  private replayTimer: Phaser.Time.TimerEvent | null = null;
  private replayGuard = new ModalGuard();
  private replayControls: Phaser.GameObjects.Container | null = null;
  private replayPlayButton: ThemedButton | null = null;
  private replaySpeedButton: ThemedButton | null = null;
  private replayOutcome: Phaser.GameObjects.Container | null = null;
  private undoBtn!: Phaser.GameObjects.Text;
  /** Live combat-damage forecast shown while you assign blocks (F12). */
  private combatPreviewText!: Phaser.GameObjects.Text;
  private ai!: AIPlayer;
  private difficulty: Difficulty = 'easy';
  private opponent: Avatar | null = null; // set in gauntlet mode
  private gauntletRung: number | null = null;
  /** Live run roster cached before results can clear the run from the save. */
  private gauntletRosterOrder: readonly number[] | null = null;
  private views = new Map<number, BoardCardView>(); // battlefield iid → tile
  private handViews: CardView[] = [];
  /** Last rendered hand, retained briefly only so rebuild exits can read as motion. */
  private renderedHand: { cardId: string; view: CardView }[] = [];
  /** Previous canonical hand snapshot; reset on every DuelScene create/restart. */
  private previousHand: string[] | null = null;
  /** Last fan poses indexed by canonical hand slot, used if a live origin is unavailable. */
  private handPoses = new Map<number, { x: number; y: number; scale: number; angle: number }>();
  private handDecor: Phaser.GameObjects.GameObject[] = [];
  private landPositions = new Map<string, { x: number; y: number }>();
  private manaPips: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  private manaStripZones: Phaser.GameObjects.Zone[] = [];
  /** Desktop-only hover preview markers for the exact auto-tap mana plan. */
  private manaPlanMarks: Phaser.GameObjects.GameObject[] = [];
  private previousManaSignature: string | null = null;
  private hud!: {
    myLife: Phaser.GameObjects.Text;
    oppLife: Phaser.GameObjects.Text;
    /** Left-rail turn pill plus right-side display-only phase rows. */
    turnPill: { fill: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text };
    phaseRows: { fill: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[];
    /** Smart-button label; input lives on `passArc` (the circle is the button). */
    button: Phaser.GameObjects.Text;
  };
  /** The circular smart button (wireframe 1a "PASS"); relabeled per decision. */
  private passArc!: Phaser.GameObjects.Arc;
  /** Public stack cards shown only while a response decision is live. */
  private stackDisplay!: StackDisplay;
  /** Deck/grave/hand pile indicators. Severed slots are reserved behind SEVER_ENABLED. */
  private oppDeckPile!: PileView;
  private oppGravePile!: PileView;
  private oppHandPile!: PileView;
  private oppSeveredPile!: PileView;
  private myDeckPile!: PileView;
  private myGravePile!: PileView;
  private mySeveredPile!: PileView;
  /** Bottom-left commander portrait — the player's deck face card, reactive. */
  private portrait!: CommanderPortrait;
  /** Top-right mirror of the player portrait — the opponent's deck face, reactive. */
  private oppPortrait!: CommanderPortrait;
  /** Derived identity (create()): portraits cost zero new art (opponents.ts idiom). */
  private myDeckName = '';
  private myDeckColorStyle: DeckColorStyle = 'other';
  private myFaceCardId: string | null = null;
  /** Premium hero portrait texture (a bought theme deck's exclusive art), or null. */
  private myHeroTextureKey: string | null = null;
  private oppFaceCardId: string | null = null;
  private selectedAttackers = new Set<number>();
  private blockAssignments: { blocker: number; attacker: number }[] = [];
  private pendingBlocker: number | null = null;
  private pendingCasts: Extract<Action, { type: 'castSpell' }>[] | null = null;
  private arrows!: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Container | null = null;
  private guard = new ModalGuard();
  private inspect: Phaser.GameObjects.Container | null = null;
  private inspectGuard = new ModalGuard();
  private inspectMove: ((p: Phaser.Input.Pointer) => void) | null = null;
  private zoom!: CardZoomPreview;
  private menuBtn!: Phaser.GameObjects.Text;
  /** In-game pause/menu overlay (Resume · quick toggles · Concede) + its guard. */
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private pauseGuard = new ModalGuard();
  /** Public zone browser: graveyards, public severed piles, player deck, and land stacks. */
  private zoneModal: ZoneContentsModal | null = null;
  private zoneGuard = new ModalGuard();
  /** Set when inspect was opened FROM a zone modal: closing inspect returns there. */
  private zoneModalReturn: (() => void) | null = null;
  /** Graveyard-target chooser (Summon the Dead etc.): pick which creature to return. */
  private gravePicker: Phaser.GameObjects.Container | null = null;
  private gravePickerGuard = new ModalGuard();
  private empowerChooser: Phaser.GameObjects.Container | null = null;
  private empowerChooserGuard = new ModalGuard();
  /** Two-tap concede guard (settings.confirmDestructive); armed by the first tap. */
  private concedeArmed = false;
  private discardPicks = new Set<number>();
  private foreseeBottomPicks = new Set<number>();
  /**
   * Optional first-launch tutorial mode (src/data/tutorial.ts). When set, this
   * duel runs a scripted line (fixed decks + seed + `ScriptAI`) under a
   * coach-mark guide; auto-skip is off and results route to `tutorialComplete`
   * instead of the ranked win/loss path.
   */
  private tutorial = false;
  private limited: LimitedDuelData['limited'] | null = null;
  /**
   * Draft-mode Limited matches are played against the persona seated at
   * `matchIndex + 1` of the bot draft. Like the gauntlet `opponent`, it only
   * skins identity (name/portrait) and Personality knobs onto the brain the
   * difficulty ladder picks — never the deck (that's `oppDeckOverride`).
   */
  private limitedPersona: DraftPersona | null = null;
  private coach: CoachMark | null = null;
  /**
   * Hard-constrains input to the one control the current coach mark points at:
   * every sync it deadens `overlayGuardTargets()` minus the spotlighted target,
   * so the player can only take the taught action (and can't, e.g., cast the
   * Charm early and end the tutorial before its beat).
   */
  private tutorialGuard = new ModalGuard();
  private tutGoalShown = false;
  private tutSicknessShown = false;
  private tutInspectShown = false;
  private tutHealInfoShown = false;
  private tutBlocked = false;
  /** Ritual (sorcery-timing) + Charm (instant-timing) lesson progress. */
  private tutRitualCast = false;
  private tutRitualInfoShown = false;
  private tutCharmCast = false;
  private tutCharmInfoShown = false;
  private tutCompleted = false;
  /** A tap-to-continue info card is up; the guide waits for its dismissal. */
  private coachInfoActive = false;
  private aiTimer: Phaser.Time.TimerEvent | null = null;
  private coinChoiceTimer: Phaser.Time.TimerEvent | null = null;
  private autoSkipTimer: Phaser.Time.TimerEvent | null = null;
  /** Scene-clock time of the last auto-skip transition; guards the smart-button race. */
  private lastAutoSkipAt = -Infinity;
  private skipText!: Phaser.GameObjects.Text;
  private ended = false;
  /** Device-level touch profile (copy text only — behavior gates per-pointer). */
  private touch = false;
  /** Right-edge move-history slide-out (mirrors the log feed). */
  private history!: HistoryPanel;
  /** Themed attack-animation renderer (lunges + per-archetype impact FX). */
  private combatFx!: CombatFx;
  /**
   * Sequenced-combat mode (feature: "slower combat"): while a combat-damage
   * batch plays back attacker-by-attacker (planCombat → renderCombatStep), the
   * board sync + AI/auto-skip/end-turn follow-ups are DEFERRED to the sequence's
   * finish, so the pre-combat board stays on screen and each strike reads. Only
   * engages at `animations: 'full'`; reduced/off keep the instant path.
   */
  private animatingCombat = false;
  private combatTimers: Phaser.Time.TimerEvent[] = [];
  /**
   * End-turn fast-forward MODE (feature 2): auto-passes your trivial phases but
   * pauses at a declare-attackers where you have eligible attackers (your chosen
   * "stop if I can attack" behavior) and at mandatory picks, resuming after.
   * Supersedes maybeAutoSkip while active; clears when the turn flips to the AI.
   */
  private endingTurn = false;
  private endTurnTimer: Phaser.Time.TimerEvent | null = null;
  private endTurnBtn!: Phaser.GameObjects.Text;
  /** transient center banner shown on each turn change (self-destroys). */
  private turnBanner?: Phaser.GameObjects.Container;
  private previousLife: [number, number] | null = null;
  private previousPhaseRow: PhaseTrackRow | null = null;
  private forecastWasLethal = false;
  /** The off-motion fallback still briefly reveals opponent casts. */
  private oppCastReveal?: Phaser.GameObjects.Container;
  private pendingPlayReveals: PlayReveal[] = [];
  private humanPlayOrigin: { cardId: string; source: { x: number; y: number; scale: number; angle: number } } | null = null;
  private playRevealGhosts = new Set<CardView>();

  constructor() {
    super('Duel');
  }

  create(
    data: {
      difficulty?: Difficulty;
      opponentId?: string;
      gauntletRung?: number;
      // Tutorial overrides (src/data/tutorial.ts): a fixed scripted duel. Absent
      // fields fall back to the normal save-/gauntlet-derived resolution.
      deckOverride?: string[];
      oppDeckOverride?: string[];
      seedOverride?: number;
      aiOverride?: AIPlayer;
      tutorial?: boolean;
      limited?: LimitedDuelData['limited'];
      replay?: ReplayLog;
    } = {},
  ): void {
    // When present, an avatar drives the deck and personality. Gauntlet
    // inherits that avatar's tuned difficulty; Practice may explicitly
    // override the brain tier while keeping the real deck and temperament.
    this.replayLog = data.replay ?? null;
    this.replayMode = this.replayLog !== null;
    this.replayCursor = 0;
    this.replayPlaying = false;
    this.replaySpeed = 1;
    this.replayTimer = null;
    this.replayControls = null;
    this.replayPlayButton = null;
    this.replaySpeedButton = null;
    this.replayOutcome = null;
    this.replayGuard = new ModalGuard();
    this.opponent = data.replay?.context.opponentId
      ? this.avatarForReplay(data.replay.context.opponentId)
      : data.opponentId
        ? avatarById(data.opponentId)
        : null;
    this.gauntletRung = data.replay?.context.gauntletRung ?? data.gauntletRung ?? null;
    this.gauntletRosterOrder = null;
    this.difficulty = resolveDuelDifficulty(
      data.replay?.context.difficulty,
      data.difficulty,
      this.opponent?.difficulty,
      this.gauntletRung,
    );
    this.tutorial = data.tutorial ?? false;
    this.limited = data.limited ?? null;
    this.limitedPersona = !this.replayMode && this.limited?.opponentPersonaId
      ? draftPersonaById(this.limited.opponentPersonaId)
      : null;
    this.tutGoalShown = false;
    this.tutSicknessShown = false;
    this.tutInspectShown = false;
    this.tutHealInfoShown = false;
    this.tutBlocked = false;
    this.tutRitualCast = false;
    this.tutRitualInfoShown = false;
    this.tutCharmCast = false;
    this.tutCharmInfoShown = false;
    this.tutCompleted = false;
    this.coachInfoActive = false;
    this.coach = null;
    this.tutorialGuard = new ModalGuard();
    this.views = new Map();
    this.handViews = [];
    this.renderedHand = [];
    this.previousHand = null;
    this.handPoses = new Map();
    this.handDecor = [];
    this.landPositions = new Map();
    this.pendingPlayReveals = [];
    this.humanPlayOrigin = null;
    this.playRevealGhosts = new Set();
    this.manaPips = [];
    this.manaStripZones = [];
    this.manaPlanMarks = [];
    this.previousManaSignature = null;
    this.previousLife = null;
    this.previousPhaseRow = null;
    this.forecastWasLethal = false;
    this.selectedAttackers = new Set();
    this.blockAssignments = [];
    this.pendingBlocker = null;
    this.undoSnapshot = null;
    this.replayDraft = null;
    // Scene instances are REUSED on restart: a stale aiTimer reference from an
    // abandoned duel (left mid-AI-decision) points at the dead clock and its
    // `if (this.aiTimer) return` guard would mute the AI forever (found live
    // 2026-07-16; the restart-hygiene trap class from playbook §11).
    this.aiTimer = null;
    this.overlay = null;
    this.guard = new ModalGuard();
    this.inspect = null;
    this.inspectGuard = new ModalGuard();
    this.inspectMove = null;
    this.pauseOverlay = null;
    this.pauseGuard = new ModalGuard();
    this.zoneModal = null;
    this.zoneGuard = new ModalGuard();
    this.zoneModalReturn = null;
    this.discardPicks = new Set();
    this.foreseeBottomPicks = new Set();
    // Stale on gauntlet/rematch restarts: the scene clock died with the old
    // run, so a still-set handle would block auto-skip forever. The clock also
    // resets to 0 on restart, so clear the guard timestamp with it.
    this.autoSkipTimer = null;
    this.coinChoiceTimer = null;
    this.lastAutoSkipAt = -Infinity;
    this.ended = false;
    // End-turn mode is per-match; clear it (and its stale timer handle) on every
    // create()/gauntlet restart — the old scene clock died with the run.
    this.endingTurn = false;
    this.endTurnTimer = null;
    // Sequenced-combat state resets per match (the old scene clock/timers died).
    this.animatingCombat = false;
    this.combatTimers = [];

    // Right-click is the inspect gesture; the browser menu must never appear.
    if (!contextMenuDisabled) {
      this.input.mouse?.disableContextMenu();
      contextMenuDisabled = true;
    }
    this.touch = isTouchDevice();
    // Old instance (gauntlet restarts) tears itself down on scene shutdown.
    // Touch: long-press docks the preview STICKY; tapping the preview is the
    // touch equivalent of right-click inspect (mobile-lan-plan §1.3). During
    // targeting inspect stays blocked (right-click cancels there on desktop).
    this.zoom = new CardZoomPreview(this, {
      // Keep the docked card above the player mana-plan strip. At 1.1x the
      // preview is 462px tall, so this center leaves its lower edge at 461.
      scale: 1.1,
      dockY: 230,
      onStickyTap: (card, variant) => {
        if (this.pendingCasts) this.zoom.dismissSticky();
        else this.showInspect(card, variant);
      },
    });
    setStickyHost(this, this.zoom);

    this.buildZones();
    bakeKeywordIcons(this);
    this.arrows = this.add.graphics().setDepth(50);

    const save = Services.save.data;
    if (!this.replayMode && this.gauntletRung !== null && save.gauntlet.run) {
      this.gauntletRosterOrder = resolveGauntletRoster(
        save.gauntlet.run,
        localDateKey(Date.now()),
        AVATARS.length,
      ).order;
    }
    // Tower (gauntlet) duels derive their seed from the run's fixed seed, so the
    // whole run is one reproducible playthrough (src/meta/gauntletSeed.ts);
    // practice duels stay freshly random each time.
    const seed =
      data.replay?.seed ??
      data.seedOverride ??
      (this.gauntletRung != null && save.gauntlet.run
        ? rungSeed(save.gauntlet.run.seed, this.gauntletRung)
        : Math.floor(Math.random() * 2 ** 31));
    const myDeckEntry = save.decks.find((d) => d.id === save.activeDeckId);
    const myDeck = data.replay?.decks[0].slice() ?? data.deckOverride ?? myDeckEntry?.cards ?? STARTER_DECKS[0].cards;
    this.myDeckColorStyle = deckColorStyle(myDeck, CARD_DB);
    // Gauntlet: the avatar pilots its themed deck. Practice: the AI pilots a
    // starter the player is NOT using (or the second one). Tutorial: a fixed deck.
    const aiDeck =
      data.replay?.decks[1].slice() ??
      data.oppDeckOverride ??
      (this.opponent
        ? this.opponent.deck
        : (STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards));
    // Duel identities, the opponents.ts "portraits cost zero new art" idiom:
    // your commander portrait is your deck's face card; the opponent's strip
    // avatar is their curated portraitCardId (gauntlet) or their deck's face.
    this.myDeckName = this.replayMode
      ? 'Replay Deck'
      : this.limited
        ? 'Draft Deck'
        : myDeckEntry?.name ?? STARTER_DECKS[0].name;
    // A deck-builder star is this specific deck's hero image. Limited/tutorial
    // deck overrides ignore saved-deck art; otherwise fall back to the old
    // premium/default hero behavior, then the active deck's derived face.
    const deckHero =
      !data.deckOverride && myDeckEntry?.heroCardId && CARD_DB[myDeckEntry.heroCardId] && myDeck.includes(myDeckEntry.heroCardId)
        ? myDeckEntry.heroCardId
        : null;
    const defaultHero = !deckHero && save.heroCardId && CARD_DB[save.heroCardId] ? save.heroCardId : null;
    this.myHeroTextureKey = deckHero ? null : this.resolveHeroPortrait(save);
    this.myFaceCardId = deckHero ?? defaultHero ?? faceCardFor(myDeck, CARD_DB);
    this.oppFaceCardId =
      this.opponent?.portraitCardId ?? this.limitedPersona?.portraitCardId ?? faceCardFor(aiDeck, CARD_DB);
    this.duel = new Game({
      decks: [myDeck, aiDeck],
      seed,
      db: CARD_DB,
      // The fixed tutorial scripts its opening and auto-keeps both hands.
      // Every normal duel path, including Limited and gauntlet, opts in.
      playDrawChoice: !this.tutorial,
    });
    const aiSeed = seed ^ 0x5eed;
    const personality = this.opponent?.personality ?? this.limitedPersona?.personality;
    this.ai = data.aiOverride ?? (this.gauntletRung !== null
      ? buildTierAI(floorTier(this.gauntletRung), CARD_DB, aiSeed, personality)
      : buildAI(this.difficulty, CARD_DB, aiSeed, personality));
    // Deterministic replay recording (1.2): every non-tutorial duel records
    // its inputs (seed + decks + every successful submit); the log persists
    // only when the duel completes (showResults). The tutorial is scripted
    // teaching, not a game worth reliving.
    this.replayDraft = this.replayMode || data.tutorial
      ? null
      : startReplayDraft({
          dbStamp: replayDbStamp(CARD_DB),
          seed,
          decks: [myDeck.slice(), aiDeck.slice()],
          context: {
            mode: this.limited ? 'limited' : this.gauntletRung != null ? 'gauntlet' : 'practice',
            difficulty: this.difficulty,
            opponentId: this.opponent?.id ?? null,
            opponentName: this.opponent?.name ?? this.limitedPersona?.name ?? `Practice AI (${this.difficulty})`,
            gauntletRung: this.gauntletRung,
          },
        });

    this.buildHud();
    this.bindHotkeys();
    if (this.replayMode) this.buildReplayControls();
    // Right-edge history slide-out + attack-FX renderer. Both are fresh per
    // create(); the old history auto-destroys on the scene SHUTDOWN it hooks,
    // and the old combatFx's objects/timers died with the previous scene. Built
    // BEFORE processEvents so the opening turnBegan lines land in the history.
    // A cardId'd history row taps through to the full-card inspect overlay.
    this.history = new HistoryPanel(this, (cardId) => this.showInspect(def(CARD_DB, cardId)));
    this.combatFx = new CombatFx(this);
    // No-op on gauntlet rung-to-rung restarts — the duel bed keeps flowing.
    Music.setMood('duel');
    // Soft click on any interactive object — cards, buttons, targets alike.
    this.input.on('gameobjectup', () => Sfx.play('click'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const ghost of this.playRevealGhosts) {
        this.tweens.killTweensOf(ghost);
        if (ghost.active) ghost.destroy();
      }
      this.playRevealGhosts.clear();
    });
    if (this.tutorial) {
      // The coach-mark guide layer is display-only until its scripted beat
      // opens each target; the HUD no longer exposes an auto-skip control.
      this.coach = new CoachMark(this);
    }
    this.processEvents(this.duel.initialEvents);
    if (this.tutorial) this.autoKeepTutorialMulligans();
    this.sync();
    this.maybeRunAI();
    this.maybeAutoSkip();
    if (this.replayMode) this.startReplayPlayback();
  }

  /**
   * Skip the opening-hand mulligan overlay in tutorial mode: keep both hands so
   * the duel starts at the first main phase (the mulligan is not one of the six
   * taught beats). Deterministic — the fixed seed already gave a keepable hand.
   */
  private autoKeepTutorialMulligans(): void {
    let guard = 0;
    while (this.duel.awaiting.kind === 'mulligan' && guard++ < 4) {
      const p = this.duel.awaiting.player;
      this.processEvents(this.duel.submit(p, { type: 'keepHand' }));
    }
  }

  // ---------------------------------------------------------------------
  // Tutorial coach-mark guide (src/data/tutorial.ts `tutorialCue`)
  // ---------------------------------------------------------------------

  /**
   * Advance the coach-mark guide off engine + selection state (never timers).
   * Called at the end of every `sync()`, so selection toggles, phase changes,
   * and AI moves all re-evaluate it. Info beats (goal / sickness / Ritual timing /
   * Charm timing) pause the guide on a tap-to-continue card; action beats
   * spotlight a live control.
   */
  private tutorialTick(): void {
    if (!this.tutorial || this.ended || this.tutCompleted || !this.coach) return;
    if (this.coachInfoActive) return; // waiting on a tap-to-continue info card
    const cue = tutorialCue(this.buildTutorialInput());
    switch (cue.kind) {
      case 'done':
        this.tutorialComplete(true);
        return;
      case 'wait':
        this.coach.hide();
        this.lockTutorialInput(null); // opponent acting — nothing is tappable
        return;
      case 'goal':
      case 'sickness':
      case 'inspectInfo':
      case 'healInfo':
      case 'ritualInfo':
      case 'charmInfo': {
        const kind = cue.kind;
        this.coachInfoActive = true;
        this.coach.hide();
        this.lockTutorialInput(null); // the info card owns the screen
        this.coach.showInfoCard(cue.text, () => {
          this.coachInfoActive = false;
          if (kind === 'goal') this.tutGoalShown = true;
          else if (kind === 'sickness') this.tutSicknessShown = true;
          else if (kind === 'inspectInfo') this.tutInspectShown = true;
          else if (kind === 'healInfo') this.tutHealInfoShown = true;
          else if (kind === 'ritualInfo') this.tutRitualInfoShown = true;
          else this.tutCharmInfoShown = true;
          this.tutorialTick();
        });
        return;
      }
      default: {
        const target = this.tutorialTarget(cue.kind);
        if (target) this.coach.showCue(target, cue.text);
        else this.coach.hide();
        this.lockTutorialInput(target); // only the spotlighted control stays live
      }
    }
  }

  /**
   * Deaden every duel control except `target` (the coach mark's spotlight), so
   * the player can only take the taught action. A board tile carries its input
   * on the tile's `inputZone`, not the tile object itself; a hand card / the
   * smart button ARE their own interactive object. `null` deadens everything.
   */
  private lockTutorialInput(target: Phaser.GameObjects.GameObject | null): void {
    const exempt = target instanceof BoardCardView ? (target.inputZone ?? null) : target;
    // Disabling a hovered object's input zone makes Phaser drop it from the
    // over-list WITHOUT firing pointerout, so any live hover-zoom preview would
    // stay stuck on screen. Clear it as we re-lock (the player can re-hover the
    // one live target); this runs on every beat change, never mid-read.
    this.zoom.cancel();
    this.tutorialGuard.close();
    this.tutorialGuard.open(this.overlayGuardTargets().filter((o) => o !== exempt));
  }

  private buildTutorialInput(): TutorialCueInput {
    const st = this.duel.state;
    const a = this.duel.awaiting;
    const isHumanTurn = 'player' in a && a.player === HUMAN;
    const you = st.players[HUMAN];
    const legal = isHumanTurn ? this.duel.legalActions(HUMAN) : [];
    const handHasLand = you.hand.some((id) => isType(def(CARD_DB, id), 'land'));
    const castableOfType = (t: import('../engine/types').CardType): boolean =>
      legal.some((l) => l.type === 'castSpell' && isType(def(CARD_DB, you.hand[l.handIndex]), t));
    const hasCastableCreature = castableOfType('creature');
    const hasCastableRitual = castableOfType('ritual');
    const hasCastableCharm = castableOfType('charm');
    const handHasCharm = you.hand.some((id) => isType(def(CARD_DB, id), 'charm'));
    const myCreatureCount = st.battlefield.filter(
      (p) => p.controller === HUMAN && isType(def(CARD_DB, p.cardId), 'creature'),
    ).length;
    const eligibleAttackerCount =
      isHumanTurn && a.kind === 'declareAttackers'
        ? eligibleAttackers(st.battlefield, CARD_DB, HUMAN).length
        : 0;
    const hasLegalBlocker =
      isHumanTurn && a.kind === 'declareBlockers' && st.combat
        ? blockOptions(st.battlefield, CARD_DB, HUMAN, st.combat).length > 0
        : false;
    return {
      isHumanTurn,
      awaitingKind: a.kind,
      step: st.step,
      landPlayedThisTurn: you.landPlayedThisTurn,
      handHasLand,
      hasCastableCreature,
      myCreatureCount,
      eligibleAttackerCount,
      attackerSelected: this.selectedAttackers.size > 0,
      pendingBlocker: this.pendingBlocker !== null,
      hasLegalBlocker,
      blockAssigned: this.blockAssignments.length > 0,
      isTouch: this.touch,
      hasCastableRitual,
      hasCastableCharm,
      handHasCharm,
      goalShown: this.tutGoalShown,
      sicknessShown: this.tutSicknessShown,
      inspectShown: this.tutInspectShown,
      healInfoShown: this.tutHealInfoShown,
      blocked: this.tutBlocked,
      ritualCast: this.tutRitualCast,
      ritualInfoShown: this.tutRitualInfoShown,
      charmCast: this.tutCharmCast,
      charmInfoShown: this.tutCharmInfoShown,
      safetyDone: st.turn >= 12,
    };
  }

  /** Resolve a cue to the live UI object it should spotlight (null = not ready). */
  private tutorialTarget(
    kind: TutorialCueKind,
  ): (Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle }) | null {
    const st = this.duel.state;
    switch (kind) {
      case 'playLand':
        return this.handTarget((d) => isType(d, 'land'));
      case 'playCreature':
        return this.castableHandTarget('creature');
      case 'castRitual':
        return this.castableHandTarget('ritual');
      case 'castCharm':
        return this.castableHandTarget('charm');
      case 'advance':
      case 'confirmAttack':
      case 'confirmBlock':
        return this.passArc;
      case 'selectAttacker': {
        const iid = eligibleAttackers(st.battlefield, CARD_DB, HUMAN)[0];
        return iid != null ? (this.views.get(iid) ?? null) : null;
      }
      case 'selectBlocker': {
        if (!st.combat) return null;
        const iid = blockOptions(st.battlefield, CARD_DB, HUMAN, st.combat)[0]?.blocker;
        return iid != null ? (this.views.get(iid) ?? null) : null;
      }
      case 'selectAttackerToBlock': {
        const iid = st.combat?.attackers[0];
        return iid != null ? (this.views.get(iid) ?? null) : null;
      }
      default:
        return null;
    }
  }

  /** First castable card of a given type in hand → its CardView. */
  private castableHandTarget(t: import('../engine/types').CardType): CardView | null {
    const castable = new Set(
      this.duel
        .legalActions(HUMAN)
        .filter((l): l is Extract<Action, { type: 'castSpell' }> => l.type === 'castSpell')
        .map((l) => l.handIndex),
    );
    return this.handTarget((d, handIdx) => castable.has(handIdx) && isType(d, t));
  }

  /** First hand card (in display order) matching a predicate → its CardView. */
  private handTarget(pred: (d: CardDef, handIdx: number) => boolean): CardView | null {
    const hand = this.duel.state.players[HUMAN].hand;
    const order = handDisplayOrder(hand, CARD_DB); // display pos → true hand index
    for (let pos = 0; pos < order.length; pos++) {
      const handIdx = order[pos];
      if (pred(def(CARD_DB, hand[handIdx]), handIdx)) return this.handViews[pos] ?? null;
    }
    return null;
  }

  /** Grant the reward (once), then route into the core loop. */
  private tutorialComplete(success: boolean): void {
    if (this.tutCompleted) return;
    this.tutCompleted = true;
    this.ended = true;
    this.tutorialGuard.close(); // hand the board back before the results overlay guards it
    this.coach?.destroy();
    this.coach = null;
    this.closeInspect();
    const save = Services.save.data;
    const firstTime = !save.tutorialDone;
    save.tutorialDone = true;
    if (firstTime) save.gold += ECONOMY.startingGold; // onboarding bonus (same on skip)
    Services.save.flush();
    Music.duck(1.8);
    Sfx.play(success ? 'win' : 'click');

    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(120);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setInteractive());
    c.add(
      this.add
        .text(width / 2, 244, success ? 'Tutorial Complete!' : 'Tutorial Ended', {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '52px', fontStyle: 'bold', color: '#ffd700',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 312, "You've got the basics. Now claim your free deck in the Shop.", {
          fontFamily: 'Inter, Arial, sans-serif', fontSize: '18px', color: '#c9bde0',
        })
        .setOrigin(0.5),
    );
    if (firstTime) {
      c.add(
        this.add
          .text(width / 2, 356, `+${ECONOMY.startingGold} gold`, {
            fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', fontStyle: '600', color: '#ffd88a',
          })
          .setOrigin(0.5),
      );
    }
    const mk = (x: number, label: string, cb: () => void): void => {
      const btn = this.add
        .text(x, 440, label, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '24px', color: '#ffd88a',
          backgroundColor: '#2c2344', padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, cb);
      inflateHitArea(btn, 90, 90);
      c.add(btn);
    };
    mk(width / 2 - 120, 'To the Shop', () => this.scene.start('Shop', { tab: 'decks' }));
    mk(width / 2 + 120, 'Main Menu', () => this.scene.start('MainMenu'));
    this.guard.open(this.overlayGuardTargets());
  }

  /** Stage dressing: the mirrored opponent and unchanged player zone plates. */
  private buildZones(): void {
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;

    // Backdrop first (docs/scene-art.md §3, strictest dim): the base gradient
    // is the fallback; every band plate/hairline/label below draws over the
    // backdrop unchanged. Added before the plate graphics, so display-list
    // order keeps the art under all of them — no setDepth needed.
    applyBackdrop(this, 'duel', {
      dim: theme.graphics.dim,
      dimAlpha: 0.45,
      fallback: () => {
        const base = this.add.graphics();
        base.fillGradientStyle(0x131022, 0x131022, 0x0a0812, 0x0a0812, 1);
        base.fillRect(0, 0, width, height);
      },
    });

    // A restrained stage light keeps the midfield from reading as a flat dim.
    // It is inserted after the backdrop but before the zone plates, so no
    // geometry or display-depth contract changes.
    this.add
      .ellipse(BOARD_CENTER_X, 300, 760, 430, colorInt(theme.colors.gold), 0.05)
      .setBlendMode(Phaser.BlendModes.SCREEN);

    const g = this.add.graphics();

    // Two inset battlefield zone plates: both stop at x1046 to leave a clean
    // right sidebar for phase and command controls. Yours a touch brighter.
    const plate = (x0: number, x1: number, y0: number, y1: number, fill: number, alpha: number): void => {
      g.fillGradientStyle(colorInt(theme.colors.panelStroke), colorInt(theme.colors.panelStroke), fill, fill, alpha);
      g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 10);
      g.lineStyle(1, colorInt(theme.colors.panelStroke), 0.7);
      g.strokeRoundedRect(x0, y0, x1 - x0, y1 - y0, 10);
    };
    plate(LAYOUT.oppZone.x0, LAYOUT.oppZone.x1, LAYOUT.oppZone.y0, LAYOUT.oppZone.y1, 0x1a1530, 0.45);
    plate(LAYOUT.myZone.x0, LAYOUT.myZone.x1, LAYOUT.myZone.y0, LAYOUT.myZone.y1, 0x1c1734, 0.5);
  }

  /**
   * The premium hero portrait texture to use, or null. Only when a hero is
   * selected AND its unlock deck is owned AND the bespoke art actually loaded —
   * any miss falls through to the card-based hero/face (never crashes the duel).
   */
  private resolveHeroPortrait(save: SaveData): string | null {
    const id = save.heroPortraitId;
    if (!id) return null;
    const h = heroById(id);
    if (!h) return null;
    if (!save.decks.some((d) => d.id === h.unlockDeckId)) return null;
    return this.textures.exists(h.textureKey) ? h.textureKey : null;
  }

  private matchupLabel(): string {
    if (this.replayMode && this.replayLog) {
      return `Replay · vs ${this.replayLog.context.opponentName}`;
    }
    if (this.opponent) {
      return `${this.gauntletRung ? `Rung ${this.gauntletRung} · ` : ''}vs ${this.opponent.name}`;
    }
    if (this.limited && this.limitedPersona) {
      return `Draft · Match ${this.limited.matchIndex + 1}/${LIMITED_MATCHES} · vs ${this.limitedPersona.name}`;
    }
    return `Practice · vs ${this.difficulty} AI`;
  }

  /** Replay context keeps its recorded display name even if the roster moves. */
  private avatarForReplay(id: string): Avatar | null {
    try {
      return avatarById(id);
    } catch {
      return null;
    }
  }

  private avatarForGauntletFloor(floor: number): Avatar {
    const rosterIndex = this.gauntletRosterOrder?.[floor - 1];
    return rosterIndex === undefined ? avatarForRung(floor) : (AVATARS[rosterIndex] ?? avatarForRung(floor));
  }

  private addLifeBadgePlate(x: number, y: number): void {
    const half = LIFE_BADGE_SIZE / 2;
    this.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 0.92)
      .fillRoundedRect(x - half, y - half, LIFE_BADGE_SIZE, LIFE_BADGE_SIZE, theme.radius.control)
      .lineStyle(1.5, colorInt(theme.colors.gold), theme.alpha.chrome)
      .strokeRoundedRect(x - half, y - half, LIFE_BADGE_SIZE, LIFE_BADGE_SIZE, theme.radius.control)
      .setDepth(theme.depth.hud);
  }

  private buildHud(): void {
    // --- Opponent mirror: pile-column hand/grave/deck, portrait, life, mana ---
    this.oppHandPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.handY, 'hand');
    this.oppGravePile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.graveY, 'grave', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(AI, 'graveyard');
      },
    });
    this.oppDeckPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.deckY, 'deck');
    this.oppSeveredPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.severedY, 'severed', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(AI, 'severed');
      },
    }).setVisible(SEVER_ENABLED);
    if (this.oppSeveredPile.inputZone) inflateHitArea(this.oppSeveredPile.inputZone, 90, 90);
    // --- Your piles: right column above Concede ---
    this.mySeveredPile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.severedY, 'severed', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(HUMAN, 'severed');
      },
    }).setVisible(SEVER_ENABLED);
    if (this.mySeveredPile.inputZone) inflateHitArea(this.mySeveredPile.inputZone, 90, 90);
    this.myDeckPile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.deckY, 'deck', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(HUMAN, 'deck');
      },
    });
    this.myGravePile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.graveY, 'grave', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(HUMAN, 'graveyard');
      },
    });
    // --- Commander portrait (1a): your deck's face card, reacts to the game ---
    this.portrait = new CommanderPortrait(this, LAYOUT.portrait.x, LAYOUT.portrait.y, {
      width: LAYOUT.portrait.w,
      height: LAYOUT.portrait.h,
      cardId: this.myFaceCardId,
      ...(this.myHeroTextureKey ? { textureKey: this.myHeroTextureKey } : {}),
      label: this.myDeckName,
    });
    this.oppPortrait = new CommanderPortrait(this, LAYOUT.oppPortrait.x, LAYOUT.oppPortrait.y, {
      width: LAYOUT.oppPortrait.w,
      height: LAYOUT.oppPortrait.h,
      edge: 'top',
      cardId: this.oppFaceCardId,
      label: this.replayLog?.context.opponentName ?? this.opponent?.name ?? this.limitedPersona?.name ?? `${this.difficulty} AI`,
    });
    this.addLifeBadgePlate(LAYOUT.myLife.x, LAYOUT.myLife.y);
    this.addLifeBadgePlate(LAYOUT.oppLife.x, LAYOUT.oppLife.y);

    const phaseRows = PHASE_TRACK_ROWS.map((row, i) => {
      const y = LAYOUT.phaseTrack.firstRowY + i * LAYOUT.phaseTrack.rowStep;
      const fill = this.add.graphics().setDepth(theme.depth.hud);
      const label = this.add
        .text(LAYOUT.phaseTrack.x, y, row, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(theme.depth.hudLabel);
      return { fill, label };
    });
    const turnPill = {
      fill: this.add.graphics().setDepth(theme.depth.hud),
      label: this.add
        .text(LAYOUT.turnPill.x, LAYOUT.turnPill.y, '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(theme.depth.hudLabel),
    };

    this.hud = {
      // Life totals are BURN TARGETS: depth 56 makes them win Phaser's
      // depth-first input sort over the portrait chrome below them.
      oppLife: this.add
        .text(LAYOUT.oppLife.x, LAYOUT.oppLife.y, '', {
          fontFamily: theme.fonts.display,
          fontSize: '22px',
          fontStyle: 'bold',
          color: theme.colors.dangerArmed,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(theme.depth.hud),
      myLife: this.add
        .text(LAYOUT.myLife.x, LAYOUT.myLife.y, '', {
          fontFamily: theme.fonts.display,
          fontSize: '22px',
          fontStyle: 'bold',
          color: theme.colors.success,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(theme.depth.hud),
      // --- Turn pill + phase track share the right sidebar column (all turn
      // info in one spot); the left rail retains only Undo. Decision guidance
      // lives in the smart button and CoachMark.
      turnPill,
      phaseRows,
      // --- Smart-button label (input is on passArc below). Depth 57: the
      // arc is created AFTER this Text at depth 56, and Phaser breaks depth
      // ties by insertion order — at equal depth the near-opaque disc would
      // paint OVER its own caption (adversarial-review major, 2026-07-04).
      button: this.add
        .text(LAYOUT.cluster.x, LAYOUT.cluster.passY, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '15px',
          fontStyle: '600',
          color: '#ffd88a',
          align: 'center',
          resolution: 2,
          wordWrap: { width: 84 },
        })
        .setOrigin(0.5)
        .setDepth(57),
    };
    this.stackDisplay = new StackDisplay(this, {
      x: LAYOUT.gap.stackX,
      y: LAYOUT.gap.stackY,
      cardFor: (cardId) => def(CARD_DB, cardId),
      casterLabel: (controller) => (controller === HUMAN ? 'You' : 'Opponent'),
      isTargetable: (sid) =>
        this.pendingCasts?.some((cast) =>
          cast.targets?.some((target) => target.kind === 'stackItem' && target.sid === sid),
        ) ?? false,
      onTarget: (sid) => this.tryTarget({ kind: 'stackItem', sid }),
    });
    // The circular smart button (1a "PASS"): the Arc carries the input, the
    // label Text above it never does — so relabeling via setText can't hit the
    // Text.updateText hit-area trap, and the circle's default 92×92 hit rect
    // already meets the 90px touch floor without inflation.
    this.passArc = this.add
      .circle(LAYOUT.cluster.x, LAYOUT.cluster.passY, LAYOUT.cluster.passR, 0x2c2344, 0.95)
      .setStrokeStyle(2.5, 0xffd88a, 0.9)
      // With the End Turn chip and skip toast family: above arrows (50) and
      // the stack cards (55) are separate from this control, but keeping the control
      // cluster's established depth (56) keeps the ladder simple.
      .setDepth(56)
      .setInteractive({ useHandCursor: true });
    // Right-release must never trigger the smart-button action: during
    // targeting the scene-level pointerdown below has ALREADY cancelled by
    // release time, so an ungated pointerup would fall through to
    // passStep/passResponse. (Touch pointers report button 0, so the gate
    // passes for taps.)
    bindTapButton(this, this.passArc, (p) => {
      if (p.rightButtonReleased()) return;
      this.onButton();
    });
    // life totals are targetable (burn to the face)
    for (const [text, player] of [
      [this.hud.myLife, HUMAN],
      [this.hud.oppLife, AI],
    ] as const) {
      text.setInteractive({ useHandCursor: true });
      bindTapButton(this, text, () => this.tryTarget({ kind: 'player', player }));
    }
    // Hit inflation (mobile-lan-plan §1.4). Life totals meet the 44px floor; the
    // Stack cards use CardView's child Zone and never make a scaled Container
    // interactive. Life totals use inflated text hit areas. The smart button
    // needs none: the Arc's hit rect is static.
    inflateHitArea(this.hud.myLife, 44, 44);
    inflateHitArea(this.hud.oppLife, 44, 44);
    // Right-click cancels targeting. Test the INITIATING button (p.button),
    // not rightButtonDown() — that's a live bitmask, true for a chorded LEFT
    // press while the right button happens to be held.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 2 && this.pendingCasts) {
        this.pendingCasts = null;
        this.sync();
      }
    });

    // ⚙ Menu: opens the in-game pause overlay (Resume · quick toggles ·
    // Concede). Replaces the always-on corner Concede text — concede now lives
    // one tap deeper in the menu, decluttering the board HUD (playtest
    // feedback). Same inboard corner spot (audited off the edge-gesture zone).
    this.menuBtn = this.add
      .text(1206, 688, '⚙ Menu', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '12px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.menuBtn, (p) => {
      if (p.rightButtonReleased()) return; // right-click is inspect/cancel
      this.showPauseMenu();
    });
    inflateHitArea(this.menuBtn, 90, 90);

    // Auto-skip notice: floats in the gap between the two zone plates.
    // Strictly NON-interactive — never setInteractive'd, so there is no Text
    // hit-area bookkeeping to go stale on setText. Chained skips replace it
    // in place.
    this.skipText = this.add
      .text(BOARD_CENTER_X, LAYOUT.gap.cy, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: theme.colors.gold,
        backgroundColor: theme.colors.panelFill,
        padding: { x: 10, y: 5 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(theme.depth.toast)
      .setAlpha(0);

    // Feature 2 — "⏭ End Turn" quick button: fast-forwards the rest of your turn
    // (see startEndTurn). Sits in the right cluster below the smart button
    // (smart rect ends 582 / End Turn starts 594 — the 12px compact-cluster
    // gap from design-system.md interactive isolation, and the inflated
    // target bottoms out exactly on the 684 title-safe line); only
    // shown during your own main phases (syncButton toggles it).
    this.endTurnBtn = this.add
      .text(LAYOUT.cluster.x, LAYOUT.cluster.endTurnY, '⏭ End Turn', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#e8def7',
        backgroundColor: '#3a2f5c',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setVisible(false)
      // Above targeting/block arrows (50) and the stack readout (55), below the
      // skip toast (80) and modal overlays (>=100).
      .setDepth(56)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.endTurnBtn, (p) => {
      if (p.rightButtonReleased()) return;
      this.startEndTurn();
    });
    inflateHitArea(this.endTurnBtn, 90, 90);

    // Undo (F11): take back your last committed action while it's still your
    // decision — before priority passes to the AI or combat animates. It is
    // the left rail's only control besides the turn pill.
    this.undoBtn = this.add
      .text(52, 410, '↶ Undo', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#e8def7',
        backgroundColor: '#3a2f5c',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.undoBtn, (p) => {
      if (p.rightButtonReleased()) return;
      this.undoLastAction();
    });
    inflateHitArea(this.undoBtn, 90, 90);

    // Combat forecast (F12): the 12px caption plus 4px total vertical
    // padding is centered in the 34px gap between the creature tile bounds.
    // Even the 1.1x lethal pulse stays between opponent y=285 and player y=319.
    this.combatPreviewText = this.add
      .text(640, LAYOUT.gap.cy, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: `${theme.type.caption}px`,
        fontStyle: '600',
        color: theme.colors.body,
        backgroundColor: theme.colors.panelFill,
        padding: { x: 10, y: 2 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(theme.depth.hud)
      .setVisible(false);

  }

  // ---------------------------------------------------------------------
  // Read-only replay viewer
  // ---------------------------------------------------------------------

  private buildReplayControls(): void {
    const bar = this.add.container(0, 0).setDepth(theme.depth.results + 10);
    bar.add(
      this.add
        .graphics()
        .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
        .fillRoundedRect(332, 36, 616, 50, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
        .strokeRoundedRect(332, 36, 616, 50, theme.radius.panel),
    );
    bar.add(
      this.add
        .text(366, 61, 'Replay', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0.5),
    );
    this.replayPlayButton = themedButton(this, 492, 61, 'Pause', {
      variant: 'primary',
      size: 'sm',
      minWidth: 92,
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.setReplayPlaying(!this.replayPlaying);
      },
    });
    this.replaySpeedButton = themedButton(this, 640, 61, 'Speed x1', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 104,
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.cycleReplaySpeed();
      },
    });
    const step = themedButton(this, 568, 61, 'Step', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 64,
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.stepReplayAction();
      },
    });
    const exit = themedButton(this, 824, 61, 'Exit', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 82,
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.exitReplayViewer();
      },
    });
    bar.add([this.replayPlayButton.container, step.container, this.replaySpeedButton.container, exit.container]);
    this.replayControls = bar;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.replayTimer?.remove(false);
      this.replayTimer = null;
      this.replayPlaying = false;
      this.replayGuard.close();
    });
  }

  private startReplayPlayback(): void {
    if (!this.replayMode || !this.replayLog) return;
    this.setReplayPlaying(true);
  }

  private setReplayPlaying(playing: boolean): void {
    if (!this.replayMode || this.replayOutcome) return;
    this.replayPlaying = playing;
    if (!playing) {
      this.replayTimer?.remove(false);
      this.replayTimer = null;
    } else {
      this.scheduleReplayAction(450);
    }
    this.replayPlayButton?.setLabel(playing ? 'Pause' : 'Play');
  }

  private cycleReplaySpeed(): void {
    this.replaySpeed = this.replaySpeed === 1 ? 2 : this.replaySpeed === 2 ? 4 : 1;
    this.replaySpeedButton?.setLabel(`Speed x${this.replaySpeed}`);
  }

  private stepReplayAction(): void {
    if (!this.replayMode || this.replayOutcome) return;
    this.setReplayPlaying(false);
    this.replayAdvance();
  }

  private replayDelay(): number {
    return 850 / this.replaySpeed;
  }

  private scheduleReplayAction(delay = this.replayDelay()): void {
    if (!this.replayMode || !this.replayPlaying || this.replayOutcome || this.ended || this.animatingCombat) return;
    if (this.replayTimer) return;
    this.replayTimer = this.time.delayedCall(delay, () => {
      this.replayTimer = null;
      this.replayAdvance();
    });
  }

  /** Submit exactly the next recorded action, preserving the normal event path. */
  private replayAdvance(): void {
    if (!this.replayMode || !this.replayLog || this.replayOutcome || this.ended || this.animatingCombat) return;
    const step = this.replayLog.actions[this.replayCursor];
    if (!step) {
      this.completeReplayPlayback();
      return;
    }
    this.replayCursor += 1;
    try {
      this.humanPlayOrigin = null;
      if (step.p === HUMAN && (step.a.type === 'playLand' || step.a.type === 'castSpell')) {
        const playedCard = def(CARD_DB, this.duel.state.players[HUMAN].hand[step.a.handIndex]);
        const playedSource = this.handOrigin(step.a.handIndex);
        if (playedSource) this.humanPlayOrigin = { cardId: playedCard.id, source: playedSource };
      }
      const events = this.duel.submit(step.p, step.a);
      this.undoSnapshot = null;
      this.selectedAttackers.clear();
      this.blockAssignments = [];
      this.pendingBlocker = null;
      this.pendingCasts = null;
      this.processEvents(events);
      this.afterEvents();
    } catch {
      this.failReplayPlayback();
    }
  }

  private finishReplayPlayback(message: string): void {
    if (!this.replayMode || this.replayOutcome) return;
    this.stopReplayPlayback();
    this.ended = true;
    this.closeInspect();
    this.zoom.setSuppressed(true);
    this.sync();
    const shell = modalShell(this, {
      width: 460,
      height: message === 'Replay complete' ? 170 : 220,
      dimAlpha: 0.78,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.results,
    });
    const c = shell.container;
    c.add(
      this.add
        .text(640, message === 'Replay complete' ? 320 : 300, message, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5),
    );
    if (message !== 'Replay complete') {
      c.add(
        this.add
          .text(640, 350, 'This replay was recorded on an older version.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            align: 'center',
            wordWrap: { width: 390 },
          })
          .setOrigin(0.5),
      );
    }
    const exit = themedButton(this, 640, message === 'Replay complete' ? 390 : 420, 'Exit', {
      variant: 'primary',
      minWidth: 140,
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.exitReplayViewer();
      },
    });
    c.add(exit.container);
    this.replayOutcome = c;
  }

  private completeReplayPlayback(): void {
    this.finishReplayPlayback('Replay complete');
  }

  private failReplayPlayback(): void {
    this.finishReplayPlayback('Replay unavailable');
  }

  private stopReplayPlayback(): void {
    this.replayPlaying = false;
    this.replayTimer?.remove(false);
    this.replayTimer = null;
    this.replayGuard.close();
    this.replayPlayButton?.setLabel('Play');
  }

  private exitReplayViewer(): void {
    if (!this.replayMode) return;
    this.stopReplayPlayback();
    this.replayOutcome?.destroy();
    this.replayOutcome = null;
    this.scene.start('Profile');
  }

  // ---------------------------------------------------------------------
  // Action submission + AI loop
  // ---------------------------------------------------------------------

  private isHumanTurnDecision(): boolean {
    const a = this.duel.awaiting;
    return 'player' in a && a.player === HUMAN;
  }

  private act(action: Action): void {
    if (this.replayMode || this.ended) return;
    if (this.animatingCombat) return; // swallow input while a combat sequence plays
    try {
      const playedCard =
        action.type === 'playLand' || action.type === 'castSpell'
          ? def(CARD_DB, this.duel.state.players[HUMAN].hand[action.handIndex])
          : null;
      const playedSource =
        action.type === 'playLand' || action.type === 'castSpell'
          ? this.handOrigin(action.handIndex)
          : undefined;
      this.humanPlayOrigin = playedCard && playedSource ? { cardId: playedCard.id, source: playedSource } : null;
      const snapshot = this.duel.clone(); // pre-action state; kept for Undo iff still local
      // Tutorial: note which taught spell/beat this action is BEFORE it resolves
      // (a cast card leaves the hand on submit), so the guide can advance.
      if (this.tutorial && action.type === 'castSpell') {
        const types = def(CARD_DB, this.duel.state.players[HUMAN].hand[action.handIndex]).types;
        if (types.includes('ritual')) this.tutRitualCast = true;
        if (types.includes('charm')) this.tutCharmCast = true;
      }
      const events = this.duel.submit(HUMAN, action);
      if (this.replayDraft) recordReplayAction(this.replayDraft, HUMAN, action);
      if (this.tutorial && action.type === 'declareBlockers' && action.blocks.length > 0) {
        this.tutBlocked = true;
      }
      this.undoSnapshot = snapshot;
      this.selectedAttackers.clear();
      this.blockAssignments = [];
      this.pendingBlocker = null;
      this.pendingCasts = null;
      this.processEvents(events);
      this.afterEvents();
    } catch (err) {
      this.log(String((err as Error).message));
    }
  }

  /** New Wave-1 motion obeys the same save setting as combat sequencing. */
  private motionLevel(): 'full' | 'reduced' | 'off' {
    return Services.save.data.settings.animations;
  }

  /** Capture the displayed fan card before syncHand destroys it; hover transforms count. */
  private handOrigin(handIndex: number): { x: number; y: number; scale: number; angle: number } | undefined {
    const displayIndex = handDisplayOrder(this.duel.state.players[HUMAN].hand, CARD_DB).indexOf(handIndex);
    const view = displayIndex < 0 ? undefined : this.handViews[displayIndex];
    if (view?.active) return { x: view.x, y: view.y, scale: view.scaleX, angle: view.angle };
    return this.handPoses.get(handIndex);
  }

  /** Restore the pre-action snapshot and reset scene-side selection state. */
  private undoLastAction(): void {
    if (!this.undoSnapshot || this.ended || this.animatingCombat) return;
    this.duel = this.undoSnapshot;
    this.undoSnapshot = null;
    // The undone submit must leave the replay too — the tail is that action
    // by contract (undo dies the moment priority reaches the AI).
    if (this.replayDraft) undoReplayAction(this.replayDraft, HUMAN);
    // Mirror the scene-side state act() clears, so no stale selection survives.
    this.selectedAttackers.clear();
    this.blockAssignments = [];
    this.pendingBlocker = null;
    this.pendingCasts = null;
    this.sync();
  }

  /** Undo is offered only while the snapshot is valid and it is your decision. */
  private syncUndoButton(): void {
    this.undoBtn.setVisible(
      !this.ended && !this.animatingCombat && this.undoSnapshot !== null && this.isHumanTurnDecision(),
    );
  }

  /** F12: live combat-damage forecast while you assign blocks (you are defending). */
  private syncCombatPreview(): void {
    const st = this.duel.state;
    const a = this.duel.awaiting;
    if (a.kind !== 'declareBlockers' || !('player' in a) || a.player !== HUMAN || !st.combat) {
      this.combatPreviewText.setVisible(false);
      this.forecastWasLethal = false;
      return;
    }
    const preview = previewCombat(st, CARD_DB, this.blockAssignments);
    const dmg = -preview.lifeDelta[HUMAN];
    const yoursDie = preview.deaths.filter(
      (iid) => st.battlefield.find((p) => p.iid === iid)?.controller === HUMAN,
    ).length;
    const theirsDie = preview.deaths.length - yoursDie;
    const lethal = preview.defenderLethal;
    this.combatPreviewText
      .setText(combatForecastCopy({ damage: dmg, enemyDeaths: theirsDie, yourDeaths: yoursDie, lethal }))
      .setColor(lethal ? theme.colors.dangerArmed : theme.colors.body)
      .setVisible(true);
    if (lethal && !this.forecastWasLethal && this.motionLevel() !== 'off') {
      this.tweens.killTweensOf(this.combatPreviewText);
      this.combatPreviewText.setScale(1);
      this.tweens.add({
        targets: this.combatPreviewText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.combatPreviewText.active) this.combatPreviewText.setScale(1);
        },
      });
    }
    this.forecastWasLethal = lethal;
  }

  private pulseLife(text: Phaser.GameObjects.Text, delta: number, baseColor: string): void {
    if (delta === 0 || this.motionLevel() === 'off') return;
    this.tweens.killTweensOf(text);
    text.setScale(1).setColor(delta > 0 ? theme.colors.success : theme.colors.danger);
    this.tweens.add({
      targets: text,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (text.active) text.setScale(1).setColor(baseColor);
      },
    });
  }

  private syncTurnPill(turn: number, yours: boolean): void {
    const label = this.hud.turnPill.label;
    const fill = this.hud.turnPill.fill;
    label.setText(turn === 0 ? '' : `T${turn}`);
    label.setColor(yours ? theme.colors.gold : theme.colors.body);
    const w = Math.max(52, label.width + 22);
    fill.clear();
    fill.fillStyle(theme.graphics.rowFillActive, 1);
    fill.fillRoundedRect(LAYOUT.turnPill.x - w / 2, LAYOUT.turnPill.y - 14, w, 28, theme.radius.control);
    fill.lineStyle(1, colorInt(yours ? theme.colors.gold : theme.colors.muted), 0.9);
    fill.strokeRoundedRect(LAYOUT.turnPill.x - w / 2, LAYOUT.turnPill.y - 14, w, 28, theme.radius.control);
  }

  private syncPhaseTrack(row: PhaseTrackRow | null, yours: boolean): void {
    for (const entry of this.hud.phaseRows) {
      const active = entry.label.text === row;
      entry.fill.clear();
      if (active) {
        entry.fill.fillStyle(theme.graphics.rowFillActive, 1);
        entry.fill.fillRoundedRect(LAYOUT.phaseTrack.x - 54, entry.label.y - 12, 108, 24, theme.radius.control);
        entry.fill.lineStyle(1, colorInt(yours ? theme.colors.gold : theme.colors.muted), 0.9);
        entry.fill.strokeRoundedRect(LAYOUT.phaseTrack.x - 54, entry.label.y - 12, 108, 24, theme.radius.control);
      }
      entry.label.setColor(active ? theme.colors.gold : theme.colors.muted);
    }
    const changed = this.previousPhaseRow !== null && this.previousPhaseRow !== row;
    this.previousPhaseRow = row;
    if (!changed || !row || this.motionLevel() === 'off') return;
    const active = this.hud.phaseRows.find((entry) => entry.label.text === row)?.label;
    if (!active) return;
    this.tweens.killTweensOf(active);
    active.setX(LAYOUT.phaseTrack.x + 8).setAlpha(0);
    this.tweens.add({
      targets: active,
      x: LAYOUT.phaseTrack.x,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (active.active) active.setX(LAYOUT.phaseTrack.x).setAlpha(1);
      },
    });
  }

  /**
   * Run the post-batch board sync + follow-ups — UNLESS a combat sequence is
   * animating, in which case the sequence's finish runs them (finishStep) once
   * every attacker has struck. This is the single seam that lets sequenced
   * combat defer the board update without the act loop knowing the details.
   */
  private afterEvents(): void {
    if (this.animatingCombat) return;
    this.finishStep();
  }

  /** Board sync + AI/auto-skip/end-turn; `ended` narrates a combat-deferred game end. */
  private finishStep(ended?: GameEvent): void {
    this.sync();
    this.flushPlayReveals();
    if (ended) this.narrateEvent(ended);
    if (this.replayMode) {
      this.scheduleReplayAction();
      return;
    }
    this.maybeRunAI();
    this.maybeAutoSkip();
    this.endTurnTick();
  }

  /** In targeting mode: try to complete the pending cast with this target. */
  private tryTarget(ref: import('../engine/types').TargetRef): void {
    if (!this.pendingCasts) return;
    const matches = this.pendingCasts.filter((c) => {
      const t = c.targets?.[0];
      if (!t) return false;
      if (t.kind !== ref.kind) return false;
      if (t.kind === 'permanent' && ref.kind === 'permanent') return t.iid === ref.iid;
      if (t.kind === 'player' && ref.kind === 'player') return t.player === ref.player;
      if (t.kind === 'stackItem' && ref.kind === 'stackItem') return t.sid === ref.sid;
      if (t.kind === 'grave' && ref.kind === 'grave')
        return t.player === ref.player && t.index === ref.index;
      return false;
    });
    if (matches.length === 0) return;
    // For X spells pick the biggest X the mana allows.
    const best = matches.reduce((a, b) => ((a.x ?? 0) >= (b.x ?? 0) ? a : b));
    this.act(best);
  }

  private maybeRunAI(): void {
    if (this.replayMode || this.ended) return;
    if (this.animatingCombat) return; // wait out a combat sequence; finishStep resumes us
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== AI) return;
    // The opening modal owns the reveal/result cadence, then submits the AI's
    // choice. Normal AI pacing resumes at the first mulligan decision.
    if (a.kind === 'choosePlayDraw') return;
    this.undoSnapshot = null; // priority has left you — the local Undo is no longer valid
    if (this.aiTimer) return;
    this.aiTimer = this.time.delayedCall(400, () => {
      this.aiTimer = null;
      if (this.ended || this.animatingCombat) return;
      const aw = this.duel.awaiting;
      if (!('player' in aw) || aw.player !== AI) return;
      const action = this.ai.chooseAction(this.duel.viewFor(AI), this.duel.legalActions(AI));
      const events = this.duel.submit(AI, action);
      if (this.replayDraft) recordReplayAction(this.replayDraft, AI, action);
      this.processEvents(events);
      // Deferred through afterEvents so the AI's combat damage animates before
      // its next decision (its declareAttackers still drives your blockers).
      this.afterEvents();
    });
  }

  /**
   * Auto-skip a decision that offers the human no real choice (engine
   * forcedAction): a main phase with nothing playable, declare-attackers with
   * no able attacker, declare-blockers with no legal blocker. Runs at every
   * point maybeRunAI does. Chains (skip main1 → skip combat → skip main2)
   * pace themselves one hop per delayedCall so the player can read the phases
   * ticking by; each hop re-reads the awaiting decision fresh and terminates
   * at the next real decision naturally.
   */
  private maybeAutoSkip(): void {
    if (this.replayMode || this.tutorial) return; // the coach-mark guide drives pacing explicitly
    if (this.endingTurn) return; // end-turn mode drives its own hops (endTurnTick)
    if (!Services.save.data.settings.autoSkip) return; // settings toggle (SettingsScene)
    if (this.ended) return;
    if (this.animatingCombat) return; // hold until the combat sequence finishes
    if (this.autoSkipTimer) return; // a hop is already scheduled
    if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay || this.zoneModal) return;
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return;
    if (a.kind === 'foresee') return; // mandatory revealed-card pick; never auto-skip
    if (!forcedAction(this.duel.state, CARD_DB, HUMAN)) return;
    this.autoSkipTimer = this.time.delayedCall(300, () => {
      this.autoSkipTimer = null;
      if (this.ended) return;
      if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay || this.zoneModal) return;
      const awaiting = this.duel.awaiting;
      if (!('player' in awaiting) || awaiting.player !== HUMAN) return;
      if (awaiting.kind === 'foresee') return; // re-check after the delay
      // Re-evaluate fresh — the state may have moved while we waited (e.g.
      // the player clicked the smart button during the delay).
      const forced = forcedAction(this.duel.state, CARD_DB, HUMAN);
      if (!forced) return;
      this.showSkipNotice(this.skipMessage(forced));
      // Mark the transition so a near-simultaneous smart-button click (already in
      // flight for the pre-hop decision) is swallowed rather than applied to
      // the decision this skip is about to advance into.
      this.lastAutoSkipAt = this.time.now;
      this.act(forced); // act() re-runs maybeAutoSkip: chains continue hop by hop
    });
  }

  private skipMessage(forced: Action): string {
    switch (forced.type) {
      case 'passStep':
        return 'Main phase skipped (no playable cards)';
      case 'declareAttackers':
        return 'Combat skipped (no able attackers)';
      case 'declareBlockers':
        return 'No blockers available';
      default:
        return 'Phase skipped';
    }
  }

  /** Transient auto-skip toast in the zone-plate gap + a mirrored log line. */
  private showSkipNotice(msg: string): void {
    this.log(msg);
    const t = this.skipText;
    if (!t.active) return; // scene teardown raced the timer
    this.tweens.killTweensOf(t);
    t.setText(msg).setAlpha(1);
    this.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 400, ease: 'Cubic.easeIn' });
  }

  // ---------------------------------------------------------------------
  // End-turn fast-forward (feature 2, "⏭ End Turn")
  // ---------------------------------------------------------------------

  /** Enter end-turn mode: fast-forward the rest of your turn (see endTurnTick). */
  private startEndTurn(): void {
    if (this.ended || !this.isHumanTurnDecision()) return;
    if (this.pendingCasts || this.overlay || this.inspect || this.pauseOverlay || this.zoneModal) return;
    this.endingTurn = true;
    this.log('Ending turn…');
    this.endTurnTick();
  }

  /**
   * Drive the end-turn mode one hop at a time. Auto-passes every trivial human
   * decision on your turn, but PAUSES (leaving the mode ARMED) at a
   * declare-attackers where you still have eligible attackers — your chosen
   * "stop if I can attack" behavior — and at any mandatory pick. It resumes
   * automatically because it runs at every point maybeAutoSkip does (act,
   * maybeRunAI, closeInspect). Clears the mode when the turn flips to the AI,
   * the game ends, or there is genuinely no pass action left.
   */
  private endTurnTick(): void {
    if (!this.endingTurn) return;
    if (this.ended) {
      this.endingTurn = false;
      return;
    }
    if (this.animatingCombat) return; // paused during a combat sequence; finishStep resumes
    if (this.endTurnTimer) return; // a hop is already scheduled
    // Turn handed to the opponent — end-turn is complete.
    if (this.duel.state.activePlayer !== HUMAN) {
      this.endingTurn = false;
      return;
    }
    // Overlays / targeting / an opponent sub-decision: wait, stay armed, resume.
    if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay || this.zoneModal) return;
    if (!this.isHumanTurnDecision()) return;
    if (!this.endTurnPassAction()) return; // pause at a decision needing real input
    this.endTurnTimer = this.time.delayedCall(180, () => {
      this.endTurnTimer = null;
      if (!this.endingTurn || this.ended) {
        this.endingTurn = false;
        return;
      }
      // Re-check fresh — the player may have opened an overlay during the wait.
      if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay || this.zoneModal) return;
      if (!this.isHumanTurnDecision()) return;
      const action = this.endTurnPassAction();
      if (!action) return;
      this.act(action); // act() re-runs endTurnTick: the chain continues hop by hop
    });
  }

  /**
   * The pass action for the current human decision while ending the turn, or
   * null to STOP-AND-WAIT (a declare-attackers you could act on, or a mandatory
   * pick like foresee/discard/bottom/mulligan). Blockers never arise on your own turn.
   */
  private endTurnPassAction(): Action | null {
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return null;
    switch (a.kind) {
      case 'main':
        return { type: 'passStep' };
      case 'declareAttackers':
        // End Turn is an explicit "skip the rest of my turn" — decline combat
        // outright (user-directed 2026-07-10; the old stop-if-I-can-attack
        // pause made End Turn strand at the combat decision).
        this.selectedAttackers.clear();
        return { type: 'declareAttackers', attackers: [] };
      case 'respond':
      case 'endStepWindow':
        return { type: 'passResponse' };
      default:
        return null; // mulligan / bottomCards / foresee / discardToHandSize → stop for input
    }
  }

  // ---------------------------------------------------------------------
  // Event narration: floats + log line
  // ---------------------------------------------------------------------

  /**
   * Play back one event batch. A batch that lands combat damage is choreographed
   * attacker-by-attacker (playCombatSequence) at `animations: 'full'`; every
   * other batch — and reduced/off motion — narrates instantly, one event at a
   * time (the pre-sequencing behavior).
   */
  private processEvents(events: GameEvent[]): void {
    if (!this.replayMode && !this.tutorial && events.length > 0) {
      const progress = applyDailyQuestProgress(Services.save.data, CARD_DB, events, todayString());
      if (progress.changed) Services.save.touch();
    }
    const sequence =
      Services.save.data.settings.animations === 'full' &&
      !this.animatingCombat &&
      events.some((e) => e.e === 'combatDamage' && e.hits.length > 0);
    if (sequence) {
      this.playCombatSequence(events);
      return;
    }
    for (const e of events) this.narrateEvent(e, events);
  }

  /** Narrate a single event: SFX, floats, log, portrait reactions, attack FX. */
  private narrateEvent(e: GameEvent, batch: readonly GameEvent[] = []): void {
    switch (e.e) {
      case 'coinFlipped':
        // The seeded winner is known to the engine, but the player has not
        // called a side yet. The overlay logs the result only after reveal.
        break;
      case 'playDrawChosen':
        this.log(
          `${e.player === HUMAN ? 'You' : 'Opponent'} won the flip and chose to ${e.play ? 'play' : 'draw'} first`,
        );
        break;
      case 'lifeChanged': {
        if (e.delta < 0) Sfx.play('lifeLoss');
        // Spawn near the owner's life total (floats draw at depth 90, so
        // they read over the strip/portrait as they drift up and fade).
        const pos = e.player === HUMAN
          ? { x: LAYOUT.myLife.x, y: LAYOUT.myLife.y - 32 }
          : { x: LAYOUT.oppLife.x, y: LAYOUT.oppLife.y - 32 };
        this.float(
          pos.x,
          pos.y,
          `${e.delta > 0 ? '+' : ''}${e.delta}`,
          e.delta > 0 ? theme.colors.success : theme.colors.dangerArmed,
        );
        // Both mirrored commander frames react to their controller's pain.
        if (e.player === HUMAN && e.delta < 0) this.portrait.reactDamage();
        if (e.player === AI && e.delta < 0) this.oppPortrait.reactDamage();
        break;
      }
      case 'damageMarked': {
        Sfx.play('hit');
        const v = this.views.get(e.iid);
        if (v) this.float(v.x, v.y - 56, `-${e.amount}`, '#ffb04a');
        break;
      }
      case 'died': {
        Sfx.play('death');
        const v = this.views.get(e.iid);
        if (v) {
          const who = e.owner === HUMAN ? 'Your' : 'Enemy';
          this.log(`${who} ${this.cardRef(e.cardId)} died`, e.cardId);
        }
        break;
      }
      case 'spellCast': {
        Sfx.play('cast');
        // Targeted casts name their targets; the row's tappable card stays the
        // CAST card (the target names are informational, not extra links).
        const at = this.spellTargetsText(e.targets, batch);
        this.log(`${e.controller === HUMAN ? 'You cast' : 'Opponent casts'} ${this.cardRef(e.cardId)}${at}`, e.cardId);
        const entered = batch.find(
          (candidate): candidate is Extract<GameEvent, { e: 'permanentEntered' }> =>
            candidate.e === 'permanentEntered' &&
            candidate.perm.cardId === e.cardId &&
            candidate.perm.controller === e.controller,
        );
        this.queuePlayReveal(e.cardId, e.controller, entered?.perm.iid);
        if (e.controller === HUMAN) this.portrait.reactCast();
        else this.oppPortrait.reactCast();
        break;
      }
      case 'spellCountered':
        this.log('Spell cancelled!');
        break;
      case 'targetsFizzled':
        this.log('Spell fizzled (no legal targets)');
        break;
      case 'landPlayed':
        Sfx.play('land');
        this.queuePlayReveal(e.cardId, e.player, e.iid);
        if (e.player === AI) this.log(`Opponent plays ${this.cardRef(e.cardId)}`, e.cardId);
        break;
      case 'manaTapped':
        // Event-time rotation makes mana-creature payment visible immediately,
        // including on touch where there was no hover plan. The following sync
        // sees the same tapped state and early-outs instead of restarting it.
        this.clearManaPlanPreview();
        for (const iid of e.iids) this.views.get(iid)?.setTapped(true);
        break;
      case 'attackersDeclared': {
        if (e.iids.length > 0) Sfx.play('attack');
        this.log(`${this.duel.state.activePlayer === HUMAN ? 'You attack' : 'Opponent attacks'} with ${e.iids.length}`);
        // Lunge each attacker toward the enemy side (up for you, down for AI).
        const dir: -1 | 1 = this.duel.state.activePlayer === HUMAN ? -1 : 1;
        for (const iid of e.iids) {
          const v = this.views.get(iid);
          if (v) this.combatFx.lunge(v, dir);
        }
        break;
      }
      case 'combatDamage': {
        // Instant path (reduced/off motion): themed impact FX per hit, all at
        // once. Source card comes from the tile view (still in this.views this
        // batch, even if the attacker dies next), so a creature that dies
        // dealing damage still gets its flourish.
        for (const hit of e.hits) {
          const srcView = this.views.get(hit.source);
          if (!srcView) continue;
          this.combatFx.strike({ x: srcView.x, y: srcView.y }, this.hitTargetPos(hit.target), srcView.card);
        }
        break;
      }
      case 'severed': {
        // All sever destinations are public (the card lands in the on-board
        // severed pile), so naming the card is safe for either player. A
        // deck sever reveals the top card by moving it there; say so.
        const whose = e.player === HUMAN ? 'your' : "the opponent's";
        if (e.from === 'graveyard') {
          this.log(`${this.cardRef(e.cardId)} severed from ${whose} graveyard`, e.cardId);
        } else if (e.from === 'deck') {
          this.log(`${this.cardRef(e.cardId)} severed from the top of ${whose} deck`, e.cardId);
        } else {
          this.log(`${e.player === HUMAN ? 'Your' : 'Enemy'} ${this.cardRef(e.cardId)} was severed`, e.cardId);
        }
        this.showSeverTravel(e);
        break;
      }
      case 'foresaw': {
        // Visible-information rule: the human saw their own foreseen cards in
        // the overlay, so their lines may name cards; the opponent's foresee
        // logs counts only. The event carries identities for both players
        // (events.ts contract: the presenter redacts), so this branch is the
        // wall that keeps the CPU's card names out of the history text.
        if (e.player === HUMAN) {
          for (const cardId of e.kept) this.log(`Foresee: ${this.cardRef(cardId)} stays on top`, cardId);
          for (const cardId of e.bottomed) this.log(`Foresee: ${this.cardRef(cardId)} goes to the bottom`, cardId);
        } else {
          const total = e.kept.length + e.bottomed.length;
          const tail = e.bottomed.length === 0
            ? 'kept all on top'
            : `put ${e.bottomed.length} on the bottom`;
          this.log(`Opponent foresaw ${total}, ${tail}`);
        }
        break;
      }
      case 'chapterAdvanced':
        this.log(`${this.cardRef(e.cardId)}: Chapter ${romanNumeral(e.chapter)}`, e.cardId);
        break;
      case 'awakened':
        this.log(`${this.cardRef(e.cardId)} awakens`, e.cardId);
        break;
      case 'turnBegan':
        this.log(`Turn ${e.turn}: ${e.player === HUMAN ? 'your' : "opponent's"} turn`);
        this.showTurnBanner(e.turn, e.player === HUMAN);
        // A human who starts is already looking at their opening board while it
        // settles on turn 1. Skip that redundant cue; turn 2+ handoffs chime.
        if (e.player === HUMAN && e.turn > 1) Sfx.play('yourTurn');
        break;
      case 'mulliganTaken':
        if (e.player === AI) this.log('Opponent takes a mulligan');
        break;
      case 'gameEnded':
        this.ended = true;
        if (this.replayMode) this.completeReplayPlayback();
        else this.showResults(e.winner === HUMAN, e.reason);
        break;
      default:
        break;
    }
  }

  /**
   * Choreograph a combat-damage batch attacker-by-attacker (feature: "slower
   * combat"). The engine already resolved everything and handed us all the
   * hits at once; planCombat (pure) orders them per attacker, and each step
   * lunges + strikes + floats damage on a stagger. The board sync and the
   * AI/auto-skip/end-turn follow-ups are held back (animatingCombat) until the
   * last strike lands, so the pre-combat board stays up while it plays out and
   * a deferred game-end shows only once the dust settles.
   */
  private playCombatSequence(events: GameEvent[]): void {
    const rounds: { hits: CombatHit[] }[] = [];
    const diedInfo = new Map<number, Extract<GameEvent, { e: 'died' }>>();
    const heals: Extract<GameEvent, { e: 'lifeChanged' }>[] = [];
    let ended: Extract<GameEvent, { e: 'gameEnded' }> | undefined;

    for (const e of events) {
      switch (e.e) {
        case 'combatDamage':
          rounds.push({ hits: e.hits });
          break;
        case 'died':
          diedInfo.set(e.iid, e);
          break;
        case 'lifeChanged':
          // Player DAMAGE is drawn per-hit (sequenced); keep only lifelink/heal
          // (+delta) to pop once the sequence settles.
          if (e.delta > 0) heals.push(e);
          break;
        case 'damageMarked':
          break; // creature damage floats are derived per-hit from the strikes
        case 'gameEnded':
          ended = e;
          break;
        default:
          this.narrateEvent(e); // combat triggers etc. — narrate immediately
          break;
      }
    }

    const plan = planCombat(rounds, [...diedInfo.keys()]);
    if (plan.steps.length === 0) {
      heals.forEach((h) => this.narrateEvent(h));
      this.finishStep(ended);
      return;
    }

    this.animatingCombat = true;
    this.undoSnapshot = null; // combat is resolving — no take-backs mid-sequence
    const dir: -1 | 1 = this.duel.state.activePlayer === HUMAN ? -1 : 1;
    for (const step of plan.steps) {
      this.combatTimers.push(
        this.time.delayedCall(step.atMs, () => {
          if (!this.ended) this.renderCombatStep(step, dir, diedInfo);
        }),
      );
    }
    this.combatTimers.push(
      this.time.delayedCall(plan.totalMs, () => {
        this.combatTimers = [];
        this.animatingCombat = false;
        if (this.ended) return;
        heals.forEach((h) => this.narrateEvent(h)); // lifelink pops as combat settles
        this.finishStep(ended);
      }),
    );
  }

  /** Render one attacker's moment: lunge, per-hit strike + damage float, deaths. */
  private renderCombatStep(
    step: CombatStep,
    dir: -1 | 1,
    diedInfo: Map<number, Extract<GameEvent, { e: 'died' }>>,
  ): void {
    const attackerView = this.views.get(step.attacker);
    if (attackerView) this.combatFx.lunge(attackerView, dir);
    for (const hit of step.hits) {
      const targetPos = this.hitTargetPos(hit.target);
      if (attackerView) {
        this.combatFx.strike({ x: attackerView.x, y: attackerView.y }, targetPos, attackerView.card);
      }
      if (hit.target.kind === 'player') {
        Sfx.play('lifeLoss');
        this.float(targetPos.x, targetPos.y, `-${hit.amount}`, theme.colors.dangerArmed);
        if (hit.target.player === HUMAN) this.portrait.reactDamage();
        else this.oppPortrait.reactDamage();
      } else {
        Sfx.play('hit');
        this.float(targetPos.x, targetPos.y - 40, `-${hit.amount}`, '#ffb04a');
      }
    }
    for (const iid of step.deaths) {
      Sfx.play('death');
      const info = diedInfo.get(iid);
      if (info) this.log(`${info.owner === HUMAN ? 'Your' : 'Enemy'} ${this.cardRef(info.cardId)} died`, info.cardId);
    }
  }

  private log(msg: string, cardId?: string): void {
    // HistoryPanel is the sole log surface; card-linked rows remain tappable.
    this.history?.push(msg, cardId);
  }

  /** History-line card mention. [Brackets] mark the name as tappable (the row
   *  inspects the card); use this at every line-construction site so the cue
   *  stays consistent across plays, deaths, severs, and foresees. */
  private cardRef(cardId: string): string {
    return `[${def(CARD_DB, cardId).name}]`;
  }

  /**
   * " at [A], [B]" suffix for a targeted cast; '' when untargeted. Permanent
   * iids resolve to names at NARRATE time: battlefield first, then the event
   * batch's `died` records (the target may die during resolution). An iid we
   * can no longer name is omitted rather than misnamed. Player targets read
   * plainly ("you" / "the opponent") because [brackets] mark tappable card
   * names only. Stack/graveyard targets carry no reliable identity here, so
   * they are omitted too.
   */
  private spellTargetsText(targets: readonly TargetRef[], batch: readonly GameEvent[]): string {
    const parts: string[] = [];
    for (const t of targets) {
      if (t.kind === 'player') {
        parts.push(t.player === HUMAN ? 'you' : 'the opponent');
      } else if (t.kind === 'permanent') {
        const cardId =
          this.duel.state.battlefield.find((p) => p.iid === t.iid)?.cardId ??
          batch.find(
            (ev): ev is Extract<GameEvent, { e: 'died' }> => ev.e === 'died' && ev.iid === t.iid,
          )?.cardId;
        if (cardId !== undefined) parts.push(this.cardRef(cardId));
      }
    }
    return parts.length > 0 ? ` at ${parts.join(', ')}` : '';
  }

  private float(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(90);
    this.tweens.add({
      targets: t,
      y: y - 48,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /** Queue a state-driven reveal; its destination is read only after the immediate sync. */
  private queuePlayReveal(cardId: string, controller: PlayerId, permanentIid?: number): void {
    const humanSource =
      controller === HUMAN && this.humanPlayOrigin?.cardId === cardId
        ? this.humanPlayOrigin.source
        : undefined;
    this.pendingPlayReveals.push({ cardId, controller, permanentIid, source: humanSource });
    if (humanSource) this.humanPlayOrigin = null;
  }

  /** Start every reveal after the state has rendered its real tile/land stack underneath it. */
  private flushPlayReveals(): void {
    const reveals = this.pendingPlayReveals.splice(0);
    for (const reveal of reveals) {
      if (this.motionLevel() === 'off') {
        if (reveal.controller === AI) this.showOpponentCast(reveal.cardId);
        continue;
      }
      if (this.motionLevel() === 'reduced') {
        if (reveal.controller === AI) this.showReducedOpponentReveal(reveal.cardId);
        continue;
      }
      this.showPlayReveal(reveal);
    }
  }

  private revealDestination(reveal: PlayReveal): { x: number; y: number; scale: number } {
    const tile = reveal.permanentIid == null ? undefined : this.views.get(reveal.permanentIid);
    if (tile) return { x: tile.x, y: tile.y, scale: tile.scaleX * (TILE_H / CARD_H) };
    const card = def(CARD_DB, reveal.cardId);
    if (isType(card, 'land')) {
      const land = this.landPositions.get(`${reveal.controller}:${card.id}`);
      if (land) return { ...land, scale: 0.32 };
    }
    return reveal.controller === HUMAN
      ? { x: LAYOUT.piles.x, y: LAYOUT.piles.graveY, scale: 0.25 }
      : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.graveY, scale: 0.25 };
  }

  /** Full motion: hand origin → readable station → the already-rendered destination footprint. */
  private showPlayReveal(reveal: PlayReveal): void {
    const opponent = reveal.controller === AI;
    const source =
      reveal.source ??
      (opponent
        ? { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.handY, scale: 0.25, angle: 0 }
        : { x: BOARD_CENTER_X, y: 24, scale: 0.35, angle: 0 });
    const station = opponent
      ? { x: BOARD_CENTER_X, y: 250, scale: 0.72, pause: 500 }
      : { x: BOARD_CENTER_X, y: 430, scale: 0.6, pause: 200 };
    const destination = this.revealDestination(reveal);
    const ghost = new CardView(this, source.x, source.y)
      .setScale(source.scale)
      .setAngle(source.angle)
      .setDepth(theme.depth.floats)
      .setAlpha(0.96);
    ghost.setCard(def(CARD_DB, reveal.cardId), { fx: 'none' });
    this.playRevealGhosts.add(ghost);
    const cleanUp = (): void => {
      this.playRevealGhosts.delete(ghost);
      if (ghost.active) ghost.destroy();
    };
    const fadeOut = (): void => {
      if (!ghost.active) return;
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 80,
        ease: 'Quad.easeIn',
        onComplete: () => { if (ghost.active) cleanUp(); },
        onStop: () => { if (ghost.active) cleanUp(); },
      });
    };
    const morph = (): void => {
      if (!ghost.active) return;
      this.tweens.add({
        targets: ghost,
        x: destination.x,
        y: destination.y,
        scaleX: destination.scale,
        scaleY: destination.scale,
        angle: 0,
        duration: 240,
        ease: 'Cubic.easeInOut',
        onComplete: () => { if (ghost.active) fadeOut(); },
        onStop: () => { if (ghost.active) cleanUp(); },
      });
    };
    const hold = (): void => {
      if (!ghost.active) return;
      this.tweens.add({
        targets: ghost,
        alpha: 0.96,
        duration: station.pause,
        onComplete: () => { if (ghost.active) morph(); },
        onStop: () => { if (ghost.active) cleanUp(); },
      });
    };
    this.tweens.add({
      targets: ghost,
      x: station.x,
      y: station.y,
      scaleX: station.scale,
      scaleY: station.scale,
      angle: 0,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => { if (ghost.active) hold(); },
      onStop: () => { if (ghost.active) cleanUp(); },
    });
  }

  /** Reduced motion preserves hidden-opponent card readability without travel or morphing. */
  private showReducedOpponentReveal(cardId: string): void {
    const ghost = new CardView(this, BOARD_CENTER_X, 250)
      .setScale(0.72)
      .setDepth(theme.depth.floats)
      .setAlpha(0);
    ghost.setCard(def(CARD_DB, cardId), { fx: 'none' });
    this.playRevealGhosts.add(ghost);
    const cleanUp = (): void => {
      this.playRevealGhosts.delete(ghost);
      if (ghost.active) ghost.destroy();
    };
    this.tweens.add({
      targets: ghost,
      alpha: 0.96,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!ghost.active) return;
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          delay: 500,
          duration: 160,
          ease: 'Quad.easeIn',
          onComplete: () => { if (ghost.active) cleanUp(); },
          onStop: () => { if (ghost.active) cleanUp(); },
        });
      },
      onStop: () => { if (ghost.active) cleanUp(); },
    });
  }

  private severedPilePos(player: PlayerId): { x: number; y: number } {
    return player === HUMAN
      ? { x: LAYOUT.piles.x, y: LAYOUT.piles.severedY }
      : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.severedY };
  }

  private severSource(e: Extract<GameEvent, { e: 'severed' }>): { x: number; y: number; scale: number } {
    if (e.from === 'battlefield' && e.iid !== undefined) {
      const tile = this.views.get(e.iid);
      if (tile) return { x: tile.x, y: tile.y, scale: tile.scaleX * (TILE_H / CARD_H) };
    }
    if (e.from === 'deck') {
      return e.player === HUMAN
        ? { x: LAYOUT.piles.x, y: LAYOUT.piles.deckY, scale: 0.25 }
        : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.deckY, scale: 0.25 };
    }
    return e.player === HUMAN
      ? { x: LAYOUT.piles.x, y: LAYOUT.piles.graveY, scale: 0.25 }
      : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.graveY, scale: 0.25 };
  }

  /** Full-motion sever read: source pile/tile to the public severed pile; reduced/off stay instant. */
  private showSeverTravel(e: Extract<GameEvent, { e: 'severed' }>): void {
    if (this.motionLevel() !== 'full') return;
    const source = this.severSource(e);
    const destination = this.severedPilePos(e.player);
    const ghost = new CardView(this, source.x, source.y)
      .setScale(source.scale)
      .setDepth(theme.depth.floats)
      .setAlpha(0.9);
    ghost.setCard(def(CARD_DB, e.cardId), { fx: 'none' });
    this.playRevealGhosts.add(ghost);
    const cleanUp = (): void => {
      this.playRevealGhosts.delete(ghost);
      if (ghost.active) ghost.destroy();
    };
    this.tweens.add({
      targets: ghost,
      x: destination.x,
      y: destination.y - 10,
      scaleX: 0.18,
      scaleY: 0.18,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeInOut',
      onComplete: cleanUp,
      onStop: cleanUp,
    });
  }

  /**
   * Transient center banner announcing a turn change ("Your Turn" / "<Name>'s
   * Turn" + the turn number). Fades in, holds, fades out and self-destroys;
   * a new one supersedes any still on screen so they can't stack. Non-
   * interactive, so taps pass straight through to the board below.
   */
  private showTurnBanner(turn: number, isYou: boolean): void {
    if (this.turnBanner?.active) {
      this.tweens.killTweensOf(this.turnBanner);
      this.turnBanner.destroy();
    }
    const who = isYou ? 'Your Turn' : `${this.opponent?.name ?? this.limitedPersona?.name ?? 'Opponent'}'s Turn`;
    const accent = isYou ? theme.colors.gold : theme.colors.body;
    const bannerY = 74;
    const banner = this.add.container(BOARD_CENTER_X, bannerY).setDepth(theme.depth.banner).setAlpha(0);
    const bg = this.add
      .rectangle(0, 0, 340, 66, colorInt(theme.colors.panelFill), 0.82)
      .setStrokeStyle(1.5, colorInt(accent));
    const sub = this.add
      .text(0, -16, `TURN ${turn}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: '#a89cc6',
      })
      .setOrigin(0.5);
    const title = this.add
      .text(0, 10, who, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '26px', color: accent })
      .setOrigin(0.5);
    banner.add([bg, sub, title]);
    this.turnBanner = banner;
    if (this.motionLevel() === 'full') banner.setX(BOARD_CENTER_X + 14).setScale(0.96);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      ...(this.motionLevel() === 'full' ? { x: BOARD_CENTER_X, scaleX: 1, scaleY: 1 } : {}),
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!banner.active) return;
        this.tweens.add({
          targets: banner,
          alpha: 0,
          delay: 720,
          duration: 340,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            if (banner.active) banner.destroy();
            if (this.turnBanner === banner) this.turnBanner = undefined;
          },
        });
      },
    });
  }

  /**
   * Flash the card the OPPONENT just cast — it comes from their hidden hand, so
   * without this the player only gets a log line and never sees it. A transient,
   * non-interactive CardView (taps pass through to the board) that fades in,
   * holds, and self-destroys; a newer cast supersedes any still on screen.
   */
  private showOpponentCast(cardId: string): void {
    if (this.oppCastReveal?.active) {
      this.tweens.killTweensOf(this.oppCastReveal);
      this.oppCastReveal.destroy();
    }
    const reveal = this.add.container(BOARD_CENTER_X, 250).setDepth(theme.depth.reveal).setAlpha(0);
    const label = this.add
      .text(0, -150, 'Opponent casts', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: '#f0a0c0',
        stroke: '#0a0812',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const view = new CardView(this, 0, 0).setScale(0.8);
    view.setCard(def(CARD_DB, cardId), { fx: 'static' });
    reveal.add([label, view]);
    this.oppCastReveal = reveal;
    this.tweens.add({
      targets: reveal,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!reveal.active) return;
        this.tweens.add({
          targets: reveal,
          alpha: 0,
          delay: 1200,
          duration: 360,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            if (reveal.active) reveal.destroy();
            if (this.oppCastReveal === reveal) this.oppCastReveal = undefined;
          },
        });
      },
    });
  }

  /** Scene-space point for a combat-damage target (tile, else the life total). */
  private hitTargetPos(ref: TargetRef): { x: number; y: number } {
    if (ref.kind === 'permanent') {
      const v = this.views.get(ref.iid);
      if (v) return { x: v.x, y: v.y };
    }
    if (ref.kind === 'player') {
      // Face damage detonates ON the targetable portrait-corner life total.
      return ref.player === HUMAN
        ? { x: LAYOUT.myLife.x, y: LAYOUT.myLife.y }
        : { x: LAYOUT.oppLife.x, y: LAYOUT.oppLife.y };
    }
    return { x: BOARD_CENTER_X, y: LAYOUT.gap.cy };
  }

  // ---------------------------------------------------------------------
  // Declarative sync of the whole board
  // ---------------------------------------------------------------------

  private sync(): void {
    if (this.replayMode) this.replayGuard.close();
    // A board rebuild invalidates every source position from a hover plan.
    this.clearManaPlanPreview();
    const st = this.duel.state;
    const view = this.duel.viewFor(HUMAN);

    // HUD numbers
    this.hud.myLife.setText(`${st.players[HUMAN].life}`);
    this.hud.oppLife.setText(`${st.players[AI].life}`);
    if (this.previousLife) {
      this.pulseLife(this.hud.myLife, st.players[HUMAN].life - this.previousLife[HUMAN], theme.colors.success);
      this.pulseLife(this.hud.oppLife, st.players[AI].life - this.previousLife[AI], theme.colors.dangerArmed);
    }
    this.previousLife = [st.players[HUMAN].life, st.players[AI].life];
    this.oppHandPile.setCount(st.players[AI].hand.length);
    this.oppDeckPile.setCount(st.players[AI].deck.length);
    this.oppGravePile.setCount(st.players[AI].graveyard.length);
    this.myDeckPile.setCount(st.players[HUMAN].deck.length);
    this.myGravePile.setCount(st.players[HUMAN].graveyard.length);
    if (SEVER_ENABLED) {
      this.oppSeveredPile.setCount(view.opp.severed.length);
      this.mySeveredPile.setCount(view.you.severed.length);
    }
    // setText resizes a Text but Phaser never refreshes its hit area — keep
    // the inflated burn-target rects (plan §1.4) tracking the new glyphs.
    inflateHitArea(this.hud.myLife, 44, 44);
    inflateHitArea(this.hud.oppLife, 44, 44);

    const yours = st.turn !== 0 && st.activePlayer === HUMAN;
    this.syncTurnPill(st.turn, yours);
    this.syncPhaseTrack(st.turn === 0 ? null : phaseTrackRowForStep(st.step), yours);
    this.syncUndoButton();
    this.syncCombatPreview();

    // Battlefield tiles: attached auras stay badges on their hosts; lands move
    // to the clickable mana-strip summary; non-creature permanents get their
    // own lower-depth band so the creature rows keep room to breathe.
    const seen = new Set<number>();
    const visiblePermanents = st.battlefield.filter(
      (p) => p.attachedTo === undefined && !isType(def(CARD_DB, p.cardId), 'land'),
    );
    for (const player of [AI, HUMAN] as const) {
      const playerPermanents = visiblePermanents.filter((p) => p.controller === player);
      const creatures = playerPermanents.filter((p) => isType(def(CARD_DB, p.cardId), 'creature'));
      const nonCreatures = playerPermanents.filter(
        (p) => !isType(def(CARD_DB, p.cardId), 'creature'),
      );

      this.syncPermanentRow(creatures, seen, {
        align: 'center',
        x: player === AI ? LAYOUT.oppCreatures.x : LAYOUT.myCreatures.x,
        cy: player === AI ? LAYOUT.oppCreatures.cy : LAYOUT.myCreatures.cy,
        usable: player === AI ? LAYOUT.oppCreatures.usable : LAYOUT.myCreatures.usable,
        tileWidth: TILE_W,
        maxSpacing: TILE_H + 4,
        baseScale: 1,
        depth: 5,
        liftSelected: true,
      });

      const permanentBandLayout: PermanentRowLayout = player === AI
        ? {
          align: 'left',
          x0: LAYOUT.oppPermanentBand.x0,
          cy: LAYOUT.oppPermanentBand.cy,
          usable: LAYOUT.oppPermanentBand.usable,
          tileWidth: PERMANENT_BAND_TILE_W,
          maxSpacing: PERMANENT_BAND_MAX_SPACING,
          baseScale: PERMANENT_BAND_SCALE,
          depth: 4,
          liftSelected: false,
        }
        : {
          align: 'right',
          x1: LAYOUT.myPermanentBand.x1,
          cy: LAYOUT.myPermanentBand.cy,
          usable: LAYOUT.myPermanentBand.usable,
          tileWidth: PERMANENT_BAND_TILE_W,
          maxSpacing: PERMANENT_BAND_MAX_SPACING,
          baseScale: PERMANENT_BAND_SCALE,
          depth: 4,
          liftSelected: false,
        };
      this.syncPermanentRow(nonCreatures, seen, permanentBandLayout);
    }
    for (const [iid, view] of [...this.views]) {
      if (!seen.has(iid)) {
        this.views.delete(iid);
        this.tweens.add({
          targets: view,
          alpha: 0,
          scale: 0.2,
          duration: 260,
          onComplete: () => view.destroy(),
        });
      }
    }

    this.syncLandPositions(st.battlefield);
    this.syncManaPips();
    this.syncHand();
    this.syncButton();
    this.drawArrows();
    this.syncOverlay();
    if (this.tutorial) this.tutorialTick();
  }

  private syncPermanentRow(
    row: readonly Permanent[],
    seen: Set<number>,
    layout: PermanentRowLayout,
  ): void {
    const packed = packRow(row.length, layout.usable, layout.tileWidth, layout.maxSpacing, ROW_GUTTER);
    row.forEach((perm, i) => {
      seen.add(perm.iid);
      const scale = layout.baseScale * packed.scale;
      const x = this.permanentRowX(layout, packed, i, row.length, scale);
      const y = layout.liftSelected ? this.creatureY(perm.iid, layout.cy) : layout.cy;
      const d = def(CARD_DB, perm.cardId);
      let view = this.views.get(perm.iid);
      if (!view) {
        view = new BoardCardView(this, x, y, d);
        view.setDepth(layout.depth);
        view.setScale(scale);
        view.setTapped(perm.tapped, false);
        // Show YOUR own special-variant cards with their holo finish in play
        // (the board doesn't track per-copy cosmetics, so use your best owned
        // variant of the card; opponents stay plain). Applied once at create;
        // a no-op for plain finishes, fxPolicy-gated inside setVariant.
        const best = perm.controller === HUMAN
          ? ownedVariantEntries(Services.save.data, perm.cardId)[0]
          : undefined;
        const ownedVariant = best?.variant;
        if (perm.controller === HUMAN) view.setVariant(ownedVariant ?? null);
        view.enableInput();
        const iid = perm.iid;
        view.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (p.wasTouch) return; // touch activates via the tap classifier
          if (!p.rightButtonReleased()) this.onBattlefieldClick(iid);
        });
        view.on('pointerdown', (p: Phaser.Input.Pointer) => {
          // p.button (initiating button of THIS press), not the live
          // rightButtonDown() bitmask -- a chorded left press while the right
          // button is held must act as a left click, not open inspect.
          if (p.button === 2 && !this.pendingCasts) this.showInspect(d, ownedVariant);
        });
        attachTouchGestures(this, view, {
          card: d, // long-press: sticky zoom preview
          variant: ownedVariant,
          onTap: () => this.onBattlefieldTap(iid, d),
        });
        this.zoom.attach(view, d, ownedVariant);
        this.views.set(perm.iid, view);
        view.setAlpha(0);
        this.tweens.add({ targets: view, alpha: 1, duration: 200 });
      } else {
        view.setDepth(layout.depth);
        this.tweens.add({
          targets: view,
          x,
          y,
          scale,
          duration: 200,
          ease: 'Cubic.easeOut',
        });
        view.setTapped(perm.tapped);
      }
      const stats = getEffectiveStats(this.duel.state.battlefield, CARD_DB, perm.iid);
      if (isType(d, 'creature')) {
        const buffed = stats.attack > (d.attack ?? 0) || stats.defense > (d.defense ?? 0);
        const weakened = stats.attack < (d.attack ?? 0) || stats.defense < (d.defense ?? 0);
        view.setStats(
          stats.attack,
          stats.defense - perm.damage,
          perm.damage > 0 ? 'damaged' : buffed ? 'buffed' : weakened ? 'weakened' : 'normal',
        );
      }
      view.setKeywords(stats.keywords);
      view.setAuraCount(perm.attachments.length);
      view.setHighlight(this.highlightFor(perm));
      // Summoning-sickness affordance (engine is source of truth: entered
      // this turn + no haste). Only creatures can be sick; the call resets
      // itself when sickness wears off at the controller's untap.
      view.setSummoningSick(
        isType(d, 'creature') && isSummoningSick(this.duel.state.battlefield, CARD_DB, perm),
      );
      // Quest chapter badge + Champion Awakening ring (1.2). The engine's
      // Permanent fields are the source of truth; non-Quests hide the badge.
      view.setChapter(d.chapters ? perm.chapter ?? 0 : null, d.chapters ? d.chapters.length : null);
      view.setAwakened(perm.awakened === true && d.awakening !== undefined);
    });
  }

  private permanentRowX(
    layout: PermanentRowLayout,
    packed: RowPacking,
    index: number,
    count: number,
    scale: number,
  ): number {
    if (layout.align === 'center') return layout.x + packed.offsets[index];

    const scaledTileWidth = TILE_W * scale;
    if (layout.align === 'left') return layout.x0 + scaledTileWidth / 2 + index * packed.spacing;

    return layout.x1 - scaledTileWidth / 2 - (count - 1 - index) * packed.spacing;
  }

  private creatureY(iid: number, base: number): number {
    // Lift kept modest: the 170px tile (TILE_H) nearly fills its zone plate,
    // so a big lift would poke a selected attacker out of the plate into the
    // gap where the skip toast / stack readout float.
    return this.selectedAttackers.has(iid) ? base - 12 : base;
  }

  /** Same predicates the old full-card tinting used, mapped to tile states. */
  private highlightFor(perm: Permanent): BoardHighlight {
    const a = this.duel.awaiting;
    const combat = this.duel.state.combat;
    if (
      this.pendingCasts?.some(
        (c) => c.targets?.[0]?.kind === 'permanent' && c.targets[0].iid === perm.iid,
      )
    )
      return 'legalTarget';
    if (this.selectedAttackers.has(perm.iid)) return 'selectedAttacker';
    if (combat?.attackers.includes(perm.iid)) return 'attacking';
    if (this.blockAssignments.some((b) => b.blocker === perm.iid)) return 'blocking';
    if (this.pendingBlocker === perm.iid) return 'pendingBlocker';
    if (
      a.kind === 'declareAttackers' &&
      this.isHumanTurnDecision() &&
      eligibleAttackers(this.duel.state.battlefield, CARD_DB, HUMAN).includes(perm.iid)
    )
      return 'eligible';
    return 'none';
  }

  /** Land cards no longer render individually; this preserves reveal destinations. */
  private syncLandPositions(battlefield: readonly Permanent[]): void {
    this.landPositions = new Map();
    for (const player of [AI, HUMAN] as const) {
      const cardIds = [...new Set(
        battlefield
          .filter((p) => p.controller === player && isType(def(CARD_DB, p.cardId), 'land'))
          .map((p) => p.cardId),
      )].sort((a, b) => this.compareLandZoneCards(def(CARD_DB, a), def(CARD_DB, b)));
      const anchor = player === AI ? LAYOUT.oppManaStrip : LAYOUT.myManaStrip;
      for (let i = 0; i < cardIds.length; i++) {
        const x = player === AI
          ? anchor.x0 - (cardIds.length - 1 - i) * anchor.step
          : anchor.x0 + i * anchor.step;
        this.landPositions.set(`${player}:${cardIds[i]}`, { x, y: anchor.cy });
      }
    }
  }

  private battlefieldLands(player: PlayerId): Permanent[] {
    return this.duel.state.battlefield.filter(
      (p) => p.controller === player && isType(def(CARD_DB, p.cardId), 'land'),
    );
  }

  /**
   * "What can I cast" pips: for each color, how many of a player's untapped
   * mana sources could produce it right now (engine manaSources — public
   * info for BOTH players: untapped lands are on the battlefield; a flexible
   * source counts toward every color it can make, so the pips read
   * availability per color, not a summed total). The strips sit on the old land
   * lanes and open the public battlefield-land breakdown.
   */
  private syncManaPips(): void {
    const signature = ([HUMAN, AI] as const)
      .map((player) =>
        manaSources(this.duel.state, CARD_DB, player)
          .map((source) => source.colors.join(''))
          .sort()
          .join(','),
      )
      .join('|');
    const changed = this.previousManaSignature !== null && this.previousManaSignature !== signature;
    this.previousManaSignature = signature;
    for (const o of this.manaPips) o.destroy();
    for (const zone of this.manaStripZones) zone.destroy();
    this.manaPips = [];
    this.manaStripZones = [];
    this.buildManaRow(
      HUMAN,
      LAYOUT.myManaStrip.x0,
      LAYOUT.myManaStrip.cy,
      LAYOUT.myManaStrip.step,
      LAYOUT.myManaStrip.pipSize,
      'left',
    );
    this.buildManaRow(
      AI,
      LAYOUT.oppManaStrip.x0,
      LAYOUT.oppManaStrip.cy,
      LAYOUT.oppManaStrip.step,
      LAYOUT.oppManaStrip.pipSize,
      'right',
    );
    if (changed && this.motionLevel() === 'full') {
      // Fade back to each pip's own base alpha — ×0 pips stay dimmed.
      for (const pip of this.manaPips) {
        const base = (pip.getData('baseAlpha') as number | undefined) ?? 1;
        pip.setAlpha(0.4 * base);
        this.tweens.add({ targets: pip, alpha: base, duration: 120, ease: 'Quad.easeOut' });
      }
    }
  }

  /** One aligned pip row plus one safe click Zone rebuilt with the pips. */
  private buildManaRow(
    player: PlayerId,
    xAnchor: number,
    cy: number,
    step: number,
    pipSize: number,
    align: 'left' | 'right',
  ): void {
    // Group sources by their exact producible-color set: mono sources
    // aggregate per color, while a flexible source (dual land, the rainbow
    // artifact) is ONE bead with a split pip and its own untapped/total count.
    // Crediting a dual to every color it can make read as extra mana — one
    // W/G land showed "W 1/1 G 1/1" (user-reported 2026-07-12). Signatures
    // are normalized to WUBRG order: card data declares duals in mixed order
    // (duals.ts ['W','G'] vs celtic-fae ['G','W']), and the same color PAIR
    // must group into one bead, not two mirror-image ones.
    const counts = new Map<string, number>();
    for (const src of manaSources(this.duel.state, CARD_DB, player)) {
      const sig = this.manaSourceSignature(src.colors);
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
    // Per-set TOTALS over every battlefield mana source, tapped included
    // (lands + mana creatures): the readout is `untapped/total`, so the foe's
    // growing capacity stays visible even while they're tapped out — a plain
    // untapped count read as "the CPU's mana never goes up", and a tapped-out
    // color must dim to 0/N rather than vanish (user-reported 2026-07-10).
    const totals = new Map<string, number>();
    for (const perm of this.duel.state.battlefield) {
      if (perm.controller !== player) continue;
      const colors = def(CARD_DB, perm.cardId).manaAbility ?? [];
      if (colors.length === 0) continue;
      const sig = this.manaSourceSignature(colors);
      totals.set(sig, (totals.get(sig) ?? 0) + 1);
    }
    // Worst case a deck can reach ~8 signatures (5 basic colors + duals + the
    // rainbow artifact) and the row grows past its tuned 5-slot width —
    // accepted edge: real decks run 2-3 colors and the strip stays a strip.
    const sigs = [...totals.keys()].sort((a, b) => this.compareManaSourceSignatures(a, b));

    let minX = xAnchor - 22;
    let maxX = xAnchor + 22;
    // No sources at all yet: a faint colorless 0/0 placeholder keeps the
    // counter region visible (and clickable) from turn 0, so its first real
    // update happens in place instead of materializing mid-reveal.
    const slots: { texture: string; untapped: number; total: number }[] = sigs.length
      ? sigs.map((sig) => ({
          texture:
            sig.length === 1
              ? `pip-${sig}`
              : ensureSplitPip(this, sig.split('') as Color[]),
          untapped: counts.get(sig) ?? 0,
          total: totals.get(sig) ?? 0,
        }))
      : [{ texture: 'pip-C', untapped: 0, total: 0 }];
    slots.forEach((slot, i) => {
      const x = align === 'right'
        ? xAnchor - (slots.length - 1 - i) * step
        : xAnchor + i * step;
      const baseAlpha = slot.untapped > 0 ? 1 : 0.45;
      const pip = this.add
        .image(x, cy, slot.texture)
        .setDisplaySize(pipSize, pipSize)
        .setDepth(4)
        .setAlpha(baseAlpha)
        .setData('baseAlpha', baseAlpha);
      const countText = this.add
        .text(x + pipSize * 0.64, cy, `${slot.untapped}/${slot.total}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          fontStyle: '600',
          color: slot.untapped > 0 ? '#cbc2e0' : '#7d7492',
          resolution: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(4)
        .setData('baseAlpha', 1);
      minX = Math.min(minX, x - pipSize / 2);
      maxX = Math.max(maxX, x + pipSize / 2, countText.x + countText.width);
      this.manaPips.push(pip);
      this.manaPips.push(countText);
    });
    const width = Math.max(44, maxX - minX);
    const zone = this.add
      .zone((minX + maxX) / 2, cy, width, 44)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(zone, width, 44);
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.showLandsModal(player);
    });
    this.manaStripZones.push(zone);
  }

  private manaSourceSignature(colors: readonly Color[]): string {
    return [...colors]
      .sort((a, b) => COLOR_SORT.indexOf(a) - COLOR_SORT.indexOf(b))
      .join('');
  }

  private compareManaSourceSignatures(a: string, b: string): number {
    return (
      a.length - b.length ||
      COLOR_SORT.indexOf(a[0] as Color) - COLOR_SORT.indexOf(b[0] as Color) ||
      a.localeCompare(b)
    );
  }

  /** Remove static auto-tap markers without touching any board or engine state. */
  private clearManaPlanPreview(): void {
    for (const mark of this.manaPlanMarks) {
      this.tweens.killTweensOf(mark);
      if (mark.active) mark.destroy();
    }
    this.manaPlanMarks = [];
  }

  /**
   * Desktop hover preview of the exact auto-tap plan. `solveMana` is a pure
   * read of GameState and contains no RNG calls, so the live state is safe to
   * inspect directly. X spells mirror onHandClick by previewing their max X.
   */
  private previewManaPlan(handIndex: number): void {
    this.clearManaPlanPreview();
    if (this.touch || this.ended || this.pendingCasts) return;

    const hand = this.duel.state.players[HUMAN].hand;
    const cardId = hand[handIndex];
    if (!cardId) return;
    const card = def(CARD_DB, cardId);
    if (isType(card, 'land') || !card.cost) return;
    if (reasonUncastable(this.duel.state, CARD_DB, HUMAN, handIndex)) return;

    const casts = this.duel
      .legalActions(HUMAN)
      .filter(
        (action): action is Extract<Action, { type: 'castSpell' }> =>
          action.type === 'castSpell' && hand[action.handIndex] === cardId,
      );
    if (casts.length === 0) return;
    const extraGeneric = casts.reduce((best, cast) => Math.max(best, cast.x ?? 0), 0);
    const plan = solveMana(this.duel.state, CARD_DB, HUMAN, card.cost, extraGeneric);
    if (!plan) return;

    const landSignatures = [
      ...new Set(
        this.duel.state.battlefield
          .filter((perm) => perm.controller === HUMAN)
          .map((perm) => def(CARD_DB, perm.cardId).manaAbility ?? [])
          .filter((colors) => colors.length > 0)
          .map((colors) => this.manaSourceSignature(colors)),
      ),
    ].sort((a, b) => this.compareManaSourceSignatures(a, b));
    const planned = new Map<
      string,
      { x: number; y: number; count: number; kind: 'land' | 'card' }
    >();

    for (const iid of plan) {
      const perm = this.duel.state.battlefield.find((candidate) => candidate.iid === iid);
      if (!perm) continue;
      const source = def(CARD_DB, perm.cardId);
      if (isType(source, 'land')) {
        const signature = this.manaSourceSignature(source.manaAbility ?? []);
        const slot = landSignatures.indexOf(signature);
        if (slot < 0) continue;
        const key = `land:${signature}`;
        const previous = planned.get(key);
        if (previous) previous.count++;
        else {
          planned.set(key, {
            x: LAYOUT.myManaStrip.x0 + slot * LAYOUT.myManaStrip.step,
            y: LAYOUT.myManaStrip.cy,
            count: 1,
            kind: 'land',
          });
        }
        continue;
      }

      const view = this.views.get(iid);
      if (!view?.active) continue;
      planned.set(`card:${iid}`, {
        x: view.x + (TILE_W * Math.abs(view.scaleX)) / 2 - 8,
        y: view.y - (TILE_H * Math.abs(view.scaleY)) / 2 + 8,
        count: 1,
        kind: 'card',
      });
    }

    for (const marker of planned.values()) {
      const radius = marker.kind === 'land' ? LAYOUT.myManaStrip.pipSize / 2 + 5 : 7;
      const pip = this.add
        .circle(marker.x, marker.y, radius, colorInt(theme.colors.gold), 0.08)
        .setStrokeStyle(2, colorInt(theme.colors.gold), 0.95)
        .setDepth(theme.depth.hudLabel);
      this.manaPlanMarks.push(pip);
      if (marker.kind === 'land' && marker.count > 1) {
        this.manaPlanMarks.push(
          this.add
            .text(marker.x + radius - 1, marker.y - radius + 1, `${marker.count}`, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              fontStyle: theme.weight.w700,
              color: theme.colors.goldHover,
              backgroundColor: theme.colors.panelFill,
              padding: { x: 2, y: 0 },
              resolution: 2,
            })
            .setOrigin(0.5)
            .setDepth(theme.depth.hudLabel + 1),
        );
      }
    }
  }

  private syncHand(): void {
    this.clearManaPlanPreview();
    const hand = this.duel.state.players[HUMAN].hand;
    const retained = new Map<string, number>();
    for (const cardId of hand) retained.set(cardId, (retained.get(cardId) ?? 0) + 1);
    for (const { cardId, view } of this.renderedHand) {
      const count = retained.get(cardId) ?? 0;
      if (count > 0) {
        retained.set(cardId, count - 1);
        view.destroy();
      } else {
        view.disableInput();
        if (this.motionLevel() === 'full' && view.active) {
          this.tweens.killTweensOf(view);
          this.tweens.add({
            targets: view, y: view.y - 18, alpha: 0, duration: 150, ease: 'Quad.easeIn',
            onComplete: () => { if (view.active) view.destroy(); },
            onStop: () => { if (view.active) view.destroy(); },
          });
        } else view.destroy();
      }
    }
    this.handViews = [];
    this.renderedHand = [];
    this.handPoses = new Map();
    for (const o of this.handDecor) o.destroy();
    this.handDecor = [];
    const legal = this.isHumanTurnDecision() ? this.duel.legalActions(HUMAN) : [];
    const playableIdx = new Set<number>();
    for (const l of legal) {
      if (l.type === 'playLand' || l.type === 'castSpell') {
        // dedupe means only first copy is listed; mark all copies of that card
        const cardId = hand[l.handIndex];
        hand.forEach((c, i) => {
          if (c === cardId) playableIdx.add(i);
        });
      }
    }
    // The 1a hand fan: pure fanLayout math (span-fit spacing + a gentle
    // rotation arc — edges rotate outward and drop below the center baseline).
    // baseScale 0.46 (was 0.6): the taller card kept the fan's top edge (≈462)
    // ABOVE the player land row's badge (≈516), burying it under the hand;
    // 0.46 tops out at ≈521, clearing the land row so lands and hand no longer
    // collide. Rules text is small at rest but the full read is one hover
    // (hovering straightens + enlarges the card) or a right-click inspect.
    // Edge cards may overhang the bottom a few px — the rising-fan look.
    const n = hand.length;
    const fan = fanLayout(n, {
      span: this.touch ? HAND_SPAN_TOUCH : HAND_SPAN_MOUSE,
      cardW: CARD_W,
      baseScale: 0.46,
      smallScale: 0.4,
    });
    const scale = fan.scale;
    // Anchor the fan's center baseline just above the canvas floor.
    const restY = 714 - (CARD_H * scale) / 2;
    // Auto-organize the hand for readability (land → lowest cost → like colors
    // together) WITHOUT touching the engine's canonical hand array: `order` is a
    // permutation of hand indices giving the left-to-right display order. `pos`
    // is the fan slot / depth (visual), `handIdx` is the true engine index used
    // for legality + clicks — the two are no longer the same. (handSort.ts)
    const order = handDisplayOrder(hand, CARD_DB);
    const previousRemaining = new Map<string, number>();
    if (this.previousHand) {
      for (const cardId of this.previousHand) previousRemaining.set(cardId, (previousRemaining.get(cardId) ?? 0) + 1);
    }
    order.forEach((handIdx, pos) => {
      const cardId = hand[handIdx];
      const slot = fan.slots[pos];
      const x = BOARD_CENTER_X + slot.dx;
      const y = restY + slot.dy;
      const d = def(CARD_DB, cardId);
      const ownedVariant = ownedVariantEntries(Services.save.data, cardId)[0]?.variant;
      const view = new CardView(this, x, y);
      view.setScale(scale);
      view.setAngle(slot.angleDeg);
      view.setCard(d, {
        fx: 'none',
        variant: ownedVariant,
        fullArt: ownedVariant?.fullArt === true,
      });
      view.setDepth(theme.depth.hand + pos);
      const playable = playableIdx.has(handIdx);
      const priorCount = previousRemaining.get(cardId) ?? 0;
      const entered = this.previousHand !== null && priorCount === 0;
      if (priorCount > 0) previousRemaining.set(cardId, priorCount - 1);
      let dot: Phaser.GameObjects.Arc | null = null;
      if (playable) {
        // castable-now affordance, driven by engine legalActions (same source
        // of truth as the playable click handling below)
        dot = this.add
          .circle(x, y - (CARD_H * scale) / 2 - 9, 4, 0xffd166, 1)
          .setStrokeStyle(3, 0xffe9a0, 0.35)
          .setDepth(39);
        this.handDecor.push(dot);
      } else {
        view.setAlpha(0.75);
      }
      view.enableInput();
      // Hover feedback is mouse-only: touch fires pointerover on finger-down,
      // which must not lift the card (the gesture binder's pressed-state
      // lift/dim replaces it — plan §1.3 hover-suppression row).
      // Anchor the raised pose's BOTTOM to the resting pose's bottom
      // (714 + dy): if the hover zone did not contain the rest zone's lower
      // edge, a pointer in the uncovered band would be orphaned by the lift —
      // pointerout fires, the card drops back under the pointer, and the fan
      // flickers on every mouse move (confirmed adversarial finding; worst at
      // the 0.52 shrink scale, a 22px band).
      const hoverY = 714 + slot.dy - (CARD_H * scale * 1.15) / 2;
      view.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        if (playable && !isType(d, 'land')) this.previewManaPlan(handIdx);
        // Straighten + gentle lift — the resting card is already readable,
        // and the full-detail read is the CardZoomPreview.
        this.tweens.killTweensOf(view);
        view.setDepth(theme.depth.handHover);
        if (this.motionLevel() !== 'full') {
          view.setScale(scale * 1.15).setAngle(0).setY(hoverY);
          dot?.setVisible(false);
          return;
        }
        this.tweens.add({
          targets: view, scaleX: scale * 1.15, scaleY: scale * 1.15, angle: 0, y: hoverY,
          duration: 100, ease: 'Quad.easeOut',
        });
        dot?.setVisible(false);
      });
      view.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        this.clearManaPlanPreview();
        this.tweens.killTweensOf(view);
        view.setDepth(theme.depth.hand + pos);
        if (this.motionLevel() !== 'full') {
          view.setScale(scale).setAngle(slot.angleDeg).setY(y);
          dot?.setVisible(true);
          return;
        }
        this.tweens.add({
          targets: view, scaleX: scale, scaleY: scale, angle: slot.angleDeg, y,
          duration: 100, ease: 'Quad.easeOut',
        });
        dot?.setVisible(true);
      });
      view.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return; // touch casts only via a classified tap
        if (!p.rightButtonReleased()) this.onHandClick(handIdx);
      });
      view.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.clearManaPlanPreview();
        // p.button (initiating button of THIS press), not the live
        // rightButtonDown() bitmask — a chorded left press while the right
        // button is held must act as a left click, not open inspect.
        if (p.button === 2 && !this.pendingCasts) this.showInspect(d, ownedVariant);
      });
      // Touch: tap = exactly onHandClick; long-press = sticky preview whose
      // release never casts; drags across the fan die in the classifier.
      attachTouchGestures(this, view, {
        card: d,
        variant: ownedVariant,
        pressLift: 12,
        onTap: () => this.onHandClick(handIdx),
      });
      this.zoom.attach(view, d, ownedVariant);
      this.handViews.push(view);
      this.renderedHand.push({ cardId, view });
      this.handPoses.set(handIdx, { x, y, scale, angle: slot.angleDeg });
      if (entered && this.motionLevel() === 'full') {
        view.setPosition(LAYOUT.piles.x, LAYOUT.piles.deckY).setAlpha(0);
        if (dot) dot.setAlpha(0);
        // Input OFF until the card arrives: it spawns under the End Turn
        // corner, and a pointerover there killed this tween mid-flight while
        // the hover handlers only re-tween y/scale/angle — the card stranded
        // under the right CTAs (user-reported 2026-07-10).
        view.disableInput();
        const arrive = (): void => {
          if (view.active) {
            view.setPosition(x, y).setScale(scale).setAngle(slot.angleDeg);
            view.setAlpha(playable ? 1 : 0.75);
            view.enableInput();
          }
        };
        this.tweens.add({
          // End at the playability alpha — a hardcoded 1 here lit unaffordable
          // draws as castable until the next sync (user-reported 2026-07-10).
          targets: view, x, y, scaleX: scale, scaleY: scale, angle: slot.angleDeg,
          alpha: playable ? 1 : 0.75,
          duration: 160, ease: 'Quad.easeOut',
          onComplete: arrive,
          onStop: arrive,
        });
        if (dot) this.tweens.add({ targets: dot, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
      }
    });
    this.previousHand = [...hand];
  }

  private syncButton(): void {
    const a = this.duel.awaiting;
    // The smart button is the Arc + its label Text, shown/relabeled together.
    // No hit-area bookkeeping: input lives on the Arc, whose circle never
    // changes size (the Text label is never interactive).
    const showButton = (label: string): void => {
      this.passArc.setVisible(true);
      this.hud.button.setVisible(true).setText(label);
    };
    this.passArc.setVisible(false);
    this.setSmartAffordance('pass', false);
    this.hud.button.setVisible(false);
    this.endTurnBtn.setVisible(false);

    const items = this.duel.state.stack;
    const stackDecisionLive =
      !this.ended &&
      'player' in a &&
      (a.kind === 'respond' || a.kind === 'endStepWindow');
    this.stackDisplay.setItems(items, stackDecisionLive);

    if (this.ended || !('player' in a) || a.player !== HUMAN) return;
    if (this.pendingCasts) {
      showButton('Cancel');
      this.setSmartAffordance('pass', true);
      return;
    }
    switch (a.kind) {
      case 'main':
        showButton(this.duel.state.step === 'main1' ? 'To Combat' : 'Pass ▶');
        // The ⏭ End Turn quick button rides above the smart button on your own
        // main phases (hidden everywhere else — set false at the top). It is
        // suppressed in the tutorial so a fast-forward can't skip a taught beat.
        if (!this.tutorial) {
          this.endTurnBtn.setVisible(true);
          inflateHitArea(this.endTurnBtn, 90, 90);
        }
        break;
      case 'declareAttackers':
        showButton(this.selectedAttackers.size > 0 ? `Attack (${this.selectedAttackers.size})` : 'Skip Combat');
        break;
      case 'declareBlockers':
        showButton(`Confirm Blocks (${this.blockAssignments.length})`);
        break;
      case 'respond':
      case 'endStepWindow':
        showButton('Pass');
        break;
      default:
        break;
    }
    this.setSmartAffordance(
      a.kind === 'declareAttackers' || a.kind === 'declareBlockers' ? 'confirm' : 'pass',
      true,
    );
  }

  private setSmartAffordance(kind: 'confirm' | 'pass', actionable: boolean): void {
    this.tweens.killTweensOf(this.passArc);
    const locked = this.time.now - this.lastAutoSkipAt < AUTOSKIP_INPUT_LOCK_MS;
    const breathing = actionable && !locked && kind === 'confirm' && this.motionLevel() === 'full';
    const color = breathing ? colorInt(theme.colors.gold) : colorInt(theme.colors.muted);
    this.passArc.setStrokeStyle(2.5, color, breathing ? 0.92 : 0.55);
    if (breathing) {
      this.tweens.add({
        targets: this.passArc,
        strokeAlpha: 0.28,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawArrows(): void {
    this.arrows.clear();
    const combat = this.duel.state.combat;
    // block-assignment arrows while choosing
    for (const b of this.blockAssignments) {
      const from = this.views.get(b.blocker);
      const to = this.views.get(b.attacker);
      if (from && to) {
        this.drawCurvedArrow(from.x, from.y, to.x, to.y, 0x6aa0ff, 0.9);
      }
    }
    if (combat && combat.blocks.length > 0) {
      for (const b of combat.blocks) {
        const from = this.views.get(b.blocker);
        const to = this.views.get(b.attacker);
        if (from && to) {
          this.drawCurvedArrow(from.x, from.y, to.x, to.y, 0x88b8ff, 0.7);
        }
      }
    }
    // Cast-targeting arrow (desktop hover): from the hand-rest anchor to the
    // pointer, snapping to the closest legal target so burn-face vs burn-creature
    // intent is unmistakable. Touch resolves targets by direct tap — no hover.
    if (this.pendingCasts && !this.touch) {
      const p = this.input.activePointer;
      const tip = this.snapTargetTip(p.worldX, p.worldY);
      const { x: sx, y: sy } = TARGET_ARROW_SRC;
      this.drawCurvedArrow(sx, sy, tip.x, tip.y, TARGET_ARROW_COLOR, 0.95);
      // Arrowhead — two short strokes back from the tip along the shaft angle.
    }
  }

  /** Quadratic shafts reuse CombatFx's aerial-bezier idiom; filled heads read at a glance. */
  private drawCurvedArrow(sx: number, sy: number, tx: number, ty: number, color: number, alpha: number): void {
    const angle = Phaser.Math.Angle.Between(sx, sy, tx, ty);
    const distance = Phaser.Math.Distance.Between(sx, sy, tx, ty);
    const offset = Phaser.Math.Clamp(distance * 0.15, 12, 54);
    const control = new Phaser.Math.Vector2(
      (sx + tx) / 2 - Math.sin(angle) * offset,
      (sy + ty) / 2 + Math.cos(angle) * offset,
    );
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(sx, sy), control, new Phaser.Math.Vector2(tx, ty),
    );
    this.arrows.lineStyle(4, color, alpha);
    curve.draw(this.arrows, 20);
    const headAngle = Math.atan2(ty - control.y, tx - control.x);
    const head = 16;
    const spread = 0.56;
    this.arrows.fillStyle(color, alpha);
    this.arrows.fillTriangle(
      tx, ty,
      tx - head * Math.cos(headAngle - spread), ty - head * Math.sin(headAngle - spread),
      tx - head * Math.cos(headAngle + spread), ty - head * Math.sin(headAngle + spread),
    );
  }

  // ---------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------

  private onButton(): void {
    if (this.pendingCasts) {
      this.pendingCasts = null;
      this.sync();
      return;
    }
    // An auto-skip hop just advanced the phase and retargeted this button; a
    // click that was already in flight for the previous decision must not be
    // applied to the new one (an empty declareAttackers would skip a real
    // combat). Ignore the press for a brief window; a deliberate click a beat
    // later lands normally.
    if (this.time.now - this.lastAutoSkipAt < AUTOSKIP_INPUT_LOCK_MS) return;
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return;
    switch (a.kind) {
      case 'main':
        this.act({ type: 'passStep' });
        break;
      case 'declareAttackers':
        this.act({ type: 'declareAttackers', attackers: [...this.selectedAttackers] });
        break;
      case 'declareBlockers': {
        // A lone blocker on a Dreaded attacker is a partial assignment the
        // engine will reject; explain it by card name instead of submitting.
        const short = this.dreadedShortfall();
        if (short) {
          this.showSkipNotice(`${short} can only be blocked by two or more creatures.`);
          break;
        }
        this.act({ type: 'declareBlockers', blocks: [...this.blockAssignments] });
        break;
      }
      case 'respond':
      case 'endStepWindow':
        this.act({ type: 'passResponse' });
        break;
      default:
        break;
    }
  }

  /**
   * Desktop input bindings: Space/Enter drive the smart button (pass /
   * to-combat / confirm-attackers / confirm-blocks), Esc cancels a pending
   * targeted cast, closes the inspect overlay, or (with nothing to cancel)
   * opens the in-game menu, and a pointer-move redraws the
   * cast-targeting arrow while a targeted spell is pending. Registered once per
   * create() and torn down on SHUTDOWN so a gauntlet rematch never stacks
   * duplicates (playbook §11: listeners outlive the scene otherwise).
   */
  private bindHotkeys(): void {
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', this.onConfirmKey, this);
    kb?.on('keydown-ENTER', this.onConfirmKey, this);
    kb?.on('keydown-ESC', this.onCancelKey, this);
    this.input.on('pointermove', this.onTargetPointerMove, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-SPACE', this.onConfirmKey, this);
      kb?.off('keydown-ENTER', this.onConfirmKey, this);
      kb?.off('keydown-ESC', this.onCancelKey, this);
      this.input.off('pointermove', this.onTargetPointerMove, this);
    });
  }

  /** Redraw the targeting arrow as the mouse moves (desktop only — no touch hover). */
  private onTargetPointerMove(): void {
    if (this.pendingCasts && !this.touch) this.drawArrows();
  }

  /**
   * Snap a pointer position to the closest legal target of the pending cast
   * (within TARGET_SNAP_R), reusing hitTargetPos so it handles creatures,
   * players (face), and untargeted-detonation spots alike. Falls back to the
   * raw pointer when nothing legal is near, so the arrow always tracks the mouse.
   */
  private snapTargetTip(px: number, py: number): { x: number; y: number } {
    let best: { x: number; y: number } | null = null;
    let bestDist = TARGET_SNAP_R;
    for (const c of this.pendingCasts ?? []) {
      for (const t of c.targets ?? []) {
        const pos = this.hitTargetPos(t);
        const dist = Phaser.Math.Distance.Between(px, py, pos.x, pos.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = pos;
        }
      }
    }
    return best ?? { x: px, y: py };
  }

  private onConfirmKey(e: KeyboardEvent): void {
    e.preventDefault(); // Space would otherwise scroll the page in the browser
    if (this.replayMode) return;
    if (this.ended || this.inspect || this.zoneModal) return; // modals do not pass under
    if (this.overlay && this.confirmForeseeOverlay()) return;
    this.onButton(); // self-guards: auto-skip input lock + not-your-decision
  }

  private onCancelKey(e: KeyboardEvent): void {
    e.preventDefault();
    if (this.replayMode) return;
    if (this.inspect) {
      this.closeInspect();
      return;
    }
    if (this.pendingCasts) {
      this.pendingCasts = null;
      this.sync(); // mirrors the right-click cancel path
      return;
    }
    // Nothing to cancel: Esc opens the in-game menu (playtest 2026-07-16).
    // Safe to call unconditionally — showPauseMenu's guards no-op while any
    // overlay/modal is up (the modal's own escToClose closes it; that handler
    // registered after this one, so this fires first and the guard holds) or
    // outside a human decision window, matching the ⚙ button.
    this.showPauseMenu();
  }

  private onHandClick(handIndex: number): void {
    this.clearManaPlanPreview();
    // Dimmed-card feedback: a card that can't be played explains itself on the
    // skip-toast instead of being a silent no-op. reasonUncastable === null iff
    // the card is genuinely playable now, so the branches below only decide HOW.
    const reason = reasonUncastable(this.duel.state, CARD_DB, HUMAN, handIndex);
    if (reason) {
      this.showSkipNotice(reason);
      return;
    }

    const cardId = this.duel.state.players[HUMAN].hand[handIndex];
    const d = def(CARD_DB, cardId);
    if (isType(d, 'land')) {
      this.act({ type: 'playLand', handIndex });
      return;
    }

    const casts = this.duel
      .legalActions(HUMAN)
      .filter(
        (l): l is Extract<Action, { type: 'castSpell' }> =>
          l.type === 'castSpell' &&
          this.duel.state.players[HUMAN].hand[l.handIndex] === cardId,
      )
      .map((c) => ({ ...c, handIndex }));
    if (casts.length === 0) {
      // reasonUncastable only checks the first target spec; a rare multi-target
      // spell with a partially-satisfiable target set can still land here.
      this.showSkipNotice("You can't cast this right now.");
      return;
    }

    // Empower choice comes first: the enumerator only emits the empowered
    // variant when the extra cost is actually payable, so the chooser appears
    // exactly when the option is real (user decision 2026-07-17).
    if (casts.some((c) => c.empowered) && casts.some((c) => !c.empowered)) {
      this.showEmpowerChooser(d, casts);
      return;
    }
    this.continueCast(casts);
  }

  /** The cast flow after any Empower choice: act, grave-pick, or target. */
  private continueCast(casts: Extract<Action, { type: 'castSpell' }>[]): void {
    const targeted = casts[0].targets !== undefined && casts[0].targets.length > 0;
    if (!targeted) {
      // untargeted; for X spells default to the biggest X
      const best = casts.reduce((x, y) => ((x.x ?? 0) >= (y.x ?? 0) ? x : y));
      this.act(best);
      return;
    }
    if (casts[0].targets![0].kind === 'grave') {
      // Each enumerated cast is a distinct grave creature — let the player pick
      // which one to return rather than silently taking the first.
      this.showGravePicker(casts);
      return;
    }
    this.pendingCasts = this.pendingCasts ? null : casts; // click again cancels
    this.sync();
  }

  private onBattlefieldClick(iid: number): void {
    if (this.pendingCasts) {
      this.tryTarget({ kind: 'permanent', iid });
      return;
    }
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return;
    const st = this.duel.state;
    const perm = st.battlefield.find((p) => p.iid === iid);
    if (!perm) return;

    if (a.kind === 'declareAttackers') {
      if (!eligibleAttackers(st.battlefield, CARD_DB, HUMAN).includes(iid)) return;
      if (this.selectedAttackers.has(iid)) this.selectedAttackers.delete(iid);
      else this.selectedAttackers.add(iid);
      this.sync();
      return;
    }

    if (a.kind === 'declareBlockers' && st.combat) {
      const opts = blockOptions(st.battlefield, CARD_DB, HUMAN, st.combat);
      if (perm.controller === HUMAN) {
        // toggle/select a blocker
        const existing = this.blockAssignments.findIndex((b) => b.blocker === iid);
        if (existing >= 0) {
          this.blockAssignments.splice(existing, 1);
          this.pendingBlocker = null;
        } else if (opts.some((o) => o.blocker === iid)) {
          this.pendingBlocker = this.pendingBlocker === iid ? null : iid;
        }
      } else if (this.pendingBlocker !== null) {
        const opt = opts.find((o) => o.blocker === this.pendingBlocker);
        if (opt && opt.canBlock.includes(iid)) {
          this.blockAssignments.push({ blocker: this.pendingBlocker, attacker: iid });
          this.pendingBlocker = null;
          // First blocker onto a Dreaded attacker: nudge for the second.
          const assigned = this.blockAssignments.filter((b) => b.attacker === iid).length;
          if (assigned === 1 && minimumBlockersForAttacker(st.battlefield, CARD_DB, iid) === 2) {
            this.showSkipNotice(`${def(CARD_DB, perm.cardId).name} is Dreaded. Add a second blocker.`);
          }
        }
      }
      this.sync();
    }
  }

  /** Name of a Dreaded attacker currently assigned exactly one blocker, if any. */
  private dreadedShortfall(): string | null {
    const st = this.duel.state;
    const counts = new Map<number, number>();
    for (const b of this.blockAssignments) counts.set(b.attacker, (counts.get(b.attacker) ?? 0) + 1);
    for (const [attacker, n] of counts) {
      const perm = st.battlefield.find((p) => p.iid === attacker);
      if (!perm) continue;
      if (n < minimumBlockersForAttacker(st.battlefield, CARD_DB, attacker)) {
        return def(CARD_DB, perm.cardId).name;
      }
    }
    return null;
  }

  /**
   * Touch tap on a battlefield tile. Anywhere a click has meaning today the
   * tap does exactly that; an ACTION-LESS opponent permanent inspects
   * directly instead — the plan's tap-actionless-cards rule (§1.3), the touch
   * stand-in for right-click. Own permanents keep click semantics unchanged
   * (a no-op tap stays a no-op; long-press already covers reading them).
   */
  private onBattlefieldTap(iid: number, d: CardDef): void {
    if (this.pendingCasts) {
      this.onBattlefieldClick(iid); // targeting: tap = pick this target
      return;
    }
    const perm = this.duel.state.battlefield.find((p) => p.iid === iid);
    if (!perm) return;
    if (perm.controller === HUMAN) {
      this.onBattlefieldClick(iid); // attacker toggle / blocker pick / no-op
      return;
    }
    const a = this.duel.awaiting;
    if (
      'player' in a &&
      a.player === HUMAN &&
      a.kind === 'declareBlockers' &&
      this.pendingBlocker !== null
    ) {
      this.onBattlefieldClick(iid); // assigning a block to this attacker
      return;
    }
    this.showInspect(d);
  }

  // ---------------------------------------------------------------------
  // Public zone browser: graveyards, severed cards, and your deck
  // ---------------------------------------------------------------------

  private canOpenZoneModal(): boolean {
    if (
      this.ended ||
      this.overlay ||
      this.inspect ||
      this.pendingCasts ||
      this.pauseOverlay ||
      this.gravePicker ||
      this.animatingCombat ||
      this.zoneModal
    )
      return false;
    return this.isHumanTurnDecision();
  }

  private showZoneModal(player: PlayerId, zone: ViewableZone): void {
    if (!this.canOpenZoneModal()) return;
    if (zone === 'deck' && player !== HUMAN) return;

    const view = this.duel.viewFor(HUMAN);
    const cardIds = zone === 'deck'
      ? this.duel.state.players[player].deck
      : zone === 'graveyard'
        ? this.duel.state.players[player].graveyard
        : player === HUMAN
          ? view.you.severed
          : view.opp.severed;
    const owner = player === HUMAN ? 'Your' : "Foe's";
    const zoneLabel = zone === 'graveyard' ? 'Graveyard' : 'Severed';
    const title = zone === 'deck'
      ? `Your Deck · ${cardIds.length} cards left`
      : `${owner} ${zoneLabel} · ${cardIds.length}`;
    const modal = showZoneContents(this, {
      title,
      entries: this.zoneEntries(cardIds),
      emptyText: zone === 'deck' ? 'No cards left.' : zone === 'severed' ? 'No cards severed.' : 'No cards here.',
      dimAlpha: 0.62,
      escToClose: true,
      tapDimToClose: true,
      showClose: false,
      depth: theme.depth.inspect,
      onClose: () => this.closeZoneModal(),
      onInspect: (card) => {
        this.zoneModalReturn = () => this.showZoneModal(player, zone);
        this.showInspect(card);
      },
    });
    this.zoneModal = modal;
    this.zoneGuard.open(this.overlayGuardTargets());
  }

  private showLandsModal(player: PlayerId): void {
    if (!this.canOpenZoneModal()) return;

    const lands = this.battlefieldLands(player);
    const untapped = lands.filter((land) => !land.tapped).length;
    const owner = player === HUMAN ? 'Your' : "Foe's";
    const modal = showZoneContents(this, {
      title: `${owner} Lands · ${lands.length} (${untapped} untapped)`,
      entries: this.landZoneEntries(lands),
      emptyText: 'No lands on the battlefield.',
      dimAlpha: 0.62,
      escToClose: true,
      tapDimToClose: true,
      showClose: false,
      depth: theme.depth.inspect,
      onClose: () => this.closeZoneModal(),
      onInspect: (card) => {
        this.zoneModalReturn = () => this.showLandsModal(player);
        this.showInspect(card);
      },
    });
    this.zoneModal = modal;
    this.zoneGuard.open(this.overlayGuardTargets());
  }

  private closeZoneModal(): void {
    if (!this.zoneModal) return;
    this.zoneModal = null;
    this.zoneGuard.close();
    this.maybeAutoSkip();
    this.endTurnTick();
  }

  private zoneEntries(cardIds: readonly string[]): ZoneContentsEntry[] {
    const counts = new Map<string, number>();
    for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    return [...counts]
      .map(([cardId, count]) => ({ card: def(CARD_DB, cardId), count }))
      .sort((a, b) => this.compareZoneCards(a.card, b.card));
  }

  private landZoneEntries(lands: readonly Permanent[]): ZoneContentsEntry[] {
    const counts = new Map<string, number>();
    for (const land of lands) counts.set(land.cardId, (counts.get(land.cardId) ?? 0) + 1);
    return [...counts]
      .map(([cardId, count]) => ({ card: def(CARD_DB, cardId), count }))
      .sort((a, b) => this.compareLandZoneCards(a.card, b.card));
  }

  private compareZoneCards(a: CardDef, b: CardDef): number {
    const aLand = isType(a, 'land');
    const bLand = isType(b, 'land');
    if (aLand !== bLand) return aLand ? -1 : 1;

    const mv = manaValue(a.cost) - manaValue(b.cost);
    if (mv !== 0) return mv;

    const color = this.zoneColorKey(a).localeCompare(this.zoneColorKey(b));
    if (color !== 0) return color;

    const name = a.name.localeCompare(b.name);
    if (name !== 0) return name;

    return a.id.localeCompare(b.id);
  }

  private compareLandZoneCards(a: CardDef, b: CardDef): number {
    const color = this.zoneColorKey(a).localeCompare(this.zoneColorKey(b));
    if (color !== 0) return color;

    const name = a.name.localeCompare(b.name);
    if (name !== 0) return name;

    return a.id.localeCompare(b.id);
  }

  private zoneColorKey(card: CardDef): string {
    const colors = isType(card, 'land') && card.manaAbility?.length
      ? card.manaAbility
      : card.colors;
    const ranks = colors
      .map((color) => COLOR_SORT.indexOf(color))
      .filter((rank) => rank >= 0)
      .sort((a, b) => a - b);
    return ranks.length > 0 ? ranks.join('.') : 'z';
  }

  // ---------------------------------------------------------------------
  // Inspect overlay: right-click any card for the full CardView
  // ---------------------------------------------------------------------

  private showInspect(card: CardDef, variant?: CardVariant): void {
    if (this.ended) return;
    this.closeInspect();
    this.zoom.setSuppressed(true);
    // A hovered hand card can't receive pointerout once the guard disables
    // its zone (Phaser drops disabled objects from the over-list silently),
    // so it would stay raised at depth 40 forever. Rebuild the hand at rest
    // BEFORE guarding — the fresh views are what the guard then disables.
    // BUT never while a pick overlay is up: it hid the fan deliberately, and
    // a rebuild would resurrect it visible+enabled under the dim (touch
    // sticky-tap inspect path — adversarial review 2026-07-04); no hover can
    // be stuck then anyway, the overlay guard already deadened the fan.
    if (!this.overlay) this.syncHand();
    const width = 1280; // design-space constants (see buildZones)
    const height = 720;
    const c = this.add.container(0, 0).setDepth(110);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setInteractive();
    c.add(dim);
    const view = new CardView(this, width / 2, height / 2);
    view.setScale(1.35).setCard(card, {
      fx: 'full',
      variant,
      fullArt: variant?.fullArt === true,
    });
    c.add(view);
    addKeywordGlossaryPanel(this, c, card, { x: 875, y: 150, width: 300 });
    c.add(
      this.add
        .text(width / 2, height - 26, this.touch ? 'Tap anywhere to close' : 'Click anywhere to close', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );
    this.inspectMove = (p: Phaser.Input.Pointer) => view.setHoloPointer(p.worldX, p.worldY);
    this.input.on('pointermove', this.inspectMove);
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Inspect opens on right-button DOWN; without this gate the release of
      // that same right-click lands on the dim and instantly closes it.
      if (p.rightButtonReleased()) return;
      this.closeInspect();
    });
    // Its own guard so closing restores exactly what IT disabled — pick
    // overlays keep their own (main) guard bookkeeping intact underneath.
    this.inspectGuard.open(this.overlayGuardTargets());
    this.inspect = c;
  }

  private closeInspect(): void {
    if (this.inspectMove) {
      this.input.off('pointermove', this.inspectMove);
      this.inspectMove = null;
    }
    if (this.inspect) {
      this.inspect.destroy();
      this.inspect = null;
      this.inspectGuard.close();
    }
    // Inspect launched from a zone modal returns there on close. Deferred a
    // tick: showInspect's own close-then-replace path must NOT bounce back
    // (the replacement inspect exists by the time this fires — memo kept).
    const reopen = this.zoneModalReturn;
    if (reopen) {
      this.time.delayedCall(0, () => {
        if (this.zoneModalReturn !== reopen || this.inspect) return;
        this.zoneModalReturn = null;
        if (!this.ended && !this.zoneModal) reopen();
      });
    }
    this.zoom.setSuppressed(this.ended);
    // An open inspect pauses a pending auto-skip chain (the hop callback
    // bails); resume it here so closing the overlay doesn't strand the player
    // on a choice-free decision. All guards re-run inside maybeAutoSkip, so
    // the showInspect→closeInspect (replace) path schedules at most one hop
    // that then bails on the freshly opened overlay.
    this.maybeAutoSkip();
    this.endTurnTick(); // an inspect opened mid end-turn pauses it; resume now
  }

  // ---------------------------------------------------------------------
  // In-game pause / settings menu (⚙): Resume · quick toggles · Concede
  // ---------------------------------------------------------------------

  /**
   * Modal pause overlay behind the ⚙ button. Houses the moved Concede (two-tap,
   * still gated on it being your decision) plus quick Auto-skip / Sound / Music
   * toggles so the player can adjust mid-duel without leaving to Settings (which
   * would restart the duel). Never opens over a mulligan/pick or inspect overlay.
   */
  private showPauseMenu(): void {
    if (this.ended || this.overlay || this.inspect || this.pauseOverlay || this.zoneModal) return;
    // Only during your own decision window — never over a pick/inspect overlay,
    // mid-combat animation, or the AI's turn. That keeps the game from ending
    // behind the overlay (which would double-guard the board with the results
    // overlay) and means Concede is always valid while the menu is open.
    if (this.animatingCombat || !this.isHumanTurnDecision()) return;
    this.concedeArmed = false;
    const onOff = (v: boolean): string => (v ? 'On' : 'Off');
    const s = Services.save.data.settings;

    const shell = modalShell(this, {
      width: 420,
      height: 430,
      dimAlpha: 0.82,
      tapDimToClose: true,
      escToClose: true,
      showClose: false,
      depth: theme.depth.modal,
      onClose: () => this.closePauseMenu(),
    });
    const c = shell.container;

    c.add(
      this.add
        .text(640, 190, 'Menu', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(640, 226, this.matchupLabel(), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
          align: 'center',
          wordWrap: { width: 340 },
          resolution: 2,
        })
        .setOrigin(0.5),
    );

    const resume = themedButton(this, 640, 276, 'Resume', {
      variant: 'primary',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        shell.close();
      },
    });
    c.add(resume.container);

    const autoSkip = themedButton(this, 640, 326, `Auto-skip: ${onOff(s.autoSkip)}`, {
      variant: s.autoSkip ? 'primary' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        s.autoSkip = !s.autoSkip;
        Services.save.touch();
        autoSkip.setLabel(`Auto-skip: ${onOff(s.autoSkip)}`);
        autoSkip.setVariant(s.autoSkip ? 'primary' : 'ghost');
        if (s.autoSkip) this.maybeAutoSkip();
      },
    });
    c.add(autoSkip.container);

    const sfx = themedButton(this, 640, 376, `Sound: ${onOff(s.sfxOn)}`, {
      variant: s.sfxOn ? 'primary' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        s.sfxOn = !s.sfxOn;
        Services.save.touch();
        sfx.setLabel(`Sound: ${onOff(s.sfxOn)}`);
        sfx.setVariant(s.sfxOn ? 'primary' : 'ghost');
        if (s.sfxOn) Sfx.play('click');
      },
    });
    c.add(sfx.container);

    const music = themedButton(this, 640, 426, `Music: ${onOff(Music.enabled)}`, {
      variant: Music.enabled ? 'primary' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        Music.setEnabled(!Music.enabled);
        music.setLabel(`Music: ${onOff(Music.enabled)}`);
        music.setVariant(Music.enabled ? 'primary' : 'ghost');
      },
    });
    c.add(music.container);

    const concede = themedButton(this, 640, 500, 'Concede', {
      variant: 'danger',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        if (this.ended || !this.isHumanTurnDecision()) {
          concede.setLabel('Not your turn to concede');
          return;
        }
        // Two-tap (a gauntlet loss ends the run) unless opted out.
        if (Services.save.data.settings.confirmDestructive && !this.concedeArmed) {
          this.concedeArmed = true;
          concede.setLabel('Tap to confirm');
          return;
        }
        this.tearDownPauseMenu();
        this.act({ type: 'concede' });
      },
    });
    c.add(concede.container);

    this.pauseOverlay = c;
    this.pauseGuard.open(this.overlayGuardTargets());
  }

  /** Destroy the pause overlay + restore board input (no play-resume side effects). */
  private tearDownPauseMenu(): void {
    if (!this.pauseOverlay) return;
    const overlay = this.pauseOverlay;
    this.pauseOverlay = null;
    this.pauseGuard.close();
    this.concedeArmed = false;
    overlay.destroy();
  }

  /** Resume from the pause overlay: clear state, then rejoin any paused flow. */
  private closePauseMenu(): void {
    if (!this.pauseOverlay) return;
    this.pauseOverlay = null;
    this.pauseGuard.close();
    this.concedeArmed = false;
    this.maybeAutoSkip(); // a pause paused a pending skip chain — resume it
    this.endTurnTick(); // …and a paused end-turn fast-forward
  }

  // ---------------------------------------------------------------------
  // Graveyard-target chooser (Summon the Dead, Call the Einherjar, …)
  // ---------------------------------------------------------------------

  /**
   * Choose which graveyard creature a grave-targeting spell returns, instead of
   * silently taking the first. Each `cast` the engine enumerated maps to one
   * distinct grave creature (targeting dedupes by card id), so we render one
   * option per cast and submit the chosen one. Its own guard deadens the board.
   */
  private showGravePicker(casts: Extract<Action, { type: 'castSpell' }>[]): void {
    const width = 1280;
    const height = 720;
    const grave = this.duel.state.players[HUMAN].graveyard;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closeGravePicker(); // tap outside a card cancels the cast
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 150, 'Return which creature to hand?', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '28px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    const n = casts.length;
    const spacing = Math.min(160, (width - 240) / Math.max(1, n));
    casts.forEach((cast, i) => {
      const ref = cast.targets![0];
      const cardId = ref.kind === 'grave' ? grave[ref.index] : undefined;
      if (!cardId) return;
      const x = width / 2 - ((n - 1) * spacing) / 2 + i * spacing;
      const v = new CardView(this, x, 370).setScale(0.62);
      const d = def(CARD_DB, cardId);
      v.setCard(d, { fx: 'none' });
      c.add(v);
      // Same read affordances as the mulligan cards: hover/long-press zoom.
      v.enableInput();
      this.zoom.attach(v, d);
      const pick = (): void => {
        this.closeGravePicker();
        this.act(cast);
      };
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return; // touch picks via the tap classifier below
        if (p.rightButtonReleased()) return;
        pick();
      });
      attachTouchGestures(this, v, { card: d, onTap: pick });
    });
    const cancel = this.add
      .text(width / 2, 600, 'Cancel', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#e0a0a0',
        backgroundColor: '#3a2030',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, cancel, (p) => {
      if (p.rightButtonReleased()) return;
      this.closeGravePicker();
    });
    inflateHitArea(cancel, 90, 60);
    c.add(cancel);
    this.gravePicker = c;
    this.gravePickerGuard.open(this.overlayGuardTargets());
  }

  private closeGravePicker(): void {
    if (!this.gravePicker) return;
    this.gravePicker.destroy();
    this.gravePicker = null;
    this.gravePickerGuard.close();
    this.maybeAutoSkip();
    this.endTurnTick();
  }

  /**
   * Cast-or-Empower chooser. Shown only when both variants are in the legal
   * list, which the enumerator guarantees means the extra cost is payable.
   */
  private showEmpowerChooser(
    d: CardDef,
    casts: Extract<Action, { type: 'castSpell' }>[],
  ): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closeEmpowerChooser(); // tap outside cancels the cast
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 130, 'Cast, or pay more to Empower?', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '28px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    const v = new CardView(this, width / 2, 340).setScale(0.62);
    v.setCard(d, { fx: 'none' });
    c.add(v);
    v.enableInput();
    this.zoom.attach(v, d);

    const pick = (empowered: boolean): void => {
      const subset = casts.filter((cast) => (cast.empowered ?? false) === empowered);
      this.closeEmpowerChooser();
      if (subset.length > 0) this.continueCast(subset);
    };
    const button = (
      x: number,
      label: string,
      bg: string,
      onPick: () => void,
    ): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, 545, label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '22px',
          color: '#f0e6ff',
          backgroundColor: bg,
          padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, t, (p) => {
        if (p.rightButtonReleased()) return;
        onPick();
      });
      inflateHitArea(t, 90, 60);
      c.add(t);
      return t;
    };
    const total = combineManaCosts(d.cost!, d.empower!.cost);
    button(width / 2 - 170, `Cast ${manaCostText(d.cost!)}`, '#20303a', () => pick(false));
    button(width / 2 + 170, `Empower ${manaCostText(total)}`, '#3a2030', () => pick(true));
    const rider = empowerText(d);
    if (rider) {
      c.add(
        this.add
          .text(width / 2, 605, rider, {
            fontFamily: 'Georgia, serif',
            fontSize: '17px',
            color: '#cdbfe0',
            wordWrap: { width: 640 },
            align: 'center',
          })
          .setOrigin(0.5, 0),
      );
    }
    this.empowerChooser = c;
    this.empowerChooserGuard.open(this.overlayGuardTargets());
  }

  private closeEmpowerChooser(): void {
    if (!this.empowerChooser) return;
    this.empowerChooser.destroy();
    this.empowerChooser = null;
    this.empowerChooserGuard.close();
    this.maybeAutoSkip();
    this.endTurnTick();
  }

  // ---------------------------------------------------------------------
  // Overlays: mulligan / bottoming / foresee / discard / results
  // ---------------------------------------------------------------------

  /** Everything an overlay must deaden while it floats above the board. */
  private overlayGuardTargets(): Phaser.GameObjects.GameObject[] {
    const tileZones: Phaser.GameObjects.GameObject[] = [];
    for (const v of this.views.values()) {
      if (v.inputZone) tileZones.push(v.inputZone);
    }
    return [
      ...tileZones,
      ...this.manaStripZones,
      ...this.handViews,
      ...[
        this.oppGravePile.inputZone,
        this.oppSeveredPile.inputZone,
        this.mySeveredPile.inputZone,
        this.myDeckPile.inputZone,
        this.myGravePile.inputZone,
      ].filter((zone): zone is Phaser.GameObjects.Zone => !!zone),
      this.passArc, // the smart button's input carrier (its label Text never is)
      ...this.stackDisplay.interactiveTargets(),
      this.hud.myLife,
      this.hud.oppLife,
      this.menuBtn,
      this.endTurnBtn,
      this.history.tab, // deaden the history slide-out tab under modal overlays
    ];
  }

  /** Replay controls are the only interactive objects left enabled. */
  private replayGuardTargets(): Phaser.GameObjects.GameObject[] {
    return [...this.overlayGuardTargets(), this.undoBtn];
  }

  private syncOverlay(): void {
    // Timer cleanup runs before ANY early return (incl. replay mode): a
    // pending CPU-choice banner timer must never outlive an overlay rebuild.
    this.coinChoiceTimer?.remove(false);
    this.coinChoiceTimer = null;
    if (this.replayMode) {
      this.guard.close();
      this.overlay?.destroy();
      this.overlay = null;
      this.replayGuard.open(this.replayGuardTargets());
      return;
    }
    this.guard.close(); // restore before rebuild; no-op when nothing is guarded
    this.overlay?.destroy();
    this.overlay = null;
    if (this.ended) {
      // showResults ran before this sync recreated the hand; re-deaden the board
      this.guard.open(this.overlayGuardTargets());
      return;
    }
    const a = this.duel.awaiting;
    if ('player' in a && a.kind === 'choosePlayDraw') {
      this.buildCoinFlipOverlay(a.player);
      return;
    }
    if (!('player' in a) || a.player !== HUMAN) return;
    if (a.kind === 'mulligan') {
      // Cap-aware mulligan overlay: show how many mulligans remain, drop the
      // Mulligan button at the cap, and always offer Concede — the corner
      // Concede button is deadened under the overlay guard, so this is the
      // player's only escape while an opening-hand decision is up.
      const mulls = this.duel.state.players[HUMAN].mulligans;
      const left = RULES.maxMulligans - mulls;
      const title =
        left > 0
          ? `Keep this hand?  ·  ${left} mulligan${left === 1 ? '' : 's'} left`
          : 'Keep this hand?  ·  no mulligans left';
      const buttons = left > 0 ? ['Keep', 'Mulligan', 'Concede'] : ['Keep', 'Concede'];
      this.buildPickOverlay(title, 0, buttons);
    } else if (a.kind === 'bottomCards') {
      this.buildPickOverlay(`Put ${a.count} card(s) on the bottom`, a.count, ['Confirm', 'Concede']);
    } else if (a.kind === 'foresee') {
      this.buildForeseeOverlay(a.cards);
    } else if (a.kind === 'discardToHandSize') {
      this.buildPickOverlay(`Discard ${a.count} card(s)`, a.count, ['Confirm']);
    } else if (a.kind === 'chooseBasicLand') {
      this.showBasicLandOverlay();
    }
  }

  /** Render the high-resolution painted coin face for the pregame call and reveal. */
  private buildCoinFace(side: CoinFlipSide, x: number, y: number): Phaser.GameObjects.Container {
    const coin = this.add.container(x, y);
    const face = this.add.image(0, 0, COIN_FLIP_FACE_TEXTURES[side]).setDisplaySize(96, 96);
    coin.add(face);
    return coin;
  }

  /** Call first, then reveal. Full motion flips; reduced/off reveals immediately. */
  private buildCoinFlipOverlay(winner: PlayerId): void {
    const shell = modalShell(this, {
      width: 560,
      height: 410,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.modal,
    });
    const c = shell.container;
    c.add(
      this.add
        .text(theme.design.centerX, 205, 'Coin Flip', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );

    const status = this.add
      .text(theme.design.centerX, 260, 'Call heads or tails.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        align: 'center',
        wordWrap: { width: 430 },
        resolution: 2,
      })
      .setOrigin(0.5);
    c.add(status);

    const [leftActionX, rightActionX] = COIN_FLIP_ACTION_CENTERS;
    const headsIcon = this.buildCoinFace('heads', leftActionX, 342);
    const tailsIcon = this.buildCoinFace('tails', rightActionX, 342);
    c.add([headsIcon, tailsIcon]);

    let called = false;
    const callButtons: ThemedButton[] = [];
    function opposite(side: 'heads' | 'tails'): 'heads' | 'tails' {
      return side === 'heads' ? 'tails' : 'heads';
    }
    const callFlip = (calledSide: 'heads' | 'tails'): void => {
      if (called || !c.active || !status.active) return;
      called = true;
      headsIcon.setVisible(false);
      tailsIcon.setVisible(false);
      for (const button of callButtons) {
        button.setEnabled(false);
        button.container.setVisible(false);
      }
      status.setY(410).setText('Flipping...');

      // The engine's single seeded winner roll remains authoritative. Mapping
      // it through the player's call produces the equivalent revealed side
      // without consuming a second RNG value or changing replay determinism.
      const revealedSide = winner === HUMAN ? calledSide : opposite(calledSide);
      const coin = this.buildCoinFace(revealedSide, theme.design.centerX, 320);
      c.add(coin);

      let revealed = false;
      const reveal = (): void => {
        if (revealed || !c.active || !coin.active || !status.active) return;
        revealed = true;
        coin.setAngle(0).setScale(1);
        Sfx.play('coin');
        const sideLabel = revealedSide === 'heads' ? 'Heads' : 'Tails';
        this.log(`${sideLabel} · ${winner === HUMAN ? 'you' : 'opponent'} won the flip`);

        if (winner === HUMAN) {
          status.setText(`${sideLabel}. You won the flip. Choose whether to play or draw.`);
          const choose = (play: boolean): void => {
            const awaiting = this.duel.awaiting;
            if (!c.active || awaiting.kind !== 'choosePlayDraw' || awaiting.player !== HUMAN) return;
            this.act({ type: 'choosePlayDraw', play });
          };
          const play = themedButton(this, leftActionX, COIN_FLIP_RESULT_Y, 'Play First', {
            variant: 'primary',
            minWidth: COIN_FLIP_ACTION_WIDTH,
            onTap: (pointer) => {
              if (!pointer.rightButtonReleased()) choose(true);
            },
          });
          const draw = themedButton(this, rightActionX, COIN_FLIP_RESULT_Y, 'Draw First', {
            variant: 'ghost',
            minWidth: COIN_FLIP_ACTION_WIDTH,
            onTap: (pointer) => {
              if (!pointer.rightButtonReleased()) choose(false);
            },
          });
          c.add([play.container, draw.container]);
          return;
        }

        const legal = this.duel.legalActions(AI);
        const proposed = this.ai.chooseAction(this.duel.viewFor(AI), legal);
        const choice =
          proposed.type === 'choosePlayDraw'
            ? proposed
            : ({ type: 'choosePlayDraw', play: true } as const);
        status.setText(`${sideLabel}. Opponent won and chose to ${choice.play ? 'play' : 'draw'} first.`);
        this.coinChoiceTimer = this.time.delayedCall(900, () => {
          this.coinChoiceTimer = null;
          if (!c.active) return;
          const awaiting = this.duel.awaiting;
          if (awaiting.kind !== 'choosePlayDraw' || awaiting.player !== AI) return;
          const events = this.duel.submit(AI, choice);
          this.processEvents(events);
          this.afterEvents();
        });
      };

      if (this.motionLevel() === 'full') {
        Sfx.play('flip');
        this.tweens.add({
          targets: coin,
          angle: 720,
          scaleX: 0.15,
          duration: theme.motion.slow,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: 1,
          onComplete: reveal,
        });
      } else {
        reveal();
      }
    };

    // 160px controls on a 176px pitch leave the compact-touch 16px floor.
    const headsButton = themedButton(this, leftActionX, COIN_FLIP_CALL_Y, 'Heads', {
      variant: 'ghost',
      minWidth: COIN_FLIP_ACTION_WIDTH,
      onTap: (pointer) => {
        if (!pointer.rightButtonReleased()) callFlip('heads');
      },
    });
    const tailsButton = themedButton(this, rightActionX, COIN_FLIP_CALL_Y, 'Tails', {
      variant: 'ghost',
      minWidth: COIN_FLIP_ACTION_WIDTH,
      onTap: (pointer) => {
        if (!pointer.rightButtonReleased()) callFlip('tails');
      },
    });
    callButtons.push(headsButton, tailsButton);
    c.add([headsButton.container, tailsButton.container]);

    this.guard.open(this.overlayGuardTargets());
    this.overlay = c;
  }

  private confirmForeseeOverlay(): boolean {
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN || a.kind !== 'foresee') return false;
    this.act({ type: 'foresee', bottomIndices: [...this.foreseeBottomPicks].sort((x, y) => x - y) });
    return true;
  }

  private buildForeseeOverlay(cards: readonly string[]): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(theme.depth.overlay);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.chrome)
      .setInteractive();
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 118, `Foresee ${cards.length}`, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
          resolution: 2,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 158, 'Leftmost is top of deck. Select any cards to bottom.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.body,
          resolution: 2,
        })
        .setOrigin(0.5),
    );

    this.foreseeBottomPicks.clear();
    const scale = cards.length <= 5 ? 0.62 : cards.length <= 7 ? 0.54 : 0.46;
    const spacing = Math.min(CARD_W * scale + 24, (width - 220) / Math.max(1, cards.length));
    const cardY = 366;
    cards.forEach((cardId, index) => {
      const x = width / 2 - ((cards.length - 1) * spacing) / 2 + index * spacing;
      const rank = index === 0 ? 'Top' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`;
      const posLabel = this.add
        .text(x, cardY - (CARD_H * scale) / 2 - 18, rank, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: index === 0 ? theme.colors.gold : theme.colors.muted,
          resolution: 2,
        })
        .setOrigin(0.5);
      const v = new CardView(this, x, cardY).setScale(scale);
      const d = def(CARD_DB, cardId);
      v.setCard(d, { fx: 'none' });
      const badge = this.add
        .text(x, cardY + (CARD_H * scale) / 2 + 18, 'Bottom', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.danger,
          backgroundColor: theme.colors.dangerBg,
          padding: { x: 8, y: 4 },
          resolution: 2,
        })
        .setOrigin(0.5)
        .setVisible(false);
      c.add([posLabel, v, badge]);
      v.enableInput();
      this.zoom.attach(v, d);
      const toggle = (): void => {
        const picked = !this.foreseeBottomPicks.has(index);
        if (picked) this.foreseeBottomPicks.add(index);
        else this.foreseeBottomPicks.delete(index);
        v.setY(picked ? cardY - 20 : cardY);
        v.setAlpha(picked ? theme.alpha.subtle : 1);
        badge.setVisible(picked);
      };
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        if (p.rightButtonReleased()) return;
        toggle();
      });
      attachTouchGestures(this, v, { card: d, onTap: toggle });
    });

    for (const v of this.handViews) v.setVisible(false);
    for (const o of this.handDecor) (o as Phaser.GameObjects.Arc).setVisible(false);

    const confirm = this.add
      .text(width / 2, 600, 'Confirm', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
        backgroundColor: theme.colors.btnEmphasisBg,
        padding: { x: 18, y: 10 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, confirm, (p) => {
      if (p.rightButtonReleased()) return;
      this.confirmForeseeOverlay();
    });
    inflateHitArea(confirm, 90, 90);
    c.add(confirm);
    this.guard.open(this.overlayGuardTargets());
    this.overlay = c;
  }

  /**
   * Mandatory chooser for a deferred fetchLand (Demeter etc.): tap the basic
   * land type to fetch. One CardView per legal option (deduped basic types);
   * no Cancel — the fetch is resolving. Stored in `this.overlay`, so the next
   * syncOverlay tears it down once the choice resolves back to `main`.
   */
  private showBasicLandOverlay(): void {
    const width = 1280;
    const height = 720;
    const options = this.duel
      .legalActions(HUMAN)
      .filter((l): l is Extract<Action, { type: 'chooseBasicLand' }> => l.type === 'chooseBasicLand');
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82).setInteractive());
    c.add(
      this.add
        .text(width / 2, 150, 'Search your deck for a basic land', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '28px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    const n = options.length;
    const spacing = Math.min(160, (width - 240) / Math.max(1, n));
    options.forEach((opt, i) => {
      const x = width / 2 - ((n - 1) * spacing) / 2 + i * spacing;
      const v = new CardView(this, x, 370).setScale(0.62);
      const d = def(CARD_DB, opt.cardId);
      v.setCard(d, { fx: 'none' });
      c.add(v);
      v.enableInput();
      this.zoom.attach(v, d);
      const pick = (): void => this.act(opt);
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        if (p.rightButtonReleased()) return;
        pick();
      });
      attachTouchGestures(this, v, { card: d, onTap: pick });
    });
    this.overlay = c;
    this.guard.open(this.overlayGuardTargets());
  }

  private buildPickOverlay(title: string, picks: number, buttons: string[]): void {
    const width = 1280; // design-space constants (see buildZones)
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82).setInteractive();
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 150, title, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '30px', color: '#f0e6ff' })
        .setOrigin(0.5),
    );
    this.discardPicks.clear();
    const hand = this.duel.state.players[HUMAN].hand;
    const spacing = Math.min(150, (width - 200) / Math.max(1, hand.length));
    // Organize the opening/pick hand the same way as the play fan (handSort):
    // `pos` is the visual slot, `handIdx` the true engine index that picks and
    // the bottomCards/discard actions address.
    const order = handDisplayOrder(hand, CARD_DB);
    order.forEach((handIdx, pos) => {
      const cardId = hand[handIdx];
      const x = width / 2 - ((hand.length - 1) * spacing) / 2 + pos * spacing;
      const v = new CardView(this, x, 360);
      v.setScale(0.62);
      const d = def(CARD_DB, cardId);
      v.setCard(d, { fx: 'none' });
      c.add(v);
      // Hover-zoom works during hand decisions too — that's when reading
      // the cards matters most (mulligan cards are otherwise interaction-free);
      // on touch the same reading comes from long-press → sticky preview.
      v.enableInput();
      this.zoom.attach(v, d);
      const togglePick = (): void => {
        if (this.discardPicks.has(handIdx)) {
          this.discardPicks.delete(handIdx);
          v.y = 360;
          v.setAlpha(1);
        } else if (this.discardPicks.size < picks) {
          this.discardPicks.add(handIdx);
          v.y = 340;
          v.setAlpha(0.6);
        }
      };
      if (picks > 0) {
        v.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (p.wasTouch) return; // touch picks via the tap classifier below
          if (p.rightButtonReleased()) return;
          togglePick();
        });
      }
      attachTouchGestures(this, v, {
        card: d,
        ...(picks > 0 ? { onTap: togglePick } : {}),
      });
    });
    // The board hand fan is still on the board beneath the dim — hide it so the
    // bright preview row above is the single, unambiguous copy to read (and the
    // Keep/Mulligan buttons no longer land on top of a ghost row). syncHand
    // rebuilds the fan visible on the next render once this decision resolves.
    for (const v of this.handViews) v.setVisible(false);
    for (const o of this.handDecor) (o as Phaser.GameObjects.Arc).setVisible(false);
    // Local two-tap arm for the overlay's own Concede button (isolated from the
    // pause-menu Concede's `concedeArmed` state — the overlay is rebuilt each
    // syncOverlay, so a fresh flag per overlay is exactly the right lifetime).
    let overlayConcedeArmed = false;
    buttons.forEach((label, bi) => {
      // 220px centers: the armed Concede label ("Tap to confirm") auto-grows
      // its text plate to ~246px, which overlapped the neighbor at the old
      // 180px pitch (user-reported 2026-07-12).
      const bx = width / 2 - ((buttons.length - 1) * 220) / 2 + bi * 220;
      const concede = label === 'Concede';
      const btn = this.add
        .text(bx, 580, label, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '22px',
          color: concede ? '#e0a0a0' : '#ffd88a',
          backgroundColor: concede ? '#3a2030' : '#2c2344', padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, () => {
        if (concede) {
          // Escape hatch (e.g. an unkeepable hand at the mulligan cap). Shares
          // the confirmDestructive two-tap policy with the corner Concede.
          if (Services.save.data.settings.confirmDestructive && !overlayConcedeArmed) {
            overlayConcedeArmed = true;
            btn.setText('Tap to confirm').setColor('#f08a8a');
            inflateHitArea(btn, 90, 90); // relabeled — regrow the custom hit area
            return;
          }
          this.act({ type: 'concede' });
          return;
        }
        const a = this.duel.awaiting;
        if (!('player' in a) || a.player !== HUMAN) return;
        if (a.kind === 'mulligan') {
          this.act(label === 'Keep' ? { type: 'keepHand' } : { type: 'mulligan' });
        } else if (a.kind === 'bottomCards') {
          if (this.discardPicks.size === a.count)
            this.act({ type: 'bottomCards', handIndices: [...this.discardPicks] });
        } else if (a.kind === 'discardToHandSize') {
          if (this.discardPicks.size === a.count)
            this.act({ type: 'discard', handIndices: [...this.discardPicks] });
        }
      });
      inflateHitArea(btn, 90, 90);
      c.add(btn);
    });
    this.guard.open(this.overlayGuardTargets());
    this.overlay = c;
  }

  private rewardLine(totalGold: number, firstWinBonus: boolean, streakCount: number, completion = false): string {
    const parts: string[] = [];
    if (completion) parts.push('completion bonus');
    if (firstWinBonus) parts.push('first win');
    if (streakCount > 0) parts.push(`streak ${streakCount}`);
    return `+${totalGold} gold${parts.length > 0 ? `  (${parts.join(' + ')})` : ''}`;
  }

  private showResults(won: boolean, reason: string): void {
    if (this.replayMode) {
      this.completeReplayPlayback();
      return;
    }
    this.closeInspect();
    this.zoom.setSuppressed(true);
    if (this.tutorial) {
      // The tutorial normally ends at the block beat (tutorialComplete), but a
      // mid-tutorial concede lands here — treat it as finishing (reward on skip).
      this.tutorialComplete(false);
      return;
    }
    // Persist the finished recording before the mode branches (each branch
    // flushes the save as part of paying out); a duel that never reaches
    // results (app closed mid-game) is intentionally not kept.
    if (this.replayDraft) {
      Services.save.data.replays = pushReplay(
        Services.save.data.replays,
        finishReplay(this.replayDraft, won ? 'win' : 'loss', Date.now(), this.duel.state.turn),
      );
      this.replayDraft = null;
    }
    if (this.opponent && this.gauntletRung !== null) {
      this.showGauntletResults(won, reason);
      return;
    }
    if (this.limited) {
      this.showLimitedResults(won, reason);
      return;
    }
    const save = Services.save.data;
    const today = todayString();
    const reward = applyMatchResult(save, this.difficulty, won, today, this.duel.state.turn);
    const streak = won ? recordDailyWin(save, today) : { advanced: false, count: save.daily.streak.count, gold: 0 };
    Services.save.flush();
    Music.duck(1.8); // let the sting read clearly over the bed
    Sfx.play(won ? 'win' : 'loss');

    const shell = modalShell(this, {
      width: 560,
      height: 330,
      dimAlpha: 0.78,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.results,
    });
    const c = shell.container;
    const reasonCopy = resultReasonCopy(won, reason);
    c.add(
      this.add
        .text(640, 278, won ? 'VICTORY' : 'DEFEAT', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.displayXL}px`,
          fontStyle: theme.weight.w700,
          color: won ? theme.colors.goldHover : theme.colors.danger,
        })
        .setOrigin(0.5),
    );
    if (reasonCopy) {
      c.add(
        this.add
          .text(640, 342, reasonCopy, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            align: 'center',
            wordWrap: { width: 480 },
            resolution: 2,
          })
          .setOrigin(0.5),
      );
    }
    c.add(
      this.add
        .text(
          640,
          388,
          reward.tooEarly
            ? 'No reward: the match ended too early'
            : this.rewardLine(reward.gold + streak.gold, reward.firstWinBonus, streak.advanced ? streak.count : 0),
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.h2}px`,
            fontStyle: theme.weight.w600,
            color: theme.colors.gold,
            align: 'center',
            wordWrap: { width: 500 },
            resolution: 2,
          },
        )
        .setOrigin(0.5),
    );
    const mk = (x: number, label: string, variant: 'primary' | 'ghost', cb: () => void): void => {
      const btn = themedButton(this, x, 456, label, {
        variant,
        minWidth: 150,
        onTap: (p) => {
          if (!p.rightButtonReleased()) cb();
        },
      });
      c.add(btn.container);
    };
    mk(520, 'Rematch', 'primary', () => this.scene.restart());
    mk(760, 'Menu', 'ghost', () => this.scene.start('MainMenu'));
    this.guard.open(this.overlayGuardTargets());
  }

  /** Limited results: update the active run, then continue or close the run. */
  private showLimitedResults(won: boolean, reason: string): void {
    const save = Services.save.data;
    const today = todayString();
    const reward = applyLimitedMatchResult(save, this.difficulty, won, today, this.myDeckColorStyle);
    const streak = won ? recordDailyWin(save, today) : { advanced: false, count: save.daily.streak.count, gold: 0 };
    Services.save.flush();
    Music.duck(1.8);
    Sfx.play(won ? (reward.runOver && reward.wins === 3 ? 'win' : 'rungClear') : 'loss');

    const shell = modalShell(this, {
      width: 620,
      height: 340,
      dimAlpha: 0.82,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.results,
    });
    const c = shell.container;
    const reasonCopy = resultReasonCopy(won, reason);

    const headline = reward.runOver ? 'LIMITED COMPLETE' : won ? 'MATCH WON' : 'MATCH LOST';
    c.add(
      this.add
        .text(640, 268, headline, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          fontStyle: theme.weight.w700,
          color: won ? theme.colors.goldHover : theme.colors.danger,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(640, 328, `Record ${reward.wins}-${reward.losses}${reasonCopy ? `  ${reasonCopy}` : ''}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
          align: 'center',
          wordWrap: { width: 540 },
          resolution: 2,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          640,
          378,
          this.rewardLine(
            reward.gold + streak.gold,
            reward.firstWinBonus,
            streak.advanced ? streak.count : 0,
            reward.runOver && reward.wins === LIMITED_MATCHES,
          ),
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.h2}px`,
            fontStyle: theme.weight.w600,
            color: theme.colors.gold,
            align: 'center',
            wordWrap: { width: 560 },
            resolution: 2,
          },
        )
        .setOrigin(0.5),
    );

    // Name the persona waiting in the next draft match so the run reads like a
    // table of opponents, not a difficulty ladder. Their theme (title) is
    // familiarity-gated — below reveal tier 3 the player only knows the name.
    const nextRun = reward.runOver ? null : save.limited.activeRun;
    const nextPersona = nextRun ? draftPersonaById(limitedDuelData(nextRun).limited.opponentPersonaId ?? '') : null;
    if (nextPersona) {
      const knowsTheme = personaRevealTier(save.limited, nextPersona.id) >= 3;
      c.add(
        this.add
          .text(640, 414, knowsTheme ? `Next: ${nextPersona.name}, ${nextPersona.title}` : `Next: ${nextPersona.name}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.body,
            resolution: 2,
          })
          .setOrigin(0.5),
      );
    }

    const mk = (x: number, label: string, variant: 'primary' | 'ghost', cb: () => void): void => {
      const btn = themedButton(this, x, 456, label, {
        variant,
        minWidth: 170,
        onTap: (p) => {
          if (!p.rightButtonReleased()) cb();
        },
      });
      c.add(btn.container);
    };

    if (!reward.runOver && save.limited.activeRun) {
      mk(510, 'Next Match', 'primary', () => this.scene.restart(limitedDuelData(save.limited.activeRun!)));
      mk(770, 'Limited Hub', 'ghost', () => this.scene.start('Limited'));
    } else {
      mk(510, 'Limited Hub', 'primary', () => this.scene.start('Limited'));
      mk(770, 'Menu', 'ghost', () => this.scene.start('MainMenu'));
    }
    this.guard.open(this.overlayGuardTargets());
  }

  /** Gauntlet results: pay via applyGauntletResult and route through the tower. */
  private showGauntletResults(won: boolean, reason: string): void {
    const rung = this.gauntletRung!;
    const save = Services.save.data;
    const today = todayString();
    const reward = applyGauntletResult(
      save,
      rung,
      this.difficulty,
      won,
      today,
      this.myDeckColorStyle === 'mono' ? 'monoColor' : this.myDeckColorStyle === 'dual' ? 'dualColor' : undefined,
    );
    const streak = won ? recordDailyWin(save, today) : { advanced: false, count: save.daily.streak.count, gold: 0 };
    Services.save.flush();
    // Full clear earns the fanfare; an ordinary rung gets its own short motif.
    Music.duck(1.8);
    Sfx.play(reward.completed ? 'win' : won ? 'rungClear' : 'loss');

    const bonusLine = this.rewardLine(
      reward.gold + streak.gold,
      reward.firstWinBonus,
      streak.advanced ? streak.count : 0,
      reward.completed,
    );
    if (reward.runOver) {
      this.showGauntletRunRecap(reward.completed, won ? null : rung, reason, bonusLine);
      return;
    }

    const shell = modalShell(this, {
      width: 620,
      height: 330,
      dimAlpha: 0.82,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.results,
    });
    const c = shell.container;
    const reasonCopy = resultReasonCopy(won, reason);

    const headline = 'RUNG CLEARED';
    c.add(
      this.add
        .text(640, 270, headline, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.goldHover,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          640,
          330,
          won
            ? `Defeated ${this.opponent!.name}${reasonCopy ? `  ${reasonCopy}` : ''}`
            : reasonCopy,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            align: 'center',
            wordWrap: { width: 540 },
            resolution: 2,
          },
        )
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(640, 378, bonusLine, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.gold,
          align: 'center',
          wordWrap: { width: 560 },
          resolution: 2,
        })
        .setOrigin(0.5),
    );

    const mk = (x: number, label: string, variant: 'primary' | 'ghost', cb: () => void): void => {
      const btn = themedButton(this, x, 456, label, {
        variant,
        minWidth: 160,
        onTap: (p) => {
          if (!p.rightButtonReleased()) cb();
        },
      });
      c.add(btn.container);
    };

    if (reward.nextRung !== null) {
      const next = reward.nextRung;
      mk(520, 'Next Foe', 'primary', () =>
        this.scene.restart({ opponentId: this.avatarForGauntletFloor(next).id, gauntletRung: next }),
      );
      mk(760, 'Tower', 'ghost', () => this.scene.start('Gauntlet'));
    }
    this.guard.open(this.overlayGuardTargets());
  }

  private showGauntletRunRecap(
    completed: boolean,
    failedRung: number | null,
    reason: string,
    rewardLine: string,
  ): void {
    const shell = modalShell(this, {
      width: 820,
      height: 640,
      dimAlpha: 0.86,
      tapDimToClose: false,
      escToClose: false,
      showClose: false,
      depth: theme.depth.results,
    });
    const c = shell.container;

    // Share the same defeat table as practice/Limited so raw engine reason
    // enums never leak into any results surface.
    const endedCopy = defeatReasonCopy(reason) ?? 'The run ended.';

    c.add(
      this.add
        .text(640, 86, completed ? 'SUCCESS' : 'FAILURE', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          fontStyle: theme.weight.w700,
          color: completed ? theme.colors.gold : theme.colors.dangerArmed,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          640,
          136,
          completed ? 'Tower cleared' : `Stopped at Rung ${failedRung ?? 1}. ${endedCopy}`,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.body,
            align: 'center',
            wordWrap: { width: 720 },
            resolution: 2,
          },
        )
        .setOrigin(0.5),
    );
    // On a failed run the gold shown is the last match's payout; label it so
    // the bare "+N gold" cannot read as a whole-run total.
    const goldLine = completed ? rewardLine : `Final match reward: ${rewardLine}`;
    c.add(
      this.add
        .text(640, 178, goldLine, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.h2}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.gold,
          align: 'center',
          wordWrap: { width: 740 },
          resolution: 2,
        })
        .setOrigin(0.5),
    );

    // Count-aware grid inside the shell's content track (mirrors the Tower
    // ladder's count-aware row sizing in GauntletScene.buildTower). The header
    // text block above ends at ~y190 (reward line at y178), so the grid owns
    // the band from gridTop down to the content track's bottom edge; the
    // footer buttons live in the shell's footer track below it, so the two
    // can never overlap.
    //
    // Arithmetic for the current 14-rung tower (820x640 shell, 24px padding,
    // 16px track gap, 44px footer): contentBounds y=124 h=472 (bottom 596),
    // footerTrack y=612. The last row's LABEL extends ~38px below its
    // portrait (8px gap + two 11px wrapped lines), so that block is reserved
    // out of the band BEFORE the row pitch is derived — at 3 rows the naive
    // pitch put the last label 3.5px into the footer margin (caught by
    // tests/ui/layout.test.ts when #84 grew the tower 12 -> 14). With the
    // reserve: rows=3, cols=5, yPitch=(390-38)/3~117.3, cellScale~0.752,
    // last-row label bottom ~579 < 612 footer top.
    const rungCount = ECONOMY.gauntletRungGold.length;
    const bounds = shell.contentBounds;
    const gridTop = Math.max(bounds.y, 206);
    // 38 = label block below the last portrait row (8px gap + ~30px lines).
    const gridBottom = bounds.y + bounds.height - 38;
    const rows = Math.ceil(rungCount / 6);
    const cols = Math.ceil(rungCount / rows);
    const xPitch = Math.min(132, bounds.width / cols);
    const yPitch = Math.min(156, (gridBottom - gridTop) / rows);
    const cellScale = Math.min(1, xPitch / 132, yPitch / 156);
    const x0 = 640 - ((cols - 1) * xPitch) / 2;
    const y0 = gridTop + (gridBottom - gridTop - rows * yPitch) / 2 + yPitch / 2;
    for (let rung = 1; rung <= rungCount; rung++) {
      const col = (rung - 1) % cols;
      const row = Math.floor((rung - 1) / cols);
      const state =
        completed || rung < (failedRung ?? Number.POSITIVE_INFINITY)
          ? 'cleared'
          : rung === failedRung
            ? 'failed'
            : 'unreached';
      this.addGauntletRecapPortrait(
        c,
        this.avatarForGauntletFloor(rung),
        rung,
        x0 + col * xPitch,
        y0 + row * yPitch,
        state,
        cellScale,
      );
    }

    const footerY = shell.tracks.footerTrack.y + shell.tracks.footerTrack.height / 2;
    const mk = (x: number, label: string, variant: 'primary' | 'ghost', cb: () => void): void => {
      const btn = themedButton(this, x, footerY, label, {
        variant,
        minWidth: 170,
        onTap: (p) => {
          if (!p.rightButtonReleased()) cb();
        },
      });
      c.add(btn.container);
    };
    mk(510, 'Main Menu', 'ghost', () => this.scene.start('MainMenu'));
    mk(770, 'Return to Tower', 'primary', () => this.scene.start('Gauntlet'));
    this.guard.open(this.overlayGuardTargets());
  }

  private addGauntletRecapPortrait(
    parent: Phaser.GameObjects.Container,
    avatar: Avatar,
    rung: number,
    x: number,
    y: number,
    state: 'cleared' | 'failed' | 'unreached',
    cellScale = 1,
  ): void {
    const w = Math.round(92 * cellScale);
    const h = Math.round(112 * cellScale);
    const border = state === 'failed' ? 0xd84854 : state === 'cleared' ? 0x6f6688 : 0x3d3060;
    parent.add(
      this.add
        .rectangle(x, y, w, h, 0x171222, state === 'unreached' ? 0.45 : 0.82)
        .setStrokeStyle(state === 'failed' ? 3 : 1, border, state === 'unreached' ? 0.7 : 1),
    );

    const art = Art.resolver?.getArt(avatar.portraitCardId);
    if (art) {
      const img = this.add.image(x, y - 6, art.textureKey, art.frameName).setOrigin(0.5);
      const scale = Math.max((w - 12) / Math.max(1, img.width), (h - 26) / Math.max(1, img.height));
      img.setScale(scale).setAlpha(state === 'unreached' ? 0.22 : state === 'cleared' ? 0.56 : 0.95);
      const maskShape = this.add.rectangle(x, y - 6, w - 12, h - 26, 0xffffff).setVisible(false);
      img.setMask(maskShape.createGeometryMask());
      parent.add(maskShape);
      parent.add(img);
    }

    if (state === 'cleared') {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, 0x09070f, 0.34));
      parent.add(
        this.add
          .text(x, y - 4, '☠', {
            fontFamily: 'Georgia, serif',
            fontSize: '34px',
            color: '#efe9ff',
          })
          .setOrigin(0.5)
          .setAlpha(0.86),
      );
    } else if (state === 'failed') {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, 0x7a1119, 0.48));
      parent.add(
        this.add
          .text(x, y - 4, 'FAILED', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            fontStyle: '800',
            color: '#ffe3e3',
          })
          .setOrigin(0.5),
      );
    } else {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, 0x05040a, 0.5));
    }

    parent.add(
      this.add
        // Short display name: epithets after a comma are dropped so the recap
        // reads "R7 Yohime", not "R7 Yohime, Kitsune Matriarch" (playtest
        // 2026-07-16). Comma-less names (Hestia, The Morrigan) pass through.
        .text(x, y + h / 2 + 8, `R${rung} ${avatar.name.split(',')[0]}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '11px',
          fontStyle: '700',
          color: state === 'failed' ? '#f0b0a0' : state === 'cleared' ? '#c9bde0' : '#5d536e',
          align: 'center',
          wordWrap: { width: Math.round(116 * cellScale) },
        })
        .setOrigin(0.5, 0),
    );
  }
}
