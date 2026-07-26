<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# Expansion 6 - Cyberpunk Yokai Nights

## Set Identity

Cyberpunk Yokai Nights is a neon-soaked city set where yokai spirits ride the network through rain-slick streets, holographic lanterns, rooftop shrines, and back-alley clubs. Kitsune fixers broker impossible favors, oni enforcers collect debts in chrome masks, and spirit-hacked machines turn every intersection into a haunted stage. The tone is glamorous adult gacha noir, never cute: lacquer, wet pavement, tailored streetwear, electric magenta, black glass, and dangerous people who know exactly what they are selling.

The set's one headline mechanic is **Hauntlink**. `Hauntlink {cost}` is an alternate play mode on an Artifact or Enchantment: pay the Hauntlink cost, choose one creature you control, and place the card visibly linked to that creature instead of as a standalone permanent. Its Linked line grants the printed rider to that creature. A link has exactly one host, cannot be moved or reattached, and goes to its owner's graveyard when the host leaves play. Playing the card for its normal cost keeps it as a standalone permanent. This gives possession a clean board shape, a greedy host choice, and a small engine surface: one host pointer, one cleanup rule, and no timing maze.

Hauntlink expresses yokai possession as an explicit relationship rather than a hidden resource. Most links grant immediate combat power, a keyword, or a single arrival effect, so the AI can value the current best body and attack with the result. The set avoids link swapping, multi-host math, and delayed puzzle chains. Foresee, marks, Sever, Retell, bloodoath, Warcry, and the other live house vocabulary provide familiar support around the new link state.

## Candidate Card List

The shipping target is 120 cards, but this concept deliberately overplans 200 candidates: 100 C / 60 R / 18 SR / 14 SSR / 8 UR. Every row includes a proposed id, name, rarity, color, type, cost, creature stats where applicable, a house-vocabulary mechanics sketch, an identity hook, and a cut-priority tag. `(AI-risk)` marks a candidate that asks for multi-turn link sequencing or unusually careful host selection.

### C

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-court-usher | Lantern-Court Usher | C | W | Creature (Human Fixer) | {1}{W} | 2/2 | Arrives: gainLife 1. | She checks the guest list with a smile that never reaches her eyes. | core |
| yn-shrine-circuit-medic | Shrine-Circuit Medic | C | W | Creature (Human Mystic) | {2}{W} | 2/3 | Arrives: gainLife 2. | Her healing kiosk is open beneath three broken neon torii. | core |
| yn-paper-mask-sentinel | Paper-Mask Sentinel | C | W | Creature (Yokai Guardian) | {2}{W} | 2/3 | Sentinel. | The mask is cheap paper, but the stare behind it is not. | core |
| yn-silk-rope-enforcer | Silk-Rope Enforcer | C | W | Creature (Oni Enforcer) | {3}{W} | 3/4 | Sentinel. | He knots a charging cable around his wrist before every collection run. | flex |
| yn-holo-lantern-adept | Holo-Lantern Adept | C | W | Creature (Kitsune Adept) | {1}{W} | 2/1 | Arrives: Foresee 1. | Her foxfire advertisements always know what you wanted yesterday. | flex |
| yn-white-noise-exorcist | White-Noise Exorcist | C | W | Creature (Spirit Hunter) | {2}{W} | 3/2 | Deathblade. | Static from his prayer beads makes counterfeit ghosts blink out. | flex |
| yn-wardlight-broker | Wardlight Broker | C | W | Creature (Human Broker) | {3}{W} | 3/3 | Arrives: boost target creature +0/+2 until end of turn. | She sells protection in measured doses and keeps the best dose for herself. | core |
| yn-shrine-roof-patrol | Shrine-Roof Patrol | C | W | Creature (Kitsune Scout) | {2}{W} | 2/2 | Warding Gaze. | They watch the tram cables for spirits trying to cross without paying. | flex |
| yn-chrome-prayer-deacon | Chrome-Prayer Deacon | C | W | Creature (Human Cleric) | {2}{W} | 2/2 | At dawn: gainLife 1. | His chrome vestments hum louder when the district is afraid. | flex |
| yn-neon-gate-warden | Neon-Gate Warden | C | W | Creature (Oni Guardian) | {4}{W} | 4/4 | Bulwark, Warding Gaze. | Nothing enters the shrine district unless it can survive being seen. | core |
| yn-lantern-veil-duelist | Lantern-Veil Duelist | C | W | Creature (Human Ronin) | {3}{W} | 3/3 | First Blade. | Her lacquered veil hides a duelist who never wastes a flourish. | flex |
| yn-velvet-mask-charger | Velvet-Mask Charger | C | W | Creature (Yokai Knight) | {4}{W} | 4/3 | Warcry. | The club crowd parts before the mask even turns toward them. | flex |
| yn-street-shrine-compact | Street-Shrine Compact | C | W | Ritual | {1}{W} | - | Boost target creature +1/+1; Foresee 1. | A paper contract glows once, then seals itself in rain. | core |
| yn-paper-ward-signal | Paper-Ward Signal | C | W | Charm | {W} | - | PreventCombat. | One folded charm can hush an entire intersection for a breath. | core |
| yn-white-lantern-oath | White-Lantern Oath | C | W | Enchantment | {2}{W} | - | Your other creatures get +0/+1. | The oath is projected above the shrine in letters no camera can capture. | flex |
| yn-ghostwire-charm | Ghostwire Charm | C | W | Artifact | {1}{W} | - | Hauntlink {W}: linked creature gets +0/+2 and Sentinel; arrives: gainLife 1. | The charm is warm when the spirit inside approves of its wearer. | flex |
| yn-west-gate-switch | West-Gate Switch | C | W | Land | none | - | Enters tapped; manaAbility W. | A security gate opens onto a forgotten prayer garden. | core |
| yn-raincourt-steps | Raincourt Steps | C | W | Land | none | - | Enters tapped; manaAbility W. | Each step reflects a different version of the same shrine. | flex |
| yn-shrine-overpass | Shrine Overpass | C | W | Land | none | - | Enters tapped; manaAbility W. | The elevated road carries commuters and wandering souls in equal numbers. | stretch |
| yn-neon-sanctuary | Neon Sanctuary | C | W | Charm | {2}{W} | - | Boost all your creatures +0/+2 until end of turn. | The whole block becomes a safe room when the lanterns turn white. | flex |
| yn-ghostline-diviner | Ghostline Diviner | C | U | Creature (Spirit Seer) | {1}{U} | 2/1 | Arrives: Foresee 1. | She reads train delays as prophecies and is rarely wrong. | core |
| yn-signal-kitsune | Signal Kitsune | C | U | Creature (Kitsune Hacker) | {2}{U} | 2/2 | Arrives: draw 1, then discard 1. | Her tailtips glow blue whenever a secret packet crosses the grid. | core |
| yn-data-river-stalker | Data-River Stalker | C | U | Creature (Kappa Scout) | {2}{U} | 2/3 | Skyborne. | It swims through cloud backups and leaves wet footprints on server glass. | flex |
| yn-raincode-savant | Raincode Savant | C | U | Creature (Human Hacker) | {3}{U} | 3/3 | Arrives: draw 1. | He can predict a blackout by listening to the city's vending machines. | flex |
| yn-maskless-infiltrator | Maskless Infiltrator | C | U | Creature (Yokai Rogue) | {3}{U} | 3/2 | Dreaded. | Everyone recognizes the face, which is why nobody can agree who it belongs to. | flex |
| yn-network-sprite | Network Sprite | C | U | Creature (Spirit) | {1}{U} | 1/3 | Skyborne. | A pinprick of blue foxfire slips between towers before dawn. | core |
| yn-tidepool-seer | Tidepool Seer | C | U | Creature (Kappa Mystic) | {2}{U} | 2/2 | At dawn: Foresee 1. | She keeps a tide chart for rainwater running down a parking garage. | flex |
| yn-wire-ghost-medium | Wire-Ghost Medium | C | U | Creature (Human Medium) | {3}{U} | 2/4 | Untouchable. | The dead whisper through her headphones, but never in the same voice twice. | flex |
| yn-chrome-fan-dancer | Chrome-Fan Dancer | C | U | Creature (Kitsune Performer) | {2}{U} | 2/2 | Warcry. | Her fans scatter hard-light petals that cut anyone following too closely. | flex |
| yn-alleywave-tactician | Alleywave Tactician | C | U | Creature (Human Tactician) | {4}{U} | 4/4 | Arrives: recall target creature. | She wins street fights by making the street disappear under her opponent. | core |
| yn-neon-fog-courier | Neon-Fog Courier | C | U | Creature (Spirit Courier) | {3}{U} | 3/3 | Skyborne. | The courier arrives as fog, signs the receipt, and leaves as a woman. | flex |
| yn-blue-lantern-hacker | Blue-Lantern Hacker | C | U | Creature (Kitsune Hacker) | {4}{U} | 4/4 | Untouchable. | Her lantern contains a polite ghost that refuses every legal notice. | stretch |
| yn-circuit-foretelling | Circuit Foretelling | C | U | Ritual | {U} | - | Foresee 2. | The city tells the future in buffering icons and canceled trains. | core |
| yn-backdoor-recall | Backdoor Recall | C | U | Charm | {1}{U} | - | Recall target creature. | Every locked door has a network address if you know the right spirit. | core |
| yn-afterimage-contract | Afterimage Contract | C | U | Enchantment | {2}{U} | - | At dawn: Foresee 1. | The signature remains after the signer has already changed identities. | flex |
| yn-moonwire-mask | Moonwire Mask | C | U | Artifact | {1}{U} | - | Hauntlink {U}: linked creature gets Skyborne; arrives: Foresee 1. | Its silver fox face only appears in reflections. | core |
| yn-east-floodgate | East Floodgate | C | U | Land | none | - | Enters tapped; manaAbility U. | Rainwater and data both leave the district through this gate. | core |
| yn-rain-channel | Rain Channel | C | U | Land | none | - | Enters tapped; manaAbility U. | A narrow canal carries neon from one district to the next. | flex |
| yn-drowned-terminal | Drowned Terminal | C | U | Land | none | - | Enters tapped; manaAbility U. | The last train still announces itself beneath the flooded platform. | stretch |
| yn-signal-bridge | Signal Bridge | C | U | Charm | {2}{U} | - | Cancel target spell. | The bridge holds while every camera in the city looks elsewhere. | core |
| yn-alley-oni-collector | Alley Oni Collector | C | B | Creature (Oni Debt Collector) | {1}{B} | 2/1 | Arrives: opponent loses 1 life. | He invoices the living and lets the dead handle late fees. | core |
| yn-black-lantern-cutpurse | Black-Lantern Cutpurse | C | B | Creature (Human Thief) | {2}{B} | 3/2 | Arrives: opponent discards at random 1. | Her lantern goes dark just before every wallet opens. | core |
| yn-shrine-debt-enforcer | Shrine-Debt Enforcer | C | B | Creature (Oni Enforcer) | {2}{B} | 2/3 | Deathblade. | He collects favors with a blade that remembers every name. | core |
| yn-ghost-market-bruiser | Ghost-Market Bruiser | C | B | Creature (Yokai Brawler) | {3}{B} | 3/3 | Blood Oath. | The market pays him in blood because nobody has anything better. | flex |
| yn-kitsune-night-fixer | Kitsune Night Fixer | C | B | Creature (Kitsune Broker) | {2}{B} | 2/2 | Arrives: opponent loses 1 life; you gainLife 1. | She solves problems after midnight and creates better ones before breakfast. | core |
| yn-severance-clerk | Severance Clerk | C | B | Creature (Human Clerk) | {3}{B} | 3/2 | Arrives: severGrave opponent 1. | He files the final paperwork on spirits that thought they had escaped. | flex |
| yn-raincoat-reaver | Raincoat Reaver | C | B | Creature (Oni Raider) | {4}{B} | 4/3 | Dreaded. | The yellow raincoat is the last warning before the alley lights go out. | flex |
| yn-subway-crypt-keeper | Subway Crypt-Keeper | C | B | Creature (Spirit Keeper) | {3}{B} | 2/4 | Bulwark. At dawn: grind self 1. | He guards a station that only opens for passengers with no pulse. | flex |
| yn-neon-bloodhound | Neon Bloodhound | C | B | Creature (Yokai Hound) | {2}{B} | 2/2 | Deathblade. | Its nose follows stolen identities through rain and concrete. | core |
| yn-oni-tollboss | Oni Tollboss | C | B | Creature (Oni Enforcer) | {4}{B} | 4/4 | Arrives: opponent loses 1 life. | The toll is one coin, one secret, or one apology that sounds sincere. | core |
| yn-shrine-hexbroker | Shrine Hexbroker | C | B | Creature (Kitsune Witch) | {3}{B} | 3/3 | Untouchable. | She sells curses with a return policy written in disappearing ink. | flex |
| yn-midnight-possessor | Midnight Possessor | C | B | Creature (Spirit) | {4}{B} | 3/4 | Arrives: severGrave opponent 1. | It borrows a stranger's shadow and leaves before the body notices. | stretch |
| yn-dead-channel-ransom | Dead-Channel Ransom | C | B | Ritual | {1}{B} | - | Opponent discards at random 1. | The ransom note arrives from a number that died years ago. | core |
| yn-alleyway-sever | Alleyway Sever | C | B | Charm | {2}{B} | - | Sever target creature with defense 3 or less. | A red sigil flares under the target and the rain washes away the outline. | core |
| yn-blackout-vigil | Blackout Vigil | C | B | Enchantment | {2}{B} | - | At dawn: opponent loses 1 life; you gainLife 1. | The district's lights fail only after the spirits have finished feeding. | flex |
| yn-parasite-mask | Parasite Mask | C | B | Artifact | {1}{B} | - | Hauntlink {B}: linked creature gets +1/+0 and Deathblade; arrives: grind self 1. | The mask smiles whenever its wearer's pulse becomes someone else's. | core |
| yn-undercity-landscape | Undercity Landscape | C | B | Land | none | - | Enters tapped; manaAbility B. | Every basement has another city beneath it. | core |
| yn-blackrail-tunnel | Blackrail Tunnel | C | B | Land | none | - | Enters tapped; manaAbility B. | The train enters empty and leaves with one more passenger. | flex |
| yn-bonewire-yard | Bonewire Yard | C | B | Land | none | - | Enters tapped; manaAbility B. | Scrap metal here grows ribs when the moon is high. | stretch |
| yn-last-call-hex | Last-Call Hex | C | B | Charm | {2}{B} | - | Damage target creature or player 2; you gainLife 1. | The bartender speaks the curse softly enough to make it feel like advice. | flex |
| yn-street-oni-scrapper | Street Oni Scrapper | C | R | Creature (Oni Brawler) | {1}{R} | 2/1 | Warcry. | He fights for the joy of being recognized by the right crowd. | core |
| yn-magenta-kitsune-runner | Magenta Kitsune Runner | C | R | Creature (Kitsune Courier) | {2}{R} | 3/2 | Warcry. | Her deliveries arrive hot, loud, and addressed to the city's worst decisions. | core |
| yn-rain-soaked-ronin | Rain-Soaked Ronin | C | R | Creature (Human Ronin) | {2}{R} | 2/2 | First Blade. | His sword is dry because the rain knows better than to touch it. | core |
| yn-holo-billboard-daredevil | Holo-Billboard Daredevil | C | R | Creature (Yokai Performer) | {3}{R} | 3/3 | Warcry. | She leaps through advertisements that promise a life she already has. | flex |
| yn-oni-garage-charger | Oni Garage Charger | C | R | Creature (Oni Mechanic) | {3}{R} | 3/2 | Arrives: boost another target creature +1/+0. | He tunes motorcycles by listening for the spirits trapped in their engines. | flex |
| yn-tunnel-fire-dancer | Tunnel Fire-Dancer | C | R | Creature (Kitsune Dancer) | {2}{R} | 2/1 | Dreaded. | Her flames make the subway look glamorous right before they make it dangerous. | core |
| yn-chrome-tailed-raider | Chrome-Tailed Raider | C | R | Creature (Kitsune Raider) | {4}{R} | 4/3 | Overrun. | The chrome tail is a stolen antenna that still picks up war songs. | core |
| yn-signal-smuggler | Signal Smuggler | C | R | Creature (Human Smuggler) | {3}{R} | 3/3 | Arrives: damage opponent 1. | He moves contraband prayers through the city in insulated cases. | flex |
| yn-neon-festival-brawler | Neon-Festival Brawler | C | R | Creature (Oni Brawler) | {4}{R} | 4/4 | Warcry. | The festival's champion is always one bad song away from a riot. | flex |
| yn-oni-wasabi-chef | Oni Wasabi Chef | C | R | Creature (Oni Worker) | {2}{R} | 2/2 | Arrives: gainLife 1; damage opponent 1. | His kitchen serves heat, smoke, and one curse per table. | stretch |
| yn-redline-duelist | Redline Duelist | C | R | Creature (Human Ronin) | {3}{R} | 3/2 | First Blade. | She challenges only people who have something worth losing. | flex |
| yn-glitchhorn-enforcer | Glitchhorn Enforcer | C | R | Creature (Yokai Enforcer) | {5}{R} | 5/4 | Overrun. | Its horns broadcast a siren that makes traffic forget which way is forward. | core |
| yn-street-rush | Street Rush | C | R | Ritual | {1}{R} | - | Damage target creature or player 2. | A red flare turns a routine crossing into a public execution of bad luck. | core |
| yn-riot-lantern | Riot Lantern | C | R | Charm | {2}{R} | - | Boost target creature +2/+0 and give it Warcry until end of turn. | The lantern's red glow means the night has chosen a side. | core |
| yn-rooftop-burnline | Rooftop Burnline | C | R | Enchantment | {2}{R} | - | At dawn: damage opponent 1. | Someone paints a new threat across the skyline every night. | flex |
| yn-ember-mask | Ember Mask | C | R | Artifact | {1}{R} | - | Hauntlink {R}: linked creature gets +1/+0 and Warcry. | It smells like hot metal and the last thought of a bad enemy. | core |
| yn-eastline-crossing | Eastline Crossing | C | R | Land | none | - | Enters tapped; manaAbility R. | The crossing is safest when the signal is already red. | core |
| yn-redline-market | Redline Market | C | R | Land | none | - | Enters tapped; manaAbility R. | Every stall sells something that should have stayed in a shrine. | flex |
| yn-fire-escape-roof | Fire-Escape Roof | C | R | Land | none | - | Enters tapped; manaAbility R. | Lovers, thieves, and fox spirits all use the same escape route. | stretch |
| yn-sirens-and-sparks | Sirens and Sparks | C | R | Charm | {3}{R} | - | Damage target creature or player 3. | The city's emergency tones become music when the right yokai conducts them. | flex |
| yn-mosswire-kitsune | Mosswire Kitsune | C | G | Creature (Kitsune Forager) | {1}{G} | 2/2 | Arrives: gainLife 1. | Her green fur catches rainwater that tastes faintly of cedar. | core |
| yn-rain-garden-tender | Rain-Garden Tender | C | G | Creature (Human Gardener) | {2}{G} | 2/3 | Arrives: Foresee 1. | She grows medicinal vines over concrete and refuses to apologize for the roots. | core |
| yn-concrete-forest-stalker | Concrete-Forest Stalker | C | G | Creature (Yokai Hunter) | {2}{G} | 3/2 | Warding Gaze. | It hunts between towers where sunlight has never reached the pavement. | core |
| yn-shrine-vine-warden | Shrine-Vine Warden | C | G | Creature (Dryad Guardian) | {3}{G} | 3/4 | Sentinel. | The vines move first whenever a stranger raises a weapon. | core |
| yn-neon-tanuki-forager | Neon Tanuki Forager | C | G | Creature (Tanuki Scout) | {2}{G} | 2/2 | Arrives: Foresee 1. | It steals batteries from billboards and plants them beneath old trees. | flex |
| yn-rooftop-oni-herder | Rooftop Oni Herder | C | G | Creature (Oni Herder) | {3}{G} | 3/3 | Arrives: boost target creature +1/+1 until end of turn. | Her spirit herd grazes on discarded power cells. | flex |
| yn-jade-rain-brawler | Jade-Rain Brawler | C | G | Creature (Yokai Brawler) | {4}{G} | 4/4 | Overrun. | Its footsteps leave jade mushrooms growing through asphalt. | core |
| yn-rootcode-monk | Rootcode Monk | C | G | Creature (Human Monk) | {3}{G} | 3/3 | Warding Gaze. | He meditates beneath a server rack until the rack begins to dream. | flex |
| yn-canopy-signal-rider | Canopy Signal Rider | C | G | Creature (Kitsune Rider) | {2}{G} | 2/2 | Skyborne. | A paper kite carries her over traffic with a living wind in its string. | flex |
| yn-old-growth-gridkeeper | Old-Growth Gridkeeper | C | G | Creature (Dryad Guardian) | {5}{G} | 5/5 | Bulwark. At dawn: gainLife 2. | The oldest tree in the district has a better firewall than city hall. | core |
| yn-vineglass-guardian | Vineglass Guardian | C | G | Creature (Yokai Guardian) | {4}{G} | 4/5 | Bulwark, Warding Gaze. | Its transparent bark catches hostile drones before they find the shrine. | flex |
| yn-grove-circuit-charger | Grove-Circuit Charger | C | G | Creature (Tanuki Brawler) | {3}{G} | 3/3 | Warcry. | He charges when the rain starts because that is when the roots wake up. | flex |
| yn-ghostwood-growth | Ghostwood Growth | C | G | Ritual | {1}{G} | - | Boost target creature +3/+3 until end of turn. | A ghostwood branch punches through the street to answer a threat. | core |
| yn-canal-root-surge | Canal Root Surge | C | G | Charm | {2}{G} | - | Boost target creature +2/+2; Foresee 1. | The canal wall blooms around the person who needs it most. | core |
| yn-verdant-network | Verdant Network | C | G | Enchantment | {3}{G} | - | At dawn: gainLife 2. | The city park has a root system that routes power better than fiber. | flex |
| yn-thorn-spirit-mask | Thorn-Spirit Mask | C | G | Artifact | {1}{G} | - | Hauntlink {G}: linked creature gets +1/+1 and Warding Gaze. | The mask grows a new thorn whenever its wearer tells the truth. | core |
| yn-greenroof-park | Greenroof Park | C | G | Land | none | - | Enters tapped; manaAbility G. | A public garden hides three shrines and one very old crime. | core |
| yn-rootline-tunnel | Rootline Tunnel | C | G | Land | none | - | Enters tapped; manaAbility G. | Roots pry open a service tunnel toward the river. | flex |
| yn-overgrown-server | Overgrown Server | C | G | Land | none | - | Enters tapped; manaAbility G. | The data center failed, then became a forest with opinions. | stretch |
| yn-jadedusk-bloom | Jadedusk Bloom | C | G | Charm | {2}{G} | - | GainLife 2; Foresee 1. | A jade flower opens beneath a billboard and drinks the static. | flex |

### R

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-fixer | Lantern Fixer | R | W | Creature (Kitsune Fixer) | {1}{W} | 2/2 | Arrives: Foresee 1. | She can find a safe room in any neighborhood and a buyer in every safe room. | core |
| yn-choir-of-warding | Choir of Warding | R | W | Creature (Human Mystic) | {2}{W} | 2/3 | Sentinel; other creatures you control get +0/+1. | Their synchronized hum makes hostile spirits lose their shape. | flex |
| yn-velvet-veil-guard | Velvet-Veil Guard | R | W | Creature (Yokai Guard) | {3}{W} | 3/3 | Sentinel. When this blocks, gainLife 1. | The velvet veil is ceremonial until someone tries to pass it. | flex |
| yn-kitsune-protocoler | Kitsune Protocoler | R | W | Creature (Kitsune Advisor) | {2}{W} | 2/2 | Arrives: boost target creature +1/+1 until end of turn. | She translates shrine law into code that even an oni can obey. | flex |
| yn-oni-precinct-captain | Oni Precinct Captain | R | W | Creature (Oni Enforcer) | {4}{W} | 4/4 | Sentinel; at dawn, gainLife 1. | Her precinct is spotless because every stain has been given a name. | core |
| yn-halo-wire-priestess | Halo-Wire Priestess | R | W | Creature (Human Cleric) | {3}{W} | 3/4 | Arrives: preventCombat. | She cuts the district's violence with a halo made of live cable. | flex |
| yn-silver-moon-duelist | Silver-Moon Duelist | R | W | Creature (Human Ronin) | {2}{W} | 2/2 | First Blade. | Her sword catches moonlight even under a roof of smog. | core |
| yn-bastion-lantern | Bastion Lantern | R | W | Artifact | {2}{W} | - | Hauntlink {1}{W}: linked creature gets +1/+1 and Sentinel; standalone arrives: preventCombat. | The lantern's ghost chooses defenders who do not run. | core |
| yn-quiet-the-street | Quiet the Street | R | W | Charm | {1}{W} | - | PreventCombat. | A single command silences engines, drones, and angry spirits. | core |
| yn-sanctuary-sweep | Sanctuary Sweep | R | W | Ritual | {4}{W} | - | MassDestroy all creatures with attack 2 or less. | Shrine bells ring once, and the smallest threats are gone. | flex |
| yn-halo-market | Halo Market | R | W | Land | none | - | Enters tapped; manaAbility W. | The market sells charms beside counterfeit celebrity relics. | stretch |
| yn-echo-fox-informant | Echo-Fox Informant | R | U | Creature (Kitsune Spy) | {1}{U} | 2/1 | Arrives: Foresee 2. | She records secrets in the echo between two notification chimes. | core |
| yn-raincode-analyst | Raincode Analyst | R | U | Creature (Human Hacker) | {2}{U} | 2/2 | Arrives: draw 1. | His forecasts are boring, accurate, and worth more than a district. | flex |
| yn-skyline-yokai | Skyline Yokai | R | U | Creature (Yokai) | {3}{U} | 3/3 | Skyborne. | It swims through holograms as if the towers were deep water. | core |
| yn-hologram-diver | Hologram Diver | R | U | Creature (Spirit Diver) | {2}{U} | 2/2 | Skyborne; arrives: Foresee 1. | She dives into an advertisement and resurfaces wearing a different face. | flex |
| yn-subway-oracle | Subway Oracle | R | U | Creature (Kappa Oracle) | {4}{U} | 3/4 | Untouchable; at dawn: Foresee 1. | She knows which train will arrive and who will be waiting on it. | core |
| yn-bluewire-illusionist | Bluewire Illusionist | R | U | Creature (Kitsune Illusionist) | {3}{U} | 3/3 | Arrives: recall target creature. | Her decoys all look more trustworthy than the original. | core |
| yn-digital-kappa | Digital Kappa | R | U | Creature (Kappa Hacker) | {2}{U} | 2/3 | Warding Gaze. | It hoards stolen passwords in the bowl of water on its head. | flex |
| yn-moonpool-specter | Moonpool Specter | R | U | Creature (Spirit) | {4}{U} | 4/3 | Dreaded. | The specter crosses the moon's reflection and leaves no wake. | flex |
| yn-foresee-the-fall | Foresee the Fall | R | U | Ritual | {2}{U} | - | Foresee 3. | The city warns you three seconds before disaster and charges for the privilege. | core |
| yn-null-route | Null Route | R | U | Charm | {2}{U} | - | Cancel target spell. | The message vanishes before the network can decide whether it was sent. | core |
| yn-fogbank-terminal | Fogbank Terminal | R | U | Land | none | - | Enters tapped; manaAbility U. | Lost commuters leave offerings beneath the platform screens. | stretch |
| yn-black-market-oni | Black-Market Oni | R | B | Creature (Oni Broker) | {1}{B} | 2/1 | Arrives: opponent loses 1 life; you gainLife 1. | He sells counterfeit blessings from a booth behind the shrine. | core |
| yn-gravewire-kitsune | Gravewire Kitsune | R | B | Creature (Kitsune Hacker) | {2}{B} | 2/2 | Deathblade; arrives: grind self 1. | Her foxfire burns violet when it finds a dead account still open. | core |
| yn-underpass-reclaimer | Underpass Reclaimer | R | B | Creature (Spirit Salvager) | {3}{B} | 3/3 | Arrives: raise a card from your graveyard to the top of your deck. | He retrieves lost memories from puddles beneath the train line. | flex |
| yn-sable-visor-assassin | Sable-Visor Assassin | R | B | Creature (Human Assassin) | {2}{B} | 2/2 | Untouchable. | The visor reflects every witness as an empty chair. | flex |
| yn-oni-bounty-agent | Oni Bounty Agent | R | B | Creature (Oni Hunter) | {4}{B} | 4/3 | Dreaded; arrives: opponent discards at random 1. | She finds fugitives by asking their ghosts where they sleep. | core |
| yn-raincoat-necromancer | Raincoat Necromancer | R | B | Creature (Human Medium) | {3}{B} | 2/4 | Arrives: grind self 2; gainLife 1. | Her yellow coat is bright enough for the dead to follow home. | flex |
| yn-bloodline-tollkeeper | Bloodline Tollkeeper | R | B | Creature (Oni Collector) | {2}{B} | 2/3 | Blood Oath. | He keeps the family ledger in a chain of old train tokens. | core |
| yn-shrine-nightstalker | Shrine Nightstalker | R | B | Creature (Yokai Assassin) | {3}{B} | 3/3 | Deathblade. | It waits behind the shrine app until a user asks the wrong question. | flex |
| yn-night-market-price | Night-Market Price | R | B | Ritual | {2}{B} | - | Opponent losesLife 3; you gainLife 3. | Every bargain in the night market has a pulse underneath it. | core |
| yn-sever-the-signal | Sever the Signal | R | B | Charm | {3}{B} | - | Damage target creature or player 4. | A severed broadcast leaves the target alone with its own fear. | core |
| yn-blackrail-terminus | Blackrail Terminus | R | B | Land | none | - | Enters tapped; manaAbility B. | The terminus has no schedule because the dead do not need one. | stretch |
| yn-redline-kitsune | Redline Kitsune | R | R | Creature (Kitsune Runner) | {1}{R} | 2/1 | Warcry. | She rides the rail between stations faster than the cameras can focus. | core |
| yn-neon-oni-brawler | Neon Oni Brawler | R | R | Creature (Oni Brawler) | {2}{R} | 3/2 | Arrives: damage opponent 1. | The crowd chants her name because it is easier than saying run. | core |
| yn-motorbike-ronin | Motorbike Ronin | R | R | Creature (Human Ronin) | {3}{R} | 3/3 | First Blade. | His motorcycle carries a shrine bell that rings before every duel. | core |
| yn-firework-yokai | Firework Yokai | R | R | Creature (Yokai Performer) | {2}{R} | 2/2 | Warcry; arrives: damage opponent 1. | It bursts into a woman, a dragon, and then a legal liability. | flex |
| yn-rooftop-raider | Rooftop Raider | R | R | Creature (Kitsune Raider) | {3}{R} | 3/2 | Dreaded. | She never enters through a door if the roof has a better view. | flex |
| yn-rainflash-duelist | Rainflash Duelist | R | R | Creature (Human Duelist) | {4}{R} | 4/3 | First Blade; Warcry. | Her opening blow is visible only as the rain splitting around it. | core |
| yn-ember-garage-boss | Ember Garage Boss | R | R | Creature (Oni Mechanic) | {4}{R} | 4/4 | Arrives: boost another target creature +2/+0. | His garage repairs engines and occasionally resurrects them. | flex |
| yn-redline-familiar | Redline Familiar | R | R | Creature (Spirit) | {1}{R} | 2/1 | Arrives: boost target creature +1/+0. | The familiar rides in a jacket pocket and bites anyone who asks. | flex |
| yn-burn-the-billboard | Burn the Billboard | R | R | Ritual | {2}{R} | - | Damage target creature or player 4. | A corporate message becomes a fireball with excellent timing. | core |
| yn-hotwire-retort | Hotwire Retort | R | R | Charm | {1}{R} | - | Damage target creature or player 2. | The reply is short, bright, and usually delivered through a fuse. | core |
| yn-fire-escape-station | Fire-Escape Station | R | R | Land | none | - | Enters tapped; manaAbility R. | The emergency route is crowded with people who planned ahead. | stretch |
| yn-jade-kitsune-forager | Jade Kitsune Forager | R | G | Creature (Kitsune Forager) | {1}{G} | 2/2 | Arrives: gainLife 1. | She grows edible moss on dead vending machines. | core |
| yn-concrete-tanuki | Concrete Tanuki | R | G | Creature (Tanuki Brawler) | {2}{G} | 3/2 | Arrives: gainLife 1. | It naps under bridges until a siren wakes the old magic. | flex |
| yn-moss-oni-guardian | Moss Oni Guardian | R | G | Creature (Oni Guardian) | {3}{G} | 3/4 | Sentinel. | Moss softens the horns, but not the temper. | core |
| yn-rootcode-ranger | Rootcode Ranger | R | G | Creature (Human Ranger) | {2}{G} | 2/2 | Warding Gaze; arrives: Foresee 1. | She maps forgotten parks by following roots under the asphalt. | flex |
| yn-canopy-spirit | Canopy Spirit | R | G | Creature (Spirit) | {4}{G} | 4/4 | Skyborne. | It glides from a rooftop garden on wings of leaves and blue light. | core |
| yn-greenline-bruiser | Greenline Bruiser | R | G | Creature (Yokai Brawler) | {3}{G} | 3/3 | Overrun. | The last thing a drone sees is a grin between two leaves. | core |
| yn-vineyard-exorcist | Vineyard Exorcist | R | G | Creature (Dryad Hunter) | {4}{G} | 4/5 | Arrives: severGrave opponent 1. | She tends a vineyard watered by the city reservoir and old grudges. | flex |
| yn-jade-rain-seer | Jade-Rain Seer | R | G | Creature (Kappa Seer) | {2}{G} | 2/3 | Arrives: Foresee 1. | Her bowl shows the next storm and the face beneath it. | flex |
| yn-grow-the-grove | Grow the Grove | R | G | Ritual | {3}{G} | - | Boost target creature +3/+3; gainLife 2. | A street tree becomes a cathedral before the cameras can refocus. | core |
| yn-rootwall-charm | Rootwall Charm | R | G | Charm | {2}{G} | - | Boost target creature +0/+4 and give it Warding Gaze until end of turn. | Roots rise like a wall around the person who refused to run. | core |
| yn-mossline-reservoir | Mossline Reservoir | R | G | Land | none | - | Enters tapped; manaAbility G. | Green water glows beneath the maintenance hatch. | stretch |
| yn-moonlit-data-duelist | Moonlit Data Duelist | R | W/U | Creature (Kitsune Ronin) | {3}{W}{U} | 3/3 | Skyborne, First Blade. | Her blade writes a clean line through every false identity. | core |
| yn-inkblood-operator | Inkblood Operator | R | U/B | Creature (Spirit Hacker) | {3}{U}{B} | 3/3 | Arrives: Foresee 2; grind opponent 1. | He routes blackmail through a shrine terminal that has no owner. | flex |
| yn-oni-neon-marshal | Oni Neon Marshal | R | B/R | Creature (Oni Enforcer) | {3}{B}{R} | 4/3 | Warcry; opponent loses 1 life when this attacks. | Her patrol car is a shrine on wheels and a warning in chrome. | core |
| yn-redwood-rain-fox | Redwood Rain Fox | R | R/G | Creature (Kitsune Rider) | {3}{R}{G} | 4/4 | Overrun; arrives: gainLife 2. | It races the storm along the elevated garden tracks. | flex |
| yn-grove-lantern-warden | Grove-Lantern Warden | R | G/W | Creature (Dryad Guardian) | {2}{G}{W} | 3/3 | Sentinel; arrives: gainLife 2. | Her lantern keeps the last green corner of the city breathing. | flex |

### SR

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-white-lantern-vanguard | White-Lantern Vanguard | SR | W | Creature (Kitsune Paladin) | {2}{W} | 3/3 | Sentinel; your linked creatures get +1/+0. | She leads every procession as if the city were already hers. | core |
| yn-wardglass-matriarch | Wardglass Matriarch | SR | W | Creature (Human Exorcist) | {4}{W} | 4/5 | Warding Gaze; arrives: preventCombat. | Her wardglass staff makes even aggressive spirits reconsider. | flex |
| yn-sanctum-of-many-masks | Sanctum of Many Masks | SR | W | Enchantment | {3}{W} | - | Hauntlink {2}{W}: linked creature gets +2/+2 and Sentinel; at dawn, gainLife 2. | Every mask in the sanctum remembers a different patron. | core |
| yn-blue-ghost-broadcaster | Blue-Ghost Broadcaster | SR | U | Creature (Spirit Hacker) | {3}{U} | 3/4 | Skyborne; arrives: Foresee 2 and draw 1. | Her broadcast reaches ghosts, gods, and the occasional bored commuter. | core |
| yn-rain-network-leviathan | Rain-Network Leviathan | SR | U | Creature (Yokai) | {5}{U} | 5/5 | Skyborne; at dawn: recall target creature. | It coils through rain clouds above the city like a living backbone. | flex |
| yn-hauntlink-signal-lure | Hauntlink Signal Lure | SR | U | Artifact | {2}{U} | - | Hauntlink {U}: linked creature becomes Untouchable; standalone arrives: recall target creature. | The lure calls one spirit by its childhood name. | core |
| yn-black-kitsune-broker | Black Kitsune Broker | SR | B | Creature (Kitsune Broker) | {3}{B} | 3/3 | Deathblade; arrives: opponent loses 2 life, you gainLife 2. | She charges twice, once for the favor and once for the silence afterward. | core |
| yn-oni-grave-foreman | Oni Grave Foreman | SR | B | Creature (Oni Enforcer) | {4}{B} | 4/4 | Dreaded; when this leaves play, grind opponent 2. | He runs the graveyard shift and knows exactly which names are missing. | flex |
| yn-cold-boot-mask | Cold-Boot Mask | SR | B | Artifact | {2}{B} | - | Hauntlink {1}{B}: linked creature gets +2/+0 and Deathblade; arrives: grind self 2. | Its spirit only wakes when the wearer agrees to betray someone. | core |
| yn-redline-oni-queen | Redline Oni Queen | SR | R | Creature (Oni Boss) | {4}{R} | 5/4 | Warcry, Overrun. | She owns the loudest club in the city and the road outside it. | core |
| yn-holo-fire-kitsune | Holo-Fire Kitsune | SR | R | Creature (Kitsune Illusionist) | {3}{R} | 3/3 | Warcry; arrives: damage target creature or player 2. | Her flames are fake until the moment they touch you. | flex |
| yn-ember-link-chain | Ember-Link Chain | SR | R | Enchantment | {2}{R} | - | Hauntlink {R}: linked creature gets +1/+0 and Warcry; at dawn, damage opponent 1. | The chain is a nightclub accessory until its owner starts moving wrong. | core |
| yn-jade-root-yokai | Jade-Root Yokai | SR | G | Creature (Yokai Guardian) | {4}{G} | 5/5 | Sentinel. | Its roots split the road and make room for an older kind of traffic. | core |
| yn-thorncode-matriarch | Thorncode Matriarch | SR | G | Creature (Kitsune Druid) | {3}{G} | 3/4 | Warding Gaze; arrives: Foresee 2. | She wears living circuitry braided from vines and stolen fiber. | flex |
| yn-azure-oni-broker | Azure Oni Broker | SR | U/B | Creature (Oni Broker) | {4}{U}{B} | 4/4 | Untouchable; arrives: draw 1 and grind opponent 2. | His blue horns glow whenever a secret changes hands. | core |
| yn-neon-shrine-champion | Neon Shrine Champion | SR | W/R | Creature (Human Ronin) | {3}{W}{R} | 4/4 | First Blade, Warcry. | She turns a shrine festival into a duel and a duel into a headline. | core |
| yn-verdant-rain-exorcist | Verdant-Rain Exorcist | SR | G/W | Creature (Dryad Exorcist) | {4}{G}{W} | 4/5 | Sentinel; arrives: gainLife 3. | Her green wards make the rain fall clean for one precious block. | flex |
| yn-crimson-ghost-courier | Crimson Ghost Courier | SR | B/R | Artifact | {3}{B}{R} | - | Hauntlink {B}{R}: linked creature gets Blood Oath and +1/+0; standalone arrives: damage opponent 2. | The courier carries a sealed red envelope from the spirit world. | flex |

### SSR

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-lantern-court-regent | Lantern-Court Regent | SSR | W | Creature (Kitsune Regent) | {4}{W} | 4/5 | Sentinel; your linked creatures get +1/+1. | The court follows her because every other route ends in rain. | core |
| yn-white-veil-collapse | White-Veil Collapse | SSR | W | Ritual | {5}{W} | - | MassDestroy all creatures with attack 3 or less. | Her veil falls, and the small armies beneath it are simply no longer there. | core |
| yn-ghost-net-archon | Ghost-Net Archon | SSR | U | Creature (Spirit Archon) | {5}{U} | 5/5 | Skyborne, Untouchable; arrives: Foresee 3. | It rules a private cloud where every dead password still sings. | core |
| yn-unanswered-signal | Unanswered Signal | SSR | U | Enchantment | {3}{U} | - | Hauntlink {2}{U}: linked creature becomes Skyborne and Untouchable; at dawn, draw 1. | The signal keeps calling after the sender has become myth. | core |
| yn-oni-underboss-of-rain | Oni Underboss of Rain | SSR | B | Creature (Oni Underboss) | {4}{B} | 5/4 | Dreaded, Deathblade; arrives: opponent loses 3 life. | He steps from the rain wearing a suit tailored for the end of negotiations. | core |
| yn-severed-name-ritual | Severed Name Ritual | SSR | B | Ritual | {4}{B} | - | Sever target creature; severGrave opponent 2. | The target's name disappears from every shrine ledger at once. | core |
| yn-redline-queenpin | Redline Queenpin | SSR | R | Creature (Kitsune Queenpin) | {4}{R} | 5/4 | Warcry; arrives: damage target creature or player 4. | She controls the fastest route through the city and charges by the second. | core |
| yn-burning-mask-of-the-void | Burning Mask of the Void | SSR | R | Artifact | {3}{R} | - | Hauntlink {2}{R}: linked creature gets Overrun and +2/+0; arrives: damage opponent 2. | The mask burns without consuming the face beneath it. | core |
| yn-jade-crown-elder | Jade-Crown Elder | SSR | G | Creature (Yokai Elder) | {5}{G} | 6/6 | Overrun; arrives: add 2 marks to another target creature. | She remembers when the city was a forest and expects it to return. | core |
| yn-worldroot-backdoor | Worldroot Backdoor | SSR | G | Enchantment | {4}{G} | - | At dawn: Foresee 2 and gainLife 3. | A root tunnel opens into a server room that predates the building. | flex |
| yn-midnight-kitsune-sovereign | Midnight Kitsune Sovereign | SSR | U/B | Creature (Kitsune Sovereign) | {5}{U}{B} | 5/5 | Skyborne, Untouchable; arrives: draw 2. | She wears the city's blackout like a crown and never repeats a favor. | core |
| yn-neon-oni-warengine | Neon Oni Warengine | SSR | B/R | Creature (Oni Engine) | {5}{B}{R} | 6/5 | Warcry, Dreaded; arrives: damage target creature or player 4. | A spirit-hacked machine learned to want the driver's seat. | core |
| yn-rainforest-spirit-empress | Rainforest Spirit Empress | SSR | G/W | Creature (Spirit Empress) | {5}{G}{W} | 5/6 | Sentinel, Blood Oath; arrives: add 1 mark to each other creature you control. | Her procession makes vines bloom through the neon and soldiers lower their weapons. | core |
| yn-ghostlight-network | Ghostlight Network | SSR | W/U | Artifact | {4}{W}{U} | - | Hauntlink {2}{W}{U}: linked creature becomes Skyborne and Sentinel; at dawn: Foresee 1. (AI-risk) | The network chooses one living node and whispers through it all night. | flex |

### UR

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| yn-queen-of-the-lanterned-roof | Queen of the Lanterned Roof | UR | W | Creature (Kitsune Queen) | {5}{W} | 6/6 | Skyborne, Sentinel; your linked creatures get +1/+1. | She rules from a rooftop palace where every lantern is a sworn witness. | core |
| yn-ghost-in-the-mainframe | Ghost in the Mainframe | UR | U | Creature (Spirit Avatar) | {6}{U} | 6/6 | Skyborne, Untouchable; arrives: cancel target spell or Foresee 2. | The city's oldest ghost has finally found a body large enough for its ambition. | core |
| yn-oni-of-the-last-exit | Oni of the Last Exit | UR | B | Creature (Oni Avatar) | {6}{B} | 7/6 | Dreaded, Deathblade; arrives: opponent loses 4 life. | Every road out of the city passes beneath his shadow. | core |
| yn-kitsune-neon-tyrant | Kitsune Neon Tyrant | UR | R | Creature (Kitsune Boss) | {5}{R} | 6/5 | Warcry, Overrun; when this attacks, damage opponent 2. | Her tailfire turns the skyline into a personal victory lap. | core |
| yn-yokai-network-empress | Yokai Network Empress | UR | U/B | Creature (Yokai Empress) | {6}{U}{B} | 6/6 | Skyborne, Untouchable; at dawn, if you control a linked creature, draw 2 and opponent loses 2 life. (AI-risk) | She does not possess the network. She is the network's preferred body. | core |
| yn-oni-sunrise-breaker | Oni Sunrise Breaker | UR | B/R | Creature (Oni Avatar) | {6}{B}{R} | 7/6 | Dreaded, Overrun, Warcry; arrives: damage opponent 4. | He punches through the last hour of night and leaves the city smoking gold. | core |
| yn-rain-circuit-sovereign | Rain-Circuit Sovereign | UR | G/W | Creature (Spirit Sovereign) | {6}{G}{W} | 7/7 | Sentinel, Blood Oath; arrives: add 1 mark to each other creature you control. | The old forest wears the city as jewelry and grows stronger under every light. | flex |
| yn-hauntlink-apex | Hauntlink Apex | UR | U/R | Artifact | {5}{U}{R} | - | Hauntlink {3}{U}{R}: linked creature gets +3/+0, Skyborne, and Warcry; at dawn: draw 1 and damage opponent 2. (AI-risk) | The perfect possession is a partnership until one voice stops answering. | core |

## Set-Unique Token Proposals

These are proposed set tokens only. They are intentionally simple bodies so Hauntlink and the main card list carry the identity.

| Token | Color | Type and subtypes | Stats | Token rules sketch | Identity hook |
| --- | --- | --- | --- | --- | --- |
| Lantern Wisp | W | Creature (Spirit) | 1/1 | Skyborne. | A pocket-sized shrine light that refuses to go out in the rain. |
| Oni Drone | R | Creature (Oni Machine) | 2/1 | Warcry. | Its paper talisman is taped over a targeting camera. |
| Grave Fox | B | Creature (Kitsune Spirit) | 1/1 | Deathblade. | It leaves violet pawprints on the side of every closed coffin. |
| Rain Kappa | U | Creature (Kappa) | 1/3 | Warding Gaze. | It collects data in a bowl of rainwater and never shares the password. |
| Rootbound Yokai | G | Creature (Yokai Guardian) | 2/2 | Sentinel. | It rises from a planter whenever the city forgets to breathe. |

## Precon Identity

**Neon Afterimage** is a W/U/B Hauntlink midrange deck. It deploys efficient white and blue bodies, uses black pressure and clean Sever answers to keep the board manageable, then links spirits to the best surviving attacker or blocker. Foresee smooths the early curve, small life swings stabilize races, and Skyborne or Dreaded links close the game from above the street. The win route is board-first and greedy: play a body, make the link, attack, and use cheap answers to preserve the lead. The common pool is intentionally strong enough that the precon does not depend on rare engines to function.

## Gauntlet Boss Concepts

- **Mizue, Rain-Grid Oracle** (rung 17) - U/B control boss with Foresee, recall effects, Untouchable threats, and Hauntlink Signal Lure to turn one evasive body into a protected closer.
- **Gorai, King of the Last Exit** (rung 18) - B/R/G pressure boss with Oni bodies, Warcry, Dreaded attacks, direct damage, and a small number of high-impact Hauntlink finishers.

## Selection Notes

### Ten candidates to protect first

1. **yn-ghostwire-charm, Ghostwire Charm** - common Hauntlink onboarding with immediate life stabilization.
2. **yn-moonwire-mask, Moonwire Mask** - common blue link that makes the possession loop visible without overloading the card.
3. **yn-parasite-mask, Parasite Mask** - common black pressure link that creates a real reason to attack.
4. **yn-ember-mask, Ember Mask** - common red link that turns a fair body into immediate tempo.
5. **yn-thorn-spirit-mask, Thorn-Spirit Mask** - common green link with a defensive role and strong yokai silhouette.
6. **yn-lantern-fixer, Lantern Fixer** - rare bridge body that rewards the set's efficient curve.
7. **yn-hauntlink-signal-lure, Hauntlink Signal Lure** - rare blue answer that makes the alternate play mode matter.
8. **yn-white-lantern-vanguard, White-Lantern Vanguard** - SR payoff that rewards links without requiring a large board.
9. **yn-ghostlight-network, Ghostlight Network** - SSR centerpiece for the network possession fantasy, pending AI testing.
10. **yn-hauntlink-apex, Hauntlink Apex** - UR spectacle that sells the set in one readable combat turn.

### Three biggest design risks

1. **Hauntlink state and presentation.** The engine and UI need a clear linked-card zone, host cleanup, save representation, and readable rules text. A vague link display would make the set feel broken even if the math is sound.
2. **AI host valuation.** A greedy heuristic can choose the largest current body, but protection, Skyborne, Warcry, and dawn riders may create edge cases. The link cards marked `(AI-risk)` need seeded engine measurement before any rate claim is trusted.
3. **Power-floor drift.** The overplan includes many efficient commons and several strong answers on purpose. The selection pass must preserve that floor without letting cheap link bonuses make ordinary bodies scale too quickly, especially in W/R and B/R shells.
