<!-- source-of-truth: docs/plan-1.6.md, src/data/opponents.ts, src/config/features.ts, src/ai/tiers.ts, scripts/balance-matrix.ts · last-verified: 2026-08-10 · handoff doc — delete once 1.6 closes -->

# 1.6 handoff: classic retired, floors measured and left alone

Updated 2026-08-10, after classic retirement landed. Everything below is
measured or read from the code, not remembered.

## What shipped

**Classic retirement is done.** The three coupled steps the previous handoff
described all landed together, plus two the build turned up on the way:

1. The Tower fields avatar `reserveDeck` + `landReserve`.
2. `convertUnmodifiedStarter` is wired into save **v28**.
3. `offeredBuilderFormats` no longer offers Constructed.
4. **(found during the build)** `deckHealth` had to mark constructed decks
   invalid, or step 2's "edited decks stay invalid on purpose" was not true of
   anything: a legal 60-card classic deck still validated clean and would have
   walked into a Warchest duel with no reserve.
5. **(found during the build)** The grant paths still handed out classic
   builds, so a brand new player's free starter would have been dead on
   arrival. `Economy.grantedDeckBuild` now grants the reserve build at the
   source, and the shop preview reads the same function.

6. **(found by driving the real SaveManager in a browser)** The migration had
   to GRANT the converted deck's cards. A reserve build is not a subset of its
   classic build, so every converted deck came out blocked on ownership — the
   exact repair prompt the auto-convert exists to avoid.
7. **(follow-up, 2026-08-10)** The tutorial is now Warchest-native too. It was
   the last thing in the game still teaching "play a land from your hand".

Mechanism, decisions, and the durable "facts a fresh session gets wrong" list
now live in [plan-1.6.md](plan-1.6.md).

## The floor re-centre: MEASURED, and deliberately not spent

The `--floors` matrix was itself still classic (it played `avatar.deck` against
`starter.cards`), so it would have priced a format the game no longer plays. It
is now reserve-native, and the first measurement is dated 2026-08-10:
`--floors --seeds 80`, 20 floors x 5 starters, 8,000 games, **FLAGS none**.

| tier | reserve | classic | delta | gap |
| --- | --- | --- | --- | --- |
| T1 (F1-3)   | 20.4 | 23.3 | -2.9 | |
| T2 (F4-6)   | 26.3 | 29.4 | -3.2 | +5.9 |
| T3 (F7-9)   | 33.8 | 33.8 | +0.0 | +7.5 |
| T4 (F10-12) | 53.4 | 50.5 | +2.8 | +19.6 |
| T5 (F13-15) | 59.7 | 60.7 | -1.1 | +6.3 |
| T6 (F16-20) | 73.4 | 70.0 | +3.4 | +13.8 |

**The Tower survived the format change.** Every tier moved under 3.5pp, the
ladder stayed monotonic, and every adjacent gap is >= 4pp. So the owner's
standing pre-authorization for a downward re-centre was **not spent** — there
is nothing to re-centre, and moving floors here would change numbers nothing
measured. It remains available if a later card or deck change moves the ladder.

Two shape observations, neither a band violation, both left open for the owner:

- **The T3 -> T4 step is a +19.6pp cliff** at floors 9 -> 10 (medium/0.32 ->
  medium/0), by far the widest gap on the ladder. A player cruising floors 7-9
  around 34% meets ~53% at floor 10.
- **Shadow Mandate is the weakest player column throughout** (66-90% against
  T4+), consistent with its 36.3 in the head-to-head table.

Also fixed here: floors 19-20 had no bands at all. The roster grew to 20 after
`FLOOR_BANDS` was written, so `runFloorMatrix` generated two summit floors that
nothing gated. They now carry the same T6 `minAvg` 0.68, measured 73.8 / 71.0.

- **Do not re-open re-tiering.** The Tower shuffles its roster daily
  (`resolveGauntletRoster`) and takes brain strength from the FLOOR
  (`floorBrain`), not the avatar, so avatar `tier` does not decide who a player
  meets at rung N. Re-tiering was dropped from 1.6 for exactly this reason.
- The measured tier ladder and its plateaus are stamped in `src/ai/tiers.ts`;
  the dated floor table lives beside `FLOOR_BANDS` in `scripts/balance-matrix.ts`.

## What measurement corrected during the retirement build

Recording these so they are not rediscovered the slow way:

- **The locked Layer-1 economy gates caught a real defect, and the right fix
  was code, not a band.** After retirement, `packs/day` measured 0.0714 against
  a 0.15 floor and the quest claim rate 0.0952 against 0.2. The cause was the
  progression sim playing `deck.cards` with no reserve — landless 40-card decks
  — not an economy shift. Migrating the sim to the reserve field restored every
  band with **zero band re-derivation**. The same fix repaired a pre-existing
  defect from reserve-native Limited: the sim's Limited matches had been
  playing 25 spells with no granted Warchest.
- The general lesson from this whole train: measurement kept correcting
  intuition. Curve looked like Valhalla's problem and was not. Removing
  Darlings looked right and the data said the opposite. Hand tuning lost to the
  builder in one case (Hel, 21 vs 33) and beat it in another (Morgan, 52 vs 46).

## How to measure anything here

`npx tsx scripts/balance-matrix.ts` modes: `--avatars-reserve`,
`--avatars-darlings`, `--player-decks`, `--warchest`, `--darlings`,
`--warchest-tuning`. `--only <ids>` shards by avatar, `--telemetry` adds
per-game metrics. The classic modes are retired along with the format.

**CPU discipline is a standing owner rule, tightened 2026-08-10 to 65%
total**: idle baseline on this box is ~35%, `npx tsx` spawns ~2.7 processes per
lane, and the measured totals are 2 lanes 47%, **3 lanes ~39-43%**, 4 lanes 63%
avg but 72% peak (now over the cap), 10 lanes 98% (pinned). Use **3 lanes max**
(2 with `--telemetry`), set them `BelowNormal`, and MEASURE with
`Get-Counter '\Processor(_Total)\% Processor Time'` rather than counting
processes. Full suite: `npx vitest run --maxWorkers=10` (~7 min, 1,418 tests) — but drop to
`--maxWorkers=4` when idle CPU is already high, or 5s-timeout tests (notably
`tests/personas/metagame.test.ts`) fail on starvation rather than on a real defect.
