<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-08-28 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

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

**Propagate** is the set's new mechanic: **add a mark to every marked permanent you control**. **Timing, ruled 2026-08-28: Propagate is a one-time event.** A spell Propagates when it resolves; a permanent Propagates on arrival (`arrives: Propagate`), and every permanent row below writes that trigger explicitly. **The single sanctioned exception is `sb-propagation-engine` (`dawn: Propagate`)** - the design-risk section budgets "a controlled number of repeatable Propagate sources" and this named card is that number: one. No other repeating timing exists in this set. A future set may add an activated form (a tap-cost Propagate) once activated abilities with tap costs ship as the 1.8 engine feature; that is explicitly not a 1.7 shape. Propagate turns one established marked permanent into a visible signal for the rest of the board, then makes that signal compound. It expresses living hulls, shared alien biology, and swarms that multiply without creating a second resource system. In the engine it is a single deterministic pass over existing marks and permanents, so a greedy AI can value it as immediate board growth rather than a multi-turn puzzle. Cards marked **(AI-risk)** ask for a future board state, delayed sequencing, or a threshold decision and are deliberately cuttable.

The set also uses live house vocabulary such as Foresee, Sever, Skim, marks, Sentinel, Skyborne, Warding Gaze, First Blade, Blood Oath, Deathblade, Untouchable, Warcry, and Overrun. Broodspawn is an identity package built from the existing token system, not a second new mechanic. The table is intentionally overplanned at 200 candidates so a later data pass can choose a strong 120-card shipment without weakening the common floor.

## Rarity Target

`100 C / 60 R / 18 SR / 14 SSR / 8 UR = 200 candidates`.

**SHIPPED SET, cut applied 2026-08-25: `75 C / 45 R / 14 SR / 10 SSR / 7 UR =
151 cards`.** The tables below are now the shipping set; the seventy-two cards
removed are listed with their reasons in the Cut list at the end of this file.

The target was 150 on Duat's shipped rarity mix (49.8% C / 30.2% R / 9.4% SR /
6.5% SSR / 4.1% UR). It landed at 151 because `Eclipse-Red Queen` was spared:
at 150 the UR share was 4.0%, the low end of everything shipped, and at 151 it
is **4.6%, exactly the shipped median**. The extra card costs nothing and buys
back the only B/R card at top rarity.

**Six of the seven URs now touch Propagate.** That was the deciding argument for
cutting `Galaxy-Heart Navigator` rather than keeping both: it was the one UR
with no mark interaction at all, and a UR's whole licence is to be a marquee
card for what the set is about.

### Measurement obligation carried by the cut

Three of the four cards the design-risk section calls hostile to the current AI
survived by owner decision: **Halo Motherboard**, **Signal Cathedral**, and
**Propagation Choir**. That section's own instruction was that they should not
survive a final pass without seeded win-rate evidence.

They are the set's most evocative cards and the call was made knowingly, but it
creates a real obligation: **these three need a seeded tuning pass before the
set ships.** If the AI cannot sequence toward a five-mark threshold, they read
as dead cards to anyone playing against it. Budget for that specifically rather
than discovering it in the metagame sweep.

## Candidate Table

### Commons

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-lumen-warder | Lumen Warder | C | W | Creature, Alien Soldier | {1}{W} | 2/2 | Sentinel | She keeps the docking ring bright enough for a fleet to find home. | core |
| sb-orbit-guard | Orbit Guard | C | W | Creature, Soldier | {2}{W} | 2/4 | Warding Gaze | Nothing crosses the orbital garden without her permission. | core |
| sb-violet-medica | Violet Medica | C | W | Creature, Alien Medic | {2}{W} | 2/3 | arrives: gainLife 2 | Her hands glow violet where the wound used to be. | core |
| sb-aurora-habitat | Aurora Habitat | C | W | Creature, Alien Civilian | {1}{W} | 2/2 | whenever this gets a mark, gainLife 1 | Even the apartment blocks grow small halos at night. | flex |
| sb-cosmic-shieldmaiden | Cosmic Shieldmaiden | C | W | Creature, Vanguard | {3}{W} | 3/3 | First Blade | Her shield is a polished piece of a dead moon. | core |
| sb-radiant-deckhand | Radiant Deckhand | C | W | Creature, Deckhand | {1}{W} | 2/1 | Warcry | She can cross a burning deck faster than a warning can travel. | core |
| sb-white-comet-aide | White-Comet Aide | C | W | Creature, Alien Aide | {3}{W} | 3/4 | arrives: add a mark to target creature | Her smile is gentle. Her medical adhesive is not. | flex |
| sb-star-reader | Star Reader | C | U | Creature, Alien Oracle | {1}{U} | 1/3 | arrives: Foresee 2 | She reads the stars as if they are gossiping in another room. | core |
| sb-ion-bloom-scout | Ion-Bloom Scout | C | U | Creature, Scout | {1}{U} | 2/1 | arrives: Foresee 1 | The flowers on her helmet open whenever danger is near. | core |
| sb-quasar-cartographer | Quasar Cartographer | C | U | Creature, Navigator | {3}{U} | 3/3 | arrives: Foresee 2 | She maps explosions by the shapes they leave in the dark. | core |
| sb-void-blood-scavenger | Void-Blood Scavenger | C | B | Creature, Alien Scavenger | {2}{B} | 2/2 | Deathblade | She strips useful organs from wrecks before the wrecks cool. | core |
| sb-eclipse-broodhunter | Eclipse Broodhunter | C | B | Creature, Hunter | {2}{B} | 3/2 | arrives: grind self 2 | She follows the dark patches where young things learn to hunt. | core |
| sb-night-orbit-duelist | Night-Orbit Duelist | C | B | Creature, Duelist | {2}{B} | 3/2 | First Blade | Her first cut is ceremonial. The second is for the audience. | flex |
| sb-violet-maw | Violet Maw | C | B | Creature, Alien Beast | {4}{B} | 4/4 | Dreaded | The nebula made her beautiful right up until she opened her mouth. | flex |
| sb-darkmatter-harvester | Darkmatter Harvester | C | B | Creature, Harvester | {3}{B} | 3/3 | arrives: Sever the top card of an opponent's graveyard | She harvests what the stars forgot to finish consuming. | core |
| sb-stargrave-leech | Stargrave Leech | C | B | Creature, Parasite | {1}{B} | 1/2 | arrives: opponent losesLife 1 and you gainLife 1 | It glows only after it has fed. The crew pretends not to notice. | core |
| sb-flarewing-raider | Flarewing Raider | C | R | Creature, Alien Raider | {1}{R} | 2/1 | Warcry | She arrives with a grin and leaves with the emergency beacon. | core |
| sb-chrome-meteorist | Chrome Meteorist | C | R | Creature, Mage | {2}{R} | 3/2 | arrives: damage target 1 | She throws stones at the sky until the sky throws back. | core |
| sb-ion-storm-brawler | Ion-Storm Brawler | C | R | Creature, Brawler | {2}{R} | 3/2 | gets +1/+0 while marked | Her pulse runs hot enough to make the ship's ribs sing. | flex |
| sb-violet-thruster-ace | Violet Thruster Ace | C | R | Creature, Thruster Ace | {3}{R} | 3/3 | Skyborne | She treats a meteor shower as a crowded flight lane. | flex |
| sb-solar-riot-engineer | Solar Riot Engineer | C | R | Creature, Engineer | {3}{R} | 3/3 | arrives: add a mark to target creature | She can turn a reactor leak into a weapon and a weapon into applause. | core |
| sb-redshift-corsair | Redshift Corsair | C | R | Creature, Corsair | {2}{R} | 2/2 | Warcry; Skim {1} | She steals fuel with one hand and waves with the other. | flex |
| sb-comet-kick-marauder | Comet-Kick Marauder | C | R | Creature, Marauder | {3}{R} | 4/3 | Overrun | Her boots leave impact craters in places the charts call floors. | core |
| sb-starfire-lancer | Starfire Lancer | C | R | Creature, Soldier | {2}{R} | 3/2 | First Blade | Her lance is a solar flare taught to hold still. | flex |
| sb-orbit-breaker | Orbit Breaker | C | R | Creature, Brute | {4}{R} | 4/4 | arrives: damage target creature 2 | She considers every orbit a personal insult. | core |
| sb-burning-hull-runner | Burning Hull Runner | C | R | Creature, Alien Runner | {2}{R} | 2/2 | gets +1/+0 while you control a marked permanent | She runs along the outside of the ship because the inside is boring. | flex |
| sb-mycelial-star-gardener | Mycelial Star Gardener | C | G | Creature, Alien Druid | {1}{G} | 2/2 | arrives: add a mark to another target creature | She plants living constellations in the ship's hydroponics deck. | core |
| sb-cometroot-grafter | Cometroot Grafter | C | G | Creature, Engineer | {3}{G} | 3/3 | your marked creatures get +1/+0 | She grafts alien roots to chrome and calls the result a garden. | flex |
| sb-voidvine-tender | Voidvine Tender | C | G | Creature, Alien Gardener | {2}{G} | 2/3 | arrives: gainLife 2 | She waters vines with captured moonlight. | core |
| sb-living-hull-seedling | Living Hull Seedling | C | G | Creature, Starship | {3}{G} | 3/3 | arrives: Propagate | It is small enough to hug and old enough to remember a planet. | core |
| sb-aurora-beastcaller | Aurora Beastcaller | C | G | Creature, Caller | {4}{G} | 4/4 | arrives: add a mark to target creature | Her song wakes every sleeping engine in the valley. | flex |
| sb-star-orchard-keeper | Star Orchard Keeper | C | G | Creature, Alien Farmer | {4}{G} | 3/3 | arrives: fetchLand | She grows fruit that contains a complete weather system. | core |
| sb-solar-canopy-guardian | Solar Canopy Guardian | C | G | Creature, Guardian | {3}{G} | 3/4 | Warding Gaze | The canopy moves when she tells it to, and never before. | core |
| sb-blooming-satellite | Blooming Satellite | C | G | Creature, Starship | {5}{G} | 5/5 | arrives: Propagate | Its antennae flower whenever another hull learns to live. | flex |
| sb-prism-deflection | Prism Deflection | C | W | Charm | {1}{W} | None | boost target creature +0/+3; preventCombat | A shield can be a wall, a mirror, or a very pointed suggestion. | core |
| sb-orbital-cleansing | Orbital Cleansing | C | W/B | Ritual | {1}{W}{B} | None | Sever target creature | The cleanest orbit is the one with nothing left to collide. | core |
| sb-chrome-medallion | Chrome Medallion | C | C | Artifact | {2} | None | arrives: Foresee 1 | A crew badge, a key, and a small lie about rank. | core |
| sb-cometary-verdict | Cometary Verdict | C | W | Ritual | {3}{W} | None | Sever target tapped creature | The tribunal waits until the target has nowhere left to run. | core |
| sb-pale-nebula | Pale Nebula | C | W | Land | None | None | entersTapped; manaAbility W | The cloud looks soft until you try to navigate it. | core |
| sb-signal-inversion | Signal Inversion | C | U | Charm | {1}{U} | None | recall target creature; its owner Foresees 1 | A perfect reply is just a message sent back sharpened. | core |
| sb-prism-current | Prism Current | C | U | Charm | {1}{U} | None | Foresee 2; draw 1 | The current carries away bad options and leaves the useful ones bright. | flex |
| sb-relay-station | Relay Station | C | U | Enchantment | {3}{U} | None | dawn: Foresee 1 | It has not missed a signal in four hundred years. | flex |
| sb-sky-map | Sky Map | C | C | Ritual | {1} | None | Skim {1}; Foresee 1 | Fold it once and it becomes a route through the impossible. | core |
| sb-deepfield-lands | Deepfield Lands | C | U | Land | None | None | entersTapped; manaAbility U | The deep field is quiet because everything there is listening. | core |
| sb-night-market-bargain | Night-Market Bargain | C | B | Charm | {2}{B} | None | draw 1; loseLife 1 | The seller offers memories, replacement organs, and a discount for honesty. | flex |
| sb-umbral-antenna | Umbral Antenna | C | B | Artifact | {4} | None | arrives: grind self 1; dawn: Foresee 1, then grind self 1; dawn: if you control four or more creatures with marks, Sever this, then return the top creature card of your graveyard to the battlefield with two marks on it | It receives transmissions from places that have no coordinates. | core |
| sb-corpse-lantern | Corpse Lantern | C | B | Charm | {1}{B} | None | damage target 2; gainLife 1 | It burns with the last useful thought in a dead thing. | core |
| sb-darkside-landing | Darkside Landing | C | B | Land | None | None | entersTapped; manaAbility B | The landing lights are violet because red would look too hopeful. | core |
| sb-flareburst | Flareburst | C | R | Ritual | {1}{R} | None | damage target 2 | The smallest star can still ruin a morning. | core |
| sb-solar-arc | Solar Arc | C | R | Charm | {1}{R} | None | damage target creature 1 and opponent 1 | The shot curves around the hull to make a point. | flex |
| sb-ignition-hymn | Ignition Hymn | C | R | Enchantment | {3}{R} | None | your marked creatures get +1/+0 until end of turn when they attack | The crew sings in perfect rhythm with the reactor alarms. | flex |
| sb-redline-salvage | Redline Salvage | C | R | Artifact | {2} | None | Skim {1}; arrives: add a mark to target creature | It was scrap until someone gave it a pulse. | core |
| sb-starfall-barrage | Starfall Barrage | C | R | Ritual | {1}{R} | None | damage target creature 4 | A small meteor is still a large argument. | core |
| sb-ember-lane | Ember Lane | C | R | Land | None | None | entersTapped; manaAbility R | The lane is hot, crowded, and officially one-way. | core |
| sb-warhead-glint | Warhead Glint | C | R | Charm | {1}{R} | None | boost target creature +3/+1; Warcry until end of turn | Her war paint is an emergency light with excellent cheekbones. | flex |
| sb-root-of-light | Root of Light | C | G | Charm | {1}{G} | None | add a mark to target creature; gainLife 1 | The roots drink starlight and return it as courage. | core |
| sb-gravitic-bloom | Gravitic Bloom | C | G | Ritual | {3}{G} | None | add a mark to up to two target creatures | The flowers open toward the heaviest thing in the room. | core |
| sb-orbital-graft | Orbital Graft | C | G | Enchantment | {2}{G} | None | whenever a creature arrives under your control, add a mark to it | The garden does not distinguish between crew and crop. | flex |
| sb-overcanopy | Overcanopy | C | G | Land | None | None | entersTapped; manaAbility G | A green aurora hangs low enough to touch from the watch deck. | core |
| sb-starborne-relay | Starborne Relay | SR | C | Artifact | {6} | None | arrives: draw 1; dawn: Foresee 1; dawn: if you control four or more creatures with marks, draw 1 | It carries a message from every deck and forgets none of them. | core |
| sb-null-orbit-array | Null-Orbit Array | C | C | Artifact | {1} | None | Skim {2}; arrives: Foresee 1 | Its one job is to make the impossible route look routine. | flex |
| sb-interstellar-crossing | Interstellar Crossing | C | C | Land | None | None | entersTapped; manaAbility C | The crossing takes three days if you walk and one blink if you trust it. | core |
| sb-violet-wake-beacon | Violet Wake Beacon | SSR | C | Artifact | {7} | None | arrives: createToken Nebula Firefly; dawn: if you control a marked permanent, createToken Nebula Firefly | Its pulse is a welcome, a warning, and a dinner bell. | flex |

### Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-prism-chorister | Prism Chorister | R | W | Creature, Alien Singer | {2}{W} | 3/3 | Sentinel; arrives: add a mark to another target creature | Her voice turns a battle line into a constellation. | core |
| sb-ivory-orbit-vanguard | Ivory Orbit Vanguard | R | W | Creature, Vanguard | {3}{W} | 3/4 | First Blade | She holds the front until the stars behind her have moved. | core |
| sb-chrome-choir-envoy | Chrome Choir Envoy | R | W | Creature, Alien Diplomat | {2}{W} | 2/3 | Skyborne; your other marked creatures get +1/+0 | She sings harmony into engines that were designed for war. | core |
| sb-aurora-line-captain | Aurora-Line Captain | R | W | Creature, Commander | {4}{W} | 4/4 | Sentinel; arrives: boost all your creatures +1/+0 until end of turn | Her command is a sunrise that nobody argues with. | core |
| sb-velvet-void-cartographer | Velvet Void Cartographer | R | U | Creature, Navigator | {2}{U} | 2/3 | arrives: Foresee 2; Skim {1} | Her maps are soft, precise, and illegal in four systems. | core |
| sb-astral-biomancer | Astral Biomancer | R | U | Creature, Alien Mage | {4}{U} | 3/4 | arrives: if a permanent you control is marked, put a mark on another target permanent you control; Foresee 1 | She grows new organs for ships that have outlived their owners. | flex |
| sb-tideglass-archivist | Tideglass Archivist | R | U | Creature, Archivist | {3}{U} | 2/4 | arrives: draw 1, then grind self 1 | Every archive has a tide. She waits for the useful things to wash in. | core |
| sb-void-choir-reclaimer | Void Choir Reclaimer | R | B | Creature, Alien Singer | {3}{B} | 3/3 | Deathblade; when this dies: grind self 2 | Her last note is always the first note of something worse. | core |
| sb-eclipse-garden-devourer | Eclipse Garden Devourer | R | B | Creature, Alien Beast | {3}{B} | 4/4 | Blood Oath | It blooms under a dead sun and feeds on anything that applauds. | core |
| sb-severance-priestess | Severance Priestess | R | B | Creature, Priestess | {2}{B} | 2/3 | arrives: Sever the top 2 cards of an opponent's graveyard | She blesses the dead by making sure nobody can use them twice. | core |
| sb-void-halo-assassin | Void-Halo Assassin | R | B | Creature, Assassin | {3}{B} | 3/2 | Deathblade; Skim {1} | Her halo is a warning label written in ultraviolet. | core |
| sb-flare-orbit-captain | Flare-Orbit Captain | R | R | Creature, Commander | {2}{R}{R} | 4/3 | Warcry | She takes the helm when the ship is on fire and complains when it is not. | core |
| sb-chrome-sunbreaker | Chrome Sunbreaker | R | R | Creature, Brute | {3}{R} | 4/4 | Overrun | She breaks suns for the same reason others break locks. | core |
| sb-violet-thrust-engineer | Violet-Thrust Engineer | R | R | Creature, Engineer | {3}{R} | 3/3 | arrives: add a mark to another target creature | Her engines run on bad ideas and very good timing. | core |
| sb-solar-flare-bruiser | Solar-Flare Bruiser | R | R | Creature, Brawler | {3}{R} | 3/2 | arrives: damage target creature 1 | She calls every repair bill a souvenir. | core |
| sb-rootlight-navigator | Rootlight Navigator | R | G | Creature, Navigator | {3}{G} | 3/3 | arrives: fetchLand | She steers by the living roots woven through the hull. | core |
| sb-emerald-bloom-mother | Emerald Bloom Mother | R | G | Creature, Alien Matriarch | {4}{G} | 4/4 | arrives: Propagate | Her children are seeds, ships, and sometimes a very large problem. | core |
| sb-orchard-of-stars-keeper | Orchard-of-Stars Keeper | R | G | Creature, Alien Farmer | {3}{G} | 2/4 | arrives: add a mark to target creature and gainLife 2 | Her orchard bears fruit only after a good argument with gravity. | core |
| sb-radiant-moss-mender | Radiant Moss Mender | R | G | Creature, Alien Druid | {2}{G} | 2/2 | arrives: add a mark to another target creature | She fixes broken chrome with moss that remembers its shape. | core |
| sb-chrome-aurora-commandant | Chrome-Aurora Commandant | R | W/U | Legendary Creature, Alien Commander | {2}{W}{W}{U} | 3/4 | Skyborne; your marked creatures get +1/+1 | She commands in two colors of light and never repeats an order. | core |
| sb-cinder-nebula-raider | Cinder-Nebula Raider | R | B/R | Legendary Creature, Corsair | {3}{B}{R} | 4/3 | Warcry; whenever this gets a mark, damage opponent 2 | She paints her hull with the names of planets she has robbed. | core |
| sb-orbitroot-matriarch | Orbitroot Matriarch | R | R/G | Legendary Creature, Alien Matriarch | {3}{R}{G} | 4/4 | Overrun; arrives: Propagate | Her roots cross three decks and all of them are armed. | core |
| sb-white-signal-bastion | White-Signal Bastion | R | W | Enchantment | {3}{W} | None | your marked creatures get +0/+2 | The bastion is grown from a single pearl of hull tissue. | core |
| sb-blue-echo-array | Blue-Echo Array | R | C | Artifact | {1} | None | Skim {1}; arrives: Foresee 2 | It remembers every route the ship almost took. | core |
| sb-black-starving-orbit | Black-Starving Orbit | R | B | Ritual | {3}{B} | None | Sever target creature with a mark | It circles the target until the target forgets why it was afraid. | core |
| sb-red-solar-lash | Red-Solar Lash | R | R | Charm | {1}{R} | None | damage target creature 3 | The lash leaves a red line across the darkness and nothing else. | core |
| sb-green-propagation-chorus | Green Propagation Chorus | R | G | Ritual | {4}{G} | None | Propagate; gainLife 2 | The chorus begins with one throat and ends with the whole garden. | core |
| sb-chromelight-lattice | Chromelight Lattice | R | C | Artifact | {3} | None | arrives: add a mark to target creature; marked creatures you control get +0/+1 | It is a fence, a nursery, and a very patient weapon. | flex |
| sb-pale-violet-crossing | Pale-Violet Crossing | R | W/U | Land | None | None | entersTapped; manaAbility W/U | The crossing shines brightest where two currents disagree. | core |
| sb-eclipse-docking-ring | Eclipse Docking Ring | R | W/B | Land | None | None | entersTapped; manaAbility W/B | The ring accepts every ship and trusts none of them. | core |
| sb-ember-void-rail | Ember-Void Rail | R | B/R | Land | None | None | entersTapped; manaAbility B/R | The rail is hot enough to cauterize a bad decision. | core |
| sb-radiant-comet-lane | Radiant-Comet Lane | R | R/G | Land | None | None | entersTapped; manaAbility R/G | Comets mark the safe turns for anyone brave enough to follow. | core |
| sb-aurora-reefway | Aurora Reefway | R | G/U | Land | None | None | entersTapped; manaAbility G/U | The reef glows whenever a living ship passes above it. | core |

### Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-prismatic-fleet-marshal | Prismatic Fleet Marshal | SR | W | Creature, Alien Commander | {4}{W} | 4/4 | Sentinel; arrives: Propagate | Her fleet forms a flower around the enemy before it closes. | core |
| sb-eclipse-blood-artist | Eclipse Blood Artist | SR | B | Creature, Alien Artist | {3}{B} | 3/3 | Blood Oath; whenever this gets a mark, opponent losesLife 2 | She paints with light stolen from the moment a star dies. | core |
| sb-ember-orbit-exarch | Ember-Orbit Exarch | SR | R | Creature, Alien Priestess | {3}{R} | 4/3 | Warcry; arrives: damage target creature 2 | Her sermons begin with a spark and end with a crater. | core |
| sb-rootlight-broodmother | Rootlight Broodmother | SR | G | Creature, Alien Matriarch | {5}{G} | 4/5 | arrives: Propagate, createToken Broodling | She births a swarm from the roots of a starship. | core |
| sb-moonlit-hull-repairer | Moonlit Hull Repairer | SR | W | Creature, Engineer | {3}{W} | 3/5 | Sentinel; arrives: add a mark to target creature and gainLife 3 | She repairs the ship with one hand and the crew with the other. | flex |
| sb-voidcurrent-conjurer | Voidcurrent Conjurer | SR | U | Creature, Alien Mage | {3}{U} | 3/3 | Skyborne; arrives: Foresee 3 | She braids a current through empty space and calls it a road. | flex |
| sb-solar-thruster-herald | Solar-Thruster Herald | SR | R | Creature, Alien Herald | {4}{R} | 3/3 | Skyborne, Warcry; whenever this gets a mark, damage opponent 2 | Her arrival is always announced by the sound of something breaking. | flex |
| sb-ringworld-bloomkeeper | Ringworld Bloomkeeper | SR | G | Creature, Alien Druid | {4}{G} | 3/4 | Warding Gaze; whenever another creature gets a mark, gainLife 1 | She tends a garden that encircles a world and still wants more room. | flex |
| sb-chrome-veil-admiral | Chrome-Veil Admiral | SR | W/U | Legendary Creature, Alien Commander | {4}{W}{U} | 4/4 | Skyborne; your marked creatures get +1/+1 | Her veil is a tactical display that looks like a storm of glass. | core |
| sb-violet-eclipse-weaver | Violet-Eclipse Weaver | SR | B/R | Legendary Creature, Alien Weaver | {3}{B}{R} | 4/4 | Deathblade; arrives: opponent losesLife 2 and you gainLife 2 | She weaves the last light from a dying sun into a weapon. | flex |
| sb-propagation-engine | Propagation Engine | SR | C | Enchantment | {5} | None | dawn: Propagate | The machine has no guide because the whole ship is its nervous system. | core |
| sb-deep-space-severance | Deep-Space Severance | SR | B | Ritual | {2}{B} | None | Sever target creature; Sever the top card of an opponent's graveyard | It cuts through armor, memory, and the comfort of distance. | core |
| sb-hullwake-overdrive | Hullwake Overdrive | SR | R | Charm | {R} | None | boost target creature +3/+0; Warcry until end of turn | The ship gives one crew member permission to become the weather. | core |

### Super Super Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-queen-of-the-living-hull | Queen of the Living Hull | SSR | W | Legendary Creature, Alien Queen | {5}{W}{W} | 5/5 | Sentinel; arrives: Propagate; your other marked creatures get +1/+1 | She wears the ship's living crown and listens through every wall. | core |
| sb-astral-reef-singer | Astral Reef Singer | SSR | U | Legendary Creature, Alien Singer | {7}{U} | 4/5 | Skyborne; dawn: draw 1 | Her song makes reefs bloom in the vacuum between systems. | core |
| sb-hellion-of-the-redshift | Hellion of the Redshift | SSR | R | Legendary Creature, Alien Beast | {3}{R} | 5/4 | Warcry, Overrun; arrives: damage target creature 3 | It is a living engine with a temper and no reverse gear. | core |
| sb-worldroot-shipmind | Worldroot Shipmind | SSR | G | Legendary Creature, Starship | {7}{G} | 5/6 | arrives: Propagate, createToken Broodling x2 | The ship grew a mind so large that the crew became its weather. | core |
| sb-chrome-violet-archon | Chrome-Violet Archon | SSR | W/U | Legendary Creature, Alien Archon | {5}{W}{U} | 5/5 | Skyborne; marked creatures you control have Sentinel | She was born in a flash of chrome and immediately issued a safety protocol. | core |
| sb-voidflare-empress | Voidflare Empress | SSR | B/R | Legendary Creature, Alien Empress | {5}{B}{R} | 5/4 | Dreaded, Warcry; whenever a creature you control gets a mark, opponent losesLife 1 | Her court follows wherever the signal becomes dangerous. | flex |
| sb-signal-cathedral | Signal Cathedral | SSR | C | Legendary Artifact | {5} | None | dawn: Foresee 2; if you control 5 or more marked permanents, draw 1 (AI-risk) | The cathedral is a receiver built for a god that may be the ship. | stretch |
| sb-propagation-choir | Propagation Choir | SSR | G | Enchantment | {4}{G} | None | whenever you add a mark to a permanent, gainLife 1 and createToken Broodling (AI-risk) | The first singer starts the chorus. The hull supplies the harmony. | flex |
| sb-starborne-apotheosis | Starborne Apotheosis | SSR | W | Ritual | {6}{W} | None | Propagate; gainLife 5; boost all your marked creatures +1/+1 | The crew does not ascend. The whole ship rises with them. | core |
| sb-redline-supernova | Redline Supernova | SSR | R | Ritual | {2}{R} | None | damage each creature 3; a creature damaged this way that would die this turn is severed instead | The detonation is visible from three systems and remembered in four. | core |

### Ultra Rares

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-constellation-matriarch | Constellation Matriarch | UR | W | Legendary Creature, Alien Matriarch | {6}{W} | 5/6 | Skyborne, Sentinel; your other marked creatures get +1/+1 | She wears a living constellation as a crown and calls it family. | core |
| sb-abyssal-iris-regent | Abyssal Iris Regent | UR | B | Legendary Creature, Alien Regent | {4}{B} | 6/5 | Deathblade, Blood Oath; when this dies: Sever the top 3 cards of an opponent's graveyard | Her irises are windows into a night that wants to come closer. | core |
| sb-solar-flare-sovereign | Solar-Flare Sovereign | UR | R | Legendary Creature, Alien Sovereign | {5}{R} | 6/5 | Warcry, Overrun; arrives: damage target creature 3 | She does not enter combat. Combat enters her orbit. | core |
| sb-worldgarden-leviathan | Worldgarden Leviathan | UR | G | Legendary Creature, Alien Beast | {7}{G} | 7/7 | Overrun; arrives: Propagate, createToken Chrome Husk | It carries a garden on its back and a moon in its shadow. | core |
| sb-prism-void-comet | Prism-Void Comet | UR | W/U | Legendary Creature, Alien Comet | {6}{W}{U} | 6/6 | Skyborne, Untouchable; whenever you Propagate, draw 1 | It is a living starship, a woman, and a promise moving too fast to catch. | core |
| sb-eclipse-red-queen | Eclipse-Red Queen | UR | B/R | Legendary Creature, Alien Queen | {6}{B}{R} | 7/5 | Dreaded, Warcry; whenever a marked creature you control attacks, damage opponent 1 (AI-risk) | Her red court arrives after the eclipse and leaves before the mourning. | flex |
| sb-halo-motherboard | Halo Motherboard | UR | C | Legendary Artifact | {6} | None | arrives: Propagate; your marked creatures get +1/+1; dawn: Foresee 1 (AI-risk) | It is the first machine the fleet built that can dream in plural. | stretch |

## Concretion additions: evergreen sprinkle and reskin repair (2026-08-25)

Two audits drove this block, both measured against `balance/cards.sqlite` rather
than assumed.

**Evergreen coverage.** `Bulwark` appears in seven of eight shipped sets and was
absent here; `Twin Blades` appears in five of eight and was absent; `cancel` had
a single card. **Returning mechanics were the bigger miss**: Sands of the Duat
carried Skim 4, Retell 8 and Empower 8 alongside its own Rite, which is the
house convention for sprinkling. This draft had Skim 15 but **Retell 0 and
Empower 0**.

**Reskin audit.** Ten rows were exact functional duplicates of a shipped card
(same normalised cost, same stats, same rules text). Eight were creatures whose
SUBTYPES differ (`Alien Soldier` against `Squire`), which in a game with tribal
payoffs is real differentiation. **Two were spells with nothing to differentiate
them** and are reworked below.

For calibration, the shipped pool's own duplicate rate: Base Set 0.0%, Ragnarok
4.2%, Silver Veil 9.5%, Grail Oath 9.6%, Nocturne Manor 10.8%, Dark Tales 11.7%,
Yokai Nights 15.8%, **Sands of the Duat 15.9%**. This draft sits at **5.0%**, the
cleanest since Ragnarok. The drift from 0% to 16% across eight sets is a
pool-health signal worth tracking; it is recorded in
[design-health.md](../../design-health.md).

**Power check, run against `balance/power-scores.json` and the shipped pool.**
Tying a keyword to a mark is not free, and in one case the power formula did not
notice. The formula prices a mark as a flat +0.7 (Nurture pays 1.4 for two) and
carries **no term for keyword-times-mark interaction**. Twin Blades counts combat
damage twice, so a mark on a double-striker is worth roughly double, and the
formula scored two cards "within band" that the shipped pool says are not:

- `sb-lance-of-two-suns` originally marked ITSELF, arriving as a 3/2 Twin
  Blades for mv3. **Every shipped mv3 Twin Blades body deals 4 damage and three
  of the four are RARE**; this dealt 6 at common, which is the mv4-rare tier.
- `sb-splitlight-corsair` originally marked itself into a 5/5 Twin Blades at
  mv5, for 10 damage. Shipped mv5 pays 8 at rare, SR and SSR alike; **10 damage
  at mv5 is the UR tier** (Bastet, Mistress of the Ninth).

Both now mark **another** creature, so the mark cannot be doubled, and the
corsair drops to 3/4. They stay enablers without buying their own combat step
twice. Bulwark cards keep self-marks deliberately: a Bulwark creature cannot
attack, so nothing is doubled.

**The general rule this produces: a mark may be self-targeted only on a body
that does not multiply combat damage.** Twin Blades, and any future double-hit
keyword, must mark someone else.

**Every addition below ties to marks.** The obvious statlines for Bulwark and
Twin Blades are already taken several times over, so hanging each keyword off
the set's own mechanic is what keeps these from becoming the next generation of
reskins. It also thickens the enabler layer the colour audit called for.

### Reworked, to remove exact duplicates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-quiet-orbit | Quiet Orbit | C | U | Charm | {1}{U}{U} | None | cancel target spell; move a mark from a permanent you control to another permanent you control | The silence between two signals is where she does her work. | core |
| sb-marrow-eviction | Marrow Eviction | C | B | Charm | {1}{B} | None | target creature gets -2/-2 until end of turn; if it is marked, it gets -4/-4 instead | What the hull grew, the dark unmakes first. | core |

Was: a plain `{2}{U}` cancel identical to Signal Bridge, and a plain `{1}{B}`
-2/-2 identical to Hollow the Chest. Both now carry their colour's relationship
to marks, which is the one thing no shipped card can already be.

### Cancel, restored to a real blue suite

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-signal-drown | Signal Drown | C | U | Charm | {3}{U}{U} | None | cancel target spell; if you control a marked permanent, draw a card | Her answer arrives before the question finishes forming. | core |
| sb-collapse-the-lane | Collapse the Lane | R | U | Charm | {3}{U} | None | cancel target spell, then Foresee 2 | The lane was there a moment ago. She is certain of it. | flex |

### Bulwark, as hull and station

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-drydock-carapace | Drydock Carapace | C | W | Creature, Starship | {1}{W} | 0/4 | Bulwark; arrives: add a mark to this | It was grown around the dock, and now the dock is part of it. | core |
| sb-hullplate-bastion | Hullplate Bastion | C | G | Creature, Alien Warden | {2}{G} | 1/5 | Bulwark; arrives: add a mark to another target creature | She feeds the garden first and the guns second. | core |
| sb-static-reef | Static Reef | R | U | Creature, Alien Reef | {3}{U} | 2/6 | Bulwark; whenever a permanent you control becomes marked, Foresee 1 | The reef hears every new signal before its crew does. | flex |
| sb-ossuary-gate | Ossuary Gate | R | B | Creature, Starship | {2}{B} | 1/4 | Bulwark; marked creatures your opponent controls get -1/-0 | The gate remembers what the light did to it. | flex |

### Twin Blades, as paired light

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-lance-of-two-suns | Lance of Two Suns | C | R | Creature, Alien Duelist | {2}{R} | 2/1 | Twin Blades; arrives: add a mark to another target creature | Two stars rose over her homeworld. She fights like both of them. | core |
| sb-mirrorblade-consort | Mirrorblade Consort | R | W | Creature, Lumenborn | {3}{W} | 2/3 | Twin Blades, Sentinel | Her reflection guards the door she is not standing at. | core |
| sb-splitlight-corsair | Splitlight Corsair | R | G | Creature, Alien Corsair | {4}{G} | 3/4 | Twin Blades; arrives: add a mark to another target creature | The prism split her once and neither half agreed to stop. | flex |

### Retell, the signal that repeats

Retell suits this set better than the one it came from: a world of beacons,
echoes and relayed light already means "it comes back" in its own vocabulary.

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-relay-bloom | Relay Bloom | C | G | Charm | {1}{G} | None | add a mark to target creature; Retell {2}{G} | The garden repeats what it liked hearing. | core |
| sb-echo-burst | Echo Burst | C | R | Charm | {1}{R} | None | deal 2 damage to any target; Retell {2}{R} | The shot arrives twice because the corridor insisted. | core |
| sb-signal-recall | Signal Recall | C | U | Charm | {1}{U} | None | move a mark from a permanent you control to another permanent you control; Retell {2}{U} | She files the light somewhere safer. | core |
| sb-void-lament | Void Lament | C | B | Charm | {1}{B} | None | target creature gets -1/-1 until end of turn; if it is marked, -3/-3 instead; Retell {2}{B} | The dark learned the song and sings it back wrong. | flex |
| sb-hullsong | Hullsong | C | W | Charm | {1}{W} | None | target creature gets +1/+1 until end of turn and gains Sentinel; Retell {2}{W} | The ship hums, and the watch does not sleep. | flex |

### Empower, the overcharged hull

Every entry respects the printed-plus-Empower ceiling of 9.

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-bloomdrive-surge | Bloomdrive Surge | R | G | Ritual | {2}{G} | None | add a mark to up to two target creatures; Empower {2}{G}: Propagate | Feed the drive enough light and the whole garden answers. | core |
| sb-overcharge-the-hull | Overcharge the Hull | C | R | Charm | {1}{R} | None | deal 3 damage to target creature; Empower {2}{R}: this deals 2 damage to your opponent | The reactor was never rated for her temper. | core |
| sb-lumen-refit | Lumen Refit | R | W | Creature, Starship | {2}{W} | 3/3 | Bulwark; Empower {2}{W}: add a mark to this | Refit in the light of a dying sun, and better for it. | flex |
| sb-tidewalk-analyst | Tidewalk Analyst | R | U | Creature, Alien Analyst | {3}{U} | 2/4 | Empower {3}{U}: move a mark from a permanent you control to another permanent you control | She reads the tide as a filing problem. | flex |
| sb-eclipse-tithe | Eclipse Tithe | R | B | Charm | {2}{B} | None | remove all marks from target creature; Empower {2}{B}: your opponent loses 2 life | Everything the light gave, the eclipse counts back. | core |

### Rite and Quest, unlocked 2026-08-25

Both were previously treated as their home set's identity. The owner ruling is
that neither is locked, and Starborne satisfies the one real prerequisite: Rite
needs sacrifice fodder in the format, and this set already ships six token types
across all five colours (Lumen Drone, Broodling, Chrome Husk, Nebula Firefly,
Violet Hullguard, Void Mote).

Rite also lands squarely on the set's stated identity, that "every shining body
may be part of a larger appetite", and it gives black a second job beyond
removing marks, which was otherwise a one-note nine cards.

**Costing note.** Shipped Rite bodies run deliberately oversized because
sacrificing a creature is real card disadvantage: `Devourer's Retainer` is a 5/5
for `{3}{B}` at COMMON, roughly a +1.0 delta, and `Sun-Rope Hauler` is a 4/3
with Warcry for `{1}{R}`. The entries below sit at or under that line rather
than above it.

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-appetite-of-the-void | Appetite of the Void | R | B | Creature, Alien Devourer | {4}{B} | 4/5 | Rite 1; arrives: marked creatures your opponent controls get -2/-2 until end of turn | It eats the light first, and then whatever the light was attached to. | core |
| sb-gullet-of-the-hive | Gullet of the Hive | R | B | Creature, Starship | {4}{B} | 5/5 | Rite 1; arrives: your opponent loses 1 life for each marked creature they control | The hold is warm, and it is not supposed to be warm. | flex |
| sb-brood-communion | Brood Communion | R | G | Ritual | {1}{G} | None | Rite 1; add a mark to each creature you control | The swarm agrees, in the way a swarm agrees, and one of them does not come back. | core |

`sb-brood-communion` is the one to watch in measurement. It converts a single
body into a mark on the whole board, which is the cheapest Propagate setup in
the set and scales with a wide field rather than a tall one. If the seeded runs
show it pushing mark density past the snowball threshold the overplan warns
about, it is the first cut, not the last.

### One Quest, as a deliberate experiment

Quest fits this set better than any other on the slate: a world of living
starships crossing nebulae is the natural home for a mechanic that advances a
chapter at each dawn and then departs.

It is also **the mechanic the AI handles worst.** A greedy evaluator
systematically undervalues a payoff three dawns away, and the overplan already
flags threshold cards as hostile to the current AI and marks them cuttable. So
this ships as exactly one card, tagged `(AI-risk)` and `flex`, and it does not
graduate to `core` without seeded win-rate evidence.

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sb-the-long-crossing | The Long Crossing | SR | G | Ritual | {2}{G} | None | (AI-risk) Chapter I: create one 1/1 Broodling token; Chapter II: add a mark to each creature you control; Chapter III: Propagate | Three dawns out from anywhere, the hull starts keeping its own crew. | flex |

The chapter order is the argument for the card: it makes a body, marks the
board, then compounds what it made. That is the set's whole mechanic told once,
slowly, which is what Quest is for. It is also why it cannot be measured by the
formula, only by play.

### What this block does to the colour audit

Three new common mark generators land outside green (`sb-drydock-carapace` in
white, `sb-lance-of-two-suns` in red, `sb-relay-bloom` in green plus
`sb-hullplate-bastion` in green), and the two colours that generate nothing now
have a defined job instead of a hole: **blue moves marks** across four cards
(`sb-quiet-orbit`, `sb-signal-recall`, `sb-tidewalk-analyst`, and
`sb-static-reef` reading them), and **black answers them** across four
(`sb-marrow-eviction`, `sb-void-lament`, `sb-ossuary-gate`, `sb-eclipse-tithe`).

Neither blue nor black generates a single mark, which is the point.

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


## Cut list, applied 2026-08-25

Seventy-two candidates cut to reach the shipping set. Kept here with the
reason for each, because a cut is a judgement and the next person may want to
reverse one. Nothing tagged `core` was cut.

**Owner overrides on the proposed list:** `Halo Motherboard` (UR) and
`Signal Cathedral` (SSR) were spared despite being the threshold cards the
design-risk section flags as hostile to the current AI, and `Eclipse-Red Queen`
(UR) was spared to put the UR share on the shipped median. `Eclipse Star
Vampire` (SSR) and `Galaxy-Heart Navigator` (UR) were cut in their place.
`Galaxy-Heart Navigator` went because it was the only UR with no mark
interaction at all: in a Propagate set the top rarity should say what the set
is about.

### UR (1)

| Name | Color | Reason |
| --- | --- | --- |
| Galaxy-Heart Navigator | U | lowest-value flex |

### SSR (4)

| Name | Color | Reason |
| --- | --- | --- |
| Black-Sun Severance | B | lowest-value flex |
| Chromaviolet Haven | W/U | stretch |
| Eclipse Star Vampire | B | owner swap |
| Ghostlight Transmitter | C | lowest-value flex |

### SR (5)

| Name | Color | Reason |
| --- | --- | --- |
| Cosmic Nursery | C | lowest-value flex |
| Grave-Star Matron | B | stretch |
| Lunar Chrome Oracle | U | lowest-value flex |
| Nebula Shear | U | lowest-value flex |
| Radiant Orbit | W | stretch |

### R (27)

| Name | Color | Reason |
| --- | --- | --- |
| Aurora-Horn Beast | G | duplicate of Grave-Soil Giant [Nocturne Manor] |
| Starboard Hellion | R | duplicate of Glitchhorn Enforcer [Yokai Nights] |
| Blue-Comet Adept | U | vanilla body |
| Graveyard Astronomer | B | stretch, vanilla body |
| Lumen Cathedral Keeper | W | vanilla body |
| Satellite-Vine Caretaker | G | vanilla body |
| Solar-Tide Prime | G/U | vanilla body |
| Starved-Signal Eater | B | vanilla body |
| Carrion-Comet Drone | B | lowest-value flex |
| Chrome-Nebula Port | C | lowest-value flex |
| Comet-Tail Hunter | R | lowest-value flex |
| Lumen-Void Apostle | U/B | stretch |
| Night-Sky Observer | U | lowest-value flex |
| Orbit-Lace Infiltrator | U | lowest-value flex |
| Ringworld Stampede | G | lowest-value flex |
| Solar Pact Medic | W | lowest-value flex |
| Starlight Arbiter | W | stretch |
| Violet Pulse | U | lowest-value flex |
| Violet-Eclipse Duchess | W/B | lowest-value flex |
| Black-Radiance Stalker | B | mark PAYOFF |
| Docking-Ring Warden | W | mark PAYOFF |
| Mirror-Nebula Savant | U | stretch, mark PAYOFF |
| Plasma-Veil Duelist | R | mark PAYOFF |
| Redshift Ambusher | R | mark PAYOFF |
| Signal-Crown Thief | U | stretch, mark PAYOFF |
| Voidreef Grafter | G | mark PAYOFF |
| Hullwake Feast | G | stretch, MARK GENERATOR |

### C (35)

| Name | Color | Reason |
| --- | --- | --- |
| Carrion-Orbit Eater | B | duplicate of Ghost-Market Bruiser [Yokai Nights] |
| Chrome Gravehand | B | vanilla body |
| Chrome-Tide Navigator | U | vanilla body |
| Comet-Bone Collector | B | vanilla body |
| Corpse-Light Navigator | B | stretch, vanilla body |
| Drift Harbor Medic | U | vanilla body |
| Iridescent Sporekeeper | G | vanilla body |
| Jade-Radiation Druid | G | vanilla body |
| Moonrelay Courier | U | vanilla body |
| Plasma Howl | R | vanilla body |
| Prism Deputy | W | vanilla body |
| Ringworld Forager | G | vanilla body |
| Severed-Signal Raider | B | vanilla body |
| Solar Courier | W | vanilla body |
| Violet Orbit Mage | U | vanilla body |
| Astral-Current Diver | U | lowest-value flex |
| Aurora Watch | W | lowest-value flex |
| Black-Halo Infiltrator | B | lowest-value flex |
| Blue-Glass Envoy | U | stretch |
| Chrome Seraph | W | lowest-value flex |
| Dawn-Hull Sentinel | W | lowest-value flex |
| Far-Star Harvest | G | lowest-value flex |
| Grave Orbit | B | lowest-value flex |
| Hull Patch | W | lowest-value flex |
| Hullgarden Caretaker | G | lowest-value flex |
| Lattice Rescue | W | lowest-value flex |
| Luminous Compost | G | lowest-value flex |
| Moonpool | U | lowest-value flex |
| Nebula Reefback | G | lowest-value flex |
| Nebula Skimmer | U | lowest-value flex |
| Voidglass Observer | U | stretch |
| Nebula Sparkhound | R | stretch, mark PAYOFF |
| Signal-Lace Thief | U | stretch, mark PAYOFF |
| Starless Ward | B | stretch, mark PAYOFF |
| Stellar Bondmate | W | stretch, mark PAYOFF |
