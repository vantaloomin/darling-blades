<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# The Drowned Deep: Overplan Card List

## Set Identity

The Drowned Deep is a cosmic horror slate set about drowned Victorian coastal towns under abyssal starlight. Pale mediums keep watch in salt-stained chapels, deep-sea things drift beneath boarded promenades, guttering candles mark the last safe doors, and a green-black tide climbs every familiar stair. The mood is elegant dread rather than gore: mourning clothes, brass instruments, wet glass, black water, and impossible stars. The set's central question is whether a person can use the thing calling from below without answering it.

**Whispers**: If a card with Whispers is discarded from your hand, you may cast it immediately for its Whispers cost as it goes. This is the set's main identity because the card appears to answer the hand's small losses with a dangerous second voice. It deliberately gives the shipped Skim discard engine a payoff, while remaining greedy-AI friendly: a heuristic can compare the normal cost with the Whispers cost and cast the cheaper available action. The effect is a local alternative cost seam, not a new player resource, and it creates pressure without asking for a multi-turn setup.

**Dread of the Deep**: As you cast a Horror with Dread of the Deep, you may sacrifice a creature. Reduce that Horror's cost by the sacrificed creature's cost. This optional second mechanic makes the town's disposable workers and summoned tokens into a clean price for larger horrors. It fits the engine's existing death and sacrifice vocabulary and asks for one immediate affordability decision. It is marked less often than Whispers so the set can still function as a coastal control set when the Horror package is not assembled.

The set uses Foresee, Sever, Skim, Retell, marks, Dreaded, Empower, Warcry, Overrun, Skyborne, Sentinel, First Blade, Twin Blades, Deathblade, Untouchable, Bulwark, Warding Gaze, Blood Oath, Quests with Chapters, and Awakened only where their shipped meanings fit. Candidate rows are intentionally conceptual and do not claim that Whispers or Dread of the Deep are implemented.

## Rarity Target

This overplan contains 200 candidates: 100 C / 60 R / 18 SR / 14 SSR / 8 UR. The eventual shipping target is 120 cards: 60 C / 36 R / 11 SR / 8 SSR / 5 UR. Multicolor candidates are reserved for higher rarities and remain below ten percent of the overplan. Commons are built around efficient bodies, direct board answers, and simple triggers so the precon can win games on board rather than durdle toward a story moment.

## Full Candidate List

### Commons

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity/flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-candlewatch-medium | Candlewatch Medium | C | W | Creature, Medium | {1}{W} | 2/2 | Arrives: gainLife 1. | She reads the flame by the way it refuses the wind. | core |
| dd-tidewall-bearer | Tidewall Bearer | C | W | Creature, Human | {2}{W} | 3/3 | Sentinel. | The seawall holds because someone keeps choosing to stand there. | core |
| dd-pale-choir-acolyte | Pale Choir Acolyte | C | W | Creature, Medium | {2}{W} | 2/3 | Arrives: Foresee 1. | Every hymn ends one note short of the truth. | flex |
| dd-lighthouse-guard | Lighthouse Guard | C | W | Creature, Human | {3}{W} | 3/4 | Warding Gaze. | Her lantern is a warning to ships and to whatever follows them. | core |
| dd-brineward-apparition | Brineward Apparition | C | W | Creature, Spirit | {3}{W} | 3/3 | Arrives: boost another target creature +0/+2 until end of turn. | The drowned keep watch with the manners of old soldiers. | flex |
| dd-coastal-relief-worker | Coastal Relief Worker | C | W | Creature, Human | {2}{W} | 2/2 | Arrives: gainLife 2. | The soup line is longer than the graveyard and more hopeful. | core |
| dd-ivory-tide-knight | Ivory Tide Knight | C | W | Creature, Human | {3}{W} | 3/3 | First Blade. | Her blade catches the first glint of the black tide. | flex |
| dd-gutter-lantern-bearer | Gutter Lantern Bearer | C | W | Creature, Human | {W} | 2/1 | When this attacks, gainLife 1. | He carries a candle through streets where the stars have come down. | core |
| dd-saltchapel-warden | Saltchapel Warden | C | W | Creature, Human | {4}{W} | 4/5 | Bulwark. | The chapel door is narrow because the town was built to be defended. | flex |
| dd-ashen-medium | Ashen Medium | C | W | Creature, Medium | {3}{W} | 2/4 | Arrives: Foresee 1 and gainLife 1. | Her veil is clean, her hands are not. | flex |
| dd-moonlit-ferryhand | Moonlit Ferryhand | C | W | Creature, Human | {2}{W} | 2/2 | Whenever another creature you control dies, gainLife 1. | He knows every passenger deserves a fare, even the silent ones. | flex |
| dd-whitewater-responder | Whitewater Responder | C | W | Creature, Human | {1}{W} | 2/1 | Arrives: boost target creature +1/+1 until end of turn. | The rescue bell rings before anyone admits there is a flood. | core |
| dd-inkwater-apprentice | Inkwater Apprentice | C | U | Creature, Human | {1}{U} | 2/2 | Arrives: Foresee 1. | Her notes are written in ink that moves when no one watches. | core |
| dd-mistbank-diver | Mistbank Diver | C | U | Creature, Human | {2}{U} | 2/3 | Skyborne. | The fog lifts for her and closes behind her. | flex |
| dd-reefglass-seer | Reefglass Seer | C | U | Creature, Medium | {2}{U} | 2/2 | Arrives: Foresee 2. | The lens shows the shore as it will look after the bells stop. | core |
| dd-tidechart-scribe | Tidechart Scribe | C | U | Creature, Human | {3}{U} | 3/3 | Whenever you cast a Whispers card, Foresee 1. | She annotates prophecies in the margins and drowns the originals. | stretch (AI-risk) |
| dd-pale-current-stalker | Pale Current Stalker | C | U | Creature, Horror | {3}{U} | 3/3 | Dreaded. | It follows the current because the current remembers every name. | core |
| dd-soundless-ferrywoman | Soundless Ferrywoman | C | U | Creature, Human | {1}{U} | 1/3 | Arrives: tap target creature with cost 2 or less. | Her oar touches water without making a promise. | flex |
| dd-deepwater-courier | Deepwater Courier | C | U | Creature, Human | {2}{U} | 2/4 | Arrives: draw 1, then discard 1. | The message is always delivered, though the recipient may not be human. | core |
| dd-candlefish-handler | Candlefish Handler | C | U | Creature, Human | {3}{U} | 3/2 | Arrives: Foresee 1. | The little lights swim in formation until they see the moon. | flex |
| dd-drowned-astrologer | Drowned Astrologer | C | U | Creature, Medium | {4}{U} | 3/4 | Arrives: Foresee 2. | Her chart has one extra constellation and no safe interpretation. | flex |
| dd-quiet-harbor-savant | Quiet Harbor Savant | C | U | Creature, Human | {4}{U} | 4/4 | When this arrives, if you have cast a Whispers card this turn, draw 1. | He speaks only after the sea has finished speaking through him. | stretch (AI-risk) |
| dd-glass-eel-scout | Glass Eel Scout | C | U | Creature, Fish | {1}{U} | 2/1 | Skyborne. | It slips between raindrops and returns with a stranger's face. | core |
| dd-undertow-usher | Undertow Usher | C | U | Creature, Human | {2}{U} | 2/2 | Arrives: tap target creature. | She opens the door and the floor becomes water. | core |
| dd-gravewater-medium | Gravewater Medium | C | B | Creature, Medium | {B} | 2/1 | Arrives: grind self 1. | She listens to the graves because they are the only honest witnesses. | core |
| dd-mirehouse-mourner | Mirehouse Mourner | C | B | Creature, Human | {1}{B} | 2/2 | When this dies, opponent losesLife 1. | The mourning house has learned to collect its own inheritance. | core |
| dd-blacktide-leviathanling | Blacktide Leviathanling | C | B | Creature, Horror | {2}{B} | 3/2 | Dreaded. | Its first school was the underside of a fishing boat. | core |
| dd-saltmarsh-cutthroat | Saltmarsh Cutthroat | C | B | Creature, Human | {2}{B} | 2/3 | Deathblade. | The knife is small because the marsh does most of the work. | flex |
| dd-candle-snuffer | Candle Snuffer | C | B | Creature, Human | {3}{B} | 3/3 | Arrives: target creature gets -1/-1 until end of turn. | A dark room makes every threat look smaller. | core |
| dd-inkveil-widow | Inkveil Widow | C | B | Creature, Horror | {3}{B} | 3/2 | Whenever another creature dies, grind opponent 1. | Her web is a map of all the rooms people abandoned. | flex |
| dd-drowned-sexton | Drowned Sexton | C | B | Creature, Human | {4}{B} | 4/4 | Arrives: raise target creature from your graveyard to your hand. | He rings for the dead, then checks who answered. | flex |
| dd-abyssal-fisher | Abyssal Fisher | C | B | Creature, Human | {2}{B} | 3/3 | Whispers {2}. | The hook comes up with something that was never bait. | core |
| dd-coffin-boatman | Coffin Boatman | C | B | Creature, Human | {3}{B} | 2/4 | Blood Oath. | His passengers pay in warmth and arrive without it. | flex |
| dd-wakebell-haunter | Wakebell Haunter | C | B | Creature, Spirit | {1}{B} | 2/1 | Warcry. | It wakes for the bell and forgets why it was buried. | core |
| dd-blackreef-hag | Blackreef Hag | C | B | Creature, Human | {2}{B} | 2/2 | Arrives: opponent discards 1. | Her house has no windows because it has too many eyes. | flex |
| dd-tidegrave-collector | Tidegrave Collector | C | B | Creature, Horror | {3}{B} | 3/3 | Whenever another creature dies, put a mark on this. | It gathers the drowned into a shape that can walk. | stretch |
| dd-brass-lantern-runner | Brass Lantern Runner | C | R | Creature, Human | {R} | 2/1 | Warcry. | She runs the seawall faster than the tide can climb it. | core |
| dd-stormdock-brawler | Stormdock Brawler | C | R | Creature, Human | {1}{R} | 2/2 | When this attacks, it gets +1/+0 until end of turn. | The dockhands settle arguments before the storm can. | core |
| dd-redtide-raider | Redtide Raider | C | R | Creature, Human | {2}{R} | 3/2 | Warcry. | The tide painted her scarf and she chose to keep it. | core |
| dd-guttering-firebrand | Guttering Firebrand | C | R | Creature, Human | {2}{R} | 2/2 | Arrives: damage target creature 1. | Her matchbox has outlived three lighthouses. | core |
| dd-saltpowder-gunner | Saltpowder Gunner | C | R | Creature, Human | {3}{R} | 3/3 | Arrives: damage target creature 1. | The powder is damp, but the gunner is not. | flex |
| dd-wreckline-duelist | Wreckline Duelist | C | R | Creature, Human | {3}{R} | 3/2 | First Blade. | She learned footwork on decks that no longer exist. | flex |
| dd-coal-slick-sailor | Coal-Slick Sailor | C | R | Creature, Human | {2}{R} | 3/1 | Warcry. | He smells of smoke, brine, and a decision made too quickly. | core |
| dd-candlewick-urchin | Candlewick Urchin | C | R | Creature, Human | {1}{R} | 2/1 | When this dies, damage opponent 1. | The street children know which windows are still warm. | flex |
| dd-pierhead-cyclone | Pierhead Cyclone | C | R | Creature, Horror | {4}{R} | 4/3 | Overrun. | The storm has learned to move on legs. | core |
| dd-abyssal-sparkcaller | Abyssal Sparkcaller | C | R | Creature, Medium | {3}{R} | 3/2 | Arrives: damage opponent 1. | She calls the lightning by its childhood name. | flex |
| dd-ironbell-porter | Ironbell Porter | C | R | Creature, Human | {3}{R} | 4/3 | Sentinel. | The bell is too heavy to carry and too important to leave. | flex |
| dd-reefbreak-scour | Reefbreak Scour | C | R | Creature, Horror | {2}{R} | 2/2 | When this dies, damage target creature 1. | It breaks against the reef and takes a piece of the reef with it. | flex |
| dd-kelpwood-forager | Kelpwood Forager | C | G | Creature, Human | {1}{G} | 2/2 | Arrives: gainLife 1. | She gathers supper where the old forest meets the new sea. | core |
| dd-mosslight-tender | Mosslight Tender | C | G | Creature, Human | {1}{G} | 2/2 | Arrives: gainLife 1. | The moss glows brighter when she tells it not to. | core |
| dd-tidegrove-warden | Tidegrove Warden | C | G | Creature, Human | {2}{G} | 3/3 | Sentinel. | Roots grip the harbor stones and refuse to learn the tide's language. | core |
| dd-brinewood-stalker | Brinewood Stalker | C | G | Creature, Horror | {2}{G} | 3/2 | Warding Gaze. | It watches the sky for the shape that watches the town. | flex |
| dd-rootbound-medium | Rootbound Medium | C | G | Creature, Medium | {3}{G} | 3/4 | Arrives: Foresee 1. | Her roots know every buried bell by its vibration. | flex |
| dd-greenblack-heron | Greenblack Heron | C | G | Creature, Bird | {3}{G} | 3/3 | Skyborne, Warding Gaze. | It rises from the marsh with a star reflected in each eye. | flex |
| dd-reefroot-grafter | Reefroot Grafter | C | G | Creature, Human | {2}{G} | 2/3 | Arrives: put a mark on target creature. | The graft takes because the sea has already loosened everything. | core |
| dd-drifting-cedarfolk | Drifting Cedarfolk | C | G | Creature, Spirit | {4}{G} | 4/4 | Sentinel. | The drowned grove walks slowly toward the village. | flex |
| dd-seafoam-bearer | Seafoam Bearer | C | G | Creature, Horror | {4}{G} | 5/4 | Dread of the Deep. | A small sacrifice opens a very large mouth. | core |
| dd-tidemoss-herbalist | Tidemoss Herbalist | C | G | Creature, Human | {1}{G} | 1/3 | Arrives: gainLife 2. | Her remedies taste like rain and work like roots. | flex |
| dd-marshhorn-patrol | Marshhorn Patrol | C | G | Creature, Beast | {3}{G} | 4/3 | Warding Gaze. | The marsh gives warning before it gives shelter. | core |
| dd-harbor-vine-caller | Harbor Vine Caller | C | G | Creature, Medium | {2}{G} | 2/2 | Arrives: Foresee 1. | Vines climb the seawall toward whatever is shining above it. | flex |
| dd-chapel-candle | Chapel Candle | C | W | Charm | {W} | none | Boost target creature +1/+1 until end of turn. | Even a failing flame can make a room choose sides. | core |
| dd-moonwater-rite | Moonwater Rite | C | U | Ritual | {2}{U} | none | Foresee 3, then draw 1. | The water remembers the cup better than the hand. | core |
| dd-drowned-appeal | Drowned Appeal | C | B | Charm | {1}{B} | none | Damage target creature 2, then grind self 1. | The voice below the pier makes a reasonable request. | core |
| dd-storm-lantern | Storm Lantern | C | R | Charm | {1}{R} | none | Damage target creature 2. | The wick flares when the sea wants attention. | core |
| dd-tidepool-growth | Tidepool Growth | C | G | Charm | {1}{G} | none | Boost target creature +2/+2 until end of turn. | The smallest pool contains a season of weather. | core |
| dd-blackwater-judgment | Blackwater Judgment | C | B | Ritual | {3}{B} | none | Sever target creature with defense 3 or less. | The court sits beneath the waterline. | core |
| dd-whitewake-banishing | Whitewake Banishing | C | W | Ritual | {4}{W} | none | Sever target creature. | The wave is pale because it has seen too much night. | core |
| dd-reef-collapse | Reef Collapse | C | R | Ritual | {4}{R} | none | Damage all creatures 2. | The reef goes down with the houses built upon it. | core |
| dd-low-tide-reprieve | Low-Tide Reprieve | C | W | Charm | {2}{W} | none | GainLife 3, boost target creature +0/+2 until end of turn. | The sea gives back one breath and calls it mercy. | flex |
| dd-inkcurrent-reversal | Inkcurrent Reversal | C | U | Charm | {2}{U} | none | Recall target creature. | The current turns, carrying the mistake home. | core |
| dd-whispered-departure | Whispered Departure | C | U | Charm | {1}{U} | none | Whispers {1}: recall target creature with cost 2 or less. | A name breathed into the fog is a door left ajar. | core |
| dd-corpse-lantern | Corpse Lantern | C | B | Charm | {2}{B} | none | Whispers {1}: raise target creature from your graveyard to your hand. | The dead make excellent guides when the living have lost the road. | flex |
| dd-furnace-bell | Furnace Bell | C | R | Charm | {2}{R} | none | Damage target creature 3. | Strike the bell and the harbor answers with sparks. | core |
| dd-root-and-reef | Root and Reef | C | G | Ritual | {2}{G} | none | FetchLand, then Foresee 1. | The forest and the sea agree on where the road should end. | core |
| dd-tide-siren-call | Tide Siren Call | C | U | Ritual | {3}{U} | none | Tap two target creatures. | The note is beautiful until everyone stops moving. | flex |
| dd-wick-and-water | Wick and Water | C | W | Enchantment | {2}{W} | none | Whenever another creature arrives under your control, gainLife 1. | A candle is safest when the whole town tends it. | flex |
| dd-lull-of-the-abyss | Lull of the Abyss | C | U | Charm | {3}{U} | none | Tap target creature, then grind self 2. | The deep hums a lullaby with no promise of waking. | flex |
| dd-tidewake-offering | Tidewake Offering | C | B | Charm | {1}{B} | none | Whispers {1}: opponent discards 1. | The sea accepts a secret and asks for another. | core |
| dd-ember-on-wet-stone | Ember on Wet Stone | C | R | Enchantment | {1}{R} | none | Whenever a creature you control attacks, damage opponent 1. | The ember is small, but the stone is very dry underneath. | flex |
| dd-reefseed-cache | Reefseed Cache | C | G | Artifact | {2}{G} | none | Arrives: Foresee 1 and gainLife 1. | A seed from the deep grows toward the nearest candle. | flex |
| dd-pale-shore | Pale Shore | C | W | Land | none | none | EntersTapped; manaAbility W. | The sand is white where the moon has not finished looking. | core |
| dd-chapel-steps | Chapel Steps | C | W | Land | none | none | EntersTapped; manaAbility W. | Each step is worn smooth by people who came back alone. | flex |
| dd-lantern-quay | Lantern Quay | C | W | Land | none | none | EntersTapped; manaAbility W. | The lamps stop at the water and begin again beneath it. | flex |
| dd-whitewater-yard | Whitewater Yard | C | W | Land | none | none | EntersTapped; manaAbility W. | Nets dry here, though nothing caught in them ever does. | flex |
| dd-murmur-channel | Murmur Channel | C | U | Land | none | none | EntersTapped; manaAbility U. | The channel carries voices from a shore no map includes. | core |
| dd-reefglass-inlet | Reefglass Inlet | C | U | Land | none | none | EntersTapped; manaAbility U. | The water is clear enough to show what is not there. | flex |
| dd-fogbank-pier | Fogbank Pier | C | U | Land | none | none | EntersTapped; manaAbility U. | The pier ends in fog because the builders ran out of world. | flex |
| dd-stillwater-basin | Stillwater Basin | C | U | Land | none | none | EntersTapped; manaAbility U. | Nothing stirs here unless the moon is listening. | flex |
| dd-blacktide-marsh | Blacktide Marsh | C | B | Land | none | none | EntersTapped; manaAbility B. | The reeds lean toward graves that have not been dug. | core |
| dd-coffin-hollow | Coffin Hollow | C | B | Land | none | none | EntersTapped; manaAbility B. | Boats come back empty and tied with a stranger's knot. | flex |
| dd-mourning-channel | Mourning Channel | C | B | Land | none | none | EntersTapped; manaAbility B. | The current carries every lament toward one house. | flex |
| dd-inkwell-marsh | Inkwell Marsh | C | B | Land | none | none | EntersTapped; manaAbility B. | The mud stains skin like a thought that will not leave. | flex |
| dd-redwake-dock | Redwake Dock | C | R | Land | none | none | EntersTapped; manaAbility R. | The ropes hum whenever the storm gets hungry. | core |
| dd-cinder-pier | Cinder Pier | C | R | Land | none | none | EntersTapped; manaAbility R. | Coal glows below the boards and nobody asks why. | flex |
| dd-stormbell-yard | Stormbell Yard | C | R | Land | none | none | EntersTapped; manaAbility R. | The bell has cracked, but it still knows when to ring. | flex |
| dd-saltpowder-jetty | Saltpowder Jetty | C | R | Land | none | none | EntersTapped; manaAbility R. | Every barrel is labeled for a fire that has not happened. | flex |
| dd-kelpwood-shallows | Kelpwood Shallows | C | G | Land | none | none | EntersTapped; manaAbility G. | Green roots hold the mud where a street used to be. | core |
| dd-brinewood-grove | Brinewood Grove | C | G | Land | none | none | EntersTapped; manaAbility G. | The trees drink seawater and dream of deeper forests. | flex |
| dd-mosslight-common | Mosslight Common | C | G | Land | none | none | EntersTapped; manaAbility G. | The green glow makes the dark look almost domestic. | flex |
| dd-tidegrove-edge | Tidegrove Edge | C | G | Land | none | none | EntersTapped; manaAbility G. | The grove marks the last place the tide has not named. | flex |

### Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity/flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-bell-tower-medium | Bell-Tower Medium | R | W | Creature, Medium | {2}{W} | 2/3 | Arrives: Foresee 1 and gainLife 1. Whenever a creature you control with a mark dies, gainLife 2. | She climbs to hear the bells before they are cast. | core |
| dd-chalk-mourner | Chalk Mourner | R | W | Creature, Human | {3}{W} | 3/4 | Sentinel. Whenever another creature you control dies, put a mark on this. | The names on the seawall are written for the tide, not the family. | flex |
| dd-lighthouse-penitent | Lighthouse Penitent | R | W | Creature, Human | {4}{W} | 4/4 | Blood Oath. Arrives: gainLife 2. | She keeps the light because forgiveness needs a landmark. | flex |
| dd-tidecourt-judge | Tidecourt Judge | R | W | Creature, Human | {3}{W} | 2/4 | Arrives: preventCombat. | The court adjourns whenever the sea comes through the doors. | core |
| dd-reefwatch-patrol | Reefwatch Patrol | R | W | Creature, Human | {2}{W} | 2/3 | Warding Gaze; your other creatures with Warding Gaze get +0/+1. | They watch the sky in shifts and never discuss the missing shift. | flex |
| dd-marrow-lantern-bearer | Marrow Lantern Bearer | R | W | Creature, Spirit | {3}{W} | 3/3 | Arrives: raise target creature from your graveyard to your hand if it cost 2 or less. | The lantern burns with the last warmth of a borrowed body. | flex |
| dd-drownstar-cartographer | Drownstar Cartographer | R | U | Creature, Human | {2}{U} | 2/3 | Arrives: Foresee 2. Whenever you cast a Whispers card, draw 1 then discard 1. | Her maps are accurate until they meet the place she is standing. | stretch (AI-risk) |
| dd-saltglass-mimic | Saltglass Mimic | R | U | Creature, Horror | {3}{U} | 3/3 | When this arrives, copy the attack of another target creature until end of turn. | It borrows the shape of hunger from whoever is nearest. | stretch (AI-risk) |
| dd-victor-of-silent-bell | Victor of the Silent Bell | R | U | Creature, Human | {4}{U} | 4/4 | Skyborne. Arrives: Foresee 1. | He won a contest nobody remembers entering. | core |
| dd-inkveil-angler | Inkveil Angler | R | U | Creature, Horror | {2}{U} | 2/2 | Dreaded; Whispers {2}. | The lure glows like a window in a house that sank last winter. | core |
| dd-night-current-savant | Night-Current Savant | R | U | Creature, Human | {3}{U} | 3/4 | Arrives: draw 1 then discard 1. | She keeps the useful dreams and feeds the rest to the tide. | flex |
| dd-oceanic-medium | Oceanic Medium | R | U | Creature, Medium | {4}{U} | 3/5 | Untouchable. | The sea cannot take what it cannot quite perceive. | flex |
| dd-blacktide-matriarch | Blacktide Matriarch | R | B | Creature, Human | {3}{B} | 3/3 | Blood Oath. Arrives: opponent losesLife 2. | She wears mourning for a city that has not drowned yet. | core |
| dd-severed-tide-revenant | Severed-Tide Revenant | R | B | Creature, Horror | {4}{B} | 4/3 | Dread of the Deep; Dreaded. | It returns from the deep with less of itself and more of the deep. | core |
| dd-candlecrypt-stalker | Candlecrypt Stalker | R | B | Creature, Horror | {2}{B} | 3/2 | Deathblade; whenever this damages a creature, grind opponent 1. | It leaves a candle beside every body it makes. | flex |
| dd-drowned-constable | Drowned Constable | R | B | Creature, Human | {3}{B} | 3/3 | Arrives: opponent discards 1. | His badge is green with salt and still carries authority. | core |
| dd-inkbone-devourer | Inkbone Devourer | R | B | Creature, Horror | {4}{B} | 5/4 | Dread of the Deep. When this arrives, if you sacrificed a creature for it, opponent grinds 2. | It does not eat the dead. It eats the reason they died. | flex |
| dd-graveharbor-augur | Graveharbor Augur | R | B | Creature, Medium | {3}{B} | 2/4 | Arrives: grind self 2, then raise a card with Whispers from your graveyard to your hand. | The future is easier to hear when the present is buried. | stretch (AI-risk) |
| dd-red-lantern-corsair | Red Lantern Corsair | R | R | Creature, Human | {2}{R} | 3/2 | Warcry. Whenever this attacks alone, it gets +2/+0 until end of turn. | Her crew follows the lantern because the lantern follows the storm. | core |
| dd-stormglass-duelist | Stormglass Duelist | R | R | Creature, Human | {3}{R} | 3/3 | First Blade; when this attacks, damage opponent 1. | She fights in the reflection of lightning and calls it fair. | flex |
| dd-breakwater-berserker | Breakwater Berserker | R | R | Creature, Human | {4}{R} | 5/3 | Overrun. | It learned to charge from a wave that had no shore. | core |
| dd-cinderwake-ritualist | Cinderwake Ritualist | R | R | Creature, Medium | {3}{R} | 3/3 | Arrives: damage target creature 2. | Her rite begins with a match and ends with a new coastline. | core |
| dd-saltflash-raider | Saltflash Raider | R | R | Creature, Human | {2}{R} | 2/2 | Warcry; whenever this attacks, boost it +1/+0 until end of turn. | She has never mistaken speed for safety. | flex |
| dd-pierfire-captain | Pierfire Captain | R | R | Creature, Human | {4}{R} | 4/4 | Warcry; other attacking creatures get +1/+0. | The captain gives orders with one hand and holds the town together with the other. | core |
| dd-kelpwood-ancient | Kelpwood Ancient | R | G | Creature, Horror | {4}{G} | 5/5 | Dread of the Deep; Warding Gaze. | Its branches were old before the harbor learned its first word. | core |
| dd-tidegrove-seer | Tidegrove Seer | R | G | Creature, Medium | {3}{G} | 3/4 | Arrives: Foresee 2. | She reads the future in roots that grow against the tide. | flex |
| dd-brinebark-guardian | Brinebark Guardian | R | G | Creature, Beast | {4}{G} | 4/5 | Sentinel. When this blocks, put a mark on it. | The guardian wakes when the water reaches the old boundary stones. | core |
| dd-reefroot-hunter | Reefroot Hunter | R | G | Creature, Human | {3}{G} | 4/3 | Warding Gaze; arrives: damage target creature 1. | The hunt begins at low tide and ends when the stars blink. | flex |
| dd-marshlight-forager | Marshlight Forager | R | G | Creature, Human | {2}{G} | 2/3 | Arrives: FetchLand. | She finds roads by asking the reeds where they grew yesterday. | core |
| dd-greenwake-herald | Greenwake Herald | R | G | Creature, Medium | {3}{G} | 3/3 | Arrives: put a mark on target creature and gainLife 1. | The marsh sends a herald when it wants the village to move. | flex |
| dd-choir-of-pale-tide | Choir of the Pale Tide | R | W | Ritual | {2}{W} | none | Boost all your creatures +1/+1 until end of turn; gainLife 2. | A hundred voices make one brave thing out of a frightened town. | core |
| dd-judgment-at-low-water | Judgment at Low Water | R | W | Ritual | {3}{W} | none | Sever target attacking creature; gainLife 2. | The tide withdraws just long enough to reveal the verdict. | core |
| dd-mirrorwater-study | Mirrorwater Study | R | U | Charm | {2}{U} | none | Foresee 3, then draw 1. | The reflection knows which question the scholar meant to ask. | core |
| dd-voice-below-tide | Voice Below the Tide | R | U | Ritual | {3}{U} | none | Cancel target spell; grind self 1. | The answer rises before the question has finished sinking. | flex |
| dd-inkwell-levy | Inkwell Levy | R | B | Ritual | {2}{B} | none | Opponent discards 2; grind self 2. | The harbor charges a fee for every secret left afloat. | core |
| dd-wake-of-the-drowned | Wake of the Drowned | R | B | Charm | {3}{B} | none | Whispers {2}: sever target creature with defense 4 or less. | The wake passes through a room and leaves fewer shadows behind. | core |
| dd-red-salt-volley | Red Salt Volley | R | R | Ritual | {2}{R} | none | Damage all creatures 1; damage opponent 1. | The cannon fire sounds festive until the water turns bright. | core |
| dd-pierhead-explosion | Pierhead Explosion | R | R | Ritual | {3}{R} | none | Damage target creature 4; if it dies, damage opponent 1. | Someone stored powder below a bell tower and called it planning. | core |
| dd-root-tide-concord | Root-Tide Concord | R | G | Ritual | {2}{G} | none | FetchLand, then put a mark on target creature. | The forest and the tide share one slow heartbeat. | flex |
| dd-verdigris-reckoning | Verdigris Reckoning | R | G | Charm | {4}{G} | none | Boost target creature +3/+3 and give it Overrun until end of turn. | Green metal, green water, and one very old debt. | core |
| dd-widows-lantern | Widow's Lantern | R | C | Artifact | {2} | none | Arrives: Foresee 1. Whispers {1}. | The lantern is lit for someone who keeps changing names. | core |
| dd-abyssal-telescope | Abyssal Telescope | R | C | Artifact | {3} | none | At dawn: Foresee 2. | The lens points down even when the astronomer points up. | flex |
| dd-chapel-empty-chairs | Chapel of Empty Chairs | R | W | Enchantment | {3}{W} | none | Whenever another creature you control dies, gainLife 1 and Foresee 1. | The chairs are arranged for a congregation that arrives after midnight. | stretch (AI-risk) |
| dd-greenblack-tidepool | Greenblack Tidepool | R | G | Enchantment | {3}{G} | none | Whenever a creature arrives under your control, put a mark on it if it has none. | The pool teaches every living thing a new shape. | flex |
| dd-whispering-coffin | Whispering Coffin | R | B | Artifact | {3}{B} | none | Skim {2}; arrives: grind self 2. | The lid whispers only when there is room inside. | core |
| dd-stormbell-relay | Stormbell Relay | R | R | Artifact | {2}{R} | none | Arrives: damage opponent 1. Whenever a creature with Warcry attacks, boost it +1/+0. | The message travels from bell to bell until the sea hears it. | flex |
| dd-bellwether-net | Bellwether Net | R | U | Artifact | {2}{U} | none | Arrives: tap target creature; Whispers {1}. | The net catches bells, fish, and occasionally the sound between them. | flex |
| dd-saltglass-vial | Saltglass Vial | R | C | Artifact | {1} | none | Skim {1}; arrives: gainLife 1. | It contains one clear drop from a sea that has no color. | core |
| dd-burnished-tide-map | Burnished Tide Map | R | G | Artifact | {2}{G} | none | Arrives: FetchLand and Foresee 1. | The map is polished smooth wherever the coast has moved. | flex |
| dd-candlelit-census | Candlelit Census | R | W | Enchantment | {3}{W} | none | Your tokens get +1/+1. | Every name counted aloud is one fewer name for the deep. | core |
| dd-lighthouse-yard | Lighthouse Yard | R | W | Land | none | none | EntersTapped; manaAbility W; arrives: gainLife 1. | The yard is full of ropes for boats that will not return. | flex |
| dd-chartroom-isle | Chartroom Isle | R | U | Land | none | none | EntersTapped; manaAbility U; arrives: Foresee 1. | The island is small because the chart refuses to draw the rest. | flex |
| dd-blackreef-cemetery | Blackreef Cemetery | R | B | Land | none | none | EntersTapped; manaAbility B; arrives: grind self 1. | The graves are numbered by tide height. | core |
| dd-cinderwake-quay | Cinderwake Quay | R | R | Land | none | none | EntersTapped; manaAbility R; arrives: damage opponent 1. | The quay burns without consuming the wood. | flex |
| dd-rootwater-pasture | Rootwater Pasture | R | G | Land | none | none | EntersTapped; manaAbility G; arrives: gainLife 1. | The cattle graze where the sea used to be. | flex |
| dd-saltline-crossing | Saltline Crossing | R | W | Land | none | none | EntersTapped; manaAbility W; tap: boost target creature +0/+1 until end of turn. | The road is marked with salt because memory is not enough. | stretch (AI-risk) |
| dd-fogbound-observatory | Fogbound Observatory | R | U | Land | none | none | EntersTapped; manaAbility U; tap: Foresee 1. | Its roof opens to a sky that has been watching for years. | stretch (AI-risk) |
| dd-mourning-jetty | Mourning Jetty | R | B | Land | none | none | EntersTapped; manaAbility B; tap: opponent losesLife 1 if a creature died this turn. | The jetty collects grief as neatly as it collects rope. | flex |
| dd-stormfire-breaker | Stormfire Breaker | R | R | Land | none | none | EntersTapped; manaAbility R; tap: damage opponent 1. | The breakwater sparks when the stars are close. | flex |
| dd-kelpwood-reserve | Kelpwood Reserve | R | G | Land | none | none | EntersTapped; manaAbility G; tap: put a mark on target creature with a mark. | The reserve protects what the deep has not learned to name. | stretch (AI-risk) |

### Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity/flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-pale-medium-of-the-deep | Pale Medium of the Deep | SR | W | Creature, Medium | {3}{W} | 3/4 | Untouchable; arrives: Foresee 2 and gainLife 2. | She is pale because the deep keeps mistaking her for one of its own. | core |
| dd-choir-beneath-the-pier | Choir Beneath the Pier | SR | U | Creature, Horror | {2}{U} | 2/4 | Skyborne; whenever you cast a Whispers card, tap target creature. | The song travels through pilings and into the bones of the town. | flex |
| dd-blacktide-harbinger | Blacktide Harbinger | SR | B | Creature, Horror | {3}{B} | 4/3 | Dread of the Deep; when this arrives, opponent discards 1. | It announces the tide with a voice borrowed from the last survivor. | core |
| dd-brinewake-horror | Brinewake Horror | SR | B | Creature, Horror | {5}{B} | 5/5 | Dread of the Deep; Dreaded; whenever this attacks, opponent losesLife 1. | The water breaks and the shape behind it is already hungry. | core |
| dd-stormcrown-exorcist | Stormcrown Exorcist | SR | R | Creature, Human | {3}{R} | 4/3 | First Blade; arrives: damage target creature 3. | She burns the salt from a haunted room without opening its door. | core |
| dd-kelpwood-colossus | Kelpwood Colossus | SR | G | Creature, Horror | {5}{G} | 6/6 | Dread of the Deep; Overrun. | The drowned forest has finally stood up. | core |
| dd-abyssal-choir-conductor | Abyssal Choir Conductor | SR | U/B | Creature, Medium | {3}{U}{B} | 3/4 | Untouchable; whenever you cast a Whispers card, draw 1 then discard 1. | She conducts the voices until they harmonize around a single name. | flex |
| dd-candlecourt-lord | Candlecourt Lord | SR | W/B | Creature, Human | {3}{W}{B} | 4/4 | Blood Oath; whenever another creature dies, put a mark on this. | His court wears candles on their crowns and never blinks. | core |
| dd-reefscale-hydra | Reefscale Hydra | SR | G | Creature, Horror | {4}{G} | 4/4 | Dread of the Deep; when this arrives, put two marks on it if a creature was sacrificed for it. | Its many heads argue over which shore deserves to be remembered. | flex |
| dd-gutter-saint | Gutter Saint | SR | W | Creature, Medium | {2}{W} | 3/3 | Sentinel; when another creature you control dies, raise it to your hand. | She blesses the gutter because the gutter keeps receiving the dead. | flex |
| dd-the-tide-remembers | The Tide Remembers | SR | U | Ritual | {2}{U} | none | Whispers {3}: draw 2, then Foresee 2. | The tide returns every secret in a different handwriting. | core |
| dd-blackwater-communion | Blackwater Communion | SR | B | Ritual | {2}{B} | none | Whispers {3}: sever target creature with defense 5 or less, then grind self 2. | The communion cup is full of water and one very patient silence. | core |
| dd-lanterns-in-the-rain | Lanterns in the Rain | SR | W | Charm | {1}{W} | none | Whispers {1}: raise target creature from your graveyard to your hand and gainLife 3. | A hundred lamps make a road through the weather. | flex |
| dd-salt-and-spark | Salt and Spark | SR | R | Charm | {2}{R} | none | Whispers {1}: damage target creature 3 and damage opponent 1. | The storm takes payment in sparks. | core |
| dd-rooted-into-the-abyss | Rooted into the Abyss | SR | G | Ritual | {3}{G} | none | Create two Kelp Husk tokens; put a mark on each creature you control. | The roots descend because the soil has run out of directions. | core |
| dd-bell-tower-collapse | Bell-Tower Collapse | SR | R | Ritual | {4}{R} | none | Whispers {5}: damage all creatures 3. | The bells fall first, then the certainty that they were ever above you. | core |
| dd-the-uncharted-depth | The Uncharted Depth | SR | U | Enchantment | {3}{U} | none | At dawn: Foresee 2. Whenever you cast a Whispers card, Foresee 1. | The chart ends where the water begins to look back. | flex |
| dd-cemetery-flooded-bells | Cemetery of Flooded Bells | SR | C | Artifact | {3} | none | Whenever another creature dies, grind self 1; Whispers {2}. | Beneath the cemetery, every bell has found a second mouth. | stretch (AI-risk) |

### Double Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity/flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-pale-astronomer | Pale Astronomer | SSR | W/U | Creature, Medium | {3}{W}{U} | 4/4 | Skyborne; arrives: Foresee 3 and gainLife 2; Whispers {3}. | She charts the stars from a balcony the sea has not reached yet. | core |
| dd-keeper-greenblack-tide | Keeper of the Greenblack Tide | SSR | U/B | Creature, Horror | {4}{U}{B} | 5/5 | Dreaded; Dread of the Deep; whenever you cast a Whispers card, draw 1. | It keeps the tide in a glass jar and the town outside it. | core |
| dd-choirless-queen | Choirless Queen | SSR | B/R | Creature, Human | {4}{B}{R} | 5/4 | Blood Oath; Warcry; when this arrives, opponent discards 2. | She silenced the choir and found the silence had been waiting. | core |
| dd-reef-below-reckoning | Reef Below Reckoning | SSR | G/U | Creature, Horror | {5}{G}{U} | 6/6 | Dread of the Deep; Overrun; Arrives: Foresee 2. | The reef is not a place. It is the thing that remembers places. | core |
| dd-ship-that-breathes | Ship That Breathes | SSR | B | Creature, Horror | {5}{B} | 6/5 | Dread of the Deep; Dreaded; whenever this attacks, grind opponent 2. | The hull flexes like a ribcage when the captain says land. | core |
| dd-candle-in-the-abyss | Candle in the Abyss | SSR | W | Creature, Medium | {4}{W} | 3/6 | Sentinel; Untouchable; dawn: gainLife 3 and Foresee 1. | The candle burns below the world and still insists on being seen. | flex |
| dd-redwater-oracle | Redwater Oracle | SSR | U/R | Creature, Medium | {3}{U}{R} | 4/3 | Skyborne; whenever you cast a Whispers card, damage opponent 1 and Foresee 1. | Her visions arrive as weather and leave as ash. | flex |
| dd-rootmother-of-the-drowned | Rootmother of the Drowned | SSR | G | Creature, Horror | {5}{G} | 6/6 | Dread of the Deep; when this arrives, raise up to two creatures from your graveyard to your hand. | She grows a new shore around every name the sea takes. | core |
| dd-census-of-the-deep | Census of the Deep | SSR | U | Ritual | {4}{U} | none | Whispers {4}: draw 3, then discard 1 and Foresee 2. | The ledger counts the living by the spaces between their names. | core |
| dd-below-the-candleline | Below the Candleline | SSR | B | Ritual | {4}{B} | none | Sever all creatures with defense 2 or less; grind self 3. | The water reaches the candles and the room forgets its shape. | core |
| dd-tide-that-speaks | Tide That Speaks | SSR | R | Charm | {3}{R} | none | Whispers {2}: damage target creature 6; if it dies, damage opponent 2. | The tide has learned a word that no living throat can pronounce. | core |
| dd-lighthouse-without-flame | Lighthouse Without a Flame | SSR | W | Enchantment | {4}{W} | none | Your creatures get +1/+1. At dawn: gainLife 2. | The tower is dark, yet ships keep turning toward it. | flex |
| dd-dread-tithe | Dread Tithe | SSR | B | Enchantment | {3}{B} | none | Whenever a creature you control dies, opponent losesLife 1 and you gainLife 1. | The deep collects its tithe in heartbeats. | core |
| dd-map-last-horizon | Map of the Last Horizon | SSR | C | Artifact | {4} | none | Arrives: FetchLand and Foresee 2; Whispers {2}. | The last horizon is drawn in a color the eye cannot keep. | stretch (AI-risk) |

### Ultra Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity/flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-drowned-empress | Drowned Empress | UR | U/B | Creature, Horror | {5}{U}{B} | 6/6 | Skyborne; Dreaded; Dread of the Deep; when this arrives, sever target creature and draw 2. | She wears the drowned town as a crown and the stars as a veil. | core |
| dd-astral-leviathan | Astral Leviathan | UR | G/U | Creature, Horror | {6}{G}{U} | 8/8 | Dread of the Deep; Overrun; Untouchable. | Its back is a horizon and its shadow has a tide of its own. | core |
| dd-candlewick-prophet | Candlewick Prophet | UR | W/B | Creature, Medium | {4}{W}{B} | 4/5 | Blood Oath; Untouchable; whenever a creature you control dies, Foresee 2 and put a mark on this. | She sees every ending and lights the one that leaves a door open. | core |
| dd-storm-at-world-edge | Storm at the World's Edge | UR | U/R | Creature, Horror | {6}{U}{R} | 7/6 | Warcry; Dreaded; when this attacks, damage all other creatures 2. | The weather breaks against the edge of the world and comes back changed. | core |
| dd-last-medium | The Last Medium | UR | W/U | Creature, Medium | {4}{W}{U} | 4/6 | Sentinel; Skyborne; whenever you cast a Whispers card, draw 1 and gainLife 1. | She is the final witness because every other witness answered. | flex |
| dd-harbor-black-stars | Harbor of Black Stars | UR | C | Artifact | {5} | none | Arrives: create two Tideglass Wisp tokens and Foresee 3. At dawn: draw 1. | The harbor lights are stars reflected in water that has no sky. | flex |
| dd-tide-beyond-stars | Tide Beyond Stars | UR | B/G | Creature, Horror | {6}{B}{G} | 7/7 | Dread of the Deep; Overrun; whenever you sacrifice a creature for this, put two marks on it. | Past the stars, the sea waits with the patience of a continent. | core |
| dd-deep-calls-twice | The Deep Calls Twice | UR | B | Ritual | {6}{B} | none | Whispers {4}: sever all creatures, then each player discards 2. | The first call is an invitation. The second call is the part you remember. | core |

## Set-Unique Token Proposals

These six tokens are reserved for The Drowned Deep and give the overplan simple bodies to feed Dread of the Deep or reward a Whispers board without requiring a new resource.

| Token | Color | Type | Stats | Token rules sketch | Identity hook |
| --- | --- | --- | --- | --- | --- |
| Tideglass Wisp | U | Creature, Spirit | 1/1 | Skyborne. | A pale light drifts just above the water and refuses to reflect. |
| Wickbound Medium | W | Creature, Medium | 1/1 | When this dies, gainLife 1. | Someone left a candle burning for the medium and the candle kept the appointment. |
| Brineborn Horror | B | Creature, Horror | 3/3 | Dreaded. | It is small by deepwater standards and enormous by human ones. |
| Kelp Husk | G | Creature, Plant | 2/2 | When this dies, put a mark on target creature. | The drowned grove sends out a body made of roots and borrowed salt. |
| Lantern Eel | R | Creature, Fish | 2/1 | Warcry. | It swims through rain with a spark in its mouth. |
| Drowned Attendant | C | Creature, Spirit | 1/1 | When this arrives, grind self 1. | The attendant still carries a tray for a house below the harbor. |

## Precon Identity

**Lanterns Below** is a U/B midrange-control precon with a small W support package in the optional upgrade path. Its core plan is to deploy efficient 2/2 and 3/3 bodies, use Foresee and Skim to keep action flowing, and turn discarded Whispers cards into immediate pressure or answers. Drowned Horrors close the game through Dread of the Deep, while black and blue provide direct Sever effects, hand disruption, and creature control. The win route is deliberately board-first: trade resources, land one efficient Horror or Dreaded attacker, then use Whispers damage, discard, and direct pressure to finish. The list should not depend on a multi-turn graveyard loop, and its commons should still contest the field when the marquee cards never appear.

## Gauntlet Boss Concepts

- **The Bell Beneath the Harbor**, rung 17, U/B. A Whispers control boss that Skims early, uses Foresee to find cheap interaction, and deploys Dreaded Horrors after trading bodies. One line: “The bell rings once for the town, once for everything beneath it.”
- **The Star That Drowned**, rung 18, B/G. A sacrifice-forward Horror boss that fills the board with Kelp Husk and Brineborn Horror tokens, turns them into Dread of the Deep discounts, and wins with a marked Overrun leviathan. One line: “It fell from the sky and taught the sea to look upward.”

## Selection Notes

The ten candidates I would protect first are:

1. **Whispered Departure**: a clean common Whispers card that makes the new mechanic legible on day one.
2. **Abyssal Fisher**: a rate-efficient common body that carries Whispers without asking for a combo.
3. **Blackwater Judgment**: a common in-color board answer that keeps the set from becoming all atmosphere and no interaction.
4. **Reef Collapse**: a common sweeper candidate that gives the coastal colors a real reset button.
5. **Wake of the Drowned**: a rare Whispers answer with a clear greedy cast-or-discard choice.
6. **Brinewake Horror**: the cleanest Dread of the Deep payoff and the set's best high-end pressure test.
7. **The Tide Remembers**: a premium Whispers draw spell that demonstrates the Skim bridge without a dedicated payoff board.
8. **Pale Astronomer**: a marquee medium that makes the pale Victorian identity visible while rewarding the headline mechanic.
9. **Drowned Empress**: the UR flagship that gives the set a memorable top-end threat and a clear reason to play the Horror package.
10. **Candle in the Abyss**: the precon's identity is carried by the interaction between efficient bodies, discard, and immediate Whispers value.

The three biggest design risks are:

1. **Whispers cost compression**: if Whisper costs are too low, Skim turns into free extra spells and makes every discard outlet disproportionately strong. The engine pass needs a cast-versus-Whispers affordability audit and a deck-out guard review.
2. **Dread of the Deep board math**: sacrificing a cheap creature for a large Horror can erase the intended cost of expensive bodies or make disposable tokens mandatory. The mechanic needs a clear additional-cost rule and measured AI behavior before card data is committed.
3. **Elegant control becoming durdle**: Foresee, grind, discard, and dawn triggers can crowd out attackable bodies. The common band must preserve the stated power floor, and any multi-turn payoff that does not produce immediate board or card advantage should remain a stretch candidate.
