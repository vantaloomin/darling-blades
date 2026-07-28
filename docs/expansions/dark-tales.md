<!-- source-of-truth: src/engine/types.ts · last-verified: 2026-07-10 · concept doc — future expansion, not implemented (planned src/data/cards/dark-tales.ts); anti-rot anchors on the Keyword/EffectOp vocabulary the card tables must stay legal against -->

# Expansion 5 - Dark Tales: The Cursed Storybook

## Theme And Visual Identity

Dark Tales is a parody fairy-tale set inspired by princess-adjacent archetypes without using protected names in card names. It turns glass slippers, thorn castles, sea bargains, poisoned mirrors, tower braids, winter courts, beastly manors, lantern festivals, clockwork midnight, desert rooftops, ice palaces, bayou jazz, ocean wayfinding, and warrior ballads into adult gothic glamour.

Visual anchors: moonlit castles, storybook frames with no readable text, black roses, pearl foam, poisoned apples, glass, satin gowns, thorn halos, gilded cages, candlelit libraries, and midnight blue magic. All characters are adult-coded.

## Mechanic Summary

- **Skim** (Magic: cycling; name locked 2026-07-23, [keyword-map.md](../keyword-map.md)): "{cost}, discard this card: draw a card." A hand-side discard-to-draw usable on any card type: early smoothing that also fills the graveyard for Retell. Engine spec: [plan-1.4-pillar0.md](../plan-1.4-pillar0.md).
- **Retell** (Magic: flashback; name locked 2026-07-23, [keyword-map.md](../keyword-map.md)): "You may cast this from your graveyard for {cost}. Then sever it." Rituals and Charms only; an alternative cost, never on X-cost cards, and never combined with Empower on one card (this set carries no Empower rows).
- **Notation in the table:** `Skim {cost}` and `Retell {cost}` are card-level blocks; costs and stats are decided at implementation, not in this table. Skimming is not casting: nothing triggers on it, and no "when you Skim" payoff exists. The payoff is the graveyard it fills and the card it draws.
- Primary colors: U/B/W, with R rebellious heroines and G cursed forests.
- Mechanical identity: value-control, Retell spell recursion from the graveyard, Skim hand smoothing, self-grind graveyard setup, and long-game inevitability.
- Uses the game-wide Foresee (`foresee`), Sever (`sever`/`severGrave`), and grind vocabulary. **Four set-unique tokens (proposed, pending user approval):** **Shadow Miner** (B 1/1), **Firefly** (G 1/1 skyborne), **Masked Guest** (W 1/1), **Hearth Spirit** (W 1/1 sentinel).
- Scale identity: 120 booster cards, positioned as the biggest Darling Blades expansion to date.

_Concretion note (2026-07-23): the 2026-07-10 sketch used vocabulary the engine does not have (scry, exile, menace, mill, generic "cycling"/"flashback" labels, activated tap abilities, tap-all, unblockable, cost reducers, "cycling payoff" triggers, modal choices) plus generic multicolor rows. Every row below is now expressed in the real Keyword/EffectOp vocabulary plus the two 1.4 mechanics additions (Skim, Retell). Specific changes: (1) mono-colored 34 generic multicolor rows per the multicolor-implies-legendary catalog invariant (dual lands exempt; full list in the tables, old color noted in the report that accompanied this rewrite): sleeping-curse B, sea-witch-contract B, rose-cage-ballad B, tower-braid-escape U, ash-maiden R, thorn-castle-warden G, fairy-godmother-noir U, beast-library U, seven-shadow-miners B, seafoam-dagger B, briar-rose-lullaby U, wolf-at-the-door R, glass-stair-duelist W, undersea-bargain U, clock-strikes-twelve R, lamp-lit-balcony R, sandstorm-carpet-rider R, ice-palace-architect U, honor-blade-captain W, bayou-masquerade B, frog-prince-bargain U, verdant-heart-voyage G, wave-skiff-runner U, wind-painted-scout G, dragon-gem-guardian R, princess-of-thorns G, cursed-rose B, silver-fishbone B, dream-prick U, palace-masquerade W, ancestor-smoke W, lagoon-current U, plaid-arrow G, mirror-hall-illusion U (already mono, listed for the audit trail); (2) scry became foresee, exile became sever/severGrave, menace became dreaded, mill/grind-self became grind, cycling became Skim {cost}, flashback became Retell {cost}, and Retell appears only on Rituals and Charms; (3) "flashback" on permanents re-expressed as Skim or real grave synergy: Mirror-Apple Curse and Cursed Rose carry Skim, Thirteenth Spindle and Ice-Palace Architect self-grind, Glass-Coffin Queen raises from the grave and grinds, Rose-Cage Ballad drains at dawn, Beast's Library foresees at dawn; (4) "cycling payoff" and "flashback cost reducer" triggers have no engine support (Skim is not a cast and no cost-modification seam exists): Abyssal Songstress and Desert-Wish Princess re-expressed as value engines, Storybook of Ashes flagged for decision; (5) activated tap abilities, "tap all", and targeted arrival triggers re-expressed per the trigger law (triggers never target): Apple of Endless Sleep retyped Ritual (targeted sever), Gilded Cage retyped Enchantment - Aura (the prison is an attached bulwark debuff), The Sleeping Curse flagged for decision, bare "tap" dropped from creature and artifact arrival lines in favor of foresee/preventCombat; (6) "unblockable" became dreaded (Pearl-Foam Diver, Wave-Skiff Runner) and Glass Slipper at Midnight's grant is an arrival team boost with dreaded; (7) Forked-Road Choice's modal note became fetchLand plus foresee; (8) token plan (proposed, mirroring the Gothic Monsters set-unique precedent): Shadow Miner (Seven Shadow Miners), Firefly (Bayou Masquerade, Bayou-Star Proprietor), Masked Guest (Palace Masquerade), Hearth Spirit (Casita Miracle Keeper, Casita Door Charm); (9) Mermaid subtype rows (Abyssal Songstress, Pearl-Foam Diver, Foam-Silk Siren, Seafoam Messenger) back Seafoam Dagger's tribal static; (10) type changes: Apple of Endless Sleep Artifact to Ritual, Gilded Cage Artifact to Enchantment - Aura; (11) Warrior-Ballad Captain's "flashback anthem" is a plain static anthem (your other creatures +1/+0); (12) Thorn-Palace Heiress's "Quest-like awakening" is the shipped awakening block plus a dawn self-awaken (the sleeper wakes on her own at dawn); (13) two ⚠ NEEDS-DECISION rows below await the user before card data is built._

## Rarity Target

`60 C / 36 R / 11 SR / 8 SSR / 5 UR = 120 booster cards`

## Full Card List

The **Princess Adjacent** column is the intended parody/fairytale analogue for art QA; use it to check silhouette, motifs, props, and palette. Card names remain original/parody names, while this column may directly name the intended comparison point for internal art review.

The list is rarity-banded for counting and implementation planning. The original 80-card classic-fairytale core is preserved; the 40-card expansion wave adds modern-princess adjacents.

### UR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-glass-coffin-queen | Glass-Coffin Queen | UR | W/B | Legendary Creature | Snow-white adjacent queen/princess | Snow White | bloodoath; arrives: raise top; dawn: grind self 1 | Boss legend, value finisher |
| dt-abyssal-songstress | Abyssal Songstress | UR | U/B | Legendary Creature | Mermaid bargain singer | Little Mermaid | skyborne; dawn: foresee 1 + loseLife opponent 1 | Control boss |
| dt-thorn-palace-heiress | Thorn-Palace Heiress | UR | G/W | Legendary Creature | Sleeping thorn princess | Sleeping Beauty | sentinel; awakening (stats + keywords); dawn: awaken self | Midrange marquee |
| dt-midnight-glass-runner | Midnight Glass Runner | UR | U/R | Legendary Creature | Cinderella adjacent escapee | Cinderella | warcry; Skim {cost}; arrives: foresee 2 | Tempo marquee |
| dt-ice-crown-sovereign | Ice-Crown Sovereign | UR | U/W | Legendary Creature | Winter queen with storm-glass coronation magic | Elsa / Frozen Queen | skyborne; arrives: preventCombat; dawn: foresee 1 | Modern control marquee, frost-lock finisher |

### SSR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-poison-mirror-regent | Poison-Mirror Regent | SSR | B | Legendary Creature | Evil queen adjacent | Snow White / Evil Queen | deathblade, untouchable; dawn: loseLife opponent 1 + gainLife 1 | Villain control |
| dt-lantern-tower-witch | Lantern-Tower Witch | SSR | U/R | Legendary Creature | Tower-haired mage | Rapunzel | Skim {cost}; arrives: damage opponent 2 + draw 1 | Spells legend |
| dt-beast-manor-belle | Belle of the Beast Manor | SSR | W/G | Legendary Creature | Beauty-and-beast adjacent scholar | Belle / Beauty and the Beast | bloodoath; arrives: grind self 2 + draw 1 | Value legend |
| dt-sleeping-curse | The Sleeping Curse | SSR | B | Ritual | Sleep spell | Sleeping Beauty | massDestroy allCreatures; Retell {cost} with override ops: preventCombat (USER-DECIDED 2026-07-23 dual-mode: the first telling fells the court, the retelling is a fading lull; was "tap all, flashback"; color was U/B) | Control sweeper |
| dt-storybook-of-ashes | Storybook of Ashes | SSR | C | Legendary Artifact | Cursed book | Set-wide cursed storybook | ⚠ NEEDS-DECISION: (a) dawn: grind self 1 + draw 1 or (b) Skim {cost}; dawn: foresee 2 (was "cycling payoff, flashback cost reducer"; neither has engine support) | Set engine |
| dt-desert-wish-princess | Desert-Wish Princess | SSR | W/R | Legendary Creature | Desert palace rebel and balcony escapee | Jasmine | skyborne, warcry; arrives: foresee 2 | Modern tempo legend, evasive attacks |
| dt-warrior-ballad-captain | Warrior-Ballad Captain | SSR | W/R | Legendary Creature | Disguised warrior heroine with ancestral steel | Mulan | firstBlade, sentinel; static: your other creatures +1/+0 | Combat legend, go-wide payoff |
| dt-bayou-star-proprietor | Bayou-Star Proprietor | SSR | W/G | Legendary Creature | Jazz-age bayou restaurateur princess | Tiana | bloodoath; arrives: createToken Firefly x2; Skim {cost} | Lifegain-token legend |

### SR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-sea-witch-contract | Sea-Witch Contract | SR | B | Ritual | Sea bargain | Little Mermaid / Sea Witch | draw 2, damage controller 2; Retell {cost} | Premium value |
| dt-glass-slipper-at-midnight | Glass Slipper at Midnight | SR | U | Artifact | Slipper relic | Cinderella | Skim {cost}; arrives: boost allYours +1/+0 with dreaded (until end of turn) | Tempo relic |
| dt-red-hood-wolfslayer | Red Hood Wolfslayer | SR | R/G | Legendary Creature | Red riding hood adjacent | Red Riding Hood | firstBlade, overrun | Aggro legend |
| dt-rose-cage-ballad | Rose-Cage Ballad | SR | B | Enchantment | Beauty curse | Belle / Beauty and the Beast | dawn: loseLife opponent 1 + gainLife 1 | Value engine |
| dt-tower-braid-escape | Tower-Braid Escape | SR | U | Charm | Tower escape | Rapunzel | recall target; Retell {cost} | Flexible tempo |
| dt-apple-of-endless-sleep | Apple of Endless Sleep | SR | B | Ritual | Poison apple | Snow White | sever target creature; Skim {cost} (retyped from Artifact; targeted removal has no trigger-safe artifact expression) | Removal relic |
| dt-winter-palace-duchess | Winter-Palace Duchess | SR | U/W | Legendary Creature | Snow queen adjacent | Snow Queen | untouchable; dawn: foresee 1 | Control threat |
| dt-ocean-wayfinder | Ocean Wayfinder | SR | U/G | Legendary Creature | Voyager princess reading stars and tides | Moana | arrives: fetchLand + foresee 1; Skim {cost} | Modern exploration legend |
| dt-forest-colors-diplomat | Forest-Colors Diplomat | SR | G/W | Legendary Creature | Riverland diplomat with wind and leaf motifs | Pocahontas | sentinel; arrives: foresee 2 + gainLife 2 | Selesnya value bridge |
| dt-brave-highland-archer | Brave Highland Archer | SR | R/G | Legendary Creature | Highland archer princess with tournament defiance | Merida | wardingGaze, firstBlade; Skim {cost} | Gruul combat legend |
| dt-casita-miracle-keeper | Casita Miracle Keeper | SR | W/G | Legendary Creature | Enchanted-house family heroine | Mirabel | arrives: createToken Hearth Spirit; dawn: foresee 1 | Token-value legend |

### R

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-ash-maiden | Ash Maiden | R | R | Creature | Cinder heroine | Cinderella | warcry; Skim {cost} | Tempo body |
| dt-pearl-foam-diver | Pearl-Foam Diver | R | U | Creature | Mermaid scout | Little Mermaid | dreaded; Skim {cost} | Evasive pressure |
| dt-thorn-castle-warden | Thorn-Castle Warden | R | G | Creature | Briar guard | Sleeping Beauty | bulwark, wardingGaze | Defensive rare |
| dt-mirror-apple-curse | Mirror-Apple Curse | R | B | Enchantment Aura | Poison mirror | Snow White / Evil Queen | attached: -2/-2; Skim {cost} | Black removal |
| dt-midnight-coach | Midnight Coach | R | C | Artifact | Pumpkin coach | Cinderella | Skim {cost}; arrives: boost allYours +1/+0 with warcry (until end of turn) | Tempo support |
| dt-fairy-godmother-noir | Noir Godmother | R | U | Creature | Fairy godmother adjacent | Cinderella / Fairy Godmother | arrives: foresee 1 + draw 1 | Support creature |
| dt-beast-library | Beast's Library | R | U | Enchantment | Enchanted library | Belle / Beauty and the Beast | dawn: foresee 1 | Value engine |
| dt-seven-shadow-miners | Seven Shadow Miners | R | B | Creature | Dwarf/miner adjacent | Snow White / Seven Dwarfs | arrives: createToken Shadow Miner x2 + grind self 2 | Token grave support |
| dt-seafoam-dagger | Seafoam Dagger | R | B | Artifact | Sea witch weapon | Little Mermaid / Sea Witch | static: your Mermaids +1/+0 and deathblade | Evasive support |
| dt-briar-rose-lullaby | Briar-Rose Lullaby | R | U | Charm | Sleep song | Sleeping Beauty | tap target, foresee 1; Retell {cost} | Control spell |
| dt-wolf-at-the-door | Wolf at the Door | R | R | Creature | Big bad wolf adjacent | Red Riding Hood | dreaded, warcry | Aggro threat |
| dt-cursed-ball-invite | Cursed Ball Invite | R | B | Ritual | Midnight invitation | Cinderella | discardRandom opponent 1; Retell {cost} | Disruption |
| dt-glass-stair-duelist | Glass-Stair Duelist | R | W | Creature | Ballroom duelist | Cinderella | firstBlade; Skim {cost} | Combat rare |
| dt-undersea-bargain | Undersea Bargain | R | U | Ritual | Sea contract | Little Mermaid | draw 2; Skim {cost} | Card selection |
| dt-thirteenth-spindle | Thirteenth Spindle | R | B | Artifact | Spindle curse | Sleeping Beauty | dawn: damage opponent 1 + grind self 1 | Control relic |
| dt-mirror-hall-illusion | Mirror-Hall Illusion | R | U | Charm | Mirror trick | Snow White / Evil Queen | recall target, foresee 1; Skim {cost} | Tempo interaction |
| dt-gilded-cage | Gilded Cage | R | W | Enchantment - Aura | Palace prison | Rapunzel | attached: -2/-0 and bulwark (retyped from Artifact; the prison is an attached debuff) | White removal |
| dt-rose-petal-knight | Rose-Petal Knight | R | W | Creature | Palace knight | Belle / Beauty and the Beast | sentinel, bloodoath | White midrange |
| dt-clock-strikes-twelve | Clock Strikes Twelve | R | R | Ritual | Midnight clock | Cinderella | damage target 2; Retell {cost} | Spells payoff |
| dt-ash-ballroom | Ash Ballroom | R | Land | Land | Midnight ballroom | Cinderella | entersTapped, manaAbility U/R | Dual land |
| dt-haunted-storybook | Haunted Storybook | R | C | Artifact | Cursed book | Set-wide cursed storybook | Skim {cost}; arrives: foresee 1 + draw 1 | Value relic |
| dt-princess-of-thorns | Princess of Thorns | R | G | Creature | Thorn heroine | Sleeping Beauty | sentinel, wardingGaze | Midrange body |
| dt-black-glass-raven | Black-Glass Raven | R | B | Creature | Mirror raven | Snow White / Evil Queen | skyborne; Skim {cost} | Evasive rare |
| dt-foam-silk-siren | Foam-Silk Siren | R | U | Creature | Mermaid noble | Little Mermaid | skyborne; arrives: foresee 1 | Control rare |
| dt-lamp-lit-balcony | Lamp-Lit Balcony | R | R | Enchantment | Moonlit palace terrace and wish magic | Jasmine | Skim {cost}; dawn: damage opponent 1 + foresee 1 | Spells payoff, desert romance setting |
| dt-sandstorm-carpet-rider | Sandstorm Carpet Rider | R | R | Creature | Flying carpet chase heroine | Jasmine | skyborne, warcry; Skim {cost} | Evasive tempo attacker |
| dt-ice-palace-architect | Ice-Palace Architect | R | U | Creature | Adult snowcourt mage shaping crystal stairs | Elsa / Frozen Queen | arrives: foresee 1; dawn: grind self 1 | Control support creature |
| dt-snowflake-gate | Snowflake Gate | R | U | Artifact | Frost palace doorway | Elsa / Frozen Queen | Skim {cost}; arrives: draw 1 | Control relic |
| dt-honor-blade-captain | Honor-Blade Captain | R | W | Creature | Armored heroine carrying a family sword | Mulan | firstBlade; arrives: boost allYours +1/+0 (until end of turn) | Combat rare |
| dt-reflection-pond | Reflection Pond | R | Land | Land | Moonlit training-water shrine | Mulan | entersTapped, manaAbility W/R | Rare dual land |
| dt-bayou-masquerade | Bayou Masquerade | R | B | Ritual | Shadowed carnival and jazz magic | Tiana | createToken Firefly x2; Retell {cost} | Grave-token spell |
| dt-frog-prince-bargain | Frog-Prince Bargain | R | U | Creature | Cursed amphibian noble and bargain magic | Tiana | arrives: draw 1; Skim {cost} | Value creature |
| dt-verdant-heart-voyage | Verdant-Heart Voyage | R | G | Artifact | Ocean relic blooming with island life | Moana | arrives: fetchLand; Skim {cost} | Exploration relic |
| dt-wave-skiff-runner | Wave-Skiff Runner | R | U | Creature | Outrigger sailor heroine | Moana | dreaded; Skim {cost} | Tempo/ramp bridge |
| dt-wind-painted-scout | Wind-Painted Scout | R | G | Creature | Forest scout with leaf-paint motifs | Pocahontas | sentinel; arrives: foresee 1 | Scout value body |
| dt-dragon-gem-guardian | Dragon-Gem Guardian | R | R | Creature | Gem-quest warrior princess | Raya | firstBlade, warcry | Modern aggro rare |

### C

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-spindle-prick | Spindle Prick | C | B | Charm | Curse prick | Sleeping Beauty | damage target 1, tap target | Black trick |
| dt-pumpkin-attendant | Pumpkin Attendant | C | R | Creature | Coach attendant | Cinderella | warcry | Red common |
| dt-glass-mouse | Glass Mouse | C | W | Artifact Creature | Enchanted helper | Cinderella | sentinel | White artifact common |
| dt-castle-scullery | Castle Scullery | C | W | Creature | Palace worker | Cinderella | arrives: gainLife 2 | Lifegain common |
| dt-seafoam-messenger | Seafoam Messenger | C | U | Creature | Mermaid messenger | Little Mermaid | Skim {cost} | Blue common |
| dt-briar-sentinel | Briar Sentinel | C | G | Creature | Thorn guard | Sleeping Beauty | wardingGaze | Green common |
| dt-poisoned-courtier | Poisoned Courtier | C | B | Creature | Court schemer | Snow White / Evil Queen | deathblade | Black common |
| dt-red-cloak-runner | Red-Cloak Runner | C | R | Creature | Forest runner | Red Riding Hood | warcry | Aggro common |
| dt-tower-window-seer | Tower-Window Seer | C | U | Creature | Tower seer | Rapunzel | arrives: foresee 1; Skim {cost} | Setup common |
| dt-satin-slipper | Satin Slipper | C | C | Artifact | Slipper charm | Cinderella | Skim {cost}; arrives: gainLife 1 | Utility cycler |
| dt-page-torn-free | Page Torn Free | C | U | Charm | Story page | Set-wide cursed storybook | draw 1; Retell {cost} | Cantrip |
| dt-once-more-with-magic | Once More With Magic | C | W | Charm | Repeated blessing | Cinderella / Fairy Godmother | boost target +1/+1; Retell {cost} | White trick |
| dt-wicked-step | Wicked Step | C | B | Ritual | Cruel family | Cinderella / Stepfamily | discardRandom opponent 1 | Disruption |
| dt-rose-vine-snare | Rose-Vine Snare | C | G | Charm | Thorn trap | Sleeping Beauty | boost target +2/+2 | Green trick |
| dt-candle-in-window | Candle in the Window | C | W | Enchantment | Hope charm | Belle / Beauty and the Beast | dawn: gainLife 1 | Stabilizer |
| dt-ink-black-carriage | Ink-Black Carriage | C | B | Artifact | Dark coach | Cinderella | dawn: grind self 1 | Grave setup |
| dt-sea-glass-knife | Sea-Glass Knife | C | U | Charm | Sea blade | Little Mermaid | recall target | Tempo common |
| dt-ash-sweep | Ash Sweep | C | R | Ritual | Hearth magic | Cinderella | damage target 2 | Red removal |
| dt-bookmark-charm | Bookmark Charm | C | C | Artifact | Bookmark | Set-wide cursed storybook | Skim {cost}; arrives: foresee 2 | Smoothing |
| dt-lost-in-library | Lost in the Library | C | U | Ritual | Library maze | Belle / Beauty and the Beast | foresee 2, draw 1 | Blue selection |
| dt-cursed-rose | Cursed Rose | C | B | Enchantment Aura | Rose curse | Belle / Beauty and the Beast | attached: -1/-1; Skim {cost} | Aura common |
| dt-mirror-shard | Mirror Shard | C | U | Artifact | Mirror piece | Snow White / Evil Queen | arrives: foresee 1 | Utility |
| dt-silver-fishbone | Silver Fishbone | C | B | Artifact | Sea relic | Little Mermaid | Skim {cost}; arrives: loseLife opponent 1 + gainLife 1 | Utility |
| dt-dreaming-castle | Dreaming Castle | C | Land | Land | Thorn castle | Sleeping Beauty | entersTapped, manaAbility G/W | Dual land |
| dt-tide-cavern | Tide Cavern | C | Land | Land | Sea grotto | Little Mermaid | entersTapped, manaAbility U/B | Dual land |
| dt-wolf-path | Wolf Path | C | Land | Land | Forest road | Red Riding Hood | entersTapped, manaAbility G | Common land |
| dt-palace-steps | Palace Steps | C | Land | Land | Castle approach | Cinderella | entersTapped, manaAbility W | Common land |
| dt-midnight-road | Midnight Road | C | Land | Land | Night road | Cinderella | entersTapped, manaAbility B | Common land |
| dt-sea-cave | Sea Cave | C | Land | Land | Ocean cave | Little Mermaid | entersTapped, manaAbility U | Common land |
| dt-hearth-cinders | Hearth Cinders | C | Land | Land | Hearth ruin | Cinderella | entersTapped, manaAbility R | Common land |
| dt-dream-prick | Dream Prick | C | U | Charm | Sleep curse | Sleeping Beauty | tap target, grind self 1 | Control common |
| dt-rose-petal-shield | Rose-Petal Shield | C | W | Charm | Rose ward | Belle / Beauty and the Beast | boost target +0/+2; Retell {cost} | Defensive trick |
| dt-singing-shell | Singing Shell | C | U | Artifact | Shell charm | Little Mermaid | Skim {cost}; arrives: foresee 1 | Blue utility |
| dt-forest-grandmother | Forest Grandmother | C | G | Creature | Wise forest elder | Red Riding Hood | arrives: gainLife 2 + foresee 1 | Green support |
| dt-gilded-stepmother | Gilded Stepmother | C | B | Creature | Cruel courtier | Cinderella / Stepfamily | arrives: loseLife opponent 1 + gainLife 1 | Black body |
| dt-palace-masquerade | Palace Masquerade | C | W | Ritual | Masked ball | Cinderella | createToken Masked Guest x2, foresee 1 | Token/value |
| dt-ragged-ballgown | Ragged Ballgown | C | C | Artifact | Gown relic | Cinderella | Skim {cost}; arrives: gainLife 2 | Smoothing |
| dt-forked-road-choice | Forked-Road Choice | C | G | Ritual | Fairy-tale choice | Red Riding Hood | fetchLand, foresee 1 | Ramp common |
| dt-lullaby-refrain | Lullaby Refrain | C | U | Charm | Repeated song | Sleeping Beauty | tap target; Retell {cost} | Control trick |
| dt-apple-basket | Apple Basket | C | G | Artifact | Apple basket | Snow White | Skim {cost}; arrives: gainLife 2 | Green utility |
| dt-ice-lace-gloves | Ice-Lace Gloves | C | C | Artifact | Frost gloves | Elsa / Frozen Queen | Skim {cost}; arrives: preventCombat | Utility frost cycler |
| dt-snowcourt-attendant | Snowcourt Attendant | C | U | Creature | Adult winter court attendant | Elsa / Frozen Queen | arrives: foresee 1 | Blue setup common |
| dt-winter-bridge | Winter Bridge | C | Land | Land | Frozen bridge to a palace gate | Elsa / Frozen Queen | entersTapped, manaAbility U | Common land |
| dt-palace-market-chase | Palace-Market Chase | C | R | Ritual | Desert market escape | Jasmine | damage target 2; Skim {cost} | Red removal/smoothing |
| dt-brass-lamp-charm | Brass Lamp Charm | C | C | Artifact | Polished magic lamp | Jasmine | Skim {cost}; arrives: foresee 1 | Colorless smoothing |
| dt-desert-rooftop | Desert Rooftop | C | Land | Land | Palace city rooftop | Jasmine | entersTapped, manaAbility R | Common land |
| dt-reflection-sword | Reflection Sword | C | W | Artifact | Family blade reflected in water | Mulan | arrives: boost allYours +1/+0 with firstBlade (until end of turn) | Combat relic |
| dt-training-yard-dawn | Training-Yard Dawn | C | W | Charm | Martial training yard | Mulan | boost target +1/+1, foresee 1 | White combat trick |
| dt-ancestor-smoke | Ancestor's Smoke | C | W | Charm | Ancestral spirit smoke | Mulan | foresee 2; Retell {cost} | Hybrid support trick |
| dt-bayou-lantern | Bayou Lantern | C | G | Artifact | Firefly-lit bayou lamp | Tiana | Skim {cost}; dawn: gainLife 1 | Green stabilizer |
| dt-crescent-cookpot | Crescent Cookpot | C | C | Artifact | Silver kitchen charm | Tiana | arrives: gainLife 1 + foresee 1 | Utility artifact |
| dt-riverboat-kitchen | Riverboat Kitchen | C | Land | Land | Bayou riverboat galley | Tiana | entersTapped, manaAbility G/B | Common dual land |
| dt-wayfinder-oar | Wayfinder Oar | C | U | Artifact | Star-map canoe oar | Moana | Skim {cost}; arrives: foresee 2 | Blue smoothing |
| dt-lagoon-current | Lagoon Current | C | U | Charm | Tidal push around a reef | Moana | recall target, foresee 1 | Flexible tempo trick |
| dt-oceanic-islet | Oceanic Islet | C | Land | Land | Reef island passage | Moana | entersTapped, manaAbility U/G | Common dual land |
| dt-windblown-leaf-paint | Windblown Leaf-Paint | C | G | Ritual | Painted leaves carried by wind | Pocahontas | foresee 2, gainLife 2 | Green selection |
| dt-riverbend-trail | Riverbend Trail | C | Land | Land | Forest river bend | Pocahontas | entersTapped, manaAbility G | Common land |
| dt-plaid-arrow | Plaid Arrow | C | G | Charm | Highland tournament shot | Merida | boost target +1/+1 with wardingGaze | Combat trick |
| dt-casita-door-charm | Casita Door Charm | C | W | Artifact | Enchanted house door token | Mirabel | arrives: createToken Hearth Spirit + foresee 1 | Token setup |
| dt-jade-dragon-scale | Jade Dragon Egg | C | G | Artifact | Sleeping jade dragon egg (retitled from scale 2026-07-23, art-led) | Raya | Skim {cost}; arrives: foresee 1 | Green utility |

## Precon Identity

**Midnight Storybook** - U/B/W value-control. The deck Skims early, fills the graveyard, and wins by Retelling efficient Rituals and Charms while stabilizing with lifegain and foresee filtering. The expanded 120-card set adds optional heroine-tempo (W/R legends), frost-control (U/W legends), token-lifegain (W/G legends), and wayfinder (U/G legends) packages without changing the precon's default identity.

## Gauntlet Boss Concepts

- **Glass-Coffin Queen** (rung 17) - W/B grind boss with Retell value, bloodoath, and poison-mirror removal.
- **Abyssal Songstress** (rung 18) - U/B tempo-control boss with Skim smoothing, foresee filtering, and sea bargain card advantage.

## Art-Bible Follow-Up Notes

- Use original parody naming and silhouettes in card names and generated prompts; the Princess Adjacent column is an internal art-QA reference.
- Modern-princess wave analogues must stay adult-coded and translated through the Dark Tales gothic palette rather than copied as exact costumes.
- Storybook pages, invitations, mirrors, and labels must be blank or decorative with no readable text.
- Keep the tone glamorous and adult, not cute or juvenile.
