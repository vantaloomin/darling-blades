<!-- source-of-truth: docs/roadmap.md, docs/plan-expansion-slate.md, docs/rules.md, docs/architecture.md, docs/ai.md, docs/plan-darlings.md, src/engine/types.ts, src/engine/Game.ts, src/engine/phases.ts, src/engine/combat/damage.ts, src/engine/effects/EffectInterpreter.ts, src/engine/events.ts, src/engine/view.ts, src/data/cardTypes.ts, src/data/catalog.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, scripts/balance-matrix.ts, scripts/personas/craft.ts, scripts/progression-sim.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Core Set II, The Mandate, and Oath implementation plan

## Goal

Release 2.0 ships Core Set II as the anniversary return to the Three Kingdoms and Greek base rosters, with a measured roster-growth process and two coherent hooks: The Mandate as a public contested advantage, and Oath as legendary-led formation synergy that composes naturally with Darlings. The set follows original naming, engine-first mechanics, AI-pilotable decisions, full data/tooling coverage, and dated balance/progression evidence before product quantities are locked.

## Non-goals

This plan does not invent a card count, rarity split, booster price, precon count, rival roster, story, or final card list before the coverage and economy work exists. The Mandate is not a second life total, a card type, a permanent, or a hidden object. Oath does not create an outside-the-deck Darling zone or guaranteed access to a selected legend. Core Set II does not rewrite older Three Kingdoms/Greek cards merely to make new mechanics prevalent.

## Player-facing spec

Core Set II appears as its own anniversary set while returning to familiar Three Kingdoms and Greek characters, factions, rivalries, and visual language. New names and rules use Darling Blades vocabulary and do not expose borrowed game terminology.

The Mandate rules reminder:

> The Mandate begins unclaimed. At your dawn, if you hold it, draw a card. When your creatures deal combat damage to the player who holds it, you claim it.

The battlefield shows one public Mandate marker beside its holder. A claim animation and history line fire once per combat-damage batch, even if several creatures connect. Spell damage does not claim it. If no player holds it, combat damage alone does nothing; a card must claim it first. A card may say `Claim The Mandate`, which gives it to that card's controller.

Recommended Oath reminder:

> Oath is active while you control a legendary creature.

Oath abilities use existing trigger/static wording plus that public condition, for example `Oath: At your dawn, put a mark on another creature you control.` A Darlings deck always includes a selected legendary creature in its shuffled 80 cards and uses a 10-land Warchest, so Oath has a clear build-around anchor without changing what happens when that card is drawn, defeated, returned, or Severed. Ordinary Constructed can enable Oath with any legendary creature. Updated for the Warchest reveal 2026-07-31.

Pack, collection, deck-builder, rules glossary, and card-detail surfaces explain both hooks before purchase or deck entry. The Mandate marker never covers life, priority, stack, or a Darling portrait. Oath cards show whether the condition is currently active through icon plus text, not color alone.

## System touchpoints

### Engine

The Mandate adds public state:

```ts
interface GameState {
  // existing fields
  mandateHolder: PlayerId | null;
}
```

`Game` initializes it to `null`. `src/engine/view.ts` includes it in every `PlayerView`; future `SpectatorView` includes it too. Add an effect op `{ op: 'claimMandate' }` resolved to the source controller, and an event:

```ts
{ e: 'mandateChanged'; from: PlayerId | null; to: PlayerId; reason: 'effect' | 'combat' }
```

Changing to the current holder is a no-op and emits nothing. It consumes no RNG and creates no target or response window.

Turn ordering is explicit. After untap enters `dawn`, before iterating permanent dawn triggers, if the active player holds The Mandate, draw one card through `drawCards`. Deck-out can end the game at that point. Then ordinary dawn triggers resolve in battlefield order, including queued Foresee decisions; after they finish, the normal turn draw occurs, with the existing starting-player turn-one skip unchanged. This order avoids a resumable global trigger and is covered by a golden event test.

Combat ordering is explicit. In each first-strike or normal simultaneous damage batch, apply all life/permanent damage and Blood Oath life gain first. If one or more positive-damage hits struck the player who held The Mandate at the start of that batch, the attacking player's claim occurs exactly once after those applications and before per-source `combatDamageToPlayer` triggers. State-based actions retain their existing caller-defined point. A normal-damage batch does not emit a second claim when the attacker already took it during first-strike damage. Fog or zero damage never claims.

Recommended Oath engine support extends `AbilityDef.condition` and `StaticDef.condition` with `'oathActive'`. The pure predicate is true when the source controller currently controls at least one permanent whose `CardDef.supertypes` contains `legendary`. It reads only public battlefield data, needs no new GameState, and works uniformly in Constructed, Darlings, AI simulations, replay, and multiplayer. Condition checks use one shared helper alongside `questActive`; no interpreter branch hardcodes card IDs.

### Meta, save, and economy

Choose and register a distinct set key, recommended `core-set-2`, in the canonical `CardDef.set` union and product/filter definitions. Add card arrays under an explicit split such as `src/data/cards/core2-three-kingdoms.ts` and `core2-greek.ts`, then assemble them in `src/data/catalog.ts`. Final filenames can follow data-module conventions, but IDs become permanent once released.

Booster contents, gold price, duplicate/shard behavior, achievements, starter/precon access, and rival rewards are not inherited by analogy. They are authored through current economy/data services and measured in progression simulation. No set-specific executable loader belongs in the engine.

Darlings legality already recognizes legendary supertypes. Core Set II's roster ledger marks eligible Darlings, color coverage, Oath support, Mandate claimers/payoffs, curve, card type, interaction role, AI complexity, and art status. Selected Darling identity remains SavedDeck metadata outside the duel under the recommended generic Oath definition.

### AI

All brains need public `mandateHolder` valuation. Easy may remain mostly random/legal. Medium needs a small explicit bonus for claiming/retaining the Mandate, must recognize face attacks that steal it, and must value claim ops. Hard determinization clones the public holder exactly and includes expected extra-card value in search evaluation without inspecting hidden order. Attack heuristics compare the public draw advantage against lethal, profitable trades, and defense; they do not always attack blindly.

Oath requires the evaluator to price conditional text by current public legendary presence and plausible loss of that enabler. Legal action generation already enforces conditions through engine helpers. The persona craft scorer must recognize both hooks through structural fields or measured game outcomes, never hardcoded card IDs. Every new decision or target shape must be demonstrably pilotable before card volume grows.

### UI scenes

`src/scenes/DuelScene.ts` renders the shared Mandate marker, claim event, history line, Oath active state, and card reminders from public view/events. Collection, Deck Builder, Pack Opening, Shop, Glossary, and CardView gain set/mechanic presentation through shared helpers. Darlings surfaces show Oath synergy without implying the Darling starts in hand. Compact layout and redundant cue behavior follow the mobile/accessibility plans.

### Tooling and invariants

Add engine golden tests for initial state, effect claim, dawn ordering, starting-player draw, deck-out, first-strike/normal batches, multiple attackers, Fog, zero damage, already-holder no-op, lethal damage, triggers observing the new holder, clone/replay, and redacted/public views. Add Oath tests for no legend, friendly legend, opponent legend only, source leaving, multiple legends, static and triggered abilities, and normal/Darlings setup equivalence.

Extend art-bible generation/checking, catalog uniqueness, rules text/glossary, docs tables, deck legality, opponent schema, pack odds, and replay database-stamp coverage. Pure layers remain Phaser/browser-free, AI reads only `PlayerView`, tests do not import Phaser, RNG remains seeded, SaveData changes migrate if any, and gates only ratchet upward.

## Save-schema impact

No SaveData field and no schema bump are required for the recommended mechanics/set integration. `mandateHolder` is transient `GameState`, not profile state. `oathActive` derives from public battlefield data. Collection maps already accept new stable card IDs, and Darlings already stores its selected card through `docs/plan-darlings.md`. Migration sketch: `none`.

Observable engine behavior requires review of `REPLAY_LOG_VERSION`; bump it when logs containing Mandate actions/events can no longer be faithfully interpreted by the prior engine. Update database stamps and golden fixtures accordingly.

If the user chooses strict `your Darling` Oath instead of generic legendary control, add public `darlingIds: [string | null, string | null]` to `GameInit`, `GameState`, `PlayerView`, multiplayer snapshots, and ReplayLog context. SaveData already has `SavedDeck.darlingId`; no additional profile field is needed. That alternative needs its own engine/replay/network spike before card authoring.

## AI and balance impact

Start from the dated current baselines only; do not invent Core Set II targets. The roster process is:

1. Freeze a machine-readable coverage snapshot of the existing Three Kingdoms and Greek rosters: colors, costs, card types, creature sizes, interaction, card advantage, legends, mechanics, AI complexity, Darlings identities, and art/product coverage.
2. Ask the user to approve desired roster size, faction emphasis, rarity/product shape, and the gaps Core Set II is meant to close.
3. Implement The Mandate and Oath with synthetic test cards before authoring collectible cards.
4. Author small batches, each with rules tests, AI valuation review, original naming/editorial review, and art-bible entries.
5. Build precons/opponents only from stable batches. Measure current field, Core Set II mirrors, Darlings, and generated metagame diversity.
6. Run progression with the actual product/reward configuration and iterate data, not untracked exceptions.

Commands:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/balance-matrix.ts --prefabs --ai hard --seeds 300
npx tsx scripts/personas/craft.ts --metagame --all --pool all --field prefabs --seeds 150 --iterations 80 --rounds 4 --workers 8
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

Add `npx tsx scripts/balance-matrix.ts --core-set-2 --seeds <N>` and a Darlings field once lists exist. All set, mechanic, matchup, first-player, turn-length, Mandate-hold/transfer, Oath-active, pack, collection, and economy outcomes are `TO MEASURE`. The metagame sweep is measured 4.61x faster at 14 workers, but remains informational until its produced field is reviewed and promoted. Existing gates may rise from fresh retained evidence and never fall.

## Phased implementation plan

### Wave 1: decisions, roster ledger, and synthetic mechanics

Lock set identity/size direction and Oath semantics, produce the base-roster coverage ledger, implement The Mandate and Oath using noncollectible test fixtures, and bump replay contracts as needed. Verification: focused engine ordering/redaction/clone tests, AI synthetic scenarios, replay golden tests, full Vitest, build, lint, docs.

### Wave 2: first playable card batch

Author a small cross-roster batch covering claimers, Mandate interaction, Oath enablers/payoffs, ordinary glue, and answers. Add rules text, glossary, AI valuation, art-bible specs, and a development-only test deck pair. Verification: per-card engine tests, AI legal/pilot tests, catalog/art/doc checkers, targeted seed matrix with `TO MEASURE` report, full Vitest, build, lint.

### Wave 3: full roster and products

Complete the approved coverage ledger, art, boosters, shop, filters, precons, opponents, Darlings support, and product/reward data. Verification: uniqueness/schema/art/docs checks, full prefab/avatar/floor/Core-Set-II/Darlings matrices, informational metagame sweep, progression control/candidate runs, replay/share/network compatibility, full Vitest, build, lint.

### Wave 4: anniversary release lock

Freeze IDs/text/rarities/product odds, close measured balance/economy debts, run editorial/originality/accessibility/mobile/localization scope, and publish dated baselines. Verification: full ladder, reproducible artifacts with exact commands and game counts, fresh/migrated save journeys, pack/collection/deck/Darlings/duel/replay/multiplayer human passes, docs zero-warning checks.

## Open decisions for the user

- **Oath semantics:** active while controlling any legendary creature, active only while controlling the selected Darling, or Darlings-only cards. **Recommendation:** any legendary creature; it composes cleanly, stays playable in Constructed, and needs no format identity in GameState.
- **Set identity:** new `core-set-2` product/set key or append cards to the base set. **Recommendation:** new key for odds, filters, art, saves, and anniversary communication, while using the original rosters.
- **Roster size and split:** choose total size and Three Kingdoms/Greek allocation after the coverage ledger. **Recommendation:** fill measured role/color gaps first, then approve a count; do not start from a marketing number.
- **Roster emphasis:** equal return, Three Kingdoms-led Mandate focus, or Greek-led parallel focus. **Recommendation:** Three Kingdoms leads The Mandate, while Greek cards receive equally coherent Oath/legendary and ordinary support rather than a pasted crown theme.
- **The Mandate timing:** recommended dawn draw before permanent dawn triggers, or after all dawn triggers. **Recommendation:** before permanent dawn triggers for a simple deterministic sequence with no pending-choice resume state.
- **Product scope:** boosters only, boosters plus precons, or full anniversary bundle with rivals/cosmetics. **Recommendation:** boosters plus a small measured precon/rival set; add cosmetics only if art capacity is confirmed.
- **Darlings packaging:** sell dedicated Darlings precons, provide suggested lists, or rely on deck building. **Recommendation:** use Suggested Decks plus a small curated showcase, avoiding duplicate product complexity until the format baseline exists.

## Risks and dependencies

The Mandate is simple state but touches dawn, simultaneous combat, first strike, events, views, AI search, replay, multiplayer, and UI. A wrong ordering will create subtle trigger or deck-out drift. Generic Oath is mechanically safe but may feel less personal than `your Darling`; strict Oath creates cross-format GameState and protocol scope. Roster nostalgia can produce redundant cards unless the coverage ledger leads authoring.

This plan explicitly depends on Darlings semantics in `docs/plan-darlings.md`, Tutor/Coach integration in `docs/plan-suggested-decks.md`, replay versions in `docs/plan-player-replays.md`, multiplayer projections in `docs/plan-multiplayer.md`, mobile layouts, accessibility/localization, save portability, the settled 1.5 power baseline, and the live mod whitelist status in `docs/plan-mod-ugc.md`. Core Set II must not land while any dependency assumes a different card-instance, replay, or protocol representation.

## Acceptance criteria

- The Mandate starts unclaimed, effect claims and combat claims follow the exact specified order, its dawn draw is deterministic, and every edge case has a golden engine event test.
- The public holder is identical in GameState projections, Duel UI, replay, and approved multiplayer recipient views, with no hidden-state leak.
- Oath uses one shared public predicate, works for static and triggered abilities, and follows the recorded user semantic decision.
- AI recognizes claim, retention, and Oath state through `PlayerView`; it never reads full decks/hands and has no hardcoded Core Set II card-ID strategy.
- The final roster maps every new card to an approved coverage need, engine test status, AI-pilotability review, original-name review, art status, and product role.
- Set size, products, odds, rewards, and balance/economy targets replace all `TO MEASURE`/open values with dated commands and artifacts.
- Existing avatar/floor gates pass without lowering; new retained floors only ratchet upward.
- Save, replay, Darlings, Tutor, mobile, accessibility, mod validation, and multiplayer compatibility are verified before the 2.0 lock.
