<!-- source-of-truth: src/engine/types.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/mana.ts, src/engine/statics.ts, src/engine/combat/legality.ts, src/engine/view.ts, src/meta/Replay.ts, src/config/rules.ts, src/ai/HardAI.ts, src/ai/MediumAI.ts, src/ai/EasyAI.ts, scripts/avatarReserveDecks.ts, docs/plan-1.8.md, docs/plan-road-to-2.0.md, docs/rules.md · last-verified: 2026-09-07 · engine spec — the 1.8 engine feature, awaiting owner rulings D2a-D2f; re-verify when the wave lands -->

# Activated abilities with tap costs

The 1.8 engine feature, specified for implementation. The spine fixed it on
2026-08-24 as **set-agnostic**: a capability every later set draws on (Brass
Court's Union rigs and contraptions wait on it), not a Drowned Deep mechanic.
It also unlocks the artifact design space the slate records as blocked, since
artifacts carry no targeted or activated abilities today.

**Status 2026-09-07: spec draft, awaiting owner rulings (section 8). No code.**
The implementation is Codex's under contract, the main session owns git, and
everything lands by PR into `release/1.8`.

The one-line design: **a permanent may tap itself, and optionally pay mana, to
run effect ops with inline targets, off-stack, during its controller's own
Morning or Afternoon.** It is the fifth activation seam in the engine, built
on the four that exist (Preserve, Skim, Hauntlink, Empower), and it adds **no
new `Awaiting` kind**, which is the property that keeps the DuelScene switch
trap from 1.7.2 out of the wave.

## 1. Player-facing rules

- A permanent with a tap ability shows it as its own rules line. Proposed
  template (owner ruling D2f, copy is taste-sensitive): `Tap: <effect>.` when
  the cost is the tap alone, and `Tap, {1}: <effect>.` when mana is also paid,
  with the mana rendered as pips the way costs render everywhere else.
- The controller may use it during their own Morning or Afternoon, when
  nothing is on the stack, the same timing as Preserve. It is not a Charm: it
  never opens a response window and cannot be used in one.
- The permanent must be untapped, and it must not have arrived this turn
  unless it has Warcry. This is the rule mana creatures already follow, and
  the rule the engine already applies to every permanent, artifacts included.
- Using it taps the permanent. It untaps at its controller's next Dawn with
  everything else. There is no untap effect in the game, so one use per turn
  is the natural limit and no "once per turn" text is needed.
- If the ability targets, the target is chosen as the ability is used, and
  the ability is only offered when a legal target exists. Because it resolves
  immediately there is no fizzle case.
- Glossary entry (new taught term, name for owner ruling D2f; working name
  **Tap ability**): "Tap this permanent, and pay any listed cost, during your
  Morning or Afternoon to use the ability. A permanent cannot tap the turn it
  arrives unless it has Warcry."

Interactions, all following from the rules above and worth stating so no card
author is surprised:

- **Sentinel**: attacking does not tap it, so a Sentinel creature can attack
  in Combat and use its tap ability in the Afternoon. Vigilance-plus-tap is a
  real synergy in MTG and is intended here.
- **Rage**: a Rage creature tapped for its ability in the Morning is no
  longer an eligible attacker, so it is not compelled. Tapping to dodge Rage is
  legal, exactly as in MTG, and is a deliberate design lever for Rage bodies.
- **Bulwark**: cannot attack, can activate. Bulwark bodies are the natural
  carriers of creature tap abilities.
- **The `tap` op and `TargetSpec.tapped`**: an opponent tapping your
  permanent turns its ability off for the turn, and "Sever target tapped
  creature" now has a second way to find a target. Both are the interaction
  the vocabulary already implies.
- **Hauntlink**: a linked host may be tapped; linking does not care.
  A Hauntlink permanent itself may not carry a tap ability (section 2).
- **Preserve**: a preserved token copy carries the ability, arrives
  summoning-sick, and can use it from the next turn.
- **Nine Lives**: the returned body arrives sick like any arrival.
- **Darlings**: a Darling in the active zone is a permanent like any other.

## 2. Data model (src/engine/types.ts)

All additive; no existing field changes meaning.

```ts
/** A tap-cost activated ability. v1: at most one per card. */
export interface ActivatedDef {
  /** The tap is always part of the cost; mana is optional. */
  cost: { tap: true; mana?: ManaCost };
  /** Run immediately, in order, with the source as context (`to: 'self'` is legal). */
  ops: EffectOp[];
  /** Inline targets, chosen as the ability is used; same specs spells use. */
  targets?: TargetSpec[];
}

interface CardDef {
  // ...
  activated?: ActivatedDef;
}
```

`validateActivatedDef(d)`, in the `validateXDef` family, enforces:

- Legal on **creatures, artifacts and enchantments**. Illegal on lands: the
  Warchest reserve accepts only basics and duals (`isAllowedReserveLand`,
  owner ruling 2026-08-25), so a land with an ability could never be played,
  and the validator says so rather than letting a dead card into the pool.
- Illegal in combination with `hauntlink` (that permanent already owns a
  battlefield action and its tile's click path) and with `manaAbility` (the
  auto-tap solver would spend the permanent on mana; a permanent is either a
  mana source or an ability source in v1).
- Legal with Empower, Rite, Retell, Skim, Preserve, chapters and every
  keyword. A Quest with a tap ability is legal but no shipping card should
  print one without a reason.
- `ops` may not contain another activation-shaped cost and may not be empty.
  Targets follow the spell rules (`validateTargetList`); the `other`, `upTo`,
  `marked` and `tapped` qualifiers all compose.

Speed is **not** a field in v1. Every ability is main-phase. A `speed:
'charm'` flag is the obvious later extension and is listed in section 9 with
what it would cost, so v1 does not pre-pay for it.

## 3. Engine semantics

**Action** (`src/engine/actions.ts`, `Action` union):

```ts
| { type: 'activate'; iid: string; targets?: TargetRef[]; manaPlan?: ManaPlan }
```

Targets are inline, the Hauntlink `hostIid` model generalised to the spell
target machinery: `pushActivatedActions` enumerates one action per legal
target list via `targetListsForCast` and the existing `enumerateTargets`,
exactly as `pushCastActions` does. **No `pendingDecisions` entry, no
`chooseTarget`, no new `Awaiting` kind.** That is a deliberate choice, not a
shortcut: every decision point the engine adds is a `switch` site in three AI
brains, the tutorial, the script AI and four places in DuelScene, and the
1.7.2 hardlock was a missed one.

**Where it is legal**: `case 'main'` only, gated `state.activePlayer ===
player` and an empty stack, next to `preserveCard`. It is not pushed in
`respond`, `endStepWindow` or `hauntlinkWindow`.

**Legality** lives in one helper, `canActivate(battlefield, db, perm,
player)` beside `canAttack` in `src/engine/combat/legality.ts` (or a sibling
module if the import direction is wrong): the permanent is on the
battlefield, controlled by `player`, carries `activated`, is not `tapped`, and
is not `isSummoningSick` (which already means "entered this turn and lacks
Warcry", applied to every permanent type, the same rule `manaSources` uses).
`activatedBlockers` reports the reason strings for the UI, in the
`preserveBlockers` shape. `validateAction` checks window, `canActivate`, the
target list, `canPay` for the mana part, and `validateManaPlanForCost`.

**Application** (`Game.ts`, beside `preserveCard` at the `case` ladder): tap
the mana plan's sources, set `perm.tapped = true` on the source, emit a new
`activated` event `{ player, iid, cardId }`, run `ops` through the effect
interpreter with the source as the ability context and the chosen targets
bound, then `checkStateBased` (the deferred-trigger lesson from #334: every
path that deals damage runs the state check before control returns). Off
stack, resolves immediately, no response window, exactly like Preserve and
Skim. Tapping the source is a cost: if an op later fails to find its target
because an earlier op in the same list removed it, the tap is not refunded
and the remaining ops behave as they do for spells.

**Order inside a turn**: the untap in `phases.ts` already clears `tapped` and
`enteredThisTurn` at the controller's Dawn; nothing new.

**Replay**: a new action kind bumps `REPLAY_LOG_VERSION` 11 to 12. Old games
contain no `activate` actions and replay unchanged, so `CURRENT_RULES_REV`
stays at 4; the `v -> rev` ladder in `Replay.ts` maps 12 to 4. Goldens are
untouched in content, and the version pins in `tests/meta/replay.test.ts` and
the round-trip in `tests/engine/duat.test.ts` move by one.

**PlayerView**: no change. The battlefield clone already exposes `tapped` and
`enteredThisTurn`; the AI and DuelScene derive legality by calling
`legalActions`, as they do for everything else. The view stays a redaction of
state, not a legality oracle (the one precedent, `darlingCastable`, stays the
one).

**Determinism**: the action is fully described by `iid`, targets and plan;
enumeration order is battlefield order then target-list order, both already
deterministic.

## 4. AI

The slate's AI-pilotable rule is the reason this feature is shaped the way it
is. A tap ability on a **non-creature** has no trade-off: use it when it
helps. On a **creature** it competes with attacking, which is the tempo
decision the AI fumbles (why Pilot/Crew was tabled). The policy separates the
two.

New `src/ai/activatedPolicy.ts` in the `preservePolicy` shape, `chooseActivate(view, db, legal)`:

- **Non-creature sources**: in the Morning, use only abilities whose cost is
  the tap alone (mana is reserved for spells until the cast ladder has run);
  in the Afternoon, use any affordable ability whose ops score positive through
  `opImpactValue` with the best target from `chooseTargetAction`. Never use an
  ability whose ops only harm the controller.
- **Creature sources**: **Afternoon only**. Attack first if the attack planner
  wanted the body; a creature that attacked is tapped and drops out on its
  own (Sentinel excepted, which is the synergy). This is the greedy heuristic
  the slate asks for: attack, then tap what is left. A Bulwark or otherwise
  non-attacking creature is treated as a non-creature source.
- **Rage**: the policy never taps a Rage creature in the Morning to dodge its
  attack; that is a human trick, and the AI compelled-attack contract must not
  be quietly weakened.

Wiring: `EasyAI.main` and `MediumAI.main` call it in the ladder after
`choosePreserve`; `HardAI.searchMain` adds `activate` to its candidate
whitelist and `candidateScore` (otherwise Hard never sees it, the seam map's
finding); `searchResponse` is untouched because the action is never legal in
a window. Rollouts inherit Medium's policy.

Valuation: `permValue` gains an activated-ability premium, the ability's MEP
rate times the expected activations per game, the same shape as the dawn
multiplier. This is the same number the costing section produces, so the
brain and the formula agree on what the ability is worth.

Measurement gate: all five win-rate gates unchanged; `Hard > Medium` held;
the summit floors held; a seeded pass on a fixture deck carrying tap
permanents shows the AI actually uses them (activations per game per
difficulty reported, the `ai-watch-pass.ts` pattern).

## 5. Costing (the section 9 rule)

Every new mechanic gets its MEP rate from a comparative before it ships,
sanity-checked at both ends of its plausible range. The corpus report is
being produced now against the era filter in `docs/mtg-db-playbook.md`; this
section is filled from it before the spec is approved, with:

- the per-shape anchors (pinger, tapper, tap-to-draw, tap-to-mark,
  tap-for-life, mana-plus-tap slopes) and their min/median/max;
- the repeatable rate expressed as **per-activation MEP times an expected-
  activation multiplier**, the section 4i dawn pattern, with separate
  multipliers for non-creature and creature carriers (a creature carrier is
  worth less: it dies more, and it forgoes attacks);
- the mana-plus-tap discount slope;
- an explicit `NEEDS MATH` list for anything the corpus does not cover.

The rate row lands in `balance/power-formula.md` section 4 and the hook in
`balance/scoreCore.ts` (the card-level rider block, plus removing `activated`
from the `ScorableCardDef` omit list so it cannot flow through unscored) in
the same wave. `scripts/personas/score.ts` gains a weight for the action.

## 6. Blast radius (grep everything, not the remembered list)

- **Converter** (`scripts/avatarReserveDecks.ts`): `effectOpsOf` must walk
  `activated.ops` and `narrowTargetsOf` must walk `activated.targets`, or an
  ability's targets are invisible (a card mis-read as dead) and its token
  creation uncounted (supply under-counted). Any change to committed
  converter output stops the wave for an owner decision, the Starborne rule.
- **DuelScene**: a targeting branch in `onBattlefieldClick` before the
  attacker/blocker branches, in the `beginHauntlinkTargeting` shape; the
  tile's pointer and touch bindings; `PendingTargetAction` and
  `pendingActionTarget`; the mana-plan hover preview; a tapped-state read
  that already exists (`BoardCardView.setTapped`). For an ability without
  targets, the click uses it directly after the same confirm the Preserve row
  uses. No `Awaiting` switch changes.
- **Rules text and glossary**: `rulesText.ts` renders the line; the mechanic
  icon in `KeywordIcons.ts`; `glossary.ts` gains the taught term and
  `cardMechanics` the entry; `permanentClass.ts` classifies an `activated`
  rider as ACTIVATED (the class already exists for Preserve and Skim), so the
  1.7.1 one-time-effect guard never flags a tap artifact. Player copy: no
  em-dashes.
- **Tutorial and script AI**: no new awaiting kind, so no change; a grep
  confirms.
- **Docs**: `rules.md` gains the section, `adding-cards.md` the field and its
  validator rules, `card-building-guide.md` the costing trap (a tap ability
  on a body is priced against the attack it forgoes), `keyword-map.md` the
  mapping row, `architecture.md` the event.
- **blades-db**: a `TERMS` row for the taught term, then `terms --check`.

## 7. Wave decomposition (Codex implements; main session owns git)

Each PR into `release/1.8`, each verify-green, serial to avoid the Pages
concurrency cancel.

1. **Engine core**: sections 2 and 3 in full, the `activated` event, the
   replay bump, `tests/engine/activated.test.ts` in the `empowerReclaim`
   shape (fixture DB, legality matrix: tapped, arrived this turn, Warcry,
   opponent's permanent, wrong window, stack not empty, mana short, no legal
   target, target qualifiers) plus a replay round-trip and a determinism pin.
2. **AI and duel UI**: section 4 and the DuelScene branch, with `tests/ai/`
   coverage that each difficulty uses a free ability on a fixture board and
   that Hard's search enumerates it; copy strings handed in.
3. **Tooling**: converter walk with its tests, `permanentClass`, rules text,
   glossary, the local scoreCore hook and formula row, persona score weight,
   docs. Parallel with 2 (disjoint files).

No shipping card changes in this wave. The first printed tap abilities are
Drowned Deep's, and the land-economy brief (D3) may convert the 27 utility
taplands into tap-cost artifacts as its own batch afterwards.

## 8. Owner rulings needed

These are the sub-decisions of D2 in `plan-1.8.md`; recommendations first.

- **D2a Speed.** Main-phase, own turn, empty stack (recommended); or
  Charm-speed from day one, which needs stack semantics, response windows,
  and the AI response filters, roughly doubling wave 2.
- **D2b Carriers.** Creatures, artifacts and enchantments from the start
  (recommended, with the AI policy split above); or non-creatures only in
  1.8 and creatures later.
- **D2c Arrival rule.** "Cannot tap the turn it arrives unless Warcry" for
  every carrier including artifacts, which is what the engine already does
  for mana rocks (recommended: one rule, no exceptions to teach); or the MTG
  rule where only creatures are summoning-sick, which would also change
  today's mana rocks.
- **D2d Cost shapes.** Tap and tap-plus-mana (recommended); sacrifice and
  other riders deferred.
- **D2e Combinations.** Forbid with Hauntlink and `manaAbility` in v1
  (recommended); allow either.
- **D2f Copy.** The `Tap: ...` / `Tap, {1}: ...` template and the glossary
  name "Tap ability"; alternatives welcome, this is taste.

## 9. Explicitly out of scope, with what each would cost later

- **Charm-speed activation**: a `speed` field, the action pushed in the
  response windows, stack items for activations so the opponent can respond,
  `hasCastableCharm` awareness so windows stay open, and Hard's
  `searchResponse` filter. Sizeable; only if a set's identity needs it.
- **Untap effects**: none exist; adding one would make "once per turn" a real
  rule and needs its own text.
- **Multiple activated abilities per card**, **X costs**, **sacrifice or
  discard as part of the cost**, **abilities usable from hand or graveyard**
  (Skim and Preserve already own those zones).
- **Tap abilities on lands**: excluded while the reserve rule stands.
- **A tap-cost Propagate**: the future shape the 1.7 ruling named; it is a
  card, not an engine change, once this wave lands.
