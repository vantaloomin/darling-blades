<!-- source-of-truth: docs/plan-1.5.md, docs/plan-darlings.md, src/engine/types.ts, src/engine/Game.ts, src/engine/actions.ts, src/engine/view.ts, src/meta/DeckStorage.ts, src/meta/SaveManager.ts · last-verified: 2026-07-28 · design/plan doc - re-verify when the referenced code changes -->

# Battle Box mana system implementation plan

## Goal

Release 1.5 replaces drawn lands with a chosen land reserve in its two new
formats. A deck in the Darlings or Battle Box format is 50 spells with zero
in-deck lands; beside it the player builds a land reserve of exactly 10
lands with at most 5 dual lands. Each turn the ordinary land play instead
chooses a land from the reserve. Mana screw and flood do not exist in these
formats; every draw is action, and the 10-land cap bounds the top of the
curve by design.

User decisions locked 2026-07-28 (do not relitigate without the user):

- Deck size in reserve formats is **50 cards** (Darlings: including the
  Darling; singleton for non-basics per plan-darlings.md. Battle Box:
  ordinary Constructed copy limits).
- The reserve is **per-deck and player-built** (not a fixed standard case).
- **Destruction is asymmetric**: a destroyed dual land goes to the
  graveyard and is gone for the game; a destroyed basic land re-enters the
  reserve and may be replayed on a later turn.
- **Dual lands enter play tapped**; basics enter untapped.
- The **land-interaction audit is in scope**: cards that fetch lands from
  the deck are dead in these formats and the validators must handle them.
- Classic **Constructed is untouched** — same decks, same in-deck lands,
  same balance baselines. The reserve exists only in the two new formats.

## Non-goals

This release does not change how Constructed manabases work, does not add
utility or nonbasic-single-color lands to the reserve palette, does not
promise curated rival ladders for either reserve format, and does not
rebalance the classic pool around reserve-format consistency. The reserve
is not a hidden resource and holds no gameplay randomness.

## Player-facing spec

The deck builder's format switch gains `Battle Box` beside `Constructed`
and `Darlings`. Selecting a reserve format shows a land reserve panel next
to the deck list:

> Build your land reserve: 10 lands, up to 5 dual lands. Each turn you
> choose which land to play. Dual lands arrive tapped. If a dual land is
> destroyed it is gone; destroyed basic lands return to your reserve.

Legality is exact:

- The deck is exactly 50 cards and contains no lands.
- The reserve is exactly 10 lands: basic lands and dual lands only, with
  at most 5 duals. Basics are ownership-free as everywhere; dual lands
  must be owned.
- Darlings decks additionally obey every plan-darlings.md rule (Darling
  membership and eligibility, singleton non-basics, color containment),
  and the reserve must sit inside the Darling's colors. A colorless
  Darling's reserve is basics-only unless the colorless roster design
  says otherwise.
- Battle Box decks obey Constructed copy limits (playsets) and ownership;
  reserve colors are unrestricted.
- Cards whose rules fetch a land from the deck are illegal in reserve
  formats, named directly: `Verdant Compass cannot find lands here; your
  lands live in your reserve.` The audit list is produced with the
  validator and maintained as data, not prose.

During a duel the reserve is public: both players' reserves are visible in
a dedicated strip or modal, exactly like graveyards. Playing a land opens
the reserve chooser instead of playing from hand. The turn's land play is
otherwise unchanged (one per turn, main phase). When the reserve is empty
or all 10 lands are deployed, the land play simply stops being offered.

## System touchpoints

### Engine

This is a real engine feature (it removes the Darlings "no engine change"
property recorded in plan-darlings.md; that trade was accepted 2026-07-28):

- A per-player public `landReserve` zone, populated at Game construction
  from the deck payload, ordered and deterministic. If the card-instance
  spike (plan-variant-decks.md Wave 1) lands, the reserve carries
  instances like every other zone; the spike's transition matrix gains
  reserve transitions when this feature lands.
- The play-land action enumerates the reserve instead of hand lands in
  reserve formats. Classic games never construct the zone and take the
  existing path; a format flag on the Game config (public, rules-level)
  selects the behavior. No change to classic replay or legality.
- Entry state: duals arrive tapped, basics untapped (data-driven off the
  land's existing mana ability shape, not a hardcoded list).
- Destruction routing: the dies path branches for lands in reserve
  formats — basic lands return to the reserve instead of the graveyard;
  duals take the normal graveyard path. Sever remains one-way and beats
  the return rule (a severed basic is severed). Bounce/recall of a land
  returns it to the reserve (it was never "spent"), stated in rules copy.
- `PlayerView` exposes both reserves fully (public zone). Replay logs the
  reserve choice; `REPLAY_LOG_VERSION` bumps with a documented rule.
- Determinism is trivial: the reserve is chosen at build time and every
  choice is a logged action.

### Meta, save, and economy

`src/meta/battleBox.ts` (pure) owns the shared reserve validator
(count/duals cap/allowed land types/ownership) and the land-interaction
audit list; `src/meta/darlings.ts` composes it with the singleton rules.
`SavedDeck` gains `landReserve: string[] | null` inside the same atomic
v22 -> v23 migration that adds `format` and `darlingId` and the variant
fields — one bump, one migration, one test matrix. Reserve formats have no
separate economy surface; duals are ordinary collectible cards.

### AI

A shared deterministic land-choice policy (the foresee/scry policy
precedent: one pure module in `src/ai/`, consumed by all three brains)
picks from the reserve: satisfy the mana plan's missing colors first,
prefer playing a tapped dual on turns whose mana is not needed, hold
basics for recovery given the destruction asymmetry. All difficulties use
the policy through `PlayerView`; the reserve being public means no
redaction questions. Pilotability at Easy must stay simple and monotone.

### UI scenes

DeckBuilder: the reserve panel (10 slots, dual counter, inline legality).
DuelScene: the reserve strip/modal + the land-play chooser; the existing
land-style selector applies to basics in the reserve as it does in-deck.
Both reuse existing zone-modal and picker primitives; no new scene.

## Save-schema impact

Rides the atomic v22 -> v23 migration (see plan-darlings.md and
plan-variant-decks.md): existing decks get `landReserve: null`;
normalization drops unknown ids, over-cap duals, and non-land entries,
and null means "not a reserve format". No independent bump.

## AI and balance impact

Reserve formats have no measured baseline yet and ship without one (the
Darlings Wave 3 stance extends to both): player-built duels only. The
classic gates are unaffected but must be proven unaffected — after the
engine lands, the avatar and floor matrices must be byte-identical for
classic games:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

A reserve-format matrix mode is `TO MEASURE` future work alongside any
curated roster. Consistency is a large power-level change by construction;
no classic-pool card changes may be justified by reserve-format results.

## Phased implementation plan

### Wave 1: pure validators and audit list

`src/meta/battleBox.ts` (reserve validator + land-interaction audit data)
and the darlings.ts respec to the 50-card no-lands shape. No engine, no
UI. Verification: focused meta tests, then the full ladder.

### Wave 2: reserve engine

The zone, play-land path, entry/destruction/bounce rules, view, replay
version, AI land policy. Engine-first, seeded tests, classic-path
byte-identity proven (matrices above). Sequenced AFTER the card-instance
spike merges (the zone is built instance-aware once, not migrated later)
and serialized against the Hauntlink engine build (shared files).

### Wave 3: builder and duel UI

Reserve panel, format switch entry, duel reserve strip + chooser, on the
v23 schema. Manual desktop + narrow-landscape pass; no em dash in any
player-facing string.

## Open decisions for the user

- **Reserve visibility:** public to both players (recommended; matches
  the physical format, keeps AI honesty trivial) — LOCKED public unless
  the user objects at review.
- **Colorless Darling reserve:** basics-only (recommended, consistent
  with strict colorless identity) or allow any duals.
- **Dual roster:** which existing lands count as duals for the cap, and
  whether 1.5 needs new dual land cards printed in Yokai Nights to give
  every color pair a reserve option. The audit answers this with data.

## Risks and dependencies

The destruction asymmetry adds a novel rules branch on the dies path;
mass effects and death triggers must not observe a basic's return as a
death. The engine wave depends on the card-instance spike's landing shape
and collides with the Hauntlink build on engine files (serialize). The
v23 migration must land before builder UI. The land-interaction audit
must be complete before either format is offered, or dead cards reach
players. Suggested decks (1.6) must learn the reserve constraint before
recommending lists in these formats.

## Acceptance criteria

- A classic Constructed game is byte-identical to pre-feature behavior
  (matrices reproduce; replays of old logs unaffected).
- Reserve legality is enforced exactly (50/0-lands/10/5-dual/ownership/
  format-specific color rules), with direct plain-language errors.
- Duals enter tapped; destroyed duals reach the graveyard; destroyed
  basics re-enter the reserve and are replayable; severed lands never
  return; bounced lands return to the reserve.
- The reserve is fully visible to both seats; replays reproduce every
  reserve choice byte-identically under the bumped replay version.
- All three AI difficulties play reserve-format games to completion with
  the shared land policy, deterministically per seed.
- The land-interaction audit list is data, tested, and every excluded
  card names the exclusion in the builder.
