<!-- source-of-truth: tests/, docs/claude-playbook.md · last-verified: 2026-09-22 -->

# Test-suite audit, 2026-09-22

On 2026-09-22 the owner set three rules for the suite and asked for an audit
and a slimming pass against them:

1. **Tautological tests considered harmful.** A test whose expectation comes
   from the code or data it checks cannot fail when the behaviour is wrong.
2. **Change-detector tests considered harmful.** A test that pins an
   incidental output so that any intentional change fails it without
   indicating a bug.
3. **Do not create regression tests for bug fixes without a genuine gap in
   behaviour testing.**

The rules, with what does not count as a violation, are written into
[claude-playbook.md](claude-playbook.md) section 4, item 7, and are quoted
into every contract that writes tests.

## Method

Every one of the 251 test files (3,838 tests at the start, counted as `it`
and `test` declarations plus `it.each` expansions) was read in full by one
of four auditors, each with the three rules, the exemptions below, and a
fixed verdict format: KEEP, CUT-TAUTOLOGY, CUT-CHANGE-DETECTOR,
CUT-REDUNDANT-REGRESSION, or BORDERLINE with the reason on both sides. The
main session decided every borderline and every cut, cross-checked against
its own mechanical pass (hash pins, snapshots, numeric-array pins, bug-named
tests, length pins), and one agent applied the decided list. The four
reports and the decided list are in the session record.

**Not a violation, by rule:** measured gates and floors (win rates, economy
EV bands, timing budgets); golden fixtures that guard an on-disk or
on-the-wire compatibility contract (save codes, deck share codes, replay
logs, the Worker schema, migration inputs from old versions); determinism
tests; data-integrity invariants (unique ids, every token referenced exists,
every keyword has glossary text, the locked per-set rarity histograms);
layout tests that assert a rule (inside the safe frame, a minimum gap, a
shared edge). A literal that is the correct answer to a scenario is
behaviour.

## Verdict, by slice

| Slice | Files | Keep | Tautology | Change-detector | Redundant regression | Borderline |
| --- | --- | --- | --- | --- | --- | --- |
| engine | 55 | 94 groups | 11 | 0 | 1 | 11 |
| meta | 51 | 128 groups | 5 | 6 | 1 | 13 |
| ui, art, audio, platform, dev, effects | 65 | 233 groups | 8 | 14 | 0 | 26 |
| ai, data, net, personas, scripts, worker, config | 81 | 194 groups | 5 | 7 | 1 | 29 |

The suite was in better shape than the rules' existence suggests. The
overwhelming majority of tests assert behaviour on synthetic fixtures,
measured gates with their measurements recorded inline, compatibility
goldens, or real data invariants. Three directories had nothing to cut at
all: `tests/net`, `tests/worker` and the two `signalsRollup` files, which
are cross-source contracts (code against the published privacy policy),
generated exhaustive probes, and known limitations pinned as limitations.

## The systemic patterns

Almost every cut belongs to one of five patterns.

1. **A constant asserted against its own definition.** `CURRENT_RULES_REV`
   and `REPLAY_LOG_VERSION` were pinned as literals in five engine files;
   the one pin in `tests/meta/replay.test.ts` is the tripwire that forces a
   new legacy-path test on each bump, and it stays. `theme.test.ts` asserted
   ten token tables against their own definitions. Batch sizes, insets,
   scales, multipliers, `ECONOMY.craftCostMult`.
2. **A hash or snapshot over a generated table.** Four SHA-256 pins (all
   rendered rules text, all persona rates, both twice: shipped and Drowned
   Deep) and one cast-ladder hash over 932 creature valuations, plus one
   vitest snapshot of generated deck counts. Each had been re-baselined for
   a correct change, one of them three times in four days. Each sat beside
   relational tests of the same function that are strictly more informative.
3. **A count of a data set.** The whole-catalog totals (1,515 / 1,259 /
   1,482) in two files; set sizes duplicated in `achievements.test.ts` from
   the per-set histogram tests that own them; cosmetic catalog counts; the
   persona roster; the sort-option count; the SFX count. The per-set rarity
   histograms are a locked design contract and stay; a whole-catalog total
   has no contract behind it and fails on every card added anywhere.
4. **An rng stream pinned as a literal sequence.** Two tests pinned twelve
   Easy-AI action types at seed 41, each beside a correct same-seed
   determinism test. Rewritten as "the sequence is mixed".
5. **Source text asserted as a string.** Two toast tests matched raw source
   including a semicolon; one shop test matched an `else if` block by regex.

Two idioms were resolved as a policy rather than per test:

- **`expect(play()).toBe(play())`** appeared in seven Drowned Deep engine
  files. The scenarios have no RNG, so this is `f(x) === f(x)`. What it
  guarded, module-level state leaking between `Game` instances, is now one
  test in `determinism.test.ts`.
- **Exact rects in the primitive geometry tests** (`dropdownGeometry`,
  `anchoredRect`, `inflateHitArea`, `measuredRowsLayout`, the glossary
  viewport) are kept: the rect is the function's return value, and the
  relational assertions sit beside them. The pixel pins that duplicated
  those numbers in a second file (`binderSetFilter`) were cut.

## Borderlines kept on purpose

These read as pins by form and were kept because the pinned thing is a
contract the owner made, with the cost named:

- **Owner-approved player copy asserted verbatim:** the Darlings tutorial
  explainer, the Warchest and Darlings rules copy, the seven tutorial cue
  sentences, three ruled glossary definitions, the 27 generated Duty lines
  of the land economy (the transcription proof of a one-time conversion),
  one shop paragraph, the Duty confirmation labels. The copy is the point of
  each test. The cost is churn on a copy edit; the em-dash and no-consent
  sweeps beside them are the part that guards a rule.
- **Measured deck-composition maps:** every avatar, the Duat archetypes, the
  starters, Lanterns Below. Each carries its measured provenance and its win
  rate is gated elsewhere; a list that could drift silently would make the
  floors meaningless.
- **Locked contracts:** per-set rarity histograms, `DEFAULT_PERSONALITY`
  (the lockstep tests compare default to default and cannot catch drift),
  the reduced-motion policy table, the Duat live histogram, the economy
  bands (the ratchet made mechanical), the save-card keyword and the deck
  repair fingerprint (both persisted), the coin-flip legacy literals, the
  `harnessTrap` importer allowlist.
- **Scorer outputs used as scene-setting** (Duty battlefield values, shared
  tap pricing, Nine Lives bonus, Whispers alternate cost): the relation
  beside each literal is the rule; the literal makes it readable.

## What changed

Sixty-three test files changed: 905 lines removed, 209 added. By static
count (`it` and `test` declarations) the suite went from 2,624 to 2,600:
twenty-five tests removed, one added, and a further set of assertions
removed from inside tests that stayed. By runtime count, 3,838 (3,834 passing, 4 skipped)
became 3,825 (3,821 passing, 4 skipped), green in 821 s on the release-prep host. Suite time is unchanged in practice; the win-rate
gates dominate it, and none of them moved.

In one sentence: the suite lost its hash pins, its constant restatements, its whole-catalog totals, its rng-sequence pins and its
source-text greps, gained one state-isolation test and a handful of
rule-shaped rewrites, and kept every gate, golden, invariant and measured
list.

## Going forward

- A new test names the behaviour or contract it guards. If the expected
  value is computed by the code under test, or copied from the data under
  test, it is not a test.
- A number pinned as a literal is either the correct answer to a stated
  scenario, a measured gate with its measurement recorded, or a locked
  contract with the ruling named. Anything else is a rule waiting to be
  written.
- Before writing a regression test for a fix, find the behavioural test that
  should have caught it and strengthen that. A test named for a bug is
  justified only by a gap.
- A hash or snapshot of generated output is never the mechanism. If the
  output must not drift, say which property must not drift and assert that.
