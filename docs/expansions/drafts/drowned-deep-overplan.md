<!-- source-of-truth: docs/expansions/drafts/drowned-deep-brief.md, docs/plan-drowned-deep-engine.md, docs/plan-tap-abilities.md, docs/keyword-map.md, src/engine/types.ts, src/data/axes.ts · last-verified: 2026-09-11 · concept draft — the fresh 320-candidate overplan for the 250-card Drowned Deep cut; authored in batches (this file is batch 1 of 5: the identity layer); nothing here is implemented -->

# The Drowned Deep: overplan (fresh, 2026-09-11)

The 320-candidate pool for the 250-card cut, authored against the approved
[identity brief](drowned-deep-brief.md) and the ruled
[engine spec](../../plan-drowned-deep-engine.md). It replaces the retired
2026-07-26 draft entirely; no row from that draft is reused.

**Batches.** 1: URs and SSRs (the identity layer, this batch). 2: SRs. 3:
Rares. 4: Commons. 5: tokens, precon, bosses, the self-audit and the
protect-first and cut lists. The cut happens after batch 5, with enabler
density and the overlap audit as cut constraints.

## Rarity target

Cut: **124 C / 75 R / 23 SR / 16 SSR / 12 UR = 250.** Overplan: 160 C / 96 R
/ 30 SR / 20 SSR / 14 UR = 320. Multicolour only at R and above, under ten
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
| dd-mother-hydra | Mother Hydra, Queen Beneath Dunmarrow | UR | B | Creature, Deep One Horror, legendary | {5}{B}{B} | 7/7 | Dreaded. Dread. Arrives: destroy target creature. During your Dawn, if you control another Horror, opponent loses 2 life. | She has been the town's landlord for three hundred years and has never once raised the rent. | core |
| dd-father-dagon | Father Dagon, the Deep Itself | UR | U/B | Creature, Deep One Horror, legendary | {6}{U}{B} | 8/8 | Dreaded. Overrun. Dread. Arrives: each player grinds 3. | The harbour floor is not the bottom. It is his brow. | core |
| dd-lightkeeper | Maren Holt, the Lightkeeper | UR | W | Creature, Human Warden, legendary | {3}{W}{W} | 4/6 | Sentinel. Warding Gaze. Duty: gain 3 life and tap target creature an opponent controls. | The light has not gone dark in three hundred years, and she is why. | core |
| dd-bell-that-will-not-ring | The Bell That Will Not Ring | UR | W | Artifact, legendary | {3}{W} | none | Duty, {1}: tap target creature. During your Dawn: gain 1 life. Your Wardens get +0/+1. | It was cast to warn the town. It has decided the town should not know. | core |
| dd-tide-that-remembers | The Tide That Remembers | UR | U | Ritual | {3}{U}{U} | none | Draw 3, then grind self 3. Whispers {2}{U}{U}. | The water keeps every name it was ever given, and returns them in the wrong order. | core |
| dd-isolde-marrow | Isolde Marrow, Drowned Cartographer | UR | U | Creature, Human, legendary | {2}{U}{U} | 2/5 | Skim {U}. Duty: Foresee 2, then draw 1. | Her charts are accurate to the inch, for a coast that no longer exists. | core |
| dd-agathe-vane | Agathe Vane, the Salt Widow | UR | B | Creature, Human Witch, legendary | {2}{B}{B} | 3/4 | Deathblade. Duty: opponent loses 1 life and you gain 1 life. Skim {B}. Whispers {1}{B}{B}. | Four husbands, one wedding ring, and the sea owes her for all of them. | core |
| dd-the-brood-below | The Brood Below | UR | B | Creature, Deep One Horror | {4}{B}{B} | 5/5 | Dread. Arrives: create two 2/2 black Deep-Spawn tokens. Dies: create two 2/2 black Deep-Spawn tokens. | What the nets bring up in spring is not fish, and the town has learned not to count. | core |
| dd-the-reef-that-walks | The Reef That Walks | UR | G | Creature, Horror | {6}{G}{G} | 8/8 | Overrun. Dread. Arrives: put a Mark on each other creature you control. | Coral grows on whatever stands still long enough. The reef stopped standing still. | core |
| dd-old-marrow | Old Marrow, Keeper of the Salt Marsh | UR | G | Creature, Human Witch, legendary | {3}{G}{G} | 4/6 | Bulwark. Duty: create a 2/2 green Kelp Shade token. | She plants the drowned where the reeds are thickest, and something always comes up. | core |
| dd-brenna-gale | Brenna Gale, Storm-Caller of the Reach | UR | R | Creature, Human, legendary | {2}{R}{R} | 4/3 | Warcry. Rage. Duty: damage target creature 2. | She can hold the storm or hold the line. Not both, and she knows it. | core |
| dd-wreckfire | Wreckfire | UR | R | Ritual | {3}{R}{R} | none | Damage all creatures 3. Whispers {2}{R}{R}. | The wreckers light the false beacon, and the sea lights everything else. | core |
| dd-the-choir-below | The Choir Below | UR | U/B | Enchantment, legendary | {2}{U}{B} | none | During your Dawn: grind self 2. Duty: Foresee 1, then draw 1. | They sing in the voices of the people you miss, and they are very good at it. | flex |
| dd-the-lantern-watch | The Lantern Watch | UR | W/U | Enchantment, legendary | {2}{W}{U} | none | Your creatures have Warding Gaze. Duty: tap target creature. | Every lamp on the coast has a woman behind it, and every woman has a reason. | flex |

## Double Super Rare (20; cut keeps 16)

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-harbourmaster | Constance Reyne, Harbourmaster | SSR | W | Creature, Human Warden, legendary | {2}{W}{W} | 3/4 | Sentinel. Duty: create a 1/1 white Lantern Wisp token with Skyborne. | She logs every boat that leaves and every boat that returns. The ledgers do not match. | core |
| dd-gate-of-salt | The Salt Gate | SSR | W | Artifact | {2}{W} | none | Duty: prevent combat this turn. During your Dawn: gain 1 life. | The gate holds the tide out and the town in. Nobody has asked which it was built for. | core |
| dd-vigil-at-low-water | Vigil at Low Water | SSR | W | Ritual | {3}{W}{W} | none | Destroy all creatures. Whispers {3}{W}. | At low water the town walks out to see what the sea has left, and prays it is nothing. | core |
| dd-lamp-oil-saint | Saint of the Lamp Oil | SSR | W | Creature, Human Warden | {3}{W} | 2/5 | Warding Gaze. Duty: gain 2 life. Whenever you gain life, put a Mark on this. | She keeps the lamps full and the books balanced, and the second is harder. | flex |
| dd-tidewife | Ysolt the Tidewife | SSR | U | Creature, Mermaid, legendary | {3}{U}{U} | 4/4 | Skyborne. Arrives: grind self 3. Duty: recall target creature with cost 3 or less. | She married the tide. The tide has been very attentive. | core |
| dd-drowned-scholar | Drowned Scholar of the Reach | SSR | U | Creature, Human | {2}{U} | 1/4 | Duty: draw a card, then discard a card. | Everything she knows she read underwater, and it has not stopped being true. | core |
| dd-undertow | Undertow | SSR | U | Charm | {2}{U}{U} | none | Recall target creature and Foresee 2. Whispers {U}{U}. | The current does not take you out to sea. It takes you down. | core |
| dd-glass-that-came-back | The Glass That Came Back | SSR | U | Artifact | {2}{U} | none | Duty: Foresee 2. Duty, {2}: draw a card. | It was a bottle. Then it spent a century below. Now it shows you things. | flex |
| dd-drowned-bride | The Drowned Bride | SSR | B | Creature, Deep One Horror | {3}{B}{B} | 5/4 | Dreaded. Dread. Dies: return this to your hand. | The wedding was held on the wharf. The groom was never described. | core |
| dd-wharf-rat-queen | Sable, the Wharf Queen | SSR | B | Creature, Human Witch, legendary | {2}{B}{B} | 3/3 | Deathblade. Duty: opponent discards a card at random. Skim {B}. | The town's secrets are kept in her cellar, in jars, and the jars are labelled. | core |
| dd-bargain-below | Bargain Below | SSR | B | Ritual | {2}{B}{B} | none | Sever target creature. You lose 2 life. Whispers {1}{B}{B}. | The price is always fair. That is what makes it unbearable. | core |
| dd-salt-marsh-horror | Marsh-Born Horror | SSR | B | Creature, Deep One Horror | {5}{B} | 6/6 | Dread. Arrives: grind self 2. Whenever another creature you control dies, put a Mark on this. | It was three fishermen. It remembers all three of their wives. | flex |
| dd-reef-warden | Elowen Cray, Reef-Warden | SSR | G | Creature, Human Warden, legendary | {2}{G}{G} | 4/5 | Warding Gaze. Duty: put a Mark on target creature you control. | The reef grows where she tells it to, and lately it has started to answer back. | core |
| dd-kelp-cathedral | Kelp Cathedral | SSR | G | Enchantment | {3}{G} | none | Your Plant tokens get +1/+1. Duty, {G}: create a 2/2 green Kelp Shade token. | The congregation is rooted. The sermons are long. | core |
| dd-something-in-the-nets | Something in the Nets | SSR | G | Creature, Horror | {4}{G}{G} | 6/6 | Dread. Overrun. Arrives: gain 4 life. | The catch was heavy, and it was breathing. | flex |
| dd-marsh-grave-risen | Marsh-Risen | SSR | G | Creature, Horror | {3}{G} | 3/5 | Dread. Whispers {1}{G}{G}. | Buried in the reeds by her sisters. The reeds did not keep her. | core |
| dd-false-beacon | The False Beacon | SSR | R | Artifact | {3}{R} | none | Duty: damage target creature 1. During your Dawn, if a creature died this turn, damage opponent 1. | A lamp on the wrong rock is a murder that looks like weather. | core |
| dd-wrecker-captain | Halla Brand, Wrecker Captain | SSR | R | Creature, Human, legendary | {3}{R}{R} | 5/4 | Warcry. Overrun. Whenever this attacks, damage opponent 1. Skim {R}. Whispers {1}{R}{R}. | Every ship she saves, she saves for parts. | core |
| dd-storm-surge | Storm Surge | SSR | R | Charm | {1}{R}{R} | none | Damage target creature 4. Whispers {R}. | The surge takes the wharf, the boats, and the argument about whose fault it was. | core |
| dd-drowned-fire | Drowned Fire | SSR | R | Ritual | {2}{R}{R} | none | Damage each opponent's creature 2 and damage opponent 2. Whispers {1}{R}{R}. | Fire does not go out underwater here. It goes quiet. | flex |
| dd-lightkeepers-oath | The Lightkeeper's Oath | SSR | W/U | Ritual | {1}{W}{U} | none | Tap all creatures an opponent controls. Foresee 2. Whispers {W}{U}. | She swore to keep the light. She did not swear to keep it for the living. | flex |

## Super Rare (30; cut keeps 23)

Six per colour. The SR band carries the set's second-tier engines: the
Duty showcase pieces that are not flagships, the mid-cost Horrors that make
Dread a curve rather than a finisher, the Whispers Charms that give blue and
red their instant-speed feel, and the first Rite cards in white and red.

| ID | Name | Rarity | Colour | Type | Cost | Stats | Mechanics sketch | Flavour hook | CUT-PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dd-bell-ringer-abbess | Abbess of the Bell-Ringers | SR | W | Creature, Human Warden | {2}{W}{W} | 3/4 | Warding Gaze. Duty: tap target creature. | Every bell in Dunmarrow answers to her, except the one that will not ring. | core |
| dd-widows-walk | Widow's Walk | SR | W | Enchantment | {1}{W} | none | Duty: gain 2 life. Whenever a creature you control dies, gain 1 life. | The women watch the sea from the roofs. The sea watches back, and takes notes. | core |
| dd-lamp-lit-vigil | Lamp-Lit Vigil | SR | W | Ritual | {2}{W} | none | Prevent combat this turn. Foresee 1. Whispers {W}. | The lamps go up and the boats stay in, and the night is only a night. | core |
| dd-gate-warden | Gate-Warden of the Salt Stair | SR | W | Creature, Human Warden | {3}{W} | 2/6 | Bulwark. Duty: tap target creature an opponent controls. | She has never once left her post. The post has moved twice. | core |
| dd-last-lamp | The Last Lamp on the Point | SR | W | Artifact | {2} | none | Duty, {W}: gain 2 life and Foresee 1. | When the others go dark, this one is meant to still be lit. It has been, so far. | flex |
| dd-rite-of-the-lightkeepers | Rite of the Lightkeepers | SR | W | Ritual | {2}{W}{W} | none | Rite 1. Destroy target creature. Gain 3 life. | One of the Watch walks into the lamp room and does not walk out, and the light is brighter for a year. | core |
| dd-tide-priestess | Tide-Priestess of the Reach | SR | U | Creature, Mermaid | {2}{U}{U} | 3/3 | Skyborne. Arrives: grind self 2. Duty: Foresee 1. | She reads the tide the way the town reads scripture, and with the same results. | core |
| dd-net-mender | Net-Mender of Low Street | SR | U | Creature, Human | {1}{U} | 1/3 | Duty: draw a card, then discard a card. | She mends the nets with what the nets bring in, and the nets have started bringing in thread. | core |
| dd-cold-current | Cold Current | SR | U | Charm | {1}{U} | none | Cancel target spell with cost 3 or less. Whispers {U}. | The sea does not argue. It just declines. | core |
| dd-drowned-archive | The Drowned Archive | SR | U | Enchantment | {2}{U} | none | During your Dawn: grind self 1. Duty: draw a card. | The town hall flooded in the great tide. The records kept being written. | core |
| dd-thing-in-the-cistern | Thing in the Cistern | SR | U | Creature, Deep One Horror | {3}{U}{U} | 4/5 | Dread. Arrives: recall target creature an opponent controls. | The cistern was sealed. It has been sealed for a while now. It has opinions. | core |
| dd-remembered-shore | Remembered Shore | SR | U | Ritual | {2}{U}{U} | none | Draw 2. Grind self 2. Whispers {1}{U}{U}. | The beach is where she left it. The town is not. | flex |
| dd-jar-witch | The Jar-Witch of Low Street | SR | B | Creature, Human Witch | {1}{B}{B} | 2/3 | Deathblade. Duty: opponent discards a card at random. | Every secret in a jar, every jar on a shelf, and the shelf is not for sale. | core |
| dd-drowned-sexton | The Drowned Sexton | SR | B | Creature, Human | {2}{B}{B} | 3/3 | Arrives: grind self 3. Duty: return target creature card from your graveyard to your hand. | He buries the drowned and the drowned come back to help. It is a small parish. | core |
| dd-deep-one-hierophant | Deep One Hierophant | SR | B | Creature, Deep One Horror | {3}{B}{B} | 4/4 | Dreaded. Dread. Arrives: opponent loses 2 life and you gain 2 life. | She wears the vestments of the church that used to be here, and wears them well. | core |
| dd-salt-in-the-wound | Salt in the Wound | SR | B | Charm | {1}{B}{B} | none | Target creature gets -3/-3 until end of turn. Whispers {B}. | The sea gets into everything. The sea especially gets into that. | core |
| dd-tithe-to-the-deep | Tithe to the Deep | SR | B | Ritual | {3}{B} | none | Opponent sacrifices a creature. Grind self 2. Whispers {2}{B}. | The collection plate goes round, and it comes back wet. | flex |
| dd-what-the-nets-remember | What the Nets Remember | SR | B | Creature, Deep One Horror | {4}{B}{B} | 5/5 | Dread. Dies: create a 1/1 black Drowned Spirit token. Whenever another Horror you control dies, you gain 2 life. | It has the faces of everyone the nets ever lost, and it is learning to use them. | flex |
| dd-reef-shaman | Reef Shaman of the Shallows | SR | G | Creature, Human Witch | {2}{G}{G} | 3/4 | Duty: put a Mark on target creature. Whenever you put a Mark on a creature, gain 1 life. | The coral takes to her like a garden takes to weather. | core |
| dd-kelp-shade-caller | Kelp-Shade Caller | SR | G | Creature, Human | {2}{G} | 2/3 | Arrives: create a 2/2 green Kelp Shade token. Duty, {G}: create a 2/2 green Kelp Shade token. | She whistles and the marsh stands up. | core |
| dd-tidepool-colossus | Tidepool Colossus | SR | G | Creature, Horror | {5}{G}{G} | 7/7 | Dread. Overrun. Whispers {3}{G}{G}. | It fits in a tidepool the way a cathedral fits in a town: badly, and it does not care. | core |
| dd-marsh-root-warden | Marsh-Root Warden | SR | G | Creature, Human Warden | {3}{G} | 4/4 | Sentinel. Duty: gain 2 life and put a Mark on this. | Her post is the marsh road, and the marsh road is never in the same place twice. | flex |
| dd-drowned-grove | Drowned Grove | SR | G | Enchantment | {2}{G} | none | Your creatures with Marks get +1/+1. Duty: put a Mark on target creature you control. | The trees went under a century ago and kept growing. Nobody has told them. | core |
| dd-the-catch | The Catch | SR | G | Ritual | {2}{G} | none | Create two 2/2 green Kelp Shade tokens. Whispers {1}{G}. | Some mornings the nets are full of something the town can use. | flex |
| dd-wrecker-lantern | Wrecker's Lantern | SR | R | Artifact | {2} | none | Duty, {R}: damage target creature 1. | Hang it on the wrong rock, wait, and the sea does the rest. | core |
| dd-storm-choir | Storm Choir | SR | R | Creature, Human | {3}{R} | 4/3 | Warcry. Rage. Duty: damage opponent 2. | They sing the storm in, and the storm is a good listener. | core |
| dd-rite-of-the-false-beacon | Rite of the False Beacon | SR | R | Ritual | {2}{R}{R} | none | Rite 1. Damage target creature 5. | The lamp needs oil. The lamp is not particular about what burns. | core |
| dd-gale-charm | Gale | SR | R | Charm | {2}{R} | none | Damage target creature 3. Whispers {R}. | It came in off the water at noon and by one there was no wharf. | core |
| dd-salt-fire-witch | Salt-Fire Witch | SR | R | Creature, Human Witch | {2}{R}{R} | 4/2 | First Blade. Skim {R}. Whispers {1}{R}. | Her fire burns green on the wet wood and she likes it that way. | flex |
| dd-breakwater-brawl | Breakwater Brawl | SR | R | Ritual | {3}{R} | none | Damage each creature 2. Whispers {2}{R}. | The fishermen settle it on the breakwater, and the breakwater settles it for them. | flex |

*Batches 3 to 5 follow: Rares (96), Commons (160), then tokens, precon,
bosses and the self-audit.*
