import type {
  AbilityDef,
  CardDef,
  CardType,
  Color,
  EffectOp,
  Keyword,
  ManaCost,
  TargetSpec,
} from '../engine/types';
import { CARD_DB } from '../data/catalog';

export const KEYWORD_NAMES: Record<Keyword, string> = {
  skyborne: 'Skyborne',
  wardingGaze: 'Warding Gaze',
  firstBlade: 'First Blade',
  twinBlades: 'Twin Blades',
  warcry: 'Warcry',
  overrun: 'Overrun',
  sentinel: 'Sentinel',
  bulwark: 'Bulwark',
  deathblade: 'Deathblade',
  bloodoath: 'Blood Oath',
  untouchable: 'Untouchable',
  dreaded: 'Dreaded',
};

/** One-line, player-facing reminder for each evergreen keyword (F9 glossary). */
export const KEYWORD_REMINDER: Record<Keyword, string> = {
  skyborne: 'can only be blocked by creatures with Skyborne or Warding Gaze',
  wardingGaze: 'can block creatures with Skyborne',
  firstBlade: 'deals combat damage before creatures without First Blade',
  twinBlades: 'deals combat damage both before and alongside other creatures',
  warcry: 'can attack and tap the turn it arrives',
  overrun: 'excess combat damage past its blockers is dealt to the player',
  sentinel: 'attacking does not cause it to tap',
  bulwark: 'cannot attack',
  deathblade: 'any amount of damage it deals to a creature is lethal',
  bloodoath: 'damage it deals also gains you that much life',
  untouchable: 'cannot be targeted by spells or abilities your opponents control',
  dreaded: 'cannot be blocked except by two or more creatures',
};

/** One-line, player-facing definitions for non-keyword mechanics (glossary). */
export const MECHANIC_DEFINITIONS: Record<
  'sever' | 'foresee' | 'mark' | 'quest' | 'championAwakening' | 'empower' | 'skim' | 'retell' | 'hauntlink',
  string
> = {
  sever: 'severed from the game; severed cards never return',
  foresee: 'look at the top cards of your deck; put any of them on the bottom',
  mark: 'a lasting +1/+1 increase to a creature\'s Attack and Defense',
  quest: 'advances a chapter at each of your dawns; leaves after the last',
  championAwakening: 'a one-way upgrade granting the listed stats and keywords',
  empower: 'pay the extra cost as you cast this for the listed bonus effect',
  skim: 'pay the listed cost, discard this card, then draw a card',
  retell: 'cast this from your graveyard for the listed cost, then sever it',
  hauntlink: 'pay Hauntlink at Charm speed to link this permanent to one of your creatures',
};

/** One-line player-facing definitions for the card types used in the glossary. */
export const CARD_TYPE_DEFINITIONS: Record<CardType, string> = {
  creature: 'A permanent fighter that can attack and block.',
  charm: 'Cast anytime you have priority, even on the foe\'s turn.',
  ritual: 'Cast only during one of your own main phases.',
  enchantment: 'A lasting spell that changes a creature or the battlefield.',
  artifact: 'A lasting relic with abilities or ongoing effects.',
  land: 'Play one each turn to tap for mana.',
};

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

function opText(op: EffectOp, target?: TargetSpec, targetAlreadyNamed = false): string {
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
      return 'destroy target artifact if it is an artifact; otherwise, Sever it if it is an enchantment';
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
      return op.to === 'top'
        ? 'return the top creature card of your graveyard to play'
        : 'return target creature card from your graveyard to play';
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
    const text = opText(op, ab.targets?.[0], targetAlreadyNamed);
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
 * line, keywords granted/named inside its rules text, and the Sever/Foresee
 * mechanics. Derived from the generated rulesText so any op that prints a
 * term automatically surfaces its definition (the inspect Keyword Guide was
 * missing mechanics — e.g. Morrigan showed Skyborne but not Foresee/Sever).
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
  if (/\bforesee\b/.test(text)) push('Foresee', MECHANIC_DEFINITIONS.foresee);
  if (/\bsever(s|ed)?\b/.test(text)) push('Sever', MECHANIC_DEFINITIONS.sever);
  if (/\bmarks?\b/.test(text)) push('Mark', MECHANIC_DEFINITIONS.mark);
  if (d.chapters) push('Quest', MECHANIC_DEFINITIONS.quest);
  if (d.awakening) push('Champion Awakening', MECHANIC_DEFINITIONS.championAwakening);
  if (d.empower) push('Empower', MECHANIC_DEFINITIONS.empower);
  if (d.skim) push('Skim', MECHANIC_DEFINITIONS.skim);
  if (d.retell) push('Retell', MECHANIC_DEFINITIONS.retell);
  if (d.hauntlink) push('Hauntlink', MECHANIC_DEFINITIONS.hauntlink);
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
