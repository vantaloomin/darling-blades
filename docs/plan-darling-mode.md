<!-- source-of-truth: src/config/rules.ts, src/engine/Game.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/data/cards/greek.ts, src/data/cards/tk-wei.ts, src/data/cards/tk-wu.ts, src/data/cards/tk-shu.ts, src/data/cards/tk-jin.ts, src/data/cards/tk-other.ts, src/data/cards/beastkin.ts, src/data/cards/ragnarok.ts, src/data/cards/celtic-fae.ts, src/data/cards/duals.ts, src/meta/deckFace.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/ai/determinize.ts, src/ui/CommanderPortrait.ts, src/scenes/DuelScene.ts, src/ai/personality.ts · last-verified: 2026-07-13 · design/plan doc — re-verify when the referenced code changes -->

# Darling — the Darling Blades legend format

_Formerly "Commander mode" (docs/plan-commander-mode.md, authored 2026-07-05).
Renamed and re-scoped 2026-07-13 by user decision — see the locked table
below. The format adapts MTG Commander/EDH (this provenance line is the one
place the plan names it); everywhere else, in docs, code identifiers, and
player-facing copy, the format is **Darling**, per the
[de-MTG retheme convention](plan-de-mtg-rethemes.md)._

The flagship constructed format: the player **chooses their Darling** — one
legendary creature — and builds a big singleton deck in her colors. _"Choose
your Darling. Her blades follow only her colors."_ A roster of rival Darling
decks provides the opposition, driven by the existing duel/gauntlet plumbing.

## Locked decisions (user, 2026-07-13)

| Decision | Pick |
| --- | --- |
| Format name | **Darling** (the mode); the leader legend is **your Darling** |
| Deck size | **85 cards**, closer to EDH's big-deck feel |
| Copies | **Singleton** non-basics (basics unlimited) |
| Life | Scaled up with the deck — **35 proposed** (EDH's 0.4 life-per-card × 85, rounded); final number set at the balance pass |
| Launch window | **Ships with a future expansion** (the pool needs to grow to support 85-card singleton in every identity) — re-sequenced out of the 1.1 release |
| Command zone | None — the Darling is a real card in the 85 (unchanged from the original plan) |

Earlier locked context that still stands: the format layers into
`src/data`/`src/meta`/`src/scenes` like the Avatar Gauntlet; AI plays it
unchanged through the redacted `PlayerView`; every rule is a pure validator or
a config value.

## The format, concretely

A Darling deck is validated by a **new pure function** `validateDarlingDeck`
(beside `validateDeck` in `src/meta/DeckStorage.ts`), enforcing:

| Rule | Value | Rationale |
| --- | --- | --- |
| Deck size | **85** | EDH-closer scale; see "Engine impact" — deck size is validator-only, the engine takes any list. |
| Darling | **1 named legendary creature**, present as a real card in the 85 | Drawn/cast like any card (no command zone); the legend rule already protects duplicates. |
| Singleton (non-basic, non-Darling) | **max 1 copy** | The highlander texture. Tighter than `RULES.maxCopies` (4). |
| Basics | unlimited | As today (`validateDeck` already exempts basics; see `isBasic`). |
| Color identity | deck cards' `colors` ⊆ the Darling's `colors` (+ colorless) | Keyed to the WUBRG pie already on every `CardDef`. |
| Life | **35 (proposed)** | Scaled with the 60→85 deck growth; tunable at the balance pass. |
| Opening hand | **Your Darling starts in your opening hand (recommended default)** | At 85 cards with no command zone, the natural draw odds no longer deliver the fantasy; a deterministic post-shuffle pull to hand fixes it without a command zone. |

**Color identity check.** Every `CardDef` already carries `colors: Color[]`
(`W`/`U`/`B`/`R`/`G`). The Darling's `colors` define the identity; a card is
legal iff every color in its `colors` is in the Darling's set (colorless cards
and basics always legal; dual taplands have `colors: []` so they are always
legal — see `src/data/cards/duals.ts`). A pure array-subset test, no new data
on cards. The catalog rule "multicolor nonland ⇒ legendary" is why every
2-color legend is a legal 2-color Darling.

**No commander tax.** Each rival deck simply *builds around* its Darling —
ramp, protection, recursion (`so-raise-dead`, `so-rampant-growth`) picked
in-list. With the starts-in-hand default, the Darling is reliably castable on
curve every game.

## Engine impact (honest accounting)

The original plan claimed "zero engine change." Audited 2026-07-13 against the
live code, the true surface is:

- **Deck size: no engine change.** `RULES.deckSize` (`src/config/rules.ts`) is
  consumed only by `DeckStorage.validateDeck` and the DeckBuilder UI counters;
  the engine shuffles whatever list it is given, and the AI's hidden-card
  model infers deck size from seen + hidden counts
  (`src/ai/determinize.ts`). An 85-card format needs only the new pure
  validator plus a DeckBuilder format-mode counter.
- **Starting life: one small pure engine touch.** `Game.ts` reads
  `RULES.startingLife` (20) directly at setup. The format needs an optional
  `startingLife` game-config value defaulting to the constant — deterministic,
  no `PlayerView` shape change, no save impact, but it *is* an engine edit and
  ships with engine tests.
- **Darling-in-opening-hand: one small pure setup option.** A deterministic
  post-shuffle "pull this named card to hand" step in game setup config —
  seeded-deterministic (the shuffle happens first, then the pull), no zone or
  rules change.
- **Flag:** `RULES.turnLimit` may need a format-scoped look — 35-life games
  run longer; measure at the balance pass before touching it.

Everything else respects the `src/engine|ai|data|meta|config` purity boundary
untouched: headless, seeded-deterministic, AI on the redacted view.

## Why these numbers (pool trajectory)

The pool today is **349 collectible cards** (210 base + 69 Ragnarök + 80
Celtic Fae). 85-card singleton in a 2-color identity wants roughly 45–55
distinct on-color nonland playables plus duals/colorless — comfortable for
strong pairs already, but thin for mono-color identities. That is why the
format **launches with a future expansion** (pool ≥ ~430): expansion 3 both
widens every color and supplies fresh marquee legends to headline the mode.
Where a color still runs thin, decks lean on colorless staples
(`ar-terracotta-soldier`, `ar-bronze-colossus`, `ar-imperial-jade-seal`,
`ar-siege-juggernaut`), which are identity-legal everywhere; the escape hatch
of relaxing one deck to "≤2 copies" remains a per-deck knob, not a rule
change.

## Where the decks live: `src/data/darlingDecks.ts`

A new module beside `starterDecks.ts` and `opponents.ts`, reusing the shared
`expand([id, count])` helper already exported from `starterDecks.ts`:

```ts
// src/data/darlingDecks.ts
import { expand, type DeckList } from './starterDecks';

export interface DarlingDeck extends DeckList {
  darlingId: string;     // a legendary creature id present in `cards`
  colors: Color[];       // color identity (mirrors the Darling's colors)
  theme: string;         // e.g. "Wei Aggro-Command"
  blurb: string;         // flavor for the deck-select card
}

export const DARLING_DECKS: readonly DarlingDeck[] = [ /* the roster */ ];

export function darlingDeckById(id: string): DarlingDeck { /* find-or-throw, mirrors avatarById */ }
```

`DeckList`-shaped (`id`, `name`, `cards: string[]`), these feed straight into
`new Game({ decks: [...] })` and into `faceCardFor` for the portrait. A
companion **rival roster** — the decks as `Avatar`-shaped entries (adding
`difficulty`, `personality`, `portraitCardId`) so the exact `DuelScene`
gauntlet plumbing drives them — lives in the same file or in `opponents.ts`
under a new `DARLING_AVATARS` export.

## The rival roster — archetype sketches

_The original plan authored eight full 60-card lists. Those cannot be
meaningfully re-authored to 85 cards against an expansion pool that does not
exist yet, so they are demoted to **archetype sketches**: the commander picks,
identities, and win plans below are the design intent; the actual 85-card
lists are written at implementation (M2) against the launch pool._

Eight sketches carried over (all ids verified in the card files):

1. **Cao Cao — Wei Aggro-Command (W/B).** `tk-wei-caocao`; Wei tribal swarm
   plus a hand-attack engine (lords + `en-banner-of-the-hegemon`, discard via
   Cao Cao and `tk-wei-jiaxu`).
2. **Sun Quan — Wu Tempo-Burn (U/R).** `tk-wu-sunquan`; Warcry admirals,
   cheap burn/recall, reach damage to close.
3. **Zhuge Liang — Mono-U Sleeping Dragon Control (U).** `tk-shu-zhugeliang`;
   cancels + arrives-draw bodies + late fatties.
4. **Zeus — Mono-R Thunder Storm/Burn (R).** `gk-zeus`; every card points at
   the face; `in-comet-blast` X-burn finish.
5. **Gaia — G/W Go-Wide Stompz (G/W).** `gk-gaia`; ramp, tokens, anthems,
   alpha-strike.
6. **Sima Yi — U/B Attrition Control (U/B).** `tk-jin-simayi`; deathblade
   walls, hand-strip, card-advantage inevitability — now also the natural home
   for Celtic Fae's **Sever/Foresee** tempo-control tools.
7. **Guan Yu — R/W Saint of War Aggro (R/W).** `tk-shu-guanyu`; wins in
   combat with First Blade + Sentinel and tricks, not off the top.
8. **Persephone — B/G Underworld Deathblade Midrange (B/G).**
   `gk-persephone`; deathblade trades + `so-raise-dead` recursion.

**New candidates 9–12 — the Celtic Fae UR legends** (shipped 2026-07-12), each
a distinct 2-color identity not covered above:

- `cf-morrigan-black-wing` (B/G — overlaps Persephone's identity; pick one or
  differentiate: Morrigan leans severGrave/Foresee, Persephone leans raise).
- `cf-titania-silver-court` (U/G — Foresee value + dawn Bloomling tokens).
- `cf-aine-sunlit-bargain` (W/G — Bloodoath lifegain midrange; overlaps
  Gaia's identity, same pick-or-differentiate note).
- `cf-nimue-before-the-lake` (U/W — foresee/draw control with graveyard
  denial; a brand-new identity for the roster).

Roster size (8 vs 10–12) is decided at M2 once the launch-expansion legends
are known; the distinctness rule stands — no two decks identical in both
color identity and archetype family (aggro / burn / control / midrange).
The gauntlet meanwhile has grown to **12 rungs** (The Morrigan + Titania
summit rungs 11–12), so the roster's difficulty/personality framing is
calibrated against that ladder at implementation.

## SaveData / schema impact

Darling decks must persist (which decks, and which Darling each names). Two
options, still open:

- **Option A (minimal, preferred).** Store Darling decks in the existing
  `save.decks` array and add one optional field `darlingId?: string` to the
  deck record, plus `activeDarlingDeckId: string | null` beside
  `activeDeckId`. Additive → **bump `SaveData.version`** at the **next free
  version after v15** (the live schema as of 2026-07-12; exact number claimed
  in build order per the 1.1 program's SaveData walk) with a real `migrate()`
  + test.
- **Option B.** A dedicated `darling: { decks, activeId, progress }`
  sub-object mirroring `GauntletState` — cleaner if the mode grows its own
  ladder/progression.

Either way the migration is trivial and forward-only; `freshSave` gains the
new field(s). Per the iron invariant, the bump ships with migration + test.

## UI touchpoints

1. **MainMenu entry.** A new **Darling** button beside Gauntlet/Practice,
   gated the same way (starter chosen), themed through the shipped design
   system (`docs/design-system.md`) — no ad-hoc styling.
2. **Deck select / build.** `DeckBuilderScene` grows a "Darling" format
   toggle that swaps in `validateDarlingDeck` (85 / singleton / identity) and
   adds a **"Choose as your Darling"** action on any owned legendary creature
   in the list. The color-identity filter reuses
   `src/meta/collectionFilter.ts`.
3. **The portrait already exists.** `CommanderPortrait`
   (`src/ui/CommanderPortrait.ts`) is deliberately generic (cardId + label,
   knows nothing about decks or avatars). In Darling mode, pass the chosen
   `darlingId` instead of `faceCardFor(deck)` — that is the entire portrait
   wiring. The opponent strip uses the rival deck's `darlingId` as its
   `portraitCardId`, exactly as gauntlet avatars do. _Naming note: the class
   name is internal-only residue (allowed by the retheme convention); rename
   to `DarlingPortrait` opportunistically when the mode lands._
4. **Duel launch.** No new DuelScene shape. Launch with the existing
   `{ opponentId, difficulty }` contract pointed at a `DARLING_AVATARS`
   entry, with the player's Darling deck active; the duel setup passes the
   format's `startingLife` + Darling-to-hand config.

## AI implications

**The existing AI pilots these decks unchanged.** `buildAI(difficulty, db,
seed, personality)` (`src/ai/personality.ts`) reads only the redacted
`PlayerView` and the `CardDb`; nothing keys off copy counts, and the
deterministic Foresee policy (`src/ai/foresee.ts`) already serves all brains.
Each rival deck gets a `difficulty` + `personality` (reusing
`makePersonality` — `subtypeBias` for the tribal decks, `burnFaceLife` for
Zeus, `holdback`/`counterFloor` for Zhuge Liang) exactly as gauntlet avatars
do.

**Caveats to measure, not assume:** singleton decks are higher-variance, and
35-life games are longer — the AI's mulligan/curve heuristics and the race
math may shift a few points. Balance-measurement questions for M5.

## Test strategy

No new gate types, only new fixtures:

1. **Legality tests** (`tests/data/darlingDecks.test.ts`, mirroring
   `tests/data/starterDecks.test.ts`): every `DARLING_DECKS` entry is exactly
   85 cards, singleton-legal, has its `darlingId` present + legendary +
   creature, and passes `validateDarlingDeck` color identity. Plus a
   **termination** smoke (headless self-play within `RULES.turnLimit`).
2. **Engine tests** for the two new config options: `startingLife` override
   (life starts at the configured value, determinism preserved) and the
   Darling-to-hand pull (deterministic, card removed from the shuffled deck).
3. **Migration test** (`tests/meta/…`): the pre-bump blob migrates with the
   new field defaulted, existing decks preserved.
4. **Balance matrix.** Extend `scripts/balance-matrix.ts` with a
   `--darlings` mode (peer of `--avatars`/`--starters`) producing a
   deterministic Darling-vs-Darling matrix. Publish a **date-stamped
   baseline** in `darlingDecks.ts` (the `opponents.ts` idiom). Floors only
   ratchet upward with fresh measured numbers — the first baseline is
   measured, not assumed. The proposed life total 35 is confirmed or adjusted
   here.
5. **Doc checker.** This doc carries the `source-of-truth` anti-rot header;
   `npm run check-docs` must stay green.

## Phased implementation plan

Sequenced **after the launch expansion's card data exists** (the pool gate).
Each milestone ends runnable/testable.

- **M1 — Format + validator + engine options (pure).** `validateDarlingDeck`
  in `DeckStorage.ts`; `DarlingDeck` type + `darlingDeckById` in a stub
  `darlingDecks.ts`; the `startingLife` + Darling-to-hand game-config options
  with engine tests. *Testable: vitest only; no UI change.*
- **M2 — The roster as data.** Author `DARLING_DECKS` (85 cards each, against
  the launch pool) and `DARLING_AVATARS` with difficulty + personality. Add
  the legality + termination suite. *Testable: `npx vitest run`.*
- **M3 — SaveData bump.** Next free version, `migrate()` + `freshSave` +
  migration test. *Testable: migration suite green.*
- **M4 — Mode entry + deck select.** MainMenu button + builder format toggle
  (or a `DarlingScene` deck/rival select); wire launch with the format config
  and the Darling id fed to the portrait. *Testable: a full Darling duel
  end-to-end; live preview probe per the playbook.*
- **M5 — Balance pass.** `--darlings` matrix, measured date-stamped baseline,
  iterate decks/personalities/life total until bands are green. *Testable:
  balance matrix + the (skipped) balance suite.*

## Risks / trade-offs

- **No command zone still means no re-cast from the graveyard.** The
  starts-in-hand default guarantees the opening, but a cancelled/killed
  Darling stays dead unless the deck packs recursion. Single-player framing +
  in-list protection mitigate; a true command zone remains a possible v2 and
  an explicit engine change needing its own plan.
- **85-card singleton strains mono colors** even post-expansion — the "≤2
  copies for one deck" per-deck knob is the accepted escape hatch.
- **Longer games.** 35 life stretches game length against `RULES.turnLimit`
  and the AI's race heuristics; measure at M5 before touching either.
- **Scope creep into a ladder.** A Darling progression/rewards system is a
  separate feature; Option-A schema keeps the door open without paying now.

## Open questions (remaining)

1. **Save schema:** Option A (additive fields) vs Option B (dedicated
   sub-object) — decide at M3, informed by whether a Darling ladder is
   coming.
2. **Roster size/overlap:** 8 vs 10–12 rivals; reuse gauntlet
   personalities/portraits or curate fresh ones (assumed: new
   `DARLING_AVATARS`).
3. **Exact life total:** 35 proposed; confirmed at the M5 balance pass.
4. **Which expansion is the launch vehicle** — decided when the expansion-3
   program is scoped.
