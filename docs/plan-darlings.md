<!-- source-of-truth: docs/roadmap.md, docs/plan-commander-mode.md, docs/plan-expansion-slate.md, src/config/rules.ts, src/data/cardTypes.ts, src/data/catalog.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/meta/deckFace.ts, src/scenes/DeckBuilderScene.ts, src/scenes/DuelScene.ts, src/engine/view.ts, scripts/balance-matrix.ts · last-verified: 2026-07-31 · design/plan doc - re-verify when the referenced code changes -->

# Darlings format implementation plan

## Goal

Release 1.5.5 ships Darlings as a first-class, single-player deckbuilding format. A player chooses one legendary creature as their Darling, builds a 79-card singleton spell deck in her colors, and plays it with a 10-land Warchest. The selected Darling begins in a public command zone, not the shuffled deck. This document supersedes the implementation direction in `docs/plan-commander-mode.md`; that older document remains useful as historical rationale and must not be copied into a second roster specification.

## Status

Darlings and Battle Box are engine-complete and UI-complete, but their UI is
flagged off for 1.5.0. They are exposed in 1.5.5 after their `TO MEASURE`
balance matrices exist. The Battle Box system's product name is **Warchest**
as of 2026-07-31 (see [plan-battle-box.md](plan-battle-box.md)'s naming
note and [plan-1.5.5.md](plan-1.5.5.md), the active reveal train).

**Historical 2026-07-31 and 2026-07-28 shapes:** Earlier planning described an 80-card in-deck Darling and, before that, a 50-card in-deck version. Both are superseded by the 2026-08-01 command-zone respec below. The Warchest remains a 10-land reserve; strict colorless remains future work until a purpose-built roster exists.

## Curated precon slate (in progress)

The Shop's Darlings section carries five reviewed 79-spell singleton decks,
each with its legend in the command zone and a 10-land Warchest. Red Cliffs
Refrain is Zhou Yu's U/R spellslinger burn list and is a free, one-time claim.
The claim sets `darlingsFreeDeckClaimed` in the existing v26 save shape, costs
no gold, grants the 79 spells plus Zhou Yu and any nonbasic reserve lands, and
is idempotent.

Queen Below (Hel, B/U reanimator), Sunwell Ledger (Aine, G/W lifegain value),
Mirror-Blood Rush (Elizabeth, B/R Dreaded aggro), and Sable Warballad
(Warrior-Ballad Captain, R/W Warrior tribal) sell for 750g each. This is
deliberately above `ECONOMY.preconPrice` at 500g because singleton density
grants roughly 80 unique cards; progression impact is re-measured before
release promotion. The paid path shares normal precon purchase idempotence:
it grants no strange duplicate payload and never recreates an owned deck.

## Owner-locked 2026-08-01 command-zone respec

This section supersedes every earlier in-deck Darling statement in this plan.

- A Darlings deck contains exactly **79 singleton spells** and no lands. Its owned legendary-creature `darlingId` is outside `cards`; the Warchest remains exactly 10 lands.
- Each seat starts with its Darling in a public command zone. Cast her at normal creature timing for printed cost plus `DARLING_TAX_STEP = 2` per prior destroy or Sever return.
- During a legal main phase, pay `DARLING_PAYDOWN_COST = 4` to reduce the tax by `DARLING_PAYDOWN_REDUCTION = 2`. The deliberately inefficient 2:1 exchange is a tuning valve, not a discount on printed cost.
- Destroy and Sever return the Darling to her command zone and increase tax. Recall returns her there without tax and without a death event. The public view, replay v5, AI action menu, and DuelScene all route through those engine events.
- Builder presentation keeps the Darling in a dedicated slot above the spell list. The duel shows one compact zone card beside each portrait; the human card uses the existing cast target and mana-plan flow, while the opponent card is display-only. A `+2`-style chip appears whenever tax is nonzero.
- SaveData v26 removes any legacy in-deck copy together with its positional pin, leaves `SavedDeck` fields unchanged, and defaults `darlingsTutorialSeen` to `false`. The first Darlings builder or Practice entry explains the format once and links to the glossary.

The former 80-card, shuffled-Darling design is historical rationale only. It is not a legal deck shape, a migration target, or a DuelScene routing model.

## Non-goals

Release 1.5.5 does not add damage tracked by source, multiplayer politics, a separate life total, or a fixed rival roster before the current card pool has been audited. It does not rebalance ordinary Constructed merely to make a Darlings matchup work.

## Player-facing spec

The deck builder gains a format switch with `Constructed` and `Darlings`. Starting a Darlings deck opens a picker containing owned legendary creatures. The selected portrait stays visible in a dedicated slot above the spell list and is never inserted into that list.

The rules panel uses this copy:

> Choose your Darling. She waits in her own zone, ready when you call. Build a 79-card deck in her colors, one copy of each card, and a Warchest of 10 lands. Each time she falls, her next call costs 2 more.

Eligibility and legality are exact:

- The Darling must be an owned `creature` with the `legendary` supertype.
- The 79 spell cards exclude the Darling and contain no lands (lands live in the reserve; see [plan-battle-box.md](plan-battle-box.md)).
- Every card appears at most once.
- Every colored card must use only colors present on the Darling. A colorless Darling permits only colorless non-land cards plus basic lands unless the user selects a different policy in the open decisions below.
- The selected Darling is stored as `darlingId`, outside `cards`, when the deck is saved or queued.
- A defeated or Severed Darling returns to her command zone and adds 2 to her next call. Recall returns her there without adding tax.

Deck rows display a `Darlings` badge and the Darling portrait. Invalid decks remain editable but cannot enter a duel. Errors name the broken rule directly, for example `Choose a Darling before playing` or `Moonlit Envoy is outside your Darling's colors.` The duel header uses the selected portrait through the existing deck-face precedence, but the ordinary per-deck hero art control remains available to Constructed decks only unless the player deliberately chooses otherwise.

## System touchpoints

### Engine

The command-zone engine owns initial placement, return routing, tax, cast legality, pay-down, replay events, and public-view fields. The Battle Box reserve engine remains specified by [plan-battle-box.md](plan-battle-box.md). Engine purity and seeded determinism remain unchanged.

### Meta, save, and economy

`src/meta/DeckStorage.ts` owns pure format-aware validation. It validates ownership, token exclusion, one-copy limits, external Darling identity, legendary-creature eligibility, fetch-land exclusion, and color containment without importing Phaser or browser APIs. `src/meta/deckFace.ts` resolves the external Darling portrait ahead of ordinary hero fallback only for a Darlings deck. `src/meta/SaveManager.ts` owns the v26 migration and normalization.

Darlings uses the same collection and has no separate entry fee, rewards, or packs in 1.5. If a curated Darlings challenge grants rewards later, that economy surface needs its own idempotent claim state and progression simulation before landing.

### AI

The redacted public view exposes the command zone, tax, and legal actions; the brains continue to read only that view. Curated rival decks still need to be pilotable by the existing heuristic and rollout brains. Any future AI personality keyed to a Darling must be selected outside hidden state and passed as existing public configuration.

### UI scenes

`src/scenes/DeckBuilderScene.ts` owns the format switch, external Darling picker, legality copy, and dedicated portrait slot. `src/scenes/DuelScene.ts` renders each public command zone and routes player interaction through existing cast targeting and mana-plan primitives; it must not fork game rules. Shared portrait, card-thumb, and modal primitives are reused rather than cloned.

### Tooling and invariants

Add pure legality tests beside `src/meta/DeckStorage.test.ts`, migration tests beside `src/meta/SaveManager.test.ts`, and a deterministic duel smoke test using representative legal Darlings decks. A roster generator or checker may live under `scripts/` if curated rivals ship, but its output remains data reviewed into the repo. No `src/engine`, `src/ai`, `src/data`, `src/meta`, or `src/config` module may import Phaser or a browser API; AI keeps reading only `PlayerView`; tests do not import Phaser; deterministic outcomes stay fixed for a seed; balance floors only ratchet upward from newly measured evidence.

## Save-schema impact

Add these exact fields to every `SavedDeck`:

```ts
format: 'constructed' | 'darlings' | 'battlebox';
darlingId: string | null;
landReserve: string[] | null;
```

(`battlebox` and `landReserve` added by the 2026-07-28 respec; see [plan-battle-box.md](plan-battle-box.md).)

The format fields arrived in earlier schema work. The command-zone respec makes one atomic `v25 -> v26` migration: remove a Darlings deck's legacy in-list Darling and its positional pin, retain the external `darlingId`, and initialize `darlingsTutorialSeen` to `false`. Normalization keeps the Darling external, coerces malformed tutorial values to `false`, and never guesses a Darling from `heroCardId`. Migration tests cover the legacy list, malformed current fields, pins, and the active-deck invariant.

## AI and balance impact

The brains do not learn a new action. They do need evaluation against the singleton-shaped lists, where redundant effects and curve stability differ from Constructed. Curated player and opponent lists are gated by:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

The first command protects avatar behavior across the current field; the second protects the existing floor gates. The former 80-card Darlings fixture baseline is historical only and must be remeasured at the 79-spell command-zone shape before it is promoted as a balance result. A curated rival roster still requires its own measured baseline with an acceptable band before it can be called balanced; promote floors only from dated retained results. Run the progression simulator only if rewards, products, or collection access change. Run the metagame sweep as an informational diversity probe after Darlings deck-construction constraints are added to the shared craft core.

## Phased implementation plan

### Wave 1: format model and legality

Add the deck fields, migration, normalizer, and pure validator. Ship no UI entry yet. Verification: focused DeckStorage and SaveManager unit tests, then typecheck/build, full Vitest, lint, and doc checks. A seed-fixed headless game using a legal list must match an ordinary game initialized with the same cards.

### Wave 2: deck-builder and launch flow

Add the format switch, picker, badges, inline legality, and deck-face precedence. The wave is independently useful because players can build, save, copy, select, and duel with their own lists even without a curated roster. Verification: scene-level pure helper tests, production build, full Vitest, lint, and a manual 1280x720 plus narrow-landscape interaction pass. Confirm every drafted player-facing string contains no em dash.

### Wave 3: curated opponents and measured gate

Author a small roster only after auditing current eligible legends and color coverage. Add the Darlings matrix mode, publish a dated baseline, and tune data rather than adding engine exceptions. Verification: roster schema/legality tests, deterministic replay round-trip, avatar and floor matrices, the new Darlings matrix, build, full Vitest, lint, and docs. This wave may move to a later point release without blocking player-owned Darlings decks.

## Open decisions for the user

- **Colorless Darling policy:** allow only colorless non-land cards, or let the player choose one color. **Recommendation:** strict colorless identity; add a purpose-built colorless roster instead of an undocumented exception.
- **Launch scope:** player-built format only, or player-built plus curated rival ladder. **Recommendation:** ship player-built duels in Wave 2 and require measured evidence before promising a rival ladder.
- **Portrait behavior:** lock a Darlings deck's portrait to its Darling, or permit separate hero art. **Recommendation:** lock it to the Darling so the format remains legible everywhere.
- **Format crossover:** allow a Darlings deck in all existing practice rows, or expose a dedicated row. **Recommendation:** a dedicated Darlings row that rejects Constructed decks and records the format in replays.

## Risks and dependencies

The largest product risk is promising the old document's roster before the live pool is re-audited. Singleton legality can also expose thin color pairs and AI decks with inconsistent curves. The save migration must compose with `docs/plan-variant-decks.md` in one 1.5 schema step. Replay metadata and share behavior depend on `docs/plan-player-replays.md`. Suggested list generation depends on `docs/plan-suggested-decks.md` learning the format constraint. Core Set II's Oath composition depends on the Darling identity decision in `docs/plan-core-set-2.md`. No implementation should merge the historical commander-naming draft; this document is the naming and feature authority.

## Acceptance criteria

- Every existing v22 deck migrates to a legal-to-edit Constructed deck with no card, art, or active-deck loss.
- A Darlings deck is accepted if and only if it has exactly 79 cards, excludes its owned legendary-creature Darling from the spell list, respects color containment, owns every non-basic copy, contains no tokens, and has at most one of each card.
- A Darlings replay renders public command-zone returns, tax, cast cost, and legal pay-down action without changing the engine's replay routing.
- A v25 80-card Darlings save migrates to 79 spells plus the same external `darlingId`, preserving all surviving positional pins and defaulting the tutorial flag to false.
- The same deck list and seed produce the same engine result regardless of `SavedDeck.format` metadata.
- Save, copy, rename, delete, select, export, and replay entry preserve `format` and `darlingId` correctly.
- AI still receives only `PlayerView`, and no engine or meta purity boundary changes.
- The Darlings UI is navigable at the supported desktop and mobile-landscape profiles with no clipped legality copy.
- Any curated roster has a dated, checked-in `TO MEASURE` replacement baseline and no existing balance floor is lowered.
