<!-- source-of-truth: scripts/personas/craft.ts, scripts/personas/lever.ts, scripts/personas/compare-crafts.ts, scripts/run-sweep.ps1, .github/workflows/metagame-sweep.yml, .github/workflows/metagame-sweep-round.yml, tests/personas/fanout.test.ts, tests/personas/lever.test.ts · last-verified: 2026-09-28 -->

# The persona metagame sweep

The sweep is the last measurement before a cut: it asks whether the card pool
lets any deck run away from the field. It crafts a deck for each of six
personas against a reference field, then re-crafts each persona against the
field the other five produced, for up to four best-response rounds, and reports
whether the decks settle, oscillate, or are still moving when the rounds run
out.

One craft is a hill climb: a greedy build, then up to 80 proposed card swaps,
each measured by playing the candidate list against every deck in the field at
150 seeds per matchup, Hard brain on both seats. That is 170,100 games in the
worst case, per craft, and 30 crafts in a four-round sweep.

Two ways to run it. They measure the same thing.

## On the owner's machine

```powershell
.\scripts\run-sweep.ps1                     # start a fresh sweep
.\scripts\run-sweep.ps1 -Resume             # continue from the journal
.\scripts\run-sweep.ps1 -Workers 16         # use more of the box
.\scripts\run-sweep.ps1 -Status             # is it alive, and how far in
.\scripts\run-sweep.ps1 -Stop               # end it (the journal is kept)
```

It runs as a Windows Scheduled Task so it outlives the shell that started it,
writes the per-persona artifacts to `balance/sweep-current/`, and appends every
finished craft to `balance/sweep-current/craft-journal.jsonl` synchronously, so
a killed run keeps everything it completed. `npm run sweep-dash` watches it.

Measured on a 9950X3D, 2026-09-22: three to five days at eight workers. Nothing
else heavy may run beside it, and the metagame sweep is the final pre-launch
step, never a mid-train gate.

## Running the sweep on GitHub

`.github/workflows/metagame-sweep.yml` runs the same sweep on GitHub-hosted
runners, six crafts at a time, and the owner's machine does nothing. The crafts
inside a round are independent and every craft's seed derives from the run seed,
the round and the persona id, so a craft is the same craft wherever it runs.
Only the rounds are sequential.

**What to dispatch.** Actions tab, "Metagame sweep", Run workflow. The inputs
default to the real sweep: seed 13003, four rounds, the `prefabs` field, 150
seeds per matchup, 80 hill-climb iterations, all six personas. For a dry run,
set seeds 10, iterations 5, rounds 1.

**What runs.** Round 0, then, for each later round, a check job and the round.
Every round is one call to `.github/workflows/metagame-sweep-round.yml`, which
runs each persona's craft as a chain of chunk jobs (below). The check job merges
the crafts that exist and asks the loop's own convergence policy whether the
sweep is already over; if the decks were stable at the previous round, the next
round skips, exactly as the in-process loop would have stopped. Each chunk job
gets 350 minutes, and one persona's failure does not cancel the other five.

**Why a craft is split into chunks.** GitHub stops a hosted job at 360 minutes,
and a whole craft at the defaults does not fit on the 4-core `ubuntu-latest`
runner: the first fanned-out sweep (run 35764255645, 2026-09-22) ran each craft
as one job, and four of the six hit the 350-minute job timeout (GitHub reports
a timeout as `cancelled`). The cap cannot be raised, and a resume re-runs the
same deterministic work into the same wall, so a craft now runs as a chain of
jobs, each saving the hill climb's state for the next.

**Why the chunks stop on time, not on iterations.** The chunked sweep that
followed (run 35810005716, 2026-09-23, the defaults: 150 seeds, 80 iterations,
the prefab field, Hard on both seats) sized chunks at 20 iterations. Round 0,
chunk 0 (the greedy build plus 20 iterations, so 21 measurements of 14 matchups
x 150 games) took:

| Persona | Round 0, chunk 0 |
| --- | --- |
| midrange | 42 min |
| burn | 64 min |
| reanimator | 75 min |
| draw-go | 147 min |
| attrition | 226 min |
| weenie | hit the 350-min job timeout |

The chunked dry run (seeds 10, iterations 5) had the same spread: weenie's
chunk 0 took 4 min 43 s against midrange's 1 min 10 s. Per game, weenie is
roughly ten times slower than midrange (long go-wide boards are expensive for
the Hard brain). That puts one weenie measurement near twenty minutes, and a
whole weenie craft (81 measurements) near 27 hours of runner time. A chunk sized
in iterations cannot be right for both midrange and weenie, and the measurement
may not change during a sweep, so a chunk stops on a time budget instead.

**The chunk design.** `metagame-sweep.yml` sets `CHUNK_MINUTES: '240'` and
`CHUNKS: '10'`. Each chunk job runs `--metagame-craft ... --chunk-minutes 240`:
the clock starts when the craft command starts (before the greedy build and its
measurement, so the budget covers everything the job spends measuring), no new
iteration begins once 240 minutes have passed, and the iteration in flight
finishes. Every chunk runs at least one iteration, even one that starts past
its budget, so the chain always makes progress. 240 minutes leaves room inside
the 350-minute job for that iteration in flight (20 minutes or more for weenie),
`npm ci`, and the upload; the setup job refuses a `CHUNK_MINUTES` of 300 or
more, and a `CHUNKS` outside 1 to 10. Ten chunks of 240 minutes hold about 40
hours of measuring per craft, room for weenie's 27 with a margin. Per persona,
the round runs:

```
chunk-0  fresh start (or the craft copied forward from resume_from)
chunk-1  continues chunk-0's checkpoint, or copies its finished craft forward
chunk-2  the same, from chunk-1
...
chunk-9  the same, from chunk-8; names the journal and uploads craft-r<n>-<persona>
```

Each chunk after the first continues with `--resume-from state` from the
previous chunk's artifact, and every chunk uploads its `out/` as
`chunk-r<n>-c<c>-<persona>`. That artifact holds either
`checkpoint-<persona>-r<n>.json` (the craft is not finished) or the finished
`craft-<persona>-r<n>.json` with its journal line; chunk artifacts are kept five
days and never match the `craft-r*-*` pattern the check and merge jobs read. A
checkpoint carries the hill climb's whole state (the next iteration, the rng,
the greedy and retained builds with their measurements, the accepted-swap log
and the two counters), the run configuration, the craft seed, and a fingerprint
of the field it was climbed against, so it refuses to continue under a
different configuration, round, or field. A craft that has not finished by the
end of its last chunk fails there, with a message naming `CHUNKS` and
`CHUNK_MINUTES`. A craft that finishes early is copied forward by the later
chunks; expect about a minute each for those (checkout, `npm ci`, a copy), so a
dry run at iterations 5 finishes in chunk 0 and nine copy-forward chunks follow.
Chunk boundaries do not enter the result: wherever the budget stops a chunk, a
craft finished in several chunks is byte-identical to one finished in one
process, which `tests/personas/fanout.test.ts` asserts on a small run (chunks
stopped by iteration count and by a test-driven clock) and under the real
engine.

**What to expect on the wall clock.** Each chunk job waits for every persona's
previous chunk, so a round lasts as long as its slowest craft. While weenie is
the slowest persona, a round is about 27 hours of chain, a little more for each
chunk's setup, and a later round measures against 19 decks (the reference field
plus the other five personas) instead of 14. The whole sweep is therefore
several days of wall clock on GitHub, with the owner's machine idle throughout.
The workflow cannot shorten that; the lever that would is the cost of a weenie
game in the Hard brain, which is a 1.9 item.

**What comes back.** Every finished craft is uploaded as its own artifact
(`craft-r<n>-<persona>`), and the `merge` job runs whatever finished through the
merge, uploads the result, and commits it to the orphan branch `sweep-data`:

```
sweeps/<run-date>-<seed>/crafts/     one craft-<persona>-r<n>.json per craft
sweeps/<run-date>-<seed>/artifacts/  the per-persona metagame artifacts
                                     and the merged craft journal
```

`sweep-data` is an orphan branch. Nothing the sweep produces ever reaches `main`,
which auto-deploys to Pages.

**How to resume.** A craft that fails or times out in any of its chunks leaves
no finished file and no journal line; everything else is on `sweep-data`.
Re-dispatch with the SAME inputs and set `resume_from` to the committed
directory, for example `sweeps/2026-09-22-13003`. Chunk 0 of each round checks
that directory first, and a persona whose craft for that round is already there
is copied forward through the chain without recrafting. Only the lost crafts run
again. Resume across dispatches works at craft granularity: a lost craft starts
over at chunk 0. Publishing checkpoints to `sweep-data` so a new dispatch could
pick up mid-craft is a non-goal; the chunk artifacts live only inside one run. A
partial sweep still merges: the merge reports
which personas are missing from an incomplete round, merges the rounds that are
complete, and fails only when round 0 never finished for every persona.

**The result is the same measurement.** The merged per-persona artifacts and the
merged journal are byte-identical to a local `npx tsx scripts/personas/craft.ts
--metagame --all` at the same seed. `tests/personas/fanout.test.ts` asserts that
file for file on a small run, and the merge replays the rounds through
`advanceMetagameRound`, the one implementation of the stopping policy that the
in-process loop also calls. Worker count does not enter the result: a game's
seed is derived from its matchup and its index in the matchup, not from which
worker ran it (measured 2026-09-22: the same craft at one, two and four workers
produced byte-identical files), so a four-core runner and a sixteen-worker local
run agree.

## Racing and screening the swaps (levers 2 and 3)

Two flags make a craft cheaper without changing what accepts a swap. Both are
**off by default**, and stay off until the one-persona acceptance run in
[plan-sweep-speed.md](plan-sweep-speed.md) passes (lane F of
[plan-1.9.md](plan-1.9.md)). Built 2026-09-28; the statistics live in
`scripts/personas/lever.ts`, the hill-climb step in `craft.ts`.

**`--race`** (lever 2). A proposed swap is measured in batches of
`--race-batch` seeds per matchup (default 30, so 420 games against the
14-deck prefab field) and stopped at an interim look once it clearly trails
the incumbent. The comparison is paired: a game's seed derives from its matchup
and its index, never from the deck, so the candidate's game j and the
incumbent's game j share a shuffle seed, an opponent and a seat. The statistic
is the standardised mean of the per-game differences (win 1, draw 1/2,
loss 0) over every matchup. Stopping at any of several looks inflates false
stops, so the boundary is not the one-look critical value: it is the constant
group sequential (Pocock-type) boundary that holds the chance of stopping an
exactly-equal swap, across all the interim looks together, to `--race-alpha`
(default 0.01). At 150 seeds and batch 30 the looks are 30, 60, 90 and 120
seeds and the boundary is z = -2.705 (one look alone would need -2.326).
The final look is not a test: a swap that survives the interim looks, or that
is ahead, runs the full `--seeds` and meets the hill climb's ordinary rule
(accept when its score beats the incumbent's). **An accepted swap therefore
always carries its full-precision measurement**, and when the race stops
nothing that the full measurement would have accepted, a raced craft's
decks and measurements are the unraced craft's exactly.

**`--screen medium`** (lever 3). Before any Hard game, the swap and the
incumbent are measured Medium-vs-Medium on `--screen-seeds` per matchup
(default `--seeds`), and a swap Medium scores worse than the incumbent by more
than `--screen-threshold` points (default 5) is dropped. This is the plan's
threshold rule, not a test. A swap that passes goes on to the Hard measurement
(raced, if `--race` is on), and only the Hard measurement accepts. The
incumbent's Medium score is measured once, for the greedy build; an accepted
swap's own Medium score becomes the next incumbent's.

**What a raced craft records.** The flags enter the run configuration
(`config.race`, `config.screen`), so a raced craft never merges, resumes or
continues a checkpoint alongside an unraced one: the merge and the resume
refuse it as a different sweep. An unraced, unscreened craft has no such keys
and is byte-identical to what it was before the levers existed. The hill-climb
log of a raced or screened craft gains `lever`: the race plan (batch, alpha,
looks, boundary), the screen settings, and one record per proposed swap:

| Field | Meaning |
| --- | --- |
| `stop` | `screened-out`, `raced-out`, or `full` (measured at the full seeds) |
| `accepted` | only ever true for `full` |
| `hardGames`, `screenGames` | the games this swap's decision played |
| `screenDelta` | candidate minus incumbent Medium score, in points |
| `racedAt`, `z` | raced out: the look (seeds per matchup) and the statistic there |

Each craft prints its accounting: swaps proposed, screened out, raced out,
measured in full, accepted, and the Hard and Medium games played against the
Hard games the same proposals cost unraced (every one a full measurement).
It prints game counts only, with no Hard-equivalent: the Medium/Hard speed
ratio depends on the machine and its load (measured 2026-09-28,
single-threaded, a greedy deck against the 14-deck prefab field: 5.9x to 6.0x
on the owner's machine, about 3.4x in the review's run), so wall clock on the
runner is the real measure of the saving.

**Determinism, chunks and resume.** A raced craft's stops are a pure function
of the games, and the games are a pure function of the seeds, so a raced craft
is reproducible from its seed at any worker count, and a chunked raced craft
is byte-identical to one run in a single process (the checkpoint carries the
incumbent's per-game outcomes, its Medium record and the lever log). The
in-process loop's `--resume` and the fan-out's `--resume-from` work unchanged;
give the same lever flags on every call. `tests/personas/lever.test.ts`
covers the boundary against Pocock's published constants, the false-stop rate
over repeated looks, constructed win-rate sequences whose right decision is
known, the chunked byte identity, and a real-engine craft whose race and
screen never stop anything reproducing the unraced craft byte for byte.

```bash
# One persona, round 0, raced and screened, as the hosted workflow runs it.
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 0 \
  --out out --workers 4 --race --screen medium <same flags as above>
# The knobs, with their defaults.
  --race --race-batch 30 --race-alpha 0.01
  --screen medium --screen-threshold 5 --screen-seeds <--seeds>
```

On GitHub, the "Metagame sweep" dispatch has three inputs for them: `race`
(a checkbox) and `screen` (`none` or `medium`), both off by default, and
`screen_seeds` (blank by default; with `screen` medium, it sets
`--screen-seeds`). They add the flags with the defaults above to every craft.
A raced or screened sweep publishes to its own directory,
`sweeps/<run-date>-<seed>` plus `-race`, `-screen` and `-s<screen seeds>` as
they apply, so it never overwrites an unraced sweep of the same seed and day.
Resume it with the same inputs.

### The acceptance run

The flags become the default only if raced crafts accept what unraced crafts
accept (plan-sweep-speed.md, owner decision 3). The run is one persona, the
same seed, in separate arms. The Medium screen is not assumed to pay: at the
reviewer's measured 3.4x, a full-seeds screen costs about 0.29 of a full Hard
measurement on EVERY proposal, while the swaps it drops (more than five points
worse under Medium) are ones the race already stops at its first look, about
0.2 of a full measurement. So race alone is its own arm, and a cheaper screen
is a fourth:

| Arm | Inputs | Publishes to |
| --- | --- | --- |
| plain | none | `sweeps/<date>-13003` |
| race | `race=true` | `sweeps/<date>-13003-race` |
| race + screen | `race=true screen=medium` | `sweeps/<date>-13003-race-screen` |
| race + cheap screen (optional) | `race=true screen=medium screen_seeds=50` | `sweeps/<date>-13003-race-screen-s50` |

```bash
REF=release/1.9   # any ref holding this workflow and craft.ts
gh workflow run metagame-sweep.yml --ref $REF -f personas=midrange -f rounds=1
gh workflow run metagame-sweep.yml --ref $REF -f personas=midrange -f rounds=1 -f race=true
gh workflow run metagame-sweep.yml --ref $REF -f personas=midrange -f rounds=1 -f race=true -f screen=medium
gh workflow run metagame-sweep.yml --ref $REF -f personas=midrange -f rounds=1 -f race=true -f screen=medium -f screen_seeds=50
```

- **Dispatch one arm at a time, each after the previous run finishes.** The
  workflow's concurrency group holds one running and one pending run, and a
  newer pending dispatch cancels the older pending one.
- **Two crafts per arm.** With one persona and `rounds=1`, each run crafts
  round 0 and round 1. Round 1 answers the same 14 reference decks (there are
  no other personas) under a different craft seed and different game seeds, so
  it is a second, independent comparison, not wasted work. The seed is the
  default 13003 in every arm.
- **Wall clock** is each run's craft chunk jobs in the Actions tab. The
  printed `Levers:` lines give the game counts.
- **Compare** each round's crafts side by side. From `sweep-data`:

```bash
git fetch origin sweep-data
for arm in "" -race -race-screen -race-screen-s50; do
  mkdir -p "acceptance/arm$arm"
  for r in 0 1; do
    git show "origin/sweep-data:sweeps/<date>-13003$arm/crafts/craft-midrange-r$r.json" \
      > "acceptance/arm$arm/craft-midrange-r$r.json"
  done
done
npx tsx scripts/personas/compare-crafts.ts acceptance/arm/craft-midrange-r0.json \
  acceptance/arm-race/craft-midrange-r0.json acceptance/arm-race-screen/craft-midrange-r0.json \
  acceptance/arm-race-screen-s50/craft-midrange-r0.json
# and the same for r1
```

`scripts/personas/compare-crafts.ts` takes two to four craft files of the same
persona and round, the unraced one first. It prints the accepted swaps
iteration by iteration, each arm's final deck against the first arm's, the
final scores, each arm's games (proposed, screened out, raced out, in full,
accepted, Hard games as a share of unraced, Medium games), and whether each arm
is the first arm exactly once `config.race`, `config.screen` and
`hillClimb.lever` are stripped. The gate's reading: an arm passes when its
final win rates sit within the noise of the plain arm's (at 2,100 games a
score's standard error is about 1.1 points, so a gap of about 3 points or
more is not noise) in both rounds, and its wall clock is materially shorter.
Identical accepted lists are the best case, not the requirement: one differing
decision sends the rest of the climb down another path.

## The command shapes behind both

The workflow calls two modes of the crafting harness directly. They are useful
by hand when a sweep needs unpicking.

```bash
# One persona, one round. Round 0 crafts against the static field; a later
# round reads the previous round's crafts, one file per persona, from --field-dir.
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 1 \
  --field-dir field --out out --workers 4 \
  --personas burn,draw-go,attrition,reanimator,weenie,midrange \
  --rounds 4 --field prefabs --pool all --seeds 150 --iterations 80 --seed 13003

# The same craft in chunks of 240 minutes, as the workflow runs it. Each call
# prints craft-complete= and next-iteration=; until it finishes, it writes
# <out>/checkpoint-burn-r1.json and the next call continues from it. The call
# that reaches --iterations writes the craft and journal line an unchunked craft
# writes, byte for byte. --chunk-iterations <n> bounds a chunk by iteration
# count instead, or as well: whichever bound comes first ends the chunk.
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 1 \
  --field-dir field --out c0 --chunk-minutes 240 --workers 4 <same flags>
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 1 \
  --field-dir field --resume-from c0 --out c1 --chunk-minutes 240 --workers 4 <same flags>

# Every craft under a directory, replayed through the loop's convergence policy.
npx tsx scripts/personas/craft.ts --metagame-merge sweep --out merged
npx tsx scripts/personas/craft.ts --metagame-merge sweep --check-stable
```

Every craft file carries the run configuration it belongs to (seed, seeds,
iterations, rounds, personas, template version, pool, field). A merge refuses a
file from a different sweep rather than mixing two measurements, and a round
refuses a field directory that is missing a persona or was crafted from another
seed.

`--check-stable` writes nothing and prints the verdict as `key=value` lines
(`stable`, `done`, `stopped-reason`, `completed-rounds`), which is how the
workflow turns it into a job output.
