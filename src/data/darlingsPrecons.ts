import type { Color } from '../engine/types';

/** A ready-to-play singleton Darlings product: 79 spells, a command-zone legend, and a Warchest. */
export interface DarlingsPrecon {
  id: string;
  name: string;
  darlingId: string;
  colors: readonly Color[];
  cards: string[];
  landReserve: string[];
  /** Short owner-gated copy used on the Shop's deck plate. */
  blurb: string;
}

export const FREE_DARLINGS_PRECON_ID = 'darlings-zhou-yu';

function precon(deck: DarlingsPrecon): DarlingsPrecon {
  return { ...deck, cards: [...deck.cards], landReserve: [...deck.landReserve] };
}

/**
 * Five dual-legend Darlings precons. These are intentionally explicit, reviewed
 * singleton lists rather than a curve-first catalog derivation: the Darling is
 * guaranteed in the command zone, so each list is built around her table role.
 */
export const DARLINGS_PRECONS: readonly DarlingsPrecon[] = [
  precon({
    id: 'darlings-zhou-yu',
    name: 'Red Cliffs Refrain',
    darlingId: 'tk-wu-zhouyu',
    colors: ['U', 'R'],
    blurb: 'Cheap fire and clever tempo turns every early opening into reach.',
    cards: [
      // Wu pressure and payoffs
      'tk-wu-sunquan', 'tk-wu-sunjian', 'tk-wu-sunce', 'tk-wu-ganning', 'tk-wu-taishici',
      'tk-wu-luxun', 'tk-wu-lumeng', 'tk-wu-lianshi', 'tk-wu-huanggai', 'tk-wu-lingtong',
      'tk-wu-xusheng', 'tk-wu-sunshangxiang', 'tk-wu-daqiao', 'tk-wu-xiaoqiao', 'tk-wu-lusu',
      'tk-wu-chengpu', 'tk-wu-handang', 'tk-wu-zhuran', 'tk-wu-quancong', 'tk-wu-zhugeke',
      // Secondary bodies that keep the spell-heavy list from folding to pressure
      'gk-hermes', 'rg-mist-wraith', 'rg-charon-ferryman', 'rg-fate-reader', 'gm-lab-sparkmage',
      'yn-signal-kitsune', 'dt-lantern-tower-witch', 'dt-midnight-glass-runner', 'gm-victorine-lightning-heir',
      // One- and two-mana spells establish the burn and tempo floor
      'cf-bargain-for-time', 'cf-fae-spark', 'cf-fogbell-chime', 'cf-glimmerdust-trick', 'in-comet-blast',
      'in-fire-attack', 'in-undertow', 'rg-berserkers-fury', 'so-ember-squall', 'so-warcry',
      'cf-bargain-unwound', 'cf-clouded-memory', 'cf-ember-of-brigid', 'cf-silver-apple-shot', 'dt-dream-prick',
      'dt-lullaby-refrain', 'dt-page-torn-free', 'dt-sea-glass-knife', 'gm-red-curtain-cut', 'gm-thunderclap',
      'in-char', 'in-empty-fort-stratagem', 'in-tidal-slip', 'so-flame-lash', 'yn-backdoor-recall',
      'yn-hotwire-retort', 'yn-street-rush',
      // Reach, cards, and clean answers at the top of the curve
      'ac-queen-regents-command', 'ac-secret-of-avalon', 'cf-glamour-of-the-hill', 'dt-briar-rose-lullaby',
      'dt-clock-strikes-twelve', 'dt-lagoon-current', 'dt-mirror-hall-illusion', 'dt-palace-market-chase',
      'in-read-the-ruse', 'rg-read-the-runes', 'so-divination', 'yn-burn-the-billboard', 'yn-null-route',
      'yn-signal-bridge', 'dt-lost-in-library', 'dt-tower-braid-escape', 'dt-undersea-bargain',
      'in-dream-fracture', 'in-sudden-insight', 'so-strategic-planning', 'so-lava-axe',
      // dt-glass-slipper-at-midnight left 2026-08-29: it went {U}{B} legendary
      // (owner colour ruling) and black is off-colour for this U/R list.
      // sd-warcry-at-noon is the in-colour functional twin (team +1/+0 with a
      // keyword grant at the same mana value).
      'sd-warcry-at-noon', 'yn-foresee-the-fall',
    ],
    landReserve: [
      'ld-red-cliffs-anchorage', 'dt-ash-ballroom',
      'land-island', 'land-island', 'land-island', 'land-island',
      'land-mountain', 'land-mountain', 'land-mountain', 'land-mountain',
    ],
  }),
  precon({
    id: 'darlings-hel',
    name: 'Queen Below',
    darlingId: 'rg-hel',
    colors: ['U', 'B'],
    blurb: 'Grind the graveyard, raise the biggest threat, and make every loss useful.',
    cards: [
      // Mill engines, Draugr bodies, and real reanimation targets
      'rg-corpse-taker', 'rg-draugr-raider', 'rg-charon-ferryman', 'rg-fate-reader', 'rg-mist-wraith',
      'rg-hungry-shade', 'rg-memory-thief', 'rg-mist-seer', 'rg-norn-seeress', 'rg-runecarver',
      'rg-barrow-wight', 'rg-bog-lurker', 'rg-deaths-herald', 'rg-hels-handmaiden', 'rg-plaguebearer-draugr',
      'rg-tidecaller-vanir', 'rg-well-keeper', 'rg-norns', 'rg-thanatos', 'gk-hades',
      'gk-thanatos', 'dt-abyssal-songstress', 'dt-poison-mirror-regent', 'dt-seven-shadow-miners', 'dt-foam-silk-siren',
      'dt-frog-prince-bargain', 'dt-ice-palace-architect', 'dt-tower-window-seer', 'gm-batcloak-cutthroat', 'gm-black-veil-matron',
      'gm-blood-opera-soloist', 'gm-porcelain-governess', 'gm-ravenloft-heiress', 'gm-stitched-hound', 'gm-widow-of-the-west-wing',
      'yn-ghost-net-archon', 'yn-oni-underboss-of-rain', 'yn-oni-of-the-last-exit',
      // Cheap stocking, recursion, and interaction
      'cf-barrow-whisper', 'cf-bargain-for-time', 'cf-fogbell-chime', 'in-grave-chill',
      'in-undertow', 'rg-rune-of-hunger', 'so-raise-dead', 'yn-circuit-foretelling', 'ac-bitter-court-rumor',
      'cf-bargain-unwound', 'cf-clouded-memory', 'dt-dream-prick', 'dt-lullaby-refrain', 'dt-page-torn-free',
      'dt-sea-glass-knife', 'gm-blood-candle', 'gm-fogged-window', 'in-empty-fort-stratagem', 'in-tidal-slip',
      'rg-read-the-runes', 'so-creeping-malaise', 'so-dirge-of-loss', 'so-night-extortion', 'yn-dead-channel-ransom',
      'yn-backdoor-recall', 'yn-parasite-mask',
      // The midgame makes the graveyard a second hand
      'ac-courtly-betrayal', 'cf-gold-ring-bargain', 'cf-glamour-of-the-hill', 'dt-briar-rose-lullaby',
      'dt-ink-black-carriage', 'dt-lagoon-current', 'dt-mirror-apple-curse', 'dt-mirror-hall-illusion',
      'dt-singing-shell', 'gm-candlelit-seance', 'gm-midnight-autopsy', 'in-doom-bolt',
      'in-read-the-ruse', 'in-reapers-due', 'yn-alleyway-sever',
    ],
    landReserve: [
      'ld-moonlit-marsh', 'cf-moonlit-barrow', 'gm-stormtower-roof', 'dt-tide-cavern', 'yn-midnight-data-market',
      'land-island', 'land-island', 'land-island', 'land-swamp', 'land-swamp',
    ],
  }),
  precon({
    id: 'darlings-aine',
    name: 'Sunwell Ledger',
    darlingId: 'cf-aine-sunlit-bargain',
    colors: ['G', 'W'],
    blurb: 'Small favors become a full board, a deep life total, and patient value.',
    cards: [
      // Lifegain creatures and board-building value
      'cf-thorn-sprite', 'cf-blackthorn-duelist', 'cf-cold-moon-archer', 'cf-hazelwand-mystic', 'cf-heatherblade-scout',
      'cf-moorland-guide', 'cf-mushroom-ring-guard', 'cf-sidhe-page', 'cf-torclight-envoy', 'cf-veil-touched-hart',
      'cf-fae-court-tokenmaker', 'cf-hounds-of-annwn', 'cf-otter-familiar', 'cf-sidhe-silver-lancer', 'cf-thornmaze-patrol',
      'cf-willow-wisp-guide', 'cf-green-knoll-champion', 'cf-moundlight-midwife', 'ac-novice-squire', 'ac-ashwood-ranger',
      'ac-borderland-huntress', 'ac-camelot-banneret', 'ac-chapel-mender', 'ac-chapel-questant', 'ac-court-archer',
      'ac-keep-watchwoman', 'ac-pennant-carrier', 'ac-riverford-guard', 'ac-white-horse', 'ac-galahad-silver-oath',
      'ac-grail-hermit', 'ac-questing-beast-maiden', 'ac-root-chapel-warden', 'dt-briar-sentinel', 'ac-percival-clear-heart',
      'dt-forest-grandmother', 'dt-princess-of-thorns', 'dt-rose-petal-knight', 'dt-thorn-castle-warden', 'dt-wind-painted-scout',
      'dt-casita-miracle-keeper', 'dt-forest-colors-diplomat', 'dt-bayou-star-proprietor', 'dt-beast-manor-belle',
      // Cheap protection and steady life/value engines
      'cf-apple-of-emain', 'cf-dawn-torc', 'cf-oak-shield-vow', 'cf-thornsnare',
      'dt-satin-slipper', 'cf-ash-and-mistletoe', 'cf-cauldron-of-dagda', 'cf-cold-iron-taboo', 'cf-fade-beyond-veil',
      'cf-hill-feast', 'cf-silver-thread', 'cf-thorn-crown-geas', 'ac-questing-map', 'ac-squire-to-champion',
      'ac-steel-prayer', 'dt-bookmark-charm', 'dt-brass-lamp-charm', 'dt-ice-lace-gloves', 'dt-once-more-with-magic',
      'dt-plaid-arrow', 'dt-ragged-ballgown', 'dt-rose-petal-shield',
      // Answers and durable payoffs round out a non-greedy curve
      'ac-candlelit-vigil', 'ac-hunt-the-boar', 'ac-knights-breakfast', 'ac-lion-standard', 'ac-quest-for-the-grail',
      'ac-round-table-vow', 'ac-shieldwall-call', 'ac-sword-test-stone', 'cf-briar-veil-banishing', 'cf-ogham-fate-stones',
      'dt-apple-basket', 'dt-bayou-lantern', 'dt-candle-in-window',
    ],
    landReserve: [
      'ld-peach-garden-orchard', 'cf-sunwell-grove', 'ac-holy-well', 'dt-dreaming-castle', 'yn-rooftop-shrine-garden',
      'land-forest', 'land-forest', 'land-forest', 'land-plains', 'land-plains',
    ],
  }),
  precon({
    id: 'darlings-elizabeth',
    name: 'Mirror-Blood Rush',
    darlingId: 'gm-elizabeth-blood-mirror',
    colors: ['B', 'R'],
    blurb: 'Dreaded attackers demand bad blocks while blood magic keeps the pressure moving.',
    cards: [
      // Gothic Monsters supply the Dreaded core and the supporting blood economy
      'gm-bat-swarm', 'gm-black-cat-familiar', 'gm-blood-drop-initiate', 'gm-crow-on-gate', 'gm-haunted-doll',
      'gm-manor-thrall', 'gm-wolfbitten-hunter', 'gm-batcloak-cutthroat', 'gm-catacomb-ratcatcher', 'gm-madame-macabre',
      'gm-ravenloft-heiress', 'gm-stitched-hound', 'gm-black-veil-matron', 'gm-blood-opera-soloist', 'gm-moonlit-werewolf',
      'gm-stormglass-golem', 'gm-widow-of-the-west-wing', 'gm-carmilla-crimson-host', 'yn-tunnel-fire-dancer', 'dt-wolf-at-the-door',
      'yn-oni-bounty-agent', 'yn-oni-underboss-of-rain', 'yn-oni-of-the-last-exit', 'rg-berserker-initiate', 'rg-ember-valkyrie',
      'rg-raiding-shieldmaiden', 'rg-warband-leader', 'rg-berserker-chieftain', 'rg-berserker-duelist', 'rg-flame-jotun',
      'rg-flamecaller-jotun', 'dt-ash-maiden', 'dt-red-cloak-runner', 'dt-dragon-gem-guardian', 'dt-sandstorm-carpet-rider',
      'yn-redline-kitsune', 'yn-street-oni-scrapper', 'yn-neon-oni-brawler', 'yn-redline-oni-queen', 'yn-redline-queenpin',
      // Removal, burn, and the few pieces of reach that let Dreaded close
      'gm-blood-candle', 'gm-cellar-door', 'gm-kicked-door', 'gm-red-curtain-cut', 'gm-silvered-rapier',
      'gm-tattered-invitation', 'gm-thunderclap', 'gm-candelabra-of-souls', 'gm-candlelit-seance', 'gm-funeral-bell',
      'gm-howling-gallery', 'gm-midnight-bite', 'gm-red-moon-rampage', 'gm-black-lace-pact', 'gm-cathedral-of-bats',
      'gm-dracula-ball-invite', 'gm-midnight-autopsy', 'gm-velvet-coffin', 'gm-graveyard-waltz', 'gm-nocturne-manor',
      'gm-stormtower-resurrection', 'in-comet-blast', 'in-fire-attack', 'in-char', 'in-ram-the-gates',
      'in-doom-bolt', 'in-reapers-due', 'so-ember-squall', 'so-flame-lash', 'so-warcry',
      'so-lava-axe', 'cf-fae-spark', 'cf-ember-of-brigid', 'dt-ash-sweep', 'dt-clock-strikes-twelve',
      'dt-palace-market-chase', 'yn-hotwire-retort', 'yn-street-rush', 'yn-burn-the-billboard',
    ],
    landReserve: [
      'ld-burning-luoyang', 'yn-burning-toll-bridge',
      'land-swamp', 'land-swamp', 'land-swamp', 'land-swamp',
      'land-mountain', 'land-mountain', 'land-mountain', 'land-mountain',
    ],
  }),
  precon({
    id: 'darlings-warrior-ballad',
    name: 'Sable Warballad',
    darlingId: 'dt-warrior-ballad-captain',
    colors: ['R', 'W'],
    blurb: "Warriors curve into their lords' anthems and attack as one warband.",
    cards: [
      // The broad Warrior roster gives the Captain a real tribal deck to lead
      'tk-other-huaxiong', 'tk-other-lulingqi', 'tk-other-warband-captain', 'tk-other-lubu', 'tk-other-zhurong',
      'tk-shu-guansuo', 'tk-shu-guanping', 'tk-shu-wangping', 'tk-shu-xingcai', 'tk-shu-machao',
      'tk-shu-zhaoyun', 'tk-shu-guanyu', 'tk-wei-yuejin', 'tk-wei-xiahoudun', 'tk-wei-xiahouyuan',
      'tk-wei-xuhuang', 'tk-wei-caoren', 'tk-wei-xuchu', 'tk-wei-pangde', 'tk-wu-handang',
      'tk-wu-lingtong', 'tk-wu-chengpu', 'tk-wu-ganning', 'tk-wu-huanggai', 'tk-wu-sunjian',
      'tk-wu-sunshangxiang', 'tk-wu-taishici', 'tk-wu-zhuran', 'tk-jin-guanqiujian', 'tk-jin-wenyang',
      'ac-novice-squire', 'ac-camelot-banneret', 'ac-errant-duelist', 'ac-pennant-carrier', 'ac-torchbearer-knight',
      'ac-tournament-favorite', 'ac-galahad-silver-oath', 'ac-gawain-noonblade', 'ac-lancelot-moonlit-shame', 'gk-hoplite',
      'rg-einherjar-shieldbearer', 'rg-einherjar-champion', 'rg-honored-footman', 'rg-shu-deathless-guard', 'rg-shieldwall-maiden',
      'rg-valkyrie-scout', 'rg-dawn-valkyrie', 'rg-ember-valkyrie', 'rg-raiding-shieldmaiden', 'rg-berserker-initiate',
      'rg-berserker-chieftain', 'rg-berserker-duelist', 'rg-warband-leader', 'rg-brunhild', 'rg-zhaoyun',
      // Tribal combat tricks and on-identity answers, not a pile of cheapest bodies
      'ac-steel-prayer',
      'ac-tilting-lance', 'dt-once-more-with-magic', 'dt-rose-petal-shield', 'gm-hunters-writ', 'gm-kicked-door',
      // yn-paper-ward-signal replaced in-ram-the-gates 2026-08-28: destroy
      // target ARTIFACT over zero own artifacts was dead in the precon mirror;
      // the Signal keeps the artifact answer and stays live off our enchantments.
      'gm-red-curtain-cut', 'gm-thunderclap', 'in-char', 'in-cleanse-the-shrine', 'yn-paper-ward-signal',
      'in-stand-as-one', 'so-flame-lash', 'so-muster-militia', 'ac-lion-standard', 'ac-quest-for-the-grail',
      'ac-rallying-horn', 'ac-round-table-vow', 'ac-shieldwall-call', 'ac-training-yard', 'cf-briar-veil-banishing',
      'dt-ash-sweep', 'dt-training-yard-dawn', 'gk-ares',
    ],
    landReserve: [
      'ld-beacon-ridge', 'dt-reflection-pond',
      'land-plains', 'land-plains', 'land-plains', 'land-plains',
      'land-mountain', 'land-mountain', 'land-mountain', 'land-mountain',
    ],
  }),
] as const;

/** Directly consumable by `runReserveMatrix`: one 79-spell Darlings fleet per SKU. */
export const DARLINGS_PRECON_MATRIX_FLEET = DARLINGS_PRECONS;
