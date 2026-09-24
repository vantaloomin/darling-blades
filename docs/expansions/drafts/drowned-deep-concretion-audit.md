<!-- source-of-truth: docs/expansions/drafts/drowned-deep-overplan.md, src/engine/types.ts, src/engine/effects/EffectInterpreter.ts, src/engine/effects/targeting.ts · last-verified: 2026-09-15 · audit record — the read-only concretion audit (Codex, gpt-6-astra, 2026-09-15) behind drowned-deep-concretion.md; findings with proof pointers, kept verbatim as the transcription's checklist -->

# Drowned Deep concretion audit

**191 of the 252 collectible rows map fully to today’s engine.** Another 61 contain a lossy mapping or an unsupported clause/composition. All four token definitions are expressible.

Scope: the **252 unique kept IDs**, each matched to exactly one card-table row, plus the four tokens. Cut and undecided rows are excluded. The governing concretion step is [plan-1.8.md:158](<Z:/Coding Projects/DarlingBlades/docs/plan-1.8.md:158>).

## 1. Counts and direct mappings

| Scope | Fully A | Any B | Any C |
|---|---:|---:|---:|
| 252 collectible rows | **191** | **24** | **39** |
| Four tokens | **4** | **0** | **0** |
| **Total** | **195** | **24** | **39** |

**B/C overlap:** `dd-drowned-saint` and `dd-rite-of-the-salt-gate` have both a missing target restriction and an invalid mechanic/target combination. The disjoint total is **195 fully A + 22 B-only + 39 C = 256**.

These are **rules-clause counts**. Separate type-line and catalog-registration problems appear in sections 4–5.

**Classification convention:** B identifies an existing operation whose approximation loses a printed restriction. C identifies an absent operation, event, condition, object binding, or rejected combination. The B approximations below are findings, not approved wording changes.

### A: complete mapping key

For every kept row, clauses not identified as B/C below are **A**, using these constructs. Compound effects use ordered `ops`; supported portions of a problematic combination remain individually A.

| Printed clause or form | Direct construct and proof |
|---|---|
| Ordinary Charm/Ritual effects; `Arrives:`; `Dies:`; `During your Dawn:` | `abilities[].when: 'spell' / 'arrives' / 'dies' / 'dawn'`. [TriggerWhen](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:36>), [trigger dispatcher](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:919>). Arrival targeting is supported; other ordinary triggers receive no chosen targets. |
| `When/Whenever this attacks, damage opponent N` | `when:'attacks'`, `damage {n,to:'opponent'}`. Applies to `dd-cinderjaw`, `dd-breakwater-brute`, `dd-storm-tide-horror`. [Attack dispatch](<Z:/Coding Projects/DarlingBlades/src/engine/Game.ts:962>). |
| `Whenever a creature arrives under your control, gain 2 life` | `when:'allyCreatureArrives'`, `gainLife {n:2}` on `dd-salt-chapel`. Its enchantment source makes the observer’s source exclusion immaterial. [Observer implementation](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:875>). |
| `Whenever you put a Mark on a creature, gain 1 life` | `when:'youAddMark'`, `gainLife {n:1}` on `dd-reef-shaman`. [Mark dispatch](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:159>). |
| `Duty[, {cost}]: …` | `activated:{cost:{tap:true,mana?},targets?,ops}`. [ActivatedDef](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:201>), [validator](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:537>). Individual unsupported effects and the double-Duty row are listed below. |
| `Whispers {cost}`; `Tithe`; `Skim {cost}` | `whispers:{cost}`, `tithe:{per:2}`, `skim:{cost}`. All **40 Whispers**, **31 Tithe**, and **19 Skim** carriers satisfy their relevant printed pairing restrictions. [Fields/types](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:166>), [Whispers/Tithe validators](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:475>). |
| `Retell {cost}` without override | `retell:{cost}` replays the spell body, including its normal targets: `dd-drowned-ledger`, `dd-what-was-promised`, `dd-drowned-forge-fire`. [Target selection](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:27>), [resolution](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:114>). |
| `Rite 1. Gain 4 life and Foresee 2.` | `rite:{n:1}` plus `spell` → `gainLife`, `foresee` on `dd-rite-of-the-lamp`. [Rite validator](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:451>). The other four Rite rows violate its targeting restriction. |
| Empower; Quest chapters | Existing fields are `empower:{cost,targets?,ops}` and `chapters:EffectOp[][]`. The sole kept Empower rider is C below; **no kept row prints chapters**. [Empower validator](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:269>), [chapter execution](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:1106>). |
| Gain life; opponent loses life; draw | `gainLife {n}`, `loseLife {n,who:'opponent'}`, `draw {n}`. [Cases](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:306>). |
| `You lose N life` | Current behavioral mapping is `damage {n,to:'controller'}`: `dd-wreckfire` 5, `dd-black-water` 3, `dd-cold-bargain` 2. Both player damage and `loseLife` use the same life-subtraction helper. Generated wording becomes damage to you, following the explicit [Duat convention](<Z:/Coding Projects/DarlingBlades/src/data/cards/sands-of-the-duat.ts:1165>) and [damage case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:279>). |
| Damage target creature / opponent / all creatures | `damage {n,to:'target'/'opponent'/'eachCreature'}`; creature targets use `{what:'creature'}`. [Damage case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:279>). |
| Opponent discards one/two cards **at random** | Exactly `discardRandom {n,who:'opponent'}`. The implementation uses seeded `rngInt`; randomness is supported. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:322>). |
| Grind self/opponent N; `each player grinds 3` | `grind {n,who:'self'/'opponent'}`. `dd-father-dagon` uses two grind ops, one per player. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:698>). |
| Foresee N; Foresee then draw | `foresee {n}`, followed by target-free `draw`. The continuation preserves order after the Foresee decision. [Foresee case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:712>), [continuation](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:796>). |
| Uncapped tap / recall / destroy / Sever | `{what:'creature'}` with `tap`, `recall`, `destroy`, or `sever`, each `to:'target'`. [Target legality](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:85>), [destroy/Sever](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:335>), [recall](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:409>), [tap](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:607>). |
| `Destroy target Artifact or Enchantment` | `{what:'artifactOrEnchantment'}` plus **`destroy`**. The interpreter destroys the targeted permanent; using `destroyArtifactOrSeverEnchantment` would change the enchantment outcome. [Target kind](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:129>), [destroy case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:335>). |
| `Cancel target spell` | `{what:'spell'}` plus `cancel {to:'target'}`. [Spell legality](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:114>), [case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:416>). |
| Target creature gets −P/−T; each creature gets −2/−2 until end of turn | `boost {p,t,scope:'target'/'all'}`; targeted form uses `{what:'creature'}`. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:437>). |
| Mark this / target creature / target creature you control | `addCounters {n:1,to:'self'/'target'}`; target kind `creature` or `yourCreature`. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:459>). |
| Mark each creature you control; mark each already-Marked creature you control | `markAll {scope:'yourCreatures'}`; `propagate`, respectively. Thus `dd-coral-mother` maps directly to Propagate. [markAll](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:539>), [propagate](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:478>). |
| Create named tokens, including stated stats/keywords | `createToken {token:<id>,count:N}` referencing the corresponding token CardDef. Stats and keywords belong on that definition. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:617>). |
| Return your graveyard creature to hand / battlefield | `{what:'yourGraveCreature'}` plus `reclaim` / `raise {to:'target'}`. [reclaim](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:683>), [raise](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:724>). Subsequent-object riders have separate C findings. |
| Destroy all creatures; prevent combat this turn | `massDestroy {filter:'allCreatures'}`; `preventCombat`. The latter prevents **all combat damage this turn**, rather than skipping combat. [Cases](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:650>). |
| Your creatures’ stat/keyword anthems; marked-creature anthems; subtype anthems; opponent −1/−0 | `when:'static'`, `static:{scope:'filter',filter?,p?,t?,grantKeywords?}`. Filters support `subtype`, `other`, `marked`, `who:'opponent'`. [StaticDef](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:122>), [application](<Z:/Coding Projects/DarlingBlades/src/engine/statics.ts:103>). Catalog Axis restrictions are separate, below. |

In particular, these are direct engine shapes:

- `dd-salt-stair-captain`: `{subtype:'Warden',other:true}`, `p:0,t:1`.
- `dd-horror-lord`: `{subtype:'Horror',other:true}`, `p:1,t:0,grantKeywords:['dreaded']`.
- `dd-fog-that-stays`: `{who:'opponent'}`, `p:-1,t:0`.
- Marked anthems: `{marked:true}`, with the printed stats/keywords.

## 2. C: unsupported clauses and combinations

### Missing triggers or conditions

The complete [TriggerWhen union](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:36>) contains no Sunset, life-gain, Charm-cast, sacrifice, or general creature-death observer. [Ability conditions](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:138>) cover Quests and Marks; [condition evaluation](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:221>) has no Horror-presence or death-this-turn condition.

| Shape / exact printed clause | Every kept card ID | Engine need |
|---|---|---|
| “During your Dawn, if you control another Horror, opponent loses 2 life.” | `dd-mother-hydra` | A condition checking another controlled creature of subtype Horror. Dawn and `loseLife` already exist. |
| “At Sunset, if a creature died this turn, damage opponent 1.” | `dd-false-beacon` | Sunset trigger dispatch **and** death-this-turn tracking/condition. |
| “Whenever you gain life, put a Mark on this.” | `dd-lamp-oil-saint` | A life-gain observer; `addCounters` to self already exists. |
| “Whenever you cast a Charm, Foresee 1.” | `dd-bell-below` | A controller’s Charm-cast observer. |
| “Whenever you sacrifice a creature, gain 1 life.” | `dd-horror-garden` | A creature-sacrifice observer. |
| “Whenever a creature you control dies, gain 1 life.” | `dd-widows-walk` | General allied-creature death observer. |
| “Whenever a creature you control dies, opponent loses 1 life.” | `dd-low-tide-grave` | Same observer with `loseLife`. |
| “Whenever another creature you control dies, gain 1 life.” | `dd-widow-of-the-reach` | Allied death observer with source exclusion. |
| “Whenever another creature you control dies, opponent loses 1 life.” | `dd-marsh-widow` | Same observer with `loseLife`. |
| “Whenever another creature you control dies, put a Mark on this.” | `dd-salt-marsh-horror` | Same observer with self-marking. |
| “Whenever another Horror you control dies, you gain 2 life.” | `dd-what-the-nets-remember` | Allied death observer with source exclusion and subtype filter. |
| “Whenever a creature you control attacks, damage opponent 1.” | `dd-storm-front-lesser` | General allied attack observer. Existing `markedAllyAttacks` excludes unmarked attackers. [Implementation](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:1010>). |

**Requested opponent-death check:** no kept row prints “whenever a creature an opponent controls dies.” That observer is also absent. Ordinary `dies` fires the dead permanent’s own abilities, not battlefield observers. [Death dispatch](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:1054>).

### Loot: self-discard is absent

| Exact printed clause | Every kept card ID |
|---|---|
| “Duty: draw a card, then discard a card.” | `dd-drowned-scholar`, `dd-net-mender`, `dd-harbour-looter`, `dd-cellar-witch`, `dd-low-street-looter` |
| “Duty, {1}: draw a card, then discard a card.” | `dd-low-street-witch`, `dd-wreck-diver` |
| “Arrives: draw a card, then discard a card.” | `dd-tidewater-scholar` |

The draw portion is A. The discard portion needs a **controller-selected hand-discard op and deferred choice**, preserving draw-then-discard order. `discardRandom` is opponent-only; Skim discards its own carrier and cannot implement this. [EffectOp union](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:82>), [discard case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:322>).

### Missing mass-tap and sacrifice effects

| Exact printed clause | Every kept card ID | Engine need |
|---|---|---|
| “Tap all creatures an opponent controls.” | `dd-lightkeepers-oath`, `dd-vigil-bell`, `dd-salt-fog` | Target-free mass-tap scope/op filtered to opponent creatures. Current `tap` only follows chosen target references. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:607>). |
| “Opponent sacrifices a creature.” | `dd-tithe-to-the-deep`, `dd-marsh-lamp-lure` | Opponent sacrifice-choice effect. |
| “Each player sacrifices a creature.” | `dd-reckoning-below` | Sacrifice-choice effect for each player, with defined sequencing. |

Rite/Tithe sacrifice **cast costs** do not provide sacrifice resolution ops; none exists in the [EffectOp union](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:82>).

### Unsupported subject binding or duration

| Exact printed clause/composition | Every kept card ID | Engine need |
|---|---|---|
| “Dies: return this to your hand.” | `dd-drowned-bride` | An op referencing the dead source’s graveyard card. `recall` operates on battlefield permanents; `reclaim` requires a selected graveyard target. [recall](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:409>), [reclaim](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:683>). |
| “Return target creature card from your graveyard to the battlefield. It has Dreaded.” | `dd-salt-marsh-bargain` | First sentence is A. The rider needs a reference to the returned permanent plus a durable keyword grant. `raise` exposes no result reference; `boost` lasts only until end of turn. [raise](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:759>), [boost](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:437>). |
| “Create a 2/2 green Kelp Shade token and put a Mark on it.” | `dd-net-full-of-stars` | Token creation is A. Marking it needs a created-object reference or explicit token-with-Marks support. `createToken` retains the new permanent only locally. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:617>). |
| “Return target creature card from your graveyard to your hand. Put a Mark on target creature you control.” | `dd-the-marsh-remembers` | Both operations exist individually; combining them needs per-op target binding. Normal ops share `targets[0]`; separate spell abilities receive the same list. [Target selection](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:87>), [spell resolution](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:125>). |

### Targeted non-arrival triggers

| Exact printed clause | Every kept card ID |
|---|---|
| “Whenever this attacks, damage target creature 1.” | `dd-wrecker-queen` |
| “During your Dawn: put a Mark on target creature you control.” | `dd-marsh-gate` |

Both trigger timings and ops exist, but the combinations need chosen-target decisions for these trigger kinds. Only `arrives` takes the target-choice branch; these triggers execute with `targets:[]`. [Dispatcher](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:932>), [ordinary trigger context](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:976>).

### Mechanic combinations rejected by today’s contracts

| Exact printed combination | Every kept card ID | Engine need |
|---|---|---|
| “Duty: Foresee 2. Duty, {2}: draw a card.” | `dd-glass-that-came-back` | Multiple activated abilities and an ability selector. Each Duty is individually supported, but `CardDef.activated` is singular. [ActivatedDef](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:201>), [field](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:369>). |
| “Rite 1. Damage target creature 7 and damage opponent 3.” | `dd-rite-of-the-false-beacon` | Support targets alongside Rite. |
| “Rite 1. Destroy target creature with attack 4 or more.” | `dd-rite-of-the-salt-gate` | Support targets alongside Rite; attack restriction also B below. |
| “Rite 1. Damage target creature 4 and damage opponent 2.” | `dd-rite-of-the-wreckers` | Support targets alongside Rite. |
| “Rite 1. Damage target creature 4.” | `dd-rite-of-the-lamp-fire` | Support targets alongside Rite. |
| “Empower {2}: destroy target creature with cost 3 or less.” | `dd-drowned-saint` | Extend Empower’s permitted targeted riders to destruction; cost restriction also B below. |
| “Retell {2}{R}: damage target creature 2.” | `dd-reach-fire-witch` | Both creature Retell semantics and targeted override support. |

Proof:

- [Rite validator](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:464>) rejects nonstatic ability targets.
- [Empower validator](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:276>) permits targeted `moveMark` or `reclaim`, not `destroy`.
- [Retell eligibility](<Z:/Coding Projects/DarlingBlades/src/engine/actions.ts:458>) requires a Charm/Ritual. Overrides [suppress target selection](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:35>) and [resolve with empty targets](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:115>).

## 3. B: existing constructs with a loss

### Cost-capped targets

`TargetSpec` has **no cost qualifier**. Its optional fields are `other`, `upTo`, `marked`, and `tapped`; legality performs no mana-value check. [Type](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:54>), [qualifiers](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:57>).

| Exact printed clause | Every kept card ID | Existing mapping; loss |
|---|---|---|
| “Duty: recall target creature with cost 3 or less.” | `dd-tidewife` | `creature` + `recall`; loses cost ≤3. |
| “Cancel target spell with cost 3 or less.” | `dd-cold-current` | `spell` + `cancel`; loses cost ≤3. |
| “Empower {2}: destroy target creature with cost 3 or less.” | `dd-drowned-saint` | `creature` + `destroy` lacks cost ≤3; Empower combination independently C. |
| “Destroy target creature with cost 3 or less.” | `dd-the-price` | `creature` + `destroy`; loses cost ≤3. |
| “Arrives: tap target creature with cost 2 or less.” | `dd-bell-hand` | `arrives`, `creature` + `tap`; loses cost ≤2. |
| “Recall target creature with cost 2 or less.” | `dd-undertow-charm` | `creature` + `recall`; loses cost ≤2. |
| “Cancel target spell with cost 2 or less.” | `dd-still-harbour` | `spell` + `cancel`; loses cost ≤2. |
| “Destroy target creature with cost 2 or less.” | `dd-the-deep-collects`, `dd-what-the-sea-wants` | `creature` + `destroy`; loses cost ≤2. |
| “Arrives: return target creature card with cost 2 or less from your graveyard to your hand.” | `dd-drowned-nurse` | `arrives`, `yourGraveCreature` + `reclaim`; loses cost ≤2. |

**Exact support needs:** a cost-cap qualifier enforced for battlefield, stack, and graveyard targets as applicable.

### Attack-capped targets

| Exact printed clause | Every kept card ID | Loss / need |
|---|---|---|
| “Destroy target creature with attack 4 or more.” | `dd-rite-of-the-salt-gate` | `creature` + `destroy` loses attack ≥4; Rite combination independently C. |
| “Sever target creature with attack 3 or more.” | `dd-salt-and-prayer` | `creature` + `sever` loses attack ≥3. |

**Exact support needs:** a minimum-effective-attack target qualifier. None exists in [TargetSpec](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:54>) or [legality](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:76>).

### Opponent-only creature targets

| Exact printed clause | Every kept card ID |
|---|---|
| “Duty, {1}: gain 3 life and tap target creature an opponent controls.” | `dd-lightkeeper` |
| “Duty: tap target creature an opponent controls.” | `dd-gate-warden` |
| “Duty, {1}{W}: tap target creature an opponent controls.” | `dd-tide-gate` |
| “Arrives: recall target creature an opponent controls.” | `dd-thing-in-the-cistern` |

The ops and timing map, but `{what:'creature'}` also permits your creatures. There is `yourCreature`, but no opponent-creature kind/controller qualifier. Exact support needs that qualifier. [Target kinds and legality](<Z:/Coding Projects/DarlingBlades/src/engine/effects/targeting.ts:85>).

### Token-only anthems

| Exact printed clause | Every kept card ID |
|---|---|
| “Your Plant tokens get +1/+1.” | `dd-kelp-cathedral`, `dd-marsh-road` |
| “Your Plant tokens have Sentinel.” | `dd-marsh-road` |
| “Your Plant tokens get +0/+1.” | `dd-kelp-shade-elder` |

`static.filter:{subtype:'Plant'}` applies the printed stats/keywords but also buffs **nontoken Plants**, including this set’s Plant creatures. Exact support needs a token predicate in the static filter. [StaticDef](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:122>), [application](<Z:/Coding Projects/DarlingBlades/src/engine/statics.ts:103>).

### Other scope/cardinality losses

| Exact printed clause | Every kept card ID | Existing mapping, loss, and exact need |
|---|---|---|
| “Arrives: put a Mark on each other creature you control.” | `dd-the-reef-that-walks` | `markAll` also marks the source. Needs source exclusion. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:539>). |
| “Damage each creature an opponent controls 3.” | `dd-fire-on-the-point` | `damage {n:3,to:'eachCreature'}` also damages friendly creatures. Needs an opponent-only scope. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:281>). |
| “Tap two target creatures.” | `dd-drowned-chapel-bell` | `{what:'creature',upTo:2}` + `tap` allows **zero, one, or two**. Exact support needs mandatory-two batching. Minimal reword: “Tap up to two target creatures.” [Enumeration](<Z:/Coding Projects/DarlingBlades/src/engine/actions.ts:362>), [batch activation](<Z:/Coding Projects/DarlingBlades/src/engine/resolve.ts:139>). |
| “Prevent combat damage to target creature this turn.” | `dd-harbour-vigil` | `preventCombat` prevents **all** combat damage, including damage to players and other creatures. Needs targeted prevention. [Case](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:680>). |
| “When this attacks, it gets +1/+0 until end of turn.” | `dd-breakwater-brawler` | `attacks` + `boost {p:1,t:0,scope:'allYours'}` also pumps every ally. Exact support needs `boost.scope:'self'`; ordinary attacks have no target binding. [Boost scopes](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:99>), [trigger context](<Z:/Coding Projects/DarlingBlades/src/engine/effects/EffectInterpreter.ts:984>). |

## 4. Keyword, subtype, token, and set work

### Keyword IDs: none new

The actual union is named **`Keyword`**, not `KeywordId`. All requested keywords already exist:

| Printed | Engine ID |
|---|---|
| Warcry | `warcry` |
| Sentinel | `sentinel` |
| Bulwark | `bulwark` |
| Warding Gaze | `wardingGaze` |
| First Blade | `firstBlade` |
| Deathblade | `deathblade` |
| Overrun | `overrun` |
| Rage | `rage` |
| Dreaded | `dreaded` |
| Untouchable | `untouchable` |
| Skyborne | `skyborne` |

Proof: [types.ts:7](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:7>) and [glossary.ts:15](<Z:/Coding Projects/DarlingBlades/src/data/glossary.ts:15>). **No keyword-union edit is required.** Duty, Whispers, Tithe, Rite, Skim, and Retell use CardDef fields.

### Subtypes

`CardDef.subtypes` is **`string[]`**, not a union. Encode a Deep One Horror as `['Deep One','Horror']`; preserve `"Deep One"` as one subtype string. [Field](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:339>).

| Status | Subtypes / current evidence |
|---|---|
| **New literal strings** | `Horror`, `Deep One`; neither currently occurs in the card definitions. Add them to relevant new CardDefs and Deep-Spawn. |
| Existing | Warden: [dark-tales.ts:226](<Z:/Coding Projects/DarlingBlades/src/data/cards/dark-tales.ts:226>); Witch: [arthurian-court.ts:24](<Z:/Coding Projects/DarlingBlades/src/data/cards/arthurian-court.ts:24>); Mermaid: [beastkin.ts:268](<Z:/Coding Projects/DarlingBlades/src/data/cards/beastkin.ts:268>); Spirit: [ragnarok.ts:327](<Z:/Coding Projects/DarlingBlades/src/data/cards/ragnarok.ts:327>). |
| Existing | Plant: [tokens.ts:79](<Z:/Coding Projects/DarlingBlades/src/data/cards/tokens.ts:79>); Beast: [sands-of-the-duat.ts:2986](<Z:/Coding Projects/DarlingBlades/src/data/cards/sands-of-the-duat.ts:2986>); Bird: [tokens.ts:62](<Z:/Coding Projects/DarlingBlades/src/data/cards/tokens.ts:62>); Beastkin: [beastkin.ts:10](<Z:/Coding Projects/DarlingBlades/src/data/cards/beastkin.ts:10>); Human: [dark-tales.ts:82](<Z:/Coding Projects/DarlingBlades/src/data/cards/dark-tales.ts:82>). |

**Beastkin is not printed in the kept rows.** No additional subtype strings beyond the other ten occur in their type lines.

**Separate catalog blocker:** static subtype filters must name an entry in `AXES`. Currently **Horror, Warden, and Plant are all absent**. [Catalog gate](<Z:/Coding Projects/DarlingBlades/tests/data/catalog.test.ts:103>), [AXES](<Z:/Coding Projects/DarlingBlades/src/data/axes.ts:19>).

Affected rows:

- Horror: `dd-horror-lord`.
- Warden: `dd-bell-that-will-not-ring`, `dd-salt-stair-captain`.
- Plant: `dd-kelp-cathedral`, `dd-marsh-road`, `dd-kelp-shade-elder`, additionally subject to B above.

Horror’s Axis addition is already approved in [the brief:124](<Z:/Coding Projects/DarlingBlades/docs/expansions/drafts/drowned-deep-brief.md:124>); transcription needs its registration at `src/data/axes.ts:19` and the corresponding tribal-plan record. Warden/Plant payoffs need an owner resolution of the existing Axis rule; their status cannot be silently inferred from free-string subtype support.

### Four token definitions

The [token table](<Z:/Coding Projects/DarlingBlades/docs/expansions/drafts/drowned-deep-overplan.md:459>) supplies **names, not IDs**. Four new `tok-…` IDs must therefore be allocated. These are candidate transcription identifiers, not IDs already approved in the document:

| Candidate ID | Draft name | Definition |
|---|---|---|
| `tok-deep-spawn` | Deep-Spawn | B, creature, `['Deep One','Horror']`, 2/2, no keywords |
| `tok-drowned` | The Drowned | B, creature, `['Spirit']`, 1/1, no keywords |
| `tok-lantern-wisp` | Lantern Wisp | W, creature, `['Spirit']`, 1/1, `['skyborne']` |
| `tok-kelp-shade` | Kelp Shade | G, creature, `['Plant']`, 2/2, no keywords |

All require `token:true` in **[tokens.ts, before its closing array at line 335](<Z:/Coding Projects/DarlingBlades/src/data/cards/tokens.ts:335>)**, with matching `createToken.token` references in the new set module.

Naming reconciliation: the token table says **“The Drowned”**, while `dd-what-the-nets-remember` and `dd-horror-garden` mint **“Drowned Spirit.”** The counts treat these as the same specified black 1/1 Spirit. The token table’s minter annotations are stale; the actual kept rules still provide those two minters.

### Set union and registration

| Required work | Existing location |
|---|---|
| Add `'drowned-deep'` to `CardDef.set` | **[types.ts:378](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:378>)** |
| Create the set data module | `src/data/cards/drowned-deep.ts` — new file; no existing line |
| Import and register its array under `'drowned-deep'` | [catalog.ts:2](<Z:/Coding Projects/DarlingBlades/src/data/catalog.ts:2>), [SET_GROUPS:37](<Z:/Coding Projects/DarlingBlades/src/data/catalog.ts:37>) |
| Register the `dd-` prefix and set-stamping expectations | [catalog.test.ts:126](<Z:/Coding Projects/DarlingBlades/tests/data/catalog.test.ts:126>), [set checks:281](<Z:/Coding Projects/DarlingBlades/tests/data/catalog.test.ts:281>) |
| Release/display set registration | [setTitles.ts:8](<Z:/Coding Projects/DarlingBlades/src/data/setTitles.ts:8>) (`SET_IDS`, deriving `SetId`), title at line 31, blurb at line 44; [setIcons.ts:14](<Z:/Coding Projects/DarlingBlades/src/art/setIcons.ts:14>) |

## 5. Cost, stats, and type-line findings

### No malformed costs or stats

Across the 252 collectible rows:

- **155 creatures**, all with numeric attack/defense.
- **97 noncreatures**, all with `none` for stats.
- All costs use fixed numeric/WUBRG mana symbols; **no X costs**.
- Mana values **1–8**; attack **0–8**; defense **1–8**.
- All main card types are supported.

The four tokens have valid stats/type lines and **no printed mana costs**. Existing `cost:cost(0)` token definitions are normal, not malformed; tokens are excluded from the collectible mana-value gate. [Token precedent](<Z:/Coding Projects/DarlingBlades/src/data/cards/tokens.ts:11>), [mana/stat gates](<Z:/Coding Projects/DarlingBlades/tests/data/catalog.test.ts:161>).

### Five type lines fail the multicolour-legendary catalog rule

These type lines are representable by the TypeScript schema, but fail the existing catalog contract:

| Card ID | Printed type line | Draft line |
|---|---|---:|
| `dd-lightkeepers-oath` | `Ritual` | 85 |
| `dd-drowned-deacon` | `Creature, Deep One Horror` | 253 |
| `dd-horror-garden` | `Enchantment` | 254 |
| `dd-watch-and-tide` | `Charm` | 255 |
| `dd-marsh-mother-horror` | `Creature, Deep One Horror` | 256 |

All five are multicolour nonlands lacking `legendary`, and none is an existing exception. The owner must supply legendary status or an explicit exception; transcription should not silently change them. [Catalog gate and exception list](<Z:/Coding Projects/DarlingBlades/tests/data/catalog.test.ts:365>).

Printed legendary rows otherwise map directly to `supertypes:['legendary']`. [Schema field](<Z:/Coding Projects/DarlingBlades/src/engine/types.ts:340>).

**Verification:** source inspection, in-memory ID/schema reconciliation, and independent mapping/schema crosschecks. **No files written. No Git commands run. No tests or builds run.**
