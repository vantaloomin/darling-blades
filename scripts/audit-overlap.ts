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
 *   5. LADDER     — the same card data at different stat lines, rider
 *                   prices or effect sizes (a 2/2, 3/3, 4/4 up the curve;
 *                   Skim {2} against Skim {1}; Foresee 1 against Foresee 3),
 *                   per set and across sets, with any rung that dominates
 *                   another. It keeps an effect's sign (-2/-2 is not +2/+2)
 *                   and op order, except within runs of ops whose order never
 *                   matters (mill, discard, life loss and gain); two texts
 *                   that say the same thing through different ops key apart.
 *
 *   npx tsx scripts/audit-overlap.ts [identical|redeskin|ladder|dominated|odd|focus|cut|all]
 *
 * Importing this file runs nothing; the passes print only when it is the
 * script tsx was asked to run.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../src/data/catalog';
import type { AbilityDef, ActivatedDef, CardDef, Color, EffectOp, ManaCost, TargetSpec } from '../src/engine/types';
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
const PRESENTATION: ReadonlySet<string> = new Set(['id', 'name', 'displayTypeLine', 'rarity', 'artRef', 'set', 'token']);
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
    case 'hunt': // a trade: the hunter takes the prey's Attack and can die
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

/**
 * Trigger identity of an ability, the "slot" its ops live in. Targets are
 * compared separately by `targetsCover`, since a looser cap is an upgrade.
 */
const slotKey = (a: AbilityDef) => j({ when: a.when, condition: a.condition ?? null, static: a.static ?? null });

interface Cmp {
  noWorse: boolean;
  better: boolean;
  notes: string[];
}

/**
 * True-or-better target lists: the same specs in the same order, except that
 * A's caps may be looser than B's. The caster chooses targets, so a bigger
 * `maxCost` (or none) and a smaller `minAttack` (or none) only widen the
 * choice: "cost 3 or less" is no worse than "cost 2 or less". Returns null when
 * any other target field differs or A's cap is tighter.
 */
export function targetsCover(aTargets?: readonly TargetSpec[], bTargets?: readonly TargetSpec[]): Cmp | null {
  const aa = aTargets ?? [];
  const bb = bTargets ?? [];
  if (aa.length !== bb.length) return null;
  const notes: string[] = [];
  let better = false;
  for (let i = 0; i < aa.length; i++) {
    const x = aa[i];
    const y = bb[i];
    if (j({ ...x, maxCost: undefined, minAttack: undefined }) !== j({ ...y, maxCost: undefined, minAttack: undefined })) return null;
    if (x.maxCost !== y.maxCost) {
      if (x.maxCost !== undefined && (y.maxCost === undefined || x.maxCost < y.maxCost)) return null;
      better = true;
      notes.push(`targets cost ${x.maxCost ?? 'any'} or less vs ${y.maxCost}`);
    }
    if (x.minAttack !== y.minAttack) {
      if (x.minAttack !== undefined && (y.minAttack === undefined || x.minAttack > y.minAttack)) return null;
      better = true;
      notes.push(`targets attack ${x.minAttack ?? 'any'} or more vs ${y.minAttack}`);
    }
  }
  return { noWorse: true, better, notes };
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
    // Exact targets first, so a looser-capped ability is not spent on a need a plain twin answers.
    const cands = (aBy.get(slotKey(ab)) ?? [])
      .filter((c) => !usedSlot.has(c))
      .sort((x, y) => Number(j(y.targets ?? null) === j(ab.targets ?? null)) - Number(j(x.targets ?? null) === j(ab.targets ?? null)));
    let matched = false;
    for (const c of cands) {
      const tgt = targetsCover(c.targets, ab.targets);
      if (!tgt) continue;
      const cov = opsCover(c.ops ?? [], ab.ops ?? []);
      if (!cov) continue;
      usedSlot.add(c);
      matched = true;
      if (cov.better || tgt.better) {
        better = true;
        notes.push(...tgt.notes, ...cov.notes);
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
      if (used.has(c)) continue;
      const tgt = targetsCover(c.targets, need.targets);
      if (!tgt) continue;
      const cm = c.cost.mana ?? ZERO;
      const nm = need.cost.mana ?? ZERO;
      if (!costNoWorse(cm, nm)) continue;
      const cov = opsCover(c.ops, need.ops);
      if (!cov) continue;
      if (tgt.better) {
        better = true;
        notes.push(...tgt.notes.map((n) => `Duty ${n}`));
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// 1b. Stat ladders: the same rules text at different stats, rider prices or effect sizes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What varies across a ladder group: the stat line, the printed cost, the
 * colours, a rider's or Duty's price, or a number inside an effect (Foresee 1
 * against Foresee 3, a +1/+3 boost against +3/+3, cost 2 or less against 3).
 */
export type LadderAxis = 'stats' | 'cost' | 'colours' | 'rider' | 'effect';

/** A card's tribe and legendary identity: its paid-off subtypes and whether it is legendary (any two legendaries share it). */
export function identityOf(d: CardDef, typal: ReadonlySet<string> = POOL_TYPAL): string {
  const tribes = d.subtypes.filter((s) => typal.has(s)).sort();
  return `${tribes.join(' ') || '-'}${d.supertypes?.includes('legendary') ? ' LEGENDARY' : ''}`;
}

/** Two cards of one ladder group, and what tells them apart. */
export interface LadderPair {
  a: CardDef;
  b: CardDef;
  /** What differs between the two: always stats, a rider's price or an effect's size, perhaps more. */
  differs: LadderAxis[];
  /** Printed in the same set. */
  sameSet: boolean;
  /** The same printed cost and the same colours. */
  sameCost: boolean;
  /** The same colours. */
  sameColours: boolean;
  /** The same paid-off tribes and the same legendary status: only numbers tell them apart. */
  sameIdentity: boolean;
  /**
   * The id of the card that dominates the other, or null when the two trade
   * off. A winner's colours must fit inside the loser's (colourless beats blue,
   * blue never beats colourless): every deck that can play the loser can then
   * play the winner, and another colour identity is otherwise another card.
   */
  winner: string | null;
  /** Why the winner wins. */
  notes: string[];
}

export interface LadderGroup {
  /** Cheapest first, then smallest stat line. */
  cards: CardDef[];
  /** The axes that vary across the whole group. */
  differs: LadderAxis[];
  /** The shared text is keywords only (a vanilla or keyword-only body), so a stat line is all a card has. */
  keywordOnly: boolean;
  /** Sets holding two or more of the group's cards, each with its own axes. */
  sameSet: { set: string; cards: CardDef[]; differs: LadderAxis[] }[];
  /**
   * Every pair of the group whose stats, rider prices or effect sizes differ and
   * that shares a set, shares a cost, or where one card dominates the other.
   */
  pairs: LadderPair[];
}

/** Numeric fields that size an effect or a target cap: Foresee 1 against Foresee 3, cost 2 or less against 3. */
const EFFECT_NUMBERS: ReadonlySet<string> = new Set(['n', 'count', 'p', 't', 'maxCost', 'minAttack']);

/**
 * Ops whose order in one list never changes what they do: milling, discarding,
 * life loss and gain. A run of them is compared as a set; any other op (Foresee,
 * draw, a targeted effect) keeps its place and breaks the run, so "Foresee 1,
 * then draw a card" never matches "draw a card, then Foresee 1".
 */
const COMMUTING_OPS: ReadonlySet<string> = new Set(['grind', 'discard', 'discardRandom', 'loseLife', 'gainLife', 'severGrave']);

/**
 * Replaces every number in `v` with its sign, so -2/-2 (removal) and +2/+2 (a
 * pump) never share a key while +1/+3 and +3/+3 do. Only called on effect
 * subtrees, never on a condition or a Rite count.
 */
function signOnly(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(signOnly);
  if (v && typeof v === 'object' && !isManaCost(v))
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, EFFECT_NUMBERS.has(k) && typeof x === 'number' ? (x < 0 ? '#-' : '#+') : signOnly(x)]),
    );
  return v;
}

/** One op list with its commuting runs sorted, and its numbers reduced to signs when `strip`. */
function normaliseOps(ops: readonly EffectOp[] | undefined, strip: boolean): unknown {
  if (!ops) return ops;
  const out: unknown[] = [];
  let run: EffectOp[] = [];
  const flush = () => {
    out.push(...[...run].sort((x, y) => j(x).localeCompare(j(y))));
    run = [];
  };
  for (const op of ops) {
    if (COMMUTING_OPS.has(op.op)) run.push(op);
    else {
      flush();
      out.push(op);
    }
  }
  flush();
  return strip ? signOnly(out) : out;
}

/**
 * The card with its op lists normalised (`normaliseOps`), and, when `strip`,
 * the numbers in every effect subtree reduced to signs: ability ops, statics
 * and target caps, Duty ops and targets, Empower and Retell ops, chapters,
 * Hauntlink's linked effect and Awakening. Conditions and Rite keep their
 * numbers, since those gate a card rather than size its effect.
 */
function effectForm(d: CardDef, strip: boolean): CardDef {
  const s = <T>(v: T): T => (strip ? (signOnly(v) as T) : v);
  const ops = (v: readonly EffectOp[] | undefined) => normaliseOps(v, strip) as EffectOp[] | undefined;
  const acts = activatedAbilitiesOf(d).map((a) => ({ ...a, targets: s(a.targets), ops: ops(a.ops)! }));
  return {
    ...d,
    attack: undefined,
    defense: undefined,
    supertypes: undefined,
    abilities: d.abilities?.map((a) => ({ ...a, ops: ops(a.ops), static: s(a.static), targets: s(a.targets) })),
    activated: d.activated === undefined ? undefined : acts,
    empower: d.empower && { ...d.empower, targets: s(d.empower.targets), ops: ops(d.empower.ops)! },
    retell: d.retell && { ...d.retell, targets: s(d.retell.targets), ops: ops(d.retell.ops) },
    chapters: d.chapters?.map((c) => ops(c)!),
    hauntlink: d.hauntlink && s(d.hauntlink),
    awakening: s(d.awakening),
  } as CardDef;
}

/** The rules text without its stat line, mana costs, tribes or legendary status; effect numbers kept. */
const effectKey = (d: CardDef) => shapeKey(effectForm(d, false), NO_TYPAL);

/**
 * The rules text with the stat line, every mana cost, the size of every effect
 * (its sign kept), every tribe and legendary status stripped, and commuting op
 * runs compared as sets. Two cards that share it differ at most in stats,
 * printed cost, colours, a rider's or Duty's price, the size of an effect,
 * tribe or legendary status. It reads the card's data, so two texts that say
 * the same thing through different ops still key apart.
 */
export function ladderKey(d: CardDef): string {
  return shapeKey(effectForm(d, true), NO_TYPAL);
}

const statLine = (d: CardDef) => (d.types.includes('creature') ? `${d.attack ?? 0}/${d.defense ?? 0}` : '');
const colourKey = (d: CardDef) => [...d.colors].sort().join('');

/** Which of stats, printed cost, colours, rider or Duty prices and effect sizes vary across `cards`. */
export function ladderAxes(cards: readonly CardDef[]): LadderAxis[] {
  const varies = (f: (d: CardDef) => string) => new Set(cards.map(f)).size > 1;
  const out: LadderAxis[] = [];
  if (varies(statLine)) out.push('stats');
  if (varies((d) => costStr(d.cost))) out.push('cost');
  if (varies(colourKey)) out.push('colours');
  if (varies(riderCosts)) out.push('rider');
  if (varies(effectKey)) out.push('effect');
  return out;
}

/** The axes that make a ladder; printed cost and colours alone are REDESKIN's. */
const LADDER_AXES: readonly LadderAxis[] = ['stats', 'rider', 'effect'];

/** Fields a keyword-only body carries: no ability, rider or Duty of its own. */
const BODY_ONLY: ReadonlySet<string> = new Set(['types', 'subtypes', 'keywords', 'attack', 'defense']);

/**
 * Groups `pool` by `ladderKey` and keeps the groups whose stat lines, rider
 * prices or effect sizes differ: the same card at 2/2, 3/3 and 4/4 up the
 * curve, the same cost at two stat lines, the same card with a dearer Skim or
 * Retell, or Foresee 1 where its twin has Foresee 3. A group
 * that differs only in printed cost or colours is a REDESKIN or SAME TEXT
 * cluster and is left to those passes. Tribes and legendary status do not split
 * a group; each pair says whether they tell its two cards apart, since the
 * review rules on whether that is enough. A winner's colours must fit inside
 * the loser's.
 */
export function statLadders(pool: readonly CardDef[], typal: ReadonlySet<string> = POOL_TYPAL): LadderGroup[] {
  const byKey = new Map<string, CardDef[]>();
  for (const d of pool) {
    const k = ladderKey(d);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(d);
  }
  const mv = (d: CardDef) => manaValue(d.cost ?? ZERO);
  const size = (d: CardDef) => (d.attack ?? 0) + (d.defense ?? 0);
  const out: LadderGroup[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const differs = ladderAxes(group);
    if (!LADDER_AXES.some((x) => differs.includes(x))) continue;
    const cards = [...group].sort((x, y) => mv(x) - mv(y) || size(x) - size(y) || x.name.localeCompare(y.name));
    const bySet = new Map<string, CardDef[]>();
    for (const d of cards) {
      const s = d.set ?? 'base';
      (bySet.get(s) ?? bySet.set(s, []).get(s)!).push(d);
    }
    const sameSet = [...bySet.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([set, g]) => ({ set, cards: g, differs: ladderAxes(g) }));
    const pairs: LadderPair[] = [];
    for (let i = 0; i < cards.length; i++)
      for (let k = i + 1; k < cards.length; k++) {
        const [a, b] = [cards[i], cards[k]];
        // Two rungs alike in every number are a SAME TEXT or REDESKIN pair, not a ladder.
        const differs = ladderAxes([a, b]);
        if (!LADDER_AXES.some((x) => differs.includes(x))) continue;
        const sameColours = colourKey(a) === colourKey(b);
        const fits = (w: CardDef, l: CardDef) => w.colors.every((c) => l.colors.includes(c));
        const ab = fits(a, b) ? dominates(a, b) : null;
        const ba = !ab && fits(b, a) ? dominates(b, a) : null;
        const pair: LadderPair = {
          a,
          b,
          differs,
          sameSet: (a.set ?? 'base') === (b.set ?? 'base'),
          sameCost: costStr(a.cost) === costStr(b.cost) && sameColours,
          sameColours,
          sameIdentity: identityOf(a, typal) === identityOf(b, typal),
          winner: ab ? a.id : ba ? b.id : null,
          notes: (ab ?? ba)?.notes ?? [],
        };
        if (pair.sameSet || pair.sameCost || pair.winner) pairs.push(pair);
      }
    // Every member shares the ladder key, so the first card speaks for the group.
    const keywordOnly = Object.keys(bodyFields({ ...cards[0], supertypes: undefined }, NO_TYPAL, 'strip')).every((f) => BODY_ONLY.has(f));
    out.push({ cards, differs, keywordOnly, sameSet, pairs });
  }
  return out;
}

function printLadders() {
  const groups = statLadders(nonLand);
  const tight = groups.flatMap((g) => g.pairs.filter((p) => p.sameSet && p.sameCost));
  const perSet = new Map<string, number>();
  for (const p of tight) perSet.set(p.a.set ?? 'base', (perSet.get(p.a.set ?? 'base') ?? 0) + 1);
  const withSet = groups.filter((g) => g.sameSet.length);
  console.log(`\n\n══ STAT LADDER — the same rules text at different stats, rider prices or effect sizes (${groups.length} groups, ${withSet.length} with a same-set pair) ══`);
  console.log('  Tribes and legendary status do not split a group; every row prints its paid-off tribe and');
  console.log('  legendary status (id), and every pair says whether they tell the two cards apart.');
  console.log("  A winner's colours fit inside the loser's: another colour identity is otherwise another card.");
  const bySet = [...perSet.entries()].sort().map(([s, n]) => `${s}=${n}`);
  console.log(`  Same-set pairs at the same printed cost and colours: ${tight.length} (${bySet.join(' ') || 'none'})`);
  const row = (d: CardDef) => {
    const riders = riderCosts(d);
    const stats = statLine(d);
    return `      · ${label(d)} [${d.colors.join('') || 'C'}]${stats ? `  ${stats}` : ''}${riders ? `  ${riders}` : ''}  id: ${identityOf(d)}`;
  };
  const nameOf = (p: LadderPair) => (p.winner === p.a.id ? p.a.name : p.b.name);
  const verdict = (p: LadderPair) => {
    const dom = p.winner ? `DOMINATED, ${nameOf(p)} wins (${p.notes.join(' · ')})` : 'trade-off';
    const colours = p.sameColours ? '' : '; colours differ';
    return `${dom}; ${p.sameIdentity ? 'same tribe and legendary status' : 'told apart by tribe or legendary status'}${colours}`;
  };
  const show = (g: LadderGroup) => {
    const text = textOf(g.cards[0]).replace(/^\d+\/\d+( \| )?/, '');
    console.log(`\n  ${g.cards[0].types.join('/')}  differs: ${g.differs.join(', ')}${g.keywordOnly ? '  KEYWORD-ONLY' : ''}  —  ${text || 'no text'}`);
    for (const d of g.cards) console.log(row(d));
    for (const p of g.pairs.filter((x) => x.sameSet && x.sameCost))
      console.log(`      SAME SET, SAME COST  ${p.a.name} / ${p.b.name}: ${verdict(p)}`);
    for (const p of g.pairs.filter((x) => x.winner && !(x.sameSet && x.sameCost)))
      console.log(`      ${p.sameSet ? 'same set' : 'across sets'}  ${p.a.name} / ${p.b.name}: ${verdict(p)}`);
    if (!g.pairs.some((p) => p.winner)) console.log('      no rung dominates another');
  };
  console.log('\n  ── Holding a same-set pair ──');
  withSet.sort((a, b) => a.sameSet[0].set.localeCompare(b.sameSet[0].set) || a.cards[0].name.localeCompare(b.cards[0].name)).forEach(show);
  console.log('\n  ── Across sets only ──');
  groups
    .filter((g) => !g.sameSet.length)
    .sort((a, b) => a.cards[0].name.localeCompare(b.cards[0].name))
    .forEach(show);
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

/**
 * Same body and colours, and a strictly better printed cost elsewhere in the
 * group: the dearer printing is dead. Every printing is checked against every
 * other, not only against the lowest mana value, because {3}{R} beats
 * {2}{R}{R} at the same mana value. `best` is the cheapest printing that beats
 * it. The body key already holds every paid-off tribe and the legendary
 * supertype, so a twin shares both; two legendary twins are `soft`, since the
 * legend rule is per name and a deck can field one of each at once.
 */
export function worseTwins(pool: readonly CardDef[], typal: ReadonlySet<string> = POOL_TYPAL): { best: CardDef; dead: CardDef; soft: boolean }[] {
  const by = new Map<string, CardDef[]>();
  for (const d of pool) {
    const k = `${bodyKey(d, typal)}|${[...d.colors].sort().join('')}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(d);
  }
  const rows: { best: CardDef; dead: CardDef; soft: boolean }[] = [];
  for (const g of by.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => manaValue(a.cost ?? ZERO) - manaValue(b.cost ?? ZERO));
    for (const dead of sorted) {
      const best = sorted.find((b) => b !== dead && costStrictlyBetter(b.cost, dead.cost));
      if (best) rows.push({ best, dead, soft: best.supertypes?.includes('legendary') ?? false });
    }
  }
  return rows;
}

function printWorseTwins() {
  console.log('\n\n══ STRICTLY-WORSE TWIN — same body + same colours, higher cost ══');
  console.log('  Nothing distinguishes these but the price. The dearer card is unplayable.\n');
  const twins = worseTwins(nonLand);
  const hardRows = twins.filter((r) => !r.soft);
  const softRows = twins.filter((r) => r.soft);
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
  if (MODE === 'all' || MODE === 'ladder') printLadders();
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
