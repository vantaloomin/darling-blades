import type { AbilityDef, CardDef, CardType, Color, EffectOp, Keyword, TargetSpec } from '../../engine/types';
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

export const YOKAI_SPEC_ROWS = [
  {
    "id": "yn-queen-of-the-lanterned-roof",
    "name": "Queen of the Lanterned Roof",
    "rarity": "UR",
    "color": "W",
    "type": "Legendary Creature (Kitsune Queen)",
    "cost": "{5}{W}",
    "stats": "6/6",
    "mechanics": "Skyborne, Sentinel. Your other Kitsune get +1/+1.",
    "flavor": "She rules from a rooftop palace where every lantern is a sworn witness."
  },
  {
    "id": "yn-hauntlink-apex",
    "name": "Hauntlink Apex",
    "rarity": "UR",
    "color": "U",
    "type": "Artifact",
    "cost": "{5}{U}",
    "stats": "-",
    "mechanics": "At dawn: draw 1. Hauntlink {3}{U}. Linked: The linked creature gets +3/+3, Skyborne, and Untouchable. (AI-risk survivor.)",
    "flavor": "The perfect possession is a partnership until one voice stops answering."
  },
  {
    "id": "yn-oni-of-the-last-exit",
    "name": "Oni of the Last Exit",
    "rarity": "UR",
    "color": "B",
    "type": "Legendary Creature (Oni Avatar)",
    "cost": "{6}{B}",
    "stats": "7/6",
    "mechanics": "Dreaded, Deathblade. Arrives: opponent loses 4 life. Dies: opponent loses 4 life.",
    "flavor": "Every road out of the city passes beneath her shadow."
  },
  {
    "id": "yn-kitsune-neon-tyrant",
    "name": "Kitsune Neon Tyrant",
    "rarity": "UR",
    "color": "R",
    "type": "Legendary Creature (Kitsune Boss)",
    "cost": "{4}{R}",
    "stats": "6/5",
    "mechanics": "Warcry, Overrun. When this attacks: deal 2 damage to opponent, then deal 1 damage to you.",
    "flavor": "Her tailfire turns the skyline into a personal victory lap."
  },
  // Slate cut to {5}{G} REVERTED 2026-08-29: formula v3 flags that cut as
  // direction-reversed (already hot at {6}{G}), and it displaced gk-gaia
  // from starter-wild's converter fill, breaking the marked-supply gate.
  {
    "id": "yn-rain-circuit-sovereign",
    "name": "Rain-Circuit Sovereign",
    "rarity": "UR",
    "color": "G",
    "type": "Legendary Creature (Spirit Sovereign)",
    "cost": "{6}{G}",
    "stats": "7/7",
    "mechanics": "Sentinel, Blood Oath. Arrives: gain 4 life, then Foresee 2.",
    "flavor": "The old forest wears the city as jewelry and grows stronger under every light."
  },
  {
    "id": "yn-lantern-court-regent",
    "name": "Lantern-Court Regent",
    "rarity": "SSR",
    "color": "W",
    "type": "Legendary Creature (Kitsune Regent)",
    "cost": "{4}{W}",
    "stats": "4/5",
    "mechanics": "Sentinel. Your other Kitsune get +1/+1.",
    "flavor": "The court follows her because every other route ends in rain."
  },
  {
    "id": "yn-white-veil-collapse",
    "name": "White-Veil Collapse",
    "rarity": "SSR",
    "color": "W",
    "type": "Ritual",
    "cost": "{2}{W}{W}",
    "stats": "-",
    "mechanics": "Destroy all creatures; gain 4 life. [ANSWER: creature swarm and anthem-backed wide boards.]",
    "flavor": "Her veil falls, and the armies beneath it leave no shadow."
  },
  {
    "id": "yn-ghost-net-archon",
    "name": "Ghost-Net Archon",
    "rarity": "SSR",
    "color": "U",
    "type": "Legendary Creature (Spirit Archon)",
    "cost": "{5}{U}",
    "stats": "5/5",
    "mechanics": "Skyborne, Untouchable. Arrives: Foresee 3.",
    "flavor": "It rules a private cloud where every dead password still sings."
  },
  {
    "id": "yn-unanswered-signal",
    "name": "Unanswered Signal",
    "rarity": "SSR",
    "color": "U",
    "type": "Enchantment",
    "cost": "{3}{U}",
    "stats": "-",
    "mechanics": "At dawn: draw 1. Hauntlink {3}{U}. Linked: The linked creature gets Skyborne and Untouchable.",
    "flavor": "The signal keeps calling after the sender has become myth."
  },
  {
    "id": "yn-oni-underboss-of-rain",
    "name": "Oni Underboss of Rain",
    "rarity": "SSR",
    "color": "B",
    "type": "Legendary Creature (Oni Underboss)",
    "cost": "{4}{B}",
    "stats": "5/4",
    "mechanics": "Dreaded, Deathblade. Arrives: opponent loses 3 life.",
    "flavor": "She steps from the rain wearing a suit tailored for the end of negotiations."
  },
  {
    "id": "yn-redline-queenpin",
    "name": "Redline Queenpin",
    "rarity": "SSR",
    "color": "R",
    "type": "Legendary Creature (Kitsune Queenpin)",
    "cost": "{4}{R}",
    "stats": "5/4",
    "mechanics": "Warcry. Arrives: deal 4 damage to opponent.",
    "flavor": "She controls the fastest route through the city and charges by the second."
  },
  {
    "id": "yn-burning-mask-of-the-void",
    "name": "Burning Mask of the Void",
    "rarity": "SSR",
    "color": "R",
    "type": "Artifact",
    "cost": "{2}{R}",
    "stats": "-",
    "mechanics": "Arrives: deal 2 damage to opponent. Hauntlink {2}{R}. Linked: The linked creature gets +2/+0 and Overrun.",
    "flavor": "The mask burns without consuming the face beneath it."
  },
  {
    "id": "yn-jade-crown-elder",
    "name": "Jade-Crown Elder",
    "rarity": "SSR",
    "color": "G",
    "type": "Legendary Creature (Yokai Elder)",
    "cost": "{5}{G}",
    "stats": "6/6",
    "mechanics": "Overrun. Arrives: put 2 +1/+1 marks on this.",
    "flavor": "She remembers when the city was a forest and expects it to return."
  },
  {
    "id": "yn-white-lantern-vanguard",
    "name": "White-Lantern Vanguard",
    "rarity": "SR",
    "color": "W",
    "type": "Creature (Kitsune Paladin)",
    "cost": "{3}{W}",
    "stats": "3/3",
    "mechanics": "Sentinel. Your other Kitsune get +1/+0.",
    "flavor": "She leads every procession as if the city were already hers."
  },
  {
    "id": "yn-sanctum-of-many-masks",
    "name": "Sanctum of Many Masks",
    "rarity": "SR",
    "color": "W",
    "type": "Enchantment",
    "cost": "{2}{W}",
    "stats": "-",
    "mechanics": "At dawn: gain 2 life. Hauntlink {3}{W}. Linked: The linked creature gets +2/+2 and Sentinel.",
    "flavor": "Every mask in the sanctum remembers a different patron."
  },
  {
    "id": "yn-blue-ghost-broadcaster",
    "name": "Blue-Ghost Broadcaster",
    "rarity": "SR",
    "color": "U",
    "type": "Creature (Spirit Hacker)",
    "cost": "{4}{U}",
    "stats": "3/4",
    "mechanics": "Skyborne. Arrives: Foresee 2, then draw 1.",
    "flavor": "Her broadcast reaches ghosts, gods, and the occasional bored commuter."
  },
  {
    "id": "yn-hauntlink-signal-lure",
    "name": "Hauntlink Signal Lure",
    "rarity": "SR",
    "color": "U",
    "type": "Artifact",
    "cost": "{2}{U}",
    "stats": "-",
    "mechanics": "Arrives: Foresee 2. Hauntlink {U}. Linked: The linked creature gets Untouchable.",
    "flavor": "The lure calls one spirit by its childhood name."
  },
  {
    "id": "yn-azure-oni-broker",
    "name": "Azure Oni Broker",
    "rarity": "SR",
    "color": "U",
    "type": "Creature (Oni Broker)",
    "cost": "{4}{U}",
    "stats": "4/4",
    "mechanics": "Untouchable. Arrives: draw 1, then grind opponent 2.",
    "flavor": "Her blue horns glow whenever a secret changes hands."
  },
  {
    "id": "yn-black-kitsune-broker",
    "name": "Black Kitsune Broker",
    "rarity": "SR",
    "color": "B",
    "type": "Creature (Kitsune Broker)",
    "cost": "{3}{B}",
    "stats": "3/3",
    "mechanics": "Deathblade. Arrives: opponent loses 2 life; gain 2 life.",
    "flavor": "She charges twice, once for the favor and once for the silence afterward."
  },
  {
    "id": "yn-cold-boot-mask",
    "name": "Cold-Boot Mask",
    "rarity": "SR",
    "color": "B",
    "type": "Artifact",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "Arrives: grind self 2. Hauntlink {1}{B}. Linked: The linked creature gets +2/+0 and Deathblade.",
    "flavor": "Its spirit only wakes when the wearer agrees to betray someone."
  },
  {
    "id": "yn-redline-oni-queen",
    "name": "Redline Oni Queen",
    "rarity": "SR",
    "color": "R",
    "type": "Legendary Creature (Oni Boss)",
    "cost": "{4}{R}",
    "stats": "5/4",
    "mechanics": "Warcry, Overrun.",
    "flavor": "She owns the loudest club in the city and the road outside it."
  },
  {
    "id": "yn-ember-link-chain",
    "name": "Ember-Link Chain",
    "rarity": "SR",
    "color": "R",
    "type": "Enchantment",
    "cost": "{2}{R}",
    "stats": "-",
    "mechanics": "At dawn: deal 1 damage to opponent. Hauntlink {R}. Linked: The linked creature gets +1/+0 and Warcry.",
    "flavor": "The chain is a nightclub accessory until its owner starts moving wrong."
  },
  {
    "id": "yn-jade-root-yokai",
    "name": "Jade-Root Yokai",
    "rarity": "SR",
    "color": "G",
    "type": "Creature (Yokai Guardian)",
    "cost": "{4}{G}",
    "stats": "5/5",
    "mechanics": "Sentinel.",
    "flavor": "Its roots split the road and make room for an older kind of traffic."
  },
  {
    "id": "yn-thorncode-matriarch",
    "name": "Thorncode Matriarch",
    "rarity": "SR",
    "color": "G",
    "type": "Creature (Kitsune Druid)",
    "cost": "{3}{G}",
    "stats": "3/4",
    "mechanics": "Warding Gaze. Arrives: Foresee 2.",
    "flavor": "She wears living circuitry braided from vines and stolen fiber."
  },
  {
    "id": "yn-lantern-fixer",
    "name": "Lantern Fixer",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Kitsune Fixer)",
    "cost": "{1}{W}",
    "stats": "2/2",
    "mechanics": "Arrives: Foresee 1.",
    "flavor": "She can find a safe room in any neighborhood and a buyer in every safe room."
  },
  {
    "id": "yn-oni-precinct-captain",
    "name": "Oni Precinct Captain",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Oni Enforcer)",
    "cost": "{4}{W}",
    "stats": "4/4",
    "mechanics": "Sentinel. At dawn: gain 1 life.",
    "flavor": "Her precinct is spotless because every stain has been given a name."
  },
  {
    "id": "yn-silver-moon-duelist",
    "name": "Silver-Moon Duelist",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Human Ronin)",
    "cost": "{2}{W}",
    "stats": "2/2",
    "mechanics": "Twin Blades.",
    "flavor": "Her sword catches moonlight even under a roof of smog."
  },
  {
    "id": "yn-halo-wire-priestess",
    "name": "Halo-Wire Priestess",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Human Cleric)",
    "cost": "{3}{W}",
    "stats": "3/4",
    "mechanics": "Arrives: gain 3 life.",
    "flavor": "She cuts the district's violence with a halo made of live cable."
  },
  {
    "id": "yn-bastion-lantern",
    "name": "Bastion Lantern",
    "rarity": "R",
    "color": "W",
    "type": "Artifact",
    "cost": "{2}{W}",
    "stats": "-",
    "mechanics": "Arrives: gain 2 life. Hauntlink {1}{W}. Linked: The linked creature gets +1/+2 and Sentinel.",
    "flavor": "The lantern's ghost chooses defenders who do not run."
  },
  {
    "id": "yn-quiet-the-street",
    "name": "Quiet the Street",
    "rarity": "R",
    "color": "W",
    "type": "Charm",
    "cost": "{W}",
    "stats": "-",
    "mechanics": "Prevent all combat damage this turn. [ANSWER: one go-wide alpha attack.]",
    "flavor": "A single command silences engines, drones, and angry spirits."
  },
  {
    "id": "yn-sanctuary-sweep",
    "name": "Sanctuary Sweep",
    "rarity": "R",
    "color": "W",
    "type": "Ritual",
    "cost": "{2}{W}{W}",
    "stats": "-",
    "mechanics": "Destroy all creatures. [ANSWER: low-curve creature swarms and token boards.]",
    "flavor": "Shrine bells ring once, and the crowded street falls silent."
  },
  {
    "id": "yn-echo-fox-informant",
    "name": "Echo-Fox Informant",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kitsune Spy)",
    "cost": "{1}{U}",
    "stats": "2/1",
    "mechanics": "Arrives: Foresee 2.",
    "flavor": "She records secrets in the echo between two notification chimes."
  },
  {
    "id": "yn-skyline-yokai",
    "name": "Skyline Yokai",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Yokai)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Skyborne, Untouchable.",
    "flavor": "It swims through holograms as if the towers were deep water."
  },
  {
    "id": "yn-subway-oracle",
    "name": "Subway Oracle",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kappa Oracle)",
    "cost": "{4}{U}",
    "stats": "3/4",
    "mechanics": "Untouchable. At dawn: Foresee 1.",
    "flavor": "She knows which train will arrive and who will be waiting on it."
  },
  {
    "id": "yn-bluewire-illusionist",
    "name": "Bluewire Illusionist",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kitsune Illusionist)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Arrives: Foresee 2.",
    "flavor": "Her decoys all look more trustworthy than the original."
  },
  {
    "id": "yn-moonlit-data-duelist",
    "name": "Moonlit Data Duelist",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kitsune Ronin)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Skyborne, First Blade.",
    "flavor": "Her blade writes a clean line through every false identity."
  },
  {
    "id": "yn-foresee-the-fall",
    "name": "Foresee the Fall",
    "rarity": "R",
    "color": "U",
    "type": "Charm",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Foresee 3.",
    "flavor": "The city warns you three seconds before disaster and charges for the privilege."
  },
  {
    "id": "yn-null-route",
    "name": "Null Route",
    "rarity": "R",
    "color": "U",
    "type": "Charm",
    "cost": "{2}{U}",
    "stats": "-",
    "mechanics": "Cancel target spell, then Foresee 1.",
    "flavor": "The message vanishes before the network can decide whether it was sent."
  },
  {
    "id": "yn-black-market-oni",
    "name": "Black-Market Oni",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Broker)",
    "cost": "{1}{B}",
    "stats": "2/1",
    "mechanics": "Arrives: opponent loses 1 life; gain 1 life.",
    "flavor": "She sells counterfeit blessings from a booth behind the shrine."
  },
  {
    "id": "yn-gravewire-kitsune",
    "name": "Gravewire Kitsune",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Kitsune Hacker)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Deathblade. Arrives: grind self 1.",
    "flavor": "Her foxfire burns violet when it finds a dead account still open."
  },
  {
    "id": "yn-oni-bounty-agent",
    "name": "Oni Bounty Agent",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Hunter)",
    "cost": "{4}{B}",
    "stats": "4/3",
    "mechanics": "Dreaded. Arrives: opponent discards at random 1.",
    "flavor": "She finds fugitives by asking their ghosts where they sleep."
  },
  {
    "id": "yn-bloodline-tollkeeper",
    "name": "Bloodline Tollkeeper",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Collector)",
    "cost": "{2}{B}",
    "stats": "2/3",
    "mechanics": "Blood Oath.",
    "flavor": "She keeps the family ledger in a chain of old train tokens."
  },
  {
    "id": "yn-underpass-reclaimer",
    "name": "Underpass Reclaimer",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Spirit Salvager)",
    "cost": "{4}{B}",
    "stats": "3/3",
    "mechanics": "Arrives: raise the top creature card from your graveyard.",
    "flavor": "She retrieves lost memories from puddles beneath the train line."
  },
  {
    "id": "yn-night-market-price",
    "name": "Night-Market Price",
    "rarity": "R",
    "color": "B",
    "type": "Ritual",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "Destroy all creatures; deal 2 damage to you. [ANSWER: low-curve creature swarms outside white.]",
    "flavor": "Every bargain in the night market has a pulse underneath it."
  },
  {
    "id": "yn-sever-the-signal",
    "name": "Sever the Signal",
    "rarity": "R",
    "color": "B",
    "type": "Charm",
    "cost": "{3}{B}",
    "stats": "-",
    "mechanics": "Destroy target artifact or sever target enchantment; opponent loses 1 life. [ANSWER: static creature anthems and value Enchantments.]",
    "flavor": "A severed broadcast leaves the target alone with its own fear."
  },
  {
    "id": "yn-redline-kitsune",
    "name": "Redline Kitsune",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Kitsune Runner)",
    "cost": "{1}{R}",
    "stats": "2/1",
    "mechanics": "Warcry, First Blade.",
    "flavor": "She rides the rail between stations faster than the cameras can focus."
  },
  {
    "id": "yn-neon-oni-brawler",
    "name": "Neon Oni Brawler",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Oni Brawler)",
    "cost": "{2}{R}",
    "stats": "3/2",
    "mechanics": "Arrives: deal 1 damage to opponent.",
    "flavor": "The crowd chants her name because it is easier than saying run."
  },
  {
    "id": "yn-motorbike-ronin",
    "name": "Motorbike Ronin",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Human Ronin)",
    "cost": "{3}{R}",
    "stats": "3/3",
    "mechanics": "First Blade.",
    "flavor": "Her motorcycle carries a shrine bell that rings before every duel."
  },
  {
    "id": "yn-rainflash-duelist",
    "name": "Rainflash Duelist",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Human Duelist)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "First Blade, Warcry.",
    "flavor": "Her opening blow is visible only as the rain splitting around it."
  },
  {
    "id": "yn-oni-neon-marshal",
    "name": "Oni Neon Marshal",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Oni Enforcer)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "Warcry. When this attacks: opponent loses 1 life.",
    "flavor": "Her patrol car is a shrine on wheels and a warning in chrome."
  },
  {
    "id": "yn-burn-the-billboard",
    "name": "Burn the Billboard",
    "rarity": "R",
    "color": "R",
    "type": "Ritual",
    "cost": "{2}{R}",
    "stats": "-",
    "mechanics": "Deal 4 damage to target creature or player.",
    "flavor": "A corporate message becomes a fireball with excellent timing."
  },
  {
    "id": "yn-hotwire-retort",
    "name": "Hotwire Retort",
    "rarity": "R",
    "color": "R",
    "type": "Charm",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 2 damage to target creature or player, then Foresee 2.",
    "flavor": "The reply is short, bright, and usually delivered through a fuse."
  },
  {
    "id": "yn-jade-kitsune-forager",
    "name": "Jade Kitsune Forager",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Kitsune Forager)",
    "cost": "{1}{G}",
    "stats": "2/2",
    "mechanics": "Warding Gaze. Arrives: gain 1 life.",
    "flavor": "She grows edible moss on dead vending machines."
  },
  {
    "id": "yn-moss-oni-guardian",
    "name": "Moss Oni Guardian",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Oni Guardian)",
    "cost": "{3}{G}",
    "stats": "3/4",
    "mechanics": "Sentinel.",
    "flavor": "Moss softens the horns, but not the temper."
  },
  {
    "id": "yn-canopy-spirit",
    "name": "Canopy Spirit",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Spirit)",
    "cost": "{4}{G}",
    "stats": "4/4",
    "mechanics": "Skyborne.",
    "flavor": "It glides from a rooftop garden on wings of leaves and blue light."
  },
  {
    "id": "yn-greenline-bruiser",
    "name": "Greenline Bruiser",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Yokai Brawler)",
    "cost": "{2}{G}",
    "stats": "3/3",
    "mechanics": "Overrun.",
    "flavor": "The last thing a drone sees is a grin between two leaves."
  },
  {
    "id": "yn-rootcode-ranger",
    "name": "Rootcode Ranger",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Human Ranger)",
    "cost": "{2}{G}",
    "stats": "2/2",
    "mechanics": "Warding Gaze. Arrives: Foresee 1.",
    "flavor": "She maps forgotten parks by following roots under the asphalt."
  },
  {
    "id": "yn-vineyard-exorcist",
    "name": "Vineyard Exorcist",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Dryad Hunter)",
    "cost": "{4}{G}",
    "stats": "4/5",
    "mechanics": "Arrives: sever the top card of opponent's graveyard.",
    "flavor": "She tends a vineyard watered by the city reservoir and old grudges."
  },
  {
    "id": "yn-grow-the-grove",
    "name": "Grow the Grove",
    "rarity": "R",
    "color": "G",
    "type": "Ritual",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Target creature gets +3/+3 until end of turn; gain 2 life.",
    "flavor": "A street tree becomes a cathedral before the cameras can refocus."
  },
  {
    "id": "yn-rootwall-charm",
    "name": "Rootwall Charm",
    "rarity": "R",
    "color": "G",
    "type": "Charm",
    "cost": "{G}",
    "stats": "-",
    "mechanics": "Target creature gets +0/+4 and Warding Gaze until end of turn.",
    "flavor": "Roots rise like a wall around the person who refused to run."
  },
  {
    "id": "yn-lantern-court-usher",
    "name": "Lantern-Court Usher",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Fixer)",
    "cost": "{1}{W}",
    "stats": "2/2",
    "mechanics": "Arrives: gain 1 life.",
    "flavor": "She checks the guest list with a smile that never reaches her eyes."
  },
  {
    "id": "yn-shrine-circuit-medic",
    "name": "Shrine-Circuit Medic",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Mystic)",
    "cost": "{2}{W}",
    "stats": "2/3",
    "mechanics": "Arrives: gain 2 life.",
    "flavor": "Her healing kiosk is open beneath three broken neon torii."
  },
  {
    "id": "yn-paper-mask-sentinel",
    "name": "Paper-Mask Sentinel",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Yokai Guardian)",
    "cost": "{2}{W}",
    "stats": "2/3",
    "mechanics": "Sentinel.",
    "flavor": "The mask is cheap paper, but the stare behind it is not."
  },
  {
    "id": "yn-silk-rope-enforcer",
    "name": "Silk-Rope Enforcer",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Oni Enforcer)",
    "cost": "{3}{W}",
    "stats": "3/4",
    "mechanics": "Sentinel.",
    "flavor": "She knots a charging cable around her wrist before every collection run."
  },
  {
    "id": "yn-holo-lantern-adept",
    "name": "Holo-Lantern Adept",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Kitsune Adept)",
    "cost": "{1}{W}",
    "stats": "2/1",
    "mechanics": "Arrives: Foresee 1.",
    "flavor": "Her foxfire advertisements always know what you wanted yesterday."
  },
  {
    "id": "yn-white-noise-exorcist",
    "name": "White-Noise Exorcist",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Spirit Hunter)",
    "cost": "{2}{W}",
    "stats": "3/2",
    "mechanics": "Deathblade.",
    "flavor": "Static from her prayer beads makes counterfeit ghosts blink out."
  },
  {
    "id": "yn-wardlight-broker",
    "name": "Wardlight Broker",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Broker)",
    "cost": "{3}{W}",
    "stats": "3/3",
    "mechanics": "Arrives: your creatures get +0/+1 until end of turn.",
    "flavor": "She sells protection in measured doses and keeps the best dose for herself."
  },
  {
    "id": "yn-neon-gate-warden",
    "name": "Neon-Gate Warden",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Oni Guardian)",
    "cost": "{2}{W}",
    "stats": "4/4",
    "mechanics": "Bulwark, Warding Gaze.",
    "flavor": "Nothing enters the shrine district unless it can survive being seen."
  },
  {
    "id": "yn-street-shrine-compact",
    "name": "Street-Shrine Compact",
    "rarity": "C",
    "color": "W",
    "type": "Ritual",
    "cost": "{W}",
    "stats": "-",
    "mechanics": "Target creature gets +1/+1 until end of turn; Foresee 1.",
    "flavor": "A paper contract glows once, then seals itself in rain."
  },
  {
    "id": "yn-paper-ward-signal",
    "name": "Paper-Ward Signal",
    "rarity": "C",
    "color": "W",
    "type": "Charm",
    "cost": "{1}{W}",
    "stats": "-",
    "mechanics": "Destroy target artifact or sever target enchantment. [ANSWER: static creature anthems.]",
    "flavor": "One folded ward can silence the loudest relic on the block."
  },
  {
    "id": "yn-ghostwire-charm",
    "name": "Ghostwire Charm",
    "rarity": "C",
    "color": "W",
    "type": "Artifact",
    "cost": "{1}{W}",
    "stats": "-",
    "mechanics": "Arrives: gain 1 life. Hauntlink {W}. Linked: The linked creature gets +0/+2 and Sentinel.",
    "flavor": "The charm is warm when the spirit inside approves of its wearer."
  },
  {
    "id": "yn-lantern-canal-junction",
    "name": "Lantern Canal Junction",
    "rarity": "C",
    "color": "W/U",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add W or U.",
    "flavor": "The shrine's reflection files a flight plan in the flooded street."
  },
  {
    "id": "yn-ghostline-diviner",
    "name": "Ghostline Diviner",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Spirit Seer)",
    "cost": "{1}{U}",
    "stats": "2/1",
    "mechanics": "Arrives: Foresee 1.",
    "flavor": "She reads train delays as prophecies and is rarely wrong."
  },
  {
    "id": "yn-signal-kitsune",
    "name": "Signal Kitsune",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kitsune Hacker)",
    "cost": "{2}{U}",
    "stats": "2/2",
    "mechanics": "Arrives: Foresee 1, then draw 1.",
    "flavor": "Her tailtips glow blue whenever a secret packet crosses the grid."
  },
  {
    "id": "yn-data-river-stalker",
    "name": "Data-River Stalker",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kappa Scout)",
    "cost": "{2}{U}",
    "stats": "2/3",
    "mechanics": "Skyborne.",
    "flavor": "It swims through cloud backups and leaves wet footprints on server glass."
  },
  {
    "id": "yn-raincode-savant",
    "name": "Raincode Savant",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Human Hacker)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Arrives: draw 1.",
    "flavor": "She can predict a blackout by listening to the city's vending machines."
  },
  {
    "id": "yn-network-sprite",
    "name": "Network Sprite",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Spirit)",
    "cost": "{1}{U}",
    "stats": "1/3",
    "mechanics": "Skyborne.",
    "flavor": "A pinprick of blue foxfire slips between towers before dawn."
  },
  {
    "id": "yn-tidepool-seer",
    "name": "Tidepool Seer",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kappa Mystic)",
    "cost": "{2}{U}",
    "stats": "2/2",
    "mechanics": "At dawn: Foresee 1.",
    "flavor": "She keeps a tide chart for rainwater running down a parking garage."
  },
  {
    "id": "yn-alleywave-tactician",
    "name": "Alleywave Tactician",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Human Tactician)",
    "cost": "{4}{U}",
    "stats": "4/4",
    "mechanics": "Arrives: Foresee 2.",
    "flavor": "She wins street fights by making the street disappear under her opponent."
  },
  {
    "id": "yn-circuit-foretelling",
    "name": "Circuit Foretelling",
    "rarity": "C",
    "color": "U",
    "type": "Ritual",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Foresee 2.",
    "flavor": "The city tells the future in buffering icons and canceled trains."
  },
  {
    "id": "yn-backdoor-recall",
    "name": "Backdoor Recall",
    "rarity": "C",
    "color": "U",
    "type": "Charm",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Recall target creature.",
    "flavor": "Every locked door has a network address if you know the right spirit."
  },
  {
    "id": "yn-signal-bridge",
    "name": "Signal Bridge",
    "rarity": "C",
    "color": "U",
    "type": "Charm",
    "cost": "{2}{U}",
    "stats": "-",
    "mechanics": "Cancel target spell.",
    "flavor": "The bridge holds while every camera in the city looks elsewhere."
  },
  {
    "id": "yn-moonwire-mask",
    "name": "Moonwire Mask",
    "rarity": "C",
    "color": "U",
    "type": "Artifact",
    "cost": "{1}{U}",
    "stats": "-",
    "mechanics": "Arrives: Foresee 1. Hauntlink {U}. Linked: The linked creature gets Skyborne.",
    "flavor": "Its silver fox face only appears in reflections."
  },
  {
    "id": "yn-midnight-data-market",
    "name": "Midnight Data Market",
    "rarity": "C",
    "color": "U/B",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add U or B.",
    "flavor": "Everything is for sale here except the exit."
  },
  {
    "id": "yn-alley-oni-collector",
    "name": "Alley Oni Collector",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Debt Collector)",
    "cost": "{1}{B}",
    "stats": "2/1",
    "mechanics": "Arrives: opponent loses 1 life.",
    "flavor": "She invoices the living and lets the dead handle late fees."
  },
  {
    "id": "yn-black-lantern-cutpurse",
    "name": "Black-Lantern Cutpurse",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Human Thief)",
    "cost": "{2}{B}",
    "stats": "3/2",
    "mechanics": "Arrives: opponent discards at random 1.",
    "flavor": "Her lantern goes dark just before every wallet opens."
  },
  {
    "id": "yn-shrine-debt-enforcer",
    "name": "Shrine-Debt Enforcer",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Enforcer)",
    "cost": "{2}{B}",
    "stats": "2/3",
    "mechanics": "Deathblade.",
    "flavor": "She collects favors with a blade that remembers every name."
  },
  {
    "id": "yn-ghost-market-bruiser",
    "name": "Ghost-Market Bruiser",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Yokai Brawler)",
    "cost": "{3}{B}",
    "stats": "3/3",
    "mechanics": "Blood Oath.",
    "flavor": "The market pays her in blood because nobody has anything better."
  },
  {
    "id": "yn-kitsune-night-fixer",
    "name": "Kitsune Night Fixer",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Kitsune Broker)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Arrives: opponent loses 1 life; gain 1 life.",
    "flavor": "She solves problems after midnight and creates better ones before breakfast."
  },
  {
    "id": "yn-neon-bloodhound",
    "name": "Neon Bloodhound",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Yokai Hound)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Deathblade.",
    "flavor": "Its nose follows stolen identities through rain and concrete."
  },
  {
    "id": "yn-oni-tollboss",
    "name": "Oni Tollboss",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Enforcer)",
    "cost": "{4}{B}",
    "stats": "4/4",
    "mechanics": "Arrives: opponent loses 1 life.",
    "flavor": "The toll is one coin, one secret, or one apology that sounds sincere."
  },
  {
    "id": "yn-dead-channel-ransom",
    "name": "Dead-Channel Ransom",
    "rarity": "C",
    "color": "B",
    "type": "Ritual",
    "cost": "{B}",
    "stats": "-",
    "mechanics": "Opponent discards at random 1.",
    "flavor": "The ransom note arrives from a number that died years ago."
  },
  {
    "id": "yn-alleyway-sever",
    "name": "Alleyway Sever",
    "rarity": "C",
    "color": "B",
    "type": "Charm",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "Sever target creature.",
    "flavor": "A red sigil flares under the target and the rain washes away the outline."
  },
  {
    "id": "yn-blackout-vigil",
    "name": "Blackout Vigil",
    "rarity": "C",
    "color": "B",
    "type": "Enchantment",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "At dawn: opponent loses 1 life; gain 1 life.",
    "flavor": "The district's lights fail only after the spirits have finished feeding."
  },
  {
    "id": "yn-parasite-mask",
    "name": "Parasite Mask",
    "rarity": "C",
    "color": "B",
    "type": "Artifact",
    "cost": "{1}{B}",
    "stats": "-",
    "mechanics": "Arrives: grind self 1. Hauntlink {B}. Linked: The linked creature gets +1/+0 and Deathblade.",
    "flavor": "The mask smiles whenever its wearer's pulse becomes someone else's."
  },
  {
    "id": "yn-burning-toll-bridge",
    "name": "Burning Toll Bridge",
    "rarity": "C",
    "color": "B/R",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add B or R.",
    "flavor": "The toll doubles when the river starts to glow."
  },
  {
    "id": "yn-street-oni-scrapper",
    "name": "Street Oni Scrapper",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Oni Brawler)",
    "cost": "{1}{R}",
    "stats": "2/1",
    "mechanics": "Warcry.",
    "flavor": "She fights for the joy of being recognized by the right crowd."
  },
  {
    "id": "yn-magenta-kitsune-runner",
    "name": "Magenta Kitsune Runner",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Courier)",
    "cost": "{2}{R}",
    "stats": "3/2",
    "mechanics": "Warcry.",
    "flavor": "Her deliveries arrive hot, loud, and addressed to the city's worst decisions."
  },
  {
    "id": "yn-rain-soaked-ronin",
    "name": "Rain-Soaked Ronin",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Human Ronin)",
    "cost": "{2}{R}",
    "stats": "2/2",
    "mechanics": "First Blade.",
    "flavor": "Her sword is dry because the rain knows better than to touch it."
  },
  {
    "id": "yn-tunnel-fire-dancer",
    "name": "Tunnel Fire-Dancer",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Dancer)",
    "cost": "{2}{R}",
    "stats": "2/1",
    "mechanics": "Dreaded, Deathblade.",
    "flavor": "Her flames make the subway look glamorous right before they make it dangerous."
  },
  {
    "id": "yn-chrome-tailed-raider",
    "name": "Chrome-Tailed Raider",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Raider)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "Overrun.",
    "flavor": "The chrome tail is a stolen antenna that still picks up war songs."
  },
  {
    "id": "yn-signal-smuggler",
    "name": "Signal Smuggler",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Human Smuggler)",
    "cost": "{3}{R}",
    "stats": "3/3",
    "mechanics": "Arrives: deal 1 damage to opponent.",
    "flavor": "She moves contraband prayers through the city in insulated cases."
  },
  {
    "id": "yn-glitchhorn-enforcer",
    "name": "Glitchhorn Enforcer",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Yokai Enforcer)",
    "cost": "{5}{R}",
    "stats": "5/4",
    "mechanics": "Warcry, Overrun.",
    "flavor": "Its horns broadcast a siren that makes traffic forget which way is forward."
  },
  {
    "id": "yn-street-rush",
    "name": "Street Rush",
    "rarity": "C",
    "color": "R",
    "type": "Ritual",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 2 damage to target creature or player.",
    "flavor": "A red flare turns a routine crossing into a public execution of bad luck."
  },
  {
    "id": "yn-riot-lantern",
    "name": "Riot Lantern",
    "rarity": "C",
    "color": "R",
    "type": "Charm",
    "cost": "{R}",
    "stats": "-",
    "mechanics": "Target creature gets +2/+0 and Warcry until end of turn.",
    "flavor": "The lantern's red glow means the night has chosen a side."
  },
  {
    "id": "yn-sirens-and-sparks",
    "name": "Sirens and Sparks",
    "rarity": "C",
    "color": "R",
    "type": "Charm",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 3 damage to target creature or player.",
    "flavor": "The city's emergency tones become music when the right yokai conducts them."
  },
  {
    "id": "yn-ember-mask",
    "name": "Ember Mask",
    "rarity": "C",
    "color": "R",
    "type": "Artifact",
    "cost": "{R}",
    "stats": "-",
    "mechanics": "Hauntlink {1}{R}. Linked: The linked creature gets +1/+0 and Warcry.",
    "flavor": "It smells like hot metal and the last thought of a bad enemy."
  },
  {
    "id": "yn-overgrown-speedway",
    "name": "Overgrown Speedway",
    "rarity": "C",
    "color": "R/G",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add R or G.",
    "flavor": "The vines learned to love the sound of engines."
  },
  {
    "id": "yn-mosswire-kitsune",
    "name": "Mosswire Kitsune",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Kitsune Forager)",
    "cost": "{1}{G}",
    "stats": "2/2",
    "mechanics": "Arrives: gain 1 life.",
    "flavor": "Her green fur catches rainwater that tastes faintly of cedar."
  },
  {
    "id": "yn-rain-garden-tender",
    "name": "Rain-Garden Tender",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Human Gardener)",
    "cost": "{2}{G}",
    "stats": "2/3",
    "mechanics": "Arrives: Foresee 1.",
    "flavor": "She grows medicinal vines over concrete and refuses to apologize for the roots."
  },
  {
    "id": "yn-concrete-forest-stalker",
    "name": "Concrete-Forest Stalker",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Hunter)",
    "cost": "{2}{G}",
    "stats": "3/2",
    "mechanics": "Warding Gaze.",
    "flavor": "It hunts between towers where sunlight has never reached the pavement."
  },
  {
    "id": "yn-shrine-vine-warden",
    "name": "Shrine-Vine Warden",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Dryad Guardian)",
    "cost": "{3}{G}",
    "stats": "3/4",
    "mechanics": "Sentinel.",
    "flavor": "The vines move first whenever a stranger raises a weapon."
  },
  {
    "id": "yn-jade-rain-brawler",
    "name": "Jade-Rain Brawler",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Brawler)",
    "cost": "{4}{G}",
    "stats": "4/4",
    "mechanics": "Overrun.",
    "flavor": "Its footsteps leave jade mushrooms growing through asphalt."
  },
  {
    "id": "yn-rootcode-monk",
    "name": "Rootcode Monk",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Human Monk)",
    "cost": "{3}{G}",
    "stats": "3/3",
    "mechanics": "Arrives: destroy the newest artifact or enchantment an opponent controls. [ANSWER: static creature anthems.]",
    "flavor": "She meditates beneath a server rack until the rack begins to dream."
  },
  {
    "id": "yn-old-growth-gridkeeper",
    "name": "Old-Growth Gridkeeper",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Dryad Guardian)",
    "cost": "{5}{G}",
    "stats": "3/7",
    "mechanics": "Bulwark. At dawn: gain 2 life.",
    "flavor": "The oldest tree in the district has a better firewall than city hall."
  },
  {
    "id": "yn-vineglass-guardian",
    "name": "Vineglass Guardian",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Guardian)",
    "cost": "{3}{G}",
    "stats": "4/5",
    "mechanics": "Bulwark, Warding Gaze.",
    "flavor": "Its transparent bark catches hostile drones before they find the shrine."
  },
  {
    "id": "yn-ghostwood-growth",
    "name": "Ghostwood Growth",
    "rarity": "C",
    "color": "G",
    "type": "Charm",
    "cost": "{G}",
    "stats": "-",
    "mechanics": "Target creature gets +3/+3 until end of turn.",
    "flavor": "A ghostwood branch punches through the street to answer a threat."
  },
  {
    "id": "yn-canal-root-surge",
    "name": "Canal Root Surge",
    "rarity": "C",
    "color": "G",
    "type": "Charm",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Target creature gets +2/+2 until end of turn; Foresee 1.",
    "flavor": "The canal wall blooms around the person who needs it most."
  },
  {
    "id": "yn-thorn-spirit-mask",
    "name": "Thorn-Spirit Mask",
    "rarity": "C",
    "color": "G",
    "type": "Artifact",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Hauntlink {G}. Linked: The linked creature gets +1/+1 and Warding Gaze.",
    "flavor": "The mask grows a new thorn whenever its wearer tells the truth."
  },
  {
    "id": "yn-rooftop-shrine-garden",
    "name": "Rooftop Shrine Garden",
    "rarity": "C",
    "color": "G/W",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add G or W.",
    "flavor": "The oldest tree in the city grows through the newest temple."
  }
] as const satisfies readonly YokaiSpecRow[];


const KEYWORDS: Readonly<Record<string, Keyword>> = {
  Skyborne: 'skyborne',
  'Warding Gaze': 'wardingGaze',
  'First Blade': 'firstBlade',
  'Twin Blades': 'twinBlades',
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
    const grantKeywords = parseKeywords(
      rider
        .replace(/^\+\d+\/\+\d+,?\s*/, '')
        .replace(/^and /i, '')
        .replace(/ and /g, ', '),
    );
    const riderDef: { p?: number; t?: number; grantKeywords?: Keyword[] } = plus
      ? { p: Number(plus[1]), t: Number(plus[2]), ...(grantKeywords.length ? { grantKeywords } : {}) }
      : { ...(grantKeywords.length ? { grantKeywords } : {}) };
    if (!riderDef.p && !riderDef.t && !riderDef.grantKeywords?.length) throw new Error('Empty Linked rider: ' + text);
    abilities.push({ when: 'static', static: { scope: 'attached', ...riderDef } });
    ordinary = ordinary.slice(0, ordinary.indexOf(linked[0])).replace(/\.\s*$/, '').trim();
  }

  if (!ordinary) return abilities;
  const clauses = ordinary.match(/(?:At dawn|Arrives|When this attacks|Dies):[^.]+\.?/gi) ?? [];
  for (const clause of clauses) {
    const split = clause.match(/^(At dawn|Arrives|When this attacks|Dies):\s*(.+?)\.?$/i);
    if (!split) throw new Error('Invalid ability clause: ' + clause);
    const when = split[1].toLowerCase() === 'at dawn'
      ? 'dawn'
      : split[1].toLowerCase() === 'arrives'
        ? 'arrives'
        : split[1].toLowerCase() === 'dies'
          ? 'dies'
          : 'attacks';
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
  return { ...card, set: 'yokai-nights' };
}

/** Compiled from the exact table rows above. */
export const YOKAI_NIGHTS = YOKAI_SPEC_ROWS.map(parseCard) as readonly CardDef[];
