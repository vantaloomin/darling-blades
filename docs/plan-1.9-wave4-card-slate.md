<!-- source-of-truth: src/data/cards/drowned-deep.ts, src/data/cards/celtic-fae.ts, src/data/opponents.ts · last-verified: 2026-10-04 · measurement record: the wave-4 card-edit slate; the owner ruled Black Tide Rising -2/-2 and Morrigan {4}{B}{G} (#532), the rest unchanged -->

# Wave 4 card-edit slate: the draft (1.9)

> **Record, not spec.** Measured 2026-10-04 for the 1.9 wave-4 balance pass. Paths under `scratchpad/` or `w4/` were the measuring session's local working files and are not in the repo; every number they produced is in this document. The handoff is in [plan-1.9.md](plan-1.9.md#handoff-2026-10-04).

Drafted 2026-10-04 in the worktree `w8-balance`, on branch `feat/19-w4-card-edits`, at release/1.9 tip `ee3a0f7c`.

- This was measurement only. No file under `src/`, `tests/` or `docs/` was touched, and no git command was run.
- Every script, plan and raw game file is in the session scratchpad, under `scratchpad/w4/`.
- The owner picks the final slate.

## How it was measured (read this first)

### Scorer

- `scoreCard` from `src/power/scoreCore.ts` (v4 + §4v), the same code the Forge uses, run against this worktree.
- Lab variants are defined in `w4/labcards.ts` and scored by `w4/score-lab.ts`.

### Lab (in-play value)

`w4/w4lab.ts` generalises the 1.8.5 big-moves lab (`balance/study/lab/bigmoves/bigmoves-lab.ts`).

**Game setup**
- Format: Warchest.
- Both sides play MediumAI.
- The test deck plays against **the 15 Warchest columns**: the 5 starters plus 10 theme precons. This is now 15 because First Dawn's *Hooves and Fire* has joined the columns. So these numbers are not directly comparable to the 1.8.5 lab, which had 14 columns.
- 288 games per column, which is **4,320 games per arm**.
- Seeds are `12,000,000 + (100 + deckIdx*16 + col)*10,000 + i`, for i = 0 to 287. The seat alternates with i.

**Swaps**
- Every swap is in place, so all arms share the seeded shuffle.
- A "blank" has the same cost and type as the card, with no text.

**Currencies**
- **Deck exchange:** the win-rate gain from +1/+1 on one of the deck's own 4-of creatures.
- **Logit standard ("std"):** 5.33 pp at 50%, scaled by 4p(1-p). This is the D6 method.
- **Ladder:** a 2/2 and a 3/3 vanilla put in the same hole.
- **Power ladder:** a least-squares line through 3 vanilla creatures in the same hole, for the creature checks.

**Statistics**
- Paired bootstrap, 1,000 draws, resampling seed indices within each column.
- Every interval quoted is a 95% interval.

**Frame checks** (does a 2/2 for 2 read as 2.00?)

| Host deck | 2/2 measured | Verdict |
|---|---|---|
| Starborne precon | 1.89 | holds |
| Midnight Storybook | 1.88 | holds |
| Shadow Mandate | 0.72 | **fails**, as in 1.8.5, so the ladder is the guide there |
| Glimmer Bargain (Celtic Fae) | n/a | deck exchange is implausibly large (13.4 pp), so the power ladder is used |
| Warband | n/a | compressed at 86%, so the logit standard is used |

**Total:** 59 arms (rounds A to D: 45, 10, 3 and 1), 254,880 games. Four workers ran at below-normal priority, one job at a time.

### Gauntlet rows (Festival Rocket, Signal Drown)

- Script: `w4/matrix-variants.ts`. It swaps a boss's reserve list in memory and calls the committed `runAvatarMatrix` / `runAvatarReserveMatrix`.
- The cell seeds are the same as the committed runner's, so each variant is paired with its baseline.
- **200 seeds per cell.** Each boss plays its own HardAI brain and personality.
- Two matrices:
  - `--avatars`: 5 starter reserve columns, the gate harness.
  - The wide Warchest reserve matrix: 15 columns.

### blades-db

`scripts/blades-db.ts` exists only in the main checkout. I copied it to `w4/bdb/blades-db.ts` with three changes:
- every `../src/` import rewritten to a `file:///` URL of **this worktree's** `src`;
- `root` set to the scratchpad, so it writes `w4/bdb/balance/cards.sqlite`;
- `MTG_DB_PATH` pointed at the main checkout's `mtg-cache`.

I scored a fresh `power-scores.json` beside it (`w4/bdb/score-all.ts`; 1,610 cards, 0 unknown vocabulary) and ran `build`. The result is 1,685 cards including First Dawn.

The main checkout's `balance/cards.sqlite` was not touched. I did the duplicate checks with `w4/dupes.ts` over `ALL_CARDS`, not with `like`.

## The slate

| Card | Set | Current | Measurement (scorer; in-play, 4,320 games/arm unless noted) | Recommendation | Type | Confidence |
|---|---|---|---|---|---|---|
| Still Harbour | Drowned Deep C | {1}{U} Charm: "Cancel target spell with cost 2 or less." | Scorer **+1.07**: the cost cap is unpriced, so it scores as a full Cancel. In-play (Storybook, Undertow hole): **+0.18 MEP, so -1.77**. Cast 0.23 times a game. The same card with no cap reads **-0.20** (fair) and is cast 1.13 times a game. | **No card change.** Price the cap in the scorer (NEEDS MATH) and log the AI gap (below). | none | High that the card needs no edit; medium on the scorer rate |
| Signal Drown | Starborne C | {3}{U}{U} Charm: Cancel; draw if you control a Marked creature | Scorer **-0.06** with Marks. In R24 its condition can never hold, so it is a 5-mana Cancel: **-1.63**. R24 at 200 seeds: base 71.5 / Collapse the Lane ×4 72.8 / Cold Refusal ×2 72.9 (`--avatars`); wide matrix 70.5 / 71.2 / 73.2. | **No card change.** It is the deck list. Swap 2 Signal Drown for 2 Cold Refusal in R24 at the **tune step**, not in this slate. | none (the list swap goes to tune) | High |
| Starborne Apotheosis | Starborne SSR | {1}{W} Ritual: Propagate, gain 8, Marked creatures +2/+2 | Scorer -0.31. Casts with no Marked creature: **0.0% of 4,634** (was 72%). In-play, against SSR budget 3.07: **-0.76** deck [-1.16, -0.39]; **-0.29** std [-0.49, -0.11]; **-0.54** ladder [-0.77, -0.31]. In 1.8.5 these were -1.62 / -1.33 / -1.31. A +3/+3 version reads -0.64 / -0.14 / -0.38. A {W} version reads +0.59 / +1.18 / +0.96. | **No change.** The D13 AI fix closed most of the gap. +3/+3 is the measured option if the owner wants it nearer zero. | none (option: numbers-only) | Medium |
| Black Tide Rising | Drowned Deep C | {B}{B} Ritual: all creatures -3/-3 | Scorer +0.68. **Storybook: +1.39** deck / +1.32 std / +1.04 ladder; the deck goes 64.1% to **73.8%** with 4 copies. Mandate (ladder) **+0.30**. Option {B}{B} -2/-2: Storybook **-0.33 / -0.36 / -0.21**, Mandate ladder **-0.02**. Option {1}{B}{B} -3/-3: Storybook 0.00, Mandate ladder -0.94. | **It is a card issue**: any player can build the deck that breaks it. Make it -2/-2 at {B}{B}. | numbers-only, but it partly reverses D15's approved buff, so it goes to the owner | Medium-high |
| Festival Rocket | Gothic Monsters C | {2}{R} Artifact; Duty {2}: 2 damage to target creature | Scorer **+0.04**. ×4 in R23 for the 4 Ashwood Rangers: `--avatars` 74.1 to **62.9**; wide 76.6 to **65.1**. ×4 for Starfall Barrage: 67.1 / 69.2. In warband it is **worse than a blank** (-0.8 pp [-1.5, -0.2]). | **No card change.** The tune item closes as "don't add it to R23". AI note logged. | none | High |
| Barge-Fire Brazier | Duat R | {R} Artifact; Dawn: 2 to opponent, 1 to you | Scorer **+0.59**. In-play (warband) **+0.31** std [0.07, 0.64]; **+0.84** deck [0.32, 2.22]. Warband without it: 86.2% to 81.6%. Option {1}{R}: -0.83 std / -0.40 deck. | **No change.** Mildly over; the one clean lever overshoots by as much. | none | Medium |
| Ember-Lane Flare | Starborne C | {R} Artifact; Duty {1}: 1 to opponent | Scorer -0.04. In-play **-0.65** std / -0.51 deck. | **No change** (under) | none | Medium-high |
| Lu Bu | Three Kingdoms UR | {2}{R}{R} 5/3 Twin Blades, Rage, Dawn self-damage 1 | Scorer 0.00 (after the 1.8.5 nerf). Against a 7/5 vanilla at 4: **-0.96** std [-1.24, -0.68]; -1.16 deck. | **No change.** It is under in AI hands. | none | Medium-high |
| Wreck-Runner | Drowned Deep C | {R} 2/1 Warcry | Scorer +0.76. In-play **+0.83** std [0.67, 0.99]; +0.95 deck. The D8 B1 version (Rage added) reads **-0.63** std [-0.85, -0.28]; -0.93 deck. | **No wave-4 edit.** D8 B1 is already ruled for 1.9.x and covers it (it overshoots in AI hands; recorded, not relitigated). | none | High |
| Granary of Rising Years | Duat SR | {2}{G} Ench.; Dawn: an extra land, gain 3 | Scorer -0.33. In-play (Wild Communion): **-2.22** deck / **-1.63** std. Option {1}{G}: -1.01 / -0.21 in play; scorer +0.85. | **No change.** Drop the reverted nerf: the card is under, not over. {1}{G} is an owner option. | none (option: numbers-only) | Medium |
| Old Growth | Drowned Deep R | {G}{G} Ench.; Marked creatures +1/+1 and Overrun | Scorer **+1.19**. In-play (Starborne precon, 19 Mark sources): **-0.75** deck / -0.37 std. The reverted nerf (+1/+0) reads -1.07 / -0.76. | **No change.** Drop the reverted nerf; the scorer over-reads Marked-only anthems. | none | Medium-high |
| Skadi, the Winter Blade | Ragnarok SSR | {2}{U}{G} 4/4 Warding Gaze, Twin Blades | Scorer +1.31. In-play power ladder **+0.60** [0.34, 0.88]; std +0.80; deck +0.36. The reverted nerf {3}{U}{G} reads **-1.70** [-1.86, -1.52]. | **No change.** Mildly over; the reverted lever overshoots by about three times as much. | none | Medium |
| Morrigan, Black-Wing Omen | Celtic Fae UR | {3}{B}{G} 5/5 Skyborne; arrives: Sever 3 from the opponent's graveyard; attacks: Foresee 1 | Scorer +0.80. In-play power ladder **+1.65** [1.13, 2.15]; std +1.88; deck +0.79. Option **{4}{B}{G}: -0.11** [-0.53, +0.30]. Option 4/4 at {3}{B}{G}: -0.17 [-0.53, +0.15]. | **Cost to {4}{B}{G}.** This is the owner's own 2026-09-26 pick, reverted by D11; it is now backed by play. | numbers-only | Medium-high |

## Per card

### 1. Still Harbour: no card change

The +1.07 is the scorer's blind spot that 1.8.5 already named: "the target mana-value limits on The Price and Still Harbour are unpriced".

**Magic precedent puts {1}{U} for "cost 2 or less" on the curve.**
- Minor Misstep: {U}, cost 1 or less.
- Liquify: {2}{U}, cost 3 or less, common.
- Thoughtbind: {2}{U}, cost 4 or less, common.

**What the cap reaches here.** 40.3% of the spells in the 15 columns have cost 2 or less, against 65.8% with cost 3 or less (`w4/mvshare.ts`). That is the same "half the field" restriction that Negate and Essence Scatter carry at {1}{U}.

**Why it is near-blank in play.** The AI almost never fires it. MediumAI counters only:
- a spell whose cost is at least `counterFloor` (4 by default, `src/ai/personality.ts:73`); or
- a spell that targets one of its creatures worth 4 or more (`src/ai/MediumAI.ts:866-871`).

A "cost 2 or less" counter can therefore only answer a cheap spell aimed at its best creature. The lab shows the gap: the uncapped twin reads fair at -0.20 and is cast five times as often.

**Smallest fair fix:** none to the card.
- **Scorer:** add a NEEDS MATH rate for a counter's cost cap, scaled by the share of the field it reaches. Cost 2 or less is about the Negate/Essence Scatter tier, roughly ×0.6 on the 2.7 counter value. That reads about fair at {1}{U}.
- **AI (lane E):** let Medium value a capped counter against what it can reach, not against `counterFloor`.

**Do not use {2}{U} "cost 3 or less".** It would sit strictly under Cold Current in its own set (DD SR, {1}{U}, cost 3 or less, plus Whispers).

### 2. Signal Drown: a deck-list problem (to the tune step)

In a Mark deck the card is fair (-0.06). R24 has no source of its own Marks: I checked every card in her list.
- Marrow Eviction and Void Lament check whether their *target* is Marked.
- `controlMarked` checks your own creatures.

So in R24 the card is a 5-mana Cancel (-1.63).

**Swap for the tune step**, 2 Signal Drown to 2 Cold Refusal (First Dawn C, {2}{U}, Cancel then grind 1). The gains are small and inside matrix noise:

| Matrix | Base | Cold Refusal | Change |
|---|---|---|---|
| `--avatars`, 200 seeds | 71.5 | 72.9 | +1.4 |
| Wide, 15 columns, 200 seeds | 70.5 | 73.2 | +2.7 |

Collapse the Lane ×4 reads +1.3 / +0.7.

**Not in this card slate.** The swap goes to the converter and tune step, and the list change needs a fresh `darlingsDeck` regen.

### 3. Starborne Apotheosis: no change

**D13 worked.** Of 4,634 resolved casts, none had zero Marked creatures; the 1.8.5 lab read 72%.

Its in-play value rose about 0.8 to 1.0 MEP in every frame. It now sits:
- -0.29 on the std frame;
- -0.54 on the ladder;
- -0.76 on the deck exchange.

**A note on the budget.** The remaining gap is about the SSR rarity step (1.12 of a 3.07 budget). Rarity histograms are LOCKED, so rarity cannot be the lever.

**If the owner wants it closer to zero**, the measured numbers-only option is:
- **"Propagate, then you gain 8 life, then your Marked creatures get +3/+3 until Sunset."**
- Scorer -0.03. In play -0.14 std / -0.38 ladder / -0.64 deck.
- The gain is small, about +0.15 MEP, inside the interval.

**{W} overshoots**, to +0.6 to +1.2.

Caveat: the lab uses a colourless {2} copy in the precon's Starfire Lancer hole. That is the 1.8.5 convention, because the precon has no white source.

### 4. Black Tide Rising: a card issue

**The 1.8.5 finding reproduces after wave 3.** Fair in Shadow Mandate (ladder +0.30), over-tuned in Midnight Storybook (+1.04 to +1.39 across frames). Storybook goes 64.1% to 73.8% with four copies.

**Why the card is the problem, not the list.** The card is a common. Storybook's tough-creature shell is exactly what a player who builds for it would make. No authored deck plays it today, so this is about the ceiling.

**Proposed text, {B}{B} common:**
> **"All creatures get -2/-2 until Sunset."**

- Scorer -0.22.
- Storybook -0.21 to -0.36.
- Mandate -0.02 on the ladder; the other two frames fail there.
- Storybook with 4 copies reads 65.5%.
- Magic anchor: Infest is {1}{B}{B} for -2/-2; Yahenni's Expertise is {2}{B}{B} for -3/-3.

**The alternative, {1}{B}{B} -3/-3:** fair in Storybook (0.00) but -0.94 in Mandate.

**Knock-ons**
- The only other all-creature -X/-X is Creeping Malaise (-1/-1), so there is no clone.
- No deck list carries the card, so there is no converter knock-on.
- The art bible's Card facts carry the text, so update them alongside.
- **It goes to the owner:** D15 shipped -3/-3 "as approved" and logged it as "watch in the 1.9 sweep and player stats". This is that watch, reporting.

### 5. Festival Rocket: no card change

**The ×4 re-measure** ([ai.md](../../docs/ai.md) asked for it after 1.8.1's Duty timing):

| R23 list | `--avatars` | Wide (15 columns) |
|---|---|---|
| Today's list | 74.1 | 76.6 |
| 4 Rockets for the 4 Ashwood Rangers | 62.9 | 65.1 |
| 4 Rockets for Starfall Barrage | 67.1 | 69.2 |

That is a loss of 7 to 11.5 points either way. In the warband lab, Rocket is worse than a blank, used 0.49 times a game.

The scorer calls it fair (+0.04), and a human gets a repeatable answer to X/2s. The shortfall is AI usage, so the card does not change.

The tune item closes as "not added to R23". Log an AI-audit row: Rocket activations are net negative in Medium's hands.

### 6. The shared red core (W3)

**Host deck.** The warband persona's round-0 greedy build (`buildGreedyDeck`, persona `warband`, pool all, seed 13003; `w4/warband-deck.json`).
- It plays: Guan Yu ×4, Brazier ×4, Ember-Pot ×4, Sefa ×4, Fire-Pit ×4, Lu Bu ×4, Kitsune Neon Tyrant ×4, Wreck-Runner ×4, Lamp-Bearer ×4, Zeus ×2, plus 1 Quest Marker and 1 Scar-Singer.
- It reads **86.2%** on MediumAI against the 15 columns.
- **Ember-Lane Flare is no longer in it.** First Dawn's Ember-Pot and The Fire-Pit took the artifact slots.

**Per card.** Of the four, only **Wreck-Runner** is clearly over, and the ruled D8 B1 (Rage) already fixes it in 1.9.x. **Brazier** is borderline over; its only clean lever overshoots, so leave it. **Lu Bu** (nerfed in 1.8.5) and **Ember-Lane** are now *under*.

**What drives the 86%.** The single biggest lever measured was removing Brazier (-4.6 pp). Beyond that, the deck's strength sits in its other cards. Zeus (scorer +1.19) is among the 48 reverted nerfs, and Guan Yu reads +0.52. That is the wave-5 sweep's to read, not this slate's.

### 7. The four per-card checks (reverted nerfs)

**Granary of Rising Years: no change.** It is **under**, not over.
- In-play: -1.6 to -2.2.
- The reverted {5}{G} nerf would have buried it.
- {1}{G} measured -0.21 std / -1.01 deck, with the scorer at +0.85 (the Forge would call it Over). It respects the mana-value-2 extra-land floor.
- Caveat: Wild Communion has little to ramp into, so this host gives a lower bound.
- Owner option, not recommended without a better host.

**Old Growth: no change.**
- Under in its best host: -0.37 to -0.75.
- The scorer prices "Marked creatures +1/+1" as a full anthem (2.8) plus Overrun (0.98). That is a scorer note: a Marked-only filter needs a discount.

**Skadi: no change.**
- Mildly over: +0.36 to +0.80, ladder +0.60.
- The only lever measured, +1 mana, drops it to -1.70, because the step from 4 to 5 mana costs about 2 MEP in this ten-land format.
- An untested smaller lever would be 4/3; I did not measure it.

**Morrigan: cost {3}{B}{G} to {4}{B}{G}.**
- Over: power ladder +1.65 [1.13, 2.15], std +1.88.
- At {4}{B}{G}: -0.11 [-0.53, +0.30]. Scorer -0.01, which the Forge reads as Accurate.
- The 4/4 alternative reads -0.17 in play and -0.33 on the scorer.
- **Knock-ons:**
  - Boss R11 The Morrigan carries her ×3 and theme-celtic-fae ×2. Re-measure R11's floor in the tune.
  - The converter regenerates.
  - Update the art bible's Card facts (cost), or `check-art-bible` fails.

## Items for the owner

**Changes what a card does:** none. Every proposed edit is numbers-only.

**Owner calls, because they reverse or extend a ruling:**
- **Black Tide Rising:** -3/-3 to -2/-2. This partly reverses D15.
- **Morrigan:** {4}{B}{G}. This reinstates a D11-reverted pick.

**Options, not recommended by default:**
- Apotheosis +3/+3.
- Granary {1}{G}.

## Surprises

- **Granary and Old Growth.** Both were on the "over budget" reverted list, and both read *under* in play.
- **Lu Bu and Ember-Lane** now read under.
- **Rage on Wreck-Runner overshoots.** The ruled D8 B1 lands it under in AI hands.
- **Still Harbour is near-blank to the AI** because of `counterFloor` 4 (an AI gap, not a card gap).
- **Festival Rocket** is worse than a blank in AI hands, even after the Duty-timing fix.
- **First Dawn has changed the red core.** Ember-Pot and Fire-Pit replaced Ember-Lane, and warband still reads 86% on Medium.
- **The Warchest field is now 15 columns** (*Hooves and Fire* joined), which shifts every lab's baseline.

## Not measured, seen on the way (the other ~44 reverted nerfs: no edits proposed)

- **Zeus** (gk-zeus) scores +1.19 and is a 2-of in the warband build. Not measured in play.
- **Wrecker's Lookout and Wreck-Runner:** D8 already handled this pair.

## Commands run

All `npx tsx` calls ran from `Z:/Coding Projects/DarlingBlades-worktrees/w8-balance`; S = the session scratchpad.

| What | Command |
|---|---|
| Score candidates and host-deck census | `npx tsx $S/w4/where.ts`, `npx tsx $S/w4/marks.ts`, `npx tsx $S/w4/decks.ts` |
| Score lab variants (repeated after each round) | `npx tsx $S/w4/score-lab.ts [ids] [--only]` |
| Field cost shares | `npx tsx $S/w4/mvshare.ts` |
| Clone checks | `npx tsx $S/w4/dupes.ts` |
| Warband greedy build | `npx tsx $S/w4/warband.ts` |
| Magic precedent | `npx tsx scripts/mtg-db.ts query "..."` (main checkout): capped counters, Cancel family, -X/-X sorceries, tap-to-damage artifacts, 1-mana haste creatures |
| Scratch corpus | `npx tsx $S/w4/bdb/score-all.ts`, then `npx tsx $S/w4/bdb/blades-db.ts build` |
| Lab probe | `npx tsx $S/w4/w4lab.ts --probe --plan $S/w4/plan-a.json --n 2` |
| Lab rounds A to D | detached `bash $S/w4/run-{a,b,c,d}.sh`: 4 workers each, `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`, below-normal priority, run one round at a time and never beside a matrix. Each round is `npx tsx $S/w4/w4lab.ts --plan plan-X.json --out out/X-k.jsonl --claims out/claims-X --worker k` |
| Gauntlet rows | detached `bash $S/w4/run-m.sh`, run sequentially: `npx tsx $S/w4/matrix-variants.ts <r23-base\|r23-rocket-for-ranger\|r23-rocket-for-barrage\|r24-base\|r24-collapse\|r24-cold-refusal> 200 <avatars\|reserve>` |
| Analysis | `npx tsx $S/w4/analyze.ts "a-,b-,c-,d-"` writes `$S/w4/out/analysis-final.txt` |
| Leftover-process check | PowerShell `Get-CimInstance Win32_Process` filtered for tsx, w4lab, matrix-variants, scratchpad and headless: none left |
