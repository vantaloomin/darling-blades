import { Game } from '../engine/Game';
import { createRngState, rngShuffle, type RngState } from '../engine/rng';
import type { CardDb, CardDef, GameState, PlayerId, PlayerState } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';

/**
 * Public-information opponent model for Hard's simulations.
 *
 * Hidden cards (the opponent's hand and both libraries) are filled with
 * STAND-INS whose mix comes from deck-shape priors (land ratio, interaction
 * density, creature curve) minus what the player has already shown in PUBLIC
 * zones (battlefield + graveyard). Nothing here ever reads real hidden state,
 * and the fill depends only on (view, seed) — same inputs, same simulation.
 *
 * The shipped priors are deliberately CONSERVATIVE: every hidden card is the
 * middling 3-mana 2/2 stand-in (lands/interaction/curve at zero). Richer
 * models were built and measured on the 200-game Hard-vs-Medium gate and all
 * LOST win rate:
 *  - lands + 2/3/4 cost curve (guaranteed development): 49% — the simulated
 *    counterattack outgrows reality and drowns the candidate margins that
 *    drive Hard's attack-holdback edge (deviations 149 → ~20 per 200 games);
 *  - always-held removal/trick ("worst-case hand"): 50% — every line looks
 *    equally doomed (held-back creatures die to end-step removal anyway), so
 *    the search stops deviating from Medium;
 *  - seed-sampled interaction averaged over 3 worlds: 49.5% — sim tricks
 *    fire against MY blocks in the lookahead's counterattack half, taxing
 *    exactly the holdback candidates that win games;
 *  - trick-only, and curve-only variants: 49.5% / 60.5% vs 61.5% baseline.
 * Hard's edge lives in engine-exact combat math on the PUBLIC battlefield;
 * an inert hidden-card model keeps that signal clean. The category/prior
 * machinery stays as the tuning surface for future pools where real decks
 * punish attacks more often than these gates' Medium does.
 */

// --- stand-in pool ---------------------------------------------------------

const UNKNOWN_LAND_ID = '__unknown_land';
const UNKNOWN_REMOVAL_ID = '__unknown_removal';
const UNKNOWN_TRICK_ID = '__unknown_trick';
const UNKNOWN_C2_ID = '__unknown_c2';
const UNKNOWN_C3_ID = '__unknown_c3';
const UNKNOWN_C4_ID = '__unknown_c4';

/** Stand-ins are colorless with generic costs: payable by any land, so the
 * model never suffers imaginary color screw. */
const STAND_IN_DEFS: readonly CardDef[] = [
  {
    id: UNKNOWN_LAND_ID,
    name: 'Unknown Land',
    types: ['land'],
    subtypes: [],
    colors: [],
    manaAbility: ['W', 'U', 'B', 'R', 'G'],
    rarity: 'c',
  },
  {
    id: UNKNOWN_C2_ID,
    name: 'Unknown 2-Drop',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 2, pips: {} },
    colors: [],
    attack: 2,
    defense: 2,
    rarity: 'c',
  },
  {
    id: UNKNOWN_C3_ID,
    name: 'Unknown 3-Drop',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 3, pips: {} },
    colors: [],
    attack: 2,
    defense: 2,
    rarity: 'c',
  },
  {
    id: UNKNOWN_C4_ID,
    name: 'Unknown 4-Drop',
    types: ['creature'],
    subtypes: [],
    cost: { generic: 4, pips: {} },
    colors: [],
    attack: 4,
    defense: 4,
    rarity: 'c',
  },
  {
    id: UNKNOWN_REMOVAL_ID,
    name: 'Unknown Removal',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 2, pips: {} },
    colors: [],
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] },
    ],
    rarity: 'c',
  },
  {
    id: UNKNOWN_TRICK_ID,
    name: 'Unknown Trick',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 1, pips: {} },
    colors: [],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [{ op: 'boost', p: 2, t: 2, scope: 'target' }],
      },
    ],
    rarity: 'c',
  },
];

/** db + the stand-ins so the sim can look them up. */
export function simDb(db: CardDb): CardDb {
  const extra: Record<string, CardDef> = {};
  for (const d of STAND_IN_DEFS) extra[d.id] = d;
  return { ...db, ...extra };
}

// --- deck-shape priors -------------------------------------------------------

/** Fraction of a deck assumed to be lands (both gate decks run 16/40). */
const LAND_FRACTION = 0.0;
/** Fraction assumed to be instants/sorceries — removal + tricks. */
const INTERACTION_FRACTION = 0.0;
/** Creature cost curve weights for [2-drop, 3-drop, 4-drop]. */
const CURVE_WEIGHTS = [0, 1, 0];

/** Categories in a fixed order: [land, removal, trick, c2, c3, c4]. */
const CATEGORY_IDS = [
  UNKNOWN_LAND_ID,
  UNKNOWN_REMOVAL_ID,
  UNKNOWN_TRICK_ID,
  UNKNOWN_C2_ID,
  UNKNOWN_C3_ID,
  UNKNOWN_C4_ID,
] as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Largest-remainder apportionment of `total` items across `weights`. */
function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

interface SeenCounts {
  lands: number;
  interaction: number;
  total: number;
}

/** Tally the deck cards a player has publicly shown (or, for our own side,
 * that we hold). Tokens never came from a deck and are excluded. */
function countSeen(db: CardDb, cards: readonly string[]): SeenCounts {
  const seen: SeenCounts = { lands: 0, interaction: 0, total: 0 };
  for (const id of cards) {
    const d = def(db, id);
    if (d.token) continue;
    seen.total++;
    if (isType(d, 'land')) seen.lands++;
    else if (isType(d, 'charm') || isType(d, 'ritual')) seen.interaction++;
  }
  return seen;
}

/** How many of each stand-in category the hidden zones should contain:
 * prior deck shape minus what is already public. */
function hiddenCategoryCounts(seen: SeenCounts, hidden: number): number[] {
  const deckSize = seen.total + hidden;
  const lands = clamp(Math.round(LAND_FRACTION * deckSize) - seen.lands, 0, hidden);
  const interaction = clamp(
    Math.round(INTERACTION_FRACTION * deckSize) - seen.interaction,
    0,
    hidden - lands,
  );
  const removal = Math.ceil(interaction / 2);
  const trick = interaction - removal;
  const curve = apportion(hidden - lands - interaction, CURVE_WEIGHTS);
  return [lands, removal, trick, ...curve];
}

/**
 * Deal the hidden pool into hand + deck: one seeded shuffle, hand off the
 * top. Each seed is one PLAUSIBLE WORLD — this hand holds the trick, that
 * one does not — and Hard can average several seeds per decision so a risk
 * that only bites in some worlds is priced proportionally. (At the shipped
 * single-stand-in priors every world is identical and one seed suffices.)
 */
function fillZones(
  counts: readonly number[],
  handCount: number,
  rng: RngState,
): { hand: string[]; deck: string[] } {
  const pool: string[] = [];
  counts.forEach((count, cat) => {
    for (let i = 0; i < count; i++) pool.push(CATEGORY_IDS[cat]);
  });
  rngShuffle(rng, pool);
  return { hand: pool.slice(0, handCount), deck: pool.slice(handCount) };
}

/**
 * Build a simulatable Game from a redacted view — the honest substitute for
 * reading hidden state. Own hand is exact; the opponent's hand and both
 * libraries are stand-ins with a composition inferred from public zones plus
 * flat priors (see the module header). Same view + seed → same Game.
 */
export function determinize(view: PlayerView, db: CardDb, seed = 1): Game {
  const me = view.myId;
  const opp = opponentOf(me);
  const fillRng = createRngState((seed ^ 0x51ab17e5) >>> 0);

  const owned = (p: PlayerId): string[] =>
    view.battlefield.filter((perm) => perm.owner === p).map((perm) => perm.cardId);

  // My side: I can see my hand, so only the deck is hidden.
  const mySeen = countSeen(db, [...owned(me), ...view.you.graveyard, ...view.you.hand]);
  const myFill = fillZones(hiddenCategoryCounts(mySeen, view.you.deckCount), 0, fillRng);

  // Their side: hand + deck are hidden; battlefield + graveyard are public.
  const theirSeen = countSeen(db, [...owned(opp), ...view.opp.graveyard]);
  const theirHidden = view.opp.handCount + view.opp.deckCount;
  const theirFill = fillZones(
    hiddenCategoryCounts(theirSeen, theirHidden),
    view.opp.handCount,
    fillRng,
  );

  const mine: PlayerState = {
    life: view.you.life,
    deck: myFill.deck,
    hand: [...view.you.hand],
    graveyard: [...view.you.graveyard],
    exile: [...view.you.exile],
    landPlayedThisTurn: view.you.landPlayedThisTurn,
    mulligans: view.you.mulligans,
    keptHand: true,
  };
  const theirs: PlayerState = {
    life: view.opp.life,
    deck: theirFill.deck,
    hand: theirFill.hand,
    graveyard: [...view.opp.graveyard],
    exile: [...view.opp.exile],
    landPlayedThisTurn: view.opp.landPlayedThisTurn,
    mulligans: view.opp.mulligans,
    keptHand: true,
  };

  const players = (me === 0 ? [mine, theirs] : [theirs, mine]) as [PlayerState, PlayerState];
  const maxIid = Math.max(0, ...view.battlefield.map((p) => p.iid));
  const maxSid = Math.max(0, ...view.stack.map((s) => s.sid));

  const state: GameState = {
    rng: createRngState(seed),
    turn: view.turn,
    startingPlayer: view.startingPlayer,
    activePlayer: view.activePlayer,
    step: view.step,
    players,
    battlefield: structuredClone(view.battlefield),
    stack: structuredClone(view.stack),
    stackClosed: false,
    combat: structuredClone(view.combat),
    fogThisTurn: view.fogThisTurn,
    awaiting: structuredClone(view.awaiting),
    // No fetch can be mid-flight at a Hard entry point, and stand-in lands
    // aren't `basic`, so this stays empty in sims — but it must exist so the
    // engine's pendingDecisions reads never hit undefined.
    pendingDecisions: [],
    nextIid: maxIid + 1,
    nextSid: maxSid + 1,
    winner: null,
    winReason: null,
  };
  return Game.restore(state, simDb(db));
}
