---
name: card-workbench
description: Local card-design workbenches for Darling Blades (power scorer CLI, blades-db, mtg-db, decks-db). Use when costing, designing, auditing, or comparing cards against MTG precedent or tournament deck shapes, or when rebuilding those databases.
---

# Design reference workbenches

**Local-only, gitignored, and absent from a fresh clone.** Do not assume these
exist; check before relying on them, and expect to rebuild after cloning to a
new machine. The always-on rules (never commit, never copy corpus rows, rebuild
after card edits, `terms --check`, polite crawler) live in the root
`CLAUDE.md`.

- `balance/` + `scripts/card-reference.ts` — the Darling Blades card workbench
  (power formula + scores). The power scorer itself is no longer here: it lives
  committed at `src/power/scoreCore.ts` (the Forge scores with it), and
  `balance/score.ts` is a thin local CLI over it through the one-line shim
  `balance/scoreCore.ts`. The rest of `balance/` (the CLI, `power-formula.md`,
  `power-scores.json`) stays local-only; the byte-identical rescore procedure
  is in [docs/forge.md](../../../docs/forge.md).
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
