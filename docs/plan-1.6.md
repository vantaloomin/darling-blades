<!-- source-of-truth: docs/plan-1.6-draft.md, docs/plan-1.5.5.md, docs/plan-battle-box.md, docs/plan-darlings.md, src/config/rules.ts, src/meta/warchest.ts, src/meta/deckRepair.ts, src/meta/SaveManager.ts, src/meta/cosmetics.ts, src/meta/Achievements.ts, src/scenes/MainMenuScene.ts, src/scenes/ProfileScene.ts, src/scenes/PackOpeningScene.ts, src/scenes/DuelScene.ts, scripts/balance-matrix.ts · last-verified: 2026-08-18 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.6 — program plan

**Status 2026-08-10: OPEN, migration complete.** The train opened gated on
2026-08-06; the **Warchest format-parameter gate** below RESOLVED on
2026-08-07 with owner ratification of **40-card decks, a 5-card opening
hand, and no reserve color cap**. All lanes are now open, including the
migration and every reserve-field balance lane, which build to the
ratified parameters. **Classic constructed retired 2026-08-10** (see the
retirement section below); the dated 2026-08-09 reserve table in
`opponents.ts` is now the only live baseline, which is what makes the
floor re-centre real work. Scope and sequencing graduate from
[plan-1.6-draft.md](plan-1.6-draft.md), which remains the fuller
reference for wave details and the mechanic-reuse audit.

## The north star (owner-ratified 2026-07-31, unchanged)

**Warchest becomes THE mana system of Darling Blades.** 1.5.5 revealed
Warchest and Darlings on the reserve system; 1.6 launches Warchest
everywhere and classic constructed retires. There is deliberately no
dual-balance era, and all 1.6 balance work happens **once**, on the
reserve field. That "once" is exactly why this train opens gated: the
reserve field's own parameters are under review, and re-baselining twice
would break the ratified principle.

## The Warchest format-parameter gate (blocks all reserve-field balance work)

Playtest feedback (owner, 2026-08-06) surfaced three structural concerns
with the shipped Warchest constructed format:

1. **Hand clog**: with every draw live, the inherited 7-card opening hand
   and 7-card max produce cleanup discards for non-aggro decks, slow the
   game, and hand graveyard-recursion decks (retell, reclaim) free fuel.
   Proposed lever: a smaller per-format opening hand (test 5 before 4).
2. **Dilution**: 50 no-land cards is +14 spells over a classic deck's ~36
   live cards; 40 is +4. Proposed lever: 40-card Warchest decks.
   (The 50-card size was owner-locked 2026-07-28; the owner reopened it
   with this feedback, so revisiting it is legitimate.)
3. **Five-color pull**: unrestricted reserve colors plus a guaranteed
   land drop delete the consistency cost of splashing, so the format's
   equilibrium is a five-color goodstuff pile. Candidate levers, in
   preference order: a reserve color cap (deck must fit the reserve's
   colors), a lower dual cap, or embracing the pile identity.

**RESOLVED 2026-08-07 (owner-ratified): Warchest constructed moves to
40-card decks with a 5-card opening hand; reserve colors stay
unrestricted (no cap).** Evidence: two dated six-config tuning-matrix
runs (2026-08-06 with the land-based mulligan confound, 2026-08-07 clean
after the reserve-mulligan fix in PR #197; JSONs in the local
`balance/warchest-tuning/` workbench). The clean run confirmed claim 1
decisively (50/7 clogs 2.8-5.4 turns/game with up to 1.95 cleanup
discards and an 11.3% reanimator fuel subsidy, all collapsing to ~0 at
40/5), softened claim 2's cost (40-card games run 2-4 turns longer but
all-action), and refuted claim 3 (five-color piles win 13-19% everywhere
with ~21% color-stranded turns; the measured gradient is mono > 2c > 3c
> 5c, and the 2-color cap merely banned 3+ color decks). Hand 5 beat
hand 4 on migration disruption: 40/4 reshuffles archetype standings
hardest. The open balance question the gate surfaced — mono goodstuff at
~73% in every config — is a card-pool problem for the migration balance
pass, not a format parameter. The shipped build still plays 50/7 until
the migration lands; `rules.md` carries the same note.

The gate resolved in three steps (all complete):

- **Telemetry instrumentation** (in flight on `feat/warchest-telemetry`):
  a pure `GameTelemetry` event-stream collector plus a
  `balance-matrix.ts --telemetry` mode measuring cleanup discards,
  hand-clogged turns, game length, graveyard-fuel provenance, dead-weight
  draws, seed-to-seed win-rate variance, color-stranded turns, tapped-land
  tempo loss, reserve exhaustion, and mulligan impact.
- **Tuning matrices**: dated runs at 50/7 (current), 40/5, and 40/4, with
  and without a reserve color cap, plus color-count test decks (mono
  through five-color) to price the splash incentive. Requires small
  sim-only variant-rules plumbing (per-format hand/deck size and reserve
  color cap behind the existing rules-level format flag).
- **Owner ratification** of the final deck size, opening-hand size, and
  reserve color rule. Only then does the migration lane open, so its
  re-baseline happens once, on the ratified parameters, together with the
  priority-window re-baseline.

Gate output (delivered): the three ratified rules above, recorded here
and in [rules.md](rules.md); the migration lane is unblocked and builds
to 40 cards / hand 5 / uncapped reserve colors. The migration
implementation order: the deck-invalidation flag-and-fix flow (landed
2026-08-07, #199), then the parameter flip itself — **landed 2026-08-08**
(`WARCHEST_DECK_SIZE` 50→40, `WARCHEST_HAND_SIZE` 5 wired into real
duels and replays; Darlings ratified to the same 5-card opener on
2026-08-08 from its own 5-vs-7 measurement; the 50-card tuning configs
retired) — then the deck redesigns — **scripted first cut landed
2026-08-08** (every avatar carries validator-gated `reserveDeck`,
`landReserve`, `darlingsDeck`, and `darlingId` fields beside the
untouched classic deck, generated by `scripts/avatarReserveDecks.ts`;
measured hand-tuning against `--avatars-reserve` / `--avatars-darlings`
follows) — and the single re-baseline. **Reserve-native starters landed
2026-08-08**: `STARTER_DECKS` carry `reserveCards` + `landReserve` built
by the same deterministic converter, and `--avatars-reserve` now measures
against those real columns rather than derived proxies, clearing the last
precondition for the dated re-baseline. Whether a granted starter hands
the player the classic or the reserve build at migration remains the open
decision below. The stale-stamped 1.5.5 reserve
baselines and the mono-goodstuff dominance question both resolve in that
re-baseline.

## Lanes open now (parameter-independent)

1. **Priority-window reopening - IMPLEMENTED 2026-08-06.** Current rules
   revision 2 re-offers bounded response windows after paid combat/end-step
   flushes when the non-active player has a castable Charm. Replay v7 selects
   the new path; v6 remains stream-exact under preserved revision 1. AI
   determinization carries the revision, and the tutorial is pinned to rev 1.
2. **Deck-invalidation flag-and-fix flow - IMPLEMENTED 2026-08-07.** Save v27
   preserves rule-invalid decks and their `activeDeckId`, reports unknown card
   ids without throwing, and persists acknowledgement of the flagged deck-id
   set. Main Menu warns when new decks need repair and routes directly to the
   opened deck; Play and the Practice picker block invalid Practice/Gauntlet
   launches with the same fix route. The 1.6 migration invalidates every
   player-made classic deck, so this flow remains its prerequisite.
3. **Premium UX Wave B** (presentation-only, parallel with engine work):
   carry-cast phase 1 on the shared CastIntent state, Card Atelier,
   Versus bumpers, Trophy Hall S. Details live in the local-only,
   gitignored `plan-premium-ux.md` (copy it forward between worktrees).

   **Wave A shipped (#166).** `Toast`, `confirmNoBlock` and the always-on
   `previewCombat` forecast are all in the code; `CastIntent`, `Atelier`,
   `bumper` and `TrophyHall` are not.

   **CARRY-CAST PHASE 1: RESOLVED 2026-08-16 (owner-picked scope) and
   SHIPPED.** The hole classic retirement put here (the slate predated the
   migration and said phase 1 ships "lands + untargeted spells", but lands
   are no longer in hand) went to the owner as priced readings; the pick:
   phase 1 = **untargeted spells on the shared CastIntent state, plus the
   reserve-modal ergonomic fix** (the Reserves modal now groups identical
   lands per kind with one-tap play, where it used to render one tile per
   slot — up to 10 tiles for a 2-3 way choice), and **"carry a land OUT of
   the Reserves pile" becomes its own early-Wave-C design item** once
   CastIntent has matured on spells, with the tutorial re-author costed in.
   As shipped: the resolving click lifts a proxy card that spring-follows
   the cursor with a velocity lean, a ghost tile marks the exact packed slot
   the permanent will land in, a second click on the field submits the SAME
   action instant cast did (replays byte-identical), and right-click / Esc /
   dropping on the hand cancels. Hand casts only; touch and the tutorial
   keep single-click; `settings.instantCast` (SaveData v30) restores
   click-to-cast. Pure maths and gating live in
   `src/ui/castIntentPresentation.ts` + `reserveModalPresentation.ts` with
   unit tests, per the Wave B presentation-module convention.

## Lanes opened by the gate resolution (2026-08-07)

4. **The migration**: starters, all 20 avatar decks, and Draft redesigned
   reserve-native; the land-fetch card class redesigned; land cards'
   economy/collection treatment decided (pack slots, land styles,
   existing collections never clawed back); the flag-and-fix flow wired
   to the format switch; classic retires.
5. **Keyword sprinkle wave + returning-mechanics quota** (rides the 1.6
   balance pass; audit table in the draft doc). **Sprinkle LANDED
   2026-08-18**: ten data-only low-rarity cards spread Empower, twinBlades,
   Skim, Retell, Quests, and Champion Awakening beyond their home sets
   (base, Ragnarök, Silver Veil, Grail Oath, Nocturne Manor; catalog 787 ->
   797). The policy is codified in adding-cards.md. The quota half ships
   with the Duat set (Retell + Empower + twinBlades, per the large-set
   plan). Balance note: the wave regenerated every avatar's Darlings deck
   and two reserve decks through the deterministic builders (committed data
   must equal builder output); the shared 1.6 balance pass measures the
   result with the set.
6. **Cosmetics layer** (card backs, playmats) — sequenced before Courts.
   **SHIPPED 2026-08-18**: account-level catalog, v32 migration, Profile
   picker, pack-opening back selection, duel playmat recolors, and the
   economy-free cosmetic reward seam.
7. **The first large set (~240-250 cards), reserve-native from
   concretion. SHIPPED 2026-08-21.** Sands of the Duat is live at 245/245
   QA-passed; the balance pass measured the Pride at the Ninth Gate prefab at
   64.7% aggregate over 2,400 hard-AI games.
8. **Premium UX Wave C + Courts** — Wave C OPENED 2026-08-16 with the
   mulligan ritual (library stack + riffle-on-mulligan + drag-to-bottom
   staging, actions byte-identical; the "1 card(s)" copy fixed), and the
   **Pack Runway shipped the same day**: a multi-pack open is one rail of
   every pull in ascending rarity through a fixed reveal gate — per-tier
   cadence (commons accelerando, ritardando into specials), UR full stop +
   spotlight, drag scrub with capped inertia, Resume Reveal after 1.3s
   idle, tier-ribbon minimap, edge vignettes, grouped flip audio, and
   virtualization (live CardViews only near the gate). Animations-off and
   Skip keep the at-a-glance summary grid. This closes the
   16-of-150-cards batch-summary gap. **Land-carry R2 landed 2026-08-16**:
   with a legal drop, a mouse tap on the Reserves pile fans the playable
   kinds (grouped, count-badged) instead of opening the modal; picking one
   lifts it into the shared CastIntent carry with an incoming-bead ghost
   at the mana row's end, and the drop submits the same `playLand`. Touch,
   the tutorial, replays, and `instantCast` keep the modal; right-click
   always reads the full reserve. The full-art frame-shed rider landed the
   same day. **Trophy Hall full landed 2026-08-16, closing the wave**: the
   Achievements screen defaults to a five-wing hall (one per bucket - ring
   gauge, featured plinth, owned-card furnishings, click-through to the
   bucket-scoped list), the dense list survives as a toggle, claimed rows
   carry a showcase pin (SaveData v31 `achievements.pinned`, cap 3, oldest
   evicted) rendered as tilted seal plaques on the Profile header. **Wave C
   is COMPLETE pending the owner's device pass.** Then the **small-debts
   batch** (Limited
   retune, modalShell dismiss consolidation, scoreLand rider credit, the
   1.6 dup-audit adjudication, Fogbell Chime redesign, Laughing Pooka /
   Wolfsbane Ward watchlist, metagame deep sweep once the reserve field
   stabilizes). **Limited retune: re-measured 2026-08-22, no retune needed.**
   Composition, the Premium shard-farm guard, and the canonical day-60
   progression run all measured clean; the one fine flag is a stale band, not a
   regression (see the collection-dilution note below). No economy constant
   moved.

## Classic retirement — LANDED 2026-08-10

Warchest is now THE constructed format. The switch is
`FEATURES.classicRetired`, and it moves four coupled things:

1. **The Tower fields reserve decks.** `DuelScene`'s `savedReserveFormat` no
   longer excludes `gauntletRung`, so a gauntlet duel seats the avatar's
   designed `reserveDeck` + `landReserve` through the renamed
   `avatarReserveSide` (was `practiceAiReserveSide` — it is no longer
   Practice-only). `PlayScene` is the gate that decides which reserve format
   may enter: Warchest yes, Darlings still Practice-only, because the curated
   Darlings rival ladder stays a non-goal.
2. **Granted decks arrive reserve-native.** `Economy.grantedDeckBuild` is the
   single source for what a purchase or free claim hands over, so the shop
   preview and the saved deck can never disagree. Save **v28** applies the
   same decision to decks already granted via `convertUnmodifiedStarter`:
   untouched decks convert silently, edited ones keep the player's choices.
   **The migration must also GRANT the converted deck's cards.** A reserve
   build is not a subset of its classic build: it runs cards at higher counts
   (Crimson Muster wants 4 Ares where classic ran 2) and theme reserve builds
   pull in cards from other sets entirely. Converting without granting left
   every measured deck blocked on ownership, which is precisely the repair
   prompt the auto-convert exists to avoid.
3. **The builder stops offering Constructed.** `offeredBuilderFormats` drops
   it, which also stops a deck being switched back to it.
4. **Classic decks become invalid, not deleted.** `deckHealth` reports
   `CLASSIC_RETIRED_ISSUE` for any constructed deck however legal its 60
   cards are, which is what routes leftover player-built decks into the
   shipped flag-and-fix flow. They stay saved, visible, and active.

The progression/economy sim was migrated with the game: it played
`deck.cards` with no reserve, which after retirement meant landless decks.
The locked Layer-1 economy gates caught it (packs/day 0.07 against a 0.15
floor). Fixing the sim to play the reserve field restored every band with
**no band re-derivation**. The same fix repaired a pre-existing defect from
the reserve-native Limited change: the sim's Limited matches had been playing
25 spells with no granted Warchest.

## Facts a fresh session will otherwise get wrong

- **The Tower shuffles its roster daily** (`resolveGauntletRoster`) and takes
  brain strength from the FLOOR, not the avatar (`floorBrain`). Avatar `tier`
  therefore does not decide who a player meets at rung N. Re-tiering was
  **dropped from 1.6** for exactly this reason; do not re-open it as a fix for
  ladder spread.
- **`raise` reads only the controller's own graveyard**
  (`EffectInterpreter` case `'raise'`). Opponent-mill cannot fuel reanimation.
  This is why Hel is a self-mill reanimator and not a mill-you deck.
- **The deck builders are archetype-blind.** The Warchest converter's curve cap
  `{4:10, 5:4, 6:2}` deletes the expensive payoffs a reanimator exists to cheat
  into play. Hel is exempt and hand-built for that reason. Any future combo,
  reanimator or ramp deck needs the same exemption.
- **Hand tuning only earns an exception while it still measures better than the
  builder.** Both exceptions were re-tested under that rule: Hel's first hand
  tune LOST (21 vs 33) and was dropped; Morgan's WON (52 vs 46) and was kept.
  The rule and both numbers live in `tests/data/avatarReserveDecks.test.ts`.
- **Premium Draft's entry fee buys the 45 kept cards, not the deck.** Deck size
  does not change what is kept, so the fee did not move when Limited went to 25
  spells. The finished-collector shard-farm guard (`tests/meta/exploits.test.ts`)
  was re-measured 2026-08-22 across 50 seeds: 857.5g mean kept-card shard value
  (1,340g max) against the 1,000g entry, a 142.5g cushion, gate PASS. The
  separate full-completion Layer-1 valuation in `economyGates` is unchanged at
  339.14g. Do not cut either without re-running those gates.
- **`gravecasts` telemetry counts Retell casts, not `raise`.** It reads 0.00 for
  Hel by design; that is not a broken engine.
- **A reserve build is not a subset of its classic build.** The deterministic
  converter re-picks from the whole pool, so `reserveCards` routinely contains
  cards, and higher counts of cards, that the classic list never had. Anything
  that hands a player a reserve build must grant against the RESERVE list, not
  assume the classic grant already covered it.

## Known, deliberately not done

- ~~The tutorial is still a scripted classic duel.~~ **DONE 2026-08-10**: the
  tutorial is Warchest-native. Both teaching decks are spell-only, both seats
  field a ten-Plains Warchest, and the opening lesson is the Warchest itself
  ("your lands are not in your deck") followed by taking a land from Reserves.
  It stays pinned to rules revision 1, and seed 2 still holds the whole
  scripted line, so no beat after the land drop changed.
- **Limited composition re-measured 2026-08-22** with
  `npx tsx scripts/limited-composition.ts --packs 200 --seed 20260822`:
  3,000 free picks and 3,000 Premium picks from the live mixed-set pool
  (`isLiveCollectible`: 1,019 cards; catalog collectible count: 1,079;
  Duat live at 245 cards; Dark Tales companion gated). Duat was 708/3,000
  free picks (23.60%) and 758/3,000 Premium picks (25.27%), against 245/1,019
  (24.04%) of the live pool. Lands were 95/3,000 (3.17%) free and 101/3,000
  (3.37%) Premium; unplayable reserve-native lands were 0/3,000 in both
  samples. The script prints the full set, rarity, type, and auto-built-deck
  breakdown. No Limited retune is indicated by this measurement.
- **Collection dilution at the 1.6 pool (measured 2026-08-22, DEFERRED to the
  metagame sweep by owner decision).** The canonical run
  (`npx tsx scripts/progression-sim.ts --check --seeds 8`, 10 personas x 8
  seeds x 60 days) passes **all four locked Layer-1 coarse gates**: cohort
  packs/day 0.4821 [0.15, 2.5], minimum quest claim 0.3274 [0.2, inf], gold/game
  ratio 1.0548 [-inf, 4], median day-7 uniques 152.9 [108, 202]. It raises one
  fine flag: `limited-fan uniqueCards 646 outside 550..628`.
  **That flag is pool growth, not a regression.** Every day-60 fine band is
  written as a share of the 764-card pool it was derived from on 2026-07-31
  (the code comments carry the arithmetic, e.g. "72.0%-82.2% of 764"). The
  packable pool is now 998, so on the bands' own share basis Limited Fan's
  646 uniques is **64.7%, below the band's 72.0% floor** rather than above its
  ceiling: the absolute count crept up 3% while the denominator grew 31%.
  Read that way, **six of ten personas now sit below their band's share floor**
  (Completionist 54.5% vs 65.7-78.1%, Hardcore Optimizer 55.8% vs 65.1-78.3%,
  High Skill Veteran 47.5% vs 53.3-72.8%, Limited Fan 64.7% vs 72.0-82.2%,
  Daily Grinder 45.1% vs 45.5-65.4%, New Casual 20.0% vs 21.2-30.8%); the
  absolute bands hide it because absolute counts barely moved.
  **Owner decision 2026-08-22: accept for now and revisit collection pacing
  after the metagame deep sweep**, with sweep data in hand. The bands are
  therefore deliberately left stale and the Limited Fan flag deliberately left
  standing until then; do not silently re-derive them, and do not read the
  standing flag as an unaddressed regression.
- **Soft player decks:** Glimmer Bargain 36.5 and Shadow Mandate 36.3 in the
  head-to-head table. Playable, not broken; tune only if the owner wants a
  tighter spread than 26.3 points.
- **Sima Yi** sits at 53-54 on the Warchest ladder and 44 on Darlings, low for a
  medium rung but not an outlier.

## Open decisions

- Draft's reserve-native design (the hardest migration sub-problem).
- Land cards' economy/collection treatment post-migration.
- ~~Whether starters auto-convert at migration or use the fix-it flow.~~
  **RESOLVED 2026-08-10**: untouched granted decks auto-convert (at the grant
  source and in the save v28 migration); edited decks use the fix-it flow.
- The large set's theme and concretion gate.

## Non-goals

The curated Darlings rival ladder remains explicitly not promised: the Tower
accepts Warchest only, and Darlings stays a Practice format.

(Superseded 2026-08-10: the pre-migration non-goal "classic constructed is
untouched" held until the migration lane opened. Classic has now retired.)
