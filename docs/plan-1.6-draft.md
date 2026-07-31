<!-- source-of-truth: docs/plan-1.5.5.md, docs/plan-battle-box.md, docs/plan-darlings.md, src/data/opponents.ts · last-verified: 2026-07-31 · DRAFT program doc — seeds the 1.6 planning session; re-verify when the referenced plans change. The premium-UX wave details cite docs/plan-premium-ux.md, a LOCAL-ONLY gitignored ideation doc (copy it forward between worktrees). -->

# Darling Blades 1.5.5 and 1.6 — draft program plan

**Status 2026-07-31: DRAFT.** Authored at the 1.5.0 close from the owner's
planning session (sources: the session decision record, plan-premium-ux.md,
plan-battle-box.md, plan-darlings.md, the 2026-07-31 mechanic audit below,
and the W7/econ baselines). Owner decisions recorded at the 1.5.0 close;
scope details and wave contracts are for the 1.6 planning session. The
1.5.5 portion graduated into [plan-1.5.5.md](plan-1.5.5.md), which is the
active train spec.

## The north star (owner-ratified 2026-07-31)

**Warchest** (the product name for the land-reserve mana system; replaces the
borrowed "Battle Box" working title everywhere player-facing) becomes THE
mana system of Darling Blades. There is deliberately **no dual-balance era**:
the owner rejected balancing every patch around both drawn lands and the
reserve.

- **1.5.5 ships Warchest with Darlings** — the format reveal as planned,
  both formats on the reserve system, after their `TO MEASURE` matrices and
  the losslessness probe exist.
- **1.6 launches Warchest everywhere and classic retires.** Every
  player-made deck is invalidated by the migration with a warning flow that
  routes to the Deck Builder to fix it. Decks are preserved and flagged,
  never deleted. (Engineering note: the current boot path PRUNES invalid
  decks and resets `activeDeckId`; that behavior must be replaced by the
  flag-and-fix flow before 1.6 ships.)
- All 1.6 balance work happens once, on the reserve field.

Verified early: the W4.a engine seam fires arrives-triggers identically on
reserve land plays, so the 21 tapland ETB riders survive the migration.

## 1.5.5 — the missing features, after we test them (owner framing)

Small on purpose. Spec: [plan-1.5.5.md](plan-1.5.5.md). Contents:

1. **The Warchest + Darlings reveal.** Reserve-format and Darlings matrices
   (both still `TO MEASURE`), the losslessness probe for a legitimately
   built 50-card all-spell deck, flip `FEATURES.reserveFormats`, reveal
   copy carrying the Warchest name. The curated Darlings rival ladder stays
   explicitly not promised.
2. **collectionPct metric rework** — pool-relative or absolute-cards, so
   set growth stops forcing economically meaningless band re-centres.
   Must land before any set ships.
3. Riders: the `'battleBox' | 'battlebox'` casing debt collapses to
   `'warchest'` ids; sweeper + tribal card art generation (prompts staged
   in spell-art.md / art-bibles; imagegen lane + owner taste gate).

## 1.6 — the Warchest launch train (draft order)

1. **The migration itself**: starters, all 20 avatar decks, and Draft
   redesigned reserve-native; land-fetch card class (Demeter etc.)
   redesigned; the deck-invalidation warning + Deck Builder fix flow;
   economy/collection treatment of land cards decided (pack slots, land
   styles, existing collections never clawed back).
2. **Priority-window reopening** (committed docket item): re-offer a
   response window after a stack flush while combat/end-step is open and a
   castable Charm is held. Engine episode model, replay version bump with
   rules gating, AI decision points. Lands INSIDE the 1.6 train so its
   re-baseline and the migration's are the same measurement.
3. **Premium UX Wave B** (carry-cast phase 1 on the shared CastIntent
   state, Card Atelier, Versus bumpers, Trophy Hall S) — presentation-only,
   parallel with engine work.
4. **Keyword sprinkle wave + the returning-mechanics quota** (audit below).
5. **Cosmetics layer** (card backs, playmats) — sequenced BEFORE Courts.
6. **The next expansion — the first large set (~240-250 cards),
   reserve-native from concretion**, carrying the returning-mechanics
   quota. Candidate rider: the **Dark Tales companion wave (~60 cards)**,
   which directly answers two documented debts (Midnight Storybook's
   thin-pool residual; the R19 inversion's need for in-color tools).
7. **Premium UX Wave C** (Pack Runway, mulligan ritual, Trophy Hall full)
   and **Courts** (cosmetic-first milestones; 100% reward = display copy
   outside shard accounting).
8. **Small-debts batch**: Limited retune, modalShell dismiss consolidation,
   scoreLand rider credit, the unread 1.6 dup-audit report adjudication,
   Fogbell Chime redesign (its Hauntlink unlock condition has arrived),
   Laughing Pooka / Wolfsbane Ward watchlist, and a metagame deep sweep
   once the reserve field stabilizes.

## The mechanic-reuse audit (measured 2026-07-31, all seven sets)

| Mechanic | Home set (count) | Reuse since |
| --- | --- | --- |
| Sever / Foresee ops | Celtic Fae (14 / 38) | Evergreen: every later set, 20-37 uses each |
| Dreaded | Gothic (10) | Good: Dark Tales 3, Yokai 4 |
| Quests | Arthurian (16) | ZERO |
| Champion Awakening | Arthurian (5) | One Dark Tales card |
| Empower | Gothic (20) | ZERO (one Base card) |
| twinBlades | Ragnarök (8) | ZERO |
| Skim / Retell | Dark Tales (37 / 12) | ZERO |
| Hauntlink | Yokai (13) | newest; n/a |
| Base keywords | everywhere | healthy |

**Policy (owner direction 2026-07-31, to codify in adding-cards.md):** every
future set carries 2-3 returning named mechanics at low rarity, the way real
expansions reprint returning keywords. A data-only sprinkle wave into
existing sets rides the 1.6 balance pass.

## Set-size policy (owner direction 2026-07-31)

The pipeline is mature enough for real-expansion sizes. Adopt a
**large/small rhythm**: the next expansion is the first large set
(~240-250); 120-card small sets remain an option between. Do NOT retrofit
all six existing sets (~800 cards of design debt); the Dark Tales companion
wave is the one retrofit pilot, chosen because the balance record already
demands it.

## Open decisions for the 1.6 planning session

- 1.6 naming/scope confirmation once 1.5.5's measurement results exist
  (the owner has already noted the docket is 1.6-sized).
- Draft's reserve-native design (the hardest migration sub-problem).
- Land cards' economy/collection treatment post-migration.
- Whether starters auto-convert at migration or use the same fix-it flow.
- The large set's theme and concretion gate.
