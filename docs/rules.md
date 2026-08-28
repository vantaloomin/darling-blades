<!-- source-of-truth: src/config/rules.ts, src/engine/Game.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/combat/legality.ts, src/engine/sba.ts, src/engine/statics.ts, src/engine/actions.ts, src/engine/resolve.ts, src/engine/effects/targeting.ts · last-verified: 2026-08-17
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
| Max blockers per attacker | 4         | `RULES.maxBlockersPerAttacker`   |
| Turn limit (draw)         | 100       | `RULES.turnLimit`                |
| Max mulligans per player  | 3         | `RULES.maxMulligans`             |
| Max window reopens/step   | 8         | `RULES.maxWindowReopensPerStep`  |

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

## Warchest and Darlings formats

Warchest decks have **40 nonland cards** and a Warchest of 10 lands, with up
to 5 dual lands; reserve colors are unrestricted. Warchest games deal a
**5-card opening hand** (`WARCHEST_HAND_SIZE` in `src/meta/warchest.ts`;
classic keeps 7). Both numbers were ratified 2026-08-07 from the
format-parameter measurement recorded in [plan-1.6.md](plan-1.6.md).

Warchest Reserves are the lands not yet in play. Once deployed,
they are your Active Warchest. Each turn, move one land from your Warchest
Reserves into your Active Warchest. Dual lands arrive tapped. Destroyed dual
lands are gone; destroyed basic lands return to your Reserves.

Darlings follows the same Warchest land rules. Choose your Darling. Build a
79-card deck in her colors, one copy of each card, and a Warchest of 10 lands.
Your Darling waits in her own zone, ready when you call; each time she falls,
her next call costs 2 more. Darlings also deals the **5-card opening hand**
(ratified 2026-08-08 from its own 5-vs-7 measurement).

## Mulligans

The mulligan is **London-style with the first mulligan free**, sequenced by
`Game.apply` / `nextMulliganOrStart` (`src/engine/Game.ts`):

- The **starting player decides first**; when they have kept, the other player
  decides.
- A `mulligan` action shuffles the hand back, redraws a full hand at the
  format's opening-hand size (7 in classic, 5 in the reserve formats), and
  increments that player's mulligan count. You may keep on any decision.
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
| **End**     | The **non-active** player gets the first response window, plus earned post-flush reopens in rules revisions 2-3. Revision 1 gets exactly one. |
| **Cleanup** | Discard to max hand size (7); marked damage and until-end-of-turn effects clear; the turn flips.    |

Notes grounded in `phases.ts`:

- Dawn triggers resolve with **no priority window** — they just happen. Arrival
  triggers can defer a mandatory target choice; dawn triggers remain target-free.
- The **draw skip** is exactly `state.turn === 1 && active === startingPlayer`.
- At **cleanup**, if the active player is over 7 cards, the engine awaits
  `discardToHandSize`; after discarding, `finishCleanup` zeroes every
  permanent's `damage`, clears `deathtouched`, drops `untilEotMods`, clears
  `combat`/`fogThisTurn`, and advances the turn (or ends the game at the turn
  limit — see Endings).

## The stack: episodes and windows

Darling Blades uses a simplified, Arena-flavored stack. Casting a spell opens
one response window for the opponent, and the first pass still resolves the
whole stack in one uninterrupted flush. Current games use **rules revision 3**;
an absent `GameState.rulesRev` means revision 1 for legacy states and v6 replays.
Version 7 replays select revision 2, while version 8 selects revision 3.

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
4. **The first pass closes the stack episode.** As soon as *anyone* passes a window
   (`passResponse`), `closeAndFlush` sets `stackClosed` and **resolves the entire
   stack top-down with no further windows**. There is no priority ping-pong after
   the first pass.
5. **Revision-2 reopen.** After the flush, combat and the end step may offer the
   non-active player another window before advancing. The flush must have
   resolved at least one stack item since the last offer, the player must hold a
   payable and targetable Charm (including a payable Retell Charm), and the step
   must remain below `RULES.maxWindowReopensPerStep` (8). Skim alone never earns
   a reopen because its constant hand size is loop fuel. The reopen event carries
   `reopened: true`; first-window events retain their old shape.
6. **Resume.** Passing a reopened empty window advances immediately. Otherwise,
   `resumeAfterFlush` continues from `state.step` and combat sub-state: back to
   `main`, into cleanup, to `declareBlockers`, or to combat damage. A step change
   resets the reopen cap. Deferred Foresee choices keep the resolved-item credit
   until the choice drains, so they return to the correct still-open window.

Revision 1 preserves the classic behavior verbatim: no post-flush reopen in
combat or at end. The end-step window is handled slightly separately in both
revisions: passing it calls `enterCleanup` rather than flushing an empty stack.

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

Keyword rules text is generated (`KEYWORD_NAMES` in `src/data/glossary.ts`) — see
[docs/adding-cards.md](adding-cards.md). For the full Magic-evergreen → Darling
Blades mapping (these 12 plus not-yet-implemented candidates like
Indestructible, and the Fight/Sacrifice actions), see
[docs/keyword-map.md](keyword-map.md).

### Empower (optional cast cost)

A card with an `empower` block (`CardDef.empower`, 1.3) may be cast for its
normal cost, or for the combined cost (`combineManaCosts`) with the empowered
flag set on the cast action. On resolution the empower ops run after the
card's normal effect (for permanents, after its arrival triggers); empower ops
are trigger-safe and only `moveMark` may carry targets. X spells cannot be empowered
(`validateAction` rejects the combination).

**Empower is the only ADDITIVE cost in the game.** Retell, Preserve, Hauntlink
and Skim are all paid *instead of* the printed cost, so they can never ask for
more mana than the card already does; Empower is paid *on top of* it, which
makes its total the one number that can print a card no board can cast. The
Warchest holds `LAND_RESERVE_SIZE` (10) lands, so 10 is the hard ceiling from
lands alone and reaching it means every land untapped on one turn. Owner ruling
2026-08-24 sets the design ceiling at **printed cost + Empower ≤ 9**, with the
two cards printed at 10 held on an explicit allowlist.
`tests/data/empowerCeiling.test.ts` gates both numbers. Silt-Crowned Harvester
(was 11) and Ra, Helm of the Night Barge (was 12) were recosted to 9 under this
ruling.

### Hauntlink (Charm-speed battlefield link action)

An Artifact or Enchantment with a `hauntlink` block is cast only for its printed
cost and enters the battlefield unlinked. Whenever its controller could cast a
Charm, the controller may pay the Hauntlink cost as a stack-free `linkHaunt`
action and choose one creature they control as the host. Paying again moves an
existing link to another friendly creature immediately, including during a
response window. The Linked rider applies only while the relationship exists.
When the linked host leaves play, the Hauntlink permanent goes to its owner's
graveyard too. Moving the link before a removal spell resolves saves it because
the old creature is no longer its host. The engine carries the relationship on
`Permanent.attachedTo` and emits `hauntlinkFormed` and `hauntlinkBroken` events
for presentation.

Rules revisions 1 and 2 preserve the former alternate-cost `castSpell` mode and
the same host-death cleanup for old replays. Revision 3 alone uses `linkHaunt`.

### Rite (additional sacrifice cost)

A card with a `rite` block (`CardDef.rite`, 1.6) can be cast only by also
sacrificing that many creatures its caster controls, chosen in the cast action
itself (`castSpell.sacrifices`). The sacrifices leave the battlefield and their
dies triggers fire, batched in battlefield order exactly like an SBA death
batch, **before the spell reaches the stack** — the engine has no
"whenever another creature dies" observer trigger, so Rite value lives on the
fodder's own dies triggers by design. The sacrifice is a cost: a cancelled Rite
spell does not refund it. The creature cap counts the slots the sacrifice
frees, so a full board can still cast a Rite creature. Legal-action
enumeration offers one canonical sacrifice set (first N in battlefield order);
`validateAction` accepts any legal set of exactly the right size. Rite never
combines with X, Retell, Skim, or Hauntlink, and v1 Rite cards carry no cast
targets (`validateRiteDef`); Rite plus Empower is legal.

### Nine Lives (marked return)

A creature with `nineLives` (1.6) that dies while carrying **zero marks**
returns to the battlefield under its owner's control after its dies triggers
fire, as a fresh summoning-sick permanent carrying one mark — which is what
makes the return once-only, and why any other mark placed on the body switches
Nine Lives off (an intended anti-synergy with mark support). The engine locates
the card in the owner's graveyard by card instance, so the mechanic follows the
physical card, not its name. Batched deaths (a sweeper) fire the whole dies
batch first, then return the marked bodies in battlefield order. A full
creature board blocks the return and the card simply stays in the graveyard
with no memory spent (the `raise` precedent). Tokens and Darlings never return
this way — neither ever reaches the graveyard. Dies riders on a Nine Lives
body fire on both deaths.

### Preserve (graveyard token copy)

A creature card with a `preserve` block (`CardDef.preserve`, 1.6) grants a
main-phase action while it sits in your graveyard: pay the Preserve cost and
**Sever** the card to create a token copy of it. The action (`preserveCard`)
is sorcery-speed — the active player's own main phase only — and stack-free,
like `linkHaunt` and the Darling tax paydown. The physical card moves to the
severed zone one-way; the copy enters as a fresh token permanent keeping the
card's `cardId` and cosmetic `variantKey`, and its arrival triggers fire (a
Preserve card's ETB value is deliberately priced twice). Token-ness lives on
the **permanent** (`Permanent.isToken`), not the card definition, so a
preserved copy evaporates when it dies, is severed, or is recalled — it is
never re-buried to a graveyard, bounced to a hand, or returned to a reserve —
and a preserved copy of a Nine Lives body cannot return. A full creature
board makes the action illegal (the player is choosing to pay, unlike Nine
Lives' silent no-op). Recording the new action bumped the replay log to v9;
the rules revision stays 3.

### Propagate (mark compounding)

The `propagate` effect op (1.7) reads **"put another mark on each marked
permanent you control."** It puts exactly one `+1/+1` mark on every permanent
its controller controls that already carries at least one, and it **creates
nothing**: a permanent sitting at zero marks is skipped, so Propagate can only
ever compound a marked board, never start one. That is the mechanic, not an
implementation detail — it is why a Propagate card is dead on an empty board
and why mark generators, not Propagate itself, are the enabler density a set
has to print.

Three words in the sentence are load-bearing and each is enforced in
`runOp`'s `propagate` case (`src/engine/effects/EffectInterpreter.ts`):

- **"marked"** — the filter is `plusOneCounters > 0`. Nothing is created.
- **"permanent"**, not *creature* — a marked artifact, enchantment or land
  grows too. `getEffectiveStats` adds marks to P/T without checking the card
  type, but nothing reads a non-creature's P/T: the lethal SBA skips
  non-creatures outright (`src/engine/sba.ts`), and so does combat. So the
  count on a non-creature is real and stored, and simply has no visible effect
  until something turns that permanent into a creature.
- **"you control"** — the filter is `controller === ctx.controller`, read from
  the resolving context, so an opponent's marked board is never touched and a
  stolen permanent grows for whoever currently controls it.

Propagate takes **no target**, deliberately: the narrow wording removes the
targeting decision entirely, so the AI has nothing to choose and the op is
trigger-safe and legal as a Foresee continuation (it is listed in
`assertTargetFreeForeseeContinuation`). It logs the generic
`effectApplied` every op logs and adds no event of its own — marks are read
back off the permanent the same way `addCounters` marks are — and it logs that
event even on a board with nothing marked, where it is a silent no-op.

Propagate adds no player action and writes nothing new to the replay log, so
the log version and **the rules revision both stay unchanged** (the Preserve
precedent above bumped the log only because it recorded a new action).

## Board caps

Two per-player caps are enforced at **cast legality** (`castBlockers` in
`src/engine/actions.ts`):

- **8 creatures** (`RULES.maxCreatures`). A creature spell is not castable while
  you already control 8 creatures.
- **4 noncreature, nonland permanents** (`RULES.maxNoncreaturePermanents`) —
  counts enchantments and artifacts, but **attached permanents are exempt**
  (Auras and linked Hauntlinks do not occupy a board slot while attached).

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
`getEffectiveStats` in `src/engine/statics.ts` — base stats + `+1/+1` marks (engine field: counters) +
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
| Priority / stack  | The first pass flushes the whole stack. Current rev 2 may reopen afterward in combat/end when a resolved item and castable Charm pay for it; rev 1 never reopens. | Full priority passing after every object resolves.      |
| Dawn triggers     | Resolve immediately, no window.                                                                | Go on the stack, players get priority.                  |
| End-step window   | Non-active player only. Rev 2 starts with one window and may earn bounded post-flush reopens; rev 1 has exactly one. | Priority in the end step for both players.              |
| Triggers          | Arrival triggers may target and defer a mandatory choice; other triggers auto-resolve. | Triggers may target and use the stack.                  |
| Targeted effects  | Spell targets may use `upTo: 2`; arrival triggers choose one target.              | Arbitrary target counts.                                |
| Twin Blades (double strike) | Implemented (Ragnarök) — deals in both the first-strike and normal damage steps.        | Exists.                                                 |
| Colors of mana    | Generic paid by an auto-tap solver; no mana pool, no floating mana.                             | Mana pool with manual tapping.                          |
| Summoning-sick mana creatures | Cannot tap for mana the turn they enter (ramp is delayed one turn).                   | Depends on the ability (many can if it's not `{T}`).    |
| Board caps        | 8 creatures / 4 noncreature-nonland permanents per player, enforced at cast time.              | No such caps.                                           |
| Legend rule       | Per-controller, per-**name**; oldest survives.                                                 | Per-controller, per-name; you choose which to keep.     |
| Turn limit        | Turn 100 → draw.                                                                               | No turn limit (loops handled differently).              |
| Deck-out          | Losing player is the one who *must* draw from empty.                                            | Same, but on the *next* draw attempt with SBA timing.   |
| Bounce            | Returns to hand and emits `died`/`cardsBottomed(0)` (no dedicated event; UI resyncs from state).| A distinct zone change.                                 |
