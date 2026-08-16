<!-- source-of-truth: docs/plan-1.6-draft.md, docs/plan-1.5.5.md, docs/plan-battle-box.md, docs/plan-darlings.md, src/config/rules.ts, src/meta/warchest.ts, src/meta/deckRepair.ts, src/meta/SaveManager.ts, src/scenes/MainMenuScene.ts, src/config/features.ts, src/meta/Economy.ts, src/scenes/DuelScene.ts, scripts/balance-matrix.ts · last-verified: 2026-08-16 · program doc — re-verify when the referenced code or plans change -->

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
   balance pass; audit table in the draft doc).
6. **Cosmetics layer** (card backs, playmats) — sequenced before Courts.
7. **The first large set (~240-250 cards), reserve-native from
   concretion**, candidate rider: the Dark Tales companion wave (~60).
8. **Premium UX Wave C + Courts** — Wave C OPENED 2026-08-16 with the
   mulligan ritual (library stack + riffle-on-mulligan + drag-to-bottom
   staging, actions byte-identical; the "1 card(s)" copy fixed). Remaining:
   Pack Runway, Trophy Hall full, the land-carry design pass. Then the
   **small-debts batch** (Limited
   retune, modalShell dismiss consolidation, scoreLand rider credit, the
   1.6 dup-audit adjudication, Fogbell Chime redesign, Laughing Pooka /
   Wolfsbane Ward watchlist, metagame deep sweep once the reserve field
   stabilizes).

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
  spells. Shard EV is 966.5g against the 1000g entry — a 3.4% cushion pinned by
  `economyGates`. Do not cut it without re-running those gates.
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
- **6.2% of draft picks are nonbasic lands** (measured over 200 packs) that
  reserve-native Limited cannot play. They still enter the collection and the
  pool list marks them "kept, not playable here". Removing them from packs is a
  design call that changes Premium's kept-card value, so it needs the economy
  gates re-run.
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
