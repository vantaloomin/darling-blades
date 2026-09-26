/**
 * The power scorer: pure, headless, and shared by two consumers.
 *
 * - The Forge (`src/forge/`, served at /forge/) scores the card being designed
 *   in the browser, live, on every edit.
 * - The local balance CLI (`balance/score.ts`, gitignored) scores the whole
 *   collectible pool into `balance/power-scores.json` and prints the anchors.
 *
 * So this module stays browser-safe: no Phaser, no DOM, no `node:` imports
 * (`src/power/**` sits in the ESLint purity block). The one environment read,
 * `envNum`, is guarded so a browser falls back to the built-in rates.
 *
 * Assigns every collectible card a PowerScore in "mana-equivalent points" (MEP)
 * — the fair MTG mana cost of everything the card does — and compares it to
 * the v3 additive Budget (2026-08-29; see the v3 BUDGET block below):
 *
 *   Budget = CARD_FLOOR + MANA_STEP × (MV − 1) + PIP_PREMIUM × (pips − 1) + RARITY_BONUS
 *          = 1.10 + 0.82 × (MV − 1) + 0.40 × (pips − 1) + { c 0, r 0.35, sr 0.60, ssr 1.00, ur 2.00 }
 *
 * It replaced the v1/v2 multiplicative `manaValue × rarityMult` budget;
 * `RARITY_MULT` below is that budget's rarity table, no longer read by the
 * scorer. Delta = PowerScore − Budget:
 *   Δ > 0  → card does MORE than its cost+rarity should buy  (undercosted / hot)
 *   Δ < 0  → card does LESS                                   (overcosted / cold)
 *
 * Coefficients are calibrated so canonical FAIR cards land near Δ≈0 (see the
 * ANCHORS printout). This is a transparent heuristic, not gospel — it is the
 * systematic cross-check to the per-card MTG analogs the Codex run produces.
 *
 * The rationale for every rate, and the `§` sections the comments below cite,
 * live in `balance/power-formula.md`. That document is LOCAL-ONLY: `balance/`
 * is gitignored, so it is not in the repo and a fresh clone does not have it.
 *
 * Run: npx tsx balance/score.ts   → balance/power-scores.json + prints summary
 * (local only; the byte-identical rescore procedure is in docs/forge.md).
 *
 * v2 (2026-08-28): extends v1 (349-card era) to the full 1,025-card pool.
 * v1 coefficients, rates and formulas are UNCHANGED — v2 only ADDS handling
 * for ops/keywords/whens/scopes/mechanics v1 never saw. See
 * balance/power-formula.md §4e for the full v2 rate card and rationale.
 *
 * 2026-09-24: the Drowned Deep vocabulary on shipped data (Duty lists,
 * self-discard, edicts, tap-all, the ally/sunset/charm/lifegain observers
 * and their gates) is priced in §4t; additions only, every earlier rate and
 * every §6 anchor unchanged.
 */
import { ALL_CARDS } from '../data/catalog';
import type {
  AbilityDef,
  ActivatedDef,
  CardDef,
  EffectOp,
  Keyword,
  ManaCost,
  Rarity,
  StaticDef,
  TriggerWhen,
} from '../engine/types';
import { manaValue } from '../engine/types';

/** v3 vocabulary is newer than this isolated worktree's engine unions. Keep
 * the browser workbench type-safe without widening production `src/`. */
export const STARBORNE_TRIGGERS = [
  'gainsMark',
  'yourCreatureMarked',
  'yourPermanentMarked',
  'youAddMark',
  'otherCreatureMarked',
  'propagated',
  'markedAllyAttacks',
  'allyCreatureArrives',
] as const;

export type ScorableTriggerWhen = TriggerWhen | (typeof STARBORNE_TRIGGERS)[number];
export type ScorableCondition =
  | 'questActive'
  | 'controlMarked'
  | 'creatureDiedThisTurn'
  | { kind: 'controlsOther'; subtype: string }
  | { kind: 'markedThreshold'; n: number; subject?: 'permanents' | 'creatures' };

type BaseBoostOp = Extract<EffectOp, { op: 'boost' }>;
export type ScorableEffectOp =
  | Exclude<EffectOp, BaseBoostOp>
  | (Omit<BaseBoostOp, 'scope'> & {
      scope: BaseBoostOp['scope'] | 'yourMarked' | 'theirMarked';
    })
  | { op: 'fetchLand' }
  | { op: 'markAll' }
  | { op: 'moveMark' }
  | { op: 'removeMarks' }
  | { op: 'severSelf' }
  | { op: 'loseLifePerTheirMarked' }
  | { op: 'ifTargetMarked'; then: ScorableEffectOp[]; else?: ScorableEffectOp[] }
  | { op: 'propagate' };

type PieEffectOp = ScorableEffectOp | { op: 'discard'; n: number; who?: 'opponent' };

export type ScorableAbilityDef = Omit<AbilityDef, 'when' | 'condition' | 'ops'> & {
  when: ScorableTriggerWhen;
  condition?: ScorableCondition;
  ops?: ScorableEffectOp[];
};

type ScorableEmpower = Omit<NonNullable<CardDef['empower']>, 'ops'> & {
  ops: ScorableEffectOp[];
};
type ScorableRetell = Omit<NonNullable<CardDef['retell']>, 'ops'> & {
  ops?: ScorableEffectOp[];
};
export type ScorableActivated = Omit<ActivatedDef, 'ops'> & {
  ops: ScorableEffectOp[];
};
/** A card may print one Duty or an ordered list of them (1.8, mirrors
 * `activatedAbilitiesOf` in src/engine/types.ts). */
export function dutiesOf(card: Pick<ScorableCardDef, 'activated'>): readonly ScorableActivated[] {
  const a = card.activated;
  return a ? (Array.isArray(a) ? a : [a]) : [];
}
/** Whispers (1.8, Drowned Deep): fresh-graveyard alternative cost. Typed here
 * until the engine wave lands `CardDef.whispers`; the shape mirrors the spec
 * (docs/plan-drowned-deep-engine.md section 2). */
export type ScorableWhispers = { cost: ManaCost };
/** Tithe (1.8, Drowned Deep; renamed from Dread 2026-09-11): any-number sacrifice, one generic per two
 * points of combined Defense. `per` is fixed at 2 by the ruling. */
export type ScorableTithe = { per: 2 };

export type ScorableCardDef = Omit<
  CardDef,
  'abilities' | 'empower' | 'retell' | 'chapters' | 'activated' | 'set'
> & {
  abilities?: ScorableAbilityDef[];
  empower?: ScorableEmpower;
  retell?: ScorableRetell;
  chapters?: ScorableEffectOp[][];
  activated?: ScorableActivated | ScorableActivated[];
  whispers?: ScorableWhispers;
  tithe?: ScorableTithe;
  set?: NonNullable<CardDef['set']> | 'starborne';
};

// ── Unknown-vocabulary tracking (v2) ────────────────────────────────────────
// No silent zeros: anything the scorer doesn't recognize is collected here and
// fails the run at the end (see the bottom of the file), instead of quietly
// scoring as `undefined`/NaN the way the pre-v2 scorer did for `dreaded` et al.
export type UnknownCollector = Set<string>;

// ── Tunable coefficients (all in mana-equivalent points) ─────────────────────

export const RARITY_MULT: Record<Rarity, number> = { c: 1.0, r: 1.06, sr: 1.15, ssr: 1.25, ur: 1.4 };

// ── v3 BUDGET (2026-08-29) ───────────────────────────────────────────────────
// Replaces `MV × rarityMult`, which had three measured defects: it ignored
// colour commitment ({2}{W}{W} scored as {3}{W}), it was linear in mana so
// expensive cards drew ever more headroom, and the rarity premium multiplied
// that error (commons showed no MV bias; URs showed −1.03). Result: a
// systematic slope of about −0.2 Δ per mana, which pushed the batch toward
// "make expensive cards cheaper" — 196 cuts against 50 raises.
//
//   Budget = CARD_FLOOR + MANA_STEP×(MV−1) + PIP_PREMIUM×(pips−1) + rarity
//
// Fitted by robust (median) regression on the 1,024 SHIPPED non-X cards — six
// released sets that have already passed win-rate gates — then smoothed to
// round constants. See power-formula.md §3a.
export const CARD_FLOOR = 1.10;   // what merely being a castable 1-mana card buys
export const MANA_STEP = 0.82;    // each mana after the first; sub-linear on purpose
export const PIP_PREMIUM = 0.40;  // per coloured symbol beyond the first (0 pips pays −0.40)
export const RARITY_BONUS: Record<Rarity, number> = { c: 0.0, r: 0.35, sr: 0.6, ssr: 1.0, ur: 2.0 };

export function v3Budget(mv: number, pips: number, rarity: Rarity): number {
  return CARD_FLOOR + MANA_STEP * (mv - 1) + PIP_PREMIUM * (pips - 1) + RARITY_BONUS[rarity];
}

// ── v3 COLOUR-PIE PREMIUM (owner-approved 2026-08-29) ───────────────────────
// "Add a mana cost premium for things outside the natural order — white solo
// kill, red bounce, black wrath." Formalizes rulings the owner was already
// making by hand (green burn premium on hunt-the-boar; white scry premium on
// ancestor-smoke). An OFF-PIE effect's fair cost is higher, so the premium
// ADDS TO P: the card must carry a bigger printed cost to read fair.
//
// Tiers (era 8th-10th, comparatives per class in power-formula §3b):
//   primary 0 · secondary +0.4 · off-pie +0.8
// Anchors for the tier sizes: Wrath of God {2}{W}{W} vs black's fair-era
// wraths (Mutilate conditional {2}{B}{B}, Decree of Pain {6}{B}{B}) = +1-2
// mana at rarity; Boomerang {U}{U} vs red bounce (absent from the era) ;
// green burn = Hornet Sting (deliberately bad). 0.4/0.8 sit conservatively
// under those gaps. Applied ONCE per effect class per card (not per op).
// Multicolour uses the cheapest of the card's colours; colourless pays 0.4
// (artifacts historically buy coloured effects at a premium) except for
// mana/ramp, which is artifact-natural.
type Pie = Partial<Record<'W' | 'U' | 'B' | 'R' | 'G', number>>;
// v3.1 READER AMENDMENTS (owner-adopted 2026-08-29): off-pie tier 0.8 -> 0.85
// (splits the reader debate; measured near-inert, 2 band-edge flips) and
// self-damage drawback credit 0.4 -> 0.3 per point (readers judged drawback
// credit too generous; the cut surfaces Night-Market Bargain at +0.88, which
// matches play experience). Env overrides remain for future sweeps.
const envNum = (key: string, fallback: number): number => {
  const raw = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return raw === undefined ? fallback : Number(raw);
};
export const OFF = envNum('PIE_OFF', 0.85);
export const SELF_DMG_RATE = envNum('SELF_DMG', 0.3);
export const SEC = 0.4;
// Missing colour = OFF. Listed = primary (0) or secondary (SEC).
export const PIE: Record<string, { pie: Pie; colorless: number }> = {
  burn: { pie: { R: 0, B: SEC }, colorless: SEC },          // creature/any-target damage
  faceBurn: { pie: { R: 0, B: SEC }, colorless: SEC },
  sweepDamage: { pie: { R: 0, B: SEC }, colorless: SEC },   // Pestilence-class
  wrath: { pie: { W: 0, B: SEC }, colorless: SEC },         // unconditional destroy-all
  wrathFliers: { pie: { G: 0, W: SEC }, colorless: SEC },   // Hurricane-class
  kill: { pie: { B: 0, R: SEC }, colorless: SEC },          // unconditional destroy/sever
  bounce: { pie: { U: 0 }, colorless: SEC },
  counter: { pie: { U: 0 }, colorless: SEC },
  draw: { pie: { U: 0, B: SEC, G: SEC }, colorless: SEC },  // Harmonize-era green
  scry: { pie: { U: 0, W: SEC, B: SEC, R: SEC }, colorless: SEC },
  lifegain: { pie: { W: 0, G: SEC, B: SEC }, colorless: SEC },
  ramp: { pie: { G: 0 }, colorless: 0 },                    // rocks are artifact-natural
  reanimate: { pie: { B: 0, W: SEC }, colorless: SEC },
  discard: { pie: { B: 0, U: SEC }, colorless: SEC },
  drain: { pie: { B: 0 }, colorless: SEC },
  disenchant: { pie: { W: 0, G: 0, R: SEC }, colorless: SEC }, // B artifact kill ~absent
};
export function pieClassOf(op: PieEffectOp, targetWhat?: string): string | null {
  switch (op.op) {
    case 'damage':
      if (op.to === 'controller') return null;
      if (op.to === 'opponent') return 'faceBurn';
      if (op.to === 'eachCreature' || op.to === 'eachOpponentCreature') return 'sweepDamage';
      return 'burn';
    case 'massDestroy':
      return op.filter === 'allCreatures' ? 'wrath' : 'wrathFliers';
    case 'destroy': case 'sever':
      // v3.1 owner-caught: classify by TARGET, not op name - removal aimed
      // at an enchantment/artifact is the disenchant class (white primary),
      // not creature kill.
      return targetWhat === 'enchantment' || targetWhat === 'artifact' || targetWhat === 'artifactOrEnchantment' ? 'disenchant' : 'kill';
    case 'recall': return 'bounce';
    case 'cancel': return 'counter';
    case 'draw': return 'draw';
    case 'foresee': return 'scry';
    case 'gainLife': return 'lifegain';
    case 'extraLandDrop': return 'ramp';
    case 'raise': return 'reanimate';
    // §4t: self-discard (loot) nets against the draw class it filters, so a
    // loot's colour weight is its net 0.5, not the gross draw 1.65. The
    // `who: 'opponent'` shape is the legacy pie-only discard class.
    case 'discard': return op.who === 'self' ? 'draw' : 'discard';
    // §4t: an edict is creature removal (black primary, red secondary).
    case 'sacrifice': return 'kill';
    case 'loseLife': return 'drain';
    case 'destroyArtifactOrSeverEnchantment': case 'destroyNewestOpponentArtifactOrEnchantment': return 'disenchant';
    default: return null;
  }
}
/** Off-pie premium parts for a card: once per distinct effect class, SCALED
 * by the class's MEP weight on the card. MTG charges the pie premium when the
 * off-pie effect is the card's identity, not an incidental rider — a green
 * card with a scry-1 tag is not Ancestor's Vision. Full premium at >= 1.0 MEP
 * of class weight, proportional below (so a 0.4-MEP rider pays 0.4x). */
function piePremiums(card: ScorableCardDef, unknowns: UnknownCollector): Part[] {
  const weight = new Map<string, number>();
  const scan = (ops?: ScorableEffectOp[], targetWhat?: string) => {
    for (const o of ops ?? []) {
      const k = pieClassOf(o, targetWhat);
      if (!k) continue;
      const raw = valueOp(o, false, card, 'spell', targetWhat, unknowns).v;
      // Self-discard is the one signed entry: it subtracts from the draw
      // class (see pieClassOf). A negative class total pays no premium.
      const v = o.op === 'discard' && o.who === 'self' ? raw : Math.max(0, raw);
      weight.set(k, (weight.get(k) ?? 0) + v);
    }
  };
  for (const ab of card.abilities ?? []) scan(ab.ops, ab.targets?.[0]?.what);
  scan(card.empower?.ops);
  for (const duty of dutiesOf(card)) scan(duty.ops, duty.targets?.[0]?.what);
  for (const ch of card.chapters ?? []) scan(ch);
  if (card.manaAbility?.length && !card.types.includes('land')) weight.set('ramp', 1.3);
  const out: Part[] = [];
  const colors = (card.colors ?? []) as ('W' | 'U' | 'B' | 'R' | 'G')[];
  for (const [k, w] of weight) {
    const def = PIE[k];
    if (!def) continue;
    const tier = colors.length
      ? Math.min(...colors.map((c) => def.pie[c] ?? OFF))
      : def.colorless;
    const prem = tier * Math.min(1, w);
    if (prem > 0.01) out.push({ label: `off-pie: ${k}`, v: round(prem) });
  }
  return out;
}

// Instant (charm) flexibility premium applied to the spell-effect total.
export const CHARM_MULT = 1.12;

// Creature body: 0.5×(A+D) puts a vanilla 2/2@2, 3/3@3 at Δ≈0 (Grizzly/Hill Giant).
export const BODY_PER_STAT = 0.5;

// Evergreen keyword premiums on a creature (flat v1; real value scales w/ body).
// v2 adds `dreaded` (Menace) — the Keyword union already carried it, but v1's
// map omitted it, so every dreaded card scored `KEYWORD_VALUE[k]` as
// `undefined` and poisoned its PowerScore to NaN. That is the crash the v2
// task brief refers to.
export const KEYWORD_VALUE: Record<Keyword, number> = {
  skyborne: 0.75, // flying
  wardingGaze: 0.2, // reach
  firstBlade: 0.5, // first strike
  twinBlades: 1.25, // double strike
  warcry: 0.35, // haste
  overrun: 0.35, // trample
  sentinel: 0.4, // vigilance
  bulwark: -0.75, // defender (drawback: can't attack)
  deathblade: 0.75, // deathtouch
  bloodoath: 0.4, // lifelink
  untouchable: 0.6, // hexproof (from opponents)
  dreaded: 0.45, // menace (v2) — anchor: gm-manor-thrall, see ANCHORS below
  rage: -0.45, // attacks every turn if able (drawback) — power-formula §4o
};

/**
 * §4o: Rage costs -0.45 alone, but only -0.15 on a creature that already
 * carries an attack-oriented keyword — a card that was attacking anyway barely
 * feels the compulsion. Applied as a rebate on top of the flat rate above.
 */
const RAGE_ATTACK_KEYWORDS: Keyword[] = ['twinBlades', 'warcry', 'overrun', 'firstBlade'];
export function rageRebate(keywords: readonly Keyword[] | undefined): number {
  if (!keywords?.includes('rage')) return 0;
  return keywords.some((k) => RAGE_ATTACK_KEYWORDS.includes(k)) ? 0.3 : 0;
}

/** Defensive keyword lookup: flags anything missing instead of NaN-poisoning a card. */
function kwValue(k: Keyword, unknowns: UnknownCollector): number {
  const v = KEYWORD_VALUE[k];
  if (v === undefined) {
    unknowns.add(`keyword:${k}`);
    return 0;
  }
  return v;
}

// How much a triggered ability is worth relative to the same effect on a spell.
// v2 adds `entersGraveyard` (0.5) — previously fell through to the `?? 1.0`
// default, i.e. scored as if it were a spell-speed effect. Typed as a full
// Record<Exclude<TriggerWhen, CarrierTriggerWhen>, number> so a future
// TriggerWhen addition is a compile error here (or in CARRIER_TRIGGER_MULT
// below, for the recurring observers priced per carrier type), not another
// silent default.
export const TRIGGER_MULT: Record<Exclude<ScorableTriggerWhen, CarrierTriggerWhen>, number> = {
  arrives: 0.75,
  dies: 0.6,
  attacks: 0.8,
  combatDamageToPlayer: 0.7,
  spell: 1.0,
  static: 1.0,
  entersGraveyard: 0.5, // v2 — a "when this creature would die" rider; narrower than `dies` (fires on card-leaves-battlefield-to-grave specifically, not e.g. a bounced/severed exit that dies also would not cover), and it stacks with the death itself, so it is priced BELOW `dies` (0.6).

  // ── §4m Starborne mark observers (2026-08-29) ─────────────────────────────
  // These fire once per INDIVIDUAL mark added (addMarks loops per mark and
  // fires a fresh event each time), never once per batch, and the engine has
  // no per-turn limiter and no cap on marks per permanent. Mark-event
  // abilities may not themselves add marks (depth guard at 8), so these are
  // plain linear frequency multipliers with no compounding term.
  //
  // The ORDERING is fixed by the dispatch conditions, not by name:
  //   gainsMark (host only) < yourCreatureMarked (your creatures)
  //   < yourPermanentMarked (your permanents, a strict superset)
  //   ~= youAddMark (keyed to the ACTOR, so anything you mark anywhere)
  //   < otherCreatureMarked (any creature either side, minus the host).
  // Scale reference: `dawn` = 2.0 on a creature carrier (guaranteed every
  // turn). A mark deck marks at least once most turns, so the mid-family sits
  // just under dawn; the widest observer edges above it.
  // NOTE (§9/§7): the "payoff keyed to counter placement" template has NO
  // pre-2018 MTG precedent — it is a modern consolidation that never existed
  // at our target power level — so this family is anchored on our own
  // dawn calibration (itself MTG-derived) rather than directly on a printing.
  gainsMark: 1.4,
  yourCreatureMarked: 1.9,
  yourPermanentMarked: 2.0,
  youAddMark: 2.0,
  otherCreatureMarked: 2.1,
  // Once per resolved `propagate`, NOT once per permanent it marks, and it
  // needs a propagate source in play: the narrowest of the observers.
  propagated: 1.2,
  // Fires once per MARKED ATTACKER inside a single Declare Attackers, so a
  // three-attacker swing fires it three times. MTG prices the ally-wide
  // version of an attack trigger about two mana above the self-only version
  // (Hellrider {2}{R}{R} rare vs Falkenrath Perforator {1}{R} common, same "1
  // damage per attack"), against our self-only `attacks` = 0.8. This rate is
  // deliberately conservative relative to that premium.
  markedAllyAttacks: 2.5,
  // Impact Tremors class: "whenever another creature you control enters".
  // MTG absorbs the SMALL version of this (gain 1 / deal 1) into the body at
  // no extra mana across a large common cluster (Impassioned Orator,
  // Hinterland Sanctifier, Lifecreed Duo, Suture Priest), which on our scale
  // is a modest premium over one-shot, well below guaranteed-every-turn dawn.
  allyCreatureArrives: 1.5,

  // §4t Drowned Deep (2026-09-24). "Whenever you gain life" (Ajani's
  // Pridemate family). NEEDS MATH: the era prices it close to free on the
  // body (Pridemate M11 {1}{W} 2/2 reads -0.08 on the v3 budget; Ageless
  // Entity DST {3}{G}{G} 4/4 implies 0.1-0.5 per trigger), because the fire
  // rate is lifegain density, which is a deck property. 0.3 is the
  // provisional until a seeded matrix counts lifegain events per turn in the
  // Drowned Deep white decks. `oncePerTurn` caps it far above this.
  youGainLife: 0.3,
};

// §4t (2026-09-24) — recurring observers priced per CARRIER, like `dawn`
// (§4i): a non-creature carrier survives the format's scarce artifact and
// enchantment removal, a creature carrier dies in combat and has its body
// priced separately. Every rate here is backed out on the v3 budget from
// era-filtered printings; the full tables are in power-formula.md §4t.
export type CarrierTriggerWhen = 'dawn' | 'sunset' | 'allyDies' | 'allyAttacks' | 'youCastCharm';
export const CARRIER_TRIGGER_MULT: Record<Exclude<CarrierTriggerWhen, 'dawn' | 'sunset'>, { creature: number; noncreature: number }> = {
  // "Whenever a creature you control dies". Creature carriers: Sek'Kuar
  // (CSP) 0.88, Stalking Vengeance (DIS) 1.58, Butcher of Malakir (WWK)
  // 0.80, Pawn of Ulamog (ROE) ~1.2, Zulaport Cutthroat 1.31, Cruel
  // Celebrant 1.17, Vindictive Vampire 1.51 -> median 1.2. Non-creature:
  // Grave Pact (STH; 8ED/9ED/10E) 2.48, Dark Prophecy (VIS) 2.88 -> 2.5 on
  // the core-set anchor. Proper Burial (7.8) is a lifegain trinket, excluded
  // as §4i excluded the Honden of Cleansing Fire.
  allyDies: { creature: 1.2, noncreature: 2.5 },
  // "Whenever a creature you control attacks", once per attacker. Creature:
  // Hellrider (DKA) implies 2.1; held at 2.5 so it is never below its
  // narrower sibling `markedAllyAttacks`. Non-creature: Raid Bombardment (ROE
  // 2010, four months past the era cut, common) implies 6.1 while ALSO
  // restricted to power 2 or less, so 6.0 is its conservative reading.
  allyAttacks: { creature: 2.5, noncreature: 6.0 },
  // "Whenever you cast a Charm". NEEDS MATH: the era only prices the wider
  // "instant or sorcery" / "Spirit or Arcane" versions (Kami of the Waning
  // Moon 1.41, Wee Dragonauts 0.74, Thief of Hope ~0.2-0.5, creature
  // carriers; median 0.75), and the fire rate is Charm density, a deck
  // property. Non-creature = x1.5, the dawn carrier ratio. Measure Charms
  // cast per game on the seeded matrix.
  youCastCharm: { creature: 0.75, noncreature: 1.1 },
};
// `sunset` fires at EVERY end step, both players' turns: the MTG "at the
// beginning of each end step" template, twice per turn cycle against dawn's
// once. Structural, checked against Deathreap Ritual (CNS 2014, the exact
// each-end-step + morbid shape): its implied 2.2-2.4 total matches
// 2 x 3.0 x the morbid gate 0.4 = 2.4.
export const SUNSET_PER_DAWN = 2;

function isCarrierWhen(w: ScorableTriggerWhen): w is CarrierTriggerWhen {
  return w === 'dawn' || w === 'sunset' || w === 'allyDies' || w === 'allyAttacks' || w === 'youCastCharm';
}

// dawn — RECALIBRATED 2026-08-28 (owner-directed, §4i): dawn (start-of-
// controller's-turn, recurs every turn) used to get a flat 1.1x — barely
// above one-shot, which is why value engines scored cold across the board.
// Backed out from era-filtered MTG recurring-effect precedent (the Honden
// cycle's per-shrine trigger, Phyrexian Arena, Underworld Dreams, Curse of
// the Pierced Heart): implied multiplier = (MV × our rarityMult) ÷
// per-trigger MEP value, in OUR §4b rates. That spread ran ~2.2 (Phyrexian
// Arena, a pushed staple — floor, not target) to ~4.4 (weak single-effect
// triggers); the clean fair-to-weak median landed ~3.5, so a flat "fair"
// multiplier sits around 3.0.
//
// Split by carrier type (owner-directed format adjustment): our live pool
// has only 5 cards that can destroy/sever an artifact or enchantment vs 17
// that can destroy/sever a creature (`src/data/cards` grep, 2026-08-28) — a
// noncreature dawn engine in this format is far harder to remove than an
// MTG analog assumes, so it survives to trigger far more often and should
// NOT be discounted below the fair-fit rate. A creature dawn carrier dies to
// the abundant creature-removal pool AND already banks body/keyword value
// through the normal creature parts above, so it gets the softer,
// MTG-precedent-backed rate for a value engine that also has to survive
// combat. See §4i for the full calibration table and worked examples.
export const DAWN_MULT_NONCREATURE = 3.0; // artifacts/enchantments — scarce removal here, at the fair-fit rate
export const DAWN_MULT_CREATURE = 2.0; // creatures — dies more, already has a priced body

export function dawnMult(card: ScorableCardDef): number {
  return card.types.includes('creature') ? DAWN_MULT_CREATURE : DAWN_MULT_NONCREATURE;
}

/** Defensive trigger-mult lookup (the Record above is exhaustive over every
 * TriggerWhen except `dawn`, which is per-card via dawnMult() — this keeps
 * the same no-silent-zero contract as everything else in this file). */
export function triggerMult(w: ScorableTriggerWhen, card: ScorableCardDef, unknowns: UnknownCollector = new Set<string>()): number {
  if (isCarrierWhen(w)) {
    if (w === 'dawn') return dawnMult(card);
    if (w === 'sunset') return SUNSET_PER_DAWN * dawnMult(card);
    const split = CARRIER_TRIGGER_MULT[w];
    return card.types.includes('creature') ? split.creature : split.noncreature;
  }
  const v = TRIGGER_MULT[w];
  if (v === undefined) {
    unknowns.add(`when:${w}`);
    return 1.0;
  }
  return v;
}

// Assume this many of your creatures benefit from a team/anthem effect. 2.0 is a
// just-cast lord/anthem's realistic board (calibrated against Codex: TEAM_FACTOR
// 2.5 over-credited 2/2 lords like Lu Meng / Beastkin Packmother).
export const TEAM_FACTOR = 2.0;
// §4m — a marked-only board-wide effect reaches most, not all, of your board.
export const MARKED_TEAM_FACTOR = 1.4;
// §4m — nominal count of MARKED creatures on an engaged opponent's board.
// Zero against every deck that does not generate marks; the anti-mark package
// is authored to come alive against the Starborne AI decks. Metagame-dependent
// by design (§7), so payoffs keyed to it are scored against this nominal board
// rather than at ~0, which would wrongly read them as under-costed.
export const NOMINAL_THEIR_MARKED = 2.0;
// Nominal X for scoring X-spells (reference point; flagged separately).
export const NOMINAL_X = 3;

// v2 — nominal awakening magnitude used when an `awaken` op's source card
// carries no `awakening` rider of its own (a "champion payoff" Quest/artifact
// that awakens OTHER creatures already on the battlefield, e.g. Quest for the
// Grail). The real value depends on what the rest of the deck is carrying —
// unknowable at single-card scoring time — so this is a nominal stand-in, the
// same spirit as NOMINAL_X. Calibrated as the midpoint of the two *known*
// awakening riders in the pool (Twice-Chosen Shieldmaiden +2/+1 = 1.5 MEP;
// Thorn-Palace Heiress +2/+2/overrun = 2.35 MEP) → ~2.0. See §7 addendum.
export const NOMINAL_AWAKEN_DELTA = 2.0;

// §4t Drowned Deep op rates (2026-09-24); each is sourced where it is used in
// valueOp below and tabulated in power-formula.md §4t.
export const SELF_DISCARD_RATE = 1.15;
export const RECLAIM_SELF_VALUE = 1.65;
export const TAP_ALL_VALUE = 2.6;
export const EDICT_OPPONENT = 1.9;
export const EDICT_EACH = 1.0;
export const PREVENT_COMBAT_TO_VALUE = 1.0;
export const ONE_SIDED_SWEEP_MULT = 1.5;
// §4t gates. An observer filter narrows WHICH deaths count; the engine reads
// `filter` only on allyDies / allyAttacks (fireCreatureObservers).
//   subtype   x0.5: Rotlung Reanimator (ONS, Clerics) 0.39 and Knucklebone
//             Witch (LRW, Goblins) 0.53 of the unfiltered creature rate.
//   sacrifice x0.5, NEEDS MATH: no clean precedent (Dragon Appeasement, the
//             lone era "whenever you sacrifice", is bundled with skipping the
//             draw step). Measure sacrifices per game in a Tithe deck.
//   other     x1.0: the anchors mix "another" and "this or another" with no
//             measurable gap.
export const FILTER_SUBTYPE_MULT = 0.5;
export const FILTER_SACRIFICE_MULT = 0.5;
// Conditions (§4n family).
//   creatureDiedThisTurn x0.4: Innistrad morbid, n=5 (Ulvenwald Bear,
//     Wakedancer, Morkrut Banshee, Hollowhenge Scavenger, Woodland Sleuth):
//     formula median 0.55, vanilla-curve median 0.27.
//   controlsOther x0.6, NEEDS MATH: the Shadowmoor Cohorts and Alara blades
//     ("as long as you control another <colour / multicoloured>", n=9) gate
//     at a median ~0.45, but on 2-3 drops early in the game; the shipped
//     carrier is a 7-drop checking at Dawn in a tribal deck.
export const COND_CREATURE_DIED = 0.4;
export const COND_CONTROLS_OTHER = 0.6;
// Several Duties on one card share the single {T}: at most one fires per
// untap. The best Duty is priced in full, each other at this share. NEEDS
// MATH (a midpoint, like §4q's D): Grixis Battlemage (ALA) prices its second
// tap mode at ~35%, Blightspeaker (PLC) and the Invasion Apprentices at ~0.
export const DUTY_SHARED_TAP_SHARE = 0.2;

// ── Effect valuation ─────────────────────────────────────────────────────────

export interface Part {
  label: string;
  v: number;
}

/** Magnitude of a stat/keyword delta, in the same units the body/aura use. */
function statKwMagnitude(p: number | undefined, t: number | undefined, keywords: Keyword[] | undefined, unknowns: UnknownCollector): number {
  return 0.5 * ((p ?? 0) + (t ?? 0)) + (keywords ?? []).reduce((s, k) => s + kwValue(k, unknowns), 0);
}

/** v2 — awaken op valuation. Needs the source CardDef for its own `awakening` rider. */
function valueAwaken(op: Extract<ScorableEffectOp, { op: 'awaken' }>, card: ScorableCardDef, unknowns: UnknownCollector): Part {
  if (op.scope === 'self') {
    if (!card.awakening) {
      // Matches the engine: `awakenPermanent` is a true no-op with no own
      // awakening rider (src/engine/effects/EffectInterpreter.ts). Not an
      // "unknown" — a genuinely inert ability, scored at 0.
      return { label: 'awaken(self, no rider — inert)', v: 0 };
    }
    const mag = statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns);
    return { label: 'awaken(self)', v: 0.6 * mag };
  }
  // scope 'allYours': every creature you control with its OWN awakening rider
  // awakens (src/engine/effects/EffectInterpreter.ts `awakenPermanent` reads
  // each permanent's own card def, not the source's). If this card is itself
  // a creature carrying `awakening`, it is at least one guaranteed beneficiary;
  // otherwise this is a pure payoff card and we fall back to the nominal rate.
  const mag = card.awakening
    ? statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns)
    : NOMINAL_AWAKEN_DELTA;
  const nominalTag = card.awakening ? '' : ', nominal';
  return { label: `awaken(allYours${nominalTag})`, v: 0.6 * mag * TEAM_FACTOR };
}

/** Value one EffectOp. `canFace` = the owning ability can target a player. */
export function valueOp(
  op: ScorableEffectOp,
  canFace: boolean,
  card: ScorableCardDef,
  when: ScorableTriggerWhen = 'spell',
  targetWhat?: string,
  unknowns: UnknownCollector = new Set<string>(),
): Part {
  switch (op.op) {
    case 'damage': {
      const n = op.n === 'X' ? NOMINAL_X : op.n;
      const damageTarget = op.to;
      switch (damageTarget) {
        case 'controller':
          return { label: `self-dmg ${n}`, v: -SELF_DMG_RATE * n };
        case 'opponent':
          return { label: `face dmg ${n}`, v: 0.15 + 0.3 * n };
        case 'eachCreature': {
          // v2 — Pyroclasm-class symmetric sweeper (EffectInterpreter hits
          // every creature on the battlefield, both controllers). No any-
          // target burn floor: this never removes a specific threat on
          // demand, it just costs both boards n damage across the board.
          // §4l: severOnDeath is a RIDER FLAG on this op (not a new op, so
          // the exhaustiveness guard never trips on it) — damaged creatures
          // that would die this turn are severed instead. +0.70 flat
          // (Anger of the Gods / Lava Coil exile-rider band).
          const sever = (op as { severOnDeath?: boolean }).severOnDeath ? 0.7 : 0;
          return {
            label: sever ? `sweep ${n} + sever-on-death` : `sweep ${n}`,
            v: 0.9 + 0.55 * n + sever,
          };
        }
        case 'eachOpponentCreature': {
          // §4t — the one-sided sweeper: the symmetric rate above x1.5.
          // Simoon (VIS, 1 to each creature an opponent controls) implies
          // x1.43; Flame Wave (STH, 9ED; 4 to a player and each of their
          // creatures) implies x1.9 raw, inflated by the formula's known
          // over-read at mana value 7.
          const sever = (op as { severOnDeath?: boolean }).severOnDeath ? 0.7 : 0;
          return {
            label: sever ? `one-sided sweep ${n} + sever-on-death` : `one-sided sweep ${n}`,
            v: ONE_SIDED_SWEEP_MULT * (0.9 + 0.55 * n + sever),
          };
        }
        case 'target':
          // to a target: any-target burn has removal utility (higher floor) vs creature-only.
          // v2.6 SLOPE CORRECTION (owner-approved 2026-08-28, see §4k): the v1
          // rate `0.60 + 0.35n` was calibrated at Shock (n=2) then extrapolated
          // LINEARLY, but real burn runs ~1 mana per damage point beyond the
          // first (Lightning Strike 3 = MV2, Flame Javelin 4 ~ MV3, Fireball
          // X=5 = MV6). By n=5 the old rate under-priced by nearly two mana and
          // produced cost-cut proposals that would have printed "5 damage to
          // any target" at MV2. The max() leaves every n<=2 value — and so
          // every §6 anchor — byte-identical, correcting only the extrapolation.
          return canFace
            ? { label: `burn any ${n}`, v: Math.max(0.6 + 0.35 * n, 1.3 + 1.0 * (n - 2)) }
            : { label: `burn creature ${n}`, v: 0.5 + 0.35 * n };
        default: {
          const _exhaustive: never = damageTarget;
          unknowns.add(`damage.to:${String(_exhaustive)}`);
          return { label: 'unknown damage.to', v: 0 };
        }
      }
    }
    case 'gainLife':
      return { label: `gain ${op.n}`, v: 0.2 * op.n };
    case 'loseLife':
      return { label: `drain ${op.n}`, v: 0.5 * op.n };
    case 'draw':
      return { label: `draw ${op.n}`, v: 0.3 + 1.35 * op.n };
    case 'discard':
      // §4t — self-discard (the loot's second half), the controller's choice.
      // Backed out of the creature loot family on the v3 budget against
      // draw 1 = 1.65: Merfolk Looter (10E) / Thought Courier (9ED) -1.19,
      // Merfolk Traders / Vodalian Merchant (arrival loot) -1.09. A loot is
      // then worth 0.50 per fire, next to scry 2's 0.55: card-neutral
      // filtering. One-shot draw-2-or-3 loots read 0.2-0.6 cold at this rate
      // (Catalog 8ED, Sift 9ED/10E), because the card discarded is the worst
      // of a bigger selection; every shipped carrier draws 1.
      return { label: `discard ${op.n} (self)`, v: -SELF_DISCARD_RATE * op.n };
    case 'discardRandom':
      return { label: `discard ${op.n}`, v: 0.9 * op.n };
    case 'destroy':
      // v3.1 owner-caught (Recant the Vow): destroy/sever aimed at an
      // ENCHANTMENT or ARTIFACT is Disenchant-class removal, not creature
      // kill - both the rate (1.7/1.9 vs 2.7/2.9) and the colour pie change
      // (white is PRIMARY on enchantment removal; the old read charged white
      // the off-pie creature-kill premium).
      if (targetWhat === 'enchantment' || targetWhat === 'artifact' || targetWhat === 'artifactOrEnchantment') {
        return { label: `disenchant (${targetWhat === 'artifactOrEnchantment' ? 'artifact/ench' : targetWhat})`, v: 1.7 };
      }
      return { label: 'destroy', v: 2.7 };
    case 'sever':
      if (targetWhat === 'enchantment' || targetWhat === 'artifact' || targetWhat === 'artifactOrEnchantment') {
        return { label: `sever ${targetWhat === 'artifactOrEnchantment' ? 'artifact/ench' : targetWhat}`, v: 1.9 };
      }
      return { label: 'exile', v: 2.9 };
    case 'severGrave':
      return { label: 'grave-hate', v: 0.4 + 0.1 * op.n };
    case 'severTop':
      return { label: 'self-mill(sever)', v: 0.1 * op.n };
    case 'recall':
      return { label: 'bounce', v: 1.0 };
    case 'destroyArtifactOrSeverEnchantment':
      // v2 (≈Disenchant) — branch is artifact-first destroy, else enchantment
      // sever; either way it is unconditional 2-for-1-proof removal of a
      // whole permanent class. Anchor: Disenchant {1}{W} = MV2 fair common;
      // priced a shade below `destroy` (2.7) because roughly half the format
      // (creatures) is untouched by it.
      return { label: 'disenchant', v: 1.7 };
    case 'cancel':
      return { label: 'counter', v: 2.7 };
    case 'boost': {
      const stats = 0.2 * (op.p + op.t);
      const kw = (op.keywords ?? []).reduce((s, k) => s + 0.5 * kwValue(k, unknowns), 0);
      const base = stats + kw + 0.3;
      const boostScope = op.scope;
      switch (boostScope) {
        case 'target':
          // v2.1 — a targeted DEBUFF (-X/-X trick) is pseudo-removal, not a
          // negative-value spell: value by magnitude, keeping the +0.3 spell
          // floor. Anchor: Disfigure {B} (-2/-2 instant) fair at MV1 →
          // 0.2×4 + 0.3 = 1.1, ×1.12 charm ≈ 1.23 vs B 1.0 = Δ+0.23 (Shock-class).
          if (op.p + op.t < 0) {
            const magKw = (op.keywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns)), 0);
            return { label: `debuff ${op.p}/${op.t}`, v: 0.2 * Math.abs(op.p + op.t) + magKw + 0.3 };
          }
          return { label: `pump +${op.p}/+${op.t}`, v: base };
        case 'self':
          // §4t — a self-only, until-end-of-turn pump (the "whenever this
          // attacks, it gets +X/+0" family) priced in BODY units, the way the
          // `self` static scope and awaken(self) already are, not at the
          // pump-spell rate. On the six era anchors it centres Δ at -0.37
          // (Wei Ambush Force -0.12, Hollow Dogs 9ED -0.58, Charging Paladin
          // +0.46) where the spell rate sits at -0.77.
          return { label: `self pump ${sign(op.p)}/${sign(op.t)}`, v: statKwMagnitude(op.p, op.t, op.keywords, unknowns) };
        case 'allYours':
          return { label: `team pump +${op.p}/+${op.t}`, v: base * TEAM_FACTOR };
        case 'all': {
          // v2 — symmetric (helps BOTH players' creatures per
          // EffectInterpreter). Valued on raw |stats|+|keywords| magnitude
          // (not the signed `base`, which bakes in a +0.3 "being a spell"
          // floor meant for one-sided pumps) at a modest 1.2x, not the
          // one-sided 2.0x TEAM_FACTOR. Anchor: a board-wide -1/-1 (Nausea/
          // Crippling Fear-class) is weak, narrow, situational removal —
          // matches so-creeping-malaise landing clearly cold below.
          const magKw = (op.keywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns)), 0);
          const mag = Math.abs(stats) + magKw;
          return { label: `symmetric pump ${op.p >= 0 ? '+' : ''}${op.p}/${op.t >= 0 ? '+' : ''}${op.t}`, v: mag * 1.2 };
        }
        // §4m — board-wide but restricted to MARKED creatures, no target choice.
        // `yourMarked` is a narrowed allYours: in a mark deck most of your
        // board is marked, but not all of it, so it sits below TEAM_FACTOR.
        case 'yourMarked':
          return { label: `marked-team pump +${op.p}/+${op.t}`, v: base * MARKED_TEAM_FACTOR };
        // `theirMarked` only ever carries DEBUFFS in the shipped set, and is
        // live only against an opponent who generates marks. Valued by
        // magnitude against the nominal engaged-opponent board (§4m, §7).
        case 'theirMarked': {
          const magKw = (op.keywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns)), 0);
          const mag = Math.abs(stats) + magKw + 0.3;
          return { label: `marked-enemy debuff ${op.p}/${op.t} (nominal)`, v: mag * NOMINAL_THEIR_MARKED };
        }
        default: {
          const _exhaustive: never = boostScope;
          unknowns.add(`boost.scope:${String(_exhaustive)}`);
          return { label: 'unknown boost.scope', v: 0 };
        }
      }
    }
    case 'addCounters':
      return { label: `+1/+1 ×${op.n}`, v: 0.7 * op.n };
    // ── §4m Starborne mark vocabulary (2026-08-29) ──────────────────────────
    case 'fetchLand':
      // Rampant Growth / Shared Roots {1}{G}: search a basic, battlefield
      // TAPPED = a fair 2-mana sorcery; Lay of the Land {G} shows to-hand is
      // exactly one mana cheaper. Ours is slightly BETTER than the anchor (the
      // engine fetches ANY land, duals included), so it sits at the top of the
      // 2-mana band rather than the middle.
      return { label: 'fetch land (tapped)', v: 1.9 };
    case 'markAll':
      // Basri's Solidarity {1}{W} is textless "+1/+1 counter on each creature
      // you control" at 2 mana. Priced just under a whole fair 2-mana card,
      // since our version rides other text rather than being the whole card.
      return { label: 'mark all your creatures', v: 1.8 };
    case 'moveMark':
      // Bioshift {G/U} moves ANY NUMBER of +1/+1 counters for one mana at
      // common. Ours moves exactly ONE and both ends must be your own
      // permanents (a controller check in runOp on top of the target spec), so
      // net board stats never change. Strictly weaker than the anchor.
      return { label: 'move 1 mark (own side)', v: 0.5 };
    case 'removeMarks':
      // NEEDS MATH (§9): Magic has essentially NO precedent for stripping an
      // opponent's +1/+1 counters — the colour pie answers big creatures with
      // -X/-X, damage or removal instead. Provisional rate for a full wipe of
      // one creature's marks, to be replaced with a measured number once the
      // Starborne AI decks make it live. See §7.
      return { label: 'remove all marks (target, NEEDS MATH)', v: 0.6 };
    case 'severSelf':
      // MTG treats self-exile as a PAYMENT METHOD, not a discount (Hanged
      // Executioner): the card is spent so the attached ability may hit above
      // its weight. So this is a small real cost, and the paired effect keeps
      // full credit rather than being inflated.
      return { label: 'sever self (cost)', v: -0.3 };
    case 'loseLifePerTheirMarked':
      // Counts the OPPONENT's marked creatures. Live only against a
      // mark-generating opponent, which in a single-player game is an authored
      // matchup: black is the anti-mark police and its payoffs come alive
      // against the Starborne AI decks. Scored against a nominal engaged board
      // (§4m) and flagged metagame-dependent in §7 rather than scored at ~0,
      // which would wrongly recommend cost cuts.
      return { label: 'drain per their marked (nominal)', v: 0.15 + 0.3 * NOMINAL_THEIR_MARKED };
    case 'ifTargetMarked': {
      // Conditional wrapper: `then` on a marked target, `else` (or nothing) on
      // an unmarked one. Both shipped users are debuff charms whose `then`
      // branch is stronger. The marked branch is live only against a
      // mark-generating opponent (see loseLifePerTheirMarked above), so this
      // is an even blend of the two branches rather than the optimistic read.
      const gate = op as Extract<ScorableEffectOp, { op: 'ifTargetMarked' }>;
      const sum = (ops: ScorableEffectOp[]) => ops.reduce((s, o) => s + valueOp(o, canFace, card, when, targetWhat, unknowns).v, 0);
      const thenV = sum(gate.then ?? []);
      const elseV = sum(gate.else ?? []);
      return { label: 'if-marked (blended branches)', v: 0.5 * thenV + 0.5 * elseV };
    }
    case 'tap':
      return { label: 'tap', v: 0.4 };
    case 'propagate': {
      // v2.4 OWNER-CALIBRATED (2026-08-28) against MTG's Proliferate pricing:
      // a single stapled proliferate is worth ~0.5-1 mana (Experimental
      // Augury / Reject Imperfection / Volt Charge premiums), and a
      // REPEATABLE source is priced far higher, ~1.75 mana per trigger
      // (Planewide Celebration at ~1.75/instance). Ours hits ALL your marked
      // permanents with NO choice (Proliferate picks), so both numbers take
      // a small no-choice discount: one-shot 0.70, repeatable 1.65/trigger
      // (PER-TRIGGER basis, owner ruling). The dawn case returns that 1.65
      // per-trigger value directly; the ×dawnMult() multiplier above (§4i,
      // 3.0 for the noncreature carrier this mechanic ships on) turns it
      // into the priced expected-total-value part, e.g. 1.65 × 3.0 = 4.95.
      // Parasitic floor stays: worth 0 on a blank board (mark-synergy blind
      // spot).
      if (when === 'dawn') return { label: 'propagate (repeatable, per-trigger)', v: 1.65 };
      return { label: 'propagate (one-shot)', v: 0.7 };
    }
    case 'extraLandDrop': {
      // v2 (≈Explore-class ramp/land-drop enabler). Flat per use; op.n is
      // rarely printed (defaults to 1 extra drop) but honored if present.
      // v3 WARCHEST CORRECTION (2026-08-29): 0.9 was the MTG rate, where an
      // extra land drop is dead unless you happen to hold a land. Our land
      // reserve (LAND_RESERVE_SIZE = 10) GUARANTEES one, so this is never a
      // blank — it is real ramp every time, closer to Rampant Growth (a fair
      // 2-mana sorcery) than to Explore's conditional half. Under the old
      // rate the batch proposed cutting Verdant Invitation to {G}, which is
      // mana-neutral ramp in this format.
      // v3.2 (2026-09-04, owner catch after 1.7 shipped): 1.6 was still a
      // hedge. The retired `fetchLand` op sat at 1.9 on the Rampant Growth
      // anchor, and when its cards were converted to `extraLandDrop` the
      // rate silently dropped 0.3 for an IDENTICAL result - one guaranteed
      // land, entering tapped. Restored to the anchor. Note what the rate
      // cannot do on its own: a {G} single-op ritual lands at +0.80, inside
      // the fair band, because one mana step (0.82) is narrower than the
      // outlier band (1.5). The turn-2 curve is what makes {G} ramp
      // format-warping, and that is a FLOOR rule (see §4p), not a rate.
      const n = op.n ?? 1;
      return { label: n > 1 ? `extra land drop ×${n}` : 'extra land drop', v: 1.9 * n };
    }
    case 'createToken':
      return { label: `token ×${op.count}`, v: op.count * (tokenBody(op.token, unknowns) + 0.3) };
    case 'destroyNewestOpponentArtifactOrEnchantment':
      // v2 — trigger-safe sibling of `destroyArtifactOrSeverEnchantment`: no
      // target choice (always the newest), so priced below the targeted
      // version (1.7) the same way `raise: 'top'` sits below a targeted raise.
      return { label: 'disenchant(newest, no choice)', v: 1.2 };
    case 'massDestroy': {
      switch (op.filter) {
        case 'allCreatures':
          return { label: 'wrath', v: 4.0 };
        case 'allFliers':
          return { label: 'wrath(fliers)', v: 2.6 };
        case 'allEnchantments':
          // v2 — v1's `op.filter === 'allCreatures' ? 4.0 : 2.6` ternary
          // silently scored this (real, shipped) filter as `allFliers`'s 2.6.
          // Given its own rate: narrower than a fliers wipe in this format
          // (fewer live enchantment targets), and symmetric (hits the
          // caster's own enchantments too), so priced below both wraths.
          // Anchor precedent: Cleansing Meditation-class MTG sweepers are
          // narrow, low-priority sideboard cards.
          return { label: 'wrath(enchantments)', v: 2.0 };
        default: {
          const _exhaustive: never = op.filter;
          unknowns.add(`massDestroy.filter:${String(_exhaustive)}`);
          return { label: 'unknown massDestroy.filter', v: 0 };
        }
      }
    }
    case 'preventCombat':
      return { label: 'fog', v: 0.8 };
    case 'reclaim':
      return { label: 'regrowth(creature)', v: 1.0 };
    // ── §4t Drowned Deep vocabulary (2026-09-24) ────────────────────────────
    case 'reclaimSelf':
      // This card, graveyard to hand: a free extra copy of a known card,
      // priced as draw 1 (1.65), so the usual dies trigger lands at ~1.0.
      // Era "when this dies, return it to its owner's hand" rares bracket
      // that: Shivan Phoenix (ULG) 0.9 on the vanilla curve / 1.7 on the
      // formula, Weatherseed Treefolk (ULG) 0 / 1.2.
      return { label: 'return self to hand', v: RECLAIM_SELF_VALUE };
    case 'tapAll':
      // Tap every creature the opponent controls. At Ritual speed that is
      // "they cannot block this turn" (and their Duties wait a turn). The two
      // core-set anchors: Panic Attack (8ED/9ED, three targets cannot block)
      // 2.74, Deluge (10E, taps every non-flier) 2.45 -> 2.6. The family
      // runs Falter 1.71 (ground only) to Blinding Light 2.74.
      return { label: 'tap all opposing creatures', v: TAP_ALL_VALUE };
    case 'sacrifice':
      // Edicts (the victim chooses). Opponent: Cruel Edict (9ED/10E) 1.92,
      // Diabolic Edict (TMP, instant) 1.71 -> 1.9. Each player: Barter in
      // Blood (MRD) 0.99 per sacrifice, Innocent Blood (ODY, pushed) 1.10
      // -> 1.0.
      return op.who === 'each'
        ? { label: `each player sacrifices ${op.n}`, v: EDICT_EACH * op.n }
        : { label: `edict ${op.n}`, v: EDICT_OPPONENT * op.n };
    case 'preventCombatTo':
      // Prevent all combat damage to one creature this turn: a {W} trick.
      // Indestructible Aura (LEG, all damage) and Mending Hands (9ED, next
      // 4) are {W} instant commons, 0.98 each at the Charm premium.
      return { label: 'prevent combat damage to target', v: PREVENT_COMBAT_TO_VALUE };
    case 'grind':
      return { label: `mill ${op.n}`, v: 0.15 * op.n };
    case 'foresee':
      return { label: `scry ${op.n}`, v: 0.25 + 0.15 * op.n };
    case 'awaken':
      return valueAwaken(op, card, unknowns);
    case 'raise':
      // Unconditional reanimation-to-battlefield of any grave creature is strong
      // (Codex: Call the Einherjar {2}{B} beats Zombify {3}{B}). 2.2 undervalued it.
      return { label: 'reanimate', v: 3.5 };
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      unknowns.add(`op:${(op as ScorableEffectOp).op}`);
      return { label: 'unknown op', v: 0 };
    }
  }
}

export function valueStatic(st: StaticDef, _self: ScorableCardDef, unknowns: UnknownCollector = new Set<string>()): Part {
  switch (st.scope) {
    case 'attached': {
      // An aura is a useful CARD whether it buffs your creature (+P/+T, keywords)
      // or debuffs an enemy's (−P/−T = pseudo-removal / Pacifism). Value it by the
      // MAGNITUDE of its impact, then a 0.3 haircut for aura card-disadvantage risk.
      const mag = Math.abs(0.5 * ((st.p ?? 0) + (st.t ?? 0)))
        + (st.grantKeywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns)), 0);
      return { label: `aura ${sign(st.p)}/${sign(st.t)}`, v: Math.max(0, mag - 0.3) };
    }
    case 'self': {
      // v2 — a static granted only to its own source (e.g. Galahad, Silver
      // Oath's conditional self-untouchable). Valued exactly like the same
      // keyword/stat printed directly on the body: no team multiplier, no
      // aura haircut (it can't fall off — it dies with its own permanent
      // the same way a printed keyword would).
      const mag = statKwMagnitude(st.p, st.t, st.grantKeywords, unknowns);
      return { label: `self ${sign(st.p)}/${sign(st.t)}`, v: mag };
    }
    case 'filter': {
      // Anthem/lord: applies to the team (excluding self if `other`), recurring.
      const stats = 0.5 * ((st.p ?? 0) + (st.t ?? 0));
      const kw = (st.grantKeywords ?? []).reduce((s, k) => s + kwValue(k, unknowns), 0);
      if (st.filter?.who === 'opponent') {
        // 2026-09-11 (found scoring the Drowned Deep overplan): a static that
        // DEBUFFS the opponent's team is worth the magnitude of the debuff
        // (a reverse anthem, Night of Souls' Betrayal / Engineered Plague
        // shape), not a negative number. A keyword granted to the enemy team
        // is a drawback and stays negative.
        return { label: `enemy anthem ${sign(st.p)}/${sign(st.t)}`, v: (Math.abs(stats) - kw) * TEAM_FACTOR };
      }
      return { label: `anthem ${sign(st.p)}/${sign(st.t)}`, v: (stats + kw) * TEAM_FACTOR };
    }
    default: {
      const _exhaustive: never = st.scope;
      unknowns.add(`static.scope:${String(_exhaustive)}`);
      return { label: 'unknown static.scope', v: 0 };
    }
  }
}

const sign = (v: number | undefined): string => ((v ?? 0) >= 0 ? `+${v ?? 0}` : `${v}`);

// Token body lookup (tokens carry attack/defense; non-collectible).
// v2.5 (2026-08-28): tokens' KEYWORDS now count too — 8 of the 20 tokens carry
// one (skyborne bats/valkyries, deathblade grave roses, sentinel dolls...),
// and valuing only raw stats under-credited all 16 generator cards. Found by
// the dawn-recalibration batch hand-checking Nocturne Manor's Bat rider.
const TOKEN_DEFS = new Map(ALL_CARDS.filter((card) => card.token).map((card) => [card.id, card]));
function tokenBody(id: string, unknowns: UnknownCollector): number {
  const card = TOKEN_DEFS.get(id);
  if (!card) return 1.0;
  const body = BODY_PER_STAT * ((card.attack ?? 0) + (card.defense ?? 0));
  const kw = (card.keywords ?? []).reduce((sum, keyword) => sum + kwValue(keyword, unknowns), 0) + rageRebate(card.keywords);
  return body + kw;
}

// ── Card scoring ─────────────────────────────────────────────────────────────

const canFaceOf = (ab: ScorableAbilityDef): boolean => (ab.targets ?? []).some((t) => t.what === 'any');

export interface Score {
  id: string;
  name: string;
  rarity: Rarity;
  set: string;
  category: string;
  mv: number;
  isX: boolean;
  power: number;
  budget: number;
  delta: number;
  parts: Part[];
  /** v2 — card-level mechanic fields present, for downstream filtering. */
  mechanics: string[];
  /** Per-card unknown vocabulary. The CLI unions these and fails loudly. */
  unknowns: string[];
}

/** One Duty at the §4q rate (see the `activated` block in scoreCard). */
function valueDuty(ability: ScorableActivated, card: ScorableCardDef, unknowns: UnknownCollector): Part {
  const face = (ability.targets ?? []).some((t) => t.what === 'any');
  const targetWhat = ability.targets?.[0]?.what;
  let perTrigger = 0;
  for (const op of ability.ops) {
    const p = valueOp(op, face, card, 'spell', targetWhat, unknowns);
    perTrigger += op.op === 'tap' ? 1.0 : p.v;
  }
  const creatureCarrier = card.types.includes('creature');
  const topBand = creatureCarrier && perTrigger >= 2.0;
  const expected = topBand ? perTrigger + 1.0 : dawnMult(card) * perTrigger;
  const activationMana = manaValue(ability.cost.mana);
  const discount = Math.min(1.5, 0.4 * activationMana);
  const value = Math.max(0, expected - discount);
  const carrier = creatureCarrier ? 'creature' : 'non-creature';
  const mana = activationMana ? `, {${activationMana}} to activate` : '';
  const band = topBand ? ', NEEDS MATH band' : '';
  return { label: `duty (${carrier} carrier${mana}${band})`, v: value };
}

export function scoreCard(card: ScorableCardDef): Score {
  const unknowns = new Set<string>();
  const parts: Part[] = [];
  const isCreature = card.types.includes('creature');
  const isCharm = card.types.includes('charm');

  if (isCreature) {
    const body = BODY_PER_STAT * ((card.attack ?? 0) + (card.defense ?? 0));
    parts.push({ label: `body ${card.attack ?? 0}/${card.defense ?? 0}`, v: body });
    for (const k of card.keywords ?? []) parts.push({ label: k, v: kwValue(k, unknowns) });
    const rebate = rageRebate(card.keywords);
    if (rebate) parts.push({ label: 'rage on an attacker (§4o)', v: rebate });
    // v2.1 — carrying an `awakening` rider is worth something even when the
    // card cannot awaken itself (Quest/enabler decks turn it on). Half the
    // 0.6 awaken(self) rate for the external-enabler dependency. Self-awaken
    // cards are excluded — their own awaken op already credits the rider.
    const selfAwakens = (card.abilities ?? []).some((ab) =>
      (ab.ops ?? []).some((o) => o.op === 'awaken' && (o.scope === 'self' || o.scope === undefined)));
    if (card.awakening && !selfAwakens) {
      const mag = statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns);
      parts.push({ label: 'awakening rider (needs enabler)', v: round(0.3 * mag) });
    }
  }

  let spellEffect = 0;
  for (const ab of card.abilities ?? []) {
    let mult = triggerMult(ab.when, card, unknowns);
    // §4n (2026-08-29): a GATED ability is not an unconditional one — the
    // scorer priced all 25 conditioned abilities in the pool at full rate,
    // which is a big part of why Relay/Beacon read so hot. Comparative:
    // Threshold/Metalcraft-class gates discount an ability ~30-50% in MTG.
    //   questActive    ×0.70  (a quest deck keeps one active much of the game)
    //   controlMarked  ×0.85  (a mark deck is marked from early turns)
    //   markedThreshold ×0.75/0.65/0.55 by n (1-2 / 3 / 4+) — steepest gate;
    //     NEEDS MATH: no clean MTG analog for counter-count thresholds,
    //     re-check against seeded win rates when the mark decks land.
    let condMult = 1.0;
    if (ab.condition !== undefined) {
      const cond = ab.condition;
      if (cond === 'questActive') condMult = 0.7;
      else if (cond === 'controlMarked') condMult = 0.85;
      else if (cond === 'creatureDiedThisTurn') condMult = COND_CREATURE_DIED;
      else if (typeof cond === 'object' && cond.kind === 'controlsOther') condMult = COND_CONTROLS_OTHER;
      else if (typeof cond === 'object' && cond.kind === 'markedThreshold') {
        condMult = cond.n >= 4 ? 0.55 : cond.n === 3 ? 0.65 : 0.75;
      } else {
        unknowns.add(`condition:${JSON.stringify(cond)}`);
      }
    }
    // §4t — observer filters narrow which deaths/attacks fire the trigger.
    if (ab.filter) {
      if (ab.when !== 'allyDies' && ab.when !== 'allyAttacks') unknowns.add(`filter on when:${ab.when} (engine ignores it)`);
      for (const [key, set] of Object.entries(ab.filter)) {
        if (!set) continue; // an unset key (the builder's cleared checkbox) narrows nothing
        if (key === 'subtype') mult *= FILTER_SUBTYPE_MULT;
        else if (key === 'sacrifice') mult *= FILTER_SACRIFICE_MULT;
        else if (key !== 'other') unknowns.add(`filter.${key}`);
      }
    }
    // §4t — "fires at most once on each player's turn": at most two fires per
    // turn cycle, which is exactly the sunset frequency.
    if (ab.oncePerTurn) mult = Math.min(mult, SUNSET_PER_DAWN * dawnMult(card));
    // §4m — a recurring trigger whose own ops SEVER THE HOST can only ever
    // fire once, so the repeatable multiplier is wrong for it. Without this,
    // Umbral Antenna's self-consuming dawn reanimate scored as if it returned
    // a creature every single turn (it read +7.36). Collapse to one-shot.
    const selfConsuming = (ab.ops ?? []).some((o) => (o as { op: string }).op === 'severSelf');
    if (selfConsuming && mult > 1) {
      mult = 1.0;
    }
    // The condition gate applies AFTER the one-shot clamp: a self-consuming
    // ability behind a threshold still has to reach the threshold to fire at
    // all (fixing an ordering bug that discarded Umbral Antenna's gate).
    mult *= condMult;
    if (ab.when === 'static' && ab.static) {
      const p = valueStatic(ab.static, card, unknowns);
      parts.push({ label: p.label, v: p.v });
      if (!isCreature) spellEffect += p.v;
      continue;
    }
    const face = canFaceOf(ab);
    for (const op of ab.ops ?? []) {
      const p = valueOp(op, face, card, ab.when, ab.targets?.[0]?.what, unknowns);
      const v = p.v * mult;
      parts.push({ label: `${ab.when}:${p.label}`, v });
      if (!isCreature) spellEffect += v;
    }
  }

  // Mana rock / mana creature: a repeatable mana source is worth ~1 ramp.
  // v3 (2026-08-29): scale with the number of colours produced. A flat 1.3
  // priced Canopic Cartouche — a five-colour rock — the same as a mono one,
  // and the batch proposed cutting it to {1}. Fixing is worth real MEP:
  // Chromatic Lantern / Coalition Relic sit a full tier above Mind Stone.
  if (card.manaAbility?.length && !card.types.includes('land')) {
    const colours = new Set(card.manaAbility).size;
    const p = { label: colours > 1 ? `mana source (${colours} colours)` : 'mana source', v: 1.3 + 0.15 * (colours - 1) };
    parts.push(p);
    if (!isCreature) spellEffect += p.v;
  }

  // ── v2 — card-level mechanic riders ─────────────────────────────────────
  // These are options paid for separately (later, from a different zone, or
  // on top of the printed cost), never part of the base printed spell effect,
  // so none of them feed `spellEffect` / the instant-speed premium above.
  const mechanics: string[] = [];

  if (card.skim) {
    // Skim (≈Cycling): flat option value. Deliberately NOT scaled by the
    // skim cost (mirrors Preserve below) — v1's existing rates already treat
    // "being a flexible option" as a flat add rather than a cost-indexed one
    // (see the aura -0.3 haircut, the +0.3 spell floor).
    mechanics.push('skim');
    parts.push({ label: 'skim option', v: 0.35 });
  }

  if (card.retell) {
    // Retell (≈Flashback): 0.4x the retell mode's effect value. Override ops
    // when present (trigger-safe/target-free per docs/rules.md); otherwise
    // fall back to the printed spell's own total op value (`spellEffect`,
    // accumulated above — pre charm-premium, which is correct: the printed
    // ops are what get re-cast, not the instant-speed flexibility bonus).
    mechanics.push('retell');
    const effectValue = card.retell.ops
      ? card.retell.ops.reduce((s, op) => s + valueOp(op, false, card, 'spell', undefined, unknowns).v, 0)
      : spellEffect;
    parts.push({ label: 'retell option', v: 0.4 * effectValue });
  }

  if (card.empower) {
    // Empower (≈Kicker): 0.5x the rider's op value. Additive cost, paid on
    // top of the printed cost, so never priced at full rate.
    mechanics.push('empower');
    const riderValue = card.empower.ops.reduce((s, op) => s + valueOp(op, false, card, 'spell', undefined, unknowns).v, 0);
    parts.push({ label: 'empower option', v: 0.5 * riderValue });
  }

  if (card.rite) {
    // Rite N: additional sacrifice cost paid while casting — a real
    // drawback (you need N creatures already in play), priced negative.
    mechanics.push('rite');
    parts.push({ label: `rite ${card.rite.n}`, v: -0.7 * card.rite.n });
  }

  if (card.nineLives) {
    // Nine Lives (≈Undying): flat +0.9, one guaranteed extra body (marked,
    // so it cannot loop) after the first death.
    mechanics.push('nineLives');
    parts.push({ label: 'nine lives', v: 0.9 });
  }

  if (card.preserve) {
    // Preserve (≈Embalm): flat +0.5 main-phase graveyard option. Flat like
    // Skim — the cost is paid later/separately and the card is already
    // priced as if it "replaces itself" once via the ETB-fires-twice rule
    // (docs/rules.md), so this is the pure recursion-option premium.
    mechanics.push('preserve');
    parts.push({ label: 'preserve option', v: 0.5 });
  }

  if (card.hauntlink) {
    // Hauntlink ≈ Equipment (owner ruling 2026-08-28), NOT Bestow/Aura: the
    // permanent is cast for its own printed cost (already scored via body/
    // abilities above and `budget` below) and separately pays a haunt cost
    // at charm speed to attach the Linked rider — the two-cost shape of MTG
    // Equip, not an aura's single up-front cost. See balance/power-formula.md
    // §4g for the full derivation and era-filtered MTG anchors.
    mechanics.push('hauntlink');
    const linked = card.hauntlink.linked;
    const mag = statKwMagnitude(linked.p, linked.t, linked.grantKeywords, unknowns);
    const hauntMV = manaValue(card.hauntlink.cost);
    // 1. Reusable-across-hosts value: the permanent survives its OWN host
    //    dying (only the link breaks), unlike an aura — real Equipment
    //    anchors (Bonesplitter, Leonin Scimitar, Vulshok Morningstar,
    //    Vulshok Battlegear) equip for ~1 mana per point of granted
    //    magnitude, i.e. NO card-disadvantage haircut on the rider itself.
    // 2. MINUS a dies-with-host discount: unlike real Equipment, a linked
    //    Hauntlink permanent DOES die with its host (docs/rules.md rules
    //    revision 3) — the aura's exact drawback — so it only earns back
    //    HALF of the aura formula's -0.3 haircut, landing the base rate
    //    strictly between an aura (mag - 0.3) and full Equipment (mag - 0).
    // 3. PLUS a small charm-speed relink premium: moving the link at any
    //    priority (a combat trick, or a response to the host dying) is real
    //    flexibility MTG's sorcery-speed-only Equip activation never gets.
    //    Flat and small — it only matters in the narrow window a link is
    //    actually threatened.
    // 4. The haunt cost taxes the option per mana paid, like an Equip cost —
    //    but below the ~0.73 magnitude-per-equip-mana an era-filtered MTG
    //    sample averages (n=12: the four §1 anchors plus Trusty Machete,
    //    No-Dachi, Sword of the Meek, Cloak and Dagger, Fireshrieker,
    //    Loxodon Warhammer, Obsidian Battle-Axe, Quietus Spike), because MTG
    //    prices repeat-attach mana cheaper than cast mana — a real Equipment
    //    pays for itself many times over a game, which a single-card static
    //    score can't model, so 0.6 stays a conservative floor under the
    //    observed 0.73, not the full rate.
    const dyingHostHaircut = 0.15;
    const relinkPremium = 0.1;
    const equipTax = 0.6;
    // 5. ONE-CAST FLOOR (owner ruling 2026-08-28): the link mode is worth at
    //    MINIMUM one application of the granted package at face §4a rates —
    //    e.g. Hauntlink Signal Lure's option is worth at least Untouchable
    //    (0.6), never 0. The equip-tax formula previously zeroed out every
    //    small package, erasing the card's function from the math entirely.
    //    The tax formula is kept for any future carrier where it exceeds the
    //    floor (a large package on a cheap haunt cost); today the floor
    //    binds for all 16 carriers.
    const equipValue = Math.max(0, mag - dyingHostHaircut + relinkPremium - equipTax * hauntMV);
    const value = Math.max(mag, equipValue);
    parts.push({ label: value === mag && equipValue < mag ? 'hauntlink option (one-cast floor)' : 'hauntlink option', v: value });
  }

  if (card.activated) {
    // Duty (1.8, the tap-cost activated ability) ≈ an MTG activated ability
    // with {T} in its cost. §4q: a tap ability prices like a Dawn trigger the
    // player CHOOSES to fire, so the expected-activation multiplier reuses
    // dawnMult() (2.0 creature / 3.0 non-creature; the era-filtered corpus
    // backs out 2.0 from the Prodigal Sorcerer family and 3.3-3.6 from
    // Jayemdae / Jalum Tome), minus D = 0.4 per activation mana capped at 1.5
    // (NEEDS MATH: a midpoint across ladders that disagree by 5x), clamped at
    // zero. Creature top of range (NEEDS MATH): a per-trigger rate >= 2.0 uses
    // perTrigger + 1.0, because repeatable tap removal prices at 0.6-3.8 in
    // precedent (Royal Assassin to Kalitas), never at 2x. The repeatable `tap`
    // op reads at 1.0, not the one-shot op's 0.40 (Icy Manipulator, the
    // unrestricted {T} tappers at 2.0 MEP). Targets are chosen inline like a
    // spell's, so canFace applies. The Attack >= 2 body discount (-0.5) is
    // documented in §4q and deliberately NOT applied (owner taste).
    // §4t: a card may print several Duties sharing one {T}; the best is
    // priced in full and each other at DUTY_SHARED_TAP_SHARE.
    mechanics.push('activated');
    const duties = dutiesOf(card).map((ability) => valueDuty(ability, card, unknowns));
    const best = duties.reduce((b, d, i) => (d.v > duties[b].v ? i : b), 0);
    duties.forEach((d, i) => {
      if (i === best) parts.push(d);
      else parts.push({ label: `${d.label}, shares the tap x${DUTY_SHARED_TAP_SHARE}`, v: DUTY_SHARED_TAP_SHARE * d.v });
    });
  }

  if (card.whispers) {
    // Whispers (≈ Madness, era Torment 2002 / Time Spiral 2006-07, n=22) —
    // §4r. The era rule from twelve clean comparables: bodies, cantrips and
    // sorcery-speed effects are printed at fair rate with the alternative
    // cost as pure upside (Arrogant Wurm = Fangren Hunter + a free option), so
    // a non-Charm carrier earns 0 at printed; instant-speed removal, burn and
    // counters pay about half the discount up front (Fiery Temper +1 over
    // Volcanic Hammer for a 2-mana discount; Dark Withering +3 for 5), so a
    // Charm earns E_FIRE x (printedMV - whispersMV) with E_FIRE = 0.5, the
    // floor of the measured 0.5-1.0 range. NEEDS MATH (honest sense): under
    // the fresh-graveyard ruling the fire rate is an in-engine quantity (18
    // opponent-discard cards, every mill, cleanup, Skim all tag), so E_FIRE is
    // measured on a seeded matrix once the set's mill and discard density is
    // known; 0.5 is the placeholder until then. The cost guard (whispersMV
    // >= fair(effect) - 1, never below fair - 2) is a builder warning, not a
    // part. Skim + Whispers on one card (Ichor Slick, n=1) is NEEDS MATH.
    mechanics.push('whispers');
    const discount = Math.max(0, manaValue(card.cost) - manaValue(card.whispers.cost));
    const E_FIRE = 0.5;
    if (isCharm) {
      parts.push({ label: `whispers option (charm, ${discount} off)`, v: E_FIRE * discount });
    } else {
      parts.push({ label: 'whispers option (body or sorcery speed: 0 at printed)', v: 0 });
    }
  }

  if (card.tithe) {
    // Tithe (≈ the Kamigawa Offering cycle, n=5; Emerge creep-flagged, n=10;
    // Devour, n=12) — §4s. The Patrons price the offering option at 0.4 /
    // 0.5 / 1.2 MEP (min / median / max) at printed, and the same-block
    // Dragon Spirits at identical cost and rarity outrank all five: the
    // tribal restriction was the real cost and the mana option nearly free.
    // With the owner's halving (one generic per TWO Defense) the discount is
    // about half the fodder's mana value on the vanilla curve, the Patrons'
    // "nearly free option" regime, so Tithe is a flat +0.5 (floor 0, cap
    // 1.0), not scaled by the card's MV; Rite's -0.7 x N is the opposite sign
    // because Rite is mandatory. NEEDS MATH: the discount's tempo effect (how
    // often a 7+ Horror lands by turn 4 in a fodder-heavy deck) is measured,
    // not rated; a Tithe card that ALSO gains counters needs the Devour rate
    // on top. Not combinable with X / Retell / Hauntlink / Whispers / Rite:
    // the builder warns; the scorer does not police it.
    mechanics.push('tithe');
    parts.push({ label: 'tithe option (any-number sacrifice, 1 per 2 Defense)', v: 0.5 });
  }

  if (card.chapters) {
    // Quest chapters (≈Saga): 0.75x the sum of each chapter's op values,
    // discounted for being staggered over turns (a chapter III payoff is
    // conditional on surviving to dawn ×2). Chapter ops are trigger-safe /
    // target-free (EffectInterpreter comment), so canFace is always false.
    mechanics.push('chapters');
    card.chapters.forEach((chapterOps, i) => {
      const chapterTotal = chapterOps.reduce((s, op) => s + valueOp(op, false, card, 'spell', undefined, unknowns).v, 0);
      parts.push({ label: `chapter ${i + 1}`, v: 0.75 * chapterTotal });
    });
  }

  if (card.x) mechanics.push('x'); // already priced via NOMINAL_X inside valueOp; no separate part.

  // Instant-speed premium on the spell portion.
  if (isCharm && spellEffect > 0) {
    const bonus = spellEffect * (CHARM_MULT - 1);
    parts.push({ label: 'instant premium', v: bonus });
  }

  // v3 colour-pie premium (owner-approved 2026-08-29): off-pie effects have a
  // higher fair cost, so the premium adds to P — after the charm multiplier,
  // since it prices colour identity, not flexibility.
  parts.push(...piePremiums(card, unknowns));

  const power = parts.reduce((s, p) => s + p.v, 0);
  const mv = manaValue(card.cost);
  const pips = Object.values(card.cost?.pips ?? {}).reduce((s: number, n) => s + (n as number), 0) as number;
  const budget = v3Budget(mv, pips, card.rarity);
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    set: card.set ?? 'base',
    category: card.types.join('/'),
    mv,
    isX: !!card.x,
    power: round(power),
    budget: round(budget),
    delta: round(power - budget),
    parts: parts.map((p) => ({ label: p.label, v: round(p.v) })),
    mechanics,
    unknowns: [...unknowns].sort(),
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;
