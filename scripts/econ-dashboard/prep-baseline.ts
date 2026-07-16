// Compacts a progression-sim --json report into the dashboard dataset.
// Usage: npx tsx scripts/econ-dashboard/prep-baseline.ts <in: report.json> <out: baseline-data.js>
// Then inline the output into dashboard-template.html at the /*__DATA__*/ marker.
import { readFileSync, writeFileSync } from 'node:fs';
import type {
  ProgressAggregate,
  ProgressSnapshot,
  ProgressionReport,
  RewardLedger,
} from '../progression-sim';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) throw new Error('usage: prep-baseline.ts <report.json> <out.js>');
const report = JSON.parse(readFileSync(inPath, 'utf8')) as ProgressionReport;

const TIER_TOTALS = { c: 177, r: 109, sr: 26, ssr: 21, ur: 16 }; // collectible 349 pool
const POOL_TOTAL = 349;
const CHECKPOINTS = [1, 7, 14, 30, 45, 60];
const RARITIES = ['c', 'r', 'sr', 'ssr', 'ur'] as const;

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

const days = report.days;
const personas = report.personas.map((p) => ({ id: p.id, name: p.name, style: p.style }));

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

type SpreadField = 'collectionPct' | 'goldEarned';

const series: Record<string, unknown> = {};
for (const p of personas) {
  const rows: ProgressAggregate[] = report.aggregates
    .filter((a) => a.personaId === p.id)
    .sort((a, b) => a.day - b.day);
  if (rows.length !== days.length) throw new Error(`persona ${p.id}: ${rows.length} rows vs ${days.length} days`);
  const snaps: ProgressSnapshot[] = report.snapshots.filter((s) => s.personaId === p.id);
  const spreadFor = (field: SpreadField): { p10: number[]; p90: number[] } => {
    const p10: number[] = [];
    const p90: number[] = [];
    for (const d of days) {
      const vals = snaps.filter((s) => s.day === d).map((s) => s[field]).sort((a, b) => a - b);
      p10.push(r3(quantile(vals, 0.1)));
      p90.push(r3(quantile(vals, 0.9)));
    }
    return { p10, p90 };
  };
  const src = (fn: (w: RewardLedger) => number): number[] => rows.map((r) => r2(fn(r.rewards)));
  const firstPremiumDay = ((): { median: number; n: number; samples: number } | null => {
    const perSample = new Map<number, number>();
    for (const s of snaps) {
      if (s.premiumDraftRuns > 0) {
        const prev = perSample.get(s.sample);
        if (prev === undefined || s.day < prev) perSample.set(s.sample, s.day);
      }
    }
    const vals = [...perSample.values()].sort((a, b) => a - b);
    return vals.length === 0 ? null : { median: quantile(vals, 0.5), n: vals.length, samples: report.seeds };
  })();
  series[p.id] = {
    collectionPct: rows.map((r) => r3(r.collectionPct)),
    uniqueCards: rows.map((r) => r2(r.uniqueCards)),
    collectionSize: rows.map((r) => r2(r.collectionSize)),
    goldEarned: rows.map((r) => r2(r.goldEarned)),
    goldSpent: rows.map((r) => r2(r.goldSpent)),
    goldNet: rows.map((r) => r2(r.goldNet)),
    finalGold: rows.map((r) => r2(r.finalGold)),
    packsOpened: rows.map((r) => r2(r.packsOpened)),
    premiumRuns: rows.map((r) => r2(r.premiumDraftRuns)),
    premiumKept: rows.map((r) => r2(r.premiumDraftCardsKept)),
    limitedRuns: rows.map((r) => r2(r.limitedRuns)),
    winRate: rows.map((r) => r3(r.winRate)),
    gauntletBest: rows.map((r) => r2(r.gauntletBestRung)),
    gauntletDone: rows.map((r) => r2(r.gauntletCompletions)),
    specialVariants: rows.map((r) => r2(r.specialVariants)),
    questClaimRate: rows.map((r) => r3(r.dailyQuestClaimRate)),
    streak: rows.map((r) => r2(r.streakLength)),
    achievementsClaimed: rows.map((r) => r2(r.achievementsClaimed)),
    minutesPerDay: rows.map((r) => r2(r.minutesPerDay)),
    tiers: Object.fromEntries(RARITIES.map((t) => [t, rows.map((r) => r2(r.ownedUniquesByTier[t]))])),
    sources: {
      practice: src((w) => w.practice),
      gauntlet: src((w) => w.gauntlet),
      limited: src((w) => w.limited),
      daily: src((w) => w.firstWin + w.streak + w.daily),
      achievements: src((w) => w.achievements),
      melt: src((w) => w.dupes + w.shards),
      starting: src((w) => w.starting),
    },
    spent: {
      packs: rows.map((r) => r2(r.spent.packs)),
      decks: rows.map((r) => r2(r.spent.decks)),
      premium: rows.map((r) => r2(r.spent.premiumDraftEntries)),
    },
    spread: {
      collectionPct: spreadFor('collectionPct'),
      goldEarned: spreadFor('goldEarned'),
    },
    firstPremiumDay,
  };
}

const data = {
  meta: {
    seeds: report.seeds,
    days,
    checkpoints: CHECKPOINTS,
    generated: '2026-07-15',
    poolTotal: POOL_TOTAL,
    tierTotals: TIER_TOTALS,
    verdict: report.verdict,
    personas,
  },
  series,
};

writeFileSync(outPath, `window.ECON_DATA = ${JSON.stringify(data)};`);
console.log(`wrote ${outPath} (${JSON.stringify(data).length} chars)`);
