<!-- source-of-truth: docs/plan-2.0.md, docs/plan-core-set-2.md, src/engine/mandate.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/effects/EffectInterpreter.ts, src/engine/types.ts, src/engine/events.ts, src/engine/view.ts, src/engine/Game.ts, src/ai/determinize.ts, src/meta/Replay.ts, src/power/scoreCore.ts · last-verified: 2026-10-10 · engine spec, DRAFT: lane B1 of plan-2.0; the parts marked "as built" are on release/2.0, the rest is proposed; re-verify when the owner rules a question below or the overplan's cut changes -->

# Core Set II engine spec: the Mandate, Sworn, and what the cards need (2.0 lane B)

**Status: DRAFT, building.** This is lane B's spec ([plan-2.0.md](plan-2.0.md), B1) and the home of its "as built" notes. The Mandate's rules and Sworn's semantic are already ruled ([plan-core-set-2.md](plan-core-set-2.md), "Engine"; P5, P6, P16). Where that plan left a timing call open, the build takes its recommendation and says so below; each such call is listed under [Questions](#questions-for-the-owner) so the owner can overturn it at the engine sitting.

Build order (the 2.0 plan's shared-file order: the Mandate first in `types.ts` and `Game.ts`, then the life change):

1. The Mandate core. **As built (B2.1).**
2. The starting-life field, sharing the train's one replay bump. **As built (D3a).**
3. Sworn, and the crownless flag for the Sworn Champions. **As built (B2.2).**
4. The Mandate's card wording: "while you hold the Mandate", "if you don't hold the Mandate", "whenever you claim the Mandate". **As built (B2.3).**
5. Small constructs the overplan names: an arrival trigger filtered by subtype (Yutu, Jiuwei, Lanlan); "if you gained life this turn" (Hebe); a token created for a target's controller (Circe's Pig). **As built (B2.4).**
6. Nüwa's pieces: removing marks as an activation cost, without a tap; a Tithe that grants marks; Tithe on a Darling cast (ruled 2026-10-08: it reduces the base cost, never the Darling tax). **As built (B2.5).**
7. The modal "choose up to N" (ruled into the engine 2026-10-08 for later sets).
8. The AI reads (B3), the duel UI (B4), the lab rates (B5).

## Part 1. The Mandate

### Rules (for the owner)

- The Mandate begins unclaimed. A card that says "claim the Mandate" gives it to that card's controller. Claiming it when you already hold it does nothing.
- At your dawn, if you hold the Mandate, you draw a card. This happens before any of your permanents' dawn abilities, and the normal draw still follows. The player who goes first still skips only the normal draw on turn one. Drawing from an empty deck loses the game, as always.
- When your creatures deal combat damage to the player who holds the Mandate, you claim it. It changes hands once per damage step, however many creatures connect. It is taken after the damage lands and before any "whenever this deals combat damage to a player" ability.
- Only combat damage to the holder takes it. Spells, Hunts, damage to blocking creatures, prevented damage (Fog) and creatures with no Attack never do. If nobody holds the Mandate, combat damage does nothing; a card has to claim it first.

### As built (B2.1)

- **State.** `GameState.mandateHolder?: PlayerId`, absent while unclaimed (`src/engine/types.ts`). This follows the engine's idiom for optional public flags (`creatureDiedThisTurn?`), so every hand-built state, saved fixture and legacy JSON stays valid unchanged. `mandateHolderOf(state)` reads it as `PlayerId | null` (`src/engine/mandate.ts`). The set plan sketched a required `PlayerId | null` field; the optional form behaves the same and touches nothing else.
- **Claiming.** `claimMandate(state, emit, player, reason)` in `src/engine/mandate.ts`, the one writer. The effect op `{ op: 'claimMandate' }` calls it for the effect's controller (`EffectInterpreter.ts`). It consumes no RNG and opens no window.
- **Event.** `{ e: 'mandateChanged'; from: PlayerId | null; to: PlayerId; reason: 'effect' | 'combat' }` (`src/engine/events.ts`, documented in [architecture.md](architecture.md)). A no-op claim emits nothing.
- **Dawn.** `startTurn` (`src/engine/phases.ts`) draws for the holder right after entering `dawn`, before the per-permanent dawn loop, and returns if that draw ends the game.
- **Combat.** `dealCombatDamage` (`src/engine/combat/damage.ts`) reads the holder at the start of each batch; if it was the defending player and any hit to that player was positive, the attacking player claims after `applyCreatureDamage` and before the `combatDamageToPlayer` triggers. State-based actions stay where they were. A normal batch after a first-strike claim finds the attacker already holding it, so it never claims twice.
- **Views and the AI.** `viewFor` copies the holder into every `PlayerView` (it is public); `determinize` copies it back, so Hard's simulations see the same holder. `Game.restore`'s legacy-state sync carries it.
- **Scorer.** `claimMandate` scores 0 and is reported as an unknown (`op:claimMandate`) until the lab (B5) measures a claim. The personas' op table also holds it at 0. Neither invents a rate.
- **Words.** `rulesText` renders the op as "claim the Mandate". The Forge accepts it in its validator; it is not yet in the Forge's effect palette (B4 adds the palette entry with the glossary text).
- **Tests.** `tests/engine/mandate.test.ts`: initial state, effect claim, claiming from the other player, already-holder no-op, dawn order, turn-one draw, deck-out at dawn, combat claim, several attackers, claim-before-trigger order, first strike then normal, unclaimed and attacker-holds, blocked damage, zero Attack, Fog, lethal damage, restore and determinize.

## Part 2. The starting-life field (D3a)

**As built.** D2 ruled 25 life. D3 is split so the field lands with the Mandate's replay bump, while the total itself waits on the owner's call (Q1):

- `GameConfig.startingLife?: number` (`src/engine/Game.ts`), default `RULES.startingLife`, rejected unless a positive whole number. `Game.startingLife` exposes the game's own total; the duel's music mood reads it instead of the global.
- `ReplayLog.startingLife?: number` (`src/meta/Replay.ts`). Every new draft records it. A log without it was recorded before v17, at 20, and replays at 20 whatever `RULES.startingLife` says (`replayStartingLife`). The replay viewer in `DuelScene` passes it to its `Game`.
- **The replay bump, 16 to 17** (P16), is shared with the Mandate and later Story's mode. **The rules revision stays 4.** The 2.0 plan proposed revision 5, but nothing needs an executable branch: the life comes from the log as data, and the Mandate is reachable only through cards that claim it, which a log recorded against the old card database can't contain (the db stamp refuses it). A revision with no behaviour behind it would only be bookkeeping.
- **Still to do for D3:** the scorer's life-related terms re-derived in the engine at 25 (Core Set II's costing waits on this, P17); rules, glossary and tutorial copy that says 20; and flipping the default, timed by Q1.

## Part 3. Sworn

### Rules (for the owner)

- Sworn is active while you control a legendary creature (P6, ruled 2026-10-08). Any one counts, including the Sworn card itself if it is a legend. Your opponent's legends don't count, and neither does a legendary permanent that isn't a creature. Several legends don't stack it: it is on or off.
- In Darlings, your Darling turns it on once she is cast, not while she waits in her zone, and it turns off if she leaves.
- On the card it reads as a condition word before the ability: "Sworn: this gets +1/+1." "Sworn: during your Dawn, draw a card."
- The six Sworn Champions are legendary in every way except that their frame shows no crown.

### As built (B2.2)

- **The predicate.** `isSwornActive(battlefield, db, controller)` in `src/engine/statics.ts`, beside `isQuestActive`. `'swornActive'` is a value of `AbilityDef.condition` (triggers, read by `conditionSatisfied` when the ability would fire) and of `StaticDef.condition` (read on every stat calculation, so it switches on and off with the board). No new state; works the same in every format, in simulations and in replays.
- **Words.** `rulesText` prints "Sworn: " and the ability's own sentence, lower-cased. The Forge offers it in its condition picker and accepts it in both trigger and static conditions.
- **AI and scorer.** The AI reads it from the public board (`publicCondition`); without a board, a Sworn ability is valued at 0.6 of its printed value, provisional until the lab. The scorer prices it at full rate and reports `condition:swornActive` until the lab (B5) measures Sworn's active rate per format.
- **Crownless.** `CardDef.crownless?: true`, presentation only: `showsLegendaryCrown` (`src/ui/legendaryCrown.ts`) hides the crown in `CardView` and the Forge's preview. Nothing in the engine, the AI or the filters reads it.
- **Tests.** `tests/engine/sworn.test.ts`: no legend, an opponent's legend, a friendly legend and a crownless one, the source as its own legend, a legendary non-creature, the legend leaving, several legends, a gated trigger, the Darling in her zone and then cast, and the card wording.

## Part 4. The Mandate on cards

### Rules (for the owner)

- "While you hold the Mandate" abilities that change stats or keywords (Jia Nanfeng's Warcry, the Dragon Banner's +1/+0, Themis's +0/+1) switch on and off the moment it changes hands, combat steals included.
- "If you hold the Mandate" and "if you don't hold the Mandate" on a triggered ability (Guan Lu's dawn draw, Nemesis's dawn drain) check when the ability would fire.
- "Whenever you claim the Mandate" fires each time you take it, from a card or from combat. Taking it in combat fires these before any "whenever this deals combat damage to a player" ability. Claiming it when you already hold it does nothing, so nothing fires.

### As built (B2.3)

- **Conditions.** `'youHoldMandate'` and `'youDontHoldMandate'` on `AbilityDef.condition`, read from the state by `conditionSatisfied`; `'youHoldMandate'` also on `StaticDef.condition`.
- **Statics read a board, not a battlefield.** `getEffectiveStats` (and `hasKeyword`, `isSummoningSick` and every function in `combat/legality.ts`) now take a `StaticBoard`, `{ battlefield, mandateHolder? }`, which `GameState` and `PlayerView` both already are. Every engine call passes its state, and the AI passes its view wherever it had passed the view's battlefield, so the rules and the AI see the same holder as the game. A bare battlefield array is still accepted and reads the Mandate as unclaimed; the AI's hypothetical boards (a creature removed, a block simulated) still pass arrays, and B3 decides whether any of them needs the holder.
- **The trigger.** `'youClaimMandate'` fires through `firePlayerObservers` from `claimMandate`, for the claimant's permanents in battlefield order, so a targeted one (Jia Nanfeng's Sever) queues the usual target choice.
- **Words.** "While you hold the Mandate, ..." on statics; on triggers the existing conditional style, "During your Dawn: If you hold the Mandate, draw a card."; "Whenever you claim the Mandate, ...". The Forge offers all three.
- **AI and scorer.** The AI reads the holder from the view; without one, a held or not-held ability is valued at half, provisional. The scorer reports `condition:youHoldMandate`, `condition:youDontHoldMandate` and `when:youClaimMandate` as unpriced until the lab (the claim trigger is held at the arrival rate, 0.75, meanwhile).
- **Tests.** In `tests/engine/mandate.test.ts`: a static following a combat steal, a bare battlefield reading it unclaimed, both dawn conditions for each holder, claim triggers for the claimant only and not on a no-op, claim triggers before combat-damage triggers, a targeted claim trigger, and the card wording.

## Part 5. Small constructs

### Rules (for the owner)

- **"Whenever another Beastkin arrives under your control"** (Yutu, Jiuwei, Lanlan) fires only for a creature of that subtype.
- **"If you gained life this turn"** (Hebe) is on once you have gained any life this turn, from a card or from Blood Oath, and resets at the start of the next turn. Your opponent's life gain doesn't count.
- **"Its controller creates a token"** (Circe's Pig) gives the token to the controller of the creature the effect targeted, even after that creature is gone.

### As built (B2.4)

- **Subtype filter.** `AbilityDef.filter.subtype` on `allyCreatureArrives`, checked in `fireAllyCreatureArrivesTriggers`; the card reads "Whenever another Beastkin arrives under your control". The scorer prices the filter like the other observers' (`FILTER_SUBTYPE_MULT`) instead of reporting it as ignored.
- **Life gained.** `GameState.gainedLifeThisTurn?: PlayerId[]`, set by `noteLifeGained` from the `gainLife` op and Blood Oath (the engine's two ways to gain life), cleared at dawn beside `creatureDiedThisTurn`, public in the view and carried by `determinize` and `restore`. Condition `'youGainedLifeThisTurn'` on triggered abilities; statics treat it as off, like the other turn-history conditions. The scorer prices it like "a creature died this turn" and reports it; the AI values it at 0.6 without a board.
- **Token for the target's controller.** `createToken.for: 'targetController'` reads the first target's owner captured before the effect moved it (`ctx.targetOwners`; no card changes control, so owner and controller are the same). With no target left it creates nothing. The scorer and the AI price it as the negation of the token. The card reads "..., then its controller creates a 1/1 Pig token."
- **Tests.** `tests/engine/coreSet2Constructs.test.ts`.

## Part 6. Nüwa's pieces

The overplan's latest Nüwa (owner's design, 2026-10-08) is a 4/4 Tithe Darling that arrives with a mark for each {1} the Tithe saved (at most 5), claims the Mandate, and spends those marks as five stones. That needs three engine pieces. The modal "choose up to N" (ruled into the engine the same day, for later sets) is Part 7.

### Rules (for the owner)

- **Stones (abilities paid with marks).** "{R}, remove a mark from this: deal 3 damage to any target." The mark is the cost, so the creature never taps: it can use a stone while tapped, on the turn it arrives, and as many times a turn as its marks and mana allow. Stones are used when Duties are, in your Morning or Afternoon with nothing waiting to resolve. Each mark spent is gone for good, so the creature shrinks back toward its printed size.
- **Tithe marks.** "This arrives with a mark for each {1} Tithe saved (at most 5)." Saved means generic mana the sacrifices actually took off the cost, so a cast at full price arrives with none.
- **Tithe from the Darling zone.** A Tithe Darling can Tithe when cast from the Darling zone. The sacrifices come off the printed cost only; the Darling tax is always paid in full (ruled 2026-10-08). So Nüwa's first cast is {5}{W}{U}{B}{R}{G}, Tithed to {W}{U}{B}{R}{G}; after she dies, the {2} tax stays on top of whatever Tithe leaves.

### As built (B2.5)

- **Mark costs.** `ActivatedDef.cost` is now either a Duty's `{ tap: true, mana? }` or `{ removeMarks: n, mana? }` (`src/engine/types.ts`, `markCostOf`). `canActivate` (`src/engine/combat/legality.ts`) takes the ability index: a mark cost needs only the marks, a Duty still needs an untapped, non-sick source. `activate` (`Game.ts`) removes the marks instead of tapping, and the `activated` event carries `marksSpent`. The validator allows a mark cost on creatures only.
- **Tithe marks.** `TitheDef.marks?` caps the marks; the cast records `StackItem.titheMarks` (the printed generic minus the Tithed generic, capped) and the creature enters with them. Entering with marks is not "putting a mark on", so no mark trigger fires, as with tokens made with marks.
- **Darling Tithe.** `castDarling` takes `tithe` and `sacrifices`. `darlingCastCost(d, tax, tithe?)` discounts the printed cost, then adds the tax. `legalActions` offers one canonical fodder cast beside the full-price one, as from hand. The sacrifice payment is shared with the hand cast (`Game.paySacrifices`).
- **AI reads.** A stone is valued as its effect minus 1.2 per mark spent (the AI's price for a targeted mark), and never competes with the body's attack since it does not tap. The Tithe policy (`src/ai/tithePolicy.ts`) now picks fodder for a Darling cast as well, pricing against the printed cost and paying the tax on top; all three brains add the saved mana to a Darling cast's score, as they do from hand.
- **Scorer.** A mark-cost ability scores 0 and reports `activated:removeMarks`; Tithe marks report `tithe:marks` (the Devour rate the Tithe comment already flags). Both wait on the lab (B5).
- **Not yet.** The Forge's builder and validator still accept only tap costs, and the duel UI shows a stone like a Duty; both land with B4.
- **Tests.** `tests/engine/markCostAndDarlingTithe.test.ts`: marks spent with no tap on an arriving creature, repeated use while tapped until the marks run out, a Duty beside stones still taps and waits, the card wording, Tithe marks capped and absent on a full-price cast, the tax paid in full (including when the fodder could cover more than the printed generic), the canonical Darling Tithe offer, and refused sacrifices.

## Questions for the owner

- **Q1. When does the default become 25?** Every win-rate floor in CI was measured at 20. Recommended: the field lands now at 20, the labs and the rescore run at 25 through it, and the default flips together with the one-time floor reset (P8).
- **Q2. Dawn order** (taken as recommended by the set plan): the Mandate's draw comes before the holder's other dawn abilities.
- **Q3. Claim point** (taken as recommended): once per damage batch, after the damage and before combat-damage triggers.
- **Q4. Stone timing** (taken as the default): stones are used at Duty speed, in your own Morning or Afternoon. The alternative is Charm speed (any time you could cast a Charm), which would let Nüwa answer an attack with 3 damage.
