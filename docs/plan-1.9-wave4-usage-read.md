<!-- source-of-truth: src/ai/MediumAI.ts, src/ai/value.ts, src/data/opponents.ts · last-verified: 2026-10-04 · measurement record: the wave-4 targeted mechanic-usage read; its AI fixes landed in #533 and its decklist items in the wave-4 tunes -->

# Mechanic usage audit, wave 4 targeted read (2026-10-04)

> **Record, not spec.** Measured 2026-10-04 for the 1.9 wave-4 balance pass. Paths under `scratchpad/` or `w4/` were the measuring session's local working files and are not in the repo; every number they produced is in this document. The handoff is in [plan-1.9.md](plan-1.9.md#handoff-2026-10-04).

The second, targeted read that opens wave 4 (`docs/plan-1.9.md`,
lane E): rungs 27-28, every boss whose regenerated list gained First Dawn
cards, and the Hooves and Fire theme deck. The tool and its reading rules are
in `docs/plan-mechanic-usage-audit.md`; the shape mirrors
`docs/usage-audit-2026-09.md`. Nothing in the game was changed.

A rate is a prompt to look, never a verdict. Every row named below was
followed to the card text, and the three zero-cast cards to a legality probe.

## 1. What was run

All on `feat/19-w4-card-edits` at **e365cc0c** (the wave-4 card edits), in
the `w8-balance` worktree. One matrix at a time, split by `--only` into at
most four single-thread processes (`OMP_NUM_THREADS=1`); cell seeds are keyed
by rung and column, so a split run plays exactly the games of a whole one.
Seeds match the first audit: 100 per cell on the gate and Darlings matrices.

**Scope found by scanning `opponents.ts`.** Only rungs 27-28 carry First
Dawn in their gated `reserveDeck`, plus Carmilla (R15: Kesh, Raptor-Rider and
Rage-Horn Tyrant). The regenerated **Darlings** lists of 17 bosses carry
First Dawn cards: R1-R8, R11, R12, R15, R23-R28 (rungs 23-26 only the shared
artifacts Ember-Pot and Amber Resin, plus Thick Hide or Ember-Flick and
Ember-Tongue on the Broodmother).

| Run | Command | Seeds | Games | Wall |
| --- | --- | --- | --- | --- |
| Gate matrix (five starter reserve builds) | `npx tsx scripts/balance-matrix.ts --avatars --usage --seeds 100 --only <boss> --telemetry-out <f>` for R27, R28, R15 | 100/cell | 1,500 | 32-246 s per boss |
| Darlings matrix (five curated precons) | `... --avatars-darlings --usage --seeds 100 --only <group> --telemetry-out <f>`, the 17 bosses in 4 groups | 100/cell | 8,500 | 465-856 s per group |
| Hooves and Fire (scratch harness `allcards.mts theme`) | the theme deck as the Medium column of the Warchest reserve matrix, the same cell index (`200000 + tier*100 + 14`, the 15th column) and seeds, against all 28 bosses, with the shipped collector on the column brain | 40/boss | 1,120 | 123 s |
| All-cards pass (scratch harness `allcards.mts`) | the same cells and collector, plus one catch-all rule that never matches an action, so every list card gets a seen/cast/stranded row (`--usage` lists only mechanic carriers) | 100 (summit), 40 (the 15 other Darlings bosses) | 1,000 + 1,000 + 3,000 | 72-598 s |
| Position probes (`blaze-probe.mts`, `hearth-probe.mts`) | turns a card was legal, survived Medium's `applyHuntPolicy`, and was chosen | 20 (theme, all 28 bosses), 40 (Hera, Zhurong Darlings) | 560 + 400 | under 7 min |

**Cross-check.** The all-cards harness reproduces `--usage` exactly on the
shared cells: R28's Hunt row (2,352 / 1,615 / 1,941) and Duty row (1,318 /
592 / 700), and R27's Duty row (2,592 / 2,583 / 4,717) are identical, and so
are the win tables. Losslessness: 0 engine exceptions in 16,500 matrix games;
74 turn-limit draws, all in the Darlings matrix (20 of them R27 vs Ledger).

**Budget.** The plan's ten minutes covers rungs 27-28 alone (the gate and
Darlings rows took about 12 minutes). Widening to the 15 other Darlings rows,
the theme deck and the all-cards passes took about 39 minutes of wall time,
14:33 to 15:12, never more than four processes at once.

Raw logs, JSON and the three scratch harnesses are in the scratchpad:
`w4/usage/` (outputs) and `w4/*.mts` (harnesses, not committed).

## 2. Headline numbers

### Rungs 27-28 (gated format and Darlings)

| Boss | Matrix | Cells (Muster/Communion/Tides/Mandate/Harvest; Darlings: Refrain/Below/Ledger/Rush/Warballad) | Avg | Draws | Engine turns |
| --- | --- | --- | --- | --- | --- |
| R27 The Shepherdess of Giants (Hard) | avatars (gate) | 49 / 95 / 70 / 60 / 79 | **71%** | 0 | 25.8 |
| | Darlings | 65 / 58 / 94 (80 + 20 draws) / 58 / 68 | **69%** | **20** | 29.0 |
| R28 The Tyrant Queen (Hard) | avatars (gate) | 56 / 80 / 58 / 63 / 63 | **64%** | 0 | 17.4 |
| | Darlings | 35 / 32 / 69 / 36 / 51 | **45%** | 0 | 17.5 |
| R15 Carmilla (Hard, gained 2 FD cards) | avatars (gate) | 53 / 62 / 46 / 90 / 89 | 68% | 0 | 15.8 |

Both summit rows clear the provisional gate's shape at 100 seeds (complete
matrices, every game decided). R28 sits under R27 on both matrices, and 24
points under it in Darlings.

### Hooves and Fire (Medium column, Warchest, 40 seeds per boss)

347 wins in 1,120 games (**31.0%**) across the tower, 17.8 engine turns.
Against the summit it took 4 of 40 from R27 and 8 of 40 from R28. Its
outlier is **R11 The Morrigan: the theme deck won 37 of 40**, after this
branch's Morrigan edits (Black Tide Rising -2/-2, Morrigan {4}{B}{G}). Other
rows: R1-R6 24-35 of 40 (Hestia 35), R7-R10 2-8, R12 3, R13 20, R14 9, R15-R26
0-13.

### The other Darlings rows that gained First Dawn cards (100 seeds)

| Rung | Avg | Rung | Avg | Rung | Avg |
| --- | --- | --- | --- | --- | --- |
| R1 Meng Huo (Easy) | 31% | R6 Sima Yi (Medium) | 40% | R15 Carmilla | 63% |
| R2 Hestia (Easy) | 9% | R7 Yohime | 69% | R23 Chrome Broodmother | 24% |
| R3 Lupa (Easy) | 30% | R8 Cao Cao | 55% | R24 Violet Signal Queen | 9% |
| R4 Hera (Medium) | 54% | R11 The Morrigan | 61% | R25 Drowned Deacon | 10% |
| R5 Zhurong (Medium) | 50% | R12 Titania | 72% | R26 Marsh-Mother | 30% |

Rungs 23-26 are low in Darlings, but they gained only the two shared
artifacts, which are cast 63-81% of the time with 1.6-3.8 uses each. Nothing
in this read ties their rate to First Dawn; it is context for the tune step.

## 3. Provoked and Hunt

### Provoked (passive; fires seen on the public board at her own decisions)

A fire after her last decision of a turn is missed, so these are lower
bounds. "Own" means her previous action that turn named or swept the creature.

| Deck | Games | Fires | Per game | Own source | Top bodies |
| --- | --- | --- | --- | --- | --- |
| R27 avatars | 500 | 2,619 | 5.2 | 1,583 (60%) | Herd-Guardian Longneck 953, Wall-Kin 434, Moss-Hide 404, Reed-Wall Keeper 382, Walking Mountain 362 |
| R27 Darlings | 500 | 1,490 | 3.0 | 722 (48%) | Herd-Guardian 317, Mother of the Long-Necks 241, Long-Neck Herd 228 |
| R28 avatars | 500 | 2,036 | 4.1 | 1,675 (82%) | Thorn-Hide Armourback 594, Fern-Crown 275, Ember-Crest 248, Blood-Horn 236, Vessa 222 |
| R28 Darlings | 500 | 780 | 1.6 | 472 (61%) | Thorn-Hide 118, Fern-Crown 179, Tusk-Rage 119 |
| Hooves and Fire | 1,120 | 542 | 0.5 | 354 (65%) | Hot-Blooded Hornback 237, Tusk-Rage 198 |
| Other Darlings bosses | 500 each | 5-396 | 0.01-0.8 | 0-65% | Hestia 108 fires, 0 own (Easy skips friendly sources, B5, by design) |

**Reading: the mechanic is working.** Both summit decks set off their own
Provoked on purpose, R27 through The Standing Stone's Duty (961 uses, 5.4 per
cast) and Test of the Hearth (868 casts, 95% cast when seen), R28 through her
Hunts, which provoke the hunter. Hearth-Shield Maiden is the weakest payoff
(84 fires from 3 copies; see section 4).

### Hunt

| Deck (brain) | Cards | Turns with a chance | Taken | Rate | Uses | Cast when seen | Uses per cast | Own prey (`any`) | Hunter dies, prey lives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R28 avatars (Hard) | 17 | 2,352 | 1,615 | 69% | 1,941 | 81% | 0.84 | 11 of 500 turns (2%) | 64 of 1,941 (3.3%) |
| R28 Darlings (Hard) | 9 | 905 | 561 | 62% | 586 | 82% | 0.81 | 0 of 345 | 25 of 586 (4.3%) |
| Hooves and Fire (Medium) | 15 | 5,300 | 2,371 | 45% | 2,697 | 63% | 0.74 | 0 of 1,186 | **315 of 2,697 (11.7%)** |
| R15 Carmilla avatars (Hard) | 1 | 112 | 112 | 100% | 112 | 91% | 0.70 | - | 4 of 112 |
| Other Darlings bosses | 1-3 | 51-647 | | 18-100% | 42-119 | 49-90% | 0.22-0.80 | 0-5 | 0-10 |

R27 has no Hunt cards; she is the Provoked deck.

Per card, Hunt is spent when the card is cast: the Hunt spells run 1.00 uses
per cast (Blaze-Horn Charge, Duel on the Ridge, Grip of the Old Beast,
Spear-Sister, Challenge the Beast, Horn-Crest Charger). The conditional ones
read lower, as they should: Fern-and-Fire Raptor 0.51 (avatars) and 0.24
(Darlings), Thorn-Hide's paid Empower Hunt 0.28-0.43. **Fern-Crown Tyrant**
(arrival Hunt only if she controls another Dinokin) runs 0.81-0.84 in R28 but
0.07-0.18 in the mixed Darlings lists (Meng Huo 8 of 89 casts, Lupa 10 of 75,
Yohime 10 of 89, the Morrigan 12 of 89, Titania 18 of 76): there it is a
six-mana body.

**The wasted-Hunt check splits by brain.** Hard loses the hunter without
killing on 3-4% of Hunts; Medium on Hooves and Fire, 11.7%. Medium's losses
sit in the optional Hunts, not the arrival hunters:

| Card (Hooves and Fire) | Wasted / Hunts | Hard on the same card |
| --- | --- | --- |
| Ridge-Raptor (Empower Hunt) | 66 / 240 (28%) | - |
| Spear and Fang (Hunt spell) | 103 / 494 (21%) | 2 / 256 (R28 avatars) |
| Challenge the Beast (Hunt spell) | 69 / 488 (14%) | - |
| Fern-Shadow Stalker, Fern-and-Fire, Horn-Crest Charger (arrival) | 2-8% | Fern-and-Fire 6 / 176 |

## 4. Dead and near-dead cards

Cast when seen = casts from hand over copies that reached her hand.

| Card | Deck (brain) | Seen | Cast | Stranded | Reading | Class |
| --- | --- | --- | --- | --- | --- | --- |
| **Blaze-Horn Charge** ({R}{G} ritual: 1 damage to your creature, then it Hunts) | Hooves and Fire, 3 copies (Medium) | 1,128 | **0** | 1,046 | Probe: legal on 1,588 turns in 560 games, kept by Medium's Hunt filter on 1,516, chosen 0. Hard casts the same card 61% (R28 avatars) and 58% (Darlings) | **policy** |
| **Test of the Hearth** ({W} Charm: 1 damage to your creature, Mark your creature, gain 1) | Hera's Darlings list (Medium) | 48 | **0** | 27 | Probe: legal on 376 turns in 200 games, kept by the filter on all 376, chosen 0. Easy (Hestia) 38%; Hard (R27) 95% | **policy** |
| **Rite of the Lamp-Fire** ({R}, Rite 1: 5 damage to a creature; Drowned Deep) | R28's Darlings list (Hard) | 96 | **0** | 85 | 0 of 362 chance turns; Broodmother 12 of 106 (11%) | **list** |
| Duel on the Ridge ({2}{R} Charm: +2/+1, then it Hunts) | Zhurong's Darlings list (Medium) | 92 | 12 (13%) | 56 | Probe: 3 chosen of 101 legal turns; every cast in a window. Hard (R28) 88% | **policy** |
| Ice-Speaker ({1}{U}; {2},T: tap a creature) | Titania's Darlings list (Hard) | 121 | 52 (43%) | 49 | **0 Duty uses in 500 games** | **policy** (section 5) |
| Great-Horn Herder ({1}{G}; {1},T: counter on your creature with Attack 4+) | the Morrigan's Darlings list (Hard) | 103 | 35 (34%) | 56 | 8 Duty uses; Meng Huo casts the same card 67% with 84 uses | list |
| The Elders' Verdict | Hestia's Darlings list (Easy) | 53 | 10 (19%) | 32 | Easy's Charm passes (by design) | correct play |
| Ember-Flick ({R} Charm: 1 damage, Foresee 1) | Hooves and Fire, 4 copies (Medium) | 1,553 | 590 (38%) | 866 | a ping; Hard 47% on R28's list | list (soft) |
| Trial by Ember | R27 Darlings (Hard) | 124 | 49 (40%) | 45 | and see the empty-board check, section 5 | policy (small) |
| Hearth-Shield Maiden (1-Attack Bulwark, Provoked: gain 2) | R27 avatars, 3 copies (Hard) | 672 | 308 (46%) | 301 | the weakest card in the summit lists; held while better plays exist | list (soft) |

**Signal Drown** (in scope through R24's Darlings list): 59 seen, 30 cast
(51%), 27 stranded over 200 games. It is a five-mana counter with a dead Mark
rider in a list with no Mark sources; it is cast as a counter. Not rerun.

Correct play, not dead: the Skim cards (Bookmark Charm, Brass Lamp Charm,
Jade Dragon Egg, Blue-Echo Array, Null-Orbit Array, Sky Map) read 0% cast but
are cycled 80-145 times each, as in the first audit.

Non-First-Dawn Charms that Medium bosses hold in these Darlings lists: Hera's
Stop the Procession 5 of 49 (10%) and Lamp-Lit Vigil 8 of 50 (16%); Sima Yi's
Cold Current 9 of 66 (14%), Dream Fracture 9 of 54 (17%) and The Map Argues
Back 5 of 49 (10%), all cast in windows. These are the first audit's
Medium Charm-holding shape, not a First Dawn finding; they are listed for the
tune step.

## 5. AI-behaviour findings

### New: three Medium blind spots in First Dawn's shapes

**M1. Medium never casts a spell whose first act damages its own creature.**
Blaze-Horn Charge (a ritual) and Test of the Hearth (a Charm) read 0 casts
across 1,964 legal turns. In both probes Medium's own Hunt filter
(`applyHuntPolicy`, the A2.b one-card margin) keeps the cast on 95-100% of
those turns, so the gate is downstream, in Medium's cast ranking or ladder.
Challenge the Beast, the same Hunt-spell shape with a pump in place of the
self-damage, is cast on 233 of 824 legal turns. Hard plays both cards.
Position to start from: Hooves and Fire against R1 Meng Huo, theme cell
`200114`, game 0, engine turn 8 (main one), four legal pairs such as
Fern-Crest Raptor hunting Huang Zhong, Silver Deadeye; Medium plays a land,
then Ridge-Raptor.

**M2. Medium casts a Hunt Charm only in a window** (Duel on the Ridge,
Zhurong: 3 of 101 legal turns, every cast a combat pump). ai.md already
records that Medium's removal ladder does not treat a Hunt spell as removal;
for a Charm the develop step also holds it, so outside combat it never fires.

**M3. Medium's optional Hunts lose the hunter three to four times as often as Hard's**
(section 3: Spear and Fang 21% against Hard's 1%). The value layer prices the
exchange (`huntExchangeValue`), but Medium's develop step still casts a Hunt
spell or pays an Empower Hunt whose best pair loses. The known limit in
ai.md covers arrival hunters only, and those read 2-8% here.

All three move only Medium flyers (Hera, Zhurong and Sima Yi in Darlings,
rungs 4-6 with no floors) and the Medium columns, including Hooves and Fire's
measured strength: the theme deck plays the harness with three blank cards.

### Wave 3's shapes, re-read on these decks

- **Useless taps (U3), now the other way.** Ice-Speaker, a paid tap-a-creature
  Duty, was cast 52 times in Titania's 500 Darlings games and **never
  activated**. U3 values a main-two enemy tap at zero, a paid Duty waits for
  the Afternoon unless `precombatDutyEdge` clears its margin, and the tool recorded no use
  in any step, so in practice the card has no live window. One
  card in one Darlings list, but it is the exact behaviour U3 touched.
- **Empty-board casts.** Trial by Ember ({W}: 1 damage to each creature you
  control, then Mark each) is cast with no creature of her own: R27 9 of 49,
  Cao Cao 7 of 47 (Hard), Hera 14 of 71 (Medium), Hestia 25 of 86 (Easy). It
  does nothing then. Wave 3's Mark-payoff hold does not cover this card.
  The Mark-payoff check's other flags (Bloomdrive Surge, 20-41 per boss) are
  false positives: its base effect Marks up to two creatures before the
  Empower Propagate, and the check reads the board at cast time.
- **Darlings never called (U1).** Every in-scope boss calls her Darling.
  The Easy rungs now call 1.1-1.3 times a game (Meng Huo 536 calls in 500
  games, Hestia 600, Lupa 666). U1 is visible.

### The four known limits in ai.md

- **A Duty in main two leaves its creature tapped:** visible but small.
  The finer check flags 13 of 89 (R28 avatars, mean 0.2 damage) and 32 of 104
  (R28 Darlings, 0.9); R27's Duties are non-creature and 99.6% in main one.
  The Deacon and the Marsh-Mother read as in the first audit (P5, Low).
- **A chump-kill reads as worthless, lethal against greedy blocks, Medium's
  re-pick after a Hard veto:** no reading in the tool; nothing in these decks
  points at them.
- **A stall, new to the summit:** R27 draws 20 of 100 Darlings games against
  Ledger at the turn limit, and averages 29.0 engine turns there (25.8 on the
  gate matrix). A list of Bulwark and Sentinel walls, life gain and Provoked
  payoffs that do not reach the face can fail to close.

## 6. What the tool showed about itself

- `--usage` prints per-card rows only for mechanic carriers, so a vanilla or
  plain-spell card drawn and never cast is invisible. The catch-all rule in
  `allcards.mts` fixes that without changing a mechanic row; it is worth
  folding into the tool as a flag.
- `--usage-columns` can read the theme deck only through a full 14-column
  Warchest run; a one-column cell runner was cheaper here.
- The Mark-payoff check needs the card's own pre-payoff Marks (Bloomdrive
  Surge).

## 7. Recommendations

| # | Recommendation | Label | Evidence | Priority |
| --- | --- | --- | --- | --- |
| 1 | Cut **Rite of the Lamp-Fire** from the Tyrant Queen's Darlings list (0 of 96 seen); on the Broodmother's list it reads 11% | **(a) decklist tune** | section 4 | High (a blank in a summit list) |
| 2 | Read **R27's Darlings stall** before setting her floor: 20 turn-limit draws vs Ledger; give her list reach, or accept it as a deck trait | **(a) decklist tune**, owner sees the trait | sections 2, 5 | High |
| 3 | **R28 in Darlings is 45%**, 24 points under R27; she is the summit and the tune should lift her, not R27 | **(a) decklist tune** | section 2 | High |
| 4 | Recheck **R11 The Morrigan** after this branch's edits: Hooves and Fire beat her 37 of 40; read her avatars row (no floor at R11) before the tune pass | **(a) decklist tune** (measure first) | section 2 | Medium |
| 5 | Great-Horn Herder off the Morrigan's Darlings list (no Attack-4 targets; 34%, 8 uses); Fern-Crown Tyrant in the mixed Darlings lists is a body without its Hunt (under 0.2 Hunts per cast) | **(a) decklist tune** | sections 3, 4 | Low |
| 6 | **M1:** Medium casts a spell whose first effect damages its own creature when the whole spell's value says so (Blaze-Horn Charge, Test of the Hearth); start from theme cell 200114 game 0 turn 8 | **(b) AI fix** | section 5 | High (3 blank cards in a shipped theme deck under the harness) |
| 7 | **M3:** Medium casts a Hunt spell or pays an Empower Hunt only when `huntExchangeValue` at the best pair is above zero | **(b) AI fix** | section 3 | Medium |
| 8 | **M2:** Medium's removal ladder reads a Hunt Charm as removal in main phase (ai.md's existing limit) | **(b) AI fix** | section 5 | Low (Zhurong only) |
| 9 | A paid tap-a-creature Duty needs a live window after U3 (main one before her attack, or the opponent's beginning of combat); Ice-Speaker has none | **(b) AI fix** | section 5 | Low (one card, one Darlings list) |
| 10 | Hold Trial by Ember-shaped casts (damage and Mark each of your creatures) with no creature of her own | **(b) AI fix** | section 5 | Low |
| 11 | Hearth-Shield Maiden is the summit's weakest card (46%, 301 stranded from 3 copies); Ember-Flick reads 38-47% under both brains. Owner's call whether they are on rate | **(c) card issue** | section 4 | Low |
| 12 | Provoked works as designed (4-5 fires a game on the summit, mostly self-set-off); Hunt is spent at 1.00 per cast on the spells and Hard's wasted Hunts are 3-4%; Signal Drown is cast as a counter (51%) | **(d) no action** | section 3 | - |
| 13 | Fold the catch-all per-card rule and a one-column theme runner into the usage tool; fix the Bloomdrive Surge false positive | **(d) no action** for the game; a scripts-only tool item if wanted | section 6 | Low |

Gates these could move: items 6-8 change Medium's shared policy, so they move
every Medium column (the five starter columns on the gate matrix included),
the Medium bosses' rows (rungs 4-6, no floors) and Hard's Medium baseline
candidate. Items 9-10 touch Hard as well. Each would land behind the
unchanged gates, measured, before wave 4's tune.
