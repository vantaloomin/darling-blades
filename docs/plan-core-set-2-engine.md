<!-- source-of-truth: docs/plan-2.0.md, docs/plan-core-set-2.md, src/engine/mandate.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/effects/EffectInterpreter.ts, src/engine/types.ts, src/engine/events.ts, src/engine/view.ts, src/engine/Game.ts, src/ai/determinize.ts, src/meta/Replay.ts, src/power/scoreCore.ts · last-verified: 2026-10-10 · engine spec, DRAFT: lane B1 of plan-2.0; the parts marked "as built" are on release/2.0, the rest is proposed; re-verify when the owner rules a question below or the overplan's cut changes -->

# Core Set II engine spec: the Mandate, Sworn, and what the cards need (2.0 lane B)

**Status: DRAFT, building.** This is lane B's spec ([plan-2.0.md](plan-2.0.md), B1) and the home of its "as built" notes. The Mandate's rules and Sworn's semantic are already ruled ([plan-core-set-2.md](plan-core-set-2.md), "Engine"; P5, P6, P16). Where that plan left a timing call open, the build takes its recommendation and says so below; each such call is listed under [Questions](#questions-for-the-owner) so the owner can overturn it at the engine sitting.

Build order (the 2.0 plan's shared-file order: the Mandate first in `types.ts` and `Game.ts`, then the life change):

1. The Mandate core. **As built (B2.1).**
2. The starting-life field, sharing the train's one replay bump. **As built (D3a).**
3. Sworn, and the crownless flag for the Sworn Champions. **As built (B2.2).**
4. The Mandate's card wording: "while you hold the Mandate", "if you don't hold the Mandate", "whenever you claim the Mandate".
5. Small constructs the overplan names: an arrival trigger filtered by subtype (Yutu, Jiuwei, Lanlan); "if you gained life this turn" (Hebe); a token created for a target's controller (Circe's Pig).
6. Larger constructs: a modal "choose up to N" (Nüwa, ruled into the engine 2026-10-08); removing a mark as an activation cost, without a tap (Nüwa); Tithe on a Darling cast (ruled 2026-10-08: it reduces the base cost, never the Darling tax).
7. The AI reads (B3), the duel UI (B4), the lab rates (B5).

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

## Parts 4 to 6 (to be specified as they are built)

**A design point for Part 4.** "While you hold the Mandate" appears on statics (Jia Nanfeng's Warcry, the Dragon Banner's +1/+0, Themis's +0/+1). Statics are computed by `getEffectiveStats(battlefield, db, iid)`, which sees only the battlefield, and the holder lives on the game state. The plan is to widen its first parameter to accept a board (`{ battlefield, mandateHolder? }`, which both `GameState` and `PlayerView` already are) and move every engine call to pass the state, so the rules can never see a different holder from the one in play. Triggered "while you hold" and "if you don't hold" checks need no such change: they read the state when they fire.

## Questions for the owner

- **Q1. When does the default become 25?** Every win-rate floor in CI was measured at 20. Recommended: the field lands now at 20, the labs and the rescore run at 25 through it, and the default flips together with the one-time floor reset (P8).
- **Q2. Dawn order** (taken as recommended by the set plan): the Mandate's draw comes before the holder's other dawn abilities.
- **Q3. Claim point** (taken as recommended): once per damage batch, after the damage and before combat-damage triggers.
