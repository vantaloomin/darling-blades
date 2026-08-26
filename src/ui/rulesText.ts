import type {
  AbilityDef,
  CardDef,
  Color,
  EffectOp,
  Keyword,
  ManaCost,
  TargetSpec,
} from '../engine/types';
import { CARD_DB } from '../data/catalog';
import {
  cardMechanics,
  KEYWORD_NAMES,
  KEYWORD_REMINDER,
  MECHANIC_DEFINITIONS,
  MECHANIC_NAMES,
} from '../data/glossary';

// The rules vocabulary itself lives in `src/data/glossary.ts` so the pure
// layers (Collection search) can read it without importing presentation code.
// It is re-exported here because the card face is still where callers look
// for card copy.
export {
  CARD_TYPE_DEFINITIONS,
  KEYWORD_NAMES,
  KEYWORD_REMINDER,
  MECHANIC_DEFINITIONS,
  MECHANIC_NAMES,
} from '../data/glossary';

// Token and mark counts read as words ("create two 1/1 tokens", "put one
// +1/+1 mark") per the printed-card convention; other numerics (damage,
// draw, life) deliberately keep digits — user-scoped 2026-07-31.
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const;
function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function targetNoun(spec: TargetSpec | undefined): string {
  switch (spec?.what) {
    case 'artifact':
      return 'artifact';
    case 'enchantment':
      return 'enchantment';
    case 'artifactOrEnchantment':
      return 'artifact or enchantment';
    default:
      return 'creature';
  }
}

function referencesAbilityTarget(op: EffectOp): boolean {
  switch (op.op) {
    case 'damage':
      return op.to === 'target';
    case 'destroy':
    case 'sever':
    case 'recall':
    case 'cancel':
    case 'tap':
      return op.to === 'target';
    case 'destroyArtifactOrSeverEnchantment':
      return op.to === 'target';
    case 'boost':
      return op.scope === 'target';
    case 'addCounters':
      return op.to === 'target';
    case 'reclaim':
      return true;
    case 'raise':
      return op.to !== 'top';
    default:
      return false;
  }
}

function opText(
  op: EffectOp,
  target?: TargetSpec,
  targetAlreadyNamed = false,
  excludesSelf = false,
): string {
  switch (op.op) {
    case 'damage': {
      const n = op.n === 'X' ? 'X' : op.n;
      if (op.to === 'eachCreature') return `deal ${n} damage to each creature`;
      if (op.to === 'controller') return `this deals ${n} damage to you`;
      if (op.to === 'opponent') return `this deals ${n} damage to your opponent`;
      const recipient = target?.what === 'creature'
        ? targetAlreadyNamed ? 'that creature' : 'target creature'
        : 'any target';
      return `deal ${n} damage to ${recipient}`;
    }
    case 'gainLife':
      return `you gain ${op.n} life`;
    case 'loseLife':
      return `your opponent loses ${op.n} life`;
    case 'draw':
      return `draw ${op.n === 1 ? 'a card' : `${op.n} cards`}`;
    case 'discardRandom':
      return `your opponent discards ${op.n === 1 ? 'a card' : `${op.n} cards`} at random`;
    case 'destroy':
      return `destroy target ${targetNoun(target)}`;
    case 'sever':
      return `Sever target ${targetNoun(target)}`;
    case 'severGrave': {
      const cards = op.n === 1 ? 'the top card' : `the top ${op.n} cards`;
      return op.who === 'self'
        ? `Sever ${cards} of your graveyard`
        : `Sever ${cards} of your opponent's graveyard`;
    }
    case 'severTop':
      return `Sever ${op.n === 1 ? 'the top card' : `the top ${op.n} cards`} of your deck`;
    case 'recall':
      return `return target ${targetNoun(target)} to its owner's hand`;
    case 'destroyArtifactOrSeverEnchantment':
      return 'destroy target artifact or sever target enchantment';
    case 'cancel':
      return 'cancel target spell';
    case 'boost': {
      const sign = (v: number): string => (v >= 0 ? `+${v}` : `${v}`);
      const kw = op.keywords?.length
        ? ` and gain${op.scope === 'target' ? 's' : ''} ${op.keywords.map((k) => KEYWORD_NAMES[k]).join(', ')}`
        : '';
      if (op.scope === 'target') return `target creature gets ${sign(op.p)}/${sign(op.t)}${kw} until end of turn`;
      const subject = op.scope === 'all' ? 'all creatures' : 'creatures you control';
      return `${subject} get ${sign(op.p)}/${sign(op.t)}${kw} until end of turn`;
    }
    case 'addCounters': {
      if (op.to === 'self') return `put ${countWord(op.n)} +1/+1 mark${op.n === 1 ? '' : 's'} on this`;
      const markTarget = target?.what === 'yourCreature' ? 'target creature you control' : 'target creature';
      return `put ${countWord(op.n)} +1/+1 mark${op.n === 1 ? '' : 's'} on ${markTarget}`;
    }
    case 'propagate':
      // "another" carries the whole rule: it only ever adds to a mark that is
      // already there, so an unmarked permanent is left alone.
      return 'put another mark on each marked permanent you control';
    case 'tap':
      return targetAlreadyNamed ? 'tap that creature' : 'tap target creature';
    case 'extraLandDrop': {
      const n = op.n ?? 1;
      return n === 1
        ? 'you may play an additional land this turn'
        : `you may play ${n} additional lands this turn`;
    }
    case 'createToken': {
      // Say WHAT gets created — "create 2 tokens" left players guessing
      // (user-reported 2026-07-12). The full catalog (expansion tokens
      // included) is the lookup, with the old wording as the fallback.
      const tok: CardDef | undefined = CARD_DB[op.token];
      const plural = op.count === 1 ? 'token' : 'tokens';
      if (!tok) return `create ${countWord(op.count)} ${plural}`;
      const stats = tok.attack !== undefined && tok.defense !== undefined ? `${tok.attack}/${tok.defense} ` : '';
      const kw = tok.keywords?.length
        ? ` with ${tok.keywords.map((k) => KEYWORD_NAMES[k]).join(', ')}`
        : '';
      return `create ${countWord(op.count)} ${stats}${tok.name} ${plural}${kw}`;
    }
    case 'massDestroy':
      if (op.filter === 'allEnchantments') return 'destroy all enchantments';
      return op.filter === 'allCreatures' ? 'destroy all creatures' : 'destroy all creatures with Skyborne';
    case 'destroyNewestOpponentArtifactOrEnchantment':
      return "destroy your opponent's newest artifact or enchantment";
    case 'preventCombat':
      return 'prevent all combat damage that would be dealt this turn';
    case 'reclaim':
      return 'return target creature card from your graveyard to your hand';
    case 'grind': {
      const cards = op.n === 1 ? 'the top card' : `the top ${op.n} cards`;
      return op.who === 'self'
        ? `put ${cards} of your deck into your graveyard`
        : `your opponent puts ${cards} of their deck into their graveyard`;
    }
    case 'foresee':
      return `Foresee ${op.n}`;
    case 'awaken':
      return op.scope === 'self' ? 'Awaken this' : 'Awaken all creatures you control';
    case 'raise':
      // The graveyard is an ordered pile and `raise top` takes the
      // most-recently-buried creature, so the face must say WHICH card it
      // returns: "another creature card" hid that (player report 2026-08-25).
      // "other" carries the dies-trigger exclusion instead - a raise fired by
      // a dies trigger skips its own source (EffectContext.selfGraveExclusion).
      if (op.to !== 'top') return 'return target creature card from your graveyard to play';
      return excludesSelf
        ? 'return the top other creature card of your graveyard to play'
        : 'return the top creature card of your graveyard to play';
  }
}

export function manaCostText(cost: ManaCost): string {
  const parts: string[] = [];
  if (cost.generic > 0) parts.push(`{${cost.generic}}`);
  for (const color of ['W', 'U', 'B', 'R', 'G'] as Color[]) {
    for (let i = 0; i < (cost.pips[color] ?? 0); i++) parts.push(`{${color}}`);
  }
  return parts.join('') || '{0}';
}

export function empowerText(d: CardDef): string | undefined {
  if (!d.empower) return undefined;
  const body = d.empower.ops.map((op) => opText(op)).join(', then ');
  const cap = body.charAt(0).toUpperCase() + body.slice(1);
  return `Empower ${manaCostText(d.empower.cost)}: ${cap}.`;
}

export function riteText(d: CardDef): string | undefined {
  if (!d.rite) return undefined;
  return `Rite ${d.rite.n}.`;
}

export function nineLivesText(d: CardDef): string | undefined {
  if (!d.nineLives) return undefined;
  return 'Nine Lives.';
}

export function preserveText(d: CardDef): string | undefined {
  if (!d.preserve) return undefined;
  const cost = manaCostText(d.preserve.cost);
  return `Preserve ${cost}.`;
}

export function skimText(d: CardDef): string | undefined {
  if (!d.skim) return undefined;
  return `Skim ${manaCostText(d.skim.cost)}: Discard this card, then draw a card.`;
}

export function retellText(d: CardDef): string | undefined {
  if (!d.retell) return undefined;
  return `Retell ${manaCostText(d.retell.cost)}: You may cast this from your graveyard, then sever it.`;
}

export function hauntlinkText(d: CardDef): string | undefined {
  if (!d.hauntlink) return undefined;
  const rider = d.hauntlink.linked;
  const signed = (value: number | undefined): string => {
    const n = value ?? 0;
    return `${n >= 0 ? '+' : ''}${n}`;
  };
  const stats = rider.p !== undefined || rider.t !== undefined
    ? `${signed(rider.p)}/${signed(rider.t)}`
    : null;
  const keywords = rider.grantKeywords?.map((keyword) => KEYWORD_NAMES[keyword]).join(', ') ?? '';
  const benefit = stats && keywords
    ? `gets ${stats} and gains ${keywords}`
    : stats
      ? `gets ${stats}`
      : `gains ${keywords}`;
  return `Hauntlink ${manaCostText(d.hauntlink.cost)}: At Charm speed, link this to a creature you control or move it to another. Linked: The linked creature ${benefit}. This dies with its host.`;
}

function abilityText(ab: AbilityDef): string {
  const questCondition = (ab.condition ?? ab.static?.condition) === 'questActive';
  const conditionalArrival = questCondition && ab.when === 'arrives';
  const prefix = questCondition && !conditionalArrival ? 'While a Quest is active, ' : '';
  if (ab.when === 'static' && ab.static) {
    const st = ab.static;
    const sign = (v: number | undefined): string => {
      const n = v ?? 0;
      return n >= 0 ? `+${n}` : `${n}`;
    };
    // A static with no `p` and no `t` is a pure keyword grant. Both defaulted
    // to 0 below, so twelve cards printed a literal "+0/+0" clause that Magic
    // never prints (Galahad, Silver Oath among them, live at deck_count 2).
    // Omit the stat clause instead of rendering a no-op modifier.
    const hasStats = st.p !== undefined || st.t !== undefined;
    const keywordNames = st.grantKeywords?.length
      ? st.grantKeywords.map((k) => KEYWORD_NAMES[k]).join(', ')
      : '';
    const kw = keywordNames
      ? `${st.scope === 'filter' ? ', and gain' : ', and gains'} ${keywordNames}`
      : '';
    // Neither stats nor keywords is a meaningless static. Emit nothing and let
    // the caller drop the line rather than print a bare "gets ." fragment.
    if (!hasStats && !keywordNames) return '';
    // These clauses are written to stand alone, so they open with a capital.
    // Run one in behind a prefix and it reads "While a Quest is active, This
    // gains Untouchable." Lower-case the opener when a prefix precedes it.
    const runIn = (clause: string): string =>
      prefix ? `${prefix}${clause.charAt(0).toLowerCase()}${clause.slice(1)}` : clause;
    if (st.scope === 'attached') {
      // "Enchanted Creature" stays capitalized even behind a prefix: it is a
      // game term here, fixed by the user-approved copy (Wings of Dawn,
      // 2026-07-24), and stat-only auras must not read differently.
      return hasStats
        ? `${prefix}Enchanted Creature gets ${sign(st.p)}/${sign(st.t)}${kw}.`
        : `${prefix}Enchanted Creature gains ${keywordNames}.`;
    }
    if (st.scope === 'self') {
      return runIn(hasStats
        ? `This gets ${sign(st.p)}/${sign(st.t)}${kw}.`
        : `This gains ${keywordNames}.`);
    }
    const who = st.filter?.subtype
      ? `${st.filter.other ? 'Other ' : ''}${st.filter.subtype} creatures you control`
      : `${st.filter?.other ? 'Other creatures' : 'Creatures'} you control`;
    return runIn(hasStats
      ? `${who} get ${sign(st.p)}/${sign(st.t)}${kw}.`
      : `${who} gain ${keywordNames}.`);
  }

  let targetAlreadyNamed = false;
  const body = (ab.ops ?? []).map((op) => {
    // A dies trigger excludes the source's own card from a graveyard raise.
    const text = opText(op, ab.targets?.[0], targetAlreadyNamed, ab.when === 'dies');
    targetAlreadyNamed ||= referencesAbilityTarget(op);
    return text;
  }).join(', then ');
  const cap = body.charAt(0).toUpperCase() + body.slice(1);
  let sentence: string;
  switch (ab.when) {
    case 'spell':
      sentence = `${cap}.`;
      break;
    case 'arrives':
      sentence = `${conditionalArrival ? 'If a Quest is active when this arrives' : 'When this arrives'}, ${body}.`;
      break;
    case 'dies':
      sentence = `When this dies, ${body}.`;
      break;
    case 'entersGraveyard':
      sentence = `When this enters your graveyard, ${body}.`;
      break;
    case 'dawn':
      sentence = `At the start of your turn, ${body}.`;
      break;
    case 'combatDamageToPlayer':
      sentence = `Whenever this deals combat damage to a player, ${body}.`;
      break;
    case 'attacks':
      sentence = `Whenever this attacks, ${body}.`;
      break;
    default:
      sentence = `${cap}.`;
      break;
  }
  // Twelve cards printed a mid-sentence capital: "While a Quest is active, At
  // the start of your turn, you gain 1 life." The sentence is built to stand
  // alone, so lower-case its first letter once a prefix runs in front of it.
  const runOn = prefix ? sentence.charAt(0).toLowerCase() + sentence.slice(1) : sentence;
  return `${prefix}${runOn}`;
}

export function romanNumeral(n: number): string {
  const numerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let remaining = n;
  for (const [value, numeral] of numerals) {
    while (remaining >= value) {
      out += numeral;
      remaining -= value;
    }
  }
  return out;
}

function chapterText(ops: EffectOp[], index: number): string {
  const body = ops.map((op) => opText(op)).join(', then ');
  if (!body) return `Chapter ${romanNumeral(index + 1)}.`;
  const cap = body.charAt(0).toUpperCase() + body.slice(1);
  return `Chapter ${romanNumeral(index + 1)}: ${cap}.`;
}

function awakeningText(d: CardDef): string {
  const awakening = d.awakening!;
  const sign = (v: number | undefined): string => `${(v ?? 0) >= 0 ? '+' : ''}${v ?? 0}`;
  const keywords = awakening.keywords?.map((k) => KEYWORD_NAMES[k]).join(', ');
  return `Awakening: ${sign(awakening.p)}/${sign(awakening.t)}${keywords ? `, ${keywords}` : ''}`;
}

/**
 * Generated oracle text: keywords line + one line per ability. With
 * `opts.reminders` (the settings.keywordReminders toggle), each keyword expands
 * to its own "Name: reminder" line so new players learn what it does; the card
 * face's shrink-to-fit degrades the denser text gracefully.
 */
export function rulesText(d: CardDef, opts?: { reminders?: boolean }): string {
  const lines: string[] = [];
  if (d.keywords?.length) {
    if (opts?.reminders) {
      for (const k of d.keywords) lines.push(`${KEYWORD_NAMES[k]}: ${KEYWORD_REMINDER[k]}`);
    } else {
      lines.push(d.keywords.map((k) => KEYWORD_NAMES[k]).join(', '));
    }
  }
  // Every tapped land prints its universal arrival drawback, including mono
  // taplands whose arrival rider is listed below.
  if (d.entersTapped) {
    lines.push('Arrives tapped.');
  }
  if (d.awakening) lines.push(awakeningText(d));
  const skim = skimText(d);
  if (skim) lines.push(skim);
  const hauntlink = hauntlinkText(d);
  if (hauntlink) lines.push(hauntlink);
  const rite = riteText(d);
  if (rite) lines.push(rite);
  const nineLives = nineLivesText(d);
  if (nineLives) lines.push(nineLives);
  const preserve = preserveText(d);
  if (preserve) lines.push(preserve);
  const empower = empowerText(d);
  if (empower) lines.push(empower);
  for (const [index, chapter] of (d.chapters ?? []).entries()) {
    lines.push(chapterText(chapter, index));
  }
  // Non-land mana abilities are NOT part of the text: CardView composes an
  // icon line ([T]: Add [pip]) at the top of the rules box instead.
  for (const ab of d.abilities ?? []) lines.push(abilityText(ab));
  // Retell prints LAST, below the effect it recasts (the printed-card
  // convention for graveyard recast lines; user-reported 2026-07-31 that
  // leading with Retell read backwards).
  const retell = retellText(d);
  if (retell) lines.push(retell);
  // abilityText returns '' for a static carrying neither stats nor keywords;
  // joining it unfiltered would print a blank line into the rules box.
  return lines.filter((line) => line.length > 0).join('\n');
}

export interface GlossaryEntry {
  name: string;
  reminder: string;
}

/**
 * Every keyword and named mechanic a card's face references: its own keyword
 * line, keywords granted or named inside its rules text, and its named
 * mechanics. Keywords still come off the generated rulesText so any op that
 * prints a trait surfaces its definition (the inspect Keyword Guide used to
 * miss those — Morrigan showed Skyborne but not Foresee/Sever). The mechanics
 * half reads `cardMechanics`, the same structural detector Collection search
 * uses, so the guide and the search box can never disagree about which
 * mechanics a card has.
 */
export function cardGlossaryEntries(d: CardDef): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  const seen = new Set<string>();
  const push = (name: string, reminder: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    entries.push({ name, reminder });
  };
  for (const k of d.keywords ?? []) push(KEYWORD_NAMES[k], KEYWORD_REMINDER[k]);
  const text = rulesText(d).toLowerCase();
  for (const k of Object.keys(KEYWORD_NAMES) as Keyword[]) {
    if (new RegExp(`\\b${KEYWORD_NAMES[k].toLowerCase()}\\b`).test(text)) {
      push(KEYWORD_NAMES[k], KEYWORD_REMINDER[k]);
    }
  }
  for (const mechanic of cardMechanics(d)) {
    push(MECHANIC_NAMES[mechanic], MECHANIC_DEFINITIONS[mechanic]);
  }
  return entries;
}

export function typeLine(d: CardDef): string {
  // Tokens show their subtypes (user feedback 2026-07-18: Bloomlings counting
  // as hidden Fae confused tribal math; supersedes the 2026-07-13 no-subtypes
  // request that caused it). Format "Creature (Token): Type" per user
  // feedback 2026-07-24 (batch 3 item 6).
  if (d.token) {
    const types = d.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
    const subs = d.subtypes.length > 0 ? `: ${d.subtypes.join(' ')}` : '';
    return `${types} (Token)${subs}`;
  }
  const supers = (d.supertypes ?? [])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
  const types = d.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  const subs = d.subtypes.length > 0 ? `: ${d.subtypes.join(' ')}` : '';
  return `${supers ? supers + ' ' : ''}${types}${subs}`;
}
