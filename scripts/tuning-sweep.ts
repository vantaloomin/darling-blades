/**
 * Limited economy tuning experiment sweep.
 *
 * The candidate list is intentionally hard-coded so report IDs remain stable.
 * Each candidate is an independent progression-sim child process; product
 * economy constants are never mutated.
 *
 * Usage:
 *   npx tsx scripts/tuning-sweep.ts
 *   npx tsx scripts/tuning-sweep.ts --smoke
 *   npx tsx scripts/tuning-sweep.ts --out C:\\path\\tuning.json
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECONOMY } from '../src/config/rules';
import { CARD_DB } from '../src/data/catalog';
import type { Rarity } from '../src/engine/types';
import { addCard, PLAYSET, shardExcess } from '../src/meta/Collection';
import { payPremiumDraftEntry } from '../src/meta/Economy';
import {
  completeDraftRun,
  currentDraftPack,
  grantPremiumDraftPool,
  pickDraftCard,
  startDraftRun,
} from '../src/meta/Limited';
import { packPool } from '../src/meta/PackOpener';
import { freshSave } from '../src/meta/SaveManager';
import { PLAIN_VARIANT } from '../src/meta/variants';
import type {
  ProgressAggregate,
  ProgressionReport,
  ProgressSnapshot,
  TuningExperimentConfig,
} from './progression-sim';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROGRESSION_SIM = resolve(REPO_ROOT, 'scripts/progression-sim.ts');
const TSX_CLI = resolve(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs');
const BASE_SEED = 0x5eed_2050;
const CHILD_CONCURRENCY = 4;
const FULL_SEEDS = 4;
const FULL_DAYS = 60;
const SMOKE_SEEDS = 1;
const SMOKE_DAYS = 7;
const PREMIUM_SHARD_FARM_SEEDS = [
  0x1001, 0x2002, 0x3003, 0x4004, 0x5005,
  0x6006, 0x7007, 0x8008, 0x9009, 0xa00a,
] as const;
const PACK_TIERS: readonly Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
const PACK_SETS: readonly ('ragnarok' | 'celtic-fae' | 'arthurian-court' | undefined)[] = [
  undefined,
  'ragnarok',
  'celtic-fae',
  'arthurian-court',
];
const POOL_CARD_IDS = [...new Set(
  PACK_SETS.flatMap((set) => PACK_TIERS.flatMap((tier) => packPool(CARD_DB, tier, set))),
)];

interface Candidate {
  id: string;
  experiment?: TuningExperimentConfig;
}

const TRIM25: readonly [number, number, number, number] = [30, 75, 135, 225];
const TRIM40: readonly [number, number, number, number] = [25, 60, 110, 180];

export const CANDIDATES: readonly Candidate[] = Object.freeze([
  { id: 'BASELINE' },
  { id: 'COOL2', experiment: { cooldownDays: 2 } },
  { id: 'COOL3', experiment: { cooldownDays: 3 } },
  { id: 'WEEK2', experiment: { weeklyCap: 2 } },
  { id: 'TRIM25', experiment: { limitedRunGoldOverride: TRIM25 } },
  { id: 'TRIM40', experiment: { limitedRunGoldOverride: TRIM40 } },
  { id: 'PREMIUM_NOGOLD', experiment: { premiumRunGold: 'none' } },
  { id: 'COOL3_TRIM25', experiment: { cooldownDays: 3, limitedRunGoldOverride: TRIM25 } },
  { id: 'COOL3_NOGOLD', experiment: { cooldownDays: 3, premiumRunGold: 'none' } },
  { id: 'CRAFT6', experiment: { crafting: { enabled: true, craftCostMult: 6 } } },
  { id: 'CRAFT10', experiment: { crafting: { enabled: true, craftCostMult: 10 } } },
  {
    id: 'COOL3_TRIM25_CRAFT8',
    experiment: {
      cooldownDays: 3,
      limitedRunGoldOverride: TRIM25,
      crafting: { enabled: true, craftCostMult: 8 },
    },
  },
  {
    id: 'COOL3_NOGOLD_CRAFT8',
    experiment: {
      cooldownDays: 3,
      premiumRunGold: 'none',
      crafting: { enabled: true, craftCostMult: 8 },
    },
  },
  {
    id: 'WEEK2_NOGOLD_CRAFT8',
    experiment: {
      weeklyCap: 2,
      premiumRunGold: 'none',
      crafting: { enabled: true, craftCostMult: 8 },
    },
  },
]);

interface FarmMetrics {
  meanReturnGold: number;
  maxReturnGold: number;
}

interface PersonaMetrics {
  collectionPct: number;
  firstCompletionDay: number | null;
  /** How many seeds actually completed by the horizon (guards survivorship bias in the median). */
  completedSamples: number;
  totalSamples: number;
  lateNewUniquesPerDay: number | null;
}

interface SweepMetrics {
  finalDay: number;
  limitedFan: {
    premiumRuns: number;
    collectionPct: number;
    firstPremiumDay: number | null;
  };
  hardcoreOptimizer: PersonaMetrics;
  completionist: PersonaMetrics;
  casualCollectionPct: {
    newCasual: number;
    lowSkillCasual: number;
  };
  allPersonaMedian: {
    packsPerDay: number;
    collectionPct: number;
  };
  craftedUniques: number | null;
  shardFarm: FarmMetrics;
}

interface SweepRow {
  id: string;
  experiment?: TuningExperimentConfig;
  metrics: SweepMetrics;
  targets: {
    hardcoreCompletion50To75: boolean | null;
    casualNear50: boolean | null;
    medianPacksBelowBaseline: boolean | null;
    shardFarmMeanBelowEntry: boolean;
  };
}

interface SweepOutput {
  seeds: number;
  days: number[];
  childConcurrency: number;
  rows: SweepRow[];
  markdown: string;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function numberOrDash(value: number | null, digits = 1): string {
  return value === null ? '-' : value.toFixed(digits);
}

function rawPersonaSnapshots(report: ProgressionReport, personaId: string): ProgressSnapshot[] {
  return report.snapshots.filter((snapshot) => snapshot.personaId === personaId);
}

function finalAggregate(report: ProgressionReport, personaId: string): ProgressAggregate {
  const finalDay = Math.max(...report.days);
  const row = report.aggregates.find((aggregate) => aggregate.personaId === personaId && aggregate.day === finalDay);
  if (!row) throw new Error(`Missing ${personaId} day-${finalDay} aggregate`);
  return row;
}

function firstDayFor(
  snapshots: readonly ProgressSnapshot[],
  predicate: (snapshot: ProgressSnapshot) => boolean,
): { day: number | null; hits: number; samples: number } {
  const values: number[] = [];
  const samples = [...new Set(snapshots.map((snapshot) => snapshot.sample))].sort((a, b) => a - b);
  for (const sample of samples) {
    const day = snapshots
      .filter((snapshot) => snapshot.sample === sample && predicate(snapshot))
      .sort((a, b) => a.day - b.day)[0]?.day;
    if (day !== undefined) values.push(day);
  }
  return {
    day: values.length === 0 ? null : median(values),
    hits: values.length,
    samples: samples.length,
  };
}

function lateNewUniquesPerDay(report: ProgressionReport, personaId: string): number | null {
  if (!report.days.includes(55) || !report.days.includes(60)) return null;
  const snapshots = rawPersonaSnapshots(report, personaId);
  const values: number[] = [];
  for (const sample of [...new Set(snapshots.map((snapshot) => snapshot.sample))].sort((a, b) => a - b)) {
    const day55 = snapshots.find((snapshot) => snapshot.sample === sample && snapshot.day === 55);
    const day60 = snapshots.find((snapshot) => snapshot.sample === sample && snapshot.day === 60);
    if (day55 && day60) values.push((day60.uniqueCards - day55.uniqueCards) / 5);
  }
  return values.length === 0 ? null : average(values);
}

function personaMetrics(report: ProgressionReport, personaId: string): PersonaMetrics {
  const final = finalAggregate(report, personaId);
  const completion = firstDayFor(
    rawPersonaSnapshots(report, personaId),
    (snapshot) => snapshot.collectionPct >= 1,
  );
  return {
    collectionPct: final.collectionPct,
    firstCompletionDay: completion.day,
    completedSamples: completion.hits,
    totalSamples: completion.samples,
    lateNewUniquesPerDay: lateNewUniquesPerDay(report, personaId),
  };
}

function buildMetrics(report: ProgressionReport, farm: FarmMetrics): SweepMetrics {
  const finalDay = Math.max(...report.days);
  const limitedFan = finalAggregate(report, 'limited-fan');
  const casualNew = finalAggregate(report, 'new-casual');
  const casualLow = finalAggregate(report, 'low-skill-casual');
  const finalRows = report.aggregates.filter((row) => row.day === finalDay);
  const craftedValues = finalRows
    .map((row) => row.craftedUniques)
    .filter((value): value is number => value !== undefined);
  return {
    finalDay,
    limitedFan: {
      premiumRuns: limitedFan.premiumDraftRuns,
      collectionPct: limitedFan.collectionPct,
      firstPremiumDay: firstDayFor(rawPersonaSnapshots(report, 'limited-fan'), (snapshot) => snapshot.premiumDraftRuns > 0).day,
    },
    hardcoreOptimizer: personaMetrics(report, 'hardcore-optimizer'),
    completionist: personaMetrics(report, 'completionist'),
    casualCollectionPct: {
      newCasual: casualNew.collectionPct,
      lowSkillCasual: casualLow.collectionPct,
    },
    allPersonaMedian: {
      packsPerDay: median(finalRows.map((row) => row.packsPerDay)),
      collectionPct: median(finalRows.map((row) => row.collectionPct)),
    },
    craftedUniques: craftedValues.length === 0 ? null : average(craftedValues),
    shardFarm: farm,
  };
}

function plainPlaysetSave() {
  const save = freshSave(0);
  for (const cardId of POOL_CARD_IDS) {
    for (let copy = 0; copy < PLAYSET; copy++) addCard(save, CARD_DB, cardId, PLAIN_VARIANT);
  }
  return save;
}

function farmRunGold(candidate: Candidate): number {
  if (candidate.experiment?.premiumRunGold === 'none') return 0;
  return candidate.experiment?.limitedRunGoldOverride?.[3] ?? ECONOMY.limitedRunGold[3];
}

function shardFarmMetrics(candidate: Candidate): FarmMetrics {
  const template = plainPlaysetSave();
  const returns = PREMIUM_SHARD_FARM_SEEDS.map((seed) => {
    const save = structuredClone(template);
    save.gold = ECONOMY.premiumDraftEntry;
    if (!payPremiumDraftEntry(save)) throw new Error(`Premium entry failed for farm seed ${seed}`);
    let run = startDraftRun(CARD_DB, seed, 1_000, { premium: true });

    while (!run.draft!.completed) {
      const draft = run.draft!;
      const cards = currentDraftPack(draft);
      const variants = draft.currentPackVariants?.[0] ?? [];
      let bestIndex = 0;
      let bestValue = -Infinity;
      for (let index = 0; index < cards.length; index++) {
        const variant = variants[index] ?? PLAIN_VARIANT;
        const isPlain = variant.frame === PLAIN_VARIANT.frame && variant.holo === PLAIN_VARIANT.holo;
        const value = isPlain ? ECONOMY.dupeGold[CARD_DB[cards[index]].rarity] : 0;
        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }
      run = { ...run, draft: pickDraftCard(CARD_DB, draft, cards[bestIndex], bestIndex) };
    }

    const goldBeforeGrant = save.gold;
    const granted = grantPremiumDraftPool(save, CARD_DB, run);
    if (granted.length !== 45) throw new Error(`Farm seed ${seed} granted ${granted.length} cards`);
    run = completeDraftRun(CARD_DB, run);
    for (const cardId of new Set(run.pool)) shardExcess(save, CARD_DB, cardId);
    const realizedGold = save.gold - goldBeforeGrant;
    return realizedGold + farmRunGold(candidate);
  });
  return { meanReturnGold: average(returns), maxReturnGold: Math.max(...returns) };
}

function experimentArgs(experiment: TuningExperimentConfig | undefined): string[] {
  if (!experiment) return [];
  const args: string[] = [];
  if (experiment.cooldownDays !== undefined) args.push('--cooldown-days', String(experiment.cooldownDays));
  if (experiment.weeklyCap !== undefined) args.push('--weekly-cap', String(experiment.weeklyCap));
  if (experiment.limitedRunGoldOverride !== undefined) {
    args.push('--limited-run-gold', experiment.limitedRunGoldOverride.join(','));
  }
  if (experiment.premiumRunGold !== undefined) args.push('--premium-run-gold', experiment.premiumRunGold);
  if (experiment.crafting?.enabled) {
    args.push('--crafting', '--craft-cost-mult', String(experiment.crafting.craftCostMult));
  }
  return args;
}

function childReport(candidate: Candidate, seeds: number, days: readonly number[]): Promise<ProgressionReport> {
  const args = [
    TSX_CLI,
    PROGRESSION_SIM,
    '--seeds',
    String(seeds),
    '--days',
    days.join(','),
    '--base-seed',
    String(BASE_SEED),
    '--json',
    ...experimentArgs(candidate.experiment),
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${candidate.id} progression child exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout) as ProgressionReport);
      } catch (error) {
        reject(new Error(`${candidate.id} emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function consume(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => consume()));
  return results;
}

function targetNotes(row: SweepRow, smoke: boolean): string {
  if (smoke) return 'n/a smoke horizon';
  const metrics = row.metrics;
  const hardcore = row.targets.hardcoreCompletion50To75 ? 'HC 50-75d PASS' : 'HC 50-75d MISS';
  const casual = row.targets.casualNear50 ? 'casual ~50% PASS' : 'casual ~50% MISS';
  const packs =
    row.targets.medianPacksBelowBaseline === null
      ? 'packs vs baseline n/a'
      : row.targets.medianPacksBelowBaseline
        ? 'packs < baseline PASS'
        : 'packs < baseline MISS';
  const farm = row.targets.shardFarmMeanBelowEntry ? 'farm <1000 PASS' : 'farm <1000 MISS';
  return `${hardcore}; ${casual} (${percent(metrics.casualCollectionPct.newCasual)}/${percent(metrics.casualCollectionPct.lowSkillCasual)}); ${packs}; ${farm}`;
}

function renderTable(rows: readonly SweepRow[], smoke: boolean): string {
  const finalDay = rows[0]?.metrics.finalDay ?? (smoke ? SMOKE_DAYS : FULL_DAYS);
  const dayLabel = `d${finalDay}`;
  const lines = [
    `| Candidate | Limited fan (premium runs/${finalDay}d, collection ${dayLabel}, first premium) | Hardcore (collection ${dayLabel}, 100% day, d55-60 uniques/day) | Completionist (collection ${dayLabel}, 100% day, d55-60 uniques/day) | Casual collection ${dayLabel} (new/low) | All-persona median (packs/day, collection ${dayLabel}) | Crafted uniques | Shard-farm return mean/max g | Targets |`,
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const row of rows) {
    const metrics = row.metrics;
    lines.push(
      `| ${row.id} | ${metrics.limitedFan.premiumRuns.toFixed(2)}, ${percent(metrics.limitedFan.collectionPct)}, ${numberOrDash(metrics.limitedFan.firstPremiumDay, 1)} | ${percent(metrics.hardcoreOptimizer.collectionPct)}, ${numberOrDash(metrics.hardcoreOptimizer.firstCompletionDay, 1)} (${metrics.hardcoreOptimizer.completedSamples}/${metrics.hardcoreOptimizer.totalSamples}), ${numberOrDash(metrics.hardcoreOptimizer.lateNewUniquesPerDay, 2)} | ${percent(metrics.completionist.collectionPct)}, ${numberOrDash(metrics.completionist.firstCompletionDay, 1)} (${metrics.completionist.completedSamples}/${metrics.completionist.totalSamples}), ${numberOrDash(metrics.completionist.lateNewUniquesPerDay, 2)} | ${percent(metrics.casualCollectionPct.newCasual)}/${percent(metrics.casualCollectionPct.lowSkillCasual)} | ${metrics.allPersonaMedian.packsPerDay.toFixed(2)}, ${percent(metrics.allPersonaMedian.collectionPct)} | ${numberOrDash(metrics.craftedUniques, 2)} | ${metrics.shardFarm.meanReturnGold.toFixed(1)}/${metrics.shardFarm.maxReturnGold.toFixed(0)} | ${targetNotes(row, smoke)} |`,
    );
  }
  return lines.join('\n');
}

function optionValue(argv: readonly string[], name: string): string | undefined {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const smoke = argv.includes('--smoke');
  const seedsOverride = optionValue(argv, 'seeds');
  const daysOverride = optionValue(argv, 'days');
  const onlyOverride = optionValue(argv, 'only');
  const seeds = seedsOverride !== undefined ? Number(seedsOverride) : smoke ? SMOKE_SEEDS : FULL_SEEDS;
  const maxDay = daysOverride !== undefined ? Number(daysOverride) : smoke ? SMOKE_DAYS : FULL_DAYS;
  if (!Number.isInteger(seeds) || seeds < 1) throw new Error(`--seeds must be a positive integer: ${seedsOverride}`);
  if (!Number.isInteger(maxDay) || maxDay < 1) throw new Error(`--days must be a positive integer: ${daysOverride}`);
  const days = Array.from({ length: maxDay }, (_, index) => index + 1);
  let candidates = smoke ? CANDIDATES.slice(0, 2) : CANDIDATES;
  if (onlyOverride !== undefined) {
    const wanted = onlyOverride.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
    const known = new Set(CANDIDATES.map((candidate) => candidate.id));
    const unknown = wanted.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`Unknown candidate id(s): ${unknown.join(', ')}`);
    // BASELINE always rides along so relative targets stay meaningful.
    const ids = new Set(['BASELINE', ...wanted]);
    candidates = CANDIDATES.filter((candidate) => ids.has(candidate.id));
  }
  const out = resolve(optionValue(argv, 'out') ?? join(tmpdir(), 'darlingblades-tuning-sweep.json'));

  const reports = await mapWithConcurrency(candidates, CHILD_CONCURRENCY, (candidate) =>
    childReport(candidate, seeds, days),
  );
  const allMetrics = candidates.map((candidate, index) =>
    buildMetrics(reports[index], shardFarmMetrics(candidate)),
  );
  // Compare pack generosity against THIS sweep's own BASELINE row, not a
  // hardcoded historical constant (which drifts with seeds/config).
  const baselineIndex = candidates.findIndex((candidate) => candidate.id === 'BASELINE');
  const baselinePacksPerDay =
    baselineIndex >= 0 ? allMetrics[baselineIndex].allPersonaMedian.packsPerDay : null;
  const rows: SweepRow[] = candidates.map((candidate, index) => {
    const metrics = allMetrics[index];
    // A completion-window PASS requires the majority of seeds to actually
    // complete inside the horizon (survivorship-bias guard); a median over
    // one lucky seed is not a pass.
    const hardcore = metrics.hardcoreOptimizer;
    const majorityCompleted = hardcore.completedSamples * 2 > hardcore.totalSamples;
    return {
      id: candidate.id,
      ...(candidate.experiment ? { experiment: candidate.experiment } : {}),
      metrics,
      targets: {
        hardcoreCompletion50To75: smoke
          ? null
          : majorityCompleted &&
            hardcore.firstCompletionDay !== null &&
            hardcore.firstCompletionDay >= 50 &&
            hardcore.firstCompletionDay <= 75,
        casualNear50: smoke
          ? null
          : Math.abs(
              average([
                metrics.casualCollectionPct.newCasual,
                metrics.casualCollectionPct.lowSkillCasual,
              ]) - 0.5,
            ) <= 0.1,
        medianPacksBelowBaseline:
          smoke || baselinePacksPerDay === null
            ? null
            : candidate.id === 'BASELINE'
              ? null
              : metrics.allPersonaMedian.packsPerDay < baselinePacksPerDay,
        shardFarmMeanBelowEntry: metrics.shardFarm.meanReturnGold < ECONOMY.premiumDraftEntry,
      },
    };
  });
  const markdown = renderTable(rows, smoke);
  const payload: SweepOutput = { seeds, days, childConcurrency: CHILD_CONCURRENCY, rows, markdown };
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(markdown);
  console.log(`\nJSON: ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
