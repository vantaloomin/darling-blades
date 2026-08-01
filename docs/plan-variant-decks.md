<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, src/meta/variants.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/meta/Collection.ts, src/engine/types.ts, src/engine/Game.ts, src/engine/view.ts, src/scenes/DeckBuilderScene.ts, src/scenes/DuelScene.ts, src/scenes/CollectionScene.ts, src/ui/CardView.ts · last-verified: 2026-07-31 · historical design/plan doc - re-verify when the referenced code changes -->

# Historical per-slot variant deck implementation plan

> Superseded by the 2026-07-31 collection-level display-pin rework. SaveData
> v25 retains positional `variantPins` for compatibility, but they no longer
> choose any rendered treatment. One collection pin per card now resolves every
> display, otherwise the existing best-owned resolver picks the rarest owned
> treatment. Deck lists collapse to one row per card.

## Goal

Release 1.5 lets a player pin an owned frame, holo, and treatment to each card slot in a saved deck, then see those exact copies throughout a duel. The design treats presentation identity as part of a physical deck slot while preserving rules identity as `cardId`. It also establishes one serialization path that can be reused by Darlings, save codes, and replays.

## Non-goals

This release does not make variants affect rules, AI value, shuffling odds, matchmaking, or card ownership totals. It does not allow one owned variant copy to occupy more simultaneous deck slots than the player owns. It does not require the engine to understand rarity or rendering, and it does not guarantee a no-engine implementation before the card-instance spike proves that such an implementation remains deterministic and replay-safe.

## Player-facing spec

Each card row in the deck builder gains a `Choose look` action when the player owns more than one treatment. The picker shows only owned variants and the number of copies still available for this deck. Adding a card uses an unassigned slot first. If a preferred look is unavailable, the slot stays on `Auto` rather than borrowing a copy the player does not own.

Player copy:

> Choose the exact look for this copy. Auto uses your best available treatment when the duel begins.

The deck list groups equal card names for counting but exposes individual slots when their looks differ. Removing a slot removes that slot's pin. Sorting, filtering, and renaming never move a pin to a different card. Copying a deck copies its pins; the copy still must validate against the same collection, because two saved lists may reference the same owned cards but only one deck is played at a time.

During a duel, the pinned treatment follows that physical card through deck, hand, stack, battlefield, graveyard, Severed zone, Foresee, Skim, Retell, and replay reconstruction. A token uses its generated/default treatment unless a future token-art design says otherwise. The opponent sees the treatment only when the underlying card is public; a face-down or hidden card must not leak its identity through a treatment key.

## System touchpoints

### Engine

Current zones and game objects primarily carry `cardId` strings. That is insufficient to distinguish two copies of the same card with different pins once shuffling and zone changes begin. Wave 1 must spike a pure rules-neutral identity shape:

```ts
interface CardInstance {
  instanceId: number;
  cardId: string;
  variantKey: string | null;
}
```

The recommended implementation assigns stable instance IDs during `Game` construction and moves instances, not parallel arrays, through every zone. `variantKey` is opaque presentation metadata validated before game start; rules lookup still uses `cardId`. `Permanent`, `StackItem`, decisions, events, snapshots, and clone/restore paths must carry enough identity to preserve the same instance. Any compatibility input accepting `string[]` normalizes to instances with `variantKey: null`. Do not keep a second variant array beside each zone; parallel arrays will drift on Foresee, Sever, random discard, fetch-and-shuffle, and Retell.

This is an engine data-shape change, so purity and seeded determinism are mandatory. Variant keys must never enter action enumeration, target legality, AI scoring, or RNG calls. If the spike cannot prove stable movement across every zone and replay, stop before UI work and revise the model.

### Meta, save, and economy

`src/meta/variants.ts` remains the canonical parser, canonical key generator, and ranker for the current `(frame, holo, fullArt)` axes. `src/meta/DeckStorage.ts` owns pair-preserving mutations and validation against `src/meta/Collection.ts`. The validation invariant is: for each card and variant key, the number of pinned slots does not exceed `collectionVariants[cardId][variantKey]`; unpinned slots plus pinned slots do not exceed aggregate collection ownership for non-basic cards.

Variant pins have no price and do not consume or reserve collection copies. Selling/sharding must revalidate affected saved decks and turn now-unowned pins into `Auto`, with a clear summary, rather than block the economy action or leave an impossible pin. The user must decide that policy below.

### AI

`src/engine/view.ts` continues to expose rules identity only where the card is visible. If public view objects carry `variantKey`, the AI type must either omit it or ignore it structurally. Opponent hidden zones expose neither `cardId` nor treatment. Add an invariant test showing that two games differing only in variant keys produce identical legal actions, AI choices, RNG progression, and result.

### UI scenes

`src/scenes/DeckBuilderScene.ts` owns per-slot editing and remaining-owned counts. `src/scenes/DuelScene.ts` resolves each public instance to `CardView` using the attached treatment instead of globally calling `bestOwnedVariant`. Hand, stack, battlefield, history, graveyard, Sever, Foresee, and replay surfaces need a shared resolver; ad hoc scene maps are forbidden. `src/scenes/CollectionScene.ts` remains the ownership surface and should link into a filtered deck-slot picker only if that navigation is already safe.

### Tooling and invariants

Add a deterministic instance-transition test matrix covering draw, mulligan, discard, cast, counter, destroy, bounce, Foresee, Skim, Sever, Retell, fetch land, shuffle, token creation, replay, and any decision snapshot/restore. Add save normalization tests for malformed keys, over-pinning, deck copy, slot removal, and collection changes. Rendering proof tooling should include two copies of one card with different variants in multiple zones. No Phaser enters engine/tests; the AI still reads only redacted `PlayerView`; the seed controls rules randomness only; save changes use a version, `migrate()`, and tests.

## Save-schema impact

Add this exact field to `SavedDeck`:

```ts
variantPins: Array<string | null>;
```

`variantPins[i]` belongs to `cards[i]`; `null` means `Auto`. The two arrays must always have equal length, and every deck mutation must splice, sort, clone, and persist them as pairs. A version bump is required. If Darlings lands in the same 1.5 train, one atomic `v22 -> v23` migration also adds `format` and `darlingId` from `docs/plan-darlings.md`. The variant migration fills an array of `null` with `cards.length` entries. Normalization canonicalizes keys through `parseVariantKey` plus `variantKey`, replaces unknown or over-owned pins with `null`, trims excess entries, and pads missing entries. Migration tests prove no `cards` reorder.

This positional schema is deliberately simple for export and editing. If the engine spike concludes that stable authored slot IDs are required across arbitrary reorder operations, replace it before shipping with `slots: Array<{ cardId: string; variantKey: string | null }>` and migrate once. Do not ship both representations.

## AI and balance impact

Brains learn nothing new because variants have no rules value. The key gate is equivalence, not win rate: for a fixed pair of decks, seed, and AI settings, plain and fully pinned inputs must yield the same action log and result after treatment fields are projected away.

Run the existing behavioral gates after the engine data-shape change:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

No progression or metagame rerun is required if pins are free and ownership totals are unchanged. If sharding policy, pack odds, or variant valuation changes, the impact is `TO MEASURE` with `npx tsx scripts/progression-sim.ts --seeds 8 --days 60` and an explicitly documented variant scenario. The metagame sweep's measured 4.61x worker speedup does not validate this feature and must not be cited as such.

## Phased implementation plan

### Wave 1: card-instance spike

Implement the smallest pure prototype on a branch: normalize deck entries, shuffle instances, and carry identity through all current zones and replay snapshots. Add equivalence and transition tests. Verification: focused engine tests, replay tests, full Vitest, typecheck/build, lint. Exit only if action logs and outcomes are identical after removing presentation fields. If not, record the failing operations and stop the feature for redesign.

### Wave 2: schema and deck operations

Land the chosen save representation, migration, validator, and pair-preserving DeckStorage helpers. No duel UI is needed yet. Verification: SaveManager/DeckStorage/Collection tests, malformed-save fixtures, property-style add/remove/reorder/copy sequences, full Vitest, build, lint, and docs.

### Wave 3: picker and end-to-end rendering

Add the deck-slot picker and the single shared public-instance resolver across Duel and replay surfaces. Verification: UI helper tests, rendering proof sheets for repeated IDs with different treatments, seed-fixed replay round-trip, full Vitest, build, lint, and a manual zone-by-zone visual pass at desktop and narrow landscape sizes.

## Open decisions for the user

- **Storage shape:** parallel positional `variantPins`, or replace `cards` with authored slot objects. **Recommendation:** use positional pins only if Wave 1 and mutation tests prove pairing is airtight; otherwise migrate directly to slot objects.
- **Auto behavior:** choose the best currently owned treatment at duel start, or always render plain. **Recommendation:** best currently owned, resolved deterministically without consuming inventory.
- **After sharding a pinned copy:** clear affected pins to Auto, block the shard, or preserve an invalid deck. **Recommendation:** clear the minimum number of pins to Auto and show a summary before confirmation.
- **Opponent presentation:** preserve authored variants in curated AI decks, or use automatic treatments. **Recommendation:** permit data-authored pins for showcase rivals, with no balance meaning.

## Risks and dependencies

The engine currently lacks physical card identity in its string-array zones. That makes this more than a deck-builder preference and is the plan's principal uncertainty. Missing one transition can silently swap art, leak a hidden identity, or make replay output drift. The schema bump must be combined with `docs/plan-darlings.md`. `docs/plan-save-portability.md` must serialize the final representation, and `docs/plan-player-replays.md` must include presentation identity without relaxing database compatibility. Mobile picker layout depends on `docs/plan-mobile-overhaul.md`. Mod variant validation later depends on `docs/plan-mod-ugc.md` being rebased to the live three-axis model.

## Acceptance criteria

- A deck can pin two different owned variants of the same card to two distinct slots and render both correctly through every public zone.
- No save or deck mutation separates a pin from its card, and malformed or over-owned pins normalize safely.
- Hidden zones reveal no card or treatment information through `PlayerView`, events, UI placeholders, or replay/spectator payloads.
- Plain and pinned decks produce identical rules action logs, AI decisions, RNG consumption, and results for the same seeds.
- Old saves migrate with every existing deck card in the same order and every new pin set to `null`.
- Replays preserve treatments when compatible and fail closed under the established replay-version/database-stamp rules.
- The UI never offers more pinned copies of a treatment than the collection owns.
