<!-- source-of-truth: package.json, src/config/rules.ts, src/data/cards/*.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/scenes/, docs/design-system.md, docs/plan-design-system-alignment.md, docs/rules.md, docs/ai.md, docs/art-pipeline.md, docs/roadmap.md, docs/mobile-lan-plan.md, tests/ · last-verified: 2026-09-04
     If you change those files, update this doc or re-verify the date.
     Writing rules for this file: no em-dashes or en-dashes (use period/comma/colon/semicolon/parentheses; plain hyphens in numeric ranges), no emojis, and avoid formulaic AI prose patterns (no "X is here" openers, no anthropomorphized marketing lines, no rhetorical triads or dramatic reveal colons). Section order: What is Darling Blades, Features, the latest release notes, then everything else. -->

# Darling Blades

*A trading card game where the officers of the Three Kingdoms, the gods of Olympus, and a forest full of Beastkin all end up in the same deck.*

<p align="center">
  <img src="public/assets/art/cards/tk-shu-zhugeliang.webp" width="160" alt="Zhuge Liang">
  <img src="public/assets/art/cards/gk-zeus.webp" width="160" alt="Zeus">
  <img src="public/assets/art/cards/bk-kitsune-matriarch.webp" width="160" alt="Kitsune Matriarch">
</p>

<p align="center">
  <a href="https://vantaloomin.github.io/darling-blades/"><b>Play Darling Blades in your browser</b></a>
</p>

**Desktop:** Starting with 1.5.5, every GitHub Release includes a Windows installer.

## What is Darling Blades?

Darling Blades is a single-player trading card game in the style of Magic: the Gathering, specifically the 8th/9th/10th-edition era: five colors of mana, creatures and combat, instants and sorceries resolving off a stack, and the familiar rhythm of curving out and then racing or grinding to a win. If you played that era of Magic, you already know most of the rules.

The cast is what's different. The **1,482 collectible cards across ten sets** share characters from the officers of **Wei**, **Wu**, **Shu**, and **Jin**, the **Greek pantheon**, tribal **Beastkin**, Ragnarök's graveyard faction, Celtic Fae courts, Arthurian knights, Gothic Monsters, Dark Tales storybook figures, Cyberpunk Yokai Nights, Sands of the Duat, the living starships of Starborne, and the drowned fishing town of Drowned Deep. Every card carries finished cel-shaded gacha-anime art; nothing in the shipped game is programmer-art or a placeholder.

You play or skip a short optional tutorial, claim a free starter deck, crack booster packs to build out your collection, and assemble a 40-spell deck and its ten-land Warchest in the deck builder. Then you duel: Practice matches against any tower boss or a plain difficulty, the 22-rung **Avatar Gauntlet** (a ladder of named boss opponents, each running a themed deck, reshuffled daily), or a seat at the **Draft** table to build a fresh 25-spell deck from passed packs against seven AI rivals.

## Features

- **A 1,482-card collectible pool across ten sets.** Base Set, Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, Cyberpunk Yokai Nights, Sands of the Duat, Starborne, and Drowned Deep cover all five WUBRG colors and the same five rarity tiers. Cyberpunk Yokai Nights adds 120 cards built around Hauntlink, Sands of the Duat adds 245 built around Rite, Nine Lives, and Preserve, Starborne adds 151 built around Marks and Propagate, and Drowned Deep adds 252 built around Whispers, Tithe, and Duty; each has its own set-scoped booster. Dark Tales carries a 60-card companion wave that reprises Nine Lives, Preserve, and Empower.
- **Five starter decks**, one two-color archetype per color pair: **Crimson Muster** (Red/White aggro), **Wild Communion** (Green/White creature tribal), **Burning Tides** (Blue/Red tempo-burn), **Shadow Mandate** (Blue/Black control), and **Grave Harvest** (Black/Green deathblade attrition). Every color shows up in exactly two of the five, and each arrives as 40 spells plus its own ten-land Warchest.
- **Real MTG-style deckbuilding rules**, with one deliberate departure: your lands live in a **Warchest** rather than your deck. A constructed deck is exactly 40 spells built from your own collection plus a ten-land Warchest (at most 5 duals), up to 4 copies of any non-basic card, 20 starting life, a 5-card opening hand, a London-style mulligan with your first mulligan free, and an auto-tap mana solver so you're never manually tapping individual lands to pay generic costs.
- **Two formats.** **Warchest** is the standard constructed format above. **Darlings** is the EDH-style one: your Darling waits in her own zone while you build a 79-card singleton spell deck and a ten-land Warchest, each fall adds 2 to her next call, and paying 4 eases that tax by 2. Five ready-to-play Darlings decks are in the Shop, one of them a free one-time claim, and a dedicated tutorial teaches the format.
- **Gacha-style booster packs.** 450 gold buys 9 cards in the Base Set booster; 525 gold buys 9 in the Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, Cyberpunk Yokai Nights, Sands of the Duat, Starborne, or Drowned Deep boosters. Every slot independently rolls a rarity tier, a cosmetic frame (white/blue/red/gold/rainbow/black), a holo finish (none/shiny/rainbow/pearlescent/fractal/void), and a 0.25% Full Art chance where the illustration covers the whole card face. The rarest possible pull (Ultra Rare, black frame, void holo, Full Art) lands at roughly 1 in 1.98 billion. Each pack tile shows how many of its set's cards you already own; its info glyph opens a pool summary alongside the rarity, frame, and holo odds, which are identical across every booster.
- **Every expansion brings its own mechanics.** Ragnarök plays with double strike, mill, and reanimation; Celtic Fae introduced **Sever** (exile-flavored removal) and **Foresee** (top-of-deck smoothing); Arthurian Court added **Quests** that advance a chapter at each of your dawns and **Champion Awakening** transforms; Gothic Monsters brought **Dreaded** attackers that must be blocked by two or none and **Empower** kicker costs; Dark Tales added **Skim** (instant-speed hand smoothing) and **Retell** (recast a Ritual or Charm from the graveyard, then sever it); Yokai Nights brought **Hauntlink**; and Sands of the Duat adds **Rite** (sacrifice as an additional cost), **Nine Lives** (return once with a +1/+1 mark), and **Preserve** (token copy from the graveyard); Starborne brings **Marks** (a +1/+1 counter that spreads) and **Propagate** (another Mark on every Marked creature you control); and Drowned Deep brings **Whispers** (a card that slips into your graveyard from your hand or deck can be cast from there, for its Whispers cost, until your opponent's next Dawn) and **Tithe** (sacrifice creatures to discount a Horror), alongside **Duty**, the tap ability that 82 cards across the game now carry. Everything is engine-first and seeded-deterministic, with player-facing duel affordances.
- **The Avatar Gauntlet**: a 26-rung, 26-floor ladder of named boss opponents (Meng Huo, Hestia, Lupa the Wolfqueen, Hera, Zhurong, Sima Yi, Yohime the Kitsune Matriarch, Cao Cao, the Ragnarök bosses Hel and Brunhild, the Celtic Fae pair of The Morrigan and Titania, the Arthurian summit of Morgan of the Thorn Crown and Artoria, Once and Future Queen, the Gothic Monsters pair of Carmilla and The Bride, the Dark Tales pair of Glass-Coffin Queen and Abyssal Songstress, the Yokai Nights pair of Queen of the Lanterned Roof and Kitsune Neon Tyrant, the Sands of the Duat pair of Anubis, Who Holds the Scale and Bastet, Mistress of the Ninth Return, the Starborne pair of Chrome Broodmother and The Violet Signal Queen, and the Drowned Deep summit pair of The Drowned Deacon and The Marsh-Mother), each piloting a themed deck and personality. The roster reshuffles every day from a date seed, and the floor you reach sets the AI's strength on a six-tier ladder while the avatar brings its own deck and personality. Gold pays out per rung cleared plus a bonus for a full run. Practice mode lets you challenge any of the 26 bosses directly, or a plain difficulty, with no ladder attached.
- **Draft mode**: the eight-seat persona draft described in the release notes below, with a free tier that pays gold on your record and a Premium tier that keeps its picks.
- **Optional onboarding and long-term goals.** First launch offers a guided tutorial duel, and the Achievements screen tracks collection percentage, color completion, themed RoTK / Greek / Beastkin / Ragnarök goals, mono/dual-color tower clears, variant chase goals, mastery goals, and pack-opening milestones with claimable gold rewards.
- **Daily Blades**: three rotating daily quests with progress bars, claimable gold, and up to three rerolls a day, plus an escalating win-streak bonus paid on your first win of each calendar day. The same calendar day rolls the same quests for everyone, because the quest roll is deterministically seeded like everything else here.
- **Deck sharing, save codes, and multiple saved decks.** Keep as many constructed decks as you like (copy / rename / delete, plus a starrable per-deck hero card that fronts your in-duel portrait), and export any legal deck as a compact `DBD2-…` share code that another player can paste straight into their own Deck Builder; imports validate against their collection and the normal deckbuilding rules. The Profile page can also export your entire profile as a save code and import one on another machine, with replays optional.
- **Deterministic replays.** The game records your last ten duels (seed, decks, and every action) and replays them from the Profile reel with play, pause, step, and speed controls. A replay is a byte-exact re-simulation, not a video.
- **AI that never cheats.** Every difficulty (Easy, Medium, Hard) plays through the exact same redacted view of the game state a human opponent would see; none of them can look at your hand or either deck's remaining contents. The difficulty gap is measured rather than assumed: Medium beats Easy at least 80% of the time (measured around 82.5%) and Hard beats Medium at least 70% of the time (measured around 78%) across large seeded AI-vs-AI test batches.
- **Fully illustrated, nothing placeholder.** All 1,482 collectible cards across ten sets carry finished cel-shaded gacha-anime art, plus painted backdrops for every scene and pack art for every set. Every card image ships as WebP; the art payload is 219.69 MiB, of which 216.16 MiB is card art. Basic lands come in per-set landscape styles you choose in the deck builder. The audio side is entirely procedural: every sound effect and the four-mood generative ambient music score are synthesized live in the browser over WebAudio, with no audio asset files at all.
- **Built-in accessibility settings**: independent SFX and music toggles with volume control, an animation-level switch (full / reduced / off), a render-size selector (720p / 1080p / 1440p), and an auto-skip toggle that fast-forwards empty or forced duel phases. Every setting persists to your save.
- **Playable on your phone today.** The entire single-player loop runs comfortably by touch over your local network. Darling Blades is single-player by design: head-to-head multiplayer was explored and deliberately dropped.

## What's new in 1.8

**Drowned Deep, a 252-card expansion.** A tenth world: Dunmarrow, a fishing
town built on the spires of something older, where the tide comes up one step
a generation. The Deep speaks in the voices of the drowned, and what it offers
is real. **Whispers**: a card that slips into your graveyard from your hand
or your deck can be cast from there, for its Whispers cost, until your
opponent's next Dawn. **Tithe** lets you sacrifice your own creatures to
discount a Horror. Every card carries
finished art, and the set has its own booster, precon, and four tokens.

**Cards with a Duty.** A Duty is an ability you use by tapping the card during
your Morning or Afternoon, sometimes for mana as well: `{2}, {T}: Foresee 3.`
Eighty-two cards carry one, in Drowned Deep and in older sets alike.

**Twenty-seven unplayable lands became playable cards.** Since the Warchest
arrived, a land that was neither a basic nor a dual could not go in any deck.
Those 27 commons are now artifacts with a Duty, with the same art and the
same place in your collection. They open from packs, turn up in drafts, can be
crafted, and count toward their sets again, so four set-completion goals grew
by three to eight cards each.

**The tower climbs to 26.** The Drowned Deacon waits at rung 25, milling her
own library and casting it back from the grave, and The Marsh-Mother closes
the climb at 26. **Lanterns Below**, a blue-black Drowned Deep deck, joins the
shop.

**Opponents play the whole card now.** The AI casts every kind of spell for
what it does, knows when to pass, blocks and attacks correctly around Twin
Blades, Sentinel and First Blade, and uses Tithe, Hauntlink and Duty as they
were designed. Draft opponents read every mechanic when they pick. Forty
written-down behaviours are tested. Better opponents exposed decks that had
been winning on the other side's mistakes, so six bosses were rebuilt on
measured evidence, and every boss from rung 14 up clears her floor with a full
margin.

**Anonymous play stats, off in one tap.** The game can send short anonymous
summaries of how it is played. The first time you reach the main menu it tells
you so, with the switch right there, before anything is sent. See
[Privacy](#privacy).

**Spell art shows her face.** Spell, artifact and enchantment art is now
cropped around its subject instead of the middle of the picture. Twenty-nine
cards were reframed and four repainted.

## How to play

The main menu routes to:

| Mode | What it does |
| --- | --- |
| **Play → Avatar Gauntlet** | Climb the 26-rung, 26-floor ladder of named boss opponents, reshuffled daily with floor-scaled difficulty; clear a rung and roll straight into the next, with per-rung gold and a completion bonus. |
| **Play → Draft** | An eight-seat draft against seven named AI drafters: pick 45 cards across three passed packs, build a 40-card deck, and play three matches. Free entry pays gold on your record; Premium (1,000g, twice a week) keeps every pick. |
| **Play → Practice** | A one-off duel with no ladder attached: pick any of the 26 tower bosses (with their deck and personality) or a plain Easy / Medium / Hard opponent. |
| **Shop** | Buy a 9-card booster (Base Set, Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, Cyberpunk Yokai Nights, Sands of the Duat, or Starborne) and watch the rarity/frame/holo reveal animate slot by slot, or buy whole decks (the unpicked starters and the expansion precons) from the Decks tab, each with a full-stats preview. Every booster carries an info glyph with that set's exact drop rates. |
| **Collection** | A binder-style spread of every card you own, filterable by color / type / rarity / set / owned, showing your best-owned print of each plus pool and special-variant completion progress, with a Craft action on any card you're missing. |
| **Decks** | Pick your active deck, and build or edit your decks and Warchests from your owned collection. |
| **Achievements** | Review locked/unlocked/claimed goals and claim gold rewards for collection, variant, themed, mastery, and economy milestones. |
| **Card Showcase** | A gallery of every frame style and holo finish available on a given card. |

The main menu also hosts the **Daily Blades** quest panel and a **Profile** page with your lifetime win-rate, gauntlet stats, and the **Replays** reel: rewatch any of your last ten duels with play, pause, step, and speed controls. On first launch you can play or skip the tutorial, then claim one free starter deck from the shop and receive a starting gold grant, enough for your first booster pack. The Settings button opens the accessibility/audio options described above.

## Getting started

Node 24 LTS is the supported toolchain (`.nvmrc` carries the pin; older Node versions warn on install).

```bash
npm install
npm run dev      # Vite dev server at :5173
npm run build    # typecheck + production build
npx vitest run    # full test suite (~15 min; AI win-rate gates included)
```

On Windows you can also double-click **`run-dev.bat`** or **`run-production.bat`**; both install dependencies if missing.

## Under the hood

Darling Blades is TypeScript on Vite, rendered with Phaser 3.90 (pinned; never v4), tested with Vitest, and linted with ESLint/typescript-eslint. There's no UI framework underneath the game view; it's Phaser end to end.

The codebase is split into two halves that never touch each other's concerns. `src/engine/` is a pure, Phaser-free, deterministic rules engine: given a set of decklists, a seed, and a sequence of player actions, it produces the exact same game state and event stream on every machine, every time. State is plain JSON, so a `structuredClone` is the entire "save/replay" story, and even the RNG lives inside that state as data. A single facade validates and applies every action and emits events; the Phaser scenes (`src/scenes/`) only ever consume that event stream to animate, and hold no rules logic of their own. The AI (`src/ai/`) plays through that same engine via the identical redacted view a human sees, which is what makes the "no AI reads hidden information" guarantee structural instead of a promise in a comment.

That separation is what makes a real test suite possible: **3,817 tests (4 skipped) across 251 files**, covering engine flow/combat/keywords/mana/RNG/determinism, the stack and effects, catalog integrity, meta systems (collection, economy, save migrations, gauntlet, achievements, daily quests, Limited drafting, deck share codes, deck color identity), the variant/drop-distribution math behind the booster system, economy EV gates and named exploit regressions backed by a 10-persona progression simulator, onboarding tutorial determinism, audio recipes and music patterns, platform/gesture/render-scale behavior, and AI smoke tests plus the win-rate gates above (hundreds of full AI-vs-AI games). The whole suite finishes in about fifteen minutes on the release-prep Windows host.

For deeper dives: [docs/architecture.md](docs/architecture.md) (layers, the event/decision model, determinism), [docs/design-system.md](docs/design-system.md) (visual language, tokens, components, and interaction contracts), [docs/plan-design-system-alignment.md](docs/plan-design-system-alignment.md) (the audited implementation sequence required for full alignment), [docs/rules.md](docs/rules.md) (the full ruleset as implemented), [docs/adding-cards.md](docs/adding-cards.md) (the card schema and how new cards get built), [docs/ai.md](docs/ai.md) (how each difficulty thinks), [docs/art-pipeline.md](docs/art-pipeline.md) (the art resolution and generation pipeline), and [docs/roadmap.md](docs/roadmap.md) (current status in detail).

## Project status

**Darling Blades is 1.8.0** (tag v1.8.0). The full solo loop (menu → optional tutorial → free starter claim → Gauntlet, Draft, or Practice → daily quests and rewards → shop → pack opening → collection / achievements → deck builder) is wired end to end, all 1,482 collectible cards have finished illustrated art, the 26-rung tower is measured against win-rate floors, and the test suite is green.

**Coming next:** three more expansions through 2.0, a full accessibility pass, a mobile rebuild, deck suggestions built from your own collection, and Story Mode. Multiplayer is not planned; the game is single-player by design.

## About this project

This is a personal, single-player project built and tuned by one developer; there's no multiplayer server, by design, and no public contribution pipeline at the moment. The codebase does hold itself to a few unusual disciplines for a solo project, though: the rules engine is fully headless and seeded-deterministic, every difficulty of AI is held to a measured (not assumed) win-rate floor, and the documentation in `docs/` carries anti-rot tooling (`npm run check-docs`) that flags a doc as stale the moment the code it describes changes without it.

## Privacy

Your game lives on your device. The game sets no cookies, loads no third-party scripts, runs no ads, and never receives your save.

Starting with 1.8, the game can send anonymous play stats: short summaries of how it is played, such as which formats and colours get played and how long duels last. Every number is rounded into a broad range before it leaves your device, and no name, account, identifier, deck name, or exact collection is ever sent. The summaries cannot be linked to you, or to each other from one day to the next. It is on by default. Every player is told once, in the game, before anything is sent, and you can switch it off in Settings at any time, where the "What is sent" panel lists every field. The full policy, including the two things the game already disclosed before 1.8 (the update check asks GitHub, and GitHub Pages keeps request logs), is at [privacy.html](https://vantaloomin.github.io/darling-blades/privacy.html), generated from [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md) at every build so the two never differ.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The illustrated card and scene art (everything under `public/assets/art/`) and the desktop app icons (`src-tauri/icons/`) are **not** covered by that license; all rights to those images are reserved.
