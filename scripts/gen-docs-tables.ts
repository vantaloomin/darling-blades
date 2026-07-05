/**
 * Regenerates the three `<!-- BEGIN GENERATED ... -->` doc tables from code:
 *
 *   docs/rules.md         — RULES constants   (RULES imported from src/config/rules.ts)
 *   docs/adding-cards.md  — EffectOp table    (EffectOp union parsed from src/engine/types.ts,
 *                                              cross-checked against runOp in EffectInterpreter.ts)
 *   docs/architecture.md  — GameEvent table   (GameEvent union parsed from src/engine/events.ts)
 *
 * Mechanical columns (keys, values, shapes, payload field lists) come from the
 * code; description prose is hand-written and is preserved from the existing
 * tables, keyed by constant/op/event name ("(describe me)" for new keys).
 * events.ts and the EffectOp union are type-only — erased at runtime — so those
 * two are parsed from source text rather than imported.
 *
 * `--check` prints drift and exits 1 without writing. Idempotent otherwise.
 * Run via `npm run gen-docs-tables`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/config/rules';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkMode = process.argv.includes('--check');

// --- markdown table helpers --------------------------------------------------

/** Split a `| a | b |` row into trimmed cells, honoring `\|` escapes. */
function splitRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|') || t.length < 2) return null;
  return t
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{3,}:?$/.test(c));

function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  return [
    line(headers),
    '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |',
    ...rows.map(line),
  ];
}

// --- generated-block plumbing ------------------------------------------------

interface Block {
  doc: string; // path relative to root
  labelPrefix: string; // stable start of the BEGIN marker label
  newLabel: string; // full replacement label
}

function readDoc(block: Block): { lines: string[]; begin: number; end: number } {
  const lines = readFileSync(join(root, block.doc), 'utf8').split('\n');
  const begin = lines.findIndex((l) => l.startsWith(`<!-- BEGIN GENERATED: ${block.labelPrefix}`));
  const end = lines.findIndex((l, i) => i > begin && l.trim() === '<!-- END GENERATED -->');
  if (begin < 0 || end < 0) {
    throw new Error(`${block.doc}: could not find GENERATED block "${block.labelPrefix}"`);
  }
  return { lines, begin, end };
}

/** The data rows of the table currently inside the block (header/separator skipped). */
function existingRows(block: Block): string[][] {
  const { lines, begin, end } = readDoc(block);
  const rows: string[][] = [];
  let sawHeader = false;
  for (const line of lines.slice(begin + 1, end)) {
    const cells = splitRow(line);
    if (!cells) continue;
    if (!sawHeader) {
      sawHeader = true; // header row
    } else if (!isSeparator(cells)) {
      rows.push(cells);
    }
  }
  return rows;
}

/** Rebuild the doc with the block replaced; returns { old, new } full contents. */
function withBlock(block: Block, table: string[]): { before: string; after: string } {
  const { lines, begin, end } = readDoc(block);
  const marker = `<!-- BEGIN GENERATED: ${block.newLabel} -->`;
  const next = [...lines.slice(0, begin), marker, '', ...table, '', ...lines.slice(end)];
  return { before: lines.join('\n'), after: next.join('\n') };
}

// --- union parsing (for type-only sources) -------------------------------------

/** Extract the `{ ... }` variants of a discriminated-union type declaration. */
function unionVariants(source: string, typeName: string): string[] {
  const decl = source.indexOf(`export type ${typeName} =`);
  if (decl < 0) throw new Error(`export type ${typeName} not found`);
  const variants: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = decl; i < source.length; i++) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '{') depth++;
    if (depth > 0) cur += ch;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        variants.push(cur.replace(/\s+/g, ' ').trim());
        cur = '';
      }
    }
    if (depth === 0 && ch === ';') break;
  }
  return variants;
}

/** Top-level `key: type` members of one `{ ... }` variant, minus the discriminant. */
function membersOf(variant: string, discriminant: string): { name: string; optional: boolean }[] {
  const body = variant.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if ('{[('.includes(ch)) depth++;
    if ('}])'.includes(ch)) depth--;
    if (ch === ';' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => p.trim().match(/^(\w+)(\?)?:/))
    .filter((m): m is RegExpMatchArray => m !== null && m[1] !== discriminant)
    .map((m) => ({ name: m[1], optional: m[2] === '?' }));
}

// --- drift accounting ----------------------------------------------------------

const drift: string[] = [];
let wrote = false;

function applyBlock(block: Block, headers: string[], rows: string[][]): void {
  const { before, after } = withBlock(block, renderTable(headers, rows));
  if (before === after) {
    if (!checkMode) console.log(`gen-docs-tables: ${block.doc} unchanged`);
    return;
  }
  if (checkMode) {
    drift.push(`${block.doc}: generated block differs from code (run: npm run gen-docs-tables)`);
  } else {
    writeFileSync(join(root, block.doc), after);
    console.log(`gen-docs-tables: ${block.doc} updated`);
    wrote = true;
  }
}

/** Report key-level drift between code keys and the doc's existing keyed rows. */
function keyDrift(block: Block, codeKeys: string[], docKeys: string[]): void {
  for (const k of codeKeys.filter((k) => !docKeys.includes(k))) {
    drift.push(`${block.doc}: \`${k}\` exists in code but has no doc row`);
  }
  for (const k of docKeys.filter((k) => !codeKeys.includes(k))) {
    drift.push(`${block.doc}: doc row \`${k}\` no longer exists in code`);
  }
}

// Anchored on purpose: a prose cell that merely mentions `someKey` is not a key.
const keyOf = (cell: string) => cell.match(/^`(?:RULES\.)?(\w+)`$/)?.[1];

// --- table 1: RULES constants (docs/rules.md) ----------------------------------

{
  const block: Block = {
    doc: 'docs/rules.md',
    labelPrefix: 'RULES constants',
    newLabel: 'RULES constants (mirror of src/config/rules.ts · run: npm run gen-docs-tables)',
  };
  const old = existingRows(block);
  keyDrift(block, Object.keys(RULES), old.map((r) => keyOf(r[2])).filter((k): k is string => !!k));

  // Walk the existing rows to keep hand-written labels and unkeyed extras
  // (e.g. the "Basics — unlimited" row) in place; values come from code.
  const rows: string[][] = [];
  const emitted = new Set<string>();
  for (const r of old) {
    const key = keyOf(r[2]);
    if (!key) rows.push(r); // hand-written extra row — preserved verbatim
    else if (key in RULES) {
      rows.push([r[0], String(RULES[key as keyof typeof RULES]), `\`RULES.${key}\``]);
      emitted.add(key);
    } // else: dropped — key no longer in code
  }
  for (const [key, value] of Object.entries(RULES)) {
    if (!emitted.has(key)) rows.push(['(describe me)', String(value), `\`RULES.${key}\``]);
  }
  applyBlock(block, ['Rule', 'Value', 'Constant'], rows);
}

// --- table 2: EffectOp table (docs/adding-cards.md) -----------------------------

{
  const block: Block = {
    doc: 'docs/adding-cards.md',
    labelPrefix: 'EffectOp table',
    newLabel:
      'EffectOp table (ops from src/engine/types.ts + EffectInterpreter.ts · run: npm run gen-docs-tables · semantics prose is hand-maintained)',
  };
  const typesSrc = readFileSync(join(root, 'src', 'engine', 'types.ts'), 'utf8');
  const interpSrc = readFileSync(
    join(root, 'src', 'engine', 'effects', 'EffectInterpreter.ts'),
    'utf8',
  );

  const variants = unionVariants(typesSrc, 'EffectOp');
  const ops = variants.map((v) => {
    const name = v.match(/op: '(\w+)'/)?.[1];
    if (!name) throw new Error(`EffectOp variant without op name: ${v}`);
    const shape = v
      .replace(new RegExp(`op: '${name}';?\\s*`), '')
      .replace(/\{\s+\}/, '{}')
      .replace(/ \| /g, '\\|');
    return { name, shape };
  });

  // Cross-check: every union op should have a `case` in runOp and vice versa.
  const cases = new Set([...interpSrc.matchAll(/^\s*case '(\w+)':/gm)].map((m) => m[1]));
  for (const op of ops.filter((o) => !cases.has(o.name))) {
    drift.push(`docs/adding-cards.md: op \`${op.name}\` is in the EffectOp union but runOp has no case for it`);
  }
  for (const c of [...cases].filter((c) => !ops.some((o) => o.name === c))) {
    drift.push(`docs/adding-cards.md: runOp case \`${c}\` is not in the EffectOp union`);
  }

  const old = existingRows(block);
  const oldByKey = new Map(old.map((r) => [keyOf(r[0]) ?? '', r]));
  keyDrift(block, ops.map((o) => o.name), old.map((r) => keyOf(r[0])).filter((k): k is string => !!k));

  const rows = ops.map(({ name, shape }) => {
    const prev = oldByKey.get(name);
    return [`\`${name}\``, `\`${shape}\``, prev?.[2] ?? '(describe me)', prev?.[3] ?? '—'];
  });
  applyBlock(block, ['Op', 'Shape', 'Semantics', 'Notable events'], rows);
}

// --- table 3: GameEvent table (docs/architecture.md) ----------------------------

{
  const block: Block = {
    doc: 'docs/architecture.md',
    labelPrefix: 'GameEvent table',
    newLabel:
      'GameEvent table (events from src/engine/events.ts · run: npm run gen-docs-tables · payload/meaning prose is hand-maintained)',
  };
  const eventsSrc = readFileSync(join(root, 'src', 'engine', 'events.ts'), 'utf8');
  const events = unionVariants(eventsSrc, 'GameEvent').map((v) => {
    const name = v.match(/e: '(\w+)'/)?.[1];
    if (!name) throw new Error(`GameEvent variant without event name: ${v}`);
    return { name, fields: membersOf(v, 'e') };
  });

  const old = existingRows(block);
  const oldByKey = new Map(old.map((r) => [keyOf(r[0]) ?? '', r]));
  keyDrift(block, events.map((e) => e.name), old.map((r) => keyOf(r[0])).filter((k): k is string => !!k));

  const rows = events.map(({ name, fields }) => {
    const mechanical =
      fields.map((f) => `\`${f.name}${f.optional ? '?' : ''}\``).join(', ') || '—';
    const prev = oldByKey.get(name);
    // Preserve the hand-written payload prose (it may carry nested-shape hints
    // like `hits[{source, target, amount}]`), appending any field it omits.
    let payload = prev?.[1] ?? mechanical;
    for (const f of fields) {
      if (!new RegExp(`\\b${f.name}\\b`).test(payload)) {
        payload = payload === '—' ? '' : payload + ', ';
        payload += `\`${f.name}${f.optional ? '?' : ''}\``;
        drift.push(`docs/architecture.md: payload of \`${name}\` was missing \`${f.name}\``);
      }
    }
    return [`\`${name}\``, payload, prev?.[2] ?? '(describe me)'];
  });
  applyBlock(block, ['Event', 'Payload (besides `e`)', 'Meaning'], rows);
}

// --- verdict -------------------------------------------------------------------

if (drift.length > 0) {
  for (const d of drift) console.error(`DRIFT ${d}`);
  if (checkMode) {
    console.error(`\ngen-docs-tables --check: ${drift.length} drift item(s)`);
    process.exit(1);
  }
}
if (checkMode) console.log('gen-docs-tables --check: docs match code');
else if (!wrote) console.log('gen-docs-tables: all blocks up to date');
