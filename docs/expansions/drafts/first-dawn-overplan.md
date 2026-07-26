<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# The First Dawn: Overplanned Candidate Slate

## Set Identity

The First Dawn is a volcanic dawn jungle where adult cavewoman huntresses read claw marks in cooling ash, feathered thunder-lizards scream through the canopy, bone totems remember every injury, and the first ember sunrise turns survival into a weapon. The set is primal and fierce without being mindless: its best creatures want to attack, endure a hit, and answer a larger animal on the same board. White brings clan walls and sun-bone discipline, blue brings mist, sky hunters, and water memory, black brings carrion rites and bone memory, red brings ember velocity and thunder-lizard pressure, and green brings jungle size, marks, and the patient strength of living things.

**Provoked** expresses a creature that becomes more dangerous after surviving harm. `Provoked: [effect]` triggers when this permanent survives damage, so a player can deliberately place a sturdy body in danger and get an immediate, legible payoff. It fits the engine because damage events and survival checks already exist as the natural boundary: the new trigger needs to observe a resolved damage event, then emit ordinary effects such as marks, damage, gainLife, or Foresee. The mechanic is AI-pilotable because blocking and accepting damage are already greedy board decisions, though a few high-end cards are marked `(AI-risk)` when they ask the player to preserve a particular damaged body for several turns.

**Hunt** is the First Dawn word for a direct creature contest. `Hunt target creature with this` makes your creature and the target creature deal their Attack to each other. It gives the set a creature-based answer suite that feels like a huntress choosing dangerous prey, and it widens the board-answer toolbox without requiring a new player resource. It fits the engine as a mutual damage operation with normal First Blade, Deathblade, Provoked, and death handling. The AI can pilot it with a simple board check: choose a legal target that the hunting creature is favored to survive, with a few marked `(AI-risk)` cards where a multi-turn setup matters more than the immediate exchange.

## Candidate Table

### Commons: 100 candidates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fd-sunrise-spearbearer | Sunrise Spearbearer | C | W | Creature, Human Huntress | {1}{W} | 2/2 | First Blade | She plants the spear before the sun clears the ridge. | core |
| fd-bone-veil-guard | Bone-Veil Guard | C | W | Creature, Human Guardian | {2}{W} | 2/4 | Bulwark | Her rib-bone shield is ugly, broad, and perfectly placed. | core |
| fd-dawn-nest-keeper | Dawn Nest-Keeper | C | W | Creature, Human Keeper | {2}{W} | 3/3 | Sentinel | She guards eggs, embers, and anyone foolish enough to sleep nearby. | flex |
| fd-ivory-fang-scout | Ivory-Fang Scout | C | W | Creature, Human Scout | {1}{W} | 2/1 | Warding Gaze | Nothing feathered gets above her without being noticed. | flex |
| fd-ember-cave-medic | Ember-Cave Medic | C | W | Creature, Human Healer | {2}{W} | 2/3 | Blood Oath | Her red paste smells worse than the wound and works twice as fast. | flex |
| fd-riverbone-packer | Riverbone Packer | C | W | Creature, Human Worker | {1}{W} | 2/2 | Arrives: gainLife 1 | Every expedition begins with someone carrying too much. | flex |
| fd-plainstep-huntress | Plainstep Huntress | C | W | Creature, Human Huntress | {2}{W} | 3/3 | Arrives: Hunt target creature with this | She chooses the largest footprint and refuses to be impressed. | core |
| fd-cresting-ram-rider | Cresting Ram Rider | C | W | Creature, Human Rider | {3}{W} | 3/3 | First Blade | The ram has never met a slope it considered a warning. | flex |
| fd-sun-bone-ritual | Sun-Bone Ritual | C | W | Charm | {1}{W} | n/a | Boost target creature +1/+1; if it has Provoked, gainLife 2 | The clan paints a white line where fear used to be. | flex |
| fd-bone-spear-lesson | Bone-Spear Lesson | C | W | Ritual | {2}{W} | n/a | Your creature Hunts target creature | A child learns the lesson once, then teaches it to something larger. | core |
| fd-dawn-ash-charm | Dawn-Ash Charm | C | W | Charm | {1}{W} | n/a | Boost target creature +2/+2 until end of turn | Ash on the knuckles means the morning has chosen a side. | flex |
| fd-burnished-hide | Burnished Hide | C | W | Enchantment, Aura | {1}{W} | n/a | Attached: +0/+3 | Tough hide is a blessing until someone asks where it came from. | flex |
| fd-bone-tally | Bone Tally | C | W | Artifact | {2} | n/a | Arrives: Foresee 1 | The oldest huntress keeps count with pieces no one wants to name. | stretch |
| fd-white-ash-severing | White-Ash Severing | C | W | Charm | {2}{W} | n/a | Sever target enchantment | The clan cuts bad omens out before they grow roots. | core |
| fd-sunlit-cairn | Sunlit Cairn | C | W | Land | none | n/a | Enters tapped; manaAbility W | The cairn glows long after the fire has gone out. | flex |
| fd-whitebone-flat | Whitebone Flat | C | W | Land | none | n/a | Enters tapped; manaAbility W | A clean horizon makes even a hungry valley feel safe. | flex |
| fd-elder-sister-of-the-den | Elder Sister of the Den | C | W | Creature, Human Elder | {3}{W} | 3/4 | Blood Oath | She does not raise her voice because every child already listens. | core |
| fd-horizon-signal | Horizon Signal | C | W | Enchantment | {2}{W} | n/a | At dawn: gainLife 1; if you control a creature with a mark, gainLife 1 more | The first bright edge is a promise the clan can actually keep. | stretch |
| fd-dawnchorus-sentinel | Dawnchorus Sentinel | C | W | Creature, Human Sentinel | {3}{W} | 3/4 | Sentinel; Provoked: gainLife 1 | Her warning cry arrives before the storm and before breakfast. | flex |
| fd-lagoon-lookout | Lagoon Lookout | C | U | Creature, Human Scout | {1}{U} | 2/1 | Skyborne | She watches the water from a branch the water cannot touch. | core |
| fd-shellback-scout | Shellback Scout | C | U | Creature, Human Scout | {1}{U} | 2/2 | Arrives: Foresee 1 | The shell is a shield, a stool, and a convenient place for notes. | flex |
| fd-feathered-mudlark | Feathered Mudlark | C | U | Creature, Bird | {2}{U} | 2/3 | Skyborne | It steals bright stones and returns only when the stones are useful. | flex |
| fd-rain-cave-sage | Rain-Cave Sage | C | U | Creature, Human Sage | {2}{U} | 2/3 | Arrives: Foresee 1 | She can predict rain by listening to a wall sweat. | flex |
| fd-tidepool-stalker | Tidepool Stalker | C | U | Creature, Human Hunter | {2}{U} | 3/2 | Warding Gaze | It is hard to ambush someone who studies every shadow in the tide. | flex |
| fd-cliff-glider | Cliff Glider | C | U | Creature, Human Rider | {3}{U} | 3/3 | Skyborne | Her glider is three stitched hides and one excellent bad idea. | flex |
| fd-river-echo-hunter | River-Echo Hunter | C | U | Creature, Human Hunter | {2}{U} | 2/2 | Arrives: your creature Hunts target creature; Foresee 1 | The river repeats the sound of every mistake. | core |
| fd-dawn-pool-reader | Dawn-Pool Reader | C | U | Creature, Human Seer | {1}{U} | 1/3 | Arrives: Foresee 2 | She reads tomorrow in water that cannot remember yesterday. | flex |
| fd-reef-skirmisher | Reef Skirmisher | C | U | Creature, Human Hunter | {1}{U} | 2/1 | Warcry | The first splash is always the loudest part of the plan. | flex |
| fd-floodplain-deceiver | Floodplain Deceiver | C | U | Creature, Human Trickster | {2}{U} | 2/2 | Dreaded | Everyone watches the teeth; no one watches the reeds. | stretch |
| fd-cave-painting-reader | Cave-Painting Reader | C | U | Creature, Human Historian | {2}{U} | 2/3 | When this survives damage, Foresee 1 | The wall remembers which hunters came home. | flex |
| fd-mist-over-bone | Mist over Bone | C | U | Charm | {1}{U} | n/a | Recall target creature; Foresee 1 | Mist gives every creature a second entrance and a worse reputation. | core |
| fd-bright-water-bend | Bright-Water Bend | C | U | Charm | {2}{U} | n/a | PreventCombat; Foresee 1 | The pool goes still, and the charging beast suddenly loses its story. | flex |
| fd-echoes-before-sunrise | Echoes Before Sunrise | C | U | Ritual | {1}{U} | n/a | Draw 1; Foresee 1 | The best warning is the one that arrives while everyone is asleep. | flex |
| fd-tide-bone-charm | Tide-Bone Charm | C | U | Artifact | {2} | n/a | Skim {1}; arrives: Foresee 1 | A smooth bone is worth more after three hours of rain. | stretch |
| fd-stone-mouth-pool | Stone-Mouth Pool | C | U | Land | none | n/a | Enters tapped; manaAbility U | Water disappears beneath the jaw of a carved stone. | flex |
| fd-moonwater-cove | Moonwater Cove | C | U | Land | none | n/a | Enters tapped; manaAbility U | The cove keeps the moon in pieces. | flex |
| fd-sky-reed-channel | Sky-Reed Channel | C | U | Land | none | n/a | Enters tapped; manaAbility U | Reeds bend toward whatever is about to fall. | flex |
| fd-dawn-fog-ritual | Dawn-Fog Ritual | C | U | Charm | {2}{U} | n/a | Tap target creature; Foresee 1 | The fog does not hide the hunt, only its embarrassing middle. | core |
| fd-sky-lizard-handler | Sky-Lizard Handler | C | U | Creature, Human Handler | {3}{U} | 3/3 | Skyborne; when this survives damage, draw 1 | She keeps the lizard calm by never pretending it is tame. | flex |
| fd-charcoal-claw-hunter | Charcoal-Claw Hunter | C | B | Creature, Human Hunter | {1}{B} | 2/2 | Deathblade | Her spear is black because the fire has already met the blood. | core |
| fd-carrion-cave-scavenger | Carrion-Cave Scavenger | C | B | Creature, Human Scavenger | {2}{B} | 3/2 | Arrives: grind self 1 | It finds dinner where the thunder-lizards leave their punctuation. | flex |
| fd-bone-pit-scrapper | Bone-Pit Scrapper | C | B | Creature, Human Scrapper | {2}{B} | 3/3 | Arrives: grind self 1 | Nothing is wasted except the person who says it is. | core |
| fd-night-ash-cultist | Night-Ash Cultist | C | B | Creature, Human Cultist | {1}{B} | 2/1 | Deathblade | She prays to the coals because the coals answer quickly. | flex |
| fd-venom-tooth-ambusher | Venom-Tooth Ambusher | C | B | Creature, Human Hunter | {2}{B} | 2/3 | Deathblade; Provoked: opponent losesLife 1 | Pain is a trail, and she is very good at following it. | flex |
| fd-bloodied-stone-priestess | Bloodied Stone Priestess | C | B | Creature, Human Priestess | {3}{B} | 3/3 | Blood Oath | Her blessing leaves a red handprint and a full stomach. | flex |
| fd-hollow-rib-raider | Hollow-Rib Raider | C | B | Creature, Human Raider | {3}{B} | 4/3 | Warcry | She arrives hungry and considers that a form of punctuality. | core |
| fd-quiet-foot-huntress | Quiet-Foot Huntress | C | B | Creature, Human Huntress | {2}{B} | 2/2 | Arrives: Hunt target creature with this | The prey hears nothing until the totem starts laughing. | core |
| fd-gnawing-dawn-eater | Gnawing Dawn-Eater | C | B | Creature, Beast | {1}{B} | 2/1 | Provoked: put a mark on this | It eats the sunrise first, then everything that looks surprised. | flex |
| fd-cave-mouth-skulker | Cave-Mouth Skulker | C | B | Creature, Human Stalker | {2}{B} | 3/2 | Dreaded | It only needs one shadow, and the jungle supplies thousands. | flex |
| fd-ashbone-reclaimer | Ashbone Reclaimer | C | B | Creature, Human Reclaimer | {3}{B} | 3/3 | When another creature you control dies, gainLife 1 | She gives every fallen hunter a useful second sentence. | stretch |
| fd-bone-chant | Bone Chant | C | B | Charm | {1}{B} | n/a | Damage target creature 2 | The chant is short because the bone already knows the ending. | core |
| fd-black-sun-pact | Black-Sun Pact | C | B | Ritual | {2}{B} | n/a | Draw 1; opponent losesLife 2 | The bargain costs less when nobody asks who paid. | flex |
| fd-grave-scent | Grave-Scent | C | B | Charm | {1}{B} | n/a | Grind self 2; draw 1 | A little smoke, a little rot, and a hand that suddenly has options. | flex |
| fd-tendon-snare | Tendon Snare | C | B | Enchantment, Aura | {2}{B} | n/a | Attached: -2/-2 | The vine is pale because it has never missed. | core |
| fd-bone-needle | Bone Needle | C | B | Artifact | {1}{B} | n/a | Arrives: damage target creature 1 | A pocket-sized answer to a very large ankle. | flex |
| fd-char-pit | Char Pit | C | B | Land | none | n/a | Enters tapped; manaAbility B | The ground smolders under a layer of polite ash. | flex |
| fd-shadowed-spring | Shadowed Spring | C | B | Land | none | n/a | Enters tapped; manaAbility B | Black water gathers where the sun refuses to stay. | flex |
| fd-scorched-barrow | Scorched Barrow | C | B | Land | none | n/a | Enters tapped; manaAbility B | The dead are warm here, which is not reassuring. | flex |
| fd-cave-of-unlit-eyes | Cave of Unlit Eyes | C | B | Land | none | n/a | Enters tapped; manaAbility B | The cave has no lamps and no need for them. | flex |
| fd-ember-jaw-huntress | Ember-Jaw Huntress | C | R | Creature, Human Huntress | {1}{R} | 2/1 | Warcry | She throws the torch after the spear so the target sees both. | core |
| fd-flint-spear-runner | Flint-Spear Runner | C | R | Creature, Human Runner | {1}{R} | 3/1 | Warcry | She runs because the spear is lighter than the explanation. | core |
| fd-thunder-lizard-herder | Thunder-Lizard Herder | C | R | Creature, Human Herder | {2}{R} | 3/2 | Warcry | She does not command the herd; she survives its moods. | core |
| fd-red-cliff-ambusher | Red-Cliff Ambusher | C | R | Creature, Human Ambusher | {2}{R} | 3/2 | First Blade | A narrow ledge is still a battlefield if you claim it first. | flex |
| fd-sunscale-ravager | Sunscale Ravager | C | R | Creature, Thunder-Lizard | {3}{R} | 4/3 | Arrives: boost this +1/+0 | Its feathers are bright enough to count as a warning. | core |
| fd-bone-drum-warcaller | Bone-Drum Warcaller | C | R | Creature, Human Warcaller | {2}{R} | 2/2 | Arrives: boost another target creature +1/+0 and grant Warcry | The drumbeat says run, strike, and do not count the teeth. | flex |
| fd-spark-crest-pouncer | Spark-Crest Pouncer | C | R | Creature, Beast | {1}{R} | 2/1 | Warcry | It leaps before deciding whether the landing is survivable. | flex |
| fd-ash-tail-stalker | Ash-Tail Stalker | C | R | Creature, Human Stalker | {2}{R} | 3/2 | Provoked: damage opponent 1 | It likes being hit because the ash on its tail catches fire. | flex |
| fd-breakjaw-cub | Breakjaw Cub | C | R | Creature, Thunder-Lizard | {2}{R} | 3/3 | No ability | The cub is small enough to underestimate and loud enough to correct you. | core |
| fd-thunder-lizard-charger | Thunder-Lizard Charger | C | R | Creature, Thunder-Lizard | {3}{R} | 4/2 | Overrun | The ground moves first, but only barely. | core |
| fd-ridgefire-dancer | Ridgefire Dancer | C | R | Creature, Human Dancer | {2}{R} | 2/2 | When this survives damage, boost this +2/+0 | Her footwork is half ceremony and half escape route. | flex |
| fd-cinder-hide-brute | Cinder-Hide Brute | C | R | Creature, Beast | {3}{R} | 4/4 | No ability | It sleeps beside the volcano because the volcano has manners. | core |
| fd-sunstrike | Sunstrike | C | R | Charm | {1}{R} | n/a | Damage target creature or player 2 | The first ray of dawn has a sharp edge in this valley. | core |
| fd-bone-spear-flare | Bone-Spear Flare | C | R | Ritual | {2}{R} | n/a | Damage target creature or player 3 | A thrown spear and a burst of light make the same argument. | core |
| fd-heat-of-the-chase | Heat of the Chase | C | R | Charm | {1}{R} | n/a | Boost target creature +2/+0; grant Warcry | The hunt becomes a race when the prey starts looking confident. | flex |
| fd-tribal-ember | Tribal Ember | C | R | Enchantment | {2}{R} | n/a | At dawn: damage opponent 1; if a creature you control has Provoked, damage opponent 1 more | The fire is communal right up until someone claims it. | stretch (AI-risk) |
| fd-flint-and-fang | Flint and Fang | C | R | Artifact | {1}{R} | n/a | Arrives: boost target creature +1/+0 | Flint starts the fire; fang finishes the conversation. | flex |
| fd-redstone-flat | Redstone Flat | C | R | Land | none | n/a | Enters tapped; manaAbility R | The red stones stay warm through the coldest night. | flex |
| fd-thunderhead-ridge | Thunderhead Ridge | C | R | Land | none | n/a | Enters tapped; manaAbility R | Every storm chooses this ridge for the view. | flex |
| fd-emberfall-pass | Emberfall Pass | C | R | Land | none | n/a | Enters tapped; manaAbility R | The pass is narrow, hot, and full of excellent bad decisions. | flex |
| fd-mossback-forager | Mossback Forager | C | G | Creature, Beast | {1}{G} | 2/2 | Arrives: gainLife 1 | It eats the green things and leaves the red things for everyone else. | core |
| fd-fern-clad-huntress | Fern-Clad Huntress | C | G | Creature, Human Huntress | {2}{G} | 3/3 | Warding Gaze | Her cloak is a leaf until the leaf starts carrying a spear. | core |
| fd-thunder-lizard-yearling | Thunder-Lizard Yearling | C | G | Creature, Thunder-Lizard | {2}{G} | 3/3 | Provoked: put a mark on this | Its first scar is a family celebration. | core |
| fd-jade-tooth-stalker | Jade-Tooth Stalker | C | G | Creature, Beast | {3}{G} | 4/4 | Warding Gaze | The jungle gives it green teeth and a long memory. | core |
| fd-bone-crowned-matriarch | Bone-Crowned Matriarch | C | G | Creature, Human Matriarch | {3}{G} | 3/4 | Sentinel | The crown is a warning from three generations of survivors. | flex |
| fd-dawn-grove-tender | Dawn-Grove Tender | C | G | Creature, Human Tender | {2}{G} | 2/3 | Arrives: gainLife 2 | She knows which flowers heal and which flowers simply look pleased. | flex |
| fd-root-shelter-bear | Root-Shelter Bear | C | G | Creature, Beast | {2}{G} | 3/3 | Bulwark | It curls around the camp and calls that architecture. | flex |
| fd-cliffside-rammer | Cliffside Rammer | C | G | Creature, Beast | {3}{G} | 4/3 | Overrun | The cliff is not the obstacle; the people standing near it are. | core |
| fd-primal-track-reader | Primal Track-Reader | C | G | Creature, Human Scout | {1}{G} | 2/1 | Arrives: Foresee 1 | She can tell a hungry footprint from an angry one. | flex |
| fd-sapling-cave-painter | Sapling Cave-Painter | C | G | Creature, Human Artist | {2}{G} | 2/2 | Arrives: put a mark on target creature you control | The painting is a map, a warning, and a declaration of ownership. | flex |
| fd-rainjaw-lizard | Rainjaw Lizard | C | G | Creature, Beast | {2}{G} | 3/2 | Provoked: put a mark on another target creature you control | The rain makes its jaw shine just before it bites. | flex |
| fd-giant-fern-beast | Giant Fern Beast | C | G | Creature, Beast | {4}{G} | 5/5 | No ability | It is mostly leaves, muscle, and the conviction to use both. | core |
| fd-hunt-the-hornback | Hunt the Hornback | C | G | Ritual | {2}{G} | n/a | Your creature Hunts target creature; if yours survives, put a mark on it | The hornback is enormous, patient, and still not the final test. | core |
| fd-root-and-rib | Root and Rib | C | G | Charm | {1}{G} | n/a | Boost target creature +2/+2 | A root holds the ground while a rib holds the line. | flex |
| fd-greenstone-growth | Greenstone Growth | C | G | Ritual | {2}{G} | n/a | Put a mark on target creature; gainLife 2 | Green stone remembers heat and teaches it to flesh. | flex |
| fd-vine-lash | Vine Lash | C | G | Charm | {1}{G} | n/a | Boost target creature +1/+1; grant Warding Gaze | The vine tightens exactly when the sky becomes interesting. | flex |
| fd-seed-of-the-first-fire | Seed of the First Fire | C | G | Enchantment | {2}{G} | n/a | At dawn: put a mark on target creature you control | The jungle keeps the first ember underground and feeds it slowly. | stretch (AI-risk) |
| fd-jungle-edge | Jungle Edge | C | G | Land | none | n/a | Enters tapped; manaAbility G | Vines stop at the edge because something larger told them to. | flex |
| fd-rainwash-basin | Rainwash Basin | C | G | Land | none | n/a | Enters tapped; manaAbility G | Rain clears the mud and reveals whose trail matters. | flex |
| fd-fernstone-shelf | Fernstone Shelf | C | G | Land | none | n/a | Enters tapped; manaAbility G | A shelf of green stone overlooks the whole hungry valley. | flex |

### Rares: 60 candidates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fd-dawn-crest-captain | Dawn-Crest Captain | R | W | Legendary Creature, Human Captain | {2}{W} | 3/3 | First Blade; your other Human Huntresses get +1/+0 while this is undamaged | She makes the sunrise look organized. | core |
| fd-bone-totem-keeper | Bone-Totem Keeper | R | W | Creature, Human Keeper | {3}{W} | 3/4 | Sentinel; Provoked: put a mark on this | She knows which bones remember courage and which remember lunch. | core |
| fd-sunstep-huntress | Sunstep Huntress | R | W | Creature, Human Huntress | {2}{W} | 3/2 | Arrives: Hunt target creature with this; if it survives, gainLife 2 | Her footprints circle the prey before the prey notices the pattern. | core |
| fd-ember-cave-matron | Ember-Cave Matron | R | W | Creature, Human Matron | {3}{W} | 3/3 | Blood Oath; at dawn: gainLife 1 | Her hearth is the safest place in a world that keeps growing teeth. | flex |
| fd-ivory-cliff-warden | Ivory-Cliff Warden | R | W | Creature, Human Warden | {4}{W} | 4/5 | Bulwark, Warding Gaze | The cliff is not defended; it is simply occupied by her. | flex |
| fd-bone-sunshield | Bone-Sunshield | C | W | Creature, Human Guard | {2}{W} | 3/3 | No ability | She holds a polished rib above her head and dares the noon to blink. | core |
| fd-horizon-bone-banner | Horizon Bone Banner | R | W | Artifact | {3} | n/a | Your Human Huntresses get +1/+1; at dawn, Foresee 1 | The banner is a femur because the clan has no patience for subtle flags. | core |
| fd-dawn-after-scars | Dawn after Scars | R | W | Charm | {2}{W} | n/a | GainLife 3; put a mark on target creature that survived damage this turn | Morning honors the body that stayed standing. | flex |
| fd-sunrise-boneplain | Sunrise Boneplain | R | W/R | Land | none | n/a | Enters tapped; manaAbility W or R | The plain catches white light and red heat at once. | flex |
| fd-sky-lizard-observer | Sky-Lizard Observer | R | U | Creature, Human Observer | {2}{U} | 2/3 | Skyborne; whenever a creature survives damage, Foresee 1 | She studies every collision as if it were a language. | core (AI-risk) |
| fd-rain-cave-cartographer | Rain-Cave Cartographer | R | U | Creature, Human Cartographer | {3}{U} | 3/3 | Arrives: Foresee 2; if you control a creature with a mark, draw 1 | Her map includes the places that tried to eat her. | flex |
| fd-bone-mask-mimic | Bone-Mask Mimic | R | U | Creature, Human Shapeshifter | {2}{U} | 2/2 | Arrives: recall another target creature you control; Foresee 1 | It wears the face of whoever has the best exit plan. | flex |
| fd-mistcrest-huntress | Mistcrest Huntress | R | U | Creature, Human Huntress | {2}{U} | 2/3 | Hunt target creature with this; Provoked: Foresee 2 | She hunts through mist and lets the surviving animal choose the route home. | core |
| fd-shell-temple-scholar | Shell-Temple Scholar | R | U | Creature, Human Scholar | {3}{U} | 2/4 | At dawn: Foresee 1; if you have a marked creature, draw 1 | The shell temple is quiet because its walls have already heard everything. | flex (AI-risk) |
| fd-flooded-bone-archive | Flooded Bone Archive | R | U | Enchantment | {3}{U} | n/a | At dawn: Foresee 2 | The archive floats one finger above the water and one century above fashion. | flex |
| fd-tidecall | Tidecall | R | U | Charm | {2}{U} | n/a | Recall target creature; draw 1 | The tide returns what the hunt has not learned to keep. | core |
| fd-skyline-fissure | Skyline Fissure | R | U/R | Land | none | n/a | Enters tapped; manaAbility U or R | A crack in the cloud shows the world before it was named. | flex |
| fd-carrion-crown-queen | Carrion-Crown Queen | R | B | Legendary Creature, Human Queen | {3}{B} | 4/3 | Deathblade; whenever another creature you control dies, opponent losesLife 1 | She wears the crown because someone had to count the dead. | core |
| fd-bone-totem-devotee | Bone-Totem Devotee | R | B | Creature, Human Devotee | {2}{B} | 2/3 | Provoked: opponent losesLife 1; if this has a mark, draw 1 | The totem asks for pain and accepts interest. | flex (AI-risk) |
| fd-black-ash-huntress | Black-Ash Huntress | R | B | Creature, Human Huntress | {2}{B} | 3/2 | Arrives: Hunt target creature with this; if it dies, grind opponent 2 | Her arrows are barbed so the story cannot leave with the prey. | core |
| fd-grave-sun-eater | Grave-Sun Eater | R | B | Creature, Beast | {4}{B} | 4/4 | Dreaded; Provoked: gainLife 2 | It follows the sun only to find where the shadows are deepest. | flex |
| fd-cave-of-many-teeth | Cave of Many Teeth | R | B | Creature, Beast | {3}{B} | 3/4 | Deathblade; at dawn: grind self 1 | The cave walks when the moon is hidden. | flex |
| fd-blood-on-the-limestone | Blood on the Limestone | R | B | Ritual | {2}{B} | n/a | Sever target creature; grind self 1 | The mark on the limestone is both warning and invitation. | core |
| fd-carrion-call | Carrion Call | R | B | Charm | {3}{B} | n/a | CreateToken Bone Totem; opponent losesLife 2 | The first bird arrives before the body cools. | flex |
| fd-ancient-burial-ground | Ancient Burial Ground | R | B/G | Land | none | n/a | Enters tapped; manaAbility B or G | Roots hold the bones down while the bones hold the roots up. | flex |
| fd-thunder-jaw-queen | Thunder-Jaw Queen | R | R | Legendary Creature, Thunder-Lizard | {3}{R} | 4/3 | Warcry; at dawn: boost your other creatures +1/+0 | Her roar is the clan's official sunrise announcement. | core |
| fd-ember-crest-huntress | Ember-Crest Huntress | R | R | Creature, Human Huntress | {2}{R} | 3/2 | First Blade; arrives: your creature Hunts target creature | She brings a spear to every conversation, including friendly ones. | core |
| fd-bone-drum-champion | Bone-Drum Champion | R | R | Creature, Human Champion | {2}{R} | 3/3 | Warcry; whenever this survives damage, boost another target creature +1/+0 | The drum does not keep time; it starts it. | flex |
| fd-sunfire-provocateur | Sunfire Provocateur | R | R | Creature, Human Firebrand | {2}{R} | 2/2 | Provoked: damage opponent 2 | She smiles when the first stone hits because now the show has begun. | core |
| fd-ridgeback-breaker | Ridgeback Breaker | R | R | Creature, Thunder-Lizard | {4}{R} | 5/4 | Overrun | It has never seen a wall that deserved to remain upright. | flex |
| fd-flint-totem | Flint Totem | R | R | Artifact | {3}{R} | n/a | Arrives: boost all your creatures +1/+0 and grant Warcry | The totem turns a gathering into a stampede. | core |
| fd-ember-squall | Ember Squall | R | R | Ritual | {3}{R} | n/a | Damage target creature or player 4 | The sky opens like a kiln door. | core |
| fd-red-dawn-arena | Red Dawn Arena | R | R/G | Land | none | n/a | Enters tapped; manaAbility R or G | The arena is a circle of red earth and no useful excuses. | flex |
| fd-verdant-thunder-lizard | Verdant Thunder-Lizard | R | G | Creature, Thunder-Lizard | {3}{G} | 4/4 | Provoked: put two marks on this | Its scars grow bright green before they grow dangerous. | core |
| fd-jungle-crown-huntress | Jungle-Crown Huntress | R | G | Legendary Creature, Human Huntress | {2}{G} | 3/3 | Warding Gaze; Hunt target creature with this; if it survives, put a mark on it | She wears a predator's skull and still looks like the smaller problem. | core |
| fd-rootbone-elder | Rootbone Elder | R | G | Creature, Human Elder | {4}{G} | 4/5 | Sentinel; when this survives damage, put a mark on another target creature | The elder has more rings than the oldest tree. | flex |
| fd-mossfire-stalker | Mossfire Stalker | R | G | Creature, Beast | {2}{G} | 3/2 | Provoked: Foresee 1 and gainLife 1 | It gets hit, blinks once, and finds the better trail. | flex |
| fd-great-fern-behemoth | Great Fern Behemoth | R | G | Creature, Beast | {5}{G} | 6/6 | Overrun | The jungle calls it a plant because calling it anything else feels rude. | core |
| fd-ancestral-bone-grove | Ancestral Bone Grove | R | G | Enchantment | {3}{G} | n/a | At dawn: put a mark on target creature; if it survived damage last turn, put two marks instead | The grove feeds on memory and returns it as muscle. | flex (AI-risk) |
| fd-rain-fed-bonepool | Rain-Fed Bonepool | R | G | Ritual | {3}{G} | n/a | Foresee 2; fetchLand | Water reveals the route, bone records the cost. | flex |
| fd-jade-sun-shelf | Jade Sun Shelf | R | G/W | Land | none | n/a | Enters tapped; manaAbility G or W | Green stone holds the sunrise in its polished face. | flex |
| fd-dawnfang-sisterhood | Dawnfang Sisterhood | R | W/R | Legendary Creature, Human Huntresses | {2}{W}{R} | 3/3 | Warcry; when this arrives, another target creature you control Hunts target creature | The sisters never agree on direction, only on impact. | core |
| fd-ash-and-ivory-chiefs | Ash and Ivory Chiefs | R | W/B | Legendary Creature, Human Chiefs | {3}{W}{B} | 4/4 | Blood Oath; Deathblade | One keeps the fire, one keeps the names, and both keep the knives. | flex |
| fd-jungle-storm-rider | Jungle Storm Rider | R | U/R | Legendary Creature, Human Rider | {2}{U}{R} | 3/3 | Skyborne, Warcry; when this survives damage, damage opponent 2 | Her glider enters the storm because the storm has the best view. | core |
| fd-fanged-reef-huntress | Fanged Reef Huntress | R | U/G | Creature, Human Huntress | {2}{U}{G} | 3/4 | Warding Gaze; Hunt target creature with this | The reef lends her teeth, and she returns them polished. | core |
| fd-bloodstone-bonecaller | Bloodstone Bonecaller | R | B/G | Legendary Creature, Human Bonecaller | {3}{B}{G} | 4/4 | Deathblade; whenever a creature you control dies, put a mark on target creature | The dead do not leave; they change the weight of the living. | flex (AI-risk) |
| fd-embergrave-devourer | Embergrave Devourer | R | B/R | Creature, Beast | {3}{B}{R} | 4/3 | Deathblade; arrives: damage opponent 2 | It eats hot ash because cold ash has no ambition. | flex |
| fd-thunder-plain-herald | Thunder-Plain Herald | R | R/G | Legendary Creature, Human Herald | {3}{R}{G} | 4/4 | Overrun; Provoked: boost this +2/+0 | Her signal horn makes the thunder-lizards look disciplined. | core |
| fd-sunwater-mediator | Sunwater Mediator | R | W/U | Creature, Human Mediator | {2}{W}{U} | 2/4 | Sentinel; arrives: Foresee 1 and gainLife 2 | She carries water between clans that would rather carry grudges. | flex |
| fd-bone-sun-reckoner | Bone-Sun Reckoner | R | W | Creature, Human Reckoner | {3}{W} | 3/3 | First Blade; Provoked: put a mark on target creature you control | She counts every wound as a future advantage. | flex |
| fd-white-ash-medic | White-Ash Medic | R | W | Creature, Human Healer | {2}{W} | 2/3 | Blood Oath; when another creature survives damage, gainLife 1 | Her medicine tastes like chalk and makes heroes of skeptics. | flex |
| fd-cave-river-bard | Cave-River Bard | R | U | Creature, Human Bard | {2}{U} | 2/2 | Arrives: draw 1; Foresee 1 | Her songs echo through caves and improve with each missing verse. | flex |
| fd-skybone-dredger | Skybone Dredger | R | U | Creature, Bird | {4}{U} | 3/5 | Skyborne; at dawn: grind self 1 and draw 1 | It circles the valley until the right old bone appears. | stretch |
| fd-limestone-knife | Limestone Knife | R | B | Creature, Human Assassin | {2}{B} | 3/1 | Deathblade; if this survives damage, opponent discardsRandom 1 | A pale knife is harder to see in a pale hand. | flex (AI-risk) |
| fd-scarlet-marrow-ritual | Scarlet Marrow Ritual | R | B | Ritual | {3}{B} | n/a | Damage target creature 3; grind self 2 | The fire takes what the grave would have taken later. | core |
| fd-ember-bone-adept | Ember-Bone Adept | R | R | Creature, Human Adept | {2}{R} | 3/2 | Empower {1}: boost all your creatures +1/+0 | She pays extra only when the whole clan gets to hit harder. | flex |
| fd-sunspike-saur | Sunspike Saur | R | R | Creature, Thunder-Lizard | {3}{R} | 4/3 | First Blade; Provoked: damage target creature 2 | Its crest catches the light just before the bite. | core |
| fd-rootfire-charger | Rootfire Charger | R | G | Creature, Beast | {3}{G} | 4/4 | Warding Gaze; when this survives damage, put a mark on this | Roots pin its feet while fire teaches them to move. | flex |
| fd-bonewall-giant | Bonewall Giant | R | G | Creature, Giant Beast | {4}{G} | 5/5 | Bulwark; Provoked: gainLife 3 | It stands between the camp and the horizon without needing a speech. | flex |
| fd-pair-of-horns | Pair of Horns | R | C | Artifact | {2} | n/a | Arrives: put a mark on target creature; if it is a Beast, draw 1 | Two horns make one warning and a surprisingly good handle. | stretch |
| fd-dawnstone-monolith | Dawnstone Monolith | R | C | Artifact | {4} | n/a | At dawn: Foresee 1; put a mark on target creature you control | It was here before the fire and expects to remain. | stretch (AI-risk) |

### Super Rares: 18 candidates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fd-first-sun-matriarch | First-Sun Matriarch | SR | W | Legendary Creature, Human Matriarch | {3}{W}{W} | 4/4 | Sentinel; Provoked: put a mark on each other creature you control | She was old when the first fire learned its name. | core |
| fd-bone-crowned-archer | Bone-Crowned Archer | SR | W | Creature, Human Archer | {2}{W}{W} | 3/4 | First Blade, Warding Gaze; Hunt target creature with this | Her crown has a quiver built into it because vanity should be useful. | flex |
| fd-ivory-dawn-omen | Ivory Dawn Omen | SR | W | Enchantment | {3}{W} | n/a | At dawn: createToken Dawn Huntress; if a creature survived damage last turn, create two instead | The omen arrives as a shadow that points toward the light. | core (AI-risk) |
| fd-sunrise-ribcage | Sunrise Ribcage | SR | W | Artifact | {4}{W} | n/a | Arrives: PreventCombat; your creatures with marks get +0/+1 | The clan turns a giant's ribs into a gate no enemy wants to test. | flex |
| fd-storm-lizard-prophet | Storm-Lizard Prophet | SR | U | Legendary Creature, Human Prophet | {3}{U}{U} | 4/4 | Skyborne; Provoked: Foresee 2 | She predicts the strike by watching the lizard's feathers lie flat. | core |
| fd-moonpool-oracle | Moonpool Oracle | SR | U | Creature, Human Oracle | {2}{U}{U} | 3/4 | Arrives: Foresee 3; at dawn: draw 1 | The pool shows her every possible bite and only one possible breakfast. | flex |
| fd-thunder-in-the-cloud-canopy | Thunder in the Cloud Canopy | SR | U/R | Ritual | {3}{U}{R} | n/a | Damage target creature 4; recall another target creature; Foresee 1 | The canopy flashes, the prey vanishes, and the survivors compare stories. | core |
| fd-cold-rain-memory | Cold Rain Memory | SR | U | Charm | {2}{U} | n/a | Foresee 2; draw 1; if you control a marked creature, draw 1 more | The rain keeps every footprint but only the wise ones read them. | flex (AI-risk) |
| fd-carrion-totem-prince | Carrion Totem Prince | SR | B | Legendary Creature, Human Prince | {3}{B}{B} | 5/4 | Deathblade; whenever another creature dies, grind opponent 1 and gainLife 1 | His court is made of ribs and his coronation is a feeding frenzy. | core |
| fd-bone-ash-prophet | Bone-Ash Prophet | SR | B | Creature, Human Prophet | {2}{B}{B} | 3/3 | Provoked: raise a creature card with cost 2 or less from your graveyard | The prophecy is always about someone who has not stayed dead. | core (AI-risk) |
| fd-first-grave-dawn | First Grave Dawn | SR | B | Enchantment | {4}{B} | n/a | At dawn: SeverGrave opponent 2; if a creature survived damage last turn, opponent losesLife 2 | The first sunrise over a grave is never a gentle one. | flex |
| fd-hunger-below-the-roots | Hunger Below the Roots | SR | B/G | Ritual | {3}{B}{G} | n/a | Sever target creature; put two marks on target creature you control | The roots drink deep and return the strength to a chosen hunter. | core |
| fd-ember-sun-tyrant | Ember-Sun Tyrant | SR | R | Legendary Creature, Thunder-Lizard | {3}{R}{R} | 5/4 | Warcry, Overrun; Provoked: damage opponent 2 | Its crown is a plume of fire and its kingdom is whatever it can claim. | core |
| fd-thunder-lizard-bond | Thunder-Lizard Bond | SR | R | Enchantment | {2}{R}{R} | n/a | Your Thunder-Lizards get +1/+0; their Provoked effects trigger an additional time | The bond is not obedience; it is mutual agreement about who runs first. | core (AI-risk) |
| fd-bone-drum-sunrise | Bone-Drum Sunrise | SR | W/R | Ritual | {3}{W}{R} | n/a | CreateToken Dawn Huntress x2; boost all your creatures +1/+0 and grant Warcry | The whole clan answers one drumbeat before the echo fades. | core |
| fd-jade-jungle-titan | Jade Jungle Titan | SR | G | Legendary Creature, Beast | {4}{G}{G} | 6/6 | Overrun; Provoked: put two marks on another target creature | The titan moves slowly because the jungle has nowhere else to be. | core |
| fd-rainforest-bone-mother | Rainforest Bone-Mother | SR | G | Creature, Human Mother | {3}{G}{G} | 4/5 | Sentinel; arrives: put a mark on each of up to two target creatures | She grows the clan the way the jungle grows around a fallen tree. | flex |
| fd-first-dawn-cairn | First Dawn Cairn | SR | C | Legendary Artifact | {4} | n/a | At dawn: Foresee 2; put a mark on target creature you control | The cairn is the first calendar and the last witness. | stretch (AI-risk) |

### Super Super Rares: 14 candidates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fd-voice-before-fire | Voice Before Fire | SSR | W/U | Legendary Creature, Human Seer | {3}{W}{U} | 4/4 | Sentinel; arrives: Foresee 2 and gainLife 2; at dawn: draw 1 | She speaks to the sunrise before the sunrise has decided what to say. | core |
| fd-mother-of-the-first-hunt | Mother of the First Hunt | SSR | W/G | Legendary Creature, Human Huntress | {4}{W}{G} | 5/5 | Blood Oath; Hunt target creature with this; Provoked: put a mark on each other creature you control | Every huntress tells the story differently and credits the same mother. | core |
| fd-ivory-bone-leviathan | Ivory-Bone Leviathan | SSR | W | Creature, Beast | {5}{W} | 6/6 | Sentinel; Provoked: createToken Bone Totem | Its skeleton is a fortress and its shadow is a neighborhood. | flex |
| fd-sun-court-of-ribs | Sun Court of Ribs | SSR | W | Enchantment | {4}{W} | n/a | Your Human Huntresses get +1/+1 and Blood Oath; at dawn, gainLife 2 | The court has no throne, only a circle of witnesses. | flex |
| fd-sky-thunder-empress | Sky-Thunder Empress | SSR | U/R | Legendary Creature, Human Empress | {4}{U}{R} | 5/4 | Skyborne, Warcry; arrives: your creature Hunts target creature; Provoked: Foresee 2 | She rides the storm because the ground has too many opinions. | core |
| fd-lagoon-of-teeth | Lagoon of Teeth | SSR | U | Creature, Beast | {4}{U}{U} | 5/5 | Skyborne; arrives: draw 2; at dawn: recall target creature | The lagoon has a shoreline only because the teeth agree to one. | flex |
| fd-waters-before-names | Waters Before Names | SSR | U/G | Enchantment | {3}{U}{G} | n/a | At dawn: Foresee 2; put a mark on target creature; if that creature has Provoked, draw 1 | The water remembers the world before anyone tried to own it. | flex (AI-risk) |
| fd-the-quiet-between-roars | The Quiet Between Roars | SSR | U | Ritual | {3}{U} | n/a | PreventCombat; draw 2; Foresee 1 | Silence is not peace, but it gives the clever a full turn. | core |
| fd-carrion-sun-queen | Carrion-Sun Queen | SSR | B/R | Legendary Creature, Human Queen | {4}{B}{R} | 5/4 | Deathblade, Warcry; whenever a creature dies, opponent losesLife 1 | She rules the hour when the sun is bright enough to show every bone. | core |
| fd-black-bone-cathedral | Black-Bone Cathedral | SSR | B | Enchantment | {5}{B} | n/a | At dawn: SeverGrave opponent 3; createToken Bone Totem if a creature died last turn | The cathedral has no roof because the dead deserve the sky. | flex (AI-risk) |
| fd-great-carrion-procession | Great Carrion Procession | SSR | B/G | Ritual | {4}{B}{G} | n/a | Destroy all creatures with defense 2 or less; put a mark on target creature you control | The procession clears the small, the weak, and the path forward. | core |
| fd-red-sun-apex | Red Sun Apex | SSR | R | Creature, Thunder-Lizard | {5}{R} | 6/4 | Overrun; Provoked: damage each opponent creature 1 | Its shadow arrives first and its feet arrive angry. | core |
| fd-thunder-lizard-apotheosis | Thunder-Lizard Apotheosis | SSR | R/G | Legendary Creature, Thunder-Lizard | {4}{R}{G} | 5/5 | Overrun; Hunt target creature with this; if it survives, put two marks on this | The lizard becomes a myth by eating the thing that would have made it one. | core |
| fd-the-embering-of-stone | The Embering of Stone | SSR | G | Enchantment | {4}{G} | n/a | Your creatures with marks get +2/+2; at dawn, put a mark on target creature | Stone takes the fire slowly, then keeps it forever. | flex (AI-risk) |

### Ultra Rares: 8 candidates

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fd-first-dawn-ancestress | First Dawn Ancestress | UR | W | Legendary Creature, Human Ancestress | {6}{W} | 7/7 | Sentinel, Blood Oath; arrives: createToken Dawn Huntress x2; Provoked: put a mark on each creature you control | The clan's first grandmother still knows exactly where to stand. | core |
| fd-thunderbird-of-the-first-sky | Thunderbird of the First Sky | UR | U/R | Legendary Creature, Bird | {5}{U}{R} | 6/5 | Skyborne, Warcry; whenever a creature survives damage, damage opponent 1 and Foresee 1 | The first sky opened its eyes and found a thunderbird looking back. | core (AI-risk) |
| fd-queen-of-the-bone-totems | Queen of the Bone Totems | UR | B/G | Legendary Creature, Human Queen | {5}{B}{G} | 6/6 | Deathblade; creatures you control with marks get +2/+2; at dawn: raise a creature card from your graveyard | She does not command the dead; she gives them a reason to return. | core (AI-risk) |
| fd-embermaw-apex | Embermaw Apex | UR | R | Legendary Creature, Thunder-Lizard | {5}{R} | 7/5 | Overrun, Warcry; Provoked: damage opponent 3 and put a mark on this | It is the argument that made the volcano stop arguing. | core |
| fd-sunrise-that-walks | Sunrise That Walks | UR | W | Creature, Avatar | {4}{W} | 5/5 | First Blade, Sentinel; at dawn: gainLife 3 and put a mark on each other creature you control | The sunrise leaves the horizon and joins the hunt. | flex |
| fd-dawn-under-the-jade-canopy | Dawn Under the Jade Canopy | UR | U/G | Legendary Enchantment | {5}{U}{G} | n/a | At dawn: Foresee 3; put two marks on target creature; your marked creatures gain Warding Gaze | The canopy opens only for those who have earned the light. | core (AI-risk) |
| fd-the-hunt-that-made-us | The Hunt That Made Us | UR | G | Legendary Ritual | {5}{G} | n/a | Your creature Hunts each of up to two target creatures; put two marks on it if it survives | The first hunt was not a victory, only the moment the clan became a clan. | core |
| fd-sunbone-world-heart | Sunbone World-Heart | UR | C | Legendary Artifact | {6} | n/a | At dawn: put a mark on each creature you control; Foresee 2; if three or more creatures survived damage last turn, draw 2 | The world keeps one warm bone at its center and calls that hope. | stretch (AI-risk) |

## Set-Unique Token Proposals

| Token | Color | Stats | Type | Keywords / role | Identity hook |
| --- | --- | --- | --- | --- | --- |
| Dawn Huntress | W | 1/1 | Creature, Human Huntress | Provoked: put a mark on this | A new hunter learns courage by surviving the first sharp lesson. |
| Feathered Thunder-Lizard | R | 2/2 | Creature, Thunder-Lizard | Warcry | Its feathers flare before its feet leave the ground. |
| Bone Totem | C | 0/3 | Artifact Creature, Totem | Bulwark | The clan builds a wall from what the jungle thought it had finished. |
| Emberling | R | 1/1 | Creature, Ember Elemental | Warcry; at dawn: damage opponent 1 if it is still on the field | It is a coal with legs and a very strong opinion about wind. |
| Fernback Grazer | G | 3/3 | Creature, Beast | No ability | It turns a clearing into a meal and a meal into a safer clearing. |
| Sky Talon | U | 1/1 | Creature, Bird | Skyborne | The smallest watcher sees the largest shadow first. |

## Precon Identity

**Dawn Hunt** is a red-green pressure deck with a small white splash option for the clan package. Its power floor comes from efficient two- and three-cost bodies that attack well without text, backed by Sunstrike, Hunt the Hornback, Bone-Spear Lesson, and the other in-color board answers. The core turn pattern is simple enough for the AI: deploy a body, attack, Hunt a creature the body is favored to survive, and let Provoked turn the damage exchange into marks or direct pressure. The win route is repeated attacks followed by Overrun, with Thunder-Lizard bodies and marked creatures carrying the final board. The white splash trades some speed for Sentinel, Blood Oath, and Dawn Huntress tokens, not for a slow value loop.

## Gauntlet Boss Concepts

- **Rung 19: Varka, Ember-Crest Matriarch** (R/G) - A direct Hunt and Provoked deck with cheap Warcry bodies, Thunder-Lizard Bond, and a high density of safe creature contests. Every turn asks the boss to attack, damage a body, and convert the survivor into more pressure.
- **Rung 20: Oru of the Black Bone Cathedral** (B/G) - A graveyard and marks deck with Deathblade blockers, creature-removal Hunts, SeverGrave attrition, and Queen of the Bone Totems as the finisher. It plays for board exchange first, then turns the surviving marked bodies into an oversized closing line.

## Selection Notes

The ten candidates I would protect first are:

1. `fd-sunrise-spearbearer`, because the common power floor needs a clean 2/2 First Blade body.
2. `fd-plainstep-huntress`, because common Hunt must be a real removal tool attached to a playable body.
3. `fd-bone-spear-lesson`, because it makes the set's creature contest visible at common.
4. `fd-ember-jaw-huntress`, because red needs a credible one-two opening instead of only flashy top end.
5. `fd-fern-clad-huntress`, because green needs a rate-efficient body that protects the sky and attacks.
6. `fd-hunt-the-hornback`, because it anchors green's answer suite and proves Hunt is not only a legend mechanic.
7. `fd-dawn-crest-captain`, because it gives the white clan package a reason to exist without asking for a slow setup.
8. `fd-verdant-thunder-lizard`, because Provoked should have a memorable common-to-rare escalation path.
9. `fd-first-sun-matriarch`, because it makes surviving damage feel like a board-wide sunrise rather than a one-card trick.
10. `fd-thunder-lizard-apotheosis`, because it is the cleanest marquee sentence for the set: a large creature hunts, survives, and becomes larger.

The three biggest design risks are:

1. **Provoked sequencing and damage loops.** A trigger that rewards survival can become repetitive if too many cards ping themselves or multiply the same trigger. The first engine pass should lock the exact event boundary, prevent recursive damage chains, and keep most common Provoked rewards to one clear effect.
2. **Hunt efficiency and target selection.** Hunt is excellent creature removal when a body survives, so costs and attack values must prevent every green or red creature from becoming unconditional removal. AI evaluation should favor favorable exchanges without spending a large attacker on a bad target.
3. **Marks plus dawn drift.** Marked-creature engines can become `(AI-risk)` plans that look impressive on paper but wait several turns for the perfect board. The selection pass should keep the precon's wins attack-forward, trim redundant dawn engines, and reserve the most conditional mark payoffs for high rarity.
