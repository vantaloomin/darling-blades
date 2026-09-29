<!-- source-of-truth: src/ai/AIPlayer.ts, src/engine/actions.ts, src/engine/events.ts, src/meta/balanceTelemetry.ts, scripts/balance-matrix.ts, scripts/mechanicUsage.ts, scripts/mechanicUsageCollector.ts, tests/scripts/mechanicUsage.test.ts, src/data/glossary.ts, tests/ai/documentedBehaviour.test.ts, tests/ai/winrate.test.ts, docs/ai.md · last-verified: 2026-09-28 · waves 0-1 built on feat/19-usage-audit; re-verify when wave 2 lands -->

# Mechanic usage audit: how often the brains use what they can (proposal, 2026-09-19)

Status: **ON THE 1.9 LIST, ALL FIVE DECISIONS RULED 2026-09-25** (lane E of
[plan-1.9.md](plan-1.9.md)): U1 yes, and U2-U5 as recommended at the end. It
changes nothing that ships in 1.8.

**Waves 0 and 1 BUILT 2026-09-28** (branch `feat/19-usage-audit`, awaiting
review). The classifier is `scripts/mechanicUsage.ts`, the wrapper and the
per-boss table are `scripts/mechanicUsageCollector.ts`, and `--usage` rides
`--avatars`, `--avatars-reserve` and `--avatars-darlings`. The no-change test
and the classifier tests are `tests/scripts/mechanicUsage.test.ts`. The
re-based wave-1 gate (plan-1.9 D15) passed: see section 8.

**Wave 2 READ 2026-09-28** (branch `docs/19-usage-audit-read`, awaiting owner
review): the first full audit of rungs 1-26 on 4290e37, 47,840 boss games
over the three avatar matrices plus a Medium pass on the player-side columns,
read into [usage-audit-2026-09.md](usage-audit-2026-09.md) (authored by
Opus, reviewed by Fable). It finds five policy problems with replayable
positions (Medium's team-pump Charms, do-nothing Mark casts, main-two enemy
taps, Easy's Darling called only on the noise roll, the unpriced main-two
Duty blocker). Of the D13 fixes it backs ramp and the Brood Communion half of
the Mark item; Starborne Apotheosis and granted keywords are invisible to it.
It proposes the wave-3 list. Nothing in the game changed.

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
| Rite | cast a card whose cost includes a sacrifice (the engine offers one canonical sacrifice set, so there is no "which creatures" choice to count; the same holds for Tithe) | `castSpell` of a Rite card |
| Hauntlink | link, and move a link | `linkHaunt`, and whether the Hauntlink window was acted in |
| Duty | activate the tap ability | `activate` |
| Preserve | keep a card at cleanup | `preserveCard` |
| Darlings | call the Darling, pay down her tax | `castDarling`, `payDownDarlingTax` |
| Charm-speed play | act in a window instead of passing | any action but `passResponse` while `awaiting.kind` is `respond`, `endStepWindow` or `hauntlinkWindow` |
| Hunt (1.9) | hunt, and with what prey | a Hunt spell's cast, an arrival hunter's cast or Darling call naming prey, a paid Empower Hunt, a hunting Duty, a hunting trigger's prey choice; an `any` Hunt at her own creature is its own row, and a taken Hunt that lost the hunter and killed nothing is a sense check |

Passive mechanics, counted as frequency only where a deck is built on them
and only if U3 says so: Mark and Propagate totals, Quest chapters reached,
Nine Lives returns, Champion Awakening. `balanceTelemetry` already counts
Nine Lives returns, Preserve activations, Rite casts and graveyard casts, so
part of this exists. Provoked (1.9) has its own tally in the collector: her
fires per boss, and those on a creature her own action named or swept, read
from the public board at her decisions (so a fire after her last decision
of a turn is missed); see [plan-first-dawn-engine.md](plan-first-dawn-engine.md#as-built-a2d-the-tools).

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
`--avatars`, `--avatars-reserve` and `--avatars-darlings`. Off by default, so
every current number stays byte-identical.

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
different things at seven turns and at ten. (As built, a "turn" is the
engine's turn counter, which counts both players' turns: Kitsune's "about
seven turns each" reads 13.2, the Queen's "about ten" reads 21.4. A game's
turns are the turn of her last decision in it.)

**Definitions as built.**
- "Seen" is hand arrivals net of her own removals, not draws. An opponent's
  discard plus a redraw of the same card nets to zero; a card bounced to her
  hand counts as seen again.
- A Darling call counts as a cast of the Darling. Her "seen" stays 0 because
  she starts in the command zone, and tax paydowns read per call.
- Some actions count under two rows by design:
  - a `linkHaunt` in a window is a Hauntlink move (or link) and a
    Charm-speed play;
  - a Whispers cast with Tithe counts under both;
  - a Skim in a window is also a Charm-speed play.
- A concession is never a Charm-speed chance. It is always legal.

**Cheap meaningful-chance tests, as built.** A Hauntlink move counts a
meaningful chance only when some legal host beats the current one by the
policy's own public host fit, by more than the policy's own move margin
(0.65 per link mana plus 0.25). It does not re-check the policy's other
condition, that no friendly creature dies from the move, and it cannot see a
window move's combat gain. A Hauntlink link is meaningful whenever legal,
because a legal link implies an unlinked carrier. Every other chance is
legal-only, and the table says so. Five checks run on the TAKEN action:
- a ramp (extra land drop) cast, with her own turn of the cast and a flag
  when no land is left in the reserve;
- a Mark payoff (Propagate, a boost to her Marked) cast with no Marked
  creature;
- a Mark-all cast with no creature of her own (this over-states waste for a
  card with another effect, such as Flareburst's damage);
- a creature Duty in main phase 2 while the opponent has a creature with
  Attack above 0 (coarse: a tapped, Bulwark or otherwise non-attacking enemy
  still counts);
- a main-phase Hauntlink move when the link already sat on the best host.

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
- **A Retell or Whispers cast carries a `handIndex` too** (met in the build,
  2026-09-28). It mirrors the graveyard index, so a classifier that reads
  the hand by `handIndex` names the wrong card. Read the graveyard whenever
  `graveIndex` is present.
- **A wrapper sees the hand only at her own decisions** (measured 2026-09-28).
  A card drawn after her last decision of a game, or drawn and gone again
  between two decisions, never shows, so "seen" reads up to 0.5% under an
  engine-side count. Stranded must be the hand her last action leaves, not
  the hand she was shown.
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
| **2** | The first full audit, rungs 1 to 26, read by Fable into a findings note: each low rate classified as correct, a list problem, or a policy problem ([usage-audit-2026-09.md](usage-audit-2026-09.md), read 2026-09-28) | owner review of the findings; nothing is changed in this wave |
| **3** | Whatever wave 2 justifies: policy fixes and new documented-behaviour entries, each behind the existing win-rate gates | the gates, unchanged |

Waves 0 and 1 are one agent contract, code only. Wave 2 is reading and
writing, which is Fable's. Wave 3 cannot be scoped until wave 2 exists.

**Waves 0 and 1, as landed (2026-09-28).** Wave 0's gate held. The no-change
test replays two seeded Kitsune games action for action with and without the
wrapper, and one seeded cell result, and it fails when the wrapper alters a
choice. `--avatars --seeds 40` printed byte-identical win tables with and
without `--usage` on rungs 1-6 (1,200 games), on the Bride and the Drowned
Deacon (400 games) and, at 100 seeds, on the Queen of the Lanterned Roof.
`--avatars-reserve` and `--avatars-darlings` tables were identical too, and
the `--telemetry-out` JSON was identical apart from the added `usage` key.
The cost was 1% on the Bride and Deacon run and 7% on the Queen's, whose
Hauntlink move checks are the heaviest path; both runs shared the machine.

Wave 1's gate was re-based by plan-1.9 D15 to a fresh count on the current
tip. An independent probe counted from the engine event stream (`drew`,
`spellCast`, `hauntlinkFormed`, the final hand), not from the brain's view,
over the same 500 games per boss (`--avatars --seeds 100`; the probe's cell
records matched the matrix's). Casts and links matched exactly for all five
cards. Seen and stranded matched to within the wrapper-blindness trap in
section 6:

| Boss | Card | Seen (probe / wrapper) | Cast | Links | Stranded | Cast when seen | Links per cast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Queen of the Lanterned Roof, 21.4 engine turns | Hauntlink Signal Lure | 790 / 789 | 561 | 546 | 175 / 175 | 71% | 0.97 |
| | Sanctum of Many Masks | 803 / 799 | 529 | 842 | 209 / 209 | 66% | 1.59 |
| Kitsune, 13.2 engine turns | Burning Mask of the Void | 282 / 282 | 115 | 87 | 162 / 162 | 41% | 0.76 |
| | Ember-Link Chain | 274 / 273 | 91 | 101 | 172 / 172 | 33% | 1.11 |
| | Hauntlink Apex | 308 / 308 | 101 | 85 | 187 / 188 | 33% | 0.84 |

Beside the 2026-09-19 table in [ai.md](ai.md), the Queen's cards read a
little lower cast-when-seen (76% and 70% then) with the same links per cast.
Kitsune's Mask and Chain read 41% and 33% (33% and 33% after the Apex
recost), and Apex reads 33% cast when seen with 0.84 links per cast (37% and
0.93 then). Apex is cast in 18.6% of her games (20% then).

**The standing habit after that:** every new mechanic ships with its usage
row, the same way it ships with a formula rate and an AI policy today, and
the audit runs once per set before the tuning passes start.

## 9. Decisions for the owner

- **U1. Does this go on the 1.9 list at all?** **RULED 2026-09-25: yes.** Recommended: yes. It is small,
  it changes no shipped behaviour, and 1.9 brings a new set whose mechanics
  will otherwise be judged by win rate alone.
- **U2. Where does the code live?** **RULED 2026-09-25 as recommended.** Recommended: `scripts/`, beside the
  matrices. It is a harness tool, it never ships to players, and keeping it
  out of `src/` means layer purity is not in question.
- **U3. Passive mechanics too?** **RULED 2026-09-25 as recommended.** Recommended: not in waves 0 to 2. They have
  no usage rate, and `balanceTelemetry` already counts the ones a deck has
  been built on.
- **U4. Any usage gate in CI?** **RULED 2026-09-25 as recommended.** Recommended: none until a full audit shows
  what normal is. A floor set by guess would either never fire or fail on
  correct play.
- **U5. Medium and Easy as well as Hard?** **RULED 2026-09-25 as recommended.** Recommended: Hard first, because
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
