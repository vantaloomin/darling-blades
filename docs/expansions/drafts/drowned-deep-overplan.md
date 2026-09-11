<!-- source-of-truth: docs/expansions/drafts/drowned-deep-brief.md, docs/plan-drowned-deep-engine.md, docs/plan-tap-abilities.md, docs/keyword-map.md, src/engine/types.ts, src/data/axes.ts · last-verified: 2026-09-11 · concept draft — the fresh 320-candidate overplan for the 250-card Drowned Deep cut; all five batches authored 2026-09-11, density-revised against the brief; awaiting the cut; nothing here is implemented -->

# The Drowned Deep: overplan (fresh, 2026-09-11)

The 320-candidate pool for the 250-card cut, authored against the approved
[identity brief](drowned-deep-brief.md) and the ruled
[engine spec](../../plan-drowned-deep-engine.md). It replaces the retired
2026-07-26 draft entirely; no row from that draft is reused.

**Batches.** 1: URs and SSRs (the identity layer). 2: SRs. 3:
Rares. 4: Commons. 5: tokens, precon, bosses, the self-audit and the
protect-first and cut lists. The cut happens after batch 5, with enabler
density and the overlap audit as cut constraints.

## Rarity target

Cut: **124 C / 75 R / 23 SR / 16 SSR / 12 UR = 250.** Overplan: 160 C / 96 R
/ 30 SR / 22 SSR / 14 UR = 322. Multicolour only at R and above, under ten
percent of the pool.

## How to read a row

- **Mechanics sketch** is written in the engine's vocabulary so transcription
  is mechanical: `Arrives:`, `During your Dawn:`, `Dies:`, `Duty:` (tap
  ability; `Duty, {1}:` when mana is also paid; the card face shows the tap
  pip, never the word), `Whispers {N}`, `Dread`, `Rite N`, `Retell {N}`,
  `Skim {N}`, `Empower {N}:`, and the thirteen keywords by name. Marks are
  creature-scoped. `grind self N` mills your own deck.
- **Whispers costs** follow the costing guard: creatures and Charms at
  printed minus two, Rituals at printed minus one, never below fair minus
  two. Cards that also carry Skim are priced on the combined cast.
- **Dread** carriers are Horrors with honest printed costs; the discount is
  one generic per two points of sacrificed Defense, rounded down.
- **CUT-PRIORITY**: `core` (protect), `flex` (cut to make the histogram),
  `stretch` (cut first; `(AI-risk)` marks the shapes the brief keeps out of
  the AI's hands).
- Names are provisional until the collision check against the pool at
  concretion; flavour hooks are one line and follow the copy rules (no
  em-dashes).

## Ultra Rare (14; cut keeps 12)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-mother-hydra | Mother Hydra, Queen Beneath Dunmarrow | UR | B | Creature, Deep One Horror, legendary | {5}{B}{B} | 6/7 | Dreaded. Dread. During your Dawn, if you control another Horror, opponent loses 2 life. | She has been the town's landlord for three hundred years and has never once raised the rent. | core |
| dd-father-dagon | Father Dagon, the Deep Itself | UR | U/B | Creature, Deep One Horror, legendary | {6}{U}{B} | 8/8 | Dreaded. Overrun. Dread. Arrives: each player grinds 3. | The harbour floor is not the bottom. It is his brow. | core |
| dd-lightkeeper | Maren Holt, the Lightkeeper | UR | W | Creature, Human Warden, legendary | {4}{W}{W} | 3/6 | Sentinel. Warding Gaze. Duty, {1}: gain 3 life and tap target creature an opponent controls. | The light has not gone dark in three hundred years, and she is why. | core |
| dd-bell-that-will-not-ring | The Bell That Will Not Ring | UR | W | Artifact, legendary | {2}{W} | none | Duty, {1}: tap target creature. During your Dawn: gain 1 life. Your Wardens get +0/+1. | It was cast to warn the town. It has decided the town should not know. | core |
| dd-tide-that-remembers | The Tide That Remembers | UR | U | Ritual | {3}{U}{U} | none | Draw 4, then grind self 3. Whispers {2}{U}{U}. | The water keeps every name it was ever given, and returns them in the wrong order. | core |
| dd-isolde-marrow | Isolde Marrow, Drowned Cartographer | UR | U | Creature, Human, legendary | {2}{U}{U} | 2/5 | Skim {U}. Duty, {1}: Foresee 2, then draw 1. | Her charts are accurate to the inch, for a coast that no longer exists. | core |
| dd-agathe-vane | Agathe Vane, the Salt Widow | UR | B | Creature, Human Witch, legendary | {2}{B}{B} | 3/4 | Deathblade. Duty: opponent loses 1 life and you gain 1 life. Skim {B}. Whispers {1}{B}{B}. | Four husbands, one wedding ring, and the sea owes her for all of them. | core |
| dd-the-brood-below | The Brood Below | UR | B | Creature, Deep One Horror | {5}{B}{B} | 5/5 | Dread. Arrives: create two 2/2 black Deep-Spawn tokens. | What the nets bring up in spring is not fish, and the town has learned not to count. | core |
| dd-the-reef-that-walks | The Reef That Walks | UR | G | Creature, Horror | {6}{G}{G} | 7/8 | Overrun. Dread. Arrives: put a Mark on each other creature you control. | Coral grows on whatever stands still long enough. The reef stopped standing still. | core |
| dd-old-marrow | Old Marrow, Keeper of the Salt Marsh | UR | G | Creature, Human Witch, legendary | {3}{G}{G} | 4/6 | Bulwark. Duty, {1}: create a 2/2 green Kelp Shade token. | She plants the drowned where the reeds are thickest, and something always comes up. | core |
| dd-brenna-gale | Brenna Gale, Storm-Caller of the Reach | UR | R | Creature, Human, legendary | {2}{R}{R} | 4/3 | Warcry. Rage. Duty: damage target creature 2. | She can hold the storm or hold the line. Not both, and she knows it. | core |
| dd-the-choir-below | The Choir Below | UR | U/B | Enchantment, legendary | {2}{U}{B} | none | During your Dawn: grind self 2. Duty, {1}: Foresee 1, then draw 1. | They sing in the voices of the people you miss, and they are very good at it. | flex |
| dd-the-lantern-watch | The Lantern Watch | UR | W/U | Enchantment, legendary | {1}{W}{U} | none | Your creatures get +0/+1. Your creatures have Warding Gaze. Duty: tap target creature. | Every lamp on the coast has a woman behind it, and every woman has a reason. | flex |
| dd-cinderjaw | Cinderjaw, the Fire That Swims | UR | R | Creature, Deep One Horror, legendary | {4}{R}{R} | 5/4 | Warcry. Duty, {R}: damage target creature 2. Whenever this attacks, damage opponent 2. Whispers {3}{R}{R}. | The town burns its wrecks to keep the Deep away. The Deep learned to like it hot. | core |

## Double Super Rare (22; cut keeps 16)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-wreckfire | Wreckfire | SSR | R | Ritual | {2}{R}{R} | none | Damage all creatures 4 and damage opponent 4. Whispers {1}{R}{R}. | The wreckers light the false beacon, and the sea lights everything else. | core |
| dd-harbourmaster | Constance Reyne, Harbourmaster | SSR | W | Creature, Human Warden, legendary | {3}{W}{W} | 3/4 | Sentinel. Duty, {2}: create a 1/1 white Lantern Wisp token with Skyborne. | She logs every boat that leaves and every boat that returns. The ledgers do not match. | core |
| dd-gate-of-salt | The Salt Gate | SSR | W | Artifact | {2}{W} | none | Duty: prevent combat this turn. During your Dawn: gain 1 life. | The gate holds the tide out and the town in. Nobody has asked which it was built for. | core |
| dd-vigil-at-low-water | Vigil at Low Water | SSR | W | Ritual | {3}{W}{W} | none | Destroy all creatures. Gain 4 life and Foresee 1. Whispers {3}{W}. | At low water the town walks out to see what the sea has left, and prays it is nothing. | core |
| dd-lamp-oil-saint | Saint of the Lamp Oil | SSR | W | Creature, Human Warden | {4}{W} | 2/5 | Warding Gaze. Duty: gain 2 life. Whenever you gain life, put a Mark on this. | She keeps the lamps full and the books balanced, and the second is harder. | flex |
| dd-tidewife | Ysolt the Tidewife | SSR | U | Creature, Mermaid, legendary | {4}{U}{U} | 4/4 | Skyborne. Arrives: grind self 3. Duty: recall target creature with cost 3 or less. | She married the tide. The tide has been very attentive. | core |
| dd-drowned-scholar | Drowned Scholar of the Reach | SSR | U | Creature, Human | {2}{U} | 1/4 | Duty: draw a card, then discard a card. | Everything she knows she read underwater, and it has not stopped being true. | core |
| dd-undertow | Undertow | SSR | U | Charm | {2}{U}{U} | none | Recall target creature and draw 2. Whispers {1}{U}. | The current does not take you out to sea. It takes you down. | core |
| dd-glass-that-came-back | The Glass That Came Back | SSR | U | Artifact | {2}{U} | none | Duty: Foresee 2. Duty, {2}: draw a card. | It was a bottle. Then it spent a century below. Now it shows you things. | flex |
| dd-drowned-bride | The Drowned Bride | SSR | B | Creature, Deep One Horror | {3}{B}{B} | 5/4 | Dreaded. Dread. Dies: return this to your hand. | The wedding was held on the wharf. The groom was never described. | core |
| dd-wharf-rat-queen | Sable, the Wharf Queen | SSR | B | Creature, Human Witch, legendary | {3}{B}{B} | 3/3 | Deathblade. Duty: opponent discards a card at random. Skim {B}. | The town's secrets are kept in her cellar, in jars, and the jars are labelled. | core |
| dd-bargain-below | Bargain Below | SSR | B | Ritual | {2}{B}{B} | none | Sever target creature and draw a card. Whispers {1}{B}{B}. | The price is always fair. That is what makes it unbearable. | core |
| dd-salt-marsh-horror | Marsh-Born Horror | SSR | B | Creature, Deep One Horror | {6}{B} | 5/6 | Dread. Arrives: grind self 2. Whenever another creature you control dies, put a Mark on this. | It was three fishermen. It remembers all three of their wives. | flex |
| dd-reef-warden | Elowen Cray, Reef-Warden | SSR | G | Creature, Human Warden, legendary | {3}{G}{G} | 4/5 | Warding Gaze. Duty: put a Mark on target creature you control. | The reef grows where she tells it to, and lately it has started to answer back. | core |
| dd-kelp-cathedral | Kelp Cathedral | SSR | G | Enchantment | {5}{G}{G} | none | Your Plant tokens get +1/+1. Duty, {2}{G}: create a 2/2 green Kelp Shade token. | The congregation is rooted. The sermons are long. | core |
| dd-something-in-the-nets | Something in the Nets | SSR | G | Creature, Horror | {4}{G}{G} | 5/6 | Dread. Overrun. Arrives: gain 4 life. | The catch was heavy, and it was breathing. | flex |
| dd-marsh-grave-risen | Marsh-Risen | SSR | G | Creature, Horror | {3}{G} | 3/5 | Dread. Arrives: gain 2 life. | Buried in the reeds by her sisters. The reeds did not keep her. | core |
| dd-false-beacon | The False Beacon | SSR | R | Artifact | {2}{R} | none | Duty: damage target creature 1. During your Dawn, if a creature died this turn, damage opponent 1. | A lamp on the wrong rock is a murder that looks like weather. | core |
| dd-wrecker-captain | Halla Brand, Wrecker Captain | SSR | R | Creature, Human, legendary | {3}{R}{R} | 5/4 | Warcry. Overrun. Whenever this attacks, damage opponent 1. Skim {R}. Whispers {1}{R}{R}. | Every ship she saves, she saves for parts. | core |
| dd-storm-surge | Storm Surge | SSR | R | Charm | {1}{R}{R} | none | Damage target creature 4. Damage opponent 2. Whispers {R}. | The surge takes the wharf, the boats, and the argument about whose fault it was. | core |
| dd-drowned-fire | Drowned Fire | SSR | R | Ritual | {1}{R}{R} | none | Damage each opponent's creature 2 and damage opponent 2. Whispers {R}{R}. | Fire does not go out underwater here. It goes quiet. | flex |
| dd-lightkeepers-oath | The Lightkeeper's Oath | SSR | W/U | Ritual | {2}{W}{U} | none | Tap all creatures an opponent controls. Foresee 2. Whispers {1}{W}{U}. | She swore to keep the light. She did not swear to keep it for the living. | flex |

## Super Rare (30; cut keeps 23)

Six per colour. The SR band carries the set's second-tier engines: the
Duty showcase pieces that are not flagships, the mid-cost Horrors that make
Dread a curve rather than a finisher, the Whispers Charms that give blue and
red their instant-speed feel, and the first Rite cards in white and red.

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-bell-ringer-abbess | Abbess of the Bell-Ringers | SR | W | Creature, Human Warden | {3}{W}{W} | 3/4 | Warding Gaze. Duty: tap target creature. | Every bell in Dunmarrow answers to her, except the one that will not ring. | core |
| dd-widows-walk | Widow's Walk | SR | W | Enchantment | {1}{W} | none | Duty: gain 2 life. Whenever a creature you control dies, gain 1 life. | The women watch the sea from the roofs. The sea watches back, and takes notes. | core |
| dd-lamp-lit-vigil | Lamp-Lit Vigil | SR | W | Ritual | {2}{W} | none | Prevent combat this turn. Draw a card. Whispers {1}{W}. | The lamps go up and the boats stay in, and the night is only a night. | core |
| dd-gate-warden | Gate-Warden of the Salt Stair | SR | W | Creature, Human Warden | {4}{W} | 2/6 | Bulwark. Duty: tap target creature an opponent controls. | She has never once left her post. The post has moved twice. | core |
| dd-last-lamp | The Last Lamp on the Point | SR | W | Artifact | {2} | none | Duty, {W}: gain 2 life and Foresee 1. | When the others go dark, this one is meant to still be lit. It has been, so far. | flex |
| dd-rite-of-the-lightkeepers | Rite of the Lightkeepers | SR | W | Ritual | {1}{W}{W} | none | Rite 1. Destroy target creature. Gain 3 life. | One of the Watch walks into the lamp room and does not walk out, and the light is brighter for a year. | core |
| dd-tide-priestess | Tide-Priestess of the Reach | SR | U | Creature, Mermaid | {2}{U}{U} | 3/3 | Skyborne. Arrives: grind self 2. Duty: Foresee 1. | She reads the tide the way the town reads scripture, and with the same results. | core |
| dd-net-mender | Net-Mender of Low Street | SR | U | Creature, Human | {2}{U} | 1/3 | Duty: draw a card, then discard a card. | She mends the nets with what the nets bring in, and the nets have started bringing in thread. | core |
| dd-cold-current | Cold Current | SR | U | Charm | {1}{U} | none | Cancel target spell with cost 3 or less. Whispers {U}. | The sea does not argue. It just declines. | core |
| dd-drowned-archive | The Drowned Archive | SR | U | Enchantment | {3}{U} | none | During your Dawn: grind self 1. Duty, {2}: draw a card. | The town hall flooded in the great tide. The records kept being written. | core |
| dd-thing-in-the-cistern | Thing in the Cistern | SR | U | Creature, Deep One Horror | {3}{U}{U} | 4/5 | Dread. Arrives: recall target creature an opponent controls. | The cistern was sealed. It has been sealed for a while now. It has opinions. | core |
| dd-remembered-shore | Remembered Shore | SR | U | Ritual | {1}{U}{U} | none | Draw 2. Grind self 2. | The beach is where she left it. The town is not. | flex |
| dd-jar-witch | The Jar-Witch of Low Street | SR | B | Creature, Human Witch | {2}{B}{B} | 2/3 | Deathblade. Duty: opponent discards a card at random. | Every secret in a jar, every jar on a shelf, and the shelf is not for sale. | core |
| dd-drowned-sexton | The Drowned Sexton | SR | B | Creature, Human | {3}{B}{B} | 3/3 | Arrives: grind self 3. Duty: return target creature card from your graveyard to your hand. | He buries the drowned and the drowned come back to help. It is a small parish. | core |
| dd-deep-one-hierophant | Deep One Hierophant | SR | B | Creature, Deep One Horror | {3}{B}{B} | 3/4 | Dreaded. Dread. Arrives: opponent loses 2 life and you gain 2 life. | She wears the vestments of the church that used to be here, and wears them well. | core |
| dd-salt-in-the-wound | Salt in the Wound | SR | B | Charm | {B}{B} | none | Target creature gets -3/-3 until end of turn. Whispers {B}. | The sea gets into everything. The sea especially gets into that. | core |
| dd-tithe-to-the-deep | Tithe to the Deep | SR | B | Ritual | {2}{B} | none | Opponent sacrifices a creature. Grind self 2. Opponent loses 2 life. Whispers {1}{B}. | The collection plate goes round, and it comes back wet. | flex |
| dd-what-the-nets-remember | What the Nets Remember | SR | B | Creature, Deep One Horror | {4}{B}{B} | 4/5 | Dread. Dies: create a 1/1 black Drowned Spirit token. Whenever another Horror you control dies, you gain 2 life. | It has the faces of everyone the nets ever lost, and it is learning to use them. | flex |
| dd-reef-shaman | Reef Shaman of the Shallows | SR | G | Creature, Human Witch | {3}{G}{G} | 3/4 | Duty: put a Mark on target creature. Whenever you put a Mark on a creature, gain 1 life. | The coral takes to her like a garden takes to weather. | core |
| dd-kelp-shade-caller | Kelp-Shade Caller | SR | G | Creature, Human | {3}{G} | 1/3 | Duty, {1}{G}: create a 2/2 green Kelp Shade token. | She whistles and the marsh stands up. | core |
| dd-tidepool-colossus | Tidepool Colossus | SR | G | Creature, Horror | {5}{G}{G} | 6/7 | Dread. Overrun. | It fits in a tidepool the way a cathedral fits in a town: badly, and it does not care. | core |
| dd-marsh-root-warden | Marsh-Root Warden | SR | G | Creature, Human Warden | {4}{G} | 4/4 | Sentinel. Duty, {1}: put a Mark on this. | Her post is the marsh road, and the marsh road is never in the same place twice. | flex |
| dd-drowned-grove | Drowned Grove | SR | G | Enchantment | {3}{G} | none | Your creatures with Marks get +1/+1. Duty: put a Mark on target creature you control. | The trees went under a century ago and kept growing. Nobody has told them. | core |
| dd-the-catch | The Catch | SR | G | Ritual | {5}{G} | none | Create two 2/2 green Kelp Shade tokens. Gain 2 life. | Some mornings the nets are full of something the town can use. | flex |
| dd-wrecker-lantern | Wrecker's Lantern | SR | R | Artifact | {2} | none | Duty, {R}: damage target creature 1. | Hang it on the wrong rock, wait, and the sea does the rest. | core |
| dd-storm-choir | Storm Choir | SR | R | Creature, Human | {4}{R} | 4/3 | Warcry. Rage. Duty: damage opponent 2. | They sing the storm in, and the storm is a good listener. | core |
| dd-rite-of-the-false-beacon | Rite of the False Beacon | SR | R | Ritual | {1}{R}{R} | none | Rite 1. Damage target creature 7 and damage opponent 3. | The lamp needs oil. The lamp is not particular about what burns. | core |
| dd-gale-charm | Gale | SR | R | Charm | {2}{R} | none | Damage target creature 3. Whispers {R}. | It came in off the water at noon and by one there was no wharf. | core |
| dd-salt-fire-witch | Salt-Fire Witch | SR | R | Creature, Human Witch | {2}{R}{R} | 4/2 | First Blade. Skim {R}. | Her fire burns green on the wet wood and she likes it that way. | flex |
| dd-breakwater-brawl | Breakwater Brawl | SR | R | Ritual | {1}{R} | none | Damage each creature 2. Whispers {R}. | The fishermen settle it on the breakwater, and the breakwater settles it for them. | flex |

## Rare (96; cut keeps 75)

Eighteen per colour plus six multicolour. The Rare band is where the Horror
lord lives, where each colour gets its Duty creatures for the AI policy's
creature branch, where the permanent answers and the second looters sit,
and where Retell and Empower are sprinkled.

### White (18)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-lamp-warden | Lamp-Warden of the Point | R | W | Creature, Human Warden | {1}{W} | 2/2 | Warding Gaze. Arrives: gain 1 life. | The oil is measured in nights, and she has never run short. | core |
| dd-bell-tower-sentry | Bell-Tower Sentry | R | W | Creature, Human Warden | {3}{W} | 2/4 | Sentinel. Arrives: Foresee 1. | She rings the hours and counts the boats, and lately the counts disagree. | core |
| dd-salt-stair-captain | Captain of the Salt Stair | R | W | Creature, Human Warden | {3}{W} | 2/4 | Warding Gaze. Your other Wardens get +0/+1. | Her stair is the last dry step between the town and the harbour. | core |
| dd-drowned-nun | Sister of the Drowned Chapel | R | W | Creature, Human | {2}{W} | 2/3 | Arrives: gain 2 life. Skim {W}. Whispers {W}. | The chapel floods at high water and she holds the service anyway. | flex |
| dd-widows-lantern | Widow's Lantern | R | W | Artifact | {1} | none | Duty, {W}: gain 2 life. | Lit for a husband. Kept lit for a town. | core |
| dd-tide-gate | Tide-Gate | R | W | Artifact | {3} | none | Duty, {W}: tap target creature an opponent controls. | Iron and prayer, in that order. | core |
| dd-salt-ward | Salt Ward | R | W | Enchantment | {W} | none | Your creatures get +0/+1. | A line of salt across the door, renewed every evening, and it has always been enough. | flex |
| dd-what-the-lamps-saw | What the Lamps Saw | R | W | Ritual | {2}{W} | none | Destroy target Artifact or Enchantment. Foresee 2. Whispers {1}{W}. | The lamps are lit so the town can see. What the lamps see is another matter. | core |
| dd-hold-the-line | Hold the Line | R | W | Charm | {1}{W} | none | Target creature gets +2/+2 until end of turn. Foresee 1. | Not a step. Not for anything. | flex |
| dd-vigil-bell | Vigil Bell | R | W | Ritual | {2}{W} | none | Tap all creatures an opponent controls. Foresee 1. | When the vigil bell rings, everyone in Dunmarrow stops what they are doing. Everyone. | core |
| dd-watch-sergeant | Watch-Sergeant Alder | R | W | Creature, Human Warden | {3}{W}{W} | 3/3 | Warcry. Duty, {2}: create a 1/1 white Lantern Wisp token with Skyborne. | She hands out lamps like orders and expects both back. | core |
| dd-rite-of-the-salt-gate | Rite of the Salt Gate | R | W | Ritual | {W}{W} | none | Rite 1. Destroy target creature with attack 4 or more. | The gate takes one to hold against many. It has always been a fair trade on paper. | core |
| dd-lamp-oil-bargain | Oil for the Lamps | R | W | Ritual | {2}{W} | none | Gain 4 life. Draw a card. | The oil comes in barrels nobody ordered, from a supplier nobody has met. | flex |
| dd-drowned-saint | The Drowned Saint | R | W | Creature, Spirit | {4}{W}{W} | 2/5 | Skyborne. Warding Gaze. Arrives: gain 3 life. Empower {2}: destroy target creature with cost 3 or less. | She went into the water for the town, and the town is not sure she came out. | flex |
| dd-shore-patrol | Shore Patrol | R | W | Creature, Human Warden | {1}{W}{W} | 3/2 | First Blade. Warcry. | Two women and a lantern between the town and the tide. | flex |
| dd-mending-the-nets | Mending the Nets | R | W | Charm | {W} | none | Prevent combat damage to target creature this turn. Gain 1 life. | Torn nets, torn sails, torn people. She mends what she can. | flex |
| dd-the-morning-count | The Morning Count | R | W | Enchantment | {1}{W} | none | During your Dawn: gain 1 life and Foresee 1. | Every dawn the Watch counts the town. The number is the same. The faces are not. | flex |
| dd-lightkeepers-apprentice | Lightkeeper's Apprentice | R | W | Creature, Human Warden | {1}{W} | 1/2 | Skim {W}. Arrives: Foresee 1. | She learned the lamp before she learned to read, and reads only by it. | stretch |

### Blue (18)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-tide-reader | Tide-Reader of the Reach | R | U | Creature, Human | {2}{U} | 1/3 | Duty: Foresee 2. | The tide tables are printed a year ahead and she corrects them by hand. | core |
| dd-harbour-looter | Salvage Diver | R | U | Creature, Human | {2}{U} | 1/3 | Duty: draw a card, then discard a card. | Everything down there belonged to someone, and she keeps a list. | core |
| dd-mermaid-of-the-cold-water | Mermaid of the Cold Water | R | U | Creature, Mermaid | {2}{U} | 2/2 | Skyborne. Arrives: grind self 2. | She does not come up for air. She comes up for names. | core |
| dd-deep-one-envoy | Deep One Envoy | R | U | Creature, Deep One Horror | {2}{U}{U} | 3/3 | Dread. Arrives: Foresee 2. | She brings terms. The terms are reasonable. That is the part nobody can stand. | core |
| dd-drowned-bell-choir | Drowned Bell Choir | R | U | Creature, Spirit | {3}{U} | 2/4 | Skyborne. Arrives: tap target creature. | You can hear the bells from below at low water, and they are keeping time. | core |
| dd-tidal-memory | Tidal Memory | R | U | Charm | {1}{U} | none | Draw a card. Grind self 1. Whispers {U}. | The sea gives a thing back a little at a time, and never the part you wanted first. | core |
| dd-undertow-pull | Undertow Pull | R | U | Charm | {1}{U} | none | Recall target creature. Whispers {U}. | It is not a current. It is a hand. | core |
| dd-still-water | Still Water | R | U | Charm | {3}{U} | none | Cancel target spell. Whispers {2}{U}. | The harbour went flat at noon. Nobody on the wharf said a word. | core |
| dd-charts-of-the-drowned-coast | Charts of the Drowned Coast | R | U | Artifact | {5} | none | Duty, {3}: Foresee 1, then draw a card. | Accurate to the inch. The inches are underwater. | core |
| dd-bell-below | The Bell Below | R | U | Enchantment | {1}{U} | none | During your Dawn: grind self 1. Whenever you cast a Charm, Foresee 1. | One bell in the harbour rings from below the water. It is never wrong about the weather. | flex |
| dd-salt-lens | Salt Lens | R | U | Artifact | {1} | none | During your Dawn: Foresee 1. | Glass from the drowned church, ground by hand. It shows the coast as it was. | flex |
| dd-drowned-lighthouse-keeper | Keeper of the Drowned Light | R | U | Creature, Spirit | {3}{U}{U} | 3/4 | Skyborne. Arrives: recall target creature. Whispers {2}{U}. | The first lighthouse is under the harbour now. She still keeps it. | flex |
| dd-what-the-tide-took | What the Tide Took | R | U | Ritual | {3}{U} | none | Draw 2. Retell {3}{U}. | The list is long and the tide is not sorry. | flex |
| dd-fog-that-stays | The Fog That Stays | R | U | Enchantment | {2}{U} | none | Creatures an opponent controls get -1/-0. During your Dawn: Foresee 1. | It came in with the tide in March. It is September. | flex |
| dd-current-caller | Current-Caller | R | U | Creature, Human Witch | {2}{U} | 2/3 | Skim {U}. Arrives: Foresee 1. | She calls the boats home. Sometimes they come. | flex |
| dd-drowned-ledger | The Drowned Ledger | R | U | Ritual | {1}{U} | none | Grind self 3. Draw a card. Retell {2}{U}. | The harbourmaster's ledger went into the water in 1811 and has been updated since. | flex |
| dd-cold-water-horror | Cold-Water Horror | R | U | Creature, Deep One Horror | {4}{U}{U} | 5/5 | Dread. Untouchable. | It came up under the ice and the ice did not notice. | flex |
| dd-reef-glass-oracle | Reef-Glass Oracle | R | U | Creature, Human Witch | {1}{U}{U} | 1/4 | Arrives: Foresee 3. | She reads the future in green glass, and the future is mostly water. | stretch (AI-risk) |

### Black (18)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-horror-lord | The Deacon of the Deep | R | B | Creature, Deep One Horror | {4}{B}{B} | 3/4 | Dread. Your other Horrors get +1/+0 and have Dreaded. | The church still holds services. The congregation has changed. | core |
| dd-cellar-witch | Cellar-Witch of Low Street | R | B | Creature, Human Witch | {2}{B} | 1/2 | Duty: draw a card, then discard a card. | Her cellar is dry, which on Low Street is its own kind of witchcraft. | core |
| dd-deep-one-bride | Deep One Bride | R | B | Creature, Deep One Horror | {2}{B}{B} | 4/3 | Dread. Dies: opponent loses 2 life. | The dress was her grandmother's. So was the groom. | core |
| dd-drowned-fisherman | The Drowned Fisherman | R | B | Creature, Spirit | {1}{B}{B} | 3/2 | Deathblade. Arrives: grind self 2. Whispers {B}{B}. | He went out in the storm of '09 and has been coming home ever since. | core |
| dd-the-price | The Price | R | B | Charm | {1}{B} | none | Destroy target creature with cost 3 or less. Whispers {B}. | Reasonable. Fair. Final. | core |
| dd-tithe-collector | Tithe-Collector | R | B | Creature, Deep One Horror | {4}{B} | 2/4 | Dread. Duty: opponent loses 1 life and you gain 1 life. | She comes round on the first of the month with a basket, and the basket is always heavier leaving. | core |
| dd-what-the-jars-hold | What the Jars Hold | R | B | Ritual | {2}{B} | none | Opponent discards two cards at random. Opponent loses 2 life. Whispers {1}{B}. | Labelled, dated, and shelved by the sin. | core |
| dd-low-tide-grave | Low-Tide Grave | R | B | Enchantment | {1}{B} | none | During your Dawn: grind self 1. Whenever a creature you control dies, opponent loses 1 life. | The graves on the flats are dug at low water and the sea does the filling. | core |
| dd-salt-marsh-bargain | Salt-Marsh Bargain | R | B | Ritual | {1}{B}{B} | none | Return target creature card from your graveyard to the battlefield. It has Dreaded. | Something comes back. It is not always what you asked for. | flex |
| dd-deep-one-midwife | Deep One Midwife | R | B | Creature, Deep One Horror | {5}{B} | 3/4 | Dread. Arrives: create a 2/2 black Deep-Spawn token. | Every birth in Dunmarrow has been attended. Not every one by a doctor. | core |
| dd-drowned-preacher | The Drowned Preacher | R | B | Creature, Human | {2}{B} | 2/3 | Skim {B}. Arrives: grind self 2. | He preaches from the end of the wharf, to the water, and the water says amen. | flex |
| dd-black-water | Black Water | R | B | Ritual | {2}{B}{B} | none | Destroy all creatures. You lose 3 life. Grind self 2. Whispers {1}{B}{B}. | The harbour turned black on a Tuesday and everything in it stopped. | core |
| dd-widows-bargain | The Widow's Bargain | R | B | Charm | {B} | none | Target creature gets -2/-2 until end of turn. Whispers {B}. | She asked for her husband back and got a very good offer instead. | flex |
| dd-marsh-lantern | Marsh-Lantern | R | B | Artifact | {2} | none | During your Dawn: opponent loses 1 life. | Follow it and you will not drown. You will do something else. | flex |
| dd-horror-in-the-crib | Horror in the Crib | R | B | Creature, Deep One Horror | {1}{B} | 2/1 | Dread. Dies: grind self 2. | It was the right weight. It had the right eyes. It was not the right child. | flex |
| dd-drowned-chorus | Drowned Chorus | R | B | Enchantment | {1}{B} | none | Whenever a creature an opponent controls dies, you gain 3 life. | They sing every drowning, and the town has learned the tune. | flex |
| dd-what-was-promised | What Was Promised | R | B | Ritual | {1}{B} | none | Return target creature card from your graveyard to your hand and grind self 2. Retell {2}{B}. | The Deep keeps its promises. That is the whole problem. | flex |
| dd-reckoning-below | Reckoning Below | R | B | Ritual | {1}{B}{B} | none | Each player sacrifices a creature. Opponent loses 2 life. Grind self 2. | The count is taken at the waterline, and the water counts too. | stretch |

### Green (18)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-reef-tender | Reef-Tender | R | G | Creature, Human Witch | {2}{G} | 1/3 | Duty: put a Mark on target creature you control. | Coral grows a finger's width a year, unless she asks. | core |
| dd-kelp-shade-warden | Kelp-Shade Warden | R | G | Creature, Human Warden | {3}{G} | 2/3 | Arrives: create a 2/2 green Kelp Shade token. | The marsh keeps its own watch, and she is its liaison. | core |
| dd-reef-horror | Reef Horror | R | G | Creature, Horror | {3}{G}{G} | 4/6 | Dread. Warding Gaze. | The reef has a shape now. The shape has a face. | core |
| dd-tidepool-wall | Tidepool Wall | R | G | Creature, Plant | {1}{G} | 0/6 | Bulwark. | It grows a foot a year and has not stopped since the town was founded. | core |
| dd-marsh-growth | Marsh Growth | R | G | Charm | {1}{G} | none | Target creature gets +3/+3 until end of turn. Whispers {G}. | Overnight, the reeds. By morning, the road is gone. | core |
| dd-drowned-orchard | The Drowned Orchard | R | G | Enchantment | {6}{G} | none | During your Dawn: create a 2/2 green Kelp Shade token. | The apples are salt now, and the town eats them anyway. | core |
| dd-coral-mother | Coral-Mother | R | G | Creature, Human Witch | {4}{G}{G} | 4/5 | Duty: put a Mark on each creature you control with a Mark. | What she grows, keeps growing. | core |
| dd-something-under-the-wharf | Something Under the Wharf | R | G | Creature, Horror | {2}{G}{G} | 4/4 | Dread. Overrun. | It has been under there a long time and the pilings are its ribs. | core |
| dd-net-full-of-stars | Net Full of Stars | R | G | Ritual | {2}{G} | none | Create a 2/2 green Kelp Shade token and put a Mark on it. | The catch glowed. The catch was not fish. | flex |
| dd-marsh-road | The Marsh Road | R | G | Enchantment | {2}{G} | none | Your Plant tokens get +1/+1. Your Plant tokens have Sentinel. | The road is where the marsh allows it to be, one day at a time. | flex |
| dd-drowned-druid | Drowned Druid of the Reach | R | G | Creature, Human Witch | {2}{G} | 2/4 | Skim {G}. Arrives: gain 2 life. | She talks to the kelp and the kelp is chatty. | flex |
| dd-tide-worn-giant | Tide-Worn Giant | R | G | Creature, Horror | {4}{G}{G} | 5/6 | Dread. Sentinel. | It was a statue on the point. The tide worked on it. It works back now. | core |
| dd-reef-bloom | Reef Bloom | R | G | Ritual | {G}{G} | none | Put a Mark on each creature you control and Foresee 1. | One night a year the reef flowers, and the whole coast holds its breath. | flex |
| dd-marsh-wight | Marsh-Wight | R | G | Creature, Spirit | {4}{G} | 4/3 | Warding Gaze. Dies: create a 2/2 green Kelp Shade token. Whispers {3}{G}. | Buried in the marsh, come back as the marsh. | flex |
| dd-old-growth | Old Growth | R | G | Enchantment | {G}{G} | none | Your creatures with Marks get +1/+1. Your creatures with Marks have Overrun. | The forest that was here before the town is still here, underneath. | flex |
| dd-shallows-stalker | Shallows Stalker | R | G | Creature, Beast | {2}{G} | 3/3 | Warcry. Warding Gaze. | It hunts the flats at low water and it is not fussy. | flex |
| dd-the-marsh-remembers | The Marsh Remembers | R | G | Ritual | {1}{G} | none | Return target creature card from your graveyard to your hand. Put a Mark on target creature you control. | Everything the town buries in the marsh, the marsh gives back a little grown. | flex |
| dd-drowned-harvest | Drowned Harvest | R | G | Ritual | {5}{G}{G} | none | Create three 2/2 green Kelp Shade tokens. | The fields flooded, and the harvest came up anyway, and it walked. | stretch |

### Red (18)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-wrecker | Wrecker of the Reach | R | R | Creature, Human | {2}{R} | 2/2 | Warcry. Duty, {1}: damage target creature 1. | A lamp, a rock, and a conscience she keeps in a drawer. | core |
| dd-storm-witch | Storm-Witch | R | R | Creature, Human Witch | {3}{R} | 3/2 | Duty, {R}: damage target creature 2. | She does not call the weather. She dares it. | core |
| dd-breakwater-brute | Breakwater Brute | R | R | Creature, Human | {2}{R}{R} | 5/3 | Rage. When this attacks, damage opponent 1. | Every argument on the breakwater has been settled the same way for a century. | core |
| dd-salt-fire | Salt-Fire | R | R | Charm | {1}{R} | none | Damage target creature 2. Whispers {R}. | Green flame on wet wood. It should not burn. It does. | core |
| dd-lightning-on-the-water | Lightning on the Water | R | R | Charm | {1}{R}{R} | none | Damage target creature 4. Damage opponent 2. Whispers {R}{R}. | The whole harbour lit up at once, and for a second everyone saw what was under it. | core |
| dd-wreck-fire | Wreck-Fire | R | R | Ritual | {1}{R} | none | Damage each creature 1 and damage opponent 2. Whispers {R}. | The wreck burned all night and the town watched from the roofs. | flex |
| dd-rite-of-the-wreckers | Rite of the Wreckers | R | R | Ritual | {R}{R} | none | Rite 1. Damage target creature 4 and damage opponent 2. | Somebody has to carry the lamp out onto the rock. Somebody always volunteers. | core |
| dd-drowned-forge | The Drowned Forge | R | R | Artifact | {3} | none | Duty, {R}: damage target creature 2. | It went under in the great tide. The bellows still work. | core |
| dd-storm-front | Storm Front | R | R | Enchantment | {1}{R} | none | Your creatures get +1/+0. Your creatures have Warcry. | It sits on the horizon for a week, and then it does not. | flex |
| dd-gale-rider | Gale-Rider | R | R | Creature, Human | {4}{R} | 4/3 | Warcry. Skyborne. Skim {R}. | She rides the storm in on a sail she cut from a shroud. | flex |
| dd-fire-on-the-point | Fire on the Point | R | R | Ritual | {2}{R}{R} | none | Damage each creature an opponent controls 3. Whispers {1}{R}{R}. | A false beacon, a real wreck, and a night nobody in town will discuss. | core |
| dd-wrecker-queen | The Wrecker Queen | R | R | Creature, Human, legendary | {2}{R}{R} | 4/4 | Rage. Overrun. Whenever this attacks, damage target creature 1. | Every wreck on the Reach for thirty years, and not one of them her fault, officially. | flex |
| dd-drowned-cannon | Drowned Cannon | R | R | Artifact | {2} | none | Duty, {1}{R}: damage opponent 2. | Raised from the wreck of a warship nobody remembers losing. | flex |
| dd-heat-of-the-forge | Heat of the Forge | R | R | Charm | {R} | none | Target creature gets +3/+0 and Warcry until end of turn. | The forge was drowned. The heat was not. | flex |
| dd-storm-tide-horror | Storm-Tide Horror | R | R | Creature, Spirit | {3}{R}{R} | 5/4 | Dreaded. Whenever this attacks, damage opponent 2. | It only comes up in the storm, and the storm comes up for it. | flex |
| dd-false-lamp-bearer | False-Lamp Bearer | R | R | Creature, Human | {1}{R}{R} | 3/2 | First Blade. Warcry. | She carries the light that leads ships onto the rocks, and sleeps fine. | flex |
| dd-reach-fire-witch | Fire-Witch of the Reach | R | R | Creature, Human Witch | {3}{R} | 3/3 | Arrives: damage target creature 2. Retell {2}{R}: damage target creature 2. | The sea put her fire out once. She has been making the sea pay ever since. | flex |
| dd-breakwater-riot | Breakwater Riot | R | R | Ritual | {1}{R}{R} | none | Damage each creature 2. Your creatures get +1/+0 until end of turn. | The whole wharf, all at once, and the tide coming in behind. | stretch |

### Multicolour (6)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-drowned-deacon | The Drowned Deacon | R | U/B | Creature, Deep One Horror | {2}{U}{B} | 2/4 | Dread. Arrives: grind self 3. Duty: Foresee 1. | He kept the church books. He keeps them still, in a different ink. | core |
| dd-horror-garden | The Horror Garden | R | B/G | Enchantment | {2}{B}{G} | none | During your Dawn: create a 1/1 black Drowned Spirit token. Whenever you sacrifice a creature, gain 1 life. | Planted in the marsh, fed on the drowned, and coming up beautifully. | core |
| dd-watch-and-tide | Watch and Tide | R | W/U | Charm | {1}{W}{U} | none | Tap target creature, then draw a card. Whispers {W}{U}. | The Watch sets the lamps by the tide, and the tide by the lamps, and neither has been wrong yet. | flex |
| dd-marsh-mother-horror | Marsh-Mother | R | B/G | Creature, Deep One Horror | {4}{B}{G} | 4/4 | Dread. Overrun. Dies: create a 2/2 green Kelp Shade token. | She feeds the marsh and the marsh feeds her, and the town is in the middle. | core |
| dd-storm-and-salt | Storm and Salt | R | R/B | Ritual | {B}{R} | none | Damage target creature 3. Opponent discards a card at random. | Wind off the water and something in it that is not spray. | flex |
| dd-lamp-and-lightning | Lamp and Lightning | R | R/W | Creature, Human Warden | {3}{R}{W} | 3/4 | Warcry. Sentinel. Duty, {1}: damage target creature 1. | The Watch keeps the lamps. She keeps the Watch. | flex |

## Common (160; cut keeps 124)

Thirty-two per colour, no multicolour. The common band carries the set's
enabler density (Skim carriers, self-mill arrivals, the two common
looters), the go-wide bodies, the fodder, the cheap Duty pieces the AI can
use every turn, one Whispers card per colour per five rows, and the
board-first commons the brief demands: at most thirty percent vanilla or
near-vanilla.

### White (32)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-lamp-bearer | Lamp-Bearer | C | W | Creature, Human Warden | {W} | 1/2 | Arrives: gain 1 life. | The lamp is heavier than she is and she carries it anyway. | core |
| dd-wharf-watch | Wharf Watch | C | W | Creature, Human Warden | {1}{W} | 2/2 | Sentinel. | She counts the boats out and counts them in. | core |
| dd-salt-stair-guard | Salt-Stair Guard | C | W | Creature, Human Warden | {2}{W} | 2/4 | Warding Gaze. | The stair is narrow and so is she, and neither gives. | core |
| dd-chapel-sister | Chapel Sister | C | W | Creature, Human | {1}{W} | 1/3 | Arrives: gain 2 life. | The chapel floor is wet at every service. She has stopped mentioning it. | core |
| dd-bell-hand | Bell-Hand | C | W | Creature, Human Warden | {2}{W} | 3/2 | Arrives: tap target creature with cost 2 or less. | She rings the hour and something out on the water rings back. | core |
| dd-net-mender-of-the-point | Net-Mender of the Point | C | W | Creature, Human | {W} | 1/1 | Skim {W}. Arrives: gain 1 life. | She mends what the sea tears, which is everything, eventually. | flex |
| dd-shore-lantern | Shore Lantern | C | W | Artifact | {1} | none | During your Dawn: gain 1 life. | One lamp on the shore, so the boats know where the land still is. | core |
| dd-harbour-vigil | Harbour Vigil | C | W | Charm | {W} | none | Prevent combat damage to target creature this turn. | Stand between the town and the water, and keep standing. | core |
| dd-tide-warden | Tide-Warden | C | W | Creature, Human Warden | {3}{W} | 3/4 | Arrives: gain 2 life. | The tide comes, the tide goes, and she writes down the difference. | core |
| dd-widow-of-the-reach | Widow of the Reach | C | W | Creature, Human | {2}{W} | 2/3 | Whenever another creature you control dies, gain 1 life. | The sea took her husband and she has been sending it the bill. | flex |
| dd-lamp-oil | Lamp Oil | C | W | Charm | {1}{W} | none | Target creature gets +1/+2 until end of turn. Gain 1 life. | A full lamp is a full night. | flex |
| dd-drowned-chapel-bell | Chapel Bell | C | W | Ritual | {W} | none | Tap two target creatures. | The bell rings and the town stops. All of it. | core |
| dd-salt-and-prayer | Salt and Prayer | C | W | Ritual | {3}{W} | none | Sever target creature with attack 3 or more. Whispers {2}{W}. | Salt across the door, a word at the window, and the thing goes back to the water. | core |
| dd-watch-recruit | Watch Recruit | C | W | Creature, Human Warden | {1}{W} | 2/1 | Warcry. | New to the lamp, new to the town, and already counting boats. | flex |
| dd-point-sentinel | Sentinel of the Point | C | W | Creature, Human Warden | {3}{W} | 2/5 | Sentinel. Warding Gaze. | She watches the water and the sky, and prefers the sky. | core |
| dd-mending-hands | Mending Hands | C | W | Creature, Human | {2}{W} | 2/2 | Arrives: prevent combat damage to target creature this turn. | Nets, sails, wounds. She does not ask which. | flex |
| dd-lantern-wisp-caller | Wisp-Caller | C | W | Creature, Human Warden | {3}{W} | 1/3 | Arrives: create a 1/1 white Lantern Wisp token with Skyborne. | She lights one lamp and the lamp lights another. | core |
| dd-whitecap-rider | Whitecap Rider | C | W | Creature, Human | {3}{W} | 3/3 | Skyborne. | She rides the crests in a boat too small to be sensible. | flex |
| dd-vigil-candle | Vigil Candle | C | W | Enchantment | {W} | none | During your Dawn: gain 1 life. | Lit at dusk, out by dawn, and the night between is the town's. | flex |
| dd-salt-line | Salt Line | C | W | Charm | {W} | none | Tap target creature. | A line of salt, renewed each evening, and nothing has crossed it yet. | core |
| dd-drowned-chapel-warden | Chapel Warden | C | W | Creature, Human Warden | {2}{W} | 2/3 | Arrives: Foresee 1. | She keeps the chapel and the chapel keeps its secrets, badly. | flex |
| dd-shore-mother | Shore-Mother | C | W | Creature, Human | {4}{W} | 3/5 | Arrives: gain 3 life. Skim {1}{W}. | Every child in Dunmarrow has been pulled from the water by her at least once. | flex |
| dd-lamp-relay | Lamp Relay | C | W | Ritual | {3}{W} | none | Create two 1/1 white Lantern Wisp tokens with Skyborne. | Lamp to lamp along the coast, and the message arrives before the tide. | core |
| dd-the-watch-holds | The Watch Holds | C | W | Charm | {1}{W} | none | Your creatures get +1/+1 until end of turn. | Not tonight. Not on this stair. | flex |
| dd-drowned-lantern | Drowned Lantern | C | W | Creature, Spirit | {2}{W} | 2/2 | Skyborne. Whispers {W}. | It went down with the boat and it is still lit. | core |
| dd-rite-of-the-lamp | Rite of the Lamp | C | W | Ritual | {W} | none | Rite 1. Gain 4 life and Foresee 2. | One into the lamp room. The light is brighter for it. | flex |
| dd-breakwater-warden | Breakwater Warden | C | W | Creature, Human Warden | {4}{W} | 4/4 | Warding Gaze. Sentinel. | She holds the breakwater. The breakwater holds the town. | flex |
| dd-salt-chapel | Salt Chapel | C | W | Enchantment | {W} | none | Whenever a creature arrives under your control, gain 2 life. | The doors are always open. The floor is always wet. | flex |
| dd-morning-bell-warden | Morning-Bell Warden | C | W | Creature, Human Warden | {1}{W} | 1/2 | During your Dawn: gain 1 life. | The first bell is hers. The town has never woken to any other. | stretch |
| dd-lamp-and-ledger | Lamp and Ledger | C | W | Ritual | {2}{W} | none | Gain 3 life. Draw a card. | Every lamp accounted for. Every night. | flex |
| dd-point-keeper | Keeper of the Point | C | W | Creature, Human Warden | {3}{W} | 3/3 | Sentinel. | She has kept the point for twenty years and the point has kept her. | flex |
| dd-chapel-ward | Chapel Ward | C | W | Charm | {1}{W} | none | Destroy target Artifact or Enchantment. | Salt, prayer, and a hammer, in that order. | core |

### Blue (32)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-tide-clerk | Tide-Clerk | C | U | Creature, Human | {1}{U} | 1/3 | Arrives: Foresee 1. | She writes the tides in a ledger and the ledger has begun to disagree. | core |
| dd-low-street-looter | Low Street Looter | C | U | Creature, Human | {2}{U} | 1/2 | Duty: draw a card, then discard a card. | Everything the tide leaves on Low Street is hers by noon. | core |
| dd-harbour-mermaid | Harbour Mermaid | C | U | Creature, Mermaid | {2}{U} | 2/2 | Skyborne. Arrives: grind self 1. | She surfaces by the wharf at dusk and asks the boats their names. | core |
| dd-drowned-scrivener | Drowned Scrivener | C | U | Creature, Human | {2}{U} | 2/3 | Arrives: Foresee 2. | She copies the drowned records in a hand nobody living taught her. | core |
| dd-cold-water-diver | Cold-Water Diver | C | U | Creature, Human | {3}{U} | 3/3 | Arrives: grind self 2. Skim {U}. | What she brings up, she brings up wet and wrong. | core |
| dd-tide-glass | Tide-Glass | C | U | Artifact | {1} | none | During your Dawn: Foresee 1. | Green glass from the drowned church. Hold it to the light and the coast is different. | core |
| dd-fog-bank | Fog Bank | C | U | Charm | {U} | none | Tap target creature. Whispers {U}. | It came in with the tide and it did not leave with it. | core |
| dd-undertow-charm | Undertow | C | U | Charm | {U} | none | Recall target creature with cost 2 or less. | The current is a hand, and it is patient. | core |
| dd-deep-one-scout | Deep One Scout | C | U | Creature, Deep One Horror | {2}{U}{U} | 3/3 | Dread. | She comes up under the boats to count them. | core |
| dd-tide-that-turns | The Tide That Turns | C | U | Ritual | {3}{U} | none | Draw 2. Grind self 1. Whispers {2}{U}. | Out, in, and the town between. | core |
| dd-still-harbour | Still Harbour | C | U | Charm | {1}{U} | none | Cancel target spell with cost 2 or less. | The water went flat, and the boats stopped, and nobody spoke. | core |
| dd-drowned-choir-singer | Drowned Chorister | C | U | Creature, Spirit | {2}{U} | 1/4 | Skyborne. | One voice in the choir below, and it knows the words. | flex |
| dd-net-of-glass | Net of Glass | C | U | Artifact | {4} | none | Duty, {3}: draw a card. | Woven from bottle glass and drowned thread, and it catches memory. | flex |
| dd-current-reader | Current-Reader | C | U | Creature, Human Witch | {U} | 1/1 | Skim {U}. Arrives: Foresee 1. | She reads the current the way others read a face. | flex |
| dd-drowned-bell | Drowned Bell | C | U | Enchantment | {1}{U} | none | During your Dawn: grind self 1 and Foresee 1. | It rings below the harbour at the turn of the tide, and the tide is never late. | core |
| dd-deep-envoy-lesser | Envoy of the Cold Water | C | U | Creature, Mermaid | {3}{U} | 2/4 | Skyborne. Arrives: Foresee 1. | She brings the terms. The terms are always the same. | flex |
| dd-salt-fog | Salt Fog | C | U | Ritual | {3}{U} | none | Tap all creatures an opponent controls. Draw a card. | It rolled in at dawn and the town stayed in bed. | core |
| dd-tidewater-scholar | Tidewater Scholar | C | U | Creature, Human | {3}{U} | 2/4 | Arrives: draw a card, then discard a card. | Everything she knows, she learned wet. | flex |
| dd-memory-of-the-drowned | Memory of the Drowned | C | U | Charm | {2}{U} | none | Draw a card. Foresee 1. Whispers {U}. | The sea gives it back a little at a time. | flex |
| dd-mermaid-of-the-shallows | Mermaid of the Shallows | C | U | Creature, Mermaid | {1}{U} | 1/2 | Skyborne. Skim {U}. | She sings at the sandbar and the boats do not come back. | flex |
| dd-drowned-lamp-keeper | Drowned Lamp-Keeper | C | U | Creature, Spirit | {3}{U}{U} | 3/4 | Skyborne. Arrives: recall target creature with cost 2 or less. | The first light was hers. It is still hers. It is under the water. | flex |
| dd-cold-current-horror | Cold-Current Horror | C | U | Creature, Deep One Horror | {4}{U} | 4/5 | Dread. | It moves with the cold water and the cold water moves with it. | core |
| dd-harbour-glass | Harbour Glass | C | U | Ritual | {1}{U} | none | Foresee 3. Draw a card. | Look into it long enough and the harbour looks back. | flex |
| dd-tide-scribe | Tide-Scribe | C | U | Creature, Human | {2}{U} | 1/3 | Whenever you Skim, Foresee 1. | She writes down what the tide brings, and it brings a great deal. | stretch (AI-risk) |
| dd-drift-net | Drift-Net | C | U | Enchantment | {1}{U} | none | Whenever you cast a Charm, Foresee 1. | Cast wide, and what comes up is not always fish. | stretch (AI-risk) |
| dd-drowned-cartographers-mate | Cartographer's Mate | C | U | Creature, Human | {2}{U} | 2/2 | Arrives: grind self 2. Whispers {U}. | She draws the coast as it is at low tide, which is to say, as it was. | core |
| dd-reach-tide-caller | Tide-Caller of the Reach | C | U | Creature, Human Witch | {2}{U} | 2/3 | Arrives: tap target creature. | She calls the tide and the tide, being polite, comes. | core |
| dd-glass-eyed-drowned | The Glass-Eyed Drowned | C | U | Creature, Spirit | {2}{U} | 1/1 | Skyborne. Dies: draw a card. | They came up with the storm and they have not blinked since. | flex |
| dd-cold-harbour | Cold Harbour | C | U | Charm | {1}{U} | none | Recall target creature. Whispers {U}. | The harbour froze, and the boat in it, and the thing under the boat. | flex |
| dd-deep-water-lookout | Deep-Water Lookout | C | U | Creature, Human | {2}{U} | 2/2 | Skim {U}. Arrives: Foresee 1. | She looks for boats. She sees other things. | flex |
| dd-drowned-tides-bargain | The Tide's Bargain | C | U | Ritual | {4}{U} | none | Draw 3. Grind self 3. | The sea lends freely and collects the same way. | flex |
| dd-shallows-horror | Shallows Horror | C | U | Creature, Spirit | {2}{U} | 2/2 | Skyborne. | Knee-deep, and that was enough. | flex |

### Black (32)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-low-street-witch | Low Street Witch | C | B | Creature, Human Witch | {1}{B} | 1/1 | Duty, {1}: draw a card, then discard a card. | Her cellar is the driest place on Low Street and everyone knows why. | core |
| dd-drowned-child | The Drowned | C | B | Creature, Spirit | {1}{B} | 2/1 | Arrives: grind self 1. | They come up the wharf steps at night and stand very still. | core |
| dd-deep-one-cultist | Deep One Cultist | C | B | Creature, Human | {1}{B} | 2/2 | Dies: grind self 2. | She was born in the town, married in the town, and belongs to the water. | core |
| dd-deep-spawn-tender | Deep-Spawn Tender | C | B | Creature, Human Witch | {3}{B} | 2/2 | Arrives: create a 2/2 black Deep-Spawn token. | She keeps them in the cistern until they are big enough to keep themselves. | core |
| dd-deep-one-warrior | Deep One Warrior | C | B | Creature, Deep One Horror | {2}{B}{B} | 4/3 | Dread. | She fights the way the sea does: all at once, and from below. | core |
| dd-drowned-horror | Drowned Horror | C | B | Creature, Deep One Horror | {4}{B} | 4/4 | Dread. Dreaded. | It wears the town's faces and is bad at it, which is worse. | core |
| dd-cellar-jar | Cellar Jar | C | B | Artifact | {1} | none | Duty, {B}: opponent loses 1 life. | One secret, one jar, one shelf. The shelf is long. | core |
| dd-salt-in-the-eyes | Salt in the Eyes | C | B | Charm | {B} | none | Target creature gets -2/-1 until end of turn. Whispers {B}. | The sea gets into everything. | core |
| dd-the-deep-collects | The Deep Collects | C | B | Ritual | {2}{B} | none | Destroy target creature with cost 2 or less. | It is owed. It comes for what it is owed. | core |
| dd-tithe-of-the-wharf | Tithe of the Wharf | C | B | Ritual | {B} | none | Opponent discards a card at random. Grind self 1. | The plate goes round. It comes back heavier. | core |
| dd-drowned-sailor | Drowned Sailor | C | B | Creature, Spirit | {2}{B} | 3/2 | Skim {B}. Whispers {B}. | Lost off the Reach in '09. Home for supper most nights since. | core |
| dd-marsh-widow | Marsh-Widow | C | B | Creature, Human Witch | {3}{B} | 2/3 | Whenever another creature you control dies, opponent loses 1 life. | She buries them in the marsh and the marsh sends her a receipt. | core |
| dd-deep-one-acolyte | Deep One Acolyte | C | B | Creature, Human | {1}{B} | 1/3 | Arrives: grind self 1. | She kneels at the water and the water kneels back. | flex |
| dd-cold-bargain | Cold Bargain | C | B | Ritual | {2}{B} | none | Sever target creature. You lose 2 life. | The terms are fair. The terms are always fair. | core |
| dd-drowned-grave | Drowned Grave | C | B | Enchantment | {B} | none | During your Dawn: grind self 1. Whenever a card is put into your graveyard from your deck, you gain 1 life. | Dug at low water, filled by the tide. | stretch (AI-risk) |
| dd-wharf-rat | Wharf Rat | C | B | Creature, Human | {B} | 1/1 | Deathblade. | Small, quick, and carrying something the sea gave her. | flex |
| dd-horror-in-the-well | Horror in the Well | C | B | Creature, Deep One Horror | {3}{B} | 3/3 | Dread. Dies: opponent loses 1 life. | The well water is sweet, and something in it is grateful. | core |
| dd-drowned-preacher-lesser | Wharf Preacher | C | B | Creature, Human | {2}{B} | 1/3 | Arrives: opponent loses 1 life. | He preaches to the water and the water listens, which is more than the town does. | flex |
| dd-what-the-sea-wants | What the Sea Wants | C | B | Charm | {2}{B} | none | Destroy target creature with cost 2 or less. Whispers {1}{B}. | It asked nicely. Once. | flex |
| dd-black-tide-rising | Black Tide Rising | C | B | Ritual | {1}{B}{B} | none | Each creature gets -2/-2 until end of turn. | The water came up black and everything in it went quiet. | core |
| dd-deep-spawn-hatchery | Deep-Spawn Hatchery | C | B | Enchantment | {5}{B} | none | Duty, {3}{B}: create a 2/2 black Deep-Spawn token. | The cistern is warmer than it should be, and fuller. | flex |
| dd-salt-marsh-ghoul | Salt-Marsh Ghoul | C | B | Creature, Spirit | {3}{B} | 4/3 | Warcry. Whispers {1}{B}. | Buried in the marsh on Tuesday. Back by Thursday, and hungry. | flex |
| dd-drowned-nurse | Drowned Nurse | C | B | Creature, Human | {2}{B} | 2/2 | Arrives: return target creature card with cost 2 or less from your graveyard to your hand. | She tends the sick, and the sick get better, and the sick get strange. | flex |
| dd-deep-one-elder | Deep One Elder | C | B | Creature, Deep One Horror | {5}{B} | 5/5 | Dread. Dreaded. | She remembers the town before the town. | flex |
| dd-jar-of-eyes | Jar of Eyes | C | B | Artifact | {3} | none | During your Dawn: opponent discards a card at random. | Every one of them still open. | flex |
| dd-drowned-bargain-lesser | The Wharf Bargain | C | B | Charm | {1}{B} | none | Target creature gets -3/-3 until end of turn. | Small print, written in salt water. | flex |
| dd-marsh-lamp-lure | Marsh-Lamp Lure | C | B | Ritual | {2}{B} | none | Opponent sacrifices a creature. | Follow the light. Everyone does. | core |
| dd-low-street-mourner | Low Street Mourner | C | B | Creature, Human | {1}{B} | 1/2 | Dies: grind self 2. Skim {B}. | She has attended every funeral on Low Street, including her own. | flex |
| dd-drowned-sexton-lesser | Gravedigger of the Flats | C | B | Creature, Human | {3}{B} | 3/3 | Arrives: grind self 3. | Dig at low water. Do not look at what the tide has uncovered. | flex |
| dd-deep-ones-blessing | The Deep's Blessing | C | B | Ritual | {B} | none | Return target creature card from your graveyard to your hand. | It gives back what it took. Changed. | flex |
| dd-horror-below-the-wharf | Horror Below the Wharf | C | B | Creature, Deep One Horror | {3}{B}{B} | 4/4 | Dread. Dreaded. | The pilings creak at night. It is not the tide. | flex |
| dd-drowned-mother | Drowned Mother | C | B | Creature, Spirit | {5}{B} | 3/4 | Arrives: create a 1/1 black Drowned Spirit token. Dies: create a 1/1 black Drowned Spirit token. | She went into the water for her children, and came back with more. | stretch |

### Green (32)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-marsh-forager | Marsh Forager | C | G | Creature, Human | {G} | 1/2 | Arrives: gain 1 life. | She gathers supper where the marsh meets the sea, and it is always enough. | core |
| dd-kelp-shade | Kelp-Tender | C | G | Creature, Human Witch | {3}{G} | 1/3 | Arrives: create a 2/2 green Kelp Shade token. | She plants the reeds and the reeds get up. | core |
| dd-reef-crab | Reef Crab | C | G | Creature, Beast | {1}{G} | 1/4 | Bulwark. | Older than the wharf and harder. | core |
| dd-tidepool-warden | Tidepool Warden | C | G | Creature, Human Warden | {2}{G} | 3/3 | Sentinel. | She keeps the pools and the pools keep her secrets. | core |
| dd-marsh-horror | Marsh Horror | C | G | Creature, Horror | {3}{G} | 3/4 | Dread. | It was three drowned men and a lot of kelp. It is one thing now. | core |
| dd-coral-graft | Coral Graft | C | G | Charm | {G} | none | Put a Mark on target creature. | It takes because the sea has already loosened everything. | core |
| dd-reef-warden-lesser | Reef Warden | C | G | Creature, Human Warden | {2}{G} | 2/3 | Warding Gaze. Arrives: put a Mark on this. | The reef grows where she stands guard. | core |
| dd-marsh-growth-lesser | Overgrowth | C | G | Charm | {1}{G} | none | Target creature gets +2/+2 until end of turn. | The reeds take the road overnight. | flex |
| dd-tide-worn-brute | Tide-Worn Brute | C | G | Creature, Horror | {4}{G} | 4/5 | Dread. | The tide made it. The tide is not proud. | core |
| dd-kelp-shade-swarm | Kelp Swarm | C | G | Ritual | {4}{G} | none | Create two 2/2 green Kelp Shade tokens. | The marsh stood up all at once, and it was not a small marsh. | core |
| dd-reef-lantern | Reef-Lantern | C | G | Artifact | {2} | none | Duty, {G}: put a Mark on target creature you control. | Coral grows toward the light. This light is for coral. | flex |
| dd-marsh-road-warden | Marsh-Road Warden | C | G | Creature, Human Warden | {3}{G} | 3/4 | Arrives: gain 2 life. | The road moves. She moves with it. | flex |
| dd-drowned-druid-lesser | Reed-Witch | C | G | Creature, Human Witch | {2}{G} | 2/2 | Skim {G}. Arrives: put a Mark on target creature you control. | She talks to the reeds and the reeds talk back, at length. | core |
| dd-old-growth-horror | Old-Growth Horror | C | G | Creature, Horror | {6}{G}{G} | 6/7 | Dread. Overrun. | The forest that was here before the town, and it has a grudge. | core |
| dd-tidepool-bloom | Tidepool Bloom | C | G | Ritual | {1}{G} | none | Put a Mark on target creature. Gain 3 life. | One night a year the pools flower and the whole coast comes to see. | flex |
| dd-marsh-wight-lesser | Reed-Wight | C | G | Creature, Spirit | {3}{G} | 3/2 | Dies: create a 2/2 green Kelp Shade token. Whispers {2}{G}. | Buried in the reeds. Back as the reeds. | flex |
| dd-shore-heron | Salt-Heron | C | G | Creature, Bird | {2}{G} | 2/2 | Skyborne. Warding Gaze. | It watches the water and the sky, and something in each watches it. | flex |
| dd-coral-mother-lesser | Coral-Witch | C | G | Creature, Human Witch | {3}{G} | 3/3 | Arrives: put a Mark on target creature you control. | What she grows keeps growing. | flex |
| dd-kelp-wall | Kelp Wall | C | G | Creature, Plant | {2}{G} | 0/7 | Bulwark. | The harbour wall was stone. It is not stone any more. | core |
| dd-marsh-brute | Marsh Brute | C | G | Creature, Beast | {2}{G}{G} | 4/4 | Warcry. | It came out of the marsh at a run. | flex |
| dd-reef-growth | Reef Growth | C | G | Enchantment | {1}{G} | none | Your creatures with Marks get +1/+1. | The coral takes the wharf, then the boats, then the town, and it is only getting started. | flex |
| dd-drowned-gardener | Drowned Gardener | C | G | Creature, Human | {1}{G} | 2/1 | Arrives: gain 1 life. Skim {G}. Whispers {G}. | The garden flooded. The garden thrived. | flex |
| dd-marsh-giant | Marsh Giant | C | G | Creature, Horror | {6}{G} | 5/6 | Dread. | It sleeps in the marsh and the marsh sleeps around it. | flex |
| dd-reed-caller | Reed-Caller | C | G | Creature, Human Witch | {4}{G} | 1/4 | Duty, {2}{G}: create a 2/2 green Kelp Shade token. | She whistles and the reeds come running. | core |
| dd-tide-roots | Tide-Roots | C | G | Ritual | {G} | none | Put a Mark on each creature you control with a Mark. | The reef grows on the reef. | stretch |
| dd-shallows-hunter | Shallows Hunter | C | G | Creature, Human | {2}{G} | 3/2 | Warding Gaze. Arrives: put a Mark on target creature you control. | She hunts the flats at low water and comes back with more than fish. | flex |
| dd-marsh-gate | Marsh Gate | C | G | Enchantment | {2}{G} | none | During your Dawn: put a Mark on target creature you control. | The marsh opens for the reeds and closes for everyone else. | flex |
| dd-drowned-harvest-lesser | Salt Harvest | C | G | Ritual | {1}{G} | none | Gain 4 life. Put a Mark on target creature you control. | The fields flooded and the harvest came up salt. | flex |
| dd-reef-crawler | Reef-Crawler | C | G | Creature, Beast | {1}{G} | 2/2 | Warcry. | It came up the reef at dawn and the gulls left. | flex |
| dd-kelp-shade-elder | Elder Kelp Shade | C | G | Creature, Plant | {5}{G} | 3/6 | Sentinel. Your Plant tokens get +0/+1. | The oldest reed in the marsh, and the reeds defer to it. | flex |
| dd-marsh-mist | Marsh Mist | C | G | Charm | {1}{G} | none | Target creature gets +1/+3 until end of turn. Gain 1 life. | The mist off the marsh is thick enough to hide in. | flex |
| dd-old-reef | The Old Reef | C | G | Creature, Plant | {7}{G} | 7/8 | Bulwark. Arrives: gain 3 life. | It does not attack. It does not need to. | stretch |

### Red (32)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-wreck-runner | Wreck-Runner | C | R | Creature, Human | {R} | 2/1 | Warcry. | First to the wreck, first to the cargo, first back to the tavern. | core |
| dd-breakwater-brawler | Breakwater Brawler | C | R | Creature, Human | {1}{R} | 2/2 | When this attacks, it gets +1/+0 until end of turn. | The breakwater settles what the tavern could not. | core |
| dd-wrecker-lantern-bearer | Wrecker's Lantern-Bearer | C | R | Creature, Human | {3}{R} | 3/2 | Duty: damage target creature 1. | She carries the light that lies. | core |
| dd-storm-caller-lesser | Storm-Caller | C | R | Creature, Human Witch | {2}{R} | 2/3 | Arrives: damage opponent 1. | She dares the weather and the weather, so far, has taken the dare. | core |
| dd-salt-fire-lesser | Salt-Fire Charm | C | R | Charm | {R} | none | Damage target creature 1. Whispers {R}. | Green flame on wet wood. | core |
| dd-gale-lesser | Squall | C | R | Charm | {1}{R} | none | Damage target creature 3. | It came in at noon. By one, no wharf. | core |
| dd-wreck-fire-lesser | Wreck Fire | C | R | Ritual | {2}{R} | none | Damage each creature 1 and damage opponent 2. | The wreck burned all night. The town watched. | flex |
| dd-storm-horror | Storm Horror | C | R | Creature, Spirit | {3}{R} | 4/3 | Warcry. | It comes up in the storm and goes back with it. | core |
| dd-wrecker-lookout | Wrecker's Lookout | C | R | Creature, Human | {1}{R} | 2/1 | Warcry. Skim {R}. | She watches for ships and lights the wrong lamp. | core |
| dd-forge-lamp | Forge-Lamp | C | R | Artifact | {2} | none | Duty, {R}: damage target creature 1. | Raised from the drowned forge, still hot. | core |
| dd-rage-of-the-reach | Rage of the Reach | C | R | Creature, Human | {3}{R} | 5/3 | Rage. | She has never once backed down, and the sea has noticed. | flex |
| dd-breakwater-riot-lesser | Wharf Brawl | C | R | Ritual | {1}{R} | none | Damage each creature 1. | The whole wharf, all at once. | flex |
| dd-drowned-fire-lesser | Fire Under Water | C | R | Charm | {2}{R} | none | Damage target creature 4. Whispers {1}{R}. | It does not go out. It goes quiet. | core |
| dd-storm-rider | Storm-Rider | C | R | Creature, Human | {2}{R} | 3/1 | Skyborne. Warcry. | She rides the gale on a sail cut from a shroud. | flex |
| dd-wrecker-captain-lesser | Wrecker Mate | C | R | Creature, Human | {2}{R}{R} | 4/3 | Overrun. | Every ship she saves, she saves for parts. | flex |
| dd-storm-front-lesser | Squall Line | C | R | Enchantment | {1}{R} | none | Whenever a creature you control attacks, damage opponent 1. | The front sits on the horizon for a week and then does not. | flex |
| dd-false-lamp | False Lamp | C | R | Artifact | {2} | none | During your Dawn: damage opponent 1. | A lamp on the wrong rock. | flex |
| dd-storm-witch-lesser | Squall-Witch | C | R | Creature, Human Witch | {1}{R}{R} | 3/2 | First Blade. | She keeps the storm in a jar and lets it out for fun. | flex |
| dd-drowned-forge-hand | Forge-Hand | C | R | Creature, Human | {2}{R} | 2/2 | Arrives: damage target creature 1. | The forge is drowned. The work is not done. | flex |
| dd-fire-on-the-water | Fire on the Water | C | R | Ritual | {1}{R}{R} | none | Damage target creature 6. Whispers {R}{R}. | The whole harbour, lit at once, and the town saw what was under it. | core |
| dd-breakwater-veteran | Breakwater Veteran | C | R | Creature, Human | {4}{R} | 4/4 | Arrives: damage target creature 1. | Thirty years of brawls, and she has never once lost one on the breakwater. | flex |
| dd-storm-surge-lesser | Surge | C | R | Charm | {2}{R} | none | Damage target creature 3 and damage opponent 1. | The surge takes the wharf and the argument about whose fault it was. | flex |
| dd-wreck-diver | Wreck-Diver | C | R | Creature, Human | {2}{R} | 1/1 | Duty, {1}: draw a card, then discard a card. | Everything down there is hers, and she keeps a list. | core |
| dd-gale-horror | Gale Horror | C | R | Creature, Spirit | {4}{R}{R} | 6/4 | Dreaded. Warcry. | It comes in on the wind and the wind is glad to be rid of it. | flex |
| dd-drowned-forge-fire | Forge-Fire | C | R | Ritual | {1}{R} | none | Damage target creature 2. Retell {2}{R}. | The heat was not drowned. It was stored. | flex |
| dd-reach-raider | Reach Raider | C | R | Creature, Human | {2}{R} | 3/2 | Warcry. Skim {R}. | She raids the wrecks before the wreckers do. | flex |
| dd-storm-bell | Storm Bell | C | R | Artifact | {3} | none | Duty, {1}{R}: damage target creature 2. | It rings when the sea is hungry. | flex |
| dd-wrecker-rage | Wrecker's Rage | C | R | Charm | {R} | none | Target creature gets +2/+0 and Rage until end of turn. Damage opponent 1. | She does not fight fair. She fights the sea. | stretch |
| dd-rite-of-the-lamp-fire | Rite of the Lamp-Fire | C | R | Ritual | {1}{R} | none | Rite 1. Damage target creature 4. | The lamp needs oil and is not particular. | core |
| dd-storm-tide-brute | Storm-Tide Brute | C | R | Creature, Spirit | {4}{R} | 5/4 | Overrun. | The storm has legs now. | flex |
| dd-drowned-forge-master | Forge-Master of the Reach | C | R | Creature, Human | {3}{R}{R} | 4/4 | Arrives: damage target creature 2. | She works the drowned forge and the forge works her. | flex |
| dd-heat-of-the-wreck | Heat of the Wreck | C | R | Charm | {R} | none | Target creature gets +2/+0 until end of turn. Whispers {R}. | Warm your hands on it. It is all the wreck has left. | flex |

## Tokens

Four token types, each with at least two minters in the pool (the
2026-09-03 minterless-token lesson; the cut re-checks this).

| Token | Colour | Type | Stats | Rules | Minters in the pool |
| --- | --- | --- | --- | --- | --- |
| Deep-Spawn | B | Creature, Deep One Horror | 2/2 | none (a Horror body; Dread fodder that is itself a Horror) | The Brood Below, Deep One Midwife, Deep-Spawn Tender, Deep-Spawn Hatchery |
| The Drowned | B | Creature, Spirit | 1/1 | none | What the Nets Remember, Drowned Mother |
| Lantern Wisp | W | Creature, Spirit | 1/1 | Skyborne | Constance Reyne, Watch-Sergeant Alder, Wisp-Caller, Lamp Relay |
| Kelp Shade | G | Creature, Plant | 2/2 | none | Old Marrow, Kelp Cathedral, Kelp-Shade Caller, The Catch, The Drowned Orchard, Kelp-Tender, Kelp Swarm, Reed-Caller, Marsh-Wight, Reed-Wight, Net Full of Stars, Drowned Harvest, Marsh-Mother, The Horror Garden |

The Drowned has only two minters and both are `flex` or `stretch`; if either
is cut, the token goes with it or Drowned Mother is protected.

## Precon: Lanterns Below (U/B)

The tide-and-whisper control deck, board-first at common. Core plan: cheap
bodies and tappers hold the ground (Tide-Clerk, Deep One Scout, The Drowned,
Deep One Cultist), self-mill fills the graveyard on schedule (Harbour
Mermaid, Cold-Water Diver, Drowned Bell, Low-Tide Grave), the looters
(Low Street Looter, Low Street Witch, Salvage Diver) turn dead draws into
tagged Whispers, and the Whispers Charms and Rituals (Fog Bank, Tidal
Memory, Salt in the Eyes, The Price, The Tide That Turns, Bargain Below)
are the value engine. Finishers: two or three Horrors on the curve (Deep One
Bride, Tithe-Collector, Deep One Hierophant) with Dread as the tempo
lever, and Mother Hydra as the top. The list must contest the board when
no Whispers fires; the seeded matrix measures it against the 13 prefab
columns before it ships. Name and the exact 40 are authored at the cut.

## Gauntlet bosses, rungs 25 and 26

- **Rung 25, The Bell Beneath the Harbour (U/B).** The Whispers control
  boss: self-mill on a schedule, counters and bounce at Charm speed, Duty
  scryers, the Drowned Deacon and Father Dagon at the top. A Whispers pilot
  is the AI's greedy Retell-with-a-deadline comparison, so the boss is
  playable at every difficulty; the summit gate shape is decided before the
  rung lands (the CI budget note in `plan-1.8.md`).
- **Rung 26, The Marsh-Mother (B/G).** The Dread Horror boss: Kelp Shade
  token makers and the Horror Garden feed Dread casts into a curve of
  Horrors, Marsh-Mother and The Reef That Walks at the top, Reef Bloom and
  Coral-Mother for the go-wide line when the Horrors do not come. The AI's
  Dread policy (lowest-value pairs first) is what the seeded pass measures
  here.

## Balance pass (2026-09-11, before any card exists in the engine)

Every row was scored on the local power formula with the 1.8 rates (Duty section
4q, Whispers 4r, Dread 4s) by parsing the mechanics sketch into card data; the
fair band is plus or minus 0.75, the Card Builder's Accurate Value band. Before
the pass 155 of 321 rows sat outside it (85 hot, 70 cold).

**Two rules the pass ran under (owner, 2026-09-11), after a first draft costed
cards in isolation and produced a three-mana Wrath:**

1. **Pool precedent.** A new card may never be strictly better than the best
   shipped card of the same effect class at the same or lower rarity: the
   floor is the cheapest shipped printing of that class at that magnitude,
   plus one mana when the shipped card pays a drawback the newcomer does not,
   plus one when the newcomer carries an alt-cost line (Whispers, Retell,
   Skim) the shipped card lacks, and a bigger effect than the best shipped one
   costs at least one more than it. Restricted effects (cost-capped removal,
   conditional counters, marked-only anthems) are their own class. Floors are
   hard for spells and non-creature permanents and advisory for creatures,
   whose bodies differ. 5 rows were raised to a floor.
2. **Rarity is earned by doing more, never by costing less.** A cold card at
   Super Rare or above gets a colour-appropriate rider or a rarity-move flag;
   cost only comes down to the floor. 9 rows gained a rider or a
   bigger effect.

Otherwise the smallest design-preserving lever, at most three per card: cost,
a stat, activation mana on a Duty; never a token size (the four token
identities are fixed), never the rarity histogram. 38 rows were
redesigned by hand where three levers could not land them (the flagships, the
repeatable token makers, the Duty-draw artifacts, the UR/SSR spells). In all
160 rows changed (75 cost up, 55 cost down, the rest stats,
Duty mana, riders or hand redesigns) and 317 rows now sit inside
the band. The scorer prices some clauses only by proxy (one-sided sweeps,
edicts, mass taps, cost-restricted targets, the triggers the engine does not
have yet, looting at half a draw); those rows carry a flag on the cut board and
are provisional until the engine wave lands them.

**Open for the owner:**

- **Wreckfire**: RULED 2026-09-11, demoted to Double Super Rare, and grown to earn
  it: "Damage all creatures 4 and damage opponent 4. Whispers {1}{R}{R}" at
  {2}{R}{R}, one mana above Ragnarok (the SSR floor for a 4-damage sweep) with the
  set's line on top. The Ultra Rare slot it leaves is filled by a new red Horror,
  **Cinderjaw, the Fire That Swims** ({4}{R}{R} 5/4, Warcry, Duty {R}: 2 damage
  to a creature, attacks: 2 to the opponent, Whispers {3}{R}{R}), the set's first
  red Deep One and its Whispers creature at the top of the file.
- **Lightkeeper's Oath** (SSR) and **Vigil Bell** (R): the mass tap has no
  engine op and is priced as three single taps, certainly low (Sleep is a fair
  four-mana rare in Magic); held at their designed costs, NEEDS MATH, and
  Double Super Rare is a rarity mismatch for a tap spell regardless.
- **Fog That Stays** (R): the formula prices an enemy-team debuff at the
  friendly-anthem rate; held at {2}{U}, which is where Magic prints the shape.
- **The one-mana Whispers Charms** (Salt-Fire Charm and its family): the pool
  rule moves Salt-Fire to {1}{R}, because a one-mana 2-damage Charm with a
  Whispers line is strictly better than Fire Attack. The brief wanted these to
  teach Whispers on turn one; the owner can waive the rule for the three
  teaching Charms or accept them at two mana.
- **The Catch** (SR): two 2/2 tokens sits at six mana because Graveyard Waltz
  (R) prints eight stats of tokens at six; the rider is a life gain. A
  redesign may serve better than the recost.

**Structural findings the numbers carry:** a repeatable 2/2 token (per Dawn or
per Duty) is worth about 6.9 MEP on a non-creature, so every such card moved to
six or seven mana, to a paid Duty, or to the 1/1 Drowned; Duty draw on an
artifact only reads fair in the Jayemdae Tome shape ({4}, {3} to activate);
Dread bodies printed on the vanilla curve read a point hot and lost one Attack
(keeping their Defense for the Dread math); Whispers earns nothing on a body or
a Ritual in the formula (the madness era rule), so those cards were costed as
if the line were absent and the Whispers cost set one below printed; sweeps
and Rite rituals were one to two mana too dear, but only down to the pool
floor.

| Id | Was | Now | Delta before | Delta after | How |
| --- | --- | --- | --- | --- | --- |

| `dd-mother-hydra` | {5}{B}{B} 7/7 | {5}{B}{B} 6/7; Dreaded. Dread. During your Dawn, if you control another Horror, opponent loses 2 life. | +3.16 | +0.63 | hand redesign |
| `dd-lightkeeper` | {3}{W}{W} 4/6 | {4}{W}{W} 3/6; "Duty: gain 3 life and tap target creature an opponent controls." to "Duty, {1}: gain 3 life and tap target creature an opponent controls." | +2.02 | +0.30 | cost +1, Duty +{1}, attack -1 |
| `dd-bell-that-will-not-ring` | {3}{W} | {2}{W} | -1.36 | -0.54 | cost -1 |
| `dd-tide-that-remembers` | {3}{U}{U} | {3}{U}{U}; "Draw 3, then grind self 3" to "Draw 4, then grind self 3" | -1.98 | -0.63 | effect +1 |
| `dd-isolde-marrow` | {2}{U}{U} 2/5 | {2}{U}{U} 2/5; "Duty: Foresee 2, then draw 1." to "Duty, {1}: Foresee 2, then draw 1." | +1.09 | +0.69 | Duty +{1} |
| `dd-the-brood-below` | {4}{B}{B} 5/5 | {5}{B}{B} 5/5; Dread. Arrives: create two 2/2 black Deep-Spawn tokens. | +4.11 | +0.53 | hand redesign |
| `dd-the-reef-that-walks` | {6}{G}{G} 8/8 | {6}{G}{G} 7/8 | +0.96 | +0.46 | attack -1 |
| `dd-old-marrow` | {3}{G}{G} 4/6 | {3}{G}{G} 4/6; "Duty: create a 2/2 green Kelp Shade token." to "Duty, {1}: create a 2/2 green Kelp Shade token." | +0.77 | +0.37 | Duty +{1} |
| `dd-wreckfire` | {3}{R}{R} UR | {2}{R}{R} SSR; Damage all creatures 4 and damage opponent 4. Whispers {1}{R}{R}. | -4.23 | see cut board | hand redesign, rarity move (owner) |
| `dd-the-choir-below` | {2}{U}{B} | {2}{U}{B}; "Duty: Foresee 1, then draw 1." to "Duty, {1}: Foresee 1, then draw 1." | +1.09 | +0.69 | Duty +{1} |
| `dd-the-lantern-watch` | {2}{W}{U} | {1}{W}{U}; Your creatures get +0/+1. Your creatures have Warding Gaze. Duty: tap target creature. | -2.56 | -0.74 | hand redesign |
| `dd-harbourmaster` | {2}{W}{W} 3/4 | {3}{W}{W} 3/4; "Duty: create a 1/1 white Lantern Wisp token with Skyborne." to "Duty, {2}: create a 1/1 white Lantern Wisp token with Skyborne." | +1.99 | +0.37 | Duty +{1}, cost +1, Duty +{1} |
| `dd-vigil-at-low-water` | {3}{W}{W} | {3}{W}{W}; Destroy all creatures. Gain 4 life and Foresee 1. Whispers {3}{W}. | -1.78 | -0.42 | hand redesign |
| `dd-lamp-oil-saint` | {3}{W} 2/5 | {4}{W} 2/5 | +1.34 | +0.52 | cost +1 |
| `dd-tidewife` | {3}{U}{U} 4/4 | {4}{U}{U} 4/4 | +0.81 | -0.01 | cost +1 |
| `dd-undertow` | {2}{U}{U} | {2}{U}{U}; Recall target creature and draw 2. Whispers {1}{U}. | -2.22 | +0.52 | hand redesign |
| `dd-wharf-rat-queen` | {2}{B}{B} 3/3 | {3}{B}{B} 3/3 | +0.94 | +0.12 | cost +1 |
| `dd-bargain-below` | {2}{B}{B} | {2}{B}{B}; Sever target creature and draw a card. Whispers {1}{B}{B}. | -2.66 | -0.01 | hand redesign |
| `dd-salt-marsh-horror` | {5}{B} 6/6 | {6}{B} 5/6 | +1.93 | +0.61 | attack -1, cost +1 |
| `dd-reef-warden` | {2}{G}{G} 4/5 | {3}{G}{G} 4/5 | +1.14 | +0.32 | cost +1 |
| `dd-kelp-cathedral` | {3}{G} | {5}{G}{G}; Your Plant tokens get +1/+1. Duty, {2}{G}: create a 2/2 green Kelp Shade token. | +3.94 | +0.28 | hand redesign |
| `dd-something-in-the-nets` | {4}{G}{G} 6/6 | {4}{G}{G} 5/6 | +1.17 | +0.67 | attack -1 |
| `dd-false-beacon` | {3}{R} | {2}{R} | -0.93 | -0.11 | cost -1 |
| `dd-storm-surge` | {1}{R}{R} | {1}{R}{R}; "Whispers {R}." to "Damage opponent 2"; added "Whispers {R}." | -1.01 | -0.17 | rider |
| `dd-drowned-fire` | {2}{R}{R} | {1}{R}{R}; "Whispers {1}{R}{R}." to "Whispers {R}{R}." | -1.21 | -0.39 | cost -1 |
| `dd-lightkeepers-oath` | {1}{W}{U} | {2}{W}{U}; Tap all creatures an opponent controls. Foresee 2. Whispers {1}{W}{U}. | -2.39 | -3.21 | hand redesign |
| `dd-bell-ringer-abbess` | {2}{W}{W} 3/4 | {3}{W}{W} 3/4 | +1.14 | +0.32 | cost +1 |
| `dd-lamp-lit-vigil` | {2}{W} | {2}{W}; Prevent combat this turn. Draw a card. Whispers {1}{W}. | -1.98 | -0.04 | hand redesign |
| `dd-gate-warden` | {3}{W} 2/6 | {4}{W} 2/6 | +1.09 | +0.27 | cost +1 |
| `dd-rite-of-the-lightkeepers` | {2}{W}{W} | {1}{W}{W} | -1.11 | -0.29 | cost -1 |
| `dd-net-mender` | {1}{U} 1/3 | {2}{U} 1/3 | +1.13 | +0.31 | cost +1 |
| `dd-drowned-archive` | {2}{U} | {3}{U}; "Duty: draw a card." to "Duty, {2}: draw a card." | +2.06 | +0.44 | Duty +{1}, cost +1, Duty +{1} |
| `dd-remembered-shore` | {2}{U}{U} | {1}{U}{U} | -1.26 | -0.44 | cost -1 |
| `dd-jar-witch` | {1}{B}{B} 2/3 | {2}{B}{B} 2/3 | +1.31 | +0.49 | cost +1 |
| `dd-drowned-sexton` | {2}{B}{B} 3/3 | {3}{B}{B} 3/3 | +0.78 | -0.04 | cost +1 |
| `dd-deep-one-hierophant` | {3}{B}{B} 4/4 | {3}{B}{B} 3/4 | +0.78 | +0.28 | attack -1 |
| `dd-salt-in-the-wound` | {1}{B}{B} | {B}{B} | -1.06 | -0.74 | hand redesign |
| `dd-tithe-to-the-deep` | {3}{B} | {2}{B}; "Whispers {2}{B}." to "Opponent loses 2 life"; added "Whispers {1}{B}." | -1.70 | +0.12 | cost -1, rider |
| `dd-what-the-nets-remember` | {4}{B}{B} 5/5 | {4}{B}{B} 4/5 | +1.04 | +0.54 | attack -1 |
| `dd-reef-shaman` | {2}{G}{G} 3/4 | {3}{G}{G} 3/4 | +0.82 | +0.00 | cost +1 |
| `dd-kelp-shade-caller` | {2}{G} 2/3 | {3}{G} 1/3; Duty, {1}{G}: create a 2/2 green Kelp Shade token. | +3.79 | +0.34 | hand redesign |
| `dd-tidepool-colossus` | {5}{G}{G} 7/7 | {5}{G}{G} 6/7 | +0.83 | +0.33 | attack -1 |
| `dd-marsh-root-warden` | {3}{G} 4/4 | {4}{G} 4/4; Sentinel. Duty, {1}: put a Mark on this. | +2.60 | +0.42 | hand redesign |
| `dd-drowned-grove` | {2}{G} | {3}{G} | +0.76 | -0.06 | cost +1 |
| `dd-the-catch` | {2}{G} | {5}{G}; "Create two 2/2 green Kelp Shade tokens." to "Create two 2/2 green Kelp Shade tokens"; added "Gain 2 life." | +1.26 | -0.64 | pool floor, rider |
| `dd-storm-choir` | {3}{R} 4/3 | {4}{R} 4/3 | +1.04 | +0.22 | cost +1 |
| `dd-rite-of-the-false-beacon` | {2}{R}{R} | {1}{R}{R}; Rite 1. Damage target creature 7 and damage opponent 3. | -3.01 | -0.44 | hand redesign |
| `dd-breakwater-brawl` | {3}{R} | {1}{R}; "Whispers {2}{R}." to "Whispers {R}." | -2.16 | -0.52 | cost -1, cost -1 |
| `dd-bell-tower-sentry` | {2}{W} 2/4 | {3}{W} 2/4 | +0.77 | -0.05 | cost +1 |
| `dd-salt-stair-captain` | {3}{W} 3/4 | {3}{W} 2/4; Warding Gaze. Your other Wardens get +0/+1. | +2.79 | +0.29 | hand redesign |
| `dd-salt-ward` | {1}{W} | {W} | -1.27 | -0.45 | cost -1 |
| `dd-what-the-lamps-saw` | {1}{W} | {2}{W}; Destroy target Artifact or Enchantment. Foresee 2. Whispers {1}{W}. | -0.57 | -0.62 | hand redesign |
| `dd-vigil-bell` | {2}{W} | {2}{W}; Tap all creatures an opponent controls. Foresee 1. | -1.89 | -1.33 | hand redesign |
| `dd-watch-sergeant` | {2}{W}{W} 3/3 | {3}{W}{W} 3/3; "Duty: create a 1/1 white Lantern Wisp token with Skyborne." to "Duty, {2}: create a 1/1 white Lantern Wisp token with Skyborne." | +2.09 | +0.47 | Duty +{1}, cost +1, Duty +{1} |
| `dd-rite-of-the-salt-gate` | {1}{W}{W} | {W}{W} | -1.18 | -0.36 | cost -1 |
| `dd-drowned-saint` | {3}{W}{W} 3/5 | {4}{W}{W} 2/5 | +1.80 | +0.48 | cost +1, attack -1 |
| `dd-the-morning-count` | {2}{W} | {1}{W} | -1.13 | -0.31 | cost -1 |
| `dd-lightkeepers-apprentice` | {W} 1/2 | {1}{W} 1/2 | +0.86 | +0.04 | cost +1 |
| `dd-tide-reader` | {1}{U} 1/3 | {2}{U} 1/3 | +0.83 | +0.01 | cost +1 |
| `dd-harbour-looter` | {2}{U} 2/3 | {2}{U} 1/3 | +1.06 | +0.56 | attack -1 |
| `dd-tidal-memory` | {U} | {1}{U} | +0.57 | +0.25 | pool floor |
| `dd-undertow-pull` | {1}{U} | {1}{U}; Recall target creature. Whispers {U}. | -0.90 | -0.65 | hand redesign |
| `dd-still-water` | {2}{U} | {3}{U}; "Whispers {1}{U}." to "Whispers {2}{U}." | +0.43 | -0.39 | pool floor |
| `dd-charts-of-the-drowned-coast` | {2} | {5}; Duty, {3}: Foresee 1, then draw a card. | +2.68 | +0.62 | hand redesign |
| `dd-bell-below` | {2}{U} | {1}{U} | -1.44 | -0.62 | cost -1 |
| `dd-fog-that-stays` | {3}{U} | {2}{U}; Creatures an opponent controls get -1/-0. During your Dawn: Foresee 1. | -2.91 | -0.89 | hand redesign |
| `dd-horror-lord` | {3}{B}{B} 4/4 | {4}{B}{B} 3/4 | +1.27 | -0.05 | attack -1, cost +1 |
| `dd-cellar-witch` | {1}{B} 2/2 | {2}{B} 1/2 | +1.78 | +0.46 | attack -1, cost +1 |
| `dd-tithe-collector` | {3}{B} 3/4 | {4}{B} 2/4 | +1.57 | +0.25 | attack -1, cost +1 |
| `dd-what-the-jars-hold` | {2}{B} | {2}{B}; Opponent discards two cards at random. Opponent loses 2 life. Whispers {1}{B}. | -1.29 | -0.29 | hand redesign |
| `dd-low-tide-grave` | {2}{B} | {1}{B} | -1.14 | -0.32 | cost -1 |
| `dd-deep-one-midwife` | {4}{B} 4/4 | {5}{B} 3/4 | +1.50 | +0.18 | attack -1, cost +1 |
| `dd-black-water` | {3}{B}{B} | {2}{B}{B}; "Whispers {2}{B}{B}." to "Grind self 2"; added "Whispers {1}{B}{B}." | -1.63 | -0.51 | cost -1, rider |
| `dd-marsh-lantern` | {3} | {2} | -1.19 | -0.37 | cost -1 |
| `dd-drowned-chorus` | {3}{B} | {1}{B}; "Whenever a creature an opponent controls dies, you gain 2 life." to "Whenever a creature an opponent controls dies, you gain 3 life." | -2.55 | -0.23 | cost -1, cost -1, effect +1 |
| `dd-what-was-promised` | {4}{B} | {1}{B}; Return target creature card from your graveyard to your hand and grind self 2. Retell {2}{B}. | -2.91 | -0.45 | hand redesign |
| `dd-reckoning-below` | {2}{B}{B} | {1}{B}{B}; "Opponent loses 2 life." to "Opponent loses 2 life"; added "Grind self 2." | -1.69 | -0.57 | cost -1, rider |
| `dd-reef-tender` | {1}{G} 1/3 | {2}{G} 1/3 | +1.13 | +0.31 | cost +1 |
| `dd-kelp-shade-warden` | {2}{G} 3/3 | {3}{G} 2/3 | +1.63 | +0.31 | cost +1, attack -1 |
| `dd-reef-horror` | {3}{G}{G} 5/6 | {3}{G}{G} 4/6 | +1.07 | +0.57 | attack -1 |
| `dd-drowned-orchard` | {3}{G} | {6}{G} | +2.99 | +0.53 | cost +1, cost +1, cost +1 |
| `dd-coral-mother` | {3}{G}{G} 4/5 | {4}{G}{G} 4/5 | +0.77 | -0.05 | cost +1 |
| `dd-marsh-road` | {1}{G} | {2}{G}; Your Plant tokens get +1/+1. Your Plant tokens have Sentinel. | -1.47 | -0.29 | hand redesign |
| `dd-tide-worn-giant` | {4}{G}{G} 6/6 | {4}{G}{G} 5/6 | +0.95 | +0.45 | attack -1 |
| `dd-reef-bloom` | {1}{G}{G} | {G}{G}; Put a Mark on each creature you control and Foresee 1. | -1.69 | -0.13 | hand redesign |
| `dd-marsh-wight` | {3}{G} 4/3 | {4}{G} 4/3; "Whispers {1}{G}." to "Whispers {3}{G}." | +1.17 | +0.35 | cost +1 |
| `dd-old-growth` | {2}{G}{G} | {G}{G}; Your creatures with Marks get +1/+1. Your creatures with Marks have Overrun. | -3.61 | +0.03 | hand redesign |
| `dd-the-marsh-remembers` | {3}{G} | {1}{G} | -2.21 | -0.57 | cost -1, cost -1 |
| `dd-drowned-harvest` | {4}{G}{G} | {5}{G}{G} | +0.95 | +0.13 | cost +1 |
| `dd-wrecker` | {1}{R} 2/2 | {2}{R} 2/2; "Duty: damage target creature 1." to "Duty, {1}: damage target creature 1." | +1.78 | +0.56 | cost +1, Duty +{1} |
| `dd-storm-witch` | {2}{R} 3/2 | {3}{R} 3/2 | +1.41 | +0.59 | cost +1 |
| `dd-salt-fire` | {R} | {1}{R} | -0.11 | -0.43 | pool floor |
| `dd-lightning-on-the-water` | {1}{R}{R} | {1}{R}{R}; "Whispers {R}{R}." to "Damage opponent 2"; added "Whispers {R}{R}." | -0.86 | -0.02 | rider |
| `dd-wreck-fire` | {2}{R} | {1}{R}; "Whispers {1}{R}." to "Whispers {R}." | -0.89 | -0.07 | cost -1 |
| `dd-rite-of-the-wreckers` | {1}{R}{R} | {R}{R} | -1.54 | -0.72 | cost -1 |
| `dd-storm-front` | {2}{R} | {1}{R}; Your creatures get +1/+0. Your creatures have Warcry. | -2.39 | -0.57 | hand redesign |
| `dd-gale-rider` | {3}{R} 4/3 | {4}{R} 4/3 | +1.04 | +0.22 | cost +1 |
| `dd-fire-on-the-point` | {3}{R}{R} | {2}{R}{R}; "Whispers {2}{R}{R}." to "Whispers {1}{R}{R}." | -1.30 | -0.48 | cost -1 |
| `dd-heat-of-the-forge` | {1}{R} | {R} | -1.07 | -0.25 | cost -1 |
| `dd-breakwater-riot` | {2}{R}{R} | {1}{R}{R} | -1.31 | -0.49 | cost -1 |
| `dd-drowned-deacon` | {2}{U}{B} 3/4 | {2}{U}{B} 2/4 | +0.83 | +0.33 | attack -1 |
| `dd-horror-garden` | {1}{B}{G} | {2}{B}{G}; During your Dawn: create a 1/1 black Drowned Spirit token. Whenever you sacrifice a creature, gain 1 life. | +4.09 | +0.27 | hand redesign |
| `dd-watch-and-tide` | {W}{U} | {1}{W}{U}; Tap target creature, then draw a card. Whispers {W}{U}. | -1.77 | -0.69 | hand redesign |
| `dd-marsh-mother-horror` | {3}{B}{G} 5/5 | {4}{B}{G} 4/4; Dread. Overrun. Dies: create a 2/2 green Kelp Shade token. | +3.48 | +0.28 | hand redesign |
| `dd-storm-and-salt` | {1}{R}{B} | {B}{R} | -1.04 | -0.22 | cost -1 |
| `dd-lamp-and-lightning` | {2}{R}{W} 4/4 | {3}{R}{W} 3/4; Warcry. Sentinel. Duty, {1}: damage target creature 1. | +2.54 | +0.42 | hand redesign |
| `dd-drowned-chapel-bell` | {2}{W} | {W} | -1.94 | -0.30 | cost -1, cost -1 |
| `dd-lantern-wisp-caller` | {2}{W} 1/3 | {3}{W} 1/3 | +0.80 | -0.02 | cost +1 |
| `dd-vigil-candle` | {1}{W} | {W} | -1.32 | -0.50 | cost -1 |
| `dd-lamp-relay` | {1}{W} | {3}{W} | +2.18 | +0.54 | cost +1, cost +1 |
| `dd-the-watch-holds` | {2}{W} | {1}{W} | -1.17 | -0.35 | cost -1 |
| `dd-rite-of-the-lamp` | {1}{W} | {W} | -1.05 | -0.23 | cost -1 |
| `dd-salt-chapel` | {2}{W} | {W}; Whenever a creature arrives under your control, gain 2 life. | -2.44 | -0.50 | hand redesign |
| `dd-low-street-looter` | {1}{U} 1/2 | {2}{U} 1/2 | +1.23 | +0.41 | cost +1 |
| `dd-undertow-charm` | {1}{U} | {U} | -1.05 | -0.23 | cost -1 |
| `dd-tide-that-turns` | {2}{U} | {3}{U}; "Whispers {1}{U}." to "Whispers {2}{U}." | +0.41 | -0.41 | pool floor |
| `dd-net-of-glass` | {2} | {4}; Duty, {3}: draw a card. | +3.03 | +0.59 | hand redesign |
| `dd-salt-fog` | {3}{U} | {3}{U}; Tap all creatures an opponent controls. Draw a card. | -2.36 | -0.71 | hand redesign |
| `dd-drift-net` | {2}{U} | {1}{U} | -1.54 | -0.72 | cost -1 |
| `dd-reach-tide-caller` | {3}{U} 2/3 | {2}{U} 2/3 | -0.76 | +0.06 | cost -1 |
| `dd-glass-eyed-drowned` | {1}{U} 1/1 | {2}{U} 1/1 | +0.82 | +0.00 | cost +1 |
| `dd-cold-harbour` | {2}{U} | {1}{U}; "Whispers {1}{U}." to "Whispers {U}." | -1.12 | -0.30 | cost -1 |
| `dd-low-street-witch` | {B} 1/1 | {1}{B} 1/1; Duty, {1}: draw a card, then discard a card. | +1.95 | +0.73 | hand redesign |
| `dd-deep-spawn-tender` | {2}{B} 2/2 | {3}{B} 2/2 | +0.98 | +0.16 | cost +1 |
| `dd-drowned-horror` | {4}{B} 5/4 | {4}{B} 4/4 | +1.07 | +0.57 | attack -1 |
| `dd-tithe-of-the-wharf` | {1}{B} | {B} | -0.87 | -0.05 | cost -1 |
| `dd-marsh-widow` | {2}{B} 2/3 | {3}{B} 2/3 | +0.76 | -0.06 | cost +1 |
| `dd-cold-bargain` | {3}{B} | {2}{B} | -1.26 | -0.44 | cost -1 |
| `dd-drowned-grave` | {1}{B} | {B} | -0.79 | +0.03 | cost -1 |
| `dd-what-the-sea-wants` | {1}{B} | {2}{B}; "Whispers {B}." to "Whispers {1}{B}." | +0.93 | +0.11 | cost +1 |
| `dd-black-tide-rising` | {3}{B}{B} | {1}{B}{B} | -2.38 | -0.74 | cost -1, cost -1 |
| `dd-deep-spawn-hatchery` | {3}{B} | {5}{B}; Duty, {3}{B}: create a 2/2 black Deep-Spawn token. | +3.34 | +0.20 | hand redesign |
| `dd-deep-one-elder` | {5}{B} 6/5 | {5}{B} 5/5 | +1.25 | +0.75 | attack -1 |
| `dd-drowned-bargain-lesser` | {2}{B} | {1}{B} | -1.06 | -0.24 | cost -1 |
| `dd-deep-ones-blessing` | {2}{B} | {B} | -1.74 | -0.10 | cost -1, cost -1 |
| `dd-drowned-mother` | {4}{B} 3/4 | {5}{B} 3/4 | +0.88 | +0.06 | cost +1 |
| `dd-kelp-shade` | {1}{G} 1/3 | {3}{G} 1/3 | +1.80 | +0.16 | cost +1, cost +1 |
| `dd-marsh-horror` | {3}{G} 4/4 | {3}{G} 3/4 | +0.94 | +0.44 | attack -1 |
| `dd-tide-worn-brute` | {4}{G} 5/5 | {4}{G} 4/5 | +1.12 | +0.62 | attack -1 |
| `dd-kelp-shade-swarm` | {3}{G} | {4}{G} | +1.04 | +0.22 | cost +1 |
| `dd-old-growth-horror` | {5}{G}{G} 7/7 | {6}{G}{G} 6/7 | +1.43 | +0.11 | attack -1, cost +1 |
| `dd-tidepool-bloom` | {2}{G} | {1}{G} | -1.20 | -0.38 | cost -1 |
| `dd-marsh-wight-lesser` | {2}{G} 3/2 | {3}{G} 3/2; "Whispers {G}." to "Whispers {2}{G}." | +1.14 | +0.32 | cost +1 |
| `dd-reef-growth` | {1}{G} | {1}{G}; Your creatures with Marks get +1/+1. | -0.92 | +0.08 | hand redesign |
| `dd-marsh-giant` | {5}{G} 6/6 | {6}{G} 5/6 | +1.30 | -0.02 | attack -1, cost +1 |
| `dd-reed-caller` | {3}{G} 2/4 | {4}{G} 1/4; Duty, {2}{G}: create a 2/2 green Kelp Shade token. | +2.74 | +0.22 | hand redesign |
| `dd-tide-roots` | {1}{G} | {G} | -1.22 | -0.40 | cost -1 |
| `dd-drowned-harvest-lesser` | {2}{G} | {1}{G} | -0.92 | -0.10 | cost -1 |
| `dd-kelp-shade-elder` | {4}{G} 4/6 | {5}{G} 3/6 | +2.02 | +0.70 | cost +1, attack -1 |
| `dd-old-reef` | {6}{G} 7/8 | {7}{G} 7/8 | +1.42 | +0.60 | cost +1 |
| `dd-wrecker-lantern-bearer` | {2}{R} 3/2 | {3}{R} 3/2 | +1.46 | +0.64 | cost +1 |
| `dd-wreck-fire-lesser` | {3}{R} | {2}{R} | -1.36 | -0.54 | cost -1 |
| `dd-forge-lamp` | {1} | {2} | +1.45 | +0.63 | cost +1 |
| `dd-breakwater-riot-lesser` | {2}{R} | {1}{R} | -1.29 | -0.47 | cost -1 |
| `dd-fire-on-the-water` | {2}{R}{R} | {1}{R}{R}; "Damage target creature 5" to "Damage target creature 6"; "Whispers {1}{R}{R}." to "Whispers {R}{R}." | -1.71 | -0.54 | cost -1, effect +1 |
| `dd-breakwater-veteran` | {3}{R} 4/4 | {4}{R} 4/4 | +1.08 | +0.26 | cost +1 |
| `dd-wreck-diver` | {1}{R} 1/3 | {2}{R} 1/1; Duty, {1}: draw a card, then discard a card. | +2.58 | +0.36 | hand redesign |
| `dd-storm-bell` | {2} | {3} | +1.28 | +0.46 | cost +1 |
| `dd-wrecker-rage` | {1}{R} | {R} | -0.88 | -0.06 | cost -1 |
| `dd-rite-of-the-lamp-fire` | {2}{R} | {1}{R} | -1.54 | -0.72 | cost -1 |

## Self-audit (after the density revision)

Counts are over the 321-row pool (one SSR over the 320 target; the cut
absorbs it).

| Colour | Rows | Whispers | Dread (Horrors) | Duty | Skim | Self-mill | Looters | Rite | Tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| White | 62 | 6 | 0 | 13 | 4 | 0 | 0 | 3 | 3 |
| Blue | 62 | 12 | 5 | 12 | 6 | 10 | 5 | 0 | 0 |
| Black | 63 | 13 | 16 | 8 | 5 | 13 | 2 | 0 | 6 |
| Green | 62 | 4 | 11 | 11 | 4 | 0 | 0 | 0 | 9 |
| Red | 62 | 14 | 0 | 12 | 5 | 0 | 1 | 3 | 0 |
| Multicolour | 10 | 2 | 3 | 4 | 0 | 2 | 0 | 0 | 2 |
| **Pool** | **321** | **51 (16%)** | **35 (11%)** | **60 (19%)** | **24** | **25** | **8** | **6** | **20** |

Against the brief's budget at 250 (Whispers 22, Dread 14, Duty 30, enablers
36): the pool carries each at roughly one and a half to two times the cut's
target, which is the right overage for a cut that uses enabler density as a
constraint. The cut brings Whispers to about 25, Dread to about 18 Horrors,
Duty to about 38 and looters to 6 (the brief's number; two of the eight are
the first to go).

Other checks: every Dread carrier is a Horror and every Horror carries
Dread; no card carries two graveyard cast modes; Rite is white and red only,
never on a Horror; Dread is black first, blue and green second, never white
or red; multicolour is 10 of 321 at R and above; no lands; every artifact
and enchantment has ongoing text; near-vanilla commons (vanilla or
keyword-only creatures) are 24 of 160, fifteen percent, under the thirty
percent ceiling; the red Horrors of the first draft were retyped as Spirits
so Horror stays a Dread-colour identity. Type mix: 177 creatures, 57
Rituals, 39 Charms, 26 enchantments, 22 artifacts.

**AI-risk rows, all `stretch`:** Tide-Scribe, Drift-Net, Drowned Grave
(mill-count and cast-count observers), Reef-Glass Oracle (revised to an
arrival), Lightkeeper's Apprentice. They are cut first.

**Not yet done, by design:** power-formula scoring per row and the overlap
audit against the live pool. The formula has no rates for Whispers, Dread or
Duty until the tap-ability tooling wave and the Drowned Deep engine wave
land; the known parts (bodies, keywords, existing ops) are scored at the cut
and the new-mechanic rows are flagged for the Assay after those waves.

## Protect-first (the ten the cut keeps whatever the histogram says)

1. **Mother Hydra, Queen Beneath Dunmarrow**: the flagship Horror and the
   Dread finisher every black deck wants.
2. **Father Dagon, the Deep Itself**: the two-colour top with the set's
   thesis on it (each player grinds 3: mill feeds Whispers for both).
3. **Maren Holt, the Lightkeeper**: the Duty creature showcase, Sentinel
   plus tap-to-tap, the card the AI policy's creature branch was built for.
4. **The Bell That Will Not Ring**: the Duty artifact showcase.
5. **Low Street Looter and Low Street Witch**: the common looters, the
   engine's first repeatable choice-discard outlets.
6. **Fog Bank, Salt-Fire Charm, Salt in the Eyes**: the one-mana Whispers
   Charms that teach the mechanic on turn one.
7. **Deep One Scout and Deep One Warrior**: the common Horrors that make
   Dread a curve.
8. **Vigil at Low Water and Black Water**: the two sweepers, Rituals as the
   rules require, white and black.
9. **Kelp-Tender and Kelp Swarm**: the common go-wide bodies that are also
   Dread fodder, the counterweight the sweep demands.
10. **Rite of the Lightkeepers and Rite of the False Beacon**: Rite in the
    non-Dread colours, so the sacrifice split is visible at Rare.

## The cut, in order

1. All 13 `stretch` rows.
2. `flex` rows by the histogram, per colour, until 124 / 75 / 23 / 16 / 12,
   keeping enabler density (at least 1.5 outlets per Whispers card in each
   colour that prints Whispers) and the token-minter floor (two per token).
3. Then the overlap audit against the live pool (`scripts/audit-overlap.ts`)
   and the name collision check; a row that duplicates a shipped card is
   swapped for the next `flex` row of its colour and rarity, not reworded.
4. Then costing: known ops by the formula now, the new mechanics by the
   Assay when the rates exist.
