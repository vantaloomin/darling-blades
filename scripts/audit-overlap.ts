/**
 * Cross-card overlap audit: the duplicate comparator every new set is run
 * through against the live pool (not part of the doc set).
 *
 * Answers four questions the shipped `blades-db.ts` checks do not:
 *   1. IDENTICAL  — clusters of cards that are the same card with a new name.
 *   2. REDESKIN   — the same card printed at a DIFFERENT cost or colour, where
 *                   "cost" is any mana the card asks for: the printed cost, a
 *                   rider's cost (Empower, Skim, Retell, Whispers, Preserve,
 *                   Hauntlink) or a Duty's activation mana.
 *   3. DOMINATED  — A is at-least-as-good on every op AND strictly better on one,
 *                   for the same or a lower cost. This is the op-level test that
 *                   catches "White-Veil Collapse vs The Hall Clears": same body,
 *                   plus a rider, same price. `blades-db.ts dominated` compares
 *                   creature stat lines inside a shared shape and misses it.
 *                   The same rider or Duty at a cheaper price also counts.
 *   4. ODD        — internal inconsistencies: dead abilities, riders that cost
 *                   more than the card, statics that grant nothing, etc.
 *
 *   npx tsx scripts/audit-overlap.ts [identical|redeskin|dominated|odd|focus|cut|all]
 *
 * Importing this file runs nothing; the passes print only when it is the
 * script tsx was asked to run.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../src/data/catalog';
import type { AbilityDef, ActivatedDef, CardDef, Color, EffectOp, ManaCost } from '../src/engine/types';
import { activatedAbilitiesOf, manaValue } from '../src/engine/types';

const MODE = (process.argv[2] ?? 'all').toLowerCase();
/** Imported as a library (by balance/verify-recost.ts) rather than run as a CLI. */
export const AS_LIBRARY = process.env.AUDIT_AS_LIBRARY === '1';

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

const isManaCost = (v: unknown): v is ManaCost =>
  !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as ManaCost).generic === 'number' && typeof (v as ManaCost).pips === 'object';

/** Lists that hold a set of keywords wherever they appear: authoring order carries no rules meaning. */
const KEYWORD_LISTS: ReadonlySet<string> = new Set(['keywords', 'grantKeywords']);

/**
 * Deterministic key for any value: object keys sorted, arrays order-preserved
 * except keyword lists, which are sets. A zero pip in a mana cost is no pip.
 */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (isManaCost(v)) {
    const pips: Record<string, number> = {};
    for (const [col, n] of Object.entries(v.pips).sort()) if (n) pips[col] = n;
    return { generic: v.generic, pips };
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val === undefined) continue;
      out[k] = KEYWORD_LISTS.has(k) && Array.isArray(val) ? [...(val as string[])].sort() : canon(val);
    }
    return out;
  }
  return v;
}
const j = (v: unknown) => JSON.stringify(canon(v));

const costStr = (c?: ManaCost) => {
  if (!c) return '—';
  const pips = Object.entries(c.pips ?? {})
    .sort()
    .flatMap(([col, n]) => Array<string>(n ?? 0).fill(`{${col}}`))
    .join('');
  return (c.generic || !pips ? `{${c.generic}}` : '') + pips;
};

/**
 * CardDef fields that name or dress a card but never change how it plays.
 * `token` marks a non-collectible card, and tokens are never audited.
 */
const PRESENTATION: ReadonlySet<string> = new Set(['id', 'name', 'displayTypeLine', 'rarity', 'flavor', 'artRef', 'set', 'token']);
/**
 * Compared by `fullKey`, not `bodyKey`, so REDESKIN can group a card with its
 * re-costs and colour shifts. The engine never reads `colors` (it is deck
 * identity for the formats and the AI), but it is still part of the card.
 */
const PRICE: ReadonlySet<string> = new Set(['cost', 'colors']);
/** The one subtype the engine reads on the card itself: an Aura attaches as it arrives. */
const INTRINSIC_SUBTYPES: ReadonlySet<string> = new Set(['Aura']);

/**
 * Every subtype some card in `pool` reads on an audited card: a static's
 * filter, a trigger's filter or a `controlsOther` condition. Any other subtype
 * is a name only, since nothing in the rules ever looks at it. A static gated
 * to tokens (`filter.token`) pays off token creatures only, and tokens are
 * never audited, so its subtype does not count. Trigger filters and
 * `controlsOther` carry no such gate.
 */
export function typalSubtypes(pool: readonly CardDef[]): Set<string> {
  const out = new Set<string>();
  for (const d of pool)
    for (const a of d.abilities ?? []) {
      if (a.static?.filter?.subtype && !a.static.filter.token) out.add(a.static.filter.subtype);
      if (a.filter?.subtype) out.add(a.filter.subtype);
      if (typeof a.condition === 'object' && a.condition.kind === 'controlsOther') out.add(a.condition.subtype);
    }
  return out;
}

/** Subtypes that some live card pays off. */
const POOL_TYPAL = typalSubtypes(ALL_CARDS);
/** No tribe paid off: only the intrinsic subtypes count. */
const NO_TYPAL: ReadonlySet<string> = new Set();

/** Replaces every mana cost inside a rider or Duty with one placeholder. */
function stripCosts(v: unknown): unknown {
  if (isManaCost(v)) return '{cost}';
  if (Array.isArray(v)) return v.map(stripCosts);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripCosts(x)]));
  return v;
}

/**
 * The card's rules minus its printed cost and colours, as a plain object.
 *
 * Every field that is not presentation or price is kept, including fields this
 * file has never heard of: an allow-list is how the comparator went blind to
 * Duty, Tithe and Whispers when 1.8 added them. Lists whose order carries no
 * rules meaning are compared as sets, and a `false` flag or an empty list
 * prints the same card as leaving it out.
 */
function bodyFields(d: CardDef, typal: ReadonlySet<string>, costs: 'keep' | 'strip'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(d)) {
    if (PRESENTATION.has(field) || PRICE.has(field)) continue;
    if (raw === undefined || raw === false) continue;
    let value: unknown = costs === 'strip' ? stripCosts(raw) : raw;
    switch (field) {
      case 'types':
      case 'keywords':
      case 'supertypes':
      case 'manaAbility':
        value = [...(value as string[])].sort();
        break;
      case 'subtypes':
        value = (value as string[]).filter((s) => INTRINSIC_SUBTYPES.has(s) || typal.has(s)).sort();
        break;
      case 'abilities':
        value = (value as unknown[]).map(j).sort();
        break;
      case 'activated':
        // One Duty or a list of them: which one to use is the controller's
        // choice each time, so the list order is authoring order.
        value = activatedAbilitiesOf(d)
          .map((a) => j(costs === 'strip' ? { ...(stripCosts(a) as object), cost: '{cost}' } : { ...a, cost: { ...a.cost, mana: dutyMana(a) } }))
          .sort();
        break;
    }
    if (Array.isArray(value) && value.length === 0 && field !== 'types' && field !== 'chapters') continue;
    out[field] = value;
  }
  return out;
}

/**
 * Everything that changes how the card plays EXCEPT its printed cost and
 * colours. Two cards with the same body key play identically once they are on
 * the stack. Subtypes count only where the rules read them (an Aura, or a tribe
 * some card in `typal` pays off); `legendary` counts because the legend rule
 * does.
 */
export function bodyKey(d: CardDef, typal: ReadonlySet<string> = POOL_TYPAL): string {
  return j(bodyFields(d, typal, 'keep'));
}

/**
 * The body with every mana cost removed: printed, rider and Duty. Two cards
 * that share it differ at most in what they cost to cast, to use a rider, or to
 * activate a Duty.
 */
export function shapeKey(d: CardDef, typal: ReadonlySet<string> = POOL_TYPAL): string {
  return j(bodyFields(d, typal, 'strip'));
}

/** Plays identically: same body, same printed cost, same colours. */
export const fullKey = (d: CardDef, typal: ReadonlySet<string> = POOL_TYPAL) =>
  j({ body: bodyKey(d, typal), cost: costStr(d.cost), colors: [...d.colors].sort() });

/** The mana each rider and Duty asks for, in rules-text order: "Retell {2}{B}, Duty {1}{T}". */
export function riderCosts(d: CardDef): string {
  const parts: string[] = [];
  if (d.empower) parts.push(`Empower ${costStr(d.empower.cost)}`);
  if (d.skim) parts.push(`Skim ${costStr(d.skim.cost)}`);
  if (d.retell) parts.push(`Retell ${costStr(d.retell.cost)}`);
  if (d.whispers) parts.push(`Whispers ${costStr(d.whispers.cost)}`);
  if (d.preserve) parts.push(`Preserve ${costStr(d.preserve.cost)}`);
  if (d.hauntlink) parts.push(`Hauntlink ${costStr(d.hauntlink.cost)}`);
  for (const a of activatedAbilitiesOf(d)) parts.push(`Duty ${dutyCost(a)}`);
  return parts.join(', ');
}

/** A Duty's mana, if it asks for any: `mana: {0}` is the bare tap, the same as no mana. */
function dutyMana(a: ActivatedDef): ManaCost | undefined {
  return a.cost.mana && manaValue(a.cost.mana) > 0 ? a.cost.mana : undefined;
}

const dutyCost = (a: ActivatedDef) => {
  const mana = dutyMana(a);
  return `${mana ? costStr(mana) : ''}{T}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Cost comparison
// ─────────────────────────────────────────────────────────────────────────────

/** A is castable in every board state B is: no more of any pip, no higher mv. */
export function costNoWorse(a?: ManaCost, b?: ManaCost): boolean {
  if (!a || !b) return false;
  if (manaValue(a) > manaValue(b)) return false;
  const cols = new Set([...Object.keys(a.pips ?? {}), ...Object.keys(b.pips ?? {})]) as Set<Color>;
  for (const c of cols) if ((a.pips?.[c] ?? 0) > (b.pips?.[c] ?? 0)) return false;
  return true;
}
const costStrictlyBetter = (a?: ManaCost, b?: ManaCost) =>
  costNoWorse(a, b) && (manaValue(a!) < manaValue(b!) || costStr(a) !== costStr(b));

// ─────────────────────────────────────────────────────────────────────────────
// Op-level comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Numeric fields where a bigger number is unambiguously better for the caster.
 * Anything not listed must match exactly — a self-mill or a symmetric buff can
 * cut either way and this audit refuses to guess.
 */
function scalableField(op: EffectOp): string | null {
  const o = op as Record<string, unknown>;
  switch (op.op) {
    case 'damage':
      // A bigger sweep is symmetric, so only pointed damage scales cleanly.
      return op.to === 'target' || op.to === 'opponent' ? 'n' : null;
    case 'gainLife':
    case 'draw':
    case 'foresee':
    case 'addCounters':
    case 'extraLandDrop':
      return 'n';
    case 'loseLife':
    case 'discardRandom':
      return o.who === 'opponent' ? 'n' : null;
    case 'severGrave':
    case 'severTop':
    case 'grind':
      return o.who === 'opponent' ? 'n' : null;
    case 'createToken':
      return 'count';
    case 'boost':
      // Only one-sided buffs scale cleanly; `all` and `theirMarked` do not.
      return op.scope === 'target' || op.scope === 'allYours' || op.scope === 'yourMarked' ? 'BOOST' : null;
    default:
      return null;
  }
}

/** true when `a` does everything `b` does, at least as much of it. */
function opNoWorse(a: EffectOp, b: EffectOp): boolean {
  if (a.op !== b.op) return false;
  const field = scalableField(b);
  if (field === null) return j(a) === j(b);
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const skip = field === 'BOOST' ? ['p', 't'] : [field];
  // every non-scalable field identical
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (skip.includes(k)) continue;
    if (j(ao[k]) !== j(bo[k])) return false;
  }
  if (field === 'BOOST') {
    const ap = (ao.p as number) ?? 0;
    const at = (ao.t as number) ?? 0;
    const bp = (bo.p as number) ?? 0;
    const bt = (bo.t as number) ?? 0;
    // A pump wants bigger numbers; a shrink (negative boost, i.e. removal)
    // wants MORE negative ones. A sign-mixed pair is not comparable at all.
    const pump = ap >= 0 && at >= 0 && bp >= 0 && bt >= 0;
    const shrink = ap <= 0 && at <= 0 && bp <= 0 && bt <= 0;
    if (pump) return ap >= bp && at >= bt;
    if (shrink) return ap <= bp && at <= bt;
    return ap === bp && at === bt;
  }
  const an = ao[field];
  const bn = bo[field];
  if (typeof an !== 'number' || typeof bn !== 'number') return j(an) === j(bn);
  return an >= bn;
}
const opStrictlyBetter = (a: EffectOp, b: EffectOp) => opNoWorse(a, b) && j(a) !== j(b);

/**
 * Is a *spare* op — one A has and B does not — unambiguously good for the
 * caster? Self-mill, symmetric sweeps and self-damage are costs or tradeoffs,
 * so a card carrying one extra is NOT thereby the better card. Anything not
 * proven to be upside blocks the domination claim rather than inflating it.
 */
export function isUpside(op: EffectOp): boolean {
  const o = op as Record<string, unknown>;
  switch (op.op) {
    case 'damage':
      return op.to === 'target' || op.to === 'opponent'; // eachCreature is symmetric
    case 'grind':
    case 'severGrave':
      return o.who === 'opponent';
    case 'severTop': // self only by construction — self-sever is a cost
    case 'severSelf':
    case 'massDestroy': // symmetric
    case 'preventCombat': // symmetric
      return false;
    case 'boost':
      return op.scope === 'target' || op.scope === 'allYours' || op.scope === 'yourMarked';
    case 'ifTargetMarked':
      return !op.else && (op.then ?? []).every(isUpside);
    case 'gainLife':
    case 'draw':
    case 'foresee':
    case 'addCounters':
    case 'extraLandDrop':
    case 'fetchLand':
    case 'reclaim':
    case 'raise':
    case 'awaken':
    case 'propagate':
    case 'markAll':
    case 'moveMark':
    case 'removeMarks':
    case 'loseLife':
    case 'discardRandom':
    case 'createToken':
    case 'destroy':
    case 'sever':
    case 'recall':
    case 'destroyArtifactOrSeverEnchantment':
    case 'destroyNewestOpponentArtifactOrEnchantment':
    case 'cancel':
    case 'tap':
    case 'loseLifePerTheirMarked':
      return true;
    default:
      return false;
  }
}

/** Trigger/target identity of an ability — the "slot" its ops live in. */
const slotKey = (a: AbilityDef) =>
  j({ when: a.when, condition: a.condition ?? null, targets: a.targets ?? null, static: a.static ?? null });

interface Cmp {
  noWorse: boolean;
  better: boolean;
  notes: string[];
}

/**
 * Greedy multiset cover: every op in `b` must be answered by a distinct op in
 * `a` that is no worse. Greedy is exact here because our ops are shallow and an
 * op that answers two different requirements is always an exact match for both.
 */
export function opsCover(aOps: EffectOp[], bOps: EffectOp[]): Cmp | null {
  const pool = aOps.map((o, i) => ({ o, i, used: false }));
  const notes: string[] = [];
  let better = false;
  for (const need of bOps) {
    const exact = pool.find((p) => !p.used && j(p.o) === j(need));
    if (exact) {
      exact.used = true;
      continue;
    }
    const up = pool.find((p) => !p.used && opStrictlyBetter(p.o, need));
    if (!up) return null;
    up.used = true;
    better = true;
    notes.push(`${describeOp(up.o)} beats ${describeOp(need)}`);
  }
  const spare = pool.filter((p) => !p.used);
  if (spare.length) {
    if (!spare.every((p) => isUpside(p.o))) return null; // extra cost/tradeoff, not an upgrade
    better = true;
    notes.push(`also ${spare.map((p) => describeOp(p.o)).join(', ')}`);
  }
  return { noWorse: true, better, notes };
}

export function describeOp(o: EffectOp): string {
  const r = o as Record<string, unknown>;
  const bits = Object.entries(r)
    .filter(([k]) => k !== 'op')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return bits.length ? `${o.op}(${bits.join(',')})` : o.op;
}

/**
 * Whole-card domination. Returns null unless A is no worse than B on every
 * comparable axis and strictly better on at least one.
 */
export function dominates(a: CardDef, b: CardDef): Cmp | null {
  if (a.id === b.id) return null;
  if (j([...a.types].sort()) !== j([...b.types].sort())) return null;
  if (!costNoWorse(a.cost, b.cost)) return null;

  const notes: string[] = [];
  let better = false;

  if (costStrictlyBetter(a.cost, b.cost)) {
    better = true;
    notes.push(`cheaper ${costStr(a.cost)} vs ${costStr(b.cost)}`);
  }

  // stats
  const ap = a.attack ?? 0;
  const ad = a.defense ?? 0;
  const bp = b.attack ?? 0;
  const bd = b.defense ?? 0;
  if (a.types.includes('creature')) {
    if (ap < bp || ad < bd) return null;
    if (ap > bp || ad > bd) {
      better = true;
      notes.push(`stats ${ap}/${ad} vs ${bp}/${bd}`);
    }
  } else if (ap !== bp || ad !== bd) return null;

  // Keywords. Rage (must attack) and Bulwark (cannot attack) are DRAWBACKS, so
  // carrying one extra does not make a card better — it makes the two cards
  // incomparable. Every other keyword is upside.
  const DRAWBACK_KW = new Set<string>(['rage', 'bulwark']);
  const ak = new Set(a.keywords ?? []);
  const bk = new Set(b.keywords ?? []);
  for (const k of bk) if (!ak.has(k)) return null;
  const extraK = [...ak].filter((k) => !bk.has(k));
  if (extraK.some((k) => DRAWBACK_KW.has(k))) return null;
  if (extraK.length) {
    better = true;
    notes.push(`also ${extraK.join(', ')}`);
  }

  // abilities, matched slot by slot
  const aBy = new Map<string, AbilityDef[]>();
  for (const ab of a.abilities ?? []) {
    const k = slotKey(ab);
    (aBy.get(k) ?? aBy.set(k, []).get(k)!).push(ab);
  }
  const usedSlot = new Set<AbilityDef>();
  for (const ab of b.abilities ?? []) {
    const cands = (aBy.get(slotKey(ab)) ?? []).filter((c) => !usedSlot.has(c));
    let matched = false;
    for (const c of cands) {
      const cov = opsCover(c.ops ?? [], ab.ops ?? []);
      if (!cov) continue;
      usedSlot.add(c);
      matched = true;
      if (cov.better) {
        better = true;
        notes.push(...cov.notes);
      }
      break;
    }
    if (!matched) return null;
  }
  const spareAb = (a.abilities ?? []).filter((x) => !usedSlot.has(x));
  if (spareAb.length) {
    // An extra ability only counts as an upgrade if everything it does is upside.
    if (!spareAb.every((x) => !x.static && (x.ops ?? []).length > 0 && (x.ops ?? []).every(isUpside))) return null;
    better = true;
    notes.push(`extra ability: ${spareAb.map((x) => `${x.when}[${(x.ops ?? []).map(describeOp).join('; ')}]`).join(' | ')}`);
  }

  // riders: upside for A must be a superset; downside must not be worse
  const riders: [string, unknown, unknown][] = [
    ['chapters', a.chapters, b.chapters],
    ['awakening', a.awakening, b.awakening],
    ['nineLives', a.nineLives, b.nineLives],
    ['manaAbility', a.manaAbility, b.manaAbility],
    ['x', a.x, b.x],
    ['tithe', a.tithe, b.tithe],
  ];
  for (const [name, av, bv] of riders) {
    if (j(av ?? null) === j(bv ?? null)) continue;
    if (bv != null) return null; // B has a rider A lacks (or differs) — not dominated
    better = true;
    notes.push(`has ${name}`);
  }
  // Priced riders are optional to use, so the same rider for less is upside.
  const priced: [string, { cost: ManaCost } | undefined, { cost: ManaCost } | undefined][] = [
    ['Empower', a.empower, b.empower],
    ['Skim', a.skim, b.skim],
    ['Retell', a.retell, b.retell],
    ['Whispers', a.whispers, b.whispers],
    ['Preserve', a.preserve, b.preserve],
    ['Hauntlink', a.hauntlink, b.hauntlink],
  ];
  for (const [name, av, bv] of priced) {
    if (!bv) {
      if (av) {
        better = true;
        notes.push(`has ${name}`);
      }
      continue;
    }
    if (!av || j({ ...av, cost: null }) !== j({ ...bv, cost: null }) || !costNoWorse(av.cost, bv.cost)) return null;
    if (costStrictlyBetter(av.cost, bv.cost)) {
      better = true;
      notes.push(`cheaper ${name} ${costStr(av.cost)} vs ${costStr(bv.cost)}`);
    }
  }
  const duty = dutiesCover(activatedAbilitiesOf(a), activatedAbilitiesOf(b));
  if (!duty) return null;
  if (duty.better) {
    better = true;
    notes.push(...duty.notes);
  }
  // A field this pass does not know how to rank has to match exactly; it may
  // be a drawback, and this audit refuses to guess.
  const unranked = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => !RANKED.has(f) && !PRESENTATION.has(f));
  if (unranked.length) {
    const af = bodyFields(a, NO_TYPAL, 'keep');
    const bf = bodyFields(b, NO_TYPAL, 'keep');
    if (unranked.some((f) => j(af[f] ?? null) !== j(bf[f] ?? null))) return null;
  }
  // downside riders
  if ((a.rite?.n ?? 0) > (b.rite?.n ?? 0)) return null;
  if ((a.rite?.n ?? 0) < (b.rite?.n ?? 0)) {
    better = true;
    notes.push('no Rite cost');
  }
  if (!!a.entersTapped && !b.entersTapped) return null;
  if (!a.entersTapped && !!b.entersTapped) {
    better = true;
    notes.push('enters untapped');
  }

  if (!better) return null;
  return { noWorse: true, better, notes };
}

/**
 * Fields `dominates` ranks itself. Subtypes and supertypes are left to the
 * report: a typal payoff or the legend rule is printed on every row, and the
 * cut list marks TYPAL.
 */
const RANKED: ReadonlySet<string> = new Set([
  'cost', 'colors', 'types', 'subtypes', 'supertypes', 'attack', 'defense', 'keywords', 'abilities',
  'chapters', 'awakening', 'nineLives', 'manaAbility', 'x', 'tithe',
  'empower', 'skim', 'retell', 'whispers', 'preserve', 'hauntlink', 'activated', 'rite', 'entersTapped',
]);
const ZERO: ManaCost = { generic: 0, pips: {} };

/**
 * Duty-by-Duty cover, the way abilities are matched slot by slot: every Duty B
 * has must be answered by a distinct Duty of A's with the same targets, ops no
 * worse, and activation mana no dearer. Using a Duty is optional, so a spare
 * one on A is upside whatever it does.
 */
export function dutiesCover(aDuties: readonly ActivatedDef[], bDuties: readonly ActivatedDef[]): Cmp | null {
  const used = new Set<ActivatedDef>();
  const notes: string[] = [];
  let better = false;
  for (const need of bDuties) {
    let matched = false;
    // An exact twin first, so a better Duty is not spent on a need a plain copy answers.
    const exactFirst = [...aDuties].sort((x, y) => Number(j(y) === j(need)) - Number(j(x) === j(need)));
    for (const c of exactFirst) {
      if (used.has(c) || j(c.targets ?? null) !== j(need.targets ?? null)) continue;
      const cm = c.cost.mana ?? ZERO;
      const nm = need.cost.mana ?? ZERO;
      if (!costNoWorse(cm, nm)) continue;
      const cov = opsCover(c.ops, need.ops);
      if (!cov) continue;
      used.add(c);
      matched = true;
      if (costStrictlyBetter(cm, nm)) {
        better = true;
        notes.push(`cheaper Duty ${dutyCost(c)} vs ${dutyCost(need)}`);
      }
      if (cov.better) {
        better = true;
        notes.push(...cov.notes.map((n) => `Duty ${n}`));
      }
      break;
    }
    if (!matched) return null;
  }
  const spare = aDuties.filter((c) => !used.has(c));
  if (spare.length) {
    better = true;
    notes.push(`extra Duty: ${spare.map((c) => `${dutyCost(c)} ${c.ops.map(describeOp).join('; ')}`).join(' | ')}`);
  }
  return { noWorse: true, better, notes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const cards = ALL_CARDS.filter((c) => !c.token && !c.supertypes?.includes('basic'));
const lands = (d: CardDef) => d.types.includes('land');
const nonLand = cards.filter((d) => !lands(d));

/**
 * The legend rule is per-name and per-player, so `legendary` is a real
 * drawback: a second copy on the battlefield dies. Subtypes carry the typal
 * payoffs. Both are printed on every row so a "dead card" call can be checked.
 */
const label = (d: CardDef) => {
  const leg = d.supertypes?.includes('legendary') ? ' LEGENDARY' : '';
  const sub = d.subtypes.length ? ` [${d.subtypes.join(' ')}]` : '';
  return `${d.name.padEnd(30)} ${costStr(d.cost).padEnd(10)} ${d.rarity.padEnd(3)} ${(d.set ?? 'base').slice(0, 10).padEnd(10)}${leg}${sub}`;
};

/** Subtypes that some card in the pool actually pays off. */
const TYPAL = POOL_TYPAL;

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 2. Identical / redeskin clusters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups `pool` by shape (every cost stripped), then by full key. IDENTICAL is
 * a full-key group; REDESKIN is a shape group holding more than one full key,
 * that is, the same card at more than one price or colour. SAME TEXT is a group
 * that only a paid-off tribe or the legend rule splits into several shapes.
 *
 * Auditing a set that is not in the catalog yet: pass
 * `typalSubtypes([...ALL_CARDS, ...candidates])` as `typal` (and to `bodyKey`,
 * `shapeKey` and `fullKey`), or the candidates' own lords are not counted.
 */
export function clusters(pool: readonly CardDef[], typal: ReadonlySet<string> = POOL_TYPAL) {
  const byShape = new Map<string, CardDef[]>();
  for (const d of pool) {
    const k = shapeKey(d, typal);
    (byShape.get(k) ?? byShape.set(k, []).get(k)!).push(d);
  }
  const identical: CardDef[][] = [];
  const redeskin: CardDef[][] = [];
  for (const group of byShape.values()) {
    if (group.length < 2) continue;
    const byFull = new Map<string, CardDef[]>();
    for (const d of group) {
      const k = fullKey(d, typal);
      (byFull.get(k) ?? byFull.set(k, []).get(k)!).push(d);
    }
    for (const g of byFull.values()) if (g.length > 1) identical.push(g);
    if (byFull.size > 1) redeskin.push(group);
  }
  // The same rules text where a paid-off tribe or the legend rule tells the
  // printings apart, at any price. Not duplicates (one printing per tribe is
  // fine), but the review that rules on which sameness is acceptable needs them.
  const byText = new Map<string, CardDef[]>();
  for (const d of pool) {
    const k = shapeKey({ ...d, supertypes: undefined }, NO_TYPAL);
    (byText.get(k) ?? byText.set(k, []).get(k)!).push(d);
  }
  const sameText = [...byText.values()].filter((g) => new Set(g.map((d) => shapeKey(d, typal))).size > 1);
  return { identical, redeskin, sameText };
}

function printClusters() {
  const { identical, redeskin, sameText } = clusters(nonLand);
  console.log(`\n══ IDENTICAL — same body, same cost, same colours (${identical.length} clusters) ══`);
  identical
    .sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name))
    .forEach((g) => {
      console.log(`\n  ${g.length}x  ${costStr(g[0].cost)}  ${g[0].types.join('/')}`);
      console.log(`      ${textOf(g[0])}`);
      for (const d of g) console.log(`      · ${label(d)}`);
    });

  console.log(`\n\n══ SAME TEXT — the same rules text told apart by a paid-off tribe or the legend rule, at any cost (${sameText.length} clusters) ══`);
  console.log('  A paid-off tribe or the per-name legend rule splits each group; printings that also');
  console.log('  match on both are the ones IDENTICAL and REDESKIN list.');
  sameText
    .sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name))
    .forEach((g) => {
      console.log(`\n  ${g.length}x  ${g[0].types.join('/')}  —  ${textOf(g[0])}`);
      for (const d of g.sort((x, y) => manaValue(x.cost ?? ZERO) - manaValue(y.cost ?? ZERO))) {
        const paid = d.subtypes.filter((s) => TYPAL.has(s));
        const riders = riderCosts(d);
        console.log(`      · ${label(d)} [${d.colors.join('') || 'C'}]${riders ? `  ${riders}` : ''}${paid.length ? `  tribe: ${paid.join(' ')}` : ''}`);
      }
    });

  console.log(`\n\n══ REDESKIN — same body, DIFFERENT cost (printed, rider or Duty) or colour (${redeskin.length} clusters) ══`);
  redeskin
    .sort((a, b) => a[0].name.localeCompare(b[0].name))
    .forEach((g) => {
      console.log(`\n  ${g[0].types.join('/')}  —  ${textOf(g[0])}`);
      for (const d of g.sort((x, y) => manaValue(x.cost ?? { generic: 0, pips: {} }) - manaValue(y.cost ?? { generic: 0, pips: {} }))) {
        const riders = riderCosts(d);
        console.log(`      · ${label(d)} [${d.colors.join('') || 'C'}]${riders ? `  ${riders}` : ''}`);
      }
    });
}

function textOf(d: CardDef): string {
  const parts: string[] = [];
  if (d.types.includes('creature')) parts.push(`${d.attack}/${d.defense}`);
  if (d.keywords?.length) parts.push(d.keywords.join(', '));
  for (const a of d.abilities ?? []) {
    if (a.static) parts.push(`static ${j(a.static)}`);
    else parts.push(`${a.when}: ${(a.ops ?? []).map(describeOp).join('; ')}`);
  }
  for (const a of activatedAbilitiesOf(d))
    parts.push(`Duty ${dutyCost(a)}${a.targets ? ` ${j(a.targets)}` : ''}: ${a.ops.map(describeOp).join('; ')}`);
  if (d.empower) parts.push(`Empower ${costStr(d.empower.cost)}: ${(d.empower.ops ?? []).map(describeOp).join('; ')}`);
  if (d.skim) parts.push(`Skim ${costStr(d.skim.cost)}`);
  if (d.retell) parts.push(`Retell ${costStr(d.retell.cost)}`);
  if (d.whispers) parts.push(`Whispers ${costStr(d.whispers.cost)}`);
  if (d.tithe) parts.push('Tithe');
  if (d.preserve) parts.push(`Preserve ${costStr(d.preserve.cost)}`);
  if (d.hauntlink) parts.push(`Hauntlink ${costStr(d.hauntlink.cost)} ${j(d.hauntlink.linked)}`);
  if (d.nineLives) parts.push('Nine Lives');
  if (d.rite) parts.push(`Rite ${d.rite.n}`);
  if (d.awakening) parts.push(`Awaken ${j(d.awakening)}`);
  if (d.chapters) parts.push(`Quest ${d.chapters.length} ch`);
  return parts.join(' | ') || '(vanilla)';
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Domination
// ─────────────────────────────────────────────────────────────────────────────

function printDominated() {
  const rows: { a: CardDef; b: CardDef; cmp: Cmp }[] = [];
  for (const a of nonLand)
    for (const b of nonLand) {
      const cmp = dominates(a, b);
      if (cmp) rows.push({ a, b, cmp });
    }
  // Drop pairs that are mutual (identical bodies caught by the cluster pass).
  const out = rows.filter((r) => !rows.some((s) => s.a.id === r.b.id && s.b.id === r.a.id));

  const creature = out.filter((r) => r.a.types.includes('creature'));
  const spell = out.filter((r) => !r.a.types.includes('creature'));

  console.log(`\n══ DOMINATED — non-creature (${spell.length}) ══`);
  console.log('  A is at least as good on every op and strictly better somewhere, for <= the cost.\n');
  for (const r of spell.sort((x, y) => x.b.name.localeCompare(y.b.name)))
    console.log(`  ${label(r.a)}\n    dominates ${label(r.b)}\n      ${r.cmp.notes.join(' · ')}`);

  console.log(`\n\n══ DOMINATED — creature (${creature.length}) ══`);
  console.log('  Subtypes printed: a typal payoff can rescue a dominated body.\n');
  for (const r of creature.sort((x, y) => x.b.name.localeCompare(y.b.name)))
    console.log(
      `  ${label(r.a)} [${r.a.subtypes.join(' ') || '-'}]\n    dominates ${label(r.b)} [${r.b.subtypes.join(' ') || '-'}]\n      ${r.cmp.notes.join(' · ')}`,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Odd cards
// ─────────────────────────────────────────────────────────────────────────────

function printOdd() {
  console.log('\n══ ODD — internal inconsistencies ══\n');
  const say = (tag: string, d: CardDef, why: string) => console.log(`  [${tag}] ${label(d)}  ${why}`);

  // The sanctioned over-cap Empower cards, per tests/data/empowerCeiling.test.ts.
  const TOP_OF_CURVE = new Set(['Silt-Fat Behemoth']);
  const ATTACK_KEYWORDS = ['warcry', 'firstBlade', 'twinBlades', 'overrun', 'deathblade', 'rage'] as const;

  for (const d of cards) {
    const mv = d.cost ? manaValue(d.cost) : 0;
    const kw = new Set<string>(d.keywords ?? []);

    // Empower is the only additive cost; printed + Empower must stay <= 9.
    if (d.empower && d.cost && mv + manaValue(d.empower.cost) > 9 && !TOP_OF_CURVE.has(d.name))
      say('EMPOWER-CAP', d, `printed ${costStr(d.cost)} + Empower ${costStr(d.empower.cost)} = ${mv + manaValue(d.empower.cost)} > 9`);

    // Skim is the cheap bail-out; pricing it at or above the card defeats it.
    if (d.skim && d.cost && manaValue(d.skim.cost) >= mv && mv > 0)
      say('SKIM>=CAST', d, `Skim ${costStr(d.skim.cost)} vs cast ${costStr(d.cost)}`);

    // Bulwark is the keyword that CANNOT ATTACK (Sentinel is vigilance), so on a
    // Bulwark body every attack-only keyword and attack trigger is dead text.
    if (kw.has('bulwark')) {
      const dead = ATTACK_KEYWORDS.filter((k) => kw.has(k));
      if (dead.length) say('DEAD-KEYWORD', d, `Bulwark (cannot attack) also has ${dead.join(', ')}`);
      if ((d.abilities ?? []).some((a) => a.when === 'attacks' || a.when === 'combatDamageToPlayer'))
        say('DEAD-TRIGGER', d, 'attack/damage trigger on a Bulwark (cannot attack) body');
      if (kw.has('rage')) say('CONTRADICTION', d, 'Bulwark (cannot attack) + Rage (must attack)');
      if (kw.has('sentinel')) say('DEAD-KEYWORD', d, 'Bulwark (cannot attack) + Sentinel (attacking does not tap)');
    }

    // A 0-attack creature gets nothing from attack-shaped keywords.
    if (d.types.includes('creature') && (d.attack ?? 0) === 0) {
      const dead = ATTACK_KEYWORDS.filter((k) => kw.has(k));
      if (dead.length) say('DEAD-KEYWORD', d, `0 attack but has ${dead.join(', ')}`);
    }


    // statics that grant nothing
    for (const a of d.abilities ?? [])
      if (a.static && !a.static.p && !a.static.t && !a.static.grantKeywords?.length)
        say('EMPTY-STATIC', d, `static grants nothing: ${j(a.static)}`);

    // abilities with no ops and no static
    for (const a of d.abilities ?? [])
      if (!a.static && !(a.ops ?? []).length) say('EMPTY-ABILITY', d, `${a.when} does nothing`);

    // zero-value numeric ops, wherever ops live: abilities, Duties, riders, chapters
    const opLists: EffectOp[][] = [
      ...(d.abilities ?? []).map((a) => a.ops ?? []),
      ...activatedAbilitiesOf(d).map((a) => a.ops),
      d.empower?.ops ?? [],
      d.retell?.ops ?? [],
      ...(d.chapters ?? []),
    ];
    for (const ops of opLists)
      for (const o of ops) {
        const r = o as Record<string, unknown>;
        for (const k of ['n', 'count'])
          if (typeof r[k] === 'number' && r[k] === 0) say('ZERO-OP', d, `${describeOp(o)}`);
        if (o.op === 'boost' && !o.p && !o.t && !o.keywords?.length) say('ZERO-OP', d, describeOp(o));
      }

    // creature with 0 defense = dies on arrival
    if (d.types.includes('creature') && (d.defense ?? 0) <= 0 && !d.awakening)
      say('ZERO-DEFENSE', d, `${d.attack}/${d.defense}`);

    // vanilla non-land, non-creature = does nothing at all
    if (
      !d.types.includes('creature') &&
      !lands(d) &&
      !(d.abilities ?? []).length &&
      !d.chapters &&
      !d.empower &&
      !d.manaAbility &&
      !d.hauntlink &&
      !activatedAbilitiesOf(d).length
    )
      say('BLANK', d, 'no abilities, no chapters, no Empower, no Duty');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Focused passes — the three findings that need no judgement call.
// ─────────────────────────────────────────────────────────────────────────────

/** Same body, same colours, different cost: the pricier printing is dead. */
function printWorseTwins() {
  console.log('\n\n══ STRICTLY-WORSE TWIN — same body + same colours, higher cost ══');
  console.log('  Nothing distinguishes these but the price. The dearer card is unplayable.\n');
  const by = new Map<string, CardDef[]>();
  for (const d of nonLand) {
    const k = `${bodyKey(d)}|${[...d.colors].sort().join('')}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(d);
  }
  const hardRows: { best: CardDef; dead: CardDef }[] = [];
  const softRows: { best: CardDef; dead: CardDef }[] = [];
  for (const g of [...by.values()]) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => manaValue(a.cost ?? { generic: 0, pips: {} }) - manaValue(b.cost ?? { generic: 0, pips: {} }));
    const best = sorted[0];
    const worse = sorted.filter((d) => d !== best && costStrictlyBetter(best.cost, d.cost));
    if (!worse.length) continue;
    for (const d of worse) {
      // The body key already holds every paid-off tribe and the legendary
      // supertype, so a twin shares both. Two legendary twins are still soft:
      // the legend rule is per name, so a deck can field one of each at once.
      const bothLegendary = best.supertypes?.includes('legendary') ?? false;
      (bothLegendary ? softRows : hardRows).push({ best, dead: d });
    }
  }
  const show = (title: string, why: string, rows: { best: CardDef; dead: CardDef }[]) => {
    console.log(`
  ── ${title} (${rows.length}) ──`);
    console.log(`  ${why}
`);
    let last = '';
    for (const r of rows) {
      const head = `${textOf(r.best)}   [${r.best.colors.join('') || 'C'}]`;
      if (head !== last) {
        console.log(`  ${head}`);
        console.log(`      BEST  ${label(r.best)}`);
        last = head;
      }
      console.log(`      dead  ${label(r.dead)}`);
    }
  };
  show('HARD — nothing differentiates them', 'Same paid-off tribes, and neither card is legendary.', hardRows);
  show('SOFT — the legend rule may rescue it', 'Both cards are legendary, so a deck can field one of each at once.', softRows);
  console.log(`
  ${hardRows.length + softRows.length} dearer printing(s): ${hardRows.length} hard, ${softRows.length} soft.`);
}

/**
 * A Charm that does everything a Ritual does, for no more mana, leaves the
 * Ritual dead: the Charm can also be held up. Compares the FULL card, riders
 * and Duties included, not just the spell's ops, so a Ritual carrying Skim or
 * Retell is not beaten by a bare Charm, and a Charm with an extra Whispers
 * still beats a bare Ritual. Returns why, or null.
 */
export function charmOutclasses(charm: CardDef, ritual: CardDef, typal: ReadonlySet<string> = POOL_TYPAL): string | null {
  if (!charm.types.includes('charm') || !ritual.types.includes('ritual')) return null;
  const asRitual: CardDef = { ...charm, types: charm.types.map((t) => (t === 'charm' ? 'ritual' : t)) };
  if (fullKey(asRitual, typal) === fullKey(ritual, typal)) return 'identical';
  const cmp = dominates(asRitual, ritual);
  return cmp ? cmp.notes.join(' · ') : null;
}

function printSpeedInversions() {
  console.log('\n══ SPEED — a Charm (instant) does everything a Ritual (sorcery) does, for no more ══');
  console.log('  The Charm can also be held up. The Ritual is dead.\n');
  const charms = nonLand.filter((d) => d.types.includes('charm'));
  let n = 0;
  for (const r of nonLand) {
    if (!r.types.includes('ritual')) continue;
    const beaters = charms.map((c) => ({ c, why: charmOutclasses(c, r) })).filter((x) => x.why !== null);
    if (!beaters.length) continue;
    n++;
    console.log(`  ${textOf(r)}   ${costStr(r.cost)}`);
    for (const { c, why } of beaters) console.log(`      Charm   ${label(c)}  ${why}`);
    console.log(`      Ritual  ${label(r)}  <- dead\n`);
  }
  console.log(`  ${n} Ritual(s) outclassed by a Charm.`);
}

/** Functionally identical cards printed at different rarities. */
function printRaritySplits() {
  console.log('\n══ RARITY SPLIT — the same card is a common here and a rare there ══');
  console.log('  Same body, same cost, same colours. Pack odds and draft treat them differently.\n');
  const by = new Map<string, CardDef[]>();
  for (const d of nonLand) (by.get(fullKey(d)) ?? by.set(fullKey(d), []).get(fullKey(d))!).push(d);
  const order = ['c', 'r', 'sr', 'ssr', 'ur'];
  let n = 0;
  for (const g of by.values()) {
    if (g.length < 2) continue;
    const rar = new Set(g.map((d) => d.rarity));
    if (rar.size < 2) continue;
    n++;
    const spread = [...rar].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    console.log(`  ${spread.join(' / ')}   ${textOf(g[0])}   ${costStr(g[0].cost)}`);
    for (const d of [...g].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity)))
      console.log(`      ${label(d)}`);
    console.log('');
  }
  console.log(`  ${n} cluster(s) split across rarities.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. The cut list — every card beaten by something else, worst first.
// ─────────────────────────────────────────────────────────────────────────────

function printCutList() {
  console.log('\n\n══ CUT LIST — cards nothing would ever be played over ══');
  console.log('  A card is listed once, with the number of distinct cards that beat it and the');
  console.log('  single best beater. Creatures whose subtype has a typal payoff the beater lacks');
  console.log('  are marked TYPAL: a tribal deck can still want them.\n');
  const beaters = new Map<string, CardDef[]>();
  for (const a of nonLand)
    for (const b of nonLand) if (dominates(a, b)) (beaters.get(b.id) ?? beaters.set(b.id, []).get(b.id)!).push(a);

  // A Charm that does everything a Ritual does, for no more, beats it on speed.
  const charms = nonLand.filter((d) => d.types.includes('charm'));
  for (const d of nonLand) {
    if (!d.types.includes('ritual')) continue;
    for (const c of charms) if (charmOutclasses(c, d)) (beaters.get(d.id) ?? beaters.set(d.id, []).get(d.id)!).push(c);
  }

  const rows = [...beaters.entries()]
    .map(([id, bs]) => {
      const card = nonLand.find((d) => d.id === id)!;
      const uniq = [...new Map(bs.map((b) => [b.id, b])).values()];
      const typal = card.subtypes.some((t) => TYPAL.has(t) && !uniq.every((b) => b.subtypes.includes(t)));
      return { card, uniq, typal };
    })
    .sort((a, b) => b.uniq.length - a.uniq.length || a.card.name.localeCompare(b.card.name));

  const hard = rows.filter((r) => !r.typal);
  console.log(`  ${rows.length} beaten card(s): ${hard.length} with no typal defence, ${rows.length - hard.length} TYPAL.\n`);
  console.log('  beaten by  card                                                        best beater');
  console.log('  ────────── ─────────────────────────────────────────────────────────── ───────────────────────────────');
  for (const r of hard.slice(0, 60)) {
    const best = [...r.uniq].sort((a, b) => manaValue(a.cost ?? { generic: 0, pips: {} }) - manaValue(b.cost ?? { generic: 0, pips: {} }))[0];
    console.log(
      `  ${String(r.uniq.length).padStart(4)}       ${(`${r.card.name} ${costStr(r.card.cost)} ${r.card.rarity}`).padEnd(63)} ${best.name} ${costStr(best.cost)} ${best.rarity}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Cards audited: ${cards.length} collectible (${nonLand.length} non-land)`);
  if (MODE === 'all' || MODE === 'identical' || MODE === 'redeskin') printClusters();
  if (MODE === 'all' || MODE === 'dominated') printDominated();
  if (MODE === 'all' || MODE === 'odd') printOdd();
  if (MODE === 'all' || MODE === 'focus') {
    printWorseTwins();
    printSpeedInversions();
    printRaritySplits();
  }
  if (MODE === 'all' || MODE === 'cut') printCutList();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (!AS_LIBRARY && invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
