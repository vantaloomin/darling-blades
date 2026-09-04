import type { CardDef } from '../engine/types';

export type PermClass = 'ONE-SHOT' | 'RECURRING' | 'STATIC' | 'ACTIVATED' | 'DEATH' | 'LINK' | 'MIXED' | 'BLANK';

export interface PermanentClassResult {
  klass: PermClass;
  evidence: string;
  riders: string;
}

export function classifyPermanent(card: CardDef): PermanentClassResult {
  const classes = new Set<PermClass>();
  const evidence: string[] = [];

  for (const a of card.abilities ?? []) {
    switch (a.when) {
      case 'static':
        classes.add('STATIC');
        evidence.push('static');
        break;
      case 'arrives':
      case 'spell':
        classes.add('ONE-SHOT');
        evidence.push(a.when === 'spell' ? 'on cast' : 'arrives');
        break;
      case 'dawn':
        classes.add('RECURRING');
        evidence.push('start of turn');
        break;
      case 'attacks':
      case 'combatDamageToPlayer':
        classes.add('RECURRING');
        evidence.push(a.when);
        break;
      case 'dies':
      case 'entersGraveyard':
        classes.add('DEATH');
        evidence.push(a.when === 'dies' ? 'dies' : 'enters graveyard');
        break;
      default:
        // Every other trigger (ally arrivals, Mark events, Propagate, marked
        // attackers, ...) can fire again and again while the permanent is out.
        // Without this branch the Starborne "whenever" cards read as BLANK.
        classes.add('RECURRING');
        evidence.push(a.when);
        break;
    }
  }

  if (card.hauntlink) {
    classes.add('LINK');
    evidence.push('Hauntlink');
  }
  // A Quest advances a chapter every turn it is out, which is the definition of
  // a recurring permanent even though it carries no AbilityDef.
  if (card.chapters?.length) {
    classes.add('RECURRING');
    evidence.push(`quest (${card.chapters.length} chapters)`);
  }
  // The only activated battlefield ability our engine has is tapping for mana.
  if (card.manaAbility?.length) {
    classes.add('ACTIVATED');
    evidence.push(`taps for ${card.manaAbility.join('')}`);
  }

  const riders: string[] = [];
  if (card.skim) riders.push('Skim (hand only — does not count)');
  if (card.empower) riders.push('Empower (cast rider on the arrival)');
  if (card.retell) riders.push('Retell (graveyard cast)');
  if (card.rite) riders.push(`Rite ${card.rite.n} (creature sacrifice cost)`);
  if (card.nineLives) riders.push('Nine Lives (returns once)');
  if (card.preserve) riders.push('Preserve (graveyard activation)');
  if (card.hauntlink) riders.push('Hauntlink (Charm-speed battlefield link action)');

  const klass: PermClass =
    classes.size === 0 ? 'BLANK' : classes.size === 1 ? [...classes][0] : 'MIXED';
  return { klass, evidence: evidence.sort().join(', ') || 'nothing on the battlefield', riders: riders.join('; ') };
}
