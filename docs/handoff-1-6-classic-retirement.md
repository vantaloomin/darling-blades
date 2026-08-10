<!-- source-of-truth: docs/plan-1.6.md, src/data/opponents.ts, src/config/features.ts, src/ai/tiers.ts · last-verified: 2026-08-10 · handoff doc — delete once the floor re-centre ships -->

# 1.6 handoff: the floor re-centre is the remaining work

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

Mechanism, decisions, and the durable "facts a fresh session gets wrong" list
now live in [plan-1.6.md](plan-1.6.md). This doc is only the re-centre handoff.

## The one job left: re-centre the floors

The owner's pre-authorization for a **downward** re-centre is standing and
unused. It was correctly not spent before now: re-centring classic floors while
classic still ran would have moved numbers nothing measured.

- **Measure against** the dated 2026-08-09 reserve table in `opponents.ts`.
  That is now the only live baseline; W7 stopped being the classic authority
  the moment retirement landed.
- **Do not re-open re-tiering.** The Tower shuffles its roster daily
  (`resolveGauntletRoster`) and takes brain strength from the FLOOR
  (`floorBrain`), not the avatar, so avatar `tier` does not decide who a player
  meets at rung N. Re-tiering was dropped from 1.6 for exactly this reason.
- The measured tier ladder and its plateaus are stamped in `src/ai/tiers.ts`.

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
processes. Full suite: `npx vitest run --maxWorkers=10` (~7 min, 1,411 tests).
