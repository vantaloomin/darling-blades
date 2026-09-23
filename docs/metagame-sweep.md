<!-- source-of-truth: scripts/personas/craft.ts, scripts/run-sweep.ps1, .github/workflows/metagame-sweep.yml, .github/workflows/metagame-sweep-round.yml, tests/personas/fanout.test.ts · last-verified: 2026-09-23 -->

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
