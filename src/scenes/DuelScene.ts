import Phaser from 'phaser';
import type { AIPlayer } from '../ai/AIPlayer';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { buildAI } from '../ai/personality';
import { ECONOMY, RULES } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { tutorialCue, type TutorialCueInput, type TutorialCueKind } from '../data/tutorial';
import { avatarById, avatarForRung, type Avatar } from '../data/opponents';
import { heroById } from '../data/heroes';
import type { SaveData } from '../meta/SaveManager';
import { STARTER_DECKS } from '../data/starterDecks';
import { applyGauntletResult, applyMatchResult, todayString, type Difficulty } from '../meta/Economy';
import { ownedVariantEntries } from '../meta/collectionFilter';
import { rungSeed } from '../meta/gauntletSeed';
import { Services } from '../meta/services';
import { forcedAction, reasonUncastable, type Action } from '../engine/actions';
import { previewCombat } from '../engine/combat/damage';
import { eligibleAttackers, blockOptions } from '../engine/combat/legality';
import type { GameEvent } from '../engine/events';
import { Game } from '../engine/Game';
import { manaSources } from '../engine/mana';
import { getEffectiveStats, isSummoningSick } from '../engine/statics';
import type { CardDef, Color, PlayerId, Permanent, TargetRef } from '../engine/types';
import { def, isType } from '../engine/types';
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
import { CommanderPortrait } from '../ui/CommanderPortrait';
import { fanLayout } from '../ui/handFan';
import { handDisplayOrder } from '../ui/handSort';
import { HistoryPanel } from '../ui/HistoryPanel';
import { LandStackView, LAND_STACK_STEP } from '../ui/LandStackView';
import { ModalGuard } from '../ui/Modal';
import { PileView } from '../ui/PileView';
import { applyBackdrop } from '../ui/SceneBackdrop';

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
 * a full-width opponent strip on top (identity, life, hand backs, piles,
 * mana), two inset battlefield zone plates (each holding its land row at the
 * outer edge and its creature row at the inner edge, Arena-style), a phase
 * rail on the left edge, the HistoryPanel tab on the right edge, and a
 * bottom stage: commander portrait (bottom-left), arced hand fan (center),
 * smart-button cluster + piles (right). The old full-width band fills and
 * gold phase seam are gone — the backdrop art shows through.
 */
const LAYOUT = {
  /** Opponent strip: everything vertically centered on cy. */
  strip: { y0: 0, y1: 56, cy: 28 },
  oppZone: { y0: 60, y1: 306 },
  // x0 210 mirrors myLands: it keeps the first stack's thumb off the
  // "OPPONENT" plate label at (118, 66) (adversarial review 2026-07-04).
  oppLands: { cy: 96, x0: 210 },
  oppCreatures: { cy: 214 },
  /** Between the zone plates: skip toast + stack readout float here. */
  gap: { cy: 298 },
  myZone: { y0: 312, y1: 532 },
  myCreatures: { cy: 386 },
  // cy 484 is load-bearing: the LandStackView badge sits at pile-local y+24
  // (≈508) tuned to clear the resting hand fan (see LandStackView.ts). x0 210
  // keeps the first stack's inflated 90px hit rect clear of the phase rail's
  // hint/log column and the life total on the portrait corner.
  myLands: { cy: 484, x0: 210 },
  // restY is computed in syncHand to anchor the fan's bottom near y=714 for
  // the active scale; the hover lift is computed per card so the raised
  // zone's bottom edge matches the resting zone's (no orphaned-pointer
  // flicker band — adversarial review 2026-07-04).
  /** Commander portrait frame (top-left anchored, rises from screen bottom). */
  portrait: { x: 14, y: 540, w: 200, h: 180 },
  /** Your life rides the portrait's top-left corner (burn target). */
  myLife: { x: 44, y: 566 },
  /** Right-side control cluster: auto-skip chip · ⏭ End Turn chip · smart button (top→bottom). */
  cluster: { x: 1108, autoSkipY: 452, endTurnY: 548, passY: 642, passR: 46 },
  /** Your deck/grave piles, right column above Concede. */
  piles: { x: 1242, deckY: 552, graveY: 622 },
} as const;

const BOARD_CENTER_X = 640;
/** Cast-targeting arrow: source anchor (hand-rest, bottom-center), snap radius, color. */
const TARGET_ARROW_SRC = { x: BOARD_CENTER_X, y: 700 };
const TARGET_SNAP_R = 60;
const TARGET_ARROW_COLOR = 0xffd166;
/** Width available to a creature row (rows are centered on BOARD_CENTER_X, inside the zone plates). */
const ROW_USABLE = 1000;
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
  private undoBtn!: Phaser.GameObjects.Text;
  /** Live combat-damage forecast shown while you assign blocks (F12). */
  private combatPreviewText!: Phaser.GameObjects.Text;
  private ai!: AIPlayer;
  private difficulty: Difficulty = 'easy';
  private opponent: Avatar | null = null; // set in gauntlet mode
  private gauntletRung: number | null = null;
  private views = new Map<number, BoardCardView>(); // battlefield iid → tile
  private handViews: CardView[] = [];
  private handDecor: Phaser.GameObjects.GameObject[] = [];
  private landStacks: LandStackView[] = [];
  private manaPips: Phaser.GameObjects.GameObject[] = [];
  private hud!: {
    myLife: Phaser.GameObjects.Text;
    oppLife: Phaser.GameObjects.Text;
    /** Phase rail (left edge): turn pill + phase pill + whose-turn tag. */
    turnPill: Phaser.GameObjects.Text;
    phase: Phaser.GameObjects.Text;
    ownerTag: Phaser.GameObjects.Text;
    log: Phaser.GameObjects.Text;
    /** Smart-button label; input lives on `passArc` (the circle is the button). */
    button: Phaser.GameObjects.Text;
    hint: Phaser.GameObjects.Text;
    stack: Phaser.GameObjects.Text;
  };
  /** The circular smart button (wireframe 1a "PASS"); relabeled per decision. */
  private passArc!: Phaser.GameObjects.Arc;
  /** Deck/grave pile indicators + opponent hand card-backs (wireframe 1a). */
  private oppDeckPile!: PileView;
  private oppGravePile!: PileView;
  private oppHandBacks!: PileView;
  private myDeckPile!: PileView;
  private myGravePile!: PileView;
  /** Bottom-left commander portrait — the player's deck face card, reactive. */
  private portrait!: CommanderPortrait;
  /** Derived identity (create()): portraits cost zero new art (opponents.ts idiom). */
  private myDeckName = '';
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
  /** Graveyard-target chooser (Raise Dead etc.): pick which creature to return. */
  private gravePicker: Phaser.GameObjects.Container | null = null;
  private gravePickerGuard = new ModalGuard();
  /** Two-tap concede guard (settings.confirmDestructive); armed by the first tap. */
  private concedeArmed = false;
  private discardPicks = new Set<number>();
  /**
   * Optional first-launch tutorial mode (src/data/tutorial.ts). When set, this
   * duel runs a scripted line (fixed decks + seed + `ScriptAI`) under a
   * coach-mark guide; auto-skip is off and results route to `tutorialComplete`
   * instead of the ranked win/loss path.
   */
  private tutorial = false;
  private coach: CoachMark | null = null;
  private tutGoalShown = false;
  private tutSicknessShown = false;
  /** Set once the human confirms a real block — the last taught beat. */
  private tutBlocked = false;
  private tutCompleted = false;
  /** A tap-to-continue info card is up; the guide waits for its dismissal. */
  private coachInfoActive = false;
  private aiTimer: Phaser.Time.TimerEvent | null = null;
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
  private autoToggle!: Phaser.GameObjects.Text;
  /** transient center banner shown on each turn change (self-destroys). */
  private turnBanner?: Phaser.GameObjects.Container;
  /** transient reveal of the card the OPPONENT just cast (self-destroys). */
  private oppCastReveal?: Phaser.GameObjects.Container;

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
    } = {},
  ): void {
    // Gauntlet mode: an avatar opponent drives the deck, difficulty, and brain
    // personality. Practice mode leaves opponent null and uses the plain AI.
    this.opponent = data.opponentId ? avatarById(data.opponentId) : null;
    this.gauntletRung = data.gauntletRung ?? null;
    this.difficulty = this.opponent?.difficulty ?? data.difficulty ?? 'easy';
    this.tutorial = data.tutorial ?? false;
    this.tutGoalShown = false;
    this.tutSicknessShown = false;
    this.tutBlocked = false;
    this.tutCompleted = false;
    this.coachInfoActive = false;
    this.coach = null;
    this.views = new Map();
    this.handViews = [];
    this.handDecor = [];
    this.landStacks = [];
    this.manaPips = [];
    this.selectedAttackers = new Set();
    this.blockAssignments = [];
    this.pendingBlocker = null;
    this.undoSnapshot = null;
    this.overlay = null;
    this.guard = new ModalGuard();
    this.inspect = null;
    this.inspectGuard = new ModalGuard();
    this.inspectMove = null;
    this.discardPicks = new Set();
    // Stale on gauntlet/rematch restarts: the scene clock died with the old
    // run, so a still-set handle would block auto-skip forever. The clock also
    // resets to 0 on restart, so clear the guard timestamp with it.
    this.autoSkipTimer = null;
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
      onStickyTap: (card) => {
        if (this.pendingCasts) this.zoom.dismissSticky();
        else this.showInspect(card);
      },
    });
    setStickyHost(this, this.zoom);

    this.buildZones();
    this.arrows = this.add.graphics().setDepth(50);

    const save = Services.save.data;
    // Tower (gauntlet) duels derive their seed from the run's fixed seed, so the
    // whole run is one reproducible playthrough (src/meta/gauntletSeed.ts);
    // practice duels stay freshly random each time.
    const seed =
      data.seedOverride ??
      (this.gauntletRung != null && save.gauntlet.run
        ? rungSeed(save.gauntlet.run.seed, this.gauntletRung)
        : Math.floor(Math.random() * 2 ** 31));
    const myDeckEntry = save.decks.find((d) => d.id === save.activeDeckId);
    const myDeck = data.deckOverride ?? myDeckEntry?.cards ?? STARTER_DECKS[0].cards;
    // Gauntlet: the avatar pilots its themed deck. Practice: the AI pilots a
    // starter the player is NOT using (or the second one). Tutorial: a fixed deck.
    const aiDeck =
      data.oppDeckOverride ??
      (this.opponent
        ? this.opponent.deck
        : (STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards));
    // Duel identities, the opponents.ts "portraits cost zero new art" idiom:
    // your commander portrait is your deck's face card; the opponent's strip
    // avatar is their curated portraitCardId (gauntlet) or their deck's face.
    this.myDeckName = myDeckEntry?.name ?? STARTER_DECKS[0].name;
    // A bought theme deck's PREMIUM hero portrait takes precedence; otherwise
    // your chosen hero card (any collected card) fronts the commander portrait;
    // otherwise the active deck's derived face.
    this.myHeroTextureKey = this.resolveHeroPortrait(save);
    const hero = save.heroCardId && CARD_DB[save.heroCardId] ? save.heroCardId : null;
    this.myFaceCardId = hero ?? faceCardFor(myDeck, CARD_DB);
    this.oppFaceCardId = this.opponent?.portraitCardId ?? faceCardFor(aiDeck, CARD_DB);
    this.duel = new Game({ decks: [myDeck, aiDeck], seed, db: CARD_DB });
    this.ai = data.aiOverride ?? buildAI(this.difficulty, CARD_DB, seed ^ 0x5eed, this.opponent?.personality);

    this.buildHud();
    this.bindHotkeys();
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
    if (this.tutorial) {
      // The coach-mark guide layer; the ⏩ auto-skip chip is meaningless here
      // (auto-skip is disabled in tutorial), so hide it to keep the stage clean.
      this.coach = new CoachMark(this);
      this.autoToggle.setVisible(false);
    }
    this.processEvents(this.duel.initialEvents);
    if (this.tutorial) this.autoKeepTutorialMulligans();
    this.sync();
    this.maybeRunAI();
    this.maybeAutoSkip();
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
   * and AI moves all re-evaluate it. Info beats (goal / sickness) pause the
   * guide on a tap-to-continue card; action beats spotlight a live control.
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
        return;
      case 'goal':
      case 'sickness': {
        const isGoal = cue.kind === 'goal';
        this.coachInfoActive = true;
        this.coach.hide();
        this.coach.showInfoCard(cue.text, () => {
          this.coachInfoActive = false;
          if (isGoal) this.tutGoalShown = true;
          else this.tutSicknessShown = true;
          this.tutorialTick();
        });
        return;
      }
      default: {
        const target = this.tutorialTarget(cue.kind);
        if (target) this.coach.showCue(target, cue.text);
        else this.coach.hide();
      }
    }
  }

  private buildTutorialInput(): TutorialCueInput {
    const st = this.duel.state;
    const a = this.duel.awaiting;
    const isHumanTurn = 'player' in a && a.player === HUMAN;
    const you = st.players[HUMAN];
    const legal = isHumanTurn ? this.duel.legalActions(HUMAN) : [];
    const handHasLand = you.hand.some((id) => isType(def(CARD_DB, id), 'land'));
    const hasCastableCreature = legal.some(
      (l) => l.type === 'castSpell' && isType(def(CARD_DB, you.hand[l.handIndex]), 'creature'),
    );
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
      goalShown: this.tutGoalShown,
      sicknessShown: this.tutSicknessShown,
      blocked: this.tutBlocked,
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
      case 'playCreature': {
        const castable = new Set(
          this.duel
            .legalActions(HUMAN)
            .filter((l): l is Extract<Action, { type: 'castSpell' }> => l.type === 'castSpell')
            .map((l) => l.handIndex),
        );
        return this.handTarget((d, handIdx) => castable.has(handIdx) && isType(d, 'creature'));
      }
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
    this.coach?.destroy();
    this.coach = null;
    this.closeInspect();
    const save = Services.save.data;
    const firstTime = !save.tutorialDone;
    save.tutorialDone = true;
    if (firstTime) save.gold += ECONOMY.starterDeckPrice; // enough to buy one starter deck
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
        .text(width / 2, 312, "You've got the basics — now build your collection.", {
          fontFamily: 'Inter, Arial, sans-serif', fontSize: '18px', color: '#c9bde0',
        })
        .setOrigin(0.5),
    );
    if (firstTime) {
      c.add(
        this.add
          .text(width / 2, 356, `+${ECONOMY.starterDeckPrice} gold`, {
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
    mk(width / 2 - 120, 'To the Shop', () => this.scene.start('Shop'));
    mk(width / 2 + 120, 'Main Menu', () => this.scene.start('MainMenu'));
    this.guard.open(this.overlayGuardTargets());
  }

  /** Stage dressing: opponent strip plate + the two inset battlefield plates. */
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
      dim: 0x0a0812,
      dimAlpha: 0.55,
      fallback: () => {
        const base = this.add.graphics();
        base.fillGradientStyle(0x131022, 0x131022, 0x0a0812, 0x0a0812, 1);
        base.fillRect(0, 0, width, height);
      },
    });

    const g = this.add.graphics();

    // Opponent strip: the one remaining full-width plate.
    g.fillStyle(0x1d1636, 0.9);
    g.fillRect(0, LAYOUT.strip.y0, width, LAYOUT.strip.y1 - LAYOUT.strip.y0);
    g.fillStyle(0x2e2749, 0.5);
    g.fillRect(0, LAYOUT.strip.y1, width, 1);

    // Two inset battlefield zone plates (1a: the stage shows around them).
    // Yours a touch brighter — "this side is you".
    const plate = (y0: number, y1: number, fill: number, alpha: number): void => {
      g.fillStyle(fill, alpha);
      g.fillRoundedRect(108, y0, 1064, y1 - y0, 10);
      g.lineStyle(1, 0x2e2749, 0.7);
      g.strokeRoundedRect(108, y0, 1064, y1 - y0, 10);
    };
    plate(LAYOUT.oppZone.y0, LAYOUT.oppZone.y1, 0x1a1530, 0.45);
    plate(LAYOUT.myZone.y0, LAYOUT.myZone.y1, 0x1c1734, 0.5);

    const label = (x: number, y: number, text: string): void => {
      this.add.text(x, y, text, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '10px',
        fontStyle: '700',
        color: '#6f6690',
        resolution: 2,
      });
    };
    label(118, LAYOUT.oppZone.y0 + 6, 'OPPONENT');
    label(118, LAYOUT.myZone.y0 + 6, 'YOU');
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

  private buildHud(): void {
    // --- Opponent strip (1a): name · avatar · life · hand backs · piles · mana ---
    const stripCy = LAYOUT.strip.cy;
    const oppLabel = this.opponent
      ? `${this.gauntletRung ? `Rung ${this.gauntletRung} — ` : ''}vs ${this.opponent.name}`
      : `Practice — vs ${this.difficulty} AI`;
    this.add
      .text(14, stripCy, oppLabel, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '15px',
        color: '#c7a8f0',
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    this.addAvatarDisc(284, stripCy, this.oppFaceCardId);
    this.oppHandBacks = new PileView(this, 430, stripCy - 2, 'handbacks', { miniW: 20, miniH: 28 });
    this.oppDeckPile = new PileView(this, 522, stripCy - 6, 'deck', { miniW: 22, miniH: 31 });
    this.oppGravePile = new PileView(this, 586, stripCy - 6, 'grave', { miniW: 22, miniH: 31 });
    // --- Your piles: right column above Concede ---
    this.myDeckPile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.deckY, 'deck');
    this.myGravePile = new PileView(this, LAYOUT.piles.x, LAYOUT.piles.graveY, 'grave');
    // --- Commander portrait (1a): your deck's face card, reacts to the game ---
    this.portrait = new CommanderPortrait(this, LAYOUT.portrait.x, LAYOUT.portrait.y, {
      width: LAYOUT.portrait.w,
      height: LAYOUT.portrait.h,
      cardId: this.myFaceCardId,
      ...(this.myHeroTextureKey ? { textureKey: this.myHeroTextureKey } : {}),
      label: this.myDeckName,
    });
    // Your life rides the portrait's top-left corner on a legibility disc.
    this.add
      .circle(LAYOUT.myLife.x, LAYOUT.myLife.y, 27, 0x1d1636, 0.92)
      .setStrokeStyle(1.5, 0x3a2f5c, 1);

    this.hud = {
      // Life totals are BURN TARGETS: depth 56 makes them win Phaser's
      // depth-first input sort over the land stacks (depth 0, re-appended
      // every sync) whose inflated rects can share a band with them — e.g.
      // an opponent stack near x330 would otherwise swallow face-burn taps
      // (adversarial-review major, 2026-07-04). No visual overlap exists.
      oppLife: this.add
        .text(330, stripCy, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#f08a8a',
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(56),
      myLife: this.add
        .text(LAYOUT.myLife.x, LAYOUT.myLife.y, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#9be6a8',
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(56),
      // --- Phase rail (left margin, x<104): turn/phase pills, owner tag,
      // terse hint, truncated log. Everything is centered at x52 or wraps at
      // ≤92px from x8 so no text can cross the zone plate's left edge (x108)
      // or shadow the "YOU" label (user layout feedback 2026-07-04).
      turnPill: this.add
        .text(52, 250, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '14px',
          color: '#e8def7',
          backgroundColor: '#241c3e',
          padding: { x: 10, y: 4 },
          resolution: 2,
        })
        .setOrigin(0.5),
      phase: this.add
        .text(52, 286, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '13px',
          color: '#e8def7',
          backgroundColor: '#241c3e',
          padding: { x: 8, y: 4 },
          resolution: 2,
        })
        .setOrigin(0.5),
      ownerTag: this.add
        .text(52, 314, '', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '9px',
          fontStyle: '700',
          color: '#6f6690',
          resolution: 2,
        })
        .setOrigin(0.5),
      hint: this.add.text(8, 344, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        color: '#a89cc6',
        resolution: 2,
        align: 'center',
        fixedWidth: 96,
        wordWrap: { width: 92 },
      }).setOrigin(0, 0),
      log: this.add.text(8, 452, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '10px',
        color: '#948aba',
        resolution: 2,
        align: 'center',
        fixedWidth: 96,
        wordWrap: { width: 92 },
      }).setOrigin(0, 0),
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
      stack: this.add
        .text(250, LAYOUT.gap.cy, '', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '12px',
          color: '#c7a8f0',
          align: 'center',
          backgroundColor: '#1c1730',
          padding: { x: 8, y: 4 },
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(55)
        .setVisible(false)
        .setInteractive({ useHandCursor: true }),
    };
    // The circular smart button (1a "PASS"): the Arc carries the input, the
    // label Text above it never does — so relabeling via setText can't hit the
    // Text.updateText hit-area trap, and the circle's default 92×92 hit rect
    // already meets the 90px touch floor without inflation.
    this.passArc = this.add
      .circle(LAYOUT.cluster.x, LAYOUT.cluster.passY, LAYOUT.cluster.passR, 0x2c2344, 0.95)
      .setStrokeStyle(2.5, 0xffd88a, 0.9)
      // With the End Turn chip and skip toast family: above arrows (50) and
      // the stack readout (55) is unnecessary here, but keeping the control
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
    // clicking/tapping the stack targets its TOP item (counterspells)
    bindTapButton(this, this.hud.stack, () => {
      const top = this.duel.state.stack.at(-1);
      if (top) this.tryTarget({ kind: 'stackItem', sid: top.sid });
    });
    // life totals are targetable (burn to the face)
    for (const [text, player] of [
      [this.hud.myLife, HUMAN],
      [this.hud.oppLife, AI],
    ] as const) {
      text.setInteractive({ useHandCursor: true });
      bindTapButton(this, text, () => this.tryTarget({ kind: 'player', player }));
    }
    // Hit inflation (mobile-lan-plan §1.4). Life totals get the full 90; the
    // stack readout keeps a 44px height so its inflated rect (it renders at
    // depth 55, ABOVE the tiles) overlaps the creature rows (opp bottom 287,
    // yours top 313) by only ~11px at the zone-gap seam. Texts that change
    // per sync are re-inflated there — Phaser never refreshes hit areas
    // itself. The smart button needs none: the Arc's hit rect is static.
    // oppLife sits at strip cy 28: an unbiased 90px rect would poke 17px
    // above the canvas (unreachable + Android notification-pull zone), so
    // bias it down to span y 3–93 — all 90px tappable.
    inflateHitArea(this.hud.stack, 90, 44);
    inflateHitArea(this.hud.myLife, 90, 90);
    inflateHitArea(this.hud.oppLife, 90, 90, { biasY: 20 });
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
        color: '#ffd88a',
        stroke: '#0a0812',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setAlpha(0);

    // Feature 2 — "⏭ End Turn" quick button: fast-forwards the rest of your turn
    // (see startEndTurn). Sits in the right cluster above the smart button
    // (their inflated rects end 593 / start 596 — close but disjoint); only
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
    // decision — before priority passes to the AI or combat animates. Left rail,
    // between the hint and the log; syncUndoButton toggles its visibility.
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

    // Combat forecast (F12): a live damage/deaths preview shown center-top while
    // you assign blocks; syncCombatPreview updates it and toggles its visibility.
    this.combatPreviewText = this.add
      .text(640, 100, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: '#cbc2e0',
        backgroundColor: '#1a1430',
        padding: { x: 10, y: 4 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setVisible(false);

    // Feature 2 — live auto-skip toggle (mirrors settings.autoSkip; persists).
    // Sits at the TOP of the right-side turn cluster (auto-skip → End Turn →
    // smart button), so all turn controls read as one group. Its 90px hit rect
    // (centred at autoSkipY 452 → 407–497) stays disjoint from the End Turn
    // chip's (centred 548 → 503–593).
    this.autoToggle = this.add
      .text(LAYOUT.cluster.x, LAYOUT.cluster.autoSkipY, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: '#cbc2e0',
        backgroundColor: '#241c3e',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      // Keeps the control-cluster depth (56) so nothing transient can shadow
      // it. Below overlays (>=100).
      .setDepth(56)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, this.autoToggle, (p) => {
      if (p.rightButtonReleased()) return;
      const s = Services.save.data.settings;
      s.autoSkip = !s.autoSkip;
      Services.save.touch();
      this.syncAutoToggle();
      if (s.autoSkip) this.maybeAutoSkip(); // catch up if a skippable decision is live
    });
    inflateHitArea(this.autoToggle, 90, 90);
    this.syncAutoToggle();
  }

  /**
   * Circular opponent avatar in the strip (1a): card art cover-fit into a
   * ringed disc, biased toward the face band. Falls back to the empty ring
   * if the art is missing (GauntletScene.addPortrait idiom — never crashes).
   * Non-interactive, so it can sit inside the life total's inflated hit rect.
   */
  private addAvatarDisc(x: number, y: number, cardId: string | null): void {
    const r = 21;
    this.add.circle(x, y, r + 2, 0x1d1636, 0.95).setStrokeStyle(1.5, 0x8a6d1f, 0.9);
    if (!cardId) return;
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const img = this.add.image(x, y, ref.textureKey, ref.frameName);
      // Cover the disc, then bias up ~15% of the frame toward the face; the
      // circle mask crops the overflow. Mask shapes use world coordinates —
      // fine here, the disc never moves.
      const scale = Math.max((r * 2) / img.width, (r * 2) / img.height) * 1.7;
      img.setScale(scale);
      img.y = y - r * 0.25;
      const maskShape = this.add.circle(x, y, r, 0xffffff).setVisible(false);
      img.setMask(maskShape.createGeometryMask());
    } catch {
      // no art — the ring alone is an acceptable fallback
    }
  }

  /** Reflect settings.autoSkip on the in-duel toggle chip. */
  private syncAutoToggle(): void {
    const on = Services.save.data.settings.autoSkip;
    this.autoToggle
      .setText(on ? '⏩ Auto-skip: On' : '⏩ Auto-skip: Off')
      .setColor(on ? '#9be6a8' : '#a89cc6');
    // setText resizes the Text but Phaser never refreshes its hit area — regrow it.
    inflateHitArea(this.autoToggle, 90, 90);
  }

  // ---------------------------------------------------------------------
  // Action submission + AI loop
  // ---------------------------------------------------------------------

  private isHumanTurnDecision(): boolean {
    const a = this.duel.awaiting;
    return 'player' in a && a.player === HUMAN;
  }

  private act(action: Action): void {
    if (this.ended) return;
    if (this.animatingCombat) return; // swallow input while a combat sequence plays
    try {
      const snapshot = this.duel.clone(); // pre-action state; kept for Undo iff still local
      const events = this.duel.submit(HUMAN, action);
      // Tutorial: a real block is the final taught beat — mark it so the guide
      // advances to completion on the next tick.
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
      this.hud.log.setText(String((err as Error).message));
    }
  }

  /** Restore the pre-action snapshot and reset scene-side selection state. */
  private undoLastAction(): void {
    if (!this.undoSnapshot || this.ended || this.animatingCombat) return;
    this.duel = this.undoSnapshot;
    this.undoSnapshot = null;
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
      return;
    }
    const preview = previewCombat(st, CARD_DB, this.blockAssignments);
    const dmg = -preview.lifeDelta[HUMAN];
    const yoursDie = preview.deaths.filter(
      (iid) => st.battlefield.find((p) => p.iid === iid)?.controller === HUMAN,
    ).length;
    const theirsDie = preview.deaths.length - yoursDie;
    const parts = [dmg > 0 ? `you take ${dmg}` : 'no damage to you'];
    if (theirsDie || yoursDie) parts.push(`${theirsDie} enemy · ${yoursDie} yours die`);
    this.combatPreviewText
      .setText(preview.defenderLethal ? `⚠ LETHAL — ${parts.join(' · ')}` : `⚔ Forecast: ${parts.join(' · ')}`)
      .setColor(preview.defenderLethal ? '#ff8a8a' : '#cbc2e0')
      .setVisible(true);
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
    if (ended) this.narrateEvent(ended);
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
    if (this.ended) return;
    if (this.animatingCombat) return; // wait out a combat sequence; finishStep resumes us
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== AI) return;
    this.undoSnapshot = null; // priority has left you — the local Undo is no longer valid
    if (this.aiTimer) return;
    this.aiTimer = this.time.delayedCall(400, () => {
      this.aiTimer = null;
      if (this.ended || this.animatingCombat) return;
      const aw = this.duel.awaiting;
      if (!('player' in aw) || aw.player !== AI) return;
      const action = this.ai.chooseAction(this.duel.viewFor(AI), this.duel.legalActions(AI));
      const events = this.duel.submit(AI, action);
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
    if (this.tutorial) return; // the coach-mark guide drives pacing explicitly
    if (this.endingTurn) return; // end-turn mode drives its own hops (endTurnTick)
    if (!Services.save.data.settings.autoSkip) return; // settings toggle (SettingsScene)
    if (this.ended) return;
    if (this.animatingCombat) return; // hold until the combat sequence finishes
    if (this.autoSkipTimer) return; // a hop is already scheduled
    if (this.overlay || this.inspect || this.pendingCasts) return;
    if (!this.isHumanTurnDecision()) return;
    if (!forcedAction(this.duel.state, CARD_DB, HUMAN)) return;
    this.autoSkipTimer = this.time.delayedCall(300, () => {
      this.autoSkipTimer = null;
      if (this.ended) return;
      if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay) return;
      if (!this.isHumanTurnDecision()) return;
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
        return 'Main phase skipped — no playable cards';
      case 'declareAttackers':
        return 'Combat skipped — no able attackers';
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
    if (this.pendingCasts || this.overlay || this.inspect || this.pauseOverlay) return;
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
    if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay) return;
    if (!this.isHumanTurnDecision()) return;
    if (!this.endTurnPassAction()) return; // pause at a decision needing real input
    this.endTurnTimer = this.time.delayedCall(180, () => {
      this.endTurnTimer = null;
      if (!this.endingTurn || this.ended) {
        this.endingTurn = false;
        return;
      }
      // Re-check fresh — the player may have opened an overlay during the wait.
      if (this.overlay || this.inspect || this.pendingCasts || this.pauseOverlay) return;
      if (!this.isHumanTurnDecision()) return;
      const action = this.endTurnPassAction();
      if (!action) return;
      this.act(action); // act() re-runs endTurnTick: the chain continues hop by hop
    });
  }

  /**
   * The pass action for the current human decision while ending the turn, or
   * null to STOP-AND-WAIT (a declare-attackers you could act on, or a mandatory
   * pick like discard/bottom/mulligan). Blockers never arise on your own turn.
   */
  private endTurnPassAction(): Action | null {
    const a = this.duel.awaiting;
    if (!('player' in a) || a.player !== HUMAN) return null;
    switch (a.kind) {
      case 'main':
        return { type: 'passStep' };
      case 'declareAttackers':
        // "Stop if I can attack": pause when you have any eligible attacker.
        if (eligibleAttackers(this.duel.state.battlefield, CARD_DB, HUMAN).length > 0) return null;
        return { type: 'declareAttackers', attackers: [] };
      case 'respond':
      case 'endStepWindow':
        return { type: 'passResponse' };
      default:
        return null; // mulligan / bottomCards / discardToHandSize → stop for input
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
    const sequence =
      Services.save.data.settings.animations === 'full' &&
      !this.animatingCombat &&
      events.some((e) => e.e === 'combatDamage' && e.hits.length > 0);
    if (sequence) {
      this.playCombatSequence(events);
      return;
    }
    for (const e of events) this.narrateEvent(e);
  }

  /** Narrate a single event: SFX, floats, log, portrait reactions, attack FX. */
  private narrateEvent(e: GameEvent): void {
    switch (e.e) {
      case 'lifeChanged': {
        if (e.delta < 0) Sfx.play('lifeLoss');
        // Spawn near the owner's life total (floats draw at depth 90, so
        // they read over the strip/portrait as they drift up and fade).
        const pos = e.player === HUMAN ? { x: 44, y: 534 } : { x: 330, y: 50 };
        this.float(pos.x, pos.y, `${e.delta > 0 ? '+' : ''}${e.delta}`, e.delta > 0 ? '#9be6a8' : '#f08a8a');
        // The commander reacts to your pain (1a "waifu reacts to damage").
        if (e.player === HUMAN && e.delta < 0) this.portrait.reactDamage();
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
          this.log(`${who} ${def(CARD_DB, e.cardId).name} died`, e.cardId);
        }
        break;
      }
      case 'spellCast':
        Sfx.play('cast');
        this.log(`${e.controller === HUMAN ? 'You cast' : 'Opponent casts'} ${def(CARD_DB, e.cardId).name}`, e.cardId);
        // The commander cheers your plays (1a "waifu reacts to plays"); the
        // opponent's cast is hidden from hand, so flash the card so the player
        // can actually see what was played.
        if (e.controller === HUMAN) this.portrait.reactCast();
        else this.showOpponentCast(e.cardId);
        break;
      case 'spellCountered':
        this.log('Spell cancelled!');
        break;
      case 'targetsFizzled':
        this.log('Spell fizzled — no legal targets');
        break;
      case 'landPlayed':
        Sfx.play('land');
        if (e.player === AI) this.log(`Opponent plays ${def(CARD_DB, e.cardId).name}`, e.cardId);
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
      case 'turnBegan':
        this.log(`Turn ${e.turn} — ${e.player === HUMAN ? 'your' : "opponent's"} turn`);
        this.showTurnBanner(e.turn, e.player === HUMAN);
        break;
      case 'mulliganTaken':
        if (e.player === AI) this.log('Opponent takes a mulligan');
        break;
      case 'gameEnded':
        this.ended = true;
        this.showResults(e.winner === HUMAN, e.reason);
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
        this.float(targetPos.x, targetPos.y, `-${hit.amount}`, '#f08a8a');
        if (hit.target.player === HUMAN) this.portrait.reactDamage();
      } else {
        Sfx.play('hit');
        this.float(targetPos.x, targetPos.y - 40, `-${hit.amount}`, '#ffb04a');
      }
    }
    for (const iid of step.deaths) {
      Sfx.play('death');
      const info = diedInfo.get(iid);
      if (info) this.log(`${info.owner === HUMAN ? 'Your' : 'Enemy'} ${def(CARD_DB, info.cardId).name} died`, info.cardId);
    }
  }

  private log(msg: string, cardId?: string): void {
    // The rail's log slot is a narrow (96px) column — long card names would
    // wrap into a tall block. Truncate for the rail; the History panel keeps
    // the full line (and, given a cardId, makes the row tappable to inspect it).
    this.hud.log.setText(msg.length > 40 ? msg.slice(0, 39) + '…' : msg);
    this.history?.push(msg, cardId);
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
    const who = isYou ? 'Your Turn' : `${this.opponent?.name ?? 'Opponent'}'s Turn`;
    const accent = isYou ? '#9be6a8' : '#f0a0c0';
    const banner = this.add.container(BOARD_CENTER_X, 340).setDepth(85).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 340, 66, 0x140f24, 0.82).setStrokeStyle(1.5, 0x3a2f5c);
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
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
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
    const reveal = this.add.container(BOARD_CENTER_X, 310).setDepth(86).setAlpha(0);
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
      // Face damage detonates ON the life total (strip cy for the opponent).
      return ref.player === HUMAN
        ? { x: LAYOUT.myLife.x, y: LAYOUT.myLife.y }
        : { x: 330, y: LAYOUT.strip.cy };
    }
    return { x: BOARD_CENTER_X, y: LAYOUT.gap.cy };
  }

  // ---------------------------------------------------------------------
  // Declarative sync of the whole board
  // ---------------------------------------------------------------------

  private sync(): void {
    const st = this.duel.state;

    // HUD numbers
    this.hud.myLife.setText(`♥ ${st.players[HUMAN].life}`);
    this.hud.oppLife.setText(`♥ ${st.players[AI].life}`);
    this.oppHandBacks.setCount(st.players[AI].hand.length);
    this.oppDeckPile.setCount(st.players[AI].deck.length);
    this.oppGravePile.setCount(st.players[AI].graveyard.length);
    this.myDeckPile.setCount(st.players[HUMAN].deck.length);
    this.myGravePile.setCount(st.players[HUMAN].graveyard.length);
    // setText resizes a Text but Phaser never refreshes its hit area — keep
    // the inflated burn-target rects (plan §1.4) tracking the new glyphs
    // (same biasY as buildHud: keep the opp rect fully on-canvas).
    inflateHitArea(this.hud.myLife, 90, 90);
    inflateHitArea(this.hud.oppLife, 90, 90, { biasY: 20 });

    // Phase rail (1a left-edge pills): turn number, current step, whose turn.
    const stepNames: Record<string, string> = {
      untap: 'Untap', dawn: 'Dawn', draw: 'Draw', main1: 'Main 1',
      combat: 'Combat', main2: 'Main 2', end: 'End Step', cleanup: 'Cleanup',
    };
    const yours = st.turn !== 0 && st.activePlayer === HUMAN;
    this.hud.turnPill.setText(st.turn === 0 ? '—' : `T${st.turn}`);
    this.hud.phase
      .setText(st.turn === 0 ? 'Opening' : stepNames[st.step])
      .setColor(yours ? '#ffd88a' : '#b3a6d4');
    this.hud.ownerTag
      .setText(st.turn === 0 ? 'MULLIGANS' : yours ? 'YOUR TURN' : 'OPP TURN')
      .setColor(yours ? '#c9a44f' : '#6f6690');
    this.syncUndoButton();
    this.syncCombatPreview();

    // Battlefield tiles: every non-land permanent that isn't an attached aura
    // (attached auras show as a ✦ badge on their host — they had no board
    // presence at all before this layout).
    const seen = new Set<number>();
    const tiles = st.battlefield.filter(
      (p) => p.attachedTo === undefined && !isType(def(CARD_DB, p.cardId), 'land'),
    );
    for (const player of [AI, HUMAN] as const) {
      const row = tiles.filter((p) => p.controller === player);
      const y = player === AI ? LAYOUT.oppCreatures.cy : LAYOUT.myCreatures.cy;
      const n = row.length;
      // Cap spacing at the tapped-tile footprint (a 90° tap makes the tile
      // TILE_H wide) plus a small gutter, so tapped attackers don't collide.
      const MAX_SPACING = TILE_H + 4;
      const spacing = n > 1 ? Math.min(MAX_SPACING, (ROW_USABLE - TILE_W) / (n - 1)) : 0;
      const tileScale = n > 1 ? Math.min(1, (spacing + 14) / MAX_SPACING) : 1;
      row.forEach((perm, i) => {
        seen.add(perm.iid);
        const x = BOARD_CENTER_X - ((n - 1) * spacing) / 2 + i * spacing;
        const d = def(CARD_DB, perm.cardId);
        let view = this.views.get(perm.iid);
        if (!view) {
          view = new BoardCardView(this, x, y, d);
          // Depth 5 (still under hand cards at 10+): tiles are ACTION targets
          // and must win Phaser's depth-first input sort over the land stacks
          // (depth 0, re-appended every sync), whose inflated rects overlap
          // the tiles' bottom band (adversarial review 2026-07-04).
          view.setDepth(5);
          view.setScale(tileScale);
          view.setTapped(perm.tapped, false);
          // Show YOUR own special-variant cards with their holo finish in play
          // (the board doesn't track per-copy cosmetics, so use your best owned
          // variant of the card; opponents stay plain). Applied once at create;
          // a no-op for plain finishes, fxPolicy-gated inside setVariant.
          if (perm.controller === HUMAN) {
            const best = ownedVariantEntries(Services.save.data, perm.cardId)[0];
            view.setVariant(best ? best.variant : null);
          }
          view.enableInput();
          const iid = perm.iid;
          view.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch) return; // touch activates via the tap classifier
            if (!p.rightButtonReleased()) this.onBattlefieldClick(iid);
          });
          view.on('pointerdown', (p: Phaser.Input.Pointer) => {
            // p.button (initiating button of THIS press), not the live
        // rightButtonDown() bitmask — a chorded left press while the right
        // button is held must act as a left click, not open inspect.
        if (p.button === 2 && !this.pendingCasts) this.showInspect(d);
          });
          attachTouchGestures(this, view, {
            card: d, // long-press: sticky zoom preview
            onTap: () => this.onBattlefieldTap(iid, d),
          });
          this.zoom.attach(view, d);
          this.views.set(perm.iid, view);
          view.setAlpha(0);
          this.tweens.add({ targets: view, alpha: 1, duration: 200 });
        } else {
          this.tweens.add({
            targets: view,
            x,
            y: this.creatureY(perm.iid, y),
            scale: tileScale,
            duration: 200,
            ease: 'Cubic.easeOut',
          });
          view.setTapped(perm.tapped);
        }
        if (isType(d, 'creature')) {
          const stats = getEffectiveStats(st.battlefield, CARD_DB, perm.iid);
          const buffed = stats.attack > (d.attack ?? 0) || stats.defense > (d.defense ?? 0);
          const weakened = stats.attack < (d.attack ?? 0) || stats.defense < (d.defense ?? 0);
          view.setStats(
            stats.attack,
            stats.defense - perm.damage,
            perm.damage > 0 ? 'damaged' : buffed ? 'buffed' : weakened ? 'weakened' : 'normal',
          );
        }
        view.setAuraCount(perm.attachments.length);
        view.setHighlight(this.highlightFor(perm));
        // Summoning-sickness affordance (engine is source of truth: entered
        // this turn + no haste). Only creatures can be sick; the call resets
        // itself when sickness wears off at the controller's untap.
        view.setSummoningSick(
          isType(d, 'creature') && isSummoningSick(st.battlefield, CARD_DB, perm),
        );
      });
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

    this.syncLands(st.battlefield);
    this.syncManaPips();
    this.syncHand();
    this.syncButton();
    this.drawArrows();
    this.syncOverlay();
    if (this.tutorial) this.tutorialTick();
  }

  private creatureY(iid: number, base: number): number {
    // Lift kept modest: the 146px tile (TILE_H) nearly fills its zone plate,
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

  /** Lands render as per-type thumb stacks in each player's land row. */
  private syncLands(battlefield: readonly Permanent[]): void {
    for (const s of this.landStacks) s.destroy();
    this.landStacks = [];
    for (const player of [AI, HUMAN] as const) {
      const lands = battlefield.filter(
        (p) => p.controller === player && isType(def(CARD_DB, p.cardId), 'land'),
      );
      const groups = new Map<string, { total: number; untapped: number }>();
      for (const l of lands) {
        const g = groups.get(l.cardId) ?? { total: 0, untapped: 0 };
        g.total++;
        if (!l.tapped) g.untapped++;
        groups.set(l.cardId, g);
      }
      const y = player === AI ? LAYOUT.oppLands.cy : LAYOUT.myLands.cy;
      let x = player === AI ? LAYOUT.oppLands.x0 : LAYOUT.myLands.x0;
      for (const [cardId, g] of groups) {
        const d = def(CARD_DB, cardId);
        const stack = new LandStackView(this, x, y, d, g.total, g.untapped);
        stack.top.setInteractive({ useHandCursor: true });
        stack.top.on('pointerdown', (p: Phaser.Input.Pointer) => {
          // p.button (initiating button of THIS press), not the live
        // rightButtonDown() bitmask — a chorded left press while the right
        // button is held must act as a left click, not open inspect.
        if (p.button === 2 && !this.pendingCasts) this.showInspect(d);
        });
        // Touch: land stacks are action-less — tap = full inspect directly
        // (plan §1.3), except during targeting, where stray taps must stay
        // inert. Long-press previews. ~54px thumb inflates to the 90px
        // minimum; stacks sit 100px apart so inflated hits cannot overlap.
        attachTouchGestures(this, stack.top, {
          card: d,
          onTap: () => {
            if (!this.pendingCasts) this.showInspect(d);
          },
        });
        inflateHitArea(stack.top, 90, 90);
        this.zoom.attach(stack.top, d);
        this.landStacks.push(stack);
        x += LAND_STACK_STEP;
      }
    }
  }

  /**
   * "What can I cast" pips: for each color, how many of a player's untapped
   * mana sources could produce it right now (engine manaSources — public
   * info for BOTH players: untapped lands are on the battlefield; a flexible
   * source counts toward every color it can make, so the pips read
   * availability per color, not a summed total). Yours sit above the smart
   * button; the opponent's live in the strip (1a "opp mana").
   */
  private syncManaPips(): void {
    for (const o of this.manaPips) o.destroy();
    this.manaPips = [];
    // Your row ends at 1148 (was 1180): the old end poked past the zone
    // plate's right edge (1172) and its "AVAILABLE MANA" label ran toward the
    // History tab; 1148 keeps the whole readout inside the plate.
    this.buildManaRow(HUMAN, 1148, LAYOUT.myLands.cy, 54, 22, true);
    this.buildManaRow(AI, 1010, LAYOUT.strip.cy, 44, 18, false);
  }

  /** One right-aligned pip row ending at xEnd; label only on your own row. */
  private buildManaRow(
    player: PlayerId,
    xEnd: number,
    cy: number,
    step: number,
    pipSize: number,
    label: boolean,
  ): void {
    const counts = new Map<Color, number>();
    for (const src of manaSources(this.duel.state, CARD_DB, player)) {
      for (const c of src.colors) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const colors = (['W', 'U', 'B', 'R', 'G'] as const).filter((c) => (counts.get(c) ?? 0) > 0);
    if (colors.length === 0) return;
    const x0 = xEnd - colors.length * step;
    if (label) {
      this.manaPips.push(
        this.add
          .text(x0 - 11, cy - 26, 'AVAILABLE MANA', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '9px',
            fontStyle: '700',
            color: '#57506e',
            resolution: 2,
          })
          .setOrigin(0, 0.5),
      );
    }
    colors.forEach((c, i) => {
      const x = x0 + i * step;
      this.manaPips.push(this.add.image(x, cy, `pip-${c}`).setDisplaySize(pipSize, pipSize));
      this.manaPips.push(
        this.add
          .text(x + pipSize * 0.64, cy, `×${counts.get(c)}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: label ? '13px' : '11px',
            fontStyle: '600',
            color: '#cbc2e0',
            resolution: 2,
          })
          .setOrigin(0, 0.5),
      );
    });
  }

  private syncHand(): void {
    for (const v of this.handViews) v.destroy();
    this.handViews = [];
    for (const o of this.handDecor) o.destroy();
    this.handDecor = [];
    const hand = this.duel.state.players[HUMAN].hand;
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
    order.forEach((handIdx, pos) => {
      const cardId = hand[handIdx];
      const slot = fan.slots[pos];
      const x = BOARD_CENTER_X + slot.dx;
      const y = restY + slot.dy;
      const d = def(CARD_DB, cardId);
      const view = new CardView(this, x, y);
      view.setScale(scale);
      view.setAngle(slot.angleDeg);
      view.setCard(d, { fx: 'none' });
      view.setDepth(10 + pos);
      const playable = playableIdx.has(handIdx);
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
        // Straighten + gentle lift — the resting card is already readable,
        // and the full-detail read is the CardZoomPreview.
        view.setDepth(40).setScale(scale * 1.15);
        view.setAngle(0);
        view.y = hoverY;
        dot?.setVisible(false);
      });
      view.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        view.setDepth(10 + pos).setScale(scale);
        view.setAngle(slot.angleDeg);
        view.y = y;
        dot?.setVisible(true);
      });
      view.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return; // touch casts only via a classified tap
        if (!p.rightButtonReleased()) this.onHandClick(handIdx);
      });
      view.on('pointerdown', (p: Phaser.Input.Pointer) => {
        // p.button (initiating button of THIS press), not the live
        // rightButtonDown() bitmask — a chorded left press while the right
        // button is held must act as a left click, not open inspect.
        if (p.button === 2 && !this.pendingCasts) this.showInspect(d);
      });
      // Touch: tap = exactly onHandClick; long-press = sticky preview whose
      // release never casts; drags across the fan die in the classifier.
      attachTouchGestures(this, view, {
        card: d,
        pressLift: 12,
        onTap: () => this.onHandClick(handIdx),
      });
      this.zoom.attach(view, d);
      this.handViews.push(view);
    });
  }

  private syncButton(): void {
    const a = this.duel.awaiting;
    const hint = this.hud.hint;
    // The smart button is the Arc + its label Text, shown/relabeled together.
    // No hit-area bookkeeping: input lives on the Arc, whose circle never
    // changes size (the Text label is never interactive).
    const showButton = (label: string): void => {
      this.passArc.setVisible(true);
      this.hud.button.setVisible(true).setText(label);
    };
    this.passArc.setVisible(false);
    this.hud.button.setVisible(false);
    this.endTurnBtn.setVisible(false);
    hint.setText('');

    // stack readout
    const items = this.duel.state.stack;
    this.hud.stack
      .setText(
        items.length === 0
          ? ''
          : 'Pending (top last):\n' + items.map((s) => def(CARD_DB, s.cardId).name).join('\n'),
      )
      .setVisible(items.length > 0);

    // Text hit areas go stale on setText; re-inflate (height stays clamped so
    // the depth-55 rect only grazes the creature rows — see buildHud).
    inflateHitArea(this.hud.stack, 90, 44);

    if (this.ended || !('player' in a) || a.player !== HUMAN) return;
    if (this.pendingCasts) {
      showButton('Cancel');
      // Terse: the rail hint column is only ~96px wide (see buildHud).
      hint.setText(this.touch ? 'Pick a target\n(Cancel aborts)' : 'Pick a target\n(right-click cancels)');
      return;
    }
    switch (a.kind) {
      case 'main':
        showButton(this.duel.state.step === 'main1' ? 'To Combat' : 'Pass ▶');
        hint.setText('Play a card, or advance ▶');
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
        hint.setText('Pick your attackers');
        break;
      case 'declareBlockers':
        showButton(`Confirm Blocks (${this.blockAssignments.length})`);
        hint.setText('Pick a blocker, then its attacker');
        break;
      case 'respond':
      case 'endStepWindow':
        showButton('Pass');
        hint.setText('You may cast a Charm');
        break;
      default:
        break;
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
        this.arrows.lineStyle(4, 0x6aa0ff, 0.9);
        this.arrows.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
    if (combat && combat.blocks.length > 0) {
      for (const b of combat.blocks) {
        const from = this.views.get(b.blocker);
        const to = this.views.get(b.attacker);
        if (from && to) {
          this.arrows.lineStyle(4, 0x88b8ff, 0.7);
          this.arrows.lineBetween(from.x, from.y, to.x, to.y);
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
      this.arrows.lineStyle(4, TARGET_ARROW_COLOR, 0.95);
      this.arrows.lineBetween(sx, sy, tip.x, tip.y);
      // Arrowhead — two short strokes back from the tip along the shaft angle.
      const ang = Math.atan2(tip.y - sy, tip.x - sx);
      const HEAD = 16;
      const SPREAD = 0.5;
      this.arrows.lineBetween(tip.x, tip.y, tip.x - HEAD * Math.cos(ang - SPREAD), tip.y - HEAD * Math.sin(ang - SPREAD));
      this.arrows.lineBetween(tip.x, tip.y, tip.x - HEAD * Math.cos(ang + SPREAD), tip.y - HEAD * Math.sin(ang + SPREAD));
    }
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
      case 'declareBlockers':
        this.act({ type: 'declareBlockers', blocks: [...this.blockAssignments] });
        break;
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
   * targeted cast or closes the inspect overlay, and a pointer-move redraws the
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
    if (this.ended || this.inspect) return; // inspect is modal — don't pass under it
    this.onButton(); // self-guards: auto-skip input lock + not-your-decision
  }

  private onCancelKey(e: KeyboardEvent): void {
    e.preventDefault();
    if (this.inspect) {
      this.closeInspect();
      return;
    }
    if (this.pendingCasts) {
      this.pendingCasts = null;
      this.sync(); // mirrors the right-click cancel path
    }
  }

  private onHandClick(handIndex: number): void {
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
        }
      }
      this.sync();
    }
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
  // Inspect overlay: right-click any card for the full CardView
  // ---------------------------------------------------------------------

  private showInspect(card: CardDef): void {
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
    view.setScale(1.35).setCard(card, { fx: 'full' });
    c.add(view);
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
    if (this.ended || this.overlay || this.inspect || this.pauseOverlay) return;
    // Only during your own decision window — never over a pick/inspect overlay,
    // mid-combat animation, or the AI's turn. That keeps the game from ending
    // behind the overlay (which would double-guard the board with the results
    // overlay) and means Concede is always valid while the menu is open.
    if (this.animatingCombat || !this.isHumanTurnDecision()) return;
    this.concedeArmed = false;
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(105);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82).setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.closePauseMenu(); // tap outside the plate resumes
    });
    c.add(dim);
    c.add(this.add.rectangle(width / 2, height / 2, 420, 430, 0x140f24, 0.96).setStrokeStyle(1.5, 0x3a2f5c));
    c.add(
      this.add
        .text(width / 2, 200, 'Menu', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '34px', color: '#f0e6ff' })
        .setOrigin(0.5),
    );

    const chip = (
      label: string,
      y: number,
      cb: (t: Phaser.GameObjects.Text) => void,
      color = '#e8def7',
      bg = '#3a2f5c',
    ): Phaser.GameObjects.Text => {
      const t = this.add
        .text(width / 2, y, label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '20px',
          color,
          backgroundColor: bg,
          padding: { x: 18, y: 9 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, t, (p) => {
        if (p.rightButtonReleased()) return;
        cb(t);
      });
      inflateHitArea(t, 90, 60);
      c.add(t);
      return t;
    };
    const toggleStyle = (t: Phaser.GameObjects.Text, on: boolean): void => {
      t.setStyle(
        on
          ? { color: '#1a1426', backgroundColor: '#ffd88a' }
          : { color: '#c9bde0', backgroundColor: '#241d3a' },
      );
      inflateHitArea(t, 90, 60); // setStyle changed the text box — re-inflate
    };
    const onOff = (v: boolean): string => (v ? 'On' : 'Off');

    chip('Resume', 260, () => this.closePauseMenu(), '#ffd88a');

    const s = Services.save.data.settings;
    const autoChip = chip(`Auto-skip: ${onOff(s.autoSkip)}`, 318, (t) => {
      s.autoSkip = !s.autoSkip;
      Services.save.touch();
      this.syncAutoToggle();
      t.setText(`Auto-skip: ${onOff(s.autoSkip)}`);
      toggleStyle(t, s.autoSkip);
      if (s.autoSkip) this.maybeAutoSkip();
    });
    toggleStyle(autoChip, s.autoSkip);
    const sfxChip = chip(`Sound: ${onOff(s.sfxOn)}`, 376, (t) => {
      s.sfxOn = !s.sfxOn;
      Services.save.touch();
      t.setText(`Sound: ${onOff(s.sfxOn)}`);
      toggleStyle(t, s.sfxOn);
      if (s.sfxOn) Sfx.play('click');
    });
    toggleStyle(sfxChip, s.sfxOn);
    const musicChip = chip(`Music: ${onOff(Music.enabled)}`, 434, (t) => {
      Music.setEnabled(!Music.enabled);
      t.setText(`Music: ${onOff(Music.enabled)}`);
      toggleStyle(t, Music.enabled);
    });
    toggleStyle(musicChip, Music.enabled);

    chip(
      'Concede',
      506,
      (t) => {
        if (this.ended || !this.isHumanTurnDecision()) {
          t.setText('Not your turn to concede');
          inflateHitArea(t, 90, 60);
          return;
        }
        // Two-tap (a gauntlet loss ends the run) unless opted out.
        if (Services.save.data.settings.confirmDestructive && !this.concedeArmed) {
          this.concedeArmed = true;
          t.setText('Tap to confirm').setColor('#f08a8a');
          inflateHitArea(t, 90, 60);
          return;
        }
        this.tearDownPauseMenu();
        this.act({ type: 'concede' });
      },
      '#f0b0b0',
      '#3a1f28',
    );

    this.pauseOverlay = c;
    this.pauseGuard.open(this.overlayGuardTargets());
  }

  /** Destroy the pause overlay + restore board input (no play-resume side effects). */
  private tearDownPauseMenu(): void {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.destroy();
    this.pauseOverlay = null;
    this.pauseGuard.close();
    this.concedeArmed = false;
  }

  /** Resume from the pause overlay: tear it down, then rejoin any paused flow. */
  private closePauseMenu(): void {
    if (!this.pauseOverlay) return;
    this.tearDownPauseMenu();
    this.maybeAutoSkip(); // a pause paused a pending skip chain — resume it
    this.endTurnTick(); // …and a paused end-turn fast-forward
  }

  // ---------------------------------------------------------------------
  // Graveyard-target chooser (Raise Dead, Call the Einherjar, …)
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

  // ---------------------------------------------------------------------
  // Overlays: mulligan / bottoming / discard / results
  // ---------------------------------------------------------------------

  /** Everything an overlay must deaden while it floats above the board. */
  private overlayGuardTargets(): Phaser.GameObjects.GameObject[] {
    const tileZones: Phaser.GameObjects.GameObject[] = [];
    for (const v of this.views.values()) {
      if (v.inputZone) tileZones.push(v.inputZone);
    }
    return [
      ...tileZones,
      ...this.landStacks.map((s) => s.top),
      ...this.handViews,
      this.passArc, // the smart button's input carrier (its label Text never is)
      this.hud.stack,
      this.hud.myLife,
      this.hud.oppLife,
      this.menuBtn,
      this.endTurnBtn,
      this.autoToggle,
      this.history.tab, // deaden the history slide-out tab under modal overlays
    ];
  }

  private syncOverlay(): void {
    this.guard.close(); // restore before rebuild; no-op when nothing is guarded
    this.overlay?.destroy();
    this.overlay = null;
    if (this.ended) {
      // showResults ran before this sync recreated the hand; re-deaden the board
      this.guard.open(this.overlayGuardTargets());
      return;
    }
    const a = this.duel.awaiting;
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
    } else if (a.kind === 'discardToHandSize') {
      this.buildPickOverlay(`Discard ${a.count} card(s)`, a.count, ['Confirm']);
    } else if (a.kind === 'chooseBasicLand') {
      this.showBasicLandOverlay();
    }
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
      const bx = width / 2 - ((buttons.length - 1) * 180) / 2 + bi * 180;
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

  private showResults(won: boolean, reason: string): void {
    this.closeInspect();
    this.zoom.setSuppressed(true);
    if (this.tutorial) {
      // The tutorial normally ends at the block beat (tutorialComplete), but a
      // mid-tutorial concede lands here — treat it as finishing (reward on skip).
      this.tutorialComplete(false);
      return;
    }
    if (this.opponent && this.gauntletRung !== null) {
      this.showGauntletResults(won, reason);
      return;
    }
    const reward = applyMatchResult(Services.save.data, this.difficulty, won, todayString());
    Services.save.flush();
    Music.duck(1.8); // let the sting read clearly over the bed
    Sfx.play(won ? 'win' : 'loss');

    const width = 1280; // design-space constants (see buildZones)
    const height = 720;
    const c = this.add.container(0, 0).setDepth(120);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setInteractive());
    c.add(
      this.add
        .text(width / 2, 240, won ? 'VICTORY' : 'DEFEAT', {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '64px', fontStyle: 'bold',
          color: won ? '#ffd700' : '#b06a7a',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 305, `(${reason})`, { fontFamily: 'Inter, Arial, sans-serif', fontSize: '16px', color: '#8f83a8' })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(
          width / 2,
          350,
          `+${reward.gold} gold${reward.firstWinBonus ? '  (first win of the day!)' : ''}`,
          { fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', fontStyle: '600', color: '#ffd88a' },
        )
        .setOrigin(0.5),
    );
    const mk = (x: number, label: string, cb: () => void): void => {
      const btn = this.add
        .text(x, 430, label, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '24px', color: '#ffd88a',
          backgroundColor: '#2c2344', padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, cb);
      inflateHitArea(btn, 90, 90);
      c.add(btn);
    };
    mk(width / 2 - 120, 'Rematch', () => this.scene.restart());
    mk(width / 2 + 120, 'Menu', () => this.scene.start('MainMenu'));
    this.guard.open(this.overlayGuardTargets());
  }

  /** Gauntlet results: pay via applyGauntletResult and route through the tower. */
  private showGauntletResults(won: boolean, reason: string): void {
    const rung = this.gauntletRung!;
    const reward = applyGauntletResult(
      Services.save.data,
      rung,
      this.difficulty,
      won,
      todayString(),
    );
    Services.save.flush();
    // Full clear earns the fanfare; an ordinary rung gets its own short motif.
    Music.duck(1.8);
    Sfx.play(reward.completed ? 'win' : won ? 'rungClear' : 'loss');

    const width = 1280; // design-space constants (see buildZones)
    const height = 720;
    const c = this.add.container(0, 0).setDepth(120);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82).setInteractive());

    const headline = reward.completed ? 'TOWER CLEARED' : won ? 'RUNG CLEARED' : 'RUN ENDS';
    const color = reward.completed ? '#ffe08a' : won ? '#ffd700' : '#b06a7a';
    c.add(
      this.add
        .text(width / 2, 210, headline, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: reward.completed ? '58px' : '56px',
          fontStyle: 'bold', color,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 272, won ? `Defeated ${this.opponent!.name}  (${reason})` : `(${reason})`, {
          fontFamily: 'Inter, Arial, sans-serif', fontSize: '16px', color: '#8f83a8',
        })
        .setOrigin(0.5),
    );
    const bonusLine = reward.completed
      ? `+${reward.gold} gold — includes the completion bonus!`
      : `+${reward.gold} gold${reward.firstWinBonus ? '  (first win of the day!)' : ''}`;
    c.add(
      this.add
        .text(width / 2, 320, bonusLine, {
          fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', fontStyle: '600', color: '#ffd88a',
        })
        .setOrigin(0.5),
    );

    const mk = (x: number, label: string, cb: () => void): void => {
      const btn = this.add
        .text(x, 420, label, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '24px', color: '#ffd88a',
          backgroundColor: '#2c2344', padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, btn, cb);
      inflateHitArea(btn, 90, 90);
      c.add(btn);
    };

    if (won && !reward.completed && reward.nextRung !== null) {
      const next = reward.nextRung;
      mk(width / 2 - 120, 'Next Foe', () =>
        this.scene.restart({ opponentId: avatarForRung(next).id, gauntletRung: next }),
      );
      mk(width / 2 + 120, 'Tower', () => this.scene.start('Gauntlet'));
    } else {
      // completion or a loss: the run is over, back to the tower / menu
      mk(width / 2 - 120, 'Tower', () => this.scene.start('Gauntlet'));
      mk(width / 2 + 120, 'Menu', () => this.scene.start('MainMenu'));
    }
    this.guard.open(this.overlayGuardTargets());
  }
}
