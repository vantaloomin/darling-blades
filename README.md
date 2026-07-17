<!-- source-of-truth: package.json, src/config/rules.ts, src/data/cards/*.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/scenes/, docs/design-system.md, docs/plan-design-system-alignment.md, docs/rules.md, docs/ai.md, docs/art-pipeline.md, docs/roadmap.md, docs/mobile-lan-plan.md, tests/ · last-verified: 2026-07-16
     If you change those files, update this doc or re-verify the date.
     Writing rules for this file: no em-dashes or en-dashes (use period/comma/colon/semicolon/parentheses; plain hyphens in numeric ranges), no emojis, and avoid formulaic AI prose patterns (no "X is here" openers, no anthropomorphized marketing lines, no rhetorical triads or dramatic reveal colons). Section order: What is Darling Blades, Features, the latest release notes, then everything else. -->

# Darling Blades

*A trading card game where the officers of the Three Kingdoms, the gods of Olympus, and a forest full of Beastkin all end up in the same 60-card deck.*

<p align="center">
  <img src="public/assets/art/cards/tk-shu-zhugeliang.png" width="160" alt="Zhuge Liang">
  <img src="public/assets/art/cards/gk-zeus.png" width="160" alt="Zeus">
  <img src="public/assets/art/cards/bk-kitsune-matriarch.png" width="160" alt="Kitsune Matriarch">
</p>

<p align="center">
  <a href="https://vantaloomin.github.io/darling-blades/"><b>Play Darling Blades in your browser</b></a>
</p>

## What is Darling Blades?

Darling Blades is a single-player trading card game in the style of Magic: the Gathering, specifically the 8th/9th/10th-edition era: five colors of mana, creatures and combat, instants and sorceries resolving off a stack, and the familiar rhythm of curving out and then racing or grinding to a win. If you played that era of Magic, you already know most of the rules.

The cast is what's different. Every card in the 210-card base pool is a character drawn from three worlds sharing one card pool: the officers of **Wei**, **Wu**, **Shu**, and **Jin** from a genderbent Romance of the Three Kingdoms (plus an "Other" bench of warlords and wildcards such as Dong Zhuo and Lü Bu); the **Greek pantheon** of Olympus (Ares, Athena, Artemis, Hades, Persephone, Demeter, Hestia, and more); and tribal **Beastkin** (Wolfkin, Kitsune, Harpy, Bearkin, Rhinokin, Nekomata, Lamia, Spiderkin, Crowkin, Batkin, and others). The **Ragnarök** expansion adds a fourth world, a Norse graveyard faction of Valkyries, Norns, Jotun, Draugr, and the death-goddess Hel, worth 69 more collectible cards. The **Celtic Fae** expansion (*The Silver Veil*) adds a fifth: 80 cards of fae courts, selkies, banshees, and wild hunts, bringing the game to **349 collectible cards**. Every one of those cards carries finished cel-shaded gacha-anime art; nothing in the shipped game is programmer-art or a placeholder.

You play or skip a short optional tutorial, claim a free starter deck, crack booster packs to build out your collection, and assemble a 60-card deck in the deck builder. Then you duel: quick Practice matches at three difficulties, the 12-rung **Avatar Gauntlet** (a ladder of named boss opponents, each running a themed deck), or a seat at the **Draft** table to build a fresh 40-card deck from passed packs against seven AI rivals.

## Features

- **A 210-card, fully illustrated base pool.** 200 of those cards are booster-eligible across five rarity tiers (103 Common / 65 Rare / 13 Super Rare / 11 Super-Super Rare / 8 Ultra Rare); the other 10 are five free, unlimited basic lands and five non-collectible tokens created by card effects. All five WUBRG colors are represented across the three casts. The **Ragnarök** expansion (set `ragnarok`, `rg-` prefix, 69 cards) and the **Celtic Fae** expansion (set `celtic-fae`, `cf-` prefix, 80 cards) each add collectible cards across the same five tiers, sold through their own set-scoped boosters.
- **Five 60-card starter decks**, one two-color archetype per color pair: **Crimson Muster** (Red/White aggro), **Wild Communion** (Green/White creature tribal), **Burning Tides** (Blue/Red tempo-burn), **Shadow Mandate** (Blue/Black control), and **Grave Harvest** (Black/Green deathblade attrition). Every color shows up in exactly two of the five.
- **Real MTG-style deckbuilding rules**: 60-card minimum decks built from your own collection, up to 4 copies of any non-basic card (basics unlimited), 20 starting life, 7-card hands, a London-style mulligan with your first mulligan free, and an auto-tap mana solver so you're never manually tapping individual lands to pay generic costs.
- **Gacha-style booster packs.** 450 gold buys 9 cards in the Core Set booster; 525 gold buys 9 in the Ragnarök or Celtic Fae boosters. Every slot independently rolls a rarity tier, a cosmetic frame (white/blue/red/gold/rainbow/black), and a holo finish (none/shiny/rainbow/pearlescent/fractal/void). The rarest possible pull (Ultra Rare, black frame, void holo) lands at roughly 1 in 4.94 million.
- **The Avatar Gauntlet**: a 12-rung ladder of named boss opponents (Meng Huo, Hestia, Lupa the Wolfqueen, Hera, Zhurong, Sima Yi, Yohime the Kitsune Matriarch, Cao Cao, the Ragnarök bosses Hel and Brunhild, and the Celtic Fae summit pair of The Morrigan and Titania, Queen of the Silver Court), each piloting a themed deck and personality at rising difficulty, with gold paid out per rung cleared plus a bonus for a full run. Practice mode runs the same three difficulties with no ladder attached.
- **Draft mode**: the eight-seat persona draft described in the 1.1 release notes below, with a free tier that pays gold on your record and a Premium tier that keeps its picks.
- **Optional onboarding and long-term goals.** First launch offers a guided tutorial duel, and the Achievements screen tracks collection percentage, color completion, themed RoTK / Greek / Beastkin / Ragnarök goals, mono/dual-color tower clears, variant chase goals, mastery goals, and pack-opening milestones with claimable gold rewards.
- **Daily Blades**: three rotating daily quests with progress bars, claimable gold, and up to three rerolls a day, plus an escalating win-streak bonus paid on your first win of each calendar day. The same calendar day rolls the same quests for everyone, because the quest roll is deterministically seeded like everything else here.
- **Deck sharing and multiple saved decks.** Keep as many constructed decks as you like (copy / rename / delete, plus a starrable per-deck hero card that fronts your in-duel portrait), and export any legal deck as a compact `DBD2-…` share code that another player can paste straight into their own Deck Builder. Imports validate against their collection and the normal deckbuilding rules.
- **AI that never cheats.** Every difficulty (Easy, Medium, Hard) plays through the exact same redacted view of the game state a human opponent would see; none of them can look at your hand or either deck's remaining contents. The difficulty gap is measured rather than assumed: Medium beats Easy at least 80% of the time (measured around 82.5%) and Hard beats Medium at least 70% of the time (measured around 78%) across large seeded AI-vs-AI test batches.
- **Fully illustrated, nothing placeholder.** All 349 collectible cards across the Core Set, Ragnarök, and Celtic Fae carry finished cel-shaded gacha-anime art, plus eleven painted scene backdrops. The audio side is entirely procedural: every sound effect and the four-mood generative ambient music score are synthesized live in the browser over WebAudio, with no audio asset files at all.
- **Built-in accessibility settings**: independent SFX and music toggles with volume control, an animation-level switch (full / reduced / off), a render-size selector (720p / 1080p / 1440p), and an auto-skip toggle that fast-forwards empty or forced duel phases. Every setting persists to your save.
- **Playable on your phone today.** The entire single-player loop runs comfortably by touch over your local network. Real head-to-head LAN multiplayer is designed but not yet built; see Project status below.

## What's new in 1.1 (The Silver Veil)

Version 1.1 adds a second expansion and makes Draft a playable game mode, then spends the rest of its changelog on the economy and the shop.

**Celtic Fae: The Silver Veil (Expansion 2).** 80 new collectible cards of fae courts, selkies, banshees, and impossible bargains. It is a Blue/Black/Green tempo-control set, with White fae knights and Red wild-hunt aggression around the edges, and all of it is fully illustrated. Two new mechanics arrive with it and apply game-wide: **Sever** removes cards from the game entirely (a one-way public zone that reanimation cannot reach), and **Foresee** lets you peek at the top of your deck and decide what stays. The set ships with its own 525-gold booster, the buyable **Glimmer Bargain** precon, eight new achievements, and two new bosses at the top of the Avatar Gauntlet: **The Morrigan** at rung 11 and **Titania, Queen of the Silver Court** at rung 12.

**Draft.** The new **Play** menu adds Draft: an eight-seat table where you and seven AI drafters pass packs and pick 45 cards, then you build a 40-card deck (auto-build or hand-tune) and play three matches against the rivals seated beside you. The seven opponents come from a roster of twenty named characters, each with a distinct pick style; the roster includes rare-chasers, curve perfectionists, tribal loyalists, mono-forcers, and one drafter who picks on pure chaos. You learn who they are by drafting with them: the first draft shows a name and face, later drafts reveal their color habits and eventually their full profile.

- **Free Draft** costs nothing to enter and pays gold based on your record.
- **Premium Draft** (1,000 gold, twice per week) rolls frame and holo variants into its packs, and you keep all 45 of your picks.

**Shard-crafting.** Any card you own zero copies of can be crafted from the Collection screen for gold, at six times its shard value (30 gold for a Common, 3,000 for an Ultra Rare). If your last few missing legends refuse to show up in packs, you can now buy them outright.

**Shop deck previews.** Every precon in the shop now shows its complete card list with a mana curve, color breakdown, and composition stats, a short description of how the deck plays, its signature cards, and exactly how many new copies a purchase would add to your collection. The buy footer shows your balance and any shortfall before you commit, and tapping any row opens the full card.

**Achievements screen.** Rebuilt with filters (All / Ready / In Progress / Claimed), a summary strip, cleaner rows that always show the reward, and a one-tap Claim All.

**Glossary of Terms.** A learning-corner scene covering every keyword with its icon and reminder text, plus card types, mana symbols, and rarity tiers.

**Balance and fixes.**

- The AI now accounts for its own life loss when its cards bleed it, and it will go for lethal instead of sitting behind a full bench while it dies. Simultaneous deaths also resolve together, which fixes several token interactions on crowded boards.
- Dual-color lands read as either/or on their card faces, and the playmat gives flexible mana sources a split-pip counter.
- MTG-style set symbols replace the old rarity gem. The shape names the set; the tint names the rarity.
- The economy closed its exploit routes: a finished collector can no longer farm Premium Draft for profit, concede-farming and free-draft spam pay nothing extra, and the gold faucets were re-measured end to end. The tuning was verified in simulation across 10 player archetypes over 60 simulated days each.
- "Bloodoath" is now written **Blood Oath**, the base set is labeled **Core Set** in filters and the shop, the Collection turns pages with ←/→, and dozens of smaller copy, layout, and readability fixes landed across every scene.

## How to play

The main menu routes to:

| Mode | What it does |
| --- | --- |
| **Play → Avatar Gauntlet** | Climb the 12-rung ladder of named boss opponents; clear a rung and roll straight into the next, with per-rung gold and a completion bonus. |
| **Play → Draft** | An eight-seat draft against seven named AI drafters: pick 45 cards across three passed packs, build a 40-card deck, and play three matches. Free entry pays gold on your record; Premium (1,000g, twice a week) keeps every pick. |
| **Play → Practice (Easy / Medium / Hard)** | A one-off duel against the AI at your chosen difficulty, no ladder attached. |
| **Shop** | Buy a 9-card booster (Core Set, Ragnarök, or Celtic Fae) and watch the rarity/frame/holo reveal animate slot by slot, or buy whole decks (the unpicked starters and the expansion precons) from the Decks tab, each with a full-stats preview. |
| **Collection** | A binder-style spread of every card you own, filterable by color / type / rarity / set / owned, showing your best-owned print of each plus pool and special-variant completion progress, with a Craft action on any card you're missing. |
| **Deck Builder** | Build and edit your active 60-card deck from your owned collection. |
| **Achievements** | Review locked/unlocked/claimed goals and claim gold rewards for collection, variant, themed, mastery, and economy milestones. |
| **Card Showcase** | A gallery of every frame style × holo finish available on a given card. |

The main menu also hosts the **Daily Blades** quest panel and a read-only **Profile** page with your lifetime win-rate and gauntlet stats. On first launch you can play or skip the tutorial, then claim one free starter deck from the shop and receive a starting gold grant, enough for your first booster pack. The Settings button opens the accessibility/audio options described above.

## Getting started

```bash
npm install
npm run dev      # Vite dev server at :5173
npm run build    # typecheck + production build
npx vitest run    # full test suite (~25-30s)
```

On Windows you can also double-click **`run-dev.bat`** or **`run-production.bat`**; both install dependencies if missing.

## Under the hood

Darling Blades is TypeScript on Vite, rendered with Phaser 3.90 (pinned; never v4), tested with Vitest, and linted with ESLint/typescript-eslint. There's no UI framework underneath the game view; it's Phaser end to end.

The codebase is split into two halves that never touch each other's concerns. `src/engine/` is a pure, Phaser-free, deterministic rules engine: given a set of decklists, a seed, and a sequence of player actions, it produces the exact same game state and event stream on every machine, every time. State is plain JSON, so a `structuredClone` is the entire "save/replay" story, and even the RNG lives inside that state as data. A single facade validates and applies every action and emits events; the Phaser scenes (`src/scenes/`) only ever consume that event stream to animate, and hold no rules logic of their own. The AI (`src/ai/`) plays through that same engine via the identical redacted view a human sees, which is what makes the "no AI reads hidden information" guarantee structural instead of a promise in a comment.

That separation is what makes a real test suite possible: **745 tests (3 skipped) across 77 files**, covering engine flow/combat/keywords/mana/RNG/determinism, the stack and effects, catalog integrity, meta systems (collection, economy, save migrations, gauntlet, achievements, daily quests, Limited drafting, deck share codes, deck color identity), the variant/drop-distribution math behind the booster system, economy EV gates and named exploit regressions backed by a 10-persona progression simulator, onboarding tutorial determinism, audio recipes and music patterns, platform/gesture/render-scale behavior, and AI smoke tests plus the win-rate gates above (hundreds of full AI-vs-AI games). The whole suite finishes in about 25-30 seconds.

For deeper dives: [docs/architecture.md](docs/architecture.md) (layers, the event/decision model, determinism), [docs/design-system.md](docs/design-system.md) (visual language, tokens, components, and interaction contracts), [docs/plan-design-system-alignment.md](docs/plan-design-system-alignment.md) (the audited implementation sequence required for full alignment), [docs/rules.md](docs/rules.md) (the full ruleset as implemented), [docs/adding-cards.md](docs/adding-cards.md) (the card schema and how new cards get built), [docs/ai.md](docs/ai.md) (how each difficulty thinks), [docs/art-pipeline.md](docs/art-pipeline.md) (the art resolution and generation pipeline), and [docs/roadmap.md](docs/roadmap.md) (current status in detail).

## Project status

**Darling Blades is 1.1** (released 2026-07-16; 1.0 shipped 2026-07-10). The full solo loop (menu → optional tutorial → free starter claim → Gauntlet, Draft, or Practice → daily quests and rewards → shop → pack opening → collection / achievements → deck builder) is wired end to end, every card in the pool has finished illustrated art, and the test suite is green.

**Shipped in 1.1** (see *What's new* above): the 80-card **Celtic Fae** expansion with the Sever and Foresee mechanics and gauntlet rungs 11-12; the public **Draft** mode with 20 AI draft personas and the keep-your-picks Premium Draft; **shard-crafting**; the shop deck-preview, achievements-screen, and glossary overhauls; set symbols; and a simulation-verified economy tuning pass.

**Shipped in 1.0:** the complete solo game loop; optional onboarding; daily quests and win streaks; achievements and collection-goal tracking with themed RoTK, Greek, Beastkin, Ragnarök, and tower-clear goals; deck share codes and multiple saved decks with per-deck hero cards; the 210-card base pool illustrated alongside the 69-card **Ragnarök** expansion (a Norse graveyard/reanimator faction, set `ragnarok`, `rg-` prefix, with its own set-scoped booster and a buyable precon); the five-tier rarity/frame/holo booster system; the full 5-color engine (mana, keywords, the stack, combat) plus Ragnarök's double-strike / mill / reanimate mechanics; three AI difficulties and 10 gauntlet personalities; procedural SFX and generative ambient music; a ground-up UI/theme refresh across every scene; the settings/accessibility menu; and phone-over-LAN play for the entire single-player loop.

**Coming after 1.1:** a practice **opponent picker** and deterministic game replays (1.2), a seeded **daily tower rotation** (1.3), the **"Darlings"** commander-style format with themed precons (1.5), and **player-made card packs** (2.0), plus the standing real-device touch/audio polish and by-ear/by-eye passes. Real head-to-head LAN multiplayer is designed but remains further out.

## About this project

This is a personal, single-player project built and tuned by one developer; there's no multiplayer server and no public contribution pipeline at the moment. The codebase does hold itself to a few unusual disciplines for a solo project, though: the rules engine is fully headless and seeded-deterministic, every difficulty of AI is held to a measured (not assumed) win-rate floor, and the documentation in `docs/` carries anti-rot tooling (`npm run check-docs`) that flags a doc as stale the moment the code it describes changes without it.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The illustrated card and scene art (everything under `public/assets/art/`) and the desktop app icons (`src-tauri/icons/`) are **not** covered by that license; all rights to those images are reserved.
