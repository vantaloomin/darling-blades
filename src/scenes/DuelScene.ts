import Phaser from 'phaser';
import { formatGold } from '../ui/goldFormat';
import type { DuelA11yFixtureName, DuelA11yFixture } from '../dev/duelA11yFixtures';
import type { AIPlayer } from '../ai/AIPlayer';
import { buildTierAI, floorTier } from '../ai/tiers';
import { Music } from '../audio/music';
import { selectDuelMood } from '../audio/musicPatterns';
import { Sfx } from '../audio/sfx';
import { buildAI } from '../ai/personality';
import { ECONOMY, RULES, type ReserveFormat } from '../config/rules';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { TUTORIAL_OPPONENT_NAME, TUTORIAL_OPPONENT_PORTRAIT, tutorialCue, type TutorialCueInput, type TutorialCueKind } from '../data/tutorial';
import { avatarById, avatarForRung, AVATARS, type Avatar } from '../data/opponents';
import { draftPersonaById, type DraftPersona } from '../data/draftPersonas';
import { heroById } from '../data/heroes';
import type {
  BasicLandId,
  LandStyleId,
  LandStyleMap,
  SaveData,
} from '../meta/SaveManager';
import {
  PLAYMATS,
  cardBackTextureKey,
  playmatForId,
  resolveDeckCardBackId,
  resolveDeckPlaymatId,
  type PlaymatDefinition,
} from '../meta/cosmetics';
import { STARTER_DECKS } from '../data/starterDecks';
import {
  applyGauntletResult,
  applyLimitedMatchResult,
  applyMatchResult,
  todayString,
  type Difficulty,
} from '../meta/Economy';
import { displayVariantFor } from '../meta/Collection';
import {
  buildAiLandReserve,
  firstDuelLaunchIssue,
  firstReserveConfigIssue,
  avatarReserveSide,
  resolveDuelDifficulty,
  resolveDuelStartingHandSize,
} from '../meta/duelSetup';
import type { CardVariant } from '../meta/variants';
import { localDateKey, resolveGauntletRoster, rungSeed } from '../meta/gauntletSeed';
import { LIMITED_MATCHES, limitedDuelData, limitedLandReserve, personaRevealTier, type LimitedDuelData } from '../meta/Limited';
import { applyDailyQuestProgress, recordDailyWin } from '../meta/Quests';
import {
  finishReplay,
  pushReplay,
  recordReplayAction,
  replayDbStamp,
  replayStartingLife,
  startReplayDraft,
  undoReplayAction,
  type ReplayDraft,
  type ReplayLog,
} from '../meta/Replay';
import { Services } from '../meta/services';
import { checkpointAchievements } from '../meta/achievementCheckpoint';
import { deckColorStyle, type DeckColorStyle } from '../meta/deckColorIdentity';
import { signals, type DuelSignalDeck } from '../net/signals';
import { activatedBlockers, forcedAction, modalTargetSpecs, reasonUncastable, validateAction, type Action } from '../engine/actions';
import { castTargetSpecsFor } from '../engine/resolve';
import { previewCombat } from '../engine/combat/damage';
import { compelledAttackers, eligibleAttackers, blockOptions, minimumBlockersForAttacker } from '../engine/combat/legality';
import type { GameEvent } from '../engine/events';
import { Game } from '../engine/Game';
import { combineManaCosts, manaSources, solveMana } from '../engine/mana';
import { ensureSplitPip } from '../ui/ManaSymbols';
import { ensureNumeralBadgeInk, INTER_FIGURE_HEIGHT } from '../ui/NumeralGlyphs';
import { getEffectiveStats, isSummoningSick, isSwornActive } from '../engine/statics';
import type { CardDef, Color, ManaColor, PlayerId, Permanent, TargetRef } from '../engine/types';
import { activatedAbilitiesOf, cardIdOf, def, isType, manaValue, markCostOf } from '../engine/types';
import { graveRefCard, sameGraveCard } from '../engine/graveyard';
import {
  attachTouchGestures,
  bindTapButton,
  inflateHitArea,
  isTouchDevice,
  setStickyHost,
} from '../platform/gestures';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import { BoardCardView, TILE_W, TILE_H, } from '../ui/BoardCardView';
import { CardZoomPreview, rarityLine } from '../ui/CardZoomPreview';
import { CardView, CARD_W, CARD_H } from '../ui/CardView';
import { CoachMark } from '../ui/CoachMark';
import { CombatFx } from '../ui/CombatFx';
import { planCombat, sequencedBatchRoutes, type CombatHit, type CombatStep } from '../ui/combatSequence';
import { PROVOKED_SPENT_NOTE, provokedSpent, pickBadgeLabel, type CueContext } from '../ui/boardCuePresentation';
import {
  huntDrawnDamage,
  huntExchangeDraw,
  huntFloatText,
  huntStepPrompt,
  planHunts,
  targetStepTitle,
  tookPartInHunt,
  type HuntCreature,
  type HuntedEvent,
  type HuntStep,
  type HuntTargetSource,
} from '../ui/huntPresentation';
import {
  PUMP_TICKER_CANCEL,
  PUMP_TICKER_TITLE,
  manaActivatedEffectText,
  pumpActionsFor,
  pumpBoost,
  pumpBoostText,
  pumpConfirmLabel,
  pumpSubmission,
  pumpSummaryText,
  pumpTicker,
  pumpTickerLimitText,
  stepPumpTicker,
  type ManaPumpAction,
  type PumpTicker,
} from '../ui/manaPumpPresentation';
import {
  COIN_FLIP_ACTION_CENTERS,
  COIN_FLIP_ACTION_WIDTH,
  COIN_FLIP_CALL_Y,
  COIN_FLIP_FACE_TEXTURES,
  COIN_FLIP_RESULT_Y,
  type CoinFlipSide,
} from '../ui/coinFlipLayout';
import { CommanderPortrait } from '../ui/CommanderPortrait';
import { MandateSeal } from '../ui/MandateSeal';
import { swornChip, type SwornChip } from '../ui/swornPresentation';
import { CARD_FACE } from '../config/cardFaceGeometry';
import { castsForModes, modeChooserTitle, modeRows, toggleMode } from '../ui/modeChoice';
import { mandateSealCenter, mandateShown, mandateSpot } from '../ui/mandatePresentation';
import { addPortraitArt } from '../ui/portraitArt';
import { fanLayout } from '../ui/handFan';
import { handDisplayOrder } from '../ui/handSort';
import { HistoryPanel } from '../ui/HistoryPanel';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { queueAchievementUnlockToasts } from '../ui/achievementToast';
import { Toast } from '../ui/Toast';
import { VersusBumper } from '../ui/VersusBumper';
import { combatForecastCopy, concedeConfirmLabel, defeatReasonCopy, resultReasonCopy } from '../ui/duelCopy';
import {
  attackButtonLabel,
  attackDeclaration,
  CARD_TRAVEL_MOTION,
  CONCEDE_ARM_MS,
  DUTY_ACTION_LABEL,
  dutyActionLabel,
  DUTY_CANCEL_LABEL,
  DUTY_PLAYER_LABELS,
  dutyBlockedCopy,
  dutyEffectText,
  dutyNarration,
  dutyTargetsNeedPicker,
  dutyWindowReason,
  type DutyAction,
  departedInBatch,
  eventHistoryLine,
  type EventLineLookup,
  forcedAttackNotice,
  permanentActionLabel,
  duelTilePresentation,
  rageMustAttackNotice,
  refusedMoveLine,
  sacrificeCastChoices,
  type SacrificeCastChoice,
  TARGET_ARROW_HEAD_LENGTH,
  undoBlockedReason,
  hauntlinkActionLabel,
  graveActionChoice,
  hauntlinkOverlap,
  landDropGuardApplies,
  LAND_DROP_CONFIRM_LABEL,
  LAND_DROP_NOTICE,
  orderedGraveyardSlots,
  shouldArmLandDrop,
  targetArrowShaftEnd,
  TARGET_PROMPT_LAYOUT,
  targetPromptTitle,
  type LandDropGuardInput,
  targetRingTone,
  toggleAttacker,
} from '../ui/duelPresentation';
import { fitDuelModal } from '../ui/duelModal';
import { duelButtonPairCenters, duelModalLayout } from '../ui/duelModalPresentation';
import type { Rect } from '../ui/layout';
import { duelRecapLayout } from '../ui/duelRecapPresentation';
import { currentAccessibility } from '../ui/accessibility';
import { CLUSTER_BUTTON, clusterControlX, DUEL_LAYOUT, duelHudType, LIFE_BADGE_SIZE, LIFE_TARGET_RING, manaStripPitch, SEVERED_PILE_HIT } from '../ui/duelLayout';
import { shouldPlayVersusBumper, versusLeitmotifPitch } from '../ui/versusBumperPresentation';
import { activeVisibleSavedDeck } from '../ui/deckBuilderHelpers';
import { ModalGuard } from '../ui/Modal';
import { castActionCost, handCastChoices, sacrificeCandidates, sacrificeSelection, toggleSacrifice, whispersDeadline, type HandCastAction } from '../ui/castSacrifice';
import { confirmDeferredTarget, deferredTargetPrompt, dutyChoices, edictSacrificeSelection, lootDiscardSelection } from '../ui/drownedDeepChoices';
import { confirmedTargetSelection, removeLastTargetSelection, targetSelectionStep, toggleTargetSelection, type TargetSelectionAction } from '../ui/targetSelection';
import { showDutyPicker, showLootPicker, type ChoiceOverlay } from '../ui/choiceOverlays';
import { renderManaText } from '../ui/ManaText';
import { PHASE_TRACK_ROWS, phaseTrackRowForStep, type PhaseTrackRow } from '../ui/phaseTrack';
import { cardGlossaryEntries, empowerText, manaCostText, romanNumeral } from '../ui/rulesText';
import { PileView } from '../ui/PileView';
import { bakeKeywordIcons } from '../ui/KeywordIcons';
import {
  carryCastEligible,
  carryDropAccepted,
  carryTiltDeg,
  stepCarryFollow,
  type CarryFollowPose,
} from '../ui/castIntentPresentation';
import {
  bottomingTitle,
  discardTitle,
  dragMoved,
  libraryStackPlates,
  mulliganTitle,
  riffleShuffleMotion,
  stagedDropAccepted,
  stagedSlots,
  type StackRect,
} from '../ui/mulliganRitualPresentation';
import { groupReserveSlots, landFanSlots } from '../ui/reserveModalPresentation';
import { packRow, type RowPacking } from '../ui/rowPacking';
import { gateOnArt } from '../ui/artGate';
import { duelArtIds, nextDuelArt, prefetchDuelArt } from '../ui/duelArt';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { StackDisplay } from '../ui/StackDisplay';
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel, themedButton, type ModalShell, type ThemedButton } from '../ui/themeWidgets';
import { showZoneContents, type ZoneContentsEntry, type ZoneContentsModal } from '../ui/ZoneContentsModal';

const HUMAN: PlayerId = 0;
const AI: PlayerId = 1;

/** Duel launch contract — see `DuelScene.create` / `DuelScene.build`. */
export interface DuelSceneData {
  /** Dev-only, presentation fixtures never start a live or recorded game. */
  a11yFixture?: DuelA11yFixtureName;
  a11yPage?: number;
  a11yCommitPick?: boolean;
  a11yOverlay?: 'pause' | 'replay-complete' | 'replay-unavailable' | 'recap' | 'coin' | 'result'
    | 'tutorial-pause' | 'tutorial-complete' | 'tutorial-ended';
  /** Dev-only, with `a11yFixture`: open the full-card inspect on this card. */
  a11yInspectCardId?: string;
  difficulty?: Difficulty;
  opponentId?: string;
  gauntletRung?: number;
  // Tutorial overrides (src/data/tutorial.ts): a fixed scripted duel. Absent
  // fields fall back to the normal save-/gauntlet-derived resolution.
  deckOverride?: string[];
  oppDeckOverride?: string[];
  /** Both seats' Warchests: the tutorial is reserve-native since classic retired. */
  landReserveOverride?: [string[], string[]];
  seedOverride?: number;
  aiOverride?: AIPlayer;
  tutorial?: boolean;
  limited?: LimitedDuelData['limited'];
  replay?: ReplayLog;
  /** Dev-only, with `replay`: trailer footage, no replay chrome (src/dev/showcase.ts). */
  showcase?: { speed: number; deckName: string };
}

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
 * "Immersive fan" layout (wireframe 1a, 2026-07-04): the board and HUD
 * geometry lives in the Phaser-free src/ui/duelLayout.ts so its title-safe
 * contract can be rule-tested.
 */
const LAYOUT = DUEL_LAYOUT;

const SEVER_ENABLED = true;
const BOARD_CENTER_X = 640;
/** Last-resort targeting origin when a live source view has already disappeared. */
const TARGET_ARROW_SRC = { x: BOARD_CENTER_X, y: 700 };
const TARGET_SNAP_R = 60;
const TARGET_ARROW_COLOR = 0xffd166;
/** Releasing a carried cast below this line returns it to the hand instead of casting. */
const CARRY_HAND_TOP_Y = 560;
/** Mulligan-ritual library stack anchor and its forgiving drop zone. */
const STACK_X = 1085;
const STACK_Y = 372;
const STACK_DROP: StackRect = { x: STACK_X, y: STACK_Y, halfW: 95, halfH: 125 };
const COLOR_SORT: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const ROW_GUTTER = 6;
const PERMANENT_BAND_SCALE = 0.55;
const PERMANENT_BAND_TILE_W = TILE_W * PERMANENT_BAND_SCALE;
const PERMANENT_BAND_MAX_SPACING = 98;
type ViewableZone = 'deck' | 'graveyard' | 'severed';
type DarlingCastAction = Extract<Action, { type: 'castDarling' }>;
type PendingCastAction = Extract<Action, { type: 'castSpell' }> | DarlingCastAction;
type LinkHauntAction = Extract<Action, { type: 'linkHaunt' }>;
type PendingTargetAction = PendingCastAction | LinkHauntAction | DutyAction;
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
  private a11yFixture: DuelA11yFixture | null = null;
  private duel!: Game;
  /** One-deep pre-action snapshot for local Undo; null when undo is unavailable. */
  private undoSnapshot: Game | null = null;
  /**
   * Why Undo is off after your last action: it showed you a card that was
   * hidden before it (undoBlockedReason). Null whenever that action could be
   * taken back, and cleared wherever the snapshot itself dies.
   */
  private undoBlocked: string | null = null;
  /** Replay recording for this duel (src/meta/Replay.ts); null = not recorded (tutorial). */
  private replayDraft: ReplayDraft | null = null;
  /** Read-only playback state. A replay never shares the recorder draft. */
  private replayLog: ReplayLog | null = null;
  private replayMode = false;
  private replayCursor = 0;
  private replayPlaying = false;
  private replaySpeed: 1 | 2 | 4 = 1;
  /** Dev-only showcase playback: the replay plays itself with no chrome. */
  private showcase: { speed: number; deckName: string } | null = null;
  private replayTimer: Phaser.Time.TimerEvent | null = null;
  private replayGuard = new ModalGuard();
  private replayControls: Phaser.GameObjects.Container | null = null;
  private replayPlayButton: ThemedButton | null = null;
  private replaySpeedButton: ThemedButton | null = null;
  private replayOutcome: Phaser.GameObjects.Container | null = null;
  private reserveFormatsEnabled = false;
  private replayOutcomeShell: ModalShell | null = null;
  private undoBtn!: Phaser.GameObjects.Text;
  /** Always-on combat ledger shown while you assign blocks. */
  private combatPreviewText!: Phaser.GameObjects.Text;
  private ai!: AIPlayer;
  private difficulty: Difficulty = 'easy';
  private opponent: Avatar | null = null; // set in gauntlet mode
  private gauntletRung: number | null = null;
  /** Live run roster cached before results can clear the run from the save. */
  private gauntletRosterOrder: readonly number[] | null = null;
  private views = new Map<number, BoardCardView>(); // battlefield iid → tile
  /** Whose each tile was at the last sync, so a line can still name a permanent that has left. */
  private viewSides = new Map<number, PlayerId>();
  private handViews: CardView[] = [];
  /** Last rendered hand, retained briefly only so rebuild exits can read as motion. */
  private renderedHand: { cardId: string; view: CardView }[] = [];
  /** Previous canonical hand snapshot; reset on every DuelScene create/restart. */
  private previousHand: string[] | null = null;
  /** Last fan poses indexed by canonical hand slot, used if a live origin is unavailable. */
  private handPoses = new Map<number, { x: number; y: number; scale: number; angle: number }>();
  private handDecor: Phaser.GameObjects.GameObject[] = [];
  private landPositions = new Map<string, { x: number; y: number }>();
  private boardTargets = new Map<number, { x: number; y: number; scale: number }>();
  private reservePositions = new Map<string, { x: number; y: number; scale: number; angle: number }>();
  /** Public Darlings command-zone cards, rebuilt from the redacted public view. */
  private darlingZoneViews: CardView[] = [];
  private darlingZoneDecor: Phaser.GameObjects.GameObject[] = [];
  private darlingZoneControls: Phaser.GameObjects.GameObject[] = [];
  private darlingZonePositions = new Map<PlayerId, { x: number; y: number; scale: number; angle: number }>();
  private manaPips: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  private manaStripZones: Phaser.GameObjects.Zone[] = [];
  /** Your mana strip's live pitch (wider than the tuned step at large text). */
  private myManaPitch: number = DUEL_LAYOUT.myManaStrip.step;
  /** Desktop-only hover preview markers for the exact auto-tap mana plan. */
  private manaPlanMarks: Phaser.GameObjects.GameObject[] = [];
  private previousManaSignature: string | null = null;
  private previousDarlingZoneSignature: string | null = null;
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
  private oppReservePile!: PileView;
  private myDeckPile!: PileView;
  private myGravePile!: PileView;
  private mySeveredPile!: PileView;
  private myReservePile!: PileView;
  /** Bottom-left commander portrait — the player's deck face card, reactive. */
  private portrait!: CommanderPortrait;
  /** Top-right mirror of the player portrait — the opponent's deck face, reactive. */
  private oppPortrait!: CommanderPortrait;
  /** Derived identity (create()): portraits cost zero new art (opponents.ts idiom). */
  private myDeckName = '';
  private myDeckColorStyle: DeckColorStyle = 'other';
  /** Active saved-deck cosmetics for the human side; replay/override decks stay default. */
  private humanLandStyle: LandStyleMap | null = null;
  /** Account playmat snapshot for this duel instance, including gauntlet restarts. */
  private playmat: PlaymatDefinition = PLAYMATS[0];
  private myFaceCardId: string | null = null;
  /** Premium hero portrait texture (a bought theme deck's exclusive art), or null. */
  private myHeroTextureKey: string | null = null;
  private oppFaceCardId: string | null = null;
  /** Entry-only overlay. Internal scene restarts consume the one-shot skip marker. */
  private versusBumper: VersusBumper | null = null;
  private versusBumperActive = false;
  private internalRestartPending = false;
  private selectedAttackers = new Set<number>();
  private blockAssignments: { blocker: number; attacker: number }[] = [];
  private pendingBlocker: number | null = null;
  private pendingCasts: PendingTargetAction[] | null = null;
  /** Visual choice only; pendingCasts keeps the existing targeting input guards active. */
  private pendingSacrifice: { casts: HandCastAction[]; selected: number[] } | null = null;
  private targetPicks: TargetRef[] = [];
  /** A submitted pick remains readable during the cast presentation, never as an input candidate. */
  private committedPicks: TargetRef[] = [];
  private committedPickTimer: Phaser.Time.TimerEvent | null = null;
  private committedGraveReadout: Phaser.GameObjects.Container | null = null;
  private targetPicksUnordered = false;
  private targetsExact = false;
  private edictPicks: number[] = [];
  private choiceState: Game['state'] | null = null;
  private targetFocus = 0;
  private keyboardTarget: TargetRef | null = null;
  private lootPicker: ChoiceOverlay | null = null;
  private dutyPicker: ChoiceOverlay | null = null;
  private dutyConfirm: (() => void) | null = null;
  private dutyFinishButton: ThemedButton | null = null;
  private dutyHighlights = new Set<number>();
  private dutyActionsBySource = new Map<number, DutyAction[]>();
  /** Your repeatable mana abilities usable now (1.9 A1.5's pump), by creature; enumerated with the Duties. */
  private pumpActionsBySource = new Map<number, ManaPumpAction[]>();
  private dutyActionsState: Game['state'] | null = null;
  /** The open pump ticker's step (-1, +1), for the arrow keys; null when no ticker is open. */
  private pumpTickerStep: ((delta: number) => void) | null = null;
  /** This batch's `damageMarked` events a Hunt's exchange draws itself (`huntDrawnDamage`). */
  private huntDrawn: ReadonlySet<GameEvent> = new Set();
  /**
   * Hunt exchanges drawn once the board has synced: every Hunt outside a
   * full-motion sequence, and one whose hunter has no tile yet (an arrival or
   * Empower hunter, cast this batch). Positions are captured at narration for
   * the tiles that exist then, so a creature the Hunt killed is still struck
   * where it stood; each creature's card and side are kept too, so one that
   * never had a tile (a hunter that died in its own Hunt) still strikes.
   */
  private pendingHuntFx: { hunt: HuntedEvent; at: Map<number, { x: number; y: number }>; creatures: Map<number, HuntCreature> }[] = [];
  /** The pump notice has been shown in this combat (`offerCombatPump`). */
  private combatPumpOffered = false;
  /** CastIntent carry: a lifted untargeted spell or Reserves land awaiting its placing click. */
  private carry: {
    action: Extract<Action, { type: 'castSpell' | 'playLand' }>;
    proxy: CardView;
    ghost: Phaser.GameObjects.GameObject | null;
    curtain: Phaser.GameObjects.Rectangle;
    pose: CarryFollowPose;
    home: { x: number; y: number; scale: number; angle: number };
    /** Hand casts hide their fan card while carried; a land carry has none. */
    handView: CardView | null;
  } | null = null;
  /** Land-carry R2: the playable reserve kinds fanned above the pile. */
  private landFan: { root: Phaser.GameObjects.Container; curtain: Phaser.GameObjects.Rectangle } | null = null;
  /** Right edge of your mana bead row — where the land-carry ghost bead sits. */
  private myManaRowEndX: number | null = null;
  private arrows!: Phaser.GameObjects.Graphics;
  /** Per-face legal-target outlines; portrait rings live on CommanderPortrait itself. */
  private lifeTargetRings!: { my: Phaser.GameObjects.Graphics; opp: Phaser.GameObjects.Graphics };
  private overlay: Phaser.GameObjects.Container | null = null;
  /** Display-only source card and relevant ability text for mandatory arrival targets. */
  private targetPrompt: Phaser.GameObjects.Container | null = null;
  private guard = new ModalGuard();
  private toasts: Toast | null = null;
  private toastHeldForTurnBoundary = false;
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
  /** Texture key for the deck's card back; the library renders face-down with it. */
  private humanCardBackKey = 'cardback';
  /**
   * Optional first-launch tutorial mode (src/data/tutorial.ts). When set, this
   * duel runs a scripted line (fixed decks + seed + `ScriptAI`) under a
   * coach-mark guide; auto-skip is off and results route to `tutorialComplete`
   * instead of the ranked win/loss path.
   */
  private tutorial = false;
  /**
   * The human deck exactly as this duel was launched, held only so the
   * end-of-duel anonymous digest can derive colours, curve and precon-ness from
   * it (src/net/signals.ts). Nothing on it is ever emitted, and it is replaced
   * on every create().
   */
  private signalDeck: DuelSignalDeck | null = null;
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
  private tutWarchestInfoShown = false;
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
  /**
   * Dev-only: draw the tutorial's own chrome (the pause menu's Leave Tutorial
   * row and its "Tutorial" matchup line) over a fixture board without turning
   * on the live tutorial, so no coach ticks and Leave Tutorial stays inert
   * (`leaveTutorial` still requires `tutorial`); nothing writes the save.
   */
  private a11yTutorialChrome = false;
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
  /** The Mandate's seal (2.0 lane B4); null until the board is built. */
  private mandateSeal: MandateSeal | null = null;
  /** The turn chip's drawn width: the unclaimed seal waits just past it. */
  private turnPillWidth = 52;
  private previousPhaseRow: PhaseTrackRow | null = null;
  private forecastWasLethal = false;
  /** Underlying life-driven tension survives a temporary lethal-visible bed. */
  private duelTensionActive = false;
  /** Empty-block confirmation is scene-local and never changes the submitted action. */
  private noBlockArmed = false;
  private landDropArmed = false;
  private landDropArmTimer: Phaser.Time.TimerEvent | null = null;
  private noBlockArmTimer: Phaser.Time.TimerEvent | null = null;
  /** Clear the no-block arm when a decision kind changes, before stale input can land. */
  private lastAwaitingKind: string | null = null;
  /** The off-motion fallback still briefly reveals opponent casts. */
  private oppCastReveal?: Phaser.GameObjects.Container;
  private pendingPlayReveals: PlayReveal[] = [];
  private humanPlayOrigin: { cardId: string; source: { x: number; y: number; scale: number; angle: number } } | null = null;
  private playRevealGhosts = new Set<CardView>();
  /** Retell action ids stay available until their graveyard exit is narrated. */
  private retellSpellIds = new Set<number>();
  private retellCardsInFlight = new Set<string>();
  private whispersSpellIds = new Set<number>();
  /** Link ids announced by the engine before their host-linked death event. */
  private brokenHauntlinks = new Set<number>();

  constructor() {
    super('Duel');
  }

  /**
   * The card-art gate (1.8, `src/ui/artGate.ts`). Card art streams in behind
   * the menu now, so a duel launched in the first seconds of a session waits
   * for its own cards and nothing else — the tutorial duel is four art files.
   * While art streams through the art store (1.9 lane D) the gate's lease
   * holds the duel's set until SHUTDOWN, and a Tower rung's restart keeps what
   * the next rung shares (`src/ui/duelArt.ts`).
   *
   * The body below is unchanged, wrapped as-is as `build`.
   */
  create(data: DuelSceneData = {}): void {
    this.a11yFixture = null;
    this.a11yTutorialChrome = false;
    this.data.set('a11yReady', false);
    if (import.meta.env.DEV && data.a11yFixture) {
      void import('../dev/duelA11yFixtures').then(({ wave2DDuelFixture }) => {
        if (!this.sys.isActive()) return;
        const fixture = wave2DDuelFixture(data.a11yFixture!);
        this.a11yFixture = fixture;
        const ids = [...new Set([
          ...fixture.state.battlefield.map(p => p.cardId), ...fixture.state.stack.map(p => p.cardId),
          ...fixture.state.players.flatMap(p => [...p.hand, ...p.graveyard, ...p.deck].map(cardIdOf)),
        ])];
        gateOnArt(this, ids, () => this.build({ ...data, deckOverride: STARTER_DECKS[0].cards,
          oppDeckOverride: STARTER_DECKS[1].cards, seedOverride: 19 }));
      });
      return;
    }
    // The gate's lease takes over the prefetch made when this opponent was chosen.
    nextDuelArt.handOver(() =>
      gateOnArt(this, duelArtIds(data, Services.save.data, FEATURES.reserveFormats), () => this.build(data)),
    );
  }

  private build(data: DuelSceneData): void {
    const internalRestart = this.internalRestartPending;
    this.internalRestartPending = false;
    this.versusBumper?.destroy();
    this.versusBumper = null;
    this.versusBumperActive = false;
    // A restart already destroyed the display objects; only the state survives.
    this.carry = null;
    this.landFan = null;
    this.myManaRowEndX = null;
    this.myManaPitch = DUEL_LAYOUT.myManaStrip.step;
    this.reserveFormatsEnabled = FEATURES.reserveFormats;
    if (!this.reserveFormatsEnabled && data.replay?.format) {
      this.scene.start('Profile');
      return;
    }
    // When present, an avatar drives the deck and personality. Gauntlet
    // inherits that avatar's tuned difficulty; Practice may explicitly
    // override the brain tier while keeping the real deck and temperament.
    this.replayLog = data.replay ?? null;
    this.replayMode = this.replayLog !== null;
    this.showcase = import.meta.env.DEV && this.replayMode && data.showcase ? data.showcase : null;
    this.replayCursor = 0;
    this.replayPlaying = false;
    this.replaySpeed = 1;
    this.replayTimer = null;
    this.replayControls = null;
    this.replayPlayButton = null;
    this.replaySpeedButton = null;
    this.replayOutcome = null;
    this.replayOutcomeShell = null;
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
    this.tutWarchestInfoShown = false;
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
    this.viewSides = new Map();
    this.handViews = [];
    this.renderedHand = [];
    this.previousHand = null;
    this.handPoses = new Map();
    this.handDecor = [];
    this.landPositions = new Map();
    this.boardTargets = new Map();
    this.reservePositions = new Map();
    this.pendingPlayReveals = [];
    this.humanPlayOrigin = null;
    this.humanLandStyle = null;
    this.playRevealGhosts = new Set();
    this.retellSpellIds = new Set();
    this.retellCardsInFlight = new Set();
    this.whispersSpellIds = new Set();
    this.brokenHauntlinks = new Set();
    this.manaPips = [];
    this.manaStripZones = [];
    this.manaPlanMarks = [];
    this.previousManaSignature = null;
    this.previousLife = null;
    this.previousPhaseRow = null;
    this.forecastWasLethal = false;
    this.duelTensionActive = false;
    this.noBlockArmTimer?.remove();
    this.noBlockArmTimer = null;
    this.noBlockArmed = false;
    this.landDropArmTimer?.remove();
    this.landDropArmTimer = null;
    this.landDropArmed = false;
    this.lastAwaitingKind = null;
    this.selectedAttackers = new Set();
    this.blockAssignments = [];
    this.pendingBlocker = null;
    this.undoSnapshot = null;
    this.undoBlocked = null;
    this.replayDraft = null;
    // Scene instances are REUSED on restart: a stale aiTimer reference from an
    // abandoned duel (left mid-AI-decision) points at the dead clock and its
    // `if (this.aiTimer) return` guard would mute the AI forever (found live
    // 2026-07-16; the restart-hygiene trap class from playbook §11).
    this.aiTimer = null;
    this.pendingCasts = null;
    this.pendingSacrifice = null;
    this.targetPicks = [];
    this.committedPicks = [];
    this.committedPickTimer = null;
    this.committedGraveReadout = null;
    this.targetPicksUnordered = false;
    this.edictPicks = [];
    this.choiceState = null;
    this.targetFocus = 0;
    this.keyboardTarget = null;
    this.lootPicker = null;
    this.dutyPicker = null;
    this.dutyConfirm = null;
    this.dutyFinishButton = null;
    this.dutyHighlights = new Set();
    this.dutyActionsBySource = new Map();
    this.pumpActionsBySource = new Map();
    this.dutyActionsState = null;
    this.pumpTickerStep = null;
    this.huntDrawn = new Set();
    this.pendingHuntFx = [];
    this.combatPumpOffered = false;
    this.empowerChooser = null;
    this.empowerChooserGuard = new ModalGuard();
    this.gravePicker = null;
    this.gravePickerGuard = new ModalGuard();
    this.overlay = null;
    this.targetPrompt = null;
    this.guard = new ModalGuard();
    this.toastHeldForTurnBoundary = !this.replayMode;
    this.toasts = this.replayMode
      ? null
      : new Toast(this, {
          modalGuard: this.guard,
          isBlocked: () =>
            this.overlay !== null ||
            this.inspect !== null ||
            this.pauseOverlay !== null ||
            this.zoneModal !== null ||
            this.isHumanTurnDecision(),
          held: true,
        });
    this.inspect = null;
    this.inspectGuard = new ModalGuard();
    this.inspectMove = null;
    this.pauseOverlay = null;
    this.pauseGuard = new ModalGuard();
    this.zoneModal = null;
    this.zoneGuard = new ModalGuard();
    this.zoneModalReturn = null;
    this.darlingZoneViews = [];
    this.darlingZoneDecor = [];
    this.darlingZoneControls = [];
    this.darlingZonePositions = new Map();
    this.previousDarlingZoneSignature = null;
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
    const myDeckEntry = activeVisibleSavedDeck(save.decks, save.activeDeckId, this.reserveFormatsEnabled);
    // Style follows the deck you brought (v33), falling back to the account
    // pick for decks that never chose. A replay or an overridden deck is not
    // "your deck", so those use the account values.
    const styleDeck = this.replayMode || data.deckOverride !== undefined ? null : myDeckEntry;
    this.playmat = playmatForId(resolveDeckPlaymatId(styleDeck));
    this.humanCardBackKey = cardBackTextureKey(resolveDeckCardBackId(styleDeck));
    this.humanLandStyle = !this.replayMode && data.deckOverride === undefined && myDeckEntry?.landStyle
      ? { ...myDeckEntry.landStyle }
      : null;
    const myDeck = data.replay?.decks[0].slice() ?? data.deckOverride ?? myDeckEntry?.cards ?? STARTER_DECKS[0].cards;
    this.myDeckColorStyle = deckColorStyle(myDeck, CARD_DB);
    // Gauntlet and Practice: the avatar pilots its themed deck. Tutorial: a
    // fixed deck. Since classic retired (1.6) the Tower is a reserve field
    // too, so the gauntlet rung no longer excludes itself here; PlayScene is
    // the gate that decides WHICH reserve format may enter the Tower.
    const savedReserveFormat: ReserveFormat | undefined =
      !this.replayMode && !this.tutorial && !this.limited && data.deckOverride === undefined &&
      (myDeckEntry?.format === 'darlings' || myDeckEntry?.format === 'warchest')
        ? myDeckEntry.format
        : undefined;
    // Limited is reserve-native: a drafted deck is 25 spells and both seats
    // receive a ten-land Warchest. The draft run supplies the chosen player
    // reserve and the matching opponent reserve when available.
    const limitedReserveFormat: ReserveFormat | undefined =
      this.limited && !this.replayMode ? 'warchest' : undefined;
    // The tutorial teaches the format the game actually plays (1.6). It carries
    // deckOverride, which excludes it from savedReserveFormat above, so it
    // names its own format and brings its own two Warchests.
    const tutorialReserveFormat: ReserveFormat | undefined =
      this.tutorial && !this.replayMode && data.landReserveOverride ? 'warchest' : undefined;
    const reserveFormat: ReserveFormat | undefined =
      data.replay?.format ?? savedReserveFormat ?? limitedReserveFormat ?? tutorialReserveFormat;
    // Stage 3 of the 1.6 migration, extended to the Tower by classic
    // retirement: a reserve-format duel fields the selected avatar's own
    // designed deck (Warchest) or Darlings variant. The old player-deck
    // mirror survives only when no avatar is selected (dev overrides);
    // replays keep their recorded seats.
    const aiReserveSide =
      reserveFormat && !this.replayMode && !data.oppDeckOverride
        ? avatarReserveSide(
            this.opponent ?? null,
            reserveFormat,
            myDeck,
            myDeckEntry?.darlingId ?? null,
            CARD_DB,
          )
        : null;
    const aiDeck =
      data.replay?.decks[1].slice() ??
      data.oppDeckOverride ??
      (aiReserveSide
        ? aiReserveSide.deck
        : this.opponent
        ? this.opponent.deck
        : (STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards));
    const landReserves: [string[], string[]] | undefined = reserveFormat
      ? [
          this.replayMode
            ? this.replayReserveAt(data.replay?.landReserves, 0)
            : limitedReserveFormat
              ? data.landReserveOverride?.[0]?.slice() ?? limitedLandReserve(CARD_DB, myDeck)
              : tutorialReserveFormat
                ? data.landReserveOverride![0].slice()
                : Array.isArray(myDeckEntry?.landReserve)
                  ? myDeckEntry.landReserve.slice()
                  : [],
          this.replayMode
            ? this.replayReserveAt(data.replay?.landReserves, 1)
            : limitedReserveFormat
              ? data.landReserveOverride?.[1]?.slice() ?? buildAiLandReserve(aiDeck, CARD_DB)
              : tutorialReserveFormat
                ? data.landReserveOverride![1].slice()
                : aiReserveSide?.reserve ?? buildAiLandReserve(aiDeck, CARD_DB),
        ]
      : undefined;
    const darlings: [string | null, string | null] | undefined = reserveFormat === 'darlings'
      ? this.replayMode
        ? [this.replayDarlingAt(data.replay?.darlings, 0), this.replayDarlingAt(data.replay?.darlings, 1)]
        : [myDeckEntry?.darlingId ?? null, aiReserveSide?.darlingId ?? myDeckEntry?.darlingId ?? null]
      : undefined;
    // Limited and the tutorial play fixed lists, not a SavedDeck, so the
    // saved-deck legality gate does not apply to them; both reserve payloads
    // are still validated.
    const launchIssue = reserveFormat
      ? (this.replayMode || limitedReserveFormat || tutorialReserveFormat
          ? null
          : firstDuelLaunchIssue(CARD_DB, save, myDeckEntry ?? null)) ??
        firstReserveConfigIssue(CARD_DB, landReserves)
      : null;
    if (launchIssue) {
      this.scene.start('Play', { launchNotice: `Duel unavailable: ${launchIssue}` });
      return;
    }

    // Old instance (gauntlet restarts) tears itself down on scene shutdown.
    // Touch: long-press docks the preview STICKY; tapping the preview is the
    // touch equivalent of right-click inspect (mobile-lan-plan §1.3). During
    // targeting inspect stays blocked (right-click cancels there on desktop).
    this.zoom = new CardZoomPreview(this, {
      // Keep the docked card above the player mana-plan strip. At 1.1x the
      // preview is 462px tall, so this center leaves its lower edge at 461.
      scale: 1.1,
      dockY: 230,
      onStickyTap: (card, variant, landStyle) => {
        if (this.pendingCasts) this.zoom.dismissSticky();
        else this.showInspect(card, variant, landStyle);
      },
    });
    setStickyHost(this, this.zoom);

    this.buildZones();
    bakeKeywordIcons(this);
    this.arrows = this.add.graphics().setDepth(50);
    // Duel identities, the opponents.ts "portraits cost zero new art" idiom:
    // your commander portrait is your deck's face card; the opponent's strip
    // avatar is their curated portraitCardId (gauntlet), the draft persona's,
    // the tutorial's own pick (its deck's face is the player's face too), or
    // their deck's face.
    this.myDeckName = this.showcase
      ? this.showcase.deckName
      : this.replayMode
      ? 'Replay Deck'
      : this.limited
        ? 'Draft Deck'
        : myDeckEntry?.name ?? STARTER_DECKS[0].name;
    // A deck-builder star is this specific deck's hero image. Limited/tutorial
    // deck overrides ignore saved-deck art; otherwise fall back to the old
    // premium/default hero behavior, then the active deck's derived face.
    const darlingHero =
      !data.deckOverride && myDeckEntry?.format === 'darlings'
        ? darlingFaceCardFor({ ...myDeckEntry, cards: myDeck }, CARD_DB)
        : null;
    const deckHero =
      darlingHero ??
      (!data.deckOverride && myDeckEntry?.heroCardId && CARD_DB[myDeckEntry.heroCardId] && myDeck.includes(myDeckEntry.heroCardId)
        ? myDeckEntry.heroCardId
        : null);
    const defaultHero = !deckHero && save.heroCardId && CARD_DB[save.heroCardId] ? save.heroCardId : null;
    this.myHeroTextureKey = deckHero ? null : this.resolveHeroPortrait(save);
    this.myFaceCardId = deckHero ?? defaultHero ?? faceCardFor(myDeck, CARD_DB);
    this.oppFaceCardId =
      this.opponent?.portraitCardId ??
      this.limitedPersona?.portraitCardId ??
      (this.tutorial ? TUTORIAL_OPPONENT_PORTRAIT : null) ??
      faceCardFor(aiDeck, CARD_DB);
    // Warchest deals a 5-card opener (2026-08-07 ratification); classic and
    // Darlings keep 7. Replays always defer to their recorded value, so
    // pre-flip logs (absent field) reconstruct their original 7-card deals.
    const startingHandSize = resolveDuelStartingHandSize(
      reserveFormat,
      this.replayMode ? data.replay ?? null : null,
    );
    this.duel = new Game({
      decks: [myDeck, aiDeck],
      seed,
      db: CARD_DB,
      ...(startingHandSize === undefined ? {} : { startingHandSize }),
      // A replay plays at the life its game was recorded at.
      ...(this.replayLog ? { startingLife: replayStartingLife(this.replayLog) } : {}),
      ...(reserveFormat === 'darlings' && landReserves && darlings
        ? { format: reserveFormat, landReserves, darlings }
        : reserveFormat === 'warchest' && landReserves
          ? { format: reserveFormat, landReserves }
        : {}),
      // The fixed tutorial scripts its opening and auto-keeps both hands.
      // Every normal duel path, including Limited and gauntlet, opts in.
      playDrawChoice: !this.tutorial,
      ...(this.tutorial ? { rulesRev: 1 as const } : {}),
    });
    // Anonymous duel digest (src/net/signals.ts): the launched human list, kept
    // because the results path can no longer reconstruct it. Read only to
    // derive colours, curve and precon-ness; no card id from it is ever sent.
    this.signalDeck = {
      cards: myDeck.slice(),
      landReserve: landReserves?.[0] ?? null,
      darlingId: darlings?.[0] ?? null,
      savedFormat: myDeckEntry?.format ?? null,
    };
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
          ...(startingHandSize === undefined ? {} : { startingHandSize }),
          context: {
            mode: this.limited ? 'limited' : this.gauntletRung != null ? 'gauntlet' : 'practice',
            difficulty: this.difficulty,
            opponentId: this.opponent?.id ?? null,
            opponentName: this.opponent?.name ?? this.limitedPersona?.name ?? `Practice AI (${this.difficulty})`,
            gauntletRung: this.gauntletRung,
          },
          ...(reserveFormat === 'darlings' && landReserves && darlings
            ? { format: reserveFormat, landReserves, darlings }
            : reserveFormat === 'warchest' && landReserves
              ? { format: reserveFormat, landReserves }
              : {}),
        });

    if (this.a11yFixture) {
      this.duel = Game.restore(this.a11yFixture.state, CARD_DB);
      this.replayDraft = null;
      this.signalDeck = null;
    }
    if (this.a11yFixture) {
      this.myDeckName = this.a11yFixture.humanName;
      this.myFaceCardId = this.a11yFixture.humanFaceCardId;
      this.oppFaceCardId = this.a11yFixture.opponentFaceCardId;
    }
    this.buildHud();
    this.bindHotkeys();
    if (this.replayMode && !this.showcase) this.buildReplayControls();
    if (this.showcase) window.__showcase = { state: 'playing' };
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
      this.empowerChooserGuard.close();
      this.gravePickerGuard.close();
      for (const ghost of this.playRevealGhosts) {
        this.tweens.killTweensOf(ghost);
        if (ghost.active) ghost.destroy();
      }
      this.playRevealGhosts.clear();
      this.versusBumper?.destroy();
      this.versusBumper = null;
      this.versusBumperActive = false;
    });
    if (this.tutorial) {
      // The coach-mark guide layer is display-only until its scripted beat
      // opens each target; the HUD no longer exposes an auto-skip control.
      this.coach = new CoachMark(this);
    }
    if (this.a11yFixture) {
      const fixture = this.a11yFixture;
      this.selectedAttackers = new Set(fixture.selectedAttackers);
      this.blockAssignments = fixture.blockAssignments;
      this.pendingCasts = fixture.pendingCasts;
      this.targetPicks = data.a11yCommitPick ? [] : fixture.targetPicks;
      this.targetPicksUnordered = fixture.targetPicksUnordered;
      this.choiceState = this.duel.state;
      this.sync();
      if (data.a11yCommitPick && fixture.targetPicks[0]) this.tryTarget(fixture.targetPicks[0]);
      this.showA11yPanel(fixture, data.a11yPage ?? 0);
      if (data.a11yOverlay === 'pause') this.showPauseMenu();
      if (data.a11yOverlay === 'result') this.showPracticeResultPanel(true, '', this.rewardLine(9999999, true, 7, true));
      if (data.a11yOverlay === 'recap') this.showGauntletRunRecap(false, 28, 'concede', this.rewardLine(9999999, true, 7), data.a11yPage);
      if (data.a11yOverlay === 'coin') this.buildCoinFlipOverlay(HUMAN);
      if (data.a11yOverlay === 'tutorial-pause') {
        this.a11yTutorialChrome = true;
        this.showPauseMenu();
      }
      // The overlay alone: the real path's grant (which writes the save) never runs.
      if (data.a11yOverlay === 'tutorial-complete') this.showTutorialCompleteOverlay(true, true);
      if (data.a11yOverlay === 'tutorial-ended') this.showTutorialCompleteOverlay(false, false);
      if (data.a11yOverlay?.startsWith('replay-')) {
        this.replayMode = true;
        this.finishReplayPlayback(data.a11yOverlay === 'replay-complete' ? 'Replay complete' : 'Replay unavailable');
      }
      if (data.a11yInspectCardId) this.showInspect(def(CARD_DB, data.a11yInspectCardId));
      this.data.set('a11yReady', true);
      return;
    }
    const showVersusBumper = shouldPlayVersusBumper({
      animations: this.motionLevel(),
      tutorial: this.tutorial,
      replay: this.replayMode,
      internalRestart,
    });
    if (showVersusBumper) {
      const opponentName = this.opponentName() ?? `${this.difficulty} AI`;
      this.versusBumperActive = true;
      Sfx.play('versus', {
        pitch: versusLeitmotifPitch(this.opponent?.id ?? this.oppFaceCardId ?? opponentName),
      });
      this.versusBumper = new VersusBumper(this, {
        animations: this.motionLevel() === 'reduced' ? 'reduced' : 'full',
        player: {
          cardId: this.myFaceCardId,
          ...(this.myHeroTextureKey ? { textureKey: this.myHeroTextureKey } : {}),
          label: this.myDeckName,
        },
        opponent: { cardId: this.oppFaceCardId, label: opponentName },
        onComplete: () => {
          if (!this.sys.isActive()) return;
          this.versusBumper = null;
          this.versusBumperActive = false;
          this.beginDuel();
        },
      });
      return;
    }
    this.beginDuel();
  }

  private showA11yPanel(fixture: DuelA11yFixture, page: number): void {
    switch (fixture.panel) {
      case 'history':
        for (const entry of fixture.history) this.history.push(entry.text, entry.cardId);
        this.history.showPage(page);
        break;
      case 'graveyard': this.showZoneModal(HUMAN, 'graveyard'); this.zoneModal?.showPage(page); break;
      case 'grave-picker': this.showGravePicker(fixture.pendingCasts ?? []); break;
      case 'duty': {
        const card = def(CARD_DB, fixture.dutyCardId!);
        this.dutyPicker = showDutyPicker(this, { card, touch: false,
          choices: () => dutyChoices(card,
            this.duel.state.battlefield.find(p => p.cardId === card.id)!.iid, this.duel.legalActions(HUMAN)),
          choose: () => {}, cancel: () => { this.dutyPicker?.container.destroy(); this.dutyPicker = null; } });
        break;
      }
      case 'coach-cue': case 'coach-info':
        this.coach = new CoachMark(this);
        if (fixture.panel === 'coach-info') this.coach.showInfoCard(fixture.coachText!, () => {});
        else this.coach.showCue(this.passArc, fixture.coachText!);
        break;
    }
    this.stackDisplay.showPage(page);
  }

  /** Keep the deterministic game idle until the entry presentation releases it. */
  private beginDuel(): void {
    this.processEvents(this.duel.initialEvents);
    if (this.tutorial) this.autoKeepTutorialMulligans();
    this.sync();
    this.maybeRunAI();
    this.maybeAutoSkip();
    if (this.replayMode) this.startReplayPlayback();
  }

  private replayReserveAt(payload: unknown, player: 0 | 1): string[] {
    if (!Array.isArray(payload) || !Array.isArray(payload[player])) return [];
    const reserve = payload[player];
    return reserve.every((id): id is string => typeof id === 'string') ? reserve.slice() : [];
  }

  private replayDarlingAt(payload: unknown, player: 0 | 1): string | null {
    if (!Array.isArray(payload)) return null;
    const darling = payload[player];
    return typeof darling === 'string' ? darling : null;
  }

  private humanLandStyleFor(cardId: string): LandStyleId | undefined {
    return this.humanLandStyle?.[cardId as BasicLandId];
  }

  /**
   * Skip the opening-hand mulligan overlay in tutorial mode: keep both hands so
   * the duel starts at Morning (the mulligan is not one of the six
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
      case 'warchestInfo':
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
          else if (kind === 'warchestInfo') this.tutWarchestInfoShown = true;
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
   * smart button ARE their own interactive object. `null` deadens everything
   * but ⚙ Menu, which always stays live so the player can leave the tutorial.
   */
  private lockTutorialInput(target: Phaser.GameObjects.GameObject | null): void {
    const exempt = target instanceof BoardCardView ? (target.inputZone ?? null) : target;
    // Disabling a hovered object's input zone makes Phaser drop it from the
    // over-list WITHOUT firing pointerout, so any live hover-zoom preview would
    // stay stuck on screen. Clear it as we re-lock (the player can re-hover the
    // one live target); this runs on every beat change, never mid-read.
    this.zoom.cancel();
    this.tutorialGuard.close();
    this.tutorialGuard.open(this.overlayGuardTargets().filter((o) => o !== exempt && o !== this.menuBtn));
  }

  private buildTutorialInput(): TutorialCueInput {
    const st = this.duel.state;
    const a = this.duel.awaiting;
    const isHumanTurn = 'player' in a && a.player === HUMAN;
    const you = st.players[HUMAN];
    const legal = isHumanTurn ? this.duel.legalActions(HUMAN) : [];
    // Reserve formats never hold lands in hand, so read the legal-action list:
    // it covers the classic hand drop and the Warchest reserve drop alike.
    const canPlayLand = legal.some((l) => l.type === 'playLand');
    const castableOfType = (t: import('../engine/types').CardType): boolean =>
      legal.some((action) => {
        if (action.type !== 'castSpell') return false;
        const cardId = this.actionCardId(action);
        return cardId !== undefined && isType(def(CARD_DB, cardId), t);
      });
    const hasCastableCreature = castableOfType('creature');
    const hasCastableRitual = castableOfType('ritual');
    const hasCastableCharm = castableOfType('charm');
    const handHasCharm = you.hand.some((id) => isType(def(CARD_DB, id), 'charm'));
    const myCreatureCount = st.battlefield.filter(
      (p) => p.controller === HUMAN && isType(def(CARD_DB, p.cardId), 'creature'),
    ).length;
    const eligibleAttackerCount =
      isHumanTurn && a.kind === 'declareAttackers'
        ? eligibleAttackers(st, CARD_DB, HUMAN).length
        : 0;
    const hasLegalBlocker =
      isHumanTurn && a.kind === 'declareBlockers' && st.combat
        ? blockOptions(st, CARD_DB, HUMAN, st.combat).length > 0
        : false;
    return {
      isHumanTurn,
      awaitingKind: a.kind,
      step: st.step,
      canPlayLand,
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
      warchestInfoShown: this.tutWarchestInfoShown,
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
        // Warchest: the land drop starts at the Reserves pile, which opens the
        // picker. Its inflated inputZone is both the spotlight bounds and the
        // one control lockTutorialInput leaves live.
        return this.myReservePile.inputZone ?? this.handTarget((d) => isType(d, 'land'));
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
        const iid = eligibleAttackers(st, CARD_DB, HUMAN)[0];
        return iid != null ? (this.views.get(iid) ?? null) : null;
      }
      case 'selectBlocker': {
        if (!st.combat) return null;
        const iid = blockOptions(st, CARD_DB, HUMAN, st.combat)[0]?.blocker;
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
    const firstTime = this.grantTutorialOnboarding();
    Music.duck(1.8);
    Sfx.play(success ? 'win' : 'click');
    this.showTutorialCompleteOverlay(success, firstTime);
  }

  /**
   * The lesson's closing overlay: a full-stage dim with the headline, the
   * Shop nudge, the first-time gold and two actions. Presentation only (the
   * grant happened before), so the a11y fixture can draw it without a save.
   * Release anchors hold at 100% text; larger text pushes a colliding row down
   * and the two actions apart, never shrinking or clipping a line.
   */
  private showTutorialCompleteOverlay(success: boolean, firstTime: boolean): void {
    const width = theme.design.width;
    const height = theme.design.height;
    const cx = theme.design.centerX;
    // Wide enough for the title and the one-line message at 130% text; every
    // line wraps inside the panel's 24px inset.
    const TUTORIAL_PANEL_WIDTH = 760;
    const c = this.add.container(0, 0).setDepth(120);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, theme.graphics.dim, 0.8).setInteractive());
    type RowObject = Phaser.GameObjects.Text | Phaser.GameObjects.Container;
    const rows: { y: number; objects: RowObject[] }[] = [];
    const row = (y: number, ...objects: RowObject[]): void => {
      for (const object of objects) {
        c.add(object);
        if (object instanceof Phaser.GameObjects.Text) {
          object.setData('a11yKeepVisible', true).setData('a11yFullText', object.text);
        }
      }
      rows.push({ y, objects });
    };
    row(244, this.add
      .text(cx, 244, success ? 'Tutorial Complete!' : 'Tutorial Ended', {
        fontFamily: theme.fonts.display, fontSize: `${duelHudType(52, 'display')}px`, fontStyle: 'bold', color: theme.colors.goldHover,
        align: 'center', wordWrap: { width: TUTORIAL_PANEL_WIDTH - 48, useAdvancedWrap: true },
      })
      .setOrigin(0.5));
    row(312, this.add
      .text(cx, 312, "You've got the basics. Now claim your free deck in the Shop.", {
        fontFamily: theme.fonts.ui, fontSize: `${duelHudType(18, 'label')}px`, color: theme.colors.body,
        align: 'center', wordWrap: { width: TUTORIAL_PANEL_WIDTH - 48 },
      })
      .setOrigin(0.5));
    if (firstTime) {
      row(356, this.add
        .text(cx, 356, `+${formatGold(ECONOMY.startingGold)}`, {
          fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, fontStyle: '600', color: theme.colors.gold,
        })
        .setOrigin(0.5));
    }
    // The same buttons as every other result panel: the Shop is the one gold
    // action (the free deck waits there), the menu the quiet way out. They
    // were display-font text plates until 2026-10-08, unlike any other modal.
    const shop = themedButton(this, cx, 440, 'To the Shop', {
      variant: 'primary', minWidth: 200, onTap: () => this.scene.start('Shop', { tab: 'decks' }),
    });
    const menu = themedButton(this, cx, 440, 'Main Menu', {
      variant: 'ghost', minWidth: 200, onTap: () => this.scene.start('MainMenu'),
    });
    const textScale = currentAccessibility().textScale;
    const [shopX, menuX] = duelButtonPairCenters(cx, 120,
      [shop.getMeasuredSize().hit.width, menu.getMeasuredSize().hit.width], textScale);
    shop.container.setX(shopX);
    menu.container.setX(menuX);
    row(440, shop.container, menu.container);
    const union = (objects: readonly RowObject[]): Rect => {
      const b = objects.map((o) => o.getBounds());
      const x = Math.min(...b.map((r) => r.x)), y = Math.min(...b.map((r) => r.y));
      return { x, y, width: Math.max(...b.map((r) => r.right)) - x, height: Math.max(...b.map((r) => r.bottom)) - y };
    };
    const layout = duelModalLayout(
      { x: cx - TUTORIAL_PANEL_WIDTH / 2, y: 180, width: TUTORIAL_PANEL_WIDTH, height: 310 },
      rows.map(({ y, objects }) => ({ y, bounds: union(objects) })),
      textScale,
      { safe: { x: theme.design.safeLeft, y: theme.design.titleSafe.top, width: theme.design.safeWidth, height: theme.design.safeHeight } },
    );
    rows.forEach(({ objects }, index) => {
      for (const object of objects) object.setY(object.y + layout.rows[index].offsetY);
    });
    // An opaque panel like the other result modals, sized by the layout and
    // drawn behind the rows (just above the dim).
    const plate = panel(this, layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, { alpha: 1 });
    c.addAt(plate, 1);
    this.guard.open(this.overlayGuardTargets());
  }

  /** Mark the tutorial seen and pay the onboarding bonus once, exactly as Skip does. */
  private grantTutorialOnboarding(): boolean {
    const save = Services.save.data;
    const firstTime = !save.tutorialDone;
    save.tutorialDone = true;
    if (firstTime) save.gold += ECONOMY.startingGold; // onboarding bonus (same on skip)
    Services.save.flush();
    return firstTime;
  }

  /**
   * ⚙ Menu → Leave Tutorial, the mid-lesson counterpart of the first-run Skip
   * (MainMenuScene.skipTutorial). It is not an engine concede, so no result
   * screen runs and nothing reaches profile stats, streaks or quests. A
   * first-timer gets Skip's bonus and lands on the Shop's Decks tab to claim
   * the free starter; a replay from How to Play returns to the menu it came
   * from. Either way the lesson stays replayable from How to Play.
   */
  private leaveTutorial(): void {
    if (!this.tutorial || this.tutCompleted) return;
    this.tutCompleted = true;
    this.ended = true;
    this.tearDownPauseMenu();
    this.tutorialGuard.close();
    this.coach?.destroy();
    this.coach = null;
    if (this.grantTutorialOnboarding()) this.scene.start('Shop', { tab: 'decks' });
    else this.scene.start('MainMenu');
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
    const colors = this.playmat.colors;
    applyBackdrop(this, 'duel', {
      dim: colors.backdrop.tint,
      dimAlpha: colors.backdrop.alpha,
      fallback: () => {
        const base = this.add.graphics();
        base.fillGradientStyle(
          colors.backdrop.fallbackTop,
          colors.backdrop.fallbackTop,
          colors.backdrop.fallbackBottom,
          colors.backdrop.fallbackBottom,
          1,
        );
        base.fillRect(0, 0, width, height);
      },
    });

    // A restrained stage light keeps the midfield from reading as a flat dim.
    // It is inserted after the backdrop but before the zone plates, so no
    // geometry or display-depth contract changes.
    this.add
      .ellipse(BOARD_CENTER_X, 300, 760, 430, colors.stageLight, colors.stageLightAlpha)
      .setBlendMode(Phaser.BlendModes.SCREEN);

    const g = this.add.graphics();

    // Two inset battlefield zone plates: both stop at x1046 to leave a clean
    // right sidebar for phase and command controls. Yours a touch brighter.
    const plate = (x0: number, x1: number, y0: number, y1: number, fill: number, alpha: number): void => {
      g.fillGradientStyle(colors.zoneStroke, colors.zoneStroke, fill, fill, alpha);
      g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 10);
      g.lineStyle(1, colors.zoneStroke, colors.zoneStrokeAlpha);
      g.strokeRoundedRect(x0, y0, x1 - x0, y1 - y0, 10);
    };
    plate(
      LAYOUT.oppZone.x0,
      LAYOUT.oppZone.x1,
      LAYOUT.oppZone.y0,
      LAYOUT.oppZone.y1,
      colors.opponentZone.fill,
      colors.opponentZone.alpha,
    );
    plate(
      LAYOUT.myZone.x0,
      LAYOUT.myZone.x1,
      LAYOUT.myZone.y0,
      LAYOUT.myZone.y1,
      colors.playerZone.fill,
      colors.playerZone.alpha,
    );
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

  /**
   * The opponent's display name when she has one: the gauntlet or Tower
   * opponent, the draft persona, or the tutorial's Alder. Undefined for an
   * unnamed practice AI, whose callers pick their own fallback.
   */
  private opponentName(): string | undefined {
    return this.a11yFixture?.opponentName ?? this.opponent?.name ?? this.limitedPersona?.name ?? (this.tutorial ? TUTORIAL_OPPONENT_NAME : undefined);
  }

  private matchupLabel(): string {
    if (this.tutorial || this.a11yTutorialChrome) return 'Tutorial';
    if (this.replayMode && this.replayLog) {
      return `${this.showcase ? '' : 'Replay · '}vs ${this.replayLog.context.opponentName}`;
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

  /** Legal face targeting follows the same first-target contract as tryTarget(). */
  private isPlayerTargetable(player: PlayerId): boolean {
    return this.targetRefsForInput().some(
      (target) => target.kind === 'player' && target.player === player,
    );
  }

  /** Legal target rings describe the target controller, never the spell's colour or class. */
  private targetRingColor(player: PlayerId): string {
    return targetRingTone(player === HUMAN ? 'you' : 'opponent') === 'hostile'
      ? theme.colors.dangerArmed
      : theme.colors.success;
  }

  private drawLifeTargetRing(
    ring: Phaser.GameObjects.Graphics,
    pos: { x: number; y: number },
    targetable: boolean,
    color: string,
  ): void {
    ring.clear();
    if (!targetable) return;
    const half = LIFE_BADGE_SIZE / 2 + LIFE_TARGET_RING.inset;
    ring.lineStyle(theme.outline.state, colorInt(color), 0.98);
    ring.strokeRoundedRect(pos.x - half, pos.y - half, half * 2, half * 2, theme.radius.control + 2);
  }

  /**
   * Snap the Mandate's seal to its holder's life, or beside the turn chip
   * while unclaimed; hidden in a duel where no visible card names it
   * (`mandateShown`). A claim in flight finishes first (`flyMandateSeal`).
   */
  private syncMandateSeal(): void {
    const seal = this.mandateSeal;
    if (!seal || seal.flying) return;
    const st = this.duel.state;
    if (!mandateShown(st, CARD_DB, HUMAN)) {
      seal.place(null, null);
      return;
    }
    const spot = mandateSpot(st.mandateHolder, HUMAN);
    seal.place(spot, mandateSealCenter(spot, this.turnPillWidth));
  }

  /** A claim: the seal flies from where it was to its new holder (instant unless motion is full). */
  private flyMandateSeal(from: PlayerId | null, to: PlayerId): void {
    const seal = this.mandateSeal;
    if (!seal) return;
    const origin = mandateSpot(from, HUMAN);
    const spot = mandateSpot(to, HUMAN);
    seal.fly(
      mandateSealCenter(origin, this.turnPillWidth),
      mandateSealCenter(spot, this.turnPillWidth),
      spot,
      Services.save.data.settings.animations === 'full',
      () => this.syncMandateSeal(),
    );
  }

  /** While a face is legal, its badge and whole portrait resolve to the same target. */
  private syncFaceTargeting(): void {
    const myTargetable = this.isPlayerTargetable(HUMAN);
    const oppTargetable = this.isPlayerTargetable(AI);
    this.mandateSeal?.setInputAllowed(!myTargetable && !oppTargetable);
    const myColor = this.targetRingColor(HUMAN);
    const oppColor = this.targetRingColor(AI);
    this.portrait.setFaceTargetable(myTargetable, myColor);
    this.oppPortrait.setFaceTargetable(oppTargetable, oppColor);
    const myPick = this.pickIndices({ kind: 'player', player: HUMAN });
    const oppPick = this.pickIndices({ kind: 'player', player: AI });
    this.portrait.setPickBadge(myPick);
    this.oppPortrait.setPickBadge(oppPick);
    this.drawLifeTargetRing(this.lifeTargetRings.my, LAYOUT.myLife, myTargetable, myColor);
    this.drawLifeTargetRing(this.lifeTargetRings.opp, LAYOUT.oppLife, oppTargetable, oppColor);
    if (this.lifePickBadges?.active) this.lifePickBadges.destroy();
    this.lifePickBadges = this.add.container(0, 0).setDepth(theme.depth.hudLabel);
    for (const [pick, pos, direction] of [[myPick, LAYOUT.myLife, 1], [oppPick, LAYOUT.oppLife, -1]] as const) {
      if (pick.length > 0) this.addPickBadge(this.lifePickBadges, pos.x + direction * 34, pos.y, pick);
    }
  }

  private lifePickBadges: Phaser.GameObjects.Container | null = null;

  /** Same numbered, opaque badge on grave cards and life totals as on tiles. */
  private addPickBadge(parent: Phaser.GameObjects.Container, x: number, y: number, index: number | readonly number[]): void {
    const label = pickBadgeLabel(index);
    if (label === null) return;
    const badge = this.add.container(x, y);
    // Vector numerals ("1", repeated picks "1, 2") centred on their ink.
    const ink = ensureNumeralBadgeInk(this, label, theme.colors.heading, theme.typeBase.label * INTER_FIGURE_HEIGHT, 24);
    const radius = ink.diameter / 2;
    const numeral = this.add.image(0, 0, ink.texture).setDisplaySize(ink.diameter, ink.diameter).setData('a11yNumeral', label);
    badge.add(this.add.circle(0, 0, radius, theme.graphics.panelFill).setStrokeStyle(theme.outline.state, colorInt(theme.colors.gold)));
    badge.add(numeral);
    badge.setData('a11yPickBadge', label);
    badge.setData('a11ySurface', { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 });
    badge.setName('duel-pick-badge');
    parent.add(badge);
  }

  private buildHud(): void {
    // --- Opponent mirror: pile-column hand/grave/deck, portrait, life, mana ---
    this.oppHandPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.handY, 'hand');
    this.oppGravePile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.graveY, 'grave', {
      onTap: () => this.showZoneModal(AI, 'graveyard'),
    });
    this.oppDeckPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.deckY, 'deck');
    this.oppSeveredPile = new PileView(this, LAYOUT.oppPiles.x, LAYOUT.oppPiles.severedY, 'severed', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(AI, 'severed');
      },
    }).setVisible(SEVER_ENABLED);
    // Both severed piles sit on the frame line; their wide touch target leans
    // outward so it never reaches over the battlefield plate or the smart button.
    if (this.oppSeveredPile.inputZone) {
      inflateHitArea(this.oppSeveredPile.inputZone, SEVERED_PILE_HIT.size, SEVERED_PILE_HIT.size, {
        biasX: -SEVERED_PILE_HIT.outwardBias,
      });
    }
    this.oppReservePile = new PileView(
      this,
      LAYOUT.reservePiles.opponent.x,
      LAYOUT.reservePiles.opponent.y,
      'reserve',
      { iconSize: 36, onTap: () => this.showReserveModal(AI) },
    ).setVisible(false);
    if (this.oppReservePile.inputZone) inflateHitArea(this.oppReservePile.inputZone, 64, 64);
    // --- Your piles: right column above Concede ---
    this.mySeveredPile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.severedY, 'severed', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(HUMAN, 'severed');
      },
    }).setVisible(SEVER_ENABLED);
    if (this.mySeveredPile.inputZone) {
      inflateHitArea(this.mySeveredPile.inputZone, SEVERED_PILE_HIT.size, SEVERED_PILE_HIT.size, {
        biasX: SEVERED_PILE_HIT.outwardBias,
      });
    }
    this.myDeckPile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.deckY, 'deck', {
      onTap: (p) => {
        if (!p.rightButtonReleased()) this.showZoneModal(HUMAN, 'deck');
      },
    });
    this.myGravePile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.graveY, 'grave', {
      onTap: () => this.showZoneModal(HUMAN, 'graveyard'),
    });
    this.myReservePile = new PileView(
      this,
      LAYOUT.reservePiles.human.x,
      LAYOUT.reservePiles.human.y,
      'reserve',
      { iconSize: 36, onTap: () => this.onReservePileTap() },
    ).setVisible(false);
    if (this.myReservePile.inputZone) {
      inflateHitArea(this.myReservePile.inputZone, 64, 64);
      // Right-click always reads the full reserve, fan or no fan.
      this.myReservePile.inputZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button === 2 && !this.carry && !this.landFan) this.showReserveModal(HUMAN);
      });
    }
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
      label: this.replayLog?.context.opponentName ?? this.opponentName() ?? `${this.difficulty} AI`,
    });
    this.addLifeBadgePlate(LAYOUT.myLife.x, LAYOUT.myLife.y);
    this.addLifeBadgePlate(LAYOUT.oppLife.x, LAYOUT.oppLife.y);
    this.mandateSeal = new MandateSeal(this);
    this.lifeTargetRings = {
      my: this.add.graphics().setDepth(theme.depth.hudLabel),
      opp: this.add.graphics().setDepth(theme.depth.hudLabel),
    };

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
          fontSize: `${duelHudType(22, 'label')}px`,
          fontStyle: 'bold',
          color: theme.colors.dangerArmed,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(theme.depth.hud),
      myLife: this.add
        .text(LAYOUT.myLife.x, LAYOUT.myLife.y, '', {
          fontFamily: theme.fonts.display,
          fontSize: `${duelHudType(22, 'label')}px`,
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
          fontFamily: theme.fonts.display,
          fontSize: `${duelHudType(15, 'label')}px`,
          fontStyle: '600',
          color: theme.colors.gold,
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
      isTargetable: (sid) => this.targetRefsForInput().some(
        (target) => target.kind === 'stackItem' && target.sid === sid,
      ),
      onTarget: (sid) => this.tryTarget({ kind: 'stackItem', sid }),
      attachZoom: (view, card) => this.zoom.attach(view, card),
      // Same guard as the sticky-tap route: while the player is mid-target
      // for their own cast, inspect stays blocked (right-click cancels).
      onInspect: (card) => {
        if (!this.pendingCasts) this.showInspect(card);
      },
    });
    // The circular smart button (1a "PASS"): the Arc carries the input, the
    // label Text above it never does — so relabeling via setText can't hit the
    // Text.updateText hit-area trap, and the circle's default 92×92 hit rect
    // already meets the 90px touch floor without inflation.
    this.passArc = this.add
      .circle(LAYOUT.cluster.x, LAYOUT.cluster.passY, LAYOUT.cluster.passR, colorInt(theme.colors.btnEmphasisBg), 0.95)
      .setStrokeStyle(2.5, colorInt(theme.colors.gold), 0.9)
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
    // Face targeting is deliberately a child Zone on the whole portrait, not
    // an interactive Container. The zone sleeps outside an active targeting
    // flow, preserving all ordinary portrait interactions.
    for (const [portrait, player] of [
      [this.portrait, HUMAN],
      [this.oppPortrait, AI],
    ] as const) {
      bindTapButton(this, portrait.targetZone, (p) => {
        if (!p.rightButtonReleased()) this.tryTarget({ kind: 'player', player });
      });
    }
    // Hit inflation (mobile-lan-plan §1.4). Life totals meet the 44px floor; the
    // Stack cards use CardView's child Zone and never make a scaled Container
    // interactive. Life totals use inflated text hit areas. The smart button
    // needs none: the Arc's hit rect is static.
    inflateHitArea(this.hud.myLife, 44, 44);
    inflateHitArea(this.hud.oppLife, 44, 44);
    this.syncFaceTargeting();
    // Right-click cancels targeting. Test the INITIATING button (p.button),
    // not rightButtonDown() — that's a live bitmask, true for a chorded LEFT
    // press while the right button happens to be held.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 2 && this.pendingCasts) {
        this.cancelPendingTargeting();
      }
    });

    // ⚙ Menu: opens the in-game pause overlay (Resume · quick toggles ·
    // Concede). Replaces the always-on corner Concede text — concede now lives
    // one tap deeper in the menu, decluttering the board HUD (playtest
    // feedback). Same inboard corner spot (audited off the edge-gesture zone).
    this.menuBtn = this.add
      .text(LAYOUT.menu.x, LAYOUT.menu.y, '⚙ Menu', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    // Release's edge-mounted menu is intentionally outside title-safe; keep
    // its anchor while still proving the complete label is inside the canvas.
    this.menuBtn.setData('a11yArea', { x: 1150, y: 660, width: 130, height: 60 });
    bindTapButton(this, this.menuBtn, (p) => {
      if (p.rightButtonReleased()) return; // right-click is inspect/cancel
      this.showPauseMenu();
    });
    // The 90px target leans 20px down (toward the screen edge) so its top
    // stays clear of your grave pile directly above it.
    inflateHitArea(this.menuBtn, 90, 90, { biasY: 20 });

    // Auto-skip notice: floats in the gap between the two zone plates.
    // Strictly NON-interactive — never setInteractive'd, so there is no Text
    // hit-area bookkeeping to go stale on setText. Chained skips replace it
    // in place.
    this.skipText = this.add
      .text(BOARD_CENTER_X, LAYOUT.gap.cy, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${duelHudType(13, 'label')}px`,
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
    // shown during your own Morning or Afternoon (syncButton toggles it).
    this.endTurnBtn = this.add
      .text(LAYOUT.cluster.x, LAYOUT.cluster.endTurnY, '⏭ End Turn', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.heading,
        backgroundColor: theme.colors.btnGhostBg,
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
    this.endTurnBtn.setX(clusterControlX(this.endTurnBtn.width));

    // Undo: take back your last committed action while it's still your
    // decision — before priority passes to the AI or combat animates. It is
    // the left rail's only control besides the turn pill. After an action
    // that showed you a hidden card it stays in place, dimmed, and a tap (or
    // a mouse hover) says why; alpha only, so the Text hit area never resets.
    this.undoBtn = this.add
      .text(LAYOUT.undo.x, LAYOUT.undo.y, '↶ Undo', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.heading,
        backgroundColor: theme.colors.btnGhostBg,
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    // Release's left-rail anchor is outside the menu title-safe inset.
    this.undoBtn.setData('a11yArea', { x: 0, y: LAYOUT.undo.y - 45, width: 104, height: 90 });
    bindTapButton(this, this.undoBtn, (p) => {
      if (p.rightButtonReleased()) return;
      if (this.undoBlocked) {
        this.showTransientNotice(this.undoBlocked);
        return;
      }
      this.undoLastAction();
    });
    this.undoBtn.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && this.undoBlocked && this.undoBtn.visible) this.showTransientNotice(this.undoBlocked);
    });
    inflateHitArea(this.undoBtn, 90, 90);

    // Always-on combat ledger: the 12px caption plus 4px total vertical
    // padding is centered in the 34px gap between the creature tile bounds.
    // Even the 1.1x lethal pulse stays between opponent y=285 and player y=319.
    this.combatPreviewText = this.add
      .text(640, LAYOUT.gap.cy, '', {
        fontFamily: theme.fonts.ui,
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
    const exit = backButton(this, 'Profile', (p) => {
      if (!p.rightButtonReleased()) this.exitReplayViewer();
    });
    exit.setDepth(theme.depth.results + 10);
    bar.add([this.replayPlayButton.container, step.container, this.replaySpeedButton.container]);
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
    return 850 / (this.showcase?.speed ?? this.replaySpeed);
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
      if (step.p === HUMAN) {
        const playedCardId = this.actionCardId(step.a);
        const playedSource = this.actionOrigin(step.a);
        if (playedCardId && playedSource) {
          this.humanPlayOrigin = { cardId: playedCardId, source: playedSource };
        }
      }
      const events = this.duel.submit(step.p, step.a);
      this.rememberRetellAction(step.a, events);
      this.undoSnapshot = null;
      this.undoBlocked = null;
      this.selectedAttackers.clear();
      this.blockAssignments = [];
      this.pendingBlocker = null;
      this.pendingCasts = null;
      this.pendingSacrifice = null;
      this.processEvents(events);
      this.afterEvents();
    } catch (error) {
      if (this.showcase) console.error('[showcase] replay stopped', error);
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
      dismissal: 'esc-only',
      depth: theme.depth.results,
      onClose: () => {
        this.replayOutcome = null;
        this.replayOutcomeShell = null;
        this.zoom.setSuppressed(false);
      },
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
        if (!p.rightButtonReleased()) {
          shell.close();
          this.exitReplayViewer();
        }
      },
    });
    c.add(exit.container);
    fitDuelModal(this, shell, { width: 460, height: message === 'Replay complete' ? 170 : 220,
      rows: [{ y: message === 'Replay complete' ? 320 : 300, wrapWidth: 390 }, { y: 350, wrapWidth: 390 },
        { y: message === 'Replay complete' ? 390 : 420 }] });
    this.replayOutcome = c;
    this.replayOutcomeShell = shell;
  }

  private completeReplayPlayback(): void {
    if (this.showcase) this.finishShowcase('done');
    else this.finishReplayPlayback('Replay complete');
  }

  private failReplayPlayback(): void {
    if (this.showcase) this.finishShowcase('failed');
    else this.finishReplayPlayback('Replay unavailable');
  }

  /** A showcase holds its final board for the camera and tells the capture script. */
  private finishShowcase(state: 'done' | 'failed'): void {
    this.stopReplayPlayback();
    this.ended = true;
    window.__showcase = { state };
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
    this.replayOutcomeShell?.close();
    this.replayOutcomeShell = null;
    this.replayOutcome?.destroy();
    this.replayOutcome = null;
    this.scene.start('Profile');
  }

  // ---------------------------------------------------------------------
  // Action submission + AI loop
  // ---------------------------------------------------------------------

  /** Your able attackers that Rage compels right now; empty without Rage. */
  private rageAttackers(): number[] {
    return compelledAttackers(this.duel.state, CARD_DB, HUMAN);
  }

  private isHumanTurnDecision(): boolean {
    const a = this.duel.awaiting;
    return 'player' in a && a.player === HUMAN;
  }

  private act(action: Action): void {
    if (this.versusBumperActive || this.replayMode || this.ended) return;
    if (this.animatingCombat) return; // swallow input while a combat sequence plays
    let submitted = false;
    try {
      const playedCardId = this.actionCardId(action);
      const playedSource = this.actionOrigin(action);
      this.humanPlayOrigin = playedCardId && playedSource
        ? { cardId: playedCardId, source: playedSource }
        : null;
      const snapshot = this.duel.clone(); // pre-action state; kept for Undo iff still local
      // Tutorial: note which taught spell/beat this action is BEFORE it resolves
      // (a cast card leaves the hand on submit), so the guide can advance.
      if (this.tutorial && action.type === 'castSpell' && playedCardId) {
        const types = def(CARD_DB, playedCardId).types;
        if (types.includes('ritual')) this.tutRitualCast = true;
        if (types.includes('charm')) this.tutCharmCast = true;
      }
      const events = this.duel.submit(HUMAN, action);
      submitted = true;
      // Anonymous card tally (src/net/signals.ts), after the submit so a
      // rejected action never counts. Only real plays: `skim` discards the card
      // rather than playing it, and the tutorial's scripted line would bias the
      // corpus with a fixed deck no duel digest ever accompanies.
      if (playedCardId && action.type !== 'skim' && !this.tutorial && !this.a11yFixture) signals.cardsPlayed([playedCardId]);
      this.rememberRetellAction(action, events);
      if (this.replayDraft) recordReplayAction(this.replayDraft, HUMAN, action);
      if (this.tutorial && action.type === 'declareBlockers' && action.blocks.length > 0) {
        this.tutBlocked = true;
      }
      // An action that showed you a card hidden before it (a draw, a look at
      // your deck, a card leaving a deck or the foe's hand) cannot be taken
      // back: Undo would replay the decision knowing that card.
      const awaiting = this.duel.awaiting;
      this.undoBlocked = undoBlockedReason({
        events,
        player: HUMAN,
        deckBefore: snapshot.state.players[HUMAN].deck.length,
        deckAfter: this.duel.state.players[HUMAN].deck.length,
        lookingAtHiddenCards: awaiting.kind === 'foresee' && awaiting.player === HUMAN,
      });
      this.undoSnapshot = this.undoBlocked ? null : snapshot;
      this.selectedAttackers.clear();
      this.blockAssignments = [];
      this.pendingBlocker = null;
      this.pendingCasts = null;
      this.pendingSacrifice = null;
      this.processEvents(events);
      this.afterEvents();
    } catch (err) {
      // The engine's message ("Illegal action … by P0: …") is a diagnostic:
      // it goes to the console, in dev and prod, never into History. A move
      // the rules refused (the engine validates before it mutates anything)
      // gets one plain line there instead. Any other failure is a fault, not
      // the player's move: a console error only, nothing in History.
      const raw = String((err as Error).message);
      if (!submitted && validateAction(this.duel.instanceState, CARD_DB, HUMAN, action) !== null) {
        console.warn(`[duel] move refused: ${raw}`);
        this.log(refusedMoveLine(this.duel.state, CARD_DB, HUMAN, action));
      } else {
        console.error(`[duel] ${submitted ? 'after an accepted move' : 'while submitting a move'}: ${raw}`, err);
      }
    }
  }

  /** New Wave-1 motion obeys the same save setting as combat sequencing. */
  private motionLevel(): 'full' | 'reduced' | 'off' {
    return Services.save.data.settings.animations;
  }

  /**
   * The fan view for an ENGINE hand index. handViews is pushed in DISPLAY
   * order (handDisplayOrder's readability sort), so indexing it with an
   * engine index silently grabs whichever card sits at that fan position -
   * the carry-cast bug that lifted the wrong card (owner finding 2026-08-18).
   */
  private handViewFor(handIndex: number): CardView | undefined {
    const displayIndex = handDisplayOrder(this.duel.state.players[HUMAN].hand, CARD_DB).indexOf(handIndex);
    return displayIndex < 0 ? undefined : this.handViews[displayIndex];
  }

  /** Capture the displayed fan card before syncHand destroys it; hover transforms count. */
  private handOrigin(handIndex: number): { x: number; y: number; scale: number; angle: number } | undefined {
    const view = this.handViewFor(handIndex);
    if (view?.active) return { x: view.x, y: view.y, scale: view.scaleX, angle: view.angle };
    return this.handPoses.get(handIndex);
  }

  private graveOrigin(player: PlayerId): { x: number; y: number; scale: number; angle: number } {
    return player === HUMAN
      ? { x: LAYOUT.piles.x, y: LAYOUT.piles.graveY, scale: 0.25, angle: 0 }
      : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.graveY, scale: 0.25, angle: 0 };
  }

  private actionCardId(action: Action): string | undefined {
    const player = this.duel.state.players[HUMAN];
    if (action.type === 'playLand') {
      const entry = action.reserveIndex !== undefined
        ? player.landReserve?.[action.reserveIndex]
        : player.hand[action.handIndex];
      return entry === undefined ? undefined : cardIdOf(entry);
    }
    if (action.type === 'skim') {
      const entry = player.hand[action.handIndex];
      return entry === undefined ? undefined : cardIdOf(entry);
    }
    if (action.type === 'castSpell') {
      const entry = action.retell === true || action.whispers === true
        ? player.graveyard[action.graveIndex ?? action.handIndex]
        : player.hand[action.handIndex];
      return entry === undefined ? undefined : cardIdOf(entry);
    }
    if (action.type === 'castDarling') {
      const entry = player.darlingZone;
      return entry === undefined || entry === null ? undefined : cardIdOf(entry);
    }
    return undefined;
  }

  private actionOrigin(action: Action): { x: number; y: number; scale: number; angle: number } | undefined {
    if (action.type === 'playLand') {
      if (action.reserveIndex !== undefined) return this.reservePositions.get(`${HUMAN}:${action.reserveIndex}`);
      return this.handOrigin(action.handIndex);
    }
    if (action.type === 'skim') return this.handOrigin(action.handIndex);
    if (action.type === 'castSpell') {
      return action.retell === true || action.whispers === true
        ? this.graveOrigin(HUMAN)
        : this.handOrigin(action.handIndex);
    }
    if (action.type === 'castDarling') return this.darlingZonePositions.get(HUMAN);
    if (action.type === 'linkHaunt' || action.type === 'activate') {
      const view = this.views.get(action.iid);
      if (view) return { x: view.x, y: view.y, scale: view.scaleX, angle: view.angle };
      const target = this.boardTargets.get(action.iid);
      return target ? { ...target, angle: 0 } : undefined;
    }
    return undefined;
  }

  private pendingActionTarget(action: PendingTargetAction): TargetRef | undefined {
    return action.type === 'linkHaunt'
      ? { kind: 'permanent', iid: action.hostIid }
      : targetSelectionStep([action], this.targetPicks, this.targetPicksUnordered).targets[0];
  }

  private isHumanChooseTarget(): boolean {
    const a = this.duel.awaiting;
    return a.kind === 'chooseTarget' && a.player === HUMAN;
  }

  private isMandatoryChoice(): boolean {
    const a = this.duel.awaiting;
    return this.isHumanChooseTarget() || (a.kind === 'discardToHandSize' && a.player === HUMAN);
  }

  /** All currently clickable target refs, whether cast-time or trigger-time. */
  private targetRefsForInput(): TargetRef[] {
    const awaiting = this.duel.awaiting;
    if (this.pendingSacrifice) return sacrificeCandidates(this.duel.instanceState, CARD_DB, HUMAN)
      .map((iid) => ({ kind: 'permanent', iid }));
    if (this.pendingCasts && this.pendingCasts[0]?.type !== 'linkHaunt') {
      const step = this.pendingTargetStep();
      return this.targetPicksUnordered ? [...step.targets, ...this.targetPicks] : step.targets;
    }
    const refs = (this.pendingCasts ?? [])
      .map((action) => this.pendingActionTarget(action))
      .filter((target): target is TargetRef => target !== undefined);
    if (awaiting.kind === 'chooseTarget' && awaiting.player === HUMAN) refs.push(...awaiting.targets);
    return refs;
  }

  private targetRefEquals(a: TargetRef, b: TargetRef): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
    if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
    if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
    return a.kind === 'grave' && b.kind === 'grave' && sameGraveCard(a, b);
  }

  /** A graveyard target's card, found by its identity when the ref carries one. */
  private graveTargetCardId(ref: Extract<TargetRef, { kind: 'grave' }>): string | undefined {
    const card = graveRefCard(this.duel.instanceState, ref);
    return card === undefined ? undefined : cardIdOf(card);
  }

  private targetChoiceOrigin(): { x: number; y: number; scale: number; angle: number } | undefined {
    const awaiting = this.duel.awaiting;
    if (awaiting.kind !== 'chooseTarget' || awaiting.player !== HUMAN) return undefined;
    const source = this.views.get(awaiting.sourceIid);
    if (source?.active) {
      return { x: source.x, y: source.y, scale: source.scaleX, angle: source.angle };
    }
    const target = this.boardTargets.get(awaiting.sourceIid);
    return target ? { ...target, angle: 0 } : undefined;
  }

  private syncTargetPrompt(): void {
    if (this.targetPrompt?.active) this.targetPrompt.destroy();
    this.targetPrompt = null;
    this.dutyFinishButton = null;
    if (this.pendingSacrifice || edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks)) {
      this.syncSacrificePrompt();
      return;
    }
    const duty = this.pendingCasts?.[0];
    if (duty && duty.type !== 'linkHaunt') {
      const cardId = duty.type === 'activate'
        ? this.duel.state.battlefield.find((perm) => perm.iid === duty.iid)?.cardId
        : this.actionCardId(duty);
      if (!cardId) return;
      const step = this.pendingTargetStep();
      const card = def(CARD_DB, cardId);
      // A Hunt asks for its hunter, then its prey (1.9 A2.a); anything else keeps its title.
      const huntPrompt = huntStepPrompt(card, this.huntTargetSource(duty), step.selected.length,
        duty.type === 'activate' ? duty.abilityIndex ?? 0 : 0);
      const prompt = this.add.container(0, 0).setDepth(theme.depth.toast);
      // An ordered grave pick stays readable while the next slot is chosen
      // on the board. This readout never adds a legal target or input handler.
      this.targetPicks.forEach((ref, index) => {
        if (ref.kind !== 'grave' || this.targetPicks.slice(0, index).some(pick => this.targetRefEquals(pick, ref))) return;
        const pickedCard = this.graveTargetCardId(ref);
        if (!pickedCard) return;
        const x = 350 - index * 64;
        const picked = new CardView(this, x, LAYOUT.gap.cy).setScale(0.18);
        picked.setCard(def(CARD_DB, pickedCard), { fx: 'none' });
        const indices = this.pickIndices(ref, this.targetPicks);
        picked.setData('a11yPickBadge', pickBadgeLabel(indices));
        prompt.add(picked);
        this.addPickBadge(prompt, x, LAYOUT.gap.cy, indices);
      });
      prompt.add(this.add.text(640, LAYOUT.gap.cy, targetStepTitle(card.name, huntPrompt, targetPromptTitle(card.name), step.countText), {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.gold,
        wordWrap: { width: 480 }, align: 'center', resolution: 2,
      }).setOrigin(0.5));
      this.dutyFinishButton = themedButton(this, LAYOUT.cluster.x, LAYOUT.cluster.endTurnY,
        duty.type === 'activate' ? this.dutyLabelOf(duty) : 'Confirm targets', {
          variant: 'primary', ...CLUSTER_BUTTON, enabled: step.complete !== null,
          onTap: (pointer) => { if (!pointer.rightButtonReleased()) this.confirmPendingTargets(); },
        });
      this.dutyFinishButton.container.setX(clusterControlX(this.dutyFinishButton.getMeasuredBounds().hit.width));
      prompt.add(this.dutyFinishButton.container);
      if (!this.targetPicksUnordered && step.count > 1 && this.targetPicks.length > 0) {
        prompt.add(themedButton(this, 640, LAYOUT.gap.cy + 42, 'Undo target', {
          size: 'sm', minWidth: 120,
          onTap: pointer => { if (!pointer.rightButtonReleased()) this.undoTargetSelection(); },
        }).container);
      }
      this.targetPrompt = prompt;
      return;
    }
    const deferred = deferredTargetPrompt(this.duel.instanceState, CARD_DB, HUMAN);
    if (!deferred) return;
    const card = def(CARD_DB, deferred.sourceCardId);
    const layout = TARGET_PROMPT_LAYOUT;
    const prompt = this.add.container(0, 0).setDepth(theme.depth.toast);
    const sourceCard = new CardView(this, layout.cardX, layout.cardY);
    sourceCard.setCard(card, { fx: 'none' }).setScale(layout.cardScale);
    prompt.add(sourceCard);
    prompt.add(
      this.add
        .text(layout.titleX, layout.titleY, deferred.title, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          wordWrap: { width: layout.textWidth },
          resolution: 2,
        })
        .setOrigin(0, 0.5),
    );
    prompt.add(
      this.add
        .text(layout.textX, layout.textY, deferred.text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          wordWrap: { width: layout.textWidth },
          lineSpacing: 3,
          resolution: 2,
        })
        .setOrigin(0, 0),
    );
    this.targetPrompt = prompt;
  }

  private rememberRetellAction(action: Action, events: readonly GameEvent[]): void {
    if (action.type !== 'castSpell' || (action.retell !== true && action.whispers !== true)) return;
    for (const event of events) {
      if (event.e !== 'spellCast') continue;
      if (action.whispers) this.whispersSpellIds.add(event.sid);
      else {
        this.retellSpellIds.add(event.sid);
        this.retellCardsInFlight.add(event.cardId);
      }
    }
  }

  /** The existing board target prompt also hosts the purely visual sacrifice choice. */
  private syncSacrificePrompt(): void {
    const pick = this.pendingSacrifice;
    const edict = edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks);
    if (!pick && !edict) return;
    const cardId = edict?.sourceCardId ?? (pick && this.actionCardId(pick.casts[0]));
    if (!cardId) return;
    const card = def(CARD_DB, cardId);
    const selection = pick ? sacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, pick.casts, pick.selected) : null;
    const layout = TARGET_PROMPT_LAYOUT;
    const prompt = this.add.container(0, 0).setDepth(theme.depth.toast);
    const source = new CardView(this, layout.cardX, layout.cardY).setScale(layout.cardScale);
    source.setCard(card, { fx: 'none' });
    prompt.add(source);
    const riteCount = card.rite?.n;
    prompt.add(this.add.text(layout.titleX, layout.titleY,
      edict?.prompt ?? (riteCount !== undefined
        ? `Rite: choose ${riteCount} ${riteCount === 1 ? 'creature' : 'creatures'}`
        : 'Tithe: choose creatures'), {
        fontFamily: theme.fonts.display, fontSize: `${theme.type.label}px`, color: theme.colors.gold,
        wordWrap: { width: layout.textWidth }, resolution: 2,
      }).setOrigin(0, 0.5));
    const removeHint = `${this.touch ? 'Tap' : 'Click'} again to remove.`;
    prompt.add(this.add.text(layout.textX, layout.textY,
      edict ? `${this.edictPicks.length} of ${edict.count} selected\n${removeHint}` :
        `${pick!.selected.length}${card.rite ? `/${card.rite.n}` : ''} selected${card.tithe ? ` · ${selection!.defense} Defense` : ''}\n${removeHint}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body,
        wordWrap: { width: layout.textWidth }, lineSpacing: 3, resolution: 2,
      }));
    if (selection?.cost) {
      renderManaText(this, prompt, layout.textX, layout.textY + 48, `Cast for ${manaCostText(selection.cost)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.gold, resolution: 2,
      });
    }
    this.dutyFinishButton = themedButton(this, LAYOUT.cluster.x, LAYOUT.cluster.endTurnY, edict ? 'Confirm sacrifice' : 'Confirm cast', {
      variant: 'primary', ...CLUSTER_BUTTON, enabled: edict ? edict.action !== null : selection!.actions.length > 0,
      onTap: (pointer) => {
        if (!pointer.rightButtonReleased()) this.confirmSacrificeSelection();
      },
    });
    this.dutyFinishButton.container.setX(clusterControlX(this.dutyFinishButton.getMeasuredBounds().hit.width));
    prompt.add(this.dutyFinishButton.container);
    this.targetPrompt = prompt;
  }

  private confirmSacrificeSelection(): void {
    if (this.ended || this.animatingCombat) return;
    const edict = edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks);
    if (edict) {
      if (edict.action) {
        this.closeGravePicker(false);
        this.act(edict.action);
      }
      return;
    }
    const current = this.pendingSacrifice;
    if (!current || this.ended || this.animatingCombat) return;
    const ready = sacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, current.casts, current.selected).actions;
    if (ready.length === 0) return;
    this.pendingSacrifice = null;
    this.pendingCasts = null;
    this.sync();
    this.continueCast(ready, true);
  }

  /** Restore the pre-action snapshot and reset scene-side selection state. */
  private undoLastAction(): void {
    if (!this.undoSnapshot || this.ended || this.animatingCombat || this.isMandatoryChoice()) return;
    this.duel = this.undoSnapshot;
    this.undoSnapshot = null;
    this.whispersSpellIds = new Set(this.duel.state.stack.filter((item) => item.whispered).map((item) => item.sid));
    // The undone submit must leave the replay too — the tail is that action
    // by contract (undo dies the moment priority reaches the AI).
    if (this.replayDraft) undoReplayAction(this.replayDraft, HUMAN);
    // Mirror the scene-side state act() clears, so no stale selection survives.
    this.selectedAttackers.clear();
    this.blockAssignments = [];
    this.pendingBlocker = null;
    this.pendingCasts = null;
    this.pendingSacrifice = null;
    this.sync();
  }

  /**
   * Undo is offered only while the snapshot is valid and it is your decision.
   * When your last action revealed a card, the button keeps its place, dimmed
   * like any disabled control, so its absence never reads as a glitch.
   */
  private syncUndoButton(): void {
    const decision = !this.ended && !this.animatingCombat && !this.isMandatoryChoice() && this.isHumanTurnDecision();
    this.undoBtn
      .setVisible(decision && (this.undoSnapshot !== null || this.undoBlocked !== null))
      .setAlpha(this.undoBlocked ? theme.alpha.subtle : 1);
  }

  /** Live combat ledger while you assign blocks (you are defending). */
  private syncCombatPreview(): void {
    const st = this.duel.state;
    const a = this.duel.awaiting;
    if (a.kind !== 'declareBlockers' || !('player' in a) || a.player !== HUMAN || !st.combat) {
      this.combatPreviewText.setVisible(false);
      this.forecastWasLethal = false;
      this.syncDuelMusicMood(false);
      return;
    }
    const preview = previewCombat(st, CARD_DB, this.blockAssignments);
    const dmg = -preview.lifeDelta[HUMAN];
    const lethal = preview.defenderLethal;
    this.combatPreviewText
      .setText(combatForecastCopy({
        attackers: st.combat.attackers.length,
        damage: dmg,
        lifeBefore: st.players[HUMAN].life,
        lifeAfter: st.players[HUMAN].life - dmg,
        lethal,
      }))
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
    this.syncDuelMusicMood(lethal);
  }

  /**
   * The existing declarative board sync is the music trigger seam: no polling
   * loop, and no engine state change. The forecast's lethal result overrides
   * the life mood only while declareBlockers exposes it.
   */
  private syncDuelMusicMood(lethalVisible: boolean): void {
    if (this.ended) return;
    const st = this.duel.state;
    const selection = selectDuelMood({
      humanLife: st.players[HUMAN].life,
      opponentLife: st.players[AI].life,
      startingLife: this.duel.startingLife,
      tensionActive: this.duelTensionActive,
      lethalVisible,
    });
    this.duelTensionActive = selection.tensionActive;
    Music.setMood(selection.mood);
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
    this.turnPillWidth = w;
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
    this.flushHuntFx();
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
    if (!this.targetRefsForInput().some(candidate => this.targetRefEquals(candidate, ref))) return;
    // Both keyboard and pointer leave the old modal before advancing to the next slot.
    this.closeGravePicker(false);
    this.keyboardTarget = ref;
    if (this.pendingSacrifice) {
      if (ref.kind !== 'permanent') return;
      const { casts, selected } = this.pendingSacrifice;
      const cardId = this.actionCardId(casts[0]);
      if (!cardId) return;
      this.pendingSacrifice.selected = toggleSacrifice(selected, ref.iid,
        sacrificeCandidates(this.duel.instanceState, CARD_DB, HUMAN), def(CARD_DB, cardId).rite?.n);
      this.sync();
      return;
    }
    const awaiting = this.duel.awaiting;
    if (awaiting.kind === 'chooseTarget' && awaiting.player === HUMAN) {
      const edict = edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks);
      if (edict && ref.kind === 'permanent') {
        this.edictPicks = toggleSacrifice(this.edictPicks, ref.iid, edict.candidates, edict.count);
        this.sync();
      } else if (!edict) this.confirmTriggerTarget(ref);
      return;
    }
    if (!this.pendingCasts) return;
    if (this.pendingCasts[0]?.type !== 'linkHaunt') {
      const actions = this.pendingCasts.filter((a): a is TargetSelectionAction => a.type !== 'linkHaunt');
      this.targetPicks = toggleTargetSelection(actions, this.targetPicks, ref, this.targetPicksUnordered);
      const next = this.pendingTargetStep();
      if (next.complete && ((next.count === 1 && !this.targetPicksUnordered) ||
        (actions[0].type === 'activate' && !this.targetsExact && next.targets.length === 0))) this.confirmPendingTargets();
      else {
        this.sync();
        if (this.targetsNeedPicker()) this.showGravePicker(actions);
      }
      return;
    }
    const matches = this.pendingCasts.filter((c): c is PendingCastAction | LinkHauntAction => {
      if (c.type === 'activate') return false;
      const t = this.pendingActionTarget(c);
      return t !== undefined && this.targetRefEquals(t, ref);
    });
    if (matches.length === 0) return;
    // For X spells pick the biggest X the mana allows.
    const best = matches[0].type === 'linkHaunt'
      ? matches[0]
      : matches.reduce((a, b) => {
        const ax = a.type === 'linkHaunt' ? 0 : a.x ?? 0;
        const bx = b.type === 'linkHaunt' ? 0 : b.x ?? 0;
        return ax >= bx ? a : b;
      });
    this.act(best);
  }

  private maybeRunAI(): void {
    if (this.a11yFixture) return;
    if (this.replayMode || this.ended) return;
    if (this.animatingCombat) return; // wait out a combat sequence; finishStep resumes us
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== AI) return;
    // The opening modal owns the reveal/result cadence, then submits the AI's
    // choice. Normal AI pacing resumes at the first mulligan decision.
    if (a.kind === 'choosePlayDraw') return;
    this.undoSnapshot = null; // priority has left you — the local Undo is no longer valid
    this.undoBlocked = null;
    if (this.aiTimer) return;
    this.aiTimer = this.time.delayedCall(400, () => {
      this.aiTimer = null;
      if (this.ended || this.animatingCombat) return;
      const aw = this.duel.awaiting;
      if (!('player' in aw) || aw.player !== AI) return;
      const action = this.ai.chooseAction(this.duel.viewFor(AI), this.duel.legalActions(AI));
      const events = this.duel.submit(AI, action);
      if (this.replayDraft) recordReplayAction(this.replayDraft, AI, action);
      this.rememberRetellAction(action, events);
      this.processEvents(events);
      // Deferred through afterEvents so the AI's combat damage animates before
      // its next decision (its declareAttackers still drives your blockers).
      this.afterEvents();
    });
  }

  /**
   * Auto-skip a decision that offers the human no real choice (engine
   * forcedAction): an action phase with nothing playable, declare-attackers with
   * no able attacker, declare-blockers with no legal blocker. Runs at every
   * point maybeRunAI does. Chains (skip main1 → skip combat → skip main2)
   * pace themselves one hop per delayedCall so the player can read the phases
   * ticking by; each hop re-reads the awaiting decision fresh and terminates
   * at the next real decision naturally.
   */
  private maybeAutoSkip(): void {
    if (this.a11yFixture) return;
    if (this.replayMode || this.tutorial) return; // the coach-mark guide drives pacing explicitly
    if (this.empowerChooser || this.gravePicker) return;
    if (this.endingTurn) return; // end-turn mode drives its own hops (endTurnTick)
    if (!Services.save.data.settings.autoSkip) return; // settings toggle (SettingsScene)
    if (this.ended) return;
    if (this.animatingCombat) return; // hold until the combat sequence finishes
    if (this.autoSkipTimer) return; // a hop is already scheduled
    if (this.overlay || this.inspect || this.pendingCasts || this.carry || this.landFan || this.pauseOverlay || this.zoneModal) return;
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return;
    if (a.kind === 'foresee') return; // mandatory revealed-card pick; never auto-skip
    if (!forcedAction(this.duel.instanceState, CARD_DB, HUMAN)) return;
    this.autoSkipTimer = this.time.delayedCall(300, () => {
      this.autoSkipTimer = null;
      if (this.ended) return;
      if (this.empowerChooser || this.gravePicker) return;
      if (this.overlay || this.inspect || this.pendingCasts || this.carry || this.landFan || this.pauseOverlay || this.zoneModal) return;
      const awaiting = this.duel.awaiting;
      if (!('player' in awaiting) || awaiting.player !== HUMAN) return;
      if (awaiting.kind === 'foresee') return; // re-check after the delay
      // Re-evaluate fresh — the state may have moved while we waited (e.g.
      // the player clicked the smart button during the delay).
      const forced = forcedAction(this.duel.instanceState, CARD_DB, HUMAN);
      if (!forced) return;
      this.showSkipNotice(this.skipMessage(forced));
      // Mark the transition so a near-simultaneous smart-button click (already in
      // flight for the pre-hop decision) is swallowed rather than applied to
      // the decision this skip is about to advance into.
      this.lastAutoSkipAt = this.time.now;
      this.clearNoBlockArm();
      this.act(forced); // act() re-runs maybeAutoSkip: chains continue hop by hop
    });
  }

  private skipMessage(forced: Action): string {
    switch (forced.type) {
      case 'passStep':
        return 'Action phase skipped (no playable cards)';
      case 'declareAttackers':
        return forcedAttackNotice(forced.attackers.length);
      case 'declareBlockers':
        return 'No blockers available';
      default:
        return 'Phase skipped';
    }
  }

  /** Transient auto-skip toast in the zone-plate gap + a mirrored log line. */
  private showSkipNotice(msg: string): void {
    this.log(msg);
    this.showTransientNotice(msg);
  }

  /** Board feedback that fades without adding an entry to match history. */
  private showTransientNotice(msg: string): void {
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
    if (this.ended || !this.isHumanTurnDecision() || this.isHumanChooseTarget()) return;
    if (this.empowerChooser || this.gravePicker) return;
    if (this.pendingCasts || this.carry || this.landFan || this.overlay || this.inspect || this.pauseOverlay || this.zoneModal) return;
    // End Turn skips the rest of the turn outright, so the guard applies from
    // either action phase. This button has no label of its own to re-colour, so
    // the notice toast carries the warning instead.
    if (shouldArmLandDrop(this.landDropGuardInput(true))) {
      this.armLandDrop();
      this.showSkipNotice(LAND_DROP_NOTICE);
      this.syncButton();
      return;
    }
    this.clearLandDropArm();
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
    if (this.empowerChooser || this.gravePicker) return;
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
    if (this.overlay || this.inspect || this.pendingCasts || this.carry || this.landFan || this.pauseOverlay || this.zoneModal || this.isHumanChooseTarget()) return;
    if (!this.isHumanTurnDecision()) return;
    if (!this.endTurnPassAction()) return; // pause at a decision needing real input
    this.endTurnTimer = this.time.delayedCall(180, () => {
      this.endTurnTimer = null;
      if (this.empowerChooser || this.gravePicker) return;
      if (!this.endingTurn || this.ended) {
        this.endingTurn = false;
        return;
      }
      // Re-check fresh — the player may have opened an overlay during the wait.
      if (this.overlay || this.inspect || this.pendingCasts || this.carry || this.landFan || this.pauseOverlay || this.zoneModal || this.isHumanChooseTarget()) return;
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
      case 'declareAttackers': {
        // End Turn is an explicit "skip the rest of my turn" — decline combat
        // outright (user-directed 2026-07-10; the old stop-if-I-can-attack
        // pause made End Turn strand at the combat decision). Rage cannot be
        // declined, so the minimum legal declaration is the compelled set,
        // which is empty on any board with no Rage creature able to attack.
        this.selectedAttackers.clear();
        return {
          type: 'declareAttackers',
          attackers: compelledAttackers(this.duel.state, CARD_DB, HUMAN),
        };
      }
      case 'respond':
      case 'endStepWindow':
      case 'hauntlinkWindow':
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
   * attacker-by-attacker (playCombatSequence) at `animations: 'full'`, and so is
   * a Hunt whose two creatures are both on the board (1.9 A2.a); every other
   * batch (and reduced/off motion) narrates instantly, one event at a time
   * (the pre-sequencing behavior), and draws its Hunts once the board syncs.
   */
  private processEvents(events: GameEvent[]): void {
    if (!this.replayMode && !this.tutorial && !this.a11yFixture && events.length > 0) {
      const progress = applyDailyQuestProgress(Services.save.data, CARD_DB, events, todayString());
      if (progress.changed) Services.save.touch();
    }
    this.huntDrawn = huntDrawnDamage(events, (iid) => this.huntPlaced(iid));
    const sequence =
      Services.save.data.settings.animations === 'full' &&
      !this.animatingCombat &&
      events.some((e) => (e.e === 'combatDamage' && e.hits.length > 0) || (e.e === 'hunted' && this.huntShownOnBoard(e)));
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
        // A blow a Hunt's exchange lands is drawn there (renderHuntExchange).
        if (this.huntDrawn.has(e)) break;
        Sfx.play('hit');
        const v = this.views.get(e.iid);
        if (v) this.float(v.x, v.y - 56, `-${e.amount}`, '#ffb04a');
        break;
      }
      case 'hunted': {
        // Outside a full-motion sequence the exchange is drawn once the board
        // has synced, so an arrival hunter cast this batch has its tile.
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line);
        this.queueHuntFx(e, batch);
        break;
      }
      case 'triggerFired': {
        // Only a Provoked trigger has a line (1.9); the rest stay silent, as before.
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        const source = this.duel.state.battlefield.find((perm) => perm.iid === e.iid);
        if (line) this.log(line, source?.cardId);
        break;
      }
      case 'manaActivated': {
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line, e.cardId);
        this.showManaActivated(e);
        break;
      }
      case 'died': {
        Sfx.play('death');
        const v = this.views.get(e.iid);
        const who = e.owner === HUMAN ? 'Your' : 'Enemy';
        if (this.brokenHauntlinks.has(e.iid)) {
          // Keep the flag through the immediate post-event sync so the
          // departing underlap can visibly sever instead of using the normal
          // generic board-card fade.
          this.log(`${who} ${this.cardRef(e.cardId)} lost its host and went to its owner's graveyard`, e.cardId);
        } else if (v || tookPartInHunt(batch, e.iid)) {
          // A hunter that died in its own arrival Hunt never had a tile; its death is still said.
          this.log(`${who} ${this.cardRef(e.cardId)} died`, e.cardId);
        }
        break;
      }
      case 'recalled': {
        // A return to hand is not a death: no death sound, and the line says
        // where the card went (a token ceases to exist instead).
        const who = e.owner === HUMAN ? 'Your' : 'Enemy';
        this.log(
          e.token ? `${who} ${this.cardRef(e.cardId)} left play` : `${who} ${this.cardRef(e.cardId)} returned to its owner's hand`,
          e.cardId,
        );
        break;
      }
      case 'discarded':
        this.log(`${e.player === HUMAN ? 'You discard' : 'Opponent discards'} ${this.cardRef(e.cardId)}.`, e.cardId);
        break;
      case 'hauntlinkFormed': {
        const host = this.duel.state.battlefield.find((perm) => perm.iid === e.hostIid);
        const hostName = host ? def(CARD_DB, host.cardId).name : 'a creature';
        this.log(
          `${e.controller === HUMAN ? 'Your' : 'Enemy'} ${this.cardRef(e.cardId)} linked to ${hostName}`,
          e.cardId,
        );
        break;
      }
      case 'activated': {
        this.log(dutyNarration(
          this.cardRef(e.cardId),
          e.player === HUMAN ? 'you' : 'opponent',
          dutyEffectText(def(CARD_DB, e.cardId), e.abilityIndex),
          e.marksSpent,
        ), e.cardId);
        const view = this.views.get(e.iid);
        if (e.player !== HUMAN) {
          // The gold 'eligible' ring means "you can act with this", which reads
          // as an invitation on the foe's tile. A neutral ring rides the tile
          // itself (so it turns with the tap) for the same beat instead.
          if (view?.active && this.cueContext() !== 'targeting') {
            const ring = this.add.rectangle(0, 0, TILE_W + 6, TILE_H + 6, 0x000000, 0)
              .setStrokeStyle(theme.outline.state, colorInt(theme.colors.heading), 1).setName('duel-duty-flash');
            view.add(ring);
            this.time.delayedCall(350, () => {
              if (ring.active) ring.destroy();
            });
          }
          break;
        }
        this.dutyHighlights.add(e.iid);
        if (view?.active && this.cueContext() !== 'targeting') view.setHighlight('eligible');
        this.time.delayedCall(350, () => {
          this.dutyHighlights.delete(e.iid);
          const current = this.views.get(e.iid);
          const source = this.duel.state.battlefield.find((perm) => perm.iid === e.iid);
          if (current?.active && source) this.syncTileCue(current, source, current.scaleX);
        });
        break;
      }
      case 'hauntlinkBroken':
        if (e.unlinked) {
          const moved = batch.some(
            (candidate) => candidate.e === 'hauntlinkFormed' && candidate.linkIid === e.linkIid,
          );
          if (!moved) {
            this.log(
              `${e.owner === HUMAN ? 'Your' : 'Enemy'} ${this.cardRef(e.cardId)} became unlinked`,
              e.cardId,
            );
          }
          const view = this.views.get(e.linkIid);
          view?.setHauntlinkBroken(true);
          this.time.delayedCall(240, () => this.views.get(e.linkIid)?.setHauntlinkBroken(false));
          break;
        }
        // The engine emits this before the linked permanent's ordinary died
        // event. Hold the relationship here so the later line describes the
        // actual graveyard exit instead of guessing from cast history.
        this.brokenHauntlinks.add(e.linkIid);
        this.views.get(e.linkIid)?.setHauntlinkBroken(true);
        break;
      case 'skimmed':
        this.log(`${e.player === HUMAN ? 'Skimmed' : 'Opponent skimmed'} ${this.cardRef(e.cardId)}`, e.cardId);
        this.showSkimTravel(e);
        break;
      case 'whispered': {
        const cast = batch.find((event): event is Extract<GameEvent, { e: 'spellCast' }> =>
          event.e === 'spellCast' && event.cardId === e.cardId && event.controller === e.player);
        const at = cast ? this.spellTargetsText(cast.targets, batch, e.player) : '';
        this.log(`${e.player === HUMAN ? 'You whispered' : 'Opponent whispered'} ${this.cardRef(e.cardId)}${at}`, e.cardId);
        break;
      }
      case 'spellCast': {
        Sfx.play('cast');
        // Targeted casts name their targets; the row's tappable card stays the
        // CAST card (the target names are informational, not extra links).
        const at = this.spellTargetsText(e.targets, batch, e.controller);
        const prefix = this.retellSpellIds.has(e.sid)
          ? 'Retold'
          : e.controller === HUMAN
            ? 'You cast'
            : 'Opponent casts';
        if (!this.whispersSpellIds.has(e.sid)) this.log(`${prefix} ${this.cardRef(e.cardId)}${at}`, e.cardId);
        const entered = batch.find(
          (candidate): candidate is Extract<GameEvent, { e: 'permanentEntered' }> =>
            candidate.e === 'permanentEntered' &&
            candidate.perm.cardId === e.cardId &&
            candidate.perm.controller === e.controller,
        );
        this.queuePlayReveal(e.cardId, e.controller, entered?.perm.iid,
          this.whispersSpellIds.has(e.sid) ? this.graveOrigin(e.controller) : undefined);
        if (e.controller === HUMAN) this.portrait.reactCast();
        else this.oppPortrait.reactCast();
        break;
      }
      case 'spellResolved':
        this.whispersSpellIds.delete(e.sid);
        break;
      case 'spellCountered':
        this.whispersSpellIds.delete(e.sid);
        this.log('Spell cancelled!');
        break;
      case 'stepChanged':
        this.combatPumpOffered = false; // a new step: the next combat says it again
        break;
      case 'responseWindowOpened':
        if (e.reopened && e.player === HUMAN) this.showSkipNotice('Respond again');
        else if (e.player === HUMAN) this.offerCombatPump();
        break;
      case 'targetsFizzled':
        this.whispersSpellIds.delete(e.sid);
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
        const retold = e.from === 'graveyard' && this.retellCardsInFlight.has(e.cardId);
        // A Preserve emits `severed` then `preserved` in one batch. Without
        // this the log read as a bare sever and never said a copy was made.
        const preserved = e.from === 'graveyard' && batch.some(
          (other) => other.e === 'preserved' && other.player === e.player && other.cardId === e.cardId,
        );
        if (preserved) {
          this.log(`Preserved ${this.cardRef(e.cardId)} from ${whose} graveyard; a token copy enters play`, e.cardId);
        } else if (retold) {
          this.retellCardsInFlight.delete(e.cardId);
          this.log(`Retold ${this.cardRef(e.cardId)} severed from ${whose} graveyard`, e.cardId);
        } else if (e.from === 'graveyard') {
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
      case 'overcharged': {
        // A token refused at the creature cap powered up its namesake (1.9
        // A1.7). Said aloud, or the missing token reads as a bug, the lesson
        // of the silent blocker cap (src/config/rules.ts).
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line, e.cardId);
        break;
      }
      case 'tokenRefused': {
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line, e.tokenCardId);
        break;
      }
      case 'mandateDraw': {
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line);
        break;
      }
      case 'mandateChanged': {
        const line = eventHistoryLine(e, this.eventLineLookup(batch));
        if (line) this.log(line);
        this.flyMandateSeal(e.from, e.to);
        break;
      }
      case 'turnBegan':
        this.log(`Turn ${e.turn}: ${e.player === HUMAN ? 'your' : "opponent's"} turn`);
        this.showTurnBanner(e.turn, e.player === HUMAN);
        if (this.toastHeldForTurnBoundary && !this.replayMode) {
          this.toastHeldForTurnBoundary = false;
          this.toasts?.release();
        }
        // A human who starts is already looking at their opening board while it
        // settles on turn 1. Skip that redundant cue; turn 2+ handoffs chime.
        if (!this.replayMode && e.player === HUMAN && e.turn > 1) Sfx.play('yourTurn');
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
    const hunts: HuntedEvent[] = [];
    const diedInfo = new Map<number, Extract<GameEvent, { e: 'died' }>>();
    const heals: Extract<GameEvent, { e: 'lifeChanged' }>[] = [];
    const afterStrikes: GameEvent[] = [];
    let ended: Extract<GameEvent, { e: 'gameEnded' }> | undefined;
    const batch = {
      combat: events.some((e) => e.e === 'combatDamage' && e.hits.length > 0),
      huntDrawn: this.huntDrawn,
    };

    // sequencedBatchRoutes (combatSequence.ts) decides, per event, what the
    // strikes draw, what waits for them, and what is narrated at once.
    const routes = sequencedBatchRoutes(events, batch);
    events.forEach((e, index) => {
      switch (routes[index]) {
        case 'combatRound':
          if (e.e === 'combatDamage') rounds.push({ hits: e.hits });
          break;
        case 'hunt':
          // A Hunt whose hunter has no tile yet is drawn after the sync.
          if (e.e === 'hunted') {
            if (this.huntShownOnBoard(e)) hunts.push(e);
            else this.narrateEvent(e, events);
          }
          break;
        case 'died':
          if (e.e === 'died') diedInfo.set(e.iid, e);
          break;
        case 'heal':
          // Player DAMAGE is drawn per-hit (sequenced); keep only lifelink/heal
          // (+delta) to pop once the sequence settles.
          if (e.e === 'lifeChanged') heals.push(e);
          break;
        case 'afterStrikes':
          afterStrikes.push(e); // a Provoked trigger, then what it did: said once the blow lands
          break;
        case 'drawn':
          break; // creature and player damage floats are derived from the strikes
        case 'gameEnded':
          if (e.e === 'gameEnded') ended = e;
          break;
        case 'narrate':
          this.narrateEvent(e, events); // combat triggers etc. — narrate immediately
          break;
      }
    });

    // Hunts play after the batch's combat strikes (a batch rarely holds both);
    // each death lands with the blow that caused it.
    const died = [...diedInfo.keys()];
    const claimed = planHunts(hunts, died);
    const plan = planCombat(rounds, rounds.length > 0 ? claimed.unclaimed : []);
    const huntPlan = planHunts(hunts, died, plan.steps.length > 0 ? plan.totalMs : 0);
    const lastHunt = huntPlan.steps[huntPlan.steps.length - 1];
    if (plan.steps.length === 0 && lastHunt) lastHunt.deaths.push(...huntPlan.unclaimed);
    const settle = (): void => {
      heals.forEach((h) => this.narrateEvent(h)); // lifelink pops as combat settles
      afterStrikes.forEach((e) => this.narrateEvent(e, events));
    };
    if (plan.steps.length === 0 && huntPlan.steps.length === 0) {
      settle();
      this.finishStep(ended);
      return;
    }

    this.animatingCombat = true;
    // A Hunt-only sequence hands its Undo back when it settles, so a Hunt
    // spell can be taken back at full motion exactly as at reduced motion.
    const heldUndo = plan.steps.length === 0 ? { snapshot: this.undoSnapshot, blocked: this.undoBlocked } : null;
    this.undoSnapshot = null; // combat is resolving — no take-backs mid-sequence
    this.undoBlocked = null;
    // A Hunt spell's own targeting (its prompt, arrow and Confirm) ended with
    // the cast; clear it now rather than after the held board's sync.
    if (huntPlan.steps.length > 0) {
      this.syncTargetPrompt();
      this.syncButton();
      this.drawArrows();
    }
    const dir: -1 | 1 = this.duel.state.activePlayer === HUMAN ? -1 : 1;
    for (const step of plan.steps) {
      this.combatTimers.push(
        this.time.delayedCall(step.atMs, () => {
          if (!this.ended) this.renderCombatStep(step, dir, diedInfo);
        }),
      );
    }
    for (const step of huntPlan.steps) {
      this.combatTimers.push(
        this.time.delayedCall(step.atMs, () => {
          if (!this.ended) this.renderHuntStep(step, diedInfo, events);
        }),
      );
    }
    this.combatTimers.push(
      this.time.delayedCall(Math.max(plan.totalMs, huntPlan.totalMs), () => {
        this.combatTimers = [];
        this.animatingCombat = false;
        if (this.ended) return;
        if (heldUndo) {
          this.undoSnapshot = heldUndo.snapshot;
          this.undoBlocked = heldUndo.blocked;
        }
        settle();
        this.finishStep(ended);
      }),
    );
  }

  /** A Hunt's moment in a full-motion sequence: the exchange on the held board, then its deaths. */
  private renderHuntStep(
    step: HuntStep,
    diedInfo: Map<number, Extract<GameEvent, { e: 'died' }>>,
    batch: readonly GameEvent[],
  ): void {
    const { at, creatures } = this.huntTiles(step.hunt, batch);
    // The whole batch, so a creature that died, returned or was severed in it is still named.
    const line = eventHistoryLine(step.hunt, this.eventLineLookup(batch));
    if (line) this.log(line);
    this.renderHuntExchange(step.hunt, at, creatures, true);
    for (const iid of step.deaths) this.logSequencedDeath(iid, diedInfo);
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
    for (const iid of step.deaths) this.logSequencedDeath(iid, diedInfo);
  }

  /** A death in a full-motion sequence, said when the blow that caused it lands. */
  private logSequencedDeath(iid: number, diedInfo: Map<number, Extract<GameEvent, { e: 'died' }>>): void {
    Sfx.play('death');
    const info = diedInfo.get(iid);
    if (!info) return;
    const who = info.owner === HUMAN ? 'Your' : 'Enemy';
    if (this.brokenHauntlinks.delete(iid)) {
      this.log(`${who} ${this.cardRef(info.cardId)} lost its host and went to its owner's graveyard`, info.cardId);
    } else {
      this.log(`${who} ${this.cardRef(info.cardId)} died`, info.cardId);
    }
  }

  /** A Hunt's two tiles are on the board now, so a full-motion sequence can hold them while it plays. */
  private huntShownOnBoard(e: HuntedEvent): boolean {
    return [e.hunter, e.prey].every((iid) => this.views.get(iid)?.active === true);
  }

  /**
   * A Hunt's creature has a spot its exchange can draw on: a tile now, or, on
   * the battlefield after the batch, the tile the next sync gives it.
   */
  private huntPlaced(iid: number): boolean {
    return this.views.get(iid)?.active === true || this.duel.state.battlefield.some((perm) => perm.iid === iid);
  }

  /**
   * A Hunt's two creatures as they stand: where each tile is, and each one's
   * card and side, read from its tile, the battlefield, or the batch it
   * entered or left in.
   */
  private huntTiles(
    e: HuntedEvent,
    batch: readonly GameEvent[],
  ): { at: Map<number, { x: number; y: number }>; creatures: Map<number, HuntCreature> } {
    const at = new Map<number, { x: number; y: number }>();
    const creatures = new Map<number, HuntCreature>();
    for (const iid of [e.hunter, e.prey]) {
      const view = this.views.get(iid);
      if (view?.active) at.set(iid, { x: view.x, y: view.y });
      const perm = this.duel.state.battlefield.find((p) => p.iid === iid)
        ?? batch.find((ev): ev is Extract<GameEvent, { e: 'permanentEntered' | 'tokenCreated' }> =>
          (ev.e === 'permanentEntered' || ev.e === 'tokenCreated') && ev.perm.iid === iid)?.perm;
      const left = departedInBatch(batch, iid);
      const card = view?.active ? view.card : perm ? def(CARD_DB, perm.cardId) : left ? def(CARD_DB, left.cardId) : null;
      const side = perm?.controller ?? this.viewSides.get(iid) ?? left?.player;
      if (card && side !== undefined) creatures.set(iid, { card, side });
    }
    return { at, creatures };
  }

  /** Capture a Hunt's tiles as they stand, to draw its exchange once the board has synced (flushHuntFx). */
  private queueHuntFx(e: HuntedEvent, batch: readonly GameEvent[]): void {
    this.pendingHuntFx.push({ hunt: e, ...this.huntTiles(e, batch) });
  }

  /**
   * Draw the queued Hunt exchanges after a sync: a creature still on the board
   * is struck at its tile's settled spot (`boardTargets`, where an arriving
   * hunter now has a tile), one the Hunt killed where it stood. No lunge: the
   * sync's own tile tweens are moving the tiles.
   */
  private flushHuntFx(): void {
    const queued = this.pendingHuntFx.splice(0);
    for (const { hunt, at, creatures } of queued) {
      for (const iid of [hunt.hunter, hunt.prey]) {
        const settled = this.boardTargets.get(iid);
        if (settled && this.duel.state.battlefield.some((p) => p.iid === iid)) at.set(iid, { x: settled.x, y: settled.y });
      }
      this.renderHuntExchange(hunt, at, creatures, false);
    }
  }

  /**
   * One Hunt's exchange (1.9 A2.a): both creatures strike at the same instant,
   * each blow with the striker's own attack effect, and each creature's number
   * lands on it: the damage it took, or a muted 0 when the other dealt none,
   * so an exchange with no Attack on either side still reads. `lunge` only on
   * a held board (a full-motion sequence). What is drawn when a creature has
   * no spot is `huntExchangeDraw`'s: the other one still takes its blow and
   * its number, struck from the missing creature's side of the board.
   */
  private renderHuntExchange(
    hunt: HuntedEvent,
    at: ReadonlyMap<number, { x: number; y: number }>,
    creatures: ReadonlyMap<number, HuntCreature>,
    lunge: boolean,
  ): void {
    const draw = huntExchangeDraw(hunt, (iid) => at.has(iid));
    const hunterAt = at.get(hunt.hunter);
    const preyAt = at.get(hunt.prey);
    if (draw.tether && hunterAt && preyAt) {
      const tile = (iid: number) => (lunge ? this.views.get(iid) ?? null : null);
      this.combatFx.exchange(tile(hunt.hunter), hunterAt, tile(hunt.prey), preyAt, colorInt(theme.colors.heading));
    }
    let dealt = false;
    for (const { blow, strikerPlaced } of draw.landings) {
      const to = at.get(blow.target);
      if (!to) continue;
      const striker = creatures.get(blow.source);
      if (blow.amount > 0) {
        dealt = true;
        const from = strikerPlaced ? at.get(blow.source) : striker && this.creatureRowSpot(striker.side, to.x);
        if (striker && from) this.combatFx.strike(from, to, striker.card);
      }
      this.float(to.x, to.y - 40, huntFloatText(blow.amount), blow.amount > 0 ? '#ffb04a' : theme.colors.muted);
    }
    if (dealt) Sfx.play('hit');
  }

  /** A spot on a side's creature row, for a blow from a creature with no tile. */
  private creatureRowSpot(side: PlayerId, x: number): { x: number; y: number } {
    return { x, y: side === HUMAN ? LAYOUT.myCreatures.cy : LAYOUT.oppCreatures.cy };
  }

  /**
   * The history lines' view of the board: a permanent on the battlefield, one
   * that died, returned or was severed in this batch, or, failing both, one
   * whose tile is still up from the last sync, named with its [card] and its
   * side, so a Hunt or Provoked line is not dropped for want of a name.
   */
  private eventLineLookup(batch: readonly GameEvent[]): EventLineLookup {
    const side = (player: PlayerId): 'you' | 'opponent' => (player === HUMAN ? 'you' : 'opponent');
    return {
      permanent: (iid) => {
        const perm = this.duel.state.battlefield.find((p) => p.iid === iid);
        if (perm) return { ref: this.cardRef(perm.cardId), side: side(perm.controller) };
        const left = departedInBatch(batch, iid);
        if (left) return { ref: this.cardRef(left.cardId), side: side(left.player) };
        const tile = this.views.get(iid);
        const tileSide = this.viewSides.get(iid);
        return tile && tileSide !== undefined ? { ref: this.cardRef(tile.card.id), side: side(tileSide) } : null;
      },
      cardRef: (cardId) => this.cardRef(cardId),
      card: (cardId) => def(CARD_DB, cardId),
      sideOf: side,
      overchargeLimit: RULES.overchargeLimit,
    };
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
  private spellTargetsText(
    targets: readonly TargetRef[],
    batch: readonly GameEvent[],
    caster?: PlayerId,
  ): string {
    const parts: string[] = [];
    for (const t of targets) {
      if (t.kind === 'player') {
        // A caster hitting their own seat reads reflexively; "Opponent casts
        // X at the opponent" is technically true and terrible (user report
        // 2026-08-01).
        if (caster !== undefined && t.player === caster) {
          parts.push(caster === HUMAN ? 'yourself' : 'themselves');
        } else {
          parts.push(t.player === HUMAN ? 'you' : 'the opponent');
        }
      } else if (t.kind === 'permanent') {
        const cardId =
          this.duel.state.battlefield.find((p) => p.iid === t.iid)?.cardId ??
          batch.find(
            (ev): ev is Extract<GameEvent, { e: 'died' | 'recalled' }> =>
              (ev.e === 'died' || ev.e === 'recalled') && ev.iid === t.iid,
          )?.cardId;
        if (cardId !== undefined) parts.push(this.cardRef(cardId));
      }
    }
    return parts.length > 0 ? ` at ${parts.join(', ')}` : '';
  }

  private float(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(26, 'h1')}px`,
        fontStyle: 'bold',
        color,
        stroke: theme.colors.dim,
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
  private queuePlayReveal(cardId: string, controller: PlayerId, permanentIid?: number,
    source?: { x: number; y: number; scale: number; angle: number }): void {
    const humanSource =
      controller === HUMAN && this.humanPlayOrigin?.cardId === cardId
        ? this.humanPlayOrigin.source
        : undefined;
    this.pendingPlayReveals.push({ cardId, controller, permanentIid, source: humanSource ?? source });
    if (humanSource) this.humanPlayOrigin = null;
  }

  /** Start every reveal after the state has rendered its real tile/land stack underneath it. */
  private flushPlayReveals(): void {
    const reveals = this.pendingPlayReveals.splice(0);
    const motion = this.motionLevel();
    if (motion === 'off') {
      for (const reveal of reveals) if (reveal.controller === AI) this.showOpponentCast(reveal.cardId);
      return;
    }
    if (motion === 'reduced') {
      for (const reveal of reveals) if (reveal.controller === AI) this.showReducedOpponentReveal(reveal.cardId);
      return;
    }
    // A spell storm must not turn the longer visual journey into a longer
    // turn. Cap the simultaneous ghosts at three and start them a beat apart;
    // every real state change is already synced and remains actionable.
    for (const [index, reveal] of reveals
      .slice(0, CARD_TRAVEL_MOTION.batch.maxAnimatedCards)
      .entries()) {
      const delay = index * CARD_TRAVEL_MOTION.batch.staggerMs;
      if (delay === 0) this.showPlayReveal(reveal);
      else {
        this.time.delayedCall(delay, () => {
          if (this.sys.isActive()) this.showPlayReveal(reveal);
        });
      }
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
    const variant = reveal.controller === HUMAN ? displayVariantFor(Services.save.data, reveal.cardId) : undefined;
    const source =
      reveal.source ??
      (opponent
        ? { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.handY, scale: 0.25, angle: 0 }
        : { x: BOARD_CENTER_X, y: 24, scale: 0.35, angle: 0 });
    const station = opponent
      ? { x: BOARD_CENTER_X, y: 250, scale: 0.72, pause: CARD_TRAVEL_MOTION.opponentStationHold }
      : { x: BOARD_CENTER_X, y: 430, scale: 0.6, pause: CARD_TRAVEL_MOTION.playerStationHold };
    const destination = this.revealDestination(reveal);
    const ghost = new CardView(this, source.x, source.y)
      .setScale(source.scale)
      .setAngle(source.angle)
      .setDepth(theme.depth.floats)
      .setAlpha(0.96);
    ghost.setCard(def(CARD_DB, reveal.cardId), {
      fx: 'none',
      variant,
      fullArt: variant?.fullArt === true,
      landStyle: reveal.controller === HUMAN ? this.humanLandStyleFor(reveal.cardId) : undefined,
    });
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
        duration: CARD_TRAVEL_MOTION.arrivalFade.duration,
        ease: CARD_TRAVEL_MOTION.arrivalFade.ease,
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
        duration: CARD_TRAVEL_MOTION.stationToBattlefield.duration,
        ease: CARD_TRAVEL_MOTION.stationToBattlefield.ease,
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
      duration: CARD_TRAVEL_MOTION.playToStation.duration,
      ease: CARD_TRAVEL_MOTION.playToStation.ease,
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

  /** Full-motion Skim read: the hand card travels to its new graveyard slot. */
  private showSkimTravel(e: Extract<GameEvent, { e: 'skimmed' }>): void {
    const variant = e.player === HUMAN ? displayVariantFor(Services.save.data, e.cardId) : undefined;
    const handSource = e.player === HUMAN && this.humanPlayOrigin?.cardId === e.cardId
      ? this.humanPlayOrigin.source
      : undefined;
    if (e.player === HUMAN && handSource) this.humanPlayOrigin = null;
    if (this.motionLevel() !== 'full') return;
    const source =
      handSource
        ? handSource
        : e.player === HUMAN
          ? { x: BOARD_CENTER_X, y: 680, scale: 0.35, angle: 0 }
          : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.handY, scale: 0.25, angle: 0 };
    const destination = e.player === HUMAN
      ? { x: LAYOUT.piles.x, y: LAYOUT.piles.graveY }
      : { x: LAYOUT.oppPiles.x, y: LAYOUT.oppPiles.graveY };
    const ghost = new CardView(this, source.x, source.y)
      .setScale(source.scale)
      .setAngle(source.angle)
      .setDepth(theme.depth.floats)
      .setAlpha(0.9);
    ghost.setCard(def(CARD_DB, e.cardId), {
      fx: 'none',
      variant,
      fullArt: variant?.fullArt === true,
      landStyle: e.player === HUMAN ? this.humanLandStyleFor(e.cardId) : undefined,
    });
    this.playRevealGhosts.add(ghost);
    const cleanUp = (): void => {
      this.playRevealGhosts.delete(ghost);
      if (ghost.active) ghost.destroy();
    };
    this.tweens.add({
      targets: ghost,
      x: destination.x,
      y: destination.y,
      scaleX: 0.18,
      scaleY: 0.18,
      angle: 0,
      alpha: 0,
      duration: CARD_TRAVEL_MOTION.skimToGraveyard.duration,
      ease: CARD_TRAVEL_MOTION.skimToGraveyard.ease,
      onComplete: cleanUp,
      onStop: cleanUp,
    });
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
    const variant = e.player === HUMAN ? displayVariantFor(Services.save.data, e.cardId) : undefined;
    const source = this.severSource(e);
    const destination = this.severedPilePos(e.player);
    const ghost = new CardView(this, source.x, source.y)
      .setScale(source.scale)
      .setDepth(theme.depth.floats)
      .setAlpha(0.9);
    ghost.setCard(def(CARD_DB, e.cardId), {
      fx: 'none',
      variant,
      fullArt: variant?.fullArt === true,
      landStyle: e.player === HUMAN ? this.humanLandStyleFor(e.cardId) : undefined,
    });
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
      duration: CARD_TRAVEL_MOTION.severToPile.duration,
      ease: CARD_TRAVEL_MOTION.severToPile.ease,
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
    const who = isYou ? 'Your Turn' : `${this.opponentName() ?? 'Opponent'}'s Turn`;
    const accent = isYou ? theme.colors.gold : theme.colors.body;
    const bannerY = 74;
    const banner = this.add.container(BOARD_CENTER_X, bannerY).setDepth(theme.depth.banner).setAlpha(0);
    const sub = this.add
      .text(0, -16, `TURN ${turn}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: '700',
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    const title = this.add
      .text(0, 10, who, { fontFamily: theme.fonts.display, fontSize: `${duelHudType(26, 'h1')}px`, color: accent })
      .setOrigin(0.5);
    // The frame fits the name, never the reverse: a hardcoded 340 put
    // "Carmilla, Crimson Host's Turn" outside its own border (user playtest
    // 2026-07-30). Glyph widths are font-fallback-dependent on Windows, so
    // measure the rendered Text — grow the frame up to a cap, and only past
    // the cap shrink the type to fit.
    const framePad = 28;
    const frameMaxW = 560;
    if (title.width + framePad * 2 > frameMaxW) {
      title.setFontSize(Math.max(duelHudType(17, 'h1'), Math.floor((duelHudType(26, 'h1') * (frameMaxW - framePad * 2)) / title.width)));
      title.setData('a11yFitToBox', true);
    }
    const frameW = Math.max(340, Math.min(frameMaxW, Math.ceil(title.width) + framePad * 2));
    const bg = this.add
      .rectangle(0, 0, frameW, 66, colorInt(theme.colors.panelFill), 0.82)
      .setStrokeStyle(1.5, colorInt(accent));
    banner.add([bg, sub, title]);
    banner.bringToTop(sub);
    banner.bringToTop(title);
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
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: '700',
        color: theme.colors.danger,
        stroke: theme.colors.dim,
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
    // Engine state moved underneath a lifted card (never our own drop — that
    // path tears down first). The rebuild below invalidates every carried
    // reference, so the carry ends instantly rather than dangling.
    if (this.carry) this.teardownCarry();
    this.closeLandFan();
    if (this.replayMode) this.replayGuard.close();
    const awaitingKind = this.duel.awaiting.kind;
    if (this.lastAwaitingKind !== null && this.lastAwaitingKind !== awaitingKind) {
      this.clearNoBlockArm();
      this.clearLandDropArm();
    }
    this.lastAwaitingKind = awaitingKind;
    // A board rebuild invalidates every source position from a hover plan.
    this.clearManaPlanPreview();
    const st = this.duel.state;
    if (this.choiceState !== st) {
      if (!this.pendingCasts && this.targetPicks.length > 0) this.holdCommittedPicks();
      this.choiceState = st;
      this.edictPicks = [];
      this.targetPicks = [];
      this.targetFocus = 0;
      this.keyboardTarget = null;
    }
    const view = this.duel.viewFor(HUMAN);
    this.refreshDutyActions();
    this.boardTargets.clear();
    // Rage: the creatures that must attack enter your declaration already
    // chosen (ring and lift), so the button never offers a skip the engine
    // would refuse. The engine's compelled list is empty without Rage.
    const decision = this.duel.awaiting;
    if (!this.replayMode && decision.kind === 'declareAttackers' && decision.player === HUMAN) {
      this.selectedAttackers = new Set(attackDeclaration(this.selectedAttackers, this.rageAttackers()));
    }

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
    // Graveyard affordance: pulse the grave pile with the count of graveyard
    // slots with Retell/Preserve actions or a live Whispers deadline. Whispers
    // stays visible while unaffordable, matching its disabled modal row.
    this.myGravePile.setAlert(this.graveActionSlots(HUMAN).size);
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
    this.syncMandateSeal();
    this.syncPhaseTrack(st.turn === 0 ? null : phaseTrackRowForStep(st.step), yours);
    this.syncUndoButton();
    this.syncCombatPreview();

    // Battlefield tiles: attached auras without Duty stay badges on their hosts; lands move
    // to the clickable mana-strip summary; non-creature permanents get their
    // own lower-depth band so the creature rows keep room to breathe.
    const seen = new Set<number>();
    const visiblePermanents = st.battlefield.filter(
      (p) => (p.attachedTo === undefined || def(CARD_DB, p.cardId).activated !== undefined) &&
        !isType(def(CARD_DB, p.cardId), 'land'),
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
    this.syncLinkedPermanents(seen);
    for (const [iid, view] of [...this.views]) {
      if (!seen.has(iid)) {
        const picks = this.pickIndices({ kind: 'permanent', iid }, this.committedPicks);
        if (picks.length > 0) {
          // Submission can remove the target before its first picked frame.
          // Its departing view confirms the pick without remaining clickable.
          this.tweens.killTweensOf(view);
          view.disableInput().setAlpha(1).setData('a11yDeparting', true);
          view.setCue(null, 'targeting').setActionLabel(null).setKeyboardFocus(false).setPickBadge(picks, view.scaleX);
        }
        this.views.delete(iid);
        this.viewSides.delete(iid);
        const brokenHauntlink = this.brokenHauntlinks.delete(iid);
        if (brokenHauntlink) view.setHauntlinkBroken(true);
        this.tweens.add({
          targets: view,
          alpha: 0,
          scale: brokenHauntlink ? view.scaleX * 0.82 : 0.2,
          y: brokenHauntlink ? view.y - 18 : view.y,
          delay: picks.length > 0 ? 640 : 0,
          duration: 260,
          onComplete: () => {
            if (view.active) view.destroy();
          },
        });
      }
    }

    this.syncLandPositions(st.battlefield);
    this.syncManaPips();
    if (this.isReserveDuel()) this.syncReservePiles();
    this.syncDarlingZones();
    this.syncHand();
    // Target legality is reactive state. Re-arm both portrait Zones after the
    // later-created board/hand input surfaces so a legal face wins hit tests.
    this.syncFaceTargeting();
    this.syncTargetPrompt();
    this.syncButton();
    this.drawArrows();
    this.syncOverlay();
    if (this.isHumanChooseTarget() && !this.gravePicker && this.targetsNeedPicker()) this.showGravePicker([]);
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
      this.boardTargets.set(perm.iid, { x, y, scale });
      this.viewSides.set(perm.iid, perm.controller);
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
        const ownedVariant = perm.controller === HUMAN
          ? displayVariantFor(Services.save.data, perm.cardId)
          : undefined;
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
          if (p.button === 2 && !this.pendingCasts) this.showInspect(d, ownedVariant, undefined, this.permanentNote(iid));
        });
        if (d.activated) {
          view.on('pointerover', (p: Phaser.Input.Pointer) => {
            if (!p.wasTouch) this.previewDuty(iid);
          });
          view.on('pointerout', () => this.clearManaPlanPreview());
        }
        attachTouchGestures(this, view, {
          card: d, // long-press: sticky zoom preview
          variant: ownedVariant,
          onTap: () => this.onBattlefieldTap(iid, d),
        });
        this.zoom.attach(view, d, ownedVariant, undefined, () => this.permanentNote(iid));
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
      const stats = getEffectiveStats(this.duel.state, CARD_DB, perm.iid);
      if (isType(d, 'creature')) {
        view.setStats(stats.attack, stats.defense - perm.damage, {
          damage: perm.damage,
          attackDelta: stats.attack - (d.attack ?? 0),
          defenseDelta: stats.defense - (d.defense ?? 0),
          marks: perm.plusOneCounters ?? 0,
        }, scale);
      }
      view.setKeywords(stats.keywords);
      view.setAuraCount(perm.attachments.length);
      view.setOvercharge(perm.overcharge ?? 0, scale);
      view.setProvokedSpent(provokedSpent(d.abilities, perm.firedThisTurn), scale);
      this.syncTileCue(view, perm, scale);
      // Summoning-sickness affordance (engine is source of truth: entered
      // this turn + no haste). Only creatures can be sick; the call resets
      // itself when sickness wears off at the controller's untap.
      view.setSummoningSick(
        isType(d, 'creature') && isSummoningSick(this.duel.state, CARD_DB, perm),
      );
      // Quest chapter badge + Champion Awakening ring (1.2). The engine's
      // Permanent fields are the source of truth; non-Quests hide the badge.
      view.setChapter(d.chapters ? perm.chapter ?? 0 : null, d.chapters ? d.chapters.length : null);
      view.setAwakened(perm.awakened === true && d.awakening !== undefined);
    });
  }

  /** Render Hauntlink permanents as physical card underlaps with exposed headers. */
  private syncLinkedPermanents(seen: Set<number>): void {
    const links = this.duel.state.battlefield.filter((perm) => {
      return perm.attachedTo !== undefined && def(CARD_DB, perm.cardId).hauntlink !== undefined;
    });
    const perHost = new Map<number, Permanent[]>();
    for (const link of links) {
      const hostIid = link.attachedTo!;
      const list = perHost.get(hostIid);
      if (list) list.push(link);
      else perHost.set(hostIid, [link]);
    }

    for (const [hostIid, hostLinks] of perHost) {
      const host = this.duel.state.battlefield.find((perm) => perm.iid === hostIid);
      const hostView = this.views.get(hostIid);
      if (!host || !hostView) continue;
      const target = this.boardTargets.get(hostIid) ?? {
        x: hostView.x,
        y: hostView.y,
        scale: hostView.scaleX,
      };
      hostLinks.sort((a, b) => a.iid - b.iid);
      hostLinks.forEach((link, slot) => {
        const d = def(CARD_DB, link.cardId);
        const overlap = hauntlinkOverlap(link.controller === HUMAN ? 'you' : 'opponent', slot);
        const scale = target.scale * overlap.scale;
        const x = target.x + overlap.x;
        const y = target.y + overlap.y;
        seen.add(link.iid);
        this.viewSides.set(link.iid, link.controller);
        let view = this.views.get(link.iid);
        if (!view) {
          view = new BoardCardView(this, x, y, d);
          view.setDepth(3).setScale(scale);
          view.setTapped(link.tapped, false);
          const ownedVariant = link.controller === HUMAN
            ? displayVariantFor(Services.save.data, link.cardId)
            : undefined;
          if (ownedVariant) view.setVariant(ownedVariant);
          view.enableInput();
          view.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch || p.rightButtonReleased()) return;
            if (this.pendingCasts || this.isHumanChooseTarget()) this.onBattlefieldClick(link.iid);
            else if (!this.beginHauntlinkTargeting(link.iid)) this.showInspect(d, ownedVariant);
          });
          view.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.button === 2 && !this.pendingCasts) this.showInspect(d, ownedVariant);
          });
          attachTouchGestures(this, view, {
            card: d,
            variant: ownedVariant,
            onTap: () => {
              if (this.pendingCasts || this.isHumanChooseTarget()) this.onBattlefieldClick(link.iid);
              else if (!this.beginHauntlinkTargeting(link.iid)) this.showInspect(d, ownedVariant);
            },
          });
          this.zoom.attach(view, d, ownedVariant);
          this.views.set(link.iid, view);
          view.setAlpha(0);
          this.tweens.add({ targets: view, alpha: 1, duration: 180 });
        } else {
          view.setDepth(3);
          this.tweens.add({ targets: view, x, y, scale, duration: 200, ease: 'Cubic.easeOut' });
          view.setTapped(link.tapped);
        }
        view.setHauntlinkBroken(this.brokenHauntlinks.has(link.iid));
        const linkActions = this.hauntlinkActionsFor(link.iid);
        view.setActionLabel(permanentActionLabel(
          hauntlinkActionLabel(linkActions.length > 0, true),
          this.activateActionsFor(link.iid).length > 0,
        ), scale);
        this.syncTileCue(view, link, scale);
      });
    }
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

  private cueContext(): CueContext {
    if (this.pendingCasts || this.pendingSacrifice || this.isHumanChooseTarget()) return 'targeting';
    const kind = this.duel.awaiting.kind;
    return kind === 'declareAttackers' || kind === 'declareBlockers' ? kind : 'idle';
  }

  private tilePresentation(perm: Permanent): ReturnType<typeof duelTilePresentation> {
    const context = this.cueContext();
    const link = hauntlinkActionLabel(this.hauntlinkActionsFor(perm.iid).length > 0, perm.attachedTo !== undefined);
    return duelTilePresentation({
      context, opponent: perm.controller !== HUMAN,
      legal: this.targetRefsForInput().some(ref => ref.kind === 'permanent' && ref.iid === perm.iid),
      picked: this.targetPicks.some(ref => ref.kind === 'permanent' && ref.iid === perm.iid),
      sacrifice: Boolean(this.pendingSacrifice?.selected.includes(perm.iid)) ||
        (this.isHumanChooseTarget() && this.edictPicks.includes(perm.iid)),
      selectedAttacker: this.selectedAttackers.has(perm.iid),
      attacking: this.duel.state.combat?.attackers.includes(perm.iid) ?? false,
      pendingBlocker: this.pendingBlocker === perm.iid,
      assignedBlocker: this.blockAssignments.some(b => b.blocker === perm.iid),
      canAttack: context === 'declareAttackers' && this.isHumanTurnDecision() &&
        eligibleAttackers(this.duel.state, CARD_DB, HUMAN).includes(perm.iid),
      link, dutyUsable: this.activateActionsFor(perm.iid).length > 0,
      boostUsable: this.boostActionsFor(perm.iid).length > 0, actionFlash: this.dutyHighlights.has(perm.iid),
    });
  }

  private creatureY(iid: number, base: number): number {
    const perm = this.duel.state.battlefield.find(p => p.iid === iid);
    return perm && this.tilePresentation(perm).lifted ? base - 12 : base;
  }

  private syncTileCue(view: BoardCardView, perm: Permanent, scale: number): void {
    view.setData('a11yIid', perm.iid);
    const cue = this.tilePresentation(perm);
    view.setCue(cue.state, this.cueContext());
    if (this.cueContext() === 'targeting') view.list.filter(child => child.name === 'duel-duty-flash').forEach(child => child.destroy());
    view.setActionLabel(cue.chip, scale);
    const sacrifice = this.pendingSacrifice?.selected ?? this.edictPicks;
    const picked = cue.state === 'selectedSacrifice' ? [sacrifice.indexOf(perm.iid)]
      : this.pickIndices({ kind: 'permanent', iid: perm.iid });
    view.setPickBadge(picked, scale);
    view.setKeyboardFocus(this.keyboardTarget?.kind === 'permanent' && this.keyboardTarget.iid === perm.iid &&
      this.targetRefsForInput().some(ref => this.targetRefEquals(ref, this.keyboardTarget!)));
  }

  private visiblePicks(): readonly TargetRef[] {
    return this.cueContext() === 'targeting' ? this.targetPicks : this.committedPicks;
  }

  private pickIndices(ref: TargetRef, picks: readonly TargetRef[] = this.visiblePicks()): number[] {
    return picks.flatMap((pick, index) => this.targetRefEquals(pick, ref) ? [index] : []);
  }

  /** Keep automatic single-target submission unchanged, but let its badge render. */
  private holdCommittedPicks(): void {
    this.committedPicks = [...this.targetPicks];
    this.committedGraveReadout?.destroy();
    this.committedGraveReadout = null;
    // choiceState is the pre-submit snapshot. The chosen card may already
    // have left its graveyard when this sync sees the accepted action.
    this.committedPicks.forEach((ref, index) => {
      if (ref.kind !== 'grave' || this.committedPicks.slice(0, index).some(pick => this.targetRefEquals(pick, ref))) return;
      const cardId = this.choiceState?.players[ref.player].graveyard[ref.index];
      if (!cardId) return;
      const readout = this.committedGraveReadout ??= this.add.container(0, 0)
        .setDepth(theme.depth.modal + 1).setName('duel-committed-grave-picks');
      const x = 120 + index * 70, y = 125;
      const picked = new CardView(this, x, y).setScale(0.18);
      const indices = this.pickIndices(ref, this.committedPicks);
      picked.setCard(def(CARD_DB, cardId), { fx: 'none' });
      picked.setData('a11yPickBadge', pickBadgeLabel(indices)).setData('a11yCommittedGravePick', true);
      readout.add(picked);
      this.addPickBadge(readout, x, y, indices);
    });
    this.committedPickTimer?.remove();
    this.committedPickTimer = this.time.delayedCall(900, () => {
      this.committedPickTimer = null;
      this.committedPicks = [];
      this.committedGraveReadout?.destroy();
      this.committedGraveReadout = null;
      if (!this.sys.isActive()) return;
      for (const perm of this.duel.state.battlefield) {
        const view = this.views.get(perm.iid);
        if (view?.active) this.syncTileCue(view, perm, view.scaleX);
      }
      this.syncFaceTargeting();
    });
  }

  private hauntlinkActionsFor(iid: number): LinkHauntAction[] {
    if (this.pendingCasts || this.ended || this.replayMode) return [];
    return this.duel.legalActions(HUMAN).filter(
      (action): action is LinkHauntAction => action.type === 'linkHaunt' && action.iid === iid,
    );
  }

  private beginHauntlinkTargeting(iid: number): boolean {
    const actions = this.hauntlinkActionsFor(iid);
    if (actions.length === 0) return false;
    this.targetPicks = [];
    this.keyboardTarget = null;
    this.pendingCasts = actions;
    this.sync();
    return true;
  }

  /** Enumerate once per sync, rather than rebuilding the menu for each tile. */
  private refreshDutyActions(): void {
    this.dutyActionsBySource.clear();
    this.pumpActionsBySource.clear();
    this.dutyActionsState = this.duel.state;
    if (this.pendingCasts || this.ended || this.replayMode || !this.dutyActionsState.battlefield.some((source) => {
      if (source.controller !== HUMAN) return false;
      const card = def(CARD_DB, source.cardId);
      return card.activated !== undefined || (card.manaActivated?.length ?? 0) > 0;
    })) return;
    for (const action of this.duel.legalActions(HUMAN)) {
      if (action.type === 'activateMana') {
        const pumps = this.pumpActionsBySource.get(action.iid);
        if (pumps) pumps.push(action);
        else this.pumpActionsBySource.set(action.iid, [action]);
        continue;
      }
      if (action.type !== 'activate') continue;
      const actions = this.dutyActionsBySource.get(action.iid);
      if (actions) actions.push(action);
      else this.dutyActionsBySource.set(action.iid, [action]);
    }
  }

  /** Your pump actions on this creature right now (the Duty menu's rules: none while targeting, ended or replaying). */
  private boostActionsFor(iid: number): ManaPumpAction[] {
    if (this.pendingCasts || this.ended || this.replayMode) return [];
    if (this.dutyActionsState !== this.duel.state) return [];
    return this.pumpActionsBySource.get(iid) ?? [];
  }

  /** The line a tile's tooltip and inspect add about its state now: a spent Provoked (1.9 A2.a). */
  private permanentNote(iid: number): string | null {
    const perm = this.duel.state.battlefield.find((p) => p.iid === iid);
    if (!perm) return null;
    return provokedSpent(def(CARD_DB, perm.cardId).abilities, perm.firedThisTurn) ? PROVOKED_SPENT_NOTE : null;
  }

  private activateActionsFor(iid: number): DutyAction[] {
    if (this.pendingCasts || this.ended || this.replayMode) return [];
    // Game.submit replaces its public state snapshot. Reject a menu from the
    // previous state while event animation defers sync; Undo also changes it.
    if (this.dutyActionsState !== this.duel.state) return [];
    return this.dutyActionsBySource.get(iid) ?? [];
  }

  private beginActivate(iid: number): boolean {
    const source = this.duel.state.battlefield.find((perm) => perm.iid === iid);
    if (!source || source.controller !== HUMAN || this.ended || this.replayMode) return false;
    const card = def(CARD_DB, source.cardId);
    const awaiting = this.duel.awaiting;
    if (activatedAbilitiesOf(card).length > 1 && awaiting.kind === 'main' && awaiting.player === HUMAN) {
      // A picker of greyed rows explains nothing: with no usable Duty, fall
      // through to the same blocked-reason notice a single-Duty permanent gets.
      if (!dutyChoices(card, iid, this.duel.legalActions(HUMAN)).some((choice) => choice.enabled)) return false;
      this.dutyPicker = showDutyPicker(this, {
        card, touch: this.touch, choices: () => dutyChoices(card, iid, this.duel.legalActions(HUMAN)),
        choose: abilityIndex => {
          const choice = dutyChoices(card, iid, this.duel.legalActions(HUMAN))[abilityIndex];
          if (!choice?.enabled) return;
          this.closeEmpowerChooser();
          this.beginDutyActions(card, choice.actions);
        },
        cancel: () => this.closeEmpowerChooser(),
      });
      this.empowerChooser = this.dutyPicker.container;
      this.empowerChooserGuard.open([...this.overlayGuardTargets(), this.undoBtn]);
      return true;
    }
    const actions = this.activateActionsFor(iid);
    if (actions.length === 0) return false;
    this.beginDutyActions(card, actions);
    return true;
  }

  private beginDutyActions(card: CardDef, actions: DutyAction[]): void {
    const ability = activatedAbilitiesOf(card)[actions[0].abilityIndex ?? 0];
    this.clearManaPlanPreview();
    if (!ability.targets?.length) this.showDutyConfirm(card, actions[0]);
    else this.beginTargetSelection(actions);
  }

  private pendingTargetStep() {
    const actions = (this.pendingCasts ?? []).filter((action): action is TargetSelectionAction => action.type !== 'linkHaunt');
    return targetSelectionStep(actions, this.targetPicks, this.targetPicksUnordered);
  }

  private targetsNeedPicker(): boolean {
    const visible = new Set([...this.views].filter(([, view]) => view.active).map(([iid]) => iid));
    return dutyTargetsNeedPicker(this.targetRefsForInput(), visible);
  }

  private beginTargetSelection(actions: TargetSelectionAction[]): void {
    const action = actions[0];
    const cardId = action.type === 'activate'
      ? this.duel.state.battlefield.find(perm => perm.iid === action.iid)?.cardId : this.actionCardId(action);
    if (!cardId) return;
    const card = def(CARD_DB, cardId);
    const specs = action.type === 'activate' ? activatedAbilitiesOf(card)[action.abilityIndex ?? 0].targets ?? []
      : action.type === 'castSpell' && action.modes && card.modal ? modalTargetSpecs(card.modal, action.modes)
      : castTargetSpecsFor(card, action.type === 'castSpell' && action.retell === true,
        action.type === 'castSpell' && action.hauntlinked === true, action.type === 'castSpell' && action.empowered === true);
    this.targetPicks = [];
    this.targetFocus = 0;
    this.targetPicksUnordered = specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined);
    this.targetsExact = specs.length === 1 && specs[0].exactly !== undefined;
    this.pendingCasts = actions;
    this.sync();
    if (this.targetsNeedPicker()) this.showGravePicker(actions);
  }

  private confirmPendingTargets(): void {
    const actions = (this.pendingCasts ?? []).filter((action): action is TargetSelectionAction => action.type !== 'linkHaunt');
    const action = confirmedTargetSelection(this.duel.instanceState, CARD_DB, HUMAN, actions, this.targetPicks, this.targetPicksUnordered);
    if (!action) return;
    this.closeGravePicker(false);
    this.act(action);
  }

  private undoTargetSelection(): void {
    if (!this.pendingCasts || this.pendingSacrifice) return;
    this.targetPicks = removeLastTargetSelection(this.targetPicks);
    this.closeGravePicker(false);
    this.sync();
    if (this.targetsNeedPicker()) this.showGravePicker(this.pendingCasts.filter((a): a is TargetSelectionAction => a.type !== 'linkHaunt'));
  }

  private confirmTriggerTarget(ref: TargetRef): void {
    const action = confirmDeferredTarget(this.duel.instanceState, CARD_DB, HUMAN, ref);
    if (!action) return;
    this.closeGravePicker(false);
    this.act(action);
  }

  private cancelPendingTargeting(): void {
    const sacrifice = this.pendingSacrifice;
    this.pendingSacrifice = null;
    this.pendingCasts = null;
    this.targetPicks = [];
    this.keyboardTarget = null;
    this.closeGravePicker(false);
    this.sync();
    if (sacrifice) this.returnFromSacrificePicker(sacrifice.casts[0]);
  }

  /** Cancelling the fodder picker goes back to wherever the cast was chosen. */
  private returnFromSacrificePicker(cast: HandCastAction): void {
    // A graveyard cast (Whispers; Retell likewise) carries its GRAVEYARD index
    // in handIndex, so the hand path would act on an unrelated hand card.
    if (cast.whispers || cast.retell) {
      this.showZoneModal(HUMAN, 'graveyard');
      return;
    }
    const hand = this.duel.state.players[HUMAN].hand;
    const cardId = hand[cast.handIndex];
    if (cardId === undefined) return;
    const legal = this.duel.legalActions(HUMAN);
    const casts = handCastChoices(legal, hand, cast.handIndex);
    // Back to the chooser that led here. A Rite card with nothing to choose
    // opened the picker directly, so its cancel simply casts nothing.
    if (casts.length > 0) {
      this.showSacrificeCastChooser(def(CARD_DB, cardId), casts, this.handSkims(legal, cardId, cast.handIndex));
    }
  }

  private handSkims(legal: readonly Action[], cardId: string, handIndex: number): Extract<Action, { type: 'skim' }>[] {
    const hand = this.duel.state.players[HUMAN].hand;
    return legal
      .filter((l): l is Extract<Action, { type: 'skim' }> => l.type === 'skim' && hand[l.handIndex] === cardId)
      .map((skim) => ({ ...skim, handIndex }));
  }

  /**
   * Why a click on your own Duty permanent did nothing: in your Morning or
   * Afternoon, and in every response window (respond, end step, Hauntlink),
   * where a Duty is never usable. The attacker and blocker steps give the
   * click another meaning, so they stay silent.
   */
  private dutyBlockedReason(iid: number): string | null {
    const state = this.duel.state;
    const awaiting = state.awaiting;
    if (!('player' in awaiting) || awaiting.player !== HUMAN) return null;
    if (awaiting.kind !== 'main' && awaiting.kind !== 'respond' && awaiting.kind !== 'endStepWindow' &&
      awaiting.kind !== 'hauntlinkWindow') return null;
    const source = state.battlefield.find((perm) => perm.iid === iid);
    if (!source || source.controller !== HUMAN || !def(CARD_DB, source.cardId).activated) return null;
    const ownMainPhase = state.activePlayer === HUMAN && (state.step === 'main1' || state.step === 'main2');
    return dutyBlockedCopy(dutyWindowReason(activatedBlockers(state, CARD_DB, HUMAN, source), ownMainPhase));
  }

  private previewDuty(iid: number): void {
    if (this.pendingCasts || this.ended || this.replayMode || this.empowerChooser || this.gravePicker) return;
    this.clearManaPlanPreview();
    const actions = this.activateActionsFor(iid);
    if (actions.length === 0) return;
    const source = this.duel.state.battlefield.find((perm) => perm.iid === iid)!;
    const cost = activatedAbilitiesOf(def(CARD_DB, source.cardId))[actions[0].abilityIndex ?? 0].cost.mana ?? { generic: 0, pips: {} };
    this.previewManaPlanForCost(cost, 0, iid);
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

  private isReserveDuel(): boolean {
    return this.reserveFormatsEnabled && this.duel.state.players[HUMAN].landReserve !== undefined;
  }

  private reserveLandAction(index: number): Extract<Action, { type: 'playLand' }> | undefined {
    return this.duel.legalActions(HUMAN).find(
      (action): action is Extract<Action, { type: 'playLand' }> =>
        action.type === 'playLand' && action.handIndex === -1 && action.reserveIndex === index,
    );
  }

  /** Compact public reserve piles. The existing modal remains the land chooser. */
  private syncReservePiles(): void {
    const publicView = this.duel.viewFor(HUMAN);
    const reserves: [readonly string[], readonly string[]] = [
      publicView.you.landReserve ?? [],
      publicView.opp.landReserve ?? [],
    ];
    this.reservePositions = new Map();
    for (const player of [HUMAN, AI] as const) {
      const reserve = reserves[player];
      const layout = player === HUMAN ? LAYOUT.reservePiles.human : LAYOUT.reservePiles.opponent;
      const pile = player === HUMAN ? this.myReservePile : this.oppReservePile;
      pile.setVisible(true).setCount(reserve.length);
      // The one always-on reminder that the drop is still there. It reads "1"
      // because you may play exactly one land, however many the chest holds.
      if (player === HUMAN) pile.setAlert(this.landDropAvailable() ? 1 : 0);
      reserve.forEach((_, index) => {
        this.reservePositions.set(`${player}:${index}`, {
          x: layout.x,
          y: layout.y,
          scale: layout.cardScale,
          angle: 0,
        });
      });
    }
  }

  /** Public command-zone cards live in their owners' portrait-facing gaps. */
  private syncDarlingZones(): void {
    const publicView = this.duel.viewFor(HUMAN);
    const castActions = this.darlingCastActions();
    const payDownAction = !this.pendingCasts ? this.duel.legalActions(HUMAN).find(
      (action): action is Extract<Action, { type: 'payDownDarlingTax' }> => action.type === 'payDownDarlingTax',
    ) : undefined;
    const zones: [string | null | undefined, string | null | undefined] = [
      publicView.you.darlingZone,
      publicView.opp.darlingZone,
    ];
    const taxes = [publicView.you.darlingTax ?? 0, publicView.opp.darlingTax ?? 0] as const;
    const signature = [
      zones[HUMAN] ?? '', taxes[HUMAN], publicView.you.darlingCastable === true, castActions.length,
      payDownAction ? 'pay' : '', this.pendingCasts ? 'targeting' : '', zones[AI] ?? '', taxes[AI],
    ].join('\u0001');
    if (this.previousDarlingZoneSignature === signature) return;
    this.previousDarlingZoneSignature = signature;
    for (const view of this.darlingZoneViews) {
      view.disableInput();
      if (view.active) view.destroy();
    }
    for (const object of this.darlingZoneDecor) if (object.active) object.destroy();
    this.darlingZoneViews = [];
    this.darlingZoneDecor = [];
    this.darlingZoneControls = [];
    this.darlingZonePositions = new Map();

    for (const player of [HUMAN, AI] as const) {
      const cardId = zones[player];
      if (!cardId || !CARD_DB[cardId]) continue;
      const layout = player === HUMAN ? LAYOUT.darlingZone.human : LAYOUT.darlingZone.opponent;
      const d = def(CARD_DB, cardId);
      const tax = taxes[player];
      const variant = player === HUMAN ? displayVariantFor(Services.save.data, cardId) : undefined;
      const castable = player === HUMAN && castActions.length > 0 && !this.pendingCasts;
      const view = new CardView(this, layout.x, layout.y)
        .setScale(0.2)
        .setDepth(8)
        .setAlpha(player === AI ? 0.82 : castable ? 1 : 0.72);
      view.setCard(d, { fx: 'none', variant, fullArt: variant?.fullArt === true });
      this.darlingZoneViews.push(view);
      this.darlingZonePositions.set(player, { x: layout.x, y: layout.y, scale: 0.2, angle: 0 });
      const label = this.add.text(layout.labelX, layout.labelY, player === HUMAN ? 'Darling' : "Foe's Darling", {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: player === HUMAN ? theme.colors.gold : theme.colors.muted,
      }).setOrigin(0.5).setDepth(9);
      this.darlingZoneDecor.push(label);
      if (player === HUMAN && currentAccessibility().textScale > 1) {
        this.undoBtn.setY(Math.min(LAYOUT.undo.y, label.getBounds().top - 6 - this.undoBtn.height / 2));
      }
      if (tax > 0) {
        const chip = this.add.text(layout.taxX, layout.taxY, `+${tax}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          backgroundColor: theme.colors.panelFill,
          padding: { x: 5, y: 2 },
        }).setOrigin(layout.taxOriginX, 0.5).setDepth(10);
        if (theme.type.micro > theme.typeBase.micro) {
          const nameBounds = label.getBounds();
          chip.setX(player === HUMAN
            ? Math.max(layout.taxX, nameBounds.right + 6 + chip.width / 2)
            : Math.min(layout.taxX, nameBounds.left - 6));
        }
        this.darlingZoneDecor.push(chip);
      }
      if (player !== HUMAN) continue;

      const totalCost = d.cost ? { ...d.cost, generic: d.cost.generic + tax } : null;
      if (castable && totalCost) {
        const castCopy = this.add.container(layout.castX, layout.castY).setDepth(10);
        const rendered = renderManaText(this, castCopy, 0, 0, `Cast ${manaCostText(totalCost)}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
          resolution: 2,
        });
        rendered.text.setOrigin(0.5);
        rendered.reflow();
        const background = this.add.graphics();
        const width = rendered.text.width + 8;
        const height = rendered.text.height + 2;
        background
          .fillStyle(colorInt(theme.colors.panelFill), 0.94)
          .fillRoundedRect(-width / 2, -height / 2, width, height, theme.radius.control)
          .lineStyle(1, colorInt(theme.colors.panelStroke), theme.alpha.chrome)
          .strokeRoundedRect(-width / 2, -height / 2, width, height, theme.radius.control);
        castCopy.addAt(background, 0);
        this.darlingZoneDecor.push(castCopy);
      }
      view.enableInput();
      this.zoom.attach(view, d, variant);
      view.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && castable) this.previewDarlingManaPlan(castActions);
      });
      view.on('pointerout', () => this.clearManaPlanPreview());
      view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch || pointer.rightButtonReleased() || this.pendingCasts) return;
        if (castable) this.startDarlingCast(castActions);
        else this.showInspect(d, variant);
      });
      view.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 2 && !this.pendingCasts) this.showInspect(d, variant);
      });
      attachTouchGestures(this, view, {
        card: d,
        variant,
        onTap: () => {
          if (this.pendingCasts) return;
          if (castable) this.startDarlingCast(castActions);
          else this.showInspect(d, variant);
        },
      });
      if (payDownAction) {
        const payDown = themedButton(this, layout.payDownX, layout.payDownY, 'Ease tax 4', {
          variant: 'emphasis',
          size: 'sm',
          minWidth: 106,
          onTap: () => this.act(payDownAction),
        });
        payDown.container.setDepth(10);
        this.darlingZoneDecor.push(payDown.container);
        this.darlingZoneControls.push(payDown.inputZone);
      }
    }
  }

  private darlingCastActions(): DarlingCastAction[] {
    if (!this.isHumanTurnDecision()) return [];
    return this.duel.legalActions(HUMAN).filter(
      (action): action is DarlingCastAction => action.type === 'castDarling',
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
    const countTexts = slots.map((slot) => this.add
      .text(0, cy, `${slot.untapped}/${slot.total}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${duelHudType(13, 'label')}px`,
        fontStyle: '600',
        color: slot.untapped > 0 ? theme.colors.body : theme.colors.muted,
        resolution: 2,
      })
      .setOrigin(0, 0.5)
      .setDepth(4)
      .setData('baseAlpha', 1));
    // The tuned pitch holds at 100%; larger text widens it so a count never
    // prints over the next pip (2026-10-08 UI review).
    const pitch = manaStripPitch(step, pipSize, Math.max(...countTexts.map((t) => t.width)));
    slots.forEach((slot, i) => {
      const x = align === 'right'
        ? xAnchor - (slots.length - 1 - i) * pitch
        : xAnchor + i * pitch;
      const baseAlpha = slot.untapped > 0 ? 1 : 0.45;
      const pip = this.add
        .image(x, cy, slot.texture)
        .setDisplaySize(pipSize, pipSize)
        .setDepth(4)
        .setAlpha(baseAlpha)
        .setData('baseAlpha', baseAlpha);
      const countText = countTexts[i]!.setX(x + pipSize * 0.64);
      minX = Math.min(minX, x - pipSize / 2);
      maxX = Math.max(maxX, x + pipSize / 2, countText.x + countText.width);
      this.manaPips.push(pip);
      this.manaPips.push(countText);
    });
    if (player === HUMAN) {
      this.myManaRowEndX = xAnchor + slots.length * pitch;
      this.myManaPitch = pitch;
    }
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

  /**
   * One-line `{W} 2/3`-style untapped/total summary of your mana sources,
   * grouped exactly like the board strip (mono per color, flexible sources
   * as their own multi-pip bead). Rendered by ZoneContentsModal's subtitle.
   */
  private untappedManaSubtitle(): string {
    const counts = new Map<string, number>();
    for (const src of manaSources(this.duel.state, CARD_DB, HUMAN)) {
      const sig = this.manaSourceSignature(src.colors);
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
    const totals = new Map<string, number>();
    for (const perm of this.duel.state.battlefield) {
      if (perm.controller !== HUMAN) continue;
      const colors = def(CARD_DB, perm.cardId).manaAbility ?? [];
      if (colors.length === 0) continue;
      const sig = this.manaSourceSignature(colors);
      totals.set(sig, (totals.get(sig) ?? 0) + 1);
    }
    if (totals.size === 0) return 'Untapped mana · none';
    const parts = [...totals.keys()]
      .sort((a, b) => this.compareManaSourceSignatures(a, b))
      .map((sig) => {
        const pips = [...sig].map((c) => `{${c}}`).join('');
        return `${pips} ${counts.get(sig) ?? 0}/${totals.get(sig)}`;
      });
    return `Untapped mana · ${parts.join('   ')}`;
  }

  private manaSourceSignature(colors: readonly ManaColor[]): string {
    return [...colors]
      .sort((a, b) => COLOR_SORT.indexOf(a) - COLOR_SORT.indexOf(b))
      .join('');
  }

  private compareManaSourceSignatures(a: string, b: string): number {
    return (
      a.length - b.length ||
      COLOR_SORT.indexOf(a[0] as ManaColor) - COLOR_SORT.indexOf(b[0] as ManaColor) ||
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
    if (this.pendingSacrifice) return;
    const hand = this.duel.state.players[HUMAN].hand;
    const cardId = hand[handIndex];
    if (!cardId) return;
    const card = def(CARD_DB, cardId);
    if (isType(card, 'land') || !card.cost) return;
    const casts = handCastChoices(this.duel.legalActions(HUMAN), hand, handIndex);
    if (casts.length === 0) return;
    // A full-price cast previews normally; a Tithe-only cast previews its
    // enumerated cost until the player chooses the actual fodder.
    const cast = casts.find((action) => !action.tithe && !action.empowered) ?? casts[0];
    const cost = castActionCost(this.duel.instanceState, CARD_DB, HUMAN, cast);
    if (!cost) return;
    const extraGeneric = casts.reduce((best, cast) => Math.max(best, cast.x ?? 0), 0);
    this.previewManaPlanForCost(cost, extraGeneric);
  }

  /** Darling hover uses this same auto-tap marker path with tax folded into generic cost. */
  private previewDarlingManaPlan(casts: readonly DarlingCastAction[]): void {
    const cardId = this.duel.viewFor(HUMAN).you.darlingZone;
    if (!cardId) return;
    const card = def(CARD_DB, cardId);
    if (!card.cost) return;
    const tax = this.duel.viewFor(HUMAN).you.darlingTax ?? 0;
    const extraGeneric = casts.reduce((best, cast) => Math.max(best, cast.x ?? 0), 0);
    this.previewManaPlanForCost({ ...card.cost, generic: card.cost.generic + tax }, extraGeneric);
  }

  private previewManaPlanForCost(cost: NonNullable<CardDef['cost']>, extraGeneric = 0, dutySourceIid?: number): void {
    this.clearManaPlanPreview();
    if (this.touch || this.ended || this.pendingCasts || this.carry) return;
    const plan = solveMana(this.duel.state, CARD_DB, HUMAN, cost, extraGeneric);
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

    for (const iid of dutySourceIid === undefined ? plan : [...plan, dutySourceIid]) {
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
            x: LAYOUT.myManaStrip.x0 + slot * this.myManaPitch,
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

  /**
   * The Sworn chip on a hand card: a filled check or an open ring, and the
   * words. A child of the card, so it tilts and lifts with it; its sizes are
   * divided by the card's scale so the words draw at the caption size.
   */
  private addSwornChip(view: CardView, chip: SwornChip, scale: number): void {
    const k = 1 / scale;
    const text = this.add.text(0, 0, chip.label, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption * k}px`, fontStyle: theme.weight.w700,
      color: chip.active ? theme.colors.gold : theme.colors.body, resolution: 2,
    }).setOrigin(0, 0.5).setData('a11yFitToBox', true);
    const r = 5 * k;
    const padX = 6 * k;
    const h = 20 * k;
    const w = padX + r * 2 + 5 * k + text.width + padX;
    // Inside the art window's top-left corner: the left edge is the part of a
    // fanned card its right-hand neighbour never covers.
    const x = CARD_FACE.art.x + 6;
    const y = CARD_FACE.art.y + 6;
    const plate = this.add.graphics()
      .fillStyle(theme.graphics.panelFill, 0.92).fillRoundedRect(x, y, w, h, h / 2)
      .lineStyle(1.5 * k, colorInt(chip.active ? theme.colors.gold : theme.colors.muted), 1)
      .strokeRoundedRect(x, y, w, h, h / 2);
    const cx = x + padX + r;
    const cy = y + h / 2;
    const mark = this.add.graphics().lineStyle(1.5 * k, colorInt(chip.active ? theme.colors.gold : theme.colors.muted), 1);
    if (chip.active) {
      mark.fillStyle(colorInt(theme.colors.gold), 1).fillCircle(cx, cy, r);
      mark.lineStyle(1.6 * k, theme.graphics.panelFill, 1).beginPath()
        .moveTo(cx - r * 0.5, cy).lineTo(cx - r * 0.1, cy + r * 0.45).lineTo(cx + r * 0.55, cy - r * 0.4).strokePath();
    } else {
      mark.strokeCircle(cx, cy, r);
    }
    text.setPosition(cx + r + 5 * k, cy);
    view.add([plate, mark, text]);
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
            targets: view,
            y: view.y - 18,
            alpha: 0,
            duration: CARD_TRAVEL_MOTION.handExit.duration,
            ease: CARD_TRAVEL_MOTION.handExit.ease,
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
      if (l.type === 'playLand' || l.type === 'castSpell' || l.type === 'skim') {
        if (l.type === 'castSpell' && (l.retell === true || l.whispers === true)) continue;
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
    const swornNow = isSwornActive(this.duel.state.battlefield, CARD_DB, HUMAN);
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
      const landStyle = this.humanLandStyleFor(cardId);
      const ownedVariant = displayVariantFor(Services.save.data, cardId);
      const view = new CardView(this, x, y);
      view.setScale(scale);
      view.setAngle(slot.angleDeg);
      view.setCard(d, {
        fx: 'none',
        variant: ownedVariant,
        fullArt: ownedVariant?.fullArt === true,
        landStyle,
      });
      view.setDepth(theme.depth.hand + pos);
      const sworn = swornChip(d, swornNow);
      if (sworn) this.addSwornChip(view, sworn, scale);
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
        // killTweensOf can murder the draw fly-in's ALPHA tween mid-flight,
        // freezing the copy at an arbitrary fade (user report 2026-08-01:
        // identical copies at different opacities). Re-assert the truth.
        view.setAlpha(playable ? 1 : 0.75);
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
        // Same alpha re-assert as pointerover: the kill may have orphaned
        // the draw fly-in's fade.
        view.setAlpha(playable ? 1 : 0.75);
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
        if (p.button === 2 && !this.pendingCasts) this.showInspect(d, ownedVariant, landStyle);
      });
      // Touch: tap = exactly onHandClick; long-press = sticky preview whose
      // release never casts; drags across the fan die in the classifier.
      attachTouchGestures(this, view, {
        card: d,
        variant: ownedVariant,
        landStyle,
        pressLift: 12,
        onTap: () => this.onHandClick(handIdx),
      });
      this.zoom.attach(view, d, ownedVariant, landStyle);
      this.handViews.push(view);
      this.renderedHand.push({ cardId, view });
      this.handPoses.set(handIdx, { x, y, scale, angle: slot.angleDeg });
      if (entered && this.motionLevel() === 'full') {
        view.setAlpha(CARD_TRAVEL_MOTION.drawToHand.destinationPreviewAlpha);
        if (dot) dot.setAlpha(CARD_TRAVEL_MOTION.drawToHand.destinationPreviewAlpha);
        // The destination card stays interactive while a non-interactive
        // ghost carries the longer deck-to-hand motion across the field.
        const flight = new CardView(this, LAYOUT.piles.x, LAYOUT.piles.deckY)
          .setScale(scale)
          .setAngle(slot.angleDeg)
          .setDepth(theme.depth.floats)
          .setAlpha(0.96);
        flight.setCard(d, {
          fx: 'none',
          variant: ownedVariant,
          fullArt: ownedVariant?.fullArt === true,
          landStyle,
        });
        this.playRevealGhosts.add(flight);
        const cleanUpFlight = (): void => {
          this.playRevealGhosts.delete(flight);
          if (flight.active) flight.destroy();
        };
        this.tweens.add({
          // End at the playability alpha — a hardcoded 1 here lit unaffordable
          // draws as castable until the next sync (user-reported 2026-07-10).
          targets: view,
          alpha: playable ? 1 : 0.75,
          duration: CARD_TRAVEL_MOTION.drawToHand.duration,
          ease: CARD_TRAVEL_MOTION.drawToHand.ease,
        });
        this.tweens.add({
          targets: flight,
          x,
          y,
          scaleX: scale,
          scaleY: scale,
          angle: slot.angleDeg,
          duration: CARD_TRAVEL_MOTION.drawToHand.duration,
          ease: CARD_TRAVEL_MOTION.drawToHand.ease,
          onComplete: () => {
            if (!flight.active) return;
            this.tweens.add({
              targets: flight,
              alpha: 0,
              duration: CARD_TRAVEL_MOTION.arrivalFade.duration,
              ease: CARD_TRAVEL_MOTION.arrivalFade.ease,
              onComplete: cleanUpFlight,
              onStop: cleanUpFlight,
            });
          },
          onStop: cleanUpFlight,
        });
        if (dot) {
          this.tweens.add({
            targets: dot,
            alpha: 1,
            duration: CARD_TRAVEL_MOTION.drawToHand.duration,
            ease: CARD_TRAVEL_MOTION.drawToHand.ease,
          });
        }
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
      (a.kind === 'respond' || a.kind === 'endStepWindow' || a.kind === 'hauntlinkWindow');
    this.stackDisplay.setItems(items, stackDecisionLive);

    if (this.ended || !('player' in a) || a.player !== HUMAN) return;
    if (this.pendingCasts) {
      showButton('Cancel');
      this.setSmartAffordance('pass', true);
      return;
    }
    // Arrival targets are mandatory. The board rings and source prompt are
    // the affordance; deliberately leave the smart button hidden so no
    // cancel/pass action can bypass the queued choice.
    if (a.kind === 'chooseTarget') return;
    let danger = false;
    let armed = false;
    switch (a.kind) {
      case 'main': {
        // Passing out of main2 ends the turn, so that is where the land-drop
        // guard speaks; from Morning there is still a whole Afternoon to
        // play the land in.
        const guard = this.landDropGuardInput(this.duel.state.step === 'main2');
        armed = landDropGuardApplies(guard) && this.landDropArmed;
        danger = armed;
        showButton(
          armed
            ? LAND_DROP_CONFIRM_LABEL
            : this.duel.state.step === 'main1' ? 'To Combat' : 'Pass ▶',
        );
        // The ⏭ End Turn quick button rides above the smart button on your own
        // Morning or Afternoon (hidden everywhere else — set false at the top). It is
        // suppressed in the tutorial so a fast-forward can't skip a taught beat.
        if (!this.tutorial) {
          this.endTurnBtn.setVisible(true);
          inflateHitArea(this.endTurnBtn, 90, 90);
        }
        break;
      }
      case 'declareAttackers':
        showButton(attackButtonLabel(attackDeclaration(this.selectedAttackers, this.rageAttackers())));
        break;
      case 'declareBlockers': {
        if (this.blockAssignments.length > 0) {
          this.clearNoBlockArm();
          showButton(`Confirm Blocks (${this.blockAssignments.length})`);
          break;
        }
        const emptyBlock = this.emptyBlockSummary();
        if (!emptyBlock) {
          this.clearNoBlockArm();
          showButton('Confirm Blocks (0)');
          break;
        }
        const requiresConfirmation = this.shouldArmNoBlock(emptyBlock.lethal);
        if (!requiresConfirmation) this.clearNoBlockArm();
        armed = requiresConfirmation && this.noBlockArmed;
        danger = true;
        showButton(
          armed
            ? emptyBlock.lethal ? 'Confirm: lethal' : 'Confirm: no blocks'
            : `No Blocks · Take ${emptyBlock.damage}`,
        );
        break;
      }
      case 'respond':
      case 'endStepWindow':
        showButton('Pass');
        break;
      case 'hauntlinkWindow':
        showButton('Pass (Hauntlink)');
        break;
      default:
        break;
    }
    this.setSmartAffordance(
      a.kind === 'declareAttackers' || a.kind === 'declareBlockers' ? 'confirm' : 'pass',
      true,
      danger,
      armed,
    );
  }

  private setSmartAffordance(
    kind: 'confirm' | 'pass',
    actionable: boolean,
    danger = false,
    armed = false,
  ): void {
    this.tweens.killTweensOf(this.passArc);
    const locked = this.time.now - this.lastAutoSkipAt < AUTOSKIP_INPUT_LOCK_MS;
    const breathing = actionable && !locked && kind === 'confirm' && !danger && this.motionLevel() === 'full';
    const color = danger
      ? colorInt(theme.colors.dangerArmed)
      : breathing ? colorInt(theme.colors.gold) : colorInt(theme.colors.muted);
    this.passArc.setStrokeStyle(armed ? 4 : 2.5, color, danger ? 0.92 : breathing ? 0.92 : 0.55);
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

  /** Empty blocking is only special when the player could legally block. */
  private emptyBlockSummary(): { damage: number; lethal: boolean } | null {
    const a = this.duel.awaiting;
    const st = this.duel.state;
    if (a.kind !== 'declareBlockers' || !st.combat || this.blockAssignments.length > 0) return null;
    if (blockOptions(st, CARD_DB, HUMAN, st.combat).length === 0) return null;
    const preview = previewCombat(st, CARD_DB, []);
    return { damage: -preview.lifeDelta[HUMAN], lethal: preview.defenderLethal };
  }

  private shouldArmNoBlock(lethal: boolean): boolean {
    const setting = Services.save.data.settings.confirmNoBlock;
    return setting === 'always' || (setting === 'lethal' && lethal);
  }

  /** A land drop is legal for the human right now (from hand OR the Warchest). */
  private landDropAvailable(): boolean {
    if (this.ended || !this.isHumanTurnDecision()) return false;
    return this.duel.legalActions(HUMAN).some((action) => action.type === 'playLand');
  }

  private landDropGuardInput(turnEnds: boolean): LandDropGuardInput {
    return {
      landDropAvailable: this.landDropAvailable(),
      turnEnds,
      confirmEnabled: Services.save.data.settings.confirmLandDrop,
      armed: this.landDropArmed,
      suppressed: this.tutorial || this.replayMode,
    };
  }

  private clearLandDropArm(): void {
    this.landDropArmTimer?.remove();
    this.landDropArmTimer = null;
    this.landDropArmed = false;
  }

  private armLandDrop(): void {
    this.clearLandDropArm();
    this.landDropArmed = true;
    Sfx.play('warn');
    this.landDropArmTimer = this.time.delayedCall(2500, () => {
      this.landDropArmTimer = null;
      this.landDropArmed = false;
      if (this.passArc.active && !this.ended) this.syncButton();
    });
  }

  private clearNoBlockArm(): void {
    this.noBlockArmTimer?.remove();
    this.noBlockArmTimer = null;
    this.noBlockArmed = false;
  }

  private armNoBlock(): void {
    this.clearNoBlockArm();
    this.noBlockArmed = true;
    Sfx.play('warn');
    this.noBlockArmTimer = this.time.delayedCall(2500, () => {
      this.noBlockArmTimer = null;
      this.noBlockArmed = false;
      if (this.passArc.active && !this.ended) this.syncButton();
    });
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
    this.drawStackTargetArrows();
    // Cast-targeting arrow (desktop hover): from the live source card to the
    // pointer, snapping to the closest legal target so burn-face vs burn-creature
    // intent is unmistakable. Touch resolves targets by direct tap — no hover.
    const targetRefs = this.targetRefsForInput();
    if (targetRefs.length > 0 && !this.touch) {
      const p = this.input.activePointer;
      const tip = this.snapTargetTip(p.worldX, p.worldY);
      const origin = this.pendingCasts
        ? this.actionOrigin(this.pendingCasts[0])
        : this.targetChoiceOrigin();
      const source = origin ?? TARGET_ARROW_SRC;
      const { x: sx, y: sy } = source;
      this.drawCurvedArrow(sx, sy, tip.x, tip.y, TARGET_ARROW_COLOR, 0.95);
      // Arrowhead — two short strokes back from the tip along the shaft angle.
    }
  }

  /** Stack targets reuse the arrow shaft but key their colour to the target controller. */
  private drawStackTargetArrows(): void {
    for (const item of this.duel.state.stack) {
      const from = this.stackDisplay.itemCenter(item.sid);
      if (!from) continue;
      for (const target of item.targets) {
        if (target.kind !== 'permanent' && target.kind !== 'player') continue;
        const controller = target.kind === 'player'
          ? target.player
          : this.duel.state.battlefield.find((perm) => perm.iid === target.iid)?.controller;
        if (controller === undefined) continue;
        const to = this.hitTargetPos(target);
        this.drawCurvedArrow(from.x, from.y, to.x, to.y, colorInt(this.targetRingColor(controller)), 0.82);
      }
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
    const headAngle = Math.atan2(ty - control.y, tx - control.x);
    const head = TARGET_ARROW_HEAD_LENGTH;
    const shaftEnd = targetArrowShaftEnd(control, { x: tx, y: ty }, head);
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(sx, sy), control, new Phaser.Math.Vector2(shaftEnd.x, shaftEnd.y),
    );
    this.arrows.lineStyle(4, color, alpha);
    curve.draw(this.arrows, 20);
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
    if (this.versusBumperActive) return;
    if (this.pendingCasts) {
      this.cancelPendingTargeting();
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
      case 'main': {
        const guard = this.landDropGuardInput(this.duel.state.step === 'main2');
        if (shouldArmLandDrop(guard)) {
          this.armLandDrop();
          this.syncButton();
          break;
        }
        this.clearLandDropArm();
        this.act({ type: 'passStep' });
        break;
      }
      case 'declareAttackers':
        this.act({ type: 'declareAttackers', attackers: attackDeclaration(this.selectedAttackers, this.rageAttackers()) });
        break;
      case 'declareBlockers': {
        // A lone blocker on a Dreaded attacker is a partial assignment the
        // engine will reject; explain it by card name instead of submitting.
        const short = this.dreadedShortfall();
        if (short) {
          this.showSkipNotice(`${short} can only be blocked by two or more creatures.`);
          break;
        }
        const emptyBlock = this.emptyBlockSummary();
        if (emptyBlock && this.shouldArmNoBlock(emptyBlock.lethal) && !this.noBlockArmed) {
          this.armNoBlock();
          this.syncButton();
          break;
        }
        this.clearNoBlockArm();
        this.act({ type: 'declareBlockers', blocks: [...this.blockAssignments] });
        break;
      }
      case 'respond':
      case 'endStepWindow':
      case 'hauntlinkWindow':
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
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN']) kb?.on(`keydown-${key}`, this.onChoiceNavigate, this);
    kb?.on('keydown-BACKSPACE', this.onTargetBackspace, this);
    this.input.on('pointermove', this.onTargetPointerMove, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-SPACE', this.onConfirmKey, this);
      kb?.off('keydown-ENTER', this.onConfirmKey, this);
      kb?.off('keydown-ESC', this.onCancelKey, this);
      for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN']) kb?.off(`keydown-${key}`, this.onChoiceNavigate, this);
      kb?.off('keydown-BACKSPACE', this.onTargetBackspace, this);
      this.input.off('pointermove', this.onTargetPointerMove, this);
    });
  }

  /** Redraw the targeting arrow as the mouse moves (desktop only — no touch hover). */
  private onTargetPointerMove(): void {
    if (this.targetRefsForInput().length > 0 && !this.touch) this.drawArrows();
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
    for (const target of this.targetRefsForInput()) {
      const pos = this.hitTargetPos(target);
      const dist = Phaser.Math.Distance.Between(px, py, pos.x, pos.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = pos;
      }
    }
    return best ?? { x: px, y: py };
  }

  private onConfirmKey(e: KeyboardEvent): void {
    e.preventDefault(); // Space would otherwise scroll the page in the browser
    if (this.versusBumperActive) return;
    if (this.replayMode) return;
    if (this.ended || this.animatingCombat || this.inspect || this.zoneModal || this.pauseOverlay) return;
    if (this.empowerChooser) {
      if (this.dutyPicker) this.dutyPicker.confirm();
      else this.dutyConfirm?.();
      return;
    }
    const space = e.code === 'Space' || e.keyCode === 32;
    if (this.lootPicker?.container.active) {
      if (space) this.lootPicker.toggle?.();
      else this.lootPicker.confirm();
      return;
    }
    if (this.carry) return; // a lifted card decides by drop or cancel, never Space
    if (this.ended || this.inspect || this.zoneModal) return; // modals do not pass under
    const refs = this.targetRefsForInput();
    const focused = refs.find(ref => this.keyboardTarget && this.targetRefEquals(ref, this.keyboardTarget)) ??
      refs[this.targetFocus % Math.max(1, refs.length)];
    if (this.pendingSacrifice || edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks)) {
      if (space && focused) this.tryTarget(focused);
      else this.confirmSacrificeSelection();
      return;
    }
    if (this.isHumanChooseTarget()) {
      if (focused) this.confirmTriggerTarget(focused);
      return;
    }
    if (this.pendingCasts?.[0]?.type !== 'linkHaunt' && this.pendingCasts) {
      if (space && focused) this.tryTarget(focused);
      else this.confirmPendingTargets();
      return;
    }
    if (this.gravePicker) return;
    if (this.overlay && this.confirmForeseeOverlay()) return;
    if (this.overlay) return;
    this.onButton(); // self-guards: auto-skip input lock + not-your-decision
  }

  private onChoiceNavigate(e: KeyboardEvent): void {
    if (this.ended || this.replayMode || this.animatingCombat || this.inspect || this.zoneModal || this.pauseOverlay) return;
    if (this.pumpTickerStep && this.empowerChooser) {
      // The ticker counts: right and up add one, left and down take one away.
      e.preventDefault();
      this.pumpTickerStep(e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.keyCode === 37 || e.keyCode === 40 ? -1 : 1);
      return;
    }
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.keyCode === 37 || e.keyCode === 38 ? -1 : 1;
    const picker = this.dutyPicker ?? this.lootPicker;
    if (picker?.container.active) {
      e.preventDefault();
      picker.move(delta);
      return;
    }
    if (this.empowerChooser || this.overlay) return;
    const refs = this.targetRefsForInput();
    if (!refs.length) return;
    e.preventDefault();
    const current = refs.findIndex(ref => this.keyboardTarget && this.targetRefEquals(ref, this.keyboardTarget));
    this.targetFocus = ((current >= 0 ? current : this.targetFocus) + delta + refs.length) % refs.length;
    this.keyboardTarget = refs[this.targetFocus];
    const ref = this.keyboardTarget;
    const cardId = ref.kind === 'permanent' ? this.duel.state.battlefield.find(p => p.iid === ref.iid)?.cardId
      : ref.kind === 'grave' ? this.graveTargetCardId(ref)
        : ref.kind === 'stackItem' ? this.duel.state.stack.find(item => item.sid === ref.sid)?.cardId : undefined;
    this.showTransientNotice(cardId ? `Target: ${def(CARD_DB, cardId).name}` : ref.kind === 'player' ? DUTY_PLAYER_LABELS[ref.player] : 'Choose a target');
    for (const perm of this.duel.state.battlefield) {
      const view = this.views.get(perm.iid);
      if (view) this.syncTileCue(view, perm, view.scaleX);
    }
  }

  private onTargetBackspace(e: KeyboardEvent): void {
    if (this.overlay || this.empowerChooser || this.inspect || this.zoneModal || this.pauseOverlay || this.isHumanChooseTarget()) return;
    if (this.pendingCasts && !this.pendingSacrifice) {
      e.preventDefault();
      this.undoTargetSelection();
    }
  }

  private onCancelKey(e: KeyboardEvent): void {
    e.preventDefault();
    if (this.versusBumperActive) return;
    if (this.replayOutcomeShell) {
      this.replayOutcomeShell.close();
      return;
    }
    if (this.empowerChooser) {
      this.closeEmpowerChooser();
      return;
    }
    if (this.inspect) {
      this.closeInspect();
      return;
    }
    if (this.carry) {
      this.cancelCarry();
      return;
    }
    if (this.landFan) {
      this.closeLandFan();
      return;
    }
    // A queued arrival target is mandatory and has no cancel path. Esc must
    // not turn into a hidden way to leave that choice via the pause menu.
    if (this.isHumanChooseTarget()) return;
    if (this.pendingCasts) {
      this.cancelPendingTargeting(); // mirrors the right-click cancel path
      return;
    }
    if (this.replayMode) {
      this.exitReplayViewer();
      return;
    }
    // Nothing to cancel: Esc opens the in-game menu (playtest 2026-07-16).
    // Safe to call unconditionally — showPauseMenu's guards no-op while any
    // overlay/modal is up (the modal's own dismissal preset closes it; that handler
    // registered after this one, so this fires first and the guard holds) or
    // outside a human decision window, matching the ⚙ button.
    this.showPauseMenu();
  }

  private onHandClick(handIndex: number): void {
    if (this.isHumanChooseTarget() || this.pendingSacrifice) return;
    this.clearManaPlanPreview();
    // Dimmed-card feedback names the reason; enumerated Tithe casts also admit
    // a discounted play when the legacy explanation sees only the full price.
    const hand = this.duel.state.players[HUMAN].hand;
    const legal = this.duel.legalActions(HUMAN);
    const casts = handCastChoices(legal, hand, handIndex);
    const reason = reasonUncastable(this.duel.state, CARD_DB, HUMAN, handIndex);
    // The core's legacy hand explanation does not account for Tithe's
    // discount. Its enumerated legal cast is the authority for that option.
    if (reason && !casts.some((cast) => cast.tithe)) {
      this.showSkipNotice(reason);
      return;
    }

    const cardId = this.duel.state.players[HUMAN].hand[handIndex];
    const d = def(CARD_DB, cardId);
    if (isType(d, 'land')) {
      this.act({ type: 'playLand', handIndex });
      return;
    }

    const skims = this.handSkims(legal, cardId, handIndex);
    if (casts.length === 0 && skims.length === 0) {
      // reasonUncastable only checks the first target spec; a rare multi-target
      // spell with a partially-satisfiable target set can still land here.
      this.showSkipNotice("You can't cast this right now.");
      return;
    }

    if (casts.length === 0) {
      this.act(skims[0]);
      return;
    }

    if (d.tithe || d.rite) {
      // A Rite card with nothing to choose skips the one-button chooser.
      if (!this.showSacrificeCastChooser(d, casts, skims)) this.continueCast(casts);
      return;
    }

    if (skims.length > 0) {
      this.showCastSkimChooser(d, casts, skims);
      return;
    }

    const normalCasts = casts.filter((cast) => cast.hauntlinked !== true);
    const hauntlinkedCasts = casts.filter((cast) => cast.hauntlinked === true);
    if (normalCasts.length > 0 && hauntlinkedCasts.length > 0) {
      this.showHauntlinkChooser(d, normalCasts, hauntlinkedCasts);
      return;
    }

    // Empower choice comes first: the enumerator only emits the empowered
    // variant when the extra cost is actually payable, so the chooser appears
    // exactly when the option is real (user decision 2026-07-17).
    this.startCast(normalCasts.length > 0 ? normalCasts : hauntlinkedCasts);
  }

  private startCast(casts: Extract<Action, { type: 'castSpell' }>[]): void {
    const modalId = this.actionCardId(casts[0]);
    if (modalId && def(CARD_DB, modalId).modal && casts.some((c) => c.modes !== undefined)) {
      this.showModeChooser(def(CARD_DB, modalId), casts);
      return;
    }
    if (casts.some((c) => c.empowered) && casts.some((c) => !c.empowered)) {
      const cardId = this.actionCardId(casts[0]);
      if (cardId) this.showEmpowerChooser(def(CARD_DB, cardId), casts);
      return;
    }
    this.continueCast(casts);
  }

  /** Darling casts share the hand-cast target selection and auto-mana submission path. */
  private startDarlingCast(casts: DarlingCastAction[]): void {
    if (casts.length === 0) return;
    const targeted = casts.some(cast => (cast.targets?.length ?? 0) > 0);
    if (!targeted) {
      const best = casts.reduce((left, right) => ((left.x ?? 0) >= (right.x ?? 0) ? left : right));
      this.act(best);
      return;
    }
    this.beginTargetSelection(casts);
  }

  /** The cast flow after any Empower choice: act, grave-pick, or target. */
  private continueCast(casts: Extract<Action, { type: 'castSpell' }>[], sacrificesChosen = false): void {
    const cardId = this.actionCardId(casts[0]);
    if (!sacrificesChosen && cardId && (casts[0].tithe || def(CARD_DB, cardId).rite)) {
      this.pendingSacrifice = { casts, selected: [] };
      this.pendingCasts = casts;
      this.sync();
      return;
    }
    const targeted = casts.some(cast => (cast.targets?.length ?? 0) > 0);
    if (!targeted) {
      // untargeted; for X spells default to the biggest X
      const best = casts.reduce((x, y) => ((x.x ?? 0) >= (y.x ?? 0) ? x : y));
      if (!sacrificesChosen && this.carryEligibleFor(best)) this.beginCarry(best);
      else this.act(best);
      return;
    }
    this.beginTargetSelection(casts);
  }

  /**
   * Carry-cast phase 1 (CastIntent): the resolving click lifts the card
   * instead of casting it; a second click on the field submits the SAME
   * action instant cast would have, so replays stay byte-identical. Hand
   * casts only — Retell keeps its zone-modal flow, the tutorial keeps its
   * scripted single-click beats, and the Settings escape hatch restores
   * click-to-cast wholesale.
   */
  private carryEligibleFor(action: Extract<Action, { type: 'castSpell' }>): boolean {
    return (
      !this.tutorial &&
      !this.replayMode &&
      action.retell !== true &&
      action.whispers !== true &&
      this.handViewFor(action.handIndex) !== undefined &&
      this.handPoses.get(action.handIndex) !== undefined &&
      carryCastEligible({
        targeted: false,
        touch: this.touch,
        instantCast: Services.save.data.settings.instantCast,
      })
    );
  }

  private beginCarry(action: Extract<Action, { type: 'castSpell' }>): void {
    const handIndex = action.handIndex;
    const view = this.handViewFor(handIndex);
    const home = this.handPoses.get(handIndex);
    const cardId = this.duel.state.players[HUMAN].hand[handIndex];
    if (!view || !home || !cardId) {
      this.act(action);
      return;
    }
    const d = def(CARD_DB, cardId);
    const variant = displayVariantFor(Services.save.data, cardId);
    this.clearManaPlanPreview();
    this.zoom.dismissSticky();
    this.tweens.killTweensOf(view);
    // Lift from wherever the hover left the card, not its rest pose.
    const proxy = new CardView(this, view.x, view.y)
      .setScale(home.scale * 1.12)
      .setDepth(theme.depth.floats + 2)
      .setAlpha(0.98);
    view.setVisible(false);
    proxy.setCard(d, {
      fx: 'none',
      variant,
      fullArt: variant?.fullArt === true,
      landStyle: this.humanLandStyleFor(cardId),
    });
    const curtain = this.makeCarryCurtain();
    this.carry = {
      action,
      proxy,
      ghost: this.buildCarryGhost(d),
      curtain,
      pose: { x: view.x, y: view.y, vx: 0, vy: 0 },
      home,
      handView: view,
    };
  }

  /** Ghost tile at the exact slot the cast permanent will pack into. */
  private buildCarryGhost(d: CardDef): BoardCardView | null {
    const creature = isType(d, 'creature');
    if (!creature && !isType(d, 'artifact') && !isType(d, 'enchantment')) return null;
    const row = this.duel.state.battlefield.filter(
      (perm) =>
        perm.controller === HUMAN &&
        (perm.attachedTo === undefined || def(CARD_DB, perm.cardId).activated !== undefined) &&
        !isType(def(CARD_DB, perm.cardId), 'land') &&
        isType(def(CARD_DB, perm.cardId), 'creature') === creature,
    );
    const layout: PermanentRowLayout = creature
      ? {
        align: 'center',
        x: LAYOUT.myCreatures.x,
        cy: LAYOUT.myCreatures.cy,
        usable: LAYOUT.myCreatures.usable,
        tileWidth: TILE_W,
        maxSpacing: TILE_H + 4,
        baseScale: 1,
        depth: 5,
        liftSelected: true,
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
    const count = row.length + 1;
    const packed = packRow(count, layout.usable, layout.tileWidth, layout.maxSpacing, ROW_GUTTER);
    const scale = layout.baseScale * packed.scale;
    const x = this.permanentRowX(layout, packed, row.length, count, scale);
    const ghost = new BoardCardView(this, x, layout.cy, d);
    ghost.setScale(scale).setAlpha(0.3).setDepth(layout.depth - 1);
    return ghost;
  }

  private settleCarry(p: Phaser.Input.Pointer): void {
    const carry = this.carry;
    if (!carry) return;
    if (!carryDropAccepted(p.worldY, CARRY_HAND_TOP_Y)) {
      this.cancelCarry();
      return;
    }
    const action = carry.action;
    this.teardownCarry();
    this.act(action);
  }

  /** Immediate cleanup; the hand card returns to its rest pose in place. */
  private teardownCarry(): void {
    const carry = this.carry;
    if (!carry) return;
    this.carry = null;
    carry.curtain.destroy();
    carry.ghost?.destroy();
    if (carry.proxy.active) carry.proxy.destroy();
    this.restoreCarriedHandView(carry);
  }

  private restoreCarriedHandView(carry: { handView: CardView | null; home: { x: number; y: number; scale: number; angle: number } }): void {
    if (!carry.handView?.active) return;
    carry.handView
      .setVisible(true)
      .setAlpha(1)
      .setScale(carry.home.scale)
      .setAngle(carry.home.angle)
      .setPosition(carry.home.x, carry.home.y);
  }

  /**
   * The curtain owns every pointer while a card is up: other controls go
   * inert without per-widget guards, and the next click is the drop/cancel.
   */
  private makeCarryCurtain(): Phaser.GameObjects.Rectangle {
    const curtain = this.add
      .rectangle(BOARD_CENTER_X, theme.design.height / 2, theme.design.width, theme.design.height, 0x000000, 0.001)
      .setDepth(theme.depth.floats + 1)
      .setInteractive({ useHandCursor: true });
    curtain.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 2) this.cancelCarry();
    });
    curtain.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.settleCarry(p);
    });
    return curtain;
  }

  /**
   * Land-carry (the R2 design pass): with a legal drop, a mouse tap on the
   * Reserves pile fans the playable kinds instead of opening the modal;
   * picking one lifts it into the shared carry, ghosted by an incoming bead
   * at the end of your mana row. Touch, the tutorial, replays, and the
   * instantCast escape hatch all keep the modal; right-click always reads it.
   */
  private onReservePileTap(): void {
    if (this.isHumanChooseTarget()) return;
    if (this.landFan) {
      this.closeLandFan();
      return;
    }
    if (this.landFanEligible()) this.openLandFan();
    else this.showReserveModal(HUMAN);
  }

  private landFanEligible(): boolean {
    return (
      !this.touch &&
      !this.tutorial &&
      !this.replayMode &&
      !this.isHumanChooseTarget() &&
      !this.carry &&
      !Services.save.data.settings.instantCast &&
      this.duel
        .legalActions(HUMAN)
        .some((action) => action.type === 'playLand' && action.reserveIndex !== undefined)
    );
  }

  private openLandFan(): void {
    const view = this.duel.viewFor(HUMAN);
    const cardIds = view.you.landReserve ?? [];
    const groups = groupReserveSlots(cardIds, (index) => this.reserveLandAction(index) !== undefined)
      .filter((group) => group.playableIndex !== undefined);
    if (groups.length === 0) {
      this.showReserveModal(HUMAN);
      return;
    }
    const root = this.add.container(0, 0).setDepth(theme.depth.floats);
    // A transparent click-away layer beneath the fan closes it.
    const curtain = this.add
      .rectangle(BOARD_CENTER_X, theme.design.height / 2, theme.design.width, theme.design.height, 0x000000, 0.001)
      .setDepth(theme.depth.floats - 1)
      .setInteractive();
    curtain.on('pointerdown', () => this.closeLandFan());
    const pile = LAYOUT.reservePiles.human;
    const slots = landFanSlots(groups.length, pile.x, pile.y);
    const full = this.motionLevel() === 'full';
    groups.forEach((group, i) => {
      const d = def(CARD_DB, group.cardId);
      const landStyle = this.humanLandStyleFor(group.cardId);
      const variant = displayVariantFor(Services.save.data, group.cardId);
      const v = new CardView(this, pile.x, pile.y).setScale(full ? 0.12 : 0.34);
      v.setCard(d, { fx: 'none', variant, fullArt: variant?.fullArt === true, landStyle });
      root.add(v);
      if (full) {
        this.tweens.add({
          targets: v,
          x: slots[i].x,
          y: slots[i].y,
          scale: 0.34,
          delay: i * 40,
          duration: 170,
          ease: 'Back.easeOut',
        });
      } else {
        v.setPosition(slots[i].x, slots[i].y);
      }
      if (group.count > 1) {
        const badge = this.add
          .text(slots[i].x + 40, slots[i].y - 62, `×${group.count}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: '700',
            color: theme.colors.body,
            backgroundColor: theme.colors.panelFill,
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5)
          .setAlpha(full ? 0 : 1);
        root.add(badge);
        if (full) this.tweens.add({ targets: badge, alpha: 1, delay: i * 40 + 120, duration: 120 });
      }
      v.enableInput();
      v.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button === 2) this.closeLandFan();
      });
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.rightButtonReleased()) return;
        const action =
          group.playableIndex !== undefined ? this.reserveLandAction(group.playableIndex) : undefined;
        if (!action) {
          this.closeLandFan();
          return;
        }
        const origin = { x: v.x, y: v.y };
        this.closeLandFan();
        this.beginLandCarry(action, d, variant, landStyle, origin);
      });
    });
    this.landFan = { root, curtain };
  }

  private closeLandFan(): void {
    const fan = this.landFan;
    if (!fan) return;
    this.landFan = null;
    fan.curtain.destroy();
    fan.root.destroy();
  }

  private beginLandCarry(
    action: Extract<Action, { type: 'playLand' }>,
    d: CardDef,
    variant: CardVariant | undefined,
    landStyle: string | undefined,
    origin: { x: number; y: number },
  ): void {
    const proxy = new CardView(this, origin.x, origin.y)
      .setScale(0.4)
      .setDepth(theme.depth.floats + 2)
      .setAlpha(0.98);
    proxy.setCard(d, { fx: 'none', variant, fullArt: variant?.fullArt === true, landStyle });
    this.carry = {
      action,
      proxy,
      ghost: this.buildLandStripGhost(),
      curtain: this.makeCarryCurtain(),
      pose: { x: origin.x, y: origin.y, vx: 0, vy: 0 },
      // Cancel shrinks the card back into the pile it came from.
      home: {
        x: LAYOUT.reservePiles.human.x,
        y: LAYOUT.reservePiles.human.y,
        scale: LAYOUT.reservePiles.human.cardScale,
        angle: 0,
      },
      handView: null,
    };
  }

  /** The land's destination: a pulsing incoming bead at your mana row's end. */
  private buildLandStripGhost(): Phaser.GameObjects.GameObject {
    const x = this.myManaRowEndX ?? LAYOUT.myManaStrip.x0;
    const ghost = this.add
      .circle(x, LAYOUT.myManaStrip.cy, LAYOUT.myManaStrip.pipSize / 2 + 4)
      .setStrokeStyle(2, colorInt(theme.colors.gold), 0.85)
      .setFillStyle(colorInt(theme.colors.gold), 0.12)
      .setDepth(theme.depth.floats);
    if (this.motionLevel() === 'full') {
      this.tweens.add({ targets: ghost, alpha: 0.45, duration: 420, yoyo: true, repeat: -1 });
    }
    return ghost;
  }

  private cancelCarry(): void {
    const carry = this.carry;
    if (!carry) return;
    // Mirrors the pendingCasts cancel: end on a sync so the hand (playability
    // dots included) rebuilds from state rather than hand-restored poses.
    const finish = (): void => {
      if (carry.proxy.active) carry.proxy.destroy();
      this.restoreCarriedHandView(carry);
      this.sync();
      this.maybeAutoSkip();
      this.endTurnTick();
    };
    if (this.motionLevel() !== 'full') {
      this.teardownCarry();
      finish();
      return;
    }
    this.carry = null;
    carry.curtain.destroy();
    carry.ghost?.destroy();
    this.tweens.add({
      targets: carry.proxy,
      x: carry.home.x,
      y: carry.home.y,
      scaleX: carry.home.scale,
      scaleY: carry.home.scale,
      angle: carry.home.angle,
      duration: theme.motion.fast,
      ease: 'Back.easeOut',
      onComplete: finish,
    });
  }

  /** Per-frame carry follow: the proxy springs after the cursor with a velocity lean. */
  update(_time: number, delta: number): void {
    const carry = this.carry;
    if (!carry) return;
    const pointer = this.input.activePointer;
    carry.pose = stepCarryFollow(
      carry.pose,
      { x: pointer.worldX, y: pointer.worldY },
      delta,
      this.motionLevel(),
    );
    carry.proxy.setPosition(carry.pose.x, carry.pose.y);
    carry.proxy.setAngle(carryTiltDeg(carry.pose.vx, this.motionLevel()));
  }

  private onBattlefieldClick(iid: number): void {
    if (this.isHumanChooseTarget()) {
      this.tryTarget({ kind: 'permanent', iid });
      return;
    }
    if (this.pendingCasts) {
      this.tryTarget({ kind: 'permanent', iid });
      return;
    }
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return;
    const st = this.duel.state;
    const perm = st.battlefield.find((p) => p.iid === iid);
    if (!perm) return;

    // Link or move a Hauntlink permanent wherever the engine allows it: your
    // own main phase and every Charm-speed window, including the revision-4
    // Hauntlink-only window (the legal-action filter inside decides).
    if (this.beginHauntlinkTargeting(iid)) return;
    if (this.beginActivate(iid)) return;
    if (this.beginBoost(iid)) return;
    // Main and every response window; null in the attacker and blocker steps.
    const dutyReason = this.dutyBlockedReason(iid);
    if (dutyReason) this.showTransientNotice(dutyReason);

    if (a.kind === 'declareAttackers') {
      if (!eligibleAttackers(st, CARD_DB, HUMAN).includes(iid)) return;
      const toggle = toggleAttacker(this.selectedAttackers, iid, this.rageAttackers());
      this.selectedAttackers = toggle.selected;
      if (toggle.refused) this.showTransientNotice(rageMustAttackNotice(def(CARD_DB, perm.cardId).name));
      this.sync();
      return;
    }

    if (a.kind === 'declareBlockers' && st.combat) {
      const opts = blockOptions(st, CARD_DB, HUMAN, st.combat);
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
          // The per-attacker cap used to be enforced only at validation, so a
          // tap past it was silently swallowed and read as a bug in playtest
          // (2026-07-30). Refuse at the tap, with the rule named.
          const already = this.blockAssignments.filter((b) => b.attacker === iid).length;
          if (already >= RULES.maxBlockersPerAttacker) {
            this.showSkipNotice(
              `At most ${RULES.maxBlockersPerAttacker} creatures can block one attacker.`,
            );
            this.sync();
            return;
          }
          this.blockAssignments.push({ blocker: this.pendingBlocker, attacker: iid });
          this.pendingBlocker = null;
          const assigned = this.blockAssignments.filter((b) => b.attacker === iid).length;
          if (assigned === 1 && minimumBlockersForAttacker(st, CARD_DB, iid) === 2) {
            // First blocker onto a Dreaded attacker: nudge for the second.
            this.showSkipNotice(`${def(CARD_DB, perm.cardId).name} is Dreaded. Add a second blocker.`);
          } else if (assigned >= 2) {
            // Gang-blocks surface the cap as a running count.
            this.showSkipNotice(
              `${assigned}/${RULES.maxBlockersPerAttacker} blockers on ${def(CARD_DB, perm.cardId).name}.`,
            );
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
      if (n < minimumBlockersForAttacker(st, CARD_DB, attacker)) {
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
    if (this.isHumanChooseTarget()) {
      this.onBattlefieldClick(iid); // mandatory arrival targeting: tap = pick this target
      return;
    }
    if (this.pendingCasts) {
      this.onBattlefieldClick(iid); // targeting: tap = pick this target
      return;
    }
    const perm = this.duel.state.battlefield.find((p) => p.iid === iid);
    if (!perm) return;
    if (perm.controller === HUMAN) {
      this.onBattlefieldClick(iid); // Duty confirm/target, attacker toggle, blocker pick, or reason
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
    this.showInspect(d, undefined, undefined, this.permanentNote(iid));
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
      this.carry ||
      this.pauseOverlay ||
      this.gravePicker ||
      this.animatingCombat ||
      this.zoneModal ||
      this.isHumanChooseTarget()
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
    // The graveyard is the one viewable zone whose ORDER is a rule (`raise
    // top`), so its header states the reading direction the grid now uses.
    const order = zone === 'graveyard' && cardIds.length > 1 ? ' · newest first' : '';
    const title = zone === 'deck'
      ? `Your Deck · ${cardIds.length} cards left`
      : `${owner} ${zoneLabel} · ${cardIds.length}${order}`;
    // Your graveyard is where Retell decisions happen, and the modal covers
    // the board's mana strip: restate the untapped summary in the header.
    const subtitle =
      player === HUMAN && zone === 'graveyard' ? this.untappedManaSubtitle() : undefined;
    const modal = showZoneContents(this, {
      title,
      entries: zone === 'graveyard'
        ? this.graveyardEntries(cardIds, player)
        : this.zoneEntries(cardIds, player === HUMAN),
      ...(subtitle ? { subtitle } : {}),
      emptyText: zone === 'deck' ? 'No cards left.' : zone === 'severed' ? 'No cards severed.' : 'No cards here.',
      dimAlpha: 0.62,
      escToClose: true,
      tapDimToClose: true,
      showClose: false,
      depth: theme.depth.inspect,
      onClose: () => this.closeZoneModal(),
      onInspect: (card, variant, landStyle) => {
        this.zoneModalReturn = () => this.showZoneModal(player, zone);
        this.showInspect(card, variant, landStyle);
      },
    });
    this.zoneModal = modal;
    this.zoneGuard.open(this.overlayGuardTargets());
  }

  /** Public reserve contents, with the existing land-play action moved off the always-on strip. */
  private showReserveModal(player: PlayerId): void {
    if (!this.canOpenZoneModal()) return;
    const view = this.duel.viewFor(HUMAN);
    const cardIds = player === HUMAN ? view.you.landReserve ?? [] : view.opp.landReserve ?? [];
    const owner = player === HUMAN ? 'Your' : "Foe's";
    const modal = showZoneContents(this, {
      title: `${owner} Warchest Reserves · ${cardIds.length}`,
      entries: this.reserveZoneEntries(cardIds, player),
      emptyText: 'No lands in the Warchest Reserves.',
      dimAlpha: 0.62,
      escToClose: true,
      tapDimToClose: true,
      showClose: false,
      depth: theme.depth.inspect,
      onClose: () => this.closeZoneModal(),
      onInspect: (card, variant, landStyle) => {
        this.zoneModalReturn = () => this.showReserveModal(player);
        this.showInspect(card, variant, landStyle);
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
    const activeWarchest = this.isReserveDuel();
    const modal = showZoneContents(this, {
      title: activeWarchest
        ? `${owner} Active Warchest · ${lands.length} (${untapped} untapped)`
        : `${owner} Lands · ${lands.length} (${untapped} untapped)`,
      entries: this.landZoneEntries(lands, player === HUMAN),
      emptyText: activeWarchest ? 'No lands in the Active Warchest.' : 'No lands on the battlefield.',
      dimAlpha: 0.62,
      escToClose: true,
      tapDimToClose: true,
      showClose: false,
      depth: theme.depth.inspect,
      onClose: () => this.closeZoneModal(),
      onInspect: (card, variant, landStyle) => {
        this.zoneModalReturn = () => this.showLandsModal(player);
        this.showInspect(card, variant, landStyle);
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

  /**
   * Retell casts keyed by the graveyard INDEX they cast from, not by card id:
   * the graveyard grid lists one tile per physical card, so two copies of the
   * same card each carry their own chip.
   */
  private retellActionsByGraveIndex(
    player: PlayerId,
    mechanic: 'retell' | 'whispers' = 'retell',
  ): Map<number, Extract<Action, { type: 'castSpell' }>[]> {
    const actions = new Map<number, Array<Extract<Action, { type: 'castSpell' }>>>();
    if (player !== HUMAN) return actions;
    const grave = this.duel.state.players[HUMAN].graveyard;
    for (const action of this.duel.legalActions(HUMAN)) {
      if (action.type !== 'castSpell' || action[mechanic] !== true || action.graveIndex === undefined) continue;
      if (!grave[action.graveIndex]) continue;
      const existing = actions.get(action.graveIndex);
      if (existing) existing.push(action);
      else actions.set(action.graveIndex, [action]);
    }
    return actions;
  }

  /**
   * Preserve actions keyed by graveyard index. Preserve is a main-phase,
   * stack-free paid action (rules.md "Preserve"), so it commits straight
   * through `act` like the Darling tax paydown and lets the engine solve the
   * mana. It had NO player-facing control at all until 2026-08-25: the engine
   * offered the action and the AI took it, but nothing in the UI ever did.
   */
  private preserveActionsByGraveIndex(
    player: PlayerId,
  ): Map<number, Extract<Action, { type: 'preserveCard' }>> {
    const actions = new Map<number, Extract<Action, { type: 'preserveCard' }>>();
    if (player !== HUMAN || this.pendingCasts) return actions;
    const grave = this.duel.state.players[HUMAN].graveyard;
    for (const action of this.duel.legalActions(HUMAN)) {
      if (action.type !== 'preserveCard') continue;
      if (!grave[action.graveIndex]) continue;
      actions.set(action.graveIndex, action);
    }
    return actions;
  }

  /** Every graveyard slot offering an action right now, for the pile alert. */
  private graveActionSlots(player: PlayerId): Set<number> {
    const slots = new Set<number>(this.retellActionsByGraveIndex(player).keys());
    for (const index of this.preserveActionsByGraveIndex(player).keys()) slots.add(index);
    if (player === HUMAN) for (const index of this.duel.viewFor(player).you.whispersLive) slots.add(index);
    return slots;
  }

  /**
   * The graveyard grid, newest first, one tile per physical card. Collapsing
   * duplicates and sorting by cost (which every other zone still does) made
   * the pile's order unreadable, and the order is a rule here: `raise top`
   * returns the most-recently-buried creature.
   */
  private graveyardEntries(cardIds: readonly string[], player: PlayerId): ZoneContentsEntry[] {
    const styled = player === HUMAN;
    const retellActions = this.retellActionsByGraveIndex(player);
    const whispersActions = this.retellActionsByGraveIndex(player, 'whispers');
    const liveWhispers = new Set(this.duel.viewFor(player).you.whispersLive);
    const preserveActions = this.preserveActionsByGraveIndex(player);
    const fodder = sacrificeCandidates(this.duel.instanceState, CARD_DB, HUMAN).length > 0;
    return orderedGraveyardSlots(cardIds).map((slot) => {
      const card = def(CARD_DB, slot.cardId);
      const casts = retellActions.get(slot.index);
      const preserve = preserveActions.get(slot.index);
      const whisperedCasts = whispersActions.get(slot.index);
      const whispered = liveWhispers.has(slot.index) && card.whispers !== undefined;
      // A Whispers carrier with Tithe (Cinderjaw, 2026-09-17) gets its own
      // chip: the enumerator lists the plain cast first, so routing the whole
      // list through continueCast would silently drop the fodder picker.
      // Zero fodder is legal too, as in the hand chooser, so a Tithe variant
      // the enumerator omitted is synthesized from the plain cast.
      const plainWhispers = whisperedCasts?.filter((cast) => !cast.tithe) ?? [];
      const titheWhispers = whisperedCasts?.filter((cast) => cast.tithe) ?? [];
      if (card.tithe && titheWhispers.length === 0) {
        titheWhispers.push(...plainWhispers.map((cast) => ({ ...cast, tithe: true as const, sacrifices: [] })));
      }
      const choice = graveActionChoice(
        casts !== undefined && card.retell !== undefined,
        preserve !== undefined && card.preserve !== undefined,
      );
      return {
        card,
        count: 1,
        // One card per tile: the count chip becomes the position marker, and
        // every tile below the top carries no chip at all.
        badge: slot.top ? 'Top' : null,
        ...(whispered ? { deadline: whispersDeadline(this.duel.state.activePlayer, player, HUMAN) } : {}),
        landStyle: styled ? this.humanLandStyleFor(slot.cardId) : undefined,
        variant: styled ? displayVariantFor(Services.save.data, slot.cardId) : undefined,
        ...(choice === 'retell' && casts && card.retell
          ? {
              action: {
                label: 'Retell',
                cost: card.retell.cost,
                onSelect: () => this.startCast(casts),
              },
            }
          : {}),
        ...(choice === 'preserve' && preserve && card.preserve
          ? {
              action: {
                label: 'Preserve',
                cost: card.preserve.cost,
                onSelect: () => this.act(preserve),
              },
            }
          : {}),
        ...(whispered && player === HUMAN && card.whispers
          ? {
              additionalActions: [
                {
                  label: 'Whisper for', cost: card.whispers.cost,
                  enabled: plainWhispers.length > 0,
                  onSelect: () => { if (plainWhispers.length > 0) this.startCast(plainWhispers); },
                },
                // No price on this chip: the fodder sets it, and the picker
                // previews it. Live only when a creature could be sacrificed,
                // like the hand chooser's "Sacrifice to cast".
                ...(card.tithe
                  ? [{
                      label: 'Whisper + Tithe',
                      enabled: titheWhispers.length > 0 && fodder,
                      onSelect: () => { if (titheWhispers.length > 0) this.startCast(titheWhispers); },
                    }]
                  : []),
              ],
            }
          : {}),
      };
    });
  }

  private zoneEntries(cardIds: readonly string[], styled: boolean): ZoneContentsEntry[] {
    const counts = new Map<string, number>();
    for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    return [...counts]
      .map(([cardId, count]) => ({
        card: def(CARD_DB, cardId),
        count,
        landStyle: styled ? this.humanLandStyleFor(cardId) : undefined,
        variant: styled ? displayVariantFor(Services.save.data, cardId) : undefined,
      }))
      .sort((a, b) => this.compareZoneCards(a.card, b.card));
  }

  private landZoneEntries(lands: readonly Permanent[], styled: boolean): ZoneContentsEntry[] {
    const counts = new Map<string, number>();
    for (const land of lands) counts.set(land.cardId, (counts.get(land.cardId) ?? 0) + 1);
    return [...counts]
      .map(([cardId, count]) => ({
        card: def(CARD_DB, cardId),
        count,
        landStyle: styled ? this.humanLandStyleFor(cardId) : undefined,
        variant: styled ? displayVariantFor(Services.save.data, cardId) : undefined,
      }))
      .sort((a, b) => this.compareLandZoneCards(a.card, b.card));
  }

  private reserveZoneEntries(cardIds: readonly string[], player: PlayerId): ZoneContentsEntry[] {
    const groups = groupReserveSlots(
      cardIds,
      (index) => player === HUMAN && this.reserveLandAction(index) !== undefined,
    );
    return groups.map(({ cardId, count, playableIndex }) => {
      const action = playableIndex !== undefined ? this.reserveLandAction(playableIndex) : undefined;
      return {
        card: def(CARD_DB, cardId),
        count,
        landStyle: player === HUMAN ? this.humanLandStyleFor(cardId) : undefined,
        variant: player === HUMAN ? displayVariantFor(Services.save.data, cardId) : undefined,
        ...(action
          ? {
              action: {
                label: 'Play land',
                onSelect: () => this.act(action),
              },
            }
          : {}),
      };
    });
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

  private showInspect(card: CardDef, variant?: CardVariant, landStyle?: string, note: string | null = null): void {
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
    // The dim covers the whole board: what is under it is out of view (the
    // a11y probe reads this the same way as the duel's choice overlays).
    c.setData('a11ySurface', { x: 0, y: 0, width, height });
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setInteractive();
    c.add(dim);
    const view = new CardView(this, width / 2, height / 2);
    view.setScale(1.35).setCard(card, {
      fx: 'full',
      variant,
      fullArt: variant?.fullArt === true,
      landStyle,
    });
    c.add(view);
    // The tier as words (the face shows it only as a gem colour), atop the
    // keyword column: bottom-anchored over the panel, so larger text grows up
    // into the free band beside the card; with no panel it takes the panel's
    // place. Tokens have no rarity, as on the hover zoom.
    if (!card.token) {
      const hasGlossary = cardGlossaryEntries(card).length > 0;
      c.add(
        this.add
          .text(875, hasGlossary ? 150 - theme.space(3) : 150, rarityLine(card), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: theme.weight.w600,
            color: theme.colors.heading,
            wordWrap: { width: 300 },
          })
          .setOrigin(0, hasGlossary ? 1 : 0),
      );
    }
    addKeywordGlossaryPanel(this, c, card, { x: 875, y: 150, width: 300 });
    // The close hint sits on the title-safe bottom edge, measured from its own
    // height, so larger text grows it upward and never off the frame.
    const closeHint = this.add
      .text(width / 2, theme.design.safeBottom, this.touch ? 'Tap anywhere to close' : 'Click anywhere to close', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5, 1);
    // A battlefield creature's state the card face cannot print (1.9 A2.a:
    // "Provoked this turn."), on a plate between the card and the close hint;
    // the card rises, if it must, to keep clear of the plate.
    if (note) {
      const plate = this.statePlate(width / 2, 0, note);
      const plateHeight = plate.getBounds().height;
      plate.setY(closeHint.y - closeHint.height - theme.space(1) - plateHeight / 2);
      const cardBottom = plate.y - plateHeight / 2 - theme.space(1);
      view.setY(Math.min(view.y, cardBottom - (CARD_H * view.scaleY) / 2));
      c.add(plate);
    }
    c.add(closeHint);
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
    if (this.ended || this.overlay || this.inspect || this.pauseOverlay || this.zoneModal || this.isHumanChooseTarget()) return;
    // Only during your own decision window — never over a pick/inspect overlay,
    // mid-combat animation, or the AI's turn. That keeps the game from ending
    // behind the overlay (which would double-guard the board with the results
    // overlay) and means Concede is always valid while the menu is open.
    if (this.animatingCombat || !this.isHumanTurnDecision()) return;
    this.concedeArmed = false;
    // The tutorial's coach cue must not sit over the menu; Resume restores it.
    this.coach?.setCueSuppressed(true);
    const onOff = (v: boolean): string => (v ? 'On' : 'Off');
    const s = Services.save.data.settings;

    const shell = modalShell(this, {
      width: 420,
      height: 430,
      dimAlpha: 0.82,
      dismissal: 'esc-and-dim',
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

    // Toggles fill when on, but never in gold: Resume is the menu's one
    // primary action (the selection language ruled 2026-10-08).
    const autoSkip = themedButton(this, 640, 326, `Auto-skip: ${onOff(s.autoSkip)}`, {
      variant: s.autoSkip ? 'selected' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        s.autoSkip = !s.autoSkip;
        Services.save.touch();
        autoSkip.setLabel(`Auto-skip: ${onOff(s.autoSkip)}`);
        autoSkip.setVariant(s.autoSkip ? 'selected' : 'ghost');
        if (s.autoSkip) this.maybeAutoSkip();
      },
    });
    c.add(autoSkip.container);

    const sfx = themedButton(this, 640, 376, `Sound: ${onOff(s.sfxOn)}`, {
      variant: s.sfxOn ? 'selected' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        s.sfxOn = !s.sfxOn;
        Services.save.touch();
        sfx.setLabel(`Sound: ${onOff(s.sfxOn)}`);
        sfx.setVariant(s.sfxOn ? 'selected' : 'ghost');
        if (s.sfxOn) Sfx.play('click');
      },
    });
    c.add(sfx.container);

    const music = themedButton(this, 640, 426, `Music: ${onOff(Music.enabled)}`, {
      variant: Music.enabled ? 'selected' : 'ghost',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        Music.setEnabled(!Music.enabled);
        music.setLabel(`Music: ${onOff(Music.enabled)}`);
        music.setVariant(Music.enabled ? 'selected' : 'ghost');
      },
    });
    c.add(music.container);

    if (this.tutorial || this.a11yTutorialChrome) {
      // Leaving the lesson loses nothing (no result is recorded and it stays
      // replayable from How to Play), so it is a quiet, single-tap exit.
      c.add(themedButton(this, 640, 500, 'Leave Tutorial', {
        variant: 'ghost',
        minWidth: 220,
        onTap: (p) => {
          if (!p.rightButtonReleased()) this.leaveTutorial();
        },
      }).container);
      fitDuelModal(this, shell, { width: 420, height: 430, rows: [{ y: 190 }, { y: 226, wrapWidth: 340 },
      { y: 276 }, { y: 326 }, { y: 376 }, { y: 426 }, { y: 500 }] });
      this.pauseOverlay = c;
      this.pauseGuard.open(this.overlayGuardTargets());
      return;
    }

    const concede = themedButton(this, 640, 500, 'Concede', {
      variant: 'danger',
      minWidth: 220,
      onTap: (p) => {
        if (p.rightButtonReleased()) return;
        if (this.ended || !this.isHumanTurnDecision()) {
          concede.setLabel('Not your turn to concede');
          return;
        }
        // Two-tap (a gauntlet loss ends the run) unless opted out. The armed
        // state stands down after a few seconds unanswered, as Gauntlet's
        // Abandon and Limited's Retire do; a closed menu's timer finds its
        // button gone and leaves the next menu alone.
        if (Services.save.data.settings.confirmDestructive && !this.concedeArmed) {
          this.concedeArmed = true;
          concede.setLabel(concedeConfirmLabel(p.wasTouch));
          this.time.delayedCall(CONCEDE_ARM_MS, () => {
            if (!concede.container.active || !this.concedeArmed) return;
            this.concedeArmed = false;
            concede.setLabel('Concede');
          });
          return;
        }
        this.tearDownPauseMenu();
        this.act({ type: 'concede' });
      },
    });
    c.add(concede.container);

    fitDuelModal(this, shell, { width: 420, height: 430, rows: [{ y: 190 }, { y: 226, wrapWidth: 340 },
      { y: 276 }, { y: 326 }, { y: 376 }, { y: 426 }, { y: 500 }] });
    this.pauseOverlay = c;
    this.pauseGuard.open(this.overlayGuardTargets());
  }

  /**
   * First press on an opening-overlay Concede (plain Text buttons, rebuilt
   * with each overlay): name the consequence in the armed red, then stand down
   * after CONCEDE_ARM_MS unanswered. A rebuilt overlay has destroyed `btn`,
   * so its timer does nothing. Relabelling resets a Text hit area; regrow it.
   */
  private armOverlayConcede(btn: Phaser.GameObjects.Text, touch: boolean, disarm: () => void): void {
    btn.setText(concedeConfirmLabel(touch)).setColor(theme.colors.dangerArmed);
    inflateHitArea(btn, 90, 90);
    this.time.delayedCall(CONCEDE_ARM_MS, () => {
      if (!btn.active) return;
      disarm();
      btn.setText('Concede').setColor(theme.colors.danger);
      inflateHitArea(btn, 90, 90);
    });
  }

  /** Destroy the pause overlay + restore board input (no play-resume side effects). */
  private tearDownPauseMenu(): void {
    if (!this.pauseOverlay) return;
    const overlay = this.pauseOverlay;
    this.pauseOverlay = null;
    this.pauseGuard.close();
    this.concedeArmed = false;
    this.coach?.setCueSuppressed(false);
    overlay.destroy();
  }

  /** Resume from the pause overlay: clear state, then rejoin any paused flow. */
  private closePauseMenu(): void {
    if (!this.pauseOverlay) return;
    this.pauseOverlay = null;
    this.pauseGuard.close();
    this.concedeArmed = false;
    this.coach?.setCueSuppressed(false);
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
  private showGravePicker(casts: TargetSelectionAction[]): void {
    if (this.gravePicker) return;
    const width = 1280;
    const height = 720;
    const duty = casts[0]?.type === 'activate';
    const dutyLabel = casts[0]?.type === 'activate' ? this.dutyLabelOf(casts[0]) : DUTY_ACTION_LABEL;
    const mandatory = this.isHumanChooseTarget();
    const deferred = deferredTargetPrompt(this.duel.instanceState, CARD_DB, HUMAN);
    const edict = edictSacrificeSelection(this.duel.instanceState, CARD_DB, HUMAN, this.edictPicks);
    // Completed ordered picks are no longer remaining legal options, but
    // their full-opacity cards and numbered badges remain part of the readout.
    const options = [...this.targetRefsForInput()];
    for (const picked of this.targetPicks) {
      if (!options.some(ref => this.targetRefEquals(ref, picked))) options.push(picked);
    }
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      if (!mandatory) this.closeGravePicker();
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 150, edict ? `${edict.prompt} · ${this.edictPicks.length} of ${edict.count}` :
          deferred?.title ?? `${duty ? dutyLabel : 'Choose targets'} · ${this.pendingTargetStep().countText}`, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    if (deferred || edict) {
      const source = new CardView(this, 210, 150).setScale(0.2);
      source.setCard(def(CARD_DB, (deferred ?? edict)!.sourceCardId), { fx: 'none' });
      c.add(source);
    }
    const n = options.length;
    const spacing = Math.min(160, (width - 240) / Math.max(1, n));
    options.forEach((ref, i) => {
      const x = width / 2 - ((n - 1) * spacing) / 2 + i * spacing;
      const pick = (): void => {
        this.closeGravePicker(false);
        this.tryTarget(ref);
      };
      if (ref.kind === 'player') {
        c.add(themedButton(this, x, 370, DUTY_PLAYER_LABELS[ref.player], {
          variant: 'primary', minWidth: 140,
          onTap: (pointer) => { if (!pointer.rightButtonReleased()) pick(); },
        }).container);
        return;
      }
      const cardId = ref.kind === 'grave'
        ? this.graveTargetCardId(ref)
        : ref.kind === 'permanent'
          ? this.duel.state.battlefield.find((perm) => perm.iid === ref.iid)?.cardId
          : ref.kind === 'stackItem' ? this.duel.state.stack.find(item => item.sid === ref.sid)?.cardId : undefined;
      if (!cardId) return;
      const v = new CardView(this, x, 370).setScale(0.62);
      const d = def(CARD_DB, cardId);
      const variant = displayVariantFor(Services.save.data, cardId);
      v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
      c.add(v);
      const picked = ref.kind === 'permanent' && edict ? [this.edictPicks.indexOf(ref.iid)]
        : this.pickIndices(ref, this.targetPicks);
      if (pickBadgeLabel(picked) !== null) this.addPickBadge(c, x, 370, picked);
      v.setData('a11yPickBadge', pickBadgeLabel(picked));
      // Same read affordances as the mulligan cards: hover/long-press zoom.
      v.enableInput();
      this.zoom.attach(v, d, variant);
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return; // touch picks via the tap classifier below
        if (p.rightButtonReleased()) return;
        pick();
      });
      attachTouchGestures(this, v, { card: d, onTap: pick });
    });
    const complete = this.pendingTargetStep().complete;
    if (!mandatory || edict) {
      c.add(themedButton(this, width / 2, 540, edict ? 'Confirm sacrifice' : duty ? dutyLabel : 'Confirm targets', {
        variant: 'primary', minWidth: 180, enabled: edict ? edict.action !== null : complete !== null,
        onTap: (pointer) => {
          if (pointer.rightButtonReleased()) return;
          if (edict) this.confirmSacrificeSelection();
          else this.confirmPendingTargets();
        },
      }).container);
    }
    const cancel = this.add
      .text(width / 2, 600, 'Cancel', {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(22, 'label')}px`,
        color: theme.colors.danger,
        backgroundColor: theme.colors.dangerBg,
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, cancel, (p) => {
      if (p.rightButtonReleased()) return;
      this.closeGravePicker();
    });
    inflateHitArea(cancel, 90, 60);
    if (mandatory) cancel.destroy();
    else c.add(cancel);
    this.gravePicker = c;
    this.gravePickerGuard.open([...this.overlayGuardTargets(), this.undoBtn]);
  }

  private closeGravePicker(cancelDuty = true): void {
    if (cancelDuty && this.isHumanChooseTarget()) return;
    if (!this.gravePicker) return;
    this.gravePicker.destroy();
    this.gravePicker = null;
    this.gravePickerGuard.close();
    if (cancelDuty && this.pendingCasts) {
      this.pendingCasts = null;
      this.targetPicks = [];
      this.sync();
    }
    this.maybeAutoSkip();
    this.endTurnTick();
  }

  /** The confirm label for a pending activation: "Perform Duty", or the marks it removes. */
  private dutyLabelOf(action: { iid: number; abilityIndex?: number }): string {
    const source = this.duel.state.battlefield.find((perm) => perm.iid === action.iid);
    return dutyActionLabel(source ? activatedAbilitiesOf(def(CARD_DB, source.cardId))[action.abilityIndex ?? 0] : undefined);
  }

  /** The same card-and-cost confirmation composition as the graveyard and cast choosers. */
  private showDutyConfirm(card: CardDef, action: DutyAction): void {
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    bindTapButton(this, dim, (pointer) => {
      if (!pointer.rightButtonReleased()) this.closeEmpowerChooser();
    });
    c.add(dim);
    const ability = activatedAbilitiesOf(card)[action.abilityIndex ?? 0];
    const label = dutyActionLabel(ability);
    c.add(this.add.text(640, 130, label, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    }).setOrigin(0.5));
    const variant = displayVariantFor(Services.save.data, card.id);
    const view = new CardView(this, 640, 340).setScale(0.62);
    view.setCard(card, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(view);
    view.enableInput();
    this.zoom.attach(view, card, variant);

    // ManaText understands mana tokens only. Draw the baked tap pip directly
    // beside the mana run, so no literal T or Duty replaces the cost's icon.
    const pipSize = 22;
    const cost = ability.cost.mana;
    const paysMana = cost !== undefined && manaValue(cost) > 0;
    if (markCostOf(ability) > 0) {
      // Marks, not a tap: the mana (if any), then the words, never the tap pip.
      const mana = renderManaText(this, c, 0, 0, paysMana ? `${manaCostText(cost)}, ` : '', {
        fontFamily: theme.fonts.ui, fontSize: `${duelHudType(pipSize)}px`, color: theme.colors.gold, resolution: 2,
      });
      const marks = markCostOf(ability);
      const spend = `${paysMana ? 'remove' : 'Remove'} ${marks === 1 ? 'a mark' : `${marks} marks`} from this`;
      const words = this.add.text(0, 500, spend, {
        fontFamily: theme.fonts.ui, fontSize: `${duelHudType(pipSize)}px`, color: theme.colors.gold, resolution: 2,
      }).setOrigin(0, 0.5);
      const left = 640 - (mana.text.width + words.width) / 2;
      mana.text.setPosition(left, 500).setOrigin(0, 0.5);
      mana.reflow();
      words.setX(left + mana.text.width);
      c.add(words);
    } else {
      const mana = renderManaText(this, c, 0, 0, paysMana ? `, ${manaCostText(cost)}` : '', {
        fontFamily: theme.fonts.ui, fontSize: `${duelHudType(pipSize)}px`, color: theme.colors.gold, resolution: 2,
      });
      const left = 640 - (pipSize + mana.text.width) / 2;
      c.add(this.add.image(left + pipSize / 2, 500, 'pip-T').setDisplaySize(pipSize, pipSize));
      mana.text.setPosition(left + pipSize, 500).setOrigin(0, 0.5);
      mana.reflow();
    }
    this.dutyConfirm = () => {
      if (!c.active || validateAction(this.duel.instanceState, CARD_DB, HUMAN, action) !== null) return;
      this.closeEmpowerChooser();
      this.act(action);
    };
    c.add(themedButton(this, 640, 555, label, {
      variant: 'primary', minWidth: 220,
      onTap: (pointer) => {
        if (pointer.rightButtonReleased()) return;
        this.dutyConfirm?.();
      },
    }).container);
    c.add(themedButton(this, 640, 614, DUTY_CANCEL_LABEL, {
      variant: 'ghost', minWidth: 180,
      onTap: (pointer) => { if (!pointer.rightButtonReleased()) this.closeEmpowerChooser(); },
    }).container);
    this.empowerChooser = c;
    this.empowerChooserGuard.open([...this.overlayGuardTargets(), this.undoBtn]);
  }

  /** Which of the Hunt's target sources a pending cast or Duty is (`huntStepPrompt`). */
  private huntTargetSource(action: TargetSelectionAction): HuntTargetSource {
    if (action.type === 'activate') return 'duty';
    if (action.type === 'castDarling') return 'cast';
    if (action.hauntlinked) return 'hauntlinkCast';
    if (action.retell) return 'retellCast';
    return action.empowered ? 'empoweredCast' : 'cast';
  }

  /**
   * A small plate with one line of state, for the inspect overlay and the
   * zoom preview: `rowFill` under body copy, as the tile's badges sit.
   */
  private statePlate(x: number, y: number, line: string): Phaser.GameObjects.Container {
    const text = this.add.text(0, 0, line, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, fontStyle: theme.weight.w600,
      color: theme.colors.heading, resolution: 2,
    }).setOrigin(0.5);
    const w = text.width + theme.space(4);
    const h = text.height + theme.space(2);
    const plate = this.add.graphics();
    plate.fillStyle(colorInt(theme.colors.rowFill), theme.alpha.panel);
    plate.fillRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control);
    plate.lineStyle(1, colorInt(theme.colors.panelStroke), theme.alpha.chrome);
    plate.strokeRoundedRect(-w / 2, -h / 2, w, h, theme.radius.control);
    return this.add.container(x, y, [plate, text]);
  }

  /** Open the pump ticker when this creature of yours has a repeatable mana ability it can use now. */
  private beginBoost(iid: number): boolean {
    const actions = this.boostActionsFor(iid);
    const source = this.duel.state.battlefield.find((perm) => perm.iid === iid);
    if (actions.length === 0 || !source) return false;
    this.clearManaPlanPreview();
    // One ticker per creature: every A1.5 carrier prints one such ability.
    this.showPumpTicker(def(CARD_DB, source.cardId), actions[0]);
    return true;
  }

  /**
   * The mana pump's ticker (1.9 A2.a; the owner approves its look): the Duty
   * confirm's card-and-cost composition with a bounded +/- count between the
   * card and the buttons. It opens at 1; the legal action's `times` is its
   * top; the confirm submits ONE `activateMana` carrying the count, and the
   * engine pays for the whole count (no mana plan from the UI).
   */
  private showPumpTicker(card: CardDef, legal: ManaPumpAction): void {
    const ability = card.manaActivated?.[legal.abilityIndex];
    if (!ability) return;
    let ticker: PumpTicker = pumpTicker(legal.times);
    // The tile's hover preview would outlive the tap that opened this (the
    // guard disables the tile's zone, so no pointerout ever reaches it).
    this.zoom.cancel();
    const c = this.add.container(0, 0).setDepth(theme.depth.modal);
    const dim = this.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    bindTapButton(this, dim, (pointer) => {
      if (!pointer.rightButtonReleased()) this.closeEmpowerChooser();
    });
    c.add(dim);
    c.add(this.add.text(640, 108, PUMP_TICKER_TITLE, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    }).setOrigin(0.5));
    const variant = displayVariantFor(Services.save.data, card.id);
    const view = new CardView(this, 640, 272).setScale(0.48);
    view.setCard(card, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(view);
    view.enableInput();
    this.zoom.attach(view, card, variant);

    // The ability in the card's own words, cost first.
    const abilityLine = renderManaText(this, c, 0, 0,
      `${manaCostText(ability.cost)}: ${manaActivatedEffectText(card, legal.abilityIndex)}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.body, resolution: 2,
      });
    abilityLine.text.setOrigin(0.5).setPosition(640, 406);
    abilityLine.reflow();

    // The ticker: - count +, the bound under the count.
    const tickerY = 462;
    const count = this.add.text(640, tickerY, '', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, fontStyle: theme.weight.w700,
      color: theme.colors.heading, resolution: 2,
    }).setOrigin(0.5);
    c.add(count);
    const limit = this.add.text(640, tickerY + 30, pumpTickerLimitText(ticker.max), {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted, resolution: 2,
    }).setOrigin(0.5);
    c.add(limit);
    // The row swallows its own taps: a press on a spent - or + (subdued and
    // inert at the bound) must not fall through to the dim, which cancels.
    c.add(this.add.zone(640, tickerY, 88 * 2 + 96, 64).setInteractive());
    const step = (delta: number): void => {
      const next = stepPumpTicker(ticker, delta);
      if (next.count === ticker.count) return;
      ticker = next;
      refresh();
    };
    const minus = themedButton(this, 640 - 88, tickerY, '\u2212', {
      variant: 'emphasis', minWidth: 56,
      onTap: (pointer) => { if (!pointer.rightButtonReleased()) step(-1); },
    });
    const plus = themedButton(this, 640 + 88, tickerY, '+', {
      variant: 'emphasis', minWidth: 56,
      onTap: (pointer) => { if (!pointer.rightButtonReleased()) step(+1); },
    });
    c.add([minus.container, plus.container]);

    // What the chosen count costs and does, then the confirm and cancel.
    let summary: ReturnType<typeof renderManaText> | null = null;
    const confirm = themedButton(this, 640, 590, pumpConfirmLabel(1), {
      variant: 'primary', minWidth: 220,
      onTap: (pointer) => {
        if (pointer.rightButtonReleased()) return;
        this.dutyConfirm?.();
      },
    });
    c.add(confirm.container);
    c.add(themedButton(this, 640, 644, PUMP_TICKER_CANCEL, {
      variant: 'ghost', minWidth: 180,
      onTap: (pointer) => { if (!pointer.rightButtonReleased()) this.closeEmpowerChooser(); },
    }).container);
    const refresh = (): void => {
      count.setText(String(ticker.count));
      minus.setEnabled(ticker.canDecrease);
      plus.setEnabled(ticker.canIncrease);
      confirm.setLabel(pumpConfirmLabel(ticker.count));
      summary?.destroy();
      summary = renderManaText(this, c, 0, 0, pumpSummaryText(ability.cost, ability.ops, ticker.count), {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, fontStyle: theme.weight.w600,
        color: theme.colors.gold, resolution: 2,
      });
      summary.text.setOrigin(0.5).setPosition(640, 536);
      summary.reflow();
    };
    refresh();

    this.pumpTickerStep = step;
    this.dutyConfirm = () => {
      if (!c.active) return;
      // Re-read the engine's entry: the count is held to what is payable now.
      const fresh = pumpActionsFor(this.duel.legalActions(HUMAN), legal.iid)
        .find((action) => action.abilityIndex === legal.abilityIndex);
      const action = fresh ? pumpSubmission(fresh, ticker.count) : null;
      if (!action || validateAction(this.duel.instanceState, CARD_DB, HUMAN, action) !== null) return;
      this.closeEmpowerChooser();
      this.act(action);
    };
    this.empowerChooser = c;
    this.empowerChooserGuard.open([...this.overlayGuardTargets(), this.undoBtn]);
  }

  /**
   * The `manaActivated` event's small animation (1.9 A2.a): the stat change
   * the uses gave floats off the creature, and a ring pulses out once from
   * its tile, riding the tile so it turns with it. The P/T plate itself
   * updates on the sync that follows.
   */
  private showManaActivated(e: Extract<GameEvent, { e: 'manaActivated' }>): void {
    const view = this.views.get(e.iid);
    const ability = def(CARD_DB, e.cardId).manaActivated?.[e.abilityIndex];
    if (!view?.active || !ability) return;
    this.float(view.x, view.y - 56, pumpBoostText(pumpBoost(ability.ops, e.times)), theme.colors.gold);
    const ring = this.add.rectangle(0, 0, TILE_W + 6, TILE_H + 6, 0x000000, 0)
      .setStrokeStyle(3, colorInt(theme.colors.gold), 1);
    view.add(ring);
    this.tweens.add({
      targets: ring,
      scale: 1.08,
      alpha: 0,
      duration: theme.motion.slow + theme.motion.base,
      ease: theme.motion.easeOut,
      onComplete: () => { if (ring.active) ring.destroy(); },
      onStop: () => { if (ring.active) ring.destroy(); },
    });
  }

  /**
   * A combat response window opened for you because you could pump (A1.5's
   * auto-pass rule keeps it open only then, or for a Charm): say so, so the
   * window never reads as a dead pause. Said once each combat: the first
   * window with a pump to offer shows the notice, and the later windows of
   * that combat do not repeat it. The tile's Boost chip and ring stay for as
   * long as the pump is usable.
   */
  private offerCombatPump(): void {
    if (this.combatPumpOffered || this.replayMode || this.tutorial || this.duel.state.step !== 'combat') return;
    const pump = this.duel.legalActions(HUMAN).find((action): action is ManaPumpAction => action.type === 'activateMana');
    const source = pump && this.duel.state.battlefield.find((perm) => perm.iid === pump.iid);
    if (!source) return;
    this.combatPumpOffered = true;
    this.showTransientNotice(`You can boost ${def(CARD_DB, source.cardId).name} now, or Pass.`);
  }

  /**
   * Sacrifice carriers retain ordinary payment choices before choosing any
   * fodder. Returns false, drawing nothing, when there is nothing to choose
   * (a Rite card with no Empower and no Skim); the caller opens the picker.
   */
  private showSacrificeCastChooser(d: CardDef, casts: HandCastAction[], skims: Extract<Action, { type: 'skim' }>[]): boolean {
    const normal = casts.filter((cast) => !cast.tithe && !cast.empowered);
    const empowered = casts.filter((cast) => !cast.tithe && cast.empowered);
    const tithe = casts.filter((cast) => cast.tithe);
    // Zero sacrifices is legal too, including when the printed generic cost
    // is zero and the enumerator correctly omits its duplicate Tithe action.
    if (d.tithe) {
      for (const cast of casts.filter((candidate) => !candidate.tithe)) {
        if (!tithe.some((candidate) => !!candidate.empowered === !!cast.empowered)) {
          tithe.push({ ...cast, tithe: true, sacrifices: [] });
        }
      }
    }
    const row = sacrificeCastChoices({
      tithe: d.tithe !== undefined, empower: d.empower !== undefined, skim: skims.length > 0,
      plainCast: normal.length > 0, empoweredCast: empowered.length > 0, titheCast: tithe.length > 0,
      fodder: sacrificeCandidates(this.duel.instanceState, CARD_DB, HUMAN).length,
    });
    if (!row) return false;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    bindTapButton(this, dim, (pointer) => {
      if (!pointer.rightButtonReleased()) this.closeEmpowerChooser();
    });
    c.add(dim);
    c.add(this.add.text(640, 130, 'How will you cast this?', {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    }).setOrigin(0.5));
    const variant = displayVariantFor(Services.save.data, d.id);
    const card = new CardView(this, 640, 330).setScale(0.62);
    card.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(card);
    card.enableInput();
    this.zoom.attach(card, d, variant);
    const option = (x: number, y: number, label: string, cost: CardDef['cost'], enabled: boolean, select: () => void): void => {
      if (cost) {
        const price = renderManaText(this, c, x, y - 40, manaCostText(cost), {
          fontFamily: theme.fonts.ui, fontSize: `${theme.type.h2}px`, color: theme.colors.gold, resolution: 2,
        });
        price.text.setOrigin(0.5);
        price.reflow();
      }
      c.add(themedButton(this, x, y, label, {
        variant: 'primary', minWidth: 180, enabled,
        onTap: (pointer) => {
          if (pointer.rightButtonReleased()) return;
          this.closeEmpowerChooser();
          select();
        },
      }).container);
    };
    const empoweredCost = d.cost && d.empower ? combineManaCosts(d.cost, d.empower.cost) : undefined;
    const pick: Record<SacrificeCastChoice['kind'], { cost: CardDef['cost']; select: () => void }> = {
      cast: { cost: d.cost, select: () => this.continueCast(normal) },
      empower: { cost: empoweredCost, select: () => this.continueCast(empowered) },
      sacrifice: { cost: undefined, select: () => this.startCast(tithe) },
    };
    for (const choice of row) option(choice.x, 550, choice.label, pick[choice.kind].cost, choice.enabled, pick[choice.kind].select);
    if (skims.length > 0) option(480, 638, 'Skim', d.skim?.cost, true, () => this.act(skims[0]));
    c.add(themedButton(this, skims.length > 0 ? 800 : 640, 638, 'Cancel', {
      variant: 'ghost', minWidth: 160,
      onTap: (pointer) => { if (!pointer.rightButtonReleased()) this.closeEmpowerChooser(); },
    }).container);
    this.empowerChooser = c;
    this.empowerChooserGuard.open([...this.overlayGuardTargets(), this.undoBtn]);
    return true;
  }

  /** Cast-or-Skim chooser, using the same card and action-chip composition as Empower. */
  private showCastSkimChooser(
    d: CardDef,
    casts: Extract<Action, { type: 'castSpell' }>[],
    skims: Extract<Action, { type: 'skim' }>[],
  ): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closeEmpowerChooser();
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 130, 'Cast, or Skim?', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    const v = new CardView(this, width / 2, 340).setScale(0.62);
    const variant = displayVariantFor(Services.save.data, d.id);
    v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(v);
    v.enableInput();
    this.zoom.attach(v, d, variant);

    const button = (
      x: number,
      label: string,
      bg: string,
      onPick: () => void,
    ): Phaser.GameObjects.Text => {
      const rendered = renderManaText(this, c, 0, 0, label, {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(22, 'label')}px`,
        color: theme.colors.heading,
        backgroundColor: bg,
        padding: { x: 18, y: 10 },
      });
      const t = rendered.text
        .setPosition(x - rendered.text.width / 2, 545 - rendered.text.height / 2)
        .setInteractive({ useHandCursor: true });
      rendered.reflow();
      bindTapButton(this, t, (p) => {
        if (p.rightButtonReleased()) return;
        onPick();
      });
      inflateHitArea(t, 90, 60);
      return t;
    };
    button(width / 2 - 170, `Cast ${manaCostText(d.cost!)}`, theme.colors.btnGhostBg, () => {
      this.closeEmpowerChooser();
      this.startCast(casts);
    });
    button(width / 2 + 170, `Skim ${manaCostText(d.skim!.cost)}`, theme.colors.dangerBg, () => {
      this.closeEmpowerChooser();
      this.act(skims[0]);
    });
    this.empowerChooser = c;
    this.empowerChooserGuard.open(this.overlayGuardTargets());
  }

  /** Cast-or-Hauntlink chooser. Both chips use the established cast chooser. */
  private showHauntlinkChooser(
    d: CardDef,
    casts: Extract<Action, { type: 'castSpell' }>[],
    hauntlinkedCasts: Extract<Action, { type: 'castSpell' }>[],
  ): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closeEmpowerChooser();
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 130, 'Cast, or Hauntlink?', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    const v = new CardView(this, width / 2, 340).setScale(0.62);
    const variant = displayVariantFor(Services.save.data, d.id);
    v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(v);
    v.enableInput();
    this.zoom.attach(v, d, variant);

    const button = (
      x: number,
      label: string,
      bg: string,
      onPick: () => void,
    ): void => {
      const rendered = renderManaText(this, c, 0, 0, label, {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(22, 'label')}px`,
        color: theme.colors.heading,
        backgroundColor: bg,
        padding: { x: 18, y: 10 },
      });
      const t = rendered.text
        .setPosition(x - rendered.text.width / 2, 545 - rendered.text.height / 2)
        .setInteractive({ useHandCursor: true });
      rendered.reflow();
      bindTapButton(this, t, (p) => {
        if (p.rightButtonReleased()) return;
        onPick();
      });
      inflateHitArea(t, 90, 60);
    };
    button(width / 2 - 170, `Cast ${manaCostText(d.cost!)}`, theme.colors.btnGhostBg, () => {
      this.closeEmpowerChooser();
      this.startCast(casts);
    });
    button(width / 2 + 170, `Hauntlink ${manaCostText(d.hauntlink!.cost)}`, theme.colors.dangerBg, () => {
      this.closeEmpowerChooser();
      // Hauntlink skips startCast because it cannot carry an Empower choice.
      this.continueCast(hauntlinkedCasts);
    });
    this.empowerChooser = c;
    this.empowerChooserGuard.open(this.overlayGuardTargets());
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
      .rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closeEmpowerChooser(); // tap outside cancels the cast
    });
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 130, 'Cast, or pay more to Empower?', {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.heading,
        })
        .setOrigin(0.5),
    );
    const v = new CardView(this, width / 2, 340).setScale(0.62);
    const variant = displayVariantFor(Services.save.data, d.id);
    v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(v);
    v.enableInput();
    this.zoom.attach(v, d, variant);

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
      const rendered = renderManaText(this, c, 0, 0, label, {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(22, 'label')}px`,
        color: theme.colors.heading,
        backgroundColor: bg,
        padding: { x: 18, y: 10 },
      });
      const t = rendered.text
        .setPosition(x - rendered.text.width / 2, 545 - rendered.text.height / 2)
        .setInteractive({ useHandCursor: true });
      rendered.reflow();
      bindTapButton(this, t, (p) => {
        if (p.rightButtonReleased()) return;
        onPick();
      });
      inflateHitArea(t, 90, 60);
      return t;
    };
    const total = combineManaCosts(d.cost!, d.empower!.cost);
    button(width / 2 - 170, `Cast ${manaCostText(d.cost!)}`, theme.colors.btnGhostBg, () => pick(false));
    button(width / 2 + 170, `Empower ${manaCostText(total)}`, theme.colors.dangerBg, () => pick(true));
    const rider = empowerText(d);
    if (rider) {
      const renderedRider = renderManaText(this, c, width / 2, 605, rider, {
        fontFamily: theme.fonts.display,
        fontSize: `${duelHudType(17, 'body')}px`,
        color: theme.colors.body,
        wordWrap: { width: 640 },
        align: 'center',
      });
      renderedRider.text.setOrigin(0.5, 0);
      renderedRider.reflow();
    }
    this.empowerChooser = c;
    this.empowerChooserGuard.open(this.overlayGuardTargets());
  }

  /**
   * The mode chooser for a modal Ritual or Charm (2.0): the card beside one
   * row per mode. "Choose one" casts on the tap; "Choose up to N" toggles
   * rows and casts on Cast. A mode with no legal target now stays listed,
   * dimmed and saying so. Only the engine's own legal casts are narrowed, so
   * an illegal set can't be offered; targets follow as for any spell.
   */
  private showModeChooser(
    d: CardDef,
    casts: Extract<Action, { type: 'castSpell' }>[],
    selected: number[] = [],
    redraw = false,
  ): void {
    this.empowerChooser?.destroy();
    this.empowerChooser = null;
    const upTo = d.modal?.upTo ?? 1;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    bindTapButton(this, dim, (p) => {
      if (!p.rightButtonReleased()) this.closeEmpowerChooser();
    });
    c.add(dim);
    c.add(this.add.text(640, 96, modeChooserTitle(d), {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    }).setOrigin(0.5));
    const v = new CardView(this, 330, 370).setScale(0.62);
    const variant = displayVariantFor(Services.save.data, d.id);
    v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt });
    c.add(v);
    v.enableInput();
    this.zoom.attach(v, d, variant);

    const cast = (modes: number[]): void => {
      const subset = castsForModes(casts, modes);
      if (subset.length === 0) return;
      this.closeEmpowerChooser();
      this.continueCast(subset);
    };
    const rowX = 560;
    const rowW = 600;
    let y = 170;
    for (const row of modeRows(d, casts)) {
      const chosen = selected.includes(row.index);
      const text = this.add.text(rowX + 48, 0, row.available ? row.line : `${row.line}\nNo legal target right now.`, {
        fontFamily: theme.fonts.ui, fontSize: `${duelHudType(17, 'body')}px`, color: theme.colors.body,
        wordWrap: { width: rowW - 64 }, resolution: 2,
      });
      const h = Math.max(56, text.height + 24);
      const plate = this.add.graphics()
        .fillStyle(chosen ? theme.graphics.rowFillActive : theme.graphics.panelFill, 0.96)
        .fillRoundedRect(rowX, y, rowW, h, theme.radius.control)
        .lineStyle(chosen ? theme.outline.state : 1, colorInt(chosen ? theme.colors.gold : theme.colors.panelStroke), 1)
        .strokeRoundedRect(rowX, y, rowW, h, theme.radius.control);
      // A ring for "pick one", a box for "pick several"; filled when chosen. Shape and word, never colour alone.
      const mark = this.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1);
      const mx = rowX + 24;
      const my = y + h / 2;
      if (upTo === 1) mark.strokeCircle(mx, my, 9);
      else mark.strokeRoundedRect(mx - 9, my - 9, 18, 18, 3);
      if (chosen) mark.fillStyle(colorInt(theme.colors.gold), 1).fillRect(mx - 5, my - 5, 10, 10);
      text.setY(y + (h - text.height) / 2);
      const hit = this.add.rectangle(rowX + rowW / 2, y + h / 2, rowW, h, 0x000000, 0).setName(`duel-mode-${row.index}`);
      c.add([plate, mark, text, hit]);
      if (row.available) {
        hit.setInteractive({ useHandCursor: true });
        bindTapButton(this, hit, (p) => {
          if (p.rightButtonReleased()) return;
          if (upTo === 1) cast([row.index]);
          else this.showModeChooser(d, casts, toggleMode(selected, row.index, upTo), true);
        });
      } else {
        plate.setAlpha(0.5);
        mark.setAlpha(0.5);
        text.setAlpha(0.6);
      }
      y += h + 12;
    }
    const buttonY = Math.max(y + 36, 560);
    if (upTo > 1) {
      c.add(this.add.text(rowX, y + 2, `${selected.length} of up to ${upTo} chosen`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.muted, resolution: 2,
      }));
      c.add(themedButton(this, rowX + rowW / 2 - 110, buttonY, 'Cast', {
        variant: 'primary', minWidth: 180, enabled: castsForModes(casts, selected).length > 0,
        onTap: (p) => { if (!p.rightButtonReleased()) cast(selected); },
      }).container);
    }
    c.add(themedButton(this, upTo > 1 ? rowX + rowW / 2 + 110 : rowX + rowW / 2, buttonY, 'Cancel', {
      variant: 'ghost', minWidth: 180,
      onTap: (p) => { if (!p.rightButtonReleased()) this.closeEmpowerChooser(); },
    }).container);
    this.empowerChooser = c;
    // A toggle redraws the chooser in place; the board stays guarded from the first draw.
    if (!redraw) this.empowerChooserGuard.open(this.overlayGuardTargets());
  }

  private closeEmpowerChooser(): void {
    if (!this.empowerChooser) return;
    this.empowerChooser.destroy();
    this.empowerChooser = null;
    this.dutyPicker = null;
    this.dutyConfirm = null;
    this.pumpTickerStep = null;
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
      ...(this.dutyFinishButton ? [this.dutyFinishButton.inputZone] : []),
      ...this.darlingZoneViews.map((view) => view.inputZone).filter((zone): zone is Phaser.GameObjects.Zone => !!zone),
      ...this.darlingZoneControls,
      ...this.manaStripZones,
      ...this.handViews,
      ...[
        this.oppReservePile.inputZone,
        this.oppGravePile.inputZone,
        this.oppSeveredPile.inputZone,
        this.myReservePile.inputZone,
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
    this.lootPicker = null;
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
      const buttons = left > 0 ? ['Keep', 'Mulligan', 'Concede'] : ['Keep', 'Concede'];
      this.buildPickOverlay(mulliganTitle(left), 0, buttons, true);
    } else if (a.kind === 'bottomCards') {
      this.buildBottomingOverlay(a.count);
    } else if (a.kind === 'foresee') {
      this.buildForeseeOverlay(a.cards);
    } else if (a.kind === 'discardToHandSize') {
      if (a.decision === 'discard') this.buildLootOverlay();
      else this.buildPickOverlay(discardTitle(a.count), a.count, ['Confirm']);
    }
  }

  private buildLootOverlay(): void {
    const cards = this.duel.state.players[HUMAN].hand.map(cardId => ({
      card: def(CARD_DB, cardId), variant: displayVariantFor(Services.save.data, cardId),
      landStyle: this.humanLandStyleFor(cardId),
    }));
    this.lootPicker = showLootPicker(this, {
      cards, touch: this.touch, selection: picked => lootDiscardSelection(this.duel.instanceState, CARD_DB, HUMAN, picked),
      submit: action => this.act(action),
      decorate: (view, entry, toggle) => {
        this.zoom.attach(view, entry.card, entry.variant, entry.landStyle);
        view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasTouch && !pointer.rightButtonReleased()) toggle();
        });
        attachTouchGestures(this, view, { ...entry, onTap: toggle });
      },
    });
    for (const view of this.handViews) view.setVisible(false);
    for (const decor of this.handDecor) (decor as Phaser.GameObjects.Arc).setVisible(false);
    this.overlay = this.lootPicker.container;
    this.guard.open([...this.overlayGuardTargets(), this.undoBtn]);
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
      dismissal: 'mandatory',
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
      const landStyle = this.humanLandStyleFor(cardId);
      const variant = displayVariantFor(Services.save.data, cardId);
      v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt, landStyle });
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
      this.zoom.attach(v, d, variant, landStyle);
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
      attachTouchGestures(this, v, { card: d, variant, landStyle, onTap: toggle });
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

  private buildPickOverlay(title: string, picks: number, buttons: string[], withStack = false): void {
    const width = 1280; // design-space constants (see buildZones)
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 150, title, { fontFamily: theme.fonts.display, fontSize: `${duelHudType(30, 'h1')}px`, color: theme.colors.heading })
        .setOrigin(0.5),
    );
    // The library stack the mulligan riffles; the hand row cedes it the right edge.
    const stackPlates = withStack ? this.buildLibraryStack(c, STACK_X, STACK_Y) : [];
    const overlayCards: CardView[] = [];
    const rowCenter = withStack ? 560 : width / 2;
    this.discardPicks.clear();
    const hand = this.duel.state.players[HUMAN].hand;
    const spacing = Math.min(150, (width - (withStack ? 420 : 200)) / Math.max(1, hand.length));
    // Organize the opening/pick hand the same way as the play fan (handSort):
    // `pos` is the visual slot, `handIdx` the true engine index that picks and
    // the bottomCards/discard actions address.
    const order = handDisplayOrder(hand, CARD_DB);
    order.forEach((handIdx, pos) => {
      const cardId = hand[handIdx];
      const x = rowCenter - ((hand.length - 1) * spacing) / 2 + pos * spacing;
      const v = new CardView(this, x, 360);
      overlayCards.push(v);
      v.setScale(0.62);
      const d = def(CARD_DB, cardId);
      const landStyle = this.humanLandStyleFor(cardId);
      const variant = displayVariantFor(Services.save.data, cardId);
      v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt, landStyle });
      c.add(v);
      // Hover-zoom works during hand decisions too — that's when reading
      // the cards matters most (mulligan cards are otherwise interaction-free);
      // on touch the same reading comes from long-press → sticky preview.
      v.enableInput();
      this.zoom.attach(v, d, variant, landStyle);
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
        variant,
        landStyle,
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
    // While the riffle plays, every button is dead: the mulligan is already
    // decided, and a second press would double-submit.
    let shuffling = false;
    buttons.forEach((label, bi) => {
      // 220px centers: the armed Concede label ("Tap to confirm") auto-grows
      // its text plate to ~246px, which overlapped the neighbor at the old
      // 180px pitch (user-reported 2026-07-12).
      const bx = width / 2 - ((buttons.length - 1) * 220) / 2 + bi * 220;
      const concede = label === 'Concede';
      const btn = this.add
        .text(bx, 580, label, {
          fontFamily: theme.fonts.display, fontSize: `${duelHudType(22, 'label')}px`,
          color: concede ? theme.colors.danger : theme.colors.gold,
          backgroundColor: concede ? theme.colors.dangerBg : theme.colors.btnEmphasisBg, padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, (p) => {
        if (shuffling) return;
        if (concede) {
          // Escape hatch (e.g. an unkeepable hand at the mulligan cap). Shares
          // the confirmDestructive two-tap policy with the corner Concede.
          if (Services.save.data.settings.confirmDestructive && !overlayConcedeArmed) {
            overlayConcedeArmed = true;
            this.armOverlayConcede(btn, p.wasTouch, () => { overlayConcedeArmed = false; });
            return;
          }
          this.act({ type: 'concede' });
          return;
        }
        const a = this.duel.awaiting;
        if (!('player' in a) || a.player !== HUMAN) return;
        if (a.kind === 'mulligan') {
          if (label === 'Keep') {
            this.act({ type: 'keepHand' });
            return;
          }
          // Taking a mulligan was an instant screen swap; now the hand
          // gathers into the library and the stack riffles before the new
          // hand appears. The submitted action is unchanged.
          shuffling = true;
          this.playMulliganShuffle(overlayCards, stackPlates, () => this.act({ type: 'mulligan' }));
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

  /**
   * The library, rendered face-down with the deck's own card back. These were
   * painted rounded-rect plates until 2026-08-24, which meant the card back a
   * player chose was visible only in Pack Opening and never during play; the
   * library is the one place a deck IS a stack of face-down cards.
   */
  private buildLibraryStack(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
  ): Phaser.GameObjects.Image[] {
    const deckSize = this.duel.state.players[HUMAN].deck.length;
    const key = this.textures.exists(this.humanCardBackKey) ? this.humanCardBackKey : 'cardback';
    const plates: Phaser.GameObjects.Image[] = [];
    for (const { dx, dy } of libraryStackPlates(deckSize)) {
      const plate = this.add.image(x + dx, y + dy, key).setDisplaySize(124, 172);
      c.add(plate);
      plates.push(plate);
    }
    const label = this.add
      .text(x, y + 108, `Library · ${deckSize}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(label);
    return plates;
  }

  /** Gather the hand into the stack, riffle it, then hand control back. */
  private playMulliganShuffle(
    cards: readonly CardView[],
    plates: readonly Phaser.GameObjects.Image[],
    onDone: () => void,
  ): void {
    const motion = riffleShuffleMotion(this.motionLevel());
    if (motion.totalMs === 0 || plates.length === 0) {
      onDone();
      return;
    }
    cards.forEach((v, i) => {
      this.tweens.add({
        targets: v,
        x: STACK_X,
        y: STACK_Y,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0.9,
        delay: i * 25,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => v.setVisible(false),
      });
    });
    const halves = [plates.filter((_, i) => i % 2 === 0), plates.filter((_, i) => i % 2 === 1)];
    const doCut = (cut: number): void => {
      if (cut >= motion.cuts) {
        this.time.delayedCall(motion.gatherMs, onDone);
        return;
      }
      Sfx.play('flip', { pitch: 0.92 + cut * 0.08 });
      halves.forEach((half, hi) => {
        for (const plate of half) {
          this.tweens.add({
            targets: plate,
            // RELATIVE: the plates now carry their own stack offset, where the
            // old painted Graphics all sat at x = 0 and could take an absolute
            // target. yoyo returns each plate to its own place either way.
            x: hi === 0 ? `-=${motion.splitDx}` : `+=${motion.splitDx}`,
            duration: motion.cutMs / 2,
            yoyo: true,
            ease: 'Quad.easeInOut',
          });
        }
      });
      this.time.delayedCall(motion.cutMs, () => doCut(cut + 1));
    };
    this.time.delayedCall(150 + cards.length * 25, () => doCut(0));
  }

  /**
   * The bottoming half of the mulligan ritual: drag a card onto the library
   * stack (or tap it anywhere) to stage it; staged cards tuck under the top
   * plate and peek out as a retrievable tab. Confirm submits the
   * byte-identical `bottomCards` action once the count is met.
   */
  private buildBottomingOverlay(count: number): void {
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, theme.graphics.dim, theme.alpha.overlayDim).setInteractive();
    c.add(dim);
    c.add(
      this.add
        .text(width / 2, 150, bottomingTitle(count), { fontFamily: theme.fonts.display, fontSize: `${duelHudType(30, 'h1')}px`, color: theme.colors.heading })
        .setOrigin(0.5),
    );
    const plates = this.buildLibraryStack(c, STACK_X, STACK_Y);
    const topPlate = plates[plates.length - 1];
    this.discardPicks.clear();
    const full = this.motionLevel() === 'full';
    const hand = this.duel.state.players[HUMAN].hand;
    const spacing = Math.min(150, (width - 420) / Math.max(1, hand.length));
    const homes = new Map<number, { x: number; y: number }>();
    const stagedOrder: number[] = [];
    const stagedViews = new Map<number, CardView>();
    let refreshConfirm: () => void = () => undefined;
    const layoutStaged = (): void => {
      const xs = stagedSlots(stagedOrder.length, STACK_X - 20, 46);
      stagedOrder.forEach((idx, i) => {
        const v = stagedViews.get(idx);
        if (!v) return;
        this.tweens.add({ targets: v, x: xs[i], y: STACK_Y + 118, duration: full ? 120 : 0, ease: 'Quad.easeOut' });
      });
    };
    const stage = (idx: number, v: CardView): void => {
      if (this.discardPicks.has(idx) || this.discardPicks.size >= count) return;
      this.discardPicks.add(idx);
      stagedOrder.push(idx);
      stagedViews.set(idx, v);
      c.moveBelow<Phaser.GameObjects.GameObject>(v, topPlate); // tuck under the top plate on the way down
      this.tweens.add({
        targets: v,
        x: stagedSlots(stagedOrder.length, STACK_X - 20, 46)[stagedOrder.length - 1],
        y: STACK_Y + 118,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0.95,
        duration: full ? 200 : 0,
        ease: 'Quad.easeIn',
      });
      layoutStaged();
      refreshConfirm();
    };
    const unstage = (idx: number): void => {
      const v = stagedViews.get(idx);
      if (!v) return;
      this.discardPicks.delete(idx);
      stagedViews.delete(idx);
      stagedOrder.splice(stagedOrder.indexOf(idx), 1);
      c.bringToTop(v);
      const home = homes.get(idx);
      this.tweens.add({
        targets: v,
        x: home?.x ?? v.x,
        y: home?.y ?? 360,
        scaleX: 0.62,
        scaleY: 0.62,
        alpha: 1,
        duration: full ? 200 : 0,
        ease: 'Back.easeOut',
      });
      layoutStaged();
      refreshConfirm();
    };
    const toggleStage = (idx: number, v: CardView): void => {
      if (this.discardPicks.has(idx)) unstage(idx);
      else stage(idx, v);
    };
    // Manual mouse drag (the codebase's first drag surface): pointerdown on a
    // card arms it, overlay-scoped move/up listeners carry and drop it. Taps
    // keep working everywhere — an unmoved press falls through to the toggle.
    let drag: { idx: number; view: CardView; startX: number; startY: number; moved: boolean } | null = null;
    const onDragMove = (p: Phaser.Input.Pointer): void => {
      if (!drag) return;
      if (!drag.moved && !dragMoved(drag.startX, drag.startY, p.worldX, p.worldY)) return;
      drag.moved = true;
      c.bringToTop(drag.view);
      drag.view.setPosition(p.worldX, p.worldY).setScale(0.66);
    };
    const onDragUp = (p: Phaser.Input.Pointer): void => {
      const d = drag;
      drag = null;
      if (!d?.moved) return; // an unmoved press is the card's own tap toggle
      if (!this.discardPicks.has(d.idx) && this.discardPicks.size < count && stagedDropAccepted(p.worldX, p.worldY, STACK_DROP)) {
        stage(d.idx, d.view);
        return;
      }
      if (this.discardPicks.has(d.idx)) {
        // A staged card was dragged back out; unstage springs it home.
        unstage(d.idx);
        return;
      }
      const home = homes.get(d.idx);
      this.tweens.add({
        targets: d.view,
        x: home?.x ?? d.view.x,
        y: home?.y ?? 360,
        scaleX: 0.62,
        scaleY: 0.62,
        duration: full ? 180 : 0,
        ease: 'Back.easeOut',
      });
    };
    this.input.on('pointermove', onDragMove);
    this.input.on('pointerup', onDragUp);
    c.once('destroy', () => {
      this.input.off('pointermove', onDragMove);
      this.input.off('pointerup', onDragUp);
    });
    const order = handDisplayOrder(hand, CARD_DB);
    order.forEach((handIdx, pos) => {
      const cardId = hand[handIdx];
      const x = 560 - ((hand.length - 1) * spacing) / 2 + pos * spacing;
      const v = new CardView(this, x, 360);
      v.setScale(0.62);
      const d = def(CARD_DB, cardId);
      const landStyle = this.humanLandStyleFor(cardId);
      const variant = displayVariantFor(Services.save.data, cardId);
      v.setCard(d, { fx: 'none', variant, fullArt: variant.fullArt, landStyle });
      c.add(v);
      homes.set(handIdx, { x, y: 360 });
      v.enableInput();
      this.zoom.attach(v, d, variant, landStyle);
      v.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch || p.button !== 0) return;
        drag = { idx: handIdx, view: v, startX: p.worldX, startY: p.worldY, moved: false };
      });
      v.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return; // touch stages via the tap classifier below
        if (p.rightButtonReleased()) return;
        if (drag?.moved) return; // a finished drag is not a tap
        toggleStage(handIdx, v);
      });
      attachTouchGestures(this, v, {
        card: d,
        variant,
        landStyle,
        onTap: () => toggleStage(handIdx, v),
      });
    });
    let overlayConcedeArmed = false;
    const buttons = ['Confirm', 'Concede'];
    const buttonRefs = new Map<string, Phaser.GameObjects.Text>();
    buttons.forEach((label, bi) => {
      const bx = width / 2 - ((buttons.length - 1) * 220) / 2 + bi * 220;
      const concede = label === 'Concede';
      const btn = this.add
        .text(bx, 580, label, {
          fontFamily: theme.fonts.display, fontSize: `${duelHudType(22, 'label')}px`,
          color: concede ? theme.colors.danger : theme.colors.gold,
          backgroundColor: concede ? theme.colors.dangerBg : theme.colors.btnEmphasisBg, padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, (p) => {
        if (concede) {
          // Shares the confirmDestructive two-tap policy with the corner Concede.
          if (Services.save.data.settings.confirmDestructive && !overlayConcedeArmed) {
            overlayConcedeArmed = true;
            this.armOverlayConcede(btn, p.wasTouch, () => { overlayConcedeArmed = false; });
            return;
          }
          this.act({ type: 'concede' });
          return;
        }
        const a = this.duel.awaiting;
        if (!('player' in a) || a.player !== HUMAN || a.kind !== 'bottomCards') return;
        if (this.discardPicks.size === a.count)
          this.act({ type: 'bottomCards', handIndices: [...this.discardPicks] });
      });
      inflateHitArea(btn, 90, 90);
      buttonRefs.set(label, btn);
      c.add(btn);
    });
    refreshConfirm = (): void => {
      const ready = this.discardPicks.size === count;
      buttonRefs.get('Confirm')?.setAlpha(ready ? 1 : 0.5);
    };
    refreshConfirm();
    // Same fan-hiding rule as buildPickOverlay: one unambiguous copy to read.
    for (const v of this.handViews) v.setVisible(false);
    for (const o of this.handDecor) (o as Phaser.GameObjects.Arc).setVisible(false);
    this.guard.open(this.overlayGuardTargets());
    this.overlay = c;
  }

  private rewardLine(totalGold: number, firstWinBonus: boolean, streakCount: number, completion = false): string {
    const parts: string[] = [];
    if (completion) parts.push('completion bonus');
    if (firstWinBonus) parts.push('first win');
    if (streakCount > 0) parts.push(`streak ${streakCount}`);
    return `+${formatGold(totalGold)}${parts.length > 0 ? `  (${parts.join(' + ')})` : ''}`;
  }

  private showResults(won: boolean, reason: string): void {
    if (this.a11yFixture) {
      this.showPracticeResultPanel(won, reason, this.rewardLine(0, false, 0));
      return;
    }
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
    // The one anonymous duel digest, reported here so a single call covers all
    // three modes, and BEFORE the branches pay out: a Limited run is still open
    // in the save at this point, which is how `deckSource` measures `drafted`
    // instead of taking the caller's word for it.
    if (this.signalDeck) {
      signals.duelFinished({
        deck: this.signalDeck,
        limited: this.limited !== null,
        gauntlet: this.opponent !== null && this.gauntletRung !== null,
        opponentId: this.opponent?.id ?? this.limitedPersona?.id ?? null,
        difficulty: this.difficulty,
        winner: this.duel.state.winner,
        reason,
        turns: this.duel.state.turn,
        mulligans: this.duel.state.players[HUMAN].mulligans,
        save: Services.save.data,
      });
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
    const checkpoint = checkpointAchievements(save, CARD_DB);
    Services.save.flush();
    if (checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
    Music.duck(1.8); // let the sting read clearly over the bed
    Sfx.play(won ? 'win' : 'loss');

    this.showPracticeResultPanel(won, reason, reward.tooEarly ? 'No reward: the match ended too early'
      : this.rewardLine(reward.gold + streak.gold, reward.firstWinBonus, streak.advanced ? streak.count : 0));
  }

  /** Rendering only, shared with the dev fixture; reward/save work stays with showResults. */
  private showPracticeResultPanel(won: boolean, reason: string, rewardCopy: string): void {
    const shell = modalShell(this, {
      width: 560,
      height: 330,
      dimAlpha: 0.78,
      dismissal: 'esc-only',
      depth: theme.depth.results,
      onClose: () => {
        this.guard.close();
        this.zoom.setSuppressed(false);
        this.scene.start('MainMenu');
      },
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
          rewardCopy,
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
    mk(520, 'Rematch', 'primary', () => this.restartDuel());
    mk(760, 'Menu', 'ghost', () => this.scene.start('MainMenu'));
    fitDuelModal(this, shell, { width: 560, height: 330, rows: [{ y: 278 }, { y: 342, wrapWidth: 480 },
      { y: 388, wrapWidth: 500 }, { y: 456 }] });
    this.guard.open(this.overlayGuardTargets());
  }

  /** Limited results: update the active run, then continue or close the run. */
  private showLimitedResults(won: boolean, reason: string): void {
    const save = Services.save.data;
    const today = todayString();
    const reward = applyLimitedMatchResult(save, this.difficulty, won, today, this.myDeckColorStyle);
    const streak = won ? recordDailyWin(save, today) : { advanced: false, count: save.daily.streak.count, gold: 0 };
    const checkpoint = checkpointAchievements(save, CARD_DB);
    Services.save.flush();
    if (checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
    Music.duck(1.8);
    Sfx.play(won ? (reward.runOver && reward.wins === 3 ? 'win' : 'rungClear') : 'loss');

    const shell = modalShell(this, {
      width: 620,
      height: 340,
      dimAlpha: 0.82,
      dismissal: 'esc-only',
      depth: theme.depth.results,
      onClose: () => {
        this.guard.close();
        this.zoom.setSuppressed(false);
        this.scene.start('Limited');
      },
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
      mk(510, 'Next Match', 'primary', () => this.restartDuel(limitedDuelData(save.limited.activeRun!)));
      mk(770, 'Draft', 'ghost', () => this.scene.start('Limited'));
    } else {
      mk(510, 'Draft', 'primary', () => this.scene.start('Limited'));
      mk(770, 'Menu', 'ghost', () => this.scene.start('MainMenu'));
    }
    fitDuelModal(this, shell, { width: 620, height: 340, rows: [{ y: 268 }, { y: 328, wrapWidth: 540 },
      { y: 378, wrapWidth: 560 }, { y: 414, wrapWidth: 540 }, { y: 456 }] });
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
    const checkpoint = checkpointAchievements(save, CARD_DB);
    Services.save.flush();
    if (checkpoint.changed) queueAchievementUnlockToasts(checkpoint.ids);
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
      dismissal: 'esc-only',
      depth: theme.depth.results,
      onClose: () => {
        this.guard.close();
        this.zoom.setSuppressed(false);
        this.scene.start('Gauntlet');
      },
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
      prefetchDuelArt(this, { opponentId: this.avatarForGauntletFloor(next).id, gauntletRung: next });
      mk(520, 'Next Foe', 'primary', () =>
        this.restartDuel({ opponentId: this.avatarForGauntletFloor(next).id, gauntletRung: next }),
      );
      mk(760, 'Tower', 'ghost', () => this.scene.start('Gauntlet'));
    }
    fitDuelModal(this, shell, { width: 620, height: 330, rows: [{ y: 270 }, { y: 330, wrapWidth: 540 },
      { y: 378, wrapWidth: 560 }, { y: 456 }] });
    this.guard.open(this.overlayGuardTargets());
  }

  /** Scene reuse is continuation, not a fresh duel entry, so consume one bumper skip. */
  private restartDuel(data?: object): void {
    this.internalRestartPending = true;
    this.scene.restart(data);
  }

  private showGauntletRunRecap(
    completed: boolean,
    failedRung: number | null,
    reason: string,
    rewardLine: string,
    initialPage = 0,
  ): void {
    const shell = modalShell(this, {
      width: 820,
      height: 640,
      dimAlpha: 0.86,
      dismissal: 'esc-only',
      depth: theme.depth.results,
      onClose: () => {
        this.guard.close();
        this.zoom.setSuppressed(false);
        this.scene.start('Gauntlet');
      },
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

    // Keep the release grid and portrait anchors at standard text. Names use
    // the whole column, in a foreground reading strip; at larger text the
    // measured rows page above the unchanged result buttons.
    const rungCount = ECONOMY.gauntletRungGold.length;
    const textScale = currentAccessibility().textScale;
    const base = duelRecapLayout(shell.contentBounds, rungCount, 0, textScale);
    const nameStyle = { fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700, align: 'center', wordWrap: { width: base.labelWidth } };
    let nameHeight = 0;
    for (let rung = 1; rung <= rungCount; rung++) {
      const measure = this.add.text(0, 0, `R${rung} ${this.avatarForGauntletFloor(rung).name.split(',')[0]}`, nameStyle);
      nameHeight = Math.max(nameHeight, measure.height);
      measure.destroy();
    }
    const grid = this.add.container(0, 0);
    c.add(grid);
    let pageControl: ReturnType<typeof pager> | null = null;
    const renderPage = (page: number): void => {
      grid.removeAll(true);
      pageControl?.container.destroy();
      const layout = duelRecapLayout(shell.contentBounds, rungCount, nameHeight, textScale, page);
      // Rendering every name after the portraits prevents later rows' art
      // from concealing the tail of a wrapped name in the compact grid.
      const names = this.add.container(0, 0);
      for (let index = 0; index < layout.visibleCount; index++) {
        const rung = layout.start + index + 1;
        const state = completed || rung < (failedRung ?? Number.POSITIVE_INFINITY) ? 'cleared'
          : rung === failedRung ? 'failed' : 'unreached';
        const slot = layout.slot(index);
        const stampOffset = layout.namesClearPortraits ? -4 : Math.max(-4, nameHeight - layout.labelClearance + 2);
        this.addGauntletRecapPortrait(grid, names, this.avatarForGauntletFloor(rung), rung,
          slot.x, slot.y, state, layout.cellScale, layout.labelWidth, stampOffset);
      }
      grid.add(names);
      grid.setData('a11yDensity', {
        actual: { id: 'duel-recap', rows: layout.rows, columns: layout.columns, pitch: layout.pitch, top: layout.y0 },
        release: { id: 'duel-recap', rows: 5, columns: 6, pitch: 70.4, top: 241.2 },
      });
      if (layout.pageCount > 1) {
        pageControl = pager(this, 596, layout.pagerY, layout.page, layout.pageCount, renderPage);
        c.add(pageControl.container);
      }
    };
    renderPage(initialPage);

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
    mk(510, 'Menu', 'ghost', () => this.scene.start('MainMenu'));
    mk(770, 'Tower', 'primary', () => this.scene.start('Gauntlet'));
    this.guard.open(this.overlayGuardTargets());
  }

  private addGauntletRecapPortrait(
    parent: Phaser.GameObjects.Container,
    names: Phaser.GameObjects.Container,
    avatar: Avatar,
    rung: number,
    x: number,
    y: number,
    state: 'cleared' | 'failed' | 'unreached',
    cellScale: number,
    labelWidth: number,
    stampOffset: number,
  ): void {
    const w = Math.round(92 * cellScale);
    const h = Math.round(112 * cellScale);
    const border = state === 'failed' ? colorInt(theme.colors.dangerArmed) : state === 'cleared' ? theme.graphics.panelStroke : theme.graphics.panelStroke;
    parent.add(
      this.add
        .rectangle(x, y, w, h, theme.graphics.panelFill, state === 'unreached' ? 0.45 : 0.82)
        .setStrokeStyle(state === 'failed' ? 3 : 1, border, state === 'unreached' ? 0.7 : 1),
    );

    const img = addPortraitArt(this, x, y - 6, avatar.portraitCardId, (image) => {
      image.setScale(Math.max((w - 12) / Math.max(1, image.width), (h - 26) / Math.max(1, image.height)));
    });
    if (img) {
      img.setAlpha(state === 'unreached' ? 0.22 : state === 'cleared' ? 0.56 : 0.95);
      const maskShape = this.add.rectangle(x, y - 6, w - 12, h - 26, 0xffffff).setVisible(false);
      img.setMask(maskShape.createGeometryMask());
      parent.add(maskShape);
      parent.add(img);
    }

    if (state === 'cleared') {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, theme.graphics.dim, 0.34));
      parent.add(
        this.add
          .text(x, y + stampOffset, '☠', {
            fontFamily: 'Georgia, serif',
            fontSize: `${Math.round(34 * cellScale)}px`,
            color: theme.colors.heading,
          })
          .setOrigin(0.5)
          .setAlpha(0.86),
      );
    } else if (state === 'failed') {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, colorInt(theme.colors.dangerBg), 0.48));
      parent.add(
        this.add
          .text(x, y + stampOffset, 'FAILED', {
            fontFamily: theme.fonts.ui,
            fontSize: `${duelHudType(13, 'label')}px`,
            fontStyle: '800',
            color: theme.colors.danger,
          })
          .setOrigin(0.5),
      );
    } else {
      parent.add(this.add.rectangle(x, y, w - 10, h - 12, theme.graphics.dim, 0.5));
    }

    const name = this.add
        // Short display name: epithets after a comma are dropped so the recap
        // reads "R7 Yohime", not "R7 Yohime, Kitsune Matriarch" (playtest
        // 2026-07-16). Comma-less names (Hestia, The Morrigan) pass through.
        .text(x, y + h / 2 + 8, `R${rung} ${avatar.name.split(',')[0]}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: '700',
          color: state === 'failed' ? theme.colors.danger : state === 'cleared' ? theme.colors.body : theme.colors.muted,
          align: 'center',
          wordWrap: { width: labelWidth },
        })
        .setOrigin(0.5, 0).setData('a11yKeepVisible', true);
    name.setData('a11yFullText', name.text);
    const plate = this.add.rectangle(x, name.y + name.height / 2, name.width + 4, name.height, theme.graphics.panelFill);
    names.add([plate, name]);
  }
}
