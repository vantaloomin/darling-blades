/**
 * Core Set II coverage ledger (docs/plan-core-set-2.md, roster step 1).
 *
 * A machine-readable snapshot of the three rosters Core Set II returns to
 * (Three Kingdoms, Greek, Beastkin), measured against the whole live pool, so
 * new cards fill measured gaps rather than repeat nostalgia. Read-only over
 * the catalog and the authored deck lists; it writes two files:
 *
 *   docs/expansions/drafts/core-set-2-ledger.json  one row per card + totals
 *   docs/expansions/drafts/core-set-2-ledger.md    the same totals as tables
 *
 * Run: npx tsx scripts/core-set-2-ledger.ts [--check]
 * (`npm run gen-art-manifest` first in a fresh clone, for the art column.)
 * --check exits 1 when the committed files differ from a fresh run.
 *
 * Roster assignment: base-set cards by source file (tk-* is Three Kingdoms,
 * greek.ts is Greek, beastkin.ts is Beastkin, the rest of the base set is
 * "base-generic"); a card from a later set joins a roster only by subtype
 * (Beastkin anywhere; Wei/Shu/Wu/Jin; Olympian). Role tags are structural
 * reads of the card's ops, not a power score; mechanics come from the
 * glossary's `cardMechanics`. When Core Set II's own card files land, add a
 * file rule for them here (a Greek mortal without the Olympian subtype would
 * otherwise fall to "other").
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ARTIFACTS } from '../src/data/cards/artifacts';
import { BEASTKIN } from '../src/data/cards/beastkin';
import { DUALS } from '../src/data/cards/duals';
import { ENCHANTMENTS } from '../src/data/cards/enchantments';
import { GREEK } from '../src/data/cards/greek';
import { INSTANTS } from '../src/data/cards/instants';
import { LANDS } from '../src/data/cards/lands';
import { SORCERIES } from '../src/data/cards/sorceries';
import { TK_JIN } from '../src/data/cards/tk-jin';
import { TK_OTHER } from '../src/data/cards/tk-other';
import { TK_SHU } from '../src/data/cards/tk-shu';
import { TK_WEI } from '../src/data/cards/tk-wei';
import { TK_WU } from '../src/data/cards/tk-wu';
import { CARD_DB } from '../src/data/catalog';
import { DARLINGS_PRECONS } from '../src/data/darlingsPrecons';
import { cardMechanics } from '../src/data/glossary';
import { AVATARS } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import type { CardDef, Color, EffectOp } from '../src/engine/types';
import { activatedAbilitiesOf, flatOps, isType, manaValue } from '../src/engine/types';

const OUT_JSON = 'docs/expansions/drafts/core-set-2-ledger.json';
const OUT_MD = 'docs/expansions/drafts/core-set-2-ledger.md';
const MANIFEST = 'src/data/art-manifest.json';

type Roster = 'three-kingdoms' | 'greek' | 'beastkin' | 'base-generic' | 'other';
const ROSTERS: readonly Roster[] = ['three-kingdoms', 'greek', 'beastkin', 'base-generic'];
const COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const KEYWORDS = [
  'skyborne', 'wardingGaze', 'firstBlade', 'twinBlades', 'warcry', 'overrun', 'sentinel',
  'bulwark', 'deathblade', 'bloodoath', 'untouchable', 'dreaded', 'rage',
] as const;
/** The glossary's named mechanics (MECHANIC_NAMES in src/data/glossary.ts), in its order. */
const MECHANICS = [
  'sever', 'foresee', 'mark', 'propagate', 'hunt', 'provoked', 'quest', 'championAwakening',
  'empower', 'skim', 'retell', 'whispers', 'hauntlink', 'rite', 'tithe', 'nineLives', 'preserve', 'duty',
] as const;
const ROLES = [
  'removal', 'sweeper', 'burnFace', 'counter', 'bounce', 'tapDown', 'combatTrick', 'fog',
  'draw', 'selection', 'discard', 'lifegain', 'tokens', 'ramp', 'recursion', 'anthem',
  'artifactEnchantmentHate', 'mill',
] as const;
type Role = (typeof ROLES)[number];

const SOURCE_ROSTER = new Map<string, Roster>();
for (const list of [TK_WEI, TK_WU, TK_SHU, TK_JIN, TK_OTHER]) for (const c of list) SOURCE_ROSTER.set(c.id, 'three-kingdoms');
for (const c of GREEK) SOURCE_ROSTER.set(c.id, 'greek');
for (const c of BEASTKIN) SOURCE_ROSTER.set(c.id, 'beastkin');
for (const list of [INSTANTS, SORCERIES, ENCHANTMENTS, ARTIFACTS, DUALS, LANDS]) {
  for (const c of list) SOURCE_ROSTER.set(c.id, 'base-generic');
}

const TK_SUBTYPES = new Set(['Wei', 'Shu', 'Wu', 'Jin']);

function rosterOf(d: CardDef): Roster {
  const bySource = SOURCE_ROSTER.get(d.id);
  if (bySource) return bySource;
  if (d.subtypes.includes('Beastkin')) return 'beastkin';
  if (d.subtypes.some((s) => TK_SUBTYPES.has(s))) return 'three-kingdoms';
  if (d.subtypes.includes('Olympian')) return 'greek';
  return 'other';
}

function allOps(d: CardDef): EffectOp[] {
  const lists: EffectOp[][] = [];
  for (const a of d.abilities ?? []) if (a.ops) lists.push(a.ops);
  for (const a of activatedAbilitiesOf(d)) lists.push(a.ops);
  for (const ch of d.chapters ?? []) lists.push(ch);
  if (d.empower) lists.push(d.empower.ops);
  if (d.retell && 'ops' in d.retell && Array.isArray(d.retell.ops)) lists.push(d.retell.ops);
  if (d.preserve && 'ops' in d.preserve && Array.isArray(d.preserve.ops)) lists.push(d.preserve.ops);
  return lists.flatMap((l) => flatOps(l));
}

function rolesOf(d: CardDef): Role[] {
  const out = new Set<Role>();
  for (const op of allOps(d)) {
    const o = op as EffectOp & Record<string, unknown>;
    switch (op.op) {
      case 'destroy': case 'sever': case 'hunt': case 'sacrifice': out.add('removal'); break;
      case 'massDestroy': out.add('sweeper'); break;
      case 'damage':
        if (o.to === 'target') out.add('removal');
        else if (o.to === 'eachCreature' || o.to === 'eachOpponentCreature') out.add('sweeper');
        else if (o.to === 'opponent') out.add('burnFace');
        break;
      case 'loseLife': out.add('burnFace'); break;
      case 'cancel': out.add('counter'); break;
      case 'recall': out.add('bounce'); break;
      case 'tap': case 'tapAll': out.add('tapDown'); break;
      case 'boost':
        // A negative boost shrinks: one target is removal, a board-wide one a sweeper.
        if ((o.p as number) < 0 || (o.t as number) < 0) out.add(o.scope === 'target' ? 'removal' : 'sweeper');
        else out.add('combatTrick');
        break;
      case 'preventCombat': case 'preventCombatTo': out.add('fog'); break;
      case 'draw': out.add('draw'); break;
      case 'foresee': out.add('selection'); break;
      case 'discard': case 'discardRandom': out.add('discard'); break;
      case 'gainLife': out.add('lifegain'); break;
      case 'createToken': out.add('tokens'); break;
      case 'extraLandDrop': case 'fetchLand': out.add('ramp'); break;
      case 'raise': case 'reclaim': case 'reclaimSelf': out.add('recursion'); break;
      case 'destroyArtifactOrSeverEnchantment': case 'destroyNewestOpponentArtifactOrEnchantment':
        out.add('artifactEnchantmentHate'); break;
      case 'grind': case 'severTop': out.add('mill'); break;
      default: break;
    }
  }
  if (d.manaAbility && !isType(d, 'land')) out.add('ramp');
  for (const a of d.abilities ?? []) {
    const st = a.static;
    if (a.when === 'static' && st?.scope === 'attached' && ((st.p ?? 0) < 0 || (st.t ?? 0) < 0)) out.add('removal');
    if (a.when === 'static' && a.static?.scope === 'filter' && (a.static.p || a.static.t || a.static.grantKeywords)) {
      out.add('anthem');
    }
  }
  return ROLES.filter((r) => out.has(r));
}

/** The glossary's own reader, so the ledger and the Glossary never disagree. */
function mechanicsOf(d: CardDef): string[] {
  const has = new Set<string>(cardMechanics(d));
  return MECHANICS.filter((m) => has.has(m));
}

function costString(d: CardDef): string {
  if (!d.cost) return '';
  let s = d.cost.generic > 0 ? `{${d.cost.generic}}` : '';
  for (const c of COLORS) s += `{${c}}`.repeat(d.cost.pips[c] ?? 0);
  return s || '{0}';
}

function deckUsage(): Map<string, string[]> {
  const use = new Map<string, Set<string>>();
  const note = (id: string, where: string) => {
    if (!use.has(id)) use.set(id, new Set());
    use.get(id)!.add(where);
  };
  for (const d of STARTER_DECKS) for (const id of [...d.cards, ...(d.reserveCards ?? [])]) note(id, `starter:${d.id}`);
  for (const d of THEME_DECKS) for (const id of [...d.cards, ...(d.reserveCards ?? [])]) note(id, `theme:${d.id}`);
  for (const a of AVATARS) {
    for (const id of [...a.deck, ...a.reserveDeck, ...a.darlingsDeck, a.darlingId]) note(id, `rung:${a.tier}`);
  }
  for (const p of DARLINGS_PRECONS) for (const id of [p.darlingId, ...p.cards]) note(id, `darlings:${p.id}`);
  return new Map([...use].map(([k, v]) => [k, [...v].sort()]));
}

interface Row {
  id: string; name: string; set: string; roster: Roster; rarity: string; colors: string;
  types: string; subtypes: string[]; legendary: boolean; darlingEligible: boolean;
  cost: string; mv: number; attack?: number; defense?: number;
  keywords: string[]; mechanics: string[]; roles: string[]; art: boolean; usedIn: string[];
}

function colorKey(cs: readonly Color[]): string {
  if (cs.length === 0) return 'C';
  return COLORS.filter((c) => cs.includes(c)).join('');
}

function build() {
  const art = existsSync(MANIFEST) ? new Set<string>(JSON.parse(readFileSync(MANIFEST, 'utf8')).cards) : null;
  const usage = deckUsage();
  const collectible = Object.values(CARD_DB).filter((d) => !d.token && !d.supertypes?.includes('basic'));
  const rows: Row[] = collectible.map((d) => {
    const legendary = d.supertypes?.includes('legendary') ?? false;
    return {
      id: d.id, name: d.name, set: d.set ?? 'base', roster: rosterOf(d), rarity: d.rarity,
      colors: colorKey(d.colors), types: d.types.join('/'), subtypes: d.subtypes,
      legendary, darlingEligible: legendary && isType(d, 'creature'),
      cost: costString(d), mv: manaValue(d.cost), attack: d.attack, defense: d.defense,
      keywords: [...(d.keywords ?? [])], mechanics: mechanicsOf(d), roles: rolesOf(d),
      art: art ? art.has(d.artRef ?? d.id) : false, usedIn: usage.get(d.id) ?? [],
    };
  }).sort((a, b) => a.roster.localeCompare(b.roster) || a.id.localeCompare(b.id));
  return { rows, artKnown: art !== null };
}

type Agg = Record<string, number>;
const inc = (a: Agg, k: string, n = 1) => { a[k] = (a[k] ?? 0) + n; };

function summarize(rows: Row[]) {
  const per = (pred: (r: Row) => boolean) => {
    const rs = rows.filter(pred);
    const colors: Agg = {}, rarity: Agg = {}, types: Agg = {}, curve: Agg = {}, keywords: Agg = {}, mechanics: Agg = {}, roles: Agg = {};
    const colorCurve: Record<string, Agg> = {};
    const colorRoles: Record<string, Agg> = {};
    for (const r of rs) {
      const mono = r.colors.length === 1 ? r.colors : r.colors === 'C' ? 'C' : 'multi';
      inc(colors, mono); inc(rarity, r.rarity);
      for (const t of r.types.split('/')) inc(types, t);
      if (!r.types.includes('land')) {
        const b = r.mv >= 6 ? '6+' : String(r.mv);
        inc(curve, b);
        colorCurve[mono] ??= {}; inc(colorCurve[mono], b);
      }
      for (const k of r.keywords) inc(keywords, k);
      for (const m of r.mechanics) inc(mechanics, m);
      for (const ro of r.roles) { inc(roles, ro); colorRoles[mono] ??= {}; inc(colorRoles[mono], ro); }
    }
    const legends = rs.filter((r) => r.darlingEligible).map((r) => ({ id: r.id, name: r.name, colors: r.colors, rarity: r.rarity, cost: r.cost }));
    const unused = rs.filter((r) => r.usedIn.length === 0 && !r.types.includes('land')).length;
    const creatures = rs.filter((r) => r.types.includes('creature'));
    const subtypes: Agg = {};
    for (const r of creatures) for (const s of r.subtypes) inc(subtypes, s);
    return {
      cards: rs.length, creatures: creatures.length, colors, rarity, types, curve, colorCurve, keywords,
      keywordsMissing: KEYWORDS.filter((k) => !keywords[k]), mechanics,
      mechanicsMissing: MECHANICS.filter((m) => !mechanics[m]), roles, colorRoles, legends,
      legendPairs: [...new Set(legends.map((l) => l.colors))].sort(), subtypes,
      unusedInAuthoredDecks: unused, art: rs.filter((r) => r.art).length,
    };
  };
  const byRoster = Object.fromEntries(ROSTERS.map((ro) => [ro, per((r) => r.roster === ro)]));
  const core = per((r) => r.roster === 'three-kingdoms' || r.roster === 'greek' || r.roster === 'beastkin');
  const baseSet = per((r) => r.set === 'base');
  const pool = per(() => true);
  const legendsByPair: Agg = {};
  for (const r of rows) if (r.darlingEligible) inc(legendsByPair, r.colors);
  return { byRoster, core, baseSet, pool, legendsByPair };
}

function table(head: string[], body: (string | number)[][]): string {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function markdown(rows: Row[], s: ReturnType<typeof summarize>, artKnown: boolean): string {
  const cols = ['three-kingdoms', 'greek', 'beastkin', 'base-generic'] as const;
  const R = s.byRoster as Record<string, ReturnType<typeof summarize>['core']>;
  const hdr = ['', 'Three Kingdoms', 'Greek', 'Beastkin', 'Base generic', 'Three rosters', 'Base set', 'Whole pool'];
  const all = [...cols.map((c) => R[c]), s.core, s.baseSet, s.pool];
  const line = (label: string, f: (x: typeof s.core) => string | number) => [label, ...all.map(f)];
  const pct = (n: number, d: number) => d ? `${n} (${Math.round((100 * n) / d)}%)` : '0';
  const out: string[] = [];
  out.push('<!-- source-of-truth: scripts/core-set-2-ledger.ts, src/data/catalog.ts, src/data/cards/*.ts, src/data/opponents.ts, src/data/starterDecks.ts, src/data/darlingsPrecons.ts · generated by `npx tsx scripts/core-set-2-ledger.ts`; never hand-edit, re-run instead -->');
  out.push('');
  out.push('# Core Set II coverage ledger (generated)');
  out.push('');
  out.push('The measured snapshot of the three rosters Core Set II returns to, against the whole live pool. Generated by `npx tsx scripts/core-set-2-ledger.ts`; the per-card rows are in `core-set-2-ledger.json`. What the numbers mean for the set is read in [core-set-2-brief.md](core-set-2-brief.md), section 3.');
  out.push('');
  out.push('Rosters: base-set cards by source file (`tk-*.ts`, `greek.ts`, `beastkin.ts`; the base set\'s generic spells, artifacts and lands are "base generic"); cards from later sets join a roster by subtype (Beastkin, Wei/Shu/Wu/Jin, Olympian). Collectible cards only. Role tags are structural reads of each card\'s ops, not a power score.');
  out.push('');
  out.push('## Size, types and rarity');
  out.push('');
  out.push(table(hdr, [
    line('Cards', (x) => x.cards),
    line('Creatures', (x) => x.creatures),
    ...['charm', 'ritual', 'enchantment', 'artifact', 'land'].map((t) => line(t[0].toUpperCase() + t.slice(1) + 's', (x) => x.types[t] ?? 0)),
    ...['c', 'r', 'sr', 'ssr', 'ur'].map((r) => line(`Rarity ${r.toUpperCase()}`, (x) => x.rarity[r] ?? 0)),
    line('Not in any authored deck (non-land)', (x) => x.unusedInAuthoredDecks),
    ...(artKnown ? [line('With real art', (x) => `${x.art} / ${x.cards}`)] : []),
  ]));
  out.push('');
  out.push('## Colour');
  out.push('');
  out.push(table(hdr, [...[...COLORS, 'multi', 'C'].map((c) => line(c, (x) => pct(x.colors[c] ?? 0, x.cards)))]));
  out.push('');
  out.push('## Curve (non-land, by mana value)');
  out.push('');
  const buckets = ['0', '1', '2', '3', '4', '5', '6+'];
  out.push(table(hdr, buckets.map((b) => line(`MV ${b}`, (x) => x.curve[b] ?? 0))));
  out.push('');
  out.push('### The three rosters\' curve by colour');
  out.push('');
  out.push(table(['Colour', ...buckets.map((b) => `MV ${b}`)], [...COLORS, 'multi', 'C'].map((c) => [c, ...buckets.map((b) => s.core.colorCurve[c]?.[b] ?? 0)])));
  out.push('');
  out.push('## Keywords (13)');
  out.push('');
  out.push(table(hdr, KEYWORDS.map((k) => line(k, (x) => x.keywords[k] ?? 0))));
  out.push('');
  out.push(`Missing from the three rosters: ${s.core.keywordsMissing.join(', ') || 'none'}.`);
  out.push('');
  out.push('## Named mechanics');
  out.push('');
  out.push(table(hdr, MECHANICS.map((m) => line(m, (x) => x.mechanics[m] ?? 0))));
  out.push('');
  out.push(`Missing from the three rosters: ${s.core.mechanicsMissing.join(', ') || 'none'}.`);
  out.push('');
  out.push('## Roles');
  out.push('');
  out.push(table(hdr, ROLES.map((r) => line(r, (x) => x.roles[r] ?? 0))));
  out.push('');
  out.push('### The base set\'s roles by colour (spells live in base generic)');
  out.push('');
  out.push(table(['Role', ...COLORS, 'multi', 'C'], ROLES.map((r) => [r, ...[...COLORS, 'multi', 'C'].map((c) => s.baseSet.colorRoles[c]?.[r] ?? 0)])));
  out.push('');
  out.push('## Legends (Darling-eligible legendary creatures)');
  out.push('');
  for (const c of cols) {
    const ls = R[c].legends;
    out.push(`**${hdr[cols.indexOf(c) + 1]}** (${ls.length}): ${ls.map((l) => `${l.name} (${l.colors}, ${l.rarity.toUpperCase()}, ${l.cost})`).join('; ') || 'none'}.`);
    out.push('');
  }
  const named = rows.filter((r) => r.roster !== 'other' && r.roster !== 'base-generic' && !r.legendary && r.types.includes('creature') && r.name.includes(', '));
  out.push(`**Named characters printed without the legendary supertype** (a "Name, Title" creature that cannot be a Darling; ${named.length}): ${named.map((r) => `${r.name} (${r.colors}, ${r.rarity.toUpperCase()}${r.usedIn.some((u) => u.startsWith('rung:')) ? ', in a rung list' : ''})`).join('; ') || 'none'}.`);
  out.push('');
  out.push('### Whole-pool Darling identities by colour combination');
  out.push('');
  const combos = Object.entries(s.legendsByPair).sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));
  out.push(table(['Colours', 'Legends'], combos.map(([k, v]) => [k, v])));
  out.push('');
  out.push('## Creature subtypes in the three rosters');
  out.push('');
  out.push(table(['Subtype', 'Creatures'], Object.entries(s.core.subtypes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => [k, v])));
  out.push('');
  out.push(`Rows: ${rows.length} collectible cards in the pool, ${s.core.cards} in the three rosters.`);
  out.push('');
  return out.join('\n');
}

const { rows, artKnown } = build();
const s = summarize(rows);
// One row per line keeps the file small and its diffs readable.
const rosterRows = rows.filter((r) => r.roster !== 'other').map((r) => `  ${JSON.stringify(r)}`);
const json = `{\n "generatedBy": "scripts/core-set-2-ledger.ts",\n "summary": ${JSON.stringify(s)},\n "rows": [\n${rosterRows.join(',\n')}\n ]\n}\n`;
const md = markdown(rows, s, artKnown);

if (process.argv.includes('--check')) {
  const stale = [OUT_JSON, OUT_MD].filter((f, i) => !existsSync(f) || readFileSync(f, 'utf8') !== [json, md][i]);
  if (stale.length) {
    console.error(`core-set-2-ledger: stale ${stale.join(', ')}; re-run npx tsx scripts/core-set-2-ledger.ts`);
    process.exit(1);
  }
  console.log('core-set-2-ledger: up to date');
} else {
  writeFileSync(OUT_JSON, json);
  writeFileSync(OUT_MD, md);
  console.log(`core-set-2-ledger: ${rows.length} pool cards, ${s.core.cards} in the three rosters -> ${OUT_JSON}, ${OUT_MD}`);
}
