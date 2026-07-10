<!-- source-of-truth: src/engine/types.ts, src/ui/rulesText.ts, src/engine/effects/EffectInterpreter.ts, src/engine/statics.ts, src/config/rules.ts, src/meta/SaveManager.ts, src/ai/determinize.ts, docs/rules.md, tests/ai/winrate.test.ts · last-verified: 2026-07-10 · design/plan doc (SHIPPED — see status banner) · re-verify when the referenced code changes -->

# De-MTG term re-theme (Tier-3 full engine rename)

> **STATUS — SHIPPED ✅ (2026-07-07).** Landed as PR #14 (engine rename) plus
> PR #16 (design/concept-doc flavor sweep). The live engine ids match this
> plan: the 11 keyword ids are renamed (`skyborne`, `wardingGaze`,
> `firstBlade`, `twinBlades`, `warcry`, `overrun`, `sentinel`, `bulwark`,
> `deathblade`, `bloodoath`, `untouchable` in `src/engine/types.ts`), and
> `CardType` uses `charm`/`ritual` in place of instant/sorcery. No save
> migration was needed, exactly as the audit below predicted. Known residue,
> deliberately left: MTG vocabulary in internal comments and helper-local field
> names (e.g. the `Hit` struct in `src/engine/combat/damage.ts`), and the
> `src/data/cards/instants.ts` / `sorceries.ts` file names — none of it
> player-facing or engine-id surface. This doc is retained as the design
> record.

## Context

Darling Blades inherited Magic's vocabulary when it was prototyped. The goal is to make
the game speak its **own** voice: keep terms that are generic gaming vocabulary, and
re-theme the ones that are distinctively Magic's — both in the player-facing surface **and**
in the code's internal identifiers ("beyond just a front-end, change the code as well").

This plan **supersedes** [`docs/plan-keyword-rethemes.md`](plan-keyword-rethemes.md),
which was deliberately *display-only* and covered only the 11 keyword abilities. It reuses
that plan's approved keyword name-table but overrides its "engine ids frozen / out of scope
to touch code" stance per explicit user direction, and broadens the sweep to all MTG terms.

**Two audited facts make a full engine rename safe:**
1. The save blob stores **only** card IDs, deck lists (arrays of cardIds), counts, numeric
   seeds, and settings — no keyword/type/color/zone/step strings. So renaming enum values is
   **save-safe**.
2. Determinism keys on numeric RNG seeds; there is no serialized replay or string hash. A
   *consistent* rename produces byte-identical shuffles and win-rates. **The win-rate floors
   (Medium ≥ 0.80, Hard ≥ 0.70, `tests/ai/winrate.test.ts`) are the completeness tripwire** —
   if a lockstep site is missed, the AI's opponent-model stand-ins throw and Hard's win-rate
   collapses below floor.

**The one migration-avoiding decision:** card-ID prefixes `so-`/`in-` *are* persisted in
saves (`collection`, `decks`, `starterChosen`, `heroCardId`). Nothing derives a card's type
from its prefix (verified — ids are opaque handles). So we **keep the existing card-ID
strings unchanged** — `so-doom-bolt` stays `so-doom-bolt` even though it becomes a Ritual.
This keeps the entire change **migration-free**: `SaveData.version` does not
change from the live schema version, and no `migrate()` step is needed. (A
one-line "legacy opaque id namespace" comment atop `sorceries.ts`/`instants.ts`
notes the intentional prefix/type divergence.)

## Scope decisions (locked)

| Decision | Choice |
| --- | --- |
| Depth | **Tier 3** — full engine-id rename, not display-only |
| Mana + W/U/B/R/G colors | **Keep** (generic; mana pre-dates MTG) |
| Tap / untap (+ symbol) | **Keep** (treated as generic action vocab) |
| Sorcery | → **Ritual** |
| Instant | → **Charm** *(user-confirmed; minor "* Charm" echo accepted)* |
| Power / Toughness | → **Attack / Defense** |
| creature / enchantment / artifact / land | **Keep** (generic fantasy vocabulary) |
| graveyard, battlefield (fields), winReason, supertypes, +1/+1 counters, aura, rarity | **Keep** (generic; e.g. Yu-Gi-Oh also uses "Graveyard") |

## The rename dictionary

### Keywords — `Keyword` union (`types.ts:6-17`) + display maps (`rulesText.ts:3-30`)

| old id | **new id** | Display | Reminder text (accurate to `rules.md:181-193`) |
| --- | --- | --- | --- |
| flying | `skyborne` | Skyborne | Can only be blocked by creatures with Skyborne or Warding Gaze. |
| reach | `wardingGaze` | Warding Gaze | Can block creatures with Skyborne. |
| firstStrike | `firstBlade` | First Blade | Deals combat damage before creatures without First Blade. |
| doubleStrike | `twinBlades` | Twin Blades | Deals combat damage both before and alongside creatures without First Blade. |
| haste | `warcry` | Warcry | Can attack and tap the turn it arrives. |
| trample | `overrun` | Overrun | Excess combat damage past its blockers is dealt to the defending player. |
| vigilance | `sentinel` | Sentinel | Attacking does not cause this creature to tap. |
| defender | `bulwark` | Bulwark | Cannot attack. |
| deathtouch | `deathblade` | Deathblade | Any amount of combat damage it deals to a creature is lethal. |
| lifelink | `bloodoath` | Bloodoath | Its controller gains that much life when it deals damage. |
| hexproof | `untouchable` | Untouchable | **Your opponents can't target** this creature with spells or abilities. |

`untouchable` keeps the ONE-SIDED wording — your own spells still reach it (`rules.md:186`).

### Card types — `CardType` (`types.ts:19`); `typeLine` capitalizes the id

`'creature' | 'charm' | 'ritual' | 'enchantment' | 'artifact' | 'land'` — display "Charm" / "Ritual".

### Stats — `power`/`toughness` → **`attack`/`defense`**; display "Attack/Defense"

Full words, **not** `atk`/`def` (`def` collides with the `def(db,id)` lookup helper at
`types.ts:111`). The stat noun `card.attack` never clashes with the attack *action*, which
is verb-phrased (`declareAttackers`, `canAttack`) — but **never introduce a bare `attack`
local**; always `card.attack` / `stats.attack`. Affected: `CardDef.power/toughness`,
`EffectiveStats` (`statics.ts:5-6`), the delta shorthands `UntilEotMod.p/t` and `StaticDef.p/t`
and `pump.p/t` → `a/d`, and the `` `${power}/${toughness}` `` face render (`CardView.ts:333`).

### Zone / Step / Trigger

- **`PlayerState.library` → `deck`** (`types.ts:203`; keep the "LAST element = top" comment).
  View counts become `deckCount` (`view.ts`). No clash with meta `SaveData.decks[]` (engine
  never imports meta); aligns with the kept `winReason: 'deck'`.
- **Step + TriggerWhen `upkeep` → `dawn`** (recommended; alt `rally`/`muster`). Display "Dawn";
  oracle text "At the beginning of your upkeep," → **"At the start of your turn,"**. Does not
  collide with the kept `untap` step.
- **TriggerWhen `etb` → `arrives`** (recommended; alt `enters`). Oracle "When this enters the
  battlefield," → **"When this arrives,"** (consistent with the Warcry reminder's "the turn it
  arrives"). `GameState.battlefield` field is **kept** (engine-only, plain English).

### Effect ops — `EffectOp` (`types.ts:46-64`); internal discriminants, never shown

| old | **new** | Rewritten oracle line |
| --- | --- | --- |
| mill | `grind` | "put the top {N} card(s) of your deck into your graveyard" (opp variant symmetric) |
| regrowth | `reclaim` | "return target creature card from your graveyard to your hand" (unchanged wording) |
| reanimate | `raise` | "return … creature card from your graveyard to **play**" ("the battlefield"→"play") |
| fog | `preventCombat` | "prevent all combat damage that would be dealt this turn" (unchanged) |
| counter | `cancel` | "cancel target spell" |
| bounce | `recall` | "return target creature to its owner's hand" (unchanged) |
| rampBasic | `fetchLand` | "search your **deck** for a basic land and put it into **play** tapped" |
| pump | `boost` | "target creature gets +{a}/+{d} … until end of turn" (p/t→a/d) |

Unchanged ops: damage, gainLife, loseLife, draw, discardRandom, destroy, addCounters, tap,
createToken, massDestroy. Note: `massDestroy` filter id `'allFliers'` stays, but its rendered
text "destroy all creatures with **flying**" → "…with **Skyborne**"; "+1/+1 counter" unchanged.

### Player-facing literals (`DuelScene.ts`, doc mirrors)

"You may cast an instant" → "You may cast a **Charm**"; "Stack (top last):" → "**Pending** (top
last):" *(borderline — "stack" is also a generic CS term; keep-or-rename is a low-stakes call
at implementation)*; **"AVAILABLE MANA" stays** (mana kept). `adding-cards.md`/`architecture.md`
mirror "enters the battlefield"/"cast an instant" phrasing → "arrives"/"cast a Charm".

## Execution — 7 milestones, each ends typecheck + test + gate green

Ordering principle: most self-contained union first; the EffectOp milestone (which trips
`gen-docs-tables`) last-but-one. Exhaustive `Record<Keyword>`/`Record<CardType>` maps force
their display keys into the **same commit** as the union — display cannot be deferred.

- **M1 — Keywords (11).** `types.ts` `Keyword`; all `data/cards/*.ts` `keywords`/`pump.keywords`/
  `grantKeywords`; keyword reads in `combat/damage.ts`, `combat/legality.ts`, `statics.ts`,
  `sba.ts`. **Same-commit lockstep:** `ai/value.ts` `KEYWORD_BONUS`, `ai/combatPlans.ts`
  `.has('deathtouch'|'firstStrike'|'trample'|'lifelink')`, `rulesText.ts` `KEYWORD_NAMES` +
  `KEYWORD_REMINDER` + the "with flying"→"with Skyborne" prose, tests (`helpers.ts`,
  keywords/doublestrike/combat/combatPreview/autopass/stack/divergence/keywordReminders).
  Regenerate `art-bible/ragnarok.md` (`scripts/gen-ragnarok-artbible.ts`) + **hand-edit the 8
  sibling Card-facts lines**; `rules.md` glossary.
- **M2 — Card types (sorcery→ritual, instant→charm).** `types.ts` `CardType`; `types:` fields in
  `sorceries.ts`/`instants.ts`/`ragnarok.ts` (**ids stay `so-`/`in-`**). **Lockstep:** `actions.ts`,
  `resolve.ts`, `MediumAI.ts`/`HardAI.ts` `isType('instant')` trick gates, `determinize.ts`
  `countSeen` + the `UNKNOWN_*` stand-in defs, `helpers.ts` TEST_DB. `typeLine` renders
  "Ritual"/"Charm" automatically. Add legacy-id-namespace comments.
- **M3 — Stats (power/toughness→attack/defense; p/t→a/d).** `types.ts` `CardDef`/`UntilEotMod`/
  `StaticDef`/`pump`; `statics.ts` `EffectiveStats`; readers `combat/damage.ts`, `sba.ts`; AI
  `combatPlans.ts`/`value.ts`/`evaluate.ts`/`EasyAI.ts`; **every creature `power:`/`toughness:`
  across `data/cards/*.ts`** (the bulk churn ~500 fields); UI `CardView.ts`, `BoardCardView.ts`,
  `DuelScene.ts`, `CardShowcaseScene.ts`, `CombatFx.ts`, `data/attackFx.ts`. **Script lockstep
  (tsc includes scripts/):** `check-art-bible.ts` + `gen-ragnarok-artbible.ts` field reads (the
  `.md` numeric "4/4" content is unchanged); `determinize.ts` stand-in stat keys.
- **M4 — Zone library→deck.** `types.ts` `PlayerState.deck`; `view.ts` `deckCount`; `phases.ts`
  `drawCards`; `EffectInterpreter.ts` (fetchLand/grind reads); `Game.ts`, `determinize.ts`,
  `DuelScene.ts`; tests (mill/stack/helpers/determinism).
- **M5 — Steps/triggers (upkeep→dawn, etb→arrives).** `types.ts` `Step` + `TriggerWhen`;
  `phases.ts` (`stepChanged`, `fireTriggers(…,'upkeep')`); `EffectInterpreter.ts`
  `fireTriggers(…,'etb')`; `rulesText.ts` `abilityText` cases + sentences; every
  `when:'etb'|'upkeep'` across `data/cards/*.ts`; tests. `rules.md` turn table "Upkeep"→"Dawn".
- **M6 — Effect ops (+ `allFliers` text).** **Four sites move together or `gen-docs-tables`
  fails:** (1) `types.ts` `EffectOp` union, (2) `EffectInterpreter.ts` `runOp` `case` labels,
  (3) `rulesText.ts` `opText` cases + "with Skyborne" prose, (4) card-data ops. Plus
  `determinize.ts` `op:'pump'→boost`, tests. **Then run `gen-docs-tables.ts` in write mode** to
  rebuild the `adding-cards.md` EffectOp table and **hand-restore the Semantics prose cells**
  (the generator can't carry them across a key rename), then `--check` green. Update the
  `plan-mod-ugc.md` EffectOp-whitelist prose.
- **M7 — Finalization.** Bump `last-verified` on the ~20 touched docs; re-run
  `gen-ragnarok-artbible.ts` and diff; README/version copy pass; full green ladder; preview a
  whole turn (draw → arrives trigger → combat with a renamed keyword → cast a renamed op).

## Traps & collisions (must-not-break)

1. **`defender: PlayerId` is the defending *player*** (`legality.ts`, `combatPlans.ts`), NOT the
   keyword — rename the keyword by union+usage, **never a global text sweep**.
2. **Never name the defense field `def`** — collides with the `def(db,id)` helper. Use `defense`.
3. **`determinize.ts` stand-ins are a hidden 3-milestone lockstep** (`types:['instant']` M2, stat
   keys M3, `op:'pump'` M6). Miss one → `def()` throws → Hard lookahead worlds → −∞ → **Hard
   win-rate drops below 0.70**. The win-rate gate is the completeness alarm.
4. **`upkeep`→`dawn` only** — do not let a phase sweep catch the kept `untap`.
5. **`allFliers` filter literal** stays (renaming its Shape cell trips `gen-docs-tables`); fix the
   "with flying"→"with Skyborne" *prose* in M1, leave the literal.
6. **EffectOp union ↔ `runOp` case must change together** or `gen-docs-tables --check` fails both
   ways; the generator drops hand-written Semantics prose → hand-restore.
7. **`library`→`deck` cognitive overload** vs meta `decks[]` — no symbol clash (layer purity),
   but comment the distinction (engine `deck` = draw pile; meta `decks[]` = built decklists).
8. **`tests/helpers.ts` TEST_DB** is touched in M1–M6 — budget for it every milestone.
9. **`src/mods` does not exist** — the mod/UGC whitelist is doc-only; coordination is a prose
   edit in `plan-mod-ugc.md`, not code.

## Gates & verification (run every milestone, in order)

1. `npm run gen-art-manifest` → 2. `npx tsc --noEmit` (includes scripts/) → 3. `npm run lint`
(catches shadowed `def`/unused) → 4. `npx vitest run` (**watch Medium ≥ 0.80 / Hard ≥ 0.70** +
the ~20 engine-id tests) → 5. `npm run build` → 6. `npm run check-art-bible` (**hard**) →
7. `npx tsx scripts/gen-docs-tables.ts --check` (**hard**; regen+restore in M6) →
8. `npm run check-docs` (soft; bump `last-verified`; run `--strict` locally in M7).
9. **Preview probe** (hidden-tab dev server, `game.renderer.snapshotArea` + `preview_eval` per
   the repo's WebGL recipe): M1 card face reads "Skyborne/Overrun"; M2 "Ritual/Charm" type line;
   M3 board card "Attack/Defense"; M4 draw/deck-out; M5 "When this arrives"/"Dawn"; M6 a
   grind/raise/recall oracle line; M7 a full turn end-to-end. Finish with a `grep -ri` of the
   retired MTG terms across **player-facing** files to confirm none leak into rendered strings.

## Docs to update

`rules.md` (keyword glossary + combat prose + turn table + soften the "differences from Magic"
appendix framing), `adding-cards.md` (EffectOp table regen + engine-id-vs-display note),
`architecture.md` (phrasing mirrors), `ai.md` (heuristic prose uses new keyword ids), the 9
`art-bible/*.md` (Card-facts + flavor), `plan-mod-ugc.md` (whitelist prose), and
`plan-keyword-rethemes.md` (superseded banner). Bump every touched doc's `last-verified` date.

## Minor names still adjustable at implementation

`dawn` (upkeep) and `arrives` (etb) are recommendations — trivially swappable (alts:
`rally`/`muster`, `enters`). "Pending" vs keeping "Stack (top last):" is a low-stakes call.
Everything else is locked.
