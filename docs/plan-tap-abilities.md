<!-- source-of-truth: src/engine/types.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/mana.ts, src/engine/statics.ts, src/engine/combat/legality.ts, src/engine/view.ts, src/meta/Replay.ts, src/config/rules.ts, src/ai/HardAI.ts, src/ai/MediumAI.ts, src/ai/EasyAI.ts, scripts/avatarReserveDecks.ts, docs/plan-1.8.md, docs/plan-road-to-2.0.md, docs/rules.md · last-verified: 2026-09-07 · engine spec — the 1.8 engine feature, awaiting owner rulings D2a-D2f; re-verify when the wave lands -->

# Activated abilities with tap costs

The 1.8 engine feature, specified for implementation. The spine fixed it on
2026-08-24 as **set-agnostic**: a capability every later set draws on (Brass
Court's Union rigs and contraptions wait on it), not a Drowned Deep mechanic.
It also unlocks the artifact design space the slate records as blocked, since
artifacts carry no targeted or activated abilities today.

**Status 2026-09-07: RULED. All six D2 sub-decisions approved as recommended
(section 8), with the rules-line copy amended to the tap icon and the taught
name ruled as Duty. No code yet.** The implementation is Codex's under
contract, the main session owns git, and everything lands by PR into
`release/1.8`.

The one-line design: **a permanent may tap itself, and optionally pay mana, to
run effect ops with inline targets, off-stack, during its controller's own
Morning or Afternoon.** It is the fifth activation seam in the engine, built
on the four that exist (Preserve, Skim, Hauntlink, Empower), and it adds **no
new `Awaiting` kind**, which is the property that keeps the DuelScene switch
trap from 1.7.2 out of the wave.

## 1. Player-facing rules

- A permanent with a tap ability shows it as its own rules line, opening
  with **the tap pip lands already use** (`pip-T`, baked by
  `bakeManaSymbols`, drawn at a reduced size on the rules line), then any
  mana pips, then a colon and the effect: `[T]: <effect>.` and
  `[T], {1}: <effect>.` (owner ruling D2f, 2026-09-07: the icon, not the
  word). The mana renders as pips the way costs render everywhere else.
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
- Glossary entry, taught as **Duty** (owner ruling D2f, 2026-09-07):
  "Duty: tap this permanent, and pay any listed cost, during your Morning or
  Afternoon to perform its Duty. A permanent cannot tap the turn it arrives
  unless it has Warcry." The word Duty never appears on the card itself; the
  rules line is the tap pip, the cost pips and the effect.

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
sanity-checked at both ends of its plausible range. Measured 2026-09-07
against the local MTG corpus under the era filter in
`docs/mtg-db-playbook.md` (pre-2010, no un-sets, 8ED/9ED/10E printings
flagged); the full anchor tables, the vanilla baselines and every query are in
the local workbench record `balance/tap-ability-precedent-2026-09-07.md`
(gitignored, like the formula itself).

**The finding that sets the shape: a tap ability prices like a Dawn trigger
the player chooses to fire.** Two independent creature effects (pingers and
drainers) back out an expected-activation multiplier of about 2.0 on their
per-trigger op rate, and the two real artifact card-advantage anchors
(Jayemdae Tome, Jalum Tome) back out 3.3 to 3.6. Those are the formula's
existing `DAWN_MULT_CREATURE` (2.0) and `DAWN_MULT_NONCREATURE` (3.0), so
the rate reuses them rather than inventing a third pair:

`A = TAP_MULT(carrier) x perTriggerMEP - D x activationMana`, clamped at 0.

| Term | Provisional value | Evidence | Sanity at both ends |
| --- | --- | --- | --- |
| `TAP_MULT_CREATURE` | 2.0 x per-trigger rate | `{T}: 1 damage` on a mono 1/1 = 2.00 MEP flat across 7 cards from 1993 to 10E (Prodigal Sorcerer family); Archivist `{T}: draw` = 3.24 (mult 1.96) | Low and mid hold. **Top fails**: repeatable destroy would score 5.4 against anchors of 0.6 to 3.8 (Royal Assassin to Kalitas), so for per-trigger rates of 2.0 or more the term is `perTrigger + 1.0`, and that band is `NEEDS MATH` |
| `TAP_MULT_NONCREATURE` | 3.0 x per-trigger rate | Jayemdae 3.3, Jalum 3.6; the same-set pair Onyx Goblet / Obelisk shows `{T}: drain 1` priced like a three-colour rock (about 1.6 MEP) | Card-advantage anchors hold; life trinkets read 1.5 to 2.4 cold, which matches their EDHREC ranks and is the same Honden exclusion section 4i already made |
| `D`, discount per activation mana | 0.4 per mana, capped at 1.5 total | Ladders disagree by 5x: pingers 0 to 0.3, `{W}` tappers 0.3, life trinkets 1.0 to 1.5, artifact tappers about 1.0 | Low: `{W},{T}: tap` gives 0.4 vs 0.5 measured. High: `{4},{T}: draw` artifact gives 3.45 vs Jayemdae 4.24, slightly cold and accurate for that card. **A midpoint, not a fit; ships flagged** |
| Repeatable `tap` per-trigger base | 1.0 (not the one-shot `tap` op's 0.40) | `{T}`-only unrestricted tappers = 2.0 MEP (Ballynock Trapper, Vectis Dominator); Icy Manipulator is a 9ED/10E staple | The cheap-stapled vs expensive-repeatable split section 4h already uses for Propagate (0.70 vs 1.65). At 0.40 Icy reads three points cold. `NEEDS MATH` for the tapper D (about 1.0 fits Master Decoy) |
| Attack >= 2 body discount | -0.5, non-additive, like `rageValue` | Viashino Fangtail, Mawcor, Loxodon Mystic each pay about 1.0 less than 1/1 carriers | 1/1 carriers unaffected; 3/3 pingers land 0.4 high. Optional, owner taste |
| One-shot `{T}, sacrifice: effect` | multiplier 1.0 (the plain op rate) | eight one-drop anchors price at A = 0 | Trivial both ends; out of v1 scope anyway |

Three questions the spec needed answered, with the corpus's answer:

1. **Is the same ability cheaper on a creature than on an artifact? Yes, by
   1.0 to 1.75 MEP, consistently** (Marble Chalice vs Silent Attendant, Onyx
   Goblet vs Cackling Imp, Trip Noose vs Master Decoy, Rod of Ruin vs
   Prodigal Sorcerer). The ratio is 1.5 to 2x, which is the 2.0 / 3.0 carrier
   split. One caveat travels with it: part of MTG's reason is that artifacts
   go in every deck, and our artifact removal is scarce (section 4i counted 5
   answers against 17 for enchantments), so the non-creature side stays at
   the fair rate and is never discounted below it.
2. **How does cost scale from `{T}` to `{1},{T}` to `{2},{T}`? Between 0.3 and
   1.5 printed mana per activation mana, effect-dependent, first mana
   discounting most.** Cheap effects (a ping on a body) discount almost
   nothing; expensive effects use the activation mana as a rate limiter, not
   a discount (Jayemdae's `{4}` activation on a `{4}` card). Hence D as a
   midpoint with a cap.
3. **Earliest-era `{T}: draw a card` on a creature is Archivist** ({2}{U}{U}
   1/1 rare, 1999, reprinted 8ED and 9ED) at 3.24 MEP. **`{1},{T}: draw` on an
   artifact does not exist in the corpus in any era**; the era anchor is
   Jayemdae Tome ({4}, `{4},{T}`), and Wizards has held printed plus
   activation at 6 to 8 for unconditional artifact draw for 25 years. Any
   Drowned Deep card at that price point is `NEEDS MATH`.

`NEEDS MATH`, explicitly: an era-clean `{T}: +1/+1 counter` rate (4 pre-2010
cards, 2 restricted; the usable family is 2014 onward and carries creep), a
`{T}: scry` rate on a creature (zero pre-2010 rows), `{1},{T}: draw` on an
artifact, the tapper D, and the top of the creature range. None of these is
guessed; a card that needs one is scored with the flag standing and the owner
decides.

Two design consequences the numbers carry into the set: **a tap ability on a
body is priced against the attack it forgoes** (the attack >= 2 discount is
the corpus saying so), and **repeatable removal on a tap never appears below
six mana or below rare** in twenty years of precedent, which is a cut
constraint for Drowned Deep's Horror package, not a formula detail.

The rate rows land in `balance/power-formula.md` section 4 (a new 4q) and the
hook in `balance/scoreCore.ts` (the card-level rider block, plus removing
`activated` from the `ScorableCardDef` omit list so it cannot flow through
unscored) in the tooling wave. `scripts/personas/score.ts` gains a weight for
the action. Both carry the `NEEDS MATH` flags above verbatim.

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

## 8. Owner rulings

The sub-decisions of D2 in `plan-1.8.md`. **Ruled 2026-09-07; all six
approved as recommended, with one amendment and one open name.** Do not
relitigate.

- **D2a Speed. APPROVED:** main-phase, own turn, empty stack. Charm-speed
  stays a later extension (section 9).
- **D2b Carriers. APPROVED:** creatures, artifacts and enchantments from the
  start, with the AI policy split (non-creatures use free abilities early,
  creatures only after combat).
- **D2c Arrival rule. APPROVED:** cannot tap the turn it arrives unless
  Warcry, for every carrier. One rule, the one mana rocks already follow.
- **D2d Cost shapes. APPROVED:** tap and tap-plus-mana only.
- **D2e Combinations. APPROVED:** forbidden with Hauntlink and with
  `manaAbility` in v1.
- **D2f Copy. APPROVED WITH AMENDMENT:** the rules line opens with the tap
  **icon** lands already use (`pip-T`, smaller), never the word; the
  glossary teaches the mechanic under a themed name: **Duty** (owner,
  2026-09-07, from Fable's collision-checked candidates Duty / Toil /
  Devote; "Ability" was set aside because every triggered and static rules
  line is already called an ability in `adding-cards.md` and the glossary).
  Duty names the glossary entry, the `cardMechanics` key, the blades-db
  `TERMS` row (translating to "activated ability" for the MTG comparison)
  and the mechanic icon tooltip; the engine field stays `activated`, and the
  card face shows only the tap pip.

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
