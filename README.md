<!-- source-of-truth: package.json, src/config/rules.ts, src/data/cards/*.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/scenes/, docs/rules.md, docs/ai.md, docs/roadmap.md, docs/release-notes/ · last-verified: 2026-10-08
     If you change those files, update this doc or re-verify the date.
     Writing rules for this file: no em-dashes or en-dashes (use period/comma/colon/semicolon/parentheses; plain hyphens in numeric ranges), no emojis, and avoid formulaic AI prose patterns (no "X is here" openers, no anthropomorphized marketing lines, no rhetorical triads or dramatic reveal colons). Section order: What is Darling Blades, Features, the latest release, then everything else. This file is the front door, not the manual: card lists, boss rosters, exact odds and mechanic definitions belong in docs/ and docs/release-notes/, and this file links to them. -->

# Darling Blades

*A trading card game where the officers of the Three Kingdoms, the gods of Olympus, and a forest full of Beastkin all end up in the same deck.*

<p align="center">
  <img src="public/assets/art/cards/tk-shu-zhugeliang.webp" width="160" alt="Zhuge Liang">
  <img src="public/assets/art/cards/gk-zeus.webp" width="160" alt="Zeus">
  <img src="public/assets/art/cards/bk-kitsune-matriarch.webp" width="160" alt="Kitsune Matriarch">
</p>

<p align="center">
  <a href="https://bladedarlings.com/"><b>Play Darling Blades in your browser</b></a>
</p>

**Desktop:** every GitHub Release includes a Windows installer.

## What is Darling Blades?

Darling Blades is a single-player trading card game in the style of Magic: the Gathering, specifically the 8th/9th/10th-edition era: five colors of mana, creatures and combat, instants and sorceries resolving off a stack, and the familiar rhythm of curving out and then racing or grinding to a win. If you played that era of Magic, you already know most of the rules.

The cast is what's different. The **1,648 collectible cards across eleven sets** draw on the officers of the Three Kingdoms, the Greek pantheon, tribal Beastkin, Norse Ragnarök, the Celtic Fae courts, Arthurian knights, Gothic Monsters, storybook Dark Tales, cyberpunk Yokai, the Egyptian Duat, living starships, a drowned fishing town, and the five clans of a valley where the sun rose for the first time this morning. Every card carries finished cel-shaded gacha-anime art; nothing in the shipped game is programmer-art or a placeholder.

You play or skip a short tutorial, claim a free starter deck, crack booster packs, and build a 40-spell deck with its ten-land Warchest. Then you duel: Practice matches against any tower boss, the 28-rung **Avatar Gauntlet** of named bosses reshuffled daily, or a seat at the **Draft** table against seven AI rivals.

## Features

- **A 1,648-card pool across eleven sets**, each with its own booster, its own mechanics, and its own shop deck. The newest, First Dawn, adds 166 cards built around Provoked and Hunt.
- **Five two-color starter decks**, one per archetype, and every color in exactly two of them.
- **MTG-style deckbuilding with one departure:** your lands live in a ten-land **Warchest** beside a 40-spell deck, and an auto-tap mana solver pays your costs.
- **Two formats.** **Warchest** is the standard constructed game. **Darlings** is the EDH-style one, where your Darling waits in her own zone over a 79-card singleton deck.
- **Gacha-style boosters.** Every slot rolls a rarity, a frame, a holo finish, and a slim chance at Full Art; every pack tile shows its exact odds.
- **The Avatar Gauntlet**, a 28-rung ladder of named bosses, each with her own deck and personality. The roster reshuffles daily, and the floor you reach sets the AI's strength.
- **Draft mode**, an eight-seat persona draft: 45 picks over three passed packs, then three matches. A free tier pays gold on your record; Premium keeps every pick.
- **Daily quests, achievements, and a win streak** with claimable gold, all rolled from a date seed so every player sees the same day.
- **Deck share codes and save codes.** Paste a deck straight into another player's builder, or carry your whole profile to another machine.
- **Deterministic replays.** Your last ten duels replay as byte-exact re-simulations with play, pause, step, and speed controls.
- **AI that never cheats.** Every difficulty plays through the same redacted view you do, and the gap between difficulties is measured in seeded AI-vs-AI games, not assumed.
- **Fully illustrated, nothing placeholder,** with painted backdrops for every scene and a procedural soundtrack synthesized live over WebAudio, with no audio files at all.
- **Accessibility settings** for text size, high contrast, audio, animation level, render size, and phase auto-skip, cues that never rely on colour alone, and the whole game **plays comfortably by touch on a phone** over your local network.

## What's new in 1.9

- **First Dawn**, a 166-card set with two new mechanics: **Provoked**, which triggers when a creature is dealt damage and survives, and **Hunt**, which has a creature fight one of your opponent's.
- **Overcharge**, a new rule across the whole game for when the board is full.
- **The tower climbs to 28**, and the summit's Darlings decks were rebuilt.
- **Card faces lose their flavor text** and gain a taller art window.
- **Art loads when a screen needs it**, so the Collection opens at once on far less memory.
- **Older boosters cost less** and fill your collection faster.
- **Text size and High contrast** settings, and cues that never rely on colour alone.

The full patch notes, with the cards, are in [docs/release-notes/v1.9.0.md](docs/release-notes/v1.9.0.md); the 1.9.1 patch is in [docs/release-notes/v1.9.1.md](docs/release-notes/v1.9.1.md), and the 1.9.2 patch is in [docs/release-notes/v1.9.2.md](docs/release-notes/v1.9.2.md). Earlier releases: [1.8.0](docs/release-notes/v1.8.0.md), [1.8.1](docs/release-notes/v1.8.1.md), [1.8.5](docs/release-notes/v1.8.5.md).

## How to play

The main menu routes to:

| Mode | What it does |
| --- | --- |
| **Play → Avatar Gauntlet** | Climb the 28-rung ladder of named bosses, with per-rung gold and a completion bonus. |
| **Play → Draft** | Draft against seven named AI drafters, build a deck, and play three matches. |
| **Play → Practice** | A one-off duel against any tower boss or a plain Easy / Medium / Hard opponent. |
| **Shop** | Buy any set's booster, or whole decks from the Decks tab, each with a full preview. |
| **Collection** | A binder of every card you own, filterable, with a Craft action on anything you're missing. |
| **Decks** | Pick your active deck, and build or edit your decks and Warchests. |
| **Achievements** | Claim gold for collection, variant, themed, mastery, and economy milestones. |
| **Card Showcase** | Every frame style and holo finish available on a given card. |

The main menu also hosts the daily quest panel, a **Profile** page with your lifetime stats and the replay reel, and Settings.

## Getting started

Node 24 LTS is the supported toolchain (`.nvmrc` carries the pin).

```bash
npm install
npm run dev      # Vite dev server at :5173
npm run build    # typecheck + production build
npx vitest run    # full test suite (~15 min; AI win-rate gates included)
```

On Windows you can also double-click **`run-dev.bat`** or **`run-production.bat`**; both install dependencies if missing.

## Under the hood

Darling Blades is TypeScript on Vite, rendered with Phaser 3 (pinned; never v4), tested with Vitest, and linted with ESLint. There is no UI framework underneath the game view.

The codebase is split into two halves. `src/engine/` is a pure, Phaser-free, deterministic rules engine: given decklists, a seed, and a sequence of actions, it produces the same game state and event stream on every machine, every time. The Phaser scenes only consume that event stream to animate, and hold no rules logic of their own. The AI plays through the same engine via the identical redacted view a human sees, which is what makes "the AI never reads hidden information" structural rather than a promise in a comment.

That separation is what makes a real test suite possible: **5,644 tests across 349 files**, from engine rules and save migrations to the win-rate gates, in about sixteen minutes on four workers.

For deeper dives: [docs/architecture.md](docs/architecture.md) (layers, the event model, determinism), [docs/rules.md](docs/rules.md) (the full ruleset as implemented), [docs/adding-cards.md](docs/adding-cards.md) (the card schema), [docs/ai.md](docs/ai.md) (how each difficulty thinks and how the bosses are measured), [docs/design-system.md](docs/design-system.md) (the visual language), [docs/art-pipeline.md](docs/art-pipeline.md) (the art pipeline), and [docs/roadmap.md](docs/roadmap.md) (current status in detail).

## Project status

**Darling Blades is 1.9.2** (tag v1.9.2). The full solo loop is wired end to end, all 1,648 collectible cards have finished art, the 28-rung tower is measured against win-rate floors, and the test suite is green.

**Coming next:** three more expansions through 2.0, a mobile rebuild, deck suggestions built from your own collection, and Story Mode. Multiplayer is not planned; the game is single-player by design.

## About this project

This is a personal, single-player project built and tuned by one developer; there is no multiplayer server, by design, and no public contribution pipeline at the moment. It does hold itself to a few unusual disciplines for a solo project: the rules engine is fully headless and seeded-deterministic, every AI difficulty is held to a measured win-rate floor, and the documentation in `docs/` carries anti-rot tooling (`npm run check-docs`) that flags a doc as stale the moment the code it describes changes without it.

## Privacy

Your game lives on your device. The game sets no cookies, loads no third-party scripts, runs no ads, and never receives your save.

Starting with 1.8, the game can send anonymous play stats: short summaries, rounded into broad ranges, with no name, account, identifier, deck name, or exact collection. It is on by default; every player is told once, in the game, before anything is sent, and the switch and a full list of what is sent are in Settings. The full policy is at [privacy.html](https://bladedarlings.com/privacy.html), generated from [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md) at every build so the two never differ.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The illustrated card and scene art (everything under `public/assets/art/`) and the desktop app icons (`src-tauri/icons/`) are **not** covered by that license; all rights to those images are reserved.

Three pages ship with every build and are linked from the Legal button in Settings: the [privacy policy](https://bladedarlings.com/privacy.html), the [terms of service](https://bladedarlings.com/terms.html), and the [notices](https://bladedarlings.com/notices.html), which cover trademark non-affiliation, art rights, and the third-party licenses the game redistributes.

Darling Blades is made for players aged 16 and over.
