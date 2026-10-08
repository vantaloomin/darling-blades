<!-- source-of-truth: scripts/mechanicUsage.ts, scripts/mechanicUsageCollector.ts, scripts/balance-matrix.ts, src/ai/MediumAI.ts, src/ai/EasyAI.ts, src/ai/HardAI.ts, src/ai/value.ts, src/ai/activatedPolicy.ts, src/ai/tithePolicy.ts, src/ai/darlingPolicy.ts, src/data/opponents.ts, src/data/starterDecks.ts, src/data/darlingsPrecons.ts · last-verified: 2026-09-28 · a measurement note: the numbers are from commit 4290e37 and do not update; re-run the audit rather than re-verify; section 7's questions ruled at the owner's second sitting 2026-09-28 -->

# Mechanic usage audit, first full read (wave 2, 2026-09-28)

The first full run of the usage audit over gauntlet rungs 1-26, read into
findings. The tool and the rules for reading it are in
[plan-mechanic-usage-audit.md](plan-mechanic-usage-audit.md) (sections 4-6).
This wave changes nothing in the game. The wave-3 list at the end is a
proposal; its four owner questions (section 7) were **ruled** at the
owner's second sitting, 2026-09-28, as U1-U4, all as recommended. D13 of
[plan-1.9.md](plan-1.9.md) already approves the three 1.8.5 AI fixes once
this note backs them, and it says which ones it backs (ramp,
and the Brood Communion half of the second).

A rate is a prompt to look, never a verdict. Every low reading below was
followed to real positions before it was classified.

Authored by Opus (the plan's wave table assigns wave 2 to Fable) and
reviewed by Fable, who reconciled the figures, replayed P1 and P4, and
corrected the stated causes of P3 and P4.

## 1. What was run

All on `release/1.9` at **4290e37** (the audit tool from #474), 32-thread
machine shared with other agents, at most six processes at once. The rows are
split across six processes with `--only` (cell seeds are keyed by rung and
column, so a split run plays exactly the games of a whole one).

| Run | Command (per group of rungs) | Seeds | Games | Wall time |
| --- | --- | --- | --- | --- |
| Hard rows, the gate field | `npx tsx scripts/balance-matrix.ts --avatars --usage --seeds 100 --only <group> --telemetry-out <file>` | 100 per cell | 13,000 (500 per boss) | 491-1,000 s per group |
| Darlings rows | `... --avatars-darlings --usage --seeds 100 --only <group> --telemetry-out <file>` | 100 per cell | 13,000 (500 per boss) | 966-2,054 s |
| Warchest rows, 14 columns | `... --avatars-reserve --usage --seeds 60 --only <group> --telemetry-out <file>` | 60 per cell | 21,840 (840 per boss) | 845-1,349 s |
| Medium pass (U5) | a scratch harness, below | 40 starters, 20 theme decks, 20 Darlings precons | 5,200 + 4,680 + 2,600 | 613-774 s |

The three boss-row runs took 74 minutes of wall time together (17:06 to
18:20). Losslessness on the two reserve matrices: 0 engine exceptions; 58
turn-limit draws in 13,000 Darlings games, 1 in 21,840 Warchest games.

"Hard" in the task means the gating brains: each boss flies her own brain, so
rungs 1-3 are Easy, rungs 4-6 Medium and rungs 7-26 Hard.

**The Medium pass.** `--usage` wraps only the row (boss) brain, so the
player-side columns cannot be read with the shipped flags. A scratch harness
(not committed, kept with the raw outputs) calls the exported `runCell` with
the same cell indices and seeds as `runAvatarMatrix` and
`runAvatarReserveMatrix`, and puts the same `MechanicUsageCollector` wrapper
on the COLUMN's `MediumAI`, keyed by column deck and summed over all 26
bosses. Its games are the first 40 (or 20) seeds of the matrix cells above.

**Position probes.** To turn a low rate into a position, a second scratch
harness replays one boss's exact matrix cells with a read-only wrapper and
prints positions that match a named test (a Charm legal in a window and
passed, a Tithe cast that would unlock a spell and was declined, a Duty
creature still tapped when the opponent attacks, and so on). Every position
below is named by matrix, cell index, game index and seed, and the engine
turn (which counts both players' turns) with her own turn in brackets, so it
can be replayed into a documented-behaviour test. A cell's game seed is
`cell * 100,000 + game`.

Raw outputs (logs, JSON, aggregates and both harnesses) sit in the session
scratchpad `w2-usage/`, not in the repo.

## 2. The loud signals

A mechanic a list runs four or more cards of, with a rate under 10% or a
cast-when-seen under 15%. Charm rows count the Charms in the list; "cast when
seen" is casts from hand over copies that reached her hand.

| Boss (rung, brain) | Matrix | Mechanic | Reading | Class |
| --- | --- | --- | --- | --- |
| Hera (4, Medium) | avatars | Charm-speed play, 4 Stand as One | 0 of 2,502 chance turns; 0 casts from 791 seen | **policy** |
| | Warchest | same | 0 of 4,027; 0 casts from 1,291 seen | **policy** |
| | Darlings | 5 Charms, one of them Stand as One | 36 of 899 window turns (4%) | **policy** for Stand as One (the same rule) |
| The Drowned Deacon (25, Hard) | avatars | Tithe, 16 cards | 33 of 2,726 turns (1%) | list, under a ruled policy |
| | Warchest | same | 66 of 4,537 (1%) | same |
| The Storm-Crowned Bride (16, Hard) | Warchest | Rite, 4 Khenut | 192 of 1,776 (11%), cast when seen 14% | list |
| Zhurong (5, Medium) | avatars | Charm-speed play, 14 Charms | 0 of 8 window turns; cast when seen 99% | correct play |
| | Darlings | 6 Charms | 48 of 729 (7%) | correct play |
| Queen of the Lanterned Roof (19) | avatars | Hauntlink move | 287 of 2,921 legal turns (10%) | correct play |
| Chrome Broodmother, Violet Signal Queen, Deacon, Marsh-Mother (23-26) | Darlings | Skim, 11-13 cards | cast when seen 4-12% | correct play |
| Hestia (2, Easy) | avatars | Charm-speed play | 4 of 51 (8%), cast when seen 93% | correct play |

The loud list is short. Most of it is correct play or a list shape. The real
policy findings came from the sense checks and the probes, in section 3.

**Why the correct-play rows read low:**

- **Zhurong's Charms** are burn and removal (Fire Attack, Char, Comet Blast).
  Medium spends removal and reach in main phase, which is its rule, so 99% of
  them are cast and almost none wait for a window. This is correct under the
  ruled policy; whether holding burn for a window would win more was not
  measured.
- **Skim cards** in the Darlings lists are cycled, not cast. A 66% Skim rate
  with a 4% cast-when-seen is the mechanic working. Cast-when-seen is the
  wrong number for a Skim card.
- **The Queen's Hauntlink moves:** only 170 of 2,921 legal move turns pass
  the cheap better-host test. She took 287, more than that, because a window
  move answers a live combat the static fit cannot see, and the main-phase
  check found 0 of 121 main-phase moves onto a host no better than the
  current one (0 of 243 on the Warchest field). Links run 0.95 per cast (0.94
  on Warchest), matching the wave-1 count.
- **Hestia** (Easy) casts her Charm in main phase 93% of the time. The Easy
  brain passes most windows by design.

## 3. Findings by class

### Policy problems (the brain has the chance and declines, or acts, wrongly)

**P1. Medium never casts a targetless team pump.** Hera's four Stand as One
(`{W}`, your creatures get +1/+1 until end of turn) were never cast in 1,291
+ 791 copies seen. Medium's respond ladder (`MediumAI`, rule "3. Pump my
creature when it helps combat") reads the pump's target first
(`this.targetPerm(view, c.targets?.[0])`) and skips any cast without one, so
a pump with `scope: 'allYours'` has no rule at all, and the develop step holds
Charms for windows. The card is dead in Medium's hands.

- Position: avatars, rung 4 Hera against Crimson Muster, cell 400, game 0
  (seed 40,000,000), engine turn 13 (her 7th), combat, respond window after
  blocks. She attacks with Hera 4/5, Nike 3/2, a Volunteer Militia 1/1 and
  a Mousekin 1/1; Lu Lingqi 2/2 blocks the Mousekin, Ares 4/3 blocks the
  Militia. She has 7 untapped lands and two Stand as One in hand, and passes.
  Cast, it trades the Mousekin for Lu Lingqi and adds 2 unblocked damage for
  one mana. The same game at turn 21 (her 11th) repeats it with three
  blocked 1/1s and the opponent at 9.
- In 30 of her games the probe found 25 blocked combats where she held a
  castable Stand as One and passed.
- Three targetless team pumps exist: Stand as One (+1/+1), Red-Moon Rampage
  (+2/+0 and Overrun) and Shieldwall Call (+0/+2). Where they sit, by the
  brain that flies them:
  - **Medium:** Hera (4 Stand as One in her gate list, 1 in her Darlings
    list); Zhurong (Red-Moon Rampage, Darlings list); and the Mirror-Blood
    Rush (Red-Moon Rampage), Sunwell Ledger (Shieldwall Call) and Sable
    Warballad (Stand as One and Shieldwall Call) precons, which Medium flies
    as matrix columns.
  - **Easy:** Hestia's Darlings list (Stand as One). Easy passes most windows
    by design, so this is not a finding.
  - **Hard:** the Darlings lists of Carmilla (Red-Moon Rampage), the
    Glass-Coffin Queen and Anubis (Stand as One). `HardAI.searchResponse`
    already simulates such a cast against Medium's choice as its baseline,
    so a Medium fix also moves Hard's baseline here, in a direction not
    measured.
- No starter or theme deck carries one, and neither does the TEST_DB behind
  the two brain gates (`tests/helpers.ts`, checked).

**P2. A do-nothing Ritual is cast on an empty board.** Brood Communion
(`{G}`, Mark each of your creatures) with no creature of her own:

| Brain | Where | Casts with no creature |
| --- | --- | --- |
| Hard | Chrome Broodmother, avatars | 108 of 339 (32%) |
| Hard | same, Warchest | 172 of 578 (30%) |
| Hard | same, Darlings | 28 of 106 (26%) |
| Hard | the Marsh-Mother, Darlings | 31 of 102 (30%) |
| Medium | Chrome-Violet Broodship column, all bosses | 243 of 571 (43%) |

This matches the 1.8.5 lab's 32-39%, and Medium is worse.

Cause: `value.ts` gives `markAll` a flat 1.25 and then adjusts it by
(creatures - 1.5) x 0.6. On an empty board that still scores 0.35, above
zero, so Medium's `isDevelopable` lets the cast through and it is ranked
like any other develop play.

- Medium position: Warchest, rung 23 against the Chrome-Violet Broodship
  column (the Medium side), cell 202312, game 2 (seed 20,231,200,002),
  engine turn 3 (her 2nd), main one. Neither side has a creature. She has 2
  lands, and the only legal cast is Brood Communion. She casts it.
- Hard position: avatars, rung 23 against Crimson Muster, cell 2300, game 7
  (seed 230,000,007), engine turn 6 (her 3rd), main two. She has an empty
  board and one land untapped, and casts it into nothing.

Reef Bloom (Mark all, plus Foresee 1) reads 46 of 509 and 78 of 843 on the
Marsh-Mother. It keeps its Foresee, so those casts are not wasted.

**P3. A tap-an-enemy Duty is used in main phase two.** The Abbess of the
Bell-Ringers (3/4 Warding Gaze; tap: tap target creature) is activated in
main two on an enemy creature. The target untaps in its controller's untap
step before it could attack or block, so the tap does nothing. The Abbess
stays tapped through the opponent's turn, so the tap also costs a blocker.

- Main-two Abbess uses in 500 Darlings games: Artoria 267, the Queen of the
  Lanterned Roof 258, Hera 183, Cao Cao 156, Hestia 78, Bastet 36.
- The probe: Artoria's Darlings rows, 100 games, 74 main-two Abbess taps,
  every one on an enemy creature.
- Position: Darlings, rung 14 Artoria against Queen Below, cell 211401,
  game 19 (seed 21,140,100,019), engine turn 18 (her 9th), main two. She taps
  Hel, Queen of the Dishonored Dead with the Abbess. At turn 25, on 3 life,
  the same Abbess is tapped again when eight attackers come in.
- Cause: the Duty pick scores the tap on the live board. There the tap op
  is zeroed only when its target is already tapped; otherwise it is priced
  at max(0.5, 0.3 x the target's removal value), with no notion of the step.
  Nothing asks whether the tap can matter before the target untaps. (The
  "treat a tapped target as untapped by its next use" rule in ai.md belongs
  to the board-potential branch that `permValue` uses, not to this pick.)
  The fix belongs in the tap pricing, or in `scoredActivationCandidates`
  (`src/ai/activatedPolicy.ts`), which already has a main-one rule for
  creature sources.
- ai.md records that a paid tap in main two "achieves nothing ... but it
  spends only mana nothing else wanted". `tests/data/landEconomy.test.ts`
  pins every brain activating Lowland Fort Banner (Festival Rocket deals 2 damage, not a tap) in main
  two against an opposing bear, which is the same do-nothing tap from an
  artifact. On a creature source the tap also spends a blocker. Whether to
  scope the fix to creature sources (leaving that pin) or to re-pin the
  artifact case as well is put to the owner in section 7.

**P4. Easy never calls her Darling on purpose; the calls seen are the noise
roll.** For the player, the rung 1-3 Darlings arrive at random.

- Darling calls per 500 Darlings games:

  | Rungs | Brain | Calls | Rate over chance turns |
  | --- | --- | --- | --- |
  | 1-3 | Easy | 133, 157, 140 | 5-7% |
  | 4-6 | Medium | 777-912 | 49-80% |
  | 7-26 | Hard | 276-1,410 | 74-99% |

- Cause: `EasyAI.main` builds `usefulCasts` with `if (cast.type !==
  'castSpell') return false`, a filter meant for mass-removal usefulness, so
  `castDarling` is never in it.
  - With other spells castable, `usefulCasts` holds them and the Darling is
    not in the pool.
  - With the Darling the only castable, `usefulCasts` and `nonRemoval` are
    both empty and Easy returns `passStep`. The fallback to the whole cast
    list after it can never be reached.
  - So every call is the 20% random-action roll (`easyNoise: 0.2` in
    `src/ai/personality.ts`), taken before the ladder.
- Positions:
  - Darlings, rung 1 Meng Huo against Red Cliffs Refrain, cell 210100, game
    1 (seed 21,010,000,001), engine turn 11 (her 6th), main one. Gaia is
    castable at tax 0 with 8 untapped lands; she casts Silt-Crowned
    Harvester, and does the same at turn 13 with 9 lands.
  - Fable's replay (Meng Huo, Darlings, 10 seeds) found 6 decisions with the
    Darling as the only castable: 5 passed with 8-9 lands untapped (for
    example cell 210102, game 3, seed 21,010,200,003) and 1 called. Three
    further calls came with other spells legal, which the deliberate path
    can never do.
- The probe: 349 turns with the Darling castable and not called, and 27
  calls, in 100 games.
- It is a random roll, not a designed weakness. Fixing it makes the easiest
  rungs harder in Darlings, so it is an owner call (section 7).

**P5. A creature Duty in main two prices nothing for the lost blocker.** This
is the 1.8.1-cut limit, now counted.

- The coarse check flags 805 of 824 creature Duties in main two on the
  Deacon (1,266 of 1,287 on Warchest). The flag is "the opponent has a
  creature with Attack above 0", so it says little by itself.
- The finer probe, over 100 Deacon games: 88 opposing attacks came while a
  creature she had tapped for a Duty in her previous main two was still
  tapped. In 42 of them it could have blocked an unblocked attacker without
  dying. That is 84 damage in all, about 0.8 life a game.
- The Duties are small: Salvage Diver loots, the Deacon Foresees 1.
- Position: avatars, rung 25 against Crimson Muster, cell 2500, game 10
  (seed 250,000,010). The Salvage Diver (1/3) is tapped for its loot in main
  two of engine turn 15. At turn 16 (the opponent's) she is at 12 life and it
  cannot block Lu Lingqi, a 2/2 that goes unblocked.
- Other lists, all near 100% on the coarse check: the Marsh-Mother's
  Coral-Mother (159 of 180); the Darlings lists' Saint of the Lamp Oil,
  Tide-Reader of the Reach and Drowned Scholar; and Lanterns Below's three
  looters in Medium's hands (532 of 541).
- A real cost, and a small one. It is lower priority than P1-P3.

### List problems (the card cannot be spent on this curve, too many copies, or no host)

**L1. The Drowned Deacon's Tithe.** The wave-1 reading was 14 of 1,118.

| Field | Tithe turns taken |
| --- | --- |
| avatars | 33 of 2,726 (1%) |
| Warchest | 66 of 4,537 (1%) |
| Darlings | 1 of 329 |
| Medium flying Lanterns Below | 18 of 2,070 |

The probe followed the 382 turns in 100 games where a Tithe cast was legal,
the same card had no plain cast, and she did not take it:

- In 206 of the 616 decisions she had one creature. The ruled fodder policy
  never sells her best body, so there was nothing to sell.
- In 142 she had two bodies; in 118 of those neither was fodder-class.
- The other 268 came with three or more bodies. She played a land or another
  spell in most of them, and passed the main phase with a fodder-class body
  on board in 62.
- Her list has no tokens, and its smallest body is a 1/3. Fodder-class means
  a token, Defense 2 or less, or summoning-sick.
- The remaining declines include Hard's search refusing to sell a just-cast
  Drowned Bride at 4 life (cell 2500, game 0, turn 14).

The Marsh-Mother, whose list makes Kelp Shade tokens, reads 11% and 87%
cast when seen on the same rules. The policy is working as ruled (D5,
2026-09-15). The Deacon's sixteen Tithe cards have no fodder to pay with.
Deep One Scout (a vanilla 3/3 for four whose only upside is Tithe) is
stranded in 233 of 482 sightings. That is a wave-4 list question, not a
wave-3 policy fix.

**L2. Khenut in the Bride's list.**

| Field | Casts / seen | Cast when seen | Stranded |
| --- | --- | --- | --- |
| avatars | 140 / 856 | 16% | 509 |
| Warchest | 192 / 1,377 | 14% | - |

Khenut is a legendary 8/8 for five with Rite 2, and she runs four:

- The second copy is dead while the first lives.
- It competes at five mana with the Bride herself.
- It needs two bodies besides her best one.

The probe shows her casting the Bride or removal instead with Khenut
castable, which is a fair choice each time.

**L3. Carmilla's Rite singletons.** Ferry-Toll Petitioner 18%, Nadira 7%,
Sun-Rope Hauler 23% cast when seen. Her games last 15.4 engine turns and she
races, so selling two or three bodies is rarely right. Sima Yi (Medium) and
Anubis (Hard) cast the same Rite cards 58-75% of the time in longer games.

**L4. Counters in tap-out decks.** The counters themselves are used when
live. The Deacon cast a counter 36 times and passed one castable counter
once in 100 games. The low cast-when-seen comes from spending her mana on her
own turn:

- The Deacon's Still Water: 8% cast when seen, 282 of 492 stranded.
- Cold Current: 31%.
- Shadow Mandate's Read the Ruse in Medium's hands: 16%.

Whether a brain should hold mana for a counter is a possible later policy
question. The audit does not show it costing games.

**L5. Kitsune's Hauntlink cards.** 33-41% cast when seen (Apex 31% on
Warchest). This is the known curve problem, already under D7.

### Correct play (low on the table, right in the game)

- **Hera's Darling tax.** The probe counts 51 turns in 100 Darlings games
  where Hera was in the command zone, uncastable, and a paydown was legal.
  She paid once. Every other time she had a land to play or a spell to cast,
  and `chooseDarlingPaydown` is a conservative valve by design (ai.md, the
  tuning surface). The audit's 1,584 chance turns are inflated: the paydown
  stays legal while the Darling is on the battlefield (see section 5). Medium
  and Hard bosses pay down in 0-4% of their chance turns; the Easy bosses,
  whose Darlings sit in the command zone far longer (P4), in 21-38%.
  Nothing here is broken.
- **Empower declines.** Chrome-Violet Broodship's Vent the Reactor (then named Overcharge the Hull) pays
  its Empower (3 more mana for 2 face damage) in 8 of 611 casts. That is
  correct under the ruled policy; not measured against paying it more often.
- **Neon Afterimage's Alleyway Sever** (a removal Charm): never in a window
  (0 of 301), 78% cast when seen, in main phase. That is Medium's removal
  rule, a quiet reading only; not measured.
- **Mark payoff creatures.** Emerald Bloom Mother, Orbitroot Matriarch and
  Rootlight Broodmother cast with nothing Marked (602 of 964 on the
  Broodmother) lose only a rider. The body is the point. The check
  over-flags creatures (section 5).

## 4. The hand-offs

### From 1.8.5 (D13, approved as wave-3 changes once this note backs them)

| Item | Can the audit see it? | Reading | Backs D13? |
| --- | --- | --- | --- |
| **Ramp cast turn and empty-reserve casts** | Yes: the `rampCast` check | Medium flying Valhalla's Muster: Verdant Seiðr-Weaver (a two-mana ramp body) is cast on her own turn 9.2 on average, and 227 of 374 casts (61%) come with no land left in the reserve; Worldroot Tender turn 8.1 (30% empty). Grave Harvest's Demeter turn 7.4 (333 of 1,258, 26%, empty). The bosses' Darlings lists: Deerkin Grovekeeper turn 8.3 and Deng Ai 7.4 under Yohime's Hard brain (7.0-7.8 and 6.5 under Easy). Position: Warchest, rung 14 against the Valhalla's Muster column (Medium side), cell 201405, game 3 (seed 20,140,500,003), engine turn 3 (her 2nd): 2 lands, 8 in the reserve, Seiðr-Weaver castable, she casts Corpse-Taker; game 2 turn 6 (her 3rd) she holds three Seiðr-Weavers and casts Hel's Handmaiden | **Yes.** Two- and three-mana ramp is spent on turns 7-9, often after the reserve is empty, when the ramp rider does nothing |
| **Starborne Apotheosis with no Marked creature** | No: no gauntlet list, starter, theme deck or Darlings precon carries it | nothing to read | **Not by this audit.** The 1.8.5 lab's 72% stands alone. P2 is the same fix family (value a Mark payoff at 0 with nothing Marked), so the two should land together, with a constructed documented-behaviour position for Apotheosis |
| **Brood Communion on an empty board** | Yes: `markAllEmpty` | P2 above: Hard 26-32%, Medium 43% | **Yes** (the Brood Communion half of D13's second item) |
| **Granted keywords priced flat** | No | the audit records choices, not valuations; a keyword-granting pump is a cast like any other, and the body it lands on is not recorded | **Not by this audit.** The evidence is the code: four sites in `value.ts` (lines 288, 471, 772 and 1153 at 4290e37) price a granted keyword at a flat 0.5. A sense check could read the target's Attack for a keyword-grant cast (section 5) |

### From the 1.8.1 cut (not approved; each needs evidence)

| Limit | Can the audit see it? | Reading |
| --- | --- | --- |
| A chump block that kills nothing reads as worthless before combat | No. The wrapper records no block or forecast | Exposure: the pre-combat Duty branch it lives in needs a paid, fight-reaching Duty on a source that is not attacking. In these lists the combat Duties are either tap-only or sit on attacking creatures, which the policy keeps out of main one (Zhurong's Wrecker of the Reach, a paid ping: 174 of 174 uses in main two). No case to answer here |
| Lethal is judged against greedy blocks | No | same exposure; nothing seen |
| Medium's re-pick after a Hard veto skips Hard's search | No. The veto happens inside Hard | not visible to a wrapper |
| A main-two Duty leaves its creature tapped | Yes, coarsely | P5: about 0.8 life a game on the Deacon; P3 is the sharp case |

### The wave-1 early readings

| Reading | Now | Class |
| --- | --- | --- |
| Hera's Charms never cast | 0 of 2,082 copies seen across the avatars and Warchest matrices (both play her Warchest list); the one Charm is a team pump | policy, P1 |
| The Deacon's Tithe at 14 of 1,118 | 33 of 2,726 (avatars), 66 of 4,537 (Warchest) | list, L1 |
| The Deacon's main-two Duties | 805 of 824 flagged; 0.8 life a game in lost blocks | policy, P5 (low) |
| Medium Hera never pays down her Darling tax | 1 paydown in 51 meaningful turns per 100 games | correct under the ruled valve |

## 5. What the tool showed about itself

No bug was found in the tool. Where a probe replayed the same cells, its
counts pointed the same way as the tool's (Hera 0 Charm casts, the Deacon's
Tithe rate, the Broodmother's empty-board share), though the probes ran
fewer games and were not reconciled count for count. These are reading
notes, and candidate harness additions for wave 3 (scripts only, no game
change):

- **Darling tax chances** count every turn the paydown is legal, including
  turns with the Darling on the battlefield. A meaningful test (the Darling
  in the command zone and not castable) would cut Hera's 1,584 to roughly
  255 (an estimate scaled up from the probe's 51 turns per 100 games).
- **Cast when seen** is the wrong number for Skim cards and for Retell or
  Whispers cards cast more than once. Read the uses instead.
- **`markPayoffUnmarked`** should skip creatures, whose body is the payoff.
- **`creatureDutyMain2`** is coarse. The probe's "a safe block lost on the
  next opposing attack" is the number that matters.
- **Duty by step:** splitting Duty uses into main one and main two would show
  the pre-combat branch (the 1.8.1 limits) directly.
- **Keyword grants:** reading the Attack of the body a granted keyword lands
  on would make the flat-pricing item visible.
- **The Medium pass** needs the column wrapped. A `--usage-columns` flag (the
  scratch harness's approach) would make U5 a one-line command.
- Per-card rows hide Charm-only cards by design, so a Charm's copies and
  stranded count are only visible through the Charm row or a probe.

## 6. Recommended wave 3

Nothing here is changed in this wave. Each fix lands behind the unchanged
gates and adds a documented-behaviour entry built from its position above.

The gates, for reference:
- `tests/ai/winrate.test.ts`: Medium beats Easy, Hard beats Medium (both on
  TEST_DB decks), and the rung floors for 15-26 on the five-starter avatar
  matrix at 40 seeds.
- A change to Medium's shared policy moves the columns of every matrix, not
  only the bosses that fly Medium. Of the five gated starters, only Grave
  Harvest (Demeter, a ramp body) carries a card these fixes touch.
- The TEST_DB behind the two brain gates (`tests/helpers.ts`) carries no
  team pump and no extra-land-drop card (checked), so items 1 and 3 cannot
  move those two gates.

| # | Fix | Evidence | Expected effect | Gates it could move | Priority |
| --- | --- | --- | --- | --- | --- |
| 1 | **Team pumps in Medium's respond ladder** (Stand as One, Red-Moon Rampage, Shieldwall Call). A targetless `allYours` boost is cast in a blocked combat when it flips at least one fight (saves a blocker or kills an attacker), or adds lethal, or adds unblocked damage worth its cost | P1; cell 400 game 0 turns 13 and 21 | Medium flyers only: Hera's rows up (rung 4, no floor, band only), Zhurong's Darlings row, and the three Medium precon columns. It also changes the Medium baseline that Hard's response search compares against for Carmilla, the Glass-Coffin Queen and Anubis in Darlings, in a direction not measured | no rung floor (no starter carries one); not the two brain gates (TEST_DB has none, checked) | **High**: a dead card in a live boss |
| 2 | **Mark payoffs do nothing without their target.** `markAll` on your creatures with none of your own, and Propagate or a boost to your Marked with nothing Marked, value at or below 0 on a non-creature cast, so the card is held (D13: Brood Communion, Starborne Apotheosis). Today the flat 1.25 less the empty-board adjustment leaves 0.35 | P2; cells 202312 g2 t3 (Medium) and 2300 g7 t6 (Hard); Apotheosis from the 1.8.5 lab | Chrome Broodmother and the Marsh-Mother keep a card; the Broodship column improves | R23 and R26 floors (up, if anything) | **High**; approved |
| 3 | **Ramp valued by cast turn** (D13), on the §4v shape: extra untapped mana before the 10-land reserve runs out | section 4 table; cell 201405 g3 t3 | Medium's ramp decks (Grave Harvest, Valhalla's Muster) and the ramp bosses develop earlier; the Grave Harvest proxy gets stronger, so boss rates may drop | **every rung floor 15-26** through Grave Harvest. Each floor is an average over five starter columns, so a Grave Harvest shift moves it by about a fifth of that column's change. If any rung falls under its floor, the fix is blocked until a wave-4 tune lifts that boss: floors never come down. Not the two brain gates (TEST_DB has no ramp, checked) | **High**, but land it alone and last (**ruled**, U4); the largest reach of the set |
| 4 | **No tap-an-enemy Duty in main two**: the live tap pricing (or `scoredActivationCandidates`) values a tap at 0 when its target will untap before it could matter | P3; cell 211401 g19 t18 | the Abbess and similar tappers stay back to block | none gated (Darlings lists only); `landEconomy.test.ts` pins the artifact version of the same tap: **ruled re-pin** (U3), so the fix covers every source and the test is re-pinned to the intended behaviour | **Medium**; small, sharp, cheap |
| 5 | **Price the lost blocker for a creature Duty in main two**: skip a small Duty (Foresee, loot, a little life) when the tapped body would block an opposing attacker safely | P5; cell 2500 g10 turns 15-16 | about 0.8 life a game back to the Deacon; similar on the Marsh-Mother and the looter lists | R25 and R26 floors (up) | **Low** |
| 6 | **Easy calls her Darling**: include `castDarling` in `usefulCasts`, which also makes the pass with only the Darling castable unreachable | P4; cells 210100 g1 t11 and 210102 g3 | rungs 1-3 get stronger in Darlings (today a call arrives only on the noise roll) | none gated (rungs 1-3 have no floors); re-read their Darlings bands | **Ruled: fix it** (U1) |
| 7 | Harness additions from section 5 (Darling-tax meaningful chance, Duty by step, the finer Duty check, the Mark check on non-creatures, a keyword-grant target reading, `--usage-columns`) | section 5 | cleaner reads for wave 4's targeted pass | none (scripts only) | **Medium**; before wave 4's read |

**Ruled (U2): granted keywords land in wave 3** on the win-rate gates, as
D13 approved, on the code's evidence (the four flat 0.5 sites); the
keyword-grant reading in item 7 is added for wave 4's read, not as a
precondition.

**Landed (2026-10-02, item 1):** Medium reads targetless team pumps after
blocks with its existing combat forecast: save a friendly fighter, kill an
additional enemy, add lethal, or add damage worth the cast's mana cost.
Stand as One, Red-Moon Rampage (including Overrun) and Shieldwall Call work
on both combat sides. The documented Hera turns 13 and 21 are replayed
from recorded actions; a real no-gain combat and wasted boards keep the card.

**Landed (2026-10-02, item 7):** the harness adds meaningful Darling-tax
chances, mechanic uses for Skim/Retell/Whispers, non-creature-only
`markPayoffUnmarked`, Duty by main step, safe blocks lost at the next
opposing attack, keyword recipients' Attack, and `--usage-columns` for U5.
The coarse Duty check remains alongside the finer one. Definitions and
commands are in [the tool's guide](plan-mechanic-usage-audit.md).

**Landed (2026-10-02, item 3 / U4):** live ramp uses the scorer's §4v
cast-turn shape for arrival and spell effects, Empower, Retell and Dawn
engines. The seeded Seiðr-Weaver position now spends its ramp on turn two;
an empty or one-land reserve leaves only the body. The anchor, card floor
and every win-rate floor stay unchanged. The matched measurements and
before/after gates are in [section 9](#9-ramp-by-cast-turn-u4-2026-10-02).

**Not for wave 3:**
- Tithe (L1), Khenut (L2), Carmilla's Rite singletons (L3) and the counters
  (L4) are list questions for wave 4's tuning, read with the usage table as
  the plan asks.
- The three invisible 1.8.1 limits stay logged; nothing here argues for
  spending on them.

## 7. For the owner (RULED 2026-09-28)

The owner's second sitting answered these as U1-U4 (U1 Easy's Darling, U2
granted keywords, U3 the main-two tap, U4 the order), all as recommended.
Where each lands: **wave 3**, behind the unchanged gates. U1 is item 6, U2
the granted-keyword change D13 approved, U3 item 4 with its test re-pin;
each lands with the local fixes, before ramp. U4 puts item 3 (ramp) **last
and alone**. The rest of section 6 is unchanged by the sitting: item 2 is
D13's (approved), items 1 and 5 stay this note's proposal, and item 7's
harness additions come before wave 4's read.

- **Easy's Darling (P4).** Easy never calls her Darling on purpose: a
  removal filter drops the call, and every call seen is the 20% noise roll.
  Fix it (rungs 1-3 get harder in Darlings), or keep it and document it?
  **Ruled (U1): yes, fix it** (item 6, wave 3). **Recommended: fix it.** It
  is a random roll, not a designed weakness. Rungs 1-3 have no floors, so only their Darlings bands need a re-read.
  **Landed (2026-10-02, U1 / item 6):** `usefulCasts` includes `castDarling`; the seeded P4 Darling-only position now calls Gaia deliberately.
- **Granted keywords.** D13 approves it, but this audit cannot see it. Two
  views:
  - Opus: add the keyword-grant reading first (item 7), then land it.
  - Fable: land it on the gates as D13 approved. The evidence is the code,
    four flat 0.5 sites in `value.ts`. Add the reading for wave 4's pass, not
    as a precondition.
  **Recommended: Fable's. Ruled (U2): as recommended**: land it on the
  gates in wave 3; the reading comes for wave 4.
  **Landed (2026-10-02, U2):** all four grant sites use the existing printed-keyword `keywordScore` / `keywordBonus` on the recipient's body; the behaviour proofs cover targeted boosts, generic boosts, static grants and Empower. No new valuation constant or usage-harness feature.
- **The main-two tap (item 4) and `landEconomy.test.ts`.** That test pins
  every brain activating Lowland Fort Banner in main two (Festival Rocket deals 2 damage, not a tap)
  against an opposing bear, which is the same do-nothing tap from an
  artifact. Scope the fix to creature sources and leave the pin, or fix the
  tap everywhere and re-pin the test to the intended behaviour? This note
  does not decide it. The artifact case costs no blocker, only idle mana.
  **Ruled (U3): re-pin.** The pinned action does nothing, so item 4 fixes
  the tap for every source, artifacts included, and `landEconomy.test.ts`
  is re-pinned to the intended behaviour (no main-two tap against a creature
  that untaps before it matters), in the same wave-3 change.
  **Landed (2026-10-02, U3 / item 4):** the live tap value is zero for every source in this position. The approved `landEconomy.test.ts` and `activated.test.ts` re-pins describe the intended behaviour: no wasted Afternoon tap, a positive Morning tap before combat, zero on an already-tapped target, and an unchanged board premium for future uses. These are ruled behaviour changes, not loosened gates.
- **Mark payoffs (D13 / item 2).** **Landed (2026-10-02):** Medium and Hard hold Brood Communion with no creatures and Apotheosis with nothing Marked. The empty payoff contributes zero; creature bodies and independent spell effects remain useful. Both seeded P2 positions and the constructed Apotheosis position are documented-behaviour proofs.
- **Order.** Items 1, 2 and 4 are local and can land together. Item 3 moves
  the Medium proxy and so every number. **Recommended: land it last in wave
  3, alone.** If any rung 15-26 then falls under its floor, it waits for that
  boss's wave-4 tune. Wave 4 then tunes on a re-measure taken after its own
  card edits and converter regen, not on item 3's re-measure alone.
  **Ruled (U4): yes.** Item 3 lands last in wave 3 and alone; a floor it
  breaks blocks it until wave 4 lifts that boss, and the floor never comes
  down.

**Wave-3 follow-up read (2026-10-02).** This is a focused comparison from
`30cbf0e8` to the four fixes, not a replacement for the full wave-2 numbers
above: 20 seeds per cell, 500 games on each side. It uses the existing
matrix exports and usage collector: Darlings rungs 1-3 and 14 against all
five shop precons, plus Chrome Broodmother against the five starter reserve
builds. A local observer counts chosen main-two enemy taps; no shipped
harness change. Runtime was 67.0 seconds before and 70.2 after.

| Reading | Before | After |
| --- | --- | --- |
| Brood Communion empty-board share, Hard Chrome Broodmother | 24/78 (30.8%) | 0/73 (0%) |
| Easy Darling calls, Menghuo / Hestia / Lupa, 100 games each; repeat calls included | 36 / 35 / 32 | 104 / 121 / 145 |
| Main-two taps of an untapped enemy, across these cells | 107 | 0 |
| Darlings rung 1 mean / highest cell | 27.06% / 50% | 32.75% / 55% |
| Darlings rung 2 mean / highest cell | 12.25% / 30% | 7.00% / 20% |
| Darlings rung 3 mean / highest cell | 27.11% / 45% | 32.33% / 50% |

The Darlings mean is the mean of its five decisive-game cell rates; draws
are excluded within each cell. The reserve harness explicitly applies no
classic `RUNG_BANDS` to Darlings, so these are the requested band re-reads,
not new numeric gates. No band or floor changed. The 200-game brain gates
remain 82.5% Medium/Easy and 71.5% Hard/Medium; all rung gates pass. The
approved local changes leave ramp (U4), team-pump timing, lost-blocker
pricing, harness additions, cards and lists for their own work.

**Second wave-3 follow-up (2026-10-02, items 1 and 7).** Comparison against
`8282318c` (#521), 20 seeds per cell, 900 games on each side: Hera's three
matrices, Zhurong's Darlings row, and Carmilla, Glass-Coffin Queen and
Anubis in Darlings. These use the audit's cell indices and first 20 seeds.
The current Warchest fleet has a fifteenth column, Hooves and Fire; the
table below compares just the audit's original fourteen columns. Across
all fifteen, Hera reads 31.33% before and 40.67% after. No bands change.

| Row, mean of decisive-game cell rates | Before | After |
| --- | --- | --- |
| Hera, avatars (100 games; band only, no floor) | 28.00% | 38.00% |
| Hera, Warchest (280 matched games) | 32.14% | 41.43% |
| Hera, Darlings (100 games) | 55.00% | 56.00% |
| Zhurong, Darlings (100 games, one draw on each side) | 60.53% | 61.58% |

Hera's avatar Charm uses go from 0/506 legal chance turns to 76/274.
The avatar band checker reports no flags; neither reserve matrix applies
the classic bands. The catalog still has exactly the three team-pump
Charms named in P1, with none in any starter or theme build or in TEST_DB.

For Hard, the comparison also saves every baseline post-block response
position with a legal team pump, then asks the new brain about that same
public view and legal menu. This separates the baseline effect from later
games diverging. The 300 Hard games supplied 64 positions:

| Darlings boss | Positions | Medium baseline changed | Hard choice changed | Hard team casts, before to after |
| --- | --- | --- | --- | --- |
| Carmilla | 6 | 6 | 5 | 1 to 6 |
| Glass-Coffin Queen | 33 | 26 | 19 | 8 to 27 |
| Anubis | 25 | 18 | 11 | 7 to 18 |

The engine replays the historical P1 action prefixes at turns 13 and 21
and Medium casts Stand as One in both. On the current engine, the turn-13
forecast goes from 7 to 9 face damage with the same casualties; at turn 21
it goes from 4 to 5, saves a Militia and kills Lu Lingqi. The historical turn-23 no-gain
combat keeps the card. Synthetic engine combats cover both sides,
Overrun lethal, damage worth the mana, prevention, empty boards and pending
team pumps: an already-paid Shieldwall prevents a redundant second one,
while an enemy Rampage can make that second Shieldwall necessary.

The harness smoke read uses its default 20 seeds per cell on five of the
audit's bosses, 1,000 actual games, with both row and column recording:

```sh
npx tsx scripts/balance-matrix.ts --avatars --avatars-darlings --usage --usage-columns --only hera,zhurong,artoria,chrome-broodmother,the-drowned-deacon --seeds 20 --telemetry-out usage-smoke.json
```

Each boss/matrix row below has 100 games. These are fresh readings on the
changed policy, not replacements for the full wave-2 sample:

| New reading | Measured result |
| --- | --- |
| Hera, Darlings tax | 55 meaningful chance turns of 271 legal turns; 5 paydowns |
| Deacon, Darlings mechanic uses | 185 Skims, 120 Retells, 43 Whispers; cast/seen suppressed |
| Chrome Broodmother, Darlings non-creature Mark payoffs | 9 unmarked casts of 21 applicable casts |
| Deacon, avatars Duty by step | 0 main-one, 166 main-two uses |
| Deacon, Darlings Duty by step | 324 main-one, 210 main-two uses |
| Deacon, avatars safe blocks lost | 27 of 99 still-tapped Duty-source observations; 46 preventable damage summed |
| Deacon, Darlings safe blocks lost | 30 of 56 observations; 69 preventable damage summed |
| Deacon, Darlings granted-keyword recipients | 31 bodies, total Attack 107, mean 3.45 |
| Medium column groups | 10 groups (five starters and five Darlings precons), 100 games each |

Lost-block damage is a separate best legal single-block counterfactual for
each source, not an optimal combined assignment or a measured win-rate loss.
The wrapper remains read-only, and the engine-driven count and seeded
losslessness tests pass. Disabling the team rule fails nine of its thirteen
behaviour cases; disabling six harness additions fails ten selected cases,
and disabling the fine Duty observer separately fails all five of its cases.

Verification: both detached four-worker `winrate.test.ts` runs pass all
eight tests (587.1 seconds before, 610.1 after). The first run's console
interception retained pass/fail but suppressed numeric rates; the second
disables interception, so the numeric rates here are **after** measurements.

| Gate | Before | After |
| --- | --- | --- |
| Medium over Easy, 200 games, floor 80% | Pass | 165/200, 82.5%, pass |
| Hard over Medium, 200 games, floor 70% | Pass | 143/200, 71.5%, pass |
| Rungs 15-26, unchanged 40-seed floors | All pass | All pass |
| Other win-rate legality, completeness and ordering checks | All pass | All pass |

After means for rungs 14-28, in rung order: 66.5 / 69.0 / 72.5 / 79.5 /
85.0 / 70.0 / 94.0 / 66.5 / 75.0 / 72.5 / 74.0 / 67.0 / 74.0 / 73.0 /
61.5 percent; every row has 200 decisive games and no draws. No assertion,
floor or band changed. Typecheck, lint and generated-doc-table verification
pass. AI, scripts and engine tests (with the separately run win-rate file
excluded) pass 1,712 tests, with four skipped. `check-docs` exits zero with
four missing local-path warnings (three `scripts/blades-db.ts` references
and the local `sweep-running-do-not-disturb` memory reference).

## 9. Ramp by cast turn (U4, 2026-10-02)

This change lands alone and last in wave 3, after `feb4218c` (the Medium
team-pump change). The before/after read uses the existing `runCell` and
`MechanicUsageCollector` exports, wrapping the column's Medium brain for
Grave Harvest and Valhalla's Muster. It plays Warchest rungs 1-26, columns
4 and 5, 20 seeds per cell: 520 games per deck, 1,040 on each side. Cells
are `200000 + rung * 100 + column`; game seeds are `cell * 100000 + game`.
The row brains, lists and seeds match on both sides.

The historical **6.9** mean is the earlier ramp lab's two-mana probe
reading. These are fresh measurements on the branch, using the usage
tool's `rampCast` own-turn reading. Seiðr-Weaver is the two-mana ramp card
in these decks; Tender and Demeter each cost four in the current data.

| Card (mana value), Medium deck | Before mean own turn (casts) | After mean own turn (casts) | Empty-reserve casts, before → after |
| --- | --- | --- | --- |
| Verdant Seiðr-Weaver (2), Valhalla's Muster | 8.981 (362) | 8.404 (406) | 214/362 (59.1%) → 224/406 (55.2%) |
| Worldroot Tender (4), Valhalla's Muster | 8.008 (258) | 7.489 (270) | 76/258 (29.5%) → 79/270 (29.3%) |
| Demeter, Harvest Mother (4), Grave Harvest | 7.164 (641) | 7.164 (641) | 149/641 (23.2%) → 149/641 (23.2%) |

Valhalla's combined ramp mean moves from 8.576 to 8.038 (620 to 676 casts).
Many casts remain late: the change prices the ramp's remaining mana,
while body value and the existing cast ladder still decide which card wins.

**The documented position.** Replaying cell 201405 game 3's action prefix
from `feb4218c` reaches engine turn 3, Medium's second turn, with two lands
and eight in reserve. Before, she casts Corpse-Taker. After, she casts
Verdant Seiðr-Weaver and plays the additional land. With zero or one reserve
land, the same card is valued as its body alone and Corpse-Taker wins that
choice again. These cases extend `documentedBehaviour.test.ts`; the
recorded prefix lives beside the other audit positions.

**Shape and proofs.** `value.ts` imports the pure §4v scorer's constants and
turn-two anchor schedule. It compares two schedules from the live own land
count and reserve, consumes pending land permissions in both, and counts
extra untapped mana after future normal drops. It uses absolute own-turn
decay (0.89), diminishing same-turn mana (0.58), and the Dawn schedule's
realization (0.62). New Dawn engines first fire next Dawn. Arrival and
spell casts, Empower and live Retell share the shape. Pure ramp triggers
lose the generic trigger premium; mixed triggers retain their other value.
No card-only estimate invents a reserve. The 1.9 anchor and mana-value-2
card floor are unchanged.

The 18 added behaviour cases cover the named position and counter-cases,
the anchor, delayed casts, reserve exhaustion, pending permissions,
multiple drops, both seats, Dawn timing and realization, mixed triggers,
Empower, Retell's live choice, and unusable off-turn or Sunset permissions.
Restoring the original `value.ts` makes 13 of them fail; restoring the fix
passes the requested suite. This mutation changes no fixture or gate.

**Gates, before and after.** Both runs are detached with `--maxWorkers=4`.
The before run is `tests/ai/winrate.test.ts`; the after run includes that
same file in the requested AI/engine/data/meta/power suite. Each brain
gate plays 200 games; each rung uses five starter columns at 40 seeds per
cell, 200 games. Every rung has zero draws on both sides.

| Gate | Floor (%) | Before (%) | After (%) |
| --- | --- | --- | --- |
| Medium over Easy | 80.0 | 82.5 | 82.5 |
| Hard over Medium | 70.0 | 71.5 | 71.5 |
| R14 Artoria | ordering only | 66.5 | 66.5 |
| R15 Carmilla | 65.5 | 69.0 | 69.0 |
| R16 Storm-Crowned Bride | 64.5 | 72.5 | 72.5 |
| R17 Glass-Coffin Queen | 71.5 | 79.5 | 79.5 |
| R18 Abyssal Songstress | 82.5 | 85.0 | 85.0 |
| R19 Queen of the Lanterned Roof | 67.5 | 70.0 | 70.0 |
| R20 Kitsune Neon Tyrant | 83.5 | 94.0 | 94.0 |
| R21 Anubis | 58.5 | 66.5 | 66.5 |
| R22 Bastet | 68.5 | 75.0 | 75.0 |
| R23 Chrome Broodmother | 67.5 | 72.5 | 72.5 |
| R24 Violet Signal Queen | 64.5 | 74.0 | 74.0 |
| R25 Drowned Deacon | 60.5 | 67.0 | 67.0 |
| R26 Marsh-Mother | 68.5 | 74.0 | 74.0 |
| R27 Shepherdess of Giants | completeness/termination only | 73.0 | 73.0 |
| R28 Tyrant Queen | completeness/termination only | 61.5 | 61.5 |

All floors, ordering, legality and completeness checks pass unchanged.
The requested test folders pass 3,292 tests with four skipped (190 files
passed, one skipped). No card, list, harness, band or floor was changed.
