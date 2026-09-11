<!-- source-of-truth: src/engine/types.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/resolve.ts, src/engine/mana.ts, src/engine/effects/EffectInterpreter.ts, src/engine/phases.ts, src/meta/Replay.ts, src/ai/ritePolicy.ts, src/ai/HardAI.ts, src/scenes/DuelScene.ts, docs/plan-1.8.md, docs/plan-tap-abilities.md, docs/plan-expansion-slate.md, docs/rules.md · last-verified: 2026-09-11 · engine spec — the Drowned Deep set mechanics (Whispers, Tithe), RULED 2026-09-11; re-verify when the wave lands -->

# The Drowned Deep engine wave: Whispers and Tithe

The set mechanics for 1.8's Large set, specified for implementation. The
slate fixed Whispers (the madness analog) as the headline on 2026-07-24 and
the 1.8 fork closed on it 2026-08-24 because it closes an existing loop: Dark
Tales shipped a discard engine with no discard payoff. Tithe (the
emerge analog) is the second mechanic.

**Status 2026-09-11: RULED. Every owner decision in section 8 is closed; the
shapes below are the contract. No code yet.** Codex implements under contract
after the tap-ability wave's remaining PRs land (shared files), the main
session owns git, everything lands by PR into `release/1.8`.

**How the shapes were found.** The seam survey established that discard in
this engine is per-card Skim (cycling: "pay the Skim cost, discard *this*
card, draw"), 76 cards carry it, no card discards from its own hand by
effect, and the other hand-to-graveyard paths are the opponent's random
discard (18 cards) and the cleanup hand-size discard. A madness-style "cast
it the instant it lands" window would need a decision raised from inside op
execution and a new `Awaiting` kind across roughly 120 switch sites, the
1.7.2 hardlock trap at its largest. The owner's ruling sidesteps that
without giving up the payoff: **Whispers is a fresh-graveyard cast** (the
card is tagged when it enters the graveyard from hand or deck and may be
cast from there for a while), and **Tithe is a variable discount paid in
sacrificed Defense**, on Rite's sacrifice plumbing. Neither adds an
`Awaiting` kind.

## 1. Whispers: player-facing rules

Glossary: **"Whispers: if this card is put into your graveyard from your hand
or your deck, you may cast it from there for its Whispers cost until your
opponent's next Dawn."** Printed line: `Whispers {N}`, after the Skim line
when the card has one, otherwise where Retell prints.

- **What tags it.** Entering your graveyard **from your hand** (your own
  Skim, an opponent's discard effect, the hand-size discard at cleanup) or
  **from your deck** (any mill: `grind`, self-mill arrivals, opponent mill).
  Not from the battlefield: a creature dying is not a whisper. Not from the
  stack: a resolved or cancelled spell returning to the graveyard is not a
  whisper, which is what keeps a Whispered Charm from offering itself again.
- **How long it lasts.** Until the opponent's next Dawn. Entering on your
  own turn, that is the rest of this turn (you have your Afternoon).
  Entering on the opponent's turn, the opponent's *next* Dawn is the start
  of the turn after yours, so the tag survives their turn and your whole
  next turn. One rule, tight when you did it, generous when it was done to
  you.
- **Casting it.** At your normal opportunities for that card type: a Charm
  in any window you could cast a Charm; a creature, Ritual, artifact or
  enchantment in your own Morning or Afternoon with an empty stack. The
  Whispers cost is the whole price. No Empower and no X on a Whispers cast.
- **After it resolves.** Like any cast: a permanent arrives, a Charm or
  Ritual goes to the graveyard. It is **not** severed (that is Retell's
  exit, and the two never share a card). Whispers is a discount, not a
  second life: the card gets one cheaper cast when it lands the right way,
  then behaves like every other card. A Whispered creature that later dies
  is not re-tagged; Nine Lives and Preserve apply to it as to any creature.
- **Graveyard triggers** fire once, when the card enters, as they do today;
  leaving for the stack later fires nothing.

Interactions. Skim's deck-out rule is unchanged. A Whispers card with Skim
is its own enabler (Skim it, draw, Whisper it this turn). A Whispers card
with Preserve keeps Preserve if it is never Whispered. Retell, Rite,
Hauntlink and X are not combinable with Whispers on one card. The 18
shipped opponent-discard cards and every mill effect, the opponent's
included, now feed the mechanic; that is the anti-mill tension madness has
in MTG and it is intended.

## 2. Whispers: data model and engine

```ts
/** Fresh-graveyard alternative cost; see rules.md. */
export interface WhispersDef {
  cost: ManaCost;
}
interface CardDef { /* ... */ whispers?: WhispersDef; }
```

`validateWhispersDef` enforces: not combinable with `retell`, `rite`,
`hauntlink` or an X cost; Empower may exist on the card but never applies to
the Whispers cast. The four existing validators gain the matching exclusion
line.

**The tag.** A per-instance marker on the graveyard entry, written at every
site where a card enters a graveyard from hand or deck: the Skim apply path,
the `discardRandom` op, the cleanup `discardToHandSize` apply path, and the
mill ops (`grind` and any other deck-to-graveyard op the survey finds). Not
written by `moveSpellOnExit` (stack origin), `destroyPermanent` or any
battlefield-to-graveyard path, or a severed-zone move. The marker is
`whispersUntilDawnOf: PlayerId` (the opponent of the card's owner at tagging
time). PlayerView already shows graveyards in full, so the marker is public.

**Expiry.** One hook in the Dawn step (`phases.ts`, beside the untap and the
`enteredThisTurn` clear): when player P's Dawn begins, clear every marker
whose `whispersUntilDawnOf === P`, on both graveyards. No counters.

**Action.** No new action type. `castSpell` gains a `whispers: true` rider,
and the cast uses Retell's graveyard source model (`graveIndex` authoritative,
`handIndex` mirrors it). `legalActions` offers the Whispers cast for each
tagged Whispers card in the caster's graveyard, one action per legal target
list (the card's own `castTargetSpecsFor`), gated by the same window rules a
hand cast obeys for that card type; `castCost` returns the Whispers cost when
the rider is set; `castBlockers` and `validateAction` check the marker is
live, the mutual exclusions, and the mana plan. The window gates
`hasCastableInstant` and `hasCastableCharm` count a live Whispers Charm as a
castable Charm, so windows reopen the way they do for hand Charms.

**Resolution.** The stack item carries `whispered: true`; `moveSpellOnExit`
sends a whispered spell to the graveyard (not severed) and clears its marker
(it arrived from the stack). Permanents enter the battlefield as usual with
no marker. One new `GameEvent`, `whispered { player, cardId }`, for
narration.

**Replay.** A rider on an existing action; `REPLAY_LOG_VERSION` bumps once
for this wave (13 on top of the tap-ability wave's 12); `CURRENT_RULES_REV`
stays 4; the ladder maps the new version to rev 4; goldens change only their
pins. The marker is derived state (written and cleared by recorded actions
and phases), so nothing new is recorded.

**PlayerView.** Unchanged beyond the marker riding the public graveyard.

## 3. Whispers: AI and duel UI

- **Value.** `whispersValue(card)` next to `retellValue`: the card's cast
  value at its Whispers cost, with a deadline term (a marker expiring at the
  next Dawn is worth casting now; one that survives into your next turn can
  wait for a better window). Greedy rule: cast when affordable and the value
  cast beats holding the mana for a hand cast, the comparison the brains
  already make for Retell.
- **Wiring.** Easy and Medium: the Retell-cast slot in the main ladder and
  the response handler admits Whispers-Charms. Hard: the `searchMain`
  whitelist gains whispered casts (it already lists retell casts) and
  `searchResponse` gains Whispers-Charms. Rollouts inherit Medium.
- **DuelScene.** The graveyard modal that surfaces Retell and Preserve rows
  gains a Whispers row on tagged cards ("Whisper for {N}", mana rendered as
  pips, the same in-flight bookkeeping Retell uses); the pile alert badge
  counts live Whispers; a tagged card shows a small marker in the modal so
  the player can see the deadline. Narration on `whispered`. No overlay, no
  `Awaiting` change.
- **Rules text and glossary.** `whispersText` prints `Whispers {N}`; the
  glossary term above; `cardMechanics` gains the key; `permanentClass`
  treats Whispers like Retell (a cast-alternative rider that does not make a
  permanent recurring).

## 4. Tithe: player-facing rules

Glossary: **"Tithe: you may sacrifice any number of creatures you control as
you cast this. It costs one less for every two points of their combined
Defense, rounded down. Coloured mana is still paid."** Printed line: `Tithe`,
a bare keyword after the cost line (the discount varies, so nothing is
printed with it).

- The sacrifice is a cost: it happens before the spell reaches the stack,
  the sacrificed creatures' dies triggers fire then, and a cancelled Tithe
  spell does not refund it. Rite's rules exactly, with the sacrifice
  optional and any number of bodies.
- The discount is `floor(sum of sacrificed Defense / 2)` generic mana, never
  below zero; coloured pips are always paid. Tokens are legal fodder at their
  Defense. Defense is read at the moment of casting, so marks and statics
  count.
- If the card also has Empower, the discount applies to the generic part of
  the total being paid (printed plus Empower).
- Tithe never combines with X, Retell, Hauntlink, Whispers or Rite on one
  card (one sacrifice mechanic per card).
- **Carriers.** The engine allows Tithe on any creature. **Drowned Deep
  prints it only on Horrors**, a per-set data policy in the catalog test, so
  a later set can carry it on another subtype by changing one line. Fodder
  is unrestricted by design (MTG's Offering restricted the fodder type and
  that is what made it unreusable); a `fodder` subtype option is a one-field
  extension if a set ever wants it. Owner: Horror-only "for now", and the
  keyword must not be a dead end.

The picker: **a new pick-any-subset flow in the duel screen, applied to Rite
as well** (owner ruling). Rite's fodder has never been player-chosen in the
duel screen (the human got the first creatures in battlefield order); the
engine already accepts any legal Rite set, so Rite's change is UI only.

## 5. Tithe: data model and engine

```ts
/** Optional any-number creature sacrifice paid while casting; discount in Defense. */
export interface TitheDef {
  /** Generic mana removed per this many points of sacrificed Defense (2). */
  per: 2;
}
interface CardDef { /* ... */ tithe?: TitheDef; }
```

`validateTitheDef`: the exclusions above; not with `rite`. The Horror
restriction is NOT in the validator; it is a Drowned Deep row in the catalog
test ("every `drowned-deep` card with `tithe` has subtype Horror").

**Action.** `castSpell` gains `tithe?: true`; when set, `sacrifices` carries
zero or more creature indices (Rite's field; Rite's validation shape
accepting any legal set, here of any size). **Enumeration** avoids the
subset blow-up the way Rite does: `pushCastActions` offers the Tithe cast
with the canonical fodder set that covers the generic part at the lowest
Defense (bodies sorted by Defense ascending, taken until the discount covers
generic or the board is exhausted) plus the no-sacrifice cast; the AI policy
rewrites the set; `validateAction` accepts any subset.

**Cost.** `castCost` gains the reduction: with `tithe` set, the generic
component is `max(0, generic - floor(sacrificedDefense / 2))`, where
sacrificed Defense is summed from the chosen creatures' effective stats
(`getEffectiveStats`, so marks and statics count). Every `castCost` caller
(`pushCastActions`, `castBlockers`, `validateAction`, `validateManaPlan`)
already asks `castCost` for the cost, so the reduction flows through one
function, and the mana-plan count invariants follow because they read the
same cost. This is the cost-reduction machinery the engine did not have; it
is one function taking a discount and nothing else.

**Payment.** Rite's block in `Game.ts` (snapshot in battlefield order,
destroy, batched graveyard triggers, batched dies triggers, winner bail-out)
runs for the chosen set. `castBlockers` subtracts the fodder count from the
creature-cap check, the Rite rule.

**Replay.** A rider on `castSpell`; the same single version bump as
Whispers.

## 6. Tithe: AI and duel UI

- `src/ai/tithePolicy.ts` in the `ritePolicy` shape: `isTitheCast`,
  `chooseTitheSacrifices` (candidates sorted by `permValue` per point of
  Defense, ascending; add bodies, preferring pairs since odd totals waste a
  point, while the mana saved beats the board value given up and the generic
  part is not already covered; never the single best body; never a body the
  attack planner wanted this turn), `applyTithePolicy` rewriting the
  canonical set or dropping the flag to cast at full price. Wired first in
  all three brains beside `applyRitePolicy`; Hard's whitelist and the
  uncapped Rite carve-out cover Tithe casts.
- **The picker.** After the Tithe option is chosen in the cast chooser (a
  third button, "Sacrifice to cast"), the battlefield enters a
  multi-select highlight mode on the `chooseTarget` visual path: click to
  add or remove a creature, the cost preview updates with the discount as
  the selection changes (rounded down, pips unchanged), confirm casts,
  cancel returns to the chooser. **The same flow serves Rite**, with the
  selection size fixed at `rite.n` and confirm enabled only at that size.
- Rules text `titheText` beside `riteText`; glossary term; `permanentClass`
  rider line.

## 7. Blast radius (both mechanics; grep everything)

- **No `Awaiting` kind, no `PendingDecision` kind.** The count of
  `awaiting.kind` sites that change is zero. Any implementation that finds
  it needs one stops and reports.
- **Graveyard-entry sites**: every push into a graveyard must state its
  origin so the Whispers tag is written exactly for hand and deck origins.
  The survey lists the hand paths; the mill ops and any zone-move helper are
  the rest. A test pins the origin matrix (hand, deck, battlefield, stack,
  severed).
- **Shared files with the tap-ability wave**: `types.ts`, `actions.ts`,
  `Game.ts`, `Replay.ts`, the brains' whitelists, DuelScene's chooser and
  graveyard modal. This wave lands after that one and rebases onto it; the
  replay version bumps once per wave.
- **Converter** (`scripts/avatarReserveDecks.ts`): a Whispers cast uses the
  card's own target specs, which `narrowTargetsOf` already walks. Tithe adds
  no targets; its fodder supply is the deck's creature count, which the
  Rite supply logic already measures.
- **Window gates and `forcedAction`**: a live Whispers Charm counts as a
  castable Charm; plain Skim stays excluded; Tithe changes nothing here.
- **Rules text, glossary, `permanentClass`, `keyword-map.md`, `rules.md`,
  `adding-cards.md`, `card-building-guide.md`**: entries for both.
- **blades-db `TERMS`**: Whispers translates to "madness", Tithe to
  "emerge"; `terms --check` after.
- **Set tag**: `CardDef.set` union gains `drowned-deep` (the data wave).

## 8. Owner rulings (closed 2026-09-11)

Do not relitigate.

- **DB1 Whispers scope. RULED:** fresh-graveyard cast; tagging origins are
  hand and deck (never battlefield, never stack); expiry at the opponent's
  next Dawn; normal casting speed per card type; exits normally, not
  severed. The owner's words: "any time it enters the graveyard from
  anywhere except the play field, so it's a millable thing too"; "until
  your opponent's next Dawn"; on exit, "sounds good" to the normal exit.
- **DB2 Whispers requires Skim.** Folded away by DB1; Skim is one enabler
  among several.
- **DB3 Tithe shape. RULED:** any number of creatures; discount one generic
  per two points of combined Defense, rounded down; coloured mana always
  paid. (The owner first proposed one per point; the halving is the owner's
  correction.)
- **DB4 Sacrifice picker. RULED:** a new pick-any-subset UI flow, applied to
  Rite as well.
- **DB5 Horror-only. RULED:** Drowned Deep prints Tithe only on Horrors, as a
  per-set data policy, not an engine rule; the keyword must not be a dead
  end for future sets.
- **DB6 Copy. RULED:** `Whispers {N}` and bare `Tithe` as the printed lines
  (**renamed from Dread 2026-09-11**: it collided with the Dreaded keyword, and
  Tithe reads for the non-Horror sets that will carry it later),
  glossary names Whispers and Tithe, definitions as in sections 1 and 4.
- **Stat naming (asked alongside): no retheme.** Attack and Defense stay
  (they are not MTG's Power and Toughness; damage clears at cleanup so
  "Health" would mislead).

## 9. Explicitly out of scope, with what each would cost later

- **Instant-speed Whispers for non-Charms** (ambush creatures): a Flash-like
  cast mode with no costing precedent and a new AI response decision.
- **An immediate "cast as it goes" window**: the `PendingDecision` raised
  mid-op, the new `Awaiting` kind, the drain branch and the ~120 switch
  sites. The fresh-graveyard cast makes it unnecessary.
- **Generic self-discard outlets** ("discard a card: ..."): a new op; with
  the tap-ability engine landed, the natural shape is a Duty ability on a
  creature, which needs no window because the discarded card is tagged and
  cast later.
- **Fodder-restricted Tithe** (`fodder: subtype`): one optional field.
- **Sanity track, transform**: tabled in the slate for cause.

## 10. Costing (the section 9 rule)

Measured 2026-09-10 against the local MTG corpus under the era filter
(madness from Torment 2002 and Time Spiral 2006-07, n=22; the Kamigawa
Offering cycle, n=5; emerge creep-flagged, n=10; devour, n=12), then re-read
2026-09-11 against the ruled shapes. Full tables and queries in the local
workbench record `balance/whispers-dread-precedent-2026-09-10.md`
(gitignored).

**Whispers.** The era rule from twelve cards with a clean comparable:
bodies, cantrips and sorcery-speed effects are printed at fair rate with
madness as pure upside (Arrogant Wurm is Fangren Hunter with a free option);
instant-speed removal, burn and counters pay about half the discount up
front (Fiery Temper +1 over Volcanic Hammer for a 2-mana discount; Dark
Withering +3 for 5). The madness cost itself lands at fair or one below. The
era discount is 2 mana for creatures and instants (median), 1 for sorceries
and auras; post-2010 sets halved it to 1.

| Term | Provisional value | Evidence | Sanity at both ends |
| --- | --- | --- | --- |
| Option premium, charm-class effect | `E_FIRE x (printedMV - whispersMV)`, E_FIRE = 0.5; times the 4b Charm premium if the card is a Ritual (a Whispered Ritual can only be cast at sorcery speed, so no premium there) | Temper, Logic, Withering, Purification, Haze: ratio 0.5 to 1.0 | Low: Obsessive Search 0 gives 0. High: Withering 2.5 vs +3, slightly cold; 0.5 is the floor of the range |
| Option premium, body or sorcery-speed effect | 0 at printed | six exact vanilla twins, all at 0 | both eras agree |
| The Whispers cost | guard: `whispersMV >= fair(effect) - 1`, never below `fair - 2` | mad-fair median -1 (n=12) | the measured range itself |
| Skim + Whispers on one card | `skimCost + whispersMV >= fair(effect + draw 1)`, up to +1 tolerated for the guaranteed self-trigger | Ichor Slick: cycling {2} + madness {3}{B}, about +2 over fair | n=1, `NEEDS MATH`; applies only to cards that carry both |

**What the ruling changes.** E_FIRE was Wizards' pricing proxy because the
first draft could only fire off the card's own Skim. Under the fresh-
graveyard cast the fire rate is a real in-engine quantity: the 18 opponent-
discard cards, every mill (self and opponent), cleanup discards and Skim all
tag. **E_FIRE is therefore `NEEDS MATH` in the honest sense: measure it on a
seeded matrix once the set's mill and discard density is known, then set
the premium from the measured rate**, keeping 0.5 as the placeholder for
charm-class cards and 0 for bodies until then. The enabler-density rule of
thumb from MTG (1.5 to 3 outlets per payoff) becomes a design input for the
set: the deck's own mill and Skim density is what makes Whispers cards fire.

**Tithe.** The Kamigawa Patrons price the offering option at 0.4 / 0.5 / 1.2
MEP (min / median / max) at printed, and the same-block Dragon Spirits at
identical cost and rarity outrank all five: the tribal restriction was the
real cost and the mana option was nearly free. Devour prices sacrifice-for-
stats at 1.2 to 1.5 on commons regardless of N because the sacrificed body
is the real cost. Rite already carries -0.7 x N in the formula.

| Term | Provisional value | Evidence | Sanity at both ends |
| --- | --- | --- | --- |
| Tithe option (any number, one generic per two Defense) | flat **+0.5**, floor 0, cap 1.0; not scaled by the card's MV | with the halving, the discount is about half the fodder's mana value on the vanilla curve (Defense runs even with MV from three mana up), which is the Patrons' "nearly free option" regime | Low: Orochi / Nezumi 0.4 to 0.5 hold. High: Moon 1.2 reads over because its land ability is unpriced. A Tithe card that ALSO gains counters needs the Devour rate on top |
| The discount itself | not a rate; an authoring guard: fodder-heavy decks (tokens, walls) are the set's line, so the seeded matrix measures how often a 7+ Horror lands by turn 4 | no precedent for a Defense-keyed discount (emerge uses mana value) | `NEEDS MATH`; the halving is the owner's deliberate conservatism |

`NEEDS MATH`, explicitly: E_FIRE for Whispers (measure), the Skim+Whispers
combined-cast guard (n=1), the Tithe discount's tempo effect (measure), and
whether stat-reading fodder (marks, statics) needs its own guard once cards
exist.

The rows land in `balance/power-formula.md` section 4 (4r Whispers, 4s
Tithe) and the hooks in `balance/scoreCore.ts` beside `retell` and `rite` in
the tooling wave; `scripts/personas/score.ts` gains weights for both riders.
