<!-- source-of-truth: src/config/rules.ts, src/engine/Game.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/combat/legality.ts, src/engine/sba.ts, src/engine/statics.ts, src/engine/actions.ts, src/engine/resolve.ts, src/engine/effects/targeting.ts · last-verified: 2026-09-25
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

`startTurn` runs untap → dawn → draw, then hands control to Morning. The player
drives the rest via `passStep` and combat actions.

| Step        | What happens                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **Untap**   | The active player's permanents untap; summoning sickness wears off; the land-drop flag resets.     |
| **Dawn**    | The active player's `dawn` triggers fire and resolve immediately. **No response window.**           |
| **Draw**    | The active player draws one — **except the starting player on turn 1**, who skips it.               |
| **Morning** | Active player's first action phase: play a land, cast anything, or `passStep` to Combat.             |
| **Combat**  | Declare attackers → (window) → declare blockers → (window) → damage. See below.                     |
| **Afternoon** | The second action phase after Combat.                                                              |
| **Sunset**  | The **non-active** player gets the first response window, plus earned post-flush reopens in rules revisions 2-3. Revision 1 gets exactly one. |
| **Cleanup** | Discard to max hand size (7); marked damage and until Sunset effects clear; the turn flips.         |

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
whole stack in one uninterrupted flush. Current games use **rules revision 4**;
an absent `GameState.rulesRev` means revision 1 for legacy states and v6 replays.
Version 7 replays select revision 2, versions 8 through 10 select revision 3,
and version 11 selects revision 4. Revision 4 adds only the Hauntlink windows
described under Hauntlink below; every other rule is revision 3 unchanged.

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
5. **Revision-2 reopen.** After the flush, Combat and Sunset may offer the
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
Combat or at Sunset. The Sunset window is handled slightly separately in both
revisions: passing it calls `enterCleanup` rather than flushing an empty stack.

**Graveyard cards are named by identity (1.8.1).** A target in a graveyard
(`yourGraveCreature`, for reclaim and raise) carries the card's instance id
beside its position, and so does the source of a Retell, Whispers or Preserve
action (`graveInstanceId` beside `graveIndex`). Legal actions carry both. The
engine refuses an action whose position no longer holds that card, and it
binds a ref that names only a position (a hand-built action, or a replay log
older than v15) to the card at that position when the action is submitted.
From then on the stack, a held trigger and a paused effect find the card by
identity (`graveRefIndex` in `src/engine/graveyard.ts`): a spell that targets
the third card of your graveyard returns that card even if a response takes
the first card before it resolves, and it fizzles only if that card itself
has left. Before 1.8.1 the spell read whatever sat at the old position, so
the same response made it return the fourth card. The redacted view lists
each graveyard's identities (`graveyardInstances`), the same public identity
the battlefield and the stack already carry; hands and decks stay counts.
The replay log bumped to v15, still at rules revision 4; v6-v14 logs still
replay, because binding a recorded position picks the card the recorded game
chose.

## Combat

Combat is declared and resolved through `Game.apply` (declaration),
`src/engine/combat/legality.ts` (what's legal), and
`src/engine/combat/damage.ts` (damage math).

### Declaring attackers

- **`declareAttackers` with `[]` skips combat entirely** — no windows, straight
  to Afternoon.
- A creature can attack if it's an untapped, non-summoning-sick creature you
  control without `bulwark` (`canAttack`).
- Attacking **taps** the creature — unless it has **sentinel**, which lets it
  attack untapped.
- Each declared attacker fires its `attacks` triggers immediately.
- Then the **defender gets a response window** over the attackers, after any
  choice those triggers raised (Wild Hunt Matriarch, Morrigan and Aine
  Foresee as they attack). Before 1.8.1 a defender holding a castable Charm
  lost that window to the Foresee.

### Declaring blockers

- After the attacker window resolves, the defender assigns blocks
  (`declareBlockers`).
- **Skyborne** attackers can only be blocked by creatures with **skyborne or
  wardingGaze** (`canBlock`). Summoning sickness does **not** restrict blocking.
- **At most 4 blockers per attacker** (`RULES.maxBlockersPerAttacker`).
- Then the **attacker gets a response window** over the blocks.

### Combat dissolves mid-window

If a response resolves during a combat window and every attacker has left the
battlefield, combat has no attackers to resolve. `resumeAfterFlush` detects the
now-null combat and cleanly falls through to Afternoon (see the `combat` case in
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
| **rage** · Rage | Attacks every turn if it is able to. The compulsion is `compelledAttackers` (`combat/legality.ts`), a filter over `eligibleAttackers`, so anything that makes the creature unable to attack removes it: tapped, summoning sick without Warcry, or **Bulwark**, whose flat "cannot attack" wins. Enforced over the WHOLE declaration by `validateAttackers` (the empty declaration that skips combat is the case it exists to reject), the enumerator only offers subsets containing it, and the AI planner may not drop it. |

Keyword rules text is generated (`KEYWORD_NAMES` in `src/data/glossary.ts`) — see
[docs/adding-cards.md](adding-cards.md). For the full Magic-evergreen → Darling
Blades mapping (these 13 plus not-yet-implemented candidates like
Indestructible, and the Fight/Sacrifice actions), see
[docs/keyword-map.md](keyword-map.md).

### Empower (optional cast cost)

A card with an `empower` block (`CardDef.empower`, 1.3) may be cast for its
normal cost, or for the combined cost (`combineManaCosts`) with the empowered
flag set on the cast action. On resolution the empower ops run after the
card's normal effect (for permanents, after its arrival triggers); empower ops
are target-free except two named shapes: `moveMark` carries two targets and `reclaim` carries one `yourGraveCreature` target (2026-09-04, Renenutet). X spells cannot be empowered
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

**Revision 4: Hauntlink windows.** Owner ruling 2026-09-04: Hauntlink
*explicitly* breaks the no-window-over-triggers rule that normal Charms keep.
A **Hauntlink-only window** (`awaiting.kind === 'hauntlinkWindow'`: the legal
actions are `linkHaunt` and `passResponse`, never a Charm cast or a Skim) opens
in three places, each only for a player who can actually pay a link right then:

- **Over a targeted trigger**, after its target is chosen and before its ops
  run. The trigger's ops are held as a `resolveTrigger` pending decision; the
  trigger's opponent is offered first, then its controller.
- **Over a dies trigger**, before it resolves. `fireTriggers` holds the ops the
  same way, so every death path (combat, damage, destroy, sweep) behaves alike.
- **At the combat damage step**, after the blocks window and before damage,
  defender first, then attacker (`CombatState.hauntlinkPassed` tracks who has
  passed).

A held trigger resolves once every eligible player has passed, and a
state-based check runs immediately afterwards. A held trigger comes before the
ordinary window it interrupts. When a Rite or Tithe sacrifice holds its
fodder's dies trigger, the Hauntlink windows open first, the trigger resolves,
and only then is the opponent offered the ordinary response window over the
spell (skipped as usual when they hold nothing castable); the spell then
resolves normally. The response window over declared attackers waits the same
way when an attack trigger kills a creature whose dies trigger is held. When
nobody could pay a link the engine takes the revision-3 path unchanged, so a
game with no linkable
Hauntlink is byte-identical to revision 3. The reaction the ruling names -
moving a link off a host that a trigger or combat is about to kill - is exactly
what the window exists for.

**Where a held trigger resolves (1.8.1).** A held trigger resolves at the
point where, with no payable link, it would have resolved inline: the game
with no payable link is the reference order, and the window in front of the
trigger is what revision 4 adds. Outside the Hauntlink window, triggers in
this engine resolve the moment they fire, in the middle of whatever caused
them, and the held trigger keeps that place:

1. **In the middle of an effect.** When a spell, a Duty or another trigger
   destroys a creature and still has ops left (destroy target creature, then
   draw a card), the effect pauses at the death. The Hauntlink windows open,
   the held trigger resolves, and then the effect's remaining ops run,
   followed by a state-based check. The ops the effect had already run stand.
   If the trigger raises a choice of its own (a creature it returns Foresees,
   or targets as it arrives), the rest of the effect waits behind that
   choice, as it does with no link. Several deaths in one op (a sweep) hold
   their triggers in battlefield order, and the effect resumes after the last
   of them, behind the newest choice any of the sweep's triggers raised, held
   or not: Black Water's damage and grind come after the Foresee of a Signal
   Kitsune that Sitra's trigger returned. The check for a player at 0 life
   waits for the whole batch, as it does with no link: at 1 life, White-Veil
   Collapse's own life gain still saves its caster from the two Tomb-Toll
   Takers it destroyed. The windows over the batch's remaining held triggers
   still open meanwhile, and creatures still die at each check.
2. **On the stack.** A trigger held while the stack resolves, whether the
   death came from an item's effect or from the state-based check after it,
   resolves before the next item on the stack. The flush pauses, the windows
   and the trigger run, and the flush carries on before any plain choice
   raised along the way is offered: a Foresee, or the target of an arriving
   creature, waits for the rest of the stack exactly as it does with no link.
   Doom Bolt on Barrow-Jarl, cast in response to a removal spell, lets that
   removal resolve before the creature Jarl's trigger returns chooses its
   target.
3. **Ahead of choices already queued.** A held trigger resolves before any
   choice that was queued before it was held and has not been offered yet;
   with no link it would have resolved before that choice came up. Hotwire
   Retort's own Foresee is offered after the toll of the Tomb-Toll Taker its
   damage killed. What the held trigger raises still queues behind those
   choices.
4. **Everywhere else** (combat damage, a Rite or Tithe payment, an attack or
   Dawn trigger) the held trigger resolves before anyone acts again: before
   the ordinary window it interrupts (above), before the Dawn draw, and after
   combat damage before the Afternoon's first action. Around a Rite or Tithe
   payment or an attack the order is fixed, link or no link, whatever the
   opponent holds (owner ruling 2026-09-25, as in Magic): every choice the
   payment or the attack raised is made first (held triggers and all), then
   the opponent's window over the spell or the attackers opens if they hold
   a castable Charm, then the spell resolves. Holding a Charm changes only
   what the opponent may do in that window.

**What matches the no-link game, and what does not.** With every window
passed, a board with a payable link resolves the same ops and triggers as a
board without one, and orders each held trigger the same way against the
effect that caused it, the rest of the stack and the choices queued around
it. These differ:

- **The window, and the links moved in it.** That is the point of revision 4.
- **The state-based check runs before the window**, so the window shows the
  board as it stands: a Hauntlink or Aura on the destroyed creature goes to
  its graveyard, and a creature the effect has already dealt lethal damage
  dies (its own dies trigger held), before the held trigger resolves. With no
  link that check runs after the whole effect, so Verdict Under Resin on a
  linked creature with a dies trigger severs the link card only when a link
  was payable.
- **The paused spell's card and its Empower rider** go when the spell
  pauses, as they do for a spell paused on any choice (a loot's discard, an
  edict). The card reaches its graveyard before the held trigger resolves,
  so graveyard order can differ: a later "sever the top cards" or "most
  recently buried" reads that order.
- **Ally-dies observers and Nine Lives returns run at the death**, before the
  dying creature's held trigger resolves, and so do the returning
  creature's arrival triggers; with no link the dies trigger resolves first.
  A creature returned this way also enters ahead of anything the held
  trigger puts onto the battlefield, and a later "most recently buried"
  return no longer finds it in the graveyard. Shipped ally-dies observers
  only change life totals or add a counter to their own source, but a life
  change is enough to decide the game: the check before the window runs
  after them and before the held trigger. A sweep that kills Madame Macabre
  beside an opponent's Low-Tide Grave can drain her controller to 0 and end
  the game before Madame's own trigger gains her controller 1 life; with no link
  that player survives.
- **Dawn, Sunset and attack triggers run as one pass** in battlefield order.
  When one of them kills a creature, the next permanent's trigger runs before
  the held dies trigger resolves; with no link it resolves inside the trigger
  that caused it.

Magic orders all of this differently: the spell finishes resolving and the
trigger then goes on the stack. This engine never had that stack for
triggers, and a held trigger that waited for the end of the spell would make
the outcome depend on whether any Hauntlink happened to be payable: Verdict
Under Resin (destroy target creature, then sever the top two cards of your
opponent's graveyard) on an opposing Drowned Bride (dies: return it to its
owner's hand) would sever the Bride only when a link was payable. Before
1.8.1 an effect paused this way lost its remaining ops and a Duty threw
instead; a trigger held while the stack resolved waited for the whole stack,
a held trigger could come after a choice queued ahead of it, and a sweep's
remaining ops could run ahead of a choice its own triggers had raised.

**A choice raised inside an effect (1.8.1, link or no link).** When a trigger
inside an effect raises a choice and the effect still has ops left (a
creature returned by Barrow-Jarl or Sitra that targets as it arrives, or that
Foresees and then draws), the effect pauses behind that choice: the choice is
made, the arriving creature's ability (or the Foresee and what follows it)
resolves, and then the rest of the effect runs in its own context. Before
1.8.1 the engine threw here: Reaper's Due, Verdict Under Resin, Black Water,
Night-Market Price or White-Veil Collapse killing Barrow-Jarl or Sitra when
the creature returned was Thing in the Cistern, Drowned Bell Choir, Drowned
Nurse or another targeted arrival, or Signal Kitsune or another arrival that
Foresees and then acts.

**Records.** None of this adds an action, so the replay log stays v14 and the
rules revision stays 4. It does change what a revision-4 game does whenever
a trigger is held, including a hold that paused nothing: in 1.8.0 a trigger
held during a stack flush waited for the whole stack. A 1.8.0 action log that
passes through such a hold can therefore fail to replay on 1.8.1 (an action it
recorded is no longer legal there). The same holds, link or no link, for a
Rite or Tithe payment that raised a choice and for an attack trigger's
choice with the defender holding a Charm (Rite, and Declaring attackers,
above). No such log reaches 1.8.1 in practice:
1.8.1's card-text changes moved the card-data stamp, so every 1.8.0 replay is
already refused as recorded on an older version.

### Rite (additional sacrifice cost)

A card with a `rite` block (`CardDef.rite`, 1.6) can be cast only by also
sacrificing that many creatures its caster controls, chosen in the cast action
itself (`castSpell.sacrifices`). The sacrifices leave the battlefield and their
graveyard and dies triggers fire, batched in battlefield order exactly like an
SBA death batch, **before the spell reaches the stack**. The fodder's own dies
triggers were Rite's only payoff until 1.8; the `allyDies` observer (see The
Drowned Deep vocabulary below) can now watch a sacrifice as well. A
**state-based check** then runs on the paid board before anyone is offered a
window over the spell: a player drained to 0 by a fodder's dies trigger loses
there, and a Hauntlink whose host was sacrificed goes to the graveyard with
it. A choice the payment raises (a fodder's dies trigger returning a
creature that targets or Foresees as it arrives) is always made before that
window, whatever the opponent holds; the window is then offered as usual,
and the spell resolves after it (owner ruling 2026-09-25, as in Magic). In
1.8.0 the order depended on the opponent's hand: with no castable Charm the
spell resolved first and the choice came after it, and with one the choice
replaced the window and the spell stayed on the stack unresolved. The sacrifice is a cost: a cancelled Rite spell does not refund it. The
creature cap counts the slots the sacrifice frees, so a full board can still
cast a Rite creature. Legal-action enumeration offers one canonical sacrifice
set (first N in battlefield order); `validateAction` accepts any legal set of
exactly the right size. Rite never combines with X, Retell, Skim, Hauntlink,
Whispers or Tithe (`validateRiteDef` refuses each, and the Whispers and Tithe
validators refuse Rite back). A Rite spell may carry cast targets (Drowned
Deep's Rite of the Wreckers targets a creature, for one): they are chosen
with the cast, before the sacrifice is paid, and the spell fizzles as any
spell does if no chosen target is still legal when it resolves. The
validator still refuses a Rite Aura and a target that no op uses. Rite plus
Empower is legal.

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
Morning or Afternoon action while it sits in your graveyard: pay the Preserve cost and
**Sever** the card to create a token copy of it. The action (`preserveCard`)
is sorcery-speed — the active player's own Morning or Afternoon only — and stack-free,
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
target-free and legal as a Foresee continuation (it is listed in
`assertTargetFreeForeseeContinuation`). It logs the generic
`effectApplied` every op logs and adds no event of its own — marks are read
back off the permanent the same way `addCounters` marks are — and it logs that
event even on a board with nothing marked, where it is a silent no-op.

Propagate adds no player action and writes nothing new to the replay log, so
the log version and **the rules revision both stay unchanged** (the Preserve
precedent above bumped the log only because it recorded a new action).

### Trigger chains and once-each-turn triggers

Two observers can feed each other: Saint of the Lamp Oil marks herself
whenever you gain life, and Reef Shaman of the Shallows gains you life
whenever you put a Mark on a creature. Two rules keep that a synergy rather
than a hang (owner ruling 2026-09-17, after the phase D draft measurement
froze a duel on exactly that pair):

- **A trigger chain stops after eight rounds.** When a triggered ability
  would fire as the ninth link of a chain that its own resolution started,
  it does not fire, nothing else changes, and the game goes on. The cap is
  `MAX_MARK_TRIGGER_DEPTH` in `src/engine/effects/EffectInterpreter.ts` and
  it applies to the mark observers and the life-gain observer alike. Until
  the ruling the engine threw at the cap, which the tests pinned; now the
  tests pin the bounded outcome.
- **"This triggers only once each turn."** A triggered ability printed with
  that sentence (`oncePerTurn: true` on the ability in card data) fires the
  first time its event happens in a turn and not again until the next turn
  begins, on either player's turn. The engine tracks it per permanent, so
  two copies each fire once, and a permanent that leaves and returns starts
  clean. The Saint carries it; the sentence renders from the flag, general
  to every trigger kind.

### Duty (tap ability)

A creature, artifact or enchantment with an `activated` block
(`CardDef.activated`, 1.8) carries a **Duty**: a repeatable ability its
controller pays for by tapping the permanent, plus any listed mana. The rules
line opens with the same tap icon lands use (`pip-T`, drawn smaller), never
the word "tap"; the glossary teaches the mechanic under the name Duty. The
engine field, the action and the event all say `activated`.

**Timing.** Duty is sorcery-speed and stack-free, like `preserveCard` and
`linkHaunt`: the active player's own Morning or Afternoon, empty stack only.
The `activate` action names the source permanent and, when the ability
targets, its targets inline, chosen up front under the spell target rules and
never deferred. Legality is `activatedBlockers` in `src/engine/actions.ts`
(with `canActivate` beside `canAttack` in `combat/legality.ts`), and the
legal-action list holds one `activate` per legal target choice. The blockers,
in order: not your main phase; stack not empty; source not on the
battlefield; not under your control; already tapped; arrived this turn without
Warcry; mana cost unpayable; no legal target.

**Resolution.** Paying the cost taps the source and the mana; the ops then run
immediately in order with the permanent as source, off the stack, and a
state-based check runs afterwards (the deferred-trigger lesson of 1.7.2). The
opponent gets no response window over the Duty, the rule Skim, Preserve and
Hauntlink already follow. The Duty's own targets are chosen up front and
never deferred; anything its ops raise is deferred through the same queue a
resolving spell uses (1.8.1; before that anything but a Foresee threw):

- a `foresee` op opens the usual look-and-bottom decision, and any ops after
  it resume under the activating player's context once that decision is made
  (`thenContext` on the pending decision). The validator forbids an inline
  target after a Foresee for exactly that reason: the resumed ops no longer
  carry the Duty's targets.
- a dies trigger held for a Hauntlink window pauses the Duty exactly as it
  pauses a spell (Hauntlink, "Where a held trigger resolves"): the window
  over the trigger, the trigger, then the rest of the Duty.
- a targeted arrival (a token or a returned creature that targets as it
  arrives) asks for its target once the Duty has finished, as after a spell;
  if the Duty still has ops left, it pauses behind that choice and runs them
  afterwards in its own context ("A choice raised inside an effect", under
  Hauntlink). The catalog gate still keeps Duties from creating
  targeted-arrival permanents themselves.

**The arrival rule.** A permanent cannot tap for its Duty the turn it arrives
unless it has Warcry. That is one rule for every carrier, creatures and
non-creatures alike, and it is the rule mana creatures already follow
(`isSummoningSick` in `statics.ts` applies to every permanent). The
controller's next untap step refreshes the Duty like any other tap.

**Carriers and combinations.** Lands never carry a Duty; their tap is the mana
ability. A Duty carrier cannot also carry `manaAbility` or `hauntlink` in this
revision, and the validator refuses both, along with an X cost, an empty op
list and a targeting op without a target spec (the full list is in
[adding-cards.md](adding-cards.md)). Tapping for a Duty is a real cost on a
creature: a tapped creature neither attacks nor blocks that turn, and the AI
prices a creature's Duty against the attack it forgoes.

**Records.** The `activate` action is a new replay entry, so the log bumped to
v12; the rules revision stays 4, since no existing card changes behaviour. The
`activated` game event is logged before the ops run, after `manaTapped`.

### Whispers (fresh-graveyard cast)

A card with a `whispers` block (`CardDef.whispers`, 1.8) can be cast from
your graveyard for its **Whispers** cost, but only while the card is fresh:
it must have reached the graveyard from your **hand or your deck** (a Skim, a
discard, a grind), and the chance ends at your opponent's next Dawn. A card
you discard to hand size at your own cleanup is tagged like any other hand
discard, but your opponent's Dawn follows with no window in between, so the
chance is over before you could take it: the cleanup discard never gives a
Whispers cast. A card that reaches the graveyard from the battlefield or from
the stack is never fresh, and a severed card is gone. The rules line prints
`Whispers {N}`; the glossary teaches the mechanic under the name Whispers.

**The marker.** When a card enters a graveyard from a hand or a deck, the
engine tags the entry with `whispersUntilDawnOf`, the owner's opponent at
that moment. At the start of that player's Dawn, beside untap, every marker
naming them is cleared on both graveyards. A card tagged on your own turn is
castable for the rest of that turn and gone at your opponent's Dawn (tagged
at your cleanup, it is gone before any window opens); one tagged on their
turn survives their turn and your whole next turn. The marker is public
information (graveyards are open): the redacted view lists each side's live
entries as `whispersLive`, graveyard indices, and the brains read it only
there.

**Timing and cost.** A Whispers cast obeys the window rules a hand cast of
that card type obeys: a Charm at Charm speed, anything else in your own
Morning or Afternoon with an empty stack. `castSpell` carries `whispers:
true` and uses Retell's graveyard source model. The Whispers cost replaces
the printed cost outright: no Empower, no X, and never on a card with
Retell, Rite or Hauntlink (the validator refuses the combinations in both
directions). A live Whispers Charm counts as a castable Charm for every
window gate.

**Resolution.** A whispered spell resolves as itself; a Charm or Ritual
returns to the graveyard untagged (it arrived from the stack, not from a
hand), and a permanent arrives with no marker, so a later death does not
re-tag it. Graveyard triggers fire once, on entry, as today. The `whispered`
game event is emitted when the cast is announced, for narration.

### Tithe (sacrifice discount)

A creature with a `tithe` block (`CardDef.tithe`, 1.8) can be cast by
sacrificing **any number** of your creatures as an additional cost: every
two points of combined Defense among the sacrificed creatures pays one
generic mana of the printed cost, rounded down, and coloured pips are never
reduced. The rules line prints the bare keyword `Tithe`; the glossary
teaches it under that name. Drowned Deep prints Tithe only on Horrors; that
is a per-set catalog rule, not an engine one.

**Choosing the fodder.** `castSpell` carries `tithe: true` and the chosen
creatures' battlefield iids in `sacrifices`, Rite's field; any legal subset of your own
creatures is accepted. The legal-action list offers the cast without a
sacrifice and one canonical cast whose fodder is your bodies sorted by
effective Defense ascending, taken until the discount covers the generic
part or the board runs out. Defense is read from `getEffectiveStats`, so
marks and statics count and tokens are legal fodder. With Empower also
chosen, the discount applies to the generic part of the combined total.

**Payment.** The sacrifice is paid the way Rite pays: the chosen creatures
leave the battlefield in battlefield order before the spell reaches the
stack, their graveyard and dies triggers batched, a state-based check runs
on the paid board before any window opens, and a cancelled Tithe spell does
not refund them. The creature-cap check at cast time subtracts
the fodder count, the Rite rule. Tithe never appears beside X, Retell,
Hauntlink or Rite. It may share a card with Whispers (owner ruling
2026-09-17, for Cinderjaw, the Fire That Swims): a fresh Whispers card whose
owner controls fodder is offered the plain Whispers cast and one canonical
Whispers-plus-Tithe cast, and the discount pays the generic part of the
Whispers cost the same way it pays the printed one, coloured pips untouched,
never below zero generic. Payment and the fodder's departure follow the
Tithe rules above whichever cost is being paid.

**Records.** Both riders live on the existing `castSpell` action, so the
replay log bumped to v13; the rules revision stays 4, since no shipped card
changes behaviour. The marker is derived state and is not recorded.

### The Drowned Deep vocabulary (1.8)

The cut's printed lines needed a short list of general constructs, all of
them inert until a card uses them (no shipped card changes behaviour, so
the rules revision stays 4):

- **Observers.** A creature's `dies` trigger fires for itself; the new
  `allyDies` observer on a permanent fires whenever a creature its
  controller controls dies, filtered to "another" creature, a subtype, or
  a sacrifice. `youGainLife`, `youCastCharm` and `allyAttacks` observe the
  controller's life gains, Charm casts and attack declarations. Observers
  fire in battlefield order after the batched deaths, the `dies` rule.
- **Sunset triggers.** "At Sunset" fires at the controller's Sunset step;
  "if a creature died this turn" is a per-turn condition cleared at the next
  Dawn.
- **Targeted attack and Dawn triggers.** Since 1.7 an arrival trigger may
  target, its choice deferred to the controller; attack and Dawn triggers
  now take the same path. A trigger with no legal target fizzles silently.
- **Looting.** "Draw a card, then discard a card" draws, then the
  controller chooses the discard (a decision, recorded in the replay log);
  cards discarded this way came from a hand, so a Whispers card is fresh.
- **Edicts.** "Opponent sacrifices a creature" is the opponent's choice, a
  decision for that seat; "each player sacrifices a creature" asks the
  caster first, then the opponent. The deaths fire triggers normally.
- **Target qualifiers.** "with cost N or less", "with attack N or more",
  "a creature an opponent controls" and "two target creatures" are exact:
  the legality check enforces the cap, the controller and the pair.
- **Multiple Duties.** A permanent may carry several Duties; activating
  names which one, and each prints on its own line.

**Records.** The loot discard, the edict sacrifice and the deferred trigger
target are recorded as decisions, so the replay log bumped to v14, still at
rules revision 4.

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
created). Verify in the `createToken` case of `EffectInterpreter.ts`. The same
check-then-stop guards every other effect that puts a creature onto the
battlefield: `raise` returns nothing at the cap, and a Nine Lives return leaves
the card in the graveyard.

**The creature cap is a casting rule (owner ruling, 2026-09-23).** A creature
spell is checked when it is cast, never again when it resolves. Rite and Tithe
count their sacrifices as already gone at cast time (`castBlockers`), so a
player at 8 can still cast them. Anything that adds a creature while the spell
is on the stack, including a sacrificed creature's own dies trigger making a
token or its Nine Lives return (Marsh-Mother, What the Nets Remember,
Marsh-Wight, Reed-Wight), fills a freed slot first, and the spell then resolves
onto a board of 8, leaving 9. That is by design: a resolution-time check would
need a new rule for what happens to a paid-for creature, and the board lays out
any count (`src/ui/rowPacking.ts`). No further creature can be cast, made or
returned until the count drops below 8 again.

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
   keyed on `${controller}:${name}`. A dies trigger that returns a creature
   card from its controller's graveyard (Sitra, Barrow-Jarl) passes over a
   legendary card that shares a name with a legend that player controls, and
   returns the next creature card instead (owner ruling 2026-09-25). The
   returned copy would only die to this rule, and with three copies of one
   legend the return and the death repeated without end.

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
| Priority / stack  | The first pass flushes the whole stack. Current rev 2 may reopen afterward in Combat/Sunset when a resolved item and castable Charm pay for it; rev 1 never reopens. | Full priority passing after every object resolves.      |
| Dawn triggers     | Resolve immediately, no window.                                                                | Go on the stack, players get priority.                  |
| Sunset window     | Non-active player only. Rev 2 starts with one window and may earn bounded post-flush reopens; rev 1 has exactly one. | Priority in Magic's ending phase for both players.     |
| Triggers          | Arrival triggers may target and defer a mandatory choice; other triggers auto-resolve. Rev 4: a targeted or dies trigger is held open for a Hauntlink-only window first. | Triggers may target and use the stack.                  |
| Hauntlink windows | Rev 4 only, and Hauntlink only: link or move over a trigger about to resolve and at the combat damage step. Charms never get these windows. | Equipment moves only at sorcery speed.                  |
| Targeted effects  | Spell targets may use `upTo: 2`; arrival triggers choose one target.              | Arbitrary target counts.                                |
| Twin Blades (double strike) | Implemented (Ragnarök) — deals in both the first-strike and normal damage steps.        | Exists.                                                 |
| Colors of mana    | Generic paid by an auto-tap solver; no mana pool, no floating mana.                             | Mana pool with manual tapping.                          |
| Summoning-sick mana creatures | Cannot tap for mana the turn they enter (ramp is delayed one turn).                   | Depends on the ability (many can if it's not `{T}`).    |
| Board caps        | 8 creatures / 4 noncreature-nonland permanents per player, enforced at cast time.              | No such caps.                                           |
| Legend rule       | Per-controller, per-**name**; oldest survives.                                                 | Per-controller, per-name; you choose which to keep.     |
| Turn limit        | Turn 100 → draw.                                                                               | No turn limit (loops handled differently).              |
| Deck-out          | Losing player is the one who *must* draw from empty.                                            | Same, but on the *next* draw attempt with SBA timing.   |
| Bounce            | Returns to hand and emits `died`/`cardsBottomed(0)` (no dedicated event; UI resyncs from state).| A distinct zone change.                                 |
