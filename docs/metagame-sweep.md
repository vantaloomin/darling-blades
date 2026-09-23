<!-- source-of-truth: scripts/personas/craft.ts, scripts/run-sweep.ps1, .github/workflows/metagame-sweep.yml, .github/workflows/metagame-sweep-round.yml, tests/personas/fanout.test.ts · last-verified: 2026-09-22 -->

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
runner. The first fanned-out sweep (run 35764255645, 2026-09-22, defaults: 150
seeds, 80 iterations, the prefab field, Hard on both seats) measured round 0:

| Persona | Round 0, one job |
| --- | --- |
| midrange | finished in 270 min |
| burn | finished in 347 min |
| attrition | hit the 350-min job timeout |
| draw-go | hit the 350-min job timeout |
| reanimator | hit the 350-min job timeout |
| weenie | hit the 350-min job timeout |

GitHub reports a timeout as `cancelled`. One candidate measurement (14 matchups
x 150 games) takes roughly four to six minutes on that runner, and a craft is 81
of them (the greedy build, then one per iteration). The cap cannot be raised,
and a resume re-runs the same deterministic work into the same wall, so a craft
now stops after a fixed number of iterations, saves its state, and the next job
continues it.

**The chunk design.** `metagame-sweep.yml` sets `CHUNK_ITERATIONS: '20'` and
`CHUNKS: '4'`. Twenty iterations is about 80 to 130 minutes of measuring, well
inside the limit, and four chunks hold the default 80. The setup job refuses a
dispatch whose `iterations` exceed `CHUNKS x CHUNK_ITERATIONS` before any runner
starts. Per persona, the round runs:

```
chunk-0  fresh start (or the craft copied forward from resume_from)
chunk-1  continues chunk-0's checkpoint, or copies its finished craft forward
chunk-2  the same, from chunk-1
chunk-3  the same, from chunk-2; names the journal and uploads craft-r<n>-<persona>
```

Each chunk job runs `--metagame-craft ... --chunk-iterations 20`, continuing
with `--resume-from state` from the previous chunk's artifact, and uploads its
`out/` as `chunk-r<n>-c<c>-<persona>`. That artifact holds either
`checkpoint-<persona>-r<n>.json` (the craft is not finished) or the finished
`craft-<persona>-r<n>.json` with its journal line; chunk artifacts are kept five
days and never match the `craft-r*-*` pattern the check and merge jobs read. A
checkpoint carries the hill climb's whole state (the next iteration, the rng,
the greedy and retained builds with their measurements, the accepted-swap log
and the two counters), the run configuration, the craft seed, and a fingerprint
of the field it was climbed against, so it refuses to continue under a
different configuration, round, or field. A craft that finishes early (a dry
run at iterations 5 finishes in chunk 0) is copied forward by the later chunks;
expect about a minute each for those (checkout, `npm ci`, a copy). Chunk boundaries do not enter the result: a craft
finished in several chunks is byte-identical to one finished in one process,
which `tests/personas/fanout.test.ts` asserts on a small run and under the real
engine.

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

# The same craft in chunks of 20 iterations. Each call prints craft-complete=
# and next-iteration=; until it finishes, it writes out/checkpoint-burn-r1.json
# and the next call continues from it. The call that reaches --iterations
# writes the craft and journal line an unchunked craft writes, byte for byte.
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 1 \
  --field-dir field --out c0 --chunk-iterations 20 --workers 4 <same flags>
npx tsx scripts/personas/craft.ts --metagame-craft burn --round 1 \
  --field-dir field --resume-from c0 --out c1 --chunk-iterations 20 --workers 4 <same flags>

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
