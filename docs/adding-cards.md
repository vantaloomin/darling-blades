<!-- source-of-truth: src/config/rules.ts, src/engine/types.ts, src/data/cardTypes.ts, src/data/catalog.ts, src/data/cards/, src/engine/effects/EffectInterpreter.ts, src/engine/effects/targeting.ts, src/engine/statics.ts, src/engine/resolve.ts, src/ui/rulesText.ts, src/ui/fx/HoloEffects.ts, src/ui/CardView.ts, src/meta/PackOpener.ts, src/meta/Achievements.ts, tests/data/catalog.test.ts, tests/data/gender.test.ts · last-verified: 2026-07-12
     If you change those files, update this doc or re-verify the date. -->

# Adding cards

Cards are pure data. A `CardDef` object describes a card; the engine interprets
it; the UI generates its rules text and art. You never write imperative card
code and you never hand-write oracle text — you fill in fields and the rest is
derived.

## Where cards live

Card definitions live in per-set files under `src/data/cards/`:

| File              | Set                                    | ID prefix   |
| ----------------- | -------------------------------------- | ----------- |
| `tk-wei.ts`       | Three Kingdoms — Wei                    | `tk-wei-`   |
| `tk-wu.ts`        | Three Kingdoms — Wu                     | `tk-wu-`    |
| `tk-shu.ts`       | Three Kingdoms — Shu                    | `tk-shu-`   |
| `tk-jin.ts`       | Three Kingdoms — Jin                    | `tk-jin-`   |
| `tk-other.ts`     | Three Kingdoms — "Other" officers       | `tk-other-` |
| `greek.ts`        | Greek pantheon / Olympus                | `gk-`       |
| `beastkin.ts`     | Beastkin                                | `bk-`       |
| `instants.ts`     | Charms (`charm` type; `in-` legacy id) | `in-`       |
| `sorceries.ts`    | Rituals (`ritual` type; `so-` legacy) | `so-`       |
| `enchantments.ts` | Auras + banners                         | `en-`       |
| `artifacts.ts`    | Artifacts / constructs                  | `ar-`       |
| `duals.ts`        | Dual taplands                           | `ld-`       |
| `lands.ts`        | Basic lands                             | `land-`     |
| `tokens.ts`       | Tokens (non-collectible)                | `tok-`      |
| `ragnarok.ts`     | Ragnarök expansion                      | `rg-`       |

Each file exports a `const` array typed
`... as const satisfies readonly CardDef[]` and imports the `cost()` shorthand
from `../cardTypes`.

### Catalog assembly and the duplicate guard

`src/data/catalog.ts` imports every set, concatenates them (`SETS`), and folds
them into `CARD_DB` in `buildDb()`. **`buildDb` throws on any duplicate id** —
`if (db[card.id]) throw new Error(\`Duplicate card id: ${card.id}\`)` — so id
collisions fail loudly at startup and in tests. The frozen `CARD_DB` is what the
game injects into `Game`; `ALL_CARDS` and `byId()` are the scan/lookup helpers
the scenes use.

The **id prefix conventions above are enforced by a test**
(`tests/data/catalog.test.ts` — "ids follow the per-set prefix conventions"),
which also asserts every catalog card belongs to exactly one set.

## The `CardDef` schema, field by field

From `CardDef` in `src/engine/types.ts` (re-exported through
`src/data/cardTypes.ts`):

| Field         | Type                                   | Notes                                                                 |
| ------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `id`          | `string`                               | Unique; must carry its set prefix.                                    |
| `name`        | `string`                               | Display name.                                                         |
| `types`       | `CardType[]`                           | `creature`/`charm`/`ritual`/`enchantment`/`artifact`/`land`. Multi-type allowed (e.g. artifact + creature). |
| `subtypes`    | `string[]`                             | Free strings — tribe/role (e.g. `['Beastkin', 'Kitsune']`, `['Aura']`). Lords filter on these. |
| `supertypes`  | `('legendary' \| 'basic')[]?`          | `legendary` enables the crown + legend rule; `basic` marks basic lands. |
| `cost`        | `ManaCost?`                            | Absent on lands. Use the `cost()` shorthand (below).                  |
| `colors`      | `Color[]`                              | `W`/`U`/`B`/`R`/`G`. Drives the frame. **Multicolor nonland cards must be legendary** (enforced by a catalog test). |
| `attack`       | `number?`                              | Creatures only.                                                       |
| `defense`   | `number?`                              | Creatures only.                                                       |
| `keywords`    | `Keyword[]?`                           | The eleven keywords (see [rules.md](rules.md)).                       |
| `x`           | `{ min: number }?`                     | Marks an X spell; `min` is the smallest legal X.                       |
| `abilities`   | `AbilityDef[]?`                        | Triggered/static/spell abilities (below).                            |
| `manaAbility` | `Color[]?`                             | Lands and mana creatures — the colors this source can tap for.        |
| `entersTapped`| `boolean?`                             | Dual taplands enter tapped.                                          |
| `rarity`      | `Rarity`                               | `c`/`r`/`sr`/`ssr`/`ur` (displayed as C / R / SR / SSR / UR; best-first sort order `ur < ssr < sr < r < c`). |
| `flavor`      | `string?`                              | Flavor text (may be suppressed on busy cards — see below).            |
| `artRef`      | `string?`                              | Share another card's art key (both placeholder and real art).         |
| `token`       | `boolean?`                             | Non-collectible; evaporates on leaving the battlefield.               |

### `cost()` shorthand

`cost(generic, pips)` builds a `ManaCost` (`src/data/cardTypes.ts`):

```ts
cost(2, 'RR')  // {2}{R}{R}
cost(1, 'G')   // {1}{G}
cost(0, 'W')   // {W}
cost(3)        // {3}  (colorless artifacts)
```

## Rarity, holo, and flavor conventions

### Holo finishes are per-copy, not per-card

A card definition carries **no holo field**. Holo is Axis C of a card copy's
**variant** (`HoloFinish` in `src/meta/variants.ts`), rolled per booster slot
alongside the frame style — a pull cosmetic on the specific owned copy, never
part of the card's identity. The six finishes:

| Finish        | Renders as                                                     |
| ------------- | -------------------------------------------------------------- |
| `none`        | nothing (the plain default).                                    |
| `shiny`       | diagonal white sheen sweep.                                     |
| `rainbow`     | prismatic pointer-reactive rainbow foil.                        |
| `pearlescent` | pink/green oil-slick interference bands.                        |
| `fractal`     | drifting geometric crystal-facet overlay + sparkle glints.      |
| `void`        | dark-matter vignette with motes pulled into the center.         |

Rendering lives in `applyHolo` (`src/ui/fx/HoloEffects.ts`, shader modes in
`src/ui/fx/IridescencePostFX.ts`, canvas/lite fallbacks included) and is
attached by `CardView.setCard(card, { fx: 'full', variant })`. A card rendered
**without** a variant gets no holo — a solid per-tier metallic ring + the gem
alone mark its tier (duels and the deck builder render variant-less cards). The
animated iridescent ring is reserved for the `rainbow` frame. Nothing to author per
card.

### Flavor suppression

`CardView.setCard` (`src/ui/CardView.ts`) shows flavor text **only when the
generated rules text is under ~160 characters** — busy cards drop their flavor to
keep the text box legible. Verify in `setCard`:
`card.flavor && rules.length < 160`. Nothing to author here; just know your
flavor may not display on a wordy card.

### Every card subject (and avatar boss) is a woman

Card subjects and the gauntlet avatars are all women, so their own prose must
never misgender them. A **masculine pronoun** (`he` / `him` / `his` / `himself`)
referring to the subject is a bug — write `she` / `her`. Male **third parties**
are fine (a heroine can have a father, a husband, a male foe, or duel a male
god); this is a pronouns-only rule, not a purge of every masculine noun.

`tests/data/gender.test.ts` enforces it: it scans every card `flavor` and every
avatar `title`/`blurb` for those pronouns and fails the suite (a CI gate) on any
hit. Names are not scanned (real surnames like *Zhang He* collide with the
pronoun list). If a card ever needs a masculine pronoun for a genuine male third
party ("She dared *him* to try."), register its id in that test's `ALLOW` map
with the reason.

## Abilities and the trigger model

An `AbilityDef` (`src/engine/types.ts`) is one of: a **triggered/spell** ability
(`when` + `ops`) or a **static** ability (`when: 'static'` + `static`).

`TriggerWhen` values:

| `when`                   | Fires…                                                     |
| ------------------------ | --------------------------------------------------------- |
| `spell`                  | as the body of a charm/ritual, on resolution.             |
| `arrives`                | when the permanent arrives (enters play).                 |
| `dies`                   | when the permanent dies.                                  |
| `dawn`                   | at the start of the controller's turn.                    |
| `combatDamageToPlayer`   | when it deals combat damage to a player.                  |
| `attacks`                | when it is declared as an attacker.                       |
| `static`                 | continuous — handled by `statics.ts`, not the interpreter.|

**The v1 laws** (stated at the top of `types.ts` and enforced throughout):

- **Triggers never target.** Trigger resolution needs no decision point, so
  `fireTriggers` runs a trigger's `ops` immediately with empty `targets`.
- **All targeted effects are single-target** — the interpreter reads
  `ctx.targets[0]` everywhere.

Cast-time target specs come from the first non-static ability with `targets`
(`targetSpecsOf` in `EffectInterpreter.ts`), except **auras**, which implicitly
target a creature to enchant (`castTargetSpecs` in `src/engine/resolve.ts`).

## The 18 EffectOps

Every `ops` entry is an `EffectOp` (`src/engine/types.ts`), executed by `runOp`
in `src/engine/effects/EffectInterpreter.ts`. Each op emits
`{ e: 'effectApplied', op }` first. Exact semantics:

<!-- BEGIN GENERATED: EffectOp table (ops from src/engine/types.ts + EffectInterpreter.ts · run: npm run gen-docs-tables · semantics prose is hand-maintained) -->

| Op              | Shape                                                                         | Semantics                                                                                                                                                                                                                                             | Notable events                 |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `damage`        | `{ n: number\|'X'; to: 'target'\|'opponent'\|'controller' }`                  | `n` (or `ctx.x` if `'X'`) damage. `target` → `targets[0]` (player = life loss, creature = marked damage); `opponent`/`controller` → that player's face.                                                                                               | `lifeChanged` / `damageMarked` |
| `gainLife`      | `{ n: number }`                                                               | Controller gains `n` life.                                                                                                                                                                                                                            | `lifeChanged`                  |
| `loseLife`      | `{ n: number; who: 'opponent' }`                                              | **Opponent-only.** Opponent loses `n` life.                                                                                                                                                                                                           | `lifeChanged`                  |
| `draw`          | `{ n: number }`                                                               | Controller draws `n` (can deck them out → loss).                                                                                                                                                                                                      | `drew`                         |
| `discardRandom` | `{ n: number; who: 'opponent' }`                                              | **Opponent-only.** Discards `n` random cards from the opponent's hand.                                                                                                                                                                                | `discarded`                    |
| `destroy`       | `{ to: 'target' }`                                                            | Destroys `targets[0]` (a creature); fires its `dies` triggers.                                                                                                                                                                                        | `died`                         |
| `sever`         | `{ to: 'target' }`                                                            | Sever target creature: remove it from the game into its owner's public severed pile (one-way; no dies-triggers fire, and severed cards are unreachable by `raise`/`reclaim`)                                                                          | —                              |
| `severGrave`    | `{ n: number; who: 'self'\|'opponent' }`                                      | Sever the top `n` cards of a graveyard (graveyard hate; `who` picks whose)                                                                                                                                                                            | —                              |
| `severTop`      | `{ n: number; who: 'self' }`                                                  | Sever the top `n` cards of your own deck (self-cost/tempo rider)                                                                                                                                                                                      | —                              |
| `recall`        | `{ to: 'target' }`                                                            | Returns `targets[0]` to its owner's hand (tokens evaporate). Emits `died` + a `cardsBottomed(0)` resync nudge.                                                                                                                                        | `died`                         |
| `cancel`        | `{ to: 'target' }`                                                            | **Targets a stack item** (`targets[0]` is a `stackItem`); removes it to its controller's graveyard.                                                                                                                                                   | `spellCountered`               |
| `boost`         | `{ p: number; t: number; keywords?: Keyword[]; scope: 'target'\|'allYours' }` | Until-end-of-turn `+p/+t` (+ keywords). `target` → `targets[0]`; `allYours` → every creature you control.                                                                                                                                             | (via stat recompute)           |
| `addCounters`   | `{ n: number; to: 'target'\|'self' }`                                         | Puts `n` `+1/+1` counters on `targets[0]` (`target`) or the source permanent (`self`, via `ctx.sourceIid`).                                                                                                                                           | (via stat recompute)           |
| `tap`           | `{ to: 'target' }`                                                            | Taps `targets[0]`.                                                                                                                                                                                                                                    | —                              |
| `fetchLand`     | `{}`                                                                          | Finds a basic land in the controller's deck, puts it onto the battlefield **tapped**, then **shuffles** the deck.                                                                                                                                     | `permanentEntered`             |
| `createToken`   | `{ token: string; count: number }`                                            | Creates `count` copies of `token`; **stops at the 8-creature cap**; each fires `arrives`.                                                                                                                                                             | `tokenCreated`                 |
| `massDestroy`   | `{ filter: 'allCreatures'\|'allFliers' }`                                     | Destroys all creatures (or all with Skyborne); each fires `dies`.                                                                                                                                                                                     | `died`                         |
| `preventCombat` | `{}`                                                                          | Sets `fogThisTurn` — all combat damage this turn is prevented.                                                                                                                                                                                        | —                              |
| `reclaim`       | `{}`                                                                          | Returns a creature card from **your own graveyard** (`targets[0]` is a `grave` ref) to hand.                                                                                                                                                          | —                              |
| `grind`         | `{ n: number; who: 'self'\|'opponent' }`                                      | Puts the top `n` cards of that player's deck into their graveyard. Deck-out stays a draw-step check, so milling to empty is not itself a loss.                                                                                                        | `milled`                       |
| `foresee`       | `{ n: number }`                                                               | Foresee `n`: look at the top `n` cards of your deck, bottom any subset, keep the rest in order (a deferred decision via `pendingDecisions`; revealed cards are redacted from the opponent's view)                                                     | —                              |
| `raise`         | `{ to?: 'target'\|'top' }`                                                    | Returns a creature card from **your** graveyard to the **battlefield** (summoning-sick, re-fires `arrives`, respects the 8-creature cap). `target` uses a `yourGraveCreature` target; `top` (trigger-safe) returns the most-recently-buried creature. | `permanentEntered`             |

<!-- END GENERATED -->

### Fizzle behavior

If a spell has target specs and **every** target is illegal at resolution
(`resolveStackItem` in `src/engine/resolve.ts`), the spell **fizzles**: it goes
to the graveyard doing nothing and emits `targetsFizzled`. Partial legality
(at least one legal target) resolves normally.

## Targeting kinds and untouchable

`TargetSpec.what` (`src/engine/types.ts`) with legality in
`src/engine/effects/targeting.ts`:

| `what`               | Legal target                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `creature`           | any creature (untouchable-restricted — see below).                  |
| `yourCreature`       | a creature **you** control.                                         |
| `player`             | either player.                                                      |
| `any`                | either player **or** any creature (untouchable-restricted).         |
| `spell`              | a stack item (for `cancel`).                                        |
| `yourGraveCreature`  | a creature card in **your** graveyard (for `reclaim`; deduped).     |

**Untouchable** rejects a creature target only when
`perm.controller !== caster` (`creatureTargetable`) — your own untouchable
creature is still a legal target for your own spells.

## Statics

Static abilities (`when: 'static'` + `StaticDef`) are applied on read by
`getEffectiveStats` (`src/engine/statics.ts`), never cached:

- **`scope: 'attached'`** — an aura buff/debuff; applies to the permanent the
  source is attached to (`src.attachedTo === iid`).
- **`scope: 'filter'`** — a lord/banner; applies to the source controller's
  creatures matching `filter.subtype`, with `filter.other: true` excluding the
  source itself.
- Static P/T (`p`/`t`) and `grantKeywords` stack on top of base stats, `+1/+1`
  counters, and until-EOT mods. Because effective stats are computed every read,
  statics can never desync.

## Rules text is generated — never hand-write it

`rulesText(card)` (`src/ui/rulesText.ts`) turns keywords, mana abilities, and
each `AbilityDef` into oracle-style prose. **Do not put rules text in a card
definition** — there is no such field. Author the *behavior* (keywords + ops +
statics) and check the generated wording by opening the **Card Showcase** scene
(`src/scenes/CardShowcaseScene.ts`) or dropping the id into it.

## Worked examples (verbatim from the data files)

**Vanilla creature** — stats only (`bk-bearkin-guardian`, `beastkin.ts`):

```ts
{
  id: 'bk-bearkin-guardian',
  name: 'Wildwood Bearkin',
  types: ['creature'],
  subtypes: ['Beastkin'],
  cost: cost(1, 'G'),
  colors: ['G'],
  attack: 2,
  defense: 2,
  rarity: 'c',
  flavor: 'Hibernates professionally. Fights recreationally.',
},
```

**French-vanilla creature** — stats + a keyword (`bk-harpy-skirmisher`,
`beastkin.ts`):

```ts
{
  id: 'bk-harpy-skirmisher',
  name: 'Harpy Skirmisher',
  types: ['creature'],
  subtypes: ['Beastkin', 'Avian'],
  cost: cost(1, 'R'),
  colors: ['R'],
  attack: 2,
  defense: 2,
  keywords: ['flying'],
  rarity: 'r',
  flavor: 'Her opinions arrive at terminal velocity.',
},
```

**Arrival creature** — a trigger on entry (`bk-deerkin-grovekeeper`, `beastkin.ts`):

```ts
{
  id: 'bk-deerkin-grovekeeper',
  name: 'Deerkin Grovekeeper',
  types: ['creature'],
  subtypes: ['Beastkin', 'Deerkin'],
  cost: cost(2, 'G'),
  colors: ['G'],
  attack: 2,
  defense: 2,
  abilities: [{ when: 'arrives', ops: [{ op: 'fetchLand' }] }],
  rarity: 'r',
  flavor: 'The forest follows her home and stays.',
},
```

**Lord** — a filtered static that pumps a tribe, excluding itself
(`bk-packmother`, `beastkin.ts`):

```ts
{
  id: 'bk-packmother',
  name: 'Beastkin Packmother',
  types: ['creature'],
  subtypes: ['Beastkin', 'Wolfkin'],
  cost: cost(1, 'GG'),
  colors: ['G'],
  attack: 2,
  defense: 2,
  abilities: [
    {
      when: 'static',
      static: { scope: 'filter', filter: { subtype: 'Beastkin', other: true }, p: 1, t: 1 },
    },
  ],
  rarity: 'r',
  flavor: 'The pack eats first. She insists.',
},
```

**Dies trigger** — makes a token on death (`fox_mother` in `TEST_DB`, mirrors
`bk-kitsune-*`; production equivalent `tk-other-dongzhuo` drains life on death):

```ts
{
  id: 'tk-other-dongzhuo',
  name: 'Dong Zhuo, Tyrant of Luoyang',
  types: ['creature'],
  subtypes: ['Other', 'Warlord'],
  supertypes: ['legendary'],
  cost: cost(2, 'B'),
  colors: ['B'],
  attack: 3,
  defense: 2,
  abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
  rarity: 'r',
  flavor: 'Even her downfall was expensive.',
},
```

**Removal Charm** — destroys target creature (`in-doom-bolt`, `instants.ts`):

```ts
{
  id: 'in-doom-bolt',
  name: 'Doom Bolt',
  types: ['charm'],
  subtypes: [],
  cost: cost(1, 'BB'),
  colors: ['B'],
  abilities: [
    { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] },
  ],
  rarity: 'r',
  flavor: 'One dark syllable, one vacancy.',
},
```

**X spell** — scalable damage to any target (`in-comet-blast`, `instants.ts`):

```ts
{
  id: 'in-comet-blast',
  name: 'Comet Blast',
  types: ['charm'],
  subtypes: [],
  cost: cost(0, 'R'),
  colors: ['R'],
  x: { min: 1 },
  abilities: [
    { when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 'X', to: 'target' }] },
  ],
  rarity: 'sr',
  flavor: 'Aim, invoice the heavens, release.',
},
```

**Aura** — attaches to a creature; `subtypes: ['Aura']` drives the implicit
target (`en-wings-of-dawn`, `enchantments.ts`):

```ts
{
  id: 'en-wings-of-dawn',
  name: 'Wings of Dawn',
  types: ['enchantment'],
  subtypes: ['Aura'],
  cost: cost(1, 'W'),
  colors: ['W'],
  abilities: [
    { when: 'static', static: { scope: 'attached', p: 1, t: 1, grantKeywords: ['skyborne'] } },
  ],
  rarity: 'r',
  flavor: 'Standard-issue miracle, size medium.',
},
```

**Token maker** — a ritual that makes tokens (`so-muster-militia`,
`sorceries.ts`); the token itself is defined in `tokens.ts`:

```ts
{
  id: 'so-muster-militia',
  name: 'Muster the Militia',
  types: ['ritual'],
  subtypes: [],
  cost: cost(1, 'W'),
  colors: ['W'],
  abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-militia', count: 2 }] }],
  rarity: 'c',
  flavor: 'Farm tools count. Enthusiasm counts double.',
},
```

## Pack-pool inclusion

`packPool` (`src/meta/PackOpener.ts`) decides what can appear in boosters:
**cards of the requested rarity tier that are not tokens and not basic lands**
(dual taplands are allowed, basics are not). So a new collectible card is
automatically pack-eligible; **tokens and basics are excluded** by construction.

A base booster pack is **9 card rolls at 450g**; the Ragnarök booster is **9 card
rolls at 525g**. Every card in the pack is produced by **three independent seeded
rolls**:

- **Axis A — rarity tier**: `c` 50% / `r` 30% / `sr` 14% / `ssr` 5% / `ur` 1%.
- **Axis B — frame**: `white` 50 / `blue` 30 / `red` 15 / `gold` 3.55 /
  `rainbow` 1 / `black` 0.45.
- **Axis C — holo finish**: `none` 60 / `shiny` 20 / `rainbow` 10 /
  `pearlescent` 8 / `fractal` 1.55 / `void` 0.45.

The frame + holo pair is the card copy's **variant**
(`CardVariant` in `src/meta/variants.ts`). Card picks in the `sr`, `ssr`, and
`ur` tiers are **dupe-protected within their tier** — the roll avoids repeating
the same card id inside a pack while the tier's pool allows it. This is why the
catalog test requires every tier's booster-eligible pool to be non-empty and
the `ur` pool to hold at least 4 cards.

## Expansion achievement pass

When a new expansion launches, it should also ship with achievements sized to
the expansion's collectible-card count. A small mini-set can get a few headline
or completion goals; a large set should get percentage-completion tiers plus
headliner and sub-archetype goals, with special/rainbow variant chase tiers where
the cast is important enough. Prefer deriving progress from existing
`collection` / `collectionVariants` data in `src/meta/Achievements.ts`; only bump
`SaveData.version` if the achievement needs new durable counters that cannot be
recomputed from the save.

## New-card checklist

1. **Pick the set file** and give the card an id with that set's prefix.
2. **Fill the `CardDef`** — types, subtypes, cost (via `cost()`), colors,
   P/T for creatures, keywords, abilities. Multicolor nonland ⇒ `legendary`.
3. **Behavior only** — encode triggers/statics/ops; **do not** write rules text.
4. **Tokens** referenced by `createToken` must exist in `tokens.ts` with
   `token: true` (a catalog test enforces this).
5. **Holo/frame** — nothing to author: variants are rolled per pulled copy,
   never defined on the card.
6. **Expansion achievements** — if this is a new set/expansion, add a scaled
   achievement pass for its card count, headline cast, and major sub-archetypes.
7. **Run `npm test`** — the catalog integrity tests check duplicate ids, prefix
   conventions, mana-value bounds (1–8), P/T bounds (0–10), token references,
   the rarity mix, and the multicolor-legendary rule.
8. **Eyeball the wording** in the Card Showcase scene.
