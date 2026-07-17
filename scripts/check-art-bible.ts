/**
 * Art-bible coverage/consistency check (docs/art-bible/ vs the card catalog).
 * Verifies that every creature + token id in CARD_DB has exactly one entry in
 * the right faction file, in source-file order; that every entry carries all
 * 13 template fields from index.md in order; that the Card-facts line agrees
 * with the card data (cost, colors, P/T, keywords, rarity, legendary);
 * and that every Prompt ends with the standard suffix. Exits 1 on any failure.
 * Run via `npm run check-art-bible`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACTS } from '../src/data/cards/artifacts';
import { ARTHURIAN_COURT } from '../src/data/cards/arthurian-court';
import { BEASTKIN } from '../src/data/cards/beastkin';
import { CELTIC_FAE } from '../src/data/cards/celtic-fae';
import { GREEK } from '../src/data/cards/greek';
import { RAGNAROK } from '../src/data/cards/ragnarok';
import { TK_JIN } from '../src/data/cards/tk-jin';
import { TK_OTHER } from '../src/data/cards/tk-other';
import { TK_SHU } from '../src/data/cards/tk-shu';
import { TK_WEI } from '../src/data/cards/tk-wei';
import { TK_WU } from '../src/data/cards/tk-wu';
import { TOKENS } from '../src/data/cards/tokens';
import type { CardDef } from '../src/data/cardTypes';
import { ALL_CARDS, CARD_DB } from '../src/data/catalog';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Optional alternate directory argument, so the checker can be exercised
// against a scratch copy without touching the real files.
const bibleDir = process.argv[2] ? resolve(process.argv[2]) : join(root, 'docs', 'art-bible');

const isCreature = (c: CardDef) => c.types.includes('creature');

/** Which faction file covers which set file(s), in entry order. */
const FILE_MAP: { file: string; sets: readonly (readonly CardDef[])[] }[] = [
  { file: 'tk-wei.md', sets: [TK_WEI] },
  { file: 'tk-wu.md', sets: [TK_WU] },
  { file: 'tk-shu.md', sets: [TK_SHU] },
  { file: 'tk-jin.md', sets: [TK_JIN] },
  { file: 'tk-other.md', sets: [TK_OTHER] },
  { file: 'greek.md', sets: [GREEK] },
  { file: 'beastkin.md', sets: [BEASTKIN] },
  { file: 'ragnarok.md', sets: [RAGNAROK] },
  { file: 'celtic-fae.md', sets: [CELTIC_FAE] },
  { file: 'arthurian-court.md', sets: [ARTHURIAN_COURT] },
  { file: 'constructs-and-tokens.md', sets: [ARTIFACTS, TOKENS] },
];

/** The 13 template fields from index.md §8, exact labels, exact order. */
const FIELDS = [
  'Card facts',
  'Character & source',
  'Personality / mood',
  'Pose & composition',
  'Costume & attire',
  'Palette',
  'Lighting',
  'Expression',
  'Props / weapon',
  'Background',
  'Holo interaction',
  'Rarity ambition',
  'Prompt',
] as const;

const PROMPT_SUFFIX = '— crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait';

// --- entry parsing -----------------------------------------------------------

interface Entry {
  name: string;
  id: string;
  line: number;
  fields: { label: string; text: string }[];
}

function parseEntries(content: string): Entry[] {
  const entries: Entry[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^### (.+?) — `([^`]+)`\s*$/);
    if (heading) {
      entries.push({ name: heading[1], id: heading[2], line: i + 1, fields: [] });
      continue;
    }
    const field = lines[i].match(/^- \*\*(.+?):\*\* ?(.*)$/);
    if (field && entries.length > 0) {
      entries[entries.length - 1].fields.push({ label: field[1], text: field[2].trim() });
    }
  }
  return entries;
}

// --- Card-facts parsing ------------------------------------------------------

interface Facts {
  cost?: { generic: number; pips: Record<string, number> };
  pt?: string;
  keywords: string[];
  rarity?: string;
  legendary: boolean;
  colors?: { letters: string[]; gold: boolean };
  holo?: string;
  unrecognized: string[];
}

function parseFacts(text: string): Facts {
  const facts: Facts = { keywords: [], legendary: false, unrecognized: [] };
  for (const seg of text.split(' · ').map((s) => s.trim())) {
    if (/^(\{[0-9WUBRG]+\})+$/.test(seg)) {
      const cost = { generic: 0, pips: {} as Record<string, number> };
      for (const [, tok] of seg.matchAll(/\{([0-9WUBRG]+)\}/g)) {
        if (/^\d+$/.test(tok)) cost.generic += Number(tok);
        else for (const ch of tok) cost.pips[ch] = (cost.pips[ch] ?? 0) + 1;
      }
      facts.cost = cost;
    } else if (/^\d+\/\d+$/.test(seg)) {
      facts.pt = seg;
    } else if (/^(c|r|sr|ssr|ur)(, legendary)?$/.test(seg)) {
      facts.rarity = seg.split(',')[0];
      facts.legendary = seg.includes('legendary');
    } else if (seg.startsWith('holo:')) {
      facts.holo = seg.slice('holo:'.length).trim();
    } else if (/^([WUBRG](\/[WUBRG])*( \(gold frame\))?|C)$/.test(seg)) {
      facts.colors = {
        letters: seg.replace(' (gold frame)', '').split('/'),
        gold: seg.includes('(gold frame)'),
      };
    } else if (/^[a-z][a-zA-Z]*(, [a-z][a-zA-Z]*)*$/.test(seg)) {
      facts.keywords = seg.split(', ');
    } else {
      facts.unrecognized.push(seg);
    }
  }
  return facts;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

function checkFacts(card: CardDef, facts: Facts, err: (msg: string) => void): void {
  for (const seg of facts.unrecognized) err(`Card facts: unrecognized segment "${seg}"`);

  const cost = card.cost ?? { generic: 0, pips: {} };
  if (!facts.cost) err('Card facts: missing cost segment');
  else {
    const pipsMatch =
      sameSet(Object.keys(facts.cost.pips), Object.keys(cost.pips)) &&
      Object.entries(cost.pips).every(([c, n]) => facts.cost?.pips[c] === n);
    if (facts.cost.generic !== cost.generic || !pipsMatch) {
      err(`Card facts: cost disagrees with data (generic ${cost.generic}, pips ${JSON.stringify(cost.pips)})`);
    }
  }

  const pt = `${card.attack}/${card.defense}`;
  if (facts.pt !== pt) err(`Card facts: P/T "${facts.pt ?? 'missing'}" ≠ data "${pt}"`);

  if (facts.rarity !== card.rarity) {
    err(`Card facts: rarity "${facts.rarity ?? 'missing'}" ≠ data "${card.rarity}"`);
  }
  const legendary = card.supertypes?.includes('legendary') ?? false;
  if (facts.legendary !== legendary) {
    err(`Card facts: legendary flag ${facts.legendary} ≠ data ${legendary}`);
  }

  if (!sameSet(facts.keywords, card.keywords ?? [])) {
    err(`Card facts: keywords [${facts.keywords.join(', ')}] ≠ data [${(card.keywords ?? []).join(', ')}]`);
  }

  const expectedLetters = card.colors.length > 0 ? card.colors : ['C'];
  if (!facts.colors) err('Card facts: missing colors segment');
  else if (
    !sameSet(facts.colors.letters, expectedLetters) ||
    facts.colors.gold !== card.colors.length >= 2
  ) {
    err(`Card facts: colors "${facts.colors.letters.join('/')}" ≠ data "${expectedLetters.join('/')}"`);
  }

  // Holo is no longer derived from rarity: per-copy holo variants (wave 2) supersede signature holo.
}

// --- the check ---------------------------------------------------------------

const errors: string[] = [];
const seen = new Map<string, string>(); // id → file it appeared in
let entryCount = 0;

for (const { file, sets } of FILE_MAP) {
  const expected = sets.flatMap((s) => s.filter(isCreature).map((c) => c.id));
  const expectedSet = new Set(expected);
  const err = (msg: string) => errors.push(`${file}: ${msg}`);

  const entries = parseEntries(readFileSync(join(bibleDir, file), 'utf8'));
  entryCount += entries.length;
  const found = entries.map((e) => e.id);

  if (found.length !== expected.length) {
    err(`entry count ${found.length} ≠ ${expected.length} creatures in source data`);
  }
  for (const id of expected) {
    if (!found.includes(id)) err(`missing entry for \`${id}\``);
  }

  for (const entry of entries) {
    const where = `\`${entry.id}\` (line ${entry.line})`;
    const prev = seen.get(entry.id);
    if (prev) errors.push(`${file}: duplicate entry for ${where} — already in ${prev}`);
    else seen.set(entry.id, file);

    if (!expectedSet.has(entry.id)) {
      const card = CARD_DB[entry.id] as CardDef | undefined;
      err(`unexpected entry ${where}${card ? ' — belongs to another file or is not a creature/token' : ' — unknown card id'}`);
      continue;
    }

    // All 13 fields, exact labels, exact order.
    const labels = entry.fields.map((f) => f.label);
    if (labels.join('|') !== FIELDS.join('|')) {
      const missing = FIELDS.filter((f) => !labels.includes(f));
      const extra = labels.filter((l) => !(FIELDS as readonly string[]).includes(l));
      if (missing.length > 0) err(`${where}: missing field(s): ${missing.join(', ')}`);
      if (extra.length > 0) err(`${where}: unknown field label(s): ${extra.join(', ')}`);
      if (missing.length === 0 && extra.length === 0) err(`${where}: fields out of template order`);
    }

    // Typographic vs ASCII apostrophes in headings are noise, not drift.
    const plain = (s: string) => s.replace(/’/g, "'");
    const card = CARD_DB[entry.id];
    if (plain(entry.name) !== plain(card.name)) {
      err(`${where}: heading name "${entry.name}" ≠ card name "${card.name}"`);
    }
    const factsField = entry.fields.find((f) => f.label === 'Card facts');
    if (factsField) checkFacts(card, parseFacts(factsField.text), (msg) => err(`${where}: ${msg}`));
    const prompt = entry.fields.find((f) => f.label === 'Prompt');
    if (prompt && !prompt.text.endsWith(PROMPT_SUFFIX)) {
      err(`${where}: Prompt does not end with "${PROMPT_SUFFIX}"`);
    }
  }

  // Source-file order (over the ids present in both, so one missing entry
  // doesn't cascade into order noise).
  const foundKnown = found.filter((id) => expectedSet.has(id) && seen.get(id) === file);
  const expectedPresent = expected.filter((id) => foundKnown.includes(id));
  for (let i = 0; i < foundKnown.length; i++) {
    if (foundKnown[i] !== expectedPresent[i]) {
      err(`entries out of source-file order: found \`${foundKnown[i]}\` where \`${expectedPresent[i]}\` was expected`);
      break;
    }
  }
}

// Coverage of the catalog itself: every creature or token id in CARD_DB must be
// covered by the file mapping (guards against a creature landing in a set file
// the mapping does not know about).
const expectedEverywhere = new Set(FILE_MAP.flatMap(({ sets }) => sets.flatMap((s) => s.filter(isCreature).map((c) => c.id))));
for (const card of ALL_CARDS) {
  if ((isCreature(card) || card.token) && !expectedEverywhere.has(card.id)) {
    errors.push(`catalog: \`${card.id}\` (${card.name}) is a creature/token but no art-bible file covers its set`);
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`FAIL ${e}`);
  console.error(`\ncheck-art-bible: ${errors.length} problem(s) across ${entryCount} entries`);
  process.exit(1);
}
console.log(`check-art-bible: ${entryCount} entries OK across ${FILE_MAP.length} files (${expectedEverywhere.size} creature/token ids covered)`);
