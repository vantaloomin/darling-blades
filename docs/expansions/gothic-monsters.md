<!-- source-of-truth: src/engine/types.ts, docs/keyword-map.md · last-verified: 2026-07-17 · concept doc — Expansion 4, scheduled for 1.3 (plan-1.3.md Pillar 0); implementation target src/data/cards/gothic-monsters.ts; anti-rot anchors on the Keyword/EffectOp vocabulary the card tables must stay legal against -->

# Expansion 4 - Gothic Monsters: Nocturne Manor

## Theme And Visual Identity

Gothic Monsters is a candlelit horror-glamour set: vampire courts, stitched brides, wolf-cursed nobility, porcelain dolls, cathedral witches, revenant aristocrats, storm towers, grave gardens, and velvet blood rites. It should feel opulent, dangerous, and theatrical.

Visual anchors: crimson velvet, black lace, moonlit stone, stormglass, cathedral gold, candle wax, iron gates, grave roses, white lightning, and old manor interiors. All characters are adult-coded.

## Mechanic Summary

- **Dreaded** (Magic: menace; name locked in [keyword-map.md](../keyword-map.md)): "Can't be blocked except by two or more creatures." A new `Keyword` union member — block-legality (`canBlock` / block-assignment min-count) plus the AI block planner at every difficulty.
- **Empower** (Magic: kicker; name locked 2026-07-17, [keyword-map.md](../keyword-map.md)): "You may pay an additional {cost} as you cast this. If you do, [the empowered effect]." Optional-cost casting: the cast action carries an empowered flag, `validateAction` and the mana solver price the extra cost, the interpreter branches on it, and every AI difficulty must price when to pay. **The duel UI needs a new cast-time element: an Empower option offered only when the extra cost is actually payable** (user decision 2026-07-17).
- **Notation in the table:** `empower: …` ops are *added* when the extra cost was paid. On permanents the empowered ops ride the arrives trigger (an `empowered` condition). **Empowered riders are written trigger-safe (they never target)** — the base spell may target, the empower rider may not — so Empower adds no new targeting seams to the engine.
- Primary colors: B/R/W, with U mad science and G wolf/plant horror.
- Mechanical identity: evasive pressure, expensive empowered payoffs, drain-based attrition using existing primitives (`loseLife`/`gainLife`, `damage to controller`), and combat math that punishes single blockers.
- Uses the game-wide Foresee (`foresee`) and Sever (`sever`/`severGrave`) vocabulary. **Five set-unique tokens** (user decision 2026-07-17: unique tokens over cross-set reuse; five token art assets): **Bat** (B 1/1 skyborne), **Rat** (B 1/1), **Doll** (U 1/1 artifact creature, sentinel), **Grave Rose** (G 1/1 Plant, deathblade), **Revenant** (B 2/2).

_Concretion note (2026-07-17): the 2026-07-10 sketch used vocabulary the engine does not have (scry, "exile grave", activated tap abilities, self-discard rummage, copy effects, equipment, and pre-decision "menace"/"kicker" labels) plus generic multicolor rows. Every row below is now expressed in the real Keyword/EffectOp vocabulary plus the two 1.3 mechanics additions (dreaded, empower). Multicolor is reserved for named legends per the catalog invariant; generic multicolor rows were mono-colored (the Celtic Fae / Arthurian Court correction pattern)._

## Rarity Target

`40 C / 24 R / 7 SR / 5 SSR / 4 UR = 80 booster cards`

## Full Card List

| ID | Name | Rarity | Color | Type | Subject | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gm-carmilla-crimson-host | Carmilla, Crimson Host | UR | B/R | Legendary Creature | Vampire countess | skyborne, dreaded; empower: arrives loseLife opponent 3 + gainLife 3 | Boss vampire finisher |
| gm-bride-storm-crowned | The Bride, Storm-Crowned | UR | U/B | Legendary Creature | Stitched bride | deathblade; arrives: foresee 2; empower: arrives raise top | Science/grave marquee |
| gm-luna-wolf-matriarch | Luna, Wolf-Matriarch of the Moors | UR | R/G | Legendary Creature | Werewolf noble | dreaded, overrun, warcry | Aggro monster marquee |
| gm-lenore-velvet-saint | Lenore, Velvet Saint | UR | W/B | Legendary Creature | Gothic saint/revenant | bloodoath, dreaded; arrives: severGrave opponent 3 | Aristocrat control |
| gm-nocturne-manor | Nocturne Manor | SSR | B | Legendary Enchantment | Haunted estate | dawn: loseLife opponent 1 + gainLife 1; empower: arrives createToken Bat x2 | Set build-around |
| gm-victorine-lightning-heir | Victorine, Lightning Heir | SSR | U/R | Legendary Creature | Mad scientist heir | warcry; arrives: foresee 1; empower: arrives damage opponent 2 + draw 1 | Spells boss |
| gm-elizabeth-blood-mirror | Elizabeth of the Blood Mirror | SSR | B/R | Legendary Creature | Blood noble | dreaded; attacks: damage opponent 1 | Vampire aggro |
| gm-white-chapel-witch | White-Chapel Witch | SSR | W/B | Legendary Creature | Cathedral witch | bloodoath; arrives: severGrave opponent 2; empower: arrives gainLife 3 | Grave-hate control |
| gm-moon-doll-orchestra | Moon-Doll Orchestra | SSR | U | Artifact Creature | Haunted dolls | sentinel; arrives: foresee 2; empower: arrives createToken Doll x2 | Artifact value |
| gm-dracula-ball-invite | Invitation to the Crimson Ball | SR | B | Ritual | Vampire ball | loseLife opponent 2 + gainLife 2; empower: loseLife opponent 2 + gainLife 2 | Big drain spell |
| gm-grave-rose-garden | Grave-Rose Garden | SR | G | Enchantment | Haunted garden | dawn: createToken Grave Rose + gainLife 1 | Token attrition |
| gm-stormtower-resurrection | Stormtower Resurrection | SR | B | Ritual | Lightning revival | raise target; empower: draw 2 | Grave payoff |
| gm-silver-bullet-duelist | Silver-Bullet Duelist | SR | W | Creature | Monster hunter | firstBlade; empower: arrives damage opponent 2 | Hunter archetype |
| gm-porcelain-queen | Porcelain Queen | SR | U/W | Legendary Artifact Creature | Doll queen | sentinel; dawn: foresee 1 | Artifact legend |
| gm-black-veil-matron | Black-Veil Matron | SR | B | Creature | Widow vampire | skyborne, dreaded | Premium evasive |
| gm-cathedral-of-bats | Cathedral of Bats | SR | B | Enchantment | Bat cathedral | dawn: createToken Bat | Vampire support |
| gm-ravenloft-heiress | Ravenloft Heiress | R | B | Creature | Vampire heir | skyborne; empower: arrives loseLife opponent 2 + gainLife 2 | Evasive rare |
| gm-moonlit-werewolf | Moonlit Werewolf | R | R | Creature | Werewolf | dreaded, overrun | Monster pressure |
| gm-stitchwork-guardian | Stitchwork Guardian | R | U | Artifact Creature | Construct | bulwark; empower: arrives draw 1 | Control body |
| gm-candelabra-of-souls | Candelabra of Souls | R | C | Artifact | Haunted candelabra | manaAbility (any color); arrives: foresee 1 | Utility relic |
| gm-velvet-coffin | Velvet Coffin | R | B | Artifact | Vampire coffin | arrives: severGrave opponent 3 + gainLife 2 | Grave hate |
| gm-blood-opera-soloist | Blood-Opera Soloist | R | B | Creature | Vampire performer | dreaded, bloodoath | Aggro lifegain |
| gm-graveyard-waltz | Graveyard Waltz | R | B | Ritual | Corpse dance | createToken Revenant x2; empower: raise top | Token/grave spell |
| gm-wolfsbane-ward | Wolfsbane Ward | R | W | Enchantment - Aura | Monster ward | attached: -2/-2 | White removal |
| gm-thunder-lab-assistant | Thunder-Lab Assistant | R | U | Creature | Lab assistant | arrives: foresee 2; empower: arrives draw 1 | Blue support |
| gm-iron-gate-sentinel | Iron-Gate Sentinel | R | W | Artifact Creature | Manor gate | bulwark (high defense) | Defensive rare |
| gm-batcloak-cutthroat | Batcloak Cutthroat | R | B | Creature | Vampire assassin | skyborne, deathblade | Removal body |
| gm-madame-macabre | Madame Macabre | R | B | Creature | Funeral hostess | bloodoath; dies: loseLife opponent 1 + gainLife 1 | Aristocrat support |
| gm-howling-gallery | Howling Gallery | R | R | Enchantment | Haunted portrait hall | static: your Wolves +1/+0 and dreaded | Wolf anthem |
| gm-glasshouse-monster | Glasshouse Monster | R | G | Creature | Plant horror | overrun; empower: arrives addCounters self 2 | Green threat |
| gm-lightning-rod-spire | Lightning-Rod Spire | R | U | Artifact | Storm rod | dawn: damage opponent 1 + foresee 1 | Spells support |
| gm-black-lace-pact | Black-Lace Pact | R | B | Ritual | Vampire bargain | draw 2, damage controller 2; empower: loseLife opponent 2 + gainLife 2 | Card draw |
| gm-chapel-exorcist | Chapel Exorcist | R | W | Creature | Monster hunter nun | bloodoath; arrives: severGrave opponent 2 | White hatebear |
| gm-widow-of-the-west-wing | Widow of the West Wing | R | B | Creature | Ghost widow | skyborne, dreaded | Evasive threat |
| gm-midnight-autopsy | Midnight Autopsy | R | B | Ritual | Lab autopsy | grind self 2, draw 2; empower: raise top | Value spell |
| gm-stormglass-golem | Stormglass Golem | R | C | Artifact Creature | Glass golem | firstBlade; empower: arrives addCounters self 2 | Artifact beater |
| gm-red-moon-rampage | Red-Moon Rampage | R | R | Charm | Werewolf outbreak | boost allYours +2/+0 with overrun | Combat trick |
| gm-choir-of-the-dead | Choir of the Dead | R | W | Creature | Cathedral ghosts | skyborne, bloodoath | Lifegain flier |
| gm-silvered-rapier | Silvered Rapier | R | C | Artifact | Hunter weapon | static: your Hunters +1/+0 and firstBlade | Hunter support |
| gm-stormtower-roof | Stormtower Roof | R | Land | Land | Lab tower | entersTapped, manaAbility U/B | Dual land |
| gm-moonmoor-estate | Moonmoor Estate | C | Land | Land | Werewolf manor | entersTapped, manaAbility R/G | Dual land |
| gm-manor-thrall | Manor Thrall | C | B | Creature | Vampire servant | dreaded | Black common |
| gm-bat-swarm | Bat Swarm | C | B | Creature | Bats | skyborne | Evasive common |
| gm-wolfbitten-hunter | Wolfbitten Hunter | C | R | Creature | Cursed hunter | warcry | Red common |
| gm-lab-sparkmage | Lab Sparkmage | C | U | Creature | Lab mage | arrives: foresee 1 | Blue common |
| gm-chapel-guard | Chapel Guard | C | W | Creature | Cathedral guard | sentinel | White common |
| gm-grave-gardener | Grave Gardener | C | G | Creature | Cemetery keeper | wardingGaze | Green common |
| gm-stitched-footman | Stitched Footman | C | U | Artifact Creature | Stitchwork guard | bulwark | Control common |
| gm-blood-drop-initiate | Blood-Drop Initiate | C | B | Creature | Vampire novice | bloodoath | Lifegain common |
| gm-candlelit-seance | Candlelit Seance | C | B | Ritual | Seance | grind self 2, draw 1 | Grave setup |
| gm-kicked-door | Kicked Door | C | R | Ritual | Manor raid | damage target 2; empower: damage opponent 2 | Empower common |
| gm-silver-knife | Silver Knife | C | W | Charm | Hunter trick | boost target +1/+1 with firstBlade | Combat trick |
| gm-fogged-window | Fogged Window | C | U | Charm | Gothic fog | tap target, foresee 1 | Tempo trick |
| gm-rose-thorn-snare | Rose-Thorn Snare | C | G | Charm | Grave rose trap | boost target +1/+2 with deathblade | Green trick |
| gm-haunted-doll | Haunted Doll | C | C | Artifact Creature | Doll | sentinel | Artifact common |
| gm-crow-on-gate | Crow on the Gate | C | B | Creature | Omen crow | skyborne; arrives: foresee 1 | Setup flyer |
| gm-catacomb-ratcatcher | Catacomb Ratcatcher | C | B | Creature | Catacomb worker | arrives: createToken Rat | Token common |
| gm-waxwork-double | Waxwork Double | C | U | Creature | Wax figure | arrives: foresee 2 | Blue filler |
| gm-red-curtain-cut | Red-Curtain Cut | C | R | Charm | Stage slash | damage target 2 | Red removal |
| gm-holy-water-vial | Holy Water Vial | C | W | Artifact | Hunter vial | arrives: severGrave opponent 1 + gainLife 1 | Utility |
| gm-moonlit-prowl | Moonlit Prowl | C | G | Charm | Werewolf hunt | boost target +2/+2 with dreaded | Combat trick |
| gm-cellar-door | Cellar Door | C | C | Artifact | Manor door | dawn: grind self 1 | Grave utility |
| gm-black-cat-familiar | Black Cat Familiar | C | B | Creature | Witch familiar | deathblade | Defensive common |
| gm-thunderclap | Thunderclap | C | R | Charm | Storm spell | damage target 1, foresee 1 | Spells common |
| gm-funeral-bell | Funeral Bell | C | B | Artifact | Chapel bell | arrives: gainLife 2; empower: arrives loseLife opponent 2 | Utility |
| gm-stitched-hound | Stitched Hound | C | B | Creature | Reanimated hound | dreaded | Aggro common |
| gm-broken-mirror | Broken Mirror | C | U | Artifact | Haunted mirror | arrives: foresee 2 | Selection |
| gm-raven-courier | Raven Courier | C | U | Creature | Gothic raven | skyborne | Evasive common |
| gm-wolfbane-shot | Wolfsbane Shot | C | W | Charm | Hunter shot | sever target creature | White removal |
| gm-blood-candle | Blood Candle | C | B | Enchantment | Ritual candle | dawn: damage controller 1 + draw 1 | Black value |
| gm-moor-path | Moor Path | C | Land | Land | Foggy road | entersTapped, manaAbility B | Common land |
| gm-chapel-yard | Chapel Yard | C | Land | Land | Grave chapel | entersTapped, manaAbility W | Common land |
| gm-lab-annex | Lab Annex | C | Land | Land | Storm lab | entersTapped, manaAbility U | Common land |
| gm-red-roof-village | Red-Roof Village | C | Land | Land | Gothic village | entersTapped, manaAbility R | Common land |
| gm-thorned-cemetery | Thorned Cemetery | C | Land | Land | Grave garden | entersTapped, manaAbility G | Common land |
| gm-midnight-bite | Midnight Bite | C | B | Charm | Vampire bite | damage target 2, gainLife 2 | Black removal |
| gm-tattered-invitation | Tattered Invitation | C | B | Ritual | Ball invite | discardRandom opponent 1; empower: damage opponent 2 | Disruption |
| gm-lantern-patrol | Lantern Patrol | C | W | Creature | Hunter patrol | firstBlade | Hunter filler |
| gm-screaming-staircase | Screaming Staircase | C | U | Artifact Creature | Haunted stairs | bulwark (high defense) | Blue defense |
| gm-grave-soil-giant | Grave-Soil Giant | C | G | Creature | Earth horror | overrun | Green top common |

_Changed from the original sketch (2026-07-17 concretion): (1) mono-colored 18 generic multicolor rows (dracula-ball-invite B, grave-rose-garden G, stormtower-resurrection B, silver-bullet-duelist W, moonlit-werewolf R, stitchwork-guardian U, blood-opera-soloist B, madame-macabre B, lightning-rod-spire U, red-moon-rampage R, choir-of-the-dead W, thunderclap R, stitched-footman U, moonlit-prowl G, funeral-bell B, tattered-invitation B, raven-courier U, midnight-autopsy B), per the multicolor-implies-legendary catalog invariant (dual lands are exempt); (2) scry → foresee and "exile grave" → severGrave throughout; targeted battlefield exile is sever (Wolfsbane Shot); (3) menace → dreaded and kicker → empower per the locked keyword-map names, with empowered riders written trigger-safe (an empowered permanent's rider joins its arrives trigger; no empower-only targets); (4) activated tap abilities re-expressed: Candelabra of Souls is a manaAbility mana rock (five-color, per the base-set precedent) with an arrives foresee, Cellar Door grinds at dawn; (5) Iron-Gate Sentinel's bulwark+sentinel contradiction (cannot attack + attacking does not tap) resolved to bulwark; (6) Screaming Staircase retyped Artifact Creature — a recurring "tap an attacker" enchantment has no trigger-safe expression; (7) Wolfsbane Ward's exile-on-death rider dropped (attached -2/-2, the Wounded Oath pattern); (8) Waxwork Double's copy-stat mimic and Broken Mirror's draw-discard dropped (no copy or self-discard ops) — both are foresee selection now; (9) drain rows use loseLife opponent + gainLife, self-pain uses damage to controller; (10) token plan (user decision 2026-07-17, set-unique tokens): Bat (Cathedral of Bats, Nocturne Manor), Rat (Catacomb Ratcatcher), Doll (Moon-Doll Orchestra's empowered arrival), Grave Rose (Grave-Rose Garden; the token itself carries deathblade), Revenant (Graveyard Waltz); (11) duplicate-fix diffs: Lantern Patrol is a firstBlade Hunter (Chapel Guard keeps sentinel), Thunderclap is damage 1 + foresee 1 (Red-Curtain Cut keeps damage 2), Candlelit Seance draws 1 where Midnight Autopsy draws 2, Choir of the Dead's role renamed Lifegain flier (no token-payoff mechanic exists); (12) Hunter tribal rows (Silver-Bullet Duelist, Wolfbitten Hunter, Chapel Exorcist, Lantern Patrol) carry the Hunter subtype for Silvered Rapier's static; (13) Kicked Door's empower rider re-aimed at the opponent's face (a targeted rider would violate the trigger-safe empower rule; caught in implementation 2026-07-17)._

## Precon Identity

**Bloodmoon Masquerade** - B/R pressure deck. The deck uses dreaded attackers, evasive vampires, damage spells, and empowered late-game drains.

## Gauntlet Boss Concepts

The tower grows to 16 rungs; Gothic Monsters supplies the new summit pair (the Morgan/Artoria pattern: pressure below, control on top). Pairing approved by the user 2026-07-17.

- **Carmilla, Crimson Host** - B/R vampire dreaded boss with lifedrain and heavy combat pressure. Planned rung 15.
- **The Bride, Storm-Crowned** - U/B stitchwork control boss with empowered spells, reanimation, and artifact creatures. Planned rung 16.

## Art-Bible Follow-Up Notes

- Gothic glamour should be luxurious, not grimy: velvet, lace, polished coffin wood, candlelight, and storm reflections.
- No readable labels on invitations, books, gravestones, lab diagrams, sheet music, or chapel banners.
- Dreaded cards should read as hard to block: multiple silhouettes, aggressive angles, or crowded battlefield compositions.
- Five new token art assets (Bat, Rat, Doll, Grave Rose, Revenant) are the only planned generations for the set besides the 80 card raws and audit-failed regens.
