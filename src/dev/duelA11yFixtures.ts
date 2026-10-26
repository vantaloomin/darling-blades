/**
 * Dev-only Duel fixtures. All copy comes from the catalog or live presenters;
 * every pending cast is an engine-enumerated action. No save is read or written.
 * Kept Phaser-free so the probe's decisions can be checked headlessly.
 */
import { RULES } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { tutorialCue, type TutorialCueInput } from '../data/tutorial';
import { Game } from '../engine/Game';
import { legalActions } from '../engine/actions';
import type { CardDef, CardInstance, GameState, Permanent, PlayerId, TargetRef } from '../engine/types';
import { dutyChoices } from '../ui/drownedDeepChoices';
import { eventHistoryLine, type EventLineLookup } from '../ui/duelPresentation';
import type { TargetSelectionAction } from '../ui/targetSelection';

export type DuelA11yFixtureName =
  | 'full-board' | 'sick-blocker' | 'attackers-targeting' | 'one-target-pick'
  | 'portrait-pick' | 'two-target-picks' | 'graveyard-pick' | 'marks-boost-damage'
  | 'picked-attacker' | 'history' | 'stack' | 'graveyard' | 'darling' | 'duty'
  | 'coach-cue' | 'coach-info' | 'lethal-target-pick' | 'single-grave-pick' | 'repeated-target-picks'
  | 'mandate-yours' | 'mandate-theirs';

export interface DuelA11yFixture {
  state: GameState;
  selectedAttackers: number[];
  blockAssignments: { blocker: number; attacker: number }[];
  pendingCasts: TargetSelectionAction[] | null;
  targetPicks: TargetRef[];
  targetPicksUnordered: boolean;
  panel: null | 'history' | 'graveyard' | 'grave-picker' | 'duty' | 'coach-cue' | 'coach-info';
  history: { text: string; cardId: string }[];
  dutyCardId?: string;
  coachText?: string;
  /** Catalog identities for the real portrait labels, including shrink-to-fit. */
  humanName: string;
  opponentName: string;
  humanFaceCardId: string;
  opponentFaceCardId: string;
}

const creatures = Object.values(CARD_DB)
  .filter((card) => card.types.includes('creature') && !card.token)
  .sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id));
export const WAVE_2D_DARLING = creatures[0];
export const WAVE_2D_OPPONENT = creatures[1];
const duty = Object.values(CARD_DB).flatMap((card) => dutyChoices(card, 200, [])
  .map((choice) => ({ card, choice })))
  .sort((a, b) => b.choice.line.length - a.choice.line.length || a.card.id.localeCompare(b.card.id))[0];
export const WAVE_2D_LONGEST_DUTY = duty;

const coachBase: TutorialCueInput = {
  isHumanTurn: true, awaitingKind: 'main', step: 'main1', canPlayLand: false,
  hasCastableCreature: false, hasCastableRitual: false, hasCastableCharm: false,
  handHasCharm: true, myCreatureCount: 1, eligibleAttackerCount: 1,
  attackerSelected: false, pendingBlocker: false, hasLegalBlocker: true,
  blockAssigned: false, isTouch: false, goalShown: true, warchestInfoShown: true,
  sicknessShown: true, inspectShown: true, healInfoShown: true, blocked: true,
  ritualCast: true, ritualInfoShown: true, charmCast: false, charmInfoShown: false,
  safetyDone: false,
};
export const WAVE_2D_COACH_CUE = tutorialCue(coachBase).text;
export const WAVE_2D_COACH_INFO = tutorialCue({ ...coachBase, canPlayLand: true, warchestInfoShown: false }).text;

/** Stable board identities let the rendered probe inspect the actual cue carriers. */
export const WAVE_2D_IIDS = { blocker: 1, marked: 2, selectedAttacker: 3, attacker: 9, duty: 200 } as const;
const ONE_TARGET = 'in-fire-attack';
const OWN_TARGET = 'sd-root-through-the-ruin';
const TWO_TARGETS = 'dd-drowned-chapel-bell';
const GRAVE_TARGET = 'dd-the-marsh-remembers';
const SINGLE_GRAVE_TARGET = 'so-raise-dead';
const REPEATED_TARGETS = 'fd-test-of-the-hearth';
const basics = ['land-plains', 'land-island', 'land-swamp', 'land-mountain', 'land-forest'];

function permanent(iid: number, cardId: string, player: PlayerId, extra: Partial<Permanent> = {}): Permanent {
  return { iid, instanceId: 1000 + iid, cardId, owner: player, controller: player,
    tapped: false, enteredThisTurn: false, damage: 0, deathtouched: false,
    severBranded: false, attachments: [], plusOneCounters: 0, untilEotMods: [], ...extra };
}

function baseState(): GameState {
  const deck = Array<string>(40).fill('bk-mousekin-pantry-guard');
  const game = new Game({ db: CARD_DB, seed: 1904, decks: [deck, deck], format: 'darlings',
    landReserves: [Array<string>(10).fill('land-plains'), Array<string>(10).fill('land-plains')],
    darlings: [WAVE_2D_DARLING.id, WAVE_2D_OPPONENT.id] });
  const state: GameState = structuredClone(game.instanceState);
  state.turn = 8;
  state.activePlayer = 0;
  state.startingPlayer = 0;
  state.step = 'main1';
  state.awaiting = { player: 0, kind: 'main' };
  state.pendingDecisions = [];
  state.stack = [];
  state.stackClosed = false;
  state.combat = null;
  state.battlefield = [];
  for (const player of [0, 1] as const) {
    const ids = ['bk-mousekin-pantry-guard', 'bk-mousekin-pantry-guard', 'bk-mousekin-pantry-guard',
      ...creatures.slice(0, 3).map((card) => card.id), 'tok-militia', 'tok-bloom'];
    ids.forEach((id, index) => state.battlefield.push(permanent(1 + index + player * 8, id, player,
      index >= 6 ? { isToken: true, overcharge: index === 6 ? RULES.overchargeLimit : 1 } : {})));
    basics.flatMap((id) => [id, id]).forEach((id, index) =>
      state.battlefield.push(permanent(100 + player * 20 + index, id, player)));
    state.players[player].hand = [ONE_TARGET, OWN_TARGET, TWO_TARGETS, GRAVE_TARGET, 'in-blessed-respite'];
    state.players[player].graveyard = creatures.slice(0, 3).map((card, index): CardInstance =>
      ({ cardId: card.id, instanceId: 2000 + player * 100 + index, variantKey: null }));
    state.players[player].mulligans = 0;
    state.players[player].keptHand = true;
    state.players[player].landDropsUsed = 1;
  }
  state.nextIid = 500;
  state.nextInstanceId = 5000;
  state.nextSid = 20;
  return state;
}

function castsFor(state: GameState, cardId: string): TargetSelectionAction[] {
  const handIndex = state.players[0].hand.findIndex((card) => typeof card === 'string' ? card === cardId : card.cardId === cardId);
  return legalActions(state, CARD_DB, 0).filter((action): action is Extract<TargetSelectionAction, { type: 'castSpell' }> =>
    action.type === 'castSpell' && action.handIndex === handIndex && !action.empowered);
}

/** Long canonical event lines, using the longest existing creature identities. */
function historyEntries(state: GameState): DuelA11yFixture['history'] {
  const lookup: EventLineLookup = {
    permanent: (iid) => ({ ref: `[${creatures[iid === 1 ? 0 : 1].name}]`, side: iid === 1 ? 'you' : 'opponent' }),
    cardRef: (id) => `[${CARD_DB[id].name}]`, card: (id) => CARD_DB[id],
    sideOf: (player) => player === 0 ? 'you' : 'opponent', overchargeLimit: RULES.overchargeLimit,
  };
  return Array.from({ length: 14 }, (_, index) => {
    const card = creatures[index % creatures.length];
    const text = index % 2 === 0
      ? eventHistoryLine({ e: 'overcharged', player: 1, iid: state.battlefield[0].iid,
        cardId: card.id, tokenCardId: card.id, total: RULES.overchargeLimit }, lookup)
      : eventHistoryLine({ e: 'hunted', hunter: 1, prey: 9, hunterDamage: 12, preyDamage: 10 }, lookup);
    return { text: text!, cardId: card.id };
  }).sort((a, b) => a.text.length - b.text.length);
}

export function wave2DDuelFixture(name: DuelA11yFixtureName): DuelA11yFixture {
  const state = baseState();
  const fixture: DuelA11yFixture = {
    state, selectedAttackers: [], blockAssignments: [], pendingCasts: null,
    targetPicks: [], targetPicksUnordered: false, panel: null, history: [],
    humanName: WAVE_2D_DARLING.name, opponentName: WAVE_2D_OPPONENT.name,
    humanFaceCardId: WAVE_2D_DARLING.id, opponentFaceCardId: WAVE_2D_OPPONENT.id,
  };
  const perm = (iid: number): Permanent => state.battlefield.find((entry) => entry.iid === iid)!;
  if (name === 'sick-blocker' || name === 'attackers-targeting') {
    state.activePlayer = 1;
    state.step = 'combat';
    state.combat = { attackers: [WAVE_2D_IIDS.attacker], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    perm(WAVE_2D_IIDS.attacker).tapped = true;
    if (name === 'sick-blocker') {
      state.awaiting = { player: 0, kind: 'declareBlockers' };
      perm(WAVE_2D_IIDS.blocker).enteredThisTurn = true;
      fixture.blockAssignments = [{ blocker: WAVE_2D_IIDS.blocker, attacker: WAVE_2D_IIDS.attacker }];
    } else {
      // An awakened attacker carries a second persistent frame in the live
      // tile; that frame must yield along with the attack ring while targeting.
      Object.assign(perm(WAVE_2D_IIDS.attacker), { cardId: 'rg-twice-chosen-shieldmaiden', awakened: true });
      state.awaiting = { player: 0, kind: 'respond', over: { type: 'attackers' } };
      fixture.pendingCasts = castsFor(state, OWN_TARGET);
    }
  }
  if (name === 'one-target-pick' || name === 'portrait-pick' || name === 'two-target-picks' || name === 'graveyard-pick') {
    fixture.pendingCasts = castsFor(state, name === 'two-target-picks' ? TWO_TARGETS : name === 'graveyard-pick' ? GRAVE_TARGET : ONE_TARGET);
    const actions = fixture.pendingCasts;
    fixture.targetPicks = name === 'portrait-pick' ? [{ kind: 'player', player: 1 }]
      : name === 'two-target-picks' ? [{ kind: 'permanent', iid: 3 }, { kind: 'permanent', iid: 1 }]
      : name === 'graveyard-pick' ? [actions[0].targets![0]]
      : [{ kind: 'permanent', iid: 4 }];
    fixture.targetPicksUnordered = name === 'two-target-picks';
    if (name === 'graveyard-pick') fixture.panel = 'grave-picker';
  }
  if (name === 'lethal-target-pick') {
    // With no opposing Charm, acceptance resolves the spell immediately and
    // removes this 1/1. The probe must see the badge on its departing tile.
    state.players[1].hand = [];
    fixture.pendingCasts = castsFor(state, ONE_TARGET);
    fixture.targetPicks = [{ kind: 'permanent', iid: 1 }];
  }
  if (name === 'single-grave-pick') {
    state.players[0].hand[3] = SINGLE_GRAVE_TARGET;
    // Let Summon the Dead reclaim its target and open Foresee immediately;
    // the accepted-pick readout must survive the graveyard entry moving away.
    state.players[1].hand = [];
    fixture.pendingCasts = castsFor(state, SINGLE_GRAVE_TARGET);
    fixture.targetPicks = [fixture.pendingCasts[0].targets![0]];
    // The accepted-pick readout is produced by the real selection handler;
    // deliberately do not reopen the picker from the fixture hook.
  }
  if (name === 'repeated-target-picks') {
    state.players[0].hand[2] = REPEATED_TARGETS;
    fixture.pendingCasts = castsFor(state, REPEATED_TARGETS);
    fixture.targetPicks = [{ kind: 'permanent', iid: 4 }, { kind: 'permanent', iid: 4 }];
  }
  if (name === 'marks-boost-damage') Object.assign(perm(WAVE_2D_IIDS.marked), {
    plusOneCounters: 2, damage: 1, untilEotMods: [{ p: 2, t: 1, keywords: [] }],
  });
  if (name === 'picked-attacker') {
    state.step = 'combat';
    state.awaiting = { player: 0, kind: 'declareAttackers' };
    fixture.selectedAttackers = [WAVE_2D_IIDS.selectedAttacker];
  }
  if (name === 'history') { fixture.panel = 'history'; fixture.history = historyEntries(state); }
  if (name === 'stack') {
    state.stack = Array.from({ length: 12 }, (_, index) => ({ sid: index + 1,
      cardId: [ONE_TARGET, TWO_TARGETS, OWN_TARGET, 'in-blessed-respite'][index % 4],
      controller: (index % 2) as PlayerId, targets: [{ kind: 'permanent' as const, iid: 1 }] }));
    state.awaiting = { player: 0, kind: 'respond', over: { type: 'spell', sid: 12 } };
  }
  if (name === 'graveyard') {
    fixture.panel = 'graveyard';
    state.players[0].graveyard = creatures.slice(0, 60).map((card, index) =>
      ({ cardId: card.id, instanceId: 3000 + index, variantKey: null }));
  }
  if (name === 'darling') state.players[0].darlingTax = 12;
  if (name === 'duty') {
    fixture.panel = 'duty';
    fixture.dutyCardId = duty.card.id;
    state.battlefield.push(permanent(WAVE_2D_IIDS.duty, duty.card.id, 0));
    perm(1).plusOneCounters = 2;
    perm(2).plusOneCounters = 2;
  }
  // The Mandate's seal beside each holder's life (2.0 lane B4).
  if (name === 'mandate-yours') state.mandateHolder = 0;
  if (name === 'mandate-theirs') state.mandateHolder = 1;
  if (name === 'coach-cue' || name === 'coach-info') {
    fixture.panel = name;
    fixture.coachText = name === 'coach-cue' ? WAVE_2D_COACH_CUE : WAVE_2D_COACH_INFO;
  }
  return fixture;
}

/** Preload follows the actual fixtures, including every graveyard page. */
export function wave2DArtIds(): string[] {
  return [...new Set([...creatures.slice(0, 60).map((card: CardDef) => card.id), ...basics,
    'bk-mousekin-pantry-guard', 'tok-militia', 'tok-bloom', ONE_TARGET, OWN_TARGET, TWO_TARGETS,
    GRAVE_TARGET, SINGLE_GRAVE_TARGET, REPEATED_TARGETS,
    'in-blessed-respite', 'rg-twice-chosen-shieldmaiden', duty.card.id])];
}
