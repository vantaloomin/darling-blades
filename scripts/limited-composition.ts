/**
 * Seeded Limited composition and reserve-native deck-shape measurement.
 *
 * Usage:
 *   npx tsx scripts/limited-composition.ts --packs 200 --seed 20260822
 *   npx tsx scripts/limited-composition.ts --packs 200 --seed 20260822 --json
 *
 * Free packs use the public Limited roller. Premium packs are collected from
 * the real startBotDraft roller in 24-pack blocks because the premium roller
 * also rolls its presentation variants. The bot sample uses the same
 * startBotDraft + pickDraftCard loop used by the Limited tests.
 */
import { ECONOMY } from '../src/config/rules';
import { ALL_CARDS, CARD_DB } from '../src/data/catalog';
import { DARK_TALES_COMPANION } from '../src/data/cards/dark-tales-companion';
import { isLiveCollectible } from '../src/data/liveness';
import { manaValue, type CardDef, type CardDb, type Rarity } from '../src/engine/types';
import {
  addCard,
  PLAYSET,
  shardExcess,
} from '../src/meta/Collection';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  grantPremiumDraftPool,
  pickDraftCard,
  limitedLandReserve,
  rollLimitedPack,
  startDraftRun,
  startBotDraft,
} from '../src/meta/Limited';
import { payPremiumDraftEntry } from '../src/meta/Economy';
import { collectiblePool } from '../src/meta/collectionFilter';
import { packPool } from '../src/meta/PackOpener';
import { freshSave } from '../src/meta/SaveManager';
import { isPlainVariant, PLAIN_VARIANT } from '../src/meta/variants';
import { isBasicLand, isDualLand } from '../src/meta/warchest';

const DEFAULT_PACKS = 200;
const DEFAULT_SEED = 20260822;
const BOT_DRAFT_SEEDS = 20;
const BOT_SEED_OFFSET = 0x10000;
const PREMIUM_SHARD_FARM_SEEDS = Array.from({ length: 50 }, (_, i) => 1000 + i * 7919);
const RARITIES: readonly Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
const CURVE_BUCKETS = ['0', '1', '2', '3', '4', '5+'] as const;
const SHARD_FARM_ENTRY = ECONOMY.premiumDraftEntry;

type CountMap = Record<string, number>;

interface DistributionRow {
  count: number;
  share: number;
}

interface SetRow extends DistributionRow {
  livePool: number;
  livePoolShare: number;
  pickToPoolRatio: number;
}

interface CompositionSummary {
  packs: number;
  picks: number;
  bySet: Record<string, SetRow>;
  byRarity: Record<string, DistributionRow>;
  byType: Record<string, DistributionRow>;
  lands: DistributionRow;
  unplayableReserveLands: DistributionRow & { ids: string[] };
}

interface BotDeckShape {
  seeds: number;
  seats: number;
  decks: number;
  colorCountDistribution: Record<string, DistributionRow>;
  averageManaValue: number;
  spellsPerCurveBucket: Record<string, number>;
  draftedDualsInWarchest: {
    average: number;
    distribution: Record<string, DistributionRow>;
  };
}

interface ShardFarmMeasurement {
  sourceAssertion: 'tests/meta/exploits.test.ts:253-310';
  seeds: number;
  seedFormula: string;
  entryGold: number;
  meanKeptCardShardGold: number;
  maxKeptCardShardGold: number;
  cushionGold: number;
  cushionPercent: number;
  passed: boolean;
}

interface MeasurementReport {
  command: string;
  seed: number;
  liveCollectibleCount: number;
  catalogCollectibleCount: number;
  packableLiveCollectibleCount: number;
  duatLive: boolean;
  companionGated: boolean;
  packs: number;
  free: CompositionSummary;
  premium: CompositionSummary;
  botDraft: {
    seedFormula: string;
    free: BotDeckShape;
    premium: BotDeckShape;
  };
  premiumShardFarm: ShardFarmMeasurement;
}

function parseArgs(argv: readonly string[]): { packs: number; seed: number; json: boolean } {
  const value = (name: string): string | undefined => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline !== undefined) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
  };
  const packs = Number(value('packs') ?? DEFAULT_PACKS);
  const seed = Number(value('seed') ?? DEFAULT_SEED);
  if (!Number.isInteger(packs) || packs <= 0) throw new Error(`--packs must be a positive integer: ${packs}`);
  if (!Number.isInteger(seed) || seed <= 0) throw new Error(`--seed must be a positive integer: ${seed}`);
  return { packs, seed, json: argv.includes('--json') };
}

function share(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function increment(map: CountMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function distribution(counts: CountMap, total: number, keys?: readonly string[]): Record<string, DistributionRow> {
  const order = keys ?? Object.keys(counts).sort();
  return Object.fromEntries(order.map((key) => [key, { count: counts[key] ?? 0, share: share(counts[key] ?? 0, total) }]));
}

function cardSet(card: CardDef): string {
  return String(card.set ?? 'base');
}

function summarizeComposition(db: CardDb, packs: readonly string[][], livePool: readonly CardDef[]): CompositionSummary {
  const picks = packs.flat();
  const total = picks.length;
  const setCounts: CountMap = {};
  const rarityCounts: CountMap = {};
  const typeCounts: CountMap = {};
  let landCount = 0;
  let unplayableCount = 0;
  const unplayableIds = new Set<string>();

  for (const id of picks) {
    const card = db[id];
    if (!card) throw new Error(`Pack roller returned unknown card ${id}`);
    increment(setCounts, cardSet(card));
    increment(rarityCounts, card.rarity);
    increment(typeCounts, card.types.join('/'));
    if (card.types.includes('land')) {
      landCount++;
      if (!isBasicLand(card) && !isDualLand(card)) {
        unplayableCount++;
        unplayableIds.add(id);
      }
    }
  }

  const liveCounts: CountMap = {};
  for (const card of livePool) increment(liveCounts, cardSet(card));
  const bySet = Object.fromEntries(
    Object.keys(liveCounts).sort().map((set) => {
      const count = setCounts[set] ?? 0;
      const livePoolCount = liveCounts[set] ?? 0;
      return [set, {
        count,
        share: share(count, total),
        livePool: livePoolCount,
        livePoolShare: share(livePoolCount, livePool.length),
        pickToPoolRatio: livePoolCount === 0 ? 0 : share(count, total) / share(livePoolCount, livePool.length),
      } satisfies SetRow];
    }),
  ) as Record<string, SetRow>;

  return {
    packs: packs.length,
    picks: total,
    bySet,
    byRarity: distribution(rarityCounts, total, RARITIES),
    byType: distribution(typeCounts, total),
    lands: { count: landCount, share: share(landCount, total) },
    unplayableReserveLands: {
      count: unplayableCount,
      share: share(unplayableCount, total),
      ids: [...unplayableIds].sort(),
    },
  };
}

function freePacks(db: CardDb, packs: number, seed: number): string[][] {
  // The public roller owns its own seeded stream. The incremented seed keeps
  // this batch repeatable without reaching into Limited's private RNG helper.
  return Array.from({ length: packs }, (_, index) => rollLimitedPack(db, seed + index));
}

function premiumPacks(db: CardDb, packs: number, seed: number): string[][] {
  const out: string[][] = [];
  let block = 0;
  while (out.length < packs) {
    const draft = startBotDraft(db, seed + block, { premium: true });
    for (const round of draft.packs) {
      for (const pack of round) {
        out.push(pack);
        if (out.length >= packs) return out;
      }
    }
    block++;
  }
  return out;
}

function curveBucket(value: number): typeof CURVE_BUCKETS[number] {
  return value >= 5 ? '5+' : String(Math.max(0, value)) as typeof CURVE_BUCKETS[number];
}

function summarizeBotDecks(db: CardDb, seed: number, premium: boolean): BotDeckShape {
  const colorCounts: CountMap = {};
  const curveTotals: CountMap = Object.fromEntries(CURVE_BUCKETS.map((key) => [key, 0]));
  const dualCounts: CountMap = {};
  let manaTotal = 0;
  let deckCount = 0;

  for (let sample = 0; sample < BOT_DRAFT_SEEDS; sample++) {
    let draft = startBotDraft(db, seed + BOT_SEED_OFFSET + sample, premium ? { premium: true } : {});
    while (!draft.completed) {
      const pack = currentDraftPack(draft);
      if (pack.length === 0) throw new Error('Bot draft exposed an empty player pack');
      draft = pickDraftCard(db, draft, pack[0], 0);
    }

    for (const pool of draft.picks) {
      const deck = buildLimitedDeck(db, pool);
      const reserve = limitedLandReserve(db, deck, pool);
      const colors = new Set<string>();
      const curve: CountMap = Object.fromEntries(CURVE_BUCKETS.map((key) => [key, 0]));
      for (const id of deck) {
        const card = db[id];
        if (!card) throw new Error(`Auto-builder returned unknown card ${id}`);
        for (const color of card.colors) colors.add(color);
        manaTotal += manaValue(card.cost);
        curve[curveBucket(manaValue(card.cost))]++;
      }
      increment(colorCounts, String(colors.size));
      const duals = reserve.filter((id) => db[id] !== undefined && isDualLand(db[id])).length;
      increment(dualCounts, String(duals));
      for (const key of CURVE_BUCKETS) curveTotals[key] += curve[key];
      deckCount++;
    }
  }

  return {
    seeds: BOT_DRAFT_SEEDS,
    seats: 8,
    decks: deckCount,
    colorCountDistribution: distribution(colorCounts, deckCount, ['0', '1', '2', '3', '4', '5']),
    averageManaValue: deckCount === 0 ? 0 : manaTotal / (deckCount * 25),
    spellsPerCurveBucket: Object.fromEntries(CURVE_BUCKETS.map((key) => [key, deckCount === 0 ? 0 : curveTotals[key] / deckCount])),
    draftedDualsInWarchest: {
      average: deckCount === 0 ? 0 : Object.entries(dualCounts).reduce((sum, [key, count]) => sum + Number(key) * count, 0) / deckCount,
      distribution: distribution(dualCounts, deckCount, ['0', '1', '2', '3', '4', '5']),
    },
  };
}

function plainPlaysetSave(db: CardDb): ReturnType<typeof freshSave> {
  const save = freshSave(0);
  // Match the source assertion's finished collector: every card that the real
  // mixed-set pack pool can roll, including playable dual lands.
  const poolCardIds = [...new Set(RARITIES.flatMap((tier) => packPool(db, tier)))];
  for (const cardId of poolCardIds) {
    for (let copy = 0; copy < PLAYSET; copy++) addCard(save, db, cardId, PLAIN_VARIANT);
  }
  return save;
}

function premiumShardFarm(db: CardDb): ShardFarmMeasurement {
  const template = plainPlaysetSave(db);
  const returns = PREMIUM_SHARD_FARM_SEEDS.map((seed) => {
    const save = structuredClone(template);
    save.gold = SHARD_FARM_ENTRY;
    if (!payPremiumDraftEntry(save, '2026-08-22')) throw new Error(`Premium entry failed for seed ${seed}`);
    const run = startDraftRun(db, seed, 1_000, { premium: true });
    let draft = run.draft;
    if (!draft) throw new Error(`Premium draft missing draft state for seed ${seed}`);
    while (!draft.completed) {
      const cards = currentDraftPack(draft);
      const variants = draft.currentPackVariants?.[0] ?? [];
      let bestIndex = 0;
      let bestValue = -Infinity;
      for (let index = 0; index < cards.length; index++) {
        const variant = variants[index] ?? PLAIN_VARIANT;
        const value = isPlainVariant(variant) ? ECONOMY.dupeGold[db[cards[index]].rarity] : 0;
        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }
      draft = pickDraftCard(db, draft, cards[bestIndex], bestIndex);
    }

    const goldBeforeGrant = save.gold;
    const granted = grantPremiumDraftPool(save, db, { ...run, draft });
    if (granted.length !== 45) throw new Error(`Premium seed ${seed} granted ${granted.length} cards`);
    const completed = completeDraftRun(db, { ...run, draft });
    for (const cardId of new Set(completed.pool)) shardExcess(save, db, cardId);
    return save.gold - goldBeforeGrant;
  });
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const max = Math.max(...returns);
  const cushion = SHARD_FARM_ENTRY - mean;
  return {
    sourceAssertion: 'tests/meta/exploits.test.ts:253-310',
    seeds: returns.length,
    seedFormula: '1000 + i * 7919, i=0..49',
    entryGold: SHARD_FARM_ENTRY,
    meanKeptCardShardGold: mean,
    maxKeptCardShardGold: max,
    cushionGold: cushion,
    cushionPercent: cushion / SHARD_FARM_ENTRY,
    passed: mean < SHARD_FARM_ENTRY,
  };
}

function buildReport(packs: number, seed: number): MeasurementReport {
  const catalogCollectible = ALL_CARDS.filter((card) => !card.token && !card.supertypes?.includes('basic'));
  const livePool = ALL_CARDS.filter(isLiveCollectible);
  const packableLivePool = collectiblePool(ALL_CARDS);
  const liveIds = new Set(livePool.map((card) => card.id));
  const free = freePacks(CARD_DB, packs, seed);
  const premium = premiumPacks(CARD_DB, packs, seed);
  return {
    command: `npx tsx scripts/limited-composition.ts --packs ${packs} --seed ${seed}`,
    seed,
    liveCollectibleCount: livePool.length,
    catalogCollectibleCount: catalogCollectible.length,
    packableLiveCollectibleCount: packableLivePool.length,
    duatLive: livePool.some((card) => cardSet(card) === 'sands-of-the-duat'),
    companionGated: DARK_TALES_COMPANION.every((card) => !liveIds.has(card.id)),
    packs,
    free: summarizeComposition(CARD_DB, free, livePool),
    premium: summarizeComposition(CARD_DB, premium, livePool),
    botDraft: {
      seedFormula: `${seed + BOT_SEED_OFFSET} + sample, sample=0..${BOT_DRAFT_SEEDS - 1}`,
      free: summarizeBotDecks(CARD_DB, seed, false),
      premium: summarizeBotDecks(CARD_DB, seed, true),
    },
    premiumShardFarm: premiumShardFarm(CARD_DB),
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function printDistribution(title: string, rows: Record<string, DistributionRow>): void {
  console.log(title);
  for (const [key, row] of Object.entries(rows)) console.log(`  ${key.padEnd(18)} ${String(row.count).padStart(5)}  ${percent(row.share)}`);
}

function printComposition(label: string, summary: CompositionSummary): void {
  console.log(`\n${label}: ${summary.packs} packs, ${summary.picks} picks`);
  console.log('  Set                 Picks  Pick share  Live pool  Pool share  Pick/pool');
  for (const [set, row] of Object.entries(summary.bySet)) {
    console.log(`  ${set.padEnd(19)} ${String(row.count).padStart(5)}  ${percent(row.share).padStart(10)}  ${String(row.livePool).padStart(9)}  ${percent(row.livePoolShare).padStart(10)}  ${row.pickToPoolRatio.toFixed(3)}x`);
  }
  printDistribution('  Rarity', summary.byRarity);
  printDistribution('  Card type', summary.byType);
  console.log(`  Lands of any kind: ${summary.lands.count}/${summary.picks} (${percent(summary.lands.share)})`);
  console.log(`  Unplayable reserve-native lands: ${summary.unplayableReserveLands.count}/${summary.picks} (${percent(summary.unplayableReserveLands.share)})${summary.unplayableReserveLands.ids.length ? ` ids=${summary.unplayableReserveLands.ids.join(',')}` : ''}`);
}

function printBot(label: string, shape: BotDeckShape): void {
  console.log(`\n${label} bot decks: ${shape.seeds} seeds x ${shape.seats} seats = ${shape.decks} auto-built decks`);
  console.log(`  Colour-count distribution: ${Object.entries(shape.colorCountDistribution).map(([key, row]) => `${key}:${row.count} (${percent(row.share)})`).join(', ')}`);
  console.log(`  Average mana value/card: ${shape.averageManaValue.toFixed(3)}`);
  console.log(`  Average spells/curve bucket (0,1,2,3,4,5+): ${CURVE_BUCKETS.map((key) => `${key}=${shape.spellsPerCurveBucket[key].toFixed(3)}`).join(', ')}`);
  console.log(`  Drafted duals in 10-land Warchest: avg=${shape.draftedDualsInWarchest.average.toFixed(3)}; ${Object.entries(shape.draftedDualsInWarchest.distribution).map(([key, row]) => `${key}:${row.count} (${percent(row.share)})`).join(', ')}`);
}

function printReport(report: MeasurementReport): void {
  console.log(`LIMITED COMPOSITION MEASUREMENT\nCommand: ${report.command}\nLive collectible via isLiveCollectible: ${report.liveCollectibleCount}; catalog collectible: ${report.catalogCollectibleCount}; packable live pool after utility-tapland exclusion: ${report.packableLiveCollectibleCount}\nDuat live: ${report.duatLive}; Dark Tales companion gated: ${report.companionGated}`);
  printComposition('FREE', report.free);
  printComposition('PREMIUM', report.premium);
  printBot('FREE', report.botDraft.free);
  printBot('PREMIUM', report.botDraft.premium);
  const farm = report.premiumShardFarm;
  console.log(`\nPREMIUM SHARD-FARM GUARD (${farm.sourceAssertion}; ${farm.seeds} seeds; ${farm.seedFormula})`);
  console.log(`  Mean kept-card shard gold: ${farm.meanKeptCardShardGold.toFixed(3)}g; max=${farm.maxKeptCardShardGold.toFixed(3)}g; entry=${farm.entryGold}g`);
  console.log(`  Cushion: ${farm.cushionGold.toFixed(3)}g (${percent(farm.cushionPercent)}); gate=${farm.passed ? 'PASS' : 'FAIL'}`);
}

function main(): void {
  try {
    const { packs, seed, json } = parseArgs(process.argv.slice(2));
    const report = buildReport(packs, seed);
    if (json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
