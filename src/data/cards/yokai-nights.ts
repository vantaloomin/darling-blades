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
}

export const YOKAI_SPEC_ROWS = [
  {
    "id": "yn-queen-of-the-lanterned-roof",
    "name": "Queen of the Lanterned Roof",
    "rarity": "UR",
    "color": "W",
    "type": "Legendary Creature (Kitsune Queen)",
    "cost": "{5}{W}",
    "stats": "3/6",
    "mechanics": "Skyborne, Sentinel. Your other Kitsune get +1/+1."
  },
  {
    "id": "yn-hauntlink-apex",
    "name": "Hauntlink Apex",
    "rarity": "UR",
    "color": "U",
    "type": "Artifact",
    "cost": "{3}{U}",
    "stats": "-",
    "mechanics": "At dawn: Foresee 1. Hauntlink {3}{U}. Linked: The linked creature gets +3/+3, Skyborne, and Untouchable. (AI-risk survivor.)"
  },
  {
    "id": "yn-oni-of-the-last-exit",
    "name": "Oni of the Last Exit",
    "rarity": "UR",
    "color": "B",
    "type": "Legendary Creature (Oni Avatar)",
    "cost": "{6}{B}",
    "stats": "6/6",
    "mechanics": "Dreaded, Deathblade. Dies: opponent loses 4 life."
  },
  {
    "id": "yn-kitsune-neon-tyrant",
    "name": "Kitsune Neon Tyrant",
    "rarity": "UR",
    "color": "R",
    "type": "Legendary Creature (Kitsune Boss)",
    "cost": "{4}{R}",
    "stats": "6/5",
    "mechanics": "Warcry, Overrun. When this attacks: deal 2 damage to opponent, then deal 1 damage to you."
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
    "cost": "{4}{G}{G}",
    "stats": "6/6",
    "mechanics": "Sentinel, Blood Oath. Arrives: gain 3 life, then Foresee 1."
  },
  {
    "id": "yn-lantern-court-regent",
    "name": "Lantern-Court Regent",
    "rarity": "SSR",
    "color": "W",
    "type": "Legendary Creature (Kitsune Regent)",
    "cost": "{4}{W}",
    "stats": "4/5",
    "mechanics": "Sentinel. Your other Kitsune get +1/+1."
  },
  {
    "id": "yn-white-veil-collapse",
    "name": "White-Veil Collapse",
    "rarity": "SSR",
    "color": "W",
    "type": "Ritual",
    "cost": "{2}{W}{W}",
    "stats": "-",
    "mechanics": "Destroy all creatures; gain 4 life. [ANSWER: creature swarm and anthem-backed wide boards.]"
  },
  {
    "id": "yn-ghost-net-archon",
    "name": "Ghost-Net Archon",
    "rarity": "SSR",
    "color": "U",
    "type": "Legendary Creature (Spirit Archon)",
    "cost": "{6}{U}",
    "stats": "5/5",
    "mechanics": "Skyborne, Untouchable. Arrives: Foresee 3."
  },
  {
    "id": "yn-unanswered-signal",
    "name": "Unanswered Signal",
    "rarity": "SSR",
    "color": "U",
    "type": "Enchantment",
    "cost": "{3}{U}",
    "stats": "-",
    "mechanics": "At dawn: draw 1. Hauntlink {3}{U}. Linked: The linked creature gets Skyborne and Untouchable."
  },
  {
    "id": "yn-oni-underboss-of-rain",
    "name": "Oni Underboss of Rain",
    "rarity": "SSR",
    "color": "B",
    "type": "Legendary Creature (Oni Underboss)",
    "cost": "{3}{B}{B}",
    "stats": "5/4",
    "mechanics": "Dreaded, Deathblade. Arrives: opponent loses 3 life, then deal 2 damage to you."
  },
  {
    "id": "yn-redline-queenpin",
    "name": "Redline Queenpin",
    "rarity": "SSR",
    "color": "R",
    "type": "Legendary Creature (Kitsune Queenpin)",
    "cost": "{4}{R}",
    "stats": "5/4",
    "mechanics": "Warcry. Arrives: deal 4 damage to opponent."
  },
  {
    "id": "yn-burning-mask-of-the-void",
    "name": "Burning Mask of the Void",
    "rarity": "SSR",
    "color": "R",
    "type": "Artifact",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Arrives: deal 4 damage to opponent. Hauntlink {2}{R}. Linked: The linked creature gets +2/+0 and Overrun."
  },
  {
    "id": "yn-jade-crown-elder",
    "name": "Jade-Crown Elder",
    "rarity": "SSR",
    "color": "G",
    "type": "Legendary Creature (Yokai Elder)",
    "cost": "{4}{G}{G}",
    "stats": "6/4",
    "mechanics": "Overrun. Your other Yokai get +1/+0 and gain Overrun."
  },
  {
    "id": "yn-white-lantern-vanguard",
    "name": "White-Lantern Vanguard",
    "rarity": "SR",
    "color": "W",
    "type": "Creature (Kitsune Paladin)",
    "cost": "{3}{W}",
    "stats": "3/3",
    "mechanics": "Sentinel. Your other Kitsune get +1/+0."
  },
  {
    "id": "yn-sanctum-of-many-masks",
    "name": "Sanctum of Many Masks",
    "rarity": "SR",
    "color": "W",
    "type": "Enchantment",
    "cost": "{2}{W}",
    "stats": "-",
    "mechanics": "At dawn: gain 2 life. Hauntlink {3}{W}. Linked: The linked creature gets +2/+2 and Sentinel."
  },
  {
    "id": "yn-blue-ghost-broadcaster",
    "name": "Blue-Ghost Broadcaster",
    "rarity": "SR",
    "color": "U",
    "type": "Creature (Spirit Hacker)",
    "cost": "{5}{U}",
    "stats": "3/4",
    "mechanics": "Warding Gaze. Arrives: Foresee 2, then draw 1."
  },
  {
    "id": "yn-hauntlink-signal-lure",
    "name": "Hauntlink Signal Lure",
    "rarity": "SR",
    "color": "U",
    "type": "Artifact",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Arrives: Foresee 2. Hauntlink {U}. Linked: The linked creature gets Untouchable."
  },
  {
    "id": "yn-azure-oni-broker",
    "name": "Azure Oni Broker",
    "rarity": "SR",
    "color": "U",
    "type": "Creature (Oni Broker)",
    "cost": "{4}{U}",
    "stats": "4/3",
    "mechanics": "Untouchable. Arrives: draw 1, then grind opponent 2."
  },
  {
    "id": "yn-black-kitsune-broker",
    "name": "Black Kitsune Broker",
    "rarity": "SR",
    "color": "B",
    "type": "Creature (Kitsune Broker)",
    "cost": "{3}{B}",
    "stats": "3/3",
    "mechanics": "Deathblade. Arrives: opponent loses 2 life; gain 2 life."
  },
  {
    "id": "yn-cold-boot-mask",
    "name": "Cold-Boot Mask",
    "rarity": "SR",
    "color": "B",
    "type": "Artifact",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "Arrives: grind self 2. Hauntlink {1}{B}. Linked: The linked creature gets +3/+3 and Deathblade."
  },
  {
    "id": "yn-redline-oni-queen",
    "name": "Redline Oni Queen",
    "rarity": "SR",
    "color": "R",
    "type": "Legendary Creature (Oni Boss)",
    "cost": "{4}{R}",
    "stats": "5/4",
    "mechanics": "Warcry, Overrun."
  },
  {
    "id": "yn-ember-link-chain",
    "name": "Ember-Link Chain",
    "rarity": "SR",
    "color": "R",
    "type": "Enchantment",
    "cost": "{2}{R}",
    "stats": "-",
    "mechanics": "At dawn: deal 1 damage to opponent. Hauntlink {R}. Linked: The linked creature gets +1/+0 and Warcry."
  },
  {
    "id": "yn-jade-root-yokai",
    "name": "Jade-Root Yokai",
    "rarity": "SR",
    "color": "G",
    "type": "Creature (Yokai Guardian)",
    "cost": "{4}{G}",
    "stats": "5/5",
    "mechanics": "Sentinel."
  },
  {
    "id": "yn-thorncode-matriarch",
    "name": "Thorncode Matriarch",
    "rarity": "SR",
    "color": "G",
    "type": "Creature (Kitsune Druid)",
    "cost": "{3}{G}",
    "stats": "3/4",
    "mechanics": "Warding Gaze. Arrives: Foresee 2."
  },
  {
    "id": "yn-lantern-fixer",
    "name": "Lantern Fixer",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Kitsune Fixer)",
    "cost": "{1}{W}",
    "stats": "2/2",
    "mechanics": "Arrives: Foresee 1."
  },
  {
    "id": "yn-oni-precinct-captain",
    "name": "Oni Precinct Captain",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Oni Enforcer)",
    "cost": "{4}{W}",
    "stats": "4/4",
    "mechanics": "Sentinel. At dawn: gain 1 life."
  },
  {
    "id": "yn-silver-moon-duelist",
    "name": "Silver-Moon Duelist",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Human Ronin)",
    "cost": "{2}{W}",
    "stats": "2/2",
    "mechanics": "Twin Blades."
  },
  {
    "id": "yn-halo-wire-priestess",
    "name": "Halo-Wire Priestess",
    "rarity": "R",
    "color": "W",
    "type": "Creature (Human Cleric)",
    "cost": "{3}{W}",
    "stats": "3/4",
    "mechanics": "Arrives: gain 3 life."
  },
  {
    "id": "yn-bastion-lantern",
    "name": "Bastion Lantern",
    "rarity": "R",
    "color": "W",
    "type": "Artifact",
    "cost": "{1}{W}",
    "stats": "-",
    "mechanics": "Arrives: gain 3 life. Hauntlink {1}{W}. Linked: The linked creature gets +1/+2 and Sentinel."
  },
  {
    "id": "yn-quiet-the-street",
    "name": "Quiet the Street",
    "rarity": "R",
    "color": "W",
    "type": "Charm",
    "cost": "{W}",
    "stats": "-",
    "mechanics": "Prevent all combat damage this turn. [ANSWER: one go-wide alpha attack.]"
  },
  {
    "id": "yn-sanctuary-sweep",
    "name": "Sanctuary Sweep",
    "rarity": "R",
    "color": "W",
    "type": "Ritual",
    "cost": "{2}{W}{W}",
    "stats": "-",
    "mechanics": "Destroy all creatures. [ANSWER: low-curve creature swarms and token boards.]"
  },
  {
    "id": "yn-echo-fox-informant",
    "name": "Echo-Fox Informant",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kitsune Spy)",
    "cost": "{1}{U}",
    "stats": "2/1",
    "mechanics": "Arrives: Foresee 2."
  },
  {
    "id": "yn-skyline-yokai",
    "name": "Skyline Yokai",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Yokai)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Skyborne, Untouchable."
  },
  {
    "id": "yn-subway-oracle",
    "name": "Subway Oracle",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kappa Oracle)",
    "cost": "{4}{U}",
    "stats": "3/4",
    "mechanics": "Untouchable. At dawn: Foresee 1."
  },
  {
    "id": "yn-bluewire-illusionist",
    "name": "Bluewire Illusionist",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kitsune Illusionist)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Arrives: Foresee 2."
  },
  {
    "id": "yn-moonlit-data-duelist",
    "name": "Moonlit Data Duelist",
    "rarity": "R",
    "color": "U",
    "type": "Creature (Kitsune Ronin)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Skyborne, First Blade."
  },
  {
    "id": "yn-foresee-the-fall",
    "name": "Foresee the Fall",
    "rarity": "R",
    "color": "U",
    "type": "Charm",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Foresee 3."
  },
  {
    "id": "yn-null-route",
    "name": "Null Route",
    "rarity": "R",
    "color": "U",
    "type": "Charm",
    "cost": "{2}{U}",
    "stats": "-",
    "mechanics": "Cancel target spell, then Foresee 1."
  },
  {
    "id": "yn-black-market-oni",
    "name": "Black-Market Oni",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Broker)",
    "cost": "{1}{B}",
    "stats": "2/1",
    "mechanics": "Arrives: opponent loses 1 life; gain 1 life."
  },
  {
    "id": "yn-gravewire-kitsune",
    "name": "Gravewire Kitsune",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Kitsune Hacker)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Deathblade. Arrives: grind self 1."
  },
  {
    "id": "yn-oni-bounty-agent",
    "name": "Oni Bounty Agent",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Hunter)",
    "cost": "{4}{B}",
    "stats": "4/3",
    "mechanics": "Dreaded. Arrives: opponent discards at random 1."
  },
  {
    "id": "yn-bloodline-tollkeeper",
    "name": "Bloodline Tollkeeper",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Oni Collector)",
    "cost": "{2}{B}",
    "stats": "2/3",
    "mechanics": "Blood Oath."
  },
  {
    "id": "yn-underpass-reclaimer",
    "name": "Underpass Reclaimer",
    "rarity": "R",
    "color": "B",
    "type": "Creature (Spirit Salvager)",
    "cost": "{5}{B}",
    "stats": "3/3",
    "mechanics": "Dreaded. Arrives: raise the top creature card from your graveyard."
  },
  {
    "id": "yn-night-market-price",
    "name": "Night-Market Price",
    "rarity": "R",
    "color": "B",
    "type": "Ritual",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "Destroy all creatures; deal 2 damage to you. [ANSWER: low-curve creature swarms outside white.]"
  },
  {
    "id": "yn-sever-the-signal",
    "name": "Sever the Signal",
    "rarity": "R",
    "color": "B",
    "type": "Charm",
    "cost": "{3}{B}",
    "stats": "-",
    "mechanics": "Destroy target artifact or sever target enchantment; opponent loses 1 life. [ANSWER: static creature anthems and value Enchantments.]"
  },
  {
    "id": "yn-redline-kitsune",
    "name": "Redline Kitsune",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Kitsune Runner)",
    "cost": "{1}{R}",
    "stats": "2/1",
    "mechanics": "Warcry, First Blade."
  },
  {
    "id": "yn-neon-oni-brawler",
    "name": "Neon Oni Brawler",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Oni Brawler)",
    "cost": "{2}{R}",
    "stats": "3/2",
    "mechanics": "Arrives: deal 1 damage to opponent."
  },
  {
    "id": "yn-motorbike-ronin",
    "name": "Motorbike Ronin",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Human Ronin)",
    "cost": "{3}{R}",
    "stats": "3/3",
    "mechanics": "First Blade."
  },
  {
    "id": "yn-rainflash-duelist",
    "name": "Rainflash Duelist",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Human Duelist)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "First Blade, Warcry."
  },
  {
    "id": "yn-oni-neon-marshal",
    "name": "Oni Neon Marshal",
    "rarity": "R",
    "color": "R",
    "type": "Creature (Oni Enforcer)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "Warcry. When this attacks: opponent loses 1 life."
  },
  {
    "id": "yn-burn-the-billboard",
    "name": "Burn the Billboard",
    "rarity": "R",
    "color": "R",
    "type": "Ritual",
    "cost": "{2}{R}",
    "stats": "-",
    "mechanics": "Deal 4 damage to target creature or player."
  },
  {
    "id": "yn-hotwire-retort",
    "name": "Hotwire Retort",
    "rarity": "R",
    "color": "R",
    "type": "Charm",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 2 damage to target creature or player, then Foresee 2."
  },
  {
    "id": "yn-jade-kitsune-forager",
    "name": "Jade Kitsune Forager",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Kitsune Forager)",
    "cost": "{1}{G}",
    "stats": "2/2",
    "mechanics": "Warding Gaze. Arrives: gain 1 life."
  },
  {
    "id": "yn-moss-oni-guardian",
    "name": "Moss Oni Guardian",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Oni Guardian)",
    "cost": "{3}{G}",
    "stats": "3/5",
    "mechanics": "Sentinel."
  },
  {
    "id": "yn-canopy-spirit",
    "name": "Canopy Spirit",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Spirit)",
    "cost": "{4}{G}",
    "stats": "4/4",
    "mechanics": "Skyborne."
  },
  {
    "id": "yn-greenline-bruiser",
    "name": "Greenline Bruiser",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Yokai Brawler)",
    "cost": "{2}{G}",
    "stats": "3/3",
    "mechanics": "Overrun."
  },
  {
    "id": "yn-rootcode-ranger",
    "name": "Rootcode Ranger",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Human Ranger)",
    "cost": "{2}{G}",
    "stats": "2/2",
    "mechanics": "Warding Gaze. Arrives: Foresee 1."
  },
  {
    "id": "yn-vineyard-exorcist",
    "name": "Vineyard Exorcist",
    "rarity": "R",
    "color": "G",
    "type": "Creature (Dryad Hunter)",
    "cost": "{4}{G}",
    "stats": "4/5",
    "mechanics": "Arrives: sever the top card of opponent's graveyard."
  },
  {
    "id": "yn-grow-the-grove",
    "name": "Grow the Grove",
    "rarity": "R",
    "color": "G",
    "type": "Ritual",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Target creature gets +3/+3 until end of turn; gain 2 life."
  },
  {
    "id": "yn-rootwall-charm",
    "name": "Rootwall Charm",
    "rarity": "R",
    "color": "G",
    "type": "Charm",
    "cost": "{G}",
    "stats": "-",
    "mechanics": "Target creature gets +0/+4 and Warding Gaze until end of turn."
  },
  {
    "id": "yn-lantern-court-usher",
    "name": "Lantern-Court Usher",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Fixer)",
    "cost": "{1}{W}",
    "stats": "2/2",
    "mechanics": "Arrives: gain 1 life."
  },
  {
    "id": "yn-shrine-circuit-medic",
    "name": "Shrine-Circuit Medic",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Mystic)",
    "cost": "{2}{W}",
    "stats": "2/3",
    "mechanics": "Arrives: gain 2 life."
  },
  {
    "id": "yn-paper-mask-sentinel",
    "name": "Paper-Mask Sentinel",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Yokai Guardian)",
    "cost": "{2}{W}",
    "stats": "2/3",
    "mechanics": "Sentinel."
  },
  {
    "id": "yn-silk-rope-enforcer",
    "name": "Silk-Rope Enforcer",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Oni Enforcer)",
    "cost": "{3}{W}",
    "stats": "3/4",
    "mechanics": "Sentinel."
  },
  {
    "id": "yn-holo-lantern-adept",
    "name": "Holo-Lantern Adept",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Kitsune Adept)",
    "cost": "{1}{W}",
    "stats": "2/1",
    "mechanics": "Sentinel. Arrives: Foresee 1."
  },
  {
    "id": "yn-white-noise-exorcist",
    "name": "White-Noise Exorcist",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Spirit Hunter)",
    "cost": "{2}{W}",
    "stats": "3/2",
    "mechanics": "Deathblade."
  },
  {
    "id": "yn-wardlight-broker",
    "name": "Wardlight Broker",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Human Broker)",
    "cost": "{3}{W}",
    "stats": "3/3",
    "mechanics": "Arrives: your creatures get +0/+1 until end of turn."
  },
  {
    "id": "yn-neon-gate-warden",
    "name": "Neon-Gate Warden",
    "rarity": "C",
    "color": "W",
    "type": "Creature (Oni Guardian)",
    "cost": "{2}{W}",
    "stats": "4/4",
    "mechanics": "Bulwark, Warding Gaze."
  },
  {
    "id": "yn-street-shrine-compact",
    "name": "Street-Shrine Compact",
    "rarity": "C",
    "color": "W",
    "type": "Ritual",
    "cost": "{W}",
    "stats": "-",
    "mechanics": "Target creature gets +2/+2 until end of turn; Foresee 1."
  },
  {
    "id": "yn-paper-ward-signal",
    "name": "Paper-Ward Signal",
    "rarity": "C",
    "color": "W",
    "type": "Charm",
    "cost": "{1}{W}",
    "stats": "-",
    "mechanics": "Destroy target artifact or sever target enchantment. [ANSWER: static creature anthems.]"
  },
  {
    "id": "yn-ghostwire-charm",
    "name": "Ghostwire Charm",
    "rarity": "C",
    "color": "W",
    "type": "Artifact",
    "cost": "{1}{W}",
    "stats": "-",
    "mechanics": "Arrives: gain 1 life. Hauntlink {W}. Linked: The linked creature gets +0/+2 and Sentinel."
  },
  {
    "id": "yn-lantern-canal-junction",
    "name": "Lantern Canal Junction",
    "rarity": "C",
    "color": "W/U",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add W or U."
  },
  {
    "id": "yn-ghostline-diviner",
    "name": "Ghostline Diviner",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Spirit Seer)",
    "cost": "{1}{U}",
    "stats": "2/1",
    "mechanics": "Arrives: Foresee 1."
  },
  {
    "id": "yn-signal-kitsune",
    "name": "Signal Kitsune",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kitsune Hacker)",
    "cost": "{2}{U}",
    "stats": "2/2",
    "mechanics": "Arrives: Foresee 1, then draw 1."
  },
  {
    "id": "yn-data-river-stalker",
    "name": "Data-River Stalker",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kappa Scout)",
    "cost": "{2}{U}",
    "stats": "2/3",
    "mechanics": "Skyborne."
  },
  {
    "id": "yn-raincode-savant",
    "name": "Raincode Savant",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Human Hacker)",
    "cost": "{3}{U}",
    "stats": "3/3",
    "mechanics": "Arrives: draw 1."
  },
  {
    "id": "yn-network-sprite",
    "name": "Network Sprite",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Spirit)",
    "cost": "{U}",
    "stats": "1/2",
    "mechanics": "Skyborne, Bulwark."
  },
  {
    "id": "yn-tidepool-seer",
    "name": "Tidepool Seer",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Kappa Mystic)",
    "cost": "{2}{U}",
    "stats": "2/2",
    "mechanics": "At dawn: Foresee 1."
  },
  {
    "id": "yn-alleywave-tactician",
    "name": "Alleywave Tactician",
    "rarity": "C",
    "color": "U",
    "type": "Creature (Human Tactician)",
    "cost": "{4}{U}",
    "stats": "4/4",
    "mechanics": "Arrives: Foresee 2."
  },
  {
    "id": "yn-circuit-foretelling",
    "name": "Circuit Foretelling",
    "rarity": "C",
    "color": "U",
    "type": "Ritual",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Foresee 4."
  },
  {
    "id": "yn-backdoor-recall",
    "name": "Backdoor Recall",
    "rarity": "C",
    "color": "U",
    "type": "Charm",
    "cost": "{U}",
    "stats": "-",
    "mechanics": "Recall target creature."
  },
  {
    "id": "yn-signal-bridge",
    "name": "Signal Bridge",
    "rarity": "C",
    "color": "U",
    "type": "Charm",
    "cost": "{1}{U}{U}",
    "stats": "-",
    "mechanics": "Cancel target spell."
  },
  {
    "id": "yn-moonwire-mask",
    "name": "Moonwire Mask",
    "rarity": "C",
    "color": "U",
    "type": "Artifact",
    "cost": "{1}{U}",
    "stats": "-",
    "mechanics": "Arrives: Foresee 1. Hauntlink {U}. Linked: The linked creature gets Skyborne."
  },
  {
    "id": "yn-midnight-data-market",
    "name": "Midnight Data Market",
    "rarity": "C",
    "color": "U/B",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add U or B."
  },
  {
    "id": "yn-alley-oni-collector",
    "name": "Alley Oni Collector",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Debt Collector)",
    "cost": "{1}{B}",
    "stats": "2/1",
    "mechanics": "Arrives: opponent loses 1 life."
  },
  {
    "id": "yn-black-lantern-cutpurse",
    "name": "Black-Lantern Cutpurse",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Human Thief)",
    "cost": "{2}{B}",
    "stats": "3/2",
    "mechanics": "Arrives: opponent discards at random 1."
  },
  {
    "id": "yn-shrine-debt-enforcer",
    "name": "Shrine-Debt Enforcer",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Enforcer)",
    "cost": "{3}{B}",
    "stats": "2/3",
    "mechanics": "Deathblade."
  },
  {
    "id": "yn-ghost-market-bruiser",
    "name": "Ghost-Market Bruiser",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Yokai Brawler)",
    "cost": "{3}{B}",
    "stats": "3/3",
    "mechanics": "Blood Oath."
  },
  {
    "id": "yn-kitsune-night-fixer",
    "name": "Kitsune Night Fixer",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Kitsune Broker)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Arrives: opponent loses 1 life; gain 1 life."
  },
  {
    "id": "yn-neon-bloodhound",
    "name": "Neon Bloodhound",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Yokai Hound)",
    "cost": "{2}{B}",
    "stats": "2/2",
    "mechanics": "Deathblade."
  },
  {
    "id": "yn-oni-tollboss",
    "name": "Oni Tollboss",
    "rarity": "C",
    "color": "B",
    "type": "Creature (Oni Enforcer)",
    "cost": "{4}{B}",
    "stats": "4/4",
    "mechanics": "Arrives: opponent loses 1 life."
  },
  {
    "id": "yn-dead-channel-ransom",
    "name": "Dead-Channel Ransom",
    "rarity": "C",
    "color": "B",
    "type": "Ritual",
    "cost": "{B}",
    "stats": "-",
    "mechanics": "Opponent discards at random 1."
  },
  {
    "id": "yn-alleyway-sever",
    "name": "Alleyway Sever",
    "rarity": "C",
    "color": "B",
    "type": "Charm",
    "cost": "{3}{B}",
    "stats": "-",
    "mechanics": "Sever target creature."
  },
  {
    "id": "yn-blackout-vigil",
    "name": "Blackout Vigil",
    "rarity": "C",
    "color": "B",
    "type": "Enchantment",
    "cost": "{2}{B}",
    "stats": "-",
    "mechanics": "At dawn: opponent loses 1 life; gain 1 life."
  },
  {
    "id": "yn-parasite-mask",
    "name": "Parasite Mask",
    "rarity": "C",
    "color": "B",
    "type": "Artifact",
    "cost": "{1}{B}",
    "stats": "-",
    "mechanics": "Arrives: grind self 1. Hauntlink {B}. Linked: The linked creature gets +1/+0 and Deathblade."
  },
  {
    "id": "yn-burning-toll-bridge",
    "name": "Burning Toll Bridge",
    "rarity": "C",
    "color": "B/R",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add B or R."
  },
  {
    "id": "yn-street-oni-scrapper",
    "name": "Street Oni Scrapper",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Oni Brawler)",
    "cost": "{1}{R}",
    "stats": "2/1",
    "mechanics": "Warcry."
  },
  {
    "id": "yn-magenta-kitsune-runner",
    "name": "Magenta Kitsune Runner",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Courier)",
    "cost": "{2}{R}",
    "stats": "3/2",
    "mechanics": "Warcry."
  },
  {
    "id": "yn-rain-soaked-ronin",
    "name": "Rain-Soaked Ronin",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Human Ronin)",
    "cost": "{2}{R}",
    "stats": "2/2",
    "mechanics": "First Blade."
  },
  {
    "id": "yn-tunnel-fire-dancer",
    "name": "Tunnel Fire-Dancer",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Dancer)",
    "cost": "{2}{R}",
    "stats": "2/1",
    "mechanics": "Dreaded, Deathblade."
  },
  {
    "id": "yn-chrome-tailed-raider",
    "name": "Chrome-Tailed Raider",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Kitsune Raider)",
    "cost": "{3}{R}",
    "stats": "4/3",
    "mechanics": "Overrun."
  },
  {
    "id": "yn-signal-smuggler",
    "name": "Signal Smuggler",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Human Smuggler)",
    "cost": "{3}{R}",
    "stats": "3/3",
    "mechanics": "Arrives: deal 1 damage to opponent."
  },
  {
    "id": "yn-glitchhorn-enforcer",
    "name": "Glitchhorn Enforcer",
    "rarity": "C",
    "color": "R",
    "type": "Creature (Yokai Enforcer)",
    "cost": "{5}{R}",
    "stats": "5/5",
    "mechanics": "Warcry, Overrun."
  },
  {
    "id": "yn-street-rush",
    "name": "Street Rush",
    "rarity": "C",
    "color": "R",
    "type": "Ritual",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 3 damage to target creature or player; Deal 1 damage to you."
  },
  {
    "id": "yn-riot-lantern",
    "name": "Riot Lantern",
    "rarity": "C",
    "color": "R",
    "type": "Charm",
    "cost": "{R}",
    "stats": "-",
    "mechanics": "Target creature gets +2/+0 and Warcry until end of turn."
  },
  {
    "id": "yn-sirens-and-sparks",
    "name": "Sirens and Sparks",
    "rarity": "R",
    "color": "R",
    "type": "Charm",
    "cost": "{1}{R}",
    "stats": "-",
    "mechanics": "Deal 3 damage to target creature or player."
  },
  {
    "id": "yn-ember-mask",
    "name": "Ember Mask",
    "rarity": "C",
    "color": "R",
    "type": "Artifact",
    "cost": "{R}",
    "stats": "-",
    "mechanics": "Hauntlink {1}{R}. Linked: The linked creature gets +1/+0 and Warcry."
  },
  {
    "id": "yn-overgrown-speedway",
    "name": "Overgrown Speedway",
    "rarity": "C",
    "color": "R/G",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add R or G."
  },
  {
    "id": "yn-mosswire-kitsune",
    "name": "Mosswire Kitsune",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Kitsune Forager)",
    "cost": "{1}{G}",
    "stats": "2/2",
    "mechanics": "Arrives: gain 1 life."
  },
  {
    "id": "yn-rain-garden-tender",
    "name": "Rain-Garden Tender",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Human Gardener)",
    "cost": "{2}{G}",
    "stats": "2/3",
    "mechanics": "Arrives: Foresee 1."
  },
  {
    "id": "yn-concrete-forest-stalker",
    "name": "Concrete-Forest Stalker",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Hunter)",
    "cost": "{2}{G}",
    "stats": "3/2",
    "mechanics": "Warding Gaze."
  },
  {
    "id": "yn-shrine-vine-warden",
    "name": "Shrine-Vine Warden",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Dryad Guardian)",
    "cost": "{3}{G}",
    "stats": "4/3",
    "mechanics": "Sentinel."
  },
  {
    "id": "yn-jade-rain-brawler",
    "name": "Jade-Rain Brawler",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Brawler)",
    "cost": "{4}{G}",
    "stats": "4/4",
    "mechanics": "Overrun."
  },
  {
    "id": "yn-rootcode-monk",
    "name": "Rootcode Monk",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Human Monk)",
    "cost": "{3}{G}",
    "stats": "3/3",
    "mechanics": "Arrives: destroy the newest artifact or enchantment an opponent controls. [ANSWER: static creature anthems.]"
  },
  {
    "id": "yn-old-growth-gridkeeper",
    "name": "Old-Growth Gridkeeper",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Dryad Guardian)",
    "cost": "{5}{G}",
    "stats": "3/9",
    "mechanics": "Bulwark. At dawn: gain 2 life."
  },
  {
    "id": "yn-vineglass-guardian",
    "name": "Vineglass Guardian",
    "rarity": "C",
    "color": "G",
    "type": "Creature (Yokai Guardian)",
    "cost": "{3}{G}",
    "stats": "4/5",
    "mechanics": "Bulwark, Warding Gaze."
  },
  {
    "id": "yn-ghostwood-growth",
    "name": "Ghostwood Growth",
    "rarity": "C",
    "color": "G",
    "type": "Charm",
    "cost": "{G}",
    "stats": "-",
    "mechanics": "Target creature gets +3/+3 until end of turn."
  },
  {
    "id": "yn-canal-root-surge",
    "name": "Canal Root Surge",
    "rarity": "C",
    "color": "G",
    "type": "Charm",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Target creature gets +2/+2 until end of turn; Foresee 1."
  },
  {
    "id": "yn-thorn-spirit-mask",
    "name": "Thorn-Spirit Mask",
    "rarity": "C",
    "color": "G",
    "type": "Artifact",
    "cost": "{1}{G}",
    "stats": "-",
    "mechanics": "Hauntlink {G}. Linked: The linked creature gets +1/+1 and Warding Gaze."
  },
  {
    "id": "yn-rooftop-shrine-garden",
    "name": "Rooftop Shrine Garden",
    "rarity": "C",
    "color": "G/W",
    "type": "Land",
    "cost": "none",
    "stats": "-",
    "mechanics": "Arrives tapped. Tap: add G or W."
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

/**
 * Tribal lord clause: "Your other <Subtype> get +P/+T[ and gain <Keyword[, Keyword]>]."
 * The Kitsune lords use the bare form; Jade-Crown Elder (2026-09-04) grants
 * Overrun on top of +1/+0.
 */
const LORD_CLAUSE = /Your other ([A-Z][a-z]+) get \+(\d+)\/\+(\d+)(?: and gain ([A-Za-z][A-Za-z ,]*[A-Za-z]))?\.?/i;

function lordStatic(match: RegExpMatchArray): AbilityDef {
  const grantKeywords = match[4] ? parseKeywords(match[4].replace(/ and /g, ', ')) : [];
  if (match[4] && grantKeywords.length === 0) throw new Error('Unknown keyword grant in lord clause: ' + match[0]);
  return {
    when: 'static',
    static: {
      scope: 'filter',
      filter: { subtype: match[1], other: true },
      p: Number(match[2]),
      t: Number(match[3]),
      ...(grantKeywords.length ? { grantKeywords } : {}),
    },
  };
}

function parseAbilityText(text: string, spellMode = false): AbilityDef[] {
  const abilities: AbilityDef[] = [];
  const staticMatch = text.match(new RegExp('^' + LORD_CLAUSE.source + '$', 'i'));
  if (staticMatch) {
    abilities.push(lordStatic(staticMatch));
    return abilities;
  }

  const filterStaticMatch = text.match(LORD_CLAUSE);
  if (filterStaticMatch) {
    abilities.push(lordStatic(filterStaticMatch));
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

/**
 * Every rules clause a row can carry must be consumed by the parser. Anything
 * left over is text the card would silently lose (Jade-Crown Elder shipped
 * 1.7.0 without her authored Empower this way), so it fails the build instead.
 */
function assertFullyParsed(row: YokaiSpecRow, keywordText: string, spellMode: boolean, isLand: boolean): void {
  if (spellMode) return; // the whole body is the spell text
  if (isLand) return; // "Arrives tapped. Tap: ..." is expressed by the land fields, not parsed
  const leftover = row.mechanics
    .replace(/\s*\[ANSWER:[^\]]+\]\.?/g, '')
    .replace(/\s*\(AI-risk survivor\.\)/g, '')
    .replace(keywordText, '')
    .replace(new RegExp(LORD_CLAUSE.source, 'i'), '')
    .replace(/Hauntlink \{[^}]+\}(?:\{[^}]+\})*\. Linked: The linked creature gets .+$/i, '')
    .replace(/(?:At dawn|Arrives|When this attacks|Dies):[^.]+\.?/gi, '')
    .replace(/[.\s]/g, '');
  if (leftover) throw new Error(`Unparsed Yokai mechanics on ${row.id}: "${leftover}"`);
}

/** Exported for the parser tests; the catalog uses the compiled YOKAI_NIGHTS array. */
export function parseYokaiSpecRow(row: YokaiSpecRow): CardDef {
  return parseCard(row);
}

function parseCard(row: YokaiSpecRow): CardDef {
  const typeName = row.type.replace(/^Legendary /, '').split(' (')[0].toLowerCase() as CardType;
  const isLand = typeName === 'land';
  const colors = isLand ? [] : row.color.split('/') as Color[];
  const mana = parseMana(row.cost);
  const stats = parseStats(row.stats);
  const keywordText = row.mechanics.split(/\.|\[/)[0].trim();
  const keywords = parseKeywords(keywordText);
  const spellMode = typeName === 'ritual' || typeName === 'charm';
  const abilities = parseAbilityText(row.mechanics, spellMode);
  assertFullyParsed(row, keywords.length ? keywordText : '', spellMode, isLand);
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
  };
  return { ...card, set: 'yokai-nights' };
}

/** Compiled from the exact table rows above. */
export const YOKAI_NIGHTS = YOKAI_SPEC_ROWS.map(parseCard) as readonly CardDef[];
