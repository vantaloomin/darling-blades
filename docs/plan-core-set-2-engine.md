<!-- source-of-truth: docs/plan-2.0.md, docs/plan-core-set-2.md, src/engine/mandate.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/effects/EffectInterpreter.ts, src/engine/types.ts, src/engine/events.ts, src/engine/view.ts, src/engine/Game.ts, src/ai/determinize.ts, src/ai/combatPlans.ts, src/ai/evaluate.ts, src/meta/Replay.ts, src/power/scoreCore.ts, scripts/mandate-lab/cards.ts, src/ui/mandatePresentation.ts, src/ui/modeChoice.ts · last-verified: 2026-10-10 · engine spec, DRAFT: lane B1 of plan-2.0; the parts marked "as built" are on release/2.0, the rest is proposed; re-verify when the owner rules a question below or the overplan's cut changes -->

# Core Set II engine spec: the Mandate, Sworn, and what the cards need (2.0 lane B)

**Status: DRAFT, building.** This is lane B's spec ([plan-2.0.md](plan-2.0.md), B1) and the home of its "as built" notes. The Mandate's rules and Sworn's semantic are already ruled ([plan-core-set-2.md](plan-core-set-2.md), "Engine"; P5, P6, P16). Where that plan left a timing call open, the build takes its recommendation and says so below; each such call is listed under [Questions](#questions-for-the-owner) so the owner can overturn it at the engine sitting.

Build order (the 2.0 plan's shared-file order: the Mandate first in `types.ts` and `Game.ts`, then the life change):

1. The Mandate core. **As built (B2.1).**
2. The starting-life field, sharing the train's one replay bump. **As built (D3a).**
3. Sworn, and the crownless flag for the Sworn Champions. **As built (B2.2).**
4. The Mandate's card wording: "while you hold the Mandate", "if you don't hold the Mandate", "whenever you claim the Mandate". **As built (B2.3).**
5. Small constructs the overplan names: an arrival trigger filtered by subtype (Yutu, Jiuwei, Lanlan); "if you gained life this turn" (Hebe); a token created for a target's controller (Circe's Pig). **As built (B2.4).**
6. Nüwa's pieces: removing marks as an activation cost, without a tap; a Tithe that grants marks; Tithe on a Darling cast (ruled 2026-10-08: it reduces the base cost, never the Darling tax). **As built (B2.5).**
7. The modal "choose up to N" (ruled into the engine 2026-10-08 for later sets). **As built (B2.6), for Rituals and Charms.**
8. The AI reads (B3, **as built**, Part 1), the duel UI (B4, **as built**, Part 8), the lab rates (B5, **as built** for the Mandate and Sworn, Part 9).

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
- **Scorer.** `claimMandate` is priced from the lab (B5, Part 9): 0.7 an op, so a claim on arrival is about half a mana. The personas' op table matches it.
- **Words.** `rulesText` renders the op as "claim the Mandate". The Forge offers it in its effect palette (added in B4).
- **Tests.** `tests/engine/mandate.test.ts`: initial state, effect claim, claiming from the other player, already-holder no-op, dawn order, turn-one draw, deck-out at dawn, combat claim, several attackers, claim-before-trigger order, first strike then normal, unclaimed and attacker-holds, blocked damage, zero Attack, Fog, lethal damage, restore and determinize.

### AI reads (B3, as built)

Every brain sees the public holder in its view. On top of that, with two provisional prices in `src/ai/value.ts`, both marked NEEDS MATH until the lab (B5):

- **A claim.** `opImpactValue` prices `claimMandate` at `MANDATE_HOLD_VALUE` (2.5, about two dawn draws at 1.25), and at 0 for a player who already holds it.
- **Stealing it (Medium, and Hard's candidate sets).** `scoreAttack` and `chooseAttackers` take the holder. When the defender holds it, an attack set where anything connects (an unblocked attacker, or Overrun spill) gains `MANDATE_COMBAT_VALUE` (4.5, about one cheap creature in `permValue`'s units) once. So Medium trades a 2-drop to take it, and never throws a real threat at it.
- **Keeping it.** `chooseBlocks` takes the holder too. While we hold it, after the normal blocks it tries to cover every attacker that would still connect, each with the free blocker whose exchange costs least, and blocks only if all of them can be covered for less than `MANDATE_COMBAT_VALUE`. A Dreaded attacker, or Overrun that would spill over its blocker anyway, means it can't be kept and nothing is thrown away. The attacker's own block model makes the same calculation, so attacks expect these chumps.
- **Statics in the fight.** The combat planner reads stats and block legality through a board that carries the holder, so "while you hold the Mandate" bonuses count in planned fights.
- **Hard.** Its search's blocks and attack candidates go through the same planner. `evaluate` (`src/ai/evaluate.ts`) adds `MANDATE_HOLD_VALUE` for holding it (subtracting it when the opponent does), from the public holder and deck size only. The value fades as the holder's deck runs low and turns negative at an empty deck.
- **Proof.** No shipped card claims the Mandate, so every standing floor and matrix plays exactly as before. The new reads are tested in `tests/ai/mandateReads.test.ts`. They're measured for real once Core Set II's cards exist, in the lab (B5) and the train's one measurement.

## Part 2. The starting-life field (D3a)

**As built.** D2 ruled 25 life. D3 is split so the field lands with the Mandate's replay bump, while the default stays 20 until the floor reset (Q1, ruled):

- `GameConfig.startingLife?: number` (`src/engine/Game.ts`), default `RULES.startingLife`, rejected unless a positive whole number. `Game.startingLife` exposes the game's own total; the duel's music mood reads it instead of the global.
- `ReplayLog.startingLife?: number` (`src/meta/Replay.ts`). Every new draft records it. A log without it was recorded before v17, at 20, and replays at 20 whatever `RULES.startingLife` says (`replayStartingLife`). The replay viewer in `DuelScene` passes it to its `Game`.
- **The replay bump, 16 to 17** (P16), is shared with the Mandate and later Story's mode. **The rules revision stays 4.** The 2.0 plan proposed revision 5, but nothing needs an executable branch: the life comes from the log as data, and the Mandate is reachable only through cards that claim it, which a log recorded against the old card database can't contain (the db stamp refuses it). A revision with no behaviour behind it would only be bookkeeping.
- **The scorer's life terms at 25 (D3b), measured: they stand.** The rate lab's life set (`scripts/mandate-lab/cards.ts`, run 38025775738, report `study-data:life-lab/2026-10-10-38025775738/report.md`) played the Warchest field at 20 and 25 on the same seeds, 32,480 paired slots at each life, with a colourless 3/3 for three that gains 4 life or drains 3 on arrival. In mana measured at the same life, gain 4 reads 0.92 at 20 and 1.00 at 25, drain 3 reads 1.14 and 1.15. A mana itself is worth less at 25 (5.49 pts against 5.92) because games run longer (22.4 turns against 20.3), but a point of life keeps its price in mana, so the life terms need no change for 25. The drain reading matches the scorer (1.5 at the arrival rate is 1.13). Gain 4 priced at 0.6 against a measured 0.9 to 1.0 at both lives, an older gap that was not the life change's: the gain set (run 38032348013, `study-data:gain-lab/2026-10-10-38032348013/report.md`) read gain 2, 4 and 8 on arrival at 0.55, 1.00 and 1.64 mana, and `gainLifeRate` (`src/power/scoreCore.ts`) replaces Magic's 0.2 a point with 0.13 + 0.3 a point up to 4, then 0.215 a point.
- **Copy.** No game text names 20 (the tutorial's goal reads "take your foe to 0 life"); only [rules.md](rules.md)'s table, which follows `RULES.startingLife`, changes when the default does.
- **Still to do for D3:** flipping the default, timed by Q1.

## Part 3. Sworn

### Rules (for the owner)

- Sworn is active while you control a legendary creature (P6, ruled 2026-10-08). Any one counts, including the Sworn card itself if it is a legend. Your opponent's legends don't count, and neither does a legendary permanent that isn't a creature. Several legends don't stack it: it is on or off.
- In Darlings, your Darling turns it on once she is cast, not while she waits in her zone, and it turns off if she leaves.
- On the card it reads as a condition word before the ability: "Sworn: this gets +1/+1." "Sworn: during your Dawn, draw a card."
- The six Sworn Champions are legendary in every way except that their frame shows no crown.

### As built (B2.2)

- **The predicate.** `isSwornActive(battlefield, db, controller)` in `src/engine/statics.ts`, beside `isQuestActive`. `'swornActive'` is a value of `AbilityDef.condition` (triggers, read by `conditionSatisfied` when the ability would fire) and of `StaticDef.condition` (read on every stat calculation, so it switches on and off with the board). No new state; works the same in every format, in simulations and in replays.
- **Words.** `rulesText` prints "Sworn: " and the ability's own sentence, lower-cased. The Forge offers it in its condition picker and accepts it in both trigger and static conditions.
- **AI and scorer.** The AI reads it from the public board (`publicCondition`); without a board, a Sworn ability is valued at half its printed value. The scorer prices it at x0.5 (`COND_SWORN`), from the lab's legend-rich decks (B5, Part 9).
- **Crownless.** `CardDef.crownless?: true`, presentation only: `showsLegendaryCrown` (`src/ui/legendaryCrown.ts`) hides the crown in `CardView` and the Forge's preview. Nothing in the engine, the AI or the filters reads it.
- **Tests.** `tests/engine/sworn.test.ts`: no legend, an opponent's legend, a friendly legend and a crownless one, the source as its own legend, a legendary non-creature, the legend leaving, several legends, a gated trigger, the Darling in her zone and then cast, and the card wording.

## Part 4. The Mandate on cards

### Rules (for the owner)

- "While you hold the Mandate" abilities that change stats or keywords (Jia Nanfeng's Warcry, the Dragon Banner's +1/+0, Themis's +0/+1) switch on and off the moment it changes hands, combat steals included.
- "If you hold the Mandate" and "if you don't hold the Mandate" on a triggered ability (Guan Lu's dawn draw, Nemesis's dawn drain) check when the ability would fire.
- "Whenever you claim the Mandate" fires each time you take it, from a card or from combat. Taking it in combat fires these before any "whenever this deals combat damage to a player" ability. Claiming it when you already hold it does nothing, so nothing fires.

### As built (B2.3)

- **Conditions.** `'youHoldMandate'` and `'youDontHoldMandate'` on `AbilityDef.condition`, read from the state by `conditionSatisfied`; `'youHoldMandate'` also on `StaticDef.condition`.
- **Statics read a board, not a battlefield.** `getEffectiveStats` (and `hasKeyword`, `isSummoningSick` and every function in `combat/legality.ts`) now take a `StaticBoard`, `{ battlefield, mandateHolder? }`, which `GameState` and `PlayerView` both already are. Every engine call passes its state, and the AI passes its view wherever it had passed the view's battlefield, so the rules and the AI see the same holder as the game. A bare battlefield array is still accepted and reads the Mandate as unclaimed; the AI's hypothetical boards (a creature removed, a block simulated) still pass arrays. B3 gave the combat planner the holder (below), so its fights read held and not-held statics; the other hypothetical boards still read unclaimed, which no shipped card can tell apart yet.
- **The trigger.** `'youClaimMandate'` fires through `firePlayerObservers` from `claimMandate`, for the claimant's permanents in battlefield order, so a targeted one (Jia Nanfeng's Sever) queues the usual target choice.
- **Words.** "While you hold the Mandate, ..." on statics; on triggers the existing conditional style, "During your Dawn: If you hold the Mandate, draw a card."; "Whenever you claim the Mandate, ...". The Forge offers all three.
- **AI and scorer.** The AI reads the holder from the view. Without one, both it and the scorer use the lab's rates (B5, Part 9): a held ability x0.45, a not-held one x0.75, and a claim trigger at 0.8, about an attack trigger's rate.
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
- **Duel and Forge.** Built with B4 (Part 8).
- **Tests.** `tests/engine/markCostAndDarlingTithe.test.ts`: marks spent with no tap on an arriving creature, repeated use while tapped until the marks run out, a Duty beside stones still taps and waits, the card wording, Tithe marks capped and absent on a full-price cast, the tax paid in full (including when the fodder could cover more than the printed generic), the canonical Darling Tithe offer, and refused sacrifices.

## Part 7. Modal spells

Ruled into the engine 2026-10-08 so later sets can print "some of these effects" cards. No card in Core Set II's current cut uses it (Nüwa moved to stones), so it is built for Rituals and Charms, where Magic's Commands and Charms live, and stops there until a card needs more.

### Rules (for the owner)

- A modal spell says "Choose one —", "Choose up to two —", "Choose one or both —" or "Choose one or more —", then lists its modes. You pick as you cast it: at least one mode, never the same mode twice, and each chosen mode's target if it has one. You can't pick a mode that has no legal target.
- The chosen modes happen in the order they are printed. If a mode's target is gone by then, that mode does nothing and the rest still happen. The spell does nothing at all only when every mode you chose had a target and all of them are gone.
- Unlike Magic's "choose up to", you can't choose zero modes.

### As built (B2.6)

- **Data.** `CardDef.modal: { upTo, modes: [{ ops, targets? }] }` (`src/engine/types.ts`), refused by `validateModalDef` outside a plain Ritual or Charm, beside any other cast option, or with a mode that targets twice, Hunts, moves a mark, uses X or targets after Foresee. The catalog test runs it on every card.
- **Casting.** `castSpell` takes `modes` (ascending indexes); `targets` holds each targeted mode's target in mode order. `legalActions` offers one cast per mode choice and target list (`modeChoices`, `modalTargetSpecs` in `src/engine/actions.ts`). The stack item records the modes.
- **Resolving.** `resolveModalSpell` (`src/engine/resolve.ts`) runs each chosen mode with its own target slot, as the rules above say.
- **Words.** `modalText` in `src/ui/rulesText.ts`.
- **AI reads.** `modalCastValue` (`src/ai/value.ts`) adds each chosen mode's value: its target-free ops at printed rates and its targeted ops on the target the cast names. `cardValue` folds it in for Medium and Hard; Easy adds it to its cast score. Medium still holds every Charm for a response window, as it does today.
- **Scorer.** A modal card scores 0 for its modes and reports `modal` until the lab (B5) measures a rate.
- **Not yet.** Modal triggers and Duties, and a mode editor in the Forge (a modal card loads, previews and exports as printed). The duel's mode chooser is built (Part 8).
- **Tests.** `tests/engine/modal.test.ts`: the offered choices (and a mode with no target left out), printed-order resolution on separate targets, a gone target skipping its mode and fizzling only when every mode lost its target, refused choices, the wording, the validator, and all three brains picking a removal mode over a life point.

## Part 8. The duel UI (B4)

### As built

- **The Mandate's seal.** `MandateSeal` (`src/ui/MandateSeal.ts`) draws a gold seal with a star beside its holder's life badge, on the commander portrait and never over the life number. Placement and copy are pure (`src/ui/mandatePresentation.ts`). The owner ruled the mobile frames' calls on 2026-10-10 and the desktop follows them: M1, the portrait corner; M2, nothing is shown while the Mandate is unclaimed.
- **When it shows.** Only while someone holds it. No shipped card claims it yet, so no live duel shows it before Core Set II.
- **The claim.** On `mandateChanged` the seal flies from the old holder to the new one (600 ms, one tween, a fading ring left behind); a first claim grows the seal in place inside the ring. Both are instant unless motion is full. Taken in combat, it flies once the blows have landed (`sequencedEventRoute` holds it with the strikes). Hover, or a tap on touch, opens a card saying who holds it and the rules reminder. While a player's face is a legal target the seal takes no input, so the whole portrait stays the target.
- **History.** "You claim the Mandate", "Your opponent takes the Mandate in combat", and, from the engine's new `mandateDraw` event emitted just before the holder's dawn draw, "You hold the Mandate: draw a card".
- **Glossary.** The Mandate and Sworn are Mechanics rows with their own glyphs (a seal; a laurel). `cardMechanics` detects them from structure (a claim op, a "whenever you claim" trigger, a hold or don't-hold condition; the Sworn condition), so the inspect Keyword Guide and Collection search find them. It also reads a modal spell's modes now, and an ability paid by removing marks teaches Mark rather than Duty.
- **Stones.** A mark-paid ability is offered beside Duties as before, but its confirm and targeting say "Remove a mark" (or "Remove N marks") with the cost written out instead of the tap pip, and its history line reads "Your [Nüwa] removes a mark: …".
- **Modal spells.** Casting one opens a mode chooser (`src/ui/modeChoice.ts`): the card beside a row per mode. "Choose one" casts on the tap; "choose up to N" toggles rows and casts on Cast. A mode with no legal target stays listed, dimmed, saying so. The chooser only narrows the engine's own legal casts; targets follow as for any spell.
- **Sworn in hand.** A card with a Sworn ability carries a chip in its art window's corner: a filled check and "Sworn on", or an open ring and "Sworn off" (`src/ui/swornPresentation.ts`).
- **Achievements (P5).** "Mandate In Foil" and "Rainbow Mandate" are now "Three Lords In Foil" and "Rainbow Lords" (ids unchanged; "In" matches the sibling foil titles).
- **Tests.** `tests/ui/mandateDuel.test.ts` (docking, history, combat routing, the Sworn chip), additions to `tests/engine/mandate.test.ts`, `tests/engine/modal.test.ts` (the chooser), `tests/ui/activatedDuel.test.ts` (stones) and `tests/data/glossary.test.ts`. The dev fixtures `mandate-yours` and `mandate-theirs` put the seal in the rendered a11y probe.
- **Not yet.** The Mandate's tap-to-open rules sheet with this duel's claims (mobile frame N4) and the Duty chip's wording on a stone-only creature.

## Part 9. The lab rates (B5)

### As built (the Mandate and Sworn)

- **The lab.** `scripts/mandate-lab/` and `.github/workflows/mandate-lab.yml`, modelled on the starting-life study. The 29-deck Warchest field is played with four colourless 3/3 lab cards added to each deck, in five arms on the same seeds, Hard on both seats, at 25 life. The arms are: a vanilla control on both sides; the subject's copies one mana cheaper (the conversion unit); "When this arrives, claim the Mandate" against an opponent who can't claim; both decks claiming; and that arm's control. Results go to the `study-data` branch, never `main`.
- **The run.** Run 38020450249, 2026-10-10, 32,480 paired slots (162,400 games), 61 minutes on eight runners. Report: `study-data:mandate-lab/2026-10-10-38020450249/report.md`.

| Reading | Measured | Entered |
| --- | --- | --- |
| One mana (3/3 for 2 over for 3) | 5.49 ± 0.21 pts | the unit |
| Claim on arrival, opponent claims too | 2.83 ± 0.21 pts, 0.52 mana | `claimMandate` op 0.7 (0.52 at the arrival rate) |
| Claim on arrival, opponent can't | 3.12 ± 0.22 pts, 0.57 mana | (the set contests it, so the contested reading is used) |
| Hold share after first claim | 47% contested, 63% not | `youHoldMandate` x0.45 |
| Hold share of all dawns | 23% contested, 27% not | `youDontHoldMandate` x0.75 |
| Takes it a game (claims + steals) | 2.0 contested, 1.45 not | `youClaimMandate` 0.8 |
| Dawns with a legendary creature | 27% over the field, 45-52% in the five legend-rich decks | `swornActive` x0.5 |

- **AI.** `abilityConditionMultiplier` (no board to read) uses the same three gates. `MANDATE_HOLD_VALUE` stays at about two draws, which the lab bears out (a contested claimer holds it on 2.5 of its 11 dawns a game). `MANDATE_COMBAT_VALUE` stays a judgement: the lab prices the claim in mana, not the combat swing.
- **Not yet.** Nüwa's stones (`activated:removeMarks`), Tithe marks (`tithe:marks`) and modal spells (`modal`) are still reported as unpriced. Each is one card's shape rather than a shared rate, so they are measured as their own lab arms when those cards are costed.

## Questions for the owner

- **Q1. When does the default become 25?** **Ruled by the owner 2026-10-09: flip at the reset.** The field lands at 20, the labs and the rescore run at 25 through it, and the default flips together with the one-time floor reset (P8), since every win-rate floor in CI was measured at 20.
- **Q2. Dawn order** (taken as recommended by the set plan): the Mandate's draw comes before the holder's other dawn abilities.
- **Q3. Claim point** (taken as recommended): once per damage batch, after the damage and before combat-damage triggers.
- **Q4. Stone timing** (taken as the default): stones are used at Duty speed, in your own Morning or Afternoon. The alternative is Charm speed (any time you could cast a Charm), which would let Nüwa answer an attack with 3 damage.
- **Q5. Zero modes** (taken as the default): a modal spell needs at least one mode, so "Choose up to two" never casts for nothing. Magic allows zero; nothing here gains from it.
