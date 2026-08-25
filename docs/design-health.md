<!-- source-of-truth: src/data/cards, scripts/blades-db.ts · last-verified: 2026-08-25 · design doc — pool-wide health metrics; re-measure when a set ships -->

# Design health

Pool-wide measurements that no single set's review would catch. Each one is
cheap to re-run and easy to ignore until it is a problem, which is exactly why
it is written down.

Measured with the local card workbench (`balance/cards.sqlite`, rebuilt by
`npx tsx scripts/blades-db.ts build`). The workbench is gitignored and absent
from a fresh clone, so the numbers live here rather than only in a script.

## Functional duplicate rate

A card counts as a functional duplicate when an earlier set already printed one
with the **same normalised mana cost, the same power and toughness, and the same
rules text**. Names, art, subtypes and flavor are ignored.

Measured 2026-08-25 across 1,079 collectible cards:

| Set | Duplicates of an earlier set | Rate |
| --- | --- | --- |
| Base Set | 0 / 213 | 0.0% |
| Ragnarök | 3 / 71 | 4.2% |
| Silver Veil | 8 / 84 | 9.5% |
| Grail Oath | 8 / 83 | 9.6% |
| Nocturne Manor | 9 / 83 | 10.8% |
| Dark Tales | 21 / 180 | 11.7% |
| Yokai Nights | 19 / 120 | 15.8% |
| Sands of the Duat | 39 / 245 | 15.9% |

**The trend is the finding, not any single number.** Zero to sixteen percent
across eight sets is the kind of drift that is invisible set by set: each one
looked reasonable while it was being reviewed.

**This is not automatically bad.** Baseline bodies repeat on purpose, and a
duplicate whose SUBTYPE differs is genuinely a different card in a game with
tribal payoffs. When the Starborne draft was audited, eight of its ten
duplicates were creatures separated by subtype (`Alien Soldier` against
`Squire`) and only two were spells with nothing to tell them apart. Spells are
where the metric bites, because a Charm has no tribe to distinguish it.

**Suggested reading:** treat anything above Duat's 15.9% as a signal to look at
the spell duplicates specifically, not as a target to optimise down. The goal is
that someone notices, not that the number is small.

### Re-measuring

There is no committed script, because the corpus it reads is gitignored. The
query is a self-join over `cards` and `printings` grouped by
`(normalised cost, power/toughness, normalised oracle text)`, ordered by
`released_at`, counting rows whose signature first appeared in an earlier set.
Rebuild the DB first; a stale corpus silently reports the previous pool.

## Related

- [blades-card-db.md](blades-card-db.md) is the workbench's own documentation
  (local-only, absent from a fresh clone).
- [keyword-map.md](keyword-map.md) records which keywords are evergreen and
  therefore expected to recur across sets. Recurrence there is intended;
  duplicate STATLINES are what this page tracks.
