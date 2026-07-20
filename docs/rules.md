<!-- source-of-truth: src/config/rules.ts, src/engine/Game.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/combat/legality.ts, src/engine/sba.ts, src/engine/statics.ts, src/engine/actions.ts, src/engine/resolve.ts, src/engine/effects/targeting.ts · last-verified: 2026-07-17
     If you change those files, update this doc or re-verify the date. -->

# Rules — the digital ruleset as implemented

This is not "how Magic works." It is **how Darling Blades works**, as the engine
actually plays it. Where it diverges from Magic, the differences are called out
explicitly in the appendix. All the numbers below come from `RULES` in
`src/config/rules.ts`; they are inlined here for the reader and mirrored inside
`<!-- BEGIN GENERATED -->` markers so a future generator can re-sync them.

## Setup

<!-- BEGIN GENERATED: RULES constants (mirror of src/config/rules.ts · run: npm run gen-docs-tables) -->

| Rule                      | Value     | Constant                         |
| ------------------------- | --------- | -------------------------------- |
| Starting life             | 20        | `RULES.startingLife`             |
| Deck size                 | 60        | `RULES.deckSize`                 |
| Max copies (non-basic)    | 4         | `RULES.maxCopies`                |
| Basics                    | unlimited | (basics exempt from `maxCopies`) |
| Opening hand size         | 7         | `RULES.startingHandSize`         |
| Max hand size (cleanup)   | 7         | `RULES.maxHandSize`              |
| Creature battlefield cap  | 8         | `RULES.maxCreatures`             |
| Noncreature-nonland cap   | 4         | `RULES.maxNoncreaturePermanents` |
| Max blockers per attacker | 3         | `RULES.maxBlockersPerAttacker`   |
| Turn limit (draw)         | 100       | `RULES.turnLimit`                |
| Max mulligans per player  | 3         | `RULES.maxMulligans`             |

<!-- END GENERATED -->

Each player starts at **20 life** and shuffles a **60-card** deck (≤4 copies of
any non-basic; basics unlimited — enforced by `validateDeck` in
`src/meta/DeckStorage.ts`).

A seeded coin flip runs at construction. In normal duels, the player calls
**Heads** or **Tails** before the result is revealed. The flip winner chooses to
play first or draw first; only after that choice resolves does each player draw
a **7-card** opening hand and begin the mulligan process. The chosen starting
player is emitted as `firstPlayerChosen` and **skips their turn-1 draw**
(`startTurn` in `src/engine/phases.ts`). The scripted tutorial leaves the
engine's optional `playDrawChoice` flag off, so its fixed opening hand is still
dealt during construction. Headless callers also default to that legacy direct
starting-player roll unless they opt in, preserving existing seeded simulations
and tests.

## Mulligans

The mulligan is **London-style with the first mulligan free**, sequenced by
`Game.apply` / `nextMulliganOrStart` (`src/engine/Game.ts`):

- The **starting player decides first**; when they have kept, the other player
  decides.
- A `mulligan` action shuffles the hand back, redraws a full 7, and increments
  that player's mulligan count. You may keep on any decision.
- You may mulligan at most **`RULES.maxMulligans` (3)** times; at the cap the
  `mulligan` action is no longer legal, so you must **keep or concede**. This
  bounds the bottom count below and is what prevents the old unsatisfiable-pick
  soft-lock (`legalActions`, `src/engine/actions.ts`).
- On `keepHand`, you bottom **`mulligans − 1`** cards (clamped to 0 and to the
  hand size). So the first mulligan costs nothing; the second bottoms one card;
  the third bottoms two. The engine then awaits a `bottomCards` decision if that
  count is > 0.

Once both players have kept (and finished bottoming), turn 1 begins with the
starting player active.

## Turn structure

`startTurn` runs untap → dawn → draw, then hands control to main 1. The player
drives the rest via `passStep` and combat actions.

| Step        | What happens                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **Untap**   | The active player's permanents untap; summoning sickness wears off; the land-drop flag resets.     |
| **Dawn**    | The active player's `dawn` triggers fire and resolve immediately. **No response window.**           |
| **Draw**    | The active player draws one — **except the starting player on turn 1**, who skips it.               |
| **Main 1**  | Active player's main phase: play a land, cast anything, or `passStep` to combat.                    |
| **Combat**  | Declare attackers → (window) → declare blockers → (window) → damage. See below.                     |
| **Main 2**  | A second main phase.                                                                                |
| **End**     | The **non-active** player gets **one** response window (`endStepWindow`). Passing it → cleanup.     |
| **Cleanup** | Discard to max hand size (7); marked damage and until-end-of-turn effects clear; the turn flips.    |

Notes grounded in `phases.ts`:

- Dawn triggers resolve with **no priority window** — they just happen (v1
  triggers never target, so there is no decision to make).
- The **draw skip** is exactly `state.turn === 1 && active === startingPlayer`.
- At **cleanup**, if the active player is over 7 cards, the engine awaits
  `discardToHandSize`; after discarding, `finishCleanup` zeroes every
  permanent's `damage`, clears `deathtouched`, drops `untilEotMods`, clears
  `combat`/`fogThisTurn`, and advances the turn (or ends the game at the turn
  limit — see Endings).

## The stack: episodes and windows

Darling Blades uses a simplified, Arena-flavored stack. Casting a spell opens **one**
response window for the opponent; the whole thing resolves in one flush.

Walking through `castSpell` → `openResponseWindow` → `closeAndFlush` →
`resumeAfterFlush` in `src/engine/Game.ts`:

1. **Cast.** The spell is put on the stack (`spellCast`) and `openResponseWindow`
   offers the **opponent** a window over it.
2. **Auto-pass.** If the opponent has no castable Charm *right now*
   (`hasCastableInstant` in `src/engine/actions.ts` — payable **and**
   targetable), the window is skipped and the stack flushes immediately. This
   saves clicks and AI calls.
3. **Responding re-opens LIFO.** If the opponent *does* cast into the window,
   that new spell opens **one** window back to the original caster (last-in
   first-out). Each cast can open exactly one window over itself.
4. **The first pass closes the episode.** As soon as *anyone* passes a window
   (`passResponse`), `closeAndFlush` sets `stackClosed` and **resolves the entire
   stack top-down with no further windows**. There is no priority ping-pong after
   the first pass.
5. **Resume.** After the flush, `resumeAfterFlush` decides where play continues
   from `state.step` (+ combat sub-state): back to `main`, into cleanup at the
   end step, to `declareBlockers` if attackers are on the stack-resolved combat,
   or on to combat damage.

The end-step window is handled slightly separately: passing it calls
`enterCleanup` rather than flushing a stack.

## Combat

Combat is declared and resolved through `Game.apply` (declaration),
`src/engine/combat/legality.ts` (what's legal), and
`src/engine/combat/damage.ts` (damage math).

### Declaring attackers

- **`declareAttackers` with `[]` skips combat entirely** — no windows, straight
  to main 2.
- A creature can attack if it's an untapped, non-summoning-sick creature you
  control without `bulwark` (`canAttack`).
- Attacking **taps** the creature — unless it has **sentinel**, which lets it
  attack untapped.
- Each declared attacker fires its `attacks` triggers immediately.
- Then the **defender gets a response window** over the attackers.

### Declaring blockers

- After the attacker window resolves, the defender assigns blocks
  (`declareBlockers`).
- **Skyborne** attackers can only be blocked by creatures with **skyborne or
  wardingGaze** (`canBlock`). Summoning sickness does **not** restrict blocking.
- **At most 3 blockers per attacker** (`RULES.maxBlockersPerAttacker`).
- Then the **attacker gets a response window** over the blocks.

### Combat dissolves mid-window

If a response resolves during a combat window and every attacker has left the
battlefield, combat has no attackers to resolve. `resumeAfterFlush` detects the
now-null combat and cleanly falls through to main 2 (see the `combat` case in
`resumeAfterFlush`).

### Damage

`resolveCombatDamage` computes damage against the pre-damage board and applies it
all at once (modern simultaneous damage):

- **First strike sub-step.** If *any* combatant has firstBlade **or twinBlades**,
  a first-strike damage pass happens first, SBAs are checked, then the normal pass
  runs. A firstBlade creature deals damage only in the first-strike step; a
  **twinBlades creature deals in both** the first-strike and normal steps
  (firstBlade + twinBlades is two hits, not three).
- **Unblocked attackers** hit the defending player for their attack.
- **Blocked attackers** use **automatic damage assignment**: blockers are ordered
  **cheapest-to-kill first**, and lethal is assigned to each before any spills
  over.
  - **Deathblade** makes **1 damage lethal** (`killCost` returns 1).
  - **Overrun** lets excess over each blocker's lethal spill to the player.
    Without overrun, the leftover is simply wasted on the last blocker.
- **Blockers strike back** at the attacker they blocked.
- **Blood Oath** heals the source's controller for the damage dealt.
- **Fog:** if a fog effect is active (`combat.damagePrevented` or
  `state.fogThisTurn`), `resolveCombatDamage` returns immediately — **all combat
  damage is prevented** this turn.
- After all damage lands, `combatDamageToPlayer` triggers fire for sources that
  hit a player.

## Keywords

All twelve keywords and their exact implemented semantics (`Keyword` in
`src/engine/types.ts`; effects across `statics.ts`, `combat/legality.ts`,
`combat/damage.ts`, `effects/targeting.ts`):

| Keyword (engine id · shown as) | Implemented behavior                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| **skyborne** · Skyborne | Can only be blocked by creatures with skyborne or wardingGaze (`canBlock`). |
| **wardingGaze** · Warding Gaze | Can block skyborne creatures (no other effect).                        |
| **firstBlade** · First Blade | Deals its combat damage in the first-strike sub-step; if it kills first, it takes no damage back. |
| **twinBlades** · Twin Blades | Deals combat damage in **both** the first-strike sub-step and the normal sub-step. firstBlade + twinBlades is two hits (not three); doubled deathblade is lethal in each hit; doubled overrun re-spills each step (a chump killed in the first-strike step lets the full attack spill in the normal step); doubled bloodoath gains on both. |
| **warcry** · Warcry | Ignores summoning sickness — can attack / tap for mana the turn it enters (`isSummoningSick`). |
| **overrun** · Overrun | Assigns lethal to blockers, then spills the excess to the defending player. |
| **sentinel** · Sentinel | Attacking does not tap it.                                                     |
| **bulwark** · Bulwark | Cannot attack (`canAttack` returns false).                                       |
| **deathblade** · Deathblade | Any amount of its combat damage is lethal (1 counts). Sets `deathtouched`, which SBAs check. |
| **bloodoath** · Blood Oath | Its controller gains life equal to damage it deals (combat and, where relevant, spell damage paths that flag it). |
| **untouchable** · Untouchable | **Blocks only the OPPONENT'S targeting.** Your own untouchable creature can still be targeted by *your* spells (`creatureTargetable` only rejects when `perm.controller !== caster`). |
| **dreaded** · Dreaded | Can be blocked only by two or more creatures. The minimum lives in `minimumBlockersForAttacker` (`combat/legality.ts`); `validateBlocks` enforces it on the final assignment, while `blockOptions` stays permissive so partial assignments can be built incrementally. |

Keyword rules text is generated (`KEYWORD_NAMES` in `src/ui/rulesText.ts`) — see
[docs/adding-cards.md](adding-cards.md). For the full Magic-evergreen → Darling
Blades mapping (these 12 plus not-yet-implemented candidates like
Indestructible, and the Fight/Sacrifice actions), see
[docs/keyword-map.md](keyword-map.md).

### Empower (optional cast cost)

A card with an `empower` block (`CardDef.empower`, 1.3) may be cast for its
normal cost, or for the combined cost (`combineManaCosts`) with the empowered
flag set on the cast action. On resolution the empower ops run after the
card's normal effect (for permanents, after its arrival triggers); empower ops
are trigger-safe and never target. X spells cannot be empowered
(`validateAction` rejects the combination).

## Board caps

Two per-player caps are enforced at **cast legality** (`castBlockers` in
`src/engine/actions.ts`):

- **8 creatures** (`RULES.maxCreatures`). A creature spell is not castable while
  you already control 8 creatures.
- **4 noncreature, nonland permanents** (`RULES.maxNoncreaturePermanents`) —
  counts enchantments and artifacts, but **auras are exempt** (they attach to a
  creature and don't occupy a board slot).

Token creation also respects the creature cap: `createToken` in
`src/engine/effects/EffectInterpreter.ts` re-checks `RULES.maxCreatures` before
each token and simply **stops** once the cap is hit (excess tokens are not
created). Verify in the `createToken` case of `EffectInterpreter.ts`.

## State-based actions (SBAs)

`checkStateBased` (`src/engine/sba.ts`) runs after every mutation batch and
between combat-damage sub-steps. It **loops until stable** (up to 30 passes,
throwing if it never stabilizes — a death can orphan an aura, fire a dies trigger
that drains life, or change lord math, so one pass is not enough). Each pass, in
order:

1. **Life ≤ 0 loses.** If both players are ≤ 0, the game is a **draw** (reason
   `life`); if one is, the other wins.
2. **Creatures die** if `defense ≤ 0`, or marked `damage ≥ defense`, or they
   took **deathblade** damage with any damage marked (`deathtouched && damage > 0`).
   Deaths within a pass are **batched**: every condemned creature leaves the
   battlefield first, *then* their `dies` triggers fire in battlefield order —
   so simultaneous deaths free their board slots before any dies-trigger
   `createToken` checks the creature cap.
3. **Orphaned auras die.** An aura whose `attachedTo` permanent is gone is put
   into the graveyard.
4. **The legend rule.** Among same-name legendaries **you** control, the **oldest
   survives** (battlefield order is entry order; duplicates are destroyed). The
   legend rule **is implemented** — it is a simple per-controller, per-name form,
   keyed on `${controller}:${name}`.

(Effective defense/attack for these checks is always computed on read by
`getEffectiveStats` in `src/engine/statics.ts` — base stats + `+1/+1` counters +
until-EOT mods + static layers; nothing is cached.)

## Endings

A game ends (`endGame` in `src/engine/phases.ts`, emitting `gameEnded`) for one
of four reasons:

| `winReason`  | Trigger                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| `life`       | A player hits 0 or less life (both at once → draw).                       |
| `deck`       | A player must draw from an empty deck (`drawCards` — the opponent wins).   |
| `concede`    | A player submits `concede` (the opponent wins).                           |
| `turnLimit`  | Turn 100 is reached at cleanup → **draw** (anti-stall, `RULES.turnLimit`). |

Once ended, `awaiting` becomes `{ kind: 'gameOver' }` and no further actions are
legal.

## Appendix: differences from Magic

An honest list of where the digital ruleset simplifies or departs from paper
Magic:

| Area              | Darling Blades                                                                                 | Magic (for reference)                                   |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Priority / stack  | One response window per cast; the first pass flushes the whole stack with no more windows.     | Full priority passing after every object resolves.      |
| Dawn triggers     | Resolve immediately, no window.                                                                | Go on the stack, players get priority.                  |
| End-step window   | Exactly one window, for the non-active player only.                                            | Priority in the end step for both players.              |
| Triggers          | **Never target** (v1 law); auto-resolve with no decision point.                                | Triggers may target and use the stack.                  |
| Targeted effects  | **Single-target only** (`targets[0]`).                                                          | Arbitrary target counts.                                |
| Twin Blades (double strike) | Implemented (Ragnarök) — deals in both the first-strike and normal damage steps.        | Exists.                                                 |
| Colors of mana    | Generic paid by an auto-tap solver; no mana pool, no floating mana.                             | Mana pool with manual tapping.                          |
| Summoning-sick mana creatures | Cannot tap for mana the turn they enter (ramp is delayed one turn).                   | Depends on the ability (many can if it's not `{T}`).    |
| Board caps        | 8 creatures / 4 noncreature-nonland permanents per player, enforced at cast time.              | No such caps.                                           |
| Legend rule       | Per-controller, per-**name**; oldest survives.                                                 | Per-controller, per-name; you choose which to keep.     |
| Turn limit        | Turn 100 → draw.                                                                               | No turn limit (loops handled differently).              |
| Deck-out          | Losing player is the one who *must* draw from empty.                                            | Same, but on the *next* draw attempt with SBA timing.   |
| Bounce            | Returns to hand and emits `died`/`cardsBottomed(0)` (no dedicated event; UI resyncs from state).| A distinct zone change.                                 |
