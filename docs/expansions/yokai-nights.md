<!-- source-of-truth: docs/plan-1.5.md, docs/plan-1.5-pillar0.md, docs/expansions/drafts/yokai-nights-overplan.md, docs/keyword-map.md, src/engine/types.ts · last-verified: 2026-07-28 · concretion doc - proposed 120-card set; not implemented -->

# Expansion 6 - Cyberpunk Yokai Nights

## Theme and visual identity

Cyberpunk Yokai Nights is a neon-soaked city set where spirits ride the network
through rain-slick streets, holographic lanterns, rooftop shrines, and back-alley
clubs. Kitsune fixers broker impossible favors, oni enforcers collect debts in
chrome masks, and spirit-hacked machines turn every intersection into a haunted
stage.

The tone is glamorous adult gacha noir, never cute. Visual anchors are lacquer,
wet pavement, tailored streetwear, electric magenta, black glass, foxfire,
broken torii, shrine cables, and dangerous women who know exactly what they are
selling. Every card subject is an adult woman or a supernatural entity with no
juvenile presentation.

## Mechanic summary

- **Hauntlink** is the set's one new mechanic. Its exact rules and engine
  handoff live in [plan-1.5-pillar0.md](../plan-1.5-pillar0.md).
- Every table row uses the exact compact template: `Hauntlink {cost}. Linked:
  The linked creature gets [printed rider].`
- A normal-cost cast enters standalone. A Hauntlink cast uses ordinary Artifact
  or Enchantment timing, chooses one creature the caster controls, and enters
  linked to it. The mode and host are locked on cast.
- If the chosen host is illegal at resolution, the spell fizzles to its owner's
  graveyard with no standalone fallback. A link never moves or reattaches and
  goes to its owner's graveyard when its host leaves play.
- Ordinary text outside the Linked line works in both modes. Linked mode alone
  turns on the printed `scope: 'attached'` static rider.
- The supporting vocabulary is the shipped game vocabulary: Foresee, Sever,
  Dreaded, Skim, Retell, Empower, marks, Charm, Ritual, cancel, and the twelve
  shipped combat keywords. This set adds no second new mechanic.

Primary mechanical identity: possession as visible board commitment, tempo,
network-spirit value, sturdy host selection, and clean permanent interaction.
The selected links grant only attack, defense, or shipped keywords. No card
moves a link, chooses a second host, or hides a delayed link decision.

## Rarity target

`60 C / 36 R / 11 SR / 8 SSR / 5 UR = 120 collectible cards`

## Concretion and cull record

The historical overplan remains the 200-row candidate pool. This pass keeps 120
and changes no row in that draft.

| Rarity | Overplan core/flex/stretch | Surviving core/flex/stretch | Surviving total |
| --- | ---: | ---: | ---: |
| C | 47 / 45 / 8 | 47 / 13 / 0 | 60 |
| R | 31 / 24 / 5 | 31 / 5 / 0 | 36 |
| SR | 11 / 7 / 0 | 10 / 1 / 0 | 11 |
| SSR | 12 / 2 / 0 | 8 / 0 / 0 | 8 |
| UR | 7 / 1 / 0 | 4 / 1 / 0 | 5 |
| **Total** | **108 / 79 / 13** | **100 / 20 / 0** | **120** |

All 13 stretch rows were cut before flex rows. Eight core rows were cut only at
SR or higher, where the target bands could not hold every core candidate. Those
cuts also removed unsupported multicolor generics, redundant finishers, and two
of the three multi-turn AI-risk packages.

Five surviving generic multicolor candidates were demoted to one color:

- Moonlit Data Duelist: W/U to U.
- Oni Neon Marshal: B/R to R.
- Azure Oni Broker: U/B to U.
- Rain-Circuit Sovereign: G/W to G.
- Hauntlink Apex: U/R to U. Its rider was recut from red attack pressure to
  blue evasion and protection so the protected headline row fills the U UR
  slot without breaking the multicolor invariant.

No multicolor card survives. Several vague or illegal sketches were lightly
reworked into the real effect vocabulary. Targeted arrival effects became
trigger-safe Foresee, draw, self-mark, face-damage, or newest-permanent effects.
The two conditional creature sweeps became supported all-creature sweeps.
Mode-specific standalone arrivals became ordinary arrivals that work in both
modes. Night-Market Price was rebuilt as a black sweeper because the candidate
pool's two supportable sweepers were both white, leaving the locked broad-answer
requirement with a color-access hole. No new card row was invented.

### Deliberate go-wide answers

The 78.1% static and 74.5% adapted weenie anchors make these slots a set
requirement, not incidental removal.

| ANSWER slot | Class | Intended answer |
| --- | --- | --- |
| Paper-Ward Signal, C W | Targeted permanent answer | Static creature anthems on Artifacts or Enchantments. |
| Rootcode Monk, C G | Trigger-safe permanent answer on a body | The newest opposing anthem without becoming a dead card on an empty board. |
| Quiet the Street, R W | Charm-speed combat prevention | One decisive go-wide alpha attack. |
| Sanctuary Sweep, R W | Full creature sweep | Low-curve creature swarms and token boards. |
| Night-Market Price, R B | Full creature sweep with a self-damage cost | Low-curve creature swarms in decks without white access. |
| Sever the Signal, R B | Targeted permanent answer with life pressure | Static creature anthems and value Enchantments. |
| White-Veil Collapse, SSR W | Full creature sweep plus stabilization | Rebuilt swarms and anthem-backed wide boards. |

These slots must be measured against the completed field. Their presence is a
design claim, not evidence that the go-wide gap is closed.

### AI-risk pilotability

- **Hauntlink Apex:** every mode and host is a fully specified legal action.
  Easy and Medium can rank its one static rider from public host value, while
  Hard simulates the best preordered host candidates. It has no link movement,
  second host, opponent-hand dependency, or conditional linked payoff.

Ghostlight Network and Yokai Network Empress were cut. No other surviving row
carried an `(AI-risk)` tag in the overplan.

## Full card list

### UR

| ID | Name | Rarity | Color | Type | Cost | Stats | Mechanics | Identity hook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-queen-of-the-lanterned-roof | Queen of the Lanterned Roof | UR | W | Legendary Creature (Kitsune Queen) | {5}{W} | 6/6 | Skyborne, Sentinel. Your other Kitsune get +1/+1. | She rules from a rooftop palace where every lantern is a sworn witness. |
| yn-hauntlink-apex | Hauntlink Apex | UR | U | Artifact | {6}{U} | - | At dawn: draw 1. Hauntlink {3}{U}. Linked: The linked creature gets +2/+0, Skyborne, and Untouchable. (AI-risk survivor.) | The perfect possession is a partnership until one voice stops answering. |
| yn-oni-of-the-last-exit | Oni of the Last Exit | UR | B | Legendary Creature (Oni Avatar) | {6}{B} | 7/6 | Dreaded, Deathblade. Arrives: opponent loses 4 life. | Every road out of the city passes beneath her shadow. |
| yn-kitsune-neon-tyrant | Kitsune Neon Tyrant | UR | R | Legendary Creature (Kitsune Boss) | {5}{R} | 6/5 | Warcry, Overrun. When this attacks: deal 2 damage to opponent. | Her tailfire turns the skyline into a personal victory lap. |
| yn-rain-circuit-sovereign | Rain-Circuit Sovereign | UR | G | Legendary Creature (Spirit Sovereign) | {6}{G} | 7/7 | Sentinel, Blood Oath. Arrives: gain 4 life, then Foresee 2. | The old forest wears the city as jewelry and grows stronger under every light. |

### SSR

| ID | Name | Rarity | Color | Type | Cost | Stats | Mechanics | Identity hook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-court-regent | Lantern-Court Regent | SSR | W | Legendary Creature (Kitsune Regent) | {4}{W} | 4/5 | Sentinel. Your other Kitsune get +1/+1. | The court follows her because every other route ends in rain. |
| yn-white-veil-collapse | White-Veil Collapse | SSR | W | Ritual | {5}{W} | - | Destroy all creatures; gain 4 life. [ANSWER: creature swarm and anthem-backed wide boards.] | Her veil falls, and the armies beneath it leave no shadow. |
| yn-ghost-net-archon | Ghost-Net Archon | SSR | U | Legendary Creature (Spirit Archon) | {5}{U} | 5/5 | Skyborne, Untouchable. Arrives: Foresee 3. | It rules a private cloud where every dead password still sings. |
| yn-unanswered-signal | Unanswered Signal | SSR | U | Enchantment | {3}{U} | - | At dawn: draw 1. Hauntlink {2}{U}. Linked: The linked creature gets Skyborne and Untouchable. | The signal keeps calling after the sender has become myth. |
| yn-oni-underboss-of-rain | Oni Underboss of Rain | SSR | B | Legendary Creature (Oni Underboss) | {4}{B} | 5/4 | Dreaded, Deathblade. Arrives: opponent loses 3 life. | She steps from the rain wearing a suit tailored for the end of negotiations. |
| yn-redline-queenpin | Redline Queenpin | SSR | R | Legendary Creature (Kitsune Queenpin) | {4}{R} | 5/4 | Warcry. Arrives: deal 4 damage to opponent. | She controls the fastest route through the city and charges by the second. |
| yn-burning-mask-of-the-void | Burning Mask of the Void | SSR | R | Artifact | {3}{R} | - | Arrives: deal 2 damage to opponent. Hauntlink {2}{R}. Linked: The linked creature gets +2/+0 and Overrun. | The mask burns without consuming the face beneath it. |
| yn-jade-crown-elder | Jade-Crown Elder | SSR | G | Legendary Creature (Yokai Elder) | {5}{G} | 6/6 | Overrun. Arrives: put 2 +1/+1 marks on this. | She remembers when the city was a forest and expects it to return. |

### SR

| ID | Name | Rarity | Color | Type | Cost | Stats | Mechanics | Identity hook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-white-lantern-vanguard | White-Lantern Vanguard | SR | W | Creature (Kitsune Paladin) | {2}{W} | 3/3 | Sentinel. Your other Kitsune get +1/+0. | She leads every procession as if the city were already hers. |
| yn-sanctum-of-many-masks | Sanctum of Many Masks | SR | W | Enchantment | {3}{W} | - | At dawn: gain 2 life. Hauntlink {2}{W}. Linked: The linked creature gets +2/+2 and Sentinel. | Every mask in the sanctum remembers a different patron. |
| yn-blue-ghost-broadcaster | Blue-Ghost Broadcaster | SR | U | Creature (Spirit Hacker) | {3}{U} | 3/4 | Skyborne. Arrives: Foresee 2, then draw 1. | Her broadcast reaches ghosts, gods, and the occasional bored commuter. |
| yn-hauntlink-signal-lure | Hauntlink Signal Lure | SR | U | Artifact | {2}{U} | - | Arrives: Foresee 2. Hauntlink {U}. Linked: The linked creature gets Untouchable. | The lure calls one spirit by its childhood name. |
| yn-azure-oni-broker | Azure Oni Broker | SR | U | Creature (Oni Broker) | {4}{U} | 4/4 | Untouchable. Arrives: draw 1, then grind opponent 2. | Her blue horns glow whenever a secret changes hands. |
| yn-black-kitsune-broker | Black Kitsune Broker | SR | B | Creature (Kitsune Broker) | {3}{B} | 3/3 | Deathblade. Arrives: opponent loses 2 life; gain 2 life. | She charges twice, once for the favor and once for the silence afterward. |
| yn-cold-boot-mask | Cold-Boot Mask | SR | B | Artifact | {2}{B} | - | Arrives: grind self 2. Hauntlink {1}{B}. Linked: The linked creature gets +2/+0 and Deathblade. | Its spirit only wakes when the wearer agrees to betray someone. |
| yn-redline-oni-queen | Redline Oni Queen | SR | R | Legendary Creature (Oni Boss) | {4}{R} | 5/4 | Warcry, Overrun. | She owns the loudest club in the city and the road outside it. |
| yn-ember-link-chain | Ember-Link Chain | SR | R | Enchantment | {2}{R} | - | At dawn: deal 1 damage to opponent. Hauntlink {R}. Linked: The linked creature gets +1/+0 and Warcry. | The chain is a nightclub accessory until its owner starts moving wrong. |
| yn-jade-root-yokai | Jade-Root Yokai | SR | G | Creature (Yokai Guardian) | {4}{G} | 5/5 | Sentinel. | Its roots split the road and make room for an older kind of traffic. |
| yn-thorncode-matriarch | Thorncode Matriarch | SR | G | Creature (Kitsune Druid) | {3}{G} | 3/4 | Warding Gaze. Arrives: Foresee 2. | She wears living circuitry braided from vines and stolen fiber. |

### R

| ID | Name | Rarity | Color | Type | Cost | Stats | Mechanics | Identity hook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-fixer | Lantern Fixer | R | W | Creature (Kitsune Fixer) | {1}{W} | 2/2 | Arrives: Foresee 1. | She can find a safe room in any neighborhood and a buyer in every safe room. |
| yn-oni-precinct-captain | Oni Precinct Captain | R | W | Creature (Oni Enforcer) | {4}{W} | 4/4 | Sentinel. At dawn: gain 1 life. | Her precinct is spotless because every stain has been given a name. |
| yn-silver-moon-duelist | Silver-Moon Duelist | R | W | Creature (Human Ronin) | {2}{W} | 2/2 | First Blade. | Her sword catches moonlight even under a roof of smog. |
| yn-halo-wire-priestess | Halo-Wire Priestess | R | W | Creature (Human Cleric) | {3}{W} | 3/4 | Arrives: gain 3 life. | She cuts the district's violence with a halo made of live cable. |
| yn-bastion-lantern | Bastion Lantern | R | W | Artifact | {2}{W} | - | Arrives: gain 2 life. Hauntlink {1}{W}. Linked: The linked creature gets +1/+1 and Sentinel. | The lantern's ghost chooses defenders who do not run. |
| yn-quiet-the-street | Quiet the Street | R | W | Charm | {1}{W} | - | Prevent all combat damage this turn. [ANSWER: one go-wide alpha attack.] | A single command silences engines, drones, and angry spirits. |
| yn-sanctuary-sweep | Sanctuary Sweep | R | W | Ritual | {5}{W} | - | Destroy all creatures. [ANSWER: low-curve creature swarms and token boards.] | Shrine bells ring once, and the crowded street falls silent. |
| yn-echo-fox-informant | Echo-Fox Informant | R | U | Creature (Kitsune Spy) | {1}{U} | 2/1 | Arrives: Foresee 2. | She records secrets in the echo between two notification chimes. |
| yn-skyline-yokai | Skyline Yokai | R | U | Creature (Yokai) | {3}{U} | 3/3 | Skyborne. | It swims through holograms as if the towers were deep water. |
| yn-subway-oracle | Subway Oracle | R | U | Creature (Kappa Oracle) | {4}{U} | 3/4 | Untouchable. At dawn: Foresee 1. | She knows which train will arrive and who will be waiting on it. |
| yn-bluewire-illusionist | Bluewire Illusionist | R | U | Creature (Kitsune Illusionist) | {3}{U} | 3/3 | Arrives: Foresee 2. | Her decoys all look more trustworthy than the original. |
| yn-moonlit-data-duelist | Moonlit Data Duelist | R | U | Creature (Kitsune Ronin) | {3}{U} | 3/3 | Skyborne, First Blade. | Her blade writes a clean line through every false identity. |
| yn-foresee-the-fall | Foresee the Fall | R | U | Ritual | {2}{U} | - | Foresee 3. | The city warns you three seconds before disaster and charges for the privilege. |
| yn-null-route | Null Route | R | U | Charm | {2}{U} | - | Cancel target spell. | The message vanishes before the network can decide whether it was sent. |
| yn-black-market-oni | Black-Market Oni | R | B | Creature (Oni Broker) | {1}{B} | 2/1 | Arrives: opponent loses 1 life; gain 1 life. | She sells counterfeit blessings from a booth behind the shrine. |
| yn-gravewire-kitsune | Gravewire Kitsune | R | B | Creature (Kitsune Hacker) | {2}{B} | 2/2 | Deathblade. Arrives: grind self 1. | Her foxfire burns violet when it finds a dead account still open. |
| yn-oni-bounty-agent | Oni Bounty Agent | R | B | Creature (Oni Hunter) | {4}{B} | 4/3 | Dreaded. Arrives: opponent discards at random 1. | She finds fugitives by asking their ghosts where they sleep. |
| yn-bloodline-tollkeeper | Bloodline Tollkeeper | R | B | Creature (Oni Collector) | {2}{B} | 2/3 | Blood Oath. | She keeps the family ledger in a chain of old train tokens. |
| yn-underpass-reclaimer | Underpass Reclaimer | R | B | Creature (Spirit Salvager) | {3}{B} | 3/3 | Arrives: raise the top creature card from your graveyard. | She retrieves lost memories from puddles beneath the train line. |
| yn-night-market-price | Night-Market Price | R | B | Ritual | {5}{B} | - | Destroy all creatures; deal 2 damage to you. [ANSWER: low-curve creature swarms outside white.] | Every bargain in the night market has a pulse underneath it. |
| yn-sever-the-signal | Sever the Signal | R | B | Charm | {3}{B} | - | Destroy target artifact or sever target enchantment; opponent loses 1 life. [ANSWER: static creature anthems and value Enchantments.] | A severed broadcast leaves the target alone with its own fear. |
| yn-redline-kitsune | Redline Kitsune | R | R | Creature (Kitsune Runner) | {1}{R} | 2/1 | Warcry. | She rides the rail between stations faster than the cameras can focus. |
| yn-neon-oni-brawler | Neon Oni Brawler | R | R | Creature (Oni Brawler) | {2}{R} | 3/2 | Arrives: deal 1 damage to opponent. | The crowd chants her name because it is easier than saying run. |
| yn-motorbike-ronin | Motorbike Ronin | R | R | Creature (Human Ronin) | {3}{R} | 3/3 | First Blade. | Her motorcycle carries a shrine bell that rings before every duel. |
| yn-rainflash-duelist | Rainflash Duelist | R | R | Creature (Human Duelist) | {4}{R} | 4/3 | First Blade, Warcry. | Her opening blow is visible only as the rain splitting around it. |
| yn-oni-neon-marshal | Oni Neon Marshal | R | R | Creature (Oni Enforcer) | {3}{R} | 4/3 | Warcry. When this attacks: opponent loses 1 life. | Her patrol car is a shrine on wheels and a warning in chrome. |
| yn-burn-the-billboard | Burn the Billboard | R | R | Ritual | {2}{R} | - | Deal 4 damage to target creature or player. | A corporate message becomes a fireball with excellent timing. |
| yn-hotwire-retort | Hotwire Retort | R | R | Charm | {1}{R} | - | Deal 2 damage to target creature or player. | The reply is short, bright, and usually delivered through a fuse. |
| yn-jade-kitsune-forager | Jade Kitsune Forager | R | G | Creature (Kitsune Forager) | {1}{G} | 2/2 | Arrives: gain 1 life. | She grows edible moss on dead vending machines. |
| yn-moss-oni-guardian | Moss Oni Guardian | R | G | Creature (Oni Guardian) | {3}{G} | 3/4 | Sentinel. | Moss softens the horns, but not the temper. |
| yn-canopy-spirit | Canopy Spirit | R | G | Creature (Spirit) | {4}{G} | 4/4 | Skyborne. | It glides from a rooftop garden on wings of leaves and blue light. |
| yn-greenline-bruiser | Greenline Bruiser | R | G | Creature (Yokai Brawler) | {3}{G} | 3/3 | Overrun. | The last thing a drone sees is a grin between two leaves. |
| yn-rootcode-ranger | Rootcode Ranger | R | G | Creature (Human Ranger) | {2}{G} | 2/2 | Warding Gaze. Arrives: Foresee 1. | She maps forgotten parks by following roots under the asphalt. |
| yn-vineyard-exorcist | Vineyard Exorcist | R | G | Creature (Dryad Hunter) | {4}{G} | 4/5 | Arrives: sever the top card of opponent's graveyard. | She tends a vineyard watered by the city reservoir and old grudges. |
| yn-grow-the-grove | Grow the Grove | R | G | Ritual | {3}{G} | - | Target creature gets +3/+3 until end of turn; gain 2 life. | A street tree becomes a cathedral before the cameras can refocus. |
| yn-rootwall-charm | Rootwall Charm | R | G | Charm | {2}{G} | - | Target creature gets +0/+4 and Warding Gaze until end of turn. | Roots rise like a wall around the person who refused to run. |

### C

| ID | Name | Rarity | Color | Type | Cost | Stats | Mechanics | Identity hook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-court-usher | Lantern-Court Usher | C | W | Creature (Human Fixer) | {1}{W} | 2/2 | Arrives: gain 1 life. | She checks the guest list with a smile that never reaches her eyes. |
| yn-shrine-circuit-medic | Shrine-Circuit Medic | C | W | Creature (Human Mystic) | {2}{W} | 2/3 | Arrives: gain 2 life. | Her healing kiosk is open beneath three broken neon torii. |
| yn-paper-mask-sentinel | Paper-Mask Sentinel | C | W | Creature (Yokai Guardian) | {2}{W} | 2/3 | Sentinel. | The mask is cheap paper, but the stare behind it is not. |
| yn-silk-rope-enforcer | Silk-Rope Enforcer | C | W | Creature (Oni Enforcer) | {3}{W} | 3/4 | Sentinel. | She knots a charging cable around her wrist before every collection run. |
| yn-holo-lantern-adept | Holo-Lantern Adept | C | W | Creature (Kitsune Adept) | {1}{W} | 2/1 | Arrives: Foresee 1. | Her foxfire advertisements always know what you wanted yesterday. |
| yn-white-noise-exorcist | White-Noise Exorcist | C | W | Creature (Spirit Hunter) | {2}{W} | 3/2 | Deathblade. | Static from her prayer beads makes counterfeit ghosts blink out. |
| yn-wardlight-broker | Wardlight Broker | C | W | Creature (Human Broker) | {3}{W} | 3/3 | Arrives: your creatures get +0/+1 until end of turn. | She sells protection in measured doses and keeps the best dose for herself. |
| yn-neon-gate-warden | Neon-Gate Warden | C | W | Creature (Oni Guardian) | {4}{W} | 4/4 | Bulwark, Warding Gaze. | Nothing enters the shrine district unless it can survive being seen. |
| yn-street-shrine-compact | Street-Shrine Compact | C | W | Ritual | {1}{W} | - | Target creature gets +1/+1 until end of turn; Foresee 1. | A paper contract glows once, then seals itself in rain. |
| yn-paper-ward-signal | Paper-Ward Signal | C | W | Charm | {1}{W} | - | Destroy target artifact or sever target enchantment. [ANSWER: static creature anthems.] | One folded ward can silence the loudest relic on the block. |
| yn-ghostwire-charm | Ghostwire Charm | C | W | Artifact | {1}{W} | - | Arrives: gain 1 life. Hauntlink {W}. Linked: The linked creature gets +0/+2 and Sentinel. | The charm is warm when the spirit inside approves of its wearer. |
| yn-west-gate-switch | West-Gate Switch | C | W | Land | none | - | Arrives tapped. Tap: add W. | A security gate opens onto a forgotten prayer garden. |
| yn-ghostline-diviner | Ghostline Diviner | C | U | Creature (Spirit Seer) | {1}{U} | 2/1 | Arrives: Foresee 1. | She reads train delays as prophecies and is rarely wrong. |
| yn-signal-kitsune | Signal Kitsune | C | U | Creature (Kitsune Hacker) | {2}{U} | 2/2 | Arrives: Foresee 1, then draw 1. | Her tailtips glow blue whenever a secret packet crosses the grid. |
| yn-data-river-stalker | Data-River Stalker | C | U | Creature (Kappa Scout) | {2}{U} | 2/3 | Skyborne. | It swims through cloud backups and leaves wet footprints on server glass. |
| yn-raincode-savant | Raincode Savant | C | U | Creature (Human Hacker) | {3}{U} | 3/3 | Arrives: draw 1. | She can predict a blackout by listening to the city's vending machines. |
| yn-network-sprite | Network Sprite | C | U | Creature (Spirit) | {1}{U} | 1/3 | Skyborne. | A pinprick of blue foxfire slips between towers before dawn. |
| yn-tidepool-seer | Tidepool Seer | C | U | Creature (Kappa Mystic) | {2}{U} | 2/2 | At dawn: Foresee 1. | She keeps a tide chart for rainwater running down a parking garage. |
| yn-alleywave-tactician | Alleywave Tactician | C | U | Creature (Human Tactician) | {4}{U} | 4/4 | Arrives: Foresee 2. | She wins street fights by making the street disappear under her opponent. |
| yn-circuit-foretelling | Circuit Foretelling | C | U | Ritual | {U} | - | Foresee 2. | The city tells the future in buffering icons and canceled trains. |
| yn-backdoor-recall | Backdoor Recall | C | U | Charm | {1}{U} | - | Recall target creature. | Every locked door has a network address if you know the right spirit. |
| yn-signal-bridge | Signal Bridge | C | U | Charm | {2}{U} | - | Cancel target spell. | The bridge holds while every camera in the city looks elsewhere. |
| yn-moonwire-mask | Moonwire Mask | C | U | Artifact | {1}{U} | - | Arrives: Foresee 1. Hauntlink {U}. Linked: The linked creature gets Skyborne. | Its silver fox face only appears in reflections. |
| yn-east-floodgate | East Floodgate | C | U | Land | none | - | Arrives tapped. Tap: add U. | Rainwater and data both leave the district through this gate. |
| yn-alley-oni-collector | Alley Oni Collector | C | B | Creature (Oni Debt Collector) | {1}{B} | 2/1 | Arrives: opponent loses 1 life. | She invoices the living and lets the dead handle late fees. |
| yn-black-lantern-cutpurse | Black-Lantern Cutpurse | C | B | Creature (Human Thief) | {2}{B} | 3/2 | Arrives: opponent discards at random 1. | Her lantern goes dark just before every wallet opens. |
| yn-shrine-debt-enforcer | Shrine-Debt Enforcer | C | B | Creature (Oni Enforcer) | {2}{B} | 2/3 | Deathblade. | She collects favors with a blade that remembers every name. |
| yn-ghost-market-bruiser | Ghost-Market Bruiser | C | B | Creature (Yokai Brawler) | {3}{B} | 3/3 | Blood Oath. | The market pays her in blood because nobody has anything better. |
| yn-kitsune-night-fixer | Kitsune Night Fixer | C | B | Creature (Kitsune Broker) | {2}{B} | 2/2 | Arrives: opponent loses 1 life; gain 1 life. | She solves problems after midnight and creates better ones before breakfast. |
| yn-neon-bloodhound | Neon Bloodhound | C | B | Creature (Yokai Hound) | {2}{B} | 2/2 | Deathblade. | Its nose follows stolen identities through rain and concrete. |
| yn-oni-tollboss | Oni Tollboss | C | B | Creature (Oni Enforcer) | {4}{B} | 4/4 | Arrives: opponent loses 1 life. | The toll is one coin, one secret, or one apology that sounds sincere. |
| yn-dead-channel-ransom | Dead-Channel Ransom | C | B | Ritual | {1}{B} | - | Opponent discards at random 1. | The ransom note arrives from a number that died years ago. |
| yn-alleyway-sever | Alleyway Sever | C | B | Charm | {2}{B} | - | Sever target creature. | A red sigil flares under the target and the rain washes away the outline. |
| yn-blackout-vigil | Blackout Vigil | C | B | Enchantment | {2}{B} | - | At dawn: opponent loses 1 life; gain 1 life. | The district's lights fail only after the spirits have finished feeding. |
| yn-parasite-mask | Parasite Mask | C | B | Artifact | {1}{B} | - | Arrives: grind self 1. Hauntlink {B}. Linked: The linked creature gets +1/+0 and Deathblade. | The mask smiles whenever its wearer's pulse becomes someone else's. |
| yn-undercity-landscape | Undercity Landscape | C | B | Land | none | - | Arrives tapped. Tap: add B. | Every basement has another city beneath it. |
| yn-street-oni-scrapper | Street Oni Scrapper | C | R | Creature (Oni Brawler) | {1}{R} | 2/1 | Warcry. | She fights for the joy of being recognized by the right crowd. |
| yn-magenta-kitsune-runner | Magenta Kitsune Runner | C | R | Creature (Kitsune Courier) | {2}{R} | 3/2 | Warcry. | Her deliveries arrive hot, loud, and addressed to the city's worst decisions. |
| yn-rain-soaked-ronin | Rain-Soaked Ronin | C | R | Creature (Human Ronin) | {2}{R} | 2/2 | First Blade. | Her sword is dry because the rain knows better than to touch it. |
| yn-tunnel-fire-dancer | Tunnel Fire-Dancer | C | R | Creature (Kitsune Dancer) | {2}{R} | 2/1 | Dreaded. | Her flames make the subway look glamorous right before they make it dangerous. |
| yn-chrome-tailed-raider | Chrome-Tailed Raider | C | R | Creature (Kitsune Raider) | {4}{R} | 4/3 | Overrun. | The chrome tail is a stolen antenna that still picks up war songs. |
| yn-signal-smuggler | Signal Smuggler | C | R | Creature (Human Smuggler) | {3}{R} | 3/3 | Arrives: deal 1 damage to opponent. | She moves contraband prayers through the city in insulated cases. |
| yn-glitchhorn-enforcer | Glitchhorn Enforcer | C | R | Creature (Yokai Enforcer) | {5}{R} | 5/4 | Overrun. | Its horns broadcast a siren that makes traffic forget which way is forward. |
| yn-street-rush | Street Rush | C | R | Ritual | {1}{R} | - | Deal 2 damage to target creature or player. | A red flare turns a routine crossing into a public execution of bad luck. |
| yn-riot-lantern | Riot Lantern | C | R | Charm | {2}{R} | - | Target creature gets +2/+0 and Warcry until end of turn. | The lantern's red glow means the night has chosen a side. |
| yn-sirens-and-sparks | Sirens and Sparks | C | R | Charm | {3}{R} | - | Deal 3 damage to target creature or player. | The city's emergency tones become music when the right yokai conducts them. |
| yn-ember-mask | Ember Mask | C | R | Artifact | {1}{R} | - | Hauntlink {R}. Linked: The linked creature gets +1/+0 and Warcry. | It smells like hot metal and the last thought of a bad enemy. |
| yn-eastline-crossing | Eastline Crossing | C | R | Land | none | - | Arrives tapped. Tap: add R. | The crossing is safest when the signal is already red. |
| yn-mosswire-kitsune | Mosswire Kitsune | C | G | Creature (Kitsune Forager) | {1}{G} | 2/2 | Arrives: gain 1 life. | Her green fur catches rainwater that tastes faintly of cedar. |
| yn-rain-garden-tender | Rain-Garden Tender | C | G | Creature (Human Gardener) | {2}{G} | 2/3 | Arrives: Foresee 1. | She grows medicinal vines over concrete and refuses to apologize for the roots. |
| yn-concrete-forest-stalker | Concrete-Forest Stalker | C | G | Creature (Yokai Hunter) | {2}{G} | 3/2 | Warding Gaze. | It hunts between towers where sunlight has never reached the pavement. |
| yn-shrine-vine-warden | Shrine-Vine Warden | C | G | Creature (Dryad Guardian) | {3}{G} | 3/4 | Sentinel. | The vines move first whenever a stranger raises a weapon. |
| yn-jade-rain-brawler | Jade-Rain Brawler | C | G | Creature (Yokai Brawler) | {4}{G} | 4/4 | Overrun. | Its footsteps leave jade mushrooms growing through asphalt. |
| yn-rootcode-monk | Rootcode Monk | C | G | Creature (Human Monk) | {3}{G} | 3/3 | Arrives: destroy the newest artifact or enchantment an opponent controls. [ANSWER: static creature anthems.] | She meditates beneath a server rack until the rack begins to dream. |
| yn-old-growth-gridkeeper | Old-Growth Gridkeeper | C | G | Creature (Dryad Guardian) | {5}{G} | 5/5 | Bulwark. At dawn: gain 2 life. | The oldest tree in the district has a better firewall than city hall. |
| yn-vineglass-guardian | Vineglass Guardian | C | G | Creature (Yokai Guardian) | {4}{G} | 4/5 | Bulwark, Warding Gaze. | Its transparent bark catches hostile drones before they find the shrine. |
| yn-ghostwood-growth | Ghostwood Growth | C | G | Ritual | {1}{G} | - | Target creature gets +3/+3 until end of turn. | A ghostwood branch punches through the street to answer a threat. |
| yn-canal-root-surge | Canal Root Surge | C | G | Charm | {2}{G} | - | Target creature gets +2/+2 until end of turn; Foresee 1. | The canal wall blooms around the person who needs it most. |
| yn-thorn-spirit-mask | Thorn-Spirit Mask | C | G | Artifact | {1}{G} | - | Hauntlink {G}. Linked: The linked creature gets +1/+1 and Warding Gaze. | The mask grows a new thorn whenever its wearer tells the truth. |
| yn-greenroof-park | Greenroof Park | C | G | Land | none | - | Arrives tapped. Tap: add G. | A public garden hides three shrines and one very old crime. |

## Tokens

No set-unique token is required. None of the surviving 120 rows creates a
token, so carrying any overplan token forward would add unused data, rules text,
and art work without supporting a collectible card.

## Precon identity

**Neon Afterimage** is the proposed W/U/B body-first Hauntlink midrange deck.
It develops efficient white and blue hosts, uses black life pressure and Sever
interaction to keep the board manageable, then links one simple rider to the
best stable creature. Foresee smooths early draws, small life gains stabilize
races, and Skyborne or Deathblade links create the closing attack. The common
pool carries the deck's body, link, and interaction floor; no SR or higher card
is required for the deck to function.

## Gauntlet boss concepts

- **Queen of the Lanterned Roof** at rung 19: W/U Kitsune Hauntlink
  tempo-control using recall, cancel, Foresee, and durable hosts.
- **Kitsune Neon Tyrant** at rung 20: U/R Hauntlink pressure using Warcry,
  Skyborne, direct damage, and Hauntlink Apex as the summit spectacle.

Both are proposals pending approval and later measurement. The tower grows from
18 to 20 floors. No difficulty floor or win-rate gate is set by this document.

## Self-audit

### Rarity by color

Each collectible card has exactly one color after the five demotions.

| Rarity | W | U | B | R | G | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C | 12 | 12 | 12 | 12 | 12 | 60 |
| R | 7 | 7 | 7 | 7 | 8 | 36 |
| SR | 2 | 3 | 2 | 2 | 2 | 11 |
| SSR | 2 | 2 | 1 | 2 | 1 | 8 |
| UR | 1 | 1 | 1 | 1 | 1 | 5 |
| **Total** | **24** | **25** | **23** | **24** | **24** | **120** |

### Type counts

Legendary Creatures are counted as Creatures. Every row has one primary type
in this concretion table.

| Rarity | Creature | Artifact | Enchantment | Charm | Ritual | Land | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C | 37 | 5 | 1 | 7 | 5 | 5 | 60 |
| R | 25 | 1 | 0 | 5 | 5 | 0 | 36 |
| SR | 7 | 2 | 2 | 0 | 0 | 0 | 11 |
| SSR | 5 | 1 | 1 | 0 | 1 | 0 | 8 |
| UR | 4 | 1 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **78** | **10** | **4** | **12** | **11** | **5** | **120** |
