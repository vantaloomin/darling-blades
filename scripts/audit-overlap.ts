/**
 * One-off cross-card overlap audit (scratch tool, not part of the doc set).
 *
 * Answers four questions the shipped `blades-db.ts` checks do not:
 *   1. IDENTICAL  — clusters of cards that are the same card with a new name.
 *   2. REDESKIN   — the same card printed at a DIFFERENT cost or colour.
 *   3. DOMINATED  — A is at-least-as-good on every op AND strictly better on one,
 *                   for the same or a lower cost. This is the op-level test that
 *                   catches "White-Veil Collapse vs The Hall Clears": same body,
 *                   plus a rider, same price. `blades-db.ts dominated` compares
 *                   creature stat lines inside a shared shape and misses it.
 *   4. ODD        — internal inconsistencies: dead abilities, riders that cost
 *                   more than the card, statics that grant nothing, etc.
 *
 *   npx tsx scripts/audit-overlap.ts [identical|redeskin|dominated|odd|all]
 */
import { ALL_CARDS } from '../src/data/catalog';
import type { AbilityDef, CardDef, Color, EffectOp, ManaCost } from '../src/engine/types';
import { manaValue } from '../src/engine/types';

const MODE = (process.argv[2] ?? 'all').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic key for any value: object keys sorted, arrays order-preserved. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val === undefined) continue;
      out[k] = canon(val);
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

/** Sorted ability list — authoring order is not a rules difference. */
const abilityKeys = (d: CardDef) => (d.abilities ?? []).map((a) => j(a)).sort();

/**
 * Everything mechanical about the card EXCEPT its cost and colours. Two cards
 * with the same body key play identically once they are on the stack.
 */
function bodyKey(d: CardDef): string {
  return j({
    types: [...d.types].sort(),
    attack: d.attack ?? null,
    defense: d.defense ?? null,
    keywords: [...(d.keywords ?? [])].sort(),
    abilities: abilityKeys(d),
    chapters: d.chapters ?? null,
    awakening: d.awakening ?? null,
    empower: d.empower ?? null,
    skim: d.skim ?? null,
    retell: d.retell ?? null,
    rite: d.rite ?? null,
    nineLives: d.nineLives ?? null,
    preserve: d.preserve ?? null,
    hauntlink: d.hauntlink ?? null,
    manaAbility: d.manaAbility ? [...d.manaAbility].sort() : null,
    entersTapped: d.entersTapped ?? false,
    x: d.x ?? null,
  });
}

const fullKey = (d: CardDef) => j({ body: bodyKey(d), cost: costStr(d.cost), colors: [...d.colors].sort() });

// ─────────────────────────────────────────────────────────────────────────────
// Cost comparison
// ─────────────────────────────────────────────────────────────────────────────

/** A is castable in every board state B is: no more of any pip, no higher mv. */
function costNoWorse(a?: ManaCost, b?: ManaCost): boolean {
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
function isUpside(op: EffectOp): boolean {
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
function opsCover(aOps: EffectOp[], bOps: EffectOp[]): Cmp | null {
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

function describeOp(o: EffectOp): string {
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
function dominates(a: CardDef, b: CardDef): Cmp | null {
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

  // keywords
  const ak = new Set(a.keywords ?? []);
  const bk = new Set(b.keywords ?? []);
  for (const k of bk) if (!ak.has(k)) return null;
  const extraK = [...ak].filter((k) => !bk.has(k));
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
    ['empower', a.empower, b.empower],
    ['skim', a.skim, b.skim],
    ['retell', a.retell, b.retell],
    ['preserve', a.preserve, b.preserve],
    ['nineLives', a.nineLives, b.nineLives],
    ['hauntlink', a.hauntlink, b.hauntlink],
    ['manaAbility', a.manaAbility, b.manaAbility],
    ['x', a.x, b.x],
  ];
  for (const [name, av, bv] of riders) {
    if (j(av ?? null) === j(bv ?? null)) continue;
    if (bv != null) return null; // B has a rider A lacks (or differs) — not dominated
    better = true;
    notes.push(`has ${name}`);
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
const TYPAL = new Set<string>();
for (const d of ALL_CARDS)
  for (const a of d.abilities ?? []) if (a.static?.filter?.subtype) TYPAL.add(a.static.filter.subtype);

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 2. Identical / redeskin clusters
// ─────────────────────────────────────────────────────────────────────────────

function clusters() {
  const byBody = new Map<string, CardDef[]>();
  for (const d of nonLand) {
    const k = bodyKey(d);
    (byBody.get(k) ?? byBody.set(k, []).get(k)!).push(d);
  }
  const identical: CardDef[][] = [];
  const redeskin: CardDef[][] = [];
  for (const group of byBody.values()) {
    if (group.length < 2) continue;
    const byFull = new Map<string, CardDef[]>();
    for (const d of group) {
      const k = fullKey(d);
      (byFull.get(k) ?? byFull.set(k, []).get(k)!).push(d);
    }
    for (const g of byFull.values()) if (g.length > 1) identical.push(g);
    if (byFull.size > 1) redeskin.push(group);
  }
  return { identical, redeskin };
}

function printClusters() {
  const { identical, redeskin } = clusters();
  console.log(`\n══ IDENTICAL — same body, same cost, same colours (${identical.length} clusters) ══`);
  identical
    .sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name))
    .forEach((g) => {
      console.log(`\n  ${g.length}x  ${costStr(g[0].cost)}  ${g[0].types.join('/')}`);
      console.log(`      ${textOf(g[0])}`);
      for (const d of g) console.log(`      · ${label(d)}`);
    });

  console.log(`\n\n══ REDESKIN — same body, DIFFERENT cost or colour (${redeskin.length} clusters) ══`);
  redeskin
    .sort((a, b) => a[0].name.localeCompare(b[0].name))
    .forEach((g) => {
      const variants = new Set(g.map((d) => `${costStr(d.cost)}|${[...d.colors].sort().join('')}`));
      if (variants.size < 2) return;
      console.log(`\n  ${g[0].types.join('/')}  —  ${textOf(g[0])}`);
      for (const d of g.sort((x, y) => manaValue(x.cost ?? { generic: 0, pips: {} }) - manaValue(y.cost ?? { generic: 0, pips: {} })))
        console.log(`      · ${label(d)} [${d.colors.join('') || 'C'}]`);
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
  if (d.empower) parts.push(`Empower ${costStr(d.empower.cost)}: ${(d.empower.ops ?? []).map(describeOp).join('; ')}`);
  if (d.skim) parts.push(`Skim ${costStr(d.skim.cost)}`);
  if (d.retell) parts.push(`Retell ${costStr(d.retell.cost)}`);
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
  const TOP_OF_CURVE = new Set(['Silt-Fat Behemoth', 'Silt-Crowned Harvester']);
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

    // zero-value numeric ops
    for (const a of [...(d.abilities ?? []), ...(d.empower ? [{ when: 'empower', ops: d.empower.ops } as never] : [])])
      for (const o of ((a as AbilityDef).ops ?? []) as EffectOp[]) {
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
      !d.hauntlink
    )
      say('BLANK', d, 'no abilities, no chapters, no Empower');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`Cards audited: ${cards.length} collectible (${nonLand.length} non-land)`);
if (MODE === 'all' || MODE === 'identical' || MODE === 'redeskin') printClusters();
if (MODE === 'all' || MODE === 'dominated') printDominated();
if (MODE === 'all' || MODE === 'odd') printOdd();

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
      // A dearer twin is only truly dead when nothing sets it apart: no typal
      // home the cheap one lacks, and no legend-rule drawback on the cheap one.
      const rescuedByTypal = d.subtypes.some((t) => TYPAL.has(t) && !best.subtypes.includes(t));
      const bestIsLegendary = best.supertypes?.includes('legendary') ?? false;
      const hard = !rescuedByTypal && !bestIsLegendary;
      (hard ? hardRows : softRows).push({ best, dead: d });
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
  show('HARD — nothing differentiates them', 'No typal home of its own, and the cheaper card is not legendary.', hardRows);
  show('SOFT — a tribe or the legend rule may rescue it', 'The dearer card has a typal identity the cheaper one lacks, or the cheaper one is legendary.', softRows);
  console.log(`
  ${hardRows.length + softRows.length} dearer printing(s): ${hardRows.length} hard, ${softRows.length} soft.`);
}

/** Same effect and cost, but one is a Charm (instant) and one a Ritual (sorcery). */
function printSpeedInversions() {
  console.log('\n══ SPEED — same effect and cost, Charm (instant) vs Ritual (sorcery) ══');
  console.log('  The Charm does everything the Ritual does and can be held up. The Ritual is dead.\n');
  const key = (d: CardDef) =>
    j({ ops: abilityKeys(d), cost: costStr(d.cost), colors: [...d.colors].sort(), kw: [...(d.keywords ?? [])].sort() });
  const by = new Map<string, CardDef[]>();
  for (const d of nonLand) {
    if (!d.types.includes('charm') && !d.types.includes('ritual')) continue;
    (by.get(key(d)) ?? by.set(key(d), []).get(key(d))!).push(d);
  }
  let n = 0;
  for (const g of by.values()) {
    const charms = g.filter((d) => d.types.includes('charm'));
    const rituals = g.filter((d) => d.types.includes('ritual'));
    if (!charms.length || !rituals.length) continue;
    n += rituals.length;
    console.log(`  ${textOf(charms[0])}   ${costStr(charms[0].cost)}`);
    for (const d of charms) console.log(`      Charm   ${label(d)}`);
    for (const d of rituals) console.log(`      Ritual  ${label(d)}  <- dead`);
    console.log('');
  }
  console.log(`  ${n} Ritual(s) outclassed by an identical Charm.`);
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

if (MODE === 'all' || MODE === 'focus') {
  printWorseTwins();
  printSpeedInversions();
  printRaritySplits();
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

  // Same-cost Charm beats same-cost Ritual: strictly better speed, same price.
  const spellKey = (d: CardDef) => j({ ops: abilityKeys(d), cost: costStr(d.cost), colors: [...d.colors].sort() });
  const charms = new Map<string, CardDef>();
  for (const d of nonLand) if (d.types.includes('charm')) charms.set(spellKey(d), d);
  for (const d of nonLand) {
    if (!d.types.includes('ritual')) continue;
    const c = charms.get(spellKey(d));
    if (c) (beaters.get(d.id) ?? beaters.set(d.id, []).get(d.id)!).push(c);
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
if (MODE === 'all' || MODE === 'cut') printCutList();
