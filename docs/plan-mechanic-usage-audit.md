<!-- source-of-truth: src/ai/AIPlayer.ts, src/engine/actions.ts, src/engine/events.ts, src/meta/balanceTelemetry.ts, scripts/balance-matrix.ts, src/data/glossary.ts, tests/ai/documentedBehaviour.test.ts, tests/ai/winrate.test.ts, docs/ai.md · last-verified: 2026-09-19 · proposal for 1.9; NOTHING AUTHORIZED; re-verify when the owner rules on U1-U5 or a wave lands -->

# Mechanic usage audit: how often the brains use what they can (proposal, 2026-09-19)

Status: **ON THE 1.9 LIST** (U1 ruled yes 2026-09-25; lane E of
[plan-1.9.md](plan-1.9.md)). U2 to U5 are still open at the end; plan-1.9's D5
recommends this doc's own answers. It changes nothing that ships in 1.8.

The owner's question, 2026-09-19: "How do we get the brains to use all the
mechanics appropriately?" This is the measurement half of the answer. The
other half, fixing whatever the measurement finds, is ordinary policy work
that already has a home in [ai.md](ai.md).

## 1. The gap

Three layers tell us about the AI today, and each answers a different
question.

| Layer | Where | Proves |
| --- | --- | --- |
| A policy per mechanic | `src/ai/*Policy.ts`, the cast ladder, the combat model | the brain has a rule for it |
| The documented-behaviour suite | `tests/ai/documentedBehaviour.test.ts`, 40 behaviours | in a constructed position, the brain CAN make the right play |
| The win-rate gates | `tests/ai/winrate.test.ts` | the whole boss wins ENOUGH |

None of them answers a fourth question: **in real games, how often does she
USE a mechanic when she could?** A brain can pass its behaviour test and still
leave the cards in hand in live play, because the curve never gets there, a
rival action scores a little higher, or the right host never shows up. When
that happens the only signal today is a win-rate drop, weeks later, that
points at nothing in particular.

That is what the twin-blades blocking blind spot looked like (the rule
existed, live behaviour was wrong, and two bosses lost five to seven points
before anyone knew why), and it is what three tuning passes on 2026-09-19
kept circling.

## 2. What one day of doing it by hand showed

All of this is recorded in [ai.md](ai.md). It is here as the case for the
tool, because every item was found or settled by counting, and none by
reading code.

- **A stale theory was cleared in twenty minutes.** The working guess for
  Kitsune's decline was that the brains do not use Hauntlink. A read-only
  wrapper on her brain over 500 of her own matrix games said otherwise: once
  a Hauntlink card is on the battlefield it is linked 0.82 to 1.21 times per
  cast. The policy was fine.
- **The real cause was upstream and the count pointed at it.** Each of her
  three-mana Hauntlink cards was cast only about half the time it was seen,
  because eight copies was more than her curve could spend. That is a list
  problem, and the fix was a list fix.
- **A would-be card change was stopped.** Hauntlink Apex was cast in 7% of
  her games, which looked like a card defect. The same count on a control
  boss showed a four-mana link used 1.58 times per cast. Apex is dead where
  games end on turn seven and fine where they do not. A recost was proposed,
  measured, and withdrawn the same day.
- **Without the count, a tune can hide a bug.** Swapping unused cards out of a
  list raises the win rate whether the cards were bad or the policy was
  broken. Only the usage number tells those two apart.

The hand-rolled probes took about an hour each to write and debug, and hit
the same traps every time (section 6). That cost is what this plan removes.

## 3. What is measured

Only mechanics where the brain makes a CHOICE. A mechanic that fires by
itself has no usage rate; it has a frequency, which the existing telemetry
can already count where it matters.

| Mechanic | The choice | Seen by the wrapper as |
| --- | --- | --- |
| Empower | pay the extra cost | `castSpell` with `empowered`, against the plain cast of the same card |
| Skim | cycle the card instead of holding it | `skim` |
| Retell | cast from the graveyard | `castSpell` with `retell` |
| Whispers | cast from the graveyard at the Whispers cost | `castSpell` with `whispers` |
| Tithe | sacrifice to discount | `castSpell` with `tithe` |
| Rite | cast a card whose cost includes a sacrifice, and which creatures to give up | `castSpell` of a Rite card, with its `sacrifices` |
| Hauntlink | link, and move a link | `linkHaunt`, and whether the Hauntlink window was acted in |
| Duty | activate the tap ability | `activate` |
| Preserve | keep a card at cleanup | `preserveCard` |
| Darlings | call the Darling, pay down her tax | `castDarling`, `payDownDarlingTax` |
| Charm-speed play | act in a window instead of passing | any action but `passResponse` while `awaiting.kind` is `respond`, `endStepWindow` or `hauntlinkWindow` |

Passive mechanics, counted as frequency only where a deck is built on them
and only if U3 says so: Mark and Propagate totals, Quest chapters reached,
Nine Lives returns, Champion Awakening. `balanceTelemetry` already counts
Nine Lives returns, Preserve activations, Rite casts and graveyard casts, so
part of this exists.

## 4. How it is measured

**A decorator on the row AI, nothing else.** `AIPlayer.chooseAction(view,
legal)` already hands any wrapper the three things it needs: the redacted
view, every legal action, and the action chosen. The wrapper returns the
inner brain's choice untouched. No engine change, no AI change, no new
information reaches a brain, and the `PlayerView` invariant is not touched
because the wrapper reads only what the brain was given.

**It rides the existing matrices.** `runCell` builds the row AI through a
factory, so the wrapper drops in exactly where `--telemetry` does today. A
new `--usage` flag on `scripts/balance-matrix.ts` turns it on for
`--avatars` and `--avatars-reserve`. Off by default, so every current number
stays byte-identical.

**Three counts per mechanic, per boss, and the unit matters.**

1. **Turns with a chance, and turns taken.** A chance is a turn in which the
   mechanic's action was legal at least once; taken means it was chosen at
   least once that turn. Counting decisions instead of turns was the first
   mistake made by hand: one castable card is legal at every decision in a
   turn, so a decision count read 12% where the honest per-game figure was
   about half.
2. **Per card: seen, cast, stranded.** For every card carrying the mechanic:
   how many copies reached her hand, how many were cast, how many sat in her
   final hand. "Cast when seen" is the single most useful number found on
   2026-09-19.
3. **Uses per cast**, for mechanics that repeat (Hauntlink links, Duty
   activations). This is what separated "the policy is broken" from "the
   card never arrives".

Plus one context line per boss: mean turns per game, because a rate means
different things at seven turns and at ten.

**The output** is one table per boss in the matrix report, and the same rows
in the `--telemetry-out` JSON:

| Mechanic | Cards in list | Turns with a chance | Taken | Rate | Cast when seen | Uses per cast |
| --- | --- | --- | --- | --- | --- | --- |

## 5. How it is read

A rate is a prompt to look, never a verdict. Declining is often correct: a
brain that Empowers every time it can is worse than one that does not.

- **The loud signal** is a mechanic a list runs four or more cards of, with a
  "cast when seen" or a rate near zero. That names a policy module to open.
- **The quiet signal** is a rate that moves between two runs of the same
  list. After any AI change, a usage diff says which mechanic the change
  touched, before the win rates do.
- **The rule for tuning passes**, already in [ai.md](ai.md): read the boss's
  usage table before touching her list.
- **What comes out the other end** is either a policy fix, or a new entry in
  the documented-behaviour suite built from a real position where the rate
  looked wrong. That is how the suite grows from measurement instead of from
  imagination.

No gate is proposed at first. A usage floor is only worth adding for a
mechanic once a full run has shown what normal looks like (U4).

## 6. Traps, all met by hand on 2026-09-19

- **Decisions are not chances.** Count turns. See section 4.
- **Legal is not sensible.** `linkHaunt` is legal whenever it is payable,
  including when the link already sits on the best host. Where a cheap test
  for a MEANINGFUL chance exists (a better host is available, an unlinked
  carrier is in play), use it; where none exists, say so beside the number.
- **Under rules revision 4 a Hauntlink cast is never `hauntlinked`.** The link
  is a separate `linkHaunt` action. A probe looking for the old cast mode
  finds zero and looks broken.
- **A game boundary is a fresh call to the AI factory.** That is the only
  reliable per-game hook the wrapper has.
- **The hand is `view.you.hand`, a list of card ids.**
- **The wrapper must prove it changes nothing.** One test: the same seeded
  cell with and without the wrapper produces identical win counts, action for
  action.
- **The five starter columns are a narrow field.** A number that matters gets
  read on the 14-deck reserve matrix as well. Twice on 2026-09-19 a
  starters-only gain read +5 and the wide matrix read +1.

## 7. Cost

The wrapper adds a few array filters per decision. Measured by hand: 500
Kitsune games ran in about the time the plain matrix takes. The 14-deck
matrix is the expensive part and is already expensive: about 10 minutes for
a fast boss and 35 for a slow one, at 200 seeds.

A full audit is every boss from rung 1 to 26 on the five starters with
`--usage` on: about what `--avatars --seeds 200` costs today, 25 to 30
minutes with the rows in parallel on this machine under the 65% CPU cap.

## 8. Waves

| Wave | Contents | Gate |
| --- | --- | --- |
| **0** | The pure classifier (`scripts/mechanicUsage.ts`: an action plus the card it names gives a mechanic), the wrapper, and the no-change test | the identical-win-counts test; ladder rungs 1 to 6 |
| **1** | `--usage` on `--avatars` and `--avatars-reserve`, the per-boss table, the JSON rows | a run over Kitsune and the Queen of the Lanterned Roof reproduces the hand counts in [ai.md](ai.md) |
| **2** | The first full audit, rungs 1 to 26, read by Fable into a findings note: each low rate classified as correct, a list problem, or a policy problem | owner review of the findings; nothing is changed in this wave |
| **3** | Whatever wave 2 justifies: policy fixes and new documented-behaviour entries, each behind the existing win-rate gates | the gates, unchanged |

Waves 0 and 1 are one agent contract, code only. Wave 2 is reading and
writing, which is Fable's. Wave 3 cannot be scoped until wave 2 exists.

**The standing habit after that:** every new mechanic ships with its usage
row, the same way it ships with a formula rate and an AI policy today, and
the audit runs once per set before the tuning passes start.

## 9. Decisions for the owner

- **U1. Does this go on the 1.9 list at all?** Recommended: yes. It is small,
  it changes no shipped behaviour, and 1.9 brings a new set whose mechanics
  will otherwise be judged by win rate alone.
- **U2. Where does the code live?** Recommended: `scripts/`, beside the
  matrices. It is a harness tool, it never ships to players, and keeping it
  out of `src/` means layer purity is not in question.
- **U3. Passive mechanics too?** Recommended: not in waves 0 to 2. They have
  no usage rate, and `balanceTelemetry` already counts the ones a deck has
  been built on.
- **U4. Any usage gate in CI?** Recommended: none until a full audit shows
  what normal is. A floor set by guess would either never fire or fail on
  correct play.
- **U5. Medium and Easy as well as Hard?** Recommended: Hard first, because
  the bosses that gate are Hard. Medium pilots the starter columns in every
  matrix, so a second pass on Medium is cheap and would show whether the
  player-side decks are being flown properly, which affects every number the
  matrices produce.

## 10. What this is not

- **Not player telemetry.** The anonymous play stats carry no mechanic usage,
  by design, and adding any would be a schema change, a privacy-policy change
  and a new notice version. Nothing here asks for that. If a human baseline
  is ever wanted, it is a separate owner decision.
- **Not a balance input.** Win rates still decide card changes. A usage rate
  says where to look.
- **Not an engine or AI change.** The wrapper observes. It cannot make a
  brain play better.
- **Not 1.8.** Every boss from rung 14 up has a full margin over her floor,
  and the one policy that was suspected was cleared by measurement.
