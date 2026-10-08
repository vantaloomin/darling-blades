/**
 * Summarize life-study shards into one Markdown report and one JSON.
 *
 *   npx tsx scripts/life-study/summarize.ts <dir with *.jsonl + .meta.json> --out <report.md>
 *
 * Every number compares arms on the same games: a slot (pair, game) is in
 * the report only if every life arm finished it.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_MV, type StudyGameRecord } from './game';

const dir = process.argv[2];
const outIdx = process.argv.indexOf('--out');
const out = outIdx >= 0 ? process.argv[outIdx + 1] : undefined;
if (!dir || !out) {
  console.error('usage: summarize.ts <dir> --out <report.md>');
  process.exit(2);
}

interface Meta {
  lives: number[];
  seeds: number;
  shard: number;
  shards: number;
  slotsPlanned: number;
  slotsComplete: number;
  stoppedEarly: boolean;
  minutes: number;
  field: { id: string; name: string; kind: string }[];
  pairs: [number, number][];
}

const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
const metas: Meta[] = files.map((f) => JSON.parse(readFileSync(join(dir, `${f}.meta.json`), 'utf8')) as Meta);
if (metas.length === 0) throw new Error(`no shards in ${dir}`);
const meta = metas[0];
const lives = meta.lives;
const base = lives[0];
const records: (StudyGameRecord & { shard: number })[] = [];
files.forEach((f, i) => {
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
    if (line.trim()) records.push({ ...(JSON.parse(line) as StudyGameRecord), shard: metas[i].shard });
  }
});

const byArm = new Map<number, typeof records>();
for (const l of lives) byArm.set(l, records.filter((r) => r.life === l));
const slotKey = (r: StudyGameRecord): string => `${r.pair}:${r.game}`;
const armBySlot = new Map<number, Map<string, StudyGameRecord>>();
for (const l of lives) armBySlot.set(l, new Map(byArm.get(l)!.map((r) => [slotKey(r), r])));

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) * (xs.length / Math.max(1, xs.length - 1)));
};
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;
const f1 = (x: number): string => x.toFixed(1);
const f2 = (x: number): string => x.toFixed(2);

const lines: string[] = [];
const totalGames = records.length;
const slots = totalGames / lives.length;
lines.push(`# Starting-life study (D1) readings`);
lines.push('');
lines.push(
  `${meta.field.length} Warchest decks (${meta.field.filter((d) => d.kind === 'prefab').length} prefabs, ` +
    `${meta.field.filter((d) => d.kind === 'craft').length} sweep crafts, ` +
    `${meta.field.filter((d) => d.kind === 'boss').length} First Dawn summit bosses), every pair, ` +
    `Hard on both seats, ${lives.join(' / ')} starting life. ${slots} paired games per arm ` +
    `(${totalGames} games), the same seeds, seats and AI seeds in every arm. ` +
    `Shards: ${metas.length}, ${metas.filter((m) => m.stoppedEarly).length} stopped at budget.`,
);
lines.push('');

// --- Game length and endings ---------------------------------------------
const armStats = lives.map((l) => {
  const rs = byArm.get(l)!;
  const turns = rs.map((r) => r.turns);
  const reasons: Record<string, number> = {};
  for (const r of rs) reasons[String(r.reason)] = (reasons[String(r.reason)] ?? 0) + 1;
  const ms = rs.map((r) => r.aiMs[0] + r.aiMs[1]);
  const dec = rs.map((r) => r.decisions[0] + r.decisions[1]);
  const landsEnd = rs.flatMap((r) => r.lands);
  const castsPerGame = Array.from({ length: MAX_MV }, (_, mv) =>
    mean(rs.map((r) => r.casts[0][mv] + r.casts[1][mv])),
  );
  const anyCastAtLeast = (k: number): number =>
    mean(rs.map((r) => (r.casts.some((c) => c.slice(k).some((x) => x > 0)) ? 1 : 0)));
  return {
    life: l,
    n: rs.length,
    medTurns: quantile(turns, 0.5),
    meanTurns: mean(turns),
    p90Turns: quantile(turns, 0.9),
    overByRound12: mean(turns.map((t) => (t <= 24 ? 1 : 0))),
    reasons,
    draws: rs.filter((r) => r.w === 2).length,
    msPerGame: mean(ms),
    decPerGame: mean(dec),
    msPerDecision: ms.reduce((a, b) => a + b, 0) / dec.reduce((a, b) => a + b, 0),
    p90MsPerGame: quantile(ms, 0.9),
    landsEnd: mean(landsEnd),
    tenLands: mean(landsEnd.map((x) => (x >= 10 ? 1 : 0))),
    castsPerGame,
    any6: anyCastAtLeast(6),
    any8: anyCastAtLeast(8),
    creaturesEnd: mean(rs.flatMap((r) => r.creatures)),
    atCap: mean(rs.flatMap((r) => r.creatures.map((c) => (c >= 8 ? 1 : 0)))),
    overcharged: mean(rs.map((r) => r.overcharged[0] + r.overcharged[1])),
    refused: mean(rs.map((r) => r.tokensRefused[0] + r.tokensRefused[1])),
    winnerLifeEnd: mean(rs.filter((r) => r.w !== 2).map((r) => r.endLife[r.w as 0 | 1])),
  };
});

const header = `| | ${lives.map((l) => `${l} life`).join(' | ')} |`;
const sep = `| --- | ${lives.map(() => '---').join(' | ')} |`;
const row = (label: string, fn: (s: (typeof armStats)[number]) => string): string =>
  `| ${label} | ${armStats.map(fn).join(' | ')} |`;

lines.push('## Game length and how games end');
lines.push('');
lines.push('`state.turn` counts each player\'s turn, so a round is two turns.');
lines.push('');
lines.push(header, sep);
lines.push(row('Median turns', (s) => `${s.medTurns} (${f1(s.medTurns / 2)} rounds)`));
lines.push(row('Mean turns', (s) => f1(s.meanTurns)));
lines.push(row('90th percentile turns', (s) => String(s.p90Turns)));
lines.push(row('Over by round 12', (s) => pct(s.overByRound12)));
lines.push(row('Ended on life', (s) => pct((s.reasons.life ?? 0) / s.n)));
lines.push(row('Ended on decking', (s) => pct((s.reasons.deck ?? 0) / s.n)));
lines.push(row('Turn-limit draws', (s) => pct((s.reasons.turnLimit ?? 0) / s.n)));
lines.push(row('Winner\'s life at the end', (s) => f1(s.winnerLifeEnd)));
lines.push('');

lines.push('## Lands and what gets cast');
lines.push('');
lines.push('Warchest decks hold their lands in a 10-land reserve, so 10 is the most a player can have.');
lines.push('');
lines.push(header, sep);
lines.push(row('Lands in play at the end (per player)', (s) => f2(s.landsEnd)));
lines.push(row('Players at all 10 lands at the end', (s) => pct(s.tenLands)));
lines.push(row('Games with a 6+ cost spell cast', (s) => pct(s.any6)));
lines.push(row('Games with an 8+ cost spell cast', (s) => pct(s.any8)));
for (let mv = 0; mv < MAX_MV; mv++) {
  const label = mv === MAX_MV - 1 ? `${mv}+` : String(mv);
  lines.push(row(`Casts per game at cost ${label}`, (s) => f2(s.castsPerGame[mv])));
}
lines.push('');

lines.push('## The board cap');
lines.push('');
lines.push(header, sep);
lines.push(row('Creatures in play at the end (per player)', (s) => f2(s.creaturesEnd)));
lines.push(row('Players at the 8-creature cap at the end', (s) => pct(s.atCap)));
lines.push(row('Overcharges per game', (s) => f2(s.overcharged)));
lines.push(row('Tokens refused per game (no namesake)', (s) => f2(s.refused)));
lines.push('');

// Hard time: compare on the same shard (same runner), then pool the ratios.
lines.push('## Hard AI time');
lines.push('');
const shardIds = [...new Set(records.map((r) => r.shard))];
const ratio = (l: number, fn: (r: StudyGameRecord) => number): number => {
  let num = 0;
  let den = 0;
  for (const s of shardIds) {
    const a = records.filter((r) => r.shard === s && r.life === l);
    const b = records.filter((r) => r.shard === s && r.life === base);
    num += a.reduce((x, r) => x + fn(r), 0);
    den += b.reduce((x, r) => x + fn(r), 0);
  }
  return num / den;
};
lines.push(
  'Every shard plays all arms on one runner, so the ratios compare like with like; absolute ms depend on the runner.',
);
lines.push('');
lines.push(header, sep);
lines.push(row('Hard ms per game (both seats)', (s) => f1(s.msPerGame)));
lines.push(row('90th percentile ms per game', (s) => f1(s.p90MsPerGame)));
lines.push(row('Decisions per game', (s) => f1(s.decPerGame)));
lines.push(row('ms per decision', (s) => f2(s.msPerDecision)));
lines.push(row(`Time per game vs ${base} life`, (s) => `x${f2(ratio(s.life, (r) => r.aiMs[0] + r.aiMs[1]))}`));
lines.push('');

// --- Per-deck win rate and its paired shift -------------------------------
lines.push('## Each deck\'s win rate and its shift');
lines.push('');
lines.push(
  `Win rate over decided games against the rest of the field. The shift is paired: the same game at ${base} life and ` +
    'at the higher total, ± one standard error. Draws count as half a win in the shift.',
);
lines.push('');
const deckRows = meta.field.map((d, di) => {
  const perArm = lives.map((l) => {
    let wins = 0;
    let decided = 0;
    for (const r of byArm.get(l)!) {
      const [pr, pc] = meta.pairs[r.pair];
      if (pr !== di && pc !== di) continue;
      if (r.w === 2) continue;
      decided++;
      if ((r.w === 0) === (pr === di)) wins++;
    }
    return decided ? wins / decided : NaN;
  });
  const shifts = lives.slice(1).map((l) => {
    const diffs: number[] = [];
    for (const r of byArm.get(l)!) {
      const [pr, pc] = meta.pairs[r.pair];
      if (pr !== di && pc !== di) continue;
      const b = armBySlot.get(base)!.get(slotKey(r));
      if (!b) continue;
      const score = (x: StudyGameRecord): number => (x.w === 2 ? 0.5 : (x.w === 0) === (pr === di) ? 1 : 0);
      diffs.push(score(r) - score(b));
    }
    return { d: mean(diffs), se: sd(diffs) / Math.sqrt(diffs.length), n: diffs.length };
  });
  return { d, perArm, shifts };
});
const lastShift = (x: (typeof deckRows)[number]): number => x.shifts[x.shifts.length - 1].d;
deckRows.sort((a, b) => lastShift(b) - lastShift(a));
lines.push(
  `| Deck | Kind | ${lives.map((l) => `${l} life`).join(' | ')} | ${lives
    .slice(1)
    .map((l) => `Shift at ${l}`)
    .join(' | ')} |`,
);
lines.push(`| --- | --- | ${lives.map(() => '---').join(' | ')} | ${lives.slice(1).map(() => '---').join(' | ')} |`);
for (const x of deckRows) {
  lines.push(
    `| ${x.d.name} | ${x.d.kind} | ${x.perArm.map(pct).join(' | ')} | ${x.shifts
      .map((s) => `${s.d >= 0 ? '+' : ''}${f1(100 * s.d)} ± ${f1(100 * s.se)}`)
      .join(' | ')} |`,
  );
}
lines.push('');
const spread = lives.map((_, i) => {
  const rates = deckRows.map((x) => x.perArm[i]);
  return { min: Math.min(...rates), max: Math.max(...rates), sd: sd(rates) };
});
lines.push(header, sep);
lines.push(row('Field spread (best minus worst deck)', (s) => {
  const i = lives.indexOf(s.life);
  return `${f1(100 * (spread[i].max - spread[i].min))} pts`;
}));
lines.push(row('Standard deviation of deck win rates', (s) => `${f1(100 * spread[lives.indexOf(s.life)].sd)} pts`));
lines.push('');

writeFileSync(out, lines.join('\n'));
writeFileSync(
  out.replace(/\.md$/, '.json'),
  JSON.stringify({ meta: { ...meta, shards: metas.length }, armStats, spread, decks: deckRows }, null, 2),
);
console.log(lines.join('\n'));
