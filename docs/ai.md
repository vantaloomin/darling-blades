<!-- source-of-truth: src/ai/AIPlayer.ts, src/ai/EasyAI.ts, src/ai/MediumAI.ts, src/ai/HardAI.ts, src/ai/determinize.ts, src/ai/evaluate.ts, src/ai/value.ts, src/ai/combatPlans.ts, src/ai/personality.ts, src/data/opponents.ts, scripts/balance-matrix.ts, tests/ai/winrate.test.ts · last-verified: 2026-07-07
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
  mulligans.
- **Main:** 20% of the time picks a random non-concede action; otherwise plays a
  land, else casts the biggest affordable spell, else passes.
- **Attack:** all-in when its untapped-creature count meets or beats the
  opponent's untapped blockers, otherwise attacks with nothing — the signature
  Easy weakness.
- **Block:** one blocker per attacker, prefers blocks that kill or survive,
  chump-blocks only when at life ≤ 5.
- **Respond:** passes 85% of windows; otherwise a random Charm.

Easy has its own seeded RNG (`createRngState`) so its randomness is reproducible.

## Medium

`src/ai/MediumAI.ts` is rule-based priorities with **one-step trade math** and no
lookahead. From its header: "Plays a fair game of attrition — lethal checks,
profitable trades, removal on the biggest threat, trick-risk respect — but no
lookahead." Its rules:

- **Mulligan bands** are tighter than Easy's: on a fresh hand keep with 2–5
  lands; after a mulligan keep with 1–5; hard-keep at 2 mulligans.
- **Main phase priority order** (`main`):
  1. **Lethal burn to the face** — if a face-damage spell deals ≥ the opponent's
     life, cast it.
  2. **Removal on the opponent's best creature** — only when it actually kills
     the target (`removalKills`) and the target is worth it (value ≥ 0.8× the
     spell's cost and ≥ 2.5).
  3. **Burn as reach** — once the opponent is at ≤ 8 life, throw burn at the
     face.
  4. **Develop** — cast the highest-value creature/permanent; holds instants for
     windows; plays buff auras on its own creatures and debuff auras on enemies.
- **Combat** is delegated to the shared planners (`chooseAttackers`,
  `chooseBlocks` in `combatPlans.ts`).
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
  the opponent's end step.

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

- **Main phase:** trusts Medium's casting policy outright (`searchMain` just
  calls Medium).
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
  blocker — and the engine plays each assignment through combat damage. Up to
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
- **Terminal states dominate** — win `+1e6`, loss `−1e6`, draw `−500`.

`permValue`/`cardValue` (`value.ts`) score a card by mana value + (P+T)/2 +
keyword bonuses + a lord/legendary and triggered-ability premium.

## Win-rate gates

`tests/ai/winrate.test.ts` plays hundreds of seeded AI-vs-AI games with sides
alternated (so neither AI owns the better deck) and asserts:

| Matchup            | Gate                 | Current (2026-07-02)    |
| ------------------ | -------------------- | ----------------------- |
| Medium vs Easy     | **≥ 80%**            | ~**82.5%** (passing)    |
| Hard vs Medium     | CI floor **≥ 0.70**  | ~**78.0%**              |

The original plan gate for Hard was **60% — met and exceeded**. The honest
history: **53%** (full-turn attack lookahead + terminal-outcome detection only)
→ **62.5%** (block hill-climb + response search) → **77.5%** (the `simDb` fix
for Hard's internal Medium brains — the raw-db brains had been silently
collapsing lookahead worlds to `-Infinity`) → **78.0%** (evidence-gating the
trick model in `MediumAI.trickBuff` / `HardAI.openManaBuff` — see the Medium
section). Richer hidden-card opponent models were measured and all lost win
rate — see the Determinize section above. The floor ships at **0.70** to leave
CI-variance margin (±3.5pp at 200 games) under the measured ~0.78.

Despite the search doing more work, the whole suite is fast: the win-rate
gates (including 200 Hard-vs-Medium games) finish in roughly **20 seconds** —
the search rework also made Hard cheap to run.

## Tuning surface

If you want to move the numbers, these are the levers:

| File                   | What it controls                                                             |
| ---------------------- | ---------------------------------------------------------------------------- |
| `src/ai/value.ts`      | Per-card and per-permanent worth (keyword bonuses, lord/trigger premiums).    |
| `src/ai/evaluate.ts`   | Position scoring — life curve, material discounts, card/mana/clock weights.   |
| `src/ai/combatPlans.ts`| Shared attack/block heuristics (damage weights, trick-risk, double-blocks, holdback). |

`determinize.ts` is the opponent-modeling knob: the deck-shape priors
(`LAND_FRACTION`, `INTERACTION_FRACTION`, `CURVE_WEIGHTS`) and the
`SIM_SEEDS` world count in `HardAI.ts`. Before reaching for it, read the
measured negative results in the `determinize.ts` header — the shipped
inert priors beat every richer model tried so far, and any new model should
be judged on the same 200-game gate.

## The Avatar personality system

An **avatar/personality system** (shipped 2026-07-02) layers tunable knobs over these
three brains — themed opponents with their own aggression/greed dials, without
rewriting the cores. The knobs live in `src/ai/personality.ts` (frozen `DEFAULT_PERSONALITY` reproduces the base brains bit-for-bit — enforced by lockstep tests in `tests/ai/personality.test.ts`); the 10 avatars with decks and tunings live in `src/data/opponents.ts` (the base
8 plus the two Ragnarök gauntlet bosses, Hel and Brünhild).

Balance is measured, not guessed: `scripts/balance-matrix.ts`
(`npm run balance-matrix`) runs deterministic avatar-vs-starter, starter-mirror,
and difficulty round-robin matrices, and the dated baseline (all guidance bands
green as of 2026-07-02) lives in a comment block in `src/data/opponents.ts` —
re-measure and refresh it after any change to decks, personalities, starters,
or brains.
