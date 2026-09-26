<!-- source-of-truth: src/ai/AIPlayer.ts, src/ai/EasyAI.ts, src/ai/MediumAI.ts, src/ai/HardAI.ts, src/ai/ScriptAI.ts, src/ai/determinize.ts, src/ai/evaluate.ts, src/ai/value.ts, src/ai/combatPlans.ts, src/ai/targeting.ts, src/ai/activatedPolicy.ts, src/ai/ritePolicy.ts, src/ai/tithePolicy.ts, src/ai/whispersPolicy.ts, src/ai/discardPolicy.ts, src/ai/sacrificePolicy.ts, src/ai/preservePolicy.ts, src/ai/hauntlinkPolicy.ts, src/ai/landPolicy.ts, src/ai/darlingPolicy.ts, src/ai/foresee.ts, src/ai/personality.ts, src/ai/NoisyAI.ts, src/ai/tiers.ts, src/data/opponents.ts, src/data/draftPersonas.ts, src/meta/draftPicker.ts, scripts/balance-matrix.ts, tests/ai/winrate.test.ts, tests/ai/rungSmokes.test.ts, tests/ai/documentedBehaviour.test.ts, docs/plan-ai-modernization.md · last-verified: 2026-09-25
     If you change those files, update this doc or re-verify the date. -->

# AI

Three difficulties, one interface, one hard guarantee: **no AI reads hidden
information.**

## The interface

```ts
// src/ai/AIPlayer.ts
export interface AIPlayer {
  chooseAction(view: PlayerView, legal: Action[]): Action;
}
```

Every difficulty implements this and receives **only** the redacted `PlayerView`
(from `Game.viewFor`) plus the legal action menu. The opponent's hand and both
libraries are counts, not cards (see [architecture.md](architecture.md) →
"Hidden information"). Honesty is by construction: there is no back door to the
raw state.

## Easy

`src/ai/EasyAI.ts` plays a coherent game — curves out, plays lands, swings — but
loses on tactics. Its deliberate-weakness list, quoted from the class header:

> Easy: plays lands, curves out roughly, and swings — but loses by tactics.
> Deliberate weaknesses (from the plan): all-in-or-nothing attacks, single
> blocks only, no chump blocking until life ≤ 5, never holds up reactive mana,
> passes 85% of response windows, keeps almost any opening hand, and picks a
> random legal action 20% of the time in main phases.

Concretely in the code:

- **Mulligan:** keeps almost anything — keeps with 1–6 lands, hard-keeps after 2
  mulligans. In reserve formats (Warchest/Darlings, where decks hold no lands and
  `landReserve` is set on the view) it keeps every hand — the land band would
  otherwise mulligan everything.
- **Main:** 20% of the time picks a random non-concede action; otherwise plays a
  land, else casts the biggest affordable spell, else passes.
- **Duty:** the shared policy without a combat forecast: a tap-only Duty in
  main one, a paid one only in main two. Easy was deliberately left on this
  simple timing when Medium and Hard learned to use a paid Duty before
  combat (1.8.1, see Duty timing below).
- **Attack:** all-in when its blocker demand (a Dreaded attacker demands two
  blockers) plus the `easyAllIn` margin meets or beats the opponent's untapped
  blockers, otherwise attacks with nothing — the signature Easy weakness. Rage
  bodies are compelled by the engine and attack regardless.
- **Block:** one blocker per attacker, prefers blocks that kill or survive,
  chump-blocks only when at life ≤ 5. Since phase C (2026-09-16) "kills" counts
  only hits the blocker lives to make (an attacker with firstBlade or
  twinBlades that kills it in the first sub-step gets no return hit) and
  "survives" counts a twinBlades attacker's two hits; nothing else about
  Easy's combat changed.
- **Respond:** passes 85% of windows; otherwise a random useful Charm, or a
  Skim when no Charm is castable. The Hauntlink window is a policy call, not
  a coin flip (phase B). Empower's extra mana is charged the develop score of
  the spell it displaces, so an affordable rider is no longer always paid.
- **Hand-size discard:** a uniformly random legal set (the loot discard uses
  the shared `discardPolicy` like every other brain).

Easy has its own seeded RNG (`createRngState`) so its randomness is reproducible.

## Medium

`src/ai/MediumAI.ts` is rule-based priorities with **one-step trade math** and no
lookahead. From its header: "Plays a fair game of attrition — lethal checks,
profitable trades, removal on the biggest threat, trick-risk respect — but no
lookahead." Its rules:

- **Mulligan bands** are tighter than Easy's: on a fresh hand keep with 2–5
  lands; after a mulligan keep with 1–5; hard-keep at 2 mulligans. In reserve
  formats the land bands would mulligan every landless hand, so it judges curve
  instead: keep a fresh hand with ≥ 2 spells castable by turn 3 (mana value ≤ 3),
  ≥ 1 after a mulligan; `mulliganShift` moves those thresholds the same way.
- **Main phase priority order** (`main`):
  1. **Lethal to the face** — if a spell's own ops deal the opponent's life or
     more (targeted burn, targetless face damage, life loss, drain, and their
     combinations, at the spell's real cost including its Whispers or Retell
     mode), cast it (phase A, 2026-09-15).
  2. **Removal on the opponent's best creature** — only when it actually kills
     the target (`removalKills`) and the target is worth it (value ≥ 0.8× the
     spell's cost and ≥ 2.5).
  3. **Burn as reach** — once the opponent is at ≤ 8 life, throw burn at the
     face.
  4. **Develop** — cast the highest-value permanent or Ritual; a spell's body
     is valued through the same op valuator the triggers use, so Rituals are
     ordered by what they do rather than by mana value (phase A). Creature
     wraths and symmetric damage sweeps are removal under the asymmetry gate:
     cast when behind on board, held when ahead. Charms are held for windows;
     buff auras go on its own creatures and debuff auras on enemies.
- **Combat** is delegated to the shared planners (`chooseAttackers`,
  `chooseBlocks` in `combatPlans.ts`). Since phase C every planner decision
  runs through one sub-step exchange model (`combatExchange`) that matches
  the engine's damage code: firstBlade and twinBlades strike in the first
  sub-step, twinBlades strikes again in the normal one (firstBlade plus
  twinBlades is two hits, not three), casualties leave between sub-steps, and
  a body killed before it strikes deals nothing. An unblocked twinBlades
  attacker connects for twice its attack in the attack score, the lethal
  check, the overrun spill and the defender's incoming-damage pressure. A
  sentinel attacker is not charged the holdback penalty, because attacking
  does not tap it.
- **Trick-risk** (`trickBuff`) is **evidence-gated**: defenders are inflated by
  +2 only when the opponent has **≥ 2 open mana sources AND ≥ 1 card in hand
  AND has shown ≥ 1 Charm this game** (checked against the public graveyard —
  honest information only). The gate was added after the 2026-07-02
  difficulty-gap investigation: paying a phantom +2/+2 tax on *every* combat
  against anyone with untapped lands measurably loses more than the occasional
  trick blowout it prevents — vs Easy on the creature-only starter pair the
  gate moved Medium 61.0% → 75.5%, and the gated Medium beats the ungated one
  head-to-head (54–59%) even on trick-heavy deck pairs. The full measurement
  history lives at the change site in `src/ai/MediumAI.ts`.
  **`HardAI.openManaBuff` applies the same gate** to Hard's combat baselines,
  so neither brain pays the tax on unbacked open mana.
- **Removal rules** (`removalKills`): a `destroy` always kills; a `damage` spell
  kills only if `n ≥ toughness − marked damage`.
- **Responses / end step:** counter a big enemy spell (mv ≥ 4), a spell hitting
  its best creature, or a `massDestroy`; remove a dangerous attacker; pump a
  creature to win or survive a fight; spend spare removal and free card-draw at
  the opponent's end step. Since phase A (2026-09-15) the ladder also reads the
  shapes it used to leave in hand: **fog** when the incoming damage is lethal or
  drops it under the life curve's knee, or saves a blocked body worth more than
  the cast; **precombat taps** (offensive when the attack becomes lethal or
  clearly profitable by the combat forecast, defensive when the blocks improve;
  `tapAll` only for lethal); **debuffs** as removal when they kill and as a
  fight flip otherwise; **mark placement and transfer** by survival and
  thresholds, with enemy mark removal treated as removal; and **bounce-to-save**
  for an owned creature under lethal targeted removal or a losing block. Every
  rule reads the redacted view and the legal menu only.
- **Duty:** a tap-only Duty in main one unless its body wants to attack; a
  paid Duty in main one only when it buys the attack something (a lethal one
  ahead of a Hauntlink link, Preserve and every cast unless a spell in hand
  wins on its own), otherwise in main two after developing (1.8.1, Duty
  timing below).

Medium **deliberately does not model face-down information** beyond "open mana
plus a demonstrated Charm = maybe a trick," and it never knowingly holds back
a beneficial play.

## Hard

`src/ai/HardAI.ts` uses **Medium as a baseline and candidate generator**, then
runs **honest simulation** on a determinized clone of the real engine. From its
header: "the real engine plays each candidate line through several sampled
hidden-card worlds (see determinize.ts) and the averaged evaluation picks the
winner. No hidden information is ever read."

One construction detail is load-bearing: HardAI's **internal Medium brains are
built on `simDb(db)`**, the stand-in-augmented card db. Inside lookahead worlds
those brains are handed sim views full of `__unknown_*` ids; a raw-db brain
throws on them, which used to **silently collapse every lookahead world to
`-Infinity`** from about turn 3 on. Fixing that was worth +15pp of win rate on
its own (see the history below).

### Determinize (the honest substitute for seeing hidden cards)

`src/ai/determinize.ts` builds a simulatable `Game` from a `PlayerView` — a
**public-information opponent model**:

- **Your own hand is exact**; your deck, and the opponent's hand + deck,
  are hidden and get filled with **stand-ins**.
- The stand-in pool has six categories (land, removal, trick, 2/3/4-drop
  creatures — all colorless with generic costs, so the model never suffers
  imaginary color screw), and the mix comes from **deck-shape priors minus
  what's already public** (battlefield + graveyard). Nothing ever reads real
  hidden state; the fill depends only on `(view, seed)`.
- **The shipped priors are deliberately conservative — effectively inert**:
  land/interaction fractions at zero, curve weight all on the 3-drop, so every
  hidden card is the middling **3-mana 2/2** stand-in. Simulated opponents
  develop at a plausible "average topdeck" rate, hold no castable instants, and
  so **auto-pass response windows** — which matches the information Hard
  actually has.
- Multi-world machinery exists: each seed deals one plausible hidden-card
  world, and Hard averages scores across `SIM_SEEDS`. At the shipped inert
  priors every world is identical, so a single seed carries the full signal;
  the seed list is the hook for probabilistic priors.
- `simDb(db)` registers the stand-ins so the sim (and Hard's internal brains —
  see above) can look them up.

**Richer opponent models were built and measured — and all lost.** On the
200-game Hard-vs-Medium gate: guaranteed land/cost-curve development 49%
(the simulated counterattack outgrows reality and drowns the candidate margins
that drive attack holdback); always-held removal/tricks 50% (every line looks
equally doomed, so the search stops deviating from Medium); seed-sampled
interaction over 3 worlds 49.5% (sim tricks fire against Hard's own blocks in
the counterattack half, taxing exactly the holdback candidates that win games);
trick-only / curve-only variants 49.5% / 60.5% vs a 61.5% same-code baseline.
The numbers live in the `determinize.ts` module header. Hard's edge lives in
**engine-exact combat math on the public battlefield**; an inert hidden-card
model keeps that signal clean. The category/prior machinery stays as the tuning
surface for future pools where real decks punish attacks more often.

### What Hard actually searches

Hard defers to Medium where the sim adds nothing, and searches where the
engine's exact firstBlade/overrun/deathblade math beats any heuristic:

- **Main phase** (`searchMain`): Medium's choice is the baseline; Hard then
  simulates a whitelist of alternatives against it: Skim, Empower, Retell,
  Whispers, Rite and Tithe casts, the vocabulary casts (qualified targets,
  pairs, creature Retell), one Preserve, one Duty, and Darling casts, capped at
  eight ordinary candidates beyond the always-searched Rite, Tithe and
  vocabulary ones. Since phase A (2026-09-15) **`passStep` is a candidate**
  (it must strictly outscore Medium's cast in the sim) and a creature cast in
  main one is compared against holding it for main two at the same settled
  endpoint; across the gate games the pass won 2,643 main decisions and the
  hold 305, out of about 109,000. The ordinary candidate cap is seven plus the
  pass slot. Since 1.8.1 a Morning Duty whose forecast attack is lethal is
  taken before the search, and any other paid Duty chosen in main one is
  checked the way the attack search checks an attack: the Duty now against a
  pass to combat, each played through the opponent's counterattack; when
  holding wins by +0.75 the Duty is struck and Medium picks again (Duty
  timing below).
- **Attacks** (`searchAttack`): Medium's attack set is the baseline. Hard runs
  a **full-turn attack lookahead** — each candidate set plays through the
  opponent's whole counterattack turn (`lookahead`) before evaluation, so the
  race is visible. Candidates: all-in, no-attack, drop-one, **drop-two**
  (over-extension often hides behind any single drop), and add-one variants.
  It keeps Medium's plan unless the baseline already wins outright (score
  ≥ 1e5) or a candidate clears it by a real margin (+0.75).
- **Blocks** (`searchBlocks`): a **greedy hill-climb from Medium's
  assignment**. Each round tries every single modification — unblock one, add
  a free blocker to any attacker (gang blocks up to 3), or move an assigned
  blocker (never onto a full gang of three, never leaving a Dreaded attacker
  singly blocked; phase C) — and the engine plays each assignment through combat damage. Up to
  4 rounds; a deviation must clear Medium's plan by **+1.5 sim score** (any
  margin if Medium's plan simulates into a loss). Blocks resolve this turn on
  public information, so this is where the sim is most trustworthy.
- **Responses** (`searchResponse`): Medium's rule-list choice is the baseline;
  candidate casts are **scored by the same simulation** and upgraded on the
  same +1.5 margin — terminal discoveries (a cast that wins, or dodges a loss
  Medium's choice would suffer) clear any margin for free.

The margins exist because the inert opponent model makes small eval deltas
noisy — deviations must earn their keep.

### The evaluation function

`src/ai/evaluate.ts` scores a position for the player to move. Inputs:

- **Life differential, convex per side** — `14 * tanh(life / 9)`. Life is nearly
  worthless at 20 and precious near 0, so chip damage at high life never outbids
  real board material.
- **Board material** via `permValue` (`src/ai/value.ts`), with **until-EOT buffs
  stripped** (a pumped creature is not lasting value), a **0.85× tapped discount**
  and a **0.92× summoning-sick discount**.
- **Card advantage** — 1.2 per card, placeholder cards counted (they represent
  real cards).
- **Mana development** — 0.4 per land differential.
- **Clock** — rewards your power beyond half the opponent's life; penalizes their
  power beyond your life (`0.6 * max(0, myPower − their.life*0.5)` and
  `−1.5 * max(0, theirPower − my.life)`).
- **Marks beyond the bodies** (`markedBoardValue`, 2026-09-03) — each
  mark-gated ability in play (`controlMarked`, `markedThreshold`) earns its ops'
  worth times progress squared toward its need, paying 1.5× once the gate is
  met, because the one-turn lookahead ends before any dawn trigger fires; the
  same abilities still in the AI's own hand count at half weight so the board
  is built before the payoff is cast; and every Propagate source in hand (up
  to two) adds 0.3 per marked creature on board. The opponent's term reads the
  board only.
- **Terminal states dominate** — win `+1e6`, loss `−1e6`, draw `−500`.

`permValue`/`cardValue` (`value.ts`) score a card by mana value + (P+T)/2 +
keyword bonuses + a lord/legendary and triggered-ability premium. On the
battlefield a marked creature carries a further **0.5 premium plus 0.15 per
extra mark** (`markedBodyValue`): a mark is what Propagate compounds and what
thresholds count, so it tips even trades in combat and block math without
turning the body into an untouchable. Two more board-shaped corrections came
from the 2026-09-03 seeded pass on Starborne's threshold cards, where the hard
AI was casting Propagate bodies and mark-all spells into empty boards and
marking whichever creature came first: `markBoardAdjust` shifts a cast's
score by the marked creatures (Propagate) or creatures (mark-all) it will
actually touch, negative on a board that cannot use it yet, and mark
targeting prefers the body that keeps the mark alive (toughness, evasion, no
damage) and spreads over unmarked bodies when a threshold payoff is in play
or in hand.

## Duty timing (1.8.1)

Until 1.8.1 the shared policy dropped every Duty that costs mana in main one,
so a paid Duty ran only in main two, after combat. A Duty that taps a
blocker, damages a creature or pumps an attacker was spent after the attack
it exists to enable (review finding G9). The rule now:

- **When a paid Duty moves into main one.** Medium and Hard pass the policy a
  `PrecombatContext` (Medium's trick buff and the personality; Hard takes
  its Medium's through `morningContext`, so both brains price a Duty alike).
  `precombatDutyEdge` performs the Duty with the real engine on a
  determinized copy of the public position, so taps, lethal damage, pumps,
  Marks, a mana creature the action's payment taps and life loss land
  exactly as they will; then the brain's own attack planner and the defender's block
  model price the attack on both boards. The Duty goes before combat when the
  attack becomes lethal only with it, or when its attack score rises by more
  than `PRECOMBAT_DUTY_MARGIN` (0.75 in `scoreAttack` units: two damage
  through at high life, one at twelve or below). It is ranked by its impact
  plus that gain, or plus `PRECOMBAT_LETHAL` (100, what `scoreAttack` pays a
  lethal connection). Anything else waits for main two as before.
- **The gain is the fight's, not the weights'.** `scoreAttack` weighs damage
  0.45 a point above twelve life and 0.9 at or below, 0.2 more with two
  creatures to spare, and its holdback reads the defender's power. A ping
  that crosses twelve, or a kill of a creature that would never block, moves
  those weights with the combat unchanged, and the first version read that as
  gain (a ping at 13 life beat casting a bear). Both boards are now planned
  and scored at the life totals, creature counts and opposing power of the
  board before the Duty (the optional `weightBoard` of `scoreAttack` and
  `chooseAttackers`); the new life totals answer only whether the real plan
  is now lethal.
- **Cost.** One full forecast per source and ability, on its best target
  by impact among the targets that reach the fight (a blocker for one of our
  attackers, one of those attackers, or a player). Its other targets are
  only screened for lethal, so a kill of their 0/4 wall that lets our
  Overrun rhino spill for the game is found even when their bear is the
  bigger removal target: first two bounds (every attacker unblocked, and the
  all-in forecast before the Duty plus the biggest attacker, Overrun spill
  and the Duty's own damage or pump) must reach the opponent's life; then
  the Duty is performed on the copy and every eligible attacker is sent,
  and the damage must reach their life against the greedy block model and
  against a cautious defender (`cautiousThrough`: biggest attackers answered
  first, a chump where one exists, only unblocked damage and Overrun spill
  through). Only then does the full forecast run, and decide. The cautious
  bar is what keeps the search honest: these are the targets a greedy
  defender mishandles. On the review's 1,500 removal-in-hand boards played
  against Hard's blocks, the greedy test alone changed 28 of Medium's
  choices for 4 better and 23 worse games (13 new losses, 1 new win); with
  the cautious bar it changes 2 (1 new win, no new losses). On 3,000 random
  low-life boards it rejects 49 targets that are lethal only against the
  greedy model, 47 of which do not win against Hard's blocks when forced,
  and of the reviewer's eight hidden targets that do, both brains now find
  and win seven. None of
  this runs for a Duty whose ops cannot touch a fight (draw, life gain,
  Foresee, tokens), when no creature of ours can attack, or while `main`
  would first play a land, a reserve land or a Darling paydown. Hard's
  simulated opponent (`morningDuties: false`) keeps paid Duties in its main
  two, so the attack search's lookahead never forecasts. Results are cached
  per view and keyed on the mana creatures a payment taps (lands do not
  matter), so the reserves, the ladder and Hard's candidate map share one
  forecast and a payment rewritten onto an attacker is forecast afresh. What
  remains is two attack plans when a paid combat Duty is live, which scales
  with board width like the planner itself (the table below).
- **The mana, and the ladder.** `MediumAI.constrainMainMana` already reserved
  the best develop cast's mana against a paid Duty in main two, and a live
  Charm's mana in every step. In main one a qualifying Duty is compared with
  that develop cast: when its worth (impact plus gain) beats the cast's
  `castScore` it spends first, otherwise it may use only mana the cast does
  not need. A lethal Duty is exempt from both reserves, and Medium's ladder
  takes it right after the land, reserve-land and paydown steps, ahead of a
  Hauntlink link, Preserve and every cast, unless a spell in hand is lethal
  on its own (face damage cannot be blocked). With the opponent at 4,
  tapping the only blocker wins; removal on their bigger tapped creature, a
  Preserve with an empty hand and linking an unlinked carrier all spent the
  same mana first until the review caught them.
- **Hard** takes a lethal Morning Duty from Medium's baseline before any
  search. Otherwise it searches the qualifying Duty as a main-one candidate;
  its shallow sim stops before combat, so when the chosen action is a paid
  Duty in main one Hard checks the forecast with the attack search's
  referee: `lookahead` from the Duty against `lookahead` from a pass to
  combat (where Medium uses the Duty in main two if it still pays), each
  played through the opponent's counterattack. When holding wins by the
  attack search's +0.75 the Duty is struck from the menu and Medium picks
  again, so a develop cast the Duty was crowding out still happens (a second
  Morning Duty gets the same check). The documented pair: a tap that lets our
  giant race is kept; at 8 life, with their second giant waiting to swing
  back, the same tap is declined because the backswing is lethal, and a bear
  in hand is cast instead.
- **The evaluation fix it needed.** A tapper's board value
  (`activatedAbilityValue`, part of `permValue`) priced a tap on a currently
  tapped target at zero, so a lookahead that ended after the opponent
  attacked (their attackers still tapped) marked our tapper down by about six
  points, and Hard read every tap-then-attack race as a loss. The potential
  now treats a target as untapped by the next use; scoring the action on the
  live board still sees the tap state.
- **Unchanged.** Easy and ScriptAI keep the simple timing (they pass no
  context). A creature Duty source that can attack still attacks first. In
  main two a paid tap or until-end-of-turn pump still fires on leftover mana:
  it achieves nothing after combat, but it spends only mana nothing else
  wanted, and `tests/data/landEconomy.test.ts` pins that Afternoon use.
- **Known limits, logged for 1.9.** A kill of a creature that would die in
  combat anyway (a chump blocker) reads as worth nothing before combat, as
  it did in 1.8.0. Lethal on the best target is judged against the greedy
  block model, not the defender's best blocks (only the screened targets
  must also beat the cautious defender). Medium's replacement pick after
  Hard vetoes a Duty is Medium's alone and skips Hard's search.

**Cost, 2026-09-25.** The 1.8.1 review's probe (bears and giants N a side,
four lands each, one Duty artifact; mean ms per decision on a shared
machine, so read the scale rather than the digits):

| Decision | N | Pre-G9 | First G9 cut | Now |
| --- | --- | --- | --- | --- |
| Medium main one, our tapper | 8 | 0.2 | 26 | 6-7 |
| | 12 | 0.3 | 132 | 20-23 |
| | 16 | 0.6 | 664 | 55-86 |
| Hard attack, their tapper | 12 | 118 | 868 | 81-86 |
| | 16 | 606 | 2,925 | 465-576 |
| Medium main one, land in hand, our tapper | 12 | 1.5 | 129 | 0.6 |

"Now" spans the runs after the review fixes, with and without the lethal
screen; on this probe the bounds skip every screen. Hard's attack with their
tapper is back to its no-Duty cost (507-589 ms at N=16 in the same runs), and
the no-Duty rows did not move. Medium's main one with our tapper still pays
the two attack plans. On a synthetic Warchest list (Crimson Muster with four
Tide-Gate, four Festival Rocket and two Nebula Beacon), ten games, back to
back twice, where low-life boards do run screens: Medium 33-34 ms a game
before G9, 46-47 without the screen, 57-61 with it; Hard 146-147, 165-173
and 184-193.

**Exposure, 2026-09-25 (usage counts, not win rates).** No starter reserve
build and no gauntlet `reserveDeck` carries a paid Duty or any tapper Duty,
and the two brain gates play the TEST_DB decks, so every gate in
`tests/ai/winrate.test.ts` should read exactly as before; the next gate run
confirms it. The Darlings lists carry one to three singleton paid Duties,
mostly life gain, tokens and Foresee; the combat-relevant ones are Wrecker of
the Reach (rung 5), Ember-Lane Flare (rung 23), Deepfield Array (rungs 24 and
25) and Cellar Jar (rungs 24 to 26). Ten Darlings games each for rungs 5 and
23-26 used the new branch zero times. On the synthetic list above, over ten
games, Medium used 14 paid Duties in main one and 12 in main two (0 and 15
before G9), Hard 6 and 4 (0 and 9).

## Win-rate gates

`tests/ai/winrate.test.ts` plays hundreds of seeded AI-vs-AI games with sides
alternated (so neither AI owns the better deck) and asserts:

| Matchup            | Gate                 | Current (2026-09-17)    |
| ------------------ | -------------------- | ----------------------- |
| Medium vs Easy     | **≥ 80%**            | **81.5%** (163/200)     |
| Hard vs Medium     | CI floor **≥ 0.70**  | **76.5%** (153/200)     |

The same file gates the tower's summit across four tests so no single
matrix blows CI's 900 s per-test budget: rungs 14-18 and rungs 19-22 hold
per-avatar floors and ordering relations, and rungs 23-24 and 25-26 each hold
per-avatar floors plus a termination check (five complete 40-seed cells, zero
draws).
Every rung from 14 to 26 has carried a real floor since the 2026-09-17
re-baseline described under Tower rungs below.

The original plan gate for Hard was **60% — met and exceeded**. The honest
history: **53%** (full-turn attack lookahead + terminal-outcome detection only)
→ **62.5%** (block hill-climb + response search) → **77.5%** (the `simDb` fix
for Hard's internal Medium brains — the raw-db brains had been silently
collapsing lookahead worlds to `-Infinity`) → **78.0%** (evidence-gating the
trick model in `MediumAI.trickBuff` / `HardAI.openManaBuff` — see the Medium
section). Richer hidden-card opponent models were measured and all lost win
rate — see the Determinize section above. The floor ships at **0.70** to leave
CI-variance margin (±3.5pp at 200 games) under the measured ~0.78.

The win-rate file is the suite's long pole: the five gates plus the mini-fuzz
took about **350 s** locally on 2026-09-15 and **962 s** on 2026-09-17, the
second reading taken while another test run shared the machine, so re-measure
idle before treating it as the new figure. Inside it the single rungs 14-22
gate used 559 s of its 900 s per-test budget that day and **692.6 s on CI
hardware on 2026-09-19**, and the two tuning passes that day lengthened it
again (394 s to 507 s locally, about 800 s at CI's measured 1.57x), because a
boss who survives her early turns plays longer games. It was split the same
day into rungs 14-18 and rungs 19-22: same ids, same seeding, same floors, and
the order rules divide cleanly, since all but rung 20 against rung 19 sit
inside 14-18. **A tuning pass that makes a slow boss stronger makes her gate
slower; check the gate's wall time, not only its result.** The next summit
rung goes in a gate of its own. The full suite takes about 15 minutes
(3,817 tests, 908 s measured idle on 2026-09-19); run it on an idle machine.

## Tuning surface

If you want to move the numbers, these are the levers:

| File                   | What it controls                                                             |
| ---------------------- | ---------------------------------------------------------------------------- |
| `src/ai/value.ts`      | Per-card and per-permanent worth (keyword bonuses, lord/trigger premiums).    |
| `src/ai/evaluate.ts`   | Position scoring — life curve, material discounts, card/mana/clock weights.   |
| `src/ai/combatPlans.ts`| Shared attack/block heuristics (damage weights, trick-risk, double-blocks, holdback). |
| `src/ai/foresee.ts`    | Shared deterministic foresee (scry) policy (all brains + ScriptAI): keep lands while developing, then bottom excess lands and uncastably expensive cards. |
| `src/ai/whispersPolicy.ts` | Whispers (1.8): keeps a whispered cast only while its graveyard index is in the public `whispersLive` list and `whispersValue` (the cast at its Whispers cost, +0.75 when the marker dies at the next Dawn, -0.25 when it survives into the owner's next turn) beats the best hand cast; every brain applies it before its cast ladder, Hard's whitelists admit whispered casts in main and response. |
| `src/ai/tithePolicy.ts` | Tithe (1.8): rewrites the engine's canonical fodder set or drops the flag. Candidates sorted by `permValue` per point of effective Defense; pairs preferred so odd totals waste nothing; never the single best body, never a planned attacker, never the cast's own target. Since phase B (2026-09-15, owner ruling D5) a fodder-class body (a token, Defense 2 or less, or summoning-sick and unable to attack) may be sold undamaged at a fifth of its board value, but only when the generic mana saved is two or more, or the saving turns an unaffordable spell into a legal cast this turn; any other body is sold only when the mana saved beats its full board value. Applied beside `applyRitePolicy` in all three brains and the rollouts. |
| `src/ai/discardPolicy.ts` | Loot (1.8): the shared deterministic discard choice for every brain and ScriptAI: the highest-cost spell current mana cannot pay first, then a land beyond four projected sources, then the lowest-value card; the last affordable spell is protected unless the count forces it. |
| `src/ai/sacrificePolicy.ts` | Edicts (1.8): the shared mandatory sacrifice choice: the lowest `permValue` body, battlefield order on ties; Rite and Tithe fodder policies protect a chosen target from being sold. |
| `src/ai/activatedPolicy.ts` | Duty (1.8): when and which tap ability to use, including `abilityIndex` on multi-Duty carriers; tap-only Duties in the Morning, paid ones in the Afternoon unless the brain passes a `PrecombatContext` and `precombatDutyEdge` says the Duty makes the attack lethal or improves it, at fixed attack weights, by more than `PRECOMBAT_DUTY_MARGIN` (1.8.1, Medium and Hard only, one forecast per source on its best target; see Duty timing), never a Rage body, never a self-harming ability; targets by public impact. Since phase B Medium's `constrainMainMana` reserves development mana against a paid Afternoon Duty (develop first, the Duty runs on what remains) and `liveCharm` holds mana, colours preserved, for a Charm whose rule is live against the public board (removal, counter, fog, trick, global removal, tap, bounce); Hard searches the two best distinct Duty choices. |
| `src/ai/ritePolicy.ts` | Rite: the fodder set (cheapest bodies, never the best body or a planned attacker or the cast's own target) and the decline rule when the fodder outvalues the cast. |
| `src/ai/preservePolicy.ts` | Preserve: fires when mana is idle or the brain is behind on bodies; picks the bigger affordable body by public `cardValue`. |
| `src/ai/hauntlinkPolicy.ts` | Hauntlink (rules rev 4, phase B 2026-09-15): `hauntlinkHostFit` scores what the rider grants each host (keywords it lacks, fights the stats change, marks it can use), ties to the larger body; a main-phase move must beat the link's mana cost times 0.65 plus 0.25 (no churn); `chooseHauntlinkWindow` moves the link in the combat-damage window to save a blocked attacker or blocker, and in the trigger window when the trigger about to resolve threatens the current host. Easy and Medium decline a move whose forecast meets an op it cannot project; Hard searches every legal link in the window with its response margin. |
| `src/ai/targeting.ts` | The greedy target picker for deferred trigger targets and the vocabulary target policy (`maxCost`, `minAttack`, `exactly` pairs, `opponentCreature`, per-op `targetIndex`, creature Retell) that keeps one best assignment per cast mode. |
| `src/ai/landPolicy.ts`, `src/ai/darlingPolicy.ts` | Reserve-format land choice (fix missing colours, keep basics when mana is idle) and the conservative Darling tax paydown. |

`determinize.ts` is the opponent-modeling knob: the deck-shape priors
(`LAND_FRACTION`, `INTERACTION_FRACTION`, `CURVE_WEIGHTS`) and the
`SIM_SEEDS` world count in `HardAI.ts`. Before reaching for it, read the
measured negative results in the `determinize.ts` header — the shipped
inert priors beat every richer model tried so far, and any new model should
be judged on the same 200-game gate.

## The Avatar personality system

An **avatar/personality system** (shipped 2026-07-02) layers tunable knobs over these
three brains — themed opponents with their own aggression/greed dials, without
rewriting the cores. The knobs live in `src/ai/personality.ts` (frozen `DEFAULT_PERSONALITY` reproduces the base brains bit-for-bit — enforced by lockstep tests in `tests/ai/personality.test.ts`); the 26 avatars with decks and tunings live in `src/data/opponents.ts` (the base
8 plus eighteen expansion gauntlet bosses through the Drowned Deep summit pair at rungs 25-26).

Balance is measured, not guessed: `scripts/balance-matrix.ts`
(`npm run balance-matrix`) runs deterministic avatar-vs-starter, starter-mirror,
and difficulty round-robin matrices, and the dated baseline (all guidance bands
green as of 2026-07-02) lives in a comment block in `src/data/opponents.ts` —
re-measure and refresh it after any change to decks, personalities, starters,
or brains.

The Yokai Nights summit pair sits at rungs 19-20 (Queen of the Lanterned Roof,
Kitsune Neon Tyrant); their shipped floors are the reserve-native re-centre
below (0.545 and 0.805), not the pre-re-centre numbers.

The Sands of the Duat summit pair is present at rungs 21-22: Anubis, Who Holds
the Scale at rung 21 and Bastet, Mistress of the Ninth Return as the final rung
22 (the owner swapped the order on 2026-08-21 so the climb ends on the stronger
boss).

**The avatar matrix went reserve-native on 2026-08-23, and every rung number
below it changed.** Until then `runAvatarMatrix` played each avatar's classic
`deck` against the classic starter lists, so `tests/ai/winrate.test.ts` - the
tower's only public win-rate gate - priced a format that retired on 2026-08-10.
The floor matrix and the tier dial rows were both migrated the day classic
retired; this one was missed. It now fields each avatar's designed
`reserveDeck` + `landReserve` against the shipped starter reserve builds, which
is what `DuelScene` seats for a real gauntlet duel. Numbers from before that
date are not comparable to numbers after it.

Measured 2026-08-23, `--avatars --seeds 200` over rungs 14-22 (9,000 games),
after the two summit tunes below: R14 63 · R15 71 · R16 69 · R17 75 · R18 86 ·
R19 61 · R20 87 · R21 57 · R22 75, FLAGS none. Floors are each average less the
documented 6.5pp 40-seed noise band, rounded down to the half point, since CI
runs the matrix at 40 seeds.

Two rungs were hand-tuned in the same pass, and they failed for **different**
converter reasons, which is why both are recorded rather than summarised:

- **Rung 21 Anubis, 33% to 57%.** Her build retained four copies of a charm
  that targets artifacts or enchantments into a format whose five starter
  columns contain neither, so a tenth of her deck was blank in every game.
  Body quality at equal mana and a `firstBlade` answer to Grave Harvest's
  thirteen `deathblade` creatures followed. The largest single lever was
  cheapening her curve: four of her ten lands enter tapped while Crimson
  Muster's ten are all basics, and `landReserve` is pinned to the converter, so
  tempo has to be bought with cheaper spells rather than better ones.
- **Rung 16 The Bride, 54% to 69%.** She had dropped below rung 14 on the
  reserve field with no deck change of her own - she lost that ground to the
  format on 2026-08-10, and it was invisible while this gate priced classic.
  Here the curve cap **was** binding: she is mv6 and `CURVE_CAP` allows two, so
  the build shipped two copies of the legend her classic list runs four of. She
  was also a reanimator with nothing worth reanimating, the archetype blindness
  [plan-1.6.md](plan-1.6.md) says needs Hel's exemption.

Both exemptions are registered in `tests/data/avatarReserveDecks.test.ts` and
hold only while they keep measuring better than the builder. Every rejected
draft is retained in the avatars' `src/data/opponents.ts` entries, including
two that look like obvious improvements and measured as losses.

The ladder still dips at R19 (61) and R21 (57) relative to R18 and R20. That is
the accepted non-monotonic summit shape, not a regression.

**Rungs 21-26 were re-baselined on 2026-09-17**, after the AI modernization
(phases E, A, B, C and D) and the tuning passes that followed had all landed
on release/1.8. One command, `--avatars --seeds 200 --only` the six summit
ids (6,000 games, FLAGS none, zero draws in the whole run): R21 Anubis 65
(71/79/67/61/46) · R22 Bastet 74 (54/85/61/84/85) · R23 Chrome Broodmother
60 (42/85/55/59/63) · R24 Violet Signal Queen 71 (51/88/64/62/91) · R25
Drowned Deacon 66 (38/72/65/83/75) · R26 Marsh-Mother 75 (64/77/66/81/87).
Same minus-6.5pp convention, and the ratchet: Anubis rose 0.505 to 0.585 and
the Violet Signal Queen 0.615 to 0.645; Bastet (candidate 67.5) and Chrome
Broodmother (candidate 53.5) kept their standing floors, because a candidate
under the current value is recorded, never applied; the Deacon and the
Marsh-Mother took their first real floors at 0.595 and 0.685, retiring the
tier-6 provisional termination-only gate. Rungs 14-20 were not re-measured
in that pass; they were on 2026-09-19, below. Every new floor cleared at CI's 40 seeds the
same day (R21 70.0 · R22 75.0 · R23 60.5 · R24 69.5 · R25 63.5 · R26 71.0).
Two findings: Chrome Broodmother has fallen 68 to 60 since 2026-08-30, mostly
out of Muster (46 to 42), which leaves 1.5pp between her 200-seed mean and
her own floor, the narrowest margin on the ladder and the next deck owed a
measured tuning pass; and Anubis is the AI pass's big winner, 57 to 61 to 65,
with Harvest (46) still her only losing column.

**Rungs 14-20 re-baselined, 2026-09-19,** on the final 1.8 pool, same harness
and seeding as the gate, 200 seeds per cell, FLAGS none: R14 Artoria 65.6
(27/91/66/75/71) · R15 Carmilla 72.3 (61/78/52/85/86) · R16 The Bride 68.6
(57/73/51/79/83) · R17 Glass-Coffin Queen 77.3 (70/76/62/94/85) · R18 Abyssal
Songstress 88.5 (88/93/73/95/95) · R19 Queen of the Lanterned Roof 58.6
(40/75/49/59/71, one draw in 1,000 games) · R20 Kitsune Neon Tyrant 81.6
(74/70/82/91/92). The ratchet: Carmilla 0.645 to 0.655, the Glass-Coffin Queen
0.685 to 0.705, the Songstress 0.795 to 0.82 (her margin had shrunk to 1.5pp
and is 6.5 again); The Bride (candidate 62.0), the Queen of the Lanterned Roof
(52.0) and Kitsune (75.0) kept their standing floors. All seven cleared at
CI's 40 seeds the same day (65.0 · 74.5 · 69.5 · 79.5 · 84.5 · 56.0 · 84.0),
zero draws, every order rule holding. **The finding: Kitsune has fallen 87 to
84 to 81.6 across the AI passes and now sits 1.1pp over her own floor, the
narrowest margin on the ladder,** with Muster (74) and Communion (70) her soft
columns; the Queen of the Lanterned Roof sits 4.1pp over hers. Both were
tuned the same day, in the paragraphs that follow. The gate runs
fixed seeds, so a thin margin is not a random failure; it is fragility to the
next change to the engine, the AI or a card either deck runs. Kitsune is the
next deck owed a measured tuning pass. `RUNG_BANDS` in
`scripts/balance-matrix.ts` was synced to the gate the same day: it had kept
rung 21's pre-ratchet value and carried no band for rungs 23-26.

**The Queen of the Lanterned Roof's tuning pass, 2026-09-19,** closing the
other thin margin. Her converter cut had no creature below three mana, and
her three-drop (Neon-Gate Warden) has Bulwark and cannot attack, so she did
nothing on turns one and two while Crimson Muster (40) and Burning Tides (49)
ran her over. Four Circuit Foretelling became four Lantern Fixer, a 2/2
Kitsune for two that her three lords make a 3/3 or better: 71.7 on the
committed list (53/86/61/82/78, 0 draws), her floor ratchets 0.545 to 0.65, and
CI's 40 seeds read 68.0. On the 14-deck reserve matrix: 62.5 to 74.2. Sea-Glass
Knife and Neon-Gate Warden measured load-bearing (60.0 and 56.1 without them).

**The converter-defect check, 2026-09-19, and what it was worth.** The
converter caps expensive cards at two copies and fills the forty by inflating
cheap packages to four. `balance/converter-audit.ts` (local) compares every
boss's Warchest forty with her authored list; it flagged five untuned bosses
whose namesake or core package was cut. Measured with the authored cards
restored, on the five starters: the Queen of the Lanterned Roof 58.6 to 63.9,
Yohime 76.1 to 80.2, Titania 58.6 to 58.3, Carmilla 72.3 to 71.9, and the
Marsh-Mother 74.8 to 69.0, where restoring her own legend HURTS. Then the
Queen's +5.3 went to the 14-deck matrix and read +1.0, which is noise. **So of
five suspects, none was a real converter defect; Kitsune's four dropped
Queenpins remain the one genuine case. A dropped namesake is a suspect, not a
defect, and a starters-only gain is a suspect too.** The check still paid for
itself: it put her list in front of a reader, and the missing two-drop was
plain to see.

**Kitsune's tuning pass, 2026-09-19,** closing that finding the same day. She
had never been tuned: her list was the converter's first cut, and it had
DROPPED the four Redline Queenpins her authored list runs (5/4 Warcry, 4
damage on arrival) and DOUBLED her Hauntlink package to eight three-mana
copies, the same shape of converter defect that once hobbled The Bride.
Restoring the authored 4/2/2 (two Burning Mask and two Ember-Link Chain become
four Queenpin) reads 88.3 on the committed list (79/84/87/97/95), her floor
ratchets 0.805 to 0.815, and CI's 40 seeds read 90.5. Confirmed on the 14-deck
reserve matrix first: baseline 86.8, this list 92.3. The lever is smooth (two
Queenpin 86.9, three 88.7, four 89.0), which leaves her strength an owner dial.

**What that pass measured before it cut anything, and the method worth
keeping.** The first theory was that the brains do not use Hauntlink. It was
stale (phase B wrote `hauntlinkPolicy.ts`) and it was also checkable, so it
was checked: a read-only wrapper on her brain over 500 of her own matrix games
counted, per Hauntlink card, casts, links and copies stranded in the final
hand. Once a Hauntlink card is on the battlefield the policy uses it (Burning
Mask linked 0.82 times per cast, Ember-Link Chain 1.21), so the brain was
cleared. The list was the problem: each Mask and Chain she saw was cast about
half the time (52% and 51%), because eight is more than her curve can spend.
**A behaviour test proves a brain CAN make a play and a win-rate gate proves
the boss wins enough; neither says how often she USES a mechanic when she
could. Count that before tuning, or a tune can hide a policy bug by swapping
the unused cards out.** A general per-mechanic usage audit on the balance
telemetry is proposed for 1.9. The same count found Hauntlink Apex cast in 7%
of her games (13% when seen), and the first version of this paragraph called
that a card defect wanting a ruling. The Hauntlink recost proposal that
followed the same day recommended no recost; **the owner ruled a recost for
1.8.1 anyway (D7, option A, on its own branch): Apex costs {3}{U} and its
Dawn draw becomes "During your Dawn, Foresee 1", with the {3}{U} link and
its +3/+3 Skyborne Untouchable rider unchanged.** The "7% of her games" was
her pre-tune list; on the tuned list a same-code control reads 5%. What the
follow-up measured, with the 1.8.1 re-measure beside Kitsune's rows (same
probe, 500 of her games on the release tip; the control with the old Apex
swapped back in reproduces the old figures exactly, so the change is the
recost alone):

| Boss, shape | Card | Cast + link | Cast when seen | Links per cast |
| --- | --- | --- | --- | --- |
| Queen of the Lanterned Roof, control, about 10 turns each | Hauntlink Signal Lure | 1 + 1 | 76% | 0.96 |
| | Sanctum of Many Masks | 3 + 4 | 70% | 1.58 |
| Kitsune, aggro, about 7 turns each | Burning Mask of the Void | 3 + 3 | 40% → 33% | 0.84 → 0.79 |
| | Ember-Link Chain | 3 + 1 | 41% → 33% | 1.32 → 1.20 |
| | Hauntlink Apex (recost in 1.8.1) | 8 + 4 → 4 + 4 | 10% → 37% | 0.75 → 0.93 |

After the recost Apex is a live card: cast in 20% of her games (5% before),
110 casts and 102 links over the 500 against 28 and 21. It takes curve slots
from the other two, whose casts fall from 111 and 109 to 90 and 86. Kitsune's
record did not move (445 of 500 against 449, inside the noise, and not a gate
measurement).

A four-mana link is used MORE per cast than a one-mana link where games run
long, so dear links are not going unused. Land drops are guaranteed in this
format, so eight mana is reliable on turn eight; the eight-mana Apex was dead
in Kitsune's deck because her games end on turn seven, a deck-fit fact. The
workbench rated that card fair at eight (+0.46) and 3.7 too strong at four,
because its Dawn draw alone was worth about five mana; the 1.8.1 recost
trades the draw for Foresee 1 so the card is fair at four (the workbench
reads it -0.01).
**One real thing the exercise did find, recorded and not acted on:** the power
formula prices a link at the face value of its rider and ignores the link's
own cost (the one-cast floor, owner ruling 2026-08-28, binds for all sixteen
carriers). So link cost is a balancing lever the formula cannot see, in both
directions: Unanswered Signal reads +1.74, outside the fair band, with its
four-mana link unpriced, and Burning Mask of the Void reads -1.83 with a
three-mana link. Neither measured as a problem in play. If a later set leans
on Hauntlink, the floor wants a second look with this table in hand.

**Chrome Broodmother's tuning pass, 2026-09-19.** The 60 reproduced exactly
first. The cause was structural, and it is the same lesson the combat-model
work taught elsewhere: she fielded no Skyborne and no Warding Gaze, so she
could not block a flier at all, and Crimson Muster fields twelve. While her
opponents misplayed combat that hole cost little; once they stopped, it cost
eight points. One lever closed it: two Burning Hull Runner and two Comet-Kick
Marauder became four Ashwood Ranger (3/3 Warding Gaze that Marks itself, so
it blocks fliers and is a Marked body for her Brawlers and Propagate). The
committed list reads 72 (63/82/64/70/84, 0 draws), Muster 42 to 63, and her
floor ratchets 0.585 to 0.655; CI's 40 seeds read 70.5 the same day. A second
lever (two Lance of Two Suns to two more Red-Solar Lash) read 77.5 on the
five starters and was NOT taken: on the independent 14-deck reserve matrix
the three lists read 61.2, 74.8 and 75.6, so its gain was fitting the starter
columns. **Confirm a tune on the wide matrix before stacking a second
lever.** Two Duty artifacts from the land-economy slate were measured in her
list and rejected: four Festival Rocket read 56.8 and two Overcanopy Trellis
59.8, so in AI hands the repeatable two-damage Duty is too slow and the
repeatable Mark source is not an engine on its own. Both were measured
before 1.8.1 let Medium and Hard spend a paid Duty before combat (Duty
timing), when a Rocket could only fire after the attack.

The Starborne pair (Chrome Broodmother 23, The Violet Signal Queen 24; floors
0.655 and 0.645) and the Drowned Deep pair (The Drowned Deacon 25, The
Marsh-Mother 26, the final rung; floors 0.595 and 0.685) each carry their
own gate with the termination check.
Measured untuned 2026-09-15 at 200 seeds: Deacon 33% (35.5% after phase A,
35.9% after B), Marsh-Mother 77% (77.9% after A, 74.8% after B: the Tithe
fodder rule costs her, see the next section). The Deacon's plan is fog, tap and cheap counter
Charms on a schedule; phase A taught the ladder those shapes and moved her
only a little, so her deck got a measured tuning pass on 2026-09-16: three
authored reserve surgeries (bodies for the Bells, Thing in the Cistern for
two Cold Currents, Mother Hydra and a third Hierophant for her top) took her
from 35.9 to 66.4 at 200 seeds with every cell up, and her 40-seed gate from
40.0 to 63.5. The full record, every single and combination with its cells,
is the comment above her reserve list in `src/data/opponents.ts`. The
Marsh-Mother got the same pass the same day and kept her list: four authored
reserve surgeries (the Mark spells out for Horrors, a bigger top, early
pressure, drain bodies) all measured below her frozen 74.8, the Mark cut
worst at 67.3, so the Reef Blooms are doing work on her board and the
rejections are recorded beside her list.

## What the AI provably does, and the known gaps (2026-09-15)

[plan-ai-modernization.md](plan-ai-modernization.md) is the audit: legally
every card plays; as intended, not yet. Two test files are the scoreboard:

- `tests/ai/rungSmokes.test.ts` plays every gauntlet rung in both reserve
  formats (Warchest and Darlings) with its own brain and personality, and
  every Darlings precon, one seed each, under one 900 s file budget. No
  crashes, no illegal actions, every game to `gameOver`.
- `tests/ai/documentedBehaviour.test.ts` pins one test per claim in this
  document. Thirty-seven pass (phase A flipped five and phase B three on
  2026-09-15, phase C three on 2026-09-16); three are marked `it.fails` and
  name the phase that owns them (D draft 3). A phase lands by flipping its own tests to `it`; a
  fixture or legality error inside an expected failure fails the file, so the
  marker can never hide a broken brain. Phase A's own rules are pinned in
  `tests/ai/castLadder.test.ts`, `castLadderReview.test.ts` and
  `hardTiming.test.ts`.

Phase D (2026-09-17) closed the last gap, the draft picker, and every one of
the forty documented behaviours now passes (1.8.1 added thirteen more, the
Duty timing entries: Medium's pre-combat tap and its attack, the Duty left
for main two when the attack needs no help, the better spell keeping the
mana, the lethal Duty outranking it and outranking removal, a lethal Duty
on its lower-value target, a lethal Duty with an empty hand ahead of
Preserve and a Hauntlink link, a ping and a kill that change nothing in the
fight left for main two, Hard's kept and declined taps and the cast a
declined tap frees, and Easy's unchanged timing; fifty-three pass). Its measurement is the second
lesson of the plan: a scorer that knows the mechanics does not draft
stronger decks in Medium's hands. Seat-one decks drafted by the new scorer
against decks drafted by the old one from the same seeds, Medium on both
sides, 1,500 games per set: with the weights as first built (mechanic 2,
buff 1) the new decks won 47.7 percent on base and 45.4 on Yokai Nights;
with both weights at zero and only the classifier fixes kept, 49.8 and 52.9;
with the shipped mechanic 1 and buff 0, 49.2 and 52.1, and 48.2 on Drowned Deep. The
classifier fixes are neutral to positive; stacked weights that promote
riders over bodies are a cost, so the shipped defaults keep the mechanics
visible without paying for them. The same measurement found the trigger
loop that #381 closed. Phase C (2026-09-16) closed the combat gap
with the shared exchange model above, and its measurement is the lesson of
the phase: modelling twinBlades on both seats moved the two twinBlades-heavy
avatars down, not up (Bastet 69 to 62.4 at 1,000 games, Brunhild 75 to
69.7), because their opponents had been blocking a 2/1 double-striker with
a 2/2 that died without striking. Reverting only the defender's incoming
damage term recovered 6.5 of Bastet's 6.6 points; her own attack math
recovered nothing. So the model stayed and Bastet's reserve deck, an untuned
converter cut of sixteen x/1 bodies and no removal, got the measured tuning
pass instead: burn for the four Claw-Prow Signalers and Kesi for two of the
four Bakhets took her 62.4 to 73.6 with every cell up, and her 40-seed gate
reads 75.0 against the 68.5 floor, which was not moved. Brunhild, the other
heavy twinBlades carrier (rung 10, no floor), had fallen 75 to 70 the same
way and got the same shape of pass on 2026-09-17: burn for her four Ember
Valkyries took her to 79 with every cell up; the three other authored
surgeries and the pair are recorded beside her list. Phase B closed the mechanic gaps (Tithe fodder,
Hauntlink fit, moves and windows, Duty ordering and mana holding, Empower
cost) with the gates unchanged and rungs 15, 16, 18 and 20 up one to two
points; Kitsune, the Hauntlink spine, moved 82.9 to 84.5. The Tithe boss
(the Marsh-Mother) measured 77.9 to 74.8 after the fodder rule, so the fodder
rate was the first knob the tuning pass looked at (2026-09-16): rates 0.5
and 1.0 and an unlock-only rule all read 75.4 on her and moved nothing else,
inside the band, so the rule stands as ruled and the movement came from the
decks instead. That pass also caught a 1.8-only legality bug: Medium's
respond step rewrote the first counter's stack target to the top spell
without checking a `maxCost` target spec (Still Harbour, cost 2 or less),
and an illegal cast from the AI hard-locks the duel. The rewrite is now
returned only when the legal menu carries the same card and target list;
otherwise the brain falls through. Regression in `tests/ai/aiFixes.test.ts`.
Phase A closed the cast-ladder gap (spell bodies, wraths, lethal, the five
Charm rules, Hard's pass and hold, Quest-gated pricing) with the two brain
gates unchanged at 83.0 and 78.5 and every rung above its floor; rungs 17 and
18 measure a few points lower because the neutral Medium proxy they face
improved too. The untuned Deacon moved 33 to 35.5 and Lanterns Below 18.9 to
20.1, so those two decks got a tuning pass of their own on 2026-09-16
(Lanterns Below 14.6 to 31.3 on its reserve-native row, the Deacon 35.9 to
66.4; the surgery records sit beside each list). Everything the tests
do prove is listed beside the claim it proves, in the file.

## Tower strength tiers (the decision-noise dial)

The Tower decouples AI strength from the avatar (1.3 Pillar 1): the FLOOR
sets the brain, the avatar brings its deck and personality. `src/ai/tiers.ts`
defines six tiers as (brain, noise) pairs, where `NoisyAI`
(`src/ai/NoisyAI.ts`) is a seeded decorator that with probability `noise`
replaces the inner brain's action with a uniformly random legal action
(never concede; the inner brain always advances first so its rng stream is
unaffected). The measured ladder (2026-07-20, 80 seeds/cell, starter
mirrors vs a neutral Medium proxy — `npx tsx scripts/balance-matrix.ts
--tiers --seeds 80`) is date-stamped in `tiers.ts`; T4 medium/0 and T6
hard/0 are byte-identical to the plain Medium/Hard brains. The dial is
TOWER-ONLY: Practice, prefabs, Limited, and replay playback stay on
`buildAI`. Measurement note: use 80 seeds for tier gates — a 4pp adjacent
boundary flip-flops inside 40-seed sampling noise.

## Draft personas (Limited Bot Draft)

The Bot Draft's seven bot seats are **draft personas** (shipped 2026-07-14) —
20 grounded drafters in `src/data/draftPersonas.ts` (Tiffany the Rare-Chaser,
Kevin the Wall Architect, Cody the Chaos Drafter, …), each a pure-data pairing
of:

- a **`PickerProfile`** (`src/meta/draftPicker.ts`) — tunable knobs over one
  parameterized pick scorer (`scorePick`/`scoreBasePick`): rarity/color-loyalty/
  curve/removal/keyword/subtype/legend weights, forced colors, big-stuff and
  bargain biases, and a `chaos` dial whose noise is a **pure hash** of
  `(draft seed, seat, pack, pick, cardId)` — no RNG state, fully deterministic.
  Since phase D (2026-09-17) the base scorer reads the whole card: Empower,
  Preserve, Duty, Quest chapter and Hauntlink text feed the same removal,
  card-advantage, token, life-gain and graveyard classifiers as plain
  ability text; every mechanic (Empower, Retell, Whispers, Tithe, Skim at
  half, Preserve, Duty, Quest, Hauntlink, Nine Lives; not Rite, not
  Awakening) earns `mechanicWeight` once; Mark and boost effects earn
  `buffWeight`; Bulwark and Rage are restrictions and earn no generic
  keyword bonus (a persona's `keywordPrefs` still counts them); a
  self-damage rider is not removal. The shipped defaults are
  `mechanicWeight` 1 and `buffWeight` 0 by owner ruling after measurement
  (see the proof section). `DEFAULT_PICKER` is therefore no longer the
  pre-persona heuristic bit-for-bit: the lockstep specs in
  `tests/meta/limited.test.ts` were re-baselined deliberately against an
  independent reference of the phase-D arithmetic (525 of 1,482 collectible
  base scores moved; 3,783 of 6,300 picks across the 20 pinned drafts),
  and they still guard the shared limited auto-build path. Chris stays
  exactly lockstep with the default; Cody stays chaotic; Tiffany still
  takes the rarest card; every persona differentiation row isolates its
  own knob.
- a **`Personality`** spread — the persona you drafted against pilots your
  post-draft matches: `limitedDuelData` carries the seat's persona id, and
  DuelScene skins its name/portrait onto the duel and passes its Personality
  into `buildAI` (deck comes from the seat's actual drafted pool; difficulty
  stays the match ladder easy→medium→hard).

Seat assignment is a seeded shuffle (`assignDraftPersonas`) stored in
`DraftState.personaIds` (SaveData v16), so a run's table is reproducible from
its seed. Persona identities are **familiarity-gated** (SaveData v17):
`limited.personaSeen` counts completed drafts per seated persona, and
`personaRevealTier` unlocks the identity card in four steps — name+portrait,
color habits (`DraftPersona.colorHint`), theme (title), full profile — so
players learn the table by drafting against it rather than reading it. Roster edits are guarded: unknown persona ids fall back to
`DEFAULT_PICKER`, and the roster must never shrink below 7 unique ids (the
save-migration path would otherwise throw and reset saves — tests pin the
floor). Personas are draft-table opponents, not gauntlet avatars: they carry no
decks and no balance bands of their own, and pick *style* is deliberately not
pick *strength* — the Rare-Chaser drafts worse decks than the Curve
Perfectionist by design.
