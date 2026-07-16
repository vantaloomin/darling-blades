<!-- source-of-truth: src/engine/types.ts · last-verified: 2026-07-16 · concept doc — Expansion 3, folded into the 1.2 release (user decision 2026-07-16); implementation target src/data/cards/arthurian-court.ts; anti-rot anchors on the Keyword/EffectOp vocabulary the card tables must stay legal against -->

# Expansion 3 - Arthurian Court: The Grail Oath

Linked block: **Arthurian Court** is part two of the Celtic/Arthurian two-set block. Celtic Fae establishes bargains, the severed zone, and fate manipulation; Arthurian Court answers with vows, Quests, awakened champions, and steel-backed heroism.

## Theme And Visual Identity

Arthurian Court is a high-chivalric set about doomed glory, grail vows, sword tests, court intrigue, lake magic, and heroic transformation. The court is beautiful, but every banner already casts a long shadow.

Visual anchors: polished steel, white-gold sunlight, crimson pennants, moonlit lakes, chapel windows, tournament grounds, stone keeps, thorned crowns, grail radiance, and enchanted blades. All characters are adult-coded and genderbent where applicable.

## Mechanic Summary

- **Quests**: chapter enchantments (`subtypes: ['Quest']`) that advance one chapter at each of the controller's dawns and deliver a final payoff, then leave the battlefield. Chapter effects are triggers, so they obey the trigger law (never target); chapter op lists live in `CardDef.chapters`.
- **Champion Awakening**: creatures with an `awakening` block (stat/keyword upgrade) flip to a persistent awakened state when an `awaken` effect resolves. The flip is one-way.
- **Quest riders**: "while a Quest is active" (`questActive` condition on abilities and statics) rewards keeping a Quest on the battlefield.
- Primary colors: W/U/R, with B Morgan curse/control and G Grail nature support.
- Mechanical identity: heroic midrange, chapter-based value, awakened legends, knight tribal, and court intrigue.
- Uses the game-wide Foresee (`foresee`) and Sever (`sever`/`severGrave`) vocabulary; one new token, the **1/1 W Squire** (base-set token per the Ragnarök precedent; needs one token art asset).

_Concretion note (2026-07-16): the original sketch used vocabulary the engine does not have (activated "tap:" abilities, self-discard, menace, targeted chapter effects, cost discounts, attacker-filter statics). Every row below is now expressed in the real Keyword/EffectOp vocabulary plus the three 1.2 mechanics additions (chapters, awaken, questActive). Multicolor is reserved for named legends per the catalog invariant; generic multicolor rows were mono-colored (the Celtic Fae correction pattern)._

## Rarity Target

`40 C / 24 R / 7 SR / 5 SSR / 4 UR = 80 booster cards`

## Full Card List

| ID | Name | Rarity | Color | Type | Subject | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ac-artoria-once-future | Artoria, Once and Future Queen | UR | W/U | Legendary Creature | Arthur analogue | sentinel; awakening (stats + keywords) | Set face, awakened ruler |
| ac-morgan-thorn-crown | Morgan of the Thorn Crown | UR | U/B | Legendary Creature | Morgan le Fay | dawn: foresee; dawn if questActive: loseLife opponent; arrives: severGrave | Control boss legend |
| ac-nimue-lake-sovereign | Nimue, Lake Sovereign | UR | U/W | Legendary Creature | Lady of the Lake | dawn: foresee; dawn if questActive: draw | Control/value legend |
| ac-grail-radiant-secret | The Grail, Radiant Secret | UR | W/G | Legendary Artifact | Holy Grail analogue | dawn: gainLife; dawn if questActive: awaken allYours | Mythic relic build-around |
| ac-lancelot-moonlit-shame | Lancelot, Moonlit Shame | SSR | W/R | Legendary Creature | Lancelot analogue | twinBlades; awakening (the shame carried in flavor) | Elite duelist |
| ac-guinevere-court-sun | Guinevere, Court Sun | SSR | W/U | Legendary Creature | Court queen | arrives: foresee; dawn if questActive: createToken Squire | Court engine |
| ac-gawain-noonblade | Gawain of the Noonblade | SSR | R/W | Legendary Creature | Solar knight | firstBlade; attacks if questActive: damage opponent | Aggro legend |
| ac-quest-for-the-grail | Quest for the Grail | SSR | W | Enchantment - Quest | Grail quest | chapters: foresee / gainLife / awaken allYours | Signature Quest |
| ac-fall-of-camelot | The Fall of Camelot | SSR | B/R | Legendary Enchantment - Quest | Tragic collapse | chapters: damage opponent / discardRandom / massDestroy | Big chapter payoff |
| ac-percival-clear-heart | Percival, Clear-Heart Knight | SR | W/G | Legendary Creature | Grail knight | sentinel, bloodoath | Midrange lifegain |
| ac-galahad-silver-oath | Galahad, Silver Oath | SR | W | Legendary Creature | Pure knight | untouchable while questActive (self static) | Quest payoff threat |
| ac-merlin-crow-clock | Merlin, Crow-Clock Sage | SR | U | Legendary Creature | Merlin analogue | arrives: foresee; dawn if questActive: foresee | Blue setup |
| ac-excalibur-from-lake | Excalibur From the Lake | SR | C | Legendary Artifact | Sacred sword | static: your Knights +1/+1 and firstBlade | Relic build-around |
| ac-round-table-vow | Vow of the Round Table | SR | W | Enchantment - Quest | Knightly vow | chapters: createToken Squire / boost allYours / awaken allYours | Tribal Quest |
| ac-green-knight-challenge | The Green Knight's Challenge | SR | G | Enchantment - Quest | Beheading-game analogue | chapters: damage controller / boost allYours / awaken allYours | Green Quest |
| ac-mordred-bastard-star | Mordred, Bastard Star | SR | B/R | Legendary Creature | Mordred analogue | overrun, warcry; attacks: damage opponent | Villain midrange |
| ac-camelot-banneret | Camelot Banneret | R | W | Creature | Court soldier | sentinel; arrives if questActive: createToken Squire | Knight support |
| ac-lakeblade-initiate | Lakeblade Initiate | R | U | Creature | Lake knight | firstBlade; arrives: foresee | Tempo knight |
| ac-chapel-questant | Chapel Questant | R | W | Creature | Grail seeker | bloodoath; dawn if questActive: gainLife | Lifegain quest body |
| ac-ashwood-ranger | Ashwood Ranger | R | G | Creature | Forest knight | wardingGaze; arrives: addCounters self | Green support |
| ac-velvet-court-spy | Velvet Court Spy | R | B | Creature | Court infiltrator | arrives: foresee; combatDamageToPlayer: discardRandom | Intrigue piece |
| ac-tournament-favorite | Tournament Favorite | R | R | Creature | Arena knight | firstBlade, warcry | Aggro rare |
| ac-questing-beast-maiden | Questing Beast-Maiden | R | G | Creature | Mythic huntress | overrun, sentinel | Green pressure |
| ac-mirror-of-avalon | Mirror of Avalon | R | U | Artifact | Avalon mirror | dawn: foresee | Control relic |
| ac-black-chapel-curse | Black Chapel Curse | R | B | Enchantment - Quest | Morgan curse | chapters: loseLife opponent / discardRandom / severGrave opponent | Black Quest |
| ac-sword-test-stone | The Sword in the Stone | R | C | Artifact | Sword in stone | dawn if questActive: awaken allYours | Awakening enabler |
| ac-grail-procession | Grail Procession | R | W | Ritual | Sacred march | createToken Squire x2, gainLife | Token support |
| ac-lion-standard | Lion Standard | R | W | Enchantment | Royal banner | static: your Knights +1/+1 | Tribal support |
| ac-courtly-betrayal | Courtly Betrayal | R | B | Ritual | Court intrigue | discardRandom, foresee | Black disruption |
| ac-lady-of-lilies | Lady of Lilies | R | U | Creature | Lake priestess | dawn if questActive: draw | Control support |
| ac-red-dragon-banner | Red Dragon Banner | R | R | Enchantment | War banner | dawn: boost allYours +N/+0 (until end of turn) | Red aggro |
| ac-grail-hermit | Grail Hermit | R | G | Creature | Hermit guide | arrives: foresee, gainLife | Value support |
| ac-moonlit-joust | Moonlit Joust | R | R | Charm | Tournament duel | boost target (grants firstBlade), damage target | Combat trick |
| ac-secret-of-avalon | Secret of Avalon | R | U | Ritual | Avalon revelation | draw, foresee | Blue card draw |
| ac-castle-under-siege | Castle Under Siege | R | R | Enchantment - Quest | Siege Quest | chapters: createToken Squire / damage opponent / boost allYours | Midrange Quest |
| ac-raven-of-camlann | Raven of Camlann | R | B | Creature | War omen | skyborne; arrives: severGrave opponent | Grave hate |
| ac-oathbroken-knight | Oathbroken Knight | R | B | Creature | Fallen knight | deathblade, warcry | Aggro removal body |
| ac-lance-of-dawn | Lance of Dawn | R | W | Enchantment - Aura | Knight weapon | attached: +2/+0, firstBlade | Weapon aura |
| ac-queen-regents-command | Queen-Regent's Command | R | U | Charm | Court command | tap target, draw | Flexible control |
| ac-holy-well | Holy Well | C | Land | Land | Grail spring | entersTapped, manaAbility W/G | Dual land |
| ac-avalon-shore | Avalon Shore | R | Land | Land | Lake realm | entersTapped, manaAbility U/W | Dual land |
| ac-novice-squire | Novice Squire | C | W | Creature | Adult novice retainer | sentinel | White common |
| ac-keep-watchwoman | Keep Watchwoman | C | W | Creature | Castle guard | bulwark | Defensive common |
| ac-lake-attendant | Lake Attendant | C | U | Creature | Avalon attendant | arrives: foresee | Blue setup |
| ac-court-minstrel | Court Minstrel | C | U | Creature | Bard | dawn if questActive: draw | Value common |
| ac-torchbearer-knight | Torchbearer Knight | C | R | Creature | Knight | warcry | Red common |
| ac-borderland-huntress | Borderland Huntress | C | G | Creature | Huntress | wardingGaze | Green common |
| ac-chapel-mender | Chapel Mender | C | W | Creature | Healer | arrives: gainLife | Lifegain common |
| ac-castle-blackguard | Castle Blackguard | C | B | Creature | Guard | deathblade | Black common |
| ac-quest-marker | Quest Marker | C | C | Artifact | Quest token marker | arrives: foresee | Utility artifact |
| ac-knights-breakfast | Knight's Breakfast | C | G | Ritual | Court feast | gainLife; if questActive: draw | Green value |
| ac-steel-prayer | Steel Prayer | C | W | Charm | Knight prayer | boost target +0/+N | White trick |
| ac-training-yard | Training Yard | C | R | Enchantment | Knight training | dawn: boost allYours +1/+0 (until end of turn) | Red support |
| ac-squire-to-champion | Squire to Champion | C | W | Enchantment - Quest | Training Quest | chapters: boost allYours / awaken allYours | Common Quest |
| ac-lantern-in-fog | Lantern in Fog | C | U | Charm | Mist guide | foresee, tap target | Tempo trick |
| ac-bitter-court-rumor | Bitter Court Rumor | C | B | Ritual | Court gossip | discardRandom | Black common |
| ac-hunt-the-boar | Hunt the Boar | C | G | Ritual | Knight hunt | damage target creature | Green removal |
| ac-tilting-lance | Tilting Lance | C | R | Charm | Joust weapon | boost target (grants firstBlade) | Combat trick |
| ac-white-horse | White Horse | C | W | Creature | Knight mount | sentinel | Mount-flavored body |
| ac-riverford-guard | Riverford Guard | C | W | Creature | Border guard | bulwark; arrives: foresee | Control common |
| ac-wounded-oath | Wounded Oath | C | B | Enchantment - Aura | Cursed vow | attached: -N/-N | Black aura |
| ac-candlelit-vigil | Candlelit Vigil | C | W | Enchantment | Chapel vigil | dawn: gainLife | Slow value |
| ac-errant-duelist | Errant Duelist | C | R | Creature | Wandering knight | firstBlade | Red common |
| ac-grail-glimpse | Grail Glimpse | C | U | Ritual | Vision | foresee 3 | Setup spell |
| ac-root-chapel-warden | Root-Chapel Warden | C | G | Creature | Sacred grove knight | wardingGaze, bloodoath | Defensive body |
| ac-fallen-banner | Fallen Banner | C | B | Ritual | Battlefield loss | damage target, grind self | Tragedy support |
| ac-pennant-carrier | Pennant Carrier | C | W | Creature | Banner carrier | static if questActive: your other Knights +1/+0 | Token support |
| ac-court-archer | Court Archer | C | G | Creature | Archer | wardingGaze | Green common |
| ac-silver-spur | Silver Spur | C | C | Artifact | Knight trinket | arrives: boost allYours +1/+0 (until end of turn) | Utility |
| ac-prophecy-attendant | Prophecy Attendant | C | U | Creature | Merlin's attendant | arrives: foresee | Blue common |
| ac-bramble-chapel | Bramble Chapel | C | Land | Land | Ruined chapel | entersTapped, manaAbility G | Common land |
| ac-lowland-fort | Lowland Fort | C | Land | Land | Border keep | entersTapped, manaAbility W | Common land |
| ac-red-tournament-ground | Red Tournament Ground | C | Land | Land | Joust field | entersTapped, manaAbility R | Common land |
| ac-court-of-whispers | Court of Whispers | C | Land | Land | Intrigue court | entersTapped, manaAbility B | Common land |
| ac-mirror-lake | Mirror Lake | C | Land | Land | Avalon lake | entersTapped, manaAbility U | Common land |
| ac-shieldwall-call | Shieldwall Call | C | W | Charm | Defensive formation | boost allYours +0/+N | Team trick |
| ac-woodland-errand | Woodland Errand | C | G | Ritual | Quest errand | fetchLand | Ramp |
| ac-treasonous-glance | Treasonous Glance | C | B | Charm | Betrayal | loseLife opponent, foresee | Black trick |
| ac-campfire-tale | Campfire Tale | C | R | Ritual | Knight tale | grind self, draw | Red rummage |
| ac-questing-map | Questing Map | C | C | Artifact | Map relic | arrives: foresee 2 | Quest support |

_Changed from the original sketch (2026-07-16 concretion): (1) mono-colored 12 generic multicolor rows (lakeblade-initiate U, velvet-court-spy B, tournament-favorite R, lady-of-lilies U, grail-hermit G, castle-under-siege R, oathbroken-knight B, queen-regents-command U, riverford-guard W, root-chapel-warden G, tilting-lance R, fallen-banner B) and made The Fall of Camelot a legendary enchantment, per the multicolor-implies-legendary catalog invariant; (2) chapter effects rewritten trigger-safe (Green Knight's Challenge, Black Chapel Curse, Squire to Champion); (3) Camelot Banneret's cost discount re-scoped to a questActive arrives token (no cost-modification seam exists); (4) "tap:" activated abilities re-expressed as dawn/arrives triggers (Mirror of Avalon, Silver Spur, Questing Map, Nimue); (5) Campfire Tale's rummage is grind-self + draw (no self-discard op); (6) Mordred's menace became overrun + warcry; (7) Lance of Dawn retyped Enchantment - Aura (no equipment system); (8) Red Dragon Banner / Training Yard attack pumps are dawn until-end-of-turn team boosts (no attacker-filter static)._

## Precon Identity

**Questing Table** - W/U/R heroic midrange. The deck develops knights, advances Quests, and converts completed chapters into awakened threats.

## Gauntlet Boss Concepts

- **Morgan of the Thorn Crown** - U/B Quest-control boss with curses, severed-zone attrition, foresee, and delayed payoffs. Planned rung 13.
- **Artoria, Once and Future Queen** - W/U knight-Quest boss that awakens champions and closes through disciplined combat. Planned rung 14.

## Art-Bible Follow-Up Notes

- Quests need visual language: illuminated manuscript panels, grail light, carved chapel reliefs, and bannered chapter motifs with no readable text.
- Champion Awakening needs before/after cues in the same art identity: dormant oath glow, broken seal, crown flare, or blade ignition.
- Keep Arthurian steel and court fabrics distinct from Celtic Fae mist/thorn silhouettes.
- The Squire token needs one new token art asset (the only planned generation besides audit-failed regens; all 80 card raws are already in the vault).
