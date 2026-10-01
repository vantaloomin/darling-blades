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
 * the additive Budget (v3 shape 2026-08-29, refit for v4 2026-09-26; see the
 * BUDGET block below):
 *
 *   Budget = CARD_FLOOR + MANA_STEP × (MV − 1) + PIP_PREMIUM × (pips − 1) + RARITY_BONUS
 *          = 1.14 + 0.81 × (MV − 1) + 0.27 × (pips − 1) + { c 0, r 0.37, sr 0.65, ssr 1.12, ur 1.98 }
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
 *
 * v4 (2026-09-26, owner-approved for 1.8.5, §4u): rates that scale with the
 * body. The body tapers past a 2/2 and weights Attack over Defense; the
 * attack-multiplying keywords are priced on the attack of the creature that
 * carries them (a nominal 3/3.2 host for a grant to an unknown creature);
 * three or more keywords on one body take a stacking discount; and the
 * rate-card audit, the in-engine anthem measurement and the D6 level-flag and
 * mark measurements replace the rows they re-measured. Evidence hierarchy
 * (ruling D1): the in-engine lab sets a slope where it measures cleanly, Magic
 * printed through 2020 sets the rest. The full tables, rulings and evidence are
 * in `docs/plan-1.8.5.md` ("The v4 formula"); the per-rate provenance is
 * cited beside each rate below.
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
  TargetSpec,
  TriggerWhen,
} from '../engine/types';
import { flatOps, manaValue } from '../engine/types';
import { LAND_RESERVE_SIZE } from '../config/rules';

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
  set?: NonNullable<CardDef['set']>;
};

// ── Unknown-vocabulary tracking (v2) ────────────────────────────────────────
// No silent zeros: anything the scorer doesn't recognize is collected here and
// fails the run at the end (see the bottom of the file), instead of quietly
// scoring as `undefined`/NaN the way the pre-v2 scorer did for `dreaded` et al.
export type UnknownCollector = Set<string>;

// ── Tunable coefficients (all in mana-equivalent points) ─────────────────────

export const RARITY_MULT: Record<Rarity, number> = { c: 1.0, r: 1.06, sr: 1.15, ssr: 1.25, ur: 1.4 };

// ── BUDGET (v3 shape 2026-08-29, v4 refit 2026-09-26) ─────────────────────────
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
//
// v4 REFIT (2026-09-26, §4u): same shape, same method (median regression on
// the 1,444 collectible non-X, non-land cards, re-run after the v4 rates),
// rounded to two places. The rarity steps barely move; the pip premium drops
// from 0.40 to 0.27, because the v4 rates now carry some of what the pip
// premium used to absorb. docs/plan-1.8.5.md, "The v4 formula".
export const CARD_FLOOR = 1.14;   // what merely being a castable 1-mana card buys
export const MANA_STEP = 0.81;    // each mana after the first; sub-linear on purpose
export const PIP_PREMIUM = 0.27;  // per coloured symbol beyond the first (0 pips pays −0.27)
export const RARITY_BONUS: Record<Rarity, number> = { c: 0.0, r: 0.37, sr: 0.65, ssr: 1.12, ur: 1.98 };

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
// v4 (rate-card audit, Magic through 2020): a one-shot self-damage payment
// (on cast, arrival or death) is settled at 0.15 a point; see valueOp.
export const SELF_DMG_ONE_SHOT_RATE = 0.15;
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
  // 1.9 (A1.4): Hunt is creature removal by a creature, green and red (the
  // First Dawn brief), black secondary, as the overplan's provisional pie had it.
  hunt: { pie: { G: 0, R: 0, B: SEC }, colorless: SEC },
};
export function pieClassOf(op: PieEffectOp, targetWhat?: string): string | null {
  switch (op.op) {
    case 'damage':
      if (op.to === 'controller') return null;
      // 1.9 (A1.4): damage aimed at your own creatures is a Provoked source, not burn.
      if (op.to === 'eachYourCreature' || (op.to === 'target' && targetWhat === 'yourCreature')) return null;
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
    case 'hunt': return 'hunt';
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
  const scan = (ops?: ScorableEffectOp[], targets?: readonly TargetSpec[], fan = 1, huntWeight = 1) => {
    for (const o of ops ?? []) {
      const targetWhat = opTargetWhat(o, targets);
      const k = pieClassOf(o, targetWhat);
      if (!k) continue;
      const raw = valueOp(o, false, card, 'spell', targetWhat, unknowns).v * (isPerTargetOp(o) ? fan : 1) * (o.op === 'hunt' ? huntWeight : 1);
      // Self-discard is the one signed entry: it subtracts from the draw
      // class (see pieClassOf). A negative class total pays no premium.
      const v = o.op === 'discard' && o.who === 'self' ? raw : Math.max(0, raw);
      weight.set(k, (weight.get(k) ?? 0) + v);
    }
  };
  for (const ab of card.abilities ?? []) scan(ab.ops, ab.targets, targetFan(ab.targets));
  // 1.9 (A1.4): an Empower Hunt pays the premium at its carrier weight (0).
  scan(card.empower?.ops, undefined, 1, HUNT_CARRIER.empower);
  for (const duty of dutiesOf(card)) scan(duty.ops, duty.targets, targetFan(duty.targets));
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

// ── v4 BODY (2026-09-26, §4u, ruling D5) ─────────────────────────────────────
// Body = 0.55 × Attack + 0.45 × Defense − 0.07 × max(0, Attack + Defense − 4).
// The Attack/Defense split is Magic's through 2020 (power prices about 1.28×
// toughness, pre-2010 and through 2020 alike, 737 french-vanilla creatures).
// The 7% taper past a 2/2 is the in-engine lab's: a vanilla N/N at mana value N
// plays fair from 1/1 to 7/7, which the v3 linear 0.5 × (A + D) could not
// reproduce (it read a vanilla 8/8 for 8 at +1.16). Magic's own concave fit is
// steeper at the top but rests on 25 cards. Replaces v3's flat 0.5 a stat.
export const BODY_PER_ATTACK = 0.55;
export const BODY_PER_DEFENSE = 0.45;
export const BODY_TAPER = 0.07;
/** The taper starts past a 2/2 (Attack + Defense above 4). */
export const BODY_TAPER_FROM = 4;
export function bodyValue(attack: number, defense: number): number {
  return BODY_PER_ATTACK * attack + BODY_PER_DEFENSE * defense - BODY_TAPER * Math.max(0, attack + defense - BODY_TAPER_FROM);
}

// The v3 flat body rate (0.5 a stat). No longer the body (bodyValue above); it
// is kept as the per-creature unit of a team anthem, because lane 2 measured
// the anthem factors in these units (see the `filter` static in valueStatic).
export const BODY_PER_STAT = 0.5;

// The v3 FLAT keyword values. v4 prices a keyword on its host (KEYWORD_RATE
// below); this table stays because a team anthem's granted keyword is priced
// at its flat value, the unit lane 2 measured the anthem factors in (a scaled
// keyword on an anthem would otherwise be counted twice). It is also the
// vocabulary check: a keyword missing here is reported as unknown.
// v2 added `dreaded` (Menace): v1's map omitted it and every dreaded card
// scored NaN.
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

// ── v4 KEYWORDS (2026-09-26, §4u) ────────────────────────────────────────────
// A keyword's value on a host of attack A is `base + perAttack × A` (A below 0
// counts as 0), never below `floor` where one is set. The attack-multiplying
// keywords scale; the rest stay flat. Slopes come from the in-engine lab
// (624,640 paired games, synthetic A/A creatures at attack 1 to 5 in the five
// starter decks against a 14-deck field, MediumAI with a HardAI check); levels
// come from Magic through 2020 where the lab reads the AI's targeting or
// blocking more than the keyword (ruling D1).
export interface KeywordRate {
  base: number;
  perAttack: number;
  floor?: number;
}
export const KEYWORD_RATE: Record<Keyword, KeywordRate> = {
  // D2: the lab's slope (0.81 / 1.50 / 1.83 at A1 / A3 / A5). Magic's is
  // shallower (0.46 + 0.11A, post-2010 design); the owner ruled the engine's.
  skyborne: { base: 0.5, perAttack: 0.27 },
  // D3: lab 0.82 / 2.17 / 2.20; Magic's upper bound (at most 0.32 a point)
  // agrees, and both refute the "second hit of power" slope.
  twinBlades: { base: 0.75, perAttack: 0.4 },
  // Lab 0.37 / 0.77 / 1.46; Magic 0.38 + 0.15A.
  firstBlade: { base: 0.2, perAttack: 0.22 },
  // Lab 0.62 / 0.80 / 2.05; Magic 0.20 + 0.13A leans the same way.
  bloodoath: { base: 0.2, perAttack: 0.25 },
  // Lab 0.23 / 0.30 / 0.73: scales gently. Magic reads it flat at 0.35.
  warcry: { base: 0.15, perAttack: 0.1 },
  // Lab -0.43 / -0.45 / -1.61 and free on a 0/4; Magic -0.62 - 0.16A.
  bulwark: { base: -0.5, perAttack: -0.2 },
  // Shrinks with attack: lab 0.96 / 0.73 / 0.21, Magic flat to falling (0.6).
  deathblade: { base: 1.0, perAttack: -0.15, floor: 0.2 },
  // Flat. Magic sets these levels: the lab reads the AI's blocking and
  // targeting (Sentinel and Untouchable about 0) more than the keyword.
  wardingGaze: { base: 0.2, perAttack: 0 }, // Magic 0.2-0.3, lab 0.20 / 0.29 / 0.48
  overrun: { base: 0.3, perAttack: 0 }, // Magic falls to nearly free on big bodies; lab noisy
  sentinel: { base: 0.3, perAttack: 0 }, // Magic flat 0.32
  untouchable: { base: 0.6, perAttack: 0 }, // Magic flat 0.61
  dreaded: { base: 0.5, perAttack: 0 }, // Magic flat 0.58, lab flat 0.48
  rage: { base: -0.45, perAttack: 0 }, // lab flat -0.48 to -0.29; §4o, kept with its rebate
};

/** The value of keyword `k` on a creature with `attack` Attack (§4u). */
export function keywordValue(k: Keyword, attack: number): number {
  const rate = KEYWORD_RATE[k];
  const v = rate.base + rate.perAttack * Math.max(0, attack);
  return rate.floor === undefined ? v : Math.max(rate.floor, v);
}

/** True for a keyword whose value moves with its host's Attack. */
export function keywordScales(k: Keyword): boolean {
  return (KEYWORD_RATE[k]?.perAttack ?? 0) !== 0;
}

// Three or more keywords on one creature (Rage excluded) cost 0.40 less than
// their parts: Magic through 2020, n = 12-18, CI clear of zero. Pairs add up
// normally.
export const KEYWORD_STACK_DISCOUNT = -0.4;
export function keywordStackDiscount(keywords: readonly Keyword[] | undefined): number {
  return (keywords ?? []).filter((k) => k !== 'rage').length >= 3 ? KEYWORD_STACK_DISCOUNT : 0;
}

/**
 * §4o: Rage costs -0.45 alone, but only -0.15 on a creature that already
 * carries an attack-oriented keyword — a card that was attacking anyway barely
 * feels the compulsion. Applied as a rebate on top of the flat rate above.
 * v4 keeps it: the lab measured Rage flat.
 */
export const RAGE_ATTACK_KEYWORDS: readonly Keyword[] = ['twinBlades', 'warcry', 'overrun', 'firstBlade'];
export const RAGE_REBATE = 0.3;
export function rageRebate(keywords: readonly Keyword[] | undefined): number {
  if (!keywords?.includes('rage')) return 0;
  return keywords.some((k) => RAGE_ATTACK_KEYWORDS.includes(k)) ? RAGE_REBATE : 0;
}

// ── Hosts ───────────────────────────────────────────────────────────────────
// A host is the creature a keyword or a stat change sits on. It is known for a
// creature's printed keywords, its tokens and its self statics (the card's own
// Attack and Defense). A grant to an unknown creature (an aura, a pump target,
// a Hauntlink link) is priced on the NOMINAL host plus the grant's own stat
// change: attack 3 is what Magic's grant prices imply (flying 2.4-3.2, first
// strike 2.2-2.6, double strike about 4). Defense 3.2 goes with it; defense
// only moves a body change, never a keyword's value.
interface Host { a: number; d: number }
export const NOMINAL_HOST = { attack: 3, defense: 3.2 } as const;
const nominalHost = (dp = 0, dt = 0): Host => ({ a: NOMINAL_HOST.attack + dp, d: NOMINAL_HOST.defense + dt });
const hostOf = (card: ScorableCardDef): Host => ({ a: card.attack ?? 0, d: card.defense ?? 0 });

/** Defensive keyword lookup on a host (nominal when omitted): flags anything
 * missing instead of NaN-poisoning a card. */
function kwValue(k: Keyword, unknowns: UnknownCollector, host: Host = nominalHost()): number {
  if (KEYWORD_VALUE[k] === undefined || KEYWORD_RATE[k] === undefined) {
    unknowns.add(`keyword:${k}`);
    return 0;
  }
  return keywordValue(k, host.a);
}

/** A keyword's flat v3 value (the anthem unit), with the same unknown check. */
function flatKwValue(k: Keyword, unknowns: UnknownCollector): number {
  const v = KEYWORD_VALUE[k];
  if (v === undefined) {
    unknowns.add(`keyword:${k}`);
    return 0;
  }
  return v;
}

/** The breakdown label of a creature's printed keyword: a scaled keyword names
 * the Attack it was priced at, so the Forge can say so. */
function keywordLabel(k: Keyword, attack: number): string {
  return keywordScales(k) ? `${k} (attack ${attack})` : k;
}

// ── FIRST DAWN: HUNT AND PROVOKED (1.9, A1.4, in-engine) ─────────────────────
// Fitted to the A1.3 lab (652,512 games, HardAI on both seats, a 14-deck field;
// balance/study/lab/fd/first-dawn-findings.md, local-only). The lab's currency
// is the pooled one-mana step (5.3 pp), read as MEP here as the 1.8.5 keyword
// lab's was. The calibration table (fitted against measured, every lab row) is
// in docs/plan-first-dawn-engine.md, "As built (A1.4)". Replaces the
// overplan's provisional terms (Hunt: creature burn x a Defense slope; Provoked:
// the effect x (0.2 + 0.15 x Defense)), which the lab contradicted.
//
// HUNT. The value is a STEP on whether the hunter survives the exchange, not a
// slope. The rule: the prey a hunter picks has Attack 2 and Defense 3 (the
// field's typical creature the hunter can outlast), so a hunter SURVIVES when
// its Defense is 3 or more, and KILLS when its Attack is 3 or more. Measured
// (arrival Hunt, the body's value over the same body without it):
//   dies    2/2 0.14, 3/1 1.03, 3/2 1.13, 4/2 1.37 pooled (Spear-Thrower; its
//           fair surcharge is 2 mana or more, censored, which A1.4 reads for
//           cost, so the slope runs to 2.05 at Attack 4; 3/1 and 3/2 read
//           1.10, inside their intervals)
//   lives   3/3 2.49, 3/4 3.24, 3/5 3.44, 4/4 3.21, 5/5 3.53: Defense past the
//           step adds 0.75 a point to a ceiling of 3.5; Attack past 3 adds
//           nothing (3/4 = 4/4, 3/5 = 5/5).
// A survivor with Attack under 3 kills less: it keeps the share of the kill
// the scorer's own creature-burn curve gives its Attack against 3 (a 2/4 keeps
// 1.2 / 1.7 = 0.71). On a one-shot carrier (arrival, attack, anything but a
// Duty) it is also capped at that Attack's creature burn plus a modest
// survival excess (HUNT_LOW_ATTACK_EXCESS, 0.5): NEEDS MATH, since no lab row
// has a low-Attack survivor on a one-shot carrier, and uncapped a 1/4 or 2/3
// would read far above a 3/2 that trades. A Duty is exempt: Tracker of the
// Long Grass (a 2/4 Duty hunter) is the one measured low-Attack survivor, and
// a Duty picks its moment and its prey every turn; capped, its Duty would read
// 0.08 against the measured 0.65 [0.45, 0.91].
export const HUNT_LOW_ATTACK_EXCESS = 0.5;
export const HUNT_SURVIVES_AT_DEFENSE = 3;
export const HUNT_KILLS_AT_ATTACK = 3;
export const HUNT_DIES_AT_ATTACK_2 = 0.15;
export const HUNT_DIES_PER_ATTACK = 0.95;
export const HUNT_LIVES_BASE = 2.5;
export const HUNT_LIVES_PER_DEFENSE = 0.75;
export const HUNT_LIVES_CAP = 3.5;
// What one Hunt is worth on each carrier, against the arrival Hunt's exchange:
//   arrives 1.0  the calibration frame.
//   attacks 0.9  Kesh (3/2 Warcry, "Whenever this attacks, Hunt.") 0.94
//                [0.69, 1.26] against the 3/2 arrival exchange 1.05.
//   duty    0.75 per card, before the Duty's mana discount (valueDuty):
//                Korru (4/5, {1}{G}) 1.76 [1.47, 2.10], Tracker (2/4,
//                {2}{G}) 0.65 [0.45, 0.91]; least squares 0.754. Hard uses a
//                hunting Duty 0.5-0.6 times a game (A1.2's Morning gap), so
//                this is a Hard-as-built rate.
//   empower 0    Ridge-Raptor's Empower Hunt: -0.26 [-0.58, -0.01]. Hard
//                empowers into trades; the option is worth nothing.
// Any other carrier (Dawn, dies, ...) is unmeasured: one Hunt at the arrival
// rate, marked NEEDS MATH.
export const HUNT_CARRIER = { arrives: 1.0, attacks: 0.9, duty: 0.75, empower: 0 } as const;
// The spell form ("Target creature you control Hunts."): the hunter is
// whichever creature the caster picks, so the step does not apply to a nominal
// body. The plain Hunt ritual measured fair at mana value 2 (-0.04 [-0.3, 0.3]
// against a vanilla 2/2), so its value is a fair 2-mana card's, 1.95. A pump on
// the hunter earlier in the spell is folded in: each point of Defense moves the
// value along the surviving hunter's slope (0.75), to the same ceiling; Attack
// adds nothing (Challenge the Beast +1/+0 0.01, Duel on the Ridge +2/+0 -0.39,
// Stalk the Ferns +1/+1 -0.01, Fang and Horn +2/+2 +0.98, against a vanilla at
// the same mana value). Damage to the hunter is a Provoked source, not a loss
// of Defense: the caster picks a hunter that can take it (Blaze-Horn Charge
// reads only 0.23 under the plain Hunt at mana value 3).
export const HUNT_SPELL_BASE = 1.95;
// Prey declared `yours` (the hunter fights your own creature): the lab's forced
// self-hunt arm read -0.2 pp over a blank ritual, so the Hunt is worth 0. The
// `any` override adds nothing over the default prey (-0.1 pp).
export const HUNT_PREY_YOURS = 0;

/** The scorer's creature-only burn curve (valueOp, damage to a creature target). */
const creatureBurnRate = (n: number): number => Math.max(0.5 + 0.35 * n, Math.min(2.7, 1.2 + 0.5 * (n - 2)));

/** True when a hunter with this Defense outlasts the typical prey (Attack 2). */
export function huntSurvives(defense: number): boolean {
  return defense >= HUNT_SURVIVES_AT_DEFENSE;
}

/** True when a one-shot Hunt by this hunter is priced under the low-Attack
 * cap (a NEEDS MATH estimate). */
export function huntLowAttackCapped(attack: number, defense: number): boolean {
  return attack > 0 && attack < HUNT_KILLS_AT_ATTACK && huntSurvives(defense);
}

/** One Hunt's exchange, in MEP, for a hunter of this Attack and Defense, on the
 * arrival Hunt's frame (the carrier multiplies it). `oneShot` applies the
 * low-Attack survivor cap (every carrier but a Duty). */
export function huntExchange(attack: number, defense: number, oneShot = true): number {
  if (attack <= 0) return 0;
  const lives = Math.min(HUNT_LIVES_CAP, HUNT_LIVES_BASE + HUNT_LIVES_PER_DEFENSE * (defense - HUNT_SURVIVES_AT_DEFENSE));
  if (!huntSurvives(defense)) {
    // A dying hunter is never worth more than one that survives.
    return Math.min(HUNT_LIVES_BASE, Math.max(0, HUNT_DIES_AT_ATTACK_2 + HUNT_DIES_PER_ATTACK * (attack - 2)));
  }
  const reach = Math.min(1, creatureBurnRate(attack) / creatureBurnRate(HUNT_KILLS_AT_ATTACK));
  const value = reach * lives;
  return oneShot && huntLowAttackCapped(attack, defense) ? Math.min(value, creatureBurnRate(attack) + HUNT_LOW_ATTACK_EXCESS) : value;
}

/** The spell form's value with `defensePump` added to its hunter first. */
export function huntSpellValue(defensePump: number): number {
  return Math.min(HUNT_LIVES_CAP, HUNT_SPELL_BASE + HUNT_LIVES_PER_DEFENSE * Math.max(0, defensePump));
}

// PROVOKED. A passive "Provoked: [effect]" is worth its effect times a
// survival factor on the carrier's Defense. Measured: 0 on small bodies
// (Cinder-Crest 2/2 -0.28, Fern-Back Grazer 1/4 -0.04, Hearth-Shield Maiden 1/4
// 0.00), about 0.45-0.5 on big ones (Vessa 5/6 0.45 [0.23, 0.71], The Walking
// Mountain 6/7 0.51 [0.30, 0.72], Mother of the Long-Necks 4/7 0.44 [0.24,
// 0.65]). Exposure is flat at 1.2-1.7 a game whatever the body; what differs is
// whether the creature survives to fire. So the factor is 0 through Defense 4,
// rises linearly to its ceiling at Defense 6 and stays there. The ceiling, 0.25,
// is the least-squares fit of the three big bodies' effects (1.0, 2.3, 1.85)
// to their readings; Defense 5 (0.125) is interpolated, not measured.
export const PROVOKED_SURVIVAL_ZERO_AT = 4;
export const PROVOKED_SURVIVAL_FULL_AT = 6;
export const PROVOKED_SURVIVAL_CAP = 0.25;
/** The Provoked multiplier for a carrier with this Defense. */
export function provokedSurvival(defense: number): number {
  const span = PROVOKED_SURVIVAL_FULL_AT - PROVOKED_SURVIVAL_ZERO_AT;
  return PROVOKED_SURVIVAL_CAP * Math.min(1, Math.max(0, (defense - PROVOKED_SURVIVAL_ZERO_AT) / span));
}
// A SELF-PROVOKE ENGINE: a creature whose own Duty can damage it fires its
// Provoked about once a turn. Measured: Sefa (Duty {1}: 1 damage to target
// creature you control; Provoked: a Hatchling and 2 life, 1.55) 1.87 [1.57,
// 2.20]; Ashka (Duty {R}: 1 damage to target creature; Provoked: 2 to the
// opponent, 1.0) 0.69 [0.52, 0.95]. Priced as SELF_PROVOKE_FIRES fires of the
// effect less the Duty's mana discount (the §4q D), when that beats the passive
// rate: 1.3 is the one value inside both intervals (Sefa 1.27-1.68, Ashka
// 0.92-1.35), below the Duty's 2.0 because the creature also attacks and blocks.
export const SELF_PROVOKE_FIRES = 1.3;
// A SELF-DAMAGE SOURCE (damage its controller aims at their own creatures, a
// target creature you control or each creature you control): priced once per
// card, whatever the carrier, because the lab read a repeatable source and a
// one-shot the same (The Standing Stone's Duty 0.61, Test of the Hearth 0.77).
// Its value is the deck's Provoked density, which the scorer reads through the
// card's colour: white is built for the wall deck (R27, 12 exposures a game),
// where white sources read 0.5 to 1.0; elsewhere (the Stampede, 3 exposures a
// game) red and colourless sources read 0 to 0.3, and the ones that hurt the
// deck's own X/1s read below 0. The lab gives ranges, so each colour takes the
// conservative (lower) end: 0.5 for white, 0 for every other colour. A
// multicoloured card takes its lowest colour's rate, as the pie premium does.
export const SELF_SOURCE_RATE: Partial<Record<'W' | 'U' | 'B' | 'R' | 'G', number>> = { W: 0.5 };

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
  //
  // v4 (D6, 2026-09-26): MEASURED in-engine. Each payoff card was played in
  // the Starborne precon against a stripped twin on paired seeds (261,184
  // games in the D6 run), which replaced the §4m estimates (1.2 to 2.5).
  // These are MediumAI and avatar-brain values in a pool with one mark deck;
  // a mark-aware AI or more mark decks would raise them. gainsMark and
  // yourPermanentMarked have no carrier in any deck, so they are set by the
  // ordering rule above against the measured observers: NEEDS MATH.
  gainsMark: 0.3,
  yourCreatureMarked: 0.45,
  yourPermanentMarked: 0.6,
  youAddMark: 1.0,
  otherCreatureMarked: 2.5,
  // Once per resolved `propagate`, NOT once per permanent it marks, and it
  // needs a propagate source in play: the narrowest of the observers. D6
  // measured it at nearly nothing (0.05).
  propagated: 0.05,
  // Fires once per MARKED ATTACKER inside a single Declare Attackers, so a
  // three-attacker swing fires it three times. §4m priced it off Hellrider
  // (2.5); D6 measured 0.35, since boards rarely hold more than one or two
  // Marked creatures.
  markedAllyAttacks: 0.35,
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
  // Provoked (1.9, First Dawn, A1.4): priced on the carrier's Defense by
  // provokedSurvival() below; this entry is that function's ceiling, kept so
  // the Record stays total. triggerMult never reads it.
  provoked: PROVOKED_SURVIVAL_CAP,
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
  if (w === 'provoked') return provokedSurvival(card.defense ?? 0);
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
// v4 (lane 2, rulings D4 and D10, 2026-09-26): MEASURED in-engine, 151,104
// games, each lord's own deck as-is against the same deck with the lord
// stripped to a vanilla twin. Creature lords come out at x1.5 to x2.5, so a
// creature lord STAYS at x2.0; this is also the one-shot team pump's factor.
// Magic's x0.6 for a tribal lord is wrong for our game. Value really rides on
// how many creatures the anthem hits (about 0.14 per matching creature in the
// 40), but the owner ruled the rate flat (D10) so it never needs re-tuning as
// sets grow.
export const TEAM_FACTOR = 2.0;
// A NON-creature anthem (an enchantment or artifact): measured at about 1.4
// times a lord (x2.1 to x3.4), because it survives the format's scarce
// non-creature removal and has no body of its own priced beside it. Flat (D10).
export const TEAM_ANTHEM_NONCREATURE = 2.8;
// §4m — a marked-only board-wide effect reaches most, not all, of your board.
// v4 (D6, in-engine): x0.7, down from §4m's x1.4; boards rarely hold more than
// one or two Marked creatures.
export const MARKED_TEAM_FACTOR = 0.7;
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

// v4 rates re-measured for 1.8.5 (§4u); each is sourced where it is used.
export const TOKEN_FLOOR = 0.15; // per token, on top of its body (rate-card audit row 7)
export const EMPOWER_SHARE = 0.15; // of the rider's value (rate-card audit row 3)
export const RITE_PER_SACRIFICE = -1.5; // D6, in-engine
export const IF_MARKED_WEIGHT = 0.09; // D6, in-engine: weight of the marked branch
export const ARRIVAL_MARK_BODY = 1.0; // D6, in-engine: a Mark a creature enters with

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
// 1.9 (A1.4b, in-engine): the CONDITIONAL ARRIVAL HUNT ("If you control another
// Dinokin, when this arrives, Hunt."; the condition is checked at cast, A1.1c).
// Measured by the A1.1c re-run (balance/study/lab/fd/first-dawn-findings-a11c.md,
// local-only; Hard on both seats): the gate's factor depends on the deck.
//   In its tribal deck (the condition live), 2-of: Fern-and-Fire 0.85 [0.58,
//     1.08], Fern-Shadow Stalker 0.83 [0.58, 1.17], Crag-Leaper 0.77 [0.49,
//     1.11], against Frill-Neck Stalker's unconditional Hunt 0.98 [0.64, 1.26]
//     in R28: the conditional keeps about 0.85 of the unconditional.
//   Off its tribe (a starter hole): Crag-Leaper 0.51, Fern-and-Fire 0.60,
//     against about 2.5 for an unconditional hunter there: about 0.2.
// The scorer cannot see the deck, so the rule reads the card: a Hunt on arrival
// gated on "another <type>" where the type is one of the card's own subtypes is
// priced for the deck built around that type, at COND_HUNT_OWN_TRIBE, measured.
// Any other gate on a Hunt keeps its standing factor (controlsOther 0.6 for
// another type), marked NEEDS MATH: off-tribe the lab read about 0.2.
export const COND_HUNT_OWN_TRIBE = 0.85;
// 1.9 (A1.4b, in-engine): the REPEATABLE MANA PUMP (A1.5, a Charm-speed ability
// used any number of times). Measured by the same re-run on Vyra, Ember-Sky
// Rider ({4}{R}{R} 5/5 Skyborne, "{R}: This gets +1/+0 until Sunset."), in the
// Crimson and Tides holes, the card against itself without the pump: +4.4 pp
// [3.5, 5.2], 0.83 MEP [0.66, 0.98] (own-curve 0.98). Hard pumped in 19% of
// games; the value is spare mana turned into damage by an evasive finisher.
// The rule: a card's pumps are worth MANA_PUMP_VALUE once, whatever their
// number. The measured shape is one ability, +1/+0 on this creature for one
// mana, on a Skyborne creature; any other shape (other stats, another cost,
// no Skyborne, several pumps) takes the same value marked NEEDS MATH, as the
// findings ask (the lab has no arm for a ground or small body).
export const MANA_PUMP_VALUE = 0.83;
/** True when the card's pump is the lab's measured shape (see MANA_PUMP_VALUE). */
export function isMeasuredManaPump(card: ScorableCardDef): boolean {
  const pumps = card.manaActivated ?? [];
  if (pumps.length !== 1 || !(card.keywords ?? []).includes('skyborne')) return false;
  const [pump] = pumps;
  return manaValue(pump.cost) === 1 && pump.ops.length === 1 &&
    pump.ops.every((op) => op.op === 'boost' && op.scope === 'self' && op.p === 1 && (op.t ?? 0) === 0 && op.keywords === undefined);
}
// Several Duties on one card share the single {T}: at most one fires per
// untap. The best Duty is priced in full, each other at this share. NEEDS
// MATH (a midpoint, like §4q's D): Grixis Battlemage (ALA) prices its second
// tap mode at ~35%, Blightspeaker (PLC) and the Invasion Apprentices at ~0.
export const DUTY_SHARED_TAP_SHARE = 0.2;

// ── §4v EXTRA LAND DROPS (1.8.5 ramp lane, in-engine) ────────────────────────
// Warchest gives each player exactly LAND_RESERVE_SIZE (10) lands and one land
// a turn, so an extra land drop only pulls the land count forward toward a cap
// both players reach anyway, and a drop beyond the first each turn enters
// tapped. What the op buys is extra untapped mana on the turns before the cap,
// counted from the turn it is cast on (its mana value).
//
// MEASURED in-engine (1.8.5 ramp lab, 2026-09-27, 85k games in the fitted
// frame): colourless ramp probes in the hole of three green decks (Wild
// Communion, Valhalla's Muster, Meng Huo) against the 14 Warchest columns,
// each probe against a blank card of the same cost and type cast at the same
// time. The shape below fits the eight one-shot arms (one, two and three drops
// at mana value 1 to 6; chi2 5.2 on 5), and with one scalar it fits the shape
// of the five Dawn arms (chi2 2.1 on 4). The flat reading, every extra mana
// before the cap worth the same, is rejected (chi2 68 on 12).
//   RAMP_TURN_DECAY 0.89 [0.81, 1.00]: an extra mana a turn later is worth
//     0.89 of one now.
//   RAMP_STACK 0.58 [0.38, 0.76]: a second extra mana on the same turn is
//     worth 0.58 of the first, a third 0.58 squared (likely because the
//     hand runs out of things to cast; not measured directly).
//   RAMP_DAWN_SHARE 0.62 [0.50, 0.74]: a Dawn engine realizes 0.62 of its
//     capped schedule against a one-shot's rate; its extra land arrives late
//     and needs the game to last, and it realized about 0.7 as much of its
//     scheduled mana in the lab.
// The level stays on the §4p anchor (the one-shot at mana value 2 is 1.9). The
// lab reads that probe at 1.2 [0.95, 1.6] +1/+1 when cast on curve, and at 0.3
// as MediumAI casts it (it values the op at 0 and casts ramp late): an owner
// call, not changed here. See balance/study/lab/ramp-findings.md.
export const RAMP_ANCHOR = 1.9; // §4p: one extra land drop at mana value 2 (Rampant Growth)
export const RAMP_TURN_DECAY = 0.89;
export const RAMP_STACK = 0.58;
export const RAMP_DAWN_SHARE = 0.62;

/** Extra untapped mana on each of your own turns 1..LAND_RESERVE_SIZE, given
 * `drops(turn)` extra land drops on that turn, against one land a turn. The
 * normal drop comes in untapped; each extra drop enters tapped, so it pays from
 * your next turn; the reserve caps lands in play. */
export function extraManaByTurn(drops: (turn: number) => number): number[] {
  const out: number[] = [];
  let lands = 0;
  for (let turn = 1; turn <= LAND_RESERVE_SIZE; turn++) {
    if (lands < LAND_RESERVE_SIZE) lands++;
    out.push(lands - Math.min(turn, LAND_RESERVE_SIZE));
    lands = Math.min(LAND_RESERVE_SIZE, lands + drops(turn));
  }
  return out;
}

/** The land drops granted by an ability cast on `castTurn`: once, or at every
 * Dawn after it. */
function rampMana(castTurn: number, n: number, everyDawn: boolean): number[] {
  return extraManaByTurn((turn) => (everyDawn ? (turn > castTurn ? n : 0) : (turn === castTurn ? n : 0)));
}
/** A turn's lead of `extra` mana: the first counts 1, each more RAMP_STACK of the last. */
const leadValue = (extra: number): number => (1 - RAMP_STACK ** extra) / (1 - RAMP_STACK);
const weighted = (mana: number[]): number => mana.reduce((s, m, i) => s + RAMP_TURN_DECAY ** i * leadValue(m), 0);
const RAMP_PER_WEIGHTED_MANA = RAMP_ANCHOR / weighted(rampMana(2, 1, false));

/** §4v: what `n` extra land drops are worth when cast on your own turn
 * `castTurn` (the mana paid for them), once or at every Dawn after it. A
 * one-shot at 2 is the anchor. */
export function extraLandValue(castTurn: number, n: number, everyDawn: boolean): number {
  const value = RAMP_PER_WEIGHTED_MANA * weighted(rampMana(Math.max(1, castTurn), n, everyDawn));
  return everyDawn ? RAMP_DAWN_SHARE * value : value;
}

/** Own turns on which the drops give extra mana, for the breakdown label. */
function rampTurns(castTurn: number, n: number, everyDawn: boolean): number {
  return rampMana(Math.max(1, castTurn), n, everyDawn).filter((m) => m > 0).length;
}

// ── Effect valuation ─────────────────────────────────────────────────────────

export interface Part {
  label: string;
  v: number;
}

/** Magnitude of a stat/keyword delta, in the same units the body/aura use.
 * v4 (§4u): the stat delta is priced as the body's change on its host, and
 * each granted keyword on the host AFTER the delta (a +2/+0 Skyborne grant on
 * a 3/3 is Skyborne at attack 5). `base` omitted = the nominal unknown host. */
function statKwMagnitude(p: number | undefined, t: number | undefined, keywords: Keyword[] | undefined, unknowns: UnknownCollector, base: Host = nominalHost()): number {
  const after: Host = { a: base.a + (p ?? 0), d: base.d + (t ?? 0) };
  return (bodyValue(after.a, after.d) - bodyValue(base.a, base.d)) + (keywords ?? []).reduce((s, k) => s + kwValue(k, unknowns, after), 0);
}

// D6 (in-engine, 2026-09-26): the face-damage and drain intercept belongs to a
// Charm or Ritual's own effect only, never to a permanent's trigger or Duty
// activation (valueDuty scores its ops as 'spell').
const isPermanentCard = (card: ScorableCardDef): boolean => !card.types.includes('charm') && !card.types.includes('ritual');

/** Face damage and drain (D6, in-engine): 0.7 + 0.5 a point as a Charm or
 * Ritual's own effect, 0.5 a point as a rider. A 2-mana spell for 2.6 to the
 * face ties a 2/2 in the lab; Magic reads about 0.8 a point. */
function faceRate(n: number, when: ScorableTriggerWhen, card: ScorableCardDef): number {
  return (when === 'spell' && !isPermanentCard(card) ? 0.7 : 0) + 0.5 * n;
}

/** Skim's option value by the card's mana value (§4u): 0.35 at 4 and below,
 * 0.8 at 6 and up, and linear between. */
export function skimValue(mv: number): number {
  return 0.35 + 0.45 * Math.min(1, Math.max(0, (mv - 4) / 2));
}

/** The symmetric sweeper's rate for n damage to each creature (rate-card
 * audit row 10, Magic through 2020): v2's 0.9 + 0.55 n up to 1 damage, then
 * 2.0 at 2 damage and 0.9 a point past it, capped at a wrath (4.0). Magic reads
 * n=2 at 1.9-2.7 (Whipflare, Fiery Cannonade), n=3 at 3.1 (Anger of the Gods,
 * Slagstorm) and n=4 at 4.0 (Storm's Wrath), against a wrath's 4.0. */
export function sweepRate(n: number): number {
  return n >= 2 ? Math.min(4.0, 2.0 + 0.9 * (n - 2)) : 0.9 + 0.55 * n;
}

/** 1.9 (A1.4): one Hunt op (see the Hunt block above). The caller multiplies
 * a triggered ability's ops by triggerMult(when), so a source-bound Hunt
 * returns its carrier's net value divided back by that multiplier, as
 * ARRIVAL_MARK_BODY does. `spell` is the colour-pie scan's read of the op. */
function valueHunt(op: Extract<ScorableEffectOp, { op: 'hunt' }>, card: ScorableCardDef, when: ScorableTriggerWhen): Part {
  if (op.prey === 'yours') return { label: 'hunt one of your own creatures (measured at 0)', v: HUNT_PREY_YOURS };
  if (op.hunter === 'target') return { label: 'hunt (with a creature you choose)', v: huntSpellValue(0) };
  const a = card.attack ?? 0, d = card.defense ?? 0;
  const exchange = huntExchange(a, d);
  const cap = huntLowAttackCapped(a, d) ? ', low Attack, NEEDS MATH' : '';
  const label = `hunt (hunter ${a}/${d}, ${huntSurvives(d) ? 'survives' : 'dies'}${cap})`;
  if (when === 'spell') return { label, v: exchange };
  const carrier = when === 'arrives' ? HUNT_CARRIER.arrives : when === 'attacks' ? HUNT_CARRIER.attacks : undefined;
  const mult = triggerMult(when, card);
  const v = mult > 0 ? (exchange * (carrier ?? 1.0)) / mult : 0;
  return { label: carrier === undefined ? `${label}, NEEDS MATH: an unmeasured carrier at the arrival rate` : label, v };
}

/** 1.9 (A1.4b): how a gated ability's Hunt is priced. An arrival Hunt gated on
 * another creature of one of the card's own subtypes takes the measured tribal
 * factor (`factor`, replacing the ability's gate); any other gate on a Hunt
 * keeps the ability's standing factor (no `factor`) and is marked an estimate.
 * Undefined when the ability has no gate. */
export function conditionalHuntGate(ab: ScorableAbilityDef, card: ScorableCardDef): { factor?: number; label: string } | undefined {
  const cond = ab.condition;
  if (cond === undefined) return undefined;
  if (typeof cond === 'object' && cond.kind === 'controlsOther') {
    if (ab.when === 'arrives' && (card.subtypes ?? []).includes(cond.subtype)) {
      return { factor: COND_HUNT_OWN_TRIBE, label: `if you control another ${cond.subtype}, its own tribe (measured x${COND_HUNT_OWN_TRIBE})` };
    }
    return { label: `if you control another ${cond.subtype}, NEEDS MATH: ${ab.when === 'arrives' ? 'not its own tribe (measured about 0.2 off-tribe)' : 'an unmeasured carrier'}, at the standing x${COND_CONTROLS_OTHER}` };
  }
  return { label: 'conditional, NEEDS MATH: an unmeasured gate on a Hunt' };
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
    const mag = statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns, hostOf(card));
    return { label: 'awaken(self)', v: 0.6 * mag };
  }
  // scope 'allYours': every creature you control with its OWN awakening rider
  // awakens (src/engine/effects/EffectInterpreter.ts `awakenPermanent` reads
  // each permanent's own card def, not the source's). If this card is itself
  // a creature carrying `awakening`, it is at least one guaranteed beneficiary;
  // otherwise this is a pure payoff card and we fall back to the nominal rate.
  const mag = card.awakening
    ? statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns, hostOf(card))
    : NOMINAL_AWAKEN_DELTA;
  const nominalTag = card.awakening ? '' : ', nominal';
  return { label: `awaken(allYours${nominalTag})`, v: 0.6 * mag * TEAM_FACTOR };
}

/** Value one EffectOp. `canFace` = the owning ability can target a player.
 * `castMana` = the mana the effect is cast for when that is not the card's own
 * mana value (an Empower rider, a Retell, a later Quest chapter); only the
 * extra land drop reads it (§4v). */
export function valueOp(
  op: ScorableEffectOp,
  canFace: boolean,
  card: ScorableCardDef,
  when: ScorableTriggerWhen = 'spell',
  targetWhat?: string,
  unknowns: UnknownCollector = new Set<string>(),
  castMana: number = manaValue(card.cost),
): Part {
  switch (op.op) {
    case 'damage': {
      const n = op.n === 'X' ? NOMINAL_X : op.n;
      const damageTarget = op.to;
      switch (damageTarget) {
        case 'controller': {
          // v4 (rate-card audit, Magic through 2020): a ONE-SHOT payment is
          // settled at 0.15 a point (Ancient Craving, Ambition's Cost, Succumb
          // to Temptation, Anguished Unmaking: 0.10-0.15). A recurring
          // drawback keeps SELF_DMG_RATE: Magic's creatures read 0.58 a fire,
          // Phyrexian Arena 0.3-0.6, so the recurring rate is NEEDS MATH.
          const oneShot = when === 'spell' || when === 'arrives' || when === 'dies' || when === 'entersGraveyard';
          const rate = oneShot ? SELF_DMG_ONE_SHOT_RATE : SELF_DMG_RATE;
          return { label: `self-dmg ${n}`, v: -rate * n };
        }
        case 'opponent':
          // v4 (D6, in-engine): replaces §4k's owner-ruled 0.15 + 0.3 n.
          return { label: `face dmg ${n}`, v: faceRate(n, when, card) };
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
            v: sweepRate(n) + sever,
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
            v: ONE_SIDED_SWEEP_MULT * (sweepRate(n) + sever),
          };
        }
        case 'target':
          // 1.9 (A1.4): damage aimed at a creature you control is a Provoked
          // source, priced once per card (selfSourcePart), never as burn.
          if (targetWhat === 'yourCreature') return { label: `damage to your own creature ${n} (a Provoked source)`, v: 0 };
          // to a target: any-target burn has removal utility (higher floor) vs creature-only.
          // v2.6 SLOPE CORRECTION (owner-approved 2026-08-28, see §4k): the v1
          // rate `0.60 + 0.35n` was calibrated at Shock (n=2) then extrapolated
          // LINEARLY, but real burn runs ~1 mana per damage point beyond the
          // first (Lightning Strike 3 = MV2, Flame Javelin 4 ~ MV3, Fireball
          // X=5 = MV6). By n=5 the old rate under-priced by nearly two mana and
          // produced cost-cut proposals that would have printed "5 damage to
          // any target" at MV2. The max() leaves every n<=2 value — and so
          // every §6 anchor — byte-identical, correcting only the extrapolation.
          // v4 (rate-card audit row 6, Magic through 2020): creature-only burn
          // gets the same fix at a gentler slope, 0.5 a point past 2, capped
          // at destroy (2.7). Magic reads n=3 at 1.7, n=4 at 2.2 (n=10: Flame
          // Slash, Bathe in Dragonfire) and n=5 past a kill spell.
          return canFace
            ? { label: `burn any ${n}`, v: Math.max(0.6 + 0.35 * n, 1.3 + 1.0 * (n - 2)) }
            : { label: `burn creature ${n}`, v: creatureBurnRate(n) };
        case 'eachYourCreature':
          // 1.9 (A1.4): damage to your own side is a Provoked source, priced
          // once per card (selfSourcePart).
          return { label: `damage each ${(op as { other?: true }).other ? 'other ' : ''}creature you control ${n} (a Provoked source)`, v: 0 };
        default: {
          const _exhaustive: never = damageTarget;
          unknowns.add(`damage.to:${String(_exhaustive)}`);
          return { label: 'unknown damage.to', v: 0 };
        }
      }
    }
    case 'gainLife':
      // The v4 audit's proposed intercept was noise on the wider window
      // (0.05-0.10); the 0.2 slope is confirmed. Unchanged.
      return { label: `gain ${op.n}`, v: 0.2 * op.n };
    case 'loseLife':
      // v4 (D6, in-engine): drain rides the face-damage curve.
      return { label: `drain ${op.n}`, v: faceRate(op.n, when, card) };
    case 'draw':
      // v4 (rate-card audit row 12, Magic through 2020): past draw 2 each card
      // adds 1.0, not 1.35 (draw 3 at 3.96, draw 4 at 4.89 in Magic).
      return { label: `draw ${op.n}`, v: op.n > 2 ? 3.0 + 1.0 * (op.n - 2) : 0.3 + 1.35 * op.n };
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
      // D6 (in-engine) measured 0.78 [0.62, 0.93] a card: 0.9 stays.
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
      // v4 (rate-card audit row 8, Magic through 2020, n=55): a targeted pump
      // weights power over toughness, 0.3 a point of power and 0.1 of
      // toughness (Magic 0.73 + 0.33p + 0.03t); a +1/+1 is unchanged at 0.4.
      // Every other scope keeps 0.2 a stat. A granted keyword counts half,
      // priced on the nominal host plus the pump's own stats.
      const stats = op.scope === 'target' && op.p >= 0 && op.t >= 0 ? 0.3 * op.p + 0.1 * op.t : 0.2 * (op.p + op.t);
      const kw = (op.keywords ?? []).reduce((s, k) => s + 0.5 * kwValue(k, unknowns, nominalHost(op.p, op.t)), 0);
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
          return { label: `self pump ${sign(op.p)}/${sign(op.t)}`, v: statKwMagnitude(op.p, op.t, op.keywords, unknowns, hostOf(card)) };
        case 'allYours':
          // v4 (a slate finding, 2026-09-26): on a charm or ritual's own team
          // pump the +0.3 "being a spell" floor counts once, outside the team
          // factor; only the per-creature stats and keywords are multiplied.
          // A recurring, triggered or Duty pump keeps the old form, because the
          // §4i Dawn fit (and §4q's Duty rate on it) was backed out with that
          // intercept inside.
          return { label: `team pump +${op.p}/+${op.t}`, v: when === 'spell' && !isPermanentCard(card) ? 0.3 + (stats + kw) * TEAM_FACTOR : base * TEAM_FACTOR };
        case 'all': {
          // v2 — symmetric (helps BOTH players' creatures per
          // EffectInterpreter). Valued on raw |stats|+|keywords| magnitude
          // (not the signed `base`, which bakes in a +0.3 "being a spell"
          // floor meant for one-sided pumps) at a modest 1.2x, not the
          // one-sided 2.0x TEAM_FACTOR. Anchor: a board-wide -1/-1 (Nausea/
          // Crippling Fear-class) is weak, narrow, situational removal —
          // matches so-creeping-malaise landing clearly cold below.
          const magKw = (op.keywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns)), 0);
          const label = `symmetric pump ${op.p >= 0 ? '+' : ''}${op.p}/${op.t >= 0 ? '+' : ''}${op.t}`;
          // v4 (a slate finding, 2026-09-26): a symmetric -X/-X kills what
          // X damage to each creature kills, so it is priced as that sweeper
          // on the sweep curve (sweepRate), not as a pump. The slate found it
          // on Black Tide Rising's -3/-3.
          if (op.p < 0 && op.p === op.t) return { label, v: sweepRate(-op.p) + magKw };
          const mag = Math.abs(stats) + magKw;
          return { label, v: mag * 1.2 };
        }
        // §4m — board-wide but restricted to MARKED creatures, no target choice.
        // `yourMarked` is a narrowed allYours: in a mark deck most of your
        // board is marked, but not all of it, so it sits below TEAM_FACTOR.
        case 'yourMarked':
          // Same rule as `allYours`: a charm or ritual's floor sits outside the factor.
          return { label: `marked-team pump +${op.p}/+${op.t}`, v: when === 'spell' && !isPermanentCard(card) ? 0.3 + (stats + kw) * MARKED_TEAM_FACTOR : base * MARKED_TEAM_FACTOR };
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
      // D6 (in-engine) measured a Mark at 0.74 [0.60, 0.87] in-deck: 0.7
      // stays (Magic reads about 1.0). A creature ENTERING with Marks on
      // itself is body, not a trigger: 1.0 a Mark with no arrival haircut
      // (Ashwood Ranger measured 1.6 for its Mark), so the 0.75 arrival
      // multiplier the caller applies is divided back out here.
      if (op.to === 'self' && when === 'arrives') return { label: `enters with +1/+1 ×${op.n} (body)`, v: (ARRIVAL_MARK_BODY * op.n) / TRIGGER_MULT.arrives };
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
      // v4 (D6, in-engine): measured at 1.0, down from 1.8.
      return { label: 'mark all your creatures', v: 1.0 };
    case 'moveMark':
      // Bioshift {G/U} moves ANY NUMBER of +1/+1 counters for one mana at
      // common. Ours moves exactly ONE and both ends must be your own
      // permanents (a controller check in runOp on top of the target spec), so
      // net board stats never change. Strictly weaker than the anchor.
      // v4 (D6, in-engine): measured at about 0, priced 0.1 (from 0.5).
      return { label: 'move 1 mark (own side)', v: 0.1 };
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
      // is a blend of the two branches rather than the optimistic read.
      // v4 (D6, in-engine): the marked branch is weighted 0.09, not §4m's
      // even 0.5; in the measured pool the target is rarely marked.
      const gate = op as Extract<ScorableEffectOp, { op: 'ifTargetMarked' }>;
      const sum = (ops: ScorableEffectOp[]) => ops.reduce((s, o) => s + valueOp(o, canFace, card, when, targetWhat, unknowns).v, 0);
      const thenV = sum(gate.then ?? []);
      const elseV = sum(gate.else ?? []);
      return { label: 'if-marked (blended branches)', v: IF_MARKED_WEIGHT * thenV + (1 - IF_MARKED_WEIGHT) * elseV };
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
      // v4 (D6, in-engine): one-shot 0.3 (from 0.7) and 0.1 a Dawn trigger
      // (from 1.65, so 0.3 in all on the non-creature carrier instead of
      // 4.95): boards rarely hold more than one or two Marked creatures.
      if (when === 'dawn') return { label: 'propagate (repeatable, per-trigger)', v: 0.1 };
      return { label: 'propagate (one-shot)', v: 0.3 };
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
      // v4 (§4v, 1.8.5 ramp lane, in-engine): no longer flat. The value is
      // the extra untapped mana the drops give on your turns before the
      // 10-land reserve runs out, cast on the turn equal to the mana paid (see
      // extraLandValue), with the one-shot at mana value 2 kept at the 1.9
      // anchor; a {G} ramp ritual now reads Over on the rate alone (the floor
      // rule stays). A Dawn trigger grants a drop at every Dawn until the cap,
      // so it is priced as that capped total, not per trigger: the part below
      // is the total divided by the non-creature Dawn multiplier, which the
      // trigger's own multiplier restores (a creature carrier keeps its
      // 2.0 / 3.0 survival discount). A drop granted at Sunset comes after the
      // last main phase, so it can never be used.
      const n = op.n ?? 1;
      const drops = n > 1 ? ` ×${n}` : '';
      if (when === 'sunset') return { label: `extra land drop${drops} (too late in the turn to use)`, v: 0 };
      const everyDawn = when === 'dawn';
      const turn = Math.max(1, castMana);
      const label = `extra land drop${drops} (cast at ${turn}, ${rampTurns(turn, n, everyDawn)} turns before cap ${LAND_RESERVE_SIZE})`;
      const value = extraLandValue(turn, n, everyDawn);
      return { label, v: everyDawn ? value / DAWN_MULT_NONCREATURE : value };
    }
    case 'createToken':
      // Each token is its body (keywords priced on the token's own Attack)
      // plus a per-token floor. v4 (rate-card audit row 7, Magic through
      // 2020, n=14): the floor drops from 0.3 to 0.15, since Magic reads a
      // 1/1 token at 1.12 (Hordeling Outburst, Captain's Call, Krenko's
      // Command). A token's starting Marks were unpriced; D6 prices them like
      // a counter, 0.7 each (Net Full of Stars' one Mark measured +0.47).
      return { label: `token ×${op.count}`, v: op.count * (tokenBody(op.token, unknowns) + TOKEN_FLOOR + 0.7 * (op.marks ?? 0)) };
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
    case 'hunt':
      // 1.9 (A1.4): see the Hunt block above. The spell form is priced here
      // with no pump; scoreCard folds a pump on the hunter in (huntSpellValue).
      return valueHunt(op, card, when);
    // --- A1.6 (1.9): "If it survived, ..." (begin) ---
    case 'ifTargetSurvives': {
      // NEEDS MATH: a placeholder, not a rate. The `then` branch is weighted
      // 0.86, the design draft's discount for "draw if the hunter survives"
      // (Ambush at the River); `else` takes the rest. A1.4 owns the rate.
      const IF_SURVIVES_WEIGHT = 0.86;
      const gate = op as Extract<ScorableEffectOp, { op: 'ifTargetSurvives' }>;
      const sum = (ops: readonly ScorableEffectOp[]) => ops.reduce((s, o) => s + valueOp(o, canFace, card, when, targetWhat, unknowns).v, 0);
      unknowns.add('op:ifTargetSurvives (NEEDS MATH: placeholder weight 0.86 until A1.4 prices it)');
      return { label: 'if it survived (NEEDS MATH)', v: IF_SURVIVES_WEIGHT * sum(gate.then) + (1 - IF_SURVIVES_WEIGHT) * sum(gate.else ?? []) };
    }
    // --- A1.6 (end) ---
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
      // v4 (rate-card audit row 11, Magic through 2020, n=38): a buff weights
      // power over toughness, 0.7 a point of power and 0.3 of toughness
      // (Magic 0.50 + 0.59p + 0.25t); a debuff is the body change it makes on
      // the nominal host. A granted keyword is priced on the nominal host plus
      // the aura's own stats.
      const onHost = nominalHost(st.p ?? 0, st.t ?? 0);
      const ap = st.p ?? 0, at = st.t ?? 0;
      const statMag = ap >= 0 && at >= 0
        ? 0.7 * ap + 0.3 * at
        : Math.abs(bodyValue(onHost.a, onHost.d) - bodyValue(NOMINAL_HOST.attack, NOMINAL_HOST.defense));
      const mag = statMag
        + (st.grantKeywords ?? []).reduce((s, k) => s + Math.abs(kwValue(k, unknowns, onHost)), 0);
      return { label: `aura ${sign(st.p)}/${sign(st.t)}`, v: Math.max(0, mag - 0.3) };
    }
    case 'self': {
      // v2 — a static granted only to its own source (e.g. Galahad, Silver
      // Oath's conditional self-untouchable). Valued exactly like the same
      // keyword/stat printed directly on the body: no team multiplier, no
      // aura haircut (it can't fall off — it dies with its own permanent
      // the same way a printed keyword would).
      const mag = statKwMagnitude(st.p, st.t, st.grantKeywords, unknowns, hostOf(_self));
      return { label: `self ${sign(st.p)}/${sign(st.t)}`, v: mag };
    }
    case 'filter': {
      // Anthem/lord: applies to the team (excluding self if `other`), recurring.
      if (st.filter?.who === 'opponent') {
        // 2026-09-11 (found scoring the Drowned Deep overplan): a static that
        // DEBUFFS the opponent's team is worth the magnitude of the debuff
        // (a reverse anthem, Night of Souls' Betrayal / Engineered Plague
        // shape), not a negative number. A keyword granted to the enemy team
        // is a drawback and stays negative. v4: both are priced on the nominal
        // host (the body change the debuff makes, each keyword on the host
        // after it); lane 2 measured only your own anthems.
        const onF = nominalHost(st.p ?? 0, st.t ?? 0);
        const stats = bodyValue(onF.a, onF.d) - bodyValue(NOMINAL_HOST.attack, NOMINAL_HOST.defense);
        const kw = (st.grantKeywords ?? []).reduce((s, k) => s + kwValue(k, unknowns, onF), 0);
        return { label: `enemy anthem ${sign(st.p)}/${sign(st.t)}`, v: (Math.abs(stats) - kw) * TEAM_FACTOR };
      }
      // v4 (lane 2, in-engine, D4 and D10): a creature lord x2.0 (TEAM_FACTOR),
      // a non-creature anthem x2.8, on a per-creature magnitude in the units
      // the factors were measured in: 0.5 a stat (BODY_PER_STAT) and each
      // granted keyword at its FLAT value (KEYWORD_VALUE), so an anthem's
      // scaled keyword is not counted twice.
      const flatKw = (st.grantKeywords ?? []).reduce((sum, k) => sum + flatKwValue(k, unknowns), 0);
      const mag = BODY_PER_STAT * ((st.p ?? 0) + (st.t ?? 0)) + flatKw;
      const factor = _self.types.includes('creature') ? TEAM_FACTOR : TEAM_ANTHEM_NONCREATURE;
      return { label: `anthem ${sign(st.p)}/${sign(st.t)}`, v: mag * factor };
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
// v4: the token's body, and its keywords on its own Attack (§4u).
function tokenBody(id: string, unknowns: UnknownCollector): number {
  const card = TOKEN_DEFS.get(id);
  if (!card) return 1.0;
  const host = hostOf(card);
  const kw = (card.keywords ?? []).reduce((sum, keyword) => sum + kwValue(keyword, unknowns, host), 0) + rageRebate(card.keywords);
  return bodyValue(host.a, host.d) + kw;
}

// ── Card scoring ─────────────────────────────────────────────────────────────

const canFaceOf = (ab: ScorableAbilityDef): boolean => (ab.targets ?? []).some((t) => t.what === 'any');

/** How many targets an ability's targeted ops hit. A sole `upTo: 2` or
 * `exactly: 2` spec fans those ops across two independently chosen targets
 * (the engine's target batch, src/engine/resolve.ts), so each is priced once
 * per target. v4 (a slate finding, 2026-09-26): "up to two target creatures"
 * used to price as one. */
function targetFan(targets: readonly TargetSpec[] | undefined): number {
  if (targets?.length !== 1) return 1;
  return Math.max(1, targets[0].upTo ?? targets[0].exactly ?? 1);
}

/** An op that acts on the ability's target, and so runs once per target. */
function isPerTargetOp(op: ScorableEffectOp): boolean {
  if (op.op === 'boost') return op.scope === 'target';
  if (op.op === 'ifTargetMarked' || op.op === 'reclaim') return true;
  if (op.op === 'foresee') return op.who === 'targetOwner';
  return (op as { to?: string }).to === 'target';
}

/** The label suffix naming a fanned op's target count. */
const fanLabel = (fan: number): string => (fan > 1 ? ` (${fan} targets)` : '');

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

/** Every op, branch ops included (the engine's own flatOps, so a branch op
 * the engine adds later is walked here too). */
const flatScorable = (ops: readonly ScorableEffectOp[]): ScorableEffectOp[] => flatOps(ops as readonly EffectOp[]) as ScorableEffectOp[];

/** The §4q Duty discount: 0.4 a mana of activation cost, at most 1.5. */
function dutyDiscount(ability: ScorableActivated): number {
  return Math.min(1.5, 0.4 * manaValue(ability.cost.mana));
}

/** The target spec an op aims at: its ability's slot `targetIndex` (default 0). */
function specOf(op: ScorableEffectOp, targets: readonly TargetSpec[] | undefined): TargetSpec | undefined {
  return targets?.[(op as { targetIndex?: number }).targetIndex ?? 0];
}

/** The target kind an op is valued against. A damage op reads its own slot
 * (1.9, A1.4: whether it hits your own creature is decided there); every other
 * op keeps the ability's first slot, as the scorer always has. */
function opTargetWhat(op: ScorableEffectOp, targets: readonly TargetSpec[] | undefined): string | undefined {
  return op.op === 'damage' ? specOf(op, targets)?.what : targets?.[0]?.what;
}

/** Every op list on the card with the targets it is aimed with. */
function opListsOf(card: ScorableCardDef): { ops: readonly ScorableEffectOp[]; targets?: readonly TargetSpec[] }[] {
  return [
    ...(card.abilities ?? []).map((ab) => ({ ops: ab.ops ?? [], targets: ab.targets })),
    ...dutiesOf(card).map((duty) => ({ ops: duty.ops, targets: duty.targets })),
    ...(card.empower ? [{ ops: card.empower.ops, targets: card.empower.targets }] : []),
    ...(card.chapters ?? []).map((ops) => ({ ops })),
  ];
}

/** 1.9 (A1.4): does any of the card's effects damage its controller's own creatures? */
function damagesOwnCreatures(card: ScorableCardDef): boolean {
  return opListsOf(card).some(({ ops, targets }) => flatScorable(ops).some((op) => op.op === 'damage' &&
    (op.to === 'eachYourCreature' || (op.to === 'target' && specOf(op, targets)?.what === 'yourCreature'))));
}

/** 1.9 (A1.4): a creature with a Provoked ability and a Duty that can damage
 * the creature itself (a self-provoke engine): that Duty, else undefined. */
function selfProvokeDuty(card: ScorableCardDef): ScorableActivated | undefined {
  if (!card.types.includes('creature') || !(card.abilities ?? []).some((ab) => ab.when === 'provoked')) return undefined;
  return dutiesOf(card).find((duty) => flatScorable(duty.ops).some((op) => {
    if (op.op !== 'damage') return false;
    if (op.to === 'eachCreature') return true;
    if (op.to === 'eachYourCreature') return !op.other;
    const spec = specOf(op, duty.targets);
    return op.to === 'target' && !!spec && !spec.other && (spec.what === 'creature' || spec.what === 'yourCreature' || spec.what === 'any');
  }));
}

/** 1.9 (A1.4): a spell-form Hunt's pump on its hunter (slot 0) before the Hunt:
 * the Defense it adds and the boost ops it folds in. Undefined when the ability
 * is not a spell-form Hunt. A Mark keeps its own value (it outlasts the Hunt);
 * damage to the hunter is not a loss of Defense (see HUNT_SPELL_BASE). */
function spellHuntPump(ab: ScorableAbilityDef): { defense: number; folded: Set<ScorableEffectOp> } | undefined {
  const ops = ab.ops ?? [];
  const at = ops.findIndex((op) => op.op === 'hunt' && op.hunter === 'target');
  if (ab.when !== 'spell' || at < 0) return undefined;
  const onHunter = (op: ScorableEffectOp) => ((op as { targetIndex?: number }).targetIndex ?? 0) === 0;
  let defense = 0;
  const folded = new Set<ScorableEffectOp>();
  for (const op of flatScorable(ops.slice(0, at))) {
    if (op.op === 'boost' && op.scope === 'target' && onHunter(op) && op.p >= 0 && op.t >= 0) {
      defense += op.t;
      folded.add(op);
    } else if (op.op === 'addCounters' && op.to === 'target' && onHunter(op)) {
      defense += op.n;
    }
  }
  return { defense, folded };
}

/** One Duty at the §4q rate (see the `activated` block in scoreCard). */
function valueDuty(ability: ScorableActivated, card: ScorableCardDef, unknowns: UnknownCollector): Part {
  const face = (ability.targets ?? []).some((t) => t.what === 'any');
  const fan = targetFan(ability.targets);
  let perTrigger = 0;
  // 1.9 (A1.4): a hunting Duty is priced per card at its measured rate
  // (HUNT_CARRIER.duty), not through the Dawn multiplier; the discount below
  // still applies.
  let hunt = 0;
  for (const op of ability.ops) {
    if (op.op === 'hunt') {
      hunt += op.prey === 'yours' ? HUNT_PREY_YOURS : HUNT_CARRIER.duty * huntExchange(card.attack ?? 0, card.defense ?? 0, false);
      continue;
    }
    // §4v: a Duty's extra land drop repeats once a turn, the Dawn engine's shape.
    const p = valueOp(op, face, card, op.op === 'extraLandDrop' ? 'dawn' : 'spell', opTargetWhat(op, ability.targets), unknowns);
    perTrigger += (op.op === 'tap' ? 1.0 : p.v) * (isPerTargetOp(op) ? fan : 1);
  }
  const creatureCarrier = card.types.includes('creature');
  const topBand = creatureCarrier && perTrigger >= 2.0;
  const expected = (topBand ? perTrigger + 1.0 : dawnMult(card) * perTrigger) + hunt;
  const activationMana = manaValue(ability.cost.mana);
  // The rate-card audit settled the discount's SHAPE (proportional to the
  // ability's value, no cap) but not its size, so today's discount stays
  // until the Duty coefficient is measured (NEEDS MATH, docs/plan-1.8.5.md).
  const discount = Math.min(1.5, 0.4 * activationMana);
  const value = Math.max(0, expected - discount);
  const carrier = creatureCarrier ? 'creature' : 'non-creature';
  const mana = activationMana ? `, {${activationMana}} to activate` : '';
  const band = topBand ? ', NEEDS MATH band' : '';
  const hunts = ability.ops.some((op) => op.op === 'hunt') ? ', hunts' : '';
  return { label: `duty (${carrier} carrier${mana}${hunts}${band})`, v: value };
}

export function scoreCard(card: ScorableCardDef): Score {
  const unknowns = new Set<string>();
  const parts: Part[] = [];
  const isCreature = card.types.includes('creature');
  const isCharm = card.types.includes('charm');

  if (isCreature) {
    const host = hostOf(card);
    parts.push({ label: `body ${host.a}/${host.d}`, v: bodyValue(host.a, host.d) });
    for (const k of card.keywords ?? []) parts.push({ label: keywordLabel(k, host.a), v: kwValue(k, unknowns, host) });
    const rebate = rageRebate(card.keywords);
    if (rebate) parts.push({ label: 'rage on an attacker (§4o)', v: rebate });
    const stack = keywordStackDiscount(card.keywords);
    if (stack) parts.push({ label: '3+ keyword stack', v: stack });
    // v2.1 — carrying an `awakening` rider is worth something even when the
    // card cannot awaken itself (Quest/enabler decks turn it on). Half the
    // 0.6 awaken(self) rate for the external-enabler dependency. Self-awaken
    // cards are excluded — their own awaken op already credits the rider.
    const selfAwakens = (card.abilities ?? []).some((ab) =>
      (ab.ops ?? []).some((o) => o.op === 'awaken' && (o.scope === 'self' || o.scope === undefined)));
    if (card.awakening && !selfAwakens) {
      const mag = statKwMagnitude(card.awakening.p, card.awakening.t, card.awakening.keywords, unknowns, hostOf(card));
      parts.push({ label: 'awakening rider (needs enabler)', v: round(0.3 * mag) });
    }
  }

  // 1.9 (A1.4): the Duty that makes this creature a self-provoke engine, if any.
  const engineDuty = selfProvokeDuty(card);
  let spellEffect = 0;
  // §4v: the extra land drops inside `spellEffect`, so a Retell that re-casts
  // the printed spell can re-price them at the Retell's own mana.
  const rampInSpell: { op: ScorableEffectOp; when: ScorableTriggerWhen; mult: number }[] = [];
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
    const fan = targetFan(ab.targets);
    // 1.9 (A1.4): a Provoked on a self-provoke engine, and a spell-form Hunt's
    // pump on its hunter (see the Hunt and Provoked block above).
    let tag = '';
    if (ab.when === 'provoked' && engineDuty) {
      const raw = (ab.ops ?? []).reduce((sum, op) => sum + valueOp(op, face, card, ab.when, opTargetWhat(op, ab.targets), unknowns).v * (isPerTargetOp(op) ? fan : 1), 0);
      const engine = Math.max(0, SELF_PROVOKE_FIRES * raw - dutyDiscount(engineDuty));
      if (raw > 0 && engine > mult * raw) {
        mult = (engine / raw) * condMult;
        tag = ' (fired by its own Duty)';
      }
    }
    const huntPump = spellHuntPump(ab);
    const huntGate = conditionalHuntGate(ab, card);
    for (const op of ab.ops ?? []) {
      let p = valueOp(op, face, card, ab.when, opTargetWhat(op, ab.targets), unknowns);
      if (huntPump && op.op === 'hunt' && op.hunter === 'target' && op.prey !== 'yours') {
        p = { label: huntPump.defense ? `hunt (with a creature you choose, +${huntPump.defense} Defense first)` : p.label, v: huntSpellValue(huntPump.defense) };
      } else if (huntPump?.folded.has(op) && op.op === 'boost') {
        // The pump's stats are in the Hunt; a granted keyword keeps its share.
        const kw = (op.keywords ?? []).reduce((s, k) => s + 0.5 * kwValue(k, unknowns, nominalHost(op.p, op.t)), 0);
        p = { label: `pump ${sign(op.p)}/${sign(op.t)} on the hunter (in the Hunt)`, v: kw };
      }
      // 1.9 (A1.4b): a gated Hunt takes its own factor in place of the ability's gate.
      let opMult = mult;
      if (op.op === 'hunt' && huntGate) {
        p = { ...p, label: `${p.label}, ${huntGate.label}` };
        if (huntGate.factor !== undefined) opMult = mult * (huntGate.factor / condMult);
      }
      const perTarget = isPerTargetOp(op) ? fan : 1;
      const v = p.v * opMult * perTarget;
      parts.push({ label: `${ab.when}:${p.label}${tag}${fanLabel(perTarget)}`, v });
      if (!isCreature) spellEffect += v;
      if (!isCreature && op.op === 'extraLandDrop') rampInSpell.push({ op, when: ab.when, mult: mult * perTarget });
    }
  }

  // Mana rock / mana creature: a repeatable mana source is worth ~1 ramp.
  // v3 (2026-08-29): scale with the number of colours produced. A flat 1.3
  // priced Canopic Cartouche — a five-colour rock — the same as a mono one,
  // and the batch proposed cutting it to {1}. Fixing is worth real MEP:
  // Chromatic Lantern / Coalition Relic sit a full tier above Mind Stone.
  if (card.manaAbility?.length && !card.types.includes('land')) {
    const colours = new Set(card.manaAbility).size;
    // v4 (rate-card audit row 9, Magic through 2020, n=35): on a creature the
    // ability is worth 0.5 (Magic 0.55), since the body is priced beside it;
    // a mana rock keeps 1.3.
    const baseMana = isCreature ? 0.5 : 1.3;
    const p = { label: colours > 1 ? `mana source (${colours} colours)` : 'mana source', v: baseMana + 0.15 * (colours - 1) };
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
    // v4 (rate-card audit, cycling on otherwise-vanilla creatures, Magic
    // through 2020): 0.8 at mana value 6 and up (n=14), 0.35 at 4 and below.
    // Continuous between (0.575 at mana value 5), so adding a mana to a Skim
    // card never reads worse (a slate finding: a step made it).
    parts.push({ label: 'skim option', v: skimValue(manaValue(card.cost)) });
  }

  if (card.retell) {
    // Retell (≈Flashback): 0.4x the retell mode's effect value. Override ops
    // when present (trigger-safe/target-free per docs/rules.md); otherwise
    // fall back to the printed spell's own total op value (`spellEffect`,
    // accumulated above — pre charm-premium, which is correct: the printed
    // ops are what get re-cast, not the instant-speed flexibility bonus).
    mechanics.push('retell');
    // §4v: an extra land drop in the re-cast is priced at the Retell's mana,
    // not the printed card's.
    const retellMana = manaValue(card.retell.cost);
    const effectValue = card.retell.ops
      ? card.retell.ops.reduce((s, op) => s + valueOp(op, false, card, 'spell', undefined, unknowns, retellMana).v, 0)
      : spellEffect + rampInSpell.reduce((s, r) => s + r.mult * (
        valueOp(r.op, false, card, r.when, undefined, unknowns, retellMana).v - valueOp(r.op, false, card, r.when, undefined, unknowns).v), 0);
    parts.push({ label: 'retell option', v: 0.4 * effectValue });
  }

  if (card.empower) {
    // Empower (≈Kicker): 0.5x the rider's op value. Additive cost, paid on
    // top of the printed cost, so never priced at full rate.
    mechanics.push('empower');
    // §4v: an extra land drop in the rider is cast for the printed cost plus
    // the Empower cost.
    const empoweredMana = manaValue(card.cost) + manaValue(card.empower.cost);
    // 1.9 (A1.4): an Empower Hunt is worth HUNT_CARRIER.empower (measured 0).
    const riderHunts = card.empower.ops.some((op) => op.op === 'hunt');
    const riderValue = card.empower.ops.reduce((s, op) => s + (op.op === 'hunt' ? 0 : valueOp(op, false, card, 'spell', undefined, unknowns, empoweredMana).v), 0);
    const riderHunt = riderHunts ? HUNT_CARRIER.empower * huntExchange(card.attack ?? 0, card.defense ?? 0) : 0;
    // v4 (rate-card audit row 3, Magic through 2020, n=23): kicker is nearly
    // free upside, 0.15 of the rider (from 0.5). The level leans on 2015-20
    // cards (Dominaria kicker), so it carries the creep caveat.
    parts.push({ label: riderHunts ? 'empower option (its Hunt measured at 0)' : 'empower option', v: EMPOWER_SHARE * riderValue + riderHunt });
  }

  if (card.rite) {
    // Rite N: additional sacrifice cost paid while casting — a real
    // drawback (you need N creatures already in play), priced negative.
    mechanics.push('rite');
    // v4 (D6, in-engine): -1.5 a sacrifice (-1.4 to -1.6), from -0.7; Magic
    // through 2020 reads -1.1 on spells. The AI casts Rite cards less often
    // than vanillas, so this is partly how our AI plays them.
    parts.push({ label: `rite ${card.rite.n}`, v: RITE_PER_SACRIFICE * card.rite.n });
  }

  if (card.nineLives) {
    // Nine Lives (≈Undying): flat +0.9, one guaranteed extra body (marked,
    // so it cannot loop) after the first death.
    // v4: unchanged. Undying and Persist do not track body size on Magic
    // through 2020 (the pre-2010 reading that they did was overturned).
    mechanics.push('nineLives');
    parts.push({ label: 'nine lives', v: 0.9 });
  }

  if (card.preserve) {
    // Preserve (≈Embalm): flat +0.5 main-phase graveyard option. Flat like
    // Skim — the cost is paid later/separately and the card is already
    // priced as if it "replaces itself" once via the ETB-fires-twice rule
    // (docs/rules.md), so this is the pure recursion-option premium.
    mechanics.push('preserve');
    // v4 (rate-card audit, Embalm, Magic through 2020, n=8): flat 0.3 (from
    // 0.5); the option value does not track the body. All 2017 cards, so the
    // level carries the creep caveat.
    parts.push({ label: 'preserve option', v: 0.3 });
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
    // v4: the link's host is unknown, so the rider is priced on the nominal
    // host (§4u). The link's own cost is still unpriced (#403, NEEDS MATH).
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

  // 1.9 (A1.4): damage aimed at your own creatures is a Provoked source, priced
  // once per card by colour (SELF_SOURCE_RATE). A self-provoke engine's source
  // is its own Duty, already priced through its Provoked.
  if (!engineDuty && damagesOwnCreatures(card)) {
    const colours = (card.colors ?? []) as ('W' | 'U' | 'B' | 'R' | 'G')[];
    const rate = colours.length ? Math.min(...colours.map((c) => SELF_SOURCE_RATE[c] ?? 0)) : 0;
    if (rate > 0) parts.push({ label: 'damages your own creatures (a Provoked source)', v: rate });
  }

  if (card.manaActivated?.length) {
    // Repeatable mana pump (1.9, A1.5; First Dawn's Shivan Dragon analog,
    // "{R}: This gets +1/+0 until Sunset."), priced once per card (A1.4b).
    mechanics.push('manaActivated');
    const measured = isMeasuredManaPump(card);
    parts.push({ label: measured ? 'repeatable mana pump (+1/+0 for one mana, on a Skyborne creature, measured)' : 'repeatable mana pump, NEEDS MATH: an unmeasured shape at the measured +1/+0 Skyborne rate', v: MANA_PUMP_VALUE });
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
      // §4v: Chapter I resolves on arrival, each later chapter one Dawn after
      // the last, so an extra land drop in chapter i+1 is priced i turns later.
      const chapterMana = manaValue(card.cost) + i;
      const chapterTotal = chapterOps.reduce((s, op) => s + valueOp(op, false, card, 'spell', undefined, unknowns, chapterMana).v, 0);
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
