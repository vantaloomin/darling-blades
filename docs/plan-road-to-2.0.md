<!-- source-of-truth: docs/plan-expansion-slate.md, docs/roadmap.md, docs/plan-1.6.md, docs/plan-mobile-overhaul.md, docs/plan-accessibility-i18n.md, docs/plan-story-mode.md, docs/plan-save-cards.md, src/engine/types.ts · last-verified: 2026-08-24 · program doc — the release spine from 1.7 to 2.0; re-verify when a release closes or the slate moves -->

# Road to 2.0

The release spine from 1.7 onward, agreed 2026-08-24. It supersedes the
release-slot column in [plan-expansion-slate.md](plan-expansion-slate.md) (the
mechanic recommendations there are unchanged and still authoritative) and
[plan-road-to-1.0.md](plan-road-to-1.0.md), which closed at 1.0.

**This is a spine, not a contract.** Set concepts and mechanics are chosen;
scope per release is not locked until that release opens.

## Cadence

Expansions alternate **Large / Small / Large**, with **Large on even patches**:

- **Large (1.8, 2.0):** 250+ cards, plus **one new technical feature** at the
  level of "creatures can tap for something other than attacking". A Large set
  is roughly a whole release on its own; Duat was 245 cards and consumed the
  entire 1.6 train including its art run. Large releases carry the set, the
  engine feature, and little else.
- **Small (1.7, 1.9):** ~150 cards with new card mechanics but no engine
  feature. Small releases are where the non-card headline features fit.

## The spine

| | Set | Mechanics | Engine feature | Non-card headline |
| --- | --- | --- | --- | --- |
| **1.7** | **Starborne** (sci-fi) · Small ~150 | Propagate | none | Debt and measurement |
| **1.8** | **Drowned Deep** (cosmic horror) · Large 250+ | Whispers | **Activated abilities with tap costs** | Land economy treatment |
| **1.9** | **First Dawn** (prehistoric) · Small ~150 | Provoked, Hunt | none | Accessibility + Mobile |
| **2.0** | **Core Set II** (RoTK / Greek / Beastkin) · Large 250+ | The Mandate | Shared game state | Story Mode |
| **2.1+** | **Brass Court** (steampunk) · Large | Salvage, Contraption thresholds, Union rigs | — | Cloud saves, UGC, replay coaching |

Five remaining concepts, four slots to 2.0. The slate already anticipated this
("five concepts, four slots — one falls past 2.0") and nominated steampunk;
that nomination stands, helped by Union rigs wanting the 1.8 tap-ability work
to exist first.

Every set already has an overplanned candidate pool in
`docs/expansions/drafts/` (200 drafted cards for Starborne, and equivalents for
brass-court, core-set-2, drowned-deep, first-dawn). A Small set is a cut-down
from ~200 to ~150, not a blank page.

## Why this order

Four constraints did the sequencing. None of them is a preference.

**1. The optimizer sweep gets more expensive every release.** It measured ~37h
for the default 4 rounds at 1,079 cards (2026-08-23, stopped 3h in). Every set
widens the craft space it searches, and until it runs, every balance number
after it is provisional. Running it at 1.7 costs materially less than at 2.0.
This is the strongest single argument for a debt-first 1.7.

**2. Accessibility must precede Story Mode.**
[plan-accessibility-i18n.md](plan-accessibility-i18n.md) names Story Mode as its
deadline driver: Story Mode multiplies authored text, and i18n turns shipped
keys into compatibility contracts. Shipping Story Mode first means retrofitting
keys across a campaign's worth of prose. Accessibility lands 1.9, Story Mode
2.0.

**3. Tap-abilities ship before the set that leans hardest on them.** Steampunk's
Union rigs and contraptions are the mechanics most dependent on activated
abilities. Building the capability at 1.8 and the set at 2.1 means the set is
designed against a shipped feature rather than co-developed with one. It also
unlocks the artifact design space the slate records as currently blocked:
Fogbell Chime sat parked for months precisely because artifacts carry no
targeted or activated abilities.

**4. A Large set is a release.** See Cadence above. This is why 1.8 and 2.0
carry almost nothing besides their set and engine feature, and why the UI-wide
passes cluster on 1.9.

## The 1.8 fork, closed

**Owner decision 2026-08-24: Drowned Deep (cosmic horror) is the 1.8 Large**,
and Brass Court stays at 2.1. The reasoning that carried it: Whispers closes an
existing loop, because Dark Tales shipped a discard engine with no discard
payoff and Whispers retro-synergises with Skim across the shared pool.

Tap-abilities remain the 1.8 engine feature and are deliberately
**set-agnostic**. They are not a steampunk mechanic; they are a capability every
later set draws on, and building them at 1.8 means Brass Court is designed
against a shipped feature rather than co-developed with one.

Art lead time for Drowned Deep starts from this decision.

## Load risk

**1.9 is the heaviest release here**: a set plus two full-scene UI passes.
Accessibility and Mobile are paired deliberately — both sweep every scene for
reflow and both touch the same layout code, so splitting them means two complete
sweeps of the same surface. If 1.9 has to shed weight, **move Mobile to 2.1**.
Accessibility cannot move; Story Mode is waiting on it.

**2.0 is second heaviest**: Core Set II, The Mandate, and Story Mode. If it needs
relief, Story Mode is the separable piece — nothing else depends on it.

## 1.7 in detail

The release that would open next.

- **Starborne**, ~150 cards cut from the 200-card overplan, on Propagate.
- **The optimizer sweep**, run early, and the collection-dilution ruling it
  unblocks (deferred twice: 2026-08-22, and again when the sweep did not run).
- **Draft's reserve-native design** — open decision carried from 1.6.
- **Cheap debts**, all small:
  - A converter legal-target detector. `convertAvatarReserveDecks` keeps a card
    if it is an eligible spell and never checks it has legal targets in the
    format, which shipped four blank cards into 100% of Anubis's games.
  - Release-page automation. `release.yml` sets no `body:`, so v1.6.2 and v1.6.3
    both took notes generated from PR titles alone. Deliberately not touched
    during a cut because it is an untested change to a tag-triggered workflow.
  - The multiplayer correction (below).
  - Remove the vestigial `cosmetics.cardBack` / `cosmetics.playmat` fields; only
    `owned` is still read, by the unlock plumbing.
- **Save cards** ([plan-save-cards.md](plan-save-cards.md)) and **share replay
  codes** — same codec family, sensible to do together.

## The sweep measured a retired format (finding, 2026-08-25)

Found while sizing worker counts, before the sweep was launched.
`scripts/personas/craft.ts` was still measuring **classic** - the format retired
2026-08-10 and replaced game-wide by Warchest in 1.6. Three independent causes,
all in one harness:

- `referenceComposition` built its columns from `DeckList.cards`, the field
  commented `// 60 cardIds - classic`, rather than `reserveCards`/`landReserve`.
- The measure worker called `playOut` with no `format` and no `landReserves`,
  which is the branch that silently constructs a classic game.
- The crafted decks were 60-card classic lists with basics allocated inside
  them, which a Warchest game rejects outright.

This is the `runAvatarMatrix` failure repeating. The reserve migration
enumerated "all four balance-matrix harnesses"; the persona harness is a fifth
one that was never on that list, and `plan-1.6.md` even scheduled the sweep
"once the reserve field stabilizes" without anyone migrating it.

**Cost avoided:** ~37h of compute measuring a dead format, and the
collection-dilution ruling - which is deferred pending this sweep - would have
been decided on it.

The harness is now reserve-native: 40-card landless decks plus a ten-land
reserve built by the same `buildLandReserve` the reserve matrices use, persona
templates rescaled to `persona-v2.0.0`, and a hard refusal to measure without a
reserve rather than a silent classic fallback. **Retained pre-migration
artifacts are non-comparable** and `--check` now rejects them by name.

## Propagate needs a seeding layer (finding, 2026-08-24)

Propagate adds a mark to every already-marked permanent you control. It creates
nothing, so its value is a function of how many marked permanents exist when it
resolves. **The current pool barely produces any.**

Measured across all 1,079 collectible cards: **13 cards** use the `addCounters`
op, and **10 of those mark only themselves**. Exactly three can put a mark on
another creature (Nurture, Imperial Jade Seal, Tithe of Seasons). Nine Lives
produces a mark on 30 cards, but only after that creature has died, and only
once.

So a mid-game Propagate in today's pool typically finds one marked permanent or
none, making it a blank or a strictly worse "+1/+1 to this creature". The
Starborne draft has the same gap internally: 19 Propagate mentions, payoffs that
read marks (`Burning Hull Runner`, `Signal Cathedral` wanting five or more), and
essentially no generators — the one card that adds a fresh mark
(`sb-hullwake-feast`) is tagged `stretch` and is itself gated on already
controlling a marked permanent.

**Concretion must add cheap commons that arrive with a mark**, on themselves or
a friend, so Propagate finds three or four bodies rather than one. This is the
job Duat did for Rite when it shipped the sacrifice fodder the mechanic needed.

### Wording, pinned (owner decision 2026-08-24)

**Propagate: put another mark on each marked permanent you control.**

The narrower "you control" wording wins over the slate's broader "every marked
permanent". With marks this scarce, letting Propagate hit opposing permanents
does nothing useful and adds a targeting decision the AI has to get right. This
is the wording every Starborne card, rules entry, and glossary term is written
against; `docs/rules.md` and the card data are the source of truth for the final
phrasing, never this doc's shorthand. Shorthand mismatches between a plan doc
and the rules are how two wrong Duat mechanic descriptions reached production.

## Feature placement

Every Road-to-2.0 feature, and where it lands.

| Feature | Status | Placement |
| --- | --- | --- |
| Expansions | 2 of 7 shipped (Yokai Nights, Sands of the Duat) | 1.7, 1.8, 1.9, 2.0, 2.1 |
| Darling Mode | **Shipped 1.5.5** | — |
| Variant decks | **Shipped** (`SavedDeck.variantPins`) | — |
| Save codes | **Shipped** (`src/meta/SaveCode.ts`) | — |
| Save cards (PNG) | Codec on main (`src/meta/SaveImage.ts`, 16 tests), UI not | 1.7 |
| Share replay codes | Spec'd, no code | 1.7 |
| Accessibility / i18n | Partial (settings ship) | 1.9 |
| Mobile rebuild | Spec'd | 1.9 (valve: 2.1) |
| AI suggested decks | Spec'd, no code | 1.9 |
| Story Mode | Spec'd, no code | 2.0 |
| AI replay coaching | Spec'd, no code | 2.1 |
| Cloud saves / accounts | **No spec, no code** | 2.1, spec first |
| UGC / mods | Spec'd, no code | 2.1 |
| Multiplayer | **CANCELLED** | — |

**Cloud saves is the only item with neither a plan doc nor code**, and the only
one forcing questions nothing else here does: identity, a server, conflict
resolution. It needs a spec written before it can be scheduled, which is why it
sits at 2.1 rather than carrying a false estimate.

## Multiplayer is cancelled

Owner decision 2026-08-24. [plan-multiplayer.md](plan-multiplayer.md) is
retained as a design record and marked cancelled at its head; nothing should be
planned against it.

The README promised LAN multiplayer in two places and has been corrected. That
mattered: a promise in shipped copy that will not be kept is the same failure
mode as the 1.6.1 migration claim, which a player found false in under a day.
