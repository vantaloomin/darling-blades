import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const specPath = path.join(root, 'docs/expansions/yokai-nights.md');
const outputPath = path.join(root, 'src/data/cards/yokai-nights.ts');

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

function readRows(): SpecRow[] {
  const rows = fs
    .readFileSync(specPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\| yn-/.test(line))
    .map((line) => {
      const fields = line.slice(1, -1).split('|').map((field) => field.trim());
      if (fields.length !== 9) throw new Error(`Expected 9 fields in ${line}`);
      const [id, name, rarity, color, type, cost, stats, mechanics, flavor] = fields;
      return { id, name, rarity, color, type, cost, stats, mechanics, flavor };
    });
  if (rows.length !== 120) throw new Error(`Expected 120 rows, found ${rows.length}`);
  return rows;
}

const header = `import type { AbilityDef, CardDef, CardType, Color, EffectOp, Keyword, TargetSpec } from '../../engine/types';
import { cost } from '../cardTypes';

/** Exact compact rows from docs/expansions/yokai-nights.md. */
export interface YokaiSpecRow {
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

`;

const implementation = String.raw`
const KEYWORDS: Readonly<Record<string, Keyword>> = {
  Skyborne: 'skyborne',
  'Warding Gaze': 'wardingGaze',
  'First Blade': 'firstBlade',
  Warcry: 'warcry',
  Overrun: 'overrun',
  Sentinel: 'sentinel',
  Bulwark: 'bulwark',
  Deathblade: 'deathblade',
  'Blood Oath': 'bloodoath',
  Untouchable: 'untouchable',
  Dreaded: 'dreaded',
};

const CLEAN_SPECIES = new Set(['Kitsune', 'Oni', 'Yokai', 'Tanuki', 'Kappa', 'Dryad', 'Spirit', 'Human']);

function parseMana(raw: string): ReturnType<typeof cost> | undefined {
  if (raw === 'none') return undefined;
  const symbols = [...raw.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  const first = Number(symbols[0]);
  const generic = Number.isInteger(first) ? first : 0;
  const pips = (Number.isInteger(first) ? symbols.slice(1) : symbols).join('');
  if (!Number.isInteger(generic) || !pips.split('').every((pip) => 'WUBRG'.includes(pip))) throw new Error('Invalid mana cost: ' + raw);
  return cost(generic, pips);
}

function parseKeywords(text: string): Keyword[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => KEYWORDS[part])
    .map((part) => KEYWORDS[part]);
}

function target(what: TargetSpec['what']): TargetSpec[] {
  return [{ what }];
}

function parseSubtypes(typeText: string): string[] {
  const match = typeText.match(/\(([^)]+)\)/);
  if (!match) return [];
  const parts = match[1].split(/\s+/);
  // The approved taxonomy keeps the species token (Kitsune, Oni, Yokai,
  // Tanuki, Kappa, Dryad, Spirit) distinct from the role. Human rows retain
  // Human plus their role, and never receive a second yokai species subtype.
  if (parts.length === 1) return parts;
  if (CLEAN_SPECIES.has(parts[0])) return parts;
  return parts;
}

function parseStats(raw: string): { attack?: number; defense?: number } {
  if (raw === '-') return {};
  const match = raw.match(/^(\d+)\/(\d+)$/);
  if (!match) throw new Error('Invalid stats: ' + raw);
  return { attack: Number(match[1]), defense: Number(match[2]) };
}

function effect(text: string): EffectOp {
  let match = text.match(/^draw (\d+)$/i);
  if (match) return { op: 'draw', n: Number(match[1]) };
  match = text.match(/^gain (\d+) life$/i);
  if (match) return { op: 'gainLife', n: Number(match[1]) };
  match = text.match(/^opponent loses (\d+) life$/i);
  if (match) return { op: 'loseLife', n: Number(match[1]), who: 'opponent' };
  match = text.match(/^deal (\d+) damage to opponent$/i);
  if (match) return { op: 'damage', n: Number(match[1]), to: 'opponent' };
  match = text.match(/^grind (self|opponent) (\d+)$/i);
  if (match) return { op: 'grind', n: Number(match[2]), who: match[1] as 'self' | 'opponent' };
  match = text.match(/^opponent discards at random (\d+)$/i);
  if (match) return { op: 'discardRandom', n: Number(match[1]), who: 'opponent' };
  match = text.match(/^put (\d+) \+1\/\+1 marks on this$/i);
  if (match) return { op: 'addCounters', n: Number(match[1]), to: 'self' };
  if (/^raise the top creature card from your graveyard$/i.test(text)) return { op: 'raise', to: 'top' };
  if (/^sever the top card of opponent's graveyard$/i.test(text)) return { op: 'severGrave', n: 1, who: 'opponent' };
  if (/^destroy the newest artifact or enchantment an opponent controls$/i.test(text)) {
    return { op: 'destroyNewestOpponentArtifactOrEnchantment' };
  }
  const boost = text.match(/^target creature gets \+(\d+)\/\+(\d+)(?: and (Skyborne|Warding Gaze|First Blade|Warcry|Overrun|Sentinel|Bulwark|Deathblade|Blood Oath|Untouchable|Dreaded))? until end of turn$/i);
  if (boost) return {
    op: 'boost',
    p: Number(boost[1]),
    t: Number(boost[2]),
    ...(boost[3] ? { keywords: parseKeywords(boost[3]) } : {}),
    scope: 'target',
  };
  if (/^your creatures get \+0\/\+1 until end of turn$/i.test(text)) return { op: 'boost', p: 0, t: 1, scope: 'allYours' };
  if (/^prevent all combat damage this turn$/i.test(text)) return { op: 'preventCombat' };
  if (/^destroy all creatures$/i.test(text)) return { op: 'massDestroy', filter: 'allCreatures' };
  match = text.match(/^deal (\d+) damage to you$/i);
  if (match) return { op: 'damage', n: Number(match[1]), to: 'controller' };
  match = text.match(/^deal (\d+) damage to target creature or player$/i);
  if (match) return { op: 'damage', n: Number(match[1]), to: 'target' };
  if (/^destroy target artifact or sever target enchantment$/i.test(text)) {
    return { op: 'destroyArtifactOrSeverEnchantment', to: 'target' };
  }
  if (/^cancel target spell$/i.test(text)) return { op: 'cancel', to: 'target' };
  if (/^recall target creature$/i.test(text)) return { op: 'recall', to: 'target' };
  if (/^sever target creature$/i.test(text)) return { op: 'sever', to: 'target' };
  if (/^foresee (\d+)$/i.test(text)) return { op: 'foresee', n: Number(text.match(/\d+/)?.[0]) };
  if (/^opponent loses (\d+) life; gain (\d+) life$/i.test(text)) {
    throw new Error('Compound effect must be split before parsing: ' + text);
  }
  throw new Error('Unsupported Yokai effect: ' + text);
}

function splitEffects(text: string): EffectOp[] {
  const parts = text.split(/;|, then /).map((part) => part.trim()).filter(Boolean);
  return parts.flatMap((part) => {
    const compound = part.match(/^opponent loses (\d+) life; gain (\d+) life$/i);
    if (compound) {
      return [
        { op: 'loseLife', n: Number(compound[1]), who: 'opponent' } as EffectOp,
        { op: 'gainLife', n: Number(compound[2]) } as EffectOp,
      ];
    }
    return [effect(part)];
  });
}

function parseAbilityText(text: string, spellMode = false): AbilityDef[] {
  const abilities: AbilityDef[] = [];
  const staticMatch = text.match(/^Your other (Kitsune) get \+(\d+)\/\+(\d+)\.$/i);
  if (staticMatch) {
    abilities.push({
      when: 'static',
      static: { scope: 'filter', filter: { subtype: staticMatch[1], other: true }, p: Number(staticMatch[2]), t: Number(staticMatch[3]) },
    });
    return abilities;
  }

  const filterStaticMatch = text.match(/Your other (Kitsune) get \+(\d+)\/\+(\d+)\.?/i);
  if (filterStaticMatch) {
    abilities.push({
      when: 'static',
      static: { scope: 'filter', filter: { subtype: filterStaticMatch[1], other: true }, p: Number(filterStaticMatch[2]), t: Number(filterStaticMatch[3]) },
    });
  }
  const normalText = text
    .replace(filterStaticMatch?.[0] ?? '', '')
    .replace(/\s*\[ANSWER:[^\]]+\]\.?/g, '')
    .replace(/\s*\(AI-risk survivor\.\)/g, '')
    .trim();
  const linked = normalText.match(/(?:^|\. )Hauntlink (\{[^}]+\}(?:\{[^}]+\})*)\. Linked: The linked creature gets (.+)$/i);
  let ordinary = normalText;
  if (linked) {
    const rider = linked[2].replace(/\.$/, '');
    const plus = rider.match(/^\+(\d+)\/\+(\d+),?\s*(.*)$/);
    const grantKeywords = parseKeywords(rider.replace(/^\+\d+\/\+\d+,?\s*/, '').replace(/ and /g, ', '));
    const riderDef: { p?: number; t?: number; grantKeywords?: Keyword[] } = plus
      ? { p: Number(plus[1]), t: Number(plus[2]), ...(grantKeywords.length ? { grantKeywords } : {}) }
      : { ...(grantKeywords.length ? { grantKeywords } : {}) };
    if (!riderDef.p && !riderDef.t && !riderDef.grantKeywords?.length) throw new Error('Empty Linked rider: ' + text);
    abilities.push({ when: 'static', static: { scope: 'attached', ...riderDef } });
    ordinary = ordinary.slice(0, ordinary.indexOf(linked[0])).replace(/\.\s*$/, '').trim();
  }

  if (!ordinary) return abilities;
  const clauses = ordinary.match(/(?:At dawn|Arrives|When this attacks):[^.]+\.?/gi) ?? [];
  for (const clause of clauses) {
    const split = clause.match(/^(At dawn|Arrives|When this attacks):\s*(.+?)\.?$/i);
    if (!split) throw new Error('Invalid ability clause: ' + clause);
    const when = split[1].toLowerCase() === 'at dawn' ? 'dawn' : split[1].toLowerCase() === 'arrives' ? 'arrives' : 'attacks';
    const targetWhat = /target artifact or sever target enchantment/i.test(split[2])
      ? 'artifactOrEnchantment'
      : /target spell/i.test(split[2])
        ? 'spell'
        : /target creature or player/i.test(split[2])
          ? 'any'
          : /target creature/i.test(split[2])
            ? 'creature'
            : undefined;
    abilities.push({ when, ...(targetWhat ? { targets: target(targetWhat) } : {}), ops: splitEffects(split[2]) });
  }
  if (spellMode && clauses.length === 0 && normalText) {
    const spellText = normalText.replace(/\.$/, '').trim();
    const targetWhat = /target artifact or sever target enchantment/i.test(spellText)
      ? 'artifactOrEnchantment'
      : /target spell/i.test(spellText)
        ? 'spell'
        : /target creature or player/i.test(spellText)
          ? 'any'
          : /target creature/i.test(spellText)
            ? 'creature'
            : undefined;
    abilities.push({ when: 'spell', ...(targetWhat ? { targets: target(targetWhat) } : {}), ops: splitEffects(spellText) });
  }
  return abilities;
}

function parseCard(row: YokaiSpecRow): CardDef {
  const typeName = row.type.replace(/^Legendary /, '').split(' (')[0].toLowerCase() as CardType;
  const isLand = typeName === 'land';
  const colors = isLand ? [] : row.color.split('/') as Color[];
  const mana = parseMana(row.cost);
  const stats = parseStats(row.stats);
  const keywordText = row.mechanics.split(/\.|\[/)[0].trim();
  const keywords = parseKeywords(keywordText);
  const abilities = parseAbilityText(row.mechanics, typeName === 'ritual' || typeName === 'charm');
  const hauntlinkText = row.mechanics.match(/Hauntlink (\{[^}]+\}(?:\{[^}]+\})*)/i)?.[1];
  const hauntlinkAbility = abilities.find((ability) => ability.when === 'static' && ability.static?.scope === 'attached');
  const hauntlink = hauntlinkText && hauntlinkAbility?.static
    ? {
        cost: parseMana(hauntlinkText)!,
        linked: {
          ...(hauntlinkAbility.static.p === undefined ? {} : { p: hauntlinkAbility.static.p }),
          ...(hauntlinkAbility.static.t === undefined ? {} : { t: hauntlinkAbility.static.t }),
          ...(hauntlinkAbility.static.grantKeywords?.length ? { grantKeywords: hauntlinkAbility.static.grantKeywords } : {}),
        },
      }
    : undefined;
  const ordinaryAbilities = hauntlink
    ? abilities.filter((ability) => ability !== hauntlinkAbility)
    : abilities;
  const card: CardDef = {
    id: row.id,
    name: row.name,
    types: [typeName],
    subtypes: parseSubtypes(row.type),
    ...(row.type.startsWith('Legendary ') ? { supertypes: ['legendary'] as const } : {}),
    ...(mana ? { cost: mana } : {}),
    colors,
    ...stats,
    ...(keywords.length ? { keywords } : {}),
    ...(ordinaryAbilities.length ? { abilities: ordinaryAbilities } : {}),
    ...(hauntlink ? { hauntlink } : {}),
    ...(isLand ? { entersTapped: true, manaAbility: row.color.split('/') as Color[] } : {}),
    rarity: row.rarity.toLowerCase() as CardDef['rarity'],
    flavor: row.flavor,
  };
  return { ...card, set: 'yokai-nights' } as unknown as CardDef;
}

/** Compiled from the exact table rows above. */
export const YOKAI_NIGHTS = YOKAI_SPEC_ROWS.map(parseCard) as readonly CardDef[];
`;

const rows = readRows();
const source = `${header}export const YOKAI_SPEC_ROWS = ${JSON.stringify(rows, null, 2)} as const satisfies readonly YokaiSpecRow[];\n\n${implementation}`;
fs.writeFileSync(outputPath, source, 'utf8');
console.log(`wrote ${rows.length} Yokai Nights rows to ${path.relative(root, outputPath)}`);
