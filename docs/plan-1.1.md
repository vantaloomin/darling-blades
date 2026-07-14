<!-- source-of-truth: docs/plan-road-to-1.0.md, docs/plan-v1.1-post-launch.md, docs/plan-commander-mode.md, docs/plan-mod-ugc.md, docs/expansions/celtic-fae.md, docs/art-pipeline.md, src/meta/Limited.ts, src/meta/SaveManager.ts, src/data/opponents.ts, src/meta/gauntletSeed.ts, src/meta/collectionFilter.ts, src/engine/types.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts · last-verified: 2026-07-12 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.1 — program plan

_Scoped 2026-07-10, the day of the 1.0 cut. All scope picks below are user
decisions made that day — do not relitigate._

1.0 shipped the complete solo loop. 1.1 is the **content-and-formats release**:
a second expansion, the public debut of Limited, and two new ways to play
(Commander, player-made cards), plus three small deferred features whose
blocking product decisions are now made. Deterministic replays and Tier-2 LAN
PvP are explicitly **not** in 1.1 — they shelve to 1.2+.

## Locked scope decisions (2026-07-10)

| Decision | Pick |
| --- | --- |
| Next expansion | **Celtic Fae** (Expansion 2; part one of the Celtic/Arthurian block) |
| Limited public release | Rides the Celtic Fae release (per the 1.0 descope decision) |
| Big systems in 1.1 | **Commander mode** and **MOD/UGC packs** (replays + PvP shelved to 1.2+) |
| Randomized tower | **Seeded daily rotation** (same shuffled tower for everyone each day) |
| Base-set semantics | **Relabel for clarity** — data stays disjoint, copy-only facet rename |

> **Status (2026-07-12):** Pillar 1 SHIPPED — the stacked train merged to
> main as the #64 bundle (mechanics rethemed to Sever/Foresee in PR #66).
> The gauntlet-boss decision is RESOLVED (user-directed): The Morrigan and
> Titania are **rungs 11–12**, measured 2026-07-12 (40-seed full matrix +
> a 50-seed low/mid/high tier matrix — baseline in src/data/opponents.ts);
> the daily-rotation pool (Pillar 5) gains them for free when it lands.
> Open: Pillar 2's Limited re-enable.
>
> **RE-SCOPE (user decisions 2026-07-14) — the pillar assignments below are
> superseded by this release ladder:**
>
> - **Sealed is CANCELLED outright.** Not deferred — cancelled. The hub
>   offers only the (persona) Draft; Sealed's meta core / reveal scene /
>   tests remain in the codebase as dead code eligible for cleanup. Every
>   "both run types" requirement in this doc is void.
> - **Pillar 2's Draft half SHIPPED 2026-07-14** far beyond this doc's scope
>   (20 AI draft personas, familiarity reveals, a Free + Premium two-tier
>   entry, full scene rebuild, public via the Play submenu — see roadmap
>   Recently shipped 2026-07-14). Remaining in 1.1 from Pillar 2: the
>   **economy sim/tuning pass** (now player-facing).
> - **Pillar 3 Commander mode → 1.5**, and the format is named
>   **"Darlings"** (working title for the retheme).
> - **Pillar 4 MOD/UGC → 2.0.**
> - **Pillar 5.1 seeded daily tower rotation → 1.3** (carries its balance
>   re-baseline).
> - **Pillar 5.3 practice opponent picker → 1.2.**
> - Pillar 5.2 (base-facet relabel) and the Limited set-choice/achievement
>   hooks are unassigned pending a user call.

## Pillar 1 — Celtic Fae expansion

The concept is fully authored in
[expansions/celtic-fae.md](expansions/celtic-fae.md): a silver-green twilight
set of fae courts, selkies, banshees, and impossible bargains. **80 booster
cards** (40 C / 24 R / 7 SR / 5 SSR / 4 UR), primary colors U/B/G with W fae
knights and R wild-hunt pressure, mechanical identity tempo-control / evasive
fae / exile answers / scry payoffs.

**The engine gap — the real work of this pillar.** Celtic Fae's two signature
mechanics do not exist in the engine yet:

- **Exile** — a new zone. The engine has hand/battlefield/graveyard/stack;
  exile needs zone plumbing, EffectOps (exile target, exile from graveyard,
  return-from-exile, exile-if-dies riders), and redacted-view rules (exile is
  public). The duel UI is already scaffolded for it: the pile columns carry
  hidden `EXILE_ENABLED` slots on both sides and `ZoneContentsModal` is
  exile-ready (2026-07-10 board2 work) — so the UI cost is flipping a flag,
  not new layout.
- **Scry** — a new decision surface. Look at the top N, choose keep/bottom
  order. This adds an `awaiting` kind (like mulligan/discard picks), an AI
  decision hook for all three difficulties + personalities, and a pick
  overlay reuse in DuelScene. Deterministic by construction (the pick is an
  action in the stream).

Both must land as pure, seeded engine features with full test coverage
**before** any card data is written — the Ragnarök precedent (twinBlades /
grind / raise landed first, cards fell out of the data) is the playbook.

**Then the standard expansion train** (the Ragnarök checklist):
`src/data/cards/celtic-fae.ts` tagged `set: 'celtic-fae'` (widen the
`CardDef.set` union and the collection-filter/pack-pool facets), a set-scoped
booster SKU + shop entry, at least one buyable precon, art-bible generation
(`gen-*-artbible` sibling), the full art run — **with the strengthened
headroom demand in the gen preamble** (this closes the open smart-crop
thread: 111 base cards sit at the raw ceiling because the raws lack sky;
Celtic Fae raws must be generated with explicit top-clearance so smart-crop
has room to work) — an achievements pass scaled to the 80-card set, and a
measured balance pass (`balance-matrix`, date-stamped in
`src/data/opponents.ts` if gauntlet content is touched).

**Open design option (decide during the pillar, not now):** whether Celtic
Fae adds gauntlet rungs 11–12 (the Ragnarök move) or leaves the tower at 10
and expresses its bosses through the daily rotation pool (Pillar 5).

## Pillar 2 — Limited public release

Limited is code-complete and hidden (PR #54). It releases **with** Celtic Fae.
The blocker list from [plan-v1.1-post-launch.md](plan-v1.1-post-launch.md)
Feature 5:

- **Balance/economy.** Measure auto-built limited decks with the balance
  harness — now including the Celtic Fae pool — and revisit
  `ECONOMY.limitedRunGold` ([40, 100, 180, 300]) against the 9-card/450g
  constructed economy using `scripts/progression-sim.ts`.
- **Flow polish.** Bring the four Limited scenes (reveal, draft picker,
  40-card builder, run flow) fully onto the 1.0 theme system and the rebuilt
  duel board's conventions; live-probe both run types end-to-end.
- **Set choice.** Limited runs should be able to draw Celtic Fae packs —
  decide whether a run is single-set (pick your set at run start) or mixed.
- **Achievement hooks.** The road-to-1.0 plan reserved Limited run-history
  goals; add them with the re-enable.

Re-enable mechanics: restore the MainMenu entry (one line), probe, ship.

## Pillar 3 — Commander mode

Per [plan-commander-mode.md](plan-commander-mode.md): an EDH-lite singleton
format — one legendary commander, singleton deck, layered into
`src/data`/`src/meta`/`src/scenes` with **no engine change** — plus **8 themed
commander precons**. The plan predates Ragnarök's legends and the 1.0 UI
refresh, so its deck lists and scene sketches need a refresh pass against the
current pool (Celtic Fae's four UR legends are natural commander candidates —
sequence this pillar after Pillar 1's card data exists, or scope the first
cut to the base+Ragnarök pool). SaveData: commander decks persist — next free
version (see the walk below) with a real `migrate()` + test.

## Pillar 4 — MOD / UGC packs

Per [plan-mod-ugc.md](plan-mod-ugc.md): data-only custom cards (art/name/
stats) with a validator that enforces **no new mechanics** — whitelisted
against the engine's `Keyword`/EffectOp unions — namespaced ids, and browser +
Tauri loaders. One consequence of Pillar 1: the exile/scry ops join the
whitelist, so land this **after** the engine work settles or the validator
whitelist churns. UGC cards never enter the real collection/economy
(the plan's isolation rules hold).

## Pillar 5 — Decided small features

1. **Seeded daily tower rotation** (decided: daily model). The tower roster
   derives deterministically from `todayString()` — everyone gets the same
   shuffled tower each day, reproducible by seed. Keep `rungSeed` per-rung
   derivation. An **active run must keep its roster across reloads and
   midnight**: stamp the run with its roster day/seed at run start (small
   `gauntlet.run` addition — rides whichever SaveData bump is open, with
   migration + test). Balance: re-key the `RUNG_BANDS` gates to the avatar's
   own target rather than the slot, and re-measure (the test-floor invariant
   makes this a real measurement pass — see plan-v1.1-post-launch Feature 3
   for the full hazard analysis).
2. **Base-set facet relabel** (decided: relabel only). Rename the `'base'`
   collection/shop facet display copy (e.g. "Core Set") so it can't read as
   "all cards" once three sets exist. Copy-only; data model, pack pools, and
   achievements untouched.
3. **Practice opponent picker** (plan-v1.1-post-launch Feature 1). A picker
   over the `AVATARS` roster reusing the gauntlet's avatar-card presentation;
   launches `scene.start('Duel', { difficulty, opponentId })`. Backend is
   already done; pure additive UI.

## Explicitly out of 1.1 (shelved, not dropped)

- **Deterministic replays** → 1.2 (the strongest determinism showcase;
  design notes in plan-road-to-1.0 Feature 4).
- **Tier-2 LAN PvP** → post-1.2 (mobile-lan-plan.md).
- **Battlefield drag-reorder** → unscheduled (determinism hazard; only
  behind a view-only test, per plan-v1.1-post-launch Feature 2).
- **Arthurian Court** → Expansion 3, the Celtic block's second half — next
  release after 1.1.

## Carry-over 1.0 validation (precedes / runs alongside)

Still open from the 1.0 cut and not 1.1 features: the full-loop human
playthrough on the rebuilt UI, the by-eye/by-ear polish pass, the real-device
mobile pass, and the `v1.0.0` tag + fresh NSIS installer.

## Suggested sequencing

Dependency-ordered, not size-ordered:

1. **Engine: exile zone + scry** (Pillar 1a) — everything content-shaped
   waits on this; it's also the riskiest piece, so it goes first with full
   headless coverage.
2. **Celtic Fae card data + booster/precon + balance** (Pillar 1b), then the
   **art-bible + art run** (Pillar 1c — long, runs in the background; the
   headroom-preamble fix lands here).
3. **Limited re-enable + tuning** (Pillar 2) — needs 1b for the set choice.
4. **Small features** (Pillar 5) — independent; interleave anywhere. The
   relabel and picker are afternoon-sized; the tower rotation carries the
   balance re-baseline.
5. **Commander mode** (Pillar 3) — after 1b so Celtic legends can headline
   commander decks.
6. **MOD/UGC** (Pillar 4) — last, once the op whitelist is stable.

**SaveData walk:** starts at the next free version after v15. Likely bumps:
commander decks, tower-rotation run stamp, and (if Limited set-choice needs
persistence) an `activeRun` extension. Every bump ships a real `migrate()` +
test, per the iron invariant; exact numbers are claimed in build order, not
reserved here.

## Definition of 1.1

Release-ready when: Celtic Fae is fully illustrated, purchasable, and
balance-measured; Limited is public with both run types probed and its
economy sim-checked; Commander mode ships with its precons; a MOD pack can be
authored, validated, loaded, and played on both browser and desktop; the
daily tower rotates with green re-measured bands; the facet relabel and
opponent picker are live; and the whole ladder (tsc / lint / vitest / build /
doc checkers) is green with every new save migration tested.
