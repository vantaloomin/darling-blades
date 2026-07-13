import type { AbilityDef, CardDef, CardType, EffectOp, Keyword } from '../engine/types';
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
};

/** One-line, player-facing definitions for non-keyword mechanics (glossary). */
export const MECHANIC_DEFINITIONS: Record<'sever' | 'foresee', string> = {
  sever: 'severed from the game; severed cards never return',
  foresee: 'look at the top cards of your deck; put any of them on the bottom',
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

function opText(op: EffectOp): string {
  switch (op.op) {
    case 'damage': {
      const n = op.n === 'X' ? 'X' : op.n;
      if (op.to === 'controller') return `this deals ${n} damage to you`;
      if (op.to === 'opponent') return `this deals ${n} damage to your opponent`;
      return `deal ${n} damage to any target`;
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
      return 'destroy target creature';
    case 'sever':
      return 'sever target creature';
    case 'severGrave': {
      const cards = op.n === 1 ? 'the top card' : `the top ${op.n} cards`;
      return op.who === 'self'
        ? `sever ${cards} of your graveyard`
        : `sever ${cards} of your opponent's graveyard`;
    }
    case 'severTop':
      return `sever ${op.n === 1 ? 'the top card' : `the top ${op.n} cards`} of your deck`;
    case 'recall':
      return "return target creature to its owner's hand";
    case 'cancel':
      return 'cancel target spell';
    case 'boost': {
      const sign = (v: number): string => (v >= 0 ? `+${v}` : `${v}`);
      const kw = op.keywords?.length
        ? ` and gain${op.scope === 'target' ? 's' : ''} ${op.keywords.map((k) => KEYWORD_NAMES[k].toLowerCase()).join(', ')}`
        : '';
      return op.scope === 'target'
        ? `target creature gets ${sign(op.p)}/${sign(op.t)}${kw} until end of turn`
        : `creatures you control get ${sign(op.p)}/${sign(op.t)}${kw} until end of turn`;
    }
    case 'addCounters':
      return op.to === 'self'
        ? `put ${op.n} +1/+1 counter${op.n === 1 ? '' : 's'} on this`
        : `put ${op.n} +1/+1 counter${op.n === 1 ? '' : 's'} on target creature`;
    case 'tap':
      return 'tap target creature';
    case 'fetchLand':
      return 'search your deck for a basic land and put it into play tapped';
    case 'createToken': {
      // Say WHAT gets created — "create 2 tokens" left players guessing
      // (user-reported 2026-07-12). The full catalog (expansion tokens
      // included) is the lookup, with the old wording as the fallback.
      const tok: CardDef | undefined = CARD_DB[op.token];
      const plural = op.count === 1 ? 'token' : 'tokens';
      if (!tok) return `create ${op.count} ${plural}`;
      const stats = tok.attack !== undefined && tok.defense !== undefined ? `${tok.attack}/${tok.defense} ` : '';
      const kw = tok.keywords?.length
        ? ` with ${tok.keywords.map((k) => KEYWORD_NAMES[k].toLowerCase()).join(', ')}`
        : '';
      return `create ${op.count} ${stats}${tok.name} ${plural}${kw}`;
    }
    case 'massDestroy':
      return op.filter === 'allCreatures' ? 'destroy all creatures' : 'destroy all creatures with Skyborne';
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
      return `foresee ${op.n}`;
    case 'raise':
      return op.to === 'top'
        ? 'return the top creature card of your graveyard to play'
        : 'return target creature card from your graveyard to play';
  }
}

function abilityText(ab: AbilityDef): string {
  if (ab.when === 'static' && ab.static) {
    const st = ab.static;
    const sign = (v: number | undefined): string => {
      const n = v ?? 0;
      return n >= 0 ? `+${n}` : `${n}`;
    };
    const kw = st.grantKeywords?.length
      ? ` and have ${st.grantKeywords.map((k) => KEYWORD_NAMES[k].toLowerCase()).join(', ')}`
      : '';
    if (st.scope === 'attached') {
      return `Enchanted creature gets ${sign(st.p)}/${sign(st.t)}${kw}.`;
    }
    const who = st.filter?.subtype
      ? `${st.filter.other ? 'Other ' : ''}${st.filter.subtype} creatures you control`
      : `${st.filter?.other ? 'Other creatures' : 'Creatures'} you control`;
    return `${who} get ${sign(st.p)}/${sign(st.t)}${kw}.`;
  }

  const body = (ab.ops ?? []).map(opText).join(', then ');
  const cap = body.charAt(0).toUpperCase() + body.slice(1);
  switch (ab.when) {
    case 'spell':
      return `${cap}.`;
    case 'arrives':
      return `When this arrives, ${body}.`;
    case 'dies':
      return `When this dies, ${body}.`;
    case 'dawn':
      return `At the start of your turn, ${body}.`;
    case 'combatDamageToPlayer':
      return `Whenever this deals combat damage to a player, ${body}.`;
    case 'attacks':
      return `Whenever this attacks, ${body}.`;
    default:
      return `${cap}.`;
  }
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
  if (d.manaAbility?.length && !d.types.includes('land')) {
    lines.push(`Tap: add ${d.manaAbility.join(' or ')}.`);
  }
  for (const ab of d.abilities ?? []) lines.push(abilityText(ab));
  return lines.join('\n');
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
  return entries;
}

export function typeLine(d: CardDef): string {
  const supers = (d.supertypes ?? [])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
  const types = d.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  const subs = d.subtypes.length > 0 ? ` — ${d.subtypes.join(' ')}` : '';
  return `${supers ? supers + ' ' : ''}${types}${subs}`;
}
