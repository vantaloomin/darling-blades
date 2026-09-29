<!-- source-of-truth: docs/plan-1.9.md, docs/expansions/drafts/first-dawn-brief.md, docs/expansions/drafts/first-dawn-overplan.md, docs/rules.md, src/engine/types.ts, src/engine/effects/EffectInterpreter.ts, src/engine/effects/targeting.ts, src/engine/statics.ts, src/engine/sba.ts, src/engine/combat/damage.ts, src/engine/Game.ts, src/engine/actions.ts, src/engine/resolve.ts, src/ai/value.ts, src/ai/targeting.ts, src/ai/activatedPolicy.ts, src/ai/combatPlans.ts, src/ai/pumpPolicy.ts, src/power/scoreCore.ts, src/data/glossary.ts, src/ui/rulesText.ts, scripts/action-log.ts, scripts/avatarReserveDecks.ts, scripts/mechanicUsage.ts · last-verified: 2026-09-29 · engine spec, RULED at the owner's second 1.9 sitting 2026-09-28 (lane A, and lane B step 3, the concretion audit); re-verify when the overplan's cut changes or when A1 lands -->

# First Dawn engine spec: Provoked, Hunt, and what the cards need (1.9 lane A)

**Status: RULED 2026-09-28, at the owner's second sitting.** Q1-Q5 and
Q7-Q10 as recommended (Q10 except one template); **Q6 went the other way in
part**: the seven arrival and attack Hunts hunt an opponent's creature if a
legal one exists, and are forced to hunt your own only when none does (see
"Rulings" at the end). **Superseded in part later on 2026-09-28 (the
bare-keyword ruling):** Hunt is a bare verb keyword like Mark ("When this
arrives, Hunt."), and *every* Hunt, in every carrier, takes a creature an
opponent controls if a legal one exists, otherwise another creature you
control (Q6 and Q10 below). **Superseded again the same day (the final
Hunt ruling):** the generic Hunt's prey is a creature an opponent controls,
with no fallback; a card may declare its own prey instead (`any`: any other
creature; `yours`: another creature you control); and a creature with an
arrival Hunt chooses its prey at cast and can't be cast without one (Part 2,
rule 2). A1.1 and A1.1b built Parts 1-3 on these rulings (see "As built").
This is lane B step 3 (the concretion audit) and lane A's spec
([plan-1.9.md](plan-1.9.md), D16): the cards were designed first, in the
[overplan](expansions/drafts/first-dawn-overplan.md), against the approved
[identity brief](expansions/drafts/first-dawn-brief.md). Every row of the
overplan was read against the engine as it stands on `release/1.9`, and every
claim below names the file and line it rests on. Where the engine's behaviour
had to be shown rather than read, a throwaway probe ran the real engine on
constructed cards (Appendix B); none of it is in the repo.

The owner reads the plain-language parts: the summary, each part's
**Rules** section, and the questions at the end. The **Mechanism** sections
are for the engine builder (A1).

## Summary

- **The cards need less new engine than the overplan thought.** Of the 165
  rows in the projected cut, 108 work in today's engine exactly as sketched,
  54 need only the two ruled mechanics (Provoked on 33, Hunt on 23, both on
  2), and 3 need one small new construct. None needs a reword to exist. Of
  the 45 rows the projected cut drops, one (Bone-Snap Ambush) would need a
  construct that nothing else uses.
- **Two of the overplan's four new constructs are really part of Hunt.**
  "A Hunt spell's hunter cannot have Bulwark" and "a Hunt spell's two
  creatures must be different" are rules of the Hunt op itself, the way
  Mark-moving already checks its own two targets. No general "target
  creature with a keyword" is needed.
- **One construct is kept on the threshold:** "damage each creature you
  control" (War Drums, Trial by Ember, Drum-Beater), exactly three rows.
- **Empower may Hunt is a one-line validator change**, not a relaxation of
  anything. Hunt damage never kills anything mid-effect; deaths happen after.
- **A risk the overplan carried is already gone.** G7 (a Duty that removes a
  creature threw an error) shipped fixed in 1.8.1, with tests. The 14 Duty
  rows the overplan listed as "G7-gated" are not gated.
- **Provoked fires in the state-based check, after deaths.** That is the only
  place survival is known, and it gives Provoked the same timing and
  ordering as a dies trigger, which the engine already handles everywhere.
  "At most once each turn" bounds every loop, so no new depth cap is needed.
  One exception is ruled rather than engineered: when a Hauntlink window
  holds a dies trigger, an untargeted Provoked effect of the same check
  still resolves at once, ahead of it (Q1).
- **Hunt damage goes through one shared "a creature deals damage" path**
  that combat also uses (the owner's evergreen ruling). A1 builds it by
  moving combat's damage step onto it, and proves combat did not change
  with the identical-action-log harness.
- **The concretion found four things the cards force**, each an owner
  question: seven arrival and attack Hunts can be forced to hunt your own
  creature; an Empower-Hunt creature is countered outright if its prey
  leaves before it resolves; Scar-Knife Witch kills itself when it arrives
  alone; and the Deathblade-hunter question is wider than the Hunt spells.
  **Ruled 2026-09-28:** the seven hunt a creature an opponent controls if a
  legal one exists, and only when none does are they forced to hunt another
  creature you control (with neither, the trigger does nothing), so Easy's
  "never hunts its own" becomes "never by choice" (Q6; superseded later that
  day: the generic Hunt takes only an opponent's creature, and only a card
  that declares `any` or `yours` reaches your own side); the empowered
  creature resolves and loses only its rider (Q5); the Witch reads "another
  target creature you control" (Q9); Deathblade hunters are accepted and the
  lab costs them (Q7).

## The construct table (the concretion audit's answer)

The B10 rule: a new construct is built only if at least three rows in the
cut need it, or the owner rules one card worth it. Row counts are the
projected cut, with the full overplan in brackets.

| Construct | What the engine has today | Rows served | Clears B10? | Recommendation |
| --- | --- | ---: | --- | --- |
| **Provoked** trigger | No damage-survived trigger: `TriggerWhen` (types.ts:36-57) | 33 (38) | ruled | **Build** (A1), as in Part 1 |
| **Hunt** op, four carriers: spell 8, arrival 9, attack 1, Duty 2, Empower 3 | No mutual-damage op (types.ts:91-135) | 23 (25) | ruled | **Build** (A1), as in Part 2 |
| Hunt targeting: the hunter cannot have Bulwark; the spell's two creatures are different | A spell with two target specs may name one creature in both (probe P1); no keyword qualifier on `TargetSpec` (types.ts:59-89) | 8 (8), the Hunt spells | part of the Hunt op | **Fold into the Hunt op**, on the `moveMark` precedent (actions.ts:379-404, 489-500). Replaces the overplan's `keywordTarget` and `distinctSpellTargets` |
| `eachYourCreature` damage recipient ("damage each [other] creature you control N") | `damage` reaches `eachCreature` and `eachOpponentCreature` only (types.ts:93) | 3 (4) | yes, exactly | **Keep** (Q3). If the owner's cut drops one of the three, it falls below the threshold |
| Empower may Hunt | Empower's target allowlist is `moveMark`, `reclaim`, `destroy` (types.ts:300-329) | 3 (3) | yes | **Keep, validator only** (Part 3) |
| An empowered permanent fizzles whole when its Empower target leaves | A permanent spell with any target fizzles if none is legal (resolve.ts:77-91; probe P5) | 3 affected (3) | a rule fix, not a construct | **Fix** (Q5) |
| General keyword-qualified target ("target creature with Skyborne") | none | 0 (1: Bone-Snap Ambush) | no | **Drop** |
| Optional trigger ("you may have this hunt") | Targeted triggers are mandatory (EffectInterpreter.ts:1081-1099) | 0 (the owner ruled a forced fallback instead, Q6) | n/a | **Do not build** (Q6, ruled 2026-09-28) |
| An opponent's creature if able (Q6, ruled 2026-09-28; superseded the same day: the generic prey is an opponent's creature only, with no fallback) | No target preference by controller: a spec offers one candidate set (targeting.ts) | 0 | no | **Removed** (A1.1b): built as `opponentIfAble` in A1.1, taken out when no card needed the fallback (B10) |
| Hunt prey overrides (ruled 2026-09-28): a card may declare `any` (any other creature) or `yours` (another creature you control) instead of the default (an opponent's creature) | The target specs exist (`creature` with `other`, `yourCreature` with `other`, `opponentCreature`) | 5 overrides (Korru, Tracker of the Long Grass, Thorn-Hide Armourback, Spear and Fang, R27's plan) | ruled | **Built** (A1.1b): a `prey` field on the `hunt` op, checked against the spec by `validateHuntDef` |
| A targeted dies trigger that cannot pick its own card from the graveyard | `other` exempts graveyard refs (targeting.ts:156; probe P3) | 0 (0) | no | **Do not build**; no row uses the shape since Fossil-Dreamer moved to arrival |
| Dinokin and Dinosaur Axes | Lords already work on `filter.subtype` (statics.ts:112-120) | 3 lords and their payoffs | data | **Data only**: two `src/data/axes.ts` entries |
| Four tokens (Hatchling, Pack Raptor, Tar-Bones, Glider) | `createToken` of a token def (EffectInterpreter.ts:668-681) | 4 | data | **Data only** |

**Per-row classification** (Appendix A has every row):

| Class | Projected cut | Overplan |
| --- | ---: | ---: |
| **E** expressible today, exactly as sketched | 108 | 145 |
| **M** needs only a ruled mechanic (Provoked, Hunt, or both) | 51 | 57 |
| **M+D** a ruled mechanic plus a data-only validator change (Empower-Hunt) | 3 | 3 |
| **C** needs the kept construct (`eachYourCreature`) | 3 | 4 |
| **X** not expressible as written (reword or leave cut) | 0 | 1 |
| **Total** | **165** | **210** |

The owner's F6 (2026-09-28) keeps The Great Drum of the Hearth (E) and drops
Fern-Crown Tyrant (M) from the projected board, so the board the cut starts
from is 109 E and 50 M; the tables here and Appendix A keep the board this
audit read.

The four tokens are expressible (data). The Stampede theme deck (19 distinct
cards: 12 M, 7 E), R27's draft list (21: 8 M, 13 E) and R28's (21: 15 M, 6
E) use only projected-cut rows, and none of them uses `eachYourCreature`.

"Expressible" was checked, not assumed, for every shape the overplan listed
as "existing vocabulary to confirm": a condition on a self static (Horn-Bearer
and two cut rows; statics.ts:36-40 and 103-104 read it); a targeted
`allyAttacks` observer (Herd-Singer, cut; EffectInterpreter.ts:1228-1234);
`minAttack` on a Duty's Mark target (Great-Horn Herder; targeting.ts:151-152,
Game.ts:993); Sunset with `creatureDiedThisTurn` (The Clan Hearth;
EffectInterpreter.ts:238); `allyCreatureArrives` gaining life (Tahla;
EffectInterpreter.ts:1023-1066, which never fires for the holder itself, so
her face must read "another creature").

## Part 1. Provoked

### Rules (for the owner)

*"Provoked: [effect]" triggers when this creature is dealt damage and
survives.* Ruled already: at most once each turn per creature (B4, P2); no
reserved art tell; printed on creatures only (P5). This spec rules the rest:

1. **The boundary.** A creature is provoked when it is dealt more than 0
   damage by anything (combat, a spell, an ability, a Hunt, its own side) and
   is still on the battlefield, not lethally damaged, once the state-based
   check that follows has removed that check's dead. A creature that dies,
   Deathblade included, is never provoked. Damage that is prevented, or 0
   damage, provokes nothing.
2. **Once each turn.** The first survived blow in a turn provokes it; later
   ones that turn do not. It resets at the start of every turn, yours and
   your opponent's. That one rule answers First Blade's two damage steps
   (a creature struck in both is provoked once, by the first) and several
   sources at once (one provocation). A Provoked trigger that finds no legal
   target does not fire and is not spent.
3. **When it resolves.** After the deaths of the same check and their dies
   triggers, in battlefield order. So a Provoked effect sees the settled
   board: the dead are gone, their dies tokens are made. A creature that a
   dies trigger finishes off in between is not provoked. **One exception**:
   when a player can pay a Hauntlink, the game holds a dies trigger back to
   offer the Hauntlink window first; an untargeted Provoked effect of the
   same check does not wait for it, and resolves at once, ahead of the held
   dies trigger (Q1).
4. **A targeted Provoked effect** asks its controller for a target the way a
   targeted dies or attack trigger does: once the current effect, Duty,
   Dawn or combat damage step has finished. So in combat, an untargeted
   Provoked effect from the First Blade step (for example "this gets
   +2/+0") resolves before the regular damage step, and a targeted one is
   chosen after combat damage. That is how dies triggers already behave
   (probe P4), so one rule covers both. When the choice comes, the creature
   must still be on the battlefield and still not lethally damaged; if not,
   the effect does nothing.
5. **Loops cannot happen.** Each creature is provoked at most once a turn, so
   a chain of Provoked effects is never longer than the number of Provoked
   creatures on the battlefield (at most 16: `maxCreatures` is 8 a side,
   config/rules.ts:32). The design rule stays on top, for legibility: no
   Provoked effect damages its controller's own creatures, and none Hunts
   (P3; every row in the overplan holds it).
6. **A new permanent is a new creature.** A creature that leaves and comes
   back (a Preserve token copy, a Nine Lives return, a recast) starts with
   its Provoked unspent, so it can be provoked again that turn, as any
   "once each turn" trigger already works (rules.md, Trigger chains).

### Mechanism (A1)

- **Type.** `'provoked'` joins `TriggerWhen` (types.ts:36-57). Validators: a
  `provoked` ability only on a creature, at most one per card (P5; no static
  can grant a trigger, so "never granted" holds structurally, statics.ts:97-140
  grant keywords and stats only).
- **The struck mark.** One helper marks creature damage everywhere it is
  dealt: the three creature branches of the `damage` op
  (EffectInterpreter.ts:326-347) and the shared creature-damage applier
  (Part 2). When the amount is more than 0 and the creature's card has a
  `provoked` ability, it sets `Permanent.struck = true`. Only Provoked
  carriers are ever marked, so every game on today's pool keeps
  byte-identical state.
- **In the state-based check** (sba.ts:20-121), each pass: first collect the
  struck creatures that are not condemned this pass, and clear their mark;
  then the pass removes its dead and fires their dies triggers as today
  (`fireBatchedDies`, sba.ts:117); then, in battlefield order, each collected
  survivor still on the battlefield and still not lethally damaged (the same
  test as sba.ts:50-54) fires its `provoked` ability through `fireTriggers`
  (EffectInterpreter.ts:1068-1160): untargeted ones run inline at mark depth
  0, as SBA dies triggers do; targeted ones queue a `chooseTarget` with
  `triggerWhen: 'provoked'` (EffectInterpreter.ts:1081-1099), which the drain
  raises after the current action (Game.ts:590-609) and fizzles silently if
  the target is gone by then (Game.ts:590-600). A pass that provoked anything
  counts as changed, so the next pass judges what the Provoked effects did.
- **Every state-based check fires it**, not only combat's and the stack
  flush's: a Duty's check (Game.ts:1000) and the Dawn check (phases.ts:85)
  too. So a targeted Provoked choice can surface mid-Dawn, exactly as a
  targeted dies trigger does today: the Dawn waits for the queued choice
  (phases.ts:88-90) and resumes through the drain.
- **A queued (targeted) Provoked entry re-checks survival.** It is a
  `chooseTarget` entry, never a `resolveTrigger` with empty targets, so
  `isHeldDiesTrigger` (Game.ts:83-85, which reads "no targets" as "held dies
  trigger") never sees it and `resolveHeldDiesTrigger` (Game.ts:654-712)
  never runs it. When its choice is answered, the ops run only if the source
  is still on the battlefield and still passes the survival test
  (sba.ts:50-54); otherwise it does nothing, silently, like a fizzled
  trigger. Something that happened in between (a held dies trigger
  resolving, another choice's effect) can have killed or recalled it.
- **Once each turn** is implicit for `provoked`: `claimTrigger`
  (EffectInterpreter.ts:101-106) treats `when === 'provoked'` as
  `oncePerTurn`, and `firedThisTurn` already resets at every untap
  (phases.ts:57). Data never sets the flag, so the face does not print "This
  triggers only once each turn" (rulesText.ts:637-638); the reminder says it.
  `claimTrigger` runs after the no-target check (EffectInterpreter.ts:1086-1087),
  which is what makes rule 2's "not spent" true.
- **Beside a held dies trigger: the one exception.** With a Hauntlink
  payable, a dies trigger is held for a window instead of resolving inline
  (EffectInterpreter.ts:1115-1128). 1.8.1's G8 fix makes a held trigger
  resolve where it would have inline for spells, Duties and state-based
  checks outside combat (#451). **Inside combat it does not, today:** the
  regular damage step runs straight after the first-strike step's check
  (combat/damage.ts:38-46), and a held trigger waits for the drain after
  combat ends (Game.ts:1391-1396). The review's probe A, a First Blade
  attacker killing a blocker whose dies trigger gains 5 life, with a second
  pair dealing regular damage: with no link, first-strike damage, death, the
  trigger, +5 life, then regular damage; with a link payable, first-strike
  damage, death, the trigger fires, regular damage, a death, the window, and
  only then +5 life. So "queue Provoked behind the held trigger" cannot keep
  the no-link order in combat, and a test demanding it would fail by
  construction. **The rule instead:** an untargeted Provoked effect resolves
  inline in its own pass even when that pass held a dies trigger, and is
  recorded in `rules.md` as the one exception to "Provoked after the dies
  triggers of its check" (the owner ruled the G8 order on 2026-09-04, so
  this is Q1). Nothing Provoked is ever queued as a `resolveTrigger`.
  Targeted Provoked effects queue as `chooseTarget` entries, behind the held
  trigger, as targeted dies triggers do. The combat gap itself predates
  First Dawn; `rules.md` (Hauntlink, "Where a held trigger resolves") and
  plan-1.9's G8 row should record it.
- **The pass limit.** `checkStateBased` throws after 30 passes (sba.ts:21,
  122). Each link of a cross-provoking chain costs one pass, and death
  passes interleave, so a board full of Provoked creatures could approach
  the budget. **The budget is raised up front**: at the start of each call,
  the limit is 30 plus the number of creatures on the battlefield whose card
  has a Provoked ability (at most 16). Once each turn makes that a hard
  bound. The brief (P3) asked for the mark-trigger depth cap to be extended
  to this path; it is not needed, because once each turn bounds the chain
  where the mark cap (EffectInterpreter.ts:98) guards observers that have no
  such bound. A1 adds a termination test on the worst board the rules allow
  (two full boards of cross-provoking creatures).
- **Previews.** `previewCombat` runs the real combat on a clone
  (combat/damage.ts:69-92), so the block preview will include untargeted
  Provoked effects (a Provoked drain changes the forecast life). That is the
  true outcome; targeted choices stay queued on the clone and are ignored.
  It is UI-only today (DuelScene.ts:2563, 5290).

## Part 2. Hunt

### Rules (for the owner)

*Your creature and the prey each deal damage equal to their Attack to the
other.* Ruled already: the generic Hunt's prey is an opponent's creature, and
you hunt your own only on a card that says so (B5 "you may hunt your own
creatures", narrowed by the rulings of 2026-09-28, rule 2); Bulwark prevents hunting
at any rarity, and a Bulwark creature can be prey (H3a); Hunt damage counts for every damage-reading keyword and trigger,
present and future, and combat-only keywords do not apply (B6); a hunter
provoked by its own Hunt is intended (B7). This spec rules the rest:

1. **Forms (ruled 2026-09-28: Hunt is a bare verb keyword, like Mark).** A
   spell: "Target creature you control Hunts." A source-bound ability is its
   opener, then "Hunt.": "When this arrives, Hunt.", "During your Dawn,
   Hunt.", "Whenever this attacks, Hunt.", and a Duty's or an Empower's
   usual opener followed by "Hunt." The default prey (rule 2) lives in the
   keyword's description, not on the card. A card that overrides it names
   its prey, in templates **APPROVED by the owner 2026-09-29**: "Hunt any
   other creature." (spell: "Target creature you control Hunts any other
   creature.") and "Hunt another creature you control."
2. **Targets.** The hunter and the prey are always two different creatures.
   A creature with Bulwark cannot be chosen as the hunter, and a source-bound
   Hunt on a creature that has Bulwark does nothing. An opponent's
   Untouchable creature cannot be prey; your own can. **Whose prey (ruled
   2026-09-28, the final Hunt ruling).** The generic Hunt (spell, arrival,
   attack, Dawn, Duty, Empower) hunts a creature an opponent controls,
   legal-target rules applied, with no fallback: with none there is no prey
   (an attack or Dawn Hunt does nothing, a Duty or Empower Hunt has no legal
   target). Card text overrides that only when the card declares it: `any`
   (any other creature, your choice, yours included) or `yours` (another
   creature you control). (Q6 first ruled a forced fallback for seven
   arrival and attack Hunts; the bare-keyword ruling widened it to every
   Hunt; this ruling replaced it.) **An arrival Hunt chooses its prey at cast
   (ruled 2026-09-28).** A creature with an arrival Hunt must hunt in order
   to be cast: its prey is chosen when it is cast, like a spell's target,
   under the card's own rule, and with no legal prey it cannot be cast. It hunts as it arrives, with
   its own Attack as it then is. If the prey has left or is no longer legal by
   then, the creature still arrives and does not hunt (as an empowered
   creature keeps only its rider, Q5). Attack and Dawn Hunts stay ordinary
   triggers (no prey, nothing happens); an Empower Hunt already chooses at
   cast and is optional. **A conditional arrival Hunt checks its condition
   at cast (ruled 2026-09-29).** "When this arrives, if you control another
   Dinokin, Hunt.": if the condition holds when the creature is cast, it is
   exactly the rule above (prey chosen at cast; no legal prey, no cast). If
   the condition fails at cast, the creature is cast with no prey and is
   castable whether or not prey exists; as it arrives, it hunts only if the
   condition has become true by then, choosing its prey as an ordinary
   arrival trigger does. If the condition held at cast but fails as it
   arrives, it arrives and does not hunt. The owner's words: "It's a
   conditional Hunt and should be allowed to be played if you don't have a
   Dinokin on an empty board." The uncastable reason, "It can't be cast: it
   has no prey to hunt.", is **APPROVED** (2026-09-29).
3. **Numbers.** At resolution each deals damage equal to its Attack as it
   is then (pumps earlier in the same effect count, so Fang and Horn's
   +2/+2 is in), both at once. 0 or less deals nothing.
4. **Fizzle.** If either creature has left the battlefield or is no longer a
   legal target, neither deals damage. The rest of the card still happens
   (Ambush at the River still draws); the spell only fizzles as a whole when
   every target is gone, as any spell does (resolve.ts:77-91).
5. **Keywords.** Deathblade (either side) makes its damage lethal; Blood
   Oath gains its controller that much life; Provoked applies to both
   survivors; any damage-reading keyword added later applies too. First
   Blade, Twin Blades and Overrun do nothing (Hunt is not combat), and fog
   effects and "prevent combat damage to" do not stop Hunt damage (both
   prevent combat damage only, combat/damage.ts:28 and 209-213).
6. **Readiness.** The Hunt itself neither taps nor needs an untapped or
   seasoned creature, so a spell or arrival Hunt works with a tapped or
   newly arrived hunter. A Duty Hunt pays the Duty's cost and follows its
   rules: untapped, not arrived this turn without Warcry, your own Morning
   or Afternoon (actions.ts:533-563).

### Mechanism (A1)

- **The op.** `{ op: 'hunt'; hunter: 'self' }` for the source-bound form
  (hunter is `sourceIid`, prey is the bound target) and
  `{ op: 'hunt'; hunter: 'target' }` for the spell form (hunter is target
  slot 0, prey is slot 1, a fixed convention like `moveMark`'s from and to).
  `effectOpUsesTarget` returns true for it (types.ts:243-272). The overplan's
  `pump` and `prey` fields are scoring notes, not op fields: the pump is its
  own `boost` op before the Hunt, and the prey is the `opponentCreature`
  spec, or an override's spec (As built, A1.1b).
- **Targeting rules inside the op, on the `moveMark` precedent.** A card
  whose ops include a spell-form Hunt gets the treatment `cardHasMoveMark`
  gets in `targetListsForCast` and `validateTargetList`
  (actions.ts:360-414, 457-503): slot 0 candidates exclude creatures with
  Bulwark (effective keywords, `getEffectiveStats`), and the two slots must
  differ (`sameTarget`, actions.ts:432-439). Legal actions then never offer an
  illegal pair, so the AI and the Duel UI inherit the rule.
- **Legality at resolution needs the specs passed.** `runOps` re-checks a
  target against its spec only when the context carries `targetSpecs`
  (the `else if (ctx.targetSpecs)` branch, EffectInterpreter.ts:873-890; the
  "all slots or none" case at line 881 lives inside it). The callers pass
  `targetSpecs` only for explicit `targetIndex` slots or `maxCost`,
  `minAttack` or `exactly` specs: the spell body (resolve.ts:147), the
  Empower rider (resolve.ts:184) and the Duty (Game.ts:993). Without them an
  op sees only whether a permanent is still there, never whether it is
  still legal, so a prey that gained Untouchable between the cast and the
  resolution would still be hunted. (`moveMark`'s own guard is inline in
  the op, EffectInterpreter.ts:554-567.) So A1 adds "the ops include a
  `hunt`" to the `targetSpecs` condition at all three sites, and extends
  line 881's all-or-none case from `moveMark` to `hunt`: both slots legal or
  neither is dealt. Other ops on the same spell (Fang and Horn's pump)
  keep the existing slot-0 rule (line 882). A source-bound Hunt from an
  arrival or attack trigger chooses its prey in the same action that
  resolves it (Game.ts:886-903), or carries its spec when held
  (Game.ts:881), so it is already current. A source-bound Hunt keeps its
  single `creature` spec with `other: true` (targeting.ts:156 excludes the
  source).
- **The words.** The face prints "another target" only when the spec carries
  `other: true` (rulesText.ts:99). On a spell's prey spec that flag excludes
  nothing (a spell has no source permanent, targeting.ts:156), so the data
  carries it for the wording, and distinctness stays the Hunt op's rule.
- **Bulwark at resolution.** The op itself refuses when the hunter has
  Bulwark (a granted one included: Gothic Monsters prints an aura that grants
  it, gothic-monsters.ts:173), and `activatedBlockers` refuses a Hunt Duty on
  a Bulwark source, so it is never offered.
- **The shared creature-damage path (the evergreen ruling).** Combat builds a
  list of hits, each with its source's Deathblade and Blood Oath read once
  (combat/damage.ts:9-16, 126-206), then applies them together
  (223-248), then fires the Blood Oath life observers (252-257), then
  `combatDamageToPlayer` (260-266). A1 moves the apply-and-observe half into
  one function, `applyCreatureDamage(state, db, emit, hits)` in a new
  `src/engine/creatureDamage.ts`, where every damage-reading keyword is read
  from the source's effective keywords in one place and the struck mark is
  set. **Its hit list is combat's mixed list, player targets included, in
  combat's order**: combat interleaves, hit by hit, the damage to a creature
  or a player and that hit's Blood Oath gain (222-248), then fires the
  `youGainLife` observers (252-257), then `combatDamageToPlayer` (260-266).
  The shared function keeps that per-hit interleaving and then the observer
  pass; combat alone then runs `combatDamageToPlayer`. A function that took
  only creature hits, or applied player hits separately, would reorder the
  events without changing any decision, which the action-log comparison
  cannot see (hence the event digest in the build plan). Combat keeps its
  hit building, first-strike steps, prevention filter, `combatDamage` event
  and the player-damage triggers, and calls the shared function. Hunt builds two hits (both amounts read before either is dealt)
  and calls the same function, with a new `hunted` event before it. A
  keyword added later hooks the shared function once and works for both, with
  no Hunt-specific code. Combat must come out byte-identical, which is the
  point of the proof in the build plan.
- **Other creature damage stays out in 1.9.** Whether "Arrives: this deals 2
  damage" and similar ability damage from a creature should also carry that
  creature's Deathblade and Blood Oath is the question the brief left open.
  On today's pool (census, 2026-09-28) it would change one printed card,
  **Eclipse-Red Queen** (Blood Oath, and "whenever a Marked creature you
  control attacks, 1 damage to your opponent": she would gain 1 life each
  time), and any of the 48 creatures with their own ability damage that is
  handed Deathblade or Blood Oath by one of five granters (Rune of Hunger,
  Rose-Thorn Snare, Seafoam Dagger, Cold-Boot Mask, Parasite Mask). Fourteen
  of those 48 aim their damage at a target, so a granted Deathblade would make
  them repeatable kill effects (Wrecker Lantern-Bearer's Duty, for one). The
  48 count every non-token creature with a `damage` op anywhere on the card;
  5 of them only damage their own controller. One of those five, Oni
  Underboss of Rain, prints Deathblade ("deal 2 damage to you"); lifelink
  and deathtouch on player damage change nothing for her, so Eclipse-Red
  Queen stays the one printed card that would behave differently.
  **Recommendation: not in 1.9** (Q8); the shared function makes it a small
  change later, costed as its own item.

### Deathblade hunters (Q7)

Hunt damage carries Deathblade (B6), so a Deathblade hunter kills anything it
hunts. The overplan's fix, excluding Deathblade from a Hunt spell's hunter,
closes less than it looks: the pool already grants Deathblade on the cheap
(Rune of Hunger, {B} common aura; Rose-Thorn Snare, {1}{G} common Charm), and
on either Duty hunter (Korru, Tracker of the Long Grass) that is an every-turn
kill, which a spell-only exclusion does not touch. The three honest options:

- **A. Accept it, and cost it.** Deathtouch plus fight is a Magic staple;
  the pairing costs two cards (and usually the hunter); the lab measures the
  common Hunt spells and both Duty hunters with a Deathblade host and prices
  from that. *Recommended*, because the owner's H4 ruling named Deathblade
  as applying and the exclusion adds a clause to every Hunt spell.
- **B. "A creature with Deathblade cannot hunt"**, one rule for every form,
  enforced exactly as Bulwark is (the same code path). Closes the Duty case
  too. The fallback if the lab finds the pairing over band.
- **C. The overplan's spell-only exclusion.** Not recommended: it leaves the
  Duty hunters open, so B dominates it.

For A to be measured honestly, the lab's Deathblade arm plays a
Deathblade-dense field, not a single host: the pool holds 46 Deathblade
creatures, and the cheapest hosts are one-mana 1/1s (Dong Bai, Tyrant's
Grandchild and Wharf Rat, both {B}), not the overplan's Ash-Cat Ambusher.

## Part 3. The other gaps

- **`eachYourCreature`** (Q3). A new `damage` recipient beside
  `eachCreature` and `eachOpponentCreature` (types.ts:93;
  EffectInterpreter.ts:326-332), with an optional `other` that skips the
  source. Face template, matching the existing "deal N damage to each
  creature" (rulesText.ts:145-153): "deal N damage to each creature you
  control" and "deal N damage to each other creature you control". Every
  survivor is struck, so Provoked needs nothing more. The AI prices it as a
  source (Part 4). Rows: War Drums of the Ember Clan (R), Trial by Ember (R),
  Drum-Beater of the Ember Clan (C); Uzza the War-Painter uses it but is cut.
  Drum-Beater at common teaches that your own Pack Raptors and Hatchlings die
  to it; that is a design note, not an engine one.
- **Empower may Hunt** (3 rows, all kept: Thorn-Hide Armourback, Tall-Grass
  Tracker, Ridge-Raptor). `validateEmpowerDef` (types.ts:300-329) gains
  `hunt` with one single-target spec, exactly as `destroy` has. The overplan
  said this also needs the "trigger-safe" contract relaxed. It does not: Hunt
  damage only marks damage, and the deaths happen in the state-based check
  after the stack item resolves (Game.ts:1310-1312), so no dies trigger fires
  inside the rider. The allowed `destroy` rider already fires dies triggers
  inline (EffectInterpreter.ts:381-395) and ships on The Drowned Saint. The
  only inline trigger a Hunt can raise is a Blood Oath life-gain observer,
  which the ordinary deferral machinery already carries
  (EffectInterpreter.ts:905-972). The Empower section of `docs/rules.md` is
  stale on both counts (it lists two target shapes, not three, and says
  nothing of the fizzle below); A2 corrects it. **Timing:** the rider runs
  right after the creature's arrival triggers fire (resolve.ts:115-116), and
  a targeted arrival trigger only queues its choice there, so an Empower
  Hunt resolves before the creature's own targeted arrival effect is
  chosen. None of the three Empower-Hunt rows has a targeted arrival, but
  the rules text and `rules.md` should state the order.
- **An empowered permanent fizzles whole** (Q5). A creature cast with
  Empower carries the Empower target as its cast target (resolve.ts:36,
  71-76), and a permanent spell with no legal target left fizzles to the
  graveyard (resolve.ts:77-91). Probe P5 shows The Drowned Saint, cast
  empowered at a creature that then left, going to the graveyard instead of
  the battlefield. For the three Empower-Hunt creatures that means an
  opponent who removes the prey in response counters your creature.
  *Recommended:* a permanent spell never fizzles on its Empower targets; it
  resolves, and only the rider does nothing (Magic's kicker behaves this
  way). It changes The Drowned Saint in that one corner. **The replay
  consequence:** a v15 or v16 log that passes through that corner replays
  differently under rules revision 4 (the Saint enters instead of going to
  the graveyard). *Recommended:* record it in the version note beside the
  Foresee divergence (Replay.ts:20-30, "identically except through such a
  Foresee") rather than bump `rulesRev`: it is the same kind of corner, and
  any card-data change (First Dawn is one) refuses those logs first, as
  `rules.md` says under Foresee. The alternative is rules revision 5 gating
  the new behaviour, which keeps old logs exact at the cost of a revision
  branch in `resolve.ts`.
- **Mandatory Hunts that can only find your own creature** (Q6). A
  targeted trigger is mandatory in this engine: it asks for a target
  whenever one exists (EffectInterpreter.ts:1081-1099) and there is no "you
  may". Seven arrival and attack Hunts in the cut name "another target
  creature" with any controller: Fern-Crown Tyrant, Kesh, Grave-Fern Stalker,
  Frill-Neck Stalker, Fern-and-Fire Raptor, Fern-Shadow Stalker and
  Spear-Thrower of the Ember Clan. When the opponent has no creature (or only
  Untouchable ones) and you have another, each must hunt yours: Spear-Thrower
  (4/2) arriving beside your Hatchling kills it. It also breaks the ruling
  that Easy never hunts its own creatures, since Easy would be forced to.
  *Recommended:* arrival and attack Hunts target "a creature an opponent
  controls"; the self-provoke line lives on the Hunt spells, the Duties and
  the Empower riders, which are optional by nature. This narrows B5 ("you
  may hunt your own creatures") for these seven mandatory triggers only; B5
  still holds for every spell, Duty and Empower Hunt. The alternative engine
  construct (an optional trigger with a decline action, the AI and the UI
  for it) is not worth seven rows. (Superseded later on 2026-09-28: the
  generic prey is an opponent's creature only, Part 2 rule 2.) **Ruled 2026-09-28, otherwise:** the
  seven hunt a creature an opponent controls if a legal one exists, and are
  forced to hunt another creature you control only when none does (Part 2,
  rule 2). No optional trigger is built; the preference is new targeting
  work in A1, and the Spear-Thrower case above stands whenever the opponent
  has no legal prey.
- **Scar-Knife Witch kills itself when it arrives alone** (Q9). "Arrives:
  damage target creature you control 1, then opponent loses 1 life" has no
  `other`, so with no other creature the only legal target is itself, and a
  2/1 dies (probe P2). *Recommended:* "another target creature you control";
  alone, it then does nothing. Coal-Thrower's mandatory ping has the same
  shape but survives it (1/3). Bitter-Blood Brute and Scar-Rite Elder survive
  too.
- **Dropped: the general keyword-qualified target.** With Hunt's own rules
  inside the op, only Bone-Snap Ambush ("Destroy target creature with
  Skyborne", a stretch common the projected cut drops) would use it. If the
  owner restores it, reword it into existing limits (a `minAttack` or
  `maxCost` destroy) or rule the construct for one card.
- **Not built: the targeted dies self-reclaim exclusion** (probe P3). The
  gap is real, no row uses the shape, and a future card that wants it adds it.

## Part 4. The AI

**A1, Hard's reads (on the critical path, because the lab's games are played
by the AI).** They go into the shared value layer and planner, where every
brain reads them, and each term is zero unless a Hunt op or a Provoked
ability is on the board or in the card, so today's pool plays identically:

1. **Hunt target value** (`src/ai/value.ts`, beside `damageTargetValue`,
   value.ts:266-278): simulate the exchange on the public board (both
   amounts, Deathblade, current damage), then add prey killed (removal value,
   signed by controller, value.ts:257-260), subtract hunter lost, and add
   the value of an unspent Provoked on each survivor (plus for ours, minus
   for theirs). The ranking the brief asks for falls out: kill and survive,
   then kill, and a Hunt that only provokes the prey scores below casting
   nothing.
2. **Friendly sources.** Damage aimed at your own creature is priced as a
   cost today (value.ts:266-278 via `harmSign`). With an unspent Provoked on
   a creature that survives, it earns that effect's value; `eachYourCreature`
   sums it over your side. This is what makes the 14 self-source rows in the
   cut (the Standing Stone, the Fire-Pit, Sefa, Hearth-Tender and the rest)
   worth using, and without it the lab would price every source at nothing.
3. **Provoked in combat** (`src/ai/combatPlans.ts`, the heuristic exchange
   at combatPlans.ts:69-101): a combatant that is dealt damage and survives,
   with an unspent Provoked, adds its effect's value, so Hard stops feeding
   an opponent's Provoked wall a blow it survives and values blocks that
   provoke its own. Hard's search already sees Provoked, since it plays the
   real engine.
4. **Casting and Duties**: `opImpactValue` and the Empower value learn
   `hunt` (value.ts:441-471, 1122-1152); `shapesCombat` returns true for it
   (activatedPolicy.ts:37-54); the Hunt spell shape joins the new-vocabulary
   lists so Hard's candidates include it (ai/targeting.ts:54-69, 126-148).

**The proof.** The shared-file order in plan-1.9 puts the weenie speed fix
first in `src/ai`, then these reads. A1 records `scripts/action-log.ts record
--preset broad` before and after, and `compare` must report zero divergent
games; the same run covers the combat refactor in Part 2.

**A2 (beside the set work, before transcription).** Easy never picks its own
creature as prey by choice (a filter in `EasyAI.ts`): it matters on the
cards that declare `any` (the owner's B5); the generic Hunt never offers your
own creature. Easy may skip friendly sources entirely. Medium self-hunts
and aims friendly sources only when the value in item 2 clears a margin.
Draft-picker weights (`src/meta/draftPicker.ts`): Provoked payoffs by source
density in the pool drafted so far, Hunt as removal weighted by the drafter's
creature count, sources by payoff count. Documented-behaviour entries in
`docs/ai.md` for each. **The castability forecasts:** any AI code that
enumerates a card's target specs one by one misses the Hunt pair rule, as it
would `moveMark`'s. The one such site today is Medium's counter forecast
(MediumAI.ts:643-656), which checks each spec with `enumerateTargets` and
special-cases `moveMark`'s distinct hosts; it runs only for cards with a
`cancel` op, so no First Dawn row reaches it, but A2.b gives it the Hunt case
(a non-Bulwark creature of yours plus a different creature) so a later card
cannot read a Bulwark-only board as castable. Every other cast path reads the
engine's legal actions, which already hold the rule.

## Part 5. Costing

**No rate is quoted here; none exists until the lab measures it.** The
overplan's provisional rates (Provoked `0.2 + 0.15 × Defense`, Hunt as
creature burn times a survival factor) stay NEEDS MATH, with their two
stated biases.

**How the lab measures, on the overplan's real shapes.** The harness is the
1.8.5 keyword lab's design (`balance/study/lab/keyword-lab.ts`, local and
gitignored, run from the main checkout or copied in as `cheats.local.ts` is):
synthetic cards in a copy of the card database, each arm a hole in a base
deck filled in place with four copies, so every arm sees the same shuffles
(common random numbers), against the 14-deck field, Hard on both seats with
A1's reads, a Medium check, and mana conversions from cost-shifted arms. What
is new:

- **Provoked:** each arm pairs a payoff (Fern-Back Grazer, Cinder-Crest
  Raptor, Hearth-Shield Maiden, Vessa, The Walking Mountain) with its control
  (the same body without the line), and the harness counts, per game, how
  often the creature is damaged and survives and how often it fires. That
  count is the blind spot the brief names; it replaces the Defense curve with
  measured exposure times survival. The two-card engines (Vessa and The
  Walking Mountain with a free source; Sefa and Ashka, whose Duties provoke
  themselves) are measured in decks that hold the source, since the passive
  rate cannot price them.
- **Hunt:** an arrival Hunt on A/A bodies across Attack 2 to 5, and the same
  across Defense, gives the attack slope and fixes the glass-cannon bias (the
  four LAB FIRST rows: Spear-Thrower, Kesh, Ridge-Raptor, Crag-Leaper). The
  spells are measured in decks at the field's creature density, then in a
  Deathblade-dense field with the one-mana hosts (Q7) and with Oru on the board (her +1/+1 is removal on
  every Dinokin hunter). The two Duty hunters get their own arms. The
  self-Hunt (hunter and prey both yours, both Provoked, through an `any`
  card) is its own arm. The forced-self-hunt arm is dropped (the fallback
  was superseded 2026-09-28); the arrival hunters' arms instead count how
  often they can't be cast for want of prey.
- **The self-source rows** (the 18 lab-priced rows) are measured in the deck
  they are built for (the Stampede, R27, R28 lists), since their value is
  their deck's Provoked density, and their cost is set from that reading.

**The era filter.** Both keywords postdate the 8th-10th-edition anchor era
(fight 2011, enrage 2017). The anchors are the in-era printings the brief
names (Tracker, Karplusan Yeti, Stalking Yeti, Tahngarth, Rivals' Duel,
Predatory Urge for Hunt; Wall of Hope, Saber Ants, Fungusaur and the other
bonus-shaped cards for Provoked), used as sanity bounds on the lab's number,
never as the number. Post-2011 fight and enrage cards inform shape and colour
only, per the card-workbench playbook.

**The scorer terms** (A1, after the lab): new terms in
`src/power/scoreCore.ts`, not `KEYWORD_RATE` rows: `triggerMult('provoked')`
as the measured function of the host (scoreCore.ts:621), a `hunt` case in
`valueOp` (the exhaustive switch at scoreCore.ts:1271 forces it), the
`eachYourCreature` recipient, and the Empower share for a Hunt rider. Each
gets a new section after §4v in the local power formula. The Forge reads the
same code, so it prices First Dawn rows the moment the terms land. Then every
mechanic row is rescored before the owner's cut.

## Part 6. The UI, the words, and the docs

**The Duel card (A2).**

- **The spent Provoked state.** `firedThisTurn` is public battlefield state
  (view.ts:158), so the card can show its Provoked line as spent for the
  rest of the turn. Without it, a creature pinged twice that fires once reads
  as a bug.
- **The two-target flow.** The ordered multi-target picker already narrows
  the legal actions pick by pick (DuelScene.ts:4306-4330), and legal actions
  will only hold legal hunter and prey pairs, so the flow works as it
  stands. A2 adds the step prompts and a Hunt animation.
- **The event audit.** The `switch` sites on game events in `DuelScene.ts`
  (around 3009, 3173 and 3276-3287) and the history log learn `hunted` and a
  Provoked `triggerFired`. The compiler finds the rest: the `TriggerWhen`
  record in `src/data/glossary.ts` (203-225), `scoreCore.ts`,
  `scripts/personas/score.ts`, the Forge's vocabulary, `scripts/audit-overlap.ts`
  and `scripts/mechanicUsage.ts`.

**Rules text and glossary (A2; player copy APPROVED 2026-09-28, Q10; the Hunt
templates RULED later that day as a bare keyword).** Templates:

- "Provoked: [effect]."
- "Target creature you control Hunts." (the spell form)
- "[Opener], Hunt.": "When this arrives, Hunt.", "During your Dawn, Hunt.",
  "Whenever this attacks, Hunt.", and a Duty's or an Empower's usual opener
  followed by "Hunt."
- **APPROVED by the owner 2026-09-29** (a card's own prey): "Hunt any other
  creature." ("Target creature you control Hunts any other creature.") and
  "Hunt another creature you control."
- "Deal N damage to each creature you control."
- "Deal N damage to each other creature you control."

Glossary definitions, in the house style of `MECHANIC_DEFINITIONS`
(glossary.ts:98-121; a lowercase fragment, no closing period):

- **Provoked**: "when this creature is dealt damage and survives, it does
  the listed effect; this triggers only once each turn" (the second clause
  matches the sentence the engine prints for any once-each-turn trigger,
  rulesText.ts:637-638, so the two never read as different rules)
- **Hunt** (RULED 2026-09-28, full sentences, replacing the fragment first
  proposed and two earlier approved versions; it follows the final Hunt
  ruling): "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey."

Duel prompts: "Choose the hunter." and "Choose its prey." The spent state's
tooltip: "Provoked this turn."

**Detection, not text matching.** Provoked and Hunt join `MechanicId`
(glossary.ts:61-77) and are detected structurally (a `provoked` ability, a
`hunt` op), like every mechanic. The inspect panel's keyword regex matches
rules text with word boundaries (rulesText.ts:682-686), never names. Ten
shipped names contain "hunt" (four as the whole word: Alpha of the Wild Hunt,
Rune of the Hunt, Wild Hunt Matriarch, Hunt the Boar), so the test is that
none of them reports Hunt.

**Docs (A2).** `docs/rules.md` gains a Provoked section and a Hunt section
(Parts 1 and 2), a line under State-based actions, the shared damage path
under Combat's Damage, and the Empower correction; `docs/keyword-map.md`
maps enrage to Provoked and fight to Hunt; `docs/ai.md` gets the behaviour
entries. Run `npx tsx scripts/gen-docs-tables.ts` when the event and trigger
unions change. The blades-db dictionary rows are local
(`scripts/blades-db.ts`, main checkout); after them, `terms --check` and a
corpus rebuild.

## Part 7. Records

- **Replay:** no new action (Hunt spells are ordinary casts with two targets,
  Hunt Duties ordinary activations), so the v16 bump I1 took in wave 0
  (Replay.ts:31) covers A1. The card-data stamp refuses older logs once First
  Dawn lands anyway.
- **Rules revision** stays 4. Nothing changes for a shipped card unless the
  owner takes Q5 (the empowered fizzle) or Q8. If Q5 is taken, a v15 or v16
  log through that corner replays differently; the recommendation (Part 3)
  is a line in the version note beside the Foresee divergence
  (Replay.ts:20-30), not a revision bump. **Ruled 2026-09-28:** Q5 taken as
  recommended (the version-note line, no revision bump); Q8 not in 1.9.
- **Save:** no change. `struck` is optional runtime state on `Permanent`,
  and no game state is saved.

## Part 8. The usage audit rows (lane E)

- **Hunt** is an action mechanic: one entry in `MECHANIC_RULES`
  (`scripts/mechanicUsage.ts`), carried by any card with a `hunt` op, matched
  on `castSpell`, `activate` and `chooseTarget`, `repeats` for the Duties.
  Sense checks on the taken action: a Hunt that killed nothing and lost the
  hunter, and a self-hunt (counted apart, so Easy's zero and Medium's rate
  are visible).
- **Provoked** is passive, so its row is an event count in the collector
  (`scripts/mechanicUsageCollector.ts`): Provoked fires per game per boss,
  and how many came from the controller's own sources. Passive mechanics stay
  out of the audit's waves 0-2 (U3), so it is read in wave 4's targeted read.

## Part 9. Tests (behaviour only; the owner's testing rules apply)

Each names the behaviour it guards; none pins counts, copy or generated
order. A1:

- **Provoked:** survives a non-lethal spell and fires; dies to lethal
  damage, and to 1 Deathblade damage, and does not fire; 0 damage and
  prevented damage do not fire; a second survived blow in the same turn does
  not fire, and the first one next turn (either player's) does; a targeted
  Provoked with no legal target does not spend the turn's firing; in one
  pass a dies trigger resolves before a Provoked trigger, and a survivor
  finished off by that dies trigger is not provoked; under First Blade an
  untargeted Provoked "+2/+0" adds its damage in the regular step, and a
  targeted one is chosen after combat damage; with a Hauntlink payable, an
  untargeted Provoked effect resolves in its own pass, ahead of that pass's
  held dies trigger (the ruled exception, asserted as such, never as "same
  order as the no-link game"); a targeted Provoked whose creature is killed
  or recalled before its choice is answered does nothing; a targeted
  Provoked raised in a Dawn check pauses the Dawn and resumes it; a Preserve
  token or Nine Lives return of a creature already provoked this turn can be
  provoked again; the worst cross-provoking board terminates within the
  raised pass budget.
- **Hunt:** both deal effective Attack at once; a pump earlier in the same
  spell counts; 0 Attack deals nothing; hunter gone or prey gone: nothing
  dealt, the spell's other ops still happen; legal actions never offer a
  Bulwark hunter or one creature in both slots; a hunter that gains Bulwark
  before resolution deals nothing; a Bulwark prey is legal; an opponent's
  Untouchable creature is not legal prey, your own is; Deathblade kills both
  ways; Blood Oath gains; First Blade does not split the exchange; fog and
  "prevent combat damage to" do not stop it; a self-hunt provokes both
  survivors; a Duty Hunt is refused tapped or newly arrived without Warcry,
  while a spell Hunt works with a tapped hunter; an Empower Hunt resolves
  after the creature's arrival triggers.
- **Shared damage path:** combat's existing tests pass unchanged, and the
  identical-action-log comparison and its event digest are clean. The
  replay "goldens" do not prove this on their own: they record a game and
  replay it on the same engine (self-consistency), nothing pins event order
  across versions, and `compare` in `scripts/action-log.ts` compares actions
  only.
- **`eachYourCreature`:** damages only your creatures; `other` spares the
  source; survivors are provoked.
- **Data integrity** (catalog tests, allowed by the rules): Provoked only on
  creatures, one per card; no Provoked effect damages its controller's
  creatures or Hunts (P3); no Bulwark creature prints a source-bound Hunt;
  the H5 limits the overplan checks by script (source-bound hunters below SR
  at Attack 4 or less, never Hunt and Deathblade on one card below SR, Duty
  Hunts only at SR and above and at most two).

## Part 10. The build plan

**A1, on the critical path, after the owner rules this spec.** In order;
each PR's gate is the ladder plus what it names.

| PR | What | Files | Must prove |
| --- | --- | --- | --- |
| **A1.1 Engine** | Provoked (type, struck mark, SBA firing, once each turn, the raised pass budget, the held-trigger exception); the Hunt op, its targeting rules and the `targetSpecs` condition at its three call sites; `applyCreatureDamage` with combat moved onto it; `eachYourCreature`; the Empower allowlist; the empowered-permanent fizzle (if Q5 goes as recommended); validators; the compile-required stubs in every exhaustive switch the new op and trigger break (the scorer stubs report NEEDS MATH as unknowns); the event digest in the harness | `src/engine/types.ts`, `effects/EffectInterpreter.ts`, `sba.ts`, `combat/damage.ts`, new `creatureDamage.ts`, `actions.ts`, `resolve.ts`, `Game.ts` (line 993's condition), `events.ts`, `src/data/glossary.ts` (the record entries only), `src/ui/rulesText.ts` (stub cases: `opText`'s switch has no default and must return a string, rulesText.ts:136-315), `src/forge/validate.ts` (an `OP_RULES` entry, the `Record<OpKind, ...>` at line 194), `src/forge/vocab.ts` (`TRIGGER_OPENINGS` and `TRIGGER_LABELS`, the `Record<ScorableTriggerWhen, ...>` at lines 80 and 102), `src/power/scoreCore.ts` (stubs), `scripts/personas/score.ts`, `scripts/audit-overlap.ts`, `scripts/action-log.ts` (the digest, agreed with lane F), `tests/engine/` | Part 9's engine tests; replay goldens unchanged; **two hard gates on the broad preset, before and after: identical action logs, and an identical per-game digest of the event stream**. Actions alone cannot see combat's events reordering |
| **A1.2 Hard's reads** | Part 4 items 1-4 | `src/ai/value.ts`, `src/ai/combatPlans.ts`, `src/ai/activatedPolicy.ts`, `src/ai/targeting.ts`, `tests/ai/` | action logs identical on the broad and weenie presets, against a tip that already has the weenie fix; behaviour tests on the Hunt ranking and the friendly-source value on fixture cards |
| **A1.3 The lab** | Part 5's arms, run from the main checkout, results written up locally | `balance/study/lab/` (local only) | the measured rates with their intervals, the fire-rate counts, the Deathblade-host and Oru readings, the self-Hunt arm through an `any` card, and how often an arrival hunter can't be cast for want of prey |
| **A1.4 The rates** | The scorer terms and the local formula sections; the overplan's mechanic rows rescored | `src/power/scoreCore.ts`, `tests/power/`, the Forge's labels if any | Forge and in-game scorer agree (same code); every rescored row listed for the cut |

A1.1 changes `types.ts` first; R13's removal of `flavor` rebases onto it
(plan-1.9 Sequencing). A1.2 waits for the weenie fix in `src/ai`. A2.c
rebases onto A1.1's stub entries in `rulesText.ts`, `glossary.ts` and the
Forge files and replaces them with the real templates and labels.

**A2, beside the set work, before transcription.** These have disjoint file
sets and can run in parallel once A1.1 lands (A2.b after A1.2):

| PR | What | Files |
| --- | --- | --- |
| **A2.a Duel UI** | Spent Provoked state, the two-target prompts, the Hunt animation, the event `switch` audit | `src/scenes/DuelScene.ts` (after lane D's duel preload), `src/ui/BoardCardView.ts`, `src/ui/duelPresentation.ts`, `src/ui/targetSelection.ts`, the history log |
| **A2.b Medium, Easy, draft** | Part 4's A2 half; Easy never hunts its own creature by choice on an `any` card (B5) | `src/ai/MediumAI.ts`, `src/ai/EasyAI.ts`, `src/meta/draftPicker.ts`, `tests/ai/`, `docs/ai.md` |
| **A2.c Words** | Templates, glossary definitions and icons, `rules.md` (including, under Hauntlink's "Where a held trigger resolves", the known combat gap of item 10 in "What this spec corrects": a dies trigger held in the first-strike step resolves after the regular damage step), `keyword-map.md`, `gen-docs-tables`; locally, the blades-db rows and `terms --check` | `src/ui/rulesText.ts`, `src/data/glossary.ts`, `src/ui/KeywordIcons.ts`, `docs/rules.md`, `docs/keyword-map.md` |
| **A2.d Tools** | The converter's target walk: a Hunt spell is dead without a non-Bulwark creature of your own, and every generic Hunt is dead without an opponent's creature (an arrival hunter can't be cast; `NARROW_TARGETS`, avatarReserveDecks.ts:98-110); the usage audit rows, with an `any` self-hunt counted apart | `scripts/avatarReserveDecks.ts`, `scripts/mechanicUsage.ts`, `scripts/mechanicUsageCollector.ts` |

**Risks.**

- **The combat refactor.** Moving combat's damage onto the shared function
  is the one change that touches every game. The action-log comparison
  catches any decision it moves but compares actions only, so the event
  digest is a hard gate, not a nicety (a small addition to
  `scripts/action-log.ts`; lane F owns the file and should agree to it), and
  the combat and first-strike tests must pass unchanged.
- **The held-trigger machinery.** The G8 code (Game.ts:492-712) is the most
  intricate in the engine, and it cannot keep the no-link order inside
  combat anyway (Part 1). So Provoked stays out of it: untargeted effects
  resolve inline in their pass (the ruled exception, Q1), and targeted ones
  use the plain `chooseTarget` queue, never a `resolveTrigger` entry.
- **The lab depends on the AI.** A naive Hunt target policy would price Hunt
  low, which is why the Hard reads come first; if A1.2 slips, A1.3 slips.
- **`eachYourCreature` sits on the threshold.** One of its three rows cut
  and it no longer clears B10 (Q3).

**What slips if the train runs long.** Nothing in A1 can slip: it is the
cut's input. In A2, in order of what can wait: Medium's self-provoke margin
(Medium can decline self-hunts, as Easy does); the draft-picker weights (the
picker's generic card value stands in); the Provoked usage counter (read in
wave 4 anyway); the Hunt animation (a plain damage flash stands in). The
spent Provoked state, the rules text and glossary, and the converter's walk
do not slip: transcription needs them.

## As built (A1.1)

A1.1 built Parts 1-3 on `feat/19-a1-engine` with the owner's rulings of
2026-09-28 (E1-E10, and the later bare-keyword ruling). Where the build
differs from the text above:

- **The prey rule, as A1.1 built it, is superseded.** A1.1 built the
  fallback ("an opponent's creature if able, else another of yours") as
  `opponentIfAble` on a `creature` spec. The final Hunt ruling (2026-09-28)
  dropped the fallback, and A1.1b removed the flag from the engine, the
  validator and the tests (see "As built (A1.1b)").
- **A targeted Provoked choice with a Hauntlink payable.** It fires and queues
  as a plain `chooseTarget` (never a target-less `resolveTrigger`, so
  `isHeldDiesTrigger` never sees it). Once its target is chosen it gets the
  revision-4 window every targeted trigger gets, as a `resolveTrigger` that
  carries its target and a `provoked` mark, and it re-checks survival when it
  resolves. This is no new exception: revision 4 opens a window over every
  targeted trigger, and the owner's E1 exception covers untargeted Provoked
  effects only (ruled keep, 2026-09-28). Survival is re-checked at two
  reachable points: before its choice is raised (a creature killed or
  recalled first makes it fizzle without a choice) and when a held one
  resolves. A third check, when the choice is answered, cannot be reached in a
  live game and stays only as a guard.
- **Hunt's own rules reach the Duty too.** A hunting Duty never offers its own
  source as prey (the Duty's rule, not only `other` on the spec), and
  `activatedBlockers` refuses it on a creature with Bulwark, printed or
  granted.
- **A fourth `targetSpecs` site.** Besides the spell body, the Empower rider
  and the Duty, the revision-4 hold over an answered targeted trigger
  (`Game.ts`, the `chooseTarget` apply) passes the spec when the ops Hunt,
  so a prey that gains Untouchable in the window is not hunted.
- **E5 reaches three shipped cards, not one.** Every empowered permanent with
  Empower targets now resolves when those targets are gone: The Drowned
  Saint, Renenutet, Who Measures the Flood, and Tidewalk Analyst. Only the
  rider is lost. The broad preset never reaches that corner (0 action and 0
  digest divergences). The v16 version note in `src/meta/Replay.ts` records
  it beside the Foresee divergence; no rules-revision bump (ruled
  2026-09-28).
- **The validators are wired into the catalog test now.**
  `validateProvokedDef` and `validateHuntDef` (types.ts) cover P5, P3's "no
  Provoked effect Hunts", "no Bulwark creature prints a source-bound Hunt",
  the carrier shapes, the prey rule (A1.1b), no Hunt inside
  an If-marked branch (the branch re-runs against its one bound target, so the
  Hunt could never see both creatures), and no spell-form Hunt on a card whose
  Empower brings its own targets. `tests/data/catalog.test.ts` runs them over
  `ALL_CARDS`, so lane B's rows meet them as they land.
- **Rules-text stubs** (`rulesText.ts`) print the ruled bare keyword: the
  opener, then "Hunt."; the spell form "Target creature you control Hunts."
  (", then it Hunts" after a pump that named the hunter). A2.c owns the
  words.
- **Scorer stubs.** `TRIGGER_MULT` is a total record, so it holds
  `provoked: 0`, which nothing reads: `triggerMult('provoked')` reports
  NEEDS MATH as an unknown and prices the effect at 0, as the `hunt` op and
  the `eachYourCreature` recipient do. The Forge validates `hunt` and
  `eachYourCreature` ops but does not offer them, or Provoked, in its editor
  yet (A1.4 and A2.c).
- **The pass limit is read each pass**: 30 plus the Provoked creatures on the
  battlefield at that pass, so a carrier that arrives mid-check extends it.
  With no Provoked card in play it is exactly 30.
- **Small shapes.** The `hunted` event carries both amounts; `fireTriggers`
  returns whether anything fired (the state-based check's "changed"); the
  Forge accepts `other` on a `damage` op only with `to: 'eachYourCreature'`.
- **The gates.** On the broad preset (210 games), before and after: 0
  action-log divergences and 0 event-digest divergences. "Before" was recorded
  with the digest-enabled `scripts/action-log.ts` on the unchanged 0bf96c5
  engine, before the first engine edit. A deliberate reorder of combat's
  Blood Oath gains (no decision changed) showed 0 action and 92 digest
  divergences, so the digest sees what the actions cannot.
- **Hand-offs to A2.**
  - A2.a: `hunted` is emitted even when both Attacks are 0, so the Hunt
    animation must expect an exchange that deals nothing.
  - A2.c (`rules.md`): a targeted Provoked whose targets vanish before its
    choice is raised fizzles and stays spent for the turn, as targeted dies
    and arrival triggers do.

## As built (A1.1b): the arrival Hunt chooses its prey at cast

The owner's ruling (2026-09-28): a creature with an arrival Hunt must hunt in
order to be cast; its prey is chosen when it is cast; with no legal prey it
cannot be cast; it hunts as it arrives; a prey gone or no longer legal by then
leaves it arriving without hunting. Attack and Dawn Hunts are unchanged, and
so is the Empower Hunt. Two more rulings the same day joined A1.1b: card
text may override the prey, and the generic Hunt's prey is an opponent's
creature only, with no fallback. The ruled description is now "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey."
The owner amended it on 2026-09-29, so players do not expect First Blade to
protect a hunter: the first sentence ends "to the other, at the same time."
and is followed by "First Blade and Twin Blades don't apply to a Hunt." The
engine is unchanged; the exchange was always simultaneous.

- **The prey, and its overrides.** The default prey spec is
  `{ what: 'opponentCreature' }`. A card overrides it by declaring `prey` on
  the `hunt` op: `'any'` with `{ what: 'creature', other: true }`, or
  `'yours'` with `{ what: 'yourCreature', other: true }` (`other` on the
  source-bound forms, so the hunter is never offered as its own prey; the
  spell form's two slots are kept apart by the op). The spec carries the rule
  the engine enforces, so targeting is unchanged; `validateHuntDef` accepts
  exactly the default spec with no declaration, or a declared override with
  its matching spec, and refuses anything else. The `opponentIfAble` flag,
  its targeting rule and its tests are removed (B10: no card uses the
  fallback). The rules-text stubs print "Hunt any other creature." and "Hunt
  another creature you control." (APPROVED 2026-09-29), the default "Hunt.".
- **The data stays an `arrives` ability** with `{ op: 'hunt', hunter: 'self' }`
  and one prey spec. The engine lifts it:
  `arrivalHuntIndex` (EffectInterpreter.ts) finds it on a creature, and
  `castTargetSpecs` (resolve.ts) returns its spec as the card's cast target,
  exactly as an Aura's. So `targetListsForCast` offers one cast per legal
  prey and none when there is none, `validateTargetList` refuses a cast
  without one, the Darling cast and `reasonUncastable` read the same specs,
  and the AI and the Duel UI see ordinary cast targets.
- **No fizzle on the prey.** `resolveStackItem` skips the whole-spell fizzle
  for a cast on an arrival Hunt's prey, beside E5's `riderTargetsOnly`: the
  creature always arrives.
- **The order.** A cast arrival passes the prey to `fireTriggers`
  (`castHuntTargets`), which runs the Hunt inline in its printed place among
  the creature's arrival abilities, as an untargeted arrival ability resolves
  today, with the spec re-checked (a prey gone or illegal is hunted by no
  one, and the ability is then skipped silently and left unspent, as a
  targeted trigger with no legal target is). So an untargeted arrival ability
  printed before it resolves first and one printed after it resolves after; a
  targeted arrival ability still queues its choice and resolves after;
  ally-arrival observers follow; the Empower rider (E4) runs after all of
  them. No state-based check runs inside the stack item (the engine's
  convention), so a hunter dealt lethal damage by its own earlier arrival
  ability still hunts, with its full Attack, and dies in the check after.
  No Hauntlink window opens over it (its target was chosen at cast, and the
  stack's own window came first).
- **An arrival that is not a cast** (a token, a Preserve copy, a raise, a
  Nine Lives return) fires the arrival Hunt as an ordinary targeted trigger:
  the prey rule applies, and with none it does nothing.
- **A conditional arrival Hunt** ("Arrives, if you control another Dinokin:
  Hunt.") is lifted too: it needs prey to be cast, and the condition is read
  as it arrives, so with the condition unmet it arrives without hunting.
  This follows the approved sentence literally; see the A1.1b report.
  **Superseded by A1.1c** (the owner's ruling, 2026-09-29): the condition is
  checked at cast, and with it unmet the creature is cast with no prey.
- **Validators.** `validateHuntDef` refuses a second arrival Hunt on a card
  and an arrival Hunt beside Empower targets (the cast has one set of
  targets). It checks every prey spec against its rule, as above.
- **One predicate** decides what an arrival Hunt is: `isArrivalHunt`
  (types.ts), read by `arrivalHuntIndex` and by `validateHuntDef`.
- **The uncastable reason.** `reasonUncastable` says, for a creature whose
  arrival Hunt has no prey, player copy **APPROVED by the owner
  2026-09-29**: "It can't be cast: it has no prey to hunt."
- **Hand-off to A1.2 (Fable's review):** the AI's cast-target policy (`src/ai/targeting.ts`, `vocabularyCastTargetValue`) reads only `when === 'spell'` abilities, so an arrival Hunt's prey variants all score 0 (undefined for an `any` card), and `applyVocabularyTargetPolicy` keeps only the first: every AI level casts an arrival hunter at the first opponent creature in battlefield order. A1.2 values the hunt op from the arrival ability, or exempts hunt specs from the collapse.
- **Records.** The prey rides the existing `castSpell` and `castDarling`
  `targets` and the stack item's `targets`, so the action log and replays
  carry it with no new field and no replay version.
- **The arrival rule follows the card's own prey:** a default arrival hunter
  can't be cast without an opponent's legal creature, a `yours` one without
  another creature of yours, an `any` one without any other creature.
- **The gates.** Broad preset, base 0d0f665c against A1.1b: 210 games, 0
  action-log divergences, 0 event-digest divergences (no shipped card has a
  Hunt).

## As built (A1.1c): a conditional arrival Hunt checks its condition at cast

The owner's ruling (2026-09-29): "It's a conditional Hunt and should be
allowed to be played if you don't have a Dinokin on an empty board." A
conditional arrival Hunt ("When this arrives, if you control another
Dinokin, Hunt.", a `condition` on the lifted `arrives` ability) checks its
condition when the creature is cast.

- **Condition holds at cast:** as A1.1b. The prey is chosen at cast; with no
  legal prey the creature can't be cast, and a cast without prey is refused.
- **Condition fails at cast:** the creature is cast with no target, whether
  or not prey exists (a cast naming prey is refused). As it arrives, the
  ability takes the ordinary targeted arrival-trigger path: with the
  condition still false nothing happens; if it has become true (another
  Dinokin or a lord arrived in between), the controller chooses its prey
  then, as for an arrival that is not a cast.
- **Condition holds at cast, fails as it arrives:** it arrives and does not
  hunt (the existing re-check in `fireTriggers`).
- **The shape.** `castTargetSpecs` stays pure (its callers read the printed
  shape). `actions.ts` gains `castTargetSpecsNow`, the cast's specs on the
  current board: the arrival Hunt's prey spec, or none while the lifted
  ability's condition fails (read with `conditionSatisfied`; the creature is
  not on the battlefield, so every creature there is "another"). The
  hand-cast enumerator and validator, `hasCastableVariant`, the Darling
  cast's enumerator and validator, and `reasonUncastable` read it, so the
  empty target list is offered and accepted exactly when the condition
  fails, and "no prey" is never the reason then. The override casts
  (Hauntlink, a Retell body, Empower targets) are unaffected.
  `resolveStackItem` passes `castHuntTargets` only for a cast that named
  prey; a cast with none leaves the ability to the ordinary branch, which
  checks the condition first.
- **The Duel UI** keys "targeted" off the offered actions' targets, so the
  empty-target cast plays as an untargeted creature; no scene change.
- **The AI.** The empty-target cast is an ordinary legal cast;
  `arrivalHuntCastValue` scores it 0 (no prey), and Easy, Medium and Hard
  each cast the creature with no target on an empty board and beside prey
  it cannot hunt (tested).
- **Unchanged:** unconditional arrival Hunts, attack and Dawn Hunts, and the
  Empower Hunt.
- **Refused: a conditional arrival Hunt beside a Rite or Tithe.** The
  condition is read on the board before a Rite or Tithe sacrifice is paid,
  so a Dinokin sacrificed to cast the creature would still satisfy it at
  cast. `validateHuntDef` refuses the combination (Fable's review,
  2026-09-29), so no row can reach that case silently. No First Dawn row
  combines the two.
- **Approvals recorded (2026-09-29):** the uncastable reason "It can't be
  cast: it has no prey to hunt." and the override templates "Hunt any other
  creature." (spell: "Target creature you control Hunts any other
  creature.") and "Hunt another creature you control."

## As built (A1.2): Hard's reads

A1.2 built Part 4's items 1-4 and the A1.1b hand-off in `src/ai`
(`value.ts`, `targeting.ts`, `combatPlans.ts`, `activatedPolicy.ts`; no
change to `HardAI.ts`: Hard reads them through its Medium, its target search
and the shared policies). `docs/ai.md`, "Hunt and Provoked", records the
behaviour; `tests/ai/huntProvoked.test.ts` pins it on fixture cards.

- **Item 1, the Hunt value** (`huntExchangeValue`). As Part 4 says, plus two
  terms it left implicit: Blood Oath's life at the `gainLife` rate (0.35 a
  point), and a hunter with Bulwark worth 0 (the op does nothing). Damage a
  survivor takes keeps the residual targeted damage reads (0.45 a point,
  `damageTargetValue`): a gain on an opponent's creature, a cost on yours, so
  a self-hunt that marks damage on your own creature is priced as a friendly
  ping is, never free (the review's fix, 2026-09-29). A Hunt that only
  provokes an opposing creature still scores below casting nothing whenever
  its Provoked outweighs that residual; an exchange in which neither deals
  damage scores exactly 0. Every Hunt
  carrier reads it: the source-bound op through `targetValueForAbility`
  (attack and Dawn choices, a hunting Duty through the Duty scorer), the
  spell form through `spellTargetsValue` (slot 0 hunts slot 1, after a pump
  earlier in the same spell), and an arrival or Empower Hunt at cast with the
  arriving creature as the hunter (its effective stats with the board's
  statics).
- **What a Provoked is worth** (`provokedValue`): the effect scored the way a
  Duty's use is (`activatedAbilityValue`'s machinery: its best legal targets
  on the public board, from its controller's side), on the board after the
  provoking damage (the dead gone, the damage marked); 0 when spent this
  turn (`firedThisTurn`), when a targeted effect has no legal target, or when
  its condition is unmet on that board (the engine skips it; the test is the
  engine's own, read from the public board, with "another" excluding the
  creature itself and a creature that died this turn, the provoking damage's
  deaths included, counting). A Provoked effect's own provoking is not
  followed (one level), so no chain of reads can recurse.
- **Item 2, friendly sources.** Targeted damage (`damageTargetValue`) and
  the all-creature sweeps (`symmetricCreatureSweepValue`, which now takes
  `eachYourCreature` with its `other`) add each survivor's unspent Provoked:
  plus for yours, as Part 4 says, and minus for an opponent's, the same
  signing items 1 and 3 use. A Duty that damages each creature you control
  is priced by that sum, and a Charm or Ritual body that does is too
  (`cardValue` with the public board).
- **Item 3, combat.** Each combatant carries its unspent Provoked's value;
  the attack score and each block pair add the survivors' swing. The
  double-block search does not read it. `Combatant.provoked` is scored on the
  board before combat, so a Provoked blocker's best target may die in the
  same combat; accepted for now.
- **Item 4.** `opImpactValue` and `empowerValue` price `hunt` card-shaped at
  1.5, half of Empower's destroy (provisional, beside `moveMark`'s 0.75; the
  board value is what every target decision uses); `shapesCombat` includes
  it; every card with a Hunt anywhere is a new-vocabulary cast for Hard.
- **The hand-off: valued, not exempted.** `vocabularyCastTargetValue` values
  an arrival hunter's prey from its arrival ability (`arrivalHuntCastValue`,
  0 when the ability's condition is unmet on the public board), and the Hunt
  spell's and the Empower Hunt's through the pair above. The collapse then
  keeps the best prey, and Easy, Medium and Hard all cast at it (tested for
  each). Exempting hunt specs would have left Medium and Easy at the first
  prey, since their own cast scores do not read targets; Hard simulates the
  one variant the policy keeps.
- **Not read (A2 or later).** A Darling with an arrival Hunt (`castDarling`
  is outside the cast-target policy, so its prey variants are all kept and
  the brain takes the first); Medium's removal ladder (`removalValueForCast`)
  on a Provoked creature; `evaluate()` has no term for an unspent Provoked
  on the board. `shapesCombat` for a Hunt Duty is reached only by a hunter
  that cannot attack, since a creature that can attack never uses its Duty
  in the Morning. A pump earlier in a Hunt spell that takes the prey to 0
  toughness or less is not valued as a kill by the Hunt read (no card does
  this yet).
- **For A1.3, the lab's brief.**
  - The lab prices with **Hard**. Medium and Easy cast an arrival hunter
    whenever it is legal, even when every prey kills it: their cast score
    reads no Hunt value (A2.b).
  - Until A2.b, Easy self-hunts with an `any` Hunt whenever the shared value
    says it pays.
  - If a First Dawn Darling in the cut prints an arrival Hunt, the Darling
    cast still takes the first prey (A2.b).
- **The gates.** `scripts/action-log.ts` with four workers, weenie preset 112
  games and broad preset 210 games, 0 action-log divergences and 0
  event-digest divergences on each: first against the unchanged base
  f2c25228, then, after the review's fixes, against 066f1dc7 (A1.1b as
  merged, with the A1.2 AI files swapped out) and against the unfixed A1.2
  commit 7c6d2a12. A control (an ungated 0.3 swing in the combat planner's
  Provoked term) diverged 55 of the 112 weenie games.
- **Tests.** Twenty behaviour tests, each shown to fail with its term
  switched off (eighteen mutations, listed in the A1.2 reports).

## As built (A2.c): the words

A2.c replaced A1.1's stubs with Part 6's approved copy in
`src/ui/rulesText.ts`, `src/data/glossary.ts` and `src/ui/KeywordIcons.ts`,
and wrote the rules into `docs/rules.md` and `docs/keyword-map.md`.

- **Templates.** Every carrier prints its opener and then "Hunt."; the
  spell form "Target creature you control Hunts.", and ", then it Hunts"
  after an op that named the hunter. The spell-form Hunt now counts as
  naming its hunter, so an op after it on the same slot reads "that
  creature", never a second "target creature you control". A conditional
  arrival Hunt prints the shipped conditional-arrival template, "If you
  control another Dinokin, when this arrives, Hunt." (Astral Biomancer's
  shape), not the "When this arrives, if ..." order the A1.1c notes quote.
- **Glossary.** `hunt` and `provoked` join `MechanicId`, detected from a
  `hunt` op on any carrier and a `provoked` ability (`TRIGGER_MECHANIC`),
  never from a name or from rules text; both sit after Propagate in the
  Mechanics tab and the Keyword Guide. Hunt's ruled full-sentence definition
  is the one exception to the fragment house style, named in
  `FULL_SENTENCE_DEFINITIONS`; the glossary test holds it to the sentence
  style and every other definition to the fragment.
- **Icons.** Hunt is three claw marks; Provoked is the anger mark (four
  veins around a pinched cross). Neither is a hand, a weapon pair or an eye.
  Both APPROVED by the owner 2026-09-29.
- **Docs.** `rules.md` gains Provoked and Hunt sections, a line under the
  state-based actions, the shared damage path under Combat's Damage, the
  Empower correction (four target shapes, the E5 no-fizzle rule, the rider's
  timing), G8's combat gap under Hauntlink (item 10 below) and "combat and
  Hunt damage" for Blood Oath and Deathblade (item 13). `keyword-map.md`
  maps Fight to Hunt and Enrage to Provoked. No generated table changed.
- **Not enforced:** "no Provoked effect damages its controller's own
  creatures" (P3's damage half) is a design rule with no validator or
  catalog test; `validateHuntDef` covers only its "never Hunts" half.

## As built (A1.5): the repeatable mana pump

The owner's ruling (2026-09-29): a new red Ultra Rare for First Dawn, the
set's Shivan Dragon and its only red Skyborne card (working text: "Vyra,
Ember-Sky Rider", {4}{R}{R}, 5/5, Legendary Creature: Human Rider, Skyborne,
"{R}: This gets +1/+0 until Sunset."). Its ability is a new construct: a
non-tap, mana-only activated ability, used any number of times at Charm speed,
including after blockers are declared. The Duel UI shows a small +/- ticker so
the player picks a count and commits once, so the engine action carries the
count. `docs/rules.md`, "Repeatable mana abilities", has the rules.

- **The shape.** `CardDef.manaActivated?: ManaActivatedDef[]`, each
  `{ cost: ManaCost; ops: EffectOp[] }`, beside and apart from `ActivatedDef`
  (a Duty taps; that type is unchanged) and `manaAbility` (what a permanent
  taps for). `validateManaActivatedDef` keeps it narrow (B10): creatures only;
  a mana cost of at least one and nothing else (a tap cost is refused, and a
  free cost would let it run without end); no `targets`; every op a `boost`
  with `scope: 'self'` and no keywords (+N/+M only, Fable's review). The engine offers an ability only while its card
  passes (`manaActivationsOf`, cached per card), and the catalog test runs
  the validator over every card.
- **The action.** `{ type: 'activateMana'; iid; abilityIndex; times;
  manaPlan? }`. Offered in its controller's own main phase and in every
  response window they hold (`respond`, `endStepWindow`; not the
  Hauntlink-only window), while the creature is on the battlefield under their
  control and one activation is payable. Legal actions list one entry per
  ability carrying the most the player can pay (`maxManaActivations`); the
  validator accepts any whole count from 1 to that. The payment is one
  `solveMana` over the cost times the count (`repeatedManaCost`), or the
  action's `manaPlan` for the whole count. The count's probes are bounded by
  the untapped sources over the cost's mana value, and `solveMana` now checks
  Hall's condition over the pip colours before its backtracking search, so a
  payment that cannot be made is refused by counting (Fable's review measured
  the old search at 11 s a call with eleven red sources and a forest, and
  about two minutes with twelve; the test pins twelve). It resolves at once, off the stack,
  like a Hauntlink link: the cost is tapped (`manaTapped`), one
  `manaActivated` event carries the count, the ops run `times` times, and a
  state-based check follows. No window opens over the pump itself; the same
  player keeps the decision, so a response window stays open for them until
  they pass it.
- **The defender's reply** (Fable's review, under the owner's "as a Charm"
  ruling). The attacker's pump in a combat response window counts toward the
  revision-2 reopen (`resolvedSinceOffer`), so once the attacker passes, the
  defender is offered one reopened window over the blocks if they hold a
  castable Charm or a payable pump in the fight, within
  `maxWindowReopensPerStep`. Reopens only go to the defender, so the
  defender's own pump earns nothing and passing the reply goes to damage;
  each pump costs mana, so it cannot loop. Without it the attacker's pump was
  unanswerable, and a defender could only pump blind before blocks. The
  attacker gets no answer to the defender's reply pump; the owner agreed
  (2026-09-29), to keep the exchange from chaining.
- **The auto-pass rule** (`hasCombatManaActivation`, read by
  `hasCastableInstant` and `hasCastableCharm`). A payable pump keeps a window
  open for its controller only during combat and only on a creature still in
  the fight: an attacker, a blocker, or, while the attackers are declared and
  unblocked, a creature of the defender's that can block one of them. That
  opens the attacker's window over the blocks and the defender's window over
  the attackers (and a window over a spell cast in combat) when either side
  could pump. A spell cast in a main phase, Sunset and every other window
  auto-pass as before.
- **The AI** (`src/ai/pumpPolicy.ts`; every read returns nothing unless an
  `activateMana` is legal, so no current game changes). Hard, in a combat
  response window: first lethal (the fewest pumps that make this combat's
  damage kill, spending any mana); then a fight's trade (the fewest pumps
  giving a blocked attacker's or a blocker's fight its best creature trade,
  priced with `permValue`; this is also the defender's read in its reply
  window after the attacker's pump, where it pumps a blocker to kill the
  attacker or to survive it); then, as the defender before blocks, the fewest
  pumps after which a creature kills an attacker it can block alone, when
  that lone block's trade favours Hard (the block search then sees the bigger
  blocker); then the race (the fewest pumps of an unblocked attacker that
  take a turn off Hard's clock on the opponent). All but lethal spend only
  spare mana: what is left while the dearest card Hard could cast next stays
  payable (on its own turn any card, for main two; on the opponent's turn a
  Charm), and the pump then carries a `manaPlan` that keeps it. Otherwise Hard
  passes, and Medium's rule never decides for it (`withoutPumps`). Medium and
  Easy share one rule in their own window over the blocks: an unblocked
  attacker pumps with all the mana there is; a blocked one pumps the fewest
  times that kill every blocker, when fewer do not. Easy's random pass does
  not apply to it (a mechanic policy call, as its Hauntlink window is), and
  its main-phase noise never picks a pump. `NoisyAI` never picks a pump as
  noise either (its legal entry carries the full count); the brain it wraps
  still uses its own pump rule.
  - **Known mistakes.** Hard reads one pump at a time; its clock ignores the
    opponent's blockers next turn; its pre-block defence assumes a lone
    block, which the block search may still decline. The simple rule spends
    mana a main-two cast wanted and ignores whether the attacker survives.
    No brain pumps in a main phase or at Sunset. Medium and Easy do nothing
    on defence. Hard's rollouts (`simulateOutcome`, `lookahead`) play its
    own side with Medium, so a simulated Hard pumps by Medium's rule (all
    mana into an unblocked attacker); left as is and recorded here, since the
    real decision is always Hard's own read and the rollouts only rank other
    candidates (Fable's review, SHOULD-FIX 4: documented, not rerouted).
  - `docs/ai.md` should gain a short "Mana pump" entry saying the above (not
    edited here).
- **Rules text.** `manaActivatedText` in `src/ui/rulesText.ts`: the Duty
  line's template with the mana cost alone in front and no tap symbol, "{R}:
  This gets +1/+0 until Sunset.", printed right after the Duty line (above the
  keyword line). No glossary entry: it is not a keyword.
- **The scorer.** `scoreCard` reported `manaActivated (NEEDS MATH: repeatable
  mana pump, unpriced until the A1.4 lab)` as unknown, with a part worth 0.
  A1.4b now prices it at the measured 0.83 ("A1.4b: the re-run's rates").
- **Records.** The new action and event round-trip through the replay log
  (tested); v16 is unreleased, so no version bump. `docs/architecture.md`'s
  generated event table has the `manaActivated` row.
- **Also in this change (Fable's review, 2026-09-29).** `validateHuntDef`
  refuses a Hunt in a Retell body ("A Retell body never hunts"): no carrier
  check covered it. No First Dawn row has one.
- **Hand-offs.**
  - **A2.a (Duel UI):** the +/- ticker. The legal action's `times` is the
    ticker's maximum; the submitted action carries the chosen count (and a
    `manaPlan` for the whole count, if the UI plans mana). The `manaActivated`
    event needs a log line and an animation (DuelScene ignores it today), and
    the human now gets a combat response window whenever they could pump.
  - **A1.4 (the lab):** the rate, from an arm on the working card; the
    scorer's NEEDS MATH term is where it goes.
  - **Lane B (transcription):** the card row, with the name and text the
    owner approves.
  - **Not updated:** `scripts/mechanicUsage.ts` (its switch has a default,
    so `activateMana` is not yet counted as a Charm-speed play: lane E) and
    the Forge (`src/forge/validate.ts` rejects a `manaActivated` key as unknown,
    so the Forge cannot build the shape).
- **Tests.** `tests/engine/manaActivated.test.ts` (the engine, the timing and
  auto-pass rule, the validator, the text, the scorer, replay) and
  `tests/ai/pumpPolicy.test.ts` (each brain's rule), each shown to fail with
  its behaviour switched off.

## As built (A1.4): the rates

A1.4 replaced the scorer's Hunt and Provoked stubs, and the overplan's
provisional terms, with terms fitted to the A1.3 lab (652,512 games, Hard on
both seats, the 14-deck field; `balance/study/lab/fd/first-dawn-findings.md`,
local-only). The lab's currency is the pooled one-mana step (5.3 pp), read as
MEP as the 1.8.5 keyword lab's was. Everything is in `src/power/scoreCore.ts`,
in the block "FIRST DAWN: HUNT AND PROVOKED", so the Forge and the balance CLI
price the same way. It is the local power formula's §4w (that section is
local-only and still to be written from this one).

**Hunt: a step on survival.** The rule: the prey a hunter picks has Attack 2
and Defense 3 (the field's typical creature it can outlast), so a hunter
survives when its Defense is 3 or more and kills when its Attack is 3 or more.

- A hunter that dies: 0.15 + 0.95 × (Attack − 2), at most 2.5 (Spear-Thrower's
  4/2 reads 2.05, the surcharge reading; 3/1 and 3/2 read 1.10).
- A hunter that survives: 2.5 + 0.75 × (Defense − 3), at most 3.5. Attack
  past 3 adds nothing (the lab's 3/4 equals its 4/4, its 3/5 its 5/5). With
  Attack under 3 it keeps the share of the kill the scorer's own creature-burn
  curve gives that Attack against 3 (a 2/4 keeps 0.71). On a one-shot carrier
  (anything but a Duty) such a low-Attack survivor is also capped at its
  Attack's creature burn plus 0.5, marked NEEDS MATH: no lab row has one, and
  uncapped a 1/4 or 2/3 would read far above a 3/2 that trades. The Duty is
  exempt, because Tracker of the Long Grass (a 2/4 Duty hunter) is the one
  measured low-Attack survivor and a Duty picks its moment; capped, its Duty
  would read 0.08 against the measured 0.65.
- Carriers, against the arrival Hunt: arrival 1.0, attack 0.9 (Kesh), Duty
  0.75 of the exchange per card before the Duty's mana discount (Korru and
  Tracker, least squares), Empower 0 (Ridge-Raptor). Any other carrier is
  unmeasured: one Hunt at the arrival rate, marked NEEDS MATH.
- The spell form: 1.95, a fair 2-mana card (the plain Hunt ritual measured
  fair at mana value 2). Defense added to the hunter earlier in the spell adds
  0.75 a point, to the same 3.5; Attack adds nothing, and the pump's own stats
  are not priced again. A Mark on the hunter keeps its own value. Damage to the
  hunter is a Provoked source, not lost Defense (the caster picks a hunter that
  can take it).
- Prey declared `yours` is worth 0 (the forced self-hunt arm); `any` is worth
  the default (the lab read no difference).
- Colour pie: Hunt joins the classes, green and red primary, black secondary.
  An Empower Hunt pays the premium at its carrier weight, so none.

**Provoked: the effect times a survival factor.** 0 through Defense 4, rising
linearly to 0.25 at Defense 6 and flat after (the ceiling is the least-squares
fit of the three big bodies; Defense 5's 0.125 is interpolated). Exposure is
flat whatever the body; what differs is survival.

**The self-provoke engine.** A creature whose own Duty can damage it (a target
creature, a creature you control or any target, not "other"; or each creature)
prices its Provoked at 1.3 fires of the effect less the Duty's mana discount,
when that beats the passive rate. 1.3 is the one value inside both measured
intervals (Sefa 1.27-1.68, Ashka 0.92-1.35).

**Self-damage sources.** Damage a card aims at its controller's creatures (a
target creature you control, or each creature you control) is never priced as
burn and never pays the burn pie premium; a damage op is judged by the slot it
aims at (its own `targetIndex`), and branch ops count (the walk uses the
engine's `flatOps`, now exported from `types.ts`). The card gets one "Provoked source"
part, above 0 only, whatever the carrier (the lab read a repeatable source and a one-shot
alike): 0.5 on a white card, 0 on any other colour, a multicoloured card
taking its lowest. The lab gives ranges, so each is the conservative (lower)
end: white 0.5 to 1.0 in the wall deck (R27), red and colourless 0 to 0.3 in
the Stampede. Colour stands in for the deck's Provoked density, which the
scorer cannot see. A self-provoke engine's source is its own Duty and gets no
second part.

**The calibration table** (fitted = the scorer's row minus its control,
colour-pie parts out, since the lab's hole cards were colourless; spells are
card-level, against a vanilla m/m; measured is pooled MEP with the 95% interval):

| Lab row | Fitted | Measured |
|---|---|---|
| Arrival Hunt 2/2 | 0.15 | 0.14 [-0.15, 0.39] |
| Arrival Hunt 3/3 | 2.50 | 2.49 [2.18, 2.92] |
| Arrival Hunt 4/4 | 3.25 | 3.21 [2.84, 3.68] |
| Arrival Hunt 5/5 | 3.50 | 3.53 [3.15, 3.99] |
| Arrival Hunt 3/1 | 1.10 | 1.03 [0.74, 1.35] |
| Arrival Hunt 3/2 | 1.10 | 1.13 [0.87, 1.44] |
| Arrival Hunt 3/4 | 3.25 | 3.24 [2.82, 3.84] |
| Arrival Hunt 3/5 | 3.50 | 3.44 [3.00, 4.03] |
| Spear-Thrower 4/2 | 2.05 | 1.37 [1.07, 1.69] pooled; own-curve 2.48; fair surcharge 2 mana or more (read for cost, as the findings ask) |
| Kesh (attack Hunt) | 0.99 | 0.94 [0.69, 1.26] |
| Ridge-Raptor (Empower Hunt) | 0.00 | -0.26 [-0.58, -0.01] |
| Crag-Leaper (conditional, the old rule) | 1.50 (stub) | 0.43 [0.19, 0.63], stale |
| Korru (Duty Hunt) | 1.83 | 1.76 [1.47, 2.10] |
| Tracker of the Long Grass (Duty Hunt) | 0.52 | 0.65 [0.45, 0.91] |
| Plain Hunt ritual, mana value 1 / 2 / 3 | +0.95 / -0.05 / -0.91 | +0.13 / -0.04 / -0.56 |
| Provoked, Fern-Back Grazer 1/4 | 0.00 | -0.04 [-0.26, 0.17] |
| Provoked, Cinder-Crest Raptor 2/2 | 0.00 | -0.28 [-0.55, -0.02] |
| Provoked, Hearth-Shield Maiden 1/4 | 0.00 | 0.00 [-0.21, 0.20] |
| Provoked, Vessa 5/6 | 0.25 | 0.45 [0.23, 0.71] |
| Provoked, The Walking Mountain 6/7 | 0.57 | 0.51 [0.30, 0.72] |
| Provoked, Mother of the Long-Necks 4/7 | 0.47 | 0.44 [0.24, 0.65] |
| Provoked, Sefa (engine) | 1.62 | 1.87 [1.57, 2.20] |
| Provoked, Ashka (engine) | 0.90 | 0.69 [0.52, 0.95] |
| Challenge the Beast (+1/+0) | -0.05 | 0.01 [-0.30, 0.28] |
| Spear and Fang (`any`) | -0.05 | -0.03 [-0.28, 0.25] |
| Fang and Horn (+2/+2 Charm) | 1.00 | 0.98 [0.68, 1.23] |
| Stalk the Ferns (+1/+1 Charm) | 0.16 | -0.01 [-0.30, 0.26] |
| Duel on the Ridge (+2/+0 Charm) | -0.68 | -0.39 [-0.70, -0.11] |
| Grip of the Old Beast (Mark, then Hunt) | 0.54 | 0.65 [0.34, 0.91] |
| Blaze-Horn Charge (ping, then Hunt) | -0.91 | -0.79 [-1.04, -0.57] |
| Ambush at the River (+1/+1, Hunt, draw) | 0.63 | 0.70 [0.42, 0.96] |
| White sources in R27 (Test of the Hearth, Trial by Ember, The Standing Stone, Hearth-Tender, Scar-Giver Elder (the lab's Scar-Rite Elder), Scar-Singer) | 0.50 each | 0.77, 0.66, 0.61, 0.58, 0.50, 0.48 |
| Black sources in R27 (Bitter-Blood Brute, Scar-Knife Witch) | 0 | 0.64, 0.15 (n.s.) |
| Red and colourless sources in the Stampede (Ember-Pot, Fire-Pit, War Drums, Ember-Tongue, Warband Drummer, Firebrand Initiate, Drum-Beater, Uzza, Blaze-Horn) | 0 | 0.29, 0.27, 0.22, 0.14, 0.09, 0.06, -0.11, -0.26, -0.31 |

Where the fit departs, on purpose: Spear-Thrower is fitted to its surcharge
(the findings' reading for cost; at least 0.8 mana hotter than the
provisional), not its pooled value. The plain ritual's mana value 1 and 3 arms
disagree with any single value, because the vanilla ladder's local step is not
the scorer's budget ladder; mana value 2 is the anchor. Black sources are
priced at 0 although R27 read Bitter-Blood Brute at 0.64: colour is the
scorer's only proxy for the deck, and First Dawn's black is not built for the
wall deck. Ring of Embers (a symmetric sweep) is priced as a sweeper, not a
source. The spell intervals above are the pp intervals over 5.3.

**Stubs that remain, and why.**

- **The conditional arrival Hunt** ("If you control another Dinokin, when this
  arrives, Hunt."): priced by A1.4b (below) at 0.85 of the unconditional
  exchange when the type is the card's own. Still NEEDS MATH: a Hunt gated on
  another type (the standing controlsOther gate, 0.6, against a measured
  off-tribe 0.2), and a gated Hunt on any carrier but arrival.
- **The repeatable mana pump** (A1.5): priced by A1.4b at 0.83 a card. Still
  NEEDS MATH: any shape but one +1/+0 pump for one mana on a Skyborne creature
  (priced at the same 0.83).
- **Measured with Hard as built**: the Duty rate carries A1.2's Morning gap (a
  creature that can attack rarely uses its Duty), and Empower's 0 was measured
  on a 3/1 that trades; an Empower Hunt on a body that survives is the least
  certain reading.
- Not measured, not priced: the Hunt that provokes its own hunter (B7), and a
  Deathblade hunter (the lab puts it at 0.25 mana or less; E7 option A,
  accepted).

**The P3 fix.** `validateProvokedDef` now refuses a Provoked effect that
damages its controller's own creatures: damage to each creature or each
creature you control, and targeted damage whose slot can be the controller's
creature (any target, any creature, a creature you control). Only an
opponent's creature or a player may be its damage target. This is the strict
reading of P3, "may be aimed at" the controller's creatures, so it also
forbids "Provoked: deal 1 damage to any target". The catalog test
already runs the validator over every card, so lane B's rows meet it; no First
Dawn row breaks it.

**The Forge.** It prices a loaded card with a hunt op the moment the terms
land; its editor still offers neither Hunt nor Provoked (not in `TRIGGERS` or
`OP_OPTIONS`), and a shared card with a Provoked ability does not load. The
stub comment in `src/forge/vocab.ts` says so. New part labels are plain words
the ledger's fallback reads.

**What moved.** No shipped card's score (1,515 cards, every part compared
before and after). First Dawn's 166 are rescored in the scratch `fd-rescore/`
for the owner: 143 in band, 23 out (8 hot, 15 cold), with a proposal for each
of the 20 not waiting on the re-run. Fable's review (2026-09-29) folded in
the damage slot, the low-Attack cap, the Empower pie weight, the branch walk
and the 0.95 slope; the counts held.

**Tests.** `tests/power/firstDawnRates.test.ts` (the survival step, Empower at
0, the spell's Defense fold, the Provoked survival factor, the engine, the
source rate, the measured anchors as gates, and the conditional stub staying
an estimate, since replaced by A1.4b's tests) and a P3 case in
`tests/engine/provoked.test.ts`, each shown to fail with its behaviour switched
off.

### A1.4b: the re-run's rates

The A1.1c re-run (93,072 games on 2026-09-29, on `release/1.9` at 0696fa9c,
with the method above: Hard on both seats, the 14-deck field, 1 mana = 5.3 pp;
`balance/study/lab/fd/first-dawn-findings-a11c.md`, local-only) measured the
two stubs A1.4 left. Both rates sit in `src/power/scoreCore.ts` beside the
scorer's other gates (`COND_HUNT_OWN_TRIBE`, `MANA_PUMP_VALUE`).

**The conditional arrival Hunt: 0.85 in its own tribe.** The rule: an arrival
Hunt gated on "if you control another *type*", where the type is one of the
card's own subtypes, is priced at the unconditional exchange times 0.85,
which replaces the ability's controlsOther gate (0.6). The part is labelled
measured.

- **Why the card's own type.** The factor depends on the deck, which the
  scorer can't see. In the Dinokin decks, where the condition is live, the
  conditional Hunts read 4.4 to 4.5 pp at 2 copies against Frill-Neck
  Stalker's unconditional 5.2 pp: about 0.85. Off-tribe, in a starter hole,
  they keep about 0.2. "Another creature of its own type" is the scorer's
  proxy for a card built for its tribal deck, and every conditional hunter in
  the cut (Fern-and-Fire Raptor, Fern-Shadow Stalker, Fern-Crown Tyrant) is a
  Dinokin built for the Dinokin decks.
- **Everything else keeps its standing gate.** That covers:
  - a Hunt gated on another type (0.6, NEEDS MATH: off-tribe measured about 0.2);
  - a gated Hunt on any other carrier (NEEDS MATH);
  - any gated ability that doesn't hunt. The controlsOther gate is shared with
    shipped cards, so it stays 0.6.

**The calibration table.** The in-deck rows are 2-of readings inside a deck,
a smaller frame than the starter-hole 4-of the Hunt step is fitted in:
Frill-Neck's own Hunt, 3.25 in the hole frame, reads 0.98 in R28. So an
in-deck row's fitted value is the scorer's part times 0.98 / 3.25 (0.30); a
starter-hole row is read directly. Measured is MEP (dWR / 5.3), 95% interval.

| Lab row | Where | Scorer's part | Fitted | Measured |
|---|---|---|---|---|
| Frill-Neck Stalker 4/4, unconditional (the frame) | R28, 2-of | 3.25 | 0.98 | 0.98 [0.64, 1.26] |
| Fern-and-Fire Raptor 3/3's Hunt | Stampede, 2-of | 2.13 | 0.64 | 0.85 [0.58, 1.08] |
| Fern-Shadow Stalker 3/4's Hunt | Stampede, 2-of | 2.76 | 0.83 | 0.83 [0.58, 1.17] |
| Crag-Leaper 4/3, condition live | Stampede, 3 copies | 2.13 | 0.64 | 0.77 [0.49, 1.11] |
| Crag-Leaper 4/3, off-tribe | starter hole | 2.13 | 2.13 | 0.51 [0.28, 0.74] |
| Fern-and-Fire 3/3, off-tribe (Oru stripped) | starter hole | 2.13 | 2.13 | 0.60 [0.38, 0.85] |
| Fern-Crown Tyrant 5/5 | R28, 1-of | 2.98 | 0.90 | not isolable; R28 as a whole moved +1.1 ± 0.7 pp under A1.1c |

Where the fit departs:
- **The off-tribe rows**, on purpose. The scorer prices a Dinokin card for its
  Dinokin deck, so a copy played outside one is over-read by about 1.5 MEP.
- **Fern-and-Fire's 3/3 reads under its measurement** (0.64 against 0.85,
  inside the interval). In the decks the 3/3 and the 3/4 read alike (4.5 and
  4.4 pp), which the survival step's Defense slope doesn't show. The frame
  rests on one reference row, so A1.4b doesn't refit the step from it.
- **The factor is the findings' rounded 0.85.** Read against Frill-Neck's frame
  body by body, the two in-deck rows give 1.13 and 0.85.

**The mana pump: 0.83 a card.** The rule: a card's repeatable mana pumps are
worth 0.83, once, whatever their number, with no unknown. The measured shape
is one pump, +1/+0 on itself for one mana, on a Skyborne creature: Vyra,
Ember-Sky Rider ({4}{R}{R} 5/5 Skyborne, "{R}: This gets +1/+0 until
Sunset."). Any other shape takes the same value, marked NEEDS MATH: other
stats, another cost, no Skyborne, or several pumps. The findings round the
reading to 0.85; the scorer keeps the measured point.

| Lab row | Fitted | Measured |
|---|---|---|
| Vyra's pump (Vyra against Vyra without it, Crimson and Tides holes) | 0.83 | 0.83 [0.66, 0.98] pooled; own-curve 0.98 [0.73, 1.34] |
| One mana on the card without the pump (the control) | n/a | +4.5 pp [3.1, 5.7], about one mana, as it should be |

Hard pumped in 19% of games, 0.60 pumps a game. The value is spare red mana
turned into lethal by an evasive finisher, so it is not generalised to a
ground or small body without its own arm. Medium's simpler pump rule was not
measured.

**What remains NEEDS MATH.**
- A Hunt gated on a type that isn't the card's own.
- A gated Hunt on any carrier but arrival.
- Every pump shape but the measured one.
- The frame conversion itself: one reference row, R28 against the Stampede.

**What moved.**
- **Shipped cards:** no score moved. All 1,515 were compared before and after,
  every part and unknown.
- **First Dawn's 166**, rescored in the scratch `fd-rescore/`: four cards moved.

  | Card | Δ on A1.4 | Δ on A1.4b |
  |---|---|---|
  | Fern-and-Fire Raptor | +1.41 | +2.04 |
  | Fern-Shadow Stalker | +1.62 | +2.43 |
  | Fern-Crown Tyrant | +0.28 | +1.16 |
  | Vyra, Ember-Sky Rider | -1.01 | -0.18 |

- **The count:** 143 in band, 23 out (9 hot, 14 cold), each with a proposal
  for the owner. A1.4's 20 are unchanged. A1.4b adds three:
  - Fern-and-Fire 3/3 to 3/2 (+0.46);
  - Fern-Shadow 3/4 to 3/2 (-0.16);
  - Fern-Crown 5/5 to 4/5 (+0.68).

  Vyra lands in band and gets none.

**Tests.** `tests/power/firstDawnRates.test.ts` covers:
- the three in-deck rows as measured gates in Frill-Neck's frame;
- the gate costing the Hunt something;
- an off-tribe gate marked an estimate;
- the standing gate kept on a tribal ability that doesn't hunt;
- Vyra's pump inside its interval;
- every other pump shape marked an estimate.

`tests/engine/manaActivated.test.ts`'s scorer case now expects the pump
priced. Six mutants were run, one for each behaviour switched off, and each
failed at least one test.

## As built (A1.6): attacking targets and "if it survived"

The owner reviewed First Dawn's cards (2026-09-29) and asked for three
reworks, then ruled "Yes, build it" on both engine pieces and "Wording
only" on Ash-Rite: The Elders' Verdict ({1}{W}{W} Charm, "Sever target
attacking creature, then you gain 2 life."), Bring Down the Beast ({2}{W}
Charm, "Destroy target attacking creature with Attack 4 or more."), Ambush
at the River ({3}{G}, "Target creature you control gets +1/+1 until Sunset,
then it Hunts. If it survived, draw a card.") and Ash-Rite ("then you create
..."). The cards are lane B's; A1.6 built the mechanisms on fixture cards.
`docs/rules.md` has the rules ("Attacking-only targets", "If it survived").

- **`TargetSpec.attacking`.** Legal only on a creature in
  `state.combat.attackers` that is still on the battlefield
  (`satisfiesPermanentQualifiers`, `targeting.ts`), so one check serves the
  cast, legal actions, the fizzle rule at resolution and every AI menu, as
  `tapped` does. A creature that leaves is out of combat (a returned one has
  a new iid); after combat `state.combat` is null and nothing is attacking.
  `resolve.ts` passes a spell's target specs to its ops when a spec is
  attacking-only, as it does for `minAttack`. `PlayerView` needs nothing: the
  combat is already public. `validateA16Def` allows the word on creature
  specs only, and never on a Duty's (a Duty is used in a main phase, where
  nothing attacks).
- **The auto-pass rule, unchanged.** `hasCastableInstant` and
  `hasCastableCharm` enumerate targets through the same legality check, so an
  attacking-only Charm with no attacker to hit is not castable and keeps no
  window open: outside combat, over a main-phase spell, with no attackers,
  and when every attacker fails the other words (Bring Down the Beast's
  Attack 4). The defender holding one is offered its window over the
  attackers only when it has a target there.
- **`ifTargetSurvives`** (`{ op, then, else?, targetIndex? }`, on the
  `ifTargetMarked` pattern). When it resolves it runs `then` if its target
  creature is on the battlefield and passes `survivesOnBattlefield` (sba.ts,
  the Provoked test: not lethally damaged, no Deathblade damage, Defense above
  0), else `else`. Ops resolve in order, so a Hunt earlier in the same spell
  has dealt its damage. Deathblade: any damage from a Deathblade source is
  fatal, so the hunter did not survive. Damage prevention: prevented damage
  was never marked, so it does not count (Hunt damage is not combat damage,
  and no non-combat prevention exists). A creature that left the battlefield,
  or is no longer a legal target, did not survive, and `else` runs.
  Covered: `effectOpUsesTarget`, the branch walks (`flatOps`, the Empower and
  Duty validators, `containsNewPlayerChoice`, `usesHunt`,
  `usesExplicitTargetSlot`, `opsInclude`, mark-trigger recursion), the Forge's
  exhaustive records (`OP_RULES`, `defaultOp`; the Forge reads the op but
  does not offer it), the persona score's anchor (0.6, as `ifTargetMarked`)
  and `validateA16Def` (a creature spec at the gate's slot, never in a
  chapter). `validateHuntDef` refuses a Hunt inside the gate, as inside an
  If-marked branch. `docs/adding-cards.md` has the op row.
- **Rules text** (`rulesText.ts`). `attacking` joins the target words after
  Marked and tapped ("target attacking creature", "target attacking creature
  an opponent controls", "target Marked attacking creature", "... with attack
  4 or more"). The gate prints "If it survived, ..." as its own sentence
  (`joinOpTexts`), "If target creature you control survived, ..." when
  nothing named the target first, and "; otherwise, ..." for `else`.
- **Ash-Rite.** A `createToken` right after a clause whose subject is
  another player (`sacrifice` each or opponent, `loseLife`, `discardRandom`,
  an opponent's `grind`, a target owner's `foresee`) prints "then you create
  ...". The rendered text of the whole catalog (1,515 cards, with and without
  keyword reminders) is identical before and after: no shipped card has that
  shape.
- **The scorer.** `valueOp`'s `ifTargetSurvives` term, one delimited block:
  `then` weighted 0.86 (the design draft's "draw if the hunter survives"),
  `else` the rest, reported as `op:ifTargetSurvives (NEEDS MATH ...)`. A
  placeholder; **A1.4 owns the rate**. The scorer does not price the
  attacking restriction, as it does not price `minAttack`, `maxCost` or
  `tapped`: A1.4's to decide.
- **The AI** (every read is reached only through the new word or op, so
  today's pool plays exactly as before).
  - *Attacking-only Charms* reach the defender in its window over the
    attackers as ordinary castable Charms. Medium's rule 2 (removal on an
    attacker, by `removalWorth`) casts it on the attacker worth most; Hard
    starts from Medium's choice and searches the cast's target variants, and
    picks the same attacker; Easy's rule casts it at random when it does not
    pass. No brain needed new code for it.
  - *The survival read* (`expectsTargetSurvives`, `value.ts`): the ops before
    the gate are played on the public board in order (pumps and damage on a
    target slot, removal of the gate's creature, a spell-form Hunt with
    Deathblade and Bulwark), then the state-based test. It picks the branch
    in `cardValue` (the cast's own targets), `spellTargetsValue` (the target
    variants, so a prey that would kill the hunter loses the draw) and
    `boundCastEffects`. With no board (`opImpactValue`, `empowerValue`) the
    gate takes the scorer's 0.86 blend. A trigger's or Duty's gate reads the
    board as it stands. Known limits: responses, combat and other ops before
    the gate are not modelled; the Hauntlink trigger forecast treats the gate
    as unknown (its default).
- **Tests.** `tests/engine/attackingTarget.test.ts`,
  `tests/engine/ifTargetSurvives.test.ts` (with the scorer's placeholder),
  `tests/ui/a16RulesText.test.ts`, `tests/ai/a16Reads.test.ts`, and the
  catalog test runs `validateA16Def` over every card. Each was shown to fail
  with its behaviour switched off (the A1.6 report lists the mutations).
- **Fable's review, folded in.** Every catalog walk now descends into the
  gate (`isTargetBranchOp`): the draft picker's `collect`, the glossary's
  `cardOps` (so a keyword granted inside it reaches the keyword-coverage
  check), the persona score, `hasTargetBinding` and `newOps` in
  `src/ai/targeting.ts`, the Avatar reserve supply walks, the activated
  fixture, `isUpside` and the Forge's `opNeedsTarget`. The Hauntlink trigger
  forecast takes the branch the survival read picks on its projected board.
  "then you create" also follows `loseLifePerTheirMarked` and applies inside
  a branch. The deferred-target prompt says "attacking". `validateA16Def`
  refuses an `upTo` or `exactly` spec at the gate's slot, so the scorer's
  per-target fan never meets a gate. `hasTargetQualifier` leaves `attacking`
  out on purpose (the legacy removal read picks the attacker). An attack
  trigger may still name an attacking target ("Whenever this attacks, target
  attacking creature ..."), so the validator does not restrict the word to
  spells. The Forge still cannot build either construct.

## As built (A1.7): Overcharge

The board-cap study (2026-09-29, 28,224 games) found First Dawn's go-wide deck
losing 6.4 tokens a game to the 8-creature cap, and a prototype "Overcharge"
recovering that power (+7pp) where a wider cap did not. Overcharge also made
Hard cheaper (-6% ms a decision, as games end sooner); caps of 10 and 12 cost
it +13% and +17%. The owner's rulings the same day: build it in 1.9 as a
game rule for every set and format; namesake only; tokens only; +1/+1 each
with a per-creature limit; not a Mark. `docs/rules.md`, "Board caps", has the
rules and the player copy (approved by the owner, 2026-09-29, with the log
line and the badge).

- **The rule.** `createToken` re-checks the cap before each token. At the cap
  the token is not created; `refuseTokenAtCap` (`src/engine/overcharge.ts`)
  gives one eligible namesake an Overcharge and emits `overcharged`, and the
  op goes on to its next token. With no eligible namesake, nothing happens
  (the old behaviour). An eligible namesake is a creature **token** the refused
  token's controller controls, with the refused token's **name** (not its card
  id), below the limit. Never any other creature, never a non-token card of
  that name, never the opponent's token.
- **The pick** (the main session's fold, a design default): the eligible
  namesake with the fewest Overcharges, ties to the oldest (lowest iid). It
  spreads the bonus and works with the limit; there is no prompt and no AI
  decision.
- **The limit.** `RULES.overchargeLimit = 3`, measured and approved on
  2026-09-29. The namesake-only re-measure (13,440 games, Hard on both seats,
  paired against today's cap on the same seeds) read the go-wide deck R27 at
  +6.8 pp with a limit of 1, +8.0 at 2, +8.3 at 3, +8.2 at 5 and +8.2 with no
  limit (each about ±2.9): the gain plateaus from 2, and 3 keeps all of it.
  With no limit one Hatchling reached 24/24 and the Walking Mountain lab arm
  +43. The shipped decks stayed inside noise at every limit (Hera +0.9 ± 1.9,
  Titania +0.6 ± 1.4 at 3), and Hard's time per decision stayed at or below
  today's. Without the fallback to other creatures the whole gain survives:
  R27 makes only Hatchlings, so a namesake was there for 98% of refusals.
  A namesake at the limit is not eligible.
- **The field.** `Permanent.overcharge?: number` (absent = 0), added for
  creatures in `getEffectiveStats` after the Marks, so combat, the P/T plate,
  `PlayerView` and every AI read see it through the normal stat path. Nothing
  ever copies it: it leaves with the permanent, a Nine Lives return comes back
  without it, and a later Preserve copy of the same card starts at none
  (by construction: Preserve builds from the card id, and nothing copies a
  `Permanent`, so there is no copy path to test).
- **Every token-creation site.** `createToken` (the one effect that makes
  tokens) runs the rule. Preserve (`preserveCard` in `Game.ts`) is the only
  other token maker; its action is refused at legality at the cap
  (`preserveBlockers`), so it never makes a token there and is unchanged.
  The non-token cap sites keep the plain refusal: `raise`, the Nine Lives
  return, and the cast-time checks (`castBlockers`, Darling casts).
- **Not a Mark: every Mark rule, found by walking each `plusOneCounters`
  reader and writer, ignores it.** `removeMarks` (clears Marks, keeps
  Overcharges); `moveMark` (an overcharged creature with no Mark has none to
  move); Propagate (never starts a Mark on it); `markAll` (adds a Mark beside
  it); the `yourMarked` / `theirMarked` boosts; the "marked" target spec
  (`targeting.ts`); the `controlMarked` and marked-threshold conditions, both
  the triggered (`conditionSatisfied`) and the static (`statics.ts`) forms; the
  static `filter.marked`; `ifTargetMarked`; `loseLifePerTheirMarked`;
  "whenever a marked creature you control attacks"; Nine Lives' "no +1/+1
  marks" check. Gaining an Overcharge fires no Mark trigger (`gainsMark`,
  `yourCreatureMarked`, `yourPermanentMarked`, `youAddMark`,
  `otherCreatureMarked`) and no arrival trigger. The AI's Mark reads
  (`value.ts`, `MediumAI.ts`, `hauntlinkPolicy.ts`) read `plusOneCounters`
  only, so they ignore it too; its stat reads include it.
- **The event.** `{ e: 'overcharged', player, iid, cardId, tokenCardId,
  total }`: the recipient, the refused token's card id and the new count.
  No permanent enters, so no `tokenCreated`.
- **The AI.** No new read. Hard's determinized worlds are built from the
  public view (which carries the field) and run the real engine, so its
  simulated lines overcharge. `src/ai/value.ts:117` is the cast-time cap for a
  second creature *spell* and stays: creature spells keep the hard cap. The
  shared token value (`createToken` at 1.5 a token) is cap-blind; at the cap a
  token is now worth +1/+1 on a namesake or nothing, which is closer to 1.5
  than before where a namesake exists. Left as is (no measured need).
- **The UI.** The duel log prints a line on every `overcharged` (approved
  2026-09-29: "Board full: your [Hatchling] gains an Overcharge in place of a
  new one (+1/+1, 2 of 3)", "the opponent's" for the opponent's side). The tile draws an Overcharge
  badge (`BoardCardView.setOvercharge`): the Overcharge cell glyph (a new
  mechanic glyph, not a bolt and not a plus) and the count on a gold-rimmed
  `rowFill` plate at the tile's right edge (`TILE_FEATURES.overchargeBadge`,
  anchor `rightEdge`, never the Mark badge's spot), counter-scaled like the
  action chip so its count keeps 11px type on a shrunken tile. The P/T plate
  already includes the bonus through `getEffectiveStats`.
- **The daily quest.** "Summon Extras: Create 4 tokens" also counts your
  `overcharged` events (owner, 2026-09-29), so the cap never stalls it; its
  text is unchanged.
- **The name.** The Starborne charm "Overcharge the Hull" is renamed "Vent the
  Reactor" (owner, 2026-09-29) so it no longer reads as the rule; its id
  `sb-overcharge-the-hull` stays, so collections, decks, art and saves are
  untouched.
- **The words.** A glossary rule term, Overcharge, in the Mechanics tab beside
  the zone terms (the glossary had no board-cap term before), its numbers
  read from `RULES`; `docs/rules.md`'s cap section and constants table.
- **Save and replay.** No save holds a duel in progress, and replays are
  action logs (seed, decks, actions), so no format persists a `Permanent`; the
  undo snapshot is an in-memory clone. Nothing to migrate and no save bump. A
  1.8.x replay replays through the 1.9 engine identically except where a token
  was refused beside a namesake, as with the other 1.9 rules fixes.
- **The scorer.** No change; it does not model the cap.
- **Tests.** `tests/engine/overcharge.test.ts` (the rule, the event, no
  fallback, the limit, the pick, multi-token ops, below the cap, a refused
  token's Marks, either player, the `PlayerView`);
  `tests/engine/overchargeNotAMark.test.ts` (one test per Mark rule above,
  with Nine Lives' new-object return and the trigger silence);
  `tests/ai/overchargeSim.test.ts` (Hard's worlds carry the field and run the
  rule); the badge's anchor through `tests/ui/boardCuePresentation.test.ts`'s
  anchor rule and its glyph through `tests/ui/mechanicIcons.test.ts`; the quest
  count in `tests/meta/quests.test.ts`. Each new test was proved against a
  mutation that switches its behaviour off (37 mutations, each caught).

## What this spec corrects

In the **overplan** (lane B should update it; this spec does not edit it;
items 1-6 are recorded there as of 2026-09-28):

1. "G7 ... the engine throws today" and the 14 "G7-gated" Duty rows: G7
   shipped fixed in 1.8.1 (#451). An activation runs through `runOps` and
   the same deferral queue a spell uses (Game.ts:975-1001;
   EffectInterpreter.ts:930-972), and `tests/engine/activated.test.ts`
   (from line 674) covers a Duty that kills a creature whose dies trigger is
   held. Question 13's risk is retired.
2. "If Provoked fired inline ... the tail would be illegal": the validator
   forbids an inline target only after a Foresee (types.ts:589-606), and a
   targeted trigger raised mid-effect carries the effect's targets in its
   continuation (EffectInterpreter.ts:961-970). The reason for the
   state-based placement is survival, not the Duties.
3. Empower-Hunt "is not an allowlist-only change": it is (Part 3).
4. `keywordTarget` and `distinctSpellTargets` as constructs: both are the
   Hunt op's own targeting rules. The general keyword qualifier then serves
   only Bone-Snap Ambush, and the construct table should say 0 cut rows.
5. "Every targeted Provoked effect aims at an opponent's creature or
   player": five of the seven in the cut target your own creature, to Mark
   it (Long-Neck Mother, Elder of the Bone Wall, Thorn-Hide Armourback,
   Herd-Guardian Longneck, Reed-Wall Keeper). P3 is about damage and still
   holds.
6. The spell-form prey spec carries `other: true`. For legality it means
   nothing on a spell (it excludes an ability's source, targeting.ts:156),
   so distinctness is the Hunt op's rule; the flag stays in the data only
   because it prints "another target" (rulesText.ts:99).

In **plan-1.9** (lane A; report only; as of 2026-09-28 items 7 and 8
are applied there, and the G7 and G8 rows already read as items 9 and 10
ask, since #490; the `rules.md` half of item 10 goes to A2.c's rules pass):

7. "`TargetSpec` already has ... `exactly: 2`" for Hunt: `exactly` is one
   spec for an unordered pair of the same kind (actions.ts:387-398); Hunt
   needs two ordered specs, which the multi-spec path already enumerates.
8. "The four existing card names that contain 'Hunt'": ten names contain
   the letters, four the whole word.
9. The 1.8.1 gap table (plan-1.9.md:194) still reads G7 as "latent", as it
   stood on 2026-09-25. It shipped fixed in 1.8.1 (#451); the row should say
   so.
10. G8's row (plan-1.9.md:195) and `rules.md` (Hauntlink, "Where a held
    trigger resolves") say a held trigger resolves where it would have
    inline. That holds for spells, Duties and state-based checks outside
    combat, not inside combat: a dies trigger held in the first-strike step
    resolves after the regular step (combat/damage.ts:38-46,
    Game.ts:1391-1396; the review's probe A). A pre-existing gap, to be
    recorded in both places; this spec does not fix it.

In the **brief** (report only):

11. P3: the mark-trigger cap need not reach the Provoked path; once each
    turn bounds it (Part 1), with the pass budget raised up front.
12. P4: "one from the first-strike step resolves before the regular step"
    holds only for untargeted Provoked effects; targeted ones are chosen after
    combat damage, as targeted dies triggers are.
13. The keyword table in `docs/rules.md` says Blood Oath applies on "spell
    damage paths that flag it"; no spell path flags it today (the `damage` op
    sets neither Deathblade nor Blood Oath, EffectInterpreter.ts:324-350).
    A2's rules pass should say "combat and Hunt damage".

## Rulings (the owner's second sitting, 2026-09-28)

The questions as they were put, recommendation first, each now led by the
owner's answer and its consequence. The sitting's sheet numbered them E1-E10;
Qn here is En there.

1. **RULED as recommended.** *Consequence:* A1.1 builds Provoked in the
   state-based check with the held-trigger exception, and `rules.md` records
   the exception to the 2026-09-04 order. **Rule Provoked as in Part 1:**
   fired in the state-based check after that check's deaths and dies
   triggers, once each turn (not spent when it finds
   no target), targeted effects chosen after the current effect or damage
   step, no extra loop cap (the pass budget is raised instead), **and one
   exception to the G8 order the owner ruled on 2026-09-04: when a
   Hauntlink window holds a dies trigger, an untargeted Provoked effect of
   the same check resolves at once, ahead of it.** Keeping the no-link
   order there cannot be done inside combat, where held dies triggers
   already resolve after the regular damage step (Part 1). *If not the
   placement:* firing at the moment of damage means survival is not yet
   known, so the engine would need a survival forecast and a rule for
   creatures that die later in the same effect. *If not the exception:* the
   engine would have to make the combat damage step itself wait for held
   triggers, a change to the G8 machinery that First Dawn does not need.
2. **RULED as recommended.** *Consequence:* no `TargetSpec` keyword
   qualifier is built; Bone-Snap Ambush stays cut. **Hunt's targeting rules
   live in the Hunt op; drop the general keyword target.** Bone-Snap Ambush
   stays cut, or returns reworded. *If not:* a `TargetSpec` keyword
   qualifier, its AI and UI, for one stretch common.
3. **RULED: "Keep."** *Consequence:* `eachYourCreature` is built in A1.1,
   and the question returns if the cut drops one of its three rows. **Keep
   "damage each creature you control" for War Drums, Trial by Ember and
   Drum-Beater.** *If not:* reword them to "damage target creature you
   control N", losing the provoke-the-whole-side turn; and if the cut drops
   one of the three, this question comes back.
4. **RULED: "Validator change."** *Consequence:* A1.1 adds `hunt` to
   Empower's allowlist and nothing else. **Empower may Hunt, as a validator
   change** (three rows). *If not:* the three become arrival Hunts or plain
   bodies.
5. **RULED as recommended.** *Consequence:* A1.1 builds the rule; the replay
   version note gains the one line for The Drowned Saint's corner (Part 7),
   with no `rulesRev` bump. **An empowered creature is not countered when its
   Empower target leaves; it resolves and only the rider is lost.** Changes
   The Drowned Saint in that corner. *If not:* removing the prey in response
   counters an Empower-Hunt creature, and the lab prices that risk into three
   rows.
6. **RULED OTHERWISE: "Forced to hunt your own, if no other valid target
   exists."** The seven arrival and attack Hunts hunt a creature an opponent
   controls if a legal one exists; only when none does are they forced to
   hunt another creature you control; with neither, the trigger does
   nothing. Spells, Duties and Empower keep a free choice (B5).
   *Consequence:* the "if not" below applies in part: Easy's "never hunts
   its own" becomes "never by choice" (A2.b), the converter (A2.d) and the
   lab (A1.3) account for the forced case, A1 builds the preference (the
   construct table), and the seven change their template to one **proposed
   and pending the owner's wording** (since retired; see below). No
   optional trigger is built. The
   question as put: **Arrival and attack Hunts target "a creature an
   opponent controls"** (Fern-Crown Tyrant, Kesh, Grave-Fern Stalker,
   Frill-Neck Stalker, Fern-and-Fire Raptor, Fern-Shadow Stalker,
   Spear-Thrower). This narrows B5 for these seven mandatory triggers only;
   spells, Duties and Empower still hunt your own creatures. *If not:* each
   must hunt your own creature when the opponent has none, Easy's "never"
   becomes "never by choice", and the converter and the lab account for the
   forced case; or the owner rules an optional-trigger construct.
   **SUPERSEDED later on 2026-09-28 (the bare-keyword ruling):** one
   meaning everywhere. Every Hunt (spell, arrival, attack, Dawn, Duty,
   Empower) takes a creature an opponent controls if a legal one exists,
   otherwise another creature you control. The wording "one an opponent
   controls if able" is retired; no card prints it (Q10). **SUPERSEDED again
   the same day (the final Hunt ruling), E6's fallback entirely:** the
   generic Hunt's prey is a creature an opponent controls, with no fallback;
   card text may override it with `any` (any other creature) or `yours`
   (another creature you control), declared per card; an arrival hunter
   chooses its prey at cast and can't be cast without one. The eight rows
   that wanted other prey keep their original designs: five through `any` or
   `yours`, three (the opponent-only rows) through the default. Easy's "never
   by choice" filter matters again, on `any` cards (A2.b).
7. **RULED: "Cost them in lab."** *Consequence:* option A; the lab's
   Deathblade arm (Part 5) prices the Hunt spells and both Duty hunters on a
   Deathblade-dense field, and option B stays the fallback if that reading
   is over band. **Deathblade hunters: accept and cost them** (option A in
   Part 2). *If not:* option B, "a creature with Deathblade cannot hunt" in
   every form; the overplan's spell-only exclusion leaves the Duty hunters
   open to Rune of Hunger and Rose-Thorn Snare, so B dominates it. Either way
   the lab measures a Deathblade-dense field with the one-mana hosts.
8. **RULED: "Not in 1.9."** *Consequence:* only combat and Hunt use the
   shared damage path; the question can return after 1.9 as its own costed
   item. **Other creature ability damage stays off the shared damage path in
   1.9.** *If not:* Eclipse-Red Queen gains life on her drain, and any of 48
   ability-damage creatures handed Deathblade becomes a repeatable kill,
   each needing a costing pass.
9. **RULED as recommended.** *Consequence:* the overplan's row reads
   "another target creature you control" (`other`); alone, it does nothing.
   **Scar-Knife Witch reads "another target creature you control".** *If
   not:* it dies when it arrives with no other creature.
10. **RULED as recommended, except the one template Q6 changed.**
    *Consequence:* Part 6's copy is approved as written and A2.c uses it; the
    seven arrival and attack Hunts' template is proposed and waits for the
    owner's wording. **Approve the player copy in Part 6** (templates, the
    two glossary definitions, the two prompts, the tooltip). Any wording the
    owner prefers replaces it before A2.c. **SUPERSEDED for Hunt later on
    2026-09-28:** Hunt is a bare verb keyword like Mark ("When this arrives,
    Hunt."; the spell form "Target creature you control Hunts."), and the
    Hunt description, as the final Hunt ruling leaves it, is RULED: "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey."

**Open after the sitting:** none of the two it listed remains. The Q6
template's wording gave way to the bare keyword (Q10, superseded above), and
A1.1 expressed "an opponent's creature if able" as `opponentIfAble`, and
A1.1b removed it with the fallback (As built).

**The overplan's thirteen questions went to the same sitting** (the sheet's
F1-F8 and E1-E10; the overplan records each answer). So the owner was not
asked twice, this is how they map:

| Overplan question | Here | Relation | Ruled 2026-09-28 |
| --- | --- | --- | --- |
| 1 Use the provisional rates until the lab replaces them | Part 5 | Answered: same position; the lab's arms are specified | F1: yes |
| 2 The split lord's Dinosaur bonus (Dreaded) | none | Not an engine question; unaffected (two subtype statics, expressible) | F2: Dreaded |
| 3 Admit `damageEachYours` | Q3 | Same recommendation; Q3 supersedes it and adds the threshold caveat | Q3: keep |
| 4 Admit Empower-Hunt "as a real engine change, not an allowlist line" | Q4 | **Opposite reasoning:** Q4 supersedes it (validator only) | Q4: validator change |
| 5 Admit the keyword-qualified target | Q2 | **Opposite:** Q2 supersedes it (the Hunt op carries the rule; the general construct is dropped) | Q2: as recommended |
| 6 Trim Duty toward 18 | none | Not an engine question; note that G7 is no longer a reason to trim | F3: toward 18, about 20 acceptable, at the cut |
| 7 Hatchling minters about twelve | none | Unaffected | F4: keep 12 |
| 8 The engines that fire every turn stay lab-first | Part 5 | Answered: each has a lab arm | F5: lab first |
| 9 The projected cut as the starting board | none | Unaffected; Appendix A classifies that board | F6: yes; the Great Drum kept, Fern-Crown Tyrant dropped |
| 10 R28 stays R/G | none | Unaffected | F7: yes |
| 11 Exclude Deathblade from the Hunt spell's hunter | Q7 | **Opposite:** Q7 supersedes it (accept and cost; the rule for every form is the fallback) | Q7: accept, cost in the lab |
| 12 The matriarch's reach: Dinokin only | none | Unaffected (expressible either way) | F8: Dinokin only |
| 13 The G7 and P4 risk | Q1 | Retired: G7 shipped in 1.8.1; P4 is Q1 | Q1: as recommended |

## Appendix A: every row, classified

Classes: **E** expressible today exactly as sketched; **M** needs a ruled
mechanic; **M+D** a ruled mechanic plus a data-only validator change; **C**
needs the kept construct; **X** not expressible as written. "Self-source"
marks a row whose value depends on Part 4's friendly-source read. Sorted
projected cut first, then by rarity.

| ID | Rarity | In cut | Class | Needs | Note |
| --- | --- | --- | --- | --- | --- |
| `fd-oru-tyrant-queen` | UR | yes | E | none | Two subtype statics; Dinosaur Axis is an `axes.ts` entry (data) |
| `fd-vessa-great-horn` | UR | yes | M | Provoked |  |
| `fd-korru-eldest-tracker` | UR | yes | M | Hunt, Duty |  |
| `fd-ashka-fire-walker` | UR | yes | M | Provoked | Her Duty may target herself or any creature: a self-provoke engine (AI read in A1) |
| `fd-sefa-first-fire` | UR | yes | M | Provoked | Self-source: AI read in A1 |
| `fd-nyra-cliff-nests` | UR | yes | E | none |  |
| `fd-oshka-tar-mother` | UR | yes | E | none |  |
| `fd-tahla-shepherdess` | UR | yes | E | none | `allyCreatureArrives` never fires for the holder itself (EffectInterpreter.ts:1036); the face must say "another creature" |
| `fd-walking-mountain` | SSR | yes | M | Provoked |  |
| `fd-fang-and-horn` | SSR | yes | M | Hunt, spell |  |
| `fd-fern-crown-tyrant` | SSR | yes | M | Provoked; Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-ember-crest-tyrant` | SSR | yes | M | Provoked (targeted) |  |
| `fd-kesh-raptor-rider` | SSR | yes | M | Hunt, attack | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-long-neck-mother` | SSR | yes | M | Provoked (targeted) |  |
| `fd-frost-seer` | SSR | yes | E | none |  |
| `fd-rise-from-tar` | SSR | yes | E | none |  |
| `fd-nirra-ash-witch` | SSR | yes | M | Provoked |  |
| `fd-sky-riders-pact` | SSR | yes | E | none |  |
| `fd-grave-fern-stalker` | SSR | yes | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-tracker-long-grass` | SR | yes | M | Hunt, Duty |  |
| `fd-wild-tyrant` | SR | yes | M | Provoked |  |
| `fd-ambush-at-the-river` | SR | yes | M | Hunt, spell |  |
| `fd-fire-pit` | SR | yes | E | none | Self-source: AI read in A1 |
| `fd-ring-of-embers` | SR | yes | E | none | Existing `eachCreature` damage; provokes both sides |
| `fd-blood-horn-brute` | SR | yes | M | Provoked |  |
| `fd-long-neck-matriarch` | SR | yes | E | none | Dinokin Axis is an `axes.ts` entry (data) |
| `fd-standing-stone` | SR | yes | E | none | Self-source: AI read in A1 |
| `fd-bone-wall-elder` | SR | yes | M | Provoked (targeted) |  |
| `fd-sea-lizard` | SR | yes | E | none |  |
| `fd-ice-keeper` | SR | yes | E | none |  |
| `fd-tar-flat-ambusher` | SR | yes | M | Hunt, arrival |  |
| `fd-bone-caller` | SR | yes | E | none |  |
| `fd-ice-and-tar` | SR | yes | E | none |  |
| `fd-obsidian-knife` | SR | yes | E | none | Duty ping at any creature, yours included: a source (AI read in A1) |
| `fd-herd-caller-hornback` | R | yes | E | none | Dinokin Axis is an `axes.ts` entry (data) |
| `fd-mammothkin-matron` | R | yes | M | Provoked |  |
| `fd-frill-neck-stalker` | R | yes | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-horned-herd` | R | yes | E | none |  |
| `fd-thorn-hide-armourback` | R | yes | M+D | Provoked (targeted); Hunt, Empower; Empower allowlist | Empower Hunt: validator allowlist (types.ts:300-329); an empowered creature whose prey leaves fizzles whole today (probe P5, Q5) |
| `fd-grip-of-the-old-beast` | R | yes | M | Hunt, spell |  |
| `fd-hide-like-stone` | R | yes | E | none |  |
| `fd-great-horn-herder` | R | yes | E | none | `minAttack` on a Duty target: supported (targeting.ts:151-152; Game.ts:993) |
| `fd-thunder-of-hooves` | R | yes | E | none |  |
| `fd-call-the-pack` | R | yes | E | none |  |
| `fd-magma-back` | R | yes | M | Provoked |  |
| `fd-rage-horn` | R | yes | M | Provoked |  |
| `fd-war-drums` | R | yes | C | `eachYourCreature` |  |
| `fd-kindler` | R | yes | E | none | Duty ping at any creature, yours included: a source (AI read in A1) |
| `fd-spear-sister` | R | yes | M | Hunt, arrival |  |
| `fd-duel-on-the-ridge` | R | yes | M | Hunt, spell |  |
| `fd-raptor-pack` | R | yes | E | none |  |
| `fd-clan-hearth` | R | yes | E | none | Sunset with `creatureDiedThisTurn`: supported (EffectInterpreter.ts:238, phases.ts:115-121) |
| `fd-longneck-herd` | R | yes | M | Provoked |  |
| `fd-woolly-rhinokin` | R | yes | M | Provoked |  |
| `fd-elders-verdict` | R | yes | E | none |  |
| `fd-drum-keeper` | R | yes | E | none |  |
| `fd-scar-rite-elder` | R | yes | E | none | Self-source: AI read in A1 |
| `fd-herd-horn` | R | yes | E | none |  |
| `fd-trial-by-ember` | R | yes | C | `eachYourCreature` |  |
| `fd-nest-mother` | R | yes | E | none |  |
| `fd-meltwater` | R | yes | E | none |  |
| `fd-thaw-old-bones` | R | yes | E | none |  |
| `fd-ice-speaker` | R | yes | E | none |  |
| `fd-wind-over-nests` | R | yes | E | none |  |
| `fd-cliff-top-scout` | R | yes | E | none |  |
| `fd-ice-wall-denial` | R | yes | E | none |  |
| `fd-sabrekin-prowler` | R | yes | E | none |  |
| `fd-tar-bubbles` | R | yes | E | none |  |
| `fd-tar-fang-raptor` | R | yes | E | none |  |
| `fd-swallowed-by-tar` | R | yes | E | none |  |
| `fd-ash-witch-drain` | R | yes | E | none |  |
| `fd-tar-pit` | R | yes | E | none |  |
| `fd-tar-skin-brute` | R | yes | M | Provoked |  |
| `fd-fern-and-fire` | R | yes | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-tusk-rage` | R | yes | M | Provoked |  |
| `fd-herd-guardian` | R | yes | M | Provoked (targeted) |  |
| `fd-stampede-long-grass` | R | yes | E | none |  |
| `fd-warband-drummer` | R | yes | E | none | Self-source: AI read in A1 |
| `fd-tar-fossil-seeker` | R | yes | E | none |  |
| `fd-blaze-horn-charge` | R | yes | M | Hunt, spell | Self-source: AI read in A1 |
| `fd-scar-proud-veteran` | R | yes | M | Provoked |  |
| `fd-egg-of-first-dawn` | R | yes | E | none |  |
| `fd-bone-totem` | R | yes | E | none |  |
| `fd-spear-and-fang` | C | yes | M | Hunt, spell |  |
| `fd-stalk-the-ferns` | C | yes | M | Hunt, spell |  |
| `fd-fern-shadow-stalker` | C | yes | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-horn-crest-charger` | C | yes | M | Hunt, arrival |  |
| `fd-tall-grass-tracker` | C | yes | M+D | Hunt, Empower; Empower allowlist | Empower Hunt: validator allowlist; fizzle rule, Q5 |
| `fd-fern-back-grazer` | C | yes | M | Provoked |  |
| `fd-moss-hide-hornback` | C | yes | M | Provoked |  |
| `fd-frill-flare` | C | yes | M | Provoked |  |
| `fd-nest-warden` | C | yes | E | none |  |
| `fd-egg-clutch` | C | yes | E | none |  |
| `fd-cave-bearkin` | C | yes | M | Provoked |  |
| `fd-plated-grazer` | C | yes | E | none |  |
| `fd-thick-hide` | C | yes | E | none |  |
| `fd-horn-bearer` | C | yes | E | none | Condition on a self static: supported (statics.ts:36-40, 103-104); the scorer ignores it |
| `fd-long-tail-grazer` | C | yes | E | none |  |
| `fd-fern-crest-raptor` | C | yes | E | none |  |
| `fd-fern-nest-raider` | C | yes | E | none |  |
| `fd-challenge-the-beast` | C | yes | M | Hunt, spell |  |
| `fd-spear-thrower` | C | yes | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-ridge-raptor` | C | yes | M+D | Hunt, Empower; Empower allowlist | Empower Hunt: validator allowlist; fizzle rule, Q5 |
| `fd-coal-thrower` | C | yes | E | none | Mandatory target; alone, it pings itself (1/3 survives) |
| `fd-ember-flick` | C | yes | E | none |  |
| `fd-drum-beater` | C | yes | C | `eachYourCreature` |  |
| `fd-fire-brand-initiate` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-cinder-crest` | C | yes | M | Provoked |  |
| `fd-hot-blooded` | C | yes | M | Provoked |  |
| `fd-scorch-tail` | C | yes | M | Provoked (targeted) |  |
| `fd-rage-kin-brawler` | C | yes | M | Provoked |  |
| `fd-war-painted` | C | yes | E | none |  |
| `fd-pack-caller` | C | yes | E | none |  |
| `fd-wild-raptors` | C | yes | E | none |  |
| `fd-ember-tongue` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-flint-spear` | C | yes | E | none |  |
| `fd-fire-runner` | C | yes | E | none |  |
| `fd-blaze-crest` | C | yes | E | none |  |
| `fd-hearth-shield` | C | yes | M | Provoked |  |
| `fd-reed-wall-keeper` | C | yes | M | Provoked (targeted) |  |
| `fd-plated-longneck` | C | yes | E | none |  |
| `fd-hearth-tender` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-test-of-the-hearth` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-shepherdess-long-grass` | C | yes | E | none |  |
| `fd-guard-the-nest` | C | yes | E | none |  |
| `fd-calf-guard` | C | yes | E | none |  |
| `fd-dawn-crest` | C | yes | E | none |  |
| `fd-elder-of-embers` | C | yes | E | none |  |
| `fd-sun-stare` | C | yes | E | none |  |
| `fd-bring-it-down` | C | yes | E | none |  |
| `fd-herd-wall` | C | yes | E | none |  |
| `fd-scar-singer` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-wall-kin` | C | yes | M | Provoked |  |
| `fd-cliff-nest-rider` | C | yes | E | none |  |
| `fd-nest-caller` | C | yes | E | none |  |
| `fd-frost-rime-wall` | C | yes | E | none |  |
| `fd-frost-glare` | C | yes | E | none |  |
| `fd-glide-wing-ambush` | C | yes | E | none |  |
| `fd-thaw-and-grind` | C | yes | E | none |  |
| `fd-ice-wall-scout` | C | yes | E | none |  |
| `fd-river-snapper` | C | yes | E | none |  |
| `fd-glacier-memory` | C | yes | E | none |  |
| `fd-cold-refusal` | C | yes | E | none |  |
| `fd-frozen-looter` | C | yes | E | none |  |
| `fd-egg-snatcher` | C | yes | E | none |  |
| `fd-sea-lizard-wake` | C | yes | E | none |  |
| `fd-sky-harrier` | C | yes | E | none |  |
| `fd-tar-rite` | C | yes | E | none |  |
| `fd-bone-picker` | C | yes | E | none |  |
| `fd-tar-flat-grave` | C | yes | E | none |  |
| `fd-ash-cat` | C | yes | E | none |  |
| `fd-tar-drowned` | C | yes | E | none |  |
| `fd-bitter-blood` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-tar-skin-wall` | C | yes | M | Provoked |  |
| `fd-fossil-dreamer` | C | yes | E | none | Reclaims on arrival (not on death), so the targeted self-reclaim gap is not used |
| `fd-tar-fang` | C | yes | E | none |  |
| `fd-scar-knife` | C | yes | E | none | The arrival target is mandatory and may be itself: alone, it deals 1 to itself and dies (probe P2). Reword: "another target creature you control" (`other`), Q9; Self-source: AI read in A1 |
| `fd-bone-heap` | C | yes | E | none |  |
| `fd-tar-pit-lurker` | C | yes | E | none |  |
| `fd-grave-mourner` | C | yes | E | none |  |
| `fd-bone-whistle` | C | yes | E | none |  |
| `fd-ember-pot` | C | yes | E | none | Self-source: AI read in A1 |
| `fd-carved-tusk` | C | yes | E | none |  |
| `fd-resin-cast` | C | yes | E | none |  |
| `fd-nest-guard` | C | yes | E | none |  |
| `fd-rakka-red-pack` | UR | no | E | none |  |
| `fd-painted-cave` | UR | no | E | none |  |
| `fd-venna-red-hand` | UR | no | E | none | Duty ping at any creature, yours included: a source |
| `fd-uzza-war-painter` | SSR | no | C | `eachYourCreature` |  |
| `fd-great-drum` | SSR | no | E | none |  |
| `fd-kree-wind-crest` | SSR | no | E | none |  |
| `fd-nest-keeper` | SR | no | E | none |  |
| `fd-crag-leaper` | SR | no | M | Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-frozen-in-the-ice` | SR | no | E | none |  |
| `fd-ash-witch-edict` | SR | no | E | none |  |
| `fd-old-bull` | R | no | E | none |  |
| `fd-herd-singer` | R | no | E | none | Targeted `allyAttacks` observer: supported (EffectInterpreter.ts:1228-1234) |
| `fd-tusk-and-claw` | R | no | M | Provoked; Hunt, arrival | Hunt, generic prey: an opponent's creature only (Q6's forced fallback superseded 2026-09-28) |
| `fd-hurled-firebrand` | R | no | E | none |  |
| `fd-obsidian-tooth` | R | no | M | Provoked |  |
| `fd-raptor-ambush` | R | no | E | none |  |
| `fd-brow-plate` | R | no | E | none |  |
| `fd-sun-hold` | R | no | E | none |  |
| `fd-river-lurker` | R | no | E | none |  |
| `fd-ice-mirror-seer` | R | no | E | none |  |
| `fd-bones-in-the-tar` | R | no | E | none |  |
| `fd-ash-rite` | R | no | E | none |  |
| `fd-sky-herder` | R | no | E | none |  |
| `fd-river-wader` | C | no | M | Provoked (targeted) |  |
| `fd-stubborn-armourback` | C | no | M | Provoked |  |
| `fd-hatchling-mother` | C | no | E | none |  |
| `fd-call-of-first-dawn` | C | no | E | none |  |
| `fd-grazing-hornback` | C | no | E | none | Condition on a self static: supported |
| `fd-bone-snap` | C | no | X | keyword-qualified target | "target creature with Skyborne" needs a keyword-qualified target; reword to "Destroy target creature with Attack 4 or more"-style limits, or leave cut (Q2) |
| `fd-trample-path` | C | no | E | none |  |
| `fd-raptor-whistler` | C | no | E | none |  |
| `fd-ember-fury` | C | no | E | none |  |
| `fd-pack-runner` | C | no | E | none | Condition on a self static: supported |
| `fd-shield-crest` | C | no | M | Provoked |  |
| `fd-stand-behind-horns` | C | no | E | none |  |
| `fd-hearth-guard` | C | no | E | none |  |
| `fd-herd-mother-blessing` | C | no | E | none |  |
| `fd-bone-bead-elder` | C | no | E | none |  |
| `fd-tidal-lizard` | C | no | E | none |  |
| `fd-ice-lens` | C | no | E | none |  |
| `fd-frost-bitten-seer` | C | no | E | none |  |
| `fd-ash-brand` | C | no | E | none |  |
| `fd-grave-dust` | C | no | E | none |  |
| `fd-ash-choked` | C | no | E | none |  |
| `fd-marrow-drinker` | C | no | E | none |  |

## Appendix B: the probes

Throwaway scripts run on 2026-09-28 against `release/1.9` in this branch's
worktree, constructing cards and running them through the real engine
(`Game`, `legalActions`, `checkStateBased`, `resolveCombatDamage`,
`resolveStackItem`). None is in the repo. Results:

| Probe | Question | Result |
| --- | --- | --- |
| P1 | Can a spell with two target specs (`yourCreature`, then `creature`) name one creature in both? | Yes: of the 2 legal casts, 1 names the same creature twice. Hunt needs its own distinctness rule |
| P2 | Scar-Knife Witch (2/1, "Arrives: damage target creature you control 1, then opponent loses 1 life") cast onto an empty board | The only legal target is itself; it deals 1 to itself and dies; the opponent loses 1 |
| P3 | A targeted dies trigger with `yourGraveCreature` and `other`: can it pick its own card? | Yes: its own card is the one legal target |
| P4 | First Blade combat with a blocker whose dies trigger is untargeted | Order: first-strike damage, death, the dies trigger resolves (life +5), then regular damage. An untargeted trigger resolves between the steps |
| P5 | The Drowned Saint cast empowered at a creature that has since left | `targetsFizzled`: the Saint goes to the graveyard, not the battlefield |

The review's probe A (a separate reviewer script, the same day): a First
Blade attacker kills a blocker whose untargeted dies trigger gains 5 life,
while a second pair deals regular damage. With no link: first-strike damage,
death, the trigger, +5 life, regular damage. With a Hauntlink payable:
first-strike damage, death, the trigger fires, regular damage, a death, the
window, and only then +5 life. That is the combat gap in Part 1.

The pool census (the same day, over `ALL_CARDS`, 1,487 non-token card
definitions): one creature prints Blood Oath and deals ability damage to someone other
than its controller (Eclipse-Red Queen, to the opponent), and one prints
Deathblade and damages only its controller (Oni Underboss of Rain); five
cards grant Deathblade or Blood Oath; 48 creatures have a `damage` op
anywhere on the card (43 excluding the five whose only damage is to their
own controller), 14 of them at a target; 46 creatures print Deathblade, the
cheapest two at one mana (Dong Bai, Tyrant's Grandchild and Wharf Rat, both
1/1); ten names contain "hunt", four as the whole word; no shipped card has a
targeted dies trigger; one shipped card uses `oncePerTurn` (Saint of the Lamp
Oil).
