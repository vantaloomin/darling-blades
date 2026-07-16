// Compacts the progression-sim JSON report into the dashboard dataset.
// Usage: node prep-baseline.mjs <in: economy-baseline.json> <out: baseline-data.js>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
const report = JSON.parse(readFileSync(inPath, 'utf8'));

const TIER_TOTALS = { c: 177, r: 109, sr: 26, ssr: 21, ur: 16 }; // collectible 349 pool
const POOL_TOTAL = 349;
const CHECKPOINTS = [1, 7, 14, 30, 45, 60];

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

const days = report.days;
const personas = report.personas.map((p) => ({ id: p.id, name: p.name, style: p.style }));

const quantile = (sorted, q) => {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

const series = {};
for (const p of personas) {
  const rows = report.aggregates.filter((a) => a.personaId === p.id).sort((a, b) => a.day - b.day);
  if (rows.length !== days.length) throw new Error(`persona ${p.id}: ${rows.length} rows vs ${days.length} days`);
  const snaps = report.snapshots.filter((s) => s.personaId === p.id);
  const spreadFor = (field) => {
    const p10 = [];
    const p90 = [];
    for (const d of days) {
      const vals = snaps.filter((s) => s.day === d).map((s) => s[field]).sort((a, b) => a - b);
      p10.push(r3(quantile(vals, 0.1)));
      p90.push(r3(quantile(vals, 0.9)));
    }
    return { p10, p90 };
  };
  const src = (fn) => rows.map((r) => r2(fn(r.rewards)));
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
    tiers: Object.fromEntries(
      ['c', 'r', 'sr', 'ssr', 'ur'].map((t) => [t, rows.map((r) => r2(r.ownedUniquesByTier[t]))]),
    ),
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
    firstPremiumDay: (() => {
      const perSample = new Map();
      for (const s of snaps) {
        if (s.premiumDraftRuns > 0 && !perSample.has(s.sample)) {
          const prior = snaps.filter((x) => x.sample === s.sample && x.premiumDraftRuns > 0).map((x) => x.day);
          perSample.set(s.sample, Math.min(...prior));
        }
      }
      const vals = [...perSample.values()].sort((a, b) => a - b);
      return vals.length === 0 ? null : { median: quantile(vals, 0.5), n: vals.length, samples: report.seeds };
    })(),
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
