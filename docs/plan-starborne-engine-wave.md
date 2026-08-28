<!-- source-of-truth: src/engine/types.ts, src/engine/effects/EffectInterpreter.ts, src/engine/Game.ts, docs/expansions/drafts/starborne-overplan.md · last-verified: 2026-08-28 · plan doc — the engine wave that fills the 65 UNMAPPED Starborne cards (registry in src/data/cards/starborne.ts on branch feat/starborne-cards); re-verify when the wave lands -->

# The Starborne engine wave

The mark vocabulary the locked 151-card set assumes, specified for
implementation. Ruled 2026-08-28: the hybrid is greenlit, and **triggers can
now target** ("Triggers never target" retires as a snapshot guideline; the
iron invariants - purity, PlayerView redaction, seeded determinism, save
migrations - are NOT snapshots and hold unchanged). The 65 cards carrying an
UNMAPPED entry in `src/data/cards/starborne.ts` (branch `feat/starborne-cards`)
are the acceptance list: when every entry is deleted because its mechanics are
expressed, the wave is done.

**No card rewords.** The locked text is the contract; the engine grows to meet
it.

## 1. Data-model extensions (src/engine/types.ts)

All extensions are additive; no existing field changes meaning.

### 1a. Targeted triggers

`AbilityDef.targets` becomes legal on `when: 'arrives'` (the only trigger kind
any Starborne card targets from). Resolution gains a decision point: when a
permanent with a targeted arrival ability enters, the controller chooses the
target before the ops run, through the same `pendingDecisions` queue Foresee
uses (new decision kind `chooseTarget`, new awaiting kind mirroring it).

- **No legal target: the trigger fizzles silently** (ops do not run). This is
  what makes the converter's dead-target detector still meaningful.
- **The AI must choose** at all three difficulties. Floor: greedy single-pass
  valuation using the existing op-impact machinery; no hidden state, PlayerView
  only.
- **Human UI**: the DuelScene targeting flow that spells already use, reused
  for the arrival prompt. Cancel is not offered when the trigger is mandatory
  (all 65 are mandatory).

`TargetSpec` gains four optional fields (the last two added 2026-08-28 after
the Blade Assay sweep caught the restriction family the first draft missed):

```ts
interface TargetSpec {
  what: /* unchanged union */;
  /** Excludes the ability's source permanent ("another target creature"). */
  other?: true;
  /** "up to N targets"; each is chosen independently, zero is legal. */
  upTo?: 2;
  /** Restricts legal targets to permanents carrying at least one mark. */
  marked?: true;
  /** Restricts legal targets to tapped permanents. */
  tapped?: true;
}
```

The restriction qualifiers filter the legal-target set, compose with `other`
and `upTo`, apply on both spell-side and trigger-side targeting, and interact
with the fizzle rule exactly as an empty legal set does. They carry cards
`sb-black-starving-orbit` ("Sever target creature with a mark" - the anti-mark
seed) and `sb-cometary-verdict` ("Sever target tapped creature").

`upTo` is spell-side only in this set (`sb-gravitic-bloom`,
`sb-bloomdrive-surge`); targeted triggers stay single-target. Ops that say
`to: 'target'` apply to EACH chosen target when `upTo` is present.

### 1b. Mark-event triggers

New `TriggerWhen` members, all mandatory and all trigger-safe (no targets):

```ts
| 'gainsMark'        // this permanent gained a mark
| 'yourPermanentMarked' // a permanent you control became marked (incl. this)
| 'youAddMark'       // you added a mark to any permanent
| 'otherCreatureMarked' // another creature (any controller) gained a mark
| 'propagated'       // you resolved a Propagate (once per propagate op)
```

**Batching rule:** one firing per mark added per permanent. A Propagate that
adds marks to three permanents fires `youAddMark` three times and `gainsMark`
once on each. `propagated` fires exactly once regardless of how many marks the
pass added (that is its point: Prism-Void Comet draws one card per Propagate,
not per mark). Firings enqueue in battlefield order for determinism.

The marked-attack observer (`sb-eclipse-red-queen`, "whenever a marked
creature you control attacks") is the existing `attacks` trigger plus a new
`AbilityDef.condition: 'attackerMarked'` evaluated per attacker.

### 1c. Marked statics

`StaticDef` gains:

```ts
filter?: {
  subtype?: string;
  other?: boolean;
  marked?: true;              // only permanents carrying at least one mark
  who?: 'yours' | 'opponent'; // default 'yours' (existing behavior)
};
```

Negative `p`/`t` become legal on `who: 'opponent'` filters (Ossuary Gate's
-1/-0). `grantKeywords` composes with `marked` (Chrome-Violet Archon grants
Sentinel to your marked creatures). Statics recompute exactly the way existing
filtered statics do; a permanent gaining or losing its last mark changes the
filter's verdict on the next read, no event needed.

### 1d. Conditions and marked-scaled ops

`AbilityDef.condition` union grows (threshold parameterized 2026-08-28 when
the Relay/Antenna redesigns added a second n and a second subject):

```ts
| 'controlMarked'      // you control at least one marked permanent
| { kind: 'markedThreshold'; n: number; subject: 'permanents' | 'creatures' }
  // you control n-or-more marked permanents (Signal Cathedral: n 5,
  // permanents) or n-or-more creatures with marks (Relay/Antenna: n 4,
  // creatures)
```

(The attacker-marked case became the `markedAllyAttacks` observer trigger at
stage-1 landing; see the landing decisions.)

For the "bigger against marked targets" cards, one wrapper op keeps the
model flat:

```ts
| { op: 'ifTargetMarked'; then: EffectOp[]; else?: EffectOp[] }
```

(`sb-marrow-eviction`: else -2/-2, then -4/-4. `sb-void-lament`: else -1/-1,
then -3/-3. `sb-signal-drown`: condition `controlMarked` on a second ability
carrying the draw.)

### 1e. New ops

```ts
| { op: 'moveMark'; }        // two targets, both yours: from targets[0] to targets[1]
| { op: 'removeMarks'; to: 'target' }          // all marks off target creature
| { op: 'markAll'; scope: 'yourCreatures' }    // add one mark to each creature you control
| { op: 'loseLifePerTheirMarked'; who: 'opponent' } // 1 per marked creature they control
| { op: 'fetchLand' }        // top-down deck search: first land → battlefield tapped; shuffle-free (deck order is seeded; sever nothing)
| { op: 'boost'; ...; scope: 'yourMarked' }    // boost existing op gains a scope
| { op: 'foresee'; n: number; who?: 'targetOwner' } // foresee existing op gains an optional subject
| { op: 'severSelf' }                          // the source permanent -> its owner's severed zone; trigger-safe
| { op: 'raise'; to: 'top'; withMarks?: number } // raise-top gains enter-with-marks (rides the Nine Lives plusOneCounters seam on enterBattlefield)
```

(`severSelf` and `raise withMarks` were added 2026-08-28 for the
owner-approved Umbral Antenna redesign; both are trigger-safe. A creature
returned `withMarks` arrives ALREADY MARKED - a state, not an event, firing
no mark observers, and its Nine Lives is disabled by design: owner-aware,
intended.)

`moveMark` is the one two-target op in the game; its `targets` array is
`[{ what: 'yourPermanent-like spec' }, { what: same, other-vs-first }]` - the
implementation may model it as two ordered TargetSpecs with a rule that the
two choices must differ. Moving onto an unmarked permanent DOES give it its
first mark: the owner's colour-pie ruling says blue "copies and moves" and
creates none NET - a move is net-zero. (Nine Lives interaction: a moved mark
disables the destination's return exactly like any mark; that is the intended
friction, unchanged.)

`fetchLand` design note: v1 has no search-and-shuffle anywhere and the deck
is seeded-ordered. Top-down scan preserves determinism and information rules:
reveal nothing except the fetched land; non-land cards scanned past are NOT
revealed and stay in order.

### 1f. Misc singles

- **Colorless mana**: `manaAbility` widens to `(Color | 'C')[]`. `'C'` pays
  generic cost only; the auto-tap solver prefers spending `'C'` before
  coloured sources on generic. No card COSTS `{C}`; only
  `sb-interstellar-crossing` produces it.
- **Ritual with Quest chapters** (`sb-the-long-crossing`): a Ritual whose
  `chapters` is present resolves to the battlefield as a quest permanent
  (renders with the existing Quest chrome), advances a chapter at each of its
  controller's dawns exactly like existing Quests, and goes to the graveyard
  after its final chapter resolves. No new player-facing vocabulary.
- **Foresee-only artifacts** (`sb-chrome-medallion`, `sb-relay-station`):
  re-check against the shipped artifact ability path; expected to need
  nothing beyond registration once `arrives`/`dawn` abilities are confirmed
  to run on artifacts (they should already; Codex flagged them out of caution,
  not a proven gap).

## 2. Card mapping (acceptance)

Every UNMAPPED entry maps to exactly the constructs above; the wave deletes
the registry as it goes. Spot list of the trickiest:

| Card | Construct |
| --- | --- |
| sb-black-starving-orbit | sever + TargetSpec { creature, marked } (was transcribed BLANK and outside the registry; registry corrected to 65 on the branch, 2026-08-28) |
| sb-cometary-verdict | sever + TargetSpec { creature, tapped } |
| sb-astral-biomancer | arrives + condition controlMarked + targeted trigger (other permanent you control) |
| sb-signal-inversion | recall target + `foresee n:1 who:targetOwner` |
| sb-signal-cathedral | dawn foresee 2; second dawn ability with condition markedThreshold(5, permanents) → draw 1 |
| sb-starborne-relay (OWNER-APPROVED redesign) | {5}; arrives draw 1; dawn foresee 1; dawn + markedThreshold(4, creatures) → draw 1 |
| sb-umbral-antenna (OWNER-APPROVED redesign) | {4}; arrives grind self 1; dawn foresee 1 + grind self 1; dawn + markedThreshold(4, creatures) → severSelf, raise to:top withMarks:2 |
| sb-violet-wake-beacon (OWNER-APPROVED redesign) | {6}; arrives createToken Firefly; dawn + controlMarked → createToken Firefly |
| sb-gullet-of-the-hive | arrives + loseLifePerTheirMarked |
| sb-eclipse-tithe | removeMarks target; Empower stays trigger-safe (opponent loses 2) |
| sb-quiet-orbit / sb-signal-recall / sb-tidewalk-analyst | moveMark (spell / spell-with-Retell / Empower rider - NOTE: Empower ops may now target ONLY for moveMark, which relaxes the EmpowerDef "never introduce targets" comment; the ceiling test is untouched) |
| sb-the-long-crossing | Ritual + chapters persistence |
| sb-prism-void-comet | `propagated` trigger → draw 1 |
| sb-eclipse-red-queen | attacks + condition attackerMarked → damage opponent 1 |

The Empower relaxation is deliberately minimal: `EmpowerDef` ops may carry
targets only when the op is `moveMark`; everything else keeps the trigger-safe
contract.

## 3. Blast radius (grep everything, not the remembered list)

- **Replay log**: version bump (new decision kind + new ops); old replays
  refuse with a plain message, matching prior bumps.
- **Converter dead-target detector** (`scripts/avatarReserveDecks.ts`): the
  exhaustive `NARROW_TARGETS` Record forces classification of nothing new
  (the union's `what` members are unchanged), but `narrowTargetsOf` must now
  also walk targets on NON-spell abilities, and the fizzle rule means a
  dead-target card is playable-but-weaker rather than blank - re-derive
  whether the gate's refusal list changes and re-run the identity tests. A marked-target card adds a NEW supply dimension: its answers are live only where the deck can produce marks, so the supply walk must treat mark generators as the supply for marked-target specs. Any
  committed-output change STOPS the wave for an owner decision.
- **AI, all three difficulties**: target choice for arrival triggers; op
  valuations for the new ops (extend `opImpactValue`); determinized sims must
  build brains with `simDb(db)` as ever. Instrument before tuning; the
  Halo/Cathedral/Choir AI-risk trio still owes its seeded pass before ship.
- **Comments and docs naming the retired rule**: types.ts:30 block comment,
  the converter comment, docs/rules.md, docs/adding-cards.md op table,
  docs/card-building-guide.md, the art-bible facts conventions. Sweep by
  grep for "never target" and "trigger-safe".
- **rulesText.ts**: render strings for every new op and trigger (player copy:
  no em-dashes). glossary.ts needs no new mechanic names (marks and Propagate
  already exist).
- **check-art-bible / gen-docs-tables**: regenerate; the facts lines in
  docs/art-bible/starborne.md already carry the mechanics text these
  constructs implement.

## 4. Costing rider (per the section 9 rule)

The mark vocabulary's MEP rates land in `balance/power-formula.md` §4h in the
same wave (local workbench, never committed):

- Propagate: **RULED by owner 2026-08-28** (supersedes the provisional 1.05,
  calibrated directly against Proliferate pricing): one-shot (spell/arrival)
  = **0.70 MEP**; repeatable (dawn; `sb-propagation-engine` is the one
  sanctioned source) = **1.65 MEP per trigger**. Both carry a no-choice
  discount versus Proliferate (ours hits all your marked permanents with no
  selection), and the parasitic floor stays a named blind spot of single-card
  scoring. Engine-semantics confirmation (stage 1, this wave): one-shot is
  exactly one firing on spell resolution or arrival, repeatable exactly one
  per dawn trigger - the per-instance basis the rates assume holds.
- Mark-add (single, targeted): rate from the +1/+1-counter comparative
  (Hardened Scales-adjacent cards); flag `NEEDS MATH` if no clean comparative
  survives contact.
- moveMark / removeMarks / markAll / per-marked drains: comparative sweep at
  authoring time; anything truly novel is flagged `NEEDS MATH`, never
  silently guessed.
- `scripts/personas/score.ts` weights for the new ops ride the same commit
  that adds the ops (the existing `propagate: 0.7` weight becomes reachable).

## 5. Wave decomposition (Codex implements; main session owns git)

1. **Engine core** (types + EffectInterpreter + Game decision flow + replay
   bump + engine tests): the whole of section 1. Biggest PR; lands first.
2. **AI and duel UI** (AI target choice at all three difficulties + op
   valuations + determinism tests, AND the DuelScene chooseTarget prompt -
   the human path the first draft forgot to assign): after core.
3. **Tooling sweep** (converter walk of non-spell targets incl. the
   marked-target supply dimension, the `manaAbility` consumer widening that
   stage 1 bridged - landPolicy 'C' counting, mana icons - score.ts weight
   confirmation, comment sweep, docs regen): after core, parallel with AI
   (disjoint files).
4. **Data fill**: delete all 65 UNMAPPED entries on `feat/starborne-cards` by
   expressing their mechanics; rebase that branch onto the landed engine;
   the full suite and the set-shape tests gate it. THEN the branch merges,
   the Blade Assay rescore runs (ping the session holding that memory), and
   the AI-risk trio's seeded tuning pass is scheduled.
5. **Docs**: rules.md and adding-cards.md entries for the new vocabulary,
   authored by Fable, landing with wave 4.

Each Codex contract quotes the iron invariants, the file-set discipline, and
the honesty rules; the main session reviews every landing against the
allowed-file list and runs the ladder.

### Stage-1 landing decisions (2026-08-28, recorded after adversarial review)

Semantics the implementation fixed after review, or chose where the spec was
silent - all now binding:

- **The marked-attack observer is a trigger kind, not a condition**:
  `markedAllyAttacks` fires on every permanent its controller controls
  carrying the ability, once per declared marked attacker that controller
  controls (holder order = battlefield, attacker order = declaration). The
  earlier `attackerMarked` condition shape read as self-only and contradicted
  the printed text.
- **`upTo` target lists are unordered sets of distinct permanents**: no
  duplicate target, no order variants in the action space.
- **Mark-event trigger abilities must not carry mark-adding ops**
  (addCounters, markAll, propagate, moveMark) - data-validated, none of the
  65 cards needs one, and a runtime depth guard throws loudly as the second
  layer. This is what bounds mark-trigger recursion.
- **A spell op list may not defer a tail through a targeted-arrival pending**:
  the engine throws loudly rather than running the tail in the trigger's
  context. Revisit only if a future card creates a targeted-arrival token
  mid-spell.
- **moveMark fires mark-event triggers on the destination** (a move IS a
  becoming-marked); the source firing nothing on loss matches the absence of
  any mark-removed event in this vocabulary.
- **`propagated` fires even when the Propagate added zero marks** - the
  once-per-op contract, matching the Proliferate analogy.
- **Nine Lives' return mark is a state, not an event**: the returned creature
  arrives already marked and fires no mark-event triggers.
- **Targeted arrival abilities defer while untargeted ones on the same card
  run immediately** - printed-order inversion, deterministic; no shipping
  card is order-sensitive. Authors of future cards take note.
- **A chaptered Ritual on the battlefield counts as an enchantment** for
  targeting specs, mass effects, and counting (consistent with the
  enchantment Quests it mimics); `chapters` plus `retell` on one card is
  validated illegal.
- **Old replays stay watchable**: v6-v8 execution paths are preserved (the
  wave is behavior-neutral for pre-Starborne data); v10 records new games and
  only genuinely unreplayable versions refuse.

## 6. Explicitly out of scope

- Activated abilities / tap costs (the 1.8 engine feature; the future
  tap-cost Propagate stays future).
- Any card text change, any recost, any glossary mechanic addition.
- The Nine Lives x marks interaction (ruled: intended friction).
