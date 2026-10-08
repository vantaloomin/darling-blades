<!-- source-of-truth: src/data/cards/first-dawn.ts · last-verified: 2026-10-04 · measurement record: Hearth-Shield Maiden and Ember-Flick in play; the owner ruled Maiden {W}, Ember-Flick unchanged -->

# Wave 4: two First Dawn cards in play (1.9)

> **Record, not spec.** Measured 2026-10-04 for the 1.9 wave-4 balance pass. Paths under `scratchpad/` or `w4/` were the measuring session's local working files and are not in the repo; every number they produced is in this document. The handoff is in [plan-1.9.md](plan-1.9.md#handoff-2026-10-04).

Measured 2026-10-04 in the worktree `w9-ai`, branch `feat/19-w4-ai-fixes`, at **5dcae2a6** (release/1.9 + the wave-4 card edits + the wave-4 Medium-AI fixes).

- Measurement and recommendation only. No file under `src/`, `tests/` or `docs/` was touched; no git command changed state.
- Scripts, plans and raw output: `scratchpad/w4/two-cards/`. The owner picks.

## Summary

| Card | Cast when seen, before -> after the AI fixes | Scorer (v4 + §4v) | In play (host deck, 4,320 games/arm) | Recommendation | Type |
|---|---|---|---|---|---|
| **Ember-Flick** (FD C, {R} Charm: 1 damage to target creature, then Foresee 1) | Hooves and Fire (Medium) **38% -> 36%** (590/1,553 -> 555/1,561); R28 Darlings (Hard) 47% -> 49% (44/94 -> 46/93). Lab (Medium): 38% of draws | **+0.42** (burn creature 1 0.85, scry 1 0.40, instant 0.15) | Hooves and Fire, vs a blank {R} Charm: **-0.43 deck [-0.58, -0.16]**; **-0.45 ladder [-0.54, -0.39]**; -0.04 std [-0.21, +0.12] (std frame over-reads here, see below) | **No change.** Mildly under; the only lever that moves it (2 damage) overshoots by as much, to Fire Attack's line. Log the AI gap. | none (option: numbers-only, 2 damage) |
| **Hearth-Shield Maiden** (`fdr-hearth-shield-bulwark`, FD C, {1}{W} 1/4 Bulwark, Provoked: gain 2) | R27 gate matrix (Hard) **46% -> 46%** (308/672 -> 306/666); R27 Darlings (Hard) 79% -> 79% (124/156, identical). Lab (Medium): 44% of draws | **-0.37** (body 1/4 2.28, Bulwark -0.70, Provoked gain 2 0.00) | R27's reserve list, vs a 2/2 vanilla in the same hole: **-0.77 deck [-1.04, -0.59]**; **-0.86 std [-1.10, -0.67]** | **Cost to {W}** (text unchanged): in play **+0.11 deck [-0.12, +0.36] / +0.03 std [-0.23, +0.29]**. Owner's call: the scorer reads {W} as +0.44 (Over) and it would be the pool's first 1-mana x/4. | numbers-only |

## How it was measured

### Cast-when-seen re-take (the read's own cells)

`two-cards/allcards.mts` is the wave-4 read's `w4/allcards.mts` with its worktree root repointed to `w9-ai`. Same cells, seeds, brains and the catch-all per-card rule.

| Run | Cells | Games | Card row before (read, e365cc0c) | After (5dcae2a6) |
|---|---|---|---|---|
| `allcards.mts theme 40 all` | Hooves and Fire as the Medium column vs all 28 bosses, cell `200000 + tier*100 + 14` | 1,120 | Ember-Flick 1,553 seen / 590 cast (38%) / 866 stranded | 1,561 / 555 (**36%**) / 906 |
| `allcards.mts darlings 100 the-tyrant-queen` | R28 Darlings (Hard) | 500 | Ember-Flick 94 / 44 (47%) | 93 / 46 (**49%**) |
| `allcards.mts avatars 100 the-shepherdess-of-giants` | R27 gate matrix (Hard) | 500 | Maiden 672 / 308 (46%) / 301 | 666 / 306 (**46%**) / 298 |
| `allcards.mts darlings 100 the-shepherdess-of-giants` | R27 Darlings (Hard) | 500 | Maiden 156 / 124 (79%) | 156 / 124 (79%) |

What the fixes did move on the same theme cells: **Blaze-Horn Charge 0% -> 49%** (0 -> 560 casts, 1.00 Hunt per cast) and Hooves and Fire's column share **31.0% -> 36.8%** (347 -> 412 wins of 1,120). Neither card under study moved. Hard's rows are essentially unchanged, as expected for Medium-only fixes.

### Lab (in-play value)

`two-cards/tclab.ts` is the wave-4 slate lab (`w4/w4lab.ts`) unchanged in method, repointed at `w9-ai`:

- Warchest, MediumAI vs MediumAI, the **15 Warchest columns** (5 starters + 10 themes including Hooves and Fire), 288 games per column, **4,320 per arm**.
- Seeds `12,000,000 + (300 + deckIdx*16 + col)*10,000 + i`, i = 0..287, seat alternates with i. Every arm shares the seeds (paired); round B reuses round A's seeds, so it is paired with round A's arms.
- In-place swaps. Ember-Flick's blank is the same {R} Charm with no text (never cast). Maiden's comparisons are against colourless vanillas in her own hole (the slate's creature convention).
- Two extra per-game counters: draws of the watched card (`d`) and watched casts aimed at the test seat's own creature (`o`).
- Hosts:
  - **Hooves and Fire** (`theme-first-dawn` reserve list, Ember-Flick x4). Deck exchange on Fern-Crest Raptor (a 3-of; normalised to 4 copies).
  - **R27 The Shepherdess of Giants** reserve list (Maiden x3). Deck exchange on Longneck Calf-Guard x4. Played by Medium here (the boss brain is Hard; the lab convention is Medium both sides).
- Currencies: deck exchange, logit standard (5.33 pp at 50%, x 4p(1-p)), power ladder (least squares through vanilla rungs in the same hole). Paired bootstrap, 1,000 draws, seed indices resampled within each column; 95% intervals.
- 4 workers, `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`, below-normal priority, one round at a time (CPU measured 31% while running). Round A: 19 arms, 82,080 games, 31 min. Round B: 2 arms, 8,640 games, 5 min.

**Frame checks**

| Host | Check | Reads | Verdict |
|---|---|---|---|
| Hooves and Fire | 1/1-for-1 vs blank (scorer 1.00) | deck **1.02** [0.88, 1.35]; std 1.59 | deck holds; **std over-reads by ~1.6x** here, so deck and ladder are the guides |
| Hooves and Fire | 2/2-for-1 vs blank (scorer 2.00) | deck **2.07**; std 3.23 | same |
| R27 | 3/3 vs 2/2 at mv2 (scorer +0.86) | deck 0.68 [0.43, 0.89]; std 0.75 | both hold (about 80-90%) |
| R27 | power ladder 2/1 / 2/2 / 3/3 | 60.0% / 59.9% / 62.9% | **fails** (2/1 = 2/2); not used. Deck and std agree with each other, so they are the guides |

## Ember-Flick

**Lab, Hooves and Fire** (`two-cards/out/analysis-final.txt`)

| Arm (x4 in Ember-Flick's slot) | WR | Cast / drawn | Scorer delta | vs budget 1.14: deck | ladder | std |
|---|---|---|---|---|---|---|
| Blank {R} Charm | 42.4% | 0% | -1.14 | | | |
| **Ember-Flick (as is)** | 48.3% | 38% | **+0.42** | **-0.43 [-0.58, -0.16]** | **-0.45 [-0.54, -0.39]** | -0.04 [-0.21, +0.12] |
| No Foresee (1 damage only) | 48.2% | 38% | -0.19 | -0.44 | -0.46 | -0.04 |
| Foresee 2 | 48.2% | 38% | +0.65 | -0.43 | -0.45 | -0.04 |
| **2 damage, then Foresee 1** | 55.8% | 75% | +0.81 | **+0.47 [+0.25, +0.91]** | **+0.42 [+0.29, +0.52]** | +1.38 |
| Reference: Fire Attack (base C, {R} Charm, 2 damage to any target) | 56.7% | 87% | +0.32 | +0.58 [+0.35, +1.05] | +0.53 [+0.38, +0.63] | +1.55 |

- 2 damage vs as-is, paired: +7.5 pp [+6.5, +8.7], +0.91 MEP (deck).
- **Foresee is worth 0.00 in Medium's hands** (as-is vs no-Foresee +0.01 [-0.01, +0.03]; Foresee 2 identical to Foresee 1).
- **Own-target casts: 0%.** Medium never aims Ember-Flick at its own creature, so the deck's stated plan ("cheap Provoked creatures and Ember-Flick wake each other") never happens in AI hands. Medium casts a 1-damage Charm only as removal, which clears `removalCastValue >= 3.5 + removalBias` (`src/ai/MediumAI.ts` main step) only for a valuable X/1, plus combat windows. That is the 36-38% cast rate.

**Reading.** Mildly under (about -0.45) on both currencies that pass the frame check. The scorer reads it +0.42; the gap is Foresee (scored 0.40, worth 0 in play) and the unused self-Provoke mode.

**Recommendation: no change.**
- The one numbers lever that moves it, 2 damage, overshoots by as much as the card is under (+0.42 to +0.47), and lands on Fire Attack's line (Shock, an existing base common, +0.53 to +0.58). Foresee 2 does nothing. Cost cannot go lower.
- Option for the owner, measured: **"Deal 2 damage to target creature, then Foresee 1."** {R} common. Scorer +0.81. Not a clone: Fire Attack, Red-Curtain Cut and Burn the Rope hit any target (incomparable, not dominated); Salt-Fire Charm (DD, 1 damage) is a different set. It lifts Hooves and Fire by 7.5 pp, so the theme deck's floor would need re-measuring.
- **AI gap (lane E, logged, not a card fix):** Medium does not treat a "target creature" damage spell as a Provoked source on its own Provoked creature, and Foresee earns nothing. Wave 4's M1 fix covered "target creature you control" spells only.

## Hearth-Shield Maiden

**Lab, R27 reserve list** (Medium both sides)

| Arm (x3 in Maiden's slot) | WR | Cast / drawn | Scorer delta | In play vs budget: deck | std | Paired vs as-is (deck) |
|---|---|---|---|---|---|---|
| 2/2 vanilla mv2 (P 2.00) | 59.9% | 59% | | | | |
| **Maiden (as is)** | 56.4% | 44% | **-0.37** | **-0.77 [-1.04, -0.59]** | **-0.86 [-1.10, -0.67]** | |
| Provoked: gain 3 | 56.5% | 44% | -0.37 | -0.75 | -0.83 | +0.02 [-0.03, +0.08] |
| 2/4 | 55.8% | 73% | -0.09 | -0.90 | -0.99 | -0.12 [-0.39, +0.07] |
| 1/5 | 55.6% | 74% | +0.06 | -0.95 | -1.05 | -0.18 [-0.47, -0.01] |
| **{W}** (text unchanged) | 56.7% | 50% | **+0.44** | **+0.11 [-0.12, +0.36]** (mv1 budget 1.14) | **+0.03 [-0.23, +0.29]** | +0.07 [-0.02, +0.18] |
| No Bulwark (1/4, Provoked: gain 2) | 58.0% | 71% | +0.33 | -0.39 [-0.71, -0.22] | -0.43 [-0.74, -0.25] | +0.39 [+0.18, +0.55] |

Decomposition (paired, 3 copies):

| Piece | In play (deck) | Scorer |
|---|---|---|
| Provoked: gain 2 (as-is vs a textless 1/4 Bulwark) | **+0.04 [-0.05, +0.14]** | 0.00 (matches the A1.4 lab's 0.00 [-0.21, 0.20]) |
| Bulwark (1/4 Bulwark vs vanilla 1/4) | **-0.29 [-0.39, -0.20]** | -0.70 |
| A vanilla 1/4 against a 2/2 | **-0.57 [-0.87, -0.37]** | +0.28 |

**Reading.** Clearly under (-0.77 / -0.86; both intervals exclude zero), and the cast rate is the same under Medium (44%) as under Hard (46%), so it is not the AI fixes. The loss is the body: in this list a 1/4 is worth about half a mana less than a 2/2, where the scorer prices it above one. The rider is worth nothing, and Bulwark costs less than the scorer charges. Stat and life tweaks get the card cast more (73% for 2/4 and 1/5) without winning more: the R27 list already has walls, and one more wall does not convert.

**Recommendation: numbers-only, cost {1}{W} -> {W}.** Text unchanged: "Bulwark. Provoked: You gain 2 life."
- Lab: +0.11 [-0.12, +0.36] deck, +0.03 [-0.23, +0.29] std. The only lever measured that reaches fair. Its absolute in-play value barely changes (+0.07 paired); the move is a budget move, the honest price of a wall that the AI values at about one mana.
- **Why it is the owner's call:**
  - The Forge's scorer reads {W} as **+0.44 (Over)**, because it prices the 1/4 body at 2.28. The lab says that price is too high here; a human who builds around walls may value it more than Medium does.
  - It would be the **pool's first 1-mana creature with Defense 4** (today's mv1 ceiling is 0/3 Bulwark: Chen Qun, Training Dummy). MTG precedent: Wall of Runes ({U} 0/4 defender, scry 1, common) and Perimeter Captain ({W} 0/4 defender, uncommon).
- Rejected numbers options (measured, no help): Provoked gain 3 (-0.75), 2/4 (-0.90), 1/5 (-0.95).
- Knock-ons if taken: the art bible's Card facts carry cost (`check-art-bible` fails until updated); R27's reserve list is converter-generated (the curve caps may move a slot; regenerate and re-measure R27's floor); no rarity change, so the locked FD histogram is untouched; no same-set clone (Reed-Wall Keeper stays {1}{W} 0/5; the only other FD mv1 creatures are not x/4).

**Changes what it does (propose, not decide):**
- **Drop Bulwark** (a 1/4 that can attack, Provoked: gain 2): measured +0.39 over as-is, still -0.39 [-0.71, -0.22] against budget. Better than any stat tweak but not fair alone, and Bulwark is the R27 wall deck's identity.
- **A rider that reaches the face.** R27 stalls in Darlings (20 turn-limit draws vs Ledger, per the usage read); a Provoked payoff that drains would serve the deck. Not measured. Drain shapes already exist in FD (Tar-Skin Wall, {1}{B} 1/4: Provoked, opponent loses 1), so a white version needs its own identity. Needs scoring and a lab arm before any text is quoted.

## Surprising

- **Neither card's cast rate moved with the AI fixes** (Ember-Flick 38% -> 36%; Maiden 46% -> 46%), while Blaze-Horn Charge went 0% -> 49% and Hooves and Fire's share 31.0% -> 36.8% on the same cells.
- **Foresee is worth zero to Medium**: Foresee 0, 1 and 2 play identically.
- **Medium never self-targets Ember-Flick** (0% of casts), although the theme deck's description is built on it.
- **Stronger Maidens are cast more but do not win more** (2/4 and 1/5: 73-74% cast, -0.12 / -0.18 paired). The value is in the body type, not the numbers.
- **Scorer vs play on walls:** a vanilla 1/4 plays 0.57 below a 2/2 (scorer: 0.28 above), and Bulwark costs 0.29 in play (scorer: 0.70). A scorer note for the wall shape, the same family as the slate's Old Growth note.
- **R27's power ladder fails** (2/1 and 2/2 read the same), and Hooves and Fire's std frame over-reads by about 1.6x. Frame checks matter per host.

## Caveats

- One host per card. R27's list is wall-dense, which may depress the marginal wall; Maiden lives only in R27's lists, so there is no other natural host.
- Maiden's lab runs R27's list on Medium; the boss plays it on Hard. The cast rates agree (44% vs 46%).
- Vanilla comparison cards are colourless, as in the slate (slightly easier to cast than {1}{W}).
- The lab's `drew` count includes opening-hand draws (and re-draws after a mulligan), so "cast / drawn" is a lower bound on cast-when-seen; it reproduces the read's rates closely.

## Commands

All `npx tsx` calls ran from `Z:/Coding Projects/DarlingBlades-worktrees/w9-ai`; S = the session scratchpad.

| What | Command |
|---|---|
| Cast-rate re-takes (sequential, one process) | `bash $S/w4/two-cards/run-usage.sh`: `npx tsx $S/w4/two-cards/allcards.mts theme 40 all ...`, `... avatars 100 the-shepherdess-of-giants ...`, `... darlings 100 the-tyrant-queen ...`, `... darlings 100 the-shepherdess-of-giants ...` -> `usage-*.log/json` |
| Scorer | `npx tsx $S/w4/two-cards/tc-score.ts [ids] [--only]` -> `scores-1.txt`, `scores-2.txt`, `scores-3.txt` |
| Clone / neighbour checks | `npx tsx $S/w4/two-cards/neighbours.ts`, `n2.ts`, `n3.ts` (`neighbours.txt`) |
| MTG precedent | `npx tsx scripts/mtg-db.ts query "..."` (main checkout): mv1 red 1-damage instants; mv2 white defenders; mv1 defenders with toughness 4+ |
| Lab probe | `npx tsx $S/w4/two-cards/tclab.ts --probe --plan $S/w4/two-cards/plan-a.json --n 2` (`probe.log`) |
| Lab rounds A, B | `python mkplan.py`; `bash $S/w4/two-cards/run-lab.sh a`, then `... b` (4 workers each, never concurrently with another job) -> `out/{a,b}-k.jsonl` |
| Analysis | `npx tsx $S/w4/two-cards/tc-analyze.ts a-,b-` -> `out/analysis-final.txt` (`out/analysis-a.txt` is round A alone) |
| Leftover-process check | PowerShell `Get-CimInstance Win32_Process` filtered for tclab, allcards, tc-*, scratchpad and node: none of this run's processes left |
