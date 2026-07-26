<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# The Gilded Nile: Overplanned Candidate Slate

## Set identity and mechanics

The Gilded Nile is a moonlit underworld of river temples, gold-faced tombs, and courts where every mortal promise is heard again after death. Bastet catgirl guardians stalk the colonnades, mummified royalty still litigate their succession, jackal judges weigh the heart, and gods demand tribute before they lift a finger. Its palette is gold on deep desert night. The set should feel ceremonial at first glance and ruthlessly practical once the procession reaches combat.

**Nine Lives** expresses the cat guardians and the Egyptian idea that death is a passage rather than a clean ending. When a creature with Nine Lives dies, it returns to the battlefield once with a mark, then cannot use Nine Lives again. The mark makes the spent life visible to the engine and to the player. Dies triggers and marks already exist as engine-shaped pieces, so an engine-first implementation can add the one-use return state before card data. It is AI-pilotable because the value is automatic: trade, return, attack again.

**Tribute** expresses a god's demand for offerings and the political price of waking a royal body. A creature with Tribute requires the listed number of creatures to be sacrificed as an additional deploy cost. The affordability check belongs before deployment resolves, and the sacrificed creatures should generate their normal dies triggers. This is a clean engine seam with a greedy AI rule: deploy the body when the board can pay, and value the offer by board state rather than by a long planning tree. Tribute cards below are concentrated at rare and above, where the enormous body or payoff justifies the cost.

The common pool is deliberately sturdy. Many common creatures are playable on stats alone, while the text adds modest upside. The set's answers include tapped-creature destruction, creature weakening, direct damage, recall, severing, a sweeper, and combat prevention. A small number of conditional or multi-turn rows carry an `AI-risk` note for later testing.

## Candidate table

The shipping target is 120 cards, but this concept pass supplies 200 candidates: 100 C, 60 R, 18 SR, 14 SSR, and 8 UR. Costs use the existing `{number}{color}` notation. `none` in Stats means the card is not a creature.

### C candidates: 100

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gn-sun-ink-scribe | Sun-Ink Scribe | C | W | Creature - Human, Scribe | {1}{W} | 2/2 | arrives: gainLife 1 | He records every promise before the ink dries. | core |
| gn-linen-bearer | Linen Bearer | C | W | Creature - Human, Servant | {2}{W} | 3/3 | none | A silent back carries what a loud court cannot. | core |
| gn-bastet-litter-guard | Bastet Litter Guard | C | W | Creature - Cat, Guardian | {1}{W} | 2/2 | Nine Lives | The temple cats patrol by moonlight and return before dawn. | core |
| gn-canal-watch-initiate | Canal Watch Initiate | C | W | Creature - Human, Guard | {2}{W} | 3/2 | sentinel | The gate is narrow, the watch is patient. | flex |
| gn-feathered-scale-warden | Feathered Scale Warden | C | W | Creature - Human, Judge | {2}{W} | 2/3 | wardingGaze | Her feather weighs more than a soldier's oath. | core |
| gn-gold-thread-apprentice | Gold-Thread Apprentice | C | W | Creature - Human, Artisan | {1}{W} | 2/2 | arrives: boost target +0/+1 | Every stitch is a small refusal to unravel. | flex |
| gn-court-of-reeds-healer | Court of Reeds Healer | C | W | Creature - Human, Priest | {2}{W} | 2/4 | arrives: gainLife 2 | She treats wounds before asking which side began the quarrel. | flex |
| gn-jar-seal-deacon | Jar-Seal Deacon | C | W | Creature - Human, Priest | {3}{W} | 3/4 | Nine Lives | He seals the dead gently and the living firmly. | flex |
| gn-white-sand-marshal | White-Sand Marshal | C | W | Creature - Human, Soldier | {3}{W} | 3/3 | arrives: boost allYours +1/+0 until end of turn | At his signal, the procession becomes an army. | flex |
| gn-ankh-bearer | Ankh Bearer | C | W | Creature - Human, Acolyte | {1}{W} | 1/3 | sentinel; when this dies, gainLife 2 | Her little golden loop is a promise with a pulse. | flex |
| gn-sun-court-page | Sun-Court Page | C | W | Creature - Human, Attendant | {2}{W} | 2/3 | arrives: foresee 1 | He reads the room by reading the room's oldest dust. | flex |
| gn-threshold-lantern | Threshold Lantern | C | W | Artifact - Relic | {2} | none | arrives: preventCombat | Its flame keeps one doorway closed for one night. | flex |
| gn-feast-for-the-ka | Feast for the Ka | C | W | Charm | {1}{W} | none | boost target +2/+2 until end of turn | A warm meal can make a ghost reconsider its schedule. | core |
| gn-judges-verdict | Judge's Verdict | C | W | Ritual | {2}{W} | none | destroy target tapped creature | The scales do not care who started the argument. | core |
| gn-lotus-binding | Lotus Binding | C | W | Enchantment - Aura | {1}{W} | none | attached: -2/-0 and bulwark | A lotus closes around the proudest blade. | core |
| gn-starlit-procession | Starlit Procession | C | W | Ritual | {3}{W} | none | createToken Ka Guardian x2 | Two lamps lead the dead home, whether they want to go or not. | flex |
| gn-sealed-tomb | Sealed Tomb | C | W | Land | none | none | entersTapped; manaAbility W | The lock is older than the dynasty that paid for it. | core |
| gn-river-gate | River Gate | C | W | Land | none | none | entersTapped; manaAbility W | Even the Nile has doors. | flex |
| gn-pure-gold-oath | Pure Gold Oath | C | W | Charm | {2}{W} | none | target creature gains sentinel and +1/+1 until end of turn | Gold is soft until a promise gives it a spine. | flex |
| gn-ibis-tide-reader | Ibis Tide Reader | C | U | Creature - Bird, Seer | {1}{U} | 2/2 | arrives: foresee 1 | She knows the river by the way one reed bends. | core |
| gn-papyrus-apprentice | Papyrus Apprentice | C | U | Creature - Human, Scribe | {1}{U} | 2/1 | Skim {1} | He can make a receipt for anything except a miracle. | flex |
| gn-moon-over-river | Moon Over River | C | U | Creature - Spirit | {2}{U} | 2/3 | skyborne | It crosses the water without disturbing a single reflection. | core |
| gn-blue-canal-runner | Blue Canal Runner | C | U | Creature - Human, Scout | {2}{U} | 3/2 | skyborne | The night watch calls her footsteps a weather report. | flex |
| gn-shabti-accountant | Shabti Accountant | C | U | Creature - Shabti, Clerk | {3}{U} | 2/4 | arrives: draw 1 | His ledgers include debts owed by people who died centuries ago. | flex |
| gn-crocodile-lake-usher | Crocodile Lake Usher | C | U | Creature - Crocodile, Guide | {2}{U} | 2/3 | arrives: foresee 2 | He smiles at the water because the water recognizes him. | flex |
| gn-star-map-keeper | Star-Map Keeper | C | U | Creature - Human, Astrologer | {1}{U} | 1/3 | arrives: foresee 1 | The ceiling is a map if you are willing to lie on the floor. | flex |
| gn-bastet-night-scout | Bastet Night Scout | C | U | Creature - Cat, Scout | {2}{U} | 2/2 | skyborne | Her eyes find the hidden door and the hidden snack. | flex |
| gn-reedboat-pilot | Reedboat Pilot | C | U | Creature - Human, Sailor | {1}{U} | 2/2 | when this attacks: foresee 1 | She rows toward danger because it is usually downstream. | flex |
| gn-scribe-of-stars | Scribe of Stars | C | U | Creature - Human, Mystic | {3}{U} | 3/3 | Skim {2} | He writes in constellations and charges by the hour. | flex |
| gn-underworld-cartographer | Underworld Cartographer | C | U | Creature - Human, Explorer | {3}{U} | 2/4 | arrives: fetchLand and foresee 1 | Her map has no edge, only increasingly expensive ink. | core |
| gn-ink-of-the-deep | Ink of the Deep | C | U | Charm | {1}{U} | none | foresee 2 | The ink remembers the hand that drowned it. | core |
| gn-drowned-name | Drowned Name | C | U | Charm | {2}{U} | none | recall target creature | The river returns the name, not always the person. | core |
| gn-veil-of-mist | Veil of Mist | C | U | Charm | {1}{U} | none | boost target +0/+3; preventCombat | A little fog makes every judge look wiser. | flex |
| gn-canopic-glyph | Canopic Glyph | C | U | Artifact - Relic | {2} | none | arrives: foresee 1 | Four jars, one spell, and no agreement about the order. | flex |
| gn-nile-mirror | Nile Mirror | C | U | Artifact - Relic | {1} | none | Skim {1}; arrives: foresee 1 | It shows the face you brought to the river. | flex |
| gn-lapis-bridge | Lapis Bridge | C | U | Land | none | none | entersTapped; manaAbility U | The blue stones hum when a secret crosses. | core |
| gn-jackal-grave-scout | Jackal Grave Scout | C | B | Creature - Jackal, Scout | {2}{B} | 3/2 | deathblade | He finds the weak point before he finds the grave. | core |
| gn-mummys-bailiff | Mummy's Bailiff | C | B | Creature - Mummy, Guard | {1}{B} | 2/2 | Nine Lives | The bandages are court-issued and annoyingly durable. | core |
| gn-royal-embalmer | Royal Embalmer | C | B | Creature - Human, Embalmer | {2}{B} | 2/3 | arrives: grind self 2 | She considers decay an unfinished administrative task. | flex |
| gn-tomb-looter | Tomb Looter | C | B | Creature - Human, Rogue | {1}{B} | 2/1 | Skim {1} | He steals from kings and leaves the receipt. | flex |
| gn-night-courtier | Night Courtier | C | B | Creature - Human, Noble | {2}{B} | 3/3 | arrives: loseLife opponent 1 | Politeness is just a sharper blade with better posture. | core |
| gn-catacomb-ferryman | Catacomb Ferryman | C | B | Creature - Human, Ferryman | {3}{B} | 3/3 | when this dies: opponent loses 1 life | He charges one coin, one secret, or one regrettable favor. | flex |
| gn-kohl-eyed-archer | Kohl-Eyed Archer | C | B | Creature - Human, Archer | {2}{B} | 2/2 | wardingGaze | Her arrows are black, quiet, and already paid for. | flex |
| gn-ankh-breaker | Ankh Breaker | C | B | Creature - Mummy, Warrior | {3}{B} | 4/2 | when this attacks: opponent loses 1 life | He breaks holy symbols with the confidence of a man who has seen the invoice. | flex |
| gn-salt-and-scarab | Salt and Scarab | C | B | Creature - Human, Priest | {1}{B} | 1/3 | bloodoath | The smallest shrine still expects a little blood. | flex |
| gn-ka-thief | Ka Thief | C | B | Creature - Spirit, Rogue | {1}{B} | 2/1 | arrives: opponent loses 1 life | It steals the part of a person that says no. | flex |
| gn-gold-mask-inspector | Gold-Mask Inspector | C | B | Creature - Human, Judge | {3}{B} | 3/3 | arrives: foresee 1 | The mask is ceremonial; the suspicion is personal. | flex |
| gn-casket-courier | Casket Courier | C | B | Creature - Mummy, Servant | {2}{B} | 2/2 | Nine Lives; when this dies: grind self 1 | The delivery is guaranteed, even after the recipient expires. | flex |
| gn-sealed-name | Sealed Name | C | B | Ritual | {2}{B} | none | severGrave 1 opponent | Some names are locked away for everyone's safety. | core |
| gn-desert-suffocation | Desert Suffocation | C | B | Ritual | {2}{B} | none | damage target creature 3 | The sand fills the mouth before the curse reaches the ears. | core |
| gn-judgment-by-jackal | Judgment by Jackal | C | B | Charm | {1}{B} | none | boost target creature -2/-2 until end of turn | The judge does not raise his voice; the verdict does it for him. | core |
| gn-grave-dust | Grave Dust | C | B | Charm | {1}{B} | none | grind self 2; opponent loses 1 life | Dust is a cheap messenger with an excellent memory. | flex |
| gn-mummys-hush | Mummy's Hush | C | B | Charm | {1}{B} | none | target creature gets -1/-1 and loses keywords until end of turn | Silence is the oldest bandage. | flex |
| gn-black-lotus-bite | Black Lotus Bite | C | B | Charm | {2}{B} | none | damage target creature 2; gainLife 2 | The flower is beautiful because it has never needed to apologize. | core |
| gn-royal-curse | Royal Curse | C | B | Enchantment - Aura | {2}{B} | none | attached: -2/-2 | A dead monarch can still issue a very specific order. | core |
| gn-bone-seal | Bone Seal | C | B | Artifact - Relic | {1} | none | Skim {1}; arrives: opponent loses 1 life | The seal opens only when the bearer stops breathing. | flex |
| gn-night-gold-canal | Night-Gold Canal | C | B | Land | none | none | entersTapped; manaAbility B | Gold gleams brightest where the water cannot reach it. | core |
| gn-sun-disc-acolyte | Sun-Disc Acolyte | C | R | Creature - Human, Acolyte | {1}{R} | 2/2 | warcry | She greets dawn by challenging it to keep up. | core |
| gn-dune-raider | Dune Raider | C | R | Creature - Human, Raider | {2}{R} | 3/2 | warcry | He attacks the horizon because it keeps moving. | core |
| gn-bastet-claw-dancer | Bastet Claw-Dancer | C | R | Creature - Cat, Warrior | {2}{R} | 3/2 | firstBlade | Her ritual footwork is also a reliable combat lesson. | flex |
| gn-crocodile-wrestler | Crocodile Wrestler | C | R | Creature - Human, Wrestler | {3}{R} | 4/3 | warcry | The crocodile calls it sport; she calls it Tuesday. | core |
| gn-torch-bearer | Torch Bearer | C | R | Creature - Human, Attendant | {1}{R} | 2/1 | when this attacks: damage opponent 1 | He carries the flame and the blame. | flex |
| gn-red-sand-scourge | Red-Sand Scourge | C | R | Creature - Spirit, Warrior | {2}{R} | 3/3 | when this dies: damage opponent 1 | It leaves a footprint only where the sand is still angry. | flex |
| gn-funerary-drummer | Funerary Drummer | C | R | Creature - Human, Musician | {2}{R} | 2/3 | arrives: boost allYours +1/+0 until end of turn | The dead march better with a beat. | flex |
| gn-scarab-swarm-herder | Scarab Swarm Herder | C | R | Creature - Human, Handler | {3}{R} | 3/3 | when this attacks: createToken Golden Scarab | He whistles once and the floor becomes a moving carpet. | stretch (AI-risk) |
| gn-gold-mask-bruiser | Gold-Mask Bruiser | C | R | Creature - Mummy, Warrior | {4}{R} | 5/3 | none | The mask is heavy, but not heavier than his temper. | flex |
| gn-royal-chariot-hand | Royal Chariot Hand | C | R | Creature - Human, Driver | {2}{R} | 2/2 | arrives: boost allYours +1/+0 until end of turn | The horses are ceremonial until someone says run. | flex |
| gn-dawn-invocation | Dawn Invocation | C | R | Charm | {1}{R} | none | boost target +2/+0 and warcry until end of turn | A sunrise is just a battle cry with better lighting. | core |
| gn-burning-offering | Burning Offering | C | R | Ritual | {2}{R} | none | damage target creature 3 | The altar accepts wood, gold, or an enemy's bad decision. | core |
| gn-sandstorm-veil | Sandstorm Veil | C | R | Charm | {1}{R} | none | preventCombat; damage opponent 1 | The storm blocks the view and improves the odds. | flex |
| gn-cry-of-the-duat | Cry of the Duat | C | R | Ritual | {2}{R} | none | damage opponent 3 | The underworld has a voice and no indoor volume. | flex |
| gn-torch-lit-feast | Torch-Lit Feast | C | R | Ritual | {3}{R} | none | gainLife 3; boost allYours +1/+0 until end of turn | The living eat first, mostly because the dead complain. | stretch |
| gn-ash-to-gold | Ash to Gold | C | R | Charm | {2}{R} | none | destroy target artifact | Every relic has a breaking point and a resale value. | core |
| gn-sun-boat | Sun Boat | C | R | Artifact - Relic | {2} | none | arrives: damage opponent 1; Skim {2} | It sails across the sky on the strength of a good story. | flex |
| gn-red-clay-path | Red-Clay Path | C | R | Land | none | none | entersTapped; manaAbility R | The road is warm long after the sun has gone. | core |
| gn-cinnabar-obelisk | Cinnabar Obelisk | C | R | Artifact - Relic | {3} | none | arrives: boost target +1/+0 and warcry until end of turn | Its red stone remembers every procession it has outlasted. | flex |
| gn-lotus-garden-keeper | Lotus Garden Keeper | C | G | Creature - Human, Gardener | {1}{G} | 2/2 | arrives: gainLife 1 | She grows flowers in soil that has seen every ending. | core |
| gn-ibis-marsh-stalker | Ibis Marsh Stalker | C | G | Creature - Bird, Hunter | {2}{G} | 3/3 | wardingGaze | It watches the sky and the water with equal professional disappointment. | core |
| gn-bastet-grove-hunter | Bastet Grove Hunter | C | G | Creature - Cat, Hunter | {2}{G} | 3/2 | warcry | She leaps from the reeds before the prey has finished boasting. | core |
| gn-crocodile-bark-skin | Crocodile Bark-Skin | C | G | Creature - Crocodile, Guardian | {3}{G} | 4/4 | bulwark | The river made armor before the palace invented it. | core |
| gn-reedland-forager | Reedland Forager | C | G | Creature - Human, Forager | {2}{G} | 2/3 | arrives: fetchLand | He can find a field in a desert and lunch in a tomb. | flex |
| gn-desert-date-bearer | Desert Date Bearer | C | G | Creature - Human, Worker | {1}{G} | 2/2 | when this attacks: gainLife 1 | The dates are sweet, the route is not. | flex |
| gn-fertility-priestess | Fertility Priestess | C | G | Creature - Human, Priest | {3}{G} | 3/4 | arrives: gainLife 2 | She blesses the harvest and quietly judges the irrigation. | flex |
| gn-scarab-tender | Scarab Tender | C | G | Creature - Human, Handler | {2}{G} | 2/2 | arrives: createToken Golden Scarab | The smallest beetle in the garden still has a name. | flex |
| gn-granite-tomb-guard | Granite Tomb Guard | C | G | Creature - Mummy, Guardian | {4}{G} | 5/5 | bulwark | It has stood so long that the pyramid grew around it. | core |
| gn-green-sand-sentry | Green-Sand Sentry | C | G | Creature - Human, Guard | {2}{G} | 2/4 | sentinel | The reeds hide her silhouette and not her opinion. | flex |
| gn-riverbank-colossus | Riverbank Colossus | C | G | Creature - Crocodile, Giant | {5}{G} | 6/6 | none | The river moves around it out of professional courtesy. | flex |
| gn-lotus-crowned-adept | Lotus-Crowned Adept | C | G | Creature - Human, Mystic | {3}{G} | 3/3 | when this arrives, put a mark on it | The flower crowns a student who has survived the lesson. | flex |
| gn-garden-of-reeds | Garden of Reeds | C | G | Charm | {1}{G} | none | boost target +2/+2 | The garden is peaceful until you step on something sacred. | core |
| gn-hunt-of-the-jackal | Hunt of the Jackal | C | G | Ritual | {2}{G} | none | target creature you control fights target creature | The jackal does not care which side calls itself civilized. | core |
| gn-grave-bloom | Grave Bloom | C | G | Charm | {2}{G} | none | raise target creature from your graveyard to your hand | The flower opens when the soil has something to say. | flex |
| gn-sandroot-growth | Sandroot Growth | C | G | Ritual | {3}{G} | none | add two marks to target creature | A root can split stone if given enough moonlight. | flex |
| gn-garden-gate | Garden Gate | C | G | Land | none | none | entersTapped; manaAbility G | The vines open only for someone carrying water. | core |
| gn-crocodile-ford | Crocodile Ford | C | G | Land | none | none | entersTapped; manaAbility G | Cross quickly and do not compliment the locals. | flex |
| gn-temple-kitty-keeper | Temple Kitty Keeper | C | W | Creature - Cat, Acolyte | {2}{W} | 2/3 | sentinel; when this dies: gainLife 1 | She keeps the cats fed and the tourists nervous. | flex |
| gn-wind-over-reeds | Wind Over Reeds | C | U | Creature - Spirit, Scout | {2}{U} | 2/2 | skyborne; arrives: foresee 1 | It arrives as a breeze and leaves with your best secret. | flex |
| gn-crocodile-bone-reader | Crocodile Bone-Reader | C | B | Creature - Crocodile, Mystic | {2}{B} | 3/2 | when this dies: grind self 1 | The bones are old, the conclusions are immediate. | flex |
| gn-sun-baked-veteran | Sun-Baked Veteran | C | R | Creature - Human, Soldier | {2}{R} | 3/3 | when this attacks: damage opponent 1 | He has survived every dawn and plans to annoy the next one. | core |
| gn-date-palm-shelter | Date-Palm Shelter | C | G | Creature - Plant, Guardian | {2}{G} | 3/3 | when this arrives: gainLife 1 | The shade is generous, but the roots have territorial instincts. | flex |
| gn-gilded-canopic-box | Gilded Canopic Box | C | C | Artifact - Relic | {3} | none | Skim {2}; arrives: foresee 1 | It holds one secret, two handles, and an alarming amount of gold. | flex |

### R candidates: 60

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gn-weigher-of-white-feathers | Weigher of White Feathers | R | W | Creature - Human, Judge | {2}{W} | 2/4 | sentinel; arrives: foresee 1 | She can find a lie in a prayer and a prayer in a lie. | core |
| gn-bastet-lantern-guard | Bastet Lantern Guard | R | W | Creature - Cat, Guardian | {2}{W} | 3/2 | Nine Lives; wardingGaze | Her lantern is small, her claws are not. | core |
| gn-ivory-jackal-advocate | Ivory Jackal Advocate | R | W | Creature - Jackal, Lawyer | {3}{W} | 3/4 | when this arrives: gainLife 2 | He argues for mercy with the confidence of a paid professional. | flex |
| gn-queen-of-reeds | Queen of Reeds | R | W | Creature - Human, Noble | {4}{W} | 4/4 | sentinel; other creatures you control get +0/+1 | Her court survives because every servant knows where to stand. | flex |
| gn-lotus-court-chorister | Lotus Court Chorister | R | W | Creature - Human, Musician | {2}{W} | 2/3 | arrives: createToken Ka Guardian | Her hymn gives the dead a reason to queue. | flex |
| gn-scarab-ward-priest | Scarab Ward Priest | R | W | Creature - Human, Priest | {3}{W} | 3/3 | when this arrives: preventCombat | He places one beetle on the threshold and calls it a theology. | flex |
| gn-sun-plate-cavalier | Sun-Plate Cavalier | R | W | Creature - Human, Soldier | {3}{W} | 3/3 | firstBlade; when this attacks: boost another target +1/+1 | Her armor is polished enough to make an enemy reconsider. | flex |
| gn-canopic-oathkeeper | Canopic Oathkeeper | R | W | Creature - Mummy, Guardian | {4}{W} | 4/5 | Nine Lives | The jars are locked, the oath is older than the key. | core |
| gn-white-gold-archivist | White-Gold Archivist | R | W | Creature - Human, Scribe | {2}{W} | 2/3 | arrives: draw 1 if you control a mark | The archive rewards those who remember the footnotes. | stretch (AI-risk) |
| gn-golden-threaded-healer | Golden-Threaded Healer | R | W | Creature - Human, Healer | {1}{W} | 2/2 | bloodoath; arrives: gainLife 2 | Her needlework closes wounds and opens negotiations. | flex |
| gn-temple-steps | Temple Steps | R | W | Land | none | none | entersTapped; manaAbility W | The stairs are built for processions, not shortcuts. | core |
| gn-nilometer-seer | Nilometer Seer | R | U | Creature - Human, Seer | {2}{U} | 2/3 | arrives: foresee 2; Skim {2} | She measures the river and finds the future inconveniently high. | core |
| gn-deep-current-envoy | Deep-Current Envoy | R | U | Creature - Spirit, Envoy | {3}{U} | 3/3 | skyborne; when this arrives: draw 1 | It brings messages from beneath the river and never explains the handwriting. | flex |
| gn-ibis-sky-astrologer | Ibis Sky Astrologer | R | U | Creature - Bird, Astrologer | {3}{U} | 2/4 | skyborne; dawn: foresee 1 | The stars are old, but the ibis still corrects their arithmetic. | stretch (AI-risk) |
| gn-tomb-map-adept | Tomb-Map Adept | R | U | Creature - Human, Explorer | {2}{U} | 3/2 | arrives: fetchLand; Skim {2} | Her maps are accurate because she leaves before the trap closes. | flex |
| gn-shabti-whisperer | Shabti Whisperer | R | U | Creature - Human, Mystic | {3}{U} | 2/3 | when another creature you control dies: foresee 1 | She hears clay complain about the living. | stretch (AI-risk) |
| gn-moonlit-river-spirit | Moonlit River Spirit | R | U | Creature - Spirit | {4}{U} | 3/4 | skyborne; recall target creature when this arrives | It carries one traveler home and one regret back. | flex |
| gn-siltglass-observer | Siltglass Observer | R | U | Creature - Human, Seer | {1}{U} | 2/2 | wardingGaze; arrives: foresee 1 | The glass is cloudy, which is useful when the truth is worse. | flex |
| gn-blue-gold-scribe | Blue-Gold Scribe | R | U | Creature - Human, Scribe | {2}{U} | 2/3 | Skim {1}; when this attacks: foresee 1 | His notes are beautiful enough to distract from the debt. | flex |
| gn-underworld-ferryman | Underworld Ferryman | R | U | Creature - Spirit, Ferryman | {3}{U} | 3/3 | when this dies: raise it to the top of your deck | The fare is fair if you do not ask where the boat goes next. | stretch (AI-risk) |
| gn-canopic-recall | Canopic Recall | R | U | Charm | {2}{U} | none | recall target creature; foresee 1 | The jar remembers the shape of what it swallowed. | core |
| gn-lapis-causeway | Lapis Causeway | R | U | Land | none | none | entersTapped; manaAbility U | Blue stone makes a fine road for bad omens. | core |
| gn-jackal-court-bailiff | Jackal Court Bailiff | R | B | Creature - Jackal, Judge | {3}{B} | 4/3 | deathblade; arrives: severGrave 1 opponent | He carries the sentence and the shovel. | core |
| gn-mummy-royal-guard | Mummy Royal Guard | R | B | Creature - Mummy, Soldier | {3}{B} | 4/4 | Nine Lives | His uniform survived the kingdom and his patience did not. | core |
| gn-nameless-prince | Nameless Prince | R | B | Creature - Human, Noble | {2}{B} | 3/2 | Skim {1}; when this dies: opponent loses 2 life | He sold his name for a crown and calls it an upgrade. | flex |
| gn-scarab-casket-bearer | Scarab Casket-Bearer | R | B | Creature - Mummy, Servant | {2}{B} | 2/3 | arrives: createToken Golden Scarab; grind self 1 | He opens the casket only when the beetles are ready. | flex |
| gn-black-gold-taxer | Black-Gold Taxer | R | B | Creature - Human, Official | {3}{B} | 3/3 | when this arrives: opponent loses 2 life | The underworld has fees, surcharges, and a late-return penalty. | flex |
| gn-jackal-mask-usurper | Jackal-Mask Usurper | R | B | Creature - Human, Noble | {4}{B} | 5/3 | dreaded | He wears the judge's face until he can afford a better one. | core |
| gn-tomb-of-unspoken-names | Tomb of Unspoken Names | R | B | Enchantment | {3}{B} | none | dawn: grind self 1; opponent loses 1 life | The walls know everyone and answer no one. | stretch (AI-risk) |
| gn-weighing-the-heart | Weighing the Heart | R | B | Ritual | {3}{B} | none | destroy target creature with attack 3 or less; severGrave 1 opponent | The heart is light, the paperwork is not. | core |
| gn-severed-crown | Severed Crown | R | B | Artifact - Relic | {2} | none | arrives: add a mark to target creature; that creature loses Nine Lives until end of turn | A crown can rule a head long after it loses one. | flex |
| gn-dark-lotus-dues | Dark Lotus Dues | R | B | Charm | {1}{B} | none | target creature gets -3/-3 until end of turn | The lotus sends its bill with a very short deadline. | core |
| gn-catacomb-mouth | Catacomb Mouth | R | B | Land | none | none | entersTapped; manaAbility B | The opening looks like a smile until it starts charging rent. | core |
| gn-red-sand-duelist | Red-Sand Duelist | R | R | Creature - Human, Warrior | {2}{R} | 3/2 | firstBlade; warcry | She bows once, then makes the formalities brief. | core |
| gn-sun-scorch-adept | Sun-Scorch Adept | R | R | Creature - Human, Mage | {3}{R} | 3/3 | arrives: damage opponent 2 | He learned fire from the desert and manners from nobody. | flex |
| gn-bastet-flame-dancer | Bastet Flame-Dancer | R | R | Creature - Cat, Dancer | {2}{R} | 2/2 | warcry; when this attacks: damage target creature 1 | She turns every pounce into a public demonstration. | flex |
| gn-chariot-of-the-ninth-gate | Chariot of the Ninth Gate | R | R | Artifact - Relic | {4} | none | arrives: createToken Sun-Wake Acolyte; Skim {2} | It has nine wheels because eight would be optimistic. | flex |
| gn-grave-sun-berserker | Grave-Sun Berserker | R | R | Creature - Mummy, Warrior | {4}{R} | 5/3 | when this dies: damage opponent 2 | It gets angrier every time the bandages need replacing. | flex |
| gn-scarab-furnace | Scarab Furnace | R | R | Artifact - Relic | {3} | none | when a creature you control dies: damage opponent 1 | The furnace burns offerings and occasionally invoices. | stretch (AI-risk) |
| gn-saffron-banner-captain | Saffron Banner Captain | R | R | Creature - Human, Captain | {3}{R} | 3/3 | other creatures with Warcry get +1/+0 | Her banner smells like spice and imminent trouble. | core |
| gn-burning-papyrus | Burning Papyrus | R | R | Ritual | {2}{R} | none | damage target creature 4 | The scroll contains one sentence and an impressive amount of heat. | core |
| gn-ember-of-the-first-dawn | Ember of the First Dawn | R | R | Charm | {1}{R} | none | boost target +2/+0; damage opponent 1 | The first sunrise left a coal behind for anyone bold enough to steal it. | flex |
| gn-pharaohs-war-drum | Pharaoh's War Drum | R | R | Artifact - Relic | {3} | none | arrives: boost allYours +1/+0 and warcry until end of turn | The drumbeat tells the living where the dead are waiting. | flex |
| gn-cinder-delta | Cinder Delta | R | R | Land | none | none | entersTapped; manaAbility R | Red water runs hot beneath the black reeds. | core |
| gn-date-palm-stalwart | Date-Palm Stalwart | R | G | Creature - Human, Guardian | {2}{G} | 3/4 | bulwark; when this arrives: gainLife 2 | He has the patience of a tree and the reach of a debt collector. | core |
| gn-crocodile-grove-mauler | Crocodile Grove Mauler | R | G | Creature - Crocodile, Warrior | {4}{G} | 5/4 | overrun | It learned to charge by watching the river break its banks. | core |
| gn-reedland-mystic | Reedland Mystic | R | G | Creature - Human, Mystic | {2}{G} | 2/3 | arrives: put a mark on target creature you control | She grows power in tidy green increments. | flex |
| gn-lotus-marsh-elder | Lotus Marsh Elder | R | G | Creature - Human, Elder | {3}{G} | 3/4 | when this dies: raise target land from your graveyard to your hand | The marsh remembers every path and shares only one. | stretch (AI-risk) |
| gn-greenstone-colossus | Greenstone Colossus | R | G | Creature - Crocodile, Giant | {5}{G} | 6/6 | bulwark | It is less a creature than a piece of landscape with opinions. | core |
| gn-bastet-garden-keeper | Bastet Garden Keeper | R | G | Creature - Cat, Druid | {3}{G} | 3/3 | Nine Lives; arrives: gainLife 2 | The garden has thorns, cats, and a strict closing time. | core |
| gn-scarab-orchard-tender | Scarab Orchard Tender | R | G | Creature - Human, Gardener | {2}{G} | 2/3 | arrives: createToken Golden Scarab | He raises beetles on dates and dates on beetle-rich soil. | flex |
| gn-riverbank-longstep | Riverbank Longstep | R | G | Creature - Human, Scout | {2}{G} | 3/3 | sentinel; fetchLand when this attacks | She can cross a flood without losing the thread of an argument. | flex |
| gn-rooted-canopic-titan | Rooted Canopic Titan | R | G | Creature - Mummy, Giant | {4}{G} | 5/5 | when this dies: add two marks to target creature you control | The jars became roots, and the roots became a throne. | flex |
| gn-garden-of-unending-sand | Garden of Unending Sand | R | G | Enchantment | {3}{G} | none | dawn: gainLife 2; if you control a mark, foresee 1 | It blooms only when the court has forgotten to be cynical. | stretch (AI-risk) |
| gn-verdant-causeway | Verdant Causeway | R | G | Land | none | none | entersTapped; manaAbility G | The green road crosses a place where the desert should have won. | core |
| gn-sunlit-court-duelist | Sunlit Court Duelist | R | W/R | Creature - Human, Warrior | {2}{W}{R} | 3/3 | firstBlade; warcry | She treats the royal audience as a very large set of witnesses. | flex |
| gn-lapis-jackal-astrologer | Lapis Jackal Astrologer | R | U/B | Creature - Jackal, Astrologer | {3}{U}{B} | 3/3 | deathblade; arrives: foresee 2 | It reads the stars for omens and the bones for footnotes. | stretch (AI-risk) |
| gn-scarlet-delta-raider | Scarlet Delta Raider | R | R/G | Creature - Human, Raider | {3}{R}{G} | 4/4 | warcry; overrun | She brings a red boat into green reeds and calls that diplomacy. | core |
| gn-lotus-rose-advocate | Lotus-Rose Advocate | R | W/G | Creature - Human, Priest | {2}{W}{G} | 3/4 | sentinel; arrives: gainLife 3 | Her mercy is genuine and backed by a very large staff. | flex |
| gn-gilded-river-cantor | Gilded River Cantor | R | W/U | Creature - Spirit, Musician | {2}{W}{U} | 2/4 | skyborne; arrives: foresee 1 and createToken Ka Guardian | The song gives the river a route through the palace. | flex |

### SR candidates: 18

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gn-maat-feather-regent | Maat's Feather Regent | SR | W | Legendary Creature - Human, Judge | {3}{W}{W} | 4/5 | sentinel; Nine Lives; when this returns with Nine Lives, gainLife 3 | Her feather is light enough to float and heavy enough to end a dynasty. | core |
| gn-bastet-golden-claw | Bastet, Golden Claw | SR | W | Legendary Creature - Cat, Guardian | {3}{W}{W} | 4/4 | firstBlade; Nine Lives; other Cats get +1/+1 | She guards the shrine with one paw and the city with the other. | core |
| gn-feather-of-return | Feather of Return | SR | W | Artifact - Relic | {3} | none | arrives: put a mark on target creature; that creature gains Nine Lives until end of turn | A single feather can reopen a verdict. | flex |
| gn-thoth-inkkeeper | Thoth, Inkkeeper | SR | U | Legendary Creature - Bird, God | {3}{U}{U} | 3/4 | skyborne; arrives: foresee 3 and draw 1 | His ledger contains the first draft of every ending. | core |
| gn-river-of-names | River of Names | SR | U | Ritual | {3}{U} | none | draw 2; foresee 2; Retell {4}{U} | The river gives back every name, but not necessarily in order. | core |
| gn-deep-nile-oracle | Deep Nile Oracle | SR | U | Creature - Spirit, Oracle | {4}{U} | 4/4 | skyborne; when this dies: foresee 3 | She has seen the bottom of the river and refuses to discuss it. | flex |
| gn-jackal-weigher | Jackal Weigher | SR | B | Legendary Creature - Jackal, Judge | {3}{B}{B} | 4/4 | deathblade; Nine Lives; when this damages a player, severGrave 1 opponent | He weighs hearts by the sound they make when dropped. | core |
| gn-royal-mummy-astronomer | Royal Mummy Astronomer | SR | B | Creature - Mummy, Mystic | {3}{B} | 3/4 | arrives: grind self 3; when this dies: opponent loses 2 life | The stars have not moved, but his burial schedule certainly has. | flex |
| gn-gold-in-the-mouth | Gold in the Mouth | SR | B | Enchantment - Aura | {2}{B} | none | attached: -3/-3; when attached creature dies, opponent loses 3 life | The coin is payment for silence and a souvenir of the mistake. | core |
| gn-red-dawn-pharaoh | Red-Dawn Pharaoh | SR | R | Legendary Creature - Mummy, Pharaoh | {4}{R}{R} | 5/4 | warcry; arrives: damage target creature 3 | He rose at dawn to find that the empire had gotten smaller. | core |
| gn-scarab-sun-eater | Scarab Sun-Eater | SR | R | Creature - Scarab, Horror | {4}{R} | 5/4 | overrun; when this attacks, createToken Golden Scarab | It eats the sun one shining bite at a time. | flex |
| gn-bastet-spear-dancer | Bastet Spear-Dancer | SR | W/R | Legendary Creature - Cat, Warrior | {3}{W}{R} | 4/3 | firstBlade; warcry; Nine Lives | Her dance has nine steps and every step has a target. | core |
| gn-osirian-grove-warden | Osirian Grove Warden | SR | G | Legendary Creature - Human, God | {4}{G}{G} | 5/5 | sentinel; Nine Lives; arrives: gainLife 4 | He cultivates a garden where the dead may rest without being idle. | core |
| gn-lotus-crowned-giant | Lotus-Crowned Giant | SR | G | Creature - Mummy, Giant | {5}{G} | 6/6 | Tribute 2; overrun; when this arrives: add a mark to it | The lotus grows from his crown because even stone needs a season. | core |
| gn-greenbank-ancestor | Greenbank Ancestor | SR | G | Creature - Spirit, Elder | {3}{G} | 4/4 | when this dies: createToken Reed Colossus; raise target land from your graveyard to your hand | The riverbank remembers his footsteps and makes room for one more. | flex |
| gn-judge-of-two-horizons | Judge of Two Horizons | SR | W/B | Legendary Creature - Jackal, Judge | {3}{W}{B} | 4/5 | deathblade; sentinel; when a creature with Nine Lives returns, opponent loses 2 life | He keeps one scale for the living and one for everyone else. | core |
| gn-canal-of-twin-moons | Canal of Twin Moons | SR | U/G | Legendary Creature - Crocodile, Mystic | {3}{U}{G} | 4/4 | skyborne; arrives: fetchLand and foresee 2; Skim {2} | Two moons make a longer reflection and a shorter route. | flex |
| gn-sand-and-shadow-priest | Sand and Shadow Priest | SR | B/G | Legendary Creature - Human, Priest | {3}{B}{G} | 4/4 | Tribute 1; when this arrives: grind self 2 and createToken Jackal Bailiff | The priest offers a little darkness and receives a great deal more. | flex |

### SSR candidates: 14

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gn-bastet-queen-of-the-night | Bastet, Queen of the Night | SSR | W/B | Legendary Creature - Cat, God | {4}{W}{B} | 5/5 | Nine Lives; sentinel; when this returns with Nine Lives, createToken Ka Guardian x2 | She owns the moonlit gate and lets the worthy pretend they found it. | core |
| gn-keeper-of-the-feather | Keeper of the Feather | SSR | W | Legendary Creature - Human, Judge | {4}{W}{W} | 5/5 | sentinel; other creatures with marks get +1/+1; when a marked creature dies, gainLife 2 | The feather is a key, a scale, and a warning against overeating. | core |
| gn-palace-of-a-thousand-doors | Palace of a Thousand Doors | SSR | W | Enchantment | {4}{W} | none | at dawn choose one: createToken Ka Guardian x2 or preventCombat and gainLife 3 | Every door leads somewhere useful, provided the palace likes you today. | stretch (AI-risk) |
| gn-scribe-of-the-hidden-sun | Scribe of the Hidden Sun | SSR | U | Legendary Creature - Human, Scribe | {4}{U}{U} | 4/5 | skyborne; arrives: foresee 4; dawn: draw 1 | He keeps a second sun in a locked drawer for difficult mornings. | core |
| gn-nile-without-end | Nile Without End | SSR | U/G | Legendary Creature - River, Spirit | {4}{U}{G} | 5/6 | skyborne; arrives: fetchLand and foresee 3; when this dies: raise target creature to its owner's hand | The river does not loop. It simply refuses to admit that it stopped. | flex |
| gn-lord-of-the-blackened-crown | Lord of the Blackened Crown | SSR | B | Legendary Creature - Mummy, Pharaoh | {5}{B}{B} | 6/5 | Tribute 3; dreaded; when this arrives: opponent severs 2 cards from their graveyard | He offers no mercy because he has already itemized it. | core |
| gn-mummy-king-in-gold | Mummy King in Gold | SSR | B | Legendary Creature - Mummy, King | {4}{B}{B} | 5/5 | Nine Lives; deathblade; when this returns with Nine Lives, opponent loses 4 life | The bandages are royal, the temper is hereditary. | core |
| gn-hunger-beneath-the-pyramid | Hunger Beneath the Pyramid | SSR | B | Ritual | {5}{B} | none | massDestroy all creatures; severGrave 1 each opponent; Retell {7}{B} | The pyramid opens one mouth and the battlefield becomes very quiet. | core |
| gn-sun-scarab-emperor | Sun-Scarab Emperor | SSR | R | Legendary Creature - Scarab, God | {5}{R}{R} | 6/5 | warcry; overrun; when this attacks: damage opponent 2 | It wears the sun as a shell and considers shadows a personal insult. | core |
| gn-bastet-at-the-red-gate | Bastet at the Red Gate | SSR | W/R | Legendary Creature - Cat, Guardian | {4}{W}{R} | 5/4 | firstBlade; Nine Lives; other Cats get warcry | The gate opens when she smiles and closes when she stops. | flex |
| gn-crocodile-god-of-reeds | Crocodile God of Reeds | SSR | G | Legendary Creature - Crocodile, God | {5}{G}{G} | 7/7 | Tribute 2; bulwark; when this arrives: createToken Reed Colossus | He is patient enough to let a dynasty build itself around his teeth. | core |
| gn-sandstorm-of-the-dead | Sandstorm of the Dead | SSR | G | Ritual | {4}{G}{G} | none | damage each opposing creature 3; raise a creature from your graveyard to your hand | The desert remembers every footprint and sends them back together. | flex |
| gn-weigher-of-all-kings | Weigher of All Kings | SSR | W/B | Legendary Creature - Jackal, Judge | {5}{W}{B} | 6/6 | Tribute 2; deathblade; when this arrives: destroy target tapped creature and gainLife 4 | He weighs crowns, hearts, and the occasional bad excuse. | core |
| gn-duat-tide-tribunal | Duat Tide Tribunal | SSR | U/B | Enchantment | {4}{U}{B} | none | at dawn, if an opponent has fewer cards in their graveyard than you, grind self 2 and draw 1; otherwise opponent severs 2 cards from their graveyard | The tribunal always finds a way to make the river's accounting worse. | stretch (AI-risk) |

### UR candidates: 8

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gn-bastet-golden-moon | Bastet, Golden Moon | UR | W/U | Legendary Creature - Cat, God | {5}{W}{U} | 5/5 | skyborne; Nine Lives; arrives: foresee 3 and createToken Ka Guardian x2 | She walks the moon's gold road like it was built for her paws. | core |
| gn-jackal-god-of-the-last-gate | Jackal God of the Last Gate | UR | B/G | Legendary Creature - Jackal, God | {6}{B}{G} | 7/7 | Tribute 3; dreaded; deathblade; when this arrives: severGrave 3 opponent | The last gate has a keeper, a queue, and no appeals process. | core |
| gn-throne-of-quiet-stars | Throne of Quiet Stars | UR | C | Artifact - Relic | {7} | none | arrives: createToken Golden Scarab x3; at dawn, put a mark on each creature you control | The throne is empty because the stars are still deciding who deserves it. | flex |
| gn-scarab-lord-of-dawn | Scarab Lord of Dawn | UR | R/G | Legendary Creature - Scarab, God | {5}{R}{G} | 6/6 | Tribute 2; warcry; overrun; when this attacks: damage opponent 3 | Dawn does not break over the desert. It answers to him. | core |
| gn-maat-weighs-the-sun | Maat Weighs the Sun | UR | W/B | Legendary Creature - Human, God | {4}{W}{B} | 5/6 | sentinel; Nine Lives; when this arrives: destroy target creature with attack 4 or less; gainLife 4 | The sun rises because the scales permit it. | core |
| gn-thoth-keeper-of-names | Thoth, Keeper of Names | UR | U/B | Legendary Creature - Bird, God | {5}{U}{B} | 4/7 | skyborne; arrives: draw 2 and foresee 4; when this attacks: severGrave 2 opponent | He knows the true name of every god and uses none of them at parties. | flex |
| gn-royal-mummy-of-the-first-dawn | Royal Mummy of the First Dawn | UR | B | Legendary Creature - Mummy, Pharaoh | {7}{B} | 8/8 | Tribute 3; Nine Lives; when this returns with Nine Lives, damage each opponent 3 | The first ruler buried beneath the sun has finally found a reason to stand. | core |
| gn-nile-that-remembers | Nile That Remembers | UR | U/G | Legendary Creature - River, Spirit | {6}{U}{G} | 6/7 | skyborne; when this arrives: raise up to two target creatures from your graveyard to your hand and fetchLand; dawn: foresee 2 | The river remembers every life and charges interest in stories. | stretch (AI-risk) |

## Set-unique token proposals

| Token ID | Name | Color | Type | Stats | Token text | Where it appears |
| --- | --- | --- | --- | --- | --- | --- |
| gn-token-ka-guardian | Ka Guardian | W | Creature - Spirit, Guardian | 1/1 | sentinel | Starlit Procession, Lotus Court Chorister, Gilded River Cantor, Bastet legends, Throne of Quiet Stars |
| gn-token-jackal-bailiff | Jackal Bailiff | B | Creature - Jackal, Judge | 2/2 | when this arrives: opponent loses 1 life | Sand and Shadow Priest |
| gn-token-golden-scarab | Golden Scarab | C | Artifact Creature - Scarab | 1/1 | when this dies: foresee 1 | Scarab Swarm Herder, Scarab Casket-Bearer, Scarab cards, Throne of Quiet Stars |
| gn-token-sun-wake-acolyte | Sun-Wake Acolyte | R | Creature - Human, Acolyte | 2/1 | warcry | Chariot of the Ninth Gate |
| gn-token-reed-colossus | Reed Colossus | G | Creature - Plant, Guardian | 0/4 | bulwark | Splitting Date, Greenbank Ancestor, Crocodile God of Reeds |

## Precon identity

**Last Procession** is a W/B/G midrange sacrifice deck. It starts with efficient 2/2 and 3/3 bodies, uses white judgment and black weakening to keep attacks honest, and turns expendable creatures into Tribute payments for a small package of god-tier finishers. Nine Lives lets Bastet guardians and mummified royalty trade aggressively without making every turn depend on a graveyard puzzle. The win route is a broad board of sturdy commons followed by a Tribute god, then a mark-backed attack through sentinel, bloodoath, and overrun bodies. It should be a real combat deck with direct answers, not a slow pile that waits for an engine to assemble.

## Gauntlet boss concepts

- **The Jackal Crown** (rung 19, B/G): a greedy Tribute midrange boss that trades cheap Mummies and Jackal Bailiffs into a 7/7 god, then uses deathblade and severGrave to deny recovery. One line: every offering has teeth, and the crown knows exactly where to bite.
- **Bastet, Lady of Nine Doors** (rung 20, W/B): a resilient Cat control boss that attacks with Nine Lives guardians, protects its best creature with white combat prevention, and wins through repeated marked returns. One line: the first door is a temple, the ninth is a throne, and she has the keys to all of them.

## Selection notes

### Ten candidates to protect first

1. **Bastet Litter Guard**: a rate-efficient common that makes Nine Lives visible from the first game.
2. **Judge's Verdict**: a clean common answer that rewards attacking and blocking without being universal removal.
3. **Underworld Cartographer**: a common body with useful smoothing that helps the precon cast its curve.
4. **Jackal Grave Scout**: a common 3/2 with Deathblade that makes black combat matter.
5. **Mummy's Bailiff**: the simplest common demonstration of automatic Nine Lives value.
6. **Bastet, Golden Claw**: a focused Cat legend with a clear board plan and a strong visual identity.
7. **Jackal Weigher**: a black marquee that turns combat damage into graveyard pressure without a loop.
8. **Lotus-Crowned Giant**: the cleanest SR Tribute test, with a visible cost and a satisfying body.
9. **Lord of the Blackened Crown**: the god-tier Tribute payoff that tells the set's central story in one card.
10. **Bastet, Golden Moon**: the UR that joins Nine Lives, a Cat identity, and a board-building arrival in one legible package.

### Three biggest design risks

1. **Nine Lives state complexity**: one-use return state, marks, token deaths, and copied or stolen creatures must not create repeat-return loops or ambiguous timing.
2. **Tribute affordability and sacrifice value**: a greedy AI may pay too eagerly, while a human may refuse every god if the board tax is too high. The engine needs a clear additional-cost check and balance testing across curve positions.
3. **Too much recursive setup**: grind, foresee, raise, marks, and dawn triggers can turn the underworld into a durdle pile. The final 120 must preserve the efficient common bodies, the answer suite, and a fast enough combat route.
