<!-- source-of-truth: scripts/personas/craft.ts, scripts/run-sweep.ps1, .github/workflows/metagame-sweep.yml, tests/personas/fanout.test.ts · last-verified: 2026-09-22 -->

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

**What runs.** A `round-0` job per persona, then, for each later round, a check
job and a round job per persona. The check job merges the crafts that exist and
asks the loop's own convergence policy whether the sweep is already over; if
the decks were stable at the previous round, the round job skips, exactly as
the in-process loop would have stopped. Each craft job gets 350 minutes, and one
persona's timeout does not cancel the other five.

**What comes back.** Every craft is uploaded as its own artifact
(`craft-r<n>-<persona>`), and the `merge` job runs whatever finished through the
merge, uploads the result, and commits it to the orphan branch `sweep-data`:

```
sweeps/<run-date>-<seed>/crafts/     one craft-<persona>-r<n>.json per craft
sweeps/<run-date>-<seed>/artifacts/  the per-persona metagame artifacts
                                     and the merged craft journal
```

`sweep-data` is an orphan branch. Nothing the sweep produces ever reaches `main`,
which auto-deploys to Pages.

**How to resume.** A craft that hits its 350-minute timeout leaves no file and
no journal line; everything else is on `sweep-data`. Re-dispatch with the SAME
inputs and set `resume_from` to the committed directory, for example
`sweeps/2026-09-22-13003`. Each round job checks that directory first, and a
persona whose craft for that round is already there exits without recrafting.
Only the lost crafts run again. A partial sweep still merges: the merge reports
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
