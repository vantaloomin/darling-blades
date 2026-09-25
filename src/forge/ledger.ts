/**
 * The Power Breakdown's display layer: turns the scorer's machine-shaped part
 * labels (`arrives:scry 1`, `off-pie: burn`, `rage on an attacker (§4o)`) into
 * the game's own words. The scorer's labels never change for this; the
 * translation happens only here, only for display.
 *
 * Owner ruling (2026-09-25): the Forge reflects the live game. Every name the
 * game data already has (keyword names, mechanic names, the effect labels of
 * the builder's own effect menu) is read from that data at runtime, so a
 * rename in the game flows into the Forge with no edit here. The wording for
 * parts the game data does not name comes from the approved copy deck.
 *
 * Headless: no Phaser, no DOM (ESLint's Forge purity block).
 */
import { KEYWORD_NAMES, MECHANIC_NAMES } from '../data/glossary';
import type { Color, Keyword } from '../engine/types';
import { OFF, PIE, SEC, type Part, type ScorableCardDef } from '../power/scoreCore';
import { COLOR_WORDS, OP_OPTIONS, TRIGGER_OPENINGS, type OpKind } from './vocab';

export interface OffColorFacts {
  /** The scorer's effect class (`burn`, `scry`...). */
  effectClass: string;
  /** Secondary colors pay the lower tier; every other color pays the full one. */
  tier: 'secondary' | 'off';
  /** The premium for the tier before any rider scaling. */
  tierValue: number;
  /** What the scorer actually charged (smaller for an incidental rider). */
  charged: number;
  /** The card's colors, or empty for a colorless card. */
  identity: Color[];
  /** The colors this effect is usual in (no premium at all). */
  usual: Color[];
}

export interface LedgerLine {
  text: string;
  /** The rate behind this part is provisional (the scorer tagged it NEEDS MATH). */
  estimate: boolean;
  /** Present on an off-color premium part. */
  offColor?: OffColorFacts;
}

const NEEDS_MATH = /NEEDS MATH/i;

/** An effect's name in the builder's own effect menu. */
function opLabel(kind: OpKind): string {
  return OP_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

function sentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const signedStat = (value: string): string => {
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n}`;
};

/** `+2/+1` from a scorer stat pair, whatever sign style the scorer printed. */
function statPair(p: string, t: string): string {
  return `${signedStat(p)}/${signedStat(t)}`;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Trigger prefixes (`<trigger>:<effect>`): the card-text opening each trigger
 * prints with (vocab.ts TRIGGER_OPENINGS), plus a colon. `spell` prints no
 * prefix at all.
 */
const TRIGGER_PREFIX: Record<string, string> = {
  spell: '',
  ...Object.fromEntries(Object.entries(TRIGGER_OPENINGS).map(([trigger, opening]) => [trigger, `${opening}:`])),
};

/** The colour-pie effect classes, named for the ledger. */
function effectClassWords(effectClass: string): string {
  switch (effectClass) {
    case 'burn': return 'Damage';
    case 'faceBurn': return 'Damage to the opponent';
    case 'sweepDamage': return 'Damage to each creature';
    case 'wrath': return `${opLabel('destroy')} all creatures`;
    case 'wrathFliers': return `${opLabel('destroy')} all ${KEYWORD_NAMES.skyborne} creatures`;
    case 'kill': return 'Creature removal';
    case 'bounce': return opLabel('recall');
    case 'counter': return opLabel('cancel');
    case 'draw': return opLabel('draw');
    case 'scry': return MECHANIC_NAMES.foresee;
    case 'lifegain': return 'Life gain';
    case 'ramp': return 'Extra mana';
    case 'reanimate': return opLabel('raise');
    case 'discard': return 'Discard';
    case 'drain': return 'Life loss';
    case 'disenchant': return opLabel('destroyArtifactOrSeverEnchantment');
    default: return plainWords(effectClass);
  }
}

const colorList = (colors: readonly Color[]): string => colors.map((color) => COLOR_WORDS[color]).join('/');

function offColorLine(card: ScorableCardDef, part: Part, effectClass: string): LedgerLine {
  const def = PIE[effectClass];
  if (!def) return { text: `Off-color premium: ${effectClassWords(effectClass)}`, estimate: false };
  const identity = [...card.colors] as Color[];
  const tierValue = identity.length > 0
    ? Math.min(...identity.map((color) => def.pie[color] ?? OFF))
    : def.colorless;
  const tier = Math.abs(tierValue - SEC) < 0.0001 ? 'secondary' : 'off';
  const usual = (Object.entries(def.pie) as [Color, number][])
    .filter(([, value]) => value === 0)
    .map(([color]) => color);
  // The scorer bills `tier × min(1, class weight)`, so an incidental rider
  // pays less than the full tier. Showing only the tier beside a smaller
  // charge reads as a mismatch, so name both when they differ.
  const scaled = Math.abs(part.v - tierValue) > 0.005;
  const rate = `${tier === 'secondary' ? 'secondary' : 'off-color'} for ${identity.length > 0 ? colorList(identity) : 'colorless'} +${tierValue.toFixed(2)}${scaled ? ` scaled to +${part.v.toFixed(2)}` : ''}`;
  const usualText = usual.length > 0 ? ` · usual in ${colorList(usual)}` : '';
  return {
    text: `Off-color premium: ${effectClassWords(effectClass)} · ${rate}${usualText}`,
    estimate: false,
    offColor: { effectClass, tier, tierValue, charged: part.v, identity, usual },
  };
}

/** True when every team anthem on the card leaves its own source out. */
function anthemsExcludeSelf(card: ScorableCardDef): boolean {
  const anthems = (card.abilities ?? []).filter((ability) => (
    ability.when === 'static' && ability.static?.scope === 'filter' && ability.static.filter?.who !== 'opponent'
  ));
  return anthems.length > 0 && anthems.every((ability) => ability.static?.filter?.other === true);
}

/** Card-level parts: the body, keywords, statics and the mechanic options. */
function cardLevelText(label: string, card: ScorableCardDef | undefined): string | null {
  let match: RegExpExecArray | null;
  if ((match = /^body (-?\d+)\/(-?\d+)$/.exec(label))) return `Body ${match[1]}/${match[2]}`;
  if (Object.hasOwn(KEYWORD_NAMES, label)) return KEYWORD_NAMES[label as Keyword];
  if (label.startsWith('rage on an attacker')) return `${KEYWORD_NAMES.rage} on an attacker`;
  if (label.startsWith('awakening rider')) return `${MECHANIC_NAMES.championAwakening} (needs a way to awaken)`;
  if ((match = /^mana source(?: \((\d+) colou?rs\))?$/.exec(label))) return match[1] ? `Mana source (${match[1]} colors)` : 'Mana source';
  if (label === 'instant premium') return 'Charm speed';
  if (label === 'skim option') return MECHANIC_NAMES.skim;
  if (label === 'retell option') return MECHANIC_NAMES.retell;
  if (label === 'empower option') return MECHANIC_NAMES.empower;
  if (label === 'preserve option') return MECHANIC_NAMES.preserve;
  if (label.startsWith('hauntlink option')) return MECHANIC_NAMES.hauntlink;
  if (label === 'nine lives') return MECHANIC_NAMES.nineLives;
  if (label.startsWith('tithe option')) return MECHANIC_NAMES.tithe;
  if ((match = /^rite (\d+)$/.exec(label))) return `${MECHANIC_NAMES.rite} (sacrifice ${match[1]})`;
  if ((match = /^chapter (\d+)$/.exec(label))) return `${MECHANIC_NAMES.quest} chapter ${match[1]}`;
  if ((match = /^whispers option \(charm, (\d+) off\)$/.exec(label))) return `${MECHANIC_NAMES.whispers} (${match[1]} mana off)`;
  if (label.startsWith('whispers option')) return `${MECHANIC_NAMES.whispers} (no value at printed cost)`;
  if ((match = /^duty \((creature|non-creature) carrier(?:, \{(\d+)\} to activate)?\)(, shares the tap)?/.exec(label))) {
    const carrier = match[1] === 'creature' ? `${MECHANIC_NAMES.duty} on a creature` : MECHANIC_NAMES.duty;
    const mana = match[2] ? `, {${match[2]}} to use` : '';
    return `${carrier}${mana}${match[3] ? ' (shares the tap)' : ''}`;
  }
  if ((match = /^enemy anthem ([+-]?\d+)\/([+-]?\d+)$/.exec(label))) {
    return staticText('Opposing creatures', 'get', 'gain', match[1], match[2], staticFor(card, 'filter', match[1], match[2], true));
  }
  if ((match = /^anthem ([+-]?\d+)\/([+-]?\d+)$/.exec(label))) {
    const found = staticFor(card, 'filter', match[1], match[2], false);
    const other = found ? found.filter?.other === true : !!card && anthemsExcludeSelf(card);
    const subject = `${other ? 'Other ' : ''}${found?.filter?.subtype ? `${found.filter.subtype} ` : ''}creatures you control`;
    return staticText(subject.charAt(0).toUpperCase() + subject.slice(1), 'get', 'gain', match[1], match[2], found);
  }
  if ((match = /^aura ([+-]?\d+)\/([+-]?\d+)$/.exec(label))) {
    return staticText('Enchanted creature', 'gets', 'has', match[1], match[2], staticFor(card, 'attached', match[1], match[2], false));
  }
  if ((match = /^self ([+-]?\d+)\/([+-]?\d+)$/.exec(label))) {
    return staticText('It', 'gets', 'has', match[1], match[2], staticFor(card, 'self', match[1], match[2], false));
  }
  return null;
}

type StaticOf = NonNullable<NonNullable<ScorableCardDef['abilities']>[number]['static']>;

/**
 * The card's static behind a static part. The scorer's label carries only the
 * stat change (`anthem +0/+0`), so the keywords a static grants are read back
 * from the card itself; a static that only grants Sentinel would otherwise
 * read as "+0/+0".
 */
function staticFor(card: ScorableCardDef | undefined, scope: StaticOf['scope'], p: string, t: string, opponent: boolean): StaticOf | undefined {
  return (card?.abilities ?? [])
    .map((ability) => (ability.when === 'static' ? ability.static : undefined))
    .find((st): st is StaticOf => (
      !!st && st.scope === scope && (st.p ?? 0) === Number(p) && (st.t ?? 0) === Number(t)
      && (scope !== 'filter' || (st.filter?.who === 'opponent') === opponent)
    ));
}

function wordList(words: string[]): string {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "Subject gets +1/+1 and has Skyborne", in the order card text prints it. */
function staticText(subject: string, statVerb: string, keywordVerb: string, p: string, t: string, st: StaticOf | undefined): string {
  const keywords = (st?.grantKeywords ?? []).map((keyword) => KEYWORD_NAMES[keyword] ?? plainWords(keyword));
  const hasStats = Number(p) !== 0 || Number(t) !== 0;
  const clauses = [
    hasStats || keywords.length === 0 ? `${statVerb} ${statPair(p, t)}` : '',
    keywords.length > 0 ? `${keywordVerb} ${wordList(keywords)}` : '',
  ].filter(Boolean);
  return `${subject} ${clauses.join(' and ')}`;
}

/** One effect (the part after a trigger prefix, or a bare spell effect). */
function effectText(effect: string): string | null {
  let match: RegExpExecArray | null;
  const n = (value: string): number => Number(value);
  if ((match = /^scry (\d+)$/.exec(effect))) return `${MECHANIC_NAMES.foresee} ${match[1]}`;
  if ((match = /^draw (\d+)$/.exec(effect))) return `${opLabel('draw')} ${match[1]}`;
  if ((match = /^gain (\d+)$/.exec(effect))) return `Gain ${match[1]} life`;
  if ((match = /^drain (\d+)$/.exec(effect))) return `Drain ${match[1]} life`;
  if ((match = /^mill (\d+)$/.exec(effect))) return `${opLabel('grind')} ${match[1]}`;
  if ((match = /^burn any (\d+)$/.exec(effect))) return `${match[1]} damage to any target`;
  if ((match = /^burn creature (\d+)$/.exec(effect))) return `${match[1]} damage to a creature`;
  if ((match = /^face dmg (\d+)$/.exec(effect))) return `${match[1]} damage to the opponent`;
  if ((match = /^self-dmg (\d+)$/.exec(effect))) return `${match[1]} damage to you`;
  if ((match = /^(one-sided )?sweep (\d+)( \+ sever-on-death)?$/.exec(effect))) {
    const who = match[1] ? 'each opposing creature' : 'each creature';
    return `${match[2]} damage to ${who}${match[3] ? `; ${MECHANIC_NAMES.sever} any that die` : ''}`;
  }
  if ((match = /^token ×(\d+)$/.exec(effect))) return plural(n(match[1]), 'token', 'tokens');
  if ((match = /^\+1\/\+1 ×(\d+)$/.exec(effect))) {
    const mark = MECHANIC_NAMES.mark.toLowerCase();
    return `${match[1]} +1/+1 ${n(match[1]) === 1 ? mark : `${mark}s`}`;
  }
  const pump = /^(pump|team pump|self pump|marked-team pump|symmetric pump|debuff) \+?(-?\d+)\/\+?(-?\d+)$/.exec(effect);
  if (pump) {
    const stats = statPair(pump[2], pump[3]);
    switch (pump[1]) {
      case 'team pump': return `${stats} to your creatures until end of turn`;
      case 'self pump': return `${stats} to itself until end of turn`;
      case 'marked-team pump': return `${stats} to your marked creatures until end of turn`;
      case 'symmetric pump': return `${stats} to each creature until end of turn`;
      default: return `${stats} until end of turn`;
    }
  }
  if ((match = /^marked-enemy debuff \+?(-?\d+)\/\+?(-?\d+)/.exec(effect))) {
    return `${statPair(match[1], match[2])} to opposing marked creatures until end of turn`;
  }
  if (effect === 'bounce') return opLabel('recall');
  if (effect === 'exile') return MECHANIC_NAMES.sever;
  if (effect === 'counter') return opLabel('cancel');
  if (effect === 'destroy') return opLabel('destroy');
  if (effect === 'reanimate') return opLabel('raise');
  if (effect === 'regrowth(creature)') return `${opLabel('reclaim')} a creature`;
  if (effect === 'grave-hate') return `${MECHANIC_NAMES.sever} from a graveyard`;
  if (effect === 'self-mill(sever)') return `${MECHANIC_NAMES.sever} from your deck`;
  if (effect === 'fog') return 'Prevent combat damage';
  if (effect === 'tap') return opLabel('tap');
  if (effect === 'disenchant') return opLabel('destroyArtifactOrSeverEnchantment');
  const permanentKind = (kind: string): string => (
    kind === 'artifact/ench' ? 'an artifact or enchantment' : kind === 'artifact' ? 'an artifact' : 'an enchantment'
  );
  if ((match = /^disenchant \((artifact\/ench|artifact|enchantment)\)$/.exec(effect))) return `${opLabel('destroy')} ${permanentKind(match[1])}`;
  if ((match = /^sever (artifact\/ench|artifact|enchantment)$/.exec(effect))) return `${MECHANIC_NAMES.sever} ${permanentKind(match[1])}`;
  if (effect.startsWith('disenchant(newest')) return `${opLabel('destroy')} the opponent's newest artifact or enchantment`;
  if (effect === 'wrath') return `${opLabel('destroy')} all creatures`;
  if (effect === 'wrath(fliers)') return `${opLabel('destroy')} all ${KEYWORD_NAMES.skyborne} creatures`;
  if (effect === 'wrath(enchantments)') return `${opLabel('destroy')} all enchantments`;
  if ((match = /^discard (\d+) \(self\)$/.exec(effect))) return `Discard ${match[1]}`;
  if ((match = /^discard (\d+)$/.exec(effect))) return `Opponent discards ${match[1]}`;
  if ((match = /^edict (\d+)$/.exec(effect))) {
    return n(match[1]) === 1 ? 'Opponent sacrifices a creature' : `Opponent sacrifices ${match[1]} creatures`;
  }
  if ((match = /^each player sacrifices (\d+)$/.exec(effect))) {
    return n(match[1]) === 1 ? 'Each player sacrifices a creature' : `Each player sacrifices ${match[1]} creatures`;
  }
  if ((match = /^extra land drop(?: ×(\d+))?$/.exec(effect))) {
    return match[1] ? `${match[1]} extra land drops` : sentenceCase(opLabel('extraLandDrop'));
  }
  if (effect.startsWith('propagate')) return MECHANIC_NAMES.propagate;
  if (effect === 'mark all your creatures') return `${MECHANIC_NAMES.mark} each creature you control`;
  if (effect.startsWith('fetch land')) return 'Fetch a land (it enters tapped)';
  if (effect.startsWith('move 1 mark')) return 'Move 1 mark between your permanents';
  if (effect.startsWith('remove all marks')) return 'Remove all marks from a target';
  if (effect.startsWith('sever self')) return `${MECHANIC_NAMES.sever} itself (a cost)`;
  if (effect.startsWith('drain per their marked')) return 'Opponent loses life for each marked creature they control';
  if (effect.startsWith('if-marked')) return 'If the target is marked (both outcomes averaged)';
  if (effect === 'return self to hand') return 'Return it to your hand';
  if (effect === 'tap all opposing creatures') return 'Tap all opposing creatures';
  if (effect === 'prevent combat damage to target') return 'Prevent combat damage to a creature';
  if (effect.startsWith('awaken(self')) return /no rider/.test(effect) ? 'Awaken itself (it has nothing to awaken)' : 'Awaken itself';
  if (effect.startsWith('awaken(allYours')) return 'Awaken your creatures';
  return null;
}

/**
 * Magic's names for the game's mechanics, and the scorer's shorthand, mapped
 * to the game's own words for the fallback path.
 */
const FALLBACK_WORDS: [RegExp, () => string][] = [
  [/\bscry\b/gi, () => MECHANIC_NAMES.foresee],
  [/\bmill\b/gi, () => opLabel('grind')],
  [/\bexile\b/gi, () => MECHANIC_NAMES.sever],
  [/\bbounce\b/gi, () => opLabel('recall')],
  [/\bcounter\b/gi, () => opLabel('cancel')],
  [/\breanimate\b/gi, () => opLabel('raise')],
  [/\bregrowth\b/gi, () => opLabel('reclaim')],
  [/\bwrath\b/gi, () => `${opLabel('destroy').toLowerCase()} all`],
  [/\bfog\b/gi, () => 'prevent combat damage'],
  [/\bflying\b/gi, () => KEYWORD_NAMES.skyborne],
  [/\binstant\b/gi, () => 'Charm'],
  [/\bdmg\b/gi, () => 'damage'],
];

/**
 * Plain words for a label shape this module does not know: annotations
 * dropped, ids spaced out, Magic's names swapped for the game's. Never shows a
 * section sign, an engine id, or an em-dash.
 */
export function plainWords(label: string): string {
  let text = label
    .replace(/[—–]/g, ',')
    .replace(/\(\s*§[^)]*\)/g, '')
    .replace(/§\s*[\w.]*/g, '')
    .replace(/\bMEP\b/g, 'points')
    .replace(/NEEDS MATH/gi, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_]/g, ' ');
  for (const [pattern, replacement] of FALLBACK_WORDS) text = text.replace(pattern, replacement);
  text = text
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return capitalize(text.toLowerCase().replace(/\b(skyborne|foresee|sever|recall|cancel|raise|reclaim|grind|charm)\b/g, (word) => capitalize(word)));
}

/** The scorer's provisional-rate markers, removed from the label. */
function stripMarkers(label: string): string {
  return label
    .replace(/,?\s*NEEDS MATH( band)?/gi, '')
    .replace(/\s*\(\s*§[^)]*\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/** Translate one scorer label. `card` refines a few card-dependent phrasings. */
export function translateLabel(label: string, card?: ScorableCardDef): LedgerLine {
  const estimate = NEEDS_MATH.test(label);
  const clean = stripMarkers(label);
  const cardLevel = cardLevelText(clean, card);
  if (cardLevel !== null) return { text: cardLevel, estimate };
  const prefixed = /^([a-zA-Z]+):(.*)$/.exec(clean);
  if (prefixed) {
    const [, trigger, effect] = prefixed;
    const known = Object.hasOwn(TRIGGER_PREFIX, trigger);
    const prefix = known ? TRIGGER_PREFIX[trigger] : `When ${plainWords(trigger).toLowerCase()}:`;
    const body = effectText(effect.trim()) ?? plainWords(effect);
    return { text: prefix ? `${prefix} ${body}` : body, estimate };
  }
  const bare = effectText(clean);
  return { text: bare ?? plainWords(clean), estimate };
}

/** The ledger line for one scored part of `card`. */
export function translatePart(card: ScorableCardDef, part: Part): LedgerLine {
  const offPie = /^off-pie:\s*(.+)$/.exec(part.label);
  if (offPie) return offColorLine(card, part, offPie[1].trim());
  return translateLabel(part.label, card);
}
