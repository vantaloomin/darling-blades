<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# Core Set II: Crown and Olympus

## Set Identity

Core Set II is the 2.0 anniversary homecoming. The first Three Kingdoms and Olympus worlds return with deeper rosters: new Wei, Wu, Shu, and Jin officers stand beside a larger court of Olympian gods, with marble beside lacquer, gold beside crimson, and old rivalries given adult, glamorous faces. The set is about a familiar battlefield becoming politically crowded. A young officer can seize a moment, a god can make the moment legendary, and every faction has a reason to contest the center.

**The Mandate** is one shared Crown state. One player may hold the Crown at a time. The holder draws one extra card at each dawn. When combat damage is dealt to the holder, the player who dealt that damage takes the Crown. Candidate cards either claim an unheld Crown, reward its current holder, or make attacking the holder attractive. This fits the engine as one deterministic player-level holder flag plus a combat-resolution transfer event. It is also clean for the AI: identify the Crown holder, attack that player when profitable, and take the free draw when the Crown is unclaimed.

**Oaths** are leader checks that reward controlling a legendary leader from the matching faction. An Oath clause is written as `Oath: while you control a legendary [leader], [effect]`; it never asks the player to remember a hidden promise or make a delayed choice. This expresses formation, loyalty, and the Darlings format through a visible board condition. Engine-first implementation needs a current-board subtype or leader check, with the effect resolved immediately on arrival, attack, dawn, or the listed event. The AI can value the same clause as a simple controlled-leader bonus.

The candidate pool deliberately favors attacks, automatic triggers, marks, Foresee, Sever, board answers, and clean Oath payoffs. Multi-turn sequencing or narrow board-state puzzles are marked `(AI-risk)`. The shipping target is 120 cards at `60 C / 36 R / 11 SR / 8 SSR / 5 UR`; this overplan supplies 200 candidates at `100 C / 60 R / 18 SR / 14 SSR / 8 UR`.

## Candidate Table

The `Cut` column is a selection priority. `core` means the set identity or a healthy limited environment needs the slot. `flex` means the card is a strong candidate with a replaceable role. `stretch` means the card is deliberately spicy or narrow. The shorthand `claims Crown if unheld` uses The Mandate state defined above. Every creature row includes a subtype and stats.

### Commons

| ID | Name | Rarity | Colors | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| c2-wei-banner-page | Wei Banner Page | C | W | Creature • Human Officer | {W} | 2/1 | Oath: while you control a legendary Officer, gainLife 1 when this arrives | The first hand on the standard is steadier than it looks. | core |
| c2-lacquer-shieldbearer | Lacquer Shieldbearer | C | W | Creature • Human Guard | {2}{W} | 3/3 | Oath: while you control a legendary leader, this gets +0/+1 | Its lacquer is bright enough to make arrows reconsider. | core |
| c2-shu-road-medic | Shu Road Medic | C | W | Creature • Human Officer | {1}{W} | 2/2 | When this arrives, gainLife 2 | She carries bandages, maps, and no patience for heroic posing. | core |
| c2-jin-court-scribe | Jin Court Scribe | C | W | Creature • Human Scholar | {2}{W} | 2/3 | When this arrives, Foresee 1 | The archive has a chair for every victor and a correction for each. | flex |
| c2-marble-olive-acolyte | Marble-Olive Acolyte | C | W | Creature • Human Priest | {2}{W} | 3/2 | bloodoath | Her blessing is practical, brief, and usually delivered mid-swing. | core |
| c2-terrace-shieldbearer | Terrace Shieldbearer | C | W | Creature • Human Guard | {3}{W} | 3/4 | sentinel | The high steps need a guard who does not blink at thunder. | core |
| c2-crown-processioner | Crown Processioner | C | W | Creature • Human Officer | {4}{W} | 4/4 | When this arrives, claim the Crown if unheld | The procession is ceremonial until nobody else has the Crown. | core |
| c2-olympian-lancebearer | Olympian Lancebearer | C | W | Creature • Human Hoplite | {2}{W} | 2/2 | firstBlade | Marble schools teach posture first and mercy never. | core |
| c2-gate-law | Gate Law | C | W | Charm | {1}{W} | none | Sever target creature with attack 2 or less | Every gate has a law, and this one has a very short appeal period. | core |
| c2-marble-verdict | Marble Verdict | C | W | Ritual | {3}{W} | none | Sever target creature with attack 4 or more | The verdict is carved before the argument reaches the steps. | core |
| c2-oath-litany | Oath Litany | C | W | Charm | {1}{W} | none | Oath: while you control a legendary leader, draw 1; otherwise gainLife 2 | A loyal court receives either counsel or consolation. | core |
| c2-crown-ward | Crown Ward | C | W | Charm | {2}{W} | none | PreventCombat; if you hold the Crown, gainLife 2 | The ward is a shield for the ruler and a warning to the room. | core |
| c2-wei-white-banner | Wei White Banner | C | W | Artifact | {2}{W} | none | When this arrives, boost target creature +1/+1; Oath grants it sentinel until end of turn | A square of white silk can turn a retreat into a formation. | flex |
| c2-olive-votive | Olive Votive | C | W | Artifact | {1}{W} | none | When this arrives, Foresee 1; if you hold the Crown, gainLife 1 | The little lamp burns for whoever can keep the hall. | flex |
| c2-lacquer-oath | Lacquer Oath | C | W | Enchantment | {2}{W} | none | Oath: your other Officers get +0/+1 | A promise painted on wood lasts longer than a promise spoken. | flex |
| c2-court-of-open-hands | Court of Open Hands | C | W | Enchantment | {3}{W} | none | (AI-risk) At each dawn, gainLife 1; if the Crown is unheld, claim it | Hospitality is a political weapon with excellent table manners. | stretch |
| c2-white-parade-ground | White Parade Ground | C | W | Land | none | none | Enters tapped; manaAbility W | Fresh banners make old stones look newly loyal. | core |
| c2-wei-gatehouse | Wei Gatehouse | C | W | Land | none | none | Enters tapped; manaAbility W | The gate opens for allies and remembers everyone else. | core |
| c2-shu-riverford | Shu Riverford | C | W | Land | none | none | Enters tapped; manaAbility W | Ferrymen here can identify a regiment by its silence. | flex |
| c2-olympian-steps | Olympian Steps | C | W | Land | none | none | Enters tapped; manaAbility W | Every stair leads upward, even when the gods are watching. | core |
| c2-wu-river-scout | Wu River Scout | C | U | Creature • Human Scout | {1}{U} | 2/1 | skyborne | She knows which current is dangerous because she has tried them all. | core |
| c2-inkstone-adept | Inkstone Adept | C | U | Creature • Human Scholar | {1}{U} | 2/2 | When this arrives, Foresee 1 | His notes are tiny, exact, and written during the loudest battles. | core |
| c2-shu-river-courier | Shu River Courier | C | U | Creature • Human Officer | {2}{U} | 3/2 | skyborne | The message arrives before the messenger admits it was urgent. | core |
| c2-jin-tide-scholar | Jin Tide Scholar | C | U | Creature • Human Scholar | {3}{U} | 3/3 | Oath: while you control a legendary leader, Foresee 1 when this arrives | She studies tides because court schedules are less reliable. | flex |
| c2-cloud-pavilion-herald | Cloud Pavilion Herald | C | U | Creature • Human Herald | {2}{U} | 2/3 | skyborne | A silver voice carries farther than a bronze horn. | core |
| c2-crown-river-clerk | Crown River Clerk | C | U | Creature • Human Officer | {3}{U} | 3/3 | When this arrives, if you hold the Crown, draw 1 | The ledger has a line for the Crown and three for its inconveniences. | core |
| c2-olympian-star-reader | Olympian Star-Reader | C | U | Creature • Human Oracle | {4}{U} | 4/4 | skyborne; Foresee 1 when this arrives | The constellations are clearer when the gods have stopped arguing. | flex |
| c2-wu-lacquer-diver | Wu Lacquer Diver | C | U | Creature • Human Scout | {2}{U} | 2/3 | wardingGaze | She watches the sky from beneath the water and is rarely surprised. | core |
| c2-echoing-decree | Echoing Decree | C | U | Charm | {1}{U} | none | Recall target creature or artifact | A decree repeated by the right people becomes a current. | core |
| c2-calm-before-court | Calm Before Court | C | U | Charm | {2}{U} | none | PreventCombat; Foresee 1 | Even Olympus takes a breath before the verdict. | core |
| c2-inkstone-cancel | Inkstone Cancel | C | U | Charm | {2}{U} | none | Cancel target spell | The correction mark lands before the ink is dry. | core |
| c2-tide-of-omens | Tide of Omens | C | U | Ritual | {3}{U} | none | Draw 2; Foresee 1 | The river answers two questions and asks for a better third. | flex |
| c2-oath-of-bells | Oath of Bells | C | U | Enchantment | {1}{U} | none | Oath: at each dawn, Foresee 1 | A leader who keeps the bell ringing keeps the court awake. | flex |
| c2-river-mirror | River Mirror | C | U | Artifact | {2}{U} | none | When this arrives, Foresee 2 | Its reflection shows the next mistake with unusual courtesy. | core |
| c2-skybridge-lens | Skybridge Lens | C | U | Artifact | {3}{U} | none | At each dawn, if you hold the Crown, draw 1 | The lens makes the Crown look close enough to lose. | stretch |
| c2-wu-water-seal | Wu Water Seal | C | U | Artifact | {1}{U} | none | Skim {1}; when this arrives, Foresee 1 | The seal travels hand to hand and never gets wet. | flex |
| c2-wu-watchtower | Wu Watchtower | C | U | Land | none | none | Enters tapped; manaAbility U | A tower over water is still a tower over trouble. | core |
| c2-inkstone-isle | Inkstone Isle | C | U | Land | none | none | Enters tapped; manaAbility U | The island leaves dark fingerprints on every map. | core |
| c2-cloud-court | Cloud Court | C | U | Land | none | none | Enters tapped; manaAbility U | Petitions rise here and sometimes come back as rain. | flex |
| c2-three-rivers-mouth | Three Rivers Mouth | C | U | Land | none | none | Enters tapped; manaAbility U | All three currents carry a different version of the truth. | core |
| c2-jin-night-registrar | Jin Night Registrar | C | B | Creature • Human Officer | {1}{B} | 2/2 | When this arrives, grind 1 | He files the dead by cause, allegiance, and how loudly they complained. | core |
| c2-wei-iron-censor | Wei Iron Censor | C | B | Creature • Human Officer | {2}{B} | 3/2 | deathblade | Her seal is black, square, and applied to very real targets. | core |
| c2-shu-grave-warden | Shu Grave Warden | C | B | Creature • Human Guard | {2}{B} | 2/3 | bloodoath | He guards the road home because the road there is already crowded. | core |
| c2-wu-knife-envoy | Wu Knife Envoy | C | B | Creature • Human Officer | {3}{B} | 4/3 | firstBlade | Diplomacy is a blade with a longer introduction. | core |
| c2-ashen-mandate-agent | Ashen Mandate Agent | C | B | Creature • Human Officer | {2}{B} | 3/2 | When this arrives, if an opponent holds the Crown, that player losesLife 1 | She collects the Crown's tax without waiting for permission. | core |
| c2-olympian-underworld-attendant | Olympian Underworld Attendant | C | B | Creature • Human Servant | {3}{B} | 3/3 | deathblade | The underworld keeps a second shift for mortal heroes. | core |
| c2-crown-tax-collector | Crown Tax Collector | C | B | Creature • Human Officer | {4}{B} | 4/4 | When this arrives, an opponent losesLife 2 | The Crown is shared, but its paperwork is not. | flex |
| c2-jin-obsidian-guard | Jin Obsidian Guard | C | B | Creature • Human Guard | {2}{B} | 2/2 | bulwark; deathblade | The guard stands still so the threat can stand closer. | core |
| c2-night-severance | Night Severance | C | B | Charm | {1}{B} | none | Sever target creature with attack 2 or less | The dark takes small targets first and asks questions later. | core |
| c2-iron-censors-order | Iron Censor's Order | C | B | Ritual | {3}{B} | none | Sever target creature; you loseLife 2 | The order is effective, expensive, and signed in iron. | core |
| c2-oath-of-ashes | Oath of Ashes | C | B | Charm | {2}{B} | none | Oath: target opponent losesLife 3; otherwise that player losesLife 1 and you gainLife 1 | Loyalty can turn a whisper into a sentence. | core |
| c2-grave-accounting | Grave Accounting | C | B | Ritual | {2}{B} | none | Grind 3; draw 1 | The dead leave records even when the living burn them. | flex |
| c2-black-crown-audit | Black Crown Audit | C | B | Enchantment | {1}{B} | none | At each dawn, if an opponent holds the Crown, that player losesLife 1 | The auditor smiles whenever the Crown changes hands. | core |
| c2-ashen-tablet | Ashen Tablet | C | B | Artifact | {2}{B} | none | When this arrives, grind 2 | Every dynasty keeps a tablet for names it wishes were forgotten. | flex |
| c2-jin-blood-seal | Jin Blood Seal | C | B | Artifact | {1}{B} | none | When this arrives, boost target creature +1/+0 and gainLife 1 | The seal opens a vein in the enemy plan. | flex |
| c2-underworld-offering | Underworld Offering | C | B | Enchantment | {3}{B} | none | When this arrives, gainLife 2; Oath grants your leader deathblade until end of turn | The offering is accepted before anyone admits who made it. | stretch |
| c2-night-market | Night Market | C | B | Land | none | none | Enters tapped; manaAbility B | Every lantern here has a price and a witness. | core |
| c2-jin-river-gate | Jin River Gate | C | B | Land | none | none | Enters tapped; manaAbility B | The gate opens at dusk and remembers the last face through it. | core |
| c2-ashen-catacomb | Ashen Catacomb | C | B | Land | none | none | Enters tapped; manaAbility B | Smoke settles here as if it owns the stone. | flex |
| c2-obsidian-road | Obsidian Road | C | B | Land | none | none | Enters tapped; manaAbility B | The road is black because travelers keep leaving it that way. | core |
| c2-wu-fireboat-raider | Wu Fireboat Raider | C | R | Creature • Human Raider | {1}{R} | 2/1 | warcry | She steers toward the cannon smoke because it is more honest than court. | core |
| c2-wei-red-sash-veteran | Wei Red-Sash Veteran | C | R | Creature • Human Officer | {2}{R} | 3/2 | firstBlade | The red sash marks experience, not patience. | core |
| c2-shu-hill-courier | Shu Hill Courier | C | R | Creature • Human Rider | {2}{R} | 3/2 | warcry | A message carried uphill arrives with its own momentum. | core |
| c2-jin-brass-drummer | Jin Brass Drummer | C | R | Creature • Human Musician | {3}{R} | 4/3 | warcry | The drumbeat makes retreat sound embarrassingly slow. | core |
| c2-olympian-forge-runner | Olympian Forge-Runner | C | R | Creature • Human Artisan | {2}{R} | 3/2 | warcry | She leaves the forge with sparks in her hair and a route to the front. | core |
| c2-crown-chaser | Crown Chaser | C | R | Creature • Human Raider | {3}{R} | 3/3 | When this attacks an opponent who holds the Crown, damage that player 1 | The Crown is not a prize to her, only a direction. | core |
| c2-wu-crimson-standard | Wu Crimson Standard | C | R | Creature • Human Officer | {4}{R} | 4/4 | firstBlade | The banner is crimson so the enemy can see exactly what is coming. | core |
| c2-marble-hoplite | Marble Hoplite | C | R | Creature • Human Hoplite | {2}{R} | 2/2 | sentinel | Olympus calls it discipline when a spear refuses to move. | flex |
| c2-sunlit-barrage | Sunlit Barrage | C | R | Charm | {1}{R} | none | Damage target 2 | The sun does not need a warrant to find the guilty. | core |
| c2-ember-law | Ember Law | C | R | Ritual | {2}{R} | none | Damage target 3 | The court's final argument leaves a mark on the stones. | core |
| c2-oath-of-flame | Oath of Flame | C | R | Charm | {1}{R} | none | Oath: boost target creature +2/+0 and grant warcry until end of turn; otherwise boost +1/+0 | A sworn ally gets the first spark and the loudest entrance. | core |
| c2-crown-breakers-call | Crown-Breaker's Call | C | R | Ritual | {3}{R} | none | Damage an opponent 3; if that player holds the Crown, Foresee 1 | The call goes out when the Crown becomes too comfortable. | core |
| c2-red-lacquer-banner | Red Lacquer Banner | C | R | Artifact | {2}{R} | none | When this arrives, boost your creatures +1/+0 until end of turn | Red lacquer catches firelight and turns a line into a charge. | core |
| c2-olympian-anvil | Olympian Anvil | C | R | Artifact | {3}{R} | none | When this arrives, damage target 2 | The gods made a hammer for arguments that would not stay verbal. | flex |
| c2-wu-war-drum | Wu War Drum | C | R | Enchantment | {2}{R} | none | Your other creatures get +1/+0 while you hold the Crown | The drum is a promise that the Crown can hear. | flex |
| c2-cinder-offering | Cinder Offering | C | R | Artifact | {1}{R} | none | Skim {1}; when this leaves your hand, damage an opponent 1 | Even a small ember can report a change in leadership. | stretch |
| c2-red-terrace | Red Terrace | C | R | Land | none | none | Enters tapped; manaAbility R | The terrace is built for speeches and sudden departures. | core |
| c2-wu-river-port | Wu River Port | C | R | Land | none | none | Enters tapped; manaAbility R | Boats leave at dawn whether the admiral is ready or not. | core |
| c2-olympian-forge | Olympian Forge | C | R | Land | none | none | Enters tapped; manaAbility R | Bronze, smoke, and one more impossible commission. | flex |
| c2-shu-ember-road | Shu Ember Road | C | R | Land | none | none | Enters tapped; manaAbility R | The road glows after the army has passed. | core |
| c2-shu-bamboo-spearman | Shu Bamboo Spearman | C | G | Creature • Human Officer | {1}{G} | 2/2 | wardingGaze | Bamboo bends before the spear does. | core |
| c2-wu-jade-gardener | Wu Jade Gardener | C | G | Creature • Human Artisan | {2}{G} | 3/3 | When this arrives, add a mark to target creature | She grows jade in the shape of whatever the battle forgot. | core |
| c2-wei-hill-herder | Wei Hill Herder | C | G | Creature • Human Scout | {2}{G} | 3/2 | sentinel | A good herder knows when a hill has started moving. | core |
| c2-jin-spring-herald | Jin Spring Herald | C | G | Creature • Human Herald | {3}{G} | 4/4 | When this arrives, gainLife 2 | Spring answers the imperial calendar with its own schedule. | core |
| c2-olympian-grove-keeper | Olympian Grove-Keeper | C | G | Creature • Human Priest | {2}{G} | 2/3 | wardingGaze | The grove has seen gods arrive barefoot and leave quietly. | core |
| c2-crown-grove-steward | Crown Grove Steward | C | G | Creature • Human Officer | {3}{G} | 3/4 | Oath: while you control a legendary leader, add a mark to this when it arrives | The garden grows around whoever can keep the Crown. | flex |
| c2-shu-cedar-rider | Shu Cedar Rider | C | G | Creature • Human Rider | {4}{G} | 5/5 | overrun | The cedar horse is slower than a god and harder to stop. | core |
| c2-verdant-lacquer-warden | Verdant Lacquer Warden | C | G | Creature • Human Guard | {2}{G} | 2/4 | sentinel | Her shield is painted green to remind the forest who is visiting. | core |
| c2-rooted-rebuttal | Rooted Rebuttal | C | G | Charm | {1}{G} | none | Sever target artifact or enchantment | Vines are patient until they find the hinge. | core |
| c2-green-mandate | Green Mandate | C | G | Charm | {2}{G} | none | Boost target creature +3/+3; if you hold the Crown, add a mark to it | A Crown is easier to defend when the roots agree with it. | core |
| c2-oath-of-boughs | Oath of Boughs | C | G | Enchantment | {1}{G} | none | (AI-risk) Oath: at each dawn, add a mark to your legendary leader | The oath is renewed by leaves, rain, and somebody keeping watch. | flex |
| c2-riverbank-growth | Riverbank Growth | C | G | Ritual | {2}{G} | none | FetchLand; Foresee 1 | The river leaves fertile ground wherever it changes its mind. | core |
| c2-grove-marks | Grove Marks | C | G | Ritual | {2}{G} | none | Add a mark to target creature; gainLife 2 | A mark is a promise that the grove expects you to honor. | core |
| c2-jade-court-lantern | Jade Court Lantern | C | G | Artifact | {2}{G} | none | When this arrives, Foresee 1 and gainLife 1 | The lantern is green because ordinary light was not ambitious enough. | flex |
| c2-olympian-laurel | Olympian Laurel | C | G | Artifact | {1}{G} | none | Boost target creature +1/+1; Oath grants sentinel until end of turn | The laurel is awarded to whoever is still standing near the podium. | core |
| c2-cedar-crown | Cedar Crown | C | G | Enchantment | {3}{G} | none | (AI-risk) Your legendary leaders get +1/+1; if you hold the Crown, they also get overrun until end of turn when they attack | The forest crowns a leader with branches that do not bend. | stretch |
| c2-shu-bamboo-gate | Shu Bamboo Gate | C | G | Land | none | none | Enters tapped; manaAbility G | The gate is flexible, but the guards are not. | core |
| c2-jade-grove | Jade Grove | C | G | Land | none | none | Enters tapped; manaAbility G | Green light lies across the stones like an invitation. | core |
| c2-olympian-orchard | Olympian Orchard | C | G | Land | none | none | Enters tapped; manaAbility G | Even the gods have a place where fruit falls without applause. | flex |
| c2-hundred-hills | Hundred Hills | C | G | Land | none | none | Enters tapped; manaAbility G | The horizon is a formation if you look at it long enough. | core |

### Rares

| ID | Name | Rarity | Colors | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| c2-wei-marble-commander | Wei Marble Commander | R | W | Legendary Creature • Human Officer | {3}{W}{W} | 4/4 | sentinel; Oath: while you control a legendary Officer, claim the Crown if unheld and gainLife 2 | She treats the Crown as a duty, which is why everyone else wants it. | core |
| c2-shu-gate-advocate | Shu Gate Advocate | R | W | Creature • Human Officer | {2}{W} | 3/3 | When this arrives, boost another creature +1/+1; if you hold the Crown, that creature gains sentinel | He argues for the front line by standing in it. | flex |
| c2-jin-white-archivist | Jin White Archivist | R | W | Creature • Human Scholar | {3}{W} | 3/4 | When this arrives, Foresee 2; Oath draws 1 instead of Foresee 2 | The archive contains a map to every crown and none to retirement. | flex |
| c2-wu-lacquer-general | Wu Lacquer General | R | W | Creature • Human Officer | {4}{W} | 4/5 | firstBlade; your other Officers get +0/+1 | Her army advances behind a wall of polished shields. | core |
| c2-olympian-vowbearer | Olympian Vowbearer | R | W | Legendary Creature • Human Priest | {2}{W} | 2/3 | bloodoath; Oath: while you control a legendary God, gainLife 2 at each dawn | Olympus prefers vows that come with witnesses. | flex |
| c2-court-of-silver-reeds | Court of Silver Reeds | R | W | Enchantment | {3}{W} | none | Your Officers get +1/+0 while you hold the Crown; Oath also grants them sentinel | The court hears every oath and remembers the loudest one. | core |
| c2-crown-accuser | Crown Accuser | R | W | Charm | {2}{W} | none | Sever target creature with attack 3 or less; if that creature's controller holds the Crown, gainLife 3 | The Crown may be shared, but the charge is personal. | core |
| c2-marble-sunrise | Marble Sunrise | R | W | Ritual | {4}{W} | none | PreventCombat; Foresee 2; if you control a legendary leader, gainLife 3 | Dawn makes every wall look defensible for one useful minute. | flex |
| c2-white-oath-standard | White Oath Standard | R | W | Artifact | {2}{W} | none | When this arrives, claim the Crown if unheld; while you hold it, your leaders get +1/+1 | The standard is a flag, a promise, and a target in that order. | core |
| c2-olympus-sparrow | Olympus Sparrow | R | W | Creature • Bird | {1}{W} | 2/2 | skyborne; when this deals combat damage to a Crown holder, Foresee 1 | A tiny messenger can still deliver a very large insult. | flex |
| c2-wu-tide-admiral | Wu Tide Admiral | R | U | Legendary Creature • Human Officer | {3}{U} | 3/4 | skyborne; Oath: while you control a legendary Officer, draw 1 when this deals combat damage to a Crown holder | Her fleet turns political weather into a tactical advantage. | core |
| c2-wei-ink-ambassador | Wei Ink Ambassador | R | U | Creature • Human Envoy | {2}{U} | 2/3 | When this arrives, draw 1; if an opponent holds the Crown, Foresee 1 | He brings a treaty, a spare copy, and a sharp understanding of leverage. | flex |
| c2-shu-cloud-messenger | Shu Cloud Messenger | R | U | Creature • Human Herald | {3}{U} | 3/3 | skyborne; when this attacks, Foresee 1 if you hold the Crown | The cloud route is safer until somebody notices the banner. | core |
| c2-jin-star-cartographer | Jin Star Cartographer | R | U | Creature • Human Scholar | {4}{U} | 4/4 | When this arrives, Foresee 3; if you hold the Crown, draw 1 | She maps a campaign by stars and the rivalries between them. | flex |
| c2-olympian-oracle | Olympian Oracle | R | U | Legendary Creature • Human Oracle | {2}{U} | 2/2 | skyborne; (AI-risk) at each dawn, Foresee 1; Oath also draws 1 | Her predictions are accurate enough to make the gods defensive. | core |
| c2-crown-river-usurper | Crown River Usurper | R | U | Creature • Human Raider | {3}{U} | 3/3 | When this arrives, if an opponent holds the Crown, Recall target creature that player controls; otherwise Foresee 2 | He does not steal the Crown, he makes its chair uncomfortable. | core |
| c2-court-of-blue-silk | Court of Blue Silk | R | U | Enchantment | {3}{U} | none | (AI-risk) At each dawn, Foresee 1; if you hold the Crown, draw 1 instead | Silk hides the hand while the Crown advertises it. | core |
| c2-wu-levy-barge | Wu Levy Barge | R | U | Artifact | {4}{U} | none | When this arrives, Recall target creature; if you hold the Crown, Foresee 2 | The barge carries taxes, soldiers, and one very persuasive anchor. | flex |
| c2-tidebound-oath | Tidebound Oath | R | U | Charm | {2}{U} | none | Oath: Recall target creature and Foresee 1; otherwise Recall target artifact | A river oath changes the route before it changes the destination. | core |
| c2-ink-and-marble | Ink and Marble | R | U | Ritual | {1}{U} | none | Draw 2; grind 1 | Scholarship is just ambition with better storage. | flex |
| c2-jin-oblivion-chancellor | Jin Oblivion Chancellor | R | B | Legendary Creature • Human Officer | {4}{B} | 5/4 | deathblade; Oath: while you control a legendary Officer, Sever target creature when this arrives | He signs decrees in a hand that never shakes. | core |
| c2-wei-black-registrar | Wei Black Registrar | R | B | Creature • Human Scholar | {2}{B} | 3/2 | When this arrives, SeverGrave 2; if an opponent holds the Crown, that player losesLife 2 | The registry has a place for every fallen standard. | flex |
| c2-shu-crypt-veteran | Shu Crypt Veteran | R | B | Creature • Human Guard | {3}{B} | 3/3 | bloodoath; when this blocks a Crown holder's creature, add a mark to this | He has defended one tomb for three dynasties and dislikes visitors. | core |
| c2-wu-shadow-lieutenant | Wu Shadow Lieutenant | R | B | Legendary Creature • Human Officer | {2}{B} | 2/3 | deathblade; Oath: while you control a legendary leader, this gets +2/+0 at each dawn | The lieutenant serves from the dark and files no transfer request. | core |
| c2-olympian-chthonic-guide | Olympian Chthonic Guide | R | B | Legendary Creature • Human Priest | {3}{B} | 3/4 | At each dawn, grind 1; Oath: gainLife 2 when an opponent loses the Crown | The underworld has its own tour guide and a strict return policy. | flex |
| c2-crown-tithe-reaper | Crown Tithe Reaper | R | B | Creature • Human Raider | {3}{B} | 4/3 | When this attacks a Crown holder, that player losesLife 2; if you hold the Crown, gainLife 2 | He calls every transfer an overdue payment. | core |
| c2-ashen-oath-tablet | Ashen Oath Tablet | R | B | Enchantment | {2}{B} | none | Oath: at each dawn, target opponent losesLife 2; if no leader is controlled, grind 1 | The tablet rewards loyalty and records the absence of it. | flex |
| c2-gravecourt-edict | Gravecourt Edict | R | B | Ritual | {4}{B} | none | Sever all creatures with attack 2 or less; you gainLife 2 | The small court is dismissed before the important one. | core |
| c2-severed-seal | Severed Seal | R | B | Artifact | {2}{B} | none | When this arrives, SeverGrave 3; if you hold the Crown, draw 1 | A sealed record is still a weapon when opened at the right time. | flex |
| c2-iron-coffer-of-jin | Iron Coffer of Jin | R | B | Artifact | {3}{B} | none | (AI-risk) At each dawn, if you hold the Crown, draw 1 and loseLife 1 | The coffer has room for the Crown's benefits and its costs. | stretch |
| c2-wu-crimson-commander | Wu Crimson Commander | R | R | Legendary Creature • Human Officer | {3}{R} | 4/3 | warcry, firstBlade; Oath: when this attacks a Crown holder, damage that player 2 | He leads from the front because the front is where the Crown can be reached. | core |
| c2-wei-fire-marshal | Wei Fire Marshal | R | R | Creature • Human Officer | {2}{R} | 3/3 | warcry; when this arrives, damage target 2 | The marshal carries a torch for the enemy's most expensive plan. | core |
| c2-shu-red-horse-rider | Shu Red-Horse Rider | R | R | Creature • Human Rider | {3}{R} | 4/3 | overrun; if an opponent holds the Crown, this gets +1/+0 | The red horse does not need a map to find the center. | core |
| c2-jin-ember-tactician | Jin Ember Tactician | R | R | Creature • Human Officer | {2}{R} | 3/2 | When this arrives, damage target 2; if you hold the Crown, boost target creature +1/+0 | She solves two battlefield problems in the order they become loud. | core |
| c2-olympian-storm-priest | Olympian Storm Priest | R | R | Legendary Creature • Human Priest | {4}{R} | 4/4 | skyborne; damage a Crown holder 1 when this attacks | Thunder is a prayer with a better sound system. | flex |
| c2-crown-hunter-captain | Crown-Hunter Captain | R | R | Creature • Human Raider | {3}{R} | 3/3 | warcry; when this arrives, if an opponent holds the Crown, damage that player 2 | The captain calls the Crown a moving target and acts accordingly. | core |
| c2-splintered-oath | Splintered Oath | R | R | Charm | {2}{R} | none | Damage target 3; Oath also grants warcry to a target creature until end of turn | The oath breaks in a flash and somehow still inspires the charge. | flex |
| c2-red-court-anthem | Red Court Anthem | R | R | Enchantment | {3}{R} | none | Your other creatures get +1/+0; while you hold the Crown, they also get overrun until end of turn when they attack | The anthem has a chorus for every faction and a verse for the winner. | core |
| c2-marble-forge-banner | Marble Forge Banner | R | R | Artifact | {2}{R} | none | When this arrives, boost your creatures +1/+0; if an opponent holds the Crown, damage that player 1 | Gold thread looks best in motion. | flex |
| c2-sun-spear-ritual | Sun-Spear Ritual | R | R | Ritual | {4}{R} | none | Damage target 5; if that target's controller holds the Crown, draw 1 | The spear is sunlight given a very specific address. | core |
| c2-shu-verdant-commander | Shu Verdant Commander | R | G | Legendary Creature • Human Officer | {3}{G} | 4/4 | sentinel; Oath: when this arrives, add a mark to each other creature you control | She makes formation feel like a garden instead of a wall. | core |
| c2-wu-jade-ambassador | Wu Jade Ambassador | R | G | Creature • Human Envoy | {2}{G} | 3/3 | When this arrives, add a mark to target creature; if you hold the Crown, add a second mark | The ambassador brings gifts large enough to alter the border. | flex |
| c2-wei-pine-strategist | Wei Pine Strategist | R | G | Creature • Human Officer | {3}{G} | 3/4 | Oath: while you control a legendary leader, Foresee 1 at each dawn | He plants a pine where the battle plan says the retreat will be. | flex |
| c2-jin-stone-mason | Jin Stone Mason | R | G | Creature • Human Artisan | {4}{G} | 5/5 | When this arrives, gainLife 3; if an opponent holds the Crown, add a mark to this | He builds walls that can survive a dynasty changing its mind. | core |
| c2-olympian-laurel-keeper | Olympian Laurel-Keeper | R | G | Legendary Creature • Human Priest | {2}{G} | 2/4 | wardingGaze; Oath: while you control a legendary God, add a mark to your leader at each dawn | The laurel is greener when the god wearing it is listening. | flex |
| c2-crown-grove-challenger | Crown Grove Challenger | R | G | Creature • Human Raider | {3}{G} | 4/4 | When this attacks a Crown holder, add a mark to this; if you hold the Crown, gainLife 2 | The challenger wants the center because the center has roots. | core |
| c2-roots-of-oath | Roots of Oath | R | G | Charm | {2}{G} | none | Add a mark to target creature; Oath also grants sentinel until end of turn and gainLife 2 | A leader's promise travels through the whole formation. | core |
| c2-emerald-court | Emerald Court | R | G | Enchantment | {3}{G} | none | Your other creatures get +1/+1 while you control a legendary leader | The court grows stronger whenever its leader stops pretending to be temporary. | core |
| c2-jade-standard | Jade Standard | R | G | Artifact | {2}{G} | none | When this arrives, FetchLand; if you hold the Crown, add a mark to target creature | Jade makes a useful flag because it refuses to look fragile. | flex |
| c2-hundred-hills-stag | Hundred-Hills Stag | R | G | Creature • Beast | {4}{G} | 5/4 | overrun; Oath: while you control a legendary leader, this gets +1/+1 | The stag crosses three borders before the generals finish arguing. | core |
| c2-wei-wu-twin-envoys | Wei-Wu Twin Envoys | R | W/U | Legendary Creature • Human Officer | {3}{W}{U} | 4/4 | Oath: while you control a legendary Officer, Foresee 2 when this arrives; if you hold the Crown, draw 1 | Two banners enter together and make the room choose its language. | core |
| c2-shu-jin-border-brothers | Shu-Jin Border Brothers | R | W/B | Legendary Creature • Human Officer | {2}{W}{B} | 3/3 | bloodoath, deathblade; Oath grants both keywords to your leader until end of turn | Their border is a line on the map and a scar on the family table. | core |
| c2-olympian-lacquer-warrior | Olympian Lacquer Warrior | R | W/R | Legendary Creature • Human Hoplite | {3}{W}{R} | 4/4 | firstBlade, warcry; when this attacks a Crown holder, damage that player 2 | Bronze and lacquer make a bright enough target to be a strategy. | flex |
| c2-jade-marble-courtier | Jade-Marble Courtier | R | W/G | Legendary Creature • Human Envoy | {2}{W}{G} | 3/3 | sentinel; Oath: while you control a legendary leader, add a mark to another creature at each dawn | The courtier brings a garden into a room built for knives. | flex |
| c2-wu-olympian-tidecaller | Wu-Olympian Tidecaller | R | U/R | Legendary Creature • God | {3}{U}{R} | 4/3 | skyborne, warcry; when this arrives, damage target 2 and Foresee 1 | The tide answers the god with a louder answer. | core |
| c2-jin-olympus-veil | Jin-Olympus Veil | R | U/B | Legendary Creature • God | {2}{U}{B} | 3/3 | untouchable; Oath: while you control a legendary leader, draw 1 when an opponent loses the Crown | Night falls differently on a mountain with a ledger. | flex |
| c2-shu-grove-pact | Shu Grove Pact | R | U/G | Enchantment | {2}{U}{G} | none | Oath: while you control a legendary leader, Foresee 1 and add a mark to target creature at each dawn | The pact joins river patience to forest memory. | stretch |
| c2-wei-ashen-mandate | Wei Ashen Mandate | R | B/R | Ritual | {2}{B}{R} | none | Damage target 4; if that target's controller holds the Crown, claim the Crown after the damage | The order arrives as ash and leaves the Crown looking temporary. | core |
| c2-bronze-crown-registry | Bronze Crown Registry | R | C | Artifact | {3} | none | When this arrives, claim the Crown if unheld; while you hold it, Foresee 1 at each dawn | The registry does not own the Crown, it merely knows who does. | core |
| c2-marble-lacquer-colossus | Marble-Lacquer Colossus | R | C | Artifact Creature • Construct | {5} | 5/5 | sentinel; when this blocks a Crown holder's creature, add a mark to this | A statue becomes an officer once somebody gives it orders. | flex |

### Super Rares

| ID | Name | Rarity | Colors | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| c2-wei-heaven-marshal | Wei Heaven Marshal | SR | W | Legendary Creature • Human Officer | {4}{W} | 5/5 | sentinel; Oath: while you control a legendary Officer, claim the Crown if unheld and your other creatures get +0/+1 | The marshal does not ask for the center, she makes it defensible. | core |
| c2-olympian-judgment-scroll | Olympian Judgment Scroll | SR | W | Ritual | {3}{W} | none | Sever target creature; if its controller holds the Crown, PreventCombat at the next dawn | The scroll closes one case and schedules the next. | core |
| c2-wu-moon-tide-lord | Wu Moon-Tide Lord | SR | U | Legendary Creature • Human Officer | {4}{U} | 4/5 | skyborne; at each dawn, Foresee 2; Oath draws 1 instead | He rules the water by reading the moon's least flattering reflection. | core |
| c2-archive-of-seven-seals | Archive of Seven Seals | SR | U | Artifact | {4}{U} | none | At each dawn, Foresee 2; if you hold the Crown, draw 1 | The archive has seven locks because one was never enough. | flex |
| c2-jin-underworld-prefect | Jin Underworld Prefect | SR | B | Legendary Creature • Human Officer | {4}{B} | 5/4 | deathblade; when this arrives, SeverGrave 3; Oath gains bloodoath | The prefect keeps the graveyard orderly and the living nervous. | core |
| c2-crownless-night | Crownless Night | SR | B | Ritual | {3}{B} | none | Sever all creatures with attack 3 or less; an opponent who held the Crown losesLife 3 | The night is equal only until somebody finds a torch. | core |
| c2-shu-red-court-commander | Shu Red Court Commander | SR | R | Legendary Creature • Human Officer | {4}{R} | 5/4 | warcry, overrun; Oath: when this attacks a Crown holder, damage that player 3 | Her court is a war camp with better wine and worse exits. | core |
| c2-olympian-thunder-liturgy | Olympian Thunder Liturgy | SR | R | Ritual | {4}{R} | none | Damage each creature 3; if you hold the Crown, Foresee 1 | Thunder clears the board and leaves the marble warm. | core |
| c2-wei-jade-forest-regent | Wei Jade Forest Regent | SR | G | Legendary Creature • Human Officer | {4}{G} | 5/5 | overrun, sentinel; Oath: when this arrives, add a mark to each other creature you control | The regent turns a forest into a formation without cutting a tree. | core |
| c2-olive-grove-ascension | Olive-Grove Ascension | SR | G | Enchantment | {4}{G} | none | At each dawn, add a mark to target creature; if you hold the Crown, add a mark to two creatures instead | The grove does not hurry, which is why it eventually covers everything. | flex |
| c2-mandate-crown | Mandate Crown | SR | C | Artifact | {3} | none | When this arrives, claim the Crown if unheld; while you hold it, draw 1 extra card at each dawn | The Crown is a promise that becomes a target the moment it is fulfilled. | core |
| c2-gold-lacquer-war-chariot | Gold-Lacquer War Chariot | SR | C | Artifact Creature • Construct | {4} | 4/4 | warcry; when this attacks a Crown holder, damage that player 1 | The chariot is plated in gold so the charge can be seen from Olympus. | core |
| c2-marble-kingmaker | Marble Kingmaker | SR | C | Artifact | {5} | none | When this arrives, boost target legendary leader +2/+2; if that leader holds the Crown, grant sentinel | The kingmaker never sits on the throne, which is why she survives the furniture. | flex |
| c2-three-realms-compass | Three Realms Compass | SR | C | Artifact | {2} | none | When this arrives, FetchLand and Foresee 2 | It points to the next border, not the nearest one. | core |
| c2-crown-bell | Crown Bell | SR | C | Artifact | {3} | none | At each dawn, if you hold the Crown, gainLife 1; when the Crown transfers, Foresee 1 | The bell announces power and the exact moment power became someone else's. | stretch |
| c2-wei-shu-oathbound-duo | Wei-Shu Oathbound Duo | SR | W/G | Legendary Creature • Human Officer | {4}{W}{G} | 5/5 | sentinel; Oath: while you control a legendary leader, add a mark to this at each dawn and gainLife 1 | Two provinces share one oath and an alarming amount of luggage. | core |
| c2-jin-olympian-underqueen | Jin Olympian Underqueen | SR | U/B | Legendary Creature • God | {4}{U}{B} | 5/4 | untouchable; when this arrives, SeverGrave 4; Oath draws 1 at each dawn | She gives the dead a court and the living an appointment. | core |
| c2-wu-olympian-storm-legate | Wu Olympian Storm-Legate | SR | U/R | Legendary Creature • God | {3}{U}{R} | 4/4 | skyborne, warcry; when this deals combat damage to a Crown holder, Foresee 2 | The storm carries a seal from Wu and a grudge from Olympus. | flex |

### Super Super Rares

| ID | Name | Rarity | Colors | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| c2-wei-heavenly-chancellor | Wei Heavenly Chancellor | SSR | W | Legendary Creature • Human Officer | {5}{W} | 5/6 | sentinel; Oath: while you control a legendary Officer, claim the Crown if unheld and your other creatures get +1/+1 | She makes bureaucracy look like a cavalry charge. | core |
| c2-wu-deepwater-sovereign | Wu Deepwater Sovereign | SSR | U | Legendary Creature • God | {5}{U} | 5/5 | skyborne; at each dawn, Foresee 2; if you hold the Crown, draw 1 | The sea is his court, and every wave arrives with a petition. | core |
| c2-jin-ashen-emperor | Jin Ashen Emperor | SSR | B | Legendary Creature • Human Officer | {5}{B} | 6/5 | deathblade, untouchable; when this arrives, Sever target creature; Oath gains bloodoath | His coronation fire has outlived the palace that held it. | core |
| c2-shu-scarlet-war-princess | Shu Scarlet War-Princess | SSR | R | Legendary Creature • Human Officer | {5}{R} | 6/4 | warcry, overrun; when this attacks a Crown holder, damage that player 3; Oath grants firstBlade | She wears crimson because subtlety was already taken by the diplomats. | core |
| c2-olympian-grove-queen | Olympian Grove Queen | SSR | G | Legendary Creature • God | {5}{G} | 6/6 | sentinel, overrun; at each dawn, add a mark to each other creature you control if you hold the Crown | The orchard has a throne, and the throne has roots. | core |
| c2-throne-of-two-heavens | Throne of Two Heavens | SSR | C | Artifact | {5} | none | When this arrives, claim the Crown if unheld; while you hold it, your legendary leaders get +2/+2 | Two heavens share one throne and disagree about who polished it. | core |
| c2-chronicle-of-the-four-houses | Chronicle of the Four Houses | SSR | C | Artifact | {4} | none | At each dawn, if you control a legendary leader, Foresee 2; if you hold the Crown, draw 1 | The chronicle is written by four hands and corrected by none. | flex |
| c2-lacquered-war-engine | Lacquered War Engine | SSR | C | Artifact Creature • Construct | {6} | 6/6 | sentinel; when this attacks a Crown holder, add a mark to this | It was built to end a war and has been looking for a suitable opening. | core |
| c2-marble-omen-engine | Marble Omen Engine | SSR | C | Artifact | {4} | none | At each dawn, Foresee 2; if an opponent holds the Crown, that player losesLife 1 | The engine predicts the fall and invoices the current holder. | flex |
| c2-crownfall-gong | Crownfall Gong | SSR | C | Artifact | {3} | none | When the Crown transfers, boost your creatures +1/+0 and Foresee 1 | The gong has only one note, but it keeps finding new occasions. | stretch |
| c2-wei-olympus-first-minister | Wei-Olympus First Minister | SSR | W/U | Legendary Creature • Human Officer | {5}{W}{U} | 6/6 | skyborne, sentinel; Oath: while you control a legendary leader, draw 1 at each dawn and Foresee 1 when this attacks | He brings a marble seal to a lacquer court and expects paperwork to behave. | core |
| c2-shu-olympus-war-goddess | Shu-Olympus War-Goddess | SSR | W/R | Legendary Creature • God | {4}{W}{R} | 5/5 | firstBlade, warcry; when this attacks a Crown holder, damage that player 4; Oath grants bloodoath | The goddess blesses the charge and invoices the survivors. | core |
| c2-jin-olympus-underworld-king | Jin-Olympus Underworld King | SSR | B/G | Legendary Creature • God | {5}{B}{G} | 6/6 | deathblade, overrun; when this arrives, SeverGrave 5; Oath adds a mark to this at each dawn | He rules the root beneath the palace and knows which foundations are hollow. | core |
| c2-wu-shu-river-empress | Wu-Shu River Empress | SSR | U/G | Legendary Creature • Human Officer | {4}{U}{G} | 5/5 | skyborne, sentinel; when this arrives, FetchLand and Foresee 2; Oath gains bloodoath | Her river links two banners and gives neither permission to drift. | flex |

### Ultra Rares

| ID | Name | Rarity | Colors | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | Cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| c2-mandate-of-heaven | Mandate of Heaven | UR | C | Artifact | {5} | none | When this arrives, claim the Crown if unheld; while you hold it, draw 1 extra card at each dawn and your legendary leaders get +1/+1 | Heaven does not choose a ruler, it makes the ruler visible. | core |
| c2-wei-gold-dragon-commander | Wei Gold-Dragon Commander | UR | W | Legendary Creature • Human Officer | {6}{W} | 7/7 | sentinel; Oath: while you control a legendary Officer, claim the Crown if unheld and your other creatures get +1/+1 | The gold dragon is a banner, a warning, and a very expensive silhouette. | core |
| c2-wu-jade-sea-commander | Wu Jade-Sea Commander | UR | U | Legendary Creature • Human Officer | {6}{U} | 6/7 | skyborne; at each dawn, Foresee 3; if you hold the Crown, draw 1 | She can read a fleet's future from one green wave. | core |
| c2-shu-crimson-banner-commander | Shu Crimson-Banner Commander | UR | R | Legendary Creature • Human Officer | {6}{R} | 7/6 | warcry, overrun; when this attacks a Crown holder, damage that player 5; Oath grants firstBlade | The banner reaches the battlefield before the speech does. | core |
| c2-jin-night-crown-commander | Jin Night-Crown Commander | UR | B | Legendary Creature • Human Officer | {6}{B} | 7/7 | deathblade, untouchable; when this arrives, Sever target creature; Oath grants bloodoath | The night crown is worn by someone who has already survived the ceremony. | core |
| c2-olympus-above-clouds | Olympus Above Clouds | UR | G | Legendary Creature • God | {6}{G} | 7/7 | sentinel, overrun; at each dawn, add a mark to your legendary leader and gainLife 2 | Olympus rises above the clouds because the gods dislike stairs. | core |
| c2-jin-olympian-ascendant | Jin Olympian Ascendant | UR | W/B | Legendary Creature • God | {6}{W}{B} | 7/7 | deathblade, untouchable; when this deals combat damage to a Crown holder, claim the Crown and draw 1 | A marble crown over an iron oath leaves no neutral ground. | core |
| c2-wu-olympian-horizon | Wu Olympian Horizon | UR | U/G | Legendary Creature • God | {6}{U}{G} | 7/7 | skyborne, sentinel; when this arrives, Foresee 3 and FetchLand; Oath gains bloodoath | The horizon belongs to whoever can make river and sky agree. | flex |

## Set-Unique Token Proposals

These tokens are proposed as set-unique board pieces. They use simple bodies so the AI can attack or block them without a special planning layer.

| Token | Colors | Type | Stats | Token rules text | Intended cards |
| --- | --- | --- | --- | --- | --- |
| Crown Guard | W | Creature • Human Guard | 1/1 | sentinel | Crown Ward, Throne of Two Heavens, Crownfall Gong |
| River Wisp | U | Creature • Spirit | 1/1 | skyborne | Wu Deepwater Sovereign, Wu-Shu River Empress, Wu Olympian Horizon |
| Ashen Retainer | B | Creature • Human Officer | 1/1 | deathblade | Ashen Mandate Agent, Jin Underworld Prefect, Jin Olympian Ascendant |
| Ember Runner | R | Creature • Human Raider | 1/1 | warcry | Crown-Breaker's Call, Shu Scarlet War-Princess, Shu Crimson-Banner Commander |
| Jade Sapling | G | Creature • Plant | 1/1 | When this arrives, gainLife 1 | Grove Marks, Olympian Grove Queen, Olympus Above Clouds |
| Marble Herald | C | Artifact Creature • Construct | 1/1 | When this arrives, Foresee 1 | Marble Kingmaker, Chronicle of the Four Houses, Mandate of Heaven |

## Precon Identity

**Crown at the Crossroads** is a W/R/G Officer and Olympian midrange deck. It plays genuinely efficient early bodies, claims an unheld Crown with a few reliable arrivals, and turns the shared draw into pressure rather than a passive resource. Oath clauses reward keeping a legendary commander on the board, while Sentinel and combat tricks protect the formation. The win route is to attack the Crown holder, take the Crown through combat damage, then use Warcry, First Blade, Blood Oath, and Overrun to end the game. The common pool supplies the deck's power floor with playable 2/2s, 3/3s, efficient Sever and damage answers, and enough single-color lands to keep the plan moving.

## Gauntlet Boss Concepts

- **The Black Seal Regent**, rung 19, U/B. A control boss that claims the Crown with registry artifacts, filters every dawn, uses Sever and Recall to keep the board thin, and sends a Deathblade officer at whoever takes the draw. *The Regent never rushes the Crown because the ledger says patience is already profitable.*
- **Storm Over Four Banners**, rung 20, W/R/G. A proactive formation boss that curves efficient Officers into a legendary leader, claims the Crown early, and attacks the current holder with Warcry and Overrun bodies whenever the Crown changes hands. *Four banners enter the storm and leave as one argument.*

## Selection Notes

### Ten candidates to protect first

1. **Mandate of Heaven**: the clearest marquee expression of the shared Crown and anniversary premise.
2. **Wei Marble Commander**: a clean white leader that teaches Oath and Crown claiming without a puzzle.
3. **Wu Tide Admiral**: makes attacking a Crown holder valuable while giving blue a real board presence.
4. **Jin Oblivion Chancellor**: premium black removal attached to a leader that supports the faction identity.
5. **Wu Crimson Commander**: a direct red aggression bridge from Warcry into the Crown-transfer loop.
6. **Shu Verdant Commander**: the green formation leader that makes marks and Sentinel feel automatic.
7. **Crownless Night**: an in-color sweeper that keeps the set's board-answer suite credible.
8. **Olympian Thunder Liturgy**: a red reset with a simple Crown reward and strong marble identity.
9. **Wei-Olympus First Minister**: the anniversary crossover card, with a readable Oath payoff and no hidden choice.
10. **Shu-Olympus War-Goddess**: the cleanest high-rarity combat finisher for the Crown-holder attack heuristic.

### Three biggest design risks

1. **Crown snowballing**: the extra draw can make a Crown claim too self-reinforcing if claim effects, draw bonuses, and protection all cluster at high rarity. The shipping list needs enough cheap ways to attack the holder and enough Crown rewards that contesting it is attractive.
2. **Oath leader density**: too many Oath cards can make a deck feel blank when its leader is absent, while too few leaders make the mechanic feel ornamental. Commons should remain playable without Oath, and each color pair should have a real leader package.
3. **Top-end congestion and AI-risk lines**: the overplan contains several dawn engines and Crown-transfer payoffs that invite multi-turn sequencing. The final 120 should keep the automatic attack, arrival, and mark cards, cut redundant slow engines, and test that the AI attacks the Crown holder rather than treating the Crown as decorative text.
