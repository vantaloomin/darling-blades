import type { AbilityDef, CardDef, EffectOp, Keyword } from '../engine/types';

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
  bloodoath: 'Bloodoath',
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
    case 'bounce':
      return "return target creature to its owner's hand";
    case 'counter':
      return 'counter target spell';
    case 'pump': {
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
    case 'rampBasic':
      return 'search your library for a basic land and put it onto the battlefield tapped';
    case 'createToken':
      return `create ${op.count} ${op.count === 1 ? 'token' : 'tokens'}`;
    case 'massDestroy':
      return op.filter === 'allCreatures' ? 'destroy all creatures' : 'destroy all creatures with Skyborne';
    case 'fog':
      return 'prevent all combat damage that would be dealt this turn';
    case 'regrowth':
      return 'return target creature card from your graveyard to your hand';
    case 'mill': {
      const cards = op.n === 1 ? 'a card' : `${op.n} cards`;
      return op.who === 'self' ? `mill ${cards}` : `your opponent mills ${cards}`;
    }
    case 'reanimate':
      return op.to === 'top'
        ? 'return the top creature card of your graveyard to the battlefield'
        : 'return target creature card from your graveyard to the battlefield';
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
    case 'etb':
      return `When this enters the battlefield, ${body}.`;
    case 'dies':
      return `When this dies, ${body}.`;
    case 'upkeep':
      return `At the beginning of your upkeep, ${body}.`;
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
 * to its own "Name — reminder" line so new players learn what it does; the card
 * face's shrink-to-fit degrades the denser text gracefully.
 */
export function rulesText(d: CardDef, opts?: { reminders?: boolean }): string {
  const lines: string[] = [];
  if (d.keywords?.length) {
    if (opts?.reminders) {
      for (const k of d.keywords) lines.push(`${KEYWORD_NAMES[k]} — ${KEYWORD_REMINDER[k]}`);
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

export function typeLine(d: CardDef): string {
  const supers = (d.supertypes ?? [])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
  const types = d.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  const subs = d.subtypes.length > 0 ? ` — ${d.subtypes.join(' ')}` : '';
  return `${supers ? supers + ' ' : ''}${types}${subs}`;
}
