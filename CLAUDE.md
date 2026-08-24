# Darling Blades — Claude session guide

Single-player MTG-style (8th/9th/10th-edition feel) collectible card game.
Phaser 3 (pinned, never v4) + TypeScript + Vite + Vitest. **Under git** (`main`);
the main session owns commits — parallel sub-agents don't run git.

## Before doing anything

Read [docs/claude-playbook.md](docs/claude-playbook.md) — the orchestration
playbook: how to think through steps (orient → baseline → decompose →
delegate → review → adversarially verify → measure honestly → sync docs),
how to write agent prompts as contracts, the verification ladder, the
preview-probe recipe for the hidden-tab dev server, and the known-traps
registry. Sessions on this repo follow that loop.

"What's next" is defined by [docs/roadmap.md](docs/roadmap.md)'s Planned
section — the docs are the spec. Locked design decisions (documented in the
session memory and docs) are never relitigated.

## Requests are intent, not spec

The user's requests describe what they're reaching for, not a complete or
infallible spec (their words, 2026-07-13: "I am human and fallible — don't
take my requests as 100% complete as written"). On every request: infer the
adjacent changes it implies, and say so — fold the cheap, reversible ones in
directly (naming them in the delivery), and put the expensive or
taste-sensitive ones to the user as short suggest-or-confirm items rather
than deciding silently or ignoring them. If a request contains a gap or
contradicts something established, surface that instead of executing it
faithfully. During iterative visual work especially, treat each delivery as
a checkpoint: end with the inferred next steps, so "almost there" always
arrives with a concrete proposal for what "there" looks like.

## Git & deploys

Public repo (`vantaloomin/darling-blades`); **`main` auto-deploys** to GitHub
Pages on every green push, so treat `main` as production. The main session owns
all git; sub-agents never run it. Branch non-trivial work, run the ladder
locally before pushing, and land risky changes via a PR (CI gates it). Full
branch / commit / PR / merge flow: [docs/git-workflow.md](docs/git-workflow.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` | dev server (:5173) / typecheck + production build |
| `npx vitest run` | full suite (~3 min at pool 638; win-rate gates included; run on an idle machine, not during sweeps) |
| `npm run lint` | ESLint over src, tests, scripts (enforces layer purity) |
| `npm run check-docs` / `check-art-bible` / `gen-docs-tables -- --check` | doc anti-rot checkers (must be green, zero warnings) |
| `npx tsx scripts/balance-matrix.ts --avatars --seeds 40` | balance matrices (call tsx directly — PowerShell eats `--` via npm run) |
| `npm run sweep-dash` | live metagame-sweep dashboard (:5185; pairs with craft.ts --status-file) |
| `npm run app:build` / `npm run app:dev` | Tauri desktop app — NSIS installer / dev window (needs Rust + MSVC; see [docs/desktop-build.md](docs/desktop-build.md)) |

## Iron invariants

- `src/engine|ai|data|meta|config` never import Phaser or browser APIs;
  tests never import Phaser. The engine is headless and seeded-deterministic.
- AI reads only the redacted `PlayerView` — never hidden state.
- Save schema changes bump `SaveData.version` with a real `migrate()` +
  test; the storage key `darlingblades.save.v1` is a slot name, not a version
  (the legacy `waifutcg.save.v1` key is still read once for save migration).
- Test gate floors only ratchet upward, with fresh measured numbers.
- Never `setInteractive` a scaled Container; more traps in the playbook §11.

## Where things live

`docs/` is the doc set (architecture, rules, adding-cards, ai, art-pipeline,
roadmap, art-bible/, claude-playbook, git-workflow). Balance baseline lives date-stamped in
`src/data/opponents.ts`. Negative AI-experiment results live in
`src/ai/determinize.ts`. Session memory (cross-session state) is in the
Claude memory directory, indexed by `MEMORY.md`.

**Design reference workbenches — local-only, gitignored, and absent from a
fresh clone.** Do not assume these exist; check before relying on them, and
expect to rebuild after cloning to a new machine.

- `balance/` + `scripts/card-reference.ts` — the Darling Blades card workbench
  (power formula + scores).
- `balance/cards.sqlite` + `scripts/blades-db.ts` + `docs/blades-card-db.md` —
  our own corpus built to the **same schema and commands as the MTG reference
  below**, so the two compare 1:1. Adds the cross-corpus moves: `like "<our
  card>" --mtg` (our card vs precedent, vocabulary translated automatically),
  `like --from mtg "<real card>"` (do we already answer this?), `query … --mtg`
  (ATTACHes the corpus, so `UNION ALL` and joins work), and `audit` (every
  collectible card against its analog band → `balance/mtg-audit.md`). The
  Blades→Magic dictionary is one `TERMS` table that both performs the
  translation and ships as the queryable `translations` table — read it with
  `terms`, and after any new keyword or mechanic run `terms --check`, which
  fails if our vocabulary leaked into the translated text. `decks` exposes the
  archetype layer the corpus cannot have (Magic has no canonical deck lists):
  the 28 authored precon/theme/gauntlet lists, so archetype membership is
  measured, not inferred. Never use a Scryfall tag slug without confirming it
  exists in `mtg-cache` first — `stats` reports how many of ours have a
  counterpart. Rebuild in under a second with `npx tsx scripts/blades-db.ts
  build` — do it after any card-data edit.
- `mtg-cache/` + `scripts/mtg-db.ts` + `docs/mtg-reference-db.md` — a SQLite
  copy of the real MTG corpus (~36k cards, ~111k printings) with oracle text,
  costs, keywords, format legality, EDHREC rank, and Scryfall's curated
  functional tags (`sweeper`, `removal-destroy`, `ramp`). Use it to check a
  cost against real precedent, and `like --text "<effect>"` to find the MTG
  analogs of a card being designed. Rebuild with
  `npx tsx scripts/mtg-db.ts build --printings --tags`; `mtg-db.ts` carries its
  own usage header, and two local-only docs sit beside it —
  `docs/mtg-reference-db.md` (schema, build flags, query recipes) and
  `docs/mtg-db-playbook.md` (how to cost against precedent, the era filter that
  keeps modern power creep out of our numbers, and where MTG precedent stops
  applying here). Sourced from Scryfall bulk by default
  (magicthegathering.io is supported but frozen at 2024-08).
- `deck-cache/` + `scripts/decks-db.ts` + `docs/deck-corpus.md` — real
  tournament decklists, every card linked to an `oracle_id` in `mtg-cache`, so
  deck *construction* calibrates the way card *costs* do (lands per archetype,
  curve centre, removal density, 4-of share). Two sources: `pull` clones
  brossignol/MTGODecklistCache (a maintained fork — Badaro's original was
  archived 2025-06-10) for volume + standings; `scrape` crawls mtgtop8.com for
  the archetype labels the JSON cache lacks. **The crawler is polite by
  construction** — identifying UA, 1500ms floor, every response disk-cached,
  `--events` bounded, and it stops on 403/429 instead of pushing; keep it that
  way. `compare` puts our 28 authored decks beside the corpus on shape only.
  Sideboards, card pool, and metagame do NOT transfer — see the doc's "where
  this stops applying", and the win rates still win.

None of this is ever committed, and corpus rows are never copied into
`src/data/` — read the MTG corpus to calibrate costs, never to paste text from.
