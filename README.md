<!-- source-of-truth: package.json, src/config/rules.ts, src/data/cards/*.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/scenes/, docs/design-system.md, docs/plan-design-system-alignment.md, docs/rules.md, docs/ai.md, docs/art-pipeline.md, docs/roadmap.md, docs/mobile-lan-plan.md, tests/ · last-verified: 2026-07-21
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

The cast is what's different. Every card in the 215-card base pool is a character drawn from three worlds sharing one card pool: the officers of **Wei**, **Wu**, **Shu**, and **Jin** from a genderbent Romance of the Three Kingdoms (plus an "Other" bench of warlords and wildcards such as Dong Zhuo and Lü Bu); the **Greek pantheon** of Olympus (Ares, Athena, Artemis, Hades, Persephone, Demeter, Hestia, and more); and tribal **Beastkin** (Wolfkin, Kitsune, Harpy, Bearkin, Rhinokin, Nekomata, Lamia, Spiderkin, Crowkin, Batkin, and others). The **Ragnarök** expansion adds a fourth world, a Norse graveyard faction of Valkyries, Norns, Jotun, Draugr, and the death-goddess Hel, worth 70 more collectible cards. The **Celtic Fae** expansion (*The Silver Veil*) adds a fifth: 81 cards of fae courts, selkies, banshees, and wild hunts. The **Arthurian Court** expansion (*The Grail Oath*) adds a sixth: 81 cards of knights, quests, and grail light. The **Gothic Monsters** expansion (*Nocturne Manor*) adds a seventh: 81 cards of vampire courts, stitched brides, and wolf-cursed nobility, bringing the game to **518 collectible cards**. Every one of those cards carries finished cel-shaded gacha-anime art; nothing in the shipped game is programmer-art or a placeholder.

You play or skip a short optional tutorial, claim a free starter deck, crack booster packs to build out your collection, and assemble a 60-card deck in the deck builder. Then you duel: Practice matches against any tower boss or a plain difficulty, the 16-rung **Avatar Gauntlet** (a ladder of named boss opponents, each running a themed deck, reshuffled daily), or a seat at the **Draft** table to build a fresh 40-card deck from passed packs against seven AI rivals.

## Features

- **A 215-card, fully illustrated base pool.** 205 of those cards are booster-eligible across five rarity tiers (107 Common / 66 Rare / 13 Super Rare / 11 Super-Super Rare / 8 Ultra Rare); the other 10 are five free, unlimited basic lands and five non-collectible tokens created by card effects. All five WUBRG colors are represented across the three casts. The **Ragnarök** (set `ragnarok`, `rg-` prefix, 70 cards), **Celtic Fae** (set `celtic-fae`, `cf-` prefix, 81 cards), **Arthurian Court** (set `arthurian-court`, `ac-` prefix, 81 cards), and **Gothic Monsters** (set `gothic-monsters`, `gm-` prefix, 81 cards) expansions each add collectible cards across the same five tiers, sold through their own set-scoped boosters.
- **Five 60-card starter decks**, one two-color archetype per color pair: **Crimson Muster** (Red/White aggro), **Wild Communion** (Green/White creature tribal), **Burning Tides** (Blue/Red tempo-burn), **Shadow Mandate** (Blue/Black control), and **Grave Harvest** (Black/Green deathblade attrition). Every color shows up in exactly two of the five.
- **Real MTG-style deckbuilding rules**: 60-card minimum decks built from your own collection, up to 4 copies of any non-basic card (basics unlimited), 20 starting life, 7-card hands, a London-style mulligan with your first mulligan free, and an auto-tap mana solver so you're never manually tapping individual lands to pay generic costs.
- **Gacha-style booster packs.** 450 gold buys 9 cards in the Core Set booster; 525 gold buys 9 in the Ragnarök, Celtic Fae, Arthurian Court, or Gothic Monsters boosters. Every slot independently rolls a rarity tier, a cosmetic frame (white/blue/red/gold/rainbow/black), a holo finish (none/shiny/rainbow/pearlescent/fractal/void), and a 0.25% Full Art chance where the illustration covers the whole card face. The rarest possible pull (Ultra Rare, black frame, void holo, Full Art) lands at roughly 1 in 1.98 billion. Each pack tile shows how many of its set's cards you already own; its info glyph opens a pool summary alongside the rarity, frame, and holo odds, which are identical across every booster.
- **The Avatar Gauntlet**: a 16-rung ladder of named boss opponents (Meng Huo, Hestia, Lupa the Wolfqueen, Hera, Zhurong, Sima Yi, Yohime the Kitsune Matriarch, Cao Cao, the Ragnarök bosses Hel and Brunhild, the Celtic Fae pair of The Morrigan and Titania, the Arthurian summit of Morgan of the Thorn Crown and Artoria, Once and Future Queen, and the Gothic Monsters pair of Carmilla and The Bride), each piloting a themed deck and personality. The roster reshuffles every day from a date seed, and the floor you reach sets the AI's strength on a six-tier ladder while the avatar brings its own deck and personality; gold pays out per rung cleared plus a bonus for a full run. Practice mode lets you challenge any of the 16 bosses directly, or a plain difficulty, with no ladder attached.
- **Draft mode**: the eight-seat persona draft described in the release notes below, with a free tier that pays gold on your record and a Premium tier that keeps its picks.
- **Optional onboarding and long-term goals.** First launch offers a guided tutorial duel, and the Achievements screen tracks collection percentage, color completion, themed RoTK / Greek / Beastkin / Ragnarök goals, mono/dual-color tower clears, variant chase goals, mastery goals, and pack-opening milestones with claimable gold rewards.
- **Daily Blades**: three rotating daily quests with progress bars, claimable gold, and up to three rerolls a day, plus an escalating win-streak bonus paid on your first win of each calendar day. The same calendar day rolls the same quests for everyone, because the quest roll is deterministically seeded like everything else here.
- **Deck sharing and multiple saved decks.** Keep as many constructed decks as you like (copy / rename / delete, plus a starrable per-deck hero card that fronts your in-duel portrait), and export any legal deck as a compact `DBD2-…` share code that another player can paste straight into their own Deck Builder. Imports validate against their collection and the normal deckbuilding rules.
- **AI that never cheats.** Every difficulty (Easy, Medium, Hard) plays through the exact same redacted view of the game state a human opponent would see; none of them can look at your hand or either deck's remaining contents. The difficulty gap is measured rather than assumed: Medium beats Easy at least 80% of the time (measured around 82.5%) and Hard beats Medium at least 70% of the time (measured around 78%) across large seeded AI-vs-AI test batches.
- **Fully illustrated, nothing placeholder.** All 518 collectible cards across the Core Set, Ragnarök, Celtic Fae, Arthurian Court, and Gothic Monsters carry finished cel-shaded gacha-anime art, plus painted backdrops for every scene and pack art for every set. Basic lands come in per-set landscape styles you choose in the deck builder. The audio side is entirely procedural: every sound effect and the four-mood generative ambient music score are synthesized live in the browser over WebAudio, with no audio asset files at all.
- **Built-in accessibility settings**: independent SFX and music toggles with volume control, an animation-level switch (full / reduced / off), a render-size selector (720p / 1080p / 1440p), and an auto-skip toggle that fast-forwards empty or forced duel phases. Every setting persists to your save.
- **Playable on your phone today.** The entire single-player loop runs comfortably by touch over your local network. Real head-to-head LAN multiplayer is designed but not yet built; see Project status below.

## What shipped in 1.2 (The Grail Oath)

- **Arthurian Court: The Grail Oath (Expansion 3).** 81 collectible cards of White/Blue/Red knight tribal, plus two mechanics: **Quests** advance a chapter at each of your dawns and pay off as they go, and **Champion Awakening** transforms a knight permanently once its condition is met. Its own booster, the **Questing Table** precon, eight achievements, and gauntlet rungs 13-14 (**Morgan of the Thorn Crown** and **Artoria, Once and Future Queen**).
- **Replays.** The game records your last ten duels (seed, decks, and every action) and replays them deterministically from the Profile reel with play, pause, step, and speed controls. A replay is a byte-exact re-simulation, not a video.
- **The Play menu rebuilt.** A Practice opponent picker (challenge any tower avatar directly or a plain difficulty), and an opening coin flip whose winner chooses to play or draw first.
- **Shop rework** with a two-column precon grid and per-booster drop-rate tables, plus match-history clarity on what Foresee and Sever did and a mass-simulation balance pass over the precon decks.

## What's new in 1.3 (Nocturne Manor)

Version 1.3 adds a fourth expansion with two new mechanics and reworks the Avatar Gauntlet into a daily-rotating climb, alongside deckbuilding cosmetics and a round of reading-clarity fixes.

**Gothic Monsters: Nocturne Manor (Expansion 4).** 81 new collectible cards of vampire courts, stitched brides, and wolf-cursed nobility: primarily Black/Red/White, with a strain of Blue mad science and Green plant horror. Two new mechanics arrive with it. **Dreaded** marks an attacker that has to be blocked by at least two creatures or not at all. **Empower** is an optional extra cost you can pay as you cast a spell to add a bonus effect, and when the extra mana is payable the duel asks which way you want to cast. The set brings the game to **518 collectible cards**, all fully illustrated, and ships with its own 525-gold booster, the buyable **Bloodmoon Masquerade** precon, eight new achievements, and two bosses at the top of the tower: **Carmilla, Crimson Host** at rung 15 and **The Bride, Storm-Crowned** at rung 16.

**A daily-rotating tower.** The Avatar Gauntlet now reshuffles its full roster every day from the calendar date, so no two days climb the same order. Difficulty no longer rides with the avatar: the floor you reach sets the opponent's strength on a six-tier ladder (a measured, monotonic curve from a light hand up to full Hard), while the avatar you meet there brings its own deck and personality. The tower screen shows the day's lineup before you start a run, and a run you are partway through keeps its roster across reloads.

**Basic-land art styles.** The deck builder lets you pick a landscape style for each of your five basic land types, drawn from the base, Ragnarök, and Celtic Fae art sets. The choice is cosmetic, saved per deck, and shows only on your own lands in a duel.

**Reading clarity.** Mana costs written into card text and the Empower cast prompt now render as real mana pips instead of `{2}{B}` style tokens. "+1/+1 counter" reads as "+1/+1 mark" everywhere the game writes it, so it never collides with countering a spell (which stays "cancel"). Pack-open pulls now step with the left and right arrow keys and close with Esc, matching every other card inspector. The shop and collection show each set's theme title (Silver Veil, Grail Oath, Nocturne Manor), and each pack tile shows how many of its cards you own. The phase-advance button got the spacing the rest of the layout uses.

**Balance and fixes.**

- A 10,800-game AI-vs-AI round-robin of the precon decks retuned the field on the larger pool: the **Questing Table** precon was rebuilt from a 24% also-ran into a real 45% contender, the new **Bloodmoon Masquerade** was trimmed from 70% to 57%, and the nine-deck spread now sits inside a rough 42 to 60 percent band.
- The cancelled Sealed limited mode's dead code was removed. Existing saves keep loading, including any that still hold old Sealed history.
- A dev-only deck-crafting harness now simulates six archetype builders (burn, draw-go, attrition, reanimator, weenie, and a control baseline) assembling and hill-climbing their own decks from the card pool, as a standing probe on set balance. Its first run flagged that the field has no answer to a go-wide board, which is on the list for a future set.

## How to play

The main menu routes to:

| Mode | What it does |
| --- | --- |
| **Play → Avatar Gauntlet** | Climb the 16-rung ladder of named boss opponents, reshuffled daily with floor-scaled difficulty; clear a rung and roll straight into the next, with per-rung gold and a completion bonus. |
| **Play → Draft** | An eight-seat draft against seven named AI drafters: pick 45 cards across three passed packs, build a 40-card deck, and play three matches. Free entry pays gold on your record; Premium (1,000g, twice a week) keeps every pick. |
| **Play → Practice** | A one-off duel with no ladder attached: pick any of the 16 tower bosses (with their deck and personality) or a plain Easy / Medium / Hard opponent. |
| **Shop** | Buy a 9-card booster (Core Set, Ragnarök, Celtic Fae, or Arthurian Court) and watch the rarity/frame/holo reveal animate slot by slot, or buy whole decks (the unpicked starters and the expansion precons) from the Decks tab, each with a full-stats preview. Every booster carries an info glyph with that set's exact drop rates. |
| **Collection** | A binder-style spread of every card you own, filterable by color / type / rarity / set / owned, showing your best-owned print of each plus pool and special-variant completion progress, with a Craft action on any card you're missing. |
| **Decks** | Pick your active deck, and build or edit your 60-card decks from your owned collection. |
| **Achievements** | Review locked/unlocked/claimed goals and claim gold rewards for collection, variant, themed, mastery, and economy milestones. |
| **Card Showcase** | A gallery of every frame style × holo finish available on a given card. |

The main menu also hosts the **Daily Blades** quest panel and a **Profile** page with your lifetime win-rate, gauntlet stats, and the **Replays** reel: rewatch any of your last ten duels with play, pause, step, and speed controls. On first launch you can play or skip the tutorial, then claim one free starter deck from the shop and receive a starting gold grant, enough for your first booster pack. The Settings button opens the accessibility/audio options described above.

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

That separation is what makes a real test suite possible: **993 tests (4 skipped) across 103 files**, covering engine flow/combat/keywords/mana/RNG/determinism, the stack and effects, catalog integrity, meta systems (collection, economy, save migrations, gauntlet, achievements, daily quests, Limited drafting, deck share codes, deck color identity), the variant/drop-distribution math behind the booster system, economy EV gates and named exploit regressions backed by a 10-persona progression simulator, onboarding tutorial determinism, audio recipes and music patterns, platform/gesture/render-scale behavior, and AI smoke tests plus the win-rate gates above (hundreds of full AI-vs-AI games). The whole suite finishes in about 25-30 seconds.

For deeper dives: [docs/architecture.md](docs/architecture.md) (layers, the event/decision model, determinism), [docs/design-system.md](docs/design-system.md) (visual language, tokens, components, and interaction contracts), [docs/plan-design-system-alignment.md](docs/plan-design-system-alignment.md) (the audited implementation sequence required for full alignment), [docs/rules.md](docs/rules.md) (the full ruleset as implemented), [docs/adding-cards.md](docs/adding-cards.md) (the card schema and how new cards get built), [docs/ai.md](docs/ai.md) (how each difficulty thinks), [docs/art-pipeline.md](docs/art-pipeline.md) (the art resolution and generation pipeline), and [docs/roadmap.md](docs/roadmap.md) (current status in detail).

## Project status

**Darling Blades is 1.3** (released 2026-07-21; 1.2 shipped 2026-07-17, 1.1 on 2026-07-16, 1.0 on 2026-07-10). The full solo loop (menu → optional tutorial → free starter claim → Gauntlet, Draft, or Practice → daily quests and rewards → shop → pack opening → collection / achievements → deck builder) is wired end to end, every card in the pool has finished illustrated art, and the test suite is green.

**Shipped in 1.3** (see *What's new* above): the 81-card **Gothic Monsters** expansion with the Dreaded and Empower mechanics and gauntlet rungs 15-16; a seeded **daily tower rotation** with a full-shuffle roster and a floor-scaled six-tier AI ladder; a per-basic **land art selector**; inline **mana pips** in card text and the "+1/+1 mark" retheme; shop and collection **theme titles with pool counts**; the Sealed dead-code removal; and a prefab-deck balance retune on the larger pool.

**Shipped in 1.2** (see *What's new* above): the 81-card **Arthurian Court** expansion with the Quest and Champion Awakening mechanics and gauntlet rungs 13-14; deterministic **replays**; the practice **opponent picker**; the opening **coin flip** with the play-or-draw choice; **Full Art** prints; the shop rework; and a mass-simulation balance pass over the precon decks.

**Shipped in 1.1**: the 80-card **Celtic Fae** expansion with the Sever and Foresee mechanics and gauntlet rungs 11-12; the public **Draft** mode with 20 AI draft personas and the keep-your-picks Premium Draft; **shard-crafting**; the shop deck-preview, achievements-screen, and glossary overhauls; set symbols; and a simulation-verified economy tuning pass.

**Shipped in 1.0:** the complete solo game loop; optional onboarding; daily quests and win streaks; achievements and collection-goal tracking with themed RoTK, Greek, Beastkin, Ragnarök, and tower-clear goals; deck share codes and multiple saved decks with per-deck hero cards; the 210-card base pool illustrated alongside the 69-card **Ragnarök** expansion (a Norse graveyard/reanimator faction, set `ragnarok`, `rg-` prefix, with its own set-scoped booster and a buyable precon); the five-tier rarity/frame/holo booster system; the full 5-color engine (mana, keywords, the stack, combat) plus Ragnarök's double-strike / mill / reanimate mechanics; three AI difficulties and 10 gauntlet personalities; procedural SFX and generative ambient music; a ground-up UI/theme refresh across every scene; the settings/accessibility menu; and phone-over-LAN play for the entire single-player loop.

**Coming after 1.3:** the **Dark Tales** expansion (a storybook set built around Cycling and Flashback); the **"Darlings"** commander-style format with themed precons (1.5); and **player-made card packs** (2.0), plus the standing real-device touch/audio polish and by-ear/by-eye passes. Real head-to-head LAN multiplayer is designed but remains further out.

## About this project

This is a personal, single-player project built and tuned by one developer; there's no multiplayer server and no public contribution pipeline at the moment. The codebase does hold itself to a few unusual disciplines for a solo project, though: the rules engine is fully headless and seeded-deterministic, every difficulty of AI is held to a measured (not assumed) win-rate floor, and the documentation in `docs/` carries anti-rot tooling (`npm run check-docs`) that flags a doc as stale the moment the code it describes changes without it.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The illustrated card and scene art (everything under `public/assets/art/`) and the desktop app icons (`src-tauri/icons/`) are **not** covered by that license; all rights to those images are reserved.
