<!-- source-of-truth: src/engine/types.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/resolve.ts, src/engine/mana.ts, src/engine/effects/EffectInterpreter.ts, src/engine/phases.ts, src/meta/Replay.ts, src/ai/ritePolicy.ts, src/ai/HardAI.ts, src/scenes/DuelScene.ts, docs/plan-1.8.md, docs/plan-tap-abilities.md, docs/plan-expansion-slate.md, docs/rules.md · last-verified: 2026-09-10 · engine spec — the Drowned Deep set mechanics (Whispers, Dread of the Deep), awaiting owner rulings DB1-DB6; re-verify when the wave lands -->

# The Drowned Deep engine wave: Whispers and Dread of the Deep

The set mechanics for 1.8's Large set, specified for implementation. The
slate fixed Whispers (the madness analog) as the headline on 2026-07-24 and
the 1.8 fork closed on it 2026-08-24 because it closes an existing loop: Dark
Tales shipped a discard engine (Skim) with no discard payoff. Dread of the
Deep (the emerge analog) is the optional second mechanic; `plan-1.8.md` D4
asks whether it ships at all.

**Status 2026-09-10: spec draft, awaiting owner rulings (section 8). No
code.** Codex implements under contract after the tap-ability engine core
lands (shared files), the main session owns git, everything lands by PR into
`release/1.8`.

**The finding that shaped this spec.** In this engine, discard is not a
generic outlet. Skim is a per-card ability ("pay the Skim cost: discard this
card, draw a card"), 76 cards carry it, and no card discards from its own
hand by effect. The only other hand-to-graveyard paths are the opponent's
random discard (18 cards) and the cleanup hand-size discard. A madness-style
"cast it now?" window after any discard would need a new `PendingDecision`
raised from inside op execution and a new `Awaiting` kind, and the survey
counted roughly 120 `awaiting.kind` switch sites across the engine, the three
AI brains, the script AI, the tutorial and DuelScene. That is the 1.7.2
hardlock trap at its largest. So this spec does not build a window.
**Whispers rides the Skim action itself, as one composite action, and Dread
is a fixed-discount sibling of Rite.** Neither adds an `Awaiting` kind.

## 1. Whispers: player-facing rules

- A card with Whispers also has Skim (the validator requires it). Its rules
  box prints the Skim line and then `Whispers {N}`, with the glossary
  teaching: "Whispers: when you Skim this card, you may cast it for its
  Whispers cost as it goes."
- Using it: pay the Skim cost, discard the card and draw as Skim always
  does, then pay the Whispers cost and the card is cast from your graveyard
  as it goes there. One decision, taken when you Skim. If you do not pay,
  the card stays in the graveyard, and a Whispers creature that was not cast
  can still be Preserved later if it has Preserve.
- Both costs are paid together in one mana payment; the Whispers cost is
  the whole price of the spell (no Empower on a Whispers cast, no X).
- **Timing.** The cast half is legal only where a normal cast of that card
  type would be: a Charm can be Whispered in any window Skim is legal in;
  a creature, Ritual, artifact or enchantment can be Whispered only in your
  own Morning or Afternoon with an empty stack. There are no ambush
  creatures in v1 (owner ruling DB1).
- The Whispered spell goes on the stack like any cast, so it can be
  answered. On resolution it behaves as a normal cast from hand would: a
  permanent arrives, a spell goes to the graveyard. It is not severed (that
  is Retell's exit; a Whispered card is not spent twice).
- **Whispers listens only to your own Skim in v1.** A card discarded by an
  opponent's effect or to the hand-size limit goes to the graveyard silently.
  This is a deliberate v1 boundary, printed in the glossary so it is never a
  surprise; section 9 records what the window would cost.
- Graveyard triggers fire once, at the discard, exactly as for any Skim.
  The card leaves the graveyard for the stack afterwards; nothing fires
  twice.

Interactions: Skim's deck-out rule is unchanged (no draw, no Skim). A
Whispers card with Preserve keeps it. Retell, Rite, Hauntlink, X and Empower
targets are not combinable with Whispers on one card (section 2), so no card
has two graveyard cast modes.

## 2. Whispers: data model and engine

```ts
/** Cast-as-you-Skim alternative cost. Requires `skim` on the same card. */
export interface WhispersDef {
  cost: ManaCost;
}
interface CardDef { /* ... */ whispers?: WhispersDef; }
```

`validateWhispersDef` enforces: `skim` present; not combinable with
`retell`, `rite`, `hauntlink` or an X cost; Empower may exist on the card but
never applies to the Whispers cast. The four existing validators gain the
matching exclusion line.

**Action.** No new action type. The `skim` action gains an optional rider:

```ts
| { type: 'skim'; handIndex: number; manaPlan?: ManaPlan;
    whispers?: { targets?: TargetRef[] } }
```

`legalActions` pushes the plain Skim as today and, when the card has
Whispers, one additional action per legal target list (the spell's own
`castTargetSpecsFor`, via `targetListsForCast`), gated by the timing rule
above: `castableNow`-style checks for Charms in windows, and the main-phase
own-turn empty-stack check for everything else. The mana plan covers
`combineManaCosts(skim.cost, whispers.cost)`; `validateManaPlanForCost`
checks it as one payment. The window gates `hasCastableInstant` and
`hasCastableCharm` treat a Whispers-Charm like a Charm cast and continue to
ignore plain Skim, so windows reopen exactly as they do for Charms.

**Application** (`Game.ts`, the `skim` case): pay the combined plan; discard
the card (splice, graveyard push, `fireGraveyardTriggers`, `skimmed` event,
draw one) exactly as today; then, if the rider is present, take the card from
the graveyard by instance and build the stack item the way Retell does
(`graveIndex` source model, `castCost` returning the Whispers cost, a
`whispered: true` flag on the `StackItem` instead of `retell`), binding the
rider's targets. Resolution: `moveSpellOnExit` sends a `whispered` spell to
the graveyard, not the severed zone; permanents enter the battlefield as
usual. One new `GameEvent`, `whispered { player, cardId }`, for narration.

**Replay.** A rider on an existing action; `REPLAY_LOG_VERSION` bumps once
for this wave (13 if the tap-ability wave has taken 12); `CURRENT_RULES_REV`
stays 4; the version ladder maps the new version to rev 4; goldens change
only their pins.

**PlayerView.** Unchanged. The graveyard and hand are already redacted
correctly; a Whispers cast reveals the card the way any cast does.

## 3. Whispers: AI and duel UI

- **Value.** `whispersValue(card)` = the card's cast value at its Whispers
  cost plus `skimValue` (the draw), minus the combined mana. Greedy rule:
  take the Whispers line when it is affordable now and the card's value cast
  beats its value held (the existing cast-vs-hold comparison every brain
  already makes for `castSpell`).
- **Medium's Skim gate** ("Skim only when no cast line exists") must treat
  a Whispers action as a cast line, not a Skim, or Medium never Whispers.
- **Hard's `searchMain` whitelist** gains the Whispers-rider Skim (it
  already lists `skim`; the rider must not be filtered out by the
  `deckCount` check alone), and `searchResponse` gains Whispers-Charms.
- **DuelScene.** The hand-click chooser (`showCastSkimChooser`, "Cast, or
  Skim?") gains a third button, "Skim, then Whisper for {N}", rendered with
  the same mana buttons; targets ride the existing `pendingCasts` targeting
  flow; narration is the Skim travel followed by a cast-from-graveyard
  animation using Retell's in-flight bookkeeping. No overlay, no new
  `Awaiting` branch.
- **Rules text and glossary.** `whispersText` prints after `skimText`;
  glossary gains the term with the v1 boundary in its definition;
  `cardMechanics` gains the key; `permanentClass` treats Whispers like Skim
  (a hand-side rider that does not make a permanent recurring).

## 4. Dread of the Deep: player-facing rules

Owner decision D4 in `plan-1.8.md` asks whether Dread ships. Three shapes
were costed against the engine:

- **(a) Emerge-faithful**: sacrifice a creature, reduce the cost by that
  creature's mana value. Needs cost-reduction machinery that does not exist
  anywhere (`castCost` is static; every caller and both mana-plan count
  invariants would take a discount parameter), one enumerated action per
  distinct sacrificial mana value, and a sacrifice picker.
- **(b) Fixed-discount Rite variant** (recommended): `Dread {N}`, "you may
  sacrifice a creature as you cast this; if you do, it costs {N} less."
  Reuses Rite's sacrifice plumbing (timing, batching, the creature-cap slot
  rule) with an optional flag and a constant reduction of the generic part.
  Same flavor (the town's disposable workers as the price), a fraction of the
  engine, and the AI decision is one comparison.
- **(c) Cut.** Whispers alone carries the set.

The rules below are (b). If the owner picks (a), section 9 has the delta.

- A Horror with Dread prints `Dread {N}` after its cost line. Glossary:
  "Dread: you may sacrifice a creature you control as you cast this; if you
  do, it costs {N} less." Dread is legal only on creatures with the Horror
  subtype (validator; the subtype is new, Drowned Deep introduces it).
- The sacrifice is a cost: it happens before the spell reaches the stack,
  its dies triggers fire then, and a cancelled Dread spell does not refund
  it. Exactly Rite's rules, with the sacrifice optional.
- The discount reduces only the generic part of the cost, never below zero;
  coloured pips are always paid.
- One creature only. Tokens are legal fodder. The sacrificed creature is
  chosen by the player (section 6, DB4).
- Dread never combines with X, Retell, Hauntlink or Whispers on one card.
  Dread plus Empower is legal: the discount applies to the printed cost,
  then the Empower cost is added.

## 5. Dread: data model and engine

```ts
/** Optional creature-sacrifice discount paid while casting a Horror. */
export interface DreadDef {
  discount: number; // generic mana removed when a creature is sacrificed
}
interface CardDef { /* ... */ dread?: DreadDef; }
```

`validateDreadDef`: `subtypes` includes `Horror`; `discount >= 1`; the
exclusions above; not with `rite` (one sacrifice mechanic per card).

**Action.** The `castSpell` action gains `dread?: true`. When set, the
existing `sacrifices` field carries exactly one creature index (Rite's field,
Rite's validation shape: the enumerator offers one canonical action, the
first creature in battlefield order, and `validateAction` accepts any single
legal creature). `castCost` gains the reduction: when `dread` is set, the
generic component is `max(0, generic - discount)`; every `castCost` caller
(`pushCastActions`, `castBlockers`, `validateAction`, `validateManaPlan`)
already asks `castCost` for the cost, so the reduction flows through one
function; the mana-plan count invariant follows because it reads the same
cost. Rite's payment block in `Game.ts` (snapshot in battlefield order,
destroy, batched graveyard triggers, batched dies triggers, winner bail-out)
runs unchanged for the one sacrifice. `castBlockers` subtracts one creature
from the cap count when `dread` is set, the Rite rule, and adds a "control a
creature" floor with its own `UNCASTABLE_COPY` line.

**Replay.** A rider on `castSpell`; same single version bump as Whispers.

## 6. Dread: AI and duel UI

- `src/ai/dreadPolicy.ts` in the `ritePolicy` shape: `isDreadCast`,
  `chooseDreadSacrifice` (the lowest `permValue` creature, never the single
  best body, never a body worth more than the mana saved plus the tempo of
  casting a turn earlier), `applyDreadPolicy` rewriting the canonical
  sacrifice or dropping the flag to cast at full price. Wired first in all
  three brains beside `applyRitePolicy`; Hard's whitelist and the uncapped
  Rite carve-out cover Dread casts the same way.
- **The sacrifice picker (DB4).** Rite's fodder is never player-chosen in
  DuelScene today: the human gets the canonical first-N. For Dread the choice
  is the whole decision, so the wave ships a picker: after the Dread option
  is chosen in the cast chooser (a third button, "Sacrifice a creature and
  cast for {reduced}"), the battlefield enters a highlight-and-pick mode on
  the `chooseTarget` visual path, and the cost preview updates with the
  chosen body. Rite gets the same picker for free (a standing UX gap closed;
  owner's call whether to expose it there).
- Rules text `dreadText` beside `riteText`; glossary term; `permanentClass`
  rider line.

## 7. Blast radius (both mechanics; grep everything)

- **No `Awaiting` kind, no `PendingDecision` kind.** The count of
  `awaiting.kind` sites that change is zero. This is the property the whole
  spec is built to keep; any implementation that finds it needs a window
  stops and reports.
- **Shared files with the tap-ability wave**: `types.ts`, `actions.ts`,
  `Game.ts`, `Replay.ts`, the three brains' whitelists, DuelScene's chooser
  code. This wave lands after that one and rebases onto it; the replay
  version bumps once per wave.
- **Converter** (`scripts/avatarReserveDecks.ts`): a Whispers cast uses the
  card's own target specs, which `narrowTargetsOf` already walks; nothing
  new to see. Dread adds no targets.
- **Window gates and `forcedAction`**: Whispers-Charms count as castable
  Charms; plain Skim stays excluded; Dread changes nothing here.
- **Rules text, glossary, `permanentClass`, `keyword-map.md`, `rules.md`,
  `adding-cards.md`, `card-building-guide.md`**: entries for both.
- **blades-db `TERMS`**: Whispers translates to "madness", Dread to
  "emerge" for the MTG comparison; `terms --check` after.
- **Set tag**: `CardDef.set` union gains `drowned-deep` (the data wave, not
  this one, but the union edit is worth naming now).

## 8. Owner rulings needed

Recommendations first. DB1-DB2 are Whispers, DB3-DB5 are Dread, DB6 is copy.

- **DB1 Whispers scope.** v1 listens to your own Skim only, and the cast
  half obeys normal casting speed (no ambush creatures). Alternatives: also
  fire on opponent and cleanup discards (the window, section 9), or allow
  any Whispers card at Skim speed (instant-speed creatures; a large AI and
  window change).
- **DB2 Whispers requires Skim on the card.** Recommended, since Skim is
  the only self-discard in the game. The alternative is a generic self-
  discard outlet op for the set, which reopens the window question.
- **DB3 Dread shape.** (b) fixed discount (recommended); (a) emerge-faithful
  variable discount; (c) cut.
- **DB4 Sacrifice picker.** Ship the player-chosen picker (recommended) and
  decide whether Rite exposes it too; or accept canonical first-creature
  fodder for Dread as Rite has.
- **DB5 Horror-only.** Dread legal only on the Horror subtype (recommended,
  it is the set's identity); or on any creature.
- **DB6 Copy.** `Whispers {N}` and `Dread {N}` as the printed lines, glossary
  names Whispers and Dread. Both are already the slate's names; the
  templates are the taste call.

## 9. Explicitly out of scope, with what each would cost later

- **A Whispers window on opponent and cleanup discards**: a
  `PendingDecision` raised from inside `runOps` (the `discardRandom` case
  runs mid-op), a new `Awaiting` kind, the drain branch in
  `maybeRaiseDeferredDecision` with a whiff-skip when the cost is unpayable,
  a third source-index channel on `castSpell`, the cleanup re-entry via
  `resumeCleanup`, and every one of the ~120 `awaiting.kind` sites. Large;
  only if a later set's identity needs it.
- **Generic self-discard outlets** ("discard a card: ..."): a new op and
  the same window.
- **Emerge-faithful Dread** (option a): cost-reduction machinery in
  `castCost` and both mana-plan invariants, per-mana-value enumeration, and
  the picker; roughly three times option (b).
- **Sanity track, transform**: tabled in the slate for cause.

## 10. Costing (the section 9 rule)

Filled from the corpus pass (madness anchors from Torment and Time Spiral,
the Kamigawa Offering cycle, emerge creep-flagged) before the spec is
approved: the Whispers option as a premium at printed cost and a discount
value when it fires times an enabler-density multiplier; the Dread option
likewise; both with min/median/max, sanity at both ends, and the explicit
`NEEDS MATH` list. Rows land in `balance/power-formula.md` section 4 and
hooks in `balance/scoreCore.ts` in the tooling wave.
