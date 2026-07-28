<!-- source-of-truth: docs/roadmap.md, docs/plan-commander-mode.md, docs/plan-expansion-slate.md, src/config/rules.ts, src/data/cardTypes.ts, src/data/catalog.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/meta/deckFace.ts, src/scenes/DeckBuilderScene.ts, src/scenes/DuelScene.ts, src/engine/view.ts, scripts/balance-matrix.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Darlings format implementation plan

## Goal

Release 1.5 ships Darlings as a first-class, single-player deckbuilding format. A player chooses one legendary creature as their Darling, builds a 50-card all-spell deck with no more than one copy of each card, and plays it with a Battle Box land reserve. The selected Darling is part of the shuffled deck, not a new zone or guaranteed opening card. This document supersedes the implementation direction in `docs/plan-commander-mode.md`; that older document remains useful as historical rationale and must not be copied into a second roster specification.

**RESPEC 2026-07-28 (user decision — increased 1.5 scope):** Darlings adopts the Battle Box mana system specified in [plan-battle-box.md](plan-battle-box.md). The deck is **50 cards including the Darling, with zero in-deck lands**; beside it the player builds a per-deck land reserve (10 lands, max 5 duals, duals tapped, asymmetric destruction). Everything in this document about a 60-card deck, in-deck basic lands, or "basics are unlimited in the deck" is superseded by that shape; basics now live only in the reserve. The "no engine change" property this document claimed as its chief risk control is knowingly traded away — the reserve is engine surface, owned by plan-battle-box.md. All other rules here (Darling eligibility, singleton, strict colorless identity, color containment, portrait lock, dedicated practice row, player-built-only launch) stand as locked.

## Non-goals

Release 1.5 does not add a special outside-the-deck zone, escalating recast costs, damage tracked by source, multiplayer politics, a separate life total, or guaranteed access to the Darling. It does not promise a fixed rival roster before the current card pool has been audited, and it does not rebalance ordinary Constructed merely to make a Darlings matchup work.

## Player-facing spec

The deck builder gains a format switch with `Constructed` and `Darlings`. Starting a Darlings deck opens a picker containing owned legendary creatures. The selected portrait stays visible beside the deck name, and the card is inserted into the deck if it is not already present.

The rules panel uses this copy:

> Choose your Darling. Build a 50-card deck in her colors, one copy of each card, and a land reserve of 10. Your Darling begins in your deck and follows the same rules as every other card.

Eligibility and legality are exact:

- The Darling must be an owned `creature` with the `legendary` supertype.
- The 50 cards include the Darling and contain no lands (lands live in the reserve; see [plan-battle-box.md](plan-battle-box.md)).
- Every card appears at most once.
- Every colored card must use only colors present on the Darling. A colorless Darling permits only colorless non-land cards plus basic lands unless the user selects a different policy in the open decisions below.
- The selected Darling must still be present when the deck is saved or queued.
- A defeated or Severed Darling goes to the normal destination. It receives no special return rule.

Deck rows display a `Darlings` badge and the Darling portrait. Invalid decks remain editable but cannot enter a duel. Errors name the broken rule directly, for example `Choose a Darling before playing` or `Moonlit Envoy is outside your Darling's colors.` The duel header uses the selected portrait through the existing deck-face precedence, but the ordinary per-deck hero art control remains available to Constructed decks only unless the player deliberately chooses otherwise.

## System touchpoints

### Engine

**Superseded 2026-07-28:** the format now requires the Battle Box reserve engine (zone, play-land path, destruction routing, AI land policy) specified and owned by [plan-battle-box.md](plan-battle-box.md). Within Darlings itself the original claim still holds — the Darling is ordinary deck data once a duel begins, and no Darlings-specific engine branch exists. Engine purity and seeded determinism remain unchanged.

### Meta, save, and economy

`src/meta/DeckStorage.ts` gains a pure `validateDarlingsDeck(db, save, deck)` function and format-aware save/copy normalization. It must validate ownership, token exclusion, one-copy limits, Darling membership, legendary-creature eligibility, and color containment without importing Phaser or browser APIs. `src/meta/deckFace.ts` resolves the Darling portrait ahead of ordinary hero fallback only for a Darlings deck. `src/meta/SaveManager.ts` owns migration and normalization.

Darlings uses the same collection and has no separate entry fee, rewards, or packs in 1.5. If a curated Darlings challenge grants rewards later, that economy surface needs its own idempotent claim state and progression simulation before landing.

### AI

`src/engine/view.ts`, the redacted view contract, and the brains need no format-only field because play rules are unchanged after deck construction. Curated rival decks still need to be pilotable by the existing heuristic and rollout brains. Any future AI personality keyed to a Darling must be selected outside the hidden state and passed as existing public configuration, never inferred by reading a full opposing deck.

### UI scenes

`src/scenes/DeckBuilderScene.ts` owns the format switch, Darling picker, legality copy, and portrait. The deck selection surface that currently launches duels must filter or label decks by format rather than silently treating a Darlings list as Constructed. `src/scenes/DuelScene.ts` reads format only to select presentation and replay metadata; it must not fork game rules. Shared portrait and card-grid helpers should be reused rather than cloned.

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

A version bump is required. If Darlings and `docs/plan-variant-decks.md` land in the same 1.5 train, make one atomic `v22 -> v23` migration that adds both features' deck fields. Do not create sequential version bumps merely because the work had separate branches. Migration maps every existing deck to `format: 'constructed'` and `darlingId: null`. Normalization coerces an unknown format to `constructed`, clears a Darling that is absent from `cards`, and never guesses a Darling from `heroCardId`. Migration tests cover old saves, malformed new fields, deck copy, deck deletion, and the `activeDeckId` invariant.

## AI and balance impact

The brains do not learn a new action. They do need evaluation against the singleton-shaped lists, where redundant effects and curve stability differ from Constructed. Curated player and opponent lists are gated by:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

The first command protects avatar behavior across the current field; the second protects the existing floor gates. A Darlings-specific matrix is required before a rival roster can be called balanced. Its exact seed count and acceptable band are `TO MEASURE` after the roster exists; add a script mode such as `npx tsx scripts/balance-matrix.ts --darlings --seeds <N>` and promote floors only from dated retained results. Run the progression simulator only if rewards, products, or collection access change. Run the metagame sweep as an informational diversity probe after Darlings deck-construction constraints are added to the shared craft core; the measured 4.61x speedup at 14 workers is a tooling baseline, not a balance result.

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
- A Darlings deck is accepted if and only if it has exactly 60 cards, contains its owned legendary-creature Darling, respects color containment, owns every non-basic copy, contains no tokens, and has at most one of each non-basic card.
- The same deck list and seed produce the same engine result regardless of `SavedDeck.format` metadata.
- Save, copy, rename, delete, select, export, and replay entry preserve `format` and `darlingId` correctly.
- AI still receives only `PlayerView`, and no engine or meta purity boundary changes.
- The Darlings UI is navigable at the supported desktop and mobile-landscape profiles with no clipped legality copy.
- Any curated roster has a dated, checked-in `TO MEASURE` replacement baseline and no existing balance floor is lowered.
