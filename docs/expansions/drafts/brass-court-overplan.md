<!-- source-of-truth: docs/plan-expansion-slate.md, docs/keyword-map.md · last-verified: 2026-07-26 · concept draft — overplanned candidate list for a future set; nothing here is implemented -->

# The Brass Court: Overplan

## Set Identity

The Brass Court is a cathedral of gears in a coal-dark slate world: inventor queens hold court above airship docks, brass automata kneel beneath stained glass, and every warm plate of metal carries a little of the maker who hammered it. The set's WUBRG spread moves from white civic duty and blue patent culture to black furnace debts, red dockside revolt, and green living machinery. The visual and emotional register is warm brass against coal dark, with steam, rivets, velvet uniforms, copper gardens, and dangerous altitude.

**Salvage** is the Court's death-to-duty mechanic. When an artifact creature with Salvage dies, move its marks to another artifact creature you control. It turns a doomed machine into a transfer of workmanship, so the board keeps the labor even when a body is lost. The effect is automatic and local, using the existing marks and death-trigger shape without adding a player resource, new zone, or delayed choice. That makes it a strong engine-first candidate and an unusually honest AI mechanic: a greedy pilot gets the value without needing to plan a multi-turn loop.

**Contraption 3** is a static threshold: while you control 3 or more artifacts, the listed ability is active. It represents a court machine reaching operating pressure, from a three-piece crane line to a full airship dock. The threshold asks for visible board presence rather than hidden bookkeeping, and static checks already fit the engine's filter model. Most Contraption rows are deliberately useful before the threshold and better after it, so an AI can deploy them for rate and receive the upside naturally.

This is an overplan, not the final 120-card file. The target shipping mix is 60 C / 36 R / 11 SR / 8 SSR / 5 UR. The pool below offers 100 C / 60 R / 18 SR / 14 SSR / 8 UR candidates, with five set-unique token proposals. Costs and stats are design-facing proposals for a later engine-first pass. Any row using a not-yet-built Salvage or Contraption rule is a future card-data candidate, not an implementation claim.

## Candidate Table

### Candidates: Common

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bc-brassline-recruit | Brassline Recruit | C | W | Creature (Human Soldier) | {1}{W} | 2/2 | Contraption 3: gets +0/+1 | A new uniform, a bright rivet, and no patience for aristocrats. | core |
| bc-glassworks-guard | Glassworks Guard | C | W | Creature (Human Worker) | {2}{W} | 3/3 | Sentinel | She watches the stained glass and the workers who made it. | core |
| bc-rivet-choir | Rivet Choir | C | W | Creature (Human Artificer) | {2}{W} | 3/2 | Arrives: boost another artifact creature +1/+0 until end of turn | Their hammer rhythm is the Court's marching song. | flex |
| bc-gearway-medic | Gearway Medic | C | W | Creature (Human Engineer) | {2}{W} | 2/4 | Arrives: gainLife 2 | A clean bandage is a small rebellion against the factory bell. | core |
| bc-whitecap-courier | Whitecap Courier | C | W | Creature (Human Courier) | {1}{W} | 2/1 | Skyborne | She delivers sealed orders through smoke that would ground a bird. | flex |
| bc-brass-bastion | Brass Bastion | C | W | Creature (Automaton Guardian) | {3}{W} | 3/4 | Bulwark | The gate has never moved, but every generation tries to bribe it. | flex |
| bc-railcourt-marshal | Railcourt Marshal | C | W | Creature (Human Soldier) | {3}{W} | 3/3 | Contraption 3: your artifact creatures get +0/+1 | Order travels down the rail faster than gossip. | core |
| bc-rivetblade-acolyte | Rivetblade Acolyte | C | W | Creature (Human Artificer) | {2}{W} | 2/2 | First Blade | Her ceremonial tool has been sharpened for field work. | flex |
| bc-stained-glass-watcher | Stained-Glass Watcher | C | W | Creature (Automaton Scout) | {1}{W} | 1/3 | Warding Gaze | Its colored lenses see every airship that enters the cathedral. | core |
| bc-foundry-bride | Foundry Bride | C | W | Creature (Human Inventor) | {3}{W} | 3/3 | Arrives: createToken Brass Servo x1 | She married the workshop and invited the whole dock. | flex |
| bc-cathedral-winch | Cathedral Winch | C | W | Artifact Creature (Construct) | {2}{W} | 2/2 | Sentinel; Salvage | It lifts relics, wreckage, and occasionally an unwise duke. | core |
| bc-golden-riveter | Golden Riveter | C | W | Creature (Human Worker) | {1}{W} | 2/1 | Arrives: add a mark to another artifact creature | She knows exactly where a machine needs one more turn of the wrench. | flex |
| bc-bolted-oathsworn | Bolted Oathsworn | C | W | Creature (Human Soldier) | {4}{W} | 4/4 | Sentinel; while marked, gets +0/+1 | Her oath is engraved on a plate too thick to bend. | flex |
| bc-ivory-pressure-plate | Ivory Pressure Plate | C | W | Artifact (Relic) | {1} | none | Arrives: boost target creature +0/+2 until end of turn | Even the Court's floor knows when to hold the line. | flex |
| bc-court-seal | Court Seal | C | W | Charm | {1}{W} | none | Boost target creature +2/+2; it gains Sentinel until end of turn | Authority is most convincing when it arrives with a stamp. | core |
| bc-aetheric-cartographer | Aetheric Cartographer | C | U | Creature (Human Artificer) | {1}{U} | 2/2 | Arrives: foresee 1 | She maps the sky by pressure, soot, and the shape of clouds. | core |
| bc-sootglass-analyst | Sootglass Analyst | C | U | Creature (Human Scholar) | {2}{U} | 2/3 | Skim {1} | Her spectacles are smoked because clear glass reveals too much. | flex |
| bc-dockside-tinkerer | Dockside Tinkerer | C | U | Creature (Human Engineer) | {1}{U} | 2/1 | Contraption 3: at dawn, foresee 1 | He can improve any machine if no one asks him to stop. | flex |
| bc-foghorn-mechanist | Foghorn Mechanist | C | U | Creature (Human Worker) | {3}{U} | 3/3 | Arrives: foresee 1 | Her warning horn has prevented more collisions than laws have. | core |
| bc-ethercoil-drake | Ethercoil Drake | C | U | Artifact Creature (Drake) | {3}{U} | 3/3 | Skyborne | It nests inside the warm exhaust of the smallest airships. | core |
| bc-blueglass-diver | Blueglass Diver | C | U | Creature (Human Diver) | {2}{U} | 2/3 | Arrives: recall target artifact with cost 2 or less | She retrieves lost prototypes before the river can name them. | flex |
| bc-unspooled-scribe | Unspooled Scribe | C | U | Creature (Human Scholar) | {2}{U} | 2/2 | Arrives: draw 1 | She writes with a pen that never runs out of brass ink. | flex |
| bc-clocktower-surveyor | Clocktower Surveyor | C | U | Creature (Human Scout) | {3}{U} | 2/4 | Arrives: foresee 2 | He knows which tower is leaning before the bells complain. | flex |
| bc-pneumatic-messenger | Pneumatic Messenger | C | U | Artifact Creature (Automaton) | {1}{U} | 1/2 | Skyborne; Contraption 3: gets +1/+0 | Its envelope compartment has room for one secret and one threat. | core |
| bc-canal-ice-savant | Canal-Ice Savant | C | U | Creature (Human Artificer) | {2}{U} | 2/2 | Arrives: tap target artifact | She freezes a gear long enough to ask it better questions. | stretch |
| bc-rivetback-crab | Rivetback Crab | C | U | Artifact Creature (Crab) | {2}{U} | 2/4 | Bulwark | The dockhands feed it loose screws and call that friendship. | flex |
| bc-airship-deckhand | Airship Deckhand | C | U | Creature (Human Worker) | {2}{U} | 2/2 | Skyborne; when this blocks, foresee 1 | She keeps a ledger of every cloud that has tried to board. | flex |
| bc-brass-eyed-lookout | Brass-Eyed Lookout | C | U | Creature (Human Scout) | {1}{U} | 1/3 | Warding Gaze; Contraption 3: gets +1/+0 | His brass eye never blinks, even when the sky does. | core |
| bc-boilerplate-prodigy | Boilerplate Prodigy | C | U | Creature (Human Engineer) | {3}{U} | 3/3 | Contraption 3: at dawn, draw 1 then discard 1 | Her first machine was a kettle that predicted rain. | stretch (AI-risk) |
| bc-harbor-clocksmith | Harbor Clocksmith | C | U | Creature (Human Artificer) | {2}{U} | 2/2 | Arrives: foresee 1 | He repairs watches by listening to the owners lie about the time. | core |
| bc-liftshaft-familiar | Liftshaft Familiar | C | U | Artifact Creature (Construct) | {1}{U} | 2/1 | Salvage | It follows the elevator cables and carries whatever falls. | core |
| bc-vaporshade-seer | Vaporshade Seer | C | U | Creature (Human Diviner) | {3}{U} | 2/3 | At dawn: foresee 1; Skim {1} | Her prophecy is always accurate about the part nobody wants. | stretch (AI-risk) |
| bc-lantern-array-operator | Lantern-Array Operator | C | U | Creature (Human Engineer) | {2}{U} | 3/2 | Skim {1}; Contraption 3: gets +0/+1 | He lights the dock in a pattern only airship captains understand. | flex |
| bc-coal-scar-enforcer | Coal-Scar Enforcer | C | B | Creature (Human Worker) | {1}{B} | 2/2 | Deathblade | She was promised a clean job and given a furnace key. | core |
| bc-furnace-alley-cutthroat | Furnace Alley Cutthroat | C | B | Creature (Human Rogue) | {2}{B} | 3/2 | Deathblade | He takes tolls in loose parts and leaves the expensive pieces. | core |
| bc-soot-covenant-broker | Soot-Covenant Broker | C | B | Creature (Human Clerk) | {2}{B} | 2/3 | Arrives: opponent losesLife 1 | Every contract has a coal stain and a hidden witness. | flex |
| bc-black-iron-scavenger | Black-Iron Scavenger | C | B | Artifact Creature (Construct) | {2}{B} | 3/2 | Salvage | It strips a ruined machine before the smoke clears. | core |
| bc-cinder-clock-ghoul | Cinder-Clock Ghoul | C | B | Artifact Creature (Automaton) | {3}{B} | 3/3 | Deathblade; while marked, gets +1/+0 | Someone set its clock to midnight and threw away the key. | flex |
| bc-smog-veil-stalker | Smog-Veil Stalker | C | B | Creature (Human Rogue) | {1}{B} | 2/1 | Dreaded | The smoke hides her face, but never her boots. | core |
| bc-boiler-gravehand | Boiler Gravehand | C | B | Creature (Human Worker) | {3}{B} | 4/3 | When this dies, opponent losesLife 2 | He punches the furnace door as if it owes him wages. | flex |
| bc-rivet-chain-leech | Rivet-Chain Leech | C | B | Artifact Creature (Leech) | {2}{B} | 2/2 | Blood Oath | It feeds on hot metal and the pride of careless engineers. | flex |
| bc-coalwater-vulture | Coalwater Vulture | C | B | Artifact Creature (Bird) | {3}{B} | 3/3 | Skyborne | It follows the airships that do not have enough ballast. | core |
| bc-graveyard-registrar | Graveyard Registrar | C | B | Creature (Human Clerk) | {2}{B} | 2/2 | Arrives: grind self 2 | She files every fallen machine under the name of its last owner. | flex |
| bc-rustbite-hound | Rustbite Hound | C | B | Artifact Creature (Hound) | {1}{B} | 2/1 | When this dies, opponent losesLife 1 | It can smell a loose bolt through three walls. | core |
| bc-night-shift-engineer | Night-Shift Engineer | C | B | Creature (Human Engineer) | {2}{B} | 2/3 | Skim {1} | She fixes the Court after the respectable people go home. | flex |
| bc-sable-boiler-wraith | Sable Boiler Wraith | C | B | Creature (Spirit) | {4}{B} | 4/4 | Untouchable | Its old work order is still stamped in the soot on its ribs. | flex |
| bc-inkwell-accountant | Inkwell Accountant | C | B | Creature (Human Clerk) | {1}{B} | 2/1 | Arrives: opponent discards a card at random | She balances the ledger by removing whichever line looks weakest. | stretch |
| bc-black-court-porter | Black-Court Porter | C | B | Creature (Human Worker) | {3}{B} | 3/3 | Contraption 3: gains Deathblade | He wheels condemned machines through the royal ballroom. | core |
| bc-redline-scrapper | Redline Scrapper | C | R | Creature (Human Worker) | {1}{R} | 2/2 | Warcry | She tears a working engine apart just to see if it can run angry. | core |
| bc-firebox-bruiser | Firebox Bruiser | C | R | Creature (Human Brawler) | {2}{R} | 3/2 | Warcry | He has never met a pressure gauge he could not intimidate. | core |
| bc-boiler-room-daredevil | Boiler-Room Daredevil | C | R | Creature (Human Rider) | {2}{R} | 3/3 | Warcry; Contraption 3: gets +1/+0 | She rides the maintenance lift down because up is too ordinary. | core |
| bc-brassjaw-mastiff | Brassjaw Mastiff | C | R | Artifact Creature (Hound) | {2}{R} | 3/2 | Warcry | The Court bred it to guard engines and then taught it to chase nobles. | flex |
| bc-cinderwing-courier | Cinderwing Courier | C | R | Artifact Creature (Bird) | {1}{R} | 2/1 | Skyborne; Warcry | Its feathers are copper plates and its temper is pure dockside. | core |
| bc-furnace-choir | Furnace Choir | C | R | Creature (Human Artificer) | {3}{R} | 4/3 | Arrives: damage target creature 1 | Their song begins when the pistons begin to glow. | flex |
| bc-rivet-slinging-kid | Rivet-Slinging Kid | C | R | Creature (Human Worker) | {1}{R} | 2/1 | Arrives: damage target creature 1 | She learned aim by throwing scrap at the foreman's hat. | core |
| bc-smokehouse-veteran | Smokehouse Veteran | C | R | Creature (Human Soldier) | {3}{R} | 3/3 | Sentinel; when this attacks, damage opponent 1 | He has marched through three strikes and one wedding. | flex |
| bc-railgun-marauder | Railgun Marauder | C | R | Creature (Human Artificer) | {4}{R} | 4/3 | Overrun | She treats a fortified gate as a suggestion with hinges. | core |
| bc-boilerbolt-adept | Boilerbolt Adept | C | R | Creature (Human Engineer) | {2}{R} | 2/2 | Contraption 3: gets +1/+0 | His smallest projectile is still too large for the official test range. | flex |
| bc-clockwork-scamp | Clockwork Scamp | C | R | Artifact Creature (Construct) | {1}{R} | 2/1 | Warcry; when this dies, damage opponent 1 | It was built as a toy and improved itself into a nuisance. | core |
| bc-dockfire-hellion | Dockfire Hellion | C | R | Artifact Creature (Hellion) | {3}{R} | 3/3 | Warcry | It sleeps in coal heaps and wakes whenever someone says quiet. | flex |
| bc-copper-mask-acrobat | Copper-Mask Acrobat | C | R | Creature (Human Acrobat) | {2}{R} | 2/2 | Skyborne; Warcry | The mask is polished enough to signal an airship in fog. | flex |
| bc-ashline-ox | Ashline Ox | C | R | Artifact Creature (Beast) | {3}{R} | 4/3 | Overrun | It hauls a boiler through the street and resents pedestrians. | core |
| bc-torch-tender-foreman | Torch-Tender Foreman | C | R | Creature (Human Worker) | {2}{R} | 2/2 | Arrives: boost target artifact creature +1/+0 until end of turn | His crew gets a better spark and a worse speech. | flex |
| bc-redshift-tinkerer | Redshift Tinkerer | C | R | Creature (Human Engineer) | {1}{R} | 2/1 | Skim {1} | She throws the first design away before anyone can call it precious. | flex |
| bc-coalburst-hound | Coalburst Hound | C | R | Artifact Creature (Hound) | {2}{R} | 3/2 | Warcry; Contraption 3: gets +0/+1 | It guards the boiler by biting the boiler's enemies. | core |
| bc-coppervein-saboteur | Coppervein Saboteur | C | R | Creature (Human Rogue) | {2}{R} | 2/2 | Arrives: damage opponent 2 | She leaves a red mark on every factory that underpays. | core |
| bc-verdigris-forager | Verdigris Forager | C | G | Creature (Human Forager) | {1}{G} | 2/2 | Arrives: gainLife 1 | She gathers moss, copper wire, and rumors of a better city. | core |
| bc-ironroot-engineer | Ironroot Engineer | C | G | Creature (Human Engineer) | {2}{G} | 3/3 | Contraption 3: gets +1/+1 | Her workshop is a greenhouse with a very patient furnace. | core |
| bc-moss-copper-behemoth | Moss-Copper Behemoth | C | G | Artifact Creature (Beast) | {4}{G} | 5/5 | Salvage | Vines cover the plates until the whole machine looks ancient. | core |
| bc-airship-orchardist | Airship Orchardist | C | G | Creature (Human Worker) | {2}{G} | 2/3 | Arrives: gainLife 2 | She grows fruit in hanging gardens above the chimney line. | flex |
| bc-gearvine-stalker | Gearvine Stalker | C | G | Artifact Creature (Beast) | {2}{G} | 3/2 | Salvage; Warding Gaze | It hunts by listening for the click of a frightened gear. | core |
| bc-greenhouse-tender | Greenhouse Tender | C | G | Creature (Human Worker) | {1}{G} | 2/2 | Arrives: foresee 1 | She prunes brass leaves with the care of a surgeon. | flex |
| bc-pistonback-rhino | Pistonback Rhino | C | G | Artifact Creature (Beast) | {3}{G} | 4/4 | Overrun | Its charge turns a rail line into a garden path. | core |
| bc-copperbark-sentinel | Copperbark Sentinel | C | G | Artifact Creature (Treefolk) | {3}{G} | 3/5 | Sentinel | The oldest automaton in the orchard still remembers rain. | core |
| bc-geargarden-wolf | Geargarden Wolf | C | G | Artifact Creature (Beast) | {2}{G} | 3/2 | Warcry | It runs on spring tension and a very convincing growl. | flex |
| bc-verdigris-colossus | Verdigris Colossus | C | G | Artifact Creature (Construct) | {5}{G} | 6/6 | Contraption 3: Overrun | It is a walking monument to the idea that bigger is better. | core |
| bc-rootline-warden | Rootline Warden | C | G | Creature (Human Worker) | {1}{G} | 2/3 | Warding Gaze | She keeps the orchard's roots clear of city plumbing. | core |
| bc-orchard-boilerhand | Orchard Boilerhand | C | G | Creature (Human Worker) | {3}{G} | 3/3 | Arrives: add a mark to target artifact creature | He feeds the furnace with pruning waste and good advice. | flex |
| bc-wildsteam-charger | Wildsteam Charger | C | G | Artifact Creature (Beast) | {4}{G} | 4/4 | Overrun; Salvage | It was domesticated once and has since reconsidered. | core |
| bc-foundry-grovekeeper | Foundry Grovekeeper | C | G | Creature (Human Druid) | {3}{G} | 3/4 | Contraption 3: at dawn, gainLife 1 | She guards a grove where trees grow around abandoned engines. | flex |
| bc-brass-servo | Brass Servo | C | C | Artifact Creature (Construct) | {1} | 1/1 | Salvage | Small enough for a pocket, stubborn enough for a palace. | core |
| bc-winding-key | Winding Key | C | C | Artifact (Relic) | {1} | none | Arrives: foresee 1 | It turns once for every secret the Court refuses to publish. | flex |
| bc-rivet-shield | Rivet Shield | C | C | Artifact (Relic) | {2} | none | Arrives: boost target artifact creature +0/+2 until end of turn | A good shield is a promise with a handle. | flex |
| bc-pressure-gauge | Pressure Gauge | C | C | Artifact (Relic) | {2} | none | Contraption 3: your artifact creatures get +0/+1 | It is calibrated to the exact point before a palace explodes. | core |
| bc-salvage-crane | Salvage Crane | C | C | Artifact Creature (Construct) | {3} | 2/2 | Salvage; arrives: add a mark to another artifact creature | It retrieves failed machines and gives them one more job. | core |
| bc-dockside-hoist | Dockside Hoist | C | C | Artifact (Relic) | {3} | none | Arrives: fetchLand | The dock raises whatever the city needs next. | flex |
| bc-coalglass-lens | Coalglass Lens | C | C | Artifact (Relic) | {2} | none | Skim {1}; arrives: foresee 1 | Smoke makes every light look like a confession. | flex |
| bc-boilerplate-familiar | Boilerplate Familiar | C | C | Artifact Creature (Construct) | {2} | 2/2 | Salvage | It follows instructions better after being struck by lightning. | core |
| bc-cathedral-bellwork | Cathedral Bellwork | C | C | Artifact (Relic) | {4} | none | Contraption 3: at dawn, foresee 1 | Its bells ring for repairs, weddings, and structural warnings. | flex |
| bc-brasswork-colossus | Brasswork Colossus | C | C | Artifact Creature (Construct) | {5} | 4/4 | Contraption 3: gets +2/+2 | The Court commissioned a statue and received a siege engine. | flex |
| bc-rivet-punch | Rivet Punch | C | W | Charm | {1}{W} | none | Boost target creature +2/+2 until end of turn | The punch is ceremonial only until the foreman says otherwise. | core |
| bc-customs-inspection | Customs Inspection | C | U | Charm | {1}{U} | none | Cancel target spell | No machine enters the Court without declaring its moving parts. | core |
| bc-ashen-requisition | Ashen Requisition | C | B | Ritual | {2}{B} | none | Destroy target creature with defense 3 or less | The furnace takes a fee from every ambitious project. | core |
| bc-boilerburst | Boilerburst | C | R | Ritual | {2}{R} | none | Damage target creature 3 | The gauge was red, the engineer was smiling, and then there was weather. | core |
| bc-rootline-repair | Rootline Repair | C | G | Charm | {1}{G} | none | GainLife 3; add a mark to target artifact creature | Living vines make excellent insulation and better bandages. | core |
| bc-brassline-muster | Brassline Muster | C | W | Ritual | {3}{W} | none | CreateToken Brass Servo x2; foresee 1 | The bell rings once and two hundred tiny boots answer. | flex |
| bc-hush-of-the-docks | Hush of the Docks | C | U | Charm | {2}{U} | none | Recall target creature | A whole harbor can go silent when the right valve closes. | core |
| bc-coal-soot-verdict | Coal-Soot Verdict | C | B | Ritual | {4}{B} | none | MassDestroy all creatures with defense 2 or less | The Court calls it a ruling; the workers call it a sweep. | flex |
| bc-brass-court-plaza | Brass Court Plaza | C | W | Land | none | none | EntersTapped; manaAbility W | The cathedral steps are polished before every public argument. | core |
| bc-coal-dock | Coal Dock | C | R | Land | none | none | EntersTapped; manaAbility R | Barges unload fuel beneath flags that never stay clean. | core |

### Candidates: Rare

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bc-brass-court-adjudicator | Brass Court Adjudicator | R | W | Creature (Human Noble) | {3}{W} | 3/4 | Contraption 3: your artifact creatures get +1/+1 | Her gavel is a pressure piston with a ceremonial handle. | core |
| bc-stained-crown-duelist | Stained Crown Duelist | R | W | Creature (Human Soldier) | {2}{W} | 2/2 | First Blade; arrives: add a mark to target artifact creature | She settles patent disputes at swordpoint and files the paperwork later. | flex |
| bc-airship-chaplain | Airship Chaplain | R | W | Creature (Human Priest) | {3}{W} | 3/3 | Skyborne; arrives: gainLife 3 | Her blessing is spoken over engines before the crew boards. | flex |
| bc-white-brass-inspector | White Brass Inspector | R | W | Creature (Human Clerk) | {2}{W} | 2/4 | Contraption 3: artifact creatures you control gain Sentinel | She can identify a dangerous hinge from across a ballroom. | core |
| bc-clockwork-paladin | Clockwork Paladin | R | W | Artifact Creature (Automaton Knight) | {4}{W} | 4/4 | Sentinel; Salvage | Its armor is engraved with the names of every engineer it outlived. | core |
| bc-gatehouse-artificer | Gatehouse Artificer | R | W | Creature (Human Engineer) | {3}{W} | 2/3 | Arrives: createToken Brass Servo x1; boost it +1/+1 | She builds guardians faster than the gate can be breached. | flex |
| bc-radiant-rivetmaster | Radiant Rivetmaster | R | W | Creature (Human Artificer) | {2}{W} | 3/3 | Salvage; whenever another artifact creature dies, gainLife 1 | Her workshop is a memorial where every tool remains useful. | core |
| bc-cathedral-rail-marshal | Cathedral Rail Marshal | R | W | Creature (Human Soldier) | {4}{W} | 4/4 | First Blade; Contraption 3: gets +1/+1 | He conducts the defense of the city from a moving train. | flex |
| bc-brass-veil-warder | Brass-Veil Warder | R | W | Creature (Automaton Guardian) | {3}{W} | 3/5 | Bulwark; while you control 3 artifacts, other creatures get +0/+1 | The veil is decorative. The wall behind it is not. | core |
| bc-crown-foundry-champion | Crown Foundry Champion | R | W/R | Creature (Human Artificer) | {2}{W}{R} | 3/3 | Warcry; Contraption 3: artifact creatures get +1/+0 | She won the Court's title by building a machine that applauded her victory. | flex |
| bc-vaultline-angel | Vaultline Angel | R | W/R | Artifact Creature (Automaton Angel) | {4}{W}{R} | 4/4 | Skyborne; arrives: preventCombat | It descends from the vault when the city needs one impossible minute. | stretch |
| bc-whiteglass-decree | Whiteglass Decree | R | W | Ritual | {3}{W} | none | Destroy target creature; gainLife 2 | The Court removes a tyrant and sends the invoice to the throne. | core |
| bc-aether-dockmaster | Aether Dockmaster | R | U | Creature (Human Engineer) | {3}{U} | 3/3 | Contraption 3: at dawn, draw 1 | She controls the docks with a whistle and an immaculate ledger. | core |
| bc-clockwork-archivist | Clockwork Archivist | R | U | Creature (Automaton Scholar) | {3}{U} | 2/4 | Arrives: foresee 2; draw 1 | Its memory cylinder contains every patent the Court tried to bury. | flex |
| bc-veil-tunnel-surveyor | Veil-Tunnel Surveyor | R | U | Creature (Human Scout) | {2}{U} | 3/2 | Skyborne; Contraption 3: gets +1/+1 | She charts routes through steam clouds that have no fixed shape. | flex |
| bc-pressure-suit-diver | Pressure-Suit Diver | R | U | Creature (Human Diver) | {3}{U} | 3/3 | Untouchable; arrives: recall target artifact with cost 3 or less | Her suit is sealed, her contract is not. | core |
| bc-brass-echo-engineer | Brass Echo Engineer | R | U | Creature (Human Engineer) | {2}{U} | 2/3 | Skim {1}; whenever you Skim, foresee 1 | Every discarded blueprint becomes the beginning of a better one. | stretch (AI-risk) |
| bc-aerostat-taxonomist | Aerostat Taxonomist | R | U | Creature (Human Scholar) | {2}{U} | 2/2 | Skyborne; whenever an artifact arrives, foresee 1 | She names airships by the sound their hulls make in rain. | flex |
| bc-blueglass-automaton | Blueglass Automaton | R | U | Artifact Creature (Construct) | {4}{U} | 4/4 | Salvage; arrives: draw 1 then discard 1 | It stores a spare hand for every problem and a spare problem for every hand. | core |
| bc-lighthouse-gearmage | Lighthouse Gearmage | R | U | Creature (Human Artificer) | {3}{U} | 3/3 | Contraption 3: your creatures gain Skyborne until end of turn at dawn | Her lighthouse beam is a runway, a weapon, and a rumor. | stretch (AI-risk) |
| bc-canal-oracle | Canal Oracle | R | U | Creature (Human Diviner) | {2}{U} | 2/4 | At dawn: foresee 2 | She reads the future in oil slicks and reflected cathedral windows. | flex |
| bc-soot-bell-trickster | Soot-Bell Trickster | R | U | Creature (Human Rogue) | {2}{U} | 2/2 | Dreaded; when this deals combat damage, recall target creature with cost 2 or less | Her bell rings only after the target is already gone. | flex |
| bc-airway-cartel | Airway Cartel | R | U/R | Creature (Human Merchant) | {3}{U}{R} | 3/3 | Skyborne; Warcry; arrives: foresee 2 | They sell the same air route to every rival and collect from each crash. | core |
| bc-patent-denial | Patent Denial | R | U | Charm | {2}{U} | none | Cancel target spell; foresee 1 | A blue stamp can stop an invention more cleanly than a bomb. | core |
| bc-cinder-court-baron | Cinder Court Baron | R | B | Creature (Human Noble) | {4}{B} | 4/4 | Blood Oath; Contraption 3: opponent losesLife 1 at dawn | He wears a velvet coat over a furnace door and calls that subtlety. | core |
| bc-black-iron-executor | Black-Iron Executor | R | B | Artifact Creature (Automaton) | {3}{B} | 3/3 | Deathblade; Salvage | It carries out orders long after the ordering house burns down. | core |
| bc-graveyard-switchman | Graveyard Switchman | R | B | Creature (Human Worker) | {2}{B} | 2/3 | Arrives: grind self 3; raise a creature card from your graveyard to hand | He changes the track so lost machines come home. | flex |
| bc-coalheart-hag | Coalheart Hag | R | B | Creature (Human Witch) | {3}{B} | 3/3 | Dreaded; whenever an artifact creature dies, opponent losesLife 1 | She gives broken automata a final prediction before the scrap heap. | core |
| bc-soot-ledger-baroness | Soot Ledger Baroness | R | B | Creature (Human Noble) | {3}{B} | 3/4 | At dawn: opponent losesLife 1; you gainLife 1 | Her accounts are balanced because the city is not. | flex |
| bc-rust-marked-reclaimer | Rust-Marked Reclaimer | R | B | Artifact Creature (Construct) | {2}{B} | 2/2 | Salvage; arrives: add a mark to target artifact creature | It remembers every hand that abandoned it. | core |
| bc-night-boiler-harvester | Night Boiler Harvester | R | B | Creature (Human Worker) | {4}{B} | 4/3 | Dreaded; when this attacks, grind opponent 1 | She collects more than coal from the Court's midnight shift. | flex |
| bc-coalwater-crow | Coalwater Crow | R | B | Artifact Creature (Bird) | {3}{B} | 3/2 | Skyborne; Deathblade | It nests in the soot stacks and knows which windows are unlocked. | core |
| bc-blackglass-magistrate | Blackglass Magistrate | R | B | Creature (Human Judge) | {4}{B} | 4/4 | Untouchable; Contraption 3: gains Blood Oath | Her courtroom has no windows and excellent acoustics. | flex |
| bc-furnace-cryptomancer | Furnace Cryptomancer | R | B | Creature (Human Engineer) | {2}{B} | 2/3 | Skim {1}; at dawn, opponent losesLife 1 | She hides debts inside machine instructions. | flex |
| bc-ash-whisper-automaton | Ash-Whisper Automaton | R | B | Artifact Creature (Construct) | {3}{B} | 3/3 | Salvage; when this dies, grind self 2 | Its voice is the sound of a coal seam settling. | core |
| bc-cinder-pact-enforcer | Cinder Pact Enforcer | R | B/R | Creature (Human Enforcer) | {3}{B}{R} | 4/3 | Dreaded; Warcry; arrives: damage opponent 2 | She collects the furnace debt in person, with a smile that never cools. | flex |
| bc-redline-captain | Redline Captain | R | R | Creature (Human Soldier) | {3}{R} | 3/3 | Warcry; Contraption 3: your artifact creatures get +1/+0 | He leads from the front because the boiler is louder behind him. | core |
| bc-furnace-duchess | Furnace Duchess | R | R | Creature (Human Noble) | {4}{R} | 4/4 | Warcry; when this attacks, damage opponent 1 | She inherited a title and turned its parade carriage into artillery. | flex |
| bc-brassbolt-artillerist | Brassbolt Artillerist | R | R | Creature (Human Artificer) | {3}{R} | 3/3 | Arrives: damage target creature 2 | Her smallest shell is named after a very large family argument. | core |
| bc-railcar-marauder | Railcar Marauder | R | R | Artifact Creature (Construct) | {4}{R} | 4/3 | Overrun; Warcry | It was designed to carry cargo and chose conquest. | core |
| bc-cinderwing-harrier | Cinderwing Harrier | R | R | Artifact Creature (Bird) | {3}{R} | 3/3 | Skyborne; First Blade | It dives through chimney smoke with a duelist's timing. | flex |
| bc-hot-rivet-brawler | Hot-Rivet Brawler | R | R | Artifact Creature (Automaton) | {3}{R} | 3/2 | Warcry; Salvage | Its fists are fresh from the forge and its warranty is fictional. | core |
| bc-boiler-riotmaster | Boiler Riotmaster | R | R | Creature (Human Worker) | {3}{R} | 3/3 | Whenever another artifact creature attacks, damage opponent 1 | She starts the chant that turns a march into a strike. | stretch (AI-risk) |
| bc-embercoil-colossus | Embercoil Colossus | R | R | Artifact Creature (Construct) | {5}{R} | 5/5 | Overrun; Contraption 3: gets +2/+0 | It walks like a factory and burns like a bad investment. | core |
| bc-crown-breaker-engine | Crown-Breaker Engine | R | R | Artifact Creature (Construct) | {4}{R} | 4/4 | Contraption 3: at dawn, damage opponent 2 | The royal seal on its casing is now a target. | flex |
| bc-foundry-barrage | Foundry Barrage | R | R | Charm | {2}{R} | none | Damage target creature 4 | The Court calls it a test firing after the fourth crater. | core |
| bc-redline-reprisal | Redline Reprisal | R | R | Charm | {1}{R} | none | Damage target creature 3; if it dies, damage opponent 1 | The second shot is for the invoice. | flex |
| bc-sootgate | Sootgate | R | R | Land | none | none | EntersTapped; manaAbility R | The gate opens only after the furnace has chosen a side. | core |
| bc-verdigris-matriarch | Verdigris Matriarch | R | G | Creature (Human Inventor) | {3}{G} | 3/4 | Contraption 3: your artifact creatures get +1/+1 | She grows a garden through the Court's oldest machinery. | core |
| bc-ironroot-foreman | Ironroot Foreman | R | G | Creature (Human Worker) | {2}{G} | 3/3 | Arrives: add a mark to target artifact creature | He can tell a machine's age by the moss under its plates. | flex |
| bc-moss-copper-behemoth | Moss-Copper Behemoth | R | G | Artifact Creature (Beast) | {5}{G} | 6/6 | Salvage; Overrun | It is part cathedral, part forest, and entirely too large for the lift. | core |
| bc-orchard-airship-warden | Orchard-Airship Warden | R | G | Creature (Human Ranger) | {3}{G} | 3/3 | Skyborne; Sentinel; at dawn, gainLife 2 | She patrols the hanging orchards where clouds meet fruit trees. | flex |
| bc-gearvine-reclaimer | Gearvine Reclaimer | R | G | Artifact Creature (Beast) | {3}{G} | 4/3 | Salvage; Contraption 3: gets +1/+1 | It carries a broken engine home through roots and rain. | core |
| bc-copperbark-elder | Copperbark Elder | R | G | Creature (Treefolk) | {4}{G} | 4/5 | Warding Gaze; while marked, gains Sentinel | Its first branch was a boiler pipe and its second was a promise. | flex |
| bc-wildsteam-stag | Wildsteam Stag | R | G | Artifact Creature (Beast) | {3}{G} | 4/3 | Warcry; Overrun | It charges through the greenhouse and leaves the flowers intact by accident. | core |
| bc-verdigris-growth | Verdigris Growth | R | G | Charm | {2}{G} | none | Add two marks to target artifact creature; gainLife 2 | The brass blooms when the city finally stops polishing it. | core |
| bc-salvage-crane | Salvage Crane | R | C | Artifact Creature (Construct) | {3} | 3/3 | Salvage; arrives: raise an artifact card from your graveyard to hand | It has a hook for every kind of regret. | core |
| bc-contraption-ledger | Contraption Ledger | R | C | Artifact (Relic) | {3} | none | Contraption 3: at dawn, foresee 1 and gainLife 1 | The book keeps score when the machines cannot. | flex |
| bc-brass-court-foundry | Brass Court Foundry | R | C | Land | none | none | EntersTapped; manaAbility C; Contraption 3: manaAbility W or R | Every district claims it built the first gear. | flex (AI-risk) |
| bc-aetherline-crossing | Aetherline Crossing | R | U/R | Land | none | none | EntersTapped; manaAbility U or R | Two rail lines meet above the city and neither admits fault. | flex |

### Candidates: Super Rare

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bc-queen-of-the-rivet-choir | Queen of the Rivet Choir | SR | W | Legendary Creature (Human Inventor) | {4}{W} | 4/5 | Sentinel; Contraption 3: your artifact creatures get +1/+1; arrives: createToken Brass Servo x1 | She rules by knowing the name of every worker who built her throne. | core |
| bc-aetherglass-savant | Aetherglass Savant | SR | U | Creature (Human Scholar) | {4}{U} | 3/4 | Skyborne; at dawn, foresee 2 and draw 1 | Her stained-glass equations predict which airships will come home. | core |
| bc-coal-script-anatomist | Coal-Script Anatomist | SR | B | Creature (Human Engineer) | {4}{B} | 4/4 | Deathblade; Salvage; when this dies, opponent losesLife 2 | She studies failed machines as if they have a pulse. | core |
| bc-redline-war-princess | Redline War-Princess | SR | R | Legendary Creature (Human Noble) | {4}{R} | 4/4 | Warcry; First Blade; when this attacks, damage opponent 2 | She inherited a parade and rerouted it through the enemy gate. | core |
| bc-verdigris-orchard-sovereign | Verdigris Orchard Sovereign | SR | G | Legendary Creature (Human Druid) | {5}{G} | 5/5 | Overrun; Contraption 3: artifact creatures you control get +1/+1 | Her palace is a living engine that blooms whenever it wins a fight. | core |
| bc-crown-of-gears | Crown of Gears | SR | C | Artifact (Relic) | {4} | none | Contraption 3: your artifact creatures have Sentinel; at dawn, add a mark to one | It crowns the machine that did the most work, then asks for more. | flex |
| bc-salvage-matron | Salvage Matron | SR | W/R | Legendary Creature (Human Artificer) | {3}{W}{R} | 4/4 | Warcry; Salvage; whenever another artifact creature dies, boost another artifact creature +1/+0 | She attends every funeral with a toolbox and leaves with a brighter army. | core |
| bc-gilded-aerostat-baroness | Gilded Aerostat Baroness | SR | U/R | Legendary Creature (Human Pilot) | {4}{U}{R} | 4/4 | Skyborne; Warcry; Contraption 3: draw 1 at dawn | Her airship is a ballroom, a laboratory, and a declaration of war. | flex |
| bc-blackglass-foundry-regent | Blackglass Foundry Regent | SR | B/R | Legendary Creature (Human Noble) | {4}{B}{R} | 5/4 | Dreaded; when another artifact creature dies, damage opponent 1 | She taxes the scrap heap until it becomes a throne. | core |
| bc-moss-brass-colossus | Moss-Brass Colossus | SR | G/W | Artifact Creature (Construct) | {5}{G}{W} | 6/6 | Overrun; Salvage; Contraption 3: gets +2/+2 | It is a walking greenhouse built around a cathedral bell. | core |
| bc-steamveil-duelist | Steamveil Duelist | SR | U | Creature (Human Duelist) | {3}{U} | 3/3 | Untouchable; First Blade; arrives: foresee 2 | Her veil hides a face that has won every patent duel in the Court. | flex |
| bc-cinderroot-hydraulist | Cinderroot Hydraulist | SR | B | Artifact Creature (Construct) | {4}{B} | 4/4 | Salvage; Contraption 3: gains Blood Oath | It drinks coal slurry and pumps life into machines that should be dead. | flex |
| bc-brass-court-convenor | Brass Court Convenor | SR | W | Creature (Human Clerk) | {3}{W} | 3/4 | Contraption 3: at dawn, createToken Brass Servo x1; other artifact creatures get +0/+1 | She can make rival workshops share a table and a firing schedule. | flex |
| bc-the-humming-engine | The Humming Engine | SR | C | Artifact Creature (Construct) | {6} | 5/5 | Salvage; at dawn, if you control 3 artifacts, draw 1 | No one knows its inventor, but every queen claims to hear it dreaming. | stretch (AI-risk) |
| bc-cathedral-of-pressure | Cathedral of Pressure | SR | C | Artifact (Relic) | {5} | none | Contraption 3: your artifact creatures get +2/+0; if you control fewer than 3 artifacts, gainLife 2 at dawn | Its stained glass glows brighter as the boiler room fills. | core |
| bc-patent-of-conquest | Patent of Conquest | SR | W | Charm | {3}{W} | none | Boost all your creatures +1/+1; they gain First Blade until end of turn | The Court stamps victory before the battle has finished. | flex |
| bc-deepdock-leviathan | Deepdock Leviathan | SR | U/B | Artifact Creature (Leviathan) | {6}{U}{B} | 7/7 | Dreaded; Salvage; arrives: recall target creature | It sleeps beneath the docks and wakes when the city defaults. | core |
| bc-verdigris-sky-tyrant | Verdigris Sky Tyrant | SR | U/G | Artifact Creature (Drake) | {5}{U}{G} | 5/5 | Skyborne; Overrun; Contraption 3: gets +2/+2 | It nests on the highest spire and considers airspace a family estate. | flex |

### Candidates: Super Super Rare

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bc-lady-copperwake | Lady Copperwake, Inventor Queen | SSR | W/R | Legendary Creature (Human Inventor) | {4}{W}{R} | 5/5 | Warcry; Contraption 3: your artifact creatures get +1/+1 and Sentinel; arrives: createToken Brass Servo x2 | She built a throne that can follow an airship and a court that can keep up. | core |
| bc-aether-queen | Aether Queen of the High Docks | SSR | U | Legendary Creature (Human Queen) | {5}{U} | 4/5 | Skyborne; Untouchable; at dawn, foresee 2 and draw 1 | Her palace floats above the smoke so every promise sounds celestial. | core |
| bc-coal-widow | The Coal Widow | SSR | B | Legendary Creature (Human Noble) | {5}{B} | 5/5 | Dreaded; Blood Oath; whenever an artifact creature dies, opponent losesLife 1 and you gainLife 1 | She wears a black veil for every machine the furnace has swallowed. | core |
| bc-furnace-king | Furnace King of Redline | SSR | R | Legendary Creature (Human King) | {5}{R} | 6/5 | Warcry; Overrun; at dawn, damage opponent 2 | His crown is a boiler cap and his coronation is always on fire. | core |
| bc-verdigris-mother | Verdigris Mother of the Grove | SSR | G | Legendary Creature (Treefolk) | {5}{G} | 5/7 | Sentinel; Salvage; Contraption 3: your artifact creatures get +2/+2 | She taught the first machine how to grow and the first queen how to listen. | core |
| bc-glasswing-chancellor | Glasswing Chancellor | SSR | U/W | Legendary Creature (Automaton Angel) | {4}{U}{W} | 4/5 | Skyborne; First Blade; arrives: preventCombat; at dawn, gainLife 3 | Its wings are stained glass, and its verdict is a clear sky. | flex |
| bc-soot-crown-usurper | Soot-Crown Usurper | SSR | B/R | Legendary Creature (Human Rebel) | {4}{B}{R} | 5/4 | Dreaded; Warcry; when this attacks, damage target creature 3 | She stole the crown from a furnace and plans to steal the city next. | core |
| bc-greenhouse-autarch | Greenhouse Autarch | SSR | G | Legendary Creature (Human Inventor) | {6}{G} | 6/6 | Overrun; Contraption 3: at dawn, createToken Brass Servo x2 and add a mark to each | Her estate has roots in the sewer and windows in the clouds. | flex |
| bc-blackwater-airship | Blackwater Airship | SSR | U/B | Artifact Creature (Airship) | {6}{U}{B} | 6/6 | Skyborne; Dreaded; Salvage; arrives: grind opponent 3 | Its hull is sealed against water, smoke, and the law. | core |
| bc-crownline-catastrophe | Crownline Catastrophe | SSR | R | Ritual | {5}{R} | none | MassDestroy all creatures with defense 3 or less; damage opponent 2 | The royal rail line reaches its destination all at once. | core |
| bc-the-salvage-decree | The Salvage Decree | SSR | W | Enchantment | {4}{W} | none | Whenever an artifact creature dies, move its marks to another artifact creature you control; Contraption 3: gainLife 1 | The Court finally made a law that treats broken work as valuable. | core |
| bc-contraption-cathedral | Contraption Cathedral | SSR | C | Artifact (Relic) | {5} | none | Contraption 3: your artifact creatures get +2/+2 and Sentinel; at dawn, foresee 1 | Every gear in the city can hear the bells from here. | core |
| bc-brass-voice-paragon | Brass-Voice Paragon | SSR | C | Artifact Creature (Construct) | {7} | 6/6 | Salvage; Contraption 3: your other artifact creatures get +1/+1; whenever another artifact creature dies, gainLife 1 | It speaks for the Court in a voice assembled from a thousand working bells. | core |
| bc-vesper-uncrowned-inventor | Vesper, Uncrowned Inventor | SSR | U/R | Legendary Creature (Human Engineer) | {4}{U}{R} | 4/4 | Skyborne; Warcry; Skim {1}; whenever you Skim, damage opponent 1 | She refused the crown and built a faster way around it. | stretch (AI-risk) |

### Candidates: Ultra Rare

| ID | Name | Rarity | Color(s) | Type | Cost | Stats | Mechanics sketch | Identity / flavor hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bc-queen-brassheart | Queen Brassheart, First of the Court | UR | W/R | Legendary Creature (Human Inventor) | {5}{W}{R} | 6/6 | Warcry; First Blade; Contraption 3: your artifact creatures get +2/+2 and Sentinel; arrives: createToken Brass Servo x2 | She forged the Court's first crown from a boiler that would not obey. | core |
| bc-aether-crown-matriarch | Aether Crown Matriarch | UR | U/W | Legendary Creature (Human Queen) | {6}{U}{W} | 5/6 | Skyborne; Untouchable; at dawn, foresee 3, draw 1, and gainLife 2 | Her court is a floating observatory where every star has a patent. | core |
| bc-coal-black-regent | The Coal-Black Regent | UR | B/R | Legendary Creature (Human Regent) | {6}{B}{R} | 7/5 | Dreaded; Blood Oath; whenever an artifact creature dies, opponent losesLife 2 and you gainLife 2 | He turned the city's debt into a crown and the crown into a weapon. | core |
| bc-verdigris-skyfounder | Verdigris Skyfounder | UR | G/U | Legendary Artifact Creature (Construct) | {6}{G}{U} | 7/7 | Skyborne; Overrun; Salvage; Contraption 3: gets +3/+3 | It was the first machine to grow wings and the last one to ask permission. | core |
| bc-the-first-engine | The First Engine | UR | C | Legendary Artifact Creature (Construct) | {8} | 8/8 | Salvage; Contraption 3: all your artifact creatures get +2/+2, Sentinel, and Overrun | Its original blueprint is blank because the machine wrote its own history. | core |
| bc-crown-of-the-last-boiler | Crown of the Last Boiler | UR | R | Legendary Artifact (Relic) | {6} | none | Contraption 3: at dawn, damage opponent 3 and add a mark to each artifact creature you control | It keeps burning after the Court runs out of reasons. | flex |
| bc-morrowglass-architect | Morrowglass Architect | UR | U | Legendary Creature (Human Artificer) | {5}{U} | 4/5 | Untouchable; at dawn, foresee 4; Contraption 3: draw 1 | She designs tomorrow from a balcony no one else can reach. | flex |
| bc-salvage-saint-of-the-court | Salvage Saint of the Court | UR | W | Legendary Creature (Automaton Saint) | {5}{W} | 5/7 | Sentinel; Salvage; whenever an artifact creature dies, createToken Brass Servo x1 | It blesses every broken machine and sends none of them quietly away. | core |

## Set-Unique Token Proposals

| Token | Color | Type | Stats | Token rules sketch | Identity hook |
| --- | --- | --- | --- | --- | --- |
| Brass Servo | C | Artifact Creature (Construct) | 1/1 | Salvage | A palm-sized worker with a full-sized sense of duty. |
| Boiler Hound | R | Artifact Creature (Hound) | 2/2 | Warcry | It guards the furnace by sprinting at anything that is not supposed to be there. |
| Pneumatic Wing | U | Artifact Creature (Automaton Bird) | 1/1 | Skyborne | A letter carrier with feathers made from folded brass. |
| Verdigris Tender | G | Artifact Creature (Construct) | 1/2 | At dawn, gainLife 1 | It waters the orchard with condensed steam. |
| Court Salvage Wisp | W | Artifact Creature (Spirit) | 1/1 | When this dies, add a mark to target artifact creature | It carries one last spark from every machine it visits. |

## Precon Identity

**Brassline Rebellion** is a W/R artifact aggro-midrange deck. It deploys efficient artifact creatures early, attacks with Warcry, First Blade, and Overrun, then turns trades into durable board presence through Salvage. Contraption 3 rewards the deck for keeping three artifacts in play without making the opening turns wait for a combo. White supplies sturdy bodies, Sentinel, prevention, and efficient creature answers. Red supplies direct damage, Warcry pressure, and the reach to finish a weakened opponent. The win route is simple enough for a greedy pilot: establish three artifacts, attack every safe turn, and let marks stay on the machine that survives.

## Gauntlet Boss Concepts

- **Queen Brassheart** (rung 19, W/R): a board-first Court boss that curves artifact creatures into Contraption 3 anthems, uses Warcry to force early damage, and lets Salvage preserve marks after trades. Her line is a cathedral procession that arrives with enough pressure to end the game before value becomes abstract.
- **The Coal-Black Regent** (rung 20, B/R): a furnace-control boss that plays cheap Salvage bodies, trades them into removal, and converts every death into life swing and direct damage through the Regent. His line is a debt ledger where every broken automaton still charges interest.

## Selection Notes

### Ten candidates to protect first

1. **bc-brass-court-adjudicator, Brass Court Adjudicator**: the clean common-to-rare Contraption payoff that makes artifact presence matter.
2. **bc-black-iron-scavenger, Black-Iron Scavenger**: an efficient common body that teaches Salvage immediately.
3. **bc-pressure-gauge, Pressure Gauge**: a colorless common that lets multiple colors share the set's threshold identity.
4. **bc-customs-inspection, Customs Inspection**: a real common board and spell answer so the set does not become solitaire machinery.
5. **bc-coalwater-crow, Coalwater Crow**: a clean evasive black artifact threat with a distinct coal-dark silhouette.
6. **bc-copperbark-sentinel, Copperbark Sentinel**: the defensive green bridge between living growth and brass construction.
7. **bc-redline-captain, Redline Captain**: the precon's straightforward attack payoff and the clearest AI-pilotable rare.
8. **bc-salvage-matron, Salvage Matron**: the marquee expression of marks moving through a working court.
9. **bc-the-salvage-decree, The Salvage Decree**: the enchantment that makes the mechanic feel like law, not just a death trigger.
10. **bc-the-first-engine, The First Engine**: the set's visual and mechanical thesis in one enormous, legible finisher.

### Three biggest design risks

1. **Threshold snowballing**: too many Contraption 3 anthems can make a player who is already ahead impossible to catch. Threshold effects need modest pre-threshold bodies, clear removal windows, and careful stacking limits.
2. **Salvage mark concentration**: automatic mark transfer can make one surviving artifact creature grow past the removal suite. The engine pass should test destination rules, target availability, and whether repeated transfers create an unintended single-threat pattern.
3. **Artifact density versus color identity**: if the best rate bodies are all artifacts, WUBRG distinctions may collapse into one generic machine deck. Common color slices need real answers and creature quality, while Contraption payoffs must reward a color's plan instead of replacing it.
