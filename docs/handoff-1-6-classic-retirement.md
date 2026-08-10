<!-- source-of-truth: docs/plan-1.6.md, src/data/opponents.ts, src/scenes/DuelScene.ts, src/meta/deckRepair.ts, src/config/features.ts · last-verified: 2026-08-09 · handoff doc — delete once classic retirement ships -->

# 1.6 handoff: classic retirement is the remaining work

Written 2026-08-09 at the end of the migration build-out. Everything below is
measured or read from the code, not remembered.

## Where the train actually is

`release/1.6` tip is **91431e3**. **No open PRs.** Merged this session, in
order: parameter flip (#201), avatar reserve decks (#202), Practice fields the
avatar (#203), Hel curve tune (#204), reserve-native starters (#205), themed
Darlings rebuild + player-deck matrix (#206), the dated re-baseline (#207),
reserve-native Limited + starter auto-convert (#208).

**The migration is built. What remains is switching it on.**

## The one job left: retire classic

Classic is still live because three things still pilot it. Retirement means
doing these together, because doing them apart leaves the game inconsistent.

1. **The Tower still plays classic decks.** `DuelScene` uses
   `this.opponent.deck` for the gauntlet path (~line 688) and its
   `savedReserveFormat` gate explicitly excludes `gauntletRung !== null`.
   Every avatar already carries a validated `reserveDeck` + `landReserve`, so
   the switch is small: let the gauntlet path take the reserve fields the way
   Practice already does via `practiceAiReserveSide`.
2. **Granted starters need converting.** `convertUnmodifiedStarter` in
   `src/meta/deckRepair.ts` is written and tested but **deliberately unwired** —
   calling it before retirement would convert decks that still work. Wire it
   into the retirement migration. Untouched starters convert silently; edited
   ones return false and route to the shipped flag-and-fix flow, which is the
   owner-ratified behaviour.
3. **The classic format needs hiding.** `FEATURES.reserveFormats` is already
   `true`; retirement needs the inverse switch so the Deck Builder stops
   offering Constructed to new decks. `offeredBuilderFormats` is the single
   place that decides, and the new-deck format prompt reads from it, so the
   prompt collapses on its own.

**After all three, W7 stops being the live classic authority** and the dated
2026-08-09 reserve table in `opponents.ts` becomes the only baseline. THAT is
when the floor re-centre becomes real work — the owner's pre-authorization for
a downward re-centre is still standing and unused, because re-centring classic
floors while classic still ran would have moved numbers nothing measured.

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

## Known, deliberately not done

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

## How to measure anything here

`npx tsx scripts/balance-matrix.ts` modes: `--avatars-reserve`,
`--avatars-darlings`, `--player-decks`, `--warchest`, `--darlings`,
`--warchest-tuning`, plus the classic modes. `--only <ids>` shards by avatar,
`--telemetry` adds per-game metrics.

**CPU discipline is a standing owner rule**: idle baseline on this box is ~35%,
`npx tsx` spawns ~2.7 processes per lane, and the measured totals are 2 lanes
47%, 3 lanes ~39-43% under load, 4 lanes 63%/72% peak, 10 lanes 98% (pinned).
Use 3-4 lanes, set them `BelowNormal`, and MEASURE with
`Get-Counter '\Processor(_Total)\% Processor Time'` rather than counting
processes. Full suite: `npx vitest run --maxWorkers=10` (~6 min, 1,402 tests).
