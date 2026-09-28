<!-- source-of-truth: src/power/scoreCore.ts, src/data/cards/, src/data/opponents.ts, src/ai/value.ts, scripts/balance-matrix.ts, docs/plan-1.9.md · last-verified: 2026-09-28 · program doc: the 1.8.5 scaling rebalance; every decision ruled, the slate approved 2026-09-26 and narrowed to 83 cards 2026-09-27 (D11-D13), plus six late-ramp buffs (D14) for 89; the build is under way on release/1.8.5 -->

# Darling Blades 1.8.5: the scaling rebalance (proposal)

**Status 2026-09-26: APPROVED, and the build is under way.** Every decision
is ruled, both measurements (D4 lords and anthems, D6 the level flags and the
mark family) have landed, and the owner approved the slate card by card. The
owner then gave the build its go: "Approved, proceed." The train runs on
`release/1.8.5`. The owner asked for a full card rebalance as a 1.8.5
patch: "discovering that MTG has SCALING COSTS for card bodies drastically
changes our core math", and asked which keywords should scale, with "a new
math solution for any keyword, card cost, body, etc." The evidence window was
widened to Magic cards printed through 2020 on the owner's word, because our
mechanics have gone well past 2012.

This document gives the measured answer, the proposed v4 scorer, what it does
to the pool, and how a 1.8.5 train would run. The study itself (scripts, raw
numbers, the prototype scorer) is local and gitignored under `balance/study/`,
beside `balance/power-formula.md`.

## The owner's rulings (2026-09-26)

| # | Ruling | Where it lands |
| --- | --- | --- |
| D2 | **Skyborne takes our engine's slope**, 0.50 + 0.27 per attack | Lane 1, the v4 rate card |
| D4 | **No lord changes for now: measure first** ("Agreed, don't adjust for now, we should measure") | Lane 2, the lord and anthem measurement, running 2026-09-26; no lord card moves in the slate until it lands |
| D8 | **1.8.5 comes first**, before 1.9 wave 0, so First Dawn is costed on v4 | Sequencing; the Forge takes v4 in the same release as the card fixes |
| D9 | **The AI's card valuation moves to the v4 shapes inside 1.8.5** ("this should be part of 1.8.5 as well") | Lane 4 |
| D1 | **The evidence hierarchy, adopted**: our engine sets a slope where it measures cleanly, Magic through 2020 sets the rest | Lane 1 |
| D3 | **Twin Blades at 0.75 + 0.40 per attack**, adopted | Lane 1 |
| D5 | **The body at 0.55P + 0.45T with the 7% taper past a 2/2**, adopted | Lane 1 |
| D6 | **Measure the four level flags now** (discard, +1/+1 counters, Rite, face damage) instead of holding them, **and the mark family with them** ("Yes, add marks to D6") | Lane 2, after the lord measurement |
| Anchors | **The calibration anchors never adjust** ("Lava Axe is a baseline and should NOT adjust") | Lane 3: no anchor is changed. On the final rate card none of the eight is off enough to be caught anyway (Lava Axe now reads fair, see D6) |
| D7 | **The fix threshold, revised by the owner**: fix every card more than 1.0 off; fix a card between 0.75 and 1.0 off (either way) only when a scaled keyword or Empower caused it | Lane 3 |

**And a rule for the slate (owner, 2026-09-26):** once the entire scope is
complete, the proposed list of changes is reviewed as a whole "to balance
between cost changes, body changes, and keyword additions/removals". The slate
does not default to recosting.

## Why

A player built a card in the Forge: Lu Bu edited to a 10/1 with Twin Blades,
Skyborne, Untouchable and Rage, at {1}{R}{R}, with "At Sunset, this deals 3
damage to you". The scorer called it **Under Value (-0.79)**. It deals 20
flying damage on turn four and cannot be targeted.

The cause is structural. The scorer prices every creature keyword as a flat
constant: Twin Blades adds 1.25 on a 1/1 and on a 10/1 alike. Each constant was
calibrated at one body size and then applied to all of them. That is the same
defect as the three earlier fixes (the flat 1.1 dawn multiplier, the burn slope
fitted at Shock, unpriced token keywords), so the study audited every other
rate for it too.

## What was measured

Three independent evidence streams, each with its own agent, all reviewed and
spot-checked before use.

| Stream | Sample | What it answers |
| --- | --- | --- |
| **Magic precedent** | 737 french-vanilla creatures (keyword-only text), plus 157 auras, equipment and pump spells for grants. Fitted pre-2010 and through 2020, with era controls and 2,000-rep bootstrap CIs | How Magic prices the body and each keyword against power and toughness |
| **In-game lab** | 624,640 seeded, paired games in our engine: synthetic A/A test creatures swapped into the five starter decks, against a 14-deck field (5 starters, 9 theme precons), MediumAI with a HardAI check | What each keyword is actually worth in our rules, format and AI, at attack 1 to 5 |
| **Rate-card audit** | Every other rate in the scorer (34 rows), against Magic at three or more points each, through 2020 | Which other rates share the one-point-calibration defect |

**How the streams combine (decision D1).** Where the in-game lab has a clean
signal, it sets the slope, because the win rates are the final word in this
game. Magic sets the level where the lab is weak or measures our AI more than
the keyword: Untouchable, Sentinel, Overrun and Warding Gaze, all of which
depend on how the AI targets and blocks. Magic also covers every rate the lab
did not test.

**Power creep is small.** Against the 8th-10th edition anchor, 2010-14 cards
show none, and 2015-20 cards cost 0.18 MEP less for the same card. Keyword
premiums are measured against bodies of their own era, so creep does not enter
them. Levels that lean on 2015-20 cards carry this caveat below.

## The answer: which keywords scale

"A" is the creature's attack (the host's attack for a granted keyword). Values
are in MEP, the scorer's unit, where one +1/+1 is 1.0.

| Keyword | Today | Magic, through 2020 | In our engine (14-deck field) | Verdict |
| --- | --- | --- | --- | --- |
| **Twin Blades** | 1.25 | about 1.65, slope at most 0.32 per A (no cheap double striker above power 2 exists) | 0.82 at A1, 2.17 at A3, 2.20 at A5 | **Scales with attack** |
| **Skyborne** | 0.75 | 0.46 + 0.11A (the slope is post-2010 design; pre-2010 is flat) | 0.81 / 1.50 / 1.83 | **Scales with attack** |
| **Blood Oath** | 0.40 | 0.20 + 0.13A (leans) | 0.62 / 0.80 / 2.05 | **Scales with attack** |
| **First Blade** | 0.50 | 0.38 + 0.15A | 0.37 / 0.77 / 1.46 | **Scales with attack** |
| **Warcry** | 0.35 | flat 0.35 | 0.23 / 0.30 / 0.73 | Scales gently |
| **Bulwark** | -0.75 | -0.62 - 0.16A | -0.43 / -0.45 / -1.61; free on a 0/4 | **Penalty grows with attack** |
| **Deathblade** | 0.75 | flat to falling, 0.6 | 0.96 / 0.73 / 0.21 | **Shrinks with attack** |
| **Dreaded** | 0.45 | flat 0.58 | flat 0.48 | Flat |
| **Rage** | -0.45 | cannot tell (n=15) | flat, -0.48 to -0.29 | Flat, keep |
| **Warding Gaze** | 0.20 | about 0.2 to 0.3 | 0.20 / 0.29 / 0.48 | Flat |
| **Overrun** | 0.35 | falls to nearly free on big bodies | noisy, 0.27 / -0.03 / 0.65 | Flat |
| **Sentinel** | 0.40 | flat 0.32 | about 0 below A5 | Flat (the lab reads the AI's blocking) |
| **Untouchable** | 0.60 | flat 0.61 | about 0 | Flat (the lab reads the AI's targeting) |

Two further results bear on the owner's hypothesis:

- **Stacking three or more keywords on one body costs less than the parts**,
  about 0.4 MEP less (Magic, n=12-18, CI clear of zero). Pairs add up normally.
- **The body does not cost more per point as it grows. It costs less.** Magic
  prices power about 1.28 times toughness and bends concave. The lab agrees on
  the shape: a vanilla N/N for N mana stays fair from 1/1 to 7/7 in our
  format, which the current linear body cannot reproduce (it reads a vanilla
  8/8 for 8 at +1.16).

So the scaling that matters sits in the **keywords that multiply attack**, not
in the body.

### The other rates (the audit)

Adopted, on the through-2020 window:

| Rate | Today | Proposed | Why |
| --- | --- | --- | --- |
| Team effects | x2.0 on everything | Non-creature anthem x3.0 global, x2.6 filtered (colour or type); creature lord x1.0 global, x0.6 tribal; team pump spell 0.3 + 3.5 x stats | The dawn carrier split again: Glorious Anthem, Crusade and Shared Triumph against Elvish Champion and Goblin King |
| Empower | 0.5 of the rider | 0.15 of the rider | Kicker is nearly free upside in Magic (creep caveat) |
| Tokens | count x (body + 0.3) | count x (body + 0.15) | 1.12 per 1/1 over 14 spells |
| Drain (loseLife) | 0.5 per point | the measured face-damage curve (D6, below) | Same outcome, priced two ways |
| Creature-only burn | 0.5 + 0.35n | slope 0.5 past 2, capped at destroy | The slope §4k fixed for any-target burn |
| Pumps, auras | 0.2 or 0.5 per stat | power weighted over toughness | 55-card and 38-card regressions |
| Mana ability on a creature | 1.3 | 0.55 | 35 mana creatures |
| Sweepers, draw 3+, X spells | linear | steeper past 2 and capped at a wrath; taper past draw 2; X budgeted at MV + X | Multi-point fits |
| Preserve | 0.5 | 0.3 flat | Embalm; the option value does not track the body |
| Skim | 0.35 | 0.8 at MV 6 and up | Cycling |
| One-shot self-damage | 0.3 per point | 0.15 per point | Pay-life costs |
| Duty discount | 0.4 per activation mana, capped | proportional, no cap | The cap would price an {8} draw-four at 15.6 |
| Nine Lives | 0.9 flat | **unchanged** | Undying and Persist do not track body size (the pre-2010 reading said they did; the wider window overturned it) |
| Life gain | 0.2 per point | **unchanged** | The proposed intercept was noise |

### The level flags and the mark family (D6, measured in our engine)

261,184 games, 2,016 to 2,240 per arm, in the lab's harness. Each unit rate is
the value of one more unit on an otherwise fair card. Each mark payoff was
measured in the Starborne precon, as the card against a stripped twin.

| Rate | Today | Magic | **Measured (adopted)** |
| --- | --- | --- | --- |
| Opponent discards at random | 0.9 per card | 1.2 or more | 0.78 [0.62, 0.93]: **today's 0.9 stays** |
| +1/+1 counters (a Mark) | 0.7 per counter | about 1.0 | 0.74 [0.60, 0.87] in-deck: **today's 0.7 stays** |
| Rite | -0.7 per sacrifice | -1.1 | **-1.5** (-1.4 to -1.6). The AI casts Rite cards less often than vanillas, so this is partly how our AI plays them |
| Face damage | 0.15 + 0.3 per point | about 0.8 | **0.7 + 0.5 per point on a spell, 0.5 per point as a rider.** A 2-mana spell for 2.6 to the face ties a 2/2. Drain rides the same curve |
| markAll | 1.8 | none | **1.0** |
| One-shot Propagate | 0.7 | none | **0.3** |
| Repeatable Propagate | 1.65 a trigger (4.95 in all) | none | **0.1 a trigger** (0.26 in all): boards rarely hold more than one or two Marked creatures |
| moveMark | 0.5 | none | **0.1** (measured about 0) |
| Marked team factor | x1.4 | none | **x0.7** |
| The "if target is marked" branch | weighted 0.5 | none | **0.09** |
| Mark observers | 1.2 to 2.5 | none | **youAddMark 1.0, yourCreatureMarked 0.45, markedAllyAttacks 0.35, propagated 0.05, otherCreatureMarked 2.5** |
| gainsMark, yourPermanentMarked | 1.4, 2.0 | none | **0.3 and 0.6**, NEEDS MATH: no carrier in any deck, so set by §4m's ordering rule against the measured observers |
| A token's starting Marks | unpriced | none | **0.7 each**, like a counter (measured +0.47 for Net Full of Stars' one Mark) |
| A creature entering with its own Mark | 0.7 x the arrival haircut (0.53) | none | **1.0 a Mark, priced as body** (Ashwood Ranger's measured 1.6) |

Not adopted:
- **`controlMarked`** read 0.00, but only because its one carrier (Signal
  Drown) sits in a boss deck with no Mark sources, where its gate can never
  fire. The x0.85 gate stays NEEDS MATH, and the dead card is flagged for the
  boss's deck.
- **`markedThreshold` and `NOMINAL_THEIR_MARKED`** have no carrier in any
  deck, so they stay as they are.

**Lava Axe** (our {3}{R} instant for 5 to the face) now reads fair (+0.01)
instead of weak. The card does not change (anchors never adjust). Only its
reading moves: in our engine, burning face is worth more than Magic's era
priced it.

**The caveat** on the mark family: these are MediumAI and avatar-brain values,
in a pool with one mark deck. A mark-aware AI or more mark decks would raise
the observer and Propagate numbers. The flat-rate principle (D10) applies
here too.

Still NEEDS MATH: `controlMarked`, `markedThreshold`, recurring self-damage
(Blood Candle, the Lu Bu drawback), Whispers' fire rate, the X-spell tax, and
the Duty coefficient. The audit settled the Duty discount's shape but not its
size, so today's discount stays. Repeatable extra land drops were measured in
the ramp lane (D12, below).

### Extra land drops (D12, measured 2026-09-27)

The scorer priced an extra land drop flat, 1.9 each, however late it was
cast. In Warchest each player has exactly 10 lands in the reserve and plays
one a turn, so an extra drop only pulls the count forward toward a cap both
players reach anyway.

**The ramp lab** (177k games) put colourless ramp probes in the hole of three
green decks (Wild Communion, Valhalla's Muster, Meng Huo) against the 14
Warchest columns. Each probe was paired with a blank card of the same cost
cast at the same time. Cast on curve, one extra drop is worth, in +1/+1
units:

| Mana value | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| One drop | 1.88 | 1.22 | 0.93 | 0.77 | 0.63 | 0.57 |
| A drop at every Dawn | | 1.07 | 0.74 | 0.44 | 0.36 | 0.11 |

**The fitted model (§4v)** counts the extra untapped mana on each of your
turns before the cap:
- a turn later is worth 0.89 of the turn before;
- a second extra mana on the same turn is worth 0.58 of the first;
- a Dawn engine realizes 0.62 of its capped schedule.

It fits all eight one-shot arms and the five Dawn arms. Pricing every extra
mana the same is rejected: it overprices stacked drops and Dawn engines 1.3 to
3.2 times.

**The level stays on the §4p anchor.** One drop at mana value 2 is still 1.9;
the lab reads it at 1.22 [0.95, 1.60]. That is an owner call, listed below.

**Effect on the pool:** 21 ramp cards move, and nothing else. The five at mana
value 2 are unchanged. Late ramp now reads Under:
- Granary of Rising Years: +1.35 to -3.88
- Flood-Measure Vessel: +0.95 to -4.28
- Flood Before Noon: +1.32 to -2.91

**The owner ruled they ship buffed in 1.8.5** (2026-09-27: "we should buff the
land drop cards before 1.8.5"). The six ramp cards beyond -1.0 on the new
pricing are picked per card:

| Card | Change | Reads |
| --- | --- | --- |
| Flood-Measure Vessel | {4}{G} to {1}{G}, and each Dawn also Foresee 1 | +0.63 |
| Granary of Rising Years | {4}{G} to {2}{G}, and gain 1 to 3 life each Dawn | -0.33 |
| Flood Before Noon | 3 extra lands, then also draw 2 cards | +0.49 |
| Two Harvests | {3}{G} to {2}{G} | -0.46 |
| Deeper Flood Channel | 2 lands, Foresee 2, then also gain 2 life | -0.59 |
| Maret, Keeper of the High Flood | on arrival, 2 extra lands (from 1), then draw a card | +0.28 |

The three rituals were picked as one checked package, so no two of them clone
or strictly dominate each other. None of the six is in a boss, starter or
precon list. The deck generator now puts Deeper Flood Channel (and Kelp Wall)
in Meng Huo's Darlings list, replacing Drowned Druid and Tidepool Colossus.

**AI blind spot found by the lab:** MediumAI values the op at 0, so it casts
a 2-mana ramp spell on average on its turn 6.9.

## The v4 formula

```
Body      = 0.55 x Attack + 0.45 x Defense - 0.07 x max(0, Attack + Defense - 4)

Skyborne   = 0.50 + 0.27 A        Twin Blades = 0.75 + 0.40 A
First Blade = 0.20 + 0.22 A       Blood Oath  = 0.20 + 0.25 A
Warcry      = 0.15 + 0.10 A       Bulwark     = -0.50 - 0.20 A
Deathblade  = max(0.20, 1.00 - 0.15 A)
Flat: Warding Gaze 0.20, Overrun 0.30, Sentinel 0.30, Untouchable 0.60,
      Dreaded 0.50, Rage -0.45 (the §4o rebate kept)
Three or more keywords on one creature (Rage excluded): -0.40

Anthems: creature lord x2.0, non-creature anthem x2.8 (flat, D10)
Face damage and drain: 0.7 + 0.5 n on a spell, 0.5 n as a rider
Rite: -1.5 per sacrifice
Marks: see the D6 table (markAll 1.0, Propagate 0.3 / 0.1 a Dawn, observers measured)

A granted keyword (aura, pump, Hauntlink link, anthem, awakening) is priced on
a nominal host of attack 3 plus the grant's own power bonus.

Budget = 1.14 + 0.81 x (MV - 1) + 0.27 x (pips - 1) + rarity
         rarity: C 0 · R 0.37 · SR 0.65 · SSR 1.12 · UR 1.98
```

- **The body.** Every stat point past a 2/2 is worth 7% less, which makes the
  vanilla N/N-for-N line read -0.12 at 1/1 to +0.32 at 8/8, flat within the
  fair band, as the lab measured. Magic's own concave fit is steeper at the top
  but rests on 25 cards, so the lab's gentler taper is used.
- **The budget is refitted, not invented.** Same method as v3 (median
  regression on the shipped pool, the assumption being that shipped design
  intent is collectively right), re-run after the new rates. The rarity steps
  barely move; the pip premium drops from 0.40 to 0.27.
- **The nominal host of 3** is what Magic's grant prices imply: flying 2.4 to
  3.2, first strike 2.2 to 2.6, double strike about 4.

**The Forge's example under v4:** Power 9.86 against a Budget of 5.01, **Over
Value by +4.85** (body 5.46, Twin Blades 4.75, Skyborne 3.20, Untouchable 0.60,
Rage -0.15, stack -0.40, Sunset damage -3.60). The Sunset drawback is still
over-credited on a card that wins before it matters; recurring self-damage is
on the NEEDS MATH list.

## What it does to the pool

Rescored on all 1,444 collectible non-land cards, against today's scorer:

| | Today | v4 |
| --- | --- | --- |
| Under Value (below -0.75) | 43 | 82 |
| Accurate Value | 1,344 | 1,264 |
| Over Value (above +0.75) | 57 | 98 |
| Clear outliers (beyond ±1.5) | 20 | 25 |

485 cards move by 0.25 or more, and 148 change band. The eight §6 anchors
(Shock, Murder, Wrath, Divination, Lava Axe, Manor Thrall, Woodcutter's
Daughter, Devourer's Retainer) stay put, the largest shift being Woodcutter's
Daughter +0.47 (a 3/1 First Blade).

The band changes, by cause:

| Cause | Cards | Direction | Examples |
| --- | --- | --- | --- |
| Skyborne scaling | 24 | to Over | Ghost-Net Archon, Sahra, Black-Veil Matron, Choir of the Dead, Zeus, Morrigan |
| Anthems and lords (the team split) | 18 (and 9 to fair) | to Under | Lu Meng, Xun Yu, Cao Cao, Beastkin Packmother, Kitsune Matriarch, Apollo |
| Twin Blades scaling | 14 | to Over | Bastet +1.91, Zhao Yun, Skadi, Kesi, Xu Chu, Lu Bu -0.64 to +0.86 |
| The body | 16 | 9 to fair, 6 to Under | Bronze Colossus, Elder Jotun to fair; Nadira 9/8, Oni of the Last Exit to Under |
| Blood Oath scaling | 8 | to Over | Rain-Circuit Sovereign, Lenore, Abyssal Iris Regent |
| Empower at 0.15 | 8 (and 2 to fair) | to Under | Nocturne Manor -2.18, Moon-Doll Orchestra, the Storm-Crowned Bride |
| First Blade scaling | 4 | to Over | Lancelot, Rainflash Duelist, Blackthorn Duelist |
| Everything else | 43 | mixed | Duty, pumps, chapters, Hauntlink, tokens, drain |

The seven clear Over outliers are Excalibur From the Lake (+3.76: Knights get
+2/+1 and First Blade for {3}), Green Knight's Challenge, Unanswered Signal,
Silvered Rapier, Bastet, Reflection Sword and Zhao Yun. Most of the eighteen
clear Under outliers are Starborne mark cards that were already cold under v3
(the mark family is still NEEDS MATH).

If Skyborne takes Magic's slope instead of the lab's (D2), Over Value falls
from 98 to 74 and the 24 fliers mostly stay fair.

## The 1.8.5 lanes

**Lane 1: the scorer.** v4 lands in `src/power/scoreCore.ts`, and the rate
card goes into `balance/power-formula.md` as §4u, with every rate cited to its
evidence. The Forge picks it up on its own, and its breakdown rows name the
attack a scaled keyword was priced at. The anchors re-read, and the Forge's
zero-unknowns gate stays green. The team factor stays at x2.0 until lane 2
reports (D4).

**Lane 2: the lord and anthem measurement (D4, running 2026-09-26).** It asks
how much a `filter` static is worth in the real decks that play it. The
in-game lab plays each lord's deck as-is against the same deck with the lord
stripped to a vanilla twin, on paired seeds, and does the same for the
non-creature type anthems (Excalibur From the Lake, Silvered Rapier). Each
measurement gives an implied team factor per deck and its tribal density.
That factor, not Magic's x1.0, becomes the rate, and no lord card moves until
it lands.

**Result (2026-09-26, 151,104 games).**
- **Coverage:**
  - 12 of the 18 lords measured, in their own decks and with their own brains,
    against the 14-deck field.
  - Not in any deck, so unmeasured: Yang Huiyu, Jade-Crown Elder, Queen of the
    Living Hull, the Deacon of the Deep, Hall Usher Captain. Guan Ping plays
    only as a Darlings singleton.
- **Magic's x0.6 for tribal lords is wrong for our game.** Creature lords come
  out at x1.5 to x2.5, depending on the currency. Non-creature anthems come
  out about 1.4 times a lord (x2.1 to x3.4). Magic's roughly 4x gap between
  the two is far too wide.
- **Rate for lane 1:** creature lords **stay at x2.0**; non-creature anthems
  go to **x2.8**. Per-creature magnitude is priced in the units the factor was
  measured in: 0.5 per stat, and a granted keyword at its flat value. So an
  anthem's scaled keyword is not counted twice. **No lord card changes.**
- **What really sets an anthem's value is how many creatures it hits.**
  - The factor is about 0.14 per matching creature in the 40, and 1.4 times
    that for a non-creature, counting token makers as hits.
  - **Ash and Mistletoe** ({1}{G}: Fae get +1/+1) is worth +31.8 pp in
    Titania's deck (32 Fae plus 10 token makers). That is about +5 to +10 MEP,
    the largest effect the lab has measured. The scorer reads it at -0.27.
  - **Apollo** is worth 3.8 pp in one deck and 13.3 pp in another.
  - **Wolfqueen and the Valkyrie Captain** are nearly worthless in their own
    thin decks.
- **Excalibur From the Lake** beats a fair vanilla 3/3 by +1.1 to +1.55 MEP in
  its two decks. Today's +1.06 was about right, and the Magic-rate +3.76 was
  wrong.
- **Lion Standard** (`ac-lion-standard`) is slightly weak: in Artoria's deck a
  2/2 body beats +1/+1 for 18 Knights.

An anthem's worth rides on deck density, which the scorer cannot see, and
the scorer stays flat (D10, ruled). So the in-deck measurements do not change
any rate. They come to the slate as **flags for the owner's review**:
- Ash and Mistletoe, strong in a dense Fae deck
- Excalibur, measured +1.1 to +1.55
- Lion Standard, slightly weak

Then the four level flags (D6), measured the same way in the same harness.
Each is a test card whose cost matches a vanilla N/N-for-N control (the lab's
fair diagonal), with its magnitude stepped until it ties the control. The
tying magnitude gives the rate per unit in our engine:

- opponent discard at random, per card (today 0.9, Magic 1.2 or more)
- +1/+1 counters, per counter (today 0.7, Magic about 1.0)
- Rite, per creature sacrificed (today -0.7, Magic -1.1)
- face damage, per point (today 0.15 + 0.3n, owner-ruled low in §4k; Magic about 0.8)

**The mark family**, which has no pre-2018 Magic precedent and was priced on
our own dawn calibration in §4m, is measured two ways:

- **Unit rates** use the same tie-the-diagonal arms: a Mark, `markAll`,
  `moveMark`, and `propagate` one-shot.
- **The payoffs**, measured in the real Starborne decks that play them, as
  lane 2 measures lords: each card as-is against a stripped twin, on paired
  seeds. The payoffs are:
  - the mark observers (`gainsMark`, `yourCreatureMarked`, `youAddMark`,
    `otherCreatureMarked`, `propagated`, `markedAllyAttacks`)
  - the `controlMarked` and `markedThreshold` gates
  - the marked team factors
  - repeatable Propagate

The unpriced `createToken.marks` field (the rate-card audit's structural bug)
gets its rate here too.

**Lane 3: the slate.** One recommendation per flagged card, authored and
reviewed as the Blade Assay was.

**What gets fixed (D7):** every card more than 1.0 off, plus a card 0.75 to
1.0 off (either way) when a scaled keyword or Empower caused it. On the final
rate card (lane 2's team factors and D6's measured rates), that is **137
cards to fix**. Of those, 110 are more than 1.0 off (57 Over, 53 Under) and 27
fall in the scaled-or-Empower band (24 Over, 3 Under).

**Plus two flags from lane 2's in-deck measurements**, for review rather
than automatic fixes: Ash and Mistletoe (far Over in Titania's deck) and Lion
Standard (slightly Under). Excalibur is already on the list.

Around the 137, 72 cards sit between 0.75 and 1.0 from other causes and are
left alone.

The mark-family cards are back on the list now that D6 has priced them. The
measurement found marks worth less than priced, so most Starborne cards are
weaker than they read: 34 of the 137 are Starborne.

By family:

| Family | Too strong | Too weak |
| --- | --- | --- |
| Scaled keywords (Skyborne 26, Twin Blades 13, Blood Oath 7, First Blade 4, Warcry 2) | 52 | 3 |
| Duty | 8 | 3 |
| Face damage and drain | 9 | 1 |
| Already off under today's scorer | 6 | 6 |
| Empower | 0 | 10 |
| Rite | 0 | 9 |
| The mark family (leading cause) | 0 | 9 |
| The body | 1 | 8 |
| Anthems and auras | 4 | 2 |
| Other (Hauntlink, tokens, chapters, draw) | 1 | 5 |

**The slate (2026-09-26)** was authored in five batches. Each card has a
proposed change and at least one alternative on a different lever, and every
number was independently re-scored on the v4 prototype. It went to the owner
as an interactive review page, where the picks save for Claude to read back.

- **132 cards.**
- **Creature fixes are balanced:** body 35, cost 24, keyword 20.
- **Non-creatures** lean on cost (32) and effect size (15).
- **Nine cards cannot reach ±0.5 on the three levers**, and are the owner's
  calls:
  - seven Starborne engines, which a big enough buff would make loop
  - Lightkeeper's Oath
  - Black Tide Rising, which is a scorer blind spot
- **22 big moves** (two or more mana, or a large effect change) want an
  in-engine test of the new version before adoption. That is mostly the
  Starborne cost cuts.

**Scorer fixes the slate found, for lane 1:**
- "up to two creatures" is priced as one
- a symmetric -X/-X is priced as a pump rather than a sweeper
- Skim's value jumps at mana value 6
- the target mana-value limits on The Price and Still Harbour are unpriced
- the Hauntlink link cost is unpriced (#403)
- the +0.3 spell floor inside a pump is multiplied by the team and Dawn
  factors

**Owner review, 2026-09-26: the slate is APPROVED as picked.**

The owner went through all 132 cards on the review page:
- **55** take the proposed fix, **76** an alternative, and **1** is held
  (Still Harbour).
- **Two owner notes** became edits:
  - Lightkeeper's Oath also goes from Foresee 2 to Foresee 3 (-0.86).
  - Chrome-Veil Admiral's anthem becomes "Other Marked creatures", so it no
    longer buffs itself.
- **The approved lever mix:**
  - creatures: body 38, two levers 18, cost 15, keyword 15
  - non-creatures: cost 18, two levers 14, effect size 13
- **Where the 131 changed cards land:** 116 within ±0.5, 8 between 0.5 and
  0.75, and 7 beyond 0.75. Those 7 are the owner's calls on Starborne engines,
  Lightkeeper's Oath and Black Tide Rising.
- **Checks on the whole set, all clean:** rarity, colours, mana value 1 or
  more, the Empower cap, and no same-set rules clones.
- **Files:** the approved set is `balance/study/slate/final-slate.json`,
  with before and after rules text per card. The picks are in
  `owner-picks.json`.

**Owner re-review, 2026-09-27: only the nerfs that play backs ship (D11).**
The owner looked at the built slate and pushed back: "A lot of stone-cold
unplayable cards are getting nerfed". The two examples were Granary of Rising
Years and Chart the Reef Road, both late ramp the scorer overprices (D12).

The test is the metagame sweep. Four sweeps (2026-09-22 to 09-25, 47 crafted
decks) hill-climb five archetype decks by win rate, so a card the optimizer
keeps is one that wins games. Of the 75 nerfs:
- **27 are picked by the optimizer.** Examples: Lu Bu in 18 of 47 decks, Abyssal
  Iris Regent in 13, Ysolt in 11, and Storm Surge, The Price and Reaper's Due.
  These ship.
- **33 sat in an optimizer's colours and were never picked.**
- **15 were never in any optimizer's colours.** Green, and red-white, have no
  persona; both ramp examples are here.

Those 48 are **reverted**: they stay exactly as in 1.8.1 and join a
measure-later list. The Forge will read some of them as Over Value until
they are measured; that is a disagreement between the scorer and play,
recorded rather than forced. All 56 buffs ship (D13), so the slate is **83
cards: 27 down, 56 up**. The 131-card version is kept as
`final-slate-v1-131.json`. The six late-ramp buffs that followed D12 bring it
to **89 cards: 27 down, 62 up** (see "Extra land drops"; the 83-card version
is `final-slate-v2-83.json`).

Knock-ons:
- Bastet's retune comes out: her four changed cards are all among the 48.
- The Drowned Deacon's and the Marsh-Mother's retunes stay, because The Price
  is one of the 27.

The big moves stay flagged for lane 5's per-card in-engine check before
release. The largest are Starborne Apotheosis ({6}{W} to {1}{W} with bigger
effects), Brood Communion ({G}, Rite dropped) and Black Tide Rising ({B}{B},
-3/-3). Black Tide Rising reads -0.78 only because of the sweeper blind spot;
on the corrected sweeper rate it is about fair.

The face-damage intercept wrongly applied to Duty activations is already fixed
in the prototype.

**Art that no longer matches its card** (found transcribing the slate). The
owner ruled 2026-09-26: "Queue for regen in the 1.9".
- **Swan-Lake Sovereign** (lost Sentinel, a wing-wall pose) keeps its current
  art in 1.8.5 and is regenerated in the 1.9 art run (`docs/plan-1.9.md`,
  lane B).
- **Freya** and **Siege Juggernaut** were queued too, but D11 reverted both
  cards, so they keep their keywords and their art.

**Signal Drown** is a dead card in the Violet Signal Queen's deck, which has
no Mark sources.

**How cards get fixed.** The slate balances three levers across the whole
list:
- a **cost change**
- a **body change** (attack or defense)
- a **keyword added or removed**

For each card it gives the chosen lever and the alternatives. The owner
reviews the lever mix across the full list, not card by card in isolation.
Rarity is not a lever. Every standing rule applies:

- per-set rarity histograms stay locked
- identical twins move together or not at all
- one printing per set
- printed cost plus Empower stays at or under 9
- any recost updates the art-bible Card facts
- the text-identity and duplicate scans run before the slate ships

The owner rules on the slate before any data changes.

**Lane 4: the AI's card valuation (D9).** `src/ai/value.ts` values a creature
as its mana value, plus half its stats, plus a flat `KEYWORD_BONUS` per
keyword (Skyborne 1, Twin Blades 1.5, Deathblade 1, and so on). The same
function serves both hand cards (`cardValue`) and permanents on the
battlefield (`permValue`, on effective stats). So Medium and Hard value a 5/5
flier's evasion like a 1/1's, and a Deathblade 5/5 above a Deathblade 1/1.
This lane moves `keywordScore` to the v4 shapes on the creature's current
attack. It covers every caller:

- the printed body
- effective stats, so a pumped or anthemed creature is re-valued
- the awakening rider
- granted keywords on tokens and Hauntlink riders

Combat math in `combatPlans.ts` reads the keywords directly and is not
touched. The AI plays both sides of every gate, so the lane is measured on its
own first:

- the win-rate gates
- `--floors --seeds 80` and `--avatars --seeds 200`
- the lab's +1/+1-equivalent check that the AI now picks the bigger flier

It lands before lane 5, so the boss measurements are taken on the brain that
ships.

**Lane 5: validation.** The seeded matrices run on the rebalanced pool with
the lane 4 brain: `--floors --seeds 80`, `--avatars --seeds 200` and the
Darlings rows. Every boss and avatar deck that carries a changed card is
re-measured. **Test gate floors only ratchet upward**: a boss that a nerf
pushes below its floor gets its deck retuned, never a lower floor.

**Lane 5 results (2026-09-28, the final build b29c31d).** The dated tables
are in `src/data/opponents.ts` (the 1.8.5 re-measure).

- **The boss ladder** (`--avatars --seeds 200`) raised no flags. The summit
  rungs 21-26 sit within 3 points of the AI-only build. Three rows moved more
  than 3 points:
  - Sima Yi 25 -> 43: his converter list gained the buffed Nadira and Two for
    the Ferrywoman. This closes the R6/R5 inversion; accepted (D17).
  - Brunhild 78 -> 72, inside her band.
  - Morgan 51 -> 47, inside her band.
- **Seven summit floors ratchet up** (D16): The Bride 0.645, Glass-Coffin
  Queen 0.715, Songstress 0.825, Lanterned Roof 0.675, Kitsune 0.835, Chrome
  Broodmother 0.675 and the Deacon 0.605.
- **The floors** (`--floors --seeds 80`) are all within 3.7 points. One flag:
  F15 reads 50.0 against its 50 minimum, a noise-level dip that is recorded.
- **The Darlings rows** (`--avatars-darlings --seeds 200`, 1.8.5 against
  1.8.1) raised no flags. Hera rose 41 -> 53 (Gatekeeper Judge; accepted,
  D17) and The Storm-Crowned Bride 51 -> 58.
- **The big-moves lab** (109k games) measured each card against its budget:
  - Brood Communion is fair.
  - Starborne Apotheosis is still under (-1.6); the AI casts it as "gain 8"
    before it has Marked creatures.
  - Black Tide Rising is fair in Shadow Mandate and over-tuned in Midnight
    Storybook (+1.22). It ships as approved (D15).
- **Stand as One** goes to {W} (D15). The converter now gives Hera's reserve
  four copies. Re-measured, she reads 31 -> 27, inside her band, and her
  Darlings row goes 53 -> 54.
- Brood Communion's spell art still depicts its removed Rite, so it is queued
  for the 1.9 art run with Swan-Lake Sovereign.
- `docs/ai.md` no longer lists Deepfield Array as a paid Duty.

**Lane 6: release.**
- The notes list every changed card.
- The replay log bumps, since replays are refused whenever card data changes.
- There is no save schema change: card ids do not move.
- The Forge takes v4 in this same release (D8).

## Decisions (all ruled 2026-09-26)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | The evidence hierarchy: our engine sets a slope where it measures cleanly, and Magic through 2020 sets the rest | **RULED 2026-09-26: adopted.** |
| D2 | Skyborne's slope: the lab's 0.27 per attack (24 fliers turn Over Value) or Magic's 0.11 (post-2010 design only) | **RULED 2026-09-26: our engine's slope.** Recommended as: the lab's. The win rates are the final word, and it held on the 14-deck field and under HardAI. Its value does swing by opponent (-2 to +15 pp at A3), so it is also the rate most worth a field check after the rebalance |
| D3 | Twin Blades at 0.75 + 0.40A | **RULED 2026-09-26: adopted.** The lab and Magic's upper bound agree; the steeper "second hit of power" theory is ruled out by both |
| D4 | Creature lords at x1.0, which reads 18 lords as Under Value | **RULED 2026-09-26: don't adjust for now; measure** (lane 2). Recommended as: adopt the rate for the Forge, but do not buff a lord in 1.8.5 until an in-game lord test checks it: the value rides on our tribal density, which the lab never measured |
| D5 | The body: 0.55P + 0.45T with the 7% taper past a 2/2 | **RULED 2026-09-26: adopted.** |
| D6 | The level flags: discard 1.2, counters 1.0, Rite -1.1, face damage | **RULED 2026-09-26: measure now** (lane 2). Recommended was: hold |
| D7 | The fix threshold for the slate | **RULED 2026-09-26, revised: fix beyond ±1.0; fix 0.75-1.0 either way only for a scaled keyword or Empower** (lane 3). Recommended was: fix every clear outlier (beyond ±1.5); fix a 0.75-1.5 card when its cause is one of the scaled keywords, the anthems or Empower; leave the fair band alone |
| D8 | Sequencing | **RULED 2026-09-26: 1.8.5 first.** Recommended as: 1.8.5 before 1.9 wave 0, so First Dawn is costed on v4 from its first card. The Forge takes v4 in the same release as the cards, so it never publicly calls our own cards Over Value ahead of their fix |
| D9 | The AI's card valuation moves to the v4 shapes | **RULED 2026-09-26: part of 1.8.5** (lane 4) |

## D10 (ruled 2026-09-26)

| # | Decision | Ruling |
| --- | --- | --- |
| D10 | Should the scorer price an anthem by tribe size (lane 2's 0.14 per matching creature), or keep a flat multiplier? | **Flat: x2.0 for creature lords, x2.8 for non-creature anthems.** The owner's reason: "otherwise it'd always have to be adjusted as we add more to some sets and not others". A density-aware rate would move every anthem each time a set grows its tribe |

## D11-D14 (ruled 2026-09-27)

| # | Decision | Ruling |
| --- | --- | --- |
| D11 | Which nerfs ship, now that the sweep shows 48 of 75 were never picked by the optimizer? | **Keep the 27 the sweep backs; revert the other 48** to their 1.8.1 form and measure them later |
| D12 | The scorer prices an extra land drop the same at every mana cost, ignoring the 10-land reserve. Fix inside 1.8.5? | **Fix in 1.8.5.** Measure ramp by cast turn in the engine and price it by the turns left before the cap (lane `lane/185-ramp`). Done: §4v, measured over 177k games; see "Extra land drops" above |
| D13 | Four buffs go to cards the optimizer already picks (Nadira, The Storm-Crowned Bride, Rite of the Lamp-Fire, Moon-Doll Orchestra). Hold them? | **Keep all 56 buffs** |
| D14 | Late ramp reads Under on the measured pricing. Buff it now or in a later patch? | **Now, in 1.8.5.** Six cards, picked per card; see "Extra land drops" |

## D15-D17 (ruled 2026-09-28, lane 5)

| # | Decision | Ruling |
| --- | --- | --- |
| D15 | Stand as One reads -1.09; Black Tide Rising is over-tuned in one of two lab decks | **Stand as One goes to {W}** (-0.28). **Black Tide Rising ships as approved** ({B}{B}, -3/-3) |
| D16 | Raise the seven summit floors the fresh ladder supports? | **Raise all seven** |
| D17 | Sima Yi (+18) and Hera's Darlings row (+12) rose on buffed cards in their converter lists | **Accept both** |

## Non-goals

- No new mechanics, keywords or cards.
- No rarity changes to shipped cards.
- The NEEDS MATH rows above are named, not guessed: each keeps its current
  rate until its own measurement lands.

## Evidence (local, gitignored)

| File | What it holds |
| --- | --- |
| `balance/study/mtg-scaling-fit.json`, `mtg-scaling-fit-2020.json`, `balance/study/mtg-scaling/` | The Magic body and keyword fits, pre-2010 and through 2020, with every reading and its reproduce script |
| `balance/study/lab/keyword-lab-findings.md`, `keyword-lab-results*.json` | The in-game lab: method, sanity checks, per-arm tables, the 14-deck field, the HardAI check |
| `balance/study/rate-card-audit.md`, `rate-card-audit-2020.md`, `balance/study/audit/` | The rate-card audit and its what-if scorer |
| `balance/study/v4/` | The prototype v4 scorer (exact parity with today's with every switch off), the candidate models, the rescore and the per-card band changes with their causes (`v4p-flips.json`) |
