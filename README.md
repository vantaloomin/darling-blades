<!-- source-of-truth: package.json, src/config/rules.ts, src/data/cards/*.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/scenes/, docs/design-system.md, docs/plan-design-system-alignment.md, docs/rules.md, docs/ai.md, docs/art-pipeline.md, docs/roadmap.md, docs/mobile-lan-plan.md, tests/ · last-verified: 2026-07-31
     If you change those files, update this doc or re-verify the date.
     Writing rules for this file: no em-dashes or en-dashes (use period/comma/colon/semicolon/parentheses; plain hyphens in numeric ranges), no emojis, and avoid formulaic AI prose patterns (no "X is here" openers, no anthropomorphized marketing lines, no rhetorical triads or dramatic reveal colons). Section order: What is Darling Blades, Features, the latest release notes, then everything else. -->

# Darling Blades

*A trading card game where the officers of the Three Kingdoms, the gods of Olympus, and a forest full of Beastkin all end up in the same 60-card deck.*

<p align="center">
  <img src="public/assets/art/cards/tk-shu-zhugeliang.webp" width="160" alt="Zhuge Liang">
  <img src="public/assets/art/cards/gk-zeus.webp" width="160" alt="Zeus">
  <img src="public/assets/art/cards/bk-kitsune-matriarch.webp" width="160" alt="Kitsune Matriarch">
</p>

<p align="center">
  <a href="https://vantaloomin.github.io/darling-blades/"><b>Play Darling Blades in your browser</b></a>
</p>

## What is Darling Blades?

Darling Blades is a single-player trading card game in the style of Magic: the Gathering, specifically the 8th/9th/10th-edition era: five colors of mana, creatures and combat, instants and sorceries resolving off a stack, and the familiar rhythm of curving out and then racing or grinding to a win. If you played that era of Magic, you already know most of the rules.

The cast is what's different. The **764 collectible cards across seven sets** share characters from the officers of **Wei**, **Wu**, **Shu**, and **Jin**, the **Greek pantheon**, tribal **Beastkin**, Ragnarök's graveyard faction, Celtic Fae courts, Arthurian knights, Gothic Monsters, Dark Tales storybook figures, and Cyberpunk Yokai Nights. Every card carries finished cel-shaded gacha-anime art; nothing in the shipped game is programmer-art or a placeholder.

You play or skip a short optional tutorial, claim a free starter deck, crack booster packs to build out your collection, and assemble a 60-card deck in the deck builder. Then you duel: Practice matches against any tower boss or a plain difficulty, the 20-rung **Avatar Gauntlet** (a ladder of named boss opponents, each running a themed deck, reshuffled daily), or a seat at the **Draft** table to build a fresh 40-card deck from passed packs against seven AI rivals.

## Features

- **A 764-card collectible pool across seven sets.** Base Set, Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, and Cyberpunk Yokai Nights cover all five WUBRG colors and the same five rarity tiers. Cyberpunk Yokai Nights, the newest set, adds 120 cards built around Hauntlink and has its own set-scoped booster.
- **Five 60-card starter decks**, one two-color archetype per color pair: **Crimson Muster** (Red/White aggro), **Wild Communion** (Green/White creature tribal), **Burning Tides** (Blue/Red tempo-burn), **Shadow Mandate** (Blue/Black control), and **Grave Harvest** (Black/Green deathblade attrition). Every color shows up in exactly two of the five.
- **Real MTG-style deckbuilding rules**: 60-card minimum decks built from your own collection, up to 4 copies of any non-basic card (basics unlimited), 20 starting life, 7-card hands, a London-style mulligan with your first mulligan free, and an auto-tap mana solver so you're never manually tapping individual lands to pay generic costs.
- **Gacha-style booster packs.** 450 gold buys 9 cards in the Base Set booster; 525 gold buys 9 in the Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, or Cyberpunk Yokai Nights boosters. Every slot independently rolls a rarity tier, a cosmetic frame (white/blue/red/gold/rainbow/black), a holo finish (none/shiny/rainbow/pearlescent/fractal/void), and a 0.25% Full Art chance where the illustration covers the whole card face. The rarest possible pull (Ultra Rare, black frame, void holo, Full Art) lands at roughly 1 in 1.98 billion. Each pack tile shows how many of its set's cards you already own; its info glyph opens a pool summary alongside the rarity, frame, and holo odds, which are identical across every booster.
- **Dark Tales mechanics: Skim and Retell.** Skim pays an instant-speed cost to discard a card and draw a card. Retell casts a Ritual or Charm from your graveyard for its alternative cost, then severs it. Both are engine-first, seeded-deterministic mechanics with player-facing duel affordances.
- **The Yokai Nights mechanic: Hauntlink.** Many Yokai artifacts and enchantments can be played linked to a creature you control. The linked card grants its bonus while the host lives and falls to the graveyard when the host leaves; on the battlefield the pair physically overlap, the way you would lay them out on a real table.
- **The Avatar Gauntlet**: a 20-rung, 20-floor ladder of named boss opponents (Meng Huo, Hestia, Lupa the Wolfqueen, Hera, Zhurong, Sima Yi, Yohime the Kitsune Matriarch, Cao Cao, the Ragnarök bosses Hel and Brunhild, the Celtic Fae pair of The Morrigan and Titania, the Arthurian summit of Morgan of the Thorn Crown and Artoria, Once and Future Queen, the Gothic Monsters pair of Carmilla and The Bride, the Dark Tales pair of Glass-Coffin Queen and Abyssal Songstress, and the Yokai Nights pair of Queen of the Lanterned Roof and Kitsune Neon Tyrant), each piloting a themed deck and personality. The roster reshuffles every day from a date seed, and the floor you reach sets the AI's strength on a six-tier ladder while the avatar brings its own deck and personality. Gold pays out per rung cleared plus a bonus for a full run. Practice mode lets you challenge any of the 20 bosses directly, or a plain difficulty, with no ladder attached.
- **Draft mode**: the eight-seat persona draft described in the release notes below, with a free tier that pays gold on your record and a Premium tier that keeps its picks.
- **Optional onboarding and long-term goals.** First launch offers a guided tutorial duel, and the Achievements screen tracks collection percentage, color completion, themed RoTK / Greek / Beastkin / Ragnarök goals, mono/dual-color tower clears, variant chase goals, mastery goals, and pack-opening milestones with claimable gold rewards.
- **Daily Blades**: three rotating daily quests with progress bars, claimable gold, and up to three rerolls a day, plus an escalating win-streak bonus paid on your first win of each calendar day. The same calendar day rolls the same quests for everyone, because the quest roll is deterministically seeded like everything else here.
- **Deck sharing and multiple saved decks.** Keep as many constructed decks as you like (copy / rename / delete, plus a starrable per-deck hero card that fronts your in-duel portrait), and export any legal deck as a compact `DBD2-…` share code that another player can paste straight into their own Deck Builder. Imports validate against their collection and the normal deckbuilding rules.
- **AI that never cheats.** Every difficulty (Easy, Medium, Hard) plays through the exact same redacted view of the game state a human opponent would see; none of them can look at your hand or either deck's remaining contents. The difficulty gap is measured rather than assumed: Medium beats Easy at least 80% of the time (measured around 82.5%) and Hard beats Medium at least 70% of the time (measured around 78%) across large seeded AI-vs-AI test batches.
- **Fully illustrated, nothing placeholder.** All 764 collectible cards across seven sets carry finished cel-shaded gacha-anime art, plus painted backdrops for every scene and pack art for every set. The shipped art payload is 133.57 MiB of WebP, down from 729.65 MiB of PNG source art, a 5.5x reduction. Basic lands come in per-set landscape styles you choose in the deck builder. The audio side is entirely procedural: every sound effect and the four-mood generative ambient music score are synthesized live in the browser over WebAudio, with no audio asset files at all.
- **Built-in accessibility settings**: independent SFX and music toggles with volume control, an animation-level switch (full / reduced / off), a render-size selector (720p / 1080p / 1440p), and an auto-skip toggle that fast-forwards empty or forced duel phases. Every setting persists to your save.
- **Playable on your phone today.** The entire single-player loop runs comfortably by touch over your local network. Real head-to-head LAN multiplayer is designed but not yet built; see Project status below.

## What's new in 1.5 (Yokai Nights)

Version 1.5 adds Cyberpunk Yokai Nights, expands the collection to 764
collectible cards across seven sets, extends the daily tower to 20 floors,
and ships the largest balance and game-feel pass the project has had.

**Cyberpunk Yokai Nights (Expansion 6).** 120 cards of neon spirits, fox
courts, and haunted city grids, built around **Hauntlink**: many Yokai
artifacts and enchantments can be played linked to a creature you control,
granting their bonus while the host lives and falling to the graveyard when
it dies. The set brings its own booster and the **Neon Afterimage** precon,
five allied dual lands, eight achievements, and the tower's new summit pair,
**Queen of the Lanterned Roof** and **Kitsune Neon Tyrant**, at rungs 19-20.

**Save codes.** The Profile page can now export your entire profile as a
compact code and import one on another machine or browser. Replays are left
out by default and can be included; imports replace the whole profile after
an explicit confirmation.

**The balance pass.** Combat now allows up to four blockers on one attacker,
and the game says so when a tapped creature cannot answer the call. Two new
common sweepers join the Base Set (**Ember Squall** and **Creeping
Malaise**), several rival decks learned to carry answers, every tapland now
gives a small bonus when it arrives, and four new tribal leaders anchor Jin,
Construct, Warrior, and Fae decks. Neon Afterimage was rebuilt from the
ground up, The Bride's worst matchup was repaired, and every tower floor was
re-measured at five times the previous sample size. Midnight Storybook
remains a deliberate uphill battle while the Dark Tales pool waits for
sharper tools.

**Game feel.** Skipping blocks now states its price on the button and asks
twice only when the hit would be lethal, with an always-on combat forecast
during blocking. Sharding a card is a hold-to-confirm ritual instead of a
click. The duel score tightens when either side drops low and thins out when
lethal is on the board. Achievements announce themselves the moment you earn
them. Hauntlinked cards physically overlap their host, hostile targets ring
red while your own ring green, stack spells draw an arrow to their target,
and cards travel the board slowly enough to follow. Screens navigate with a
consistent back button, the shop's Card Packs tab scrolls a draggable strip
with set blurbs, and the collection binder filters by every set.

## What shipped in 1.4 (Dark Tales)

Version 1.4 adds Dark Tales, The Cursed Storybook, expands the collection to
638 collectible cards across six sets, and extends the daily tower to 18
floors.

**Dark Tales: The Cursed Storybook (Expansion 5).** 120 cards and four tokens
bring a graveyard-and-hand-control set built around **Skim** and **Retell**.
Skim smooths a hand at instant speed. Retell casts a Ritual or Charm from the
graveyard, then severs it. The set has its own booster, the **Midnight
Storybook** precon, eight achievements, two summit bosses, player-facing duel
affordances, and a paged glossary entry for each mechanic.

**The 18-floor daily tower.** Glass-Coffin Queen and Abyssal Songstress join
the roster at rungs 17 and 18. The roster still reshuffles from the calendar
date, while the floor selects the AI tier and each avatar supplies its own
deck and personality.

**Balance and release riders.** The six recosts and Midnight Storybook rebuild
raised the precon's measured result from 6.7% to 30.5% across 13,500 games,
below the requested 40-55% band. The go-wide answer gap also remains open.
The release includes collection variants and odds disclosure, Dark Tales
land-style wiring, 124 accepted Dark Tales arts, WebP art conversion, the
informational dev-only persona metagame loop, and the 1.5-to-2.0 expansion
slate.

## What shipped in 1.3 (Nocturne Manor)

- **Gothic Monsters: Nocturne Manor (Expansion 4).** 81 collectible cards of vampire courts and wolf-cursed nobility, mostly Black/Red/White, with two mechanics: **Dreaded** attackers must be blocked by at least two creatures or none, and **Empower** adds an optional extra cost for a bonus effect at cast time. Its own booster, the **Bloodmoon Masquerade** precon, eight achievements, and gauntlet rungs 15-16 (**Carmilla, Crimson Host** and **The Bride, Storm-Crowned**).
- **The daily-rotating tower.** The Avatar Gauntlet reshuffles its full roster from the calendar date each day; the floor sets the opponent's strength on a measured six-tier ladder while the avatar supplies its deck and personality.
- **Basic-land art styles.** Pick a cosmetic landscape style per basic land type in the deck builder, saved per deck and shown on your own lands in a duel.
- **Reading clarity and balance.** Mana costs in card text render as real pips; "+1/+1 counter" reads as "+1/+1 mark" everywhere; pack pulls step with arrow keys and close with Esc. A 10,800-game precon round-robin rebuilt the **Questing Table** from 24% to 45% and trimmed **Bloodmoon Masquerade** from 70% to 57%, settling the nine-deck field inside a rough 42 to 60 percent band. Sealed's dead code was removed, and a dev-only deck-crafting harness began probing set balance (its first run flagged the go-wide answer gap).

## How to play

The main menu routes to:

| Mode | What it does |
| --- | --- |
| **Play → Avatar Gauntlet** | Climb the 20-rung, 20-floor ladder of named boss opponents, reshuffled daily with floor-scaled difficulty; clear a rung and roll straight into the next, with per-rung gold and a completion bonus. |
| **Play → Draft** | An eight-seat draft against seven named AI drafters: pick 45 cards across three passed packs, build a 40-card deck, and play three matches. Free entry pays gold on your record; Premium (1,000g, twice a week) keeps every pick. |
| **Play → Practice** | A one-off duel with no ladder attached: pick any of the 20 tower bosses (with their deck and personality) or a plain Easy / Medium / Hard opponent. |
| **Shop** | Buy a 9-card booster (Base Set, Ragnarök, Celtic Fae, Arthurian Court, Gothic Monsters, Dark Tales, or Cyberpunk Yokai Nights) and watch the rarity/frame/holo reveal animate slot by slot, or buy whole decks (the unpicked starters and the expansion precons) from the Decks tab, each with a full-stats preview. Every booster carries an info glyph with that set's exact drop rates. |
| **Collection** | A binder-style spread of every card you own, filterable by color / type / rarity / set / owned, showing your best-owned print of each plus pool and special-variant completion progress, with a Craft action on any card you're missing. |
| **Decks** | Pick your active deck, and build or edit your 60-card decks from your owned collection. |
| **Achievements** | Review locked/unlocked/claimed goals and claim gold rewards for collection, variant, themed, mastery, and economy milestones. |
| **Card Showcase** | A gallery of every frame style and holo finish available on a given card. |

The main menu also hosts the **Daily Blades** quest panel and a **Profile** page with your lifetime win-rate, gauntlet stats, and the **Replays** reel: rewatch any of your last ten duels with play, pause, step, and speed controls. On first launch you can play or skip the tutorial, then claim one free starter deck from the shop and receive a starting gold grant, enough for your first booster pack. The Settings button opens the accessibility/audio options described above.

## Getting started

```bash
npm install
npm run dev      # Vite dev server at :5173
npm run build    # typecheck + production build
npx vitest run    # full test suite (~8 min; AI win-rate gates included)
```

On Windows you can also double-click **`run-dev.bat`** or **`run-production.bat`**; both install dependencies if missing.

## Under the hood

Darling Blades is TypeScript on Vite, rendered with Phaser 3.90 (pinned; never v4), tested with Vitest, and linted with ESLint/typescript-eslint. There's no UI framework underneath the game view; it's Phaser end to end.

The codebase is split into two halves that never touch each other's concerns. `src/engine/` is a pure, Phaser-free, deterministic rules engine: given a set of decklists, a seed, and a sequence of player actions, it produces the exact same game state and event stream on every machine, every time. State is plain JSON, so a `structuredClone` is the entire "save/replay" story, and even the RNG lives inside that state as data. A single facade validates and applies every action and emits events; the Phaser scenes (`src/scenes/`) only ever consume that event stream to animate, and hold no rules logic of their own. The AI (`src/ai/`) plays through that same engine via the identical redacted view a human sees, which is what makes the "no AI reads hidden information" guarantee structural instead of a promise in a comment.

That separation is what makes a real test suite possible: **1,277 tests (4 skipped) across 134 files**, covering engine flow/combat/keywords/mana/RNG/determinism, the stack and effects, catalog integrity, meta systems (collection, economy, save migrations, gauntlet, achievements, daily quests, Limited drafting, deck share codes, deck color identity), the variant/drop-distribution math behind the booster system, economy EV gates and named exploit regressions backed by a 10-persona progression simulator, onboarding tutorial determinism, audio recipes and music patterns, platform/gesture/render-scale behavior, and AI smoke tests plus the win-rate gates above (hundreds of full AI-vs-AI games). The whole suite finishes in about eight minutes on the release-prep Windows host.

For deeper dives: [docs/architecture.md](docs/architecture.md) (layers, the event/decision model, determinism), [docs/design-system.md](docs/design-system.md) (visual language, tokens, components, and interaction contracts), [docs/plan-design-system-alignment.md](docs/plan-design-system-alignment.md) (the audited implementation sequence required for full alignment), [docs/rules.md](docs/rules.md) (the full ruleset as implemented), [docs/adding-cards.md](docs/adding-cards.md) (the card schema and how new cards get built), [docs/ai.md](docs/ai.md) (how each difficulty thinks), [docs/art-pipeline.md](docs/art-pipeline.md) (the art resolution and generation pipeline), and [docs/roadmap.md](docs/roadmap.md) (current status in detail).

## Project status

**Darling Blades is 1.5.0**, released 2026-07-31 (tag v1.5.0). The full solo loop (menu → optional tutorial → free starter claim → Gauntlet, Draft, or Practice → daily quests and rewards → shop → pack opening → collection / achievements → deck builder) is wired end to end, all 764 collectible cards have finished illustrated art, and the test suite is green.

**Shipped in 1.5** (see *What's new* above): the 120-card **Cyberpunk Yokai Nights** expansion with the Hauntlink mechanic and gauntlet rungs 19-20; whole-profile **save codes**; the combined balance pass (four-blocker combat, two new common sweepers, tapland arrival bonuses, four tribal leaders, the Neon Afterimage rebuild, and a 200-seed re-baseline of every tower floor); the **game-feel wave** (block confirmation with an always-on combat forecast, the shard ritual, life-reactive duel music, achievement toasts, Hauntlink overlaps, side-colored targeting, stack arrows, readable card travel); the back-navigation convention; the shop's draggable Card Packs strip; and the binder set filter.

**Shipped in 1.4** (see *What's new* above): the 120-card Dark Tales expansion and four tokens; the Skim and Retell mechanics; the 18-rung, 18-floor daily tower; the Dark Tales booster, precon, achievements, accepted art, and land style; collection variants and odds disclosure; the informational dev-only persona metagame loop; and the WebP art payload reduction.

**Shipped in 1.3** (see *What's new* above): the 81-card **Gothic Monsters** expansion with the Dreaded and Empower mechanics and gauntlet rungs 15-16; a seeded **daily tower rotation** with a full-shuffle roster and a floor-scaled six-tier AI ladder; a per-basic **land art selector**; inline **mana pips** in card text and the "+1/+1 mark" retheme; shop and collection **theme titles with pool counts**; the Sealed dead-code removal; and a prefab-deck balance retune on the larger pool.

**Shipped in 1.2** (see *What's new* above): the 81-card **Arthurian Court** expansion with the Quest and Champion Awakening mechanics and gauntlet rungs 13-14; deterministic **replays**; the practice **opponent picker**; the opening **coin flip** with the play-or-draw choice; **Full Art** prints; the shop rework; and a mass-simulation balance pass over the precon decks.

**Shipped in 1.1**: the 81-card **Celtic Fae** expansion with the Sever and Foresee mechanics and gauntlet rungs 11-12; the public **Draft** mode with 20 AI draft personas and the keep-your-picks Premium Draft; **shard-crafting**; the shop deck-preview, achievements-screen, and glossary overhauls; set symbols; and a simulation-verified economy tuning pass.

**Shipped in 1.0:** the complete solo game loop; optional onboarding; daily quests and win streaks; achievements and collection-goal tracking with themed RoTK, Greek, Beastkin, Ragnarök, and tower-clear goals; deck share codes and multiple saved decks with per-deck hero cards; the Core Set and the **Ragnarök** expansion with its own set-scoped booster and buyable precon; the five-tier rarity/frame/holo booster system; the full 5-color engine (mana, keywords, the stack, combat) plus Ragnarök's double-strike / mill / reanimate mechanics; three AI difficulties and 10 gauntlet personalities; procedural SFX and generative ambient music; a ground-up UI/theme refresh across every scene; the settings/accessibility menu; and phone-over-LAN play for the entire single-player loop.

**Coming after 1.5:** the reveal of two built-but-hidden formats, the **"Darlings"** commander-style singleton format and the land-reserve **Battle Box** constructed format, once each has been balance-measured; a premium game-feel program (a physical cast-and-carry hand, a redesigned pack-opening runway, a trophy hall, card-back and playmat cosmetics, and per-set collection Courts); a rules upgrade that re-offers response windows after a stack resolves mid-combat; and a Limited economy retune. Suggested decks, player-facing replays, Story Mode, later expansions, and player-made card packs follow on the longer slate. Real head-to-head LAN multiplayer is designed but remains further out.

## About this project

This is a personal, single-player project built and tuned by one developer; there's no multiplayer server and no public contribution pipeline at the moment. The codebase does hold itself to a few unusual disciplines for a solo project, though: the rules engine is fully headless and seeded-deterministic, every difficulty of AI is held to a measured (not assumed) win-rate floor, and the documentation in `docs/` carries anti-rot tooling (`npm run check-docs`) that flags a doc as stale the moment the code it describes changes without it.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The illustrated card and scene art (everything under `public/assets/art/`) and the desktop app icons (`src-tauri/icons/`) are **not** covered by that license; all rights to those images are reserved.
