<!-- source-of-truth: src/engine/types.ts, src/data/cardTypes.ts, src/data/catalog.ts, src/data/cards/greek.ts, src/data/cards/instants.ts, src/engine/effects/EffectInterpreter.ts, src/engine/effects/targeting.ts, src/ui/rulesText.ts, src/art/ArtResolver.ts, src/data/art-manifest.json, src/meta/SaveManager.ts, src/meta/services.ts, src/ai/value.ts, docs/art-pipeline.md, docs/architecture.md · last-verified: 2026-07-06 · design/plan doc — re-verify when the referenced code changes -->

# Mod / UGC pack system

A plan for letting players author their own cards — art, name, flavor, and stats
— as data-only "packs" that drop into the collection and deckbuilder alongside
the 210 base cards. The hard constraint, enforced by a dedicated validation
layer, is that **a mod may introduce no new mechanics**: every ability on a
modded card must be composed entirely from the engine's existing keyword and
`EffectOp` vocabulary. A modded card is a new skin + stats + name over rules the
engine already knows how to execute. Nothing is ever `eval`'d; the whole feature
is JSON + PNG in, validated `CardDef`s out.

## Why this is safe by construction

The engine already consumes a fully data-driven card schema. `CARD_DB` is
assembled in `src/data/catalog.ts` from static arrays, then injected into the
game via `new Game({ decks, seed, db: CARD_DB })` and into the AI via
`buildAI(difficulty, CARD_DB, …)` (both wired in `src/scenes/DuelScene.ts:277-278`).
The engine never imports the catalog — it only knows the `CardDb` handed to it.
Every effect a card can have is a member of the closed `EffectOp` union
(`src/engine/types.ts:46-64`) interpreted by `runOp` in
`src/engine/effects/EffectInterpreter.ts`; every keyword is a member of the
closed `Keyword` union (`types.ts:6-17`). The AI's card heuristic
(`src/ai/value.ts` `cardValue`/`permValue`) reads only `CardDef` fields —
`cost`, `power`, `toughness`, `keywords`, `abilities` — with **no hardcoded id
list anywhere**. Therefore any card whose `CardDef` is built from the existing
vocabulary is automatically executable by the engine and evaluable by the AI,
with zero engine or AI changes. The entire risk surface collapses to one
question: *is this uploaded JSON a legal `CardDef` restricted to the existing
vocabulary?* That question is answered by a validator, and the validator is the
heart of this document.

## Layer placement and iron-invariant compliance

Per `docs/architecture.md`, `src/engine|ai|data|meta|config` must never import
Phaser or browser APIs, and the engine must stay seeded-deterministic. Mod
loading touches the filesystem / File API / IndexedDB, so it cannot live in the
engine. The plan introduces a **new `src/mods/` layer**:

- `src/mods/schema.ts` — the `ModManifest` / `ModCardDef` types and the
  whitelist constants (pure data, no imports beyond `engine/types`).
- `src/mods/validate.ts` — `validateModManifest(raw): ModValidationResult`. Pure,
  deterministic, Phaser-free, browser-free. **This is the unit-tested gate.**
- `src/mods/ModRegistry.ts` — merges validated modded `CardDef`s into a combined
  `CardDb` and tracks enabled/disabled packs. Pure data; no Phaser.
- `src/mods/loaders/` — the only impure code. `BrowserModStore.ts` (File API +
  IndexedDB) and `TauriModStore.ts` (filesystem). These sit beside `src/meta`,
  not inside the engine, and are the *only* files that touch I/O.

Art registration (which needs Phaser's loader) stays in the `src/art` layer via
a small extension to `ArtResolver`, called from `PreloadScene`. The engine sees
only the merged `CardDb`; it never learns a card came from a mod.

## The pack package format

A pack is a folder (Tauri) or a user-selected file bundle / zip (browser)
containing:

```
mypack/
  manifest.json        # the ModManifest — card defs, metadata
  art/
    dragon-empress.png # one PNG per card, keyed by the card's local id
    ...
```

### `ModManifest` schema (`src/mods/schema.ts`)

```ts
export interface ModManifest {
  formatVersion: 1;          // pack format; bumped only if this schema changes
  packId: string;            // /^[a-z0-9-]{3,32}$/ — namespace segment
  name: string;              // display name, <= 60 chars
  author: string;            // <= 60 chars
  description?: string;      // <= 300 chars
  cards: ModCardDef[];       // 1..500 entries
}
```

`ModCardDef` is a **restricted mirror** of the engine's `CardDef`
(`src/engine/types.ts:84-103`). It deliberately omits `token` (mods cannot mint
non-collectible cards) and forces a namespaced id:

```ts
export interface ModCardDef {
  localId: string;           // /^[a-z0-9-]{2,40}$/ — unique within the pack
  name: string;              // <= 60 chars
  types: CardType[];         // subset of the CardType union
  subtypes: string[];        // each <= 24 chars, /^[A-Za-z][A-Za-z -]*$/
  supertypes?: ('legendary' | 'basic')[];
  cost?: ManaCost;           // { generic, pips } — required unless type==='land'
  colors: Color[];           // subset of WUBRG
  power?: number;            // integer 0..20, required iff creature
  toughness?: number;        // integer 1..20, required iff creature
  keywords?: Keyword[];      // WHITELIST: existing Keyword union only
  x?: { min: number };
  abilities?: AbilityDef[];  // WHITELIST-validated recursively (see below)
  manaAbility?: Color[];
  entersTapped?: boolean;
  rarity: Rarity;            // c|r|sr|ssr|ur
  flavor?: string;           // <= 240 chars
  // art is supplied by the bundled PNG, NOT a free-form artRef path
}
```

The final runtime `CardDef` is produced by the registry, which sets
`id = "mod:" + packId + ":" + localId`, injects `artRef = <same namespaced id>`,
and copies the validated fields through. The `mod:` prefix guarantees the 210
base ids (`gk-athena`, `in-doom-bolt`, `tk-wei-caocao`, …) can never collide;
`buildDb` in `catalog.ts:38` already throws on duplicate ids, giving us a
second, defense-in-depth collision check when the merged db is assembled.

### A valid modded card (worked example)

This reuses only existing vocabulary — a `flying` keyword and an `etb` trigger
running the existing `damage`/`opponent` op (exactly the shape of `gk-zeus` in
`src/data/cards/greek.ts:93-106`):

```json
{
  "localId": "dragon-empress",
  "name": "Ryuuko, Storm Sovereign",
  "types": ["creature"],
  "subtypes": ["Dragon", "Noble"],
  "supertypes": ["legendary"],
  "cost": { "generic": 4, "pips": { "R": 1, "U": 1 } },
  "colors": ["R", "U"],
  "power": 5,
  "toughness": 5,
  "keywords": ["flying"],
  "abilities": [
    { "when": "etb", "ops": [{ "op": "damage", "n": 2, "to": "opponent" }] }
  ],
  "rarity": "ur",
  "flavor": "The storm does not ask permission to land."
}
```

Registered as `mod:stormpack:dragon-empress`, art loaded from
`stormpack/art/dragon-empress.png`. `rulesText()` (`src/ui/rulesText.ts:106`)
renders its oracle text with no changes, because every op and keyword already
has a text renderer.

### An INVALID modded card (must be rejected)

```json
{
  "localId": "cheatzilla",
  "name": "Infinite Overlord",
  "types": ["creature"],
  "subtypes": ["Dragon"],
  "cost": { "generic": 0, "pips": {} },
  "colors": ["B"],
  "power": 99,
  "toughness": 99,
  "keywords": ["flying", "cannotBeBlocked"],
  "abilities": [
    { "when": "etb", "ops": [{ "op": "winGame" }] },
    { "when": "static", "ops": [{ "op": "damage", "n": 1, "to": "opponent" }] }
  ],
  "rarity": "ur"
}
```

Rejected on **five** independent grounds — the validator reports all of them:
1. `keywords` contains `"cannotBeBlocked"`, not in the `Keyword` union → reject.
2. `ops` contains `{ "op": "winGame" }`, not in the `EffectOp` union → reject.
3. `power`/`toughness` `99` exceed the stat cap (`20`) → reject.
4. A `static` ability carries `ops` instead of a `static` block — malformed
   `AbilityDef` for that `when` → reject.
5. (Advisory, not a hard reject) 0-cost 99/99 trips the balance heuristic flag
   (see Balance & fairness).

The point: rejection is driven by the *closed unions*, not by a blocklist of bad
ideas. Anything not explicitly on the whitelist is denied by default.

## The validation layer (the heart)

`validateModManifest` runs a top-down structural pass. It never throws on user
input; it accumulates a `{ ok: false, errors: ModError[] }` list so the UI can
show every problem at once.

### 1. Manifest shell
`formatVersion === 1`; `packId` matches `/^[a-z0-9-]{3,32}$/`; `cards` is a
non-empty array `<= 500`; each `localId` unique within the pack; string-length
caps on `name`/`author`/`description`.

### 2. Enum whitelists (the "no new mechanics" guarantee)
Each of these is checked against the **exact runtime union** by importing the
canonical arrays. To keep the whitelist from silently drifting out of sync with
the engine, `src/mods/schema.ts` exports frozen arrays and a compile-time
assertion that they cover the union exhaustively (a `satisfies` check plus a
`never`-exhaustiveness helper), so adding a new `EffectOp` to the engine forces a
conscious decision about whether mods may use it:

- **Keywords** — every entry of `keywords` and every `pump.keywords` /
  `static.grantKeywords` entry ∈ `{skyborne, wardingGaze, firstBlade, twinBlades,
  warcry, overrun, sentinel, bulwark, deathblade, bloodoath, untouchable}`
  (`types.ts:6-17`; Ragnarök added `twinBlades` 2026-07-06, so the whitelist
  is now eleven keywords).
- **Effect ops** — every op's `op` field ∈ the 18-member set
  `{damage, gainLife, loseLife, draw, discardRandom, destroy, bounce, counter,
  pump, addCounters, tap, rampBasic, createToken, massDestroy, fog, regrowth,
  mill, reanimate}` (`types.ts:46-64`; Ragnarök added `mill`/`reanimate`
  2026-07-06). Beyond the tag, each op's **payload** is validated
  field-by-field against its variant: e.g. `damage.to ∈ {target, opponent,
  controller}`, `damage.n` is a non-negative integer or the literal `"X"`,
  `massDestroy.filter ∈ {allCreatures, allFliers}`, `pump.scope ∈ {target,
  allYours}`, `mill.who ∈ {self, opponent}`, `reanimate.to ∈ {target, top}`.
  An unknown field on an op is rejected (no smuggling extra data). **Note:**
  `mill`/`reanimate` are graveyard-reanimator ops — a mod that whitelists them
  gains the Ragnarök archetype for free; decide per the exhaustiveness gate
  whether packs may use them.
- **Triggers** — every ability `when` ∈ `TriggerWhen`
  (`types.ts:32-39`); `targets[].what` ∈ the `TargetSpec` set
  (`types.ts:41-43`); `static.scope ∈ {attached, filter}`.
- **Types / colors / rarity / supertypes** — subsets of their respective unions.

### 3. Structural coherence (matching how base cards are authored)
- Creatures require integer `power`/`toughness`; non-creatures must omit them.
- `cost` required unless `types` includes `land` (mirrors the "absent on lands"
  comment at `types.ts:97`); `cost.generic >= 0`, each pip count `>= 0`.
- A `spell` ability is only legal on `instant`/`sorcery` types; `etb`/`dies`/
  `upkeep`/`attacks`/`combatDamageToPlayer` only on permanents.
- `static` abilities carry a `static` block and no `ops`; non-static abilities
  carry `ops` and no `static` (the `abilityText` renderer in `rulesText.ts:66`
  assumes this split).
- **`createToken` restriction (critical):** `createToken.token` must reference
  either an existing base token id (`tok-bloom`, `tok-fox-spirit`, `tok-militia`,
  `tok-peacock`, `tok-wooden-ox` — from `art-manifest.json:208-212`) **or** a
  token defined *within the same pack and itself validated*. Mods cannot conjure
  a card id the merged db won't contain — `enterBattlefield` would throw. Token
  cards a mod defines are marked `token: true` by the registry (never
  collectible) and are the one place `token` is set, always by us, never by the
  uploader.
- `regrowth`/graveyard ops and X-spell shapes are checked for the same
  invariants base cards satisfy.

### 4. Numeric / resource sanity caps
Hard caps (reject if exceeded): `power`/`toughness` `0..20`, `cost.generic
<= 20`, total mana value `<= 25`, `draw.n <= 10`, `damage.n <= 20`,
`createToken.count <= 8`, `gainLife.n <= 40`, `abilities.length <= 4`,
`ops.length <= 4` per ability. These bound the blast radius of a hostile or
buggy pack even before the balance heuristic.

### 5. Art validation (done at load time, needs the decoded image)
Each card must have a bundled PNG. On decode: format is PNG (magic bytes), max
dimensions `1024×1024`, min `256×320` (base art is authored at 640×800 full /
320×400 half per `ArtResolver`), max file size `2 MB`. Reject SVG (can carry
script), reject animated formats. Missing art is a *warning*, not a reject — the
card falls back to `PlaceholderArtGenerator` exactly like a base card with no
manifest entry (`ArtResolver.generatePlaceholders`, `ArtResolver.ts:40`).

### Determinism
Ids are derived purely from `packId + localId` — stable across sessions and
machines, so a modded deck referencing `mod:stormpack:dragon-empress` reloads
identically. Validation performs no RNG and no wall-clock reads. Card *ordering*
in the merged db follows base-cards-first, then packs in enabled-order, then
cards in manifest order — a total, reproducible order (matters because
`ALL_CARDS = Object.values(CARD_DB)` feeds collection/scan screens).

## Loading pipeline

### Storage (both targets)
- **Tauri desktop** (`docs/desktop-build.md`): packs live under an app-data
  `mods/` directory. `TauriModStore` enumerates subfolders, reads
  `manifest.json`, and reads the `art/*.png` bytes. This is the primary,
  frictionless path (drop a folder in, restart).
- **Browser**: an "Import pack" button uses the File API (folder or `.zip`
  picker). The parsed manifest JSON and base64/`Blob` art are persisted to
  **IndexedDB** (localStorage is too small for PNGs and is already fully used by
  the save blob). `BrowserModStore` reads them back on boot. Enabled/disabled
  flags and pack metadata live in the save (see below); the heavy art bytes live
  in IndexedDB keyed by `packId`.

### Merge into `CARD_DB`
`ModRegistry.buildCombinedDb(baseDb, enabledPacks)` returns a frozen `CardDb`
that is base cards plus the validated modded `CardDef`s. The single wiring change
is that `DuelScene`, `CollectionScene`, `DeckBuilderScene`, etc., consume the
registry's combined db instead of importing `CARD_DB` directly — cleanest via a
`Services.cardDb` accessor added in `src/meta/services.ts` (the registry lives in
`src/mods`, the accessor in `meta`, neither imports Phaser). Base `CARD_DB` stays
the immutable floor; the combined db is rebuilt whenever packs are toggled.

### Art registration
Extend `ArtResolver` with `registerModArt(packArt: Map<string, ImageBlob>)`,
called from `PreloadScene` after base art is queued. Modded ids (already
`mod:*`) are added to the resolver's `real` set and loaded from Blob URLs /
Tauri asset paths rather than `assets/art/cards/`. `getArt` needs no change: it
keys on `artRef ?? id`, which for modded cards is the namespaced id.

### Enable / disable
A mods-management screen lists installed packs with a toggle. Disabling a pack
removes its cards from the combined db and greys out (does not delete)
collection/deck entries that reference them (see save impact). Toggling triggers
a db rebuild; if a duel is in progress it is unaffected (the running `Game`
holds its own db reference).

## SaveData / schema impact

Bump `SaveData.version` with a real `migrate()` step + test
(`src/meta/SaveManager.ts`). The `5 → 6` below is illustrative — the live schema
is already at **v9** (as of 2026-07-06), so this lands as `9 → 10` whenever it
ships; read every "v5→v6" here as "the next version bump." New fields:

```ts
mods: {
  installed: { packId: string; name: string; enabled: boolean; cardCount: number }[];
  // collection entries for modded cards use the SAME collection /
  // collectionVariants maps, keyed by the namespaced "mod:pack:id".
}
```

- **Collection**: modded cards slot into the existing `collection` /
  `collectionVariants` maps unchanged — they are just ids the maps didn't have
  before. The variant system (`src/meta/variants.ts`) applies to them for free;
  frames/holo work on any card id.
- **Migration v5→v6**: spread a fresh `mods: { installed: [] }` into any v5 save.
  No data loss; existing collections untouched.
- **Mod removed / missing on load** — the crucial robustness case. On boot, for
  every id in `collection`/`decks` that starts with `mod:` and is **not** in the
  currently-enabled combined db, the game treats it as *dormant*: kept in the
  save (so reinstalling the pack restores it), hidden from the active collection
  view, and any deck containing a dormant id is flagged "needs missing pack" and
  is not gauntlet/duel-legal until resolved. This mirrors how a save must never
  crash on unknown data — `def()`/`byId()` throw on unknown ids, so scenes must
  filter dormant ids *before* handing decklists to `new Game`. A migration note
  and a helper `partitionKnownIds(save, combinedDb)` centralize this.

## Safety / trust model

- **No code execution.** Packs are pure data: JSON + PNG. Nothing is `eval`'d,
  imported as a module, or interpreted as script. The only "logic" is the closed
  `EffectOp`/`Keyword` vocabulary the base game already ships.
- **No new mechanics — guaranteed** by the whitelist validator plus the
  exhaustiveness assertion that fails the build if the engine gains an op the
  whitelist hasn't consciously admitted.
- **Art hardening**: PNG-only (no SVG/script), size and dimension caps, decoded
  before use. Corrupt art degrades to the placeholder generator, never crashes.
- **AI compatibility** — free. Because `src/ai/value.ts` and the evaluators read
  only generic `CardDef` fields (stats, keywords, abilities) with no id
  whitelist, the AI plays *with and against* modded cards using its existing
  heuristics. Worth stating explicitly in `docs/ai.md`: a modded 5/5 flyer is,
  to the AI, indistinguishable from `gk-zeus`. No AI code changes.
- **Determinism / purity preserved**: validation and merge are pure; only the
  loaders touch I/O and they live outside the engine.

## Balance & fairness

Modded cards are, by default, **practice-only and clearly badged**. The
management screen and card frames show a "MOD" marker; modded cards carry a
`source: 'mod'` provenance flag on their runtime `CardDef` (a new optional field,
ignored by the engine) so UI can badge them without an id-prefix string check.

- **Gauntlet legality**: OFF by default (gauntlet is the closest thing to a
  ranked ladder and its win-rate gates assume the balanced 210-card pool). An
  opt-in "allow mods in gauntlet" toggle exists but is flagged experimental.
- **Balance heuristic (advisory)**: the validator computes each card's
  `cardValue` (reuse `src/ai/value.ts`) against its mana value and emits a
  *warning* (not a rejection) when a card is far above the base-set curve — e.g.
  the 0-cost 99/99 above. This informs the player without policing creativity;
  hard caps in §4 are the real guardrail.

## Test strategy

The repo gates on Vitest + win-rate floors + doc checkers, so:

1. **Validator unit tests** are the primary gate (`src/mods/validate.test.ts`):
   - A golden *valid* manifest round-trips to legal `CardDef`s.
   - One targeted *reject* test per whitelist axis: bad keyword, bad op tag, bad
     op payload field, bad `when`, bad `target.what`, out-of-range stat, missing
     art reference, `createToken` to an unknown token id, `spell` ability on a
     creature, `static` ability carrying `ops`.
   - Namespacing: two packs with the same `localId` produce distinct `mod:` ids;
     a pack whose card collides with a base id is rejected.
   - Exhaustiveness: a compile-time test that the whitelist arrays cover the
     `EffectOp`/`Keyword` unions (guards against silent drift).
2. **Merge / db test**: a validated pack merged into a tiny base db is
   executable by a headless `Game` (cast the modded spell, resolve its ops) —
   proving engine integration with **no engine changes**.
3. **Save migration test**: v5→v6 round-trip; a save referencing a now-dormant
   `mod:` id loads without throwing and the dormant deck is flagged.
4. **Doc checkers** (`check-docs`, `gen-docs-tables`) must stay green; add
   `src/mods` to lint's layer-purity config so a stray Phaser import fails CI.
5. Existing **win-rate floors are unaffected** — they run on the base pool; mods
   are off in gauntlet by default, so no floor needs to ratchet.

## Phased milestones (each ends runnable + testable)

- **M1 — Schema + validator (headless, no UI).** `src/mods/schema.ts` +
  `validate.ts` + full unit-test suite. Deliverable: a pure function that turns
  raw JSON into validated `CardDef`s or a list of errors. Highest-value, fully
  gated by Vitest before any I/O exists.
- **M2 — Registry + engine integration.** `ModRegistry.buildCombinedDb`,
  `Services.cardDb` accessor, scenes switched off the direct `CARD_DB` import.
  Test: headless duel with a hand-fed validated pack. No storage yet (packs
  injected in-memory).
- **M3 — Save schema + collection integration.** v5→v6 migration, dormant-id
  handling, modded cards appear in collection/deckbuilder (art still
  placeholder). Test: migration + partition tests.
- **M4 — Loaders + art.** `BrowserModStore` (IndexedDB) and `TauriModStore`
  (filesystem), `ArtResolver.registerModArt`, the import UI and management
  screen. Real art renders. Manual preview-probe verification per the playbook.
- **M5 — Provenance, badging, balance advisory, gauntlet opt-in.** Polish:
  "MOD" badges, balance-warning surface, docs (`docs/adding-cards.md` gets a
  "modding" section, `docs/ai.md` gets the AI-compat note, `docs/roadmap.md`
  Planned entry).

## Open questions / decisions for the user

1. **Distribution format** — single `.zip` per pack, or a folder? (Plan assumes
   folder on desktop, `.zip` or folder-picker in browser.) A shareable single
   file is friendlier but adds a zip dependency in the browser path.
2. **Gauntlet legality default** — the plan keeps mods out of gauntlet by
   default with an experimental opt-in. Confirm, or make gauntlet base-only with
   no opt-in at all?
3. **Token authorability** — the plan lets a pack define its own token cards
   (validated, marked non-collectible) so `createToken` can reference them. If
   that's more than you want, restrict `createToken.token` to the five base
   token ids only.
4. **`x` (X-spells) and `manaAbility`** — allow modded X-spells and modded
   mana-producers? Both are existing vocabulary and safe, but they widen the
   design space; easy to disallow in M1 and add later.
5. **Sharing / trust surface** — is import strictly local files the player
   chose, or is any in-app pack browser/gallery envisioned later? That would
   raise a content-moderation question this data-only plan does not address.
6. **Dependency on `src/meta/services.ts` and scene imports** — M2 requires
   switching several scenes and the AI wiring from importing `CARD_DB` directly
   to reading `Services.cardDb`. This touches files outside this doc's scope;
   flagged here rather than edited. It should be a mechanical, low-risk change
   but wants a review pass.
