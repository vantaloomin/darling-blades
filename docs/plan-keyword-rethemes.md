<!-- source-of-truth: src/engine/types.ts, src/ui/rulesText.ts, src/ui/CardView.ts, src/engine/statics.ts, docs/rules.md, src/data/cards/beastkin.ts, src/data/cards/greek.ts, tests/engine/keywords.test.ts · last-verified: 2026-07-09 · design/plan doc — re-verify when the referenced code changes · SUPERSEDED -->

# Keyword rethemes — a Darling Blades voice for the evergreen abilities

> **⚠ SUPERSEDED by [plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md).** This doc proposed a
> *display-only* rename of the 11 keyword abilities and explicitly kept the engine ids frozen.
> The follow-on plan broadens the scope to **all** Magic-flavored terminology and, per user
> direction, performs a **Tier-3 full engine-id rename** (not display-only). The keyword
> name-table below is still authoritative and is reused verbatim by the successor plan; the
> "Implementation seam — display-only" and "Phased rollout" sections here are the *rejected*
> approach, retained for the rationale of why display-only was reconsidered.

The engine speaks Magic: eleven evergreen keywords named exactly as WotC named them
(ten at first draft; the Ragnarök expansion added `doubleStrike` 2026-07-06).
This plan renames them into the Darling Blades register (Three Kingdoms honor,
Greek myth, Beastkin instinct — blades, oaths, and legend) the way Hearthstone
turned *defender* into **Taunt** and *haste* into **Charge**. **The rules do not
change.** Only the surface — the label a player reads and the reminder text —
becomes ours. This is deliberately a *display-only* rename that lives in one
map in `src/ui/rulesText.ts` and keeps the engine's keyword identifiers, save
data, AI, and determinism completely untouched.

## The real keyword set (inventoried from code)

The authoritative list is the `Keyword` union in `src/engine/types.ts:6-17`.
There are now exactly **eleven** keywords (Ragnarök added `doubleStrike`
2026-07-06), and every one is actually used on a card
(confirmed by grepping `keywords: [` across `src/data/cards/*.ts` — beastkin,
greek, and tk-other carry the base ten; `doubleStrike` lives on the Ragnarök /
"deepening" duelists; instants/sorceries also grant `haste`,
`trample`, `firstStrike` via the `pump` op). None are dead.

| Engine id (`types.ts`) | Rule (from `docs/rules.md:177-186` + implementation) | Where the rule lives |
| --- | --- | --- |
| `flying` | Blockable only by flying/reach | `combat/legality.ts` (`canBlock`) |
| `reach` | May block fliers; no other effect | `combat/legality.ts` |
| `firstStrike` | Strikes in the first-strike sub-step; no double strike | `combat/damage.ts`, `CombatState.phase` |
| `doubleStrike` | Strikes in both the first-strike and normal sub-steps | `combat/damage.ts` |
| `haste` | Ignores summoning sickness | `statics.ts` (`isSummoningSick`) |
| `trample` | Assigns lethal to blockers, spills excess to player | `combat/damage.ts` |
| `vigilance` | Attacking does not tap | `phases.ts`/`actions.ts` |
| `defender` | Cannot attack | `combat/legality.ts` (`canAttack`) |
| `deathtouch` | Any nonzero damage is lethal | `combat/damage.ts`, `sba.ts` (`deathtouched`) |
| `lifelink` | Controller gains life equal to damage dealt | `combat/damage.ts`, `EffectInterpreter.ts` |
| `hexproof` | Blocks only the *opponent's* targeting | `effects/targeting.ts` (`creatureTargetable`) |

**Evergreen keywords the game deliberately omits** (not in the union — do not
add them under a themed name, that would be a new engine feature, not a rename):
indestructible, menace, ward, protection, flash; defender's
cousin *reach* is present but menace is not. (`doubleStrike` used to be on this
list; Ragnarök promoted it to a real engine keyword 2026-07-06, so it now needs
a themed name too — see the rename table.) `hexproof` here is the
*one-sided* variant (see `rules.md:186`), which the reminder text must respect.

## Proposed rename table

Voice guide: names are one or two words, drawn from the honor/blade/myth
register, non-colliding, and read as *battlefield doctrine* rather than
mechanics. Reminder text stays terse and rules-accurate (it is the *only*
rules-facing surface, so it must match `docs/rules.md` exactly).

| Engine id | Darling Blades name | Reminder text | Rationale |
| --- | --- | --- | --- |
| `flying` | **Skyborne** | *(Can only be blocked by creatures with Skyborne or Warding Gaze.)* | Airborne without saying "flying"; myth-friendly (harpies, Pegasus, cranes). |
| `reach` | **Warding Gaze** | *(Can block creatures with Skyborne.)* | An archer/sentinel watching the sky — pairs with Skyborne by name. |
| `firstStrike` | **First Blade** | *(Deals combat damage before creatures without First Blade.)* | Literal blade-drawing image; "first" preserved for teachability. |
| `doubleStrike` | **Twin Blades** | *(Deals combat damage both before and alongside creatures without First Blade.)* | Ragnarök keyword; pairs with First Blade by name — the two-edit two-step. Alt: **Twinstrike**. |
| `haste` | **Warcry** | *(Can attack and tap the turn it arrives.)* | A rallying charge; fits generals and beastkin. Alt: **Onslaught**. |
| `trample` | **Overrun** | *(Excess combat damage past blockers hits the defending player.)* | Cavalry/chariot breaking a line. Alt: **Breakthrough**. |
| `vigilance` | **Sentinel** | *(Attacking does not tap this creature.)* | The guard who never lowers their guard; honor register. |
| `defender` | **Bulwark** | *(Cannot attack.)* | A wall/shield-line; unambiguous, non-colliding with Sentinel. Alt: **Bastion**. |
| `deathtouch` | **Deathblade** | *(Any amount of combat damage it deals is lethal.)* | Assassin/venom flavor across all three tribes; keeps "death" for clarity. |
| `lifelink` | **Bloodoath** | *(Its controller gains that much life when it deals damage.)* | Oath/blood-pact — very on-theme for Three Kingdoms sworn brotherhood. Alt: **Lifebond**. |
| `hexproof` | **Untouchable** | *(Your opponents can't target this creature with spells or abilities.)* | Names the ONE-sided rule precisely (your own spells still reach it). Alt: **Warded** — rejected, collides with Warding Gaze. |

Naming collisions checked: *Warding Gaze* / *Warded* would shadow each other,
so `hexproof` takes **Untouchable**. *Sentinel* (vigilance) and *Bulwark*
(defender) are kept distinct because both are defensive and players confuse
them if similarly named. *First Blade* / *Deathblade* share the "blade" motif
intentionally — the world is named *Darling Blades* — but are otherwise
unambiguous.

## Implementation seam — display-only, and why

There are two conceivable approaches:

1. **Data-level rename** — change the `Keyword` union values (`'flying'` →
   `'skyborne'`) in `types.ts`, then every card in `src/data/cards/*.ts`, every
   `pump`/`grantKeywords` op, every test in `tests/engine/keywords.test.ts`, and
   any AI heuristic keyed on the string. **Rejected.** It touches the pure
   engine layer, forces a churn across ~40 card definitions and the test suite,
   and — critically — the engine ids are effectively part of the *save contract*
   and the *AI/determinism surface*. Nothing is gained: the ids are internal.

2. **Display-only rename** — the string a *player* sees is produced entirely by
   `KEYWORD_NAMES` in `src/ui/rulesText.ts:3-14`. `rulesText()` (line 106) and
   the two `pump`/static branches (lines 41, 74) are its only readers, and
   `CardView.ts:207` is the only UI consumer. **Recommended.** The engine keeps
   `'flying'` forever; only the *rendered label* becomes `Skyborne`.

Display-only is the correct choice against the iron invariants:

- **Engine purity** (`src/engine|ai|data|meta|config` never touched) — the map
  lives in `src/ui`, the presentation layer. No engine file changes.
- **Determinism** — RNG, combat, SBAs all key on the unchanged `Keyword`
  strings; byte-for-byte identical game logs. No win-rate floor can move.
- **Save schema** — `SaveData.version` does **not** bump. Saves store card ids,
  not keyword labels; decks and collections are unaffected. No `migrate()`.
- **AI** — `AIPlayer` reads `Keyword` ids off the redacted `PlayerView`; it
  never sees display strings. Untouched.

### Files that change

- **`src/ui/rulesText.ts`** — the heart of the change.
  - Replace `KEYWORD_NAMES` values with the themed labels above.
  - **Add reminder text.** Today the map holds bare labels and there is *no*
    reminder text anywhere (the keyword line at `rulesText.ts:108` just joins
    names). Introduce a parallel `const KEYWORD_REMINDER: Record<Keyword, string>`
    and a `keywordLine(d)` helper so the top line renders e.g.
    `Skyborne` with the reminder available for the zoom/tooltip view. Signature:

    ```ts
    export function keywordLine(keywords: readonly Keyword[]): string;   // "Skyborne, Overrun"
    export function keywordReminder(k: Keyword): string;                 // "(Can only be blocked…)"
    ```

    Keep `rulesText()`'s existing single-line join for the compact card face;
    surface `keywordReminder` in `CardZoomPreview` (the big view) so new players
    get the rule without cluttering the small card. This is additive — the
    lowercase inline uses at lines 41/74 (`gains skyborne, overrun`) keep
    working because they still read `KEYWORD_NAMES[k].toLowerCase()`.

- **`docs/rules.md`** — the glossary table (`rules.md:177-186`) gains a
  **Darling Blades name** column so the doc-of-record shows both the engine id
  (which stays the vocabulary the code and this doc speak) and the player-facing
  name. The prose references at lines 123-133 (flying/reach/vigilance/defender/
  trample) get the themed name in parentheses on first mention, engine id
  retained for precision.

- **`docs/adding-cards.md`** — a one-paragraph note: authors write engine ids in
  `keywords: [...]`; the themed label is display-only and lives in `rulesText.ts`.

### What does NOT change

- `src/engine/types.ts` `Keyword` union — the ten ids are frozen.
- All `src/data/cards/*.ts` — cards keep `keywords: ['flying']` etc.
- `tests/engine/*` — no engine test references a display string (verified:
  `keywords.test.ts` asserts on `'flying'`, `'hexproof'` ids only).
- `SaveData`, `SaveManager`, migrations — no version bump.
- AI, determinism, RNG, win-rate gates.

## Keeping surfaces consistent (anti-rot)

The repo gates on `npm run check-docs` and `check-art-bible` with zero
warnings. Two consistency risks:

- **Glossary drift.** The themed names now live in *two* places: the
  `KEYWORD_REMINDER` map (code) and the `rules.md` glossary (doc). To prevent
  drift, add the pair to the `gen-docs-tables` generator so the rules-glossary
  table is *generated* from a single exported source in `rulesText.ts` (export
  `KEYWORD_NAMES`/`KEYWORD_REMINDER`), and `npm run gen-docs-tables -- --check`
  fails if the doc and code disagree. This mirrors how the repo already
  generates balance/opponent tables.
- **Art-bible references.** If any file under `docs/art-bible/` names a keyword
  in flavor copy, `check-art-bible` should be extended (or the copy updated) to
  use the themed name. Grep `docs/art-bible/` for the ten ids during rollout;
  if none appear, no action — note it in the rollout checklist.

## Phased rollout

Each milestone ends runnable, typechecking, and test-green.

- **M1 — Label swap (visible, lowest risk).** Change `KEYWORD_NAMES` values in
  `rulesText.ts`. Run `npm run build` (typecheck) + `npx vitest run`. Nothing
  should move: engine tests untouched, UI now renders themed names. Screenshot
  a card via the preview probe to confirm the face reads `Skyborne`.
- **M2 — Reminder text + zoom surface.** Add `KEYWORD_REMINDER`, `keywordLine`,
  `keywordReminder`; wire reminders into `CardZoomPreview`. Add the snapshot
  test below. Verify small-card face is unchanged in layout (the compact join
  stays label-only, so `CardView` text-box fitting at `CardView.ts:240` is
  unaffected).
- **M3 — Doc + generator sync.** Add the name column to `rules.md`, feed the
  generator, make `gen-docs-tables -- --check` and `check-docs` green. Update
  `adding-cards.md`. Grep art-bible.
- **M4 — Polish.** Optional: a small "keyword legend" panel in the collection/
  rules screen listing all ten themed names + reminders (pure UI, reads the
  same two maps).

## Test strategy

The repo gates on `npx vitest run` (engine + win-rate floors) and the doc
checkers. For this change:

- **New snapshot test** `tests/ui/rulesText.test.ts` (a `src/ui` unit test —
  note `src/ui` may import from `rulesText` but must not pull Phaser; keep the
  test importing only `rulesText.ts`, which imports only `../engine/types`).
  Assert the full rendered label set: for each `Keyword`, `KEYWORD_NAMES[k]`
  equals the expected themed string and `keywordReminder(k)` is non-empty and
  matches the glossary. Snapshot `rulesText()` for one representative card per
  keyword (e.g. the beastkin/greek cards found in the inventory) so any
  accidental label change is caught.
- **Regression guard:** confirm no *engine* test imports a display string
  (already true). `npx vitest run tests/engine` must be byte-identical to the
  pre-change baseline — the win-rate floors in particular must not budge, which
  is the proof the rename is display-only.
- **Doc checker:** `npm run check-docs` + `gen-docs-tables -- --check` green.

## Interaction with sibling plans (mods/UGC and Commander)

Three writer agents are drafting `plan-*` docs concurrently; two of them touch
keywords:

- **Mod/UGC plan** — mods that define cards will reference keywords. They should
  reference **engine ids** (`'flying'`), never display labels, exactly as the
  built-in card data does. The mod schema's keyword field should validate
  against the `Keyword` union. The themed name is a *rendering* concern the mod
  gets for free via `rulesText.ts`; a mod author never types "Skyborne". If the
  mod plan wants modder-defined keywords, that is a separate engine feature
  outside this rename's scope. *(Dependency: the mod plan should state that
  keyword validation uses the engine union — noted here, not edited there.)*
- **Commander plan** — commander cards render through the same `CardView` /
  `rulesText` path, so they show themed labels automatically with zero extra
  work. No coupling beyond that.

## Risks / trade-offs

- **Teachability vs. flavor.** Renaming away from Magic terms costs players who
  already know MTG. Mitigation: reminder text on every keyword (M2) and the
  legend panel (M4); keep engine ids in `rules.md` for the rules-lawyer.
- **`Untouchable` overstates hexproof.** The engine's hexproof is *one-sided*
  (`rules.md:186`). The reminder text is written to say "*your opponents* can't
  target," which is exact — do not shorten it to "can't be targeted."
- **Two maps can drift.** Mitigated by generating the glossary from the code
  maps (M3) so the doc-check fails on divergence.
- **Inline grant text.** `pump`/static text ("and gains skyborne, overrun") now
  reads themed. Confirm it still parses naturally; the lowercase join already
  handles multi-word names ("gains warding gaze") — acceptable, but review the
  `gain${...s}` pluralization at `rulesText.ts:41` against the new names.

## Open questions / decisions for the user

1. **Name approval.** The table is a proposal. Flag any label you dislike; the
   flagged alternatives (Onslaught, Breakthrough, Bastion, Lifebond) are ready.
2. **Reminder text on the small card?** Recommendation: no — reminders only on
   the zoom/legend view to keep the face clean (`CardView` text-box is already
   tight, see the `RULES_BOX_H` scaling at `CardView.ts:240`). Confirm.
3. **Do we keep engine ids visible anywhere player-facing?** Recommendation: no
   — engine ids stay in code + `rules.md` only.
4. **Legend panel (M4) scope** — is a standalone keyword-legend UI wanted in
   this pass, or deferred to the rules/collection screen work?
5. **Generator investment (M3)** — auto-generating the glossary table is the
   anti-rot-correct path but adds a small generator change. Confirm it is in
   scope, or accept a hand-maintained table with a lint note instead.
