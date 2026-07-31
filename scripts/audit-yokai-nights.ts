import fs from 'node:fs';
import { ALL_CARDS, CARD_DB } from '../src/data/catalog';
import { YOKAI_SPEC_ROWS } from '../src/data/cards/yokai-nights';
import { validateHauntlinkDef, type CardDef, type ManaCost } from '../src/engine/types';

interface SpecRow {
  id: string;
  name: string;
  rarity: string;
  color: string;
  type: string;
  cost: string;
  stats: string;
  mechanics: string;
  flavor: string;
}

const root = process.cwd();
const specRows = fs
  .readFileSync(`${root}/docs/expansions/yokai-nights.md`, 'utf8')
  .split(/\r?\n/)
  .filter((line) => /^\| yn-/.test(line))
  .map((line) => {
    const fields = line.slice(1, -1).split('|').map((field) => field.trim());
    if (fields.length !== 9) throw new Error(`Bad row shape: ${line}`);
    const [id, name, rarity, color, type, cost, stats, mechanics, flavor] = fields;
    return { id, name, rarity, color, type, cost, stats, mechanics, flavor } satisfies SpecRow;
  });

const failures: string[] = [];
const check = (condition: boolean, message: string): void => {
  if (!condition) failures.push(message);
};

function actualCost(cost: ManaCost | undefined): string {
  if (!cost) return 'none';
  const symbols = Object.entries(cost.pips)
    .flatMap(([color, count]) => Array.from({ length: count ?? 0 }, () => `{${color}}`));
  return `${cost.generic ? `{${cost.generic}}` : ''}${symbols.join('')}` || 'none';
}

function actualType(card: CardDef): string {
  const title = card.types[0].charAt(0).toUpperCase() + card.types[0].slice(1);
  const legendary = card.supertypes?.includes('legendary') ? 'Legendary ' : '';
  const subtype = card.subtypes.length ? ` (${card.subtypes.join(' ')})` : '';
  return `${legendary}${title}${subtype}`;
}

function actualStats(card: CardDef): string {
  return card.attack === undefined ? '-' : `${card.attack}/${card.defense}`;
}

function actualColor(card: CardDef): string {
  return card.types.includes('land') ? (card.manaAbility ?? []).join('/') : card.colors.join('/');
}

const sourceRows = YOKAI_SPEC_ROWS.map((row) => ({ ...row }));
check(specRows.length === 120, `spec row count ${specRows.length}, expected 120`);
check(sourceRows.length === specRows.length, `source row count ${sourceRows.length}, spec ${specRows.length}`);
check(JSON.stringify(sourceRows) === JSON.stringify(specRows), 'source rows drift from docs/expansions/yokai-nights.md');
check(new Set(specRows.map((row) => row.id)).size === specRows.length, 'duplicate ids in spec rows');

for (const row of specRows) {
  const card = CARD_DB[row.id];
  check(Boolean(card), `${row.id} missing from CARD_DB`);
  if (!card) continue;
  check(String(card.set) === 'yokai-nights', `${row.id} set is ${String(card.set)}`);
  check(card.name === row.name, `${row.id} name drift`);
  check(card.rarity.toUpperCase() === row.rarity, `${row.id} rarity drift`);
  check(actualCost(card.cost) === row.cost, `${row.id} cost drift: ${actualCost(card.cost)} vs ${row.cost}`);
  check(actualStats(card) === row.stats, `${row.id} stats drift`);
  check(actualColor(card) === row.color, `${row.id} color drift`);
  check(actualType(card) === row.type, `${row.id} type/subtype drift: ${actualType(card)} vs ${row.type}`);
  check(card.flavor === row.flavor, `${row.id} flavor drift`);
}

const yokai = ALL_CARDS.filter((card) => String(card.set) === 'yokai-nights');
const collectible = ALL_CARDS.filter((card) => !card.token && !card.supertypes?.includes('basic'));
const rarityCounts = Object.fromEntries(
  (['c', 'r', 'sr', 'ssr', 'ur'] as const).map((rarity) => [rarity, yokai.filter((card) => card.rarity === rarity).length]),
);
const answerRows = specRows.filter((row) => row.mechanics.includes('[ANSWER:')).length;
const hauntlink = yokai.filter((card) => card.hauntlink);
const hauntlinkErrors = hauntlink.flatMap((card) => validateHauntlinkDef(card).map((error) => `${card.id}: ${error}`));
const dualLands = yokai.filter((card) => card.types.includes('land'));
const tokens = yokai.filter((card) => card.token);
const humanSpecies = yokai.filter(
  (card) => card.subtypes.includes('Human') && card.subtypes.some((subtype) => ['Kitsune', 'Oni', 'Yokai', 'Tanuki', 'Kappa', 'Dryad', 'Spirit'].includes(subtype)),
);

check(yokai.length === 120, `CARD_DB Yokai count ${yokai.length}, expected 120`);
check(JSON.stringify(rarityCounts) === JSON.stringify({ c: 60, r: 36, sr: 11, ssr: 8, ur: 5 }), `rarity counts ${JSON.stringify(rarityCounts)}`);
check(answerRows === 7, `ANSWER rows ${answerRows}, expected 7`);
check(hauntlink.length === 13, `Hauntlink carriers ${hauntlink.length}, expected 13`);
check(hauntlinkErrors.length === 0, `Hauntlink validation: ${hauntlinkErrors.join('; ')}`);
check(tokens.length === 0, `Yokai tokens ${tokens.length}, expected 0 per set doc`);
check(dualLands.length === 5, `dual lands ${dualLands.length}, expected 5`);
check(humanSpecies.length === 0, `Human cards with yokai species subtype: ${humanSpecies.map((card) => card.id).join(', ')}`);
// Re-dated 2026-07-31 post balance pass: 758 at Yokai launch plus exactly the
// pass's 6 additions (Ember Squall + Creeping Malaise + Yang Huiyu + Sable
// into base, Moundlight Midwife into celtic-fae, Porcelain Governess into
// gothic-monsters) = 764 under this script's collectible definition, which
// excludes tokens AND the 5 basic lands.
check(collectible.length === 764, `collectible pool ${collectible.length}, expected 764`);

console.table([
  { check: 'Rows transcribed', result: `${sourceRows.length}/${specRows.length}`, status: sourceRows.length === specRows.length && failures.every((failure) => !failure.includes('drift')) ? 'PASS' : 'FAIL' },
  { check: 'Identity drift', result: failures.filter((failure) => failure.includes('drift')).length, status: failures.some((failure) => failure.includes('drift')) ? 'FAIL' : 'PASS' },
  { check: 'Rarity counts', result: `60C / 36R / 11SR / 8SSR / 5UR`, status: JSON.stringify(rarityCounts) === JSON.stringify({ c: 60, r: 36, sr: 11, ssr: 8, ur: 5 }) ? 'PASS' : 'FAIL' },
  { check: 'ANSWER slots', result: `${answerRows}/7`, status: answerRows === 7 ? 'PASS' : 'FAIL' },
  { check: 'Hauntlink carriers', result: `${hauntlink.length}/13, ${hauntlinkErrors.length} S4 errors`, status: hauntlink.length === 13 && hauntlinkErrors.length === 0 ? 'PASS' : 'FAIL' },
  { check: 'Set-unique tokens', result: `${tokens.length} (doc says none)`, status: tokens.length === 0 ? 'PASS' : 'FAIL' },
  { check: 'Collectible pool', result: `638 -> ${collectible.length} (+${collectible.length - 638})`, status: collectible.length === 764 ? 'PASS' : 'FAIL' },
]);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Yokai Nights audit: PASS, zero drift.');
}
