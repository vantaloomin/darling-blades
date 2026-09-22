<!-- source-of-truth: scripts/personas/craft.ts, scripts/personas/measure-worker.ts, scripts/run-sweep.ps1, docs/plan-battle-box.md, memory sweep-running-do-not-disturb · last-verified: 2026-09-22 · PROPOSAL, nothing authorized -->

# Making the metagame sweep fit in a night

**Status: proposal, 2026-09-22. Nothing here is authorized.** Owner ask:
the sweep takes three to five days on a 9950X3D, which is too long for the
one step that has to run last before every cut. This is the measured
account of where the days go and four levers, in the order I would pull
them, with what each is expected to buy and what it changes about the
answer.

## Where the time goes, measured

The sweep (`scripts/personas/craft.ts`, run by `scripts/run-sweep.ps1`)
crafts a deck for each of six personas against a reference field, then
re-crafts each against the field the others produced, for up to four
rounds. One craft is a hill climb: 80 proposed card swaps, each measured
by playing the candidate list against every deck in the field.

| Quantity | Value | Where it comes from |
| --- | --- | --- |
| Field | 14 reference decks | `--field prefabs` (personas mode grows it) |
| Games per measurement | 14 x 150 seeds = 2,100 | `DEFAULT_SEEDS = 150` |
| Measurements per craft | up to 81 (initial + 80 swaps; memoised by list) | `DEFAULT_ITERATIONS = 80` |
| Games per craft, worst case | 170,100 | product |
| Crafts per sweep | 6 personas x (1 + up to 4 rounds) = 30 | `DEFAULT_METAGAME_ROUNDS = 4` |
| Games per sweep, worst case | 5.1 million | product |
| Hard-vs-Hard throughput, one process | 7.4 games/s | measured 2026-09-22, starter mirror |
| Medium-vs-Medium, one process | 43 games/s | same probe; the Hard search is the cost |
| Workers used | 8 | `run-sweep.ps1` default; measured 34 percent CPU at 8 |
| Swaps accepted per craft | 16 to 31 of 80 | the 2026-08-31 journal, all 18 crafts |

At 8 workers x 7.4 games/s the worst case is 24 hours of pure simulation;
control-heavy personas run longer games than the starter mirror, and the
observed craft times (Burn 94 min, Draw-Go 183 min, Attrition 3 h 43 min)
put a four-round sweep at three to five days. Two facts in that table are
the whole story: **the machine is three-quarters idle** (8 workers on 32
threads, by the CPU policy), and **two thirds of every craft's games measure
a swap that loses**, at the full 2,100-game precision a swap only needs if
it is close.

## The levers

### 1. Use the cores the policy allows (no change to the answer)

The CPU cap is 65 percent under load. Eight workers measured 34 percent, so
sixteen fit inside the cap with the machine otherwise idle. `run-sweep.ps1
-Workers 16`. Expected: about 2x. Cost: nothing. Caveat: not while a suite
or a matrix runs beside it.

### 2. Race the swaps (changes how much precision a losing swap gets)

Measure a candidate in batches (say 30 seeds per reference deck, 420 games)
and stop early when the candidate's win rate is already outside the
incumbent's by more than the noise at that sample size. A swap that loses
by ten points is settled after one batch; only a close swap runs the full
150 seeds. The accepted swap keeps its full-precision measurement, so the
recorded artifact is as precise as today; only the rejections get cheaper.
Expected: 2 to 3x on the two thirds of games that measure losers. This is
the standard sequential-test idea; the implementation is a loop around
`runParallelGames` with a confidence-interval test, in the one measurement
function the hill climb already calls.

### 3. Screen with Medium, confirm with Hard (changes the proposer, not the gate)

A Medium-vs-Medium game is six times cheaper. Use it as a screen: measure
every proposed swap under Medium first, and only send to the Hard
measurement the ones that are not clearly worse than the incumbent under
Medium. The Hard measurement stays the only thing that accepts a swap, so
the artifact's meaning is unchanged. The risk is a swap Medium undervalues
and Hard would have taken; the AI audit found the opposite case (decks
propped by opponent misplay) more often, and a screen threshold of "not
worse by five points under Medium" keeps the false-reject rate small.
Expected: 2x on top of racing. Worth measuring on one persona before
trusting it.

### 4. Fan out across machines (the wall-clock lever)

The six personas in a round are independent; only rounds are sequential.
The repository is public, and public repositories get GitHub-hosted Linux
runners at no cost. A `workflow_dispatch` workflow with one job per persona
per round (six jobs in parallel, each `craft.ts --persona <id> --round n`
against the previous round's uploaded artifacts, with the journal as an
artifact between rounds and `--resume` for a rerun) runs a whole round in
the time of the slowest craft on a 4-vCPU runner, and the owner's machine
does nothing. With levers 2 and 3 a craft fits well inside a runner's
six-hour job limit; without them, Attrition does not.

## What I recommend

For 1.8, where the field is nearly final and the question is "does anything
degenerate exist", levers 1 and 4 need no change to what the sweep
measures: run the existing sweep with sixteen workers if it runs locally,
or fan it out on Actions. Either turns three to five days into one night.

For 1.9, build levers 2 and 3 into `craft.ts` behind flags (`--race`,
`--screen medium`) with a measured comparison on one persona: same seed,
raced and unraced, the accepted lists and their final win rates side by
side. If the accepted lists agree within noise, the flags become the
default and a four-round sweep on the owner's machine is a few hours.

## Owner decisions

1. Lever 1 now, for 1.8? (Sixteen workers, nothing else running beside it.)
2. Lever 4 now, for 1.8? (A workflow file and a small `--round` plumbing
   change; the sweep leaves the owner's machine.)
3. Levers 2 and 3 for 1.9, behind flags, with the one-persona comparison as
   the acceptance gate?
