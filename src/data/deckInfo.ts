export interface DeckInfo {
  colors: string;
  archetype: string;
  plays: string;
  featured: string[];
}

/**
 * Shop-facing deck identity and signature-card picks. Featured ids are kept
 * beside the authored presentation copy so the preview can remain data-driven
 * without pulling Phaser into the data layer.
 */
export const DECK_INFO: Record<string, DeckInfo> = {
  'starter-crimson': {
    colors: 'R/W',
    archetype: 'Warband aggro',
    plays:
      'Flood the board with cheap warband bodies and end the game before slower decks set up; Nike and Ares turn a wide board lethal. Light on answers: if the rush stalls, it runs out of gas.',
    featured: ['tk-other-lubu', 'gk-ares', 'gk-nike'],
  },
  'starter-wild': {
    colors: 'G/W',
    archetype: 'Beastkin tribal',
    plays:
      'Curve out with efficient Beastkin and win through big, straightforward combat, with Liu Bei rallying the warband wide. No tricks beyond the creatures themselves.',
    featured: ['gk-athena', 'bk-packmother', 'tk-shu-liubei'],
  },
  'starter-tides': {
    colors: 'U/R',
    archetype: 'Wu tempo-burn',
    plays:
      'Land early evasive threats, then protect the lead: Fire Attack clears blockers while Undertow buys the tempo back. Punishing when ahead, fragile when behind.',
    featured: ['tk-wu-sunce', 'tk-wu-sunquan', 'in-fire-attack'],
  },
  'starter-mandate': {
    colors: 'U/B',
    archetype: 'Jin control',
    plays:
      'Trade one-for-one with removal and card draw, grind value with Jin schemers, and take over the late game. The slowest starter: you exhaust the opponent rather than race them.',
    featured: ['tk-jin-simayi', 'tk-jin-zhangchunhua', 'in-doom-bolt'],
  },
  'starter-harvest': {
    colors: 'B/G',
    archetype: 'Underworld attrition',
    plays:
      'Trade freely (Deathblade blockers make every exchange profitable), then Raise Dead rebuilds your board from the graveyard. Patient, grindy midrange.',
    featured: ['gk-persephone', 'gk-hades', 'so-raise-dead'],
  },
  'theme-ragnarok': {
    colors: 'B/G',
    archetype: 'Ragnarök reanimator',
    plays:
      'Mill your own creatures into the graveyard, then cheat the fattest Jotun back with Call the Einherjar. Explosive once the yard fills; awkward when the pieces arrive in the wrong order.',
    featured: ['rg-draugr-jarl', 'rg-jotun-earthshaker', 'rg-call-the-einherjar'],
  },
  'theme-celtic-fae': {
    colors: 'U/B/G',
    archetype: 'Silver Veil tempo-control',
    plays:
      'Evasive fae chip in while Foresee smooths your draws and bounce effects hold the board back. Every turn is a tempo decision; this is the highest-skill deck in the shop.',
    featured: ['cf-morrigan-black-wing', 'cf-selkie-tide-queen', 'cf-bargain-for-time'],
  },
  'theme-arthurian-court': {
    colors: 'W/U',
    archetype: 'Heroic Quest midrange',
    plays:
      'Build a court of Knights, keep a Quest active, and let chapter payoffs turn a disciplined board into awakened champions. Undertow and Shieldwall protect the tempo so the court attacks with a plan.',
    featured: ['ac-artoria-once-future', 'ac-quest-for-the-grail', 'ac-galahad-silver-oath'],
  },
  'theme-gothic-monsters': {
    colors: 'B/R',
    archetype: 'Vampire pressure',
    plays:
      'Start with Dreaded attackers and evasive vampires, then make every exchange hurt. Damage spells clear the path while Empower turns the late game into a velvet drain. Carmilla, Crimson Host closes the curtain when the night runs long.',
    featured: ['gm-carmilla-crimson-host', 'gm-black-veil-matron', 'gm-dracula-ball-invite'],
  },
};
