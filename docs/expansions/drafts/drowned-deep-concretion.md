<!-- source-of-truth: docs/expansions/drafts/drowned-deep-overplan.md, docs/plan-drowned-deep-engine.md, src/engine/types.ts, src/engine/effects/EffectInterpreter.ts, src/engine/effects/targeting.ts, src/data/axes.ts, tests/data/catalog.test.ts · last-verified: 2026-09-15 · decision brief — the concretion step between the locked cut and the data transcription; nothing here is implemented until the owner rules -->

# Drowned Deep concretion: what the engine can print today, and what it cannot

The cut is locked (252 cards, four tokens), the engine core and the AI pass
are on the release branch as PRs #367 and #368, and the art is generated.
Before Codex transcribes the cut into `src/data/cards/drowned-deep.ts`, every
printed line has to be a construct the engine already runs, or the owner has
to choose between extending the engine and rewording the card. This brief
is that decision list. It comes from a read-only audit (Codex, 2026-09-15)
of every clause in the kept rows against the real op, trigger, target and
static vocabulary, with a proof pointer for each finding.

**The count.** 191 of 252 rows map fully today. 24 rows map with a loss
(an existing construct that drops a printed restriction). 39 rows carry a
clause no construct expresses. All four tokens map. No row has a malformed
cost, stats or type line.

The groups below are ordered by how many cards each decision unlocks. Each
carries a recommendation; the owner's ruling goes in section 5.

## 1. Engine extensions worth building (one PR, before the transcription)

These are small, well-bounded additions to the effect vocabulary, each one
unlocking several cards and each the kind of shape every later set will
want. Recommendation: build all of them in one engine PR (wave PR 3a), with
the same contract discipline as PRs #367 and #368, then transcribe.

| Extension | Cards unlocked | Shape |
| --- | ---: | --- |
| **Loot op**: draw N, then the controller chooses N cards to discard | 8 | A `discard { n, who: 'self' }` op with a deferred hand choice, the Merfolk Looter shape the brief assumed the engine could print (six looters are the set's discard outlets for Whispers). The choice is a pending decision of the existing look-and-choose family, resolved under the controller's context; the AI's policy is "discard the highest-cost uncastable card, then a land past the curve". |
| **Allied-death observer**: `when: 'allyDies'` with `other` and `subtype` filters | 8 | Covers "whenever a (another) creature you control dies" (Widow's Walk, Low-Tide Grave, Widow of the Reach, Marsh Widow, Marsh-Born Horror), the Horror-filtered form (What the Nets Remember) and "whenever you sacrifice a creature" (The Horror Garden: a sacrifice is an allied death, which is the reading the engine already takes for Rite). Fires in battlefield order after the batched deaths, like `dies` today. |
| **Cost-cap and attack-cap target qualifiers**: `maxCost`, `minAttack` on `TargetSpec` | 12 | The ten cost-capped removal, bounce, cancel and reclaim effects and the two attack-capped ones. The scorer already prices these at 0.75x and 0.8x; without the qualifier the cards are strictly stronger than costed. |
| **Opponent-creature target kind**: `opponentCreature` | 4 | The Lightkeeper, Gate-Warden, Tide-Gate and Thing in the Cistern tap or bounce "target creature an opponent controls". `yourCreature` exists; this is its mirror. |
| **Mass tap op**: `tapAll { who: 'opponent' }` | 3 | The Lightkeeper's Oath, Vigil Bell, Salt Fog. Target-free, the existing `tap` case over a filtered list. The scorer still owes this a rate (NEEDS MATH in the balance pass). |
| **Sunset trigger and the died-this-turn condition**: `when: 'sunset'`, condition `creatureDiedThisTurn` | 1 | The False Beacon, reworded to Sunset at the owner's request; the Sunset step already exists in the phase model, so this is a dispatch site plus a per-turn flag cleared at Dawn. |
| **Allied-attack observer**: generalise `markedAllyAttacks` to `allyAttacks` | 1 | Storm Front (the common). The marked form exists; drop the mark filter behind a flag. |
| **Charm-cast observer**: `when: 'youCastCharm'` | 1 | The Bell Below. One emit site in `castSpell`. |
| **Token filter on statics**: `filter.token: true` | 3 | Kelp Cathedral, Marsh Road, Kelp-Shade Elder buff Plant tokens only; without it they buff the set's Plant creatures too. |
| **`other` on `markAll`, opponent scope on `damage eachCreature`, `boost scope: 'self'`** | 3 | The Reef That Walks (mark each other creature), Fire on the Point (each creature an opponent controls), Breakwater Brawler (this gets +1/+0 when it attacks). Three one-line scope additions. |
| **Rite with targets** | 4 | Rite of the False Beacon, the Salt Gate, the Wreckers, the Lamp-Fire all target a creature. The Rite validator refuses targets today because the first Rite cards had none, not for an engine reason: targets are chosen at cast, the sacrifice is paid before the stack, and nothing in resolution depends on the order. Lift the validator rule and cover it in `ritePolicy`. |
| **Empower may destroy** | 1 | The Drowned Saint's Empower rider destroys a (cost-capped) creature; the Empower validator allows targeted `moveMark` and `reclaim` only. Add `destroy` to its allowlist. |
| **`reclaimSelf`**: a dies-trigger op returning the source's own card to hand | 1 | The Drowned Bride. `reclaim` needs a chosen graveyard target; a self form binds the dead source. |
| **`createToken` with marks** | 1 | Net Full of Stars creates a Kelp Shade with a Mark; `createToken { marks: 1 }` sets the counter on the new permanent. |
| **`raise` with a keyword grant** | 1 | Salt-Marsh Bargain returns a creature to the battlefield "with Dreaded"; `raise { grantKeywords }` applied to the raised permanent as a durable grant. |
| **Condition `controlsOther { subtype }`** | 1 | Mother Hydra's Dawn drain fires only with another Horror; the condition family already covers Quest and Mark checks. |

Blast radius for the PR: the AI's trigger assumptions (`docs/ai.md` and the
brains' trigger valuation read `TriggerWhen`), the converter's target walk
for the new qualifiers, `docs/adding-cards.md` for every new op and
qualifier, `gen-docs-tables --check`, and the power formula's trigger table
(the new observers get rates from the Dawn and Dies anchors before the
Assay rescore). Replay version: the loot decision adds a pending-decision
shape the log records, so v14 if the decision is logged, else none; the
contract decides with the replay ladder in hand.

## 2. The one-card shapes: also built, not reworded (owner ruling DC2, 2026-09-15)

The recommendation here was to reword these ten cards rather than extend
the engine for one card each. **The owner ruled the other way: "we need a
picker for this, expand scope."** Every row below is therefore an engine
feature in wave PR 3a, and the printed line stands. The proposed rewords
stay in the table as the record of what was considered.

| Card | Printed (stands) | Engine need |
| --- | --- | --- |
| Saint of the Lamp Oil | "Whenever you gain life, put a Mark on this." | `when: 'youGainLife'` observer. |
| The Glass That Came Back | "Duty: Foresee 2. Duty, {2}: draw a card." | Multiple activated abilities per card (`activated` becomes a list); the duel UI and the AI choose which Duty. |
| Wrecker Queen | "Whenever this attacks, damage target creature 1." | Targeted attack trigger: the controller chooses the target when the trigger fires, through the same deferred-target path arrival triggers use. |
| Marsh Gate | "During your Dawn: put a Mark on target creature you control." | Targeted Dawn trigger, same path. |
| The Marsh Remembers | "Return target creature card from your graveyard to your hand. Put a Mark on target creature you control." | Per-op target binding on a spell (two independent target specs, two choices). |
| Reach-Fire Witch | "Arrives: damage target creature 2. Retell {2}{R}: damage target creature 2." | Retell on a creature with an ops override: the graveyard cast resolves the override only and severs the card, never putting the creature on the battlefield. |
| Drowned Chapel Bell | "Tap two target creatures." | An exact target count (`exactly: 2`) beside `upTo`. |
| Harbour Vigil | "Prevent combat damage to target creature this turn." | Targeted combat-damage prevention op. |
| Due to the Deep, Marsh-Lamp Lure | "Opponent sacrifices a creature." | An edict: the opponent chooses, through a pending decision for the non-acting seat; the human uses the sacrifice picker from PR #368, the AI a sacrifice policy (feed the cheapest, protect the best body). |
| Reckoning Below | "Each player sacrifices a creature." | The same edict for both seats in turn order, the caster first. |

The rewords considered, for the record:

| Card | Printed | Proposed | Note |
| --- | --- | --- | --- |
| Saint of the Lamp Oil (`dd-lamp-oil-saint`) | "Whenever you gain life, put a Mark on this." | "Duty, {1}: gain 2 life and put a Mark on this." | The trigger only ever fired off her own Duty in practice; folding it in keeps the growth and drops the lifegain observer, which no other card needs. Delta moves up slightly (the scorer priced the trigger as a proxy). |
| The Glass That Came Back (`dd-glass-that-came-back`) | "Duty: Foresee 2. Duty, {2}: draw a card." | "Duty, {1}: Foresee 1, then draw a card." | `CardDef.activated` is singular; two Duties would need an ability selector in the duel UI and the AI. One paid Duty keeps the tide-glass reading. |
| Wrecker Queen (`dd-wrecker-queen`) | "Whenever this attacks, damage target creature 1." | "Whenever this attacks, damage each creature an opponent controls 1." | Attack triggers do not target (only arrivals do, the 1.7 ruling); the sweep-of-one reads as the wreckers' fire. Slightly stronger; rescore. |
| Marsh Gate (`dd-marsh-gate`) | "During your Dawn: put a Mark on target creature you control." | "During your Dawn: put a Mark on this." | Dawn triggers do not target; the Gate marking itself makes it a Mark payoff enabler in its own right. Weaker; rescore, or cut (it is a common flex row). |
| The Marsh Remembers (`dd-the-marsh-remembers`) | "Return target creature card from your graveyard to your hand. Put a Mark on target creature you control." | "Return target creature card from your graveyard to your hand, then put a Mark on it when it arrives." is not expressible either; use "Return target creature card from your graveyard to your hand. Put a Mark on each creature you control with a Mark." | Two independent targets on one spell need per-op target binding. The Propagate form keeps two green themes on one card. Rescore. |
| Reach-Fire Witch (`dd-reach-fire-witch`) | "Arrives: damage target creature 2. Retell {2}{R}: damage target creature 2." | "Arrives: damage target creature 2. Whispers {2}{R}." | Retell is Rituals and Charms only; a red Whispers creature is on-pie and the second cast still arrives with the burn. Rescore. |
| Drowned Chapel Bell (`dd-drowned-chapel-bell`) | "Tap two target creatures." | "Tap up to two target creatures." | `upTo: 2` is the engine's shape; strictly better for the caster by a hair, no rescore needed. |
| Harbour Vigil (`dd-harbour-vigil`) | "Prevent combat damage to target creature this turn." | "Target creature gets +0/+3 until end of turn." | Targeted prevention is a new op for one common; the toughness trick is the same play in the common slot. Rescore. |
| Due to the Deep (`dd-tithe-to-the-deep`), Marsh-Lamp Lure (`dd-marsh-lamp-lure`) | "Opponent sacrifices a creature." | "Opponent sacrifices their creature with the lowest Defense (the oldest on a tie)." | An edict needs the opponent to choose, which is a new pending decision for the other seat and a new AI branch; the deterministic form is the engine's `massDestroy` family with a filter and needs no choice. The edict rate in the scorer (0.8x) stays. |
| Reckoning Below (`dd-reckoning-below`) | "Each player sacrifices a creature." | "Each player sacrifices their creature with the lowest Defense." | Same reasoning, symmetric. |

## 3. Rulings only the owner can make

1. **Five multicolour cards are not legendary** and the catalog rule requires it: The Lightkeeper's Oath (W/U Ritual), Watch and Tide (W/U Charm), The Horror Garden (B/G Enchantment), Drowned Deacon and Marsh-Mother Horror (U/B and B/G Deep One Horrors). Options: make the two Horrors legendary (they read as named figures), and grant the three spells the explicit non-legendary exception the rule already lists for Starborne's multicolour spells. Recommendation: exactly that.
2. **Warden and Plant as Axes.** Two statics filter on Warden (Captain of the Salt Stair, The Bell That Will Not Ring) and three on Plant tokens (the Kelp cards), and the catalog requires every static subtype filter to name an Axis. Horror is already ruled an Axis (brief §5). Options: rule Warden an Axis (the Lantern Watch is the set's white tribe; the Captain is its one lord), and either rule Plant an Axis or keep the Kelp payoffs on the token filter from section 1, which needs no Axis because it filters tokens, not the subtype. Recommendation: Warden becomes an Axis; Plant does not, and the three Kelp cards use the token filter.
3. **The Drowned token's name.** The overplan's token table calls it "The Drowned"; both minting cards print "Drowned Spirit", the art bible entry is `tok-drowned-spirit`. Recommendation: Drowned Spirit.
4. **The loot decision in the replay log.** If the loot op's discard choice is recorded (as Foresee's is), the log version moves to 14; if the choice is derived deterministically for replays it does not. Recommendation: record it, v14, mapped to rules revision 4.

## 4. What the transcription then needs, mechanically

- `'drowned-deep'` in the `CardDef.set` union (`src/engine/types.ts`), the set module `src/data/cards/drowned-deep.ts` in the art bible's order (rarity, then colour, the order `check-art-bible` will enforce), its registration in `src/data/catalog.ts` and the `dd-` prefix in `tests/data/catalog.test.ts`, the four tokens in `src/data/cards/tokens.ts` (`tok-deep-spawn`, `tok-drowned-spirit`, `tok-lantern-wisp`, `tok-kelp-shade`), `SET_IDS`, the title and the blurb in `src/data/setTitles.ts`, Horror (and Warden, if ruled) in `src/data/axes.ts` with the `plan-tribal-pass.md` record.
- New subtype strings: `Horror` and `Deep One` (as one string). Every other subtype in the cut already exists.
- "You lose N life" transcribes as damage to the controller, the Duat convention; the generated line will read as damage to you.
- The per-set catalog tests the brief asks for: Tithe only on Horrors, every Horror carries Tithe, Rite never on a Horror and only in white and red, Whispers never beside Retell, the token-minter floor, the near-vanilla ceiling.
- The retail wiring (shop SKU, `DROWNED_DEEP_PACK_ART`, the pack front already on disk) and the art-bible token entries moving into `constructs-and-tokens.md`.

## 5. Owner rulings

- DC1 Section 1 extensions. **RULED 2026-09-15: build all of it.**
- DC2 Section 2. **RULED 2026-09-15: no rewords; build the pickers and the shapes, expand scope.** Every section-2 row is an engine feature in PR 3a.
- DC3 Multicolour legendary status. **RULED 2026-09-15: approved.** Drowned Deacon and Marsh-Mother Horror become legendary; The Lightkeeper's Oath, Watch and Tide and The Horror Garden take the listed non-legendary exception.
- DC4 Axes. **RULED 2026-09-15: approved to adjust.** Warden becomes an Axis (recorded in `plan-tribal-pass.md` and `src/data/axes.ts` with Horror); Plant does not, and the three Kelp anthems use the token filter.
- DC5 Token name. **RULED 2026-09-15: Drowned Spirit** (`tok-drowned-spirit`).
- DC6 Loot choice in the replay log. **RULED 2026-09-15: approved.** The loot discard and the edict sacrifice choices are recorded; the log moves to v14 at rules revision 4.

Sequencing after the rulings: wave PR 3a (the engine vocabulary of sections 1
and 2 with its AI policies, Codex), PR 3a-ui (the duel pickers: loot discard,
edict sacrifice, Duty selector, deferred trigger targets, Codex), the Assay
rates for the new triggers, wave PR 3b (the transcription, Codex),
then the browser checks of the Whispers rows and the sacrifice picker on
real cards, the converter run for the two boss decks, and the terms check
for blades-db.
