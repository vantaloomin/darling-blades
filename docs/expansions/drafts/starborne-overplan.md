<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-08-24 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# The Starborne: Overplanned Candidate Slate

## Propagate's real gap is COLOUR, not count (re-measured 2026-08-25)

**An earlier version of this section claimed this draft had "essentially no
generators" and named `sb-hullwake-feast` as the only card adding a fresh mark.
That was wrong**, and the error travelled into `plan-road-to-2.0.md` and the
session memory before anyone parsed the table. This section replaces it with
counts taken from the 200 rows below.

**The draft contains 17 mark generators, 8 of them commons.** One is
`sb-orbital-graft`, a common enchantment that marks every creature that arrives
under your control. The Protect First list further down already called
`sb-mycelial-star-gardener` a "common mark starter", so the document
contradicted itself.

The genuine problem is distribution:

| | W | U | B | R | G |
| --- | --- | --- | --- | --- | --- |
| Common generators | 1 | 0 | 0 | 2 | 5 |
| All generators | 3 | 1 | 0 | 3 | 9 |

**Black cannot turn Propagate on at any rarity; blue has exactly one, a
flex-tagged rare.** Green holds nine of seventeen. Propagate is therefore a
green mechanic with red and white support, and half the colour pie cannot
participate. That is a different problem from "add a seeding layer", and it is
the one concretion has to solve.

**Seven of the seventeen generators are tagged `flex`**, so a cut made on cut
tags alone thins the enabler layer without anyone noticing. Enabler density is a
cut constraint, not a preference.

### The colour pie, settled 2026-08-25

- **Green is primary.** It generates marks and keeps the majority of enablers.
- **Red and white support.** Efficient bodies that arrive marked, no new rules.
- **Blue COPIES AND MOVES marks.** It creates none. Blue relocates a mark to
  another permanent or duplicates one that already exists, which fits Foresee
  and recall without making blue a second green. Each such card is an AI
  decision, so they need seeded evidence before any of them ships as `core`.
- **Black is the ANTI-MARK colour.** It creates none and is not meant to.
  Black punishes, removes, or steals marks - `sb-black-starving-orbit` (Sever a
  marked creature) is already the seed of it. This gives Propagate a natural
  predator, keeps the colours distinct, and answers the snowball risk recorded
  below with a card type rather than a nerf.

**What still holds from the original blocker:** the LIVE pool is genuinely thin.
Measured across all 1,079 collectible cards, 13 use `addCounters` and 10 of them
mark only themselves. That matters for cross-set play and for Limited, where a
Starborne drafter may see few enablers, but it is not a statement about this
draft.

**The wording is pinned:** Propagate is **"put another mark on each marked
permanent you control"** (owner decision 2026-08-24). The narrower reading. With
marks scarce, letting Propagate hit opposing permanents does nothing useful and
adds a decision the AI has to get right.

## Set Identity

The Starborne is a sci-fi slate world of living starships and iridescent alien women under nebula light. Bioluminescent crews move through chrome corridors and violet cloudbanks, while swarms of small organisms multiply across hulls, gardens, and battlefields. The mood is wonder with an edge: every beautiful signal may be a lure, every shining body may be part of a larger appetite. The candidate pool leans into efficient bodies, bright board presence, and a broad range of WUBRG deck shells so the final set can keep its strange beauty without asking commons to be decorative filler.

**Propagate** is the set's new mechanic: **add a mark to every marked permanent you control**. A card may Propagate on arrival, at dawn, or as a spell effect. Propagate turns one established marked permanent into a visible signal for the rest of the board, then makes that signal compound. It expresses living hulls, shared alien biology, and swarms that multiply without creating a second resource system. In the engine it is a single deterministic pass over existing marks and permanents, so a greedy AI can value it as immediate board growth rather than a multi-turn puzzle. Cards marked **(AI-risk)** ask for a future board state, delayed sequencing, or a threshold decision and are deliberately cuttable.

The set also uses live house vocabulary such as Foresee, Sever, Skim, marks, Sentinel, Skyborne, Warding Gaze, First Blade, Blood Oath, Deathblade, Untouchable, Warcry, and Overrun. Broodspawn is an identity package built from the existing token system, not a second new mechanic. The table is intentionally overplanned at 200 candidates so a later data pass can choose a strong 120-card shipment without weakening the common floor.

## Rarity Target

`100 C / 60 R / 18 SR / 14 SSR / 8 UR = 200 candidates`.

**Shipment target, settled 2026-08-25: `75 C / 45 R / 14 SR / 10 SSR / 6 UR =
150 cards`.** The overplan was written against a 120-card shipment; the
Large/Small cadence in [plan-road-to-2.0.md](../../plan-road-to-2.0.md) puts a
Small set at ~150, and that wins. The mix is Duat's shipped distribution
(49.8% C / 30.2% R / 9.4% SR / 6.5% SSR / 4.1% UR) rather than a fresh
invention, and it is also the overplan's own ratios scaled by 0.75.

The extra thirty cards over the old target land mostly in commons, which is
where they are worth most: Draft is reserve-native now, so a 25-card Limited
deck leans hard on the common floor.

## Candidate Table

### Commons

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-lumen-warder | Lumen Warder | C | W | Creature, Alien Soldier | {1}{W} | 2/2 | Sentinel | She keeps the docking ring bright enough for a fleet to find home. | core |
| sb-chrome-seraph | Chrome Seraph | C | W | Creature, Lumenborn | {2}{W} | 3/3 | Skyborne | Her chrome wings open like a sunrise over black water. | flex |
| sb-orbit-guard | Orbit Guard | C | W | Creature, Soldier | {2}{W} | 2/4 | Warding Gaze | Nothing crosses the orbital garden without her permission. | core |
| sb-violet-medica | Violet Medica | C | W | Creature, Alien Medic | {2}{W} | 2/3 | arrives: gainLife 2 | Her hands glow violet where the wound used to be. | core |
| sb-dawn-hull-sentinel | Dawn-Hull Sentinel | C | W | Creature, Starship | {3}{W} | 3/4 | Sentinel; while you control an artifact, gets +1/+0 | The ship learned to stand watch before it learned to speak. | flex |
| sb-prism-deputy | Prism Deputy | C | W | Creature, Alien Soldier | {3}{W} | 3/3 | arrives: boost another target creature +1/+1 | Her badge is a shard of the first sunrise seen beyond the moon. | flex |
| sb-aurora-habitat | Aurora Habitat | C | W | Creature, Alien Civilian | {1}{W} | 2/2 | whenever this gets a mark, gainLife 1 | Even the apartment blocks grow small halos at night. | flex |
| sb-stellar-bondmate | Stellar Bondmate | C | W | Creature, Alien Companion | {2}{W} | 2/3 | your other marked creatures get +1/+0 | She calls the whole crew family, then proves it with voltage. | stretch |
| sb-cosmic-shieldmaiden | Cosmic Shieldmaiden | C | W | Creature, Vanguard | {3}{W} | 3/3 | First Blade | Her shield is a polished piece of a dead moon. | core |
| sb-solar-courier | Solar Courier | C | W | Creature, Courier | {2}{W} | 2/2 | arrives: Foresee 1 | She delivers the dawn before the sun has finished loading. | flex |
| sb-radiant-deckhand | Radiant Deckhand | C | W | Creature, Deckhand | {1}{W} | 2/1 | Warcry | She can cross a burning deck faster than a warning can travel. | core |
| sb-white-comet-aide | White-Comet Aide | C | W | Creature, Alien Aide | {3}{W} | 3/4 | arrives: add a mark to target creature | Her smile is gentle. Her medical adhesive is not. | flex |
| sb-star-reader | Star Reader | C | U | Creature, Alien Oracle | {1}{U} | 1/3 | arrives: Foresee 2 | She reads the stars as if they are gossiping in another room. | core |
| sb-chrome-tide-navigator | Chrome-Tide Navigator | C | U | Creature, Navigator | {2}{U} | 2/3 | Skim {1} | She charts the currents inside a living hull with one silver finger. | flex |
| sb-violet-orbit-mage | Violet Orbit Mage | C | U | Creature, Alien Mage | {3}{U} | 3/3 | arrives: Foresee 1 | She bends the nebula into a sleeve and keeps the weather out. | flex |
| sb-signal-lace-thief | Signal-Lace Thief | C | U | Creature, Rogue | {2}{U} | 2/2 | Skim {1}; Untouchable while marked | She steals encrypted heartbeats and wears them as jewelry. | stretch |
| sb-ion-bloom-scout | Ion-Bloom Scout | C | U | Creature, Scout | {1}{U} | 2/1 | arrives: Foresee 1 | The flowers on her helmet open whenever danger is near. | core |
| sb-astral-current-diver | Astral-Current Diver | C | U | Creature, Alien Diver | {3}{U} | 2/4 | Skyborne | She swims through gravity wells for fun and salvage. | flex |
| sb-moonrelay-courier | Moonrelay Courier | C | U | Creature, Courier | {2}{U} | 2/2 | arrives: draw 1, then grind self 1 | Her messages arrive with a little of her soul still attached. | flex |
| sb-blue-glass-envoy | Blue-Glass Envoy | C | U | Creature, Alien Diplomat | {3}{U} | 2/3 | Untouchable | The treaty is stored in her skin, where no hand can alter it. | stretch |
| sb-quasar-cartographer | Quasar Cartographer | C | U | Creature, Navigator | {3}{U} | 3/3 | arrives: Foresee 2 | She maps explosions by the shapes they leave in the dark. | core |
| sb-nebula-skimmer | Nebula Skimmer | C | U | Creature, Alien Navigator | {2}{U} | 2/2 | Skyborne; Skim {1} | Her ship is a ribbon of chrome with no room for regret. | flex |
| sb-drift-harbor-medic | Drift Harbor Medic | C | U | Creature, Medic | {2}{U} | 2/3 | arrives: gainLife 1 and Foresee 1 | She can diagnose a starship from the sound of its doors. | flex |
| sb-voidglass-observer | Voidglass Observer | C | U | Creature, Observer | {4}{U} | 3/4 | Warding Gaze; arrives: Foresee 1 | She watches the edge of the map so nobody else has to. | stretch |
| sb-void-blood-scavenger | Void-Blood Scavenger | C | B | Creature, Alien Scavenger | {1}{B} | 2/2 | Deathblade | She strips useful organs from wrecks before the wrecks cool. | core |
| sb-eclipse-broodhunter | Eclipse Broodhunter | C | B | Creature, Hunter | {2}{B} | 3/2 | arrives: grind self 2 | She follows the dark patches where young things learn to hunt. | core |
| sb-carrion-orbit-eater | Carrion-Orbit Eater | C | B | Creature, Alien Beast | {3}{B} | 3/3 | Blood Oath | Her appetite keeps the satellite graveyard in motion. | flex |
| sb-chrome-gravehand | Chrome Gravehand | C | B | Creature, Worker | {2}{B} | 2/3 | when this dies: opponent losesLife 1 | She repairs the dead because the living ask too many questions. | flex |
| sb-night-orbit-duelist | Night-Orbit Duelist | C | B | Creature, Duelist | {3}{B} | 3/2 | First Blade | Her first cut is ceremonial. The second is for the audience. | flex |
| sb-violet-maw | Violet Maw | C | B | Creature, Alien Beast | {4}{B} | 4/4 | Dreaded | The nebula made her beautiful right up until she opened her mouth. | flex |
| sb-darkmatter-harvester | Darkmatter Harvester | C | B | Creature, Harvester | {3}{B} | 3/3 | arrives: Sever the top card of an opponent's graveyard | She harvests what the stars forgot to finish consuming. | core |
| sb-severed-signal-raider | Severed-Signal Raider | C | B | Creature, Raider | {2}{B} | 2/2 | Skim {1}; arrives: opponent losesLife 1 | She cut her own distress call and has never been caught since. | flex |
| sb-comet-bone-collector | Comet-Bone Collector | C | B | Creature, Alien Scholar | {3}{B} | 2/4 | arrives: gainLife 2 | Every specimen gets a label, even the ones that scream. | flex |
| sb-black-halo-infiltrator | Black-Halo Infiltrator | C | B | Creature, Spy | {2}{B} | 2/2 | Untouchable | Her halo is a decoy signal for anyone searching her face. | flex |
| sb-stargrave-leech | Stargrave Leech | C | B | Creature, Parasite | {1}{B} | 1/2 | arrives: opponent losesLife 1 and you gainLife 1 | It glows only after it has fed. The crew pretends not to notice. | core |
| sb-corpse-light-navigator | Corpse-Light Navigator | C | B | Creature, Navigator | {4}{B} | 4/3 | arrives: grind self 2; Sever the top card of an opponent's graveyard | She steers by the cold lights left in extinct bodies. | stretch |
| sb-flarewing-raider | Flarewing Raider | C | R | Creature, Alien Raider | {1}{R} | 2/1 | Warcry | She arrives with a grin and leaves with the emergency beacon. | core |
| sb-chrome-meteorist | Chrome Meteorist | C | R | Creature, Mage | {2}{R} | 3/2 | arrives: damage target 1 | She throws stones at the sky until the sky throws back. | core |
| sb-ion-storm-brawler | Ion-Storm Brawler | C | R | Creature, Brawler | {2}{R} | 3/2 | gets +1/+0 while marked | Her pulse runs hot enough to make the ship's ribs sing. | flex |
| sb-violet-thruster-ace | Violet Thruster Ace | C | R | Creature, Thruster Ace | {3}{R} | 3/3 | Skyborne | She treats a meteor shower as a crowded flight lane. | flex |
| sb-solar-riot-engineer | Solar Riot Engineer | C | R | Creature, Engineer | {3}{R} | 3/3 | arrives: add a mark to target creature | She can turn a reactor leak into a weapon and a weapon into applause. | core |
| sb-redshift-corsair | Redshift Corsair | C | R | Creature, Corsair | {2}{R} | 2/2 | Warcry; Skim {1} | She steals fuel with one hand and waves with the other. | flex |
| sb-comet-kick-marauder | Comet-Kick Marauder | C | R | Creature, Marauder | {4}{R} | 4/3 | Overrun | Her boots leave impact craters in places the charts call floors. | core |
| sb-plasma-howl | Plasma Howl | C | R | Creature, Alien Beast | {3}{R} | 3/2 | arrives: damage opponent 2 | The howl is beautiful until the hull starts answering. | flex |
| sb-nebula-sparkhound | Nebula Sparkhound | C | R | Creature, Beast | {1}{R} | 2/1 | whenever this gets a mark, damage opponent 1 | It chases marks like other hounds chase thrown bones. | stretch |
| sb-starfire-lancer | Starfire Lancer | C | R | Creature, Soldier | {3}{R} | 3/2 | First Blade | Her lance is a solar flare taught to hold still. | flex |
| sb-orbit-breaker | Orbit Breaker | C | R | Creature, Brute | {4}{R} | 4/4 | arrives: damage target creature 2 | He considers every orbit a personal insult. | core |
| sb-burning-hull-runner | Burning Hull Runner | C | R | Creature, Alien Runner | {2}{R} | 2/2 | gets +1/+0 while you control a marked permanent | She runs along the outside of the ship because the inside is boring. | flex |
| sb-mycelial-star-gardener | Mycelial Star Gardener | C | G | Creature, Alien Druid | {1}{G} | 2/2 | arrives: add a mark to another target creature | She plants living constellations in the ship's hydroponics deck. | core |
| sb-cometroot-grafter | Cometroot Grafter | C | G | Creature, Engineer | {2}{G} | 3/3 | your marked creatures get +1/+0 | She grafts alien roots to chrome and calls the result a garden. | flex |
| sb-iridescent-sporekeeper | Iridescent Sporekeeper | C | G | Creature, Alien Druid | {3}{G} | 3/4 | arrives: createToken Broodling | Her spores drift like glitter until they start making decisions. | flex |
| sb-voidvine-tender | Voidvine Tender | C | G | Creature, Alien Gardener | {2}{G} | 2/3 | arrives: gainLife 2 | She waters vines with captured moonlight. | core |
| sb-living-hull-seedling | Living Hull Seedling | C | G | Creature, Starship | {3}{G} | 3/3 | Propagate | It is small enough to hug and old enough to remember a planet. | core |
| sb-aurora-beastcaller | Aurora Beastcaller | C | G | Creature, Caller | {4}{G} | 4/4 | arrives: add a mark to target creature | Her song wakes every sleeping engine in the valley. | flex |
| sb-star-orchard-keeper | Star Orchard Keeper | C | G | Creature, Alien Farmer | {3}{G} | 3/3 | arrives: fetchLand | She grows fruit that contains a complete weather system. | core |
| sb-nebula-reefback | Nebula Reefback | C | G | Creature, Alien Beast | {4}{G} | 5/4 | Warding Gaze | Her shell is a reef with room for one very tired crew. | flex |
| sb-jade-radiation-druid | Jade-Radiation Druid | C | G | Creature, Alien Druid | {2}{G} | 2/2 | arrives: gainLife 2 | She drinks the harmless part of the reactor glow. | flex |
| sb-solar-canopy-guardian | Solar Canopy Guardian | C | G | Creature, Guardian | {3}{G} | 3/4 | Warding Gaze | The canopy moves when she tells it to, and never before. | core |
| sb-ringworld-forager | Ringworld Forager | C | G | Creature, Forager | {1}{G} | 2/2 | Skim {1} | She can find dinner in an airlock and a future in the compost. | flex |
| sb-blooming-satellite | Blooming Satellite | C | G | Creature, Starship | {5}{G} | 5/5 | Propagate | Its antennae flower whenever another hull learns to live. | flex |
| sb-prism-deflection | Prism Deflection | C | W | Charm | {1}{W} | None | boost target creature +0/+3; preventCombat | A shield can be a wall, a mirror, or a very pointed suggestion. | core |
| sb-orbital-cleansing | Orbital Cleansing | C | W | Ritual | {4}{W} | None | Sever target creature | The cleanest orbit is the one with nothing left to collide. | core |
| sb-lattice-rescue | Lattice Rescue | C | W | Charm | {2}{W} | None | gainLife 3; boost target creature +0/+2 | The rescue beam arrives before the distress call finishes. | flex |
| sb-aurora-watch | Aurora Watch | C | W | Enchantment | {2}{W} | None | dawn: gainLife 1 | The station's windows glow whenever someone survives the night. | flex |
| sb-chrome-medallion | Chrome Medallion | C | C | Artifact | {2} | None | arrives: Foresee 1 | A crew badge, a key, and a small lie about rank. | core |
| sb-hull-patch | Hull Patch | C | W | Charm | {1}{W} | None | gainLife 3 | It seals the breach with a warm pulse and a colder invoice. | flex |
| sb-cometary-verdict | Cometary Verdict | C | W | Ritual | {3}{W} | None | Sever target tapped creature | The tribunal waits until the target has nowhere left to run. | core |
| sb-pale-nebula | Pale Nebula | C | W | Land | None | None | entersTapped; manaAbility W | The cloud looks soft until you try to navigate it. | core |
| sb-signal-inversion | Signal Inversion | C | U | Charm | {1}{U} | None | recall target creature; its owner Foresees 1 | A perfect reply is just a message sent back sharpened. | core |
| sb-quiet-orbit | Quiet Orbit | C | U | Ritual | {2}{U} | None | cancel target spell | Nothing is more alarming than an empty channel during a launch. | core |
| sb-prism-current | Prism Current | C | U | Charm | {1}{U} | None | Foresee 2; draw 1 | The current carries away bad options and leaves the useful ones bright. | flex |
| sb-relay-station | Relay Station | C | U | Enchantment | {3}{U} | None | dawn: Foresee 1 | It has not missed a signal in four hundred years. | flex |
| sb-sky-map | Sky Map | C | C | Artifact | {2} | None | Skim {1}; arrives: Foresee 1 | Fold it once and it becomes a route through the impossible. | core |
| sb-moonpool | Moonpool | C | U | Charm | {2}{U} | None | tap target; Foresee 1 | The water holds a ship still while the stars rearrange around it. | flex |
| sb-deepfield-lands | Deepfield Lands | C | U | Land | None | None | entersTapped; manaAbility U | The deep field is quiet because everything there is listening. | core |
| sb-marrow-eviction | Marrow Eviction | C | B | Charm | {1}{B} | None | target creature gets -2/-2 until end of turn | The beam does not break the armor. It persuades the armor to stop helping. | core |
| sb-grave-orbit | Grave Orbit | C | B | Ritual | {3}{B} | None | Sever the top 2 cards of an opponent's graveyard; opponent losesLife 1 | Even wreckage has a price in the outer rings. | flex |
| sb-night-market-bargain | Night-Market Bargain | C | B | Charm | {2}{B} | None | draw 1; loseLife 1 | The seller offers memories, replacement organs, and a discount for honesty. | flex |
| sb-umbral-antenna | Umbral Antenna | C | B | Artifact | {2} | None | arrives: grind self 1 | It receives transmissions from places that have no coordinates. | core |
| sb-starless-ward | Starless Ward | C | B | Enchantment | {3}{B} | None | your marked creatures get +1/+0 | The dark around the mark is not empty. It is loyal. | stretch |
| sb-corpse-lantern | Corpse Lantern | C | B | Charm | {1}{B} | None | damage target 2; gainLife 1 | It burns with the last useful thought in a dead thing. | core |
| sb-darkside-landing | Darkside Landing | C | B | Land | None | None | entersTapped; manaAbility B | The landing lights are violet because red would look too hopeful. | core |
| sb-flareburst | Flareburst | C | R | Ritual | {1}{R} | None | damage target 2 | The smallest star can still ruin a morning. | core |
| sb-solar-arc | Solar Arc | C | R | Charm | {2}{R} | None | damage target creature 1 and opponent 1 | The shot curves around the hull to make a point. | flex |
| sb-ignition-hymn | Ignition Hymn | C | R | Enchantment | {3}{R} | None | your marked creatures get +1/+0 until end of turn when they attack | The crew sings in perfect rhythm with the reactor alarms. | flex |
| sb-redline-salvage | Redline Salvage | C | R | Artifact | {2} | None | Skim {1}; arrives: add a mark to target creature | It was scrap until someone gave it a pulse. | core |
| sb-starfall-barrage | Starfall Barrage | C | R | Ritual | {4}{R} | None | damage target creature 4 | A small meteor is still a large argument. | core |
| sb-ember-lane | Ember Lane | C | R | Land | None | None | entersTapped; manaAbility R | The lane is hot, crowded, and officially one-way. | core |
| sb-warhead-glint | Warhead Glint | C | R | Charm | {1}{R} | None | boost target creature +2/+0; Warcry until end of turn | Her war paint is an emergency light with excellent cheekbones. | flex |
| sb-root-of-light | Root of Light | C | G | Charm | {1}{G} | None | add a mark to target creature; gainLife 1 | The roots drink starlight and return it as courage. | core |
| sb-gravitic-bloom | Gravitic Bloom | C | G | Ritual | {3}{G} | None | add a mark to up to two target creatures | The flowers open toward the heaviest thing in the room. | core |
| sb-orbital-graft | Orbital Graft | C | G | Enchantment | {2}{G} | None | whenever a creature arrives under your control, add a mark to it | The garden does not distinguish between crew and crop. | flex |
| sb-hullgarden-caretaker | Hullgarden Caretaker | C | G | Artifact | {3} | None | arrives: createToken Lumen Drone | The drone was built to prune vines and chose diplomacy instead. | flex |
| sb-overcanopy | Overcanopy | C | G | Land | None | None | entersTapped; manaAbility G | A green aurora hangs low enough to touch from the watch deck. | core |
| sb-far-star-harvest | Far-Star Harvest | C | G | Ritual | {4}{G} | None | fetchLand; gainLife 2 | The harvest comes from a sun nobody on the ship remembers naming. | flex |
| sb-luminous-compost | Luminous Compost | C | G | Charm | {1}{G} | None | grind self 2; gainLife 2 | Even the discarded parts keep glowing if you feed them properly. | flex |
| sb-starborne-relay | Starborne Relay | C | C | Artifact | {3} | None | arrives: draw 1 | It carries a message from every deck and forgets none of them. | core |
| sb-null-orbit-array | Null-Orbit Array | C | C | Artifact | {3} | None | Skim {2}; arrives: Foresee 1 | Its one job is to make the impossible route look routine. | flex |
| sb-interstellar-crossing | Interstellar Crossing | C | C | Land | None | None | entersTapped; manaAbility C | The crossing takes three days if you walk and one blink if you trust it. | core |
| sb-violet-wake-beacon | Violet Wake Beacon | C | C | Artifact | {4} | None | arrives: createToken Nebula Firefly | Its pulse is a welcome, a warning, and a dinner bell. | flex |

### Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-prism-chorister | Prism Chorister | R | W | Creature, Alien Singer | {2}{W} | 3/3 | Sentinel; arrives: add a mark to another target creature | Her voice turns a battle line into a constellation. | core |
| sb-ivory-orbit-vanguard | Ivory Orbit Vanguard | R | W | Creature, Vanguard | {3}{W} | 3/4 | First Blade | She holds the front until the stars behind her have moved. | core |
| sb-lumen-cathedral-keeper | Lumen Cathedral Keeper | R | W | Creature, Keeper | {4}{W} | 4/5 | arrives: gainLife 2 and Foresee 1 | The cathedral is a starship, and she is its patient heart. | flex |
| sb-chrome-choir-envoy | Chrome Choir Envoy | R | W | Creature, Alien Diplomat | {2}{W} | 2/3 | Skyborne; your other marked creatures get +1/+0 | She sings harmony into engines that were designed for war. | core |
| sb-docking-ring-warden | Docking-Ring Warden | R | W | Creature, Alien Soldier | {3}{W} | 3/3 | Warding Gaze; marked creatures you control have Sentinel | She learned to guard the landing before she learned to land. | flex |
| sb-solar-pact-medic | Solar Pact Medic | R | W | Creature, Medic | {2}{W} | 2/2 | Blood Oath; arrives: gainLife 2 | She signs every operation with a drop of her own light. | flex |
| sb-aurora-line-captain | Aurora-Line Captain | R | W | Creature, Commander | {4}{W} | 4/4 | Sentinel; arrives: boost all your creatures +1/+0 until end of turn | Her command is a sunrise that nobody argues with. | core |
| sb-starlight-arbiter | Starlight Arbiter | R | W | Creature, Judge | {5}{W} | 4/5 | Untouchable; arrives: Foresee 1 | She knows the difference between justice and a clean firing lane. | stretch |
| sb-velvet-void-cartographer | Velvet Void Cartographer | R | U | Creature, Navigator | {2}{U} | 2/3 | arrives: Foresee 2; Skim {1} | Her maps are soft, precise, and illegal in four systems. | core |
| sb-mirror-nebula-savant | Mirror-Nebula Savant | R | U | Creature, Alien Scholar | {3}{U} | 2/4 | Untouchable; while marked, Foresee 1 at dawn | She has seen every future and still dresses for this one. | stretch |
| sb-orbit-lace-infiltrator | Orbit-Lace Infiltrator | R | U | Creature, Rogue | {2}{U} | 2/2 | Skyborne; Skim {1} | She enters through the airlock as a reflection and leaves with the keys. | flex |
| sb-astral-biomancer | Astral Biomancer | R | U | Creature, Alien Mage | {4}{U} | 3/4 | arrives: add a mark to target creature; Foresee 1 | She grows new organs for ships that have outlived their owners. | flex |
| sb-tideglass-archivist | Tideglass Archivist | R | U | Creature, Archivist | {3}{U} | 2/4 | arrives: draw 1, then grind self 1 | Every archive has a tide. She waits for the useful things to wash in. | core |
| sb-signal-crown-thief | Signal-Crown Thief | R | U | Creature, Thief | {4}{U} | 3/3 | Skyborne; whenever this gets a mark, draw 1 | She steals command signals and lets the ship decide who deserves them. | stretch |
| sb-blue-comet-adept | Blue-Comet Adept | R | U | Creature, Alien Adept | {1}{U} | 2/1 | whenever you cast a Charm, Foresee 1 | She learns spells by watching their light leave the hand. | flex |
| sb-night-sky-observer | Night-Sky Observer | R | U | Creature, Observer | {5}{U} | 4/4 | Skyborne; dawn: Foresee 1 | She keeps the night shift company with a telescope and a secret. | flex |
| sb-void-choir-reclaimer | Void Choir Reclaimer | R | B | Creature, Alien Singer | {3}{B} | 3/3 | Deathblade; when this dies: grind self 2 | Her last note is always the first note of something worse. | core |
| sb-eclipse-garden-devourer | Eclipse Garden Devourer | R | B | Creature, Alien Beast | {4}{B} | 4/4 | Blood Oath | It blooms under a dead sun and feeds on anything that applauds. | core |
| sb-black-radiance-stalker | Black-Radiance Stalker | R | B | Creature, Hunter | {2}{B} | 2/2 | Untouchable; gets +1/+0 while marked | She paints her face with the color of a powered-down screen. | flex |
| sb-severance-priestess | Severance Priestess | R | B | Creature, Priestess | {3}{B} | 2/3 | arrives: Sever the top 2 cards of an opponent's graveyard | She blesses the dead by making sure nobody can use them twice. | core |
| sb-starved-signal-eater | Starved-Signal Eater | R | B | Creature, Alien Horror | {2}{B} | 3/2 | gets +1/+1 while an opponent has 3 or more cards in their graveyard | It mistakes communication for food and rarely regrets the error. | flex |
| sb-carrion-comet-drone | Carrion-Comet Drone | R | B | Creature, Drone | {4}{B} | 3/4 | Skyborne; opponent losesLife 1 when this arrives | It follows distress calls with excellent punctuality. | flex |
| sb-void-halo-assassin | Void-Halo Assassin | R | B | Creature, Assassin | {3}{B} | 3/2 | Deathblade; Skim {1} | Her halo is a warning label written in ultraviolet. | core |
| sb-graveyard-astronomer | Graveyard Astronomer | R | B | Creature, Alien Scholar | {4}{B} | 3/4 | dawn: grind self 2; opponent losesLife 1 | She studies extinct systems because living ones ask for references. | stretch |
| sb-flare-orbit-captain | Flare-Orbit Captain | R | R | Creature, Commander | {3}{R}{R} | 4/3 | Warcry | She takes the helm when the ship is on fire and complains when it is not. | core |
| sb-plasma-veil-duelist | Plasma-Veil Duelist | R | R | Creature, Duelist | {2}{R} | 3/2 | First Blade; gets +1/+0 while marked | Her veil is a heat shield, a challenge, and a fashion choice. | flex |
| sb-chrome-sunbreaker | Chrome Sunbreaker | R | R | Creature, Brute | {4}{R} | 4/4 | Overrun | She breaks suns for the same reason others break locks. | core |
| sb-redshift-ambusher | Redshift Ambusher | R | R | Creature, Raider | {2}{R} | 2/2 | Dreaded; whenever this gets a mark, damage opponent 1 | She waits in the red glow just beyond the sensor's honest range. | flex |
| sb-violet-thrust-engineer | Violet-Thrust Engineer | R | R | Creature, Engineer | {3}{R} | 3/3 | arrives: add a mark to another target creature | Her engines run on bad ideas and very good timing. | core |
| sb-comet-tail-hunter | Comet-Tail Hunter | R | R | Creature, Hunter | {4}{R} | 4/3 | Warcry; arrives: damage opponent 1 | She tracks comets by the dents they leave in smugglers. | flex |
| sb-solar-flare-bruiser | Solar-Flare Bruiser | R | R | Creature, Brawler | {3}{R} | 3/2 | arrives: damage target creature 1 | She calls every repair bill a souvenir. | core |
| sb-starboard-hellion | Starboard Hellion | R | R | Creature, Alien Beast | {5}{R} | 5/4 | Overrun | It only knows two directions and both of them are toward the enemy. | flex |
| sb-rootlight-navigator | Rootlight Navigator | R | G | Creature, Navigator | {2}{G} | 3/3 | arrives: fetchLand | She steers by the living roots woven through the hull. | core |
| sb-emerald-bloom-mother | Emerald Bloom Mother | R | G | Creature, Alien Matriarch | {4}{G} | 4/4 | Propagate | Her children are seeds, ships, and sometimes a very large problem. | core |
| sb-voidreef-grafter | Voidreef Grafter | R | G | Creature, Engineer | {3}{G} | 3/4 | Warding Gaze; your marked creatures get +0/+1 | She grafts a reef to a reactor and calls the result stable. | flex |
| sb-orchard-of-stars-keeper | Orchard-of-Stars Keeper | R | G | Creature, Alien Farmer | {3}{G} | 2/4 | arrives: add a mark to target creature and gainLife 2 | Her orchard bears fruit only after a good argument with gravity. | core |
| sb-aurora-horn-beast | Aurora-Horn Beast | R | G | Creature, Alien Beast | {5}{G} | 5/5 | Overrun | Its horns catch the aurora and drag it down to the battlefield. | flex |
| sb-radiant-moss-mender | Radiant Moss Mender | R | G | Creature, Alien Druid | {2}{G} | 2/2 | arrives: add a mark to another target creature | She fixes broken chrome with moss that remembers its shape. | core |
| sb-satellite-vine-caretaker | Satellite-Vine Caretaker | R | G | Creature, Gardener | {4}{G} | 3/4 | arrives: createToken Lumen Drone | Her vines grow around drones until both species stop complaining. | flex |
| sb-ringworld-stampede | Ringworld Stampede | R | G | Creature, Alien Beast | {6}{G} | 6/6 | Overrun | The ringworld shakes, then the crew checks whether it was supposed to. | flex |
| sb-chrome-aurora-commandant | Chrome-Aurora Commandant | R | W/U | Legendary Creature, Alien Commander | {3}{W}{U} | 4/4 | Skyborne; your marked creatures get +1/+1 | She commands in two colors of light and never repeats an order. | core |
| sb-violet-eclipse-duchess | Violet-Eclipse Duchess | R | W/B | Legendary Creature, Alien Noble | {3}{W}{B} | 3/4 | Untouchable; arrives: gainLife 2 | Her court is a starship and every guest is under observation. | flex |
| sb-cinder-nebula-raider | Cinder-Nebula Raider | R | B/R | Legendary Creature, Corsair | {3}{B}{R} | 4/3 | Warcry; whenever this gets a mark, damage opponent 2 | She paints her hull with the names of planets she has robbed. | core |
| sb-orbitroot-matriarch | Orbitroot Matriarch | R | R/G | Legendary Creature, Alien Matriarch | {3}{R}{G} | 4/4 | Propagate; Overrun | Her roots cross three decks and all of them are armed. | core |
| sb-solar-tide-prime | Solar-Tide Prime | R | G/U | Legendary Creature, Alien Navigator | {3}{G}{U} | 3/5 | arrives: Foresee 2; Skim {2} | She can read a tide in a star and a star in a wounded hull. | flex |
| sb-lumen-void-apostle | Lumen-Void Apostle | R | U/B | Legendary Creature, Alien Priestess | {4}{U}{B} | 4/4 | Deathblade; arrives: Sever the top card of an opponent's graveyard | She preaches that every signal ends, then makes sure of it. | stretch |
| sb-white-signal-bastion | White-Signal Bastion | R | W | Enchantment | {3}{W} | None | your marked creatures get +0/+2 | The bastion is grown from a single pearl of hull tissue. | core |
| sb-blue-echo-array | Blue-Echo Array | R | C | Artifact | {2} | None | Skim {1}; arrives: Foresee 2 | It remembers every route the ship almost took. | core |
| sb-black-starving-orbit | Black-Starving Orbit | R | B | Ritual | {3}{B} | None | Sever target creature with a mark | It circles the target until the target forgets why it was afraid. | core |
| sb-red-solar-lash | Red-Solar Lash | R | R | Charm | {2}{R} | None | damage target creature 3 | The lash leaves a red line across the darkness and nothing else. | core |
| sb-green-propagation-chorus | Green Propagation Chorus | R | G | Ritual | {4}{G} | None | Propagate; gainLife 2 | The chorus begins with one throat and ends with the whole garden. | core |
| sb-chromelight-lattice | Chromelight Lattice | R | C | Artifact | {3} | None | arrives: add a mark to target creature; marked creatures you control get +0/+1 | It is a fence, a nursery, and a very patient weapon. | flex |
| sb-violet-pulse | Violet Pulse | R | U | Charm | {2}{U} | None | recall target creature; Foresee 1 | The pulse is polite enough to return a target with its luggage. | flex |
| sb-hullwake-feast | Hullwake Feast | R | G | Enchantment | {4}{G} | None | dawn: gainLife 2; if you control a marked permanent, add a mark to target creature | The feast is served after the hull heals and before it asks for seconds. | stretch |
| sb-pale-violet-crossing | Pale-Violet Crossing | R | W/U | Land | None | None | entersTapped; manaAbility W/U | The crossing shines brightest where two currents disagree. | core |
| sb-eclipse-docking-ring | Eclipse Docking Ring | R | W/B | Land | None | None | entersTapped; manaAbility W/B | The ring accepts every ship and trusts none of them. | core |
| sb-ember-void-rail | Ember-Void Rail | R | B/R | Land | None | None | entersTapped; manaAbility B/R | The rail is hot enough to cauterize a bad decision. | core |
| sb-radiant-comet-lane | Radiant-Comet Lane | R | R/G | Land | None | None | entersTapped; manaAbility R/G | Comets mark the safe turns for anyone brave enough to follow. | core |
| sb-aurora-reefway | Aurora Reefway | R | G/U | Land | None | None | entersTapped; manaAbility G/U | The reef glows whenever a living ship passes above it. | core |
| sb-chrome-nebula-port | Chrome-Nebula Port | R | C | Land | None | None | entersTapped; manaAbility C; Foresee 1 when it arrives | The port is neutral because nobody has survived trying to own it. | flex |

### Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-prismatic-fleet-marshal | Prismatic Fleet Marshal | SR | W | Creature, Alien Commander | {4}{W} | 4/4 | Sentinel; arrives: boost all your creatures +1/+0 until end of turn | Her fleet forms a flower around the enemy before it closes. | core |
| sb-lunar-chrome-oracle | Lunar Chrome Oracle | SR | U | Creature, Alien Oracle | {3}{U} | 3/4 | Untouchable; dawn: Foresee 2 | She keeps a second moon in her throat for emergencies. | flex |
| sb-eclipse-blood-artist | Eclipse Blood Artist | SR | B | Creature, Alien Artist | {3}{B} | 3/3 | Blood Oath; whenever this gets a mark, opponent losesLife 2 | She paints with light stolen from the moment a star dies. | core |
| sb-ember-orbit-exarch | Ember-Orbit Exarch | SR | R | Creature, Alien Priestess | {4}{R} | 4/3 | Warcry; arrives: damage target creature 2 | Her sermons begin with a spark and end with a crater. | core |
| sb-rootlight-broodmother | Rootlight Broodmother | SR | G | Creature, Alien Matriarch | {4}{G} | 4/5 | Propagate; arrives: createToken Broodling | She births a swarm from the roots of a starship. | core |
| sb-moonlit-hull-repairer | Moonlit Hull Repairer | SR | W | Creature, Engineer | {3}{W} | 3/5 | Sentinel; arrives: add a mark to target creature and gainLife 3 | She repairs the ship with one hand and the crew with the other. | flex |
| sb-voidcurrent-conjurer | Voidcurrent Conjurer | SR | U | Creature, Alien Mage | {4}{U} | 3/3 | Skyborne; arrives: Foresee 3 | She braids a current through empty space and calls it a road. | flex |
| sb-grave-star-matron | Grave-Star Matron | SR | B | Creature, Alien Matriarch | {4}{B} | 4/4 | Deathblade; dawn: grind self 2 and opponent losesLife 1 | Her nursery is a graveyard with excellent ventilation. | stretch |
| sb-solar-thruster-herald | Solar-Thruster Herald | SR | R | Creature, Alien Herald | {3}{R} | 3/3 | Skyborne, Warcry; whenever this gets a mark, damage opponent 2 | Her arrival is always announced by the sound of something breaking. | flex |
| sb-ringworld-bloomkeeper | Ringworld Bloomkeeper | SR | G | Creature, Alien Druid | {4}{G} | 3/4 | Warding Gaze; whenever another creature gets a mark, gainLife 1 | She tends a garden that encircles a world and still wants more room. | flex |
| sb-chrome-veil-admiral | Chrome-Veil Admiral | SR | W/U | Legendary Creature, Alien Commander | {4}{W}{U} | 4/4 | Skyborne; your marked creatures get +1/+1 | Her veil is a tactical display that looks like a storm of glass. | core |
| sb-violet-eclipse-weaver | Violet-Eclipse Weaver | SR | B/R | Legendary Creature, Alien Weaver | {4}{B}{R} | 4/4 | Deathblade; arrives: opponent losesLife 2 and you gainLife 2 | She weaves the last light from a dying sun into a weapon. | flex |
| sb-propagation-engine | Propagation Engine | SR | C | Enchantment | {4} | None | dawn: Propagate | The machine has no guide because the whole ship is its nervous system. | core |
| sb-deep-space-severance | Deep-Space Severance | SR | B | Ritual | {5}{B} | None | Sever target creature; Sever the top card of an opponent's graveyard | It cuts through armor, memory, and the comfort of distance. | core |
| sb-nebula-shear | Nebula Shear | SR | U | Charm | {3}{U} | None | recall target creature; Foresee 2 | The shear leaves the battlefield neat and the enemy deeply elsewhere. | flex |
| sb-hullwake-overdrive | Hullwake Overdrive | SR | R | Charm | {2}{R} | None | boost target creature +3/+0; Warcry until end of turn | The ship gives one crew member permission to become the weather. | core |
| sb-cosmic-nursery | Cosmic Nursery | SR | C | Artifact | {4} | None | arrives: createToken Lumen Drone x2 | The nursery hums with tiny engines and enormous plans. | flex |
| sb-radiant-orbit | Radiant Orbit | SR | W | Land | None | None | entersTapped; manaAbility W; arrives: gainLife 1 | A safe orbit is still a place where something can fall. | stretch |

### Super Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-queen-of-the-living-hull | Queen of the Living Hull | SSR | W | Legendary Creature, Alien Queen | {5}{W} | 5/5 | Sentinel; Propagate; your other marked creatures get +1/+1 | She wears the ship's living crown and listens through every wall. | core |
| sb-astral-reef-singer | Astral Reef Singer | SSR | U | Legendary Creature, Alien Singer | {5}{U} | 4/5 | Skyborne; dawn: Foresee 2 and draw 1 | Her song makes reefs bloom in the vacuum between systems. | core |
| sb-eclipse-star-vampire | Eclipse Star Vampire | SSR | B | Legendary Creature, Alien Vampire | {5}{B} | 5/4 | Blood Oath, Deathblade; when this gets a mark, Sever the top card of an opponent's graveyard | She drinks radiance from suns that have not yet learned to be afraid. | flex |
| sb-hellion-of-the-redshift | Hellion of the Redshift | SSR | R | Legendary Creature, Alien Beast | {5}{R} | 5/4 | Warcry, Overrun; arrives: damage target creature 3 | It is a living engine with a temper and no reverse gear. | core |
| sb-worldroot-shipmind | Worldroot Shipmind | SSR | G | Legendary Creature, Starship | {5}{G} | 5/6 | Propagate; arrives: createToken Broodling x2 | The ship grew a mind so large that the crew became its weather. | core |
| sb-chrome-violet-archon | Chrome-Violet Archon | SSR | W/U | Legendary Creature, Alien Archon | {5}{W}{U} | 5/5 | Skyborne; marked creatures you control have Sentinel | She was born in a flash of chrome and immediately issued a safety protocol. | core |
| sb-voidflare-empress | Voidflare Empress | SSR | B/R | Legendary Creature, Alien Empress | {5}{B}{R} | 5/4 | Dreaded, Warcry; whenever a creature you control gets a mark, opponent losesLife 1 | Her court follows wherever the signal becomes dangerous. | flex |
| sb-signal-cathedral | Signal Cathedral | SSR | C | Legendary Artifact | {5} | None | dawn: Foresee 2; if you control 5 or more marked permanents, draw 1 (AI-risk) | The cathedral is a receiver built for a god that may be the ship. | stretch |
| sb-propagation-choir | Propagation Choir | SSR | G | Enchantment | {4}{G} | None | whenever you add a mark to a permanent, gainLife 1 and createToken Broodling (AI-risk) | The first singer starts the chorus. The hull supplies the harmony. | flex |
| sb-starborne-apotheosis | Starborne Apotheosis | SSR | W | Ritual | {6}{W} | None | Propagate; gainLife 5; boost all your marked creatures +1/+1 | The crew does not ascend. The whole ship rises with them. | core |
| sb-black-sun-severance | Black-Sun Severance | SSR | B | Ritual | {6}{B} | None | massDestroy all creatures; each player grinds 2 | When the black sun opens, every beautiful thing becomes evidence. | flex |
| sb-redline-supernova | Redline Supernova | SSR | R | Ritual | {6}{R} | None | damage all creatures 3 and damage each opponent 3 | The detonation is visible from three systems and remembered in four. | core |
| sb-ghostlight-transmitter | Ghostlight Transmitter | SSR | C | Artifact | {4} | None | Skim {2}; arrives: Foresee 3; dawn: gainLife 2 | It transmits from the future, which is why every reply sounds tired. | flex |
| sb-chromaviolet-haven | Chromaviolet Haven | SSR | W/U | Land | None | None | entersTapped; manaAbility W/U; arrives: Foresee 1 | The haven blooms where two colored storms touch the hull. | stretch |

### Ultra Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-constellation-matriarch | Constellation Matriarch | UR | W | Legendary Creature, Alien Matriarch | {5}{W} | 5/6 | Skyborne, Sentinel; your other marked creatures get +1/+1 | She wears a living constellation as a crown and calls it family. | core |
| sb-galaxy-heart-navigator | Galaxy-Heart Navigator | UR | U | Legendary Creature, Navigator | {5}{U} | 5/5 | Skyborne; arrives: Foresee 3; dawn: draw 1 | She pilots by the heartbeat of a galaxy too large to name. | flex |
| sb-abyssal-iris-regent | Abyssal Iris Regent | UR | B | Legendary Creature, Alien Regent | {5}{B} | 6/5 | Deathblade, Blood Oath; when this dies: Sever the top 3 cards of an opponent's graveyard | Her irises are windows into a night that wants to come closer. | core |
| sb-solar-flare-sovereign | Solar-Flare Sovereign | UR | R | Legendary Creature, Alien Sovereign | {5}{R} | 6/5 | Warcry, Overrun; arrives: damage target creature 3 | She does not enter combat. Combat enters her orbit. | core |
| sb-worldgarden-leviathan | Worldgarden Leviathan | UR | G | Legendary Creature, Alien Beast | {6}{G} | 7/7 | Overrun, Propagate; arrives: createToken Chrome Husk | It carries a garden on its back and a moon in its shadow. | core |
| sb-prism-void-comet | Prism-Void Comet | UR | W/U | Legendary Creature, Alien Comet | {6}{W}{U} | 6/6 | Skyborne, Untouchable; whenever you Propagate, draw 1 | It is a living starship, a woman, and a promise moving too fast to catch. | core |
| sb-eclipse-red-queen | Eclipse-Red Queen | UR | B/R | Legendary Creature, Alien Queen | {6}{B}{R} | 7/5 | Dreaded, Warcry; whenever a marked creature you control attacks, damage opponent 1 (AI-risk) | Her red court arrives after the eclipse and leaves before the mourning. | flex |
| sb-halo-motherboard | Halo Motherboard | UR | C | Legendary Artifact | {6} | None | arrives: Propagate; your marked creatures get +1/+1; dawn: Foresee 1 (AI-risk) | It is the first machine the fleet built that can dream in plural. | stretch |

## Set-Unique Token Proposals

| Token | Color | Type and stats | Token identity |
| --- | --- | --- | --- |
| Lumen Drone | C | Artifact Creature, Drone, 1/1, Skyborne | A bioluminescent maintenance mote that learns attack formations. |
| Broodling | G | Creature, Brood, 1/1 | A translucent young swarm member that grows around warm machinery. |
| Chrome Husk | C | Artifact Creature, Husk, 2/2, Bulwark | A discarded shell that keeps standing after its owner leaves. |
| Nebula Firefly | U | Creature, Insect, 1/1, Skyborne | A tiny violet beacon that follows living ships between worlds. |
| Violet Hullguard | W | Creature, Guardian, 1/3, Sentinel | A pearlescent defense organism shaped like a patient woman at attention. |
| Void Mote | B | Creature, Mote, 1/1 | A black spark that dims one light whenever it dies. |

## Precon Identity

**Chrome-Violet Broodship** is a G/U/R midrange swarm precon. It plays efficient two- and three-cost bodies, establishes one or two marked permanents, then uses Propagate, Broodling bodies, and Lumen Drones to turn a modest board into a wide attack. Green supplies marks and durable bodies, blue filters with Foresee and protects tempo with recall, and red supplies direct damage plus Warcry and Overrun finishers. The deck must retain a real answer package at common, including Sever effects, damage, cancel, recall, and combat prevention, so its win route is pressure backed by interaction rather than a slow value loop.

## Gauntlet Boss Concepts

- **Chrome Broodmother** (rung 19) - G/R swarm-midrange that opens with efficient bodies, marks one attacker, and chains Propagate into a sudden Overrun board.
- **The Violet Signal Queen** (rung 20) - U/B control that filters with Foresee, severs graveyards, and wins after Untouchable threats make every clean answer awkward.

## Selection Notes

### Protect First

1. **sb-living-hull-seedling, Living Hull Seedling** - common Propagate body that makes the mechanic visible early.
2. **sb-prism-deflection, Prism Deflection** - common combat answer that protects the power floor and gives white a real role.
3. **sb-orbit-breaker, Orbit Breaker** - common red body with immediate creature damage and honest stats.
4. **sb-mycelial-star-gardener, Mycelial Star Gardener** - common mark starter that makes green's plan playable without setup cards.
5. **sb-green-propagation-chorus, Green Propagation Chorus** - rare spell that turns Propagate into a clean build-around instead of a hidden bonus.
6. **sb-chrome-aurora-commandant, Chrome-Aurora Commandant** - rare multicolor payoff that rewards marked permanents without requiring a combo.
7. **sb-rootlight-broodmother, Rootlight Broodmother** - SR marquee that joins efficient board growth to the token swarm.
8. **sb-queen-of-the-living-hull, Queen of the Living Hull** - SSR identity card for the living-starship fantasy and the W midrange branch.
9. **sb-worldroot-shipmind, Worldroot Shipmind** - SSR green legend that makes a full board feel like one organism.
10. **sb-prism-void-comet, Prism-Void Comet** - UR spectacle that clearly states the set's promise: a beautiful, untouchable, multiplying starship woman.

### Three Biggest Design Risks

1. **Mark density can snowball too hard.** Propagate is deliberately simple, but repeated marks plus static bonuses may create non-games. The final set needs a controlled number of repeatable Propagate sources and enough clean answers to marked threats.
2. **The common answer suite can drift into colorless sameness.** The power-floor correction needs real interaction, but every color should still answer problems in its own way. Blue should recall and cancel, black should shrink and Sever, red should damage, and white should prevent combat or Sever under a condition.
3. **Threshold cards are hostile to the current AI.** Signal Cathedral, Propagation Choir, Halo Motherboard, and Eclipse-Red Queen are attractive for human sequencing but can underperform when the AI cannot plan several turns ahead. They are flagged as stretch or flex and should not survive the final pass without seeded win-rate evidence.
